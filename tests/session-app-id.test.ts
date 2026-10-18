import { describe, expect, it } from "vitest";
import { isSessionPayloadForApp } from "../server/_core/sdk";

describe("Manus session app binding", () => {
  const validSession = {
    openId: "user-123",
    appId: "topbid-project",
    name: "TopBid User",
  };

  it("accepts a well-formed session bound to this application", () => {
    expect(isSessionPayloadForApp(validSession, "topbid-project")).toBe(true);
  });

  it("rejects a signed session whose appId belongs to another application", () => {
    expect(isSessionPayloadForApp({ ...validSession, appId: "another-project" }, "topbid-project")).toBe(false);
  });

  it("rejects a missing appId or malformed session payload", () => {
    expect(isSessionPayloadForApp({ openId: "user-123", name: "TopBid User" }, "topbid-project")).toBe(false);
    expect(isSessionPayloadForApp(null, "topbid-project")).toBe(false);
  });
});
