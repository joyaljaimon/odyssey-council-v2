// Embeds every passage and episode with Gemini and writes data/embeddings.json (~1k vectors, 768 dims).
// Needs GEMINI_API_KEY. Run: npm run build:embeddings -w story
import { writeFileSync } from "node:fs";
import { passages, episodes, embed, EMBEDDING_MODEL } from "../index.ts";

const BATCH = 100;
async function embedAll(items: { id: string; text: string }[]) {
  const out: Record<string, number[]> = {};
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const vecs = await embed(chunk.map((x) => x.text), "RETRIEVAL_DOCUMENT");
    chunk.forEach((x, j) => (out[x.id] = vecs[j].map((v) => Math.round(v * 1e5) / 1e5)));
    process.stdout.write(`\r${Math.min(i + BATCH, items.length)}/${items.length}`);
  }
  console.log();
  return out;
}

const result = {
  model: EMBEDDING_MODEL,
  passages: await embedAll(passages.map((p) => ({ id: p.id, text: p.text }))),
  episodes: await embedAll(
    episodes.map((e) => ({ id: e.id, text: [e.title, e.summary, ...e.themes, ...e.lessons, ...e.problemTags].join(". ") })),
  ),
};
writeFileSync(new URL("../data/embeddings.json", import.meta.url), JSON.stringify(result));
console.log(`Wrote ${Object.keys(result.passages).length} passage and ${Object.keys(result.episodes).length} episode vectors`);
