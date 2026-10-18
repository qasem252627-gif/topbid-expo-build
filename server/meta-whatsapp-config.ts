import { getFirebaseServiceAccount } from "./firebase-service-account";

export type MetaWhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  templateName: string;
  templateLanguage: string;
  graphApiVersion: string;
  otpHashSecret: string;
};

const DEFAULT_PHONE_NUMBER_ID = "1369038742965709";
const DEFAULT_WABA_ID = "2390571788141274";
const DEFAULT_TEMPLATE_NAME = "hello_world"; // Temporary delivery test only; this template contains no OTP code.
const DEFAULT_TEMPLATE_LANGUAGE = "en_US";
const DEFAULT_GRAPH_API_VERSION = "v26.0";

export function getMetaWhatsAppConfig(env: NodeJS.ProcessEnv = process.env): MetaWhatsAppConfig | null {
  const accessToken = env.WHATSAPP_TOKEN?.trim() ?? "";
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim() || DEFAULT_PHONE_NUMBER_ID;
  const wabaId = env.WHATSAPP_WABA_ID?.trim() || DEFAULT_WABA_ID;
  const templateName = env.WHATSAPP_TEMPLATE_NAME?.trim() || DEFAULT_TEMPLATE_NAME;
  const templateLanguage = templateName === "hello_world"
    ? "en_US"
    : env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || DEFAULT_TEMPLATE_LANGUAGE;
  const graphApiVersion = env.WHATSAPP_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;
  const otpHashSecret = env.MANUS_JWT_SECRET?.trim() || env.JWT_SECRET?.trim() || "";

  if (
    !accessToken ||
    !/^\d{8,30}$/.test(phoneNumberId) ||
    !/^\d{8,30}$/.test(wabaId) ||
    !/^[a-z0-9_]{1,512}$/.test(templateName) ||
    !/^[a-z]{2}_[A-Z]{2}$/.test(templateLanguage) ||
    !/^v\d{1,3}\.\d+$/.test(graphApiVersion) ||
    !otpHashSecret
  ) {
    return null;
  }

  return {
    accessToken,
    phoneNumberId,
    wabaId,
    templateName,
    templateLanguage,
    graphApiVersion,
    otpHashSecret,
  };
}

export function isMetaWhatsAppConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getMetaWhatsAppConfig(env) !== null && getFirebaseServiceAccount(env) !== null;
}
