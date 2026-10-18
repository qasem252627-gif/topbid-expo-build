import { describe, expect, it } from "vitest";
import { selectAuctionWinnerCandidates, type AuctionWinnerCandidate } from "../server/auction-winners";

function candidate(overrides: Partial<AuctionWinnerCandidate> & Pick<AuctionWinnerCandidate, "auctionId" | "userId" | "amount" | "bidId">): AuctionWinnerCandidate {
  return {
    auctionId: overrides.auctionId,
    userId: overrides.userId,
    amount: overrides.amount,
    bidId: overrides.bidId,
    bidCreatedAt: overrides.bidCreatedAt ?? new Date("2026-10-01T12:00:00Z"),
    endsAt: overrides.endsAt ?? new Date("2026-10-06T12:00:00Z"),
    titleAr: overrides.titleAr ?? "هاتف",
    titleEn: overrides.titleEn ?? "Phone",
    titleKu: overrides.titleKu ?? "مۆبایل",
  };
}

describe("auction winner selection", () => {
  it("selects the highest bid once per auction using exact two-decimal amounts", () => {
    const winners = selectAuctionWinnerCandidates([
      candidate({ auctionId: 1, userId: 10, amount: "250.09", bidId: 1 }),
      candidate({ auctionId: 2, userId: 20, amount: "50.00", bidId: 2 }),
      candidate({ auctionId: 1, userId: 11, amount: "250.10", bidId: 3 }),
    ]);

    expect(winners.map(({ auctionId, userId }) => ({ auctionId, userId }))).toEqual([
      { auctionId: 2, userId: 20 },
      { auctionId: 1, userId: 11 },
    ]);
  });

  it("breaks equal-bid ties by earliest accepted bid and then the lower bid ID", () => {
    const acceptedAt = new Date("2026-10-01T12:00:00Z");
    const winners = selectAuctionWinnerCandidates([
      candidate({ auctionId: 3, userId: 30, amount: "100.00", bidId: 9, bidCreatedAt: acceptedAt }),
      candidate({ auctionId: 3, userId: 31, amount: "100.00", bidId: 4, bidCreatedAt: acceptedAt }),
      candidate({ auctionId: 3, userId: 32, amount: "100.00", bidId: 2, bidCreatedAt: new Date(acceptedAt.getTime() + 1) }),
    ]);

    expect(winners).toHaveLength(1);
    expect(winners[0]?.userId).toBe(31);
  });

  it("orders winning products by most recent auction end", () => {
    const winners = selectAuctionWinnerCandidates([
      candidate({ auctionId: 4, userId: 40, amount: "1.00", bidId: 1, endsAt: new Date("2026-10-04T12:00:00Z") }),
      candidate({ auctionId: 5, userId: 50, amount: "1.00", bidId: 2, endsAt: new Date("2026-10-05T12:00:00Z") }),
    ]);

    expect(winners.map((winner) => winner.auctionId)).toEqual([5, 4]);
  });
});
