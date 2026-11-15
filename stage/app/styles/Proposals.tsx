"use client";
// Compare AI-generated art-style proposals (assets/tools/style-proposals.mjs) side by side and pick one.
import { useEffect, useState } from "react";

type Manifest = {
  generatedAt: string;
  styles: { id: string; label: string; blurb: string }[];
  subjects: string[];
  images: { style: string; subject: string; file: string; model: string }[];
};

export default function Proposals() {
  const [m, setM] = useState<Manifest | null>(null);
  const [missing, setMissing] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/assets/style-proposals/manifest.json?v=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setM)
      .catch(() => setMissing(true));
    try { setPick(localStorage.getItem("style-pick")); } catch { /* storage unavailable */ }
  }, []);

  const choose = (id: string) => { setPick(id); try { localStorage.setItem("style-pick", id); } catch { /* ignore */ } };
  const img = (style: string, subject: string) => m?.images.find((i) => i.style === style && i.subject === subject);

  return (
    <main className="proposals">
      <header>
        <h1>Art style proposals</h1>
        <p>The same two pictures (Athena and the Sirens) in each style. Click a picture to see it large; mark the one you like.</p>
      </header>
      {missing && <p className="empty">No proposals yet. Run <code>node --env-file=.env assets/tools/style-proposals.mjs</code> (Gemini image generation needs billing enabled on the API key).</p>}
      {m?.styles.map((s) => (
        <section key={s.id} className={`proposal ${pick === s.id ? "picked" : ""}`}>
          <div className="proposal-head">
            <h2>{s.label} {pick === s.id && <span className="badge">your pick</span>}</h2>
            <p>{s.blurb}</p>
            <button onClick={() => choose(s.id)}>{pick === s.id ? "Picked" : "I like this one"}</button>
          </div>
          <div className="proposal-images">
            {m.subjects.map((sub) => {
              const i = img(s.id, sub);
              return i ? (
                <button key={sub} className={`thumb ${sub}`} onClick={() => setZoom(i.file)}>
                  <img src={`/assets/style-proposals/${i.file}`} alt={`${s.label}: ${sub}`} />
                </button>
              ) : (
                <div key={sub} className={`thumb ${sub} failed`}>not generated</div>
              );
            })}
          </div>
        </section>
      ))}
      {zoom && (
        <div className="zoom" onClick={() => setZoom(null)}>
          <img src={`/assets/style-proposals/${zoom}`} alt="" />
        </div>
      )}
    </main>
  );
}
