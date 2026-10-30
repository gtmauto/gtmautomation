#!/usr/bin/env node
/**
 * deploy-pages.mjs — publish apps/3d-store/dist/ to a Cloudflare Pages project (default name: ghor-bazar-3d).
 *
 *   node tools/deploy-pages.mjs dry    [--project NAME] [--env FILE]   # token check + does the project exist? writes nothing
 *   node tools/deploy-pages.mjs apply  [--project NAME] [--env FILE]   # create project if missing → wrangler pages deploy → prove live
 *   per-client store (step e): add --dist dist-<client> --store clients/<client>/store.json --project store-<client>
 *
 * Credentials are read by NAME only and never printed:
 *   1. process.env CLOUDFLARE_PAGES_TOKEN (or CLOUDFLARE_API_TOKEN) + CLOUDFLARE_ACCOUNT_ID, else
 *   2. an env file (--env FILE, default: the GTM Automation project .env five folders up) — same names.
 * A Pages-scoped token (Account · Cloudflare Pages · Edit) is what CLOUDFLARE_PAGES_TOKEN is for.
 *
 * Pre-flight: dist/index.html must exist and carry the store name from src/data/store.json (= a real `npm run build`).
 * Proof after apply: https://<project>.pages.dev/ equals dist/index.html byte-for-byte and the first hashed JS asset
 * returns 200. Custom domains are never touched here (that is a DNS decision for the owner).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WRANGLER = 'wrangler@3.114.9';
const argv = process.argv.slice(2);
const MODE = argv[0];
const arg = (k, d) => { const i = argv.indexOf(k); return i > 0 && argv[i + 1] ? argv[i + 1] : d; };
const PROJECT = arg('--project', process.env.PAGES_PROJECT || 'ghor-bazar-3d');
const DIST = path.resolve(APP, arg('--dist', 'dist'));            // a client build lives in dist-<client> (tools/build-client.mjs)
const STORE_JSON = path.resolve(APP, arg('--store', 'src/data/store.json'));   // the store.json that build came from (pre-flight + REPLACE_ME warning)
const ENV_FILE = path.resolve(arg('--env', path.resolve(APP, '..', '..', '..', '..', '.env')));
if (!['dry', 'apply'].includes(MODE)) { console.log('usage: dry | apply  [--project NAME] [--env FILE]'); process.exit(2); }
if (!/^[a-z0-9][a-z0-9-]{0,57}$/.test(PROJECT)) { console.error('project name must be lowercase letters, digits, dashes:', PROJECT); process.exit(2); }

/* ---- credentials (names only) ---- */
const env = {};
for (const k of ['CLOUDFLARE_PAGES_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) if (process.env[k]) env[k] = process.env[k];
let source = 'process.env';
if (!(env.CLOUDFLARE_PAGES_TOKEN || env.CLOUDFLARE_API_TOKEN) || !env.CLOUDFLARE_ACCOUNT_ID) {
  if (!fs.existsSync(ENV_FILE)) { console.error('no credentials in process.env and no env file at', ENV_FILE); process.exit(2); }
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = /^(CLOUDFLARE_PAGES_TOKEN|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)=(.*)$/.exec(line);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  source = 'env file ' + path.basename(ENV_FILE);
}
const TOKEN = env.CLOUDFLARE_PAGES_TOKEN || env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID;
console.log('credentials:', source, '| token var:', env.CLOUDFLARE_PAGES_TOKEN ? 'CLOUDFLARE_PAGES_TOKEN' : 'CLOUDFLARE_API_TOKEN');
if (!TOKEN || !ACCOUNT) { console.error('missing CLOUDFLARE_PAGES_TOKEN/CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID'); process.exit(2); }
const redact = (s) => String(s).split(TOKEN).join('<token>').split(ACCOUNT).join('<account>');

/* ---- pre-flight on dist ---- */
const store = JSON.parse(fs.readFileSync(STORE_JSON, 'utf8')).store;
const indexPath = path.join(DIST, 'index.html');
if (!fs.existsSync(indexPath)) { console.error(`${path.relative(APP, indexPath)} missing — run \`npm run build\` (or \`node tools/build-client.mjs <client>\`) first`); process.exit(1); }
const dist = fs.readFileSync(indexPath);
const html = dist.toString('utf8');
if (!html.includes(store.name)) { console.error('dist/index.html does not carry the store name from store.json — stale build? run `npm run build`'); process.exit(1); }
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const distFiles = walk(DIST);
const distBytes = distFiles.reduce((n, f) => n + fs.statSync(f).size, 0);
console.log(`dist ok: ${distFiles.length} files, ${(distBytes / 1024).toFixed(0)} KB, index.html ${dist.length} bytes, built ${fs.statSync(indexPath).mtime.toISOString()}`);
if (store.messengerPage === 'REPLACE_ME' || store.whatsappNumber === 'REPLACE_ME') console.log('WARNING: store.json still has REPLACE_ME — the Messenger/WhatsApp order buttons will not reach anyone on the live site');
const firstJs = (/(?:src|href)="(\/assets\/[^"]+\.js)"/.exec(html) || [])[1];

/* ---- Cloudflare API ---- */
const cf = async (p, init) => {
  const r = await fetch('https://api.cloudflare.com/client/v4' + p, { ...init, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', ...(init && init.headers) } });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, ok: body.success === true, result: body.result, errors: (body.errors || []).map((e) => e.code + ' ' + e.message) };
};
const verify = await cf('/user/tokens/verify');
console.log('token:', verify.ok ? verify.result.status : 'INVALID ' + redact(verify.errors.join('; ')));
if (!verify.ok) process.exit(1);
const list = await cf(`/accounts/${ACCOUNT}/pages/projects`);
if (!list.ok) { console.error('cannot list Pages projects (token lacks Pages read?):', redact(list.errors.join('; '))); process.exit(1); }
let project = list.result.find((p) => p.name === PROJECT);
console.log('account has', list.result.length, 'Pages project(s):', list.result.map((p) => p.name).join(', ') || '—');
if (project) {
  console.log(`project "${PROJECT}": EXISTS | production branch: ${project.production_branch} | domains: ${(project.domains || []).join(', ') || '—'}`);
  console.log('latest deployment:', project.latest_deployment ? project.latest_deployment.id + ' @ ' + project.latest_deployment.created_on : '—');
} else console.log(`project "${PROJECT}": does not exist yet → apply will create it (production branch "main", URL https://${PROJECT}.pages.dev)`);
if (MODE === 'dry') { console.log('dry run — nothing created, nothing deployed'); process.exit(0); }

/* ---- apply ---- */
if (!project) {
  const made = await cf(`/accounts/${ACCOUNT}/pages/projects`, { method: 'POST', body: JSON.stringify({ name: PROJECT, production_branch: 'main' }) });
  if (!made.ok) { console.error('could not create the Pages project:', redact(made.errors.join('; '))); process.exit(1); }
  project = made.result;
  console.log('created project', project.name, '| subdomain', project.subdomain);
}
const args = ['--yes', WRANGLER, 'pages', 'deploy', DIST, '--project-name', PROJECT, '--branch', project.production_branch || 'main', '--commit-dirty=true', '--commit-message', '3d-store ' + new Date().toISOString()];
console.log('running: npx', args.filter((a) => a !== DIST).join(' '), '<dist>');
/* Windows needs shell:true for npx.cmd, and a shell splits on spaces ("GTM Automation", the commit message) — quote those */
const shellArgs = process.platform === 'win32' ? args.map((a) => (/\s/.test(a) ? '"' + a + '"' : a)) : args;
const run = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', shellArgs, {
  stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', cwd: APP,
  env: Object.assign({}, process.env, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, WRANGLER_SEND_METRICS: 'false', CI: '1' }),
});
const out = redact((run.stdout || '').toString() + (run.stderr || '').toString());
console.log(out.split(/\r?\n/).filter((l) => /Uploading|Deployment complete|Success|error|Error|https:\/\//.test(l)).join('\n'));
if (run.status !== 0) { console.error('wrangler exited', run.status, run.error ? String(run.error) : ''); console.error(out.split(/\r?\n/).slice(-40).join('\n')); process.exit(1); }

/* ---- proof: the production URL serves exactly dist/index.html, and the first hashed JS asset is reachable ---- */
const HOST = `${PROJECT}.pages.dev`;
let live = null;
for (let i = 0; i < 6 && !live; i++) {
  const r = await fetch(`https://${HOST}/?v=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
  if (r && r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.equals(dist)) live = b; else console.log(`live differs (${b.length} bytes) — waiting 10 s`); }
  else console.log('live not reachable yet (' + (r ? r.status : 'no response') + ') — waiting 10 s');
  if (!live) await new Promise((res) => setTimeout(res, 10000));
}
let assetOk = null;
if (firstJs) { const a = await fetch(`https://${HOST}${firstJs}`, { cache: 'no-store' }).catch(() => null); assetOk = !!(a && a.ok); }
console.log(live ? `PROOF: https://${HOST}/ == dist/index.html byte-for-byte (${live.length} bytes)` : `WARNING: https://${HOST}/ still differs from dist after 60 s — check the Pages dashboard`);
if (firstJs) console.log(assetOk ? `PROOF: https://${HOST}${firstJs} → 200` : `WARNING: https://${HOST}${firstJs} not reachable`);
process.exit(live && assetOk !== false ? 0 : 1);
