// Tabela operacional cashback_whatsapp — alimenta a futura integração n8n/Avisa.
// O Base44 apenas cria e mantém os registros; NENHUM envio de mensagem acontece aqui.

import { runSql, pgGet, pgInsert, pgList, ensureWhatsappSetup } from "./supabase.ts";

const esc = (s) => String(s ?? "").replace(/'/g, "''");
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ===== Modo piloto: elegibilidade de envio materializada no próprio registro =====
// O n8n consulta apenas status_telefone = 'ativo'; não precisa saber que o piloto existe.

// Lê a configuração atual do piloto em cashback_settings.
export async function getPilotConfig(key, ref) {
  const rows = await pgList(key, ref, "cashback_settings", { limit: 1 }).catch(() => []);
  const s = rows && rows[0];
  return {
    piloto_ativo: !!(s && s.piloto_ativo),
    piloto_telefones: ((s && s.piloto_telefones) || []).map((t) => String(t || "").replace(/\D/g, "")).filter(Boolean),
  };
}

// Recalcula status_telefone dos registros ativos conforme o piloto:
// - piloto ligado: telefone fora da lista → 'bloqueado_piloto'; dentro da lista → 'ativo'
// - piloto desligado: todos voltam a 'ativo'
export async function recomputePilotStatus(accessToken, key, ref) {
  const { piloto_ativo, piloto_telefones } = await getPilotConfig(key, ref);
  const activeSql = "status_cashback IN ('disponivel','parcial')";
  const phoneCol = "regexp_replace(COALESCE(telefone_whatsapp, ''), '\\D', '', 'g')";
  if (!piloto_ativo) {
    const r = await runSql(accessToken, ref,
      `UPDATE cashback_whatsapp SET status_telefone = 'ativo'
       WHERE status_telefone = 'bloqueado_piloto' AND ${activeSql} RETURNING id;`
    ).catch(() => []);
    return { piloto_ativo: false, bloqueados: 0, ativados: (r || []).length };
  }
  const list = piloto_telefones.map(esc).join(", ");
  const inList = list ? `${phoneCol} IN (${list})` : "false";
  const notInList = list ? `${phoneCol} NOT IN (${list})` : "true";
  const blocked = await runSql(accessToken, ref,
    `UPDATE cashback_whatsapp SET status_telefone = 'bloqueado_piloto'
     WHERE ${activeSql} AND status_telefone <> 'bloqueado_piloto' AND ${notInList} RETURNING id;`
  ).catch(() => []);
  const restored = await runSql(accessToken, ref,
    `UPDATE cashback_whatsapp SET status_telefone = 'ativo'
     WHERE ${activeSql} AND status_telefone <> 'ativo' AND ${inList} RETURNING id;`
  ).catch(() => []);
  return { piloto_ativo: true, bloqueados: (blocked || []).length, ativados: (restored || []).length };
}

// Cria um NOVO registro quando um cashback é gerado em uma compra.
// Copia os dados atuais do cliente (telefone/consentimentos) e nunca reutiliza
// registros anteriores. Chamar somente APÓS a venda e o cashback salvos com sucesso.
export async function insertWhatsappOnCashbackGenerated(accessToken, key, ref, payload) {
  const {
    customer_id, customer_name, sale_id, cashback_id_origem,
    valor_compra, valor_cashback_gerado, expiry_date, is_demo,
  } = payload || {};
  if (!customer_id || !cashback_id_origem) return null;
  await ensureWhatsappSetup(accessToken, ref);

  const customer = await pgGet(key, ref, "customers", customer_id).catch(() => null);
  const now = new Date().toISOString();

  // Elegibilidade de envio já decidida na gravação (modo piloto).
  const { piloto_ativo, piloto_telefones } = await getPilotConfig(key, ref).catch(() => ({
    piloto_ativo: false, piloto_telefones: [],
  }));
  const phoneDigits = String((customer && customer.phone) || "").replace(/\D/g, "");
  const statusTelefone = !piloto_ativo || piloto_telefones.includes(phoneDigits) ? "ativo" : "bloqueado_piloto";

  const row = await pgInsert(key, ref, "cashback_whatsapp", {
    cliente_id: customer_id,
    nome_cliente: customer_name || (customer && customer.name) || "",
    telefone_whatsapp: (customer && customer.phone) || "",
    cashback_comunicacao_opt_in: !!(customer && customer.cashback_comunicacao_opt_in),
    promocoes_opt_in: !!(customer && customer.promocoes_opt_in),
    data_consentimento: (customer && customer.data_consentimento) || null,
    origem_consentimento: (customer && customer.origem_consentimento) || null,
    compra_id: sale_id || null,
    cashback_id_origem,
    valor_compra: num(valor_compra),
    valor_cashback_gerado: num(valor_cashback_gerado),
    valor_cashback_utilizado: 0,
    saldo_cashback: num(valor_cashback_gerado),
    data_geracao_cashback: now,
    data_expiracao_cashback: expiry_date || null,
    status_cashback: "disponivel",
    ultima_compra_em: now,
    proxima_acao_tipo: "enviar_cashback",
    mensagem_inicial_enviada: false,
    lembrete_7_dias_enviado: false,
    aviso_expiracao_7d_enviado: false,
    aviso_expiracao_3d_enviado: false,
    aviso_expiracao_1d_enviado: false,
    tentativas_envio: 0,
    status_telefone: statusTelefone,
    is_demo: !!is_demo,
  });

  // Nova compra: marca a última compra nos registros ativos do cliente,
  // sem apagar ou sobrescrever o histórico.
  await runSql(accessToken, ref,
    `UPDATE cashback_whatsapp SET ultima_compra_em = '${now}'
     WHERE cliente_id = '${esc(customer_id)}' AND status_cashback IN ('disponivel','parcial');`
  ).catch(() => {});

  return row;
}

// Resgate de cashback: aplica o consumo por transação de origem (FIFO).
// items: [{ cashback_id_origem, consumed }]
export async function applyWhatsappRedemption(accessToken, ref, items) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  await ensureWhatsappSetup(accessToken, ref);
  let updated = 0;
  for (const it of items) {
    const origin = esc(it.cashback_id_origem || it.id || "");
    const consumed = num(it.consumed ?? it.amount);
    if (!origin || consumed <= 0) continue;
    await runSql(accessToken, ref, `
      UPDATE cashback_whatsapp SET
        valor_cashback_utilizado = valor_cashback_utilizado + ${consumed},
        saldo_cashback = GREATEST(saldo_cashback - ${consumed}, 0),
        status_cashback = CASE WHEN saldo_cashback - ${consumed} <= 0.005 THEN 'utilizado' ELSE 'parcial' END,
        proxima_acao_tipo = CASE WHEN saldo_cashback - ${consumed} <= 0.005 THEN 'nenhuma' ELSE proxima_acao_tipo END
      WHERE cashback_id_origem = '${origin}';`
    ).catch(() => {});
    updated++;
  }
  return updated;
}

