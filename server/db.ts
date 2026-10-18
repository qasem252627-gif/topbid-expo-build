import { and, asc, desc, eq, gt, inArray, like, lte, ne, or, sql } from "drizzle-orm";
import { isAllowedAuctionDurationDays, isValidAuctionStartTime } from "../lib/auction-duration";
import { randomUUID } from "node:crypto";
import { extendAuctionEndForLateBid } from "../lib/auction-timing";
import { isReturnEvidenceKeyOwnedByUser } from "./return-evidence";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, auctionFavorites, auctionGalleryImages, auctions, bids, currencySettings, deliveryConfirmations, promotionalAds, pushTokens, returnRequests, supportConversations, supportMessages, users, verifiedPhoneNumbers } from "../drizzle/schema";
import { selectAuctionWinnerCandidates } from "./auction-winners";
import { ENV } from "./_core/env";
import { isAuctionPhotoKeyOwnedByUser } from "./auction-images";
import { isPhoneVerificationRequired } from "./firebase-phone-config";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch {
      console.warn("[Database] Failed to connect");
      _db = null;
    }
  }
  return _db;
}

const parseList = (value: string | undefined) =>
  new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean));

function isConfiguredAdmin(openId: string, email?: string | null) {
  const identities = parseList(process.env.MIZADNA_ADMIN_IDENTITIES);
  const ids = parseList(process.env.MIZADNA_ADMIN_OPEN_IDS);
  const emails = parseList(process.env.MIZADNA_ADMIN_EMAILS);
  if (ENV.ownerOpenId && openId === ENV.ownerOpenId) return true;
  const normalizedEmail = email?.trim().toLowerCase();
  if (identities.has(openId) || Boolean(normalizedEmail && identities.has(normalizedEmail))) return true;
  if (ids.has(openId)) return true;
  return Boolean(normalizedEmail && emails.has(normalizedEmail));
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const existingEmail = user.email == null
    ? (await db.select({ email: users.email }).from(users).where(eq(users.openId, user.openId)).limit(1))[0]?.email
    : user.email;
  const adminByAllowlist = isConfiguredAdmin(user.openId, existingEmail);
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const nullableFields = ["name", "email", "loginMethod"] as const;
  for (const field of nullableFields) {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = new Date();
    updateSet.lastSignedIn = new Date();
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (adminByAllowlist) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

/** Saves the phone; the address is only changed when explicitly provided (older app builds still send it). */
export async function updateUserProfile(id: number, phone: string, address?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.transaction(async (tx) => {
    const existing = await tx.select({ phone: users.phone }).from(users).where(eq(users.id, id)).limit(1).for("update");
    if (!existing[0]) throw new Error("USER_NOT_FOUND");
    const phoneChanged = existing[0].phone !== phone;
    await tx.update(users).set({ phone, ...(address !== undefined ? { address } : {}), ...(phoneChanged ? { phoneVerifiedAt: null } : {}), updatedAt: new Date() }).where(eq(users.id, id));
    if (phoneChanged) {
      await tx.delete(verifiedPhoneNumbers).where(eq(verifiedPhoneNumbers.userId, id));
    }
  });
}

export async function updateUserAddress(id: number, governorate: string | null, address: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing[0]) throw new Error("USER_NOT_FOUND");
  await db.update(users).set({ governorate, address, updatedAt: new Date() }).where(eq(users.id, id));
}

export async function registerUserPushToken(input: { userId: number; token: string; language: "ar" | "en" | "ku"; platform: "android" | "ios" }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(pushTokens).values(input).onDuplicateKeyUpdate({
    set: { userId: input.userId, language: input.language, platform: input.platform, updatedAt: new Date() },
  });
}

export async function removeUserPushToken(userId: number, token: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
}

export async function removeUserPushTokens(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
}

export async function removePushTokens(tokens: string[]) {
  if (tokens.length === 0) return;
  const db = await getDb();
  if (!db) return;
  await db.delete(pushTokens).where(inArray(pushTokens.token, tokens));
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(asc(users.createdAt));
}

export async function getBidNotificationRecipients(auctionId: number, bidderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.selectDistinct({
    token: pushTokens.token,
    language: pushTokens.language,
    titleAr: auctions.titleAr,
    titleEn: auctions.titleEn,
    titleKu: auctions.titleKu,
  }).from(auctions)
    .innerJoin(bids, eq(bids.auctionId, auctions.id))
    .innerJoin(pushTokens, eq(pushTokens.userId, bids.userId))
    .where(and(eq(auctions.id, auctionId), eq(auctions.status, "active"), ne(bids.userId, bidderId)));
}

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function getEndedAuctionWinnerCandidates(db: Database, auctionId?: number) {
  const conditions = [eq(auctions.status, "ended"), eq(auctions.isDemo, false)];
  if (auctionId !== undefined) conditions.push(eq(auctions.id, auctionId));
  const bidRows = await db
    .select({
      auctionId: auctions.id,
      userId: bids.userId,
      amount: bids.amount,
      bidCreatedAt: bids.createdAt,
      bidId: bids.id,
      endsAt: auctions.endsAt,
      titleAr: auctions.titleAr,
      titleEn: auctions.titleEn,
      titleKu: auctions.titleKu,
      currency: auctions.currency,
      category: auctions.category,
      imageKey: auctions.imageKey,
    })
    .from(auctions)
    .innerJoin(bids, eq(bids.auctionId, auctions.id))
    .where(and(...conditions))
    .orderBy(asc(auctions.id), desc(bids.amount), asc(bids.createdAt), asc(bids.id));
  return selectAuctionWinnerCandidates(bidRows);
}

export async function listAuctionWinners() {
  await markExpiredAuctions();
  const db = await getDb();
  if (!db) return [];
  const winners = await getEndedAuctionWinnerCandidates(db);
  if (winners.length === 0) return [];

  const winnerUsers = await db
    .select({ id: users.id, name: users.name, phone: users.phone, address: users.address, governorate: users.governorate })
    .from(users)
    .where(inArray(users.id, winners.map((winner) => winner.userId)));
  const winnerByUserId = new Map(winnerUsers.map((person) => [person.id, person]));

  return winners.map((winner) => {
    const person = winnerByUserId.get(winner.userId);
    return {
      auctionId: winner.auctionId,
      titleAr: winner.titleAr,
      titleEn: winner.titleEn,
      titleKu: winner.titleKu,
      winningAmount: winner.amount,
      currency: winner.currency,
      winnerName: person?.name ?? null,
      phone: person?.phone ?? null,
      address: person?.address ?? null,
      governorate: person?.governorate ?? null,
    };
  });
}

export async function countAdmins() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  return result.length;
}

