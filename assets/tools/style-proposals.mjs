// Generates candidate art styles so the team can compare them on /styles.
// Same two subjects (Athena, the Sirens scene) in every style, so only the style differs.
// Uses Meta's Muse Image (https://api.meta.ai/v1, model muse-image-1.0, $0.01/image) when MODEL_API_KEY is set,
// otherwise Gemini's image models (need a paid Gemini key).
// Run: node --env-file=.env assets/tools/style-proposals.mjs
// Output: assets/style-proposals/<style>/{athena,sirens}.png + assets/style-proposals/manifest.json
import { mkdirSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

const META_KEY = process.env.MODEL_API_KEY || process.env.MUSE_API_KEY;
const META_URL = process.env.MUSE_API_URL ?? "https://api.meta.ai/v1";
const MUSE_MODEL = process.env.MUSE_MODEL ?? "muse-image-1.0";
// Muse takes a WxH size that only sets the aspect ratio.
const MUSE_SIZE = { "3:4": "1536x2048", "16:9": "1792x1008", "1:1": "1024x1024" };

const MODELS = (process.env.GEMINI_IMAGE_MODELS ?? "gemini-3.1-flash-image,gemini-2.5-flash-image").split(",");
const out = (p) => new URL(`../style-proposals/${p}`, import.meta.url);

export const STYLES = [
  {
    id: "classical-oil",
    label: "Classical oil painting",
    blurb: "A museum masterpiece: warm candlelight, deep shadows, rich textures.",
    prompt: "Classical oil painting in the style of an 18th-century European academic history painting: dramatic chiaroscuro, warm candlelit golds and deep shadows, visible brushwork, rich fabric and metal textures, museum quality.",
  },
  {
    id: "storybook",
    label: "Illustrated storybook",
    blurb: "Detailed ink and watercolour, like a fine illustrated edition of the Odyssey.",
    prompt: "Detailed ink-and-watercolour illustration from a luxurious illustrated book: fine pen linework, soft watercolour washes, warm parchment tones with Aegean blues, delicate cross-hatching, elegant and detailed.",
  },
  {
    id: "ornate-vase",
    label: "Ornate Greek vase",
    blurb: "Today's red-figure look, but richly detailed: fine linework, fired-clay texture, ornament.",
    prompt: "Highly detailed ancient Greek red-figure vase painting: terracotta figures on lustrous black glaze, extremely fine black and diluted-glaze linework for hair, folds and muscles, subtle fired-clay texture and crackle, ornate meander and palmette borders.",
  },
  {
    id: "animated-film",
    label: "Painterly animated film",
    blurb: "Rich, cinematic concept art, as in a feature-length animated movie.",
    prompt: "Painterly concept art for a feature-length animated film: stylised but richly detailed, soft cinematic lighting, warm Mediterranean palette, expressive faces, depth and atmosphere, polished and appealing.",
  },
];

const SUBJECTS = [
  {
    id: "athena",
    aspectRatio: "3:4",
    prompt:
      "Head-and-shoulders portrait of the goddess Athena from Homer's Odyssey, facing the viewer, mouth gently closed, calm, wise and warm expression. She wears a bronze Corinthian helmet pushed up on her head with a tall horsehair crest, and an aegis over her shoulders with a small Gorgon emblem; a spear rests against her shoulder. Centred, the figure fills the frame, plain simple warm background. No text, no letters, no watermark.",
  },
  {
    id: "sirens",
    aspectRatio: "16:9",
    prompt:
      "The Sirens episode from Homer's Odyssey: Odysseus tied to the mast of a black Greek ship with a painted eye on the prow, his crew rowing hard with wax in their ears, two Sirens (bird bodies with women's heads) singing on rocky islets scattered with bones, calm sea, wide cinematic composition. No text, no letters, no watermark.",
  },
];

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

/** Meta Muse Image: POST /v1/images/generations (OpenAI-compatible), base64 PNG back. Retries 429/5xx with backoff. */
async function generateMuse(prompt, aspectRatio) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${META_URL}/images/generations`, {
      method: "POST",
      headers: { authorization: `Bearer ${META_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MUSE_MODEL, prompt, n: 1, size: MUSE_SIZE[aspectRatio] ?? "1024x1024", response_format: "b64_json", output_format: "png" }),
    });
    if (res.ok) {
      const json = await res.json();
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) throw new Error(`${MUSE_MODEL}: no image in response`);
      return { model: MUSE_MODEL, data: Buffer.from(b64, "base64"), mime: "image/png" };
    }
    const body = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt + Math.random() * 1000;
      console.warn(`[styles] ${MUSE_MODEL} ${res.status}, retrying in ${Math.round(wait / 1000)} s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`${MUSE_MODEL} ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function generate(prompt, aspectRatio) {
  if (META_KEY) return generateMuse(prompt, aspectRatio);
  let last;
  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (part) return { model, data: Buffer.from(part.inlineData.data, "base64"), mime: part.inlineData.mimeType };
      last = new Error(`${model}: no image in response (${res.candidates?.[0]?.finishReason ?? "unknown"})`);
    } catch (err) {
      last = err;
      console.warn(`[styles] ${model} failed: ${String(err.message ?? err).slice(0, 160)}`);
    }
  }
  throw last;
}

if (!META_KEY && !ai) { console.error("Set MODEL_API_KEY (Meta Muse Image) or GEMINI_API_KEY in .env"); process.exit(2); }
console.log(`[styles] using ${META_KEY ? `Meta ${MUSE_MODEL}` : "Gemini image models"}`);
const results = [];
await Promise.all(
  STYLES.flatMap((style) =>
    SUBJECTS.map(async (subject) => {
      const t0 = Date.now();
      try {
        const img = await generate(`${subject.prompt}\n\nStyle: ${style.prompt}`, subject.aspectRatio);
        mkdirSync(out(style.id), { recursive: true });
        const ext = img.mime?.includes("jpeg") ? "jpg" : "png";
        writeFileSync(out(`${style.id}/${subject.id}.${ext}`), img.data);
        results.push({ style: style.id, subject: subject.id, file: `${style.id}/${subject.id}.${ext}`, model: img.model });
        console.log(`[styles] ${style.id}/${subject.id} (${img.model}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      } catch (err) {
        console.error(`[styles] ${style.id}/${subject.id} FAILED: ${String(err.message ?? err).slice(0, 200)}`);
      }
    }),
  ),
);
mkdirSync(out(""), { recursive: true });
writeFileSync(out("manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), styles: STYLES.map(({ prompt, ...s }) => s), subjects: SUBJECTS.map((s) => s.id), images: results }, null, 2));
console.log(`[styles] done: ${results.length}/${STYLES.length * SUBJECTS.length} images`);
