import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { auctionCopy } from "@/lib/auction-copy";
import { auctionManageCopy } from "@/lib/auction-manage-copy";
import { AUCTION_DURATION_OPTIONS_DAYS } from "@/lib/auction-duration";
import { getAuctionDescription, getAuctionTitle } from "@/lib/auction-utils";
import { useLanguage } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", red: "#B42318", white: "#FFFFFF", line: "#E8E5DE" };
type Condition = "new" | "like_new" | "good" | "fair";
type ItemDetails = { brand: string; model: string; condition: Condition; usagePeriod: string; warranty: string; accessories: string };

function parseDetails(value: string | null | undefined): ItemDetails {
  const fallback: ItemDetails = { brand: "", model: "", condition: "good", usagePeriod: "", warranty: "", accessories: "" };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as Partial<ItemDetails>;
    const condition = ["new", "like_new", "good", "fair"].includes(String(parsed.condition)) ? parsed.condition as Condition : "good";
    return {
      brand: String(parsed.brand ?? ""),
      model: String(parsed.model ?? ""),
      condition,
      usagePeriod: String(parsed.usagePeriod ?? ""),
      warranty: String(parsed.warranty ?? ""),
      accessories: String(parsed.accessories ?? ""),
    };
  } catch {
    return fallback;
  }
}

export default function EditAuctionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auctionId = Number(id);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language, isRTL } = useLanguage();
  const copy = auctionCopy[language];
  const manage = auctionManageCopy[language];
  const profile = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user) });
  const detail = trpc.auctions.detail.useQuery({ id: auctionId }, { enabled: Number.isInteger(auctionId) && auctionId > 0 });
  const [openedAt] = useState(() => Date.now());
  const isAdmin = profile.data?.role === "admin";

  if (loading || profile.isLoading || detail.isLoading) {
    return <ScreenContainer><View style={styles.center}><ActivityIndicator color={C.teal} /></View></ScreenContainer>;
  }
  if (!user || !isAdmin) {
    return <ScreenContainer><View style={styles.center}><Text style={styles.notice}>{manage.adminOnly}</Text><Pressable onPress={() => router.back()} style={styles.secondaryButton}><Text style={styles.secondaryText}>{manage.keep}</Text></Pressable></View></ScreenContainer>;
  }
  const auction = detail.data?.auction;
  if (!auction || auction.status !== "active" || new Date(auction.endsAt).getTime() <= openedAt) {
    return <ScreenContainer><View style={styles.center}><Text style={styles.notice}>{manage.notEditable}</Text><Pressable onPress={() => router.back()} style={styles.secondaryButton}><Text style={styles.secondaryText}>{manage.keep}</Text></Pressable></View></ScreenContainer>;
  }

  return (
    <EditAuctionForm
      key={auction.id}
      auctionId={auction.id}
      currency={auction.currency}
      initialTitle={getAuctionTitle(auction, language)}
      initialDescription={getAuctionDescription(auction, language)}
      initialDetails={parseDetails(auction.itemDetails)}
      initialStartingPrice={String(Number(auction.startingPrice))}
      initialPurchasePrice={auction.purchasePrice == null ? "" : String(Number(auction.purchasePrice))}
      termsLocked={(detail.data?.recentBids.length ?? 0) > 0}
      isRTL={isRTL}
      copy={copy}
      manage={manage}
      onClose={() => router.back()}
    />
  );
}

