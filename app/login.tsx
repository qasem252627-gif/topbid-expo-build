import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { startOAuthLogin } from "@/constants/oauth";
import { useLanguage } from "@/lib/i18n";

const C = { ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", white: "#FFFFFF", line: "#E8E5DE", bg: "#F7F6F2" };

export default function LoginScreen() {
  const router = useRouter();
  const { isRTL, t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function continueWithManus() {
    setError("");
    setBusy(true);
    try { await startOAuthLogin(); } catch { setError(t("failed")); setBusy(false); }
  }
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.content}>
        <Pressable onPress={() => router.back()} style={[styles.close, { alignSelf: isRTL ? "flex-start" : "flex-end" }]} accessibilityRole="button" accessibilityLabel={t("close")}><Ionicons name="close" size={20} color={C.ink} /></Pressable>
        <View style={styles.card}>
          <Image source={require("@/assets/images/icon.png")} style={styles.logo} contentFit="cover" />
          <Text style={styles.brand}>{t("name")}</Text>
          <Text style={[styles.title, { textAlign: isRTL ? "right" : "center" }]}>{t("signIn")}</Text>
          <Text style={styles.subtitle}>{t("signInHint")}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={continueWithManus} disabled={busy} style={[styles.primaryButton, busy && { opacity: 0.7 }]}>
            {busy ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryText}>{t("signIn")}</Text>}
          </Pressable>
          <Pressable onPress={continueWithManus} disabled={busy} style={styles.secondaryButton}><Text style={styles.secondaryText}>{t("signUp")}</Text></Pressable>
          <Text style={styles.footnote}>TopBid · Iraq</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 20, maxWidth: 600, width: "100%", alignSelf: "center" }, close: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", marginBottom: 12 }, card: { width: "100%", backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 26, padding: 26, alignItems: "center", gap: 11 }, logo: { width: 64, height: 64, borderRadius: 21, backgroundColor: C.teal }, brand: { color: C.teal, fontSize: 13, fontWeight: "900", letterSpacing: 1 }, title: { color: C.ink, fontSize: 22, fontWeight: "900", marginTop: 10 }, subtitle: { color: C.muted, fontSize: 13, lineHeight: 21, textAlign: "center", marginBottom: 5 }, primaryButton: { width: "100%", minHeight: 48, borderRadius: 15, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" }, primaryText: { color: C.white, fontSize: 13, fontWeight: "900" }, secondaryButton: { width: "100%", minHeight: 44, borderRadius: 15, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }, secondaryText: { color: C.ink, fontSize: 12, fontWeight: "800" }, footnote: { color: "#98A29F", fontSize: 9, letterSpacing: 2, marginTop: 8 }, error: { color: "#A33128", fontSize: 12, textAlign: "center" } });
