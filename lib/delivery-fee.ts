import type { CurrencyCode } from "./currency";

export const DEFAULT_DELIVERY_FEE = { amount: 2, currency: "USD" as CurrencyCode };
export const MAX_DELIVERY_FEE: Record<CurrencyCode, number> = { USD: 1_000, IQD: 1_000_000 };

/** USD allows up to two decimals; IQD must be a whole number. Zero means free delivery. */
export function isValidDeliveryFee(amount: number, currency: CurrencyCode) {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_DELIVERY_FEE[currency]) return false;
  if (currency === "IQD") return Number.isInteger(amount);
  return Math.abs(Math.round(amount * 100) - amount * 100) < 1e-6;
}

export function parseDeliveryFeeInput(value: string) {
  const normalized = value.trim().replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)).replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}
