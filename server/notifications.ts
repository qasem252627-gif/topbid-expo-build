import { auctionCopy } from "../lib/auction-copy";
import { formatCurrency } from "../lib/currency";
import { returnsCopy } from "../lib/returns-copy";
import { getAdminDeliveryAlertDetails, getAdminReturnAlertDetails, getBidNotificationRecipients, removePushTokens } from "./db";

type Language = "ar" | "en" | "ku";
type BidPushInput = {
  auctionId: number;
  bidderId: number;
  bidderName: string | null;
  amount: string;
  currency: "IQD" | "USD";
  extended?: boolean;
};

type PushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  priority: "high";
  channelId: "bids";
  data: { type: "auction-bid"; auctionId: number; url: string };
};

export function buildBidPushMessages(input: BidPushInput, recipients: Array<{
  token: string;
  language: Language;
  titleAr: string;
  titleEn: string;
  titleKu: string;
}>): PushMessage[] {
  return recipients.map((recipient) => {
    const copy = auctionCopy[recipient.language];
    const product = recipient.language === "en" ? recipient.titleEn : recipient.language === "ku" ? recipient.titleKu : recipient.titleAr;
    const bidder = input.bidderName?.trim() || copy.bidderUnknown;
    const amount = formatCurrency(input.amount, input.currency, recipient.language);
    const bidBody = copy.bidAlertBody
      .replace("{bidder}", bidder)
      .replace("{amount}", amount)
      .replace("{product}", product);
    const body = input.extended ? `${bidBody}\n${copy.bidAlertExtended}` : bidBody;
    return {
      to: recipient.token,
      sound: "default",
      title: copy.bidAlertTitle,
      body,
      priority: "high",
      channelId: "bids",
      data: { type: "auction-bid", auctionId: input.auctionId, url: `/auction/${input.auctionId}` },
    };
  });
}

export async function sendBidPushNotifications(input: BidPushInput): Promise<void> {
  try {
    const recipients = await getBidNotificationRecipients(input.auctionId, input.bidderId);
    if (recipients.length === 0) return;
    const messages = buildBidPushMessages(input, recipients);

    for (let offset = 0; offset < messages.length; offset += 100) {
      const batch = messages.slice(offset, offset + 100);
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        console.warn(`[Push] Expo endpoint returned HTTP ${response.status}`);
        continue;
      }
      const payload = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
      const staleTokens = batch.flatMap((message, index) => {
        const ticket = payload.data?.[index];
        return ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered" ? [message.to] : [];
      });
      if (staleTokens.length > 0) await removePushTokens(staleTokens);
    }
  } catch {
    // A push-service outage must never undo an accepted auction bid.
    console.warn("[Push] Bid notification delivery failed");
  }
}

type ReturnPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  priority: "high";
  channelId: "bids";
  data: { type: "return-request"; requestId: number; url: string };
};

export function buildAdminReturnRequestPushMessages(requestId: number, recipients: Array<{
  token: string;
  language: Language;
  titleAr: string;
  titleEn: string;
  titleKu: string;
  requesterName: string | null;
}>): ReturnPushMessage[] {
  return recipients.map((recipient) => {
    const copy = returnsCopy[recipient.language];
    const product = recipient.language === "en" ? recipient.titleEn : recipient.language === "ku" ? recipient.titleKu : recipient.titleAr;
    const body = copy.newAdminAlertBody
      .replace("{user}", recipient.requesterName?.trim() || copy.user)
      .replace("{product}", product);
    return {
      to: recipient.token,
      sound: "default",
      title: copy.newAdminAlertTitle,
      body,
      priority: "high",
      channelId: "bids",
      data: { type: "return-request", requestId, url: "/admin-returns" },
    };
  });
}

export async function sendAdminReturnRequestPush(requestId: number): Promise<void> {
  try {
    const recipients = await getAdminReturnAlertDetails(requestId);
    if (recipients.length === 0) return;
    const messages = buildAdminReturnRequestPushMessages(requestId, recipients);
    for (let offset = 0; offset < messages.length; offset += 100) {
      const batch = messages.slice(offset, offset + 100);
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { Accept: "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) continue;
      const payload = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
      const staleTokens = batch.flatMap((message, index) => {
        const ticket = payload.data?.[index];
        return ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered" ? [message.to] : [];
      });
      if (staleTokens.length > 0) await removePushTokens(staleTokens);
    }
  } catch {
    console.warn("[Push] Admin return-request notification delivery failed");
  }
}

export function buildAdminDeliveryPushMessages(auctionId: number, recipients: Array<{
  token: string;
  language: Language;
  titleAr: string;
  titleEn: string;
  titleKu: string;
  winnerName: string | null;
}>) {
  return recipients.map((recipient) => {
    const copy = returnsCopy[recipient.language];
    const product = recipient.language === "en" ? recipient.titleEn : recipient.language === "ku" ? recipient.titleKu : recipient.titleAr;
    return {
      to: recipient.token,
      sound: "default" as const,
      title: copy.deliveryAdminAlertTitle,
      body: copy.deliveryAdminAlertBody.replace("{user}", recipient.winnerName?.trim() || copy.user).replace("{product}", product),
      priority: "high" as const,
      channelId: "bids" as const,
      data: { type: "delivery-confirmed" as const, auctionId, url: "/admin-returns" },
    };
  });
}

export async function sendAdminDeliveryConfirmedPush(auctionId: number): Promise<void> {
  try {
    const recipients = await getAdminDeliveryAlertDetails(auctionId);
    if (recipients.length === 0) return;
    const messages = buildAdminDeliveryPushMessages(auctionId, recipients);
    for (let offset = 0; offset < messages.length; offset += 100) {
      const batch = messages.slice(offset, offset + 100);
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { Accept: "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) continue;
      const payload = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
      const staleTokens = batch.flatMap((message, index) => {
        const ticket = payload.data?.[index];
        return ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered" ? [message.to] : [];
      });
      if (staleTokens.length > 0) await removePushTokens(staleTokens);
    }
  } catch {
    console.warn("[Push] Admin delivery notification failed");
  }
}
