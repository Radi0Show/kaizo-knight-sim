#!/usr/bin/env node
// KAIZO V-C obj_knight_split_growtangle_vertical — the SIDE-B vertical
// splitter, the quickslash endtype-1 finisher's organism.
//
// PUBLISH GATE: V-C recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 —
// do not publish without permission (kaizo/HANDOFF.md §5-C).
//
// What this pins. Each block FAILS if its branch is deleted:
//
//   V1  CREATE — the box's blend and scales are copied, the box is hidden,
//       depth is box + 100, and the two cut-face flame markers exist facing
//       opposite ways at double scale.
//   V2  THE TEAR, at timer 20 exactly: con 0 -> 1, the MOD'S ONE DELTA (the
//       soul's mask becomes spr_dodgeheart_smaller_2px_mask — every other
//       line in this object is byte-identical to vanilla v1.05), the custom
//       box is built (customBox, maxyscale 10/3, and image_yscale narrowed
//       to f32 because it is a built-in while maxyscale is not), and the
//       untranslated obj_knight_lightorb is LEDGERED rather than dropped.
//   V3  THE OPEN — `distance = scr_ease_out(timer / 30, 6) * 50`, frame for
//       frame against the curve, ending at 49.951171875 and NOT 50 (curve 6
//       is -2^-10t + 1, which never reaches 1).
//   V4  THE BOX IS PARKED at x -9999 for every frame the gap is open and
//       returns to xstart otherwise, and the two flames ride the cut faces
//       at the original's asymmetric -1 / +3 offsets — Y only, because the
//       GML never touches marker X after Create.
//   V5  THE HALF-BOX CLAMP (Step_2), both halves. heart_y is chosen once
//       from the soul's side of the box, the soul is TELEPORTED into its
//       half on the tear frame, and it is held in a 62px band — [y-122,
//       y-60] above, [y+40, y+100] below — with X pinned to
//       [xstart-70, xstart+52] whatever the gap does.
//   V6  IT NEVER CLOSES. After timer 30 the organism goes con 2 and there is
//       no con-2 block, so the gap freezes and the arena stays cut for the
//       rest of the turn — which is why quickslash's endtype-1 wind-down
//       keeps its controller ~100 frames longer.
//   V7  NO ROUNDING. The horizontal organism rounds the soul every End Step;
//       this one does not, and a fractional soul inside the band survives.
//   V8  THE SUBSTITUTION IT REPLACES WAS NOT EQUIVALENT — the ledgered
//       stand-in (sim/attacks/split-growtangle.js with `vertical = true`,
//       which is what quickslash spawns today) swaps no mask, opens to a
//       different distance, CLOSES again, and clamps a different box.
//
//     node kaizo/tools/checks/check-split-growtangle-vertical.mjs   exit 0 / 1

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn, destroy } from '../../../sim/entity.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { ensureSoul } from './scaffold-soul.mjs';
import { scrEaseOut } from '../../../sim/gml.js';
import { HEART_RECT } from '../../../sim/masks.js';
import {
  splitGrowtangleVertical, spawnVerticalSplit, verticalSplitCleanUp,
  KAIZO_SMALLER_HEART_MASK, restoreHeartMask,
} from '../../attacks/split-growtangle-vertical.js';
// The organism the endtype-1 branch spawns TODAY, behind the ledger row this
// module closes — imported so V8 can compare them rather than assert from
// memory.
import { splitGrowtangle } from '../../../sim/attacks/split-growtangle.js';
// The OTHER module that stamps the same mask. Imported so the shared-identity
// trap underbox.js documents is asserted rather than assumed: a private copy
// here would make `soul.mask === KAIZO_SMALLER_HEART_MASK` false for whichever
// attack did not stamp it, and both restore helpers would then miss.
import {
  KAIZO_SMALLER_HEART_MASK as UNDERBOX_SMALLER_MASK,
  restoreHeartMask as underboxRestore,
} from '../../attacks/underbox.js';

let failures = 0;
let checks = 0;

function assert(cond, label) {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.log(`  FAIL ${label}`);
  }
}

function assertEq(got, want, label) {
  checks += 1;
  if (got !== want) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}

/** A fight-shaped scene with the practice director removed so nothing
 *  auto-launches — the same shape check-underbox and check-combination use. */
