export type AuctionWinnerCandidate = {
  auctionId: number;
  userId: number;
  amount: string;
  bidCreatedAt: Date;
  bidId: number;
  endsAt: Date;
  titleAr: string;
  titleEn: string;
  titleKu: string;
};

function toMinorUnits(amount: string) {
  const [whole, fraction = ""] = amount.split(".");
  const normalizedFraction = `${fraction}00`.slice(0, 2);
  return BigInt(whole || "0") * 100n + BigInt(normalizedFraction);
}

export function selectAuctionWinnerCandidates<T extends AuctionWinnerCandidate>(candidates: readonly T[]) {
  const ranked = [...candidates].sort((left, right) => {
    if (left.auctionId !== right.auctionId) return left.auctionId - right.auctionId;
    const leftAmount = toMinorUnits(left.amount);
    const rightAmount = toMinorUnits(right.amount);
    if (leftAmount !== rightAmount) return leftAmount > rightAmount ? -1 : 1;
    const acceptedAtDifference = left.bidCreatedAt.getTime() - right.bidCreatedAt.getTime();
    if (acceptedAtDifference !== 0) return acceptedAtDifference;
    return left.bidId - right.bidId;
  });

  const winnerByAuction = new Map<number, T>();
  for (const candidate of ranked) {
    if (!winnerByAuction.has(candidate.auctionId)) winnerByAuction.set(candidate.auctionId, candidate);
  }

  return [...winnerByAuction.values()].sort((left, right) =>
    right.endsAt.getTime() - left.endsAt.getTime() || right.auctionId - left.auctionId,
  );
}
