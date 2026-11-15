"use client";
// The style switcher: pick the art style every stage shows (calls included). Brain keeps the choice
// (GET/POST {BRAIN}/style) and pushes it to all open stages, so a switch shows up within a second.
import { useCallback, useEffect, useState } from "react";

const BRAIN_HTTP = (process.env.NEXT_PUBLIC_BRAIN_WS ?? "ws://localhost:8080").replace(/^ws/, "http");

type Manifest = { id: string; label: string; blurb: string; characters: string[]; scenes: string[]; illustrations: string[]; ready: number; total: number };
const VECTOR: Manifest = { id: "vector", label: "Original drawn art", blurb: "The hand-drawn red-figure look the app started with. Always complete.", characters: [], scenes: [], illustrations: [], ready: 1, total: 1 };

const preview = (m: Manifest, what: "athena" | "sirens") =>
  m.id === "vector"
    ? what === "athena" ? "/assets/characters/athena/body.png" : "/assets/scenes/sirens.png"
    : what === "athena" ? `/style-assets/${m.id}/characters/athena.jpg` : `/style-assets/${m.id}/scenes/sirens.jpg`;

export default function StyleSwitcher() {
  const [current, setCurrent] = useState<string | null>(null);
  const [styles, setStyles] = useState<Manifest[]>([VECTOR]);
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = (await fetch(`${BRAIN_HTTP}/style`, { cache: "no-store" }).then((x) => x.json())) as { style: string; available: string[] };
      setCurrent(r.style);
      const ms = await Promise.all(
        r.available.filter((s) => s !== "vector").map((s) => fetch(`/style-assets/${s}/manifest.json`, { cache: "no-store" }).then((x) => x.json() as Promise<Manifest>).catch(() => null)),
      );
      setStyles([VECTOR, ...ms.filter((m): m is Manifest => !!m)]);
      setError(null);
    } catch {
      setError("Can't reach Brain. Is it running on port 8080?");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 4000); // picks up styles as their images finish generating
    return () => clearInterval(t);
  }, [refresh]);

  const use = async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch(`${BRAIN_HTTP}/style?name=${encodeURIComponent(id)}`, { method: "POST" });
      if (r.ok) setCurrent(id); else setError(`Couldn't switch to ${id}`);
    } finally { setBusy(null); }
  };

  return (
    <main className="proposals">
      <header>
        <h1>Art style</h1>
        <p>Pick the look for the stage. The switch reaches every open stage, including a FaceTime call in progress, within a second.</p>
        <p className="fine"><a href="/stage?sessionId=style-preview" target="_blank" rel="noreferrer">Open a stage preview</a> to watch it change.</p>
        {error && <p className="error">{error}</p>}
      </header>
      {styles.map((m) => {
        const live = current === m.id;
        const complete = m.ready >= m.total;
        return (
          <section key={m.id} className={`proposal ${live ? "picked" : ""}`}>
            <div className="proposal-head">
              <h2>{m.label} {live && <span className="badge">live now</span>}</h2>
              <p>{m.blurb}</p>
              {m.id !== "vector" && <p className="fine">{complete ? `All ${m.total} pictures ready` : `${m.ready} of ${m.total} pictures ready (missing ones use the original art)`}</p>}
              <button disabled={live || busy === m.id} onClick={() => use(m.id)}>
                {live ? "In use" : busy === m.id ? "Switching…" : "Use this style"}
              </button>
            </div>
            <div className="proposal-images">
              {(["athena", "sirens"] as const).map((w) => (
                <button key={w} className={`thumb ${w}`} onClick={() => setZoom(preview(m, w))}>
                  <img src={preview(m, w)} alt={`${m.label}: ${w}`} />
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {zoom && (
        <div className="zoom" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
        </div>
      )}
    </main>
  );
}