function scene({ seed = 12345, soulX = 314, soulY = 162 } = {}) {
  const state = createState({ seed });
  buildSingleAttackScene(state, { seed, attack: 'combination', difficulty: 0 });
  ensureSoul(state); // the drill no longer spawns the soul at build (scaffold-soul.mjs)
  const dir = state.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  state.kaizo = { sideb: true, approx: [] };
  state.currentAc = 105.1; // the B-Side quickslash, dc type 97.1
  state.turntimer = 99999;
  state.soul.x = soulX;
  state.soul.y = soulY;
  state.soul.mask = HEART_RECT; // the FIGHT soul's mask (moveheart handoff)
  const gt = state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
  return { state, gt };
}

function markers(state) {
  return state.entities.filter((e) => e.alive && e.type.name === 'obj_marker_splitflame');
}

// ── V1 — create ────────────────────────────────────────────────────────────
{
  const { state, gt } = scene();
  const before = markers(state).length;
  const sp = spawnVerticalSplit(state, { x: gt.x, y: gt.y }, null);

  assertEq(sp.type.name, 'obj_knight_split_growtangle_vertical', 'V1: the right object');
  assertEq(sp.x, gt.x, 'V1: created at obj_growtangle.x');
  assertEq(sp.y, gt.y, 'V1: created at obj_growtangle.y');
  assertEq(sp.con, 0, 'V1: con 0');
  assertEq(sp.timer, 0, 'V1: timer 0');
  assertEq(sp.distance, 0, 'V1: distance 0');
  assertEq(sp.heart_y, 0, 'V1: heart_y unset until the tear');
  assertEq(sp.split_dist, 50, 'V1: split_dist 50');
  assertEq(sp.slow, 4, 'V1: slow 4');
  assertEq(sp.fast, 8, 'V1: fast 8');
  assertEq(sp.count, 0, 'V1: count 0 — the fountain-wall branch is dead');
  assertEq(gt.visible, false, 'V1: the box is hidden');
  assertEq(sp.image_xscale, gt.image_xscale, 'V1: the box\'s xscale is copied');
  assertEq(sp.image_yscale, gt.image_yscale, 'V1: the box\'s yscale is copied');
  assertEq(sp.image_blend, gt.image_blend, 'V1: the box\'s blend is copied (the arena green)');
  assertEq(sp.sprite_index, gt.sprite_index, 'V1: the box\'s sprite is copied');
  assertEq(sp.depth, (gt.depth ?? 0) + 100, 'V1: depth is the box\'s + 100');
  // `target = 0` — NEW in the mod on both endtype arms.
  assertEq(sp.target, 0, 'V1: the organism\'s damage is forced onto slot 0');

  const ms = markers(state);
  assertEq(ms.length - before, 2, 'V1: two cut-face flame markers');
  assertEq(sp.markers.length, 2, 'V1: …held on the organism');
  assertEq(sp.markers[0].image_angle, 180, 'V1: marker 0 faces down the gap');
  assertEq(sp.markers[1].image_angle, 0, 'V1: marker 1 faces the other way');
  assertEq(sp.markers[0].x, gt.x + 2, 'V1: marker 0 is +2 in x, and stays there');
  assertEq(sp.markers[1].x, gt.x, 'V1: marker 1 is +0 in x, and stays there');
  assertEq(sp.markers[0].image_xscale, 2, 'V1: markers are double scale');
  assertEq(sp.markers[0].image_speed, 0.5, 'V1: …and animate at 0.5');

  // CleanUp_0, three lines.
  verticalSplitCleanUp(state, sp);
  assertEq(gt.visible, true, 'V1: CleanUp restores the box');
  assertEq(markers(state).length, before, 'V1: CleanUp destroys both markers');
}

