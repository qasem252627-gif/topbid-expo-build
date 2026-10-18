import { useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { adsCopy } from "@/lib/ads-copy";
import { getAuctionImageSource } from "@/lib/auction-utils";
import { useLanguage } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", white: "#FFFFFF", line: "#E8E5DE", red: "#A33128" };
type PhotoMime = "image/jpeg" | "image/png" | "image/webp";
type SelectedPhoto = { uri: string; base64: string; mimeType: PhotoMime };

function detectPhotoMime(mimeType: string | null | undefined, base64: string): PhotoMime | null {
  const normalized = mimeType?.split(";")[0].trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/png" || normalized === "image/webp") return normalized;
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return null;
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export default function AdminAdsScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language, isRTL, t } = useLanguage();
  const copy = adsCopy[language];
  const profile = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user) });
  const ads = trpc.ads.adminList.useQuery(undefined, { enabled: profile.data?.role === "admin", refetchInterval: 30_000 });
  const utils = trpc.useUtils();
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const create = trpc.ads.create.useMutation({
    onSuccess: async () => {
      setPhoto(null);
      setTargetUrl("");
      setError("");
      setNotice(copy.saved);
      await Promise.all([utils.ads.adminList.invalidate(), utils.ads.list.invalidate()]);
    },
    onError: () => { setNotice(""); setError(copy.uploadFailed); },
  });
  const setActive = trpc.ads.setActive.useMutation({
    onSuccess: async () => {
      setError("");
      setNotice(copy.updated);
      await Promise.all([utils.ads.adminList.invalidate(), utils.ads.list.invalidate()]);
    },
    onError: () => { setNotice(""); setError(copy.updateFailed); },
  });

  async function choosePhoto() {
    setNotice("");
    setError("");
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { setError(copy.invalidImage); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: Platform.OS !== "web",
        aspect: [16, 9],
        quality: 0.78,
        base64: true,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64 || asset.base64.length > 7_000_000) { setError(copy.invalidImage); return; }
      const mimeType = detectPhotoMime(asset.mimeType, asset.base64);
      if (!mimeType) { setError(copy.invalidImage); return; }
      setPhoto({ uri: asset.uri, base64: asset.base64, mimeType });
    } catch {
      setError(copy.invalidImage);
    }
  }

  function submit() {
    setNotice("");
    setError("");
    if (!photo || !targetUrl.trim()) { setError(copy.required); return; }
    if (!isHttpUrl(targetUrl)) { setError(copy.invalidUrl); return; }
    create.mutate({ targetUrl: targetUrl.trim(), photo: { base64: photo.base64, mimeType: photo.mimeType } });
  }

  if (loading || (user && profile.isLoading)) {
    return <ScreenContainer><View style={styles.center}><ActivityIndicator color={C.teal} /></View></ScreenContainer>;
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button"><Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={20} color={C.ink} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{copy.title}</Text>
            <Text style={[styles.intro, { textAlign: isRTL ? "right" : "left" }]}>{copy.intro}</Text>
          </View>
        </View>
        {!user ? <Text style={styles.stateText}>{t("signInHint")}</Text> : profile.data?.role !== "admin" ? <Text style={styles.stateText}>{t("noAdminPermission")}</Text> : (
          <>
            <View style={styles.form}>
              <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.image}</Text>
              {photo ? <View style={styles.previewCard}>
                <Image source={{ uri: photo.uri }} contentFit="cover" style={styles.preview} />
                <Pressable onPress={choosePhoto} style={styles.changePhoto} accessibilityRole="button"><Ionicons name="image-outline" size={16} color={C.teal} /><Text style={styles.changePhotoText}>{copy.changeImage}</Text></Pressable>
              </View> : <Pressable onPress={choosePhoto} style={styles.photoPicker} accessibilityRole="button"><Ionicons name="image-outline" size={26} color={C.teal} /><Text style={styles.changePhotoText}>{copy.chooseImage}</Text></Pressable>}
              <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.link}</Text>
              <TextInput value={targetUrl} onChangeText={setTargetUrl} placeholder={copy.linkPlaceholder} placeholderTextColor="#97A19E" autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2048} style={styles.input} textAlign="left" />
              {notice ? <Text style={styles.success}>{notice}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable onPress={submit} disabled={create.isPending} style={[styles.primaryButton, create.isPending && { opacity: 0.65 }]} accessibilityRole="button">
                {create.isPending ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryText}>{copy.create}</Text>}
              </Pressable>
            </View>
            <Text style={[styles.listTitle, { textAlign: isRTL ? "right" : "left" }]}>{copy.title}</Text>
            {ads.isLoading ? <ActivityIndicator color={C.teal} /> : null}
            {ads.error ? <Text style={styles.error}>{copy.updateFailed}</Text> : null}
            {!ads.isLoading && !ads.error && !ads.data?.length ? <Text style={styles.stateText}>{copy.empty}</Text> : null}
            {ads.data?.map((ad) => <View key={ad.id} style={styles.adCard}>
              <Image source={getAuctionImageSource(ad.imageKey, "home")} contentFit="cover" style={styles.adThumb} />
              <Text numberOfLines={1} style={styles.url}>{ad.targetUrl}</Text>
              <Text style={[styles.status, ad.isActive ? styles.active : styles.inactive]}>{ad.isActive ? copy.active : copy.inactive}</Text>
              <View style={styles.row}>
                <Pressable onPress={() => setActive.mutate({ id: ad.id, isActive: !ad.isActive })} disabled={setActive.isPending} style={styles.secondaryButton} accessibilityRole="button">
                  <Text style={styles.secondaryText}>{ad.isActive ? copy.deactivate : copy.activate}</Text>
                </Pressable>
                <Pressable onPress={() => void Linking.openURL(ad.targetUrl).catch(() => setError(copy.invalidUrl))} style={styles.openButton} accessibilityRole="link">
                  <Ionicons name="open-outline" size={15} color={C.teal} /><Text style={styles.openText}>{copy.open}</Text>
                </Pressable>
              </View>
            </View>)}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: C.bg, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 35, gap: 14, maxWidth: 620, width: "100%", alignSelf: "center" },
  header: { alignItems: "flex-start", gap: 12 },
  back: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  title: { color: C.ink, fontSize: 20, fontWeight: "900" },
  intro: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  form: { backgroundColor: C.white, borderRadius: 20, padding: 15, borderWidth: 1, borderColor: C.line, gap: 10 },
  label: { color: C.ink, fontSize: 11, fontWeight: "800" },
  previewCard: { borderRadius: 15, overflow: "hidden", borderWidth: 1, borderColor: C.line },
  preview: { width: "100%", height: 150, backgroundColor: "#F0EFEA" },
  photoPicker: { minHeight: 100, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: C.line, alignItems: "center", justifyContent: "center", gap: 7 },
  changePhoto: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  changePhotoText: { color: C.teal, fontSize: 11, fontWeight: "800" },
  input: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "#FCFBF8", paddingHorizontal: 12, color: C.ink, fontSize: 12, writingDirection: "ltr" },
  primaryButton: { minHeight: 46, backgroundColor: C.teal, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  primaryText: { color: C.white, fontSize: 12, fontWeight: "900" },
  listTitle: { color: C.ink, fontSize: 16, fontWeight: "900", marginTop: 5 },
  adCard: { backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: C.line, padding: 10, gap: 7 },
  adThumb: { width: "100%", height: 120, borderRadius: 12, backgroundColor: "#F0EFEA" },
  url: { color: C.ink, fontSize: 10, writingDirection: "ltr" },
  status: { fontSize: 10, fontWeight: "800" },
  active: { color: C.teal },
  inactive: { color: C.muted },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  secondaryButton: { minHeight: 38, borderRadius: 11, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, justifyContent: "center" },
  secondaryText: { color: C.ink, fontSize: 10, fontWeight: "800" },
  openButton: { minHeight: 38, flexDirection: "row", gap: 5, alignItems: "center", paddingHorizontal: 8 },
  openText: { color: C.teal, fontSize: 10, fontWeight: "800" },
  stateText: { color: C.muted, fontSize: 12, textAlign: "center", padding: 16 },
  success: { color: C.teal, textAlign: "center", fontSize: 10, fontWeight: "800" },
  error: { color: C.red, textAlign: "center", fontSize: 10, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
