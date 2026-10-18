import { createHmac, timingSafeEqual } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";

export const META_WHATSAPP_WEBHOOK_PATH = "/api/auth/webhook/whatsapp";

function queryString(value: unknown): string | null {
  return typeof value === "string" && value.length <= 2048 ? value : null;
}

function secretsMatch(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
}

function isMetaWebhookPayload(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.object === "string" && Array.isArray(payload.entry);
}

export function registerMetaWhatsAppWebhookRoutes(app: Express) {
  app.get(META_WHATSAPP_WEBHOOK_PATH, (req: Request, res: Response) => {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ?? "";
    if (!verifyToken) {
      res.status(503).type("text/plain").send("WEBHOOK_NOT_CONFIGURED");
      return;
    }

    const mode = queryString(req.query["hub.mode"]);
    const providedToken = queryString(req.query["hub.verify_token"]);
    const challenge = queryString(req.query["hub.challenge"]);
    if (mode !== "subscribe" || !providedToken || !challenge) {
      res.status(400).type("text/plain").send("INVALID_WEBHOOK_VERIFICATION");
      return;
    }
    if (!secretsMatch(providedToken, verifyToken)) {
      res.status(403).type("text/plain").send("WEBHOOK_VERIFICATION_FAILED");
      return;
    }

    res.status(200).type("text/plain").send(challenge);
  });

  app.post(
    META_WHATSAPP_WEBHOOK_PATH,
    express.raw({ type: "application/json", limit: "256kb" }),
    (req: Request, res: Response) => {
      const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
      if (!appSecret) {
        res.status(503).json({ error: "WEBHOOK_NOT_CONFIGURED" });
        return;
      }
      if (!Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: "INVALID_WEBHOOK_BODY" });
        return;
      }

      const signature = req.get("x-hub-signature-256") ?? "";
      if (!/^sha256=[a-f0-9]{64}$/i.test(signature)) {
        res.status(401).json({ error: "INVALID_WEBHOOK_SIGNATURE" });
        return;
      }
      const suppliedSignature = Buffer.from(signature.slice("sha256=".length), "hex");
      const expectedSignature = createHmac("sha256", appSecret).update(req.body).digest();
      if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) {
        res.status(401).json({ error: "INVALID_WEBHOOK_SIGNATURE" });
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(req.body.toString("utf8"));
      } catch {
        res.status(400).json({ error: "INVALID_WEBHOOK_PAYLOAD" });
        return;
      }
      if (!isMetaWebhookPayload(payload)) {
        res.status(400).json({ error: "INVALID_WEBHOOK_PAYLOAD" });
        return;
      }

      // Acknowledge Meta promptly; callback payloads are not logged or persisted here.
      res.status(200).json({ received: true });
    },
  );
}
