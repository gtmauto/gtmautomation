#!/usr/bin/env node
/**
 * sync-store-from-supabase.mjs — Phase 2 step c: the dashboard ("পণ্য ও স্টক", Supabase) is the source of truth; this script turns a
 * tenant's products into src/data/store.json (sections, products, tenantId). Branding (name, tagline, colour, logo, Page, WhatsApp
 * number) and the wall posters are KEPT from the current store.json. Nothing is written unless --write is given.
 *
 *   node tools/sync-store-from-supabase.mjs <client_id>                      # dry: fetch + diff against the current store.json
 *   node tools/sync-store-from-supabase.mjs <client_id> --write              # write src/data/store.json (then: npm run build && deploy)
 *   node tools/sync-store-from-supabase.mjs <client_id> --write --photos     # also download primary photos → prep-photos → public/products/
 *   options: --out <file> (default src/data/store.json) · --env <file> (credentials file) · --brand-from-db (store.name = clients.name)
 *
 * Credentials by NAME only, never printed: process.env SUPABASE_URL + SUPABASE_SECRET_KEY, else the GTM Automation project .env
 * (five folders up) or --env FILE. Read-only against Supabase (one PostgREST GET; photos are public-bucket GETs).
 *
 * Mapping rules (owner-facing, also in docs/README-bn.md §২.৬):
 *  - Only SKUs the bots can read from a link: 2–4 letters, dash, 2–4 digits (PJ-003, TOY-0012). Others are listed and skipped.
 *  - Sections = product categories, at most 3 (the room has three walls), each at most 6 products (sort_order, then created_at).
 *    A category that matches a current section keeps its id / display / wall; a new one gets rack → shelf → pegboard, north → east → west.
 *  - price = sale price when set, else regular price. Badge: অফার (sale < regular) > the current badge of a SKU already in store.json
 *    > নতুন for a brand-new product created within 14 days. Sections already on a wall keep their order (stable room).
 *  - sizes = the product's active variants (labels, in order); a product without variants keeps its current sizes, else none.
 *  - stock = sum of variant stock when variants exist, else the product's stock_qty. viewsToday is never invented (current value kept).
 *  - image = the current path when the SKU is already in store.json, else /products/<sku>.png (warned when the file is missing;
 *    --photos downloads the primary dashboard photo and runs tools/prep-photos.mjs so it is square and ≤ 200 KB).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
export const SKU_RE = /^[A-Za-z]{2,4}-\d{2,4}$/;
const DISPLAYS = ['rack', 'shelf', 'pegboard'];
const WALLS = ['north', 'east', 'west'];
const MAX_SECTIONS = 3;
const MAX_PER_SECTION = 6;
const NEW_DAYS = 14;

/* ───────────────────────────── pure mapping (tested offline) */
export function buildStore(rows, current, opts = {}) {
  const now = opts.now ? new Date(opts.now).getTime() : Date.now();
  const clientId = String(opts.clientId || '');
  const cur = current && typeof current === 'object' ? current : {};
  const curProducts = new Map((cur.products || []).map((p) => [String(p.sku).toUpperCase(), p]));
  const curSections = cur.sections || [];
  const skipped = [];
  const notes = [];

  const active = (rows || []).filter((r) => r && r.is_active !== false && r.is_sample !== true);
  const usable = [];
  for (const r of active) {
    const sku = String(r.sku || '').trim();
    if (!SKU_RE.test(sku)) { skipped.push({ sku, name: String(r.name_bn || r.name || ''), reason: 'SKU not readable by the bots (need 2–4 letters, dash, 2–4 digits)' }); continue; }
    if (!String(r.category || '').trim()) { skipped.push({ sku, name: String(r.name_bn || r.name || ''), reason: 'no category (section)' }); continue; }
    usable.push(r);
  }
  const bySort = (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.sku).localeCompare(String(b.sku));
  usable.sort(bySort);

  // categories: the ones already on a wall keep the current wall order (a stable room); new ones follow by their best sort_order
  const seen = [];
  for (const r of usable) { const label = String(r.category).trim(); if (!seen.includes(label)) seen.push(label); }
  const cats = curSections.map((s) => String(s.label).trim()).filter((l) => seen.includes(l)).concat(seen.filter((l) => !curSections.some((s) => String(s.label).trim() === l)));
  const keptCats = cats.slice(0, MAX_SECTIONS);
  for (const c of cats.slice(MAX_SECTIONS)) for (const r of usable.filter((x) => String(x.category).trim() === c)) skipped.push({ sku: r.sku, name: String(r.name_bn || r.name || ''), reason: `section "${c}" beyond the ${MAX_SECTIONS}-wall room` });

  const usedIds = new Set();
  const sections = keptCats.map((label, i) => {
    const match = curSections.find((s) => String(s.label).trim() === label);
    let id = match ? match.id : label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `s${i + 1}`;
    while (usedIds.has(id)) id = `${id}-${i + 1}`;
    usedIds.add(id);
    return { id, label, display: match ? match.display : DISPLAYS[i % DISPLAYS.length], wall: WALLS[i] };
  });

  const products = [];
  for (const sec of sections) {
    const inSec = usable.filter((r) => String(r.category).trim() === sec.label);
    for (const r of inSec.slice(MAX_PER_SECTION)) skipped.push({ sku: r.sku, name: String(r.name_bn || r.name || ''), reason: `section "${sec.label}" already shows ${MAX_PER_SECTION} products` });
    for (const r of inSec.slice(0, MAX_PER_SECTION)) {
      const sku = String(r.sku).toUpperCase();
      const prev = curProducts.get(sku);
      const vars = (Array.isArray(r.product_variants) ? r.product_variants : []).filter((v) => v && v.is_active !== false).sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
      const regular = Number(r.price);
      const sale = r.sale_price_bdt != null ? Number(r.sale_price_bdt) : null;
      const price = Math.round(Number.isFinite(sale) && sale !== null ? sale : regular);
      const createdAt = r.created_at ? new Date(r.created_at).getTime() : NaN;
      const isNew = Number.isFinite(createdAt) && now - createdAt < NEW_DAYS * 86400000;
      // অফার is always true to the price; a SKU already in store.json keeps its curated badge; a brand-new recent product says নতুন
      const badge = sale !== null && Number.isFinite(sale) && sale < regular ? 'অফার' : prev ? (prev.badge || undefined) : isNew ? 'নতুন' : undefined;
      const sizes = vars.length ? vars.map((v) => String(v.label || '').trim()).filter(Boolean) : (prev && Array.isArray(prev.sizes) ? prev.sizes.slice() : []);
      const stock = vars.length ? vars.reduce((a, v) => a + (Number(v.stock_qty) || 0), 0) : (Number(r.stock_qty) || 0);
      const image = prev && prev.image ? prev.image : `/products/${sku.toLowerCase()}.png`;
      const p = { sku, section: sec.id, name: String(r.name_bn || r.name || sku).trim(), price, sizes, stock, image };
      if (badge) p.badge = badge;
      if (prev && typeof prev.viewsToday === 'number') { p.viewsToday = prev.viewsToday; }
      if (!prev) notes.push(`${sku}: new in store.json (image ${image}${vars.length ? '' : ', no sizes'})`);
      products.push(p);
    }
  }
  if ((cur.products || []).some((p) => typeof p.viewsToday === 'number')) notes.push('viewsToday values are carried over from the current store.json (demo numbers), never computed');

  const shopName = (rows.find((r) => r && r.clients && r.clients.name) || {}).clients;
  const store = Object.assign({}, cur.store || {}, { tenantId: clientId });
  if (opts.brandFromDb && shopName && shopName.name) store.name = String(shopName.name).trim();
  if (!store.id) store.id = clientId;
  for (const k of ['messengerPage', 'whatsappNumber']) if (!store[k]) { store[k] = 'REPLACE_ME'; notes.push(`store.${k} missing → REPLACE_ME (fill it by hand)`); }

  const out = { store, sections, products, posters: Array.isArray(cur.posters) ? cur.posters : [] };
  return { store: out, skipped, notes, counts: { rows: (rows || []).length, active: active.length, usable: usable.length, sections: sections.length, products: products.length } };
}

