// GET /card?sessionId=... -> "Your Odyssey" summary card PNG (1080x1350) that Channel texts at the end.
// Reads the session from Brain (GET {BRAIN_URL}/session). Unknown sessions get the template's example card.
import { ImageResponse } from "next/og";
import type { Episode, SessionSummary } from "@odyssey/contracts";
import episodesJson from "@odyssey/story/data/episodes.json";
import template from "@odyssey/story/data/ithaca-template.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const episodes = episodesJson as Episode[];
const BRAIN_URL = process.env.BRAIN_URL ?? "http://localhost:8080";
const C = { glaze: "#17110d", clay: "#c8693a", paper: "#f4ecdc", gold: "#e8c15a", dim: "#bfae94" };

async function loadSummary(sessionId: string | null): Promise<SessionSummary | null> {
  if (!sessionId) return null;
  try {
    const res = await fetch(`${BRAIN_URL}/session?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as SessionSummary) : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = await loadSummary(url.searchParams.get("sessionId"));
  const ex = template.example;
  const episode = episodes.find((e) => e.id === s?.episodeId) ?? episodes.find((e) => e.title === ex.episode)!;
  const quote = s?.quote ?? episode.keyQuotes[0];
  const lesson = s?.lesson ?? (s ? episode.lessons[0] : ex.lesson);
  const takeaway = s?.takeaway ?? `${ex.lesson} This week: ${ex.action}`;
  const problem = s?.problem ?? ex.problem;
  const origin = process.env.PUBLIC_BASE_URL || url.origin;

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, display: "flex", flexDirection: "column", background: C.glaze, color: C.paper, fontFamily: "serif" }}>
        <div style={{ height: 18, background: C.clay, display: "flex" }} />
        <img src={`${origin}/assets/scenes/${episode.sceneId}.png`} width={1080} height={608} style={{ objectFit: "cover" }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "40px 72px", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: C.clay, textTransform: "uppercase" }}>Your Odyssey · {episode.title}</div>
          <div style={{ display: "flex", fontSize: 30, color: C.dim, marginTop: 14, fontStyle: "italic" }}>“{problem}”</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 26, paddingLeft: 26, borderLeft: `6px solid ${C.gold}` }}>
            <div style={{ display: "flex", fontSize: 32, lineHeight: 1.35 }}>“{quote.text}”</div>
            <div style={{ display: "flex", fontSize: 22, color: C.gold, marginTop: 8 }}>Odyssey {quote.passageId} · Samuel Butler&apos;s translation</div>
          </div>
          {lesson && !takeaway.startsWith(lesson) && (
            <div style={{ display: "flex", fontSize: 30, marginTop: 26, lineHeight: 1.35 }}>{lesson}</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", background: C.paper, color: C.glaze, borderRadius: 18, padding: "26px 32px" }}>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 5, color: C.clay, textTransform: "uppercase" }}>Your Ithaca</div>
            <div style={{ display: "flex", fontSize: 34, lineHeight: 1.3, marginTop: 8 }}>{takeaway}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: C.dim, marginTop: 22 }}>
            <span>Every great solution begins with an Odyssey.</span>
            <span>AI characters · Homer&apos;s Odyssey</span>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "cache-control": "no-store" } },
  );
}
