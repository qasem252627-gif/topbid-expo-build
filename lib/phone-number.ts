export function normalizePhoneNumber(input: string): string | null {
  let digits = input.trim().replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return null;

  if (digits.startsWith("964")) {
    if (digits.length < 10 || digits.length > 15) return null;
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length >= 8 && digits.length <= 12) {
    digits = `964${digits.slice(1)}`;
  } else if (digits.startsWith("7") && digits.length === 10) {
    digits = `964${digits}`;
  }

  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

export function isE164PhoneNumber(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}
