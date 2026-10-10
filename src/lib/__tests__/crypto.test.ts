import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "../crypto";

const TEST_KEY =
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const ALT_KEY =
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("crypto", () => {
  const originalEnv = process.env.TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TOKEN_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    }
  });

  it("round-trips: encrypt then decrypt returns original string", () => {
    const plaintext = "threads_access_token_abc123";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // Both still decrypt to the same value
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("secret");
    const parts = encrypted.split(":");
    // Tamper with the encrypted data
    const tampered = `${parts[0]}:${parts[1]}:${Buffer.from("tampered").toString("base64")}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws when decrypting with the wrong key", () => {
    const encrypted = encrypt("secret");
    process.env.TOKEN_ENCRYPTION_KEY = ALT_KEY;
    expect(() => decrypt(encrypted)).toThrow();
  });

  it("throws with a clear message when TOKEN_ENCRYPTION_KEY is missing", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow("TOKEN_ENCRYPTION_KEY is not set");
  });

  it("throws on invalid key (non-hex)", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "zzzz".repeat(16);
    expect(() => encrypt("test")).toThrow(
      "TOKEN_ENCRYPTION_KEY must be a 64-character hex string",
    );
  });

  it("throws on invalid key (wrong length)", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "aabbcc";
    expect(() => encrypt("test")).toThrow(
      "TOKEN_ENCRYPTION_KEY must be a 64-character hex string",
    );
  });
});
