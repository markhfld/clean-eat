// api.js — direct browser calls to the Anthropic Claude API.
// The user's own API key is stored on-device and sent with each request.
// Requires the anthropic-dangerous-direct-browser-access header for CORS.

import { store } from './store.js';
import {
  MODELS, buildSystemPrompt, SCAN_SCHEMA, SCAN_INSTRUCTION,
  PLAN_SCHEMA, buildPlanInstruction,
  SUPP_SCHEMA, buildSuppInstruction,
  RECIPE_SCHEMA, buildRecipeInstruction,
} from './data.js';

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
  const profile = store.getProfile();
  const mode = store.getMode();

  const { text } = await callClaude({
    model: MODELS.scan,
    system: buildSystemPrompt(profile, mode),
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

export async function planDay(session, extra) {
  const profile = store.getProfile();
  const mode = store.getMode();
  const { text } = await callClaude({
    model: MODELS.plan,
    system: buildSystemPrompt(profile, mode),
    schema: PLAN_SCHEMA,
    max_tokens: 4096,
    thinking: true,
    messages: [{ role: 'user', content: buildPlanInstruction(session, extra) }],
  });
  return parseJson(text);
}

export async function analyzeSupplement(brand, product, ingredients) {
  const profile = store.getProfile();
  const mode = store.getMode();
  const { text } = await callClaude({
    model: MODELS.plan,
    system: buildSystemPrompt(profile, mode),
    schema: SUPP_SCHEMA,
    max_tokens: 1500,
    thinking: true,
    messages: [{ role: 'user', content: buildSuppInstruction(brand, product, ingredients) }],
  });
  return parseJson(text);
}

export async function analyzeRecipe(recipeText) {
  const profile = store.getProfile();
  const mode = store.getMode();
  const { text } = await callClaude({
    model: MODELS.plan,
    system: buildSystemPrompt(profile, mode),
    schema: RECIPE_SCHEMA,
    max_tokens: 2000,
    thinking: true,
    messages: [{ role: 'user', content: buildRecipeInstruction(recipeText) }],
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
