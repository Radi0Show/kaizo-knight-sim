#!/usr/bin/env node
// KAIZO V-C underbox — positive assertions on every branch the mod ADDS to
// obj_knight_weird_bottom_manager / obj_knight_weird_circle, against
// kaizo/attacks/underbox.js (the kaizo copy of the verified sim module).
//
// Each block asserts what its branch CHANGES, so deleting any translated
// delta fails loudly:
//   - the per-step soul-mask swap (spr_dodgeheart_smaller_2px_mask) + restore
//   - center_y offsets: +92 (ac 101), +32 (ac 102), NONE for 102.1
//   - cadence delay 18 -> 29 (ac 102) / 27 (ac 102 B-Side); 18 retained for
//     ac 101 / 102.1 / base — read off the armed orb's rgb_rate (= fuse)
//   - ac 102.1 norng: random_set_seed(1225) at create, seed += 49121 +
//     reseed before every re-arm jitter — asserted against the EXPECTED
//     stream (gmlCreate(49121k)) and across two different scene seeds
//   - dc.damage 87/103 plumbing onto the manager (terminal), fans hardcoded
//     103, big shot retained at 206
//   - retained vanilla shape: 5 orbs, 1 big + 7 fans per volley, fan
//     directions/speeds, wind-down releasing the turn (turntimer -1)
//
//     node kaizo/tools/checks/check-underbox.mjs
//
// PUBLISH GATE: V-C recreation of EnderCat8's Kaizo Roaring Knight — do not
// publish without permission.

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn, destroy } from '../../../sim/entity.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { gmlCreate, gmlIrandom, gmlChoose } from '../../../sim/rng.js';
import { gmlRound } from '../../../sim/gml.js';
import { HEART_RECT } from '../../../sim/masks.js';
import {
  launchUnderbox, weirdBottomManager, KAIZO_SMALLER_HEART_MASK, restoreHeartMask,
} from '../../attacks/underbox.js';
import { kaizoMask } from '../../data/masks.js';

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
    console.log(`  FAIL ${label}: got ${got}, want ${want}`);
  }
}

function near(a, b, eps = 1e-3) {
  return Math.abs(a - b) < eps;
}

/**
 * A fight-shaped scene (knight, party, board, soul) with the practice
 * director removed so nothing auto-launches, then the kaizo manager launched
 * directly the way the V-C launcher's type-106 case does.
 */
function run(ac, { sideb = false, seed = 12345, frames = 420, dcDamage } = {}) {
  const state = createState({ seed });
  buildSingleAttackScene(state, { seed, attack: 'underbox', difficulty: 0 });
  const dir = state.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  state.kaizo = { sideb };
  state.currentAc = ac; // obj_knight_enemy.myattackchoice analog
  state.turntimer = 999999; // the type-106 pin the launcher applies
  state.soul.mask = HEART_RECT; // the FIGHT soul's mask (moveheart handoff)

  const mg = launchUnderbox(state, undefined, undefined, { dcDamage });
  const rec = {
    state, mg, firings: [], bigFrames: [], fans: [], bigs: [],
    // random_set_seed(1225) happens INSIDE the manager's Create, so the
    // stream the scene carries out of the launch is the branch's observable
    // (gmlCreate records the seed it was built from). In the real mod its
    // reach is global — every other object's draws until the first 49121
    // reseed come from the 1225 lineage.
    seedAtLaunch: state.gmlRng.seed,
  };
  let prevAlarm1 = mg.alarm[1];
  const seenBullets = new Set();
  for (let f = 0; f < frames; f++) {
    stepFrame(state, {});
    if (mg.alive && mg.alarm[1] > prevAlarm1) {
      // An increase is either alarm-0's arming (alarm[1] = init, no orb lit)
      // or a real firing (one orb armed with the fuse). Read the fuse off
      // rgb_rate — a plain var set alongside the alarm, so it is not already
      // one decrement stale by the time we observe post-frame.
      const orbs = state.entities.filter(
        (x) => x.alive && x.type.name === 'obj_knight_weird_circle',
      );
      let armed = null;
      for (const o of orbs) {
        if (o.alarm[1] > 0 && (!armed || o.alarm[1] > armed.alarm[1])) armed = o;
      }
      rec.firings.push({
        frame: f,
        alarm1: mg.alarm[1],
        fuse: armed ? armed.rgb_rate : -1,
        real: armed !== null,
        seed: mg.seed,
        spinBefore: mg.spin,
        pend: (mg.pendingDelayed ?? []).map((p) => p.delay),
      });
    }
    prevAlarm1 = mg.alive ? mg.alarm[1] : prevAlarm1;
    for (const x of state.entities) {
      if (!x.alive || seenBullets.has(x)) continue;
      if (x.type.name === 'obj_knight_weird_circle_bullet') {
        seenBullets.add(x);
        rec.bigFrames.push(f);
        rec.bigs.push({ damage: x.damage, grazepoints: x.grazepoints, destroyonhit: x.destroyonhit });
      } else if (x.type.name === 'obj_knight_weird_fan') {
        seenBullets.add(x);
        rec.fans.push({
          frame: f, damage: x.damage, grazepoints: x.grazepoints,
          element: x.element, direction: x.direction, speed: x.speed,
        });
      }
    }
    if (f === 25) {
      rec.centerY25 = mg.center_y;
      rec.mask25 = state.soul ? state.soul.mask : null;
      rec.orbCount25 = state.entities.filter(
        (x) => x.alive && x.type.name === 'obj_knight_weird_circle',
      ).length;
    }
  }
  rec.real = rec.firings.filter((x) => x.real);
  return rec;
}

