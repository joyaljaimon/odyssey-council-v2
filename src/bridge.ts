// A FaceTime call, in a LiveKit room that is already joined (see chert.ts):
//   caller audio  (16 kHz mono)  ─▶ Council
//   caller camera (latest frame) ─▶ Council, as a JPEG when a question ends
//   Council voice (24 kHz mono)  ─▶ one published audio track
//   the stage (drawn in Node)    ─▶ one published camera track, from the same participant
// Chert rules (chert guide agent / video): exactly one unmuted audio track; video only counts from the participant that
// speaks; the caller is "chert-bridge-<call id>"; greet within 10 s of room metadata {"chert_bridge_ready": true}.
import {
  AudioFrame, AudioSource, AudioStream, LocalAudioTrack, LocalVideoTrack, RoomEvent, TrackKind, TrackPublishOptions,
  TrackSource, VideoBufferType, VideoCodec, VideoFrame, VideoSource, VideoStream,
  type RemoteParticipant, type RemoteTrack, type RemoteTrackPublication, type Room,
} from "@livekit/rtc-node";
import { Council } from "./council.ts";
import { TTS_RATE } from "./gemini.ts";
import { artReady, rgbaToJpeg } from "./stage.ts";

const IN_RATE = 16000;
const FPS = Number(process.env.STAGE_FPS ?? 15);
const FRAME_MS = 20;

export const isChertCaller = (p: RemoteParticipant) => p.identity.startsWith("chert-bridge-");
const bridgeReady = (metadata: string | undefined) => { try { return JSON.parse(metadata || "{}")?.chert_bridge_ready === true; } catch { return false; } };

export class Bridge {
  private audio = new AudioSource(TTS_RATE, 1, 3000);
  private video = new VideoSource(960, 540);
  private council: Council;
  private videoTimer?: NodeJS.Timeout;
  private pending: Buffer = Buffer.alloc(0);
  private pumping = false;
  private generation = 0;
  private callerAudio?: RemoteTrack;
  private callerVideo?: RemoteTrack;
  private lastFrame: { frame: VideoFrame; rotation: number; at: number } | null = null;
  private greeted = false;
  private closed = false;
  readonly ended: Promise<string>;
  private resolveEnded!: (reason: string) => void;

  constructor(private room: Room, readonly sessionId: string, private isCaller: (p: RemoteParticipant) => boolean = isChertCaller) {
    this.ended = new Promise((r) => (this.resolveEnded = r));
    this.council = new Council(sessionId, {
      sendAudio: (pcm) => this.enqueue(pcm),
      clearAudio: () => { this.generation++; this.pending = Buffer.alloc(0); this.audio.clearQueue(); },
    }, IN_RATE);
    this.council.setFrameSource(async () => this.frameJpeg());
  }

