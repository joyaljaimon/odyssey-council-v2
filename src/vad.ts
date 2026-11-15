// Energy-based voice activity detection on the caller's PCM16 mono audio. Finds where a question starts and ends;
// Gemini does the actual listening. The noise floor adapts, so a noisy room needs a louder voice to count as speech.
const FRAME_MS = 20;
export type VadEvent = "start" | "cancel" | Buffer | null;

export class Vad {
  private frame: number; // samples per 20 ms
  private carry: Buffer = Buffer.alloc(0);
  private noise = 0.003;
  private run = 0; // consecutive loud frames
  private silence = 0; // ms of quiet while speaking
  private voiced = 0; // ms of speech in the current utterance
  private preroll: Buffer[] = [];
  private utterance: Buffer[] = [];
  private speaking = false;
  level = 0; // 0..1 loudness of the latest frame, for the stage's mic meter

  constructor(
    private rate: number,
    private opts = {
      endSilenceMs: Number(process.env.VAD_END_MS ?? 750),
      minSpeechMs: Number(process.env.VAD_MIN_MS ?? 300),
      maxMs: Number(process.env.VAD_MAX_MS ?? 20_000),
      minRms: Number(process.env.VAD_MIN_RMS ?? 0.012),
    },
  ) {
    this.frame = (rate / 1000) * FRAME_MS;
  }

  get active() { return this.speaking; }

  /** Feed caller audio. "start" when speech begins; the whole utterance (Buffer) when it ends; "cancel" if it was too short. */
  push(pcm: Buffer): VadEvent {
    let out: VadEvent = null;
    this.carry = this.carry.length ? Buffer.concat([this.carry, pcm]) : pcm;
    const bytes = this.frame * 2;
    while (this.carry.length >= bytes) {
      const f = Buffer.from(this.carry.subarray(0, bytes));
      this.carry = this.carry.subarray(bytes);
      const r = this.step(f);
      if (r && !(out instanceof Buffer)) out = r;
    }
    return out;
  }

  reset() {
    this.speaking = false; this.run = 0; this.silence = 0; this.voiced = 0; this.utterance = []; this.preroll = [];
  }

  private step(f: Buffer): VadEvent {
    let sum = 0;
    for (let i = 0; i < f.length; i += 2) { const s = f.readInt16LE(i) / 32768; sum += s * s; }
    const rms = Math.sqrt(sum / (f.length / 2));
    this.level = Math.min(1, rms * 6);
    const threshold = Math.max(this.opts.minRms, this.noise * 3.5);
    const loud = rms > threshold;
    if (!loud && !this.speaking) this.noise = this.noise * 0.97 + rms * 0.03;

    if (!this.speaking) {
      this.preroll.push(f);
      if (this.preroll.length > 15) this.preroll.shift(); // 300 ms before the start
      this.run = loud ? this.run + 1 : 0;
      if (this.run >= 4) {
        this.speaking = true;
        this.utterance = [...this.preroll];
        this.preroll = [];
        this.voiced = this.run * FRAME_MS;
        this.silence = 0;
        return "start";
      }
      return null;
    }
    this.utterance.push(f);
    if (loud) { this.voiced += FRAME_MS; this.silence = 0; } else this.silence += FRAME_MS;
    const total = this.utterance.length * FRAME_MS;
    if (this.silence >= this.opts.endSilenceMs || total >= this.opts.maxMs) {
      const voiced = this.voiced;
      const audio = Buffer.concat(this.utterance);
      this.reset();
      return voiced >= this.opts.minSpeechMs ? audio : "cancel";
    }
    return null;
  }
}
