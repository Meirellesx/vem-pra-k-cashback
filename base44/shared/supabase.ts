// Acesso compartilhado ao projeto "Cashback" no Supabase via conector Base44.
// Usado por todas as funções de backend que precisam ler/gravar dados no Supabase.

const API_BASE = 'https://api.supabase.com/v1';
const PROJECT_NAME = 'Cashback';

// Cache do project ref entre invocações (o processo sobrevive por um tempo).
let cachedRef = null;

// Obtém a conexão OAuth do conector Supabase (token de acesso).
export async function getConnection(base44) {
  const conn = await base44.asServiceRole.connectors.getConnection('supabase');
  if (!conn || !conn.accessToken) {
    throw new Error('Supabase não conectado. Autorize o conector Supabase no painel da aplicação.');
  }
  return conn;
}

// Resolve o project ref listando os projetos e procurando por nome "Cashback".
export async function getProjectRef(accessToken) {
  if (cachedRef) return cachedRef;
  const res = await fetch(`${API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Erro ao listar projetos Supabase (${res.status}): ${await res.text()}`);
  }
  const projects = await res.json();
  const match = (projects || []).find((p) => p.name === PROJECT_NAME);
  if (!match) {
    throw new Error(`Projeto '${PROJECT_NAME}' não encontrado no Supabase. Verifique o nome do projeto no painel do Supabase.`);
  }
  cachedRef = match.id;
  return cachedRef;
}

// Executa SQL arbitrário (SELECT, INSERT, UPDATE, DELETE, DDL) no projeto.
export async function runSql(accessToken, ref, query) {
  const res = await fetch(`${API_BASE}/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SQL error (${res.status}): ${text}`);
  }
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

// Colunas comuns a todas as tabelas (espelham os atributos embutidos do Base44).
const COMMON = [
  'id uuid primary key default gen_random_uuid()',
  'created_date timestamptz default now()',
  'updated_date timestamptz default now()',
  'created_by_id text',
].join(', ');

// Definições das tabelas que espelham as entidades do app.
export const TABLES = {
  customers: [
    'name text', 'phone text', 'email text', 'cpf text', 'identifier_code text',
    'accepts_promotions boolean default false',
    'available_balance numeric default 0', 'pending_balance numeric default 0',
    'total_cashback_earned numeric default 0', 'total_cashback_used numeric default 0',
    'is_demo boolean default false', 'is_active boolean default true', 'notes text',
  ].join(', '),
  sales: [
    'sale_number text', 'customer_id uuid', 'customer_name text',
    'total_amount numeric', 'eligible_amount numeric', 'cashback_amount numeric',
    'cashback_used numeric default 0', 'payment_method text', 'sale_date date',
    'category_id uuid', 'status text default \'concluida\'',
    'cashback_generated boolean default false', 'cashback_transaction_id uuid',
    'operator_id text', 'cashier_id text', 'cancellation_reason text',
    'is_demo boolean default false', 'notes text',
  ].join(', '),
  cashback_transactions: [
    'customer_id uuid', 'customer_name text', 'sale_id uuid', 'sale_number text',
    'amount numeric', 'type text', 'status text default \'pendente\'',
    'transaction_date date', 'available_date date', 'expiry_date date',
    'reference_transaction_id text', 'operator_id text', 'justification text',
    'is_demo boolean default false', 'notes text',
  ].join(', '),
  cashback_redemptions: [
    'customer_id uuid', 'customer_name text', 'sale_id uuid', 'sale_number text',
    'amount_redeemed numeric', 'sale_total numeric', 'redemption_date date',
    'operator_id text', 'status text default \'ativo\'', 'cancellation_reason text',
    'transactions_used jsonb', 'is_demo boolean default false',
  ].join(', '),
  cashback_settings: [
    'cashback_percentage numeric default 5', 'min_purchase_to_use numeric default 50',
    'max_cashback_payment_percentage numeric default 50', 'release_days numeric default 0',
    'balance_validity_days numeric default 365', 'is_active boolean default true',
    'program_name text default \'Vem Pra K Cashback\'', 'terms_text text',
    'privacy_text text', 'updated_by text',
  ].join(', '),
  product_categories: [
    'name text', 'generates_cashback boolean default true',
    'can_use_cashback boolean default true', 'cashback_percentage_override numeric',
    'description text', 'is_active boolean default true',
  ].join(', '),
  audit_logs: [
    'user_id text', 'user_name text', 'user_role text', 'action text',
    'entity_type text', 'entity_id text', 'description text', 'justification text',
    'before_data text', 'after_data text', 'ip_address text', 'is_demo boolean default false',
  ].join(', '),
  notifications: [
    'customer_id uuid', 'customer_name text', 'title text', 'message text',
    'type text', 'is_read boolean default false', 'sent_date timestamptz',
    'is_demo boolean default false',
  ].join(', '),
  consent_records: [
    'customer_id uuid', 'customer_name text', 'consent_type text', 'accepted boolean',
    'consent_date timestamptz', 'ip_address text', 'version text',
  ].join(', '),
  internal_accounts: [
    'username text', 'full_name text', 'email text', 'phone text', 'cpf text',
    'job_title text', 'role text default \'cashier\'', 'password_hash text',
    'password_salt text', 'status text default \'active\'', 'linked_customer_id uuid',
    'last_login_at timestamptz', 'failed_attempts numeric default 0',
    'locked_until timestamptz', 'notes text',
  ].join(', '),
  staff_invitations: [
    'full_name text', 'email text', 'phone text', 'job_title text', 'role text',
    'status text default \'pending\'', 'invited_by text', 'invited_at timestamptz',
    'accepted_at timestamptz',
  ].join(', '),
};

// Cria todas as tabelas (CREATE TABLE IF NOT EXISTS) e retorna a lista criada.
export async function ensureTables(accessToken, ref) {
  const created = [];
  for (const [name, cols] of Object.entries(TABLES)) {
    const sql = `CREATE TABLE IF NOT EXISTS ${name} (${COMMON}, ${cols});`;
    await runSql(accessToken, ref, sql);
    created.push(name);
  }
  // Atualiza updated_date automaticamente em todas as tabelas.
  for (const name of Object.keys(TABLES)) {
    const triggerName = `set_updated_date_${name}`;
    await runSql(accessToken, ref, `
      CREATE OR REPLACE FUNCTION set_updated_date() RETURNS trigger AS $$
      BEGIN NEW.updated_date = now(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS ${triggerName} ON ${name};
      CREATE TRIGGER ${triggerName} BEFORE UPDATE ON ${name}
        FOR EACH ROW EXECUTE FUNCTION set_updated_date();
    `).catch(() => {});
  }
  return created;
}

// Lista as tabelas existentes no schema public.
export async function listTables(accessToken, ref) {
  const rows = await runSql(accessToken, ref,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;");
  return (rows || []).map((r) => r.table_name);
}