export async function getAdminSummary() {
  const db = await getDb();
  if (!db) return { totalCount: 0, adminCount: 0, verifiedPhoneCount: 0, withAddressCount: 0 };
  const rows = await db.select({
    totalCount: sql<number>`count(*)`,
    adminCount: sql<number>`sum(case when ${users.role} = 'admin' then 1 else 0 end)`,
    verifiedPhoneCount: sql<number>`sum(case when ${users.phoneVerifiedAt} is not null then 1 else 0 end)`,
    withAddressCount: sql<number>`sum(case when ${users.address} is not null or ${users.governorate} is not null then 1 else 0 end)`,
  }).from(users);
  const row = rows[0];
  return {
    totalCount: Number(row?.totalCount ?? 0),
    adminCount: Number(row?.adminCount ?? 0),
    verifiedPhoneCount: Number(row?.verifiedPhoneCount ?? 0),
    withAddressCount: Number(row?.withAddressCount ?? 0),
  };
}

export async function setUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

type ListingDetails = {
  brand: string;
  model: string;
  condition: "new" | "like_new" | "good" | "fair";
  usagePeriod: string;
  warranty: string;
  accessories: string;
};

export async function createAuctionListing(input: {
  title: string;
  description: string;
  category: "electronics" | "home";
  currency: "IQD" | "USD";
  startingPrice: number;
  purchasePrice?: number;
  durationDays: number;
  startsAt: Date;
  itemDetails: ListingDetails;
  imageKeys: string[];
  sellerOpenId: string;
  sellerUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  if (
    input.imageKeys.length < 5
    || input.imageKeys.length > 10
    || new Set(input.imageKeys).size !== input.imageKeys.length
    || input.imageKeys.some((key) => !isAuctionPhotoKeyOwnedByUser(input.sellerUserId, key))
  ) {
    throw new Error("INVALID_AUCTION_PHOTOS");
  }
  if (!isAllowedAuctionDurationDays(input.durationDays)) throw new Error("INVALID_DURATION");
  if (!isValidAuctionStartTime(input.startsAt)) throw new Error("INVALID_START_TIME");
  const slug = `seller-${randomUUID()}`;
  const price = input.currency === "IQD" ? String(Math.round(input.startingPrice)) : input.startingPrice.toFixed(2);
  const id = await db.transaction(async (tx) => {
    const seller = await tx.select({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt }).from(users).where(eq(users.id, input.sellerUserId)).limit(1).for("update");
    if (!seller[0]?.phone) throw new Error("PHONE_REQUIRED");
    if (isPhoneVerificationRequired() && !seller[0].phoneVerifiedAt) throw new Error("PHONE_NOT_VERIFIED");
    await tx.insert(auctions).values({
      slug,
      isDemo: false,
      titleAr: input.title,
      titleEn: input.title,
      titleKu: input.title,
      descriptionAr: input.description,
      descriptionEn: input.description,
      descriptionKu: input.description,
      category: input.category,
      imageKey: input.imageKeys[0],
      itemDetails: JSON.stringify(input.itemDetails),
      currency: input.currency,
      purchasePrice: input.purchasePrice == null
        ? null
        : input.currency === "IQD" ? String(Math.round(input.purchasePrice)) : input.purchasePrice.toFixed(2),
      startingPrice: price,
      currentPrice: price,
      minIncrement: input.currency === "IQD" ? "5000" : "1.00",
      startsAt: input.startsAt,
      endsAt: new Date(input.startsAt.getTime() + input.durationDays * 24 * 60 * 60 * 1000),
      status: "active",
      sellerOpenId: input.sellerOpenId,
    });
    const created = await tx.select({ id: auctions.id }).from(auctions).where(eq(auctions.slug, slug)).limit(1);
    const auctionId = created[0]?.id;
    if (!auctionId) throw new Error("AUCTION_CREATE_FAILED");
    await tx.insert(auctionGalleryImages).values(input.imageKeys.map((imageKey, position) => ({ auctionId, imageKey, position })));
    return auctionId;
  });
  return { id };
}

export async function updateAuctionListing(input: {
  id: number;
  title: string;
  description: string;
  itemDetails: ListingDetails;
  startingPrice?: number;
  purchasePrice?: number | null;
  currency?: "IQD" | "USD";
  durationDays?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(auctions).where(eq(auctions.id, input.id)).limit(1).for("update");
    const auction = rows[0];
    if (!auction || auction.status !== "active" || auction.endsAt.getTime() <= Date.now()) throw new Error("AUCTION_NOT_EDITABLE");
    const existingBids = await tx.select({ id: bids.id }).from(bids).where(eq(bids.auctionId, input.id)).limit(1);
    const changesTerms = input.startingPrice !== undefined || input.currency !== undefined || input.durationDays !== undefined || input.purchasePrice !== undefined;
    if (existingBids.length > 0 && changesTerms) throw new Error("AUCTION_HAS_BIDS");
    const currency = input.currency ?? auction.currency;
    const startingPrice = input.startingPrice ?? Number(auction.startingPrice);
    if (!Number.isFinite(startingPrice) || startingPrice <= 0 || (currency === "IQD" && !Number.isInteger(startingPrice))) {
      throw new Error("INVALID_AUCTION_PRICE");
    }
    const set: Record<string, unknown> = {
      titleAr: input.title,
      titleEn: input.title,
      titleKu: input.title,
      descriptionAr: input.description,
      descriptionEn: input.description,
      descriptionKu: input.description,
      itemDetails: JSON.stringify(input.itemDetails),
      updatedAt: new Date(),
    };
    if (changesTerms) {
      const price = currency === "IQD" ? String(Math.round(startingPrice)) : startingPrice.toFixed(2);
      set.currency = currency;
      set.startingPrice = price;
      set.currentPrice = price;
      set.minIncrement = currency === "IQD" ? "5000" : "1.00";
      if (input.purchasePrice !== undefined) {
        set.purchasePrice = input.purchasePrice === null
          ? null
          : currency === "IQD" ? String(Math.round(input.purchasePrice)) : input.purchasePrice.toFixed(2);
      }
      if (input.durationDays !== undefined) {
        if (!isAllowedAuctionDurationDays(input.durationDays)) throw new Error("INVALID_DURATION");
        const durationStartsAt = Math.max(Date.now(), auction.startsAt.getTime());
        set.endsAt = new Date(durationStartsAt + input.durationDays * 24 * 60 * 60 * 1000);
      }
    }
    await tx.update(auctions).set(set).where(eq(auctions.id, input.id));
    return { success: true } as const;
  });
}

