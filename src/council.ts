// One call with the Council. Transport-agnostic: the FaceTime bridge (bridge.ts) and the browser simulator (sim.ts)
// both feed it caller audio + camera frames and play the audio it sends back.
//
//   caller speaks ─▶ VAD finds the end of the question
//                 ─▶ one Gemini call: their audio + their camera frame ─▶ streamed script (HEARD/TOPIC/NAME: line)
//                 ─▶ each line, as soon as it is written, is spoken in that member's voice (streaming TTS)
//                 ─▶ audio to the caller; the stage shows who is speaking, in sync with what the caller hears
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHAIR, type Member } from "./roster.ts";
import { SAY_AUDIO, TTS_RATE, speak } from "./gemini.ts";
import { voiceTag } from "./elevenlabs.ts";
import { FALLBACK_LINE, councilTurn, type Turn } from "./script.ts";
import { Stage, imageFromJpeg, type StageState } from "./stage.ts";
import { BargeIn, Vad } from "./vad.ts";
import { VisionPicker } from "./visions.ts";

export interface CallIO {
  /** Play PCM16 mono 24 kHz after whatever is already queued. */
  sendAudio(pcm: Buffer): void;
  /** Drop everything queued (the caller interrupted). */
  clearAudio(): void;
}

const BYTES_PER_MS = (TTS_RATE * 2) / 1000;
const MOUTH_STEP_MS = 50;
const BARGE_IN = process.env.BARGE_IN !== "0"; // the caller can talk over the Council to stop it (BARGE_IN=0 turns it off)
const RECENT_MS = 1200; // caller audio kept so an interruption's first words are part of the next question
/** "stop", "wait", "okay stop, stop please"…: the caller only wants silence, not an answer. */
const HUSH_WORDS = new Set("stop wait pause hold hang on shh shhh quiet enough one sec second be talking please ok okay okey council guys everyone sorry hey hmm um uh".split(" "));
const HUSH_KEY = /\b(stop|wait|pause|hold on|hang on|shh+|quiet|enough)\b/i;
const isHush = (text: string) => {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 10 && HUSH_KEY.test(text) && words.every((w) => HUSH_WORDS.has(w));
};
const GREETING = `Welcome, traveller. I'm Athena, well, an AI playing her. The Council of the Odyssey is in session: ask us anything about the voyage, or hold something up to the camera.`;

type Due = { at: number; apply: () => void };

export class Council {
  readonly stage = new Stage();
  private visions = new VisionPicker();
  private vad: Vad;
  private barge: BargeIn;
  private recent: Buffer[] = [];
  private recentBytes = 0;
  private inputRate: number;
  private history: Turn[] = [];
  private playhead = 0; // when the audio queued so far finishes playing (ms epoch)
  private due: Due[] = [];
  private mouth: { at: number; level: number }[] = [];
  private tick: NodeJS.Timeout;
  private busy = false; // a turn is being written or spoken
  private abort: AbortController | null = null;
  private frameSource: (() => Promise<Buffer | null>) | null = null;
  private closed = false;

  constructor(readonly id: string, private io: CallIO, inputRate = 16000) {
    this.vad = new Vad(inputRate);
    this.barge = new BargeIn(inputRate);
    this.inputRate = inputRate;
    this.tick = setInterval(() => this.onTick(), 40);
  }

  /** Where to get the caller's latest camera frame (JPEG) when a question ends. */
  setFrameSource(fn: () => Promise<Buffer | null>) { this.frameSource = fn; }

  /** The call is connected: the chair greets (says it's an AI), then the Council listens. */
  async greet() {
    this.busy = true;
    this.stage.set({ phase: "speaking", seats: [CHAIR.id], speaker: CHAIR.id, line: GREETING, topic: undefined, scene: null });
    try {
      await this.say(CHAIR, GREETING, "greeting");
    } catch (err) {
      console.error(`[council ${this.id}] greeting failed`, err);
    }
    this.at(this.playhead, () => { this.busy = false; this.stage.set({ phase: "listening", speaker: undefined, line: undefined, seats: [] }); });
  }

  /** Caller audio, PCM16 mono at the input rate. */
  callerAudio(pcm: Buffer) {
    if (this.closed) return;
    this.remember(pcm);
    if (this.busy) {
      // While the Council talks, only a clear, sustained voice counts (see BargeIn), and only once it is audible.
      if (BARGE_IN && this.stage.state.phase === "speaking" && this.barge.push(pcm)) this.interrupt();
      else this.stage.state.mic = 0;
      return;
    }
    const ev = this.vad.push(pcm);
    this.stage.state.mic = this.vad.level;
    if (ev === "start") this.stage.set({ phase: "hearing" });
    else if (ev === "cancel") this.stage.set({ phase: "listening" });
    else if (ev instanceof Buffer) void this.turn(ev);
  }

