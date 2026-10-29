import type { Product, StoreInfo, CartItem } from './types';
import { bn, bnNumber } from './i18n/bn';

/** m.me/<page>?ref=<sku> — the bot reads ref and knows the product. */
export function messengerUrl(store: StoreInfo, ref: string): string {
  const safeRef = ref.replace(/[^A-Za-z0-9_\-.:]/g, '_').slice(0, 250);
  return `https://m.me/${encodeURIComponent(store.messengerPage)}?ref=${encodeURIComponent(safeRef)}`;
}

/** wa.me/<number>?text=<prefilled Bangla order text> */
export function whatsappUrl(store: StoreInfo, text: string): string {
  const num = store.whatsappNumber === 'REPLACE_ME' ? 'REPLACE_ME' : store.whatsappNumber.replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
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

/** CART_PJ-001x1_SR-002x2 (m.me ref allows only a small character set) */
export function cartRef(items: CartItem[]): string {
  return 'CART_' + items.map((i) => `${i.sku}x${i.qty}${i.size ? '-' + i.size.replace(/[^A-Za-z0-9]/g, '') : ''}`).join('_');
}
