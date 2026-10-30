/**
 * Analytics hooks.
 * Every event is pushed to window.dataLayer (Phase 1 contract, unchanged). Phase 2 step d: when store.json says
 * `"analytics": true`, the same events are batched and sent with navigator.sendBeacon to /api/event — a Cloudflare Pages
 * Function (functions/api/event.js) that writes them to Supabase public.store_events. No PII: a random per-tab session id,
 * the event names and SKUs only; the Function adds a coarse device class and never stores the IP or user agent.
 *
 * Events:
 *   section_view   { section }
 *   product_focus  { sku, section }
 *   cta_click      { sku | skus, section?, channel: 'messenger' | 'whatsapp' }
 *   cart_add       { sku, section }
 *   fallback_used  { reason: 'toggle' | 'no_webgl' | 'software_gl' | 'low_memory' | 'reduced_motion' | 'query' | 'error' }
 */
import type { StoreInfo } from './types';

export type AnalyticsEvent =
  | { event: 'section_view'; section: string }
  | { event: 'product_focus'; sku: string; section: string }
  | { event: 'cta_click'; sku?: string; skus?: string[]; section?: string; channel: 'messenger' | 'whatsapp' }
  | { event: 'cart_add'; sku: string; section: string }
  | { event: 'fallback_used'; reason: string };

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const ENDPOINT = '/api/event';
const MAX_BATCH = 20;
const FLUSH_MS = 5000;

let cfg: { client: string; store: string } | null = null;
let sid = '';
const queue: Array<AnalyticsEvent & { ts: number }> = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function random16(): string {
  try {
    return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return (Date.now().toString(16) + Math.random().toString(16).slice(2)).replace(/[^a-f0-9]/g, '').padEnd(16, '0').slice(0, 16);
  }
}

/** one id per browser tab (sessionStorage); never a cookie, never tied to a person */
function sessionId(): string {
  try {
    const k = 'gb_sid';
    let s = sessionStorage.getItem(k);
    if (!s || !/^[a-f0-9]{16}$/.test(s)) {
      s = random16();
      sessionStorage.setItem(k, s);
    }
    return s;
  } catch {
    return random16();
  }
}

/** Call once with store.json's `store`; does nothing unless `analytics: true` and a tenantId are set. */
export function initAnalytics(store: StoreInfo): void {
  if (store.analytics !== true || !store.tenantId) return;
  cfg = { client: store.tenantId, store: store.id };
  sid = sessionId();
  try {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  } catch {
    /* ignore */
  }
}

export function track(ev: AnalyticsEvent): void {
  try {
    const row = { ...ev, ts: Date.now() };
    (window.dataLayer ||= []).push(row);
    if (cfg) {
      queue.push(row);
      if (queue.length >= MAX_BATCH) flush();
      else if (timer === undefined) timer = setTimeout(flush, FLUSH_MS);
    }
  } catch {
    /* analytics must never break the store */
  }
}

function flush(): void {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  if (!cfg || !queue.length) return;
  const events = queue.splice(0, MAX_BATCH);
  const body = JSON.stringify({ client: cfg.client, store: cfg.store, session: sid, events });
  try {
    const sent = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    if (!sent) void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => undefined);
  } catch {
    /* ignore — analytics never surfaces to the shopper */
  }
  if (queue.length) timer = setTimeout(flush, 1000);
}
