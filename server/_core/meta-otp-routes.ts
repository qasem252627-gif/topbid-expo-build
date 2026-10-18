import type { Express, Request, Response } from "express";
import { normalizePhoneNumber } from "../../lib/phone-number";
import { confirmMetaWhatsAppPhoneVerification, startMetaWhatsAppPhoneVerification } from "../meta-whatsapp-verification";
import { sdk } from "./sdk";

const SAFE_ERROR_CODES = new Set([
  "META_WHATSAPP_NOT_CONFIGURED", "FIRESTORE_NOT_CONFIGURED", "FIRESTORE_UNAVAILABLE",
  "DATABASE_UNAVAILABLE", "OTP_COOLDOWN", "OTP_RATE_LIMITED", "WHATSAPP_CODE_INVALID",
  "INVALID_PHONE", "PHONE_MISMATCH", "PHONE_REQUIRED", "PHONE_ALREADY_VERIFIED",
  "PHONE_ALREADY_IN_USE", "PHONE_CHANGED", "META_WHATSAPP_AUTH_FAILED",
  "META_WHATSAPP_TEMPLATE_ERROR", "META_WHATSAPP_SEND_FAILED", "META_WHATSAPP_NETWORK_ERROR",
]);

function errorCode(error: unknown) {
  const candidate = error instanceof Error ? error.message : "";
  return SAFE_ERROR_CODES.has(candidate) ? candidate : "OTP_REQUEST_FAILED";
}

function statusForError(code: string) {
  if (code === "OTP_COOLDOWN" || code === "OTP_RATE_LIMITED") return 429;
  if (code === "META_WHATSAPP_NOT_CONFIGURED" || code === "FIRESTORE_NOT_CONFIGURED" || code === "FIRESTORE_UNAVAILABLE" || code === "DATABASE_UNAVAILABLE") return 503;
  if (code === "WHATSAPP_CODE_INVALID" || code === "INVALID_PHONE" || code === "PHONE_MISMATCH" || code === "PHONE_REQUIRED" || code === "PHONE_ALREADY_VERIFIED" || code === "PHONE_ALREADY_IN_USE" || code === "PHONE_CHANGED") return 400;
  return 502;
}

async function authenticate(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.id <= 0 || user.isCron) throw new Error("INVALID_USER");
    return user;
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return null;
  }
}

function bodyString(body: unknown, key: string): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.length <= 64 ? value.trim() : null;
}

export function registerMetaOtpRoutes(app: Express) {
  app.post("/api/auth/send-otp", async (req: Request, res: Response) => {
    const user = await authenticate(req, res);
    if (!user) return;

    const rawPhone = bodyString(req.body, "phone");
    const phone = rawPhone ? normalizePhoneNumber(rawPhone) : null;
    if (!phone) {
      res.status(400).json({ error: "INVALID_PHONE" });
      return;
    }

    try {
      const result = await startMetaWhatsAppPhoneVerification(user.id, phone);
      res.status(200).json({
        success: result.success,
        deliveryTestOnly: result.deliveryTestOnly,
        expiresInSeconds: result.expiresInSeconds,
        resendAfterSeconds: 60,
      });
    } catch (error) {
      const code = errorCode(error);
      res.status(statusForError(code)).json({ error: code });
    }
  });

  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    const user = await authenticate(req, res);
    if (!user) return;

    const rawPhone = bodyString(req.body, "phone");
    const phone = rawPhone ? normalizePhoneNumber(rawPhone) : null;
    const code = bodyString(req.body, "code");
    if (!phone) {
      res.status(400).json({ error: "INVALID_PHONE" });
      return;
    }
    if (!code || !/^[0-9]{6}$/.test(code)) {
      res.status(400).json({ error: "WHATSAPP_CODE_INVALID" });
      return;
    }

    try {
      const result = await confirmMetaWhatsAppPhoneVerification(user.id, code, phone);
      res.status(200).json({ success: result.success, phoneVerifiedAt: result.phoneVerifiedAt });
    } catch (error) {
      const codeName = errorCode(error);
      res.status(statusForError(codeName)).json({ error: codeName });
    }
  });
}
