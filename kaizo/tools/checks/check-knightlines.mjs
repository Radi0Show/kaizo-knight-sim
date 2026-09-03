#!/usr/bin/env node
// POSITIVE assertions on kaizo/attacks/knightlines.js — the V-C PierceBlades
// carousel (mod ac 110, dc type 101) and the kaizo vanilla-mode deltas
// (boxpush, no-slide launch, damage re-pins). Every assertion here is on
// something the kaizo BRANCHES change: delete a branch and its assertion
// fails (the vanilla sim module in this launch position fails the no-slide
// and carousel assertions outright).
//
//     node kaizo/tools/checks/check-knightlines.mjs      exit 0 = pass
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — research only, do not
// publish without permission.
//
// Section G is the one that pays for the module's kaizo-local
// `kaizoIrandomRange`: it first proves the sim's own gmlIrandomRange THROWS
// on this arena's genuinely fractional bounds (so the helper is load-bearing,
// not decoration), then pins the helper's two properties that do not depend
// on the unverified rounding model — the two-draw stream cost, and exact
// agreement with gmlIrandomRange whenever the bounds are integers.

import { createState, stepFrame, spawn } from '../../../sim/index.js';
import { soul } from '../../../sim/soul.js';
import { gmlLte } from '../../../sim/gml.js';
import { battlebox } from '../../../sim/battlebox.js';
import { gmlCreate, gmlIrandomRange } from '../../../sim/rng.js';
import { scrDamage } from '../../../sim/damage.js';
import {
  launchKnightlines, carouselSword, kaizoIrandomRange,
} from '../../attacks/knightlines.js';
// The SHARED palette (kaizo/attacks/kaizo-colors.js) — the carousel telegraph
// is asserted against it below, so a private copy anywhere would fail here.
import { getSwordcolor } from '../../attacks/kaizo-colors.js';

