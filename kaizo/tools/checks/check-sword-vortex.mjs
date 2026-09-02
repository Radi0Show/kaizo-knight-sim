#!/usr/bin/env node
// KAIZO V-C sword vortex — positive assertions on every branch the mod adds.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// What this pins (each one FAILS if its branch is deleted):
//   T1  copy fidelity — with no kaizo context (variant 3, no ac), the kaizo
//       module is byte-identical to the verified sim module over 240 frames.
//   T2  variant 4 — a co-existing rotating slash (or swordfall) at create
//       time pins the vortex centre: no centermoves, no wander irandoms,
//       centre exactly at the growtangle for the whole run, while T1's
//       centre demonstrably moved. Swords still spawn on the same cadence.
//   T3  variant 3.1 (myattackchoice 20) — parameter table, first sword one
//       frame after create (vs T1's five), and the wander roll landing at
//       (gt.x - 60 + irandom(120) - 25, gt.y - 60 + irandom(120) + 0),
//       byte-exact against a mirrored RNG stream (choose, irandom, irandom).
//   T4  attack 111 movespeed override — 120 on side A, 100 on the B-Side,
//       measured as the actual centre-move cycle length, vs T1's 60.
//   T5  kaizo_vortexend_step endgame — the freeze converts every sword into
//       an obj_regularbullet (fields copied, damage carried), turntimer 999;
//       then per frozen bullet: con 0 arms three 16-frame tweens (pull-back
//       ~80px away from the soul, +360° spin landing aimed at it), speed -8
//       at timer 20, lerped to 40 by timer 36 (the lunge, moving THROUGH
//       the soul point), sndcon handshake 0 -> 1 -> 2, and turntimer -1 at
//       timer 60. Collision path stays live (mask found, hits counted).
//   T6  the BLUE blades (Step_0:1-10, new in the mod) — every vortex sword
//       carries get_swordcolor() on every frame after its first, by the
//       SHARED reference from kaizo-colors.js; the swordtype setting selects
//       its row; a live Stars cone overrides it to c_white; and the vanilla
//       twin carries no blend at all (control).
//
//     node kaizo/tools/checks/check-sword-vortex.mjs      exit 0 / 1

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { gmlCreate, gmlChoose, gmlIrandom } from '../../../sim/rng.js';
import { pointDirection, lengthdirX, lengthdirY, gmlEq } from '../../../sim/gml.js';
import {
  swordVortex, swordVortexManager, kaizoVortexendFreeze, kaizoVortexendStep,
  vortexendBullet,
} from '../../attacks/sword-vortex.js';
import {
  swordVortexManager as simVortexManager,
} from '../../../sim/attacks/sword-vortex.js';
// The SHARED palette — asserted by identity, so a private copy anywhere
// would fail T6 outright.
import { getSwordcolor, SWORDCOLORS } from '../../attacks/kaizo-colors.js';

const fail = [];
let checked = 0;
function check(ok, msg) {
  checked += 1;
  if (!ok) fail.push(msg);
}

const NONE = {
  left: 0, right: 0, up: 0, down: 0, focus: 0, confirm: 0, cancel: 0, button3: 0,
};
const SEED = 12345;
const HEADINGS = [0, 45, 90, 135, 180, 225, 270, 315];

// Stub descriptors: only `.name` (and x/y) are read by the vortex code.
const GT_TYPE = { name: 'obj_growtangle' };
const HEART_TYPE = { name: 'obj_heart' };
const ROTSLASH_TYPE = { name: 'obj_knight_rotating_slash' };
const SWORDFALL_TYPE = { name: 'obj_knight_swordfall' };

