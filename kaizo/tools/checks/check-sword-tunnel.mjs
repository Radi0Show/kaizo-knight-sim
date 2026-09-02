#!/usr/bin/env node
// KAIZO V-C sword tunnel — positive assertions on every branch the mod ADDS to
// obj_sword_tunnel_manager / obj_sword_tunnel_sword / obj_knight_swordtunnelanim,
// against kaizo/attacks/sword-tunnel.js + sword-tunnel-anim.js (the kaizo copies
// of the verified sim modules).
//
//     node kaizo/tools/checks/check-sword-tunnel.mjs
//
// Every block asserts what its branch CHANGES against the base difficulty it
// replaces, so deleting any translated delta fails loudly rather than silently
// passing:
//
//   A  tier table (Other_10): NEW d4.1 / d10 / d11, vanilla d0/d3/d4 intact,
//      unknown tiers falling through to the defaults header
//   B  d4.1 is selected by gmlEq, not === (4.1 + 1e-6 still lands on it,
//      4.2 does not) — the fractional-difficulty law
//   C  B-Side tightens ONLY d4's gap, 40 -> 30
//   D  Create's attack-101 path: no wind-up anim, woosh -4, timer -1 — and
//      the SAME number of RNG draws as the normal path (the dead irandom
//      is kept)
//   E  d10: one-sided corridor, endless (finishtimer pinned to 0 AFTER the
//      increment), gap 220 shrinking 2 every 3 frames to a 36 floor,
//      maxswords 1500, corridor parked 50px below the box and not wandering
//   F  d11: the perpendicular spawn branch's rotated geometry, mydirection
//      +90, holyfuck marking
//   G  the finale's two waves: holyfuck swords get delay/delaystart 24 and
//      sweep exactly 24 frames after wave 0, telegraph included
//   H  the v091 COLLISION MODEL: a plain place_meeting sub-step sweep that
//      lands hits, and NO obj_sword_tunnel_hitbox / spr_dodgeheart_smallmask
//      anywhere — the v105 rework the sim module was verified against
//   I  the soul wears spr_dodgeheart_smaller_2px_mask every frame the manager
//      lives
//   J  a concurrent tracking-swords manager is muted 20 frames before the
//      finale and destroyed at it — and never muted at d10
//   K  the anim's vertical mode: hidden at timer 1, and the 12-particle
//      light-fairy burst consuming EXACTLY 72 extra draws at timer 20
//
// PUBLISH GATE: V-C recreation of EnderCat8's Kaizo Roaring Knight — do not
// publish without permission (kaizo/HANDOFF.md §5-C).

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn, destroy } from '../../../sim/entity.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { HEART_SMALL_MASK } from '../../../sim/masks.js';
import { trackingSwordsManager } from '../../../sim/attacks/tracking-swords.js';
import {
  launchSwordTunnel, swordTunnelManager, swordTunnelSword,
  getSwordcolor as tunnelGetSwordcolor,
  KAIZO_TELEGRAPH_COLOR as tunnelTelegraph,
} from '../../attacks/sword-tunnel.js';
// …and the same two names straight from the shared module, so section L can
// assert they are the SAME binding rather than two tables that agree today.
import {
  getSwordcolor as sharedGetSwordcolor,
  KAIZO_TELEGRAPH_COLOR as sharedTelegraph,
} from '../../attacks/kaizo-colors.js';
import { swordTunnelAnim } from '../../attacks/sword-tunnel-anim.js';
import { KAIZO_SMALLER_HEART_MASK } from '../../attacks/underbox.js';
import { kaizoMask } from '../../data/masks.js';
import { getSwordcolor, KAIZO_TELEGRAPH_COLOR } from '../../attacks/kaizo-colors.js';

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

/**
 * A fight-shaped scene (knight, party, board, soul) with the practice director
 * removed so nothing auto-launches, then the tunnel launched exactly the way
 * the V-C launcher's type-153 case must: `state.currentAc` set first (Create
 * reads it), then launchSwordTunnel, which assigns difficulty/damage and fires
 * Other_10 once.
 */
function scene(difficulty, { ac = 13, sideb = false, seed = 12345 } = {}) {
  const state = createState({ seed });
  buildSingleAttackScene(state, { seed, attack: 'tunnel', difficulty: 0 });
  const dir = state.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  state.kaizo = { sideb };
  state.currentAc = ac; // obj_knight_enemy.myattackchoice analog
  state.turntimer = 999999; // the tunnel arms' scr_turntimer, held open here
  const mg = launchSwordTunnel(state, { difficulty });
  return { state, mg };
}

