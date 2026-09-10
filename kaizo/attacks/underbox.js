// KAIZO V-C — obj_knight_weird_bottom_manager + obj_knight_weird_circle,
// as EnderCat8's "Kaizo Roaring Knight" v2.3.3 rebuilds them (controller
// `type = 106`, the mod's acs 3 / 4 / 101 / 102 — plus the latent 102.1).
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission. (kaizo/HANDOFF.md §5-C: research/playtesting only.)
//
// PROVENANCE. A copy of the VERIFIED sim module sim/attacks/underbox.js with
// ONLY the mod's deltas applied; every line the mod did not touch is
// byte-identical to that module, and the unchanged big bullet is re-exported
// from it rather than copied. Kaizo GML ground truth
// (knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/, diffed against
// gml_vanilla_v105/):
//
//   gml_Object_obj_knight_weird_bottom_manager_Create_0.gml   (lines 27-43)
//   gml_Object_obj_knight_weird_bottom_manager_Step_0.gml     (lines 9-20)
//   gml_Object_obj_knight_weird_bottom_manager_Alarm_1.gml    (lines 1, 48,
//                                                              55, 63, 72-77)
//   gml_Object_obj_knight_weird_circle_Alarm_1.gml            (lines 26, 40)
//
// WHAT DIVERGES from sim/attacks/underbox.js — the mod's complete delta set
// for this attack:
//
//   1. CREATE appends `norng = 0; seed = 0; delay = 18;` then two ac gates:
//      myattackchoice 102.1 -> norng = 1 + random_set_seed(1225) (and a dead
//      local, `var _devcomm = "don't worry about it";`); myattackchoice 102
//      -> delay = 29, or 27 under kaizo_sideb(). (Create_0 27-43.)
//   2. STEP stamps the soul's mask to spr_dodgeheart_smaller_2px_mask EVERY
//      frame (with (obj_heart), unconditional — every kaizo run of this
//      attack shrinks the soul), then offsets the recomputed ellipse centre:
//      center_y += 92 for ac 101, += 32 for ac 102. 102.1 fails both integer
//      gates and keeps the vanilla centre. (Step_0 9-20.)
//   3. ALARM 1 opens with `var _d = delay;` and swaps the literal 18 for _d
//      in all four cadence formulas (the three orb `with` blocks and the
//      manager's own re-arm); with norng it does `seed += 49121;
//      random_set_seed(seed);` immediately before the re-arm's irandom(3) —
//      the 102.1 deterministic-pattern hook. (Alarm_1 1/48/55/63/72-77.)
//   4. obj_knight_weird_circle Alarm_1 halves the two diamond fans:
//      damage 206 -> 103 (both rings; the mod's systematic half-damage
//      tier). The big obj_knight_weird_circle_bullet KEEPS 206 — identical
//      both sides, so it is re-exported from the sim module unchanged.
//   5. manager Alarm_2's kaizo diff is pure OBJECT-ID renumbering
//      (367->366, 672->669, 806->802, 633->630 — asset insertion shifted the
//      ids) inside the `next_up` chain the sim never translated (standalone
//      next_up is -999). No spec written for it, nothing to translate.
//
// DAMAGE PLUMBING, dc.damage 87/103 — where the bullets REALLY get their
// damage in the kaizo GML: obj_knight_enemy Other_23 sets `dc.damage = 87`
// (ac 3 solo row) or `dc.damage = 103` (ac 4 / 101 / 102 rows) on the
// type-106 controller, and the controller's `scr_bullet_inherit(knight_weird)`
// (obj_dbulletcontroller Step_0 line 2242) copies it onto the MANAGER — where
// it DIES. The orbs are plain instance_create (no inherit; manager Alarm_0),
// and every volley bullet is scr_fire_bullet with arg7 (inherit) defaulted
// FALSE and an explicit `damage =` in its with-block: 206 on the big shot,
// 103 on the fans (weird_circle Alarm_1 8/26/40). So the fans' halving is the
// hardcoded 103, and dc.damage 87 vs 103 changes nothing the player feels in
// this attack. launchUnderbox still carries the value onto the manager
// (opts.dcDamage) so the flow is translated faithfully end to end.
//
// THE SOUL MASK. spr_dodgeheart_smaller_2px_mask is a kaizo-ADDED sprite,
// extracted from the mod's own data-kaizo.win by
// kaizo/tools/pack-kaizo-sprites.mjs and served from kaizo/data/masks.js:
// 20x20, origin (0,0), Precise, bbox [4,4]..[15,15] — the vanilla
// spr_dodgeheartmask heart contracted 2px per side (the FIGHT soul normally
// collides as HEART_RECT, the full 20x20 rect, so this is a large nerf to
// incoming fire). The GML re-stamps it every step and NOTHING restores it on
// destroy — the next turn's moveheart handoff (`heart.mask_index =
// mask_index`) is the restore, which the kaizo turn loop's per-turn soul
// respawn already models (state.soul.mask = HEART_RECT). restoreHeartMask()
// is exported for scenes that do NOT respawn the soul per turn (SINGLE-style
// drills).
//
// IT IS NOW READ, NOT REBUILT. Three kaizo modules each hand-built this
// hurtbox from spec prose and two of them disagreed — swordfall.js used the
// ART sprite's geometry (spr_dodgeheart_smaller_2px, AxisAlignedRect
// [2,2]..[17,17]), which is a SQUARE, not a heart, and a different sprite
// entirely. kaizoMask() settles it: one extracted object, shared by identity
// across swordfall.js, knight-stream.js and this module (see maskWithPx
// below), so restoreHeartMask() recognises the mask whichever attack stamped
// it — exactly as the GML's single spr_dodgeheart_smaller_2px_mask does.
//
// GML->SIM MAPPINGS used here (established elsewhere in the tree):
//   obj_knight_enemy.myattackchoice  -> state.currentAc  (set by fight.js,
//                                       single.js and the V-C launcher)
//   kaizo_sideb()                    -> state.kaizo?.sideb
//   random_set_seed(n)               -> state.gmlRng = gmlCreate(n)  (the
//                                       launcher's own reanchorRng idiom)
//   fractional ids (102.1)           -> gmlEq(), never ===
//
// SETTLED — AN ALARM STORE TRUNCATES. This note used to be the file's one OPEN
// question, and it named its own experiment: kaizo's odd delay (29/27) makes
// `(alarm[1] / 2) - 2` fractional on EVERY ac-102 firing (12.5 / 13.5 / 14.5 /
// 15.5), that value goes into obj_script_delayed's alarm[0], an int-backed
// builtin, and every one of them is an exact tie — so the rounding rule is
// fully exposed here and nowhere else in the fight.
//
// It did not need a new game probe in the end: the RECORDING already answers
// it. The ring's accumulated `angle` is a running total of `spin`, and `spin`
// is exactly what this delayed lerp settles, so a one-frame difference in when
// the settle leg starts shows up as a rotated ring — and the ring's orbs are
// where the volley's nine bullets are born, at a position the bullet sheet
// records to ten digits. Frenzy2B's first volley, oracle f6290:
//
//     half-to-even (12/14/14/16)   orb x 247.0809783935547   WRONG
//     half-up      (13/14/15/16)   orb x 247.0809783935547   WRONG
//     ceil         (13/14/15/16)   orb x 247.0809783935547   WRONG
//     TRUNCATE     (12/13/14/15)   orb x 265.4803466796875   the recording
//
// and the recording says 265.4803466797, with y 415.7250061035 agreeing on the
// same line. Truncation is the only one of the four that rounds DOWN on every
// tie, so this is not a one-value coincidence: it is four ties in a row, each
// one distinguishing.
//
// SO: `alarm[i] = <real>` TRUNCATES TOWARD ZERO — it does not use GML's round().
// That is a property of the alarm array (int-backed in the runner), not of
// GML's rounding, which stays half-to-even everywhere else and is left alone.
// Only positive values are measured here; the toward-zero half of "truncate"
// is the C convention, not something this recording shows.
//
// The obj_lerpvar DURATIONS keep the fractional value either way (plain
// instance var; sim/lerpvar.js's `time >= maxtime` matches the GML byte for
// byte) — it is only the alarm store that flattens.
//
// WORTH CARRYING: any other translated `alarm[i] = <expression>` that can land
// fractional wants Math.trunc, not gmlRound. This is the only site in the
// fight that exposes it, so it is the only one measured.
//
// CHAINED TEARDOWN — WHAT THIS FILE OWNS OF atk_Frenzy3's GAP, AND WHAT IT
// DOES NOT. ac 106 is the COMBINATION (Other_23:553-563, dc.type 105, order
// 1-2-5), so the underbox arrives as SEGMENT 3 with turn_type "short end" —
// not as the standalone "full" manager every other row of the fight uses.
// Two things in the mod are different for that manager, and only the first
// is in this module:
//
//   1. FIXED HERE, 2026-08-30. Alarm_1's wind-down carried only the "full"
//      arm — `alarm[2] = 40` and two 20-frame-delayed restores. The mod's
//      else-arm is `alarm[2] = 32` plus an IMMEDIATE image_index lerp and
//      image_alpha = 1 for "end"/"short end" (Alarm_1:11-43). The manager
//      hands the turn back from its Destroy, so the wrong tail is 8 frames of
//      turn length. Whole-fight diff against kaizo_oracle_trace_tok3.csv:
//      atk_Frenzy3's bullet phase sim 305 -> 297 against the mod's 225, and
//      no other entry's bullet phase moved. check-underbox's "chained
//      teardown" block pins all four arms and is sabotage-tested.
//
//   2. NOT HERE, AND CLOSED 2026-08-31 — the +67 (measured +71) is fixed. The
//      cause and the fix were both at the HANDOFF SITE, never in this manager:
//      kaizo/attacks/rotating-slash.js now carries all four of Step_0:64-196's
//      early-spawn blocks, so the id-5 block births this manager at rs+11 as
//      the mod does, and `rotating_step`'s post puts `init_start = 4; init = 8`
//      back on AFTER event_user(0). Measured on _tok3's atk_Frenzy3: the
//      manager's birth moved 71 frames earlier and the spurious second volley
//      went away, taking the row's bullet phase from +66 to +6 and the whole
//      fight from sum|drift| 610 to 528. atk_Frenzy1's segment-3 bullet phase
//      became EXACT in the same edit. check-oracle-weird.mjs now ASSERTS the
//      three spans (segment 2 -> segment 3, manager -> orbs, orbs -> first
//      volley) instead of printing them, and is sabotage-tested.
//
//      STILL OPEN, smaller: first volley -> second reads mod 18 / sim 24 on
//      route C and 24/24 on route D, so one route's volley cadence is not yet
//      exact. That span is deliberately NOT asserted and the note still
//      carries it.
//
//      (historical) The mod creates this
//      manager MID-PATTERN, from obj_knight_rotating_slash's Step_0:169-196
//      (`local_turntimer < turn_limit_4 && next_up == 5`), 11 frames into a
//      segment that keeps slashing for another 60 — and that block ALSO
//      forces `init_start = 4; init = 8;` back on AFTER event_user(0), so a
//      "short end" manager keeps the "full" arming cadence. The sim hands off
//      from obj_knight_rotating_slash's Alarm_2 instead, so the manager is
//      born 67 frames late AND takes the arm's own init_start 2 / init 1,
//      which fires a spurious second volley two frames after the first
//      (measured: mod orbs -> first volley 29 frames, one volley; sim 18,
//      two). Both live at the HANDOFF SITE — kaizo/attacks/rotating-slash.js
//      and kaizo/attacks/combination.js (`rotating_step` is already
//      transcribed there, and the four Step_0 blocks now call it) — not in
//      the manager, and
//      check-oracle-weird already NOTEs them per route.
//
// VERIFICATION STATUS: translated from the kaizo dump against the delta
// specs (knight-research/kaizo-mod/deltas/), positive-assertion suite at
// kaizo/tools/checks/check-underbox.mjs, and NOW ORACLE-DIFFED —
// kaizo/tools/checks/check-oracle-weird.mjs holds the four family entries
// against recordings of both routes (kaizo_oracle_seq_deep.csv and _sideb).
// What that settled about THIS file: the five orbs' x and y match the mod to
// ten decimals on ac 3, ac 101 (+92) and ac 102 (+32) — see boxBottom's f32
// note, which one of those comparisons selected — the ring appears on a
// single frame, the volley is one big shot plus seven fans on the same frame
// with the mod's own directions and speed split, and the cadence floor is the
// mod's 18 / 29 / 27 with every gap inside `delay + 2 * irandom(3)`.
// STILL DIVERGING, and reported by that check rather than hidden here: the
// orbs -> first volley interval is one frame short, constant across both
// routes, root-caused to sim/entity.js's alarm ordering rather than to
// anything in this module.

