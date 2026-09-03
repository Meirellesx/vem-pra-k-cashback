import { createClientFromRequest } from "npm:@base44/sdk";
import { getConnection, getProjectRef, getServiceRoleKey, pgList, pgUpdate, insertAudit, nowBrasilia } from "../../shared/supabase.ts";
import { mirrorRow } from "../../shared/nativeMirror.ts";

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

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);
    const key = await getServiceRoleKey(conn.accessToken, ref);

    // Procura um convite pendente de funcionário no Supabase.
    const invitations = await pgList(key, ref, "staff_invitations", {
      filters: { email, status: "pending" },
      limit: 5,
    });
    if (!invitations || invitations.length === 0) {
      return Response.json({ assigned: false, reason: "no pending staff invitation" });
    }

    const invitation = invitations[0];
    const targetRole = STAFF_ROLES.includes(invitation.role) ? invitation.role : "cashier";

    // Aplica o perfil no usuário recém-cadastrado (Base44) e marca o convite como aceito (Supabase).
    await base44.asServiceRole.entities.User.update(userId, { role: targetRole });
    const invUpd = await pgUpdate(key, ref, "staff_invitations", invitation.id, {
      status: "accepted",
      accepted_at: nowBrasilia(),
    });
    await mirrorRow(base44, "staff_invitations", invUpd);

    const audit = await insertAudit(key, ref, {
      user_id: userId,
      user_name: invitation.full_name || email,
      user_role: targetRole,
      action: "assign_staff_role",
      entity_type: "User",
      entity_id: userId,
      description: `Perfil atribuído automaticamente no cadastro: ${invitation.full_name || email} → ${targetRole}`,
      is_demo: false,
    });
    await mirrorRow(base44, "audit_logs", audit);

    return Response.json({ assigned: true, role: targetRole });
  } catch (error) {
    return Response.json({ assigned: false, error: error.message });
  }
}