const swords = (state) => state.entities.filter(
  (e) => e.alive && e.type.name === 'obj_sword_tunnel_sword',
);
const boxOf = (state) => state.entities.find(
  (e) => e.alive && e.type.name === 'obj_growtangle',
);

// ── A. the tier table (Other_10) ──────────────────────────────────────────────
console.log('A. Other_10 tier table');
{
  // Vanilla tiers, unchanged by the mod — the regression half.
  const d0 = scene(0).mg;
  assertEq(d0.rate, 4, 'd0 rate');
  assertEq(d0.gapsize, 45, 'd0 gapsize');
  assertEq(d0.verticalchange, 10, 'd0 verticalchange');
  assertEq(d0.tobymode, 0, 'd0 tobymode');

  const d3 = scene(3).mg;
  assertEq(d3.tobymode, 3, 'd3 tobymode (the sweeping corridor)');
  assertEq(d3.verticalchange, 7, 'd3 verticalchange');

  const d4 = scene(4).mg;
  assertEq(d4.rate, 4, 'd4 rate');
  assertEq(d4.gapsize, 40, 'd4 gapsize');
  assertEq(d4.verticalchange, 10, 'd4 verticalchange');
  assertEq(d4.maxswords, 999, 'd4 maxswords');

  // NEW d4.1 — every field differs from the d4 it is derived from except
  // tobymode/maxswords, so this cannot pass with the branch deleted.
  const d41 = scene(4.1).mg;
  assertEq(d41.rate, 3, 'd4.1 rate (d4 is 4)');
  assertEq(d41.gapsize, 64, 'd4.1 gapsize (d4 is 40)');
  assertEq(d41.verticalchange, 8, 'd4.1 verticalchange (d4 is 10)');
  assertEq(d41.tobymode, 0, 'd4.1 tobymode');
  assertEq(d41.maxswords, 999, 'd4.1 maxswords');
  assert(d41.rate !== d4.rate && d41.gapsize !== d4.gapsize, 'd4.1 is not d4');

  // NEW d10.
  const bY = boxOf(scene(10, { ac: 101 }).state).y;
  const d10 = scene(10, { ac: 101 }).mg;
  assertEq(d10.rate, 4, 'd10 rate');
  assertEq(d10.gapsize, 220, 'd10 gapsize');
  assertEq(d10.verticalchange, 0, 'd10 verticalchange (corridor does not wander)');
  assertEq(d10.maxswords, 1500, 'd10 maxswords (every other tier is 999)');
  assertEq(d10.tobymode, 0, 'd10 tobymode');
  assertEq(d10.tobytimer, 2, 'd10 tobytimer primed to 2');
  assertEq(d10.swordy, bY + 50, 'd10 swordy += 50 applied exactly once');

  // NEW d11.
  const d11 = scene(11).mg;
  assertEq(d11.rate, 3, 'd11 rate');
  assertEq(d11.gapsize, 92, 'd11 gapsize');
  assertEq(d11.verticalchange, 8, 'd11 verticalchange');
  assertEq(d11.maxswords, 999, 'd11 maxswords');
  assertEq(d11.shoutouttogreenknight, 1, 'd11 sets shoutouttogreenknight');
  assertEq(d0.shoutouttogreenknight, 0, 'd0 leaves shoutouttogreenknight 0');
  assert(d11.woosh && d11.woosh !== -4, 'd11 woosh holds the anim instance');
  assertEq(d11.woosh.vertical, true, 'd11 flips woosh.vertical through the handle');
  assertEq(scene(4).mg.woosh.vertical, false, 'd4 leaves woosh.vertical false');

  // An unasked-for tier falls through to the defaults header, untouched.
  const dX = scene(7).mg;
  assertEq(dX.rate, 6, 'unknown tier keeps the defaults rate 6');
  assertEq(dX.gapsize, 50, 'unknown tier keeps the defaults gapsize 50');
  assertEq(dX.verticalchange, 15, 'unknown tier keeps the defaults verticalchange 15');
}

// ── B. the fractional difficulty is compared with gmlEq ───────────────────────
console.log('B. d4.1 selected by gmlEq, not ===');
{
  // GML `==` on reals carries math_set_epsilon; a value a hair off 4.1 still
  // selects the tier. `===` here would drop it back to the defaults header.
  const near = scene(4.1 + 1e-6).mg;
  assertEq(near.rate, 3, '4.1 + 1e-6 still selects tier 4.1 (rate 3)');
  assertEq(near.gapsize, 64, '4.1 + 1e-6 still selects tier 4.1 (gap 64)');
  assert(4.1 + 1e-6 !== 4.1, 'the probe value really is not === 4.1');
  // ...and the tolerance does not swallow a genuinely different tier.
  const far = scene(4.2).mg;
  assertEq(far.rate, 6, '4.2 falls through to the defaults header');
}