  /** Keep the last ~1.2 s of caller audio. */
  private remember(pcm: Buffer) {
    this.recent.push(pcm);
    this.recentBytes += pcm.length;
    const max = (this.inputRate / 1000) * RECENT_MS * 2;
    while (this.recentBytes - this.recent[0].length > max) this.recentBytes -= this.recent.shift()!.length;
  }

  close() {
    this.closed = true;
    this.abort?.abort();
    clearInterval(this.tick);
  }

  // ---------------------------------------------------------------- a turn

  private async turn(audio: Buffer) {
    this.busy = true;
    const ctrl = (this.abort = new AbortController());
    const watchdog = setTimeout(() => ctrl.abort(), 90_000);
    const t0 = Date.now();
    this.stage.set({ phase: "thinking", heard: undefined, saw: undefined, sawFrame: null });
    const frame = await this.frameSource?.().catch(() => null) ?? null;
    let heard = "";
    const spoken: string[] = [];
    let first = true;
    this.visions.beginTurn();
    try {
      for await (const ev of councilTurn({ audio: { pcm: audio, rate: 16000 }, frameJpeg: frame }, this.history, ctrl.signal)) {
        if (ctrl.signal.aborted) break;
        if (ev.kind === "heard") {
          heard = ev.text;
          console.log(`[council ${this.id}] heard: "${heard}" (${Date.now() - t0} ms)`);
          if (heard === "-" || !heard) break; // no clear speech: back to listening, quietly
          if (isHush(heard)) { console.log(`[council ${this.id}] the caller asked for quiet`); heard = "-"; break; }
          this.stage.set({ heard });
        } else if (ev.kind === "saw" && frame) {
          const img = await imageFromJpeg(frame);
          this.stage.set({ saw: ev.text, sawFrame: img });
          console.log(`[council ${this.id}] saw: ${ev.text}`);
        } else if (ev.kind === "topic") {
          const topic = ev.text;
          this.at(this.playhead, () => this.stage.set({ topic }));
        } else if (ev.kind === "scene") {
          const scene = ev.id;
          this.at(this.playhead, () => this.stage.set({ scene }));
        } else if (ev.kind === "show") {
          this.visions.suggest(ev.ids);
        } else if (ev.kind === "new") {
          console.log(`[council ${this.id}] painting something new: ${ev.subject}`);
          this.visions.paintNew(ev.subject, () => this.stage.state.phase === "speaking", (v) => this.stage.showVision(v));
        } else if (ev.kind === "line") {
          if (!heard) heard = "…"; // the model skipped HEARD: still a real turn
          if (first) { first = false; console.log(`[council ${this.id}] first line ready in ${Date.now() - t0} ms`); }
          const seatsReset = spoken.length === 0;
          spoken.push(`${ev.member.name.toUpperCase()}: ${ev.text}`);
          // Seat everyone in this answer as soon as they are known, so the panel convenes together.
          if (!seatsReset) { const id = ev.member.id; this.at(0, () => { if (!this.stage.state.seats.includes(id)) this.stage.set({ seats: [...this.stage.state.seats, id] }); }); }
          await this.say(ev.member, ev.text, undefined, ctrl.signal, seatsReset);
        }
      }
    } catch (err) {
      console.error(`[council ${this.id}] the script failed:`, (err as Error).message);
    }
    clearTimeout(watchdog);
    if (!ctrl.signal.aborted && heard && heard !== "-" && spoken.length === 0) {
      console.warn(`[council ${this.id}] nothing was said; the chair covers`);
      await this.say(FALLBACK_LINE.member, FALLBACK_LINE.text, "fallback", undefined, true).catch(() => {});
    }
    if (heard && heard !== "-" && spoken.length) {
      this.history.push({ heard, script: spoken.join("\n") });
      if (this.history.length > 8) this.history.shift();
    }
    if (this.abort === ctrl) this.abort = null;
    if (ctrl.signal.aborted) return;
    this.at(this.playhead + 250, () => {
      this.busy = false;
      this.vad.reset();
      this.stage.set({ phase: "listening", speaker: undefined, line: undefined, mouth: 0 });
      this.stage.clearVisions();
    });
  }

  /** The caller talked over the Council: stop speaking at once, drop the rest of the answer, and listen. */
  private interrupt() {
    console.log(`[council ${this.id}] caller interrupted; stopping`);
    this.abort?.abort();
    this.abort = null;
    this.io.clearAudio();
    this.due = [];
    this.mouth = [];
    this.playhead = Date.now();
    this.busy = false;
    this.stage.set({ phase: "hearing", speaker: undefined, line: undefined, mouth: 0 });
    this.stage.clearVisions();
    // Start the next question from what the caller has already said, so its first words are not lost.
    this.vad.reset();
    const ev = this.vad.push(Buffer.concat(this.recent));
    if (ev instanceof Buffer) void this.turn(ev);
  }

