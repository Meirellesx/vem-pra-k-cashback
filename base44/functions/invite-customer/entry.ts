import { createClientFromRequest } from "npm:@base44/sdk";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

    // Convite nativo: o e-mail leva o cliente a definir a própria senha (fluxo
    // de registro). O registro de User verificado é criado no aceite do convite.
    await base44.users.inviteUser(email, "user");

    const found = await base44.asServiceRole.entities.User.filter({ email });
    if (found.length > 0) {
      const existing = found[0];
      const updates = { role: "cliente" };
      if (!existing.status || existing.status === "" || existing.status === "pending") {
        updates.status = "pending";
      }
      await base44.asServiceRole.entities.User.update(existing.id, updates);
    }

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