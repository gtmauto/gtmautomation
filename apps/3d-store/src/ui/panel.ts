import type { Product, StoreData } from '../types';
import { bn, bnNumber, bnPrice } from '../i18n/bn';
import { messengerUrl, productOrderText, productRef, whatsappUrl } from '../links';
import { track } from '../analytics';
import type { Cart } from './cart';

export interface Panel {
  open(sku: string, opts?: { strip?: boolean }): void;
  close(): void;
  readonly isOpen: boolean;
  readonly currentSku: string | null;
}

export interface PanelOptions {
  data: StoreData;
  panel: HTMLElement;
  strip: HTMLElement;
  cart: Cart;
  /** user picked another product from the thumbnail strip */
  onSwap: (sku: string) => void;
  onClose: () => void;
}

export function createPanel(o: PanelOptions): Panel {
  const { data, panel, strip } = o;
  const products = new Map(data.products.map((p) => [p.sku, p]));
  const sectionLabel = new Map(data.sections.map((s) => [s.id, s.label]));
  let current: string | null = null;
  let lastFocus: HTMLElement | null = null;
  let selectedSize: string | undefined;

  const badges = (p: Product): string => {
    const out: string[] = [];
    if (p.badge) out.push(`<span class="badge accent">${p.badge}</span>`);
    if (typeof p.viewsToday === 'number' && p.viewsToday > 0) out.push(`<span class="badge soft">${bn.viewsToday(bnNumber(p.viewsToday))}</span>`);
    return out.join('');
  };
  const stockLine = (p: Product): string => {
    if (p.stock <= 0) return `<span class="stock out">${bn.outOfStock}</span>`;
    if (p.stock <= 3) return `<span class="stock low">${bn.lowStock(bnNumber(p.stock))}</span>`;
    return `<span class="stock ok">${bn.inStock(bnNumber(p.stock))}</span>`;
  };

  const renderStrip = (p: Product) => {
    strip.innerHTML = '';
    const list = data.products.filter((x) => x.section === p.section);
    for (const x of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'thumb' + (x.sku === p.sku ? ' active' : '');
      b.setAttribute('aria-label', `${x.name}, ${bnPrice(x.price)}`);
      b.setAttribute('aria-current', x.sku === p.sku ? 'true' : 'false');
      b.innerHTML = `<img src="${x.image}" alt="" width="56" height="56" loading="lazy" />`;
      b.addEventListener('click', () => {
        if (x.sku === p.sku) return;
        render(x);
        o.onSwap(x.sku);
      });
      strip.appendChild(b);
    }
  };

  const render = (p: Product) => {
    current = p.sku;
    selectedSize = p.sizes.length === 1 ? p.sizes[0] : undefined;
    track({ event: 'product_focus', sku: p.sku, section: p.section });
    panel.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'panel-head';
    head.innerHTML = `<span class="crumb">${sectionLabel.get(p.section) ?? ''}</span>`;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'icon-btn';
    x.setAttribute('aria-label', bn.close);
    x.textContent = '✕';
    x.addEventListener('click', close);
    head.appendChild(x);

    const img = document.createElement('div');
    img.className = 'panel-img';
    img.innerHTML = `<img src="${p.image}" alt="${p.name}" width="512" height="512" />${p.badge ? `<span class="badge accent float">${p.badge}</span>` : ''}`;

    const body = document.createElement('div');
    body.className = 'panel-body';
    body.innerHTML = `
      <h2 id="panelTitle">${p.name}</h2>
      <div class="price">${bnPrice(p.price)}</div>
      <div class="badges">${badges(p)}</div>
      <div class="sizes" role="group" aria-label="${bn.sizes}"><span class="lbl">${bn.sizes}:</span></div>
      <div class="stockline">${stockLine(p)}</div>`;
    const sizes = body.querySelector('.sizes') as HTMLElement;
    for (const s of p.sizes) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'size' + (s === selectedSize ? ' on' : '');
      chip.textContent = s;
      chip.setAttribute('aria-pressed', s === selectedSize ? 'true' : 'false');
      chip.addEventListener('click', () => {
        selectedSize = s;
        sizes.querySelectorAll('.size').forEach((c) => {
          c.classList.toggle('on', c === chip);
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        refreshLinks();
      });
      sizes.appendChild(chip);
    }

    const ctas = document.createElement('div');
    ctas.className = 'ctas';
    const m = document.createElement('a');
    m.className = 'btn primary';
    m.target = '_blank';
    m.rel = 'noopener';
    m.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12 2C6.5 2 2 6.1 2 11.3c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.5 0 10-4.1 10-9.3S17.5 2 12 2zm1 12.5-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.4 5.8z"/></svg>${bn.orderMessenger}`;
    m.addEventListener('click', () => track({ event: 'cta_click', sku: p.sku, section: p.section, channel: 'messenger' }));
    const w = document.createElement('a');
    w.className = 'btn secondary';
    w.target = '_blank';
    w.rel = 'noopener';
    w.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.9 2.9 4.6 4 1.7.7 2.3.8 3.1.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.1z"/></svg>${bn.orderWhatsapp}`;
    w.addEventListener('click', () => track({ event: 'cta_click', sku: p.sku, section: p.section, channel: 'whatsapp' }));
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'btn tertiary';
    c.textContent = bn.addToCart;
    c.disabled = p.stock <= 0;
    c.addEventListener('click', () => o.cart.add(p.sku, selectedSize));
    ctas.append(m, w, c);

    const refreshLinks = () => {
      m.href = messengerUrl(data.store, productRef(p.sku, selectedSize));
      w.href = whatsappUrl(data.store, productOrderText(p, selectedSize));
    };
    refreshLinks();

    panel.append(head, img, body, ctas);
  };

  function open(sku: string, opts?: { strip?: boolean }) {
    const p = products.get(sku);
    if (!p) return;
    if (!current) lastFocus = document.activeElement as HTMLElement | null;
    render(p);
    panel.hidden = false;
    if (opts?.strip !== false) {
      renderStrip(p);
      strip.hidden = false;
    } else strip.hidden = true;
    document.body.classList.add('focus-mode');
    (panel.querySelector('.icon-btn') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }
  function close() {
    if (!current) return;
    current = null;
    panel.hidden = true;
    strip.hidden = true;
    document.body.classList.remove('focus-mode');
    lastFocus?.focus?.({ preventScroll: true });
    lastFocus = null;
    o.onClose();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) close();
  });

  return {
    open,
    close,
    get isOpen() {
      return current !== null;
    },
    get currentSku() {
      return current;
    },
  };
}
