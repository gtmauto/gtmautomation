# GTM 3D Virtual Store — Market Analysis (Phase 1)

তারিখ / Date: 2026-10-29 · লেখক: Claude (GTM Automation build session)

এই document-টা বলে **কেন** 3D store-টা যেভাবে বানানো হয়েছে সেভাবে বানানো হলো। প্রতিটা design decision-এর পেছনে একটা research finding আছে।
This document records **why** the Phase 1 store is designed the way it is, so every UI decision is traceable to a finding.

---

## 1. 3D / virtual-store e-commerce আজ কীভাবে convert করে

### যা research বলছে (what the evidence says)

| Finding | Source quality | Note |
|---|---|---|
| Shopify platform data: products with 3D/AR content show ~94% higher conversion vs static images | Vendor aggregate, no published methodology | Use as direction, not a promise |
| Rebecca Minkoff (Shopify Plus): shoppers ~30% more likely to buy after 3D/AR on 50+ product pages | Brand case study | Lift comes from *product focus*, not from walking around |
| 3D Cloud Q2 2026 index: configurators reach 16% add-to-cart, 2.2% purchase conversion; room planners average ~20-minute sessions | Most concrete recent benchmark (furniture category) | Long sessions happen when the tool helps *decide*, not when it is a novelty |
| Google "Need for Mobile Speed" (10,000+ mobile domains): 53% of mobile visits abandoned when a page takes >3 s; bounce rises 32% from 1 s → 3 s | Old (2016) but still the most-cited primary study | Hard ceiling for our loading screen |
| Virtual stores (Obsess, Emperia) report higher session time, interaction rate, add-to-cart and cart size | Vendor claims | Pattern worth copying: product hotspot → side panel → direct checkout |

### প্রথম ৩ সেকেন্ডে কী attention ধরে (what hooks in the first 3 s)
1. **সাথে সাথে কিছু দেখা যায়** — brand name + loading bar. একটা সাদা স্ক্রিন মানেই bounce.
2. **একটা ছোট cinematic move** — ক্যামেরা ঘরে ঢুকছে। এটা "এটা অন্যরকম" feeling দেয়। ২ সেকেন্ডের বেশি নয়।
3. **সামনে brand sign + products** — ক্যামেরা default-এই hero wall-এর দিকে তাকিয়ে থাকে। User-কে খুঁজতে হয় না।

### কেন user চলে যায় (why users bounce)
- **Load time**: 3D asset ভারী হলে 4G-তে 5–10 s লাগে → অর্ধেক চলে যায়। তাই Phase 1-এ কোনো 3D model নেই, শুধু textured plane (sprite) + simple geometry।
- **Free-roam confusion**: WASD / joystick দিয়ে ঘোরা mobile-এ কাজ করে না। মানুষ দেয়ালে আটকে যায়, কী করবে বোঝে না।
- **"কিনব কীভাবে" পরিষ্কার না**: product দেখা গেল কিন্তু buy button নেই বা ৩ click দূরে।
- **Mobile-specific**: পিঞ্চ/ড্র্যাগ কাজ না করা, panel স্ক্রিনের বাইরে চলে যাওয়া, 44 px-এর ছোট button।

### Pattern যেটা কাজ করে (the pattern that works)
**Guided tour → instant product focus → one-tap buy.** Free-roam নয়।
- Guided: নিচে section pill → ক্যামেরা নিজে glide করে যায়।
- Focus: product-এ tap → zoom + blur + side panel।
- Buy: panel-এ একটাই বড় button।

---

## 2. বাংলাদেশের F-commerce ক্রেতা (Bangladesh F-commerce buyer behaviour)

