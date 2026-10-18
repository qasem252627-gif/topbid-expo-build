import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/lib/i18n";
import { exchangeCopy } from "@/lib/exchange-copy";

const C = { ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", white: "#FFFFFF", line: "#E8E5DE", red: "#A33128" };

export function ExchangeRateEditor({ rate }: { rate: number }) {
  const { language, isRTL } = useLanguage();
  const copy = exchangeCopy[language];
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();
  const update = trpc.settings.updateExchangeRate.useMutation({
    onSuccess: async () => {
      setMessage(copy.saved);
      setDraft((current) => current ?? String(rate));
      await utils.settings.exchangeRate.invalidate();
    },
    onError: () => setMessage(copy.failed),
  });

  function save() {
    setMessage("");
    const value = Number(draft ?? rate);
    if (!Number.isInteger(value) || value < 1 || value > 100_000) {
      setMessage(copy.invalid);
      return;
    }
    update.mutate(value);
  }

  return (
    <View style={styles.card}>
      <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{copy.adminTitle}</Text>
      <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.field}</Text>
      <TextInput
        value={draft ?? String(rate)}
        onChangeText={(value) => { setDraft(value); setMessage(""); }}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={6}
        style={[styles.input, { textAlign: isRTL ? "right" : "left" }]}
        accessibilityLabel={copy.field}
      />
      <Text style={[styles.hint, { textAlign: isRTL ? "right" : "left" }]}>{copy.hint}</Text>
      {message ? <Text style={[styles.message, message === copy.invalid || message === copy.failed ? styles.error : styles.success]}>{message}</Text> : null}
      <Pressable onPress={save} disabled={update.isPending} style={[styles.button, update.isPending && { opacity: 0.65 }]} accessibilityRole="button">
        {update.isPending ? <ActivityIndicator color={C.white} /> : <Text style={styles.buttonText}>{copy.save}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#F7F6F2", borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, gap: 8 },
  title: { color: C.ink, fontSize: 13, fontWeight: "900" },
  label: { color: C.ink, fontSize: 11, fontWeight: "800" },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, paddingHorizontal: 12, color: C.ink, fontSize: 14, fontWeight: "800" },
  hint: { color: C.muted, fontSize: 10, lineHeight: 15 },
  message: { fontSize: 10, fontWeight: "800", textAlign: "center" },
  success: { color: C.teal },
  error: { color: C.red },
  button: { minHeight: 42, borderRadius: 12, backgroundColor: C.teal, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonText: { color: C.white, fontSize: 11, fontWeight: "900" },
});
