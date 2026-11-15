// Paints the Council's image library (data/visions.json) in the same classical-oil style as the portraits:
//   assets/visions/<id>.jpg
// The stage brings these in as the lines that mention them are spoken. Also used at run time to paint a brand-new
// image when the Council asks for something the library doesn't have (src/visions.ts).
// Uses Meta Muse Image (MODEL_API_KEY, about $0.01 an image). Resumable: existing files are skipped.
// Run: npm run visions [-- id ...]
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { paintVision } from "../src/painter.ts";

const dir = fileURLToPath(new URL("../assets/visions/", import.meta.url));
const catalog = JSON.parse(readFileSync(new URL("../data/visions.json", import.meta.url), "utf8")) as { id: string; subject: string }[];
if (!process.env.MODEL_API_KEY) { console.error("Set MODEL_API_KEY in .env"); process.exit(2); }
const wanted = process.argv.slice(2);
const todo = catalog.filter((v) => (!wanted.length || wanted.includes(v.id)) && !existsSync(`${dir}${v.id}.jpg`));
console.log(`[visions] painting ${todo.length}`);
let failed = 0, next = 0;
const worker = async () => {
  while (next < todo.length) {
    const v = todo[next++];
    const t0 = Date.now();
    try { await paintVision(v.subject, `${dir}${v.id}.jpg`); console.log(`[visions] ${v.id} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); }
    catch (err) { failed++; console.error(`[visions] ${v.id} FAILED: ${String((err as Error).message).slice(0, 200)}`); }
  }
};
await Promise.all(Array.from({ length: Number(process.env.VISION_JOBS ?? 6) }, worker));
console.log(`[visions] done, ${failed} failed`);
