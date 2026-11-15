// The picture the caller sees on FaceTime, drawn straight to pixels with canvas (no browser).
// Look: the HackUTA 2026 Odyssey theme. Navy ink on parchment, a dithered sky between olive-tree cliffs, a dark
// sea where the subtitles sit, Barlow Semi Condensed for the interface and Greek-lettered display type.
// The Council sits in arched frames drawn in navy ink; whoever speaks "glows up" into full colour and lifts forward.
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createCanvas, GlobalFonts, loadImage, type Canvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { ROSTER, byId } from "./roster.ts";

const asset = (p: string) => fileURLToPath(new URL(`../assets/${p}`, import.meta.url));
GlobalFonts.registerFromPath(asset("fonts/BarlowSemiCondensed-Medium.ttf"), "Barlow Medium");
GlobalFonts.registerFromPath(asset("fonts/BarlowSemiCondensed-SemiBold.ttf"), "Barlow SemiBold");
GlobalFonts.registerFromPath(asset("fonts/BarlowSemiCondensed-Bold.ttf"), "Barlow Bold");
GlobalFonts.registerFromPath(asset("fonts/EBGaramond.ttf"), "Garamond");
GlobalFonts.registerFromPath(asset("fonts/EBGaramond-Italic.ttf"), "Garamond Italic");

// HackUTA 2026 palette
const NAVY = "#1a3a52", DEEP = "#102f46", ABYSS = "#071a2a", STEEL = "#305873";
const PARCH = "#f6eddf", PARCH_2 = "#eee3d2", GOLD = "#e8c97a";
const INK_RGB: [number, number, number] = [16, 47, 70], PAPER_RGB: [number, number, number] = [238, 227, 210];
const IDLE_COUNCIL = ["athena", "odysseus", "poseidon", "penelope", "zeus", "circe"];

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

type Pic = Image | Canvas;
type Portrait = { color: Image; speak?: Image; ink: Canvas };
const portraits = new Map<string, Portrait>();
const scenes = new Map<string, Canvas>();
let backdrop: Image | null = null;
const SCENE_IDS = ["aeolus", "calypso", "circe", "cyclops", "helios-cattle", "lotus-eaters", "phaeacians", "return-to-ithaca", "scylla-charybdis", "sirens", "telemachus", "underworld"];

/** Two-tone navy/parchment version of a picture, like the drawings on the HackUTA site. */
function inked(img: Image, maxW = 480): Canvas {
  const s = Math.min(1, maxW / img.width);
  const c = createCanvas(Math.round(img.width * s), Math.round(img.height * s));
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    const t = Math.min(1, Math.max(0, (l - 0.08) * 1.35)); // a little more contrast, like ink
    px[i] = INK_RGB[0] + (PAPER_RGB[0] - INK_RGB[0]) * t;
    px[i + 1] = INK_RGB[1] + (PAPER_RGB[1] - INK_RGB[1]) * t;
    px[i + 2] = INK_RGB[2] + (PAPER_RGB[2] - INK_RGB[2]) * t;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

export const artReady = (async () => {
  if (existsSync(asset("backdrop.jpg"))) backdrop = await loadImage(asset("backdrop.jpg"));
  await Promise.all(SCENE_IDS.map(async (id) => {
    const f = asset(`scenes/${id}.jpg`);
    if (existsSync(f)) scenes.set(id, inked(await loadImage(f), 640));
  }));
  await Promise.all(ROSTER.map(async (m) => {
    const base = asset(`portraits/${m.id}.jpg`), speak = asset(`portraits/${m.id}-speak.jpg`);
    if (!existsSync(base)) return;
    const color = await loadImage(base);
    portraits.set(m.id, { color, speak: existsSync(speak) ? await loadImage(speak) : undefined, ink: inked(color, 360) });
  }));
})();

// ---------------------------------------------------------------- drawing helpers

function cover(ctx: SKRSContext2D, img: Pic, x: number, y: number, w: number, h: number, focusY = 0.3) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * focusY, sw, sh, x, y, w, h);
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

