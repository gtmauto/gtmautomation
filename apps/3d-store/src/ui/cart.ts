import type { CartItem, Product, StoreData } from '../types';
import { bn, bnNumber, bnPrice } from '../i18n/bn';
import { cartOrderText, cartRef, messengerUrl, whatsappUrl } from '../links';
import { track } from '../analytics';

export interface Cart {
  add(sku: string, size?: string): void;
  count(): number;
  open(): void;
  close(): void;
}

export function createCart(
  data: StoreData,
  els: { btn: HTMLButtonElement; count: HTMLElement; sheet: HTMLElement; scrim: HTMLElement },
  toast: (msg: string) => void,
): Cart {
  const key = `gb_cart_${data.store.id}`;
  const products = new Map(data.products.map((p) => [p.sku, p]));
  let items: CartItem[] = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) items = (JSON.parse(raw) as CartItem[]).filter((i) => products.has(i.sku));
  } catch {
    /* private mode etc. */
  }
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  };
  const total = () => items.reduce((s, i) => s + (products.get(i.sku)?.price ?? 0) * i.qty, 0);
  const updateBadge = () => {
    const n = items.reduce((s, i) => s + i.qty, 0);
    els.count.textContent = bnNumber(n);
    els.count.hidden = n === 0;
    els.btn.setAttribute('aria-label', n ? `${bn.cart}, ${bnNumber(n)}টা` : bn.cart);
  };

  const render = () => {
    const sheet = els.sheet;
    sheet.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'sheet-head';
    head.innerHTML = `<h2 id="cartTitle">${bn.cartTitle}</h2>`;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'icon-btn';
    x.setAttribute('aria-label', bn.close);
    x.textContent = '✕';
    x.addEventListener('click', close);
    head.appendChild(x);
    sheet.appendChild(head);

    if (items.length === 0) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = bn.cartEmpty;
      sheet.appendChild(p);
      return;
    }
    const list = document.createElement('ul');
    list.className = 'cart-list';
    for (const it of items) {
      const p = products.get(it.sku) as Product;
      const li = document.createElement('li');
      li.innerHTML = `<img src="${p.image}" alt="" width="48" height="48" loading="lazy" />
        <div class="cl-body"><div class="cl-name">${p.name}</div>
        <div class="cl-meta">${it.size ? `${bn.sizes}: ${it.size} · ` : ''}${bnNumber(it.qty)} × ${bnPrice(p.price)}</div></div>`;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'link-btn';
      rm.textContent = bn.remove;
      rm.setAttribute('aria-label', `${p.name} ${bn.remove}`);
      rm.addEventListener('click', () => {
        items = items.filter((x) => x !== it);
        save();
        updateBadge();
        render();
      });
      li.appendChild(rm);
      list.appendChild(li);
    }
    sheet.appendChild(list);
    const tot = document.createElement('div');
    tot.className = 'cart-total';
    tot.innerHTML = `<span>${bn.total}</span><strong>${bnPrice(total())}</strong>`;
    sheet.appendChild(tot);

    const ctas = document.createElement('div');
    ctas.className = 'ctas';
    const skus = items.map((i) => i.sku);
    const m = document.createElement('a');
    m.className = 'btn primary';
    m.href = messengerUrl(data.store, cartRef(items));
    m.target = '_blank';
    m.rel = 'noopener';
    m.textContent = `${bn.orderNow} · Messenger`;
    m.addEventListener('click', () => track({ event: 'cta_click', skus, channel: 'messenger' }));
    const w = document.createElement('a');
    w.className = 'btn secondary';
    w.href = whatsappUrl(data.store, cartOrderText(items, products));
    w.target = '_blank';
    w.rel = 'noopener';
    w.textContent = `${bn.orderNow} · WhatsApp`;
    w.addEventListener('click', () => track({ event: 'cta_click', skus, channel: 'whatsapp' }));
    ctas.append(m, w);
    sheet.appendChild(ctas);
  };

  function open() {
    render();
    els.sheet.hidden = false;
    els.scrim.hidden = false;
    els.btn.setAttribute('aria-expanded', 'true');
    (els.sheet.querySelector('button') as HTMLButtonElement | null)?.focus();
  }
  function close() {
    els.sheet.hidden = true;
    els.scrim.hidden = true;
    els.btn.setAttribute('aria-expanded', 'false');
    els.btn.focus();
  }
  els.btn.addEventListener('click', () => (els.sheet.hidden ? open() : close()));
  els.scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.sheet.hidden) close();
  });
  updateBadge();

  return {
    add(sku, size) {
      const p = products.get(sku);
      if (!p) return;
      const existing = items.find((i) => i.sku === sku && i.size === size);
      if (existing) existing.qty += 1;
      else items.push({ sku, qty: 1, size });
      save();
      updateBadge();
      track({ event: 'cart_add', sku, section: p.section });
      toast(bn.added);
    },
    count: () => items.reduce((s, i) => s + i.qty, 0),
    open,
    close,
  };
}
