#!/usr/bin/env node
// KAIZO swordfall (controller type 108) — positive assertions on every branch
// the kaizo module adds over sim/attacks/swordfall.js, plus the vanilla arms
// the copy retains. A check that passes with a branch deleted is vacuous, so
// each block below asserts what its branch CHANGES:
//
//   d0   — vanilla shape, but the aim clamp is the mod's ±20 (was ±40):
//          spawn frames/positions stay stream-identical with the sim module,
//          the recovered aim offset caps at 20, and at least one volley's raw
//          roll EXCEEDED 20 (the clamp visibly engaged).
//   d1   — vanilla arm the sim module never translated: TWO final swords.
//   d5   — ex=75 window, soul-column spawns, forced-vertical fast swords
//          (speed_gain 2 / speed_max 36, upward rate pinned to 0.2), the
//          14→8-by-0.4 cadence with GML banker's round, dead-but-consumed
//          RNG draws (total-draw accounting).
//   d10  — zero-RNG mirrored double-sweep (two seeds, byte-identical), the
//          ping-pong walker with the bounce nudge, B-Side _swinc/cadence,
//          fixed corner finals aimed at centre+36.
//   d11  — soul-tracking spawns, NO random(190) on the aim (total-draw
//          accounting), deterministic 29→25→21→17→13→9→8 cadence, ±48 final.
//   x vs xstart — the same three difficulties re-run with the soul PARKED off
//          its spawn column, which is the only way to tell `obj_heart.x`
//          (d11's rain, final and aim) from `obj_heart.xstart` (d5's rain and
//          final, d10's band). On a scene where the soul sits on its own
//          xstart those two reads are the same number.
//   mask — the 2px heart hurtbox is the EXTRACTED spr_dodgeheart_smaller_2px_mask
//          (kaizo/data/masks.js), asserted by IDENTITY with kaizoMask() and by
//          geometry: Precise, bbox [4,4,15,15], 100 inked pixels over 12 rows,
//          and the two heart lobes / the point. The old hand-built stand-in
//          used the ART sprite spr_dodgeheart_smaller_2px — an AxisAlignedRect
//          over [2,2,17,17], i.e. a square on the rectangle collision routine
//          — and every one of those assertions fails under it.
//   tint — get_swordcolor() on the swords (fallingsword Draw_0:1) and on the
//          sword-arm pose (swordfall Draw_0:6-8), the c_white reset that keeps
//          it off the attack pose (Step_0:11), swordtype 3 read live, and the
//          d0 draw budget UNCHANGED by any of it.
//   plus — the every-frame 2px heart-mask swap, the ac-102 weird-circle
//          freeze (gmlEq: 102.1 must NOT trigger it), turn_time as a plain
//          field (the ac-102 `with ... turn_time = 40` wiring, which is also
//          what lets the clock reach the freeze window at all), and the
//          module never writing the global turn clock (the 600 pin is the
//          launcher's line).
//
// Two module facts this file deliberately does NOT assert, because the branch
// makes them unobservable rather than because they are unchecked:
//   - GML `round()` is half-to-even and the module uses gmlRound, but d5's
//     countdowner walks 14, 13.6, 13.2, 12.8, 12.4, 12.0, ... and minus
//     irandom(1) never lands on an exact .5, so no tie is ever rounded.
//   - the d1 alarm aims from the sword's STORED f32 x/y (GML `with`
//     semantics) rather than the f64 creation locals; for these draws the
//     two agree to the last bit of the f32 image_angle.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission. Run: node kaizo/tools/checks/check-swordfall.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox, settleBox } from '../../../sim/battlebox.js';
import { HEART_RECT } from '../../../sim/masks.js';
import { BOX, SOUL_START, KNIGHT } from '../../../sim/actors.js';
import { gmlCreate, gmlRandom, gmlIrandom, gmlIrandomRange } from '../../../sim/rng.js';
import { clamp, pointDirection, gmlRound, WHITE } from '../../../sim/gml.js';
import { knightSwordfall as kaizoSwordfall, fallingSword as kaizoFallingSword, KAIZO_HEART_2PX_MASK } from '../../attacks/swordfall.js';
import { knightSwordfall as simSwordfall } from '../../../sim/attacks/swordfall.js';
import { kaizoMask } from '../../data/masks.js';
import { getSwordcolor } from '../../attacks/kaizo-colors.js';

const fail = [];
const check = (ok, msg) => { if (!ok) fail.push(msg); };
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol;
const fr = Math.fround;
/** What the f32 angle accessor stores: fround(((v % 360) + 360) % 360). */
const normStore = (v) => fr(((v % 360) + 360) % 360);

const cloneRng = (r) => ({ state: new Uint32Array(r.state), idx: r.idx, seed: r.seed });

const BOXC = { x: 320, y: 170 }; // settled box centre (f32-exact integers)
const HEART = { x: SOUL_START.x, y: SOUL_START.y }; // 314,162 — never moves here

/** A fake obj_knight_weird_circle for the ac-102 freeze test — alarms only. */
const fakeCircle = {
  name: 'obj_knight_weird_circle',
  create(e) {
    e.alarm[0] = 500;
    e.alarm[1] = 400;
  },
};

/**
 * WHY THE SWORDS ARE READ IN THE MOTION PHASE, NOT AT END OF FRAME.
 *
 * A bullet created during another object's Step is NOT in that phase's frozen
 * list, so it never steps on its birth frame — but `runMotion` (sim/index.js)
 * walks `state.entities` LIVE, so the newborn sword is moved once before the
 * frame ends. `speed = -4` along a 285-degree aim is a 1.035px x-shift and a
 * 3.86px y-shift, which is exactly the size of the aim clamp and the walker
 * step this file is trying to measure: reading `e.x` after stepFrame returns
 * compares the mod's arithmetic against a position the engine has already
 * changed. (It is also why the same reading made the d0 kaizo/sim position
 * diff "fail" — the two modules AIM differently, so their one motion step
 * differs, while the spawn coordinates are bit-identical.)
 *
 * A recorder entity spawned FIRST in the scene sits at index 0 of
 * `state.entities`, and `runMotion` calls each entity's `type.motion` hook as
 * it reaches it — so this hook runs before any sword further down the array is
 * moved. Every field below is therefore the value the GML `with` block left.
 *
 * ONE FIELD STILL CANNOT BE READ THAT WAY: `image_angle`. Swords thrown from
 * alarm[1] are created in the ALARM phase, so the obj_lerpvar their
 * `scr_lerpvar("image_angle", a, a + 360, 16)` creates IS in the step phase's
 * list and has already advanced the spin by one frame (CLAUDE.md, "A delayed
 * tween lands one frame earlier than it looks"). `direction` is written from
 * image_angle on the same line and nothing lerps it, so `dir` below is the
 * spawn aim — normalised to [0,360) by the built-in setter, which is where
 * point_direction already lives. Aim assertions use `dir`.
 */
