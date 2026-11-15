// Interruption test (real time): the Council must ignore its own echo and a cough, stop when the caller clearly talks
// over it, answer the interruption, and go quiet on a bare "stop".
// Run: npx tsx --env-file=.env tools/barge-test.ts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Council } from "../src/council.ts";
import { wavData } from "../src/gemini.ts";
import { artReady } from "../src/stage.ts";

await artReady;
const f = join(tmpdir(), "barge.wav");
const said = (text: string, voice = "Samantha") => { execFileSync("say", ["-v", voice, "-o", f, "--file-format=WAVE", "--data-format=LEI16@16000", text]); return wavData(readFileSync(f)); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let echo: Buffer[] = []; // what the Council says, fed back faintly like imperfect echo cancellation
let clears = 0, audioMs = 0;
const council = new Council("barge", {
  sendAudio: (pcm) => { audioMs += pcm.length / 48; echo.push(pcm); },
  clearAudio: () => { clears++; echo = []; },
});
council.setFrameSource(async () => null);
council.stage.set({ phase: "listening" });

/** Real-time caller audio: `pcm` (or silence) mixed with the Council's echo at -30 dB. */
async function caller(pcm: Buffer | null, ms: number) {
  const frames = Math.ceil(ms / 20);
  for (let i = 0; i < frames; i++) {
    const out = Buffer.alloc(640);
    if (pcm && i * 640 < pcm.length) pcm.copy(out, 0, i * 640, Math.min(pcm.length, (i + 1) * 640));
    const e = echo.shift(); // 24 kHz -> crude 16 kHz, quiet
    if (e) for (let j = 0; j < 320 && j * 3 + 1 < e.length / 2; j++) {
      const s = out.readInt16LE(j * 2) + Math.round(e.readInt16LE(Math.floor(j * 1.5) * 2) * 0.03);
      out.writeInt16LE(Math.max(-32768, Math.min(32767, s)), j * 2);
    }
    council.callerAudio(out);
    await sleep(20);
  }
}
const phase = () => council.state.phase;
const waitFor = async (want: string, ms: number) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (phase() === want) return true; await caller(null, 100); } return false; };

const q = said("Was Odysseus right to blind the Cyclops?");
await caller(q, (q.length / 32) + 1200);
console.log(`[test] asked; waiting for the answer…`);
if (!(await waitFor("speaking", 20000))) { console.log("[test] FAIL: never started speaking"); process.exit(1); }
await caller(null, 2500);

// a cough: 180 ms of loud noise
const cough = Buffer.alloc(16 * 180 * 2);
for (let i = 0; i < cough.length; i += 2) cough.writeInt16LE(Math.round((Math.random() * 2 - 1) * 12000), i);
await caller(cough, 1500);
console.log(`[test] echo + cough while speaking: ${clears === 0 && phase() === "speaking" ? "ignored ✓" : `INTERRUPTED ✗ (phase ${phase()})`}`);

const t0 = Date.now();
const wait = said("Wait, wait. Actually, tell me about the Sirens instead.", "Daniel");
let stoppedAt = 0;
for (let off = 0; off < wait.length + 32 * 1400; off += 640) {
  await caller(off < wait.length ? wait.subarray(off, off + 640) : null, 20);
  if (!stoppedAt && clears > 0) stoppedAt = Date.now() - t0;
}
console.log(`[test] talking over it: ${stoppedAt ? `stopped after ${stoppedAt} ms of speech ✓` : "NOT stopped ✗"}`);
const next = await waitFor("speaking", 20000);
console.log(`[test] answered the interruption: ${next ? "✓" : "✗"} (topic: ${council.state.topic})`);

await caller(null, 3000);
const hushT = Date.now(); const before = clears;
const hush = said("Stop.", "Daniel");
await caller(Buffer.concat([hush, hush.subarray(0, 0)]), 600); // too short to interrupt on its own
const longer = said("Okay stop, stop please.", "Daniel");
await caller(longer, longer.length / 32 + 2000);
const quiet = await waitFor("listening", 15000);
console.log(`[test] "stop": ${clears > before ? "stopped" : "not stopped"}, then ${quiet && council.state.phase === "listening" ? "quiet and listening ✓" : `phase ${phase()} ✗`} (${Date.now() - hushT} ms)`);
council.close();
process.exit(0);
