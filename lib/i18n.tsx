import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

export type Language = "ar" | "en" | "ku";
type CopyKey = keyof typeof copy.ar;
type LanguageState = { language: Language; setLanguage: (language: Language) => void; isRTL: boolean; t: (key: CopyKey) => string };

const copy = {
  ar: {
    home: "استكشف", myBids: "مزايداتي", account: "حسابي", search: "ابحث عن غرضك", all: "الكل", electronics: "إلكترونيات", homeGoods: "للمنزل", liveAuctions: "مزادات متاحة", seeAll: "عرض الكل", currentBid: "أعلى مزايدة", startingAt: "يبدأ من", endsIn: "ينتهي خلال", bidCount: "مزايدة", bidNow: "زايد الآن", placeBid: "تأكيد المزايدة", minimumBid: "أقل مزايدة مقبولة", details: "تفاصيل الغرض", bidHistory: "سجل المزايدات", noBids: "لا توجد مزايدات بعد", myBidsTitle: "كل مزايداتك في مكان واحد", noMyBids: "لم تشارك في أي مزاد بعد", discover: "اكتشف المزادات وابدأ المزايدة", signIn: "تسجيل الدخول", signUp: "إنشاء حساب", signInHint: "سجّل الدخول أو أنشئ حسابًا للبدء بالمزايدة.", signInToBid: "سجّل الدخول لتقديم مزايدة", signOut: "تسجيل الخروج", language: "اللغة", currency: "عرض العملة", admin: "مدير", adminArea: "إدارة الحسابات", adminCount: "حسابات الإدارة", status: "الحالة", active: "مفتوح", ended: "منتهٍ", winning: "أعلى مزايدتك", outbid: "تم تجاوز مزايدتك", close: "إغلاق", loading: "لحظة من فضلك…", retry: "أعد المحاولة", failed: "تعذّر إتمام الطلب", successBid: "تم تسجيل مزايدتك", name: "TopBid", searchResults: "نتائج البحث", noResults: "لم نعثر على أغراض مطابقة", user: "مستخدم", manageRole: "تغيير الصلاحية", makeAdmin: "منح صلاحية مدير", makeUser: "إزالة صلاحية المدير", adminSafety: "يجب أن يبقى في التطبيق حسابا إدارة على الأقل.", approximate: "تقريبي", sortEnding: "الأقرب انتهاءً", currencyIQD: "د.ع", currencyUSD: "دولار", profile: "الملف الشخصي", accountNeeded: "أنشئ حسابك لمتابعة مزايداتك", bidAmount: "مبلغ المزايدة", increment: "الزيادة الدنيا", notConfigured: "تحويلات العملات تقديرية وتعتمد على سعر مرجعي، وقد تختلف عن سعر السوق الحالي.", featured: "اختيارات TopBid", welcome: "غرض مميز ينتظر مزايدتك", browseHint: "إلكترونيات وأغراض منزلية — مزادات محلية أوضح.", remaining: "متبقٍ", minBidError: "ارفع المبلغ إلى الحد الأدنى المطلوب.", roleUpdated: "تم تحديث الصلاحية", noAdminPermission: "هذه الصفحة متاحة لحسابات الإدارة فقط.", bidsFor: "مزايدتك", languageArabic: "العربية", languageEnglish: "English", languageKurdish: "کوردی",
  },
  en: {
    home: "Explore", myBids: "My bids", account: "Account", search: "Search items", all: "All", electronics: "Electronics", homeGoods: "Home", liveAuctions: "Open auctions", seeAll: "See all", currentBid: "Current bid", startingAt: "Starting at", endsIn: "Ends in", bidCount: "bids", bidNow: "Bid now", placeBid: "Place bid", minimumBid: "Minimum accepted bid", details: "Item details", bidHistory: "Bid history", noBids: "No bids yet", myBidsTitle: "All your bids, in one place", noMyBids: "You haven't joined an auction yet", discover: "Explore auctions and place your first bid", signIn: "Sign in", signUp: "Create account", signInHint: "Sign in or create an account to start bidding.", signInToBid: "Sign in to place a bid", signOut: "Sign out", language: "Language", currency: "Currency display", admin: "Admin", adminArea: "Account management", adminCount: "Admin accounts", status: "Status", active: "Open", ended: "Ended", winning: "Your bid is leading", outbid: "You've been outbid", close: "Close", loading: "Just a moment…", retry: "Try again", failed: "We couldn't complete that request", successBid: "Your bid was recorded", name: "TopBid", searchResults: "Search results", noResults: "No matching items found", user: "User", manageRole: "Change access", makeAdmin: "Make admin", makeUser: "Remove admin", adminSafety: "At least two admin accounts must remain.", approximate: "approx.", sortEnding: "Ending soon", currencyIQD: "IQD", currencyUSD: "USD", profile: "Profile", accountNeeded: "Create an account to track your bids", bidAmount: "Your bid", increment: "Minimum increment", notConfigured: "Currency conversions are estimates using a reference rate and may differ from the current market.", featured: "TopBid picks", welcome: "A good find is waiting for your bid", browseHint: "Electronics and home goods — clearer local auctions.", remaining: "left", minBidError: "Raise your bid to the required minimum.", roleUpdated: "Access updated", noAdminPermission: "This page is available to admins only.", bidsFor: "Your bid", languageArabic: "العربية", languageEnglish: "English", languageKurdish: "کوردی",
  },
  ku: {
    home: "گەڕان", myBids: "مزایدەکانم", account: "هەژمار", search: "گەڕان بۆ کاڵا", all: "هەموو", electronics: "ئەلیکترۆنیات", homeGoods: "ماڵەوە", liveAuctions: "مزایدە کراوەکان", seeAll: "بینینی هەموو", currentBid: "بەرزترین مزایدە", startingAt: "دەستپێک لە", endsIn: "کۆتایی دێت لە", bidCount: "مزایدە", bidNow: "ئێستا مزایدە بکە", placeBid: "پشتڕاستکردنەوەی مزایدە", minimumBid: "کەمترین مزایدەی پەسەندکراو", details: "زانیاری کاڵا", bidHistory: "مێژووی مزایدە", noBids: "هێشتا مزایدە نییە", myBidsTitle: "هەموو مزایدەکانت لێرەیە", noMyBids: "هێشتا بەشداریت لە هیچ مزایدەیەکدا نەکردووە", discover: "مزایدەکان ببینە و یەکەم مزایدەت بکە", signIn: "چوونەژوورەوە", signUp: "دروستکردنی هەژمار", signInHint: "بچۆ ژوورەوە یان هەژمارێک دروست بکە بۆ دەستپێکردنی مزایدە.", signInToBid: "بچۆ ژوورەوە بۆ مزایدەکردن", signOut: "چوونەدەرەوە", language: "زمان", currency: "پیشاندانی دراو", admin: "بەڕێوەبەر", adminArea: "بەڕێوەبردنی هەژمار", adminCount: "هەژماری بەڕێوەبەر", status: "دۆخ", active: "کراوە", ended: "تەواوبوو", winning: "مزایدەکەت پێشەنگە", outbid: "مزایدەیەکی بەرزتر هەیە", close: "داخستن", loading: "تکایە چاوەڕێ بکە…", retry: "دووبارە هەوڵبدە", failed: "داواکارییەکە تەواو نەبوو", successBid: "مزایدەکەت تۆمارکرا", name: "TopBid", searchResults: "ئەنجامی گەڕان", noResults: "هیچ کاڵایەکی گونجاو نەدۆزرایەوە", user: "بەکارهێنەر", manageRole: "گۆڕینی دەسەڵات", makeAdmin: "کردن بە بەڕێوەبەر", makeUser: "لابردنی دەسەڵاتی بەڕێوەبەر", adminSafety: "دەبێت لانیکەم دوو هەژماری بەڕێوەبەر بمێنێتەوە.", approximate: "نزیکەیی", sortEnding: "نزیکە لە کۆتایی", currencyIQD: "د.ع", currencyUSD: "دۆلار", profile: "پرۆفایل", accountNeeded: "هەژمارێک دروست بکە بۆ چاودێریکردنی مزایدەکانت", bidAmount: "بڕی مزایدە", increment: "کەمترین زیادکردن", notConfigured: "گۆڕینی دراوەکان نزیکەییە و لەوانەیە لە نرخی بازاڕی ئێستا جیاواز بێت.", featured: "هەڵبژاردەکانی TopBid", welcome: "کاڵایەکی تایبەت چاوەڕوانی مزایدەکەتە", browseHint: "ئەلیکترۆنیات و کاڵای ماڵەوە — مزایدەی ڕوونتر.", remaining: "ماوە", minBidError: "بڕەکە بەرز بکەوە بۆ کەمترین ڕێژەی پێویست.", roleUpdated: "دەسەڵات نوێکرایەوە", noAdminPermission: "ئەم بەشە تەنها بۆ بەڕێوەبەرانە.", bidsFor: "مزایدەکەت", languageArabic: "العربية", languageEnglish: "English", languageKurdish: "کوردی",
  },
} as const;

const STORAGE_KEY = "mizadna-language";
const LanguageContext = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>("ar");
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "ar" || saved === "en" || saved === "ku") setLanguageState(saved);
    }).catch(() => undefined);
  }, []);
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  };
  const value = useMemo<LanguageState>(() => ({
    language,
    setLanguage,
    isRTL: language !== "en",
    t: (key) => copy[language][key] ?? copy.ar[key],
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
