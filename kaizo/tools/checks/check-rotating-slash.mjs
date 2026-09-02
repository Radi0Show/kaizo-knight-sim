#!/usr/bin/env node
// POSITIVE assertions on the KAIZO rotating slash's NEW branches
// (kaizo/attacks/rotating-slash.js — V-C recreation of EnderCat8's Kaizo
// Roaring Knight; publish-gated, see the module header).
//
// Every scenario asserts what a mod branch CHANGES, with a vanilla-shaped
// contrast run wherever the branch could silently be deleted:
//   1  d8 table (Other_10:23-33): 5-slash volleys, vs d2's max of 4
//   2  d10 / dual fast-lock (Step_0:37-63): rotation_goal 0, padding back,
//      the aim line braking to a standstill, NO finale at d10
//   3  the pair (Create_0:62-80, Step_0:262/526-539): firstrot bookkeeping,
//      shared finale_spin, coordinated finale aim +-45 +-5
//   4  B-Side rings (Step_0:429-496): counts 6/8 by slash_number (the d8
//      table is the only path to 8), alternate half-step parity, damage 140,
//      the scr_delay_var active flip at +25 (alarm-timed), the speed lerp's
//      REAL -1 start, and kaizo_slashbullet_step's 2-draw-per-bullet burn
//      (lockstep draw-count diff against a suppressed run)
//   5  B-Side finale length (Step_0:603-615): 56, 42 under a vortex manager,
//      28 on the normal side
//   6  delay_swords (Create_0:54-61, Step_0:5-36): pacing pins, tracking
//      sword retune, manager throttle + the once-per-aim release window
//   7  CleanUp 111 handoff seam (CleanUp_0:16-46): hook routing, and the
//      ledgered vanilla fallback without the hook
//   8  vanilla retention: d0/d1/d2 tables, turn_type ladder, finale 28
//
//     node kaizo/tools/checks/check-rotating-slash.mjs      (exit 0/1)

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox, settleBox } from '../../../sim/battlebox.js';
import { gmlCreate } from '../../../sim/rng.js';
// The SHARED palette — the ring's blend is asserted by IDENTITY below, so a
// private copy in the module would fail this suite.
import { getSwordcolor } from '../../attacks/kaizo-colors.js';
import {
  rotatingSlash, spawnRotatingSlash,
} from '../../attacks/rotating-slash.js';

