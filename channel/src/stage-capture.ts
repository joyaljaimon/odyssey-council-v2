// Opens the stage in headless Chromium at 1280x720 and turns it into video frames for the agent's FaceTime video.
// First run: npx playwright install chromium
// How: Chrome DevTools Page.startScreencast sends a JPEG whenever the page repaints; we decode each one to RGBA and
// keep the latest. The FaceTime bridge (facetime.ts) samples that latest frame at a fixed frame rate.
import { Worker } from "node:worker_threads";
import { chromium } from "playwright";

const STAGE_URL = process.env.STAGE_URL ?? "http://localhost:3000";
// The stage is rendered at 0.75 scale (portrait 720x1280 -> 540x960 frames; landscape 1280x720 -> 960x540): about
// half the pixels to paint, decode and send, at the same apparent size on a phone.
// STAGE_ORIENTATION=portrait (default: fills an upright phone in FaceTime) or landscape.
export const ORIENTATION = process.env.STAGE_ORIENTATION === "landscape" ? "landscape" : "portrait";
const [LAYOUT_WIDTH, LAYOUT_HEIGHT] = ORIENTATION === "portrait" ? [720, 1280] : [1280, 720];
const SCALE = Number(process.env.STAGE_SCALE ?? 0.75);
export const VIDEO_WIDTH = Math.round(LAYOUT_WIDTH * SCALE);
export const VIDEO_HEIGHT = Math.round(LAYOUT_HEIGHT * SCALE);

export const stageUrl = (sessionId: string, base = STAGE_URL, capture = false) =>
  `${base}/stage?sessionId=${encodeURIComponent(sessionId)}${capture ? `&capture=1&orient=${ORIENTATION}` : ""}`;

export type RgbaFrame = { data: Uint8Array; width: number; height: number };

export async function startStageCapture(sessionId: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: LAYOUT_WIDTH, height: LAYOUT_HEIGHT }, deviceScaleFactor: SCALE });
  await page.goto(stageUrl(sessionId, STAGE_URL, true), { waitUntil: "networkidle" }).catch(() => {});
  return {
    page,
    screenshot: () => page.screenshot({ type: "png" }), // also useful for iMessage stills
    stop: () => browser.close(),
  };
}

// JPEG decoding runs in worker threads so it never blocks the call's audio loop. jpeg-js is pure JavaScript (about
// 100 ms per 960x540 frame), so a small pool decodes frames in parallel; sequence numbers keep only the newest result.
const DECODER = `
const { parentPort } = require("node:worker_threads");
const jpeg = require(${JSON.stringify(new URL("../../node_modules/jpeg-js/index.js", import.meta.url).pathname)});
parentPort.on("message", ({ seq, buf }) => {
  try {
    const img = jpeg.decode(Buffer.from(buf), { useTArray: true, formatAsRGBA: true });
    parentPort.postMessage({ seq, data: img.data, width: img.width, height: img.height }, [img.data.buffer]);
  } catch (err) { parentPort.postMessage({ seq, error: String(err) }); }
});`;
const DECODERS = Number(process.env.STAGE_DECODERS ?? 2);

/**
 * Streams the stage as RGBA frames. `latest()` returns the most recent decoded frame (null until the first paint).
 * Frames are decoded at most `maxFps` times a second; frames that arrive while all decoders are busy are skipped.
 */
export async function startStageVideo(sessionId: string, opts: { quality?: number; maxFps?: number } = {}) {
  const cap = await startStageCapture(sessionId);
  const cdp = await cap.page.context().newCDPSession(cap.page);
  const pool = Array.from({ length: DECODERS }, () => ({ worker: new Worker(DECODER, { eval: true }), busy: false }));
  let latest: RgbaFrame | null = null;
  let latestSeq = 0;
  let seq = 0;
  let pendingJpeg: Buffer | null = null;
  let frames = 0;
  let raw = 0;
  let lastDispatch = 0;
  let timer: NodeJS.Timeout | null = null;
  const minGap = 1000 / (opts.maxFps ?? Number(process.env.STAGE_FPS ?? 20));

  const dispatch = () => {
    timer = null;
    if (!pendingJpeg) return;
    const wait = lastDispatch + minGap - Date.now();
    if (wait > 0) { timer = setTimeout(dispatch, wait); return; }
    const slot = pool.find((w) => !w.busy);
    if (!slot) return; // retried when a decoder frees up
    slot.busy = true;
    lastDispatch = Date.now();
    slot.worker.postMessage({ seq: ++seq, buf: pendingJpeg });
    pendingJpeg = null;
  };
  for (const slot of pool) {
    slot.worker.on("message", (m: RgbaFrame & { seq: number; error?: string }) => {
      slot.busy = false;
      if (m.error) console.warn("[capture] bad frame", m.error);
      else if (m.seq > latestSeq) { latestSeq = m.seq; latest = { data: new Uint8Array(m.data), width: m.width, height: m.height }; frames++; }
      if (!timer) dispatch();
    });
  }

  cdp.on("Page.screencastFrame", async ({ data, sessionId: ack }) => {
    raw++;
    pendingJpeg = Buffer.from(data, "base64"); // newer frames replace undecoded older ones
    if (!timer) dispatch();
    await cdp.send("Page.screencastFrameAck", { sessionId: ack }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: opts.quality ?? 80, maxWidth: VIDEO_WIDTH, maxHeight: VIDEO_HEIGHT, everyNthFrame: 1 });
  // A static page stops producing screencast frames; a 1px nudge every second keeps at least one fresh frame coming.
  await cap.page.addStyleTag({ content: "body::after{content:'';position:fixed;right:0;bottom:0;width:1px;height:1px;animation:cdpTick 1s steps(2) infinite}@keyframes cdpTick{50%{opacity:.01}}" });
  return {
    page: cap.page,
    latest: () => latest,
    frameCount: () => frames,
    rawFrameCount: () => raw,
    stop: async () => {
      await cdp.send("Page.stopScreencast").catch(() => {});
      if (timer) clearTimeout(timer);
      await Promise.all(pool.map((w) => w.worker.terminate()));
      await cap.stop();
    },
  };
}

// Manual test: npm run capture -w channel  (writes stage-test.png and reports the screencast frame rate)
if (import.meta.url === `file://${process.argv[1]}`) {
  const video = await startStageVideo("demo");
  await new Promise((r) => setTimeout(r, 3000));
  const { writeFileSync } = await import("node:fs");
  writeFileSync("stage-test.png", await video.page.screenshot({ type: "png" }));
  const f = video.latest();
  console.log(`wrote stage-test.png; decoded ${video.frameCount()} frames in 3 s, latest ${f ? `${f.width}x${f.height}` : "none"}`);
  await video.stop();
}