import { spawn, destroy } from '../../sim/entity.js';
import { lengthdirX, lengthdirY, gmlEq } from '../../sim/gml.js';
import { gmlIrandom, gmlChoose, gmlCreate } from '../../sim/rng.js';
import {
  regularbulletCreate, regularbulletStep, collidebulletOther15, scrBulletInit,
} from '../../sim/bullets/regularbullet.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import {
  scrAfterimage, scrAfterimageGrowAttached,
  knightWarp, knightWarpOut,
} from '../../sim/fx.js';
import { DIAMONDFORM_MASK, enginePairHit, HEART_RECT } from '../../sim/masks.js';
import { kaizoMask } from '../data/masks.js';
import { cue } from '../../sim/audio.js';
// The big central shot is UNCHANGED by the mod (damage 206, destroyonhit 0,
// graze re-arm, gravity ramp — kaizo weird_circle Alarm_1 lines 5-20 are
// byte-identical to vanilla), so the verified object is reused, not copied.
import { weirdCircleBullet } from '../../sim/attacks/underbox.js';

export { weirdCircleBullet };

// NOTE: the sim module ends with `registerComboAttack(5, weirdBottomManager)`.
// This copy deliberately does NOT register — that registry is shared sim
// state, and replacing its segment with the kaizo manager from a kaizo import
// would violate the isolation contract (kaizo/HANDOFF.md §2.1).

