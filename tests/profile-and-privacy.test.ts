import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/firebase-phone-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/firebase-phone-config")>();
  return {
    ...actual,
    isPhoneVerificationRequired: () => Boolean(process.env.FIREBASE_AUTH_PROJECT_ID),
  };
});

vi.mock("../server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/db")>();
  return {
    ...actual,
    countAdmins: vi.fn(),
    createAuctionListing: vi.fn(),
    getAdminSummary: vi.fn(),
    listAuctionWinners: vi.fn(),
    listUsers: vi.fn(),
    registerUserPushToken: vi.fn(),
    updateUserAddress: vi.fn(),
    updateUserProfile: vi.fn(),
  };
});

import { countAdmins, createAuctionListing, getAdminSummary, listAuctionWinners, listUsers, registerUserPushToken, updateUserAddress, updateUserProfile } from "../server/db";
import type { TrpcContext } from "../server/_core/context";
import { appRouter } from "../server/routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

type DirectoryUser = Awaited<ReturnType<typeof listUsers>>[number];
type AuctionWinner = Awaited<ReturnType<typeof listAuctionWinners>>[number];

function createContext(phone: string | null = null, role: "user" | "admin" = "user", phoneVerifiedAt: Date | null = phone ? new Date() : null): TrpcContext {
  const user: AuthenticatedUser = {
    id: 7,
    openId: "privacy-test-user",
    name: "Test Bidder",
    email: "bidder@example.test",
    loginMethod: "test",
    phone,
    phoneVerifiedAt,
    address: null,
    governorate: null,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("profile and contact privacy rules", () => {
  it("requires a saved phone number before placing a bid", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.auctions.placeBid({ auctionId: 1, amount: 100_000 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: "PHONE_REQUIRED" });
  });

  it("requires phone verification before placing a bid once Firebase Phone Auth is configured", async () => {
    vi.stubEnv("FIREBASE_AUTH_PROJECT_ID", "mizadna-test-project");
    const caller = appRouter.createCaller(createContext("+9647501234567", "user", null));
    await expect(caller.auctions.placeBid({ auctionId: 1, amount: 100_000 }))
      .rejects.toMatchObject({ code: "FORBIDDEN", message: "PHONE_NOT_VERIFIED" });
  });

  it("requires a saved phone number before creating an auction", async () => {
    const caller = appRouter.createCaller(createContext(null, "admin"));
    await expect(caller.auctions.create({
      title: "Dining chair",
      description: "A well-kept chair for the home.",
      category: "home",
      currency: "IQD",
      startingPrice: 100_000,
      startsAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      durationDays: 1,
      itemDetails: { brand: "", model: "", condition: "good", usagePeriod: "", warranty: "", accessories: "" },
      photos: Array.from({ length: 5 }, (_, index) => ({ key: `test-photo-${index}`, mimeType: "image/jpeg" as const })),
    })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "PHONE_REQUIRED" });
  });

  it("prevents ordinary users from creating auctions even with a saved phone", async () => {
    const caller = appRouter.createCaller(createContext("+9647501234567", "user"));
    await expect(caller.auctions.create({
      title: "Dining chair",
      description: "A well-kept chair for the home.",
      category: "home",
      currency: "IQD",
      startingPrice: 100_000,
      startsAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      durationDays: 1,
      itemDetails: { brand: "", model: "", condition: "good", usagePeriod: "", warranty: "", accessories: "" },
      photos: Array.from({ length: 5 }, (_, index) => ({ key: `test-photo-${index}`, mimeType: "image/jpeg" as const })),
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createAuctionListing).not.toHaveBeenCalled();
  });

  it("rejects scheduled auctions whose start time is not at least one minute away", async () => {
    const caller = appRouter.createCaller(createContext("+9647501234567", "admin"));
    await expect(caller.auctions.create({
      title: "Dining chair",
      description: "A well-kept chair for the home.",
      category: "home",
      currency: "IQD",
      startingPrice: 100_000,
      startsAt: new Date(Date.now() + 10_000).toISOString(),
      durationDays: 1,
      itemDetails: { brand: "", model: "", condition: "good", usagePeriod: "", warranty: "", accessories: "" },
      photos: Array.from({ length: 5 }, (_, index) => ({ key: `test-photo-${index}`, mimeType: "image/jpeg" as const })),
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createAuctionListing).not.toHaveBeenCalled();
  });

  it("rejects malformed phone numbers before attempting a profile update", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.auth.updateProfile({ phone: "not-a-phone", address: "Some street" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it("lets an authenticated user save their own phone and clear an optional address", async () => {
    vi.mocked(updateUserProfile).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext("+9647501234567"));

    await expect(caller.auth.updateProfile({ phone: "+964 750 123 4567", address: "   " }))
      .resolves.toEqual({ success: true });
    expect(updateUserProfile).toHaveBeenCalledWith(7, "+9647501234567", null);
  });

  it("requires a governorate when saving non-empty delivery address details", async () => {
    const caller = appRouter.createCaller(createContext("+9647501234567"));
    await expect(caller.auth.updateAddress({ governorate: null, address: "Example street" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: "GOVERNORATE_REQUIRED" });
    expect(updateUserAddress).not.toHaveBeenCalled();
  });

  it("saves the selected governorate and address for the signed-in user", async () => {
    vi.mocked(updateUserAddress).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext("+9647501234567"));
    await expect(caller.auth.updateAddress({ governorate: "erbil", address: "Example street" }))
      .resolves.toEqual({ success: true });
    expect(updateUserAddress).toHaveBeenCalledWith(7, "erbil", "Example street");
  });

  it("does not expose the user directory to ordinary accounts", async () => {
    const caller = appRouter.createCaller(createContext("+9647501234567"));
    await expect(caller.admins.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("allows admins to read phone and address from the protected directory", async () => {
    const directoryUser: DirectoryUser = {
      id: 8,
      openId: "directory-test-user",
      name: "Directory Test",
      email: "directory@example.test",
      loginMethod: "test",
      phone: "+9647501234567",
      phoneVerifiedAt: null,
      address: "Example street",
      governorate: "erbil",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      lastSignedIn: new Date("2026-01-02T00:00:00Z"),
    };
    vi.mocked(listUsers).mockResolvedValue([directoryUser]);
    vi.mocked(countAdmins).mockResolvedValue(2);
    const caller = appRouter.createCaller(createContext("+9647500000000", "admin"));

    await expect(caller.admins.users()).resolves.toEqual({
      users: [directoryUser], adminCount: 2, totalCount: 1, verifiedPhoneCount: 0, withAddressCount: 1,
    });
    expect(listUsers).toHaveBeenCalledOnce();
    expect(countAdmins).toHaveBeenCalledOnce();
  });

  it("returns aggregate user counts only from the protected admin summary", async () => {
    const summary = { totalCount: 20, adminCount: 2, verifiedPhoneCount: 8, withAddressCount: 5 };
    vi.mocked(getAdminSummary).mockResolvedValue(summary);
    const caller = appRouter.createCaller(createContext("+9647500000000", "admin"));
    await expect(caller.admins.summary()).resolves.toEqual(summary);
    expect(getAdminSummary).toHaveBeenCalledOnce();
  });

  it("does not expose winner contact details to ordinary accounts", async () => {
    const caller = appRouter.createCaller(createContext("+9647501234567"));
    await expect(caller.admins.winners()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listAuctionWinners).not.toHaveBeenCalled();
  });

  it("lets administrators read the product and winner contact fields", async () => {
    const winner: AuctionWinner = {
      auctionId: 42,
      titleAr: "هاتف ذكي",
      titleEn: "Smartphone",
      titleKu: "مۆبایل",
      winningAmount: "125000",
      currency: "IQD",
      winnerName: "Winner Account",
      phone: "+9647501234567",
      address: "Erbil, Example Street",
      governorate: "erbil",
    };
    vi.mocked(listAuctionWinners).mockResolvedValue([winner]);
    const caller = appRouter.createCaller(createContext("+9647500000000", "admin"));

    await expect(caller.admins.winners()).resolves.toEqual([winner]);
    expect(listAuctionWinners).toHaveBeenCalledOnce();
  });

  it("registers a device token only for the authenticated account", async () => {
    vi.mocked(registerUserPushToken).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext("+9647501234567", "user"));
    await expect(caller.notifications.registerDevice({
      token: "ExpoPushToken[abcdefghijklmnopqrstuvwxyz0123456789]",
      language: "ar",
      platform: "android",
    })).resolves.toEqual({ success: true });
    expect(registerUserPushToken).toHaveBeenCalledWith({
      userId: 7,
      token: "ExpoPushToken[abcdefghijklmnopqrstuvwxyz0123456789]",
      language: "ar",
      platform: "android",
    });
  });
});


describe("administrator-only exchange and advertising settings", () => {
  it("rejects exchange-rate edits from ordinary accounts", async () => {
    const caller = appRouter.createCaller(createContext("+9647501234567", "user"));
    await expect(caller.settings.updateExchangeRate(1500)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects administrative ad management from ordinary accounts", async () => {
    const caller = appRouter.createCaller(createContext("+9647501234567", "user"));
    await expect(caller.ads.adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ads.setActive({ id: 1, isActive: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
