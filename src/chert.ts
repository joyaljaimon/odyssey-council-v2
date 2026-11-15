// Takes FaceTime calls from the Chert line. Run it, then `chert dev` in a second terminal (see README).
// Follows https://app.trychert.com/skills.md and `chert guide agent`. Two ways to receive calls, like Chert's examples:
//  - LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET set: register with that LiveKit project as the agent AGENT_NAME;
//    `chert dev` dispatches it into each call's room.
//  - none set (Shared plan, Chert rooms): poll `chert dev` through ~/.chert/rooms/<AGENT_NAME>.json, which hands us
//    each call's room and a token.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import { AutoSubscribe, ServerOptions, cli, defineAgent, type JobContext } from "@livekit/agents";
import { Room } from "@livekit/rtc-node";
import { Bridge } from "./bridge.ts";
import { KEYS } from "./gemini.ts";
import { warmVoices } from "./council.ts";

export const AGENT_NAME = process.env.AGENT_NAME || "odyssey-council";
const LK = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] as const;
const ownLiveKit = () => LK.every((k) => !!process.env[k] && !/^(wss:\/\/)?YOUR_/.test(process.env[k]!));

async function runCall(room: Room, callId: string) {
  const bridge = new Bridge(room, `call-${callId}`);
  await bridge.start();
  return bridge;
}

// ---------------------------------------------------------------- own LiveKit project: a LiveKit agent worker

export default defineAgent({
  entry: async (ctx: JobContext) => {
    // Join at once (Chert prepares the room before the caller exists); the bridge greets on bridge_ready.
    await ctx.connect(undefined, AutoSubscribe.SUBSCRIBE_NONE);
    const bridge = await runCall(ctx.room, ctx.job.id);
    ctx.addShutdownCallback(async () => { await bridge.close("job shutdown"); });
    await bridge.ended;
  },
});

// ---------------------------------------------------------------- Chert rooms: poll chert dev

const linkFile = () => join(process.env.CHERT_HOME || join(homedir(), ".chert"), "rooms", `${AGENT_NAME}.json`);
type Link = { url: string; token: string };
type Job = { type: "join" | "end"; call_id: string; livekit_url?: string; token?: string };
const calls = new Map<string, { room: Room; bridge?: Bridge }>();

async function report(link: Link, what: "joined" | "failed", callId: string) {
  try {
    const res = await fetch(`${link.url}/v1/${what}`, {
      method: "POST", signal: AbortSignal.timeout(5000),
      headers: { authorization: `Bearer ${link.token}`, "content-type": "application/json" },
      body: JSON.stringify({ call_id: callId }),
    });
    await res.body?.cancel();
  } catch { /* chert dev declines on its own deadline */ }
}

async function joinChertRoom(job: Job, link: Link) {
  if (calls.has(job.call_id)) return;
  const room = new Room();
  calls.set(job.call_id, { room });
  try {
    await room.connect(job.livekit_url!, job.token!, { autoSubscribe: false, dynacast: false });
  } catch (err) {
    console.error(`[chert] could not join call ${job.call_id}:`, (err as Error).message);
    calls.delete(job.call_id);
    await report(link, "failed", job.call_id);
    return;
  }
  await report(link, "joined", job.call_id);
  try {
    const bridge = await runCall(room, job.call_id);
    calls.get(job.call_id)!.bridge = bridge;
    console.log(`[chert] call ${job.call_id} over: ${await bridge.ended}`);
  } catch (err) {
    console.error(`[chert] call ${job.call_id} failed:`, err);
  } finally {
    calls.delete(job.call_id);
    await room.disconnect().catch(() => {});
  }
}

async function serveChertRooms() {
  console.log(`[chert] No LiveKit keys: "${AGENT_NAME}" takes calls in Chert rooms through chert dev.`);
  let waiting = false;
  for (;;) {
    let link: Link;
    try {
      link = JSON.parse(await readFile(linkFile(), "utf8")) as Link;
    } catch {
      if (!waiting) console.log(`[chert] Waiting for chert dev (run it in this folder). Looking for ${linkFile()}`);
      waiting = true;
      await pause(1000);
      continue;
    }
    let res: Response;
    try {
      res = await fetch(`${link.url}/v1/next`, { headers: { authorization: `Bearer ${link.token}` }, signal: AbortSignal.timeout(30_000) });
    } catch { await pause(1000); continue; }
    if (res.status === 204) continue;
    if (!res.ok) { await res.body?.cancel(); await pause(1000); continue; }
    if (waiting) console.log("[chert] Connected to chert dev. FaceTime your line.");
    waiting = false;
    const job = (await res.json().catch(() => undefined)) as Job | undefined;
    if (job?.type === "join") void joinChertRoom(job, link);
    else if (job?.type === "end") void calls.get(job.call_id)?.bridge?.close("call ended");
  }
}

// ---------------------------------------------------------------- main

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!KEYS.length) console.warn("[chert] No GEMINI_API_KEY: the Council will speak only its fallback line.");
  await warmVoices();
  if (ownLiveKit()) {
    console.log(`[chert] Registering LiveKit agent "${AGENT_NAME}" with ${process.env.LIVEKIT_URL}`);
    cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: AGENT_NAME }));
  } else {
    void serveChertRooms();
  }
}
