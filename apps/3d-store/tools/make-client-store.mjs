#!/usr/bin/env node
/**
 * make-client-store.mjs — Phase 2 step e: one 3D store per client. Generates clients/<client_id>/store.json (+ products/ photos)
 * from the client's dashboard products in Supabase, then tools/build-client.mjs builds it and tools/deploy-pages.mjs ships it to its
 * own Cloudflare Pages project (store-<client_id>). The demo store in src/data/ is never touched.
 *
 *   node tools/make-client-store.mjs <client_id>                                  # dry: what would be generated (nothing written)
 *   node tools/make-client-store.mjs <client_id> --write [--photos]               # write clients/<client_id>/store.json (+ photos)
 *   options: --name "Brand" (store name; default clients.name) · --tagline "…" · --color "#0E7C7B" · --page <username|page id>
 *            --wa 8801XXXXXXXXX (the client's OWN WhatsApp number — never a client number inside GTM's WABA) · --env FILE
 *            --no-copy-images (by default a SKU whose /products/<sku>.png exists in public/ is copied as a placeholder)
 *
 * Rules: products = tools/sync-store-from-supabase.mjs buildStore() (same SKU / section / badge / stock rules, README-bn §২.৬).
 *   Branding: an existing clients/<id>/store.json keeps its branding; a new one takes clients.name, the default colour/logo and the
 *   Messenger Page from page_connections (client_id, status connected; the Page ID works in m.me links) — else REPLACE_ME.
 *   Posters are neutral (no delivery-time or return promises the client has not made): "ঘরে বসে কিনুন" + the brand welcome.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildStore, diffStores } from './sync-store-from-supabase.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
export const CLIENT_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
export const DEFAULTS = Object.freeze({ primaryColor: '#0E7C7B', logo: '/brand/logo.svg', tagline: 'ঘরে বসে কিনুন, Messenger বা WhatsApp-এ অর্ডার করুন' });

/** the branding skeleton for a client that has no store.json yet */
export function clientTemplate(clientId, o = {}) {
  const name = String(o.name || clientId).trim();
  return {
    store: {
      id: clientId,
      tenantId: clientId,
      analytics: false,
      name,
      tagline: String(o.tagline || DEFAULTS.tagline),
      primaryColor: String(o.primaryColor || DEFAULTS.primaryColor),
      logo: String(o.logo || DEFAULTS.logo),
      messengerPage: String(o.messengerPage || 'REPLACE_ME'),
      whatsappNumber: String(o.whatsappNumber || 'REPLACE_ME').replace(/[^0-9A-Z_]/g, ''),
    },
    sections: [],
    products: [],
    posters: [
      { text: 'ঘরে বসে কিনুন', sub: 'Messenger বা WhatsApp-এ লিখুন, বাকিটা আমরা', wall: 'north', offset: -0.7 },
      { text: `${name}-এ স্বাগতম`, sub: 'পণ্যে ট্যাপ করে দাম, সাইজ আর স্টক দেখুন', wall: 'north', offset: 0.7 },
    ],
  };
}

