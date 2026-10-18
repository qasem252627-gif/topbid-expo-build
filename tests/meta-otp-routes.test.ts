import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import { registerMetaOtpRoutes } from "../server/_core/meta-otp-routes";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  startMeta: vi.fn(),
  confirmMeta: vi.fn(),
}));

vi.mock("../server/_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("../server/meta-whatsapp-verification", () => ({
  startMetaWhatsAppPhoneVerification: mocks.startMeta,
  confirmMetaWhatsAppPhoneVerification: mocks.confirmMeta,
}));

type Handler = (req: Request, res: Response) => Promise<void> | void;
function registerRoutes() {
  const handlers = new Map<string, Handler>();
  const app = { post: (path: string, handler: Handler) => handlers.set(path, handler) } as unknown as Express;
  registerMetaOtpRoutes(app);
  return handlers;
}

function makeResponse() {
  const state: { statusCode?: number; body?: unknown } = {};
  const response = {
    status: vi.fn((statusCode: number) => { state.statusCode = statusCode; return response; }),
    json: vi.fn((body: unknown) => { state.body = body; return response; }),
  };
  return { response: response as unknown as Response, state };
}

function makeRequest(body: unknown = {}) {
  return { body, headers: {}, path: "/api/auth/send-otp" } as unknown as Request;
}

describe("Meta OTP REST endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated send requests without calling Meta", async () => {
    mocks.authenticateRequest.mockRejectedValueOnce(new Error("not signed in"));
    const handlers = registerRoutes();
    const { response, state } = makeResponse();
    await handlers.get("/api/auth/send-otp")!(makeRequest({ phone: "+9647701234567" }), response);
    expect(state.statusCode).toBe(401);
    expect(state.body).toEqual({ error: "UNAUTHORIZED" });
    expect(mocks.startMeta).not.toHaveBeenCalled();
  });

  it("sends only to the authenticated account phone and never returns the OTP or token", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ id: 42, isCron: false });
    mocks.startMeta.mockResolvedValueOnce({ success: true, deliveryTestOnly: false, expiresInSeconds: 600, messageId: "wamid.private" });
    const handlers = registerRoutes();
    const { response, state } = makeResponse();
    await handlers.get("/api/auth/send-otp")!(makeRequest({ phone: "+9647701234567" }), response);
    expect(mocks.startMeta).toHaveBeenCalledWith(42, "+9647701234567");
    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ success: true, deliveryTestOnly: false, expiresInSeconds: 600, resendAfterSeconds: 60 });
    expect(JSON.stringify(state.body)).not.toContain("wamid.private");
  });

  it("clearly marks hello_world delivery checks as test-only", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ id: 42, isCron: false });
    mocks.startMeta.mockResolvedValueOnce({ success: true, deliveryTestOnly: true, expiresInSeconds: 0 });
    const handlers = registerRoutes();
    const { response, state } = makeResponse();
    await handlers.get("/api/auth/send-otp")!(makeRequest({ phone: "+9647701234567" }), response);
    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ success: true, deliveryTestOnly: true, expiresInSeconds: 0, resendAfterSeconds: 60 });
  });

  it("rejects invalid phone/code input before invoking verification", async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 42, isCron: false });
    const handlers = registerRoutes();
    const { response, state } = makeResponse();
    await handlers.get("/api/auth/verify-otp")!(makeRequest({ phone: "+9647701234567", code: "123" }), response);
    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({ error: "WHATSAPP_CODE_INVALID" });
    expect(mocks.confirmMeta).not.toHaveBeenCalled();
  });

  it("does not accept a cron identity as an interactive account", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ id: 123, isCron: true });
    const handlers = registerRoutes();
    const { response, state } = makeResponse();
    await handlers.get("/api/auth/send-otp")!(makeRequest({ phone: "+9647701234567" }), response);
    expect(state.statusCode).toBe(401);
    expect(mocks.startMeta).not.toHaveBeenCalled();
  });
});
