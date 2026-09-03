// KAIZO obj_knight_swordfall + obj_fallingsword — controller type 108 under
// EnderCat8's Kaizo Roaring Knight v2.3.3, difficulties 0 / 1 / 5 / 10 / 11.
//
// *** V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// *** without permission. (kaizo/HANDOFF.md §5 V-C publish gate.)
//
// METHOD: this file is a COPY of the verified sim module
// sim/attacks/swordfall.js with ONLY the mod's deltas applied. Every line the
// mod did not touch is byte-identical to the sim module; every divergence
// carries the kaizo GML file+line it translates.
//
// PROVENANCE (ground truth read for every branch below):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_knight_swordfall_Create_0.gml   (element = 5, line 19)
//     gml_Object_obj_knight_swordfall_Step_0.gml     (heart mask swap 5-8,
//                                                     ac-102 freeze 31-41,
//                                                     ex=75 d5 54-57,
//                                                     d10 sweep 74-119,
//                                                     shared spawn 120-154,
//                                                     cadences 155-182)
//     gml_Object_obj_knight_swordfall_Alarm_1.gml    (d0 1-17, d1 18-48,
//                                                     d10 49-79, d11 80-97,
//                                                     d5 98-117)
//     gml_Object_obj_knight_swordfall_Alarm_3.gml    (object-index shifts only)
//     gml_Object_obj_fallingsword_Create_0.gml       (speed_max = 18, line 25)
//     gml_Object_obj_fallingsword_Step_0.gml         (speed_max approach 43-48)
//   Delta specs: knight-research/kaizo-mod/deltas/ (same names, .md).
//   Vanilla v105 sits alongside in gml_vanilla_v105/ and was diffed
//   event-by-event: Alarm_0/2/4/5, Other_10 and Destroy_0 are identical, so
//   those handlers are unmodified sim copies.
//
// DIVERGENCES FROM sim/attacks/swordfall.js, exhaustively:
//   1. fallingSword.create: `speed_max = 18` (kaizo fallingsword Create_0:25).
//   2. fallingSword.step: the ramp reads `speed_max` and pins the upward gain
//      to 0.4 (kaizo fallingsword Step_0:43-48). With the vanilla default
//      gain 0.4 this is numerically IDENTICAL to the sim line (0.6-0.4 = 0.2
//      up, 0.6+0.4 = 1.0 down toward 18) — the clause exists so d5's
//      speed_gain = 2 cannot produce the negative approach rate 0.6-2 = -1.4.
//   3. knightSwordfall.create: `element = 5` (kaizo Create_0:19). The sim's
//      manager has no collides() path, so the field is inert here; carried
//      for value-flow fidelity (scr_damage reads `element` off the collider).
//   4. knightSwordfall.step: heart hitbox shrink every frame (kaizo
//      Step_0:5-8), ac-102 weird-circle freeze (Step_0:31-41), ex = 75 at d5
//      (Step_0:54-57), the d10 sweep branch (Step_0:74-119), the shared spawn
//      path's d11/d5 overrides and the ±40 → ±20 aim clamp (Step_0:120-154),
//      and the d5/d10/d11 cadence blocks (Step_0:155-163, 174-182).
//   5. knightSwordfall.alarm[1]: full difficulty dispatch. d0 keeps the sim
//      body verbatim; d1 (kaizo Alarm_1:18-48, byte-identical to vanilla
//      v105) was NEVER translated by the sim module — the sim only launches
//      ac 10 at d0 — and is added here because the mod's B-Side dispatches
//      type 108 at difficulty 1; d10/d11/d5 are new mod content.
//   6. NO registerComboAttack(4, ...) call. The sim module registers itself
//      in the SHARED combination registry; doing that here would mutate sim
//      behavior from a kaizo import — forbidden by the isolation contract
//      (kaizo/HANDOFF.md §2.1). If the mod's combination must chain THIS
//      module, the central integration owns that swap.
//   7. New-branch `with (_sword)` reads use the sword's stored built-ins
//      (s.x / s.y, f32-narrowed on store) exactly as GML's `with` reads them.
//      The sim's dropSword passed its pre-store f64 locals; unchanged sim
//      lines keep that form, delta-touched and newly-translated lines follow
//      the GML. That includes the d1 alarm arm (its point_direction reads the
//      instance's f32 x/y) and the d0/d1/d5 aim clamp inside dropSword. Only
//      the d0 alarm arm — a verbatim sim copy — still aims from f64 locals;
//      correcting it there would edit shared verified behavior by proxy.
//
// THE BLUE TINT — NO LONGER SKIPPED (was deferred; now applied, zero draws):
//   - `image_blend = get_swordcolor()` on every falling sword (kaizo
//     fallingsword Draw_0:1) and on the knight's arm pose (kaizo swordfall
//     Draw_0:6-8, the spr_roaringknight_sword_ol arm only). Both are Draw
//     events writing INSTANCE state, so both land in endStep — the phase this
//     tree models GML Draw state with (sword-tunnel.js's endStep precedent).
//     Imported from kaizo-colors.js, never redefined: get_swordcolor is a pure
//     switch on global.kaizo_swordtype
//     (gml_GlobalScript_scr_complete_save_file.gml:269-286) and consumes zero
//     RNG, so the stream is untouched.
//   - `image_blend = c_white` (kaizo Step_0:11) is the RESET half and is
//     load-bearing, not decoration: without it the arm's blue survives the
//     sprite swap at alarm 2 + 9 and stains spr_roaringknight_attack_ol_center,
//     which the mod does not do. Translated with its own gate; the scr_afterimage
//     calls the gate wraps stay untranslated (visual, and vanilla-identical —
//     the sim module never had them).
//   - RENDERER GAP, not a translation gap: kaizo fallingsword Draw_0:5 draws
//     the sword's TRAIL at get_swordcolor() too, and render/draw/swordfall.js
//     passes null (c_white) for the trail. That file is outside kaizo/ and this
//     module cannot reach it; the sword's own image_blend now carries the
//     colour the trail should use.
//
// NOTES kept from the base file: the swords fly BACKWARDS first (speed -4/-6
// along the aim line, ramped positive); destroyonhit = 0; alarms are alarms.
// The mod's dispatch (obj_dbulletcontroller Step_0:2279-2306) pins
// global.turntimer = 600 for type 108 (vanilla: 999999) — that is the
// LAUNCHER's line, not this module's, and this module never writes
// state.turntimer. `turn_time` stays a plain instance field so the ac-102
// dispatch's `with (obj_knight_swordfall) turn_time = 40`
// (obj_knight_enemy Other_23:504-507) can be applied by the launcher.

import { spawn, destroy } from '../../sim/entity.js';
// THE DESTROY EVENT, shared with the verified sim module rather than copied:
// it is byte-identical in both dumps (checked), so a second copy could only
// drift. See its comment there for the +272-frame divergence it closes.
import { swordfallDestroy } from '../../sim/attacks/swordfall.js';
import { scrApproach, pointDirection, clamp, gmlEq, gmlRound, WHITE, gmlLt } from '../../sim/gml.js';
import { gmlRandom, gmlIrandom, gmlIrandomRange } from '../../sim/rng.js';
import { scrBulletInit, regularbulletCreate, regularbulletStep, collidebulletOther15 } from '../../sim/bullets/regularbullet.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { SWORDOL_MASK, enginePairHit } from '../../sim/masks.js';
import { kaizoMask } from '../data/masks.js';
import { getSwordcolor } from './kaizo-colors.js';
import { chainNext } from '../../sim/attacks/combination.js';
import { cue } from '../../sim/audio.js';

