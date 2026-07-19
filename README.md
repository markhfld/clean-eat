# Clean Eat 🥗

A personal, phone-friendly nutrition assistant that balances **two goals at once**:

1. **Lean muscle** — hit ~200 g protein/day on a slight, steady surplus.
2. **Ulcerative colitis (colitis ulcerosa)** — never provoke a flare, and steer toward long-term remission.

It suggests and plans meals from **Rewe / Edeka** staples, and lets you **photograph a product in the shop** for an instant "good for me / avoid" verdict.

## How it works

A dependency-free static web app (PWA). It calls the **Claude API directly from your phone's browser** using **your own Anthropic API key**, stored only on your device. No backend, no server to run or pay for — just static files.

- **Plan** — build a full day of meals + shopping list to hit your targets, tuned to your UC mode.
- **Check** — two tools in one tab:
  - **Product** — snap a label → verdict (`great / good / caution / avoid`), gut + muscle assessment, better swap.
  - **Recipe** — describe a meal you make → evaluation, estimated protein/kcal, improvements and ingredient swaps.
- **Stack** — add supplements you take (brand + product, optionally paste the ingredient list) → ingredient-level UC compatibility + physique fit, saved to your stack.
- **Foods** — curated Rewe/Edeka buys with per-100g protein/calories and mode rules.
- **Profile** — API key, body stats, targets, known trigger foods, and **blood labs**. All local.
  - **Blood labs** — upload a lab-report **PDF**; Claude extracts your markers (value, unit, reference range, flag, date). Results are **merged and stored** — the newest value per marker is kept across uploads (labs with different marker sets accumulate), and every recommendation (Plan/Check/Stack) is tailored to move out-of-range markers toward healthy while respecting the UC constraint.
- **Mode toggle** (top right) — flip between 🌿 **Remission** and 🔥 **Flare**; recommendations change accordingly.

## Setup

1. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com) (pay-per-use; a scan costs ~cents).
2. Open the app, go to **Profile → API key**, paste it, hit **Test key**.
3. On your phone: open the URL in Safari/Chrome → **Add to Home Screen** for an app-like icon.

## Run locally

Any static server (module scripts need `http://`, not `file://`):

```bash
cd nutrition-assistant
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

Push this folder to a repo and enable Pages (branch = `main`, folder = `/root` or `/docs`). The app is plain static files — no build step. Open the Pages URL on your phone.

## Privacy

**Cross-device sync (optional):** Profile → Cloud sync stores an **end-to-end-encrypted** copy of your data in a **private GitHub gist** (needs a classic GitHub token with only the `gist` scope + a passphrase). It's serverless — GitHub only ever holds ciphertext — and lets your iPhone and laptop share the same data. Off by default.

Your API key, profile, scan history, and blood-lab markers live in your browser's `localStorage`. Data leaves the device only when you make a request to the Claude API — the photo when you scan, the text when you plan/evaluate, and the **lab-report PDF when you upload it** (sent to Claude to read; only the extracted markers are stored, the PDF itself is not).

## Not medical advice

This is a personal decision-support tool, not medical advice. Coordinate significant dietary changes with your gastroenterologist, especially during a flare.

## Structure

- `index.html`, `css/styles.css` — shell + mobile-first UI
- `js/data.js` — profile defaults, targets, UC + muscle **rules**, the Rewe/Edeka **food DB**, and Claude prompt/schema builders
- `js/store.js` — localStorage state
- `js/api.js` — direct browser calls to the Claude API (scan / plan)
- `js/app.js` — views, tab navigation, event wiring
- `sw.js`, `manifest.webmanifest` — PWA (offline shell + install)
- `gym-plan/` — unrelated local folder, git-ignored; the app does **not** use it (nutrition is decoupled from workouts)
