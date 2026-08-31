import { createClientFromRequest } from "npm:@base44/sdk";
import { getConnection, getProjectRef, getServiceRoleKey, insertAudit } from "../../shared/supabase.ts";

const APP_URL = "https://vem-pra-k-cashback.base44.app";

const STAFF_ROLES = ["admin", "manager", "cashier", "viewer", "operador"];

const ROLE_LABELS = {
  admin: "Administrador",
  manager: "Gerente",
  cashier: "Operador de Caixa",
  viewer: "Consultor",
  operador: "Operador",
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json({ success: false, error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const { email, full_name, phone, job_title, role } = await req.json();
    if (!email) {
      return Response.json({ success: false, error: "E-mail é obrigatório" }, { status: 400 });
    }

    const targetRole = STAFF_ROLES.includes(role) ? role : "cashier";

    // 1) Convite nativo da plataforma: é o canal garantido de entrega para um
    //    destinatário ainda NÃO cadastrado (chega mesmo sem domínio próprio).
    //    Leva ao /login, onde o botão "Criar minha conta" permite definir a senha.
    await base44.users.inviteUser(email, "user");

    // 2) Segundo e-mail customizado "Crie sua conta" com link direto ao cadastro.
    //    Chega com certeza para endereços já cadastrados; para novos destinatários
    //    pode exigir domínio próprio conectado ao app — por isso mantemos o (1).
    const registerUrl = `${APP_URL}/register?email=${encodeURIComponent(email)}`;

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: "Crie sua conta no Vem Pra K Cashback",
      body: `Olá${full_name ? " " + full_name : ""},

Você foi cadastrado(a) como funcionário(a) no sistema Vem Pra K Cashback!

Para ativar seu acesso, crie sua senha agora mesmo:

${registerUrl}

É rápido: informe seu e-mail, defina sua senha e confirme o código que você receberá por e-mail.

Após ativar, seu perfil de acesso (${ROLE_LABELS[targetRole] || targetRole}) será aplicado automaticamente e você poderá usar o sistema.

Equipe Vem Pra K Cashback`,
    });

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);
    const key = await getServiceRoleKey(conn.accessToken, ref);
    await insertAudit(key, ref, {
      user_id: user.id,
      user_name: user.full_name || user.email,
      user_role: user.role,
      action: "invite_staff",
      entity_type: "StaffInvitation",
      description: `Convite de criação de conta enviado para funcionário ${full_name || email} — ${email} (perfil: ${targetRole})`,
      is_demo: false,
    });

    return Response.json({ success: true, email, role: targetRole });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}