// FaceTime voice + video, using Chert's open-source connector (@trychert/facetime-opensource) and a LiveKit room.
//
//   iPhone FaceTime <-> Chrome guest (Chert connector) <-> LiveKit room <-> this bridge ("odyssey-agent")
//                                                                            |  caller audio 16 kHz ->  Brain /voice
//                                                                            |  <- 24 kHz agent audio   Brain /voice
//                                                                            |  <- stage video          headless Chromium
//
// Facts from cherthq/chert-facetime-opensource (README, docs/GUIDE.md, src/index.d.ts):
//  - The connector joins a FaceTime link (created on an iPhone) as a browser guest; a human admits it on the iPhone.
//  - It relays media to a LiveKit room. Caller audio is published by the connector as a track named "facetime-caller".
//  - The agent is one participant (agentIdentity) publishing one audio track and one video track.
//  - Tokens must allow join/publish/subscribe, expire within one hour, and use different identities.
//  - Incoming calls to a number, and iMessage, need Chert's managed service (not open source).
//
// Alternative to chert.ts when you have no Chert line: you create the FaceTime link on an iPhone and admit the guest.
// Run: npm run facetime -w channel   (needs Brain, Stage, LIVEKIT_* in .env, Chrome, an iPhone)
// Flags: --no-video  publish audio only and print the stage link to share instead (the hour-12 fallback)
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { Room, dispose } from "@livekit/rtc-node";
import { AccessToken } from "livekit-server-sdk";
import { AgentBridge } from "./agent-bridge.ts";
import { stageUrl } from "./stage-capture.ts";

const AGENT_ID = "odyssey-agent";
const CONNECTOR_ID = "facetime-connector";

// ---------------------------------------------------------------- tokens

export async function mintTokens(room: string) {
  const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret || !process.env.LIVEKIT_URL) throw new Error("Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env");
  const token = async (identity: string) => {
    const at = new AccessToken(key, secret, { identity, ttl: "55m" });
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });
    return at.toJwt();
  };
  return { agent: await token(AGENT_ID), connector: await token(CONNECTOR_ID) };
}

// ---------------------------------------------------------------- CLI

async function hiddenPrompt(question: string): Promise<string> {
  const muted = new Writable({ write: (_c, _e, cb) => cb() });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write(question);
  const answer = await rl.question("");
  rl.close();
  process.stdout.write("\n");
  return answer.trim();
}

async function main() {
  const video = !process.argv.includes("--no-video");
  const roomName = `odyssey-${Date.now()}`;
  const sessionId = roomName;
  const tokens = await mintTokens(roomName);

  const room = new Room();
  await room.connect(process.env.LIVEKIT_URL!, tokens.agent, { autoSubscribe: false, dynacast: false });
  // The open-source connector publishes the caller as "facetime-caller" from CONNECTOR_ID and sends no ready signal.
  const bridge = new AgentBridge(room, sessionId, { video, readyOn: "caller_audio", isCaller: (p) => p.identity === CONNECTOR_ID });
  await bridge.start();

  const publicStage = stageUrl(sessionId, process.env.PUBLIC_BASE_URL || process.env.STAGE_URL);
  if (!video) console.log(`\nFallback mode: share this stage link with the caller:\n  ${publicStage}\n`);

  const link = process.env.FACETIME_LINK || (await hiddenPrompt("FaceTime link (created on the iPhone, hidden): "));
  if (!/^https:\/\/facetime\.apple\.com\/join/.test(link)) throw new Error("That doesn't look like a https://facetime.apple.com/join link");

  const { FaceTimeGuest } = await import("@trychert/facetime-opensource");
  const guest = await FaceTimeGuest.open({ faceTimeLink: link, livekitUrl: process.env.LIVEKIT_URL!, roomToken: tokens.connector, agentIdentity: "odyssey-agent" });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("Chrome opened. Click Join, admit the guest on the iPhone, then press Enter here. ");
  rl.close();
  const status = await guest.connect();
  console.log("[facetime] connector status", status);

  const stop = async () => { await bridge.close("operator stop"); await guest.close(); await room.disconnect(); await dispose(); process.exit(0); };
  process.on("SIGINT", stop);
  await Promise.race([guest.closed, bridge.ended]);
  await stop();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async (err) => {
    console.error("[facetime]", err.message);
    await dispose();
    process.exit(1);
  });
}
