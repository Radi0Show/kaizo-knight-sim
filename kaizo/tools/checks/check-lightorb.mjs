#!/usr/bin/env node
// KAIZO V-C obj_knight_lightorb + obj_knight_bullethell2 +
// obj_knight_bullethell_bullet2 — THE SIDE-B SUNBOLT SUB-ATTACK (ledger G-1).
//
// PUBLISH GATE: V-C recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 —
// do not publish without permission (kaizo/HANDOFF.md §5-C).
//
// What this pins. Every block asserts POSITIVELY, and each one fails if the
// branch it names is deleted:
//
//   L1  CREATE — timer 8, con 0, splitx 0, depth 0, and the two mod deltas:
//       `col = merge_color(c_white, get_swordcolor(), 0.2)` (vanilla merged
//       toward c_yellow, which would be a WARM colour — asserted as
//       blue-dominant, and asserted NOT to equal the vanilla merge), and
//       `type` from `kaizo_sideb()` rather than
//       `obj_knight_enemy.difficulty == 1` (so a non-sideb orb is type 0 and
//       NEVER splits, where vanilla's never split at all).
//   L2  THE WIND-UP runs in the DRAW slot: `timer` reaches 9 on the orb's
//       first drawn frame (Create leaves it at 8), snd_knight_stretch fires
//       at exactly timer 9, a screen shake is created every third frame,
//       darken_alpha ramps to 0.35 and then falls, and con flips 0 -> 1 on
//       timer 40 with the timer reset.
//   L3  THE SPLIT — type 1 only: splitx walks 0 -> 60 in sixes over timer
//       30..39, and the TWO obj_knight_bullethell2 emitters are created on
//       the con switch at x -+ 60. A type-0 orb creates neither.
//   L4  THE VOLLEY every ten con-1 frames: the three-way fan at the constant
//       speed 4.5, and the FIVE-way fan (72 degrees apart, speed in [5, 7))
//       when `obj_knight_enemy.difficulty == 0`. Under type 1 both mouths
//       fire, so a volley is 2x the bullets and `count` climbs by 2.
//   L5  DAMAGE — the bolt leaves the Draw carrying `damage = 166, target = 0`
//       and its own Other_15 REWRITES both to `target = 0, damage = 103`
//       before scr_damage, so the party loses 103 and not 166 (and not
//       vanilla's 206). This is the ledger's "166 damage each" corrected at
//       the source.
//   L6  THE MASK IS REGISTERED. spr_sunbolt has no entry in the engine's
//       SPRITE_MASKS and none in kaizo/data/masks.js, so a bolt without the
//       module's own mask would be SKIPPED by runCollisions
//       (`unmaskedBullets`) and be silently harmless. Asserted both ways: no
//       unmasked bullets, and a soul parked on a bolt actually takes the hit.
//   L6b …AND `e.mask` IS THE FIELD THAT CARRIES IT. Found by sabotage:
//       deleting the module's one `e.mask = SUNBOLT_MASK` left L6 green,
//       because `collides` names SUNBOLT_MASK directly. The SECOND reader is
//       sim/index.js's `grazes`, which resolves `e.mask ??
//       SPRITE_MASKS[sprite_index]` and consults no type override — so the
//       graze is what proves the field. A bolt beside the soul grazes; the
//       same bolt with `mask` dropped grazes nothing.
//   L7  THE MOD'S NEW FIRST-LINE GUARD (Draw_0:1-9). At `global.turntimer <
//       1` the whole Draw exits: the orb dies, BOTH emitters die, no bullet
//       is fired, and — the part that matters to the byte gate — NOT ONE u32
//       is drawn. Vanilla's copy of that destroy sits at :181, after the
//       volley block had already taken the frame's randoms.
//   L8  THE RNG BUDGET, counted exactly, as a WHOLE-SEQUENCE match rather
//       than a per-class average — the orb's first eighteen frames each cost
//       a different number and an `every(n === k)` filter cannot see that.
//       GML evaluates call arguments right-to-left; every random in a Draw is
//       a stream draw whether or not its particle is modelled; and
//       `instance_create` ALSO runs the created object's Create event, whose
//       rolls land inside the call. Reading only the arguments is what made
//       version one of the module 8 u32 short on every con-1 frame:
//         obj_knight_spark Create     6 u32 (irandom(3), 3x choose, random)
//         obj_knight_triangle Create  2 u32 (random(360), choose(-1, 1))
//         obj_knight_ring Create      0
//         obj_rouxls_power_up_orb     0 in Create; 1 in its own DRAW, one
//                                     frame later, at depth + 1 — so it lands
//                                     BEFORE the orb's own draws on that frame
//       The measured sequence, type 0 (one mouth):
//         t9            10  (spark 2+6, orb dir 2)
//         t10..t17      11  (+ the previous frame's power-up orb init)
//         t18            9  (that init, and the spark; timer < 18 is over)
//         t19..t39       8  (the spark alone)
//         con switch    20  (the con-0 block's 8 AND the con-1 block's 12 —
//                            two separate `if`s in one event)
//         con 1 ordinary 12 per mouth (triangle 2 + scales 2 + spark 2+6)
//         con 1 three-way 14 per mouth (+ the aim's irandom(4))
//         con 1 five-way  21 per mouth (+ irandom(60) + 5x random(2))
//       A type-1 orb doubles every con-1 figure: 24 ordinary, 42 five-way.
//       The DEAD `irandom(4)` at :103 is still drawn under the five-way arm,
//       where `irandom(60)` immediately overwrites its value.
//   L9  THE AIM WINDOW tightened from +-5 to +-2 (Draw_0:103). The three-way
//       arm's heading sits in [aim + 34, aim + 37] — vanilla's window was
//       [aim + 31, aim + 40].
//   L10 THE RETRO-THRUST — gravity_direction is direction + 180 and gravity
//       is speed / 90, then scr_lerpvar decays it to 0 over 30 frames, so
//       the bolt slows and then coasts.
//   L11 THE EMITTERS FIRE NOTHING. `repeat (3)` became `repeat (0)`: over
//       200 frames the pair creates zero obj_knight_bullethell_bullet, and
//       their `timer > 700` (vanilla 70) keeps them alive past frame 70.
//   L11b THE MOD'S NEW `_dir -= 180` FLIP IS DEAD, measured as a differential
//       rather than claimed: the same emitter is stepped by hand with the
//       soul above it and below it, and `lastDir` differs by exactly 180
//       while every other field it owns, the room's population and the stream
//       position come out identical.
//   L11c …and `lastDir` has no reader anywhere under kaizo/, sim/, render/ or
//       input/ except this file. Together with L11b that is the whole claim:
//       the flip changes one value, and nothing reads that value.
//   R1  THE RENDER REGISTRY'S ORDINAL COMMENTS match the registry's own key
//       order. Four of them were wrong before this block existed.
//
//     node kaizo/tools/checks/check-lightorb.mjs      exit 0 / 1

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createState, stepFrame } from '../../../sim/index.js';
import { spawn, destroy } from '../../../sim/entity.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { ensureSoul } from './scaffold-soul.mjs';
import { HEART_RECT, SPRITE_MASKS } from '../../../sim/masks.js';
import { mergeColor, WHITE } from '../../../sim/gml.js';
import {
  gmlCreate, gmlRandom, gmlIrandom, gmlChoose,
} from '../../../sim/rng.js';
import { getSwordcolor } from '../../attacks/kaizo-colors.js';
import {
  knightLightorb, knightBullethell2, knightBullethellBullet2,
  spawnLightorb, SUNBOLT_MASK,
} from '../../attacks/lightorb.js';
// The call site G-1 closed — imported so "the organism creates one" is
// asserted against the real caller rather than assumed.
import { spawnVerticalSplit } from '../../attacks/split-growtangle-vertical.js';
// The render registry, for R1 — the ordinal comments over its rows.
import { KAIZO_DRAW_OBJECTS } from '../../render/index.js';

