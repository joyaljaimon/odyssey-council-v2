// Gemini over plain REST, built to keep answering when models are overloaded (503) or out of quota (429):
//  - several API keys (GEMINI_API_KEYS=a,b,c) and several models per job, tried in order;
//  - a (key, model) pair that fails is skipped for a while instead of being retried every turn;
//  - each attempt must produce its first chunk quickly, or the next one is tried;
//  - speech falls back to the Mac's own voices (`say`) if every TTS model fails.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Member } from "./roster.ts";
import { ELEVEN_KEY, ElevenError, elevenSpeak } from "./elevenlabs.ts";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const list = (v: string | undefined, d: string) => (v || d).split(",").map((s) => s.trim()).filter(Boolean);

export const KEYS = list(process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY ?? "");
export const SCRIPT_MODELS = list(process.env.SCRIPT_MODELS, "gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3.5-flash,gemini-3.5-flash-lite");
export const TTS_MODELS = list(process.env.TTS_MODELS, "gemini-3.8-flash-lite-tts,gemini-3.1-flash-tts-preview,gemini-3.8-flash-tts,gemini-2.5-flash-preview-tts");
const FIRST_CHUNK_MS = Number(process.env.FIRST_CHUNK_MS ?? 9000); // a model with no text after this long is given up on
const HEDGE_MS = Number(process.env.HEDGE_MS ?? 2500); // no text yet after this long: start the next model alongside
export const TTS_RATE = 24000; // Gemini TTS: PCM16 mono 24 kHz

// ---------------------------------------------------------------- key/model health

const downUntil = new Map<string, number>();
const slot = (key: string, model: string) => `${key.slice(-6)}:${model}`;
const isUp = (key: string, model: string) => (downUntil.get(slot(key, model)) ?? 0) < Date.now();
function markDown(key: string, model: string, status: number) {
  // Quota: a minute for per-minute limits. Overload (5xx): 20 s. A stall (timeout, status 0): 2 min, so the next
  // question doesn't wait on it again. Bad request / not found: 10 min.
  const ms = status === 429 ? 60_000 : status === 400 || status === 404 || status === 403 ? 600_000 : status === 0 ? 120_000 : 20_000;
  downUntil.set(slot(key, model), Date.now() + ms);
}

/** Every (key, model) to try, best first; ones resting after a failure go last rather than disappearing. */
function attempts(models: string[]): { key: string; model: string }[] {
  const all = models.flatMap((model) => KEYS.map((key) => ({ key, model })));
  return [...all.filter((a) => isUp(a.key, a.model)), ...all.filter((a) => !isUp(a.key, a.model))];
}

// ---------------------------------------------------------------- streaming

class HttpError extends Error {
  constructor(readonly status: number, body: string) { super(`HTTP ${status}: ${body.slice(0, 200).replace(/\s+/g, " ")}`); }
}

/** POST streamGenerateContent and yield each SSE JSON event. Throws if the first event takes longer than firstMs. */
async function* sse(model: string, key: string, body: unknown, firstMs: number, signal?: AbortSignal): AsyncGenerator<any> {
  const ctrl = new AbortController();
  const stop = () => ctrl.abort();
  signal?.addEventListener("abort", stop);
  let timer: NodeJS.Timeout | undefined = setTimeout(stop, firstMs);
  const total = setTimeout(stop, Math.max(45_000, firstMs * 3));
  try {
    const res = await fetch(`${API}/${model}:streamGenerateContent?alt=sse`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new HttpError(res.status, await res.text().catch(() => ""));
    const dec = new TextDecoder();
    let buf = "";
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += dec.decode(chunk, { stream: true }).replace(/\r/g, "");
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const ev = buf.slice(0, i).replace(/^data: ?/gm, "");
        buf = buf.slice(i + 2);
        if (!ev.trim()) continue;
        const json = JSON.parse(ev);
        if (json.error) throw new HttpError(json.error.code ?? 500, JSON.stringify(json.error));
        if (timer) { clearTimeout(timer); timer = undefined; }
        yield json;
      }
    }
  } finally {
    if (timer) clearTimeout(timer);
    clearTimeout(total);
    signal?.removeEventListener("abort", stop);
  }
}

