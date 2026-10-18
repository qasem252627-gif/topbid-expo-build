import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { SubPageHeader } from "@/components/sub-page-header";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/lib/i18n";
import { profileCopy } from "@/lib/profile-copy";
import { accountPagesCopy } from "@/lib/account-pages-copy";
import { IRAQ_GOVERNORATES, isGovernorateCode, type GovernorateCode } from "@/lib/iraq-governorates";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", white: "#FFFFFF", line: "#E8E5DE", red: "#A33128" };

export default function AddressScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language, t } = useLanguage();
  const copy = accountPagesCopy[language];
  const profile = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user) });

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SubPageHeader title={copy.addressTitle} subtitle={copy.addressIntro} />
        {loading || (user && profile.isLoading) ? <ActivityIndicator color={C.teal} /> : null}
        {!loading && !user ? (
          <View style={styles.card}>
            <Text style={styles.muted}>{copy.signInFirst}</Text>
            <Pressable onPress={() => router.push("/login")} style={styles.primaryButton} accessibilityRole="button"><Text style={styles.primaryText}>{t("signIn")}</Text></Pressable>
          </View>
        ) : null}
        {profile.data ? (
          <AddressForm
            key={`${profile.data.governorate ?? ""}:${profile.data.address ?? ""}`}
            initialGovernorate={isGovernorateCode(profile.data.governorate) ? profile.data.governorate : null}
            initialAddress={profile.data.address ?? ""}
          />
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function AddressForm({ initialGovernorate, initialAddress }: { initialGovernorate: GovernorateCode | null; initialAddress: string }) {
  const { language, isRTL } = useLanguage();
  const copy = accountPagesCopy[language];
  const profileText = profileCopy[language];
  const utils = trpc.useUtils();
  const [governorate, setGovernorate] = useState<GovernorateCode | null>(initialGovernorate);
  const [address, setAddress] = useState(initialAddress);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const align = isRTL ? "right" : "left";
  const save = trpc.auth.updateAddress.useMutation({
    onSuccess: async () => {
      setIsError(false);
      setMessage(copy.addressSaved);
      await utils.auth.me.invalidate();
    },
    onError: () => { setIsError(true); setMessage(copy.addressFailed); },
  });
  function submit() {
    setMessage("");
    if (address.trim() && !governorate) { setIsError(true); setMessage(copy.governorateRequired); return; }
    save.mutate({ governorate, address: address.trim() });
  }
  return (
    <>
      <View style={styles.card}>
        <View style={[styles.sectionHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text style={styles.sectionTitle}>{copy.chooseGovernorate}</Text>
          {governorate ? <Pressable onPress={() => setGovernorate(null)} hitSlop={6} accessibilityRole="button"><Text style={styles.clear}>{copy.clearSelection}</Text></Pressable> : null}
        </View>
        <View style={[styles.grid, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {IRAQ_GOVERNORATES.map((item) => {
            const selected = governorate === item.code;
            return (
              <Pressable key={item.code} onPress={() => { setGovernorate(item.code); setMessage(""); }} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipActive, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Ionicons name={selected ? "location" : "location-outline"} size={13} color={selected ? C.white : C.teal} />
                <Text style={[styles.chipText, selected && styles.chipTextActive]} numberOfLines={1}>{item[language]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.card}>
        <Text style={[styles.sectionTitle, { textAlign: align }]}>{copy.addressDetails}</Text>
        <TextInput value={address} onChangeText={(value) => { setAddress(value); setMessage(""); }} placeholder={copy.addressDetailsPlaceholder} placeholderTextColor="#97A19E" maxLength={500} multiline style={[styles.input, { textAlign: align }]} accessibilityLabel={copy.addressDetails} />
        <Text style={[styles.hint, { textAlign: align }]}>{profileText.contactPrivacy}</Text>
        {message ? <Text style={[styles.message, isError ? styles.error : styles.success]}>{message}</Text> : null}
        <Pressable onPress={submit} disabled={save.isPending} style={[styles.primaryButton, save.isPending && { opacity: 0.65 }]} accessibilityRole="button">
          {save.isPending ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryText}>{copy.saveAddress}</Text>}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 34, backgroundColor: C.bg, minHeight: "100%", width: "100%", maxWidth: 680, alignSelf: "center", gap: 12 },
  card: { backgroundColor: C.white, borderRadius: 19, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10 },
  sectionHeader: { alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionTitle: { color: C.ink, fontSize: 14, fontWeight: "900" },
  clear: { color: C.red, fontSize: 11, fontWeight: "800" },
  grid: { flexWrap: "wrap", gap: 8 },
  chip: { alignItems: "center", gap: 5, borderRadius: 99, borderWidth: 1, borderColor: C.line, backgroundColor: "#FCFBF8", paddingHorizontal: 11, paddingVertical: 8, maxWidth: "100%" },
  chipActive: { backgroundColor: C.teal, borderColor: C.teal },
  chipText: { color: C.ink, fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: C.white },
  input: { minHeight: 96, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: "#FCFBF8", paddingHorizontal: 12, paddingTop: 11, color: C.ink, fontSize: 13, textAlignVertical: "top" },
  hint: { color: C.muted, fontSize: 11, lineHeight: 17 },
  message: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  success: { color: C.teal },
  error: { color: C.red },
  muted: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  primaryButton: { backgroundColor: C.teal, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primaryText: { color: C.white, fontSize: 13, fontWeight: "800" },
});
