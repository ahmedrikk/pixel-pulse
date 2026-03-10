// src/lib/xpConstants.test.ts
import { describe, it, expect } from "vitest";
import { XP_TABLE, DAILY_CAP, getStreakMultiplier, isStreakBypassAction, isCoreAction, TIER_REWARDS } from "./xpConstants";

describe("XP constants", () => {
  it("read_summary earns 20 XP", () => {
    expect(XP_TABLE.read_summary).toBe(20);
  });

  it("read_more earns 35 XP", () => {
    expect(XP_TABLE.read_more).toBe(35);
  });

  it("daily_login earns 50 XP", () => {
    expect(XP_TABLE.daily_login).toBe(50);
  });

  it("DAILY_CAP is 400", () => {
    expect(DAILY_CAP).toBe(400);
  });

  it("streak multiplier for day 1 is 1.0", () => {
    expect(getStreakMultiplier(1)).toBe(1.0);
  });

  it("streak multiplier for day 3 is 1.0 (days 1-6 bracket)", () => {
    expect(getStreakMultiplier(3)).toBe(1.0);
  });

  it("streak multiplier for day 7 is 1.5", () => {
    expect(getStreakMultiplier(7)).toBe(1.5);
  });

  it("streak multiplier for day 14 is 1.5 (days 7-29 bracket)", () => {
    expect(getStreakMultiplier(14)).toBe(1.5);
  });

  it("streak multiplier for day 30 is 2.0", () => {
    expect(getStreakMultiplier(30)).toBe(2.0);
  });

  it("streak_7 bypasses daily cap", () => {
    expect(isStreakBypassAction("streak_7")).toBe(true);
  });

  it("streak_30 bypasses daily cap", () => {
    expect(isStreakBypassAction("streak_30")).toBe(true);
  });

  it("read_summary does not bypass cap", () => {
    expect(isStreakBypassAction("read_summary")).toBe(false);
  });

  it("read_summary is a core action", () => {
    expect(isCoreAction("read_summary")).toBe(true);
  });
  it("daily_login is not a core action", () => {
    expect(isCoreAction("daily_login")).toBe(false);
  });
  it("tier 25 has a reward defined", () => {
    expect(TIER_REWARDS[25]).toBeDefined();
    expect(TIER_REWARDS[25].type).toBe("bundle");
  });
});
