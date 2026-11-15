// Voice mode (FaceTime). One Gemini Live session per character per call.
//   Channel -> Brain: binary PCM16 mono 16 kHz          Brain -> Channel: binary PCM16 mono 24 kHz
//   Brain -> Channel: JSON { type: "interrupted" } (drop queued audio) and { type: "ended" } (hang up)
// Mouth events are scheduled against a playback clock, so the stage mouth moves when the audio is heard,
// not when it arrives (Gemini sends audio faster than real time).
import { Modality, type LiveServerMessage, type Session as LiveSession } from "@google/genai";
import type { WebSocket } from "ws";
import {
  AGENT_AUDIO_SAMPLE_RATE, USER_AUDIO_SAMPLE_RATE,
  type AppMode, type CharacterId, type StageEvent, type VoiceControlMessage,
} from "@odyssey/contracts";
import { getCharacter } from "@odyssey/story";
import { MODE_NAMES, systemPrompt, voiceFor } from "./persona.ts";
import { getSession, recap, type Session } from "./session.ts";
import { emit, mouthLevel } from "./stage.ts";
import { gemini } from "./text.ts";
import { modeEvents, runTool, toolsFor } from "./tools.ts";

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live";
export const MOUTH_EVENT_MS = 50;
const BYTES_PER_MS = (AGENT_AUDIO_SAMPLE_RATE * 2) / 1000; // PCM16 mono

type After = { kind: "switch"; to: CharacterId } | { kind: "debate"; topic: string } | { kind: "end" } | { kind: "mode" };

class Call {
  private live: LiveSession | null = null;
  private timers = new Set<NodeJS.Timeout>();
  private playhead = 0; // ms timestamp when queued audio finishes playing
  private turnText = "";
  private userText = "";
  private after: After | null = null;
  private busy = false; // switching or debating: ignore caller audio
  private closed = false;
  private turnDone: (() => void) | null = null;

  constructor(private s: Session, private ws: WebSocket) {}

  // -------------------------------------------------- lifecycle

  async start() {
    this.ws.on("message", (data, isBinary) => {
      if (isBinary) this.userAudio(data as Buffer);
      else this.control(String(data));
    });
    this.ws.on("close", () => this.close());
    // Each call starts with just the god on stage: no screen until there is something to show.
    this.stage({ type: "clear" });
    this.stage({ type: "character", character: this.s.character });
    await this.open(this.s.character, { firstTurn: !this.s.disclosed });
    this.prompt("(The FaceTime call has just connected. Greet the caller now.)");
    this.s.disclosed = true;
  }

