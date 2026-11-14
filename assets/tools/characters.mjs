// Character art in several styles, drawn as SVG (720 x 1000, transparent). No Node imports: the /characters
// explorer page loads this file in the browser, and generate.mjs renders the chosen style to PNG.
//
// Layers (all the same canvas, stacked): body, mouth-0..3, blink, gesture-<name>.
// Face centre (360, 430); mouth centre (360, 560).

const CLAY = "#c8693a", CLAY_DARK = "#9c4a24", INK = "#1b1410", CREAM = "#f1dfc0", GOLD = "#e8c15a";

/** A style: palette and proportions. Functions of the character id allow per-character colours. */
export const STYLES = {
  "red-figure": {
    label: "Red-figure vase",
    blurb: "Terracotta figures with black outlines, like Athenian vases. The current look; matches the scenes.",
    skin: () => CLAY, shade: CLAY_DARK, line: INK, hair: () => INK, curl: CLAY_DARK,
    cloth: () => CLAY, cloth2: () => CLAY_DARK, accent: GOLD, cream: CREAM, pupil: INK,
    lips: "#a3442a", mouthIn: INK, tongue: "#b4473a", lw: 1, eye: 1, face: [148, 185], cheeks: null, shine: false,
  },
  "black-figure": {
    label: "Black-figure vase",
    blurb: "Older vase style: black silhouettes with incised clay-coloured details; goddesses painted white.",
    skin: (id) => (id === "athena" || id === "circe" ? "#efe4cf" : INK), shade: "#7a2e1c", line: "#2a1a10",
    hair: () => INK, curl: CLAY, cloth: () => INK, cloth2: () => "#7a2e1c", accent: GOLD, cream: "#efe4cf", pupil: INK,
    lips: "#7a2e1c", mouthIn: "#3a0f08", tongue: "#8a2e22", lw: 1, eye: 1, face: [148, 185], cheeks: null, shine: false,
    incised: CLAY,
  },
  marble: {
    label: "Marble statue",
    blurb: "Pale sculpted stone with soft grey shading and gilded details, like a museum statue.",
    skin: () => "#ece8e1", shade: "#bdb6ab", line: "#6f6a63", hair: () => "#d6d0c5", curl: "#b3ab9f",
    cloth: () => "#e4dfd7", cloth2: () => "#c9c2b6", accent: "#c9a646", cream: "#f8f6f2", pupil: "#a39b8f",
    lips: "#c4b2a6", mouthIn: "#5f5a53", tongue: "#a88f86", lw: 0.8, eye: 0.9, face: [146, 186], cheeks: null, shine: false,
  },
  fresco: {
    label: "Minoan fresco",
    blurb: "Bright wall-painting colours from Knossos: ochre and pale skin, deep blue and red cloth.",
    skin: (id) => (id === "athena" || id === "circe" ? "#f0d3ad" : "#b8642f"), shade: "#8a4421", line: "#3b2414",
    hair: () => "#1d1410", curl: "#4a3020",
    cloth: (id) => ({ athena: "#e9dcc0", odysseus: "#2e6f95", poseidon: "#1f5f7a", circe: "#c23b22" })[id],
    cloth2: (id) => ({ athena: "#2e6f95", odysseus: "#c23b22", poseidon: "#e2b33c", circe: "#2e6f95" })[id],
    accent: "#e2b33c", cream: "#f6ead2", pupil: "#1d1410", lips: "#a33a2a", mouthIn: "#3b1410", tongue: "#c4574a",
    lw: 0.7, eye: 1.05, face: [146, 184], cheeks: null, shine: false,
  },
  storybook: {
    label: "Storybook",
    blurb: "Friendly modern cartoon: rounder faces, big shiny eyes, rosy cheeks, a colour per character.",
    skin: () => "#f1c19a", shade: "#d99a74", line: "#4a3426",
    hair: (id) => ({ athena: "#3b2a20", odysseus: "#5b3a24", poseidon: "#2f5d78", circe: "#6b2d5c" })[id], curl: "#00000033",
    cloth: (id) => ({ athena: "#e9dcc0", odysseus: "#5f7f4f", poseidon: "#2a7f9e", circe: "#8e3b7e" })[id],
    cloth2: (id) => ({ athena: "#c9b48a", odysseus: "#8a5a32", poseidon: "#1d5a72", circe: "#5e2553" })[id],
    accent: "#f2b632", cream: "#fffaf0", pupil: "#2b1d16", lips: "#c2574a", mouthIn: "#5a2620", tongue: "#e07a6c",
    lw: 0.75, eye: 1.35, face: [160, 176], cheeks: "#f19b8a", shine: true,
  },
};
export const STYLE_IDS = Object.keys(STYLES);
export const DEFAULT_STYLE = "red-figure";
export const GESTURE_IDS = ["point", "open", "raise", "heart", "think"];

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1000" viewBox="0 0 720 1000">${body}</svg>`;
const MOUTH = { x: 360, y: 560 };

