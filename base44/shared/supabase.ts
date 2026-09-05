// Acesso compartilhado ao projeto "Cashback" no Supabase via conector Base44.
// Usado por todas as funções de backend que precisam ler/gravar dados no Supabase.

const API_BASE = 'https://api.supabase.com/v1';
const PROJECT_NAME = 'Cashback';

// ===== Horário de Brasília (UTC-3) =====
// Todas as gravações de data/hora do sistema usam o horário local de Brasília
// (o Brasil não usa horário de verão desde 2019, então o offset é fixo).
// Os padrões/triggers no banco gravam o mesmo valor (pareamento com timezone('UTC', ...)).
export function nowBrasilia() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
}
export function todayBrasilia() {
  return nowBrasilia().split("T")[0];
}

// Caches entre invocações (o processo sobrevive por um tempo).
let cachedRef = null;
let cachedKey = null;
let cachedKeyRef = null;

// Obtém a conexão OAuth do conector Supabase (token de acesso).
export async function getConnection(base44) {
  const conn = await base44.asServiceRole.connectors.getConnection('supabase');
  if (!conn || !conn.accessToken) {
    throw new Error('Supabase não conectado. Autorize o conector Supabase no painel da aplicação.');
  }
  return conn;
}

// Project ref estável do projeto "Cashback" no Supabase.
// Hardcoded para evitar chamar a Management API (listar TODOS os projetos) a cada
// operação de CRUD — isso causava rate-limit (HTTP 500) sob chamadas rápidas sequenciais.
const HARDCODED_PROJECT_REF = 'raafupwilsmuuyxdskca';

// Resolve o project ref. Usa o valor hardcoded (estável) e evita a chamada à
// Management API. Mantém assinatura com accessToken por compatibilidade.
export async function getProjectRef(accessToken) {
  if (cachedRef) return cachedRef;
  cachedRef = HARDCODED_PROJECT_REF;
  return cachedRef;
}

// Executa SQL arbitrário (SELECT, INSERT, UPDATE, DELETE, DDL) no projeto.
export async function runSql(accessToken, ref, query) {
  const res = await fetch(`${API_BASE}/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SQL error (${res.status}): ${text}`);
  }
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

// Colunas comuns a todas as tabelas (espelham os atributos embutidos do Base44).
const COMMON = [
  'id uuid primary key default gen_random_uuid()',
  'created_date timestamptz default (timezone(\'UTC\', now() AT TIME ZONE \'America/Sao_Paulo\'))',
  'updated_date timestamptz default (timezone(\'UTC\', now() AT TIME ZONE \'America/Sao_Paulo\'))',
  'created_by_id text',
].join(', ');