/** The repo root — this file is kaizo/tools/checks/, three levels down. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

let failures = 0;
let checks = 0;

function assert(cond, label) {
  checks += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); }
}

function assertEq(got, want, label) {
  checks += 1;
  if (got !== want) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}

/**
 * A fight-shaped scene with the practice director removed so nothing
 * auto-launches — the shape check-split-growtangle-vertical uses.
 *
 * `difficulty` is passed onto obj_knight_enemy explicitly: the single-attack
 * scaffold leaves it undefined, and the volley's five-way arm reads
 * `obj_knight_enemy.difficulty == 0`. Leaving it undefined is what a scene
 * that never exercised the panic fan would look like, which is exactly the
 * hole this file exists to close.
 */
function scene({ seed = 12345, sideb = true, difficulty = undefined,
  soulX = 314, soulY = 300 } = {}) {
  const state = createState({ seed });
  buildSingleAttackScene(state, { seed, attack: 'combination', difficulty: 0 });
  ensureSoul(state);
  const dir = state.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  state.kaizo = { sideb, approx: [] };
  state.currentAc = 105.1;
  state.turntimer = 99999;
  state.soul.x = soulX;
  state.soul.y = soulY;
  state.soul.mask = HEART_RECT;
  const knight = state.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy');
  if (knight) knight.difficulty = difficulty;
  return { state, knight };
}

const alive = (state, name) => state.entities.filter((e) => e.alive && e.type.name === name);
const bolts = (state) => alive(state, 'obj_knight_bullethell_bullet2');
const emitters = (state) => alive(state, 'obj_knight_bullethell2');

// ── L1 — Create ────────────────────────────────────────────────────────────
{
  const { state } = scene({ sideb: true });
  const orb = spawnLightorb(state, 320, 160);
  assertEq(orb.type.name, 'obj_knight_lightorb', 'L1: the right object');
  assertEq(orb.timer, 8, 'L1: timer starts at 8, not 0 (Create_0:1)');
  assertEq(orb.con, 0, 'L1: con 0');
  assertEq(orb.siner, 0, 'L1: siner 0');
  assertEq(orb.count, 0, 'L1: count 0');
  assertEq(orb.radius, 120, 'L1: radius 120');
  assertEq(orb.circle_alpha, 0, 'L1: circle_alpha 0');
  assertEq(orb.darken_alpha, 0, 'L1: darken_alpha 0');
  assertEq(orb.splitx, 0, 'L1: splitx 0');
  // depth has NO instance default in this engine and `depth -= 100` on the
  // bolts would be NaN without it (kaizo/HANDOFF.md §8).
  assertEq(orb.depth, 0, 'L1: depth 0 (objects_kaizo.csv), set rather than left undefined');

  // THE MOD'S COLOUR DELTA. get_swordcolor() defaults to pure blue.
  const want = mergeColor(WHITE, getSwordcolor(state), 0.2);
  assertEq(orb.col.join(','), want.join(','),
    'L1: col = merge_color(c_white, get_swordcolor(), 0.2) (Create_0:9)');
  const vanilla = mergeColor(WHITE, [255, 255, 0], 0.2); // c_yellow
  assert(orb.col.join(',') !== vanilla.join(','),
    'L1: …and it is NOT vanilla\'s merge toward c_yellow');
  assert(orb.col[2] > orb.col[0] && orb.col[2] > orb.col[1],
    `L1: …the tint is blue-dominant, got ${orb.col.join(',')}`);

  // THE MOD'S TYPE GATE: kaizo_sideb(), not difficulty == 1.
  assertEq(orb.orbtype, 1, 'L1: kaizo_sideb() -> type 1 (Create_0:11-14)');
  assert(orb.type !== 1, 'L1: the GML `type` is renamed (the entity descriptor survives)');

  const off = scene({ sideb: false, difficulty: 1 });
  const orb0 = spawnLightorb(off.state, 320, 160);
  assertEq(orb0.orbtype, 0,
    'L1: NOT sideb -> type 0 even at obj_knight_enemy.difficulty 1 '
    + '(the vanilla gate is gone)');
}

