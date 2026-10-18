import { createElement, useState, type ChangeEvent } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { MAX_AUCTION_PHOTOS, MIN_AUCTION_PHOTOS, isAuctionPhotoMimeAllowed, isAuctionPhotoSizeAllowed, type AuctionPhotoMime } from "@/lib/auction-gallery";
import { auctionCopy } from "@/lib/auction-copy";
import { AUCTION_DURATION_OPTIONS_DAYS, isValidAuctionStartTime, type AuctionDurationDays } from "@/lib/auction-duration";
import { useLanguage } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { getLocalMediaSize, uploadReturnMedia } from "@/lib/upload-return-media";

type Category = "electronics" | "home";
type Condition = "new" | "like_new" | "good" | "fair";
type Currency = "IQD" | "USD";
const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", amber: "#E3A63A", white: "#FFFFFF", line: "#E8E5DE", red: "#A33128" };

type SelectedPhoto = { uri: string; mimeType: AuctionPhotoMime; fileSize: number };

function getProductPhotoMime(mimeType: string | null | undefined, uri: string): AuctionPhotoMime | null {
  const normalized = mimeType?.split(";")[0].trim().toLowerCase();
  if (normalized && isAuctionPhotoMimeAllowed(normalized)) return normalized;
  const path = uri.split("?")[0].toLowerCase();
  if (/\.(jpe?g)$/.test(path)) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return null;
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  isRTL: boolean;
  multiline?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  maxLength?: number;
};

function FormField({ label, value, onChangeText, placeholder, isRTL, multiline, keyboardType, maxLength }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#97A19E"
        style={[styles.input, multiline && styles.multiline, { textAlign: isRTL ? "right" : "left" }]}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize="sentences"
        returnKeyType={multiline ? "default" : "next"}
      />
    </View>
  );
}

