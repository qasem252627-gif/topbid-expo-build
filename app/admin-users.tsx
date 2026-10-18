import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { SubPageHeader } from "@/components/sub-page-header";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/lib/i18n";
import { profileCopy } from "@/lib/profile-copy";
import { accountPagesCopy } from "@/lib/account-pages-copy";
import { getGovernorateName, IRAQ_GOVERNORATES } from "@/lib/iraq-governorates";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", amber: "#E3A63A", white: "#FFFFFF", line: "#E8E5DE", red: "#A33128" };

export default function AdminUsersScreen() {
  const { user } = useAuth();
  const { language, isRTL, t } = useLanguage();
  const copy = accountPagesCopy[language];
  const profileText = profileCopy[language];
  const profile = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user) });
  const isAdmin = profile.data?.role === "admin";
  const directory = trpc.admins.users.useQuery(undefined, { enabled: isAdmin, refetchInterval: 30_000 });
  const utils = trpc.useUtils();
  const setRole = trpc.admins.setRole.useMutation({ onSuccess: async () => { await utils.admins.users.invalidate(); await utils.auth.me.invalidate(); } });
  const [search, setSearch] = useState("");
  const align = isRTL ? "right" : "left";

  const people = useMemo(() => {
    const list = directory.data?.users ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((person) => {
      const governorateNames = IRAQ_GOVERNORATES.find((item) => item.code === person.governorate);
      const haystack = [person.name, person.email, person.phone, person.address, governorateNames?.ar, governorateNames?.en, governorateNames?.ku]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [directory.data?.users, search]);

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SubPageHeader title={copy.usersTitle} subtitle={copy.usersIntro} />
        {profile.isLoading ? <ActivityIndicator color={C.teal} /> : null}
        {!profile.isLoading && !isAdmin ? <View style={styles.card}><Text style={styles.muted}>{copy.adminOnly}</Text></View> : null}
        {isAdmin ? (
          <>
            <View style={[styles.statsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <StatTile label={copy.totalUsers} value={directory.data?.totalCount} highlight />
              <StatTile label={copy.admins} value={directory.data?.adminCount} />
            </View>
            <View style={[styles.statsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <StatTile label={copy.verifiedPhones} value={directory.data?.verifiedPhoneCount} />
              <StatTile label={copy.withAddress} value={directory.data?.withAddressCount} />
            </View>
            <View style={[styles.searchBox, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="search" size={16} color={C.muted} />
              <TextInput value={search} onChangeText={setSearch} placeholder={copy.searchUsers} placeholderTextColor="#97A19E" autoCapitalize="none" style={[styles.searchInput, { textAlign: align }]} accessibilityLabel={copy.searchUsers} />
            </View>
            {setRole.error ? <Text style={styles.error}>{setRole.error.message.includes("two administrators") ? t("adminSafety") : t("failed")}</Text> : null}
            {directory.isLoading ? <ActivityIndicator color={C.teal} /> : null}
            {directory.error ? <View style={styles.card}><Text style={styles.error}>{t("failed")}</Text><Pressable onPress={() => directory.refetch()}><Text style={styles.link}>{t("retry")}</Text></Pressable></View> : null}
            {!directory.isLoading && !directory.error && people.length === 0 ? <View style={styles.card}><Text style={styles.muted}>{copy.noUsersMatch}</Text></View> : null}
            {people.map((person) => {
              const isCurrentUser = person.id === profile.data?.id;
              const nextRole = person.role === "admin" ? "user" : "admin";
              const governorate = getGovernorateName(person.governorate, language);
              return (
                <View key={person.id} style={styles.card}>
                  <View style={[styles.personRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <View style={styles.avatar}><Text style={styles.initial}>{(person.name || person.email || "U").slice(0, 1).toUpperCase()}</Text></View>
                    <View style={styles.personText}>
                      <Text style={[styles.name, { textAlign: align }]}>{person.name || t("user")}</Text>
                      <Text style={[styles.meta, { textAlign: align }]} numberOfLines={1}>{person.email || person.openId}</Text>
                    </View>
                    {person.role === "admin" ? <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>{copy.admins}</Text></View> : null}
                  </View>
                  <Field label={profileText.phoneLabel} value={person.phone || profileText.missing} isRTL={isRTL} ltr={Boolean(person.phone)} trailing={person.phoneVerifiedAt ? <Ionicons name="checkmark-circle" size={14} color={C.teal} /> : null} />
                  <Field label={copy.governorate} value={governorate || profileText.missing} isRTL={isRTL} />
                  <Field label={profileText.addressLabel} value={person.address || profileText.missing} isRTL={isRTL} />
                  <Field label={copy.joined} value={new Date(person.createdAt).toLocaleDateString(language === "en" ? "en-GB" : "ar-IQ")} isRTL={isRTL} />
                  <Pressable disabled={isCurrentUser || setRole.isPending} onPress={() => setRole.mutate({ userId: person.id, role: nextRole })} accessibilityRole="button" style={[styles.roleChip, person.role === "admin" && styles.roleAdmin, (isCurrentUser || setRole.isPending) && { opacity: 0.45 }, { alignSelf: isRTL ? "flex-start" : "flex-end" }]}>
                    <Text style={[styles.roleText, person.role === "admin" && styles.roleAdminText]}>{person.role === "admin" ? t("makeUser") : t("makeAdmin")}</Text>
                  </Pressable>
                </View>
              );
            })}
            <Text style={[styles.hint, { textAlign: align }]}>{t("adminSafety")}</Text>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function StatTile({ label, value, highlight = false }: { label: string; value: number | undefined; highlight?: boolean }) {
  return (
    <View style={[styles.stat, highlight && styles.statHighlight]}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value === undefined ? "—" : value.toLocaleString()}</Text>
      <Text style={[styles.statLabel, highlight && styles.statLabelHighlight]}>{label}</Text>
    </View>
  );
}

function Field({ label, value, isRTL, ltr = false, trailing }: { label: string; value: string; isRTL: boolean; ltr?: boolean; trailing?: React.ReactNode }) {
  return (
    <View style={[styles.fieldRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <Text style={[styles.fieldLabel, { textAlign: isRTL ? "right" : "left" }]}>{label}</Text>
      <Text style={[styles.fieldValue, ltr && { writingDirection: "ltr" }, { textAlign: isRTL && !ltr ? "right" : "left" }]}>{value}</Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 34, backgroundColor: C.bg, minHeight: "100%", width: "100%", maxWidth: 680, alignSelf: "center", gap: 11 },
  statsRow: { gap: 10 },
  stat: { flex: 1, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingVertical: 14, paddingHorizontal: 12, alignItems: "center", gap: 3 },
  statHighlight: { backgroundColor: C.teal, borderColor: C.teal },
  statValue: { color: C.ink, fontSize: 26, fontWeight: "900" },
  statValueHighlight: { color: C.white, fontSize: 30 },
  statLabel: { color: C.muted, fontSize: 11, fontWeight: "800", textAlign: "center" },
  statLabelHighlight: { color: "#D8EFEA" },
  searchBox: { alignItems: "center", gap: 8, backgroundColor: C.white, borderRadius: 15, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, minHeight: 46 },
  searchInput: { flex: 1, color: C.ink, fontSize: 13, paddingVertical: 10 },
  card: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 13, gap: 7 },
  personRow: { alignItems: "center", gap: 10, marginBottom: 2 },
  avatar: { width: 36, height: 36, borderRadius: 13, backgroundColor: "#E7F3F0", alignItems: "center", justifyContent: "center" },
  initial: { color: C.teal, fontSize: 13, fontWeight: "900" },
  personText: { flex: 1 },
  name: { color: C.ink, fontSize: 13, fontWeight: "900" },
  meta: { color: C.muted, fontSize: 10, marginTop: 2 },
  adminBadge: { backgroundColor: "#FFF4DE", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 },
  adminBadgeText: { color: "#8B5E0A", fontSize: 10, fontWeight: "800" },
  fieldRow: { alignItems: "flex-start", gap: 8 },
  fieldLabel: { width: 92, flexShrink: 0, color: C.muted, fontSize: 10, fontWeight: "700" },
  fieldValue: { flex: 1, color: C.ink, fontSize: 11, fontWeight: "700", lineHeight: 16 },
  roleChip: { backgroundColor: "#F0EEE8", borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7, marginTop: 3 },
  roleAdmin: { backgroundColor: "#E7F3F0" },
  roleText: { color: C.ink, fontSize: 10, fontWeight: "800" },
  roleAdminText: { color: C.teal },
  muted: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  error: { color: C.red, fontSize: 11, textAlign: "center" },
  link: { color: C.teal, fontSize: 12, fontWeight: "800", textAlign: "center" },
  hint: { color: C.muted, fontSize: 10, lineHeight: 16 },
});
