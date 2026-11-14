"use client";
// Role 4 (Experience). The 1280x720 stage Channel films into FaceTime.
// Open http://localhost:3000/stage?sessionId=demo&debug=1 to fire events by hand.
// Layout keeps everything important 40 px inside the edges (FaceTime crops).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CharacterId, MapLocation, Passage, StageEvent } from "@odyssey/contracts";
import passagesJson from "@odyssey/story/data/passages.json";
import bookTitlesJson from "@odyssey/story/data/book-titles.json";

const passages = passagesJson as Passage[];
const bookTitles = bookTitlesJson as Record<string, string>;
const BRAIN_WS = process.env.NEXT_PUBLIC_BRAIN_WS ?? "ws://localhost:8080";
const NAMES: Record<CharacterId, string> = { athena: "Athena", odysseus: "Odysseus", poseidon: "Poseidon", circe: "Circe" };
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV"];

function mouthFrame(level: number) {
  if (level < 0.1) return 0;
  if (level < 0.3) return 1;
  if (level < 0.6) return 2;
  return 3;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s—-])([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/\b(Of|The|And|To|In|At|On|With|For|From)\b/g, (w, _1, i) => (i === 0 ? w : w.toLowerCase()));

type Visual = { kind: "scene"; id: string } | { kind: "map"; id: string } | null;

export default function Stage() {
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? "demo";
  const debug = params.get("debug") === "1";

  const [character, setCharacter] = useState<CharacterId>("athena");
  const [debate, setDebate] = useState<{ left?: CharacterId; right?: CharacterId } | null>(null);
  const [mouths, setMouths] = useState<Partial<Record<CharacterId, number>>>({});
  const [speaker, setSpeaker] = useState<CharacterId | null>(null);
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [visuals, setVisuals] = useState<{ v: Visual; key: number }[]>([]);
  const [caption, setCaption] = useState("");
  const [connected, setConnected] = useState(false);
  const keyRef = useRef(0);
  const speakerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showVisual = (v: Visual) =>
    setVisuals((prev) => [...prev.slice(-1), { v, key: ++keyRef.current }]);

  const apply = useCallback((e: StageEvent) => {
    switch (e.type) {
      case "character":
        if (e.side) {
          setDebate((d) => ({ ...(d ?? {}), [e.side!]: e.character }));
        } else {
          setDebate(null);
        }
        setCharacter(e.character);
        break;
      case "mouth": {
        const frame = mouthFrame(e.level);
        setMouths((m) => (m[e.character] === frame ? m : { ...m, [e.character]: frame }));
        if (frame > 0) {
          setSpeaker(e.character);
          clearTimeout(speakerTimer.current);
          speakerTimer.current = setTimeout(() => setSpeaker(null), 1200);
        }
        break;
      }
      case "highlight": setHighlighted(e.passageIds); break;
      case "scene": showVisual({ kind: "scene", id: e.sceneId }); break;
      case "map": showVisual({ kind: "map", id: e.locationId }); break;
      case "caption": setCaption(e.text); break;
      case "clear": setHighlighted([]); setVisuals([]); setCaption(""); setDebate(null); break;
    }
  }, []);

  // Stage socket with auto-reconnect.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(`${BRAIN_WS}/stage?sessionId=${encodeURIComponent(sessionId)}`);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (m) => apply(JSON.parse(m.data) as StageEvent);
      ws.onclose = () => { setConnected(false); if (!closed) retry = setTimeout(connect, 1000); };
    };
    connect();
    return () => { closed = true; clearTimeout(retry); ws?.close(); };
  }, [sessionId, apply]);

  // Fit the fixed 1280x720 stage to the window (it is exactly 1:1 in Channel's 1280x720 capture).
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const current = visuals[visuals.length - 1]?.v ?? null;
  const inDebate = !!debate && !!debate.left && !!debate.right;

  return (
    <div className="stage-viewport">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        <div className="meander top" />
        <div className="meander bottom" />

        {inDebate ? (
          <>
            <Figure id={debate!.left!} mouth={mouths[debate!.left!] ?? 0} className="debate-left" dim={speaker !== null && speaker !== debate!.left} side="left" />
            <Figure id={debate!.right!} mouth={mouths[debate!.right!] ?? 0} className="debate-right" dim={speaker !== null && speaker !== debate!.right} side="right" />
          </>
        ) : (
          <Figure id={character} mouth={mouths[character] ?? 0} className="solo" />
        )}

        <div className={`visual ${inDebate ? "debate" : ""}`}>
          {visuals.length === 0 && <TitleCard />}
          {visuals.map(({ v, key }) => (
            <div key={key} className="layer fade-in">
              {v?.kind === "scene" && <img src={`/assets/scenes/${v.id}.png`} alt={v.id} />}
              {v?.kind === "map" && <JourneyMap locationId={v.id} />}
            </div>
          ))}
          {current?.kind === "map" && <div className="tag">Map</div>}
        </div>

        <TextPanel highlighted={highlighted} compact={inDebate} />

        <div className={`caption ${inDebate ? "debate" : ""}`}>
          {caption && <span key={caption} className="fade-in">{caption}</span>}
        </div>

        {!connected && <div className="offline">connecting…</div>}
        {debug && <DebugPanel onEvent={apply} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- character

function Figure({ id, mouth, className, dim = false, side }: { id: CharacterId; mouth: number; className: string; dim?: boolean; side?: "left" | "right" }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); loop(); }, 2500 + Math.random() * 3500);
    };
    loop();
    return () => clearTimeout(t);
  }, []);
  const src = (f: string) => `/assets/characters/${id}/${f}.png`;
  return (
    <div className={`figure ${className} ${dim ? "dim" : ""}`}>
      <div key={id} className="figure-art fade-in sway">
        <img src={src("body")} alt={NAMES[id]} />
        {[0, 1, 2, 3].map((m) => (
          <img key={m} src={src(`mouth-${m}`)} alt="" style={{ opacity: m === mouth ? 1 : 0 }} />
        ))}
        <img src={src("blink")} alt="" style={{ opacity: blink ? 1 : 0 }} />
      </div>
      <div className="nameplate">
        {side === "right" ? "" : "◆ "}{NAMES[id]}{side === "right" ? " ◆" : ""}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- scene / map

function TitleCard() {
  return (
    <div className="title-card">
      <div className="title">Homer&apos;s Odyssey</div>
      <div className="subtitle">Every great solution begins with an Odyssey.</div>
    </div>
  );
}

type MapData = { locations: MapLocation[]; route: string[] };
let mapCache: Promise<MapData> | null = null;
const loadMap = () =>
  (mapCache ??= Promise.all([
    fetch("/assets/map/locations.json").then((r) => r.json() as Promise<MapLocation[]>),
    fetch("/assets/map/route.json").then((r) => r.json() as Promise<{ route: string[] }>),
  ]).then(([locations, { route }]) => ({ locations, route })));

function JourneyMap({ locationId }: { locationId: string }) {
  const [data, setData] = useState<MapData | null>(null);
  useEffect(() => { loadMap().then(setData).catch(() => {}); }, []);
  const byId = useMemo(() => new Map(data?.locations.map((l) => [l.id, l]) ?? []), [data]);
  const target = byId.get(locationId);
  // Route from Troy up to the first visit of this location (the whole voyage for Ithaca).
  const stop = locationId === "ithaca" ? (data?.route.length ?? 1) - 1 : Math.max(0, data?.route.indexOf(locationId) ?? 0);
  const pts = (data?.route.slice(0, stop + 1) ?? []).map((id) => byId.get(id)).filter((l): l is MapLocation => !!l);
  return (
    <div className="map">
      <img src="/assets/map/base.png" alt="Map of Odysseus's journey" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} className="route" vectorEffect="non-scaling-stroke" />
      </svg>
      {data?.locations.filter((l) => l.id === "troy").map((l) => (
        <div key={l.id} className="pin small" style={{ left: `${l.x}%`, top: `${l.y}%` }}><span>Troy</span></div>
      ))}
      {target && (
        <div className="pin" style={{ left: `${target.x}%`, top: `${target.y}%` }}>
          <i />
          <span className={target.x > 70 ? "left" : ""}>{target.name}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- text

function TextPanel({ highlighted, compact }: { highlighted: string[]; compact: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const book = highlighted[0] ? Number(highlighted[0].split(".")[0]) : 1;
  const bookPassages = useMemo(() => passages.filter((p) => p.book === book), [book]);
  useEffect(() => {
    // Scroll so the highlight's first line sits near the top (long passages would otherwise start off-screen).
    const el = highlighted[0] ? ref.current?.querySelector<HTMLElement>(`[data-pid="${highlighted[0]}"]`) : null;
    ref.current?.scrollTo({ top: el ? Math.max(0, el.offsetTop - 24) : 0, behavior: el ? "smooth" : "auto" });
  }, [highlighted, book]);
  return (
    <div className={`text-panel ${compact ? "debate" : ""}`}>
      <div className="book-title">
        <b>Book {ROMAN[book]}</b> · {titleCase(bookTitles[String(book)] ?? "")}
      </div>
      <div className="passages" ref={ref}>
        {bookPassages.map((p) => (
          <p key={p.id} data-pid={p.id} className={highlighted.includes(p.id) ? "hl" : ""}>
            <small>{p.id}</small> {p.text}
          </p>
        ))}
      </div>
      <div className="translator">Samuel Butler&apos;s translation, 1900</div>
    </div>
  );
}

// ---------------------------------------------------------------- debug

function DebugPanel({ onEvent }: { onEvent: (e: StageEvent) => void }) {
  const [talking, setTalking] = useState<CharacterId | null>(null);
  useEffect(() => {
    if (!talking) return;
    let t = 0;
    const id = setInterval(() => {
      t += 50;
      onEvent({ type: "mouth", character: talking, level: Math.abs(Math.sin(t / 90)) * (0.5 + 0.5 * Math.abs(Math.sin(t / 370))) });
    }, 50);
    return () => { clearInterval(id); onEvent({ type: "mouth", character: talking, level: 0 }); };
  }, [talking, onEvent]);
  const btn = (label: string, e: StageEvent) => <button key={label} onClick={() => onEvent(e)}>{label}</button>;
  return (
    <div className="debug">
      {(["athena", "odysseus", "poseidon", "circe"] as CharacterId[]).map((c) => btn(c, { type: "character", character: c }))}
      <button onClick={() => { onEvent({ type: "character", character: "odysseus", side: "left" }); onEvent({ type: "character", character: "poseidon", side: "right" }); }}>debate</button>
      <br />
      {[0, 0.2, 0.5, 0.9].map((l) => btn(`mouth ${l}`, { type: "mouth", character: "athena", level: l }))}
      {(["athena", "odysseus", "poseidon"] as CharacterId[]).map((c) => (
        <button key={`talk-${c}`} onClick={() => setTalking((x) => (x === c ? null : c))}>{talking === c ? "stop" : `talk ${c}`}</button>
      ))}
      <br />
      {btn("highlight 12.13", { type: "highlight", passageIds: ["12.13"] })}
      {btn("highlight 9.28", { type: "highlight", passageIds: ["9.28"] })}
      {btn("scene sirens", { type: "scene", sceneId: "sirens" })}
      {btn("scene cyclops", { type: "scene", sceneId: "cyclops" })}
      {btn("map aeaea", { type: "map", locationId: "aeaea" })}
      {btn("map ithaca", { type: "map", locationId: "ithaca" })}
      {btn("caption", { type: "caption", text: "Plan for temptation before it arrives, not in the moment." })}
      {btn("clear", { type: "clear" })}
    </div>
  );
}