let failures = 0;
let checks = 0;
function assert(cond, label) {
  checks += 1;
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`);
  }
}

/**
 * The mod's ac-110 board (Other_23 arena arm, mirrored by the central
 * launcher's openVCArena): 1.5 x 2.5 at x-110, grown in from zero — the
 * grow flow matters because the kaizo type-101 branch's image_xscale = 2.5
 * write lands mid-grow and must be stomped, as in the game. It is ALSO what
 * makes the arena's y bounds fractional: obj_growtangle quantises a non-2
 * scale to 1/37.5 steps, so 2.5 becomes 94/37.5 and gt_maxy() is 263.99999...
 *
 * `state.gmlRng = gmlCreate(seed)` is not optional: createState leaves the
 * GameMaker stream on seed 0 and every scene re-seeds it (sim/scenes/*.js).
 */
function buildCarouselScene({ seed = 12345, sideb = false, soulX = 230, soulY = 170 } = {}) {
  const state = createState({ seed });
  state.gmlRng = gmlCreate(seed);
  state.kaizo = { sideb };
  state.currentAc = 110; // Other_23 sets myattackchoice before the spawner call
  state.invc = 0.4; // the ac-110 arm's global.invc
  state.turntimer = 240; // a positive clock for Other_21's 999 pin to grab
  state.invTimer = -1;
  const gt = spawn(state, battlebox, { x: 210, y: 170 }); // 320 - 110
  gt.maxxscale = 1.5;
  gt.maxyscale = 2.5;
  state.soul = spawn(state, soul, { x: soulX, y: soulY });
  const before = gt.x;
  const slasher = launchKnightlines(state, 425, 78, { damage: 103 });
  return { state, gt, slasher, gtxAtLaunch: before };
}

function swords(state) {
  return state.entities.filter((s) => s.alive && s.type === carouselSword);
}

/** gt_minx() + 16 — the wall line the sweep rakes to. */
function wallLine(gt) {
  return gt.x - (75 * gt.image_xscale) / 2 + 16;
}

/**
 * The volley cadence Other_21 lines 91-94 produce, derived from the GML's own
 * constants rather than from the module: the window is `timer >= 15` and each
 * volley reseeds `timer = floor(atk_min)` from the value atk_min held BEFORE
 * scr_approach bumps it, so gap_k = 15 - floor(start + 0.25 * (k - 1)).
 */
function expectedVolleyGaps(start, count) {
  const gaps = [];
  for (let k = 1; k <= count; k++) gaps.push(15 - Math.floor(start + 0.25 * (k - 1)));
  return gaps;
}

// ───────────────────────────── A: carousel, side A, soul in the lanes ─────
console.log('A. PierceBlades side A — carousel, swept hitscan, deferred 210');
{
  const { state, gt, slasher, gtxAtLaunch } = buildCarouselScene({});
  assert(slasher.attack_type === 1, 'ac 110 launch arms attack_type 1');
  assert(gt.x === gtxAtLaunch, 'kaizo type-101 branch does NOT slide the box (vanilla -70 removed)');
  assert(slasher.damage === 103, 'scr_bullet_inherit damage 103 sticks in mode 1 (no 206 re-pin)');

  // STAND THE SOUL IN THE PATH OF A SWEEP THIS SCENE ACTUALLY MAKES, rather
  // than on a fixed y that one seed once happened to rake. The assertions
  // below are about what a rake does to a soul in its way; WHICH row that is
  // is not their subject. When kaizoIrandomRange started ROUNDING its bounds
  // (one more pixel of lane at the bottom of the box -- see its doc block)
  // every lane in this scene moved and y=170 stopped being one of them, so
  // six checks went red without a single thing they assert having changed.
  // A check a measurement can break by moving something it does not test is
  // testing the wrong thing.
  //
  // The soul is parked once, on the first sword to LAND on its lane, at the
  // MIDPOINT of that sword's rake -- which is the part that took a second
  // try: a sword's targY is where the rake ENDS, not the height it flies at.
  // It enters the lane from its fling height and slides down the slashdir
  // line, so parking the soul at targY leaves it a whisker above the blade
  // for the whole crossing. The midpoint of (landing -> lane end) is both in
  // the path and far from either end, which is what the >60px clearance
  // assertions want. Nothing in the rake reads the soul's position to draw
  // with, so the stream is untouched.
  let soulCx = state.soul.x + 9.5; // soul sprite is 20x20, origin (0,0)
  let soulParked = false;
  let latchFrame = -1;
  let latchPre = null;
  let latchPost = null;
  let hpOnLatchFrame = 0;
  let hpBeforeLatch = 0;
  let deferredDrop = 0;
  let deferredVictims = 0;
  let pinnedFrames = 0;
  let carouselFrames = 0;
  const hpSum = () => state.partyHp[0] + state.partyHp[1] + state.partyHp[2];

  for (let f = 0; f < 700; f++) {
    const hpBefore = hpSum();
    const partyBefore = [...state.partyHp];
    const pre = new Map(swords(state).map((s) => [s.seq, { x: s.x, y: s.y, flag: s.flag }]));
    stepFrame(state, {});

    if (!soulParked) {
      const landed = swords(state).find((s) => s.flag === 'C' && s.targY !== undefined);
      if (landed) {
        const ex = wallLine(gt); // where the rake ends: gt_minx + 16
        state.soul.x = (landed.x + ex) / 2 - 9.5;
        state.soul.y = (landed.y + landed.targY) / 2 - 9.5;
        soulCx = state.soul.x + 9.5;
        soulParked = true;
      }
    }

    if (slasher.attack_con >= 1 && slasher.attack_con < 4) {
      carouselFrames += 1;
      // Other_21 pins the clock to 999 every frame; embedded-sword graze
      // trickle may shave fractions off between pins.
      if (state.turntimer > 990 && state.turntimer <= 999) pinnedFrames += 1;
    }

    if (latchFrame < 0) {
      // The frame a sword's telegraph completes: it rakes and LATCHES the hit.
      const raked = swords(state).find(
        (s) => s.flag === 'D' && s.donehit === 1 && pre.get(s.seq)?.flag === 'C',
      );
      if (raked) {
        latchFrame = f;
        latchPre = pre.get(raked.seq);
        latchPost = { x: raked.x, y: raked.y, targY: raked.targY };
        hpBeforeLatch = hpBefore;
        hpOnLatchFrame = hpSum();
      }
    } else if (f === latchFrame + 1) {
      deferredDrop = hpBefore - hpSum();
      deferredVictims = state.partyHp.filter((h, i) => h < partyBefore[i]).length;
    }
    if (slasher.attack_con === 4 && f > 400) break;
  }

  const all = swords(state);
  assert(all.length === 18, `side A spawns 18 swords (got ${all.length})`);
  assert(all.every((s) => s.damage === 210), 'every carousel sword carries damage 210');
  assert(all.every((s) => s.grazepoints === 0 && s.grazed === 1),
    'every sword ends swept: grazepoints zeroed, grazed latched');
  assert(all.every((s) => s.flag === 'D'), 'every sword ends embedded (flag D)');
  assert(all.every((s) => Math.abs(s.image_yscale - 1.25) < 1e-6),
    'image_yscale restored to yscale (1.25) after the sweep');
  // The stride loop's last step lands the sword ON the wall line — either
  // through the `_spd < 1` snap or through `min(_stepspd, _dist)` taking the
  // exact remainder. Tolerance is f32 store noise only (measured max 2.4e-4);
  // an endpoint-only or truncated implementation leaves a stub of up to
  // 7.5px, three orders of magnitude outside this.
  const minX = wallLine(gt);
  assert(all.every((s) => Math.abs(s.x - minX) < 2e-3 && Math.abs(s.y - s.targY) < 2e-3),
    'every sword lands ON (gt_minx + 16, targY) to f32 precision — no stride stub');
  assert(new Set(all.map((s) => s.targY)).size >= 12,
    `the 18 lanes are distinct random rows (${new Set(all.map((s) => s.targY)).size} unique)`);

  // ── the sweep is a SWEPT hitscan, not an endpoint test ──────────────────
  // The sword's mask is spr_roaringknight_sword_ol, 75x31 at image_xscale
  // 1.25: its maximum half-extent at ANY rotation is
  // sqrt(75^2 + 31^2) / 2 * 1.25 = 50.7px. So a horizontal clearance above
  // 60px between the soul's centre and the sword proves no overlap without
  // depending on mask detail. If BOTH endpoints are that clear and donehit
  // still latched, only the per-stride probe can have produced the hit.
  assert(latchFrame >= 0, 'a sweep crossed the soul (donehit latched)');
  assert(latchPre && Math.abs(latchPre.x - soulCx) > 60,
    `sword was clear of the soul BEFORE the sweep (${latchPre ? Math.abs(latchPre.x - soulCx).toFixed(1) : 'n/a'}px)`);
  assert(latchPost && Math.abs(latchPost.x - soulCx) > 60,
    `sword is clear of the soul AFTER the sweep (${latchPost ? Math.abs(latchPost.x - soulCx).toFixed(1) : 'n/a'}px)`);
  assert(latchPre && latchPost && Math.abs(latchPre.x - latchPost.x) > 150,
    'the whole rake happened inside ONE frame (>150px traversed)');

  // ── the hit is paid the FRAME AFTER, by flag D's scr_damage ─────────────
  assert(hpBeforeLatch === hpOnLatchFrame,
    'the sweep frame itself deals no HP damage (flag-D defers one frame)');
  assert(deferredVictims === 1,
    `scr_damage (single target), not scr_damage_all (${deferredVictims} victims)`);
  // 210 is the carousel's own damage — not the mod's 206 spear re-pin and not
  // the dispatch's inherited 103. Reference the real damage pipeline so the
  // number cannot drift silently.
  const ref = (dmg) => {
    const t = createState({ seed: 1 });
    t.invTimer = -1;
    const b = t.partyHp[0];
    scrDamage(t, dmg, 0, {});
    return b - t.partyHp[0];
  };
  const ref210 = ref(210);
  const ref206 = ref(206);
  assert(ref210 !== ref206, `210 and 206 are distinguishable at the HP level (${ref210} vs ${ref206})`);
  assert(deferredDrop === ref210,
    `the deferred hit is a damage-210 scr_damage (dropped ${deferredDrop}, expected ${ref210})`);

  assert(pinnedFrames > carouselFrames * 0.9,
    `turntimer pinned at 999 through the attack (${pinnedFrames}/${carouselFrames})`);
  assert(slasher.attack_con === 4 && state.turntimer === 0,
    'end state released the turn (attack_con 4, turntimer 0)');
  assert(state.tension > 0 && state.tension % 12.5 === 0,
    `sweep grazes pay the sword's 12.5 grazepoints (got ${state.tension})`);
  assert(gt.image_xscale < 1.6,
    'the launch\'s image_xscale=2.5 write was stomped by the grow-in (as in the game)');
}

