import { describe, expect, it } from "vitest";
import { AUCTION_DURATION_OPTIONS_DAYS, isAllowedAuctionDurationDays, isValidAuctionStartTime } from "../lib/auction-duration";
import { auctionCopy } from "../lib/auction-copy";

describe("auction duration allowlist", () => {
  it("accepts every whole-day duration from 1 to 15", () => {
    for (let day = 1; day <= 15; day += 1) expect(isAllowedAuctionDurationDays(day)).toBe(true);
  });

  it("rejects hour-based, fractional, negative and out-of-range values", () => {
    for (const value of [0, 1.5, -1, 16, 24, 72, 360]) expect(isAllowedAuctionDurationDays(value)).toBe(false);
  });

  it("matches the localized duration options shown in every language", () => {
    const expected = [...AUCTION_DURATION_OPTIONS_DAYS].sort((a, b) => a - b);
    for (const language of ["ar", "en", "ku"] as const) {
      const keys = Object.keys(auctionCopy[language].durationOptions).map(Number).sort((a, b) => a - b);
      expect(keys).toEqual(expected);
    }
  });

  it("requires a valid future start time with at least a one-minute lead", () => {
    const now = 1_000_000;
    expect(isValidAuctionStartTime(now + 60_000, now)).toBe(true);
    expect(isValidAuctionStartTime(now + 59_999, now)).toBe(false);
    expect(isValidAuctionStartTime(Number.NaN, now)).toBe(false);
  });
});
