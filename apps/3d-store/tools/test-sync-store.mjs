#!/usr/bin/env node
/**
 * test-sync-store.mjs — offline tests for the Supabase → store.json mapping (sync-store-from-supabase.mjs buildStore / diffStores).
 *   node tools/test-sync-store.mjs
 */
import { buildStore, diffStores, SKU_RE } from './sync-store-from-supabase.mjs';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + String(extra).slice(0, 300) : '')); } };
const NOW = '2026-10-30T12:00:00Z';
const row = (o) => Object.assign({ name: 'X', name_bn: 'এক্স', price: 1000, sale_price_bdt: null, stock_qty: 3, track_stock: true, category: 'পাঞ্জাবি', sort_order: 0, is_active: true, is_sample: false, created_at: '2026-09-01T00:00:00Z', clients: { name: 'Ghor Bazar' }, product_variants: [], product_photos: [] }, o);
const current = {
  store: { id: 'ghor-bazar', name: 'Ghor Bazar', tagline: 'ঘরে বসে কিনুন', primaryColor: '#0E7C7B', logo: '/brand/logo.svg', messengerPage: 'gtmautomation', whatsappNumber: '8801886723675', tenantId: 'demo-dokan' },
  sections: [{ id: 'panjabi', label: 'পাঞ্জাবি', display: 'rack', wall: 'north' }, { id: 'saree', label: 'শাড়ি', display: 'shelf', wall: 'east' }, { id: 'shoes', label: 'জুতা', display: 'pegboard', wall: 'west' }],
  products: [
    { sku: 'PJ-001', section: 'panjabi', name: 'সাদা কটন পাঞ্জাবি', price: 1450, sizes: ['M', 'L', 'XL'], stock: 7, image: '/products/pj-001.png', badge: 'নতুন', viewsToday: 12 },
    { sku: 'SR-001', section: 'saree', name: 'লাল জামদানি শাড়ি', price: 3200, sizes: ['ফ্রি সাইজ'], stock: 4, image: '/products/sr-001.png', badge: 'জনপ্রিয়', viewsToday: 40 },
    { sku: 'SH-009', section: 'shoes', name: 'পুরোনো জুতা', price: 900, sizes: ['40'], stock: 1, image: '/products/sh-009.png' },
  ],
  posters: [{ text: 'ঘরে বসে কিনুন', wall: 'north', offset: -0.7 }],
};

console.log('1. mapping basics');
{
  const rows = [
    row({ sku: 'PJ-001', name_bn: 'সাদা কটন পাঞ্জাবি', price: 1450, sort_order: 1, product_variants: [{ label: 'XL', stock_qty: 2, is_active: true, sort_order: 3 }, { label: 'M', stock_qty: 3, is_active: true, sort_order: 1 }, { label: 'L', stock_qty: 2, is_active: true, sort_order: 2 }, { label: 'S', stock_qty: 9, is_active: false, sort_order: 0 }] }),
    row({ sku: 'PJ-004', name_bn: 'অলিভ লিনেন পাঞ্জাবি', price: 1900, sale_price_bdt: 1650, sort_order: 4, stock_qty: 10 }),
    row({ sku: 'SR-001', name_bn: 'লাল জামদানি শাড়ি', category: 'শাড়ি', price: 3200, sort_order: 1, stock_qty: 4 }),
    row({ sku: 'SR-007', name_bn: 'নতুন শাড়ি', category: 'শাড়ি', price: 2800, sort_order: 2, stock_qty: 2, created_at: '2026-10-25T00:00:00Z' }),
    row({ sku: 'DD-SAR-001', name_bn: 'পুরোনো ফরম্যাট', category: 'শাড়ি', price: 3450 }),
    row({ sku: 'SH-001', name_bn: 'স্যান্ডেল', category: 'জুতা', price: 1250, product_variants: [{ label: '40', stock_qty: 2, is_active: true, sort_order: 1 }, { label: '41', stock_qty: 0, is_active: true, sort_order: 2 }] }),
    row({ sku: 'TY-001', name_bn: 'খেলনা গাড়ি', category: 'খেলনা', price: 500, sort_order: 9 }),
    row({ sku: 'PJ-099', name_bn: 'ইনঅ্যাক্টিভ', is_active: false }),
    row({ sku: 'PJ-098', name_bn: 'স্যাম্পল', is_sample: true }),
    row({ sku: 'PJ-097', name_bn: 'ক্যাটাগরি নেই', category: '' }),
  ];
  const { store, skipped, notes, counts } = buildStore(rows, current, { clientId: 'demo-dokan', now: NOW });
  check('the three current sections keep their wall order, the 4th category skipped', store.sections.map((s) => s.label).join('|') === 'পাঞ্জাবি|শাড়ি|জুতা' && skipped.some((s) => s.sku === 'TY-001' && /3-wall/.test(s.reason)), JSON.stringify(store.sections.map((s) => s.label)));
  check('matching sections keep id/display/wall', store.sections[0].id === 'panjabi' && store.sections[0].display === 'rack' && store.sections[1].id === 'saree' && store.sections[1].wall === 'east' && store.sections[2].display === 'pegboard');
  check('bot-unreadable SKU skipped with the reason', skipped.some((s) => s.sku === 'DD-SAR-001' && /2–4 letters/.test(s.reason)));
  check('inactive, sample and no-category rows skipped', !store.products.some((p) => ['PJ-099', 'PJ-098', 'PJ-097'].includes(p.sku)) && skipped.some((s) => s.sku === 'PJ-097'));
  const pj1 = store.products.find((p) => p.sku === 'PJ-001');
  check('sizes from active variants in sort order, stock = variant sum', pj1.sizes.join() === 'M,L,XL' && pj1.stock === 7, JSON.stringify(pj1));
  check('existing badge kept when no offer/new, viewsToday carried over, image kept', pj1.badge === 'নতুন' && pj1.viewsToday === 12 && pj1.image === '/products/pj-001.png');
  const pj4 = store.products.find((p) => p.sku === 'PJ-004');
  check('sale price → price + অফার badge; new product gets /products/<sku>.png and no viewsToday', pj4.price === 1650 && pj4.badge === 'অফার' && pj4.image === '/products/pj-004.png' && pj4.viewsToday === undefined && pj4.sizes.length === 0, JSON.stringify(pj4));
  const sr7 = store.products.find((p) => p.sku === 'SR-007');
  check('brand-new product created within 14 days → নতুন', sr7.badge === 'নতুন');
  const recentKnown = buildStore([row({ sku: 'SR-001', name_bn: 'লাল জামদানি শাড়ি', category: 'শাড়ি', price: 3200, created_at: '2026-10-29T00:00:00Z' })], current, { clientId: 'demo-dokan', now: NOW }).store.products[0];
  check('a known SKU created recently keeps its curated badge (no নতুন flood after a seed)', recentKnown.badge === 'জনপ্রিয়');
  const sr1 = store.products.find((p) => p.sku === 'SR-001');
  check('no variants → current sizes kept, product stock used, জনপ্রিয় badge kept', sr1.sizes.join() === 'ফ্রি সাইজ' && sr1.stock === 4 && sr1.badge === 'জনপ্রিয়');
  const sh1 = store.products.find((p) => p.sku === 'SH-001');
  check('variant with 0 stock still listed as a size', sh1.sizes.join() === '40,41' && sh1.stock === 2);
  check('store keeps branding, sets tenantId, posters kept', store.store.name === 'Ghor Bazar' && store.store.tenantId === 'demo-dokan' && store.store.messengerPage === 'gtmautomation' && store.posters.length === 1);
  check('counts', counts.products === 5 && counts.sections === 3, JSON.stringify(counts));
  check('notes mention carried viewsToday', notes.some((n) => /viewsToday/.test(n)));
  const d = diffStores(current, store);
  check('diff: added PJ-004/SR-007/SH-001, removed SH-009, PJ-001 unchanged', d.added.join() === 'PJ-004,SR-007,SH-001' && d.removed.join() === 'SH-009' && !d.changed.some((c) => c.sku === 'PJ-001'), JSON.stringify(d));
}

