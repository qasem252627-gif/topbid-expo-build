import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDualCurrency } from "@/lib/currency";
import { formatProductNumber, getAuctionImageSource, getAuctionTitle, formatTimeLeft, type Auction } from "@/lib/auction-utils";
import { isAuctionEndingSoon } from "@/lib/auction-timing";
import { favoritesCopy } from "@/lib/favorites-copy";
import { auctionCopy } from "@/lib/auction-copy";
import { useExchangeRate } from "@/lib/exchange-rate";
import { useLanguage } from "@/lib/i18n";

const colors = { ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", amber: "#E3A63A", paper: "#FFFFFF", line: "#E8E5DE", wash: "#F7F6F2" };

export function AuctionCard({ auction, onPress, now, isFavorite = false, onToggleFavorite }: { auction: Auction; onPress: () => void; now: number; isFavorite?: boolean; onToggleFavorite?: () => void }) {
  const { language, isRTL, t } = useLanguage();
  const savedCopy = favoritesCopy[language];
  const listingCopy = auctionCopy[language];
  const exchangeRate = useExchangeRate();
  const prices = formatDualCurrency(auction.currentPrice, auction.currency, language, exchangeRate);
  const category = auction.category === "electronics" ? t("electronics") : t("homeGoods");
  const notStarted = new Date(auction.startsAt).getTime() > now;
  const endingSoon = !notStarted && isAuctionEndingSoon(auction.endsAt, now);
  const countdownTarget = notStarted ? auction.startsAt : auction.endsAt;
  const demoLabel = language === "en" ? "Sample" : language === "ku" ? "نموونە" : "عرض تجريبي";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.imageWrap}>
        <Image source={getAuctionImageSource(auction.imageKey, auction.category)} contentFit="cover" style={styles.image} />
        {onToggleFavorite ? <Pressable
          onPress={(event) => { event.stopPropagation(); onToggleFavorite(); }}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? savedCopy.remove : savedCopy.add}
          style={[styles.favoriteButton, { right: isRTL ? undefined : 7, left: isRTL ? 7 : undefined }]}
        ><Ionicons name={isFavorite ? "heart" : "heart-outline"} size={19} color={isFavorite ? "#C84040" : colors.ink} /></Pressable> : null}
        {auction.isDemo && <View style={[styles.demoTag, { left: isRTL ? undefined : 7, right: isRTL ? 7 : undefined }]}><Text style={styles.demoText}>{demoLabel}</Text></View>}
        <View style={[styles.timeTag, notStarted && styles.scheduledTimeTag, endingSoon && styles.urgentTimeTag]}><Ionicons name="time-outline" size={13} color={notStarted ? colors.teal : endingSoon ? "#B42318" : "white"} /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.timeText, notStarted && styles.scheduledTimeText, endingSoon && styles.urgentTimeText]}>{notStarted ? `${listingCopy.startsIn} ${formatTimeLeft(countdownTarget, language, now)}` : formatTimeLeft(countdownTarget, language, now)}</Text></View>
      </View>
      <View style={[styles.info, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        <View style={[styles.metaRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text style={[styles.category, { textAlign: isRTL ? "right" : "left" }]}>{category}</Text>
          <Text style={styles.productNumber}>{formatProductNumber(auction.id)}</Text>
        </View>
        <Text numberOfLines={2} style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{getAuctionTitle(auction, language)}</Text>
        <View style={[styles.priceBlock, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
          <Text style={styles.price}>{prices.primary}</Text>
          <Text style={styles.converted}>{prices.secondary} · {t("approximate")}</Text>
        </View>
        <View style={[styles.footer, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text style={styles.currentLabel}>{t("currentBid")}</Text>
          <View style={[styles.bidPill, notStarted && styles.scheduledBidPill]}><Text style={styles.bidPillText}>{notStarted ? listingCopy.startsIn : t("bidNow")}</Text></View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 18, padding: 8, gap: 8, borderWidth: 1, borderColor: colors.line, marginBottom: 12, width: "48%" },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  imageWrap: { width: "100%", aspectRatio: 1, borderRadius: 14, overflow: "hidden", backgroundColor: colors.wash, position: "relative" },
  image: { width: "100%", height: "100%" },
  favoriteButton: { position: "absolute", top: 7, width: 35, height: 35, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.96)", alignItems: "center", justifyContent: "center", elevation: 2 },
  demoTag: { position: "absolute", top: 7, backgroundColor: "rgba(255,244,222,0.96)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  demoText: { color: "#7C570F", fontSize: 9, fontWeight: "800" },
  timeTag: { position: "absolute", bottom: 6, left: 6, right: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "rgba(23,43,42,0.9)", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 6 },
  urgentTimeTag: { backgroundColor: "#FEE4E2" },
  scheduledTimeTag: { backgroundColor: "rgba(231,243,240,0.96)" },
  timeText: { flexShrink: 1, color: "white", fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] },
  scheduledTimeText: { color: colors.ink, fontSize: 10 },
  urgentTimeText: { color: "#B42318" },
  info: { flex: 1, justifyContent: "space-between", paddingVertical: 2, gap: 5, minHeight: 126 },
  metaRow: { width: "100%", minHeight: 14, alignItems: "center", justifyContent: "space-between", gap: 4 },
  category: { color: colors.teal, fontSize: 9, fontWeight: "700", flexShrink: 1 },
  productNumber: { color: colors.muted, fontSize: 7, fontWeight: "700", flexShrink: 1, writingDirection: "ltr" },
  title: { color: colors.ink, fontSize: 13, lineHeight: 18, minHeight: 36, fontWeight: "700" },
  priceBlock: { gap: 2, minHeight: 34, justifyContent: "center" },
  price: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  converted: { color: colors.muted, fontSize: 9 },
  footer: { minHeight: 25, alignItems: "center", justifyContent: "space-between", marginTop: 2, gap: 3 },
  currentLabel: { color: colors.muted, fontSize: 8, flexShrink: 1 },
  bidPill: { backgroundColor: "#E7F3F0", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  scheduledBidPill: { backgroundColor: "#FFF4DE" },
  bidPillText: { color: colors.teal, fontWeight: "700", fontSize: 9 },
});
