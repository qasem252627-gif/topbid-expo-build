import { describe, expect, it, vi } from "vitest";
import { getMetaWhatsAppConfig, isMetaWhatsAppConfigured } from "../server/meta-whatsapp-config";
import { buildMetaOtpPayload, generateOtpCode, hashOtpCode, sendMetaWhatsAppTemplate, startMetaWhatsAppPhoneVerification } from "../server/meta-whatsapp-verification";
import { parseFirebaseServiceAccount } from "../server/firebase-service-account";
import { FirestoreOtpCodeStore, OTP_MAX_VERIFY_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_SENDS_PER_HOUR, OTP_TTL_MS, type OtpCodeStore } from "../server/firestore-otp-store";
import type { Firestore } from "firebase-admin/firestore";
import { formatOtpError } from "../lib/otp-error";

const phoneVerificationMocks = vi.hoisted(() => ({
  getUnverifiedPhoneForVerification: vi.fn(),
}));

vi.mock("../server/phone-verification-common", () => ({
  getUnverifiedPhoneForVerification: phoneVerificationMocks.getUnverifiedPhoneForVerification,
  markPhoneVerifiedForUser: vi.fn(),
}));

class MemoryFirestore {
  readonly documents = new Map<string, Record<string, unknown>>();

  collection(name: string) {
    return { doc: (id: string) => ({ id, path: `${name}/${id}`, firestore: this }) };
  }

  async runTransaction<T>(work: (transaction: any) => Promise<T>): Promise<T> {
    const transaction = {
      get: async (ref: { path: string }) => {
        const data = this.documents.get(ref.path);
        return { exists: data !== undefined, data: () => data };
      },
      set: (ref: { path: string }, data: Record<string, unknown>) => this.documents.set(ref.path, { ...data }),
      update: (ref: { path: string }, data: Record<string, unknown>) => {
        const current = this.documents.get(ref.path);
        if (!current) throw new Error("missing document");
        this.documents.set(ref.path, { ...current, ...data });
      },
      delete: (ref: { path: string }) => this.documents.delete(ref.path),
    };
    return work(transaction);
  }
}

const projectId = "topbid-c54fd";
const serviceAccount = JSON.stringify({
  type: "service_account",
  project_id: projectId,
  client_email: "firebase-admin@test.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nTEST-KEY\\n-----END PRIVATE KEY-----\\n",
});
const env = {
  WHATSAPP_TOKEN: "test-access-token-do-not-use",
  WHATSAPP_PHONE_NUMBER_ID: "1369038742965709",
  WHATSAPP_WABA_ID: "2390571788141274",
  WHATSAPP_TEMPLATE_NAME: "topbid_otp_code",
  WHATSAPP_TEMPLATE_LANGUAGE: "en_US",
  WHATSAPP_GRAPH_API_VERSION: "v26.0",
  FIREBASE_AUTH_PROJECT_ID: projectId,
  FIREBASE_SERVICE_ACCOUNT_JSON: serviceAccount,
  MANUS_JWT_SECRET: "test-session-hmac-secret-do-not-use",
} as unknown as NodeJS.ProcessEnv;

