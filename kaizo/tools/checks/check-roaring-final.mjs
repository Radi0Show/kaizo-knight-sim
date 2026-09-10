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
// ADDED 2026-09-08 (the roaring gap report's G2/G3/G4/G5/G10/G15 — every
// routing the report found wrong by reading, with its GML receipt):
//   - §15 the hit goes through kaizo/party/damage.js's scr_damage_all_maxhp:
//     the V-C shape (no roster installed) still deals ceil(maxhp * 0.75);
//     the B-Side Weird Route party takes ceil(ceil(maxhp * 0.75) * 0.8) with
//     ceil(tdamage / 4) gloom on Kris, Noelle's x0.75 NOT applied (two gates
//     the finale fails), and a two-person wipe trips the scripted failure
//   - §16 a con-101 starchild touching the soul IN THE ROAR is the knight's
//     catch (Other_12), flat 30 / 25 defending, raising hp_visible; outside
//     the roar it is still the parent's 75; a B-Side catch banks 10 gloom
//   - §17 CleanUp_0 fires on the sweep: chargeupcon 3 -> 0, siner2 0,
//     image_alpha 1, the roar's sounds stopped, lines and hideback gone —
//     in both roaring modes
//   - §18 the con-101 children's lifetime in the roar (the Draw_0:107-123
//     block is a no-op; the child's own fade is what kills them)
//   - §19 THE ONLY RECORDING-BACKED ASSERTION HERE: the 256
//     obj_afterimage_fade_to_white directions of the _knightglow lock sit in
//     ONE anchored stream, the charge-up's own rolls are consecutive, and
//     the sim's random(360) from the same index reproduces them. SKIPs
//     loudly without the recording.
//
// PUBLISH GATE: V-C recreation of EnderCat8's Kaizo Roaring Knight — do not
// publish without permission.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createState, stepFrame } from '../../../sim/index.js';
import { destroy, spawn } from '../../../sim/entity.js';
import { buildSingleAttackScene, } from '../../../sim/scenes/single.js';
import { clearTurn } from '../../../sim/scenes/fight.js';
import { tickChargeup } from '../../../sim/knight.js';
import { gmlCreate, gmlU32, gmlRandom } from '../../../sim/rng.js';
import { ensureSoul } from './scaffold-soul.mjs';
import { PARTY, ACTION_DEFEND } from '../../../sim/damage.js';
import { gmlEq } from '../../../sim/gml.js';
import { roaring2, finalSlashLine, roaringFinalCleanUp } from '../../attacks/roaring-final.js';
import { kaizoKnightCatch } from '../../attacks/roaring-final-star.js';
import { pointingStarchild } from '../../attacks/stars-pointing-starchild.js';
import { HEART_2PX_MASK, FINALSLASH_MASK } from '../../attacks/knight-stream.js';
import {
  installRoster, NORMAL_ROUTE_PARTY, WEIRD_ROUTE_PARTY, CHAR_KRIS, CHAR_NOELLE,
} from '../../party/roster.js';
import { resolveTraces, readTrace } from './check-oracle-schedule.mjs';

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
function build({ ac = 104, sideb = false, seed = 12345, invc = 0.5, roster = null } = {}) {
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
  // `roster`: null is THE V-C SHAPE — kaizo-fight.js installs a roster only
  // for a version that declares a party (V-D), so the shipped A-Side scene
  // runs the party module on its vanilla-three fallback. The sections that
  // need the mod's data layer (B-Side gloom, the two-person Weird Route)
  // install one the way kaizo-fight.js does for V-D.
  if (roster) installRoster(state, { charIds: roster, sideb });
  state.currentAc = ac;      // obj_knight_enemy.myattackchoice
  state.turntimer = 999999;  // the type-107 PINNER the launcher applies
  state.invc = invc;
  // Born AT THE KNIGHT, as kaizo-mod-launcher.js case 107 spawns it since
  // 2026-09-08 (dbulletcontroller Step_0:2259); Create hoists it y -= 320.
  const knight = state.entities.find((x) => x.alive && x.type.name === 'obj_knight_enemy');
  const e = spawn(state, roaring2, {
    x: knight ? knight.x : state.view.x + 425,
    y: knight ? knight.y : state.view.y + 77,
  });
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
    // per con-101 child: { birth, lastSeen, activeOff, lastX, lastY, difficulty }
    kids: [],
    knightConAtEnd: null,
  };
  let key = `${e.final_con}.${e.attack_con}`;
  rec.phase[key] = -1;
  const seen = new Set(stars(state));
  const seenKids = new Set();
  const kidRec = new Map();
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
    // The children's lifetimes (§18). A reaped entity leaves the list, so
    // "last seen alive" is the observable; the death frame is the one after.
    for (const k of state.entities) {
      if (!k.alive || k.type.name !== 'obj_knight_pointing_starchild') continue;
      let r = kidRec.get(k);
      if (!r) {
        r = { birth: f, lastSeen: f, activeOff: -1, lastX: k.x, lastY: k.y, difficulty: k.difficulty };
        kidRec.set(k, r);
        rec.kids.push(r);
      }
      r.lastSeen = f;
      r.lastX = k.x;
      r.lastY = k.y;
      if (r.activeOff < 0 && !(k.active === 1 || k.active === true)) r.activeOff = f;
    }

    if (state.turntimer === -1) {
      rec.endFrame = f;
      rec.knightConAtEnd = state.knight ? state.knight.chargeupcon : null;
      break;
    }
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
  // 242, AND THE NUMBER IS THE MOD'S NOW, NOT THIS SIM'S. It read 243 from
  // 2026-08 until 2026-09-09, measured off the translation itself — which is
  // all this file's numbers ever were (see the header). The RoaringDelta locks
  // of 2026-09-09 settle it: final_con 0 -> 1 at C+120 and attack_con 0 -> 1 at
  // C+362 on all four 2,400-frame launches, A-Side and B-Side, so the span is
  // 242. The sim printed 243 because the "attack_grav >= 12.5" gate was an
  // exact JS comparison where the runner's is epsilon-tolerant, and
  // scr_approach's ramp sits at 12.499999999999904 on the frame the game fires
  // (roaring-final.js at that gate carries the arithmetic). Fixing the
  // comparison moved this to 242 and turned a green assertion RED, which is the
  // right way round: a self-measured expectation should fail the moment a
  // recording disagrees with it. check-oracle-roaringdelta owns this claim now.
  assertEq(rec.phase['1.1'] - rec.phase['1.0'], 242,
    "attack_con 0 lasts 242 frames (C+120 -> C+362, the locks' number)");  assert((rec.phase['1.1.5'] ?? -1) > rec.phase['1.1'],
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
  hp = null, seed = 12345, roster = null, sideb = false } = {}) {
  const { state, e } = build({ ac: 104, seed, roster, sideb });
  stepFrame(state, {}); // let the scene settle and the 2px mask land
  if (hp) state.partyHp = hp.slice();
  if (defend) state.charaction = state.partyHp.map(() => ACTION_DEFEND);
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
  // THE CATCH IS FLAT. Other_12 calls scr_damage() with obj_knight_roaring2
  // alive, and the mod's scr_damage sets `truedamage = 1` on exactly that
  // (kaizo gml_GlobalScript_scr_damage.gml:84-87); both defence branches are
  // then EMPTY — `if (chapter == 3 && truedamage == 1) { }` at :128 (no
  // scr_damage_calculation) and again at :162 (no DEFEND 2/3, no element) —
  // so the number Other_12 passes is the number that lands: 30, 25 under
  // DEFEND, hp - 1 under the clamp. These used to be measured against the
  // VENDORED scrDamage as a control, which runs the DF walk under truedamage
  // (30 came out 5 / 19 / 15) — a sim/damage.js deviation from the vanilla
  // GML's own empty branch (v105 scr_damage.gml:183, :213), which is why the
  // catch is routed through kaizo/party/damage.js since 2026-09-08 (G5).
  const plain = catchOnce({ hp: [160, 190, 140] });
  assertEq(plain.e.hp_visible, 1,
    'the first catch REVEALS the party HP HUD (`with (obj_knight_roaring2) hp_visible = 1`)');
  const dealt = plain.before.map((h, i) => h - plain.after[i]);
  assertEq(dealt.join(), '30,30,30', 'the catch lands 30 FLAT on each member (truedamage: no DF walk)');

  const def = catchOnce({ hp: [160, 190, 140], defend: true });
  const defDealt = def.before.map((h, i) => h - def.after[i]);
  assertEq(defDealt.join(), '25,25,25',
    'DEFEND drops the raw to 25 — vanilla Other_12 has no such term, and no 2/3 applies');

  // `if (hp > 1 && hp <= damage) damage = hp - 1` — the survival clamp,
  // rewritten against the LIVE damage instead of a hardcoded 41. Chosen so
  // the clamp is the ONLY thing between the member and death.
  const low = catchOnce({ hp: [3, 190, 140] });
  assertEq(low.after[0], 1, 'the clamp leaves a 3-HP member on exactly 1');
  const lowDef = catchOnce({ hp: [26, 190, 140], defend: true });
  assertEq(lowDef.after[0], 1,
    'clamp against the LIVE 25: a defending member on 26 is clamped (vanilla `hp < 41` would not be)');

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

// ═══ 15. G2 — THE HIT IS THE MOD'S scr_damage_all_maxhp ══════════════════
//
// kaizo gml_GlobalScript_scr_damage_all.gml:30-55 -> scr_damage_maxhp.gml,
// via kaizo/party/damage.js (roaring-final.js imports it since 2026-09-08;
// before that the finale ran the VENDORED VANILLA scrDamageMaxhp under a
// local wrapper, which has no B-Side softening, no gloom and no progamer).
console.log('15. G2 — the hit routes through kaizo/party/damage.js (scr_damage_all_maxhp)');
{
  // (a) THE V-C SHAPE — no roster installed, the shipped A-Side scene. The
  // party module reads maxhp off the roster (0 without one — the finale
  // measured 0 damage the moment the import moved), so roaring-final.js
  // stands the Normal Route three up for the length of the call. Same
  // numbers as §11, and no roster left behind.
  const want = PARTY.map((p) => Math.ceil(p.maxhp * 0.75)); // 120 / 143 / 105
  const vc = hitScenario({ throughSoul: true });
  assertEq(vc.state.kaizo.roster, undefined, 'V-C shape: the scene installs no roster');
  for (let i = 0; i < 3; i++) {
    assertEq(vc.before[i] - vc.after[i], want[i],
      `V-C shape: slot ${i} still takes ceil(maxhp * 0.75) = ${want[i]} through the party module`);
  }
  assertEq(vc.state.kaizo.roster, undefined, 'and the call-scoped roster shim leaves none behind');

  // (b) The Normal Route roster INSTALLED (the shape the party layer wants):
  // identical numbers, no shim needed.
  const nr = hitScenario({ throughSoul: true, roster: NORMAL_ROUTE_PARTY });
  assertEq(nr.state.kaizo.roster.length, 3, 'Normal Route roster: three members');
  for (let i = 0; i < 3; i++) {
    assertEq(nr.before[i] - nr.after[i], want[i], `Normal Route roster: slot ${i} takes ${want[i]}`);
  }

  // (c) THE B-SIDE, on the party it actually runs with — the Weird Route's
  // Kris + Noelle (V-D installs exactly this). scr_damage_maxhp.gml:170-174:
  //     tdamage = ceil(maxhp * 0.75);
  //     _gloomdmg = ceil(tdamage / 4);  tdamage = ceil(tdamage * 0.8);
  // Kris 160 -> 120 -> 96, gloom 30. Noelle 120 -> 90 -> 72, and NOT
  // ceil(ceil(120 * 0.75 * 0.75) * 0.8) = 55: her x0.75 (:161-164) sits inside
  // `!i_ex(obj_knight_roaring2)` (:60) AND `aoedamage == false` (:61), and
  // the finale's hit fails both gates. Gloom lands on Kris only — the
  // ThornRing (`charweapon[4] == 13`, :249-252) zeroes Noelle's — with NO 45
  // cap on this path (:253-256 has only the hp-1 clamp).
  const b = hitScenario({ throughSoul: true, roster: WEIRD_ROUTE_PARTY, sideb: true });
  assertEq(b.state.partyHp.length, 2, 'Weird Route roster: two members');
  assertEq(b.state.kaizo.roster[0].charId, CHAR_KRIS, 'slot 0 is Kris');
  assertEq(b.state.kaizo.roster[1].charId, CHAR_NOELLE, 'slot 1 is Noelle');
  const krisMax = b.state.kaizo.roster[0].maxhp;
  const noelleMax = b.state.kaizo.roster[1].maxhp;
  assertEq(b.e.final_hit, 1, 'B-Side: the line lands');
  assertEq(b.before[0] - b.after[0], Math.ceil(Math.ceil(krisMax * 0.75) * 0.8),
    `B-Side Kris takes ceil(ceil(${krisMax} * 0.75) * 0.8) = ${Math.ceil(Math.ceil(krisMax * 0.75) * 0.8)}`);
  assertEq(b.before[1] - b.after[1], Math.ceil(Math.ceil(noelleMax * 0.75) * 0.8),
    `B-Side Noelle takes ceil(ceil(${noelleMax} * 0.75) * 0.8) = ${Math.ceil(Math.ceil(noelleMax * 0.75) * 0.8)} — NO x0.75 in the roar`);
  assert(b.before[1] - b.after[1] !== Math.ceil(Math.ceil(noelleMax * 0.75 * 0.75) * 0.8),
    'and it is not the x0.75-then-softened number');
  assertEq(b.state.kaizo.gloom[0], Math.ceil(Math.ceil(krisMax * 0.75) / 4),
    `B-Side gloom on Kris = ceil(tdamage / 4) = ${Math.ceil(Math.ceil(krisMax * 0.75) / 4)}, banked from the PRE-softened number`);
  assertEq(b.state.kaizo.gloom[1], 0, 'B-Side gloom on Noelle = 0 (ThornRing immunity)');
  assert(b.state.invTimer > 0, 'the B-Side hit grants invc * 30 too');

  // (d) THE SCRIPTED WIPE ON A TWO-PERSON PARTY. Other_11:786-794 is
  // character-indexed with `!scr_havechar(c) ||` clauses, so the absent ids
  // 2 and 3 pass and two fells are a wipe. The partyHp[0..2] form this
  // replaced could never fire here (a third index that is undefined).
  const wipe = hitScenario({ throughSoul: true, roster: WEIRD_ROUTE_PARTY, sideb: true, hp: [10, 10] });
  assertEq(wipe.e.final_hit, 1, 'two-person wipe: the hit lands');
  assertEq(wipe.e.final_kill, 1, 'two-person wipe: both below 0 -> final_kill');
  assertEq(wipe.after.join(), '1,1', 'and both are restored to exactly 1 HP');
  assertEq(wipe.state.partyHp.length, 2, 'no phantom third member was written');
}

// ═══ 16. G3 / G5 — A STARCHILD IN THE ROAR IS THE CATCH ═════════════════
//
// kaizo obj_knight_pointing_starchild_Other_15.gml:1-16 — `if
// (i_ex(obj_knight_roaring2)) { if (active == 1) { ...scr_precise_hit...;
// with (obj_knight_enemy) event_user(2); } }` — the knight's Other_12, the
// same 30 / 25 / hp-1 catch §13 pins, with `hp_visible = 1`. The non-roar arm
// (34-68) is the parent's `target = 3; damage = 75`. Until 2026-09-08 the
// sim ran the 75 in both.
console.log('16. G3/G5 — a con-101 starchild touching the soul in the roar is the catch');
{
  function childTouch({ roster = null, sideb = false, defend = false, hp = null, roar = true } = {}) {
    const { state, e } = build({ ac: 104, roster, sideb });
    stepFrame(state, {}); // roaring2 alive, state.roaringActive latched
    if (!roar) {
      destroy(e, state);
      stepFrame(state, {}); // re-latch: no obj_knight_roaring2 any more
    }
    if (hp) state.partyHp = hp.slice();
    if (defend) state.charaction = state.partyHp.map(() => ACTION_DEFEND);
    if (state.knight) state.knight.progamer = true;
    const d = spawn(state, pointingStarchild, { x: state.soul.x, y: state.soul.y });
    d.active = 1;
    d.destroyonhit = 0;
    state.invTimer = -1;
    const before = state.partyHp.slice();
    pointingStarchild.other15(d, state);
    return { state, e, d, before, after: state.partyHp.slice() };
  }

  const inRoar = childTouch({ hp: [160, 190, 140] });
  const dealt = inRoar.before.map((h, i) => h - inRoar.after[i]);
  assertEq(dealt.join(), '30,30,30', 'in the roar: the catch, 30 flat to each member — not 75');
  assertEq(inRoar.e.hp_visible, 1, 'in the roar: the touch REVEALS the party HP HUD');
  assertEq(inRoar.d.alive, true, 'destroyonhit 0: the child passes through');
  assert(inRoar.state.invTimer > 0, 'the catch grants invc * 30');
  assertEq(inRoar.state.knight.progamer, false, 'scr_damage: `progamer = false` — the hitless run ends');

  const def = childTouch({ hp: [160, 190, 140], defend: true });
  assertEq(def.before.map((h, i) => h - def.after[i]).join(), '25,25,25',
    'in the roar, DEFENDING: 25 (Other_12\'s `_dmg - 5`), no 2/3');

  const outside = childTouch({ hp: [160, 190, 140], roar: false });
  const outDealt = outside.before.map((h, i) => h - outside.after[i]);
  assert(outDealt.join() !== '30,30,30', `outside the roar it is NOT the catch (${outDealt.join()})`);
  assert(outDealt.every((x) => x > 0), 'outside the roar: the parent\'s party-wide 75 still lands');
  assertEq(outside.e.hp_visible, 0, 'and nothing raises hp_visible outside the roar');

  // G5: scr_damage.gml:5-17 on the B-Side — `_gloomdmg = ceil(damage / 6)`,
  // floored at 10, banked per member per catch with the 45 cap (:245-261
  // of scr_damage). ceil(30 / 6) = 5 -> 10 on Kris; Noelle's ThornRing
  // zeroes hers. The vendored scrDamage banked nothing.
  const bs = childTouch({ roster: WEIRD_ROUTE_PARTY, sideb: true });
  assertEq(bs.state.partyHp.length, 2, 'B-Side catch on the two-person party');
  assertEq(bs.before.map((h, i) => h - bs.after[i]).join(), '30,30', 'B-Side catch: 30 flat to both');
  assertEq(bs.state.kaizo.gloom[0], 10, 'B-Side catch banks ceil(30 / 6) = 5 -> floored to 10 gloom on Kris');
  assertEq(bs.state.kaizo.gloom[1], 0, 'and 0 on Noelle (ThornRing)');
  const bs2 = kaizoKnightCatch(bs.state);
  void bs2;
  assertEq(bs.state.kaizo.gloom[0], 10, 'a second catch inside invulnerability banks nothing');
  bs.state.invTimer = -1;
  kaizoKnightCatch(bs.state);
  assertEq(bs.state.kaizo.gloom[0], 20, 'a second catch after it banks another 10');
}

// ═══ 17. G4 — CleanUp_0 FIRES ON THE SWEEP, BOTH MODES ═══════════════════
//
// kaizo gml_Object_obj_knight_roaring2_CleanUp_0.gml:24-51. GameMaker runs it
// on the turn sweep's instance_destroy; the engine fires the type's
// `cleanUp(e, state)` from clearTurn's destroy(e, state). Until 2026-09-08
// the finale declared none, so after atk_RoaringDelta the knight stayed at
// chargeupcon 3 with an unreset bob, and the mod's fight-end gate
// (`chargeupcon == 0`, Draw_0:151) could never have opened.
console.log('17. G4 — CleanUp_0:24-51 on the sweep: chargeupcon 0, siner2 0, sounds, lines');
{
  const rec = runFinale({ invulnerable: true });
  assert(rec.endFrame > 0, 'the finale handed the clock back');
  assertEq(rec.knightConAtEnd, 3, 'at the hand-back the knight is still HIDDEN: chargeupcon 3');
  const knightEnt = rec.state.entities.find((x) => x.alive && x.type.name === 'obj_knight_enemy');
  knightEnt.siner2 = 77; // whatever the frozen bob was
  rec.state.audioCues = [];
  const liveLines = lines(rec.state).length;
  assert(liveLines > 0, 'the 30 lines are still live entities before the sweep');
  clearTurn(rec.state);
  assertEq(rec.e.alive, false, 'the sweep destroys obj_knight_roaring2');
  assertEq(rec.e.cleanedUp, true, 'and the type cleanUp ran on that route');
  assertEq(rec.state.knight.chargeupcon, 0, 'CleanUp: chargeupcon = 0 (the mod\'s fight-end gate re-opens)');
  assertEq(knightEnt.siner2, 0, 'CleanUp: siner2 = 0 (the bob restarts at its top)');
  assertEq(knightEnt.image_alpha, 1, 'CleanUp: image_alpha = 1');
  for (const s of ['snd_knight_stretch', 'snd_knight_roar', 'snd_stardrop', 'snd_knight_cut']) {
    assert(rec.state.audioCues.some((c) => c.stop && c.name === s), `CleanUp: snd_stop(${s})`);
  }
  assertEq(lines(rec.state).length, 0, 'CleanUp: every final_lines[] marker destroyed');
  assertEq(rec.e.hideback, -4, 'CleanUp: hideback destroyed');
  // The labelled deviation: the one obj_growtangle this engine keeps per
  // fight survives the sweep (SURVIVES_TURN), collapsed by attack_con 5.
  const gt = rec.state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
  assert(gt && gt.growcon === 3 && gt.visible === false,
    'DEVIATION (labelled): the growtangle is collapsed and hidden, not destroyed — the engine keeps one per fight');

  // The ORDINARY kaizo roar (roaring_type 0): the same CleanUp on the same
  // route. Its roaring_timer-375 block already zeroes chargeupcon inline;
  // a sentinel proves the sweep's cleanUp runs in this mode too.
  const v = build({ ac: 9 });
  let vEnd = -1;
  for (let f = 0; f < 900; f++) {
    v.state.invTimer = 90;
    stepFrame(v.state, {});
    if (v.state.turntimer === -1) { vEnd = f; break; }
  }
  assert(vEnd > 0, 'ordinary mode: the roar ends its turn');
  v.state.knight.chargeupcon = 3;
  const vKnight = v.state.entities.find((x) => x.alive && x.type.name === 'obj_knight_enemy');
  vKnight.siner2 = 55;
  clearTurn(v.state);
  assertEq(v.e.cleanedUp, true, 'ordinary mode: cleanUp ran on the sweep');
  assertEq(v.state.knight.chargeupcon, 0, 'ordinary mode: chargeupcon = 0 at the sweep');
  assertEq(vKnight.siner2, 0, 'ordinary mode: siner2 = 0 at the sweep');
}

// ═══ 18. G10 — THE con-101 CHILDREN'S LIFETIME IN THE ROAR ══════════════
//
// kaizo roaring2 Draw_0:107-123 runs `with (obj_knight_pointing_starchild)
// { image_alpha = clamp01(remap(45, 60, 1, 0, timer)); if (< 1) active =
// false; if (== 0) instance_destroy(); }` — on the CHILD'S `timer`, which
// starchild Step_0:31 freezes at 0 while obj_knight_roaring2 exists, so it
// reads 1 forever: a no-op (the report's G10, argued, now asserted). What
// kills them is the child's own Draw fade on `drawtimer` (kaizo starchild
// Draw_0:48-52, difficulty 0 from Create): active off past drawtimer 45,
// destroyed at 60 — or obj_regularbullet's off-screen cull first (speed 5
// in a fixed six-way fan from the top-edge curtain stars, no deceleration
// while the roar lives). Either way NOTHING outlives drawtimer 60.
console.log('18. G10 — con-101 starchildren: cull or fade, nothing past 60 frames');
{
  const rec = runFinale({ seed: 12345, invulnerable: true });
  const kids = rec.kids;
  assert(kids.length > 0, `con-101 children were born (${kids.length})`);
  const births = [...new Set(kids.map((k) => k.birth))];
  assertEq(births.length, 1, 'every child is born on ONE frame — the promoted stars burst together (timer 3)');
  assert(kids.every((k) => k.difficulty === 0), 'every child has difficulty 0 (Create), so the fade gate is open');
  const maxLife = Math.max(...kids.map((k) => k.lastSeen - k.birth));
  assert(maxLife <= 59, `no child is seen past birth + 59 (drawtimer 60 destroys it): max +${maxLife}`);
  const faded = kids.filter((k) => k.activeOff >= 0);
  const culled = kids.filter((k) => k.activeOff < 0);
  assert(faded.length > 0, `some children live to the fade (${faded.length})`);
  assert(culled.length > 0, `some are culled off screen before it (${culled.length})`);
  assert(faded.every((k) => k.activeOff - k.birth === 45),
    'every child that reaches the fade goes INACTIVE exactly at birth + 45 (drawtimer 46 -> alpha < 1)');
  assert(culled.every((k) => k.lastSeen - k.birth < 45),
    'every child that never went inactive died before birth + 45');
  // Two ways to die early, both the GML's: obj_regularbullet's wall cull
  // (view -80 / +760 / -80 / +580 — tested at the top of the next step, so
  // the last sighting is already past the line), or the SOUL — the child's
  // Create sets `destroyonhit = 1`, and Other_15's `if (destroyonhit == 1)
  // instance_destroy()` runs in the roar arm too (starchild Other_15:28-31);
  // the curtains pin the soul to the top edge, right in the fan's path.
  const v = rec.state.view;
  const soul = rec.state.soul ?? { x: 310, y: 0 };
  const atEdge = (k) => k.lastX < v.x - 80 || k.lastX > v.x + 760 || k.lastY < v.y - 80 || k.lastY > v.y + 580;
  const atSoul = (k) => Math.abs(k.lastX - soul.x) <= 24 && Math.abs(k.lastY - soul.y) <= 24;
  const edgeDeaths = culled.filter(atEdge).length;
  const soulDeaths = culled.filter((k) => !atEdge(k) && atSoul(k)).length;
  assertEq(edgeDeaths + soulDeaths, culled.length,
    'every early death is the wall cull or a destroyonhit contact with the pinned soul');
  assert(edgeDeaths > 0, `the wall cull is exercised (${edgeDeaths})`);
  assert(soulDeaths > 0, `and so is the soul contact — the G3 route, destroyonhit 1 (${soulDeaths})`);
  console.log(`  INFO: ${kids.length} children born at frame ${births[0]}; ${faded.length} faded, `
    + `${edgeDeaths} culled at the edge, ${soulDeaths} on the soul; max lifetime +${maxLife}`);
}

// ═══ 19. G15 — THE KNIGHTGLOW RECORDING: 256 random(360)s IN ONE STREAM ═══
//
// THE ONLY ASSERTION IN THIS FILE HELD AGAINST THE REAL MOD. The
// `_knightglow` attack-lock (MODE 1, 1500 frames, three locked charge-ups)
// logs every obj_afterimage_fade_to_white the knight's charge-up makes
// (knight_enemy Step_0:1384-1407: every 4th frame past chargeuptimer 10,
// `fade.direction = random(360)` — ONE u32), and `direction` is recorded to
// ten places. Inverting each direction against the anchored WELL512 stream
// (the harness reseeds `seed + spawnn * 1000` per scr_bulletspawner; ac -1
// calls none, so the charge-up rides the FIRST launch's anchor, n = 0)
// reads the game's own draw layout off the recording (kaizo/tools/
// read-draw-layout.mjs's method):
//
//   * all 256 resolve in the n = 0 stream — the charge-up never re-anchors;
//   * inside every locked turn (mnfight 2 in the trace, the dispatch frame
//     included) consecutive rolls are CONSECUTIVE stream indices: the
//     charge-up spends exactly its one u32 per 4 frames and nothing else
//     draws — sim/knight.js tickChargeup's claim, measured;
//   * every non-1 gap sits on a between-turn frame (mnfight 0) — the
//     280-draws-per-frame plateaus after each turn end are Draw-event debt
//     of STRATEGY §2a's state-invisible class, reported, not modelled.
//
// SKIPs loudly without the recording (KAIZO_ORACLE_TRACES, or the
// knight-research layout check-oracle-schedule resolves).
console.log('19. G15 — the _knightglow lock: 256 fade_to_white directions vs the anchored stream');
{
  // run-kaizo-oracle.ps1:15 `-Seed 20260810` (and the fullfight token's line
  // 1 — the same value). The inversion succeeding at n = 0 is its receipt.
  const SEED = 20260810;
  const { dir, looked } = resolveTraces();
  const seqPath = dir ? join(dir, 'kaizo_oracle_seq_knightglow.csv') : null;
  const tracePath = dir ? join(dir, 'kaizo_oracle_trace_knightglow.csv') : null;
  if (!seqPath || !existsSync(seqPath) || !existsSync(tracePath)) {
    console.log('  SKIP §19: no _knightglow recording (kaizo_oracle_seq_knightglow.csv + trace) found in '
      + (dir ?? (looked ?? [join(homedir(), 'knight-research', 'kaizo-mod', 'traces')]).join(' / ')));
  } else {
    const seqRows = readFileSync(seqPath, 'utf8').replace(/\r/g, '').split('\n');
    const seqHead = seqRows[0].split(',');
    const cFrame = seqHead.indexOf('frame');
    const cObj = seqHead.indexOf('object');
    const cDir = seqHead.indexOf('direction');
    const fades = seqRows.slice(1).filter(Boolean).map((l) => l.split(','))
      .filter((c) => c[cObj] === 'obj_afterimage_fade_to_white')
      .map((c) => ({ frame: Number(c[cFrame]), dir: Math.fround(Number(c[cDir])) }));
    const trace = readTrace(tracePath);
    const mnfightAt = new Map();
    let dispatch = -1;
    for (const r of trace.rows) {
      const f = Number(r[trace.col.frame]);
      mnfightAt.set(f, Number(r[trace.col.mnfight]));
      if (dispatch < 0 && r[trace.col.kaizo_playing] === 'atk_KnightGlow') dispatch = f;
    }

    assertEq(fades.length, 256, 'the lock logs 256 obj_afterimage_fade_to_white rows');
    assert(dispatch > 0, `the trace names the KnightGlow dispatch frame (f${dispatch})`);
    assertEq(fades[0].frame, dispatch + 11,
      'the first ghost is dispatch + 11: chargeuptimer 1 on the dispatch frame, 12 is the first `% 4 == 0 && > 10`');
    assert(fades.every((r, i) => i === 0 || r.frame - fades[i - 1].frame === 4),
      'every 4 frames, without a gap, through three locked turns and their menus');

    // The inversion: fround(u32 / 2^32 * 360) keyed on the f32 — the recorded
    // decimal parses back to the same f32 (never compare the printed strings:
    // three rows are exact ties the runner rounds down and toFixed rounds up).
    const rng = gmlCreate((SEED + 0 * 1000) >>> 0);
    const byVal = new Map();
    const N = 80000;
    for (let k = 0; k < N; k++) {
      const v = Math.fround((gmlU32(rng) / 4294967296) * 360);
      if (!byVal.has(v)) byVal.set(v, []);
      byVal.get(v).push(k);
    }
    const idx = fades.map((r, i) => {
      const hits = byVal.get(r.dir);
      if (!hits) return null;
      if (hits.length === 1) return hits[0];
      // a value the stream produced twice: take the one nearest its neighbour
      const prev = i > 0 ? (byVal.get(fades[i - 1].dir)?.[0] ?? 0) : 0;
      return hits.reduce((b, c) => (Math.abs(c - prev) < Math.abs(b - prev) ? c : b));
    });
    const unresolved = idx.filter((x) => x === null).length;
    assertEq(unresolved, 0, `all 256 directions resolve in the n = 0 anchored stream (seed ${SEED}) — the charge-up never re-anchors`);

    let inTurnPairs = 0;
    let inTurnConsecutive = 0;
    const gapsOffTurn = [];
    let maxGap = 0;
    for (let i = 1; i < fades.length; i++) {
      if (idx[i] === null || idx[i - 1] === null) continue;
      const gap = idx[i] - idx[i - 1];
      maxGap = Math.max(maxGap, gap);
      const inTurn = mnfightAt.get(fades[i].frame) === 2 && mnfightAt.get(fades[i - 1].frame) === 2;
      if (inTurn) {
        inTurnPairs += 1;
        if (gap === 1) inTurnConsecutive += 1;
      } else if (gap !== 1) {
        gapsOffTurn.push({ frame: fades[i].frame, gap });
      }
      if (!inTurn && gap !== 1) {
        assert(mnfightAt.get(fades[i].frame) !== 2 || mnfightAt.get(fades[i - 1].frame) !== 2,
          `a non-1 gap (${gap}) at f${fades[i].frame} touches a between-turn frame`);
      }
    }
    assert(inTurnPairs > 100, `enough in-turn pairs to say something (${inTurnPairs})`);
    assertEq(inTurnConsecutive, inTurnPairs,
      'inside the locked turns EVERY consecutive roll is the NEXT u32: one random(360) per 4 frames and nothing else draws');
    assert(gapsOffTurn.length > 0 && maxGap > 1000,
      `the between-turn plateaus are there to be reported (max gap ${maxGap} = 1 + 4 x ${(maxGap - 1) / 4} per frame)`);
    const firstIdx = idx[0];
    console.log(`  INFO: dispatch f${dispatch}; first roll f${fades[0].frame} = stream index ${firstIdx} of anchor n=0;`
      + ` ${inTurnPairs} in-turn pairs all consecutive; ${gapsOffTurn.length} between-turn gaps, max ${maxGap}`);

    // THE SIM'S OWN DRAW at that position: sim/knight.js tickChargeup spends
    // one gmlRandom(rng, 360) at chargeuptimer 12 and every 4th tick after,
    // and `turntimer = 1` at 60 (the trace's tt 0 at dispatch + 59). Seat a
    // stream at the recorded index and the tick must draw exactly one u32
    // whose random(360) is the recorded direction.
    const { state } = build({ ac: 104 });
    const seated = gmlCreate((SEED) >>> 0);
    for (let k = 0; k < firstIdx; k++) gmlU32(seated);
    const peek = gmlCreate((SEED) >>> 0);
    for (let k = 0; k < firstIdx; k++) gmlU32(peek);
    assertEq(Math.fround(gmlRandom(peek, 360)), fades[0].dir,
      `random(360) of stream index ${firstIdx} IS the recorded f${fades[0].frame} direction ${fades[0].dir}`);
    state.gmlRng = seated;
    state.chargeupDrawTaken = false;
    state.knight.chargeupcon = 1;
    state.knight.chargeuptimer = 11;
    state.turntimer = 200;
    const d0 = seated.draws ?? 0;
    tickChargeup(state);
    assertEq(state.knight.chargeuptimer, 12, 'the tick advanced chargeuptimer to 12');
    assertEq((seated.draws ?? 0) - d0, 1, 'and spent exactly ONE u32 there');
    // ...and the cadence to 60: draws at 16, 20, ..., 60 (12 more), clock at 60.
    let drawsAt = [];
    for (let t = 13; t <= 60; t++) {
      const before = seated.draws ?? 0;
      tickChargeup(state);
      if ((seated.draws ?? 0) - before === 1) drawsAt.push(t);
      else assertEq((seated.draws ?? 0) - before, 0, `tick ${t} draws nothing`);
    }
    assertEq(drawsAt.join(), '16,20,24,28,32,36,40,44,48,52,56,60', 'one u32 every 4th tick through 60');
    assertEq(state.turntimer, 1, '`chargeuptimer == 60 -> global.turntimer = 1`');
    // Those 13 draws are the recorded f480..f528 rolls, in order.
    const check = gmlCreate((SEED) >>> 0);
    for (let k = 0; k < firstIdx; k++) gmlU32(check);
    let match = 0;
    for (let i = 0; i < 13; i++) if (Math.fround(gmlRandom(check, 360)) === fades[i].dir) match += 1;
    assertEq(match, 13, 'the 13 draws of one locked charge-up reproduce the 13 recorded directions in order');
  }
}

console.log(`\n${checks - failures}/${checks} assertions passed`);
if (failures) {
  console.log(`${failures} FAILURES`);
  process.exit(1);
}
console.log('check-roaring-final: OK');
process.exit(0);