/** How many trail samples the sword keeps. `max_old = 3`. */
const MAX_OLD = 3;

/**
 * An extracted mask, given the `px` boolean grid sim/masks.js's samplers walk.
 *
 * kaizo/data/masks.js stores rows as '0'/'1' strings and its `kaizoMask()`
 * hands back THE SAME OBJECT on every call, in every importer (ES modules are
 * singletons). Deriving the grid ONTO that object rather than into a copy is
 * what makes this mask one shared value across modules — swordfall.js,
 * underbox.js and knight-stream.js all hold the identical reference — so
 * `state.soul.mask === ...` tests and underbox's restoreHeartMask() hold no
 * matter which attack stamped it. Idempotent and additive; regenerating
 * kaizo/data/masks.js drops the memo and the next call rebuilds it.
 */
function maskWithPx(m) {
  if (!m.px) m.px = m.rows.map((r) => Array.from(r, (c) => c === '1'));
  return m;
}

/**
 * `spr_dodgeheart_smaller_2px_mask` — the mod-wide "2px-smaller hurtbox" the
 * kaizo swordfall (and six other kaizo attacks) forces onto the soul every
 * frame: `with (obj_heart) mask_index = spr_dodgeheart_smaller_2px_mask`
 * (kaizo swordfall Step_0:5-8).
 *
 * GEOMETRY, EXTRACTED — was WRONG here, and wrong in a way that mattered.
 * This file used to hand-build the mask from the companion sprite
 * `spr_dodgeheart_smaller_2px` (no `_mask` suffix): AxisAlignedRect, bbox
 * [2,2]..[17,17]. That is a DIFFERENT SPRITE — the ART half of the same
 * art/mask pair vanilla keeps as spr_dodgeheart / spr_dodgeheartmask — so
 * every attack importing KAIZO_HEART_2PX_MASK was giving the soul a 16x16
 * SQUARE hurtbox routed through the rectangle collision routine.
 *
 * The real mask, now extracted from data-kaizo.win by
 * kaizo/tools/pack-kaizo-sprites.mjs (kaizo/data/masks.js): 20x20, origin
 * (0,0), **Precise**, bbox [4,4]..[15,15] — 100 inked pixels in a heart
 * shape, the vanilla heart contracted 2px per side. No `axisRect`: a Precise
 * mask takes the precise sampler, which is a second real behavioural
 * difference from the old stand-in (sim/masks.js, "TWO ROUTINES, SELECTED BY
 * MASK A'S KIND").
 *
 * Nothing restores the mask mid-fight in the mod (vanilla restores per turn
 * via obj_moveheart's fresh heart); the kaizo turn loop's per-turn soul
 * respawn already hands the new soul HEART_RECT.
 */
export const KAIZO_HEART_2PX_MASK = maskWithPx(
  kaizoMask('spr_dodgeheart_smaller_2px_mask'),
);

export const fallingSword = {
  name: 'obj_fallingsword',

  create(e, state) {
    regularbulletCreate(e, state); // event_inherited()
    e.sprite_index = 'spr_roaringknight_sword_ol'; // from the OBJECT definition
    e.slowing = 30;
    e.damage = 206;
    e.element = 5;
    e.grazepoints = 12;
    e.image_yscale = 0;
    e.alarm[0] = 1;
    e.destroyonhit = 0;
    e.image_alpha = 0;
    e.timer = 0;
    e.nosfx = false;
    e.old_x = new Array(MAX_OLD).fill(e.x);
    e.old_y = new Array(MAX_OLD).fill(e.y);
    e.old_angle = new Array(MAX_OLD).fill(e.image_angle ?? 0);
    e.speed_gain = 0.4;
    // KAIZO fallingsword Create_0:25 — terminal fall speed becomes an
    // instance variable (vanilla hard-codes 18 in Step); the d5 spawner
    // overrides it to 36. Default keeps vanilla behavior exactly.
    e.speed_max = 18;
    e.finalsword = false;
    e.isBullet = true;
    e.builtinMotion = true;
  },

  alarm: {
    /** `alarm[2] = 16; if (finalsword) alarm[3] = 10;` — then the ramp starts. */
    0(e) {
      e.alarm[2] = 16;
      if (e.finalsword) e.alarm[3] = 10;
    },
    2() {},
    3() {},
  },

  step(e, state) {
    regularbulletStep(e, state); // event_inherited()
    tickDelayed(state, e);
    e.timer += 1;

    if (!e.nosfx) {
      // snd_knight_fallingsword at 3, its pitch sliding 3.3 down over the
      // next 17 frames — the whistle of it coming in.
      if (e.timer === 3) cue(state, 'snd_knight_fallingsword', 1, 1);
      if (e.timer === 31 && e.finalsword) {
        cue(state, 'snd_knight_fallingsword_big', 1, 1);
      }
    } else if (e.timer === 1) {
      cue(state, 'snd_heavy_passing', 1, 1);
    }

    // The trail history, shifted oldest-first.
    for (let i = MAX_OLD - 1; i > 0; i--) {
      e.old_x[i] = e.old_x[i - 1];
      e.old_y[i] = e.old_y[i - 1];
      e.old_angle[i] = e.old_angle[i - 1];
    }
    e.old_x[0] = e.x;
    e.old_y[0] = e.y;
    e.old_angle[0] = e.image_angle;

    // THE REAR-BACK. `speed` starts NEGATIVE along the aim line and ramps
    // toward the cap, so the sword pulls away before it drives in.
    //
    // KAIZO fallingsword Step_0:43-48 — the vanilla line
    //     speed = scr_approach(speed, 18, 0.6 + (speed_gain * sign(speed)));
    // becomes
    //     var _gain = speed_gain;
    //     if (speed < 0) _gain = 0.4;
    //     speed = scr_approach(speed, speed_max, 0.6 + (_gain * sign(speed)));
    // Terminal velocity is the per-instance `speed_max` (default 18 =
    // vanilla), and a sword still travelling BACKWARDS approaches at the
    // fixed rate 0.6 + (0.4 * -1) = 0.2 regardless of speed_gain — identical
    // to vanilla for the default gain 0.4, and the guard that keeps d5's
    // gain-2 swords from walking AWAY from the target at 0.6 - 2 = -1.4.
    // `if (alarm[0] == -1)` -- obj_fallingsword Step_0:41, and the EXACT test
    // matters: the alarm reads 0 on the frame it fires and -1 only the frame
    // after (sim/entity.js runAlarms, measured by the probe). The truthiness
    // form `!(alarm > 0.5)` was true one frame early, and that frame is why
    // the sim's sword decelerated from f805 where the mod's waits for f806.
    if (e.alarm[0] === -1) {
      let _gain = e.speed_gain;
      // `speed < 0` IS AN EPSILON COMPARE. GML compares reals through
      // math_set_epsilon (CLAUDE.md, "GML == ON REALS IS NOT ==="), and the
      // runner applies it to `<` too: MEASURED on _probeall f992->f993, a
      // Vortex falling sword whose rear-back ramp lands on speed
      // -0.0000012249 (identical on both sides) -- the game's next speed is
      // 0.2999987900, i.e. rate 0.6 + speed_gain(0.3) * sign(-1): the `< 0`
      // read FALSE (within epsilon of zero) while sign() stayed exact. JS's
      // strict `<` took the 0.4 branch (rate 0.2, speed 0.1999987811) and the
      // tenth persisted to the cap: 0.65 px of drift by f999, the graze
      // replay's 0.05 px match dropped the sword's row, the turn clock slipped
      // one unit (CLOCK f999). sign() keeps Math.sign: an epsilon-aware sign
      // would give rate 0.6 there, which the recording rules out.
      if (gmlLt(e.speed, 0)) _gain = 0.4;
      e.speed = scrApproach(e.speed, e.speed_max, 0.6 + _gain * Math.sign(e.speed));
    }
    // KAIZO fallingsword Step_0:49-52, byte-identical to vanilla v105:
    // `if (speed && finalsword) speed += 2.4;` — and the test is
    // `speed > 0.5`, NOT `speed !== 0`.
    //
    // GameMaker converts a real to a bool with `> 0.5`. It is the same rule
    // that makes `!alarm[0]` TRUE for an idle -1 (CLAUDE.md, learned at T4;
    // sim/attacks/underbox.js:182 spells it out), and translating it with JS
    // truthiness instead handed the boost to a sword that is still REARING
    // BACK at a negative speed. The finalsword is supposed to creep backwards
    // on the approach ramp alone and only rocket once it has turned over.
    //
    // MEASURED — kaizo_oracle_seq_deep.csv logs atk_Vortex1's finalsword on
    // its creation frame with `speed` still the -6 its alarm assigned, while
    // its position has already moved (+4 in y) and its lerps have already
    // written (image_yscale -0.25, image_angle +35.286). The sim logged
    // -3.5999999046 = -6 + 2.4. Asserted by
    // kaizo/tools/checks/check-oracle-vortex.mjs, block D-2.
    //
    // That row was first read as evidence about the ENGINE — "an instance
    // spawned from an alarm must not run its own Step on that frame". It is
    // not: obj_lerpvar, created by the same `with` block on the same frame,
    // demonstrably DID step, which no per-phase list freeze could allow. Both
    // instances stepped; only this predicate was wrong.
    if (e.speed > 0.5 && e.finalsword) e.speed += 2.4;
  },

  /**
   * Draw_0's one state write. KAIZO fallingsword Draw_0:1 —
   * `image_blend = get_swordcolor();` (vanilla has no such line; its trail is
   * drawn c_white and the body untinted). GML runs Draw after Step, so it goes
   * in endStep, the phase this tree models Draw state with. Zero RNG.
   *
   * Draw_0:5 tints the TRAIL with the same colour; the renderer draws the
   * trail untinted today (see the header's renderer-gap note).
   */
  endStep(e, state) {
    e.image_blend = getSwordcolor(state);
  },

  collides(e, heart) {
    if (e.active !== 1 && e.active !== true) return false;
    return enginePairHit(heart, e, SWORDOL_MASK);
  },

  other15: collidebulletOther15,
};