// ── L2 — the wind-up, in the DRAW slot ─────────────────────────────────────
{
  const { state } = scene({ sideb: false });
  const orb = spawnLightorb(state, 320, 160);
  const shakesAt = [];
  const stretchAt = [];
  const darken = [];
  let conFlip = -1;
  // COUNTED BY IDENTITY, not by population: obj_shake lives about five
  // frames, so `entities.filter(...).length` never returns to 0 between
  // shakes and a rising-edge count silently misses two of every three.
  const seenShakes = new Set();
  for (let f = 0; f < 45; f += 1) {
    state.audioCues = [];
    const before = orb.con;
    stepFrame(state, {});
    for (const s of alive(state, 'obj_shake')) {
      if (!seenShakes.has(s.seq)) { seenShakes.add(s.seq); shakesAt.push(orb.timer); }
    }
    // `snd_play_x`, not `snd_stop` — cueStop pushes a row with the same name
    // and `stop: true`, and the con switch stops this very sound.
    if ((state.audioCues ?? []).some((c) => c.name === 'snd_knight_stretch' && !c.stop)) {
      stretchAt.push(f);
    }
    darken.push(Number(orb.darken_alpha.toFixed(4)));
    if (before === 0 && orb.con === 1 && conFlip < 0) conFlip = f;
  }

  // Create leaves timer at 8 and the first DRAW increments it: the object's
  // clock is one ahead of a step-driven one, which is the whole reason this
  // lives in the draw slot.
  assertEq(conFlip, 31, 'L2: con 0 -> 1 on the 32nd drawn frame (timer 8 -> 40)');
  assertEq(orb.timer, 14, 'L2: …and the timer restarted at 0 there (14 by frame 45)');
  assertEq(stretchAt.length, 1, 'L2: snd_knight_stretch plays exactly once (Draw_0:26-29)');
  assertEq(stretchAt[0], 0, 'L2: …on the frame timer reaches 9');
  // obj_shake SELF-DESTROYS when one is already running (sim/shake.js,
  // `instance_number(object_index) >= 2`), so counting SURVIVORS undercounts
  // the calls by more than half. `shakesAt` is the survivors — asserted only
  // for their timing — and `attempts` below counts the instance_creates.
  assert(shakesAt.length >= 5,
    `L2: shakes really reach the room (Draw_0:30-33), got ${shakesAt.length}`);
  assert(shakesAt.every((t) => t % 3 === 0),
    `L2: …and every survivor lands on a timer divisible by 3, got ${shakesAt.join(',')}`);
  assertEq(shakesAt[0], 9, 'L2: the first shake lands on timer 9');
  // darken_alpha ramps by 0.05 while timer < 15 (from 9, so 9..14 = 6 steps
  // capped by `< 0.35`), then falls by 0.1 from timer 16.
  assert(Math.max(...darken) >= 0.29 && Math.max(...darken) <= 0.35,
    `L2: darken_alpha ramps to ~0.3 and no further, peaked at ${Math.max(...darken)}`);
  assert(darken[darken.length - 1] < 0, 'L2: …then falls away (Draw_0:22-25)');
}

// ── L2b — the shake CADENCE, counted by call and not by survivor ───────────
{
  // Driving `draw()` by hand rather than through stepFrame keeps the reaper
  // out of it, so an obj_shake that self-destroyed on arrival (sim/shake.js:
  // one at a time) is still in `entities` to be counted. Through stepFrame
  // only about half survive, and a cadence of 3 is then indistinguishable
  // from a cadence of 6.
  const { state } = scene({ sideb: false });
  const orb = spawnLightorb(state, 320, 160);
  const at = [];
  let seen = 0;
  for (let f = 0; f < 31; f += 1) {
    knightLightorb.draw(orb, state);
    const n = state.entities.filter((e) => e.type.name === 'obj_shake').length;
    if (n > seen) { at.push(orb.timer); seen = n; }
  }
  assertEq(at.join(','), '9,12,15,18,21,24,27,30,33,36,39',
    'L2b: scr_shakescreen is called on EVERY third frame of the wind-up '
    + '(Draw_0:30-33) — eleven calls, timer 9 through 39');
}

// ── L3 — the split, and the two emitters ───────────────────────────────────
{
  const { state } = scene({ sideb: true });
  const orb = spawnLightorb(state, 320, 160);
  const walk = [];
  let emittersAt = -1;
  for (let f = 0; f < 40; f += 1) {
    stepFrame(state, {});
    walk.push(orb.splitx);
    if (emittersAt < 0 && emitters(state).length > 0) emittersAt = f;
  }
  assertEq(orb.splitx, 60, 'L3: splitx caps at 60 (Draw_0:67-70)');
  // Sixes, and only while timer is in 30..39 — a 10-frame window.
  const steps = walk.filter((v, i) => i > 0 && v !== walk[i - 1]);
  assertEq(steps.length, 10, `L3: exactly ten +6 steps, got ${steps.length}`);
  assert(steps.every((v, i) => v === (i + 1) * 6),
    `L3: …in sixes, got ${steps.join(',')}`);

  const em = emitters(state);
  assertEq(em.length, 2, 'L3: two obj_knight_bullethell2 (Draw_0:61-65)');
  assertEq(emittersAt, 31, 'L3: …created on the con switch, not before');
  const xs = em.map((e) => e.x).sort((a, b) => a - b);
  assertEq(xs.join(','), '260,380', 'L3: …at x -+ splitx (320 -+ 60)');
  assertEq(em[0].y, 160, 'L3: …on the orb\'s y');

  // A type-0 orb never splits and never makes an emitter.
  const off = scene({ sideb: false });
  const orb0 = spawnLightorb(off.state, 320, 160);
  for (let f = 0; f < 60; f += 1) stepFrame(off.state, {});
  assertEq(orb0.splitx, 0, 'L3: a type-0 orb never grows splitx');
  assertEq(emitters(off.state).length, 0, 'L3: …and creates no emitters');
}

// ── L4 — the volley ────────────────────────────────────────────────────────
/** Run to the first con-1 volley and hand back what it fired. */
function volley({ sideb, difficulty }) {
  const { state } = scene({ sideb, difficulty });
  const orb = spawnLightorb(state, 320, 160);
  // 31 frames to con 1, then 10 more to the first `timer % 10 == 0`.
  for (let f = 0; f < 31; f += 1) stepFrame(state, {});
  const before = bolts(state).length;
  const countBefore = orb.count;
  for (let f = 0; f < 10; f += 1) stepFrame(state, {});
  const fired = bolts(state).filter((b) => b.bornFrame === state.frame - 1);
  return { state, orb, fired, before, countBefore, fresh: bolts(state).length - before };
}

{
  // THE THREE-WAY — no quickslash controller in the scene and difficulty 1,
  // so the panic test is false on both arms.
  const v = volley({ sideb: false, difficulty: 1 });
  assertEq(v.fired.length, 3, 'L4: the three-way fan is three bullets (Draw_0:141-156)');
  assert(v.fired.every((b) => b.speed === 4.5),
    `L4: …at the constant 4.5, got ${v.fired.map((b) => b.speed).join(',')}`);
  const dirs = v.fired.map((b) => b.direction);
  // MODULO 360: `direction` is a built-in and the engine wraps it, so the
  // third bolt of a fan that started near 310 comes back at 70.
  const gap = (a, b) => ((((b - a) % 360) + 360) % 360);
  assert(Math.abs(gap(dirs[0], dirs[1]) - 120) < 1e-3
    && Math.abs(gap(dirs[1], dirs[2]) - 120) < 1e-3,
  `L4: …120 degrees apart, got ${dirs.join(',')}`);
  assertEq(v.orb.count - v.countBefore, 1, 'L4: one mouth -> count += 1');
}
{
  // THE FIVE-WAY — obj_knight_enemy.difficulty == 0 opens the panic arm.
  const v = volley({ sideb: false, difficulty: 0 });
  assertEq(v.fired.length, 5, 'L4: the five-way fan is five bullets (Draw_0:114-129)');
  assert(v.fired.every((b) => b.speed >= 5 && b.speed < 7),
    `L4: …at 5 + random(2), got ${v.fired.map((b) => b.speed.toFixed(3)).join(',')}`);
  assert(new Set(v.fired.map((b) => b.speed)).size > 1,
    'L4: …and the speeds really are rolled, not one value repeated');
  const dirs = v.fired.map((b) => b.direction);
  const gap5 = (a, b) => ((((b - a) % 360) + 360) % 360);
  assert(Math.abs(gap5(dirs[0], dirs[1]) - 72) < 1e-3,
    `L4: …72 degrees apart, got ${dirs.join(',')}`);
}
{
  // TYPE 1 FIRES TWICE — one volley per mouth, and `count` counts both.
  const v = volley({ sideb: true, difficulty: 0 });
  assertEq(v.fired.length, 10, 'L4: a split orb fires 5 + 5 on the same frame');
  assertEq(v.orb.count - v.countBefore, 2, 'L4: …and count climbs by 2, one per mouth');
  const xs = [...new Set(v.fired.map((b) => b.x))].sort((a, b) => a - b);
  assertEq(xs.join(','), '260,380', 'L4: …from x -+ splitx, the two mouths');
}

