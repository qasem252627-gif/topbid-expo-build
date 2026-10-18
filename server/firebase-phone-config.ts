import firebaseWebConfig from "../firebase-web-config.json";
import { ENV } from "./_core/env";

export function getFirebaseAuthProjectId(
  env: NodeJS.ProcessEnv = process.env,
  webConfig: typeof firebaseWebConfig = firebaseWebConfig,
) {
  return (env.FIREBASE_AUTH_PROJECT_ID || env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || ENV.firebaseAuthProjectId || webConfig.projectId).trim();
}

export function isFirebasePhoneAuthConfigured(
  env: NodeJS.ProcessEnv = process.env,
  webConfig: typeof firebaseWebConfig = firebaseWebConfig,
) {
  return getFirebaseAuthProjectId(env, webConfig).length > 0;
}

export function isFirebasePhoneVerificationAvailable(
  env: NodeJS.ProcessEnv = process.env,
  webConfig: typeof firebaseWebConfig = firebaseWebConfig,
) {
  const projectId = getFirebaseAuthProjectId(env, webConfig);
  return Boolean(projectId && webConfig.projectId && webConfig.projectId === projectId);
}

export function isPhoneVerificationRequired({
  env = process.env,
  webConfig = firebaseWebConfig,
}: {
  env?: NodeJS.ProcessEnv;
  webConfig?: typeof firebaseWebConfig;
} = {}) {
  return isFirebasePhoneVerificationAvailable(env, webConfig);
}
