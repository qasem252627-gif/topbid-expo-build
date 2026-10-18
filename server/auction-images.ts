import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { storagePut } from "./storage";

export type AuctionPhotoMime = "image/jpeg" | "image/png" | "image/webp";
export type AuctionImageErrorCode = "INVALID_IMAGE" | "IMAGE_TOO_LARGE" | "UPLOAD_FAILED";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_CHARS = 7_000_000;

export class AuctionImageError extends Error {
  constructor(readonly code: AuctionImageErrorCode) {
    super(code);
    this.name = "AuctionImageError";
  }
}

function hasMatchingSignature(bytes: Buffer, mimeType: AuctionPhotoMime): boolean {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

async function uploadImage(input: { base64: string; mimeType: AuctionPhotoMime }, directory: "auction-photos" | "marketplace-ads"): Promise<string> {
  if (input.base64.length > MAX_BASE64_CHARS) throw new AuctionImageError("IMAGE_TOO_LARGE");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64) || input.base64.length % 4 === 1) {
    throw new AuctionImageError("INVALID_IMAGE");
  }

  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.length > MAX_IMAGE_BYTES) throw new AuctionImageError("IMAGE_TOO_LARGE");
  if (
    bytes.length === 0 ||
    bytes.toString("base64").replace(/=+$/, "") !== input.base64.replace(/=+$/, "") ||
    !hasMatchingSignature(bytes, input.mimeType)
  ) {
    throw new AuctionImageError("INVALID_IMAGE");
  }

  const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/png" ? "png" : "webp";
  try {
    const stored = await storagePut(`${directory}/${randomUUID()}.${extension}`, bytes, input.mimeType);
    return stored.key;
  } catch {
    throw new AuctionImageError("UPLOAD_FAILED");
  }
}

export function uploadAuctionImage(input: { base64: string; mimeType: AuctionPhotoMime }) {
  return uploadImage(input, "auction-photos");
}

export function uploadPromotionalAdImage(input: { base64: string; mimeType: AuctionPhotoMime }) {
  return uploadImage(input, "marketplace-ads");
}

import { isAuctionPhotoMimeAllowed, isAuctionPhotoSizeAllowed } from "../lib/auction-gallery";
import { storageCreateUploadUrl, storageGetSignedUrl } from "./storage";

export function makeAuctionPhotoKey(userId: number, mimeType: AuctionPhotoMime) {
  if (!Number.isInteger(userId) || userId <= 0 || !isAuctionPhotoMimeAllowed(mimeType)) throw new AuctionImageError("INVALID_IMAGE");
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  return `auction-photos/users/${userId}/${randomUUID()}.${extension}`;
}

export function isAuctionPhotoKeyOwnedByUser(userId: number, key: string) {
  const prefix = `auction-photos/users/${userId}/`;
  if (!Number.isInteger(userId) || userId <= 0 || !key.startsWith(prefix) || key.length > 255 || key.includes("..")) return false;
  return /\/[^/]+\.(jpg|png|webp)$/i.test(key);
}

export async function prepareAuctionPhotoUpload(userId: number, mimeType: string, fileSize: number) {
  if (!isAuctionPhotoMimeAllowed(mimeType) || !isAuctionPhotoSizeAllowed(fileSize)) {
    throw new AuctionImageError(fileSize > MAX_IMAGE_BYTES ? "IMAGE_TOO_LARGE" : "INVALID_IMAGE");
  }
  const key = makeAuctionPhotoKey(userId, mimeType);
  try {
    return await storageCreateUploadUrl(key);
  } catch {
    throw new AuctionImageError("UPLOAD_FAILED");
  }
}

export async function verifyUploadedAuctionPhoto(key: string, mimeType: string, userId: number) {
  if (!isAuctionPhotoKeyOwnedByUser(userId, key) || !isAuctionPhotoMimeAllowed(mimeType)) throw new AuctionImageError("INVALID_IMAGE");
  let response: Response;
  try {
    response = await fetch(await storageGetSignedUrl(key), { signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new AuctionImageError("UPLOAD_FAILED");
  }
  if (!response.ok) throw new AuctionImageError("UPLOAD_FAILED");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!isAuctionPhotoSizeAllowed(bytes.byteLength)) throw new AuctionImageError("IMAGE_TOO_LARGE");
  if (!hasMatchingSignature(bytes, mimeType)) throw new AuctionImageError("INVALID_IMAGE");
  return key;
}
