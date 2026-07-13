import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// AES-256-GCM encryption for secrets at rest (integration tokens, credentials).
// Key is derived once from INTEGRATION_ENC_KEY, falling back to NEXTAUTH_SECRET so
// the feature works in any environment that already has an app secret. Rotating
// either env value invalidates previously-encrypted blobs (by design).

const ALGO = 'aes-256-gcm';
const SALT = 'ddotsjobs.integrations.v1';

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.INTEGRATION_ENC_KEY ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('No encryption secret (INTEGRATION_ENC_KEY or NEXTAUTH_SECRET) configured');
  cachedKey = scryptSync(secret, SALT, 32);
  return cachedKey;
}

// Returns iv.tag.ciphertext, base64url-joined by dots.
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.');
}

export function decryptSecret(blob: string): string {
  const [ivB64, tagB64, dataB64] = blob.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted blob');
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

// Convenience for JSON credential configs.
export function encryptJson(value: unknown): string {
  return encryptSecret(JSON.stringify(value));
}
export function decryptJson<T>(blob: string): T {
  return JSON.parse(decryptSecret(blob)) as T;
}
