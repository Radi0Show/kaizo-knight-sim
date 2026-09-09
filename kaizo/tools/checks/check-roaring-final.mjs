#!/usr/bin/env node
// KAIZO V-C "Roaring DELTA" finale (choice 104) — positive assertions on
// every branch the mod ADDS to obj_knight_roaring2, against
// kaizo/attacks/roaring-final.js + roaring-final-star.js +
// roaring-final-shatter.js (kaizo copies of the verified sim modules).
//
//     node kaizo/tools/checks/check-roaring-final.mjs
//
// Every block asserts what its branch CHANGES, so deleting any translated
// delta fails loudly. Nothing here would pass against the unmodified sim
// module: the vanilla roaring2 has no roaring_type, no final_con, no slash
// lines and ends its turn ~440 frames earlier by a different route.
//
//   - the Create gate: myattackchoice 104 -> roaring_type 1 (and 9 -> 0,
//     with the vanilla Step still running in that mode)
//   - the Step dispatch: in final mode NONE of the vanilla Step runs
//   - the soul's 2px mask, re-stamped every finale frame AND once at the
//     vanilla roar's roaring_timer 9
//   - final_con 0: global.invc 0.5 -> 0.8 at timer 30, the arena inflated to
//     the whole screen, player_suck pinned to 0, hand-over at timer >= 120
//   - final_con 1: the hideback cover at timer 16; rings of 7 (8 on B-Side);
//     the star contract (spec/startype/distance/scale/rotspeed); the
//     controller-driven star drive; the B-Side 55% ramp making attack_con 1
//     nearly twice as long
//   - the RNG BUDGET, frame by frame: 0 draws in final_con 0, exactly 4 while
//     the spiral ramps (the two skipped in-rush irandoms), exactly 20 on a
//     slash-line beat and 0 off-beat, and the shatter's 157 / 281
//   - final_con 2: player_suck 18, the soul shoved UP, curtain volleys of
//     exactly 10 startype-2 stars in alternating 24px rows, the attack_max
//     hand-over at exactly 9 (8 on B-Side)
//   - final_con 3: 30 slash lines at xscale 0.2 / yscale 800, widened to 0.4
//     one frame before the test, the ORIGINAL BUG that writes 0.3/0.2 onto
//     the CONTROLLER instead of the line, and con 101 handed to the stars
//   - THE HIT: scr_damage_all_maxhp(0.75, 1, 0) — exactly ceil(maxhp * 0.75)
//     to all three, ignoring DEFEND, able to fell, once and only once; plus
//     the scripted-wipe path (hp restored to 1, final_kill, finalFailure)
//   - the mod's retuned star catch (obj_knight_enemy Other_12): 30 damage,
//     25 defending, the 1-HP hole, and hp_visible
//   - THE TURN ENDS ITSELF (global.turntimer -1 + obj_heart destroyed), in
//     both modes, with the landed hit buying exactly 6 extra frames
//
// PUBLISH GATE: V-C recreation of EnderCat8's Kaizo Roaring Knight — do not
// publish without permission.

import { createState, stepFrame } from '../../../sim/index.js';
import { destroy, spawn } from '../../../sim/entity.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { ensureSoul } from './scaffold-soul.mjs';
import { PARTY, ACTION_DEFEND, scrDamage } from '../../../sim/damage.js';
import { gmlEq } from '../../../sim/gml.js';
import { roaring2, finalSlashLine, roaringFinalCleanUp } from '../../attacks/roaring-final.js';
import { kaizoKnightCatch } from '../../attacks/roaring-final-star.js';
import { HEART_2PX_MASK, FINALSLASH_MASK } from '../../attacks/knight-stream.js';

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