export async function cancelAuctionListing(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: auctions.id, status: auctions.status, endsAt: auctions.endsAt })
      .from(auctions).where(eq(auctions.id, id)).limit(1).for("update");
    const auction = rows[0];
    if (!auction || auction.status !== "active" || auction.endsAt.getTime() <= Date.now()) throw new Error("AUCTION_NOT_CANCELLABLE");
    await tx.update(auctions).set({ status: "cancelled", updatedAt: new Date() }).where(eq(auctions.id, id));
    return { success: true } as const;
  });
}

function omitSellerOpenId<T extends { sellerOpenId: string | null }>(row: T): Omit<T, "sellerOpenId"> {
  const safe = { ...row };
  Reflect.deleteProperty(safe, "sellerOpenId");
  return safe as Omit<T, "sellerOpenId">;
}

async function ensureDemoAuctions() {
  const db = await getDb();
  if (!db) return;
  const sampleSlugs = ["graphite-smartphone", "wireless-headphones", "home-coffee-machine", "kitchen-island"];
  const existingSamples = await db.select({ slug: auctions.slug, isDemo: auctions.isDemo }).from(auctions).where(inArray(auctions.slug, sampleSlugs)).limit(sampleSlugs.length);
  if (existingSamples.length) {
    if (existingSamples.some((row) => !row.isDemo)) {
      await db.update(auctions).set({ isDemo: true }).where(inArray(auctions.slug, sampleSlugs));
    }
    return;
  }
  const existing = await db.select({ id: auctions.id }).from(auctions).limit(1);
  if (existing.length) return;
  const now = Date.now();
  const daysFromNow = (days: number) => new Date(now + days * 24 * 60 * 60 * 1000);
  await db.insert(auctions).values([
    {
      slug: "graphite-smartphone",
      isDemo: true,
      titleAr: "هاتف ذكي بحالة ممتازة",
      titleEn: "Graphite smartphone · excellent condition",
      titleKu: "مۆبایلی زیرەک بە دۆخی باش",
      descriptionAr: "هاتف ذكي مستعمل بعناية، شاشة نظيفة وبطارية بحالة جيدة.",
      descriptionEn: "A carefully used smartphone with a clean screen and a healthy battery.",
      descriptionKu: "مۆبایلی بە وریایی بەکارهاتوو، شاشە پاک و باتری باشە.",
      category: "electronics",
      imageKey: "gadget",
      currency: "IQD",
      startingPrice: "220000",
      currentPrice: "235000",
      minIncrement: "5000",
      endsAt: daysFromNow(2),
      status: "active",
    },
    {
      slug: "wireless-headphones",
      isDemo: true,
      titleAr: "سماعات لاسلكية عازلة للضوضاء",
      titleEn: "Wireless noise-cancelling headphones",
      titleKu: "گوێگرەوەی بێتەل بۆ کەمکردنەوەی دەنگ",
      descriptionAr: "سماعات مريحة للاستخدام اليومي مع حقيبتها وكابل الشحن.",
      descriptionEn: "Comfortable everyday headphones, including the case and charging cable.",
      descriptionKu: "گوێگرەوەی ئاسوودە بۆ بەکارهێنانی ڕۆژانە لەگەڵ سندوق و کابلی شارژ.",
      category: "electronics",
      imageKey: "headphones",
      currency: "USD",
      startingPrice: "60.00",
      currentPrice: "65.00",
      minIncrement: "1.00",
      endsAt: daysFromNow(1),
      status: "active",
    },
    {
      slug: "home-coffee-machine",
      isDemo: true,
      titleAr: "آلة قهوة منزلية أنيقة",
      titleEn: "Compact home espresso machine",
      titleKu: "ئامێری قاوەی بچووک بۆ ماڵ",
      descriptionAr: "آلة قهوة منزلية سهلة الاستخدام، مناسبة للمطبخ الصغير.",
      descriptionEn: "An easy-to-use home coffee maker that fits a smaller kitchen.",
      descriptionKu: "ئامێری قاوەیەکی ئاسان بۆ ماڵ، گونجاو بۆ چێشتخانەی بچووک.",
      category: "home",
      imageKey: "kitchen",
      currency: "USD",
      startingPrice: "90.00",
      currentPrice: "96.00",
      minIncrement: "2.00",
      endsAt: daysFromNow(3),
      status: "active",
    },
    {
      slug: "kitchen-island",
      isDemo: true,
      titleAr: "طاولة مطبخ جانبية قابلة للتمديد",
      titleEn: "Extendable kitchen island table",
      titleKu: "مێزی چێشتخانەی درێژکراوە",
      descriptionAr: "طاولة عملية للمطبخ مع سطح واسع ومساحة تخزين إضافية.",
      descriptionEn: "A practical kitchen table with a broad surface and extra storage.",
      descriptionKu: "مێزێکی بەسوود بۆ چێشتخانە، ڕووبەری فراوان و شوێنی زیادەی هەڵگرتن.",
      category: "home",
      imageKey: "furniture",
      currency: "IQD",
      startingPrice: "175000",
      currentPrice: "185000",
      minIncrement: "5000",
      endsAt: daysFromNow(4),
      status: "active",
    },
  ]);
}

