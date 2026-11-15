// Runs the tools declared in contracts/tools.json. Shared by text and voice mode.
import type { FunctionDeclaration } from "@google/genai";
import { APP_MODES, GESTURES, type AppMode, type Attachment, type CharacterId, type Gesture, type StageEvent } from "@odyssey/contracts";
import toolsJson from "@odyssey/contracts/tools.json" with { type: "json" };
import { episodes, findEpisodeSemantic, findMoment, getEpisode, getMoment, getPassage, illustrations, searchSemantic } from "@odyssey/story";
import type { Session } from "./session.ts";
import { choose, startAdventure } from "./adventure.ts";

export const functionDeclarations = toolsJson.tools as unknown as FunctionDeclaration[];

// Each mode only gets its own tools (the start menu only gets choose_mode), so the model stays on task.
// switch_character is in every mode: the user can ask for any character at any time.
const MODE_TOOLS: Record<AppMode | "menu", string[]> = {
  menu: ["choose_mode", "switch_character"],
  life: ["choose_mode", "switch_character", "find_episode", "search_odyssey", "highlight_passage", "show_scene", "show_map", "gesture", "end_session"],
  philosophy: ["choose_mode", "explain_idea", "find_moment", "set_story_mode", "show_illustration", "gesture", "highlight_passage",
    "search_odyssey", "find_episode", "show_scene", "show_map", "switch_character", "start_debate", "end_session"],
  odysseus: ["choose_mode", "switch_character", "start_adventure", "choose", "end_adventure", "highlight_passage", "gesture", "end_session"],
};
export const toolsFor = (mode: AppMode | undefined) =>
  functionDeclarations.filter((f) => MODE_TOOLS[mode ?? "menu"].includes(f.name ?? ""));

const CHARACTERS: CharacterId[] = ["athena", "odysseus", "poseidon", "circe"];
const sceneIds = new Set(episodes.map((e) => e.sceneId));
const locationIds = new Set(episodes.map((e) => e.locationId).concat("troy"));

export const publicBase = () => process.env.PUBLIC_BASE_URL || process.env.STAGE_URL || "http://localhost:3000";
export const sceneUrl = (sceneId: string) => `${publicBase()}/assets/scenes/${sceneId}.png`;
export const illustrationUrl = (id: string) => `${publicBase()}/assets/illustrations/${id}.png`;
const illustrationIds = new Set(illustrations.map((i) => i.id));
export const cardUrl = (sessionId: string) => `${publicBase()}/card?sessionId=${encodeURIComponent(sessionId)}`;

export type ToolOutcome = {
  response: Record<string, unknown>; // goes back to the model
  events: StageEvent[];
  attachments: Attachment[];
  switchTo?: CharacterId;
  debateTopic?: string;
  ended?: boolean;
  later?: StageEvent[]; // shown a few seconds later on a call (e.g. the next decision after the outcome is told)
  modeChanged?: boolean; // the prompt and tools must be rebuilt for the new mode
};

const GODS = ["athena", "poseidon", "zeus", "hermes", "helios", "circe", "calypso", "odysseus"];

/** Switch mode: reset whatever the previous mode left on the stage, then announce the new one. */
export function modeEvents(s: Session, mode: AppMode | undefined): StageEvent[] {
  s.mode = mode;
  if (mode !== "odysseus") s.adventure = undefined;
  s.story = undefined;
  return [
    { type: "board", board: null },
    { type: "adventure", adventure: null },
    { type: "story_mode", active: false },
    { type: "illustration", illustrationId: null },
    { type: "gesture", character: s.character, gesture: "none" },
    { type: "mode", mode: mode ?? null },
  ];
}

