// Generates original placeholder product images (SVG -> PNG, transparent background)
// for every product in src/data/store.json. Run: npm run gen:images
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(root, '..', 'src', 'data', 'store.json');
const outDir = path.join(root, '..', 'public', 'products');
mkdirSync(outDir, { recursive: true });
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

// one distinct colour per product (keyed by sku)
const COLORS = {
  'PJ-001': ['#F3EEE4', '#D9CFBE'],
  'PJ-002': ['#1F3A66', '#132646'],
  'PJ-003': ['#7A1F33', '#5A1424'],
  'PJ-004': ['#6B7A3A', '#4E5A28'],
  'PJ-005': ['#262626', '#111111'],
  'PJ-006': ['#8FBFE0', '#6A9CC0'],
  'SR-001': ['#C0262D', '#8E1A20'],
  'SR-002': ['#1F8A86', '#15615E'],
  'SR-003': ['#D9A21B', '#A87A10'],
  'SR-004': ['#E58AA8', '#C45F82'],
  'SR-005': ['#5B2C83', '#3E1B5C'],
  'SR-006': ['#2E8B57', '#1F6340'],
  'SH-001': ['#8B5A2B', '#5E3C1B'],
  'SH-002': ['#1E1E1E', '#000000'],
  'SH-003': ['#F6F6F6', '#CFCFCF'],
  'SH-004': ['#C8924A', '#9A6A2E'],
  'SH-005': ['#E8705B', '#B8503E'],
  'SH-006': ['#2F6BD6', '#1F4A99'],
};

const shadow = `<ellipse cx="256" cy="470" rx="150" ry="16" fill="#000" opacity=".12"/>`;

function panjabi(sku, [c, d]) {
  const extra =
    sku === 'PJ-002'
      ? `<g fill="#E8C66B"><circle cx="256" cy="200" r="4"/><circle cx="256" cy="230" r="4"/><circle cx="256" cy="260" r="4"/><circle cx="256" cy="290" r="4"/><path d="M226 160q30 20 60 0" stroke="#E8C66B" stroke-width="3" fill="none"/></g>`
      : sku === 'PJ-005'
        ? `<g fill="#B8B8B8" opacity=".55">${Array.from({ length: 24 }, (_, i) => `<circle cx="${170 + (i % 6) * 34}" cy="${210 + Math.floor(i / 6) * 50}" r="5"/>`).join('')}</g>`
        : sku === 'PJ-006'
          ? `<g stroke="#4F7FA6" stroke-width="2" opacity=".6">${Array.from({ length: 7 }, (_, i) => `<line x1="${160 + i * 32}" y1="150" x2="${160 + i * 32}" y2="440"/>`).join('')}${Array.from({ length: 8 }, (_, i) => `<line x1="150" y1="${160 + i * 40}" x2="362" y2="${160 + i * 40}"/>`).join('')}</g>`
          : sku === 'PJ-003'
            ? `<path d="M150 150 L362 150 L362 440 L150 440Z" fill="url(#sheen)"/>`
            : '';
  return `
  <defs><linearGradient id="sheen" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></linearGradient></defs>
  ${shadow}
  <!-- hanger -->
  <path d="M256 40 q-14 0 -14 14 q0 10 14 16 v10" fill="none" stroke="#8C8C8C" stroke-width="5" stroke-linecap="round"/>
  <path d="M256 80 L120 130 L392 130 Z" fill="none" stroke="#8C8C8C" stroke-width="6" stroke-linejoin="round"/>
  <!-- body -->
  <path d="M190 128 L150 150 L120 250 L156 262 L150 450 L362 450 L356 262 L392 250 L362 150 L322 128 Q256 150 190 128Z" fill="${c}"/>
  <!-- sleeves shading -->
  <path d="M150 150 L120 250 L156 262 L166 160Z" fill="${d}" opacity=".55"/>
  <path d="M362 150 L392 250 L356 262 L346 160Z" fill="${d}" opacity=".55"/>
  <!-- collar + placket -->
  <path d="M232 132 q24 16 48 0 v14 q-24 14 -48 0Z" fill="${d}"/>
  <line x1="256" y1="150" x2="256" y2="330" stroke="${d}" stroke-width="3"/>
  ${extra}`;
}

