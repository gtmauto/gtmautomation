import type { Product, StoreData } from '../types';
import { bn, bnNumber, bnPrice } from '../i18n/bn';
import { messengerUrl, productOrderText, whatsappUrl } from '../links';
import { track } from '../analytics';
import type { Cart } from './cart';

export interface FallbackOptions {
  data: StoreData;
  root: HTMLElement;
  cart: Cart;
  onOpen: (sku: string) => void;
  note?: string;
}

/** Plain, fast 2D grid of the same products with the same CTAs ("সাধারণ view"). */
export function renderFallback(o: FallbackOptions): void {
  const { data, root } = o;
  root.innerHTML = '';
  if (o.note) {
    const n = document.createElement('p');
    n.className = 'fb-note';
    n.textContent = o.note;
    root.appendChild(n);
  }
  for (const sec of data.sections) {
    const h = document.createElement('h2');
    h.className = 'fb-h';
    h.id = `sec-${sec.id}`;
    h.textContent = sec.label;
    root.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'fb-grid';
    for (const p of data.products.filter((x) => x.section === sec.id)) grid.appendChild(card(p));
    root.appendChild(grid);
  }
  const foot = document.createElement('p');
  foot.className = 'fb-foot';
  foot.textContent = data.store.tagline;
  root.appendChild(foot);

  function card(p: Product): HTMLElement {
    const el = document.createElement('article');
    el.className = 'fb-card';
    const stock =
      p.stock <= 0 ? `<span class="stock out">${bn.outOfStock}</span>` : p.stock <= 3 ? `<span class="stock low">${bn.lowStock(bnNumber(p.stock))}</span>` : '';
    el.innerHTML = `
      <button type="button" class="fb-img" aria-label="${p.name}, ${bnPrice(p.price)}">
        <img src="${p.image}" alt="" width="256" height="256" loading="lazy" decoding="async" />
        ${p.badge ? `<span class="badge accent float">${p.badge}</span>` : ''}
      </button>
      <div class="fb-body">
        <h3>${p.name}</h3>
        <div class="price">${bnPrice(p.price)}</div>
        <div class="fb-meta">${stock}${typeof p.viewsToday === 'number' ? `<span class="badge soft">${bn.viewsToday(bnNumber(p.viewsToday))}</span>` : ''}</div>
      </div>`;
    (el.querySelector('.fb-img') as HTMLButtonElement).addEventListener('click', () => o.onOpen(p.sku));
    const ctas = document.createElement('div');
    ctas.className = 'fb-ctas';
    const m = document.createElement('a');
    m.className = 'btn primary sm';
    m.href = messengerUrl(data.store, p.sku);
    m.target = '_blank';
    m.rel = 'noopener';
    m.textContent = 'Messenger';
    m.setAttribute('aria-label', `${p.name} — ${bn.orderMessenger}`);
    m.addEventListener('click', () => track({ event: 'cta_click', sku: p.sku, section: p.section, channel: 'messenger' }));
    const w = document.createElement('a');
    w.className = 'btn secondary sm';
    w.href = whatsappUrl(data.store, productOrderText(p));
    w.target = '_blank';
    w.rel = 'noopener';
    w.textContent = 'WhatsApp';
    w.setAttribute('aria-label', `${p.name} — ${bn.orderWhatsapp}`);
    w.addEventListener('click', () => track({ event: 'cta_click', sku: p.sku, section: p.section, channel: 'whatsapp' }));
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'btn tertiary sm';
    c.textContent = bn.addToCart;
    c.disabled = p.stock <= 0;
    c.setAttribute('aria-label', `${p.name} — ${bn.addToCart}`);
    c.addEventListener('click', () => o.cart.add(p.sku, p.sizes.length === 1 ? p.sizes[0] : undefined));
    ctas.append(m, w, c);
    el.appendChild(ctas);
    return el;
  }
}