function makeScene({ seed = 12345, difficulty = 0, sideb = false, currentAc = 10,
  turnTime, circles = 0, soulX, module = kaizoSwordfall } = {}) {
  const st = createState({ seed });
  st.view = { x: 0, y: 0 };
  st.gmlRng = gmlCreate(seed);
  st.kaizo = { sideb };
  st.currentAc = currentAc;
  st.turntimer = 600; // the launcher's type-108 pin (kaizo dbulletcontroller)
  st.damageEnabled = false; // record contact, keep the party alive

  const captured = [];
  const seen = new Set();
  let mg = null;
  const recorder = {
    name: 'check_spawn_recorder',
    motion(e, state) {
      for (const s of state.entities) {
        if (!s.alive || s.type.name !== 'obj_fallingsword' || seen.has(s.seq)) continue;
        seen.add(s.seq);
        captured.push({
          e: s,
          frame: state.frame,
          x: s.x,
          y: s.y,
          angle: s.image_angle,
          dir: s.direction,
          speed: s.speed,
          gain: s.speed_gain,
          smax: s.speed_max,
          grazepoints: s.grazepoints,
          xscale: s.image_xscale,
          nosfx: s.nosfx,
          // THE WIND-DOWN LATCH, not `countdown === 99999`: the finish sets
          // countdown AND local_turntimer to 99999 and then the Step keeps
          // decrementing both, so the literal 99999 is only true on the
          // trigger frame — eight frames before alarm[1] actually fires.
          // d5's wind-down sword also carries finalsword = false (kaizo
          // Alarm_1:98-117 never sets it), so the flag cannot classify it
          // either. > 90000 is true for the whole wind-down and for nothing
          // else (the longest real clock in the object is 324).
          final: mg ? mg.local_turntimer > 90000 : false,
          ltt: mg ? mg.local_turntimer : 0,
        });
      }
    },
  };
  spawn(st, recorder, { x: -9999, y: -9999, image_speed: 0 });

  settleBox(spawn(st, battlebox, { x: BOX.x, y: BOX.y }));
  st.soul = spawn(st, soul, { ...SOUL_START });
  st.soul.mask = HEART_RECT;
  // PARK THE SOUL OFF ITS SPAWN COLUMN. `xstart` is the creation coordinate
  // and is not rewritten, so this is the only way to tell `obj_heart.x` apart
  // from `obj_heart.xstart` — three of the mod's branches read one and three
  // read the other, and with the soul sitting on 314 the two are the same
  // number and every one of those assertions passes either way.
  if (soulX !== undefined) st.soul.x = soulX;
  const circleRefs = [];
  for (let i = 0; i < circles; i++) circleRefs.push(spawn(st, fakeCircle, { x: 320, y: 220 }));
  mg = spawn(st, module, { x: KNIGHT.x, y: KNIGHT.ystart });
  mg.difficulty = difficulty;
  module.init(mg, st);
  if (turnTime !== undefined) mg.turn_time = turnTime;
  return { st, mg, circleRefs, captured };
}

/**
 * Run a scene, recording every obj_fallingsword as the GML left it, plus the
 * pre-frame RNG snapshot for stream-replay assertions.
 */
function run(opts, frames = 420) {
  const scene = makeScene(opts);
  const { st, captured } = scene;
  const rngAt = new Map();
  for (let f = 0; f < frames; f++) {
    rngAt.set(st.frame, cloneRng(st.gmlRng));
    stepFrame(st, {});
  }
  for (const s of captured) s.rngBefore = rngAt.get(s.frame);
  scene.swords = captured;
  scene.step = captured.filter((s) => !s.nosfx && !s.final);
  scene.finals = captured.filter((s) => !s.nosfx && s.final);
  return scene;
}

/** tx recovered from a stored aim angle: where the sword points at row ty. */
function recoverTx(sx, sy, ang, ty) {
  const rad = (ang * Math.PI) / 180;
  return sx + ((ty - sy) / -Math.sin(rad)) * Math.cos(rad);
}

// ─────────────────────────────────────────── Create-event deltas (static)
{
  const { st, mg } = makeScene({ difficulty: 0 });
  check(mg.element === 5, `controller element must be 5 (kaizo Create_0:19), got ${mg.element}`);
  check(mg.turn_time === 160, 'turn_time default 160');
  check(mg.countdowner === 29 && mg.countdown === 45, 'vanilla countdown seeds kept');
  const s = spawn(st, kaizoFallingSword, { x: 0, y: 0 });
  check(s.speed_max === 18, `fallingsword speed_max default must be 18 (kaizo fallingsword Create_0:25), got ${s.speed_max}`);
  check(s.speed_gain === 0.4 && s.damage === 206 && s.element === 5
    && s.grazepoints === 12 && s.destroyonhit === 0,
  'fallingsword vanilla Create fields kept (gain 0.4, damage 206, element 5, graze 12, destroyonhit 0)');
}

