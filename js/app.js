// app.js — UI, navigation and event wiring.

import { store } from './store.js';
import { FOODS, RULES } from './data.js';
import { scanProduct, planDay, fileToScaledDataUrl, testApiKey, analyzeSupplement, analyzeRecipe, extractLabs } from './api.js';

const appEl = document.getElementById('app');
const tabbar = document.getElementById('tabbar');
const modeToggle = document.getElementById('modeToggle');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const eur = (n) => '€' + Number(n || 0).toFixed(2);
const num = (n) => Math.round(Number(n || 0));

// Ephemeral in-memory state for the current session (not persisted).
const state = {
  tab: 'plan',
  checkMode: 'product', // 'product' | 'recipe'
  scan: { dataUrl: null, result: null, loading: false, error: '' },
  recipe: { text: '', result: null, loading: false, error: '' },
  supp: { brand: '', product: '', ingredients: '', loading: false, error: '' },
  labs: { loading: false, error: '' },
  plan: { extra: '', result: null, loading: false, error: '' },
};

// ---------- mode chip ----------
function renderMode() {
  const mode = store.getMode();
  modeToggle.textContent = mode === 'flare' ? '🔥 Flare mode' : '🌿 Remission';
  modeToggle.className = 'mode-chip ' + mode;
}
modeToggle.addEventListener('click', () => {
  store.setMode(store.getMode() === 'flare' ? 'remission' : 'flare');
  renderMode();
  // Recommendations depend on mode → clear stale results.
  state.plan.result = null;
  state.scan.result = null;
  state.recipe.result = null;
  render();
});

// ---------- navigation ----------
tabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  state.tab = btn.dataset.tab;
  render();
  window.scrollTo(0, 0);
});

function render() {
  [...tabbar.children].forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  renderMode();
  if (state.tab === 'plan') renderPlan();
  else if (state.tab === 'check') renderCheck();
  else if (state.tab === 'stack') renderStack();
  else if (state.tab === 'foods') renderFoods();
  else renderProfile();
}

// ================= PLAN =================
function renderPlan() {
  const p = state.plan;
  const t = store.getProfile().targets;

  appEl.innerHTML = `
    <h1>Today's plan</h1>
    <p class="sub">Targets: ${t.kcal} kcal · ${t.protein}g protein · ${t.fat}g fat · ${t.carbs}g carbs</p>

    <div class="card">
      <label>Anything to factor in? (optional)</label>
      <textarea id="planExtra" placeholder="e.g. short on time, have salmon in the fridge, mild symptoms today…">${esc(p.extra)}</textarea>
      <button class="btn" id="planBtn" ${p.loading ? 'disabled' : ''}>
        ${p.loading ? '<span class="spinner"></span> Building your day…' : '🍽️ Build my day'}
      </button>
      ${p.error ? `<div class="error">${esc(p.error)}</div>` : ''}
    </div>
    <div id="planResult">${p.result ? planResultHtml(p.result) : ''}</div>
  `;

  document.getElementById('planExtra').addEventListener('input', (e) => { p.extra = e.target.value; });
  document.getElementById('planBtn').addEventListener('click', runPlan);
}

async function runPlan() {
  const p = state.plan;
  p.loading = true; p.error = ''; renderPlan();
  try {
    p.result = await planDay(p.extra);
  } catch (e) {
    p.error = e.message;
  } finally {
    p.loading = false;
    renderPlan();
  }
}

