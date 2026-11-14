// Records the stage at 1280x720 while Brain plays the scripted demo (POST /debug/demo).
// Needs Brain and Stage running. Output: demo/backup-stage.webm (video only; narrate over it or play beside it).
// Run: node demo/record-backup.mjs [stageUrl] [brainUrl]
import { renameSync } from "node:fs";
import { chromium } from "playwright";

const STAGE = process.argv[2] ?? process.env.STAGE_URL ?? "http://localhost:3000";
const BRAIN = process.argv[3] ?? process.env.BRAIN_URL ?? "http://localhost:8080";
const dir = new URL(".", import.meta.url).pathname;
const sessionId = `backup-${Date.now()}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } } });
const page = await context.newPage();
await page.goto(`${STAGE}/stage?sessionId=${sessionId}`);
await page.waitForTimeout(2500);
await fetch(`${BRAIN}/debug/demo?sessionId=${sessionId}`, { method: "POST" });
await page.waitForTimeout(52_000);
const video = page.video();
await context.close();
renameSync(await video.path(), `${dir}backup-stage.webm`);
await browser.close();
console.log("wrote demo/backup-stage.webm");
