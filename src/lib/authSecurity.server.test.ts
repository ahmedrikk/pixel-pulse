import { describe, expect, it, vi } from "vitest";
import type { Redis } from "@upstash/redis";
import {
  checkRateLimit,
  GENERIC_LOGIN_ERROR,
  GENERIC_RESET_MESSAGE,
  loginBodySchema,
  passwordSchema,
  recordFailure,
} from "../../api/_shared/auth-security";

describe("authentication input security", () => {
  it("uses the exact non-enumerating messages", () => {
    expect(GENERIC_LOGIN_ERROR).toBe("Incorrect email or password");
    expect(GENERIC_RESET_MESSAGE).toBe("If that email is registered, you'll receive a reset link");
  });

  it("normalizes email and rejects extra body fields", () => {
    expect(loginBodySchema.parse({ email: " User@Example.com ", password: "not-logged" }).email)
      .toBe("user@example.com");
    expect(loginBodySchema.safeParse({ email: "user@example.com", password: "not-logged", role: "admin" }).success)
      .toBe(false);
  });

  it("bounds credentials and enforces the signup password policy", () => {
    expect(loginBodySchema.safeParse({ email: "not-an-email", password: "secret" }).success).toBe(false);
    expect(loginBodySchema.safeParse({ email: "user@example.com", password: "x".repeat(129) }).success).toBe(false);
    expect(passwordSchema.safeParse("letters-only").success).toBe(false);
    expect(passwordSchema.safeParse("SecurePass123").success).toBe(true);
  });
});

describe("Redis authentication controls", () => {
  it("allows ten requests and rejects the eleventh", async () => {
    const redis = { eval: vi.fn().mockResolvedValueOnce([10, 30_000]).mockResolvedValueOnce([11, 29_000]) } as unknown as Redis;
    await expect(checkRateLimit(redis, "ip", 10, 60_000)).resolves.toBe(true);
    await expect(checkRateLimit(redis, "ip", 10, 60_000)).resolves.toBe(false);
  });

  it("maps the atomic failure result into a lock state", async () => {
    const redis = { eval: vi.fn().mockResolvedValue([5, 1]) } as unknown as Redis;
    await expect(recordFailure(redis, { failures: "fail", locked: "lock" })).resolves.toEqual({ failures: 5, locked: true });
  });
});
