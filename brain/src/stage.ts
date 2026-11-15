// Fan-out of stage events to every stage page open for a session.
// The latest visual state is replayed to pages that connect late (e.g. Channel's headless capture).
import type { WebSocket } from "ws";
import type { StageEvent } from "@odyssey/contracts";
import { currentStyle } from "./style.ts";

const stages = new Map<string, Set<WebSocket>>();
type Snapshot = Partial<Record<"character" | "visual" | "highlight" | "caption" | "story" | "illustration" | "gesture" | "screen" | "board" | "adventure", StageEvent>> & { debate?: StageEvent[] };
const snapshots = new Map<string, Snapshot>();

export function registerStage(sessionId: string, ws: WebSocket) {
  const set = stages.get(sessionId) ?? new Set();
  set.add(ws);
  stages.set(sessionId, set);
  ws.on("close", () => set.delete(ws));
  ws.send(JSON.stringify({ type: "style", style: currentStyle() } satisfies StageEvent));
  const snap = snapshots.get(sessionId);
  if (snap) {
    for (const e of [...(snap.debate ?? []), snap.character, snap.visual, snap.highlight, snap.caption, snap.story, snap.illustration, snap.gesture, snap.screen, snap.board, snap.adventure]) if (e) ws.send(JSON.stringify(e));
  }
}

function remember(sessionId: string, e: StageEvent) {
  const snap = snapshots.get(sessionId) ?? {};
  switch (e.type) {
    case "character":
      if (e.side) snap.debate = [...(snap.debate ?? []).filter((d) => d.type === "character" && d.side !== e.side), e];
      else snap.debate = undefined;
      snap.character = e;
      break;
    case "scene": case "map": snap.visual = e; snap.board = undefined; break;
    case "highlight": snap.highlight = e; break;
    case "caption": snap.caption = e; break;
    case "story_mode": snap.story = e; if (!e.active) { snap.illustration = undefined; snap.gesture = undefined; } break;
    case "illustration": snap.illustration = e.illustrationId ? e : undefined; if (e.illustrationId) snap.board = undefined; break;
    case "gesture": snap.gesture = e.gesture === "none" ? undefined : e; break;
    case "screen": snap.screen = e; break;
    case "board": snap.board = e.board ? e : undefined; break;
    case "adventure": snap.adventure = e.adventure ? e : undefined; break;
    case "clear": snapshots.set(sessionId, { character: snap.character }); return;
    default: return;
  }
  snapshots.set(sessionId, snap);
}

export function emit(sessionId: string, event: StageEvent) {
  remember(sessionId, event);
  const msg = JSON.stringify(event);
  for (const ws of stages.get(sessionId) ?? []) if (ws.readyState === ws.OPEN) ws.send(msg);
}

/** Sends an event to every open stage page, whatever its session (e.g. a style change). */
export function broadcast(event: StageEvent) {
  const msg = JSON.stringify(event);
  for (const set of stages.values()) for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(msg);
}

// Loudness of a PCM16 chunk scaled to 0..1, for `mouth` events. Gemini speech peaks around RMS 0.15-0.25,
// so x4 maps normal speech to mouth-2/3 and quiet syllables to mouth-1.
export function mouthLevel(pcm16: Buffer): number {
  let sum = 0;
  const n = Math.floor(pcm16.length / 2);
  for (let i = 0; i < n; i++) {
    const s = pcm16.readInt16LE(i * 2) / 32768;
    sum += s * s;
  }
  return n ? Math.min(1, Math.round(Math.sqrt(sum / n) * 4 * 100) / 100) : 0;
}
