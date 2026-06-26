import { randomInt } from 'node:crypto';
import { redis } from '@ddotsjobs/redis';

// OTP + post-verification handoff + server-side session records, all on Redis.
// @ddotsjobs/redis applies the `ddotsjobs:` keyPrefix automatically, so the
// bare keys below become ddotsjobs:otp:* / ddotsjobs:otp-verified:* /
// ddotsjobs:session:*.

const OTP_TTL = 600; // 10 minutes
const VERIFIED_TTL = 120; // single-use sign-in handoff window
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

const otpKey = (phone: string) => `otp:${phone}`;
const verifiedKey = (phone: string) => `otp-verified:${phone}`;
const sessionKey = (userId: string) => `session:${userId}`;

/** Cryptographically-random 6-digit code (zero-padded). */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function storeOtp(phone: string, code: string): Promise<void> {
  await redis.set(otpKey(phone), code, 'EX', OTP_TTL);
}

export async function readOtp(phone: string): Promise<string | null> {
  return redis.get(otpKey(phone));
}

export async function clearOtp(phone: string): Promise<void> {
  await redis.del(otpKey(phone));
}

/** Mark a phone as freshly OTP-verified so the Credentials provider can mint a
 *  JWT session for it exactly once within VERIFIED_TTL. */
export async function markVerified(phone: string, userId: string): Promise<void> {
  await redis.set(verifiedKey(phone), userId, 'EX', VERIFIED_TTL);
}

/** Atomically consume the verification handoff (single use). */
export async function consumeVerified(phone: string): Promise<string | null> {
  const key = verifiedKey(phone);
  const userId = await redis.get(key);
  if (userId) await redis.del(key);
  return userId;
}

export async function writeSession(userId: string, role: string): Promise<void> {
  await redis.set(
    sessionKey(userId),
    JSON.stringify({ userId, role, issuedAt: new Date().toISOString() }),
    'EX',
    SESSION_TTL,
  );
}

export async function deleteSession(userId: string): Promise<void> {
  await redis.del(sessionKey(userId));
}
