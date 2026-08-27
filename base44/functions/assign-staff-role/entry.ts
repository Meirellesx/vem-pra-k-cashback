import { createClientFromRequest } from "npm:@base44/sdk";

const STAFF_ROLES = ["admin", "manager", "cashier", "viewer", "operador"];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const email = (body.email || "").toString().toLowerCase().trim();
    const userId = body.user_id;

    if (!email || !userId) {
      return Response.json({ assigned: false, reason: "missing email/user_id" });
    }

    // Procura um convite pendente de funcionário para este e-mail.
    // (Clientes que se cadastram não têm StaffInvitation → nada a fazer.)
    const invitations = await base44.asServiceRole.entities.StaffInvitation.filter({ email, status: "pending" });
    if (!invitations || invitations.length === 0) {
      return Response.json({ assigned: false, reason: "no pending staff invitation" });
    }

    const invitation = invitations[0];
    const targetRole = STAFF_ROLES.includes(invitation.role) ? invitation.role : "cashier";

    // Aplica o perfil no usuário recém-cadastrado e marca o convite como aceito.
    await base44.asServiceRole.entities.User.update(userId, { role: targetRole });
    await base44.asServiceRole.entities.StaffInvitation.update(invitation.id, {
      status: "accepted",
      accepted_at: new Date().toISOString(),
    });

    await base44.asServiceRole.entities.AuditLog.create({
      user_id: userId,
      user_name: invitation.full_name || email,
      user_role: targetRole,
      action: "assign_staff_role",
      entity_type: "User",
      entity_id: userId,
      description: `Perfil atribuído automaticamente no cadastro: ${invitation.full_name || email} → ${targetRole}`,
      is_demo: false,
    });

    return Response.json({ assigned: true, role: targetRole });
  } catch (error) {
    return Response.json({ assigned: false, error: error.message });
  }
}