let failures = 0;
let checks = 0;
function ok(cond, msg) {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

// Minimal stub types — the module only ever matches these by type.name.
const knightStub = { name: 'obj_knight_enemy' };
const trackingManagerStub = { name: 'obj_tracking_swords_manager' };
const trackingSwordStub = { name: 'obj_tracking_sword1' };
const vortexManagerStub = { name: 'obj_sword_vortex_manager' };

function makeScene(seed, { sideb = false, currentAc = 5, kaizoState = true } = {}) {
  const state = createState({ seed });
  state.view = { x: 0, y: 0 };
  state.invTimer = -1;
  state.turntimer = 999999;
  state.gmlRng = gmlCreate(seed);
  // Contact is still detected; no damage/destroy — the rings spawn ON the
  // soul, and a dead party would end the scenario mid-assert.
  state.damageEnabled = false;
  if (kaizoState || sideb) state.kaizo = { sideb };
  state.currentAc = currentAc;
  spawn(state, knightStub, { x: 425, y: 78 });
  settleBox(spawn(state, battlebox, { x: 320, y: 170 }));
  state.soul = spawn(state, soul, { x: 314, y: 162 });
  return state;
}

function alive(state, name) {
  return state.entities.filter((e) => e.alive && e.type.name === name);
}
function ctrl(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_knight_rotating_slash');
}

/** Step `frames`, tracking per-frame NEW obj_roaringknight_slash spawns and
 *  grouping consecutive-spawn frames into volleys. Also records ring-bullet
 *  births and per-frame controller snapshots via `onFrame`. */
function run(state, frames, onFrame) {
  const seenSlash = new Set();
  const volleys = [];
  let current = null;
  for (let f = 0; f < frames; f++) {
    stepFrame(state, {});
    let fresh = 0;
    for (const s of alive(state, 'obj_roaringknight_slash')) {
      if (!seenSlash.has(s.seq)) { seenSlash.add(s.seq); fresh += 1; }
    }
    if (fresh > 0) {
      if (current && current.last === state.frame - 2) {
        current.n += fresh;
        current.last = state.frame - 1;
      } else {
        current = { n: fresh, last: state.frame - 1 };
        volleys.push(current);
      }
    }
    if (onFrame) onFrame(state, f);
  }
  return volleys.map((v) => v.n);
}

// ── 1. difficulty 8: the new Other_10 table and its 5-slash volleys ────────
{
  const st = makeScene(1001);
  const e = spawnRotatingSlash(st, 425, 78, { difficulty: 8 });
  ok(e.slash_offset === 0 && e.slash_number === 3, 'd8 init: offset 0, number 3');
  ok(JSON.stringify(e.slash_array) === JSON.stringify([3, 4, 4, 4, 5, 5]),
    `d8 init: slash_array [3,4,4,4,5,5], got ${JSON.stringify(e.slash_array)}`);
  const volleys = run(st, 320);
  ok(Math.max(...volleys, 0) === 5,
    `d8 fires a 5-slash volley (Other_10:31-32), volleys ${JSON.stringify(volleys)}`);
  ok(!ctrl(st), 'd8 attack self-ends (no finale branch at d8)');
  ok(st.turntimer === -1, 'd8 closing CleanUp hands the clock -1');

  // Contrast: at d2 the same run never exceeds 4 — deleting the d8 block
  // would collapse the two runs together.
  const st2 = makeScene(1001);
  spawnRotatingSlash(st2, 425, 78, { difficulty: 2 });
  const v2 = run(st2, 320);
  ok(Math.max(...v2, 0) === 4, `d2 contrast: max volley 4, got ${JSON.stringify(v2)}`);
}

// ── 2. difficulty 10: the fast-lock (Step_0:37-63) ─────────────────────────
{
  const st = makeScene(2002);
  const e = spawnRotatingSlash(st, 425, 78, { difficulty: 10 });
  ok(JSON.stringify(e.slash_array) === JSON.stringify([1, 2, 2, 3, 3, 4]),
    'd10 keeps the Create default slash_array (no Other_10 row)');
  let minRotAiming = Infinity;
  let sawLock = false;
  let maxAimType = 0;
  run(st, 500, (s) => {
    const c = ctrl(s);
    if (!c) return;
    maxAimType = Math.max(maxAimType, c.aim_type);
    if (c.state === 'aim' && !c.slashes_done) {
      minRotAiming = Math.min(minRotAiming, c.rotation);
      if (c.rotation_goal === 0 && c.slash_offset === 6) sawLock = true;
    }
  });
  ok(sawLock, 'd10 aim runs with rotation_goal 0 and slash_offset 6 (normal side)');
  ok(minRotAiming < 1,
    `d10 aim line brakes toward standstill (rotation ${minRotAiming})`);
  ok(maxAimType === 0, 'd10 never enters the spiral (finale stays d2-only)');

  // Contrast: solo d2 keeps the vanilla drift target 2 and never brakes
  // below it.
  const st2 = makeScene(2002);
  spawnRotatingSlash(st2, 425, 78, { difficulty: 2 });
  let minRot2 = Infinity;
  let goal2ok = true;
  run(st2, 220, (s) => {
    const c = ctrl(s);
    if (c && c.state === 'aim' && !c.slashes_done) {
      minRot2 = Math.min(minRot2, c.rotation);
      if (c.rotation_goal !== 2) goal2ok = false;
    }
  });
  ok(goal2ok && minRot2 >= 2, `solo d2 contrast: rotation_goal 2, rotation floor ${minRot2}`);
}

// ── 3. the pair: firstrot / finale_spin / coordinated finale ───────────────
{
  const st = makeScene(3003);
  const first = spawnRotatingSlash(st, 425, 78, { difficulty: 2 });
  const second = spawnRotatingSlash(st, 425, 78, { difficulty: 2 });
  ok(first.firstrot === 1 && second.firstrot === 0,
    `firstrot bookkeeping: first 1 / second 0, got ${first.firstrot}/${second.firstrot}`);
  ok((first.finale_spin === -1 || first.finale_spin === 1)
    && second.finale_spin === first.finale_spin,
    'the pair shares one finale_spin (Create_0:62-80)');

  let dualLock = false;
  let delta = null;
  let spinLockstep = false;
  let prevDoFinal = true;
  run(st, 900, (s) => {
    if (second.alive && second.state === 'aim' && !second.slashes_done
      && second.rotation_goal === 0 && second.slash_offset === 6) dualLock = true;
    if (second.alive && prevDoFinal && second.do_final === false && delta === null) {
      // The frame second's do_final ran: it read first's live aim_direction
      // (first steps first) and offset it by choose(-45,45) + range(-5,5).
      delta = second.aim_direction - first.aim_direction;
    }
    prevDoFinal = second.alive ? second.do_final : prevDoFinal;
    if (first.alive && second.alive
      && first.aim_type === 2 && second.aim_type === 2
      && first.spin === first.finale_spin && second.spin === second.finale_spin) {
      spinLockstep = true;
    }
  });
  ok(dualLock, 'dual instances get the fast-lock even at d2 (instance_number > 1)');
  ok(delta !== null && Math.abs(delta) >= 40 && Math.abs(delta) <= 50,
    `second finale aim is first +-45 +-5 (Step_0:526-539), delta ${delta}`);
  ok(spinLockstep, 'both knights whirl on the shared finale_spin (Step_0:262)');
}

// ── 4. B-Side rings (Step_0:429-496) ───────────────────────────────────────
{
  // Lockstep pair: same seed, both sideb d8 solo; run B carries a vortex
  // manager stub, which suppresses the rings — so the ONLY divergence at the
  // first ring frame is the ring bullets and their runners' RNG burn.
  const A = makeScene(4004, { sideb: true });
  const B = makeScene(4004, { sideb: true });
  spawn(B, vortexManagerStub, { x: 320, y: 0 });
  const ea = spawnRotatingSlash(A, 425, 78, { difficulty: 8 });
  spawnRotatingSlash(B, 425, 78, { difficulty: 8 });
  ok(ea.firstrot === 1, 'sideb solo: the instance is firstrot');

  const rings = []; // { frame, bullets: [...] } grouped by born frame
  const seenRing = new Set();
  let capSeen = false;
  let ringFrame = -1;
  let drawsAtF = null;
  let drawsAtF1 = null;
  let drawsAtF2 = null;
  let tracked = null;
  const trackedLog = [];
  for (let f = 0; f < 340; f++) {
    stepFrame(A, {});
    stepFrame(B, {});
    const c = ctrl(A);
    if (c && c.slash_base <= 15 && c.state === 'aim') capSeen = true;
    const fresh = [];
    for (const b of alive(A, 'obj_regularbullet')) {
      if (!seenRing.has(b.seq)) { seenRing.add(b.seq); fresh.push(b); }
    }
    if (fresh.length) {
      rings.push({ frame: A.frame - 1, bullets: fresh });
      if (ringFrame === -1) {
        ringFrame = f;
        tracked = fresh[0];
        drawsAtF = [A.gmlRng.draws ?? 0, B.gmlRng.draws ?? 0];
      }
    }
    if (ringFrame !== -1 && f === ringFrame + 1) drawsAtF1 = [A.gmlRng.draws ?? 0, B.gmlRng.draws ?? 0];
    if (ringFrame !== -1 && f === ringFrame + 2) drawsAtF2 = [A.gmlRng.draws ?? 0, B.gmlRng.draws ?? 0];
    if (tracked) {
      trackedLog.push({
        f: f - ringFrame, alive: tracked.alive, active: tracked.active,
        speed: tracked.speed, xscale: tracked.image_xscale, alpha: tracked.image_alpha,
      });
    }
  }

  ok(capSeen, 'B-Side solo cap: slash_base held at <= 15 (Step_0:57-63)');
  ok(rings.length >= 2, `at least two rings fired, got ${rings.length}`);
  ok(alive(B, 'obj_regularbullet').length === 0
    && B.entities.every((e) => !(e.alive && e.type.name === 'obj_regularbullet')),
    'vortex manager suppresses the rings entirely (i_ex gate)');

  const counts = rings.map((r) => r.bullets.length);
  ok(counts[0] === 6, `first ring is 6 bullets (slash_number 3 > 2), got ${counts[0]}`);
  ok(counts.includes(8),
    `the d8 5-slash volleys produce an 8-ring (slash_number > 4), got ${JSON.stringify(counts)}`);

  // Alternate volleys offset half a step: ring 0 (rotind 0) contains dir 0;
  // ring 1 (rotind 1, same _amt 6) starts at 30.
  const dirs0 = rings[0].bullets.map((b) => b.direction).sort((a, b2) => a - b2);
  const dirs1 = rings[1].bullets.map((b) => b.direction).sort((a, b2) => a - b2);
  ok(Math.abs(dirs0[0] - 0) < 1e-4 && Math.abs(dirs0[1] - 60) < 1e-3,
    `ring 0 spaced from 0 by 60, got ${dirs0[0]}, ${dirs0[1]}`);
  ok(Math.abs(dirs1[0] - 30) < 1e-3,
    `ring 1 offset by the half step 30 (rotind parity), got ${dirs1[0]}`);

  for (const b of rings[0].bullets) {
    ok(b.damage === 140, `ring bullet damage 140, got ${b.damage}`);
    ok(b.destroyonhit === 0, 'ring bullet destroyonhit 0');
    ok(b.flag === 'exp', 'ring bullet carries the mod write-only flag "exp"');
    // KAIZO Step_0:461 — `image_blend = get_swordcolor()`. The ring is BLUE,
    // and it must be the SHARED reference from kaizo-colors.js, not a local
    // copy: the mod's Draw gates elsewhere compare image_blend against
    // get_swordcolor() by identity.
    ok(b.image_blend === getSwordcolor(A),
      `ring bullet carries the shared get_swordcolor() (got ${JSON.stringify(b.image_blend)})`);
  }
  ok(getSwordcolor(A)[2] === 255 && getSwordcolor(A)[0] === 0,
    'get_swordcolor() default decodes 16711680 as pure BLUE (BGR), not red');

  // The tracked bullet's tween/delay clockwork (log rows are 0-based from
  // the ring frame; row k = state at end of frame ringFrame+k).
  const at = (k) => trackedLog.find((r) => r.f === k);
  ok(at(1) && at(1).speed < 0,
    `speed lerps from a REAL -1 start (first write ~ -0.083), got ${at(1) && at(1).speed}`);
  ok(at(12) && at(12).speed === 10, `speed reaches 10 at +12, got ${at(12) && at(12).speed}`);
  ok(at(12) && Math.abs(at(12).xscale - 0.9) < 1e-6,
    `image_xscale reaches 0.9 at +12, got ${at(12) && at(12).xscale}`);
  ok(at(24) && at(24).active === 1, 'active still 1 at +24');
  ok(at(25) && at(25).active === 0,
    'scr_delay_var flips active to 0 exactly at +25 (alarm-timed, not a counter)');
  ok(at(25) && Math.abs(at(25).alpha - 1) < 1e-6,
    `image_alpha crosses 1.0 exactly as active drops (3.5 -> 0 over 35), got ${at(25) && at(25).alpha}`);
  ok(at(30) && Math.abs(at(30).alpha - 0.5) < 1e-6,
    `image_alpha 0.5 at +30, got ${at(30) && at(30).alpha}`);

  // The kaizo_slashbullet_step burn: 2 draws per ring bullet per frame. At
  // the ring frame both streams are aligned; one frame later the six
  // runners have burned 12 draws that the suppressed run did not.
  ok(drawsAtF && drawsAtF[0] === drawsAtF[1],
    `streams aligned at the ring frame, got ${JSON.stringify(drawsAtF)}`);
  ok(drawsAtF1 && drawsAtF1[0] - drawsAtF1[1] === 12,
    `runners burn 2 draws x 6 bullets on the next frame, delta ${drawsAtF1 && (drawsAtF1[0] - drawsAtF1[1])}`);
  ok(drawsAtF2 && drawsAtF2[0] - drawsAtF2[1] === 24,
    `and again the frame after, delta ${drawsAtF2 && (drawsAtF2[0] - drawsAtF2[1])}`);

  // Normal side, same seed: no rings at all.
  const N = makeScene(4004, { sideb: false });
  spawnRotatingSlash(N, 425, 78, { difficulty: 8 });
  let normalRings = 0;
  run(N, 340, (s) => { normalRings += alive(s, 'obj_regularbullet').length; });
  ok(normalRings === 0, 'normal side never spawns a ring');
}

// ── 5. B-Side finale length (Step_0:603-615) ───────────────────────────────
{
  function finaleLen(sideb, withVortex) {
    const st = makeScene(5005, { sideb });
    if (withVortex) spawn(st, vortexManagerStub, { x: 320, y: 0 });
    const e = spawnRotatingSlash(st, 425, 78, { difficulty: 2 });
    let maxFinal = 0;
    run(st, 1100, () => { if (e.alive) maxFinal = Math.max(maxFinal, e.final_counter); });
    return maxFinal;
  }
  const n = finaleLen(false, false);
  const s56 = finaleLen(true, false);
  const s42 = finaleLen(true, true);
  ok(n === 28, `normal-side finale is the vanilla 28, got ${n}`);
  ok(s56 === 56, `B-Side finale runs 56 slashes, got ${s56}`);
  ok(s42 === 42, `B-Side finale under a vortex manager runs 42, got ${s42}`);
}

// ── 6. delay_swords: the ac-16 combo throttle (Step_0:5-36) ────────────────
{
  function delayRun(sideb) {
    const st = makeScene(6006, { sideb, currentAc: 16 });
    const mg = spawn(st, trackingManagerStub, { x: 320, y: 0 });
    mg.rate = 24;
    mg.timer = 0;
    const sw = spawn(st, trackingSwordStub, { x: 320, y: 100 });
    const e = spawnRotatingSlash(st, 425, 78, { difficulty: 0 });
    ok(e.delay_swords === true && e.delay_wait === 0,
      `myattackchoice 16 arms delay_swords (Create_0:54-61), sideb=${sideb}`);

    const adj = sideb ? 1 : 0;
    let pinned = 0;
    let armFrame = -1;
    let unpinnedDuringWait = false;
    let pacing = false;
    for (let f = 0; f < 120; f++) {
      mg.timer = 0; // reset so a pin this frame is unambiguous
      stepFrame(st, {});
      if (!e.alive) break;
      if (mg.timer === mg.rate - 2) pinned += 1;
      if (armFrame === -1 && e.delay_wait === 15 - adj) {
        armFrame = f;
        if (mg.timer === 0) unpinnedDuringWait = true; // the window frame itself
      } else if (armFrame !== -1 && f === armFrame + 1) {
        // countdown frame: delay_wait > 0, manager untouched
        unpinnedDuringWait = unpinnedDuringWait && mg.timer === 0 && e.delay_wait === 14 - adj;
      }
      if (e.slash_base === 16 - adj && e.slash_offset === 0
        && e.cooldown_time === 12 - adj) pacing = true;
    }
    ok(pacing, `delay_swords pins slash_base ${16 - adj} / offset 0 / cooldown ${12 - adj}`);
    ok(pinned > 10, `manager throttled to rate-2 outside the window (${pinned} frames)`);
    ok(armFrame !== -1, `the aim window (timer == ${5 - adj}) re-arms delay_wait to ${15 - adj}`);
    ok(unpinnedDuringWait, 'manager runs free during the delay_wait countdown');
    ok(sw.fadetohalftime === 5 && sw.waittime === 5
      && sw.fadetofulltime === 15 - adj && sw.flashtime === 4,
      `tracking sword fade clock retuned (fadetofulltime ${15 - adj})`);
  }
  delayRun(false);
  delayRun(true);
}

// ── 7. the CleanUp 111 handoff seam (CleanUp_0:16-46) ──────────────────────
{
  // With the VORTEX item's hook: routed, turn NOT ended here.
  const st = makeScene(7007, { sideb: true, currentAc: 111 });
  let hookCalls = 0;
  st.kaizo.hooks = {
    vortexendHandoff(state) { hookCalls += 1; state.turntimer = 999; },
  };
  const e = spawnRotatingSlash(st, 425, 78, { difficulty: 8 });
  e.local_turntimer = 240; // shorten the pattern; the mod's 111 turn is chained
  run(st, 400);
  const knight = st.entities.find((k) => k.alive && k.type.name === 'obj_knight_enemy');
  ok(!e.alive, 'ac-111 attack ran to its own CleanUp');
  ok(hookCalls === 1, `vortexendHandoff hook called exactly once, got ${hookCalls}`);
  ok(st.turntimer === 999, `hook owns the clock (999), got ${st.turntimer}`);
  ok(knight && knight.image_alpha === 1, 'knight restored before the handoff');

  // Without the hook: vanilla -1 fallback, LEDGERED.
  const st2 = makeScene(7007, { sideb: true, currentAc: 111 });
  const e2 = spawnRotatingSlash(st2, 425, 78, { difficulty: 8 });
  e2.local_turntimer = 240;
  run(st2, 400);
  ok(st2.turntimer === -1, 'hookless fallback ends the turn (-1)');
  ok(Array.isArray(st2.kaizo.approx) && st2.kaizo.approx.length === 1
    && /vortexendHandoff/.test(st2.kaizo.approx[0].why),
    'hookless fallback is ledgered in state.kaizo.approx');

  // Normal-side / non-111 turns never touch the seam.
  const st3 = makeScene(7008, { sideb: false, currentAc: 5 });
  const e3 = spawnRotatingSlash(st3, 425, 78, { difficulty: 0 });
  e3.local_turntimer = 240;
  run(st3, 400);
  ok(st3.turntimer === -1 && !st3.kaizo.approx, 'vanilla close untouched off the 111 path');
}

// ── 8. vanilla retention: the copy keeps the sim's tables ──────────────────
{
  const st = makeScene(8008);
  const mk = (d, turnType) => {
    const e = spawn(st, rotatingSlash, { x: 425, y: 78 });
    e.difficulty = d;
    if (turnType) e.turn_type = turnType;
    rotatingSlash.init(e);
    return e;
  };
  const d0 = mk(0);
  ok(d0.slash_offset === 6 && d0.slash_number === 1
    && JSON.stringify(d0.slash_array) === JSON.stringify([1, 2, 2, 3, 3, 4]),
    'd0 keeps the Create defaults');
  const d1 = mk(1);
  ok(d1.slash_offset === 6 && d1.slash_number === 3
    && JSON.stringify(d1.slash_array) === JSON.stringify([2, 3, 4, 4, 4, 4]),
    'd1 table intact');
  const d2 = mk(2);
  ok(d2.slash_offset === 0 && d2.slash_number === 3
    && JSON.stringify(d2.slash_array) === JSON.stringify([3, 4, 4, 4, 4, 4]),
    'd2 table intact');
  const end = mk(0, 'end');
  ok(end.local_turntimer === 300 && end.timer === 15, 'turn_type "end" ladder intact');
  const sm = mk(0, 'short mid');
  ok(sm.local_turntimer === 260 && sm.timer === 15 && sm.turn_limit_4 === 250,
    'turn_type "short mid" ladder intact');
}

if (failures > 0) {
  console.error(`check-rotating-slash: ${failures}/${checks} FAILED`);
  process.exit(1);
}
console.log(`check-rotating-slash: all ${checks} checks passed`);
process.exit(0);