// Definições das tabelas que espelham as entidades do app.
export const TABLES = {
  customers: [
    'name text', 'phone text', 'email text', 'cpf text', 'identifier_code text',
    'legacy_id text',
    'accepts_promotions boolean default false',
    'promocoes_opt_in boolean default false',
    'cashback_comunicacao_opt_in boolean default false',
    'data_consentimento timestamptz',
    'origem_consentimento text',
    'opt_out_em timestamptz',
    'available_balance numeric default 0', 'pending_balance numeric default 0',
    'total_cashback_earned numeric default 0', 'total_cashback_used numeric default 0',
    'is_demo boolean default false', 'is_active boolean default true', 'notes text',
  ].join(', '),
  sales: [
    'sale_number text', 'customer_id text', 'customer_name text',
    'total_amount numeric', 'eligible_amount numeric', 'cashback_amount numeric',
    'cashback_used numeric default 0', 'payment_method text', 'sale_date date',
    'category_id text', 'status text default \'concluida\'',
    'cashback_generated boolean default false', 'cashback_transaction_id text',
    'operator_id text', 'cashier_id text', 'cancellation_reason text',
    'is_demo boolean default false', 'notes text', 'legacy_id text',
  ].join(', '),
  cashback_transactions: [
    'customer_id text', 'customer_name text', 'sale_id text', 'sale_number text',
    'amount numeric', 'type text', 'status text default \'pendente\'',
    'used_amount numeric default 0',
    'transaction_date date', 'available_date date', 'expiry_date date',
    'reference_transaction_id text', 'operator_id text', 'justification text',
    'is_demo boolean default false', 'notes text', 'legacy_id text',
  ].join(', '),
  cashback_redemptions: [
    'customer_id text', 'customer_name text', 'sale_id text', 'sale_number text',
    'amount_redeemed numeric', 'sale_total numeric', 'redemption_date date',
    'operator_id text', 'status text default \'ativo\'', 'cancellation_reason text',
    'transactions_used jsonb', 'is_demo boolean default false', 'legacy_id text',
  ].join(', '),
  cashback_settings: [
    'cashback_percentage numeric default 5', 'min_purchase_to_use numeric default 50',
    'max_cashback_payment_percentage numeric default 50', 'release_days numeric default 0',
    'balance_validity_days numeric default 365', 'is_active boolean default true',
    'program_name text default \'Vem Pra K Cashback\'', 'terms_text text',
    'privacy_text text', 'updated_by text',
    'piloto_ativo boolean default false',
    'piloto_telefones text[] default \'{}\'',
    'legacy_id text',
  ].join(', '),
  product_categories: [
    'name text', 'generates_cashback boolean default true',
    'can_use_cashback boolean default true', 'cashback_percentage_override numeric',
    'description text', 'is_active boolean default true', 'legacy_id text',
  ].join(', '),
  audit_logs: [
    'user_id text', 'user_name text', 'user_role text', 'action text',
    'entity_type text', 'entity_id text', 'description text', 'justification text',
    'before_data text', 'after_data text', 'ip_address text', 'is_demo boolean default false',
    'legacy_id text',
  ].join(', '),
  notifications: [
    'customer_id text', 'customer_name text', 'title text', 'message text',
    'type text', 'is_read boolean default false', 'sent_date timestamptz',
    'is_demo boolean default false', 'legacy_id text',
  ].join(', '),
  consent_records: [
    'customer_id text', 'customer_name text', 'consent_type text', 'accepted boolean',
    'consent_date timestamptz', 'ip_address text', 'version text', 'legacy_id text',
  ].join(', '),
  internal_accounts: [
    'username text', 'full_name text', 'email text', 'phone text', 'cpf text',
    'job_title text', 'role text default \'cashier\'', 'password_hash text',
    'password_salt text', 'status text default \'active\'', 'linked_customer_id text',
    'last_login_at timestamptz', 'failed_attempts numeric default 0',
    'locked_until timestamptz', 'notes text', 'legacy_id text',
  ].join(', '),
  staff_invitations: [
    'full_name text', 'email text', 'phone text', 'job_title text', 'role text',
    'status text default \'pending\'', 'invited_by text', 'invited_at timestamptz',
    'accepted_at timestamptz', 'legacy_id text',
  ].join(', '),
  // Tabela operacional para a futura integração n8n/Avisa: um registro por
  // cashback gerado (o mesmo cliente acumula vários registros ao longo do tempo).
  cashback_whatsapp: [
    'cliente_id text', 'nome_cliente text', 'telefone_whatsapp text',
    'cashback_comunicacao_opt_in boolean default false',
    'promocoes_opt_in boolean default false',
    'data_consentimento timestamptz', 'origem_consentimento text',
    'compra_id text', 'cashback_id_origem text',
    'valor_compra numeric(12,2)', 'valor_cashback_gerado numeric(12,2)',
    'valor_cashback_utilizado numeric(12,2) default 0', 'saldo_cashback numeric(12,2)',
    'data_geracao_cashback timestamptz', 'data_expiracao_cashback timestamptz',
    'status_cashback text default \'disponivel\'',
    'ultima_compra_em timestamptz', 'ultima_mensagem_tipo text', 'ultima_mensagem_em timestamptz',
    'proxima_acao_tipo text default \'enviar_cashback\'', 'proxima_acao_em timestamptz',
    'mensagem_inicial_enviada boolean default false', 'lembrete_7_dias_enviado boolean default false',
    'aviso_expiracao_7d_enviado boolean default false', 'aviso_expiracao_3d_enviado boolean default false',
    'aviso_expiracao_1d_enviado boolean default false',
    'opt_out_em timestamptz', 'status_telefone text default \'ativo\'',
    'ultima_tentativa_envio_em timestamptz', 'tentativas_envio integer default 0',
    'ultimo_erro_envio text',
    'criado_em timestamptz default (timezone(\'UTC\', now() AT TIME ZONE \'America/Sao_Paulo\'))', 'atualizado_em timestamptz default (timezone(\'UTC\', now() AT TIME ZONE \'America/Sao_Paulo\'))',
    'is_demo boolean default false',
  ].join(', '),
};

