// One painted image from Meta Muse Image (MODEL_API_KEY), in the house style, saved as a small JPEG.
import { execFile } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const API = process.env.MUSE_API_URL ?? "https://api.meta.ai/v1";
const MODEL = process.env.MUSE_MODEL ?? "muse-image-1.0";
export const PAINT_KEY = process.env.MODEL_API_KEY ?? "";
const STYLE = "Classical oil painting in the style of an 18th-century European academic history painting: dramatic chiaroscuro, warm candlelit golds and deep shadows, visible brushwork, museum quality.";
const FRAME = "One clear subject in the centre of a square composition, with soft dark edges. No text, no letters, no watermark, no signature, no frame, no modern objects.";
const run = promisify(execFile);

export async function paintVision(subject: string, dest: string, signal?: AbortSignal): Promise<void> {
  let softened = false;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/images/generations`, {
      method: "POST",
      headers: { authorization: `Bearer ${PAINT_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, n: 1, response_format: "b64_json", output_format: "jpeg", size: "1024x1024", prompt: `${subject}, from Homer's Odyssey. ${FRAME}\n\nStyle: ${STYLE}` }),
      signal,
    });
    if (res.ok) {
      const b64 = ((await res.json()) as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
      if (!b64) throw new Error("no image in response");
      const tmp = `${dest}.tmp.jpg`;
      await writeFile(tmp, Buffer.from(b64, "base64"));
      try { await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", "640", tmp, "--out", dest]); }
      finally { await rm(tmp, { force: true }); }
      return;
    }
    const text = await res.text();
    if (res.status === 400 && /content_policy/.test(text) && !softened) { softened = true; subject = `A calm, symbolic, non-violent scene that only hints at this: ${subject}`; continue; }
    if ((res.status === 429 || res.status >= 500) && attempt < 4 && !signal?.aborted) { await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt)); continue; }
    throw new Error(`${res.status}: ${text.slice(0, 240)}`);
  }
}
