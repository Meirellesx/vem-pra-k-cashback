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

    // Convite nativo do Base44. O e-mail de convite leva o novo funcionário a
    // DEFINIR A PRÓPRIA SENHA (fluxo de registro). O registro de User verificado
    // é criado quando ele aceita o convite. Não usamos register() porque ele cria
    // o usuário NÃO verificado (e is_verified é protegido pelo sistema), o que
    // impediria o login e o disparo do link de reset.
    await base44.users.inviteUser(email, "user");

    // Aplica perfil/personalização assim que o registro aparecer (após o aceite).
    let userId = "";
    for (let attempt = 0; attempt < 8; attempt++) {
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

    await base44.entities.AuditLog.create({
      user_id: user.id,
      user_name: user.full_name || user.email,
      user_role: user.role,
      action: "create_user",
      entity_type: "User",
      entity_id: userId,
      description: `Cadastro de funcionário: ${full_name || email} (${email}) — perfil: ${targetRole}`,
      is_demo: false,
    });

    return Response.json({ success: true, email, userId, role: targetRole });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}