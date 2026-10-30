// _store-events-lib.js — pure validation for the store analytics endpoint (shared by functions/api/event.js and tools/test-store-events.mjs).
// Files starting with "_" are not routes in Cloudflare Pages Functions.
export const EVENTS = ['section_view', 'product_focus', 'cta_click', 'cart_add', 'fallback_used'];
export const CHANNELS = ['messenger', 'whatsapp'];
export const MAX_EVENTS = 20;
export const MAX_BODY = 4096;
const ID_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
const SKU_RE = /^[A-Za-z]{2,4}-[0-9]{2,4}$/;
const SESSION_RE = /^[a-f0-9]{8,32}$/;
const short = (v, n) => (typeof v === 'string' && v.length > 0 && v.length <= n ? v : null);

/** { client, store, session, events:[{event, sku?, skus?, section?, channel?, reason?, ts?}] } → { ok, rows | error } */
export function validateBatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'body must be an object' };
  const client = String(body.client || '');
  const store = String(body.store || '');
  const session = String(body.session || '');
  if (!ID_RE.test(client)) return { ok: false, error: 'client' };
  if (!store || store.length > 64) return { ok: false, error: 'store' };
  if (!SESSION_RE.test(session)) return { ok: false, error: 'session' };
  if (!Array.isArray(body.events) || !body.events.length) return { ok: false, error: 'events' };
  if (body.events.length > MAX_EVENTS) return { ok: false, error: 'too many events' };
  const rows = [];
  for (const e of body.events) {
    if (!e || typeof e !== 'object' || !EVENTS.includes(e.event)) return { ok: false, error: 'event' };
    // every row carries the SAME key set (PostgREST bulk insert: PGRST102 "All object keys must match" otherwise — hit live 2026-10-30)
    const row = { client_id: client, store_id: store, session_id: session, event: e.event, sku: null, skus: null, section: null, channel: null, reason: null, client_ts: null };
    if (e.sku != null) { if (!SKU_RE.test(String(e.sku))) return { ok: false, error: 'sku' }; row.sku = String(e.sku).toUpperCase(); }
    if (e.skus != null) { if (!Array.isArray(e.skus) || e.skus.length > 20 || !e.skus.every((s) => SKU_RE.test(String(s)))) return { ok: false, error: 'skus' }; row.skus = e.skus.map((s) => String(s).toUpperCase()); }
    if (e.section != null) { const s = short(e.section, 40); if (!s) return { ok: false, error: 'section' }; row.section = s; }
    if (e.channel != null) { if (!CHANNELS.includes(e.channel)) return { ok: false, error: 'channel' }; row.channel = e.channel; }
    if (e.reason != null) { const r = short(e.reason, 40); if (!r) return { ok: false, error: 'reason' }; row.reason = r; }
    if (e.ts != null) { const t = Number(e.ts); if (Number.isFinite(t) && t > 1600000000000 && t < 4100000000000) row.client_ts = new Date(t).toISOString(); }
    rows.push(row);
  }
  return { ok: true, rows };
}

/** coarse device class from the user agent — the UA itself is never stored */
export function uaClass(ua) {
  const s = String(ua || '');
  if (!s) return 'unknown';
  if (/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(s)) return 'bot';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(s)) return 'tablet';
  if (/mobi|iphone|android/i.test(s)) return 'phone';
  return 'desktop';
}