/**
 * An extracted mask, given the `px` boolean grid sim/masks.js's samplers walk.
 *
 * kaizo/data/masks.js stores rows as '0'/'1' strings (sim/data/masks.json's
 * format) and its `kaizoMask()` hands back THE SAME OBJECT on every call, in
 * every importer — ES modules are singletons. Deriving the grid ONTO that
 * object rather than into a copy is what makes the mask one shared value
 * across modules: swordfall.js, knight-stream.js and this file all end up
 * holding the identical reference, so `state.soul.mask === ...` tests (and
 * restoreHeartMask below) hold no matter which attack stamped it. A copy per
 * module would reproduce, in JS identity, exactly the split this reconciles.
 *
 * Idempotent, additive, and derived — regenerating kaizo/data/masks.js drops
 * the memo and the next call rebuilds it. Nothing here edits that file.
 */
function maskWithPx(m) {
  if (!m.px) m.px = m.rows.map((r) => Array.from(r, (c) => c === '1'));
  return m;
}

/**
 * `spr_dodgeheart_smaller_2px_mask` — the mod's shrunken soul hitbox, READ
 * from the extraction (see header). 20x20 Precise, bbox [4,4]..[15,15], 100
 * solid pixels in a heart shape, versus HEART_RECT's 400.
 *
 * NOT `spr_dodgeheart_smaller_2px` — that is the companion ART sprite, an
 * AxisAlignedRect with bbox [2,2]..[17,17], and using its geometry turns the
 * soul's hurtbox into a square. Same art/mask split as vanilla's
 * spr_dodgeheart / spr_dodgeheartmask pair; the GML names the `_mask` one.
 */
export const KAIZO_SMALLER_HEART_MASK = maskWithPx(
  kaizoMask('spr_dodgeheart_smaller_2px_mask'),
);

/**
 * The restore half of the swap, for scenes that do not respawn the soul each
 * turn. The GML never restores — obj_moveheart's next handoff does
 * (`heart.mask_index = mask_index`, i.e. spr_dodgeheart -> HEART_RECT), so
 * this puts back exactly what that handoff would. A per-turn-respawn loop
 * (kaizo-practice.js) needs no call; its fresh soul already gets HEART_RECT.
 */
export function restoreHeartMask(state) {
  if (state.soul && state.soul.mask === KAIZO_SMALLER_HEART_MASK) {
    state.soul.mask = HEART_RECT;
  }
}

/**
 * `scr_script_delayed(...)` — a call that lands n frames later, carried on the
 * target itself so it needs no scheduler. Same idea as swordfall.js's
 * `delayedLerp`, generalised: this attack also defers plain assignments
 * (`scr_var`) and an `instance_destroy`.
 */
function delayed(target, delay, fn) {
  (target.pendingDelayed ??= []).push({ delay, fn });
}

function tickDelayed(state, e) {
  if (!e.pendingDelayed || !e.pendingDelayed.length) return;
  for (const p of e.pendingDelayed) p.delay -= 1;
  const due = e.pendingDelayed.filter((p) => p.delay <= 0);
  e.pendingDelayed = e.pendingDelayed.filter((p) => p.delay > 0);
  for (const p of due) p.fn(state, e);
}