// ── L5 — damage: 166 at fire, 103 on contact ───────────────────────────────
{
  const v = volley({ sideb: false, difficulty: 0 });
  const b = v.fired[0];
  assertEq(b.damage, 166, 'L5: the Draw stamps damage 166 (Draw_0:119) …');
  assertEq(b.target, 0, 'L5: … and target 0 (Draw_0:118)');

  // Other_15 rewrites BOTH before scr_damage. Driven directly so the
  // rewrite is observed rather than inferred from a party HP number.
  const st = v.state;
  st.damageEnabled = true;
  st.invTimer = -1;
  const hpBefore = [...st.partyHp];
  knightBullethellBullet2.other15(b, st);
  assertEq(b.damage, 103,
    'L5: Other_15 rewrites damage to 103 BEFORE scr_damage (mod: vanilla 206)');
  assertEq(b.target, 0, 'L5: …and target to 0 (mod: vanilla 3, the whole party)');
  const dealt = hpBefore.reduce((a, h, i) => a + (h - st.partyHp[i]), 0);
  assert(dealt > 0, 'L5: …and the hit really reaches the party');
  // target 3 would have been scr_damage_all — every standing member. This
  // arm takes from ONE.
  const hitMembers = hpBefore.filter((h, i) => h !== st.partyHp[i]).length;
  assertEq(hitMembers, 1, 'L5: target 0 takes from one member, not scr_damage_all');
}

// ── L6 — the mask is registered ────────────────────────────────────────────
{
  // The engine does NOT know this sprite: that is the trap the module's own
  // mask exists to avoid, and asserting the hole is what keeps a later
  // "cleanup" from deleting the mask on the assumption SPRITE_MASKS has it.
  assert(SPRITE_MASKS.spr_sunbolt === undefined,
    'L6: sim/masks.js has no spr_sunbolt entry — the module must carry its own');
  assertEq(SUNBOLT_MASK.bbox.join(','), '8,3,12,5', 'L6: the extracted bbox');
  assertEq(SUNBOLT_MASK.w, 25, 'L6: …25 wide');
  assertEq(SUNBOLT_MASK.h, 9, 'L6: …9 tall');
  assertEq(SUNBOLT_MASK.originX, 16, 'L6: …origin x 16');
  assert(Array.isArray(SUNBOLT_MASK.px) && SUNBOLT_MASK.px[4][10] === true,
    'L6: …and its pixels are derived (row 4, col 10 is inked)');

  const v = volley({ sideb: false, difficulty: 0 });
  assertEq(v.state.counters.unmaskedBullets, 0,
    'L6: no bullet is skipped for want of a mask');

  // A soul parked ON a bolt takes the hit — the positive half.
  const st = v.state;
  st.damageEnabled = true;
  const b = v.fired[0];
  const hpBefore = st.partyHp.reduce((a, h) => a + h, 0);
  st.invTimer = -1;
  // spr_sunbolt's inked core sits at columns 8..12 / rows 3..5 with origin
  // (16, 4), i.e. 8 left and 1 up of the instance position. Park the soul's
  // 20x20 rect over it.
  st.soul.x = b.x - 18;
  st.soul.y = b.y - 12;
  b.speed = 0;
  b.gravity = 0;
  const hitsBefore = st.counters.collisionHits;
  stepFrame(st, {});
  assert(st.counters.collisionHits > hitsBefore,
    'L6: a soul standing on a sunbolt is hit (the mask really collides)');
  assert(st.partyHp.reduce((a, h) => a + h, 0) < hpBefore,
    'L6: …and loses HP for it');
}

// ── L6b — `e.mask` IS THE FIELD, and the graze path is what proves it ──────
{
  // THE HOLE THIS CLOSES, found by sabotage: deleting the module's ONE
  // `e.mask = SUNBOLT_MASK` left every assertion above green. `collides`
  // names SUNBOLT_MASK directly, so the hit test survives the deletion — but
  // sim/index.js's `grazes` resolves `e.mask ?? SPRITE_MASKS[e.sprite_index]`
  // and consults NO type override, and SPRITE_MASKS has no spr_sunbolt row
  // (asserted in L6), so a bolt without the field is invisible to the graze
  // box. That is the second reader the field exists for, and the one that can
  // be silently lost.
  const v = volley({ sideb: false, difficulty: 0 });
  const st = v.state;
  st.damageEnabled = false;
  st.invTimer = -30;
  const b = v.fired[0];
  b.speed = 0;
  b.gravity = 0;
  // Park the soul NEXT TO the bolt, not on it: the graze box is 50x50 around
  // the soul's centre and one frame behind it, so a couple of still frames
  // settle it and the contact is a graze rather than a hit.
  st.soul.x = b.x - 34;
  st.soul.y = b.y - 12;
  for (let f = 0; f < 3; f += 1) stepFrame(st, {});
  assert(b.alive, 'L6b: the parked bolt survives the approach (it is a graze)');
  assert(b.grazed > 0,
    `L6b: a sunbolt passing the soul GRAZES — sim/index.js \`grazes\` reads `
    + `e.mask, which is the only place spr_sunbolt's shape exists. `
    + `got grazed ${b.grazed}`);

  // THE NEGATIVE HALF, on the same instance: strip the field and the same
  // geometry grazes nothing. This is what makes the assertion above about
  // `e.mask` and not about "a bolt happened to be near the soul".
  const v2 = volley({ sideb: false, difficulty: 0 });
  const st2 = v2.state;
  st2.damageEnabled = false;
  st2.invTimer = -30;
  const b2 = v2.fired[0];
  b2.speed = 0;
  b2.gravity = 0;
  b2.mask = undefined;
  st2.soul.x = b2.x - 34;
  st2.soul.y = b2.y - 12;
  for (let f = 0; f < 3; f += 1) stepFrame(st2, {});
  assertEq(b2.grazed, 0,
    'L6b: …and a bolt whose mask was dropped grazes NOTHING — SPRITE_MASKS '
    + 'cannot stand in for it');

  // AND THE FIELD REALLY COMES FROM CREATE, once. Every bolt of a volley
  // carries the module's singleton, whichever arm fired it.
  assert(v.fired.every((x) => x.mask === SUNBOLT_MASK),
    'L6b: every bolt of the five-way carries the module\'s own mask object');
  const three = volley({ sideb: false, difficulty: 1 });
  assert(three.fired.length === 3 && three.fired.every((x) => x.mask === SUNBOLT_MASK),
    'L6b: …and so does every bolt of the three-way');
  // A bolt spawned by nothing but its Create has it too — which is what makes
  // ONE install site (the Create) the right one.
  const solo = spawn(v.state, knightBullethellBullet2, { x: 10, y: 10 });
  assert(solo.mask === SUNBOLT_MASK,
    'L6b: …and a bolt spawned outside fireSunbolt is masked by Create alone');
  destroy(solo);
}

