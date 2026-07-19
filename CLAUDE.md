# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Clean Eat** — a personal, phone-first nutrition assistant (PWA) for one user, Mark. It optimises every recommendation for **two simultaneous goals**:

1. **Lean muscle gain** — ~200 g protein/day, slight calorie surplus, timed around weightlifting 4–5×/week.
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
- **Four Claude features, all through `data.js` builders + `api.js` callers:** `scanProduct` (vision), `planDay`, `analyzeSupplement` (ingredient-level UC/muscle check, results saved to the stack), `analyzeRecipe` (evaluate a described meal + swaps). Each has its own `*_SCHEMA` and `build*Instruction` in `data.js` and reuses the shared `buildSystemPrompt`.

## Flare vs remission mode

The mode chip (top-right) switches `store.getMode()` between `'flare'` and `'remission'`. This changes which rule block `buildSystemPrompt` injects, so scans and plans give different advice. When editing, keep the three `RULES` blocks meaningfully distinct — flare = low-residue/low-fibre/gentle; remission = anti-inflammatory + gradual widening.

## The `gym-plan/` folder is READ-ONLY

`gym-plan/` is a local export of a **separate** claude.ai "Gym Plan" project (regenerated daily there). Nutrition should *read* the training week to time carbs/protein, but **never edit `gym-plan/`** — local edits don't sync back. `TRAINING_WEEK` in `data.js` is a hand-maintained mirror used for carb timing; update it there, not by writing into `gym-plan/`.

## Running & deploying

- Local: `python3 -m http.server 8000` then open `http://localhost:8000` (ES modules require `http://`, not `file://`).
- Deploy: static files → GitHub Pages (no build). Open the Pages URL on the phone and Add to Home Screen.
- No test suite or linter is configured; it's plain ES-module JavaScript.

## Conventions

- Keep it dependency-free and buildless — that's the deploy story. Don't introduce npm/bundlers without reason.
- All Claude calls go through `callClaude` in `api.js`; don't add `fetch` to the API elsewhere.
- Nutrition facts, food data, and rules belong in `data.js`, kept honest — never assert a food is UC-safe if it's a known irritant.
- This is decision-support, not medical advice; preserve that framing in user-facing copy.
