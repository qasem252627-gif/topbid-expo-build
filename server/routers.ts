import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isAllowedAuctionDurationDays, isValidAuctionStartTime } from "../lib/auction-duration";
import { cancelAuctionListing, confirmAuctionDelivery, countAdmins, createAuctionListing, createPromotionalAd, createReturnRequest, getAdminSummary, getAdminSupportMessages, getAuctionDetails, getDeliveryFee, getMySupportMessages, getReturnRequestMediaKeys, getUsdToIqdRate, getUserById, isUserReturnEligible, listActivePromotionalAds, listAdminPromotionalAds, listAdminReturnRequests, listAdminSupportConversations, listAuctionFavorites, listAuctionWinners, listAuctions, listMyBids, listMyReturnProducts, listUsers, placeAuctionBid, registerUserPushToken, removeUserPushTokens, sendAdminSupportMessage, sendMySupportMessage, setAuctionFavorite, setDeliveryFee, setPromotionalAdActive, setUsdToIqdRate, setUserRole, updateAuctionListing, updateReturnRequest, updateUserAddress, updateUserProfile } from "./db";
import { isValidDeliveryFee } from "../lib/delivery-fee";
import { GOVERNORATE_CODES } from "../lib/iraq-governorates";
import { AuctionImageError, prepareAuctionPhotoUpload, uploadPromotionalAdImage, verifyUploadedAuctionPhoto } from "./auction-images";
import { prepareReturnEvidenceUpload } from "./return-evidence";
import { isReturnMediaMimeAllowed, isReturnMediaSizeAllowed, RETURN_IMAGE_MIME_TYPES, RETURN_VIDEO_MIME_TYPES } from "../lib/return-media";
import { normalizePhoneNumber } from "../lib/phone-number";
import { confirmFirebasePhoneVerification, prepareFirebasePhoneVerification } from "./firebase-phone-verification";
import { isFirebasePhoneVerificationAvailable, isPhoneVerificationRequired } from "./firebase-phone-config";
import { storageGetSignedUrl } from "./storage";
import { sendAdminDeliveryConfirmedPush, sendAdminReturnRequestPush, sendBidPushNotifications } from "./notifications";
import { getSessionCookieName, getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";

const categorySchema = z.enum(["electronics", "home"]);
const roleSchema = z.enum(["user", "admin"]);
const conditionSchema = z.enum(["new", "like_new", "good", "fair"]);
const phoneSchema = z.string().trim().min(7).max(32);

function assertPhoneReady(user: { phone: string | null; phoneVerifiedAt: Date | null }) {
  if (!user.phone) throw new TRPCError({ code: "BAD_REQUEST", message: "PHONE_REQUIRED" });
  if (isPhoneVerificationRequired() && !user.phoneVerifiedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "PHONE_NOT_VERIFIED" });
  }
}

