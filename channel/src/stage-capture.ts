// Opens the stage in headless Chromium at 1280x720 and turns it into video frames for the agent's FaceTime video.
// First run: npx playwright install chromium
// How: Chrome DevTools Page.startScreencast sends a JPEG whenever the page repaints; we decode each one to RGBA and
// keep the latest. The FaceTime bridge (facetime.ts) samples that latest frame at a fixed frame rate.
import { chromium, type Page } from "playwright";
import jpeg from "jpeg-js";

const STAGE_URL = process.env.STAGE_URL ?? "http://localhost:3000";
export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;

export const stageUrl = (sessionId: string, base = STAGE_URL) => `${base}/stage?sessionId=${encodeURIComponent(sessionId)}`;

export type RgbaFrame = { data: Uint8Array; width: number; height: number };

export async function startStageCapture(sessionId: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
  await page.goto(stageUrl(sessionId));
  return {
    page,
    screenshot: () => page.screenshot({ type: "png" }), // also useful for iMessage stills
    stop: () => browser.close(),
  };
}

/** Streams the stage as RGBA frames. `latest()` returns the most recent frame (null until the first paint). */
export async function startStageVideo(sessionId: string, opts: { quality?: number } = {}) {
  const cap = await startStageCapture(sessionId);
  const cdp = await cap.page.context().newCDPSession(cap.page);
  let latest: RgbaFrame | null = null;
  let frames = 0;
  cdp.on("Page.screencastFrame", async ({ data, sessionId: ack }) => {
    try {
      const img = jpeg.decode(Buffer.from(data, "base64"), { useTArray: true, formatAsRGBA: true });
      latest = { data: img.data, width: img.width, height: img.height };
      frames++;
    } catch (err) {
      console.warn("[capture] bad frame", (err as Error).message);
    }
    await cdp.send("Page.screencastFrameAck", { sessionId: ack }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: opts.quality ?? 80, maxWidth: VIDEO_WIDTH, maxHeight: VIDEO_HEIGHT, everyNthFrame: 1 });
  // A static page stops producing screencast frames; a 1px nudge every second keeps at least one fresh frame coming.
  await cap.page.addStyleTag({ content: "body::after{content:'';position:fixed;right:0;bottom:0;width:1px;height:1px;animation:cdpTick 1s steps(2) infinite}@keyframes cdpTick{50%{opacity:.01}}" });
  return {
    page: cap.page,
    latest: () => latest,
    frameCount: () => frames,
    stop: async () => {
      await cdp.send("Page.stopScreencast").catch(() => {});
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
  console.log(`wrote stage-test.png; screencast ${video.frameCount()} frames in 3 s, latest ${f ? `${f.width}x${f.height}` : "none"}`);
  await video.stop();
}
