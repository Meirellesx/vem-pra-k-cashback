// Utilitários de hash de senha compartilhados entre as funções de backend
// de login interno. Usa PBKDF2 (SHA-256) via Web Crypto SubtleCrypto, com
// salt único por conta.

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

const ITERATIONS = 100000;

export async function hashPassword(
  password: string,
  salt?: string
): Promise<{ hash: string; salt: string }> {
  const s = salt || crypto.randomUUID().replace(/-/g, "");
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(s), iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: bytesToBase64(new Uint8Array(bits)), salt: s };
}

export async function verifyPassword(
  password: string,
  hash: string,
  salt: string
): Promise<boolean> {
  const { hash: computed } = await hashPassword(password, salt);
  return computed === hash;
}