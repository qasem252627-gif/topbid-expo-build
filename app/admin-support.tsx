import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useLanguage } from "@/lib/i18n";
import { supportCopy } from "@/lib/support-copy";
import { trpc } from "@/lib/trpc";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", red: "#B42318", white: "#FFFFFF", line: "#E8E5DE", pale: "#EAF3F0" };

export default function AdminSupportScreen() {
  const { language, isRTL, t } = useLanguage();
  const copy = supportCopy[language];
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const conversations = trpc.support.adminConversations.useQuery(undefined, { refetchInterval: 10_000, refetchIntervalInBackground: false });
  const messages = trpc.support.adminMessages.useQuery({ conversationId: conversationId ?? 0 }, { enabled: conversationId !== null, refetchInterval: conversationId !== null ? 5_000 : false, refetchIntervalInBackground: false });
  const utils = trpc.useUtils();
  const reply = trpc.support.adminReply.useMutation();

  async function sendReply() {
    const body = draft.trim();
    if (!conversationId || !body || reply.isPending) return;
    setError("");
    try {
      await reply.mutateAsync({ conversationId, body });
      setDraft("");
      await Promise.all([utils.support.adminMessages.invalidate({ conversationId }), utils.support.adminConversations.invalidate()]);
    } catch {
      setError(copy.replyFailed);
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
          <Text style={styles.kicker}>{copy.inbox}</Text>
          <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{copy.inbox}</Text>
        </View>
        {conversations.isLoading ? <View style={styles.loading}><ActivityIndicator color={C.teal} /></View> : null}
        {conversations.error ? <View style={styles.card}><Text style={styles.error}>{t("failed")}</Text><Pressable onPress={() => conversations.refetch()}><Text style={styles.link}>{t("retry")}</Text></Pressable></View> : null}
        {conversations.data?.length === 0 && !conversations.isLoading ? <View style={styles.card}><Text style={styles.muted}>{copy.inboxEmpty}</Text></View> : null}
        {conversations.data?.map((item) => <Pressable key={item.id} onPress={() => { setConversationId(item.id); setError(""); }} style={[styles.conversation, conversationId === item.id && styles.selectedConversation, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.avatar}><Ionicons name="person-outline" size={17} color={C.teal} /></View>
          <View style={styles.conversationInfo}>
            <Text style={[styles.userName, { textAlign: isRTL ? "right" : "left" }]}>{item.userName || copy.customer}</Text>
            <Text style={[styles.phone, { textAlign: isRTL ? "right" : "left" }]}>{item.phone || "—"} · {item.email || "—"}</Text>
          </View>
          <Text style={styles.date}>{new Date(item.lastMessageAt).toLocaleDateString(language === "en" ? "en-US" : language === "ku" ? "ckb-IQ" : "ar-IQ")}</Text>
        </Pressable>)}

        {conversationId === null ? <View style={styles.card}><Ionicons name="chatbubbles-outline" size={28} color={C.teal} /><Text style={styles.muted}>{copy.selectConversation}</Text></View> : <View style={styles.chatCard}>
          <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>{copy.chatTitle}</Text>
          {messages.isLoading ? <ActivityIndicator color={C.teal} /> : null}
          {messages.error ? <Text style={styles.error}>{copy.failed}</Text> : null}
          {messages.data?.length === 0 && !messages.isLoading ? <Text style={styles.muted}>{copy.empty}</Text> : null}
          {messages.data?.map((item) => <View key={item.id} style={[styles.message, item.senderRole === "admin" ? styles.adminMessage : styles.userMessage]}>
            <Text style={styles.sender}>{item.senderRole === "admin" ? copy.admin : item.senderName || copy.customer}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleString(language === "en" ? "en-US" : language === "ku" ? "ckb-IQ" : "ar-IQ", { dateStyle: "short", timeStyle: "short" })}</Text>
          </View>)}
          <View style={styles.composer}>
            <TextInput value={draft} onChangeText={setDraft} placeholder={copy.reply} placeholderTextColor="#8B9693" multiline maxLength={2000} textAlign={isRTL ? "right" : "left"} style={styles.input} />
            <Pressable onPress={sendReply} disabled={reply.isPending || !draft.trim()} style={[styles.sendButton, (reply.isPending || !draft.trim()) && styles.disabled]}>
              {reply.isPending ? <ActivityIndicator color={C.white} size="small" /> : <Ionicons name="send" size={17} color={C.white} />}
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 25, paddingBottom: 30, backgroundColor: C.bg, minHeight: "100%", width: "100%", maxWidth: 650, alignSelf: "center", gap: 10 },
  header: { gap: 5, marginBottom: 7 },
  kicker: { color: C.teal, fontSize: 12, fontWeight: "800" },
  title: { color: C.ink, fontSize: 24, fontWeight: "900" },
  conversation: { alignItems: "center", gap: 9, padding: 11, borderRadius: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  selectedConversation: { borderColor: C.teal, backgroundColor: C.pale },
  avatar: { width: 35, height: 35, borderRadius: 13, backgroundColor: C.pale, alignItems: "center", justifyContent: "center" },
  conversationInfo: { flex: 1 },
  userName: { color: C.ink, fontSize: 12, fontWeight: "900" },
  phone: { color: C.muted, fontSize: 9, marginTop: 3 },
  date: { color: C.muted, fontSize: 9 },
  card: { backgroundColor: C.white, borderRadius: 18, padding: 18, alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.line },
  chatCard: { backgroundColor: C.white, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: C.line },
  sectionTitle: { color: C.ink, fontSize: 14, fontWeight: "900" },
  message: { borderRadius: 14, padding: 10, gap: 5 },
  userMessage: { backgroundColor: "#F7F6F2" },
  adminMessage: { backgroundColor: C.pale },
  sender: { color: C.teal, fontSize: 10, fontWeight: "900" },
  body: { color: C.ink, fontSize: 12, lineHeight: 18 },
  composer: { flexDirection: "row", gap: 8, alignItems: "flex-end", marginTop: 3 },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, color: C.ink, fontSize: 12, textAlignVertical: "center" },
  sendButton: { width: 43, height: 43, borderRadius: 13, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.55 },
  loading: { minHeight: 80, alignItems: "center", justifyContent: "center" },
  muted: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  error: { color: C.red, fontSize: 11, textAlign: "center" },
  link: { color: C.teal, fontWeight: "800", padding: 8 },
});
