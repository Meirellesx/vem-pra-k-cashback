import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { verifyPassword } from "../../shared/passwordUtils.ts";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Requer uma sessão Base44 ativa no aparelho (a conta mestra logada).
    const base44User = await base44.auth.me().catch(() => null);
    if (!base44User) {
      return Response.json(
        { success: false, error: "Sessão externa expirada. Recarregue o aplicativo." },
        { status: 401 }
      );
    }

    const { username, password } = await req.json();
    if (!username || !password) {
      return Response.json(
        { success: false, error: "Informe usuário e senha." },
        { status: 400 }
      );
    }

    const needle = String(username).toLowerCase().trim();
    const byUsername = await base44.entities.InternalAccount.filter({ username: needle });
    const byEmail = await base44.entities.InternalAccount.filter({ email: needle });
    const account =
      (byUsername && byUsername[0]) || (byEmail && byEmail[0]) || null;

    if (!account) {
      return Response.json(
        { success: false, error: "Usuário ou senha inválidos." },
        { status: 401 }
      );
    }

    if (account.locked_until) {
      const lockUntil = new Date(account.locked_until).getTime();
      if (Date.now() < lockUntil) {
        const mins = Math.ceil((lockUntil - Date.now()) / 60000);
        return Response.json(
          {
            success: false,
            error: `Muitas tentativas inválidas. Tente novamente em ${mins} min.`,
          },
          { status: 403 }
        );
      }
    }

    if (account.status === "blocked") {
      return Response.json(
        { success: false, error: "Conta bloqueada pelo administrador." },
        { status: 403 }
      );
    }

    const ok = await verifyPassword(
      password,
      account.password_hash,
      account.password_salt
    );
    if (!ok) {
      const attempts = (account.failed_attempts || 0) + 1;
      const updates: Record<string, unknown> = { failed_attempts: attempts };
      if (attempts >= MAX_ATTEMPTS) {
        updates.locked_until = new Date(
          Date.now() + LOCK_MINUTES * 60000
        ).toISOString();
        updates.failed_attempts = 0;
      }
      await base44.entities.InternalAccount.update(account.id, updates);
      return Response.json(
        { success: false, error: "Usuário ou senha inválidos." },
        { status: 401 }
      );
    }

    await base44.entities.InternalAccount.update(account.id, {
      failed_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      operator: {
        id: account.id,
        username: account.username,
        full_name: account.full_name,
        email: account.email,
        cpf: account.cpf || "",
        role: account.role,
        linked_customer_id: account.linked_customer_id || "",
      },
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}