async function markExpiredAuctions() {
  const db = await getDb();
  if (!db) return;
  await db.update(auctions).set({ status: "ended" }).where(and(eq(auctions.status, "active"), lte(auctions.endsAt, new Date())));
}

export async function listAuctions(input: { category?: "electronics" | "home"; search?: string }) {
  await ensureDemoAuctions();
  await markExpiredAuctions();
  const db = await getDb();
  if (!db) return [];
  const filters = [];
  if (input.category) filters.push(eq(auctions.category, input.category));
  if (input.search?.trim()) {
    const term = `%${input.search.trim()}%`;
    filters.push(or(like(auctions.titleAr, term), like(auctions.titleEn, term), like(auctions.titleKu, term)));
  }
  filters.push(eq(auctions.status, "active"));
  filters.push(gt(auctions.endsAt, new Date()));
  const rows = await db.select().from(auctions).where(and(...filters)).orderBy(asc(auctions.startsAt), asc(auctions.endsAt));
  return rows.map(omitSellerOpenId);
}

export async function getAuctionDetails(id: number) {
  await markExpiredAuctions();
  const db = await getDb();
  if (!db) return null;
  const auctionRows = await db.select().from(auctions).where(eq(auctions.id, id)).limit(1);
  const auction = auctionRows[0];
  if (!auction) return null;
  const recentBids = await db
    .select({ id: bids.id, amount: bids.amount, createdAt: bids.createdAt, bidderName: users.name })
    .from(bids)
    .innerJoin(users, eq(bids.userId, users.id))
    .where(eq(bids.auctionId, id))
    .orderBy(desc(bids.createdAt), desc(bids.id))
    .limit(12);
  const galleryRows = await db.select({ imageKey: auctionGalleryImages.imageKey })
    .from(auctionGalleryImages).where(eq(auctionGalleryImages.auctionId, id)).orderBy(asc(auctionGalleryImages.position));
  const images = galleryRows.length > 0 ? galleryRows.map((row) => row.imageKey) : [auction.imageKey];
  return { auction: omitSellerOpenId(auction), recentBids, images };
}

export async function placeAuctionBid(input: { auctionId: number; userId: number; amount: number }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(auctions).where(eq(auctions.id, input.auctionId)).limit(1).for("update");
    const auction = rows[0];
    if (!auction) throw new Error("AUCTION_NOT_FOUND");
    const bidAt = new Date();
    if (auction.status !== "active" || auction.endsAt.getTime() <= bidAt.getTime()) throw new Error("AUCTION_CLOSED");
    if (auction.startsAt.getTime() > bidAt.getTime()) throw new Error("AUCTION_NOT_STARTED");
    const bidder = await tx.select({ openId: users.openId, phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt }).from(users).where(eq(users.id, input.userId)).limit(1).for("update");
    if (!bidder[0]?.phone) throw new Error("PHONE_REQUIRED");
    if (isPhoneVerificationRequired() && !bidder[0].phoneVerifiedAt) throw new Error("PHONE_NOT_VERIFIED");
    if (auction.sellerOpenId) {
      if (bidder[0]?.openId === auction.sellerOpenId) throw new Error("SELLER_CANNOT_BID");
    }
    const current = Number(auction.currentPrice);
    const increment = Number(auction.minIncrement);
    if (auction.currency === "IQD" && !Number.isInteger(input.amount)) throw new Error("INVALID_AMOUNT");
    if (!Number.isFinite(input.amount) || input.amount < current + increment - 0.000001) throw new Error("BID_TOO_LOW");
    const amount = auction.currency === "IQD" ? String(Math.round(input.amount)) : input.amount.toFixed(2);
    const extendedEndsAt = extendAuctionEndForLateBid(auction.endsAt, bidAt);
    const endsAt = extendedEndsAt ?? auction.endsAt;
    await tx.insert(bids).values({ auctionId: auction.id, userId: input.userId, amount });
    await tx.update(auctions).set({ currentPrice: amount, endsAt, updatedAt: bidAt }).where(eq(auctions.id, auction.id));
    return { amount, currency: auction.currency, endsAt, extended: extendedEndsAt !== null };
  });
}

