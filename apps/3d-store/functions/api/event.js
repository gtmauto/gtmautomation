// functions/api/event.js — Cloudflare Pages Function: POST /api/event  (3D store analytics, Phase 2 step d)
// The store's analytics.ts batches window.dataLayer events and sends them here with navigator.sendBeacon. We validate, add a coarse
// device class, and insert into Supabase public.store_events with the service key held as a Pages secret. No IP, no user agent, no
// cookies are stored. Secrets by NAME: SUPABASE_URL + SUPABASE_STORE_EVENTS_KEY (set with `wrangler pages secret put`).
import { validateBatch, uaClass, MAX_BODY } from '../_store-events-lib.js';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const buckets = new Map();   // best-effort per-isolate rate limit: ip → { n, at }
const LIMIT = 120, WINDOW_MS = 60000;
function allow(ip) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.at > WINDOW_MS) { buckets.set(ip, { n: 1, at: now }); if (buckets.size > 5000) buckets.clear(); return true; }
  b.n++;
  return b.n <= LIMIT;
}

export async function onRequestGet() {
  return json({ ok: true, endpoint: 'store events', method: 'POST', fields: ['client', 'store', 'session', 'events[]'] });
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_STORE_EVENTS_KEY) return json({ ok: false, error: 'not configured' }, 503);
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin) { try { if (new URL(origin).host !== url.host) return json({ ok: false, error: 'origin' }, 403); } catch { return json({ ok: false, error: 'origin' }, 403); } }
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!allow(ip)) return json({ ok: false, error: 'rate' }, 429);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ ok: false, error: 'too large' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ ok: false, error: 'json' }, 400); }
  const v = validateBatch(body);
  if (!v.ok) return json({ ok: false, error: v.error }, 400);
  const ua = uaClass(request.headers.get('user-agent'));
  const rows = v.rows.map((r) => Object.assign({ ua_class: ua }, r));
  const key = env.SUPABASE_STORE_EVENTS_KEY;
  const r = await fetch(String(env.SUPABASE_URL).replace(/\/$/, '') + '/rest/v1/store_events', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) return json({ ok: false, error: 'db ' + r.status }, 502);
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