const statusOf = (err: unknown) => (err instanceof HttpError ? err.status : 0);

function thinking(model: string) {
  if (/^gemini-2\.5-flash(?!-lite)/.test(model)) return { thinkingBudget: 0 };
  if (/^gemini-3\.\d-flash(?!-lite)|^gemini-flash-latest/.test(model)) return { thinkingLevel: "minimal" };
  return undefined;
}

/**
 * Stream text from the first (key, model) that answers. Yields text deltas. If a model fails before its first chunk,
 * the next one is tried; once text has started flowing, a failure just ends the stream.
 */
export async function* streamText(
  req: { system: string; contents: unknown[]; temperature?: number; maxTokens?: number; models?: string[]; firstMs?: number },
  signal?: AbortSignal,
): AsyncGenerator<string> {
  // Hedged: the first model starts; if it hasn't produced text within HEDGE_MS (or fails), the next one starts too,
  // and so on. The first to produce text wins and the others are cancelled. A slow spell costs a few seconds, not
  // the whole answer.
  const list = attempts(req.models ?? SCRIPT_MODELS);
  if (!list.length) throw new Error("no Gemini key configured");
  const firstMs = req.firstMs ?? FIRST_CHUNK_MS;
  const chunks: string[] = [];
  let winner = -1, running = 0, next = 0, done = false, lastErr: unknown;
  let wake: (() => void) | null = null;
  const poke = () => { const w = wake; wake = null; w?.(); };
  const ctrls: AbortController[] = [];
  const onAbort = () => { for (const c of ctrls) c.abort(); poke(); };
  signal?.addEventListener("abort", onAbort);

  const launch = () => {
    if (winner >= 0 || next >= list.length || signal?.aborted) return;
    const i = next++;
    const { key, model } = list[i];
    const ctrl = new AbortController();
    ctrls[i] = ctrl;
    running++;
    const hedge = setTimeout(launch, HEDGE_MS); // still nothing from this one: start the next alongside
    void (async () => {
      const t0 = Date.now();
      let started = false;
      try {
        for (const withThinking of [true, false]) {
          const think = withThinking ? thinking(model) : undefined;
          if (!withThinking && !thinking(model)) break;
          try {
            const body = {
              systemInstruction: { parts: [{ text: req.system }] },
              contents: req.contents,
              generationConfig: { temperature: req.temperature ?? 0.9, maxOutputTokens: req.maxTokens ?? 700, ...(think ? { thinkingConfig: think } : {}) },
            };
            for await (const ev of sse(model, key, body, firstMs, ctrl.signal)) {
              const text = (ev.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
              if (!text) continue;
              if (!started) {
                started = true;
                clearTimeout(hedge);
                if (winner >= 0) { ctrl.abort(); return; } // another model already won
                winner = i;
                ctrls.forEach((c, j) => { if (j !== i) c?.abort(); });
                console.log(`[gemini] script from ${model} (first token ${Date.now() - t0} ms)`);
              }
              chunks.push(text); poke();
            }
            if (started) return;
            throw new HttpError(500, "empty response");
          } catch (err) {
            if (started) { console.warn(`[gemini] ${model} stopped mid-answer: ${(err as Error).message}`); return; }
            if (statusOf(err) === 400 && withThinking && thinking(model)) continue; // retry without thinkingConfig
            throw err;
          }
        }
      } catch (err) {
        clearTimeout(hedge);
        if (winner >= 0 && winner !== i) return; // cancelled because another model won
        if (signal?.aborted) return;
        lastErr = err;
        markDown(key, model, statusOf(err));
        console.warn(`[gemini] ${model} unavailable (${(err as Error).name === "AbortError" ? "timeout" : (err as Error).message.slice(0, 90)})`);
        launch(); // failed outright: the next starts now
      } finally {
        running--;
        if (winner === i || (winner < 0 && running === 0 && next >= list.length)) done = true;
        poke();
      }
    })();
  };

  try {
    launch();
    while (true) {
      if (chunks.length) { yield chunks.shift()!; continue; }
      if (done || signal?.aborted) break;
      await new Promise<void>((r) => { wake = r; });
    }
    if (winner < 0 && !signal?.aborted) throw lastErr ?? new Error("every Gemini model failed");
  } finally {
    signal?.removeEventListener("abort", onAbort);
    for (const c of ctrls) c?.abort();
  }
}

// ---------------------------------------------------------------- speech

/** Speak a line in the member's voice. Yields PCM16 mono 24 kHz chunks as they are generated. */
export async function* speak(text: string, m: Member, signal?: AbortSignal): AsyncGenerator<Buffer> {
  // ElevenLabs first when a key is set; on any failure before audio starts, Gemini voices take over.
  if (ELEVEN_KEY && elevenUpAt < Date.now()) {
    let started = false;
    try {
      for await (const pcm of elevenSpeak(text, m, signal)) { started = true; yield pcm; }
      if (started) return;
    } catch (err) {
      if (started || signal?.aborted) return;
      const status = err instanceof ElevenError ? err.status : 0;
      // out of credits / bad key: rest it 10 min; overload or timeout: 30 s
      elevenUpAt = Date.now() + (status === 401 || status === 402 || status === 403 || /quota/i.test((err as Error).message) ? 600_000 : 30_000);
      console.warn(`[tts] ElevenLabs unavailable for ${m.name} (${(err as Error).name === "AbortError" ? "timeout" : (err as Error).message.slice(0, 100)}); using Gemini voices`);
    }
  }
  const prompt = process.env.TTS_STYLE === "1" ? `Say it ${m.style}: ${text}` : text;
  for (const { key, model } of attempts(TTS_MODELS)) {
    if (signal?.aborted) return;
    const t0 = Date.now();
    let started = false;
    try {
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: m.voice } } } },
      };
      for await (const ev of sse(model, key, body, Number(process.env.TTS_FIRST_CHUNK_MS ?? 5000), signal)) {
        for (const p of ev.candidates?.[0]?.content?.parts ?? []) {
          const d = p.inlineData;
          if (!d?.data || !String(d.mimeType).startsWith("audio/")) continue;
          if (!started) { started = true; if (Date.now() - t0 > 1500) console.log(`[tts] ${m.name} via ${model} (first audio ${Date.now() - t0} ms)`); }
          yield Buffer.from(d.data, "base64");
        }
      }
      if (started) return;
      throw new HttpError(500, "no audio");
    } catch (err) {
      if (started) return; // keep what was said
      if (signal?.aborted) return;
      markDown(key, model, statusOf(err));
      console.warn(`[tts] ${model} unavailable for ${m.name} (${(err as Error).name === "AbortError" ? "timeout" : (err as Error).message.slice(0, 80)})`);
    }
  }
  if (signal?.aborted) return;
  console.warn(`[tts] every Gemini voice failed; ${m.name} speaks with the Mac voice ${m.sayVoice}`);
  const pcm = await sayPcm(text, m.sayVoice).catch(() => sayPcm(text, "Daniel")).catch(() => null);
  if (pcm) { SAY_AUDIO.add(pcm); yield pcm; }
}

let elevenUpAt = 0;
const run = promisify(execFile);
/** Audio that came from the Mac's `say` fallback (never cached as a permanent recording). */
export const SAY_AUDIO = new WeakSet<Buffer>();

/** macOS `say` -> PCM16 mono 24 kHz. */
export async function sayPcm(text: string, voice: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "council-say-"));
  const file = join(dir, "line.wav");
  try {
    await run("say", ["-v", voice, "-o", file, "--file-format=WAVE", `--data-format=LEI16@${TTS_RATE}`, text], { timeout: 20_000 });
    return wavData(await readFile(file));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The samples of a PCM WAV file (skips any extra chunks such as FLLR). */
export function wavData(wav: Buffer): Buffer {
  let off = 12;
  while (off + 8 <= wav.length) {
    const id = wav.toString("ascii", off, off + 4);
    const size = wav.readUInt32LE(off + 4);
    if (id === "data") return wav.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size & 1);
  }
  throw new Error("no data chunk in WAV");
}

/** PCM16 mono -> WAV, for sending the caller's audio to Gemini. */
export function toWav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