// Cancelamento/reversão de venda: marca o registro correspondente como cancelado
// (nunca cria registro novo para desfazer uma operação anterior).
export async function cancelWhatsappBySale(accessToken, ref, saleId) {
  if (!saleId) return;
  await ensureWhatsappSetup(accessToken, ref);
  await runSql(accessToken, ref,
    `UPDATE cashback_whatsapp SET status_cashback = 'cancelado', proxima_acao_tipo = 'nenhuma'
     WHERE compra_id = '${esc(saleId)}';`
  ).catch(() => {});
}

// Expiração: marca o registro do cashback de origem como expirado, com saldo zerado.
export async function expireWhatsappByCashback(accessToken, ref, cashbackId) {
  if (!cashbackId) return;
  await ensureWhatsappSetup(accessToken, ref);
  await runSql(accessToken, ref,
    `UPDATE cashback_whatsapp SET status_cashback = 'expirado', saldo_cashback = 0, proxima_acao_tipo = 'nenhuma'
     WHERE cashback_id_origem = '${esc(cashbackId)}' AND status_cashback IN ('disponivel','parcial');`
  ).catch(() => {});
}

// Preferências do cliente → registros ATIVOS em cashback_whatsapp (o histórico
// antigo preserva o consentimento da época; os ativos refletem a preferência
// atual para o n8n consultar).
export async function syncConsentsToWhatsapp(accessToken, key, ref, customerId) {
  if (!customerId) return;
  await ensureWhatsappSetup(accessToken, ref);
  const c = await pgGet(key, ref, "customers", customerId).catch(() => null);
  if (!c) return;
  const dt = (v) => (v ? `'${esc(v)}'` : "NULL");
  await runSql(accessToken, ref, `
    UPDATE cashback_whatsapp SET
      cashback_comunicacao_opt_in = ${!!c.cashback_comunicacao_opt_in},
      promocoes_opt_in = ${!!c.promocoes_opt_in},
      data_consentimento = ${dt(c.data_consentimento)},
      origem_consentimento = ${dt(c.origem_consentimento)},
      opt_out_em = ${dt(c.opt_out_em)}
    WHERE cliente_id = '${esc(customerId)}'
      AND status_cashback IN ('disponivel','parcial');`
  ).catch(() => {});
}