// ── V2 — the tear ──────────────────────────────────────────────────────────
{
  const { state, gt } = scene();
  const sp = spawnVerticalSplit(state, { x: gt.x, y: gt.y }, null);

  for (let f = 0; f < 19; f++) stepFrame(state, {});
  assertEq(sp.con, 0, 'V2: still shut at timer 19');
  assertEq(sp.timer, 19, 'V2: …timer 19');
  assert(state.soul.mask !== KAIZO_SMALLER_HEART_MASK, 'V2: the mask has not swapped yet');
  assertEq(state.kaizo.approx.length, 0, 'V2: nothing ledgered yet');

  stepFrame(state, {}); // timer 20 — the tear
  assertEq(sp.con, 1, 'V2: con 0 -> 1 at timer 20');
  assertEq(sp.timer, 0, 'V2: …and the timer is reset');
  // THE MOD'S ONE DELTA.
  assert(state.soul.mask === KAIZO_SMALLER_HEART_MASK,
    'V2: the soul wears spr_dodgeheart_smaller_2px_mask (Step_0:6-9, the mod\'s only change)');
  assertEq(state.soul.mask.bbox.join(','), '4,4,15,15', 'V2: …the 2px mask, bbox [4,4]..[15,15]');
  assert(state.soul.mask !== HEART_RECT, 'V2: …and it is no longer the full 20x20 rect');
  // ONE mask object across every module that stamps it (kaizoMask hands back
  // the same value and maskWithPx derives onto it) — so either module's
  // restore helper undoes either module's swap.
  assert(KAIZO_SMALLER_HEART_MASK === UNDERBOX_SMALLER_MASK,
    'V2: the 2px mask is the SAME object underbox.js uses, not a private copy');
  underboxRestore(state);
  assert(state.soul.mask === HEART_RECT,
    'V2: …so underbox.js\'s restoreHeartMask undoes this module\'s swap');
  state.soul.mask = KAIZO_SMALLER_HEART_MASK;
  restoreHeartMask(state);
  assert(state.soul.mask === HEART_RECT, 'V2: restoreHeartMask puts the fight mask back');
  state.soul.mask = KAIZO_SMALLER_HEART_MASK;

  // event_user(1) — the custom split box.
  assertEq(gt.customBox, true, 'V2: event_user(1) marks the box custom');
  assertEq(gt.maxyscale, 3.3333333333333335,
    'V2: …maxyscale is the literal 10/3, and stays f64 (a plain variable)');
  assertEq(gt.image_yscale, Math.fround(3.3333333333333335),
    'V2: …image_yscale narrows to f32 (a built-in) — 3.3333332538604736');

  // The lightorb, ledgered rather than invented or dropped.
  const orb = state.kaizo.approx.filter((r) => String(r.asked).includes('obj_knight_lightorb'));
  assertEq(orb.length, 1, 'V2: the untranslated lightorb is ledgered exactly once');
  assertEq(orb[0].type, 97.1, 'V2: …against the B-Side quickslash controller type');
  assertEq(orb[0].used, 'nothing spawned', 'V2: …and nothing stands in for it');

  // The guard is idempotent: a second tear leaves the scale alone.
  const before = gt.image_yscale;
  const sp2 = spawnVerticalSplit(state, { x: gt.x, y: gt.y }, null);
  for (let f = 0; f < 21; f++) stepFrame(state, {});
  assertEq(gt.image_yscale, before, 'V2: `if (customBox) exit` makes event_user(1) idempotent');
  assertEq(sp2.con, 1, 'V2: …and the second organism still tore (the guard is the box\'s, not its)');
  assertEq(sp.con, 1, 'V2: the first organism is still open');
  destroy(sp2);
}

// ── V3 — the open ──────────────────────────────────────────────────────────
{
  const { state, gt } = scene();
  const sp = spawnVerticalSplit(state, { x: gt.x, y: gt.y }, null);
  for (let f = 0; f < 20; f++) stepFrame(state, {}); // through the tear
  assertEq(sp.distance, 0, 'V3: the gap is 0 on the tear frame itself');

  let bad = 0;
  for (let t = 1; t <= 30; t++) {
    stepFrame(state, {});
    const want = scrEaseOut(t / 30, 6) * 50;
    if (sp.distance !== want) bad += 1;
  }
  assertEq(bad, 0, 'V3: distance is scr_ease_out(timer/30, 6) * 50, all 30 frames, exactly');
  assertEq(sp.timer, 30, 'V3: …and the open lasts exactly 30 frames');
  assertEq(sp.distance, 49.951171875,
    'V3: curve 6 is -2^-10t + 1, so the gap ends at 49.951171875, never 50');
  assert(sp.distance !== 50, 'V3: …and specifically not the split_dist literal');
}

// ── V4 — the parked box and the riding flames ──────────────────────────────
{
  const { state, gt } = scene();
  const sp = spawnVerticalSplit(state, { x: gt.x, y: gt.y }, null);
  const xstart = gt.xstart;

  for (let f = 0; f < 19; f++) stepFrame(state, {});
  assertEq(gt.x, xstart, 'V4: the box sits at xstart while the organism waits');
  stepFrame(state, {}); // the tear — distance is still 0 this frame
  assertEq(gt.x, xstart, 'V4: …and on the tear frame itself, because distance is still 0');

  let parked = 0;
  let markerBad = 0;
  for (let f = 0; f < 60; f++) {
    stepFrame(state, {});
    if (gt.x === -9999) parked += 1;
    const d = Math.round(sp.distance);
    if (sp.markers[0].y !== sp.y - d - 1) markerBad += 1;
    if (sp.markers[1].y !== sp.y + d + 3) markerBad += 1;
    if (sp.markers[0].x !== xstart + 2 || sp.markers[1].x !== xstart) markerBad += 1;
  }
  assertEq(parked, 60, 'V4: the box is parked at -9999 for every open frame');
  assertEq(markerBad, 0, 'V4: the flames ride the cut faces at -1 / +3, Y only');
  assertEq(sp.markers[0].x, xstart + 2, 'V4: marker 0\'s x never moves after Create');
  assertEq(sp.markers[1].x, xstart, 'V4: marker 1\'s x never moves after Create');
  // `flame_index += 0.5` per frame, out of the Draw and onto the sim frame.
  assert(sp.flame_index > 0 && sp.flame_index % 0.5 === 0,
    `V4: flame_index advances 0.5 a frame (got ${sp.flame_index})`);
}

