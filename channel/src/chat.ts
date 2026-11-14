// Terminal stand-in for iMessage: talks to Brain's /text exactly as the Chert text path does.
// Run: npm run chat -w channel   (Brain running; stage at /stage?sessionId=<printed id> shows the same events)
import { createInterface } from "node:readline/promises";
import type { TextReply, TextRequest } from "@odyssey/contracts";

const BRAIN_URL = process.env.BRAIN_URL ?? "http://localhost:8080";
const sessionId = process.argv[2] ?? `chat-${Date.now()}`;
const rl = createInterface({ input: process.stdin, output: process.stdout });
const prompt = () => { if (process.stdin.isTTY) rl.prompt(); };
console.log(`Session ${sessionId}. Stage: ${process.env.STAGE_URL ?? "http://localhost:3000"}/stage?sessionId=${sessionId}\nType a message (Ctrl+C to quit).\n`);

rl.setPrompt("you › ");
prompt();
for await (const line of rl) {
  const message = line.trim();
  if (!process.stdin.isTTY) console.log(`you › ${message}`);
  if (!message) { prompt(); continue; }
  const req: TextRequest = { sessionId, from: "+10000000000", message, channel: "imessage" };
  const res = await fetch(`${BRAIN_URL}/text`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) });
  if (!res.ok) { console.log(`(brain ${res.status})`); continue; }
  const reply = (await res.json()) as TextReply;
  console.log(`\n${reply.character} › ${reply.text}`);
  for (const a of reply.attachments) console.log(`  [image] ${a.alt}: ${a.url}`);
  console.log();
  if (reply.sessionEnded) { console.log("(session ended)"); break; }
  prompt();
}
rl.close();
