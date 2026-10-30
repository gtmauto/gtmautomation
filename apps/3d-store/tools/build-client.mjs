#!/usr/bin/env node
/**
 * build-client.mjs — Phase 2 step e: build one client's 3D store from clients/<client_id>/ into dist-<client_id>/.
 *   node tools/build-client.mjs <client_id>
 * Assembles a static folder (.build-public-<client_id>/ = public/brand + public/fonts + clients/<client_id>/products), then runs
 * `tsc --noEmit && vite build` with STORE_DIR / STORE_PUBLIC_DIR / STORE_OUT_DIR (vite.config.ts) and checks the result:
 * index.html carries the client's store name, the bundle carries the `s_<client_id>__` ref prefix, every product image is present.
 * The demo store (src/data, public, dist) is never touched. Deploy: tools/deploy-pages.mjs --dist dist-<id> --store clients/<id>/store.json --project store-<id>
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const clientId = process.argv[2];
if (!clientId || !/^[a-z0-9][a-z0-9-]{2,39}$/.test(clientId)) { console.log('usage: node tools/build-client.mjs <client_id>'); process.exit(2); }
const DIR = path.join(APP, 'clients', clientId);
const STORE = path.join(DIR, 'store.json');
if (!fs.existsSync(STORE)) { console.error(`clients/${clientId}/store.json missing — run tools/make-client-store.mjs ${clientId} --write first`); process.exit(1); }
const data = JSON.parse(fs.readFileSync(STORE, 'utf8'));
if (data.store.tenantId !== clientId) { console.error(`store.tenantId "${data.store.tenantId}" ≠ ${clientId}`); process.exit(1); }

const PUB = path.join(APP, `.build-public-${clientId}`);
const OUT = path.join(APP, `dist-${clientId}`);
fs.rmSync(PUB, { recursive: true, force: true });
fs.mkdirSync(PUB, { recursive: true });
for (const d of ['brand', 'fonts']) fs.cpSync(path.join(APP, 'public', d), path.join(PUB, d), { recursive: true });
const imgDir = path.join(DIR, 'products');
if (fs.existsSync(imgDir)) fs.cpSync(imgDir, path.join(PUB, 'products'), { recursive: true });
const missing = data.products.filter((p) => !fs.existsSync(path.join(PUB, p.image)));
if (missing.length) console.log(`warning: ${missing.length} product image(s) missing in clients/${clientId}/products: ${missing.map((p) => p.sku).join(', ')} (cards stay blank until tools/make-client-store.mjs --photos)`);
if (data.store.messengerPage === 'REPLACE_ME' || data.store.whatsappNumber === 'REPLACE_ME') console.log('warning: messengerPage / whatsappNumber still REPLACE_ME — the order buttons will reach nobody');

console.log(`building clients/${clientId} ("${data.store.name}", ${data.products.length} products) → dist-${clientId}/`);
const env = Object.assign({}, process.env, { STORE_DIR: path.relative(APP, DIR), STORE_PUBLIC_DIR: path.relative(APP, PUB), STORE_OUT_DIR: path.relative(APP, OUT) });
const run = (cmd, args) => spawnSync(process.platform === 'win32' ? cmd + '.cmd' : cmd, args, { cwd: APP, env, stdio: 'inherit', shell: process.platform === 'win32' });
let r = run('npx', ['tsc', '--noEmit']);
if (r.status !== 0) { console.error('tsc failed'); process.exit(1); }
r = run('npx', ['vite', 'build']);
if (r.status !== 0) { console.error('vite build failed'); process.exit(1); }

const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Vite inlines the JSON as JSON.parse("…") with escaped quotes → unescape before searching for the client's values
const js = fs.readdirSync(path.join(OUT, 'assets')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(OUT, 'assets', f), 'utf8')).join('\n').replace(/\\"/g, '"');
// the ref prefix (s_<tenant>__) is assembled at runtime, so prove the CLIENT data went in: its tenantId, Page value and section ids
const demo = JSON.parse(fs.readFileSync(path.join(APP, 'src', 'data', 'store.json'), 'utf8'));
const demoOnlyIds = demo.sections.map((s) => s.id).filter((id) => !data.sections.some((s) => s.id === id));
// the minifier may quote strings with ", ' or ` — match any
const has = (v) => new RegExp('[`"\']' + String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[`"\']').test(js);
const checks = [
  ['index.html carries the client store name', html.includes(esc(data.store.name))],
  [`bundle carries the client's tenantId "${clientId}" and Messenger Page "${data.store.messengerPage}"`, has(clientId) && has(data.store.messengerPage)],
  [`bundle carries the client's section ids (${data.sections.map((s) => s.id).join(', ')})`, data.sections.every((s) => has(s.id))],
  ['bundle does not carry demo-only section ids', demoOnlyIds.every((id) => !has(id))],
  ['bundle carries the client posters (not the demo-only ones)', data.posters.every((p) => has(p.text)) && demo.posters.filter((p) => !data.posters.some((q) => q.text === p.text)).every((p) => !has(p.text))],
  ['brand + fonts copied', fs.existsSync(path.join(OUT, 'brand')) && fs.existsSync(path.join(OUT, 'fonts'))],
  ['every product image present in the build', missing.length === 0],
];
let bad = 0;
for (const [name, ok] of checks) { console.log(`${ok ? '✅' : '❌'} ${name}`); if (!ok) bad++; }
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(OUT);
console.log(`dist-${clientId}: ${files.length} files, ${(files.reduce((n, f) => n + fs.statSync(f).size, 0) / 1024).toFixed(0)} KB`);
fs.rmSync(PUB, { recursive: true, force: true });
console.log(bad ? `BUILD DONE with ${bad} warning check(s)` : `BUILD OK → next: node tools/deploy-pages.mjs dry --dist dist-${clientId} --store clients/${clientId}/store.json --project store-${clientId}`);
process.exit(bad && missing.length === 0 ? 1 : 0);
