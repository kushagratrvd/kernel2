/**
 * Server-only AES-256-GCM encryption utilities.
 *
 * Key derivation: ENCRYPTION_SECRET (any length string) → SHA-256 → exactly 32 bytes.
 * This ensures AES-256 always receives a correctly-sized key regardless of secret length.
 */
import "server-only";
import crypto from "crypto";

function getDerivedKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_SECRET is not set. Add it to your .env file (min 32 characters)."
    );
  }
  // SHA-256 of the secret → always 32 bytes, suitable for AES-256
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export interface EncryptedPayload {
  ciphertext: string; // hex
  iv: string; // hex
  authTag: string; // hex
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Each call generates a fresh random 12-byte IV.
 */
export function encrypt(plaintext: string): EncryptedPayload {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload back to plaintext.
 * Throws if the auth tag doesn't match (tampered or wrong key).
 */
export function decrypt(payload: EncryptedPayload): string {
  const key = getDerivedKey();
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");
  const ciphertext = Buffer.from(payload.ciphertext, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Creates a masked display string from an API key.
 * e.g. "AIzaSyAbcdef12345" → "AIza••••2345"
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "••••••••";
  const prefix = apiKey.slice(0, 4);
  const suffix = apiKey.slice(-4);
  return `${prefix}••••${suffix}`;
}