/**
 * Aim + wobble of the SHARED per-volley spawn path — the `else` of the d10
 * branch (KAIZO Step_0:120-154). Rewritten from the sim's dropSword because
 * the mod rewrote the GML block it translates:
 *
 *   - d11 re-rolls the sword's x to `obj_heart.x + 10 + irandom_range(-24,24)`
 *     and aims it at the soul's centre — and SKIPS the random(190) aim draw
 *     (the else is not taken).                        (Step_0:123-126,133-136)
 *   - d5 re-rolls x to `obj_heart.xstart + 10 + irandom_range(-100,100)`,
 *     then forces the sword perfectly vertical with speed_gain 2 /
 *     speed_max 36. The random(190) aim draw IS still consumed first — the
 *     else runs before the 270 override — dead but stream-advancing.
 *                                                     (Step_0:127-130,141-146)
 *   - the aim clamp narrows: `x - 40, x + 40` → `x - 20, x + 20`, for EVERY
 *     difficulty on this path (0/1/5 — d11 takes the soul-aim arm). The
 *     kaizo runtime uses 20; implemented as 20.       (Step_0:139)
 *
 * RNG draws per volley, in order (a skipped draw desyncs everything after):
 *   d0/d1: random(220), random(30), random(190)          — 3 calls, 3 u32
 *   d5:    random(220)*, random(30), irandom_range(-100,100),
 *          random(190)*, and the cadence's irandom(1)    — *dead, consumed
 *   d11:   random(220)*, random(30), irandom_range(-24,24) — NO random(190)
 *   d10:   never reaches this function (zero draws — see the sweep branch).
 */
function dropSword(state, e, box) {
  // THE Y DRAW COMES FIRST. GML evaluates a call's arguments RIGHT-TO-LEFT (the
  // VM pushes them in reverse), so in `instance_create(bx + random(220),
  // by + random(30), obj_fallingsword)` the random(30) is drawn before the
  // random(220). MEASURED on kaizo_oracle_seq_tok3 (Vortex 1, anchor n=4):
  // four consecutive swords at draws (8,9) (18,19) (27,28) (37,38), y-draw
  // first, after undoing the one built-in motion step the end-of-frame seq row
  // carries. Drawing x first put every sword on the wrong column and row.
  const y = box.y - 110 + gmlRandom(state.gmlRng, 30);
  const x = box.x - 110 + gmlRandom(state.gmlRng, 220);
  const s = spawn(state, fallingSword, { x, y });
  // KAIZO Step_0:123-126 — d11: x re-rolled onto the soul's live column.
  if (e.difficulty === 11) {
    s.x = state.soul.x + 10 + gmlIrandomRange(state.gmlRng, -24, 24);
  }
  // KAIZO Step_0:127-130 — d5: x re-rolled onto the soul's SPAWN column
  // (xstart, the built-in creation coordinate — the box centre in practice).
  if (e.difficulty === 5) {
    s.x = state.soul.xstart + 10 + gmlIrandomRange(state.gmlRng, -100, 100);
  }
  // `with (_sword)` — reads below use the sword's stored (f32) built-ins,
  // exactly as the GML with-block reads x/y after the overwrites above.
  if (e.difficulty === 11) {
    // KAIZO Step_0:133-136 — aimed dead-centre on the soul; the random(190)
    // aim draw is NOT consumed on this arm.
    s.image_angle = pointDirection(s.x, s.y, state.soul.x + 10, state.soul.y + 10);
  } else {
    // The target wanders across the box but can never be more than 20px
    // (KAIZO: was 40 in vanilla v105) either side of the sword's own column.
    const tx = clamp(box.x + 95 - gmlRandom(state.gmlRng, 190), s.x - 20, s.x + 20);
    s.image_angle = pointDirection(s.x, s.y, tx, box.y + 110);
  }
  if (e.difficulty === 5) {
    // KAIZO Step_0:141-146 — perfectly vertical, much faster fall. The aim
    // computed above is overwritten (its draw already burned).
    s.image_angle = 270;
    s.speed_gain = 2;
    s.speed_max = 36;
  }
  s.direction = s.image_angle;
  s.speed = -4;
  // THE YSCALE WOBBLE IS THE HITBOX, not decoration — see the sim module's
  // note: a mask at yscale 0 has no height and never registers.
  scrLerpvar(state, spawn, s, 'image_yscale', 0, -1, 8);
  // `scr_script_delayed(scr_lerpvar, 8, ...)` -- armed one short, see delayedLerp.
  delayedLerp(state, s, 8 - 1, 'image_yscale', -1, 1, 8);
  scrLerpvar(state, spawn, s, 'image_angle', s.image_angle, s.image_angle + 360, 16, 1);
  scrLerpvar(state, spawn, s, 'image_alpha', 0, 1, 16, 1);
  return s;
}

