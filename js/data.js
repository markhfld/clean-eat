// data.js — static knowledge: profile defaults, targets, nutrition rules,
// curated Rewe/Edeka product database, and the Claude prompt builders.

export const MODELS = {
  // Vision scans: fast + cheap + strong vision. Meal planning: most capable.
  scan: 'claude-sonnet-4-6',
  plan: 'claude-opus-4-8',
};

export const DEFAULT_PROFILE = {
  name: 'Mark',
  sex: 'male',
  age: 41,
  weightKg: 65,
  heightCm: 178,
  goal: 'Lean muscle gain — look ripped and sporty. Trains weightlifting 4–5×/week.',
  condition: 'Ulcerative colitis (colitis ulcerosa). Goal: no flare-provoking foods; long-term reduce symptoms toward remission.',
  triggers: '', // user-known personal trigger foods, free text
  targets: {
    kcal: 2650, // slight surplus over ~2400 maintenance for lean gain
    protein: 200, // g/day (user target)
    fat: 65,      // g/day
    carbs: 300,   // g/day
  },
};

// A rolling read-only mirror of the gym-plan (updated by the separate claude.ai
// "Gym Plan" project). Used only to time carbs/protein around training.
export const TRAINING_WEEK = [
  { day: 'Sun', session: 'Upper C — Pull & arms' },
  { day: 'Mon', session: 'Rest' },
  { day: 'Tue', session: 'Rest' },
  { day: 'Wed', session: 'Upper A — Chest focus' },
  { day: 'Thu', session: 'Legs' },
  { day: 'Fri', session: 'Rest' },
  { day: 'Sat', session: 'Upper B' },
];

export const SESSION_OPTIONS = ['Rest', 'Upper body', 'Leg day', 'Full body / other'];

