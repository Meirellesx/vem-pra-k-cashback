import { createClientFromRequest } from "npm:@base44/sdk";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

    const allowedRoles = ["admin", "manager", "cashier", "viewer"];
    const targetRole = allowedRoles.includes(role) ? role : "cashier";

    // 1. Cria a conta do funcionário via convite (a plataforma exige role 'user').
    try {
      await base44.users.inviteUser(email, "user");
    } catch (e) {
      console.error("inviteUser (continuing):", e.message);
    }

    // 2. Aguarda a conta ficar disponível e aplica perfil + metadados.
    let userId = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const found = await base44.asServiceRole.entities.User.filter({ email });
      if (found && found.length > 0) {
        userId = found[0].id;
        await base44.asServiceRole.entities.User.update(userId, {
          role: targetRole,
          full_name: full_name || "",
          phone: phone || "",
          job_title: job_title || "",
          status: "pending",
        });
        break;
      }
      await sleep(800);
    }

    // 3. Dispara o link de definição de senha — este e-mail leva o funcionário
    //    direto à tela de criar senha (/reset-password?token=...), finalizando o cadastro.
    let resetSent = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await base44.auth.resetPasswordRequest(email);
        resetSent = true;
        break;
      } catch (resetErr) {
        console.error("resetPasswordRequest error:", resetErr);
        await sleep(1000);
      }
    }

    await base44.entities.AuditLog.create({
      user_id: user.id,
      user_name: user.full_name || user.email,
      user_role: user.role,
      action: "create_user",
      entity_type: "User",
      entity_id: userId,
      description: `Cadastro de funcionário: ${full_name || email} (${email}) — perfil: ${targetRole} (link de definição de senha enviado: ${resetSent ? "sim" : "não"})`,
      is_demo: false,
    });

    return Response.json({ success: true, email, userId, role: targetRole, resetSent });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}