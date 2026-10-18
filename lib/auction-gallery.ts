export const MIN_AUCTION_PHOTOS = 5;
export const MAX_AUCTION_PHOTOS = 10;
export const MAX_AUCTION_PHOTO_BYTES = 5 * 1024 * 1024;
export const AUCTION_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AuctionPhotoMime = (typeof AUCTION_PHOTO_MIME_TYPES)[number];

export function isAuctionPhotoMimeAllowed(value: string): value is AuctionPhotoMime {
  return (AUCTION_PHOTO_MIME_TYPES as readonly string[]).includes(value);
}

export function isAuctionPhotoSizeAllowed(size: number) {
  return Number.isInteger(size) && size > 0 && size <= MAX_AUCTION_PHOTO_BYTES;
}

export function isAuctionPhotoCountAllowed(count: number) {
  return Number.isInteger(count) && count >= MIN_AUCTION_PHOTOS && count <= MAX_AUCTION_PHOTOS;
}
