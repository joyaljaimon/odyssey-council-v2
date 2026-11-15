// "Be Odysseus": the user makes Odysseus' choices at the decision points in story/data/adventure.json.
// The engine is deterministic (effects, stats, ending); the model narrates it.
import type { AdventureStats, AdventureView } from "@odyssey/contracts";
import { adventure } from "@odyssey/story";
import type { Session } from "./session.ts";

export type AdventureState = {
  step: number; // index of the current decision point
  stats: AdventureStats;
  virtues: Record<string, number>;
  picks: { node: string; key: string; homer: string }[];
};

const clamp = (n: number) => Math.max(0, Math.min(10, n));

export function viewOf(st: AdventureState, extra: Partial<AdventureView> = {}): AdventureView {
  const node = adventure.nodes[Math.min(st.step, adventure.nodes.length - 1)];
  return {
    step: Math.min(st.step + 1, adventure.nodes.length),
    total: adventure.nodes.length,
    title: node.title,
    scenario: node.scenario,
    sceneId: node.sceneId,
    choices: node.choices.map((c) => ({ key: c.key, label: c.label })),
    stats: { ...st.stats },
    ...extra,
  };
}

const nodeForModel = (st: AdventureState) => {
  const node = adventure.nodes[st.step];
  return {
    step: st.step + 1,
    of: adventure.nodes.length,
    title: node.title,
    scenario: node.scenario,
    choices: node.choices.map((c) => ({ key: c.key, label: c.label })),
    scene_id: node.sceneId,
  };
};

export function startAdventure(s: Session) {
  s.adventure = { step: 0, stats: { ...adventure.start }, virtues: {}, picks: [] };
  return { view: viewOf(s.adventure), forModel: { started: true, stats: s.adventure.stats, decision: nodeForModel(s.adventure) } };
}

export function choose(s: Session, key: string) {
  const st = s.adventure;
  if (!st) return { error: "No adventure in progress; call start_adventure first." };
  const node = adventure.nodes[st.step];
  const choice = node.choices.find((c) => c.key === key.trim().toUpperCase());
  if (!choice) return { error: `Choice must be one of ${node.choices.map((c) => c.key).join(", ")}` };

  const before = { ...st.stats };
  st.stats.crew = Math.max(0, st.stats.crew + choice.effects.crew);
  st.stats.wrath = clamp(st.stats.wrath + choice.effects.wrath);
  st.stats.favor = clamp(st.stats.favor + choice.effects.favor);
  st.virtues[choice.virtue] = (st.virtues[choice.virtue] ?? 0) + 1;
  st.picks.push({ node: node.id, key: choice.key, homer: node.homer.key });
  const chosenView = viewOf(st, { chosen: choice.key, homerKey: node.homer.key });
  st.step++;

  const result = {
    your_choice: { key: choice.key, label: choice.label, outcome: choice.outcome, virtue: choice.virtue },
    homer: { choice: node.homer.key, what_he_did: node.homer.text, quote: { passage_id: node.homer.quote.passageId, text: node.homer.quote.text } },
    same_as_homer: choice.key === node.homer.key,
    stats: { before, after: { ...st.stats } },
    highlight: [node.homer.quote.passageId],
  };

  if (st.step >= adventure.nodes.length) {
    const ending = endingOf(st);
    s.adventure = undefined;
    return { ...result, ending, chosenView, nextView: { ...chosenView, chosen: undefined, homerKey: undefined, choices: [], ending } as AdventureView };
  }
  return { ...result, next_decision: nodeForModel(st), chosenView, nextView: viewOf(st) };
}

function endingOf(st: AdventureState) {
  const [top] = Object.entries(st.virtues).sort((a, b) => b[1] - a[1]);
  const title = adventure.virtues[top?.[0] ?? "wisdom"];
  const sameAsHomer = st.picks.filter((p) => p.key === p.homer).length;
  const summary =
    `You chose as Homer's Odysseus did ${sameAsHomer} of ${st.picks.length} times. ` +
    `You reach Ithaca with ${st.stats.crew} of 60 men${st.stats.crew === 0 ? ", alone, as he did" : ` (he arrived alone)`}; ` +
    `Poseidon's wrath ${st.stats.wrath}/10, Athena's favour ${st.stats.favor}/10. ${adventure.homerEnding}`;
  return { title, summary };
}