// ──────────────────────────────── d0: vanilla stream, the ±20 aim clamp
{
  const kz = run({ seed: 12345, difficulty: 0 });
  const sim = run({ seed: 12345, difficulty: 0, module: simSwordfall });

  check(kz.step.length >= 10, `d0 must rain (got ${kz.step.length} step swords)`);
  check(kz.step.length === sim.step.length
    && kz.step.every((s, i) => s.frame === sim.step[i].frame),
  'd0 spawn FRAMES must match the sim module exactly (same RNG stream, same cadence)');
  check(kz.step.every((s, i) => s.x === sim.step[i].x && s.y === sim.step[i].y),
    'd0 spawn POSITIONS must match the sim module exactly (same draws)');

  // The mod's clamp: every aim offset within ±20 of the sword's own column,
  // the raw roll exceeding 20 at least once (so the branch is not vacuous),
  // and clamped swords pinned AT 20.
  let engaged = 0;
  for (const s of kz.step) {
    const r = cloneRng(s.rngBefore);
    gmlRandom(r, 30); gmlRandom(r, 220); // the spawn rolls, y then x (already checked)
    const raw = BOXC.x + 95 - gmlRandom(r, 190);
    const off = recoverTx(s.x, s.y, s.dir, BOXC.y + 110) - s.x;
    check(Math.abs(off) <= 20.001,
      `d0 f=${s.frame}: aim offset |${off.toFixed(4)}| must be <= 20 (KAIZO Step_0:139; vanilla was 40)`);
    if (raw < s.x - 20 || raw > s.x + 20) {
      engaged += 1;
      check(near(Math.abs(off), 20, 0.01),
        `d0 f=${s.frame}: raw roll ${raw.toFixed(2)} outside +-20 must clamp the offset to exactly 20, got ${off.toFixed(4)}`);
    }
  }
  check(engaged >= 1, `d0: no volley's raw aim roll exceeded +-20 in 420 frames (seed too tame to exercise the clamp) — engaged=${engaged}`);
  // ...and the sim module (±40) must actually AIM differently somewhere.
  const maxAngleDiff = Math.max(...kz.step.map((s, i) => {
    let d = Math.abs(s.dir - sim.step[i].dir);
    if (d > 180) d = 360 - d;
    return d;
  }));
  check(maxAngleDiff > 1,
    `d0: the +-20 clamp must visibly diverge from the sim's +-40 on engaged volleys (max angle diff ${maxAngleDiff.toFixed(4)} deg)`);

  // Vanilla d0 wind-down: ex = 0, so no spawn below local_turntimer 160.
  const minLtt = Math.min(...kz.step.map((s) => s.ltt));
  check(minLtt >= 160, `d0 min spawn local_turntimer ${minLtt} must be >= 160 (ex = 0)`);

  // One final sword, aimed at the box centre from the f64 locals (sim copy).
  check(kz.finals.length === 1, `d0 must throw exactly ONE final sword, got ${kz.finals.length}`);
  const f0 = kz.finals[0];
  check(f0.grazepoints === 30 && f0.e.finalsword === true && f0.xscale === 2,
    'd0 final sword: grazepoints 30, finalsword, xscale 2');

  // Total-draw accounting: 5 u32 per volley (220,30,190 + irandom(1)=2),
  // 2 for the final (110, 30). A skipped dead draw shows up here.
  const expect = kz.step.length * 5 + 2;
  check(st0draws(kz.st) === expect,
    `d0 total u32 draws must be ${expect} (5/volley + 2 final), got ${st0draws(kz.st)}`);

  // THE MODULE ENDS THE TURN WHEN THE MANAGER DIES, and this assertion used to
  // say the opposite.
  //
  // It read `Math.abs(turntimer - 600) < 20` under the comment "The module
  // never writes the global clock (the 600 pin is the launcher's)". That was a
  // true description of the translation and a false description of the game:
  // `gml_Object_obj_knight_swordfall_Destroy_0.gml` ends with
  // `global.turntimer = -1;`, byte-identical in the vanilla and kaizo dumps.
  // So the check PINNED THE BUG — a correct swordfall failed its own suite.
  //
  // The cost of the omission, measured in the whole-fight diff: `atk_Vortex1`
  // (ac 2 d5, which arms type 108) ran 622 frames in the sim against the mod's
  // 350. +272, the largest single divergence in the fight, with every later
  // turn inheriting the offset.
  //
  // Asserting -1 EXACTLY, not "near -1": it is a literal assignment, not an
  // accumulation, so a tolerance here could only hide a different write.
  check(kz.st.turntimer === -1,
    'the manager\'s Destroy must set state.turntimer to -1 — it is what ends the'
    + ` turn (obj_knight_swordfall Destroy_0), got ${kz.st.turntimer}`);

  // The every-frame heart-mask swap, and its re-application. IDENTITY, not a
  // name test: the mask must be the ONE extracted object, because underbox's
  // restoreHeartMask() and every cross-attack `soul.mask === ...` compare by
  // reference — three look-alike copies would pass a name test and fail those.
  check(kz.st.soul.mask === KAIZO_HEART_2PX_MASK,
    'soul mask must be the kaizo 2px mask while the controller lives');
}

function st0draws(st) { return st.gmlRng.draws ?? 0; }

// re-application mid-attack: something resets the mask, the next step wins it back
{
  const { st, mg } = makeScene({ difficulty: 0 });
  for (let f = 0; f < 5; f++) stepFrame(st, {});
  st.soul.mask = HEART_RECT;
  stepFrame(st, {});
  check(st.soul.mask === KAIZO_HEART_2PX_MASK,
    'the 2px mask swap is re-applied EVERY frame (kaizo Step_0:5-8), winning over a reset');
  check(mg.alive, 'manager still alive during the mask test');
}

// ───────── the 2px mask is the EXTRACTED sprite, not the art sprite
//
// This module used to hand-build the hurtbox from `spr_dodgeheart_smaller_2px`
// — the ART half of the pair — an AxisAlignedRect over [2,2]..[17,17]. That is
// a 16x16 SQUARE routed through the rectangle collision routine; the real
// `_mask` sprite is a Precise 12-row heart over [4,4]..[15,15]. Every
// assertion here fails under the old geometry, and the identity test fails
// under any private copy of the right geometry.
{
  const m = KAIZO_HEART_2PX_MASK;
  check(m === kaizoMask('spr_dodgeheart_smaller_2px_mask'),
    'the 2px mask must BE the extracted kaizo/data/masks.js object (one shared '
    + 'definition — underbox.js and knight-stream.js hold the same reference, '
    + 'which is what makes restoreHeartMask() recognise a swordfall stamp)');
  check(m.name === 'spr_dodgeheart_smaller_2px_mask',
    `2px mask name must be the _mask sprite, got ${m.name}`);
  check(m.w === 20 && m.h === 20 && m.originX === 0 && m.originY === 0,
    '2px mask must be 20x20 at origin (0,0)');
  const b = m.bbox;
  check(b[0] === 4 && b[1] === 4 && b[2] === 15 && b[3] === 15,
    `2px mask bbox must be [4,4,15,15] (spr_dodgeheart_smaller_2px_mask, extracted) — got [${b.join(',')}]`);
  check(!m.axisRect,
    'the extracted sprite is PRECISE — no axisRect, so it takes the precise '
    + 'sampler, not the rectangle routine the old rect stand-in forced');
  let solid = 0;
  let inkedRows = 0;
  for (const row of m.px) {
    const n = row.reduce((a, p) => a + (p ? 1 : 0), 0);
    solid += n;
    if (n) inkedRows += 1;
  }
  check(solid === 100, `2px mask must have 100 inked pixels (a heart, not a 256px square), got ${solid}`);
  check(inkedRows === 12, `2px mask must ink exactly 12 rows, got ${inkedRows}`);
  // The shape is a HEART, not any 12-row blob: row 4 is two separate lobes and
  // row 15 is a single 2px point. A rect of the same bbox fails both.
  const row4 = m.px[4].map((p) => (p ? '1' : '0')).join('');
  const row15 = m.px[15].map((p) => (p ? '1' : '0')).join('');
  check(row4 === '00000110000001100000', `2px mask row 4 must be the heart's two lobes, got ${row4}`);
  check(row15 === '00000000011000000000', `2px mask row 15 must be the heart's 2px point, got ${row15}`);
}

