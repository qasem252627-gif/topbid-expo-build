import { createHash, timingSafeEqual } from "node:crypto";
import { Timestamp, type CollectionReference, type Firestore } from "firebase-admin/firestore";
import { getOtpFirestore } from "./firebase-admin";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_SENDS_PER_HOUR = 5;
export const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;

export interface OtpCodeStore {
  reserve(input: { userId: number; phone: string; codeHash: string; nowMs: number }): Promise<void>;
  invalidate(input: { userId: number; phone: string }): Promise<void>;
  consume(input: { userId: number; phone: string; codeHash: string; nowMs: number }): Promise<boolean>;
}

function documentId(userId: number, phone: string) {
  return createHash("sha256").update(`${userId}\u0000${phone}`).digest("hex");
}

function timestampMillis(value: unknown): number | null {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return null;
}

function nextRateWindow(current: Record<string, unknown> | undefined, nowMs: number) {
  const resendAt = timestampMillis(current?.resendAfterAt);
  if (resendAt !== null && resendAt > nowMs) throw new Error("OTP_COOLDOWN");

  const previousStart = timestampMillis(current?.windowStartedAt);
  const withinWindow = previousStart !== null && nowMs - previousStart < OTP_SEND_WINDOW_MS;
  const windowStartedAt = withinWindow ? previousStart : nowMs;
  const sendCount = (withinWindow ? Number(current?.sendCount) || 0 : 0) + 1;
  if (sendCount > OTP_SENDS_PER_HOUR) throw new Error("OTP_RATE_LIMITED");
  return {
    sendCount,
    windowStartedAt: Timestamp.fromMillis(windowStartedAt),
    expiresAt: Timestamp.fromMillis(windowStartedAt + OTP_SEND_WINDOW_MS),
    resendAfterAt: Timestamp.fromMillis(nowMs + OTP_RESEND_COOLDOWN_MS),
  };
}

function constantTimeHashMatch(stored: unknown, expected: string) {
  if (typeof stored !== "string" || !/^[a-f0-9]{64}$/i.test(stored)) return false;
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export class FirestoreOtpCodeStore implements OtpCodeStore {
  private readonly collection: CollectionReference;
  private readonly sendLimits: CollectionReference;

  constructor(firestore: Firestore = getOtpFirestore()) {
    this.collection = firestore.collection("otp_codes");
    this.sendLimits = firestore.collection("otp_send_limits");
  }

  async reserve({ userId, phone, codeHash, nowMs }: { userId: number; phone: string; codeHash: string; nowMs: number }) {
    const ref = this.collection.doc(documentId(userId, phone));
    const phoneHash = createHash("sha256").update(phone).digest("hex");
    const accountLimitRef = this.sendLimits.doc(`account-${userId}`);
    const phoneLimitRef = this.sendLimits.doc(`phone-${phoneHash}`);
    await ref.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const accountLimitSnapshot = await transaction.get(accountLimitRef);
      const phoneLimitSnapshot = await transaction.get(phoneLimitRef);
      const current = snapshot.exists ? snapshot.data() : undefined;
      const resendAt = timestampMillis(current?.resendAfterAt);
      if (resendAt !== null && resendAt > nowMs) throw new Error("OTP_COOLDOWN");

      const accountRate = nextRateWindow(
        accountLimitSnapshot.exists ? accountLimitSnapshot.data() : undefined,
        nowMs,
      );
      const phoneRate = nextRateWindow(
        phoneLimitSnapshot.exists ? phoneLimitSnapshot.data() : undefined,
        nowMs,
      );

      transaction.set(ref, {
        userId,
        phoneHash,
        codeHash,
        status: "active",
        attempts: 0,
        createdAt: Timestamp.fromMillis(nowMs),
        resendAfterAt: Timestamp.fromMillis(nowMs + OTP_RESEND_COOLDOWN_MS),
        expiresAt: Timestamp.fromMillis(nowMs + OTP_TTL_MS),
      });
      transaction.set(accountLimitRef, { scope: "account", userId, ...accountRate });
      transaction.set(phoneLimitRef, { scope: "phone", phoneHash, ...phoneRate });
    });
  }

  async invalidate({ userId, phone }: { userId: number; phone: string }) {
    const ref = this.collection.doc(documentId(userId, phone));
    await ref.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) transaction.update(ref, { status: "send_failed", codeHash: null });
    });
  }

  async consume({ userId, phone, codeHash, nowMs }: { userId: number; phone: string; codeHash: string; nowMs: number }) {
    const ref = this.collection.doc(documentId(userId, phone));
    return ref.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("WHATSAPP_CODE_INVALID");
      const current = snapshot.data();
      const expiresAt = timestampMillis(current?.expiresAt);
      if (
        current?.userId !== userId ||
        current?.phoneHash !== createHash("sha256").update(phone).digest("hex") ||
        current?.status !== "active" ||
        expiresAt === null ||
        expiresAt <= nowMs
      ) {
        throw new Error("WHATSAPP_CODE_INVALID");
      }

      const attempts = Number(current.attempts) || 0;
      if (attempts >= OTP_MAX_VERIFY_ATTEMPTS) throw new Error("OTP_RATE_LIMITED");
      if (!constantTimeHashMatch(current.codeHash, codeHash)) {
        const nextAttempts = attempts + 1;
        transaction.update(ref, {
          attempts: nextAttempts,
          ...(nextAttempts >= OTP_MAX_VERIFY_ATTEMPTS ? { status: "locked" } : {}),
        });
        return false;
      }

      transaction.delete(ref);
      return true;
    });
  }
}
