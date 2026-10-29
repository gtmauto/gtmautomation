/**
 * Analytics hooks (no backend in Phase 1).
 * Every event is pushed to window.dataLayer so Phase 3 can wire GTM / the dashboard.
 *
 * Events:
 *   section_view   { section }
 *   product_focus  { sku, section }
 *   cta_click      { sku | skus, section?, channel: 'messenger' | 'whatsapp' }
 *   cart_add       { sku, section }
 *   fallback_used  { reason: 'toggle' | 'no_webgl' | 'software_gl' | 'low_memory' | 'reduced_motion' | 'query' | 'error' }
 */
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

export function track(ev: AnalyticsEvent): void {
  try {
    (window.dataLayer ||= []).push({ ...ev, ts: Date.now() });
  } catch {
    /* analytics must never break the store */
  }
}
