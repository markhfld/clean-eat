// api.js — direct browser calls to the Anthropic Claude API.
// The user's own API key is stored on-device and sent with each request.
// Requires the anthropic-dangerous-direct-browser-access header for CORS.

import { store } from './store.js';
import {
  MODELS, buildSystemPrompt, SCAN_SCHEMA, SCAN_INSTRUCTION,
  PLAN_SCHEMA, buildPlanInstruction,
  SUPP_SCHEMA, buildSuppInstruction,
  SUPP_RECO_SCHEMA, buildSuppRecoInstruction,
  RECIPE_SCHEMA, buildRecipeInstruction,
  LAB_SCHEMA, LAB_INSTRUCTION,
} from './data.js';

// Shared system prompt with the user's current profile, UC mode, and merged blood labs.
function currentSystem() {
  return buildSystemPrompt(store.getProfile(), store.getMode(), store.getLabMarkers());
}

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

async function callClaude({ model, system, messages, max_tokens = 2048, schema, thinking = false }) {
  const apiKey = store.getApiKey();
  if (!apiKey) throw new Error('No API key set. Add your Anthropic API key in Profile → API key.');

  const body = { model, max_tokens, system, messages };
  if (schema) body.output_config = { format: { type: 'json_schema', schema } };
  // Scans run fast with thinking off; planning turns it on for quality.
  if (thinking === true) body.thinking = { type: 'adaptive' };

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('Network error reaching Claude. Check your connection.');
  }

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error?.message) msg = err.error.message;
    } catch { /* keep default */ }
    if (res.status === 401) msg = 'Invalid API key. Check it in Profile → API key.';
    if (res.status === 429) msg = 'Rate limited — wait a moment and try again.';
    throw new Error(msg);
  }

  const data = await res.json();
  if (data.stop_reason === 'max_tokens') {
    throw new Error('The answer got cut off before it finished. Try again (or simplify the request).');
  }
  if (data.stop_reason === 'refusal') {
    throw new Error('The model declined this request. Try rephrasing.');
  }
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return { text, raw: data };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Structured outputs should guarantee clean JSON; this is a safety net.
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Could not read the model response.');
  }
}

// Downscale + JPEG-encode a captured photo to keep tokens/cost low.
export function fileToScaledDataUrl(file, maxEdge = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
    img.src = url;
  });
}

export async function scanProduct(dataUrl) {
  const [, meta, b64] = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/) || [];
  if (!b64) throw new Error('Invalid image.');

  const { text } = await callClaude({
    model: MODELS.scan,
    system: currentSystem(),
    schema: SCAN_SCHEMA,
    max_tokens: 1024,
    thinking: false,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: meta, data: b64 } },
        { type: 'text', text: SCAN_INSTRUCTION },
      ],
    }],
  });
  return parseJson(text);
}

export async function planDay(extra) {
  const { text } = await callClaude({
    model: MODELS.plan,
    system: currentSystem(),
    schema: PLAN_SCHEMA,
    max_tokens: 8192, // room for adaptive-thinking tokens + the full day's JSON
    thinking: true,
    messages: [{ role: 'user', content: buildPlanInstruction(extra) }],
  });
  return parseJson(text);
}

// input: {brand, product, dosage, ingredients}; photos: array of image data-URLs (optional).
export async function analyzeSupplement(input, photos = []) {
  const imageBlocks = [];
  for (const dataUrl of photos) {
    const [, meta, b64] = (dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/) || [];
    if (b64) imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: meta, data: b64 } });
  }
  const instruction = buildSuppInstruction({
    ...input,
    hasProductPhoto: !!photos[0],
    hasIngredientsPhoto: !!photos[1],
  });
  const { text } = await callClaude({
    model: MODELS.plan,
    system: currentSystem(),
    schema: SUPP_SCHEMA,
    max_tokens: 4096, // vision + thinking tokens + JSON
    thinking: true,
    messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: instruction }] }],
  });
  return parseJson(text);
}

// stackList: [{name, category, verdict}] describing the current stack.
export async function recommendSupplements(stackList) {
  const { text } = await callClaude({
    model: MODELS.plan,
    system: currentSystem(),
    schema: SUPP_RECO_SCHEMA,
    max_tokens: 4096,
    thinking: true,
    messages: [{ role: 'user', content: buildSuppRecoInstruction(stackList) }],
  });
  return parseJson(text);
}

export async function analyzeRecipe(recipeText) {
  const { text } = await callClaude({
    model: MODELS.plan,
    system: currentSystem(),
    schema: RECIPE_SCHEMA,
    max_tokens: 4096, // thinking tokens + JSON
    thinking: true,
    messages: [{ role: 'user', content: buildRecipeInstruction(recipeText) }],
  });
  return parseJson(text);
}

// Read any file as base64 (no data-URL prefix, no newlines — required for the API).
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

// Send a lab-report PDF to Claude and get structured markers back.
export async function extractLabs(file) {
  if (file.type && file.type !== 'application/pdf') {
    throw new Error('Please upload a PDF lab report.');
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error('PDF is too large (max ~30 MB).');
  }
  const data = await fileToBase64(file);
  const { text } = await callClaude({
    model: MODELS.plan,
    system: 'You extract structured data from medical laboratory report PDFs accurately. Output only the requested JSON.',
    schema: LAB_SCHEMA,
    max_tokens: 8192,
    thinking: false,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
        { type: 'text', text: LAB_INSTRUCTION },
      ],
    }],
  });
  return parseJson(text);
}

// Lightweight key check — a tiny request that fails fast on a bad key.
export async function testApiKey() {
  await callClaude({
    model: MODELS.scan,
    system: 'Reply with OK.',
    max_tokens: 8,
    messages: [{ role: 'user', content: 'ping' }],
  });
  return true;
}