function planResultHtml(r) {
  const t = r.totals || {};
  const meals = (r.meals || []).map((m) => `
    <div class="meal">
      <h3>${esc(m.name)} <span class="time">${esc(m.time)}</span></h3>
      <ul>${(m.items || []).map((i) => `<li>${esc(i.food)} — <b>${esc(i.amount)}</b> · ${num(i.protein_g)}g P · ${num(i.kcal)} kcal</li>`).join('')}</ul>
      <div class="mmac">Meal: ${num(m.meal_protein_g)}g protein · ${num(m.meal_kcal)} kcal${m.notes ? ' — ' + esc(m.notes) : ''}</div>
    </div>`).join('');

  const shop = (r.shopping_list || []).map((s) => `
    <div class="shop-item"><span>${esc(s.item)}<span class="store-tag">${esc(s.store)}</span></span><span class="price">${eur(s.approx_price_eur)}</span></div>`).join('');
  const shopTotal = (r.shopping_list || []).reduce((a, s) => a + Number(s.approx_price_eur || 0), 0);

  return `
    <div class="card">
      <p class="note">${esc(r.day_summary)}</p>
      <div class="macro-grid" style="margin-top:12px">
        <div class="macro"><b>${num(t.kcal)}</b><span>kcal</span></div>
        <div class="macro"><b>${num(t.protein_g)}g</b><span>protein</span></div>
        <div class="macro"><b>${num(t.fat_g)}g</b><span>fat</span></div>
        <div class="macro"><b>${num(t.carbs_g)}g</b><span>carbs</span></div>
      </div>
    </div>
    <div class="card">${meals}</div>
    ${shop ? `<div class="card"><h2 style="margin-top:0">🛒 Shopping list <span class="note">≈ ${eur(shopTotal)}</span></h2>${shop}</div>` : ''}
    ${(r.coaching_notes || []).length ? `<div class="card"><h2 style="margin-top:0">Coach notes</h2><ul class="note">${r.coaching_notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
  `;
}

// ================= CHECK (product photo + recipe) =================
function renderCheck() {
  const seg = ['product', 'recipe'].map((m) => `
    <button class="pill ${state.checkMode === m ? 'active' : ''}" data-checkmode="${m}">${m === 'product' ? '📷 Product' : '📝 Recipe'}</button>`).join('');

  appEl.innerHTML = `
    <h1>Check</h1>
    <p class="sub">Evaluate anything against your muscle + gut goals.</p>
    <div class="pill-row">${seg}</div>
    <div id="checkBody">${state.checkMode === 'product' ? productHtml() : recipeHtml()}</div>
  `;

  appEl.querySelector('.pill-row').addEventListener('click', (e) => {
    const b = e.target.closest('.pill');
    if (!b) return;
    state.checkMode = b.dataset.checkmode;
    renderCheck();
  });

  if (state.checkMode === 'product') wireProduct();
  else wireRecipe();
}

// ---- Product photo ----
function productHtml() {
  const s = state.scan;
  return `
    <div class="card">
      <input id="scanInput" type="file" accept="image/*" capture="environment" class="hidden" />
      <button class="btn" id="pickBtn" ${s.loading ? 'disabled' : ''}>📷 Take / choose photo</button>
      ${s.dataUrl ? `<img class="preview" src="${s.dataUrl}" alt="product" />` : ''}
      ${s.dataUrl && !s.loading ? `<button class="btn secondary" id="analyzeBtn">🔍 Analyse this product</button>` : ''}
      ${s.loading ? `<p class="note" style="margin-top:12px"><span class="spinner"></span> Reading the label…</p>` : ''}
      ${s.error ? `<div class="error">${esc(s.error)}</div>` : ''}
    </div>
    <div id="scanResult">${s.result ? scanResultHtml(s.result) : ''}</div>
    ${renderScanHistory()}
  `;
}

function wireProduct() {
  const s = state.scan;
  const input = document.getElementById('scanInput');
  document.getElementById('pickBtn').addEventListener('click', () => input.click());
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    s.error = ''; s.result = null;
    try { s.dataUrl = await fileToScaledDataUrl(file); }
    catch (err) { s.error = err.message; }
    renderCheck();
  });
  const analyze = document.getElementById('analyzeBtn');
  if (analyze) analyze.addEventListener('click', runScan);
}

// ---- Recipe ----
function recipeHtml() {
  const r = state.recipe;
  return `
    <div class="card">
      <label>Describe your meal / recipe</label>
      <textarea id="recipeText" style="min-height:130px" placeholder="e.g. Pan-fried chicken breast (200g) with white rice (80g dry), zucchini and a spoon of olive oil, plus 250g Magerquark with blueberries after.">${esc(r.text)}</textarea>
      <button class="btn" id="recipeBtn" ${r.loading ? 'disabled' : ''}>
        ${r.loading ? '<span class="spinner"></span> Evaluating…' : '📝 Evaluate my recipe'}
      </button>
      ${r.error ? `<div class="error">${esc(r.error)}</div>` : ''}
    </div>
    <div id="recipeResult">${r.result ? recipeResultHtml(r.result) : ''}</div>
  `;
}

function wireRecipe() {
  const r = state.recipe;
  document.getElementById('recipeText').addEventListener('input', (e) => { r.text = e.target.value; });
  document.getElementById('recipeBtn').addEventListener('click', runRecipe);
}

async function runRecipe() {
  const r = state.recipe;
  if (!r.text.trim()) { r.error = 'Describe your meal first.'; renderCheck(); return; }
  r.loading = true; r.error = ''; renderCheck();
  try { r.result = await analyzeRecipe(r.text); }
  catch (e) { r.error = e.message; }
  finally { r.loading = false; renderCheck(); }
}

function recipeResultHtml(r) {
  const swaps = (r.swaps || []).map((s) => `<li><b>${esc(s.from)}</b> → ${esc(s.to)} <span class="note">— ${esc(s.why)}</span></li>`).join('');
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <h2 style="margin:0">${esc(r.dish_name)}</h2>
        <span class="verdict ${esc(r.verdict)}">${esc(r.verdict)}</span>
      </div>
      <div class="macro-grid" style="margin-top:12px">
        <div class="macro"><b>${num(r.estimated_protein_g)}g</b><span>protein est.</span></div>
        <div class="macro"><b>${num(r.estimated_kcal)}</b><span>kcal est.</span></div>
        <div class="macro" style="grid-column: span 2"><b style="font-size:14px">${esc(r.verdict)}</b><span>overall fit</span></div>
      </div>
      <h2>Gut / UC</h2><p class="note">${esc(r.uc_assessment)}</p>
      <h2>Muscle</h2><p class="note">${esc(r.muscle_assessment)}</p>
      ${(r.improvements || []).length ? `<h2>Improvements</h2><ul class="note">${r.improvements.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      ${swaps ? `<h2>Swaps</h2><ul class="note">${swaps}</ul>` : ''}
      ${r.upgraded_version ? `<h2>Upgraded version</h2><p class="note">${esc(r.upgraded_version).replace(/\n/g, '<br>')}</p>` : ''}
    </div>`;
}

async function runScan() {
  const s = state.scan;
  s.loading = true; s.error = ''; renderCheck();
  try {
    s.result = await scanProduct(s.dataUrl);
    store.addScan({ ...s.result, at: Date.now() });
  } catch (e) {
    s.error = e.message;
  } finally {
    s.loading = false;
    renderCheck();
  }
}

function scanResultHtml(r) {
  const flags = (r.key_flags || []).map((f) => `<span class="flag">${esc(f)}</span>`).join('');
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <h2 style="margin:0">${esc(r.product_name)}</h2>
        <span class="verdict ${esc(r.verdict)}">${esc(r.verdict)}</span>
      </div>
      <p class="note" style="margin-top:8px">${esc(r.verdict_reason)}</p>
      <div class="flags">${flags}</div>
      <h2>Gut / UC</h2><p class="note">${esc(r.uc_assessment)}</p>
      <h2>Muscle</h2><p class="note">${esc(r.muscle_assessment)} ${r.protein_per_100g_g ? `<b>(~${num(r.protein_per_100g_g)}g protein/100g)</b>` : ''}</p>
      ${r.better_alternative ? `<h2>Better pick</h2><p class="note">➡️ ${esc(r.better_alternative)}</p>` : ''}
    </div>`;
}

function renderScanHistory() {
  const scans = store.getScans();
  if (!scans.length) return '';
  const rows = scans.map((h) => `
    <div class="shop-item"><span>${esc(h.product_name)}</span><span class="verdict ${esc(h.verdict)}" style="font-size:11px;padding:3px 8px">${esc(h.verdict)}</span></div>`).join('');
  return `<div class="card"><h2 style="margin-top:0">Recent scans</h2>${rows}<button class="btn secondary" id="clearScans">Clear history</button></div>`;
}

// ================= STACK (supplements) =================
function renderStack() {
  const s = state.supp;
  const saved = store.getSupps();
  const list = saved.length ? saved.map(suppCardHtml).join('') : '<p class="note">No supplements saved yet. Add one above to check it against your goals.</p>';

  appEl.innerHTML = `
    <h1>Supplement stack</h1>
    <p class="sub">Add what you take → ingredient-level check for muscle fit & UC compatibility.</p>

    <div class="card">
      <div class="row">
        <div><label>Brand</label><input id="suppBrand" placeholder="e.g. ESN" value="${esc(s.brand)}" /></div>
        <div><label>Product</label><input id="suppProduct" placeholder="e.g. Isoclear Whey Isolate" value="${esc(s.product)}" /></div>
      </div>
      <label>Ingredient list (optional — paste from the label for the most accurate check)</label>
      <textarea id="suppIngredients" placeholder="Whey protein isolate, emulsifier (sunflower lecithin), flavouring, sweeteners (sucralose)…">${esc(s.ingredients)}</textarea>
      <button class="btn" id="suppBtn" ${s.loading ? 'disabled' : ''}>
        ${s.loading ? '<span class="spinner"></span> Analysing…' : '💊 Analyse & add'}
      </button>
      ${s.error ? `<div class="error">${esc(s.error)}</div>` : ''}
    </div>

    <h2>Your stack</h2>
    ${list}
  `;

  document.getElementById('suppBrand').addEventListener('input', (e) => { s.brand = e.target.value; });
  document.getElementById('suppProduct').addEventListener('input', (e) => { s.product = e.target.value; });
  document.getElementById('suppIngredients').addEventListener('input', (e) => { s.ingredients = e.target.value; });
  document.getElementById('suppBtn').addEventListener('click', runSupp);
}

async function runSupp() {
  const s = state.supp;
  if (!s.brand.trim() && !s.product.trim()) { s.error = 'Enter at least a brand or product name.'; renderStack(); return; }
  s.loading = true; s.error = ''; renderStack();
  try {
    const result = await analyzeSupplement(s.brand, s.product, s.ingredients);
    store.addSupp({ result, at: Date.now() });
    s.brand = ''; s.product = ''; s.ingredients = '';
  } catch (e) {
    s.error = e.message;
  } finally {
    s.loading = false;
    renderStack();
  }
}

function suppCardHtml(entry) {
  const r = entry.result || {};
  const flags = (r.flagged_ingredients || []).map((f) => `<li><b>${esc(f.ingredient)}</b> — ${esc(f.concern)}</li>`).join('');
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <h2 style="margin:0">${esc(r.product_name || 'Supplement')}</h2>
        <span class="verdict ${esc(r.verdict)}">${esc(r.verdict)}</span>
      </div>
      <p class="note" style="margin-top:6px">${esc(r.category || '')} — ${esc(r.verdict_reason || '')}</p>
      <h2>Gut / UC</h2><p class="note">${esc(r.uc_assessment || '')}</p>
      <h2>Muscle</h2><p class="note">${esc(r.muscle_assessment || '')}</p>
      ${flags ? `<h2>Flagged ingredients ⚠️</h2><ul class="note">${flags}</ul>` : ''}
      ${r.dosing_tip ? `<h2>Dosing</h2><p class="note">${esc(r.dosing_tip)}</p>` : ''}
      ${r.keep_or_swap ? `<h2>Keep or swap</h2><p class="note">${esc(r.keep_or_swap)}</p>` : ''}
      <button class="btn secondary" data-remove-supp="${esc(entry.id)}">Remove</button>
    </div>`;
}

// ================= FOODS =================
function renderFoods() {
  const mode = store.getMode();
  const cats = [...new Set(FOODS.map((f) => f.cat))];
  const sections = cats.map((cat) => {
    const items = FOODS.filter((f) => f.cat === cat).map((f) => `
      <div class="food">
        <span class="dot ${f.uc}"></span>
        <div style="flex:1">
          <div><b>${esc(f.de)}</b> <span class="fmeta">${esc(f.en)}</span></div>
          <div class="fmeta">${f.protein}g protein · ${f.kcal} kcal /100g · ${esc(f.store)}</div>
          <div class="fmeta">${esc(f.note)}</div>
        </div>
      </div>`).join('');
    return `<div class="card"><h2 style="margin-top:0">${esc(cat)}</h2>${items}</div>`;
  }).join('');

  const rules = (mode === 'flare' ? RULES.flare : RULES.remission);
  appEl.innerHTML = `
    <h1>Good buys</h1>
    <p class="sub">Rewe/Edeka staples for muscle + gut. <span style="color:var(--green)">●</span> both modes · <span style="color:var(--blue)">●</span> remission · <span style="color:var(--amber)">●</span> test tolerance</p>
    <div class="card">
      <h2 style="margin-top:0">${mode === 'flare' ? '🔥 Flare' : '🌿 Remission'} rules</h2>
      <ul class="note">${rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    </div>
    ${sections}
  `;
}

// ================= PROFILE =================
function labMarkersHtml(markers) {
  const order = { critical: 0, high: 1, low: 1, unknown: 2, normal: 3 };
  const sorted = [...markers].sort((a, b) => (order[a.flag] ?? 3) - (order[b.flag] ?? 3));
  const dot = (f) => (f === 'normal' ? 'both' : f === 'unknown' ? 'remission' : 'caution');
  const rows = sorted.map((m) => `
    <div class="food">
      <span class="dot ${dot(m.flag)}"></span>
      <div style="flex:1">
        <div><b>${esc(m.name)}</b> ${esc(m.value)}${m.unit ? ' ' + esc(m.unit) : ''} ${m.flag && m.flag !== 'normal' ? `<span class="flag">${esc(m.flag)}</span>` : ''}</div>
        <div class="fmeta">${m.reference_range ? `ref ${esc(m.reference_range)} · ` : ''}${esc(m.category || '')}${m.date ? ` · ${esc(m.date)}` : ''}</div>
      </div>
    </div>`).join('');
  return `<div style="margin-top:12px">${rows}</div>`;
}

function labsCardHtml() {
  const l = state.labs;
  const labs = store.getLabs();
  const markers = Object.values(labs.markers);
  const last = labs.uploads[0];
  const body = markers.length
    ? labMarkersHtml(markers)
    : '<p class="note">No labs yet. Upload a PDF to personalise every recommendation to your bloodwork.</p>';
  return `
    <div class="card">
      <h2 style="margin-top:0">🩸 Blood labs</h2>
      <p class="note">Upload your latest lab report (PDF). Markers are stored and merged — the newest value per marker is kept and used across Plan, Check &amp; Stack. The PDF is sent to Claude to read it; only the extracted markers are saved on this device.</p>
      <input id="labInput" type="file" accept="application/pdf,.pdf" class="hidden" />
      <button class="btn secondary" id="labUploadBtn" ${l.loading ? 'disabled' : ''}>${l.loading ? '<span class="spinner"></span> Reading report…' : '📄 Upload lab PDF'}</button>
      ${l.error ? `<div class="error">${esc(l.error)}</div>` : ''}
      ${last ? `<p class="note" style="margin-top:10px">Last upload: ${new Date(last.at).toLocaleDateString()}${last.lab_date ? ` · report dated ${esc(last.lab_date)}` : ''} · +${last.added} new, ${last.updated} updated, ${last.kept} kept.${last.summary ? '<br>' + esc(last.summary) : ''}</p>` : ''}
      ${body}
      ${markers.length ? `<button class="btn secondary" id="clearLabs">Clear lab data</button>` : ''}
    </div>`;
}

async function runLab(file) {
  if (!file) return;
  const l = state.labs;
  l.loading = true; l.error = ''; renderProfile();
  try {
    const extraction = await extractLabs(file);
    if (!extraction.markers || !extraction.markers.length) {
      l.error = extraction.summary || 'No lab markers found in that PDF.';
    } else {
      store.mergeLabResult(extraction, file.name);
    }
  } catch (e) {
    l.error = e.message;
  } finally {
    l.loading = false;
    renderProfile();
  }
}

function renderProfile() {
  const p = store.getProfile();
  const hasKey = !!store.getApiKey();
  appEl.innerHTML = `
    <h1>Profile & settings</h1>
    <p class="sub">Everything here is stored only on this device.</p>

    <div class="card">
      <h2 style="margin-top:0">Anthropic API key</h2>
      <p class="note">Powers scanning & planning. Create one at console.anthropic.com. Stored locally, sent only to Claude.</p>
      <input id="apiKey" type="password" placeholder="sk-ant-…" value="${esc(store.getApiKey())}" />
      <div class="row">
        <button class="btn secondary" id="saveKey">Save key</button>
        <button class="btn secondary" id="testKey">Test key</button>
      </div>
      <div id="keyStatus" class="note" style="margin-top:8px">${hasKey ? '🔑 Key saved.' : '⚠️ No key yet — scanning & planning need one.'}</div>
    </div>

    <div class="card">
      <h2 style="margin-top:0">You</h2>
      <div class="row">
        <div><label>Weight (kg)</label><input id="weightKg" type="number" value="${p.weightKg}" /></div>
        <div><label>Height (cm)</label><input id="heightCm" type="number" value="${p.heightCm}" /></div>
        <div><label>Age</label><input id="age" type="number" value="${p.age}" /></div>
      </div>
      <label>Known personal trigger foods (comma separated)</label>
      <textarea id="triggers" placeholder="e.g. sweetcorn, raw onion, whole milk">${esc(p.triggers)}</textarea>
    </div>

    ${labsCardHtml()}

    <div class="card">
      <h2 style="margin-top:0">Daily targets</h2>
      <div class="row">
        <div><label>Calories</label><input id="tk" type="number" value="${p.targets.kcal}" /></div>
        <div><label>Protein (g)</label><input id="tp" type="number" value="${p.targets.protein}" /></div>
      </div>
      <div class="row">
        <div><label>Fat (g)</label><input id="tf" type="number" value="${p.targets.fat}" /></div>
        <div><label>Carbs (g)</label><input id="tc" type="number" value="${p.targets.carbs}" /></div>
      </div>
      <button class="btn" id="saveProfile">Save profile</button>
      <div id="profStatus" class="note" style="margin-top:8px"></div>
    </div>
  `;

  document.getElementById('saveKey').addEventListener('click', () => {
    store.setApiKey(document.getElementById('apiKey').value);
    document.getElementById('keyStatus').textContent = '🔑 Key saved.';
  });
  const labInput = document.getElementById('labInput');
  const labBtn = document.getElementById('labUploadBtn');
  if (labBtn && labInput) {
    labBtn.addEventListener('click', () => labInput.click());
    labInput.addEventListener('change', (e) => runLab(e.target.files?.[0]));
  }
  const clearLabsBtn = document.getElementById('clearLabs');
  if (clearLabsBtn) clearLabsBtn.addEventListener('click', () => { store.clearLabs(); renderProfile(); });
  document.getElementById('testKey').addEventListener('click', async () => {
    const st = document.getElementById('keyStatus');
    store.setApiKey(document.getElementById('apiKey').value);
    st.innerHTML = '<span class="spinner"></span> Testing…';
    try { await testApiKey(); st.textContent = '✅ Key works.'; }
    catch (e) { st.textContent = '❌ ' + e.message; }
  });
  document.getElementById('saveProfile').addEventListener('click', () => {
    const np = store.getProfile();
    np.weightKg = +document.getElementById('weightKg').value || np.weightKg;
    np.heightCm = +document.getElementById('heightCm').value || np.heightCm;
    np.age = +document.getElementById('age').value || np.age;
    np.triggers = document.getElementById('triggers').value.trim();
    np.targets = {
      kcal: +document.getElementById('tk').value || np.targets.kcal,
      protein: +document.getElementById('tp').value || np.targets.protein,
      fat: +document.getElementById('tf').value || np.targets.fat,
      carbs: +document.getElementById('tc').value || np.targets.carbs,
    };
    store.setProfile(np);
    document.getElementById('profStatus').textContent = '✅ Saved.';
  });
}

// Delegated: clear scan history button (rendered conditionally).
appEl.addEventListener('click', (e) => {
  if (e.target.id === 'clearScans') { store.clearScans(); renderCheck(); }
  const rm = e.target.closest('[data-remove-supp]');
  if (rm) { store.removeSupp(rm.dataset.removeSupp); renderStack(); }
});

// ---------- boot ----------
render();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
