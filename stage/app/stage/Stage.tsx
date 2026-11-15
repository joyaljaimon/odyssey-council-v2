"use client";
// Role 4 (Experience). The 1280x720 stage Channel films into FaceTime.
// Open http://localhost:3000/stage?sessionId=demo&debug=1 to fire events by hand.
// Layout keeps everything important 40 px inside the edges (FaceTime crops).
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import type { AdventureView, AppMode, Board, CharacterId, GodId, Gesture, IllustrationAnimation, MapLocation, Passage, StageEvent } from "@odyssey/contracts";
import bookTitlesJson from "@odyssey/story/data/book-titles.json";

// Mouth levels live outside React state: 20 updates a second must only repaint the mouth, not the whole stage.
const mouthStore = (() => {
  const frames: Partial<Record<CharacterId, number>> = {};
  const subs = new Set<() => void>();
  return {
    set(id: CharacterId, frame: number) { if (frames[id] !== frame) { frames[id] = frame; subs.forEach((f) => f()); } },
    get: (id: CharacterId) => frames[id] ?? 0,
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  };
})();
const useMouth = (id: CharacterId) => useSyncExternalStore(mouthStore.subscribe, () => mouthStore.get(id), () => 0);

// Each book's passages are fetched once, when first highlighted (keeps the Odyssey text out of the page bundle).
const bookCache = new Map<number, Promise<Passage[]>>();
const loadBook = (book: number) => {
  if (!bookCache.has(book)) bookCache.set(book, fetch(`/passages/${book}`).then((r) => r.json() as Promise<Passage[]>).catch(() => { bookCache.delete(book); return []; }));
  return bookCache.get(book)!;
};
const bookTitles = bookTitlesJson as Record<string, string>;
const BRAIN_WS = process.env.NEXT_PUBLIC_BRAIN_WS ?? "ws://localhost:8080";
const BRAIN_HTTP = BRAIN_WS.replace(/^ws/, "http");

const MODES: { id: AppMode; title: string; blurb: string; say: string; emblem: string; examples: string[] }[] = [
  { id: "odysseus", title: "Be Odysseus", blurb: "Make his choices at nine moments of the voyage and write your own Odyssey.", say: "Be Odysseus", emblem: "ship",
    examples: ["Your voyage is starting…"] },
  { id: "philosophy", title: "The Council", blurb: "The gods debate the Odyssey's ideas and explain the story, on screen.", say: "The Council", emblem: "scales",
    examples: ["\u201cIs revenge ever justified?\u201d", "\u201cWhy did Odysseus shout his name?\u201d", "\u201cTell me about the wooden horse\u201d"] },
  { id: "life", title: "Talk about life", blurb: "Bring your own storm and find the part of the Odyssey that speaks to it.", say: "Talk about life", emblem: "hearth",
    examples: ["\u201cI keep procrastinating\u201d", "\u201cI have to choose between two jobs\u201d", "\u201cI miss home\u201d"] },
];
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
type Illustration = { id: string; caption?: string; animation: IllustrationAnimation; key: number };
const GOD_EMBLEM: Record<GodId, string> = { athena: "owl", poseidon: "trident", zeus: "thunderbolt", hermes: "winged-sandal", helios: "sun-disk", circe: "magic-cup", calypso: "loom", odysseus: "ship" };
const GOD_NAME: Record<GodId, string> = { athena: "Athena", poseidon: "Poseidon", zeus: "Zeus", hermes: "Hermes", helios: "Helios", circe: "Circe", calypso: "Calypso", odysseus: "Odysseus" };
const GESTURE_LAYERS: Exclude<Gesture, "none">[] = ["point", "open", "raise", "heart", "think"];