  /** Speak one line in a member's voice. The stage switches to them exactly when their audio starts playing. */
  private async say(m: Member, text: string, cacheKey?: string, signal?: AbortSignal, newSeats = false) {
    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      this.at(this.playhead, () => {
        const seats = newSeats ? [m.id] : this.stage.state.seats.includes(m.id) ? this.stage.state.seats : [...this.stage.state.seats, m.id];
        if (this.stage.state.phase !== "speaking") this.barge.arm();
        this.stage.set({ phase: "speaking", speaker: m.id, line: text, seats });
        if (!cacheKey) { const v = this.visions.forLine(text); if (v) this.stage.showVision(v); } // a picture of what this line mentions
      });
    };
    for await (const pcm of cachedSpeech(m, text, cacheKey, signal)) {
      if (signal?.aborted) return;
      begin();
      this.play(pcm);
    }
  }

  // ---------------------------------------------------------------- audio clock and the stage

  private play(pcm: Buffer) {
    const now = Date.now();
    if (this.playhead < now) this.playhead = now + 60; // a small cushion so the first chunk isn't late
    const step = Math.round(BYTES_PER_MS * MOUTH_STEP_MS) & ~1;
    for (let off = 0; off < pcm.length; off += step) {
      const part = pcm.subarray(off, Math.min(off + step, pcm.length));
      this.mouth.push({ at: this.playhead + (off / BYTES_PER_MS), level: rms(part) });
    }
    this.playhead += pcm.length / BYTES_PER_MS;
    this.io.sendAudio(pcm);
  }

  private at(when: number, apply: () => void) {
    this.due.push({ at: when, apply });
  }

  private onTick() {
    const now = Date.now();
    if (this.due.length) {
      const ready = this.due.filter((d) => d.at <= now);
      if (ready.length) {
        this.due = this.due.filter((d) => d.at > now);
        ready.sort((a, b) => a.at - b.at).forEach((d) => d.apply());
      }
    }
    while (this.mouth.length > 1 && this.mouth[1].at <= now) this.mouth.shift();
    const cur = this.mouth[0];
    const level = cur && cur.at <= now && now - cur.at < 120 ? cur.level : 0;
    this.stage.state.mouth = level;
  }

  get state(): StageState { return this.stage.state; }
}

function rms(pcm: Buffer): number {
  let sum = 0;
  const n = pcm.length >> 1;
  for (let i = 0; i < n; i++) { const s = pcm.readInt16LE(i * 2) / 32768; sum += s * s; }
  return n ? Math.min(1, Math.sqrt(sum / n) * 4) : 0;
}

// ---------------------------------------------------------------- fixed lines are recorded once and reused

const audioDir = fileURLToPath(new URL("../assets/audio/", import.meta.url));

/** Speech for a line; fixed lines (greeting, fallback) are saved to assets/audio/ and replayed instantly next time. */
async function* cachedSpeech(m: Member, text: string, key: string | undefined, signal?: AbortSignal): AsyncGenerator<Buffer> {
  const file = key ? `${audioDir}${key}-${voiceTag(m)}.pcm` : null; // per voice: a greeting must match the chair's voice
  if (file && existsSync(file)) {
    const pcm = readFileSync(file);
    for (let off = 0; off < pcm.length; off += 9600) yield pcm.subarray(off, off + 9600);
    return;
  }
  const parts: Buffer[] = [];
  let robotic = false;
  for await (const pcm of speak(text, m, signal)) { robotic ||= SAY_AUDIO.has(pcm); parts.push(pcm); yield pcm; }
  if (file && parts.length && !robotic && !signal?.aborted) {
    mkdirSync(audioDir, { recursive: true });
    writeFileSync(file, Buffer.concat(parts));
  }
}

/** Record the fixed lines (greeting, fallback) ahead of the first call, so a call never waits on them. */
export async function warmVoices() {
  for (const [key, m, text] of [["greeting", CHAIR, GREETING], ["fallback", FALLBACK_LINE.member, FALLBACK_LINE.text]] as const) {
    if (existsSync(`${audioDir}${key}-${voiceTag(m)}.pcm`)) continue;
    try { for await (const _ of cachedSpeech(m, text, key)) { /* drain */ } console.log(`[council] recorded the ${key} line`); }
    catch (err) { console.warn(`[council] could not record the ${key} line yet:`, (err as Error).message); }
  }
}
