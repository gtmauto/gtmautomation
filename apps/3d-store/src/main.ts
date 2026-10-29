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
// One throwaway WebGL context decides up front (no WebGL / CPU-rendered WebGL → 2D view) so 2D-only phones never
// download or run Three.js; store3d still reports the same cases as typed errors as a safety net.
type FallbackReason = 'query' | 'no_webgl' | 'software_gl' | 'low_memory' | 'reduced_motion' | 'toggle' | 'error';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const forced3D = new URLSearchParams(location.search).get('view') === '3d';

/** One throwaway WebGL context answers both questions (is WebGL there? is it CPU-rendered?). */
function detectGL(): { ok: boolean; software: boolean } {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return { ok: false, software: false };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, software: /swiftshader|llvmpipe|software/i.test(name) };
  } catch {
    return { ok: false, software: false };
  }
}
type PreCheck = { reason: string | null } | undefined;
// index.html runs the same detection inline right after first paint (and preloads the 3D chunks); wait for it (max 400 ms)
const preCheck: PreCheck = await new Promise<PreCheck>((resolve) => {
  const w = window as Window & { __gtmPre?: PreCheck };
  if (w.__gtmPre) return resolve(w.__gtmPre);
  const t = setTimeout(() => resolve(undefined), 400);
  window.addEventListener('gtm:pre', () => {
    clearTimeout(t);
    resolve(w.__gtmPre);
  }, { once: true });
});
let webglOk = true; // false when no WebGL context can be created
function autoFallbackReason(): FallbackReason | null {
  const q = new URLSearchParams(location.search).get('view');
  if (q === '2d') return 'query';
  if (preCheck) {
    webglOk = preCheck.reason !== 'no_webgl';
    const known: Array<string | null> = [null, 'no_webgl', 'software_gl', 'low_memory', 'reduced_motion'];
    if (known.includes(preCheck.reason)) return preCheck.reason as FallbackReason | null;
  }
  const gl = detectGL();
  webglOk = gl.ok;
  if (!gl.ok) return 'no_webgl';
  if (q === '3d') return null;
  if (gl.software) return 'software_gl';
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === 'number' && mem < 2) return 'low_memory';
  if (reducedMotion) return 'reduced_motion';
  return null;
}
const bootReason = autoFallbackReason();
// start downloading the 3D chunk right away (before the UI is wired) when the 3D view will be used
const store3dModule = bootReason ? null : import('./scene/store3d');

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
  const note = reason === 'no_webgl' ? bn.noWebgl : reason === 'low_memory' || reason === 'reduced_motion' || reason === 'software_gl' ? bn.fallbackAuto : undefined;
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
    const { createStore3D } = await (store3dModule ?? import('./scene/store3d'));
    setProgress(0.4);
    store3d = await createStore3D({
      canvas,
      data,
      reducedMotion,
      allowSoftwareGL: forced3D,
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
    performance.mark('gtm:loader-hidden');
    pills.show(true);
    pills.setActive('store');
    track({ event: 'section_view', section: 'store' });
    await store3d.enter();
    // Bangla glyphs are drawn into canvas textures (sign, posters, labels): if they were drawn before the
    // web font arrived, redraw them now, after the glide (a few per frame)
    const s3 = store3d;
    document.fonts.load('700 48px "Noto Sans Bengali"').then(() => s3.refreshText()).catch(() => undefined);
    // the hero wall is the first section's wall; mark its pill active
    const hero = data.sections[0]?.id ?? 'store';
    activeSection = hero;
    pills.setActive(hero);
    performance.mark('gtm:hero');
    coach.show();
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'no_webgl') webglOk = false;
    if (code !== 'no_webgl' && code !== 'software_gl') console.warn('[3d-store] 3D failed, using fallback', err);
    store3d = null;
    showFallback(code === 'no_webgl' ? 'no_webgl' : code === 'software_gl' ? 'software_gl' : 'error');
  }
}

viewToggle.addEventListener('click', () => {
  if (mode === '3d') showFallback('toggle');
  else void show3D();
});

// ---- boot --------------------------------------------------------------------------
const reason = bootReason;
if (reason) showFallback(reason);
else void show3D();
