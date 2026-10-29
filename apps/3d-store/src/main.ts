import './style.css';
import storeJson from './data/store.json';
import type { StoreData } from './types';
import { bn } from './i18n/bn';
import { track } from './analytics';
import { createCart } from './ui/cart';
import { createPanel } from './ui/panel';
import { createPills } from './ui/pills';
import { renderFallback } from './ui/fallback';
import { createCoach } from './ui/coach';
import type { Store3D } from './scene/store3d';

const data = storeJson as StoreData;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const loader = $('loader');
const loaderBar = $('loaderBar');
const canvas = $<HTMLCanvasElement>('scene');
const fallbackRoot = $('fallback');
const pillsNav = $('pills');
const panelEl = $('panel');
const stripEl = $('strip');
const toastEl = $('toast');
const viewToggle = $<HTMLButtonElement>('viewToggle');

// ---- feature detection -------------------------------------------------------------
type FallbackReason = 'query' | 'no_webgl' | 'low_memory' | 'reduced_motion' | 'toggle' | 'error';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
function autoFallbackReason(): FallbackReason | null {
  const q = new URLSearchParams(location.search).get('view');
  if (q === '2d') return 'query';
  if (!hasWebGL()) return 'no_webgl';
  if (q === '3d') return null;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === 'number' && mem < 2) return 'low_memory';
  if (reducedMotion) return 'reduced_motion';
  return null;
}
const webglOk = hasWebGL();

// ---- shared UI ---------------------------------------------------------------------
let toastT = 0;
const toast = (msg: string) => {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastT);
  toastT = window.setTimeout(() => (toastEl.hidden = true), 1800);
};

const cart = createCart(data, { btn: $('cartBtn'), count: $('cartCount'), sheet: $('cartSheet'), scrim: $('scrim') }, toast);

let store3d: Store3D | null = null;
let mode: '3d' | '2d' = '3d';
let activeSection = 'store';

const panel = createPanel({
  data,
  panel: panelEl,
  strip: stripEl,
  cart,
  onSwap: (sku) => {
    if (mode === '3d') void store3d?.focusProduct(sku);
  },
  onClose: () => {
    if (mode === '3d') void store3d?.goToSection(activeSection);
  },
});

const pills = createPills(pillsNav, data, (id) => {
  panel.close();
  activeSection = id;
  pills.setActive(id);
  track({ event: 'section_view', section: id });
  void store3d?.goToSection(id);
});

const coach = createCoach($('coach'), $<HTMLButtonElement>('coachOk'), canvas);

const setProgress = (f: number) => {
  loaderBar.style.width = `${Math.round(Math.min(1, f) * 100)}%`;
};
const hideLoader = () => {
  loader.classList.add('hide');
  setTimeout(() => loader.remove(), 500);
};

// ---- mode switching ----------------------------------------------------------------
function showFallback(reason: FallbackReason) {
  mode = '2d';
  panel.close();
  coach.dismiss();
  store3d?.setActive(false);
  canvas.hidden = true;
  pills.show(false);
  document.body.classList.add('mode-2d');
  const note = reason === 'no_webgl' ? bn.noWebgl : reason === 'low_memory' || reason === 'reduced_motion' ? bn.fallbackAuto : undefined;
  renderFallback({ data, root: fallbackRoot, cart, note, onOpen: (sku) => panel.open(sku, { strip: true }) });
  fallbackRoot.hidden = false;
  viewToggle.textContent = bn.view3d;
  viewToggle.setAttribute('aria-pressed', 'true');
  viewToggle.hidden = !webglOk;
  track({ event: 'fallback_used', reason });
  hideLoader();
}

async function show3D() {
  mode = '3d';
  panel.close();
  fallbackRoot.hidden = true;
  canvas.hidden = false;
  document.body.classList.remove('mode-2d');
  viewToggle.textContent = bn.simpleView;
  viewToggle.setAttribute('aria-pressed', 'false');
  if (store3d) {
    store3d.setActive(true);
    pills.show(true);
    return;
  }
  try {
    setProgress(0.15);
    const [{ createStore3D }] = await Promise.all([
      import('./scene/store3d'),
      // Bangla glyphs are drawn into canvas textures (sign, posters, labels): wait for the font, max 1.5 s
      Promise.race([document.fonts.load('700 48px "Noto Sans Bengali"'), new Promise((r) => setTimeout(r, 1500))]),
    ]);
    setProgress(0.4);
    store3d = await createStore3D({
      canvas,
      data,
      reducedMotion,
      onProgress: setProgress,
      onProductTap: (sku) => {
        panel.open(sku, { strip: true });
        void store3d?.focusProduct(sku);
      },
      onEmptyTap: () => {
        if (panel.isOpen) panel.close();
      },
    });
    setProgress(1);
    hideLoader();
    pills.show(true);
    pills.setActive('store');
    track({ event: 'section_view', section: 'store' });
    await store3d.enter();
    activeSection = 'panjabi-hero';
    // the hero wall is the first section's wall; mark its pill active
    const hero = data.sections[0]?.id ?? 'store';
    activeSection = hero;
    pills.setActive(hero);
    coach.show();
  } catch (err) {
    console.warn('[3d-store] 3D failed, using fallback', err);
    store3d = null;
    showFallback('error');
  }
}

viewToggle.addEventListener('click', () => {
  if (mode === '3d') showFallback('toggle');
  else void show3D();
});

// ---- boot --------------------------------------------------------------------------
const reason = autoFallbackReason();
if (reason) showFallback(reason);
else void show3D();