export async function listMyBids(userId: number) {
  await markExpiredAuctions();
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: bids.id,
      amount: bids.amount,
      bidCreatedAt: bids.createdAt,
      auction: auctions,
    })
    .from(bids)
    .innerJoin(auctions, eq(bids.auctionId, auctions.id))
    .where(eq(bids.userId, userId))
    .orderBy(desc(bids.createdAt), desc(bids.id));
  const auctionIds = Array.from(new Set(rows.map((row) => row.auction.id)));
  if (auctionIds.length === 0) return [];
  const latestBidEvents = db.$with("latest_bid_events").as(
    db.select({
      id: bids.id,
      auctionId: bids.auctionId,
      userId: bids.userId,
      amount: bids.amount,
      createdAt: bids.createdAt,
      bidderName: users.name,
      rowNumber: sql<number>`row_number() over (partition by ${bids.auctionId} order by ${bids.createdAt} desc, ${bids.id} desc)`.as("rowNumber"),
    }).from(bids)
      .innerJoin(users, eq(bids.userId, users.id))
      .where(inArray(bids.auctionId, auctionIds)),
  );
  const latestRows = await db.with(latestBidEvents).select({
    id: latestBidEvents.id,
    auctionId: latestBidEvents.auctionId,
    userId: latestBidEvents.userId,
    amount: latestBidEvents.amount,
    createdAt: latestBidEvents.createdAt,
    bidderName: latestBidEvents.bidderName,
  }).from(latestBidEvents).where(eq(latestBidEvents.rowNumber, 1));
  const latestByAuction = new Map(latestRows.map((event) => [event.auctionId, event]));
  const [winners, confirmations] = await Promise.all([
    getEndedAuctionWinnerCandidates(db),
    db.select({ auctionId: deliveryConfirmations.auctionId, confirmedAt: deliveryConfirmations.confirmedAt })
      .from(deliveryConfirmations).where(inArray(deliveryConfirmations.auctionId, auctionIds)),
  ]);
  const winnerByAuctionId = new Map(winners.map((winner) => [winner.auctionId, winner.userId]));
  const confirmationByAuctionId = new Map(confirmations.map((confirmation) => [confirmation.auctionId, confirmation.confirmedAt]));
  return rows.map((row) => {
    const latest = latestByAuction.get(row.auction.id);
    return {
      ...row,
      auction: omitSellerOpenId(row.auction),
      isWinner: winnerByAuctionId.get(row.auction.id) === userId,
      deliveryConfirmedAt: confirmationByAuctionId.get(row.auction.id) ?? null,
      latestBid: latest ? {
        id: latest.id,
        amount: latest.amount,
        createdAt: latest.createdAt,
        bidderName: latest.bidderName,
        isMine: latest.userId === userId,
      } : null,
    };
  });
}


export async function confirmAuctionDelivery(userId: number, auctionId: number) {
  await markExpiredAuctions();
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.transaction(async (tx) => {
    const auctionRows = await tx.select({ id: auctions.id, isDemo: auctions.isDemo, status: auctions.status, endsAt: auctions.endsAt })
      .from(auctions).where(eq(auctions.id, auctionId)).limit(1).for("update");
    const auction = auctionRows[0];
    if (!auction || auction.isDemo || auction.status !== "ended" || auction.endsAt.getTime() > Date.now()) {
      throw new Error("DELIVERY_NOT_ELIGIBLE");
    }
    const winnerRows = await tx.select({ userId: bids.userId })
      .from(bids).where(eq(bids.auctionId, auctionId))
      .orderBy(desc(bids.amount), asc(bids.createdAt), asc(bids.id)).limit(1);
    if (winnerRows[0]?.userId !== userId) throw new Error("NOT_AUCTION_WINNER");
    const existingRows = await tx.select({ userId: deliveryConfirmations.userId, confirmedAt: deliveryConfirmations.confirmedAt })
      .from(deliveryConfirmations).where(eq(deliveryConfirmations.auctionId, auctionId)).limit(1);
    if (existingRows[0]) {
      if (existingRows[0].userId !== userId) throw new Error("DELIVERY_CONFIRMATION_CONFLICT");
      return { confirmedAt: existingRows[0].confirmedAt, alreadyConfirmed: true } as const;
    }
    const confirmedAt = new Date();
    await tx.insert(deliveryConfirmations).values({ auctionId, userId, confirmedAt });
    return { confirmedAt, alreadyConfirmed: false } as const;
  });
}

export async function getAdminDeliveryAlertDetails(auctionId: number) {
  const db = await getDb();
  if (!db) return [];
  const winner = (await getEndedAuctionWinnerCandidates(db, auctionId))[0];
  if (!winner) return [];
  const [auctionRows, userRows, adminTokens] = await Promise.all([
    db.select({ titleAr: auctions.titleAr, titleEn: auctions.titleEn, titleKu: auctions.titleKu })
      .from(auctions).where(eq(auctions.id, auctionId)).limit(1),
    db.select({ name: users.name }).from(users).where(eq(users.id, winner.userId)).limit(1),
    db.select({ token: pushTokens.token, language: pushTokens.language })
      .from(users).innerJoin(pushTokens, eq(pushTokens.userId, users.id)).where(eq(users.role, "admin")),
  ]);
  const auction = auctionRows[0];
  if (!auction) return [];
  return adminTokens.map((admin) => ({
    ...admin,
    ...auction,
    winnerName: userRows[0]?.name ?? null,
  }));
}

