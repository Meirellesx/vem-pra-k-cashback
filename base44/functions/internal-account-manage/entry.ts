import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { hashPassword } from "../../shared/passwordUtils.ts";
import { getConnection, getProjectRef, getServiceRoleKey, pgList, pgInsert, pgUpdate, pgGet, insertAudit } from "../../shared/supabase.ts";

const STAFF_ROLES = ["admin", "manager", "cashier", "viewer", "operador"];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  cashier: "Operador de Caixa",
  viewer: "Consulta",
  operador: "Operador",
};

function cpfToCode(cpf: string): string {
  return (cpf || "").replace(/\D/g, "");
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json(
        { success: false, error: "Acesso restrito a administradores" },
        { status: 403 }
      );
    }

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);
    const key = await getServiceRoleKey(conn.accessToken, ref);

    const body = await req.json();
    const action = body.action;
    const actor = {
      id: body.actor_id || user.id,
      name: body.actor_name || user.full_name || user.email,
      role: user.role,
    };

    const audit = (
      aAction: string,
      entityId: string,
      description: string,
      justification?: string
    ) =>
      insertAudit(key, ref, {
        user_id: actor.id,
        user_name: actor.name,
        user_role: actor.role,
        action: aAction,
        entity_type: "InternalAccount",
        entity_id: entityId || "",
        description,
        justification: justification || "",
        is_demo: false,
      });

    if (action === "create") {
      const { full_name, email, phone, cpf, job_title, role, password } = body;
      if (!full_name || !email || !password || !role) {
        return Response.json(
          { success: false, error: "Nome, e-mail, senha e perfil são obrigatórios." },
          { status: 400 }
        );
      }
      if (!STAFF_ROLES.includes(role)) {
        return Response.json({ success: false, error: "Perfil inválido." }, { status: 400 });
      }
      const username = String(email).toLowerCase().trim();

      const existing = await pgList(key, ref, "internal_accounts", { filters: { username }, limit: 1 });
      if (existing && existing.length > 0) {
        return Response.json(
          { success: false, error: "Já existe um login interno com este e-mail." },
          { status: 400 }
        );
      }

      const { hash, salt } = await hashPassword(password);

      // Vincula/cria o perfil de Cliente de cashback do funcionário no Supabase (bloqueio de autocompra).
      let customer: any = null;
      const byCpf = cpf ? await pgList(key, ref, "customers", { filters: { cpf }, limit: 1 }) : [];
      const byEmail = await pgList(key, ref, "customers", { filters: { email: username }, limit: 1 });
      customer = (byCpf && byCpf[0]) || (byEmail && byEmail[0]) || null;
      if (!customer) {
        customer = await pgInsert(key, ref, "customers", {
          name: full_name,
          phone: phone || "",
          email: username,
          cpf: cpf || "",
          identifier_code: cpfToCode(cpf),
          available_balance: 0,
          pending_balance: 0,
          total_cashback_earned: 0,
          total_cashback_used: 0,
          is_demo: false,
          is_active: true,
          notes: "Cliente criado automaticamente no cadastro de funcionário (login interno).",
          created_by_id: user.id,
        });
      } else if (!customer.cpf && cpf) {
        await pgUpdate(key, ref, "customers", customer.id, { cpf, identifier_code: cpfToCode(cpf) }).catch(() => {});
      }

      const account = await pgInsert(key, ref, "internal_accounts", {
        username,
        full_name,
        email: username,
        phone: phone || "",
        cpf: cpf || "",
        job_title: job_title || "",
        role,
        password_hash: hash,
        password_salt: salt,
        status: "active",
        linked_customer_id: customer.id,
        failed_attempts: 0,
        created_by_id: user.id,
      });

      await audit(
        "create_internal_account",
        account.id,
        `Login interno criado: ${full_name} (${username}) — perfil: ${roleLabel(role)}`
      );

      return Response.json({ success: true, id: account.id });
    }

    if (action === "update") {
      const { id, full_name, phone, job_title } = body;
      if (!id) return Response.json({ success: false, error: "ID obrigatório." }, { status: 400 });
      const before = await pgGet(key, ref, "internal_accounts", id);
      const updates: Record<string, unknown> = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (phone !== undefined) updates.phone = phone || "";
      if (job_title !== undefined) updates.job_title = job_title || "";
      if (full_name && before.linked_customer_id) {
        await pgUpdate(key, ref, "customers", before.linked_customer_id, { name: full_name }).catch(() => {});
      }
      await pgUpdate(key, ref, "internal_accounts", id, updates);
      await audit(
        "update_internal_account",
        id,
        `Login interno atualizado: ${before.full_name || before.username}`
      );
      return Response.json({ success: true, id });
    }

    if (action === "resetPassword") {
      const { id, newPassword } = body;
      if (!id || !newPassword) {
        return Response.json(
          { success: false, error: "ID e nova senha são obrigatórios." },
          { status: 400 }
        );
      }
      const before = await pgGet(key, ref, "internal_accounts", id);
      const { hash, salt } = await hashPassword(newPassword);
      await pgUpdate(key, ref, "internal_accounts", id, {
        password_hash: hash,
        password_salt: salt,
        failed_attempts: 0,
        locked_until: null,
      });
      await audit(
        "reset_internal_password",
        id,
        `Senha redefinida do login interno: ${before.full_name || before.username}`
      );
      return Response.json({ success: true });
    }

    if (action === "block") {
      const { id, justification } = body;
      if (!id) return Response.json({ success: false, error: "ID obrigatório." }, { status: 400 });
      if (!justification || !String(justification).trim()) {
        return Response.json(
          { success: false, error: "Justificativa é obrigatória." },
          { status: 400 }
        );
      }
      const before = await pgGet(key, ref, "internal_accounts", id);
      await pgUpdate(key, ref, "internal_accounts", id, { status: "blocked" });
      await audit(
        "block_internal_account",
        id,
        `Login interno bloqueado: ${before.full_name || before.username}`,
        justification
      );
      return Response.json({ success: true });
    }

    if (action === "reactivate") {
      const { id } = body;
      if (!id) return Response.json({ success: false, error: "ID obrigatório." }, { status: 400 });
      const before = await pgGet(key, ref, "internal_accounts", id);
      await pgUpdate(key, ref, "internal_accounts", id, {
        status: "active",
        failed_attempts: 0,
        locked_until: null,
      });
      await audit(
        "reactivate_internal_account",
        id,
        `Login interno reativado: ${before.full_name || before.username}`
      );
      return Response.json({ success: true });
    }

    if (action === "changeRole") {
      const { id, role, justification } = body;
      if (!id || !role) {
        return Response.json({ success: false, error: "ID e perfil são obrigatórios." }, { status: 400 });
      }
      if (!STAFF_ROLES.includes(role)) {
        return Response.json({ success: false, error: "Perfil inválido." }, { status: 400 });
      }
      if (!justification || !String(justification).trim()) {
        return Response.json(
          { success: false, error: "Justificativa é obrigatória." },
          { status: 400 }
        );
      }
      const before = await pgGet(key, ref, "internal_accounts", id);
      await pgUpdate(key, ref, "internal_accounts", id, { role });
      await audit(
        "change_internal_role",
        id,
        `Perfil de ${before.full_name || before.username}: ${roleLabel(before.role)} → ${roleLabel(role)}`,
        justification
      );
      return Response.json({ success: true });
    }

    return Response.json({ success: false, error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}