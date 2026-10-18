import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import { META_WHATSAPP_WEBHOOK_PATH, registerMetaWhatsAppWebhookRoutes } from "../server/_core/meta-whatsapp-webhook";

type RouteHandler = (req: Request, res: Response) => unknown;

function registerRoutes() {
  const getHandlers = new Map<string, RouteHandler>();
  const postHandlers = new Map<string, RouteHandler>();
  const app = {
    get: (path: string, ...handlers: ((...args: unknown[]) => unknown)[]) => {
      getHandlers.set(path, handlers.at(-1) as RouteHandler);
    },
    post: (path: string, ...handlers: ((...args: unknown[]) => unknown)[]) => {
      postHandlers.set(path, handlers.at(-1) as RouteHandler);
    },
  } as unknown as Express;
  registerMetaWhatsAppWebhookRoutes(app);
  return { getHandlers, postHandlers };
}

function makeResponse() {
  const state: { statusCode?: number; body?: unknown; contentType?: string } = {};
  const response = {
    status: vi.fn((statusCode: number) => { state.statusCode = statusCode; return response; }),
    type: vi.fn((contentType: string) => { state.contentType = contentType; return response; }),
    send: vi.fn((body: unknown) => { state.body = body; return response; }),
    json: vi.fn((body: unknown) => { state.body = body; return response; }),
  };
  return { response: response as unknown as Response, state };
}

function makeRequest(options: { query?: Record<string, unknown>; body?: unknown; signature?: string } = {}) {
  const headers: Record<string, string> = {};
  if (options.signature) headers["x-hub-signature-256"] = options.signature;
  return {
    query: options.query ?? {},
    body: options.body,
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe("Meta WhatsApp webhook", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it("echoes the challenge only when the verification token matches", () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "a-long-test-verify-token");
    const { getHandlers } = registerRoutes();
    const { response, state } = makeResponse();
    const req = makeRequest({
      query: {
        "hub.mode": "subscribe",
        "hub.verify_token": "a-long-test-verify-token",
        "hub.challenge": "challenge-123",
      },
    });

    getHandlers.get(META_WHATSAPP_WEBHOOK_PATH)!(req, response);

    expect(state.statusCode).toBe(200);
    expect(state.contentType).toBe("text/plain");
    expect(state.body).toBe("challenge-123");
  });

  it("rejects a mismatched verification token without echoing the challenge", () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "expected-token");
    const { getHandlers } = registerRoutes();
    const { response, state } = makeResponse();
    const req = makeRequest({
      query: { "hub.mode": "subscribe", "hub.verify_token": "wrong-token", "hub.challenge": "challenge-123" },
    });

    getHandlers.get(META_WHATSAPP_WEBHOOK_PATH)!(req, response);

    expect(state.statusCode).toBe(403);
    expect(state.body).toBe("WEBHOOK_VERIFICATION_FAILED");
  });

  it("acknowledges a valid signed Meta callback without exposing its payload", () => {
    const appSecret = "test-meta-app-secret";
    vi.stubEnv("WHATSAPP_APP_SECRET", appSecret);
    const rawBody = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));
    const signature = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    const { postHandlers } = registerRoutes();
    const { response, state } = makeResponse();

    postHandlers.get(META_WHATSAPP_WEBHOOK_PATH)!(makeRequest({ body: rawBody, signature }), response);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ received: true });
    expect(JSON.stringify(state.body)).not.toContain("whatsapp_business_account");
  });

  it("rejects invalid signatures and missing configuration", () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "test-meta-app-secret");
    const { postHandlers } = registerRoutes();
    const { response, state } = makeResponse();

    postHandlers.get(META_WHATSAPP_WEBHOOK_PATH)!(
      makeRequest({ body: Buffer.from('{"object":"whatsapp_business_account","entry":[]}'), signature: "sha256=0".padEnd(71, "0") }),
      response,
    );

    expect(state.statusCode).toBe(401);
    expect(state.body).toEqual({ error: "INVALID_WEBHOOK_SIGNATURE" });

    vi.stubEnv("WHATSAPP_APP_SECRET", "");
    const { response: unconfiguredResponse, state: unconfiguredState } = makeResponse();
    postHandlers.get(META_WHATSAPP_WEBHOOK_PATH)!(makeRequest({ body: Buffer.from("{}") }), unconfiguredResponse);
    expect(unconfiguredState.statusCode).toBe(503);
    expect(unconfiguredState.body).toEqual({ error: "WEBHOOK_NOT_CONFIGURED" });
  });
});
