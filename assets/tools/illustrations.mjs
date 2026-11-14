// Story Mode illustrations: one object or creature per image, 900 x 900, transparent, red-figure palette.
// Ids match story/data/illustrations.json. No Node imports (the explorer can load it in the browser).
import { C, cow, pig, ship, stroke, swirl } from "./art.mjs";

const S = 900;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${body}</svg>`;
const g = (x, y, s, body, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})">${body}</g>`;
const st = stroke;

export const illustrations = {
  "trojan-horse": svg(`
    <rect x="160" y="700" width="580" height="40" rx="8" fill="${C.clayDark}" ${st(6)}/>
    ${[230, 380, 520, 670].map((x) => `<circle cx="${x}" cy="760" r="48" fill="${C.cream}" ${st(7)}/><circle cx="${x}" cy="760" r="12" fill="${C.line}"/>${[0, 45, 90, 135].map((a) => `<line x1="${x}" y1="760" x2="${x + 44 * Math.cos((a * Math.PI) / 180)}" y2="${760 + 44 * Math.sin((a * Math.PI) / 180)}" ${st(4)}/><line x1="${x}" y1="760" x2="${x - 44 * Math.cos((a * Math.PI) / 180)}" y2="${760 - 44 * Math.sin((a * Math.PI) / 180)}" ${st(4)}/>`).join("")}`).join("")}
    ${[250, 360, 540, 640].map((x, i) => `<path d="M${x},700 L${x + (i % 2 ? 10 : -10)},560 L${x + (i % 2 ? 30 : 10)},560 L${x + 26},700 Z" fill="${C.clay}" ${st(7)}/>`).join("")}
    <path d="M200,560 C200,430 300,380 460,380 C560,380 620,360 650,300 L700,180 C710,150 760,140 790,160 L840,200 C860,215 850,250 825,250 L770,250 L720,380 C700,450 700,560 650,580 L240,590 C215,590 200,580 200,560 Z" fill="${C.clay}" ${st(9)}/>
    ${[260, 330, 400, 470, 540, 610].map((x) => `<line x1="${x}" y1="400" x2="${x}" y2="580" ${st(4)} opacity="0.6"/>`).join("")}
    <path d="M230,470 L660,470" ${st(4)} opacity="0.6"/>
    <rect x="380" y="430" width="120" height="90" rx="6" fill="${C.clayDark}" ${st(6)}/><line x1="440" y1="430" x2="440" y2="520" ${st(4)}/>
    <path d="M700,180 C690,120 660,90 640,110 C660,140 650,190 640,250" fill="${C.line}"/>
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M${660 - i * 6},${130 + i * 26} l-34,10" ${st(8)}/>`).join("")}
    <circle cx="790" cy="190" r="10" fill="${C.cream}" ${st(3)}/>
    <path d="M200,500 C150,520 140,600 170,640" fill="none" ${st(16)}/>`),

  "troy-walls": svg(`
    <path d="M60,800 L60,380 L840,380 L840,800 Z" fill="${C.clay}" ${st(8)}/>
    ${[60, 270, 480, 690].map((x) => `<rect x="${x}" y="250" width="150" height="550" fill="${C.clay}" ${st(8)}/>${[0, 1, 2].map((i) => `<rect x="${x + 8 + i * 50}" y="215" width="34" height="40" fill="${C.clay}" ${st(6)}/>`).join("")}<rect x="${x + 55}" y="330" width="40" height="70" rx="20" fill="${C.line}"/>`).join("")}
    ${Array.from({ length: 9 }, (_, r) => Array.from({ length: 13 }, (_, c) => `<rect x="${60 + c * 60 + (r % 2) * 30}" y="${420 + r * 42}" width="60" height="42" fill="none" ${st(2)} opacity="0.35"/>`).join("")).join("")}
    <path d="M380,800 L380,600 C380,540 520,540 520,600 L520,800 Z" fill="${C.line}"/>
    <path d="M380,800 L380,600 C380,540 520,540 520,600 L520,800" fill="none" stroke="${C.cream}" stroke-width="8"/>`),

  "wooden-stake": svg(g(450, 450, 1, `
    <path d="M-380,40 L260,40 L400,0 L260,-40 L-380,-40 Z" fill="${C.clay}" ${st(8)}/>
    <path d="M260,40 L400,0 L260,-40 Z" fill="${C.line}"/>
    ${[-300, -180, -60, 60, 180].map((x) => `<path d="M${x},-30 q20,30 0,60" fill="none" ${st(4)} opacity="0.6"/>`).join("")}
    ${[0, 1, 2].map((i) => `<path d="M${330 + i * 30},${-60 - i * 20} c-20,-40 30,-50 10,-100" fill="none" stroke="${C.gold}" stroke-width="10" stroke-linecap="round"/>`).join("")}`, -20)),

  "cyclops-eye": svg(`
    <ellipse cx="450" cy="450" rx="400" ry="300" fill="${C.clay}" ${st(10)}/>
    <path d="M110,280 C250,150 650,150 790,280" fill="none" ${st(30)}/>
    <ellipse cx="450" cy="470" rx="260" ry="170" fill="${C.cream}" ${st(10)}/>
    <circle cx="450" cy="470" r="130" fill="${C.clayDark}" ${st(8)}/>
    <circle cx="450" cy="470" r="70" fill="${C.line}"/>
    <circle cx="490" cy="430" r="22" fill="${C.cream}"/>
    ${[200, 300, 400, 500, 600, 700].map((x) => `<line x1="${x}" y1="${300 + Math.abs(x - 450) * 0.15}" x2="${x - 10}" y2="${250 + Math.abs(x - 450) * 0.15}" ${st(8)}/>`).join("")}`),

  ram: svg(`
    <ellipse cx="420" cy="420" rx="300" ry="180" fill="${C.cream}" ${st(9)}/>
    ${Array.from({ length: 22 }, (_, i) => `<circle cx="${180 + (i % 11) * 48}" cy="${330 + Math.floor(i / 11) * 80}" r="34" fill="${C.cream}" ${st(4)}/>`).join("")}
    <ellipse cx="720" cy="340" rx="90" ry="70" fill="${C.clay}" ${st(8)}/>
    <path d="M700,290 C640,200 760,170 780,250 C790,290 760,310 740,300" fill="none" stroke="${C.clayDark}" stroke-width="24" stroke-linecap="round"/>
    <circle cx="760" cy="330" r="10" fill="${C.line}"/>
    ${[230, 330, 520, 620].map((x) => `<line x1="${x}" y1="580" x2="${x}" y2="760" ${st(22)}/>`).join("")}
    <path d="M220,610 L600,610" fill="none" ${st(40)}/><path d="M220,610 L600,610" fill="none" stroke="${C.clay}" stroke-width="28" stroke-linecap="round"/>
    <circle cx="640" cy="608" r="34" fill="${C.clay}" ${st(6)}/>
    ${[260, 340].map((x) => `<path d="M${x},610 L${x - 10},560" ${st(10)}/>`).join("")}`),

  "wax-and-rope": svg(`
    <ellipse cx="300" cy="560" rx="200" ry="70" fill="${C.gold}" ${st(8)}/>
    <path d="M100,560 L100,470 C100,430 500,430 500,470 L500,560" fill="${C.gold}" ${st(8)}/>
    <ellipse cx="300" cy="470" rx="200" ry="70" fill="#f3d27a" ${st(8)}/>
    ${[0, 1, 2, 3].map((i) => `<path d="M${180 + i * 60},450 l30,30" ${st(5)}/>`).join("")}
    ${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="620" cy="${360 + i * 60}" rx="${170 - i * 6}" ry="54" fill="none" ${st(30)}/><ellipse cx="620" cy="${360 + i * 60}" rx="${170 - i * 6}" ry="54" fill="none" stroke="${C.cream}" stroke-width="18"/>`).join("")}
    <path d="M780,600 C840,680 760,760 820,840" fill="none" ${st(30)}/><path d="M780,600 C840,680 760,760 820,840" fill="none" stroke="${C.cream}" stroke-width="18" stroke-linecap="round"/>`),

  siren: svg(`
    <path d="M250,520 C150,420 140,300 220,260 C300,360 360,420 420,450 Z" fill="${C.cream}" ${st(8)}/>
    <path d="M640,520 C760,420 780,300 700,250 C620,360 540,420 480,450 Z" fill="${C.cream}" ${st(8)}/>
    ${[0, 1, 2, 3].map((i) => `<path d="M${200 + i * 40},${300 + i * 40} l60,40" ${st(4)}/><path d="M${700 - i * 40},${300 + i * 40} l-60,40" ${st(4)}/>`).join("")}
    <ellipse cx="450" cy="540" rx="190" ry="130" fill="${C.clay}" ${st(9)}/>
    <path d="M280,560 C220,640 180,700 160,760 C240,720 300,680 330,640" fill="${C.clayDark}" ${st(7)}/>
    <circle cx="450" cy="330" r="96" fill="${C.cream}" ${st(8)}/>
    <path d="M354,320 C350,200 550,200 546,320 C520,270 380,270 354,320 Z" fill="${C.line}"/>
    <path d="M360,330 C340,420 360,470 380,480 M540,330 C560,420 540,470 520,480" fill="none" stroke="${C.line}" stroke-width="22" stroke-linecap="round"/>
    <circle cx="418" cy="330" r="10" fill="${C.line}"/><circle cx="482" cy="330" r="10" fill="${C.line}"/>
    <ellipse cx="450" cy="378" rx="22" ry="18" fill="${C.line}"/>
    ${[390, 510].map((x) => `<path d="M${x},660 l-20,80 M${x},660 l0,84 M${x},660 l20,80" ${st(7)}/>`).join("")}
    ${[0, 1, 2].map((i) => `<path d="M${600 + i * 50},${200 - i * 40} c20,-20 40,10 60,-10" fill="none" stroke="${C.gold}" stroke-width="10" stroke-linecap="round"/>`).join("")}`),

  "bag-of-winds": svg(`
    ${swirl(170, 230, 70)}${swirl(730, 220, 80)}${swirl(160, 650, 50)}${swirl(760, 660, 60)}
    <path d="M250,560 C180,380 300,250 450,250 C600,250 720,380 650,560 C620,680 280,680 250,560 Z" fill="${C.clay}" ${st(10)}/>
    ${[320, 400, 500, 580].map((x) => `<path d="M${x},320 C${x - 20},420 ${x + 20},520 ${x},620" fill="none" ${st(4)} opacity="0.5"/>`).join("")}
    <path d="M390,250 L360,170 L540,170 L510,250 Z" fill="${C.clayDark}" ${st(8)}/>
    <path d="M370,240 C420,262 480,262 530,240" fill="none" stroke="#e6e6ea" stroke-width="14"/>
    ${[-1, 0, 1].map((k) => `<path d="M${450 + k * 50},170 C${450 + k * 120},100 ${450 + k * 40},60 ${450 + k * 90},20" fill="none" stroke="${C.cream}" stroke-width="10" stroke-dasharray="24 16" stroke-linecap="round"/>`).join("")}`),

  ship: svg(g(450, 560, 2, `${ship(0, 0, 1, { sail: true }).replace(/^<g[^>]*>|<\/g>$/g, "")}`)),

  "magic-cup": svg(`
    <path d="M180,360 L560,360 C560,520 480,600 370,600 C260,600 180,520 180,360 Z" fill="${C.clay}" ${st(10)}/>
    <ellipse cx="370" cy="360" rx="190" ry="40" fill="#5b2a4f" ${st(8)}/>
    ${[0, 1, 2].map((i) => `<path d="M${300 + i * 70},330 c-20,-50 30,-70 10,-130" fill="none" stroke="#b78bd0" stroke-width="12" stroke-linecap="round" opacity="0.8"/>`).join("")}
    <path d="M180,400 C100,400 100,500 200,500 M560,400 C640,400 640,500 540,500" fill="none" ${st(12)}/>
    <path d="M340,600 L320,720 L420,720 L400,600" fill="${C.clay}" ${st(8)}/>
    <ellipse cx="370" cy="740" rx="140" ry="34" fill="${C.clayDark}" ${st(8)}/>
    ${[260, 330, 400, 470].map((x) => `<path d="M${x},440 l20,30 l20,-30" fill="none" ${st(5)}/>`).join("")}
    <line x1="660" y1="800" x2="800" y2="160" ${st(18)}/><line x1="660" y1="800" x2="800" y2="160" stroke="${C.gold}" stroke-width="8"/>
    <circle cx="805" cy="140" r="30" fill="${C.gold}" ${st(7)}/>
    ${[0, 60, 120, 180, 240, 300].map((a) => `<line x1="${805 + 40 * Math.cos((a * Math.PI) / 180)}" y1="${140 + 40 * Math.sin((a * Math.PI) / 180)}" x2="${805 + 70 * Math.cos((a * Math.PI) / 180)}" y2="${140 + 70 * Math.sin((a * Math.PI) / 180)}" stroke="${C.gold}" stroke-width="7" stroke-linecap="round"/>`).join("")}`),

  pig: svg(g(420, 640, 3.6, pig(0, 0, 1).replace(/^<g[^>]*>|<\/g>$/g, ""))),

  raft: svg(`
    <path d="M60,700 C200,660 300,740 450,700 C600,660 700,740 840,700 L840,800 L60,800 Z" fill="${C.clayDark}" opacity="0.8"/>
    <g transform="rotate(-6 450 600)">
      ${Array.from({ length: 8 }, (_, i) => `<rect x="${170 + i * 72}" y="520" width="64" height="150" rx="26" fill="${C.clay}" ${st(7)}/>`).join("")}
      <line x1="150" y1="560" x2="760" y2="560" ${st(10)}/><line x1="150" y1="630" x2="760" y2="630" ${st(10)}/>
      <line x1="460" y1="560" x2="460" y2="160" ${st(14)}/>
      <path d="M330,180 L600,180 L580,460 L340,460 Z" fill="${C.cream}" ${st(8)}/>
      ${[400, 465, 530].map((x) => `<line x1="${x}" y1="180" x2="${x - 4}" y2="460" ${st(3)} opacity="0.5"/>`).join("")}
      <path d="M700,520 L740,420 L760,520" fill="${C.clayDark}" ${st(6)}/>
    </g>`),

  "great-wave": svg(`
    <path d="M60,820 C60,520 220,220 520,170 C700,140 820,250 800,380 C780,470 680,500 620,450 C560,400 610,320 670,340 C620,260 470,300 420,420 C360,560 420,700 560,820 Z" fill="${C.clay}" ${st(10)}/>
    <path d="M140,800 C150,560 280,330 500,260" fill="none" stroke="${C.cream}" stroke-width="14" stroke-linecap="round"/>
    <path d="M230,800 C240,600 320,450 440,380" fill="none" stroke="${C.cream}" stroke-width="10" stroke-linecap="round" opacity="0.7"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${560 + i * 40},${180 + (i % 2) * 20} q20,-40 40,0" fill="none" stroke="${C.cream}" stroke-width="9" stroke-linecap="round"/>`).join("")}
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${620 + i * 30}" cy="${150 + (i % 3) * 18}" r="9" fill="${C.cream}"/>`).join("")}`),

  trident: svg(`
    <line x1="450" y1="860" x2="450" y2="250" ${st(30)}/><line x1="450" y1="860" x2="450" y2="250" stroke="${C.gold}" stroke-width="16"/>
    <path d="M250,80 L250,300 Q250,340 290,340 L610,340 Q650,340 650,300 L650,80" fill="none" ${st(30)}/>
    <path d="M250,80 L250,300 Q250,340 290,340 L610,340 Q650,340 650,300 L650,80" fill="none" stroke="${C.gold}" stroke-width="16"/>
    <line x1="450" y1="40" x2="450" y2="340" ${st(30)}/><line x1="450" y1="40" x2="450" y2="340" stroke="${C.gold}" stroke-width="16"/>
    ${[250, 450, 650].map((x) => `<path d="M${x - 30},${x === 450 ? 70 : 110} L${x},${x === 450 ? 10 : 50} L${x + 30},${x === 450 ? 70 : 110} Z" fill="${C.gold}" ${st(7)}/>`).join("")}
    ${[480, 560, 640].map((y) => `<line x1="420" y1="${y}" x2="480" y2="${y}" ${st(8)}/>`).join("")}`),

  bow: svg(`
    <path d="M260,90 C120,200 180,330 330,450 C180,570 120,700 260,810" fill="none" ${st(40)}/>
    <path d="M260,90 C120,200 180,330 330,450 C180,570 120,700 260,810" fill="none" stroke="${C.clay}" stroke-width="24" stroke-linecap="round"/>
    <rect x="300" y="410" width="60" height="80" rx="10" fill="${C.clayDark}" ${st(6)}/>
    <line x1="260" y1="90" x2="380" y2="450" stroke="${C.cream}" stroke-width="5"/><line x1="380" y1="450" x2="260" y2="810" stroke="${C.cream}" stroke-width="5"/>
    <line x1="380" y1="450" x2="820" y2="450" ${st(12)}/><line x1="380" y1="450" x2="820" y2="450" stroke="${C.cream}" stroke-width="5"/>
    <path d="M820,450 l-50,-24 l0,48 Z" fill="${C.cream}" ${st(6)}/>
    <path d="M380,450 l40,-26 M380,450 l40,26 M410,450 l40,-26 M410,450 l40,26" ${st(7)}/>`),

  "twelve-axes": svg(`
    <rect x="40" y="690" width="820" height="40" rx="8" fill="${C.clayDark}" ${st(6)}/>
    ${Array.from({ length: 12 }, (_, i) => {
      const x = 90 + i * 66;
      return `<line x1="${x}" y1="690" x2="${x}" y2="450" ${st(10)}/><path d="M${x - 34},450 C${x - 34},380 ${x + 34},380 ${x + 34},450 Z" fill="${C.cream}" ${st(6)}/><circle cx="${x}" cy="418" r="14" fill="${C.line}"/>`;
    }).join("")}
    <line x1="20" y1="418" x2="880" y2="418" stroke="${C.gold}" stroke-width="6" stroke-dasharray="16 10"/>
    <path d="M880,418 l-40,-20 l0,40 Z" fill="${C.gold}" ${st(5)}/>`),

  "olive-bed": svg(`
    <path d="M420,720 C400,560 430,420 400,300 C450,320 480,320 500,300 C480,420 510,560 490,720 Z" fill="${C.clayDark}" ${st(8)}/>
    ${[[300, 200, 130], [450, 140, 150], [600, 210, 130]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.62}" fill="${C.clay}" ${st(7)}/>`).join("")}
    ${[220, 290, 370, 450, 530, 610, 680].map((x, i) => `<ellipse cx="${x}" cy="${180 + (i % 3) * 40}" rx="22" ry="9" fill="${C.cream}" transform="rotate(-25 ${x} ${180 + (i % 3) * 40})"/>`).join("")}
    ${[330, 520, 600].map((x, i) => `<circle cx="${x}" cy="${240 + i * 10}" r="12" fill="${C.line}"/>`).join("")}
    <rect x="100" y="560" width="700" height="80" rx="14" fill="${C.cream}" ${st(8)}/>
    <rect x="100" y="520" width="700" height="50" rx="20" fill="${C.clay}" ${st(7)}/>
    <rect x="90" y="470" width="60" height="300" rx="10" fill="${C.clay}" ${st(7)}/><rect x="750" y="500" width="60" height="270" rx="10" fill="${C.clay}" ${st(7)}/>
    ${[200, 300, 600, 700].map((x) => `<path d="M${x},600 l20,20 l20,-20" fill="none" ${st(4)}/>`).join("")}`),

  loom: svg(`
    <line x1="150" y1="80" x2="190" y2="840" ${st(26)}/><line x1="750" y1="80" x2="710" y2="840" ${st(26)}/>
    <rect x="120" y="90" width="660" height="40" rx="10" fill="${C.clay}" ${st(7)}/>
    ${Array.from({ length: 16 }, (_, i) => `<line x1="${200 + i * 32}" y1="130" x2="${200 + i * 32}" y2="${700}" stroke="${C.cream}" stroke-width="3"/>`).join("")}
    <rect x="195" y="130" width="500" height="300" fill="${C.clay}" ${st(6)}/>
    ${Array.from({ length: 7 }, (_, i) => `<path d="M${215 + i * 70},170 l25,25 h25 v-25 h-25" fill="none" stroke="${C.cream}" stroke-width="7"/>`).join("")}
    ${Array.from({ length: 7 }, (_, i) => `<path d="M${215 + i * 70},380 l30,-30 l30,30" fill="none" ${st(6)}/>`).join("")}
    <path d="M195,430 L695,430" fill="none" ${st(6)} stroke-dasharray="14 10"/>
    ${Array.from({ length: 16 }, (_, i) => `<path d="M${200 + i * 32},700 l-6,60 h12 Z" fill="${C.clayDark}" ${st(3)}/>`).join("")}
    <path d="M600,560 C640,520 700,540 710,600" fill="none" stroke="${C.gold}" stroke-width="8" stroke-linecap="round"/>`),

  owl: svg(`
    <path d="M450,300 C220,250 80,400 60,560 C200,500 280,520 330,560 Z" fill="${C.clay}" ${st(8)}/>
    <path d="M450,300 C680,250 820,400 840,560 C700,500 620,520 570,560 Z" fill="${C.clay}" ${st(8)}/>
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M${110 + i * 45},${520 - i * 25} l40,60" ${st(5)}/><path d="M${790 - i * 45},${520 - i * 25} l-40,60" ${st(5)}/>`).join("")}
    <ellipse cx="450" cy="520" rx="150" ry="210" fill="${C.clay}" ${st(9)}/>
    ${Array.from({ length: 12 }, (_, i) => `<path d="M${380 + (i % 4) * 46},${560 + Math.floor(i / 4) * 50} q20,24 40,0" fill="none" ${st(4)}/>`).join("")}
    <path d="M340,320 L320,240 L390,300 Z M560,320 L580,240 L510,300 Z" fill="${C.clay}" ${st(7)}/>
    <circle cx="395" cy="400" r="58" fill="${C.cream}" ${st(7)}/><circle cx="505" cy="400" r="58" fill="${C.cream}" ${st(7)}/>
    <circle cx="395" cy="400" r="26" fill="${C.line}"/><circle cx="505" cy="400" r="26" fill="${C.line}"/>
    <path d="M430,450 L470,450 L450,500 Z" fill="${C.gold}" ${st(5)}/>
    ${[410, 450, 490].map((x) => `<path d="M${x},720 l-12,40 M${x},720 l12,40" ${st(7)}/>`).join("")}`),

  ghost: svg(`
    <g opacity="0.92">
      <path d="M300,840 C280,600 300,420 360,330 C330,270 340,180 450,170 C560,180 570,270 540,330 C600,420 620,600 600,840 C560,800 530,850 500,810 C470,850 430,850 400,810 C370,850 340,800 300,840 Z" fill="none" stroke="${C.cream}" stroke-width="12" stroke-linejoin="round"/>
      <circle cx="420" cy="250" r="14" fill="${C.cream}"/><circle cx="480" cy="250" r="14" fill="${C.cream}"/>
      <path d="M420,300 Q450,320 480,300" fill="none" stroke="${C.cream}" stroke-width="8" stroke-linecap="round"/>
      <path d="M360,420 C260,460 220,540 240,600 M540,420 C640,460 680,540 660,600" fill="none" stroke="${C.cream}" stroke-width="12" stroke-linecap="round"/>
      ${[0, 1, 2, 3].map((i) => `<path d="M${380 + i * 40},440 C${370 + i * 40},560 ${390 + i * 40},680 ${380 + i * 40},780" fill="none" stroke="${C.cream}" stroke-width="4" opacity="0.6"/>`).join("")}
    </g>`),
};

export const illustrationIds = Object.keys(illustrations);
