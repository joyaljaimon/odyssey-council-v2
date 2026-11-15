// A FaceTime stand-in in the browser: your mic and camera go to the same Council a phone call uses, and you see and
// hear exactly what the caller would. For testing without a phone, and as a demo backup.
// Run: npm run sim   then open http://localhost:8790
// WebSocket frames are binary with a 1-byte tag:  browser -> server: 1 = mic PCM16 16 kHz, 2 = camera JPEG
//                                                 server -> browser: 1 = voice PCM16 24 kHz, 2 = stage JPEG, 3 = stop audio
import http from "node:http";
import { readFileSync } from "node:fs";
import { WebSocketServer, type WebSocket } from "ws";
import { Council, warmVoices } from "./council.ts";
import { artReady } from "./stage.ts";

const PORT = Number(process.env.SIM_PORT ?? 8790);
const page = () => readFileSync(new URL("../public/sim.html", import.meta.url), "utf8");
const tagged = (tag: number, data: Buffer) => Buffer.concat([Buffer.from([tag]), data]);

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url?.startsWith("/?")) { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page()); return; }
  if (req.url === "/health") { res.writeHead(200).end("ok"); return; }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server, path: "/call" });
let n = 0;
wss.on("connection", async (ws: WebSocket) => {
  await artReady;
  const id = `sim-${++n}`;
  console.log(`[sim] ${id} connected`);
  const send = (tag: number, data: Buffer) => { if (ws.readyState === ws.OPEN) ws.send(tagged(tag, data)); };
  const council = new Council(id, { sendAudio: (pcm) => send(1, pcm), clearAudio: () => send(3, Buffer.alloc(0)) }, 16000);
  let camera: { jpeg: Buffer; at: number } | null = null;
  council.setFrameSource(async () => (camera && Date.now() - camera.at < 5000 ? camera.jpeg : null));
  const video = setInterval(() => send(2, council.stage.jpeg(70)), 1000 / 12);
  ws.on("message", (data: Buffer, isBinary) => {
    if (!isBinary || data.length < 2) return;
    const body = data.subarray(1);
    if (data[0] === 1) council.callerAudio(Buffer.from(body));
    else if (data[0] === 2) camera = { jpeg: Buffer.from(body), at: Date.now() };
  });
  ws.on("close", () => { clearInterval(video); council.close(); console.log(`[sim] ${id} hung up`); });
  setTimeout(() => void council.greet(), 600);
});

void warmVoices();
server.listen(PORT, () => console.log(`[sim] open http://localhost:${PORT} (allow the mic and camera)`));
