import { createClientFromRequest } from "npm:@base44/sdk";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    // Apenas administradores podem cadastrar funcionários.
    if (user.role !== "admin") {
      return Response.json({ success: false, error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const { email, full_name, phone, job_title, role } = await req.json();

    if (!email) {
      return Response.json({ success: false, error: "E-mail é obrigatório" }, { status: 400 });
    }

    const allowedRoles = ["admin", "manager", "cashier", "viewer"];
    const targetRole = allowedRoles.includes(role) ? role : "cashier";

    // 1. Cria a conta do usuário via convite (a plataforma exige role 'user').
    await base44.users.inviteUser(email, "user");

    // 2. Ajusta o perfil real usando service role (acesso de admin) e persiste metadados.
    const found = await base44.asServiceRole.entities.User.filter({ email });
    let userId = "";
    if (found.length > 0) {
      userId = found[0].id;
      await base44.asServiceRole.entities.User.update(userId, {
        role: targetRole,
        full_name: full_name || "",
        phone: phone || "",
        job_title: job_title || "",
        status: "pending",
      });
    }

    // 3. Dispara o link de definição de senha — este e-mail leva o funcionário
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
      action: "create_user",
      entity_type: "User",
      entity_id: userId,
      description: `Cadastro de funcionário: ${full_name || email} (${email}) — perfil: ${targetRole} (link de definição de senha enviado)`,
      is_demo: false,
    });

    return Response.json({ success: true, email, userId, role: targetRole });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}