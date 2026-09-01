import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  getConnection, getProjectRef, getServiceRoleKey, pgGet, pgInsert, insertAudit,
} from "../../shared/supabase.ts";

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

// Cria uma notificação in-app para o cliente quando o cashback dele muda de estado
// (gerado, liberado, expirado ou utilizado). Disparado pelo workflow "Cashback Notify".
// Observação: o envio outbound para WhatsApp não é exposto pela plataforma — a
// notificação fica registrada no app e o bot a apresenta quando o cliente abre o chat.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    // Quando executada via workflow, a plataforma injeta identidade de admin.
    if (!["admin", "manager"].includes(user.role)) {
      return Response.json({ success: false, error: "Acesso restrito" }, { status: 403 });
    }

    const body = await req.json();
    const {
      transaction_id, event_type, type, status, old_status,
      customer_id, customer_name, amount, available_date, expiry_date,
    } = body || {};

    if (!customer_id) {
      return Response.json({ success: false, error: "customer_id é obrigatório" });
    }

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);
    const key = await getServiceRoleKey(conn.accessToken, ref);

    let name = customer_name || "";
    if (!name) {
      const c = await pgGet(key, ref, "customers", customer_id).catch(() => null);
      name = c?.name || "Cliente";
    }
    const amt = Number(amount) || 0;

    let notifType: string | null = null;
    let title = "";
    let message = "";

    if (event_type === "create") {
      if (type === "expirado" || status === "expirado") {
        notifType = "cashback_expirado";
        title = "Cashback expirado 💔";
        message = `Olá ${name}! Um cashback de ${formatBRL(amt)} expirou e não está mais disponível para uso. Fique de olho na validade para não perder!${expiry_date ? ` (válido até ${formatDate(expiry_date)})` : ""}`;
      } else if (type === "utilizado" || status === "usado") {
        notifType = "cashback_utilizado";
        title = "Cashback utilizado 🛍️";
        message = `Olá ${name}! Você utilizou ${formatBRL(amt)} de cashback na sua compra. Obrigado por participar do Vem Pra K Cashback!`;
      } else if (type === "gerado") {
        notifType = "cashback_gerado";
        title = "Você ganhou cashback! 🎉";
        if (status === "disponivel") {
          message = `Olá ${name}! Você ganhou ${formatBRL(amt)} de cashback e já está disponível para usar na sua próxima compra. Aproveite!`;
        } else {
          const lib = available_date
            ? ` Ele libera para uso em ${formatDate(available_date)}.`
            : "";
          message = `Olá ${name}! Você ganhou ${formatBRL(amt)} de cashback.${lib} Obrigado por comprar com a gente!`;
        }
      }
    } else if (event_type === "update") {
      if (status === "disponivel" && old_status === "pendente") {
        notifType = "cashback_liberado";
        title = "Cashback liberado! ✅";
        message = `Olá ${name}! Seu cashback de ${formatBRL(amt)} agora está disponível para uso. Pode usar na sua próxima compra!`;
      } else if (status === "expirado" && old_status !== "expirado") {
        notifType = "cashback_expirado";
        title = "Cashback expirado 💔";
        message = `Olá ${name}! Um cashback de ${formatBRL(amt)} expirou e não está mais disponível. Fique atento às datas de validade!`;
      } else if (status === "usado" && old_status !== "usado") {
        notifType = "cashback_utilizado";
        title = "Cashback utilizado 🛍️";
        message = `Olá ${name}! Você utilizou ${formatBRL(amt)} de cashback. Obrigado por participar!`;
      }
    }

    if (!notifType) {
      return Response.json({ success: true, skipped: true, reason: "no relevant change" });
    }

    const notif = await pgInsert(key, ref, "notifications", {
      customer_id,
      customer_name: name,
      title,
      message,
      type: notifType,
      is_read: false,
      sent_date: new Date().toISOString(),
      is_demo: false,
    });

    await insertAudit(key, ref, {
      user_id: user.id,
      user_name: user.full_name || user.email || "Sistema",
      user_role: user.role,
      action: "cashback_notify",
      entity_type: "CashbackTransaction",
      entity_id: transaction_id || "",
      description: `Notificação "${notifType}" criada para ${name} — ${formatBRL(amt)}.`,
      is_demo: false,
    }).catch(() => {});

    return Response.json({ success: true, notification_id: notif?.id, type: notifType });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}