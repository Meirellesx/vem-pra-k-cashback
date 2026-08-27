import { createClientFromRequest } from "npm:@base44/sdk";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Senha temporária forte e aleatória (o funcionário vai substituí-la pelo link de reset).
const generateTempPassword = () => {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pwd = "";
  for (let i = 0; i < 14; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  return pwd + "!1Aa";
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

    const allowedRoles = ["admin", "manager", "cashier", "viewer"];
    const targetRole = allowedRoles.includes(role) ? role : "cashier";

    // 1. Cria a conta com uma senha temporária.
    //    Usamos register() (em vez de inviteUser) para NÃO disparar o e-mail de
    //    convite/login — queremos que o funcionário receba apenas o link de
    //    definição de senha (reset).
    let registered = false;
    try {
      await base44.auth.register({ email, password: generateTempPassword() });
      registered = true;
    } catch (e) {
      console.error("register (continuing):", e.message);
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

    // 3. Dispara o link de definição de senha — o ÚNICO e-mail que o funcionário
    //    precisa usar para criar sua senha de acesso.
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

    return Response.json({ success: true, email, userId, role: targetRole, resetSent, registered });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}