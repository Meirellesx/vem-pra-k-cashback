import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  getConnection, getProjectRef, getServiceRoleKey, pgGet, pgInsert, runSql, insertAudit,
} from "../../shared/supabase.ts";

// Quantos dias antes do vencimento disparar o aviso.
const ALERT_DAYS = 7;

const formatBRL = (v: number) => "R$ " + Number(v || 0).toFixed(2).replace(".", ",");
const formatDate = (d: string) => {
  if (!d) return "";
  try {
    const [y, m, dd] = String(d).split("T")[0].split("-");
    return `${dd}/${m}/${y}`;
  } catch {
    return String(d);
  }
};

// Varre diariamente as transações de cashback disponíveis que vencem nos próximos
// ALERT_DAYS dias e cria uma notificação de aviso para o cliente (uma vez por transação).
// Disparado pelo workflow "Cashback Expiry Alert".
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    if (!["admin", "manager"].includes(user.role)) {
      return Response.json({ success: false, error: "Acesso restrito" }, { status: 403 });
    }

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);
    const mgmtToken = conn.accessToken;
    const key = await getServiceRoleKey(conn.accessToken, ref);

    // Garante a coluna de controle de aviso já enviado.
    await runSql(
      mgmtToken, ref,
      "ALTER TABLE cashback_transactions ADD COLUMN IF NOT EXISTS expiry_alerted boolean default false;"
    ).catch(() => {});

    const today = new Date().toISOString().split("T")[0];
    const horizonDate = new Date();
    horizonDate.setDate(horizonDate.getDate() + ALERT_DAYS);
    const horizon = horizonDate.toISOString().split("T")[0];

    const rows = await runSql(
      mgmtToken, ref,
      `SELECT id, customer_id, customer_name, amount, COALESCE(used_amount, 0) AS used_amount, expiry_date
       FROM cashback_transactions
       WHERE status = 'disponivel'
         AND expiry_date IS NOT NULL
         AND expiry_date >= '${today}'
         AND expiry_date <= '${horizon}'
         AND COALESCE(expiry_alerted, false) = false;`
    );

    let alerted = 0;
    for (const tx of (rows || [])) {
      const remaining = (Number(tx.amount) || 0) - (Number(tx.used_amount) || 0);
      if (remaining <= 0) {
        // Saldo já consumido — marca como alertado para não processar de novo.
        await runSql(mgmtToken, ref, `UPDATE cashback_transactions SET expiry_alerted = true WHERE id = '${tx.id}';`);
        continue;
      }
      let name = tx.customer_name || "";
      if (!name) {
        const c = await pgGet(key, ref, "customers", tx.customer_id).catch(() => null);
        name = c?.name || "Cliente";
      }
      await pgInsert(key, ref, "notifications", {
        customer_id: tx.customer_id,
        customer_name: name,
        title: "Seu cashback está prestes a vencer ⏰",
        message: `Olá ${name}! Você tem ${formatBRL(remaining)} de cashback que vence em ${formatDate(tx.expiry_date)}. Use na sua próxima compra antes que ele expire!`,
        type: "sistema",
        is_read: false,
        sent_date: new Date().toISOString(),
        is_demo: false,
      });
      await runSql(mgmtToken, ref, `UPDATE cashback_transactions SET expiry_alerted = true WHERE id = '${tx.id}';`);
      alerted++;
    }

    if (alerted > 0) {
      await insertAudit(key, ref, {
        user_id: user.id,
        user_name: user.full_name || user.email || "Sistema",
        user_role: user.role,
        action: "cashback_expiry_alert",
        entity_type: "CashbackTransaction",
        entity_id: "",
        description: `Avisos de vencimento enviados: ${alerted} transação(ões) com vencimento até ${formatDate(horizon)}.`,
        is_demo: false,
      }).catch(() => {});
    }

    return Response.json({ success: true, alerted, horizon: formatDate(horizon), date: today });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}