import { and, eq, ne } from "drizzle-orm";
import { verifiedPhoneNumbers, users } from "../drizzle/schema";
import { getDb } from "./db";

export async function getUnverifiedPhoneForVerification(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [user] = await db.select({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.phone) throw new Error("PHONE_REQUIRED");
  if (user.phoneVerifiedAt) throw new Error("PHONE_ALREADY_VERIFIED");
  const [claimedPhone] = await db.select({ userId: verifiedPhoneNumbers.userId })
    .from(verifiedPhoneNumbers)
    .where(and(eq(verifiedPhoneNumbers.phone, user.phone), ne(verifiedPhoneNumbers.userId, userId)))
    .limit(1);
  if (claimedPhone) throw new Error("PHONE_ALREADY_IN_USE");
  return user.phone;
}

export async function markPhoneVerifiedForUser(userId: number, expectedPhone: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt })
        .from(users).where(eq(users.id, userId)).limit(1).for("update");
      if (!current?.phone) throw new Error("PHONE_REQUIRED");
      if (current.phone !== expectedPhone) throw new Error("PHONE_CHANGED");

      const [phoneClaim] = await tx.select({ userId: verifiedPhoneNumbers.userId, verifiedAt: verifiedPhoneNumbers.verifiedAt })
        .from(verifiedPhoneNumbers).where(eq(verifiedPhoneNumbers.phone, current.phone)).limit(1).for("update");
      if (phoneClaim && phoneClaim.userId !== userId) throw new Error("PHONE_ALREADY_IN_USE");

      const verifiedAt = current.phoneVerifiedAt ?? phoneClaim?.verifiedAt ?? new Date();
      if (!phoneClaim) await tx.insert(verifiedPhoneNumbers).values({ userId, phone: current.phone, verifiedAt });
      await tx.update(users).set({ phoneVerifiedAt: verifiedAt, updatedAt: new Date() }).where(eq(users.id, userId));
      return { success: true as const, phoneVerifiedAt: verifiedAt };
    });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      const [claim] = await db.select({ userId: verifiedPhoneNumbers.userId, verifiedAt: verifiedPhoneNumbers.verifiedAt })
        .from(verifiedPhoneNumbers).where(eq(verifiedPhoneNumbers.phone, expectedPhone)).limit(1);
      if (claim && claim.userId !== userId) throw new Error("PHONE_ALREADY_IN_USE");
      if (claim?.userId === userId) return { success: true as const, phoneVerifiedAt: claim.verifiedAt };
    }
    throw error;
  }
}

function isDuplicateEntryError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const record = error as { code?: unknown; cause?: unknown };
  if (record.code === "ER_DUP_ENTRY") return true;
  return typeof record.cause === "object" && record.cause !== null && "code" in record.cause && record.cause.code === "ER_DUP_ENTRY";
}
