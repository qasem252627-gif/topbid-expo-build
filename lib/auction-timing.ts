export const AUCTION_RED_TIME_THRESHOLD_MS = 5 * 60 * 1000;
export const LATE_BID_WINDOW_MS = 2 * 60 * 1000;
export const LATE_BID_EXTENSION_MS = 2 * 60 * 1000;

type TimeValue = Date | string | number;

function toMilliseconds(value: TimeValue): number {
  if (value instanceof Date) return value.getTime();
  return typeof value === "number" ? value : new Date(value).getTime();
}

export function remainingAuctionTimeMs(endsAt: TimeValue, nowMs = Date.now()): number {
  return toMilliseconds(endsAt) - nowMs;
}

export function isAuctionEndingSoon(endsAt: TimeValue, nowMs = Date.now()): boolean {
  const remaining = remainingAuctionTimeMs(endsAt, nowMs);
  return remaining > 0 && remaining <= AUCTION_RED_TIME_THRESHOLD_MS;
}

export function extendAuctionEndForLateBid(endsAt: TimeValue, bidAt: TimeValue): Date | null {
  const endMs = toMilliseconds(endsAt);
  const bidMs = toMilliseconds(bidAt);
  const remaining = endMs - bidMs;

  if (!Number.isFinite(endMs) || !Number.isFinite(bidMs) || remaining <= 0 || remaining > LATE_BID_WINDOW_MS) {
    return null;
  }

  return new Date(endMs + LATE_BID_EXTENSION_MS);
}