// Colunas adicionadas a tabelas já existentes (executa ALTER ADD COLUMN IF NOT EXISTS).
const COLUMN_MIGRATIONS = [
  'ALTER TABLE customers ADD COLUMN IF NOT EXISTS legacy_id text;',
  'ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active boolean default true;',
  'ALTER TABLE sales ADD COLUMN IF NOT EXISTS legacy_id text;',
  'ALTER TABLE cashback_transactions ADD COLUMN IF NOT EXISTS legacy_id text;',
  'ALTER TABLE cashback_transactions ADD COLUMN IF NOT EXISTS used_amount numeric default 0;',
  'ALTER TABLE cashback_redemptions ADD COLUMN IF NOT EXISTS legacy_id text;',
  'ALTER TABLE internal_accounts ADD COLUMN IF NOT EXISTS legacy_id text;',
  'ALTER TABLE cashback_settings ADD COLUMN IF NOT EXISTS legacy_id text;',
  'ALTER TABLE cashback_settings ADD COLUMN IF NOT EXISTS piloto_ativo boolean default false;',
  'ALTER TABLE cashback_settings ADD COLUMN IF NOT EXISTS piloto_telefones text[] default \'{}\';',
  'ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS legacy_id text;',
  'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS legacy_id text;',
  'ALTER TABLE staff_invitations ADD COLUMN IF NOT EXISTS legacy_id text;',
  'ALTER TABLE notifications ADD COLUMN IF NOT EXISTS legacy_id text;',
  'ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS legacy_id text;',
];

// Cria todas as tabelas (CREATE TABLE IF NOT EXISTS) e aplica migrações de coluna.
export async function ensureTables(accessToken, ref) {
  const created = [];
  for (const [name, cols] of Object.entries(TABLES)) {
    const sql = `CREATE TABLE IF NOT EXISTS ${name} (${COMMON}, ${cols});`;
    await runSql(accessToken, ref, sql);
    created.push(name);
  }
  // Consentimentos separados + tabela operacional cashback_whatsapp (n8n/Avisa).
  await ensureWhatsappSetup(accessToken, ref);
  for (const sql of COLUMN_MIGRATIONS) {
    await runSql(accessToken, ref, sql).catch(() => {});
  }
  // Trigger para atualizar updated_date automaticamente.
  for (const name of Object.keys(TABLES)) {
    const triggerName = `set_updated_date_${name}`;
    await runSql(accessToken, ref, `
      CREATE OR REPLACE FUNCTION set_updated_date() RETURNS trigger AS $$
      BEGIN NEW.updated_date = (timezone('UTC', now() AT TIME ZONE 'America/Sao_Paulo')); RETURN NEW; END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS ${triggerName} ON ${name};
      CREATE TRIGGER ${triggerName} BEFORE UPDATE ON ${name}
        FOR EACH ROW EXECUTE FUNCTION set_updated_date();
    `).catch(() => {});
  }
  return created;
}

// ===== Integração futura n8n/Avisa: consentimentos + tabela operacional =====

// Setup idempotente da preparação WhatsApp: colunas de consentimento em
// customers (com migração única do aceite antigo de promoções) e tabela
// operacional cashback_whatsapp (índices, unicidade e atualização automática).
let whatsappSetupDone = false;