function scene(managerType, { ac, sideb = false, rotslash = false, swordfall = false, seed = SEED } = {}) {
  const st = createState({ seed });
  st.damageEnabled = false;
  st.invTimer = -1;
  st.gmlRng = gmlCreate(seed);
  st.turntimer = 300;
  st.kaizo = { sideb };
  if (ac !== undefined) st.currentAc = ac;
  const gt = spawn(st, GT_TYPE, { x: 320, y: 170 });
  st.soul = spawn(st, HEART_TYPE, { x: 314, y: 162 });
  if (rotslash) spawn(st, ROTSLASH_TYPE, { x: 250, y: 100 });
  if (swordfall) spawn(st, SWORDFALL_TYPE, { x: 250, y: 100 });
  const mg = spawn(st, managerType, { x: gt.x, y: 0 });
  mg.damage = 120; // the mod's ac-111 arm: dc.damage = 120
  return { st, mg, gt };
}

const swords = (st) => st.entities
  .filter((e) => e.alive && e.type.name === 'obj_sword_vortex')
  .sort((a, b) => a.seq - b.seq);
const frozen = (st) => st.entities
  .filter((e) => e.alive && e.type.name === 'obj_regularbullet' && e.sndcon !== undefined)
  .sort((a, b) => a.seq - b.seq);
const tweens = (st) => st.entities.filter((e) => e.alive && e.type.name === 'obj_lerpvar');

// ── T1: copy fidelity — kaizo module === sim module with no kaizo context ──
{
  const A = scene(swordVortexManager, {});
  const B = scene(simVortexManager, {});
  check(A.mg.variant === 3, `T1: kaizo variant with no context = ${A.mg.variant}, want 3`);

  let centreMoved = false;
  let mismatch = null;
  let firstSwordFrameV3 = -1;
  for (let f = 0; f < 240 && !mismatch; f++) {
    stepFrame(A.st, NONE);
    stepFrame(B.st, NONE);
    if (firstSwordFrameV3 < 0 && swords(A.st).length > 0) firstSwordFrameV3 = f;
    for (const k of ['timer', 'siner', 'swordcount', 'setcount', 'rate',
      'centermovescon', 'centermovestimer', 'swordcirclecenterx',
      'swordcirclecentery', 'targetx', 'targety']) {
      if (!Object.is(A.mg[k], B.mg[k])) {
        mismatch = `T1 f${f}: manager.${k} kaizo=${A.mg[k]} sim=${B.mg[k]}`;
      }
    }
    const sa = swords(A.st);
    const sb = swords(B.st);
    if (sa.length !== sb.length) mismatch = `T1 f${f}: sword count ${sa.length} vs ${sb.length}`;
    for (let i = 0; i < sa.length && !mismatch; i++) {
      for (const k of ['x', 'y', 'dir', 'len', 'image_angle', 'image_alpha']) {
        if (!Object.is(sa[i][k], sb[i][k])) {
          mismatch = `T1 f${f}: sword[${i}].${k} kaizo=${sa[i][k]} sim=${sb[i][k]}`;
        }
      }
    }
    if (!Object.is(A.mg.swordcirclecenterx, 320) || !Object.is(A.mg.swordcirclecentery, 170)) {
      centreMoved = true;
    }
  }
  check(!mismatch, mismatch ?? '');
  check(swords(A.st).length === 6, `T1: ${swords(A.st).length} swords alive, want 6`);
  check(centreMoved, 'T1: variant 3 centre never moved (wander dead — vacuous baseline)');
  check(firstSwordFrameV3 === 4,
    `T1: first sword on frame ${firstSwordFrameV3}, want 4 (timer 6 -> fires at 11)`);
}

