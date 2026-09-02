#!/usr/bin/env node
// THE SLASH ORDER, DERIVED FROM A RECORDING.
//
//   node kaizo/tools/derive-shuffle.mjs <kaizo_oracle_seq<TAG>.csv> --out <file>
//
// WHY THIS EXISTS. obj_knight_rotating_slash builds its fan of angles and then
// ds_list_shuffle's them. The shuffle's COST is measured (16 u32 per element,
// CLAUDE.md) but its PERMUTATION is not solved -- a search over index formulas
// scored at chance -- and the real game re-rolls it every playthrough, so the
// order is not a fidelity property. The stream position is, and the sim pins
// that. What the sim cannot do is guess which angle the recording fired first,
// and the whole-fight bullets sheet compares that angle: kaizo _tok3 f2632,
// game image_angle 288.9693908691, sim 18.9693889618 -- the same fan, the same
// fractional part (so the same aim and the same offset roll), a different first
// element.
//
// The vanilla lane has solved this since its own whole-fight diff:
// tools/fullfight-trace.mjs --shuffle replays a recorded order. Vanilla's feed
// comes from a dedicated oracle log; the kaizo recorder does not write one, but
// it does not need to -- every slash's birth is already in the seq log with its
// image_angle, in creation order, and that IS the shuffled order.
//
// OUTPUT: one line per obj_roaringknight_slash birth, `frame,image_angle`, in
// recording order. The tracer feeds it as a queue and the module consumes the
// entries that match its own fan (see kaizo/attacks/rotating-slash.js), which
// is what lets two managers interleave their volleys without this file having
// to guess which manager a birth belonged to.
//
// WHAT THIS DOES NOT DO: it does not change a single draw. The 16-per-element
// burn happens either way, before the order is applied. Report a run made with
// it as "mechanics one-to-one, shuffle ORDER replayed", exactly as the vanilla
// lane reports its own.
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const files = argv.filter((a) => !a.startsWith('--'));
const outIdx = argv.indexOf('--out');
const quiet = argv.includes('--quiet');
if (!files.length || outIdx < 0) {
  console.error('usage: derive-shuffle.mjs <seq.csv> --out <file> [--quiet]');
  process.exit(2);
}

const text = readFileSync(files[0], 'utf8');
const lines = text.split(/\r?\n/).filter(Boolean);
const head = lines[0].split(',');
const iFrame = head.indexOf('frame');
const iObj = head.indexOf('object');
const iAngle = head.indexOf('angle');
if (iFrame < 0 || iObj < 0 || iAngle < 0) {
  console.error(`seq log is missing a column (frame/object/angle): ${head.join(',')}`);
  process.exit(2);
}

const rows = [];
for (const line of lines.slice(1)) {
  const c = line.split(',');
  if (c[iObj] !== 'obj_roaringknight_slash') continue;
  const f = Number(c[iFrame]);
  const a = Number(c[iAngle]);
  if (!Number.isFinite(f) || !Number.isFinite(a)) continue;
  rows.push(`${f},${a.toFixed(10)}`);
}

writeFileSync(argv[outIdx + 1], `${rows.join('\n')}\n`);
if (!quiet) console.log(`shuffle: ${rows.length} slash birth(s) -> ${argv[outIdx + 1]}`);
