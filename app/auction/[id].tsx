import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AuctionGallery } from "@/components/auction-gallery";
import { formatProductNumber, getAuctionDescription, getAuctionTitle, formatTimeLeft } from "@/lib/auction-utils";
import { formatCurrency, formatDualCurrency } from "@/lib/currency";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { auctionCopy } from "@/lib/auction-copy";
import { auctionManageCopy } from "@/lib/auction-manage-copy";
import { isAuctionEndingSoon } from "@/lib/auction-timing";
import { useExchangeRate } from "@/lib/exchange-rate";
import { useDeliveryFee } from "@/lib/use-delivery-fee";
import { accountPagesCopy } from "@/lib/account-pages-copy";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", amber: "#E3A63A", red: "#B42318", white: "#FFFFFF", line: "#E8E5DE" };

export default function AuctionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auctionId = Number(id);
  const { language, isRTL, t } = useLanguage();
  const listingCopy = auctionCopy[language];
  const manageCopy = auctionManageCopy[language];
  const pageCopy = accountPagesCopy[language];
  const { user } = useAuth();
  const exchangeRate = useExchangeRate();
  const deliveryFee = useDeliveryFee();
  const profile = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user) });
  const query = trpc.auctions.detail.useQuery({ id: auctionId }, { enabled: Number.isInteger(auctionId) && auctionId > 0, refetchInterval: 5_000, refetchIntervalInBackground: false });
  const utils = trpc.useUtils();
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingBid, setPendingBid] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const bidMutation = trpc.auctions.placeBid.useMutation({
    onSuccess: async (result) => {
      setPendingBid(null);
      setNotice(result.extended ? `${t("successBid")} ${listingCopy.endExtendedNotice}` : t("successBid"));
      await Promise.all([utils.auctions.detail.invalidate({ id: auctionId }), utils.auctions.myBids.invalidate()]);
    },
    onError: () => setPendingBid(null),
  });
  const cancelMutation = trpc.auctions.cancel.useMutation({
    onSuccess: async () => {
      setConfirmDelete(false);
      await Promise.all([utils.auctions.detail.invalidate({ id: auctionId }), utils.auctions.list.invalidate()]);
      router.back();
    },
  });
  const auction = query.data?.auction;
  const isAdmin = profile.data?.role === "admin";
  const minimum = auction ? Number(auction.currentPrice) + Number(auction.minIncrement) : 0;
  const notStarted = Boolean(auction && new Date(auction.startsAt).getTime() > now);

  async function submitBid() {
    if (!user) { router.push("/login"); return; }
    if (notStarted) { setNotice(listingCopy.notStarted); return; }
    if (!profile.data?.phone) {
      setNotice(listingCopy.phoneRequiredToBid);
      router.push("/(tabs)/account");
      return;
    }
    const parsed = Number((amount.trim() || String(minimum)).replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed < minimum) { setNotice(t("minBidError")); return; }
    setNotice("");
    setPendingBid(parsed);
  }

  function confirmBid() {
    if (pendingBid === null) return;
    bidMutation.mutate({ auctionId, amount: pendingBid });
  }

  if (query.isLoading) return <ScreenContainer><View style={styles.loading}><ActivityIndicator color={C.teal} /><Text style={styles.muted}>{t("loading")}</Text></View></ScreenContainer>;
  if (query.error || !auction) return <ScreenContainer><View style={styles.loading}><Text style={styles.title}>{t("failed")}</Text><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>{t("close")}</Text></Pressable></View></ScreenContainer>;

  const prices = formatDualCurrency(auction.currentPrice, auction.currency, language, exchangeRate);
  const endingSoon = !notStarted && isAuctionEndingSoon(auction.endsAt, now);
  const primaryLabel = auction.category === "electronics" ? t("electronics") : t("homeGoods");
  const history = query.data?.recentBids ?? [];
  const purchasePrices = auction.purchasePrice == null ? null : formatDualCurrency(auction.purchasePrice, auction.currency, language, exchangeRate);
  const deliveryPrices = formatDualCurrency(deliveryFee.amount, deliveryFee.currency, language, exchangeRate);
  const itemDetails = parseItemDetails(auction.itemDetails);
  const conditionLabels = { new: listingCopy.conditionNew, like_new: listingCopy.conditionLikeNew, good: listingCopy.conditionGood, fair: listingCopy.conditionFair };
  const cancelled = auction.status === "cancelled";
  const ended = !cancelled && (auction.status === "ended" || new Date(auction.endsAt).getTime() <= now);
  const canManage = isAdmin && auction.status === "active" && !ended;
  const galleryImages = query.data?.images?.length ? query.data.images : [auction.imageKey];
  const bidErrorMessage = bidMutation.error?.message ?? "";

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.toolbar, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={20} color={C.ink} /></Pressable>
          <Text style={styles.toolbarTitle}>{t("details")}</Text>
          {canManage ? (
            <View style={[manageStyles.tools, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Pressable
                onPress={() => router.push({ pathname: "/edit-auction/[id]", params: { id: String(auction.id) } })}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel={manageCopy.editAuction}
              ><Ionicons name="create-outline" size={20} color={C.teal} /></Pressable>
              <Pressable
                onPress={() => { cancelMutation.reset(); setConfirmDelete(true); }}
                style={[styles.backButton, manageStyles.deleteButton]}
                accessibilityRole="button"
                accessibilityLabel={manageCopy.deleteAuction}
              ><Ionicons name="trash-outline" size={20} color={C.red} /></Pressable>
            </View>
          ) : <View style={{ width: 42 }} />}
        </View>
        <AuctionGallery
          images={galleryImages}
          category={auction.category}
          badge={primaryLabel}
          positionLabel={(current, total) => manageCopy.photoPosition.replace("{current}", String(current)).replace("{total}", String(total))}
        />
        {auction.isDemo ? <View style={{ position: "absolute", top: 72, right: isRTL ? undefined : 28, left: isRTL ? 28 : undefined, backgroundColor: "#FFF4DE", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 }}><Text style={{ color: "#7C570F", fontSize: 10, fontWeight: "800" }}>{language === "en" ? "Sample" : language === "ku" ? "نموونە" : "عرض تجريبي"}</Text></View> : null}
        {cancelled ? <View style={[manageStyles.cancelledBanner, { flexDirection: isRTL ? "row-reverse" : "row" }]}><Ionicons name="close-circle-outline" size={18} color={C.red} /><Text style={[manageStyles.cancelledText, { textAlign: isRTL ? "right" : "left" }]}>{manageCopy.cancelledNotice}</Text></View> : null}
        <View style={[styles.info, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
          {!cancelled ? (
            <View style={[styles.timeLine, endingSoon && timingStyles.urgentTimeLine, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="time-outline" size={22} color={ended ? C.muted : endingSoon ? C.red : "#986817"} />
              <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", flexShrink: 1 }}>
                <Text style={styles.timeLabel}>{ended ? t("ended") : notStarted ? listingCopy.startsIn : t("endsIn")}</Text>
                {!ended ? <Text style={[styles.timeText, endingSoon && timingStyles.urgentTimeText]}>{formatTimeLeft(notStarted ? auction.startsAt : auction.endsAt, language, now)}</Text> : null}
                {notStarted ? <Text style={styles.muted}>{listingCopy.startsAt}: {new Date(auction.startsAt).toLocaleString(language === "en" ? "en-IQ" : language === "ku" ? "ku-IQ" : "ar-IQ", { dateStyle: "medium", timeStyle: "short" })}</Text> : null}
              </View>
            </View>
          ) : null}
          <View style={[productNumberStyles.line, { flexDirection: isRTL ? "row-reverse" : "row" }]}><Ionicons name="pricetag-outline" size={14} color={C.teal} /><Text style={productNumberStyles.label}>{listingCopy.productNumber}:</Text><Text style={productNumberStyles.value}>{formatProductNumber(auction.id)}</Text></View>
          <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{getAuctionTitle(auction, language)}</Text>
          <Text style={[styles.description, { textAlign: isRTL ? "right" : "left" }]}>{getAuctionDescription(auction, language)}</Text>
        </View>
        {itemDetails && (itemDetails.brand || itemDetails.model || itemDetails.condition || itemDetails.usagePeriod || itemDetails.warranty || itemDetails.accessories) ? (
          <View style={detailStyles.specCard}>
            <Text style={[detailStyles.specTitle, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.deviceDetails}</Text>
            {itemDetails.brand ? <SpecRow label={listingCopy.detailBrand} value={itemDetails.brand} isRTL={isRTL} /> : null}
            {itemDetails.model ? <SpecRow label={listingCopy.detailModel} value={itemDetails.model} isRTL={isRTL} /> : null}
            {itemDetails.condition ? <SpecRow label={listingCopy.detailCondition} value={conditionLabels[itemDetails.condition] ?? itemDetails.condition} isRTL={isRTL} /> : null}
            {itemDetails.usagePeriod ? <SpecRow label={listingCopy.detailUsage} value={itemDetails.usagePeriod} isRTL={isRTL} /> : null}
            {itemDetails.warranty ? <SpecRow label={listingCopy.detailWarranty} value={itemDetails.warranty} isRTL={isRTL} /> : null}
            {itemDetails.accessories ? <SpecRow label={listingCopy.detailAccessories} value={itemDetails.accessories} isRTL={isRTL} /> : null}
          </View>
        ) : null}
        {purchasePrices && Number(auction.purchasePrice) > 0 ? (
          <View style={detailStyles.purchaseCard}>
            <Text style={[detailStyles.purchaseLabel, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.purchasePrice}</Text>
            <Text style={[detailStyles.purchaseValue, { textAlign: isRTL ? "right" : "left" }]}>{purchasePrices.primary}</Text>
            <Text style={[detailStyles.purchaseSecondary, { textAlign: isRTL ? "right" : "left" }]}>{purchasePrices.secondary} · {t("approximate")}</Text>
            <Text style={[detailStyles.purchaseNote, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.purchasePriceUnverified}</Text>
          </View>
        ) : null}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>{t("currentBid")}</Text>
          <Text style={styles.currentPrice}>{prices.primary}</Text>
          <Text style={styles.secondaryPrice}>{prices.secondary} · {t("approximate")}</Text>
          <View style={styles.divider} />
          <View style={[styles.minimumRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}><Text style={styles.priceLabel}>{t("minimumBid")}</Text><Text style={styles.minimumValue}>{formatCurrency(minimum, auction.currency, language)}</Text></View>
        </View>

        {!cancelled ? <View style={styles.bidCard}>
          <Text style={[styles.bidTitle, { textAlign: isRTL ? "right" : "left" }]}>{t("bidAmount")}</Text>
          <View style={[styles.bidInputRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Pressable onPress={() => setAmount(String(Math.max(minimum, Number(amount || minimum) - Number(auction.minIncrement))))} style={styles.stepButton}><Ionicons name="remove" size={18} color={C.ink} /></Pressable>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" selectTextOnFocus style={styles.amountInput} textAlign="center" accessibilityLabel={t("bidAmount")} />
            <Pressable onPress={() => setAmount(String(Number(amount || minimum) + Number(auction.minIncrement)))} style={styles.stepButton}><Ionicons name="add" size={18} color={C.ink} /></Pressable>
            <Text style={styles.currencyTag}>{auction.currency}</Text>
          </View>
          <Text style={[styles.incrementText, { textAlign: isRTL ? "right" : "left" }]}>{t("increment")}: {formatCurrency(auction.minIncrement, auction.currency, language)}</Text>
          {notStarted ? <Text style={[styles.loginHint, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.notStarted}</Text> : null}
          {!notStarted && auction.status === "active" ? <Text style={[timingStyles.closingRule, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.closingExtensionRule}</Text> : null}
          <View style={bidDialogStyles.deliveryInfo}>
            <View style={[bidDialogStyles.deliveryHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="car-outline" size={16} color={C.teal} />
              <Text style={[bidDialogStyles.deliveryLabel, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.deliveryFee}</Text>
              <Text style={bidDialogStyles.deliveryAmount}>{deliveryFee.amount === 0 ? pageCopy.freeDelivery : deliveryPrices.primary}</Text>
            </View>
            {deliveryFee.amount > 0 ? <Text style={[bidDialogStyles.deliverySecondary, { textAlign: isRTL ? "right" : "left" }]}>{deliveryPrices.secondary} · {t("approximate")}</Text> : null}
            <Text style={[bidDialogStyles.deliveryNote, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.deliveryFeeNote}</Text>
          </View>
          {notice ? <Text style={[styles.notice, bidMutation.error && styles.errorNotice]}>{notice}</Text> : null}
          {bidMutation.error ? <Text style={styles.errorNotice}>{bidErrorMessage.includes("AUCTION_NOT_STARTED") ? listingCopy.notStarted : bidErrorMessage.includes("PHONE_NOT_VERIFIED") ? manageCopy.phoneNotVerified : bidErrorMessage.includes("PHONE_REQUIRED") ? listingCopy.phoneRequiredToBid : bidErrorMessage.includes("own item") ? listingCopy.selfBidError : bidErrorMessage.includes("minimum") ? t("minBidError") : t("failed")}</Text> : null}
          {!user ? <Text style={styles.loginHint}>{t("signInToBid")}</Text> : null}
          {user && !profile.isLoading && !profile.data?.phone ? <Text style={styles.loginHint}>{listingCopy.phoneRequiredToBid}</Text> : null}
          <Pressable onPress={submitBid} disabled={bidMutation.isPending || profile.isLoading || notStarted} style={[styles.submit, (bidMutation.isPending || profile.isLoading || notStarted) && { opacity: 0.65 }]}>
            {bidMutation.isPending || (user && profile.isLoading) ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{notStarted ? listingCopy.startsAt : !user ? t("signInToBid") : !profile.data?.phone ? listingCopy.completeProfile : t("placeBid")}</Text>}
          </Pressable>
        </View> : null}

        <View style={styles.historySection}>
          <Text style={[styles.historyTitle, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.recentBiddersTitle}</Text>
          <Text style={[styles.muted, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.recentBiddersNote}</Text>
          {history.length === 0 ? <Text style={styles.muted}>{t("noBids")}</Text> : history.map((entry) => (
            <View key={entry.id} style={[styles.historyRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={styles.historyDot} />
              <Text style={{ flex: 1, color: C.ink, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>{entry.bidderName?.trim() || listingCopy.bidderUnknown}</Text>
              <Text style={styles.historyDate}>{new Date(entry.createdAt).toLocaleDateString(language === "en" ? "en-US" : language === "ku" ? "ckb-IQ" : "ar-IQ")}</Text>
              <Text style={styles.historyAmount}>{formatCurrency(entry.amount, auction.currency, language)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Modal
        visible={pendingBid !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { if (!bidMutation.isPending) setPendingBid(null); }}
      >
        <View style={bidDialogStyles.backdrop}>
          <View style={bidDialogStyles.dialog} accessibilityViewIsModal>
            <View style={[bidDialogStyles.iconCircle, { alignSelf: isRTL ? "flex-end" : "flex-start" }]}>
              <Ionicons name="information-circle-outline" size={24} color={C.teal} />
            </View>
            <Text style={[bidDialogStyles.title, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.bidConfirmTitle}</Text>
            <Text style={[bidDialogStyles.body, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.bidConfirmBody}</Text>
            {pendingBid !== null ? (
              <View style={bidDialogStyles.bidSummary}>
                <Text style={[bidDialogStyles.summaryLabel, { textAlign: isRTL ? "right" : "left" }]}>{t("bidAmount")}</Text>
                <Text style={[bidDialogStyles.bidAmount, { textAlign: isRTL ? "right" : "left" }]}>{formatCurrency(pendingBid, auction.currency, language)}</Text>
              </View>
            ) : null}
            <View style={bidDialogStyles.deliveryInfo}>
              <View style={[bidDialogStyles.deliveryHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Ionicons name="car-outline" size={16} color={C.teal} />
                <Text style={[bidDialogStyles.deliveryLabel, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.deliveryFee}</Text>
                <Text style={bidDialogStyles.deliveryAmount}>{deliveryFee.amount === 0 ? pageCopy.freeDelivery : deliveryPrices.primary}</Text>
              </View>
              {deliveryFee.amount > 0 ? <Text style={[bidDialogStyles.deliverySecondary, { textAlign: isRTL ? "right" : "left" }]}>{deliveryPrices.secondary} · {t("approximate")}</Text> : null}
              <Text style={[bidDialogStyles.deliveryNote, { textAlign: isRTL ? "right" : "left" }]}>{listingCopy.deliveryFeeNote}</Text>
            </View>
            <View style={[bidDialogStyles.actions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Pressable
                onPress={() => setPendingBid(null)}
                disabled={bidMutation.isPending}
                style={[bidDialogStyles.cancelButton, bidMutation.isPending && bidDialogStyles.disabledButton]}
              >
                <Text style={bidDialogStyles.cancelText}>{listingCopy.cancelBid}</Text>
              </Pressable>
              <Pressable
                onPress={confirmBid}
                disabled={bidMutation.isPending}
                style={[bidDialogStyles.confirmButton, bidMutation.isPending && bidDialogStyles.disabledButton]}
              >
                {bidMutation.isPending ? <ActivityIndicator color={C.white} /> : <Text style={bidDialogStyles.confirmText}>{listingCopy.confirmBid}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { if (!cancelMutation.isPending) setConfirmDelete(false); }}
      >
        <View style={bidDialogStyles.backdrop}>
          <View style={bidDialogStyles.dialog} accessibilityViewIsModal>
            <View style={[bidDialogStyles.iconCircle, manageStyles.deleteIcon, { alignSelf: isRTL ? "flex-end" : "flex-start" }]}>
              <Ionicons name="trash-outline" size={22} color={C.red} />
            </View>
            <Text style={[bidDialogStyles.title, { textAlign: isRTL ? "right" : "left" }]}>{manageCopy.deleteTitle}</Text>
            <Text style={[bidDialogStyles.body, { textAlign: isRTL ? "right" : "left" }]}>{manageCopy.deleteBody}</Text>
            {cancelMutation.error ? <Text style={[styles.errorNotice, { textAlign: isRTL ? "right" : "left" }]}>{manageCopy.deleteFailed}</Text> : null}
            <View style={[bidDialogStyles.actions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Pressable onPress={() => setConfirmDelete(false)} disabled={cancelMutation.isPending} style={[bidDialogStyles.cancelButton, cancelMutation.isPending && bidDialogStyles.disabledButton]}>
                <Text style={bidDialogStyles.cancelText}>{manageCopy.keep}</Text>
              </Pressable>
              <Pressable onPress={() => cancelMutation.mutate({ id: auction.id })} disabled={cancelMutation.isPending} style={[bidDialogStyles.confirmButton, manageStyles.deleteConfirm, cancelMutation.isPending && bidDialogStyles.disabledButton]}>
                {cancelMutation.isPending ? <ActivityIndicator color={C.white} /> : <Text style={bidDialogStyles.confirmText}>{manageCopy.deleteConfirm}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

type ItemDetails = { brand?: string; model?: string; condition?: "new" | "like_new" | "good" | "fair"; usagePeriod?: string; warranty?: string; accessories?: string };

function parseItemDetails(value: string | null | undefined): ItemDetails | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed as ItemDetails : null;
  } catch {
    return null;
  }
}

function SpecRow({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  return <View style={[detailStyles.specRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}><Text style={detailStyles.specLabel}>{label}</Text><Text style={[detailStyles.specValue, { textAlign: isRTL ? "left" : "right" }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, backgroundColor: C.bg, minHeight: "100%", maxWidth: 620, width: "100%", alignSelf: "center" }, toolbar: { alignItems: "center", justifyContent: "space-between", marginBottom: 14 }, backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }, backText: { color: C.teal, fontWeight: "800" }, toolbarTitle: { color: C.ink, fontSize: 14, fontWeight: "800" }, imageWrap: { height: 270, overflow: "hidden", borderRadius: 23, backgroundColor: "#E8E5DE", position: "relative" }, image: { width: "100%", height: "100%" }, imageTag: { position: "absolute", top: 12, left: 12, backgroundColor: "rgba(255,255,255,0.93)", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99 }, imageTagText: { color: C.teal, fontSize: 11, fontWeight: "800" }, info: { paddingTop: 17, gap: 8 }, timeLine: { alignSelf: "stretch", alignItems: "center", gap: 10, backgroundColor: "#FFF8EA", borderWidth: 1, borderColor: "#F1DFB8", borderRadius: 17, paddingHorizontal: 14, paddingVertical: 11 }, timeLabel: { color: C.muted, fontSize: 11, fontWeight: "800" }, timeText: { color: "#986817", fontSize: 22, lineHeight: 29, fontWeight: "900", fontVariant: ["tabular-nums"] }, title: { color: C.ink, fontSize: 22, lineHeight: 29, fontWeight: "900" }, description: { color: C.muted, fontSize: 13, lineHeight: 21 }, priceCard: { marginTop: 17, padding: 17, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }, priceLabel: { color: C.muted, fontSize: 11, fontWeight: "700" }, currentPrice: { color: C.ink, fontSize: 26, fontWeight: "900", marginTop: 3 }, secondaryPrice: { color: C.muted, fontSize: 11, marginTop: 4 }, divider: { height: 1, backgroundColor: C.line, marginVertical: 13 }, minimumRow: { justifyContent: "space-between", alignItems: "center" }, minimumValue: { color: C.teal, fontSize: 12, fontWeight: "800" }, bidCard: { marginTop: 13, padding: 17, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, gap: 8 }, bidTitle: { color: C.ink, fontSize: 14, fontWeight: "900" }, bidInputRow: { alignItems: "center", gap: 8 }, stepButton: { height: 39, width: 39, borderRadius: 13, backgroundColor: "#F0EEE8", alignItems: "center", justifyContent: "center" }, amountInput: { flex: 1, color: C.ink, fontSize: 17, fontWeight: "900", height: 45, borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 9 }, currencyTag: { color: C.muted, fontSize: 10, fontWeight: "800" }, incrementText: { color: C.muted, fontSize: 10 }, notice: { color: C.teal, fontSize: 11, fontWeight: "700" }, errorNotice: { color: "#A33128", fontSize: 11, fontWeight: "700" }, loginHint: { color: C.muted, fontSize: 10 }, submit: { marginTop: 2, minHeight: 47, backgroundColor: C.teal, borderRadius: 15, alignItems: "center", justifyContent: "center" }, submitText: { color: C.white, fontSize: 13, fontWeight: "900" }, historySection: { marginTop: 22, gap: 9, paddingBottom: 20 }, historyTitle: { color: C.ink, fontSize: 15, fontWeight: "900", marginBottom: 2 }, historyRow: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 11, alignItems: "center", gap: 9 }, historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.amber }, historyDate: { flex: 1, color: C.muted, fontSize: 11 }, historyAmount: { color: C.ink, fontSize: 11, fontWeight: "800" }, muted: { color: C.muted, fontSize: 12 }, loading: { flex: 1, minHeight: 230, alignItems: "center", justifyContent: "center", gap: 12 },
});

const timingStyles = StyleSheet.create({
  urgentTimeLine: { backgroundColor: "#FEE4E2", borderColor: "#F7C3BE" },
  urgentTimeText: { color: C.red },
  closingRule: { color: C.red, backgroundColor: "#FEF2F2", borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8, fontSize: 10, lineHeight: 15, fontWeight: "700" },
});

const manageStyles = StyleSheet.create({
  tools: { gap: 8 },
  deleteButton: { borderColor: "#F7C3BE", backgroundColor: "#FFF5F4" },
  deleteIcon: { backgroundColor: "#FEE4E2" },
  deleteConfirm: { backgroundColor: C.red },
  cancelledBanner: { marginTop: 13, alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#F2C1BD", borderRadius: 15, padding: 12 },
  cancelledText: { flex: 1, color: C.red, fontSize: 12, lineHeight: 18, fontWeight: "800" },
});

const productNumberStyles = StyleSheet.create({
  line: { alignItems: "center", gap: 6, backgroundColor: "#E7F3F0", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  label: { color: C.teal, fontSize: 10, fontWeight: "800" },
  value: { color: C.ink, fontSize: 10, fontWeight: "900", writingDirection: "ltr", letterSpacing: 0.3 },
});

const detailStyles = StyleSheet.create({
  specCard: { marginTop: 13, padding: 16, borderRadius: 19, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, gap: 11 },
  purchaseCard: { marginTop: 13, padding: 16, borderRadius: 19, backgroundColor: "#FFF9EC", borderWidth: 1, borderColor: "#F0D9A9", gap: 5 },
  purchaseLabel: { color: C.muted, fontSize: 11, fontWeight: "800" },
  purchaseValue: { color: C.ink, fontSize: 19, fontWeight: "900" },
  purchaseSecondary: { color: C.muted, fontSize: 11 },
  purchaseNote: { color: "#8B5E0A", fontSize: 10, lineHeight: 15, marginTop: 3 },
  specTitle: { color: C.ink, fontSize: 14, fontWeight: "900", marginBottom: 1 },
  specRow: { alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  specLabel: { color: C.muted, fontSize: 11, fontWeight: "700", flex: 1 },
  specValue: { color: C.ink, fontSize: 11, fontWeight: "800", flex: 2 },
});

const bidDialogStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "rgba(18, 37, 35, 0.58)" },
  dialog: { width: "100%", maxWidth: 430, borderRadius: 24, padding: 20, gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, elevation: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F3F0" },
  title: { color: C.ink, fontSize: 18, lineHeight: 24, fontWeight: "900" },
  body: { color: C.muted, fontSize: 13, lineHeight: 20 },
  bidSummary: { padding: 13, borderRadius: 15, backgroundColor: "#F7F6F2", gap: 4 },
  summaryLabel: { color: C.muted, fontSize: 11, fontWeight: "700" },
  bidAmount: { color: C.ink, fontSize: 20, fontWeight: "900" },
  deliveryInfo: { padding: 12, borderRadius: 15, backgroundColor: "#F0F7F5", borderWidth: 1, borderColor: "#D8EAE6", gap: 4 },
  deliveryHeader: { alignItems: "center", gap: 7 },
  deliveryLabel: { flex: 1, color: C.ink, fontSize: 12, fontWeight: "800" },
  deliveryAmount: { color: C.teal, fontSize: 13, fontWeight: "900" },
  deliverySecondary: { color: C.muted, fontSize: 11 },
  deliveryNote: { color: C.muted, fontSize: 10, lineHeight: 15 },
  actions: { gap: 9, marginTop: 3 },
  cancelButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F0EEE8" },
  cancelText: { color: C.ink, fontSize: 12, fontWeight: "800" },
  confirmButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.teal },
  confirmText: { color: C.white, fontSize: 12, fontWeight: "900" },
  disabledButton: { opacity: 0.6 },
});