export default function Stage() {
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? "demo";
  const debug = params.get("debug") === "1";
  const capture = params.get("capture") === "1"; // filmed by Channel: drop effects that cost paint time

  const [character, setCharacter] = useState<CharacterId>("athena");
  const [debate, setDebate] = useState<{ left?: CharacterId; right?: CharacterId } | null>(null);
  const [speaker, setSpeaker] = useState<CharacterId | null>(null);
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [visuals, setVisuals] = useState<{ v: Visual; key: number }[]>([]);
  const [caption, setCaption] = useState("");
  const [connected, setConnected] = useState(false);
  const [story, setStory] = useState<{ active: boolean; title?: string }>({ active: false });
  const [illustration, setIllustration] = useState<Illustration | null>(null);
  const [gestures, setGestures] = useState<Partial<Record<CharacterId, Gesture>>>({});
  const [screen, setScreen] = useState(true);
  const [mode, setMode] = useState<AppMode | null>(null); // null = the start menu
  const [board, setBoard] = useState<(Board & { key: number }) | null>(null);
  const [adv, setAdv] = useState<AdventureView | null>(null);
  const keyRef = useRef(0);
  const speakerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showVisual = (v: Visual) =>
    setVisuals((prev) => [...prev.slice(-1), { v, key: ++keyRef.current }]);

  const apply = useCallback((e: StageEvent) => {
    // Anything visual brings the screen up.
    if (["scene", "map", "highlight", "illustration"].includes(e.type) || (e.type === "story_mode" && e.active) ||
        (e.type === "board" && e.board) || (e.type === "adventure" && e.adventure) || (e.type === "character" && e.side)) setScreen(true);
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
        mouthStore.set(e.character, frame);
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
      case "clear": setHighlighted([]); setVisuals([]); setCaption(""); setDebate(null); setStory({ active: false }); setIllustration(null); setGestures({}); setScreen(true); setBoard(null); setAdv(null); setMode(null); break;
      case "mode": setMode(e.mode); setVisuals([]); setHighlighted([]); setBoard(null); setAdv(null); setIllustration(null); setStory({ active: false }); setScreen(true); break;
      case "screen": setScreen(e.open); break;
      case "board": setBoard(e.board ? { ...e.board, key: ++keyRef.current } : null); if (e.board) setAdv(null); break;
      case "adventure": setAdv(e.adventure); if (e.adventure) setBoard(null); break;
      case "story_mode": setStory({ active: e.active, title: e.title }); if (!e.active) setIllustration(null); break;
      case "illustration":
        setIllustration(e.illustrationId ? { id: e.illustrationId, caption: e.caption, animation: e.animation ?? "pop", key: ++keyRef.current } : null);
        break;
      case "gesture": setGestures((g) => ({ ...g, [e.character]: e.gesture })); break;
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
    <div className={`stage-viewport ${capture ? "capture" : ""}`}>
      <div className={`stage ${screen ? "screen-open" : "idle"} ${mode ? `mode-${mode}` : "menu"} ${highlighted.length ? "" : "no-text"}`} style={{ transform: `scale(${scale})` }}>
        <div className="meander top" />
        <div className="meander bottom" />

        {inDebate ? (
          <>
            <Figure id={debate!.left!} gesture={gestures[debate!.left!]} className="debate-left" dim={speaker !== null && speaker !== debate!.left} side="left" />
            <Figure id={debate!.right!} gesture={gestures[debate!.right!]} className="debate-right" dim={speaker !== null && speaker !== debate!.right} side="right" />
          </>
        ) : (
          <Figure id={character} gesture={gestures[character]} className="solo" />
        )}

        <div className={`visual ${inDebate ? "debate" : ""} ${story.active || board || adv ? "story" : ""}`}>
          {!mode && <Menu sessionId={sessionId} />}
          {mode && visuals.length === 0 && !story.active && !illustration && !board && !adv && <ModeIntro mode={mode} />}
          {visuals.map(({ v, key }) => (
            <div key={key} className="layer fade-in">
              {v?.kind === "scene" && <img src={`/assets/scenes/${v.id}.png`} alt={v.id} />}
              {v?.kind === "map" && <JourneyMap locationId={v.id} />}
            </div>
          ))}
          {current?.kind === "map" && !story.active && <div className="tag">Map</div>}
          {illustration && (
            <div key={illustration.key} className={`illustration anim-${illustration.animation}`}>
              <div className="plate">
                <img src={`/assets/illustrations/${illustration.id}.png`} alt={illustration.caption ?? illustration.id} />
              </div>
              {illustration.caption && <div className="ill-caption">{illustration.caption}</div>}
            </div>
          )}
          {story.active && <div className="story-banner fade-in">Story Mode{story.title ? ` · ${story.title}` : ""}</div>}
          {board && !illustration && <BoardView key={board.key} board={board} compact={inDebate} />}
          {adv && !illustration && <AdventurePanel view={adv} />}
        </div>

        <TextPanel highlighted={highlighted} compact={inDebate} story={story.active || !!board || !!adv} />

        <div className={`caption ${inDebate ? "debate" : ""}`}>
          {caption && <span key={caption} className="fade-in">{caption}</span>}
        </div>

        {mode && (
          <div key={mode} className="mode-pill fade-in">
            <b>{MODES.find((m) => m.id === mode)?.title}</b>
            <span>say &ldquo;menu&rdquo; to change</span>
          </div>
        )}
        {!connected && <div className="offline">connecting…</div>}
        {debug && <DebugPanel onEvent={apply} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- character

const Figure = memo(function Figure({ id, gesture = "none", className, dim = false, side }: { id: CharacterId; gesture?: Gesture; className: string; dim?: boolean; side?: "left" | "right" }) {
  const mouth = useMouth(id);
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
        {GESTURE_LAYERS.map((g) => (
          <img key={g} src={src(`gesture-${g}`)} alt="" className="gesture" style={{ opacity: g === gesture ? 1 : 0 }} />
        ))}
      </div>
      <div className="nameplate">
        {side === "right" ? "" : "◆ "}{NAMES[id]}{side === "right" ? " ◆" : ""}
      </div>
    </div>
  );
});

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

const JourneyMap = memo(function JourneyMap({ locationId }: { locationId: string }) {
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
});

// ---------------------------------------------------------------- the start menu and the mode intros

const tap = (sessionId: string, mode: AppMode | "menu") =>
  fetch(`${BRAIN_HTTP}/control?sessionId=${encodeURIComponent(sessionId)}&mode=${mode}`, { method: "POST" }).catch(() => {});

const Menu = memo(function Menu({ sessionId }: { sessionId: string }) {
  return (
    <div className="menu-screen">
      <div className="menu-kicker">Where shall we sail?</div>
      <div className="menu-cards">
        {MODES.map((m, i) => (
          <button key={m.id} className="menu-card" style={{ animationDelay: `${i * 140}ms` }} onClick={() => tap(sessionId, m.id)}>
            <span className="menu-num">{i + 1}</span>
            <span className="menu-plate"><img src={`/assets/illustrations/${m.emblem}.png`} alt="" /></span>
            <span className="menu-title">{m.title}</span>
            <span className="menu-blurb">{m.blurb}</span>
            <span className="menu-say">Say &ldquo;{m.say}&rdquo;</span>
          </button>
        ))}
      </div>
    </div>
  );
});

const ModeIntro = memo(function ModeIntro({ mode }: { mode: AppMode }) {
  const m = MODES.find((x) => x.id === mode)!;
  return (
    <div className="mode-intro fade-in">
      <span className="menu-plate big"><img src={`/assets/illustrations/${m.emblem}.png`} alt="" /></span>
      <div>
        <div className="menu-kicker">{m.title}</div>
        <div className="mode-intro-lines">{m.examples.map((e) => <div key={e}>{e}</div>)}</div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------- the Council: an idea from several gods' viewpoints

const BoardView = memo(function BoardView({ board, compact }: { board: Board; compact: boolean }) {
  return (
    <div className={`board ${compact ? "compact" : ""}`}>
      <div className="board-art anim-pop">
        <div className="plate">
          <img src={`/assets/illustrations/${board.illustrationId ?? GOD_EMBLEM[board.viewpoints[0]?.god ?? "athena"]}.png`} alt="" />
        </div>
      </div>
      <div className="board-body">
        <div className="board-kicker">The Council</div>
        <div className="board-title">{board.title}</div>
        {board.subtitle && <div className="board-subtitle">{board.subtitle}</div>}
        <div className="viewpoints">
          {board.viewpoints.map((v, i) => (
            <div key={v.god + i} className="viewpoint" style={{ animationDelay: `${300 + i * 450}ms` }}>
              <img src={`/assets/illustrations/${GOD_EMBLEM[v.god]}.png`} alt="" />
              <div><b>{GOD_NAME[v.god]}</b> {v.stance}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------- Be Odysseus

function Meter({ label, value, max, kind }: { label: string; value: number; max: number; kind: string }) {
  return (
    <div className={`meter ${kind}`}>
      <span>{label}</span>
      <i><em style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></i>
      <b>{value}</b>
    </div>
  );
}

const AdventurePanel = memo(function AdventurePanel({ view }: { view: AdventureView }) {
  return (
    <div className="adventure">
      {view.sceneId && <img className="adv-bg" src={`/assets/scenes/${view.sceneId}.png`} alt="" />}
      <div className="adv-top">
        <div className="adv-badge">Be Odysseus · {view.ending ? "Journey's end" : `${view.step} of ${view.total} · ${view.title}`}</div>
        <div className="adv-stats">
          <Meter label="Crew" value={view.stats.crew} max={60} kind="crew" />
          <Meter label="Poseidon's wrath" value={view.stats.wrath} max={10} kind="wrath" />
          <Meter label="Athena's favour" value={view.stats.favor} max={10} kind="favor" />
        </div>
      </div>
      {view.ending ? (
        <div className="adv-ending fade-in">
          <div className="adv-ending-kicker">Your title</div>
          <div className="adv-ending-title">{view.ending.title}</div>
          <div className="adv-ending-summary">{view.ending.summary}</div>
        </div>
      ) : (
        <>
          <div key={view.title} className="adv-scenario fade-in">{view.scenario}</div>
          <div className="adv-choices">
            {view.choices.map((c) => (
              <div key={view.title + c.key} className={`adv-choice ${view.chosen ? (view.chosen === c.key ? "chosen" : "other") : ""}`}>
                <span className="key">{c.key}</span>
                <span className="label">{c.label}</span>
                {view.homerKey === c.key && <span className="homer">Homer&apos;s Odysseus</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

// ---------------------------------------------------------------- text

const TextPanel = memo(function TextPanel({ highlighted, compact, story = false }: { highlighted: string[]; compact: boolean; story?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const book = highlighted[0] ? Number(highlighted[0].split(".")[0]) : 1;
  const [bookPassages, setBookPassages] = useState<Passage[]>([]);
  useEffect(() => { let live = true; loadBook(book).then((p) => { if (live) setBookPassages(p); }); return () => { live = false; }; }, [book]);
  useEffect(() => {
    // Scroll so the highlight's first line sits near the top (long passages would otherwise start off-screen).
    const el = highlighted[0] ? ref.current?.querySelector<HTMLElement>(`[data-pid="${highlighted[0]}"]`) : null;
    ref.current?.scrollTo({ top: el ? Math.max(0, el.offsetTop - 24) : 0, behavior: el && !document.querySelector(".capture") ? "smooth" : "auto" });
  }, [highlighted, book, bookPassages]);
  return (
    <div className={`text-panel ${compact ? "debate" : ""} ${story ? "story" : ""}`}>
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
});

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
      <br />
      <b>Story</b>{" "}
      {btn("on", { type: "story_mode", active: true, title: "The Wooden Horse" })}
      {btn("off", { type: "story_mode", active: false })}
      {(["trojan-horse", "troy-walls", "cyclops-eye", "siren", "bag-of-winds", "great-wave", "bow", "owl"] as const).map((id, i) =>
        btn(id, { type: "illustration", illustrationId: id, caption: id.replace(/-/g, " "), animation: (["pop", "zoom", "slide", "float"] as const)[i % 4] }))}
      <br />
      <b>Council</b>{" "}
      <button onClick={() => onEvent({ type: "screen", open: false })}>screen off</button>
      <button onClick={() => onEvent({ type: "screen", open: true })}>screen on</button>
      {btn("board", { type: "board", board: { title: "Hubris: pride before the fall", subtitle: "Odysseus shouts his name at the Cyclops", illustrationId: "laurel", viewpoints: [
        { god: "poseidon", stance: "He blinded my son and then bragged of it. Pride asks for the storm that answers it." },
        { god: "athena", stance: "His cunning won the cave; his vanity lost the voyage. Win quietly." },
        { god: "zeus", stance: "Every boast is a debt. Fate collects, sooner or later." }] } })}
      {btn("adventure", { type: "adventure", adventure: { step: 3, total: 9, title: "Escaping the Cyclops", sceneId: "cyclops", scenario: "You are back on the ship, pulling away. The blinded giant stands on the cliff, hurling rocks. Your men beg you to stay quiet.", choices: [{ key: "A", label: "Shout your real name so the world knows who beat him" }, { key: "B", label: "Row away in silence" }, { key: "C", label: "Mock him once more as Noman" }], stats: { crew: 54, wrath: 2, favor: 6 } } })}
      {btn("chose B", { type: "adventure", adventure: { step: 3, total: 9, title: "Escaping the Cyclops", sceneId: "cyclops", scenario: "You are back on the ship, pulling away. The blinded giant stands on the cliff, hurling rocks. Your men beg you to stay quiet.", choices: [{ key: "A", label: "Shout your real name so the world knows who beat him" }, { key: "B", label: "Row away in silence" }, { key: "C", label: "Mock him once more as Noman" }], stats: { crew: 54, wrath: 2, favor: 8 }, chosen: "B", homerKey: "A" } })}
      {btn("ending", { type: "adventure", adventure: { step: 9, total: 9, title: "Home to Ithaca", scenario: "", choices: [], stats: { crew: 41, wrath: 3, favor: 9 }, ending: { title: "The Patient Captain", summary: "You chose as Homer's Odysseus did 4 of 9 times. You reach Ithaca with 41 of 60 men (he arrived alone)." } } })}
      <br />
      <b>Gesture</b>{" "}
      {(["none", "point", "open", "raise", "heart", "think"] as const).map((g) =>
        (["athena", "odysseus", "poseidon"] as const).map((c) => btn(`${c.slice(0, 3)} ${g}`, { type: "gesture", character: c, gesture: g })))}
    </div>
  );
}