console.log('2. caps, new sections, brand from db, empty current');
{
  const rows = [];
  for (let i = 1; i <= 8; i++) rows.push(row({ sku: `TY-${String(i).padStart(3, '0')}`, name_bn: `খেলনা ${i}`, category: 'খেলনা', sort_order: i }));
  for (let i = 1; i <= 2; i++) rows.push(row({ sku: `BK-${String(i).padStart(2, '0')}`, name_bn: `বই ${i}`, category: 'বই', sort_order: 20 + i }));
  const { store, skipped } = buildStore(rows, {}, { clientId: 'toy-shop', now: NOW, brandFromDb: true });
  check('6-per-section cap, extra two skipped with the reason', store.products.filter((p) => p.section === store.sections[0].id).length === 6 && skipped.filter((s) => /already shows 6/.test(s.reason)).length === 2);
  check('new sections get rack/shelf + north/east and ascii ids', store.sections.length === 2 && store.sections[0].display === 'rack' && store.sections[0].wall === 'north' && store.sections[1].display === 'shelf' && store.sections[1].wall === 'east' && /^[a-z0-9-]+$/.test(store.sections[0].id), JSON.stringify(store.sections));
  check('brand from db + REPLACE_ME placeholders when current store is empty', store.store.name === 'Ghor Bazar' && store.store.messengerPage === 'REPLACE_ME' && store.store.whatsappNumber === 'REPLACE_ME' && store.store.id === 'toy-shop');
  check('2-letter + 2-digit SKU accepted (BK-01)', store.products.some((p) => p.sku === 'BK-01') && SKU_RE.test('TOY-0012') && !SKU_RE.test('T-1') && !SKU_RE.test('TOYS1-001'));
  check('empty rows → empty store, no crash', buildStore([], current, { clientId: 'x-shop' }).store.products.length === 0);
}

console.log('3. in-sync detection');
{
  const rows = current.products.map((p, i) => row({ sku: p.sku, name_bn: p.name, price: p.price, category: current.sections.find((s) => s.id === p.section).label, sort_order: i, stock_qty: p.stock, product_variants: p.sizes.length > 1 ? p.sizes.map((s, j) => ({ label: s, stock_qty: j === 0 ? p.stock : 0, is_active: true, sort_order: j })) : [] }));
  const { store } = buildStore(rows, current, { clientId: 'demo-dokan', now: NOW });
  const d = diffStores(current, store);
  check('same catalogue → diff reports in sync', d.same, JSON.stringify(d));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
