import { createClientFromRequest } from "npm:@base44/sdk";

const APP_URL = "https://vem-pra-k-cashback.base44.app";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "manager") {
      return Response.json({ success: false, error: "Acesso restrito a administradores e gerentes" }, { status: 403 });
    }

    const { email, name } = await req.json();
    if (!email) {
      return Response.json({ success: false, error: "E-mail é obrigatório" }, { status: 400 });
    }

    // E-mail customizado de ativação: leva o cliente direto ao cadastro, onde ele
    // cria a própria senha (com verificação por código). Não usamos inviteUser
    // porque o convite nativo diz "Entrar" e não é personalizável.
    const registerUrl = `${APP_URL}/register?email=${encodeURIComponent(email)}`;

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: "Crie sua conta no Vem Pra K Cashback",
      body: `Olá${name ? " " + name : ""},

Você foi cadastrado(a) no programa de cashback Vem Pra K! 🎉

Para ativar sua conta e acessar seu saldo de cashback, crie sua senha agora mesmo:

${registerUrl}

É rápido: informe seu e-mail, defina sua senha e confirme o código que você receberá por e-mail.

Após ativar, você acompanha seu saldo e histórico de cashback na sua área.

Bem-vindo(a)!

Equipe Vem Pra K Cashback`,
    });

    await base44.entities.AuditLog.create({
      user_id: user.id,
      user_name: user.full_name || user.email,
      user_role: user.role,
      action: "invite_customer",
      entity_type: "Customer",
      description: `Convite de criação de conta enviado para ${name || email} — ${email}`,
      is_demo: false,
    });

    return Response.json({ success: true, email });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}