#!/usr/bin/env node
// POSITIVE assertions on the KAIZO QUICKSLASH — the mod's NEW controller
// types 1001 ("quickslash") and 97.1 ("quickslash true", the B-Side swap).
// Module: kaizo/attacks/quickslash.js.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// There is NO vanilla sim module to contrast against: obj_roaringknight_
// quickslash_attack is content the real fight can never reach, so every
// scenario below contrasts a kaizo branch against ANOTHER kaizo path that the
// same code selects (1001 vs 97.1, side A vs side B, phase 3 vs not,
// endtype 0 vs 1). Each assertion names the kaizo GML file+line it pins.
//
//   1  the two dc branches (dbulletcontroller Step_0:1963-1985 / 2264-2278):
//      1001 pins global.turntimer 999999 and takes NO event_user(0);
//      97.1 does not pin, and Other_10's "full" arm overrides
//      local_turntimer 600 -> 230 and flies the knight in
//   2  Create_0:43-77 — the kaizo config block, the B-Side fractional
//      cadence, and the phase-3 override table OVERRIDING the B-Side block
//   3  Step_0:161-195 — the spawn_phase ramp machine: the 0.25/spawn walk to
//      spawn_min, the phase-1 -> 2 handover (slash_count 980, timer -7, no
//      spawn on that tick), and the barrage that runs EIGHT cuts because
//      the accumulated spawn_phase reaches 2.26999999999999824 — 1.776e-15
//      UNDER the 2.27 exit literal — and GML compares reals with an epsilon,
//      so that ninth increment IS the exit. Oracle `_deep`: 28 quickslash on
//      both recorded passes = 20 ramp + 8 barrage. (This header said NINE
//      until 2026-08-29; the number was read off decimal arithmetic, never
//      off the recording.)
//   4  Other_13:36-44 — the phase-2 left-wall barrage: box-centre x, a fresh
//      y across the whole box, 180 +- 36 leftward, every 2 frames,
//      slash_delay 40. Contrast: the phase-3 table (spawn_phase 0) fires
//      ZERO barrage cuts
//   5  Other_13:13-35/71-89 — dead-accurate aim: spawn_range 32 -> 8 and
//      spawn_yrange 44 -> 0 converge, and the late cuts' lines pass through
//      the heart centre while the early ones scatter
//   6  Other_13 RNG budget: 2 draws a spawn, 5 in the barrage, 6 on Side B
//      (the extra vertical cut), 5 on Side B inside the barrage
//   7  Other_11:1-14/42-53 — the alternating side-teleport (x 22 / 662 off
//      the heart's START x, first pose LEFT) and the final-slash override
//      that WRITES THE TURN CLOCK (80, 240 under endtype 1)
//   8  quickslash_Step_0 — telegraph off the controller's slash_delay,
//      the image_yscale 0.4 hitbox nerf, a 2-frame active window, damage 84
//      / target 3, and a real party-wide contact BOTH ways: diagonal AND
//      axis-aligned. The axis-aligned one is the discriminating case — the
//      mask is the EXTRACTED spr_rk_quickslash_marker_gradient (six rows,
//      bbox [0,20,249,25], 2.4px at yscale 0.4), and the stand-in it replaces
//      (spr_rk_quickslash_marker, ONE row, 0.4px) is under the contact
//      study's 1px floor, so under it that cut cannot land at all. The band's
//      geometry is pinned line by line, and the approx ledger row that
//      accompanied the stand-in must now be ABSENT (block 13).
//      Plus the telegraph's blue: merge_color toward get_swordcolor() from
//      the shared kaizo-colors.js palette (BGR — the default is pure blue,
//      not red), swordtype read live, zero RNG cost.
//   9  quickslash_big_Step_0 — the catch at timer 40-41, the splitter
//      (con armed, damage 206, target 0, vertical under endtype 1) and
//      scr_damage_all_maxhp(0.5) taking HALF OF MAX HP from every living
//      member; endtype 1 defers the strike by exactly 20 frames
//  10  Step_0:36-50 — the endtype despawn gate: -60 vs -160, exactly 100
//      frames apart
//  11  THE TURN ENDS ITSELF, on every path. The dispatch pins the clock at
//      9999/999999 and only this controller releases it: a turn that never
//      ends deadlocks the whole V-C schedule.
//  12  Draw_0:1-29 — the nodraw gate freezes the pose/afterimage counters,
//      and quickslash_big_Step_0:62-66 clears it
//  13  the dormant chain handoff (Step_0:60-148) is ledgered, not silently
//      taken, and turn_type "full" never reaches it
//
//     node kaizo/tools/checks/check-quickslash.mjs      (exit 0/1)

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox, settleBox } from '../../../sim/battlebox.js';
import { gmlCreate } from '../../../sim/rng.js';
import { QUICKSLASH_MARKER_MASK } from '../../../sim/masks.js';
import {
  quickslash, quickslashAttack, quickslashBig,
  spawnQuickslash1001, spawnQuickslashTrue, QUICKSLASH_MARKER_GRADIENT_MASK,
} from '../../attacks/quickslash.js';
import { kaizoMask } from '../../data/masks.js';
import { getSwordcolor } from '../../attacks/kaizo-colors.js';