// ── V5 — the half-box clamp, both halves ───────────────────────────────────
{
  // BELOW the box centre: heart_y +1, band [gt.y + 40, gt.y + 100].
  const lower = scene({ soulX: 314, soulY: 162 });
  const spL = spawnVerticalSplit(lower.state, { x: lower.gt.x, y: lower.gt.y }, null);
  for (let f = 0; f < 19; f++) stepFrame(lower.state, {});
  assertEq(lower.state.soul.y, 162, 'V5: the soul is untouched before the tear');
  stepFrame(lower.state, {});
  assertEq(spL.heart_y, 1, 'V5: soul below the box centre => heart_y +1');
  assertEq(lower.state.soul.y, lower.gt.y + 40,
    'V5: the tear TELEPORTS the soul into its half (y + 40)');
  for (let f = 0; f < 60; f++) stepFrame(lower.state, {});
  assertEq(lower.state.soul.y, lower.gt.y + 100,
    'V5: the shove drives it to the far edge of the lower band (y + 100)');

  // ABOVE the box centre: heart_y -1, band [gt.y - 122, gt.y - 60].
  const upper = scene({ soulX: 314, soulY: 100 });
  const spU = spawnVerticalSplit(upper.state, { x: upper.gt.x, y: upper.gt.y }, null);
  for (let f = 0; f < 20; f++) stepFrame(upper.state, {});
  assertEq(spU.heart_y, -1, 'V5: soul above the box centre => heart_y -1');
  assertEq(upper.state.soul.y, 100,
    'V5: …already inside [y-122, y-60], so the tear frame leaves it alone');
  for (let f = 0; f < 60; f++) stepFrame(upper.state, {});
  assertEq(upper.state.soul.y, upper.gt.y - 122,
    'V5: …and shoved to its far edge (y - 122)');
  assert(spU.heart_y !== spL.heart_y, 'V5: the two halves really are different branches');

  // Both edges of the upper band, so the branch is pinned on both sides: a
  // soul ABOVE it is pulled down to y - 122, one BELOW it up to y - 60.
  const high = scene({ soulX: 314, soulY: 20 });
  const spH = spawnVerticalSplit(high.state, { x: high.gt.x, y: high.gt.y }, null);
  for (let f = 0; f < 20; f++) stepFrame(high.state, {});
  assertEq(spH.heart_y, -1, 'V5: a soul far above is still the upper half');
  assertEq(high.state.soul.y, high.gt.y - 122, 'V5: …and is pulled down to y - 122');
  const mid = scene({ soulX: 314, soulY: 155 });
  const spM = spawnVerticalSplit(mid.state, { x: mid.gt.x, y: mid.gt.y }, null);
  for (let f = 0; f < 20; f++) stepFrame(mid.state, {});
  assertEq(spM.heart_y, -1, 'V5: soul.y + 10 = 165 < box y 170 => upper half');
  assertEq(mid.state.soul.y, mid.gt.y - 60, 'V5: …and is pushed up to y - 60');

  // X is pinned to a FIXED band that does not widen with the gap.
  const west = scene({ soulX: 200, soulY: 162 });
  spawnVerticalSplit(west.state, { x: west.gt.x, y: west.gt.y }, null);
  for (let f = 0; f < 40; f++) stepFrame(west.state, {});
  assertEq(west.state.soul.x, west.gt.xstart - 70, 'V5: x clamps to xstart - 70');
  const east = scene({ soulX: 500, soulY: 162 });
  spawnVerticalSplit(east.state, { x: east.gt.x, y: east.gt.y }, null);
  for (let f = 0; f < 40; f++) stepFrame(east.state, {});
  assertEq(east.state.soul.x, east.gt.xstart + 52, 'V5: …and to xstart + 52');
}