// ── C. B-Side tightens d4's gap only ─────────────────────────────────────────
console.log('C. B-Side gapsize override');
{
  assertEq(scene(4, { sideb: false }).mg.gapsize, 40, 'd4 Normal gapsize 40');
  assertEq(scene(4, { sideb: true }).mg.gapsize, 30, 'd4 B-Side gapsize 30');
  // The override lives INSIDE the d4 block — no other tier moves.
  assertEq(scene(0, { sideb: true }).mg.gapsize, 45, 'd0 B-Side gapsize unchanged');
  assertEq(scene(4.1, { sideb: true }).mg.gapsize, 64, 'd4.1 B-Side gapsize unchanged');
  assertEq(scene(11, { sideb: true }).mg.gapsize, 92, 'd11 B-Side gapsize unchanged');
}

// ── D. Create's attack-101 path ──────────────────────────────────────────────
console.log('D. Create: myattackchoice 101 skips the wind-up');
{
  // Spawned bare (no launchSwordTunnel) so only Create's own draws are counted.
  function bareCreate(ac) {
    const state = createState({ seed: 12345 });
    buildSingleAttackScene(state, { seed: 12345, attack: 'tunnel', difficulty: 0 });
    const dir = state.entities.find((e) => e.alive && e.type.name === 'practice_director');
    if (dir) destroy(dir);
    state.kaizo = {};
    state.currentAc = ac;
    state.turntimer = 999999;
    const before = state.gmlRng.draws ?? 0;
    const mg = spawn(state, swordTunnelManager, { x: 300, y: state.view.y });
    return { state, mg, draws: (state.gmlRng.draws ?? 0) - before };
  }
  const normal = bareCreate(13);
  const a101 = bareCreate(101);

  assert(normal.mg.timer >= -40 && normal.mg.timer <= -30, 'normal timer = -40 + irandom(10)');
  assertEq(a101.mg.timer, -1, 'ac 101 forces timer = -1');
  assert(a101.mg.timer !== normal.mg.timer, 'ac 101 timer differs from the roll');

  assertEq(normal.mg.woosh.type.name, 'obj_knight_swordtunnelanim', 'normal path keeps the handle');
  assertEq(a101.mg.woosh, -4, 'ac 101 leaves woosh at the noone sentinel');
  assert(normal.state.entities.some((e) => e.alive && e.type.name === 'obj_knight_swordtunnelanim'),
    'normal path spawns the wind-up anim');
  assert(!a101.state.entities.some((e) => e.alive && e.type.name === 'obj_knight_swordtunnelanim'),
    'ac 101 spawns NO wind-up anim');

  // THE DEAD DRAW IS KEPT. Line 1's irandom(10) still executes on the 101 path
  // before being overwritten, so both paths leave the stream in the same place.
  assertEq(a101.draws, normal.draws, 'ac 101 consumes the same draws as the normal path');
  assertEq(normal.draws, 7, 'Create draws: irandom(10)=2 + 3 chooses + irandom(6)=2');
}