export async function listAuctionFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ auction: auctions })
    .from(auctionFavorites)
    .innerJoin(auctions, eq(auctionFavorites.auctionId, auctions.id))
    .where(eq(auctionFavorites.userId, userId))
    .orderBy(desc(auctionFavorites.createdAt));
  return rows.map((row) => omitSellerOpenId(row.auction));
}

export async function setAuctionFavorite(input: { userId: number; auctionId: number; favorite: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  if (input.favorite) {
    await db.insert(auctionFavorites).values({ userId: input.userId, auctionId: input.auctionId })
      .onDuplicateKeyUpdate({ set: { createdAt: new Date() } });
  } else {
    await db.delete(auctionFavorites).where(and(
      eq(auctionFavorites.userId, input.userId),
      eq(auctionFavorites.auctionId, input.auctionId),
    ));
  }
  return { favorite: input.favorite } as const;
}

export async function listMyReturnProducts(userId: number) {
  await markExpiredAuctions();
  const db = await getDb();
  if (!db) return [];
  const winners = (await getEndedAuctionWinnerCandidates(db)).filter((winner) => winner.userId === userId);
  if (winners.length === 0) return [];
  const confirmations = await db.select({ auctionId: deliveryConfirmations.auctionId, confirmedAt: deliveryConfirmations.confirmedAt })
    .from(deliveryConfirmations).where(inArray(deliveryConfirmations.auctionId, winners.map((winner) => winner.auctionId)));
  const confirmedAuctionIds = new Set(confirmations.map((confirmation) => confirmation.auctionId));
  const eligibleWinners = winners.filter((winner) => confirmedAuctionIds.has(winner.auctionId));
  if (eligibleWinners.length === 0) return [];
  const requests = await db.select({
    id: returnRequests.id,
    auctionId: returnRequests.auctionId,
    reason: returnRequests.reason,
    imageKey: returnRequests.imageKey,
    videoKey: returnRequests.videoKey,
    status: returnRequests.status,
    adminNote: returnRequests.adminNote,
    createdAt: returnRequests.createdAt,
    updatedAt: returnRequests.updatedAt,
  }).from(returnRequests).where(eq(returnRequests.userId, userId));
  const requestByAuctionId = new Map(requests.map((request) => [request.auctionId, request]));
  const confirmationByAuctionId = new Map(confirmations.map((confirmation) => [confirmation.auctionId, confirmation.confirmedAt]));
  return eligibleWinners.map((winner) => ({
    auctionId: winner.auctionId,
    titleAr: winner.titleAr,
    titleEn: winner.titleEn,
    titleKu: winner.titleKu,
    winningAmount: winner.amount,
    currency: winner.currency,
    category: winner.category,
    imageKey: winner.imageKey,
    deliveryConfirmedAt: confirmationByAuctionId.get(winner.auctionId) ?? null,
    request: requestByAuctionId.get(winner.auctionId) ?? null,
  }));
}

export async function isUserAuctionWinner(userId: number, auctionId: number) {
  await markExpiredAuctions();
  const db = await getDb();
  if (!db) return false;
  const winners = await getEndedAuctionWinnerCandidates(db, auctionId);
  return winners[0]?.userId === userId;
}

export async function isUserReturnEligible(userId: number, auctionId: number) {
  if (!(await isUserAuctionWinner(userId, auctionId))) return false;
  const db = await getDb();
  if (!db) return false;
  const confirmations = await db.select({ userId: deliveryConfirmations.userId })
    .from(deliveryConfirmations).where(eq(deliveryConfirmations.auctionId, auctionId)).limit(1);
  return confirmations[0]?.userId === userId;
}

export async function createReturnRequest(input: {
  userId: number;
  auctionId: number;
  reason: string;
  imageKey: string;
  videoKey: string;
}) {
  await markExpiredAuctions();
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  if (!isReturnEvidenceKeyOwnedByUser(input.userId, "image", input.imageKey) || !isReturnEvidenceKeyOwnedByUser(input.userId, "video", input.videoKey)) {
    throw new Error("INVALID_EVIDENCE_KEY");
  }
  return db.transaction(async (tx) => {
    const auctionRows = await tx.select({ id: auctions.id, isDemo: auctions.isDemo, status: auctions.status, endsAt: auctions.endsAt })
      .from(auctions).where(eq(auctions.id, input.auctionId)).limit(1).for("update");
    const auction = auctionRows[0];
    if (!auction || auction.isDemo || auction.status !== "ended" || auction.endsAt.getTime() > Date.now()) {
      throw new Error("RETURN_NOT_ELIGIBLE");
    }
    const confirmationRows = await tx.select({ userId: deliveryConfirmations.userId })
      .from(deliveryConfirmations).where(eq(deliveryConfirmations.auctionId, input.auctionId)).limit(1);
    if (confirmationRows[0]?.userId !== input.userId) throw new Error("DELIVERY_NOT_CONFIRMED");
    const bidRows = await tx.select({
      auctionId: auctions.id,
      userId: bids.userId,
      amount: bids.amount,
      bidCreatedAt: bids.createdAt,
      bidId: bids.id,
      endsAt: auctions.endsAt,
      titleAr: auctions.titleAr,
      titleEn: auctions.titleEn,
      titleKu: auctions.titleKu,
      currency: auctions.currency,
      category: auctions.category,
      imageKey: auctions.imageKey,
    }).from(auctions)
      .innerJoin(bids, eq(bids.auctionId, auctions.id))
      .where(and(eq(auctions.id, input.auctionId), eq(auctions.status, "ended"), eq(auctions.isDemo, false)))
      .orderBy(desc(bids.amount), asc(bids.createdAt), asc(bids.id));
    const winner = selectAuctionWinnerCandidates(bidRows)[0];
    if (!winner || winner.userId !== input.userId) throw new Error("RETURN_NOT_ELIGIBLE");

    const existingRows = await tx.select({ id: returnRequests.id, status: returnRequests.status })
      .from(returnRequests)
      .where(and(eq(returnRequests.userId, input.userId), eq(returnRequests.auctionId, input.auctionId)))
      .limit(1).for("update");
    const existing = existingRows[0];
    if (existing && existing.status !== "rejected") throw new Error("RETURN_ALREADY_SUBMITTED");
    const values = {
      reason: input.reason,
      imageKey: input.imageKey,
      videoKey: input.videoKey,
      status: "pending" as const,
      adminNote: null,
      updatedAt: new Date(),
    };
    if (existing) {
      await tx.update(returnRequests).set(values).where(eq(returnRequests.id, existing.id));
      return { id: existing.id, status: "pending" as const };
    }
    await tx.insert(returnRequests).values({ ...values, userId: input.userId, auctionId: input.auctionId });
    const createdRows = await tx.select({ id: returnRequests.id })
      .from(returnRequests)
      .where(and(eq(returnRequests.userId, input.userId), eq(returnRequests.auctionId, input.auctionId)))
      .limit(1);
    if (!createdRows[0]) throw new Error("RETURN_CREATE_FAILED");
    return { id: createdRows[0].id, status: "pending" as const };
  });
}

export async function listAdminReturnRequests() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: returnRequests.id,
    userId: returnRequests.userId,
    auctionId: returnRequests.auctionId,
    reason: returnRequests.reason,
    imageKey: returnRequests.imageKey,
    videoKey: returnRequests.videoKey,
    status: returnRequests.status,
    adminNote: returnRequests.adminNote,
    createdAt: returnRequests.createdAt,
    updatedAt: returnRequests.updatedAt,
    userName: users.name,
    phone: users.phone,
    titleAr: auctions.titleAr,
    titleEn: auctions.titleEn,
    titleKu: auctions.titleKu,
    currency: auctions.currency,
  }).from(returnRequests)
    .innerJoin(users, eq(returnRequests.userId, users.id))
    .innerJoin(auctions, eq(returnRequests.auctionId, auctions.id))
    .orderBy(desc(returnRequests.createdAt));
  const winners = await getEndedAuctionWinnerCandidates(db);
  const amountByAuction = new Map(winners.map((winner) => [winner.auctionId, winner.amount]));
  return rows.map((row) => ({ ...row, winningAmount: amountByAuction.get(row.auctionId) ?? null }));
}

