export function formatProductNumber(auctionId: number) {
  return `MZ-${String(auctionId).padStart(6, "0")}`;
}
