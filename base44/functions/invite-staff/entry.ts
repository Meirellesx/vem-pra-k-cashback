import { createClientFromRequest } from "npm:@base44/sdk";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Senha aleatória forte usada APENAS para criar a conta. Nunca é enviada ou
// exibida — o usuário define a própria senha via o link de reset.
function randomPassword(length = 24): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
  let pwd = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) pwd += chars[bytes[i] % chars.length];
  return pwd;
}

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

    // 1. Cria a conta imediatamente. Usamos register() em vez de inviteUser()
    //    porque o inviteUser() só materializa o registro de User DEPOIS que o
    //    convidado aceita o convite — sem o registro, o fluxo de reset de senha
    //    (resetPasswordRequest) não encontra o usuário e não envia o e-mail.
    try {
      await base44.auth.register({ email, password: randomPassword() });
    } catch (e) {
      // Se o e-mail já existir, register falha — localizamos o usuário abaixo.
      console.error("register (continuing):", e.message);
    }

    // 2. Localiza o usuário e define perfil, verificação e status 'pending'.
    let userId = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      const found = await base44.asServiceRole.entities.User.filter({ email });
      if (found && found.length > 0) {
        const existing = found[0];
        const updates = {
          role: targetRole,
          is_verified: true,
          full_name: full_name || "",
          phone: phone || "",
          job_title: job_title || "",
        };
        // Marca como 'pending' apenas contas novas; não rebaixa usuários já ativos.
        if (!existing.status || existing.status === "" || existing.status === "pending") {
          updates.status = "pending";
        }
        await base44.asServiceRole.entities.User.update(existing.id, updates);
        userId = existing.id;
        break;
      }
      await sleep(800);
    }

    if (!userId) {
      return Response.json({ success: false, error: "Não foi possível criar a conta do funcionário." }, { status: 500 });
    }

    // O link de definição de senha (token único e temporário para /reset-password)
    // é enviado pelo workflow "StaffResetLink" quando o convite (StaffInvitation)
    // é criado no frontend.

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