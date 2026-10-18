/** User-selectable auction durations are whole days, from one to fifteen. */
export const AUCTION_DURATION_OPTIONS_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export type AuctionDurationDays = (typeof AUCTION_DURATION_OPTIONS_DAYS)[number];

export function isAllowedAuctionDurationDays(days: number): days is AuctionDurationDays {
  return Number.isInteger(days) && AUCTION_DURATION_OPTIONS_DAYS.includes(days as AuctionDurationDays);
}

/** Require a small lead time so a scheduled auction cannot arrive already started during submission. */
export function isValidAuctionStartTime(startAt: Date | number, now = Date.now(), minimumLeadMs = 60_000) {
  const timestamp = startAt instanceof Date ? startAt.getTime() : startAt;
  return Number.isFinite(timestamp) && timestamp >= now + minimumLeadMs;
}