// ── base: the vanilla-ac copy retains verified behavior, plus the mod's
//    unconditional pieces (mask swap; fans at 103) ─────────────────────────
console.log('base (ac 6 — vanilla schedule shape under the kaizo module)');
const base = run(6);
assertEq(base.mg.delay, 18, 'base delay stays 18');
assertEq(base.mg.norng, 0, 'base norng stays 0');
assertEq(base.state.gmlRng.seed, 12345, 'base: no create reseed (stream keeps the scene seed)');
assertEq(base.orbCount25, 5, 'five orbs on the ring');
assert(base.real.length >= 5, `enough volleys to measure (got ${base.real.length})`);
assertEq(base.real[0].fuse, 18, 'base fuse (orb rgb_rate) is 18');
assert([18, 20, 22, 24].includes(base.real[0].alarm1), `base re-arm 18 + 2*irandom(3) (got ${base.real[0].alarm1})`);
assertEq(base.mg.seed, 0, 'base: norng seed never walks');

// mask: swapped every step, with the extracted geometry, restored on demand
assert(base.mask25 === KAIZO_SMALLER_HEART_MASK, 'soul mask swapped to spr_dodgeheart_smaller_2px_mask');
// IT IS THE EXTRACTED OBJECT, not a look-alike copy. swordfall.js and
// knight-stream.js stamp the same sprite, and restoreHeartMask() below
// compares by REFERENCE — a per-module copy passes every geometry test here
// and then silently fails to restore a mask another attack stamped.
assert(KAIZO_SMALLER_HEART_MASK === kaizoMask('spr_dodgeheart_smaller_2px_mask'),
  'the mask IS kaizo/data/masks.js\'s extracted object (one shared definition)');
assertEq(KAIZO_SMALLER_HEART_MASK.name, 'spr_dodgeheart_smaller_2px_mask',
  'and it carries the real sprite name (not the ART sprite spr_dodgeheart_smaller_2px)');
assertEq(KAIZO_SMALLER_HEART_MASK.bbox.join(','), '4,4,15,15', 'mask bbox matches the data-kaizo.win extraction');
assert(!KAIZO_SMALLER_HEART_MASK.axisRect,
  'the extracted sprite is Precise — no axisRect, so it takes the precise sampler');
{
  let solid = 0;
  for (const row of KAIZO_SMALLER_HEART_MASK.px) for (const p of row) if (p) solid += 1;
  assertEq(solid, 100, 'mask solid-pixel count matches the extraction');
}
assert(KAIZO_SMALLER_HEART_MASK !== HEART_RECT, 'mask actually differs from the fight rect');
// faithful: NOT restored by the manager's death…
assert(!base.mg.alive, 'manager wound down and destroyed itself');
assertEq(base.state.turntimer, -1, 'alarm 2 released the turn clock');
{
  const kn = base.state.entities.find((x) => x.alive && x.type.name === 'obj_knight_enemy');
  assertEq(kn && kn.image_alpha, 1, 'alarm 2 restored the Knight\'s alpha');
}
assert(base.state.soul.mask === KAIZO_SMALLER_HEART_MASK, 'mask faithfully NOT restored at destroy (moveheart is the restore)');
restoreHeartMask(base.state);
assert(base.state.soul.mask === HEART_RECT, 'restoreHeartMask puts HEART_RECT back');
restoreHeartMask(base.state);
assert(base.state.soul.mask === HEART_RECT, 'restoreHeartMask is idempotent');