// ───────────────────────────── B: side B differs ──────────────────────────
console.log('B. PierceBlades side B — 34 swords, double flings');
{
  const { state, slasher } = buildCarouselScene({ sideb: true });
  let maxFlingDelta = 0;
  let prevFlung = 0;
  for (let f = 0; f < 900; f++) {
    stepFrame(state, {});
    const flung = swords(state).filter((s) => s.flag !== 'A').length;
    if (flung - prevFlung > maxFlingDelta) maxFlingDelta = flung - prevFlung;
    prevFlung = flung;
    if (slasher.attack_con === 4 && f > 500) break;
  }
  const all = swords(state);
  assert(all.length === 34, `side B spawns 34 swords (got ${all.length})`);
  assert(maxFlingDelta === 2, `side B flings TWO swords per volley (max delta ${maxFlingDelta})`);
  assert(slasher.attack_con === 4, 'side B run completes');
  assert(all.every((s) => s.flag === 'D'), 'all 34 embedded');
}

// ─────────────── C: telegraph cadence — 13 vs 15 approach steps ───────────
console.log('C. Telegraph cadence — blend_con 1/13 (A) vs 1/15 (B)');
{
  function firstSweepDelay(sideb) {
    const { state } = buildCarouselScene({ sideb, soulX: 430, soulY: 350 });
    const cSeen = new Map(); // sword seq -> frame first seen at flag C
    for (let f = 0; f < 900; f++) {
      stepFrame(state, {});
      for (const s of swords(state)) {
        if (s.flag === 'C' && !cSeen.has(s.seq)) cSeen.set(s.seq, f);
        if (s.flag === 'D' && cSeen.has(s.seq) && cSeen.get(s.seq) >= 0) {
          return f - cSeen.get(s.seq);
        }
      }
    }
    return -1;
  }
  const a = firstSweepDelay(false);
  const b = firstSweepDelay(true);
  assert(a > 0 && b > 0, `both sides sweep (A ${a}, B ${b})`);
  assert(b - a === 2, `B-side telegraph is exactly 2 frames longer (A ${a}, B ${b})`);
}

