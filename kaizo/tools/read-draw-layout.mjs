#!/usr/bin/env node
/**
 * READ THE GAME'S OWN DRAW LAYOUT OFF THE RECORDING.
 *
 * WHAT IT IS FOR. When a divergence is a stream-position question — "the sim
 * spent two draws here and the game spent three, but where?" — this turns the
 * recording itself into the answer instead of a theory. It has already settled
 * two of them (the PierceBlades carousel's visit order, and the damage
 * writer's birth-frame double draw), and both times the arithmetic pointed at
 * the frame long before the GML explained it.
 *
 * HOW IT WORKS. PierceBlades gives every orbiting sword exactly one
 * `random_range(176, 184)` per frame and writes it straight to `direction`,
 * which the bullet sheet records to ten digits. Generate the attack's anchored
 * stream, index every value `176 + f * 8` it can produce, and look each
 * RECORDED direction back up: what comes out is the stream index the GAME
 * handed that sword. Per frame that gives you
 *
 *   * THE VISIT ORDER — indices descend in slot order, and the sheet's slots
 *     are sorted oldest-first, so descending means the game visits
 *     newest-first;
 *   * THE DRAW COUNT BETWEEN FRAMES — the gap from one frame's highest index
 *     to the next frame's lowest. It is 2 all through this attack (the
 *     slasher's two Draw-event `random_range(-at_gshake, at_gshake)` rolls),
 *     and any frame that is not 2 is a frame where something else drew.
 *
 * READING THE OUTPUT. `gap-from-prev` is the number of non-orbit draws between
 * the two frames' sword blocks, which is the EARLIER frame's draw slot. A
 * negative gap or a NON-CONTIGUOUS flag is usually not a finding: a sword that
 * has left the carousel keeps its last orbit direction, and a value the stream
 * produces twice is skipped as ambiguous, so blocks can look short. Trust a
 * gap only when you have checked the frame's oldest slot (visited last, so the
 * highest index) actually resolved.
 *
 * WHAT IT NEEDS. An attack that writes a per-frame random into a RECORDED
 * field, and the anchor its stream was created with. Any such attack can be
 * read the same way — this one is hard-coded to the orbit's 176..184 because
 * that is the one that exists; generalising it means passing the range and the
 * field.
 *
 *   node kaizo/tools/read-draw-layout.mjs [anchor] [firstFrame] [lastFrame] [--oracle PATH]
 *
 * Frames are ORACLE/file frames (the sheet's own column), not sim frames — the
 * kaizo tracer's file frame is `state.frame - 128`.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const { gmlCreate, gmlU32 } = await import(pathToFileURL(join(REPO, 'sim', 'rng.js')).href);

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));

const ANCHOR = Number(positional[0] ?? 20);
const F0 = Number(positional[1] ?? 5860);
const F1 = Number(positional[2] ?? 5930);
const ORACLE = flag('--oracle',
  'C:/Users/aidan/knight-research/kaizo-mod/fullfight/kaizo_oracle_bullets_tok3.csv');

// The anchor the oracle patch reseeds per scr_bulletspawner call: seed +
// spawnn * 1000, with anchor n = spawnn - 1 (CLAUDE.md, "LIVE RNG IS
// RE-ANCHORED PER ATTACK LAUNCH").
const r = gmlCreate((20260810 + ANCHOR * 1000) >>> 0);
const byVal = new Map();
for (let k = 0; k < 6000; k++) {
  const v = Math.fround(176 + (gmlU32(r) / 4294967296) * 8);
  const key = v.toFixed(4);
  if (!byVal.has(key)) byVal.set(key, []);
  byVal.get(key).push(k);
}

const lines = readFileSync(ORACLE, 'utf8').split(/\r?\n/).filter(Boolean);
const col = {};
lines[0].split(',').forEach((n, i) => (col[n] = i));

console.log(`anchor ${ANCHOR}, frames ${F0}..${F1}`);
console.log('frame   n   stream indices, in slot order (slots are oldest-first)');
let prevMax = null;
for (const line of lines.slice(1)) {
  const c = line.split(',');
  const f = +c[col.frame];
  if (f < F0 || f > F1) continue;
  const hits = [];
  for (let s = 0; s < 32; s++) {
    const d = c[col[`b${s}_dir`]];
    if (d === '' || d === undefined) continue;
    const v = parseFloat(d);
    if (v < 176 || v > 184) continue;              // the orbit's range only
    const k = byVal.get(Math.fround(v).toFixed(4));
    if (k && k.length === 1) hits.push(k[0]);      // skip values the stream repeats
  }
  if (!hits.length) continue;
  const lo = Math.min(...hits), hi = Math.max(...hits);
  const contiguous = hi - lo + 1 === hits.length;
  const gap = prevMax === null ? '' : `  gap-from-prev=${lo - prevMax - 1}`;
  prevMax = hi;
  console.log(`${f}  ${String(hits.length).padStart(2)}  [${lo}..${hi}]`
    + `${contiguous ? '' : ' NON-CONTIGUOUS'}${gap}   ${hits.join(',')}`);
}
