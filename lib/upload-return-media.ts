import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export async function getLocalMediaSize(uri: string, reportedSize?: number) {
  if (typeof reportedSize === "number" && Number.isInteger(reportedSize) && reportedSize > 0) return reportedSize;
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("MEDIA_READ_FAILED");
    return (await response.blob()).size;
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory || typeof info.size !== "number" || info.size <= 0) throw new Error("MEDIA_SIZE_UNKNOWN");
  return info.size;
}

export async function uploadReturnMedia(uploadUrl: string, uri: string, mimeType: string) {
  if (Platform.OS === "web") {
    const source = await fetch(uri);
    if (!source.ok) throw new Error("MEDIA_READ_FAILED");
    const blob = await source.blob();
    const result = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: blob,
    });
    if (!result.ok) throw new Error("MEDIA_UPLOAD_FAILED");
    return;
  }

  const result = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": mimeType },
  });
  if (result.status < 200 || result.status >= 300) throw new Error("MEDIA_UPLOAD_FAILED");
}