// Curated staples available in Rewe / Edeka online shops (Germany).
// Macros are per 100 g (approx.). uc: 'both' = fine flare & remission,
// 'remission' = introduce only when stable, 'caution' = individual tolerance.
export const FOODS = [
  { de: 'Magerquark (0,2%)', en: 'Low-fat quark', cat: 'Protein / dairy', protein: 12, kcal: 67, store: 'Rewe/Edeka', uc: 'both', note: 'Protein workhorse. Lactose-free versions exist if lactose bothers you.' },
  { de: 'Skyr natur', en: 'Skyr', cat: 'Protein / dairy', protein: 11, kcal: 63, store: 'Rewe/Edeka', uc: 'both', note: 'Thick, high-protein, low lactose. Great snack base.' },
  { de: 'Körniger Frischkäse', en: 'Cottage cheese', cat: 'Protein / dairy', protein: 12, kcal: 98, store: 'Rewe/Edeka', uc: 'both', note: 'Gentle, high protein.' },
  { de: 'Harzer Käse', en: 'Harzer cheese', cat: 'Protein / dairy', protein: 30, kcal: 125, store: 'Rewe/Edeka', uc: 'caution', note: 'Very lean & protein-dense but strong — test tolerance.' },
  { de: 'Eier (Größe M)', en: 'Eggs', cat: 'Protein', protein: 13, kcal: 143, store: 'Rewe/Edeka', uc: 'both', note: 'Highly tolerated protein. Anti-inflammatory yolks.' },
  { de: 'Hähnchenbrustfilet', en: 'Chicken breast', cat: 'Protein / meat', protein: 23, kcal: 105, store: 'Rewe/Edeka', uc: 'both', note: 'Lean, skinless. Bake or pan with olive oil.' },
  { de: 'Putenbrustfilet', en: 'Turkey breast', cat: 'Protein / meat', protein: 24, kcal: 110, store: 'Rewe/Edeka', uc: 'both', note: 'Lean alternative to chicken.' },
  { de: 'Lachsfilet', en: 'Salmon fillet', cat: 'Protein / fish', protein: 20, kcal: 208, store: 'Rewe/Edeka', uc: 'both', note: 'Omega-3, actively anti-inflammatory. 2–3×/week.' },
  { de: 'Forelle / Makrele', en: 'Trout / mackerel', cat: 'Protein / fish', protein: 20, kcal: 170, store: 'Rewe/Edeka', uc: 'both', note: 'Oily fish, omega-3.' },
  { de: 'Thunfisch in Wasser', en: 'Canned tuna in water', cat: 'Protein / fish', protein: 24, kcal: 108, store: 'Rewe/Edeka', uc: 'both', note: 'Convenient lean protein.' },
  { de: 'Tofu natur', en: 'Firm tofu', cat: 'Protein / plant', protein: 15, kcal: 144, store: 'Rewe/Edeka', uc: 'remission', note: 'Plant protein; soy is fine for most — introduce when stable.' },
  { de: 'Basmati-/weißer Reis', en: 'White / basmati rice', cat: 'Carbs', protein: 3, kcal: 130, store: 'Rewe/Edeka', uc: 'both', note: 'Low-residue carb base. Flare-safe.' },
  { de: 'Kartoffeln', en: 'Potatoes', cat: 'Carbs', protein: 2, kcal: 77, store: 'Rewe/Edeka', uc: 'both', note: 'Peel for flare. Great recovery carb.' },
  { de: 'Haferflocken (fein)', en: 'Fine oats', cat: 'Carbs', protein: 13, kcal: 370, store: 'Rewe/Edeka', uc: 'remission', note: 'Soluble fibre; cook well. Fine oats gentler than coarse.' },
  { de: 'Sauerteigbrot', en: 'Sourdough bread', cat: 'Carbs', protein: 8, kcal: 250, store: 'Rewe/Edeka', uc: 'remission', note: 'Fermented, often better tolerated than standard wholegrain.' },
  { de: 'Reiswaffeln', en: 'Rice cakes', cat: 'Carbs', protein: 8, kcal: 380, store: 'Rewe/Edeka', uc: 'both', note: 'Low-residue quick carb; pair with quark.' },
  { de: 'Banane (reif)', en: 'Ripe banana', cat: 'Fruit', protein: 1, kcal: 89, store: 'Rewe/Edeka', uc: 'both', note: 'Ripe = gentle. Potassium + quick carbs.' },
  { de: 'Heidelbeeren', en: 'Blueberries', cat: 'Fruit', protein: 1, kcal: 57, store: 'Rewe/Edeka', uc: 'both', note: 'Antioxidant, low-irritant berry.' },
  { de: 'Zucchini', en: 'Zucchini (cooked)', cat: 'Vegetable', protein: 1, kcal: 17, store: 'Rewe/Edeka', uc: 'both', note: 'Peel/cook well; very gentle.' },
  { de: 'Karotten (gekocht)', en: 'Cooked carrots', cat: 'Vegetable', protein: 1, kcal: 35, store: 'Rewe/Edeka', uc: 'both', note: 'Well-cooked = low residue, flare-friendly.' },
  { de: 'Spinat (gekocht)', en: 'Cooked spinach', cat: 'Vegetable', protein: 3, kcal: 23, store: 'Rewe/Edeka', uc: 'remission', note: 'Cook down; nutrient dense.' },
  { de: 'Olivenöl nativ extra', en: 'Extra-virgin olive oil', cat: 'Fat', protein: 0, kcal: 884, store: 'Rewe/Edeka', uc: 'both', note: 'Primary cooking fat; anti-inflammatory.' },
  { de: 'Whey Isolat', en: 'Whey protein isolate', cat: 'Supplement', protein: 88, kcal: 360, store: 'dm/Rossmann/online', uc: 'both', note: 'Isolate (not concentrate) is lower-lactose — hits 200 g protein easily.' },
  { de: 'Kreatin Monohydrat', en: 'Creatine monohydrate', cat: 'Supplement', protein: 0, kcal: 0, store: 'dm/Rossmann/online', uc: 'both', note: '5 g/day — well studied, UC-safe, boosts strength/lean mass.' },
];

