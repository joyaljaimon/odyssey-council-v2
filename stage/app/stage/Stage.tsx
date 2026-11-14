"use client";
// Role 4 (Experience). The 1280x720 stage Channel films into FaceTime.
// Open http://localhost:3000/stage?sessionId=demo&debug=1 to fire events by hand.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CharacterId, StageEvent } from "@odyssey/contracts";
import { passages } from "@odyssey/story";

const BRAIN_WS = process.env.NEXT_PUBLIC_BRAIN_WS ?? "ws://localhost:8080";

function mouthFrame(level: number) {
  if (level < 0.1) return 0;
  if (level < 0.3) return 1;
  if (level < 0.6) return 2;
  return 3;
}

export default function Stage() {
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? "demo";
  const debug = params.get("debug") === "1";

  const [character, setCharacter] = useState<CharacterId>("athena");
  const [mouth, setMouth] = useState(0);
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [scene, setScene] = useState<string | null>(null);
  const [mapLocation, setMapLocation] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const textRef = useRef<HTMLDivElement>(null);

  const apply = (e: StageEvent) => {
    switch (e.type) {
      case "character": setCharacter(e.character); break;
      case "mouth": setMouth(mouthFrame(e.level)); break;
      case "highlight": setHighlighted(e.passageIds); break;
      case "scene": setScene(e.sceneId); setMapLocation(null); break;
      case "map": setMapLocation(e.locationId); break;
      case "caption": setCaption(e.text); break;
      case "clear": setHighlighted([]); setScene(null); setMapLocation(null); setCaption(""); break;
    }
  };

  // Stage socket with auto-reconnect.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    const connect = () => {
      ws = new WebSocket(`${BRAIN_WS}/stage?sessionId=${encodeURIComponent(sessionId)}`);
      ws.onmessage = (m) => apply(JSON.parse(m.data) as StageEvent);
      ws.onclose = () => { if (!closed) setTimeout(connect, 1000); };
    };
    connect();
    return () => { closed = true; ws?.close(); };
  }, [sessionId]);

  // Scroll the first highlighted passage into view.
  useEffect(() => {
    if (!highlighted[0]) return;
    textRef.current?.querySelector(`[data-pid="${highlighted[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  return (
    <div style={{ width: 1280, height: 720, position: "relative", overflow: "hidden", background: "var(--paper)" }}>
      {/* Visual panel: scene or map (top right) */}
      <div style={{ position: "absolute", left: 440, top: 40, width: 800, height: 300, borderRadius: 12, background: "#e3d6bd", overflow: "hidden" }}>
        {scene && <img src={`/assets/scenes/${scene}.png`} alt={scene} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        {mapLocation && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "#d9c9a8" }}>
            {/* TODO(experience): assets/map/base.png + marker from assets/map/locations.json */}
            Map: {mapLocation}
          </div>
        )}
      </div>

      {/* Text panel (bottom right) */}
      <div ref={textRef} style={{ position: "absolute", left: 440, top: 360, width: 800, height: 320, overflowY: "auto", fontSize: 22, lineHeight: 1.5 }}>
        {passages.map((p) => (
          <p key={p.id} data-pid={p.id} style={{ background: highlighted.includes(p.id) ? "var(--gold)" : "transparent", transition: "background 400ms", padding: "4px 8px", borderRadius: 6 }}>
            <small style={{ opacity: 0.5 }}>{p.id} </small>{p.text}
          </p>
        ))}
      </div>

      {/* Character (bottom left). Layers: body.png + mouth-0..3.png, same size. */}
      <div style={{ position: "absolute", left: 40, bottom: 40, width: 360, height: 500 }}>
        <img src={`/assets/characters/${character}/body.png`} alt={character} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        <img src={`/assets/characters/${character}/mouth-${mouth}.png`} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        <div style={{ position: "absolute", bottom: -32, width: "100%", textAlign: "center", fontSize: 24, textTransform: "capitalize" }}>{character}</div>
      </div>

      {caption && <div style={{ position: "absolute", left: 440, bottom: 8, fontSize: 18, opacity: 0.8 }}>{caption}</div>}

      {debug && <DebugPanel onEvent={apply} />}
    </div>
  );
}

function DebugPanel({ onEvent }: { onEvent: (e: StageEvent) => void }) {
  const btn = (label: string, e: StageEvent) => (
    <button key={label} onClick={() => onEvent(e)} style={{ margin: 2 }}>{label}</button>
  );
  return (
    <div style={{ position: "absolute", top: 4, left: 4, background: "#fff", padding: 6, fontSize: 12, zIndex: 10 }}>
      {btn("athena", { type: "character", character: "athena" })}
      {btn("odysseus", { type: "character", character: "odysseus" })}
      {btn("poseidon", { type: "character", character: "poseidon" })}
      {[0, 0.2, 0.5, 0.9].map((l) => btn(`mouth ${l}`, { type: "mouth", character: "athena", level: l }))}
      {btn("highlight 12.1", { type: "highlight", passageIds: ["12.1"] })}
      {btn("scene sirens", { type: "scene", sceneId: "sirens" })}
      {btn("map aeaea", { type: "map", locationId: "aeaea" })}
      {btn("clear", { type: "clear" })}
    </div>
  );
}
