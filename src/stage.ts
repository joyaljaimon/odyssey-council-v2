// The picture the caller sees on FaceTime, drawn straight to pixels with canvas (no browser):
// the Council's portraits in arched frames, the speaker lit up and talking, the line as a subtitle, the topic,
// the episode's painting behind, and what the camera saw.
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D, type Canvas } from "@napi-rs/canvas";
import { ROSTER, byId } from "./roster.ts";

const asset = (p: string) => fileURLToPath(new URL(`../assets/${p}`, import.meta.url));
GlobalFonts.registerFromPath(asset("fonts/Cinzel.ttf"), "Cinzel");
GlobalFonts.registerFromPath(asset("fonts/EBGaramond.ttf"), "Garamond");
GlobalFonts.registerFromPath(asset("fonts/EBGaramond-Italic.ttf"), "Garamond Italic");

const GOLD = "#e8c15a", CREAM = "#f4ecdc", DIM_GOLD = "rgba(232,193,90,0.55)", INK = "#0b0907";
const IDLE_COUNCIL = ["athena", "odysseus", "poseidon", "penelope", "zeus"];

export type Phase = "waiting" | "listening" | "hearing" | "thinking" | "speaking";
export type StageState = {
  phase: Phase;
  topic?: string;
  heard?: string;
  saw?: string;
  sawFrame?: Image | null;
  scene?: string | null;
  seats: string[]; // members in this turn, in order of appearance
  speaker?: string;
  line?: string;
  mouth: number; // 0..1, loudness of the speaker's audio right now
  mic: number; // 0..1, loudness of the caller
};

// ---------------------------------------------------------------- art

type Portrait = { base: Image; speak?: Image };
const portraits = new Map<string, Portrait>();
const scenes = new Map<string, Image | null>();
const SCENE_IDS = ["aeolus", "calypso", "circe", "cyclops", "helios-cattle", "lotus-eaters", "phaeacians", "return-to-ithaca", "scylla-charybdis", "sirens", "telemachus", "underworld"];
export const artReady = (async () => {
  await Promise.all(SCENE_IDS.map(async (id) => { const f = asset(`scenes/${id}.jpg`); if (existsSync(f)) scenes.set(id, await loadImage(f)); }));
  await Promise.all(ROSTER.map(async (m) => {
    const base = asset(`portraits/${m.id}.jpg`), speak = asset(`portraits/${m.id}-speak.jpg`);
    if (!existsSync(base)) return;
    portraits.set(m.id, { base: await loadImage(base), speak: existsSync(speak) ? await loadImage(speak) : undefined });
  }));
})();
function scene(id: string): Image | null {
  if (scenes.has(id)) return scenes.get(id)!;
  scenes.set(id, null);
  const file = asset(`scenes/${id}.jpg`);
  if (existsSync(file)) void loadImage(file).then((img) => scenes.set(id, img)).catch(() => {});
  return null;
}

// ---------------------------------------------------------------- drawing helpers

function cover(ctx: SKRSContext2D, img: Image, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2 * 0.6, sw, sh, x, y, w, h);
}

function arch(ctx: SKRSContext2D, x: number, y: number, w: number, h: number) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function wrap(ctx: SKRSContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > maxW && cur) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/** Text that shrinks until it fits in `maxLines`. */
function fitText(ctx: SKRSContext2D, text: string, family: string, size: number, minSize: number, maxW: number, maxLines: number) {
  for (let s = size; s >= minSize; s -= 1) {
    ctx.font = `${s}px "${family}"`;
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines) return { lines, size: s };
  }
  ctx.font = `${minSize}px "${family}"`;
  const lines = wrap(ctx, text, maxW);
  const cut = lines.slice(0, maxLines);
  if (lines.length > maxLines) cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, "…");
  return { lines: cut, size: minSize };
}

function meander(ctx: SKRSContext2D, y: number, w: number, h: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, y, w, h);
  ctx.strokeStyle = "#a8742f";
  ctx.lineWidth = 2;
  const u = h - 4;
  for (let x = 0; x < w; x += u * 1.5) {
    ctx.beginPath();
    ctx.moveTo(x + 2, y + h - 2); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x + u, y + 2);
    ctx.lineTo(x + u, y + h * 0.7); ctx.lineTo(x + u * 0.45, y + h * 0.7); ctx.lineTo(x + u * 0.45, y + h * 0.4);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- the stage

export class Stage {
  readonly canvas: Canvas;
  private ctx: SKRSContext2D;
  private t0 = Date.now();
  state: StageState = { phase: "waiting", seats: [], mouth: 0, mic: 0 };

  constructor(readonly width = 960, readonly height = 540) {
    this.canvas = createCanvas(width, height);
    this.ctx = this.canvas.getContext("2d");
  }

  set(patch: Partial<StageState>) { Object.assign(this.state, patch); }

  /** Draw the current state; returns RGBA pixels. */
  render(): Uint8ClampedArray {
    this.draw();
    return this.ctx.getImageData(0, 0, this.width, this.height).data;
  }

