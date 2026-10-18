import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AuctionCard } from "@/components/auction-card";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/lib/i18n";
import { auctionCopy } from "@/lib/auction-copy";
import { marketplaceCopy } from "@/lib/marketplace-copy";
import { getAuctionImageSource } from "@/lib/auction-utils";
import { useAuth } from "@/hooks/use-auth";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", amber: "#E3A63A", white: "#FFFFFF", line: "#E8E5DE" };
type Filter = "all" | "electronics" | "home";

export default function HomeScreen() {
  const router = useRouter();
  const segments = useSegments();
  const isFocused = segments.length === 1 && segments[0] === "(tabs)";
  const { language, isRTL, t } = useLanguage();
  const { user } = useAuth();
  const marketCopy = marketplaceCopy[language];
  const profile = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user) });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [adIndex, setAdIndex] = useState(0);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [adNotice, setAdNotice] = useState("");
  const category = filter === "all" ? undefined : filter;
  const queryInput = useMemo(() => ({ category, search: search.trim() || undefined }), [category, search]);
  const auctions = trpc.auctions.list.useQuery(queryInput, { refetchInterval: isFocused ? 5_000 : false, refetchIntervalInBackground: false });
  const ads = trpc.ads.list.useQuery(undefined, { refetchInterval: isFocused ? 10_000 : false, refetchIntervalInBackground: false });
  const favorites = trpc.favorites.list.useQuery(undefined, { enabled: Boolean(user) && isFocused, refetchInterval: isFocused ? 30_000 : false, refetchIntervalInBackground: false });
  const utils = trpc.useUtils();
  const setFavorite = trpc.favorites.set.useMutation({ onSuccess: () => utils.favorites.list.invalidate() });
  const favoriteIds = useMemo(() => new Set(favorites.data?.map((item) => item.id) ?? []), [favorites.data]);
  const items = auctions.data ?? [];
  const adItems = ads.data ?? [];
  const adCount = adItems.length;
  const currentAd = adCount ? adItems[adIndex % adCount] : null;

  useEffect(() => {
    if (!isFocused) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused || adCount < 2) return;
    const timer = setInterval(() => setAdIndex((previous) => (previous + 1) % adCount), 6_000);
    return () => clearInterval(timer);
  }, [adCount, isFocused]);

  async function refreshMarketplace() {
    setManualRefreshing(true);
    try {
      await Promise.all([auctions.refetch(), ads.refetch()]);
    } finally {
      setManualRefreshing(false);
    }
  }

  async function openCurrentAd() {
    if (!currentAd) return;
    try {
      await Linking.openURL(currentAd.targetUrl);
      setAdNotice("");
    } catch {
      setAdNotice(marketCopy.adOpenFailed);
    }
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: t("all") },
    { value: "electronics", label: t("electronics") },
    { value: "home", label: t("homeGoods") },
  ];

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.topbar, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.brand, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Image source={require("@/assets/images/icon.png")} style={styles.logo} contentFit="cover" />
            <View>
              <Text style={styles.brandName}>{t("name")}</Text>
              <Text style={styles.brandTag}>AUCTIONS · IRAQ</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/account")} style={styles.profileButton} accessibilityRole="button" accessibilityLabel={t("account")}>
            <Ionicons name="person-outline" size={19} color={C.ink} />
          </Pressable>
        </View>

        {currentAd ? (
          <View style={styles.adCarousel}>
            <Pressable onPress={openCurrentAd} accessibilityRole="link" accessibilityLabel={marketCopy.featuredAds} style={styles.adSlide}>
              <Image source={getAuctionImageSource(currentAd.imageKey, "home")} contentFit="cover" style={styles.adImage} />
              <View style={[styles.adOverlay, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
                <Text style={styles.adEyebrow}>{marketCopy.featuredAds}</Text>
                <Ionicons name={isRTL ? "arrow-back-circle" : "arrow-forward-circle"} size={27} color={C.white} />
              </View>
            </Pressable>
            {adItems.length > 1 ? <View style={styles.adDots}>{adItems.map((ad, index) => <Pressable key={ad.id} onPress={() => setAdIndex(index)} accessibilityRole="button" accessibilityLabel={`${marketCopy.featuredAds} ${index + 1}`} style={[styles.adDot, index === adIndex % adItems.length && styles.adDotActive]} />)}</View> : null}
          </View>
        ) : (
          <View style={[styles.hero, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.heroCopy, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
              <View style={styles.eyebrow}><View style={styles.liveDot} /><Text style={styles.eyebrowText}>{t("featured")}</Text></View>
              <Text style={[styles.heroTitle, { textAlign: isRTL ? "right" : "left" }]}>{t("welcome")}</Text>
              <Text style={[styles.heroSubtitle, { textAlign: isRTL ? "right" : "left" }]}>{t("browseHint")}</Text>
            </View>
            <View style={styles.heroMark}><Ionicons name="hammer" size={35} color={C.teal} /><View style={styles.heroAccent} /></View>
          </View>
        )}
        {adNotice ? <Text style={styles.adError}>{adNotice}</Text> : null}

        <View style={[styles.searchBox, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Ionicons name="search" size={19} color={C.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t("search")} placeholderTextColor="#8B9693" style={[styles.searchInput, { textAlign: isRTL ? "right" : "left" }]} returnKeyType="search" />
          {search.length > 0 && <Pressable onPress={() => setSearch("")}><Ionicons name="close-circle" size={18} color={C.muted} /></Pressable>}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filters, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {filters.map((item) => {
            const selected = filter === item.value;
            return <Pressable key={item.value} onPress={() => setFilter(item.value)} style={[styles.filterChip, selected && styles.filterChipSelected]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text></Pressable>;
          })}
        </ScrollView>

        <View style={[styles.sectionHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text style={styles.sectionTitle}>{t("liveAuctions")}</Text>
          <View style={[styles.sectionActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Text style={styles.resultCount}>{items.length}</Text>
            <Pressable onPress={refreshMarketplace} disabled={manualRefreshing} accessibilityRole="button" accessibilityLabel={marketCopy.refresh} style={[styles.refreshButton, manualRefreshing && { opacity: 0.55 }]}>
              {manualRefreshing ? <ActivityIndicator color={C.teal} size="small" /> : <Ionicons name="refresh" size={17} color={C.teal} />}
            </Pressable>
          </View>
        </View>

        {auctions.isLoading ? <View style={styles.centerState}><ActivityIndicator color={C.teal} /><Text style={styles.stateText}>{t("loading")}</Text></View> : null}
        {auctions.error ? <View style={styles.messageCard}><Text style={styles.stateText}>{t("failed")}</Text><Pressable onPress={() => auctions.refetch()} style={styles.retry}><Text style={styles.retryText}>{t("retry")}</Text></Pressable></View> : null}
        {!auctions.isLoading && !auctions.error && items.length === 0 ? <View style={styles.messageCard}><Ionicons name="search-outline" size={30} color={C.muted} /><Text style={styles.stateText}>{t("noResults")}</Text></View> : null}
        <View style={styles.productGrid}>
          {items.map((auction) => <AuctionCard key={auction.id} auction={auction} now={now} isFavorite={favoriteIds.has(auction.id)} onToggleFavorite={() => {
            if (!user) { router.push("/login"); return; }
            setFavorite.mutate({ auctionId: auction.id, favorite: !favoriteIds.has(auction.id) });
          }} onPress={() => router.push({ pathname: "/auction/[id]", params: { id: String(auction.id) } })} />)}
        </View>
        <View style={{ height: 78 }} />
      </ScrollView>
      {profile.data?.role === "admin" ? <Pressable
        onPress={() => router.push("/new-auction")}
        style={[styles.fab, { left: isRTL ? 16 : undefined, right: isRTL ? undefined : 16, flexDirection: isRTL ? "row-reverse" : "row" }]}
        accessibilityRole="button"
        accessibilityLabel={auctionCopy[language].publishButton}
      >
        <Ionicons name="add" size={22} color={C.white} />
        <Text style={styles.fabText}>{auctionCopy[language].publishButton}</Text>
      </Pressable> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 13, paddingBottom: 90, backgroundColor: C.bg, minHeight: "100%", maxWidth: 620, width: "100%", alignSelf: "center" },
  topbar: { alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  brand: { alignItems: "center", gap: 9 },
  logo: { width: 39, height: 39, borderRadius: 12, backgroundColor: C.teal },
  brandName: { color: C.ink, fontSize: 17, fontWeight: "900", textAlign: "left" },
  brandTag: { color: C.muted, fontSize: 8, letterSpacing: 1.5, marginTop: 1 },
  profileButton: { height: 42, width: 42, borderRadius: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  hero: { minHeight: 151, padding: 17, borderRadius: 24, backgroundColor: "#E8F1EE", alignItems: "center", justifyContent: "space-between", marginBottom: 16, overflow: "hidden" },
  heroCopy: { flex: 1, gap: 8 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { height: 7, width: 7, borderRadius: 4, backgroundColor: C.amber },
  eyebrowText: { color: C.teal, fontSize: 10, fontWeight: "800" },
  heroTitle: { color: C.ink, fontSize: 21, lineHeight: 28, fontWeight: "900", maxWidth: 250 },
  heroSubtitle: { color: C.muted, fontSize: 11, lineHeight: 17, maxWidth: 260 },
  heroMark: { height: 66, width: 66, borderRadius: 23, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }], marginHorizontal: 4 },
  heroAccent: { position: "absolute", bottom: 9, right: 11, width: 10, height: 10, borderRadius: 5, backgroundColor: C.amber },
  adCarousel: { height: 151, marginBottom: 16, borderRadius: 24, overflow: "hidden", backgroundColor: C.ink },
  adSlide: { flex: 1, overflow: "hidden" },
  adImage: { width: "100%", height: "100%", position: "absolute" },
  adOverlay: { flex: 1, padding: 14, justifyContent: "space-between", backgroundColor: "rgba(12,27,27,0.18)" },
  adEyebrow: { overflow: "hidden", color: C.white, fontSize: 10, fontWeight: "900", backgroundColor: "rgba(12,27,27,0.55)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  adDots: { position: "absolute", bottom: 10, alignSelf: "center", flexDirection: "row", gap: 6 },
  adDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.65)" },
  adDotActive: { width: 18, backgroundColor: C.white },
  adError: { color: "#A33128", fontSize: 10, marginTop: -10, marginBottom: 8, textAlign: "center" },
  searchBox: { height: 50, backgroundColor: C.white, borderRadius: 16, alignItems: "center", gap: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, marginBottom: 15 },
  searchInput: { flex: 1, color: C.ink, fontSize: 13, height: "100%" },
  filters: { gap: 8, paddingBottom: 21 },
  filterChip: { borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  filterChipSelected: { backgroundColor: C.ink, borderColor: C.ink },
  filterText: { color: C.muted, fontSize: 12, fontWeight: "700" },
  filterTextSelected: { color: C.white },
  sectionHeader: { alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  sectionActions: { alignItems: "center", gap: 8 },
  refreshButton: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: C.ink, fontSize: 17, fontWeight: "900" },
  resultCount: { color: C.teal, fontSize: 11, fontWeight: "800", backgroundColor: "#E7F3F0", overflow: "hidden", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  productGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "stretch" },
  centerState: { minHeight: 130, alignItems: "center", justifyContent: "center", gap: 10 },
  messageCard: { borderRadius: 18, backgroundColor: C.white, padding: 24, alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.line },
  stateText: { color: C.muted, fontSize: 13, textAlign: "center" },
  retry: { backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  retryText: { color: C.white, fontWeight: "800", fontSize: 12 },
  fab: { position: "absolute", bottom: 16, minHeight: 54, paddingHorizontal: 18, borderRadius: 18, backgroundColor: C.teal, borderWidth: 1, borderColor: "#0A6F67", alignItems: "center", justifyContent: "center", gap: 7, elevation: 5 },
  fabText: { color: C.white, fontSize: 13, fontWeight: "900" },
});
