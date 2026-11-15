// Renders a few frames of a picture arriving beside the Council, to check the animation without a call.
// Run: npx tsx tools/vision-png.ts <out dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { Stage, artReady } from "../src/stage.ts";
import { VisionPicker } from "../src/visions.ts";

const out = process.argv[2] ?? "vision-preview";
mkdirSync(out, { recursive: true });
await artReady;
const s = new Stage();
const pick = new VisionPicker();
pick.beginTurn();
pick.suggest(["cyclops-eye", "trojan-horse"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lines: [string, string, number[]][] = [
  ["odysseus", "We sharpened an olive-wood stake, heated it in the fire and drove it into his one eye while he slept off the wine.", [100, 500, 1100, 2400]],
  ["poseidon", "And for that, mortal, I chased you across every sea for ten years. My son still sits in that cave.", [400, 1500]],
  ["polyphemus", "Nobody, he called himself. Nobody blinded me. Even the trojan horse was less cunning than that lie.", [400, 1500]],
];
let n = 0;
for (const [who, line, times] of lines) {
  s.set({ phase: "speaking", topic: "Blinding the Cyclops", scene: "cyclops", seats: ["odysseus", "poseidon", "polyphemus"], speaker: who, mouth: 0.5, line });
  const v = pick.forLine(line);
  console.log(who, "->", v?.id ?? "(no picture)");
  if (v) s.showVision(v);
  let last = 0;
  for (const ms of times) { await sleep(ms - last); last = ms; s.render(); writeFileSync(`${out}/${++n}-${who}-${ms}.png`, s.canvas.encodeSync("png")); }
}
console.log(`wrote ${out}/*.png`);
