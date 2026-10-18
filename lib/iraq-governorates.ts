import type { Language } from "./i18n";

/** All 19 Iraqi governorates (including the Kurdistan Region and Halabja), stored by a stable code. */
export const IRAQ_GOVERNORATES = [
  { code: "baghdad", ar: "بغداد", en: "Baghdad", ku: "بەغدا" },
  { code: "basra", ar: "البصرة", en: "Basra", ku: "بەسرە" },
  { code: "nineveh", ar: "نينوى", en: "Nineveh", ku: "نەینەوا" },
  { code: "erbil", ar: "أربيل", en: "Erbil", ku: "هەولێر" },
  { code: "sulaymaniyah", ar: "السليمانية", en: "Sulaymaniyah", ku: "سلێمانی" },
  { code: "duhok", ar: "دهوك", en: "Duhok", ku: "دهۆک" },
  { code: "halabja", ar: "حلبجة", en: "Halabja", ku: "هەڵەبجە" },
  { code: "kirkuk", ar: "كركوك", en: "Kirkuk", ku: "کەرکووک" },
  { code: "anbar", ar: "الأنبار", en: "Anbar", ku: "ئەنبار" },
  { code: "babil", ar: "بابل", en: "Babil", ku: "بابل" },
  { code: "karbala", ar: "كربلاء", en: "Karbala", ku: "کەربەلا" },
  { code: "najaf", ar: "النجف", en: "Najaf", ku: "نەجەف" },
  { code: "wasit", ar: "واسط", en: "Wasit", ku: "واست" },
  { code: "diyala", ar: "ديالى", en: "Diyala", ku: "دیالە" },
  { code: "saladin", ar: "صلاح الدين", en: "Saladin", ku: "سەلاحەدین" },
  { code: "dhi_qar", ar: "ذي قار", en: "Dhi Qar", ku: "زیقار" },
  { code: "maysan", ar: "ميسان", en: "Maysan", ku: "مەیسان" },
  { code: "muthanna", ar: "المثنى", en: "Muthanna", ku: "موسەننا" },
  { code: "qadisiyyah", ar: "القادسية (الديوانية)", en: "Al-Qadisiyyah (Diwaniyah)", ku: "قادسیە (دیوانیە)" },
] as const;

export type GovernorateCode = (typeof IRAQ_GOVERNORATES)[number]["code"];

export const GOVERNORATE_CODES = IRAQ_GOVERNORATES.map((item) => item.code) as [GovernorateCode, ...GovernorateCode[]];

export function isGovernorateCode(value: unknown): value is GovernorateCode {
  return typeof value === "string" && IRAQ_GOVERNORATES.some((item) => item.code === value);
}

export function getGovernorateName(code: string | null | undefined, language: Language) {
  if (!code) return null;
  const match = IRAQ_GOVERNORATES.find((item) => item.code === code);
  return match ? match[language] : null;
}