function assertNear(got, want, eps, label) {
  checks += 1;
  if (!(Math.abs(got - want) <= eps)) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${got}, want ~${want}`);
  }
}

/**
 * A fight-shaped scene (knight, party, board, soul) with the practice
 * director removed so nothing auto-launches, then the kaizo roaring2 spawned
 * exactly the way the V-C launcher's type-107 case does — including the
 * `myattackchoice` the Create gate reads and the 999999 clock pin.
 */
function build({ ac = 104, sideb = false, seed = 12345, invc = 0.5 } = {}) {
  const state = createState({ seed });
  buildSingleAttackScene(state, { seed, attack: 'roaring', difficulty: 0 });
  ensureSoul(state); // the drill no longer spawns the soul at build (scaffold-soul.mjs)
  const dir = state.entities.find((x) => x.alive && x.type.name === 'practice_director');
  if (dir) destroy(dir);
  // The single scene may have launched the SIM roaring already; the kaizo
  // controller is the one under test.
  for (const x of state.entities) {
    if (x.alive && x.type.name === 'obj_knight_roaring2') destroy(x);
  }
  state.kaizo = { sideb };
  state.currentAc = ac;      // obj_knight_enemy.myattackchoice
  state.turntimer = 999999;  // the type-107 PINNER the launcher applies
  state.invc = invc;
  const e = spawn(state, roaring2, { x: state.view.x + 320, y: state.view.y + 88 });
  return { state, e };
}

function stars(state) {
  return state.entities.filter((x) => x.alive && x.type.name === 'obj_knight_roaring_star');
}

function lines(state) {
  return state.entities.filter((x) => x.alive && x.type.name === 'kaizo_roaring_finalslash_line');
}

/** Run the whole finale, recording every observable the sections below need. */
function runFinale({ sideb = false, seed = 12345, maxFrames = 2600, invulnerable = false,
  startHp = null } = {}) {
  const { state, e } = build({ sideb, seed });
  if (startHp) state.partyHp = startHp.slice();
  const rec = {
    state,
    e,
    endFrame: -1,
    phase: {},          // "final_con.attack_con" -> frame it was first seen
    drawsByFrame: [],
    newStarsByFrame: [],
    firstVolley: null,
    firstCurtain: null,
    invcAt: [],
    hidebackFrame: -1,
    linesAtCon3: -1,
    beatFrames: [],
    lineSnapshotBeforeHit: null,
    hpBeforeHit: null,
    hpAfterHit: null,
    shatterAtCon5: -1,
    con101: 0,
    soulYAtRoar: null,
    handoverMax: null,
    linesCreated: 0,
    lineSpawns: [],
    specClearedAtCut: false,
    starchildren: 0,
    soulYAtCut: null,
  };
  let key = `${e.final_con}.${e.attack_con}`;
  rec.phase[key] = -1;
  const seen = new Set(stars(state));
  const seenKids = new Set();
  for (let f = 0; f < maxFrames; f++) {
    if (invulnerable) state.invTimer = 90; // nothing can land
    const before = state.gmlRng.draws ?? 0;
    const hpBefore = state.partyHp.slice();
    const preAttackCon = e.alive ? e.attack_con : null;
    const preAttackTimer = e.alive ? e.attack_timer : null;
    const preLines = e.alive && e.final_lines ? e.final_lines.slice() : [];
    const preFinalCon = e.alive ? e.final_con : null;
    const preAttackMax = e.alive ? e.attack_max : null;
    stepFrame(state, {});
    rec.drawsByFrame.push((state.gmlRng.draws ?? 0) - before);
    rec.invcAt.push(state.invc);

    if (e.alive) {
      const k = `${e.final_con}.${e.attack_con}`;
      if (!(k in rec.phase)) rec.phase[k] = f;

      // the frame BEFORE the hit test: lines are white and 0.4 wide
      if (e.final_con === 3 && gmlEq(e.attack_con, 4) && e.attack_timer === 1) {
        rec.lineSnapshotBeforeHit = e.final_lines.map((l) => ({
          xs: l.image_xscale, ys: l.image_yscale, blend: l.image_blend,
        }));
        rec.hpBeforeHit = state.partyHp.slice();
      }
      // the hit frame itself
      if (e.final_con === 3 && gmlEq(e.attack_con, 4) && e.attack_timer === 2) {
        rec.hpAfterHit = state.partyHp.slice();
        rec.finalHit = e.final_hit;
        rec.finalKill = e.final_kill;
        rec.ctrlXscaleAfterHit = e.image_xscale;
        rec.lineXscaleAfterHit = e.final_lines[0] ? e.final_lines[0].image_xscale : null;
      }
      if (gmlEq(preAttackCon ?? -1, 5) && rec.shatterAtCon5 < 0) {
        rec.shatterAtCon5 = state.knight?.shatter_insts?.length ?? -1;
      }
      if (rec.hidebackFrame < 0 && e.hideback && e.hideback !== -4) rec.hidebackFrame = f;
      if (e.final_con === 3 && rec.linesAtCon3 < 0 && (e.final_lines ?? []).length === 30) {
        rec.linesAtCon3 = f;
      }
      // The LAST beat also flips attack_con to 3 in the same frame, so the
      // gate is "lines grew", not the post-step attack_con.
      if (e.final_con === 3 && (e.final_lines ?? []).length > preLines.length) {
        rec.beatFrames.push({ frame: f, timer: e.attack_timer, draws: rec.drawsByFrame[f] });
        for (const l of e.final_lines.slice(preLines.length)) {
          rec.linesCreated += 1;
          rec.lineSpawns.push({
            x: l.x, y: l.y, angle: l.image_angle, xs: l.image_xscale,
            ys: l.image_yscale, mask: l.mask, blend: l.image_blend,
          });
        }
      }
      // the frame final_con 3 opens: attack_max is the value the gmlEq
      // hand-over fired on, and the soul is wherever the shove left it
      if (e.final_con === 3 && rec.handoverMax === null) {
        // PRE-step: the gmlEq that opened the cut read this value, and the
        // branch it opened immediately writes attack_max = 8 over it.
        rec.handoverMax = preFinalCon === 3 ? e.attack_max : preAttackMax;
        rec.soulYAtCut = state.soul ? state.soul.y : null;
      }
      if (e.final_con === 3 && gmlEq(e.attack_con, 1) && !rec.specClearedAtCut) {
        const promoted = stars(state).filter((x) => x.con === 101);
        if (promoted.length) {
          rec.specClearedAtCut = promoted.every((x) => x.spec === 0 && x.outbound === true);
        }
      }
      if (e.final_con === 2 && rec.soulYAtRoar === null && state.soul) {
        rec.soulYAtRoar = { suck: e.player_suck, y: state.soul.y };
      }
    }
    void preAttackTimer;
    void hpBefore;

    // new stars this frame, by family
    const fresh = stars(state).filter((s) => !seen.has(s));
    for (const s of fresh) seen.add(s);
    rec.newStarsByFrame.push(fresh.length);
    if (fresh.length && !rec.firstVolley && fresh[0].startype === 1) {
      // POST-STEP: the controller's own star drive (Other_11:879-938) has
      // already run once on these, which is exactly what makes the numbers
      // below a check on the drive as well as on the spawn.
      rec.gravAtFirstVolley = e.attack_grav;
      rec.multAtFirstVolley = e.attack_mult;
      rec.firstVolley = fresh.map((s) => ({
        startype: s.startype, spec: s.spec, distance: s.distance,
        xs: s.image_xscale, dir: s.direction, rot: s.rotspeed,
        destroyonhit: s.destroyonhit, outbound: s.outbound, speed: s.speed,
      }));
    }
    if (fresh.length && !rec.firstCurtain && fresh[0].startype === 2) {
      rec.firstCurtain = fresh.map((s) => ({
        startype: s.startype, spec: s.spec, xs: s.image_xscale,
        x: s.x, y: s.y, rot: s.rotspeed,
      }));
    }
    for (const s of stars(state)) if (s.con === 101) rec.con101 += 1;
    rec.starchildren += state.entities.filter(
      (x) => x.alive && x.type.name === 'obj_knight_pointing_starchild' && !seenKids.has(x)
        && (seenKids.add(x), true),
    ).length;

    if (state.turntimer === -1) { rec.endFrame = f; break; }
  }
  return rec;
}

// ═══ 1. THE CREATE GATE — `obj_knight_enemy.myattackchoice == 104` ════════
console.log('1. Create gate (kaizo Create_0:53-73)');
{
  const { e } = build({ ac: 104 });
  assertEq(e.roaring_type, 1, 'ac 104 -> roaring_type 1');
  assertEq(e.final_con, 0, 'ac 104 -> final_con 0');
  assert(Array.isArray(e.final_lines) && e.final_lines.length === 0, 'final_lines = []');
  assertEq(e.final_xs, 1, 'final_xs = 1');
  assertEq(e.hideback, -4, 'hideback = -4 (noone sentinel)');
  assertEq(e.fake_xoff, 0, 'fake_xoff = 0');
  assertEq(e.fake_yoff, 0, 'fake_yoff = 0');
  assertEq(e.final_hit, 0, 'final_hit = 0');
  assertEq(e.fix_draw, 0, 'fix_draw = 0');
  assertEq(e.hp_visible, 0, 'HUD starts hidden');
  assertEq(e.hp_y, 48, 'hp_y = 48');
  assertEq(e.hp_alpha, 0.5, 'hp_alpha = 0.5');
  assertEq(e.hp_surf, -4, 'hp_surf = -4');

  const b = build({ ac: 9 });
  assertEq(b.e.roaring_type, 0, 'ac 9 -> roaring_type 0 (ordinary kaizo roaring)');
  assertEq(b.e.final_con, undefined, 'ac 9 leaves the finale state uninitialised');
  assertEq(b.e.hp_y, 48, 'the HUD vars are set for BOTH modes');
}

// ═══ 2. THE STEP DISPATCH — `if (roaring_type == 1) { event_user(1); exit; }`
console.log('2. Step dispatch (kaizo Step_0:1-5)');
{
  // `darknessDelay` is armed to 20 in Create and decremented ONLY by the
  // vanilla Step. If any of the vanilla body ran in final mode it would be
  // at 0 within 20 frames.
  const fin = build({ ac: 104 });
  const van = build({ ac: 9 });
  for (let f = 0; f < 40; f++) { stepFrame(fin.state, {}); stepFrame(van.state, {}); }
  assertEq(fin.e.darknessDelay, 20, 'final mode: the vanilla Step never runs');
  assertEq(van.e.darknessDelay, 0, 'vanilla mode: the vanilla Step does run');
  assertEq(fin.e.timer, 40, 'final mode still advances its own timer');
  assertEq(fin.e.intensity, 1.5, 'final mode has not touched intensity at frame 40');
  // The vanilla ramp opens at `timer > 128`; run both past it.
  for (let f = 0; f < 160; f++) { stepFrame(fin.state, {}); stepFrame(van.state, {}); }
  assert(van.e.intensity > 1.5, 'vanilla mode runs the vanilla intensity ramp');
  assertEq(van.e.final_con, undefined, 'vanilla mode never enters the finale machine');
  assertEq(fin.e.final_con, 1, 'final mode has handed over to final_con 1 by frame 200');
}

// ═══ 3. THE SOUL'S 2px MASK ═══════════════════════════════════════════════
console.log('3. spr_dodgeheart_smaller_2px_mask (Other_11:14, Step_0:369-372)');
{
  const { state } = build({ ac: 104 });
  stepFrame(state, {});
  assertEq(state.soul.mask, HEART_2PX_MASK, 'finale stamps the 2px mask on frame 1');
  state.soul.mask = null; // anything else may reset it mid-frame
  stepFrame(state, {});
  assertEq(state.soul.mask, HEART_2PX_MASK, 'and RE-stamps it every frame');

  // The vanilla roar's own one-shot stamp, at roaring_timer 9.
  const v = build({ ac: 9 });
  let stamped = -1;
  for (let f = 0; f < 900 && stamped < 0; f++) {
    v.state.soul.mask = null;
    stepFrame(v.state, {});
    if (v.state.soul && v.state.soul.mask === HEART_2PX_MASK) stamped = f;
  }
  assert(stamped > 0, 'vanilla roar stamps the 2px mask at roaring_timer 9');
  assertEq(v.e.roaring_timer, 9, 'and it is roaring_timer 9 that does it');
}

// ═══ 4. final_con 0 — SET-UP (Other_11:44-77) ═════════════════════════════
console.log('4. final_con 0 — set-up');
{
  const { state, e } = build({ ac: 104, invc: 0.5 });
  const gt = state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
  const gtScale0 = gt.image_xscale;
  const soul0 = { x: state.soul.x, y: state.soul.y };
  let invcAt29 = null;
  let invcAt30 = null;
  let drawsInPhase0 = 0;
  let suckAlwaysZero = true;
  for (let f = 0; f < 120; f++) {
    const d0 = state.gmlRng.draws ?? 0;
    stepFrame(state, {});
    drawsInPhase0 += (state.gmlRng.draws ?? 0) - d0;
    if (e.timer === 29) invcAt29 = state.invc;
    if (e.timer === 30) invcAt30 = state.invc;
    if (e.final_con === 0 && e.player_suck !== 0) suckAlwaysZero = false;
  }
  assert(suckAlwaysZero, 'player_suck pinned to 0 for the whole intro');
  assertEq(invcAt29, 0.5, 'global.invc is still the launch 0.5 at timer 29');
  assertEq(invcAt30, 0.8, 'global.invc becomes 0.8 at timer 30');
  assertEq(drawsInPhase0, 0, 'final_con 0 consumes NO RNG');
  assert(gt.image_xscale > gtScale0 * 4,
    `arena inflated toward the screen (${gtScale0} -> ${gt.image_xscale.toFixed(2)})`);
  assertNear(state.soul.x, soul0.x, 0.001, 'the soul is not pulled during the intro (x)');
  assertNear(state.soul.y, soul0.y, 0.001, 'the soul is not pulled during the intro (y)');
  assertEq(e.final_con, 1, 'hand-over to final_con 1 at timer >= 120');
  assertEq(e.timer, -1, 'timer reset to -1 on the hand-over');
  assertEq(e.attack_grav, 8, 'attack_grav armed at 8');
  assertEq(e.attack_spd, 0.5, 'attack_spd armed at 0.5');
  assertEq(e.attack_max, 10, 'attack_max armed at 10');
  assertEq(e.attack_mult, 1, 'attack_mult armed at 1');
}

// ═══ 5. final_con 1 — THE SPIRAL (Other_11:78-384) ════════════════════════
console.log('5. final_con 1 — the spiral, and the RNG budget');
{
  const rec = runFinale({ seed: 12345 });
  assert(rec.hidebackFrame > 0, 'the hideback cover is created (timer 16)');

  // THE RING. Seven stars a volley, all with the mod's own contract.
  assert(rec.firstVolley !== null, 'a ring volley fired');
  assertEq(rec.firstVolley.length, 7, 'seven stars a ring (normal)');
  // The stars are read AFTER the frame that made them, so the controller's
  // star drive has already run on them once: `distance -= attack_grav` and
  // the scale re-derived from what is left. Both are asserted here, which
  // makes this one block cover the spawn contract AND Other_11:879-938.
  const grav = rec.gravAtFirstVolley;
  const scalefac = 640 / 2.4;                 // attack_con 0 -> maxscale 2.4
  const wantDist = 640 - grav;
  const wantScale = Math.max(wantDist / scalefac, 0.1) + 0.2; // addscale 0.2
  for (const s of rec.firstVolley) {
    assertEq(s.startype, 1, 'ring star startype 1');
    assertEq(s.spec, 1, 'ring star spec 1 (never culled offscreen)');
    assertNear(s.distance, wantDist, 1e-9,
      'ring star spawned at distance 640 and walked in by attack_grav');
    assertNear(s.xs, wantScale, 1e-5,
      'ring star scale re-derived from the remaining distance (+0.2)');
    assertEq(s.speed, 0, 'ring star speed 0 — the controller drives it');
    assertEq(s.destroyonhit, false, 'ring star passes THROUGH the soul');
    assertEq(s.outbound, false, 'ring star outbound false');
  }
  assert(grav > 8 && grav < 9, `attack_grav still near its 8 floor (${grav.toFixed(3)})`);
  // `direction` is a BUILT-IN, so it is f32 on store — compare loosely.
  const dirs = rec.firstVolley.map((s) => s.dir).sort((a, b) => a - b);
  for (let i = 1; i < dirs.length; i++) {
    assertNear(dirs[i] - dirs[i - 1], 360 / 7, 1e-3, 'ring stars are evenly spaced');
  }

  // THE RNG BUDGET while the spiral ramps: exactly the two skipped in-rush
  // irandoms, 2 u32 draws each. A frame that spawned the particle, or one
  // that skipped the draws, would not be 4.
  const rampStart = rec.phase['1.0'];
  let quiet = 0;
  for (let f = rampStart + 40; f < rampStart + 140; f++) {
    if (rec.drawsByFrame[f] === 4) quiet += 1;
  }
  assert(quiet > 90, `the spiral takes exactly 4 draws a frame (${quiet}/100 frames)`);

  // THE HAND-OVERS, in order and at their measured frames.
  assert(rec.phase['1.1'] > rec.phase['1.0'], 'attack_con 0 -> 1 (attack_grav reaches 12.5)');
  assertEq(rec.phase['1.1'] - rec.phase['1.0'], 243, 'attack_con 0 lasts 243 frames');
  assert((rec.phase['1.1.5'] ?? -1) > rec.phase['1.1'],
    'attack_grav reaching 18 starts the lerped attack_con 1.5 -> 2 -> 2.5 -> 3');
  assert((rec.phase['1.2'] ?? -1) > (rec.phase['1.1.5'] ?? -1),
    'the lerp lands on attack_con 2 exactly (gmlEq, not ===)');
  assert((rec.phase['1.2.5'] ?? -1) > (rec.phase['1.2'] ?? -1),
    'and on 2.5, and on 3 — every one a gmlEq on an accumulated real');
  assert((rec.phase['1.3'] ?? -1) > (rec.phase['1.2.5'] ?? -1),
    'attack_con reaches exactly 3, which fires the roar');
  assert(rec.phase['2.0'] > rec.phase['1.1'], 'the roar hands over to final_con 2');
}

// ═══ 6. B-SIDE: the 55% ramp and the eighth star ══════════════════════════
console.log('6. B-Side ramps (Other_11:167-170, 226-231, 238-242)');
{
  const a = runFinale({ sideb: false });
  const b = runFinale({ sideb: true });
  assertEq(a.firstVolley.length, 7, 'normal: 7 stars a ring');
  assertEq(b.firstVolley.length, 8, 'B-Side: 8 stars a ring');
  const aLen = a.phase['1.1.5'] ?? (a.phase['2.0'] - a.phase['1.1']);
  const bLen = b.phase['2.0'] - b.phase['1.1'];
  const aLen2 = a.phase['2.0'] - a.phase['1.1'];
  void aLen;
  assert(bLen > aLen2 * 1.6,
    `B-Side attack_con 1 is far longer (${aLen2} -> ${bLen} frames)`);
  assertEq(aLen2, 309, 'normal attack_con 1 -> roar: 309 frames');
  assertEq(bLen, 524, 'B-Side attack_con 1 -> roar: 524 frames');
}

// ═══ 7. final_con 2 — THE CURTAINS (Other_11:385-534) ═════════════════════
console.log('7. final_con 2 — the curtains');
{
  const rec = runFinale({ seed: 12345, invulnerable: true });
  assert(rec.soulYAtRoar !== null, 'final_con 2 was reached');
  assertEq(rec.soulYAtRoar.suck, 18, 'the roar sets player_suck to 18 (POSITIVE, upward)');

  // The volley: ten stars, alternating rows, all startype 2.
  assert(rec.firstCurtain !== null, 'a curtain volley fired');
  assertEq(rec.firstCurtain.length, 10,
    'exactly ten curtain stars — scr_approach clamps the last step onto _rightB');
  for (const s of rec.firstCurtain) {
    assertEq(s.startype, 2, 'curtain star startype 2');
    assertEq(s.spec, 1, 'curtain star spec 1');
    assertNear(s.xs, 1.18, 1e-5, 'curtain star scale 1.18');
  }
  const ys = [...new Set(rec.firstCurtain.map((s) => Math.round(s.y)))].sort((a, b) => a - b);
  assertEq(ys.length, 2, 'the curtain is TWO rows');
  assertEq(ys[1] - ys[0], 48, 'the rows are 24px either side of the spawn line');
  const xs = rec.firstCurtain.map((s) => s.x).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    assertNear(xs[i] - xs[i - 1], 124, 1e-3, 'curtain stars are 124px apart (_asep)');
  }
  // The soul is SHOVED UP, hard, and the corral catches it at the top.
  assertEq(rec.state.soul === null ? 0 : Math.round(rec.state.soul.y),
    rec.state === null ? 0 : Math.round(rec.state.view.y),
    'the soul ends the shove pinned to the top of the screen');
}

// ═══ 8. THE final_con 2 -> 3 HAND-OVER — a gmlEq on a lerped real ═════════
console.log('8. attack_max hand-over (Other_11:423)');
{
  const a = runFinale({ invulnerable: true });
  const b = runFinale({ sideb: true, invulnerable: true });
  assertEq(a.handoverMax, 9, 'normal: the tween lands on exactly 9 and opens the cut');
  assertEq(b.handoverMax, 8, 'B-Side: `9 - kaizo_sideb()` is 8');
  assert(gmlEq(a.handoverMax, 9), 'and the test is gmlEq on an accumulated real');
}

// ═══ 9. final_con 3 — THE 30 SLASH LINES (Other_11:609-688) ═══════════════
console.log('9. final_con 3 — the slash lines and their RNG budget');
{
  const rec = runFinale({ seed: 12345, invulnerable: true });
  assertEq(rec.linesCreated, 30, 'THIRTY slash lines — 15 beats of 2');
  assertEq(lines(rec.state).length, 30,
    'and all thirty are still live entities when the turn ends — nothing culls them');
  assertEq(rec.beatFrames.length, 15, 'fifteen beats');
  for (let i = 1; i < rec.beatFrames.length; i++) {
    assertEq(rec.beatFrames[i].frame - rec.beatFrames[i - 1].frame, 2,
      'a beat every SECOND frame (`attack_timer % 2 == 0`)');
  }
  // THE RNG BUDGET on a beat: irandom_range x2 (4 draws) + per line
  // irandom(639) + irandom(419) + irandom(360) (6) + random_range x2 (2).
  for (const b of rec.beatFrames) {
    assertEq(b.draws, 4 + 2 * (6 + 2), 'a beat frame takes exactly 20 u32 draws');
  }
  // ...and the frames between beats take none.
  let offBeatQuiet = true;
  for (let i = 1; i < rec.beatFrames.length; i++) {
    if (rec.drawsByFrame[rec.beatFrames[i].frame - 1] !== 0) offBeatQuiet = false;
  }
  assert(offBeatQuiet, 'the frames between beats take NO draws');

  for (const l of rec.lineSpawns) {
    assert(l.x >= 0 && l.x <= 639, 'line x from irandom(639), screen space');
    assert(l.y >= 0 && l.y <= 419, 'line y from irandom(419), screen space');
    assert(l.angle >= 0 && l.angle <= 360, 'line angle from irandom(360)');
    assertNear(l.xs, 0.2, 1e-5, 'line spawns 0.2 wide');
    assertEq(l.ys, 800, 'line is 800x tall on a 10px mask — an 8000px bar');
    assertEq(l.mask, FINALSLASH_MASK, 'line collides on spr_roaringknight_finalslash_mask');
  }

  // The tell: one frame before the test they go white and DOUBLE in width.
  assert(rec.lineSnapshotBeforeHit !== null, 'the widen frame ran');
  assertEq(rec.lineSnapshotBeforeHit.length, 30, 'all thirty widen');
  for (const l of rec.lineSnapshotBeforeHit) {
    assertNear(l.xs, 0.4, 1e-5, 'widened to 0.4 for the test');
    // `c_white` as the RENDERER takes it — an [r, g, b] array, the shape
    // every other sim colour has (sim/attacks/splitslash.js WHITE). This
    // used to pin the literal string 'c_white', which the translation carried
    // by mistake and which render/draw/gm.js tinted() throws on by design;
    // the kaizo render smoke found the crash at the finale (roaring-final.js,
    // "GML COLOUR CONSTANTS AS THE RENDERER TAKES THEM"), so the pin moved
    // with the fix. Compared by value: assertEq is `!==` and an array is a
    // reference.
    assertEq(JSON.stringify(l.blend), JSON.stringify([255, 255, 255]), 'and flashed white');
  }

  // ORIGINAL BUG: the 0.3 / 0.2 writes land on the CONTROLLER, not the line.
  assertNear(rec.ctrlXscaleAfterHit, 0.2, 1e-5,
    'ORIGINAL BUG: the controller ends the hit loop at image_xscale 0.2');
  assertNear(rec.lineXscaleAfterHit, 0.4, 1e-5,
    'ORIGINAL BUG: the LINE is untouched at 0.4 — that is the real hitbox');
}

// ═══ 10. THE CUT hands con 101 to the stars (Other_11:595-600) ════════════
console.log('10. the cut frame promotes every star to con 101');
{
  const rec = runFinale({ seed: 12345, invulnerable: true });
  assert(rec.con101 > 0, 'surviving stars are handed con = 101 at the cut');
  assert(rec.specClearedAtCut, 'and `spec = 0; outbound = true` with it');
  assert(rec.starchildren > 0,
    'the con-101 burst fires the mod\'s six-way starchild fan three frames later');
}

// ═══ 11. THE HIT — scr_damage_all_maxhp(0.75, 1, 0) (Other_11:764-798) ════
//
// A CONTROLLED scenario rather than a seeded one: the finale is dropped into
// final_con 3 / attack_con 4 with ONE hand-placed line, so whether it
// connects is geometry we choose instead of a seed we hope for.
console.log('11. the hit — 75% of MAX HP, ignoring DEFEND, able to fell');

function hitScenario({ throughSoul = true, invulnerable = false, defend = false,
  hp = null, seed = 12345 } = {}) {
  const { state, e } = build({ ac: 104, seed });
  stepFrame(state, {}); // let the scene settle and the 2px mask land
  if (hp) state.partyHp = hp.slice();
  if (defend) state.charaction = [ACTION_DEFEND, ACTION_DEFEND, ACTION_DEFEND];
  state.invTimer = invulnerable ? 60 : -1;
  const soul = state.soul;
  soul.x = 310;
  soul.y = 200;
  e.final_con = 3;
  e.attack_con = 4;
  e.attack_timer = 0;
  e.final_lines = [];
  // Screen space, exactly as scr_marker stores it: the test adds the camera.
  const l = spawn(state, finalSlashLine, {
    x: (throughSoul ? soul.x + 10 : soul.x + 400) - state.view.x,
    y: (soul.y + 10) - state.view.y,
  });
  l.image_angle = 0;
  l.image_yscale = 800;
  l.image_xscale = 0.2;
  e.final_lines.push(l);
  const before = state.partyHp.slice();
  stepFrame(state, {}); // attack_timer 1 — the lines whiten and widen to 0.4
  stepFrame(state, {}); // attack_timer 2 — THE TEST
  return { state, e, before, after: state.partyHp.slice() };
}

{
  const want = PARTY.map((p) => Math.ceil(p.maxhp * 0.75)); // 120 / 143 / 105
  const hit = hitScenario({ throughSoul: true });
  assertEq(hit.e.final_hit, 1, 'a line through the soul sets final_hit');
  for (let i = 0; i < 3; i++) {
    assertEq(hit.before[i] - hit.after[i], want[i],
      `slot ${i} takes ceil(maxhp * 0.75) = ${want[i]}`);
  }
  assert(hit.state.invTimer > 0, 'the hit grants global.invc * 30 frames of mercy');

  const miss = hitScenario({ throughSoul: false });
  assertEq(miss.e.final_hit, 0, 'a line NOT through the soul does not');
  assertEq(miss.before.join(), miss.after.join(), 'and deals nothing');

  const inv = hitScenario({ throughSoul: true, invulnerable: true });
  assertEq(inv.e.final_hit, 0, '`if (global.inv < 0)` gates the hit');
  assertEq(inv.before.join(), inv.after.join(), 'an invulnerable soul takes nothing');

  // arg1 = 1 -> IGNORE DEFEND. Without it the sim would divide by 1.5.
  const def = hitScenario({ throughSoul: true, defend: true });
  for (let i = 0; i < 3; i++) {
    assertEq(def.before[i] - def.after[i], want[i],
      `DEFEND does not reduce it (arg1 = 1), slot ${i}`);
  }

  // arg2 = 0 -> IT CAN FELL YOU, and felling the whole party trips the mod's
  // scripted failure: everyone is restored to exactly 1 HP.
  const wipe = hitScenario({ throughSoul: true, hp: [10, 10, 10] });
  assertEq(wipe.e.final_hit, 1, 'the wipe run still registers the hit');
  assertEq(wipe.e.final_kill, 1, 'all three below 0 -> final_kill');
  assertEq(wipe.after.join(), '1,1,1', 'and the party is restored to 1 HP each');
}

// ═══ 12. THE SHATTER AND THE TURN END (Other_11:805-875) ══════════════════
console.log('12. the shatter, and THE TURN ENDING ITSELF');
{
  // Continue the controlled scenario to the end of the turn.
  function runOut(opts) {
    const s = hitScenario(opts);
    let end = -1;
    let shatter = -1;
    for (let f = 0; f < 400; f++) {
      if (shatter < 0 && (s.state.knight?.shatter_insts?.length ?? 0) > 0) {
        shatter = s.state.knight.shatter_insts.length;
      }
      stepFrame(s.state, {});
      if (s.state.turntimer === -1) { end = f; break; }
    }
    return { ...s, end, shatter };
  }
  const hit = runOut({ throughSoul: true });
  const miss = runOut({ throughSoul: false });
  assertEq(hit.shatter, 31, 'scr_screenshatter_create makes 31 pieces');
  assertEq(miss.shatter, 31, 'on the miss path too');
  assert(hit.end > 0, 'the finale ends its own turn after a hit');
  assert(miss.end > 0, 'and after a miss');
  assertEq(hit.end - miss.end, 6,
    'a landed hit buys exactly 6 more frames (`attack_timer = -6`)');
  assertEq(miss.state.turntimer, -1, 'global.turntimer = -1 — the clock is handed back');
  assertEq(miss.state.soul, null, 'obj_heart is destroyed with it');

  // ...and the same thing from a full, unforced run, in both modes. A
  // finale that did not terminate would deadlock the V-C schedule, so this
  // is the assertion the work item exists for.
  const full = runFinale({ invulnerable: true });
  const fullB = runFinale({ sideb: true, invulnerable: true });
  assert(full.endFrame > 0 && full.endFrame < 2000,
    `normal: the turn ends unaided at frame ${full.endFrame}`);
  assert(fullB.endFrame > 0 && fullB.endFrame < 2400,
    `B-Side: the turn ends unaided at frame ${fullB.endFrame}`);
  assertEq(full.state.turntimer, -1, 'normal run hands the clock back');
  assertEq(full.state.soul, null, 'normal run destroys obj_heart');
  assertEq(fullB.state.turntimer, -1, 'B-Side run hands the clock back');
  // The shatter's RNG budget is the last thing the finale spends: choose x2
  // then five random() per piece, plus two irandoms per piece when a landed
  // hit set shatter_delay = 6.
  const shatterFrame = full.drawsByFrame.findIndex((d) => d > 100);
  assertEq(full.drawsByFrame[shatterFrame], 2 + 31 * 5,
    'scr_screenshatter_create takes 157 draws with no delay');
}

// ═══ 13. THE MOD'S STAR CATCH — obj_knight_enemy Other_12 ═════════════════
console.log('13. the retuned star catch (30 / 25, the 1-HP hole, hp_visible)');
{
  function catchOnce({ hp, defend = false }) {
    const { state, e } = build({ ac: 104 });
    stepFrame(state, {});
    state.partyHp = hp.slice();
    if (defend) state.charaction = [ACTION_DEFEND, ACTION_DEFEND, ACTION_DEFEND];
    state.invTimer = -1;
    const before = state.partyHp.slice();
    kaizoKnightCatch(state);
    return { state, e, before, after: state.partyHp.slice() };
  }
  // The catch's raw damage is not observable directly — scr_damage runs the
  // DF walk on top of it — so every number below is measured against a
  // scr_damage CONTROL fed the value the mod's Other_12 passes. A catch that
  // still passed the vanilla 40 fails these.
  function control(raw, { defend = false, hp = [160, 190, 140] } = {}) {
    const { state } = build({ ac: 104 });
    stepFrame(state, {});
    state.partyHp = hp.slice();
    if (defend) state.charaction = [ACTION_DEFEND, ACTION_DEFEND, ACTION_DEFEND];
    state.invTimer = -1;
    const before = state.partyHp.slice();
    for (let ti = 0; ti < 3; ti++) {
      state.invTimer = -1;
      scrDamage(state, raw, ti, { truedamage: true });
    }
    return before.map((h, i) => h - state.partyHp[i]);
  }

  const plain = catchOnce({ hp: [160, 190, 140] });
  assertEq(plain.e.hp_visible, 1,
    'the first catch REVEALS the party HP HUD (`with (obj_knight_roaring2) hp_visible = 1`)');
  const dealt = plain.before.map((h, i) => h - plain.after[i]);
  assertEq(dealt.join(), control(30).join(), 'the catch passes 30 (kaizo), not 40');
  assert(dealt.join() !== control(40).join(), 'and 40 (vanilla) gives a different result');

  const def = catchOnce({ hp: [160, 190, 140], defend: true });
  const defDealt = def.before.map((h, i) => h - def.after[i]);
  assertEq(defDealt.join(), control(25, { defend: true }).join(),
    'DEFEND drops the raw to 25 — vanilla Other_12 has no such term');
  assert(defDealt.join() !== control(30, { defend: true }).join(),
    'and it is a REDUCTION, not just the sim damage path defend math');

  // `if (hp > 1 && hp <= damage) damage = hp - 1` — the survival clamp,
  // rewritten against the LIVE damage instead of a hardcoded 41. Chosen so
  // the clamp is the ONLY thing between the member and death.
  const low = catchOnce({ hp: [3, 190, 140] });
  assert(low.after[0] > 0, 'the clamp keeps a 3-HP member alive');
  assert(control(30, { hp: [3, 190, 140] })[0] >= 3,
    '...where the unclamped 30 would have felled them');

  // THE 1-HP HOLE, preserved: `hp > 1` excludes someone already on 1, so the
  // clamp that is meant to spare them does not run at all.
  const one = catchOnce({ hp: [1, 190, 140] });
  assert(one.after[0] < 0, 'ORIGINAL: a member already on 1 HP takes the full hit and dies');
}

// ═══ 13b. CleanUp_0's kaizo hunks (kaizo 38-51) ═══════════════════════════
console.log('13b. the finale teardown');
{
  const rec = runFinale({ invulnerable: true });
  const e = rec.e;
  // The turn sweep would do this anyway; the exported helper is for a
  // launcher that wants the mod's own teardown explicitly.
  e.hideback = { alive: true };
  const live = e.final_lines.filter((l) => l.alive).length;
  assert(live > 0, 'lines survive to the end of the turn');
  roaringFinalCleanUp(rec.state, e);
  assertEq(e.final_lines.length, 0, 'CleanUp destroys every final_lines marker');
  assertEq(e.hideback, -4, 'and the hideback cover');
  assertEq(lines(rec.state).filter((l) => l.alive).length, 0, 'nothing is left alive');
}

// ═══ 14. DETERMINISM ══════════════════════════════════════════════════════
console.log('14. determinism');
{
  const digest = (r) => `${r.endFrame}|${r.linesCreated}|`
    + r.lineSpawns.map((l) => `${l.x},${l.y},${l.angle}`).join(';');
  const a = runFinale({ seed: 4242, invulnerable: true });
  const b = runFinale({ seed: 4242, invulnerable: true });
  const c = runFinale({ seed: 777, invulnerable: true });
  assertEq(digest(a), digest(b), 'same seed -> identical slash lines and end frame');
  assert(digest(a) !== digest(c), 'different seed -> different slash lines');
  assertEq(a.linesCreated, 30, 'seed 4242 also makes 30 lines');
  assertEq(c.linesCreated, 30, 'seed 777 also makes 30 lines');
  assert(a.endFrame > 0 && c.endFrame > 0, 'and both end their turn');
}

console.log(`\n${checks - failures}/${checks} assertions passed`);
if (failures) {
  console.log(`${failures} FAILURES`);
  process.exit(1);
}
console.log('check-roaring-final: OK');
process.exit(0);
