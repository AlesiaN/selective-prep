/* Practice question generators for the Practice > Maths topics drills.
   Every question is made fresh from a seed, so each attempt is different but can be resumed.
   Each generator returns { skill, difficulty, stem, svg?, answer, wrong: [[option, likely mistake], ...], explanation }.
   window.PracticeGen.make(topicCode | 'mixed', seed, count) returns a test object in the same format as tests/*.json. */
(() => {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  let R = Math.random;
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const n = (x) => (Math.round(x * 1000) / 1000).toLocaleString('en-AU', { maximumFractionDigits: 3 });
  const money = (c) => '$' + (c / 100).toFixed(2);
  const frac = (a, b) => { const g = gcd(a, b); return b / g === 1 ? String(a / g) : `${a / g}/${b / g}`; };
  const hm = (mins) => { const h = Math.floor(mins / 60), m = mins % 60; return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`; };
  const clock = (mins) => { // minutes after midnight -> 12-hour time
    mins = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  };
  const NAMES = ['Ava', 'Leo', 'Mia', 'Noah', 'Zara', 'Kai', 'Ruby', 'Omar', 'Isla', 'Hugo', 'Priya', 'Tom', 'Lena', 'Sam', 'Chloe', 'Arjun'];

  // ---------- SVG helpers (same style as the test files) ----------
  const svg = (w, h, body, maxw) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="max-width:${maxw || w}px" font-family="sans-serif" font-size="14" fill="none" stroke="currentColor" stroke-width="2">${body}</svg>`;
  const T = (x, y, s, size = 14, anchor = 'middle', weight = 'normal') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" fill="currentColor" stroke="none">${s}</text>`;
  const L = (x1, y1, x2, y2, w = 2, extra = '') => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="${w}" ${extra}/>`;
  const P = (pts, fill = false) => `<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" ${fill ? 'fill="currentColor" fill-opacity="0.12"' : ''}/>`;
  const arc = (cx, cy, r, a1, a2) => { // degrees, measured anticlockwise from east (screen y flipped)
    const p = (a) => [cx + r * Math.cos(a * Math.PI / 180), cy - r * Math.sin(a * Math.PI / 180)];
    const [x1, y1] = p(a1), [x2, y2] = p(a2);
    return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${a2 - a1 > 180 ? 1 : 0} 0 ${x2.toFixed(1)},${y2.toFixed(1)}" stroke-width="1.5"/>`;
  };
  const ray = (cx, cy, len, a) => L(cx, cy, cx + len * Math.cos(a * Math.PI / 180), cy - len * Math.sin(a * Math.PI / 180));
  const lab = (cx, cy, r, a, s) => T(cx + r * Math.cos(a * Math.PI / 180), cy - r * Math.sin(a * Math.PI / 180) + 5, s, 14);

  // ---------- generators ----------
  const G = {};

  G.FRAC = [
    () => { // fraction of an amount, with the "how many are NOT" twist
      const d = pick([3, 4, 5, 6, 8]); const k = ri(1, d - 1); const g = gcd(k, d); const nn = k / g, dd = d / g;
      const tot = dd * ri(4, 12); const part = (tot / dd) * nn; const nm = pick(NAMES);
      const not = R() < 0.5;
      const ans = not ? tot - part : part;
      return { skill: 'Fraction of an amount', difficulty: 2,
        stem: `${nm} has ${tot} stickers. ${nn}/${dd} of them are shiny. How many stickers are ${not ? 'not shiny' : 'shiny'}?`,
        answer: n(ans), wrong: [[n(not ? part : tot - part), not ? 'that is the number that ARE shiny' : 'that is the number that are NOT shiny'], [n(tot / dd), 'that is only one part (1/' + dd + ')'], [n(tot * nn), 'multiplied without dividing by ' + dd], [n(tot - nn), 'took away the top number']],
        explanation: `One part is ${tot} ÷ ${dd} = ${tot / dd}. ${nn} parts are ${tot / dd} × ${nn} = ${part}.${not ? ` Not shiny: ${tot} − ${part} = ${ans}.` : ''}` };
    },
    () => { // add fractions with different denominators
      const [a, b] = pick([[2, 3], [3, 4], [2, 5], [4, 5], [3, 5], [2, 7], [3, 8], [4, 6], [6, 8]]);
      const x = ri(1, a - 1), y = ri(1, b - 1); const top = x * b + y * a, bot = a * b;
      return { skill: 'Adding fractions with different denominators', difficulty: 3,
        stem: `What is ${x}/${a} + ${y}/${b}?`,
        answer: frac(top, bot), wrong: [[`${x + y}/${a + b}`, 'added the tops and the bottoms'], [`${x + y}/${bot}`, 'changed the bottom but not the tops'], [frac(x * y, bot), 'multiplied instead of adding'], [frac(top, bot * 2), 'doubled the denominator']],
        explanation: `Use a common denominator of ${bot}: ${x}/${a} = ${x * b}/${bot} and ${y}/${b} = ${y * a}/${bot}. Add the tops: ${top}/${bot}${frac(top, bot) !== `${top}/${bot}` ? ` = ${frac(top, bot)}` : ''}.` };
    },
    () => { // whole from a part
      const d = pick([3, 4, 5, 6]); const k = ri(2, d - 1); if (gcd(k, d) > 1) return G.FRAC[2]();
      const whole = d * ri(3, 9); const part = (whole / d) * k;
      return { skill: 'Finding the whole from a fraction', difficulty: 3,
        stem: `${k}/${d} of a number is ${part}. What is the number?`,
        answer: n(whole), wrong: [[n(part * k / d), `found ${k}/${d} of ${part} instead`], [n(part / k), 'that is only 1/' + d + ' of the number'], [n(part * d), `multiplied by ${d} but didn't divide by ${k}`], [n(part + k + d), 'added the numbers']],
        explanation: `${k} parts are ${part}, so 1 part is ${part} ÷ ${k} = ${part / k}. The whole is ${d} parts: ${part / k} × ${d} = ${whole}.` };
    },
    () => { // order fractions
      const pool = shuffle([[1, 2], [2, 3], [3, 4], [3, 5], [5, 8], [4, 7], [5, 6], [7, 10], [2, 5], [7, 12], [5, 9]]).slice(0, 5);
      const big = pool.reduce((m, f) => (f[0] / f[1] > m[0] / m[1] ? f : m));
      const others = pool.filter((f) => f !== big);
      return { skill: 'Comparing fractions', difficulty: 3,
        stem: 'Which fraction is the largest?',
        answer: `${big[0]}/${big[1]}`, wrong: others.map((f) => [`${f[0]}/${f[1]}`, `${f[0]}/${f[1]} = ${n(f[0] / f[1])}, less than ${big[0]}/${big[1]} = ${n(big[0] / big[1])}`]),
        explanation: `Change each to a decimal (or a common denominator): ${pool.map((f) => `${f[0]}/${f[1]} ≈ ${n(f[0] / f[1])}`).join(', ')}. The largest is ${big[0]}/${big[1]}. A bigger bottom number does not mean a bigger fraction.` };
    },
  ];

  G.PCT = [
    () => {
      const p = pick([10, 20, 25, 50, 75, 5, 15, 30, 40]); const base = pick([20, 40, 60, 80, 120, 160, 200, 240, 360]);
      const ans = (p * base) / 100;
      return { skill: 'Percentage of an amount', difficulty: 2,
        stem: `What is ${p}% of ${base}?`,
        answer: n(ans), wrong: [[n(base - ans), `that is what is left after taking ${p}% away`], [n(base / p), `divided by ${p}`], [n(ans * 10), 'decimal point in the wrong place'], [n(ans + p), 'added the percentage on']],
        explanation: `10% of ${base} is ${base / 10}. ${p}% is ${p / 10} lots of that: ${n(base / 10)} × ${n(p / 10)} = ${n(ans)}.` };
    },
    () => {
      const price = pick([40, 60, 80, 120, 150, 200, 250]); const p = pick([10, 20, 25, 30, 40, 50]);
      const off = (price * p) / 100;
      return { skill: 'Discounts', difficulty: 2,
        stem: `A pair of shoes costs $${price}. In a sale they are ${p}% off. What is the sale price?`,
        answer: '$' + n(price - off), wrong: [['$' + n(off), 'that is the discount, not the new price'], ['$' + n(price + off), 'added the discount on'], ['$' + n(price - p), `took $${p} off instead of ${p}%`], ['$' + n(price - off / 2), 'halved the discount']],
        explanation: `${p}% of $${price} is $${n(off)}. Sale price: $${price} − $${n(off)} = $${n(price - off)}.` };
    },
    () => {
      const [a, b] = pick([[9, 12], [18, 24], [12, 16], [6, 24], [15, 20], [21, 28], [7, 20], [12, 15], [8, 32], [27, 30]]);
      const pc = (a / b) * 100;
      return { skill: 'Writing an amount as a percentage', difficulty: 3,
        stem: `${pick(NAMES)} scored ${a} out of ${b} in a spelling test. What percentage is that?`,
        answer: n(pc) + '%', wrong: [[a + '%', 'used the score as the percentage'], [n(100 - pc) + '%', 'that is the percentage wrong'], [n((b / a) * 100) + '%', 'divided the wrong way round'], [n(pc / 10) + '%', 'decimal point in the wrong place']],
        explanation: `${a}/${b} = ${frac(a, b)}. As a percentage: ${a} ÷ ${b} × 100 = ${n(pc)}%.` };
    },
  ];

  G.RAT = [
    () => {
      const a = ri(1, 4), b = ri(a + 1, 7); if (gcd(a, b) > 1) return G.RAT[0]();
      const tot = (a + b) * ri(3, 12); const [x, y] = shuffle(NAMES).slice(0, 2);
      const big = (tot / (a + b)) * b;
      return { skill: 'Sharing in a ratio', difficulty: 3,
        stem: `${x} and ${y} share $${tot} in the ratio ${a} : ${b}. How much does ${y} get?`,
        answer: '$' + n(big), wrong: [['$' + n(tot - big), `that is ${x}'s share`], ['$' + n(tot / 2), 'shared it equally'], ['$' + n(tot / (a + b)), 'that is just one part'], ['$' + n((tot / b) * a), 'divided by the wrong number']],
        explanation: `There are ${a} + ${b} = ${a + b} parts. One part is $${tot} ÷ ${a + b} = $${tot / (a + b)}. ${y} gets ${b} parts: $${n(big)}.` };
    },
    () => {
      const ppl = pick([4, 6, 8]); const to = pick([2, 3, 5, 6, 9, 10, 12].filter((v) => v !== ppl)); const per = pick([25, 50, 75, 100]);
      const amt = per * ppl; const ans = per * to;
      return { skill: 'Scaling a recipe', difficulty: 3,
        stem: `A recipe for ${ppl} people uses ${amt} g of flour. How much flour is needed for ${to} people?`,
        answer: n(ans) + ' g', wrong: [[n(amt + (to - ppl)) + ' g', 'added the extra people as grams'], [n(amt * to) + ' g', `multiplied by ${to} without dividing by ${ppl}`], [n(amt + (to - ppl) * 10) + ' g', 'added 10 g per extra person'], [n((amt / to) * ppl) + ' g', 'divided the wrong way round']],
        explanation: `For 1 person: ${amt} ÷ ${ppl} = ${per} g. For ${to} people: ${per} × ${to} = ${ans} g.` };
    },
  ];

  G.TIME = [
    () => {
      const s = ri(7, 10) * 60 + pick([15, 20, 35, 40, 45, 50]); const d = ri(2, 4) * 60 + pick([25, 35, 40, 50, 55]);
      const e = s + d; const sm = s % 60, em = e % 60;
      const naive = (Math.floor(e / 60) - Math.floor(s / 60)) * 100 + (em - sm);
      const w = [[hm(d + 60), 'counted one hour too many'], [hm(d - 60), 'counted one hour too few'], [hm(d + 20), 'counted on to the next hour wrongly']];
      if (naive >= 0) w.push([`${Math.floor(naive / 100)} h ${naive % 100} min`, 'subtracted the times like ordinary numbers']); else w.push([hm(d - 20), 'made a mistake crossing the hour']);
      return { skill: 'Finding a duration', difficulty: 2,
        stem: `A school excursion left at ${clock(s)} and got back at ${clock(e)}. How long was the excursion?`,
        answer: hm(d), wrong: w,
        explanation: `Count on: ${clock(s)} → ${clock(s + (60 - sm))} is ${60 - sm} min. Then to ${clock(e - em)} is ${hm(e - em - (s + 60 - sm))}, then ${em} more min. Total ${hm(d)}.` };
    },
    () => {
      const h = ri(13, 23), m = pick([5, 15, 20, 35, 40, 55]); const t = h * 60 + m;
      return { skill: '24-hour time', difficulty: 1,
        stem: `A train leaves at ${h}:${String(m).padStart(2, '0')}. What is this in 12-hour time?`,
        answer: clock(t), wrong: [[clock(t - 720).replace('pm', 'am'), 'forgot to change to pm'], [clock(t - 120), 'subtracted 10 instead of 12'], [clock(t + 120), 'subtracted 14'], [`${h}:${String(m).padStart(2, '0')} pm`, '24-hour times above 12 need 12 taken off']],
        explanation: `For times after 12:59, subtract 12 from the hours: ${h} − 12 = ${h - 12}, so ${clock(t)}.` };
    },
    () => {
      const s = ri(17, 19) * 60 + pick([40, 45, 50, 55]); const d = pick([95, 105, 110, 125, 135, 140]); const e = s + d;
      return { skill: 'Adding minutes to a time', difficulty: 3,
        stem: `A movie starts at ${clock(s)} and runs for ${d} minutes. When does it finish?`,
        answer: clock(e), wrong: [[clock(s + Math.floor(d / 100) * 60 + (d % 100)), `read ${d} minutes as ${Math.floor(d / 100)} h ${d % 100} min`], [clock(e + 60), 'added an hour too many'], [clock(e - 10), 'made a mistake passing the hour'], [clock(e - 60), 'added an hour too few']],
        explanation: `${d} minutes is ${hm(d)}. ${clock(s)} + ${hm(d)} = ${clock(e)}.` };
    },
  ];

  G.UNIT = [
    () => {
      const v = pick([2.5, 1.25, 3.4, 0.75, 4.05, 0.6, 7.2]);
      const [u1, u2, f] = pick([['km', 'm', 1000], ['m', 'cm', 100], ['kg', 'g', 1000], ['L', 'mL', 1000], ['cm', 'mm', 10]]);
      const ans = Math.round(v * f * 100) / 100;
      return { skill: 'Converting units', difficulty: 2,
        stem: `${n(v)} ${u1} = ? ${u2}`,
        answer: n(ans), wrong: [[n(ans / 10), 'one zero short'], [n(ans * 10), 'one zero too many'], [n(v + f), 'added instead of multiplying'], [n(v / f), 'divided instead of multiplying']],
        explanation: `1 ${u1} = ${n(f)} ${u2}, so multiply by ${n(f)}: ${n(v)} × ${n(f)} = ${n(ans)} ${u2}.` };
    },
    () => {
      const kg = ri(2, 6), g = pick([40, 60, 5, 250, 75]); const ans = kg * 1000 + g;
      return { skill: 'Mixed units', difficulty: 2,
        stem: `A parcel weighs ${kg} kg ${g} g. How many grams is that?`,
        answer: n(ans), wrong: [[n(kg * 1000 + g * 10), `treated ${g} g as ${g * 10} g`], [n(kg * 100 + g), 'used 100 g in a kilogram'], [n(Number(`${kg}${g}`)), 'just wrote the numbers side by side'], [n(kg * 10000 + g), 'used 10 000 g in a kilogram']],
        explanation: `${kg} kg = ${kg * 1000} g. Add ${g} g: ${ans} g. Watch the zeros: ${g} g is written as ${String(g).padStart(3, '0')} after the thousands.` };
    },
    () => {
      const cup = pick([200, 250, 125, 300]); const jug = pick([1, 1.5, 2, 3]); const ml = jug * 1000; if (ml % cup) return G.UNIT[2]();
      const ans = ml / cup;
      return { skill: 'How many fit', difficulty: 3,
        stem: `How many ${cup} mL cups can be filled from a full ${n(jug)} L jug?`,
        answer: n(ans), wrong: [[n(ans / 2), 'halved somewhere'], [n(ans * 10), 'used 10 000 mL in a litre'], [n(Math.round((jug * 100) / cup * 10) / 10), 'used 100 mL in a litre'], [n(ans + 2), 'miscounted']],
        explanation: `${n(jug)} L = ${ml} mL. ${ml} ÷ ${cup} = ${ans} cups.` };
    },
  ];

  G.AREA = [
    () => {
      const l = ri(6, 14), w = ri(3, l - 1); const per = 2 * (l + w);
      const body = `<rect x="40" y="30" width="${l * 18}" height="${w * 18}" fill="currentColor" fill-opacity="0.08"/>` + T(40 + l * 9, 22, `${l} cm`) + T(40 + l * 18 + 10, 30 + w * 9 + 5, '?', 15, 'start');
      return { skill: 'Area from perimeter', difficulty: 3,
        stem: `This rectangle has a perimeter of ${per} cm. What is its area?`,
        svg: svg(l * 18 + 90, w * 18 + 50, body),
        answer: `${l * w} cm²`, wrong: [[`${per * l} cm²`, 'multiplied the perimeter by the length'], [`${l * (per / 2)} cm²`, 'used half the perimeter as the width'], [`${per} cm²`, 'that is the perimeter'], [`${l * (per - 2 * l)} cm²`, 'forgot to halve: width is (perimeter − 2 × length) ÷ 2']],
        explanation: `Two lengths are ${2 * l} cm, so the two widths make ${per} − ${2 * l} = ${2 * w} cm, and the width is ${w} cm. Area = ${l} × ${w} = ${l * w} cm².` };
    },
    () => { // L-shape
      const W = ri(8, 12), H = ri(7, 10), cw = ri(3, W - 3), ch = ri(2, H - 3); const s = 18;
      const pts = [[0, 0], [W - cw, 0], [W - cw, ch], [W, ch], [W, H], [0, H]].map(([x, y]) => [30 + x * s, 25 + y * s]);
      const body = P(pts, true) + T(30 + (W - cw) * s / 2, 18, `${W - cw} m`) + T(30 + W * s / 2, 25 + H * s + 18, `${W} m`) + T(22, 25 + H * s / 2 + 5, `${H} m`, 14, 'end') + T(30 + W * s + 8, 25 + (ch + H) * s / 2 + 5, `${H - ch} m`, 14, 'start');
      const area = W * H - cw * ch;
      return { skill: 'Area of a composite shape', difficulty: 3,
        stem: 'What is the area of this garden bed? All corners are right angles.',
        svg: svg(W * s + 90, H * s + 55, body),
        answer: `${area} m²`, wrong: [[`${W * H} m²`, 'used the full rectangle without removing the corner'], [`${2 * (W + H)} m²`, 'that is the perimeter'], [`${(W - cw) * H + W * (H - ch)} m²`, 'counted the overlapping part twice'], [`${W * H - cw * ch - cw * ch} m²`, 'removed the corner twice']],
        explanation: `Think of the full ${W} × ${H} rectangle (${W * H} m²) with a ${cw} × ${ch} corner missing (${cw * ch} m²): ${W * H} − ${cw * ch} = ${area} m². (The missing corner is ${W} − ${W - cw} = ${cw} m wide and ${H} − ${H - ch} = ${ch} m tall.)` };
    },
    () => {
      const side = ri(3, 12); const per = 4 * side;
      return { skill: 'Squares: perimeter and area', difficulty: 2,
        stem: `A square has a perimeter of ${per} cm. What is its area?`,
        answer: `${side * side} cm²`, wrong: [[`${per} cm²`, 'that is the perimeter'], [`${(per / 2) ** 2} cm²`, 'halved the perimeter instead of quartering it'], [`${side * 2} cm²`, 'doubled the side instead of squaring it'], [`${per * 4} cm²`, 'multiplied the perimeter by 4']],
        explanation: `Each side is ${per} ÷ 4 = ${side} cm. Area = ${side} × ${side} = ${side * side} cm².` };
    },
  ];

  G.ANG = [
    () => {
      const a = pick([35, 48, 62, 115, 128, 74, 141, 57]); const x = 180 - a; const cx = 170, cy = 110;
      const body = L(30, cy, 310, cy) + ray(cx, cy, 120, a) + arc(cx, cy, 30, 0, a) + arc(cx, cy, 42, a, 180) + lab(cx, cy, 58, a / 2, `${a}°`) + lab(cx, cy, 64, (a + 180) / 2, 'x');
      return { skill: 'Angles on a straight line', difficulty: 2,
        stem: 'The diagram shows a straight line. What is the size of angle x?', svg: svg(340, 130, body),
        answer: `${x}°`, wrong: [[`${360 - a}°`, 'used 360° instead of 180°'], [`${90 - a > 0 ? 90 - a : a - 90}°`, 'used 90° instead of 180°'], [`${a}°`, 'the angles are not equal'], [`${x + 10}°`, 'subtraction slip']],
        explanation: `Angles on a straight line add to 180°. x = 180° − ${a}° = ${x}°.` };
    },
    () => {
      const a = ri(35, 80), b = ri(35, 80); const c = 180 - a - b;
      const ta = Math.tan(a * Math.PI / 180), tb = Math.tan(b * Math.PI / 180);
      const base = Math.min(260, (125 * (ta + tb)) / (ta * tb)); const x0 = (340 - base) / 2;
      const ax = x0 + (base * tb) / (ta + tb), ah = (base * ta * tb) / (ta + tb);
      const body = P([[x0, 150], [x0 + base, 150], [ax, 150 - ah]], true) + T(x0 + 30, 144, `${a}°`, 13) + T(x0 + base - 30, 144, `${b}°`, 13) + T(ax, 150 - ah + 30, 'y', 15, 'middle', 'bold');
      const sc = 1;
      return { skill: 'Angles in a triangle', difficulty: 2,
        stem: `Two angles of a triangle are ${a}° and ${b}°. What is angle y?${sc < 1 ? ' (Not to scale.)' : ''}`, svg: svg(340, 165, body),
        answer: `${c}°`, wrong: [[`${360 - a - b}°`, 'used 360° instead of 180°'], [`${a + b}°`, 'added the two angles'], [`${c + 10}°`, 'subtraction slip'], [`${90 - Math.min(a, b)}°`, 'assumed a right angle']],
        explanation: `The angles in a triangle add to 180°. y = 180° − ${a}° − ${b}° = ${c}°.` };
    },
    () => {
      const h = ri(1, 11), half = R() < 0.4; const m = half ? 30 : 0;
      const ang = Math.abs(30 * h - 5.5 * m); const small = Math.min(ang, 360 - ang);
      return { skill: 'Angles on a clock', difficulty: half ? 4 : 3,
        stem: `What is the smaller angle between the hour hand and the minute hand at ${h}:${String(m).padStart(2, '0')}?`,
        answer: `${n(small)}°`, wrong: [[`${n(360 - small)}°`, 'that is the larger angle'], [`${half ? n(Math.min(Math.abs(30 * h - 180), 360 - Math.abs(30 * h - 180))) : n(small + 30)}°`, half ? 'forgot the hour hand moves halfway to the next number' : 'counted one gap too many'], [`${n(small / 30 * 6)}°`, 'used 6° per number instead of 30°'], [`${n(Math.abs(small - 30) || 15)}°`, 'counted one gap too few']],
        explanation: `Each number on a clock is 360° ÷ 12 = 30° apart.${half ? ` At half past, the hour hand is halfway between ${h} and ${h % 12 + 1} (it moves 15° in 30 minutes).` : ''} The gap is ${n(small)}°.` };
    },
    () => {
      const a = ri(70, 130), b = ri(60, 110), c = ri(50, 100); const x = 360 - a - b - c; if (x < 30) return G.ANG[3]();
      const cx = 170, cy = 120, r = 95; const angs = [0, a, a + b, a + b + c];
      let body = angs.map((t) => ray(cx, cy, r, t)).join('');
      const labs = [[a, 0], [b, a], [c, a + b], [x, a + b + c]];
      labs.forEach(([v, s0], i) => { body += arc(cx, cy, 22 + i * 4, s0, s0 + v) + lab(cx, cy, 52, s0 + v / 2, i === 3 ? 'x' : `${v}°`); });
      return { skill: 'Angles around a point', difficulty: 3,
        stem: 'Four angles meet at a point. What is angle x? (Not to scale.)', svg: svg(340, 240, body),
        answer: `${x}°`, wrong: [[`${180 - ((a + b + c) % 180)}°`, 'used 180° instead of 360°'], [`${a + b + c}°`, 'added the three angles'], [`${x + 10}°`, 'subtraction slip'], [`${x - 10}°`, 'subtraction slip']],
        explanation: `Angles around a point add to 360°. x = 360° − ${a}° − ${b}° − ${c}° = ${x}°.` };
    },
  ];

  G.SEQ = [
    () => {
      const s = ri(2, 15), d = ri(3, 9), k = 20 + ri(0, 10);
      const ans = s + (k - 1) * d;
      return { skill: 'Finding a far-away term', difficulty: 3,
        stem: `The pattern ${s}, ${s + d}, ${s + 2 * d}, ${s + 3 * d}, … keeps going. What is term number ${k}?`,
        answer: n(ans), wrong: [[n(s + k * d), `added ${d} one time too many (${k} jumps instead of ${k - 1})`], [n(k * d), `used ${k} × ${d} and forgot the start`], [n(ans - d), 'one jump short'], [n(s * k), 'multiplied the first term']],
        explanation: `From term 1 to term ${k} is ${k - 1} jumps of ${d}: ${s} + ${k - 1} × ${d} = ${ans}.` };
    },
    () => {
      const s = ri(1, 6), d0 = ri(1, 4); const seq = [s]; for (let i = 0; i < 5; i++) seq.push(seq[i] + d0 + i);
      return { skill: 'Patterns with growing differences', difficulty: 3,
        stem: `What comes next? ${seq.slice(0, 5).join(', ')}, …`,
        answer: n(seq[5]), wrong: [[n(seq[4] + d0 + 3), 'kept the last difference the same'], [n(seq[4] * 2), 'doubled the last number'], [n(seq[5] + 1), 'added one too many'], [n(seq[4] + d0), 'used the first difference']],
        explanation: `The differences are ${seq.slice(1, 5).map((v, i) => v - seq[i]).join(', ')}: they grow by 1 each time. Next difference is ${d0 + 4}, so ${seq[4]} + ${d0 + 4} = ${seq[5]}.` };
    },
    () => {
      const t = ri(2, 4); const s = ri(1, 5); const seq = [s]; for (let i = 0; i < 5; i++) seq.push(seq[i] * t);
      const miss = ri(1, 3);
      return { skill: 'Missing term (multiplying pattern)', difficulty: 2,
        stem: `What is the missing number? ${seq.slice(0, 5).map((v, i) => (i === miss ? '?' : v)).join(', ')}`,
        answer: n(seq[miss]), wrong: [[n((seq[miss - 1] + seq[miss + 1]) / 2), 'took the number halfway between (this pattern multiplies)'], [n(seq[miss - 1] + t), `added ${t} instead of multiplying`], [n(seq[miss] + t), 'off by one step'], [n(seq[miss + 1] - t), `subtracted ${t} from the next term`]],
        explanation: `Each number is ${t} times the one before. ${seq[miss - 1]} × ${t} = ${seq[miss]} (check: ${seq[miss]} × ${t} = ${seq[miss + 1]}).` };
    },
  ];

  G.SPD = [
    () => {
      const sp = pick([40, 60, 80, 90, 100, 120]); const mins = pick([15, 30, 45, 20, 40, 90]); const d = (sp * mins) / 60;
      return { skill: 'Distance from speed and time', difficulty: 3,
        stem: `A car travels at ${sp} km/h for ${mins} minutes. How far does it go?`,
        answer: `${n(d)} km`, wrong: [[`${n(sp * mins)} km`, 'multiplied by minutes instead of hours'], [`${n(sp)} km`, 'that is the distance in one hour'], [`${n(sp * mins / 100)} km`, 'used 100 minutes in an hour'], [`${n(d * 2)} km`, 'doubled']],
        explanation: `${mins} minutes is ${frac(mins, 60)} of an hour. ${sp} × ${frac(mins, 60)} = ${n(d)} km.` };
    },
    () => {
      const sp = pick([40, 50, 60, 80]); const hrs = pick([1.5, 2.5, 1.25, 2.25, 3.5, 0.75]); const d = sp * hrs; const mins = Math.round(hrs * 60);
      const dec = String(hrs).split('.'); const wrongRead = `${dec[0]} h ${dec[1] ? Number(dec[1].padEnd(2, '0')) : 0} min`;
      return { skill: 'Time from distance and speed', difficulty: 3,
        stem: `How long does it take to cycle ${n(d)} km at ${sp} km/h?`,
        answer: hm(mins), wrong: [[wrongRead, `${n(hrs)} hours is not ${wrongRead}`], [hm(mins + 30), 'rounded up'], [hm(Math.round((sp / d) * 60)), 'divided the wrong way round'], [hm(mins - 15), 'rounded down']],
        explanation: `Time = distance ÷ speed = ${n(d)} ÷ ${sp} = ${n(hrs)} hours = ${hm(mins)}.` };
    },
  ];

  G.AVG = [
    () => {
      const k = 5; const mean = ri(6, 20); const vals = []; for (let i = 0; i < k - 1; i++) vals.push(mean + ri(-5, 5)); vals.push(mean * k - vals.reduce((a, b) => a + b, 0)); if (vals[k - 1] <= 0) return G.AVG[0]();
      const sv = shuffle(vals); const sorted = sv.slice().sort((a, b) => a - b);
      const w = [[n(sorted[2]), 'that is the middle number (median), not the mean'], [n(mean * k), 'that is the total'], [n(mean + 1), 'adding slip'], [n(Math.round(mean * k / (k - 1))), `divided by ${k - 1} instead of ${k}`]];
      return { skill: 'Finding the mean', difficulty: 2,
        stem: `What is the mean (average) of ${sv.join(', ')}?`,
        answer: n(mean), wrong: w.filter((x) => x[0] !== n(mean)),
        explanation: `Add them: ${sv.join(' + ')} = ${mean * k}. Divide by how many (${k}): ${mean * k} ÷ ${k} = ${mean}.` };
    },
    () => {
      const k = 4; const target = ri(70, 90); const known = [target + ri(-8, 8), target + ri(-8, 8), target + ri(-8, 8)]; const need = target * k - known.reduce((a, b) => a + b, 0); if (need > 100 || need < 40) return G.AVG[1]();
      const nm = pick(NAMES);
      return { skill: 'Missing value for a mean', difficulty: 4,
        stem: `${nm} scored ${known.join(', ')} in three tests. What must ${nm} score in the fourth test to have a mean of ${target}?`,
        answer: n(need), wrong: [[n(target), 'the fourth score does not have to equal the mean'], [n(Math.round(known.reduce((a, b) => a + b, 0) / 3)), 'that is the mean of the first three'], [n(target * k), 'that is the total needed'], [n(need + 4), 'adding slip']],
        explanation: `A mean of ${target} over 4 tests needs a total of ${target} × 4 = ${target * k}. So far: ${known.join(' + ')} = ${known.reduce((a, b) => a + b, 0)}. Needed: ${target * k} − ${known.reduce((a, b) => a + b, 0)} = ${need}.` };
    },
  ];

  G.NUM = [
    () => {
      const a = ri(2, 20), b = ri(2, 9), c = ri(2, 9), d = ri(1, 9);
      const ans = a + b * c - d;
      return { skill: 'Order of operations', difficulty: 2,
        stem: `What is ${a} + ${b} × ${c} − ${d}?`,
        answer: n(ans), wrong: [[n((a + b) * c - d), 'worked left to right: multiplication comes before addition'], [n(a + b * (c - d)), 'subtracted before multiplying'], [n((a + b) * (c - d)), 'added and subtracted before multiplying'], [n(a + b + c - d), 'added instead of multiplying']],
        explanation: `Multiply first: ${b} × ${c} = ${b * c}. Then left to right: ${a} + ${b * c} − ${d} = ${ans}.` };
    },
    () => {
      const base = pick([0.6, 0.45, 0.7, 0.38, 0.5]); const set = shuffle([base, base + 0.005, Math.round((base - 0.02) * 1000) / 1000, Math.round(base * 100) / 1000, Math.round((base + 0.04) * 1000) / 1000]).map((v) => Math.round(v * 1000) / 1000);
      const big = Math.max(...set);
      return { skill: 'Comparing decimals', difficulty: 2,
        stem: 'Which number is the largest?',
        answer: String(big), wrong: set.filter((v) => v !== big).map((v) => [String(v), `${v} < ${big} (compare tenths, then hundredths, then thousandths)`]),
        explanation: `Line up the decimal points and compare place by place: ${set.slice().sort((a, b) => b - a).join(' > ')}. More digits does not mean bigger.` };
    },
    () => {
      const num = ri(1000, 9999) + ri(1, 99) / 100; const s = num.toFixed(2); const digits = s.replace('.', '').split('');
      const pos = ri(0, 5); const dgt = digits[pos]; if (dgt === '0' || digits.indexOf(dgt) !== pos) return G.NUM[2]();
      const places = [1000, 100, 10, 1, 0.1, 0.01]; const val = Number(dgt) * places[pos];
      const nm = ['thousands', 'hundreds', 'tens', 'ones', 'tenths', 'hundredths'][pos];
      const others = places.filter((p) => p !== places[pos]).slice(0, 4).map((p) => [n(Number(dgt) * p), 'wrong place']);
      return { skill: 'Place value', difficulty: 1,
        stem: `What is the value of the digit ${dgt} in ${Number(s).toLocaleString('en-AU', { minimumFractionDigits: 2 })}?`,
        answer: n(val), wrong: others,
        explanation: `The ${dgt} is in the ${nm} place, so its value is ${dgt} × ${n(places[pos])} = ${n(val)}.` };
    },
    () => {
      const v = ri(1000, 99999); const to = pick([10, 100, 1000]); const ans = Math.round(v / to) * to;
      return { skill: 'Rounding', difficulty: 1,
        stem: `Round ${v.toLocaleString('en-AU')} to the nearest ${to.toLocaleString('en-AU')}.`,
        answer: ans.toLocaleString('en-AU'), wrong: [[(Math.floor(v / to) * to === ans ? Math.ceil(v / to) * to : Math.floor(v / to) * to).toLocaleString('en-AU'), 'rounded the wrong way'], [(Math.round(v / (to * 10)) * to * 10).toLocaleString('en-AU'), 'rounded to the wrong place'], [(Math.round(v / Math.max(1, to / 10)) * Math.max(1, to / 10)).toLocaleString('en-AU'), 'rounded to the wrong place'], [(ans + to).toLocaleString('en-AU'), 'went one step too far'], [(ans - to).toLocaleString('en-AU'), 'went one step too far']],
        explanation: `Look at the digit to the right of the ${to.toLocaleString('en-AU')}s place: 5 or more rounds up, 4 or less rounds down. ${v.toLocaleString('en-AU')} → ${ans.toLocaleString('en-AU')}.` };
    },
  ];

  G.FACT = [
    () => {
      const v = pick([12, 18, 20, 24, 28, 30, 36, 40, 45, 48, 60, 64, 72, 100]); const fs = []; for (let i = 1; i <= v; i++) if (v % i === 0) fs.push(i);
      return { skill: 'Counting factors', difficulty: 3,
        stem: `How many factors does ${v} have?`,
        answer: String(fs.length), wrong: [[String(fs.length - 2), 'left out 1 and the number itself'], [String(fs.length - 1), 'missed one factor'], [String(fs.length + 1), 'counted a square root twice or added a non-factor'], [String(Math.floor(fs.length / 2)), 'counted only the pairs']],
        explanation: `List them in pairs: ${fs.slice(0, Math.ceil(fs.length / 2)).map((f) => `${f} × ${v / f}`).join(', ')}. The factors are ${fs.join(', ')}: ${fs.length} factors.` };
    },
    () => {
      const [a, b] = pick([[12, 18], [10, 15], [8, 12], [6, 15], [20, 30], [9, 12], [14, 21], [15, 25]]); const m = lcm(a, b);
      const st = ri(6, 9) * 60;
      return { skill: 'Lowest common multiple', difficulty: 3,
        stem: `One bus leaves every ${a} minutes and another every ${b} minutes. Both leave together at ${clock(st)}. When will they next leave together?`,
        answer: clock(st + m), wrong: [[clock(st + a * b), `used ${a} × ${b}: that works but it is not the first time`], [clock(st + a + b), 'added the gaps'], [clock(st + Math.max(a, b)), 'used the longer gap'], [clock(st + gcd(a, b)), 'used the highest common factor']],
        explanation: `Multiples of ${a}: ${[1, 2, 3, 4, 5].map((k) => a * k).join(', ')}… Multiples of ${b}: ${[1, 2, 3, 4].map((k) => b * k).join(', ')}… The first one in both lists is ${m}. ${clock(st)} + ${m} min = ${clock(st + m)}.` };
    },
    () => {
      const [a, b] = pick([[24, 36], [18, 30], [16, 40], [20, 28], [30, 45], [27, 36], [32, 48]]); const h = gcd(a, b);
      return { skill: 'Highest common factor', difficulty: 3,
        stem: `${a} apples and ${b} oranges are packed into identical bags with no fruit left over. Each bag has the same number of apples and the same number of oranges. What is the greatest number of bags?`,
        answer: String(h), wrong: [[String(lcm(a, b)), 'that is the lowest common multiple'], [String(h / 2), 'a common factor, but not the greatest'], [String(a + b), 'added them'], [String(b - a), 'subtracted them']],
        explanation: `The number of bags must divide both ${a} and ${b}. The greatest number that does is ${h} (${a} = ${h} × ${a / h}, ${b} = ${h} × ${b / h}). Each bag gets ${a / h} apples and ${b / h} oranges.` };
    },
    () => {
      const lo = pick([10, 20, 30, 40, 50]); const hi = lo + 10 + pick([0, 10]); const ps = []; for (let v = lo + 1; v < hi; v++) { let p = v > 1; for (let d = 2; d * d <= v; d++) if (v % d === 0) p = false; if (p) ps.push(v); }
      return { skill: 'Prime numbers', difficulty: 2,
        stem: `How many prime numbers are there between ${lo} and ${hi}?`,
        answer: String(ps.length), wrong: [[String(ps.length + 1), 'counted a number that is not prime (check 1 and numbers like 51 = 3 × 17)'], [String(ps.length - 1), 'missed one'], [String(ps.length + 2), 'counted odd numbers that are not prime'], [String(Math.max(0, ps.length - 2)), 'missed two']],
        explanation: `The primes between ${lo} and ${hi} are ${ps.join(', ')}: ${ps.length} of them. A prime has exactly two factors, 1 and itself.` };
    },
  ];

  G.MONEY = [
    () => {
      const items = [['a sandwich', ri(5, 9) * 100 + pick([20, 45, 50, 75, 95])], ['a juice', ri(2, 4) * 100 + pick([10, 30, 60, 85])], ['a muffin', ri(3, 5) * 100 + pick([25, 40, 50, 90])]];
      const tot = items.reduce((s, x) => s + x[1], 0); const paid = tot > 2000 ? 5000 : 2000;
      return { skill: 'Change', difficulty: 2,
        stem: `${pick(NAMES)} buys ${items.map((x) => `${x[0]} (${money(x[1])})`).join(', ').replace(/, ([^,]*)$/, ' and $1')}, and pays with a $${paid / 100} note. How much change?`,
        answer: money(paid - tot), wrong: [[money(tot), 'that is the total cost'], [money(paid - tot + 100), 'subtraction slip with the dollars'], [money(paid - tot - 10), 'subtraction slip with the cents'], [money(paid - tot + 10), 'subtraction slip with the cents']],
        explanation: `Total: ${items.map((x) => money(x[1])).join(' + ')} = ${money(tot)}. Change: $${(paid / 100).toFixed(2)} − ${money(tot)} = ${money(paid - tot)}.` };
    },
    () => {
      const unit = pick([30, 40, 45, 50, 60]); const packs = shuffle([[4, unit * 4 + 20], [6, unit * 6 - 10], [10, unit * 10 + 30], [12, unit * 12 + 12], [3, unit * 3 + 6]]);
      const best = packs.reduce((m, p) => (p[1] / p[0] < m[1] / m[0] ? p : m));
      const txt = (p) => `${p[0]} for ${money(p[1])}`;
      return { skill: 'Best buy', difficulty: 3,
        stem: 'Muesli bars are sold in different packs. Which pack is the best value?',
        answer: txt(best), wrong: packs.filter((p) => p !== best).map((p) => [txt(p), `${money(Math.round(p[1] / p[0]))} each (approx.)`]),
        explanation: `Work out the price of one bar: ${packs.map((p) => `${txt(p)} → about ${money(Math.round(p[1] / p[0]))} each`).join('; ')}. The cheapest per bar is ${txt(best)}.` };
    },
    () => {
      const price = pick([150, 250, 180, 320, 120]); const k = pick([7, 8, 10, 11]); const deal = 3; // buy 3 get 1 free -> every 4th free
      const free = Math.floor(k / (deal + 1)); const pay = (k - free) * price;
      return { skill: 'Deals: buy 3, get 1 free', difficulty: 4,
        stem: `Drinks cost ${money(price)} each, with a "buy 3, get 1 free" deal. How much do ${k} drinks cost?`,
        answer: money(pay), wrong: [[money(k * price), 'forgot the deal'], [money((k - Math.floor(k / deal)) * price), 'gave a free drink for every 3 instead of every 4'], [money((k - free - 1) * price), 'one free drink too many'], [money((k - 1) * price), 'only one free drink']],
        explanation: `Every group of 4 drinks has 1 free. ${k} drinks = ${free} full group${free > 1 ? 's' : ''} (${free} free) + ${k - 4 * free} more. Pay for ${k - free} drinks: ${k - free} × ${money(price)} = ${money(pay)}.` };
    },
  ];

  G.PROB = [
    () => {
      const r = ri(2, 6), b = ri(2, 6), g = ri(1, 5); const tot = r + b + g;
      const col = pick([['red', r], ['blue', b], ['green', g]]);
      return { skill: 'Simple chance', difficulty: 2,
        stem: `A bag has ${r} red, ${b} blue and ${g} green counters. One is taken without looking. What is the chance it is ${col[0]}?`,
        answer: frac(col[1], tot), wrong: [[frac(col[1], tot - col[1]) + (frac(col[1], tot - col[1]) === frac(col[1], tot) ? ' ' : ''), `compared ${col[0]} with the others instead of with all ${tot}`], [frac(1, 3), 'there are 3 colours, but not the same number of each'], [frac(tot - col[1], tot), `that is the chance of NOT ${col[0]}`], [frac(1, col[1]), 'upside down']],
        explanation: `There are ${tot} counters and ${col[1]} are ${col[0]}, so the chance is ${col[1]}/${tot}${frac(col[1], tot) !== `${col[1]}/${tot}` ? ` = ${frac(col[1], tot)}` : ''}.` };
    },
    () => {
      const k = ri(2, 5); const ways = 6 - k;
      return { skill: 'Chance with a dice', difficulty: 2,
        stem: `A normal dice is rolled. What is the chance of rolling a number greater than ${k}?`,
        answer: frac(ways, 6), wrong: [[frac(ways + 1, 6), `included ${k} itself`], [frac(k, 6), `that is the chance of ${k} or less`], [frac(1, ways), 'upside down'], [frac(ways, 5), 'used 5 sides']],
        explanation: `The numbers greater than ${k} are ${[1, 2, 3, 4, 5, 6].filter((v) => v > k).join(', ')}: ${ways} of the 6. Chance = ${ways}/6${frac(ways, 6) !== `${ways}/6` ? ` = ${frac(ways, 6)}` : ''}.` };
    },
  ];

  const TOPICS = {
    FRAC: 'Fractions', PCT: 'Percentages', RAT: 'Ratio and sharing', TIME: 'Time', UNIT: 'Measurement units',
    AREA: 'Area and perimeter', ANG: 'Angles', SEQ: 'Number patterns', SPD: 'Speed, distance and time',
    AVG: 'Averages', NUM: 'Number and place value', FACT: 'Factors, multiples and primes', MONEY: 'Money', PROB: 'Chance',
  };

  function build(code, k) {
    for (let tries = 0; tries < 30; tries++) {
      const g = pick(G[code])();
      const seen = new Set([g.answer.trim()]);
      const wrong = [];
      g.wrong.forEach(([o, why]) => { const t = String(o).trim(); if (!seen.has(t) && !/NaN|Infinity|undefined|^-|−\d|\.\d{3}/.test(t)) { seen.add(t); wrong.push([t, why]); } });
      if (wrong.length < 4) continue;
      const opts = shuffle([[g.answer.trim(), null], ...wrong.slice(0, 4)]);
      const letters = ['A', 'B', 'C', 'D', 'E'];
      const q = { n: k, topic: code, difficulty: g.difficulty, skill: g.skill, stem: g.stem, options: {}, distractors: {}, explanation: g.explanation };
      opts.forEach(([o, why], i) => { q.options[letters[i]] = o; if (why === null) q.answer = letters[i]; else q.distractors[letters[i]] = why; });
      if (g.svg) q.svg = g.svg;
      return q;
    }
    throw new Error('could not build a question for ' + code);
  }

  window.PracticeGen = {
    topics: TOPICS,
    make(code, seed, count) {
      R = rng(seed);
      const codes = code === 'mixed' ? Object.keys(G) : [code];
      if (!codes.every((c) => G[c])) throw new Error('unknown topic ' + code);
      const order = code === 'mixed' ? shuffle(codes).concat(shuffle(codes)) : [];
      const qs = [];
      const stems = new Set();
      for (let i = 0; qs.length < count && i < count * 20; i++) {
        const c = code === 'mixed' ? order[qs.length % order.length] : code;
        const q = build(c, qs.length + 1);
        if (stems.has(q.stem + (q.svg || ''))) continue;
        stems.add(q.stem + (q.svg || ''));
        qs.push(q);
      }
      R = Math.random;
      return {
        id: 'practice-' + code, title: `Practice: ${code === 'mixed' ? 'Mixed maths topics' : TOPICS[code]}`, section: 'Maths practice',
        practice: true, timeLimitMinutes: 0, groupLabel: 'By topic', topics: TOPICS, questions: qs,
      };
    },
  };
})();
