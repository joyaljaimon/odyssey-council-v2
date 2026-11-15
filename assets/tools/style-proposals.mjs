// Generates candidate art styles with Gemini's image model so the team can compare them on /styles.
// Same two subjects (Athena, the Sirens scene) in every style, so only the style differs.
// Run: node --env-file=.env assets/tools/style-proposals.mjs        (needs GEMINI_API_KEY)
// Output: assets/style-proposals/<style>/{athena,sirens}.png + assets/style-proposals/manifest.json
import { mkdirSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generate(prompt, aspectRatio) {
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

if (!process.env.GEMINI_API_KEY) { console.error("GEMINI_API_KEY is not set"); process.exit(2); }
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
