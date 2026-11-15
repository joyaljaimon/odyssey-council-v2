// The agent's side of a FaceTime call, in a LiveKit room that is already joined.
//   caller audio (16 kHz mono)  -> Brain WS /voice   (binary PCM16)
//   Brain audio (24 kHz mono)   -> one published audio track  ("agent-voice")
//   the stage page (1280x720)   -> one published camera track ("agent-stage"), from the same participant
// Used by chert.ts (Chert's managed line) and facetime.ts (Chert's open-source connector).
//
// Chert rules (chert guide agent / chert guide video):
//  - publish exactly one unmuted audio track; video only counts from the participant that speaks
//  - the caller is the participant "chert-bridge-<call id>"
//  - greet once when room metadata has {"chert_bridge_ready": true}, and within 10 s, or the call ends
import WebSocket from "ws";
import {
  AudioFrame, AudioSource, AudioStream, LocalAudioTrack, LocalVideoTrack, RoomEvent, TrackKind,
  TrackPublishOptions, TrackSource, VideoBufferType, VideoCodec, VideoFrame, VideoSource,
  type RemoteParticipant, type RemoteTrack, type RemoteTrackPublication, type Room,
} from "@livekit/rtc-node";
import { AGENT_AUDIO_SAMPLE_RATE, USER_AUDIO_SAMPLE_RATE, type VoiceControlMessage } from "@odyssey/contracts";
import { VIDEO_HEIGHT, VIDEO_WIDTH, stageUrl, startStageVideo } from "./stage-capture.ts";

const BRAIN_URL = process.env.BRAIN_URL ?? "http://localhost:8080";
const FPS = Number(process.env.STAGE_FPS ?? 20);
const FRAME_MS = 20;

export type BridgeOptions = {
  video: boolean;
  /** "bridge_ready": wait for Chert's room metadata signal. "caller_audio": start when caller audio arrives. */
  readyOn: "bridge_ready" | "caller_audio";
  /** Which remote participant is the caller. */
  isCaller: (p: RemoteParticipant) => boolean;
};

export const isChertBridge = (p: RemoteParticipant) => p.identity.startsWith("chert-bridge-");

export function bridgeReady(metadata: string | undefined): boolean {
  try { return JSON.parse(metadata || "{}")?.chert_bridge_ready === true; } catch { return false; }
}

export class AgentBridge {
  private audio = new AudioSource(AGENT_AUDIO_SAMPLE_RATE, 1, 2000);
  private videoSource?: VideoSource;
  private stage?: Awaited<ReturnType<typeof startStageVideo>>;
  private videoTimer?: NodeJS.Timeout;
  private brain?: WebSocket;
  private callerTrack?: RemoteTrack;
  private ready = false;
  private pending = Buffer.alloc(0);
  private pumping = false;
  private generation = 0; // bumps on interruption so queued audio is dropped
  private closed = false;
  readonly ended: Promise<string>;
  private resolveEnded!: (reason: string) => void;

  constructor(private room: Room, readonly sessionId: string, private opts: BridgeOptions) {
    this.ended = new Promise((r) => (this.resolveEnded = r));
  }