// ── T2: variant 4 — centre pinned while a rotating slash / swordfall lives ──
{
  const { st, mg } = scene(swordVortexManager, { rotslash: true });
  check(mg.variant === 4, `T2: variant with rotating slash present = ${mg.variant}, want 4`);
  check(mg.centermoves === 0, `T2: centermoves = ${mg.centermoves}, want 0`);
  let pinned = true;
  for (let f = 0; f < 240; f++) {
    stepFrame(st, NONE);
    if (!Object.is(mg.swordcirclecenterx, 320) || !Object.is(mg.swordcirclecentery, 170)) {
      pinned = false;
    }
  }
  check(pinned, 'T2: variant 4 centre moved — it must stay at the growtangle');
  check(mg.targetx === 0 && mg.targety === 0,
    `T2: wander target rolled (${mg.targetx},${mg.targety}) — variant 4 must never roll`);
  check(swords(st).length === 6, `T2: ${swords(st).length} swords alive, want 6`);
  // Same table otherwise: variant-3 numbers.
  check(mg.rate === 11 && mg.sinpower === 17 && mg.sinspeed === 22 && mg.startinglen === 80,
    'T2: variant 4 table numbers wrong');

  const sf = scene(swordVortexManager, { swordfall: true });
  check(sf.mg.variant === 4, `T2: variant with swordfall present = ${sf.mg.variant}, want 4`);
}

// ── T3: variant 3.1 — myattackchoice 20 ────────────────────────────────────
{
  const { st, mg } = scene(swordVortexManager, { ac: 20 });
  check(gmlEq(mg.variant, 3.1), `T3: variant = ${mg.variant}, want 3.1`);
  check(mg.timer === 10, `T3: post-create timer = ${mg.timer}, want 10 (set AFTER rate-5)`);
  check(mg.sinpower === 8 && mg.sinspeed === 10 && mg.startinglen === 90,
    `T3: table = sinpower ${mg.sinpower}/sinspeed ${mg.sinspeed}/startinglen ${mg.startinglen}, want 8/10/90`);
  check(mg.targetxoff === -25 && mg.targetyoff === 0,
    `T3: offsets = (${mg.targetxoff},${mg.targetyoff}), want (-25,0)`);
  check(mg.centermoves === 1 && mg.movespeed === 60, 'T3: centermoves/movespeed wrong');

  // Mirror the exact stream the first frame consumes: the fire block runs
  // before the wander block — choose (1 draw), then irandom, irandom.
  const mirror = gmlCreate(SEED);
  gmlChoose(mirror, HEADINGS);
  const i1 = gmlIrandom(mirror, 120);
  const i2 = gmlIrandom(mirror, 120);

  stepFrame(st, NONE);
  check(swords(st).length === 1,
    `T3: ${swords(st).length} swords after one frame, want 1 (timer 10 -> 11 == rate)`);
  check(Object.is(mg.targetx, 320 - 60 + i1 + -25),
    `T3: targetx = ${mg.targetx}, want ${320 - 60 + i1 - 25} (roll ${i1} shifted -25)`);
  check(Object.is(mg.targety, 170 - 60 + i2 + 0),
    `T3: targety = ${mg.targety}, want ${170 - 60 + i2} (roll ${i2}, no y offset)`);
}

// ── T4: attack 111 — movespeed 120 / 100, measured as the cycle length ─────
{
  // Cycle length = steps from a fresh wander roll to the reset equality
  // (centermovestimer == movespeed).
  const cycle = (st, mg, cap) => {
    for (let f = 0; f < cap; f++) {
      stepFrame(st, NONE);
      if (mg.centermovescon === 0 && f > 0) return f + 1; // reset fired this frame
    }
    return -1;
  };

  const a = scene(swordVortexManager, { ac: 111, sideb: false });
  check(a.mg.variant === 3, `T4: ac 111 variant = ${a.mg.variant}, want 3 (vortex spawns first)`);
  check(a.mg.movespeed === 120, `T4: side A movespeed = ${a.mg.movespeed}, want 120`);
  check(cycle(a.st, a.mg, 400) === 120, 'T4: side A centre cycle is not 120 frames');

  const b = scene(swordVortexManager, { ac: 111, sideb: true });
  check(b.mg.movespeed === 100, `T4: B-Side movespeed = ${b.mg.movespeed}, want 100`);
  check(cycle(b.st, b.mg, 400) === 100, 'T4: B-Side centre cycle is not 100 frames');

  const c = scene(swordVortexManager, {});
  check(cycle(c.st, c.mg, 400) === 60, 'T4: baseline centre cycle is not 60 frames');
}