/** Everything that depends on the style and character, as one closure. */
function painter(id, S) {
  const st = (w = 7, color = S.line) => `stroke="${color}" stroke-width="${(w * S.lw).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"`;
  const skin = S.skin(id), hair = S.hair(id), cloth = S.cloth(id), cloth2 = S.cloth2(id);
  const detail = S.incised ?? S.line; // inner detail lines (incised in black-figure)
  const det = (w = 4) => st(w, skin === INK || cloth === INK ? detail : S.line);
  const [rx, ry] = S.face;

  const torso = () => `
    <path d="M120,1000 C120,820 200,740 300,710 L420,710 C520,740 600,820 600,1000 Z" fill="${cloth}" ${st(8)}/>
    <path d="M300,712 C320,790 400,790 420,712" fill="none" ${det(6)}/>
    ${[200, 260, 330, 400, 460, 520].map((x, i) => `<path d="M${x},${820 + (i % 2) * 20} C${x + 10},880 ${x - 6},940 ${x + 4},1000" fill="none" ${det(4)} opacity="0.75"/>`).join("")}`;

  const face = (beard) => `
    <path d="M310,600 L310,720 L410,720 L410,600 Z" fill="${skin}" ${st(7)}/>
    <ellipse cx="360" cy="440" rx="${rx}" ry="${ry}" fill="${skin}" ${st(8)}/>
    <path d="M${360 - rx - 2},440 C${336 - rx},420 ${336 - rx},490 ${364 - rx},500" fill="${skin}" ${st(6)}/>
    <path d="M${358 + rx},440 C${384 + rx},420 ${384 + rx},490 ${356 + rx},500" fill="${skin}" ${st(6)}/>
    <path d="M360,420 C352,470 340,500 352,510 C360,516 372,512 378,506" fill="none" ${st(6, skin === INK ? detail : S.line)}/>
    ${S.cheeks ? `<ellipse cx="270" cy="510" rx="34" ry="20" fill="${S.cheeks}" opacity="0.55"/><ellipse cx="450" cy="510" rx="34" ry="20" fill="${S.cheeks}" opacity="0.55"/>` : ""}
    ${beard || S.cheeks ? "" : `<path d="M260,520 C275,560 300,590 330,605" fill="none" ${st(3, S.shade)} opacity="0.6"/><path d="M460,520 C445,560 420,590 390,605" fill="none" ${st(3, S.shade)} opacity="0.6"/>`}`;

  const eyes = (open) => {
    const e = S.eye;
    const lid = (cx) => `<path d="M${cx - 36 * e},418 Q${cx},${418 - 26 * e} ${cx + 36 * e},418 Q${cx},${418 + 22 * e} ${cx - 36 * e},418 Z"`;
    const outline = skin === INK ? detail : S.line;
    if (!open)
      return [298, 422].map((cx) => `${lid(cx)} fill="${skin}" ${st(5, outline)}/><path d="M${cx - 32 * e},420 Q${cx},${432 + 4 * e} ${cx + 32 * e},420" fill="none" ${st(6, outline)}/>`).join("");
    return [298, 422].map((cx) => `${lid(cx)} fill="${S.cream}" ${st(5, outline)}/>
      <circle cx="${cx + 2}" cy="417" r="${12 * e}" fill="${S.pupil}"/>
      ${S.shine ? `<circle cx="${cx + 7}" cy="${411}" r="${4.5 * e}" fill="#fff"/>` : ""}`).join("");
  };

  const brows = (angry) => {
    const c = hair === INK && skin === INK ? detail : hair;
    return angry
      ? `<path d="M255,380 L338,398" fill="none" ${st(9, c)}/><path d="M465,380 L382,398" fill="none" ${st(9, c)}/>`
      : `<path d="M258,388 Q298,368 338,384" fill="none" ${st(8, c)}/><path d="M382,384 Q422,368 462,388" fill="none" ${st(8, c)}/>`;
  };

  const beard = (big) => {
    const bottom = big ? 800 : 700;
    const curls = [];
    for (let y = 560; y < bottom - 20; y += 38)
      for (let x = 240 + ((y / 38) % 2) * 18; x < 490; x += 40) {
        const inside = Math.abs(x - 360) < 130 - (y - 560) * (big ? 0.35 : 0.55);
        if (inside && !(Math.abs(x - 360) < 60 && y < 600)) curls.push(`<path d="M${x},${y} q10,-14 20,0 q-10,14 -20,0" fill="none" stroke="${S.curl}" stroke-width="3" opacity="0.8"/>`);
      }
    return `
      <path d="M215,480 C215,600 260,${bottom - 60} 360,${bottom} C460,${bottom - 60} 505,600 505,480
               C490,540 450,575 410,585 C390,560 330,560 310,585 C270,575 230,540 215,480 Z" fill="${hair}"/>
      ${curls.join("")}
      <path d="M300,538 C330,520 350,524 360,532 C370,524 390,520 420,538 C400,545 380,542 360,540 C340,542 320,545 300,538 Z" fill="${hair}"/>`;
  };

  const mouth = (level, bearded) => {
    const { x, y } = MOUTH;
    const lineC = skin === INK ? detail : S.line;
    if (level === 0) return `<path d="M${x - 34},${y} Q${x},${y + 10} ${x + 34},${y}" fill="none" stroke="${lineC}" stroke-width="${6 * S.lw}" stroke-linecap="round"/>`;
    const [mrx, mry] = [[30, 9], [34, 18], [38, 30]][level - 1];
    return `
      <ellipse cx="${x}" cy="${y + mry / 2}" rx="${mrx + 6}" ry="${mry + 6}" fill="${bearded && S === STYLES["red-figure"] ? CLAY_DARK : S.lips}"/>
      <ellipse cx="${x}" cy="${y + mry / 2}" rx="${mrx}" ry="${mry}" fill="${S.mouthIn}"/>
      ${level >= 2 ? `<rect x="${x - mrx * 0.7}" y="${y + mry / 2 - mry}" width="${mrx * 1.4}" height="${Math.max(5, mry * 0.32)}" rx="3" fill="${S.cream}"/>` : ""}
      ${level === 3 ? `<ellipse cx="${x}" cy="${y + mry * 1.05}" rx="${mrx * 0.55}" ry="${mry * 0.38}" fill="${S.tongue}"/>` : ""}`;
  };

  // ---- the four characters
  const shaft = (x1, y1, x2, y2, w, color) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${st(w)}/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w / 2}"/>`;
  const defs = {
    athena: {
      beard: false,
      back: `${shaft(610, 60, 560, 1000, 14, cloth2)}
        <path d="M610,10 L635,90 L604,82 L585,90 Z" fill="${S.cream}" ${st(6)}/>
        <path d="M205,420 C190,600 180,700 230,760 L490,760 C540,700 530,600 515,420 Z" fill="${hair}"/>`,
      front: `
        <path d="M190,860 C260,780 460,780 530,860 L530,1000 L190,1000 Z" fill="${cloth2 === cloth ? S.cream : cloth2}" ${st(7)}/>
        ${[230, 290, 350, 410, 470].map((x) => `<path d="M${x},860 q15,-25 30,0" fill="none" ${st(5)}/>`).join("")}
        <circle cx="360" cy="920" r="44" fill="${S.skin("odysseus")}" ${st(6)}/><circle cx="345" cy="912" r="6" fill="${S.line}"/><circle cx="375" cy="912" r="6" fill="${S.line}"/><path d="M342,938 q18,10 36,0" fill="none" ${st(5)}/>
        <path d="M200,370 C200,200 280,140 360,140 C440,140 520,200 520,370 C470,320 420,300 360,300 C300,300 250,320 200,370 Z" fill="${S === STYLES.storybook ? "#9aa7b0" : S === STYLES.marble ? "#cfc8bc" : INK}" ${S === STYLES["red-figure"] || S === STYLES["black-figure"] ? "" : st(6)}/>
        <path d="M225,330 C260,300 310,288 360,288 C410,288 460,300 495,330" fill="none" stroke="${S.accent}" stroke-width="10"/>
        <path d="M360,140 C300,60 230,40 150,70 C220,80 260,110 280,150" fill="${S === STYLES.storybook || S === STYLES.fresco ? "#c23b22" : CLAY}" ${st(6)}/>
        <path d="M360,140 C420,60 500,40 590,90 C520,90 470,110 440,150" fill="${S === STYLES.storybook || S === STYLES.fresco ? "#c23b22" : CLAY}" ${st(6)}/>
        <circle cx="212" cy="512" r="9" fill="${S.accent}" ${st(3)}/><circle cx="508" cy="512" r="9" fill="${S.accent}" ${st(3)}/>`,
      angry: false,
    },
    odysseus: {
      beard: true,
      back: `${shaft(120, 80, 190, 1000, 16, cloth2)}
        <path d="M95,20 C130,0 150,40 135,160 C120,170 105,165 100,150 C88,90 85,40 95,20 Z" fill="${cloth2}" ${st(6)}/>`,
      front: `${beard(false)}
        <path d="M150,1000 C170,860 240,770 330,740 L600,1000 Z" fill="${cloth2}" ${st(7)}/>
        <circle cx="330" cy="760" r="22" fill="${S.accent}" ${st(5)}/>
        <path d="M215,330 C230,150 300,90 360,90 C420,90 490,150 505,330 Z" fill="${S === STYLES.storybook ? "#c9a46a" : S.cream}" ${st(8)}/>
        <path d="M205,330 L515,330 L512,360 L208,360 Z" fill="${cloth}" ${st(6)}/>
        ${[230, 270, 450, 490].map((x) => `<path d="M${x - 10},372 q12,-16 24,0 q-12,16 -24,0" fill="${hair}"/>`).join("")}`,
      angry: false,
    },
    poseidon: {
      beard: true,
      back: `${shaft(615, 120, 590, 1000, 14, S.accent)}
        <path d="M560,30 L570,130 L660,135 L668,30" fill="none" ${st(14)}/><path d="M560,30 L570,130 L660,135 L668,30" fill="none" stroke="${S.accent}" stroke-width="6"/>
        ${shaft(615, 10, 615, 135, 14, S.accent)}
        <path d="M200,360 C150,520 140,700 190,800 L530,800 C580,700 570,520 520,360 Z" fill="${hair}"/>
        ${[170, 200, 520, 550].map((x) => `<path d="M${x},500 c-20,40 20,80 0,120 c-20,40 20,80 0,120" fill="none" stroke="${S.curl}" stroke-width="5"/>`).join("")}`,
      front: `${beard(true)}
        <path d="M205,310 C240,270 300,255 360,255 C420,255 480,270 515,310 L515,290 L490,200 L460,270 L425,170 L392,255 L360,150 L328,255 L295,170 L260,270 L230,200 L205,290 Z" fill="${S.accent}" ${st(6)}/>
        <path d="M200,330 C230,280 300,262 360,262 C420,262 490,280 520,330 C470,300 420,292 360,292 C300,292 250,300 200,330 Z" fill="${hair}"/>
        ${[160, 260, 360, 460].map((x) => `<path d="M${x},960 c20,-30 50,-30 60,0 c-15,10 -30,0 -25,-12" fill="none" stroke="${S.cream}" stroke-width="6"/>`).join("")}`,
      angry: true,
    },
    circe: {
      beard: false,
      back: `
        <path d="M195,360 C150,560 150,800 200,980 L520,980 C570,800 570,560 525,360 Z" fill="${hair}"/>
        ${[205, 240, 480, 515].map((x) => `<path d="M${x},560 c-12,50 12,100 0,150 c-12,50 12,100 0,150" fill="none" stroke="${S.curl}" stroke-width="5"/>`).join("")}
        ${shaft(560, 980, 660, 120, 10, S.accent)}
        <circle cx="662" cy="110" r="16" fill="${S.accent}" ${st(5)}/>`,
      front: `
        <path d="M205,400 C200,230 280,170 360,170 C440,170 520,230 515,400 C480,320 430,280 360,280 C290,280 240,320 205,400 Z" fill="${hair}"/>
        <path d="M232,300 C280,262 320,252 360,252 C400,252 440,262 488,300" fill="none" stroke="${S.accent}" stroke-width="12"/>
        ${[270, 315, 360, 405, 450].map((x, i) => `<path d="M${x},${i === 2 ? 252 : 266} l-10,-24 l10,-14 l10,14 Z" fill="${S.accent}" ${st(3)}/>`).join("")}
        <path d="M300,730 C320,770 400,770 420,730" fill="none" stroke="${S.accent}" stroke-width="8"/>
        <path d="M150,880 L250,880 C250,930 225,955 200,955 C175,955 150,930 150,880 Z" fill="${S.cream}" ${st(6)}/>
        <line x1="200" y1="955" x2="200" y2="990" ${st(6)}/><line x1="170" y1="992" x2="230" y2="992" ${st(6)}/>
        <path d="M212,505 l-8,24 l8,14 l8,-14 Z" fill="${S.accent}" ${st(3)}/><path d="M508,505 l-8,24 l8,14 l8,-14 Z" fill="${S.accent}" ${st(3)}/>`,
      angry: false,
    },
  };
  const d = defs[id];

  // ---- gestures: arms in front of the body. Upper arm in the sleeve colour, forearm and hand in skin.
  const limb = (pts, w, color) => {
    const p = `M${pts.map((q) => q.join(",")).join(" L")}`;
    return `<path d="${p}" fill="none" ${st(w + 14)}/><path d="${p}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  };
  const arm = (shoulder, elbow, wrist) => `${limb([shoulder, elbow], 58, cloth)}${limb([elbow, wrist], 46, skin)}`;
  const outline = skin === INK ? detail : S.line;
  const hand = (x, y, kind, flip = 1) => {
    const f = (dx) => x + dx * flip;
    switch (kind) {
      case "point":
        return `<line x1="${x}" y1="${y}" x2="${f(64)}" y2="${y - 44}" ${st(36)}/><line x1="${x}" y1="${y}" x2="${f(64)}" y2="${y - 44}" stroke="${skin}" stroke-width="${24}" stroke-linecap="round"/>
          <circle cx="${x}" cy="${y}" r="34" fill="${skin}" ${st(7)}/><path d="M${f(-18)},${y - 6} q${16 * flip},12 ${30 * flip},0" fill="none" ${st(4, outline)}/>`;
      case "fist":
        return `<circle cx="${x}" cy="${y}" r="38" fill="${skin}" ${st(7)}/>${[-16, 0, 16].map((o) => `<path d="M${x - 24},${y + o} q24,-8 48,0" fill="none" ${st(4, outline)}/>`).join("")}`;
      case "palm":
        return `<ellipse cx="${x}" cy="${y}" rx="44" ry="26" fill="${skin}" ${st(7)}/>${[-24, -8, 8, 24].map((o) => `<line x1="${x + o}" y1="${y - 22}" x2="${x + o * 1.2}" y2="${y - 50}" ${st(18)}/><line x1="${x + o}" y1="${y - 22}" x2="${x + o * 1.2}" y2="${y - 50}" stroke="${skin}" stroke-width="10" stroke-linecap="round"/>`).join("")}<ellipse cx="${x}" cy="${y}" rx="40" ry="22" fill="${skin}"/>`;
      case "flat":
        return `<ellipse cx="${x}" cy="${y}" rx="48" ry="34" fill="${skin}" ${st(7)} transform="rotate(${-20 * flip} ${x} ${y})"/>${[-14, 2, 18].map((o) => `<path d="M${x - 30},${y + o} q30,-10 60,-4" fill="none" ${st(3, outline)} opacity="0.7"/>`).join("")}`;
      default:
        return "";
    }
  };
  const gestures = {
    point: arm([540, 830], [612, 735], [628, 640]) + hand(626, 628, "point"),
    raise: arm([540, 830], [610, 700], [602, 545]) + hand(602, 515, "fist"),
    heart: arm([540, 830], [560, 965], [420, 870]) + hand(395, 850, "flat", -1),
    think: arm([540, 840], [565, 985], [478, 735]) + hand(458, 700, "fist"),
    open: arm([180, 840], [190, 965], [262, 900]) + hand(272, 890, "palm") + arm([540, 840], [530, 965], [458, 900]) + hand(448, 890, "palm"),
  };

  return {
    body: (eyesOpen = true) => `${d.back}${torso()}${face(d.beard)}${d.front}${brows(d.angry)}${eyes(eyesOpen)}`,
    blink: () => eyes(false),
    mouth: (l) => mouth(l, d.beard),
    gesture: (g) => gestures[g] ?? "",
  };
}

export const characterIds = ["athena", "odysseus", "poseidon", "circe"];

/** SVG strings for every layer of one character in one style, keyed by PNG file name. */
export function characterLayers(id, style = DEFAULT_STYLE) {
  const p = painter(id, STYLES[style] ?? STYLES[DEFAULT_STYLE]);
  return {
    "body.png": svg(p.body(true)),
    "blink.png": svg(p.blink()),
    ...Object.fromEntries([0, 1, 2, 3].map((l) => [`mouth-${l}.png`, svg(p.mouth(l))])),
    ...Object.fromEntries(GESTURE_IDS.map((g) => [`gesture-${g}.png`, svg(p.gesture(g))])),
  };
}

/** One composed SVG (body + mouth + optional blink and gesture), used by the explorer page. */
export function characterSvg(id, style = DEFAULT_STYLE, { mouth = 0, blink = false, gesture = "none" } = {}) {
  const p = painter(id, STYLES[style] ?? STYLES[DEFAULT_STYLE]);
  return svg(`${p.body(true)}${blink ? p.blink() : ""}${p.mouth(mouth)}${gesture !== "none" ? p.gesture(gesture) : ""}`);
}
