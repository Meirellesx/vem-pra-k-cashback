import { createClientFromRequest } from "npm:@base44/sdk";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { email, full_name } = await req.json();

    if (!email) {
      return Response.json({ success: true, skipped: true, reason: "no_email" });
    }

    // Em alguns fluxos (ex.: cliente) a conta é criada momentos APÓS o gatilho
    // do workflow. Aguardamos a conta existir antes de disparar o link.
    let userExists = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const found = await base44.asServiceRole.entities.User.filter({ email });
        if (found && found.length > 0) {
          userExists = true;
          break;
        }
      } catch (e) {
        /* ignore */
      }
      await sleep(1500);
    }

    if (!userExists) {
      return Response.json({ success: true, skipped: true, reason: "no_user_account" });
    }

    // Dispara o link de definição de senha — a plataforma envia um e-mail
    // com link direto para /reset-password?token=...
    await base44.auth.resetPasswordRequest(email);

    return Response.json({ success: true, email, full_name });
  } catch (error) {
    console.error("send-reset-link error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}