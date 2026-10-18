import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getFirebaseServiceAccount } from "./firebase-service-account";

const APP_NAME = "topbid-otp-firestore";

export function getOtpFirestore(env: NodeJS.ProcessEnv = process.env): Firestore {
  const serviceAccount = getFirebaseServiceAccount(env);
  if (!serviceAccount) throw new Error("FIRESTORE_NOT_CONFIGURED");

  const existingApp = getApps().find((candidate) => candidate.name === APP_NAME);
  if (existingApp && existingApp.options.projectId !== serviceAccount.projectId) {
    throw new Error("FIRESTORE_PROJECT_MISMATCH");
  }
  const app = existingApp ?? initializeApp(
    {
      credential: cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
      projectId: serviceAccount.projectId,
    },
    APP_NAME,
  );
  return getFirestore(app);
}
