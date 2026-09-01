import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  getConnection, getProjectRef, getServiceRoleKey, runSql, pgInsert, insertAudit,
  insertCashbackNotification,
} from "../../shared/supabase.ts";
import { mirrorRow, patchNativeByLegacyId, mirrorCustomerFromSupabase } from "../../shared/nativeMirror.ts";

const escape = (s: unknown) => String(s ?? "").replace(/'/g, "''");

// Ciclo de vida do cashback: libera pendentes vencidos e expira disponíveis
// vencidos, debitando o saldo do cliente. Executa via workflow agendado diário.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Tarefa de manutenção agendada — restrita a administradores.
    // (Quando executada via workflow, a plataforma injeta a identidade de admin.)
    if (!user) {
      return Response.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json(
        { success: false, error: "Acesso restrito a administradores" },
        { status: 403 }
      );
    }

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);
    const mgmtToken = conn.accessToken; // token OAuth para a Management API (runSql)
    const key = await getServiceRoleKey(conn.accessToken, ref); // service_role para PostgREST

    // Garante que a coluna de consumo parcial exista (auto-migração).
    await runSql(
      mgmtToken, ref,
      "ALTER TABLE cashback_transactions ADD COLUMN IF NOT EXISTS used_amount numeric default 0;"
    ).catch(() => {});

    const today = new Date().toISOString().split("T")[0];

    // ===== (a) Liberação de cashback pendente vencido =====
    const toRelease = await runSql(
      mgmtToken, ref,
      `SELECT id, customer_id, customer_name, amount FROM cashback_transactions
       WHERE status = 'pendente' AND available_date IS NOT NULL AND available_date <= '${today}';`
    );

    let released = 0;
    for (const tx of (toRelease || [])) {
      await runSql(
        mgmtToken, ref,
        `UPDATE cashback_transactions SET status = 'disponivel' WHERE id = '${escape(tx.id)}';`
      );
      await runSql(
        mgmtToken, ref,
        `UPDATE customers
           SET available_balance = COALESCE(available_balance, 0) + ${Number(tx.amount) || 0},
               pending_balance = GREATEST(COALESCE(pending_balance, 0) - ${Number(tx.amount) || 0}, 0)
         WHERE id = '${escape(tx.customer_id)}';`
      );
      await patchNativeByLegacyId(base44, "cashback_transactions", tx.id, { status: "disponivel" });
      await mirrorCustomerFromSupabase(base44, key, ref, tx.customer_id);
      const notifRel = await insertCashbackNotification(key, ref, {
        customer_id: tx.customer_id,
        customer_name: tx.customer_name || "",
        event: "liberado",
        amount: Number(tx.amount) || 0,
      }).catch(() => null);
      if (notifRel) await mirrorRow(base44, "notifications", notifRel);
      released++;
    }

    // ===== (b) Expiração de cashback disponível vencido =====
    const toExpire = await runSql(
      mgmtToken, ref,
      `SELECT id, customer_id, customer_name, amount, COALESCE(used_amount, 0) AS used_amount
       FROM cashback_transactions
       WHERE status = 'disponivel' AND expiry_date IS NOT NULL AND expiry_date < '${today}';`
    );

    let expired = 0;
    let expiredTotal = 0;
    for (const tx of (toExpire || [])) {
      const remaining = (Number(tx.amount) || 0) - (Number(tx.used_amount) || 0);
      await runSql(
        mgmtToken, ref,
        `UPDATE cashback_transactions SET status = 'expirado' WHERE id = '${escape(tx.id)}';`
      );
      await patchNativeByLegacyId(base44, "cashback_transactions", tx.id, { status: "expirado" });
      if (remaining > 0) {
        await runSql(
          mgmtToken, ref,
          `UPDATE customers
             SET available_balance = GREATEST(COALESCE(available_balance, 0) - ${remaining}, 0)
           WHERE id = '${escape(tx.customer_id)}';`
        );
        await mirrorCustomerFromSupabase(base44, key, ref, tx.customer_id);
        // Transação de rastreabilidade da expiração.
        const expTx = await pgInsert(key, ref, "cashback_transactions", {
          customer_id: tx.customer_id,
          customer_name: tx.customer_name || "",
          amount: -remaining,
          type: "expirado",
          status: "expirado",
          transaction_date: today,
          reference_transaction_id: tx.id,
          is_demo: false,
          notes: "Expiração automática (workflow agendado)",
          created_by_id: user.id,
        });
        await mirrorRow(base44, "cashback_transactions", expTx);
        const notifExp = await insertCashbackNotification(key, ref, {
          customer_id: tx.customer_id,
          customer_name: tx.customer_name || "",
          event: "expirado",
          amount: remaining,
        }).catch(() => null);
        if (notifExp) await mirrorRow(base44, "notifications", notifExp);
        expiredTotal += remaining;
      }
      expired++;
    }

    // ===== Auditoria =====
    if (released > 0 || expired > 0) {
      const audit = await insertAudit(key, ref, {
        user_id: user.id,
        user_name: user.full_name || user.email || "Sistema",
        user_role: user.role,
        action: "cashback_lifecycle",
        entity_type: "CashbackTransaction",
        entity_id: "",
        description:
          `Ciclo de vida do cashback: ${released} liberação(ões), ${expired} expiração(ões) — R$ ${expiredTotal.toFixed(2)}.`,
        is_demo: false,
      });
      await mirrorRow(base44, "audit_logs", audit);
    }

    return Response.json({ success: true, released, expired, expiredTotal, date: today });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}