export default function NewAuctionScreen() {
  const router = useRouter();
  const { language, isRTL, t } = useLanguage();
  const copy = auctionCopy[language];
  const { user, loading } = useAuth();
  const profile = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user) });
  const utils = trpc.useUtils();
  const preparePhotoUpload = trpc.auctions.preparePhotoUpload.useMutation();
  const createAuction = trpc.auctions.create.useMutation({
    onSuccess: async ({ id }) => {
      await utils.auctions.list.invalidate();
      router.replace({ pathname: "/auction/[id]", params: { id: String(id) } });
    },
  });

  const [category, setCategory] = useState<Category>("electronics");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState<Condition>("good");
  const [usagePeriod, setUsagePeriod] = useState("");
  const [warranty, setWarranty] = useState("");
  const [accessories, setAccessories] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currency, setCurrency] = useState<Currency>("IQD");
  const [durationDays, setDurationDays] = useState<AuctionDurationDays>(3);
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 15 * 60 * 1000));
  const [dateTimePickerMode, setDateTimePickerMode] = useState<"date" | "time" | null>(null);
  const [notice, setNotice] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const createErrorMessage = createAuction.error?.message === "PHONE_REQUIRED"
    ? copy.phoneRequiredToPublish
    : createAuction.error?.message === "PHONE_NOT_VERIFIED"
      ? copy.phoneRequiredToPublish
    : createAuction.error?.message === "IMAGE_TOO_LARGE"
      ? copy.photoTooLarge
    : createAuction.error?.message === "INVALID_IMAGE"
      ? copy.invalidPhoto
    : createAuction.error?.message === "INVALID_START_TIME"
      ? copy.invalidStartTime
      : createAuction.error?.message === "AUCTION_IMAGE_UPLOAD_FAILED"
        ? copy.photoUploadFailed
        : copy.createFailed;

  const conditions: { value: Condition; label: string }[] = [
    { value: "new", label: copy.conditionNew },
    { value: "like_new", label: copy.conditionLikeNew },
    { value: "good", label: copy.conditionGood },
    { value: "fair", label: copy.conditionFair },
  ];
  const durations: { value: AuctionDurationDays; label: string }[] = AUCTION_DURATION_OPTIONS_DAYS.map((value) => ({
    value,
    label: copy.durationOptions[value],
  }));

  async function choosePhotos() {
    setNotice("");
    try {
      const remaining = MAX_AUCTION_PHOTOS - selectedPhotos.length;
      if (remaining <= 0) { setNotice(copy.photoMaximum); return; }
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { setNotice(copy.photoPermissionDenied); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.75,
        base64: false,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const selected: SelectedPhoto[] = [];
      for (const asset of result.assets) {
        const mimeType = getProductPhotoMime(asset.mimeType, asset.uri);
        if (!mimeType) { setNotice(copy.invalidPhoto); return; }
        const fileSize = await getLocalMediaSize(asset.uri, asset.fileSize);
        if (!isAuctionPhotoSizeAllowed(fileSize)) { setNotice(copy.photoTooLarge); return; }
        selected.push({ uri: asset.uri, mimeType, fileSize });
      }
      setSelectedPhotos((current) => [...current, ...selected].slice(0, MAX_AUCTION_PHOTOS));
    } catch {
      setNotice(copy.photoPickFailed);
    }
  }

  async function submit() {
    setNotice("");
    if (!title.trim() || !description.trim()) { setNotice(copy.requiredFields); return; }
    if (selectedPhotos.length < MIN_AUCTION_PHOTOS) { setNotice(copy.photoCountError); return; }
    if (!isValidAuctionStartTime(startsAt)) { setNotice(copy.invalidStartTime); return; }
    if (category === "electronics" && (!brand.trim() || !model.trim())) { setNotice(copy.detailsRequired); return; }
    const parsedPrice = Number(startingPrice.trim().replace(/[\s,]/g, ""));
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) { setNotice(copy.invalidPrice); return; }
    if (currency === "IQD" && !Number.isInteger(parsedPrice)) { setNotice(copy.wholeIqd); return; }
    if (currency === "USD" && Math.abs(parsedPrice * 100 - Math.round(parsedPrice * 100)) > 0.000001) { setNotice(copy.invalidPrice); return; }
    const parsedPurchasePrice = purchasePrice.trim() ? Number(purchasePrice.trim().replace(/[\s,]/g, "")) : undefined;
    if (parsedPurchasePrice !== undefined && (!Number.isFinite(parsedPurchasePrice) || parsedPurchasePrice <= 0)) { setNotice(copy.invalidPrice); return; }
    if (parsedPurchasePrice !== undefined && currency === "IQD" && !Number.isInteger(parsedPurchasePrice)) { setNotice(copy.wholeIqd); return; }
    if (parsedPurchasePrice !== undefined && currency === "USD" && Math.abs(parsedPurchasePrice * 100 - Math.round(parsedPurchasePrice * 100)) > 0.000001) { setNotice(copy.invalidPrice); return; }

    setIsUploading(true);
    setUploadProgress(0);
    const photos: { key: string; mimeType: AuctionPhotoMime }[] = [];
    try {
      for (const [index, photo] of selectedPhotos.entries()) {
        const upload = await preparePhotoUpload.mutateAsync({ mimeType: photo.mimeType, fileSize: photo.fileSize });
        await uploadReturnMedia(upload.uploadUrl, photo.uri, photo.mimeType);
        photos.push({ key: upload.key, mimeType: photo.mimeType });
        setUploadProgress(index + 1);
      }
    } catch {
      setIsUploading(false);
      setNotice(copy.photoUploadFailed);
      return;
    }
    setIsUploading(false);

    createAuction.mutate({
      title: title.trim(),
      description: description.trim(),
      category,
      currency,
      startingPrice: parsedPrice,
      purchasePrice: parsedPurchasePrice,
      startsAt: startsAt.toISOString(),
      durationDays,
      photos,
      itemDetails: {
        brand: brand.trim(),
        model: model.trim(),
        condition,
        usagePeriod: usagePeriod.trim(),
        warranty: warranty.trim(),
        accessories: accessories.trim(),
      },
    });
  }

  if (loading) {
    return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.center}><ActivityIndicator color={C.teal} /></View></ScreenContainer>;
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={copy.screenTitle}>
              <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={20} color={C.ink} />
            </Pressable>
            <Text style={styles.headerTitle}>{copy.screenTitle}</Text>
            <View style={{ width: 42 }} />
          </View>
          <Text style={[styles.intro, { textAlign: isRTL ? "right" : "left" }]}>{copy.intro}</Text>

          {!user ? (
            <View style={styles.guestCard}>
              <Ionicons name="person-circle-outline" size={32} color={C.teal} />
              <Text style={styles.guestText}>{copy.signInRequired}</Text>
              <Pressable onPress={() => router.push("/login")} style={styles.primaryButton} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>{copy.signIn}</Text>
              </Pressable>
            </View>
          ) : profile.isLoading ? (
            <View style={styles.center}><ActivityIndicator color={C.teal} /></View>
          ) : !profile.data || profile.data.role !== "admin" ? (
            <View style={styles.guestCard}>
              <Ionicons name="lock-closed-outline" size={32} color={C.teal} />
              <Text style={styles.guestText}>{t("noAdminPermission")}</Text>
              <Pressable onPress={() => router.replace("/(tabs)")} style={styles.primaryButton} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>{t("close")}</Text>
              </Pressable>
            </View>
          ) : !profile.data?.phone ? (
            <View style={styles.guestCard}>
              <Ionicons name="call-outline" size={32} color={C.teal} />
              <Text style={styles.guestText}>{copy.phoneRequiredToPublish}</Text>
              <Pressable onPress={() => router.push("/(tabs)/account")} style={styles.primaryButton} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>{copy.completeProfile}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>{copy.category}</Text>
                <View style={[styles.chipRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  {(["electronics", "home"] as const).map((value) => {
                    const selected = category === value;
                    return <Pressable key={value} onPress={() => setCategory(value)} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{value === "electronics" ? copy.electronics : copy.home}</Text></Pressable>;
                  })}
                </View>
                <FormField label={`${copy.listingTitle} *`} value={title} onChangeText={setTitle} placeholder={copy.titlePlaceholder} isRTL={isRTL} maxLength={180} />
                <FormField label={`${copy.listingDescription} *`} value={description} onChangeText={setDescription} placeholder={copy.descriptionPlaceholder} isRTL={isRTL} multiline maxLength={3000} />
                <View style={styles.field}>
                  <View style={[styles.photoTitleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={styles.label}>{copy.productPhoto}</Text>
                    <Text style={styles.photoCount}>{selectedPhotos.length}/{MAX_AUCTION_PHOTOS}</Text>
                  </View>
                  {selectedPhotos.length > 0 ? (
                    <View style={styles.photoGrid}>
                      {selectedPhotos.map((photo, index) => (
                        <View key={`${photo.uri}:${index}`} style={styles.photoThumbWrap}>
                          <Image source={{ uri: photo.uri }} contentFit="cover" style={styles.photoThumb} />
                          <Pressable onPress={() => setSelectedPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} style={styles.photoRemove} accessibilityRole="button" accessibilityLabel={copy.removePhoto}>
                            <Ionicons name="close-circle" size={23} color={C.red} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {selectedPhotos.length < MAX_AUCTION_PHOTOS ? (
                    <Pressable onPress={choosePhotos} style={styles.photoPicker} accessibilityRole="button" accessibilityLabel={copy.addPhoto}>
                      <Ionicons name="image-outline" size={30} color={C.teal} />
                      <Text style={styles.photoAddTitle}>{copy.addPhoto}</Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.photoHint}>{copy.photoHint}</Text>
                  {isUploading ? <Text style={styles.photoHint}>{copy.uploadingPhotos.replace("{done}", String(uploadProgress)).replace("{total}", String(selectedPhotos.length))}</Text> : null}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>{copy.deviceDetails}</Text>
                <FormField label={`${copy.brand}${category === "electronics" ? " *" : ""}`} value={brand} onChangeText={setBrand} placeholder={copy.brandPlaceholder} isRTL={isRTL} maxLength={100} />
                <FormField label={`${copy.model}${category === "electronics" ? " *" : ""}`} value={model} onChangeText={setModel} placeholder={copy.modelPlaceholder} isRTL={isRTL} maxLength={120} />
                <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.condition} *</Text>
                <View style={[styles.chipRow, { flexDirection: isRTL ? "row-reverse" : "row", flexWrap: "wrap" }]}>
                  {conditions.map((item) => {
                    const selected = condition === item.value;
                    return <Pressable key={item.value} onPress={() => setCondition(item.value)} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text></Pressable>;
                  })}
                </View>
                <FormField label={copy.usagePeriod} value={usagePeriod} onChangeText={setUsagePeriod} placeholder={copy.usagePlaceholder} isRTL={isRTL} maxLength={120} />
                <FormField label={copy.warranty} value={warranty} onChangeText={setWarranty} placeholder={copy.warrantyPlaceholder} isRTL={isRTL} maxLength={240} />
                <FormField label={copy.accessories} value={accessories} onChangeText={setAccessories} placeholder={copy.accessoriesPlaceholder} isRTL={isRTL} maxLength={500} />
                <Text style={[styles.safetyHint, { textAlign: isRTL ? "right" : "left" }]}>{copy.safetyHint}</Text>
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>{copy.auctionSettings}</Text>
                <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.currency}</Text>
                <View style={[styles.chipRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  {(["IQD", "USD"] as const).map((value) => {
                    const selected = currency === value;
                    return <Pressable key={value} onPress={() => setCurrency(value)} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{value === "IQD" ? copy.currencyIQD : copy.currencyUSD}</Text></Pressable>;
                  })}
                </View>
                <FormField label={`${copy.startingPrice} *`} value={startingPrice} onChangeText={setStartingPrice} placeholder={copy.pricePlaceholder} isRTL={isRTL} keyboardType="decimal-pad" maxLength={16} />
                <FormField label={`${copy.purchasePrice} · ${copy.optional}`} value={purchasePrice} onChangeText={setPurchasePrice} placeholder={copy.purchasePricePlaceholder} isRTL={isRTL} keyboardType="decimal-pad" maxLength={16} />
                <Text style={[styles.safetyHint, { textAlign: isRTL ? "right" : "left" }]}>{copy.purchasePriceHint}</Text>
                <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.startDate}</Text>
                <Text style={[styles.safetyHint, { textAlign: isRTL ? "right" : "left" }]}>{copy.startDateHint}</Text>
                {Platform.OS === "web" ? (
                  <View style={{ gap: 8 }}>
                    <WebDateTimeInput type="date" value={formatDateInput(startsAt)} accessibilityLabel={copy.pickDate} onChangeText={(value) => setStartsAt(updateLocalDate(startsAt, value))} />
                    <WebDateTimeInput type="time" value={formatTimeInput(startsAt)} accessibilityLabel={copy.pickTime} onChangeText={(value) => setStartsAt(updateLocalTime(startsAt, value))} />
                  </View>
                ) : (
                  <View style={[styles.dateTimeRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Pressable onPress={() => setDateTimePickerMode("date")} style={styles.dateTimeButton} accessibilityRole="button">
                      <Ionicons name="calendar-outline" size={16} color={C.teal} />
                      <Text style={styles.dateTimeText}>{startsAt.toLocaleDateString(localeFor(language))} · {copy.pickDate}</Text>
                    </Pressable>
                    <Pressable onPress={() => setDateTimePickerMode("time")} style={styles.dateTimeButton} accessibilityRole="button">
                      <Ionicons name="time-outline" size={16} color={C.teal} />
                      <Text style={styles.dateTimeText}>{startsAt.toLocaleTimeString(localeFor(language), { hour: "2-digit", minute: "2-digit" })} · {copy.pickTime}</Text>
                    </Pressable>
                    {dateTimePickerMode ? <DateTimePicker
                      value={startsAt}
                      mode={dateTimePickerMode}
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      minimumDate={dateTimePickerMode === "date" ? new Date() : undefined}
                      onChange={(event, selectedDate) => {
                        setDateTimePickerMode(null);
                        if (!selectedDate || event.type === "dismissed") return;
                        if (dateTimePickerMode === "date") {
                          const updated = new Date(startsAt);
                          updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                          setStartsAt(updated);
                        } else {
                          const updated = new Date(startsAt);
                          updated.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                          setStartsAt(updated);
                        }
                      }}
                    /> : null}
                  </View>
                )}
                <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.duration}</Text>
                <View style={[styles.chipRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  {durations.map((item) => {
                    const selected = durationDays === item.value;
                    return <Pressable key={item.value} onPress={() => setDurationDays(item.value)} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text></Pressable>;
                  })}
                </View>
              </View>

              {notice || createAuction.isError ? <Text style={styles.errorText}>{notice || createErrorMessage}</Text> : null}
              <Pressable onPress={submit} disabled={createAuction.isPending || isUploading} style={[styles.submitButton, (createAuction.isPending || isUploading) && { opacity: 0.65 }]} accessibilityRole="button">
                {createAuction.isPending || isUploading ? <ActivityIndicator color={C.white} /> : <><Ionicons name="add-circle-outline" size={19} color={C.white} /><Text style={styles.primaryButtonText}>{copy.publish}</Text></>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30, backgroundColor: C.bg, minHeight: "100%", maxWidth: 620, width: "100%", alignSelf: "center" },
  header: { alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: C.ink, fontSize: 16, fontWeight: "900" },
  intro: { color: C.muted, fontSize: 12, lineHeight: 19, marginBottom: 13 },
  sectionCard: { backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 15, marginBottom: 12, gap: 12 },
  sectionTitle: { color: C.ink, fontSize: 14, fontWeight: "900", marginBottom: 1 },
  field: { gap: 6 },
  label: { color: C.ink, fontSize: 11, fontWeight: "800" },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: "#FCFBF8", paddingHorizontal: 12, color: C.ink, fontSize: 13 },
  multiline: { minHeight: 96, paddingTop: 11, textAlignVertical: "top" },
  chipRow: { alignItems: "center", gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: "#F7F6F2", borderWidth: 1, borderColor: C.line },
  chipSelected: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { color: C.muted, fontSize: 11, fontWeight: "800" },
  chipTextSelected: { color: C.white },
  dateTimeRow: { gap: 8, flexWrap: "wrap" },
  dateTimeButton: { minHeight: 44, paddingHorizontal: 11, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: "#FCFBF8", alignItems: "center", flexDirection: "row", gap: 7 },
  dateTimeText: { color: C.ink, fontSize: 11, fontWeight: "800" },
  safetyHint: { color: C.muted, fontSize: 10, lineHeight: 15 },
  photoTitleRow: { alignItems: "center", justifyContent: "space-between" },
  optionalLabel: { color: C.muted, fontSize: 10, fontWeight: "700" },
  photoCount: { color: C.teal, fontSize: 11, fontWeight: "900" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoThumbWrap: { width: "31%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#F0EFEA" },
  photoThumb: { width: "100%", height: "100%" },
  photoRemove: { position: "absolute", top: 4, right: 4, backgroundColor: C.white, borderRadius: 12 },
  photoPicker: { minHeight: 140, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.line, backgroundColor: "#FCFBF8", alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
  photoAddTitle: { color: C.teal, fontSize: 12, fontWeight: "900", textAlign: "center" },
  photoHint: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: "center" },
  photoCard: { borderRadius: 16, borderWidth: 1, borderColor: C.line, overflow: "hidden", backgroundColor: C.white },
  photoPreview: { width: "100%", height: 190, backgroundColor: "#F0EFEA" },
  photoActionRow: { padding: 9, gap: 8 },
  photoAction: { flex: 1, minHeight: 38, borderRadius: 12, backgroundColor: "#F7F6F2", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  photoActionText: { color: C.teal, fontSize: 10, fontWeight: "800" },
  submitButton: { minHeight: 52, borderRadius: 16, backgroundColor: C.teal, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 1 },
  primaryButton: { minHeight: 46, paddingHorizontal: 22, borderRadius: 14, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: C.white, fontSize: 13, fontWeight: "900" },
  errorText: { color: C.red, fontSize: 12, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  guestCard: { marginTop: 30, backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 22, alignItems: "center", gap: 14 },
  guestText: { color: C.ink, fontSize: 14, fontWeight: "800", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

function localeFor(language: "ar" | "en" | "ku") {
  return language === "en" ? "en-IQ" : language === "ku" ? "ku-IQ" : "ar-IQ";
}

function WebDateTimeInput({ type, value, accessibilityLabel, onChangeText }: { type: "date" | "time"; value: string; accessibilityLabel: string; onChangeText: (value: string) => void }) {
  return createElement("input", {
    type,
    value,
    "aria-label": accessibilityLabel,
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChangeText(event.currentTarget.value),
    style: {
      boxSizing: "border-box",
      minHeight: 45,
      width: "100%",
      borderRadius: 13,
      border: `1px solid ${C.line}`,
      backgroundColor: "#FCFBF8",
      padding: "0 12px",
      color: C.ink,
      fontFamily: "inherit",
      fontSize: 13,
    },
  });
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function updateLocalDate(current: Date, value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return current;
  const updated = new Date(current);
  updated.setFullYear(year, month - 1, day);
  return updated;
}

function updateLocalTime(current: Date, value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return current;
  const updated = new Date(current);
  updated.setHours(hours, minutes, 0, 0);
  return updated;
}