export const appRouter = router({
  system: systemRouter,
  settings: router({
    exchangeRate: publicProcedure.query(() => getUsdToIqdRate()),
    updateExchangeRate: adminProcedure
      .input(z.number().int().min(1).max(100_000))
      .mutation(({ input }) => setUsdToIqdRate(input)),
    deliveryFee: publicProcedure.query(() => getDeliveryFee()),
    updateDeliveryFee: adminProcedure
      .input(z.object({ amount: z.number().min(0), currency: z.enum(["IQD", "USD"]) }))
      .mutation(({ input }) => {
        if (!isValidDeliveryFee(input.amount, input.currency)) throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_DELIVERY_FEE" });
        return setDeliveryFee(input.amount, input.currency);
      }),
  }),
  ads: router({
    list: publicProcedure.query(() => listActivePromotionalAds()),
    adminList: adminProcedure.query(() => listAdminPromotionalAds()),
    create: adminProcedure
      .input(z.object({
        targetUrl: z.string().trim().min(1).max(2048).url().refine((value) => {
          try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
        }, { message: "INVALID_AD_URL" }),
        photo: z.object({
          base64: z.string().min(1).max(7_000_000),
          mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        let imageKey: string;
        try {
          imageKey = await uploadPromotionalAdImage(input.photo);
        } catch (error) {
          if (error instanceof AuctionImageError && error.code !== "UPLOAD_FAILED") {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.code });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AD_IMAGE_UPLOAD_FAILED" });
        }
        try {
          return await createPromotionalAd({ imageKey, targetUrl: input.targetUrl, createdBy: ctx.user.id });
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AD_CREATE_FAILED" });
        }
      }),
    setActive: adminProcedure
      .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        try { return await setPromotionalAdActive(input); }
        catch { throw new TRPCError({ code: "NOT_FOUND", message: "PROMOTIONAL_AD_NOT_FOUND" }); }
      }),
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    phoneVerificationStatus: publicProcedure.query(() => ({
      required: isPhoneVerificationRequired(),
      smsAvailable: isFirebasePhoneVerificationAvailable(),
    })),
    updateProfile: protectedProcedure
      .input(z.object({ phone: phoneSchema, address: z.string().trim().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        const phone = normalizePhoneNumber(input.phone);
        if (!phone) throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_PHONE" });
        try {
          const address = input.address === undefined ? undefined : input.address.trim() || null;
          await updateUserProfile(ctx.user.id, phone, address);
          return { success: true } as const;
        } catch (error) {
          if (error instanceof Error && error.message === "USER_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "USER_NOT_FOUND" });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PROFILE_UPDATE_FAILED" });
        }
      }),
    updateAddress: protectedProcedure
      .input(z.object({ governorate: z.enum(GOVERNORATE_CODES).nullable(), address: z.string().trim().max(500) }))
      .mutation(async ({ ctx, input }) => {
        if (input.address.trim() && !input.governorate) throw new TRPCError({ code: "BAD_REQUEST", message: "GOVERNORATE_REQUIRED" });
        try {
          await updateUserAddress(ctx.user.id, input.governorate, input.address.trim() || null);
          return { success: true } as const;
        } catch (error) {
          if (error instanceof Error && error.message === "USER_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "USER_NOT_FOUND" });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ADDRESS_UPDATE_FAILED" });
        }
      }),
    prepareFirebasePhoneVerification: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        return await prepareFirebasePhoneVerification(ctx.user.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "FIREBASE_PHONE_PREPARE_FAILED";
        const clientErrors = new Set(["FIREBASE_NOT_CONFIGURED", "PHONE_REQUIRED", "PHONE_ALREADY_VERIFIED", "PHONE_ALREADY_IN_USE"]);
        if (clientErrors.has(message)) throw new TRPCError({ code: "BAD_REQUEST", message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "FIREBASE_PHONE_PREPARE_FAILED" });
      }
    }),
    verifyFirebasePhone: protectedProcedure
      .input(z.object({ idToken: z.string().min(100).max(8192) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await confirmFirebasePhoneVerification(ctx.user.id, input.idToken);
        } catch (error) {
          const message = error instanceof Error ? error.message : "FIREBASE_TOKEN_INVALID";
          const clientErrors = new Set(["FIREBASE_NOT_CONFIGURED", "FIREBASE_TOKEN_INVALID", "FIREBASE_PHONE_AUTH_REQUIRED", "FIREBASE_PHONE_MISMATCH", "FIREBASE_AUTH_TOO_OLD", "PHONE_REQUIRED", "PHONE_CHANGED", "PHONE_ALREADY_IN_USE"]);
          if (clientErrors.has(message)) throw new TRPCError({ code: "BAD_REQUEST", message });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "FIREBASE_PHONE_VERIFY_FAILED" });
        }
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user) {
        try {
          await removeUserPushTokens(ctx.user.id);
        } catch {
          console.warn("[Push] Could not clear registrations on logout");
        }
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(getSessionCookieName(ctx.req), { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  notifications: router({
    registerDevice: protectedProcedure
      .input(z.object({
        token: z.string().trim().min(20).max(255).regex(/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/),
        language: z.enum(["ar", "en", "ku"]),
        platform: z.enum(["android", "ios"]),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          await registerUserPushToken({ userId: ctx.user.id, ...input });
          return { success: true } as const;
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PUSH_REGISTRATION_FAILED" });
        }
      }),
  }),
  auctions: router({
    list: publicProcedure
      .input(z.object({ category: categorySchema.optional(), search: z.string().max(100).optional() }).optional())
      .query(({ input }) => listAuctions(input ?? {})),
    create: adminProcedure
      .input(z.object({
        title: z.string().trim().min(3).max(180),
        description: z.string().trim().min(5).max(3000),
        category: categorySchema,
        currency: z.enum(["IQD", "USD"]),
        startingPrice: z.number().finite().positive().max(999999999999),
        purchasePrice: z.number().finite().positive().max(999999999999).optional(),
        startsAt: z.string().datetime({ offset: true }),
        durationDays: z.number().int().refine(isAllowedAuctionDurationDays, { message: "INVALID_DURATION" }),
        itemDetails: z.object({
          brand: z.string().trim().max(100),
          model: z.string().trim().max(120),
          condition: conditionSchema,
          usagePeriod: z.string().trim().max(120),
          warranty: z.string().trim().max(240),
          accessories: z.string().trim().max(500),
        }),
        photos: z.array(z.object({
          key: z.string().min(1).max(255),
          mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        })).min(5).max(10).refine((items) => new Set(items.map((item) => item.key)).size === items.length, { message: "DUPLICATE_AUCTION_PHOTO" }),
      }).refine((input) => isValidAuctionStartTime(new Date(input.startsAt)), { message: "INVALID_START_TIME" }))
      .mutation(async ({ ctx, input }) => {
        assertPhoneReady(ctx.user);
        if (input.category === "electronics" && (!input.itemDetails.brand || !input.itemDetails.model)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Brand and model are required for electronics" });
        }
        if (input.currency === "IQD" && !Number.isInteger(input.startingPrice)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "IQD prices must be whole numbers" });
        }
        if (input.currency === "USD" && Math.abs(input.startingPrice * 100 - Math.round(input.startingPrice * 100)) > 0.000001) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "USD prices allow at most two decimal places" });
        }
        if (input.purchasePrice !== undefined && input.currency === "IQD" && !Number.isInteger(input.purchasePrice)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "IQD prices must be whole numbers" });
        }
        if (input.purchasePrice !== undefined && input.currency === "USD" && Math.abs(input.purchasePrice * 100 - Math.round(input.purchasePrice * 100)) > 0.000001) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "USD prices allow at most two decimal places" });
        }
        const { photos, ...listingInput } = input;
        let imageKeys: string[];
        try {
          imageKeys = await Promise.all(photos.map((photo) => verifyUploadedAuctionPhoto(photo.key, photo.mimeType, ctx.user.id)));
        } catch (error) {
          if (error instanceof AuctionImageError && error.code !== "UPLOAD_FAILED") {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.code });
          }
          throw new TRPCError({ code: "BAD_REQUEST", message: "AUCTION_PHOTO_UPLOAD_INCOMPLETE" });
        }
        try {
          return await createAuctionListing({
            ...listingInput,
            startsAt: new Date(listingInput.startsAt),
            imageKeys,
            sellerOpenId: ctx.user.openId,
            sellerUserId: ctx.user.id,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "AUCTION_CREATE_FAILED";
          if (message === "PHONE_REQUIRED") throw new TRPCError({ code: "BAD_REQUEST", message });
          if (message === "PHONE_NOT_VERIFIED") throw new TRPCError({ code: "FORBIDDEN", message });
          if (message === "INVALID_AUCTION_PHOTOS") throw new TRPCError({ code: "BAD_REQUEST", message });
          if (message === "INVALID_DURATION") throw new TRPCError({ code: "BAD_REQUEST", message });
          if (message === "INVALID_START_TIME") throw new TRPCError({ code: "BAD_REQUEST", message });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Auction could not be created" });
        }
      }),
    preparePhotoUpload: adminProcedure
      .input(z.object({ mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), fileSize: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        assertPhoneReady(ctx.user);
        try {
          return await prepareAuctionPhotoUpload(ctx.user.id, input.mimeType, input.fileSize);
        } catch (error) {
          if (error instanceof AuctionImageError && error.code !== "UPLOAD_FAILED") throw new TRPCError({ code: "BAD_REQUEST", message: error.code });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AUCTION_IMAGE_UPLOAD_FAILED" });
        }
      }),
    detail: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const result = await getAuctionDetails(input.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Auction not found" });
      return result;
    }),
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(3).max(180),
        description: z.string().trim().min(5).max(3000),
        itemDetails: z.object({
          brand: z.string().trim().max(100),
          model: z.string().trim().max(120),
          condition: conditionSchema,
          usagePeriod: z.string().trim().max(120),
          warranty: z.string().trim().max(240),
          accessories: z.string().trim().max(500),
        }),
        startingPrice: z.number().finite().positive().max(999999999999).optional(),
        purchasePrice: z.number().finite().positive().max(999999999999).nullable().optional(),
        currency: z.enum(["IQD", "USD"]).optional(),
        durationDays: z.number().int().refine(isAllowedAuctionDurationDays, { message: "INVALID_DURATION" }).optional(),
      }))
      .mutation(async ({ input }) => {
        const { durationDays, ...listing } = input;
        if (listing.currency === "IQD" && listing.startingPrice !== undefined && !Number.isInteger(listing.startingPrice)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "IQD prices must be whole numbers" });
        }
        if (listing.currency === "USD" && listing.startingPrice !== undefined && Math.abs(listing.startingPrice * 100 - Math.round(listing.startingPrice * 100)) > 0.000001) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "USD prices allow at most two decimal places" });
        }
        try {
          return await updateAuctionListing({ ...listing, durationDays });
        } catch (error) {
          const message = error instanceof Error ? error.message : "AUCTION_UPDATE_FAILED";
          if (message === "AUCTION_HAS_BIDS") throw new TRPCError({ code: "CONFLICT", message });
          if (message === "AUCTION_NOT_EDITABLE") throw new TRPCError({ code: "CONFLICT", message });
          if (message === "INVALID_AUCTION_PRICE") throw new TRPCError({ code: "BAD_REQUEST", message });
          if (message === "INVALID_DURATION") throw new TRPCError({ code: "BAD_REQUEST", message });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AUCTION_UPDATE_FAILED" });
        }
      }),
    cancel: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        try {
          return await cancelAuctionListing(input.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "AUCTION_NOT_CANCELLABLE";
          if (message === "AUCTION_NOT_CANCELLABLE") throw new TRPCError({ code: "CONFLICT", message });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AUCTION_CANCEL_FAILED" });
        }
      }),
    placeBid: protectedProcedure
      .input(z.object({ auctionId: z.number().int().positive(), amount: z.number().positive().max(999999999999) }))
      .mutation(async ({ ctx, input }) => {
        assertPhoneReady(ctx.user);
        try {
          const result = await placeAuctionBid({ auctionId: input.auctionId, userId: ctx.user.id, amount: input.amount });
          void sendBidPushNotifications({
            auctionId: input.auctionId,
            bidderId: ctx.user.id,
            bidderName: ctx.user.name,
            amount: result.amount,
            currency: result.currency,
            extended: result.extended,
          });
          return result;
        } catch (error) {
          const code = error instanceof Error ? error.message : "BID_FAILED";
          const mapped: Record<string, { code: "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT" | "FORBIDDEN" | "INTERNAL_SERVER_ERROR"; message: string }> = {
            DATABASE_UNAVAILABLE: { code: "INTERNAL_SERVER_ERROR", message: "Database is not available" },
            AUCTION_NOT_FOUND: { code: "NOT_FOUND", message: "Auction not found" },
            AUCTION_CLOSED: { code: "CONFLICT", message: "This auction has ended" },
            AUCTION_NOT_STARTED: { code: "CONFLICT", message: "AUCTION_NOT_STARTED" },
            INVALID_AMOUNT: { code: "BAD_REQUEST", message: "Enter a whole IQD amount" },
            BID_TOO_LOW: { code: "BAD_REQUEST", message: "Bid must meet the minimum increment" },
            SELLER_CANNOT_BID: { code: "BAD_REQUEST", message: "You cannot bid on your own item" },
            PHONE_REQUIRED: { code: "BAD_REQUEST", message: "PHONE_REQUIRED" },
            PHONE_NOT_VERIFIED: { code: "FORBIDDEN", message: "PHONE_NOT_VERIFIED" },
          };
          const result = mapped[code] ?? { code: "INTERNAL_SERVER_ERROR" as const, message: "Bid could not be submitted" };
          throw new TRPCError(result);
        }
      }),
    myBids: protectedProcedure.query(({ ctx }) => listMyBids(ctx.user.id)),
    confirmDelivery: protectedProcedure
      .input(z.object({ auctionId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await confirmAuctionDelivery(ctx.user.id, input.auctionId);
          if (!result.alreadyConfirmed) void sendAdminDeliveryConfirmedPush(input.auctionId);
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : "DELIVERY_NOT_ELIGIBLE";
          if (message === "NOT_AUCTION_WINNER") throw new TRPCError({ code: "FORBIDDEN", message });
          if (message === "DELIVERY_NOT_ELIGIBLE" || message === "DELIVERY_CONFIRMATION_CONFLICT") {
            throw new TRPCError({ code: "CONFLICT", message });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DELIVERY_CONFIRMATION_FAILED" });
        }
      }),
  }),
  admins: router({
    summary: adminProcedure.query(() => getAdminSummary()),
    users: adminProcedure.query(async () => {
      const users = await listUsers();
      return {
        users,
        adminCount: await countAdmins(),
        totalCount: users.length,
        verifiedPhoneCount: users.filter((person) => person.phoneVerifiedAt != null).length,
        withAddressCount: users.filter((person) => Boolean(person.governorate || person.address)).length,
      };
    }),
    winners: adminProcedure.query(() => listAuctionWinners()),
    setRole: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), role: roleSchema }))
      .mutation(async ({ input }) => {
        const target = await getUserById(input.userId);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        if (target.role === "admin" && input.role === "user" && (await countAdmins()) <= 2) {
          throw new TRPCError({ code: "CONFLICT", message: "At least two administrators must remain" });
        }
        await setUserRole(input.userId, input.role);
        return { success: true } as const;
      }),
  }),
  favorites: router({
    list: protectedProcedure.query(({ ctx }) => listAuctionFavorites(ctx.user.id)),
    set: protectedProcedure
      .input(z.object({ auctionId: z.number().int().positive(), favorite: z.boolean() }))
      .mutation(({ ctx, input }) => setAuctionFavorite({ userId: ctx.user.id, ...input })),
  }),
  returns: router({
    mine: protectedProcedure.query(({ ctx }) => listMyReturnProducts(ctx.user.id)),
    prepareUpload: protectedProcedure
      .input(z.object({
        auctionId: z.number().int().positive(),
        kind: z.enum(["image", "video"]),
        mimeType: z.enum([...RETURN_IMAGE_MIME_TYPES, ...RETURN_VIDEO_MIME_TYPES]),
        fileSize: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isReturnMediaMimeAllowed(input.kind, input.mimeType) || !isReturnMediaSizeAllowed(input.kind, input.fileSize)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_RETURN_MEDIA" });
        }
        if (!(await isUserReturnEligible(ctx.user.id, input.auctionId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "RETURN_NOT_ELIGIBLE" });
        }
        try {
          return await prepareReturnEvidenceUpload(ctx.user.id, input.kind, input.mimeType, input.fileSize);
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "RETURN_UPLOAD_PREPARATION_FAILED" });
        }
      }),
    submit: protectedProcedure
      .input(z.object({
        auctionId: z.number().int().positive(),
        reason: z.string().trim().min(5).max(2000),
        imageKey: z.string().min(1).max(255),
        videoKey: z.string().min(1).max(255),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const request = await createReturnRequest({ userId: ctx.user.id, ...input });
          void sendAdminReturnRequestPush(request.id);
          return request;
        } catch (error) {
          const code = error instanceof Error ? error.message : "RETURN_REQUEST_FAILED";
          if (code === "RETURN_NOT_ELIGIBLE") throw new TRPCError({ code: "FORBIDDEN", message: code });
          if (code === "DELIVERY_NOT_CONFIRMED") throw new TRPCError({ code: "FORBIDDEN", message: code });
          if (code === "RETURN_ALREADY_SUBMITTED") throw new TRPCError({ code: "CONFLICT", message: code });
          if (code === "INVALID_EVIDENCE_KEY") throw new TRPCError({ code: "BAD_REQUEST", message: code });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "RETURN_REQUEST_FAILED" });
        }
      }),
    adminList: adminProcedure.query(() => listAdminReturnRequests()),
    adminUpdate: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]), adminNote: z.string().trim().max(1000).optional() }))
      .mutation(async ({ input }) => {
        try {
          return await updateReturnRequest({ id: input.id, status: input.status, adminNote: input.adminNote || null });
        } catch {
          throw new TRPCError({ code: "NOT_FOUND", message: "RETURN_REQUEST_NOT_FOUND" });
        }
      }),
    mediaUrls: protectedProcedure
      .input(z.object({ requestId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const evidence = await getReturnRequestMediaKeys(input.requestId);
        if (!evidence) throw new TRPCError({ code: "NOT_FOUND", message: "RETURN_REQUEST_NOT_FOUND" });
        if (ctx.user.role !== "admin" && evidence.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "RETURN_MEDIA_FORBIDDEN" });
        }
        try {
          const [imageUrl, videoUrl] = await Promise.all([
            storageGetSignedUrl(evidence.imageKey),
            storageGetSignedUrl(evidence.videoKey),
          ]);
          return { imageUrl, videoUrl };
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "RETURN_MEDIA_UNAVAILABLE" });
        }
      }),
  }),
  support: router({
    myMessages: protectedProcedure.query(({ ctx }) => getMySupportMessages(ctx.user.id)),
    sendMessage: protectedProcedure
      .input(z.object({ body: z.string().trim().min(1).max(2000) }))
      .mutation(({ ctx, input }) => sendMySupportMessage(ctx.user.id, input.body)),
    adminConversations: adminProcedure.query(() => listAdminSupportConversations()),
    adminMessages: adminProcedure
      .input(z.object({ conversationId: z.number().int().positive() }))
      .query(({ input }) => getAdminSupportMessages(input.conversationId)),
    adminReply: adminProcedure
      .input(z.object({ conversationId: z.number().int().positive(), body: z.string().trim().min(1).max(2000) }))
      .mutation(({ ctx, input }) => sendAdminSupportMessage({ conversationId: input.conversationId, adminUserId: ctx.user.id, body: input.body })),
  }),
});

export type AppRouter = typeof appRouter;
