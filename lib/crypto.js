// Criptografia simétrica das credenciais sensíveis guardadas no banco
// (Z-API por empresa, tokens OAuth do Google) -- AES-256-GCM via módulo
// nativo `crypto` do Node, sem dependência externa.
//
// Formato armazenado: enc:v1:<iv_base64>:<tag_base64>:<cipher_base64>
//
// Compatibilidade: decrypt() devolve o valor original sem alteração se ele
// não começar com o prefixo "enc:v1:" -- permite migrar dados já gravados em
// claro sem downtime (ver scripts/migrate-encrypt.mjs).
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";
const IV_BYTES = 12; // padrão recomendado pro GCM

let cachedKey = null;
function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY || "";
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY não configurada. Gere um valor com: " +
      `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY inválida: esperado 32 bytes em base64, recebido ${key.length} byte(s).`);
  }
  cachedKey = key;
  return cachedKey;
}

/** Criptografa uma string. Valores vazios/nulos passam direto (nada a proteger). */
export function encrypt(value) {
  if (value === null || value === undefined || value === "") return value;
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const cipherBuf = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${cipherBuf.toString("base64")}`;
}

/**
 * Descriptografa uma string no formato acima. Se o valor não tiver o prefixo
 * enc:v1:, é devolvido sem alteração (dado legado ainda em claro, ou vazio).
 */
export function decrypt(value) {
  if (!value || typeof value !== "string" || !value.startsWith(PREFIX)) return value;
  const key = getKey();
  const body = value.slice(PREFIX.length);
  const parts = body.split(":");
  if (parts.length !== 3) {
    throw new Error("Valor criptografado com formato inválido (esperado iv:tag:cipher).");
  }
  const [ivB64, tagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const cipherBuf = Buffer.from(cipherB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plainBuf = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
  return plainBuf.toString("utf8");
}

/** Usado só por scripts de migração/diagnóstico, pra não reimportar a lógica. */
export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}
