// THE GAME'S OWN DRAW LAYOUT, read straight off the recording.
//
// Every orbiting PierceBlades sword writes direction = random_range(176, 184)
// once a frame, and 176 + f*8 is injective enough over a few thousand draws to
// invert: generate the attack's anchored stream, index every value it can
// produce, then look each RECORDED direction up. What comes back is the stream
// INDEX the game handed that sword -- so the per-frame index sets say exactly
// how many draws the game spent, and where the non-carousel draws fall.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SIM = 'D:/ShadowCrystal/kaizo-knight-sim';
const rng = await import(pathToFileURL(`${SIM}/sim/rng.js`).href);

const ANCHOR = Number(process.argv[2] ?? 20);
const F0 = Number(process.argv[3] ?? 5860);
const F1 = Number(process.argv[4] ?? 5930);

const r = rng.gmlCreate((20260810 + ANCHOR * 1000) >>> 0);
const byVal = new Map();
const N = 6000;
for (let k = 0; k < N; k++) {
  const v = Math.fround(176 + (rng.gmlU32(r) / 4294967296) * 8);
  const key = v.toFixed(4);
  if (!byVal.has(key)) byVal.set(key, []);
  byVal.get(key).push(k);
}

const O = 'C:/Users/aidan/knight-research/kaizo-mod/fullfight/kaizo_oracle_bullets_tok3.csv';
const L = readFileSync(O, 'utf8').split(/\r?\n/).filter(Boolean);
const h = L[0].split(',');
const col = {};
h.forEach((n, i) => (col[n] = i));

console.log('frame  n   stream indices the game handed the orbiting swords (slot order = oldest first)');
let prevMax = null;
for (const line of L.slice(1)) {
  const c = line.split(',');
  const f = +c[col.frame];
  if (f < F0 || f > F1) continue;
  const hits = [];
  for (let s = 0; s < 32; s++) {
    const d = c[col[`b${s}_dir`]];
    if (d === '' || d === undefined) continue;
    const v = parseFloat(d);
    if (v < 176 || v > 184) continue;          // only the orbit's range
    const k = byVal.get(Math.fround(v).toFixed(4));
    if (k && k.length === 1) hits.push({ s, i: k[0] });
  }
  if (!hits.length) continue;
  const idx = hits.map((x) => x.i);
  const lo = Math.min(...idx), hi = Math.max(...idx);
  const contiguous = hi - lo + 1 === idx.length;
  const gap = prevMax === null ? '' : `  gap-from-prev=${lo - prevMax - 1}`;
  prevMax = hi;
  const order = hits.map((x) => x.i).join(',');
  console.log(`${f}  ${String(hits.length).padStart(2)}  [${lo}..${hi}]`
    + `${contiguous ? '' : ' NON-CONTIGUOUS'}${gap}   ${order}`);
}
