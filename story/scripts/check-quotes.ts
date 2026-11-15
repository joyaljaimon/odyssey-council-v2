// Checks that every episode's keyQuotes[].text appears verbatim in its passage, and that every
// passageId used anywhere in episodes.json exists. Run: npm run check -w story
import type { Episode, Passage } from "@odyssey/contracts";
import passagesJson from "../data/passages.json" with { type: "json" };
import episodesJson from "../data/episodes.json" with { type: "json" };
import momentsJson from "../data/moments.json" with { type: "json" };
import adventureJson from "../data/adventure.json" with { type: "json" };
import illustrationsJson from "../data/illustrations.json" with { type: "json" };
import type { Adventure, StoryMoment, Illustration } from "@odyssey/contracts";

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
const illustrationIds = new Set((illustrationsJson as Illustration[]).map((i) => i.id));
let beats = 0;
for (const m of momentsJson as StoryMoment[]) {
  for (const b of m.beats) {
    beats++;
    if (!illustrationIds.has(b.illustrationId)) fail(`moment ${m.id}: unknown illustration ${b.illustrationId}`);
    for (const id of b.passageIds) if (!passages.has(id)) fail(`moment ${m.id}: unknown passage ${id}`);
    const text = passages.get(b.quote.passageId);
    if (!text?.includes(b.quote.text)) fail(`moment ${m.id}: quote not found in ${b.quote.passageId}: "${b.quote.text.slice(0, 60)}…"`);
  }
}
const adv = adventureJson as unknown as Adventure;
for (const node of adv.nodes) {
  if (!illustrationIds.has(node.illustrationId)) fail(`adventure ${node.id}: unknown illustration ${node.illustrationId}`);
  if (node.choices.map((c) => c.key).join("") !== "ABC") fail(`adventure ${node.id}: choices must be A, B, C`);
  if (!node.choices.some((c) => c.key === node.homer.key)) fail(`adventure ${node.id}: homer.key ${node.homer.key} is not a choice`);
  for (const c of node.choices) if (!adv.virtues[c.virtue]) fail(`adventure ${node.id}/${c.key}: unknown virtue ${c.virtue}`);
  const text = passages.get(node.homer.quote.passageId);
  if (!text?.includes(node.homer.quote.text)) fail(`adventure ${node.id}: Homer quote not found in ${node.homer.quote.passageId}`);
}
const n = (episodesJson as Episode[]).reduce((s, e) => s + e.keyQuotes.length, 0);
if (errors) { console.error(`${errors} problem(s)`); process.exit(1); }
console.log(`✓ ${n} episode quotes, ${beats} story-beat quotes and ${adv.nodes.length} adventure quotes verified against passages.json`);
