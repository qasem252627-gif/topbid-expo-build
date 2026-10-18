import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 128 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  phone: varchar("phone", { length: 32 }),
  phoneVerifiedAt: timestamp("phoneVerifiedAt"),
  address: text("address"),
  governorate: varchar("governorate", { length: 32 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const auctions = mysqlTable("auctions", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  isDemo: boolean("isDemo").default(false).notNull(),
  titleAr: varchar("titleAr", { length: 180 }).notNull(),
  titleEn: varchar("titleEn", { length: 180 }).notNull(),
  titleKu: varchar("titleKu", { length: 180 }).notNull(),
  descriptionAr: text("descriptionAr").notNull(),
  descriptionEn: text("descriptionEn").notNull(),
  descriptionKu: text("descriptionKu").notNull(),
  category: mysqlEnum("category", ["electronics", "home"]).notNull(),
  imageKey: varchar("imageKey", { length: 80 }).notNull(),
  itemDetails: text("itemDetails"),
  currency: mysqlEnum("currency", ["IQD", "USD"]).notNull(),
  purchasePrice: decimal("purchasePrice", { precision: 14, scale: 2 }),
  startingPrice: decimal("startingPrice", { precision: 14, scale: 2 }).notNull(),
  currentPrice: decimal("currentPrice", { precision: 14, scale: 2 }).notNull(),
  minIncrement: decimal("minIncrement", { precision: 12, scale: 2 }).notNull(),
  startsAt: timestamp("startsAt").defaultNow().notNull(),
  endsAt: timestamp("endsAt").notNull(),
  status: mysqlEnum("status", ["active", "ended", "cancelled"]).default("active").notNull(),
  sellerOpenId: varchar("sellerOpenId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const bids = mysqlTable("bids", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  auctionUserIdx: index("bids_auction_user_idx").on(table.auctionId, table.userId),
}));

export const auctionGalleryImages = mysqlTable("auctionGalleryImages", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull().references(() => auctions.id, { onDelete: "cascade" }),
  imageKey: varchar("imageKey", { length: 255 }).notNull(),
  position: int("position").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  auctionPositionUnique: uniqueIndex("auctionGalleryImages_auction_position_uq").on(table.auctionId, table.position),
  auctionIdIdx: index("auctionGalleryImages_auctionId_idx").on(table.auctionId),
}));

export const pushTokens = mysqlTable("userPushTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  language: mysqlEnum("language", ["ar", "en", "ku"]).default("ar").notNull(),
  platform: mysqlEnum("platform", ["android", "ios"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userPushTokens_userId_idx").on(table.userId),
}));

export const auctionFavorites = mysqlTable("auctionFavorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  auctionId: int("auctionId").notNull().references(() => auctions.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ownerAuctionUnique: uniqueIndex("auctionFavorites_owner_auction_uq").on(table.userId, table.auctionId),
  userIdIdx: index("auctionFavorites_userId_idx").on(table.userId),
}));

export const returnRequests = mysqlTable("returnRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  auctionId: int("auctionId").notNull().references(() => auctions.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  imageKey: varchar("imageKey", { length: 255 }).notNull(),
  videoKey: varchar("videoKey", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ownerAuctionUnique: uniqueIndex("returnRequests_owner_auction_uq").on(table.userId, table.auctionId),
  statusCreatedIdx: index("returnRequests_status_created_idx").on(table.status, table.createdAt),
}));

export const deliveryConfirmations = mysqlTable("deliveryConfirmations", {
  auctionId: int("auctionId").primaryKey().references(() => auctions.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  confirmedAt: timestamp("confirmedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("deliveryConfirmations_userId_idx").on(table.userId),
}));

// Retained for backwards-compatible schema history; Firebase now owns OTP challenges and this table is no longer read or written.
export const phoneOtpChallenges = mysqlTable("phoneOtpChallenges", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  codeHash: varchar("codeHash", { length: 64 }).notNull(),
  attempts: int("attempts").default(0).notNull(),
  sentCount: int("sentCount").default(1).notNull(),
  windowStartedAt: timestamp("windowStartedAt").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  resendAfter: timestamp("resendAfter").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const verifiedPhoneNumbers = mysqlTable("verifiedPhoneNumbers", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  verifiedAt: timestamp("verifiedAt").defaultNow().notNull(),
});

export const supportConversations = mysqlTable("supportConversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ownerUnique: uniqueIndex("supportConversations_userId_uq").on(table.userId),
  lastMessageIdx: index("supportConversations_lastMessage_idx").on(table.lastMessageAt),
}));

export const supportMessages = mysqlTable("supportMessages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => supportConversations.id, { onDelete: "cascade" }),
  senderUserId: int("senderUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  senderRole: mysqlEnum("senderRole", ["user", "admin"]).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  conversationCreatedIdx: index("supportMessages_conversation_created_idx").on(table.conversationId, table.createdAt),
}));

export const currencySettings = mysqlTable("currencySettings", {
  id: int("id").primaryKey(),
  usdToIqd: int("usdToIqd").default(1310).notNull(),
  deliveryFeeAmount: decimal("deliveryFeeAmount", { precision: 12, scale: 2 }).default("2.00").notNull(),
  deliveryFeeCurrency: mysqlEnum("deliveryFeeCurrency", ["IQD", "USD"]).default("USD").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const promotionalAds = mysqlTable("promotionalAds", {
  id: int("id").autoincrement().primaryKey(),
  imageKey: varchar("imageKey", { length: 255 }).notNull(),
  targetUrl: varchar("targetUrl", { length: 2048 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  activeOrderIdx: index("promotionalAds_active_id_idx").on(table.isActive, table.id),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Auction = typeof auctions.$inferSelect;
export type Bid = typeof bids.$inferSelect;
export type PushToken = typeof pushTokens.$inferSelect;
export type AuctionFavorite = typeof auctionFavorites.$inferSelect;
export type ReturnRequest = typeof returnRequests.$inferSelect;
export type SupportConversation = typeof supportConversations.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type AuctionGalleryImage = typeof auctionGalleryImages.$inferSelect;
export type PhoneOtpChallenge = typeof phoneOtpChallenges.$inferSelect;
export type VerifiedPhoneNumber = typeof verifiedPhoneNumbers.$inferSelect;
export type DeliveryConfirmation = typeof deliveryConfirmations.$inferSelect;