/**
 * The fan shots — plain obj_regularbullet wearing spr_diamondbullet_form.
 * KAIZO: damage 206 -> 103 (weird_circle Alarm_1 lines 26 and 40 — both
 * rings; the mod's systematic half-damage tier). Everything else identical
 * to the sim module's weirdFanBullet.
 */
export const weirdFanBullet = {
  name: 'obj_knight_weird_fan',
  // The mod fires these as bare obj_regularbullet instances (the seq log and
  // check-oracle-weird's SIM_TO_MOD_NAME agree); the graze feed keys on that
  // name, so the replay matches on it. The sim name stays for the tools.
  gmlName: 'obj_regularbullet',

  create(e, state) {
    regularbulletCreate(e, state);
    e.sprite_index = 'spr_diamondbullet_form';
    e.damage = 103; // KAIZO — kaizo weird_circle Alarm_1 line 26/40 (was 206)
    e.element = 5;
    e.grazepoints = 3;
  },

  step: regularbulletStep,

  collides(e, heart) {
    if (e.active !== 1 && e.active !== true) return false;
    return enginePairHit(heart, e, DIAMONDFORM_MASK);
  },

  other15: collidebulletOther15,
};

/**
 * obj_knight_weird_circle — one orb on the ellipse. Create/Step/Alarm 0 are
 * byte-identical to vanilla in the kaizo dump; Alarm 1 differs only in the
 * fan damage, which lives in this module's weirdFanBullet above.
 */
export const weirdCircle = {
  name: 'obj_knight_weird_circle',

  create(e) {
    e.sprite_index = 'spr_knight_weird_shadow'; // object definition
    e.angle = 0;
    e.distance = 0;
    e.spin = 0;
    e.master = e;
    e.timer = 0;
    e.r = 64;
    e.g = 64;
    e.b = 64;
    e.rgb_rate = 24;
    e.hellzone = false;
    // The orb itself has no mask and no Other_15 — only its bullets bite.
  },

  step(e, state) {
    // `hellzone` clamps the fuse to 13. Only the combination attack's "short"
    // segments set it, so it is inert in the standalone form; kept so the
    // condition reads the same as the dump.
    if (e.hellzone && e.alarm[1] > 13) e.alarm[1] = 13;
    e.timer += 1;
    // GML truthiness: `if (alarm[1])` means `> 0.5`, so an idle -1 is FALSE.
    if (e.alarm[1] > 0.5) {
      // THE WIND-UP GLOW: 64 -> 255 across rgb_rate frames.
      e.r += 191 / e.rgb_rate;
      e.g += 191 / e.rgb_rate;
      e.b += 191 / e.rgb_rate;
      if (e.alarm[1] < 16 && e.alarm[1] % 4 === 0) {
        scrAfterimageGrowAttached(state, e, e, e.image_blend, false);
      }
    }
  },

  alarm: {
    /** `exit;` — it exists only so the Draw can blink while it counts. */
    0() {},

    /** THE VOLLEY. */
    1(e, state) {
      e.r = 64;
      e.g = 64;
      e.b = 64;
      cue(state, 'snd_drake_dodge', 1, 1);

      const big = spawn(state, weirdCircleBullet, { x: e.x, y: e.y });
      big.direction = 90;
      big.speed = 6;
      big.gravity_direction = big.direction;
      big.gravity = 0.2;
      big.image_speed *= 0.5;
      scrLerpvar(state, spawn, big, 'image_yscale', 3, 2, 12);
      scrLerpvar(state, spawn, big, 'image_xscale', 0, 2, 12);
      big.image_angle = big.direction;

      for (let a = 0; a < 5; a++) {
        const b = spawn(state, weirdFanBullet, { x: e.x, y: e.y });
        b.direction = 27.5 + 31.25 * a;
        b.speed = 4;
        b.image_angle = b.direction;
      }
      for (let a = 0; a < 4; a++) {
        // a == 1 and a == 2 are SKIPPED. Without the `continue` this second
        // fan is a wall with no gap in it.
        if (a === 1 || a === 2) continue;
        const b = spawn(state, weirdFanBullet, { x: e.x, y: e.y });
        b.direction = 40 + 33.333333333333336 * a;
        b.speed = 6;
        b.image_angle = b.direction;
      }
    },
  },
};

