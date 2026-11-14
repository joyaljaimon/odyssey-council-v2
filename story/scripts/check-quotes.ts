// Checks that every episode's keyQuotes[].text appears verbatim in its passage, and that every
// passageId used anywhere in episodes.json exists. Run: npm run check -w story
import type { Episode, Passage } from "@odyssey/contracts";
import passagesJson from "../data/passages.json" with { type: "json" };
import episodesJson from "../data/episodes.json" with { type: "json" };

const passages = new Map((passagesJson as Passage[]).map((p) => [p.id, p.text]));
let errors = 0;
const fail = (msg: string) => { errors++; console.error(`✗ ${msg}`); };

for (const e of episodesJson as Episode[]) {
  for (const id of e.passageIds) if (!passages.has(id)) fail(`${e.id}: passageIds has unknown id ${id}`);
  if (e.keyQuotes.length === 0) fail(`${e.id}: no keyQuotes`);
  for (const q of e.keyQuotes) {
    const text = passages.get(q.passageId);
    if (!text) fail(`${e.id}: quote cites unknown passage ${q.passageId}`);
    else if (!text.includes(q.text)) fail(`${e.id}: quote not found in ${q.passageId}: "${q.text.slice(0, 60)}…"`);
  }
}
const n = (episodesJson as Episode[]).reduce((s, e) => s + e.keyQuotes.length, 0);
if (errors) { console.error(`${errors} problem(s)`); process.exit(1); }
console.log(`✓ ${n} quotes across ${episodesJson.length} episodes verified against passages.json`);
