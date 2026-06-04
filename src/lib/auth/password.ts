import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/**
 * Returns a `salt:hash` string suitable for storage in User.passwordHash.
 * Uses scrypt (N=32768, r=8, p=1) — resistant to GPU/ASIC brute-force.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored `salt:hash` string.
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const sep = stored.indexOf(":");
  if (sep === -1) return false;
  const salt = stored.slice(0, sep);
  const hash = stored.slice(sep + 1);
  const storedBuf = Buffer.from(hash, "hex");
  if (storedBuf.length !== KEYLEN) return false;
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return timingSafeEqual(derived, storedBuf);
}
