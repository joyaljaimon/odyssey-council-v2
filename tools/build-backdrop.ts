// Paints the stage backdrop in the style of the HackUTA 2026 Odyssey theme: navy ink silhouettes on parchment,
// a dithered sky, cliffs with olive trees framing an empty centre, and a dark sea along the bottom (where the
// subtitles go). Writes assets/backdrop/<n>.jpg; pick one and save it as assets/backdrop.jpg.
// Run: npm run backdrop [-- count]     (Meta Muse Image, MODEL_API_KEY, about $0.01 an image)
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const KEY = process.env.MODEL_API_KEY;
const API = process.env.MUSE_API_URL ?? "https://api.meta.ai/v1";
const dir = fileURLToPath(new URL("../assets/backdrop/", import.meta.url));
const PROMPT = `A wide, minimal illustration in only two colours: deep navy blue ink (#1a3a52) on warm parchment cream (#efe4d2).
The upper two thirds is a pale parchment sky with soft swirling clouds drawn as a fine pixel dither pattern of small navy squares.
On the far left and far right edges, dark navy rocky cliffs with gnarled olive trees in silhouette frame the picture.
The bottom quarter is a calm sea of layered navy waves that darkens to almost black at the bottom edge.
A tiny ancient Greek galley with a square sail sits far away on the horizon, centred.
The centre of the image is empty open sky. Flat, elegant, screen-printed poster style. No text, no letters, no people, no border.`;

if (!KEY) { console.error("Set MODEL_API_KEY in .env"); process.exit(2); }
mkdirSync(dir, { recursive: true });
const n = Number(process.argv[2] ?? 2);
await Promise.all(Array.from({ length: n }, async (_, i) => {
  const res = await fetch(`${API}/images/generations`, {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.MUSE_MODEL ?? "muse-image-1.0", n: 1, response_format: "b64_json", output_format: "jpeg", prompt: PROMPT, size: "1792x1008" }),
  });
  if (!res.ok) { console.error(`[backdrop] ${i + 1} failed: ${res.status} ${(await res.text()).slice(0, 200)}`); return; }
  const b64 = ((await res.json()) as { data: { b64_json: string }[] }).data[0].b64_json;
  const tmp = `${dir}${i + 1}.tmp.jpg`;
  writeFileSync(tmp, Buffer.from(b64, "base64"));
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "84", "-Z", "1280", tmp, "--out", `${dir}${i + 1}.jpg`], { stdio: "ignore" });
  rmSync(tmp);
  console.log(`[backdrop] ${dir}${i + 1}.jpg`);
}));