// ───────────── D: the shared-stream draws, counted branch by branch ───────
console.log('D. RNG stream — jitter per orbiting sword, Draw pair per frame');
{
  // Soul parked far below-right: no hits, no grazes, no knightTarget draws —
  // the stream moves ONLY by the carousel's own consumption.
  const { state, slasher } = buildCarouselScene({ soulX: 430, soulY: 350 });
  let spawnFrameChecked = false;
  let orbitFrameChecked = false;
  let tailFrames = 0;
  let tailDrawsOk = 0;
  for (let f = 0; f < 700; f++) {
    const drawsBefore = state.gmlRng.draws ?? 0;
    const swordsBefore = swords(state).length;
    stepFrame(state, {});
    const delta = (state.gmlRng.draws ?? 0) - drawsBefore;
    const now = swords(state);
    const spawned = now.length - swordsBefore;
    if (slasher.attack_con === 1 && spawned === 1 && !spawnFrameChecked) {
      // Spawn frame: every orbiting sword jitters (1 draw each, newborn
      // included) + the newborn's 4 afterimage draws. No Draw pair (con 1).
      spawnFrameChecked = true;
      assert(delta === now.length + 4,
        `spawn frame consumes swords+4 draws (${delta} for ${now.length} swords)`);
    } else if (slasher.attack_con === 1 && spawned === 0 && now.length > 0
      && now.every((s) => s.flag === 'A') && !orbitFrameChecked) {
      // Quiet orbit frame: exactly one jitter draw per sword.
      orbitFrameChecked = true;
      assert(delta === now.length,
        `orbit frame consumes one draw per sword (${delta} for ${now.length})`);
    } else if (slasher.attack_con >= 3
      && now.every((s) => s.flag === 'D') && slasher.at_swords.length === 0) {
      // Nothing left but embedded swords: the ONLY stream consumer is
      // Draw_0's two shake rolls (consumed in endStep). This is the
      // assertion that dies if the Draw-RNG branch is deleted.
      tailFrames += 1;
      if (delta === 2) tailDrawsOk += 1;
    }
    if (slasher.attack_con === 4 && tailFrames >= 8) break;
  }
  assert(spawnFrameChecked && orbitFrameChecked, 'both con-1 draw shapes observed');
  assert(tailFrames >= 5 && tailDrawsOk === tailFrames,
    `Draw pair: exactly 2 draws/frame with the field frozen (${tailDrawsOk}/${tailFrames})`);
}

