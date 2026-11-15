// Place an outbound GROUP FaceTime from the Council: everyone listed is rung into one call with the Council.
// Chert Calls API (https://docs.trychert.com/facetime/group-calls): we prepare the LiveKit room with the Council already
// in it (voice + video published, silent), mint a token for Chert's bridge, ask Chert to dial, and greet on bridge_ready.
// All callers arrive mixed in one audio track; the Council tells the voices apart itself (see script.ts).
//
// Run: npm run group-call -- +15551230001 +15551230002 [--audio-only]
// Needs in .env: CHERT_API_KEY (project key with facetime:write and facetime:read), CHERT_PROJECT_ID, LIVEKIT_URL/KEY/SECRET.
// Every number must be phone-verified for the project, and group calling enabled on the line (ask Chert).
// Runs in its own process, separate from `npm start`: the inbound agent keeps answering the line between calls.
import { randomUUID } from "node:crypto";
import { Room, dispose } from "@livekit/rtc-node";
import { AccessToken } from "livekit-server-sdk";
import { Bridge, isChertCaller } from "./bridge.ts";
import { warmVoices } from "./council.ts";

const API = process.env.CHERT_FACETIME_API ?? "https://facetime.trychert.com/api";
const KEY = process.env.CHERT_API_KEY, PROJECT = process.env.CHERT_PROJECT_ID;
const LK = { url: process.env.LIVEKIT_URL, key: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET };

const args = process.argv.slice(2);
const numbers = args.filter((a) => a.startsWith("+"));
const video = !args.includes("--audio-only");
if (!KEY || !PROJECT) { console.error("Set CHERT_API_KEY and CHERT_PROJECT_ID in .env (Chert console > Developer)."); process.exit(2); }
if (!LK.url || !LK.key || !LK.secret) { console.error("Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in .env."); process.exit(2); }
if (!numbers.length) { console.error("Usage: npm run group-call -- +15551230001 +15551230002"); process.exit(2); }

async function chert(method: string, path: string, body?: unknown, idem?: string) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${KEY}`, "x-chert-project-id": PROJECT!, "content-type": "application/json", ...(idem ? { "idempotency-key": idem } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json: any = text;
  try { json = JSON.parse(text); } catch { /* keep text */ }
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${typeof json === "string" ? json.slice(0, 300) : JSON.stringify(json).slice(0, 400)}`);
  return json;
}

async function lineId(): Promise<string> {
  if (process.env.CHERT_LINE_ID) return process.env.CHERT_LINE_ID;
  const r = await chert("GET", "/v1/lines");
  const lines = (r.data ?? r.lines ?? r) as { id: string; name?: string; display_name?: string; phone_number?: string }[];
  if (!Array.isArray(lines) || !lines.length) throw new Error(`no lines in ${JSON.stringify(r).slice(0, 300)}`);
  const l = lines[0];
  console.log(`[group] line ${l.display_name ?? l.name ?? ""} ${l.phone_number ?? ""} (${l.id})${lines.length > 1 ? `; ${lines.length} lines, set CHERT_LINE_ID to pick` : ""}`);
  return l.id;
}

const token = async (room: string, identity: string, ttl: string) => {
  const at = new AccessToken(LK.key, LK.secret, { identity, ttl });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });
  return at.toJwt();
};

await warmVoices();
const line = await lineId();
const stamp = Date.now().toString(36);
const roomName = `council-group-${stamp}`;
const AGENT_ID = "council-agent";
const BRIDGE_ID = `chert-bridge-${stamp}`;

// 1. The Council joins the room first, with its voice and video published (silent until bridge_ready).
const room = new Room();
await room.connect(LK.url, await token(roomName, AGENT_ID, "2h"), { autoSubscribe: false, dynacast: false });
const bridge = new Bridge(room, `group-${stamp}`, isChertCaller);
await bridge.start();

// 2. Ask Chert to dial everyone into this room.
const recipients = numbers.map((value) => ({ type: "phone_number", value }));
const target = numbers.length > 1 ? { recipients } : { destination: numbers[0], destination_type: "phone" };
const create = await chert("POST", "/v1/calls", {
  direction: "outbound", mode: "customer_managed", line_id: line, ...target,
  media: { audio: true, video },
  livekit_url: LK.url, participant_token: await token(roomName, BRIDGE_ID, "1h"), remote_participant_identity: AGENT_ID,
}, `council-${randomUUID()}`);
const callId: string = create.data?.id ?? create.id;
console.log(`[group] call ${callId} allocated for ${numbers.join(", ")} (${video ? "video" : "audio"}); ringing…`);

// 3. Watch the call: greet on bridge_ready, stop when it ends.
let ended = false;
const stop = async (why: string) => {
  if (ended) return;
  ended = true;
  console.log(`[group] ending: ${why}`);
  await chert("POST", `/v1/calls/${callId}/end`, {}, `council-end-${randomUUID()}`).catch((e) => console.warn(`[group] end: ${(e as Error).message}`));
  await bridge.close(why);
  await room.disconnect().catch(() => {});
  await dispose();
  process.exit(0);
};
process.on("SIGINT", () => void stop("stopped here"));
void bridge.ended.then((why) => stop(why));

const seen = new Set<string>();
let ready = false;
const TERMINAL = /ended|completed|failed|canceled|cancelled|rejected|declined|no_answer|busy/i;
while (!ended) {
  try {
    const ev = await chert("GET", `/v1/calls/${callId}/events`);
    for (const e of (ev.data ?? ev.events ?? []) as Record<string, unknown>[]) {
      const key = String(e.id ?? JSON.stringify(e));
      if (seen.has(key)) continue;
      seen.add(key);
      const s = JSON.stringify(e);
      console.log(`[group] event ${s.slice(0, 220)}`);
      if (!ready && /bridge_ready/.test(s)) { ready = true; bridge.markReady(); }
    }
    const call = await chert("GET", `/v1/calls/${callId}`);
    const status = String(call.data?.status ?? call.status ?? "");
    if (TERMINAL.test(status)) await stop(`call ${status}`);
  } catch (err) {
    console.warn(`[group] poll: ${(err as Error).message.slice(0, 200)}`);
  }
  await new Promise((r) => setTimeout(r, 700));
}
