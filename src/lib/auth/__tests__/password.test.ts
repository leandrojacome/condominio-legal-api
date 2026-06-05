/**
 * Unit tests for password hashing utilities (src/lib/auth/password.ts).
 * Uses Node's crypto — no external dependencies needed.
 */
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("hashPassword", () => {
  it("returns a string in 'salt:hash' format", async () => {
    const result = await hashPassword("mypassword");
    expect(result).toContain(":");
    const parts = result.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(32); // 16 random bytes → 32 hex chars
    expect(parts[1]).toHaveLength(128); // 64 byte scrypt output → 128 hex chars
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const hash1 = await hashPassword("secret");
    const hash2 = await hashPassword("secret");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const stored = await hashPassword("correct-password");
    const result = await verifyPassword("correct-password", stored);
    expect(result).toBe(true);
  });

  it("returns false for a wrong password", async () => {
    const stored = await hashPassword("correct-password");
    const result = await verifyPassword("wrong-password", stored);
    expect(result).toBe(false);
  });

  it("returns false when stored string has no colon separator", async () => {
    const result = await verifyPassword("password", "invalidstoredstring");
    expect(result).toBe(false);
  });

  it("returns false when hash portion has wrong length", async () => {
    // salt:short-hash — storedBuf.length will be < 64 bytes
    const result = await verifyPassword("password", "abcd1234:deadbeef");
    expect(result).toBe(false);
  });

  it("returns false for empty password against real hash", async () => {
    const stored = await hashPassword("non-empty");
    const result = await verifyPassword("", stored);
    expect(result).toBe(false);
  });

  it("is case-sensitive", async () => {
    const stored = await hashPassword("Password123");
    const result = await verifyPassword("password123", stored);
    expect(result).toBe(false);
  });
});