// ───────── the blue tint (was a deferred visual delta)
//
// kaizo fallingsword Draw_0:1 and swordfall Draw_0:6-8 assign
// image_blend = get_swordcolor(); kaizo Step_0:11 assigns c_white on the
// afterimage gate. Both are colour-only and neither may move the RNG stream.
{
  const probe = makeScene({ seed: 12345, difficulty: 0 });
  const BLUE = getSwordcolor(probe.st);
  check(BLUE[0] === 0 && BLUE[1] === 0 && BLUE[2] === 255,
    `the default swordcolor is PURE BLUE (GML colours are BGR), got ${BLUE}`);
  // Sampled WHILE swords are in the air — they fly off and die, so an
  // end-of-run scan finds none.
  let sworded = 0;
  let allBlue = true;
  for (let f = 0; f < 420; f++) {
    stepFrame(probe.st, {});
    for (const s of probe.st.entities) {
      if (!s.alive || s.type.name !== 'obj_fallingsword') continue;
      sworded += 1;
      if (s.image_blend !== BLUE) allBlue = false;
    }
  }
  check(sworded > 50, `tint check must see swords in the air (saw ${sworded} sword-frames)`);
  check(allBlue,
    'every falling sword carries get_swordcolor() on image_blend (kaizo fallingsword Draw_0:1)');

  // The setting rides state.kaizo.swordtype and the module must read it live
  // rather than bake a constant — swordtype 3 is the pale variant #9593FF.
  const kz3 = makeScene({ seed: 12345, difficulty: 0 });
  kz3.st.kaizo.swordtype = 3;
  let s3 = null;
  for (let f = 0; f < 80 && !s3; f++) {
    stepFrame(kz3.st, {});
    s3 = kz3.st.entities.find((e) => e.alive && e.type.name === 'obj_fallingsword'
      && e.image_blend !== undefined) ?? null;
  }
  check(s3 && String(s3.image_blend) === '149,147,255',
    `swordtype 3 must tint 149,147,255 (16749461 read BGR), got ${s3 && String(s3.image_blend)}`);

  // The tint costs NOTHING in the stream: same seed, same total draws as the
  // d0 accounting above (5/volley + 2 final). get_swordcolor is a pure switch.
  const kz = run({ seed: 12345, difficulty: 0 });
  check(st0draws(kz.st) === kz.step.length * 5 + 2,
    'the tint consumes no RNG — the d0 draw budget is unchanged');

  // The manager: blue ONLY on the sword-arm pose, and the Step's c_white
  // reset takes it back off once the pose swaps (kaizo Step_0:11 vs Draw_0:8).
  // The reset runs on `(global.time % 4) == 0`, so up to 3 frames of blue can
  // survive the swap — in the game as here; more than that is the stain.
  const sc = makeScene({ seed: 12345, difficulty: 0 });
  let armBlueFrames = 0;
  let stainedFrames = 0;
  let lastPoseBlend = null;
  for (let f = 0; f < 420; f++) {
    stepFrame(sc.st, {});
    if (!sc.mg.alive) break;
    if (sc.mg.sprite_index === 'spr_roaringknight_sword_ol') {
      if (String(sc.mg.image_blend) === String(BLUE)) armBlueFrames += 1;
    } else if (armBlueFrames > 0) {
      lastPoseBlend = sc.mg.image_blend;
      if (String(sc.mg.image_blend) === String(BLUE)) stainedFrames += 1;
    }
  }
  check(armBlueFrames > 5,
    `the knight arm pose (spr_roaringknight_sword_ol) must be tinted get_swordcolor() `
    + `(kaizo Draw_0:6-8) — saw ${armBlueFrames} blue arm frames`);
  check(stainedFrames > 0 && stainedFrames <= 3,
    `Step_0:11's c_white reset must wipe the blue within its 4-frame gate once the `
    + `pose swaps (saw ${stainedFrames} stained frames; > 3 means it never fires, `
    + `0 means the arm was never blue to begin with)`);
  check(lastPoseBlend === WHITE,
    `and the attack pose must end up c_white, not blue, got ${lastPoseBlend}`);
}

// ──────────────────────────────── d1: the vanilla arm the sim never had
{
  const kz = run({ seed: 777, difficulty: 1 });
  check(kz.step.length >= 10, `d1 must rain (got ${kz.step.length})`);

  // ex = 30: the rain must dip BELOW 160 but never below 130.
  const minLtt = Math.min(...kz.step.map((s) => s.ltt));
  check(minLtt < 160 && minLtt >= 130,
    `d1 min spawn local_turntimer must sit in [130,160) (ex = 30), got ${minLtt}`);

  // Cadence: countdowner 29 -> approach 4 by 5 -> gaps 24,19,14,9,4,4... with
  // NO irandom jitter (countdown = countdowner).
  const gaps = kz.step.slice(1).map((s, i) => s.frame - kz.step[i].frame);
  const expected = [24, 19, 14, 9, 4, 4, 4, 4];
  check(expected.every((g, i) => gaps[i] === g),
    `d1 gap sequence must be ${expected.join(',')}..., got ${gaps.slice(0, 8).join(',')}`);

  // KAIZO Alarm_1:18-48 — TWO final swords, right-biased then left-biased,
  // both aimed at the box centre. (The sim module would throw its single d0
  // sword here — the arm exists in vanilla v105 but was never translated.)
  check(kz.finals.length === 2, `d1 must throw TWO final swords (kaizo Alarm_1:18-48), got ${kz.finals.length}`);
  if (kz.finals.length === 2) {
    const [a, b] = kz.finals;
    check(a.frame === b.frame, 'both d1 finals fire on the same alarm frame');
    // replay the alarm's four draws from the pre-frame snapshot
    const r = cloneRng(a.rngBefore);
    // y first: GML call arguments evaluate right-to-left (measured, see dropSword)
    const y1 = BOXC.y - 110 + gmlRandom(r, 30);
    const x1 = BOXC.x + 55 - gmlRandom(r, 40);
    const y2 = BOXC.y - 110 + gmlRandom(r, 30);
    const x2 = BOXC.x - 55 + gmlRandom(r, 40);
    check(a.x === fr(x1) && a.y === fr(y1) && b.x === fr(x2) && b.y === fr(y2),
      'd1 finals must replay the stream: random(30) then (x+55)-random(40), random(30) then (x-55)+random(40) -- y draws first');
    // `with (instance_create(...)) { image_angle = point_direction(x, y, ...) }`
    // reads the instance's STORED f32 x/y, so the aim is computed from
    // fr(x1)/fr(y1), not the f64 creation expressions.
    check(a.dir === normStore(pointDirection(fr(x1), fr(y1), BOXC.x, BOXC.y))
      && b.dir === normStore(pointDirection(fr(x2), fr(y2), BOXC.x, BOXC.y)),
    'd1 finals aim at the box centre from their STORED (f32) spawn position');
    check(a.e.finalsword && b.e.finalsword && a.grazepoints === 30 && b.grazepoints === 30,
      'd1 finals carry finalsword + grazepoints 30');
  }

  // draws: 3/volley (220, 30, 190 — no cadence irandom at d1) + 4 final.
  const expect = kz.step.length * 3 + 4;
  check(st0draws(kz.st) === expect,
    `d1 total u32 draws must be ${expect}, got ${st0draws(kz.st)}`);
}