// ── E. d10 — one-sided, endless, shrinking ───────────────────────────────────
console.log('E. d10 one-sided shrinking corridor');
{
  const { state, mg } = scene(10, { ac: 101 });
  const startY = mg.swordy;
  const angles = new Set();
  const gapAt = [];
  let everCon = 0;
  let maxFinish = 0;
  for (let f = 0; f < 420; f++) {
    stepFrame(state, {});
    for (const s of swords(state)) angles.add(s.image_angle);
    gapAt.push(mg.alive ? mg.gapsize : null);
    if (mg.alive) {
      everCon = Math.max(everCon, mg.con);
      maxFinish = Math.max(maxFinish, mg.finishtimer);
    }
  }
  // ONE-SIDED: only the ceiling sword (image_angle 270) is ever created.
  assert(angles.has(270), 'd10 spawns the ceiling sword (angle 270)');
  assert(!angles.has(90), 'd10 spawns NO floor sword (angle 90)');
  assertEq(angles.size, 1, 'd10 spawns exactly one sword orientation');

  // ENDLESS: finishtimer is pinned to 0 AFTER the top-of-step increment, so it
  // is observably 0 (not 1) every frame and con never flips.
  assertEq(maxFinish, 0, 'd10 finishtimer pinned to 0 (pin runs after the ++)');
  assertEq(everCon, 0, 'd10 never reaches the finale');
  assert(mg.alive, 'd10 manager survives 420 frames (maxswords 1500)');

  // THE SHRINK: 2px every third frame, from 220, floored at exactly 36.
  assertEq(gapAt[0], 218, 'd10 first step shrinks 220 -> 218 (tobytimer primed at 2)');
  assertEq(gapAt[1], 218, 'd10 no shrink on the second step');
  assertEq(gapAt[2], 218, 'd10 no shrink on the third step');
  assertEq(gapAt[3], 216, 'd10 shrinks again on the fourth step');
  assert(gapAt.every((g) => g === null || g >= 36), 'd10 gapsize never goes under 36');
  assertEq(gapAt[gapAt.length - 1], 36, 'd10 gapsize settles at exactly 36');
  const floorIdx = gapAt.indexOf(36);
  assert(floorIdx > 250 && floorIdx < 300, `d10 reaches the floor around f276 (got ${floorIdx})`);

  // PARKED: verticalchange 0, so the corridor holds its 50px offset.
  assertEq(mg.swordy, startY, 'd10 corridor does not wander (verticalchange 0)');

  // CONTRAST: d4 does all four of those things differently.
  const base = scene(4);
  for (let f = 0; f < 260; f++) stepFrame(base.state, {});
  assertEq(base.mg.con, 1, 'd4 DOES reach the finale (the contrast)');
  assert(base.mg.gapsize === 40, 'd4 gapsize does not shrink');
}

// ── F. d11 — the perpendicular spawn branch ──────────────────────────────────
console.log('F. d11 perpendicular cross tunnel');
{
  const { state, mg } = scene(11);
  const gt = boxOf(state);
  let seen = null;
  for (let f = 0; f < 60 && !seen; f++) {
    // Capture the manager's corridor state BEFORE the step that spawns, so the
    // rotation can be checked against the inputs the GML actually used.
    const pre = { swordx: mg.swordx, swordy: mg.swordy, gap: mg.gapsize };
    stepFrame(state, {});
    const sw = swords(state);
    if (sw.length >= 2) seen = { pre, sw };
  }
  assert(seen, 'd11 spawns swords');
  if (seen) {
    const { pre, sw } = seen;
    const sx = gt.x + (pre.swordy - gt.y);
    const sy = gt.y - (pre.swordx - gt.x);
    const left = sw.find((s) => s.image_angle === 0);
    const right = sw.find((s) => s.image_angle === 180);
    assert(left, 'd11 makes a LEFT sword at image_angle 0');
    assert(right, 'd11 makes a RIGHT sword at image_angle 180');
    assert(!sw.some((s) => s.image_angle === 270 || s.image_angle === 90),
      'd11 makes NO horizontal-corridor swords');
    if (left && right) {
      // Rotated 90 degrees about the growtangle: the pair straddles the box in
      // X and enters from far above.
      assertEq(left.xstart ?? left.x, sx - 50 - pre.gap / 2, 'd11 left sword x');
      assertEq(right.xstart ?? right.x, sx + 50 + pre.gap / 2, 'd11 right sword x');
      assertEq(left.ystart ?? left.y, sy, 'd11 left sword y (rotated)');
      assert(sy < gt.y - 200, 'd11 swords enter from far above the box');
      // `sword.mydirection += 90` on top of the Create's 180.
      assertEq(left.mydirection, 270, 'd11 left sword mydirection 180 + 90');
      assertEq(right.mydirection, 270, 'd11 right sword mydirection 180 + 90');
      assertEq(left.holyfuck, 1, 'd11 left sword marked holyfuck');
      assertEq(right.holyfuck, 1, 'd11 right sword marked holyfuck');
      const y0 = left.y;
      stepFrame(state, {});
      assert(left.y > y0, 'd11 swords travel DOWNWARD');
    }
  }
  // CONTRAST: the horizontal half of the same attack (d4.1) does none of it.
  const flat = scene(4.1);
  for (let f = 0; f < 60; f++) stepFrame(flat.state, {});
  const fsw = swords(flat.state);
  assert(fsw.length > 0, 'd4.1 spawns swords');
  assert(fsw.every((s) => s.mydirection === 180), 'd4.1 swords keep mydirection 180');
  assert(fsw.every((s) => s.holyfuck === undefined), 'd4.1 swords are not holyfuck');
  assert(fsw.some((s) => s.image_angle === 270) && fsw.some((s) => s.image_angle === 90),
    'd4.1 keeps the two-sided horizontal corridor');
}