// ── T5: the sideb-111 endgame — kaizoVortexendFreeze + kaizo_vortexend_step ─
{
  const { st, mg } = scene(swordVortexManager, { ac: 111, sideb: true });
  for (let f = 0; f < 150; f++) stepFrame(st, NONE);
  const liveSwords = swords(st);
  check(liveSwords.length === 6, `T5: ${liveSwords.length} swords before freeze, want 6`);
  const swordDamage = liveSwords[0].damage;
  check(swordDamage === 120, `T5: sword damage = ${swordDamage}, want 120 (manager's)`);

  kaizoVortexendFreeze(st);

  const fb = frozen(st);
  check(fb.length === 6, `T5: ${fb.length} frozen bullets, want 6`);
  check(st.turntimer === 999, `T5: turntimer after freeze = ${st.turntimer}, want 999`);
  for (const [i, b] of fb.entries()) {
    check(b.con === 0 && b.sndcon === 0 && b.timer === 0,
      `T5: frozen[${i}] con/sndcon/timer not 0/0/0`);
    check(b.damage === 120, `T5: frozen[${i}].damage = ${b.damage}, want 120`);
    check(b.destroyonhit === 0 && b.wall_destroy === 0,
      `T5: frozen[${i}] destroyonhit/wall_destroy not 0/0`);
    check(b.sprite_index === 'spr_roaringknight_sword_ol',
      `T5: frozen[${i}] sprite = ${b.sprite_index}`);
    check(b.type === vortexendBullet, `T5: frozen[${i}] wrong descriptor`);
  }
  for (const [i, sw] of liveSwords.entries()) {
    check(sw.active === 0 && sw.image_alpha === 0 && sw.visible === false,
      `T5: sword[${i}] not deactivated/hidden after freeze`);
  }

  // Per-bullet expectations, computed from the freeze-time positions the
  // con-0 frame will read (speed is 0 until timer 20, so they hold).
  const soulX = st.soul.x + 10;
  const soulY = st.soul.y + 10;
  const expect = fb.map((b) => {
    const pnt = pointDirection(b.x, b.y, soulX, soulY);
    return {
      x0: b.x,
      y0: b.y,
      d0: Math.hypot(b.x - soulX, b.y - soulY),
      pnt,
      xEnd: b.x + lengthdirX(80, pnt - 180),
      yEnd: b.y + lengthdirY(80, pnt - 180),
    };
  });

  const near = (a, b, tol, msg) => check(Math.abs(a - b) <= tol, `${msg} (${a} vs ${b})`);

  // k counts stepFrames after the freeze.
  stepFrame(st, NONE); // k = 1 — con 0 runs on every bullet
  for (const [i, b] of fb.entries()) {
    check(b.con === 1 && b.timer === 0, `T5 k1: frozen[${i}] con/timer = ${b.con}/${b.timer}, want 1/0`);
    check(b.sndcon === 1, `T5 k1: frozen[${i}].sndcon = ${b.sndcon}, want 1 (broadcast)`);
  }
  check(tweens(st).length === 18, `T5 k1: ${tweens(st).length} lerpvars alive, want 18 (3 x 6)`);

  for (let k = 2; k <= 17; k++) stepFrame(st, NONE); // tweens write 1..16
  for (const [i, b] of fb.entries()) {
    const e = expect[i];
    near(b.x, e.xEnd, 1e-3, `T5 k17: frozen[${i}].x pull-back end`);
    near(b.y, e.yEnd, 1e-3, `T5 k17: frozen[${i}].y pull-back end`);
    near(b.image_angle, e.pnt + 360, 1e-3, `T5 k17: frozen[${i}].image_angle spin end`);
    const d = Math.hypot(b.x - soulX, b.y - soulY);
    check(d > e.d0 + 60, `T5 k17: frozen[${i}] pulled ${d - e.d0}px away, want ~80`);
    check(Object.is(b.speed, 0), `T5 k17: frozen[${i}].speed = ${b.speed}, want 0 until timer 20`);
  }

  for (let k = 18; k <= 21; k++) stepFrame(st, NONE); // timer 20 lands at k21
  for (const [i, b] of fb.entries()) {
    check(Object.is(b.speed, -8), `T5 k21: frozen[${i}].speed = ${b.speed}, want -8`);
    check(b.sndcon === 2, `T5 k21: frozen[${i}].sndcon = ${b.sndcon}, want 2 (cut broadcast)`);
    // `direction = image_angle` lands WRAPPED: direction is an angle builtin
    // the runner (and sim/entity.js:61) normalizes to [0,360) on store,
    // while image_angle keeps the raw pnt+360.
    check(Object.is(b.direction, Math.fround(((b.image_angle % 360) + 360) % 360)),
      `T5 k21: frozen[${i}].direction ${b.direction} !== wrap(image_angle ${b.image_angle})`);
  }

  let minDist = Infinity;
  for (let k = 22; k <= 37; k++) { // speed tween writes k23..k37
    stepFrame(st, NONE);
    for (const b of fb) {
      minDist = Math.min(minDist, Math.hypot(b.x - soulX, b.y - soulY));
    }
    if (k === 30) {
      for (const [i, b] of fb.entries()) {
        check(b.speed > -8 && b.speed < 40,
          `T5 k30: frozen[${i}].speed = ${b.speed}, want mid-lerp`);
      }
    }
  }
  for (const [i, b] of fb.entries()) {
    check(Object.is(b.speed, 40), `T5 k37: frozen[${i}].speed = ${b.speed}, want 40`);
  }
  check(minDist < expect[0].d0,
    `T5: lunge never came back inside the freeze radius (min ${minDist} vs ${expect[0].d0})`);

  for (let k = 38; k <= 60; k++) stepFrame(st, NONE);
  // Not === 999: grazes pay timepoints off the turn clock while the swords
  // fly past the soul, in the real game too. What matters is that the turn
  // has NOT ended before timer 60.
  check(st.turntimer > 0 && st.turntimer <= 999,
    `T5 k60: turntimer = ${st.turntimer}, want still positive (turn not ended)`);
  stepFrame(st, NONE); // k = 61 — timer 60
  check(st.turntimer === -1, `T5 k61: turntimer = ${st.turntimer}, want -1`);

  // The frozen bullets stayed on the live collision path: masks resolved
  // (no unmasked skips for them) and the lunge through the soul connected.
  check(st.counters.collisionHits >= 1,
    `T5: collisionHits = ${st.counters.collisionHits}, want >= 1 (lunge through the soul)`);
  check(st.counters.motionSteps > 0, 'T5: no motion steps counted — lunge never moved');

  // kaizoVortexendStep is exported and callable directly (the launcher-side
  // contract): a fresh bullet context advances its own timer.
  const probe = { timer: 0, con: 1, sndcon: 2, image_angle: 0, direction: 0, speed: 0, x: 0, y: 0, alive: true };
  kaizoVortexendStep(probe, { entities: [], soul: null, turntimer: 300 });
  check(probe.timer === 1 && Object.is(probe.direction, probe.image_angle),
    'T5: exported kaizoVortexendStep did not run standalone');
}

