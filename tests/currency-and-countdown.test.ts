import { describe, expect, it } from "vitest";
import { formatCurrency, formatDualCurrency } from "../lib/currency";
import { formatTimeLeft } from "../lib/auction-countdown";

describe("currency display", () => {
  it("removes trailing USD cents while retaining meaningful decimal places", () => {
    expect(formatCurrency(12, "USD", "en")).toBe("$12");
    expect(formatCurrency(12.5, "USD", "en")).toBe("$12.5");
    expect(formatCurrency(12.05, "USD", "en")).toBe("$12.05");
  });

  it("uses the supplied administrator-managed IQD-per-USD rate for both conversion directions", () => {
    expect(formatDualCurrency(10, "USD", "en", 1500).secondary).toContain("15,000");
    expect(formatDualCurrency(1500, "IQD", "en", 1500).secondary).toBe("$1");
  });
});

describe("countdown display", () => {
  it("derives every second from the screen clock that is passed in", () => {
    const now = new Date("2026-10-08T00:00:00.000Z").getTime();
    expect(formatTimeLeft(new Date(now + 65_000), "en", now)).toBe("1m 5s");
    expect(formatTimeLeft(new Date(now + 65_000), "en", now + 1_000)).toBe("1m 4s");
    expect(formatTimeLeft(new Date(now + 65_000), "en", now + 2_000)).toBe("1m 3s");
    expect(formatTimeLeft(new Date(now + 90_061_000), "en", now)).toBe("1d 1h 1m 1s");
    expect(formatTimeLeft(new Date(now + 15 * 86_400_000), "ar", now)).toBe("15 يوم 0 س 0 د 0 ث");
  });
});
