// Acceptance checks for the Phase 1 demo. Run after `npm run build`:  npm run verify
// Uses the locally installed Google Chrome through playwright-core (no browser download) and Lighthouse.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const shots = path.join(root, 'docs', 'screenshots');
mkdirSync(shots, { recursive: true });
const data = JSON.parse(readFileSync(path.join(root, 'src', 'data', 'store.json'), 'utf8'));
const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const URL3D = `${URL}?view=3d`; // headless Chrome renders WebGL on the CPU (SwiftShader) → the site would pick the 2D view by itself
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('No Chrome/Edge found');
const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const report = [];
const log = (s) => {
  console.log(s);
  report.push(s);
};
const check = (ok, label, detail = '') => log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);

// ---- dist size ------------------------------------------------------------------------
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f)) : [path.join(d, f)]));
const files = walk(dist);
const total = files.reduce((s, f) => s + statSync(f).size, 0);
log(`\n## Build size\n`);
check(total < 3 * 1024 * 1024, `dist/ total ${(total / 1024).toFixed(0)} KB (${files.length} files) < 3 MB`);
for (const f of files.filter((x) => x.includes('assets')).sort()) log(`- ${path.relative(dist, f)}: ${(statSync(f).size / 1024).toFixed(1)} KB`);

// ---- preview server ----------------------------------------------------------------------
// tiny static server with gzip (Cloudflare Pages serves brotli/gzip; vite preview sends files uncompressed)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const gzCache = new Map();
const server = createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/') u = '/index.html';
  const fp = path.join(dist, u);
  if (!fp.startsWith(dist) || !existsSync(fp) || statSync(fp).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  const ext = path.extname(fp);
  const type = MIME[ext] || 'application/octet-stream';
  const body = readFileSync(fp);
  const gzOk = /\b(gzip)\b/.test(String(req.headers['accept-encoding'] || '')) && /\.(html|js|css|json|svg)$/.test(fp);
  const headers = { 'Content-Type': type, 'Cache-Control': u.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300' };
  if (gzOk) {
    let gz = gzCache.get(fp);
    if (!gz) gzCache.set(fp, (gz = gzipSync(body, { level: 6 })));
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length });
    return res.end(gz);
  }
  res.writeHead(200, { ...headers, 'Content-Length': body.length });
  res.end(body);
}).listen(PORT, '127.0.0.1');
const waitPort = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('preview server did not start');
};
await waitPort();

const errors = [];
const attachErrorCapture = (page, tag) => {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`[${tag}] requestfailed: ${r.url()} ${r.failure()?.errorText}`));
};

