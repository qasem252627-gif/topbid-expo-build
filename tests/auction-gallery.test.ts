import { describe, expect, it } from "vitest";
import {
  AUCTION_PHOTO_MIME_TYPES,
  MAX_AUCTION_PHOTO_BYTES,
  MAX_AUCTION_PHOTOS,
  MIN_AUCTION_PHOTOS,
  isAuctionPhotoCountAllowed,
  isAuctionPhotoMimeAllowed,
  isAuctionPhotoSizeAllowed,
} from "../lib/auction-gallery";

describe("auction gallery rules", () => {
  it("requires at least five photos and allows up to ten", () => {
    expect(isAuctionPhotoCountAllowed(MIN_AUCTION_PHOTOS)).toBe(true);
    expect(isAuctionPhotoCountAllowed(MAX_AUCTION_PHOTOS)).toBe(true);
    expect(isAuctionPhotoCountAllowed(MIN_AUCTION_PHOTOS - 1)).toBe(false);
    expect(isAuctionPhotoCountAllowed(MAX_AUCTION_PHOTOS + 1)).toBe(false);
  });

  it("limits each image to five MiB", () => {
    expect(isAuctionPhotoSizeAllowed(MAX_AUCTION_PHOTO_BYTES)).toBe(true);
    expect(isAuctionPhotoSizeAllowed(MAX_AUCTION_PHOTO_BYTES + 1)).toBe(false);
    expect(isAuctionPhotoSizeAllowed(0)).toBe(false);
    expect(isAuctionPhotoSizeAllowed(1.5)).toBe(false);
  });

  it("only allows supported image MIME types", () => {
    for (const mimeType of AUCTION_PHOTO_MIME_TYPES) expect(isAuctionPhotoMimeAllowed(mimeType)).toBe(true);
    expect(isAuctionPhotoMimeAllowed("image/svg+xml")).toBe(false);
  });
});
