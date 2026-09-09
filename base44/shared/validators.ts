// Validadores de dados reais de cliente. Espelho de src/lib/validators.js
// (o front não consegue importar deste diretório). Mantenha os dois em sincronia.

export const onlyDigits = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

// CPF: 11 dígitos + dígitos verificadores (mod 11). Rejeita sequências iguais.
export function isValidCPF(value: unknown): boolean {
  const c = onlyDigits(value);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
}

// DDDs válidos no Brasil.
const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

// Telefone BR: 10 (fixo) ou 11 (celular) dígitos, DDD válido; se 11, 3º dígito = 9.
export function isValidBRPhone(value: unknown): boolean {
  const p = onlyDigits(value);
  if (p.length !== 10 && p.length !== 11) return false;
  if (!VALID_DDD.has(parseInt(p.slice(0, 2), 10))) return false;
  if (p.length === 11 && p[2] !== '9') return false;
  if (/^(\d)\1+$/.test(p.slice(2))) return false; // resto todo repetido
  return true;
}

// E-mail: formato + domínio com ponto e TLD >= 2, sem ".." e até 254 chars.
export function isValidEmail(value: unknown): boolean {
  const e = String(value ?? '').trim();
  if (e.length > 254 || /\.\./.test(e)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

// Valida um payload de cliente. Em update (partial), só valida o que veio.
// Retorna null se OK, ou a mensagem de erro.
export function validateCustomerPayload(
  data: Record<string, unknown>,
  { partial = false }: { partial?: boolean } = {},
): string | null {
  const has = (k: string) => data[k] !== undefined && data[k] !== null && String(data[k]).trim() !== '';

  if (!partial) {
    if (!has('name')) return 'Nome é obrigatório.';
    if (!has('phone')) return 'Telefone é obrigatório.';
    if (!has('cpf') && !has('identifier_code')) return 'CPF é obrigatório.';
  }

  const cpfRaw = has('cpf') ? data.cpf : (has('identifier_code') ? data.identifier_code : undefined);
  if (cpfRaw !== undefined && !isValidCPF(cpfRaw)) return 'CPF inválido.';
  if (has('phone') && !isValidBRPhone(data.phone)) return 'Telefone inválido.';
  if (has('email') && !isValidEmail(data.email)) return 'E-mail inválido.';
  return null;
}
