import type { Language } from "./i18n";

export type CurrencyCode = "IQD" | "USD";

/** Fallback used until the shared administrator-managed rate is loaded. */
export const DEFAULT_IQD_PER_USD = 1310;

const localeFor: Record<Language, string> = { ar: "ar-IQ", en: "en-US", ku: "ckb-IQ" };

export function formatCurrency(amount: number | string, currency: CurrencyCode, language: Language) {
  const value = Number(amount);
  const safeValue = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(localeFor[language], {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IQD" ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(safeValue);
  } catch {
    return `${safeValue.toLocaleString()} ${currency}`;
  }
}

export function formatDualCurrency(amount: number | string, currency: CurrencyCode, language: Language, iqdPerUsd = DEFAULT_IQD_PER_USD) {
  const value = Number(amount);
  const primary = formatCurrency(value, currency, language);
  const secondaryCurrency: CurrencyCode = currency === "IQD" ? "USD" : "IQD";
  const safeRate = Number.isFinite(iqdPerUsd) && iqdPerUsd > 0 ? iqdPerUsd : DEFAULT_IQD_PER_USD;
  const equivalent = currency === "IQD" ? value / safeRate : value * safeRate;
  return { primary, secondary: formatCurrency(equivalent, secondaryCurrency, language) };
}
