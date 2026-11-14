// Role 2 (Brain). Port 8080.
//   POST /text                      -> TextReply           (Channel, iMessage/SMS)
//   WS   /voice?sessionId=...       <-> PCM audio          (Channel, FaceTime)
//   WS   /stage?sessionId=...       -> StageEvent JSON     (Stage page)
//   POST /debug/emit?sessionId=...  -> forwards a StageEvent to the stage (testing only)
// Everything below is a STUB that returns correctly shaped fake data.
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { StageEvent, TextRequest } from "@odyssey/contracts";
import { handleText } from "./text.ts";
import { handleVoice } from "./voice.ts";
import { emit, registerStage } from "./stage.ts";

const PORT = Number(process.env.BRAIN_PORT ?? 8080);

async function readJson<T>(req: http.IncomingMessage): Promise<T> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body) as T;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "POST" && url.pathname === "/text") {
      const reply = await handleText(await readJson<TextRequest>(req));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(reply));
      return;
    }
    if (req.method === "POST" && url.pathname === "/debug/emit") {
      emit(url.searchParams.get("sessionId") ?? "demo", await readJson<StageEvent>(req));
      res.writeHead(204).end();
      return;
    }
    if (url.pathname === "/health") {
      res.writeHead(200).end("ok");
      return;
    }
    res.writeHead(404).end();
  } catch (err) {
    console.error(err);
    res.writeHead(500).end(String(err));
  }
});

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const sessionId = url.searchParams.get("sessionId") ?? "demo";
  wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
    if (url.pathname === "/stage") registerStage(sessionId, ws);
    else if (url.pathname === "/voice") handleVoice(sessionId, ws);
    else ws.close(1008, "unknown path");
  });
});

server.listen(PORT, () => console.log(`brain listening on :${PORT}`));
