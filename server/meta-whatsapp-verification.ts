import { createHmac, randomInt } from "node:crypto";
import { normalizePhoneNumber } from "../lib/phone-number";
import { getOtpFirestore } from "./firebase-admin";
import { getUnverifiedPhoneForVerification, markPhoneVerifiedForUser } from "./phone-verification-common";
import { getFirebaseServiceAccount } from "./firebase-service-account";
import { getMetaWhatsAppConfig, type MetaWhatsAppConfig } from "./meta-whatsapp-config";
import { FirestoreOtpCodeStore, type OtpCodeStore, OTP_TTL_MS } from "./firestore-otp-store";

const META_API_BASE = "https://graph.facebook.com";
const META_REQUEST_TIMEOUT_MS = 15_000;
type Fetcher = typeof fetch;
type MetaSendResponse = { messages?: { id?: unknown }[]; error?: { code?: unknown; error_subcode?: unknown } };

export function generateOtpCode(random = randomInt) {
  return random(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(userId: number, phone: string, code: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`topbid-whatsapp-otp-v1\u0000${userId}\u0000${phone}\u0000${code}`)
    .digest("hex");
}

export function buildMetaOtpPayload(config: MetaWhatsAppConfig, phone: string, code: string) {
  const deliveryTestOnly = config.templateName === "hello_world";
  const parameter = { type: "text", text: code };
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone.replace(/^\+/, ""),
    type: "template",
    template: {
      name: config.templateName,
      language: { code: deliveryTestOnly ? "en_US" : config.templateLanguage },
      ...(deliveryTestOnly ? {} : {
        components: [
          { type: "body", parameters: [parameter] },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [parameter],
          },
        ],
      }),
    },
  };
}

export async function sendMetaWhatsAppTemplate(
  phone: string,
  code: string,
  config: MetaWhatsAppConfig,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const url = `${META_API_BASE}/${config.graphApiVersion}/${config.phoneNumberId}/messages`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), META_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildMetaOtpPayload(config, phone, code)),
      signal: controller.signal,
    });
  } catch {
    throw new Error("META_WHATSAPP_NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }

  let result: MetaSendResponse = {};
  try {
    result = await response.json() as MetaSendResponse;
  } catch {
    // Treat an unexpected response as a provider failure; never expose its contents.
  }

  if (!response.ok) {
    const providerCode = Number(result.error?.code);
    if (response.status === 429 || [4, 17, 80007].includes(providerCode)) {
      throw new Error("OTP_RATE_LIMITED");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("META_WHATSAPP_AUTH_FAILED");
    }
    if ([132000, 132001, 132005, 132012, 132015].includes(providerCode)) {
      throw new Error("META_WHATSAPP_TEMPLATE_ERROR");
    }
    throw new Error("META_WHATSAPP_SEND_FAILED");
  }

  const messageId = result.messages?.[0]?.id;
  if (typeof messageId !== "string" || !messageId.startsWith("wamid.")) {
    throw new Error("META_WHATSAPP_SEND_FAILED");
  }
  return messageId;
}

function requireMetaConfig(env: NodeJS.ProcessEnv) {
  const config = getMetaWhatsAppConfig(env);
  if (!config) throw new Error("META_WHATSAPP_NOT_CONFIGURED");
  return config;
}

function getStore(env: NodeJS.ProcessEnv, injected?: OtpCodeStore) {
  if (injected) return injected;
  if (!getFirebaseServiceAccount(env)) throw new Error("FIRESTORE_NOT_CONFIGURED");
  try {
    return new FirestoreOtpCodeStore(getOtpFirestore(env));
  } catch {
    throw new Error("FIRESTORE_UNAVAILABLE");
  }
}

function isSafeStoreError(error: unknown, allowed: string[]) {
  return error instanceof Error && allowed.includes(error.message);
}

function requireMatchingPhone(storedPhone: string, requestedPhone?: string) {
  if (requestedPhone === undefined) return storedPhone;
  const normalized = normalizePhoneNumber(requestedPhone);
  if (!normalized) throw new Error("INVALID_PHONE");
  if (normalized !== storedPhone) throw new Error("PHONE_MISMATCH");
  return normalized;
}

export async function startMetaWhatsAppPhoneVerification(
  userId: number,
  requestedPhone?: string,
  options: { env?: NodeJS.ProcessEnv; fetcher?: Fetcher; store?: OtpCodeStore; now?: () => number } = {},
) {
  const env = options.env ?? process.env;
  const config = requireMetaConfig(env);
  const storedPhone = await getUnverifiedPhoneForVerification(userId);
  const phone = requireMatchingPhone(storedPhone, requestedPhone);
  const store = getStore(env, options.store);
  const nowMs = options.now?.() ?? Date.now();
  const deliveryTestOnly = config.templateName === "hello_world";
  const code = deliveryTestOnly ? "" : generateOtpCode();
  const codeHash = hashOtpCode(
    userId,
    phone,
    deliveryTestOnly ? "delivery-test-no-otp" : code,
    config.otpHashSecret,
  );

  try {
    await store.reserve({ userId, phone, codeHash, nowMs });
  } catch (error) {
    if (isSafeStoreError(error, ["OTP_COOLDOWN", "OTP_RATE_LIMITED"])) throw error;
    throw new Error("FIRESTORE_UNAVAILABLE");
  }
  try {
    const messageId = await sendMetaWhatsAppTemplate(phone, code, config, options.fetcher);
    if (deliveryTestOnly) {
      await store.invalidate({ userId, phone }).catch(() => undefined);
      return { success: true as const, deliveryTestOnly: true as const, expiresInSeconds: 0, messageId };
    }
    return { success: true as const, deliveryTestOnly: false as const, expiresInSeconds: OTP_TTL_MS / 1000, messageId };
  } catch (error) {
    const codeName = error instanceof Error ? error.message : "";
    // Preserve only a real OTP after an ambiguous timeout; a delivery-only greeting has no code.
    if (deliveryTestOnly || codeName !== "META_WHATSAPP_NETWORK_ERROR") {
      await store.invalidate({ userId, phone }).catch(() => undefined);
    }
    throw error;
  }
}

export async function confirmMetaWhatsAppPhoneVerification(
  userId: number,
  code: string,
  requestedPhone?: string,
  options: { env?: NodeJS.ProcessEnv; store?: OtpCodeStore; now?: () => number } = {},
) {
  const env = options.env ?? process.env;
  const config = requireMetaConfig(env);
  if (!/^[0-9]{6}$/.test(code)) throw new Error("WHATSAPP_CODE_INVALID");
  const storedPhone = await getUnverifiedPhoneForVerification(userId);
  const phone = requireMatchingPhone(storedPhone, requestedPhone);
  const store = getStore(env, options.store);
  const codeHash = hashOtpCode(userId, phone, code, config.otpHashSecret);
  let accepted: boolean;
  try {
    accepted = await store.consume({ userId, phone, codeHash, nowMs: options.now?.() ?? Date.now() });
  } catch (error) {
    if (isSafeStoreError(error, ["WHATSAPP_CODE_INVALID", "OTP_RATE_LIMITED"])) throw error;
    throw new Error("FIRESTORE_UNAVAILABLE");
  }
  if (!accepted) throw new Error("WHATSAPP_CODE_INVALID");
  return markPhoneVerifiedForUser(userId, phone);
}
