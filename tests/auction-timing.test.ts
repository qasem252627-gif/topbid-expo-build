import { describe, expect, it } from "vitest";
import { extendAuctionEndForLateBid, isAuctionEndingSoon, LATE_BID_EXTENSION_MS, LATE_BID_WINDOW_MS } from "../lib/auction-timing";

describe("auction timing", () => {
  const now = new Date("2026-10-07T00:00:00.000Z");

  it("marks the countdown red at five minutes or less, but not after the auction ends", () => {
    expect(isAuctionEndingSoon(new Date(now.getTime() + 5 * 60_000), now.getTime())).toBe(true);
    expect(isAuctionEndingSoon(new Date(now.getTime() + 5 * 60_000 + 1), now.getTime())).toBe(false);
    expect(isAuctionEndingSoon(now, now.getTime())).toBe(false);
    expect(isAuctionEndingSoon(new Date(now.getTime() - 1), now.getTime())).toBe(false);
  });

  it("adds exactly two minutes to every accepted bid in the final two-minute window", () => {
    const end = new Date(now.getTime() + 90_000);
    const firstBidAt = new Date(now.getTime() + 30_000);
    const firstExtension = extendAuctionEndForLateBid(end, firstBidAt);

    expect(firstExtension?.getTime()).toBe(end.getTime() + LATE_BID_EXTENSION_MS);

    const secondBidAt = new Date(firstBidAt.getTime() + 100_000);
    const secondExtension = firstExtension && extendAuctionEndForLateBid(firstExtension, secondBidAt);
    expect(secondExtension?.getTime()).toBe(firstExtension!.getTime() + LATE_BID_EXTENSION_MS);
  });

  it("does not extend bids outside the final window or after closing", () => {
    const end = new Date(now.getTime() + LATE_BID_WINDOW_MS + 1);
    expect(extendAuctionEndForLateBid(end, now)).toBeNull();
    expect(extendAuctionEndForLateBid(now, now)).toBeNull();
    expect(extendAuctionEndForLateBid(new Date(now.getTime() - 1), now)).toBeNull();
  });
});
