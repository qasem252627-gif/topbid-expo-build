import type { inferRouterOutputs } from "@trpc/server";
import { getStorageBaseUrl } from "@/constants/oauth";
import type { AppRouter } from "@/server/routers";
import type { Language } from "./i18n";

export type Auction = inferRouterOutputs<AppRouter>["auctions"]["list"][number];
export type BidEntry = inferRouterOutputs<AppRouter>["auctions"]["myBids"][number];
export type AuctionImageSource = number | { uri: string };
export { formatProductNumber } from "./product-number";

export function getAuctionTitle(auction: Auction, language: Language) {
  if (language === "en") return auction.titleEn;
  if (language === "ku") return auction.titleKu;
  return auction.titleAr;
}

export function getAuctionDescription(auction: Auction, language: Language) {
  if (language === "en") return auction.descriptionEn;
  if (language === "ku") return auction.descriptionKu;
  return auction.descriptionAr;
}

export { formatTimeLeft } from "./auction-countdown";

export const categoryImage: Record<string, number> = {
  gadget: require("@/assets/products/smart-gadgets.jpeg"),
  headphones: require("@/assets/products/headphones.jpeg"),
  kitchen: require("@/assets/products/home-appliances.jpg"),
  furniture: require("@/assets/products/kitchen-island.jpg"),
};

export function getAuctionImageSource(imageKey: string, category: "electronics" | "home"): AuctionImageSource {
  const localImage = categoryImage[imageKey];
  if (localImage) return localImage;

  const storageBase = getStorageBaseUrl().replace(/\/+$/, "");
  if (!storageBase) return category === "electronics" ? categoryImage.gadget : categoryImage.furniture;
  const encodedKey = imageKey.split("/").map(encodeURIComponent).join("/");
  return { uri: `${storageBase}/manus-storage/${encodedKey}` };
}

export function getStoredMediaUri(key: string) {
  const storageBase = getStorageBaseUrl().replace(/\/+$/, "");
  if (!storageBase) return "";
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${storageBase}/manus-storage/${encodedKey}`;
}
