import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';

/**
 * Injects store name / tagline / colour / logo from src/data/store.json into index.html
 * ({{STORE_NAME}} etc.) so the loading screen is branded before any JS runs and nothing is hardcoded.
 */
function storeHtml(): Plugin {
  const json = JSON.parse(readFileSync(new URL('./src/data/store.json', import.meta.url), 'utf8'));
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

export default defineConfig({
  base: '/',
  plugins: [storeHtml()],
  build: {
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
