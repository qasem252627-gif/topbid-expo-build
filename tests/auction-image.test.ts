import { describe, expect, it } from "vitest";
import { uploadAuctionImage, uploadPromotionalAdImage } from "../server/auction-images";

describe("auction image validation", () => {
  it("rejects content whose bytes do not match its declared image type", async () => {
    const fakeJpeg = Buffer.from("this is not a jpeg", "utf8").toString("base64");
    await expect(uploadAuctionImage({ base64: fakeJpeg, mimeType: "image/jpeg" })).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
  });

  it("applies the same byte-level validation to promotional ad uploads", async () => {
    const fakeJpeg = Buffer.from("not actually an image", "utf8").toString("base64");
    await expect(uploadPromotionalAdImage({ base64: fakeJpeg, mimeType: "image/jpeg" })).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
  });

  it("rejects an encoded image that exceeds the request limit before decoding it", async () => {
    await expect(uploadAuctionImage({ base64: "A".repeat(7_000_001), mimeType: "image/jpeg" })).rejects.toMatchObject({
      code: "IMAGE_TOO_LARGE",
    });
  });

  it("rejects decoded image bytes above five megabytes", async () => {
    const oversizedImage = Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64");
    await expect(uploadAuctionImage({ base64: oversizedImage, mimeType: "image/jpeg" })).rejects.toMatchObject({
      code: "IMAGE_TOO_LARGE",
    });
  });
});