  async start() {
    const me = this.room.localParticipant!;
    await me.publishTrack(LocalAudioTrack.createAudioTrack("agent-voice", this.audio), new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }));

    if (this.opts.video) {
      try {
        this.stage = await startStageVideo(this.sessionId);
        this.videoSource = new VideoSource(VIDEO_WIDTH, VIDEO_HEIGHT);
        // One full-quality stream for one viewer (Chert's Mac): no simulcast, so it can't be switched to a small,
        // low-frame-rate layer; enough bitrate for 960x540; H.264 so the Mac's hardware encoder does the work.
        await me.publishTrack(
          LocalVideoTrack.createVideoTrack("agent-stage", this.videoSource),
          new TrackPublishOptions({
            source: TrackSource.SOURCE_CAMERA,
            simulcast: false,
            videoCodec: process.env.STAGE_CODEC === "vp8" ? VideoCodec.VP8 : VideoCodec.H264,
            videoEncoding: { maxBitrate: BigInt(Number(process.env.STAGE_BITRATE ?? 2_500_000)), maxFramerate: FPS },
          }),
        );
        // Frames carry real timestamps so the encoder sees even pacing, not timer jitter.
        const t0 = performance.now();
        this.videoTimer = setInterval(() => {
          const f = this.stage?.latest();
          if (f) this.videoSource!.captureFrame(new VideoFrame(f.data, f.width, f.height, VideoBufferType.RGBA), BigInt(Math.round((performance.now() - t0) * 1000)));
        }, 1000 / FPS);
        console.log(`[bridge ${this.sessionId}] streaming ${stageUrl(this.sessionId)} as video at ${FPS} fps`);
      } catch (err) {
        // Fallback 1 from docs/timeline.md: keep the voice call going without video.
        console.error(`[bridge ${this.sessionId}] stage video failed, continuing audio only:`, (err as Error).message);
      }
    }

    // Caller audio: subscribe to the caller's audio track wherever it appears.
    const consider = (pub: RemoteTrackPublication, p: RemoteParticipant) => {
      if (this.opts.isCaller(p) && pub.kind === TrackKind.KIND_AUDIO) pub.setSubscribed(true);
    };
    this.room.on(RoomEvent.TrackPublished, consider);
    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, p) => {
      if (this.opts.isCaller(p) && track.kind === TrackKind.KIND_AUDIO) this.onCallerAudio(track);
    });
    for (const p of this.room.remoteParticipants.values())
      for (const pub of p.trackPublications.values()) {
        consider(pub, p);
        if (pub.track && this.opts.isCaller(p) && pub.kind === TrackKind.KIND_AUDIO) this.onCallerAudio(pub.track as RemoteTrack);
      }

    this.room.on(RoomEvent.ParticipantDisconnected, (p) => { if (this.opts.isCaller(p)) void this.close("caller left"); });
    this.room.on(RoomEvent.Disconnected, () => void this.close("room closed"));

    if (this.opts.readyOn === "bridge_ready") {
      const check = () => { if (bridgeReady(this.room.metadata)) { this.room.off(RoomEvent.RoomMetadataChanged, check); this.onReady(); } };
      this.room.on(RoomEvent.RoomMetadataChanged, check);
      check();
    }
  }

  private onCallerAudio(track: RemoteTrack) {
    if (this.callerTrack) return;
    this.callerTrack = track;
    console.log(`[bridge ${this.sessionId}] caller audio subscribed`);
    if (this.opts.readyOn === "caller_audio") this.onReady();
    else if (this.ready) void this.pipeCallerAudio();
  }

  /** FaceTime is ready: open Brain's voice socket. Brain greets immediately (well inside Chert's 10 s window). */
  private onReady() {
    if (this.ready || this.closed) return;
    this.ready = true;
    console.log(`[bridge ${this.sessionId}] FaceTime ready, connecting to Brain`);
    const ws = new WebSocket(`${BRAIN_URL.replace(/^http/, "ws")}/voice?sessionId=${encodeURIComponent(this.sessionId)}`);
    this.brain = ws;
    ws.on("message", (data, isBinary) => {
      if (isBinary) this.enqueue(data as Buffer);
      else { try { this.control(JSON.parse(String(data)) as VoiceControlMessage); } catch { /* ignore */ } }
    });
    ws.on("open", () => void this.pipeCallerAudio());
    ws.on("close", () => void this.close("Brain closed the voice socket"));
    ws.on("error", (e) => console.error(`[bridge ${this.sessionId}] brain socket error:`, e.message));
  }

  private piping = false;
  private async pipeCallerAudio() {
    const ws = this.brain;
    if (this.piping || !this.callerTrack || !ws || ws.readyState !== ws.OPEN) return;
    this.piping = true;
    const stream = new AudioStream(this.callerTrack, { sampleRate: USER_AUDIO_SAMPLE_RATE, numChannels: 1 });
    for await (const frame of stream) {
      if (this.closed || ws.readyState !== ws.OPEN) break;
      ws.send(Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength), { binary: true });
    }
  }

  private control(msg: VoiceControlMessage) {
    if (msg.type === "interrupted") {
      this.generation++;
      this.pending = Buffer.alloc(0);
      this.audio.clearQueue();
    } else if (msg.type === "ended") {
      console.log(`[bridge ${this.sessionId}] Brain ended the session`);
      setTimeout(() => void this.close("session ended"), 2500); // let the goodbye finish playing
    }
  }

  private enqueue(pcm: Buffer) {
    this.pending = Buffer.concat([this.pending, pcm]);
    if (!this.pumping) void this.pump();
  }

  /** Feeds 20 ms frames; captureFrame resolves as LiveKit's queue drains, which paces playback in real time. */
  private async pump() {
    this.pumping = true;
    const bytes = (AGENT_AUDIO_SAMPLE_RATE / 1000) * FRAME_MS * 2;
    try {
      while (!this.closed && this.pending.length >= bytes) {
        const gen = this.generation;
        const chunk = this.pending.subarray(0, bytes);
        this.pending = this.pending.subarray(bytes);
        const samples = new Int16Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + bytes));
        if (gen !== this.generation) continue;
        await this.audio.captureFrame(new AudioFrame(samples, AGENT_AUDIO_SAMPLE_RATE, 1, samples.length));
      }
    } finally {
      this.pumping = false;
    }
  }

  async close(reason: string) {
    if (this.closed) return;
    this.closed = true;
    console.log(`[bridge ${this.sessionId}] closing: ${reason}`);
    clearInterval(this.videoTimer);
    if (this.brain?.readyState === WebSocket.OPEN) this.brain.send(JSON.stringify({ type: "ended" } satisfies VoiceControlMessage));
    this.brain?.close();
    await Promise.allSettled([this.stage?.stop()]);
    this.resolveEnded(reason);
  }
}
