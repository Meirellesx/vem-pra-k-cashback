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
    try {
      await base44.users.inviteUser(email, "user");
    } catch (e) {
      console.error("inviteUser (continuing):", e.message);
    }

    // 2. Ajusta o perfil para 'cliente' e, se for um usuário novo, marca como
    //    'pending' (aguardando ativação). Usuários já ativos não são rebaixados.
    const found = await base44.asServiceRole.entities.User.filter({ email });
    if (found.length > 0) {
      const existing = found[0];
      const updates = { role: "cliente" };
      if (!existing.status || existing.status === "" || existing.status === "pending") {
        updates.status = "pending";
      }
      await base44.asServiceRole.entities.User.update(existing.id, updates);
    }

    // O link de definição de senha é enviado pelo workflow "CustomerResetLink",
    // que dispara quando o cliente é criado (ou tem o e-mail alterado) e chama
    // o fluxo oficial de redefinição do Base44 (link único, temporário, com token,
    // apontando para /reset-password).

    await base44.entities.AuditLog.create({
      user_id: user.id,
      user_name: user.full_name || user.email,
      user_role: user.role,
      action: "invite_customer",
      entity_type: "Customer",
      description: `Convite de acesso enviado para ${name || email} — ${email}`,
      is_demo: false,
    });

    return Response.json({ success: true, email });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}