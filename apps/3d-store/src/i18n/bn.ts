/** All UI strings in Bangla. English words that are the normal word in Bangladesh stay English. */
export const bn = {
  loading: 'শপ খুলছে…',
  loadingHint: 'একটু অপেক্ষা করুন',
  storePill: 'Store',
  simpleView: 'সাধারণ view',
  view3d: '3D view',
  cart: 'ব্যাগ',
  cartEmpty: 'ব্যাগ খালি',
  cartTitle: 'আপনার ব্যাগ',
  orderNow: 'অর্ডার করুন',
  orderMessenger: 'Messenger-এ অর্ডার করুন',
  orderWhatsapp: 'WhatsApp-এ অর্ডার করুন',
  addToCart: 'ব্যাগে রাখুন',
  added: 'ব্যাগে রাখা হয়েছে',
  remove: 'বাদ দিন',
  close: 'বন্ধ করুন',
  sizes: 'সাইজ',
  stock: 'স্টক',
  inStock: (n: string) => `স্টকে আছে ${n}টা`,
  lowStock: (n: string) => `মাত্র ${n}টা বাকি`,
  outOfStock: 'স্টক শেষ',
  viewsToday: (n: string) => `আজ ${n} জন দেখেছে`,
  coach1: 'আঙুল দিয়ে ঘুরে দেখুন',
  coach2: 'product-এ ট্যাপ করুন',
  coachOk: 'বুঝেছি',
  productsIn: (label: string) => `${label} — সব product`,
  fallbackAuto: 'আপনার ফোনের জন্য সহজ view দেখানো হচ্ছে',
  fallbackNote: '3D view চালু করতে উপরে ট্যাপ করুন',
  noWebgl: 'এই ফোনে 3D চলে না, তাই সাধারণ view',
  total: 'মোট',
  taka: '৳',
  skipTo: 'product list-এ যান',
  lookAround: 'শপের ভেতরে ঘুরে দেখার জায়গা',
  thumbs: 'এই section-এর অন্য product',
  sectionNav: 'শপের section',
  topbar: 'উপরের বার',
  orderTextIntro: 'আসসালামু আলাইকুম, আমি অর্ডার করতে চাই:',
  orderTextSize: 'সাইজ',
  orderTextQty: 'পরিমাণ',
  orderTextOutro: 'ক্যাশ অন ডেলিভারি হবে?',
  shopCode: 'শপ কোড',
} as const;

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** 1450 → "১,৪৫০" */
export function bnNumber(n: number): string {
  const s = Math.round(n).toLocaleString('en-US');
  return s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

/** 1450 → "৳ ১,৪৫০" */
export function bnPrice(n: number): string {
  return `${bn.taka} ${bnNumber(n)}`;
}