// ──────────────────────────────── d5: fast verticals over the spawn column
{
  const kz = run({ seed: 4242, difficulty: 5 }, 460);
  check(kz.step.length >= 8, `d5 must rain (got ${kz.step.length})`);

  for (const s of kz.step) {
    check(s.dir === 270, `d5 f=${s.frame}: image_angle must be forced 270 (KAIZO Step_0:141-146), got ${s.dir}`);
    check(s.gain === 2 && s.smax === 36,
      `d5 f=${s.frame}: speed_gain 2 / speed_max 36 override, got ${s.gain}/${s.smax}`);
    check(Math.abs(s.x - (HEART.x + 10)) <= 100,
      `d5 f=${s.frame}: x must sit within xstart+10 +-100, got ${s.x}`);
    // full stream replay for the volley, dead draws included:
    const r = cloneRng(s.rngBefore);
    const y = BOXC.y - 110 + gmlRandom(r, 30); // y first: GML call arguments evaluate right-to-left (measured, see dropSword)
    gmlRandom(r, 220); // dead spawn x — must still be consumed, AFTER the y draw
    const xo = gmlIrandomRange(r, -100, 100);
    check(s.x === fr(HEART.x + 10 + xo) && s.y === fr(y),
      `d5 f=${s.frame}: spawn must replay random(30), random(220)*, irandom_range(-100,100) — * dead but consumed`);
  }

  // ex = 75: the rain runs past d1's floor, down to local_turntimer 85.
  const minLtt = Math.min(...kz.step.map((s) => s.ltt));
  check(minLtt < 130 && minLtt >= 85,
    `d5 min spawn local_turntimer must sit in [85,130) (ex = 75, KAIZO Step_0:54-57), got ${minLtt}`);

  // Cadence: clamp 29 -> 14, then approach 8 by 0.4, banker's-rounded minus
  // irandom(1) — replayed from each volley's snapshot.
  {
    let countdowner = 29;
    for (let i = 0; i + 1 < kz.step.length; i++) {
      const r = cloneRng(kz.step[i].rngBefore);
      gmlRandom(r, 30); gmlRandom(r, 220); gmlIrandomRange(r, -100, 100); gmlRandom(r, 190);
      if (countdowner > 14) countdowner = 14;
      countdowner = countdowner > 8 ? Math.max(8, countdowner - 0.4) : countdowner;
      const cd = gmlRound(countdowner - gmlIrandom(r, 1));
      const gap = kz.step[i + 1].frame - kz.step[i].frame;
      check(gap === cd,
        `d5 gap after volley ${i} must be round(countdowner - irandom(1)) = ${cd}, got ${gap}`);
    }
    check(kz.step.length >= 2, 'd5 cadence check must see at least two volleys');
  }

  // The speed law on a step sword: -4, then +0.2/frame while negative (the
  // _gain = 0.4 pin — with the vanilla formula and gain 2 the rate would be
  // NEGATIVE and the sword would run away), 2.6/frame once positive, capped
  // at exactly 36.
  {
    const target = kz.step[0].e;
    const speeds = [];
    // re-run a fresh scene to watch the first sword frame by frame
    const scene = makeScene({ seed: 4242, difficulty: 5 });
    let sword = null;
    for (let f = 0; f < 200 && (!sword || sword.alive); f++) {
      stepFrame(scene.st, {});
      if (!sword) {
        sword = scene.st.entities.find((e) => e.type.name === 'obj_fallingsword' && !e.nosfx && e.alive);
      }
      if (sword) speeds.push(sword.speed);
    }
    check(target !== undefined && speeds.length > 10, 'd5 speed probe found a sword');
    const deltas = speeds.slice(1).map((v, i) => v - speeds[i]);
    const upward = deltas.filter((d, i) => speeds[i] < -0.01 && speeds[i + 1] <= 0.01);
    // THE FIRST UPWARD DELTA IS ZERO, AND THAT IS THE MEASURED SHAPE. The sword is
    // born with alarm[0] = 1 in its Create and scr_approach runs only when the
    // alarm reads -1 (Step_0:41). An alarm reads 0 on the frame it fires and -1
    // the frame after (sim/entity.js runAlarms; kaizo_oracle_probe: spd -4.0 at
    // the end of f804 AND f805, -3.8 at f806), so the frame after birth moves at
    // full speed and the 0.2/frame approach begins one frame later. The old form
    // of this check pinned the sim's one-frame-early approach.
    check(upward.length >= 5 && near(upward[0], 0, 1e-3) && upward.slice(1).every((d) => near(d, 0.2, 1e-3)),
      `d5 upward rate: first delta 0 (the alarm reads 0 on its firing frame), then 0.2/frame (kaizo fallingsword Step_0:43-48), got [${upward.slice(0, 4).map((d) => d.toFixed(3)).join(',')}]`);
    check(deltas.some((d) => near(d, 2.6, 1e-3)),
      'd5 downward rate must be 0.6 + 2 = 2.6/frame');
    check(speeds.some((v) => v === 36),
      `d5 speed must cap at exactly 36 (speed_max), max seen ${Math.max(...speeds)}`);
    check(Math.max(...speeds) <= 36.0001, 'd5 speed must never exceed 36');
    check(Math.min(...speeds) >= -4.0001, 'd5 speed must never run below its -4 windup');
  }

  // The final: ONE sword, no finalsword flag (Create defaults stand), angle
  // 270, gain 2 / cap 36, xstart-anchored ±100.
  check(kz.finals.length === 1, `d5 throws one wind-down sword, got ${kz.finals.length}`);
  if (kz.finals.length === 1) {
    const f5 = kz.finals[0];
    check(f5.e.finalsword === false && f5.grazepoints === 12,
      'd5 final keeps Create defaults: NO finalsword, grazepoints 12 (kaizo Alarm_1:98-117)');
    check(f5.dir === 270 && f5.gain === 2 && f5.smax === 36,
      'd5 final is a forced-vertical fast sword');
    const r = cloneRng(f5.rngBefore);
    const y = BOXC.y - 110 + gmlRandom(r, 30); // y first: GML call arguments evaluate right-to-left (measured, see dropSword)
    gmlRandom(r, 220); // dead
    const xo = gmlIrandomRange(r, -100, 100);
    check(f5.x === fr(HEART.x + 10 + xo) && f5.y === fr(y),
      'd5 final replays random(30), random(220)*, irandom_range(-100,100)');
  }

  // draws: 7/volley (220,30 + irr=2 + 190 + irandom(1)=2) + 4 final.
  const expect = kz.step.length * 7 + 4;
  check(st0draws(kz.st) === expect,
    `d5 total u32 draws must be ${expect}, got ${st0draws(kz.st)}`);
}

