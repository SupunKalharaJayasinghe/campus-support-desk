import crypto from "crypto";

const IV_LEN = 16;
const TAG_LEN = 16;

function keyFromSecret(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

/** Returns base64(iv||tag||ciphertext). Requires COMMUNITY_URGENT_PAYMENT_KEY env in production. */
export function encryptPanOptional(panDigits: string, secret: string | undefined): string | null {
  if (!secret || secret.length < 16) return null;
  try {
    const key = keyFromSecret(secret);
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(panDigits, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64");
  } catch {
    return null;
  }
}

export function decryptPanOptional(blob: string, secret: string | undefined): string | null {
  if (!secret || secret.length < 16) return null;
  try {
    const buf = Buffer.from(blob, "base64");
    if (buf.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const key = keyFromSecret(secret);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function getUrgentPaymentEncryptionKey(): string | undefined {
  const k = process.env.COMMUNITY_URGENT_PAYMENT_KEY?.trim();
  return k && k.length >= 16 ? k : undefined;
}
