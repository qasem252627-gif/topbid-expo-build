import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { getAuctionImageSource } from "@/lib/auction-utils";
import { useLanguage } from "@/lib/i18n";
import { returnsCopy } from "@/lib/returns-copy";
import { trpc } from "@/lib/trpc";
import { isReturnMediaMimeAllowed, isReturnMediaSizeAllowed, RETURN_IMAGE_MAX_BYTES, RETURN_VIDEO_MAX_BYTES, RETURN_VIDEO_MAX_SECONDS, type ReturnMediaKind, type ReturnMediaMime } from "@/lib/return-media";
import { getLocalMediaSize, uploadReturnMedia } from "@/lib/upload-return-media";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", red: "#B42318", white: "#FFFFFF", line: "#E8E5DE", amber: "#8B5E0A" };
type SelectedMedia = { uri: string; mimeType: ReturnMediaMime; size: number; name: string; duration?: number };

export default function ReturnsScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language, isRTL, t } = useLanguage();
  const copy = returnsCopy[language];
  const rows = trpc.returns.mine.useQuery(undefined, { enabled: Boolean(user), refetchInterval: user ? 15_000 : false, refetchIntervalInBackground: false });
  const prepareUpload = trpc.returns.prepareUpload.useMutation();
  const submitRequest = trpc.returns.submit.useMutation();
  const utils = trpc.useUtils();
  const [activeAuctionId, setActiveAuctionId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<SelectedMedia | null>(null);
  const [video, setVideo] = useState<SelectedMedia | null>(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/account");
  }

  async function chooseMedia(kind: ReturnMediaKind) {
    setMessage("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setMessage(copy.permissionDenied); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === "image" ? ["images"] : ["videos"],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: RETURN_VIDEO_MAX_SECONDS,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const extension = asset.uri.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
      const mimeType = (asset.mimeType || (extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : extension === "mov" ? "video/quicktime" : extension === "mp4" ? "video/mp4" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : "")) as string;
      if (!isReturnMediaMimeAllowed(kind, mimeType)) { setMessage(kind === "image" ? copy.invalidImage : copy.invalidVideo); return; }
      const size = await getLocalMediaSize(asset.uri, asset.fileSize);
      if (!isReturnMediaSizeAllowed(kind, size)) { setMessage(kind === "image" ? copy.imageTooLarge : copy.videoTooLarge); return; }
      const duration = asset.duration ?? undefined;
      if (kind === "video" && (duration === undefined || duration > RETURN_VIDEO_MAX_SECONDS * 1000)) { setMessage(copy.videoTooLong); return; }
      const selected: SelectedMedia = { uri: asset.uri, mimeType: mimeType as ReturnMediaMime, size, name: asset.fileName || `${kind}.${extension || "file"}`, duration };
      if (kind === "image") setPhoto(selected);
      else setVideo(selected);
    } catch {
      setMessage(copy.mediaPickFailed);
    }
  }

  async function submit(auctionId: number) {
    setMessage("");
    if (reason.trim().length < 5) { setMessage(copy.missingReason); return; }
    if (!photo || !video) { setMessage(copy.missingEvidence); return; }
    setIsUploading(true);
    try {
      const photoUpload = await prepareUpload.mutateAsync({ auctionId, kind: "image", mimeType: photo.mimeType, fileSize: photo.size });
      await uploadReturnMedia(photoUpload.uploadUrl, photo.uri, photo.mimeType);
      const videoUpload = await prepareUpload.mutateAsync({ auctionId, kind: "video", mimeType: video.mimeType, fileSize: video.size });
      await uploadReturnMedia(videoUpload.uploadUrl, video.uri, video.mimeType);
      await submitRequest.mutateAsync({ auctionId, reason: reason.trim(), imageKey: photoUpload.key, videoKey: videoUpload.key });
      await utils.returns.mine.invalidate();
      setMessage(copy.requestSent);
      setActiveAuctionId(null);
      setReason("");
      setPhoto(null);
      setVideo(null);
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "";
      setMessage(errorText.includes("RETURN_ALREADY_SUBMITTED") ? copy.alreadySubmitted : errorText.includes("RETURN_NOT_ELIGIBLE") ? copy.notEligible : copy.requestFailed);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
          <Pressable onPress={goBack} style={[styles.backButton, { flexDirection: isRTL ? "row-reverse" : "row" }]} accessibilityRole="button" accessibilityLabel={copy.back}>
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={17} color={C.teal} />
            <Text style={styles.backText}>{copy.back}</Text>
          </Pressable>
          <Text style={styles.kicker}>{copy.product}</Text>
          <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{copy.title}</Text>
          <Text style={[styles.muted, { textAlign: isRTL ? "right" : "left" }]}>{copy.intro}</Text>
        </View>
        {loading || (user && rows.isLoading) ? <View style={styles.center}><ActivityIndicator color={C.teal} /><Text style={styles.muted}>{t("loading")}</Text></View> : null}
        {!user && !loading ? <View style={styles.card}>
          <Ionicons name="person-circle-outline" size={34} color={C.teal} />
          <Text style={styles.muted}>{copy.signIn}</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/login")}><Text style={styles.primaryText}>{t("signIn")}</Text></Pressable>
        </View> : null}
        {rows.error ? <View style={styles.card}><Text style={styles.error}>{t("failed")}</Text><Pressable onPress={() => rows.refetch()}><Text style={styles.link}>{t("retry")}</Text></Pressable></View> : null}
        {user && !rows.isLoading && !rows.error && rows.data?.length === 0 ? <View style={styles.card}><Ionicons name="refresh-circle-outline" size={32} color={C.teal} /><Text style={styles.muted}>{copy.empty}</Text></View> : null}
        {message ? <Text accessibilityRole="alert" style={[styles.banner, message === copy.requestSent && styles.successBanner]}>{message}</Text> : null}
        {user && rows.data?.map((item) => {
          const request = item.request;
          const productTitle = language === "en" ? item.titleEn : language === "ku" ? item.titleKu : item.titleAr;
          const isOpen = activeAuctionId === item.auctionId;
          const statusLabel = request ? request.status === "pending" ? copy.pending : request.status === "approved" ? copy.approved : copy.rejected : "";
          return <View key={item.auctionId} style={styles.productCard}>
            <View style={[styles.productHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Image source={getAuctionImageSource(item.imageKey, item.category)} contentFit="cover" style={styles.productImage} />
              <View style={[styles.productInfo, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
                <Text style={[styles.productTitle, { textAlign: isRTL ? "right" : "left" }]}>{productTitle}</Text>
                <Text style={styles.price}>{copy.winningPrice}: {formatCurrency(item.winningAmount, item.currency, language)}</Text>
              </View>
            </View>
            {request ? <View style={styles.statusCard}>
              <Text style={styles.statusText}>{copy.status}: {statusLabel}</Text>
              <Text style={[styles.reasonText, { textAlign: isRTL ? "right" : "left" }]}>{request.reason}</Text>
              {request.adminNote ? <Text style={[styles.adminNote, { textAlign: isRTL ? "right" : "left" }]}>{copy.adminNote}: {request.adminNote}</Text> : null}
            </View> : null}
            {(!request || request.status === "rejected") && !isOpen ? <Pressable style={styles.primaryButton} onPress={() => { setMessage(""); setActiveAuctionId(item.auctionId); setReason(""); setPhoto(null); setVideo(null); }}>
              <Text style={styles.primaryText}>{request?.status === "rejected" ? copy.resubmit : copy.openRequest}</Text>
            </Pressable> : null}
            {isOpen ? <View style={styles.form}>
              <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.reason}</Text>
              <TextInput value={reason} onChangeText={setReason} placeholder={copy.reasonPlaceholder} placeholderTextColor="#8B9693" multiline maxLength={2000} textAlign={isRTL ? "right" : "left"} style={styles.reasonInput} />
              <View style={styles.mediaRow}>
                <Pressable onPress={() => chooseMedia("image")} style={styles.mediaButton}><Ionicons name="image-outline" size={19} color={C.teal} /><Text style={styles.mediaButtonText}>{photo ? copy.imageSelected : copy.chooseImage}</Text></Pressable>
                <Pressable onPress={() => chooseMedia("video")} style={styles.mediaButton}><Ionicons name="videocam-outline" size={19} color={C.teal} /><Text style={styles.mediaButtonText}>{video ? copy.videoSelected : copy.chooseVideo}</Text></Pressable>
              </View>
              {photo ? <View style={styles.previewRow}><Image source={{ uri: photo.uri }} contentFit="cover" style={styles.photoPreview} /><Text style={styles.previewLabel}>{copy.image} · {(photo.size / 1024 / 1024).toFixed(1)} MB</Text></View> : <Text style={styles.helper}>{copy.image} · ≤ {(RETURN_IMAGE_MAX_BYTES / 1024 / 1024).toFixed(0)} MB</Text>}
              {video ? <View style={styles.previewRow}><Ionicons name="videocam" size={22} color={C.teal} /><Text style={styles.previewLabel} numberOfLines={1}>{video.name} · {(video.size / 1024 / 1024).toFixed(1)} MB</Text></View> : <Text style={styles.helper}>{copy.video} · ≤ {(RETURN_VIDEO_MAX_BYTES / 1024 / 1024).toFixed(0)} MB</Text>}
              {message ? <Text style={styles.error}>{message}</Text> : null}
              <Text style={styles.footnote}>{copy.noAutomaticRefund}</Text>
              <View style={[styles.actions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Pressable disabled={isUploading} onPress={() => submit(item.auctionId)} style={[styles.primaryButton, isUploading && styles.disabled]}>
                  {isUploading ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryText}>{copy.submit}</Text>}
                </Pressable>
                <Pressable disabled={isUploading} onPress={() => setActiveAuctionId(null)} style={styles.secondaryButton}><Text style={styles.secondaryText}>{t("close")}</Text></Pressable>
              </View>
              {isUploading ? <Text style={styles.helper}>{copy.submitting}</Text> : null}
            </View> : null}
          </View>;
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 25, paddingBottom: 32, backgroundColor: C.bg, minHeight: "100%", width: "100%", maxWidth: 650, alignSelf: "center", gap: 13 },
  header: { gap: 5, marginBottom: 20 },
  backButton: { alignItems: "center", gap: 3, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 4 },
  backText: { color: C.teal, fontSize: 12, fontWeight: "800" },
  kicker: { color: C.teal, fontSize: 12, fontWeight: "800" },
  title: { color: C.ink, fontSize: 24, fontWeight: "900" },
  muted: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  center: { minHeight: 130, justifyContent: "center", alignItems: "center", gap: 10 },
  card: { backgroundColor: C.white, borderRadius: 21, borderWidth: 1, borderColor: C.line, padding: 20, gap: 12, alignItems: "center" },
  productCard: { backgroundColor: C.white, borderRadius: 21, borderWidth: 1, borderColor: C.line, padding: 13, gap: 12 },
  productHeader: { alignItems: "center", gap: 12 },
  productImage: { width: 76, height: 76, borderRadius: 15, backgroundColor: C.bg },
  productInfo: { flex: 1, gap: 8 },
  productTitle: { color: C.ink, fontSize: 14, fontWeight: "900" },
  price: { color: C.teal, fontSize: 12, fontWeight: "800" },
  statusCard: { padding: 12, backgroundColor: "#F7F6F2", borderRadius: 13, gap: 7 },
  statusText: { color: C.teal, fontSize: 12, fontWeight: "900" },
  reasonText: { color: C.ink, fontSize: 12, lineHeight: 18 },
  adminNote: { color: C.amber, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  primaryButton: { minHeight: 43, paddingHorizontal: 16, backgroundColor: C.teal, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  primaryText: { color: C.white, fontSize: 12, fontWeight: "900", textAlign: "center" },
  secondaryButton: { minHeight: 43, paddingHorizontal: 15, borderWidth: 1, borderColor: C.line, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: C.ink, fontSize: 12, fontWeight: "800" },
  form: { gap: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 },
  label: { color: C.ink, fontSize: 12, fontWeight: "900" },
  reasonInput: { minHeight: 96, borderWidth: 1, borderColor: C.line, borderRadius: 13, backgroundColor: "#FCFBF8", padding: 12, color: C.ink, textAlignVertical: "top", fontSize: 13 },
  mediaRow: { flexDirection: "row", gap: 8 },
  mediaButton: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: "#C8DED9", backgroundColor: "#F4FAF8", flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  mediaButtonText: { color: C.teal, fontSize: 10, fontWeight: "800", textAlign: "center" },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  photoPreview: { width: 42, height: 42, borderRadius: 10, backgroundColor: C.bg },
  previewLabel: { flex: 1, color: C.ink, fontSize: 10, fontWeight: "700" },
  helper: { color: C.muted, fontSize: 10, lineHeight: 15 },
  footnote: { color: C.muted, fontSize: 10, lineHeight: 15 },
  actions: { gap: 8 },
  disabled: { opacity: 0.6 },
  banner: { backgroundColor: "#FEF2F2", color: C.red, borderRadius: 12, padding: 10, fontSize: 11, textAlign: "center", fontWeight: "700" },
  successBanner: { backgroundColor: "#EAF3F0", color: C.teal },
  error: { color: C.red, fontSize: 11, textAlign: "center" },
  link: { color: C.teal, fontWeight: "800", padding: 8 },
});
