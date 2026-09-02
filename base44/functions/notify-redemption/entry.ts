import { createClientFromRequest } from "npm:@base44/sdk";
import { getConnection, getProjectRef, getServiceRoleKey, pgGet, insertAudit, insertCashbackNotification } from "../../shared/supabase.ts";
import { mirrorRow } from "../../shared/nativeMirror.ts";
import { applyWhatsappRedemption } from "../../shared/cashbackWhatsapp.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    // Apenas perfis operacionais/administrativos podem disparar notificações de resgate.
    const allowedRoles = ["admin", "manager", "cashier", "operador"];
    if (!allowedRoles.includes(user.role)) {
      return Response.json({ success: false, error: "Acesso restrito a operadores e administradores" }, { status: 403 });
    }

    const { customer_id, customer_name, amount, sale_number, sale_total, new_balance, consumed_transactions } = await req.json();

    if (!customer_id) {
      return Response.json({ success: false, error: "customer_id é obrigatório" }, { status: 400 });
    }

    // Busca o cliente para obter o e-mail
    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);
    const key = await getServiceRoleKey(conn.accessToken, ref);
    // Espelha o resgate na tabela operacional cashback_whatsapp (futura integração
    // n8n/Avisa): consumo, saldo e status por transação de origem. Nenhum envio aqui.
    let whatsappUpdated = 0;
    try {
      whatsappUpdated = await applyWhatsappRedemption(conn.accessToken, ref, consumed_transactions);
    } catch (e) {
      console.error("cashback_whatsapp update error:", e.message);
    }

    const customer = await pgGet(key, ref, "customers", customer_id);
    // Cria a notificação in-app de cashback utilizado (o bot apresenta ao cliente).
    const notif = await insertCashbackNotification(key, ref, {
      customer_id,
      customer_name: customer_name || (customer && customer.name) || "",
      event: "utilizado",
      amount: Number(amount) || 0,
      sale_number: sale_number || "",
    }).catch(() => null);
    if (notif) await mirrorRow(base44, "notifications", notif);
    let email = customer?.email;

    // Se o cliente não tem e-mail próprio, busca o usuário que o criou.
    // Só usa esse e-mail se o criador for o próprio cliente (auto-cadastro com role 'cliente'/'user'),
    // nunca se for um funcionário (admin/manager/cashier/viewer).
    if (!email && customer?.created_by_id) {
      const creator = await base44.asServiceRole.entities.User.get(customer.created_by_id);
      if (creator && (creator.role === "cliente" || creator.role === "user")) {
        email = creator.email;
      }
    }

    if (!email) {
      return Response.json({ success: false, error: "Cliente sem e-mail cadastrado" }, { status: 400 });
    }

    const formatBRL = (v: number) =>
      "R$ " + Number(v).toFixed(2).replace(".", ",");

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: `Cashback utilizado — ${formatBRL(amount)}`,
      body: `Olá ${customer_name},

Você utilizou ${formatBRL(amount)} de cashback na venda #${sale_number}.
Valor da compra: ${formatBRL(sale_total)}.

Novo saldo disponível: ${formatBRL(new_balance)}.

Obrigado por participar do Vem Pra K Cashback!`,
    });

    // Registra no log de auditoria (Supabase)
    const audit = await insertAudit(key, ref, {
      user_id: user.id,
      user_name: user.full_name || user.email,
      user_role: user.role,
      action: "notify_redemption_email",
      entity_type: "CashbackRedemption",
      description: `E-mail de resgate enviado para ${customer_name} — ${email}`,
      is_demo: false,
    });
    await mirrorRow(base44, "audit_logs", audit);

    return Response.json({ success: true, email, whatsapp_updated: whatsappUpdated });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}