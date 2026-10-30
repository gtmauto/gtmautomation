# Phase 1 verification report

Generated 2026-10-30T13:04:26.451Z by `npm run verify` (Chrome headless + Lighthouse on the built `dist/`).

## Build size

✅ dist/ total 739 KB (27 files) < 3 MB
- assets\index-D9-yNKe3.js: 24.2 KB
- assets\store3d-B4QQs_UA.js: 16.6 KB
- assets\style-BAtvTMA0.css: 9.6 KB
- assets\three-j36K6S6W.js: 523.7 KB

## Loading on simulated Fast 3G (1.6 Mbps down, 750 kbps up, 150 ms RTT)

- transferred (gzip): index-D9-yNKe3.js: 9 KB · style-BAtvTMA0.css: 3 KB · noto-sans-bengali-var.woff2: 105 KB · store3d-B4QQs_UA.js: 7 KB · three-j36K6S6W.js: 130 KB
- wall clock to hero: 5407 ms
- first contentful paint: 756 ms
- loading screen hidden (glide starts): 3042 ms
- hero wall reached (glide done): 5059 ms
✅ first paint < 2.5 s
✅ loading → glide → hero < 6.5 s on Fast 3G (brief asked < 3 s; owner accepted ≈ 5 s with the 2 s glide, 2026-10-30) — 5059 ms
✅ coach mark visible on first visit

## Interaction checks (360 × 740, touch)

✅ 3D view: no horizontal scroll at 360 px
✅ pill "পাঞ্জাবি" turns the camera to the north wall — camera (0.00, 1.70, 0.20), facing dot=1.00
✅ pill "শাড়ি" turns the camera to the east wall — camera (-0.20, 1.70, 0.00), facing dot=1.00
✅ pill "জুতা" turns the camera to the west wall — camera (0.20, 1.70, 0.00), facing dot=1.00
✅ pill "Store" overview
✅ all 18 products clickable, panel shows JSON data, strip has 6 thumbs — 18/18
✅ thumbnail strip swaps product without leaving focus — কাতান শাড়ি
✅ size chip is added to the Messenger ref (tenant prefix + sku + size) — https://m.me/gtmautomation?ref=s_demo-dokan__PJ-003-XL
✅ add to cart updates the badge (Bangla digit) — ১
✅ cart Messenger ref carries tenant + sku × qty + size — https://m.me/gtmautomation?ref=s_demo-dokan__CART_PJ-003x1-XL
✅ cart WhatsApp text ends with the shop code — ৳২,২৫০
মোট: ৳২,২৫০
ক্যাশ অন ডেলিভারি হবে?
শপ কোড: demo-dokan
✅ toggle → fallback shows 18 products with 36 chat CTAs
✅ fallback: no horizontal scroll at 360 px
✅ fallback hides the canvas and fires fallback_used
✅ toggle back to 3D works
- dataLayer events seen: section_view, product_focus, cart_add, fallback_used

## CTA URLs (placeholders expected until messengerPage / whatsappNumber are filled)

- PJ-001 সাদা কটন পাঞ্জাবি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__PJ-001
- PJ-002 নেভি এমব্রয়ডারি পাঞ্জাবি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__PJ-002
  whatsapp → https://wa.me/8801886723675?text=আসসালামু আলাইকুম, আমি অর্ডার করতে চাই:
• নেভি এমব্রয়ডারি পাঞ্জাবি (PJ-002) — ৳১,৮৫০
পরিমাণ: ১
ক্যাশ অন ডেলিভারি হবে?
শপ কোড: demo-dokan
- PJ-003 মেরুন সিল্ক পাঞ্জাবি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__PJ-003
- PJ-004 অলিভ লিনেন পাঞ্জাবি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__PJ-004
- PJ-005 কালো প্রিন্টেড পাঞ্জাবি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__PJ-005
- PJ-006 আকাশি চেক পাঞ্জাবি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__PJ-006
- SR-001 লাল জামদানি শাড়ি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SR-001
- SR-002 টাঙ্গাইল তাঁতের শাড়ি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SR-002
- SR-003 হাফ সিল্ক শাড়ি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SR-003
- SR-004 সুতি প্রিন্ট শাড়ি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SR-004
- SR-005 কাতান শাড়ি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SR-005
- SR-006 মসলিন শাড়ি: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SR-006
- SH-001 ব্রাউন লেদার স্যান্ডেল: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SH-001
- SH-002 কালো ফরমাল শু: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SH-002
- SH-003 সাদা স্নিকার: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SH-003
- SH-004 নাগরা জুতা: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SH-004
- SH-005 লেডিস ফ্ল্যাট স্যান্ডেল: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SH-005
- SH-006 স্পোর্টস রানিং শু: messenger → https://m.me/gtmautomation?ref=s_demo-dokan__SH-006
- CART messenger → https://m.me/gtmautomation?ref=s_demo-dokan__CART_PJ-003x1-XL
  CART whatsapp → https://wa.me/8801886723675?text=আসসালামু আলাইকুম, আমি অর্ডার করতে চাই:
• মেরুন সিল্ক পাঞ্জাবি (PJ-003) — সাইজ XL × ১ = ৳২,২৫০
মোট: ৳২,২৫০
ক্যাশ অন ডেলিভারি হবে?
শপ কোড: demo-dokan

## WebGL disabled

✅ auto-switch to fallback when WebGL is unavailable — reason=no_webgl, note="এই ফোনে 3D চলে না, তাই সাধারণ view", 3D toggle hidden=true

## Console

✅ no console errors / page errors / failed requests

## Lighthouse (mobile, simulated throttling)


### 3D view, GPU WebGL (a phone with a GPU)

- Performance: 80 · Accessibility: 100 · Best practices: 100
- FCP 0.8 s · LCP 0.8 s · TBT 850 ms · CLS 0 · SI 2.6 s
✅ Lighthouse mobile Performance ≥ 80 (3D view) — 80

### default URL on a CPU-only (SwiftShader) browser → auto 2D fallback

- Performance: 76 · Accessibility: 100 · Best practices: 100
- FCP 0.8 s · LCP 2.1 s · TBT 1,070 ms · CLS 0.001 · SI 1.7 s

## Secrets scan

✅ git grep token|secret|password|key= → 27 lines, 0 sensitive
✅ token-shaped VALUES in tracked files → 0