// ── G. the finale's two waves ────────────────────────────────────────────────
console.log('G. finale stagger (delay/delaystart 24)');
{
  function finale(difficulty) {
    const { state, mg } = scene(difficulty);
    const rec = { flip: -1, sweep: {}, telegraphAt: {}, marked: null };
    for (let f = 0; f < 320; f++) {
      stepFrame(state, {});
      if (mg.alive && mg.con === 1 && rec.flip < 0) {
        rec.flip = f;
        rec.marked = swords(state).map((s) => ({ delay: s.delay, delaystart: s.delaystart }));
      }
      for (const s of swords(state)) {
        if (s.con === 1 && s.telegraph === 1 && rec.telegraphAt[s.delaystart] === undefined) {
          rec.telegraphAt[s.delaystart] = s.timer;
        }
        if (s._speed === 80 && rec.sweep[s.delaystart] === undefined) rec.sweep[s.delaystart] = f;
      }
    }
    return { state, mg, rec };
  }
  const flat = finale(4);
  const cross = finale(11);

  assertEq(flat.mg.finishtimermax, 230, 'finishtimermax 230 outside knight difficulty 3');
  assert(flat.rec.flip >= 0, 'd4 reaches the finale');
  assert(cross.rec.flip >= 0, 'd11 reaches the finale');
  assertEq(cross.rec.flip, flat.rec.flip, 'both tiers flip on the same frame');

  assert(flat.rec.marked.length > 0, 'd4 has live swords at the flip');
  assert(flat.rec.marked.every((m) => m.delay === 0 && m.delaystart === 0),
    'd4 swords are NOT marked (no holyfuck)');
  assert(cross.rec.marked.length > 0, 'd11 has live swords at the flip');
  assert(cross.rec.marked.every((m) => m.delaystart === 24),
    'd11 swords get delaystart = delay = 24');
  // `delay` is already one lower when the frame is observed: the manager marks
  // it in Step and the sword's Draw counts it down the same frame (kaizo sword
  // Draw_0 l.9-13). That countdown IS the telegraph suppression, so assert it
  // rather than papering over it.
  assert(cross.rec.marked.every((m) => m.delay === 23),
    'd11 delay has already ticked once in the same frame (the Draw countdown)');
  {
    const { state, mg } = scene(11);
    const trace = [];
    for (let f = 0; f < 300; f++) {
      stepFrame(state, {});
      if (mg.alive && mg.con === 1) {
        const s = swords(state)[0];
        if (s) trace.push({ delay: s.delay, alpha: s.telegraphalpha });
        if (trace.length >= 30) break;
      }
    }
    assert(trace.length >= 26, 'traced the cross wave past its delay');
    assert(trace.slice(0, 23).every((t, i) => t.delay === 23 - i),
      'delay counts down exactly one per frame');
    assert(trace.slice(0, 23).every((t) => t.alpha <= 0),
      'the telegraph is pinned invisible for the whole delay');
    assert(trace.slice(25, 30).some((t) => t.alpha > 0),
      'and rises once the delay runs out');
  }

  // The telegraph: wave 0 raises at timer 1, wave 24 at timer 1 + delaystart.
  assertEq(flat.rec.telegraphAt[0], 1, 'wave 0 telegraphs at sword timer 1');
  assertEq(cross.rec.telegraphAt[24], 25, 'wave 24 telegraphs at sword timer 1 + delaystart');
  assertEq(cross.rec.telegraphAt[0], undefined, 'd11 has no wave-0 swords');

  // The sweep: _dtimer = timer - delaystart shifts jump/hold/flare/dash only.
  const w0 = flat.rec.sweep[0];
  const w24 = cross.rec.sweep[24];
  assert(w0 !== undefined, 'd4 wave 0 reaches _speed 80');
  assert(w24 !== undefined, 'd11 wave 24 reaches _speed 80');
  assertEq(w24 - w0, 24, 'the cross wave sweeps exactly 24 frames late');
  assertEq(w0 - flat.rec.flip, 29, 'wave 0 sweeps at _dtimer 30 (20 + c)');
}

