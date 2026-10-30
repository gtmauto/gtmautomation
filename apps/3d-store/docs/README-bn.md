# GTM 3D Virtual Store — সহজ গাইড (Phase 1 demo)

এই folder-টা (`apps/3d-store/`) একটা **3D দোকান-ঘর** যেটা ফোনের browser-এ চলে। ক্রেতা ঘুরে দেখে, product-এ ট্যাপ করে, আর **Messenger বা WhatsApp-এ অর্ডার করুন** button চাপলে সরাসরি bot-এর কাছে চলে যায়। Bot = বিক্রেতা, 3D store = শপের সামনের অংশ।

> কোনো coding লাগবে না। নিচের ধাপগুলো copy-paste level-এর।

---

## ১. কম্পিউটারে চালিয়ে দেখা (একবারই setup)

1. [Node.js](https://nodejs.org) install করুন (LTS version)।
2. এই folder-এ একটা terminal খুলুন (folder-এ right-click → "Open in Terminal")।
3. লিখুন:

```bash
npm install
```

4. তারপর:

```bash
npm run dev
```

5. Browser-এ খুলুন: `http://localhost:5173` — দোকান দেখা যাবে।

বন্ধ করতে terminal-এ `Ctrl + C`।

---

## ২. সব content এক জায়গায়: `src/data/store.json`

এই একটা file-এ দোকানের নাম, রং, section আর ১৮টা product আছে। **অন্য কোনো file-এ হাত দিতে হবে না।**

### ২.১ একটা product বদলানো

`products` list-এ প্রতিটা product এরকম:

```json
{
  "sku": "PJ-001",
  "section": "panjabi",
  "name": "সাদা কটন পাঞ্জাবি",
  "price": 1450,
  "sizes": ["M", "L", "XL"],
  "stock": 7,
  "image": "/products/pj-001.png",
  "badge": "নতুন",
  "viewsToday": 12
}
```

| Field | মানে | নিয়ম |
|---|---|---|
| `sku` | product-এর code (bot এটা পায়) | শুধু English অক্ষর, সংখ্যা, `-` |
| `section` | কোন দেয়ালে | `panjabi`, `saree`, `shoes` (sections list দেখুন) |
| `name` | বাংলা নাম | যা খুশি |
| `price` | দাম (টাকা) | শুধু সংখ্যা, কমা ছাড়া |
| `sizes` | সাইজের list | `["M","L"]` বা `["ফ্রি সাইজ"]` |
| `stock` | কয়টা আছে | ৩ বা কম হলে "মাত্র ৩টা বাকি" দেখায়, ০ হলে "স্টক শেষ" |
| `image` | ছবির path | `/products/` folder-এর file |
| `badge` | ছোট tag (optional) | "নতুন", "অফার", "জনপ্রিয়" — না চাইলে লাইনটা মুছে দিন |
| `viewsToday` | "আজ ১২ জন দেখেছে" (optional) | **সত্যি সংখ্যা হলে তবেই** দিন; না থাকলে লাইনটা মুছে দিন, কিছুই দেখাবে না |

product-এর পর কমা `,` থাকতে হবে, শেষেরটার পরে না — এটাই JSON-এর একমাত্র কড়া নিয়ম। ভুল হলে browser-এ সাদা স্ক্রিন আসবে; তখন শেষ বদলটা ফেরত নিন।

### ২.২ দোকানের নাম, রং, tagline

```json
"store": {
  "id": "ghor-bazar",
  "name": "Ghor Bazar",
  "tagline": "ঘরে বসে কিনুন, ক্যাশ অন ডেলিভারি",
  "primaryColor": "#0E7C7B",
  "logo": "/brand/logo.svg",
  "messengerPage": "REPLACE_ME",
  "whatsappNumber": "REPLACE_ME"
}
```

- `primaryColor` = button আর সাইনবোর্ডের রং (hex code, যেমন `#C0392B`)।
- `logo` = `public/brand/logo.svg` বদলে নিজের logo দিন (SVG বা PNG, চৌকো)।

### ২.৩ Messenger, WhatsApp number আর tenantId বসানো (সবচেয়ে জরুরি)

- `messengerPage`: Facebook Page-এর username। Page-এর link যদি হয় `facebook.com/ghorbazarbd` → লিখুন `"ghorbazarbd"`।
- `whatsappNumber`: দেশের code সহ, `+` বা space ছাড়া। যেমন `"8801XXXXXXXXX"`।
- `tenantId`: GTM dashboard-এ এই শপের client id (যেমন `"demo-dokan"`)। Bot এই id দিয়ে Supabase থেকে পণ্যের দাম, স্টক, সাইজ টেনে আনে, তাই **store.json-এর SKU আর dashboard-এর SKU এক হতে হবে।**

**Demo (2026-10-30):** `messengerPage` = `gtmautomation` (GTM-এর নিজের Page), `whatsappNumber` = GTM-এর WhatsApp bot number, `tenantId` = `demo-dokan` (demo tenant; ১৮টা পণ্য ওখানে seed করা)। আসল client এলে তিনটাই তার নিজেরটা হবে।

Button চাপলে এই link খোলে:
- Messenger: `https://m.me/<messengerPage>?ref=s_<tenantId>__<sku>[-<size>]` — bot `ref`-এ শপ আর product code পায়; ব্যাগ হলে `s_<tenantId>__CART_<sku>x<qty>-<size>_…`।
- WhatsApp: `https://wa.me/<whatsappNumber>?text=...` — বাংলায় লেখা অর্ডার message আগে থেকে বসানো থাকে (product-এর নাম, code, দাম, সাইজ), শেষ লাইনে `শপ কোড: <tenantId>`।

### ২.৪ Section বদলানো

```json
"sections": [
  { "id": "panjabi", "label": "পাঞ্জাবি", "display": "rack",     "wall": "north" },
  { "id": "saree",   "label": "শাড়ি",     "display": "shelf",    "wall": "east"  },
  { "id": "shoes",   "label": "জুতা",      "display": "pegboard", "wall": "west"  }
]
```

- `display`: `rack` (ঝোলানো জামা), `shelf` (তাকে রাখা), `pegboard` (বোর্ডে ঝোলানো)।
- `wall`: `north` (সামনের দেয়াল, সাইনবোর্ডসহ), `east`, `west`।
- প্রতি section-এ ৬টা product সবচেয়ে ভালো দেখায়।

### ২.৫ দেয়ালের পোস্টার

`posters` list-এ ৪টা পোস্টার আছে (`text` বড় লাইন, `sub` ছোট লাইন)। শুধু লেখা বদলান।

---

### ২.৬ Dashboard থেকে store.json নিজে বানানো (sync script)

GTM dashboard-এর "পণ্য ও স্টক"-ই আসল তালিকা। হাতে store.json না লিখে এক command-এ বানিয়ে নিন:

```bash
node tools/sync-store-from-supabase.mjs demo-dokan
node tools/sync-store-from-supabase.mjs demo-dokan --write
```

প্রথম লাইন শুধু দেখায় কী বদলাবে (কিছু লেখে না); `--write` দিলে `src/data/store.json` বদলায়। তারপর `npm run build` আর deploy (§৪.২)। `--photos` দিলে dashboard-এর ছবিও নামিয়ে চৌকো করে বসায়।

নিয়মগুলো:
- **SKU-র format:** ২–৪টা ইংরেজি অক্ষর, dash, ২–৪টা সংখ্যা (যেমন `PJ-003`, `TOY-0012`)। অন্য format-এর পণ্য (যেমন `DD-SAR-001`) বাদ পড়ে, কারণ bot লিংক থেকে ওই code পড়তে পারে না; script বলে দেয় কোনগুলো বাদ গেল।
- **Section = dashboard-এর category।** ঘরে দেয়াল তিনটা, তাই সর্বোচ্চ ৩টা category, প্রতিটায় ৬টা পণ্য (dashboard-এর sort order অনুযায়ী); বাকিগুলো তালিকায় বাদ-এর কারণসহ আসে। আগে থেকে থাকা section-এর দেয়াল আর সাজানো বদলায় না।
- **দাম** = sale price থাকলে সেটা, নইলে regular; sale থাকলে badge "অফার"। আগের badge (জনপ্রিয় ইত্যাদি) থেকে যায়; একেবারে নতুন পণ্য ১৪ দিনের মধ্যে যোগ হলে "নতুন"।
- **সাইজ** = পণ্যের variant (M/L/XL বা 39/40…), **স্টক** = variant-এর যোগফল (variant না থাকলে পণ্যের স্টক)।
- `viewsToday` script কখনও বানায় না; আগের মান থাকলে সেটাই থাকে।
- ছবি: পুরোনো SKU-র ছবি যেমন আছে; নতুন SKU-র জন্য `/products/<sku>.png` লাগবে (§৩)।

## ৩. আসল ছবি বসানো

Demo-র ছবিগুলো computer-এ বানানো placeholder। আসল ছবি দিতে **সবচেয়ে সহজ পথ: script**।

1. ছবিগুলো একটা folder-এ রাখুন। **File-এর নামে SKU থাকতে হবে**, যেমন `PJ-003.jpg`, `sr-002 front.jpeg`, `SH_06.png` (বড়-ছোট হাতের অক্ষর, dash/underscore যেকোনোটা চলে)।
2. Terminal-এ (আগে `--dry` দিয়ে দেখে নিন, কিছু লেখা হয় না):

```bash
node tools/prep-photos.mjs "C:/path/to/photos" --dry
node tools/prep-photos.mjs "C:/path/to/photos"
```

Script নিজে ছবি **চৌকো** করে (product-এর চারপাশে smart crop), **512×512 PNG** বানায়, **২০০ KB-র নিচে** নামায়, আর `public/products/<sku>.png` নামে বসায়। `store.json` বদলাতে হয় না, কারণ `"image"` path আগে থেকেই ওই নামে আছে। শেষে বলে দেয় কোন SKU-র ছবি এখনও বাকি (ওগুলোতে placeholder-ই থাকে)। পুরো ছবি (crop ছাড়া, সাদা background) চাইলে `--fit contain`।

**হাতে করতে চাইলে** (script ছাড়া):

1. ছবি তুলুন **সাদা/হালকা background-এ**, product মাঝখানে।
2. **চৌকো** করে cut করুন (যেমন 800×800)।
3. Background **transparent** করলে সবচেয়ে ভালো (remove.bg বা Canva-র background remover; PNG হিসেবে save)। Transparent না হলেও চলবে, সাদা চৌকো দেখাবে।
4. File-এর size **২০০ KB-র কম** রাখুন (tinypng.com-এ compress করুন)।
5. File-টা `public/products/` folder-এ রাখুন, নাম যেমন `pj-001.png`।
6. `store.json`-এ ওই product-এর `"image": "/products/pj-001.png"` মিলিয়ে দিন।

---

## ৪. Build করে online-এ তোলা (Cloudflare Pages)

**Live এখন:** <https://ghor-bazar-3d.pages.dev> (Cloudflare Pages project `ghor-bazar-3d`, প্রথম deploy 2026-10-30)। gtmautomation.net-এর server এই app serve করে না; store-এর ঠিকানা এটাই।

### ৪.১ Build

Terminal-এ:

```bash
npm run build
```

একটা `dist/` folder তৈরি হবে (মোট ~৭৫০ KB)। **এই folder-টাই website।**

### ৪.২ Script দিয়ে তোলা (GTM-এর laptop থেকে)

```bash
npm run build
node tools/deploy-pages.mjs dry
node tools/deploy-pages.mjs apply
```

`dry` শুধু দেখে: token ঠিক আছে কি না, project আছে কি না, `dist/`-এ কী আছে; কিছু ওঠে না। `apply` project না থাকলে বানায়, 27-টা file তোলে, তারপর **নিজেই প্রমাণ দেয়** live page আর `dist/index.html` হুবহু এক কি না। Token GTM Automation project-এর `.env` থেকে নামে পড়ে (`CLOUDFLARE_PAGES_TOKEN`), কখনও print হয় না। Deploy-এর পর live speed মাপতে: `node tools/lighthouse-live.mjs` (লেখে `docs/lighthouse-live.json`)।

### ৪.২ক Drag-and-drop দিয়ে তোলা (script ছাড়া, প্রথমবার)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → login → বাঁ দিকে **Workers & Pages** → **Create** → **Pages** tab → **Upload assets**।
2. Project-এর নাম দিন (যেমন `ghor-bazar-3d`) → **Create project**।
3. আপনার computer-এর `dist` folder-টা **টেনে এনে** (drag-and-drop) box-এ ফেলুন। ভেতরের সব file আর folder (`assets`, `products`, `brand`, `fonts`, `index.html`) উঠবে।
4. **Deploy site** চাপুন। ১ মিনিটে link পাবেন: `https://ghor-bazar-3d.pages.dev`।

### ৪.৩ পরে কিছু বদলালে

`store.json` বা ছবি বদলান → `npm run build` → Cloudflare-এর ওই project-এ ঢুকে **Create new deployment** → আবার `dist` folder drag-and-drop → Deploy। ব্যস।

### ৪.৪ নিজের domain

Pages project → **Custom domains** → `shop.আপনার-domain.com` যোগ করুন। Cloudflare নিজেই DNS ঠিক করে দেয়। (2026-10-30: এখনও কোনো custom domain নেই; gtmautomation.net-এর subdomain দিতে হলে মালিকের "yes" লাগে, DNS-এ হাত পড়ে।)

---

## ৫. কী কী আছে (feature list)

- Loading screen (দোকানের নাম + progress bar) → ২ সেকেন্ডের cinematic camera glide।
- নিচে pill menu: Store · পাঞ্জাবি · শাড়ি · জুতা → ক্যামেরা ওই দেয়ালে যায়।
- আঙুল দিয়ে drag করে এদিক-ওদিক দেখা, দুই আঙুলে zoom (সীমার মধ্যে, হারিয়ে যাওয়ার সুযোগ নেই)।
- product-এ ট্যাপ → zoom + পেছনটা blur + panel: ছবি, নাম, দাম (বাংলা সংখ্যায়), সাইজ, স্টক, button।
- Panel-এর পাশে thumbnail strip: ওই section-এর অন্য product-এ এক ট্যাপে যাওয়া।
- "ব্যাগে রাখুন" → উপরে ব্যাগ → "অর্ডার করুন" পুরো list Messenger/WhatsApp-এ পাঠায়।
- Badge: `badge` আর `viewsToday` JSON-এ থাকলে তবেই দেখায়; `stock ≤ 3` হলে "মাত্র ৩টা বাকি"।
- "সাধারণ view" button: সাধারণ 2D list (একই product, একই button)। পুরোনো/দুর্বল ফোনে, WebGL না থাকলে, বা phone-এ "reduce motion" চালু থাকলে নিজে থেকেই এটা খোলে।
- প্রথমবার ছোট একটা hint: "আঙুল দিয়ে ঘুরে দেখুন · product-এ ট্যাপ করুন"।
- Keyboard-এ চলে (Tab, Enter, Esc, arrow key), প্রতিটা button-এ বাংলা label।

### Link-এ `?view=` দিয়ে জোর করা
- `…/?view=2d` → সবসময় সাধারণ view।
- `…/?view=3d` → দুর্বল ফোনেও 3D (test-এর জন্য)।

---

## ৬. Analytics event (Phase 3-এর জন্য)

Site কোথাও data পাঠায় না। শুধু browser-এর `window.dataLayer`-এ event push করে, পরে dashboard-এ জোড়া যাবে:

| event | কখন | data |
|---|---|---|
| `section_view` | pill চাপলে / শুরুতে | `section` |
| `product_focus` | product-এ ট্যাপ / thumbnail বদল | `sku`, `section` |
| `cta_click` | Messenger/WhatsApp button | `sku` (বা ব্যাগে `skus`), `channel` |
| `cart_add` | ব্যাগে রাখুন | `sku`, `section` |
| `fallback_used` | সাধারণ view খুললে | `reason`: `toggle`, `no_webgl`, `software_gl`, `low_memory`, `reduced_motion`, `query`, `error` |

---

## ৭. Folder map

```
apps/3d-store/
  src/data/store.json      ← সব content (এটাই বদলাবেন)
  public/products/         ← product ছবি
  public/brand/            ← logo, favicon
  public/fonts/            ← বাংলা font (Noto Sans Bengali, free/OFL)
  src/                     ← code (Vite + TypeScript + Three.js)
  tools/gen-images.mjs     ← demo ছবি বানানোর script (npm run gen:images)
  tools/prep-photos.mjs    ← আসল ছবি → চৌকো PNG ≤200 KB (§৩)
  tools/sync-store-from-supabase.mjs ← dashboard (Supabase) → store.json, dry | --write | --photos (§২.৬)
  tools/make-client-store.mjs ← client-প্রতি clients/<id>/store.json + products/ (§৯)
  tools/build-client.mjs   ← clients/<id>/ → dist-<id>/ (STORE_DIR/STORE_PUBLIC_DIR/STORE_OUT_DIR → vite.config.ts) (§৯)
  clients/<id>/            ← এক client-এর store.json + products/ (demo-র src/data অপরিবর্তিত)
  tools/test-sync-store.mjs← ওই mapping-এর offline test
  tools/deploy-pages.mjs   ← Cloudflare Pages-এ তোলা: dry | apply (§৪.২)
  tools/lighthouse-live.mjs← live URL-এ Lighthouse → docs/lighthouse-live.json
  tools/verify.mjs         ← নিজে নিজে test (npm run build && npm run verify)
  docs/market-analysis.md  ← কেন এভাবে বানানো হলো
  docs/VERIFY-REPORT.md    ← শেষ test-এর report, screenshots docs/screenshots/
```

Test চালাতে (Google Chrome install থাকা লাগবে):

```bash
npm run build && npm run verify
```

---

## ৯. প্রতিটা client-এর জন্য আলাদা store (নতুন client এলে)

Demo-র (`src/data/`) কিছু না ছুঁয়ে client-প্রতি আলাদা folder, আলাদা build, আলাদা Cloudflare Pages project। তিনটা command:

```bash
node tools/make-client-store.mjs toy-shop --name "Affrah's Toys World" --page <Page username বা id> --wa 8801XXXXXXXXX --write --photos
node tools/build-client.mjs toy-shop
node tools/deploy-pages.mjs dry --dist dist-toy-shop --store clients/toy-shop/store.json --project store-toy-shop
```

- **আগে dashboard:** client-এর পণ্য GTM dashboard-এ থাকতে হবে (client id যেমন `toy-shop`), SKU §২.৬-এর format-এ। প্রথম command Supabase থেকে পড়ে `clients/toy-shop/store.json` আর `clients/toy-shop/products/` বানায়; `--photos` dashboard-এর ছবি নামায়। Page না দিলে client-এর connected Page (Page id) নেওয়া হয়, না থাকলে `REPLACE_ME`। WhatsApp = **client-এর নিজের** নম্বর; GTM-এর WhatsApp নম্বরে client-এর অর্ডার আসতে দেওয়া যাবে না।
- **Branding:** প্রথমবার নাম (dashboard-এর client name), default রং/logo আর দুটো নিরপেক্ষ পোস্টার (ডেলিভারি-সময় বা বদলের কোনো প্রতিশ্রুতি নেই)। পরে `clients/toy-shop/store.json`-এ হাতে বদলালে সেটাই থাকে; পণ্য আবার sync করলে branding বদলায় না।
- **Build:** দ্বিতীয় command `dist-toy-shop/` বানায় আর নিজে যাচাই করে: client-এর নাম, tenant id, section, পোস্টার bundle-এ গেছে কি না, demo-র কিছু ঢোকেনি কি না, সব ছবি আছে কি না।
- **Deploy:** তৃতীয় command-এ `dry` → ঠিক থাকলে `apply`; project `store-toy-shop` নিজে তৈরি হয়, ঠিকানা `store-toy-shop.pages.dev` (custom domain client চাইলে Pages → Custom domains)।
- **Bot:** client-এর নিজের Page connect থাকলে (connect.html) bot ওই tenant-এর পণ্যই পড়ে; link-এ `s_toy-shop__TOY-0012`।

## ৮. সাবধানতা

- কোনো password, token, API key এই folder-এ রাখবেন না। `store.json`-এ শুধু Page-এর username আর phone number যায়।
- Product-এর সত্যি সংখ্যা ছাড়া `viewsToday` দেবেন না — ক্রেতারা ধরে ফেলে, বিশ্বাস নষ্ট হয়।
- Demo-র সব ছবি, logo, পোস্টার original; কোনো brand-এর ছবি/নাম ব্যবহার করবেন না।