export const weirdBottomManager = {
  name: 'obj_knight_weird_bottom_manager',

  /**
   * IT STEPS BEFORE THE SOUL, and the mask stamp below is why that matters.
   *
   * This manager's Step opens by shrinking the soul's hurtbox
   * (`with (obj_heart) mask_index = spr_dodgeheart_smaller_2px_mask`,
   * Step_0:9-12), and obj_heart's own Step then moves and wall-resolves with
   * whichever mask it is holding. GameMaker runs Steps in OBJECT INDEX order
   * and this manager is 1173 against obj_heart's 1462, so in the game the
   * shrink always lands before the move — on the manager's FIRST step.
   *
   * This lane steps OLDEST FIRST (kaizo-fight.js declines
   * `state.stepNewestFirst`, with its receipts), so a manager created this
   * turn stepped AFTER the soul and the stamp arrived a frame late. MEASURED
   * on _rev1: the manager is born at oracle f10658, the game's soul takes a
   * full 4 px to 374 on f10659 — only the smaller mask allows that, its wall
   * rest being 376 against the 20x20 rect's 372 — and this sim's soul stopped
   * at 372 that frame and reached 376 on the next. Two pixels, one frame, and
   * both sides agree again immediately after.
   *
   * -1 is the same knob obj_sword_vortex (sim/entity.js's phaseList note) and
   * the cut box carry for measured handoffs of exactly this kind: the flag
   * cannot go on globally until every oldest-first fit in this lane is
   * undone with the GML in hand, so the one ordering the recording pins is
   * emulated at its site.
   */
  stepOrder: -1,

  create(e, state) {
    scrBulletInit(e);
    // scr_darksize()
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.sprite_index = 'spr_knight_warp'; // object definition
    e.image_index = 8;
    e.image_speed = 0;
    e.image_alpha = 1;
    e.timer = 0;
    e.spin = 2;
    e.angle = 0;
    e.amount = 1;
    e.init_start = 4;
    e.init = 8;
    e.circle_val = 0;
    e.circle_goal = 5;
    e.circle_distance = 120;
    e.circle_list = [];
    e.endme = false;
    e.alarm[0] = 16;
    e.center_x = boxCentreX(state);
    e.center_y = boxBottom(state) + 43;
    e.anchor_x = e.x;
    e.anchor_y = e.y;
    e.difficulty = 0;
    e.turn_type = 'full';
    e.turn_segment = -1;
    e.next_up = -999;
    e.next_next_up = -1;
    e.local_turntimer = 340;
    // KAIZO — Create_0 lines 27-43, appended after `local_turntimer = 340`.
    e.norng = 0;
    e.seed = 0;
    e.delay = 18;
    // `obj_knight_enemy.myattackchoice == 102.1` — a FRACTIONAL kaizo attack
    // id, so gmlEq per the translation law. Nothing in the mod's own script
    // ever assigns 102.1 (grepped the whole kaizo dump: this Create is the
    // only site) — the deterministic twin is latent/dev content, kept live
    // here exactly as shipped ("don't worry about it", says the dead local).
    if (gmlEq(state.currentAc, 102.1)) {
      e.norng = 1;
      // random_set_seed(1225) — a GLOBAL-stream reseed at Create time; every
      // later draw by ANY object comes from the 1225 stream. Same idiom as
      // the launcher's reanchorRng: replace state.gmlRng wholesale.
      state.gmlRng = gmlCreate(1225); // KAIZO Create_0 line 33
    }
    if (gmlEq(state.currentAc, 102)) {
      e.delay = 29; // KAIZO Create_0 line 38 — fire cadence 18 -> 29
      if (state.kaizo?.sideb) { // kaizo_sideb() = obj_knight_enemy.k_sideb
        e.delay = 27; // KAIZO Create_0 line 41 — B-Side: 27
      }
    }
    e.pendingDelayed = [];
  },

  /** Other_10. The four `difficulty` blocks in the original are all EMPTY. */
  init(e) {
    e.local_turntimer = 340;
    e.x += 200;
    delayed(e, 8, (st, m) => scrLerpvar(st, spawn, m, 'image_index', 8, 5, 8));
    delayed(e, 16, (st, m) => { m.image_alpha = 0; });
  },

  alarm: {
    /** Seed the ring, one orb every `init_start` frames until five exist. */
    0(e, state) {
      // ORIGINAL BUG, inert: `var rep = 1; if (short start/mid) rep = 6;` and
      // then `repeat (6)` — `rep` is computed and never used, so every
      // turn_type runs the loop six times. Another `linex`.
      for (let i = 0; i < 6; i++) {
        if (e.circle_val < 5) {
          e.circle_val += 1;
          const c = spawn(state, weirdCircle, { x: e.x, y: e.y });
          c.angle = (360 / e.circle_goal) * e.circle_list.length;
          c.distance = e.circle_distance;
          c.spin = e.spin;
          c.master = e;
          c.alarm[0] = 6;
          e.circle_list.push(c);
          e.alarm[0] = e.init_start;
        } else {
          e.alarm[1] = e.init;
        }
      }
    },

    /** Fire, rotate the queue, lurch the spin — or wind the attack down. */
    1(e, state) {
      // KAIZO — Alarm_1 line 1: `var _d = delay;`, then _d replaces the
      // literal 18 in all four cadence formulas below.
      const _d = e.delay;
      if (e.local_turntimer < 80) {
        for (const c of e.circle_list) {
          if (!c || !c.alive) continue;
          scrLerpvar(state, spawn, c, 'image_alpha', c.image_alpha ?? 1, 0, 32);
          delayed(c, 32, (st, orb) => destroy(orb));
        }
        e.x = e.anchor_x;
        e.y = e.anchor_y;
        // THE TEARDOWN IS PER turn_type, and until 2026-08-30 only the "full"
        // arm was here — so a CHAINED manager (the combination's segment 3)
        // took the standalone teardown and held the turn open 8 frames too
        // long. Alarm_1 lines 11-43, all four arms:
        //
        //     if (turn_type == "full") { alarm[2] = 40; two delayed calls }
        //     else {
        //         alarm[2] = 32;
        //         if (short start | short mid | start) switch (next_up) ...
        //         if (end | short end) { scr_lerpvar("image_index",
        //                                 image_index, 8, 8); image_alpha = 1; }
        //     }
        //
        // MEASURED on atk_Frenzy3 (ac 106, combination 1-2-5, so the manager
        // is segment 3 and its turn_type is "short end"): the mod destroys the
        // manager 140 frames after it is created and hands the clock back
        // there; the sim's 40 put that 8 frames later. See the header's
        // CHAINED-TEARDOWN note for the rest of that turn's gap, which is not
        // in this file.
        if (e.turn_type === 'full') {
          // He comes back where he left, on his own 20-frame delay.
          e.alarm[2] = 40;
          delayed(e, 20, (st, m) => scrLerpvar(st, spawn, m, 'image_index', 5, 8, 8));
          delayed(e, 20, (st, m) => { m.image_alpha = 1; });
        } else {
          e.alarm[2] = 32;
          // A MID-CHAIN segment cuts the tail short so the NEXT one can start.
          // Integer segment ids assigned from a literal table, so `===` is
          // safe here (CLAUDE.md's gmlEq law is for accumulated reals).
          // INERT in both dispatched orders — neither 4-2-3 nor 1-2-5 puts the
          // manager anywhere but last, so it never carries a live `next_up` —
          // and transcribed rather than dropped because it is four literal
          // lines of the same event.
          if (e.turn_type === 'short start' || e.turn_type === 'short mid'
              || e.turn_type === 'start') {
            switch (e.next_up) {
              case 1: e.alarm[2] = 1; break;
              case 2: e.alarm[2] = 12; break;
              case 3: e.alarm[2] = 18; break;
              case 4: e.alarm[2] = 1; break;
              default: break;
            }
          }
          // THE LAST segment shows him again IMMEDIATELY — no 20-frame wait,
          // and the lerp starts from wherever image_index is rather than from
          // the literal 5 the "full" arm re-states. The chained arms set
          // image_alpha = 0 and image_index = 5 at event_user(0), so this is
          // the only thing that puts him back on screen.
          if (e.turn_type === 'end' || e.turn_type === 'short end') {
            scrLerpvar(state, spawn, e, 'image_index', e.image_index, 8, 8);
            e.image_alpha = 1;
          }
        }
        return; // `exit;`
      }

      // KAIZO — Alarm_1 lines 48/55/63: `(_d * other.amount) - (4 *
      // max(other.amount - 1, 0))` (was 18 *). At amount 1 the fuse IS _d:
      // 18 base, 29 for ac 102, 27 B-Side.
      const fuse = _d * e.amount - 4 * Math.max(e.amount - 1, 0);
      // The frontmost `amount` orbs light up. `amount` is 1 in the standalone
      // form, so this is one orb; the > 1 / > 2 arms are the chained form's.
      for (let i = 0; i < Math.min(e.amount, 3); i++) {
        const c = e.circle_list[i];
        if (c && c.alive) {
          c.alarm[1] = fuse;
          c.rgb_rate = fuse;
        }
      }
      // `ds_list_add(list, list[0]); ds_list_delete(list, 0)` — the queue
      // rotates, so the next volley comes from the next orb round the ring.
      e.circle_list.push(e.circle_list.shift());

      // KAIZO — Alarm_1 lines 72-76: the deterministic-pattern hook.
      // `seed` walks 49121, 98242, 147363, ... and each firing reseeds the
      // GLOBAL stream immediately before the irandom(3)/choose pair, so the
      // 102.1 variant's jitter and spin direction are a fixed sequence per
      // cycle index regardless of everything before.
      if (e.norng) {
        e.seed += 49121;
        state.gmlRng = gmlCreate(e.seed); // random_set_seed(seed)
      }
      // KAIZO — Alarm_1 line 77: `_d` for 18 in the re-arm too.
      e.alarm[1] = fuse + 2 * gmlIrandom(state.gmlRng, 3);
      const newspin = gmlChoose(state.gmlRng, [-12, 12]);
      const half = e.alarm[1] / 2 - 2;
      // THE LURCH. spin swings out to +-12 and then settles back to +-1, both
      // legs eased "inout" on curve 2 — so the ring surges between volleys
      // instead of turning evenly. See sim/gml.js scrEaseInout.
      //
      // KAIZO-EXPOSED TIE: with _d 29/27, alarm[1] is odd EVERY firing, so
      // `half` is x.5 — a case vanilla's even 18 never produced. The lerp
      // DURATIONS keep the fraction (obj_lerpvar's maxtime is a plain var;
      // `time >= maxtime` handles 12.5 the same in GML and sim/lerpvar.js).
      // The DELAY is stored into obj_script_delayed's alarm[0], an int-backed
      // builtin, and an ALARM STORE TRUNCATES: 12.5 -> 12, 13.5 -> 13,
      // 14.5 -> 14, 15.5 -> 15. Measured against the recording — see the
      // header, "SETTLED — AN ALARM STORE TRUNCATES". Not gmlRound: GML's
      // round() is half-to-even and stays that way everywhere else; this is a
      // property of the alarm array, not of rounding. Math.trunc of an integer
      // is itself, so the vanilla path is untouched.
      scrLerpvar(state, spawn, e, 'spin', e.spin, newspin, half, 2, 'inout');
      delayed(e, Math.trunc(half), (st, m) => scrLerpvar(
        st, spawn, m, 'spin', newspin, Math.sign(newspin), half, 2, 'inout',
      ));
    },

    /**
     * Done. `next_up` is -999 standalone, so Alarm 2's chain block — which
     * would create the next attack in a combination — is skipped and only
     * `instance_destroy()` runs. (The kaizo diff in this event is object-id
     * renumbering INSIDE that untranslated chain block: 367->366, 672->669,
     * 806->802, 633->630 — the mod's asset insertions shifted instance_create
     * targets. Nothing to translate.)
     *
     * THE DESTROY EVENT IS WHAT ENDS THE TURN, and this engine has no Destroy
     * hook, so it runs here — alarm 2 is the object's only route to
     * destruction other than the scene's own end-of-turn sweep (which
     * restores the Knight itself, in clearTurn).
     *
     *     if (turn_type != "start" && ... && scr_bulletparent_count() < 2) {
     *         with (obj_knight_enemy) image_alpha = 1;
     *         global.turntimer = -1;
     *     }
     *
     * The controller pinned `global.turntimer` at 999999 and only this puts it
     * back — along with the Knight's alpha, which his warp-out never restored
     * (obj_knight_warp's event_user(1) has no alarm[0]). The count test means
     * "no other attack is still running", always true standalone.
     *
     * NOTE the soul's mask is NOT restored here — the GML doesn't either.
     * The next turn's moveheart handoff (or restoreHeartMask) does it.
     */
    2(e, state) {
      // The Destroy event used to be INLINED here. It is the type's
      // destroyEvent now, because Alarm_2 is not the only thing that destroys
      // this manager -- see the note there. `destroy(e, state)` carries the
      // state so the hook fires; `destroy(e)` would not.
      destroy(e, state);
    },
  },

  /**
   * obj_knight_weird_bottom_manager's DESTROY EVENT, on the TYPE where it
   * belongs -- and this is the whole of the f6492 fix.
   *
   *     if (turn_type != "start" && turn_type != "short start"
   *         && turn_type != "short mid" && scr_bulletparent_count() < 2) {
   *         with (obj_knight_enemy) image_alpha = 1;
   *         global.turntimer = -1;
   *     }
   *
   * WHY IT MATTERS THAT IT IS ON THE TYPE. Alarm_2 is not the only route to
   * this manager's death: on a PAIRED turn something else can end the turn
   * first, and then obj_battlecontroller's sweep
   * (`with (obj_bulletparent) instance_destroy()`) kills the manager where it
   * stands -- and GameMaker runs its Destroy just the same. With the event
   * inlined in the alarm, the sweep route wrote nothing.
   *
   * MEASURED, ac 102 (atk_Frenzy2B), oracle f6492. ac 102 is the underbox
   * PAIRED WITH SWORDFALL, and instrumenting the sim shows it is SWORDFALL's
   * alarm that ends this turn, not this manager's: obj_knight_swordfall is
   * destroyed in the alarm phase and its own Destroy (sim/attacks/swordfall.js
   * swordfallDestroy, the same six lines) writes global.turntimer = -1. The
   * frame then runs:
   *
   *     alarm    swordfall Destroy            turntimer = -1
   *     step     battlecontroller decrement   -2, and -2 <= 0 so SWEEP
   *     sweep    THIS manager destroyed       turntimer = -1   <- recorded
   *     f6493    decrement                    -2, and on normally
   *
   * so the recorded -1 is the manager's Destroy landing AFTER the decrement.
   * The sim had the manager alive at the sweep (instrumented: manager, five
   * obj_knight_weird_circle and the fans) and swept it correctly -- it just
   * had no Destroy to run, so the clock kept the -2 and every frame after was
   * one low forever.
   *
   * AND THE PHASE WORKS OUT WITHOUT MOVING ANYTHING. clearTurn is called from
   * the director's endStep, which runs AFTER turnClock's End-Step decrement
   * (kaizo/scenes/kaizo-practice.js says so where the decrement lives), and
   * clearTurn destroys with `destroy(e, state)` precisely so cleanUps fire.
   * Its own comment already names the precedent: the boxsplitter's CleanUp
   * writing -1 is why _tok3 f1472 reads -1. This manager is the second.
   *
   * THE COUNT TEST IS A CONSTANT, not a count. `scr_bulletparent_count()`
   * counts instances whose object_index is EXACTLY obj_bulletparent, and
   * nothing in the knight fight ever creates a bare one -- so it is always 0
   * and the guard always passes. sim/attacks/swordfall.js documents this at
   * length for the identical line, including that translating it as "live
   * bullets < 2" once deadlocked the rotating slash at 999999 forever. Written
   * as the constant it is, deliberately.
   *
   * THE HOOK IS `destroyEvent`, NOT `cleanUp`, and the engine draws the
   * distinction on purpose: it runs Destroy_0 then CleanUp_0, and only a
   * room/game end skips Destroy (sim/entity.js, which measured the difference
   * on the Crescent turn's end). This event is obj_knight_weird_bottom_manager's
   * DESTROY_0. Its CleanUp_0 is `ds_list_destroy(circle_list)` and nothing
   * else -- a no-op here, since circle_list is a plain array.
   */
  destroyEvent(e, state) {
    if (e.turn_type === 'start' || e.turn_type === 'short start'
        || e.turn_type === 'short mid') return;
    const knight = knightEntity(state);
    if (knight) knight.image_alpha = 1;
    state.turntimer = -1;
  },

  step(e, state) {
    tickDelayed(state, e);
    // `obj_knight_enemy.siner2 = 0` — he does not bob while he is away, and
    // the anchor is re-read EVERY frame so the return lands wherever he ends
    // up. NOTE this is the knight ENTITY, not `state.knight`, which is the
    // battle-data record (hp, damagereduction) and has no x/y at all.
    const knight = knightEntity(state);
    if (knight) {
      knight.siner2 = 0;
      e.anchor_x = knight.x;
      e.anchor_y = knight.y;
    }
    e.local_turntimer -= 1;
    e.timer += 1;
    e.angle += e.spin;
    e.center_x = boxCentreX(state);
    e.center_y = boxBottom(state) + 43;

    // KAIZO — Step_0 lines 9-12: `with (obj_heart) mask_index =
    // spr_dodgeheart_smaller_2px_mask` — re-stamped EVERY step while the
    // manager lives, so it wins over anything that resets the mask earlier
    // in the frame, and it is UNCONDITIONAL (every kaizo ac of this attack
    // shrinks the soul). Same swap idiom as sword-tunnel's finale
    // (state.soul.mask = HEART_SMALL_MASK) and practice.js's moveheart
    // handoff (state.soul.mask = HEART_RECT).
    if (state.soul) state.soul.mask = KAIZO_SMALLER_HEART_MASK;
    // KAIZO — Step_0 lines 13-20: per-ac centre drops, applied AFTER the
    // per-frame recompute so they track a moving box. Integer ids; 102.1
    // deliberately fails both (gmlEq(102.1, 101) and gmlEq(102.1, 102) are
    // both false), keeping the vanilla centre for the seeded variant.
    if (gmlEq(state.currentAc, 101)) {
      e.center_y += 92;
    }
    if (gmlEq(state.currentAc, 102)) {
      e.center_y += 32;
    }

    // The `local_turntimer < 112 && next_up == 4` block here hands off to
    // obj_knight_swordfall mid-turn. `next_up` is -999 unless the combination
    // attack set it, so it never runs standalone — not translated (byte-
    // identical in the kaizo dump; the mod's ac-102 swordfall pairing goes
    // through a SECOND controller in Other_23, not through next_up).

    // THE ELLIPSE. The vertical term is a QUARTER of the horizontal, which is
    // the whole look: they circle UNDER the arena rather than around it.
    for (const c of e.circle_list) {
      if (!c || !c.alive) continue;
      c.x = e.center_x + lengthdirX(c.distance, c.angle + e.angle);
      c.y = e.center_y + lengthdirY(c.distance * 0.25, c.angle + e.angle);
      tickDelayed(state, c);
    }

    // His own warp streak, drifting right at hspeed 4.
    if (state.frame % 4 === 0 && e.image_alpha !== 0) {
      const fade = scrAfterimage(state, e);
      // `fade.depth = creatorid.depth + 1` — creatorid is the Knight, copied
      // down by the controller's scr_bullet_inherit.
      fade.depth = (knight?.depth ?? 0) + 1;
      fade.image_alpha = 0.6;
      fade.fadeSpeed = 0.04;
      fade.speed = 4;
      fade.direction = 0;
    }
  },

};