// ──────────────────────────────── d10: the deterministic double-sweep
{
  const kz = run({ seed: 999, difficulty: 10 });
  check(st0draws(kz.st) === 0,
    `d10 must consume ZERO rng draws (KAIZO Step_0:74-119, Alarm_1:49-79), got ${st0draws(kz.st)}`);

  // two swords per volley, every volley, gap 12 (side A)
  const byFrame = new Map();
  for (const s of kz.step) byFrame.set(s.frame, (byFrame.get(s.frame) ?? 0) + 1);
  const volleys = [...byFrame.keys()].sort((a, b) => a - b);
  check([...byFrame.values()].every((n) => n === 2),
    'd10 spawns exactly TWO swords per volley');
  check(volleys.slice(1).every((f, i) => f - volleys[i] === 12),
    `d10 side-A cadence must be a flat 12, got ${volleys.slice(1).map((f, i) => f - volleys[i]).join(',')}`);

  // The walker: xp starts at -0.125, advances 0.25/volley, ping-pongs with
  // the +_swinc nudge; sword A tilts 285 (dr=1), the mirror 255. First pair
  // hand-computed: 164 + 300*(-0.125) = 126.5 / 464 - 300*(-0.125) = 501.5,
  // y = boxTop - 20 = 75.
  const heartXs = fr(HEART.x); // xstart, f32 (= 314)
  const boxL = heartXs - 150;
  const boxR = heartXs + 150;
  let xp = -0.125;
  let dr = 1;
  for (const f of volleys) {
    const pair = kz.step.filter((s) => s.frame === f).sort((a, b) => a.e.seq - b.e.seq);
    check(pair[0].x === fr(boxL + 300 * xp) && pair[1].x === fr(boxR - 300 * xp),
      `d10 volley f=${f}: walker positions must be ${fr(boxL + 300 * xp)}/${fr(boxR - 300 * xp)}, got ${pair[0].x}/${pair[1].x}`);
    check(pair[0].y === 75 && pair[1].y === 75, `d10 volley f=${f}: y must be box top - 20 = 75`);
    check(pair[0].dir === normStore(270 + 15 * dr) && pair[1].dir === normStore(270 + 15 * -dr),
      `d10 volley f=${f}: tilts must be 270+-15*dr, got ${pair[0].dir}/${pair[1].dir}`);
    xp += 0.125 * 2 * dr;
    if (xp > 1 || xp < 0) { xp += 0.125; dr = -dr; }
  }
  check(kz.step[0].x === 126.5 && kz.step[1].x === 501.5,
    `d10 first pair must sit at 126.5/501.5, got ${kz.step[0].x}/${kz.step[1].x}`);
  // the bounce actually happened inside the run (the walker branch is live)
  check(volleys.length >= 6, `d10 must run past the right-edge bounce (needs >= 6 volleys, got ${volleys.length})`);
  if (volleys.length >= 6) {
    const v6 = kz.step.filter((s) => s.frame === volleys[5]).sort((a, b) => a.e.seq - b.e.seq);
    check(v6[0].x === fr(164 + 300 * 1.25) && v6[0].dir === 255,
      `d10 volley 6 must carry the bounce nudge (xp 1.25 -> x 539, tilt flipped to 255), got x=${v6[0].x} ang=${v6[0].dir}`);
  }

  // finals: two fixed corner swords from OUTSIDE the box edges (scr_get_box 2
  // is LEFT, 0 is RIGHT — the delta spec's prose had them swapped), aimed at
  // box centre +36.
  check(kz.finals.length === 2, `d10 throws two finals, got ${kz.finals.length}`);
  if (kz.finals.length === 2) {
    const [a, b] = kz.finals.sort((p, q) => p.e.seq - q.e.seq);
    check(a.x === 165 && a.y === 135 && b.x === 475 && b.y === 135,
      `d10 finals at (left-80, top+40)=(165,135) and (right+80, top+40)=(475,135), got (${a.x},${a.y})/(${b.x},${b.y})`);
    check(a.dir === normStore(pointDirection(165, 135, 320, 206))
      && b.dir === normStore(pointDirection(475, 135, 320, 206)),
    'd10 finals aim at (centre, centre+36) = (320,206)');
    check(a.e.finalsword && b.e.finalsword && a.grazepoints === 30 && b.grazepoints === 30,
      'd10 finals carry finalsword + grazepoints 30');
  }

  // zero-RNG means seed-independent: a different seed must reproduce the run
  // byte for byte.
  const kz2 = run({ seed: 31337, difficulty: 10 });
  check(kz2.step.length === kz.step.length
    && kz2.step.every((s, i) => s.frame === kz.step[i].frame
      && s.x === kz.step[i].x && s.y === kz.step[i].y && s.angle === kz.step[i].angle),
  'd10 must be identical under a different seed (zero RNG in the branch)');
}