// ── L7 — the mod's new first-line guard ────────────────────────────────────
{
  const { state } = scene({ sideb: true, difficulty: 0 });
  const orb = spawnLightorb(state, 320, 160);
  for (let f = 0; f < 45; f += 1) stepFrame(state, {}); // into con 1, emitters up
  assertEq(orb.con, 1, 'L7: the orb is firing before the guard is armed');
  assertEq(emitters(state).length, 2, 'L7: …with both emitters alive');

  // Freeze the RNG position and run one frame with the turn expired.
  state.gmlRng = gmlCreate(999);
  const drawsBefore = state.gmlRng.draws ?? 0;
  const boltsBefore = bolts(state).length;
  state.turntimer = 0;
  stepFrame(state, {});

  assertEq(orb.alive, false, 'L7: global.turntimer < 1 destroys the orb (Draw_0:1-9)');
  assertEq(emitters(state).length, 0, 'L7: …and BOTH obj_knight_bullethell2 with it');
  assert(bolts(state).length <= boltsBefore,
    'L7: …and no new bullet is fired on that frame');
  assertEq((state.gmlRng.draws ?? 0) - drawsBefore, 0,
    'L7: …and NOT ONE u32 is drawn — the guard is the first line, before '
    + 'the volley block (vanilla\'s copy sits at :181, after it)');
}

// ── L8 — the RNG budget, counted ───────────────────────────────────────────
/** Draws taken by ONE frame of the orb, isolated by stepping the frame with a
 *  fresh counter. Other entities in the scene draw too, so the orb is run
 *  against a scene whose only other RNG user is measured first. */
function drawsForOneFrame(state) {
  const rng = state.gmlRng;
  const before = rng.draws ?? 0;
  stepFrame(state, {});
  return (rng.draws ?? 0) - before;
}

/**
 * The whole per-frame draw sequence for one orb, background subtracted.
 *
 * THE TIMER IS READ AFTER THE FRAME. The orb's `timer++` is the first line of
 * its Draw, so the draws a frame takes belong to the timer value the frame
 * ENDS on — reading it first is an off-by-one that made an ordinary frame look
 * like a volley frame.
 */
function budget(opts, frames = 55) {
  // BASELINE: the same scene with NO orb, so whatever the scaffold draws on
  // its own is subtracted rather than assumed to be zero.
  const bare = scene(opts);
  for (let f = 0; f < 31; f += 1) stepFrame(bare.state, {});
  const base = [];
  for (let f = 0; f < 12; f += 1) base.push(drawsForOneFrame(bare.state));
  assert(base.every((n) => n === base[0]),
    `L8: the bare scene's own draw count is steady (${base.join(',')})`);
  const bg = base[0];

  const { state } = scene(opts);
  const orb = spawnLightorb(state, 320, 160);
  const per = [];
  for (let f = 0; f < frames; f += 1) {
    const n = drawsForOneFrame(state) - bg;
    per.push({ t: orb.timer, con: orb.con, n });
  }
  return per;
}

/** `con:timer=n` for one row — the shape a failure prints. */
const rowKey = (r) => `c${r.con}t${r.t}=${r.n}`;

