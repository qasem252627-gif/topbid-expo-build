import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/lib/i18n";
import { formatOtpError } from "@/lib/otp-error";
import { profileCopy } from "@/lib/profile-copy";
import { returnsCopy } from "@/lib/returns-copy";
import { supportCopy } from "@/lib/support-copy";
import { exchangeCopy } from "@/lib/exchange-copy";
import { adsCopy } from "@/lib/ads-copy";
import { useExchangeRate } from "@/lib/exchange-rate";
import { ExchangeRateEditor } from "@/components/exchange-rate-editor";
import { useDeliveryFee } from "@/lib/use-delivery-fee";
import { DeliveryFeeEditor } from "@/components/delivery-fee-editor";
import { accountPagesCopy } from "@/lib/account-pages-copy";
import { requestFirebaseSmsCode } from "@/lib/firebase-phone-auth";

const C = { bg: "#F7F6F2", ink: "#172B2A", muted: "#6E7C79", teal: "#0D7C72", amber: "#E3A63A", white: "#FFFFFF", line: "#E8E5DE" };

export default function AccountScreen() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { language, isRTL, t } = useLanguage();
  const profileText = profileCopy[language];
  const returnText = returnsCopy[language];
  const supportText = supportCopy[language];
  const exchangeText = exchangeCopy[language];
  const adText = adsCopy[language];
  const pageText = accountPagesCopy[language];
  const exchangeRate = useExchangeRate();
  const deliveryFee = useDeliveryFee();
  const profile = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user) });
  const utils = trpc.useUtils();
  const admins = trpc.admins.summary.useQuery(undefined, { enabled: profile.data?.role === "admin" });
  const accountUser = profile.data;

  async function onSignOut() {
    await logout();
    await utils.auth.me.invalidate();
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
          <Text style={styles.kicker}>{t("account")}</Text>
          <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{t("profile")}</Text>
        </View>
        {loading || (user && profile.isLoading) ? <View style={styles.state}><ActivityIndicator color={C.teal} /></View> : null}
        {!user && !loading ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}><Ionicons name="person-outline" size={28} color={C.teal} /></View>
            <Text style={styles.userTitle}>{t("accountNeeded")}</Text>
            <Text style={styles.muted}>{t("signInHint")}</Text>
            <Pressable onPress={() => router.push("/login")} style={styles.primaryButton}><Text style={styles.primaryText}>{t("signIn")}</Text></Pressable>
          </View>
        ) : null}
        {user && accountUser ? (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatar}><Text style={styles.avatarLetter}>{(accountUser.name || accountUser.email || "M").slice(0, 1).toUpperCase()}</Text></View>
              <Text style={styles.userTitle}>{accountUser.name || t("user")}</Text>
              {!!accountUser.email && <Text style={styles.muted}>{accountUser.email}</Text>}
              <Text style={styles.muted}>{profileText.publicNameNotice}</Text>
              {accountUser.role === "admin" && <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>{t("admin")}</Text></View>}
              <Pressable onPress={onSignOut} style={styles.secondaryButton}><Text style={styles.secondaryText}>{t("signOut")}</Text></Pressable>
            </View>
            <ProfileForm key={`${accountUser.phone ?? ""}:${String(accountUser.phoneVerifiedAt ?? "")}`} initialPhone={accountUser.phone ?? ""} phoneVerifiedAt={accountUser.phoneVerifiedAt ?? null} />
          </>
        ) : null}

        <View style={styles.quickLinks}>
          <QuickLink icon="location-outline" title={pageText.addressLink} onPress={() => router.push("/address")} isRTL={isRTL} />
          <QuickLink icon="refresh-circle-outline" title={returnText.title} onPress={() => router.push("/returns")} isRTL={isRTL} />
          <QuickLink icon="chatbubbles-outline" title={supportText.title} onPress={() => router.push("/support")} isRTL={isRTL} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>{t("language")}</Text>
          <LanguageSwitcher />
        </View>
        <View style={styles.noteCard}>
          <View style={[styles.noteTitleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}><Ionicons name="cash-outline" size={18} color={C.teal} /><Text style={styles.noteTitle}>{t("currency")}</Text></View>
          <Text style={[styles.muted, { textAlign: isRTL ? "right" : "left" }]}>{exchangeText.rateLine.replace("{rate}", exchangeRate.toLocaleString())}</Text>
          <Text style={[styles.noteValue, { textAlign: isRTL ? "right" : "left" }]}>IQD  ·  USD</Text>
        </View>

        {accountUser?.role === "admin" ? (
          <View style={styles.adminSection}>
            <View style={[styles.adminHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text style={styles.sectionTitle}>{t("adminArea")}</Text>
              <View style={styles.countBadge}><Text style={styles.countText}>{t("adminCount")}: {admins.data?.adminCount ?? 0}</Text></View>
            </View>
            <ExchangeRateEditor rate={exchangeRate} />
            <DeliveryFeeEditor amount={deliveryFee.amount} currency={deliveryFee.currency} />
            <View style={styles.quickLinks}>
              <QuickLink icon="people-outline" title={pageText.usersLink} onPress={() => router.push("/admin-users")} isRTL={isRTL} />
              <QuickLink icon="trophy-outline" title={pageText.winnersLink} onPress={() => router.push("/admin-winners")} isRTL={isRTL} />
              <QuickLink icon="refresh-circle-outline" title={returnText.adminTitle} onPress={() => router.push("/admin-returns")} isRTL={isRTL} />
              <QuickLink icon="chatbubbles-outline" title={supportText.inbox} onPress={() => router.push("/admin-support")} isRTL={isRTL} />
              <QuickLink icon="megaphone-outline" title={adText.title} onPress={() => router.push("/admin-ads")} isRTL={isRTL} />
            </View>
            <Text style={styles.adminHint}>{t("adminSafety")}</Text>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function QuickLink({ icon, title, onPress, isRTL }: { icon: "refresh-circle-outline" | "chatbubbles-outline" | "megaphone-outline" | "location-outline" | "people-outline" | "trophy-outline"; title: string; onPress: () => void; isRTL: boolean }) {
  return <Pressable onPress={onPress} accessibilityRole="button" style={[styles.quickLink, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
    <Ionicons name={icon} size={18} color={C.teal} />
    <Text style={[styles.quickLinkText, { textAlign: isRTL ? "right" : "left" }]}>{title}</Text>
    <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color={C.muted} />
  </Pressable>;
}

function ProfileForm({ initialPhone, phoneVerifiedAt }: { initialPhone: string; phoneVerifiedAt: Date | null }) {
  const router = useRouter();
  const { language, isRTL } = useLanguage();
  const copy = profileCopy[language];
  const otpTestMode = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.firebasePhoneAuthTestMode === true;
  const withOtpDiagnostic = (message: string, error: unknown, phase: string) => formatOtpError(message, error, otpTestMode ? `${phase}-test` : phase);
  const utils = trpc.useUtils();
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [acceptedSmsOtp, setAcceptedSmsOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const verificationStatus = trpc.auth.phoneVerificationStatus.useQuery();
  const otpRequired = verificationStatus.data?.required ?? false;
  const smsAvailable = verificationStatus.data?.smsAvailable ?? true;
  const verifiedForPhone = Boolean(phoneVerifiedAt && phone.trim() === initialPhone);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setErrorMessage("");
      setMessage(copy.profileSaved);
    },
    onError: (error) => {
      setMessage("");
      setErrorMessage(error.message.includes("INVALID_PHONE") ? copy.phoneInvalid : copy.profileFailed);
    },
  });
  const prepareOtp = trpc.auth.prepareFirebasePhoneVerification.useMutation({
    onError: (error) => {
      const reason = error.message;
      let localizedError: string = copy.otpFailed;
      if (reason.includes("FIREBASE_NOT_CONFIGURED")) localizedError = copy.otpUnavailable;
      else if (reason.includes("PHONE_ALREADY_VERIFIED")) localizedError = copy.phoneVerified;
      else if (reason.includes("PHONE_ALREADY_IN_USE")) localizedError = copy.phoneInvalid;
      setOtpError(withOtpDiagnostic(localizedError, error, "server-prepare"));
    },
  });
  async function saveProfile() {
    setMessage("");
    setErrorMessage("");
    setOtpError("");
    if (!phone.trim()) { setErrorMessage(copy.phoneInvalid); return; }
    const needsVerification = otpRequired && !verifiedForPhone;
    if (needsVerification && !acceptedSmsOtp) { setOtpError(copy.otpConsent); return; }
    try {
      await updateProfile.mutateAsync({ phone: phone.trim() });
      if (needsVerification) {
        setMessage("");
        if (!smsAvailable) {
          setOtpError(copy.otpUnavailable);
          return;
        }
        setSendingSms(true);
        try {
          const result = await prepareOtp.mutateAsync();
          await requestFirebaseSmsCode(result.phone, "firebase-recaptcha-profile");
          router.push({ pathname: "/verify-phone", params: { resendAfterAt: String(Date.now() + 60_000) } });
        } catch (error) {
          const reason = error instanceof Error ? error.message : "";
          let localizedError: string = copy.otpFailed;
          if (reason.includes("FIREBASE_NOT_CONFIGURED") || reason.includes("FIREBASE_AUTH_UNAVAILABLE")) localizedError = copy.otpUnavailable;
          else if (reason.includes("invalid-phone-number")) localizedError = copy.phoneInvalid;
          if (reason.includes("PHONE_ALREADY_IN_USE") || reason.includes("PHONE_REQUIRED") || reason.includes("PHONE_ALREADY_VERIFIED")) {
            setOtpError(withOtpDiagnostic(localizedError, error, "firebase-send"));
          } else {
            const safeCode = reason.match(/(?:auth\/[a-z0-9-]+|FIREBASE_[A-Z0-9_]+|FIRESTORE_[A-Z0-9_]+|OTP_[A-Z0-9_]+|PHONE_[A-Z0-9_]+)/i)?.[0] ?? "UNKNOWN";
            router.push({ pathname: "/verify-phone", params: { sendFailed: "1", sendError: safeCode } });
          }
        } finally { setSendingSms(false); }
      } else {
        setMessage(copy.profileSaved);
      }
    } catch {
      // Mutation handlers expose localized errors in place.
    }
  }

  return (
    <View style={profileStyles.card}>
      <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>{copy.profileTitle}</Text>
      <Text style={[styles.muted, { textAlign: isRTL ? "right" : "left" }]}>{copy.profileIntro}</Text>
      <Text style={[profileStyles.label, { textAlign: isRTL ? "right" : "left" }]}>{copy.phone}</Text>
      <TextInput value={phone} onChangeText={(value) => { setPhone(value); setAcceptedSmsOtp(false); }} placeholder={copy.phonePlaceholder} placeholderTextColor="#97A19E" keyboardType="phone-pad" autoCapitalize="none" maxLength={32} style={[profileStyles.input, { textAlign: isRTL ? "right" : "left" }]} />
      <View style={[profileStyles.phoneStatus, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Ionicons name={verifiedForPhone ? "checkmark-circle" : "alert-circle-outline"} size={16} color={verifiedForPhone ? C.teal : C.amber} />
        <Text style={[profileStyles.statusText, { textAlign: isRTL ? "right" : "left" }]}>{verifiedForPhone ? copy.phoneVerified : otpRequired ? copy.phoneUnverified : copy.otpPendingSetup}</Text>
      </View>
      <Text style={[styles.muted, { textAlign: isRTL ? "right" : "left" }]}>{copy.contactPrivacy}</Text>
      {message ? <Text style={profileStyles.success}>{message}</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {!verifiedForPhone && otpRequired ? (
        <View style={profileStyles.otpSection}>
          <Pressable onPress={() => setAcceptedSmsOtp((value) => !value)} style={[profileStyles.consentRow, { flexDirection: isRTL ? "row-reverse" : "row" }]} accessibilityRole="checkbox" accessibilityState={{ checked: acceptedSmsOtp }}>
            <Ionicons name={acceptedSmsOtp ? "checkmark-circle" : "ellipse-outline"} size={19} color={acceptedSmsOtp ? C.teal : C.muted} />
            <Text style={[styles.muted, profileStyles.consentText, { textAlign: isRTL ? "right" : "left" }]}>{copy.otpConsent}</Text>
          </Pressable>
        </View>
      ) : null}
      {Platform.OS === "web" && otpRequired && smsAvailable && !verifiedForPhone ? <View nativeID="firebase-recaptcha-profile" style={profileStyles.recaptcha} /> : null}
      {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}
      <Pressable onPress={saveProfile} disabled={updateProfile.isPending || prepareOtp.isPending || sendingSms} style={[styles.primaryButton, (updateProfile.isPending || prepareOtp.isPending || sendingSms) && { opacity: 0.65 }]} accessibilityRole="button">
        {updateProfile.isPending || prepareOtp.isPending || sendingSms ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryText}>{otpRequired && !verifiedForPhone ? copy.saveAndSendOtp : copy.saveProfile}</Text>}
      </Pressable>
      {!verifiedForPhone && otpRequired && phone.trim() === initialPhone ? <Pressable onPress={() => router.push("/verify-phone")} accessibilityRole="button"><Text style={profileStyles.otpButtonText}>{copy.enterOtp}</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 30, backgroundColor: C.bg, minHeight: "100%", maxWidth: 620, width: "100%", alignSelf: "center" }, header: { gap: 5, marginBottom: 20 }, kicker: { color: C.teal, fontSize: 12, fontWeight: "800" }, title: { color: C.ink, fontSize: 24, fontWeight: "900" }, profileCard: { backgroundColor: C.white, borderRadius: 24, padding: 22, alignItems: "center", gap: 9, borderWidth: 1, borderColor: C.line }, avatar: { height: 62, width: 62, borderRadius: 21, backgroundColor: "#E7F3F0", alignItems: "center", justifyContent: "center", marginBottom: 3 }, avatarLetter: { color: C.teal, fontSize: 23, fontWeight: "900" }, userTitle: { color: C.ink, fontSize: 17, fontWeight: "900", textAlign: "center" }, muted: { color: C.muted, fontSize: 12, lineHeight: 19, textAlign: "center" }, adminBadge: { backgroundColor: "#FFF4DE", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 }, adminBadgeText: { color: "#8B5E0A", fontSize: 11, fontWeight: "800" }, primaryButton: { backgroundColor: C.teal, paddingHorizontal: 23, paddingVertical: 12, borderRadius: 14, marginTop: 5 }, primaryText: { color: C.white, fontSize: 13, fontWeight: "800" }, secondaryButton: { borderWidth: 1, borderColor: C.line, paddingHorizontal: 19, paddingVertical: 10, borderRadius: 13, marginTop: 5 }, secondaryText: { color: C.ink, fontSize: 12, fontWeight: "800" }, section: { marginTop: 22, gap: 10 }, sectionTitle: { color: C.ink, fontSize: 15, fontWeight: "900" }, noteCard: { marginTop: 18, backgroundColor: C.white, borderRadius: 19, padding: 16, borderWidth: 1, borderColor: C.line, gap: 8 }, noteTitleRow: { alignItems: "center", gap: 8 }, noteTitle: { color: C.ink, fontWeight: "800", fontSize: 13 }, noteValue: { color: C.teal, fontWeight: "900", fontSize: 14 }, quickLinks: { marginTop: 18, gap: 9 }, quickLink: { minHeight: 50, alignItems: "center", gap: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 15, paddingHorizontal: 14 }, quickLinkText: { flex: 1, color: C.ink, fontSize: 12, fontWeight: "800" }, adminSection: { marginTop: 22, backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 15, gap: 12 }, adminHeader: { justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }, countBadge: { backgroundColor: "#E7F3F0", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 }, countText: { color: C.teal, fontSize: 10, fontWeight: "800" }, personRow: { alignItems: "center", gap: 9, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 11 }, personAvatar: { width: 33, height: 33, borderRadius: 12, backgroundColor: "#F0EEE8", alignItems: "center", justifyContent: "center" }, personInitial: { color: C.ink, fontSize: 12, fontWeight: "900" }, personText: { flex: 1 }, personName: { color: C.ink, fontWeight: "800", fontSize: 12 }, personEmail: { color: C.muted, fontSize: 9, marginTop: 3 }, roleChip: { backgroundColor: "#F0EEE8", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 }, roleAdmin: { backgroundColor: "#E7F3F0" }, roleChipText: { color: C.ink, fontSize: 9, fontWeight: "800" }, roleAdminText: { color: C.teal }, adminHint: { color: C.muted, fontSize: 10, lineHeight: 16 }, errorText: { color: "#A33128", fontSize: 11, textAlign: "center" }, state: { minHeight: 85, alignItems: "center", justifyContent: "center" } });

const profileStyles = StyleSheet.create({
  card: { marginTop: 12, backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
  label: { color: C.ink, fontSize: 11, fontWeight: "800" },
  input: { minHeight: 45, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: "#FCFBF8", paddingHorizontal: 12, color: C.ink, fontSize: 13 },
  multiline: { minHeight: 86, paddingTop: 11, textAlignVertical: "top" },
  phoneStatus: { alignItems: "center", gap: 7, marginBottom: 2 },
  statusText: { flex: 1, color: C.muted, fontSize: 11, fontWeight: "800" },
  otpSection: { marginTop: 5, gap: 9 },
  recaptcha: { minHeight: 80, alignItems: "center", justifyContent: "center" },
  consentRow: { alignItems: "center", gap: 8 },
  consentText: { flex: 1 },
  otpButton: { minHeight: 43, borderRadius: 13, borderWidth: 1, borderColor: C.teal, backgroundColor: "#EAF5F2", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  otpButtonText: { color: C.teal, fontSize: 12, fontWeight: "900" },
  codeInput: { textAlign: "center", letterSpacing: 6, fontWeight: "900" },
  success: { color: C.teal, fontSize: 11, fontWeight: "800", textAlign: "center" },
});
