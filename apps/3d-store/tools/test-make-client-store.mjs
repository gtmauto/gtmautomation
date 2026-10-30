#!/usr/bin/env node
/**
 * test-make-client-store.mjs — offline tests for the per-client generator (template, Page pick) and its reuse of buildStore().
 *   node tools/test-make-client-store.mjs
 */
import { clientTemplate, pickPage, CLIENT_RE, DEFAULTS } from './make-client-store.mjs';
import { buildStore } from './sync-store-from-supabase.mjs';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + String(extra).slice(0, 300) : '')); } };

console.log('1. template');
{
  const t = clientTemplate('toy-shop', { name: "Affrah's Toys World" });
  check('ids + tenant + name', t.store.id === 'toy-shop' && t.store.tenantId === 'toy-shop' && t.store.name === "Affrah's Toys World");
  check('defaults + REPLACE_ME placeholders', t.store.primaryColor === DEFAULTS.primaryColor && t.store.logo === DEFAULTS.logo && t.store.messengerPage === 'REPLACE_ME' && t.store.whatsappNumber === 'REPLACE_ME');
  check('neutral posters only (no delivery / return promises)', t.posters.length === 2 && !/ডেলিভারি|দিন|বদল/.test(JSON.stringify(t.posters.map((p) => p.text))) && t.posters[1].text.includes("Affrah's Toys World"));
  check('no দোকান anywhere in the template', !/দোকান/.test(JSON.stringify(t)));
  const w = clientTemplate('x-shop', { whatsappNumber: '+880 17 1234-5678', messengerPage: '123456789012345' });
  check('WhatsApp digits only, Page id accepted', w.store.whatsappNumber === '8801712345678' && w.store.messengerPage === '123456789012345');
  check('client id rule', CLIENT_RE.test('demo-dokan') && CLIENT_RE.test('toy-shop') && !CLIENT_RE.test('Toy Shop') && !CLIENT_RE.test('ab'));
}

console.log('2. page pick');
{
  check('no rows → empty', pickPage([]) === '' && pickPage(null) === '');
  check('revoked ignored, newest connected wins, id used', pickPage([{ page_id: '111', status: 'revoked', connected_at: '2026-10-30' }, { page_id: '222', status: 'connected', connected_at: '2026-10-01' }, { page_id: '333', status: 'connected', connected_at: '2026-10-20' }]) === '333');
}

console.log('3. products through buildStore with a fresh template');
{
  const rows = [
    { sku: 'TY-001', name: 'Toy Car', name_bn: 'খেলনা গাড়ি', price: 500, sale_price_bdt: null, stock_qty: 10, track_stock: true, category: 'খেলনা', sort_order: 1, is_active: true, is_sample: false, created_at: '2026-10-29T00:00:00Z', clients: { name: 'Toys' }, product_variants: [], product_photos: [] },
    { sku: 'TY-002', name: 'Puzzle', name_bn: 'পাজল', price: 800, sale_price_bdt: 700, stock_qty: 3, track_stock: true, category: 'খেলনা', sort_order: 2, is_active: true, is_sample: false, created_at: '2026-09-01T00:00:00Z', clients: { name: 'Toys' }, product_variants: [], product_photos: [] },
    { sku: 'BK-01', name: 'Book', name_bn: 'ছবির বই', price: 300, sale_price_bdt: null, stock_qty: 5, track_stock: true, category: 'বই', sort_order: 3, is_active: true, is_sample: false, created_at: '2026-09-01T00:00:00Z', clients: { name: 'Toys' }, product_variants: [], product_photos: [] },
  ];
  const t = clientTemplate('toy-shop', { name: 'Toys' });
  const { store } = buildStore(rows, t, { clientId: 'toy-shop', now: '2026-10-30T12:00:00Z' });
  check('two sections on north/east with rack/shelf, ascii ids', store.sections.length === 2 && store.sections[0].wall === 'north' && store.sections[1].wall === 'east' && store.sections.every((s) => /^[a-z0-9-]+$/.test(s.id)), JSON.stringify(store.sections));
  check('badges: new recent product → নতুন, sale → অফার, old → none', store.products.find((p) => p.sku === 'TY-001').badge === 'নতুন' && store.products.find((p) => p.sku === 'TY-002').badge === 'অফার' && store.products.find((p) => p.sku === 'BK-01').badge === undefined);
  check('images default to /products/<sku>.png, no sizes, tenantId set, posters kept', store.products.every((p) => p.image === `/products/${p.sku.toLowerCase()}.png` && p.sizes.length === 0) && store.store.tenantId === 'toy-shop' && store.posters.length === 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