function growtangle(state) {
  return state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
}

/** The Knight INSTANCE. `state.knight` is his battle record, not his body. */
function knightEntity(state) {
  return state.entities.find((x) => x.alive && x.type.name === 'obj_knight_enemy');
}

/** scr_get_box(4) — obj_growtangle.x. */
function boxCentreX(state) {
  const gt = growtangle(state);
  return gt ? gt.x : state.view.x + 320;
}

/**
 * scr_get_box(3) — `obj_growtangle.y + (obj_growtangle.sprite_height * 0.5)`,
 * the BOTTOM edge (gml_GlobalScript_scr_get_box.gml case 3).
 *
 * `sprite_height` IS A BUILT-IN, so it narrows to f32 — the product of the
 * sprite's own height and the f32 `image_yscale`, rounded to single precision
 * before anything else touches it (CLAUDE.md, "Float32 built-ins"). Computing
 * it in f64 is not a rounding nicety here: it moves `center_y` by 4.8e-7, and
 * one of the five orbs sits close enough to an f32 boundary that the extra
 * bits flip its stored `y` by a whole ULP.
 *
 * MEASURED, not reasoned. atk_Frenzy2B (ac 102, board 3.25 x 3 -> quantised
 * yscale 2.9866666793823242) in kaizo_oracle_seq_deep.csv:
 *
 *     mod  359.8911132812 373.1024169922 386.9073181152 408.2836303711 416.8155212402
 *     f32  359.8911132812 373.1024169922 386.9073181152 408.2836303711 416.8155212402
 *     f64  359.8911437988 373.1024169922 386.9073181152 408.2836303711 416.8155212402
 *                    ^^^^ one f32 ULP at 360 = 2^-15 = 3.0517578125e-05
 *
 * Five for five against one for five: the recording SELECTS the narrowing.
 * f32(75 * 2.9866666793823242) is exactly 224, so the f32 model also puts the
 * centre on a whole pixel (389) where the f64 one lands on 389.00000047683716.
 * Every vanilla board this attack runs on has an INTEGER yscale (the type-106
 * launch forces 2 x 2), where 75 * n is exact and the two models are the same
 * value — so this is a kaizo-only exposure, not a change to vanilla behaviour.
 */