// d10 B-Side: _swinc 0.08, cadence 9
{
  const kz = run({ seed: 999, difficulty: 10, sideb: true });
  const frames = [...new Set(kz.step.map((s) => s.frame))].sort((a, b) => a - b);
  check(frames.slice(1).every((f, i) => f - frames[i] === 9),
    `d10 B-Side cadence must be a flat 9 (12 - sideb*3), got ${frames.slice(1).map((f, i) => f - frames[i]).slice(0, 6).join(',')}`);
  const first = kz.step.filter((s) => s.frame === frames[0]).sort((a, b) => a.e.seq - b.e.seq);
  check(first[0].x === fr(164 + 300 * -0.08) && first[1].x === fr(464 - 300 * -0.08),
    `d10 B-Side first pair must use _swinc 0.08 (x ${fr(164 + 300 * -0.08)}/${fr(464 - 300 * -0.08)}), got ${first[0].x}/${first[1].x}`);
  check(st0draws(kz.st) === 0, 'd10 B-Side also consumes zero draws');
}

// turn_time is a PLAIN field the launcher can set (the ac-102 dispatch's
// `with (obj_knight_swordfall) turn_time = 40`): at 40 the rain runs on to
// local_turntimer 40 instead of stopping at 160.
{
  const kz = run({ seed: 999, difficulty: 10, turnTime: 40 }, 460);
  const minLtt = Math.min(...kz.step.map((s) => s.ltt));
  check(minLtt < 60 && minLtt >= 40,
    `turn_time=40 must extend the rain to local_turntimer ~40 (got min ${minLtt}); default d10 stops at >= 160`);
  const def = run({ seed: 999, difficulty: 10 });
  const minDef = Math.min(...def.step.map((s) => s.ltt));
  check(minDef >= 160, `default d10 rain must stop at local_turntimer >= 160, got ${minDef}`);
  check(kz.step.length > def.step.length,
    'turn_time=40 must yield strictly more volleys than the default 160');
}

// ──────────────────────────────── d11: soul-tracking rain
{
  const kz = run({ seed: 2026, difficulty: 11 });
  check(kz.step.length >= 8, `d11 must rain (got ${kz.step.length})`);

  for (const s of kz.step) {
    check(Math.abs(s.x - (HEART.x + 10)) <= 24,
      `d11 f=${s.frame}: x must track the soul (+10 +-24), got ${s.x}`);
    // aim at the soul's centre, computed AFTER the x overwrite
    check(s.dir === normStore(pointDirection(s.x, s.y, HEART.x + 10, HEART.y + 10)),
      `d11 f=${s.frame}: aim must point at (heart+10, heart+10) from the overwritten x`);
    // stream replay — random(220) dead, random(30), irandom_range(-24,24),
    // and NO random(190):
    const r = cloneRng(s.rngBefore);
    const y = BOXC.y - 110 + gmlRandom(r, 30); // y first: GML call arguments evaluate right-to-left (measured, see dropSword)
    gmlRandom(r, 220);
    const xo = gmlIrandomRange(r, -24, 24);
    check(s.x === fr(HEART.x + 10 + xo) && s.y === fr(y),
      `d11 f=${s.frame}: spawn must replay random(30), random(220)*, irandom_range(-24,24)`);
  }

  // cadence: 45 to the first volley, then 25,21,17,13,9,8,8... (approach 8
  // by 4, no jitter — KAIZO Step_0:178-182).
  const gaps = kz.step.slice(1).map((s, i) => s.frame - kz.step[i].frame);
  const expected = [25, 21, 17, 13, 9, 8, 8];
  check(expected.every((g, i) => gaps[i] === g),
    `d11 gap sequence must be ${expected.join(',')}..., got ${gaps.slice(0, 7).join(',')}`);

  // draws: 4/volley (220, 30, irr(-24,24)=2 — NO 190) + 4 for the final
  // (110 dead, 30, irr(-48,48)=2). If the module consumed random(190) at
  // d11 this total shifts and the replay above desyncs.
  const expect = kz.step.length * 4 + 4;
  check(st0draws(kz.st) === expect,
    `d11 total u32 draws must be ${expect} (no random(190) on the aim), got ${st0draws(kz.st)}`);

  // the final: one soul-tracking sword, ±48.
  check(kz.finals.length === 1, `d11 throws one final, got ${kz.finals.length}`);
  if (kz.finals.length === 1) {
    const f11 = kz.finals[0];
    const r = cloneRng(f11.rngBefore);
    const y = BOXC.y - 110 + gmlRandom(r, 30); // y first: GML call arguments evaluate right-to-left (measured, see dropSword)
    gmlRandom(r, 110); // dead
    const xo = gmlIrandomRange(r, -48, 48);
    check(f11.x === fr(HEART.x + 10 + xo) && f11.y === fr(y),
      'd11 final replays random(110)*, random(30), irandom_range(-48,48)');
    check(f11.dir === normStore(pointDirection(f11.x, f11.y, HEART.x + 10, HEART.y + 10)),
      'd11 final aims at the soul centre from its overwritten x');
    check(f11.e.finalsword && f11.grazepoints === 30, 'd11 final carries finalsword + grazepoints 30');
  }
}

