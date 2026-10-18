import type { Language } from "./i18n";

export const notificationCopy: Record<Language, {
  activity: string;
  byYou: string;
  byAccount: string;
  enableTitle: string;
  enableBody: string;
  enableButton: string;
  enabled: string;
  denied: string;
  failed: string;
  openSettings: string;
  newBidAlert: string;
}> = {
  ar: {
    activity: "أحدث زيادة", byYou: "أنت", byAccount: "صاحب الحساب",
    enableTitle: "فعّل تنبيهات المزايدة", enableBody: "سننبهك عند ارتفاع المزايدة على منتج شاركت فيه، مع اسم صاحب العرض الجديد.",
    enableButton: "تفعيل التنبيهات", enabled: "تنبيهات المزايدة مفعّلة على هذا الجهاز.",
    denied: "إذن الإشعارات مرفوض. فعّلها من إعدادات الجهاز.", failed: "تعذّر إعداد التنبيهات. حاول مرة أخرى.", openSettings: "إعدادات الإشعارات",
    newBidAlert: "مزايدة جديدة من {bidder} على {product}: {amount}",
  },
  en: {
    activity: "Latest bid", byYou: "You", byAccount: "Account holder",
    enableTitle: "Turn on bid alerts", enableBody: "We'll alert you when a product you've bid on gets a higher bid, and show who placed it.",
    enableButton: "Enable alerts", enabled: "Bid alerts are enabled on this device.",
    denied: "Notification permission is denied. Enable it in your device settings.", failed: "Could not set up alerts. Please try again.", openSettings: "Notification settings",
    newBidAlert: "New bid from {bidder} on {product}: {amount}",
  },
  ku: {
    activity: "دوایین زیادکردنی نرخ", byYou: "تۆ", byAccount: "خاوەنی هەژمار",
    enableTitle: "ئاگادارکردنەوەی مزایدە چالاک بکە", enableBody: "کاتێک نرخ لەسەر کاڵایەک کە بەشداریی تێدا کردووە بەرز بێتەوە، ئاگادارت دەکەینەوە و ناوی مزایدەکارەکە پیشان دەدەین.",
    enableButton: "چالاککردنی ئاگادارکردنەوە", enabled: "ئاگادارکردنەوەی مزایدە لەم ئامێرەدا چالاکە.",
    denied: "ڕێگەی ئاگادارکردنەوە ڕەتکراوەتەوە. لە ڕێکخستنەکانی ئامێرەکەت چالاکی بکە.", failed: "ئامادەکردنی ئاگادارکردنەوە سەرکەوتوو نەبوو. دووبارە هەوڵبدە.", openSettings: "ڕێکخستنی ئاگادارکردنەوە",
    newBidAlert: "مزایدەیەکی نوێ لەلایەن {bidder} لەسەر {product}: {amount}",
  },
};