// volley composition on the first volley frame (retained vanilla shape)
{
  const f0 = base.bigFrames[0];
  const volley = base.fans.filter((x) => x.frame === f0);
  assertEq(volley.length, 7, 'volley is 5 + 2 fans (middle two of the second ring skipped)');
  const dirs = volley.map((x) => x.direction).sort((a, b) => a - b);
  const want = [27.5, 40, 58.75, 90, 121.25, 140, 152.5];
  assert(
    dirs.length === want.length && dirs.every((d, i) => near(d, want[i])),
    `fan directions retained (got ${dirs.map((d) => d.toFixed(2)).join(',')})`,
  );
  const speeds = volley.map((x) => x.speed).sort((a, b) => a - b);
  assert(speeds[0] === 4 && speeds[6] === 6, 'fan speeds 4 (wide ring) / 6 (gap ring)');
  assert(volley.every((x) => x.damage === 103), 'KAIZO: every fan carries 103 (was 206)');
  assert(volley.every((x) => x.grazepoints === 3 && x.element === 5), 'fan grazepoints/element retained');
  assert(base.bigs[0].damage === 206, 'big shot KEEPS 206 (unchanged by the mod)');
  assert(base.bigs[0].grazepoints === 12 && base.bigs[0].destroyonhit === 0, 'big shot fields retained');
}

// ── ac 102: cadence 18 -> 29 (27 B-Side), center +32 ───────────────────────
console.log('ac 102 (Frenzy pairing — slow cadence, +32 center)');
const a102 = run(102);
assertEq(a102.mg.delay, 29, 'ac 102 delay = 29');
assertEq(a102.real[0].fuse, 29, 'ac 102 fuse (orb rgb_rate) = 29');
assert(
  [29, 31, 33, 35].includes(a102.real[0].alarm1),
  `ac 102 re-arm 29 + 2*irandom(3) (got ${a102.real[0].alarm1})`,
);
assert(a102.real[0].alarm1 % 2 === 1, 'ac 102 re-arm is ODD — the fractional-half exposure');
assert(near(a102.centerY25 - base.centerY25, 32, 1e-9), `ac 102 center_y = base + 32 (got +${a102.centerY25 - base.centerY25})`);
{
  // The settle leg's obj_script_delayed alarm: stored as an INT (gmlRound of
  // the fractional half), observed post-step so one decrement has happened.
  const f = a102.real[0];
  assertEq(f.pend.length, 1, 'one pending settle leg after the firing');
  const half = f.alarm1 / 2 - 2;
  assert(!Number.isInteger(half), `half is fractional under delay 29 (${half})`);
  assertEq(f.pend[0], gmlRound(half) - 1, 'settle delay = gmlRound(half), alarm-int model');
  assert(Number.isInteger(f.pend[0]), 'settle delay stored as an integer');
}

const a102b = run(102, { sideb: true });
assertEq(a102b.mg.delay, 27, 'ac 102 B-Side delay = 27');
assertEq(a102b.real[0].fuse, 27, 'ac 102 B-Side fuse = 27');
assert(near(a102b.centerY25 - base.centerY25, 32, 1e-9), 'B-Side keeps the +32 center');

// ── ac 101: center +92, cadence untouched ──────────────────────────────────
console.log('ac 101 (Rising Abyss pairing — +92 center, delay untouched)');
const a101 = run(101);
assertEq(a101.mg.delay, 18, 'ac 101 delay stays 18 (the 102 gate does not leak)');
assertEq(a101.real[0].fuse, 18, 'ac 101 fuse = 18');
assert(near(a101.centerY25 - base.centerY25, 92, 1e-9), `ac 101 center_y = base + 92 (got +${a101.centerY25 - base.centerY25})`);
assert(a101.mask25 === KAIZO_SMALLER_HEART_MASK, 'ac 101 also swaps the mask (unconditional)');