/**
 * `scr_script_delayed(scr_lerpvar, n, ...)` — a lerp that starts n frames
 * later. Carried on the target itself so it survives without a scheduler.
 */
// `scr_script_delayed(scr_lerpvar, delay, var, from, to, dur[, easetype, ease])`.
// The trailing two are FORWARDED, not defaulted here: scr_lerpvar with fewer
// than six arguments hands scr_lerpvar_instance only four and the instance
// defaults apply (easetype 0, "out" -- sim/lerpvar.js mirrors them), while a
// six-argument call sets both. The swordfall Alarm_0 chain alternates
// "out" / "in" and every one of its "in" legs ran as "out" until this carried
// the ease; the Alarm_1 chain passes NONE and was being handed easetype 1.
function delayedLerp(state, target, delay, varname, from, to, dur, easetype, easeinout) {
  // WHEN THE FIRST WRITE LANDS. scr_script_delayed arms an ALARM n frames
  // out; the obj_lerpvar that alarm creates steps -- and writes -- on the
  // frame it fires. This list ticks inside the target's own Step, and a tween
  // spawned when it comes due misses that frame's step phase, so the first
  // write lands at call + n + 1. Whether that is one frame late depends on
  // WHERE the mod makes the call, so each site arms its own count:
  //   - the manager's Alarm_0 finalsword sequence (init below): the sim's
  //     init already runs a frame before the mod's alarm, so `n` lands the
  //     return tween on the recording's frame (_tok3 f807 -> f808:
  //     -3.0 then -2.853);
  //   - dropSword's 0 -> -1 / -1 -> 1 pair, called from the manager's Step on
  //     the SAME frame as the mod: `n - 1` (_tok3 f852 -> f853 and _probeall
  //     f845 -> f846: the ramp's final -1 overwritten by the return's first
  //     write on the same frame). A blanket n - 1 moved the gate f853 -> f807.
  (target.pendingLerps ??= []).push({ delay, varname, from, to, dur, easetype, easeinout });
}

/** Runs the pending list; called from both objects' steps. */
function tickDelayed(state, e) {
  if (!e.pendingLerps || !e.pendingLerps.length) return;
  for (const p of e.pendingLerps) p.delay -= 1;
  const due = e.pendingLerps.filter((p) => p.delay <= 0);
  e.pendingLerps = e.pendingLerps.filter((p) => p.delay > 0);
  for (const p of due) {
    scrLerpvar(state, spawn, e, p.varname, p.from, p.to, p.dur, p.easetype, p.easeinout);
  }
}

/** scr_get_box, by the indices sim/attacks/rotating-slash.js documents:
 *  0 right, 1 top, 2 left, 3 bottom, 4 centre x, 5 centre y. Copied from
 *  sim/attacks/knightlines.js (unchanged helper; the mod's d10 branches read
 *  it and the sim's swordfall never needed more than the centre). */
function getBox(state, which) {
  const gt = state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
  if (!gt) return which === 0 || which === 2 || which === 4 ? state.view.x + 320 : state.view.y + 170;
  const hw = (gt.image_xscale ?? 2) * 75 * 0.5;
  const hh = (gt.image_yscale ?? 2) * 75 * 0.5;
  switch (which) {
    case 0: return gt.x + hw; // RIGHT
    case 1: return gt.y - hh; // TOP
    case 2: return gt.x - hw; // LEFT
    case 3: return gt.y + hh; // BOTTOM
    case 4: return gt.x; // centre x
    default: return gt.y; // centre y
  }
}

/**
 * spr_roaringknight_idle's UNSCALED size, from the extracted sprite table
 * (kaizo/assets/sprites/manifest.json: `"w": 117, "h": 115`; the vanilla
 * assets/sprites/manifest.json carries the same dimensions — the mod replaces
 * the image, not the size — so this constant is identical on both sides).
 *
 * GML's `sprite_width` / `sprite_height` are these numbers TIMES the LIVE
 * `image_xscale` / `image_yscale`, so they are derived at the read site and
 * never baked in — see alarm 0 for what baking them cost. Neither scale is
 * ever negative on this object (scr_darksize sets both to 2 and alarm 5 only
 * lerps xscale DOWN to 0), so GameMaker's signed-vs-abs ambiguity for
 * `sprite_width` cannot arise here.
 *
 * The manager wears this sprite for the whole of alarm 0's life: Other_10
 * swaps sprite_index only on the "start" / "short start" / "short mid" arms,
 * and none of those arms alarm 5 — which is the only thing that arms alarm 0.
 */
const KNIGHT_IDLE_SPRITE_W = 117;
const KNIGHT_IDLE_SPRITE_H = 115;

