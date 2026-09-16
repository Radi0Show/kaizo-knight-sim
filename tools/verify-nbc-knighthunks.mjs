#!/usr/bin/env node
// NO BULLET COOLDOWNS — the four Knight-object hunks re-derived from a
// NAME-FILTERED-FREE diff of the mod, and what this repo does with each.
//
// tools/verify-nbc.mjs covers the mechanic and damage sites. This suite covers
// the last four, and three of them are assertions that the sim does NOT do
// something — which is the only kind of guard that survives the next lane:
//
//   V1  obj_growtangle_Create_0.gml:8                TAKEN  — the arena is RED
//   --  obj_knight_slasher_Step_0.gml:29             INERT  — object is dead
//                                                             code in the game
//   --  obj_knight_split_growtangle_Step_0.gml:258   DRIFT  — an older build
//   --  obj_roaringknight_splitslash_Step_0.gml:91   INDEX  — not a number
//
// WHY THE BLEND NEEDS ITS OWN SUITE. verify-nbc.mjs's no-op fingerprint is
// entity count, summed positions, RNG stream position and party HP. A colour
// is in none of those, so a regression that recoloured the arena with the flag
// OFF would pass every existing suite in the repo. The fingerprint here
// carries image_blend and nothing else new.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createState, stepFrame } from '../sim/index.js';
import { buildSingleAttackScene } from '../sim/scenes/single.js';
import { ATTACK_MENU } from '../sim/scenes/single.js';
import { mergeColor, makeColorHsv } from '../sim/gml.js';
import { nbcOn } from '../sim/attacks/nbc.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failed = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}${extra ? `  (${extra})` : ''}`);
  if (!c) failed += 1;
};
const eq = (got, want, m) =>
  ok(JSON.stringify(got) === JSON.stringify(want), m,
    `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const IDLE = {
  up: false, down: false, left: false, right: false,
  confirm: false, cancel: false, focus: false, menu: false,
};

/** The vanilla arena colour, written the way obj_growtangle's Create writes it. */
const GREEN = mergeColor([0, 128, 0], [0, 255, 0], 0.5);
/** The mod's, written the way its Create writes it. */
const RED = makeColorHsv(0, 255, 255);

/**
 * Run one attack and collect, per frame: the blend of every entity that has
 * one, plus the coarse motion fingerprint so this suite also fails on a
 * behaviour change smuggled in beside a colour change.
 *
 * @param nbc  undefined = never set the flag at all; otherwise the value.
 */
function run(attack, frames, nbc, difficulty = 0, seed = 9) {
  const st = createState({ seed, traceBulletSlots: 0 });
  if (nbc !== undefined) st.noBulletCooldown = nbc;
  buildSingleAttackScene(st, { seed, attack, difficulty });
  const rows = [];
  const blends = Object.create(null);
  const names = new Set();
  for (let f = 0; f < frames; f++) {
    stepFrame(st, IDLE);
    let live = 0;
    let sx = 0;
    let sy = 0;
    const tint = [];
    for (const e of st.entities) {
      if (!e.alive) continue;
      live += 1;
      sx += e.x ?? 0;
      sy += e.y ?? 0;
      names.add(e.type.name);
      if (e.image_blend !== undefined) {
        tint.push(`${e.type.name}=${e.image_blend}`);
        (blends[e.type.name] ??= new Set()).add(String(e.image_blend));
      }
    }
    rows.push([f, live, sx.toFixed(6), sy.toFixed(6), st.gmlRng?.n ?? -1,
      tint.join('|')].join(','));
  }
  return { print: rows.join('\n'), blends, names, st };
}

// ---------------------------------------------------------------------------
console.log('\n-- make_color_hsv, the shim the mod made sim/ need --------------');
// GameMaker's ranges are 0..255 on all three arguments. Getting that wrong is
// the one way this site can be "translated" and still be wrong, so it is
// checked against values that only hold on the 0..255 reading.
eq(makeColorHsv(0, 255, 255), [255, 0, 0], 'hue 0 full sat/val is RED');
eq(makeColorHsv(85, 255, 255), [0, 255, 0], 'hue 85 (a third round) is GREEN');
eq(makeColorHsv(170, 255, 255), [0, 0, 255], 'hue 170 (two thirds) is BLUE');
eq(makeColorHsv(0, 0, 255), [255, 255, 255], 'zero saturation is WHITE, not red');
eq(makeColorHsv(0, 255, 0), [0, 0, 0], 'zero value is BLACK');
// The 0..360 misreading would put hue 0 at red too, which is why the green and
// blue rows above are the ones doing the work: on a 0..360 reading, 85 and 170
// would be yellow-green and cyan-blue, not the pure primaries.

// ---------------------------------------------------------------------------
console.log('\n-- V1  the arena is GREEN off and RED on -----------------------');
eq(GREEN, [0, 192, 0], 'merge_color(c_green, c_lime, 0.5) is RGB(0,192,0)');
{
  const off = run('flurry', 400, false, 3);
  const on = run('flurry', 400, true, 3);
  const one = (r, name) => [...(r.blends[name] ?? [])];

  eq(one(off, 'obj_growtangle'), [String(GREEN)], 'OFF: obj_growtangle is green');
  eq(one(on, 'obj_growtangle'), [String(RED)], 'ON: obj_growtangle is red');

  // THE THREE THINGS THAT INHERIT IT. Each is a separate hop in the original
  // (`obj_growtangle` Step:63 for the echo, obj_knight_split_growtangle's
  // Create:1 for the organism, and the organism's own hand-off to its effect),
  // so each is asserted rather than assumed to follow.
  for (const name of ['obj_afterimage', 'obj_knight_split_growtangle',
    'obj_knight_split_growtangle_effect']) {
    ok(off.blends[name] !== undefined, `the ${name} carries a blend at all`);
    eq(one(off, name), [String(GREEN)], `OFF: ${name} inherits the green`);
    eq(one(on, name), [String(RED)], `ON: ${name} inherits the red`);
  }

  // NOT everything turns red. The splitslash's own telegraph ramp is its own
  // colour and must be untouched by the arena tint — if this row ever matched
  // between off and on trivially, the assertions above would be measuring a
  // global recolour instead of one field.
  const slashOff = one(off, 'obj_roaringknight_splitslash');
  const slashOn = one(on, 'obj_roaringknight_splitslash');
  ok(slashOff.length > 1, 'the splitslash telegraph really is a ramp, not one colour',
    `${slashOff.length} distinct values`);
  eq(slashOn, slashOff, 'the splitslash ramp is IDENTICAL on and off');
  // Same for the flame markers: c_gray, a multiply, and the mod does not touch
  // obj_marker at all.
  eq(one(on, 'obj_marker_splitflame'), one(off, 'obj_marker_splitflame'),
    'the cut-face flames stay c_gray under the flag');
}

// ---------------------------------------------------------------------------
console.log('\n-- V1  OFF is a literal no-op, blend column included -----------');
for (const [attack, frames, diff] of [
  ['flurry', 400, 3], ['flurry', 400, 0], ['stars', 300, 0], ['roaring', 500, 0],
]) {
  const absent = run(attack, frames, undefined, diff);
  const explicit = run(attack, frames, false, diff);
  const on = run(attack, frames, true, diff);
  ok(absent.print === explicit.print,
    `${attack} d${diff}: flag absent and flag=false are byte-identical`);
  ok(absent.print !== on.print, `${attack} d${diff}: flag=true changes the run`);
}
{
  // And at a second seed, so a match is not a coincidence of seed 9.
  const a = run('flurry', 300, undefined, 3, 31337);
  const b = run('flurry', 300, false, 3, 31337);
  ok(a.print === b.print, 'flurry d3 at a second seed: OFF is still byte-identical');
}

// ---------------------------------------------------------------------------
console.log('\n-- obj_knight_slasher is dead code, here and in the game -------');
//
// `obj_knight_slasher_Step_0.gml:29` gains `state = "slash";` under the mod —
// M6's trick on a second object. It cannot fire: the object's only creator is
// obj_dbulletcontroller's `if (type == 100)` arm and nothing in the dump ever
// assigns `type = 100` (obj_knight_enemy's selector stops at 101). So there is
// nothing here to model it into, and this asserts that rather than leaving the
// absence to a comment: no attack the sim can launch produces one, with the
// flag either way.
{
  let seen = false;
  for (const entry of ATTACK_MENU) {
    for (const nbc of [false, true]) {
      const r = run(entry.id, 200, nbc, entry.difficulties?.[0] ?? 0);
      if (r.names.has('obj_knight_slasher')) seen = true;
    }
  }
  ok(!seen, 'no ATTACK_MENU entry spawns an obj_knight_slasher, flag either way',
    `${ATTACK_MENU.length} attacks x2`);
}

// ---------------------------------------------------------------------------
console.log('\n-- the split organism keeps its VANILLA diagonal markers -------');
//
// The mod's copy of obj_knight_split_growtangle_Step_0 is an older build: it
// has no `if (diagonal)` marker arm and no `+ xoffset`/`+ yoffset`. Taking that
// deletion would move the two cut-face flames up to 53px and 45 degrees off the
// diagonal and add nothing. This is the guard that says the sim still has the
// vanilla placement — it fails loudly if a later lane "translates" the drift.
{
  let diagFrames = 0;
  let good = 0;
  let offsetSeen = 0;
  let wouldMove = 0;
  let maxMove = 0;
  // Positions are stored through the sim's f32 quantiser, so an exact `===`
  // against a float64 recomputation fails on the last bits. The tolerance is
  // four orders of magnitude under the smallest displacement this is looking
  // for (the drift moves markers by TENS of pixels).
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  for (const seed of [9, 4242, 77]) {
    for (const nbc of [false, true]) {
      const st = createState({ seed, traceBulletSlots: 0 });
      st.noBulletCooldown = nbc;
      buildSingleAttackScene(st, { seed, attack: 'flurry', difficulty: 3 });
      // `diagonal` is set by the splitslash partway through a frame, so on the
      // frame it flips the markers still hold the previous arm's placement.
      // That one-frame lag is the original's; only frames that were ALREADY
      // diagonal when the Step ran are checked.
      const wasDiagonal = new WeakMap();
      for (let f = 0; f < 700; f++) {
        stepFrame(st, IDLE);
        for (const e of st.entities) {
          if (!e.alive || e.type.name !== 'obj_knight_split_growtangle') continue;
          if (!e.markers || e.markers.length !== 2) continue;
          const [m0, m1] = e.markers;
          // `diagonal` arrives from `irandom(1)`, so it is 0/1 rather than a
          // boolean — tested for truthiness exactly as the GML does.
          const prev = wasDiagonal.get(e) === true;
          wasDiagonal.set(e, !!e.diagonal);
          if (e.xoffset !== 0 || e.yoffset !== 0) offsetSeen += 1;
          if (!e.diagonal || !prev) continue;
          diagFrames += 1;
          const d = Math.round(e.distance);
          const sq = Math.SQRT1_2 * d;
          const want = {
            a0: e.vertical ? -45 : 225,
            a1: e.vertical ? 135 : 45,
            x0: e.x - sq - 1 + e.xoffset,
            x1: e.x + sq + 3 + e.xoffset,
            y0: e.y - sq - 1 + e.yoffset,
            y1: e.y + sq + 3 + e.yoffset,
          };
          if (m0.image_angle === want.a0 && m1.image_angle === want.a1
            && near(m0.x, want.x0) && near(m1.x, want.x1)
            && near(m0.y, want.y0) && near(m1.y, want.y1)) good += 1;
          // And what the deletion WOULD have done, measured on the same frame
          // rather than asserted from the diff: the vertical/horizontal arm the
          // mod's build falls through to, with no offsets.
          const drift = e.vertical
            ? { x0: e.x - d - 1, x1: e.x + d + 3, y0: e.y - 1, y1: e.y + 3 }
            : { y0: e.y - d - 1, y1: e.y + d + 3, x0: e.x - 1, x1: e.x + 3 };
          const move = Math.max(
            Math.abs(want.x0 - drift.x0), Math.abs(want.x1 - drift.x1),
            Math.abs(want.y0 - drift.y0), Math.abs(want.y1 - drift.y1),
          );
          if (move > 1e-9) wouldMove += 1;
          if (move > maxMove) maxMove = move;
        }
      }
    }
  }
  ok(diagFrames > 0, 'the d3 flurry really does produce diagonal splits',
    `${diagFrames} frames`);
  ok(offsetSeen > 0, 'and splits with a non-zero xoffset/yoffset',
    `${offsetSeen} frames`);
  ok(good === diagFrames,
    'every diagonal frame places the flames on the sqrt(0.5) diagonal, with the offsets',
    `${good}/${diagFrames}`);
  ok(wouldMove === diagFrames && maxMove > 20,
    'and the mod-build placement would move BOTH flames on every one of them',
    `${wouldMove}/${diagFrames}, up to ${maxMove.toFixed(2)}px`);
}

// ---------------------------------------------------------------------------
console.log('\n-- `_splitter = 910` is an object index and is not in the sim --');
//
// The mod's `_splitter = 182;` -> `910;` is the decompiler printing
// obj_knight_split_growtangle's index under two different object tables (the
// argument, with the `knight = 345` -> `344` anchor, is in sim/attacks/nbc.js).
// A source-text guard rather than a behavioural one, because the failure mode
// being guarded against is someone writing the constant into the file.
{
  const src = readFileSync(join(ROOT, 'sim/attacks/splitslash.js'), 'utf8');
  const code = src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  ok(!/\b910\b/.test(code), 'sim/attacks/splitslash.js has no bare 910 outside comments');
  ok(!/\b182\b/.test(code), 'and no bare 182 either — neither index belongs in the sim');
  ok(/organism\(state\)/.test(code),
    'the else arm is modelled as "the organism that already exists"');
}

// ---------------------------------------------------------------------------
console.log('\n-- the flag itself still gates everything above ----------------');
eq(nbcOn({ noBulletCooldown: true }), true, 'nbcOn(true)');
eq(nbcOn({ noBulletCooldown: 'true' }), false, 'a persisted string does not arm it');

console.log(failed === 0
  ? '\nverify-nbc-knighthunks: PASS\n'
  : `\nverify-nbc-knighthunks: ${failed} FAILURE(S)\n`);
process.exit(failed === 0 ? 0 : 1);