export async function getAdminReturnAlertDetails(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  const requestRows = await db.select({
    auctionId: auctions.id,
    titleAr: auctions.titleAr,
    titleEn: auctions.titleEn,
    titleKu: auctions.titleKu,
    requesterName: users.name,
  }).from(returnRequests)
    .innerJoin(auctions, eq(returnRequests.auctionId, auctions.id))
    .innerJoin(users, eq(returnRequests.userId, users.id))
    .where(and(eq(returnRequests.id, requestId), eq(returnRequests.status, "pending")))
    .limit(1);
  const request = requestRows[0];
  if (!request) return [];
  const adminTokens = await db.select({ token: pushTokens.token, language: pushTokens.language })
    .from(users).innerJoin(pushTokens, eq(pushTokens.userId, users.id))
    .where(eq(users.role, "admin"));
  return adminTokens.map((admin) => ({ ...admin, ...request }));
}

export async function updateReturnRequest(input: { id: number; status: "approved" | "rejected"; adminNote: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const existing = await db.select({ id: returnRequests.id }).from(returnRequests).where(eq(returnRequests.id, input.id)).limit(1);
  if (!existing[0]) throw new Error("RETURN_REQUEST_NOT_FOUND");
  await db.update(returnRequests).set({ status: input.status, adminNote: input.adminNote, updatedAt: new Date() })
    .where(eq(returnRequests.id, input.id));
  return { success: true } as const;
}

export async function getMySupportMessages(userId: number) {
  const db = await getDb();
  if (!db) return { conversationId: null, messages: [] };
  const conversations = await db.select({ id: supportConversations.id })
    .from(supportConversations).where(eq(supportConversations.userId, userId)).limit(1);
  const conversationId = conversations[0]?.id;
  if (!conversationId) return { conversationId: null, messages: [] };
  const rows = await db.select({
    id: supportMessages.id,
    senderUserId: supportMessages.senderUserId,
    senderRole: supportMessages.senderRole,
    body: supportMessages.body,
    createdAt: supportMessages.createdAt,
    senderName: users.name,
  }).from(supportMessages)
    .innerJoin(users, eq(supportMessages.senderUserId, users.id))
    .where(eq(supportMessages.conversationId, conversationId))
    .orderBy(desc(supportMessages.createdAt), desc(supportMessages.id))
    .limit(100);
  return { conversationId, messages: rows.reverse() };
}

export async function sendMySupportMessage(userId: number, body: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.transaction(async (tx) => {
    const now = new Date();
    await tx.insert(supportConversations).values({ userId, lastMessageAt: now })
      .onDuplicateKeyUpdate({ set: { updatedAt: now } });
    const conversations = await tx.select({ id: supportConversations.id })
      .from(supportConversations).where(eq(supportConversations.userId, userId)).limit(1);
    const conversationId = conversations[0]?.id;
    if (!conversationId) throw new Error("SUPPORT_CONVERSATION_CREATE_FAILED");
    await tx.insert(supportMessages).values({ conversationId, senderUserId: userId, senderRole: "user", body });
    await tx.update(supportConversations).set({ lastMessageAt: now, updatedAt: now }).where(eq(supportConversations.id, conversationId));
    return { conversationId };
  });
}

export async function listAdminSupportConversations() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: supportConversations.id,
    userId: supportConversations.userId,
    userName: users.name,
    phone: users.phone,
    email: users.email,
    lastMessageAt: supportConversations.lastMessageAt,
  }).from(supportConversations)
    .innerJoin(users, eq(supportConversations.userId, users.id))
    .orderBy(desc(supportConversations.lastMessageAt))
    .limit(100);
}