// ───────────── E: vanilla mode (mod ac 6) — boxpush + re-pins ─────────────
console.log('E. Vanilla mode under the mod — no slide, staged 93px push, 206 re-pins');
{
  const state = createState({ seed: 12345 });
  state.gmlRng = gmlCreate(12345);
  state.kaizo = { sideb: false };
  state.currentAc = 6; // the mod's dormant vanilla-mode launch (dc.damage 103)
  state.invc = 1;
  state.turntimer = 240;
  state.invTimer = -1;
  const gt = spawn(state, battlebox, { x: 320, y: 170 }); // ac-6 default board
  state.soul = spawn(state, soul, { x: 314, y: 162 });
  const gtxBefore = gt.x;
  const slasher = launchKnightlines(state, 425, 78, { damage: 103 });
  assert(slasher.attack_type === 0, 'ac 6 stays in vanilla mode');
  assert(gt.x === gtxBefore, 'no -70 slide at launch (kaizo dbulletcontroller delta)');

  stepFrame(state, {});
  assert(slasher.damage === 206, 'Step re-pins damage 206 over the inherited 103');

  // The staged schedule kaizo Step_0 lines 11-35 produce, derived here from
  // the GML's own constants: 5px while con < 33, 2px while con > 56, 3px
  // otherwise — and the `con > 89` flag-set does NOT exit, so the frame that
  // disarms still moves.
  const wantStages = [];
  {
    let con = 0;
    for (;;) {
      const last = con > 89;
      const inc = con < 33 ? 5 : (con > 56 ? 2 : 3);
      wantStages.push(inc);
      con += inc;
      if (last) break;
    }
  }

  const gotStages = [];
  let armFrame = -1;
  let spearSeen = false;
  let lockstepFrames = 0;
  let lockstepOk = 0;
  let cleanPush = 0; // box travel measured on frames with no slash jitter live
  for (let f = 1; f < 200; f++) {
    const conBefore = slasher.boxpushcon;
    const gtBefore = gt.x;
    const soulBefore = state.soul.x;
    // obj_roaringknight_slash jitters the box on its own (CLAUDE.md T4), so
    // only slash-free frames measure the push cleanly.
    const slashesBefore = state.entities.filter(
      (s) => s.alive && s.type.name === 'obj_roaringknight_slash',
    ).length;
    stepFrame(state, {});
    const slashesAfter = state.entities.filter(
      (s) => s.alive && s.type.name === 'obj_roaringknight_slash',
    ).length;
    if (armFrame < 0 && slasher.boxpushstart === 1) armFrame = f;
    if (state.entities.some((s) => s.alive && s.type.name === 'obj_bullet_knight_tunnelslash')) {
      spearSeen = true;
    }
    const dCon = slasher.boxpushcon - conBefore;
    if (dCon !== 0) {
      gotStages.push(dCon);
      if (slashesBefore === 0 && slashesAfter === 0) {
        lockstepFrames += 1;
        cleanPush += gtBefore - gt.x;
        if (gtBefore - gt.x === dCon && soulBefore - state.soul.x === dCon) lockstepOk += 1;
      }
    }
    if (slasher.boxpushstart === -1) break;
  }
  assert(armFrame > 0, 'boxpushstart armed at slash timer 24');
  assert(spearSeen, 'vanilla spear volley still fires (obj_bullet_knight_tunnelslash)');
  assert(wantStages.reduce((a, b) => a + b, 0) === 93,
    `the 5/3/2 staging sums to 93 by construction (got ${wantStages.reduce((a, b) => a + b, 0)})`);
  assert(gotStages.join(',') === wantStages.join(','),
    `boxpushcon walks the exact staged schedule, ${wantStages.length} frames of 5x7/3x8/2x17`);
  assert(slasher.boxpushstart === -1 && slasher.boxpushcon === 93,
    `staged push ends at boxpushcon 93 (got ${slasher.boxpushcon}, start ${slasher.boxpushstart})`);
  assert(lockstepFrames >= 20 && lockstepOk === lockstepFrames,
    `board AND soul move with boxpushcon, px for px (${lockstepOk}/${lockstepFrames} jitter-free frames)`);
  assert(cleanPush >= 55,
    `most of the ~93px shove is measured jitter-free (${cleanPush}px over ${lockstepFrames} frames)`);
}

