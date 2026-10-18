import firebaseWebConfig from "../firebase-web-config.json";

export type FirebaseServiceAccountCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

/** Parses a server-only service-account JSON without ever logging its private key. */
export function parseFirebaseServiceAccount(
  raw: string | undefined,
  expectedProjectId: string,
): FirebaseServiceAccountCredentials | null {
  if (!raw?.trim() || !expectedProjectId.trim()) return null;

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      value.type !== "service_account" ||
      value.project_id !== expectedProjectId ||
      typeof value.client_email !== "string" ||
      !value.client_email.includes("@") ||
      typeof value.private_key !== "string"
    ) {
      return null;
    }

    const privateKey = value.private_key.replace(/\\n/g, "\n").trim();
    if (!privateKey.includes("-----BEGIN PRIVATE KEY-----") || !privateKey.includes("-----END PRIVATE KEY-----")) {
      return null;
    }

    return {
      projectId: expectedProjectId,
      clientEmail: value.client_email,
      privateKey,
    };
  } catch {
    return null;
  }
}

export function getFirebaseServiceAccount(
  env: NodeJS.ProcessEnv = process.env,
): FirebaseServiceAccountCredentials | null {
  const authProjectId =
    env.FIREBASE_AUTH_PROJECT_ID?.trim() ||
    env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    firebaseWebConfig.projectId;
  const explicitProjectId = env.FIREBASE_PROJECT_ID?.trim();
  if (explicitProjectId && explicitProjectId !== authProjectId) return null;
  return parseFirebaseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON, authProjectId);
}

export function isFirebaseFirestoreConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getFirebaseServiceAccount(env) !== null;
}