// ── ac 102.1: the deterministic twin ───────────────────────────────────────
console.log('ac 102.1 (norng — random_set_seed(1225), 49121-stride reseeds)');
const d1 = run(102.1, { seed: 111 });
const d2 = run(102.1, { seed: 999 });
assertEq(d1.mg.norng, 1, '102.1 sets norng');
assertEq(d1.seedAtLaunch, 1225, '102.1 create reseeds the GLOBAL stream to 1225');
assertEq(d2.seedAtLaunch, 1225, '102.1 create reseed is seed-independent');
assertEq(base.seedAtLaunch, 12345, 'base create does NOT reseed');
assertEq(d1.mg.delay, 18, '102.1 keeps delay 18 (fails the ==102 gate)');
assert(near(d1.centerY25 - base.centerY25, 0, 1e-9), '102.1 keeps the vanilla center (fails both offset gates)');
assert(d1.mask25 === KAIZO_SMALLER_HEART_MASK, '102.1 still swaps the mask');
// the create reseed: gmlCreate records its seed; both runs left on 1225's
// lineage until the first firing reseeds to 49121
assert(d1.real.length >= 3 && d2.real.length >= 3, 'three deterministic firings observed');
for (let k = 1; k <= 3; k++) {
  const f = d1.real[k - 1];
  assertEq(f.seed, 49121 * k, `firing ${k}: seed walked to 49121*${k}`);
  const r = gmlCreate(49121 * k);
  const jitter = gmlIrandom(r, 3);
  assertEq(f.alarm1, 18 + 2 * jitter, `firing ${k}: re-arm = 18 + 2*irandom(3) from the 49121*${k} stream`);
  const spin = gmlChoose(r, [-12, 12]);
  if (k < 3) {
    // by the NEXT firing the lurch has settled to sign(newspin) * 1
    const next = d1.real[k];
    assertEq(Math.sign(next.spinBefore), Math.sign(spin), `firing ${k}: choose(-12,12) drove the spin sign`);
  }
}
// two DIFFERENT scene seeds, identical pattern — the mod's practice hook
assertEq(
  JSON.stringify(d1.real.map((x) => [x.frame, x.alarm1, x.seed])),
  JSON.stringify(d2.real.map((x) => [x.frame, x.alarm1, x.seed])),
  '102.1 firing schedule identical across scene seeds',
);
assertEq(
  JSON.stringify(d1.bigFrames), JSON.stringify(d2.bigFrames),
  '102.1 volley frames identical across scene seeds',
);
// contrast: ac 102 (norng = 0) does NOT reseed
assertEq(a102.mg.seed, 0, 'ac 102 never walks the norng seed');

// ── dc.damage plumbing (87 / 103) ──────────────────────────────────────────
console.log('dc.damage plumbing (Other_23 87/103 -> scr_bullet_inherit -> manager)');
const p87 = run(3, { dcDamage: 87, frames: 80 });
assertEq(p87.mg.damage, 87, 'dc.damage 87 lands on the manager (ac 3 solo row)');
const p103 = run(101, { dcDamage: 103, frames: 80 });
assertEq(p103.mg.damage, 103, 'dc.damage 103 lands on the manager (paired rows)');
{
  // …and dies there: bullets keep their hardcoded values (the GML finding).
  const f0 = p87.bigFrames[0];
  const volley = p87.fans.filter((x) => x.frame === f0);
  assert(volley.length === 7 && volley.every((x) => x.damage === 103), 'fans stay 103 under dc.damage 87');
  assert(p87.bigs[0].damage === 206, 'big shot stays 206 under dc.damage 87');
}
assertEq(run(6, { frames: 2 }).mg.damage, 10, 'no dcDamage -> scr_bullet_init default (nothing else writes it)');