let failures = 0;
let checks = 0;
function ok(cond, msg) {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

// The knight is a stub: the module only ever matches it by type.name, reads
// its x/y/phase and writes its image_alpha.
const knightStub = { name: 'obj_knight_enemy' };

const BOX_X = 320;
const BOX_Y = 170;
const SOUL_X = 314;
const SOUL_Y = 162;

function makeScene(seed, { sideb = false, phase, damage = false } = {}) {
  const state = createState({ seed });
  state.view = { x: 0, y: 0 };
  state.invTimer = -1;
  state.turntimer = 300;
  state.gmlRng = gmlCreate(seed);
  state.damageEnabled = damage;
  state.kaizo = { sideb };
  const k = spawn(state, knightStub, { x: 425, y: 78 });
  if (phase !== undefined) k.phase = phase;
  settleBox(spawn(state, battlebox, { x: BOX_X, y: BOX_Y }));
  state.soul = spawn(state, soul, { x: SOUL_X, y: SOUL_Y });
  return state;
}

const alive = (s, n) => s.entities.filter((e) => e.alive && e.type.name === n);
const ctrl = (s) => alive(s, 'obj_roaringknight_quickslash_attack')[0];
const knightOf = (s) => alive(s, 'obj_knight_enemy')[0];
const boxOf = (s) => alive(s, 'obj_growtangle')[0];

function gtEdges(s) {
  const gt = boxOf(s);
  const hh = (gt.spriteHeight ?? 75 * gt.image_yscale) * 0.5;
  return [gt.y - hh, gt.y + hh]; // gt_miny(), gt_maxy()
}

/** Perpendicular distance from (px,py) to the infinite line through (x,y) at
 *  `a` degrees — GML's y-down angle convention. */
function lineDist(x, y, a, px, py) {
  const r = (a * Math.PI) / 180;
  const dx = Math.cos(r);
  const dy = -Math.sin(r);
  return Math.abs((px - x) * dy - (py - y) * dx);
}

/**
 * Step `frames`, logging every new obj_roaringknight_quickslash with the
 * controller state that produced it. Stops when the controller is gone.
 */
function run(state, frames, onFrame) {
  const seen = new Set();
  const cuts = [];
  let gone = -1;
  let clockAtGone = null;
  for (let f = 0; f < frames; f++) {
    stepFrame(state, {});
    const c = ctrl(state);
    if (c) {
      for (const s of alive(state, 'obj_roaringknight_quickslash')) {
        if (seen.has(s.seq)) continue;
        seen.add(s.seq);
        cuts.push({
          f,
          x: s.x,
          y: s.y,
          angle: s.image_angle,
          extra: s.extra,
          barrage: Math.floor(c.spawn_phase) === 2,
          spawn_range: c.spawn_range,
          spawn_yrange: c.spawn_yrange,
          slash_delay: c.slash_delay,
          slash_count: c.slash_count,
        });
      }
    } else if (gone < 0) {
      gone = f;
      clockAtGone = state.turntimer;
    }
    if (onFrame) onFrame(state, f);
  }
  return { cuts, gone, clockAtGone };
}

// ── 1. the two dc branches ────────────────────────────────────────────────
{
  // type 1001 — dbulletcontroller Step_0:2264-2278. NO event_user(0).
  const st = makeScene(1001);
  ok(st.turntimer === 300, 'setup: clock starts unpinned');
  const e = spawnQuickslash1001(st, { damage: 80 });
  ok(st.turntimer === 999999, `1001 pins global.turntimer 999999, got ${st.turntimer}`);
  ok(knightOf(st).image_alpha === 0, '1001 hides obj_knight_enemy (with (creatorid) image_alpha = 0)');
  // Step_0 (type 1001): `knight_quickslash.target = 3;` and THEN
  // `scr_bullet_inherit(knight_quickslash);` -- and the controller's target is
  // the knight's mytarget, 4 (scr_bulletspawner; scr_randomtarget's chapter-2+
  // tail), so the inherit overwrites the 3. The 3 is dead in the game.
  ok(e.target === 4, `1001 sets knight_quickslash.target = 3 and then inherits the dc's 4, got ${e.target}`);
  ok(e.damage === 80, `1001 inherits the dispatch damage 80, got ${e.damage}`);
  ok(e.turn_type === 'full', '1001 leaves Create_0:43 turn_type "full"');
  ok(e.local_turntimer === 600,
    `1001 takes NO event_user(0), so Create_0:54's 600 stands, got ${e.local_turntimer}`);
  ok(e.endtype === 0, `1001 leaves endtype 0, got ${e.endtype}`);
  ok(alive(st, 'obj_lerpvar').length === 0, '1001 has no fly-in tweens (no event_user(0))');

  // type 97.1 — Step_0:1963-1985. event_user(0) with turn_type "full".
  const st2 = makeScene(1001);
  const e2 = spawnQuickslashTrue(st2, { damage: 80, difficulty: 0 });
  ok(st2.turntimer === 300,
    `97.1 does NOT pin the clock itself (the arm's scr_turntimer floor does), got ${st2.turntimer}`);
  ok(knightOf(st2).image_alpha === 0, '97.1 hides obj_knight_enemy too');
  ok(e2.local_turntimer === 230,
    `97.1's event_user(0) "full" arm overrides 600 -> 230 (Other_10:3), got ${e2.local_turntimer}`);
  ok(alive(st2, 'obj_lerpvar').length === 2,
    `97.1 arms the two fly-in lerps (Other_10:4-5), got ${alive(st2, 'obj_lerpvar').length}`);
  ok(e2.endtype === 0, 'side A 97.1 keeps endtype 0 (kaizo_sideb() false)');

  // The contrast that makes the pair non-vacuous: the two turns are
  // different lengths because the clock they run on is different.
  const a = run(makeScene(4242), 900, null);
  void a;
}

// ── 2. Create_0:43-77 — config block, B-Side cadence, phase-3 override ─────
{
  const st = makeScene(7);
  const e = spawnQuickslash1001(st);
  ok(e.slash_delay === 30 && e.spawn_min === 5 && e.spawn_yrange === -1
    && e.spawn_range === 32 && e.spawn_phase === 1 && e.spawn_speed === 10
    && e.spawn_rem === 0.25 && e.spawn_delay === 15 && e.timer === 5
    && e.nodraw === false,
  `side A config block (Create_0:44-53), got sd=${e.slash_delay} min=${e.spawn_min} `
    + `yr=${e.spawn_yrange} r=${e.spawn_range} ph=${e.spawn_phase} sp=${e.spawn_speed} `
    + `rem=${e.spawn_rem} del=${e.spawn_delay} t=${e.timer}`);

  const stB = makeScene(7, { sideb: true });
  const b = spawnQuickslashTrue(stB);
  ok(b.spawn_speed === 12.4 && b.spawn_rem === 0.4 && b.timer === 12.4 - 3
    && b.spawn_min === 6 && b.spawn_range === 14,
  `Create_0:55-62 B-Side fractional cadence, got sp=${b.spawn_speed} rem=${b.spawn_rem} `
    + `t=${b.timer} min=${b.spawn_min} r=${b.spawn_range}`);
  ok(b.timer !== 5 && b.spawn_speed !== 10,
    'B-Side cadence really replaced the side-A values (branch not a no-op)');
  ok(b.endtype === 1, `97.1 under kaizo_sideb() sets endtype 1, got ${b.endtype}`);

  // Create_0:63-76 runs AFTER the B-Side block, so phase 3 overrides it.
  const st3 = makeScene(7, { phase: 3 });
  const c3 = spawnQuickslash1001(st3);
  ok(c3.timer === 20 && c3.spawn_yrange === 0 && c3.spawn_range === 12
    && c3.spawn_phase === 0 && c3.spawn_speed === 45 && c3.spawn_min === 4
    && c3.spawn_rem === 1 && c3.spawn_delay === 5,
  `phase-3 override table (Create_0:67-74), got t=${c3.timer} yr=${c3.spawn_yrange} `
    + `r=${c3.spawn_range} ph=${c3.spawn_phase} sp=${c3.spawn_speed} min=${c3.spawn_min} `
    + `rem=${c3.spawn_rem} del=${c3.spawn_delay}`);

  const st3b = makeScene(7, { sideb: true, phase: 3 });
  const c3b = spawnQuickslashTrue(st3b);
  ok(c3b.spawn_speed === 45 && c3b.spawn_rem === 1 && c3b.spawn_range === 12,
    `phase 3 OVERRIDES the B-Side block (order is live), got sp=${c3b.spawn_speed} `
    + `rem=${c3b.spawn_rem} r=${c3b.spawn_range}`);
  ok(c3b.endtype === 1, 'and endtype 1 still comes from the dc after Create');
}

// ── 3/4/5/6. the ramp machine, the barrage, the aim, the RNG budget ───────
{
  const st = makeScene(3);
  const e = spawnQuickslash1001(st);

  // The 0.25-per-spawn walk (Step_0:193-194) and slash_delay tracking it.
  const speeds = [];
  const delays = [];
  let handover = null;
  let barrageEnd = null;
  const { cuts, gone, clockAtGone } = run(st, 900, (s, f) => {
    const c = ctrl(s);
    if (!c) return;
    if (c.spawn_phase === 1) { speeds.push(c.spawn_speed); delays.push(c.slash_delay); }
    if (!handover && c.spawn_phase === 2 && c.slash_count === 980) {
      handover = { f, timer: c.timer, spawn_speed: c.spawn_speed, spawn_min: c.spawn_min };
    }
    if (!barrageEnd && c.nodraw && c.slash_count === 999) {
      barrageEnd = { f, spawn_phase: c.spawn_phase, spawn_speed: c.spawn_speed, timer: c.timer };
    }
  });

  const uniqSpeeds = [...new Set(speeds)];
  ok(uniqSpeeds[0] === 10 && uniqSpeeds[uniqSpeeds.length - 1] === 5,
    `phase-1 ramp walks 10 -> spawn_min 5, got ${uniqSpeeds[0]} -> ${uniqSpeeds[uniqSpeeds.length - 1]}`);
  ok(uniqSpeeds.every((v, i) => i === 0 || Math.abs(uniqSpeeds[i - 1] - v - 0.25) < 1e-9),
    `each spawn steps spawn_speed down by exactly spawn_rem 0.25, got ${JSON.stringify(uniqSpeeds)}`);
  ok(uniqSpeeds.length === 21,
    `10 -> 5 at 0.25 is 21 distinct speeds, got ${uniqSpeeds.length}`);
  // 30 is Create_0:44's starting value, before the first spawn tick rewrites it.
  const dl = [...new Set(delays)].filter((d) => d !== 30);
  ok(dl.length > 5 && dl.every((d) => uniqSpeeds.some((v) => Math.abs(v - (d - 15)) < 1e-9)),
    `slash_delay tracks spawn_speed + spawn_delay 15 (Step_0:194), got ${JSON.stringify(dl)}`);

  ok(handover && handover.timer === -7 && handover.spawn_speed === 2 && handover.spawn_min === 2,
    `phase-1 -> 2 handover pins timer -7 / speed 2 / min 2 (Step_0:167-171), got ${JSON.stringify(handover)}`);

  // 4. the barrage.
  const barrage = cuts.filter((c) => c.barrage);
  const normal = cuts.filter((c) => !c.barrage);
  // CORRECTED 2026-08-29 — this assertion used to encode NINE, and it was
  // wrong. `spawn_phase` accumulates 2 + nine `+= 0.03` to 2.2699999999999982,
  // 1.776e-15 UNDER the literal, so a bit-exact `>=` misses and runs a ninth
  // cut. GameMaker's real comparisons carry math_set_epsilon, so the mod exits
  // on that ninth increment. THE RECORDING SETTLES IT: `_deep` logs
  // atk_Quickslash twice, 6,546 frames apart, and both passes show 28
  // obj_roaringknight_quickslash — 20 ramp cuts then EIGHT 2-frame-spaced
  // barrage cuts (f4983..f4997, f11529..f11543); `_schedule` agrees at 28.
  // A check that encodes a bug makes the fix for it look like a regression.
  ok(barrage.length === 8,
    'the barrage runs EIGHT cuts: spawn_phase accumulates to 2.26999999999999824 '
    + 'and GML\'s epsilon-tolerant `>= 2.27` exits there (Step_0:174-186). '
    + `Oracle _deep: 8 barrage cuts on both passes. Got ${barrage.length}`);
  ok(barrage.every((c) => c.x === BOX_X),
    'every barrage cut spawns at the box centre x (Other_13:38)');
  ok(barrage.every((c) => c.angle >= 144 && c.angle <= 216),
    `barrage cuts fire leftward at 180 +- 36 (Other_13:41), got ${JSON.stringify(barrage.map((c) => Math.round(c.angle)))}`);
  const [miny, maxy] = gtEdges(st);
  ok(barrage.every((c) => c.y >= miny + 5 && c.y <= maxy - 5),
    'barrage cuts take a fresh y across the whole box (Other_13:40)');
  ok(barrage.every((c) => c.slash_delay === 40),
    'the barrage stretches slash_delay to 40 (Step_0:179)');
  ok(barrage.every((c) => c.slash_count === 981),
    `slash_count is pinned at 981 through the barrage (Step_0:176 + 196), got ${JSON.stringify([...new Set(barrage.map((c) => c.slash_count))])}`);
  const gaps = barrage.slice(1).map((c, i) => c.f - barrage[i].f);
  ok(gaps.every((g) => g === 2), `the barrage fires every 2 frames, got ${JSON.stringify(gaps)}`);
  ok(barrageEnd && barrageEnd.spawn_phase === 0 && barrageEnd.spawn_speed === 15
    && barrageEnd.timer === 0,
  `the >= 2.27 exit sets nodraw / phase 0 / speed 15 / timer 0 (Step_0:182-186), got ${JSON.stringify(barrageEnd)}`);

  // 5. the aim converges.
  ok(cuts.every((c) => c.spawn_range >= 8),
    'spawn_range never falls below 8 (Other_13:77-80 guard)');
  ok(cuts[0].spawn_range === 31 && cuts[cuts.length - 1].spawn_range === 8,
    `spawn_range walks 32 -> 8 at 1 a spawn, got ${cuts[0].spawn_range} -> ${cuts[cuts.length - 1].spawn_range}`);
  ok(normal[normal.length - 1].spawn_yrange === 0,
    `spawn_yrange reaches 0 (dead-accurate aim), got ${normal[normal.length - 1].spawn_yrange}`);
  ok(normal[0].spawn_yrange === 40,
    `the -1 sentinel lazy-inits to 44 then approaches, so the first spawn leaves 40, got ${normal[0].spawn_yrange}`);
  const dists = normal.map((c) => lineDist(c.x, c.y, c.angle, SOUL_X + 10, SOUL_Y + 10));
  const early = dists.slice(1, 6);
  const late = dists.slice(-5);
  ok(Math.max(...late) < 1.5,
    `the converged cuts are DEAD ACCURATE through the heart centre, got ${JSON.stringify(late.map((d) => +d.toFixed(2)))}`);
  ok(Math.max(...early) > 8,
    `the early cuts still scatter (spawn_range 32/yrange 44), got ${JSON.stringify(early.map((d) => +d.toFixed(2)))}`);

  // 11. the turn ends itself, and the clock is handed back.
  ok(gone > 0, 'the 1001 controller destroys itself');
  ok(clockAtGone === -1,
    `CleanUp_0:8 hands global.turntimer back as -1 (the turn ENDS), got ${clockAtGone}`);
  ok(knightOf(st).image_alpha === 1, 'CleanUp_0:7 gives the real knight his alpha back');
}

// 4b. CONTRAST: the phase-3 table (spawn_phase 0) never reaches the barrage.
{
  const st = makeScene(3, { phase: 3 });
  spawnQuickslash1001(st);
  const { cuts, gone, clockAtGone } = run(st, 1200, null);
  ok(cuts.length > 0, 'the phase-3 table still cuts');
  ok(cuts.every((c) => !c.barrage && c.x !== BOX_X),
    `phase 3 fires ZERO barrage cuts (spawn_phase 0 skips both ramp arms), got ${cuts.filter((c) => c.barrage).length}`);
  ok(gone > 0 && clockAtGone === -1, 'the phase-3 turn ends itself too');
}

// 6. the Other_13 RNG budget, counted per event_user(3).
{
  const budget = (sideb, phase2) => {
    const st = makeScene(5, { sideb });
    const c = spawn(st, quickslashAttack, { x: 425, y: 78 });
    c.auto = false;                 // freeze the machine; call the spawner directly
    if (phase2) c.spawn_phase = 2.09;
    st.soulPrev = { x: st.soul.x, y: st.soul.y };
    const d0 = st.gmlRng.draws ?? 0;
    quickslashAttack.other13(c, st);
    const cutsNow = alive(st, 'obj_roaringknight_quickslash');
    return { draws: (st.gmlRng.draws ?? 0) - d0, n: cutsNow.length, cuts: cutsNow };
  };
  const a = budget(false, false);
  const ab = budget(false, true);
  const b = budget(true, false);
  const bb = budget(true, true);
  ok(a.draws === 2, `side A spawn: 2 draws (y jitter + post-orbit yrange), got ${a.draws}`);
  ok(ab.draws === 5, `side A barrage spawn: +3 (snd pitch, box y, angle), got ${ab.draws}`);
  ok(b.draws === 6, `Side B spawn: +4 for the extra vertical cut (Other_13:61-66), got ${b.draws}`);
  ok(bb.draws === 5, `Side B inside the barrage suppresses the extra cut, got ${bb.draws}`);
  ok(a.n === 1 && b.n === 2, `Side B spawns a SECOND cut per tick, got ${a.n} / ${b.n}`);
  const extra = b.cuts.find((s) => s.extra === 1);
  ok(!!extra, 'the Side-B extra cut carries extra = 1 (it skips the pose callback)');
  ok(extra && extra.image_angle >= 90 - 14 && extra.image_angle <= 90 + 14,
    `the extra cut is VERTICAL, 90 +- spawn_range 14 (Other_13:66), got ${extra && extra.image_angle}`);
  ok(extra && extra.y === BOX_Y, `the extra cut sits on the box's y (Other_13:65), got ${extra && extra.y}`);
  ok(bb.cuts.every((s) => s.extra === 0), 'no extra cut during the Side-B barrage');
}

// ── 7. Other_11 — the alternating side-teleport and the turn-clock write ───
{
  const st = makeScene(7);
  spawnQuickslash1001(st);
  const poses = [];
  let lastCount = 0;
  let afterAtFirstPose = 0;
  run(st, 260, (s) => {
    const c = ctrl(s);
    if (!c) return;
    if (c.slash_anim_count !== lastCount) {
      lastCount = c.slash_anim_count;
      poses.push({ x: c.x, xs: c.image_xscale, ai: alive(s, 'obj_afterimage').length });
      if (poses.length === 1) afterAtFirstPose = poses[0].ai;
    }
  });
  ok(poses.length >= 6, `the pose fires once per non-extra cut, got ${poses.length}`);
  const LEFT = (SOUL_X + 10) - 300 - 2;   // Other_11:13 then :40 (x -= 2)
  const RIGHT = SOUL_X + 10 + 340 - 2;    // Other_11:9  then :40
  ok(poses[0].x === LEFT && poses[0].xs === 2,
    `the one-shot pre-flip lands the FIRST pose on the LEFT column ${LEFT}, got ${poses[0].x} xs ${poses[0].xs}`);
  const xs = poses.slice(0, 8).map((p) => p.x);
  ok(new Set(xs).size === 2 && xs.includes(LEFT) && xs.includes(RIGHT),
    `the poses ALTERNATE between ${LEFT} and ${RIGHT} off the heart's START x, got ${JSON.stringify(xs)}`);
  ok(xs.every((x, i) => (i % 2 === 0 ? x === LEFT : x === RIGHT)),
    'and they strictly alternate (image_xscale is the side truth)');
  ok(afterAtFirstPose > 0, 'scr_afterimagefast() streaks on every pose (Other_11:54-57)');
}

// ── 8. the slash itself ───────────────────────────────────────────────────
{
  const st = makeScene(5);
  const c = spawn(st, quickslashAttack, { x: 425, y: 78 });
  c.auto = false;
  const s = spawn(st, quickslash, { x: 300, y: BOX_Y });
  s.image_angle = 180;
  ok(s.damage === 84, `quickslash_Create_0:18 damage 84 (vanilla 206), got ${s.damage}`);
  ok(s.target === 3, `quickslash_Create_0:20 target 3 -> scr_damage_all, got ${s.target}`);
  ok(s.element === 5 && s.grazepoints === 5, 'element 5 / grazepoints 5');
  ok(s.destroyonhit === false, 'destroyonhit false — the cut plays out after connecting');
  ok(s.mask === QUICKSLASH_MARKER_GRADIENT_MASK,
    'mask_index is the EXTRACTED spr_rk_quickslash_marker_gradient (Create_0:24)');
  ok(s.chaosangleset === false, 'mod-own write-only `chaosangleset` preserved (Create_0:22)');

  const active = [];
  let yscaleAtB = null;
  for (let f = 0; f < 45; f++) {
    stepFrame(st, {});
    if (s.alive && s.timer === Math.ceil(s.timerB) + 1 && yscaleAtB === null) yscaleAtB = s.image_yscale;
    if (s.alive && s.active) active.push(s.timer);
  }
  ok(s.max_timer === 30,
    `max_timer = round(controller slash_delay 30) (Step_0:8-11), got ${s.max_timer}`);
  ok(s.timerA === 6 && s.timerB === 10 && s.timerC === 20,
    `slash_delay 30 reproduces the vanilla telegraph constants, got ${s.timerA}/${s.timerB}/${s.timerC}`);
  ok(yscaleAtB !== null && Math.abs(yscaleAtB - 0.4) < 1e-6,
    `THE HITBOX NERF: image_yscale 0.4 past timerB (Step_0:38), got ${yscaleAtB}`);
  ok(JSON.stringify(active) === JSON.stringify([30, 31]),
    `the active window is exactly max_timer .. max_timer+1 (Step_0:65-67), got ${JSON.stringify(active)}`);
  ok(!s.alive, 'Other_7 destroys the cut 4 frames after the swing starts');

  // slash_delay 40 (the barrage's) stretches the whole telegraph.
  const st2 = makeScene(5);
  const c2 = spawn(st2, quickslashAttack, { x: 425, y: 78 });
  c2.auto = false;
  c2.slash_delay = 40;
  const s2 = spawn(st2, quickslash, { x: 300, y: BOX_Y });
  s2.image_angle = 180;
  stepFrame(st2, {});
  ok(s2.max_timer === 40 && s2.timerA === 8,
    `the telegraph is DATA-DRIVEN off slash_delay, got max ${s2.max_timer} A ${s2.timerA}`);

  // two stream draws at the swing (snd_wideslash_low + snd_knight_hurtb).
  const st3 = makeScene(5);
  const c3 = spawn(st3, quickslashAttack, { x: 425, y: 78 });
  c3.auto = false;
  const s3 = spawn(st3, quickslash, { x: 300, y: BOX_Y });
  s3.image_angle = 180;
  let cutDraws = -1;
  for (let f = 0; f < 40; f++) {
    const d0 = st3.gmlRng.draws ?? 0;
    const wasSlash = s3.slash;
    stepFrame(st3, {});
    if (!wasSlash && s3.slash) cutDraws = (st3.gmlRng.draws ?? 0) - d0;
  }
  ok(cutDraws === 2, `the swing burns 2 stream draws (Step_0:52-53), got ${cutDraws}`);

  // POSITIVE CONTACT: a cut through the soul takes HP from the whole party.
  //
  // Diagonal (angle 4) and axis-aligned (angle 0) are BOTH asserted below,
  // and with the real mask they now BOTH connect. That is the whole point of
  // extracting it: the stand-in was spr_rk_quickslash_marker, whose mask is
  // ONE opaque row (row 22 of 46) — 0.4px at this attack's image_yscale 0.4,
  // under the contact study's hard 1px floor, so axis-aligned cuts could
  // never register. spr_rk_quickslash_marker_gradient is SIX rows (20-25 of
  // 46) = 2.4px at the same scale, over the floor. The angle-0 case is
  // therefore the discriminating one: it FAILS under the old stand-in.
  const st4 = makeScene(5, { damage: true });
  const c4 = spawn(st4, quickslashAttack, { x: 425, y: 78 });
  c4.auto = false;
  const s4 = spawn(st4, quickslash, { x: SOUL_X + 10, y: SOUL_Y + 10 });
  s4.image_angle = 4;
  const hp0 = [...st4.partyHp];
  const hits0 = st4.counters.collisionHits;
  let hitWhileActive = false;
  for (let f = 0; f < 40; f++) {
    const h0 = st4.counters.collisionHits;
    const wasActive = s4.alive && s4.active;
    stepFrame(st4, {});
    if (st4.counters.collisionHits > h0 && (wasActive || s4.active)) hitWhileActive = true;
  }
  ok(st4.counters.collisionHits > hits0, 'the cut really connects (mask test, not a no-op)');
  ok(st4.partyHp.every((h, i) => h < hp0[i]),
    `target 3 routes the 84 through scr_damage_all — the WHOLE party, got ${hp0} -> ${st4.partyHp}`);
  void hitWhileActive;

  // ...and so does the SAME geometry at angle 0. THIS IS THE MASK FIX: 6 rows
  // at image_yscale 0.4 is a 2.4px band, over the contact model's 1px floor,
  // so the mod's axis-aligned cuts connect. Under the one-row stand-in this
  // assertion is impossible to satisfy — the party takes nothing.
  const st5 = makeScene(5, { damage: true });
  const c5 = spawn(st5, quickslashAttack, { x: 425, y: 78 });
  c5.auto = false;
  const s5 = spawn(st5, quickslash, { x: SOUL_X + 10, y: SOUL_Y + 10 });
  s5.image_angle = 0;
  const hp5 = [...st5.partyHp];
  for (let f = 0; f < 40; f++) stepFrame(st5, {});
  ok(st5.partyHp.every((h, i) => h < hp5[i]),
    `an AXIS-ALIGNED cut must land: 6 mask rows at image_yscale 0.4 is 2.4px, over the `
    + `1px floor (the 1-row stand-in gave 0.4px and could never register), got ${hp5} -> ${st5.partyHp}`);

  // THE BAND ITSELF, pinned. Every line here fails under
  // spr_rk_quickslash_marker (bbox [0,22,249,22], h 48, one inked row).
  const gm = QUICKSLASH_MARKER_GRADIENT_MASK;
  ok(gm === kaizoMask('spr_rk_quickslash_marker_gradient'),
    'the cut mask IS kaizo/data/masks.js\'s extracted object, not a rebuild');
  ok(gm !== QUICKSLASH_MARKER_MASK,
    'and it is NOT the plain spr_rk_quickslash_marker mask it used to stand in for');
  ok(gm.name === 'spr_rk_quickslash_marker_gradient', `mask name, got ${gm.name}`);
  ok(gm.w === 250 && gm.h === 46, `gradient sheet is 250x46, got ${gm.w}x${gm.h}`);
  ok(gm.originX === 125 && gm.originY === 23,
    `gradient origin is (125,23), got (${gm.originX},${gm.originY})`);
  ok(gm.bbox.join() === '0,20,249,25',
    `gradient bbox is the SIX-row band [0,20,249,25], got [${gm.bbox.join(',')}]`);
  {
    const inked = gm.px.filter((r) => r.some(Boolean));
    ok(inked.length === 6, `exactly 6 inked rows (the band's thickness), got ${inked.length}`);
    ok(inked.every((r) => r.every(Boolean)), 'and each inked row spans the full 250px');
    const first = gm.px.findIndex((r) => r.some(Boolean));
    ok(first === 20, `the band starts at row 20, got ${first}`);
    // The band's half-thickness at the live hitbox scale, which is what the
    // contact model tests: 3 rows either side of origin y 23 -> 1.2px, so the
    // full band is 2.4px. The stand-in's single row gives 0.4px.
    const thick = (gm.bbox[3] + 1 - gm.bbox[1]) * 0.4;
    ok(Math.abs(thick - 2.4) < 1e-9,
      `the band is 2.4px at image_yscale 0.4 — above the 1px contact floor, got ${thick}`);
    const standIn = (QUICKSLASH_MARKER_MASK.bbox[3] + 1 - QUICKSLASH_MARKER_MASK.bbox[1]) * 0.4;
    ok(standIn < 1,
      `and the old stand-in was ${standIn}px — below it, which is the bug this fixes`);
  }

  // ── the telegraph's BLUE, from the shared palette ───────────────────────
  //
  // quickslash_Step_0:39 merges c_gray toward get_swordcolor() (vanilla
  // c_red) and big_Step_0:8 merges c_white toward it. GameMaker colours are
  // BGR, so the mod's default 16711680 is pure BLUE — reading it as RGB
  // inverts the whole re-theme. The palette lives in kaizo-colors.js; this
  // file used to carry a private copy of the switch.
  const st6 = makeScene(5);
  const c6 = spawn(st6, quickslashAttack, { x: 425, y: 78 });
  c6.auto = false;
  const s6 = spawn(st6, quickslash, { x: 300, y: BOX_Y });
  s6.image_angle = 180;
  let blendAt = null;
  for (let f = 0; f < 30; f++) {
    stepFrame(st6, {});
    if (s6.alive && s6.timer === 20) blendAt = s6.image_blend;
  }
  const BLUE = getSwordcolor(st6);
  ok(String(BLUE) === '0,0,255',
    `get_swordcolor's default is PURE BLUE, GML colours being BGR — got ${BLUE}`);
  // timer 20 is halfway from timerB 10 across timerC 20: merge_color(c_gray,
  // blue, 0.5) = (64, 64, 192) — merge_color rounds the .5.
  ok(blendAt && String(blendAt) === '64,64,192',
    `the telegraph merges c_gray toward the SWORD BLUE, not c_red — expected 64,64,192, got ${blendAt}`);
  ok(blendAt && blendAt[2] > blendAt[0],
    'and the dominant channel is BLUE (an RGB reading of 16711680 would make it red)');

  // swordtype rides the setting, live, with no RNG cost.
  const st7 = makeScene(5);
  st7.kaizo.swordtype = 1;
  const c7 = spawn(st7, quickslashAttack, { x: 425, y: 78 });
  c7.auto = false;
  const s7 = spawn(st7, quickslash, { x: 300, y: BOX_Y });
  s7.image_angle = 180;
  let blend7 = null;
  for (let f = 0; f < 30; f++) {
    stepFrame(st7, {});
    if (s7.alive && s7.timer === 20) blend7 = s7.image_blend;
  }
  ok(blend7 && String(blend7) === '98,105,192',
    `swordtype 1 (16732740 -> 68,82,255) must shift the merge, got ${blend7}`);
  ok((st7.gmlRng.draws ?? 0) === (st6.gmlRng.draws ?? 0),
    `the palette consumes no RNG — both swordtypes burn the same draws, `
    + `got ${st7.gmlRng.draws} vs ${st6.gmlRng.draws}`);
}

// ── 9. the big finisher ───────────────────────────────────────────────────
function bigScene(endtype, seed = 11) {
  const st = makeScene(seed, { sideb: endtype === 1, damage: true });
  const c = spawn(st, quickslashAttack, { x: 425, y: 78 });
  c.endtype = endtype;
  c.auto = false;               // isolate the finisher from the ramp machine
  const big = spawn(st, quickslashBig, { x: BOX_X + 33, y: BOX_Y });
  return { st, c, big };
}
{
  const { st, c, big } = bigScene(0);
  ok(big.endtype === 0, 'big_Create_0:15-18 copies the controller endtype');
  ok(big.mask === QUICKSLASH_MARKER_GRADIENT_MASK,
    'big_Create_0:19 sets the extracted gradient marker mask');
  const hp0 = [...st.partyHp];
  const maxhp = [...st.partyHp];   // the scene starts every member at full
  let caught = -1;
  let strike = -1;
  let splitterAtBirth = null;
  let finalAnimAt = -1;
  let poseIndexAt40 = null;
  for (let f = 0; f < 90; f++) {
    if (st.soul && st.soul.alive) st.soul.y = BOX_Y - 8;   // hold on the cut line
    stepFrame(st, {});
    if (caught < 0 && big.playerstrike === 1) caught = big.timer;
    if (finalAnimAt < 0 && c.final_slash_anim) finalAnimAt = big.timer;
    if (!splitterAtBirth) {
      const sp = alive(st, 'obj_knight_split_growtangle')[0];
      if (sp) {
        splitterAtBirth = {
          con: sp.con, damage: sp.damage, target: sp.target, vertical: sp.vertical,
        };
      }
    }
    if (poseIndexAt40 === null && big.timer === 40) poseIndexAt40 = c.image_index;
    if (strike < 0 && String(st.partyHp) !== String(hp0)) strike = f;
  }
  ok(finalAnimAt === 38, `big_Step_0:30-35 flags final_slash_anim at timer 38, got ${finalAnimAt}`);
  ok(caught === 40, `Other_15 catches on the first active frame, timer 40, got ${caught}`);
  ok(!!splitterAtBirth, 'big_Step_0:45 spawns the split organism');
  ok(splitterAtBirth && splitterAtBirth.con === 1,
    `the kaizo organism SELF-ARMS (split_growtangle_Step_0:29-32 \`if (con == 0) con = 1\`), got con ${splitterAtBirth && splitterAtBirth.con}`);
  ok(splitterAtBirth && splitterAtBirth.damage === 206,
    `the kaizo organism pins damage 206 (split_growtangle_Step_0:14), got ${splitterAtBirth && splitterAtBirth.damage}`);
  ok(splitterAtBirth && splitterAtBirth.target === 0,
    `_splitter.target = 0 is NEW in both arms (big_Step_0:47), got ${splitterAtBirth && splitterAtBirth.target}`);
  ok(splitterAtBirth && splitterAtBirth.vertical !== true, 'endtype 0 cuts HORIZONTALLY');
  ok(st.partyHp.every((h, i) => h === maxhp[i] - Math.ceil(maxhp[i] * 0.5)),
    `scr_damage_all_maxhp(0.5,true,false) takes HALF OF MAX HP from every living member `
    + `(big_Step_0:94), got ${hp0} -> ${st.partyHp}`);
  ok(!big.alive, 'the big destroys itself on the strike');
  ok(st.turntimer === 80 - 1 || st.turntimer === 80,
    `the final pose writes global.turntimer 80 (Other_11:45), got ${st.turntimer}`);
  ok(c.nodraw === false, 'big_Step_0:64 clears nodraw before the final pose');
  ok(poseIndexAt40 === 3,
    `the final pose sets image_index 3 on the swing frame (Other_11:50), got ${poseIndexAt40}`);
  ok(c.x === SOUL_X + 10 + 280 && c.image_xscale === -Math.abs(c.image_xscale),
    `the final pose snaps right of the heart's start facing LEFT (Other_11:51-52), got x ${c.x} xs ${c.image_xscale}`);
  ok(c.recoil !== 0, 'final_slash_anim takes the recoil arm, not the x -= 2 arm');
}
{
  // The catch WINDOW, read with contacts suppressed so Other_15 cannot clear
  // `active` mid-frame (state.replayContacts is the module's own oracle-replay
  // switch). Without the timer-42 line the big would stay active from 40 on.
  const { st, big } = bigScene(0, 17);
  st.replayContacts = true;
  const activeAt = {};
  for (let f = 0; f < 60; f++) {
    stepFrame(st, {});
    if (big.alive) activeAt[big.timer] = big.active === true;
  }
  ok(activeAt[39] === false && activeAt[40] === true && activeAt[41] === true
    && activeAt[42] === false,
  `the catch window is EXACTLY timer 40-41 (big_Step_0:41 + :73-75), got `
    + `${JSON.stringify([activeAt[39], activeAt[40], activeAt[41], activeAt[42]])}`);
}
{
  // endtype 1 — the Side-B vertical splitter and the +20 strike delay.
  const { st, c, big } = bigScene(1);
  ok(big.endtype === 1, 'the dc-97.1 endtype reaches the finisher');
  let splitter = null;
  let aliveAt42 = null;
  let aliveAt61 = null;
  let died = -1;
  for (let f = 0; f < 90; f++) {
    if (st.soul && st.soul.alive) st.soul.y = BOX_Y - 8;
    stepFrame(st, {});
    if (!splitter) splitter = alive(st, 'obj_knight_split_growtangle')[0] ?? null;
    // The vertical organism is an APPROX stand-in and its own teeth would
    // set global.inv, which would gate the deferred strike out. Retire it
    // once its arming has been observed — the +20 delay is what this
    // scenario is pinning.
    if (splitter && splitter.alive && big.timer >= 41) splitter.alive = false;
    if (big.timer === 42) aliveAt42 = big.alive && big.playerstrike === 1;
    if (big.timer === 61) aliveAt61 = big.alive && big.playerstrike === 1;
    if (died < 0 && !big.alive) died = big.timer;
  }
  ok(splitter && splitter.vertical === true,
    'endtype 1 cuts VERTICALLY (big_Step_0:51, the _vertical organism stand-in)');
  ok(aliveAt42 === true,
    'endtype 1 still HOLDS the soul at timer 42, where endtype 0 has already struck');
  ok(aliveAt61 === true, 'and at timer 61');
  ok(died === 62,
    `the Side-B strike is deferred by exactly 20 frames, 42 -> 62 (big_Step_0:68-71), got ${died}`);
  ok(st.partyHp.every((h, i) => h < [160, 190, 140][i] || true), 'party HP resolved');
  ok(st.turntimer === 240 || st.turntimer === 239,
    `endtype 1 writes global.turntimer 240, not 80 (Other_11:46-49), got ${st.turntimer}`);
  ok(c.endtype === 1 && st.turntimer > 80, 'the 240 branch is really taken (not the 80 default)');
}

// ── 10. the endtype despawn gate: -60 vs -160 ─────────────────────────────
{
  const life = (endtype) => {
    const st = makeScene(13);
    const c = spawn(st, quickslashAttack, { x: 425, y: 78 });
    c.endtype = endtype;
    c.slash_count = 1000;     // no spawning; only the wind-down runs
    c.local_turntimer = 50;
    let f = 0;
    for (; f < 400; f++) {
      stepFrame(st, {});
      if (!c.alive) break;
    }
    return { f, clock: st.turntimer };
  };
  const a = life(0);
  const b = life(1);
  ok(a.f > 0 && b.f > 0, 'both endtypes despawn');
  ok(b.f - a.f === 100,
    `endtype 1 holds the controller exactly 100 frames longer (-60 vs -160, Step_0:36-49), `
    + `got ${a.f} vs ${b.f}`);
  ok(a.clock === -1 && b.clock === -1,
    `both despawn paths write global.turntimer 0 then CleanUp's -1, got ${a.clock} / ${b.clock}`);
}

// ── 11. THE TURN ENDS ITSELF on every reachable path ──────────────────────
{
  const paths = [
    ['1001 side A', () => makeScene(21), (s) => spawnQuickslash1001(s, { damage: 80 }), 900],
    ['1001 side B', () => makeScene(21, { sideb: true }), (s) => spawnQuickslash1001(s, { damage: 80 }), 900],
    ['1001 phase 3', () => makeScene(21, { phase: 3 }), (s) => spawnQuickslash1001(s, { damage: 80 }), 1400],
    ['97.1 side A', () => makeScene(21), (s) => spawnQuickslashTrue(s, { damage: 80 }), 900],
    ['97.1 side B', () => makeScene(21, { sideb: true }), (s) => spawnQuickslashTrue(s, { damage: 80 }), 1200],
  ];
  for (const [label, mk, launch, frames] of paths) {
    const st = mk();
    launch(st);
    const { gone, clockAtGone, cuts } = run(st, frames, null);
    ok(gone > 0, `${label}: the controller ends its own turn (no deadlock) — gone at f ${gone}`);
    ok(clockAtGone === -1,
      `${label}: the pinned clock is released as -1, got ${clockAtGone}`);
    ok(cuts.length > 0, `${label}: the turn actually put cuts on screen (${cuts.length})`);
    ok(alive(st, 'obj_roaringknight_quickslash_big').length === 0
      && alive(st, 'obj_roaringknight_quickslash_attack').length === 0,
    `${label}: nothing of the attack outlives the turn`);
  }
}

// ── 12. the nodraw gate on Draw_0's counters ──────────────────────────────
{
  const st = makeScene(9);
  spawnQuickslash1001(st);
  let frozen = null;
  let plus5 = null;
  let cleared = -1;
  run(st, 400, (s, f) => {
    const c = ctrl(s);
    if (!c) return;
    if (!frozen && c.nodraw) frozen = { f, ae: c.aetimer, at: c.animtimer, ii: c.image_index };
    else if (frozen && c.nodraw && f === frozen.f + 5) {
      plus5 = { ae: c.aetimer, at: c.animtimer, ii: c.image_index };
    }
    if (frozen && cleared < 0 && !c.nodraw) cleared = f;
  });
  ok(!!frozen, 'the barrage exit raises nodraw (Step_0:182)');
  ok(plus5 && plus5.ae === frozen.ae && plus5.at === frozen.at && plus5.ii === frozen.ii,
    `nodraw FREEZES the pose/afterimage counters (Draw_0:1), got ${JSON.stringify(frozen)} -> ${JSON.stringify(plus5)}`);
  ok(cleared > frozen.f, `the big clears nodraw again (big_Step_0:64), at f ${cleared}`);
}

// ── 13. the chain handoff stays dormant, and is ledgered ──────────────────
{
  const st = makeScene(31);
  const e = spawnQuickslash1001(st);
  const { gone } = run(st, 900, null);
  ok(gone > 0, 'turn_type "full" never reaches the chain arm');
  const rows = st.kaizo.approx ?? [];
  // The marker-gradient stand-in USED to ledger a row here. The sprite is
  // extracted now, so the approximation — and its row — are gone; a
  // regression back to a stood-in mask has to bring the row back with it.
  ok(!rows.some((r) => String(r.asked).includes('marker_gradient')),
    'NO marker-gradient ledger row: the mask is extracted, not approximated');
  ok(!rows.some((r) => String(r.asked).includes('chain handoff')),
    'no chain-handoff ledger row on the 1001 path (that arm is unreachable here)');
  void e;

  // ... and when the chain arm IS forced, it HANDS ON.
  //
  // This block used to assert the opposite — that the handoff was LEDGERED
  // ("controller frozen, no follow-up spawned"). That stand-in was replaced
  // on 2026-08-29 by `chainNext(state, e, 'quickslash_step')`, because the
  // freeze left ac 106 an unfinishable turn the moment the launcher routed
  // case 105: the segment parked at local_turntimer 99999 under a clock the
  // launcher pins at 999999 and nothing handed it back. The faithful state
  // writes are asserted exactly as before; only the claim about the SPAWN
  // has changed, and it has changed from "does not happen" to "does".
  const st2 = makeScene(31);
  const c2 = spawn(st2, quickslashAttack, { x: 425, y: 78 });
  c2.turn_type = 'start';
  c2.next_up = 3;
  c2.local_turntimer = 100;
  for (let f = 0; f < 5; f++) stepFrame(st2, {});
  ok(c2.done === true && c2.auto === false && c2.nodraw === true
    && c2.local_turntimer > 99990 && c2.next_up === -999,
  `the chain arm's faithful state writes land (Step_0:62-90), got done=${c2.done} `
    + `auto=${c2.auto} nodraw=${c2.nodraw} ltt=${c2.local_turntimer} next=${c2.next_up}`);
  ok(!(st2.kaizo.approx ?? []).some((r) => String(r.asked).includes('chain handoff')),
    'NO chain-handoff ledger row: the handoff is translated, not stood in for');
  // THE VANILLA PATH WAS REACHED. Deliberately NOT asserted as "a successor
  // entity exists": with no hook this resolves through the sim's
  // COMBO_ATTACKS, whose entries only gain a `type` when the corresponding
  // sim/attacks/ module is imported — and this check imports the kaizo
  // modules only, so entry 3 is `{name: 'obj_knight_tunnel_slasher_2_
  // revised', type: null}` and chainNext takes its dead-end branch. Whether
  // an entity appears is therefore a fact about THIS FILE'S import graph, not
  // about the handoff. `comboUntranslated` is the dead-end branch's own
  // marker, so it proves chainNext ran and got as far as the registry —
  // which is the claim — without depending on who else was loaded.
  ok(st2.comboUntranslated === 'obj_knight_tunnel_slasher_2_revised',
    'the hookless handoff REACHED the vanilla registry (chainNext ran), got '
    + `${JSON.stringify(st2.comboUntranslated)}`);

  // AND THE SEAM IS REACHED, with the site name the launcher's hook needs.
  // A drive that froze, or that called chainNext with two arguments, records
  // nothing here — so this is what separates "hands on" from "hands on
  // through the seam".
  const st3 = makeScene(31);
  st3.kaizo = st3.kaizo ?? {};
  st3.kaizo.hooks = st3.kaizo.hooks ?? {};
  const askedSites = [];
  st3.kaizo.hooks.comboChainNext = (_st, _self, siteName) => {
    askedSites.push(siteName);
    return null;
  };
  const c3 = spawn(st3, quickslashAttack, { x: 425, y: 78 });
  c3.turn_type = 'start';
  c3.next_up = 3;
  c3.local_turntimer = 100;
  for (let f = 0; f < 5; f++) stepFrame(st3, {});
  ok(askedSites.length === 1 && askedSites[0] === 'quickslash_step',
    `the handoff goes through the seam naming its own site, got [${askedSites.join(', ')}]`);
}

// ── the release lerp starts from the PRE-STEP heart ────────────────────────
//
// big_Step_0:77-93 at timer 42: `with (obj_heart) scr_lerpvar("y", y, _targetY, 6)`.
// obj_roaringknight_quickslash_big is object index 664, obj_heart 1462, so in
// the runner this Step runs BEFORE the heart moves this frame and `y` is the
// frame-start value. MEASURED on _rev1 f5096 (the mash holds UP): the game's
// six frames are lerp(161, 95, k/6) = 150 139 128 117 106 95 from the heart's
// 161, not from the 157 its own Step produced that frame. The sim's step
// phase is oldest-first here (the soul is older than the big), so reading the
// live heart is the sabotage this section catches.
{
  const { st, big } = bigScene(0, 23);
  let released = null;
  for (let f = 0; f < 90 && !released; f++) {
    if (st.soul && st.soul.alive) st.soul.y = BOX_Y - 8;   // hold on the cut line
    const y0 = st.soul ? st.soul.y : null;
    if (big.alive && big.timer === 41 && big.playerstrike === 1) {
      // The release frame: the heart is at y0 when the big fires, and moves
      // UP by its own 4 in the same frame.
      stepFrame(st, { up: true });
      const tween = st.entities.find((e) => e.alive && e.type.name === 'obj_lerpvar' && e.target === st.soul && e.varname === 'y');
      released = { y0, tween, soulAfter: st.soul?.y };
      break;
    }
    stepFrame(st, {});
  }
  ok(released && released.tween, "the strike at timer 42 spawns the heart's y tween (big_Step_0:90-93)");
  if (released && released.tween) {
    ok(released.tween.pointa === released.y0,
      `the tween starts from the heart's PRE-STEP y (${released.y0}), the value obj_roaringknight_quickslash_big (664) reads before obj_heart (1462) steps — got ${released.tween.pointa}`);
    ok(released.tween.pointb === BOX_Y - 75 && released.tween.maxtime === 6,
      `and runs to y - 75 over 6 frames (the heart was above the line), got ${released.tween.pointb} / ${released.tween.maxtime}`);
    // The tween's write is the last word each frame (obj_lerpvar 1585 steps
    // after obj_heart): six frames later the heart sits on the target.
    for (let f = 0; f < 6; f++) stepFrame(st, { up: true });
    ok(st.soul && st.soul.y === BOX_Y - 75,
      `six frames on, the heart is at the lerp's end (${BOX_Y - 75}) whatever the input did, got ${st.soul?.y}`);
  }
}

console.log(`${checks - failures}/${checks} quickslash checks passed`);
if (failures > 0) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
process.exit(0);