// ───────────── F: determinism of the carousel's stream use ────────────────
console.log('F. Determinism — same seed identical, different seed different');
{
  function run(seed) {
    const { state, slasher } = buildCarouselScene({ seed, soulX: 430, soulY: 350 });
    for (let f = 0; f < 700; f++) {
      stepFrame(state, {});
      if (slasher.attack_con === 4 && swords(state).every((s) => s.flag === 'D')) break;
    }
    return swords(state).map((s) => `${s.x.toFixed(4)},${s.y.toFixed(4)}`).join('|');
  }
  const a1 = run(12345);
  const a2 = run(12345);
  const b = run(999);
  assert(a1 === a2 && a1.length > 0, 'same seed → byte-identical embed layout');
  assert(a1 !== b, 'different seed → different layout (the stream, not Math.random)');
}

// ───────── G: irandom_range with REAL bounds — the kaizo-local model ──────
console.log('G. Fractional irandom_range — the mod arena really does need it');
{
  // The mod's ac-110 board, exactly as section A builds it.
  const { state, gt } = buildCarouselScene({ soulX: 430, soulY: 350 });
  for (let f = 0; f < 30; f++) stepFrame(state, {}); // let the box finish growing in
  const miny = gt.y - (75 * gt.image_yscale) / 2;
  const maxy = gt.y + (75 * gt.image_yscale) / 2;
  const lo = miny + 10;
  const hi = maxy - 10;
  assert(!Number.isInteger(lo) && !Number.isInteger(hi),
    `the quantised 2.5 arena gives FRACTIONAL bounds (${lo}, ${hi})`);

  // The sim's own helper cannot take them — this is why the module carries a
  // local one instead of reaching into sim/ (the isolation contract).
  let threw = false;
  try {
    gmlIrandomRange(gmlCreate(7), lo, hi);
  } catch (err) {
    threw = err instanceof RangeError;
  }
  assert(threw, 'sim/rng.js gmlIrandomRange throws on these bounds (the crash the helper fixes)');

  // Two properties that hold whatever the rounding model turns out to be.
  // 1. The stream cost is exactly two u32 draws — the load-bearing property.
  const r = gmlCreate(4242);
  const before = r.draws ?? 0;
  const lane = kaizoIrandomRange(r, lo, hi);
  assert((r.draws ?? 0) - before === 2,
    `real bounds still cost exactly 2 draws (${(r.draws ?? 0) - before})`);
  assert(Number.isInteger(lane) && lane >= Math.floor(lo) && lane <= Math.floor(hi),
    `real bounds return an integer lane inside [${Math.floor(lo)}, ${Math.floor(hi)}] (got ${lane})`);

  // 2. With integer bounds it is bit-identical to the oracle-validated helper,
  //    value and stream position — so it is a superset, not a divergence.
  let sameValue = 0;
  let sameDraws = 0;
  for (let s = 1; s <= 40; s++) {
    const ra = gmlCreate(s);
    const rb = gmlCreate(s);
    const va = kaizoIrandomRange(ra, 86, 253);
    const vb = gmlIrandomRange(rb, 86, 253);
    if (va === vb) sameValue += 1;
    if ((ra.draws ?? 0) === (rb.draws ?? 0)) sameDraws += 1;
  }
  assert(sameValue === 40 && sameDraws === 40,
    `integer bounds: identical to gmlIrandomRange over 40 seeds (${sameValue}/${sameDraws})`);

  // 3. In the attack: every lane the carousel picks is an integer row inside
  //    the floored bounds. This is the branch's observable output.
  const { state: st2, gt: gt2, slasher } = buildCarouselScene({ soulX: 430, soulY: 350 });
  for (let f = 0; f < 700; f++) {
    stepFrame(st2, {});
    if (slasher.attack_con === 4 && swords(st2).every((s) => s.flag === 'D')) break;
  }
  const lo2 = Math.floor(gt2.y - (75 * gt2.image_yscale) / 2 + 10);
  const hi2 = Math.floor(gt2.y + (75 * gt2.image_yscale) / 2 - 10);
  const lanes = swords(st2).map((s) => s.targY);
  assert(lanes.length === 18 && lanes.every(
    (v) => Number.isInteger(v) && v >= lo2 && v <= hi2,
  ), `all 18 lanes are integer rows in [${lo2}, ${hi2}]`);
}

