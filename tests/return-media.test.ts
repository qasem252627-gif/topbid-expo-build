import { describe, expect, it } from "vitest";
import {
  isReturnMediaMimeAllowed,
  isReturnMediaSizeAllowed,
  RETURN_IMAGE_MAX_BYTES,
  RETURN_VIDEO_MAX_BYTES,
  RETURN_VIDEO_MAX_SECONDS,
} from "../lib/return-media";

describe("return-request evidence rules", () => {
  it("allows only the supported image and video MIME types", () => {
    expect(isReturnMediaMimeAllowed("image", "image/jpeg")).toBe(true);
    expect(isReturnMediaMimeAllowed("image", "image/png")).toBe(true);
    expect(isReturnMediaMimeAllowed("image", "image/webp")).toBe(true);
    expect(isReturnMediaMimeAllowed("image", "video/mp4")).toBe(false);
    expect(isReturnMediaMimeAllowed("video", "video/mp4")).toBe(true);
    expect(isReturnMediaMimeAllowed("video", "video/quicktime")).toBe(true);
    expect(isReturnMediaMimeAllowed("video", "video/x-msvideo")).toBe(false);
  });

  it("enforces the configured file-size and video-duration ceilings", () => {
    expect(isReturnMediaSizeAllowed("image", RETURN_IMAGE_MAX_BYTES)).toBe(true);
    expect(isReturnMediaSizeAllowed("image", RETURN_IMAGE_MAX_BYTES + 1)).toBe(false);
    expect(isReturnMediaSizeAllowed("video", RETURN_VIDEO_MAX_BYTES)).toBe(true);
    expect(isReturnMediaSizeAllowed("video", RETURN_VIDEO_MAX_BYTES + 1)).toBe(false);
    expect(RETURN_VIDEO_MAX_SECONDS).toBe(30);
  });
});