// ── the CHAINED teardown — Alarm_1's turn_type arms, lines 11-43 ──────────
//
// WHY THIS BLOCK EXISTS. Until 2026-08-30 the wind-down carried ONLY the
// "full" arm (alarm[2] = 40 and two 20-frame-delayed calls), so a manager
// arriving as a COMBINATION SEGMENT — atk_Frenzy3 is ac 106, order 1-2-5, and
// the underbox is segment 3 with turn_type "short end" — held the turn open
// 8 frames past the mod's and never put the Knight back on screen at the right
// moment. Measured on the whole-fight diff against
// kaizo_oracle_trace_tok3.csv: Frenzy3's bullet phase went sim 305 -> 297
// against the mod's 225 when the else-arm landed, exactly the 8 frames.
//
//     if (turn_type == "full") { alarm[2] = 40; two delayed calls }
//     else {
//         alarm[2] = 32;
//         if (short start | short mid | start) switch (next_up)
//             { 1 -> 1, 2 -> 12, 3 -> 18, 4 -> 1 }
//         if (end | short end) { scr_lerpvar("image_index", image_index, 8, 8);
//                                image_alpha = 1; }
//     }
//
// THE CHAINED ARM IS APPLIED HERE, NOT IMPORTED. Other_10's non-"full" arms
// live in kaizo/attacks/combination.js's CHAINED_ARMS (that file owns the
// handoff; underbox.js's own `init` is the "full" arm alone), and they are not
// exported. Restating the four fields from
// gml_Object_obj_knight_weird_bottom_manager_Other_10.gml:34-56 keeps this
// check independent of the chain's routing, which is the thing under test in
// check-oracle-weird rather than here.
console.log('chained teardown (Alarm_1 turn_type arms)');

/**
 * A manager that arrived as a chained SEGMENT: spawned bare (so underbox.js's
 * "full" `init` never runs) and given the Other_10 arm for `turnType`.
 *
 * `alarm[2]` and the image fields are read POST-STEP, one decrement after the
 * wind-down assigned them — so an assigned 32 is observed as 31. The delta
 * assertions below are written on the observed values and say so.
 */
function runChained(turnType, { nextUp = -999, seed = 12345, frames = 520 } = {}) {
  const state = createState({ seed });
  buildSingleAttackScene(state, { seed, attack: 'underbox', difficulty: 0 });
  const dir = state.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  state.kaizo = { sideb: false };
  state.currentAc = 106; // the combination row this arm is reached from
  state.turntimer = 999999;
  state.soul.mask = HEART_RECT;
  const kn = state.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy');
  const mg = spawn(state, weirdBottomManager, { x: kn.x, y: kn.y });
  mg.turn_type = turnType;
  mg.turn_segment = 2;
  mg.next_up = nextUp;
  // Other_10's "end" / "short end" / "short mid" / "short start" arms.
  mg.init_start = 2;
  mg.init = 1;
  mg.local_turntimer = turnType === 'end' ? 200 : 170;
  mg.image_alpha = 0;
  mg.image_index = 5;

  const rec = { state, mg, windDown: null, alarm2: null, alpha: null, index: null, dead: null };
  let alive = true;
  for (let f = 0; f < frames; f++) {
    stepFrame(state, {});
    // `>= 0`, not `> 0`: the next_up switch can assign 1, which is already
    // down to 0 by the time this reads it, and an idle alarm is -1.
    if (rec.windDown === null && mg.alarm[2] >= 0) {
      rec.windDown = f;
      rec.alarm2 = mg.alarm[2];
      rec.alpha = mg.image_alpha;
      rec.index = mg.image_index;
    }
    if (alive && !mg.alive) { alive = false; rec.dead = f; }
  }
  return rec;
}