function boxBottom(state) {
  const gt = growtangle(state);
  if (!gt) return state.view.y + 245;
  return gt.y + Math.fround(75 * (gt.image_yscale ?? 2)) * 0.5;
}

/**
 * The `type = 106` branch of obj_dbulletcontroller, launch side: warp the
 * Knight out, force the arena back to 2 x 2, and hand the turn to the manager.
 * Same signature as the sim module's, plus opts:
 *
 *   opts.dcDamage — the mod's `dc.damage` for this row (87 for the ac-3 solo
 *   row, 103 for ac 4/101/102 — obj_knight_enemy Other_23), copied onto the
 *   manager exactly where `scr_bullet_inherit(knight_weird)` does it
 *   (obj_dbulletcontroller Step_0 line 2242, before event_user(0)). TERMINAL
 *   — see the header's damage-plumbing note — but translated so the value
 *   flow matches the GML end to end.
 */
export function launchUnderbox(state, x, y, opts = {}) {
  const knight = knightEntity(state);
  if (knight) {
    const w = spawn(state, knightWarp, { x: knight.x, y: knight.y });
    w.master = knight;
    knightWarpOut(state, w);
    knight.image_alpha = 0;
  }
  // `obj_growtangle.image_xscale = 2; image_yscale = 2;` (type-106 block,
  // Step_0:2236-2237) -- written by the controller, a NEWER instance than the
  // box, so the box's own Step runs after it that frame and, while the box is
  // still growing or closing, re-derives the scale from its timer: the write
  // is dead then. MEASURED, _tok3 f2069: the recording's box reads 1.6 (still
  // growing) where the write, landing after this lane's box step, held a 2
  // for one row. A box that is not growing keeps the 2, as the game's does.
  const gt = growtangle(state);
  if (gt) {
    const growing = (gt.timer < gt.maxtimer && gt.growcon === 1) || (gt.timer > 0 && gt.growcon === 3);
    if (!growing) {
      gt.image_xscale = 2;
      gt.image_yscale = 2;
    }
  }
  const mg = spawn(state, weirdBottomManager, {
    x: x ?? knight?.x ?? 0,
    y: y ?? knight?.y ?? 0,
  });
  // scr_bullet_inherit(knight_weird) — the dc.damage 87/103 flow.
  if (opts.dcDamage !== undefined) mg.damage = opts.dcDamage;
  weirdBottomManager.init(mg, state);
  return mg;
}