export async function ensureWhatsappSetup(accessToken, ref) {
  if (whatsappSetupDone) return;
  // 1. Colunas de consentimento em customers.
  const cols = await runSql(accessToken, ref,
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name IN ('promocoes_opt_in','cashback_comunicacao_opt_in');");
  const existing = new Set((cols || []).map((r) => r.column_name));
  for (const sql of [
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS promocoes_opt_in boolean default false;',
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS cashback_comunicacao_opt_in boolean default false;',
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS data_consentimento timestamptz;',
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS origem_consentimento text;',
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS opt_out_em timestamptz;',
  ]) {
    await runSql(accessToken, ref, sql).catch(() => {});
  }
  // Migração única: quem já aceitava promoções passa a aceitar promoções E
  // mensagens de cashback (decisão do builder). Roda apenas na primeira criação
  // da coluna — nunca sobrescreve opt-ins definidos depois.
  if (!existing.has('promocoes_opt_in')) {
    await runSql(accessToken, ref,
      "UPDATE customers SET promocoes_opt_in = COALESCE(accepts_promotions, false), cashback_comunicacao_opt_in = COALESCE(accepts_promotions, false) WHERE COALESCE(accepts_promotions, false) = true;"
    ).catch(() => {});
  }
  // 2. Tabela operacional (um registro por cashback gerado).
  await runSql(accessToken, ref,
    `CREATE TABLE IF NOT EXISTS cashback_whatsapp (${COMMON}, ${TABLES.cashback_whatsapp});`);
  // 3. Proteção contra duplicidade: o mesmo cashback_id_origem nunca repete.
  await runSql(accessToken, ref,
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_cw_cashback_id_origem ON cashback_whatsapp(cashback_id_origem);').catch(() => {});
  // 4. Índices de consulta do n8n.
  for (const col of [
    'cliente_id', 'telefone_whatsapp', 'status_cashback', 'proxima_acao_tipo',
    'proxima_acao_em', 'data_expiracao_cashback', 'cashback_comunicacao_opt_in',
    'promocoes_opt_in', 'mensagem_inicial_enviada', 'lembrete_7_dias_enviado',
    'status_telefone',
  ]) {
    await runSql(accessToken, ref,
      `CREATE INDEX IF NOT EXISTS idx_cw_${col} ON cashback_whatsapp(${col});`).catch(() => {});
  }
  // 5. atualizado_em automático em toda modificação.
  await runSql(accessToken, ref, `
    CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger AS $$
    BEGIN NEW.atualizado_em = (timezone('UTC', now() AT TIME ZONE 'America/Sao_Paulo')); RETURN NEW; END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS set_atualizado_em ON cashback_whatsapp;
    CREATE TRIGGER set_atualizado_em BEFORE UPDATE ON cashback_whatsapp
      FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  `).catch(() => {});
  whatsappSetupDone = true;
}

// Lista as tabelas existentes no schema public.
export async function listTables(accessToken, ref) {
  const rows = await runSql(accessToken, ref,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;");
  return (rows || []).map((r) => r.table_name);
}

// ===== PostgREST (acesso a linhas via service_role key) =====

// Obtém e cacheia a service_role key do projeto. Tenta até 3 vezes com backoff
// para tolerar falhas transitórias da Management API sob carga rápida.
export async function getServiceRoleKey(accessToken, ref) {
  if (cachedKey && cachedKeyRef === ref) return cachedKey;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/projects/${ref}/api-keys`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Erro ao obter chave service_role (${res.status}): ${await res.text()}`);
      }
      const keys = await res.json();
      const sr = (keys || []).find((k) => k.name === 'service_role');
      if (!sr) throw new Error('Chave service_role não encontrada no projeto Supabase.');
      cachedKey = sr.api_key;
      cachedKeyRef = ref;
      return cachedKey;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function pgUrl(ref, table) {
  return `https://${ref}.supabase.co/rest/v1/${table}`;
}

function pgHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Constrói string de filtros PostgREST a partir de objeto { col: value }.
function buildFilter(filters) {
  if (!filters) return '';
  const parts = [];
  for (const [col, val] of Object.entries(filters)) {
    if (val === null || val === undefined) parts.push(`${col}=is.null`);
    else if (typeof val === 'boolean') parts.push(`${col}=eq.${val}`);
    else if (typeof val === 'number') parts.push(`${col}=eq.${val}`);
    else parts.push(`${col}=eq.${encodeURIComponent(String(val))}`);
  }
  return parts.join('&');
}

// Traduz sort do estilo Base44 ('-created_date') para PostgREST ('created_date.desc').
function translateSort(sort) {
  if (!sort) return '';
  const s = String(sort);
  if (s.startsWith('-')) return `${s.slice(1)}.desc`;
  return `${s}.asc`;
}

export async function pgList(key, ref, table, opts = {}) {
  const { select = '*', filters, sort, limit, offset } = opts;
  let qs = `select=${encodeURIComponent(select)}`;
  const f = buildFilter(filters);
  if (f) qs += `&${f}`;
  const order = translateSort(sort);
  if (order) qs += `&order=${encodeURIComponent(order)}`;
  if (limit) qs += `&limit=${limit}`;
  if (offset) qs += `&offset=${offset}`;
  const res = await fetch(`${pgUrl(ref, table)}?${qs}`, { headers: pgHeaders(key) });
  if (!res.ok) throw new Error(`pgList ${table} (${res.status}): ${await res.text()}`);
  return await res.json();
}

// Busca textual server-side (PostgREST or + ilike) em uma ou mais colunas.
// Varre TODOS os registros (independente de created_date) — ideal para achar
// clientes antigos pelo nome/telefone/CPF. extraFilters é combinado com AND.
export async function pgSearch(key, ref, table, opts = {}) {
  const { q, columns = ['name'], extraFilters, sort, limit } = opts;
  const term = String(q || '').trim();
  let qs = `select=${encodeURIComponent('*')}`;
  if (term) {
    const orParts = (columns || []).map((c) => `${c}.ilike.*${encodeURIComponent(term)}*`);
    qs += `&or=(${orParts.join(',')})`;
  }
  const f = buildFilter(extraFilters);
  if (f) qs += `&${f}`;
  const order = translateSort(sort);
  if (order) qs += `&order=${encodeURIComponent(order)}`;
  if (limit) qs += `&limit=${limit}`;
  const res = await fetch(`${pgUrl(ref, table)}?${qs}`, { headers: pgHeaders(key) });
  if (!res.ok) throw new Error(`pgSearch ${table} (${res.status}): ${await res.text()}`);
  return await res.json();
}

export async function pgGet(key, ref, table, id) {
  const rows = await pgList(key, ref, table, { filters: { id }, limit: 1 });
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function pgInsert(key, ref, table, data) {
  const res = await fetch(pgUrl(ref, table), {
    method: 'POST',
    headers: pgHeaders(key, { Prefer: 'return=representation' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`pgInsert ${table} (${res.status}): ${await res.text()}`);
  const arr = await res.json();
  return Array.isArray(arr) ? arr[0] : arr;
}

export async function pgUpdate(key, ref, table, id, data) {
  const res = await fetch(`${pgUrl(ref, table)}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: pgHeaders(key, { Prefer: 'return=representation' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`pgUpdate ${table} (${res.status}): ${await res.text()}`);
  const arr = await res.json();
  return Array.isArray(arr) ? arr[0] : arr;
}

export async function pgDelete(key, ref, table, id) {
  const res = await fetch(`${pgUrl(ref, table)}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: pgHeaders(key),
  });
  if (!res.ok) throw new Error(`pgDelete ${table} (${res.status}): ${await res.text()}`);
  return true;
}

// Formatação compartilhada de valores e datas (pt-BR).
export function formatBRL(v) {
  return "R$ " + Number(v || 0).toFixed(2).replace(".", ",");
}
export function formatDateBR(d) {
  if (!d) return "";
  try {
    const [y, m, dd] = String(d).split("T")[0].split("-");
    return `${dd}/${m}/${y}`;
  } catch {
    return String(d);
  }
}

// Cria uma notificação in-app de evento de cashback (gerado/liberado/expirado)
// para o cliente. O bot do WhatsApp apresenta os avisos não lidos quando o
// cliente abre o chat — a plataforma não expõe envio outbound proativo.
export async function insertCashbackNotification(key, ref, payload) {
  const { customer_id, customer_name, event, amount, available_date, is_demo } = payload || {};
  if (!customer_id || !event) return null;
  let name = customer_name || "";
  if (!name) {
    const c = await pgGet(key, ref, "customers", customer_id).catch(() => null);
    name = (c && c.name) || "Cliente";
  }
  const amt = Number(amount) || 0;
  let title = "", message = "", type = "";
  if (event === "gerado") {
    type = "cashback_gerado";
    title = "Você ganhou cashback! 🎉";
    message = available_date
      ? `Olá ${name}! Você ganhou ${formatBRL(amt)} de cashback. Ele libera para uso em ${formatDateBR(available_date)}. Obrigado por comprar com a gente!`
      : `Olá ${name}! Você ganhou ${formatBRL(amt)} de cashback e já está disponível para usar na sua próxima compra. Aproveite!`;
  } else if (event === "liberado") {
    type = "cashback_liberado";
    title = "Cashback liberado! ✅";
    message = `Olá ${name}! Seu cashback de ${formatBRL(amt)} agora está disponível para uso. Pode usar na sua próxima compra!`;
  } else if (event === "expirado") {
    type = "cashback_expirado";
    title = "Cashback expirado 💔";
    message = `Olá ${name}! Um cashback de ${formatBRL(amt)} expirou e não está mais disponível. Fique atento às datas de validade!`;
  } else if (event === "utilizado") {
    type = "cashback_utilizado";
    title = "Cashback utilizado 🛍️";
    message = payload.sale_number
      ? `Olá ${name}! Você utilizou ${formatBRL(amt)} de cashback na venda #${payload.sale_number}. Obrigado por participar do Vem Pra K Cashback!`
      : `Olá ${name}! Você utilizou ${formatBRL(amt)} de cashback. Obrigado por participar do Vem Pra K Cashback!`;
  } else {
    return null;
  }
  return pgInsert(key, ref, "notifications", {
    customer_id,
    customer_name: name,
    title,
    message,
    type,
    is_read: false,
    sent_date: nowBrasilia(),
    is_demo: !!is_demo,
  });
}

// Insere um registro na tabela audit_logs (autoridade do serviço, ignora RLS).
export async function insertAudit(key, ref, fields) {
  return pgInsert(key, ref, 'audit_logs', fields);
}