#!/usr/bin/env node
/**
 * lighthouse-live.mjs — Lighthouse (mobile, simulated throttling) against a LIVE URL, same Chrome + flags as verify.mjs.
 *
 *   node tools/lighthouse-live.mjs [https://ghor-bazar-3d.pages.dev/]
 *
 * Two runs, like verify.mjs: the 3D view with GPU WebGL (?view=3d), and the default URL on a CPU-only (SwiftShader)
 * browser, which makes the site pick its 2D fallback by itself. Scores + core metrics go to docs/lighthouse-live.json.
 * Scores vary a few points between runs — that is normal for Lighthouse.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] || 'https://ghor-bazar-3d.pages.dev/').replace(/\/?$/, '/');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('No Chrome/Edge found');
const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const runs = [
  { key: '3d', label: '3D view, GPU WebGL (a phone with a GPU)', url: base + '?view=3d', flags: ['--headless=new', '--ignore-gpu-blocklist'] },
  { key: 'fallback', label: 'default URL on a CPU-only (SwiftShader) browser → auto 2D fallback', url: base, flags: ['--headless=new', ...GL_ARGS] },
];
const { default: lighthouse } = await import('lighthouse');
const chromeLauncher = await import('chrome-launcher');
const out = { base, fetchTime: new Date().toISOString(), runs: {} };
for (const run of runs) {
  const chrome = await chromeLauncher.launch({ chromePath: CHROME, chromeFlags: run.flags });
  try {
    const res = await lighthouse(run.url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices'] });
    const cats = res.lhr.categories;
    const a = res.lhr.audits;
    const pct = (c) => Math.round(c.score * 100);
    console.log(`\n### ${run.label}\n${run.url}`);
    console.log(`- Performance: ${pct(cats.performance)} · Accessibility: ${pct(cats.accessibility)} · Best practices: ${pct(cats['best-practices'])}`);
    console.log(`- FCP ${a['first-contentful-paint'].displayValue} · LCP ${a['largest-contentful-paint'].displayValue} · TBT ${a['total-blocking-time'].displayValue} · CLS ${a['cumulative-layout-shift'].displayValue} · SI ${a['speed-index'].displayValue}`);
    out.runs[run.key] = {
      url: run.url,
      scores: Object.fromEntries(Object.entries(cats).map(([k, c]) => [k, c.score])),
      metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'interactive'].map((k) => [k, a[k]?.numericValue])),
    };
  } catch (e) {
    console.log(`❌ Lighthouse run (${run.label}): ${e.message || e}`);
    out.runs[run.key] = { url: run.url, error: String(e.message || e) };
  } finally {
    await chrome.kill();
  }
}
writeFileSync(path.join(root, 'docs', 'lighthouse-live.json'), JSON.stringify(out, null, 2));
console.log('\n→ docs/lighthouse-live.json');
