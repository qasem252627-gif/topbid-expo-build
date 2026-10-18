import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { formatTimeLeft, getAuctionImageSource, getAuctionTitle } from "@/lib/auction-utils";
import { useLanguage } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { notificationCopy } from "@/lib/notification-copy";
import { useBidNotificationRegistration } from "@/hooks/use-bid-notifications";
import { isAuctionEndingSoon } from "@/lib/auction-timing";
import { auctionManageCopy } from "@/lib/auction-manage-copy";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", amber: "#E3A63A", red: "#B42318", white: "#FFFFFF", line: "#E8E5DE" };

type NewBidAlert = {
  accountId: string;
  auctionId: number;
  bidderName: string | null;
  amount: string;
  currency: "IQD" | "USD";
  titleAr: string;
  titleEn: string;
  titleKu: string;
};

export default function MyBidsScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language, isRTL, t } = useLanguage();
  const activityCopy = notificationCopy[language];
  const manageCopy = auctionManageCopy[language];
  const push = useBidNotificationRegistration();
  const [now, setNow] = useState(() => Date.now());
  const [incomingBid, setIncomingBid] = useState<NewBidAlert | null>(null);
  const [deliveryAuctionId, setDeliveryAuctionId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const result = trpc.auctions.myBids.useQuery(undefined, { enabled: Boolean(user), refetchInterval: user ? 5_000 : false, refetchIntervalInBackground: false });
  const confirmDelivery = trpc.auctions.confirmDelivery.useMutation({
    onSuccess: async () => {
      setDeliveryAuctionId(null);
      await Promise.all([utils.auctions.myBids.invalidate(), utils.returns.mine.invalidate()]);
    },
  });
  const seenBidIds = useRef(new Map<number, number>());
  const hasBaseline = useRef(false);
  const seenAccountId = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const accountId = user?.openId ?? null;
    if (!accountId) {
      seenAccountId.current = null;
      seenBidIds.current.clear();
      hasBaseline.current = false;
      return;
    }

    if (seenAccountId.current !== accountId) {
      seenAccountId.current = accountId;
      seenBidIds.current = new Map();
      hasBaseline.current = false;
    }
    if (!result.data || result.isLoading || result.isFetching || result.error) return;

    const nextSeen = new Map<number, number>();
    let newAlert: NewBidAlert | null = null;
    for (const entry of result.data) {
      const latest = entry.latestBid;
      if (!latest) continue;
      const previousId = seenBidIds.current.get(entry.auction.id);
      if (!newAlert && hasBaseline.current && previousId !== undefined && previousId !== latest.id && !latest.isMine) {
        newAlert = {
          accountId,
          auctionId: entry.auction.id,
          bidderName: latest.bidderName,
          amount: latest.amount,
          currency: entry.auction.currency,
          titleAr: entry.auction.titleAr,
          titleEn: entry.auction.titleEn,
          titleKu: entry.auction.titleKu,
        };
      }
      nextSeen.set(entry.auction.id, latest.id);
    }
    seenBidIds.current = nextSeen;
    hasBaseline.current = true;
    if (newAlert) {
      const alert = newAlert;
      const timeout = setTimeout(() => setIncomingBid(alert), 0);
      return () => clearTimeout(timeout);
    }
  }, [result.data, result.error, result.isFetching, result.isLoading, user?.openId]);

  useEffect(() => {
    if (!incomingBid) return;
    const timeout = setTimeout(() => setIncomingBid(null), 9_000);
    return () => clearTimeout(timeout);
  }, [incomingBid]);

  const grouped = new Map<number, typeof result.data extends (infer T)[] | undefined ? T : never>();
  for (const entry of result.data ?? []) {
    const previous = grouped.get(entry.auction.id);
    if (!previous || new Date(entry.bidCreatedAt).getTime() > new Date(previous.bidCreatedAt).getTime()) {
      grouped.set(entry.auction.id, entry);
    }
  }
  const myAuctions = Array.from(grouped.values());
  const activeIncomingBid = incomingBid?.accountId === user?.openId ? incomingBid : null;
  const incomingTitle = activeIncomingBid
    ? language === "en" ? activeIncomingBid.titleEn : language === "ku" ? activeIncomingBid.titleKu : activeIncomingBid.titleAr
    : "";
  const incomingMessage = activeIncomingBid
    ? activityCopy.newBidAlert
      .replace("{bidder}", activeIncomingBid.bidderName?.trim() || activityCopy.byAccount)
      .replace("{product}", incomingTitle)
      .replace("{amount}", formatCurrency(activeIncomingBid.amount, activeIncomingBid.currency, language))
    : "";

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
          <Text style={styles.kicker}>{t("myBids")}</Text>
          <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{t("myBidsTitle")}</Text>
        </View>

        {user && push.supported ? (
          <View style={styles.notificationCard}>
            <View style={[styles.notificationHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="notifications-outline" size={19} color={C.teal} />
              <Text style={[styles.notificationTitle, { textAlign: isRTL ? "right" : "left" }]}>{activityCopy.enableTitle}</Text>
            </View>
            <Text style={[styles.muted, { textAlign: isRTL ? "right" : "left" }]}>
              {push.state === "enabled" ? activityCopy.enabled : push.state === "denied" ? activityCopy.denied : push.state === "error" ? activityCopy.failed : activityCopy.enableBody}
            </Text>
            {push.state !== "enabled" ? (
              <Pressable
                onPress={push.state === "denied" ? push.openSettings : push.enable}
                disabled={push.state === "checking"}
                style={[styles.notificationButton, push.state === "checking" && styles.disabledButton]}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>{push.state === "denied" ? activityCopy.openSettings : push.state === "checking" ? t("loading") : activityCopy.enableButton}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {activeIncomingBid ? (
          <Pressable
            onPress={() => router.push({ pathname: "/auction/[id]", params: { id: String(activeIncomingBid.auctionId) } })}
            accessibilityRole="button"
            accessibilityLabel={incomingMessage}
            style={[styles.incomingBidBanner, { flexDirection: isRTL ? "row-reverse" : "row" }]}
          >
            <Ionicons name="notifications" size={18} color={C.red} />
            <Text style={[styles.incomingBidText, { textAlign: isRTL ? "right" : "left" }]}>{incomingMessage}</Text>
          </Pressable>
        ) : null}

        {loading || result.isLoading ? (
          <View style={styles.state}>
            <ActivityIndicator color={C.teal} />
            <Text style={styles.muted}>{t("loading")}</Text>
          </View>
        ) : null}

        {!loading && !user ? (
          <View style={styles.emptyCard}>
            <View style={styles.iconCircle}><Ionicons name="hammer-outline" size={28} color={C.teal} /></View>
            <Text style={styles.emptyTitle}>{t("accountNeeded")}</Text>
            <Text style={styles.muted}>{t("signInHint")}</Text>
            <Pressable onPress={() => router.push("/login")} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{t("signIn")}</Text>
            </Pressable>
          </View>
        ) : null}

        {result.error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>{t("failed")}</Text>
            <Pressable onPress={() => result.refetch()}><Text style={styles.link}>{t("retry")}</Text></Pressable>
          </View>
        ) : null}

        {user && !result.isLoading && !result.error && myAuctions.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.iconCircle}><Ionicons name="receipt-outline" size={27} color={C.teal} /></View>
            <Text style={styles.emptyTitle}>{t("noMyBids")}</Text>
            <Text style={styles.muted}>{t("discover")}</Text>
            <Pressable onPress={() => router.replace("/(tabs)")} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{t("home")}</Text>
            </Pressable>
          </View>
        ) : null}

        {user && myAuctions.map((entry) => {
          const auction = entry.auction;
          const title = getAuctionTitle(auction, language);
          const ended = auction.status !== "active" || new Date(auction.endsAt).getTime() <= now;
          const endingSoon = !ended && isAuctionEndingSoon(auction.endsAt, now);
          const timeLabel = ended ? t("ended") : `${t("endsIn")} ${formatTimeLeft(auction.endsAt, language, now)}`;
          const wonRealItem = entry.isWinner && auction.status === "ended" && !auction.isDemo;
          const openDetails = () => router.push({ pathname: "/auction/[id]", params: { id: String(auction.id) } });

          return (
            <View key={auction.id} style={[styles.bidCard, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Pressable
                onPress={openDetails}
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${timeLabel}`}
                accessibilityHint={t("details")}
                style={({ pressed }) => [styles.imageButton, pressed && styles.imagePressed]}
              >
                <Image
                  source={getAuctionImageSource(auction.imageKey, auction.category)}
                  contentFit="cover"
                  style={styles.image}
                />
              </Pressable>
              <View style={[styles.bidInfo, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
                <Text numberOfLines={2} style={[styles.productName, { textAlign: isRTL ? "right" : "left" }]}>
                  {title}
                </Text>
                <View style={[styles.timeRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Ionicons name="time-outline" size={18} color={ended ? C.muted : endingSoon ? C.red : C.amber} />
                  <Text style={[styles.timeText, ended && styles.endedText, endingSoon && styles.urgentTimeText, { textAlign: isRTL ? "right" : "left" }]}>
                    {timeLabel}
                  </Text>
                </View>
                {entry.latestBid ? (
                  <View style={[styles.activityRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Ionicons name="trending-up-outline" size={14} color={C.teal} />
                    <Text numberOfLines={2} style={[styles.activityText, { textAlign: isRTL ? "right" : "left" }]}>
                      {activityCopy.activity}: {entry.latestBid.isMine ? activityCopy.byYou : entry.latestBid.bidderName || t("user")} · {formatCurrency(entry.latestBid.amount, auction.currency, language)}
                    </Text>
                  </View>
                ) : null}
                {wonRealItem ? (
                  <View style={[styles.deliveryBox, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
                    <View style={[styles.activityRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                      <Ionicons name="trophy-outline" size={14} color={C.teal} />
                      <Text style={styles.wonText}>{manageCopy.youWon}</Text>
                    </View>
                    {entry.deliveryConfirmedAt ? (
                      <>
                        <View style={[styles.activityRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                          <Ionicons name="checkmark-circle" size={14} color={C.teal} />
                          <Text style={styles.deliveredText}>{manageCopy.deliveryConfirmed}</Text>
                        </View>
                        <Pressable onPress={() => router.push("/returns")} style={[styles.smallButton, styles.returnButton, { flexDirection: isRTL ? "row-reverse" : "row" }]} accessibilityRole="button">
                          <Ionicons name="return-down-back-outline" size={15} color={C.red} />
                          <Text style={styles.returnButtonText}>{manageCopy.requestReturn}</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.deliveryHint, { textAlign: isRTL ? "right" : "left" }]}>{manageCopy.awaitingDelivery}</Text>
                        <Pressable onPress={() => { confirmDelivery.reset(); setDeliveryAuctionId(auction.id); }} style={[styles.smallButton, { flexDirection: isRTL ? "row-reverse" : "row" }]} accessibilityRole="button">
                          <Ionicons name="cube-outline" size={15} color={C.white} />
                          <Text style={styles.smallButtonText}>{manageCopy.confirmDelivery}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Modal visible={deliveryAuctionId !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!confirmDelivery.isPending) setDeliveryAuctionId(null); }}>
        <View style={styles.backdrop}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <View style={[styles.iconCircle, { alignSelf: isRTL ? "flex-end" : "flex-start", width: 48, height: 48, borderRadius: 24 }]}><Ionicons name="cube-outline" size={22} color={C.teal} /></View>
            <Text style={[styles.dialogTitle, { textAlign: isRTL ? "right" : "left" }]}>{manageCopy.confirmDeliveryTitle}</Text>
            <Text style={[styles.muted, { textAlign: isRTL ? "right" : "left" }]}>{manageCopy.confirmDeliveryBody}</Text>
            {confirmDelivery.error ? <Text style={[styles.errorText, { textAlign: isRTL ? "right" : "left" }]}>{manageCopy.deliveryFailed}</Text> : null}
            <View style={[styles.dialogActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Pressable onPress={() => setDeliveryAuctionId(null)} disabled={confirmDelivery.isPending} style={[styles.dialogCancel, confirmDelivery.isPending && styles.disabledButton]}>
                <Text style={styles.dialogCancelText}>{manageCopy.keep}</Text>
              </Pressable>
              <Pressable onPress={() => { if (deliveryAuctionId !== null) confirmDelivery.mutate({ auctionId: deliveryAuctionId }); }} disabled={confirmDelivery.isPending} style={[styles.dialogConfirm, confirmDelivery.isPending && styles.disabledButton]}>
                {confirmDelivery.isPending ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryText}>{manageCopy.confirmDeliveryYes}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 24, backgroundColor: C.bg, minHeight: "100%", maxWidth: 620, width: "100%", alignSelf: "center" },
  header: { gap: 5, marginBottom: 22 },
  kicker: { color: C.teal, fontSize: 12, fontWeight: "800" },
  title: { color: C.ink, fontSize: 23, lineHeight: 30, fontWeight: "900" },
  state: { minHeight: 170, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyCard: { backgroundColor: C.white, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 23, alignItems: "center", gap: 12 },
  notificationCard: { backgroundColor: "#EAF3F0", borderRadius: 20, padding: 16, gap: 10, marginBottom: 16, borderWidth: 1, borderColor: "#D6E7E2" },
  incomingBidBanner: { backgroundColor: "#FEF2F2", borderRadius: 16, padding: 12, gap: 9, marginBottom: 14, borderWidth: 1, borderColor: "#F2C1BD", alignItems: "center" },
  incomingBidText: { flex: 1, color: C.red, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  notificationHeader: { alignItems: "center", gap: 8 },
  notificationTitle: { flex: 1, color: C.ink, fontSize: 14, fontWeight: "900" },
  notificationButton: { alignSelf: "flex-start", backgroundColor: C.teal, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 13 },
  disabledButton: { opacity: 0.6 },
  iconCircle: { height: 58, width: 58, borderRadius: 20, backgroundColor: "#E7F3F0", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: C.ink, fontSize: 17, fontWeight: "800", textAlign: "center" },
  muted: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  primaryButton: { backgroundColor: C.teal, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, marginTop: 5 },
  primaryText: { color: C.white, fontSize: 13, fontWeight: "800" },
  link: { color: C.teal, fontWeight: "800", padding: 8 },
  bidCard: { backgroundColor: C.white, borderRadius: 22, padding: 10, gap: 14, borderWidth: 1, borderColor: C.line, marginBottom: 12, minHeight: 158, alignItems: "stretch" },
  imageButton: { width: 128, height: 138, borderRadius: 16, overflow: "hidden", backgroundColor: C.bg },
  imagePressed: { opacity: 0.86 },
  image: { width: "100%", height: "100%" },
  bidInfo: { flex: 1, justifyContent: "center", paddingHorizontal: 3, gap: 8 },
  productName: { color: C.ink, fontSize: 15, lineHeight: 22, fontWeight: "800" },
  timeRow: { alignItems: "center", gap: 6 },
  timeText: { color: "#986817", fontSize: 16, lineHeight: 22, fontWeight: "900", flexShrink: 1, fontVariant: ["tabular-nums"] },
  endedText: { color: C.muted },
  deliveryBox: { alignSelf: "stretch", gap: 6, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line },
  wonText: { color: C.teal, fontSize: 12, fontWeight: "900" },
  deliveredText: { color: C.teal, fontSize: 11, fontWeight: "800" },
  deliveryHint: { color: C.muted, fontSize: 10, lineHeight: 15 },
  smallButton: { alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 11, backgroundColor: C.teal },
  smallButtonText: { color: C.white, fontSize: 11, fontWeight: "900" },
  returnButton: { backgroundColor: "#FFF5F4", borderWidth: 1, borderColor: "#F7C3BE" },
  returnButtonText: { color: C.red, fontSize: 11, fontWeight: "900" },
  backdrop: { flex: 1, backgroundColor: "rgba(23,43,42,0.55)", alignItems: "center", justifyContent: "center", padding: 22 },
  dialog: { width: "100%", maxWidth: 420, backgroundColor: C.white, borderRadius: 22, padding: 20, gap: 12 },
  dialogTitle: { color: C.ink, fontSize: 17, fontWeight: "900" },
  dialogActions: { gap: 10, marginTop: 4 },
  dialogCancel: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  dialogCancelText: { color: C.ink, fontSize: 13, fontWeight: "800" },
  dialogConfirm: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  errorText: { color: C.red, fontSize: 12, fontWeight: "800" },
  urgentTimeText: { color: C.red },
  activityRow: { alignItems: "center", gap: 5 },
  activityText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 15, fontWeight: "700" },
});
