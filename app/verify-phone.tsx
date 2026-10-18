import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { profileCopy } from "@/lib/profile-copy";
import { useLanguage } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { confirmFirebaseSmsCode, requestFirebaseSmsCode } from "@/lib/firebase-phone-auth";
import { formatOtpError } from "@/lib/otp-error";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", white: "#FFFFFF", line: "#E8E5DE", red: "#A33128" };

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ resendAfterAt?: string; sendFailed?: string; sendError?: string }>();
  const { user, loading } = useAuth();
  const { language, isRTL } = useLanguage();
  const copy = profileCopy[language];
  const utils = trpc.useUtils();
  const profile = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user) });
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const sendFailureCode = typeof params.sendError === "string" ? params.sendError : "";
  const initialSendError = sendFailureCode.includes("invalid-phone-number") ? copy.phoneInvalid
    : sendFailureCode.includes("FIREBASE_NOT_CONFIGURED") || sendFailureCode.includes("FIREBASE_AUTH_UNAVAILABLE") ? copy.otpUnavailable
      : sendFailureCode.includes("too-many-requests") ? copy.otpRateLimited
        : params.sendFailed === "1" ? copy.otpFailed : "";
  const [error, setError] = useState(initialSendError);
  const [confirming, setConfirming] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [resendAt, setResendAt] = useState(Number(params.resendAfterAt) || 0);
  const [now, setNow] = useState(() => Date.now());
  const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const verificationStatus = trpc.auth.phoneVerificationStatus.useQuery(undefined, { enabled: Boolean(user) });
  const smsAvailable = verificationStatus.data?.smsAvailable ?? true;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function finishVerification() {
    setError("");
    setMessage(copy.phoneVerified);
    await utils.auth.me.invalidate();
    router.replace("/(tabs)/account");
  }

  const verifySms = trpc.auth.verifyFirebasePhone.useMutation({ onSuccess: finishVerification });
  const prepareSms = trpc.auth.prepareFirebasePhoneVerification.useMutation();

  async function confirm() {
    setMessage("");
    setError("");
    const trimmedCode = code.trim();
    if (!/^[0-9]{6}$/.test(trimmedCode)) { setError(copy.otpInvalid); return; }

    setConfirming(true);
    let phase = "firebase-confirm";
    try {
      const idToken = await confirmFirebaseSmsCode(trimmedCode);
      phase = "server-verify";
      await verifySms.mutateAsync({ idToken });
    } catch (verificationError) {
      const reason = verificationError instanceof Error ? verificationError.message : "";
      let localizedError: string = copy.otpFailed;
      if (reason.includes("invalid-verification-code") || reason.includes("code-expired")) localizedError = copy.otpInvalid;
      else if (reason.includes("PHONE_ALREADY_IN_USE") || reason.includes("FIREBASE_PHONE_MISMATCH")) localizedError = copy.phoneInvalid;
      else if (reason.includes("FIREBASE_NOT_CONFIGURED")) localizedError = copy.otpUnavailable;
      else if (reason.includes("OTP_RATE_LIMITED") || reason.includes("OTP_COOLDOWN") || reason.includes("too-many-requests")) localizedError = copy.otpRateLimited;
      setError(formatOtpError(localizedError, verificationError, phase));
    } finally {
      setConfirming(false);
    }
  }

  async function resendSms() {
    setMessage("");
    setError("");
    if (!smsAvailable) { setError(copy.otpUnavailable); return; }
    if (resendSeconds > 0) { setError(copy.otpCooldown); return; }
    let phase = "server-prepare";
    setSendingSms(true);
    try {
      const { phone } = await prepareSms.mutateAsync();
      phase = "firebase-send";
      await requestFirebaseSmsCode(phone, "firebase-recaptcha-verify");
      const next = Date.now() + 60_000;
      setResendAt(next);
      setNow(Date.now());
      setCode("");
      setMessage(copy.otpSent);
    } catch (requestError) {
      const reason = requestError instanceof Error ? requestError.message : "";
      let localizedError: string = copy.otpFailed;
      if (reason.includes("FIREBASE_NOT_CONFIGURED") || reason.includes("FIREBASE_AUTH_UNAVAILABLE")) localizedError = copy.otpUnavailable;
      else if (reason.includes("PHONE_ALREADY_VERIFIED")) localizedError = copy.phoneVerified;
      else if (reason.includes("PHONE_ALREADY_IN_USE")) localizedError = copy.phoneInvalid;
      else if (reason.includes("too-many-requests")) localizedError = copy.otpRateLimited;
      setError(formatOtpError(localizedError, requestError, phase));
    } finally {
      setSendingSms(false);
    }
  }

  if (loading || (user && profile.isLoading)) return <ScreenContainer><View style={styles.center}><ActivityIndicator color={C.teal} /></View></ScreenContainer>;
  if (!user) return <ScreenContainer><View style={styles.center}><Text style={styles.error}>{copy.profileFailed}</Text><Pressable onPress={() => router.replace("/login")} style={styles.primary}><Text style={styles.primaryText}>{language === "ar" ? "تسجيل الدخول" : language === "ku" ? "چوونەژوورەوە" : "Sign in"}</Text></Pressable></View></ScreenContainer>;
  if (!verificationStatus.isLoading && !verificationStatus.data?.required) return <ScreenContainer><View style={styles.center}><Text style={styles.body}>{copy.otpUnavailable}</Text><Pressable onPress={() => router.replace("/(tabs)/account")} style={styles.primary}><Text style={styles.primaryText}>{language === "ar" ? "العودة إلى الحساب" : language === "ku" ? "گەڕانەوە بۆ هەژمار" : "Back to account"}</Text></Pressable></View></ScreenContainer>;

  const busy = confirming || verifySms.isPending;
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={[styles.back, { alignSelf: isRTL ? "flex-end" : "flex-start", flexDirection: isRTL ? "row-reverse" : "row" }]} accessibilityRole="button">
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={18} color={C.teal} />
          <Text style={styles.backText}>{language === "ar" ? "رجوع" : language === "ku" ? "گەڕانەوە" : "Back"}</Text>
        </Pressable>
        <View style={styles.card}>
          <View style={styles.icon}><Ionicons name="chatbubble-ellipses-outline" size={32} color={C.teal} /></View>
          <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{copy.otpScreenTitle}</Text>
          <Text style={[styles.body, { textAlign: isRTL ? "right" : "left" }]}>{copy.otpScreenIntro}</Text>
          <Text style={styles.phone}>{profile.data?.phone ?? ""}</Text>
          {Platform.OS === "web" && smsAvailable ? <View nativeID="firebase-recaptcha-verify" style={styles.recaptcha} /> : null}
          <TextInput
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
            placeholder={copy.otpPlaceholder}
            placeholderTextColor="#97A19E"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={6}
            style={styles.input}
            accessibilityLabel={copy.otpPlaceholder}
          />
          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable onPress={confirm} disabled={busy || code.length !== 6} style={[styles.primary, (busy || code.length !== 6) && styles.disabled]} accessibilityRole="button">
            {busy ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryText}>{copy.confirmOtp}</Text>}
          </Pressable>
          {smsAvailable ? (
            <Pressable onPress={resendSms} disabled={prepareSms.isPending || sendingSms || resendSeconds > 0} style={[styles.secondary, (prepareSms.isPending || sendingSms || resendSeconds > 0) && styles.disabled]} accessibilityRole="button">
              {prepareSms.isPending || sendingSms ? <ActivityIndicator color={C.teal} /> : <Text style={styles.secondaryText}>{resendSeconds > 0 ? copy.resendAfter.replace("{seconds}", String(resendSeconds)) : copy.resendOtp}</Text>}
            </Pressable>
          ) : null}
          <Text style={styles.hint}>{copy.otpTestingHint}</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingTop: 14, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  back: { width: "100%", maxWidth: 470, alignItems: "center", gap: 4, marginBottom: 14 },
  backText: { color: C.teal, fontWeight: "800", fontSize: 12 },
  card: { width: "100%", maxWidth: 470, backgroundColor: C.white, borderRadius: 23, padding: 22, borderWidth: 1, borderColor: C.line, gap: 14 },
  icon: { width: 68, height: 68, borderRadius: 24, backgroundColor: "#E7F3F0", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  title: { color: C.ink, fontSize: 23, fontWeight: "900" },
  body: { color: C.muted, fontSize: 13, lineHeight: 20 },
  phone: { color: C.teal, fontSize: 15, fontWeight: "900", textAlign: "center", writingDirection: "ltr" },
  input: { minHeight: 54, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: "#FCFBF8", paddingHorizontal: 15, color: C.ink, fontSize: 22, fontWeight: "900", textAlign: "center", letterSpacing: 7 },
  primary: { minHeight: 49, borderRadius: 14, backgroundColor: C.teal, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryText: { color: C.white, fontSize: 13, fontWeight: "900", textAlign: "center" },
  secondary: { minHeight: 45, borderRadius: 14, backgroundColor: "#E7F3F0", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  secondaryText: { color: C.teal, fontSize: 12, fontWeight: "800", textAlign: "center" },
  success: { color: C.teal, fontSize: 12, fontWeight: "800", textAlign: "center" },
  error: { color: C.red, fontSize: 12, fontWeight: "800", textAlign: "center" },
  hint: { color: C.muted, fontSize: 10, textAlign: "center", lineHeight: 16 },
  recaptcha: { minHeight: 80, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.55 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
});