export function diffStores(current, next) {
  const a = new Map(((current && current.products) || []).map((p) => [String(p.sku).toUpperCase(), p]));
  const b = new Map(((next && next.products) || []).map((p) => [String(p.sku).toUpperCase(), p]));
  const added = [], removed = [], changed = [];
  for (const [sku, p] of b) if (!a.has(sku)) added.push(sku); else {
    const q = a.get(sku); const fields = [];
    for (const k of ['name', 'price', 'stock', 'badge', 'section', 'image']) if (JSON.stringify(q[k]) !== JSON.stringify(p[k])) fields.push(`${k}: ${JSON.stringify(q[k])} → ${JSON.stringify(p[k])}`);
    if (JSON.stringify(q.sizes || []) !== JSON.stringify(p.sizes || [])) fields.push(`sizes: ${JSON.stringify(q.sizes || [])} → ${JSON.stringify(p.sizes || [])}`);
    if (fields.length) changed.push({ sku, fields });
  }
  for (const sku of a.keys()) if (!b.has(sku)) removed.push(sku);
  const sectionsChanged = JSON.stringify((current && current.sections) || []) !== JSON.stringify((next && next.sections) || []);
  const storeChanged = JSON.stringify((current && current.store) || {}) !== JSON.stringify((next && next.store) || {});
  return { added, removed, changed, sectionsChanged, storeChanged, same: !added.length && !removed.length && !changed.length && !sectionsChanged && !storeChanged };
}

