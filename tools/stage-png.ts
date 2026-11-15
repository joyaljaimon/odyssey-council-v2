// Renders the stage in a few states to PNG files, to check the look without a call.
// Run: npm run stage:png -- <out dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { Stage, artReady } from "../src/stage.ts";

const out = process.argv[2] ?? "stage-preview";
mkdirSync(out, { recursive: true });
await artReady;
const s = new Stage();
const shot = async (name: string, patch: Parameters<Stage["set"]>[0]) => {
  s.set(patch);
  await new Promise((r) => setTimeout(r, 150)); // scene paintings load lazily
  s.render();
  writeFileSync(`${out}/${name}.png`, s.canvas.encodeSync("png"));
};
await shot("1-listening", { phase: "listening" });
await shot("2-thinking", { phase: "thinking", heard: "Was it really smart for Odysseus to tell the Cyclops his real name?" });
await shot("3-speaking", { phase: "speaking", topic: "The boast to the Cyclops", scene: "cyclops", seats: ["odysseus", "polyphemus", "poseidon"], speaker: "poseidon", mouth: 0.7,
  line: "Smart? He blinded my son, then bellowed his own name across the water so the whole sea would know. Pride shouted, and I answered for ten long years." });
await shot("4-speaking", { phase: "speaking", topic: "The boast to the Cyclops", scene: "cyclops", seats: ["odysseus", "polyphemus", "poseidon"], speaker: "odysseus", mouth: 0,
  line: "I wanted him to know who beat him." });
console.log(`wrote ${out}/*.png`);