  jpeg(quality = 75): Buffer {
    this.draw();
    return this.canvas.encodeSync("jpeg", quality);
  }

  private draw() {
    const { ctx, width: W, height: H } = this;
    const k = W / 960; // everything is laid out for 960x540 and scaled
    const st = this.state;
    const t = (Date.now() - this.t0) / 1000;
    ctx.save();
    ctx.scale(k, k);
    const w = 960, h = 540;

    // background: the episode's painting, darkened, or a warm dark gradient
    const bg = st.scene ? scene(st.scene) : null;
    if (bg) {
      cover(ctx, bg, 0, 0, w, h);
      ctx.fillStyle = "rgba(11,9,7,0.74)";
      ctx.fillRect(0, 0, w, h);
    } else {
      const g = ctx.createRadialGradient(w / 2, h * 0.42, 40, w / 2, h * 0.5, w * 0.7);
      g.addColorStop(0, "#2a1f17");
      g.addColorStop(1, INK);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    meander(ctx, 0, w, 16);
    meander(ctx, h - 16, w, 16);

    // title and topic
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = GOLD;
    ctx.font = `21px "Cinzel"`;
    ctx.fillText("T H E   O D Y S S E Y   C O U N C I L", w / 2, 50);
    const topic = st.topic ?? "Ask the gods and heroes anything about the Odyssey";
    const tf = fitText(ctx, topic, "Garamond Italic", 27, 18, w - 340, 1);
    ctx.fillStyle = CREAM;
    ctx.fillText(tf.lines[0] ?? "", w / 2, 84);

    // the seats
    const idle = st.seats.length === 0;
    const seats = idle ? IDLE_COUNCIL : st.seats.slice(0, 5);
    const n = seats.length;
    const cw = Math.min(138, (w - 140) / n - 22);
    const ch = cw * 1.27;
    const gap = 26;
    const rowW = n * cw + (n - 1) * gap;
    const top = 108;
    seats.forEach((id, i) => {
      const x = (w - rowW) / 2 + i * (cw + gap);
      const speaking = st.speaker === id;
      const dim = idle ? 0.5 : st.speaker && !speaking ? 0.4 : 0.9;
      this.seat(id, x, top, cw, ch, speaking, dim, st.mouth, t);
    });

    // the subtitle: who is speaking and what they say; or what to do now
    const subTop = top + ch + 94;
    const boxW = w - 160;
    ctx.textAlign = "center";
    if (st.phase === "speaking" && st.speaker && st.line) {
      const m = byId.get(st.speaker);
      ctx.fillStyle = GOLD;
      void m;
      const f = fitText(ctx, st.line, "Garamond", 28, 19, boxW, 4);
      ctx.fillStyle = CREAM;
      f.lines.forEach((l, i) => ctx.fillText(l, w / 2, subTop + i * f.size * 1.2));
    } else if (st.phase === "thinking" || st.phase === "hearing") {
      ctx.fillStyle = GOLD;
      ctx.font = `17px "Cinzel"`;
      const dots = ".".repeat(1 + (Math.floor(t * 2.5) % 3));
      ctx.fillText(st.phase === "hearing" ? `THE COUNCIL IS LISTENING${dots}` : `THE COUNCIL DELIBERATES${dots}`, w / 2, subTop);
      if (st.phase === "thinking" && st.heard) {
        const f = fitText(ctx, `“${st.heard}”`, "Garamond Italic", 25, 18, boxW, 3);
        ctx.fillStyle = CREAM;
        f.lines.forEach((l, i) => ctx.fillText(l, w / 2, subTop + 36 + i * f.size * 1.2));
      }
    } else if (st.phase === "listening" || st.phase === "waiting") {
      ctx.fillStyle = GOLD;
      ctx.font = `17px "Cinzel"`;
      ctx.fillText(st.phase === "waiting" ? "THE COUNCIL IS GATHERING" : "SPEAK, TRAVELLER", w / 2, subTop);
      ctx.fillStyle = "rgba(244,236,220,0.82)";
      ctx.font = `23px "Garamond Italic"`;
      const hints = [
        "“Was Odysseus right to blind the Cyclops?”",
        "“Why did Penelope wait twenty years?”",
        "Hold something up to the camera and ask about it",
        "“Who was to blame for the crew's death?”",
        "“Tell me about the Trojan horse”",
      ];
      ctx.fillText(hints[Math.floor(t / 5) % hints.length], w / 2, subTop + 36);
    }

    // what the camera saw
    if (st.saw && st.sawFrame && st.phase !== "listening") {
      const tw = 168, th = (tw * st.sawFrame.height) / st.sawFrame.width;
      const x = 34, y = 30;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 12;
      ctx.drawImage(st.sawFrame, x, y, tw, Math.min(th, 120));
      ctx.restore();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, tw, Math.min(th, 120));
      ctx.textAlign = "left";
      ctx.fillStyle = GOLD;
      ctx.font = `11px "Cinzel"`;
      ctx.fillText("THE COUNCIL SEES", x, y + Math.min(th, 120) + 16);
      ctx.fillStyle = CREAM;
      const f = fitText(ctx, st.saw, "Garamond Italic", 15, 12, tw, 2);
      f.lines.forEach((l, i) => ctx.fillText(l, x, y + Math.min(th, 120) + 34 + i * 16));
    }

    this.status(w, h, t);
    ctx.restore();
  }