| Finding | Source | Implication for us |
|---|---|---|
| ~2.5 lakh Facebook-based shops (e-CAB), 77.7 M internet users, 60 M active social users (Jan 2025) | Daily Star, DHL guide | Traffic comes from a Facebook ad tap, not from a Google search |
| Most F-commerce transactions are Cash on Delivery and unrecorded (2024–25 study, 385 customers + 100 traders); industry blog puts COD at >80% | Zenodo / AUB study, LinkedIn (weaker) | Do **not** build a card checkout. "ক্যাশ অন ডেলিভারি" poster = trust |
| Young buyers' purchase decisions driven by trust (data safety), prompt delivery, COD, warranty (JUJBR 2024, n=219) | Peer-reviewed | Honest badges, no fake urgency, chat with a human/bot |
| Complaints against ~5,000 Facebook pages (DNCRP 2017–21) | Daily Star | Buyers are scam-wary → chatting with the seller feels safer than a form |
| Android ≈ 95% of devices (Bikroy estimate); StatCounter shows Android 11–16 spread, no single dominant version | Bikroy (unverified), StatCounter | Assume mid/low-end Android, 2–4 GB RAM, WebGL 1/2, mobile data |
| Bangla / mixed Bangla-English content engages better than English-only in BD (hashmeta guide) | Vendor guide, no controlled test | Bangla-first UI, English words only where they are the normal word (Messenger, WhatsApp, view) |

**Key takeaway (বাংলায়):** ক্রেতা Facebook ad-এ tap করে, মোবাইল ডেটায়, মাঝারি Android-এ আসে। সে form fill করতে চায় না, **কথা বলে কিনতে চায়**, আর ক্যাশ অন ডেলিভারি চায়। তাই store-এর "Buy" মানে **Messenger/WhatsApp-এ chat খোলা**, যেখানে GTM bot আগে থেকেই product-টা জানে।

---

## 3. Reference experiences — pattern (কখনও asset নয়)

| Reference | What we borrow (pattern only) | What we skip |
|---|---|---|
| **Nike 3D store concept (video idea)** | Bottom section pills, camera glide to a wall, click-to-focus with side panel, neutral room | Any Nike branding, products, poster art, layout art — all original Ghor Bazar |
| **Obsess** (Charlotte Tilbury, others) | Hotspot on product → panel with price + add-to-cart; mobile-first; guided "host" idea → our coach mark | Avatars, live events, shop-with-friends (Phase 3+) |
| **Emperia** | Products as objects in a navigable space with direct checkout link | Photoreal 3D models (too heavy for 4G) |
| **Shopify 3D/AR product pages** | The lift comes from focusing on *one* product big; thumbnail strip to swap variants | AR / USDZ (needs real 3D scans) |
| **Charlotte Tilbury virtual store** | Soft studio lighting, white/neutral room so products pop; themed posters on walls | Seasonal avatar customisation |

Common visual language extracted: **off-white walls, light wood accents, soft 2–3 point lighting, products on plain planes, one accent colour for CTAs.**

---

## 4. Hook table — Hook → Why it works → How Phase 1 implements it

| # | Hook | Why it works (evidence) | Phase 1 implementation |
|---|---|---|---|
| 1 | **Instant first paint (<2.5 s on 4G)** | 53% abandon >3 s (Google); white screen = "broken" | Inline-CSS branded loading screen in `index.html` (store name, progress bar, "দোকান খুলছে…") before any JS; Three.js code-split; no 3D models, textures are small PNGs; then a 2 s camera glide |
| 2 | **Guided, not lost** | Free-roam confuses mobile users; navigation must be simple and consistent (WordStream) | Bottom pills (Store · পাঞ্জাবি · শাড়ি · জুতা) → camera tween 900 ms with easing; default camera faces hero wall with brand sign; drag/pinch limited to look-around |
| 3 | **Click-to-focus product** | Shopify/Obsess: conversion lift comes from one big product view | Raycast tap → camera zooms, room blurs (CSS backdrop), side panel with name, ৳ price in Bangla digits, sizes, stock, big CTA |
| 4 | **One-tap buy via chat** | COD + trust: buyers prefer chatting with seller over forms | Primary CTA "Messenger-এ অর্ডার করুন" → `m.me/<page>?ref=<sku>`; secondary WhatsApp → `wa.me/<number>?text=<Bangla order text>`; bot receives SKU automatically |
| 5 | **Thumbnail strip in focus mode** | Variant swapping without leaving focus keeps session going (Shopify pattern) | Left strip of that section's products; tap swaps panel + camera target instantly |
| 6 | **Honest social proof + urgency** | BD buyers are scam-wary; trust drives purchase (JUJBR) | Badges only from JSON fields (`badge`, `viewsToday`, `stock ≤ 3` → "মাত্র ৩টা বাকি"); never generated at runtime |
| 7 | **Lightweight fallback ("সাধারণ view")** | Low-end Android, no WebGL, reduced-motion, slow data | Top-bar toggle → plain 2D grid, same 18 products, same CTAs; auto-switch when WebGL missing, `deviceMemory < 2`, or `prefers-reduced-motion` |
| 8 | **Bangla-first copy** (bonus) | Bangla / mixed content engages better in BD | All strings in `i18n/bn.ts`; Bangla digits for prices; self-hosted Bangla font subset |
| 9 | **Coach mark** (bonus) | Obsess "guided host" idea; first-time users need one hint | 2-line Bangla coach mark, dismissed on first interaction, remembered in localStorage |
| 10 | **Trust posters** (bonus) | COD + delivery promises are the top trust signals | Wall posters: "ঘরে বসে কিনুন", "ক্যাশ অন ডেলিভারি", "সারা দেশে ডেলিভারি", "সাইজ না মিললে বদল" |

