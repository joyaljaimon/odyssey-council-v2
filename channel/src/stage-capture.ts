// Opens the stage page in headless Chromium at 1280x720 so it can be sent as the agent's FaceTime video.
// First run: npx playwright install chromium
// TODO(channel): once you know how Chert accepts video (WebRTC track, frames, virtual camera),
// pipe the page into it. Options: page.screencast / CDP Page.startScreencast frames, or
// canvas.captureStream() inside the page + WebRTC.
import { chromium } from "playwright";

const STAGE_URL = process.env.STAGE_URL ?? "http://localhost:3000";

export async function startStageCapture(sessionId: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${STAGE_URL}/stage?sessionId=${encodeURIComponent(sessionId)}`);
  return {
    page,
    screenshot: () => page.screenshot({ type: "png" }), // also useful for iMessage stills
    stop: () => browser.close(),
  };
}

// Manual test: npm run capture -w channel
if (import.meta.url === `file://${process.argv[1]}`) {
  const cap = await startStageCapture("demo");
  await new Promise((r) => setTimeout(r, 2000));
  const { writeFileSync } = await import("node:fs");
  writeFileSync("stage-test.png", await cap.screenshot());
  console.log("wrote stage-test.png");
  await cap.stop();
}