try {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: GL_ARGS });

  // ---- 1. loading screen → glide → hero, Fast 3G ---------------------------------------
  log(`\n## Loading on simulated Fast 3G (1.6 Mbps down, 750 kbps up, 150 ms RTT)\n`);
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    attachErrorCapture(page, 'fast3g');
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    const t0 = Date.now();
    await page.goto(URL3D, { waitUntil: 'commit' });
    await page.waitForSelector('#loader', { state: 'attached' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(shots, '1-loading.png') });
    await page.waitForFunction(() => performance.getEntriesByName('gtm:hero').length > 0, null, { timeout: 30000 });
    const marks = await page.evaluate(() => ({
      firstPaint: performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint')?.startTime ?? null,
      loaderHidden: performance.getEntriesByName('gtm:loader-hidden')[0]?.startTime ?? null,
      hero: performance.getEntriesByName('gtm:hero')[0]?.startTime ?? null,
    }));
    const xfer = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => `${r.name.split('/').pop()}: ${(r.transferSize / 1024).toFixed(0)} KB`));
    log(`- transferred (gzip): ${xfer.filter((x) => /\.(js|css|woff2)/.test(x)).join(' · ')}`);
    log(`- wall clock to hero: ${Date.now() - t0} ms`);
    log(`- first contentful paint: ${marks.firstPaint?.toFixed(0)} ms`);
    log(`- loading screen hidden (glide starts): ${marks.loaderHidden?.toFixed(0)} ms`);
    log(`- hero wall reached (glide done): ${marks.hero?.toFixed(0)} ms`);
    check(marks.firstPaint !== null && marks.firstPaint < 2500, 'first paint < 2.5 s');
    // Brief target was < 3 s. Owner decision 2026-10-30: keep the 2 s glide and accept ≈ 5 s on Fast 3G (measured 4.9–5.2 s).
    // The gate now catches regressions only; the measured value stays in the report.
    check(marks.hero !== null && marks.hero < 6500, 'loading → glide → hero < 6.5 s on Fast 3G (brief asked < 3 s; owner accepted ≈ 5 s with the 2 s glide, 2026-10-30)', `${marks.hero?.toFixed(0)} ms`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(shots, '2-hero-wall.png') });
    const coach = await page.isVisible('#coach');
    check(coach, 'coach mark visible on first visit');
    await ctx.close();
  }

  // ---- 2. pills, 18 products, panel data, CTA URLs, 360 px ------------------------------
  log(`\n## Interaction checks (360 × 740, touch)\n`);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  attachErrorCapture(page, 'interact');
  await page.goto(URL3D, { waitUntil: 'load' });
  await page.waitForFunction(() => performance.getEntriesByName('gtm:hero').length > 0, null, { timeout: 30000 });
  await page.click('#coachOk');
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
  check(noHScroll, '3D view: no horizontal scroll at 360 px');

  const camAfter = {};
  for (const sec of data.sections) {
    const before = await page.evaluate(() => window.__gtm3d.camPos());
    await page.click(`#pills button:has-text("${sec.label}")`);
    await page.waitForTimeout(1100);
    const after = await page.evaluate(() => window.__gtm3d.camPos());
    const active = await page.getAttribute(`#pills button:has-text("${sec.label}")`, 'aria-current');
    const dir = await page.evaluate(() => window.__gtm3d.camDir());
    const want = { north: [0, 0, -1], east: [1, 0, 0], west: [-1, 0, 0], south: [0, 0, 1] }[sec.wall];
    const dot = dir[0] * want[0] + dir[1] * want[1] + dir[2] * want[2];
    camAfter[sec.id] = after.map((v) => v.toFixed(2)).join(', ');
    void before;
    check(active === 'true' && dot > 0.9, `pill "${sec.label}" turns the camera to the ${sec.wall} wall`, `camera (${camAfter[sec.id]}), facing dot=${dot.toFixed(2)}`);
  }
  await page.click('#pills button:has-text("Store")');
  await page.waitForTimeout(1100);
  check((await page.getAttribute('#pills button:has-text("Store")', 'aria-current')) === 'true', 'pill "Store" overview');

  const ctaLog = [];
  let productsOk = 0;
  let focusShot = false;
  for (const sec of data.sections) {
    await page.click(`#pills button:has-text("${sec.label}")`);
    await page.waitForTimeout(1100);
    for (const p of data.products.filter((x) => x.section === sec.id)) {
      // product may be off-screen on a narrow phone → look-around with arrow keys first
      let pos = await page.evaluate((sku) => window.__gtm3d.screenPos(sku), p.sku);
      for (let i = 0; i < 12 && pos && (!pos.visible || pos.y < 70 || pos.y > 640); i++) {
        await page.focus('#scene');
        await page.keyboard.press(pos.x < 180 ? 'ArrowLeft' : 'ArrowRight');
        await page.waitForTimeout(60);
        pos = await page.evaluate((sku) => window.__gtm3d.screenPos(sku), p.sku);
      }
      if (!pos || !pos.visible) {
        check(false, `product ${p.sku} on screen`, JSON.stringify(pos));
        continue;
      }
      await page.mouse.click(pos.x, pos.y);
      await page.waitForSelector('#panel:not([hidden])', { timeout: 3000 });
      await page.waitForTimeout(150);
      const got = await page.evaluate(() => ({
        name: document.querySelector('#panelTitle')?.textContent,
        price: document.querySelector('#panel .price')?.textContent,
        sizes: [...document.querySelectorAll('#panel .size')].map((b) => b.textContent),
        m: document.querySelector('#panel a.primary')?.href,
        w: document.querySelector('#panel a.secondary')?.href,
        thumbs: document.querySelectorAll('#strip .thumb').length,
      }));
      const ok = got.name === p.name && got.sizes.join() === p.sizes.join() && got.m?.includes(`ref=${encodeURIComponent(p.sku)}`) && got.thumbs === 6;
      if (ok) productsOk++;
      else check(false, `product ${p.sku} panel data`, JSON.stringify(got));
      ctaLog.push(`- ${p.sku} ${p.name}: messenger → ${got.m}`);
      if (p.sku === 'PJ-002') ctaLog.push(`  whatsapp → ${decodeURIComponent(got.w ?? '')}`);
      if (!focusShot) {
        await page.screenshot({ path: path.join(shots, '3-focus-panel.png') });
        focusShot = true;
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(950);
    }
  }
  check(productsOk === data.products.length, `all ${data.products.length} products clickable, panel shows JSON data, strip has 6 thumbs`, `${productsOk}/${data.products.length}`);

  // thumbnail swap
  {
    await page.click('#pills button:has-text("শাড়ি")');
    await page.waitForTimeout(1100);
    const pos = await page.evaluate(() => window.__gtm3d.screenPos('SR-002'));
    await page.mouse.click(pos.x, pos.y);
    await page.waitForSelector('#panel:not([hidden])');
    await page.click('#strip .thumb:nth-child(5)');
    await page.waitForTimeout(300);
    const name = await page.textContent('#panelTitle');
    check(name === data.products.find((p) => p.sku === 'SR-005').name, 'thumbnail strip swaps product without leaving focus', name);
    // size chip changes the ref
    await page.keyboard.press('Escape');
    await page.waitForTimeout(950);
    await page.click('#pills button:has-text("পাঞ্জাবি")');
    await page.waitForTimeout(1100);
    const pp = await page.evaluate(() => window.__gtm3d.screenPos('PJ-003'));
    await page.mouse.click(pp.x, pp.y);
    await page.waitForSelector('#panel:not([hidden])');
    await page.click('#panel .size:has-text("XL")');
    const href = await page.getAttribute('#panel a.primary', 'href');
    check(href?.includes('ref=PJ-003-XL'), 'size chip is added to the Messenger ref', href);
    // cart
    await page.click('#panel .btn.tertiary');
    await page.waitForTimeout(200);
    const count = await page.textContent('#cartCount');
    check(count === '১', 'add to cart updates the badge (Bangla digit)', count);
    await page.keyboard.press('Escape');
    await page.click('#cartBtn');
    await page.waitForSelector('#cartSheet:not([hidden])');
    const cartLinks = await page.evaluate(() => [...document.querySelectorAll('#cartSheet a')].map((a) => a.href));
    ctaLog.push(`- CART messenger → ${cartLinks[0]}`);
    ctaLog.push(`  CART whatsapp → ${decodeURIComponent(cartLinks[1] ?? '')}`);
    check(cartLinks[0]?.includes('ref=CART_PJ-003x1-XL'), 'cart Messenger ref carries sku × qty + size', cartLinks[0]);
    await page.keyboard.press('Escape');
  }

  // toggle → 2D fallback
  await page.click('#viewToggle');
  await page.waitForSelector('#fallback:not([hidden])');
  const fb = await page.evaluate(() => ({
    cards: document.querySelectorAll('.fb-card').length,
    ctas: document.querySelectorAll('.fb-card a.primary').length + document.querySelectorAll('.fb-card a.secondary').length,
    noH: document.documentElement.scrollWidth <= window.innerWidth,
    canvasHidden: getComputedStyle(document.getElementById('scene')).display === 'none',
    ev: window.dataLayer.filter((e) => e.event === 'fallback_used').map((e) => e.reason),
  }));
  check(fb.cards === 18 && fb.ctas === 36, 'toggle → fallback shows 18 products with 36 chat CTAs');
  check(fb.noH, 'fallback: no horizontal scroll at 360 px');
  check(fb.canvasHidden && fb.ev.includes('toggle'), 'fallback hides the canvas and fires fallback_used');
  await page.screenshot({ path: path.join(shots, '4-fallback.png') });
  await page.click('#viewToggle');
  await page.waitForTimeout(300);
  check(await page.isVisible('#pills'), 'toggle back to 3D works');
  const events = await page.evaluate(() => [...new Set(window.dataLayer.map((e) => e.event))]);
  log(`- dataLayer events seen: ${events.join(', ')}`);
  await ctx.close();
  await browser.close();

  log(`\n## CTA URLs (placeholders expected until messengerPage / whatsappNumber are filled)\n`);
  for (const l of ctaLog) log(l);

  // ---- 3. WebGL disabled → auto fallback -----------------------------------------------
  log(`\n## WebGL disabled\n`);
  {
    const b2 = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-3d-apis'] });
    const c2 = await b2.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    const p2 = await c2.newPage();
    attachErrorCapture(p2, 'nowebgl');
    await p2.goto(URL, { waitUntil: 'load' });
    await p2.waitForSelector('#fallback:not([hidden])', { timeout: 10000 });
    const r = await p2.evaluate(() => ({
      cards: document.querySelectorAll('.fb-card').length,
      reason: window.dataLayer.find((e) => e.event === 'fallback_used')?.reason,
      toggleHidden: document.getElementById('viewToggle').hidden,
      note: document.querySelector('.fb-note')?.textContent,
    }));
    check(r.cards === 18 && r.reason === 'no_webgl', 'auto-switch to fallback when WebGL is unavailable', `reason=${r.reason}, note="${r.note}", 3D toggle hidden=${r.toggleHidden}`);
    await b2.close();
  }

  // ---- 4. console errors ------------------------------------------------------------------
  log(`\n## Console\n`);
  const real = errors.filter((e) => !e.includes('favicon'));
  check(real.length === 0, 'no console errors / page errors / failed requests', real.length ? '\n' + real.join('\n') : '');

  // ---- 5. Lighthouse (mobile) --------------------------------------------------------------
  log(`\n## Lighthouse (mobile, simulated throttling)\n`);
  const lhRuns = [
    { label: '3D view, GPU WebGL (a phone with a GPU)', url: URL3D, flags: ['--headless=new', '--ignore-gpu-blocklist'], file: 'lighthouse-mobile-3d.json', gate: true },
    { label: 'default URL on a CPU-only (SwiftShader) browser → auto 2D fallback', url: URL, flags: ['--headless=new', ...GL_ARGS], file: 'lighthouse-mobile-fallback.json', gate: false },
  ];
  for (const run of lhRuns) {
    try {
      const { default: lighthouse } = await import('lighthouse');
      const chromeLauncher = await import('chrome-launcher');
      const chrome = await chromeLauncher.launch({ chromePath: CHROME, chromeFlags: run.flags });
      const res = await lighthouse(run.url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices'] });
      await chrome.kill();
      const cats = res.lhr.categories;
      const perf = Math.round(cats.performance.score * 100);
      const a = res.lhr.audits;
      log(`\n### ${run.label}\n`);
      log(`- Performance: ${perf} · Accessibility: ${Math.round(cats.accessibility.score * 100)} · Best practices: ${Math.round(cats['best-practices'].score * 100)}`);
      log(`- FCP ${a['first-contentful-paint'].displayValue} · LCP ${a['largest-contentful-paint'].displayValue} · TBT ${a['total-blocking-time'].displayValue} · CLS ${a['cumulative-layout-shift'].displayValue} · SI ${a['speed-index'].displayValue}`);
      if (run.gate) check(perf >= 80, 'Lighthouse mobile Performance ≥ 80 (3D view)', String(perf));
      writeFileSync(path.join(root, 'docs', run.file), JSON.stringify({ url: run.url, fetchTime: res.lhr.fetchTime, scores: Object.fromEntries(Object.entries(cats).map(([k, c]) => [k, c.score])), metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'interactive'].map((k) => [k, a[k]?.numericValue])) }, null, 2));
    } catch (e) {
      check(false, `Lighthouse run (${run.label})`, String(e.message || e));
    }
  }

  // ---- 6. secrets grep -------------------------------------------------------------------------
  log(`\n## Secrets scan\n`);
  let grep = '';
  try {
    grep = execSync('git grep -i -E "token|secret|password|key=" -- . ":!package-lock.json" ":!docs/market-analysis.md"', { cwd: root, encoding: 'utf8' });
  } catch (e) {
    grep = e.stdout || '';
  }
  const hits = grep.split('\n').filter(Boolean);
  // tools/deploy-pages.mjs names CLOUDFLARE_* env vars and says "token" in its comments; it never holds a value — the value scan below still covers it.
  const sensitive = hits.filter((h) => !/(README|docs\/|verify\.mjs|tools\/deploy-pages\.mjs|keyboard|KeyboardEvent|e\.key|\.key ===|keydown|key: |localStorage|const key|cache)/.test(h));
  check(sensitive.length === 0, `git grep token|secret|password|key= → ${hits.length} lines, ${sensitive.length} sensitive`, sensitive.join('\n'));
  // value-shaped secrets anywhere in tracked files (Meta EAA…, OpenAI sk-…, GitHub ghp_/github_pat_, AWS AKIA…, JWT, PEM, Google AIza…, Telegram bot token)
  let vals = '';
  try {
    vals = execSync('git grep -E "(EAA[A-Za-z0-9]{40,}|sk-[A-Za-z0-9_-]{24,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\\.eyJ|-----BEGIN [A-Z ]*PRIVATE KEY|AIza[0-9A-Za-z_-]{35}|[0-9]{8,10}:AA[A-Za-z0-9_-]{30,})" -- . ":!package-lock.json"', { cwd: root, encoding: 'utf8' });
  } catch (e) {
    vals = e.stdout || '';
  }
  const valHits = vals.split('\n').filter(Boolean);
  check(valHits.length === 0, `token-shaped VALUES in tracked files → ${valHits.length}`, valHits.join('\n'));
} finally {
  server.close();
}

writeFileSync(path.join(root, 'docs', 'VERIFY-REPORT.md'), `# Phase 1 verification report\n\nGenerated ${new Date().toISOString()} by \`npm run verify\` (Chrome headless + Lighthouse on the built \`dist/\`).\n${report.join('\n')}\n`);
console.log('\nreport → docs/VERIFY-REPORT.md');