// ── T6: THE BLUE BLADES (kaizo obj_sword_vortex Step_0:1-10) ───────────────
//
// Vanilla has no Step prefix at all, so a vortex sword drew plain white for
// its whole life. The mod repaints every blade EVERY FRAME — get_swordcolor()
// normally, c_white while a Stars cone is on screen. Colour only: the draw
// count is untouched, which T1's byte-equal fidelity run already proves.
{
  const CONE_TYPE = { name: 'obj_knight_pointing_cone' };
  const { st } = scene(swordVortexManager);
  const seenSwords = new Map(); // seq -> samples
  for (let f = 0; f < 120; f++) {
    stepFrame(st, NONE);
    for (const s of swords(st)) {
      if (!seenSwords.has(s.seq)) seenSwords.set(s.seq, []);
      seenSwords.get(s.seq).push(s.image_blend);
    }
  }
  // Skip each sword's FIRST sample: the entity list is frozen per phase, so a
  // blade spawned mid-frame has not run its own Step yet and still carries
  // the engine default. Every frame after is the mod's repaint.
  const runs = [...seenSwords.values()].filter((r) => r.length > 5);
  const sampled = runs.reduce((n, r) => n + r.length - 1, 0);
  const allBlue = runs.every((r) => r.slice(1).every((b) => b === getSwordcolor(st)));
  check(sampled > 200, `T6: only ${sampled} sword-frames sampled`);
  check(allBlue, 'T6: a vortex sword was not carrying get_swordcolor()');
  // CONTROL: the vanilla module never assigns image_blend at all, so the same
  // scene on the sim type leaves every blade undefined.
  {
    const { st: sv } = scene(simVortexManager);
    for (let f = 0; f < 60; f++) stepFrame(sv, NONE);
    check(swords(sv).length > 0 && swords(sv).every((s) => s.image_blend === undefined),
      'T6 control: the vanilla vortex sword carries no blend — the blue is a kaizo delta');
  }
  // The IDENTITY matters, not just the value: the mod's own Draw gates are
  // `image_blend == get_swordcolor()`, so the setter has to hand out the
  // shared module's stable reference and not a fresh array.
  const one2 = swords(st)[0];
  check(one2 && one2.image_blend === getSwordcolor(st),
    'T6: the blend is not the SHARED stable reference from kaizo-colors.js');
  check(getSwordcolor(st)[2] === 255 && getSwordcolor(st)[0] === 0,
    'T6: get_swordcolor() default is not pure blue — the BGR decode is wrong');

  // The swordtype setting rides through: a different row, a different blade.
  const { st: st2 } = scene(swordVortexManager);
  st2.kaizo.swordtype = 3;
  for (let f = 0; f < 60; f++) stepFrame(st2, NONE);
  const s3 = swords(st2)[0];
  check(s3 && s3.image_blend === SWORDCOLORS[3]
    && s3.image_blend[0] === 149 && s3.image_blend[1] === 147,
    `T6: swordtype 3 blade blend ${JSON.stringify(s3 && s3.image_blend)}, want [149,147,255]`);

  // …and the cone arm wins over it.
  const { st: st3 } = scene(swordVortexManager);
  st3.kaizo.swordtype = 3;
  spawn(st3, CONE_TYPE, { x: 100, y: 100 });
  for (let f = 0; f < 60; f++) stepFrame(st3, NONE);
  const sc = swords(st3)[0];
  check(sc && sc.image_blend[0] === 255 && sc.image_blend[1] === 255 && sc.image_blend[2] === 255,
    `T6: with a Stars cone alive the blade must be c_white (got ${JSON.stringify(sc && sc.image_blend)})`);
}

// ── report ─────────────────────────────────────────────────────────────────
if (fail.length) {
  console.log(`check-sword-vortex: ${fail.length} FAILURE(S) of ${checked} checks`);
  for (const f of fail) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`check-sword-vortex: all ${checked} checks passed`);
console.log('  T1 copy fidelity (240f byte-equal) / T2 variant 4 pin / T3 variant 3.1');
console.log('  T4 ac-111 movespeed 120/100 / T5 vortexend freeze-and-lunge endgame');
process.exit(0);
