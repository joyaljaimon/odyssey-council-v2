// The Council's picture library: painted images (data/visions.json -> assets/visions/<id>.jpg) that float onto the
// stage while a line about them is being spoken. Choosing is local and instant: the model suggests a few ids for the
// answer (SHOW:), and each line gets the best one whose keywords it actually mentions, so the picture arrives with
// the words. Nothing comes back soon after it was shown, and lines without a fitting picture get none.
// When the model asks for something the library lacks (NEW:), it is painted in the background (about 20 s); if the
// answer is still going it appears straight away, and either way it joins the library for the rest of the call.
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PAINT_KEY, paintVision } from "./painter.ts";

export type Vision = { id: string; subject: string; keywords: string[]; file: string; fresh?: boolean };

const dir = fileURLToPath(new URL("../assets/visions/", import.meta.url));
const freshDir = `${dir}fresh/`;
const FRESH = process.env.FRESH_VISIONS !== "0" && !!PAINT_KEY;
const RECENT = 10; // a picture can't come back until this many others have been shown
const MAX_PER_TURN = 3;
const STOP = new Set("the a an of and with on in by to from at for its his her their a an some two one into over under beside".split(" "));

const catalog: Vision[] = (JSON.parse(readFileSync(new URL("../data/visions.json", import.meta.url), "utf8")) as Omit<Vision, "file">[])
  .map((v) => ({ ...v, file: `${dir}${v.id}.jpg` }))
  .filter((v) => existsSync(v.file));
// pictures painted on earlier calls
if (existsSync(freshDir)) {
  for (const f of readdirSync(freshDir)) {
    if (!f.endsWith(".jpg")) continue;
    const subject = f.replace(/\.jpg$/, "").replace(/-/g, " ");
    catalog.push({ id: `fresh-${f.replace(/\.jpg$/, "")}`, subject, keywords: words(subject), file: `${freshDir}${f}`, fresh: true });
  }
}
export const VISIONS = catalog;
export const VISION_IDS = () => catalog.filter((v) => !v.fresh).map((v) => v.id);
const byId = new Map(catalog.map((v) => [v.id, v]));

function words(s: string) { return s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w)); }
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hit = (text: string, kw: string) => new RegExp(`\\b${escape(kw)}`, "i").test(text);

/** One per call: remembers what this caller has already seen. */
export class VisionPicker {
  private recent: string[] = [];
  private hints: string[] = [];
  private shownThisTurn = 0;
  private turnNo = 0;
  private painting = false;

  /** A new answer begins; `hints` are the ids the model suggested (SHOW:). */
  beginTurn() { this.turnNo++; this.hints = []; this.shownThisTurn = 0; }
  suggest(ids: string[]) { this.hints = ids.filter((id) => byId.has(id)); }

  /** The picture for a line that is starting to play, or null. */
  forLine(text: string): Vision | null {
    if (this.shownThisTurn >= MAX_PER_TURN) return null;
    let best: Vision | null = null, bestScore = 0;
    for (const v of byId.values()) {
      if (this.recent.includes(v.id)) continue;
      const hint = this.hints.indexOf(v.id);
      let s = 0;
      for (const kw of v.keywords) if (hit(text, kw)) s += kw.includes(" ") ? 14 : 8;
      if (hint >= 0) s += s > 0 ? 30 : 12 - hint * 3; // the model's picks win, more so when the line names them
      if (v.fresh && s > 0) s += 4; // something new beats something seen before
      if (hint < 0 && s < 14) continue; // unsuggested pictures need a strong match: a phrase, or two words
      if (s > bestScore) { best = v; bestScore = s; }
    }
    if (!best || bestScore < 8) return null;
    this.mark(best.id);
    return best;
  }

  private mark(id: string) {
    this.shownThisTurn++;
    this.hints = this.hints.filter((h) => h !== id);
    this.recent.push(id);
    if (this.recent.length > RECENT) this.recent.shift();
  }

  /**
   * Paint something the library doesn't have. `show` is called with the new picture if it is ready while the same
   * answer is still going (the caller sees something no one has seen before).
   */
  paintNew(subject: string, stillSpeaking: () => boolean, show: (v: Vision) => void) {
    if (!FRESH || this.painting) return;
    const slug = words(subject).slice(0, 6).join("-");
    if (!slug) return;
    const id = `fresh-${slug}`;
    const known = byId.get(id);
    if (known) { if (!this.recent.includes(id) && stillSpeaking()) { this.mark(id); show(known); } return; }
    this.painting = true;
    const turn = this.turnNo;
    const file = `${freshDir}${slug}.jpg`;
    const t0 = Date.now();
    mkdirSync(freshDir, { recursive: true });
    paintVision(subject, file, AbortSignal.timeout(60_000))
      .then(() => {
        const v: Vision = { id, subject, keywords: words(subject), file, fresh: true };
        catalog.push(v);
        byId.set(id, v);
        console.log(`[visions] painted "${subject}" in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        if (turn === this.turnNo && stillSpeaking() && this.shownThisTurn < MAX_PER_TURN + 1) { this.mark(id); show(v); }
      })
      .catch((err) => console.warn(`[visions] could not paint "${subject}": ${(err as Error).message.slice(0, 120)}`))
      .finally(() => { this.painting = false; });
  }
}