// ---- Nutrition rules encoded for the model (and shown in-app) ----
export const RULES = {
  muscle: [
    'Protein target ~200 g/day spread across 4–5 meals (~40 g each), including one serving within ~2 h post-training.',
    'Lean gain = slight calorie surplus. Push carbs & total calories higher on TRAINING days (esp. leg day and chest day); keep rest days closer to maintenance.',
    'Prioritise gut-friendly protein: eggs, fish, skinless poultry, quark/skyr, whey ISOLATE. Go easy on large amounts of red/processed meat.',
    'Creatine monohydrate 5 g/day is safe and effective; hydrate well.',
  ],
  remission: [
    'Anti-inflammatory base: oily fish (omega-3), extra-virgin olive oil, cooked vegetables, ripe/peeled fruit, well-cooked whole foods.',
    'Widen the diet GRADUALLY. Cook vegetables rather than raw; peel fruit; favour soluble fibre (oats, banana) over coarse insoluble fibre.',
    'Go easy on: large amounts of raw veg, nuts/seeds, spicy food, fried/greasy food, alcohol, high-sugar foods, and additives (carrageenan, polysorbate-80, sugar alcohols like sorbitol/xylitol).',
    'Fermented dairy (skyr, quark, kefir) is often well tolerated and helps protein targets.',
  ],
  flare: [
    'LOW-RESIDUE, LOW-FIBRE, gentle: white rice, white toast/sourdough, peeled potatoes, ripe banana, well-cooked peeled carrots/zucchini, eggs, skinless poultry, white fish, smooth low-lactose dairy.',
    'AVOID during a flare: raw vegetables, whole grains, nuts/seeds, beans/legumes, sweetcorn, popcorn, fried/high-fat food, spicy food, caffeine, alcohol, sugar alcohols.',
    'Eat smaller, more frequent meals. Hydrate; replace electrolytes.',
    'Still hit protein via gentle sources (eggs, fish, poultry, whey isolate, low-lactose quark) — do not undereat protein just because you are flaring.',
  ],
};

// ---- Prompt builders ----

function foodTable() {
  return FOODS.map(
    (f) => `- ${f.de} (${f.en}) — ${f.protein}g protein / ${f.kcal} kcal per 100g — ${f.store} — UC:${f.uc}${f.note ? ` — ${f.note}` : ''}`
  ).join('\n');
}

export function buildSystemPrompt(profile, mode) {
  const t = profile.targets;
  const modeRules = mode === 'flare' ? RULES.flare : RULES.remission;
  return `You are a precise personal nutrition coach for one user, Mark. You have two jobs at once and must always balance BOTH:

1) MUSCLE / PHYSIQUE: help him build lean muscle and look ripped. He does weightlifting 4–5×/week.
2) ULCERATIVE COLITIS (colitis ulcerosa): every recommendation must avoid provoking gut inflammation, and steer toward long-term symptom reduction.

USER PROFILE
- ${profile.sex}, age ${profile.age}, ${profile.weightKg} kg, ${profile.heightCm} cm.
- Goal: ${profile.goal}
- Condition: ${profile.condition}
- Known personal trigger foods to avoid: ${profile.triggers || '(none specified yet)'}
- Current UC mode: ${mode.toUpperCase()} ${mode === 'flare' ? '(active symptoms)' : '(stable / no active flare)'}

DAILY TARGETS
- Calories ~${t.kcal} kcal (slight surplus for lean gain)
- Protein ~${t.protein} g  |  Fat ~${t.fat} g  |  Carbs ~${t.carbs} g

MUSCLE RULES
${RULES.muscle.map((r) => '- ' + r).join('\n')}

UC RULES FOR CURRENT MODE (${mode.toUpperCase()})
${modeRules.map((r) => '- ' + r).join('\n')}

PREFERRED PRODUCTS (available in Rewe / Edeka Germany — prefer these; realistic German brands/prices in €)
${foodTable()}

STYLE
- Be concrete and practical for German supermarkets. Use grams and realistic portions.
- When the two goals conflict (e.g. a great protein source that may irritate the gut in flare), the UC constraint wins, and you say why and give a swap.
- Never invent that a food is UC-safe if it is a known irritant; flag uncertainty honestly.`;
}

