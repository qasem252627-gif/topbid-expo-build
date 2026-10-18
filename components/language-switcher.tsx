import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage, type Language } from "@/lib/i18n";

const options: { code: Language; labelKey: "languageArabic" | "languageEnglish" | "languageKurdish" }[] = [
  { code: "ar", labelKey: "languageArabic" },
  { code: "en", labelKey: "languageEnglish" },
  { code: "ku", labelKey: "languageKurdish" },
];

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = language === option.code;
        return (
          <Pressable key={option.code} onPress={() => setLanguage(option.code)} style={[styles.option, selected && styles.selected]}>
            <Text style={[styles.text, selected && styles.selectedText]}>{t(option.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", gap: 8 }, option: { flex: 1, borderWidth: 1, borderColor: "#E8E5DE", paddingVertical: 11, borderRadius: 14, alignItems: "center", backgroundColor: "#FFFFFF" }, selected: { backgroundColor: "#E7F3F0", borderColor: "#0D7C72" }, text: { color: "#53615F", fontSize: 13, fontWeight: "600" }, selectedText: { color: "#0D7C72", fontWeight: "800" } });
