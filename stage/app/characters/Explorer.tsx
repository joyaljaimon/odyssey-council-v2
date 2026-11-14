"use client";
// Character style explorer: every style x every character, drawn live from assets/tools/characters.mjs
// (the same code generate.mjs renders to PNG). Talk, blink and gesture to judge each style in motion.
import { useEffect, useState } from "react";

type Style = { label: string; blurb: string };
type Art = {
  STYLES: Record<string, Style>;
  STYLE_IDS: string[];
  GESTURE_IDS: string[];
  characterIds: string[];
  characterSvg: (id: string, style: string, o: { mouth?: number; blink?: boolean; gesture?: string }) => string;
};
const NAMES: Record<string, string> = { athena: "Athena", odysseus: "Odysseus", poseidon: "Poseidon", circe: "Circe" };

export default function Explorer() {
  const [art, setArt] = useState<Art | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [talking, setTalking] = useState(true);
  const [gesture, setGesture] = useState("none");
  const [dark, setDark] = useState(false);
  const [mouth, setMouth] = useState(0);
  const [blink, setBlink] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    // Loaded at runtime from /assets (the stage/public/assets symlink), not bundled, so edits show on reload.
    import(/* webpackIgnore: true */ `/assets/tools/characters.mjs?v=${Date.now()}`).then((m) => setArt(m as Art)).catch(console.error);
    fetch("/assets/characters/style.json").then((r) => r.json()).then((j) => setCurrent(j.style)).catch(() => setCurrent("red-figure"));
  }, []);

  useEffect(() => {
    if (!talking) { setMouth(0); return; }
    let t = 0;
    const id = setInterval(() => {
      t += 110;
      const level = Math.abs(Math.sin(t / 160)) * (0.5 + 0.5 * Math.abs(Math.sin(t / 530)));
      setMouth(level < 0.1 ? 0 : level < 0.3 ? 1 : level < 0.6 ? 2 : 3);
    }, 110);
    return () => clearInterval(id);
  }, [talking]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); loop(); }, 2200 + Math.random() * 2500); };
    loop();
    return () => clearTimeout(t);
  }, []);

  const copy = (style: string) => {
    const cmd = `npm run art -w stage -- --use ${style} --only characters`;
    navigator.clipboard?.writeText(cmd).then(() => { setCopied(style); setTimeout(() => setCopied(null), 1800); }).catch(() => {});
  };

  return (
    <main className={`explorer ${dark ? "dark" : ""}`}>
      <header>
        <h1>Character styles</h1>
        <p>Every style, drawn live from the same code that makes the stage art. Watch them talk and gesture, then pick one.</p>
        <div className="controls">
          <button className={talking ? "on" : ""} onClick={() => setTalking((x) => !x)}>{talking ? "■ Stop talking" : "▶ Talk"}</button>
          <span className="sep" />
          {["none", ...(art?.GESTURE_IDS ?? [])].map((g) => (
            <button key={g} className={gesture === g ? "on" : ""} onClick={() => setGesture(g)}>{g === "none" ? "No gesture" : g}</button>
          ))}
          <span className="sep" />
          <button onClick={() => setDark((x) => !x)}>{dark ? "Light background" : "Dark background"}</button>
        </div>
      </header>

      {!art && <p className="loading">Loading styles…</p>}
      {art?.STYLE_IDS.map((style) => (
        <section key={style} className={`row ${current === style ? "current" : ""}`}>
          <div className="row-head">
            <h2>{art.STYLES[style].label} {current === style && <span className="badge">in use</span>}</h2>
            <p>{art.STYLES[style].blurb}</p>
            {current !== style && (
              <button className="use" onClick={() => copy(style)}>{copied === style ? "Command copied" : "Use this style"}</button>
            )}
            <code>npm run art -w stage -- --use {style} --only characters</code>
          </div>
          <div className="cast">
            {art.characterIds.map((id) => (
              <figure key={id}>
                <div className="portrait" dangerouslySetInnerHTML={{ __html: art.characterSvg(id, style, { mouth, blink, gesture }) }} />
                <figcaption>{NAMES[id]}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      <footer>
        To switch: run the command for your style in the repo root, then reload the stage. The choice is saved in
        <code> assets/characters/style.json</code>. Scenes and story illustrations stay in the vase style.
      </footer>
    </main>
  );
}