// ── H. the v091 collision model ──────────────────────────────────────────────
console.log('H. v091 place_meeting sweep (NOT the v105 hitbox rework)');
{
  // Park the soul on the ceiling sword's lane so the corridor rakes it, then
  // let the finale run on top of that.
  const { state, mg } = scene(4);
  let hitboxesEver = 0;
  let smallMaskEver = 0;
  let sweptAtSpeed80 = false;
  for (let f = 0; f < 300; f++) {
    if (state.soul && state.soul.alive && mg.alive && mg.con === 0) {
      state.soul.y = mg.swordy - 50 - mg.gapsize / 2 - 10;
    }
    stepFrame(state, {});
    hitboxesEver += state.entities.filter(
      (e) => e.type.name === 'obj_sword_tunnel_hitbox',
    ).length;
    if (state.soul && state.soul.mask === HEART_SMALL_MASK) smallMaskEver += 1;
    for (const s of swords(state)) {
      if (s._speed === 80 && state.soul
        && Math.abs(s.x - state.soul.x) < 80 && Math.abs(s.y - state.soul.y) < 80) {
        sweptAtSpeed80 = true;
      }
    }
  }
  // POSITIVE: the sub-stepped place_meeting probe fires and deals damage.
  assert((state.tunnelHits ?? 0) > 0,
    `the v091 sweep registers contacts (got ${state.tunnelHits ?? 0})`);
  // NEGATIVE, and the discriminator against the sim module: the v105 rework
  // would have built a 999x0.4 bar and shrunk the soul the moment a dashing
  // sword came within 80px.
  assert(sweptAtSpeed80, 'a finale sword really did dash within 80px of the soul');
  assertEq(hitboxesEver, 0, 'NO obj_sword_tunnel_hitbox is ever created (v091 base)');
  assertEq(smallMaskEver, 0, 'the soul is NEVER swapped to spr_dodgeheart_smallmask');
  // The sword's own Create carries neither of v105's finale fields.
  const probe = swords(state)[0] ?? (() => {
    const s2 = scene(4); for (let f = 0; f < 60; f++) stepFrame(s2.state, {});
    return swords(s2.state)[0];
  })();
  assert(probe, 'a sword exists to inspect');
  if (probe) {
    assertEq(probe.create_2nd_hitbox, undefined, 'no create_2nd_hitbox field (v091)');
    assertEq(probe.active, 1, 'active stays 1 from scr_bullet_init (v091 never zeroes it)');
    assert('delay' in probe && 'delaystart' in probe && 'jumpsnd' in probe && 'cutsnd' in probe,
      'the sword carries the four NEW kaizo fields');
  }
  assert(swordTunnelSword.name === 'obj_sword_tunnel_sword', 'sword type name preserved');
}

// ── I. the 2px soul mask, every frame ────────────────────────────────────────
console.log('I. spr_dodgeheart_smaller_2px_mask stamped every frame');
{
  const { state, mg } = scene(4);
  let stampedEvery = true;
  let framesAlive = 0;
  for (let f = 0; f < 120; f++) {
    // Fight the stamp the way another object would, to prove the manager wins.
    if (state.soul) state.soul.mask = HEART_SMALL_MASK;
    stepFrame(state, {});
    if (mg.alive) {
      framesAlive += 1;
      if (state.soul.mask !== KAIZO_SMALLER_HEART_MASK) stampedEvery = false;
    }
  }
  assert(framesAlive > 100, 'the manager lived long enough to measure');
  assert(stampedEvery, 'the soul wears the 2px mask on every frame the manager lives');
  // UPDATED EXPECTATION. underbox.js now builds this mask from the REAL
  // extracted geometry (kaizo/data/masks.js, generated by
  // tools/pack-kaizo-sprites.mjs) instead of a hand-written spec, so its
  // `.name` is the sprite's own name. Assert the stronger fact directly:
  // it IS the extracted mask, row for row — not a local redefinition and
  // not a copy that could drift from the data file.
  assertEq(KAIZO_SMALLER_HEART_MASK.name, 'spr_dodgeheart_smaller_2px_mask',
    'and it is the shared kaizo mask, not a local redefinition');
  {
    const src = kaizoMask('spr_dodgeheart_smaller_2px_mask');
    assertEq(KAIZO_SMALLER_HEART_MASK.rows.join('|'), src.rows.join('|'),
      'the 2px mask is the extracted geometry, row for row');
    assertEq(KAIZO_SMALLER_HEART_MASK.bbox.join(','), src.bbox.join(','),
      'and carries the extracted bbox');
  }
}