// ───────── obj_heart.x vs obj_heart.xstart, told apart by moving the soul
//
// THREE branches read the LIVE soul column (d11's rain and its final, and
// d11's aim) and THREE read the SPAWN column (d5's rain, d5's final, d10's
// 300px band). On the default scene the soul sits exactly on its own xstart,
// so `x` and `xstart` are the same number and not one of those six
// assertions can tell which field the module read — swapping them passes.
// Parking the soul 36px right of its spawn column separates them.
{
  const OFF = 350;
  const XS = fr(SOUL_START.x); // xstart, never rewritten
  const SY = SOUL_START.y;
  check(OFF !== XS, 'the displaced-soul scenario must actually displace the soul');

  // d11 — obj_heart.x (KAIZO Step_0:125, Alarm_1:84-85)
  const k11 = run({ seed: 2026, difficulty: 11, soulX: OFF });
  check(k11.st.soul.x === OFF && k11.st.soul.xstart === XS,
    `d11 displaced scene: soul must sit at ${OFF} with xstart ${XS}, got ${k11.st.soul.x}/${k11.st.soul.xstart}`);
  check(k11.step.length >= 8, `d11 (displaced) must rain (got ${k11.step.length})`);
  for (const s of k11.step) {
    const r = cloneRng(s.rngBefore);
    gmlRandom(r, 220);
    gmlRandom(r, 30);
    const xo = gmlIrandomRange(r, -24, 24);
    check(s.x === fr(OFF + 10 + xo),
      `d11 f=${s.frame}: x must follow the LIVE obj_heart.x (${fr(OFF + 10 + xo)}), not xstart (${fr(XS + 10 + xo)}), got ${s.x}`);
    check(s.dir === normStore(pointDirection(s.x, s.y, OFF + 10, SY + 10)),
      `d11 f=${s.frame}: aim must track the displaced soul, not its spawn column`);
  }
  check(k11.finals.length === 1, `d11 (displaced) throws one final, got ${k11.finals.length}`);
  if (k11.finals.length === 1) {
    const f = k11.finals[0];
    const r = cloneRng(f.rngBefore);
    gmlRandom(r, 110);
    gmlRandom(r, 30);
    const xo = gmlIrandomRange(r, -48, 48);
    check(f.x === fr(OFF + 10 + xo),
      `d11 final must follow the LIVE obj_heart.x, expected ${fr(OFF + 10 + xo)}, got ${f.x}`);
  }

  // d5 — obj_heart.xstart (KAIZO Step_0:129, Alarm_1:101)
  const k5 = run({ seed: 4242, difficulty: 5, soulX: OFF }, 460);
  check(k5.step.length >= 8, `d5 (displaced) must rain (got ${k5.step.length})`);
  for (const s of k5.step) {
    const r = cloneRng(s.rngBefore);
    gmlRandom(r, 220);
    gmlRandom(r, 30);
    const xo = gmlIrandomRange(r, -100, 100);
    check(s.x === fr(XS + 10 + xo),
      `d5 f=${s.frame}: x must sit on the SPAWN column xstart+10 (${fr(XS + 10 + xo)}), not the live soul (${fr(OFF + 10 + xo)}), got ${s.x}`);
  }
  check(k5.finals.length === 1, `d5 (displaced) throws one final, got ${k5.finals.length}`);
  if (k5.finals.length === 1) {
    const f = k5.finals[0];
    const r = cloneRng(f.rngBefore);
    gmlRandom(r, 220);
    gmlRandom(r, 30);
    const xo = gmlIrandomRange(r, -100, 100);
    check(f.x === fr(XS + 10 + xo),
      `d5 final must sit on xstart+10, expected ${fr(XS + 10 + xo)}, got ${f.x}`);
  }

  // d10 — the 300px band is centred on obj_heart.xstart (KAIZO Step_0:86-87)
  const k10 = run({ seed: 999, difficulty: 10, soulX: OFF });
  const boxL = XS - 150;
  const boxR = XS + 150;
  const frames10 = [...new Set(k10.step.map((s) => s.frame))].sort((a, b) => a - b);
  check(frames10.length >= 6, `d10 (displaced) must run several volleys, got ${frames10.length}`);
  let xp = -0.125;
  let dr = 1;
  for (const f of frames10) {
    const pair = k10.step.filter((s) => s.frame === f).sort((a, b) => a.e.seq - b.e.seq);
    check(pair[0].x === fr(boxL + 300 * xp) && pair[1].x === fr(boxR - 300 * xp),
      `d10 f=${f}: the sweep band must stay centred on xstart ${XS} (${fr(boxL + 300 * xp)}/${fr(boxR - 300 * xp)}), not on the displaced soul, got ${pair[0].x}/${pair[1].x}`);
    xp += 0.125 * 2 * dr;
    if (xp > 1 || xp < 0) { xp += 0.125; dr = -dr; }
  }
}

// ──────────────────────────────── the ac-102 weird-circle freeze
{
  // currentAc = 102: once local_turntimer < 120 the circles' alarms pin at
  // 999 every frame; before that they tick down normally.
  //
  // THE SCENARIO HAS TO REACH THE WINDOW. With the default turn_time 160 the
  // Step's own finish fires at local_turntimer < 160 and slams the clock to
  // 99999 — so local_turntimer NEVER passes below 120 and the assertion below
  // measured 0 frames of 0 while reading as "no failure". ac 102 is precisely
  // the dispatch that does not leave turn_time alone: obj_knight_enemy
  // Other_23:504-507 runs `with (obj_knight_swordfall) turn_time = 40` when it
  // launches this attack on top of the underbox circles, which is what lets
  // the clock run down through the freeze window. The scene sets the same 40,
  // and the counters below assert the window was entered at all.
  const runFreeze = (ac) => {
    const scene = makeScene({
      seed: 5, difficulty: 10, currentAc: ac, circles: 2, turnTime: 40,
    });
    const { st, mg, circleRefs } = scene;
    let preTicks = 0;
    let pinned = 0;
    let inWindow = 0;
    for (let f = 0; f < 320; f++) {
      stepFrame(st, {});
      const ltt = mg.local_turntimer;
      if (ltt > 130 && ltt < 99999 && f > 2) {
        if (circleRefs.every((c) => c.alarm[0] < 500 && c.alarm[0] !== 999)) preTicks += 1;
      }
      if (ltt < 120 && ltt > 0 && ltt < 99999) {
        inWindow += 1;
        if (circleRefs.every((c) => c.alarm[0] === 999 && c.alarm[1] === 999)) pinned += 1;
      }
    }
    return { preTicks, pinned, inWindow, circleRefs };
  };

  const hot = runFreeze(102);
  check(hot.preTicks > 20,
    `ac 102: circle alarms must tick normally while local_turntimer >= 120 (saw ${hot.preTicks} such frames)`);
  check(hot.inWindow > 20,
    `ac 102 SCENARIO: the run must actually spend frames below local_turntimer 120 — otherwise the freeze assertion is vacuous (got ${hot.inWindow}); turn_time = 40 is what opens that window`);
  check(hot.pinned === hot.inWindow,
    `ac 102: both circle alarms must be pinned at 999 EVERY frame once local_turntimer < 120 (KAIZO Step_0:31-41) — ${hot.pinned}/${hot.inWindow}`);

  // currentAc = 102.1 must NOT trigger the freeze (gmlEq, not truncation —
  // the mod's 102.1 variant keeps its circles running). Same turn_time, so
  // the control passes through the SAME window the hot run froze in: a
  // control that never reached it would prove nothing.
  const cold = runFreeze(102.1);
  check(cold.inWindow > 20,
    `ac 102.1 CONTROL: must reach the same sub-120 window as the hot run (got ${cold.inWindow})`);
  check(cold.pinned === 0 && cold.circleRefs.every((c) => c.alarm[0] !== 999 && c.alarm[1] !== 999),
    'ac 102.1 must NOT freeze the circles (gmlEq(102.1, 102) is false)');
}

// ─────────────────────────────────────────────────────────── verdict
if (fail.length) {
  console.error(`check-swordfall: ${fail.length} FAILURE(S)`);
  for (const m of fail) console.error('  FAIL ' + m);
  process.exit(1);
}
console.log('check-swordfall: OK — d0/d1 vanilla arms (kaizo ±20 clamp), d5, d10 (+B-Side), d11, mask swap, ac-102 freeze, turn_time field all hold');
process.exit(0);
