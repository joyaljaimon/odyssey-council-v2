// Ask the Council from the terminal (text in, script out). Checks the prompt, the guardrails and the models without a call.
// Run: npm run ask -- "Was Odysseus right to blind the Cyclops?"   [--image photo.jpg]   [--speak]  (plays it with afplay)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { councilTurn } from "./script.ts";
import { speak, toWav, TTS_RATE } from "./gemini.ts";

const args = process.argv.slice(2);
const img = args.includes("--image") ? readFileSync(args[args.indexOf("--image") + 1]) : null;
const say = args.includes("--speak");
const question = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--image").join(" ") || "Was Odysseus right to blind the Cyclops?";

const t0 = Date.now();
for await (const ev of councilTurn({ text: `The caller says: "${question}"`, frameJpeg: img }, [])) {
  const ms = `${String(Date.now() - t0).padStart(5)} ms`;
  if (ev.kind === "line") {
    console.log(`${ms}  ${ev.member.name.toUpperCase()}: ${ev.text}`);
    if (say) {
      const parts: Buffer[] = [];
      for await (const pcm of speak(ev.text, ev.member)) parts.push(pcm);
      const f = join(tmpdir(), "council-line.wav");
      writeFileSync(f, toWav(Buffer.concat(parts), TTS_RATE));
      execFileSync("afplay", [f]);
    }
  } else console.log(`${ms}  [${ev.kind}] ${"text" in ev ? ev.text : "names" in ev ? ev.names.join(", ") : ev.id}`);
}