/* ───────────────────────────── CLI */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
  const clientId = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out' && argv[argv.indexOf(a) - 1] !== '--env');
  const WRITE = argv.includes('--write'), PHOTOS = argv.includes('--photos'), BRAND = argv.includes('--brand-from-db');
  const OUT = path.resolve(APP, arg('--out', 'src/data/store.json'));
  const ENV_FILE = path.resolve(arg('--env', path.resolve(APP, '..', '..', '..', '..', '.env')));
  if (!clientId || !/^[a-z0-9][a-z0-9-]{2,39}$/.test(clientId)) { console.log('usage: node tools/sync-store-from-supabase.mjs <client_id> [--write] [--photos] [--out file] [--env file] [--brand-from-db]'); process.exit(2); }

  const env = {};
  for (const k of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY']) if (process.env[k]) env[k] = process.env[k];
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    if (!fs.existsSync(ENV_FILE)) { console.error('no SUPABASE_URL / SUPABASE_SECRET_KEY in process.env and no env file at', ENV_FILE); process.exit(2); }
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) { const m = /^(SUPABASE_URL|SUPABASE_SECRET_KEY)=(.*)$/.exec(line); if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) { console.error('missing SUPABASE_URL or SUPABASE_SECRET_KEY (names only)'); process.exit(2); }
  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const headers = { apikey: env.SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + env.SUPABASE_SECRET_KEY, Accept: 'application/json' };

  const current = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const url = `${base}/rest/v1/products?select=sku,name,name_bn,price,sale_price_bdt,stock_qty,track_stock,category,sort_order,is_active,is_sample,created_at,clients(name),product_variants(label,options,sku,stock_qty,is_active,sort_order),product_photos(storage_path,is_primary)&client_id=eq.${encodeURIComponent(clientId)}&order=sort_order.asc,created_at.asc&limit=500`;
  const res = await fetch(url, { headers });
  if (!res.ok) { console.error('PostgREST', res.status, (await res.text()).slice(0, 300)); process.exit(1); }
  const rows = await res.json();
  const { store, skipped, notes, counts } = buildStore(rows, current, { clientId, brandFromDb: BRAND });
  const d = diffStores(current, store);

  console.log(`${WRITE ? '' : 'DRY RUN — nothing written\n'}tenant ${clientId} · rows ${counts.rows} · active ${counts.active} · usable ${counts.usable} → ${counts.sections} sections, ${counts.products} products`);
  for (const s of store.sections) console.log(`  section ${s.id} "${s.label}" (${s.display}, ${s.wall}): ${store.products.filter((p) => p.section === s.id).map((p) => p.sku).join(', ')}`);
  for (const s of skipped) console.log(`  SKIP ${s.sku} ${s.name} — ${s.reason}`);
  for (const n of notes) console.log(`  note: ${n}`);
  console.log(d.same ? '\nstore.json is already in sync with Supabase.' : `\ndiff vs ${path.relative(APP, OUT)}: +${d.added.length} added, -${d.removed.length} removed, ~${d.changed.length} changed${d.sectionsChanged ? ', sections changed' : ''}${d.storeChanged ? ', store fields changed' : ''}`);
  for (const s of d.added) console.log(`  + ${s}`);
  for (const s of d.removed) console.log(`  - ${s}`);
  for (const c of d.changed) console.log(`  ~ ${c.sku}: ${c.fields.join(' · ')}`);
  const missingImg = store.products.filter((p) => !fs.existsSync(path.join(APP, 'public', p.image))).map((p) => p.sku);
  if (missingImg.length) console.log(`  images missing in public/: ${missingImg.join(', ')}${PHOTOS ? ' (fetching with --photos)' : ' (placeholder cards until --photos or tools/prep-photos.mjs)'}`);

  if (PHOTOS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gtm-store-photos-'));
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
    if (n) {
      const args = [path.join(HERE, 'prep-photos.mjs'), tmp, ...(WRITE ? [] : ['--dry'])];
      const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
      if (r.status !== 0) console.log('prep-photos reported problems (see above)');
    }
  }

  if (WRITE) {
    fs.writeFileSync(OUT, JSON.stringify(store, null, 2) + '\n');
    console.log(`\nWROTE ${path.relative(APP, OUT)} — next: npm run build && node tools/deploy-pages.mjs dry|apply`);
  } else if (!d.same) console.log('\nre-run with --write to update store.json (then build + deploy).');
}
