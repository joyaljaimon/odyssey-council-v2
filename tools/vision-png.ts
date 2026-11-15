// Renders frames of the Council parting around pictures, to check the animation without a call. Renders at 15 fps
// like a real call and saves a few frames from each line.
// Run: npm run visions:png -- <out dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { Stage, artReady } from "../src/stage.ts";
import { VisionPicker } from "../src/visions.ts";

const out = process.argv[2] ?? "vision-preview";
mkdirSync(out, { recursive: true });
await artReady;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Line = [who: string, text: string];
const scenes: { name: string; topic: string; scene: string; seats: string[]; hints: string[]; lines: Line[] }[] = [
  { name: "two", topic: "Penelope's loom", scene: "return-to-ithaca", seats: ["penelope", "odysseus"], hints: ["loom"], lines: [
    ["penelope", "By day I wove the shroud for Laertes, and by torchlight I unpicked it, three years of a loom that never finished."],
    ["odysseus", "And she kept a hundred suitors waiting with nothing but thread and patience."]] },
  { name: "four", topic: "Blinding the Cyclops", scene: "cyclops", seats: ["odysseus", "polyphemus", "poseidon", "athena"], hints: ["cyclops-eye", "ram"], lines: [
    ["odysseus", "We heated an olive-wood stake in the fire and drove it into his one eye while he slept off the wine."],
    ["polyphemus", "Then they crept out beneath the bellies of my rams, and I stroked my favourite ram's wool and never knew."],
    ["poseidon", "For that, mortal, I chased you across every sea."]] },
];
let n = 0;
for (const sc of scenes) {
  const s = new Stage();
  const pick = new VisionPicker();
  pick.beginTurn();
  pick.suggest(sc.hints);
  let running = true;
  const loop = (async () => { while (running) { s.render(); await sleep(66); } })();
  s.set({ phase: "speaking", topic: sc.topic, scene: sc.scene, seats: sc.seats, mouth: 0.5 });
  for (const [who, line] of sc.lines) {
    s.set({ speaker: who, line });
    const v = pick.forLine(line);
    if (v) s.showVision(v); else s.clearVisions();
    console.log(`${sc.name}: ${who} -> ${v?.id ?? "(no picture)"}`);
    let last = 0;
    for (const ms of [250, 700, 2000]) { await sleep(ms - last); last = ms; writeFileSync(`${out}/${String(++n).padStart(2, "0")}-${sc.name}-${who}-${ms}.png`, s.canvas.encodeSync("png")); }
  }
  running = false;
  await loop;
}
console.log(`wrote ${out}/*.png`);
