const OTP_ERROR_CODE = /\b(?:auth\/[a-z0-9-]+|FIREBASE_[A-Z0-9_]+|FIRESTORE_[A-Z0-9_]+|META_WHATSAPP_[A-Z0-9_]+|OTP_[A-Z0-9_]+|WHATSAPP_[A-Z0-9_]+|PHONE_[A-Z0-9_]+|INVALID_PHONE|BAD_REQUEST|UNAUTHORIZED|FORBIDDEN|INTERNAL_SERVER_ERROR|TIMEOUT|NETWORK_ERROR)\b/i;

function getErrorField(error: unknown, field: "code" | "message"): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object" || !(field in error)) return "";
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

export function getOtpErrorCode(error: unknown): string {
  const candidates = [getErrorField(error, "code"), getErrorField(error, "message")];
  for (const candidate of candidates) {
    const match = candidate.match(OTP_ERROR_CODE);
    if (match) return match[0];
  }
  return "UNKNOWN";
}

export function formatOtpError(message: string, error: unknown, phase: string): string {
  return `${message} [${phase}: ${getOtpErrorCode(error)}]`;
}
