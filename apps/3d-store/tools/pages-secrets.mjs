#!/usr/bin/env node
/**
 * pages-secrets.mjs — set the analytics Function's two secrets on a Cloudflare Pages project, values read by NAME and never printed.
 *   node tools/pages-secrets.mjs --project ghor-bazar-3d [--env FILE] [--dry]
 * Reads from process.env or the GTM Automation project .env (five folders up):
 *   CLOUDFLARE_PAGES_TOKEN (or CLOUDFLARE_API_TOKEN) + CLOUDFLARE_ACCOUNT_ID   → wrangler auth
 *   SUPABASE_URL                                                               → Pages secret SUPABASE_URL
 *   SUPABASE_SECRET_KEY                                                        → Pages secret SUPABASE_STORE_EVENTS_KEY (the Function's insert key)
 * Each secret is piped to `wrangler pages secret put <NAME> --project-name <project>` on stdin (production environment).
 * --dry only reports which names are present and their sha256 fingerprints.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WRANGLER = 'wrangler@3.114.9';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const PROJECT = arg('--project', 'ghor-bazar-3d');
const DRY = argv.includes('--dry');
const ENV_FILE = path.resolve(arg('--env', path.resolve(APP, '..', '..', '..', '..', '.env')));
if (!/^[a-z0-9][a-z0-9-]{0,57}$/.test(PROJECT)) { console.error('bad project name'); process.exit(2); }

const NAMES = ['CLOUDFLARE_PAGES_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
const env = {};
for (const k of NAMES) if (process.env[k]) env[k] = process.env[k];
if (fs.existsSync(ENV_FILE)) for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) { const m = new RegExp('^(' + NAMES.join('|') + ')=(.*)$').exec(line); if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
const TOKEN = env.CLOUDFLARE_PAGES_TOKEN || env.CLOUDFLARE_API_TOKEN;
const fp = (v) => crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8);
const SECRETS = { SUPABASE_URL: env.SUPABASE_URL, SUPABASE_STORE_EVENTS_KEY: env.SUPABASE_SECRET_KEY };
console.log(`project ${PROJECT} · auth ${TOKEN ? 'ok' : 'MISSING'} (${env.CLOUDFLARE_PAGES_TOKEN ? 'CLOUDFLARE_PAGES_TOKEN' : 'CLOUDFLARE_API_TOKEN'}) · account ${env.CLOUDFLARE_ACCOUNT_ID ? 'ok' : 'MISSING'}`);
for (const [k, v] of Object.entries(SECRETS)) console.log(`  ${k}: ${v ? 'present (fp ' + fp(v) + ', ' + String(v).length + ' chars)' : 'MISSING'}`);
if (!TOKEN || !env.CLOUDFLARE_ACCOUNT_ID || !SECRETS.SUPABASE_URL || !SECRETS.SUPABASE_STORE_EVENTS_KEY) { console.error('missing a value — nothing set'); process.exit(2); }
if (DRY) { console.log('dry — nothing set'); process.exit(0); }

let bad = 0;
for (const [name, value] of Object.entries(SECRETS)) {
  const args = ['--yes', WRANGLER, 'pages', 'secret', 'put', name, '--project-name', PROJECT];
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    input: value + '\n', encoding: 'utf8', shell: process.platform === 'win32', cwd: APP,
    env: Object.assign({}, process.env, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID, WRANGLER_SEND_METRICS: 'false', CI: '1' }),
  });
  const out = ((r.stdout || '') + (r.stderr || '')).split(value).join('<value>').split(TOKEN).join('<token>');
  const ok = r.status === 0 && /Success|✨/.test(out);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${out.split('\n').filter((l) => /Success|✨|error|Error/i.test(l)).join(' | ').slice(0, 200) || ('exit ' + r.status)}`);
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