export const SCAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    product_name: { type: 'string' },
    verdict: { type: 'string', enum: ['great', 'good', 'caution', 'avoid'] },
    verdict_reason: { type: 'string' },
    uc_assessment: { type: 'string' },
    muscle_assessment: { type: 'string' },
    protein_per_100g_g: { type: 'number' },
    key_flags: { type: 'array', items: { type: 'string' } },
    better_alternative: { type: 'string' },
  },
  required: [
    'product_name', 'verdict', 'verdict_reason', 'uc_assessment',
    'muscle_assessment', 'protein_per_100g_g', 'key_flags', 'better_alternative',
  ],
};

export const SCAN_INSTRUCTION = `Analyse this supermarket product photo (label / ingredients / packaging).
Decide how well it fits BOTH goals: lean muscle building AND ulcerative-colitis-safe eating for the CURRENT mode above.

Return JSON:
- product_name: what it is.
- verdict: "great" (buy — helps both goals), "good" (fine), "caution" (only sometimes / small amounts / not in flare), or "avoid" (likely irritant or nutritionally poor for him).
- verdict_reason: one crisp sentence.
- uc_assessment: gut/inflammation view — call out additives (carrageenan, polysorbate-80, sugar alcohols), fibre type, fat/spice, lactose.
- muscle_assessment: protein quality/quantity, calories, added sugar.
- protein_per_100g_g: best estimate (0 if truly unknown).
- key_flags: short tags, e.g. ["high protein","contains sorbitol","fried"].
- better_alternative: a specific Rewe/Edeka swap if verdict is caution/avoid, else "".
If the image is not a food product, set verdict "avoid" and explain in verdict_reason.`;

export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    day_summary: { type: 'string' },
    meals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          time: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                food: { type: 'string' },
                amount: { type: 'string' },
                protein_g: { type: 'number' },
                kcal: { type: 'number' },
              },
              required: ['food', 'amount', 'protein_g', 'kcal'],
            },
          },
          meal_protein_g: { type: 'number' },
          meal_kcal: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['name', 'time', 'items', 'meal_protein_g', 'meal_kcal', 'notes'],
      },
    },
    totals: {
      type: 'object',
      additionalProperties: false,
      properties: {
        protein_g: { type: 'number' },
        kcal: { type: 'number' },
        fat_g: { type: 'number' },
        carbs_g: { type: 'number' },
      },
      required: ['protein_g', 'kcal', 'fat_g', 'carbs_g'],
    },
    shopping_list: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          item: { type: 'string' },
          store: { type: 'string' },
          approx_price_eur: { type: 'number' },
          category: { type: 'string' },
        },
        required: ['item', 'store', 'approx_price_eur', 'category'],
      },
    },
    coaching_notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['day_summary', 'meals', 'totals', 'shopping_list', 'coaching_notes'],
};

// ---- Supplements ----
export const SUPP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    product_name: { type: 'string' },
    category: { type: 'string' },
    verdict: { type: 'string', enum: ['great', 'good', 'caution', 'avoid'] },
    verdict_reason: { type: 'string' },
    uc_assessment: { type: 'string' },
    muscle_assessment: { type: 'string' },
    flagged_ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ingredient: { type: 'string' },
          concern: { type: 'string' },
        },
        required: ['ingredient', 'concern'],
      },
    },
    dosing_tip: { type: 'string' },
    keep_or_swap: { type: 'string' },
  },
  required: [
    'product_name', 'category', 'verdict', 'verdict_reason', 'uc_assessment',
    'muscle_assessment', 'flagged_ingredients', 'dosing_tip', 'keep_or_swap',
  ],
};

