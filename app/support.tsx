import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { supportContact } from "@/lib/support-contact";
import { supportCopy } from "@/lib/support-copy";
import { trpc } from "@/lib/trpc";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", white: "#FFFFFF", line: "#E8E5DE", pale: "#EAF3F0", red: "#B42318" };

export default function SupportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language, isRTL, t } = useLanguage();
  const copy = supportCopy[language];
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const messages = trpc.support.myMessages.useQuery(undefined, { enabled: Boolean(user), refetchInterval: user ? 5_000 : false, refetchIntervalInBackground: false });
  const utils = trpc.useUtils();
  const send = trpc.support.sendMessage.useMutation();

  async function openContact(uri: string) {
    try { await Linking.openURL(uri); } catch { setError(copy.failed); }
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setError("");
    try {
      await send.mutateAsync({ body });
      setDraft("");
      await utils.support.myMessages.invalidate();
    } catch {
      setError(copy.failed);
    }
  }

  const messageItems = messages.data?.messages ?? [];
  const contactConfigured = Boolean(supportContact.phone || supportContact.email);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/account");
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.header, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
            <Pressable onPress={goBack} style={[styles.backButton, { flexDirection: isRTL ? "row-reverse" : "row" }]} accessibilityRole="button" accessibilityLabel={copy.back}>
              <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={17} color={C.teal} />
              <Text style={styles.backText}>{copy.back}</Text>
            </Pressable>
            <Text style={styles.kicker}>{copy.title}</Text>
            <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{copy.title}</Text>
            <Text style={[styles.muted, { textAlign: isRTL ? "right" : "left" }]}>{copy.intro}</Text>
          </View>

          <View style={styles.contactCard}>
            <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>{copy.contact}</Text>
            {supportContact.phone ? <Pressable onPress={() => openContact(`tel:${supportContact.phone.replace(/[^+\d]/g, "")}`)} style={[styles.contactRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="call-outline" size={18} color={C.teal} />
              <Text style={styles.contactLabel}>{copy.phone}</Text>
              <Text style={styles.contactValue}>{supportContact.phone}</Text>
            </Pressable> : null}
            {supportContact.email ? <Pressable onPress={() => openContact(`mailto:${supportContact.email}`)} style={[styles.contactRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="mail-outline" size={18} color={C.teal} />
              <Text style={styles.contactLabel}>{copy.email}</Text>
              <Text style={styles.contactValue} numberOfLines={1}>{supportContact.email}</Text>
            </Pressable> : null}
            {!contactConfigured ? <Text style={styles.muted}>{copy.contactUnavailable}</Text> : null}
          </View>

          <View style={styles.chatCard}>
            <View style={[styles.chatHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={styles.chatIcon}><Ionicons name="chatbubbles-outline" size={19} color={C.teal} /></View>
              <View style={styles.chatHeading}>
                <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>{copy.chatTitle}</Text>
                <Text style={[styles.muted, { textAlign: isRTL ? "right" : "left" }]}>{copy.chatIntro}</Text>
              </View>
            </View>
            {!user ? <View style={styles.loginBox}>
              <Text style={styles.muted}>{copy.signIn}</Text>
              <Pressable onPress={() => router.push("/login")} style={styles.primaryButton}><Text style={styles.primaryText}>{t("signIn")}</Text></Pressable>
            </View> : null}
            {user && messages.isLoading ? <View style={styles.loading}><ActivityIndicator color={C.teal} /></View> : null}
            {user && messages.error ? <Text style={styles.error}>{copy.failed}</Text> : null}
            {user && !messages.isLoading && !messages.error && messageItems.length === 0 ? <Text style={styles.empty}>{copy.empty}</Text> : null}
            {user && messageItems.map((item) => {
              const isUserMessage = item.senderRole === "user";
              return <View key={item.id} style={[styles.messageRow, { justifyContent: isUserMessage ? (isRTL ? "flex-start" : "flex-end") : (isRTL ? "flex-end" : "flex-start") }]}>
                <View style={[styles.bubble, isUserMessage ? styles.userBubble : styles.adminBubble]}>
                  <Text style={styles.sender}>{isUserMessage ? copy.you : copy.admin}</Text>
                  <Text style={styles.messageBody}>{item.body}</Text>
                  <Text style={styles.messageTime}>{new Date(item.createdAt).toLocaleString(language === "en" ? "en-US" : language === "ku" ? "ckb-IQ" : "ar-IQ", { dateStyle: "short", timeStyle: "short" })}</Text>
                </View>
              </View>;
            })}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>
        {user ? <View style={[styles.composer, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <TextInput value={draft} onChangeText={setDraft} placeholder={copy.placeholder} placeholderTextColor="#8B9693" multiline maxLength={2000} textAlign={isRTL ? "right" : "left"} style={styles.input} />
          <Pressable accessibilityRole="button" accessibilityLabel={copy.send} onPress={sendMessage} disabled={send.isPending || !draft.trim()} style={[styles.sendButton, (send.isPending || !draft.trim()) && styles.disabled]}>
            {send.isPending ? <ActivityIndicator color={C.white} size="small" /> : <Ionicons name="send" size={17} color={C.white} />}
          </Pressable>
        </View> : null}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 18, backgroundColor: C.bg, width: "100%", maxWidth: 650, alignSelf: "center", gap: 14 },
  header: { gap: 6 },
  backButton: { alignItems: "center", gap: 3, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 4 },
  backText: { color: C.teal, fontSize: 12, fontWeight: "800" },
  kicker: { color: C.teal, fontSize: 12, fontWeight: "800" },
  title: { color: C.ink, fontSize: 24, fontWeight: "900" },
  muted: { color: C.muted, fontSize: 12, lineHeight: 18 },
  contactCard: { backgroundColor: C.white, borderRadius: 19, borderWidth: 1, borderColor: C.line, padding: 15, gap: 10 },
  sectionTitle: { color: C.ink, fontSize: 14, fontWeight: "900" },
  contactRow: { minHeight: 38, alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  contactLabel: { color: C.muted, fontSize: 11, fontWeight: "700" },
  contactValue: { flex: 1, color: C.teal, fontSize: 12, fontWeight: "800", textAlign: "right" },
  chatCard: { backgroundColor: C.white, borderRadius: 19, borderWidth: 1, borderColor: C.line, padding: 15, gap: 11 },
  chatHeader: { alignItems: "center", gap: 10 },
  chatIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.pale },
  chatHeading: { flex: 1, gap: 3 },
  loginBox: { alignItems: "center", gap: 10, paddingVertical: 12 },
  primaryButton: { backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  primaryText: { color: C.white, fontSize: 12, fontWeight: "900" },
  loading: { paddingVertical: 30, alignItems: "center" },
  empty: { color: C.muted, fontSize: 12, lineHeight: 18, paddingVertical: 13, textAlign: "center" },
  messageRow: { flexDirection: "row", marginVertical: 3 },
  bubble: { maxWidth: "88%", borderRadius: 15, padding: 11, gap: 5 },
  userBubble: { backgroundColor: C.pale },
  adminBubble: { backgroundColor: "#F7F6F2", borderWidth: 1, borderColor: C.line },
  sender: { color: C.teal, fontSize: 10, fontWeight: "900" },
  messageBody: { color: C.ink, fontSize: 12, lineHeight: 18 },
  messageTime: { color: C.muted, fontSize: 9, textAlign: "right" },
  error: { color: C.red, fontSize: 11, textAlign: "center" },
  composer: { gap: 9, padding: 12, paddingBottom: Platform.OS === "web" ? 12 : 18, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, width: "100%", maxWidth: 650, alignSelf: "center", alignItems: "flex-end" },
  input: { flex: 1, maxHeight: 110, minHeight: 44, borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, color: C.ink, fontSize: 13, textAlignVertical: "center" },
  sendButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.55 },
});
