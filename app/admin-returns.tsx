import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { formatCurrency } from "@/lib/currency";
import { useLanguage } from "@/lib/i18n";
import { returnsCopy } from "@/lib/returns-copy";
import { trpc } from "@/lib/trpc";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", red: "#B42318", white: "#FFFFFF", line: "#E8E5DE", pale: "#EAF3F0" };

export default function AdminReturnsScreen() {
  const { language, isRTL, t } = useLanguage();
  const copy = returnsCopy[language];
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState("");
  const requests = trpc.returns.adminList.useQuery(undefined, { refetchInterval: 10_000, refetchIntervalInBackground: false });
  const utils = trpc.useUtils();
  const update = trpc.returns.adminUpdate.useMutation({ onSuccess: async () => { setNotice(copy.updated); await utils.returns.adminList.invalidate(); await utils.returns.mine.invalidate(); } });

  async function setStatus(id: number, status: "approved" | "rejected") {
    setNotice("");
    try {
      await update.mutateAsync({ id, status, adminNote: notes[id]?.trim() || undefined });
    } catch {
      setNotice(copy.updateFailed);
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
          <Text style={styles.kicker}>{copy.adminTitle}</Text>
          <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{copy.adminTitle}</Text>
        </View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {requests.isLoading ? <View style={styles.loading}><ActivityIndicator color={C.teal} /><Text style={styles.muted}>{t("loading")}</Text></View> : null}
        {requests.error ? <View style={styles.card}><Text style={styles.error}>{t("failed")}</Text><Pressable onPress={() => requests.refetch()}><Text style={styles.link}>{t("retry")}</Text></Pressable></View> : null}
        {requests.data?.length === 0 && !requests.isLoading ? <View style={styles.card}><Text style={styles.muted}>{copy.adminEmpty}</Text></View> : null}
        {requests.data?.map((request) => {
          const title = language === "en" ? request.titleEn : language === "ku" ? request.titleKu : request.titleAr;
          const status = request.status === "pending" ? copy.pending : request.status === "approved" ? copy.approved : copy.rejected;
          return <View key={request.id} style={styles.card}>
            <View style={[styles.titleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="refresh-circle-outline" size={20} color={C.teal} />
              <Text style={[styles.productTitle, { textAlign: isRTL ? "right" : "left" }]}>{title}</Text>
              <Text style={[styles.status, request.status === "rejected" && styles.rejected]}>{status}</Text>
            </View>
            <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>{copy.winningPrice}: {request.winningAmount == null ? "—" : formatCurrency(request.winningAmount, request.currency, language)}</Text>
            <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>{copy.user}: {request.userName || "—"} · {copy.phone}: {request.phone || "—"}</Text>
            <View style={styles.reasonBox}><Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.reason}</Text><Text style={[styles.reason, { textAlign: isRTL ? "right" : "left" }]}>{request.reason}</Text></View>
            <EvidenceActions requestId={request.id} copy={copy} />
            <TextInput value={notes[request.id] ?? request.adminNote ?? ""} onChangeText={(value) => setNotes((previous) => ({ ...previous, [request.id]: value }))} placeholder={copy.notePlaceholder} placeholderTextColor="#8B9693" multiline maxLength={1000} textAlign={isRTL ? "right" : "left"} style={styles.noteInput} />
            <Text style={styles.helper}>{copy.noAutomaticRefund}</Text>
            <View style={[styles.actions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Pressable disabled={update.isPending} onPress={() => setStatus(request.id, "approved")} style={[styles.approveButton, update.isPending && styles.disabled]}><Text style={styles.actionText}>{copy.approve}</Text></Pressable>
              <Pressable disabled={update.isPending} onPress={() => setStatus(request.id, "rejected")} style={[styles.rejectButton, update.isPending && styles.disabled]}><Text style={styles.actionText}>{copy.reject}</Text></Pressable>
            </View>
          </View>;
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

function EvidenceActions({ requestId, copy }: { requestId: number; copy: (typeof returnsCopy)[keyof typeof returnsCopy] }) {
  const media = trpc.returns.mediaUrls.useQuery({ requestId }, { enabled: false });
  const [error, setError] = useState("");
  async function open(kind: "image" | "video") {
    setError("");
    try {
      const result = await media.refetch();
      if (!result.data) throw new Error("RETURN_MEDIA_UNAVAILABLE");
      const urls = result.data;
      await Linking.openURL(kind === "image" ? urls.imageUrl : urls.videoUrl);
    } catch {
      setError(copy.updateFailed);
    }
  }
  return <View style={styles.evidenceRow}>
    <Pressable disabled={media.isFetching} onPress={() => open("image")} style={styles.evidenceButton}><Ionicons name="image-outline" size={16} color={C.teal} /><Text style={styles.evidenceText}>{copy.viewPhoto}</Text></Pressable>
    <Pressable disabled={media.isFetching} onPress={() => open("video")} style={styles.evidenceButton}><Ionicons name="videocam-outline" size={16} color={C.teal} /><Text style={styles.evidenceText}>{copy.viewVideo}</Text></Pressable>
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 25, paddingBottom: 30, backgroundColor: C.bg, minHeight: "100%", width: "100%", maxWidth: 680, alignSelf: "center", gap: 12 },
  header: { gap: 5, marginBottom: 7 },
  kicker: { color: C.teal, fontSize: 12, fontWeight: "800" },
  title: { color: C.ink, fontSize: 24, fontWeight: "900" },
  card: { backgroundColor: C.white, borderRadius: 19, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10 },
  titleRow: { alignItems: "center", gap: 8 },
  productTitle: { flex: 1, color: C.ink, fontSize: 13, fontWeight: "900" },
  status: { color: C.teal, backgroundColor: C.pale, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: "900" },
  rejected: { color: C.red, backgroundColor: "#FEF2F2" },
  meta: { color: C.muted, fontSize: 11, lineHeight: 17 },
  reasonBox: { backgroundColor: "#F7F6F2", borderRadius: 12, padding: 11, gap: 6 },
  label: { color: C.ink, fontSize: 11, fontWeight: "900" },
  reason: { color: C.ink, fontSize: 12, lineHeight: 18 },
  evidenceRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  evidenceButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.pale, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  evidenceText: { color: C.teal, fontSize: 10, fontWeight: "900" },
  noteInput: { minHeight: 65, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, color: C.ink, textAlignVertical: "top", fontSize: 12 },
  helper: { color: C.muted, fontSize: 10, lineHeight: 15 },
  actions: { gap: 8 },
  approveButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 8 },
  rejectButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", backgroundColor: C.red, borderRadius: 12, paddingHorizontal: 8 },
  actionText: { color: C.white, fontSize: 11, fontWeight: "900", textAlign: "center" },
  disabled: { opacity: 0.6 },
  loading: { minHeight: 120, gap: 8, alignItems: "center", justifyContent: "center" },
  muted: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  link: { color: C.teal, fontWeight: "800", padding: 8 },
  error: { color: C.red, fontSize: 10 },
  notice: { color: C.teal, fontSize: 12, fontWeight: "800", textAlign: "center" },
});