/** Letter-spaced text (HackUTA tracks its capitals wide). */
function tracked(ctx: SKRSContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "center" | "right" = "center") {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (widths.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = prev;
  return total;
}

/** "ODYSSEY" -> "ΘDYSSΣY": the Greek-lettered display style of the HackUTA site. */
const greek = (s: string) => s.toUpperCase().replace(/O/g, "Θ").replace(/E/g, "Σ").replace(/N/g, "Π");

/** A thin Greek-key line, as HackUTA uses between sections. */
function keyLine(ctx: SKRSContext2D, cx: number, y: number, width: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  const u = 9, step = u * 1.6;
  const n = Math.floor(width / step);
  const x0 = cx - (n * step) / 2;
  ctx.beginPath();
  ctx.moveTo(x0 - 18, y + u); ctx.lineTo(x0, y + u);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step;
    ctx.lineTo(x, y); ctx.lineTo(x + u, y); ctx.lineTo(x + u, y + u * 0.62); ctx.lineTo(x + u * 0.38, y + u * 0.62);
    ctx.lineTo(x + u * 0.38, y + u * 0.32); ctx.moveTo(x + u, y + u); ctx.lineTo(x + step, y + u);
  }
  ctx.lineTo(x0 + n * step + 18, y + u);
  ctx.stroke();
  ctx.restore();
}

