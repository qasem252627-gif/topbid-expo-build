import { randomUUID } from "node:crypto";
import { isReturnMediaMimeAllowed, isReturnMediaSizeAllowed, returnMediaExtension, type ReturnMediaKind, type ReturnMediaMime } from "../lib/return-media";
import { storageCreateUploadUrl } from "./storage";

export function makeReturnEvidenceKey(userId: number, kind: ReturnMediaKind, mimeType: ReturnMediaMime) {
  if (!Number.isInteger(userId) || userId <= 0 || !isReturnMediaMimeAllowed(kind, mimeType)) {
    throw new Error("INVALID_RETURN_MEDIA");
  }
  const extension = returnMediaExtension(mimeType);
  return `return-evidence/${userId}/${randomUUID()}.${extension}`;
}

export function isReturnEvidenceKeyOwnedByUser(userId: number, kind: ReturnMediaKind, key: string) {
  const prefix = `return-evidence/${userId}/`;
  if (!key.startsWith(prefix) || key.length > 255 || key.includes("..")) return false;
  const extension = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return kind === "image"
    ? ["jpg", "png", "webp"].includes(extension)
    : ["mp4", "mov"].includes(extension);
}

export async function prepareReturnEvidenceUpload(userId: number, kind: ReturnMediaKind, mimeType: ReturnMediaMime, fileSize: number) {
  if (!isReturnMediaMimeAllowed(kind, mimeType) || !isReturnMediaSizeAllowed(kind, fileSize)) {
    throw new Error("INVALID_RETURN_MEDIA");
  }
  const key = makeReturnEvidenceKey(userId, kind, mimeType);
  return storageCreateUploadUrl(key);
}
