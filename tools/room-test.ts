// LiveKit loopback test, no phone and no Chert: the Council joins a real LiveKit room, and a fake "Chert bridge"
// participant plays a spoken question (several voices mixed, like a group call) and listens to the answer.
// Run: npx tsx --env-file=.env tools/room-test.ts "Hi, I'm Sam ... || I'm Joyal ..."
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AudioFrame, AudioSource, AudioStream, LocalAudioTrack, Room, RoomEvent, TrackKind, TrackPublishOptions, TrackSource, dispose, type RemoteTrack } from "@livekit/rtc-node";
import { AccessToken } from "livekit-server-sdk";
import { Bridge, isChertCaller } from "../src/bridge.ts";
import { wavData } from "../src/gemini.ts";

const question = process.argv[2] ?? "Was Odysseus right to blind the Cyclops?";
const url = process.env.LIVEKIT_URL!, key = process.env.LIVEKIT_API_KEY!, secret = process.env.LIVEKIT_API_SECRET!;
const roomName = `council-test-${Date.now().toString(36)}`;
const token = async (identity: string) => { const at = new AccessToken(key, secret, { identity, ttl: "10m" }); at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true }); return at.toJwt(); };

const VOICES = ["Samantha", "Daniel", "Karen"];
const f = join(tmpdir(), "room-q.wav");
const q = Buffer.concat(question.split("||").map((part, i) => {
  execFileSync("say", ["-v", VOICES[i % 3], "-o", f, "--file-format=WAVE", "--data-format=LEI16@16000", part.trim()]);
  return Buffer.concat([wavData(readFileSync(f)), Buffer.alloc(11200)]);
}));

// the Council
const agentRoom = new Room();
await agentRoom.connect(url, await token("council-agent"), { autoSubscribe: false, dynacast: false });
const bridge = new Bridge(agentRoom, "room-test", isChertCaller);
await bridge.start();

// the fake caller (Chert's bridge)
const caller = new Room();
await caller.connect(url, await token("chert-bridge-test"), { autoSubscribe: true, dynacast: false });
const src = new AudioSource(16000, 1);
await caller.localParticipant!.publishTrack(LocalAudioTrack.createAudioTrack("facetime-remote-audio", src), new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }));

let heardMs = 0, lastHeard = 0, gotVideo = false;
caller.on(RoomEvent.TrackSubscribed, async (track: RemoteTrack) => {
  if (track.kind === TrackKind.KIND_VIDEO) { gotVideo = true; return; }
  if (track.kind !== TrackKind.KIND_AUDIO) return;
  for await (const fr of new AudioStream(track, { sampleRate: 24000, numChannels: 1 })) {
    let loud = false;
    for (let i = 0; i < fr.data.length; i += 8) if (Math.abs(fr.data[i]) > 600) { loud = true; break; }
    if (loud) { heardMs += (fr.samplesPerChannel / 24000) * 1000; lastHeard = Date.now(); }
  }
});
const play = async (pcm: Buffer) => {
  for (let o = 0; o + 640 <= pcm.length; o += 640) {
    const s = new Int16Array(pcm.buffer.slice(pcm.byteOffset + o, pcm.byteOffset + o + 640));
    await src.captureFrame(new AudioFrame(s, 16000, 1, 320));
  }
};
const silence = (ms: number) => play(Buffer.alloc(32 * ms));

await new Promise((r) => setTimeout(r, 1500));
console.log("[test] bridge_ready -> greeting");
bridge.markReady();
await silence(500);
const waitQuiet = async (label: string, maxMs: number) => {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) { await silence(250); if (heardMs > 0 && Date.now() - lastHeard > 2000) break; }
  console.log(`[test] ${label}: heard ${(heardMs / 1000).toFixed(1)} s of Council audio; video ${gotVideo ? "received" : "MISSING"}`);
};
await waitQuiet("greeting", 25_000);
heardMs = 0;
console.log(`[test] asking (${(q.length / 32000).toFixed(1)} s, ${question.split("||").length} voice(s))`);
await play(q);
const asked = Date.now();
let first = 0;
const t0 = Date.now();
while (Date.now() - t0 < 60_000) { await silence(200); if (!first && heardMs > 0) first = Date.now() - asked; if (first && Date.now() - lastHeard > 2500) break; }
console.log(`[test] answer: first audio ${first || "never"} ms after the question; ${(heardMs / 1000).toFixed(1)} s of speech`);
await bridge.close("test over");
await caller.disconnect(); await agentRoom.disconnect(); await dispose();
process.exit(first ? 0 : 1);