/** pick the Messenger Page for m.me links: a connected Page of this client (page id works in m.me/<id>) */
export function pickPage(rows) {
  const ok = (rows || []).filter((r) => r && r.status === 'connected' && r.page_id);
  if (!ok.length) return '';
  ok.sort((a, b) => String(b.connected_at || '').localeCompare(String(a.connected_at || '')));
  return String(ok[0].page_username || ok[0].page_id);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  const flags = new Set(['--write', '--photos', '--no-copy-images']);
  const valued = new Set(['--name', '--tagline', '--color', '--page', '--wa', '--env', '--logo']);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const clientId = argv.find((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1] || ''));
  if (!clientId || !CLIENT_RE.test(clientId)) { console.log('usage: node tools/make-client-store.mjs <client_id> [--write] [--photos] [--name "Brand"] [--page <username|id>] [--wa 8801…] [--tagline …] [--color #hex] [--env FILE] [--no-copy-images]'); process.exit(2); }
  void flags;
  const WRITE = argv.includes('--write'), PHOTOS = argv.includes('--photos'), COPY = !argv.includes('--no-copy-images');
  const DIR = path.join(APP, 'clients', clientId);
  const OUT = path.join(DIR, 'store.json');
  const ENV_FILE = path.resolve(arg('--env', path.resolve(APP, '..', '..', '..', '..', '.env')));

  const env = {};
  for (const k of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY']) if (process.env[k]) env[k] = process.env[k];
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    if (!fs.existsSync(ENV_FILE)) { console.error('no SUPABASE_URL / SUPABASE_SECRET_KEY in process.env and no env file at', ENV_FILE); process.exit(2); }
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) { const m = /^(SUPABASE_URL|SUPABASE_SECRET_KEY)=(.*)$/.exec(line); if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) { console.error('missing SUPABASE_URL or SUPABASE_SECRET_KEY (names only)'); process.exit(2); }
  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const headers = { apikey: env.SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + env.SUPABASE_SECRET_KEY, Accept: 'application/json' };
  const get = async (p) => { const r = await fetch(base + p, { headers }); if (!r.ok) throw new Error(`PostgREST ${r.status} ${(await r.text()).slice(0, 200)}`); return r.json(); };

  const client = (await get(`/rest/v1/clients?select=id,name&id=eq.${encodeURIComponent(clientId)}`))[0];
  if (!client) { console.error(`no client "${clientId}" in public.clients`); process.exit(1); }
  let pages = [];
  try { pages = await get(`/rest/v1/page_connections?select=page_id,page_name,status,connected_at&client_id=eq.${encodeURIComponent(clientId)}`); } catch (e) { console.log('page_connections not readable (' + e.message.slice(0, 80) + ') — Page stays REPLACE_ME'); }
  const rows = await get(`/rest/v1/products?select=sku,name,name_bn,price,sale_price_bdt,stock_qty,track_stock,category,sort_order,is_active,is_sample,created_at,clients(name),product_variants(label,options,sku,stock_qty,is_active,sort_order),product_photos(storage_path,is_primary)&client_id=eq.${encodeURIComponent(clientId)}&order=sort_order.asc,created_at.asc&limit=500`);

  const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const current = existing || clientTemplate(clientId, { name: arg('--name', client.name), tagline: arg('--tagline'), primaryColor: arg('--color'), logo: arg('--logo'), messengerPage: arg('--page', pickPage(pages)), whatsappNumber: arg('--wa') });
  if (existing) { for (const [k, f] of [['name', '--name'], ['tagline', '--tagline'], ['primaryColor', '--color'], ['messengerPage', '--page'], ['whatsappNumber', '--wa']]) if (arg(f)) current.store[k] = arg(f); }
  const { store, skipped, notes, counts } = buildStore(rows, current, { clientId });
  const d = existing ? diffStores(existing, store) : null;

  console.log(`${WRITE ? '' : 'DRY RUN — nothing written\n'}client ${clientId} "${store.store.name}" · ${existing ? 'existing clients/' + clientId + '/store.json (branding kept)' : 'NEW client store'} · rows ${counts.rows} → ${counts.sections} sections, ${counts.products} products`);
  console.log(`  Messenger Page: ${store.store.messengerPage}${store.store.messengerPage === 'REPLACE_ME' ? '  ← no connected Page for this client; pass --page <username|id>' : ''}`);
  console.log(`  WhatsApp: ${store.store.whatsappNumber}${store.store.whatsappNumber === 'REPLACE_ME' ? '  ← the client\'s OWN number; pass --wa 8801…' : ''}`);
  for (const s of store.sections) console.log(`  section ${s.id} "${s.label}" (${s.display}, ${s.wall}): ${store.products.filter((p) => p.section === s.id).map((p) => p.sku).join(', ')}`);
  for (const s of skipped) console.log(`  SKIP ${s.sku} ${s.name} — ${s.reason}`);
  for (const n of notes) console.log(`  note: ${n}`);
  if (d) console.log(d.same ? '  store.json already matches Supabase' : `  diff: +${d.added.length} -${d.removed.length} ~${d.changed.length}${d.sectionsChanged ? ' sections' : ''}${d.storeChanged ? ' store' : ''}`);

  // images: the client's own folder; a SKU already pictured in public/products/ can be copied as a placeholder
  const imgDir = path.join(DIR, 'products');
  const have = (p) => fs.existsSync(path.join(imgDir, path.basename(p.image)));
  const copyable = store.products.filter((p) => !have(p) && fs.existsSync(path.join(APP, 'public', p.image)));
  const missing = store.products.filter((p) => !have(p) && !copyable.includes(p));
  if (copyable.length) console.log(`  images: ${copyable.length} copied from public/products as placeholders${COPY ? '' : ' (skipped: --no-copy-images)'}`);
  if (missing.length) console.log(`  images missing for ${missing.map((p) => p.sku).join(', ')} → ${PHOTOS ? 'fetching dashboard photos' : 'add --photos or put <sku>.png in clients/' + clientId + '/products/'}`);

  if (WRITE) {
    fs.mkdirSync(imgDir, { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(store, null, 2) + '\n');
    if (COPY) for (const p of copyable) fs.copyFileSync(path.join(APP, 'public', p.image), path.join(imgDir, path.basename(p.image)));
    console.log(`\nWROTE clients/${clientId}/store.json (${store.products.length} products)`);
  }
  if (PHOTOS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gtm-client-photos-'));
    let n = 0;
    for (const r of rows) {
      const sku = String(r.sku || '').toUpperCase();
      if (!store.products.some((p) => p.sku === sku)) continue;
      const photos = Array.isArray(r.product_photos) ? r.product_photos : [];
      const pick = photos.find((p) => p && p.is_primary) || photos[0];
      if (!pick || !pick.storage_path) continue;
      const ext = (path.extname(pick.storage_path) || '.jpg').toLowerCase();
      const pr = await fetch(`${base}/storage/v1/object/public/product-photos/${pick.storage_path.split('/').map(encodeURIComponent).join('/')}`);
      if (!pr.ok) { console.log(`  photo ${sku}: HTTP ${pr.status} — skipped`); continue; }
      fs.writeFileSync(path.join(tmp, `${sku}${ext}`), Buffer.from(await pr.arrayBuffer())); n++;
    }
    console.log(`\nphotos downloaded: ${n}`);
    if (n) spawnSync(process.execPath, [path.join(HERE, 'prep-photos.mjs'), tmp, '--out', imgDir, ...(WRITE ? [] : ['--dry'])], { stdio: 'inherit' });
  }
  console.log(`\nnext: node tools/build-client.mjs ${clientId}   →   node tools/deploy-pages.mjs dry --dist dist-${clientId} --store clients/${clientId}/store.json --project store-${clientId}`);
}
