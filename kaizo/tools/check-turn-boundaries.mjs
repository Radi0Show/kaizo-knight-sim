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
 * sweep fires. Boundaries are found INDEPENDENTLY on each side and paired by
 * INDEX, and at each pair the tool compares the value both sides LAND ON and
 * the two frames after.
 *
 * PAIRING BY INDEX RATHER THAN BY FRAME IS THE WHOLE POINT, and the first
 * version of this tool got it wrong in a way worth recording. Comparing at the
 * oracle's frame number reads the sim MID-TURN once anything upstream has
 * drifted, and duly reported three turns whose sim clock still read 999,xxx as
 * "the turn never ended" -- which was simply false. They ended twenty to fifty
 * frames later. Measured on the tree that produced that reading, the sim runs
 * the same 33 attacks in the same ORDER to the end of the recording and only
 * the launch frames move (two frames at f8576, growing after). Pairing the nth
 * boundary with the nth asks the question that survives drift -- does the clock
 * land on the same value? -- and separates a wrong CLOCK from a wrong SCHEDULE.
 * The corrected reading of that same tree was 16 of 17 boundaries landing
 * identically, not 10.
 *
 * READING THE OUTPUT:
 *   * a sim value one or two BELOW the oracle's is the missing-Destroy family
 *     -- the mod re-writes the clock from an object's Destroy during the sweep
 *     and the sim's type has no cleanUp to run. underbox.js's managerDestroy is
 *     the worked example, and generalising it is why this tool exists.
 *   * a COUNT MISMATCH (the sim ends more or fewer turns than the recording) is
 *     a schedule fault rather than a clock fault, and is called out separately.
 *
 * The oracle lands on -1 at some boundaries and -2 at others, and both are
 * legitimate: -2 is one Destroy write followed by the decrement, -1 is a second
 * write landing during the sweep, after it. The pair of values IS the signature
 * of how many objects closed the turn.
 *
 *   node kaizo/tools/check-turn-boundaries.mjs [--oracle PATH] [--sim PATH] [--after N]
 *
 * --after N reports only boundaries at or after that ORACLE frame, e.g. the
 * gate's current front, to separate what is already reached from what is not.
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

// BOUNDARIES ARE PAIRED BY INDEX, NOT BY FRAME, and that distinction is the
// whole value of the tool past the front. Once anything diverges the sim's
// turns drift in TIME -- measured on the current tree, the sim runs the same 33
// attacks in the same order to the end of the recording and only the launch
// frames move, by two frames at f8576 and growing. Comparing at the ORACLE's
// frame number therefore reads the sim mid-turn and reports a clock still
// pinned at 999,xxx as "the turn never ended", which is simply false: it ended
// forty frames later. Pairing the nth boundary with the nth boundary asks the
// question that survives drift -- does the clock LAND on the same value? -- and
// separates a wrong clock model from a wrong schedule.
function boundaries(d) {
  const out = [];
  for (const f of [...d.rows.keys()].sort((a, b) => a - b)) {
    const prev = tt(d, f - 1);
    const cur = tt(d, f);
    if (prev > 1 && cur < 0) out.push(f);
  }
  return out;
}

const ob = boundaries(O);
const sb = boundaries(S);
console.log(`turn boundaries: oracle ${ob.length}, sim ${sb.length}`);
if (ob.length !== sb.length) {
  console.log('  COUNT MISMATCH -- the sim ends a different NUMBER of turns, which is a');
  console.log('  schedule fault, not a clock fault. Pairing below is by index anyway.');
}

let ok = 0;
const bad = [];
const n = Math.min(ob.length, sb.length);
for (let k = 0; k < n; k++) {
  if (ob[k] < AFTER) continue;
  const o = [0, 1, 2].map((j) => tt(O, ob[k] + j));
  const s = [0, 1, 2].map((j) => tt(S, sb[k] + j));
  if (o.every((v, j) => Math.abs(v - s[j]) < 1e-9)) ok += 1;
  else bad.push({ k, of: ob[k], sf: sb[k], o, s });
}

console.log(`compared: ${ok + bad.length}   matching: ${ok}   differing: ${bad.length}`);
for (const b of bad) {
  const low = b.s[0] < b.o[0];
  const shape = low
    ? `the sim lands ${(b.o[0] - b.s[0]).toFixed(0)} LOW -- the missing-Destroy family: the`
      + ' mod re-writes the clock from an object Destroy during the sweep and the'
      + ' sim type has no cleanUp to run'
    : 'the sim lands HIGH -- a write the mod does not make, or one made twice';
  console.log(`  boundary #${b.k}  oracle f${b.of} [${b.o.join(', ')}]`
    + `   sim f${b.sf} [${b.s.join(', ')}]`
    + (b.of === b.sf ? '' : `   (drifted ${b.sf - b.of >= 0 ? '+' : ''}${b.sf - b.of} frames)`));
  console.log(`         ${shape}`);
}
if (!bad.length) console.log('  every boundary lands on the same value, including past the gate front.');