// ───────── H: the accelerating fling cadence ──────────────────────────────
console.log('H. Accelerating flings — atk_min 1 (A) / -3 (B), +0.25 a volley');
{
  function volleyFrames(sideb) {
    const { state, slasher } = buildCarouselScene({ sideb, soulX: 430, soulY: 350 });
    const frames = [];
    for (let f = 0; f < 900; f++) {
      const pre = new Map(swords(state).map((s) => [s.seq, s.flag]));
      stepFrame(state, {});
      const flungNow = swords(state).some((s) => s.flag === 'B' && pre.get(s.seq) === 'A');
      if (flungNow) frames.push(f);
      if (slasher.attack_con === 4 && f > 400) break;
    }
    return frames;
  }
  const fa = volleyFrames(false);
  const gapsA = fa.slice(1).map((v, i) => v - fa[i]);
  assert(fa.length === 18, `side A: 18 volleys, one sword each (got ${fa.length})`);
  assert(gapsA.join(',') === expectedVolleyGaps(1, gapsA.length).join(','),
    `side A cadence accelerates 14→10 exactly as floor(atk_min) dictates (${gapsA.join(',')})`);
  assert(gapsA[0] > gapsA[gapsA.length - 1],
    'the volleys really do speed up (first gap > last gap)');

  const fb = volleyFrames(true);
  const gapsB = fb.slice(1).map((v, i) => v - fb[i]);
  assert(fb.length === 17, `side B: 17 volleys of TWO swords (got ${fb.length})`);
  assert(gapsB.join(',') === expectedVolleyGaps(-3, gapsB.length).join(','),
    `side B starts slower (atk_min -3) and accelerates 18→14 (${gapsB.join(',')})`);
  assert(gapsB[0] === 18 && gapsA[0] === 14,
    'B-Side opens on an 18-frame window against A-Side\'s 14');
}

