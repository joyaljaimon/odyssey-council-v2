import type { WebSocket } from "ws";
import type { VoiceControlMessage } from "@odyssey/contracts";

// STUB. TODO(brain):
//  1. Open a Gemini Live session (@google/genai, ai.live.connect) with the character's prompt, voice and tools.
//  2. Forward binary frames from Channel (PCM16 16 kHz) to the session.
//  3. Send the model's audio (PCM16 24 kHz) back as binary frames, and emit `mouth` events using mouthLevel().
//  4. On a tool call, run it and emit the matching StageEvent via emit().
//  5. On interruption, send { type: "interrupted" } so Channel drops queued audio.
export function handleVoice(sessionId: string, ws: WebSocket) {
  console.log(`[voice] session ${sessionId} connected`);
  ws.on("message", (data, isBinary) => {
    if (!isBinary) return;
    // user audio arrives here
  });
  ws.on("close", () => {
    const msg: VoiceControlMessage = { type: "ended" };
    console.log(`[voice] session ${sessionId} closed`, msg);
  });
}
