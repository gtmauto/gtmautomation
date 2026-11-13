# GTM Automation — website

Static marketing site for GTM Automation Bangladesh, an AI customer-care bot service. Pages are written in Bengali (`lang="bn"`).

Live site: https://gtmauto.github.io/gtmautomation/

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Landing page |
| `faq.html` | Frequently asked questions |
| `privacy.html` | Privacy policy |
| `terms.html` | Terms of service |

Shared images (favicons, app icon, Open Graph card) live in `assets/`; `bot-bg.svg` is the page background.

## Local preview

No build step — open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

## Deployment

The site is served by GitHub Pages from the `main` branch. Merging to `main` publishes it.
