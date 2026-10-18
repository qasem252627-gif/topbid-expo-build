import { eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { getFirebaseAuthProjectId, isFirebasePhoneVerificationAvailable } from "./firebase-phone-config";
import { getUnverifiedPhoneForVerification, markPhoneVerifiedForUser } from "./phone-verification-common";

export { getFirebaseAuthProjectId, isFirebasePhoneAuthConfigured } from "./firebase-phone-config";

const FIREBASE_SIGNING_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);
const MAX_AUTH_AGE_SECONDS = 10 * 60;

export type FirebasePhoneTokenClaims = JWTPayload & {
  phone_number?: string;
  auth_time?: number;
  firebase?: { sign_in_provider?: string };
};

export function assertFirebasePhoneTokenClaims(
  claims: FirebasePhoneTokenClaims,
  expectedPhone: string,
  projectId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (
    !projectId ||
    claims.aud !== projectId ||
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof claims.sub !== "string" ||
    claims.sub.length === 0 ||
    claims.sub.length > 128
  ) {
    throw new Error("FIREBASE_TOKEN_INVALID");
  }

  if (claims.firebase?.sign_in_provider !== "phone" || typeof claims.phone_number !== "string") {
    throw new Error("FIREBASE_PHONE_AUTH_REQUIRED");
  }
  if (claims.phone_number !== expectedPhone) throw new Error("FIREBASE_PHONE_MISMATCH");

  const authTime = claims.auth_time;
  if (
    typeof authTime !== "number" ||
    !Number.isFinite(authTime) ||
    authTime > nowSeconds + 30 ||
    nowSeconds - authTime > MAX_AUTH_AGE_SECONDS
  ) {
    throw new Error("FIREBASE_AUTH_TOO_OLD");
  }
}

export async function verifyFirebasePhoneIdToken(idToken: string, expectedPhone: string) {
  const projectId = getFirebaseAuthProjectId();
  if (!projectId) throw new Error("FIREBASE_NOT_CONFIGURED");
  if (idToken.length < 100 || idToken.length > 8192) throw new Error("FIREBASE_TOKEN_INVALID");

  let payload: FirebasePhoneTokenClaims;
  try {
    const verified = await jwtVerify(idToken, FIREBASE_SIGNING_KEYS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
      clockTolerance: 10,
    });
    payload = verified.payload as FirebasePhoneTokenClaims;
  } catch {
    throw new Error("FIREBASE_TOKEN_INVALID");
  }

  assertFirebasePhoneTokenClaims(payload, expectedPhone, projectId);
  return payload;
}

export async function prepareFirebasePhoneVerification(userId: number) {
  if (!isFirebasePhoneVerificationAvailable()) throw new Error("FIREBASE_NOT_CONFIGURED");
  return { phone: await getUnverifiedPhoneForVerification(userId) };
}

export async function confirmFirebasePhoneVerification(userId: number, idToken: string) {
  if (!isFirebasePhoneVerificationAvailable()) throw new Error("FIREBASE_NOT_CONFIGURED");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [user] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.phone) throw new Error("PHONE_REQUIRED");

  await verifyFirebasePhoneIdToken(idToken, user.phone);
  return markPhoneVerifiedForUser(userId, user.phone);
}
