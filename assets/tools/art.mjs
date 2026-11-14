// SVG sources for every image, in one style: Greek red-figure vase painting
// (terracotta figures, black glaze, cream details, meander borders).
// Rendered to PNG by ./generate.mjs. Edit here, then: npm run art -w stage

export const C = {
  glaze: "#17110d", // black background
  clay: "#c8693a", // terracotta figure
  clayDark: "#9c4a24",
  line: "#1b1410",
  cream: "#f1dfc0",
  gold: "#e8c15a",
  paper: "#f4ecdc",
};

const svg = (w, h, body, bg = "none") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  (bg === "none" ? "" : `<rect width="${w}" height="${h}" fill="${bg}"/>`) +
  body +
  `</svg>`;

// ---------------------------------------------------------------- characters (720 x 1000, transparent)
// All layers share one canvas so they stack. Face centre (360, 430); mouth centre (360, 560).

const MOUTH = { x: 360, y: 560 };
const stroke = (w = 7) => `stroke="${C.line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

function torso(extra = "") {
  return `
  <path d="M120,1000 C120,820 200,740 300,710 L420,710 C520,740 600,820 600,1000 Z" fill="${C.clay}" ${stroke(8)}/>
  <path d="M300,712 C320,790 400,790 420,712" fill="none" ${stroke(6)}/>
  ${[200, 260, 330, 400, 460, 520].map((x, i) => `<path d="M${x},${820 + (i % 2) * 20} C${x + 10},880 ${x - 6},940 ${x + 4},1000" fill="none" ${stroke(4)} opacity="0.75"/>`).join("")}
  ${extra}`;
}

function neckAndFace({ beard = false } = {}) {
  return `
  <path d="M310,600 L310,720 L410,720 L410,600 Z" fill="${C.clay}" ${stroke(7)}/>
  <ellipse cx="360" cy="440" rx="148" ry="185" fill="${C.clay}" ${stroke(8)}/>
  <!-- ears -->
  <path d="M214,440 C190,420 190,490 218,500" fill="${C.clay}" ${stroke(6)}/>
  <path d="M506,440 C530,420 530,490 502,500" fill="${C.clay}" ${stroke(6)}/>
  <!-- nose -->
  <path d="M360,420 C352,470 340,500 352,510 C360,516 372,512 378,506" fill="none" ${stroke(6)}/>
  <!-- cheeks -->
  ${beard ? "" : `<path d="M260,520 C275,560 300,590 330,605" fill="none" ${stroke(3)} opacity="0.5"/><path d="M460,520 C445,560 420,590 390,605" fill="none" ${stroke(3)} opacity="0.5"/>`}`;
}

function eyes(open = true) {
  if (!open)
    return `<g>
      <path d="M262,418 Q298,405 334,418 Q298,436 262,418 Z" fill="${C.clay}" ${stroke(5)}/>
      <path d="M266,420 Q298,432 330,420" fill="none" ${stroke(6)}/>
      <path d="M386,418 Q422,405 458,418 Q422,436 386,418 Z" fill="${C.clay}" ${stroke(5)}/>
      <path d="M390,420 Q422,432 454,420" fill="none" ${stroke(6)}/>
    </g>`;
  return `<g>
    <path d="M262,418 Q298,392 334,418 Q298,440 262,418 Z" fill="${C.cream}" ${stroke(5)}/>
    <circle cx="300" cy="417" r="12" fill="${C.line}"/>
    <path d="M386,418 Q422,392 458,418 Q422,440 386,418 Z" fill="${C.cream}" ${stroke(5)}/>
    <circle cx="420" cy="417" r="12" fill="${C.line}"/>
  </g>`;
}

const brows = (angry = false) =>
  angry
    ? `<path d="M255,380 L338,398" fill="none" ${stroke(9)}/><path d="M465,380 L382,398" fill="none" ${stroke(9)}/>`
    : `<path d="M258,388 Q298,368 338,384" fill="none" ${stroke(8)}/><path d="M382,384 Q422,368 462,388" fill="none" ${stroke(8)}/>`;

function beardShape(big = false) {
  const bottom = big ? 800 : 700;
  const curls = [];
  for (let y = 560; y < bottom - 20; y += 38)
    for (let x = 240 + ((y / 38) % 2) * 18; x < 490; x += 40) {
      const inside = Math.abs(x - 360) < 130 - (y - 560) * (big ? 0.35 : 0.55);
      if (inside && !(Math.abs(x - 360) < 60 && y < 600)) curls.push(`<path d="M${x},${y} q10,-14 20,0 q-10,14 -20,0" fill="none" ${stroke(3)} opacity="0.8"/>`);
    }
  return `
  <path d="M215,480 C215,600 260,${bottom - 60} 360,${bottom} C460,${bottom - 60} 505,600 505,480
           C490,540 450,575 410,585 C390,560 330,560 310,585 C270,575 230,540 215,480 Z" fill="${C.line}"/>
  ${curls.join("").replaceAll(C.line, C.clayDark)}
  <!-- moustache -->
  <path d="M300,538 C330,520 350,524 360,532 C370,524 390,520 420,538 C400,545 380,542 360,540 C340,542 320,545 300,538 Z" fill="${C.line}"/>`;
}

function mouth(level, { beard = false } = {}) {
  const { x, y } = MOUTH;
  const lips = beard ? C.clayDark : "#a3442a";
  if (level === 0) return `<path d="M${x - 34},${y} Q${x},${y + 10} ${x + 34},${y}" fill="none" stroke="${C.line}" stroke-width="6" stroke-linecap="round"/>`;
  const [rx, ry] = [[30, 9], [34, 18], [38, 30]][level - 1];
  return `
    <ellipse cx="${x}" cy="${y + ry / 2}" rx="${rx + 6}" ry="${ry + 6}" fill="${lips}"/>
    <ellipse cx="${x}" cy="${y + ry / 2}" rx="${rx}" ry="${ry}" fill="${C.line}"/>
    ${level >= 2 ? `<rect x="${x - rx * 0.7}" y="${y + ry / 2 - ry}" width="${rx * 1.4}" height="${Math.max(5, ry * 0.32)}" rx="3" fill="${C.cream}"/>` : ""}
    ${level === 3 ? `<ellipse cx="${x}" cy="${y + ry * 1.05}" rx="${rx * 0.55}" ry="${ry * 0.38}" fill="#b4473a"/>` : ""}`;
}

const characters = {
  athena: {
    beard: false,
    back: `
      <!-- spear -->
      <line x1="610" y1="60" x2="560" y2="1000" ${stroke(14)}/><line x1="610" y1="60" x2="560" y2="1000" stroke="${C.clayDark}" stroke-width="7"/>
      <path d="M610,10 L635,90 L604,82 L585,90 Z" fill="${C.cream}" ${stroke(6)}/>
      <!-- long hair -->
      <path d="M205,420 C190,600 180,700 230,760 L490,760 C540,700 530,600 515,420 Z" fill="${C.line}"/>`,
    front: `
      <!-- aegis with gorgoneion -->
      <path d="M190,860 C260,780 460,780 530,860 L530,1000 L190,1000 Z" fill="${C.cream}" ${stroke(7)}/>
      ${[230, 290, 350, 410, 470].map((x) => `<path d="M${x},860 q15,-25 30,0" fill="none" ${stroke(5)}/>`).join("")}
      <circle cx="360" cy="920" r="44" fill="${C.clay}" ${stroke(6)}/><circle cx="345" cy="912" r="6" fill="${C.line}"/><circle cx="375" cy="912" r="6" fill="${C.line}"/><path d="M342,938 q18,10 36,0" fill="none" ${stroke(5)}/>
      <!-- Corinthian helmet pushed back, with crest -->
      <path d="M200,370 C200,200 280,140 360,140 C440,140 520,200 520,370 C470,320 420,300 360,300 C300,300 250,320 200,370 Z" fill="${C.line}"/>
      <path d="M225,330 C260,300 310,288 360,288 C410,288 460,300 495,330" fill="none" stroke="${C.gold}" stroke-width="10"/>
      <path d="M360,140 C300,60 230,40 150,70 C220,80 260,110 280,150" fill="${C.clay}" ${stroke(6)}/>
      <path d="M360,140 C420,60 500,40 590,90 C520,90 470,110 440,150" fill="${C.clay}" ${stroke(6)}/>
      ${[170, 200, 230, 260, 470, 500, 530, 560].map((x) => `<line x1="${x}" y1="${x < 360 ? 72 + (x - 150) * 0.4 : 72 + (590 - x) * 0.4}" x2="${x + 10}" y2="${x < 360 ? 100 + (x - 150) * 0.4 : 100 + (590 - x) * 0.4}" ${stroke(3)}/>`).join("")}
      <!-- earrings -->
      <circle cx="212" cy="512" r="9" fill="${C.gold}" ${stroke(3)}/><circle cx="508" cy="512" r="9" fill="${C.gold}" ${stroke(3)}/>`,
    brows: brows(),
  },
  odysseus: {
    beard: true,
    back: `
      <!-- oar -->
      <line x1="120" y1="80" x2="190" y2="1000" ${stroke(16)}/><line x1="120" y1="80" x2="190" y2="1000" stroke="${C.clayDark}" stroke-width="8"/>
      <path d="M95,20 C130,0 150,40 135,160 C120,170 105,165 100,150 C88,90 85,40 95,20 Z" fill="${C.clay}" ${stroke(6)}/>`,
    front: `
      ${beardShape(false)}
      <!-- cloak pinned at shoulder -->
      <path d="M150,1000 C170,860 240,770 330,740 L600,1000 Z" fill="${C.clayDark}" ${stroke(7)}/>
      <circle cx="330" cy="760" r="22" fill="${C.gold}" ${stroke(5)}/>
      <!-- pilos (conical sailor's cap) -->
      <path d="M215,330 C230,150 300,90 360,90 C420,90 490,150 505,330 Z" fill="${C.cream}" ${stroke(8)}/>
      <path d="M205,330 L515,330 L512,360 L208,360 Z" fill="${C.clay}" ${stroke(6)}/>
      <!-- curls under cap -->
      ${[230, 270, 450, 490].map((x) => `<path d="M${x - 10},372 q12,-16 24,0 q-12,16 -24,0" fill="${C.line}"/>`).join("")}`,
    brows: brows(),
  },
  poseidon: {
    beard: true,
    back: `
      <!-- trident -->
      <line x1="615" y1="120" x2="590" y2="1000" ${stroke(14)}/><line x1="615" y1="120" x2="590" y2="1000" stroke="${C.gold}" stroke-width="6"/>
      <path d="M560,30 L570,130 L660,135 L668,30" fill="none" ${stroke(14)}/><path d="M560,30 L570,130 L660,135 L668,30" fill="none" stroke="${C.gold}" stroke-width="6"/>
      <line x1="615" y1="10" x2="615" y2="135" ${stroke(14)}/><line x1="615" y1="10" x2="615" y2="135" stroke="${C.gold}" stroke-width="6"/>
      <!-- flowing hair -->
      <path d="M200,360 C150,520 140,700 190,800 L530,800 C580,700 570,520 520,360 Z" fill="${C.line}"/>
      ${[170, 200, 520, 550].map((x) => `<path d="M${x},500 c-20,40 20,80 0,120 c-20,40 20,80 0,120" fill="none" stroke="${C.clayDark}" stroke-width="5"/>`).join("")}`,
    front: `
      ${beardShape(true)}
      <!-- crown of spikes -->
      <path d="M205,310 C240,270 300,255 360,255 C420,255 480,270 515,310 L515,290 L490,200 L460,270 L425,170 L392,255 L360,150 L328,255 L295,170 L260,270 L230,200 L205,290 Z" fill="${C.gold}" ${stroke(6)}/>
      <path d="M200,330 C230,280 300,262 360,262 C420,262 490,280 520,330 C470,300 420,292 360,292 C300,292 250,300 200,330 Z" fill="${C.line}"/>
      <!-- wave pattern on robe -->
      ${[160, 260, 360, 460].map((x) => `<path d="M${x},960 c20,-30 50,-30 60,0 c-15,10 -30,0 -25,-12" fill="none" stroke="${C.cream}" stroke-width="6"/>`).join("")}`,
    brows: brows(true),
  },
  circe: {
    beard: false,
    back: `
      <!-- very long hair -->
      <path d="M195,360 C150,560 150,800 200,980 L520,980 C570,800 570,560 525,360 Z" fill="${C.line}"/>
      ${[205, 240, 480, 515].map((x) => `<path d="M${x},560 c-12,50 12,100 0,150 c-12,50 12,100 0,150" fill="none" stroke="${C.clayDark}" stroke-width="5"/>`).join("")}
      <!-- wand -->
      <line x1="560" y1="980" x2="660" y2="120" ${stroke(10)}/><line x1="560" y1="980" x2="660" y2="120" stroke="${C.gold}" stroke-width="4"/>
      <circle cx="662" cy="110" r="16" fill="${C.gold}" ${stroke(5)}/>`,
    front: `
      <!-- hair top and diadem -->
      <path d="M205,400 C200,230 280,170 360,170 C440,170 520,230 515,400 C480,320 430,280 360,280 C290,280 240,320 205,400 Z" fill="${C.line}"/>
      <path d="M232,300 C280,262 320,252 360,252 C400,252 440,262 488,300" fill="none" stroke="${C.gold}" stroke-width="12"/>
      ${[270, 315, 360, 405, 450].map((x, i) => `<path d="M${x},${i === 2 ? 252 : 266} l-10,-24 l10,-14 l10,14 Z" fill="${C.gold}" ${stroke(3)}/>`).join("")}
      <!-- necklace and cup -->
      <path d="M300,730 C320,770 400,770 420,730" fill="none" stroke="${C.gold}" stroke-width="8"/>
      <path d="M150,880 L250,880 C250,930 225,955 200,955 C175,955 150,930 150,880 Z" fill="${C.cream}" ${stroke(6)}/>
      <line x1="200" y1="955" x2="200" y2="990" ${stroke(6)}/><line x1="170" y1="992" x2="230" y2="992" ${stroke(6)}/>
      <!-- earrings -->
      <path d="M212,505 l-8,24 l8,14 l8,-14 Z" fill="${C.gold}" ${stroke(3)}/><path d="M508,505 l-8,24 l8,14 l8,-14 Z" fill="${C.gold}" ${stroke(3)}/>`,
    brows: brows(),
  },
};

export function characterLayers(id) {
  const c = characters[id];
  const base = (eyesOpen) =>
    svg(720, 1000, `${c.back}${torso()}${neckAndFace({ beard: c.beard })}${c.front}${c.brows}${eyes(eyesOpen)}`);
  return {
    "body.png": base(true),
    "blink.png": svg(720, 1000, eyes(false)),
    ...Object.fromEntries([0, 1, 2, 3].map((l) => [`mouth-${l}.png`, svg(720, 1000, mouth(l, { beard: c.beard }))])),
  };
}

export const characterIds = Object.keys(characters);

// ---------------------------------------------------------------- scene primitives (1280 x 720)

const W = 1280, H = 720;

function meander(y, h = 34, color = C.clay) {
  const u = h / 4;
  let d = "";
  for (let x = 0; x < W; x += h * 1.5) {
    d += `M${x},${y + h} V${y} H${x + 3 * u} V${y + 3 * u} H${x + u} V${y + u} H${x + 2 * u} V${y + 2 * u} `;
  }
  return `<rect x="0" y="${y - 6}" width="${W}" height="${h + 12}" fill="${C.glaze}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${u * 0.55}" stroke-linecap="square"/>`;
}

function waveBand(y, color = C.clay, amp = 22) {
  let d = `M0,${y}`;
  for (let x = 0; x < W; x += 80) d += ` c20,${-amp} 50,${-amp} 60,0 c-10,${amp * 0.6} -32,${amp * 0.4} -28,${-amp * 0.25} c10,${amp * 0.5} 30,${amp * 0.5} 48,${amp * 0.25}`;
  return `<path d="${d} L${W},${H} L0,${H} Z" fill="${color}" opacity="0.9"/>`;
}

function sea(y) {
  return `<rect x="0" y="${y}" width="${W}" height="${H - y}" fill="#1f1610"/>${waveBand(y + 30, C.clayDark, 16)}${waveBand(y + 90, C.clay, 20)}`;
}

function ship(x, y, s = 1, { sail = true, mastMan = false, flip = false } = {}) {
  const g = `
    <path d="M-170,0 C-120,40 120,40 170,0 C175,-20 190,-40 205,-55 L190,-5 C140,60 -140,60 -185,-5 Z" fill="${C.clay}" ${stroke(5)}/>
    <circle cx="150" cy="10" r="7" fill="${C.cream}" ${stroke(3)}/>
    ${[-120, -80, -40, 0, 40, 80].map((ox) => `<line x1="${ox}" y1="20" x2="${ox - 25}" y2="70" ${stroke(4)}/>`).join("")}
    <line x1="0" y1="10" x2="0" y2="-210" ${stroke(7)}/>
    ${sail ? `<path d="M-90,-200 L90,-200 L80,-70 L-80,-70 Z" fill="${C.cream}" ${stroke(5)}/>${[-50, 0, 50].map((ox) => `<line x1="${ox}" y1="-200" x2="${ox * 0.9}" y2="-70" ${stroke(2)} opacity="0.6"/>`).join("")}` : `<line x1="-90" y1="-200" x2="90" y2="-200" ${stroke(6)}/>`}
    ${mastMan ? `<circle cx="0" cy="-150" r="16" fill="${C.clay}" ${stroke(4)}/><path d="M-14,-134 L14,-134 L18,-60 L-18,-60 Z" fill="${C.clay}" ${stroke(4)}/>${[-120, -100, -80].map((yy) => `<line x1="-24" y1="${yy}" x2="24" y2="${yy + 6}" stroke="${C.gold}" stroke-width="5"/>`).join("")}` : ""}
    ${[-110, -60, 60, 110].map((ox) => `<circle cx="${ox}" cy="-8" r="10" fill="${C.clay}" ${stroke(3)}/>`).join("")}`;
  return `<g transform="translate(${x},${y}) scale(${flip ? -s : s},${s})">${g}</g>`;
}

function person(x, y, s = 1, { arm = "down", color = C.clay, item = "" } = {}) {
  const arms = {
    down: `<path d="M-18,-110 L-34,-40 M18,-110 L34,-40" ${stroke(7)} fill="none"/>`,
    up: `<path d="M-18,-110 L-40,-190 M18,-110 L40,-190" ${stroke(7)} fill="none"/>`,
    forward: `<path d="M-18,-110 L-30,-50 M18,-110 L80,-120" ${stroke(7)} fill="none"/>`,
    head: `<path d="M-18,-110 L-30,-160 L-10,-170 M18,-110 L30,-160 L10,-170" ${stroke(7)} fill="none"/>`,
  }[arm];
  return `<g transform="translate(${x},${y}) scale(${s})">
    ${arms}
    <path d="M-22,-120 L22,-120 L42,0 L-42,0 Z" fill="${color}" ${stroke(5)}/>
    ${[-16, 0, 16].map((ox) => `<line x1="${ox}" y1="-100" x2="${ox * 1.6}" y2="-4" ${stroke(2)} opacity="0.6"/>`).join("")}
    <circle cx="0" cy="-145" r="24" fill="${color}" ${stroke(5)}/>
    <path d="M-24,-152 C-20,-175 20,-175 24,-152" fill="${C.line}"/>
    ${item}
  </g>`;
}

function seated(x, y, s = 1, { color = C.clay, slump = false } = {}) {
  return `<g transform="translate(${x},${y}) scale(${s})">
    <path d="M-50,0 L-50,-60 L30,-60 L30,0" fill="none" ${stroke(6)}/>
    <path d="M-30,-60 L${slump ? 10 : -10},-140 L${slump ? 40 : 20},-140 L20,-60 Z" fill="${color}" ${stroke(5)}/>
    <path d="M20,-60 L60,-60 L60,0" fill="none" ${stroke(7)}/>
    <circle cx="${slump ? 40 : 10}" cy="${slump ? -150 : -165}" r="22" fill="${color}" ${stroke(5)}/>
  </g>`;
}

const sun = (x, y, r) =>
  `<g transform="translate(${x},${y})">${Array.from({ length: 16 }, (_, i) => `<line x1="0" y1="${-r - 12}" x2="0" y2="${-r - 50}" ${stroke(8)} transform="rotate(${i * 22.5})"/><line x1="0" y1="${-r - 12}" x2="0" y2="${-r - 50}" stroke="${C.gold}" stroke-width="4" transform="rotate(${i * 22.5})"/>`).join("")}<circle r="${r}" fill="${C.gold}" ${stroke(6)}/></g>`;

const island = (x, y, w, h, color = C.clay) =>
  `<path d="M${x - w / 2},${y} C${x - w / 3},${y - h} ${x + w / 3},${y - h} ${x + w / 2},${y} Z" fill="${color}" ${stroke(5)}/>`;

const columns = (x0, n, gap, top, bottom) =>
  Array.from({ length: n }, (_, i) => {
    const x = x0 + i * gap;
    return `<rect x="${x - 18}" y="${top}" width="36" height="${bottom - top}" fill="${C.cream}" ${stroke(4)}/><rect x="${x - 30}" y="${top - 16}" width="60" height="16" fill="${C.cream}" ${stroke(4)}/>${[-8, 0, 8].map((o) => `<line x1="${x + o}" y1="${top + 8}" x2="${x + o}" y2="${bottom - 8}" ${stroke(2)} opacity="0.5"/>`).join("")}`;
  }).join("");

const pig = (x, y, s = 1) =>
  `<g transform="translate(${x},${y}) scale(${s})"><ellipse cx="0" cy="-40" rx="70" ry="42" fill="${C.clay}" ${stroke(5)}/><ellipse cx="72" cy="-46" rx="22" ry="18" fill="${C.clay}" ${stroke(5)}/><ellipse cx="90" cy="-44" rx="7" ry="9" fill="${C.clayDark}" ${stroke(3)}/><path d="M60,-64 l6,-18 l10,14" fill="${C.clay}" ${stroke(4)}/>${[-45, -20, 25, 45].map((ox) => `<line x1="${ox}" y1="-8" x2="${ox}" y2="0" ${stroke(10)}/>`).join("")}<path d="M-70,-44 c-16,-10 -6,-26 -16,-28" fill="none" ${stroke(4)}/><circle cx="66" cy="-52" r="3" fill="${C.line}"/></g>`;

const cow = (x, y, s = 1, color = C.clay) =>
  `<g transform="translate(${x},${y}) scale(${s})"><path d="M-80,-90 L60,-90 C80,-90 90,-70 80,-40 L-80,-40 C-95,-60 -95,-85 -80,-90 Z" fill="${color}" ${stroke(5)}/><path d="M60,-90 L95,-110 L120,-90 L110,-60 L80,-60" fill="${color}" ${stroke(5)}/><path d="M95,-110 c-10,-25 10,-30 0,-40 M112,-104 c15,-20 25,-20 20,-38" fill="none" stroke="${C.cream}" stroke-width="6"/>${[-70, -40, 30, 60].map((ox) => `<line x1="${ox}" y1="-40" x2="${ox}" y2="0" ${stroke(9)}/>`).join("")}<path d="M-82,-84 c-20,10 -15,40 -24,46" fill="none" ${stroke(4)}/></g>`;

const lotus = (x, y, s = 1) =>
  `<g transform="translate(${x},${y}) scale(${s})"><line x1="0" y1="0" x2="0" y2="-120" ${stroke(6)}/>${[-50, -25, 0, 25, 50].map((a) => `<path d="M0,-120 C-22,-160 -10,-210 0,-220 C10,-210 22,-160 0,-120 Z" fill="${a === 0 ? C.cream : C.clay}" ${stroke(4)} transform="rotate(${a} 0 -120)"/>`).join("")}<path d="M-50,-10 C-30,-50 30,-50 50,-10" fill="${C.clayDark}" ${stroke(4)}/></g>`;

const swirl = (x, y, r, color = C.cream) =>
  `<path d="M${x},${y} m${-r},0 a${r},${r} 0 1,1 ${r * 2},0 a${r * 0.7},${r * 0.7} 0 1,1 ${-r * 1.4},0 a${r * 0.4},${r * 0.4} 0 1,1 ${r * 0.8},0" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;

const frame = (inner) => svg(W, H, `${inner}${meander(6)}${meander(H - 40)}`, C.glaze);

// ---------------------------------------------------------------- scenes

export const scenes = {
  telemachus: frame(`
    <rect x="80" y="120" width="1120" height="420" fill="#231912"/>
    <path d="M60,130 L640,60 L1220,130 Z" fill="${C.cream}" ${stroke(6)}/>
    ${columns(130, 7, 170, 150, 560)}
    <rect x="0" y="560" width="${W}" height="120" fill="${C.clayDark}"/>
    ${[260, 380, 900, 1020].map((x, i) => seated(x, 600, 0.9, { color: i % 2 ? C.clay : C.clayDark })).join("")}
    ${person(640, 640, 1.5, { arm: "up", item: `<line x1="40" y1="-190" x2="40" y2="20" ${stroke(6)}/><path d="M40,-230 l12,40 h-24 Z" fill="${C.cream}" ${stroke(4)}/>` })}
    <g transform="translate(980,200)"><ellipse cx="0" cy="0" rx="34" ry="44" fill="${C.cream}" ${stroke(5)}/><circle cx="-12" cy="-10" r="10" fill="${C.gold}" ${stroke(3)}/><circle cx="12" cy="-10" r="10" fill="${C.gold}" ${stroke(3)}/><path d="M-34,0 C-80,-30 -110,-10 -120,10 M34,0 C80,-30 110,-10 120,10" fill="none" ${stroke(8)}/></g>`),

  calypso: frame(`
    ${sun(1080, 170, 50)}
    <rect x="0" y="420" width="${W}" height="300" fill="#1f1610"/>
    ${waveBand(470, C.clayDark, 14)}${waveBand(540, C.clay, 18)}
    <path d="M0,440 C150,380 400,380 600,440 L600,720 L0,720 Z" fill="${C.clay}" ${stroke(6)}/>
    <path d="M60,440 C60,250 300,230 330,440 Z" fill="${C.line}" stroke="${C.cream}" stroke-width="6"/>
    ${[140, 220, 300].map((x) => `<path d="M${x},${440 - (x % 3) * 10} C${x - 30},300 ${x + 20},260 ${x - 10},200" fill="none" stroke="${C.clayDark}" stroke-width="12"/><circle cx="${x - 10}" cy="196" r="30" fill="${C.clayDark}" ${stroke(4)}/>`).join("")}
    ${seated(470, 470, 1.1, { slump: true })}
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${640 + i * 30}" y="380" width="26" height="140" rx="10" fill="${C.cream}" ${stroke(4)} transform="rotate(70 700 450)"/>`).join("")}`),

  phaeacians: frame(`
    <rect x="80" y="120" width="1120" height="440" fill="#231912"/>
    ${columns(170, 6, 190, 140, 560)}
    <rect x="0" y="560" width="${W}" height="120" fill="${C.clayDark}"/>
    ${person(380, 620, 1.4, { arm: "forward", item: `<path d="M70,-150 C40,-150 40,-80 70,-80 M70,-150 C100,-150 100,-80 70,-80" fill="none" ${stroke(5)}/><line x1="62" y1="-140" x2="62" y2="-90" ${stroke(2)}/><line x1="78" y1="-140" x2="78" y2="-90" ${stroke(2)}/>` })}
    ${seated(820, 640, 1.4, { slump: true })}
    <path d="M870,420 q-8,20 0,30 q8,-10 0,-30" fill="${C.cream}"/><path d="M890,440 q-8,20 0,30 q8,-10 0,-30" fill="${C.cream}"/>
    ${person(1040, 640, 1.2, { color: C.clayDark })}`),

  "lotus-eaters": frame(`
    <rect x="0" y="380" width="${W}" height="340" fill="#1f1610"/>
    ${waveBand(420, C.clayDark, 12)}
    ${ship(1050, 400, 0.6)}
    <path d="M0,500 C300,450 700,460 1280,520 L1280,720 L0,720 Z" fill="${C.clay}" ${stroke(6)}/>
    ${[120, 330, 540, 760, 980, 1180].map((x, i) => lotus(x, 600 + (i % 2) * 30, 0.9 + (i % 3) * 0.15)).join("")}
    <g transform="translate(420,640) rotate(-75)">${person(0, 0, 1, {})}</g>
    <g transform="translate(860,650) rotate(80)">${person(0, 0, 1, { color: C.clayDark })}</g>
    ${person(650, 650, 1.2, { arm: "forward", color: C.cream })}`),

  cyclops: frame(`
    <path d="M0,60 L1280,60 L1280,720 L0,720 Z" fill="#2a1d14"/>
    <path d="M0,720 L0,200 C200,80 600,60 760,200 L760,720 Z" fill="${C.line}"/>
    <g transform="translate(400,330)">
      <ellipse cx="0" cy="0" rx="230" ry="210" fill="${C.clay}" ${stroke(8)}/>
      <ellipse cx="0" cy="-30" rx="80" ry="56" fill="${C.cream}" ${stroke(7)}/><circle cx="0" cy="-30" r="34" fill="${C.line}"/>
      <path d="M-110,-110 C-50,-150 50,-150 110,-110" fill="none" ${stroke(14)}/>
      <path d="M-90,90 C-40,130 40,130 90,90" fill="${C.line}" ${stroke(6)}/>
      ${[-60, -20, 20, 60].map((x) => `<rect x="${x - 10}" y="92" width="20" height="22" fill="${C.cream}"/>`).join("")}
      <line x1="230" y1="-60" x2="330" y2="-150" stroke="${C.clayDark}" stroke-width="26" stroke-linecap="round"/>
    </g>
    ${sea(520)}
    ${ship(1000, 560, 0.8, { flip: true })}
    ${person(1000, 470, 0.5, { arm: "up" })}
    ${[160, 260].map((x) => `<g transform="translate(${x},640)"><ellipse rx="60" ry="34" fill="${C.cream}" ${stroke(5)}/>${[-40, -15, 10, 35].map((o) => `<circle cx="${o}" cy="-18" r="16" fill="${C.cream}" ${stroke(3)}/>`).join("")}<circle cx="60" cy="-20" r="18" fill="${C.line}"/></g>`).join("")}`),

  aeolus: frame(`
    ${swirl(240, 220, 70)}${swirl(1040, 200, 80)}${swirl(640, 150, 50)}${swirl(860, 320, 40)}${swirl(420, 330, 44)}
    <g transform="translate(640,320)"><path d="M-120,0 C-150,-150 150,-150 120,0 C100,60 -100,60 -120,0 Z" fill="${C.clay}" ${stroke(7)}/><path d="M-30,-110 L30,-110 L20,-160 L-20,-160 Z" fill="${C.clayDark}" ${stroke(5)}/><line x1="-40" y1="-115" x2="40" y2="-115" stroke="${C.gold}" stroke-width="8"/>${[-60, 0, 60].map((x) => `<path d="M${x},-160 C${x - 40},-220 ${x + 40},-240 ${x},-300" fill="none" stroke="${C.cream}" stroke-width="7" stroke-dasharray="20 14"/>`).join("")}</g>
    ${sea(500)}
    <g transform="rotate(-12 900 540)">${ship(900, 540, 0.75)}</g>
    <g transform="rotate(10 330 560)">${ship(330, 560, 0.6, { sail: false })}</g>`),

  circe: frame(`
    <rect x="70" y="110" width="1140" height="460" fill="#231912"/>
    <path d="M50,120 L640,60 L1230,120 Z" fill="${C.cream}" ${stroke(6)}/>
    ${columns(120, 2, 150, 140, 570)}${columns(1010, 2, 150, 140, 570)}
    <rect x="0" y="570" width="${W}" height="110" fill="${C.clayDark}"/>
    ${person(560, 640, 1.6, { color: C.cream, arm: "forward", item: `<line x1="80" y1="-120" x2="170" y2="-260" ${stroke(6)}/><circle cx="172" cy="-264" r="10" fill="${C.gold}" ${stroke(3)}/><path d="M-60,-60 l40,0 c0,20 -10,30 -20,30 c-10,0 -20,-10 -20,-30 Z" fill="${C.gold}" ${stroke(3)}/>` })}
    ${person(330, 640, 1.4, { arm: "forward", item: `<line x1="80" y1="-120" x2="170" y2="-130" stroke="${C.cream}" stroke-width="8"/>` })}
    ${pig(800, 650, 0.9)}${pig(980, 640, 0.8)}${pig(1140, 660, 0.7)}`),

  underworld: frame(`
    <rect x="0" y="40" width="${W}" height="640" fill="#0d0907"/>
    ${[150, 300, 980, 1130, 820].map((x, i) => `<g opacity="${0.35 + (i % 3) * 0.15}"><path d="M${x - 40},${560} C${x - 50},${400} ${x - 30},${300} ${x},${290} C${x + 30},${300} ${x + 50},${400} ${x + 40},${560} C${x + 20},${540} ${x},${570} ${x - 20},${545} Z" fill="none" stroke="${C.cream}" stroke-width="5"/><circle cx="${x}" cy="${265}" r="26" fill="none" stroke="${C.cream}" stroke-width="5"/></g>`).join("")}
    <g opacity="0.7"><path d="M560,560 C550,400 570,320 600,310 C630,320 650,400 640,560 Z" fill="none" stroke="${C.cream}" stroke-width="6"/><circle cx="600" cy="285" r="28" fill="none" stroke="${C.cream}" stroke-width="6"/><path d="M560,360 L520,330 M640,360 L700,340" stroke="${C.cream}" stroke-width="6"/></g>
    ${person(800, 620, 1.3, { arm: "forward", item: `<line x1="80" y1="-120" x2="160" y2="-110" stroke="${C.cream}" stroke-width="8"/>` })}
    <rect x="0" y="600" width="${W}" height="80" fill="#2a1d14"/>
    <path d="M440,620 C480,650 640,650 680,620" fill="#5a1d14" ${stroke(5)}/>
    ${[90, 220, 380, 1010, 1180].map((x) => `<g transform="translate(${x},620)"><line x1="0" y1="0" x2="0" y2="-60" stroke="${C.clayDark}" stroke-width="5"/>${[-1, 0, 1].map((o) => `<path d="M0,${-60 + o * 14} l${10 * (o || 1)},-12" stroke="${C.cream}" stroke-width="5"/>`).join("")}</g>`).join("")}`),

  sirens: frame(`
    ${sea(420)}
    ${island(200, 500, 420, 220)}${island(1110, 520, 360, 200, C.clayDark)}
    ${[150, 230].map((x, i) => `<g transform="translate(${x + 10},${370 - i * 20})"><ellipse cx="0" cy="0" rx="46" ry="30" fill="${C.clay}" ${stroke(5)}/><path d="M-40,-6 C-90,-60 -60,-90 -10,-30" fill="${C.cream}" ${stroke(4)}/><circle cx="40" cy="-34" r="20" fill="${C.cream}" ${stroke(4)}/><path d="M28,-50 c10,-14 26,-10 30,4" fill="${C.line}"/><path d="M-10,28 l-8,22 M14,28 l8,22" ${stroke(4)}/></g>`).join("")}
    <g transform="translate(1120,360)"><ellipse cx="0" cy="0" rx="46" ry="30" fill="${C.clay}" ${stroke(5)}/><path d="M40,-6 C90,-60 60,-90 10,-30" fill="${C.cream}" ${stroke(4)}/><circle cx="-40" cy="-34" r="20" fill="${C.cream}" ${stroke(4)}/><path d="M-28,-50 c-10,-14 -26,-10 -30,4" fill="${C.line}"/></g>
    ${[110, 150, 1080].map((x) => `<path d="M${x},470 l30,-6 M${x + 10},480 l26,8" stroke="${C.cream}" stroke-width="6" stroke-linecap="round"/>`).join("")}
    ${ship(650, 520, 1.05, { sail: false, mastMan: true })}
    ${[330, 390, 450].map((x) => `<path d="M${x},${200 + (x % 7)} c20,-10 30,10 50,0" fill="none" stroke="${C.gold}" stroke-width="5" opacity="0.8"/>`).join("")}`),

  "scylla-charybdis": frame(`
    <path d="M0,720 L0,90 L260,70 C320,200 340,400 360,720 Z" fill="${C.clayDark}" ${stroke(6)}/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${200 + i * 12},${200 + i * 30} C${380 + i * 25},${120 + i * 40} ${460 + i * 20},${260 + i * 18} ${520 + i * 18},${200 + i * 26}" fill="none" ${stroke(22)}/><path d="M${200 + i * 12},${200 + i * 30} C${380 + i * 25},${120 + i * 40} ${460 + i * 20},${260 + i * 18} ${520 + i * 18},${200 + i * 26}" fill="none" stroke="${C.clay}" stroke-width="12"/><path d="M${520 + i * 18},${190 + i * 26} l34,10 l-34,14 Z" fill="${C.clay}" ${stroke(4)}/>`).join("")}
    ${sea(430)}
    <g transform="translate(1040,560)">${[150, 115, 82, 52, 26].map((r, i) => `<ellipse rx="${r * 1.5}" ry="${r * 0.5}" fill="none" stroke="${i % 2 ? C.cream : C.clay}" stroke-width="8" transform="rotate(${i * 9})"/>`).join("")}<ellipse rx="22" ry="8" fill="${C.line}"/></g>
    <path d="M1180,720 L1280,300 L1280,720 Z" fill="${C.clayDark}" ${stroke(5)}/>
    ${ship(690, 540, 0.85)}`),

  "helios-cattle": frame(`
    ${sun(640, 190, 80)}
    <path d="M980,70 L930,200 L975,200 L920,330" fill="none" stroke="${C.gold}" stroke-width="12" stroke-linejoin="bevel"/>
    <path d="M0,430 C300,380 900,380 1280,430 L1280,720 L0,720 Z" fill="${C.clay}" ${stroke(6)}/>
    ${cow(220, 560, 1.1, C.cream)}${cow(520, 600, 1, C.clayDark)}${cow(880, 570, 1.05, C.cream)}
    ${person(1100, 640, 1.2, { arm: "forward" })}${person(1190, 650, 1.1, { color: C.clayDark, arm: "head" })}
    <g transform="translate(700,640)"><path d="M-40,0 L40,0 L30,-30 L-30,-30 Z" fill="${C.line}"/><path d="M-20,-30 c-10,-30 20,-30 10,-60 c20,20 30,40 0,60" fill="${C.gold}"/></g>`),

  "return-to-ithaca": frame(`
    <rect x="0" y="40" width="${W}" height="520" fill="#231912"/>
    <g transform="translate(180,560)"><path d="M-30,0 C-20,-120 -40,-200 0,-260 C40,-200 20,-120 30,0 Z" fill="${C.clayDark}" ${stroke(6)}/>${[[-120, -330, 90], [0, -380, 110], [120, -320, 90]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.6}" fill="${C.clay}" ${stroke(5)}/>`).join("")}${[-150, -100, -40, 30, 90, 150].map((x, i) => `<ellipse cx="${x}" cy="${-320 - (i % 2) * 40}" rx="16" ry="7" fill="${C.cream}" transform="rotate(-20 ${x} ${-320 - (i % 2) * 40})"/>`).join("")}<rect x="-90" y="-40" width="180" height="40" fill="${C.cream}" ${stroke(5)}/></g>
    ${Array.from({ length: 12 }, (_, i) => `<g transform="translate(${560 + i * 52},500)"><line x1="0" y1="0" x2="0" y2="-90" ${stroke(6)}/><path d="M-20,-90 C-20,-130 20,-130 20,-90 Z" fill="${C.cream}" ${stroke(4)}/><circle cx="0" cy="-104" r="8" fill="${C.line}"/></g>`).join("")}
    <rect x="0" y="560" width="${W}" height="120" fill="${C.clayDark}"/>
    <g transform="translate(420,640) scale(1.5)">
      <path d="M-22,-120 L22,-120 L42,0 L-42,0 Z" fill="${C.clay}" ${stroke(5)}/><circle cx="0" cy="-145" r="24" fill="${C.clay}" ${stroke(5)}/><path d="M-22,-150 C-20,-175 20,-175 22,-150" fill="${C.line}"/>
      <path d="M18,-112 L110,-118 M-18,-110 L60,-100" ${stroke(7)} fill="none"/>
      <path d="M110,-200 C150,-150 150,-80 110,-30" fill="none" ${stroke(8)}/><line x1="110" y1="-200" x2="110" y2="-30" stroke="${C.cream}" stroke-width="3"/>
      <line x1="40" y1="-115" x2="220" y2="-115" stroke="${C.cream}" stroke-width="4"/><path d="M220,-115 l-14,-8 v16 Z" fill="${C.cream}"/>
    </g>`),
};

// ---------------------------------------------------------------- journey map (1280 x 720)

export const mapSvg = () => {
  const land = (pts) => `<path d="M${pts.map((p) => p.join(",")).join(" L")} Z" fill="${C.clay}" ${stroke(5)}/>`;
  return svg(W, H, `
    <rect width="${W}" height="${H}" fill="#1f1610"/>
    ${[120, 260, 400, 540].map((y, i) => `<path d="M0,${y} ${Array.from({ length: 16 }, (_, k) => `q40,${i % 2 ? 10 : -10} 80,0`).join(" ")}" fill="none" stroke="${C.clayDark}" stroke-width="2" opacity="0.5"/>`).join("")}
    ${land([[330, 40], [430, 60], [470, 150], [520, 250], [560, 300], [600, 330], [585, 352], [560, 345], [540, 380], [520, 370], [500, 330], [470, 300], [430, 250], [390, 210], [340, 170], [300, 120], [250, 60], [250, 40]])}
    ${land([[465, 390], [560, 378], [548, 450], [480, 462], [448, 420]])}
    ${land([[210, 190], [255, 195], [262, 330], [215, 335]])}
    ${land([[230, 90], [260, 95], [262, 170], [232, 168]])}
    ${land([[640, 60], [720, 70], [760, 180], [740, 260], [775, 330], [745, 410], [700, 420], [690, 360], [660, 300], [650, 220], [620, 140]])}
    ${land([[900, 60], [1280, 50], [1280, 330], [1000, 340], [940, 300], [905, 220], [880, 140]])}
    ${land([[0, 610], [140, 600], [400, 560], [600, 595], [800, 605], [1280, 640], [1280, 720], [0, 720]])}
    ${land([[0, 400], [80, 410], [110, 470], [60, 520], [0, 520]])}
    <ellipse cx="850" cy="470" rx="70" ry="16" fill="${C.clay}" ${stroke(5)}/>
    ${[[615, 205, 14], [640, 300, 10], [500, 335, 9], [360, 270, 12], [425, 300, 7], [220, 465, 16], [440, 432, 10]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.clay}" ${stroke(4)}/>`).join("")}
    <g transform="translate(1160,600)"><circle r="44" fill="none" stroke="${C.cream}" stroke-width="4"/><path d="M0,-54 L10,0 L0,54 L-10,0 Z" fill="${C.cream}"/><text y="-62" text-anchor="middle" fill="${C.cream}" font-family="Georgia" font-size="22">N</text></g>
    ${meander(6)}${meander(H - 40)}`, C.glaze);
};

export const W_SCENE = W, H_SCENE = H;
