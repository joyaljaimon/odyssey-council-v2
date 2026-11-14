// Runs the tools declared in contracts/tools.json. Shared by text and voice mode.
import type { FunctionDeclaration } from "@google/genai";
import type { Attachment, CharacterId, StageEvent } from "@odyssey/contracts";
import toolsJson from "@odyssey/contracts/tools.json" with { type: "json" };
import { episodes, findEpisodeSemantic, getEpisode, getPassage, searchSemantic } from "@odyssey/story";
import type { Session } from "./session.ts";

export const functionDeclarations = toolsJson.tools as unknown as FunctionDeclaration[];

const CHARACTERS: CharacterId[] = ["athena", "odysseus", "poseidon", "circe"];
const sceneIds = new Set(episodes.map((e) => e.sceneId));
const locationIds = new Set(episodes.map((e) => e.locationId).concat("troy"));

export const publicBase = () => process.env.PUBLIC_BASE_URL || process.env.STAGE_URL || "http://localhost:3000";
export const sceneUrl = (sceneId: string) => `${publicBase()}/assets/scenes/${sceneId}.png`;
export const cardUrl = (sessionId: string) => `${publicBase()}/card?sessionId=${encodeURIComponent(sessionId)}`;

export type ToolOutcome = {
  response: Record<string, unknown>; // goes back to the model
  events: StageEvent[];
  attachments: Attachment[];
  switchTo?: CharacterId;
  debateTopic?: string;
  ended?: boolean;
};

export async function runTool(s: Session, name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  const out: ToolOutcome = { response: {}, events: [], attachments: [] };
  const str = (k: string) => String(args[k] ?? "").trim();

  switch (name) {
    case "find_episode": {
      const problem = str("problem");
      s.summary.problem ??= problem;
      const found = await findEpisodeSemantic(problem, 3);
      out.response = {
        episodes: found.map((e) => ({
          id: e.id,
          title: e.title,
          summary: e.summary,
          lessons: e.lessons,
          scene_id: e.sceneId,
          location_id: e.locationId,
          key_quotes: e.keyQuotes.map((q) => ({ passage_id: q.passageId, text: q.text })),
        })),
        note: "Pick the best fit. Quote only key_quotes text exactly, with its passage_id.",
      };
      if (found[0]) s.summary.episodeId ??= found[0].id;
      break;
    }
    case "search_odyssey": {
      const found = await searchSemantic(str("query"), 4);
      out.response = { passages: found.map((p) => ({ passage_id: p.id, text: p.text.slice(0, 700) })) };
      break;
    }
    case "highlight_passage": {
      const raw = Array.isArray(args.passage_ids) ? args.passage_ids.map(String) : [];
      const ids = raw.filter((id) => getPassage(id));
      if (ids.length) {
        out.events.push({ type: "highlight", passageIds: ids });
        // Remember the first highlighted key quote for the summary card.
        const ep = s.summary.episodeId ? getEpisode(s.summary.episodeId) : undefined;
        const q = ep?.keyQuotes.find((k) => ids.includes(k.passageId)) ??
          episodes.flatMap((e) => e.keyQuotes).find((k) => ids.includes(k.passageId));
        if (q) s.summary.quote = q;
      }
      out.response = ids.length ? { ok: true, highlighted: ids } : { ok: false, error: `unknown passage ids ${raw.join(", ")}` };
      break;
    }
    case "show_scene": {
      const id = str("scene_id");
      if (!sceneIds.has(id)) { out.response = { ok: false, error: `unknown scene_id; use one of ${[...sceneIds].join(", ")}` }; break; }
      out.events.push({ type: "scene", sceneId: id });
      const ep = episodes.find((e) => e.sceneId === id);
      out.attachments.push({ kind: "image", url: sceneUrl(id), alt: ep?.title ?? id });
      if (ep) s.summary.episodeId = ep.id;
      out.response = { ok: true };
      break;
    }
    case "show_map": {
      const id = str("location_id");
      if (!locationIds.has(id)) { out.response = { ok: false, error: `unknown location_id; use one of ${[...locationIds].join(", ")}` }; break; }
      out.events.push({ type: "map", locationId: id });
      out.response = { ok: true };
      break;
    }
    case "switch_character": {
      const c = str("character") as CharacterId;
      if (!CHARACTERS.includes(c)) { out.response = { ok: false, error: "unknown character" }; break; }
      out.switchTo = c;
      out.response = { ok: true, note: `${c} takes over after your current sentence. Say a one-line goodbye.` };
      break;
    }
    case "start_debate": {
      out.debateTopic = str("topic") || s.summary.problem || "What should I do?";
      out.response = { ok: true, note: "The debate starts after your current sentence. Introduce it in one line." };
      break;
    }
    case "end_session": {
      const takeaway = str("takeaway");
      const action = str("action");
      s.summary.takeaway = action && !takeaway.includes(action) ? `${takeaway} This week: ${action}` : takeaway;
      const ep = s.summary.episodeId ? getEpisode(s.summary.episodeId) : undefined;
      s.summary.lesson ??= ep?.lessons[0];
      s.summary.quote ??= ep?.keyQuotes[0];
      s.summary.ended = true;
      out.ended = true;
      out.attachments.push({ kind: "image", url: cardUrl(s.id), alt: "Your Odyssey summary card" });
      out.events.push({ type: "caption", text: `Your Ithaca: ${s.summary.takeaway}` });
      out.response = { ok: true, card_url: cardUrl(s.id), note: "Say the takeaway and a warm goodbye." };
      break;
    }
    default:
      out.response = { ok: false, error: `unknown tool ${name}` };
  }
  return out;
}