{
  // ── THE WHOLE SEQUENCE, FRAME BY FRAME, type 0 / five-way ───────────────
  //
  // Written out rather than filtered into classes because the wind-up is NOT
  // a constant: the power-up orb created on frame N spends its own u32 on
  // frame N+1, so t10..t17 cost one more than t9 and t18 costs one more than
  // t19. An `every(n === k)` assertion cannot see a draw that moved by a
  // frame; an exact sequence can, and that is the whole point of L8.
  const per = budget({ sideb: false, difficulty: 0 }, 55);
  const want = [
    'c0t9=10',
    ...Array.from({ length: 8 }, (_, i) => `c0t${10 + i}=11`),
    'c0t18=9',
    ...Array.from({ length: 21 }, (_, i) => `c0t${19 + i}=8`),
    'c1t1=20',
    ...Array.from({ length: 8 }, (_, i) => `c1t${2 + i}=12`),
    'c1t10=21',
    ...Array.from({ length: 9 }, (_, i) => `c1t${11 + i}=12`),
    'c1t20=21',
    ...Array.from({ length: 4 }, (_, i) => `c1t${21 + i}=12`),
  ];
  assertEq(per.map(rowKey).join(' '), want.join(' '),
    'L8: the exact per-frame u32 sequence of a type-0 orb, wind-up and volleys');

  // Named restatements of the four numbers the sequence encodes, so a
  // failure above says WHICH class moved rather than dumping 55 cells.
  const at = (con, t) => (per.find((r) => r.con === con && r.t === t) ?? {}).n;
  assertEq(at(0, 9), 10,
    'L8: con 0, timer 9 — spark args 2 + spark Create 6 + the orb dir 2');
  assertEq(at(0, 12), 11,
    'L8: …plus 1 from frame 11\'s power-up orb, which draws in its OWN Draw');
  assertEq(at(0, 18), 9,
    'L8: con 0, timer 18 — `timer < 18` is over, so only the spark 8 and the '
    + 'last power-up orb\'s 1');
  assertEq(at(0, 25), 8, 'L8: con 0 after that — the spark alone, 2 + 6');
  assertEq(at(1, 1), 20,
    'L8: the con-switch frame runs BOTH blocks — 8 + 12 (two separate `if`s)');
  assertEq(at(1, 5), 12,
    'L8: an ordinary con-1 frame — triangle Create 2 + scales 2 + spark 2 + 6');
  assertEq(at(1, 10), 21,
    'L8: a five-way volley — 12 + the DEAD irandom(4) 2 + irandom(60) 2 '
    + '+ 5x random(2)');
}
{
  // ── THE THREE-WAY ARM costs 14, not 21 ──────────────────────────────────
  // The ordinary 12 plus the +-2 aim's irandom(4), and nothing else — its
  // speed is the literal 4.5, not `5 + random(2)`. Stripping the aim's
  // irandom(4) reads 12 here and 19 in the five-way block above.
  const per = budget({ sideb: false, difficulty: 1 }, 55);
  const three = per.filter((r) => r.con === 1 && r.t % 10 === 0 && r.t > 0);
  assert(three.length > 0 && three.every((r) => r.n === 14),
    `L8: a three-way volley frame draws 14 u32 — the ordinary 12 plus the `
    + `aim's irandom(4), and NO speed rolls, got ${three.map((r) => r.n).join(',')}`);
  const ordinary = per.filter((r) => r.con === 1 && r.t > 1 && r.t % 10 !== 0);
  assert(ordinary.length > 0 && ordinary.every((r) => r.n === 12),
    `L8: …against 12 on its ordinary frames, got ${ordinary.map((r) => r.n).join(',')}`);
}
{
  // ── A SPLIT ORB PAYS TWICE ──────────────────────────────────────────────
  // `repeat (_rep)` with _rep 2, so every con-1 line runs once per mouth: 24
  // ordinary and 42 on a five-way volley. The con-0 wind-up is unchanged —
  // the split costs nothing until the mouths exist.
  const per = budget({ sideb: true, difficulty: 0 }, 55);
  const at = (con, t) => (per.find((r) => r.con === con && r.t === t) ?? {}).n;
  assertEq(at(0, 25), 8, 'L8: a type-1 orb\'s wind-up costs the same 8');
  assertEq(at(1, 1), 32, 'L8: …its con-switch frame costs 8 + 24');
  const ordinary = per.filter((r) => r.con === 1 && r.t > 1 && r.t % 10 !== 0);
  assert(ordinary.length > 0 && ordinary.every((r) => r.n === 24),
    `L8: …an ordinary con-1 frame is 2 x 12, got ${ordinary.map((r) => r.n).join(',')}`);
  const five = per.filter((r) => r.con === 1 && r.t % 10 === 0 && r.t > 0);
  assert(five.length > 0 && five.every((r) => r.n === 42),
    `L8: …and a five-way volley is 2 x 21, got ${five.map((r) => r.n).join(',')}`);
}
{
  // ── THE PARTICLE CREATES ARE REALLY THE MISSING 8 ───────────────────────
  // The positive form of the fault the reviewers found: an ordinary con-1
  // frame costs 12, and 8 of those 12 are the two particle CREATE events that
  // `instance_create` runs inside the call — obj_knight_spark's 6 and
  // obj_knight_triangle's 2. Asserted against the Create events themselves,
  // read out of the mod's dump, so the number cannot drift from its source.
  const r = gmlCreate(4242);
  const before = r.draws ?? 0;
  // obj_knight_spark Create_0, in order.
  gmlIrandom(r, 3); gmlChoose(r, [WHITE]); gmlChoose(r, [-1, 1]);
  gmlChoose(r, [-1, 1]); gmlRandom(r, 360);
  const spark = (r.draws ?? 0) - before;
  // obj_knight_triangle Create_0.
  gmlRandom(r, 360); gmlChoose(r, [-1, 1]);
  const triangle = (r.draws ?? 0) - before - spark;
  assertEq(spark, 6, 'L8: obj_knight_spark\'s Create_0 is 6 u32');
  assertEq(triangle, 2, 'L8: obj_knight_triangle\'s Create_0 is 2 u32');
  assertEq(spark + triangle, 8,
    'L8: …8 per mouth per con-1 frame — exactly what an argument-only budget '
    + 'missed');
}
{
  // ── THE POWER-UP ORB IS A REAL INSTANCE, and that is why its u32 lands a
  // frame late. Burning it inline would put it on the creating frame and
  // AFTER the spark instead of before it, so the sequence above is the
  // assertion; this block proves the instances exist and carry the
  // configuration the light orb's Draw writes onto them.
  const { state } = scene({ sideb: false, difficulty: 0 });
  const orb = spawnLightorb(state, 320, 160);
  let peak = 0;
  // 32 frames: Create leaves `timer` at 8 and the first Draw takes it to 9, so
  // the con switch lands on the 32nd drawn frame (L2's `conFlip`).
  for (let f = 0; f < 32; f += 1) {
    stepFrame(state, {});
    peak = Math.max(peak, alive(state, 'obj_rouxls_power_up_orb').length);
  }
  assert(peak > 0, 'L8: the wind-up really creates obj_rouxls_power_up_orb');
  assertEq(orb.con, 1, 'L8: …over a wind-up that completed');
  // `if (timer < 18)` against a timer that starts at 9 — nine frames, nine
  // orbs, and `lifetime = 12` means they overlap rather than queue.
  assertEq(peak, 9, 'L8: nine of them, one per frame while timer < 18');
  // They die on their own: 12 frames of life, all gone well before con 1's
  // first volley.
  for (let f = 0; f < 20; f += 1) stepFrame(state, {});
  assertEq(alive(state, 'obj_rouxls_power_up_orb').length, 0,
    'L8: …and every one is gone by `timer > lifetime` (12)');
}

// ── L9 — the aim window: +-2, not +-5 ──────────────────────────────────────
{
  // The three-way arm keeps `basedir` from the +-2 roll unless one of its two
  // `count %` re-aims fires, so the first volley (count 1) shows the window.
  const seen = [];
  for (let seed = 1; seed <= 24; seed += 1) {
    const { state } = scene({ sideb: false, difficulty: 1, seed });
    const orb = spawnLightorb(state, 320, 160);
    for (let f = 0; f < 41; f += 1) stepFrame(state, {});
    const fired = bolts(state).filter((b) => b.bornFrame === state.frame - 1);
    if (fired.length !== 3) continue;
    const heart = state.soul;
    const aim = Math.atan2(-(heart.y + 10 - orb.y), (heart.x + 10) - orb.x) * 180 / Math.PI;
    let off = fired[0].direction - ((aim + 360) % 360);
    while (off > 180) off -= 360;
    while (off < -180) off += 360;
    seen.push(off);
  }
  assert(seen.length >= 8, `L9: gathered enough volleys to measure (${seen.length})`);
  // irandom(n) is INCLUSIVE of n, so `+36 - 2 + irandom(4)` spans 34..38 —
  // a five-degree window. Vanilla's `+36 - 5 + irandom(10)` spans 31..41,
  // eleven degrees, and would break this bound on both sides.
  assert(seen.every((o) => o >= 33.5 && o <= 38.5),
    `L9: the heading sits in [aim+34, aim+38] — the mod's +36-2+irandom(4). `
    + `Vanilla's +36-5+irandom(10) would reach 31..41. Got `
    + `${seen.map((o) => o.toFixed(2)).join(',')}`);
  assert(new Set(seen.map((o) => Math.round(o))).size > 1,
    'L9: …and the roll is live, not a constant');
}

