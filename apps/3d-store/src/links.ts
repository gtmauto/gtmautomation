import type { Product, StoreInfo, CartItem } from './types';
import { bn, bnNumber } from './i18n/bn';

/** m.me/<page>?ref=s_<tenantId>__<sku> — the bot reads ref, knows the shop (tenant) and the product (store-ref-1). */
export function messengerUrl(store: StoreInfo, ref: string): string {
  const tenant = (store.tenantId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const full = tenant ? `s_${tenant}__${ref}` : ref;
  const safeRef = full.replace(/[^A-Za-z0-9_\-.:]/g, '_').slice(0, 250);
  return `https://m.me/${encodeURIComponent(store.messengerPage)}?ref=${encodeURIComponent(safeRef)}`;
}

/** wa.me/<number>?text=<prefilled Bangla order text + "শপ কোড: <tenantId>" so the bot knows which shop's SKUs these are> */
export function whatsappUrl(store: StoreInfo, text: string): string {
  const num = store.whatsappNumber === 'REPLACE_ME' ? 'REPLACE_ME' : store.whatsappNumber.replace(/\D/g, '');
  const tenant = (store.tenantId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const full = tenant ? `${text}\n${bn.shopCode}: ${tenant}` : text;
  return `https://wa.me/${num}?text=${encodeURIComponent(full)}`;
}

export function productOrderText(p: Product, size?: string, qty = 1): string {
  const lines: string[] = [bn.orderTextIntro, `• ${p.name} (${p.sku}) — ৳${bnNumber(p.price)}`];
  if (size) lines.push(`${bn.orderTextSize}: ${size}`);
  lines.push(`${bn.orderTextQty}: ${bnNumber(qty)}`);
  lines.push(bn.orderTextOutro);
  return lines.join('\n');
}

export function cartOrderText(items: CartItem[], products: Map<string, Product>): string {
  const lines: string[] = [bn.orderTextIntro];
  let total = 0;
  for (const it of items) {
    const p = products.get(it.sku);
    if (!p) continue;
    total += p.price * it.qty;
    lines.push(
      `• ${p.name} (${p.sku})${it.size ? ` — ${bn.orderTextSize} ${it.size}` : ''} × ${bnNumber(it.qty)} = ৳${bnNumber(p.price * it.qty)}`,
    );
  }
  lines.push(`${bn.total}: ৳${bnNumber(total)}`);
  lines.push(bn.orderTextOutro);
  return lines.join('\n');
}

/** Sizes like "M" / "42" fit in an m.me ref; Bangla sizes ("ফ্রি সাইজ") are left out of the ref (they stay in the WhatsApp text). */
export function refSize(size?: string): string {
  return size && /^[A-Za-z0-9]{1,8}$/.test(size) ? size : '';
}

/** <sku> or <sku>-<size>, e.g. PJ-003-XL */
export function productRef(sku: string, size?: string): string {
  const s = refSize(size);
  return s ? `${sku}-${s}` : sku;
}

/** CART_PJ-001x1_SR-002x2 (m.me ref allows only a small character set) */
export function cartRef(items: CartItem[]): string {
  return 'CART_' + items.map((i) => `${i.sku}x${i.qty}${refSize(i.size) ? '-' + refSize(i.size) : ''}`).join('_');
}
