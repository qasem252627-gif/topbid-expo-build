import type { Language } from "./i18n";

/**
 * `now` must come from the rendering screen's one-second clock. Reading
 * Date.now() here lets the React Compiler memoize the label until the auction
 * data refetches, which made the countdown jump every few seconds.
 */
export function formatTimeLeft(endsAt: Date, language: Language, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (language === "en") return days > 0
    ? `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`
    : hours > 0 ? `${hours}h ${minutes}m ${remainingSeconds}s` : `${minutes}m ${remainingSeconds}s`;
  if (language === "ku") return days > 0
    ? `${days} ڕۆژ ${hours} کاتژمێر ${minutes} خولەک ${remainingSeconds} چرکە`
    : hours > 0 ? `${hours} کاتژمێر ${minutes} خولەک ${remainingSeconds} چرکە` : `${minutes} خولەک ${remainingSeconds} چرکە`;
  return days > 0
    ? `${days} يوم ${hours} س ${minutes} د ${remainingSeconds} ث`
    : hours > 0 ? `${hours} س ${minutes} د ${remainingSeconds} ث` : `${minutes} د ${remainingSeconds} ث`;
}
