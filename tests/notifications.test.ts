import { describe, expect, it } from "vitest";
import { buildBidPushMessages } from "../server/notifications";

describe("bid push notifications", () => {
  it("builds one localized alert per subscribed previous bidder without contact details", () => {
    const messages = buildBidPushMessages({
      auctionId: 42,
      bidderId: 9,
      bidderName: "Bidder Account",
      amount: "73.25",
      currency: "USD",
    }, [
      { token: "ExpoPushToken[recipient1]", language: "ar", titleAr: "هاتف", titleEn: "Phone", titleKu: "مۆبایل" },
      { token: "ExpoPushToken[recipient2]", language: "en", titleAr: "هاتف", titleEn: "Phone", titleKu: "مۆبایل" },
      { token: "ExpoPushToken[recipient3]", language: "ku", titleAr: "هاتف", titleEn: "Phone", titleKu: "مۆبایل" },
    ]);

    expect(messages).toHaveLength(3);
    expect(messages[0]?.body).toContain("Bidder Account");
    expect(messages[1]?.body).toContain("Bidder Account");
    expect(messages[2]?.body).toContain("Bidder Account");
    expect(messages[1]?.body).toContain("73.25");
    expect(messages[2]?.data).toEqual({ type: "auction-bid", auctionId: 42, url: "/auction/42" });
    for (const message of messages) {
      expect(message).not.toHaveProperty("phone");
      expect(message).not.toHaveProperty("address");
      expect(message).not.toHaveProperty("email");
    }
  });

  it("adds a two-minute extension note when a late bid extends the auction", () => {
    const [message] = buildBidPushMessages({
      auctionId: 11,
      bidderId: 4,
      bidderName: "Account",
      amount: "80.00",
      currency: "USD",
      extended: true,
    }, [{ token: "ExpoPushToken[recipient]", language: "en", titleAr: "", titleEn: "Phone", titleKu: "" }]);

    expect(message?.body).toContain("The end time was extended by 2 minutes after this bid.");
  });

  it("uses a translated fallback when the bidder has no account name", () => {
    const [message] = buildBidPushMessages({
      auctionId: 7,
      bidderId: 3,
      bidderName: "  ",
      amount: "100000",
      currency: "IQD",
    }, [{ token: "ExpoPushToken[recipient]", language: "en", titleAr: "", titleEn: "Table", titleKu: "" }]);

    expect(message?.body).toContain("User");
  });
});
