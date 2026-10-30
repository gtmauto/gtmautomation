import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Per-client builds (Phase 2 step e, tools/build-client.mjs): three env vars pick another store without touching the source.
 *   STORE_DIR        folder holding store.json (default src/data)            → HTML injection + the `./data/store.json` import
 *   STORE_PUBLIC_DIR static folder (default public; a client build assembles brand + fonts + that client's products)
 *   STORE_OUT_DIR    build output (default dist; a client build uses dist-<client>)
 */
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = path.resolve(ROOT, process.env.STORE_DIR || 'src/data');
const STORE_JSON = path.join(STORE_DIR, 'store.json');
const STORE_PUBLIC_DIR = path.resolve(ROOT, process.env.STORE_PUBLIC_DIR || 'public');
const STORE_OUT_DIR = path.resolve(ROOT, process.env.STORE_OUT_DIR || 'dist');

/**
 * Injects store name / tagline / colour / logo from store.json into index.html
 * ({{STORE_NAME}} etc.) so the loading screen is branded before any JS runs and nothing is hardcoded.
 */
function storeHtml(): Plugin {
  const json = JSON.parse(readFileSync(STORE_JSON, 'utf8'));
  const store = json.store as Record<string, string>;
  const map: Record<string, string> = {
    STORE_NAME: store.name,
    STORE_TAGLINE: store.tagline,
    STORE_COLOR: store.primaryColor,
    STORE_LOGO: store.logo,
    STORE_ID: store.id,
  };
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  return {
    name: 'gtm-store-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(/\{\{(STORE_[A-Z]+)\}\}/g, (_, k: string) => esc(map[k] ?? ''));
      },
    },
  };
}

/**
 * Inline <head> script, run right after first paint: the same feature detection as main.ts (one throwaway WebGL
 * context), published on window.__gtmPre for main.ts, and — only when the 3D view will be used — a modulepreload of the
 * 3D chunks so they download in parallel with the entry (saves a round-trip on 3G). Weak phones never download Three.js.
 */
function preload3D(): Plugin {
  return {
    name: 'gtm-preload-3d',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const chunks = Object.keys(ctx.bundle ?? {}).filter((f) => /^assets\/(three|store3d)-.*\.js$/.test(f));
        const js = `(function(){function go(){var r=null;try{var q=new URLSearchParams(location.search).get('view');if(q==='2d')r='query';else{var c=document.createElement('canvas');var gl=c.getContext('webgl2')||c.getContext('webgl');if(!gl)r='no_webgl';else{if(q!=='3d'){var i=gl.getExtension('WEBGL_debug_renderer_info');var n=i?String(gl.getParameter(i.UNMASKED_RENDERER_WEBGL)):'';if(/swiftshader|llvmpipe|software/i.test(n))r='software_gl';else if(typeof navigator.deviceMemory==='number'&&navigator.deviceMemory<2)r='low_memory';else if(matchMedia('(prefers-reduced-motion: reduce)').matches)r='reduced_motion';}var x=gl.getExtension('WEBGL_lose_context');if(x)x.loseContext();}}}catch(e){r=null}window.__gtmPre={reason:r};try{window.dispatchEvent(new Event('gtm:pre'))}catch(e){}if(r)return;${JSON.stringify(chunks.map((f) => '/' + f))}.forEach(function(f){var l=document.createElement('link');l.rel='modulepreload';l.href=f;document.head.appendChild(l)})}if(window.requestAnimationFrame)requestAnimationFrame(function(){setTimeout(go,0)});else go()})();`;
        return [{ tag: 'script', children: js, injectTo: 'head' }];
      },
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [storeHtml(), preload3D()],
  publicDir: STORE_PUBLIC_DIR,
  // a client build points the one `./data/store.json` import at the client's file (no source change, same type)
  // (alias matches the WHOLE import specifier `./data/store.json`; a partial match would leave the leading "." in the path)
  resolve: { alias: process.env.STORE_DIR ? [{ find: /^\.{1,2}[\\/]data[\\/]store\.json$/, replacement: STORE_JSON.replace(/\\/g, '/') }] : [] },
  build: {
    outDir: STORE_OUT_DIR,
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