export function buildSuppInstruction(brand, product, ingredients) {
  return `Evaluate this dietary supplement for Mark, judging BOTH goals: does it help lean-muscle building, AND is it compatible with ulcerative colitis (current mode above)?

Supplement:
- Brand: ${brand || '(not given)'}
- Product: ${product || '(not given)'}
- Ingredient list (as provided; may be partial): ${ingredients || '(not provided — use your best knowledge of this product; if unsure, say so)'}

Do an INGREDIENT-LEVEL review. Specifically flag anything that can aggravate UC or is questionable:
- sugar alcohols (sorbitol, xylitol, maltitol, erythritol), artificial sweeteners, carrageenan, polysorbate-80, other emulsifiers/gums;
- high-dose magnesium/vitamin C (osmotic diarrhoea), high-dose iron (gut irritation), whey CONCENTRATE (more lactose) vs isolate;
- heavy stimulant/pre-workout blends, "proprietary blends", excess additives, artificial colours.
Also confirm genuinely helpful, well-tolerated ingredients (creatine monohydrate, whey isolate, omega-3, vitamin D, electrolytes).

Return JSON:
- product_name: normalised "Brand — Product".
- category: e.g. "Protein (whey isolate)", "Creatine", "Pre-workout", "Omega-3", "Multivitamin".
- verdict: great / good / caution / avoid (for HIM specifically).
- verdict_reason: one crisp sentence.
- uc_assessment: gut/inflammation view, referencing specific ingredients.
- muscle_assessment: does it support his physique goal, and is the dose meaningful?
- flagged_ingredients: array of { ingredient, concern } for anything problematic (empty array if none).
- dosing_tip: how/when to take it for his goals (and to minimise gut impact).
- keep_or_swap: keep it, or a specific better-tolerated alternative available in Germany (dm/Rossmann/Rewe/online).`;
}

// ---- Recipes ----
export const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    dish_name: { type: 'string' },
    verdict: { type: 'string', enum: ['great', 'good', 'caution', 'avoid'] },
    estimated_protein_g: { type: 'number' },
    estimated_kcal: { type: 'number' },
    uc_assessment: { type: 'string' },
    muscle_assessment: { type: 'string' },
    improvements: { type: 'array', items: { type: 'string' } },
    swaps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['from', 'to', 'why'],
      },
    },
    upgraded_version: { type: 'string' },
  },
  required: [
    'dish_name', 'verdict', 'estimated_protein_g', 'estimated_kcal',
    'uc_assessment', 'muscle_assessment', 'improvements', 'swaps', 'upgraded_version',
  ],
};

export function buildRecipeInstruction(text) {
  return `Mark describes a meal / recipe he makes. Evaluate it for BOTH goals: lean-muscle building AND ulcerative-colitis safety (current mode above), then suggest concrete improvements.

His recipe (free text — ingredients and/or method, portions may be rough):
"""
${text}
"""

Return JSON:
- dish_name: a short name for the dish.
- verdict: great / good / caution / avoid (as-is, for him).
- estimated_protein_g and estimated_kcal: best estimate for one portion as described.
- uc_assessment: gut view — call out irritants (raw/insoluble fibre, spice, frying/heavy fat, additives, lactose, sugar alcohols) and what's gut-friendly.
- muscle_assessment: protein adequacy, calorie fit for lean gain, macro balance.
- improvements: 2–5 short, specific, actionable tips (e.g. "swap frying for baking in olive oil", "add 150g quark for +18g protein", "cook the veg down / peel it").
- swaps: array of { from, to, why } concrete ingredient swaps (empty array if none needed).
- upgraded_version: a short improved version of the recipe (a few lines) that keeps the spirit but better hits both goals.`;
}

export function buildPlanInstruction(session, extra) {
  return `Build ONE full day of eating that hits the daily targets as closely as possible.

Context for today:
- Training session today: ${session}. ${
    session === 'Leg day' || session === 'Upper body' || session === 'Full body / other'
      ? 'This is a TRAINING day — bias carbs & total calories up, and place a protein+carb meal after training.'
      : 'This is a REST day — keep calories near maintenance, protein still high.'
  }
- Extra notes from Mark: ${extra || '(none)'}

Requirements:
- 4–5 meals. Every meal shows items with amount, protein_g and kcal.
- Total protein must reach the daily protein target from the profile above. Keep every food compatible with the CURRENT UC mode.
- Prefer the listed Rewe/Edeka products. Include a shopping_list with realistic € prices grouped by category.
- coaching_notes: 2–4 short, specific tips (timing, why a food was chosen for the gut, hydration/creatine).`;
}