function saree(sku, [c, d]) {
  const pattern =
    sku === 'SR-001'
      ? `<g fill="#F2C94C">${Array.from({ length: 10 }, (_, i) => `<path d="M${120 + i * 28} 300 l10 -12 l10 12 l-10 12Z"/>`).join('')}</g>`
      : sku === 'SR-002'
        ? `<g stroke="#F4F0E6" stroke-width="3" opacity=".8">${Array.from({ length: 9 }, (_, i) => `<line x1="110" y1="${215 + i * 12}" x2="402" y2="${215 + i * 12}"/>`).join('')}</g>`
        : sku === 'SR-005' || sku === 'SR-006'
          ? `<rect x="104" y="196" width="304" height="150" rx="16" fill="url(#silk)"/>`
          : sku === 'SR-004'
            ? `<g fill="#fff" opacity=".7">${Array.from({ length: 18 }, (_, i) => `<circle cx="${130 + (i % 6) * 50}" cy="${225 + Math.floor(i / 6) * 40}" r="6"/>`).join('')}</g>`
            : '';
  return `
  <defs><linearGradient id="silk" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs>
  ${shadow}
  <!-- drape rising from the fold -->
  <path d="M150 200 C 140 120, 250 90, 300 140 C 340 180, 380 150, 400 110 L 408 200 Z" fill="${c}"/>
  <path d="M150 200 C 140 120, 250 90, 300 140 C 340 180, 380 150, 400 110" fill="none" stroke="${d}" stroke-width="4" opacity=".6"/>
  <!-- folded stack -->
  <rect x="104" y="196" width="304" height="150" rx="16" fill="${c}"/>
  <rect x="104" y="346" width="304" height="28" rx="6" fill="${d}"/>
  <rect x="104" y="374" width="304" height="40" rx="10" fill="${c}"/>
  <rect x="104" y="414" width="304" height="26" rx="8" fill="${d}"/>
  ${pattern}
  <!-- border -->
  <rect x="104" y="336" width="304" height="10" fill="#E8C66B" opacity=".9"/>`;
}

function shoe(sku, [c, d]) {
  const base = `
  ${shadow}
  <!-- sole -->
  <path d="M70 380 Q60 420 110 424 L420 424 Q460 420 450 390 L440 372 L80 372Z" fill="#3A2F28"/>`;
  switch (sku) {
    case 'SH-001': // leather sandal: sole + two straps
      return `${base}
      <path d="M90 372 L430 372 L438 350 L82 350Z" fill="${d}"/>
      <path d="M150 350 C 170 280, 250 280, 270 350Z" fill="${c}"/>
      <path d="M300 350 C 320 300, 390 300, 410 350Z" fill="${c}"/>`;
    case 'SH-002': // formal shoe
      return `${base}
      <path d="M80 372 L90 300 Q110 250 170 240 L300 230 Q330 230 350 250 L440 320 L445 372Z" fill="${c}"/>
      <path d="M300 230 L350 250 L380 290 Q340 300 300 285Z" fill="${d}"/>
      <path d="M160 300 L250 292" stroke="#777" stroke-width="3"/><path d="M160 318 L250 310" stroke="#777" stroke-width="3"/>`;
    case 'SH-003': // sneaker
      return `${base}
      <path d="M78 372 L88 290 Q110 230 190 215 L300 200 Q350 200 380 240 L445 320 L448 372Z" fill="${c}"/>
      <path d="M78 372 L448 372 L446 350 L82 350Z" fill="${d}" opacity=".6"/>
      <path d="M140 300 L260 260" stroke="${d}" stroke-width="18" stroke-linecap="round" opacity=".9"/>
      <path d="M300 205 L330 300" stroke="${d}" stroke-width="4"/><path d="M330 205 L355 300" stroke="${d}" stroke-width="4"/>`;
    case 'SH-004': // nagra: curled pointy toe
      return `${base}
      <path d="M80 372 L92 320 Q130 260 220 250 L360 245 Q440 240 470 190 Q480 230 450 300 L445 372Z" fill="${c}"/>
      <path d="M360 245 Q440 240 470 190 Q470 250 430 290Z" fill="${d}"/>
      <path d="M120 320 Q250 270 400 290" stroke="#E8C66B" stroke-width="5" fill="none"/>`;
    case 'SH-005': // ladies flat sandal
      return `${base}
      <path d="M90 372 L430 372 L436 356 L84 356Z" fill="${d}"/>
      <path d="M130 356 C 150 300, 210 300, 230 356Z" fill="${c}"/>
      <path d="M260 356 C 300 310, 380 320, 420 356Z" fill="${c}"/>
      <circle cx="235" cy="330" r="10" fill="#E8C66B"/>`;
    default: // running shoe
      return `${base}
      <path d="M76 372 L86 300 Q110 240 200 225 L310 205 Q360 200 395 240 L450 330 L452 372Z" fill="${c}"/>
      <path d="M76 372 L452 372 L450 345 L80 345Z" fill="#F2F2F2"/>
      <path d="M120 310 Q220 240 330 300" stroke="${d}" stroke-width="16" fill="none" stroke-linecap="round"/>
      <path d="M310 215 L345 300" stroke="#fff" stroke-width="4" opacity=".8"/>`;
  }
}

function svgFor(p) {
  const colors = COLORS[p.sku] ?? ['#999', '#666'];
  const body = p.section === 'panjabi' ? panjabi(p.sku, colors) : p.section === 'saree' ? saree(p.sku, colors) : shoe(p.sku, colors);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${body}</svg>`;
}

let total = 0;
for (const p of data.products) {
  const svg = svgFor(p);
  const file = path.join(outDir, path.basename(p.image));
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  writeFileSync(file, png);
  total += png.length;
  console.log(`${path.basename(file)}  ${(png.length / 1024).toFixed(1)} KB`);
}
console.log(`total ${(total / 1024).toFixed(1)} KB for ${data.products.length} images`);