describe("Meta WhatsApp OTP configuration and delivery", () => {
  it("requires a valid service-account JSON for the same Firebase project", () => {
    expect(parseFirebaseServiceAccount(serviceAccount, projectId)?.projectId).toBe(projectId);
    expect(parseFirebaseServiceAccount(serviceAccount, "other-project")).toBeNull();
    expect(parseFirebaseServiceAccount("not-json", projectId)).toBeNull();
  });

  it("enables WhatsApp only when Meta, Firestore, and an OTP hash key are configured", () => {
    expect(isMetaWhatsAppConfigured(env)).toBe(true);
    expect(isMetaWhatsAppConfigured({ ...env, WHATSAPP_TOKEN: "" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isMetaWhatsAppConfigured({ ...env, FIREBASE_SERVICE_ACCOUNT_JSON: "{}" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("defaults temporarily to hello_world in en_US for delivery checks", () => {
    const config = getMetaWhatsAppConfig({
      ...env,
      WHATSAPP_TEMPLATE_NAME: "",
      WHATSAPP_TEMPLATE_LANGUAGE: "ar",
    } as unknown as NodeJS.ProcessEnv);
    expect(config?.templateName).toBe("hello_world");
    expect(config?.templateLanguage).toBe("en_US");
  });

  it("generates a six-digit code and stores only a user/phone-bound HMAC", () => {
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
    const hash = hashOtpCode(17, "+9647701234567", "012345", "test-secret");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("012345");
    expect(hashOtpCode(18, "+9647701234567", "012345", "test-secret")).not.toBe(hash);
    expect(hashOtpCode(17, "+9647700000000", "012345", "test-secret")).not.toBe(hash);
  });

  it("builds an approved authentication-template payload with the OTP in body and button", () => {
    const config = getMetaWhatsAppConfig(env);
    if (!config) throw new Error("test fixture must configure Meta");
    expect(buildMetaOtpPayload(config, "+9647701234567", "012345")).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "9647701234567",
      type: "template",
      template: {
        name: "topbid_otp_code",
        language: { code: "en_US" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "012345" }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "012345" }] },
        ],
      },
    });
  });

  it("builds hello_world with no OTP components or placeholders", () => {
    const baseConfig = getMetaWhatsAppConfig(env);
    if (!baseConfig) throw new Error("test fixture must configure Meta");
    expect(buildMetaOtpPayload({ ...baseConfig, templateName: "hello_world", templateLanguage: "ar" }, "+9647701234567", "654321"))
      .toEqual({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "9647701234567",
        type: "template",
        template: { name: "hello_world", language: { code: "en_US" } },
      });
  });

  it("sends a delivery-only hello_world and invalidates the non-OTP challenge", async () => {
    const phone = "+9647701234567";
    const testEnv = {
      ...env,
      WHATSAPP_TEMPLATE_NAME: "hello_world",
      WHATSAPP_TEMPLATE_LANGUAGE: "ar",
    } as unknown as NodeJS.ProcessEnv;
    phoneVerificationMocks.getUnverifiedPhoneForVerification.mockResolvedValueOnce(phone);
    const store = {
      reserve: vi.fn(async () => undefined),
      invalidate: vi.fn(async () => undefined),
      consume: vi.fn(async () => false),
    } as unknown as OtpCodeStore;
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.delivery-test" }] }), { status: 200 }),
    );

    const result = await startMetaWhatsAppPhoneVerification(17, phone, {
      env: testEnv,
      fetcher,
      store,
      now: () => 1_000,
    });

    expect(result).toMatchObject({ success: true, deliveryTestOnly: true, expiresInSeconds: 0 });
    expect(store.reserve).toHaveBeenCalledWith({
      userId: 17,
      phone,
      codeHash: hashOtpCode(17, phone, "delivery-test-no-otp", env.MANUS_JWT_SECRET as string),
      nowMs: 1_000,
    });
    expect(store.invalidate).toHaveBeenCalledWith({ userId: 17, phone });
    const [, init] = fetcher.mock.calls[0] as unknown as [string | URL | Request, RequestInit];
    expect(JSON.parse(String(init.body)).template)
      .toEqual({ name: "hello_world", language: { code: "en_US" } });
  });

  it("posts to the configured Phone Number ID and accepts only a Meta message ID", async () => {
    const config = getMetaWhatsAppConfig(env);
    if (!config) throw new Error("test fixture must configure Meta");
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.test-message-id" }] }), { status: 200 }),
    );

    await expect(sendMetaWhatsAppTemplate("+9647701234567", "654321", config, fetcher)).resolves.toBe("wamid.test-message-id");
    const [rawUrl, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(rawUrl).toBe("https://graph.facebook.com/v26.0/1369038742965709/messages");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token-do-not-use");
    const body = JSON.parse(String(init.body));
    expect(body.template.components[0].parameters[0].text).toBe("654321");
    expect(body.template.components[1].parameters[0].text).toBe("654321");
  });

  it("maps invalid templates and network errors to safe identifiers, never provider text", async () => {
    const config = getMetaWhatsAppConfig(env);
    if (!config) throw new Error("test fixture must configure Meta");
    const badTemplate = vi.fn(async () => new Response(JSON.stringify({ error: { code: 132001, message: "private provider detail" } }), { status: 400 }));
    const networkFailure = vi.fn(async () => { throw new Error("private transport detail"); });
    await expect(sendMetaWhatsAppTemplate("+9647701234567", "123456", config, badTemplate)).rejects.toThrow("META_WHATSAPP_TEMPLATE_ERROR");
    await expect(sendMetaWhatsAppTemplate("+9647701234567", "123456", config, networkFailure)).rejects.toThrow("META_WHATSAPP_NETWORK_ERROR");
  });

  it("stores only an HMAC in otp_codes and enforces expiry, resend cooldown, and one-time use", async () => {
    const memory = new MemoryFirestore();
    const store = new FirestoreOtpCodeStore(memory as unknown as Firestore);
    const input = { userId: 17, phone: "+9647701234567", codeHash: "a".repeat(64), nowMs: 1_000 };
    await store.reserve(input);
    const stored = [...memory.documents.values()].find((item) => typeof item.codeHash === "string");
    expect(stored).toBeDefined();
    expect(stored?.codeHash).toBe(input.codeHash);
    expect(stored?.codeHash).not.toBe("123456");
    expect((stored?.expiresAt as { toMillis: () => number }).toMillis()).toBe(input.nowMs + OTP_TTL_MS);
    await expect(store.reserve({ ...input, nowMs: input.nowMs + OTP_RESEND_COOLDOWN_MS - 1 })).rejects.toThrow("OTP_COOLDOWN");
    await expect(store.consume({ ...input, codeHash: "b".repeat(64), nowMs: input.nowMs + 1 })).resolves.toBe(false);
    await expect(store.consume(input)).resolves.toBe(true);
    expect([...memory.documents.keys()].some((path) => path.startsWith("otp_codes/"))).toBe(false);
  });

  it("rejects expired codes and locks after the configured number of wrong attempts", async () => {
    const expiredMemory = new MemoryFirestore();
    const expiredStore = new FirestoreOtpCodeStore(expiredMemory as unknown as Firestore);
    const expiredInput = { userId: 17, phone: "+9647701234567", codeHash: "a".repeat(64), nowMs: 1_000 };
    await expiredStore.reserve(expiredInput);
    await expect(expiredStore.consume({ ...expiredInput, nowMs: expiredInput.nowMs + OTP_TTL_MS })).rejects.toThrow("WHATSAPP_CODE_INVALID");

    const memory = new MemoryFirestore();
    const store = new FirestoreOtpCodeStore(memory as unknown as Firestore);
    const input = { userId: 18, phone: "+9647701234567", codeHash: "a".repeat(64), nowMs: 2_000 };
    await store.reserve(input);
    for (let attempt = 0; attempt < OTP_MAX_VERIFY_ATTEMPTS; attempt += 1) {
      await expect(store.consume({ ...input, codeHash: "b".repeat(64), nowMs: input.nowMs + attempt })).resolves.toBe(false);
    }
    await expect(store.consume(input)).rejects.toThrow("WHATSAPP_CODE_INVALID");
  });

  it("enforces the per-account hourly send cap even after the cooldown expires", async () => {
    const memory = new MemoryFirestore();
    const store = new FirestoreOtpCodeStore(memory as unknown as Firestore);
    const input = { userId: 19, phone: "+9647701234567", codeHash: "a".repeat(64), nowMs: 10_000 };
    await store.reserve(input);
    for (let send = 1; send < OTP_SENDS_PER_HOUR; send += 1) {
      await store.reserve({ ...input, nowMs: input.nowMs + send * OTP_RESEND_COOLDOWN_MS });
    }
    await expect(store.reserve({ ...input, nowMs: input.nowMs + OTP_SENDS_PER_HOUR * OTP_RESEND_COOLDOWN_MS })).rejects.toThrow("OTP_RATE_LIMITED");
  });

  it("keeps the account hourly cap when the account changes phone numbers", async () => {
    const memory = new MemoryFirestore();
    const store = new FirestoreOtpCodeStore(memory as unknown as Firestore);
    const base = { userId: 29, codeHash: "a".repeat(64), nowMs: 20_000 };
    for (let send = 0; send < OTP_SENDS_PER_HOUR; send += 1) {
      await store.reserve({
        ...base,
        phone: `+96477012345${String(send).padStart(2, "0")}`,
        nowMs: base.nowMs + send * OTP_RESEND_COOLDOWN_MS,
      });
    }
    await expect(store.reserve({
      ...base,
      phone: "+9647709999999",
      nowMs: base.nowMs + OTP_SENDS_PER_HOUR * OTP_RESEND_COOLDOWN_MS,
    })).rejects.toThrow("OTP_RATE_LIMITED");
  });

  it("keeps the phone hourly cap across different accounts", async () => {
    const memory = new MemoryFirestore();
    const store = new FirestoreOtpCodeStore(memory as unknown as Firestore);
    const base = { phone: "+9647701234567", codeHash: "a".repeat(64), nowMs: 30_000 };
    for (let send = 0; send < OTP_SENDS_PER_HOUR; send += 1) {
      await store.reserve({
        ...base,
        userId: 40 + send,
        nowMs: base.nowMs + send * OTP_RESEND_COOLDOWN_MS,
      });
    }
    await expect(store.reserve({
      ...base,
      userId: 99,
      nowMs: base.nowMs + OTP_SENDS_PER_HOUR * OTP_RESEND_COOLDOWN_MS,
    })).rejects.toThrow("OTP_RATE_LIMITED");
  });

  it("enforces the 60-second cooldown across account or phone changes", async () => {
    const memory = new MemoryFirestore();
    const store = new FirestoreOtpCodeStore(memory as unknown as Firestore);
    const nowMs = 40_000;
    await store.reserve({ userId: 50, phone: "+9647701234567", codeHash: "a".repeat(64), nowMs });
    await expect(store.reserve({
      userId: 50,
      phone: "+9647709999999",
      codeHash: "b".repeat(64),
      nowMs: nowMs + 1_000,
    })).rejects.toThrow("OTP_COOLDOWN");
    await expect(store.reserve({
      userId: 51,
      phone: "+9647701234567",
      codeHash: "c".repeat(64),
      nowMs: nowMs + 1_000,
    })).rejects.toThrow("OTP_COOLDOWN");
  });

  it("exposes only allowlisted Meta error codes to the app", () => {
    expect(formatOtpError("Try again", new Error("META_WHATSAPP_AUTH_FAILED private-provider-detail"), "whatsapp-send"))
      .toBe("Try again [whatsapp-send: META_WHATSAPP_AUTH_FAILED]");
  });
});