// ── L10 — the retro-thrust ─────────────────────────────────────────────────
{
  const v = volley({ sideb: false, difficulty: 0 });
  const b = v.fired[0];
  const born = { dir: b.direction, spd: b.speed };
  const wrap = (a) => ((((a) % 360) + 360) % 360);
  assert(Math.abs(wrap(b.gravity_direction) - wrap(born.dir + 180)) < 1e-3,
    `L10: gravity_direction = direction + 180, got ${b.gravity_direction} `
    + `against direction ${born.dir}`);
  // Both sides read the INSTANCE's f32 built-ins, which is why the module
  // computes gravity from `b.speed` and not from its own f64 argument.
  assertEq(b.gravity, Math.fround(born.spd / 90), 'L10: gravity = speed / 90, f32 in f32 out');
  const g0 = b.gravity;
  for (let f = 0; f < 30; f += 1) stepFrame(v.state, {});
  assert(b.alive, 'L10: the bolt is still alive 30 frames on');
  assertEq(b.gravity, 0, 'L10: scr_lerpvar decays gravity to 0 over 30 frames');
  assert(b.speed < born.spd && b.speed > 0,
    `L10: …having slowed the bolt on the way (${born.spd.toFixed(3)} -> ${b.speed.toFixed(3)})`);
  assert(g0 > 0, 'L10: …from a real starting value');
}

// ── L11 — the emitters fire nothing, and outlive vanilla's 70 ──────────────
{
  const { state } = scene({ sideb: true, difficulty: 0 });
  spawnLightorb(state, 320, 160);
  for (let f = 0; f < 200; f += 1) stepFrame(state, {});
  const em = emitters(state);
  assertEq(em.length, 2, 'L11: both emitters are still alive at frame 200 (timer > 700, vanilla 70)');
  assert(em.every((e) => e.timer > 70),
    `L11: …with timers past vanilla's cutoff, got ${em.map((e) => e.timer).join(',')}`);
  assertEq(alive(state, 'obj_knight_bullethell_bullet').length, 0,
    'L11: `repeat (3)` -> `repeat (0)`: the emitters create no bullets at all');
  assert(em.every((e) => e.b < 0),
    `L11: …but the b counter still walks (b -= 0.1), got ${em.map((e) => e.b.toFixed(2)).join(',')}`);
  assert(em.every((e) => typeof e.lastDir === 'number'),
    'L11: …and _dir is still computed, dead though it is');
}

// ── L11b — THE MOD'S NEW `_dir -= 180` FLIP IS DEAD, MEASURED ──────────────
{
  // The mod added `if (obj_heart.y < y) _dir -= 180;` to the emitter's Step
  // and, in the same patch, turned the `repeat (3)` that read `_dir` into
  // `repeat (0)`. The claim is that the flip therefore changes nothing. That
  // used to be asserted by `typeof lastDir === 'number'`, which is not the
  // claim at all — it passes just as happily if the flip moved the emitter.
  //
  // THE DIFFERENTIAL. One emitter, stepped BY HAND (so the only thing running
  // is the event under test), twice from identical state — soul below it, then
  // soul above it. `dir` itself is fixed before either run so the aim cannot
  // drift; the only input that differs is the side the soul is on, which is
  // the flip's only trigger.
  function stepOnce(soulAbove) {
    const { state } = scene({ sideb: true, difficulty: 0 });
    // The orb only has to EXIST — the emitter's first line is `if
    // (!i_ex(obj_knight_lightorb)) exit;` and its second reads `orb.type`.
    const orb = spawnLightorb(state, 320, 160);
    orb.orbtype = 0; // so `_dir` keeps its sin() term and the flip has a value
    const em = spawn(state, knightBullethell2, { x: 320, y: 200 });
    em.dir = 90;
    em.timer = 7; // a timer whose sin() term is non-zero
    state.soul.x = 320;
    state.soul.y = soulAbove ? 100 : 300;
    const popBefore = state.entities.length;
    const rngBefore = state.gmlRng.draws ?? 0;
    knightBullethell2.step(em, state);
    return {
      lastDir: em.lastDir,
      rest: JSON.stringify([em.timer, em.con, em.a, em.b, em.c, em.dir,
        em.x, em.y, em.alive, em.visible, em.depth, em.spd, em.frc]),
      spawned: state.entities.length - popBefore,
      draws: (state.gmlRng.draws ?? 0) - rngBefore,
    };
  }
  const below = stepOnce(false); // soul BELOW the emitter — no flip
  const above = stepOnce(true); //  soul ABOVE the emitter — flip fires

  // THE FLIP REALLY FIRES: the two runs disagree, and by exactly 180.
  assert(below.lastDir !== above.lastDir,
    'L11b: the soul\'s side really changes _dir — the flip is translated');
  assertEq(Number((below.lastDir - above.lastDir).toFixed(9)), 180,
    'L11b: …by exactly 180 (`if (obj_heart.y < y) _dir -= 180`, Step_0)');

  // AND IT REACHES NOTHING ELSE. Every other field the event owns, the room's
  // population, and the stream position all come out identical.
  assertEq(above.rest, below.rest,
    'L11b: …and NOT ONE other field of the emitter moves with it — '
    + '`repeat (3)` became `repeat (0)`, so nothing reads _dir');
  assertEq(above.spawned, below.spawned, 'L11b: …neither side creates anything');
  assertEq(above.spawned, 0, 'L11b: …because the fan is gone entirely');
  assertEq(above.draws, below.draws, 'L11b: …and neither side touches the stream');
  assertEq(above.draws, 0, 'L11b: …the emitter draws no u32 at all');
}

