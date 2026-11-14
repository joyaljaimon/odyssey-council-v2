// Role 1 (Channel). Port 8081. Receives Chert webhooks and talks to Brain.
// TODO(channel): replace the fake webhook shape with Chert's real payload once you've read its docs/repo.
import http from "node:http";
import type { TextReply, TextRequest } from "@odyssey/contracts";

const PORT = Number(process.env.CHANNEL_PORT ?? 8081);
const BRAIN_URL = process.env.BRAIN_URL ?? "http://localhost:8080";

async function askBrain(req: TextRequest): Promise<TextReply> {
  const res = await fetch(`${BRAIN_URL}/text`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`brain ${res.status}`);
  return (await res.json()) as TextReply;
}

// TODO(channel): send via Chert (text, typing indicator, attachments).
async function sendToUser(to: string, reply: TextReply) {
  console.log(`[send -> ${to}] (${reply.character}) ${reply.text}`);
  for (const a of reply.attachments) console.log(`   attachment: ${a.url}`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "POST" && url.pathname === "/webhooks/chert/message") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { from, message } = JSON.parse(body) as { from: string; message: string }; // FAKE shape
    res.writeHead(200).end(); // ack fast, reply async
    try {
      const reply = await askBrain({ sessionId: from, from, message, channel: "imessage" });
      await sendToUser(from, reply);
    } catch (err) {
      console.error(err);
    }
    return;
  }
  // TODO(channel): /webhooks/chert/call -> bridge call audio to `${BRAIN_URL}/voice?sessionId=...`
  //                and start stage capture (see stage-capture.ts).
  res.writeHead(404).end();
});

server.listen(PORT, () => console.log(`channel listening on :${PORT}`));