export async function getAdminSupportMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return null;
  const conversations = await db.select({ id: supportConversations.id })
    .from(supportConversations).where(eq(supportConversations.id, conversationId)).limit(1);
  if (!conversations[0]) return null;
  const rows = await db.select({
    id: supportMessages.id,
    senderUserId: supportMessages.senderUserId,
    senderRole: supportMessages.senderRole,
    body: supportMessages.body,
    createdAt: supportMessages.createdAt,
    senderName: users.name,
  }).from(supportMessages)
    .innerJoin(users, eq(supportMessages.senderUserId, users.id))
    .where(eq(supportMessages.conversationId, conversationId))
    .orderBy(desc(supportMessages.createdAt), desc(supportMessages.id))
    .limit(100);
  return rows.reverse();
}

export async function sendAdminSupportMessage(input: { conversationId: number; adminUserId: number; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.transaction(async (tx) => {
    const conversations = await tx.select({ id: supportConversations.id })
      .from(supportConversations).where(eq(supportConversations.id, input.conversationId)).limit(1).for("update");
    if (!conversations[0]) throw new Error("SUPPORT_CONVERSATION_NOT_FOUND");
    const now = new Date();
    await tx.insert(supportMessages).values({
      conversationId: input.conversationId,
      senderUserId: input.adminUserId,
      senderRole: "admin",
      body: input.body,
    });
    await tx.update(supportConversations).set({ lastMessageAt: now, updatedAt: now })
      .where(eq(supportConversations.id, input.conversationId));
    return { success: true } as const;
  });
}


export async function getReturnRequestMediaKeys(requestId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({
    userId: returnRequests.userId,
    imageKey: returnRequests.imageKey,
    videoKey: returnRequests.videoKey,
  }).from(returnRequests).where(eq(returnRequests.id, requestId)).limit(1);
  return rows[0] ?? null;
}


export async function getUsdToIqdRate() {
  const db = await getDb();
  if (!db) return { usdToIqd: 1310, updatedAt: null };
  const rows = await db.select({ usdToIqd: currencySettings.usdToIqd, updatedAt: currencySettings.updatedAt })
    .from(currencySettings).where(eq(currencySettings.id, 1)).limit(1);
  return rows[0] ?? { usdToIqd: 1310, updatedAt: null };
}

export async function setUsdToIqdRate(usdToIqd: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(currencySettings).values({ id: 1, usdToIqd })
    .onDuplicateKeyUpdate({ set: { usdToIqd, updatedAt: new Date() } });
  return { usdToIqd } as const;
}
export async function getDeliveryFee() {
  const fallback = { amount: 2, currency: "USD" as "IQD" | "USD", updatedAt: null as Date | null };
  const db = await getDb();
  if (!db) return fallback;
  const rows = await db.select({
    amount: currencySettings.deliveryFeeAmount,
    currency: currencySettings.deliveryFeeCurrency,
    updatedAt: currencySettings.updatedAt,
  }).from(currencySettings).where(eq(currencySettings.id, 1)).limit(1);
  const row = rows[0];
  if (!row) return fallback;
  return { amount: Number(row.amount), currency: row.currency, updatedAt: row.updatedAt as Date | null };
}
export async function setDeliveryFee(amount: number, currency: "IQD" | "USD") {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const stored = amount.toFixed(2);
  await db.insert(currencySettings).values({ id: 1, deliveryFeeAmount: stored, deliveryFeeCurrency: currency })
    .onDuplicateKeyUpdate({ set: { deliveryFeeAmount: stored, deliveryFeeCurrency: currency, updatedAt: new Date() } });
  return { amount, currency } as const;
}

export async function listActivePromotionalAds() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: promotionalAds.id, imageKey: promotionalAds.imageKey, targetUrl: promotionalAds.targetUrl })
    .from(promotionalAds).where(eq(promotionalAds.isActive, true)).orderBy(asc(promotionalAds.id));
}

export async function listAdminPromotionalAds() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: promotionalAds.id,
    imageKey: promotionalAds.imageKey,
    targetUrl: promotionalAds.targetUrl,
    isActive: promotionalAds.isActive,
    createdAt: promotionalAds.createdAt,
  }).from(promotionalAds).orderBy(desc(promotionalAds.id));
}

export async function createPromotionalAd(input: { imageKey: string; targetUrl: string; createdBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(promotionalAds).values({ ...input, isActive: true });
  const rows = await db.select({ id: promotionalAds.id }).from(promotionalAds)
    .where(eq(promotionalAds.imageKey, input.imageKey)).limit(1);
  if (!rows[0]) throw new Error("PROMOTIONAL_AD_CREATE_FAILED");
  return { id: rows[0].id } as const;
}

export async function setPromotionalAdActive(input: { id: number; isActive: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db.select({ id: promotionalAds.id }).from(promotionalAds)
    .where(eq(promotionalAds.id, input.id)).limit(1);
  if (!rows[0]) throw new Error("PROMOTIONAL_AD_NOT_FOUND");
  await db.update(promotionalAds).set({ isActive: input.isActive, updatedAt: new Date() })
    .where(eq(promotionalAds.id, input.id));
  return { success: true } as const;
}