// ── L11c — …and `lastDir` has no reader outside this check ─────────────────
{
  // The behavioural half above proves the flip changes nothing THIS frame.
  // This half closes the other door: `lastDir` is the field the module parks
  // the dead value on, and if anything ever starts reading it the deadness
  // claim in lightorb.js becomes false. THE REPO'S SIGNATURE DEFECT in
  // reverse — a value written where nothing reads it, asserted on purpose.
  const roots = ['kaizo', 'sim', 'render', 'input'];
  const hits = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) { walk(p); continue; }
      if (!/\.(js|mjs)$/.test(ent.name)) continue;
      const src = readFileSync(p, 'utf8');
      if (src.includes('lastDir')) hits.push(relative(ROOT, p).replace(/\\/g, '/'));
    }
  };
  for (const r of roots) walk(join(ROOT, r));
  hits.sort();
  assertEq(hits.join(','),
    'kaizo/attacks/lightorb.js,kaizo/tools/checks/check-lightorb.mjs',
    'L11c: `lastDir` is written by the emitter and read by this check ALONE — '
    + 'a third file means the dead flip has become live and lightorb.js\'s '
    + 'comment is wrong');
}

// ── the caller: the vertical splitter really creates one ───────────────────
{
  const { state } = scene({ sideb: true, difficulty: 0 });
  const gt = state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
  const sp = spawnVerticalSplit(state, { x: gt.x, y: gt.y }, null);
  assertEq(alive(state, 'obj_knight_lightorb').length, 0, 'caller: no orb before the tear');
  for (let f = 0; f < 20; f += 1) stepFrame(state, {});
  const orbs = alive(state, 'obj_knight_lightorb');
  assertEq(orbs.length, 1,
    'caller: obj_knight_split_growtangle_vertical Step_0:15 creates the orb on the tear');
  assertEq(orbs[0].x, sp.x, 'caller: …at the organism\'s x');
  assertEq(orbs[0].y, sp.y, 'caller: …and its y');
  assertEq(
    state.kaizo.approx.filter((r) => String(r.asked).includes('obj_knight_lightorb')).length,
    0, 'caller: …and G-1\'s approx row is gone',
  );
}

// ── R1 — the render registry's ORDINAL COMMENTS are the registry's order ───
{
  // Four comments in kaizo/render/index.js name a row by its position ("THE
  // 27TH ENTRY IS …"). All four were wrong — the light orb's row claimed 28th
  // and landed 27th, actor_party claimed 27th and landed 28th, and the two
  // fill rows claimed the positions they had before their families moved.
  // Prose cannot be kept honest by review, so the four are pinned here: the
  // registry's own key order against the numbers the file writes.
  //
  // READ THE SOURCE, not a re-derivation of it. Parsing the comments is what
  // makes this a check of the COMMENTS rather than of a copy of them.
  const src = readFileSync(join(ROOT, 'kaizo', 'render', 'index.js'), 'utf8');
  const ord = (word) => KAIZO_DRAW_OBJECTS.indexOf(word) + 1;
  const ORDINALS = {
    obj_roaringknight_quickslash_big: '12TH',
    obj_knight_diamondswordbullet_ext: '21ST',
    obj_knight_lightorb: '27TH',
    actor_party: '28TH',
  };
  const suffix = (n) => {
    if (n % 100 >= 11 && n % 100 <= 13) return 'TH';
    return ({ 1: 'ST', 2: 'ND', 3: 'RD' })[n % 10] ?? 'TH';
  };
  for (const [name, claimed] of Object.entries(ORDINALS)) {
    const n = ord(name);
    assert(n > 0, `R1: ${name} is in the registry`);
    assertEq(claimed, `${n}${suffix(n)}`,
      `R1: the comment over ${name} claims the ${claimed} entry and it lands ${n}`);
    assert(src.includes(`THE ${claimed} ENTRY`),
      `R1: …and kaizo/render/index.js really says "THE ${claimed} ENTRY"`);
  }
  // No OTHER ordinal claim is left unpinned: exactly four rows carry one.
  assertEq((src.match(/THE \d+(?:ST|ND|RD|TH) ENTRY/g) ?? []).length, 4,
    'R1: those four are ALL the ordinal claims in the file — a fifth would be '
    + 'an unchecked one');
  assertEq(KAIZO_DRAW_OBJECTS.length, 28,
    'R1: …over a 28-row registry — 25 changed Draws (the brief\'s 24 plus the '
    + 'Side-B light orb) and three that are not (the blade fill, the finisher '
    + 'fill, the party actor)');
  assertEq(KAIZO_DRAW_OBJECTS[26], 'obj_knight_lightorb',
    'R1: the light orb really is row 27');
  assertEq(KAIZO_DRAW_OBJECTS[27], 'actor_party',
    'R1: …and actor_party really is row 28');
}

// ── the types are distinct objects, not one recycled shape ─────────────────
{
  assertEq(knightLightorb.name, 'obj_knight_lightorb', 'types: the orb');
  assertEq(knightBullethell2.name, 'obj_knight_bullethell2', 'types: the emitter');
  assertEq(knightBullethellBullet2.name, 'obj_knight_bullethell_bullet2', 'types: the bolt');
  assert(typeof knightLightorb.draw === 'function' && !knightLightorb.step,
    'types: the orb runs entirely in the DRAW slot and has no step');
  assert(typeof knightBullethellBullet2.collides === 'function',
    'types: the bolt declares its own contact test');
  // A smoke spawn of the emitter with no orb present must simply do nothing.
  const { state } = scene({ sideb: true });
  const solo = spawn(state, knightBullethell2, { x: 100, y: 100 });
  stepFrame(state, {});
  assertEq(solo.timer, 0, 'types: an emitter with no orb exits its Step (`!i_ex`)');
  // objects_kaizo.csv row 1197 — `obj_knight_bullethell2,,0,1,0,,` — no
  // sprite, depth 0, VISIBLE 1. An earlier draft set `visible = false` and
  // cited that row for it. Inert either way (the object has nothing to draw),
  // pinned so the code and its citation cannot drift apart again.
  assertEq(solo.visible, true,
    'types: the emitter is VISIBLE 1, as objects_kaizo.csv says');
  assertEq(solo.depth, 0, 'types: …at depth 0, the same row');
  assert(solo.alive, 'types: …and does not destroy itself doing so');
}

console.log(failures === 0
  ? `check-lightorb: all ${checks} checks passed\n`
    + '  L1 create / L2 wind-up / L3 the split + emitters / L4 the volleys\n'
    + '  L5 166 at fire, 103 on contact / L6 the mask / L7 the turntimer guard\n'
    + '  L8 the RNG budget, frame by frame / L9 the +-2 aim / L10 retro-thrust\n'
    + '  L11 dead emitters / L11b the `_dir -= 180` flip reaches nothing / L11c no reader\n'
    + '  R1 the render registry\'s ordinal comments match its key order'
  : `check-lightorb: ${failures} of ${checks} FAILED`);
process.exit(failures === 0 ? 0 : 1);