All of hooks 1–7 (the required minimum) plus 8–10 are implemented in Phase 1.

---

## 5. Design decisions (traceable)

- **Accent colour: deep teal `#0E7C7B`.** Reason: (a) warm off-white + light wood room needs a *cool* accent to make CTAs pop; (b) teal reads as calm/trustworthy, which matches the "trust" finding; (c) it is not the colour of any major BD payment or telecom brand (bKash pink, Nagad orange, GP blue, Robi red), so the demo store does not look like someone else's brand. Terracotta was considered but it blends into the wood accents.
- **Room palette:** walls `#F4EFE8`, floor light oak `#D9C4A3`, ceiling `#FAF7F2`. Products on neutral planes pop against this (Charlotte Tilbury / studio pattern).
- **No real-time shadows:** a radial floor gradient texture fakes soft contact shadows; keeps mid-range Android at 60 fps.
- **Pixel ratio cap 1.5**, 2 lights (hemisphere + 1 directional) + 1 ambient fill, `MeshStandardMaterial` only.
- **Camera:** fixed presets per wall + overview; look-around limited to ±25° yaw / ±12° pitch; zoom 0.8×–1.4×. No free-fly, no collision code needed.
- **Analytics:** `window.dataLayer.push({event, sku, section})` for `section_view`, `product_focus`, `cta_click`, `fallback_used`, `cart_add` so Phase 3 can wire to the dashboard without changing the UI.

---

## 6. Sources

- Shopify 3D/AR aggregate + Rebecca Minkoff case: https://www.casestudies.com/company/shopify/case-study/in-going-3d-rebecca-minkoffs-customers-became-nearly-30-more-likely-to-buy · https://ecommercefastlane.com/shopify-3d-ar-vr-by-stage/
- 3D Cloud Q2 2026 benchmark: https://3dcloud.com/?p=46586
- Google mobile speed (53% abandon >3 s): https://www.mediapost.com/publications/article/284398/
- Obsess (Charlotte Tilbury virtual store): https://chainstoreage.com/global-beauty-retailer-creates-immersive-virtual-shopping-experience · https://apps.shopify.com/obsessvr-experience
- Emperia: https://mixed-news.com/en/emperias-virtual-store-fronts-preview-the-future-of-ecommerce/
- Bangladesh F-commerce COD study (2024–25): https://zenodo.org/records/17645902
- JUJBR youth F-commerce study (2024): https://jujbr.iba.juniv.edu/jujbr/article/view/51
- Daily Star (2.5 lakh FB shops, complaints): https://www.thedailystar.net/node/2206541
- DHL F-commerce guide (77.7 M internet users): https://www.dhl.com/discover/en-bd/e-commerce-advice/e-commerce-trends/guide-to-f-commerce-in-bangladesh
- Counterpoint BD smartphone shipments: https://counterpointresearch.com/insight/bangladesh-smartphone-shipments-may-see-slight-decline-in-2024-doubledigit-growth-in-2025
- StatCounter Android versions BD: https://gs.statcounter.com/android-version-market-share/mobile-/bangladesh
- Bangla content engagement guide: https://hashmeta.com/blog/social-media-landscape-bangladesh-complete-guide-to-platforms-users-marketing-strategies
- Navigation best practice: https://jump.wordstream.com/ecommerce-navigation-best-practices