// ── V6 — it never closes ───────────────────────────────────────────────────
{
  const { state, gt } = scene();
  const sp = spawnVerticalSplit(state, { x: gt.x, y: gt.y }, null);
  for (let f = 0; f < 51; f++) stepFrame(state, {}); // 20 shut + 31 open
  assertEq(sp.con, 2, 'V6: event_user(0) takes con 1 -> 2 after the 30-frame open');
  const frozen = sp.distance;
  assertEq(frozen, 49.951171875, 'V6: …with the gap at its final value');
  for (let f = 0; f < 240; f++) stepFrame(state, {});
  assertEq(sp.con, 2, 'V6: there is no con-2 block, so nothing advances it');
  assertEq(sp.distance, frozen, 'V6: the gap is PERMANENT — 240 more frames, same value');
  assertEq(gt.x, -9999, 'V6: …and the box stays parked for the rest of the turn');
  assert(state.soul.mask === KAIZO_SMALLER_HEART_MASK,
    'V6: …and the soul keeps the shrunken hitbox');
}

// ── V7 — no rounding ───────────────────────────────────────────────────────
{
  // Driven directly, because the fight soul's own Step keeps it integral —
  // the point is that THIS End Step does not round, where the horizontal
  // organism's does (`heart.x = Math.round(heart.x)`).
  const { state, gt } = scene();
  const sp = spawnVerticalSplit(state, { x: gt.x, y: gt.y }, null);
  sp.con = 1;
  sp.heart_y = 1;
  state.soul.x = gt.xstart + 10.5;
  state.soul.y = gt.y + 70.25;
  splitGrowtangleVertical.endStep(sp, state);
  assertEq(state.soul.x, gt.xstart + 10.5, 'V7: a fractional x inside the band survives');
  assertEq(state.soul.y, gt.y + 70.25, 'V7: …and so does a fractional y');
  // The clamp itself still bites, so this is not "the End Step did nothing".
  state.soul.y = gt.y + 500.5;
  splitGrowtangleVertical.endStep(sp, state);
  assertEq(state.soul.y, gt.y + 100, 'V7: …while the band edge still clamps');
  // con 0 means no clamp at all.
  sp.con = 0;
  state.soul.y = gt.y + 500.5;
  splitGrowtangleVertical.endStep(sp, state);
  assertEq(state.soul.y, gt.y + 500.5, 'V7: `if (con > 0)` gates the whole End Step');
}

// ── V8 — the substitution was not equivalent ───────────────────────────────
{
  // What quickslash's endtype-1 branch spawns TODAY: the horizontal organism
  // with `vertical = true`, behind the ledger row this module closes.
  const { state, gt } = scene();
  const sub = spawn(state, splitGrowtangle, { x: gt.x, y: gt.y });
  sub.target = 0;
  sub.vertical = true;
  sub.con = 1; // what armKaizoSplitter does
  for (let f = 0; f < 80; f++) stepFrame(state, {});

  assert(state.soul.mask !== KAIZO_SMALLER_HEART_MASK,
    'V8: the stand-in never shrinks the soul\'s hitbox — the mod\'s one delta is absent');
  assert(sub.max_distance === 70,
    `V8: the stand-in opens to max_distance 70, not 50 (got ${sub.max_distance})`);
  assert(sub.con !== 2 || sub.distance !== 49.951171875,
    'V8: …and its gap does not settle where the vertical organism\'s does');
  assert(sub.bullet_count === 13,
    'V8: the stand-in fires 13 teeth; the vertical organism fires none');
  assert(typeof sub.split_hold === 'number' && sub.split_hold > 0,
    'V8: …and runs an open/close cycle the vertical organism has no state for');
  // The real object has none of the horizontal one's configuration at all.
  const { state: s2, gt: gt2 } = scene();
  const real = spawnVerticalSplit(s2, { x: gt2.x, y: gt2.y }, null);
  assertEq(real.max_distance, undefined, 'V8: the vertical organism has no max_distance');
  assertEq(real.bullet_count, undefined, 'V8: …no bullet_count');
  assertEq(real.difficulty, undefined, 'V8: …and no difficulty axis');
  assertEq(real.old_distance, undefined,
    'V8: …and no old_distance instance variable (its delta is a Step local)');
}

// ── report ─────────────────────────────────────────────────────────────────
if (failures) {
  console.log(`check-split-growtangle-vertical: ${failures} FAILURE(S) of ${checks} checks`);
  process.exit(1);
}
console.log(`check-split-growtangle-vertical: all ${checks} checks passed`);
console.log('  V1 create / V2 the tear + the 2px mask delta / V3 the ease-out open');
console.log('  V4 parked box + riding flames / V5 the half-box clamp, both halves');
console.log('  V6 it never closes / V7 no rounding / V8 the stand-in was not equivalent');
process.exit(0);
