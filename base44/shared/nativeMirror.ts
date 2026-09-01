// Espelha gravações do Supabase para as entidades nativas do Base44, mantendo
// o nativo como redundância/backup. O Supabase continua sendo a fonte da verdade;
// estas funções são best-effort (falhas não quebram a gravação principal).
// Cada registro nativo guarda o id do Supabase em `legacy_id` para permitir updates.

import { pgGet } from "./supabase.ts";

const TABLE_TO_ENTITY: Record<string, string> = {
  customers: "Customer",
  sales: "Sale",
  cashback_transactions: "CashbackTransaction",
  cashback_redemptions: "CashbackRedemption",
  cashback_settings: "CashbackSettings",
  product_categories: "ProductCategory",
  audit_logs: "AuditLog",
  notifications: "Notification",
  consent_records: "ConsentRecord",
  internal_accounts: "InternalAccount",
  staff_invitations: "StaffInvitation",
};

const SKIP = new Set(["id", "created_date", "updated_date", "created_by_id", "legacy_id"]);

function toPayload(row: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (SKIP.has(k)) continue;
    out[k] = v;
  }
  return out;
}

// Upsert: cria o nativo se não existir (com legacy_id = id do Supabase), senão atualiza.
export async function mirrorRow(base44: any, table: string, row: any): Promise<any> {
  const entity = TABLE_TO_ENTITY[table];
  if (!entity || !row || !row.id) return null;
  const e = base44.asServiceRole.entities[entity];
  const payload = toPayload(row);
  try {
    const existing = await e.filter({ legacy_id: row.id }, undefined, 1);
    if (existing && existing.length > 0) {
      return await e.update(existing[0].id, payload);
    }
    return await e.create({ ...payload, legacy_id: row.id });
  } catch {
    return null;
  }
}

// Atualiza campos específicos do nativo vinculado ao id do Supabase (não cria).
export async function patchNativeByLegacyId(
  base44: any,
  table: string,
  supabaseId: string,
  patch: any
): Promise<void> {
  const entity = TABLE_TO_ENTITY[table];
  if (!entity || !supabaseId) return;
  const e = base44.asServiceRole.entities[entity];
  try {
    const existing = await e.filter({ legacy_id: supabaseId }, undefined, 1);
    if (existing && existing.length > 0) {
      await e.update(existing[0].id, patch);
    }
  } catch {}
}

// Remove o nativo vinculado ao id do Supabase.
export async function mirrorDelete(base44: any, table: string, supabaseId: string): Promise<void> {
  const entity = TABLE_TO_ENTITY[table];
  if (!entity || !supabaseId) return;
  const e = base44.asServiceRole.entities[entity];
  try {
    const existing = await e.filter({ legacy_id: supabaseId }, undefined, 1);
    if (existing && existing.length > 0) {
      await e.delete(existing[0].id);
    }
  } catch {}
}

// Busca o cliente atualizado no Supabase e espelha para o nativo (upsert por legacy_id).
export async function mirrorCustomerFromSupabase(
  base44: any,
  key: string,
  ref: string,
  customerId: string
): Promise<void> {
  if (!customerId) return;
  try {
    const row = await pgGet(key, ref, "customers", customerId);
    if (row) await mirrorRow(base44, "customers", row);
  } catch {}
}