import { createClientFromRequest } from "npm:@base44/sdk";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    // Apenas administradores e gerentes podem convidar clientes e ajustar perfis.
    if (user.role !== "admin" && user.role !== "manager") {
      return Response.json({ success: false, error: "Acesso restrito a administradores e gerentes" }, { status: 403 });
    }

    const { email, name } = await req.json();

    if (!email) {
      return Response.json({ success: false, error: "E-mail é obrigatório" }, { status: 400 });
    }

    // 1. Cria a conta do usuário via convite (a plataforma exige role 'user').
    await base44.users.inviteUser(email, "user");

    // 2. Ajusta o perfil para 'cliente' usando service role (acesso de admin).
    const found = await base44.asServiceRole.entities.User.filter({ email });
    if (found.length > 0) {
      await base44.asServiceRole.entities.User.update(found[0].id, { role: "cliente" });
    }

    // 3. Dispara o link de definição de senha — este e-mail leva o cliente
    //    direto à tela de criar senha (/reset-password?token=...), finalizando o cadastro.
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch (resetErr) {
      console.error("resetPasswordRequest error:", resetErr);
    }

    // Registra a ação no log de auditoria
    await base44.entities.AuditLog.create({
      user_id: user.id,
      user_name: user.full_name || user.email,
      user_role: user.role,
      action: "invite_customer",
      entity_type: "Customer",
      description: `Convite de acesso enviado para ${name || email} — ${email} (link de definição de senha enviado)`,
      is_demo: false,
    });

    return Response.json({ success: true, email });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}