/** A parchment pill with corner brackets, like HackUTA's buttons. */
function pillButton(ctx: SKRSContext2D, text: string, cx: number, cy: number) {
  ctx.font = `15px "Barlow SemiBold"`;
  const tw = [...text].reduce((a, ch) => a + ctx.measureText(ch).width + 2, 0);
  const w = tw + 64, h = 38, x = cx - w / 2, y = cy - h / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, PARCH); g.addColorStop(1, PARCH_2);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(26,58,82,0.45)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 15); ctx.lineTo(x + 16, y + 7); ctx.lineTo(x + 26, y + 7);
  ctx.moveTo(x + w - 16, y + h - 15); ctx.lineTo(x + w - 16, y + h - 7); ctx.lineTo(x + w - 26, y + h - 7);
  ctx.stroke();
  ctx.fillStyle = NAVY;
  tracked(ctx, text, cx, cy + 5.5, 2);
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
    const { ctx } = this;
    const st = this.state;
    const t = (Date.now() - this.t0) / 1000;
    ctx.save();
    ctx.scale(this.width / 960, this.height / 540);
    const w = 960, h = 540;

    // the world: parchment sky, cliffs, the sea
    if (backdrop) cover(ctx, backdrop, 0, 0, w, h, 0.5);
    else { ctx.fillStyle = PARCH; ctx.fillRect(0, 0, w, h); }

    // the episode, sketched faintly into the sky
    const sc = st.scene ? scenes.get(st.scene) : undefined;
    if (sc) {
      ctx.save();
      const mask = ctx.createRadialGradient(w / 2, 220, 60, w / 2, 220, 330);
      ctx.globalAlpha = 0.2;
      ctx.beginPath(); ctx.ellipse(w / 2, 225, 330, 190, 0, 0, Math.PI * 2); ctx.clip();
      cover(ctx, sc, w / 2 - 330, 35, 660, 380, 0.4);
      ctx.globalAlpha = 1;
      mask.addColorStop(0, "rgba(246,237,223,0)"); mask.addColorStop(1, "rgba(246,237,223,0.9)");
      ctx.fillStyle = mask; ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // the sea darkens under the subtitles
    const sea = ctx.createLinearGradient(0, 372, 0, h);
    sea.addColorStop(0, "rgba(7,26,42,0)"); sea.addColorStop(0.28, "rgba(7,26,42,0.72)"); sea.addColorStop(1, "rgba(7,26,42,0.96)");
    ctx.fillStyle = sea; ctx.fillRect(0, 372, w, h - 372);

    // masthead
    ctx.fillStyle = NAVY;
    ctx.font = `21px "Garamond"`;
    tracked(ctx, greek("The Odyssey Council"), w / 2, 40, 5);
    keyLine(ctx, w / 2, 53, 230, "rgba(26,58,82,0.5)");
    const topic = (st.topic ?? "Ask the Council anything").toUpperCase();
    const tf = fitText(ctx, topic, "Barlow Bold", 31, 20, w - 380, 1);
    ctx.fillStyle = DEEP;
    tracked(ctx, tf.lines[0] ?? "", w / 2, 95, 1.2);

    // the seats
    const idle = st.seats.length === 0;
    const seats = idle ? IDLE_COUNCIL : st.seats.slice(0, 6);
    const n = seats.length;
    const cw = Math.min(n <= 3 ? 132 : 118, (w - 150) / n - 22);
    const ch = cw * 1.28;
    const gap = n <= 3 ? 40 : 24;
    const rowW = n * cw + (n - 1) * gap;
    const top = 122;
    // draw the speaker last so its glow sits on top
    const order = seats.map((id, i) => ({ id, i })).sort((a, b) => Number(a.id === st.speaker) - Number(b.id === st.speaker));
    for (const { id, i } of order) {
      const x = (w - rowW) / 2 + i * (cw + gap);
      this.seat(id, x, top, cw, ch, st.speaker === id && st.phase === "speaking", idle, st.mouth, t);
    }

    // the sea: what is being said, or what to do
    const subY = 432;
    ctx.textAlign = "center";
    if (st.phase === "speaking" && st.speaker && st.line) {
      const m = byId.get(st.speaker);
      ctx.fillStyle = GOLD;
      ctx.font = `13px "Barlow SemiBold"`;
      tracked(ctx, `${(m?.name ?? st.speaker).toUpperCase()}  ·  ${(m?.title ?? "").toUpperCase()}`, w / 2, subY, 2.5);
      const f = fitText(ctx, st.line, "Barlow Medium", 26, 18, w - 170, 3);
      ctx.fillStyle = PARCH;
      f.lines.forEach((l, i) => ctx.fillText(l, w / 2, subY + 31 + i * f.size * 1.17));
    } else if (st.phase === "thinking" || st.phase === "hearing") {
      ctx.fillStyle = GOLD;
      ctx.font = `13px "Barlow SemiBold"`;
      const dots = ".".repeat(1 + (Math.floor(t * 2.5) % 3));
      tracked(ctx, st.phase === "hearing" ? `THE COUNCIL IS LISTENING${dots}` : `THE COUNCIL DELIBERATES${dots}`, w / 2, subY, 2.5);
      if (st.phase === "thinking" && st.heard) {
        const f = fitText(ctx, `“${st.heard}”`, "Garamond Italic", 25, 18, w - 200, 2);
        ctx.fillStyle = PARCH;
        f.lines.forEach((l, i) => ctx.fillText(l, w / 2, subY + 34 + i * f.size * 1.2));
      }
    } else {
      ctx.fillStyle = GOLD;
      ctx.font = `13px "Barlow SemiBold"`;
      tracked(ctx, st.phase === "waiting" ? "THE COUNCIL IS GATHERING" : "SPEAK, TRAVELLER", w / 2, subY, 2.5);
      const hints = [
        "WAS ODYSSEUS RIGHT TO BLIND THE CYCLOPS?",
        "WHY DID PENELOPE WAIT TWENTY YEARS?",
        "HOLD SOMETHING UP TO THE CAMERA",
        "WHO WAS TO BLAME FOR THE CREW?",
        "TELL ME ABOUT THE TROJAN HORSE",
      ];
      pillButton(ctx, hints[Math.floor(t / 5) % hints.length], w / 2, subY + 44);
    }

    if (st.saw && st.sawFrame && st.phase !== "listening") this.sawPanel(st.saw, st.sawFrame);
    this.status(w, t);
    ctx.restore();
  }

  private seat(id: string, x: number, y: number, w: number, h: number, speaking: boolean, idle: boolean, mouth: number, t: number) {
    const { ctx } = this;
    const m = byId.get(id);
    const p = portraits.get(id);
    const cx = x + w / 2, cy = y + h / 2;
    ctx.save();
    if (speaking) {
      const lift = 1.13;
      ctx.translate(cx, cy - 6); ctx.scale(lift, lift); ctx.translate(-cx, -cy);
      // the glow: warm light behind the frame, breathing with the voice
      const r = w * (1.05 + 0.08 * Math.sin(t * 2.4) + mouth * 0.12);
      const g = ctx.createRadialGradient(cx, cy, w * 0.3, cx, cy, r);
      g.addColorStop(0, "rgba(232,201,122,0.75)"); g.addColorStop(1, "rgba(232,201,122,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    // frame: a thin outer line and a solid inner one (the double rule of the HackUTA panels)
    ctx.lineWidth = 1;
    ctx.strokeStyle = speaking ? GOLD : "rgba(26,58,82,0.55)";
    arch(ctx, x - 6, y - 6, w + 12, h + 12); ctx.stroke();
    ctx.fillStyle = speaking ? GOLD : NAVY;
    arch(ctx, x - 2.5, y - 2.5, w + 5, h + 5); ctx.fill();
    ctx.save();
    arch(ctx, x, y, w, h); ctx.clip();
    ctx.fillStyle = PARCH_2; ctx.fillRect(x, y, w, h);
    if (p) {
      if (speaking) {
        cover(ctx, p.color, x, y, w, h, 0.25);
        if (p.speak && mouth > 0.08) { ctx.globalAlpha = Math.min(1, 0.35 + mouth); cover(ctx, p.speak, x, y, w, h, 0.25); ctx.globalAlpha = 1; }
      } else {
        ctx.globalAlpha = idle ? 0.95 : 0.8;
        cover(ctx, p.ink, x, y, w, h, 0.25);
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.fillStyle = NAVY; ctx.font = `${Math.round(w * 0.5)}px "Garamond"`; ctx.textAlign = "center";
      ctx.fillText(greek((m?.name ?? id)[0]), cx, y + h * 0.62);
    }
    ctx.restore();
    // name plate on a small parchment tag, so it reads over the dark cliffs too
    ctx.font = `${w < 110 ? 13 : 14.5}px "Barlow SemiBold"`;
    const plateW = Math.max(w + 6, [...(m?.title ?? "")].length * (w < 110 ? 6.6 : 7.2) + 16);
    ctx.fillStyle = speaking ? "rgba(246,237,223,0.96)" : "rgba(246,237,223,0.82)";
    ctx.beginPath(); ctx.roundRect(cx - plateW / 2, y + h + 9, plateW, 38, 3); ctx.fill();
    ctx.strokeStyle = speaking ? GOLD : "rgba(26,58,82,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = speaking ? DEEP : NAVY;
    ctx.font = `${w < 110 ? 13 : 14.5}px "${speaking ? "Barlow Bold" : "Barlow SemiBold"}"`;
    tracked(ctx, (m?.name ?? id).toUpperCase(), cx, y + h + 25, 1.6);
    ctx.fillStyle = STEEL;
    ctx.font = `${w < 110 ? 10.5 : 11.5}px "Barlow Medium"`;
    tracked(ctx, (m?.title ?? "").toUpperCase(), cx, y + h + 40, 0.8);
    ctx.restore();
  }

  /** Top left: the caller's camera frame the Council reacted to. */
  private sawPanel(text: string, img: Image) {
    const { ctx } = this;
    const tw = 150, th = Math.min(100, (tw * img.height) / img.width), x = 30, y = 26;
    ctx.save();
    ctx.shadowColor = "rgba(7,26,42,0.35)"; ctx.shadowBlur = 10;
    ctx.fillStyle = PARCH; ctx.fillRect(x - 5, y - 5, tw + 10, th + 10);
    ctx.restore();
    ctx.strokeStyle = NAVY; ctx.lineWidth = 1; ctx.strokeRect(x - 5, y - 5, tw + 10, th + 10);
    cover(ctx, img, x, y, tw, th, 0.5);
    ctx.fillStyle = NAVY;
    ctx.font = `10.5px "Barlow Bold"`;
    tracked(ctx, "THE COUNCIL SEES", x - 4, y + th + 22, 1.8, "left");
    ctx.fillStyle = STEEL;
    ctx.textAlign = "left";
    const f = fitText(ctx, text, "Barlow Medium", 13, 11, tw + 8, 2);
    f.lines.forEach((l, i) => ctx.fillText(l, x - 4, y + th + 38 + i * 14));
  }

  /** Top right: an outlined pill like HackUTA's navigation, with a live dot. */
  private status(w: number, t: number) {
    const { ctx, state: st } = this;
    const label = { waiting: "CONNECTING", listening: "LISTENING", hearing: "HEARING YOU", thinking: "DELIBERATING", speaking: "IN SESSION" }[st.phase];
    ctx.font = `11px "Barlow SemiBold"`;
    const tw = [...label].reduce((a, ch) => a + ctx.measureText(ch).width + 1.8, 0);
    const pw = tw + 44, ph = 26, x = w - pw - 28, y = 24;
    ctx.fillStyle = "rgba(246,237,223,0.7)";
    ctx.beginPath(); ctx.roundRect(x, y, pw, ph, ph / 2); ctx.fill();
    ctx.strokeStyle = NAVY; ctx.lineWidth = 1; ctx.stroke();
    const live = st.phase === "listening" || st.phase === "hearing";
    const r = live ? 3.5 + st.mic * 4 : st.phase === "thinking" ? 3.5 + 1.5 * Math.sin(t * 6) : 3.5;
    ctx.fillStyle = live ? "#3f8f6b" : st.phase === "speaking" ? "#c79a3c" : NAVY;
    ctx.beginPath(); ctx.arc(x + 16, y + ph / 2, Math.max(2.5, r), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = NAVY;
    tracked(ctx, label, x + 28, y + 17.5, 1.8, "left");
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
