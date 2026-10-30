#!/usr/bin/env node
/**
 * prep-photos.mjs — turn real product photos into the square PNGs the 3D store uses (public/products/<sku>.png).
 *
 *   node tools/prep-photos.mjs <folder or files...> [--out public/products] [--size 512] [--max-kb 200]
 *                              [--fit cover|contain] [--dry]
 *
 * Rules
 *  - Each input file name must contain the SKU: "PJ-003.jpg", "pj-003 front.jpeg", "SR_01.png" → sr-001.png.
 *    Files whose name has no SKU, or a SKU that is not in src/data/store.json, are listed and skipped.
 *  - Output is square (default 512×512, same as the generated placeholders), EXIF-rotated, metadata stripped,
 *    PNG ≤ --max-kb (default 200 KB). Full-colour PNG first; if too big, palette PNG at quality 90→50; then a
 *    smaller square (448, 384). If it still does not fit the file is reported as FAILED and not written.
 *  - --fit cover (default): fill the square, smart-crop around the subject. --fit contain: whole photo on white.
 *  - store.json "image" paths already read /products/<sku>.png, so the JSON needs no edit when the file name
 *    matches the SKU. The script ends with the SKUs that still have no photo (placeholders stay for those).
 *  - --dry: compute everything, write nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const opt = { out: path.join(APP, 'public', 'products'), size: 512, maxKb: 200, fit: 'cover', dry: false };
const inputs = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--out') opt.out = path.resolve(argv[++i]);
  else if (a === '--size') opt.size = Number(argv[++i]);
  else if (a === '--max-kb') opt.maxKb = Number(argv[++i]);
  else if (a === '--fit') opt.fit = argv[++i];
  else if (a === '--dry') opt.dry = true;
  else inputs.push(a);
}
if (!inputs.length || !['cover', 'contain'].includes(opt.fit) || !(opt.size > 0) || !(opt.maxKb > 0)) {
  console.log('usage: node tools/prep-photos.mjs <folder or files...> [--out dir] [--size 512] [--max-kb 200] [--fit cover|contain] [--dry]');
  process.exit(2);
}

const store = JSON.parse(fs.readFileSync(path.join(APP, 'src', 'data', 'store.json'), 'utf8'));
const knownSkus = new Set(store.products.map((p) => p.sku.toLowerCase()));
const EXT = /\.(jpe?g|png|webp|avif|tiff?|gif)$/i;

/** "PJ-003 front.jpg" → "pj-003"; "SR_01.png" → "sr-001"; nothing found → null */
function skuFromName(name) {
  const m = /(^|[^a-z])(pj|sr|sh)[-_ ]?0*(\d{1,3})(?=$|[^0-9])/i.exec(path.parse(name).name);
  return m ? `${m[2].toLowerCase()}-${String(Number(m[3])).padStart(3, '0')}` : null;
}

const files = [];
for (const inp of inputs) {
  const p = path.resolve(inp);
  if (!fs.existsSync(p)) { console.error('not found:', inp); continue; }
  if (fs.statSync(p).isDirectory()) {
    for (const f of fs.readdirSync(p).sort()) if (EXT.test(f)) files.push(path.join(p, f));
  } else files.push(p);
}
if (!files.length) { console.error('no image files (jpg/png/webp/avif/tiff/gif) in the given paths'); process.exit(1); }

/** Try encodings until the PNG fits under maxBytes. Returns { buf, how } or null. */
async function encode(input, size, maxBytes) {
  const base = () => {
    let s = sharp(input).rotate();
    s = opt.fit === 'cover'
      ? s.resize(size, size, { fit: 'cover', position: sharp.strategy.attention })
      : s.resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).flatten({ background: '#ffffff' });
    return s;
  };
  const tries = [
    { how: `${size}px full-colour`, png: { compressionLevel: 9, adaptiveFiltering: true } },
    ...[90, 80, 70, 60, 50].map((q) => ({ how: `${size}px palette q${q}`, png: { compressionLevel: 9, palette: true, quality: q, effort: 10 } })),
  ];
  for (const t of tries) {
    const buf = await base().png(t.png).toBuffer();
    if (buf.length <= maxBytes) return { buf, how: t.how };
  }
  return null;
}

const rows = [];
const skipped = [];
const failed = [];
const done = new Set();
for (const file of files) {
  const name = path.basename(file);
  const sku = skuFromName(name);
  if (!sku) { skipped.push(`${name}  (no SKU in the file name)`); continue; }
  if (!knownSkus.has(sku)) { skipped.push(`${name}  (SKU ${sku} is not in store.json)`); continue; }
  if (done.has(sku)) { skipped.push(`${name}  (SKU ${sku} already taken by an earlier file)`); continue; }
  let result = null;
  let used = opt.size;
  for (const size of [opt.size, Math.round(opt.size * 0.875), Math.round(opt.size * 0.75)]) {
    result = await encode(file, size, opt.maxKb * 1024);
    if (result) { used = size; break; }
  }
  if (!result) { failed.push(`${name}  (still > ${opt.maxKb} KB at ${Math.round(opt.size * 0.75)}px)`); continue; }
  const outFile = path.join(opt.out, `${sku}.png`);
  if (!opt.dry) { fs.mkdirSync(opt.out, { recursive: true }); fs.writeFileSync(outFile, result.buf); }
  done.add(sku);
  rows.push({ name, sku, size: `${used}×${used}`, kb: (result.buf.length / 1024).toFixed(1), how: result.how, out: path.relative(APP, outFile) });
}

console.log(opt.dry ? 'DRY RUN — nothing written\n' : '');
for (const r of rows) console.log(`OK   ${r.name}  →  ${r.out}  ${r.size}  ${r.kb} KB  (${r.how})`);
for (const s of skipped) console.log(`SKIP ${s}`);
for (const f of failed) console.log(`FAIL ${f}`);

const haveNow = new Set(done);
if (fs.existsSync(opt.out)) for (const f of fs.readdirSync(opt.out)) if (/\.png$/i.test(f)) haveNow.add(f.replace(/\.png$/i, '').toLowerCase());
const missing = store.products.map((p) => p.sku).filter((s) => !haveNow.has(s.toLowerCase()));
console.log(`\n${rows.length} written, ${skipped.length} skipped, ${failed.length} failed. Photos now for ${done.size} SKU(s) from this run.`);
console.log(missing.length ? `SKUs with no PNG in ${path.relative(APP, opt.out)}: ${missing.join(', ')}` : `every SKU in store.json has a PNG in ${path.relative(APP, opt.out)}`);
process.exit(failed.length ? 1 : 0);
