import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { SubPageHeader } from "@/components/sub-page-header";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/lib/i18n";
import { profileCopy } from "@/lib/profile-copy";
import { accountPagesCopy } from "@/lib/account-pages-copy";
import { formatProductNumber } from "@/lib/auction-utils";
import { formatDualCurrency } from "@/lib/currency";
import { useExchangeRate } from "@/lib/exchange-rate";
import { getGovernorateName } from "@/lib/iraq-governorates";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", white: "#FFFFFF", line: "#E8E5DE", red: "#A33128" };

export default function AdminWinnersScreen() {
  const { user } = useAuth();
  const { language, isRTL, t } = useLanguage();
  const copy = accountPagesCopy[language];
  const profileText = profileCopy[language];
  const exchangeRate = useExchangeRate();
  const profile = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user) });
  const isAdmin = profile.data?.role === "admin";
  const winners = trpc.admins.winners.useQuery(undefined, { enabled: isAdmin, refetchInterval: 30_000 });
  const align = isRTL ? "right" : "left";

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SubPageHeader title={copy.winnersTitle} subtitle={profileText.winnersPrivacy} />
        {profile.isLoading ? <ActivityIndicator color={C.teal} /> : null}
        {!profile.isLoading && !isAdmin ? <View style={styles.card}><Text style={styles.muted}>{copy.adminOnly}</Text></View> : null}
        {isAdmin ? (
          <>
            <View style={styles.countTile}>
              <Text style={styles.countValue}>{winners.data ? winners.data.length.toLocaleString() : "—"}</Text>
              <Text style={styles.countLabel}>{copy.winnersCount}</Text>
            </View>
            {winners.isLoading ? <ActivityIndicator color={C.teal} /> : null}
            {winners.error ? <View style={styles.card}><Text style={styles.error}>{profileText.winnersLoadFailed}</Text><Pressable onPress={() => winners.refetch()}><Text style={styles.link}>{t("retry")}</Text></Pressable></View> : null}
            {!winners.isLoading && !winners.error && !winners.data?.length ? <View style={styles.card}><Text style={styles.muted}>{profileText.winnersEmpty}</Text></View> : null}
            {winners.data?.map((winner) => {
              const productName = language === "en" ? winner.titleEn : language === "ku" ? winner.titleKu : winner.titleAr;
              const price = formatDualCurrency(winner.winningAmount, winner.currency, language, exchangeRate);
              return (
                <View key={winner.auctionId} style={styles.card}>
                  <View style={[styles.productHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Ionicons name="trophy-outline" size={15} color={C.teal} />
                    <Text style={styles.productNumberLabel}>{profileText.productNumber}:</Text>
                    <Text style={styles.productNumber}>{formatProductNumber(winner.auctionId)}</Text>
                  </View>
                  <Text style={[styles.productName, { textAlign: align }]}>{productName}</Text>
                  <View style={styles.priceBox}>
                    <Text style={[styles.priceLabel, { textAlign: align }]}>{profileText.winnerPrice}</Text>
                    <Text style={[styles.price, { textAlign: align }]}>{price.primary}</Text>
                    <Text style={[styles.priceSecondary, { textAlign: align }]}>≈ {price.secondary}</Text>
                  </View>
                  <Field label={profileText.winnerName} value={winner.winnerName?.trim() || profileText.missing} isRTL={isRTL} />
                  <Field label={profileText.winnerPhone} value={winner.phone || profileText.missing} isRTL={isRTL} ltr={Boolean(winner.phone)} />
                  <Field label={copy.governorate} value={getGovernorateName(winner.governorate, language) || profileText.missing} isRTL={isRTL} />
                  <Field label={profileText.winnerAddress} value={winner.address || profileText.missing} isRTL={isRTL} />
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function Field({ label, value, isRTL, ltr = false }: { label: string; value: string; isRTL: boolean; ltr?: boolean }) {
  return (
    <View style={[styles.fieldRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <Text style={[styles.fieldLabel, { textAlign: isRTL ? "right" : "left" }]}>{label}</Text>
      <Text style={[styles.fieldValue, ltr && { writingDirection: "ltr" }, { textAlign: isRTL && !ltr ? "right" : "left" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 34, backgroundColor: C.bg, minHeight: "100%", width: "100%", maxWidth: 680, alignSelf: "center", gap: 11 },
  countTile: { backgroundColor: C.teal, borderRadius: 20, paddingVertical: 16, alignItems: "center", gap: 2 },
  countValue: { color: C.white, fontSize: 30, fontWeight: "900" },
  countLabel: { color: "#D8EFEA", fontSize: 12, fontWeight: "800" },
  card: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 13, gap: 8 },
  productHeader: { alignItems: "center", gap: 5 },
  productNumberLabel: { color: C.muted, fontSize: 10, fontWeight: "700" },
  productNumber: { color: C.teal, fontSize: 11, fontWeight: "900", writingDirection: "ltr" },
  productName: { color: C.ink, fontSize: 14, fontWeight: "900" },
  priceBox: { backgroundColor: "#E7F3F0", borderRadius: 14, padding: 10, gap: 2 },
  priceLabel: { color: C.teal, fontSize: 10, fontWeight: "800" },
  price: { color: C.ink, fontSize: 18, fontWeight: "900" },
  priceSecondary: { color: C.muted, fontSize: 11, fontWeight: "700" },
  fieldRow: { alignItems: "flex-start", gap: 8 },
  fieldLabel: { width: 92, flexShrink: 0, color: C.muted, fontSize: 10, fontWeight: "700" },
  fieldValue: { flex: 1, color: C.ink, fontSize: 11, fontWeight: "700", lineHeight: 16 },
  muted: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  error: { color: C.red, fontSize: 11, textAlign: "center" },
  link: { color: C.teal, fontSize: 12, fontWeight: "800", textAlign: "center" },
});