  private async open(character: CharacterId, opts: { firstTurn: boolean; summary?: string }) {
    this.live?.close();
    this.s.character = character;
    this.s.summary.character = character;
    this.live = await gemini()!.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceFor(character) } } },
        systemInstruction: systemPrompt(character, "voice", { ...opts, appMode: this.s.mode }),
        tools: [{ functionDeclarations: toolsFor(this.s.mode) }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: { slidingWindow: {} },
      },
      callbacks: {
        onmessage: (m) => void this.onMessage(m),
        onerror: (e) => console.error(`[voice ${this.s.id}] live error`, e.message),
        onclose: (e) => console.log(`[voice ${this.s.id}] live closed (${character})`, e.reason ?? ""),
      },
    });
    console.log(`[voice ${this.s.id}] live session open: ${character} / ${voiceFor(character)}`);
  }

  private close() {
    if (this.closed) return;
    this.closed = true;
    this.clearTimers();
    this.live?.close();
    this.stage({ type: "mouth", character: this.s.character, level: 0 });
    console.log(`[voice ${this.s.id}] call closed`);
  }

  private prompt(text: string) {
    this.live?.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
  }

  private send(msg: VoiceControlMessage) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private stage(e: StageEvent) {
    emit(this.s.id, e);
  }

  // -------------------------------------------------- caller -> Gemini

  private userAudio(pcm: Buffer) {
    if (this.busy || !this.live) return;
    this.live.sendRealtimeInput({ audio: { data: pcm.toString("base64"), mimeType: `audio/pcm;rate=${USER_AUDIO_SAMPLE_RATE}` } });
  }

  private control(raw: string) {
    try {
      const msg = JSON.parse(raw) as VoiceControlMessage;
      if (msg.type === "ended") this.ws.close();
    } catch { /* ignore */ }
  }

  // -------------------------------------------------- Gemini -> caller + stage

  private async onMessage(m: LiveServerMessage) {
    const sc = m.serverContent;
    if (sc?.interrupted) this.interrupt();
    for (const part of sc?.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (data && part.inlineData?.mimeType?.startsWith("audio/")) this.playAudio(Buffer.from(data, "base64"));
    }
    if (sc?.inputTranscription?.text) this.userText += sc.inputTranscription.text;
    if (sc?.outputTranscription?.text) {
      this.turnText += sc.outputTranscription.text;
      this.at(this.playhead, () => this.stage({ type: "caption", text: this.turnText.trim().slice(-160) }));
    }
    if (sc?.turnComplete) await this.onTurnComplete();
    if (m.toolCall?.functionCalls?.length) await this.onToolCall(m.toolCall.functionCalls);
    if (m.goAway) console.warn(`[voice ${this.s.id}] live session ending soon (${m.goAway.timeLeft})`);
  }

  private playAudio(pcm: Buffer) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(pcm, { binary: true });
    // Schedule one mouth event per 50 ms of audio, at the moment it will be heard.
    const now = Date.now();
    if (this.playhead < now) this.playhead = now;
    const step = Math.round(BYTES_PER_MS * MOUTH_EVENT_MS) & ~1;
    for (let off = 0; off < pcm.length; off += step) {
      const level = mouthLevel(pcm.subarray(off, Math.min(off + step, pcm.length)));
      this.at(this.playhead, () => this.stage({ type: "mouth", character: this.s.character, level }));
      this.playhead += Math.min(step, pcm.length - off) / BYTES_PER_MS;
    }
  }

  private interrupt() {
    this.clearTimers();
    this.playhead = 0;
    this.send({ type: "interrupted" });
    this.stage({ type: "mouth", character: this.s.character, level: 0 });
    this.finishTurnText();
  }

  private async onTurnComplete() {
    this.at(this.playhead, () => this.stage({ type: "mouth", character: this.s.character, level: 0 }));
    this.finishTurnText();
    this.turnDone?.();
    const after = this.after;
    this.after = null;
    if (!after) return;
    await this.waitForPlayback();
    if (after.kind === "switch") await this.switchTo(after.to);
    else if (after.kind === "mode") await this.reopenForMode("(The mode just changed. Start it now, as your instructions for this mode say.)");
    else if (after.kind === "debate") await this.debate(after.topic);
    else {
      this.send({ type: "ended" });
      setTimeout(() => this.ws.close(), 500);
    }
  }

  private finishTurnText() {
    if (this.userText.trim()) this.s.transcript.push({ who: "user", text: this.userText.trim() });
    if (this.turnText.trim()) this.s.transcript.push({ who: this.s.character, text: this.turnText.trim() });
    this.userText = "";
    this.turnText = "";
  }

  private async onToolCall(calls: { id?: string; name?: string; args?: Record<string, unknown> }[]) {
    const functionResponses = [];
    for (const call of calls) {
      const out = await runTool(this.s, call.name ?? "", call.args ?? {});
      // Visuals land when the character reaches this point in its speech.
      for (const e of out.events) this.at(this.playhead, () => this.stage(e));
      // e.g. the next "Be Odysseus" decision: after the outcome and Homer's choice have been told (~12 s)
      for (const e of out.later ?? []) this.at(Math.max(this.playhead, Date.now()) + 12000, () => this.stage(e));
      if (out.switchTo && out.switchTo !== this.s.character) this.after = { kind: "switch", to: out.switchTo };
      if (out.debateTopic) this.after = { kind: "debate", topic: out.debateTopic };
      if (out.ended) this.after = { kind: "end" };
      if (out.modeChanged && !this.after) this.after = { kind: "mode" };
      functionResponses.push({ id: call.id, name: call.name, response: out.response });
    }
    this.live?.sendToolResponse({ functionResponses });
  }

  // -------------------------------------------------- character switch and debate

  private async switchTo(to: CharacterId) {
    this.busy = true;
    this.stage({ type: "character", character: to });
    await this.open(to, { firstTurn: false, summary: recap(this.s) });
    this.busy = false;
    this.prompt("(You have just taken over the call. Greet the caller briefly by name and continue.)");
  }

  /** A Live session's prompt and tools are fixed, so a new mode means a new session (same voice, with a recap). */
  async reopenForMode(prompt: string) {
    this.busy = true;
    await this.open(this.s.character, { firstTurn: false, summary: recap(this.s) });
    this.busy = false;
    this.prompt(prompt);
  }

  /** The user tapped a mode card on the stage page. */
  async tappedMode(mode: AppMode | undefined) {
    for (const e of modeEvents(this.s, mode)) this.stage(e);
    this.interrupt();
    await this.reopenForMode(mode ? `(The user just tapped "${MODE_NAMES[mode]}" on the screen. Start that mode now.)` : "(The user went back to the menu. Offer the three choices again.)");
  }

  /** Odysseus (left) and Poseidon (right) each speak twice, then Athena returns and asks the caller to pick. */
  private async debate(topic: string) {
    this.busy = true;
    const turns: { who: CharacterId; side: "left" | "right" }[] = [
      { who: "odysseus", side: "left" }, { who: "poseidon", side: "right" },
      { who: "odysseus", side: "left" }, { who: "poseidon", side: "right" },
    ];
    for (const t of turns) {
      if (this.closed) return;
      this.stage({ type: "character", character: t.who, side: t.side });
      await this.open(t.who, { firstTurn: false, summary: recap(this.s, 8) });
      const done = new Promise<void>((r) => (this.turnDone = r));
      this.prompt(`(Debate on: "${topic}". Make your next argument in under 20 seconds, answering your opponent's last point if there is one. Don't ask the caller anything yet.)`);
      await done;
      this.turnDone = null;
      await this.waitForPlayback();
    }
    this.stage({ type: "character", character: "athena" });
    await this.open("athena", { firstTurn: false, summary: recap(this.s, 8) });
    this.busy = false;
    this.prompt(`(The debate between Odysseus and Poseidon on "${topic}" just ended. In one or two sentences ask the caller whose side they are on, and why.)`);
  }

  // -------------------------------------------------- timing helpers

  private at(when: number, fn: () => void) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, Math.max(0, when - Date.now()));
    this.timers.add(t);
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private waitForPlayback() {
    return new Promise<void>((r) => setTimeout(r, Math.max(0, this.playhead - Date.now()) + 300));
  }
}

const calls = new Map<string, Call>();
export const activeCall = (sessionId: string) => calls.get(sessionId);

export function handleVoice(sessionId: string, ws: WebSocket) {
  console.log(`[voice] session ${sessionId} connected`);
  const s = getSession(sessionId);
  if (!gemini()) {
    console.warn("[voice] GEMINI_API_KEY is not set: voice calls stay silent. Text mode works offline.");
    emit(sessionId, { type: "character", character: "athena" });
    emit(sessionId, { type: "caption", text: `${getCharacter("athena")?.name} is offline: set GEMINI_API_KEY to enable voice.` });
    ws.on("message", () => {});
    return;
  }
  const call = new Call(s, ws);
  calls.set(sessionId, call);
  ws.on("close", () => { if (calls.get(sessionId) === call) calls.delete(sessionId); });
  call.start().catch((err) => {
    console.error(`[voice ${sessionId}] failed to start`, err);
    ws.close(1011, "live session failed");
  });
}