// ─────────────── THE BLUE RE-THEME (Other_21 l.62/167/184/272/277) ────────
//
// The carousel's tints are instance state, and blend_con — the counter that
// decides when a lane rakes — is the same clock that drives the colour. Each
// assertion below fails if its merge is deleted; the last one is the control
// that separates the mod's blue from anything achromatic.
console.log('H. The blue re-theme — carousel tints');
{
  const eqRgb = (a, b) => Array.isArray(a) && Array.isArray(b)
    && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  const { state } = buildCarouselScene({ soulX: 430, soulY: 350 });

  let orbitBright = false; // flag A near the c_white end of the depth merge
  let orbitDark = false; //   flag A near the c_dkgray end
  let sawGreyOrbit = false;
  let sawRedDominant = false;
  let sawTelegraphBlue = false;
  let sawMidRamp = false;
  const seen = new Set();
  let taggedGhosts = 0;
  let retintedGhosts = 0;

  for (let f = 0; f < 900; f++) {
    stepFrame(state, {});
    for (const s of swords(state)) {
      seen.add(s.seq);
      const b = s.image_blend;
      if (!Array.isArray(b)) continue;
      if (b[0] > b[2]) sawRedDominant = true;
      // flag A: merge(c_white, c_dkgray, ...) is ACHROMATIC by construction.
      if (s.flag === 'A' && b[0] === b[1] && b[1] === b[2] && b[0] >= 64 && b[0] <= 255) {
        sawGreyOrbit = true;
        if (b[0] > 230) orbitBright = true;
        if (b[0] < 100) orbitDark = true;
      }
      // flag C, blend_con complete: exactly get_swordcolor().
      // `gmlLte(1, x)` is `x >= 1` with GML's epsilon — THE SAME COMPARISON
      // THE ATTACK ITSELF NOW MAKES. This observer used to read `>= 1`
      // bit-exactly and so it stopped seeing the completed telegraph the
      // moment the attack was corrected to stop waiting for a literal 1
      // (thirteen adds of 1/13 land on 0.9999999999999998; see the rake).
      // Nothing about the colour changed: merge_color rounds to bytes, so at
      // that blend_con the sword is already exactly get_swordcolor(). A check
      // that watches for a state has to recognise the state the same way the
      // code does, or it reports the fix as the regression.
      const done = gmlLte(1, s.blend_con);
      if (s.flag === 'C' && done && eqRgb(b, getSwordcolor(state))) {
        sawTelegraphBlue = true;
      }
      if (s.flag === 'C' && s.blend_con > 0 && !done
        && b[2] === 255 && b[0] > 0 && b[0] < 255) {
        sawMidRamp = true;
      }
    }
    for (const a of state.entities) {
      if (!a.alive || a.type.name !== 'obj_afterimage') continue;
      const b = a.image_blend;
      if (eqRgb(b, [2, 0, 0])) taggedGhosts += 1;
      else if (Array.isArray(b) && b[2] > b[0] && b[2] === 255) retintedGhosts += 1;
    }
  }

  // NOTE on l.62's `image_blend = c_black`: it is never observable at a frame
  // boundary, and that is faithful — Other_21 spawns the sword and then, in
  // the SAME event, runs its `with (obj_regularbullet)` pass, which repaints
  // every flag-A sword. The value exists for exactly the span between two
  // statements. The flag-A merge below is what the black is the seed for.
  assert(sawGreyOrbit,
    'orbiting swords take the achromatic brightness-by-depth merge (l.167)');
  assert(orbitBright && orbitDark,
    'and it SWEEPS c_white <-> c_dkgray with the orbit, not a fixed grey');
  assert(sawMidRamp,
    'the flag-C telegraph is a RAMP toward blue, not a swap (l.277)');
  assert(sawTelegraphBlue,
    'and completes on exactly get_swordcolor() — the mod\'s blue (l.130 + l.277)');
  assert(!sawRedDominant,
    'no carousel sword is ever red-dominant (the recolour is blue, end to end)');
  // The #020000 TAG is likewise sub-frame — the whole rake (spawn ghosts,
  // sweep, untag) runs inside one Other_21 call — so what is observable is
  // the RESULT: every stride ghost left behind carries the sword's telegraph
  // blue rather than the tag or an engine default.
  assert(taggedGhosts === 0,
    'no ghost is left holding the #020000 tag — the untag pass ran (l.270-273)');
  assert(retintedGhosts > 0,
    'and the stride ghosts are retinted to the sword\'s blue after the rake (l.272)');
  assert(getSwordcolor(state)[2] === 255 && getSwordcolor(state)[0] === 0,
    'get_swordcolor() decodes 16711680 as pure BLUE (BGR), not red');
}

console.log(`\n${checks - failures}/${checks} assertions passed`);
process.exit(failures ? 1 : 0);
