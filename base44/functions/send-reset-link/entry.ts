import { createClientFromRequest } from "npm:@base44/sdk";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { email, full_name } = await req.json();

    if (!email) {
      return Response.json({ success: false, error: "E-mail é obrigatório" }, { status: 400 });
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