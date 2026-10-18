import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AuctionCard } from "@/components/auction-card";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { favoritesCopy } from "@/lib/favorites-copy";
import { trpc } from "@/lib/trpc";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", white: "#FFFFFF", line: "#E8E5DE" };

export default function FavoritesScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language, isRTL, t } = useLanguage();
  const copy = favoritesCopy[language];
  const [now, setNow] = useState(() => Date.now());
  const favorites = trpc.favorites.list.useQuery(undefined, { enabled: Boolean(user), refetchInterval: user ? 20_000 : false, refetchIntervalInBackground: false });
  const utils = trpc.useUtils();
  const setFavorite = trpc.favorites.set.useMutation({ onSuccess: () => utils.favorites.list.invalidate() });
  const saved = useMemo(() => new Set(favorites.data?.map((item) => item.id) ?? []), [favorites.data]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
          <Text style={styles.kicker}>{copy.tab}</Text>
          <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{copy.title}</Text>
          <Text style={[styles.muted, { textAlign: isRTL ? "right" : "left" }]}>{copy.intro}</Text>
        </View>

        {loading || (user && favorites.isLoading) ? <View style={styles.state}><ActivityIndicator color={C.teal} /><Text style={styles.muted}>{t("loading")}</Text></View> : null}
        {!user && !loading ? <View style={styles.emptyCard}>
          <Ionicons name="heart-outline" size={34} color={C.teal} />
          <Text style={styles.emptyText}>{copy.signIn}</Text>
          <Pressable onPress={() => router.push("/login")} style={styles.button}><Text style={styles.buttonText}>{t("signIn")}</Text></Pressable>
        </View> : null}
        {favorites.error ? <View style={styles.emptyCard}><Text style={styles.emptyText}>{copy.failed}</Text><Pressable onPress={() => favorites.refetch()}><Text style={styles.link}>{t("retry")}</Text></Pressable></View> : null}
        {user && !favorites.isLoading && !favorites.error && (favorites.data?.length ?? 0) === 0 ? <View style={styles.emptyCard}>
          <Ionicons name="heart-outline" size={34} color={C.teal} />
          <Text style={styles.emptyText}>{copy.empty}</Text>
          <Pressable onPress={() => router.replace("/(tabs)")} style={styles.button}><Text style={styles.buttonText}>{t("home")}</Text></Pressable>
        </View> : null}
        {user && favorites.data?.length ? <View style={styles.grid}>
          {favorites.data.map((auction) => <AuctionCard
            key={auction.id}
            auction={auction}
            now={now}
            isFavorite={saved.has(auction.id)}
            onToggleFavorite={() => setFavorite.mutate({ auctionId: auction.id, favorite: false })}
            onPress={() => router.push({ pathname: "/auction/[id]", params: { id: String(auction.id) } })}
          />)}
        </View> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 24, backgroundColor: C.bg, minHeight: "100%", maxWidth: 620, width: "100%", alignSelf: "center" },
  header: { gap: 7, marginBottom: 20 },
  kicker: { color: C.teal, fontSize: 12, fontWeight: "800" },
  title: { color: C.ink, fontSize: 24, fontWeight: "900" },
  muted: { color: C.muted, fontSize: 12, lineHeight: 19 },
  state: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyCard: { backgroundColor: C.white, borderRadius: 22, padding: 22, gap: 12, alignItems: "center", borderWidth: 1, borderColor: C.line },
  emptyText: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  button: { backgroundColor: C.teal, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 13 },
  buttonText: { color: C.white, fontSize: 12, fontWeight: "800" },
  link: { color: C.teal, fontWeight: "800", padding: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "stretch" },
});