  private seat(id: string, x: number, y: number, w: number, h: number, speaking: boolean, alpha: number, mouth: number, t: number) {
    const { ctx } = this;
    const m = byId.get(id);
    const lift = speaking ? 1.1 : 1;
    const cx = x + w / 2, cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(lift, lift);
    ctx.translate(-cx, -cy);
    if (speaking) { ctx.shadowColor = "rgba(232,193,90,0.75)"; ctx.shadowBlur = 26 + 8 * Math.sin(t * 3); }
    arch(ctx, x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = speaking ? GOLD : "#6d5124";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    arch(ctx, x, y, w, h);
    ctx.clip();
    ctx.globalAlpha = alpha;
    const p = portraits.get(id);
    if (p) {
      cover(ctx, p.base, x, y, w, h);
      if (speaking && p.speak && mouth > 0.08) { ctx.globalAlpha = Math.min(1, 0.35 + mouth); cover(ctx, p.speak, x, y, w, h); }
    } else {
      // medallion for members without a portrait yet
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "#3b2a1a"); g.addColorStop(1, "#1a120c");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = GOLD;
      ctx.textAlign = "center";
      ctx.font = `${Math.round(w * 0.5)}px "Cinzel"`;
      ctx.fillText((m?.name ?? id)[0], x + w / 2, y + h * 0.62);
    }
    ctx.restore();
    // name plate
    ctx.globalAlpha = speaking ? 1 : Math.max(alpha, 0.6);
    ctx.textAlign = "center";
    ctx.fillStyle = speaking ? GOLD : DIM_GOLD;
    ctx.font = `${w < 120 ? 13 : 15}px "Cinzel"`;
    ctx.fillText((m?.name ?? id).toUpperCase(), cx, y + h + 22);
    ctx.fillStyle = speaking ? CREAM : "rgba(244,236,220,0.6)";
    ctx.font = `${w < 120 ? 11 : 12.5}px "Garamond Italic"`;
    ctx.fillText(m?.title ?? "", cx, y + h + 38);
    ctx.restore();
  }

  private status(w: number, h: number, t: number) {
    const { ctx, state: st } = this;
    const label = { waiting: "Connecting", listening: "Listening", hearing: "Hearing you", thinking: "Deliberating", speaking: "Speaking" }[st.phase];
    const color = st.phase === "speaking" ? GOLD : st.phase === "thinking" ? "#d9a441" : "#7fc98f";
    ctx.font = `12px "Cinzel"`;
    ctx.textAlign = "left";
    const tw = ctx.measureText(label.toUpperCase()).width;
    const pw = tw + 52, x = w - pw - 30, y = h - 52;
    ctx.fillStyle = "rgba(11,9,7,0.75)";
    ctx.beginPath(); ctx.roundRect(x, y, pw, 26, 13); ctx.fill();
    ctx.strokeStyle = "rgba(232,193,90,0.4)"; ctx.lineWidth = 1; ctx.stroke();
    const pulse = st.phase === "listening" || st.phase === "hearing" ? 4 + st.mic * 8 : st.phase === "thinking" ? 4 + 2 * Math.sin(t * 6) : 5;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + 18, y + 13, Math.max(3, pulse), 0, Math.PI * 2); ctx.fill();
    ctx.fillText(label.toUpperCase(), x + 34, y + 17.5);
  }
}

/** Decode a JPEG (the caller's camera frame) into an image the stage can draw. */
export async function imageFromJpeg(jpeg: Buffer): Promise<Image | null> {
  try { return await loadImage(jpeg); } catch { return null; }
}

/** RGBA pixels (e.g. a LiveKit video frame) -> small upright JPEG for Gemini. `quarterTurns` = clockwise rotation needed. */
export function rgbaToJpeg(data: Uint8Array, width: number, height: number, quarterTurns = 0, maxSide = 768): Buffer {
  const src = createCanvas(width, height);
  const sctx = src.getContext("2d");
  const img = sctx.createImageData(width, height);
  img.data.set(data.subarray(0, width * height * 4));
  sctx.putImageData(img, 0, 0);
  const s = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.round(width * s), h = Math.round(height * s);
  const turned = quarterTurns % 2 === 1;
  const out = createCanvas(turned ? h : w, turned ? w : h);
  const ctx = out.getContext("2d");
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((quarterTurns * Math.PI) / 2);
  ctx.drawImage(src, -w / 2, -h / 2, w, h);
  return out.encodeSync("jpeg", 80);
}
