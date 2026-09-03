#!/usr/bin/env node
/**
 * EVERY TURN BOUNDARY IN THE RECORDING, INCLUDING THE ONES PAST THE FRONT.
 *
 * WHY IT EXISTS. The byte gate's metric is the FIRST divergence frame, which is
 * the right metric for driving the work and a bad one for knowing what is left:
 * it says nothing at all about frame N+1. That is fine while the front is
 * moving and dangerous when you want to know whether a fix GENERALISES. A clock
 * model corrected at one turn end should be correct at all of them, and this is
 * the cheapest way to ask.
 *
 * WHAT IT MEASURES. A turn boundary is a frame where `turntimer` falls from a
 * large positive value to a negative one -- the frame obj_battlecontroller's
 * sweep fires. At each one it compares the value both sides land on and the two
 * frames after. Boundaries BEFORE the gate's front are a real check; boundaries
 * AFTER it are downstream of a known divergence and are reported for their
 * SHAPE, not as failures:
 *
 *   * a sim value one or two BELOW the oracle's is the missing-Destroy family
 *     -- the mod re-writes the clock from an object's Destroy during the sweep
 *     and the sim's type has no cleanUp to run (see underbox.js managerDestroy,
 *     which is what this tool was written to generalise);
 *   * a sim value still in the 999,xxx range means the turn NEVER ENDED in the
 *     sim: something pinned the clock and nothing released it. That is a
 *     different and worse bug than being one frame out, and it is invisible to
 *     the gate.
 *
 * The oracle lands on -1 at some boundaries and -2 at others, and both are
 * legitimate: -2 is one Destroy write followed by the decrement, -1 is a second
 * write landing during the sweep, after it. The pair of values IS the signature
 * of how many objects closed the turn.
 *
 *   node kaizo/tools/check-turn-boundaries.mjs [--oracle PATH] [--sim PATH] [--after N]
 *
 * --after N reports only boundaries at or after frame N (e.g. the current front)
 * so the downstream noise can be separated from the real check.
 */
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const ORACLE = flag('--oracle',
  'C:/Users/aidan/knight-research/kaizo-mod/fullfight/kaizo_oracle_trace_tok3.csv');
const SIM = flag('--sim', join(tmpdir(), 'kaizo-fullfight', 'kaizo_sim_trace_tok3.csv'));
const AFTER = Number(flag('--after', '0'));

function load(p) {
  const lines = readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
  const col = {};
  lines[0].split(',').forEach((n, i) => (col[n] = i));
  const rows = new Map();
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    rows.set(+c[col.frame], c);
  }
  return { col, rows };
}

const O = load(ORACLE);
const S = load(SIM);
const tt = (d, f) => {
  const r = d.rows.get(f);
  return r ? parseFloat(r[d.col.turntimer]) : NaN;
};

let ok = 0;
const bad = [];
let uncompared = 0;
for (const f of [...O.rows.keys()].sort((a, b) => a - b)) {
  const prev = tt(O, f - 1);
  const cur = tt(O, f);
  if (!(prev > 1 && cur < 0)) continue;
  if (f < AFTER) continue;
  if (!S.rows.has(f)) { uncompared += 1; continue; }
  const o = [0, 1, 2].map((k) => tt(O, f + k));
  const s = [0, 1, 2].map((k) => tt(S, f + k));
  if (o.every((v, k) => Math.abs(v - s[k]) < 1e-9)) ok += 1;
  else bad.push({ f, o, s });
}

console.log(`turn boundaries compared: ${ok + bad.length}   matching: ${ok}   differing: ${bad.length}`
  + (uncompared ? `   (${uncompared} had no sim row)` : ''));
for (const b of bad) {
  // Name the shape, so a downstream artefact is not mistaken for a new bug.
  const stuck = b.s[0] > 1000;
  const low = !stuck && b.s[0] < b.o[0];
  const shape = stuck ? 'THE TURN NEVER ENDED in the sim -- a pin with no release'
    : low ? `sim is ${(b.o[0] - b.s[0]).toFixed(0)} low -- the missing-Destroy family`
      : 'other';
  console.log(`  f${b.f}  oracle [${b.o.join(', ')}]  sim [${b.s.join(', ')}]`);
  console.log(`         ${shape}`);
}
if (!bad.length) console.log('  every boundary agrees, including the ones past the gate front.');
