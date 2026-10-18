import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "@/lib/i18n";
import { accountPagesCopy } from "@/lib/account-pages-copy";

const C = { ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", white: "#FFFFFF", line: "#E8E5DE" };

export function SubPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  const { language, isRTL } = useLanguage();
  const copy = accountPagesCopy[language];
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/account");
  }
  return (
    <View style={styles.wrap}>
      <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={copy.back} hitSlop={8} style={[styles.back, { flexDirection: isRTL ? "row-reverse" : "row", alignSelf: isRTL ? "flex-end" : "flex-start" }]}>
        <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={18} color={C.teal} />
        <Text style={styles.backText}>{copy.back}</Text>
      </Pressable>
      <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { textAlign: isRTL ? "right" : "left" }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 8 },
  back: { alignItems: "center", gap: 3, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
  backText: { color: C.teal, fontSize: 12, fontWeight: "800" },
  title: { color: C.ink, fontSize: 23, fontWeight: "900", marginTop: 6 },
  subtitle: { color: C.muted, fontSize: 12, lineHeight: 18 },
});
