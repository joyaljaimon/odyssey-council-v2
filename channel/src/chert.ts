// Chert's managed FaceTime line -> our agent. Follows https://app.trychert.com/skills.md and `chert guide agent`.
//
// Two ways to receive calls, picked like Chert's own examples (examples/video-agent/chert-rooms.mjs):
//  - LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET set: register with that LiveKit project as a LiveKit agent named
//    AGENT_NAME; `chert dev` dispatches it into each call's room.
//  - none of them set (Shared plan, Chert rooms): poll `chert dev` through ~/.chert/rooms/<AGENT_NAME>.json; it hands
//    us each call's room and a token for that room only.
// Each call runs an AgentBridge: caller audio -> Brain /voice -> agent audio, plus the stage page as video.
//
// Run (from channel/, with Brain and Stage running):
//   terminal 1: npm run chert          (this agent; keep it running)
//   terminal 2: npx @trychert/facetime@0.1.0-beta.21 dev   (in channel/, reads AGENT_NAME and LIVEKIT_* from .env.local)
// Then FaceTime the line (FaceTime Video to see the stage).
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import { AutoSubscribe, ServerOptions, cli, defineAgent, type JobContext } from "@livekit/agents";
import { Room } from "@livekit/rtc-node";
import { AgentBridge, isChertBridge } from "./agent-bridge.ts";

export const AGENT_NAME = process.env.AGENT_NAME || "odyssey-council";
const VIDEO = process.env.CHERT_VIDEO !== "0"; // CHERT_VIDEO=0: audio only (stage link fallback)
const KEYS = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] as const;
const usesOwnLiveKit = () => KEYS.every((k) => !!process.env[k] && !/^(wss:\/\/)?YOUR_/.test(process.env[k]!));

const sessionFor = (callId: string) => `facetime-${callId}`;

async function runCall(room: Room, callId: string) {
  const bridge = new AgentBridge(room, sessionFor(callId), { video: VIDEO, readyOn: "bridge_ready", isCaller: isChertBridge });
  await bridge.start();
  console.log(`[chert] call ${callId}: in room; stage at ${process.env.PUBLIC_BASE_URL || process.env.STAGE_URL || "http://localhost:3000"}/stage?sessionId=${sessionFor(callId)}`);
  return bridge;
}

// ---------------------------------------------------------------- own LiveKit project: a LiveKit agent worker

export default defineAgent({
  entry: async (ctx: JobContext) => {
    // Join at once (Chert prepares the room before the caller exists); the bridge waits for bridge_ready to talk.
    await ctx.connect(undefined, AutoSubscribe.AUDIO_ONLY);
    const bridge = await runCall(ctx.room, ctx.job.id);
    ctx.addShutdownCallback(async () => { await bridge.close("job shutdown"); });
    await bridge.ended;
  },
});

// ---------------------------------------------------------------- Chert rooms: poll chert dev

const linkFile = () => join(process.env.CHERT_HOME || join(homedir(), ".chert"), "rooms", `${AGENT_NAME}.json`);
type Link = { url: string; token: string };
type Job = { type: "join" | "end"; call_id: string; livekit_url?: string; token?: string; room?: string };
const calls = new Map<string, { room: Room; bridge?: AgentBridge }>();

async function report(link: Link, what: "joined" | "failed", callId: string) {
  try {
    const res = await fetch(`${link.url}/v1/${what}`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
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
    const reason = await bridge.ended;
    console.log(`[chert] call ${job.call_id} over: ${reason}`);
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
      if (!waiting) console.log(`[chert] Waiting for chert dev (run it in channel/). Looking for ${linkFile()}`);
      waiting = true;
      await pause(1000);
      continue;
    }
    let res: Response;
    try {
      res = await fetch(`${link.url}/v1/next`, { headers: { authorization: `Bearer ${link.token}` }, signal: AbortSignal.timeout(30_000) });
    } catch {
      await pause(1000);
      continue;
    }
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
  if (usesOwnLiveKit()) {
    console.log(`[chert] Registering LiveKit agent "${AGENT_NAME}" with ${process.env.LIVEKIT_URL}`);
    cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: AGENT_NAME }));
  } else {
    void serveChertRooms();
  }
}
