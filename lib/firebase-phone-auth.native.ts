import Constants from "expo-constants";
import { Platform } from "react-native";

type Confirmation = {
  confirm(code: string): Promise<{ user: { getIdToken(forceRefresh?: boolean): Promise<string> } }>;
};

let confirmation: Confirmation | null = null;

function asFirebaseError(error: unknown) {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return new Error(error.code);
  }
  return error instanceof Error ? error : new Error("FIREBASE_AUTH_UNAVAILABLE");
}

export async function requestFirebaseSmsCode(phone: string, _containerId?: string) {
  try {
    const platformConfig = Constants.expoConfig?.extra?.firebaseNativeConfigured as Record<string, boolean> | undefined;
    if (!platformConfig?.[Platform.OS]) throw new Error("FIREBASE_NOT_CONFIGURED");
    const { getAuth, signInWithPhoneNumber } = await import("@react-native-firebase/auth");
    const auth = getAuth();
    const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
    if (extra?.firebasePhoneAuthTestMode === true) {
      auth.settings.appVerificationDisabledForTesting = true;
    }
    confirmation = await signInWithPhoneNumber(auth, phone);
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