// ── J. the tracking-swords mute ──────────────────────────────────────────────
console.log('J. concurrent tracking-swords manager muted, then destroyed');
{
  function withTracking(difficulty, ac, frames) {
    const { state, mg } = scene(difficulty, { ac });
    const tm = spawn(state, trackingSwordsManager, { x: 300, y: state.view.y });
    tm.variant = 0;
    tm.damage = 100;
    if (trackingSwordsManager.init) trackingSwordsManager.init(tm, state);
    const rec = { mutedAt: -1, killedAt: -1, rate: tm.rate };
    for (let f = 0; f < frames; f++) {
      stepFrame(state, {});
      if (rec.mutedAt < 0 && tm.alive && tm.rate === 9999 && tm.timer === -9999) rec.mutedAt = f;
      if (rec.killedAt < 0 && !tm.alive) rec.killedAt = f;
      if (tm.alive) rec.rate = tm.rate;
    }
    return { state, mg, tm, rec };
  }
  const a = withTracking(4, 13, 260);
  assertEq(a.rec.mutedAt, a.mg.finishtimermax - 21,
    'muted on the first frame finishtimer >= finishtimermax - 20');
  assert(a.rec.killedAt >= 0, 'destroyed once the swords reach con > 0');
  assertEq(a.rec.killedAt, a.mg.finishtimermax - 1, 'destroyed on the finale frame itself');

  // At d10 finishtimer is pinned to 0, so the mute can never fire — the
  // ordering note in the delta spec, made observable.
  const b = withTracking(10, 101, 400);
  assertEq(b.rec.mutedAt, -1, 'd10 never mutes the tracking manager');
  assertEq(b.rec.killedAt, -1, 'd10 never destroys the tracking manager');
  assert(b.rec.rate !== 9999, 'd10 leaves the tracking rate alone');
}

// ── K. the anim's vertical mode and its RNG ──────────────────────────────────
console.log('K. swordtunnelanim vertical mode + light-fairy burst');
{
  const fairies = (state) => state.entities.filter(
    (e) => e.alive && e.sprite_index === 'spr_lightfairy',
  );

  // Run to the anim's timer 20, recording the burst frame and the stream.
  function run(vertical) {
    const { state, mg } = scene(11);
    // Hunk 3's gate is `vertical`; clearing it isolates the burst from every
    // other draw in the frame, which is what makes the delta below exact.
    if (!vertical) mg.woosh.vertical = false;
    const rec = { burstFrame: -1, drawsBefore: 0, drawsAfter: 0, count: 0, visible: [] };
    for (let f = 0; f < 30; f++) {
      const before = state.gmlRng.draws ?? 0;
      stepFrame(state, {});
      if (mg.woosh.alive) rec.visible.push(mg.woosh.visible);
      if (mg.woosh.alive && mg.woosh.timer === 20 && rec.burstFrame < 0) {
        rec.burstFrame = f;
        rec.drawsBefore = before;
        rec.drawsAfter = state.gmlRng.draws ?? 0;
        rec.count = fairies(state).length;
        rec.sample = fairies(state).map((x) => ({ x: x.x, y: x.y, hs: x.hspeed, vs: x.vspeed }));
      }
    }
    return { state, mg, rec };
  }

  const on = run(true);
  const off = run(false);

  assertEq(on.mg.woosh.vertical, true, 'd11 anim is in vertical mode');
  assertEq(on.rec.visible[0], false, 'vertical anim hides itself at timer 1');
  assert(on.rec.visible.every((v) => v === false), 'and stays hidden');
  assert(off.rec.visible.every((v) => v === true), 'non-vertical anim stays visible');

  assertEq(on.rec.count, 12, 'the burst creates 12 light fairies');
  assertEq(off.rec.count, 0, 'non-vertical mode creates none');
  assert(on.rec.burstFrame >= 0 && on.rec.burstFrame === off.rec.burstFrame,
    'both runs reach the anim timer 20 on the same frame');

  // 6 draws per particle: irandom(220) = 2, random_range x2 = 2,
  // irandom_range(20, 30) = 2. Twelve of them, in one Step frame.
  const delta = (on.rec.drawsAfter - on.rec.drawsBefore)
    - (off.rec.drawsAfter - off.rec.drawsBefore);
  assertEq(delta, 72, 'the burst consumes exactly 72 extra draws');

  // Geometry: cameray() - 24, x in camerax() + 210 .. +430. The particles have
  // already taken one motion step by the time they are observed, so the bands
  // carry the single random_range offset.
  const vx = on.state.view.x;
  const vy = on.state.view.y;
  assert(on.rec.sample.every((p) => p.x >= vx + 208 && p.x <= vx + 432),
    'fairy x scatter sits in camerax() + 210 .. + 430');
  assert(on.rec.sample.every((p) => p.y > vy - 25 && p.y < vy - 19),
    'fairies enter just above the camera top');
  assert(on.rec.sample.every((p) => p.vs >= 2.5 && p.vs <= 4), 'fairy vspeed in [2.5, 4]');
  assert(on.rec.sample.every((p) => p.hs >= -2 && p.hs <= 2), 'fairy hspeed in [-2, 2]');
  assert(new Set(on.rec.sample.map((p) => p.x)).size >= 10, 'the x scatter is really random');

  // The delayed destroy is an ALARM, not a counter: 31 frames after the burst.
  const alive31 = (() => {
    const { state, mg } = scene(11);
    let burst = -1;
    for (let f = 0; f < 90; f++) {
      stepFrame(state, {});
      if (burst < 0 && mg.woosh.alive && mg.woosh.timer === 20) burst = f;
      if (burst >= 0 && f === burst + 31) return fairies(state).length;
    }
    return -1;
  })();
  assertEq(alive31, 0, 'the fairies are gone 31 frames after the burst');

  // Nothing about vertical mode reaches the vanilla anim.
  assertEq(swordTunnelAnim.name, 'obj_knight_swordtunnelanim', 'anim type name preserved');
}

