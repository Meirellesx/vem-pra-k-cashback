// Consulta pública de saldo de cashback — não exige autenticação.
// Permite que um visitante veja saldos (disponível/pendente) e as regras básicas
// do programa informando CPF, código de identificação ou telefone.
// Nunca expõe e-mail, telefone, CPF ou código completo — apenas saldos e regras.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getConnection, getProjectRef, runSql } from "../../shared/supabase.ts";

const DEFAULT_SETTINGS = {
  cashback_percentage: 5,
  min_purchase_to_use: 50,
  max_cashback_payment_percentage: 50,
  release_days: 0,
  balance_validity_days: 365,
  is_active: true,
  program_name: "Vem Pra K Cashback",
};

function publicSettings(row: any) {
  if (!row) return DEFAULT_SETTINGS;
  return {
    cashback_percentage: Number(row.cashback_percentage) || 5,
    min_purchase_to_use: Number(row.min_purchase_to_use) || 50,
    max_cashback_payment_percentage: Number(row.max_cashback_payment_percentage) || 50,
    release_days: Number(row.release_days) || 0,
    balance_validity_days: Number(row.balance_validity_days) || 365,
    is_active: row.is_active !== false,
    program_name: row.program_name || "Vem Pra K Cashback",
  };
}

function maskName(name: string): string {
  if (!name) return "";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const op = body.op || "lookup";

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);
    const token = conn.accessToken;

    const settingsRows = await runSql(
      token,
      ref,
      "SELECT cashback_percentage, min_purchase_to_use, max_cashback_payment_percentage, release_days, balance_validity_days, is_active, program_name FROM cashback_settings LIMIT 1;"
    );
    const settings = publicSettings(settingsRows && settingsRows[0]);

    if (op === "settings") {
      return Response.json({ settings });
    }

    // op === 'lookup'
    const raw = String(body.query || "").trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 8 && raw.length < 3) {
      return Response.json({ found: false, settings });
    }

    let query = "SELECT id, name, available_balance, pending_balance, total_cashback_earned, total_cashback_used FROM customers WHERE (is_active IS NOT FALSE) AND (is_demo IS NOT TRUE)";
    if (digits.length >= 8) {
      const d = sqlEscape(digits);
      query += ` AND (identifier_code = '${d}' OR cpf = '${d}' OR regexp_replace(coalesce(phone,''), '\\D', '', 'g') = '${d}')`;
    } else {
      const t = sqlEscape(raw.toLowerCase());
      query += ` AND (lower(coalesce(identifier_code,'')) = '${t}')`;
    }
    query += " LIMIT 1;";

    const rows = await runSql(token, ref, query);
    if (!rows || rows.length === 0) {
      return Response.json({ found: false, settings });
    }
    const c = rows[0];
    return Response.json({
      found: true,
      name_masked: maskName(c.name),
      available_balance: Number(c.available_balance) || 0,
      pending_balance: Number(c.pending_balance) || 0,
      total_cashback_earned: Number(c.total_cashback_earned) || 0,
      total_cashback_used: Number(c.total_cashback_used) || 0,
      settings,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}