  async start() {
    await artReady;
    const me = this.room.localParticipant!;
    await me.publishTrack(LocalAudioTrack.createAudioTrack("council-voice", this.audio), new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }));
    await me.publishTrack(
      LocalVideoTrack.createVideoTrack("council-stage", this.video),
      new TrackPublishOptions({
        source: TrackSource.SOURCE_CAMERA, simulcast: false,
        videoCodec: process.env.STAGE_CODEC === "vp8" ? VideoCodec.VP8 : VideoCodec.H264,
        videoEncoding: { maxBitrate: BigInt(Number(process.env.STAGE_BITRATE ?? 1_800_000)), maxFramerate: FPS },
      }),
    );
    const t0 = performance.now();
    this.videoTimer = setInterval(() => {
      try {
        const px = this.council.stage.render();
        this.video.captureFrame(new VideoFrame(new Uint8Array(px.buffer, px.byteOffset, px.byteLength), 960, 540, VideoBufferType.RGBA), BigInt(Math.round((performance.now() - t0) * 1000)));
      } catch (err) { console.error(`[bridge ${this.sessionId}] stage frame failed`, (err as Error).message); }
    }, 1000 / FPS);

    // The caller's audio and camera, wherever they appear.
    const consider = (pub: RemoteTrackPublication, p: RemoteParticipant) => { if (this.isCaller(p)) pub.setSubscribed(true); };
    this.room.on(RoomEvent.TrackPublished, consider);
    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, p) => { if (this.isCaller(p)) this.onCallerTrack(track); });
    for (const p of this.room.remoteParticipants.values())
      for (const pub of p.trackPublications.values()) { consider(pub, p); if (pub.track && this.isCaller(p)) this.onCallerTrack(pub.track as RemoteTrack); }

    this.room.on(RoomEvent.ParticipantDisconnected, (p) => { if (this.isCaller(p)) void this.close("caller left"); });
    this.room.on(RoomEvent.Disconnected, () => void this.close("room closed"));
    const check = () => { if (bridgeReady(this.room.metadata)) { this.room.off(RoomEvent.RoomMetadataChanged, check); this.onReady(); } };
    this.room.on(RoomEvent.RoomMetadataChanged, check);
    check();
    console.log(`[bridge ${this.sessionId}] in the room; waiting for FaceTime`);
  }

  private onCallerTrack(track: RemoteTrack) {
    if (track.kind === TrackKind.KIND_AUDIO && !this.callerAudio) {
      this.callerAudio = track;
      console.log(`[bridge ${this.sessionId}] caller audio subscribed`);
      void this.readCallerAudio(track);
    } else if (track.kind === TrackKind.KIND_VIDEO && !this.callerVideo) {
      this.callerVideo = track;
      console.log(`[bridge ${this.sessionId}] caller camera subscribed`);
      void this.readCallerVideo(track);
    }
  }

  /** FaceTime is ready: greet now (Chert ends calls that stay silent for 10 s). */
  private onReady() {
    if (this.greeted || this.closed) return;
    this.greeted = true;
    console.log(`[bridge ${this.sessionId}] FaceTime is ready; greeting`);
    void this.council.greet();
  }

  private async readCallerAudio(track: RemoteTrack) {
    const stream = new AudioStream(track, { sampleRate: IN_RATE, numChannels: 1 });
    for await (const frame of stream) {
      if (this.closed) break;
      if (!this.greeted) continue;
      this.council.callerAudio(Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength));
    }
  }

  private async readCallerVideo(track: RemoteTrack) {
    for await (const ev of new VideoStream(track)) {
      if (this.closed) break;
      // Keep only the newest frame; it is converted to JPEG only when a question ends.
      this.lastFrame = { frame: ev.frame, rotation: Number(ev.rotation), at: Date.now() };
    }
  }

  private frameJpeg(): Buffer | null {
    const f = this.lastFrame;
    if (!f || Date.now() - f.at > 5000) return null;
    try {
      const rgba = f.frame.convert(VideoBufferType.RGBA);
      return rgbaToJpeg(rgba.data, rgba.width, rgba.height, f.rotation);
    } catch (err) {
      console.warn(`[bridge ${this.sessionId}] could not read the camera frame`, (err as Error).message);
      return null;
    }
  }

  private enqueue(pcm: Buffer) {
    this.pending = this.pending.length ? Buffer.concat([this.pending, pcm]) : pcm;
    if (!this.pumping) void this.pump();
  }

  /** 20 ms frames; captureFrame resolves as LiveKit's queue drains, which paces playback in real time. */
  private async pump() {
    this.pumping = true;
    const bytes = (TTS_RATE / 1000) * FRAME_MS * 2;
    try {
      while (!this.closed && this.pending.length >= bytes) {
        const gen = this.generation;
        const chunk = this.pending.subarray(0, bytes);
        this.pending = this.pending.subarray(bytes);
        const samples = new Int16Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + bytes));
        if (gen !== this.generation) continue;
        await this.audio.captureFrame(new AudioFrame(samples, TTS_RATE, 1, samples.length));
      }
      // a partial frame (< 20 ms) waits for the next chunk instead of being padded with silence mid-line
    } finally {
      this.pumping = false;
    }
  }

  async close(reason: string) {
    if (this.closed) return;
    this.closed = true;
    console.log(`[bridge ${this.sessionId}] closing: ${reason}`);
    clearInterval(this.videoTimer);
    this.council.close();
    this.resolveEnded(reason);
  }
}