{
  // The "full" control, taken through the shipped launcher so the two paths
  // are the real ones and not two spellings of the same setup.
  const full = run(6, { frames: 520 });
  let fullWd = null;
  let fullA2 = null;
  {
    // `run` does not watch alarm[2], so re-derive the control the same way the
    // chained runner does. Cheap, and it keeps `run` untouched.
    const st = createState({ seed: 12345 });
    buildSingleAttackScene(st, { seed: 12345, attack: 'underbox', difficulty: 0 });
    const d = st.entities.find((e) => e.alive && e.type.name === 'practice_director');
    if (d) destroy(d);
    st.kaizo = { sideb: false };
    st.currentAc = 6;
    st.turntimer = 999999;
    st.soul.mask = HEART_RECT;
    const mg = launchUnderbox(st);
    for (let f = 0; f < 520; f += 1) {
      stepFrame(st, {});
      if (fullWd === null && mg.alarm[2] >= 0) {
        fullWd = f;
        fullA2 = mg.alarm[2];
        assertEq(mg.image_alpha, 0, 'full arm: alpha still 0 at wind-down (its restore is 20 frames out)');
      }
    }
  }
  assert(!full.mg.alive, 'full arm still tears down (control)');
  assertEq(fullA2, 39, 'full arm: alarm[2] = 40 (observed post-step as 39)');

  const shortEnd = runChained('short end');
  assertEq(shortEnd.alarm2, 31, 'short end: alarm[2] = 32 (observed post-step as 31)');
  assertEq(fullA2 - shortEnd.alarm2, 8, 'the chained tail is EXACTLY 8 frames shorter than the standalone one');
  assertEq(shortEnd.dead, shortEnd.windDown + shortEnd.alarm2, 'short end: destroyed alarm[2] frames after the wind-down');
  assertEq(shortEnd.alpha, 1, 'short end: image_alpha restored IMMEDIATELY (no 20-frame delay)');
  assert(shortEnd.index > 5 && shortEnd.index < 8,
    `short end: image_index lerping 5 -> 8 from the wind-down frame (got ${shortEnd.index})`);
  assertEq(shortEnd.state.turntimer, -1, 'short end: alarm 2 still releases the turn clock');

  const end = runChained('end');
  assertEq(end.alarm2, 31, 'end: alarm[2] = 32 as well');
  assertEq(end.alpha, 1, 'end: shares short end\'s immediate image restore');
  assertEq(end.state.turntimer, -1, 'end: releases the turn clock');

  // The MID-CHAIN arms: same 32, but NO image restore — those segments stay
  // invisible because another one is about to take over.
  const shortMid = runChained('short mid');
  assertEq(shortMid.alarm2, 31, 'short mid: alarm[2] = 32');
  assertEq(shortMid.alpha, 0, 'short mid: no image restore (a successor is coming)');
  // The scene's own driver walks the pinned clock down a little, so this is
  // "still pinned", not "still exactly 999999" — the point is that it was
  // never slammed to -1 the way the Destroy gate does for the other arms.
  assert(shortMid.state.turntimer > 900000,
    `short mid: alarm 2 does NOT release the clock — the Destroy gate excludes it (got ${shortMid.state.turntimer})`);

  // The next_up switch. INERT in both of the mod's dispatched orders (neither
  // 4-2-3 nor 1-2-5 puts the manager anywhere but last), so it is asserted
  // here and nowhere else — a branch a fight-level check cannot reach.
  //
  // MEASURED ON THE TAIL, not on alarm[2]. The engine decrements an alarm and
  // fires it in the same frame it reaches 0, so an alarm[2] of 1 is already
  // spent by the time a post-step read could see it and the manager is gone
  // on the wind-down frame itself — `alarm2` reads null for exactly the two
  // rows that assign 1. The tail (destroy frame minus wind-down frame) is the
  // same quantity and is observable for all five, and it is assigned-minus-one
  // in every case because of that same first decrement. All five share a
  // wind-down frame: `next_up` touches nothing before it and the stream is the
  // same seed.
  const tail = (r) => r.dead - shortMid.windDown;
  assertEq(tail(runChained('short mid', { nextUp: 1 })), 0, 'next_up 1 -> alarm[2] = 1');
  assertEq(tail(runChained('short mid', { nextUp: 2 })), 11, 'next_up 2 -> alarm[2] = 12');
  assertEq(tail(runChained('short mid', { nextUp: 3 })), 17, 'next_up 3 -> alarm[2] = 18');
  assertEq(tail(runChained('short mid', { nextUp: 4 })), 0, 'next_up 4 -> alarm[2] = 1');
  assertEq(tail(shortMid), 31, 'next_up -999 (no successor) keeps the 32 tail');
  assertEq(runChained('short end', { nextUp: 2 }).alarm2, 31,
    'the switch is gated on turn_type: a "short end" with next_up 2 keeps 32');
}

// direct-module guard: the launcher swaps import sources on the SAME symbol
assertEq(typeof weirdBottomManager.init, 'function', 'weirdBottomManager exports the Other_10 init');

console.log(
  failures === 0
    ? `\nOK — ${checks} assertions, all green`
    : `\n${failures} of ${checks} assertions FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
