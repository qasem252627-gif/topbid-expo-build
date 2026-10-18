export const RETURN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const RETURN_VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export const RETURN_VIDEO_MAX_SECONDS = 30;

export const RETURN_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const RETURN_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;

export type ReturnMediaKind = "image" | "video";
export type ReturnImageMime = (typeof RETURN_IMAGE_MIME_TYPES)[number];
export type ReturnVideoMime = (typeof RETURN_VIDEO_MIME_TYPES)[number];
export type ReturnMediaMime = ReturnImageMime | ReturnVideoMime;

export function isReturnMediaMimeAllowed(kind: ReturnMediaKind, mimeType: string): mimeType is ReturnMediaMime {
  return kind === "image"
    ? (RETURN_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
    : (RETURN_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isReturnMediaSizeAllowed(kind: ReturnMediaKind, fileSize: number) {
  const maximum = kind === "image" ? RETURN_IMAGE_MAX_BYTES : RETURN_VIDEO_MAX_BYTES;
  return Number.isInteger(fileSize) && fileSize > 0 && fileSize <= maximum;
}

export function returnMediaExtension(mimeType: ReturnMediaMime) {
  switch (mimeType) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "video/quicktime": return "mov";
    case "video/mp4": return "mp4";
  }
}
