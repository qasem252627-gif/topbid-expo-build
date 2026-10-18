import type { Language } from "./i18n";

type AccountPagesCopy = {
  back: string;
  adminOnly: string;
  usersTitle: string;
  usersIntro: string;
  usersLink: string;
  totalUsers: string;
  admins: string;
  verifiedPhones: string;
  withAddress: string;
  searchUsers: string;
  noUsersMatch: string;
  joined: string;
  winnersTitle: string;
  winnersLink: string;
  winnersCount: string;
  governorate: string;
  addressTitle: string;
  addressLink: string;
  addressIntro: string;
  chooseGovernorate: string;
  governorateRequired: string;
  addressDetails: string;
  addressDetailsPlaceholder: string;
  addressSaved: string;
  addressFailed: string;
  saveAddress: string;
  clearSelection: string;
  noAddress: string;
  signInFirst: string;
  deliveryTitle: string;
  deliveryField: string;
  deliveryCurrency: string;
  deliveryHint: string;
  deliveryInvalid: string;
  deliverySaved: string;
  deliveryFailed: string;
  saveDelivery: string;
  freeDelivery: string;
  currentDelivery: string;
};

export const accountPagesCopy: Record<Language, AccountPagesCopy> = {
  ar: {
    back: "رجوع",
    adminOnly: "هذه الصفحة متاحة لحسابات الإدارة فقط.",
    usersTitle: "حسابات المستخدمين",
    usersIntro: "كل الحسابات المسجلة مع بيانات الاتصال، وتظهر للإدارة فقط.",
    usersLink: "حسابات المستخدمين",
    totalUsers: "إجمالي المستخدمين",
    admins: "المشرفون",
    verifiedPhones: "أرقام موثقة",
    withAddress: "لديهم عنوان",
    searchUsers: "ابحث بالاسم أو البريد أو الهاتف أو المحافظة",
    noUsersMatch: "لا توجد حسابات مطابقة للبحث.",
    joined: "تاريخ التسجيل",
    winnersTitle: "الفائزون بالمزادات",
    winnersLink: "الفائزون بالمزادات",
    winnersCount: "عدد الفائزين",
    governorate: "المحافظة",
    addressTitle: "عنوان التوصيل",
    addressLink: "عنوان التوصيل",
    addressIntro: "اختر محافظتك واكتب تفاصيل العنوان. يظهر العنوان للإدارة فقط لترتيب التوصيل.",
    chooseGovernorate: "اختر المحافظة",
    governorateRequired: "اختر المحافظة قبل حفظ تفاصيل العنوان.",
    addressDetails: "تفاصيل العنوان",
    addressDetailsPlaceholder: "المنطقة، الحي، الشارع، أقرب نقطة دالة",
    addressSaved: "تم حفظ العنوان.",
    addressFailed: "تعذّر حفظ العنوان. حاول مرة أخرى.",
    saveAddress: "حفظ العنوان",
    clearSelection: "مسح المحافظة",
    noAddress: "لم يُضف عنوان بعد",
    signInFirst: "سجّل الدخول لإضافة عنوان التوصيل.",
    deliveryTitle: "رسوم التوصيل",
    deliveryField: "مبلغ رسوم التوصيل",
    deliveryCurrency: "عملة الرسوم",
    deliveryHint: "تظهر القيمة الجديدة لجميع المستخدمين في صفحة المزاد ونافذة تأكيد المزايدة. اكتب 0 للتوصيل المجاني.",
    deliveryInvalid: "أدخل مبلغًا صحيحًا: الدولار حتى منزلتين عشريتين وبحد 1,000، والدينار عدد صحيح حتى 1,000,000.",
    deliverySaved: "تم تحديث رسوم التوصيل.",
    deliveryFailed: "تعذّر تحديث رسوم التوصيل.",
    saveDelivery: "حفظ الرسوم",
    freeDelivery: "توصيل مجاني",
    currentDelivery: "الرسوم الحالية",
  },
  en: {
    back: "Back",
    adminOnly: "This page is available to administrator accounts only.",
    usersTitle: "User accounts",
    usersIntro: "All registered accounts with contact details, visible to administrators only.",
    usersLink: "User accounts",
    totalUsers: "Total users",
    admins: "Admins",
    verifiedPhones: "Verified phones",
    withAddress: "With address",
    searchUsers: "Search by name, email, phone or governorate",
    noUsersMatch: "No accounts match your search.",
    joined: "Joined",
    winnersTitle: "Auction winners",
    winnersLink: "Auction winners",
    winnersCount: "Winners",
    governorate: "Governorate",
    addressTitle: "Delivery address",
    addressLink: "Delivery address",
    addressIntro: "Choose your governorate and add address details. Only administrators can see it to arrange delivery.",
    chooseGovernorate: "Choose governorate",
    governorateRequired: "Choose a governorate before saving address details.",
    addressDetails: "Address details",
    addressDetailsPlaceholder: "Area, neighbourhood, street, nearest landmark",
    addressSaved: "Address saved.",
    addressFailed: "Could not save the address. Please try again.",
    saveAddress: "Save address",
    clearSelection: "Clear governorate",
    noAddress: "No address added yet",
    signInFirst: "Sign in to add a delivery address.",
    deliveryTitle: "Delivery fee",
    deliveryField: "Delivery fee amount",
    deliveryCurrency: "Fee currency",
    deliveryHint: "The new value is shown to all users on the auction page and in the bid confirmation. Enter 0 for free delivery.",
    deliveryInvalid: "Enter a valid amount: USD up to two decimals and 1,000 maximum; IQD whole numbers up to 1,000,000.",
    deliverySaved: "Delivery fee updated.",
    deliveryFailed: "Could not update the delivery fee.",
    saveDelivery: "Save fee",
    freeDelivery: "Free delivery",
    currentDelivery: "Current fee",
  },
  ku: {
    back: "گەڕانەوە",
    adminOnly: "ئەم پەڕەیە تەنها بۆ هەژمارەکانی بەڕێوەبەرایەتییە.",
    usersTitle: "هەژمارەکانی بەکارهێنەران",
    usersIntro: "هەموو هەژمارە تۆمارکراوەکان لەگەڵ زانیاری پەیوەندی، تەنها بۆ بەڕێوەبەران دیارە.",
    usersLink: "هەژمارەکانی بەکارهێنەران",
    totalUsers: "کۆی بەکارهێنەران",
    admins: "بەڕێوەبەران",
    verifiedPhones: "ژمارەی پشتڕاستکراوە",
    withAddress: "ناونیشانیان هەیە",
    searchUsers: "بگەڕێ بە ناو، ئیمەیڵ، مۆبایل یان پارێزگا",
    noUsersMatch: "هیچ هەژمارێک لەگەڵ گەڕانەکەت ناگونجێت.",
    joined: "بەرواری تۆمارکردن",
    winnersTitle: "براوەکانی مەزاد",
    winnersLink: "براوەکانی مەزاد",
    winnersCount: "ژمارەی براوەکان",
    governorate: "پارێزگا",
    addressTitle: "ناونیشانی گەیاندن",
    addressLink: "ناونیشانی گەیاندن",
    addressIntro: "پارێزگاکەت هەڵبژێرە و وردەکاری ناونیشان بنووسە. تەنها بەڕێوەبەران دەیبینن بۆ ڕێکخستنی گەیاندن.",
    chooseGovernorate: "پارێزگا هەڵبژێرە",
    governorateRequired: "پێش پاشەکەوتکردنی وردەکاری ناونیشان پارێزگا هەڵبژێرە.",
    addressDetails: "وردەکاری ناونیشان",
    addressDetailsPlaceholder: "ناوچە، گەڕەک، شەقام، نزیکترین شوێنی دیار",
    addressSaved: "ناونیشان پاشەکەوت کرا.",
    addressFailed: "پاشەکەوتکردنی ناونیشان سەرکەوتوو نەبوو. دووبارە هەوڵ بدەرەوە.",
    saveAddress: "پاشەکەوتکردنی ناونیشان",
    clearSelection: "سڕینەوەی پارێزگا",
    noAddress: "هێشتا ناونیشان زیاد نەکراوە",
    signInFirst: "بچۆ ژوورەوە بۆ زیادکردنی ناونیشانی گەیاندن.",
    deliveryTitle: "کرێی گەیاندن",
    deliveryField: "بڕی کرێی گەیاندن",
    deliveryCurrency: "دراوی کرێ",
    deliveryHint: "نرخە نوێیەکە بۆ هەموو بەکارهێنەران لە پەڕەی مەزاد و پشتڕاستکردنەوەی مەزاددا دیار دەبێت. 0 بنووسە بۆ گەیاندنی بێبەرامبەر.",
    deliveryInvalid: "بڕێکی دروست بنووسە: دۆلار تا دوو ژمارەی دەیی و زۆرترین 1,000؛ دینار ژمارەی تەواو تا 1,000,000.",
    deliverySaved: "کرێی گەیاندن نوێ کرایەوە.",
    deliveryFailed: "نوێکردنەوەی کرێی گەیاندن سەرکەوتوو نەبوو.",
    saveDelivery: "پاشەکەوتکردنی کرێ",
    freeDelivery: "گەیاندنی بێبەرامبەر",
    currentDelivery: "کرێی ئێستا",
  },
};
