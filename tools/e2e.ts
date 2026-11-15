// End-to-end check without a phone: a spoken question (macOS `say`, no quota) goes into the Council exactly like
// caller audio; we measure how long until the first reply audio, and save the reply + stage frames.
// Run: npx tsx --env-file=.env tools/e2e.ts "question" [out dir] [image.jpg]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Council } from "../src/council.ts";
import { TTS_RATE, toWav, wavData } from "../src/gemini.ts";
import { artReady } from "../src/stage.ts";

const question = process.argv[2] ?? "Was Odysseus right to blind the Cyclops?";
const out = process.argv[3] ?? join(tmpdir(), "council-e2e");
const image = process.argv[4] ? readFileSync(process.argv[4]) : null;
mkdirSync(out, { recursive: true });
await artReady;

const f = join(tmpdir(), "council-q.wav");
execFileSync("say", ["-v", "Samantha", "-o", f, "--file-format=WAVE", "--data-format=LEI16@16000", question]);
const q = wavData(readFileSync(f));

const audio: Buffer[] = [];
let firstAudio = 0;
const council = new Council("e2e", { sendAudio: (pcm) => { if (!firstAudio) firstAudio = Date.now(); audio.push(pcm); }, clearAudio: () => {} });
council.setFrameSource(async () => image);
const feed = async (pcm: Buffer) => { for (let o = 0; o < pcm.length; o += 640) { council.callerAudio(pcm.subarray(o, o + 640)); await new Promise((r) => setTimeout(r, 2)); } };

council.stage.set({ phase: "listening" }); // skip the greeting
await feed(Buffer.alloc(16000)); // 0.5 s silence
await feed(q);
await feed(Buffer.alloc(32000)); // 1 s silence: the VAD ends the question here
const asked = Date.now();
console.log(`[e2e] asked: "${question}" (${(q.length / 32000).toFixed(1)} s of audio)`);

let shot = 0;
const deadline = Date.now() + 60_000;
let wasSpeaking = false;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 250));
  const st = council.state;
  if (st.phase === "speaking") {
    wasSpeaking = true;
    if (shot < 3 && Date.now() - (firstAudio || Date.now()) > shot * 4000 + 1500) writeFileSync(join(out, `stage-${++shot}.jpg`), council.stage.jpeg(85));
  }
  if (wasSpeaking && st.phase === "listening") break;
}
council.close();
const pcm = Buffer.concat(audio);
writeFileSync(join(out, "reply.wav"), toWav(pcm, TTS_RATE));
console.log(`[e2e] first reply audio ${firstAudio ? firstAudio - asked : "never"} ms after the question ended; ${(pcm.length / (TTS_RATE * 2)).toFixed(1)} s of speech; files in ${out}`);
process.exit(firstAudio ? 0 : 1);
