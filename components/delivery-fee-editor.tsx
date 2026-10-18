import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/lib/i18n";
import { accountPagesCopy } from "@/lib/account-pages-copy";
import { formatCurrency, type CurrencyCode } from "@/lib/currency";
import { isValidDeliveryFee, parseDeliveryFeeInput } from "@/lib/delivery-fee";

const C = { ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", white: "#FFFFFF", line: "#E8E5DE", red: "#A33128" };

export function DeliveryFeeEditor({ amount, currency }: { amount: number; currency: CurrencyCode }) {
  const { language, isRTL } = useLanguage();
  const copy = accountPagesCopy[language];
  const [draft, setDraft] = useState<string | null>(null);
  const [draftCurrency, setDraftCurrency] = useState<CurrencyCode | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const utils = trpc.useUtils();
  const selectedCurrency = draftCurrency ?? currency;
  const update = trpc.settings.updateDeliveryFee.useMutation({
    onSuccess: async () => {
      setIsError(false);
      setMessage(copy.deliverySaved);
      setDraft(null);
      setDraftCurrency(null);
      await utils.settings.deliveryFee.invalidate();
    },
    onError: () => { setIsError(true); setMessage(copy.deliveryFailed); },
  });
  function save() {
    setMessage("");
    const value = parseDeliveryFeeInput(draft ?? String(amount));
    if (value === null || !isValidDeliveryFee(value, selectedCurrency)) {
      setIsError(true);
      setMessage(copy.deliveryInvalid);
      return;
    }
    update.mutate({ amount: value, currency: selectedCurrency });
  }
  const current = amount === 0 ? copy.freeDelivery : formatCurrency(amount, currency, language);
  return (
    <View style={styles.card}>
      <View style={[styles.headerRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text style={styles.title}>{copy.deliveryTitle}</Text>
        <Text style={styles.current}>{copy.currentDelivery}: {current}</Text>
      </View>
      <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.deliveryField}</Text>
      <TextInput
        value={draft ?? String(amount)}
        onChangeText={(value) => { setDraft(value); setMessage(""); }}
        keyboardType="decimal-pad"
        inputMode="decimal"
        maxLength={10}
        style={[styles.input, { textAlign: isRTL ? "right" : "left" }]}
        accessibilityLabel={copy.deliveryField}
      />
      <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.deliveryCurrency}</Text>
      <View style={[styles.currencyRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {(["USD", "IQD"] as const).map((code) => (
          <Pressable key={code} onPress={() => { setDraftCurrency(code); setMessage(""); }} accessibilityRole="radio" accessibilityState={{ selected: selectedCurrency === code }} style={[styles.currencyChip, selectedCurrency === code && styles.currencyChipActive]}>
            <Text style={[styles.currencyText, selectedCurrency === code && styles.currencyTextActive]}>{code}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.hint, { textAlign: isRTL ? "right" : "left" }]}>{copy.deliveryHint}</Text>
      {message ? <Text style={[styles.message, isError ? styles.error : styles.success]}>{message}</Text> : null}
      <Pressable onPress={save} disabled={update.isPending} style={[styles.button, update.isPending && { opacity: 0.65 }]} accessibilityRole="button">
        {update.isPending ? <ActivityIndicator color={C.white} /> : <Text style={styles.buttonText}>{copy.saveDelivery}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#F7F6F2", borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, gap: 8 },
  headerRow: { alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  title: { color: C.ink, fontSize: 13, fontWeight: "900" },
  current: { color: C.teal, fontSize: 11, fontWeight: "800" },
  label: { color: C.ink, fontSize: 11, fontWeight: "800" },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, paddingHorizontal: 12, color: C.ink, fontSize: 14, fontWeight: "800" },
  currencyRow: { gap: 8 },
  currencyChip: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: "center", justifyContent: "center" },
  currencyChipActive: { borderColor: C.teal, backgroundColor: "#E7F3F0" },
  currencyText: { color: C.ink, fontSize: 12, fontWeight: "800" },
  currencyTextActive: { color: C.teal },
  hint: { color: C.muted, fontSize: 10, lineHeight: 15 },
  message: { fontSize: 10, fontWeight: "800", textAlign: "center" },
  success: { color: C.teal },
  error: { color: C.red },
  button: { minHeight: 42, borderRadius: 12, backgroundColor: C.teal, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonText: { color: C.white, fontSize: 11, fontWeight: "900" },
});
