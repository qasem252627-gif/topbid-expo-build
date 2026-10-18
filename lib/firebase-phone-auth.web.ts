import Constants from "expo-constants";
import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";

let confirmation: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;

function firebaseOptions() {
  const options = Constants.expoConfig?.extra?.firebaseWebConfig as FirebaseOptions | undefined;
  if (!options?.apiKey || !options.authDomain || !options.projectId || !options.appId) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }
  return options;
}

function getFirebaseAuth() {
  const options = firebaseOptions();
  const app = getApps().find((candidate) => candidate.name === "mizadna-phone-auth")
    ?? initializeApp(options, "mizadna-phone-auth");
  return getAuth(app);
}

function asFirebaseError(error: unknown) {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return new Error(error.code);
  }
  return error instanceof Error ? error : new Error("FIREBASE_AUTH_FAILED");
}

export async function requestFirebaseSmsCode(phone: string, containerId = "firebase-recaptcha-container") {
  try {
    const element = document.getElementById(containerId);
    if (!element) throw new Error("FIREBASE_RECAPTCHA_REQUIRED");
    verifier?.clear();
    verifier = new RecaptchaVerifier(getFirebaseAuth(), element, { size: "normal" });
    confirmation = await signInWithPhoneNumber(getFirebaseAuth(), phone, verifier);
  } catch (error) {
    throw asFirebaseError(error);
  }
}

export async function confirmFirebaseSmsCode(code: string) {
  if (!confirmation) throw new Error("FIREBASE_VERIFICATION_SESSION_MISSING");
  try {
    const result = await confirmation.confirm(code);
    confirmation = null;
    return await result.user.getIdToken(true);
  } catch (error) {
    throw asFirebaseError(error);
  }
}