// ── L. the blue palette — SHARED, and live on the blade ──────────────────────
console.log('L. get_swordcolor / #86A2FF come from kaizo-colors.js');
{
  // The module re-exports the shared palette; it must be the SAME binding, not
  // a private copy. (It used to define its own table, and two sibling modules
  // had already drifted from it — tracking-swords.js decoded 16732740 as
  // $FF4E44 instead of $FF5244.) Identity is not optional here: kaizo's own
  // Draw gate is `image_blend == get_swordcolor()`, translated below as
  // reference equality.
  assert(tunnelGetSwordcolor === sharedGetSwordcolor,
    'sword-tunnel.js re-exports the shared getSwordcolor, not a private copy');
  assert(tunnelTelegraph === sharedTelegraph,
    'and the shared KAIZO_TELEGRAPH_COLOR');
  assertEq(sharedTelegraph.join(','), '134,162,255', 'KAIZO_TELEGRAPH_COLOR is #86A2FF');
  const st0 = { kaizo: {} };
  assertEq(sharedGetSwordcolor(st0).join(','), '0,0,255',
    'get_swordcolor() default is pure BLUE — 16711680 read as BGR, not red');
  assert(sharedGetSwordcolor(st0) === sharedGetSwordcolor(st0),
    'and it hands back a STABLE reference for the image_blend == gates');
  assertEq(sharedGetSwordcolor({ kaizo: { swordtype: 1 } }).join(','), '68,82,255',
    'swordtype 1 = 16732740 = $FF5244');
  assertEq(sharedGetSwordcolor({ kaizo: { swordtype: 2 } }).join(','), '101,122,255',
    'swordtype 2 = 16743013 = $FF7A65');
  assertEq(sharedGetSwordcolor({ kaizo: { swordtype: 3 } }).join(','), '149,147,255',
    'swordtype 3 = 16749461 = $FF9395');

  // AND IT REACHES THE BLADE. kaizo sword Step l.86-91: white every frame,
  // get_swordcolor() inside the 80px box around the soul. Vanilla painted
  // c_red there, so this single frame separates the builds.
  const { state } = scene(4);
  let sawWhite = false;
  let sawBlue = false;
  let sawRed = false;
  for (let f = 0; f < 400; f++) {
    stepFrame(state, {});
    const heart = state.soul;
    for (const s of swords(state)) {
      if (s.image_blend === sharedGetSwordcolor(state)) sawBlue = true;
      else if (Array.isArray(s.image_blend)) {
        if (s.image_blend[0] === 255 && s.image_blend[2] === 255) sawWhite = true;
        if (s.image_blend[0] > s.image_blend[2]) sawRed = true;
      }
      // Park the soul onto the sword's lane so the proximity band is entered
      // at least once; the sweep itself is asserted in section F.
      if (heart && !sawBlue && s.con === 0) { heart.x = s.x - 4; heart.y = s.y - 4; }
    }
  }
  assert(sawWhite, 'L: a tunnel sword is c_white outside the 80px band');
  assert(sawBlue,
    'L: and takes get_swordcolor() — by reference — inside it (kaizo Step l.91)');
  assert(!sawRed, 'L: no tunnel sword is ever red-tinted (vanilla c_red is gone)');
}

console.log('');
if (failures === 0) {
  console.log(`check-sword-tunnel: ${checks} assertions, all pass`);
  process.exit(0);
} else {
  console.log(`check-sword-tunnel: ${failures} FAILURES out of ${checks} assertions`);
  process.exit(1);
}
