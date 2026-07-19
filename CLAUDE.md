# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Clean Eat** — a personal, phone-first nutrition assistant (PWA) for one person. It optimises every recommendation for **two simultaneous goals**:

1. **Lean muscle gain** — ~200 g protein/day on a slight, steady calorie surplus.
2. **Ulcerative colitis (colitis ulcerosa)** — avoid flare-provoking foods; steer toward remission.

These goals often conflict (classic bulking foods can irritate the gut). The whole app exists to resolve that tension: **the UC constraint always wins**, and the app offers a gut-friendly swap.

## Architecture — the big picture

Dependency-free static PWA. **No backend, no build step.** It calls the **Anthropic Claude API directly from the browser** using the user's own key.

- **Direct browser → Claude calls** live only in `js/api.js`. They POST to `https://api.anthropic.com/v1/messages` with headers `x-api-key`, `anthropic-version: 2023-06-01`, and critically `anthropic-dangerous-direct-browser-access: true` (required for CORS from a browser). Removing that header breaks every request.
- **The knowledge lives in `js/data.js`**, not scattered in prompts. It holds the profile defaults, daily targets, the `RULES` object (separate `muscle` / `remission` / `flare` rule sets), the curated **`FOODS`** database of real Rewe/Edeka staples, and the prompt/schema builders. `buildSystemPrompt(profile, mode)` assembles profile + targets + the mode-appropriate UC rules + the food table into one system prompt used by **both** scan and plan calls — so the two features stay consistent. To change nutrition behaviour, edit `data.js`, not the individual call sites.
- **Structured outputs** guarantee parseable JSON: `SCAN_SCHEMA` and `PLAN_SCHEMA` are passed as `output_config.format = { type: 'json_schema', schema }`. Schemas must set `additionalProperties: false` and list every property in `required` (JSON-schema subset — no min/max, no minLength). `api.js#parseJson` is a defensive fallback.
- **Models:** `MODELS.scan = claude-sonnet-4-6` (fast/cheap vision, thinking off) and `MODELS.plan = claude-opus-4-8` (adaptive thinking on for meal-plan quality). See `callClaude` in `api.js`.
- **State** is browser-only (`js/store.js` → `localStorage`): API key, profile, UC mode, recent scans. Nothing leaves the device except explicit scan/plan requests.
- **UI** (`js/app.js`) is a tiny hand-rolled SPA: five tabs render template strings into `#app` — `plan` (day generator), `check` (segmented **Product** photo scan / **Recipe** text evaluation), `stack` (supplements), `foods` (reference DB), `profile`. A top-bar chip toggles flare↔remission and clears mode-dependent results. No framework.
- **Five Claude features, all through `data.js` builders + `api.js` callers:** `scanProduct` (vision), `planDay`, `analyzeSupplement` (ingredient-level UC/muscle check, saved to the stack), `analyzeRecipe` (evaluate a described meal + swaps), and `extractLabs` (PDF → structured markers via a `{type:"document"}` base64 block). Each has its own `*_SCHEMA` and `build*Instruction` in `data.js`.
- **Blood labs personalise everything.** `api.js#currentSystem()` builds the shared system prompt from profile + mode + `store.getLabMarkers()`, so all four recommendation calls see the user's current bloodwork (`buildSystemPrompt` takes a 3rd `labMarkers` arg; `buildLabsSection` renders it). Labs persist in `store` as a **merged map** keyed by lowercased marker name: `mergeLabResult` keeps the most recent value per marker (compare by lab date via `labTime()`, then upload time), so uploads with differing marker sets accumulate rather than overwrite. The system prompt's third job is OVERALL HEALTH — nudge out-of-range markers toward optimal within the UC constraint; it also instructs a "see your doctor" flag for concerning values (this is nutrition guidance, not diagnosis).

## Flare vs remission mode

The mode chip (top-right) switches `store.getMode()` between `'flare'` and `'remission'`. This changes which rule block `buildSystemPrompt` injects, so scans and plans give different advice. When editing, keep the three `RULES` blocks meaningfully distinct — flare = low-residue/low-fibre/gentle; remission = anti-inflammatory + gradual widening.

## No workout/training coupling

The app is intentionally **decoupled from the user's workouts** — meal plans do not take training sessions as input. There is a local `gym-plan/` folder (an export of a separate claude.ai project) but it is git-ignored, not read by the app, and must not be wired back in. Keep the nutrition side independent unless the user explicitly asks to reconnect it.

## Running & deploying

- Local: `python3 -m http.server 8000` then open `http://localhost:8000` (ES modules require `http://`, not `file://`).
- Deploy: static files → GitHub Pages (no build). Open the Pages URL on the phone and Add to Home Screen.
- No test suite or linter is configured; it's plain ES-module JavaScript.

## Conventions

- Keep it dependency-free and buildless — that's the deploy story. Don't introduce npm/bundlers without reason.
- All Claude calls go through `callClaude` in `api.js`; don't add `fetch` to the API elsewhere.
- Nutrition facts, food data, and rules belong in `data.js`, kept honest — never assert a food is UC-safe if it's a known irritant.
- This is decision-support, not medical advice; preserve that framing in user-facing copy.