function EditAuctionForm(props: {
  auctionId: number;
  currency: "IQD" | "USD";
  initialTitle: string;
  initialDescription: string;
  initialDetails: ItemDetails;
  initialStartingPrice: string;
  initialPurchasePrice: string;
  termsLocked: boolean;
  isRTL: boolean;
  copy: (typeof auctionCopy)[keyof typeof auctionCopy];
  manage: (typeof auctionManageCopy)[keyof typeof auctionManageCopy];
  onClose: () => void;
}) {
  const { copy, manage, isRTL } = props;
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(props.initialTitle);
  const [description, setDescription] = useState(props.initialDescription);
  const [details, setDetails] = useState<ItemDetails>(props.initialDetails);
  const [startingPrice, setStartingPrice] = useState(props.initialStartingPrice);
  const [purchasePrice, setPurchasePrice] = useState(props.initialPurchasePrice);
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [error, setError] = useState("");
  const update = trpc.auctions.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.auctions.detail.invalidate({ id: props.auctionId }),
        utils.auctions.list.invalidate(),
      ]);
      props.onClose();
    },
    onError: (mutationError) => setError(mutationError.message.includes("AUCTION_HAS_BIDS") ? manage.termsLocked : mutationError.message.includes("AUCTION_NOT_EDITABLE") ? manage.notEditable : manage.editFailed),
  });

  const conditions: { value: Condition; label: string }[] = [
    { value: "new", label: copy.conditionNew },
    { value: "like_new", label: copy.conditionLikeNew },
    { value: "good", label: copy.conditionGood },
    { value: "fair", label: copy.conditionFair },
  ];
  const align = { textAlign: isRTL ? "right" : "left" } as const;
  const row = { flexDirection: isRTL ? "row-reverse" : "row" } as const;

  function setDetail<K extends keyof ItemDetails>(key: K, value: ItemDetails[K]) {
    setDetails((previous) => ({ ...previous, [key]: value }));
  }

  function save() {
    setError("");
    if (title.trim().length < 3 || description.trim().length < 5) { setError(copy.requiredFields); return; }
    const payload: Parameters<typeof update.mutate>[0] = {
      id: props.auctionId,
      title: title.trim(),
      description: description.trim(),
      itemDetails: {
        brand: details.brand.trim(),
        model: details.model.trim(),
        condition: details.condition,
        usagePeriod: details.usagePeriod.trim(),
        warranty: details.warranty.trim(),
        accessories: details.accessories.trim(),
      },
    };
    if (!props.termsLocked) {
      const start = Number(startingPrice.replace(/,/g, ""));
      if (!Number.isFinite(start) || start <= 0 || (props.currency === "IQD" && !Number.isInteger(start))) { setError(copy.invalidPrice); return; }
      const purchaseText = purchasePrice.replace(/,/g, "").trim();
      const purchase = purchaseText ? Number(purchaseText) : null;
      if (purchase !== null && (!Number.isFinite(purchase) || purchase <= 0)) { setError(copy.invalidPrice); return; }
      if (start !== Number(props.initialStartingPrice) || purchaseText !== props.initialPurchasePrice || durationDays !== null) {
        payload.startingPrice = start;
        payload.purchasePrice = purchase;
        payload.currency = props.currency;
        if (durationDays !== null) payload.durationDays = durationDays;
      }
    }
    update.mutate(payload);
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, row]}>
          <Pressable onPress={props.onClose} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={manage.keep}><Ionicons name="close" size={20} color={C.ink} /></Pressable>
          <Text style={styles.headerTitle}>{manage.editTitle}</Text>
          <View style={{ width: 42 }} />
        </View>
        <Text style={[styles.intro, align]}>{manage.editIntro}</Text>

        <View style={styles.card}>
          <Field label={manage.titleLabel} value={title} onChange={setTitle} isRTL={isRTL} />
          <Field label={manage.descriptionLabel} value={description} onChange={setDescription} isRTL={isRTL} multiline />
        </View>

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, align]}>{copy.deviceDetails}</Text>
          <Field label={copy.brand} value={details.brand} onChange={(value) => setDetail("brand", value)} isRTL={isRTL} />
          <Field label={copy.model} value={details.model} onChange={(value) => setDetail("model", value)} isRTL={isRTL} />
          <Text style={[styles.label, align]}>{copy.condition}</Text>
          <View style={[styles.chipRow, row]}>
            {conditions.map((item) => {
              const selected = details.condition === item.value;
              return <Pressable key={item.value} onPress={() => setDetail("condition", item.value)} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text></Pressable>;
            })}
          </View>
          <Field label={copy.usagePeriod} value={details.usagePeriod} onChange={(value) => setDetail("usagePeriod", value)} isRTL={isRTL} />
          <Field label={copy.warranty} value={details.warranty} onChange={(value) => setDetail("warranty", value)} isRTL={isRTL} />
          <Field label={copy.accessories} value={details.accessories} onChange={(value) => setDetail("accessories", value)} isRTL={isRTL} />
        </View>

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, align]}>{copy.auctionSettings}</Text>
          {props.termsLocked ? (
            <View style={[styles.lockedNote, row]}><Ionicons name="lock-closed-outline" size={16} color={C.muted} /><Text style={[styles.lockedText, align]}>{manage.termsLocked}</Text></View>
          ) : (
            <>
              <Field label={`${manage.startingPriceLabel} (${props.currency})`} value={startingPrice} onChange={setStartingPrice} isRTL={isRTL} numeric />
              <Field label={`${manage.purchasePriceLabel} (${props.currency})`} value={purchasePrice} onChange={setPurchasePrice} isRTL={isRTL} numeric />
              <Text style={[styles.label, align]}>{manage.durationLabel}</Text>
              <View style={[styles.chipRow, row]}>
                <Pressable onPress={() => setDurationDays(null)} style={[styles.chip, durationDays === null && styles.chipSelected]}><Text style={[styles.chipText, durationDays === null && styles.chipTextSelected]}>{manage.keepDuration}</Text></Pressable>
                {AUCTION_DURATION_OPTIONS_DAYS.map((value) => {
                  const selected = durationDays === value;
                  return <Pressable key={value} onPress={() => setDurationDays(value)} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{copy.durationOptions[value]}</Text></Pressable>;
                })}
              </View>
            </>
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={save} disabled={update.isPending} style={[styles.submit, update.isPending && { opacity: 0.65 }]} accessibilityRole="button">
          {update.isPending ? <ActivityIndicator color={C.white} /> : <><Ionicons name="save-outline" size={18} color={C.white} /><Text style={styles.submitText}>{manage.save}</Text></>}
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function Field({ label, value, onChange, isRTL, multiline, numeric }: { label: string; value: string; onChange: (value: string) => void; isRTL: boolean; multiline?: boolean; numeric?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={numeric ? "decimal-pad" : "default"}
        style={[styles.input, multiline && styles.multiline, { textAlign: isRTL ? "right" : "left" }]}
        placeholderTextColor={C.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32, backgroundColor: C.bg, minHeight: "100%", maxWidth: 620, width: "100%", alignSelf: "center" },
  header: { alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: C.ink, fontSize: 16, fontWeight: "900" },
  intro: { color: C.muted, fontSize: 12, lineHeight: 19, marginBottom: 13 },
  card: { backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 15, marginBottom: 12, gap: 12 },
  sectionTitle: { color: C.ink, fontSize: 14, fontWeight: "900" },
  field: { gap: 6 },
  label: { color: C.ink, fontSize: 11, fontWeight: "800" },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: "#FCFBF8", paddingHorizontal: 12, color: C.ink, fontSize: 13 },
  multiline: { minHeight: 96, paddingTop: 11, textAlignVertical: "top" },
  chipRow: { alignItems: "center", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: "#F7F6F2", borderWidth: 1, borderColor: C.line },
  chipSelected: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { color: C.muted, fontSize: 11, fontWeight: "800" },
  chipTextSelected: { color: C.white },
  lockedNote: { alignItems: "center", gap: 8, backgroundColor: "#F7F6F2", borderRadius: 13, padding: 12 },
  lockedText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  error: { color: C.red, fontSize: 12, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  submit: { minHeight: 52, borderRadius: 16, backgroundColor: C.teal, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  submitText: { color: C.white, fontSize: 13, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  notice: { color: C.ink, fontSize: 14, fontWeight: "800", textAlign: "center" },
  secondaryButton: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 13, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  secondaryText: { color: C.teal, fontWeight: "800" },
});