export async function runTool(s: Session, name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  const out: ToolOutcome = { response: {}, events: [], attachments: [] };
  const str = (k: string) => String(args[k] ?? "").trim();

  switch (name) {
    case "choose_mode": {
      const m = str("mode");
      const next = (APP_MODES as readonly string[]).includes(m) ? (m as AppMode) : undefined;
      if (m !== "menu" && !next) { out.response = { ok: false, error: "mode must be odysseus, philosophy, life or menu" }; break; }
      if (next === s.mode) {
        // Already there: never restart (on a call a restart reopens the Live session, which would loop).
        out.response = { ok: true, mode: next ?? "menu", note: "You are already in this mode. Carry on with it; do not call choose_mode again." };
        break;
      }
      out.events.push(...modeEvents(s, next));
      out.modeChanged = true;
      out.response = { ok: true, mode: next ?? "menu", note: next ? `Now in ${next} mode: start it right away.` : "Back at the three choices: offer them again." };
      break;
    }
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
      out.events.push({ type: "board", board: null }, { type: "scene", sceneId: id });
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
      if (c === s.character) { out.response = { ok: true, note: `You are already ${c}. Don't call switch_character; just answer the user.` }; break; }
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
    // ---- Story Mode (contract v3)
    case "find_moment": {
      const found = findMoment(str("query"), 3);
      out.response = {
        moments: found.map((m) => ({
          id: m.id,
          title: m.title,
          tellers: m.tellers,
          summary: m.summary,
          beats: m.beats.map((b) => ({
            illustration_id: b.illustrationId,
            gesture: b.gesture,
            passage_ids: b.passageIds,
            caption: b.caption,
            quote: { passage_id: b.quote.passageId, text: b.quote.text },
          })),
        })),
        note: found.length
          ? "Pick the moment that matches. Tell it beat by beat: for each beat call show_illustration, gesture and highlight_passage, then speak 1-2 sentences, quoting the beat's quote exactly."
          : "No prepared moment matches: use search_odyssey for passages and tell it without illustrations.",
      };
      break;
    }
    case "set_story_mode": {
      const active = args.active === true || args.active === "true";
      const moment = active ? getMoment(str("moment_id")) : undefined;
      s.story = active ? { momentId: moment?.id } : undefined;
      out.events.push({ type: "board", board: null }, { type: "story_mode", active, title: moment?.title });
      // Put the first beat up straight away, so the screen changes the moment the telling starts.
      const first = moment?.beats[0];
      if (active && first) {
        out.events.push(
          { type: "illustration", illustrationId: first.illustrationId, caption: first.caption, animation: "pop" },
          { type: "gesture", character: s.character, gesture: first.gesture },
          { type: "highlight", passageIds: first.passageIds },
        );
      }
      if (!active) out.events.push({ type: "illustration", illustrationId: null }, { type: "gesture", character: s.character, gesture: "none" });
      out.response = { ok: true, story_mode: active };
      break;
    }
    case "show_illustration": {
      const id = str("illustration_id");
      if (!illustrationIds.has(id)) { out.response = { ok: false, error: `unknown illustration_id; use one of ${[...illustrationIds].join(", ")}` }; break; }
      const caption = str("caption") || illustrations.find((i) => i.id === id)?.title;
      out.events.push({ type: "illustration", illustrationId: id, caption, animation: "pop" });
      out.attachments.push({ kind: "image", url: illustrationUrl(id), alt: caption ?? id });
      out.response = { ok: true };
      break;
    }
    case "gesture": {
      const g = str("gesture") as Gesture;
      if (!(GESTURES as readonly string[]).includes(g)) { out.response = { ok: false, error: `gesture must be one of ${GESTURES.join(", ")}` }; break; }
      out.events.push({ type: "gesture", character: s.character, gesture: g });
      out.response = { ok: true };
      break;
    }
    // ---- The Council (contract v4)
    case "explain_idea": {
      const title = str("title");
      const raw = Array.isArray(args.viewpoints) ? (args.viewpoints as { god?: string; stance?: string }[]) : [];
      const viewpoints = raw
        .filter((v) => v && GODS.includes(String(v.god)) && String(v.stance ?? "").trim())
        .slice(0, 3)
        .map((v) => ({ god: v.god as (typeof GODS)[number] as never, stance: String(v.stance).trim().slice(0, 160) }));
      if (!title || !viewpoints.length) { out.response = { ok: false, error: "title and at least one viewpoint {god, stance} are required" }; break; }
      const ill = str("illustration_id");
      const illustrationId = illustrationIds.has(ill) ? ill : undefined;
      out.events.push({ type: "screen", open: true }, { type: "board", board: { title, subtitle: str("subtitle") || undefined, illustrationId, viewpoints } });
      const pids = (Array.isArray(args.passage_ids) ? args.passage_ids.map(String) : []).filter((id) => getPassage(id));
      if (pids.length) out.events.push({ type: "highlight", passageIds: pids });
      if (illustrationId) out.attachments.push({ kind: "image", url: illustrationUrl(illustrationId), alt: title });
      out.response = { ok: true, shown: { title, viewpoints: viewpoints.length, illustration: illustrationId ?? null }, ...(ill && !illustrationId ? { note: `unknown illustration_id ${ill}` } : {}) };
      break;
    }
    // ---- Be Odysseus (contract v4)
    case "start_adventure": {
      const { view, forModel } = startAdventure(s);
      out.events.push({ type: "screen", open: true }, { type: "board", board: null }, { type: "adventure", adventure: view });
      out.response = { ok: true, ...forModel, note: "Set the scene in the second person, then read the choices A, B, C. Wait for the user's pick." };
      break;
    }
    case "choose": {
      const r = choose(s, str("choice"));
      if ("error" in r) { out.response = { ok: false, error: r.error }; break; }
      out.events.push({ type: "adventure", adventure: r.chosenView }, { type: "highlight", passageIds: r.highlight });
      out.later = [{ type: "adventure", adventure: r.nextView }];
      const { chosenView: _c, nextView: _n, ...forModel } = r;
      out.response = { ok: true, ...forModel };
      break;
    }
    case "end_adventure": {
      s.adventure = undefined;
      out.events.push({ type: "adventure", adventure: null });
      out.response = { ok: true };
      break;
    }
    default:
      out.response = { ok: false, error: `unknown tool ${name}` };
  }
  return out;
}
