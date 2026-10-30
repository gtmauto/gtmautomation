#!/usr/bin/env node
/**
 * test-store-events.mjs — offline tests for the analytics endpoint: validation lib + the Pages Function handler with a mocked fetch/env.
 *   node tools/test-store-events.mjs
 */
import { validateBatch, uaClass } from '../functions/_store-events-lib.js';
import { onRequestPost, onRequestGet } from '../functions/api/event.js';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + String(extra).slice(0, 300) : '')); } };
const good = () => ({ client: 'demo-dokan', store: 'ghor-bazar', session: 'a1b2c3d4e5f60718', events: [{ event: 'section_view', section: 'panjabi', ts: 1793376000000 }, { event: 'product_focus', sku: 'pj-003', section: 'panjabi' }, { event: 'cta_click', sku: 'PJ-003', channel: 'whatsapp' }, { event: 'cart_add', skus: ['PJ-003', 'SR-001'] }, { event: 'fallback_used', reason: 'no_webgl' }] });

console.log('1. validateBatch');
{
  const v = validateBatch(good());
  check('valid batch → 5 rows, sku upper-cased, ts → client_ts', v.ok && v.rows.length === 5 && v.rows[1].sku === 'PJ-003' && v.rows[0].client_ts === '2026-10-30T16:00:00.000Z' && v.rows[3].skus.join() === 'PJ-003,SR-001', JSON.stringify(v).slice(0, 300));
  check('every row carries the same full key set with nulls (PostgREST bulk insert), no ip/ua fields', v.rows.every((r) => Object.keys(r).sort().join() === 'channel,client_id,client_ts,event,reason,section,session_id,sku,skus,store_id') && v.rows[1].section === 'panjabi' && v.rows[1].channel === null);
  const bad = (mut) => { const b = good(); mut(b); return validateBatch(b).ok === false; };
  check('bad client id', bad((b) => { b.client = 'Demo Dokan'; }));
  check('bad session (not hex)', bad((b) => { b.session = 'xyz'; }));
  check('unknown event', bad((b) => { b.events[0].event = 'purchase'; }));
  check('bad sku', bad((b) => { b.events[1].sku = 'DROP TABLE'; }));
  check('bad channel', bad((b) => { b.events[2].channel = 'telegram'; }));
  check('too long section', bad((b) => { b.events[0].section = 'x'.repeat(41); }));
  check('too many events', bad((b) => { b.events = Array.from({ length: 21 }, () => ({ event: 'section_view' })); }));
  check('empty events', bad((b) => { b.events = []; }));
  check('array body rejected', validateBatch([]).ok === false && validateBatch(null).ok === false);
  check('absurd ts ignored (client_ts null)', (() => { const b = good(); b.events[0].ts = 5; return validateBatch(b).rows[0].client_ts === null; })());
}

console.log('2. uaClass');
check('phone / tablet / desktop / bot / unknown', uaClass('Mozilla/5.0 (Linux; Android 13; SM-A135F) Mobile Safari') === 'phone' && uaClass('Mozilla/5.0 (iPad; CPU OS 17_0)') === 'tablet' && uaClass('Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/130') === 'desktop' && uaClass('Chrome-Lighthouse') === 'bot' && uaClass('') === 'unknown');

console.log('3. handler');
{
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }); };
  const env = { SUPABASE_URL: 'https://demo.supabase.co/', SUPABASE_STORE_EVENTS_KEY: 'test-key' };
  const req = (body, headers = {}, method = 'POST') => new Request('https://ghor-bazar-3d.pages.dev/api/event', { method, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined, headers: Object.assign({ 'user-agent': 'Mozilla/5.0 (Linux; Android 13) Mobile', 'cf-connecting-ip': '203.0.113.9' }, headers) });
  let r = await onRequestPost({ request: req(good()), env });
  check('valid → 204, one PostgREST insert with the key by header and return=minimal', r.status === 204 && calls.length === 1 && calls[0].url === 'https://demo.supabase.co/rest/v1/store_events' && calls[0].init.headers.apikey === 'test-key' && calls[0].init.headers.Prefer === 'return=minimal', String(r.status) + ' ' + calls.length);
  const rows = JSON.parse(calls[0].init.body);
  check('rows carry ua_class phone, no ip / ua / cookie', rows.length === 5 && rows.every((x) => x.ua_class === 'phone') && !JSON.stringify(rows).includes('203.0.113.9') && !JSON.stringify(rows).includes('Mozilla'));
  r = await onRequestPost({ request: req(good()), env: {} });
  check('no secrets → 503 not configured, nothing fetched', r.status === 503 && calls.length === 1);
  r = await onRequestPost({ request: req(good(), { origin: 'https://evil.example' }), env });
  check('foreign origin → 403', r.status === 403 && calls.length === 1);
  r = await onRequestPost({ request: req(good(), { origin: 'https://ghor-bazar-3d.pages.dev' }), env });
  check('same origin → ok', r.status === 204 && calls.length === 2);
  r = await onRequestPost({ request: req('{not json'), env });
  check('bad json → 400', r.status === 400);
  r = await onRequestPost({ request: req('x'.repeat(5000)), env });
  check('too large → 413', r.status === 413);
  r = await onRequestPost({ request: req({ client: 'demo-dokan', store: 's', session: 'a1b2c3d4', events: [{ event: 'nope' }] }), env });
  check('invalid event → 400 with the field name', r.status === 400 && (await r.json()).error === 'event');
  globalThis.fetch = async () => new Response('boom', { status: 500 });
  r = await onRequestPost({ request: req(good()), env });
  check('db failure → 502', r.status === 502);
  globalThis.fetch = async () => new Response(null, { status: 201 });
  let limited = 0;
  for (let i = 0; i < 130; i++) { const x = await onRequestPost({ request: req(good(), { 'cf-connecting-ip': '198.51.100.7' }), env }); if (x.status === 429) limited++; }
  check('rate limit kicks in after 120 posts/min per ip', limited >= 9 && limited <= 10, String(limited));
  const g = await onRequestGet();
  check('GET = health json', g.status === 200 && (await g.json()).ok === true);
  globalThis.fetch = realFetch;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