export const knightSwordfall = {
  name: 'obj_knight_swordfall',

  create(e, state) {
    scrBulletInit(e);
    // scr_darksize()
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.image_speed = 0;
    e.sprite_index = 'spr_roaringknight_idle';
    e.swordcount = 1;
    e.countdowner = 29;
    e.countdown = 45;
    e.turn_type = 'full';
    e.turn_time = 160;
    e.local_turntimer = 0;
    e.anchor_x = e.x;
    e.anchor_y = e.y;
    e.dip = 2;
    e.difficulty = 0;
    e.forcexfix = false;
    e._siner = 0;
    // KAIZO Create_0:19 — `element = 5`, the sword element, so any contact
    // damage the ARM itself deals goes through scr_element_damage_reduction
    // like every other knight bullet (vanilla v105 forgot this one object).
    // The sim manager has no collides() path, so this is value-flow only.
    e.element = 5;
    e.done = false;
  },

  /**
   * Other_10 — IDENTICAL to vanilla v105 (diffed 2026-08-28); sim copy kept
   * verbatim. The "full" arm is the standalone launch; the rest are the
   * COMBINATION's chaining.
   */
  init(e, state) {
    if (e.turn_type === 'short start' || e.turn_type === 'short mid') {
      const short = e.turn_type === 'short start';
      e.local_turntimer = short ? 70 : 80;
      e.countdowner = short ? 10 : 20;
      e.countdown = 2;
      e.turn_time = 40;
      e.sprite_index = 'spr_roaringknight_point_ol';
      scrLerpvar(state, spawn, e, 'image_index', 0, 4, 8);
      const box = boxOf(state);
      if (box) {
        const hw = (box.image_xscale ?? 2) * 37.5;
        const hh = (box.image_yscale ?? 2) * 37.5;
        scrLerpvar(state, spawn, e, 'x', e.x, box.x + hw + 60, 20, 1);
        scrLerpvar(state, spawn, e, 'y', e.y, box.y - 110, 20, 1);
      }
      return;
    }
    if (e.turn_type === 'short end') {
      e.local_turntimer = 214;
      e.countdowner = 10;
      e.countdown = 20;
      e.alarm[5] = 4;
      return;
    }
    e.local_turntimer = 324;
    e.alarm[5] = 4;
  },

  alarm: {
    /** The Knight's OWN sword, with its seven-stage wobble. IDENTICAL to
     *  vanilla (Alarm_0 diffed clean); sim copy verbatim. */
    0(e, state) {
      // KAIZO gml_Object_obj_knight_swordfall_Alarm_0.gml:1, byte-identical
      // to vanilla v105 — BOTH TERMS ARE LIVE:
      //
      //     instance_create(x + (sprite_width * 0.5),
      //                     (y + (sprite_height * 0.5)) - 30, obj_fallingsword)
      //
      // THIS WAS FROZEN AS `x + 75, y - 30`, AND BOTH HALVES WERE WRONG.
      // Alarm 5 always runs first, and it takes exactly as long as it delays
      // this alarm — `scr_lerpvar("image_xscale", image_xscale, 0, 8, 1,
      // "out")`, `scr_lerpvar("x", x, x + 110, 8, 1, "out")`, `alarm[0] = 8`
      // — so by the time alarm 0 fires `image_xscale` has reached 0.
      // `sprite_width` is therefore 0 and the whole x TERM VANISHES, leaving
      // alarm 5's own +110 slide as the entire horizontal offset. Meanwhile
      // `image_yscale` is untouched at 2 (scr_darksize), so
      // `sprite_height * 0.5` is a full 115 — the old `y - 30` had dropped
      // that term altogether.
      //
      // MEASURED, not reasoned — kaizo_oracle_seq_deep.csv and
      // kaizo_oracle_seq_sideb.csv, grouped by kaizo_playing, FOUR
      // independent launches across both routes:
      //   deep  atk_Vortex1   mgr (425, 83.8656005859) sword (535, 172.8656005859)
      //   deep  atk_Frenzy2B  mgr (425, 71.0049285889) sword (535, 160.0049285889)
      //   sideb atk_Vortex1   mgr (425, 84.0428771973) sword (535, 173.0428771973)
      //   sideb atk_Frenzy2B  mgr (425, 74.9304122925) sword (535, 163.9304199219)
      // dx = +110 and dy = +89 = (115 - 30) + 4, the +4 being the single
      // frame of built-in motion the recorder's Draw-time log always carries
      // (speed -4 along direction 90). The frozen constants gave +185 / -26:
      // 75px too far right and 115px too high. Asserted by
      // kaizo/tools/checks/check-oracle-vortex.mjs, block D-1.
      //
      // DO NOT RE-FREEZE THESE. +110 and +89 are merely what these
      // expressions evaluate to at THIS scale; what the mod ships is the
      // arithmetic, not the numbers.
      const spriteWidth = KNIGHT_IDLE_SPRITE_W * e.image_xscale;
      const spriteHeight = KNIGHT_IDLE_SPRITE_H * e.image_yscale;
      const s = spawn(state, fallingSword, {
        x: e.x + (spriteWidth * 0.5),
        y: (e.y + (spriteHeight * 0.5)) - 30,
      });
      s.alarm[0] = 1;
      s.image_angle = -90;
      s.direction = 90; // `direction = -image_angle`
      s.speed = -4;
      s.old_angle = [-90, -90, -90];
      s.image_xscale = 1.5;
      s.image_alpha = 1;
      s.nosfx = true;
      scrLerpvar(state, spawn, s, 'image_xscale', 1.5, 2, 49, 1);
      // The seven-stage yscale chain, delays and durations verbatim.
      scrLerpvar(state, spawn, s, 'image_yscale', 0, -3, 4, 1);
      delayedLerp(state, s, 4, 'image_yscale', -3, 0, 5, 1, 'in');
      delayedLerp(state, s, 9, 'image_yscale', 0, 2.5, 6, 1, 'out');
      delayedLerp(state, s, 15, 'image_yscale', 2.5, 0, 7, 1, 'in');
      delayedLerp(state, s, 22, 'image_yscale', 0, -2.25, 8, 1, 'out');
      delayedLerp(state, s, 30, 'image_yscale', -2.25, 0, 9, 1, 'in');
      delayedLerp(state, s, 39, 'image_yscale', 0, 2, 10, 1, 'out');
    },

    /**
     * The FINAL sword(s) — KAIZO Alarm_1, full difficulty dispatch.
     *
     * d0 keeps the sim module's body verbatim (kaizo Alarm_1:1-17, identical
     * to vanilla). d1 (Alarm_1:18-48) is ALSO vanilla-identical GML, but the
     * sim module never translated it — the sim only launches ac 10 at d0;
     * the mod's B-Side launches type 108 at difficulty 1, so the arm is
     * translated here, in the sim's d0 style. d10/d11/d5 are mod content.
     *
     * RNG per fire: d0 = random(110), random(30); d1 = random(40),
     * random(30), random(40), random(30); d10 = ZERO draws; d11 =
     * random(110) (dead but consumed), random(30), irandom_range(-48,48);
     * d5 = random(220) (dead but consumed), random(30),
     * irandom_range(-100,100).
     */
    1(e, state) {
      const box = boxOf(state);
      if (e.difficulty === 0) {
        // y before x: GML call arguments evaluate right-to-left (see dropSword).
        const y = box.y - 110 + gmlRandom(state.gmlRng, 30);
        const x = box.x - 55 + gmlRandom(state.gmlRng, 110);
        const s = spawn(state, fallingSword, { x, y });
        s.image_angle = pointDirection(x, y, box.x, box.y);
        s.direction = s.image_angle;
        s.speed = -6;
        s.speed_gain = 0.3;
        s.image_xscale = 2;
        s.finalsword = true;
        s.grazepoints = 30;
        scrLerpvar(state, spawn, s, 'image_yscale', 0, -2, 8);
        delayedLerp(state, s, 8, 'image_yscale', -2, 2, 8);
        scrLerpvar(state, spawn, s, 'image_angle', s.image_angle, s.image_angle + 360, 16, 1);
        scrLerpvar(state, spawn, s, 'image_alpha', 0, 1, 16, 1);
      }
      if (e.difficulty === 1) {
        // KAIZO Alarm_1:18-48 (vanilla-identical): TWO final swords, one
        // biased right of centre, one left, both aimed at the box centre.
        {
          // y before x: GML call arguments evaluate right-to-left (see dropSword).
          const y = box.y - 110 + gmlRandom(state.gmlRng, 30);
          const x = box.x + 55 - gmlRandom(state.gmlRng, 40);
          const s = spawn(state, fallingSword, { x, y });
          // `with (instance_create(...)) { image_angle = point_direction(x, y,
          // ...) }` — the with-block reads the INSTANCE's stored x/y, which
          // GameMaker narrowed to f32 on store, not the f64 expressions that
          // were handed to instance_create. Divergence 7 in this file's
          // header. The d0 arm above is a verbatim sim copy and keeps the
          // sim's f64-local form; this arm is new here, so it follows the GML.
          s.image_angle = pointDirection(s.x, s.y, box.x, box.y);
          s.direction = s.image_angle;
          s.speed = -6;
          s.speed_gain = 0.3;
          s.image_xscale = 2;
          s.finalsword = true;
          s.grazepoints = 30;
          scrLerpvar(state, spawn, s, 'image_yscale', 0, -2, 8);
          delayedLerp(state, s, 8, 'image_yscale', -2, 2, 8);
          scrLerpvar(state, spawn, s, 'image_angle', s.image_angle, s.image_angle + 360, 16, 1);
          scrLerpvar(state, spawn, s, 'image_alpha', 0, 1, 16, 1);
        }
        {
          // y before x: GML call arguments evaluate right-to-left (see dropSword).
          const y = box.y - 110 + gmlRandom(state.gmlRng, 30);
          const x = box.x - 55 + gmlRandom(state.gmlRng, 40);
          const s = spawn(state, fallingSword, { x, y });
          // Stored f32 built-ins again — see the note on the first sword.
          s.image_angle = pointDirection(s.x, s.y, box.x, box.y);
          s.direction = s.image_angle;
          s.speed = -6;
          s.speed_gain = 0.3;
          s.image_xscale = 2;
          s.finalsword = true;
          s.grazepoints = 30;
          scrLerpvar(state, spawn, s, 'image_yscale', 0, -2, 8);
          delayedLerp(state, s, 8, 'image_yscale', -2, 2, 8);
          scrLerpvar(state, spawn, s, 'image_angle', s.image_angle, s.image_angle + 360, 16, 1);
          scrLerpvar(state, spawn, s, 'image_alpha', 0, 1, 16, 1);
        }
      }
      if (e.difficulty === 10) {
        // KAIZO Alarm_1:49-79 — two fixed swords launched from OUTSIDE the
        // box's side edges, both aimed 36px BELOW the box centre: a crossing
        // X. ZERO RNG. NOTE the delta spec's prose swapped left and right —
        // scr_get_box's case 0 is the RIGHT edge and case 2 the LEFT
        // (gml_GlobalScript_scr_get_box.gml:5-13), so the first sword spawns
        // at LEFT - 80 and the second at RIGHT + 80. The GML wins.
        {
          const x = getBox(state, 2) - 80;
          const y = getBox(state, 1) + 40;
          const s = spawn(state, fallingSword, { x, y });
          s.image_angle = pointDirection(s.x, s.y, getBox(state, 4), getBox(state, 5) + 36);
          s.direction = s.image_angle;
          s.speed = -6;
          s.speed_gain = 0.3;
          s.image_xscale = 2;
          scrLerpvar(state, spawn, s, 'image_yscale', 0, -2, 8);
          delayedLerp(state, s, 8, 'image_yscale', -2, 2, 8);
          scrLerpvar(state, spawn, s, 'image_angle', s.image_angle, s.image_angle + 360, 16, 1);
          scrLerpvar(state, spawn, s, 'image_alpha', 0, 1, 16, 1);
          s.finalsword = true;
          s.grazepoints = 30;
        }
        {
          const x = getBox(state, 0) + 80;
          const y = getBox(state, 1) + 40;
          const s = spawn(state, fallingSword, { x, y });
          s.image_angle = pointDirection(s.x, s.y, getBox(state, 4), getBox(state, 5) + 36);
          s.direction = s.image_angle;
          s.speed = -6;
          s.speed_gain = 0.3;
          s.image_xscale = 2;
          scrLerpvar(state, spawn, s, 'image_yscale', 0, -2, 8);
          delayedLerp(state, s, 8, 'image_yscale', -2, 2, 8);
          scrLerpvar(state, spawn, s, 'image_angle', s.image_angle, s.image_angle + 360, 16, 1);
          scrLerpvar(state, spawn, s, 'image_alpha', 0, 1, 16, 1);
          s.finalsword = true;
          s.grazepoints = 30;
        }
      }
      if (e.difficulty === 11) {
        // KAIZO Alarm_1:80-97 — ONE sword tracking the soul's live x. The
        // vanilla-style random(110) spawn x is DEAD (immediately overwritten)
        // but its draw is still consumed; the aim is computed AFTER the x
        // overwrite, so the sword tilts toward the soul from its offset.
        // y before x: GML call arguments evaluate right-to-left (see dropSword).
        const y = box.y - 110 + gmlRandom(state.gmlRng, 30);
        const x = box.x - 55 + gmlRandom(state.gmlRng, 110);
        const s = spawn(state, fallingSword, { x, y });
        s.x = state.soul.x + 10 + gmlIrandomRange(state.gmlRng, -48, 48); // Alarm_1:84
        s.image_angle = pointDirection(s.x, s.y, state.soul.x + 10, state.soul.y + 10);
        s.direction = s.image_angle;
        s.speed = -6;
        s.speed_gain = 0.3;
        s.image_xscale = 2;
        scrLerpvar(state, spawn, s, 'image_yscale', 0, -2, 8);
        delayedLerp(state, s, 8, 'image_yscale', -2, 2, 8);
        scrLerpvar(state, spawn, s, 'image_angle', s.image_angle, s.image_angle + 360, 16, 1);
        scrLerpvar(state, spawn, s, 'image_alpha', 0, 1, 16, 1);
        s.finalsword = true;
        s.grazepoints = 30;
      }
      if (e.difficulty === 5) {
        // KAIZO Alarm_1:98-117 — ONE straight-down fast sword above the
        // soul's SPAWN x. random(220) is dead-but-consumed. NO finalsword,
        // NO grazepoints, NO image_xscale — the Create defaults stand, and
        // the yscale flip is the step-sword's -1/1, not the final's -2/2.
        // THE Y DRAW COMES FIRST. GML evaluates a call's arguments RIGHT-TO-LEFT (the
        // VM pushes them in reverse), so in `instance_create(bx + random(220),
        // by + random(30), obj_fallingsword)` the random(30) is drawn before the
        // random(220). MEASURED on kaizo_oracle_seq_tok3 (Vortex 1, anchor n=4):
        // four consecutive swords at draws (8,9) (18,19) (27,28) (37,38), y-draw
        // first, after undoing the one built-in motion step the end-of-frame seq row
        // carries. Drawing x first put every sword on the wrong column and row.
        const y = box.y - 110 + gmlRandom(state.gmlRng, 30);
        const x = box.x - 110 + gmlRandom(state.gmlRng, 220);
        const s = spawn(state, fallingSword, { x, y });
        s.x = state.soul.xstart + 10 + gmlIrandomRange(state.gmlRng, -100, 100); // Alarm_1:101
        // with (_sword): `if (other.difficulty == 5)` — true by construction.
        s.image_angle = 270;
        s.speed_gain = 2;
        s.speed_max = 36;
        s.direction = s.image_angle;
        s.speed = -4;
        scrLerpvar(state, spawn, s, 'image_yscale', 0, -1, 8);
        delayedLerp(state, s, 8, 'image_yscale', -1, 1, 8);
        scrLerpvar(state, spawn, s, 'image_angle', s.image_angle, s.image_angle + 360, 16, 1);
        scrLerpvar(state, spawn, s, 'image_alpha', 0, 1, 16, 1);
      }
    },

    /** His return: the sword pose, the dip, then the attack pose. IDENTICAL
     *  to vanilla (Alarm_2 diffed clean); sim copy verbatim. */
    2(e, state) {
      e.dip = 0;
      const k = state.entities.find((x) => x.alive && x.type.name === 'obj_knight_enemy');
      e.x = (k ? k.x : e.x) + 10;
      e.image_xscale = 2;
      e.sprite_index = 'spr_roaringknight_sword_ol';
      e.image_angle = -90;
      e.forcexfix = true;
      e.returnT = 0;
      e.alarm[4] = 26;
    },

    /**
     * Alarm 3 — THE HANDOFF. The kaizo file's only diff from vanilla is the
     * numeric OBJECT indices for the four chain targets (367→366, 672→669,
     * 806→802, 1175→1173 — the mod's inserted assets shift every index after
     * them; kaizo Alarm_3:7-16,40,45). The sim's chainNext registry maps
     * next_up 1/2/3/5 to modules by NUMBER, index-free, so the delta is a
     * semantic no-op here — the sim copy stands.
     *
     * THE SITE NAME IS THE OPT-IN, and it is the whole of this module's half
     * of the combination wiring. `chainNext`'s third argument routes to
     * `state.kaizo.hooks.comboChainNext` when a scene has set one, which is
     * what makes the SUCCESSOR a kaizo module instead of the sim copy that
     * registered itself in the shared registry (kaizo/HANDOFF.md §2.1 forbids
     * the kaizo modules from writing that registry, so without this seam every
     * segment after the first ran vanilla whatever KAIZO_COMBO_ATTACKS said).
     * With no hook the argument is ignored and this is the vanilla handoff,
     * unchanged. 'swordfall_alarm3' is the site in KAIZO_CHAIN_SITES that
     * transcribes THIS event: cases 1/2/3/5, no case 4, warp only for the
     * underbox and on the WAY OUT.
     */
    3(e, state) {
      chainNext(state, e, 'swordfall_alarm3');
      swordfallDestroy(e, state);
      destroy(e);
    },

    /** The manager is done; hand the knight's hover phase back. IDENTICAL. */
    4(e, state) {
      if (state.knight) state.knight.siner2 = e._siner;
      e.done = true;
      swordfallDestroy(e, state);
      destroy(e);
    },

    /** He slides out and shrinks away, then drops his sword. IDENTICAL. */
    5(e) {
      e.slideT = 0;
      e.slideFromX = e.x;
      e.alarm[0] = 8;
    },
  },

  step(e, state) {
    e.local_turntimer -= 1;
    // `obj_knight_enemy.siner2 = 0` every step — his hover is FROZEN for the
    // whole attack and handed back by alarm 4.
    if (state.knight) state.knight.siner2 = 0;

    // KAIZO Step_0:5-8 — `with (obj_heart) mask_index =
    // spr_dodgeheart_smaller_2px_mask;` — the soul's hurtbox shrinks 2px per
    // side EVERY frame this controller lives (re-applied so it wins over
    // anything that resets it earlier in the frame). A `with` over zero
    // instances is a no-op, hence the guard. Restored by the next turn's
    // fresh soul, exactly as the mod relies on obj_moveheart's per-turn heart.
    if (state.soul) state.soul.mask = KAIZO_HEART_2PX_MASK;

    // KAIZO Step_0:9-11 — the afterimage block's `image_blend = c_white`.
    // The BLOCK is vanilla (Step_0:5-25 there) and its scr_afterimage calls
    // are visual, so the sim module never translated them; this one line is
    // the mod's insert and it is NOT decoration. Its gate excludes
    // spr_roaringknight_sword_ol, which is precisely the sprite the Draw
    // tints blue (Draw_0:6-8) — so the two never fire on the same frame, and
    // this is what wipes the blue back off when alarm 2's +9 swaps the pose to
    // spr_roaringknight_attack_ol_center. Without it the arm's tint stains the
    // attack pose for the rest of the turn. Zero RNG.
    if (state.frame % 4 === 0 && e.sprite_index !== 'spr_roaringknight_sword_ol'
      && (e.image_alpha ?? 1) !== 0
      && !(e.alarm[5] > 0.5) && !(e.alarm[2] > 0.5)) {
      e.image_blend = WHITE;
    }

    // Alarm 5's two 8-frame "out" lerps.
    if (e.slideT !== undefined && e.slideT < 8) {
      e.slideT += 1;
      const t = e.slideT / 8;
      const out = 1 - (1 - t) * (1 - t);
      e.image_xscale = 2 * (1 - out);
      e.x = e.slideFromX + 110 * out;
    }
    // Alarm 2's chained return lerps, and the pose swap at +9.
    if (e.returnT !== undefined) {
      e.returnT += 1;
      if (e.returnT === 9) {
        e.sprite_index = 'spr_roaringknight_attack_ol_center';
        e.image_angle = 0;
        e.image_yscale = 2;
      }
    }

    // KAIZO Step_0:31-41 — kaizo attack 102 runs swordfall on top of the
    // underbox circles; once this clock drops under 120 the circles' alarms
    // are pinned at 999 EVERY frame, freezing their expand/fire cycle for
    // the rest of the turn. `obj_knight_enemy.myattackchoice` is the sim's
    // state.currentAc; gmlEq because the mod's ac ids are reals (102.1
    // exists elsewhere and must NOT trigger this — |0.1| > epsilon).
    if (gmlEq(state.currentAc, 102)) {
      if (e.local_turntimer < 120) {
        for (const c of state.entities) {
          if (c.alive && c.type.name === 'obj_knight_weird_circle') {
            c.alarm[0] = 999;
            c.alarm[1] = 999;
          }
        }
      }
    }

    // `if (alarm[0]) exit;` — nothing below runs while his own sword is armed.
    if (e.alarm[0] > 0.5) return;

    e.countdown -= 1;
    if (e.countdown !== 0) return;

    // THE FINISH. `ex` stops the rain early: 30 at difficulty 1 (vanilla),
    // 75 at difficulty 5 (KAIZO Step_0:54-57) — the d5 wind-down triggers at
    // local_turntimer < 160 - 75 = 85.
    let ex = 0;
    if (e.difficulty === 1) ex = 30;
    if (e.difficulty === 5) ex = 75;
    if (e.local_turntimer < e.turn_time - ex) {
      e.countdown = 99999;
      e.local_turntimer = 99999;
      // TWO ENDINGS, and the turn_type picks one — sim copy verbatim.
      if (e.turn_type !== 'start' && e.turn_type !== 'short start'
        && e.turn_type !== 'short mid') {
        e.alarm[1] = 8;
        e.alarm[2] = 60;
      } else {
        scrLerpvar(state, spawn, e, 'image_index', 4, 0, 8);
        e.alarm[3] = 4;
      }
      return;
    }

    if (e.difficulty === 10) {
      // KAIZO Step_0:74-119 — the deterministic mirrored DOUBLE-SWEEP. Two
      // near-vertical swords per volley walk across a 300px band centred on
      // the soul's spawn column (obj_heart.xstart ± 150), y = box top − 20,
      // each tilted 15° toward its travel direction; the walk fraction
      // `sword_xp` ping-pongs off the ends with an extra `+_swinc` nudge on
      // the bounce. ZERO RNG in this branch — B-Side is a settings read.
      //
      // `sword_xp`/`sword_dr` are PLAIN instance variables: f64 in GML
      // (traces/f32-probe.csv — only built-ins narrow), so they accumulate
      // in plain JS doubles here. The delta spec's "accumulate in f32" note
      // contradicts the measured probe and is not followed.
      let _swinc = 0.125;
      if (state.kaizo?.sideb) _swinc = 0.08; // kaizo_sideb() — Step_0:77-80
      if (e.sword_xp === undefined) { // variable_instance_exists — Step_0:81-85
        e.sword_xp = -_swinc;
        e.sword_dr = 1;
      }
      const _boxR = state.soul.xstart + 150;
      const _boxL = state.soul.xstart - 150;
      const _boxT = getBox(state, 1) - 20;
      const _gtw = _boxR - _boxL;
      let _swx = _boxL + _gtw * e.sword_xp;
      const _swy = _boxT;
      {
        const s = spawn(state, fallingSword, { x: _swx, y: _swy });
        s.image_angle = 270 + 15 * e.sword_dr;
        s.direction = s.image_angle;
        s.speed = -4;
        scrLerpvar(state, spawn, s, 'image_yscale', 0, -1, 8);
        // `n - 1`, like dropSword and for the same reason: this pair is
        // spawned from the manager's STEP, on the same frame the mod spawns
        // it, so the return tween has to land on the ramp's last frame rather
        // than after it. MEASURED at _tok3 f6295 -- the recording's yscale
        // runs ...-0.75, -0.875, -0.75, -0.5 and never reaches -1, because the
        // return's first write (-0.75) overwrites the ramp's final -1 on the
        // same frame; the sim's plain `8` let the -1 stand and then ran a
        // frame behind for the rest of the sword's life. See delayedLerp's
        // note: every site arms its own count, and the count is decided by
        // where the mod makes the call.
        scrLerpvar(state, spawn, s, 'image_angle', s.image_angle, s.image_angle + 360, 16, 1);
        scrLerpvar(state, spawn, s, 'image_alpha', 0, 1, 16, 1);
      }
      _swx = _boxR - _gtw * e.sword_xp;
      {
        const s = spawn(state, fallingSword, { x: _swx, y: _swy });
        s.image_angle = 270 + 15 * -e.sword_dr; // the mirrored tilt
        s.direction = s.image_angle;
        s.speed = -4;
        scrLerpvar(state, spawn, s, 'image_yscale', 0, -1, 8);
        delayedLerp(state, s, 8 - 1, 'image_yscale', -1, 1, 8); // the mirror, same count
        scrLerpvar(state, spawn, s, 'image_angle', s.image_angle, s.image_angle + 360, 16, 1);
        scrLerpvar(state, spawn, s, 'image_alpha', 0, 1, 16, 1);
      }
      e.sword_xp += _swinc * 2 * e.sword_dr; // Step_0:113
      if (e.sword_xp > 1 || e.sword_xp < 0) { // Step_0:114-118
        e.sword_xp += _swinc;
        e.sword_dr = -e.sword_dr;
      }
    } else {
      dropSword(state, e, boxOf(state));
    }

    // The cadence blocks, in the kaizo file's order (only one can match).
    if (e.difficulty === 5) {
      // KAIZO Step_0:155-163 — first volley clamps the vanilla 29 down to
      // 14, then eases toward 8 by 0.4/volley; GML round() is HALF-TO-EVEN
      // (gmlRound), and countdowner accumulates fractional 0.4 steps.
      if (e.countdowner > 14) {
        e.countdowner = 14;
      }
      e.countdowner = scrApproach(e.countdowner, 8, 0.4);
      e.countdown = gmlRound(e.countdowner - gmlIrandom(state.gmlRng, 1));
    }
    if (e.difficulty === 0) {
      e.countdowner = scrApproach(e.countdowner, 5, 5);
      e.countdown = e.countdowner - gmlIrandom(state.gmlRng, 1);
    }
    if (e.difficulty === 1) {
      e.countdowner = scrApproach(e.countdowner, 4, 5);
      e.countdown = e.countdowner;
    }
    if (e.difficulty === 10) {
      // KAIZO Step_0:174-177 — flat cadence: 12, or 9 on the B-Side.
      e.countdown = 12 - (state.kaizo?.sideb ? 1 : 0) * 3;
    }
    if (e.difficulty === 11) {
      // KAIZO Step_0:178-182 — 29 → 25 → 21 → 17 → 13 → 9 → 8, no jitter.
      e.countdowner = scrApproach(e.countdowner, 8, 4);
      e.countdown = e.countdowner;
    }
  },

  /**
   * Draw_0's one state write. KAIZO swordfall Draw_0:6-8 — the
   * `else if (sprite_index == spr_roaringknight_sword_ol)` arm opens with
   * `image_blend = get_swordcolor();` (vanilla's same arm has no such line).
   * The other two arms draw with whatever image_blend already holds, which the
   * Step's c_white reset keeps white. Draw runs after Step, so endStep. Zero RNG.
   */
  endStep(e, state) {
    if (e.sprite_index === 'spr_roaringknight_sword_ol') {
      e.image_blend = getSwordcolor(state);
    }
  },

  /**
   * Draw_0's OTHER state write — KAIZO swordfall Draw_0:1-3 (byte-identical
   * to vanilla here):
   *
   *     if (forcexfix && sprite_index == spr_roaringknight_attack_ol_center) {
   *         _siner++;
   *         draw_sprite_ext(..., obj_knight_enemy.ystart + (cos(_siner / 8) * 8), ...)
   *
   * The returning pose hovers on `_siner`, and NEITHER sim tree ticked it:
   * the sim module initialises `_siner = 0` (Create_0:18) and hands it to the
   * knight in alarm 4 (Alarm_4:2), and render/draw/swordfall.js reads it
   * saying "the sim owns it" — so the pose sat at cos(0) for its whole
   * 17-frame hover (alarm 2 + 9, when the sprite becomes the attack pose,
   * to alarm 4 at + 26). The engine's draw slot (sim/index.js "THE DRAW
   * SLOT") is the phase that matches a Draw-event increment: it runs after
   * every End Step, so alarm 4 on the next frame reads the count the last
   * Draw left, exactly as the GML's Alarm_4 does. GameMaker runs no Draw for
   * an invisible instance, hence the visible guard (sim/actors.js draw()
   * uses the same one). Zero RNG.
   *
   * What it reaches: kaizo/render/draw/swords.js drawObjKnightSwordfall (the
   * hover), and alarm 4's `state.knight.siner2 = e._siner` — which lands on
   * the battle RECORD, not the actor entity that bobs (sim/actors.js:227-231
   * names that split; the actor's draw() ticks `e.siner2` on the entity), so
   * the handoff does not move the knight here any more than it did at 0.
   * That wrong-object write is the sim copy's, pre-existing and untouched;
   * the vanilla module's alarm 4 (sim/attacks/swordfall.js:481) has the same
   * shape. Vanilla page: unchanged — this slot exists on the kaizo type only.
   */
  draw(e) {
    if (e.visible === false) return;
    if (e.forcexfix && e.sprite_index === 'spr_roaringknight_attack_ol_center') {
      e._siner += 1;
    }
  },
};

function boxOf(state) {
  const gt = state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
  return gt ? { x: gt.x, y: gt.y } : { x: state.view.x + 320, y: state.view.y + 170 };
}

// DELIBERATELY NOT REGISTERED as combination segment 4 — the sim module's
// registerComboAttack(4, knightSwordfall) mutates the SHARED registry in
// sim/attacks/combination.js, and a kaizo import must never change what the
// verified sim does (kaizo/HANDOFF.md §2.1). The central integration owns
// any kaizo-side chain routing.
