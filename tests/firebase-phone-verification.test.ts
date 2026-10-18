import { describe, expect, it } from "vitest";
import { assertFirebasePhoneTokenClaims } from "../server/firebase-phone-verification";
import { isFirebasePhoneAuthConfigured, isPhoneVerificationRequired } from "../server/firebase-phone-config";

const projectId = "mizadna-test-project";
const now = 1_800_000_000;
const validClaims = {
  aud: projectId,
  iss: `https://securetoken.google.com/${projectId}`,
  sub: "firebase-user-123",
  phone_number: "+9647701234567",
  auth_time: now - 30,
  firebase: { sign_in_provider: "phone" },
};

describe("Firebase Phone Auth configuration and token claims", () => {
  it("requires a Firebase project ID before phone verification is enabled", () => {
    const emptyWebConfig = { apiKey: "", authDomain: "", projectId: "", appId: "", messagingSenderId: "" };
    expect(isFirebasePhoneAuthConfigured({} as NodeJS.ProcessEnv, emptyWebConfig)).toBe(false);
    expect(isFirebasePhoneAuthConfigured({ FIREBASE_AUTH_PROJECT_ID: projectId } as unknown as NodeJS.ProcessEnv, emptyWebConfig)).toBe(true);
    expect(isFirebasePhoneAuthConfigured({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: projectId } as unknown as NodeJS.ProcessEnv, emptyWebConfig)).toBe(true);
  });

  it("requires verification when the server Firebase project ID matches, independent of native config files", () => {
    const env = { FIREBASE_AUTH_PROJECT_ID: projectId } as unknown as NodeJS.ProcessEnv;
    const webConfig = {
      apiKey: "test-api-key",
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      appId: "1:123:web:test",
      messagingSenderId: "123",
    };
    expect(isPhoneVerificationRequired({ env, webConfig })).toBe(true);
    expect(isPhoneVerificationRequired({
      env: { FIREBASE_AUTH_PROJECT_ID: "different-project" } as unknown as NodeJS.ProcessEnv,
      webConfig,
    })).toBe(false);
  });

  it("does not fall back to Meta WhatsApp or Firestore when Firebase Phone Auth is unavailable", () => {
    const env = {
      WHATSAPP_TOKEN: "test-token",
      FIREBASE_AUTH_PROJECT_ID: "different-project",
      FIREBASE_SERVICE_ACCOUNT_JSON: "configured",
    } as unknown as NodeJS.ProcessEnv;
    const webConfig = {
      apiKey: "test-api-key",
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      appId: "1:123:web:test",
      messagingSenderId: "123",
    };
    expect(isPhoneVerificationRequired({ env, webConfig })).toBe(false);
  });

  it("accepts a recent token from the configured project for the exact stored phone", () => {
    expect(() => assertFirebasePhoneTokenClaims(validClaims, "+9647701234567", projectId, now)).not.toThrow();
  });

  it("rejects a different Firebase project, non-phone sign-in, or mismatched phone", () => {
    expect(() => assertFirebasePhoneTokenClaims({ ...validClaims, aud: "another-project" }, "+9647701234567", projectId, now)).toThrow("FIREBASE_TOKEN_INVALID");
    expect(() => assertFirebasePhoneTokenClaims({ ...validClaims, firebase: { sign_in_provider: "password" } }, "+9647701234567", projectId, now)).toThrow("FIREBASE_PHONE_AUTH_REQUIRED");
    expect(() => assertFirebasePhoneTokenClaims(validClaims, "+9647501112222", projectId, now)).toThrow("FIREBASE_PHONE_MISMATCH");
  });

  it("rejects missing, future, or stale authentication timestamps", () => {
    expect(() => assertFirebasePhoneTokenClaims({ ...validClaims, auth_time: undefined }, "+9647701234567", projectId, now)).toThrow("FIREBASE_AUTH_TOO_OLD");
    expect(() => assertFirebasePhoneTokenClaims({ ...validClaims, auth_time: now + 31 }, "+9647701234567", projectId, now)).toThrow("FIREBASE_AUTH_TOO_OLD");
    expect(() => assertFirebasePhoneTokenClaims({ ...validClaims, auth_time: now - 601 }, "+9647701234567", projectId, now)).toThrow("FIREBASE_AUTH_TOO_OLD");
  });
});
