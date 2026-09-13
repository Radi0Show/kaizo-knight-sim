// KAIZO — THE POST-FIGHT ENDINGS. `obj_ch3_PTB02`'s con 8 routing fork and
// the two cutscenes it forks into: the A-Side knighting (with the mod's
// 1-in-100 RALSEI FAKEOUT) and the B-SIDE EPILOGUE, in which the Knight,
// having "lost", cuts the whole party down and the story never resumes.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — DO NOT PUBLISH
// WITHOUT PERMISSION (kaizo/HANDOFF.md §5-C). Everything below describes
// another author's creative work, read out of a private research dump.
//
// LEDGER ITEMS: G-15 [5] (the B-Side epilogue, ~595 lines, "the largest single
// missing thing on this route") and G-17 [4] (the Ralsei fakeout) of
// `knight-research/kaizo-mod/COMPLETE-DIFF-LEDGER.md`.
//
// ═══ WHY kaizo/scenes/ AND NOT kaizo/party/ ════════════════════════════════
//
// `kaizo/party/scenes.js` is the worked example for the SHAPE of this file —
// a frame-counted state machine on real `scr_delay_var` alarms and real
// `obj_lerpvar` tweens — but not for its ADDRESS. Everything under
// `kaizo/party/` is party-layer state that the FIGHT reads: the roster, the
// damage pipeline, freeze, gloom, the tension bar, and the four scenes that
// hijack a turn *inside* the battle. This is none of that. It is
// `obj_ch3_PTB02`, the ROOM's cutscene object, and it runs after
// `obj_battlecontroller` has been destroyed — the battle is over and there is
// no party turn left to hijack. `kaizo/scenes/` is where the fight-level
// scene modules live (`kaizo-fight.js` builds the scene, `kaizo-practice.js`
// runs the turn loop), so the scene that FOLLOWS the fight belongs beside
// them.
//
// ═══ PROVENANCE ════════════════════════════════════════════════════════════
//
// Every branch below is translated from these kaizo dump files
// (D:\ShadowCrystal\knight-research\kaizo-mod\gml_kaizo_dump\CodeEntries\),
// line numbers that dump's. The comparison tree is `gml_vanilla_v105`.
//
//   gml_Object_obj_ch3_PTB02_Step_0.gml   607-619    the con-8 ROUTING FORK
//                                         943-1180   con 50   (A-Side)
//                                         1084-1136  G-17 the Ralsei fakeout
//                                         1181-1246  con 50.1 (B-Side setup)
//                                         1247-1775  con 50.2 (the epilogue)
//                                         1974-1991  the big_shake handler
//                                         1992-2172  susie_knight_slash
//                                         1839-1843  the swoon_target handler
//                                         2487-2510  G-17's end-of-Step half
//   gml_Object_obj_ch3_PTB02_Create_0.gml 10         `ralsei_fakeout = false`
//                                         59-65      the clash's fields
//                                         304-314    `ouchie_display`
//                                         280-287    `swoon_display`
//                                         289-300    `show_clash_overlay`
//   gml_Object_obj_ch3_PTB02_Alarm_0.gml             `con++`, the whole file
//   gml_Object_obj_knight_enemy_Step_0.gml 1324-1333 flag[50] = 0, flag[51] = 1
//   gml_Object_obj_knight_enemy_Other_13.gml 76-79   flag[50] recomputed to 1
//   gml_GlobalScript_kaizo_settings_init.gml 22-25   `kaizo_funchance`
//   gml_GlobalScript_scr_var_delay.gml               scr_var_delay ==
//                                                    scr_delay_var, both
//                                                    scr_script_delayed(scr_var)
//   gml_GlobalScript_scr_dark_marker.gml             obj_marker at xscale 2
//   gml_GlobalScript_scr_doom.gml                    the timed instance_destroy
//   gml_GlobalScript_scr_lerpvar.gml                 the obj_lerpvar arm
//
// ═══ THE FORK, WHICH IS THE WHOLE POINT ════════════════════════════════════
//
//   gml_Object_obj_ch3_PTB02_Step_0.gml:607-619
//
//       var defeated = global.flag[50] == 1;
//       con = defeated ? 49 : 9;
//       alarm[0] = 30;
//       if (con == 49 && global.flag[456]) con = 49.1;
//
// `Alarm_0` is a bare `con++` (the entire file), so thirty frames later
// 49 -> 50 and 49.1 -> 50.1. Vanilla has no 49.1 and no 50.1/50.2 at all;
// vanilla's `con 50` ends by setting `con = 10` and rejoining the story.
// **`con 50.2` never does.** It parks at `sb_con = 99` under `board_ocean.ogg`
// and that is the end of the Weird Route's Kaizo fight — there is no return
// to the room, no beam scene, no bird. `endingTerminal()` reports exactly
// that, and check-sideb-ending asserts the A-Side's `con = 10` against it so
// the difference cannot be lost.
//
// ═══ WHAT IS MODELLED, AND HONESTLY WHAT IS NOT ════════════════════════════
//
// The work item's own instruction: "If the whole epilogue is more than one
// lane can land well, LAND THE SPINE AND SAY SO." This is the spine plus most
// of the flesh, with the remaining approximations ENUMERATED on
// `state.kaizo.ending.approx` — the same ledger discipline
// `kaizo/scenes/kaizo-mod-launcher.js` uses for unimplemented difficulty
// branches, and `endingApprox()` is how a check or a HUD reads it.
//
// MODELLED, mechanically:
//   * the con-8 fork, the flag[50]/[51] handoff that feeds it, and `Alarm_0`;
//   * con 50.1's beat script, as a beat list with real frame waits (the
//     `c_*` calls ARE a declarative cutscene script — obj_cutscene_master
//     walks them — so a beat list is the faithful shape, not a shortcut);
//   * con 50.2's `sb_con`/`sb_timer` machine, EVERY beat, in order, with the
//     exact timer values and the exact state transitions;
//   * the shared `susie_knight_slash` clash handler and its shrinking-interval
//     shake sequence, including the B-Side's TRUNCATION of it at sb_timer 124
//     (which is what stops the A-Side's parry/shard tail from ever running);
//   * `big_shake`, `swoon_target`, `ouchie_display` and `show_clash_overlay`
//     as real side effects with real records;
//   * every `scr_delay_var` / `scr_var_delay` as a REAL alarm on a real
//     entity, and every `scr_lerpvar` as a REAL `obj_lerpvar` (sim/lerpvar.js)
//     on a real actor entity, so the frame each value lands on is the
//     engine's answer and not this file's;
//   * the actors' hspeed/vspeed/gravity/friction, because `sb_con 4`'s gate is
//     `kr_actor.x <= camerax() - 8` and that is decided by Kris's drift;
//   * EVERY RNG DRAW, counted, in GML argument order — see the budget below;
//   * G-17 in full: the `kaizo_funchance(100)` roll (which draws on BOTH
//     arms), both beat lists, the `ralsei_fakeout` 1 -> 2 handler, and the
//     mid-line destruction of the dialoguer/writer/face at timer 21.
//
// DRAWING — no longer "not modelled". `kaizo/render/draw/ending.js`
// (`drawKaizoEpilogue`) paints this scene: the actors and markers as real
// instances, the whiteall and clash overlays as the real full-screen
// obj_markers they are in the GML, the afterimages off the emitter's records,
// the ouchie/SWOON writers as obj_dmgwriter, and the shakes as draw-time
// jitter. This module still must not IMPORT from kaizo/render/**; the
// dependency runs the other way.
//
// NOT MODELLED, listed rather than buried (ledgered in `ENDING_APPROX`):
//   * `scr_shakeobj_ext` / `scr_minishakeobj` / the knight Step's `shakeamt`
//     as instances. The knight's is `random_range(-shakeamt, shakeamt)` in an
//     object Step this scene does not run, and spending those draws would move
//     every roll after it with no recording to check against. Drawn as a
//     frame-seeded jitter instead, labelled at the site.
//   * the DISTINCTION between `obj_afterimage` and `obj_afterimage_grow` at
//     the one place it could matter: `with (obj_afterimage) instance_destroy()`
//     (sb_con 2 t 38, sb_con 3 t 65) does NOT reach the grow copies, and the
//     records here honour that — but a grow copy fades out in ten frames
//     (alpha 1, fade 0.1), so no clear in this scene ever falls inside one.
//   * `obj_writer` / `obj_face` / `obj_dialoguer` as instances. The MESSAGES
//     are carried on `sc.msgs` (they are content, and G-17 is three of them),
//     and `d_ex()` — which `sb_con 3` genuinely BLOCKS on at sb_timer 1 — is
//     modelled as a boolean the driver owns (`sc.dialogueOpen`), defaulting
//     to closed so the machine advances in a headless check.
//   * the camera as a real `obj_camera`. `camerax()` is `sc.camX`, driven by
//     the pan beats and by `camerax_set(sb_camX)`, which IS mechanical here
//     (the -160 kick) and IS modelled.
//   * `whiteall` / `toriel_gacha` / `piece_marker` / `sword_shiny` as
//     instances; their assignments are recorded on `sc.marks`.
//
// ═══ RNG BUDGET — COUNTED, IN GML ORDER ════════════════════════════════════
//
// Draws on `state.gmlRng` (sim/rng.js: `random`/`random_range`/`choose` = 1
// u32, `irandom`/`irandom_range` = 2). CLAUDE.md: call arguments evaluate
// RIGHT-TO-LEFT, which matters at exactly one site here —
// `ouchie_display(su_actor, irandom_range(7000, 9000))` draws BEFORE
// `su_actor` is read — and since `su_actor` is not itself random the order is
// recorded rather than load-bearing. The sites, in stream order:
//
//   THE B-SIDE EPILOGUE (a whole run, `kaizo_funni` off):
//     clash shake pulses   1 each — `random_range(-60, 20)` for the Knight's
//                          first afterimage direction (Step_0:2079). The
//                          sequence pulses at `susie_knight_shake_timer`
//                          1, 71, 121, 151, 161 (the interval in force at
//                          each is 80, 70, 60, 50, 40) and the B-Side CUTS
//                          IT at sb_timer 124, so only the first TWO ever
//                          fire. **2 draws.**
//
//                          THE LAST TWO USED TO READ 171, 221 — prev plus
//                          the new interval, which is not what the GML asks.
//                          The gate is `(susie_knight_shake_timer %
//                          susie_knight_shake_time) == 1` with the time
//                          SHRINKING on each fire, so the next pulse is the
//                          next timer satisfying the new modulus, not an
//                          addition: after 121 the time becomes 50 and 151
//                          is the next value with `% 50 == 1`. Simulating
//                          the loop gives 1, 71, 121, 151, 161. The budget
//                          is unchanged — every entry past the first two is
//                          beyond the cut either way — which is exactly why
//                          no check caught it.
//     sb_con 2, t 41       `irandom_range(7000, 9000)` — Susie's ouchie.  2
//     sb_con 3, t 65       `irandom_range(45000, 57500)` — Ralsei's ouchie. 2
//     sb_con 3, t 65       `kaizo_funchance(20)` = `irandom_range(1, 20)`,
//                          the 1-in-20 `spr_ralsei_swoon` easter egg. It is
//                          drawn UNCONDITIONALLY — `global.kaizo_funni` is the
//                          RIGHT operand of the `||` — so the budget does not
//                          change with the Funni setting.              2
//     TOTAL: 8.
//
//   G-17, the A-Side fakeout:
//     `kaizo_funchance(100)` = `irandom_range(1, 100)`.                 2
//     Drawn on BOTH arms, again because the roll is the left operand.
//     TOTAL: 2, whichever way it lands.
//
// `scr_doom`, `scr_dark_marker`, `show_clash_overlay`, `scr_shakescreen`,
// `snd_play_x` with an explicit pitch, `scr_lerpvar` and `scr_var_delay` draw
// NOTHING — verified by reading each script in the dump, not assumed.
//
// ═══ THE LOCKSTEP, WHICH IS THE ONE UNVERIFIED TIMING CLAIM ════════════════
//
// `c_var_instance(id, "susie_knight_slash", true)` and
// `c_var_instance(id, "sb_con", 1)` are CONSECUTIVE ops at the tail of the
// 50.1 script (Step_0:1243-1244), so both land on the same frame; the
// `con == 50.2` block (:1247) does `sb_timer++` and the
// `if (susie_knight_slash)` block (:1992) does `susie_knight_slash_timer++`
// in the SAME Step event. So the two timers run in lockstep, and the shake
// pulse at slash_timer 130 falls OUTSIDE the sb_timer-124 cut while the ones
// at 10 and 80 fall inside. That is what makes the draw budget 2 and not 3.
// It is derived from the GML, not measured — **THERE IS NO RECORDING OF THIS
// ROUTE** (both whole-fight recordings are A-Side, three characters; the only
// B-Side ground truth on disk is two 2,400-frame locks, neither of which is
// the epilogue). `clashDraws()` reports the count so the check stands over
// the derivation rather than restating it.
//
// ═══ THE SPRITE `spr_ralsei_swoon` FINALLY HAS A CONSUMER ══════════════════
//
// It is packed (77x47, one of EnderCat8's own eleven), and until this file it
// had ZERO code hits anywhere in the recreation — art with no consumer, which
// is the repo's signature defect wearing an asset's clothes. Its one site in
// the whole mod is Step_0:1640-1643, the 1-in-20 inside `sb_con 3`'s
// sb_timer-65 block. `ralseiSwoonSprite()` is how a renderer asks which
// sprite Ralsei is actually wearing, and check-sideb-ending forces BOTH arms.
//
// ═══ OWNERSHIP ═════════════════════════════════════════════════════════════
//
// This file writes ONLY `state.kaizo.ending` (its own tree),
// `state.kaizo.flag` (the two PTB02 reads — 50, 51, 456) and the entities it
// spawns (`endingActor`, `endingMarker`, `endingDelay`, and `obj_lerpvar`
// through sim/lerpvar.js). It reads `state.kaizo.sideb`, `state.knight.endcon`
// and `state.knight.endtimer`. It touches NOTHING in sim/, render/, input/,
// assets/, tools/, web/, kaizo/attacks/ or kaizo/party/scenes.js.

import { spawn, destroy } from '../../sim/entity.js';
import { gmlIrandomRange, gmlRandomRange } from '../../sim/rng.js';
import { kaizoFunchance } from '../party/freeze.js';
import { lengthdirX, lengthdirY } from '../../sim/gml.js';
import { cue, cueLoop } from '../../sim/audio.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { scrShakescreen } from '../../sim/shake.js';

// ───────────────────────────────────────────────────────────────────────────
// Constants, all cited
// ───────────────────────────────────────────────────────────────────────────

/**
 * EVERY SPRITE THESE TWO CUTSCENES NAME, AND WHY IT IS A TABLE.
 *
 * `kaizo/tools/checks/check-sprites.mjs` scans kaizo/attacks, kaizo/scenes and
 * kaizo/party for SINGLE-QUOTED `'spr_*'` literals and asserts every one
 * resolves in the vanilla pack or the kaizo overlay — because a missing sprite
 * is invisible at runtime (the renderer falls back to drawing collision
 * masks).
 *
 * THIS TABLE WAS WRITTEN IN BACKTICKS, AND THAT MADE AN ENFORCED GATE LIE
 * (fixed 2026-09-12). Eighteen of the names below resolved in NEITHER pack —
 * the overlay's WANT list (`kaizo/tools/pack-kaizo-sprites.mjs`) was built for
 * the FIGHT and these are overworld cutscene art nothing had ever asked for —
 * and `check-sprites` stayed green only because its regex is
 * /'(spr_[a-z0-9_]+)'/g and a backtick is not a quote. A gate that passes
 * because of a quoting style is not a gate.
 *
 * BOTH HALVES ARE CLOSED NOW. All eighteen are in the packer's WANT list and in
 * the overlay (sixteen vanilla-sourced, two the mod's own repaint of the
 * Knight's overworld set — `kaizo/tools/checks/check-ending-sprite-pack.mjs`
 * asserts that provenance split by name, in both directions, which is what
 * keeps the publish gate honest), and this table is back to plain
 * single-quoted literals, so the enforced scanner sees all 36 again.
 *
 * KEEP THEM SINGLE-QUOTED. A backtick here silently removes a name from an
 * enforced gate.
 *
 * NOTHING HERE IS DRAWN. This module records `sprite` on its actors and
 * markers; painting belongs to render/.
 */
export const SPR = Object.freeze({
  fxHitback: 'spr_fx_hitback',
  knightCrescentslash: 'spr_knight_crescentslash',
  krisdDark: 'spr_krisd_dark',
  krislDark: 'spr_krisl_dark',
  krisrDark: 'spr_krisr_dark',
  pixelWhite: 'spr_pixel_white',
  ralseiDefeat: 'spr_ralsei_defeat',
  ralseiDownSurprised2: 'spr_ralsei_down_surprised2',
  ralseiShockedRight: 'spr_ralsei_shocked_right',
  ralseiShockedStandingRight: 'spr_ralsei_shocked_standing_right',
  ralseiSurprisedLeftWalk: 'spr_ralsei_surprised_left_walk',
  ralseiSurprisedRightWalk: 'spr_ralsei_surprised_right_walk',
  ralseiSwoon: 'spr_ralsei_swoon',
  ralseiWalkDownUnhappy: 'spr_ralsei_walk_down_unhappy',
  ralseiWalkLeftUnhappy: 'spr_ralsei_walk_left_unhappy',
  ralseiWalkRightSad: 'spr_ralsei_walk_right_sad',
  ralseiWalkRightUnhappy: 'spr_ralsei_walk_right_unhappy',
  ralseiWalkUpSad: 'spr_ralsei_walk_up_sad',
  rkQuickslash: 'spr_rk_quickslash',
  roaringKnightClashPullBack: 'spr_roaring_knight_clash_pull_back',
  roaringKnightSusieClash: 'spr_roaring_knight_susie_clash',
  roaringknightAttackOverworld: 'spr_roaringknight_attack_overworld',
  roaringknightFaceawayTurning: 'spr_roaringknight_faceaway_turning',
  roaringknightFlurryPrepare: 'spr_roaringknight_flurry_prepare',
  roaringknightIdle: 'spr_roaringknight_idle',
  roaringknightSwordBreakPieceSmall: 'spr_roaringknight_sword_break_piece_small',
  shineWhite: 'spr_shine_white',
  susieClashJump: 'spr_susie_clash_jump',
  susieDwFell: 'spr_susie_dw_fell',
  susieDwJumpBallFixed: 'spr_susie_dw_jump_ball_fixed',
  susieHurt: 'spr_susie_hurt',
  susierDarkUnhappy: 'spr_susier_dark_unhappy',
  susieWalkDownDwUnhappy: 'spr_susie_walk_down_dw_unhappy',
  susieWalkLeftDwUnhappy: 'spr_susie_walk_left_dw_unhappy',
  susieWalkRightDwUnhappy: 'spr_susie_walk_right_dw_unhappy',
  susiebIdleSerious: 'spr_susieb_idle_serious',
});

/** Every sprite these two cutscenes name, flat. */
export const ENDING_SPRITES = Object.freeze(Object.values(SPR));


/** `con = defeated ? 49 : 9` — Step_0:614. The A-Side victory route. */
export const CON_VICTORY = 49;
/** `if (con == 49 && global.flag[456]) con = 49.1;` — Step_0:616-619. */
export const CON_VICTORY_SIDEB = 49.1;
/** `con = defeated ? 49 : 9` — the loss route, unchanged from vanilla. */
export const CON_LOSS = 9;
/** `alarm[0] = 30` at Step_0:615, and `Alarm_0` is `con++`. */
export const CON_ALARM_FRAMES = 30;

/**
 * The Weird Route flag. `global.flag[456]` is the game's own Chapter-3
 * Snowgrave flag — the mod never writes it (whole-dump grep finds no writer
 * in either tree), so it arrives in the save. `k_sideb` reads it at
 * `gml_Object_obj_knight_enemy_Create_0.gml:115` and PTB02 reads it again
 * here. In the sim that is `state.kaizo.sideb` (kaizo/scenes/kaizo-fight.js
 * stamps it from `version === 'D'`).
 */
export const FLAG_WEIRD_ROUTE = 456;
/** `global.flag[50]` — what happened to the KNIGHT. 1 == violenced. */
export const FLAG_KNIGHT_OUTCOME = 50;
/** `global.flag[51]` — the teardown's "a kill happened" latch. */
export const FLAG_KNIGHT_VIOLENCED = 51;

/**
 * `camerax()` at the moment the epilogue opens. sim/victory-scene.js's own
 * `CAM_X`, which is the same room and the same beat — repeated as a NUMBER
 * rather than imported, because sim/ must not learn about kaizo/ and this
 * module must not depend on a driver-side scene it does not own.
 */
export const CAM_X = 2230;

/** `c_pan(2400, 0, 30)` — Step_0:1220. Susie's advance. */
export const CLASH_CAM_X = 2400;

/** `scr_lerpvar("sb_camX", camerax(), camerax() - 160, 20, 2, "inout")`. */
export const CAM_KICK = -160;
/** ...and `scr_var_delay("sb_cam", 0, 21)` one frame after it lands. */
export const CAM_KICK_FRAMES = 20;
export const CAM_KICK_RELEASE = 21;

/** `if (sb_timer >= 124)` — Step_0:1254. THE CUT. */
export const SB_CLASH_BREAK = 124;

/** `susie_knight_shake_time = 80` — Create_0:64, and it steps down by 10. */
export const CLASH_SHAKE_TIME = 80;
export const CLASH_SHAKE_STEP = 10;
/** `if (susie_knight_shake_time <= 30) susie_knight_shake_sequence = false;` */
export const CLASH_SHAKE_FLOOR = 30;

/** `_susie_finish_time = 300` — Step_0:2092. A-SIDE ONLY; see the header. */
export const CLASH_FINISH_TIME = 300;
/** `_jump_back_time = _susie_finish_time + 20` — Step_0:2093. */
export const CLASH_JUMP_BACK_TIME = 320;

/** `ouchie_display(su_actor, irandom_range(7000, 9000))` — Step_0:1417. */
export const OUCHIE_SUSIE = [7000, 9000];
/** `ouchie_display(ra_actor, irandom_range(45000, 57500))` — Step_0:1609. */
export const OUCHIE_RALSEI = [45000, 57500];

/** `kaizo_funchance(20)` — Step_0:1640. The swoon easter egg. */
export const SWOON_CHANCE = 20;
/** `if (kaizo_funchance(100))` — Step_0:1084. G-17's gate. */
export const FAKEOUT_CHANCE = 100;

/** Step_0:1641-1643. Zero code hits anywhere else in the recreation. */
export const SWOON_SPRITE = SPR.ralseiSwoon;
/** Step_0:1637. What he wears when the roll does NOT come up. */
export const DEFEAT_SPRITE = SPR.ralseiDefeat;

/** `sprite_index = spr_roaringknight_faceaway_turning` at `image_xscale = -2`
 *  — Step_0:1687-1690. The Knight reappearing BEHIND Kris. */
export const FACEAWAY_SPRITE = SPR.roaringknightFaceawayTurning;

/** `spr_rk_quickslash` at `image_angle = 36` — Step_0:1358-1362. */
export const SLASH_SPRITE = SPR.rkQuickslash;
/** `sb_slash.x/y += lengthdir(40, 216)` — Step_0:1363-1364. */
export const SLASH_OFFSET = [40, 216];
/** `scr_lerpvar("x", x, x + lengthdir_x(150, 216), 2)` and 140 on y —
 *  Step_0:1404-1405. Susie's launch, and the two lengths DIFFER. */
export const SUSIE_LAUNCH = [150, 140, 216];

/** `snd_volume(global.currentsong[1], 0.7, 240)` — Step_0:1764. */
export const BOARD_OCEAN = 'board_ocean.ogg';
export const BOARD_OCEAN_VOL = 0.7;
export const BOARD_OCEAN_FADE = 240;
/** `sb_con = 99` at sb_timer 555 — Step_0:1758. The terminal state. */
export const SB_TERMINAL = 99;
export const SB_TERMINAL_AT = 555;

/**
 * `if (con == 50 && ...) { ... con = 10; }` — the VANILLA tail, which the
 * A-Side keeps and the B-Side does not have. Asserted against
 * `endingTerminal()` so "the story resumes" and "the story does not" can
 * never collapse into the same observation.
 */
export const ASIDE_RESUMES_AT_CON = 10;

/**
 * `susie_knight_slash_timer == 1` fires `show_clash_overlay()` with its
 * DEFAULTS — `arg0 = 8, arg1 = 1` (Create_0:289). Every other call site
 * passes `(8, 0.5)`.
 */
export const CLASH_OVERLAY_DEFAULT = [8, 1];
export const CLASH_OVERLAY_HALF = [8, 0.5];

/**
 * The `roaring_knight_warp` settle. Step_0:1215-1216 is
 * `c_wait(30); c_wait_if(id, "roaring_knight_warp", "=", false);` — the warp's
 * own machine (Step_0:1776+) decides when it clears. Its duration is INHERITED
 * from sim/victory-scene.js's measurement of the same block ("the warp settles
 * at its own 95"), not re-derived here, and it is ledgered as such.
 */
export const WARP_SETTLE = 95;

/**
 * INVENTED (CLAUDE.md law 4, labelled at every site it reaches): how long a
 * dialogue box stays open. The real lifetime is the writer's typing speed, the
 * text length, the mod's automash and the player's mashing — none of which
 * this lane models. It matters because `sb_con 3`'s first branch genuinely
 * STALLS on `d_ex()` (Step_0:1478-1482). A driver that owns a real writer sets
 * `dialogueAuto = false` and drives `dialogueOpen` itself.
 */
export const ENDING_DIALOGUE_FRAMES = 90;

/**
 * THE APPROXIMATION LEDGER. Same discipline as
 * `kaizo/scenes/kaizo-mod-launcher.js`'s `state.kaizo.approx`: what is stood
 * in for, what it is stood in for BY, and the GML that says so. The ledger IS
 * the work queue; `endingApprox()` prints it and check-sideb-ending asserts it
 * is non-empty and that every row names a real dump file.
 */
export const ENDING_APPROX = [
  {
    what: 'the con-50.1 cutscene-master script',
    stand_in: 'a beat list with frame waits; obj_cutscene_master is not an instance here',
    gml: 'gml_Object_obj_ch3_PTB02_Step_0.gml:1181-1246',
  },
  {
    what: 'roaring_knight_warp settle duration',
    stand_in: `${WARP_SETTLE} frames, inherited from sim/victory-scene.js, not re-derived`,
    gml: 'gml_Object_obj_ch3_PTB02_Step_0.gml:1215-1216',
  },
  {
    // WAS: "recorded on sc.marks / sc.lerps; nothing is painted" — true until
    // kaizo/render/draw/ending.js landed (2026-09-12). What is left is
    // narrower and is named exactly, because the wide version of this row is
    // what let the gap sit unnoticed.
    what: 'scr_shakeobj_ext / scr_minishakeobj as instances, and the knight Step\'s shake RNG',
    stand_in: 'draw-time jitter, a pure function of state.frame; the real one is '
      + 'random_range(-shakeamt, shakeamt) in the knight\'s own Step, which this '
      + 'scene does not run and whose draws the RNG budget does not count',
    gml: 'gml_Object_obj_ch3_PTB02_roaringknight_Step_0.gml (shakeamt/shaketimer)',
  },
  {
    what: 'obj_afterimage / obj_afterimage_grow as instances',
    stand_in: 'bounded records on the emitting actor (endingAfterimages), with '
      + 'obj_afterimage\'s own fadeSpeed ramp and drift; nothing reads their positions',
    gml: 'gml_Object_obj_ch3_PTB02_Step_0.gml:2078-2087',
  },
  {
    what: 'obj_writer / obj_face / obj_dialoguer as instances',
    stand_in: 'sc.msgs carries the strings; d_ex() is sc.dialogueOpen',
    gml: 'gml_Object_obj_ch3_PTB02_Step_0.gml:1476-1489',
  },
  {
    // THE ONE INVENTED NUMBER IN THIS FILE (CLAUDE.md law 4), and it is
    // labelled here, at its constant, and in msg()'s doc comment.
    what: 'INVENTED: how long a dialogue box stays open (dialogueFrames)',
    stand_in: `${ENDING_DIALOGUE_FRAMES} frames; the real one is the writer's typing speed, `
      + 'the text length, automash and the player. Set dialogueAuto = false to own it.',
    gml: 'gml_Object_obj_ch3_PTB02_Step_0.gml:1478-1482 (the d_ex() stall it feeds)',
  },
  {
    what: 'the clash-shake lockstep with sb_timer',
    stand_in: 'derived from the GML; NO RECORDING of this route exists',
    gml: 'gml_Object_obj_ch3_PTB02_Step_0.gml:1243-1254, 1992-2090',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// State
// ───────────────────────────────────────────────────────────────────────────

/**
 * `obj_ch3_PTB02`'s three actor slots, at the positions con 50.1 sets them
 * (Step_0:1193-1199). Kris is not re-placed by 50.1 — only `c_facing("r")` —
 * so he keeps the value sim/victory-scene.js measured for the same beat.
 */
const ACTOR_START = {
  // `dsprite` / `rsprite` / `lsprite` are `obj_caterpillarchar`'s own
  // direction slots, which the epilogue swaps between by NAME
  // (`sprite_index = dsprite` at :1481, `rsprite` at :1544, `lsprite` at
  // :1653). Kris is the only actor any of those three sites touches, so
  // Susie's and Ralsei's are the walking sets they are already wearing.
  kr: {
    x: 2356, y: 104, sprite: SPR.krisrDark,
    d: SPR.krisdDark, r: SPR.krisrDark, l: SPR.krislDark,
  },
  su: {
    x: 2310, y: 142, sprite: SPR.susieWalkRightDwUnhappy,
    d: SPR.susieWalkDownDwUnhappy,
    r: SPR.susieWalkRightDwUnhappy,
    l: SPR.susieWalkLeftDwUnhappy,
  },
  ra: {
    x: 2288, y: 190, sprite: SPR.ralseiWalkRightUnhappy,
    d: SPR.ralseiWalkDownUnhappy,
    r: SPR.ralseiWalkRightUnhappy,
    l: SPR.ralseiWalkLeftUnhappy,
  },
};

/**
 * An actor. A REAL entity, not a plain object, for one reason that is not
 * taste: `scr_lerpvar` needs an `i_ex`-able target (sim/lerpvar.js destroys a
 * tween whose target is gone) and `scr_var_delay` needs a live instance to
 * write into. Motion is `componentMotion` — the engine moves it by
 * hspeed/vspeed in sim/index.js's motion phase — with friction and gravity
 * applied here at the END of the step, which is the order GameMaker uses
 * (friction on the speed magnitude, then gravity into the components, then
 * the move). `kr_actor.x <= camerax() - 8` is decided by this and by nothing
 * else, so the motion is mechanical rather than decorative.
 */
export const endingActor = {
  name: 'kaizo_ending_actor',
  create(e) {
    e.visible = true;
    e.componentMotion = true;
    e.who ??= '?';
    e.sprite ??= SPR.krisrDark;
    e.dsprite ??= SPR.krisdDark;
    e.rsprite ??= SPR.krisrDark;
    e.lsprite ??= SPR.krislDark;
    e.depth ??= 0;
    // obj_ch3_PTB02_roaringknight's own Create: `aetimer = 0`,
    // `after_image_dir = 1`, `after_image_rate = 2`, `move_speed = 4`,
    // `after_active = true`. Only the Knight is given them by
    // spawnEndingKnight; the party actors keep `after_active` falsy and
    // therefore never emit.
    e.aetimer ??= 0;
    e.after_image_dir ??= 1;
    e.afterimages ??= [];
  },
  step(e) {
    // GameMaker applies friction to the SPEED MAGNITUDE, which for a
    // component-driven actor means shrinking both components toward zero
    // along their own vector.
    if (e.friction) {
      const sp = Math.sqrt(e.hspeed * e.hspeed + e.vspeed * e.vspeed);
      if (sp > 0) {
        const next = Math.max(0, sp - e.friction);
        const k = next / sp;
        e.hspeed *= k;
        e.vspeed *= k;
      }
    }
    // ...then gravity into the components. `gravity_direction` defaults to
    // 270 (down) and no site here changes it.
    if (e.gravity) {
      e.hspeed += lengthdirX(e.gravity, e.gravity_direction);
      e.vspeed += lengthdirY(e.gravity, e.gravity_direction);
    }
    stepAfterimages(e);
  },
};

/**
 * `obj_afterimage` — Create is `fadeSpeed = 0.04` and Step is
 * `image_alpha -= fadeSpeed; if (image_alpha < 0) instance_destroy();`, with
 * GameMaker's own hspeed/direction motion on top. Two sites create them in
 * this scene and both are translated:
 *
 *   * the KNIGHT'S TRAIL — obj_ch3_PTB02_roaringknight's Step:
 *     `if ((aetimer % move_speed) == 0 && image_alpha != 0 && state == 0
 *      && after_active)` creates one at `depth + 1` with `image_alpha = 0.6`,
 *     `fadeSpeed = 0.02` and `hspeed = after_image_rate * after_image_dir`.
 *     The epilogue drives all four of those fields (`after_active` off at
 *     con 50.1, on again at sb_con 2 t 10, `after_image_rate` 1 -> 2,
 *     `move_speed` 1 -> 2 -> 8 -> 12, `after_image_dir` -> -1 at sb_con 3
 *     t 65) and until this existed they were written and read by nobody.
 *   * the CLASH PULSE — `scr_afterimage()` three times (Step_0:2078-2087),
 *     at the instance's own depth, default fadeSpeed, with speed/direction.
 *
 * THEY ARE RECORDS ON THE EMITTER, not entities, and that is a deliberate
 * bounded deviation: a real instance would need its own Step in the engine's
 * order and would put 30+ entities on screen at the clash, and nothing here
 * reads an afterimage's position (no collision, no gate). The alpha ramp, the
 * drift and the destruction are the GML's.
 *
 * `0.6 * other.image_alpha` in the trail's line is transcribed as
 * `0.6 * image_alpha`: `other` at object scope is a decompiler artefact of
 * the same instance, and the Knight's alpha is 1 for every frame of the trail
 * except the sb_con-4 fade-in, where the two readings agree to within the
 * lerp's own frame.
 */
function stepAfterimages(e) {
  const list = e.afterimages;
  if (list && list.length) {
    for (const g of list) {
      g.image_alpha -= g.fadeSpeed;
      g.x += g.hspeed + lengthdirX(g.speed, g.direction);
      g.y += g.vspeed + lengthdirY(g.speed, g.direction);
      // obj_afterimage_grow's Step adds `image_xscale += xrate;
      // image_yscale += yrate;` (both 0.2) to the same alpha ramp.
      if (g.xrate) { g.image_xscale += g.xrate; g.image_yscale += g.yrate; }
      g.age += 1;
    }
    // `if (image_alpha < 0) instance_destroy()` — strictly less than.
    for (let i = list.length - 1; i >= 0; i--) if (list[i].image_alpha < 0) list.splice(i, 1);
  }
  if (!e.after_active) return;
  e.aetimer = (e.aetimer ?? 0) + 1;
  const rate = e.move_speed ?? 4;
  if (rate <= 0) return;
  if ((e.aetimer % rate) !== 0) return;
  if (e.image_alpha === 0) return;
  if ((e.knightState ?? 0) !== 0) return;
  pushAfterimage(e, {
    fadeSpeed: 0.02,
    image_alpha: 0.6 * (e.image_alpha ?? 1),
    hspeed: (e.after_image_rate ?? 2) * (e.after_image_dir ?? 1),
    depth: (e.depth ?? 0) + 1,
  });
}

/** `scr_afterimage()`'s field copy, shared by both sites. */
function pushAfterimage(e, over = {}) {
  const list = (e.afterimages ??= []);
  list.push({
    object: 'obj_afterimage',
    xrate: 0,
    yrate: 0,
    x: e.x,
    y: e.y,
    sprite: e.sprite,
    image_index: e.image_index ?? 0,
    image_xscale: e.image_xscale ?? 1,
    image_yscale: e.image_yscale ?? 1,
    image_angle: e.image_angle ?? 0,
    image_alpha: e.image_alpha ?? 1,
    depth: e.depth ?? 0,
    fadeSpeed: 0.04,
    hspeed: 0,
    vspeed: 0,
    speed: 0,
    direction: 0,
    age: 0,
    ...over,
  });
  // A trail at move_speed 1 emits every frame and fades over 30 (0.6/0.02),
  // so the live set is ~30. The cap is a guard against a caller that never
  // clears, not a modelled limit; it is above anything the scene produces.
  if (list.length > 64) list.splice(0, list.length - 64);
  return list[list.length - 1];
}

/**
 * `with (obj_afterimage) { instance_destroy(); }` — Step_0:1372 (sb_con 2
 * t 38) and :1604 (sb_con 3 t 65). It clears EVERY afterimage in the room,
 * which is why it lives here and not on one actor.
 */
export function clearEndingAfterimages(state) {
  let n = 0;
  for (const a of Object.values(ensureEnding(state).actors)) {
    if (!a || !a.afterimages) continue;
    for (let i = a.afterimages.length - 1; i >= 0; i--) {
      // `with (obj_afterimage)` — obj_afterimage_grow is a DIFFERENT object
      // and this `with` never reaches one. See the header.
      if (a.afterimages[i].object !== 'obj_afterimage') continue;
      a.afterimages.splice(i, 1);
      n += 1;
    }
  }
  return n;
}

/** Every live afterimage in the scene, for the drawer and for a check. */
export function endingAfterimages(state) {
  const out = [];
  for (const a of Object.values(ensureEnding(state).actors)) {
    if (a?.afterimages) out.push(...a.afterimages);
  }
  return out;
}

/**
 * `scr_dark_marker(x, y, sprite)` — `instance_create` + `image_speed = 0` and
 * `image_xscale/yscale = 2` (gml_GlobalScript_scr_dark_marker.gml, four
 * lines, NO RNG). Every flourish in the epilogue is one of these. Kept as a
 * real entity so `scr_lerpvar` and `scr_doom` can point at it.
 */
export const endingMarker = {
  name: 'obj_marker',
  create(e) {
    // scr_dark_marker assigns all three UNCONDITIONALLY, and so does this.
    //
    // `??=` DOES NOT WORK HERE and the attempt is worth recording: sim/entity.js
    // merges INSTANCE_DEFAULTS *before* `vars`, so `image_xscale` is already 1
    // by the time create runs and `??=` never fires — a defaulting idiom that
    // reads correct and is inert. What the GML actually does is assign here and
    // then let the CALLER overwrite on the next line
    // (`_shine.image_speed = 0.1`, `whiteall.image_xscale = 999`), so `mark()`
    // applies its `extra` AFTER this runs. That ordering is the fix; it is not
    // decoration, because the shine's 0.1 and the overlays' 999 were both being
    // silently reset to scr_dark_marker's defaults.
    e.image_speed = 0;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.componentMotion = true;
    e.sprite ??= null;
  },
};

/**
 * `scr_doom(target, n)` — `obj_doom` with `alarm[0] = n` and `target`, whose
 * Alarm 0 destroys the target. A REAL alarm, per CLAUDE.md rule 5: "alarms
 * are not step counters".
 */
export const endingDoom = {
  name: 'obj_doom',
  create(e) { e.visible = false; e.target ??= null; },
  alarm: {
    0(e) {
      if (e.target && e.target.alive) destroy(e.target);
      destroy(e);
    },
  },
};

/**
 * `scr_var_delay(name, value, n)` / `scr_delay_var(name, value, n)` — the SAME
 * function twice over (gml_GlobalScript_scr_var_delay.gml declares both as
 * `scr_script_delayed(scr_var, arg2, arg0, arg1)`), and the epilogue uses both
 * spellings. `obj_script_delayed`'s Alarm 0 is `event_user(0);
 * instance_destroy();` and the user event does
 * `variable_instance_set(target, name, value)`. Alarms run BEFORE Steps, so
 * arming with n on frame N means frame N + n sees the value exactly.
 */
export const endingDelay = {
  name: 'obj_script_delayed',
  create(e) {
    e.visible = false;
    // `??=`, never `=`: spawn() applies `vars` BEFORE create runs, so a plain
    // assignment would wipe the three fields the caller just passed and the
    // alarm would fire into nothing — the exact "green suite, dead path"
    // failure CLAUDE.md warns about.
    e.dTarget ??= null;
    e.dName ??= null;
    e.dValue ??= 0;
  },
  alarm: {
    0(e) {
      const t = e.dTarget;
      if (t && e.dName && (t.alive === undefined || t.alive)) t[e.dName] = e.dValue;
      destroy(e);
    },
  },
};

/** `scr_var_delay` / `scr_delay_var` against a live target. */
export function scrVarDelay(state, target, name, value, frames) {
  const alarm = new Array(12).fill(-1);
  alarm[0] = frames;
  return spawn(state, endingDelay, {
    alarm, dTarget: target, dName: name, dValue: value,
  });
}

/** `scr_doom(target, frames)`. */
export function scrDoom(state, target, frames) {
  const alarm = new Array(12).fill(-1);
  alarm[0] = frames;
  return spawn(state, endingDoom, { alarm, target });
}

/** Every armed-but-unfired delay, for a check or a debug HUD. */
export function pendingEndingDelays(state) {
  return (state.entities ?? [])
    .filter((e) => e.alive && e.type === endingDelay)
    .map((e) => ({ name: e.dName, value: e.dValue, frames: e.alarm[0] }));
}

/**
 * Stand up `state.kaizo.ending`. Idempotent; safe to call from
 * `buildKaizoScene` on every build.
 */
export function ensureEnding(state) {
  const k = (state.kaizo ??= {});
  // `global.flag[]`, sparsely. Only three indices are ever read here.
  const flag = (k.flag ??= Object.create(null));
  if (flag[FLAG_KNIGHT_OUTCOME] === undefined) flag[FLAG_KNIGHT_OUTCOME] = 0;
  if (flag[FLAG_KNIGHT_VIOLENCED] === undefined) flag[FLAG_KNIGHT_VIOLENCED] = 0;
  // `global.flag[456]` mirrors the route the scene was built for. The mod
  // never writes it; `state.kaizo.sideb` is where this repo keeps it.
  flag[FLAG_WEIRD_ROUTE] = k.sideb ? 1 : 0;
  if (k.ending) {
    // Keep the mirror live if the scene's route was stamped after the first
    // ensure — otherwise a D build that called ensureEnding early would route
    // to the A-Side, silently.
    k.ending.sideb = !!k.sideb;
    return k.ending;
  }

  k.ending = {
    sideb: !!k.sideb,
    // ── obj_ch3_PTB02's own fields ───────────────────────────────────────
    con: 8,
    // Create_0:9. Cleared by the battle teardown at endcon 2.
    teamdefeated: true,
    // Create_0:10. G-17's field, false | 1 | 2.
    ralseiFakeout: false,
    fakeoutTimer: null,          // `variable_instance_exists` — lazily created
    fakeoutRolled: null,         // what kaizo_funchance(100) returned
    // Create_0:59-65, the clash's fields.
    susieKnightSlash: false,
    susieKnightSlashTimer: 0,
    susieKnightShakeTimer: 0,
    susieKnightShakeTime: CLASH_SHAKE_TIME,
    susieKnightShakeSequence: false,
    bigShake: false,
    swoonTarget: null,
    // con 50.1 creates these five; they are NOT in Create.
    sbCon: null,
    sbTimer: null,
    sbCam: 0,
    sbCamX: 0,
    sbSlash: null,
    // Create_0:31-36's full-screen marker. Lazily created (endingWhiteall) so
    // a FIGHT build's ensureEnding never spawns an entity.
    whiteall: null,
    // ── the camera ───────────────────────────────────────────────────────
    camX: CAM_X,
    camLerp: null,
    // `scr_var_delay("sb_cam", 0, 21)` — the kick's release countdown.
    camRelease: null,
    // ── the beat interpreter ─────────────────────────────────────────────
    script: null,
    scriptIndex: 0,
    wait: 0,
    waitFor: null,
    dialogueOpen: false,         // `d_ex()`
    dialogueAuto: true,          // false hands `dialogueOpen` to the driver
    dialogueFrames: ENDING_DIALOGUE_FRAMES,
    dialogueClose: null,
    // ── actors ───────────────────────────────────────────────────────────
    actors: Object.create(null),
    // ── recorded, never drawn ────────────────────────────────────────────
    marks: [],
    lerps: [],
    msgs: [],
    ouchies: [],
    swoons: [],
    shakes: [],
    music: [],
    // ── the audit trail the check reads ──────────────────────────────────
    log: [],
    clashPulses: 0,
    draws: { clash: 0, epilogue: 0, fakeout: 0 },
    approx: ENDING_APPROX.map((r) => ({ ...r })),
    // ── the terminal fact ────────────────────────────────────────────────
    terminal: false,
    resumedAtCon: null,
  };
  return k.ending;
}

/** Total RNG this module has spent, split by site class. */
export function endingDraws(state) {
  return { ...ensureEnding(state).draws };
}

/** The approximation ledger. */
export function endingApprox(state) {
  return ensureEnding(state).approx.map((r) => ({ ...r }));
}

/** Every sprite the two cutscenes name. */
export function endingSprites() {
  return ENDING_SPRITES.slice();
}

/**
 * THE FACT THE WHOLE LANE IS ABOUT: `con 50.2` parks at `sb_con = 99` and
 * never assigns `con = 10`. True once the epilogue has reached its terminal
 * state; `resumedAtCon` stays null forever on this route, and is 10 on the
 * A-Side.
 */
export function endingTerminal(state) {
  const e = ensureEnding(state);
  return { terminal: e.terminal, resumedAtCon: e.resumedAtCon };
}

function draw(state, who, n = 1) {
  ensureEnding(state).draws[who] += n;
}

function logAt(state, what, from, to) {
  ensureEnding(state).log.push({ frame: state.frame, what, from, to });
}

/**
 * `k_msgsetloc(0, ...)` + `d_make()` / `c_msgsetloc` + `c_talk_wait`.
 *
 * The strings are CONTENT (G-17 is three of them and the epilogue five more),
 * so they are carried; `obj_writer` / `obj_face` / `obj_dialoguer` are not
 * instances here. What IS mechanical is `d_ex()` — `sb_con 3`'s first branch
 * pins `sb_timer` at 0 while a box is open (Step_0:1478-1482), which is a real
 * stall and not a wait — so a box has to be able to be OPEN and then CLOSED.
 *
 * `dialogueFrames` is how long it stays open, and it is **INVENTED** (law 4):
 * the real lifetime is the writer's typing speed, the text length, the mod's
 * automash and the player's mashing, none of which this lane models. A driver
 * that owns a real writer should set `dialogueAuto = false` and drive
 * `dialogueOpen` itself; the check does exactly that to prove the stall.
 */
function msg(state, speaker, text) {
  const e = ensureEnding(state);
  e.msgs.push({ frame: state.frame, speaker, text });
  e.dialogueOpen = true;
  e.dialogueClose = e.dialogueAuto ? state.frame + e.dialogueFrames : null;
}

/** The invented auto-close. Runs first in the driver, before anything reads
 *  `d_ex()`, so a box that expired this frame is gone by the time the machine
 *  looks — which is the order a real `obj_dialoguer` destroy would have. */
function stepDialogue(state) {
  const e = ensureEnding(state);
  if (!e.dialogueOpen || e.dialogueClose === null) return false;
  if (state.frame < e.dialogueClose) return false;
  e.dialogueOpen = false;
  e.dialogueClose = null;
  return true;
}

/**
 * `scr_shakeobj_ext(target, shakexamt, shakeyamt, shakereduct, shakespeed)`
 * and `scr_minishakeobj()` (which is `shakeamt 4, shakereduct 1` on `id`).
 * Both create an obj_shakeobj that jogs ONE INSTANCE, not the camera — the
 * camera shake is `scr_shakescreen`/obj_shake and is already sim/shake.js's.
 *
 * RECORDED, NOT SIMULATED, and the reason is the RNG: obj_shakeobj's own
 * offsets come from the object's Step, which this scene does not run, and the
 * knight's `shakeamt` branch draws `random_range` twice a tick. Spending those
 * would move every roll after them, and there is no recording of this route to
 * check the result against (ENDING_APPROX). The drawer turns each record into
 * a decaying frame-seeded jitter on that actor.
 */
function objShake(state, who, xamt, yamt = xamt, reduct = 1, speed = 1) {
  ensureEnding(state).shakes.push({
    frame: state.frame, objshake: true, target: who,
    shakexamt: xamt, shakeyamt: yamt, shakereduct: reduct, shakespeed: speed,
  });
}

/** `scr_dark_marker(...)` plus whatever the `with` block does to it. */
function mark(state, x, y, sprite, extra = {}) {
  const sc = ensureEnding(state);
  const m = spawn(state, endingMarker, { x, y, sprite });
  // AFTER create, because that is where the GML puts it — see endingMarker.
  Object.assign(m, extra);
  sc.marks.push({
    frame: state.frame, sprite, x, y, ...extra,
  });
  return m;
}

/**
 * `scr_lerpvar(name, a, b, maxtime[, easetype, easeinout])` on a live actor.
 * ALWAYS recorded (a lerp is the only evidence of a move with no other side
 * effect) and ALWAYS run as a real obj_lerpvar, so the frame each value lands
 * on is sim/lerpvar.js's answer.
 */
function lerpOn(state, target, name, a, b, maxtime, easetype, easeinout) {
  const sc = ensureEnding(state);
  sc.lerps.push({
    frame: state.frame, who: target?.who ?? target?.type?.name ?? '?',
    name, from: a, to: b, frames: maxtime, easetype, easeinout,
  });
  if (target && target.alive) {
    scrLerpvar(state, spawn, target, name, a, b, maxtime, easetype, easeinout);
  }
}

/**
 * `show_clash_overlay(arg0 = 8, arg1 = 1)` — Create_0:289-301. A white
 * full-screen marker lerped 0 -> arg1 over arg0 and back down again, doomed
 * at `arg0 + arg0 + 2`. NO RNG (read, not assumed). Recorded only; painting
 * it belongs to render/, which this lane must not touch.
 */
function showClashOverlay(state, peak = 1, frames = 8) {
  const sc = ensureEnding(state);
  sc.marks.push({
    frame: state.frame, sprite: SPR.pixelWhite, overlay: true, peak, frames,
  });
  // Create_0:289-301, every line:
  //   _clash_overlay = scr_dark_marker(-10, -10, spr_pixel_white);
  //   image_xscale/yscale = 999; depth = -110; image_blend = c_white;
  //   image_alpha = 0; visible = 1;
  //   scr_lerp_instance_var(_clash_overlay, "image_alpha", 0, arg1, arg0, 2, "out");
  //   scr_script_delayed(scr_lerp_instance_var, arg0 + 2, _clash_overlay,
  //                      "image_alpha", arg1, 0, arg0, 2, "out");
  //   scr_doom(_clash_overlay, arg0 + arg0 + 2);
  // A REAL instance, not a record: the two lerps and the doom are what give
  // the flash its shape, and sim/lerpvar.js + endingDoom already run them.
  const ov = spawn(state, endingMarker, { x: -10, y: -10, sprite: SPR.pixelWhite });
  Object.assign(ov, {
    image_xscale: OVERLAY_SCALE, image_yscale: OVERLAY_SCALE,
    depth: OVERLAY_DEPTH, image_alpha: 0, image_blend: C_WHITE, visible: true,
    overlay: true,
  });
  lerpOn(state, ov, 'image_alpha', 0, peak, frames, 2, 'out');
  // The DOWN ramp is armed by a delayed script, not by a second lerp now —
  // the delay is what makes the flash hold at `peak` for two frames.
  scrVarDelay(state, ov, 'clashOverlayFall', 1, frames + 2);
  ov.clashOverlayFall = 0;
  ov.clashOverlayPeak = peak;
  ov.clashOverlayFrames = frames;
  scrDoom(state, ov, frames + frames + 2);
  return ov;
}

/** `image_xscale = image_yscale = 999` on a 4x4 spr_pixel_white — 3996px from
 *  (-10, -10), which covers the room at every camera this scene uses. */
export const OVERLAY_SCALE = 999;
/** `depth = -110` — over the actors, under the slash marker's -120. */
export const OVERLAY_DEPTH = -110;

/**
 * `whiteall` — obj_ch3_PTB02's Create_0:31-36 full-screen marker, the object
 * every "the screen goes white/black" beat in this scene drives:
 *
 *     whiteall = scr_dark_marker(-10, -10, spr_pixel_white);
 *     whiteall.image_xscale = 999; whiteall.image_yscale = 999;
 *     whiteall.depth = -110; whiteall.image_blend = c_white;
 *     whiteall.visible = 0;
 *
 * It is ONE instance for the whole cutscene and its `image_blend` is STICKY —
 * which is the fact this scene turns on. sb_con 2's t 23 sets it to `c_black`
 * (Step_0:1347-1351) and NOTHING in con 50.2 ever sets it back, so every later
 * `visible = 1` (t 47, and sb_con 4's t 220) fills the screen BLACK. The final
 * fill this epilogue ends under is black, not white.
 *
 * Lazily created so `ensureEnding` — which `buildKaizoScene` calls on every
 * FIGHT build — never puts an entity in a fight state.
 */
export function endingWhiteall(state, create = false) {
  const sc = ensureEnding(state);
  if (sc.whiteall?.alive) return sc.whiteall;
  if (!create) return null;
  sc.whiteall = spawn(state, endingMarker, { x: -10, y: -10, sprite: SPR.pixelWhite });
  Object.assign(sc.whiteall, {
    image_xscale: OVERLAY_SCALE, image_yscale: OVERLAY_SCALE,
    depth: OVERLAY_DEPTH, image_alpha: 1, image_blend: C_WHITE,
    visible: false, whiteall: true,
  });
  return sc.whiteall;
}

/**
 * Every `with (whiteall) { ... }` in the scene, at one door, so the live
 * instance and the `marks` record can never disagree. `blend` is only ever
 * passed where the GML assigns it (t 23's `c_black`); omitting it KEEPS the
 * sticky value, which is the whole point.
 */
function setWhiteall(state, patch) {
  const sc = ensureEnding(state);
  const w = endingWhiteall(state, true);
  if ('blend' in patch) w.image_blend = patch.blend === 'c_black' ? C_BLACK : C_WHITE;
  if ('alpha' in patch) w.image_alpha = patch.alpha;
  if ('visible' in patch) w.visible = patch.visible;
  sc.marks.push({
    frame: state.frame,
    whiteall: patch.blend ?? null,
    ...(('alpha' in patch) ? { alpha: patch.alpha } : {}),
    visible: w.visible,
  });
  return w;
}

/** `c_white` / `c_black`, as rgb triples (GameMaker packs BGR; both are
 *  palindromes, so the two readings agree here and nowhere else). */
export const C_WHITE = Object.freeze([255, 255, 255]);
export const C_BLACK = Object.freeze([0, 0, 0]);

// ───────────────────────────────────────────────────────────────────────────
// THE FLAGS — what feeds the fork
// ───────────────────────────────────────────────────────────────────────────

/**
 * The battle teardown's flag writes, at the exact site that produces them:
 * `if (endcon == 1 && endtimer > 45)` — `gml_Object_obj_knight_enemy_
 * Step_0.gml:1324-1333`, the same test sim/knight.js's `stepEndCutscene`
 * uses to set `endcon = 2`.
 *
 *     global.flag[50] = 0;
 *     global.flag[51] = 1;
 *     with (obj_ch3_PTB02) { teamdefeated = false; ... }
 *
 * Then `obj_knight_enemy`'s Other_13 (the battle-end event) tallies it:
 * `if (_violenced > 0) global.flag[50] = 1;` (Other_13:76-79). Both halves
 * are here because the fork reads the RESULT and a translation that wrote
 * only the first half would route every Weird Route win to `con = 9`.
 *
 * Idempotent — `flag[51]` is the latch.
 */
export function markKnightDefeated(state) {
  const e = ensureEnding(state);
  const flag = state.kaizo.flag;
  if (flag[FLAG_KNIGHT_VIOLENCED] === 1) return false;
  flag[FLAG_KNIGHT_OUTCOME] = 0;
  flag[FLAG_KNIGHT_VIOLENCED] = 1;
  e.teamdefeated = false;
  // Other_13: `_violenced > 0` is the kill we just latched.
  flag[FLAG_KNIGHT_OUTCOME] = 1;
  logAt(state, 'flag50', 0, 1);
  return true;
}

/**
 * The producer, wired where the GML puts it: the frame `endcon` becomes 2.
 * `kaizo/scenes/kaizo-practice.js` calls this immediately after
 * `stepEndCutscene`, which is where sim/knight.js makes that transition.
 * Returns true on the frame it fired.
 */
export function endingWatchEndcon(state) {
  const k = state.knight;
  if (!k) return false;
  if (k.endcon !== 2) return false;
  return markKnightDefeated(state);
}

// ───────────────────────────────────────────────────────────────────────────
// THE FORK — Step_0:607-619
// ───────────────────────────────────────────────────────────────────────────

/**
 * `obj_ch3_PTB02`'s con 8, verbatim:
 *
 *     var defeated = global.flag[50] == 1;
 *     con = defeated ? 49 : 9;
 *     alarm[0] = 30;
 *     if (con == 49 && global.flag[456]) con = 49.1;
 *     var battle_result = defeated ? 1 : 2;
 *
 * Note the SECOND test is on `con`, not on `defeated` — so a loss on a Weird
 * Route file still goes to `con = 9`, because 9 is not 49. Transcribed that
 * way rather than folded into one condition.
 *
 * Vanilla (`gml_vanilla_v105`) has lines 1-2 and 5 and NOT lines 3-4: the
 * whole 49.1 route is EnderCat8's.
 */
export function ptb02Con8(state) {
  const e = ensureEnding(state);
  const flag = state.kaizo.flag;
  const defeated = flag[FLAG_KNIGHT_OUTCOME] === 1;
  let con = defeated ? CON_VICTORY : CON_LOSS;
  if (con === CON_VICTORY && flag[FLAG_WEIRD_ROUTE]) con = CON_VICTORY_SIDEB;
  const battleResult = defeated ? 1 : 2;
  const from = e.con;
  e.con = con;
  logAt(state, 'con', from, con);
  // `if (defeated) { whiteall.visible = 1; with (obj_fadeout) instance_destroy(); }`
  // — Step_0:626-632. THE WHITE THE EPILOGUE OPENS UNDER: con 50.1 then fades
  // it out over 30 (the `whiteFade` beat). obj_fadeout is not an instance here.
  if (defeated) setWhiteall(state, { visible: true });
  return {
    con,
    defeated,
    battleResult,
    route: !defeated ? 'loss' : (con === CON_VICTORY_SIDEB ? 'bside' : 'aside'),
  };
}

/**
 * THE WHOLE DIVERGENCE, IN TWO LINES, and it is the FIRST line of each block:
 *
 *   `if (con == 50  && !i_ex(obj_battlecontroller)) { con = 10;   ... }`   :945
 *   `if (con == 50.1 && !i_ex(obj_battlecontroller)) { con = 50.2; ... }`  :1186
 *
 * `con = 10` hands the room back to the story — the beam scene, Undyne, the
 * bird, the rest of the chapter. `con = 50.2` hands it to a 595-line machine
 * that never gives it back. Both heads then stage the same three actors at the
 * same three positions, which is what makes the one-line difference the whole
 * difference.
 *
 * Call after `ptb02Alarm0`. Returns which route was entered; a driver then
 * steps `stepKaizoEnding` (or spawns `kaizoEndingDriver`) every frame. On the
 * A-Side the con-50 body is `sim/victory-scene.js`'s script and NOT this
 * lane's; what IS this lane's is G-17, which `rollRalseiFakeout` supplies at
 * the point that script reaches Step_0:1084.
 */
export function enterEnding(state) {
  const e = ensureEnding(state);
  spawnEndingActors(state);
  spawnEndingKnight(state);
  if (e.con === CON_VICTORY_SIDEB + 1) {          // 50.1
    const from = e.con;
    e.con = 50.2;
    logAt(state, 'con', from, 50.2);
    startEndingScript(state, SB_SETUP_SCRIPT);
    return 'bside';
  }
  if (e.con === CON_VICTORY + 1) {                // 50
    const from = e.con;
    e.con = ASIDE_RESUMES_AT_CON;
    e.resumedAtCon = ASIDE_RESUMES_AT_CON;
    logAt(state, 'con', from, ASIDE_RESUMES_AT_CON);
    return 'aside';
  }
  return 'none';
}

/** `Alarm_0` is `con++`. The entire file. 49 -> 50, 49.1 -> 50.1. */
export function ptb02Alarm0(state) {
  const e = ensureEnding(state);
  const from = e.con;
  e.con = from + 1;
  logAt(state, 'con', from, e.con);
  return e.con;
}

// ───────────────────────────────────────────────────────────────────────────
// kaizo_funchance — gml_GlobalScript_kaizo_settings_init.gml:22-25
// ───────────────────────────────────────────────────────────────────────────

/**
 * `kaizo_funchance(n)` — gml_GlobalScript_kaizo_settings_init.gml:22-25:
 *
 *     return irandom_range(1, arg0) <= 1 || global.kaizo_funni;
 *
 * TWO u32 (irandom_range), ALWAYS — the roll is the LEFT operand of the `||`,
 * so GameMaker's short-circuit cannot skip it and the Funni setting does not
 * move the stream. That is the difference between a draw budget that holds for
 * every player and one that silently forks on a settings file.
 *
 * **THE IMPLEMENTATION IS `kaizo/party/freeze.js`'s**, imported rather than
 * re-translated. It already carries this script (its Kris down-message uses
 * the same 1-in-100), and two copies of one GML function is how a stream
 * budget starts disagreeing with itself. This wrapper adds only the draw
 * accounting, which is the part that belongs to this scene.
 *
 * `who` names the budget bucket so a check can attribute the spend.
 */
export function endingFunchance(state, n, who = 'epilogue') {
  ensureEnding(state);
  const hit = kaizoFunchance(state, n);
  draw(state, who, 2);
  return { hit, funni: !!(state.kaizo?.funni), cost: 2, n };
}

// ───────────────────────────────────────────────────────────────────────────
// THE ACTORS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Stand up kr / su / ra as real entities at con 50.1's positions
 * (Step_0:1189-1199). Kris gets `c_facing("r")` only — no `c_setxy` — so he
 * keeps the position the con-50 staging left him at.
 */
export function spawnEndingActors(state) {
  const e = ensureEnding(state);
  for (const who of ['kr', 'su', 'ra']) {
    if (e.actors[who]?.alive) continue;
    const s = ACTOR_START[who];
    const a = spawn(state, endingActor, {
      x: s.x, y: s.y, who, sprite: s.sprite, depth: 0,
      dsprite: s.d, rsprite: s.r, lsprite: s.l,
    });
    e.actors[who] = a;
  }
  return e.actors;
}

function actorOf(state, who) {
  return ensureEnding(state).actors[who] ?? null;
}

/**
 * The Knight as an actor too. `roaring_knight` is a real instance in PTB02's
 * scope and the epilogue lerps his x/y/image_index constantly, so he needs the
 * same treatment as the party.
 */
export function spawnEndingKnight(state) {
  const e = ensureEnding(state);
  if (e.actors.knight?.alive) return e.actors.knight;
  const k = spawn(state, endingActor, {
    x: 2655, y: 78, who: 'knight', sprite: SPR.roaringknightIdle, depth: 0,
  });
  k.after_active = true;
  k.after_image_rate = 1;
  k.move_speed = 1;
  k.shakeamt = 0;
  k.knightState = 0;
  e.actors.knight = k;
  return k;
}

// ───────────────────────────────────────────────────────────────────────────
// THE SHARED HANDLERS — Step_0:1839-1843, 1974-1991, 1992-2172
// ───────────────────────────────────────────────────────────────────────────

/**
 * `if (swoon_target != -4) { swoon_display(swoon_target); swoon_target = -4; }`
 * — Step_0:1839-1843. `swoon_display` (Create_0:280-287) is an obj_dmgwriter
 * of `type = 12` at `(x + 20, y + 30)` — the SWOON word, not a number. NO RNG.
 */
export function stepSwoonTarget(state) {
  const e = ensureEnding(state);
  if (!e.swoonTarget) return false;
  const t = e.swoonTarget;
  e.swoons.push({
    frame: state.frame, who: t.who ?? '?', x: t.x + 20, y: t.y + 30, type: 12,
  });
  e.swoonTarget = null;
  return true;
}

/**
 * `ouchie_display(target, amount)` — Create_0:304-314. An obj_dmgwriter with
 * `damage = arg1, type = 0, lightb = 255` at `(x + 20, y + 30)`. The `dmgnum`
 * local it opens with is DEAD — assigned and never read — and is transcribed
 * as a comment rather than as a field, because a value written where nothing
 * reads it is this repo's signature defect and reproducing one on purpose is
 * how it gets normalised.
 */
function ouchieDisplay(state, target, amount) {
  ensureEnding(state).ouchies.push({
    frame: state.frame, who: target?.who ?? '?',
    x: (target?.x ?? 0) + 20, y: (target?.y ?? 0) + 30,
    damage: amount, type: 0, lightb: 255,
  });
}

/**
 * `if (big_shake)` — Step_0:1974-1991. Seven sounds and an `obj_shake` at
 * `shakex 10, shakespeed 2, shakesign 2` — UNGUARDED (no `if (!i_ex(obj_shake))`),
 * so it stacks. Horizontal only, decaying, stepping every two frames: the
 * shape sim/victory-scene.js measured for the same object.
 */
export function stepBigShake(state) {
  const e = ensureEnding(state);
  if (!e.bigShake) return false;
  e.bigShake = false;
  cue(state, 'snd_impact');
  cue(state, 'snd_closet_impact', 1, 1);
  cue(state, 'snd_closet_impact', 0.5, 1);
  cue(state, 'snd_bageldefeat', 0.8, 0.8);
  cue(state, 'snd_damage');
  cue(state, 'snd_glassbreak', 0.4, 0.8);
  cue(state, 'snd_glassbreak', 0.3, 0.6);
  e.shakes.push({ frame: state.frame, shakex: 10, shakespeed: 2, shakesign: 2 });
  scrShakescreen(state, { shakex: 10, shakespeed: 2 });
  return true;
}

/**
 * `if (susie_knight_slash)` — Step_0:1992-2172. THE CLASH, and it is SHARED:
 * the A-Side fires it at Step_0:994 and the B-Side at :1243. What differs is
 * only that the B-Side KILLS IT at sb_timer 124 (Step_0:1262-1263), which is
 * before `_susie_finish_time = 300` and therefore before the parry, the
 * jump-back, the sword shard and the shine. On the A-Side all of that runs.
 *
 * THE ONE RNG SITE IN THE WHOLE HANDLER is inside the shake pulse:
 * `afterimage.direction = random_range(-60, 20)` (Step_0:2079) — ONE draw,
 * and the two `afterimageb` below it copy `afterimage.speed` into `direction`,
 * which is almost certainly a typo for `.direction` but draws nothing either
 * way. **NOT FIXED** (CLAUDE.md law 4); recorded as `afterimageSpeedTypo`.
 */
export function stepSusieKnightSlash(state) {
  const e = ensureEnding(state);
  if (!e.susieKnightSlash) return false;
  const su = actorOf(state, 'su');
  const kn = actorOf(state, 'knight');
  e.susieKnightSlashTimer += 1;
  const t = e.susieKnightSlashTimer;

  if (t === 1) {
    cue(state, 'snd_jump');
    if (su) {
      su.depth = 6000;
      lerpOn(state, su, 'hspeed', 0, 20, 5);
      su.vspeed = -14;
      su.gravity = 2;
      su.sprite = SPR.susieClashJump;
      su.image_index = 1;
      su.friction = 0;
    }
    showClashOverlay(state, CLASH_OVERLAY_DEFAULT[1], CLASH_OVERLAY_DEFAULT[0]);
  }
  if (t === 10) {
    e.susieKnightShakeSequence = true;
    scrShakescreen(state);
    cue(state, 'snd_laz_c', 0.7, 1);
    cue(state, 'snd_heavyswing');
    cue(state, 'snd_closet_impact', 0.9, 1);
    cue(state, 'snd_impact', 0.7, 1);
    if (su) {
      su.friction = 0; su.vspeed = 0; su.gravity = 0; su.hspeed = 0;
      su.visible = false;
      if (kn) { su.x = kn.x - 30; su.y = kn.y - 40; }
    }
    if (kn) {
      kn.sprite = SPR.roaringKnightSusieClash;
      kn.image_speed = 0.4;
      kn.knightState = 0;
      kn.shakeamt = 2;
      objShake(state, 'knight', 24, 10, 3, 2);   // Step_0:2034
    }
  }

  if (e.susieKnightShakeSequence) {
    e.susieKnightShakeTimer += 1;
    if ((e.susieKnightShakeTimer % e.susieKnightShakeTime) === 1) {
      e.susieKnightShakeTime -= CLASH_SHAKE_STEP;
      if (e.susieKnightShakeTime <= CLASH_SHAKE_FLOOR) {
        e.susieKnightShakeSequence = false;
      }
      scrShakescreen(state);
      const kx = (kn?.x ?? 0) - 90;
      const ky = (kn?.y ?? 0) - 90;
      const v1 = mark(state, kx, ky, SPR.fxHitback);
      lerpOn(state, v1, 'image_index', 0, 4, 12);
      scrDoom(state, v1, 16);
      const v2 = mark(state, kx, ky, SPR.fxHitback, { image_alpha: 0.5 });
      lerpOn(state, v2, 'image_index', 0, 4, 24);
      scrDoom(state, v2, 24);
      lerpOn(state, v2, 'image_alpha', 0.5, 0, 24);
      cue(state, 'snd_damage');
      cue(state, 'snd_metal_hit_strong', 0.8, 0.5);
      cue(state, 'snd_closet_impact', 0.9, 1);
      cue(state, 'snd_impact', 0.7, 1);
      showClashOverlay(state, CLASH_OVERLAY_HALF[1], CLASH_OVERLAY_HALF[0]);
      // ── THE ONE DRAW ────────────────────────────────────────────────────
      const rng = state.gmlRng;
      const dir = rng ? gmlRandomRange(rng, -60, 20) : 0;
      draw(state, 'clash', 1);
      e.clashPulses += 1;
      e.marks.push({
        frame: state.frame, afterimage: true, speed: 4, direction: dir,
        // Step_0:2082/2085: `afterimageb.direction = afterimage.speed;` — the
        // SPEED, twice. Preserved; see the doc comment.
        afterimageSpeedTypo: true,
      });
      // ...and the three instances themselves (Step_0:2078-2087), so the
      // ghosts the roll aims actually exist for something to paint. The two
      // `afterimageb`s take `direction = afterimage.speed` = 4 — the preserved
      // typo, transcribed as the number it produces, not as the field it meant.
      if (kn) {
        pushAfterimage(kn, { speed: 4, direction: dir });
        pushAfterimage(kn, { speed: 2, direction: 4 });
        pushAfterimage(kn, { speed: 1, direction: 4 });
        // `with (_clash_vfx) { scr_afterimage_grow(); }` — Step_0:2055-2058,
        // on the FIRST hitback marker only. obj_afterimage_grow: alpha -= 0.1,
        // xscale/yscale += 0.2 a frame. Parked on the Knight's list because
        // that is where this scene ages its ghosts; its pose is the marker's.
        pushAfterimage(kn, {
          object: 'obj_afterimage_grow',
          x: v1.x, y: v1.y, sprite: SPR.fxHitback, image_index: 0,
          image_xscale: 2, image_yscale: 2, image_alpha: 1,
          fadeSpeed: 0.1, xrate: 0.2, yrate: 0.2, depth: v1.depth ?? 0,
        });
        objShake(state, 'knight', 24, 10, 3, 2);
      }
    }
  } else {
    // ── THE A-SIDE TAIL. The B-Side never reaches it. ─────────────────────
    if (t === CLASH_FINISH_TIME) {
      const kx = (kn?.x ?? 0) - 90;
      const ky = (kn?.y ?? 0) - 90;
      const v = mark(state, kx, ky, SPR.fxHitback);
      lerpOn(state, v, 'image_index', 0, 4, 12);
      scrDoom(state, v, 12);
      cue(state, 'snd_damage');
      showClashOverlay(state, CLASH_OVERLAY_HALF[1], CLASH_OVERLAY_HALF[0]);
      if (kn) {
        kn.hspeed = 8; kn.friction = 2; kn.shakeamt = 0;
        kn.image_index = 2; kn.image_speed = 0;
      }
    }
    if (t === CLASH_JUMP_BACK_TIME) {
      cue(state, 'snd_laz_c', 0.9, 1);
      cue(state, 'snd_glassbreak');
      cue(state, 'snd_sparkle_glock');
      if (su) {
        su.visible = true; su.sprite = SPR.susieClashJump;
        su.vspeed = -4; su.gravity = 2; su.hspeed = -14;
        su.image_index = 0; su.image_speed = 0;
      }
      if (kn) {
        kn.sprite = SPR.roaringKnightClashPullBack;
        kn.image_index = 0; kn.image_speed = 0; kn.knightState = 0;
        scrVarDelay(state, kn, 'image_index', 1, 4);
      }
      const piece = mark(state, kn?.x ?? 0, kn?.y ?? 0,
        SPR.roaringknightSwordBreakPieceSmall);
      piece.vspeed = -8; piece.gravity = 2; piece.hspeed = -7;
      lerpOn(state, piece, 'image_angle', 0, 1280, 20);
      scrVarDelay(state, piece, 'gravity', 0, 16);
      scrVarDelay(state, piece, 'hspeed', 0, 16);
      scrVarDelay(state, piece, 'vspeed', 0, 16);
      e.pieceMarker = piece;
    }
    if (t === CLASH_JUMP_BACK_TIME + 10 && su) {
      su.sprite = SPR.susiebIdleSerious;
      su.vspeed = 0; su.gravity = 0; su.friction = 2;
      su.image_index = 0; su.image_speed = 0;
    }
    if (t === CLASH_JUMP_BACK_TIME + 20) {
      e.susieKnightSlash = false;
      const p = e.pieceMarker;
      mark(state, (p?.x ?? 0) - 4, (p?.y ?? 0) - 4, SPR.shineWhite,
        { image_speed: 0.1 });
    }
  }
  return true;
}

/** How many shake pulses the clash actually fired — the anti-vacuity read. */
export function clashDraws(state) {
  const e = ensureEnding(state);
  return { pulses: e.clashPulses, draws: e.draws.clash };
}

// ───────────────────────────────────────────────────────────────────────────
// con 50.1 — the B-Side setup script (Step_0:1181-1246)
// ───────────────────────────────────────────────────────────────────────────

/**
 * The `c_*` beats, in source order. Each is `[op, ...args]`; `w` waits n
 * frames, `wait` blocks on a predicate, `say` records a message and waits for
 * the dialogue to close, and everything else is instantaneous.
 *
 * `c_waitcustom()` / `c_waitcustom_end()` (the customcon handshake) is not
 * modelled — it is the cutscene master telling PTB02 to stop advancing `con`,
 * and there is no `con` advance left on this route.
 */
export const SB_SETUP_SCRIPT = [
  ['init'],                                          // :1183-1187 sb_* = 0
  ['snd', 'stop_all'],                               // :1189
  ['face', 'kr', 'r'],                               // :1191-1192
  ['setxy', 'ra', 2288, 190], ['face', 'ra', 'ralseiunhappy'], ['face', 'ra', 'r'],
  ['setxy', 'su', 2310, 142], ['face', 'su', 'susieunhappy'], ['face', 'su', 'r'],
  ['w', 30],                                         // :1200
  ['whiteFade', 30],                                 // :1201
  ['music', 'wind_highplace.ogg', { pitch: 0.5, from: 0, to: 1, frames: 60 }],
  ['w', 30], ['w', 60],                              // :1206-1207
  ['knightVar', 'after_active', false],              // :1208
  ['knightVar', 'reach_interrupt', true],            // :1209
  ['w', 15],                                         // :1210
  ['music', 'free_all'],                             // :1211
  ['warp'],                                          // :1212-1215
  ['w', 30],
  ['w', WARP_SETTLE],                                // c_wait_if roaring_knight_warp
  ['w', 90],                                         // :1216
  ['say', 'susie', '* We..^1. we actually beat it?/%'],
  ['var', 'unskipWriter', true],                     // :1220
  ['pan', CLASH_CAM_X, 30],                          // :1221-1222
  ['walk', 'su', 2510, 142, 30],                     // :1223-1225
  // `c_var_instance(su_actor, "rsprite", 689)` — Step_0:1229. Numeric again;
  // 689 -> spr_susier_dark_unhappy by the same validated id -> row mapping.
  // It sets `rsprite`, the walk system's RIGHT-facing slot, not sprite_index:
  // she is mid-`c_walkdirect` and the walker picks the pose from the slot.
  ['actorVar', 'su', 'rsprite', SPR.susierDarkUnhappy],
  ['say', 'susie', "\\EJ* Hey^1, you^1!&* The hell's your deal anyways?!/"],
  ['say', 'susie', "\\Ea* Don't you even THINK you're getting away after all THAT!/%"],
  ['w', 12],                                         // :1233
  ['waitX', 'su', 2510],                             // :1234
  ['var', 'susieKnightSlash', true],                 // :1243
  ['var', 'sbCon', 1],                               // :1244
];

// ───────────────────────────────────────────────────────────────────────────
// G-17 — the Ralsei fakeout (Step_0:1084-1136 and 2487-2510)
// ───────────────────────────────────────────────────────────────────────────

/** Step_0:1086-1118, the `kaizo_funchance(100)` arm. Ralsei is UNHURT. */
export const FAKEOUT_SCRIPT = [
  ['setxy', 'ra', 2328, 190],
  ['sprite', 'ra', SPR.ralseiShockedRight],
  ['w', 90],
  ['music', 'resume'],
  ['var', 'whiteall', false],
  ['var', 'whiteSlash', false],
  ['w', 40],
  ['sprite', 'ra', SPR.ralseiSurprisedRightWalk],
  ['say', 'ralsei', '\\EZ* ^2.^2.^2.&* W-Wait./%'],
  ['sprite', 'ra', SPR.ralseiShockedStandingRight],
  ['say', 'ralsei', '\\EL* I\'m..^2. alright...?/%'],
  ['w', 20],
  ['sprite', 'ra', SPR.ralseiShockedStandingRight],
  ['w', 20],
  ['sprite', 'ra', SPR.ralseiSurprisedLeftWalk],
  ['w', 24],
  ['sprite', 'ra', SPR.ralseiDownSurprised2],
  ['w', 15],
  ['say', 'ralsei', '\\EZ* I guess I\'m fine.../%'],
  ['sprite', 'ra', SPR.ralseiWalkLeftUnhappy],
  ['lerpTo', 'ra', 'x', 2280, 25],
  ['var', 'ralseiFakeout', 1],
  ['waitFakeout'],                                   // c_wait_if ralsei_fakeout = 2
  ['sprite', 'ra', SPR.ralseiDefeat],
  ['var', 'bigShake', true],
  ['swoon', 'ra'],
];

/** Step_0:1120-1133, the 99-in-100 arm. He goes down like the A-Side always did. */
export const NO_FAKEOUT_SCRIPT = [
  ['setxy', 'ra', 2328, 190],
  ['sprite', 'ra', SPR.ralseiDefeat],
  ['w', 90],
  ['music', 'resume'],
  ['var', 'bigShake', true],
  ['var', 'whiteall', false],
  ['var', 'whiteSlash', false],
  ['lerpTo', 'ra', 'x', 2280, 30, 2, 'out'],
  ['swoon', 'ra'],
];

/**
 * `if (kaizo_funchance(100))` — Step_0:1084. Rolls ONCE and returns which
 * script the A-Side cutscene should run. **The draw happens on both arms**,
 * so the stream position after the roll does not depend on the outcome.
 */
export function rollRalseiFakeout(state) {
  const e = ensureEnding(state);
  const r = endingFunchance(state, FAKEOUT_CHANCE, 'fakeout');
  e.fakeoutRolled = r;
  logAt(state, 'fakeout', null, r.hit);
  return { ...r, script: r.hit ? FAKEOUT_SCRIPT : NO_FAKEOUT_SCRIPT };
}

/**
 * `if (ralsei_fakeout == 1)` — Step_0:2487-2510, a NEW end-of-Step handler.
 * `fakeout_timer` is created lazily with `variable_instance_exists`, which is
 * why `fakeoutTimer` starts as `null` rather than 0: the distinction is
 * observable (a check can prove the handler, not the constructor, made it).
 *
 *   timer 1   Ralsei speaks "* L-Let's just try to help Susie now"
 *   timer 21  instance_destroy(obj_dialoguer / obj_writer / obj_face) and
 *             `ralsei_fakeout = 2` — the line is cut off MID-DELIVERY, which
 *             is the joke, and only then does he collapse (the blocked
 *             `c_wait_if` in FAKEOUT_SCRIPT releases).
 *
 * NO RNG.
 */
export const FAKEOUT_LINE = "\\Ee* L-Let's just try to help Susie now";
export const FAKEOUT_CUT_AT = 21;

export function stepRalseiFakeout(state) {
  const e = ensureEnding(state);
  if (e.ralseiFakeout !== 1) return false;
  if (e.fakeoutTimer === null) e.fakeoutTimer = 0;
  e.fakeoutTimer += 1;
  if (e.fakeoutTimer === 1) {
    msg(state, 'ralsei', FAKEOUT_LINE);
    e.dialogueOpen = true;
  }
  if (e.fakeoutTimer === FAKEOUT_CUT_AT) {
    // instance_destroy(obj_dialoguer); instance_destroy(obj_writer);
    // instance_destroy(obj_face);  — mid-line.
    e.dialogueOpen = false;
    e.dialogueClose = null;
    e.marks.push({ frame: state.frame, destroyed: ['obj_dialoguer', 'obj_writer', 'obj_face'] });
    e.ralseiFakeout = 2;
    logAt(state, 'ralseiFakeout', 1, 2);
  }
  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// con 50.2 — THE B-SIDE EPILOGUE (Step_0:1247-1775)
// ───────────────────────────────────────────────────────────────────────────

/**
 * The state ladder, as data, so a check can assert the walk without
 * restating the machine. `at` is the `sb_con`, `beats` the `sb_timer` values
 * its branch tests, `next` where it hands off and at what timer.
 */
export const SB_STATES = [
  { at: 0, beats: [], next: null, note: 'sb_timer held at 0 by the branch itself' },
  { at: 1, beats: [SB_CLASH_BREAK], next: [2, 0] },
  { at: 2, beats: [10, 23, 38, 41, 45, 62, 72, 82, 92], next: [3, -4] },
  { at: 3, beats: [1, 17, 18, 19, 20, 21, 34, 41, 47, 65, 114, 148, 165], next: [4, -999] },
  { at: 4, beats: [35, 120, 150, 166, 220, 225, 255, SB_TERMINAL_AT], next: [SB_TERMINAL, null] },
  { at: SB_TERMINAL, beats: [], next: null, note: 'TERMINAL — con is never set to 10' },
];

/**
 * One frame of `con == 50.2`. Step_0:1247-1775, in order.
 *
 * The `else if` chain in `sb_con == 2` is written 10, 23, 38, 41, 45, 62, 82,
 * 72, 92 in the dump — 82 BEFORE 72. Every arm tests `sb_timer ==` an exact
 * integer and they are mutually exclusive, so the order has no behavioural
 * consequence; transcribed in ascending order here and noted so nobody
 * "discovers" the discrepancy and re-orders something that matters.
 */
export function stepSbEpilogue(state) {
  const e = ensureEnding(state);
  if (e.sbCon === null) return false;
  const su = actorOf(state, 'su');
  const ra = actorOf(state, 'ra');
  const kr = actorOf(state, 'kr');
  const kn = actorOf(state, 'knight');

  e.sbTimer += 1;
  const s = e.sbCon;
  const t = e.sbTimer;

  if (s === 0) {
    e.sbTimer = 0;
  } else if (s === 1) {
    if (t >= SB_CLASH_BREAK) {
      // :1256-1313 — THE CLASH BREAKS.
      e.sbCam = 0;
      e.sbCamX = e.camX;
      e.sbCon = 2; e.sbTimer = 0;
      logAt(state, 'sbCon', 1, 2);
      e.susieKnightSlash = false;
      e.susieKnightShakeSequence = false;
      const v = mark(state, (kn?.x ?? 0) - 90, (kn?.y ?? 0) - 90, SPR.fxHitback);
      lerpOn(state, v, 'image_index', 0, 4, 12);
      scrDoom(state, v, 12);
      cue(state, 'snd_metal_hit_strong', 0.8, 0.5);
      cue(state, 'snd_damage');
      cue(state, 'snd_sussurprise');
      showClashOverlay(state, CLASH_OVERLAY_HALF[1], CLASH_OVERLAY_HALF[0]);
      // THE CAMERA KICK. `sb_camX` lives on PTB02, so it is lerped on the
      // ending record rather than on an actor; the `camerax_set(sb_camX)`
      // tail below is what makes it visible.
      e.sbCam = 1;
      e.camLerp = {
        from: e.camX, to: e.camX + CAM_KICK, frames: CAM_KICK_FRAMES, t: 0,
      };
      e.camRelease = CAM_KICK_RELEASE;
      e.lerps.push({
        frame: state.frame, who: 'PTB02', name: 'sb_camX',
        from: e.camX, to: e.camX + CAM_KICK, frames: CAM_KICK_FRAMES,
        easetype: 2, easeinout: 'inout',
      });
      if (su) {
        su.y += 6; su.x += 14; su.visible = true;
        su.sprite = SPR.susieHurt;
        su.vspeed = -5; su.gravity = 0; su.hspeed = -1;
        su.image_angle = -4; su.image_index = 0; su.image_speed = 0;
        lerpOn(state, su, 'hspeed', -1, 0, 25);
        lerpOn(state, su, 'vspeed', -5, 2, 25);
        lerpOn(state, su, 'image_angle', -4, 12, 25);
      }
      if (ra) {
        ra.sprite = SPR.ralseiSurprisedRightWalk;
        ra.image_index = 0; ra.image_speed = 0;
      }
      if (kn) {
        kn.after_image_rate = 2; kn.move_speed = 2; kn.hspeed = 6;
        kn.sprite = SPR.roaringknightAttackOverworld;
        kn.image_index = 3; kn.image_speed = 0;
        kn.knightState = 0; kn.shakeamt = 0;
        lerpOn(state, kn, 'image_index', 3, 5, 3);
        lerpOn(state, kn, 'hspeed', kn.hspeed, 0, 6);
      }
    }
  } else if (s === 2) {
    sbCon2(state, e, t, { su, ra, kr, kn });
  } else if (s === 3) {
    sbCon3(state, e, t, { su, ra, kr, kn });
  } else if (s === 4) {
    sbCon4(state, e, t, { su, ra, kr, kn });
  }

  // `if (sb_con >= 1 && sb_cam) camerax_set(sb_camX);` — :1771-1774.
  stepCamKick(state, e);
  if (e.sbCon >= 1 && e.sbCam) e.camX = e.sbCamX;
  return true;
}

/** The `sb_camX` tween and the `scr_var_delay("sb_cam", 0, 21)` release. */
function stepCamKick(state, e) {
  if (e.camLerp) {
    const l = e.camLerp;
    l.t += 1;
    // easetype 2 / "inout", matching scr_lerpvar's arm.
    const x = l.t / l.frames;
    const p = x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
    e.sbCamX = l.from + (l.to - l.from) * p;
    if (l.t >= l.frames) e.camLerp = null;
  }
  if (e.camRelease !== undefined && e.camRelease !== null) {
    e.camRelease -= 1;
    if (e.camRelease <= 0) { e.sbCam = 0; e.camRelease = null; }
  }
}

/** Step_0:1317-1475. Susie is cut down. */
function sbCon2(state, e, t, A) {
  const { su, ra, kr, kn } = A;
  if (t === 10) {
    if (kn) {
      kn.y -= 20; kn.x += 8; kn.after_active = true;
      kn.image_index = 0;
      kn.sprite = SPR.roaringknightFlurryPrepare;
      lerpOn(state, kn, 'x', kn.x, (su?.x ?? 0) + 16, 12, 2, 'inout');
      lerpOn(state, kn, 'y', kn.y, (su?.y ?? 0) - 76, 12, 2, 'inout');
      // `scr_delay_var("sprite_index", 2790, 4)` — a NUMERIC sprite id.
      //
      // RESOLVED, not guessed: `knight-research/kaizo-mod/sprites/
      // sprites_kaizo.csv` is the mod's sprite table in id order (header row,
      // then id 0), so id N is row N + 2. That mapping was VALIDATED against
      // the two ids sim/victory-scene.js resolved independently for the same
      // cutscene (359 = spr_ralsei_walk_right_unhappy, 686 = spr_susier_dark)
      // before it was trusted here, and both CSVs agree, so the v0.091/v105
      // build gap does not move these rows.
      //
      //     2790 -> spr_roaringknight_attack_overworld
      //
      // It is the same sprite he entered the beat on, two frames after the
      // flurry wind-up — the wind-up is a flourish between two frames of the
      // attack pose, not a pose change.
      scrVarDelay(state, kn, 'sprite', SPR.roaringknightAttackOverworld, 4);
      scrVarDelay(state, kn, 'image_index', 2, 4);
    }
  } else if (t === 23) {
    for (const p of [0.06, 0.1, 0.12, 0.18, 0.24]) cue(state, 'snd_knight_cut2', p, 2);
    if (su) { su.vspeed = 0; su.gravity = 0; su.hspeed = 0; }
    // `with (whiteall) { image_blend = c_black; image_alpha = 1; visible = 1; }`
    // — Step_0:1347-1351. THE BLEND IS NEVER SET BACK in con 50.2, so every
    // later `visible = 1` fills the screen BLACK. See endingWhiteall's note.
    setWhiteall(state, { blend: 'c_black', alpha: 1, visible: true });
    if (kn) { kn.after_image_rate = 2; kn.move_speed = 8; }
    const sl = mark(state, (su?.x ?? 0) + 16, (su?.y ?? 0) + 48, SLASH_SPRITE, {
      depth: -120, image_speed: 0, image_index: 0, image_angle: 36,
    });
    sl.x += lengthdirX(SLASH_OFFSET[0], SLASH_OFFSET[1]);
    sl.y += lengthdirY(SLASH_OFFSET[0], SLASH_OFFSET[1]);
    e.sbSlash = sl;
    if (kn) kn.image_index = 5;
  } else if (t === 38) {
    e.marks.push({ frame: state.frame, destroyed: ['obj_afterimage'] });
    clearEndingAfterimages(state);
    if (kr) { kr.image_index = 1; kr.image_speed = 0; kr.hspeed = -5; }
    if (ra) {
      ra.sprite = SPR.ralseiShockedRight;
      ra.image_index = 0; ra.image_speed = 0; ra.hspeed = -3;
    }
    cueLoop(state, 'wind_highplace.ogg', 0.5, 1);
    e.music.push({ frame: state.frame, track: 'wind_highplace.ogg', pitch: 0.5 });
    setWhiteall(state, { visible: false });
    if (e.sbSlash?.alive) {
      e.sbSlash.image_index = 1;
      lerpOn(state, e.sbSlash, 'image_index', 1, 4, 8);
      // `scr_lerpvar("image_alpha", 3, 0, 8)` — the START is 3, not 1.
      // Transcribed; an alpha above 1 is legal in GameMaker and clamps at
      // paint time.
      lerpOn(state, e.sbSlash, 'image_alpha', 3, 0, 8);
    }
    if (su) {
      su.depth = (ra?.depth ?? 0) + 5;
      su.sprite = SPR.susieDwJumpBallFixed;
      su.image_angle = 0;
      lerpOn(state, su, 'x', su.x, su.x + lengthdirX(SUSIE_LAUNCH[0], SUSIE_LAUNCH[2]), 2);
      lerpOn(state, su, 'y', su.y, su.y + lengthdirY(SUSIE_LAUNCH[1], SUSIE_LAUNCH[2]), 2);
      scrVarDelay(state, su, 'vspeed', 0, 3);
      scrVarDelay(state, su, 'hspeed', -10, 3);
      scrVarDelay(state, su, 'friction', 0.8, 3);
      scrVarDelay(state, su, 'sprite', SPR.susieDwFell, 3);
    }
  } else if (t === 41) {
    e.bigShake = true;
    // RIGHT-TO-LEFT: `irandom_range(7000, 9000)` evaluates before `su_actor`.
    const rng = state.gmlRng;
    const amt = rng ? gmlIrandomRange(rng, OUCHIE_SUSIE[0], OUCHIE_SUSIE[1]) : OUCHIE_SUSIE[0];
    draw(state, 'epilogue', 2);
    ouchieDisplay(state, su, amt);
    cue(state, 'snd_wing', 0.8, 0.8);
    cue(state, 'snd_damage', 0.8, 0.8);
    cue(state, 'snd_impact', 1, 0.8);
    cue(state, 'snd_sussurprise', 0.75, 1);
    cue(state, 'snd_break1', 0.9, 0.7);
  } else if (t === 45) {
    if (kn) {
      scrVarDelay(state, kn, 'image_index', 4, 5);
      scrVarDelay(state, kn, 'image_index', 0, 10);
      lerpOn(state, kn, 'x', kn.x, kn.x - 8, 30, 2, 'inout');
      lerpOn(state, kn, 'y', kn.y, kn.y + 110, 30, 2, 'inout');
    }
    if (kr) { kr.image_index = 0; kr.hspeed = 0; }
    if (ra) ra.hspeed = 0;
  } else if (t === 62) {
    if (kr) kr.sprite = kr.dsprite;
  } else if (t === 72) {
    msg(state, 'ralsei', '\\EY* S-Susie!!!/%');
    e.dialogueOpen = true;
    if (ra) {
      ra.depth = (su?.depth ?? 0) - 5;
      ra.hspeed = 1;
      ra.sprite = SPR.ralseiSurprisedRightWalk;
      ra.image_speed = 0; ra.image_index = 1;
      scrVarDelay(state, ra, 'image_index', 0, 4);
      scrVarDelay(state, ra, 'hspeed', 0, 4);
    }
  } else if (t === 82) {
    if (kr) kr.sprite = kr.rsprite;
  } else if (t === 92) {
    e.sbCon = 3; e.sbTimer = -4;
    logAt(state, 'sbCon', 2, 3);
  }
}

/** Step_0:1476-1657. Ralsei's interrupt, and Ralsei is cut down. */
function sbCon3(state, e, t, A) {
  const { su, ra, kr, kn } = A;
  if (t === 1) {
    // `if (d_ex()) sb_timer = 0;` — THE MACHINE BLOCKS on the dialogue box
    // from :1495. This is a real stall, not a wait: sb_timer is pinned at 0
    // and re-enters this branch next frame.
    if (e.dialogueOpen) { e.sbTimer = 0; return; }
    if (kr) kr.sprite = kr.dsprite;
    if (ra) {
      scrVarDelay(state, ra, 'sprite', SPR.ralseiWalkUpSad, 26);
      scrVarDelay(state, ra, 'image_index', 0, 26);
      scrVarDelay(state, ra, 'image_speed', 0, 26);
      lerpOn(state, ra, 'y', ra.y, ra.y - 10, 26);
      lerpOn(state, ra, 'x', ra.x, (su?.x ?? 0) + 42, 26);
      ra.sprite = SPR.ralseiWalkRightSad;
      ra.image_speed = 0.2; ra.image_index = 1;
    }
  } else if (t === 17) {
    cue(state, 'snd_knight_drawpower', 0.36, 1);
    cue(state, 'snd_knight_drawpower', 0.55, 1);
    if (kn) {
      lerpOn(state, kn, 'x', kn.x, kn.x + 132, 17, 2, 'out');
      lerpOn(state, kn, 'y', kn.y, kn.y + 8, 17, 2, 'out');
    }
  } else if (t === 18) {
    msg(state, 'ralsei', '\\EZ* S-Susie..^1. please^1, get up, ');
    e.dialogueOpen = true;
  } else if (t >= 19 && t <= 21) {
    e.marks.push({ frame: state.frame, writerShake: 1 });
  } else if (t === 34) {
    cue(state, 'snd_knight_teleport');
    cue(state, 'snd_leaf_dodge', 0.4, 1);
    if (kr) kr.sprite = kr.rsprite;
    if (kn) {
      kn.move_speed = 2; kn.x += 52; kn.y += 44;
      kn.sprite = SPR.knightCrescentslash;
      kn.image_index = 1;
      lerpOn(state, kn, 'image_index', 1, 4, 6);
      lerpOn(state, kn, 'x', kn.x, (ra?.x ?? 0) + 40, 13, 2, 'in');
      lerpOn(state, kn, 'y', kn.y, (ra?.y ?? 0) + 26, 13, 2, 'in');
    }
  } else if (t === 41) {
    if (kr) { kr.image_index = 1; kr.image_speed = 0.25; kr.hspeed = 6; kr.vspeed = 2; }
  } else if (t === 47) {
    // THE LINE IS CUT OFF MID-DELIVERY, exactly as G-17's handler does it.
    e.marks.push({ frame: state.frame, destroyed: ['obj_dialoguer', 'obj_writer', 'obj_face'] });
    e.dialogueOpen = false;
    e.dialogueClose = null;
    for (const p of [0.06, 0.1, 0.12, 0.18, 0.24]) cue(state, 'snd_knight_cut2', p, 2);
    if (kr) { kr.image_index = 0; kr.image_speed = 0; kr.hspeed = 0; kr.vspeed = 0; }
    if (ra) { ra.hspeed = 0; ra.sprite = DEFEAT_SPRITE; }
    // BLACK, not white — the blend set at sb_con 2 t 23 is still in force.
    setWhiteall(state, { visible: true });
    if (e.sbSlash?.alive) {
      e.sbSlash.image_index = 0;
      e.sbSlash.image_alpha = 1;
      e.sbSlash.image_angle = 0;
      e.sbSlash.x = ra?.x ?? 0;
      e.sbSlash.y = (ra?.y ?? 0) + 40;
    }
  } else if (t === 65) {
    e.marks.push({ frame: state.frame, destroyed: ['obj_afterimage'] });
    clearEndingAfterimages(state);
    e.bigShake = true;
    const rng = state.gmlRng;
    const amt = rng ? gmlIrandomRange(rng, OUCHIE_RALSEI[0], OUCHIE_RALSEI[1]) : OUCHIE_RALSEI[0];
    draw(state, 'epilogue', 2);
    ouchieDisplay(state, ra, amt);
    cue(state, 'snd_wing', 0.8, 0.8);
    cue(state, 'snd_damage', 0.8, 0.8);
    cue(state, 'snd_impact', 1, 0.8);
    cue(state, 'snd_break1', 0.9, 0.7);
    setWhiteall(state, { visible: false });
    if (e.sbSlash?.alive) {
      e.sbSlash.image_index = 1;
      lerpOn(state, e.sbSlash, 'image_index', 1, 4, 8);
      lerpOn(state, e.sbSlash, 'image_alpha', 3, 0, 8);
    }
    if (kn) {
      kn.move_speed = 8; kn.visible = false;
      kn.after_active = false; kn.after_image_dir = -1;
    }
    if (ra) {
      ra.hspeed = -10; ra.friction = 0.4;
      ra.sprite = DEFEAT_SPRITE;
      // ── THE EASTER EGG. spr_ralsei_swoon's ONE site in the whole mod. ──
      const roll = endingFunchance(state, SWOON_CHANCE, 'epilogue');
      e.swoonRoll = roll;
      if (roll.hit) ra.sprite = SWOON_SPRITE;
      logAt(state, 'ralseiSwoon', null, roll.hit);
    }
    if (kr) {
      kr.image_index = 1; kr.image_speed = -0.25; kr.hspeed = -3;
      scrVarDelay(state, kr, 'hspeed', 0, 12);
      scrVarDelay(state, kr, 'vspeed', 0, 12);
      scrVarDelay(state, kr, 'image_index', 0, 12);
      scrVarDelay(state, kr, 'image_speed', 0, 12);
    }
  } else if (t === 114) {
    if (kr) kr.sprite = kr.lsprite;
  } else if (t === 148) {
    if (kr) kr.sprite = kr.rsprite;
  } else if (t === 165) {
    if (kr) { kr.hspeed = -1; kr.image_index = 2; kr.image_speed = -0.1; }
    e.sbCon = 4; e.sbTimer = -999;
    logAt(state, 'sbCon', 3, 4);
  }
}

/**
 * Step_0:1658-1770. Kris walks off the left edge alone; the Knight reappears
 * BEHIND him, faced away, at `image_xscale = -2`; the screen goes BLACK (t 220
 * is `whiteall.visible = true` and the blend has been `c_black` since sb_con 2
 * t 23 — this comment said "white" until 2026-09-12 and the GML never did);
 * and `board_ocean.ogg` fades up over 240 frames under `sb_con = 99`.
 *
 * The entry gate is `kr_actor.x <= (camerax() - 8) && sb_timer < 0` — Kris's
 * own drift at hspeed -1 decides the frame, which is why the actors carry real
 * motion.
 */
function sbCon4(state, e, t, A) {
  const { kr, kn } = A;
  if (kr && kr.x <= (e.camX - 8) && t < 0) {
    e.sbTimer = 0;
    logAt(state, 'sbCon4Gate', null, state.frame);
    kr.hspeed = 0; kr.image_index = 0; kr.image_speed = 0;
    e.marks.push({ frame: state.frame, minishake: 'kr' });
    objShake(state, 'kr', 4, 4, 1, 1);          // scr_minishakeobj, Step_0:1673
    cue(state, 'snd_wing', 0.8, 1);
    if (kn) {
      kn.after_active = false;
      kn.move_speed = 12;
      kn.depth = (kr.depth ?? 0) + 1;
      kn.sprite = FACEAWAY_SPRITE;
      kn.image_index = 0; kn.image_speed = 0;
      kn.image_xscale = -2;
      kn.image_alpha = 0;
      kn.x = kr.x + 102;
      kn.y = kr.y - 54;
      kn.visible = true;
    }
    e.marks.push({ frame: state.frame, torielGachaX: -999 });
    return;
  }
  if (t === 35) {
    if (kn) {
      kn.after_active = true;
      lerpOn(state, kn, 'image_alpha', 0, 1, 8);
    }
    e.marks.push({ frame: state.frame, pan: [-5, 0, 66] });
  } else if (t === 120) {
    if (kn) lerpOn(state, kn, 'image_index', 0, 2, 10);
  } else if (t === 150) {
    if (kn) {
      lerpOn(state, kn, 'image_index', 2, 6, 15);
      kn.hspeed = -3; kn.vspeed = -1; kn.friction = 0.1;
    }
  } else if (t === 166) {
    if (kn) {
      kn.depth = (kr?.depth ?? 0) - 1;
      kn.x -= 8; kn.y += 6;
      kn.sprite = SPR.roaringknightAttackOverworld;
      kn.image_index = 2;
      scrVarDelay(state, kn, 'image_index', 1, 5);
    }
  } else if (t === 220) {
    e.music.push({ frame: state.frame, track: null, op: 'free_all+stop_all' });
    // THE FINAL FILL IS BLACK. Step_0:1743 is `visible = true` and nothing
    // since :1347 has touched `image_blend`, so the scene ends under a black
    // screen — not a white one, which is what this file used to say.
    setWhiteall(state, { visible: true });
  } else if (t === 225) {
    for (const p of [0.06, 0.1, 0.12]) cue(state, 'snd_knight_cut2', p, 0.6);
    cue(state, 'snd_break1', 0.35, 0.6);
    cue(state, 'snd_break1', 0.4, 0.6);
    cue(state, 'snd_damage', 0.4, 0.6);
  } else if (t === 255) {
    cue(state, 'snd_break2', 0.35, 0.6);
    cue(state, 'snd_break2', 0.4, 0.6);
  } else if (t === SB_TERMINAL_AT) {
    e.sbCon = SB_TERMINAL;
    logAt(state, 'sbCon', 4, SB_TERMINAL);
    cueLoop(state, BOARD_OCEAN, 1, 0);
    e.music.push({
      frame: state.frame, track: BOARD_OCEAN,
      from: 0, to: BOARD_OCEAN_VOL, frames: BOARD_OCEAN_FADE,
    });
    // ── AND THAT IS THE END. No `con = 10`. ──────────────────────────────
    e.terminal = true;
    logAt(state, 'terminal', false, true);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// THE BEAT INTERPRETER — for con 50.1 and for G-17's two arms
// ───────────────────────────────────────────────────────────────────────────

/** Load a beat list. `runEndingScript` then walks it one frame at a time. */
export function startEndingScript(state, script) {
  const e = ensureEnding(state);
  e.script = script;
  e.scriptIndex = 0;
  e.wait = 0;
  e.waitFor = null;
  return e;
}

/** True while a beat list is still running. */
export function endingScriptRunning(state) {
  const e = ensureEnding(state);
  return !!e.script && e.scriptIndex < e.script.length;
}

/**
 * One frame of the beat list. Waits burn a frame each; every other op is
 * instantaneous and the walker keeps going until it hits one that blocks —
 * which is how obj_cutscene_master behaves.
 */
export function stepEndingScript(state) {
  const e = ensureEnding(state);
  if (!e.script) return false;
  if (e.wait > 0) { e.wait -= 1; return true; }
  if (e.waitFor) {
    if (!e.waitFor(state, e)) return true;
    e.waitFor = null;
  }
  let guard = 0;
  while (e.scriptIndex < e.script.length) {
    if (guard++ > 512) throw new Error('kaizo-ending: beat list did not advance');
    const beat = e.script[e.scriptIndex];
    e.scriptIndex += 1;
    const [op, ...args] = beat;
    if (op === 'w') { e.wait = args[0]; return true; }
    if (op === 'say') {
      msg(state, args[0], args[1]);
      // `c_talk_wait()` — the box opens and the walker blocks until it closes.
      // A headless run has no player, so the driver owns `dialogueOpen`;
      // nothing opens it here, which makes `say` a pass-through unless a
      // driver sets it. Recorded either way.
      e.waitFor = (_s, ee) => !ee.dialogueOpen;
      return true;
    }
    if (op === 'waitFakeout') {
      e.waitFor = (_s, ee) => ee.ralseiFakeout === 2;
      return true;
    }
    if (op === 'waitX') {
      const who = args[0]; const at = args[1];
      e.waitFor = (s2) => (actorOf(s2, who)?.x ?? at) >= at;
      return true;
    }
    applyBeat(state, e, op, args);
  }
  e.script = null;
  return false;
}

function applyBeat(state, e, op, args) {
  switch (op) {
    case 'init':
      e.sbCon = 0; e.sbCam = 0; e.sbCamX = 0; e.sbTimer = 0;
      logAt(state, 'sbCon', null, 0);
      break;
    case 'snd':
      e.music.push({ frame: state.frame, op: args[0] });
      break;
    case 'music':
      e.music.push({ frame: state.frame, track: args[0], opts: args[1] ?? null });
      break;
    case 'setxy': {
      const a = actorOf(state, args[0]);
      if (a) { a.x = args[1]; a.y = args[2]; }
      break;
    }
    case 'face': {
      const a = actorOf(state, args[0]);
      if (a) a.facing = args[1];
      break;
    }
    case 'sprite': {
      const a = actorOf(state, args[0]);
      if (a) a.sprite = args[1];
      break;
    }
    // `c_var_instance(<actor>, name, value)` — any field on an actor, as
    // distinct from `var`, which writes PTB02's own.
    case 'actorVar': {
      const a = actorOf(state, args[0]);
      if (a) a[args[1]] = args[2];
      break;
    }
    case 'lerpTo': {
      const a = actorOf(state, args[0]);
      if (a) lerpOn(state, a, args[1], a[args[1]], args[2], args[3], args[4], args[5]);
      break;
    }
    case 'walk': {
      const a = actorOf(state, args[0]);
      if (a) {
        lerpOn(state, a, 'x', a.x, args[1], args[3]);
        lerpOn(state, a, 'y', a.y, args[2], args[3]);
      }
      break;
    }
    case 'pan':
      e.camX = args[0];
      e.marks.push({ frame: state.frame, pan: [args[0], args[1]] });
      break;
    case 'whiteFade': {
      // `c_var_lerp_to_instance(whiteall, "image_alpha", 0, 30)` — Step_0:1202.
      // The battle's own end-fade left whiteall visible at alpha 1 (con 8's
      // `if (defeated) whiteall.visible = 1`); this is the epilogue taking it
      // away, and it is the receding white the page currently hand-rolls.
      const w = endingWhiteall(state, true);
      e.marks.push({ frame: state.frame, whiteall: 'fade', frames: args[0] });
      lerpOn(state, w, 'image_alpha', w.image_alpha, 0, args[0]);
      break;
    }
    case 'warp':
      e.marks.push({ frame: state.frame, warp: true });
      break;
    case 'knightVar': {
      const kn = actorOf(state, 'knight');
      if (kn) kn[args[0]] = args[1];
      break;
    }
    case 'swoon':
      e.swoonTarget = actorOf(state, args[0]);
      break;
    case 'var': {
      const from = e[args[0]];
      e[args[0]] = args[1];
      if (args[0] === 'sbCon' || args[0] === 'ralseiFakeout') {
        logAt(state, args[0], from, args[1]);
      }
      break;
    }
    default:
      e.marks.push({ frame: state.frame, unmodelled: op, args });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// THE DRIVER
// ───────────────────────────────────────────────────────────────────────────

/**
 * One frame of whatever is running. Order is PTB02's own Step: the `con`
 * block first (:1247), then the tail handlers (:1839 swoon, :1974 big_shake,
 * :1992 susie_knight_slash, :2487 ralsei_fakeout) — because the epilogue's
 * `sb_con 1` branch CLEARS `susie_knight_slash` and the clash handler then
 * sees the cleared value in the SAME frame. Reordering these is exactly the
 * kind of change that would cost the shake sequence an extra pulse.
 */
export function stepKaizoEnding(state) {
  const e = ensureEnding(state);
  stepDialogue(state);
  const script = stepEndingScript(state);
  const sb = stepSbEpilogue(state);
  const swoon = stepSwoonTarget(state);
  const shake = stepBigShake(state);
  const clash = stepSusieKnightSlash(state);
  const fake = stepRalseiFakeout(state);
  return {
    script, sb, swoon, shake, clash, fake, con: e.con, sbCon: e.sbCon,
  };
}

/**
 * The ending as an entity, for a driver that would rather spawn it than call
 * `stepKaizoEnding` by hand. Spawn it AFTER the actors so it steps after them
 * (this engine's step phase walks oldest-first — CLAUDE.md, "This engine's
 * order"), which puts the actors' friction/gravity before the machine that
 * reads their positions, the way PTB02's Step follows the room's.
 */
export const kaizoEndingDriver = {
  name: 'kaizo_ending_driver',
  create(e, state) {
    e.visible = false;
    ensureEnding(state);
  },
  step(e, state) {
    stepKaizoEnding(state);
  },
};

/**
 * Which sprite Ralsei is actually wearing after the sb_con-3 roll. The
 * consumer `spr_ralsei_swoon` never had.
 */
export function ralseiSwoonSprite(state) {
  const e = ensureEnding(state);
  return e.actors.ra?.sprite ?? null;
}

/** Everything a HUD or a check wants, in one read. */
export function endingReport(state) {
  const e = ensureEnding(state);
  return {
    sideb: e.sideb,
    con: e.con,
    sbCon: e.sbCon,
    sbTimer: e.sbTimer,
    camX: e.camX,
    terminal: e.terminal,
    resumedAtCon: e.resumedAtCon,
    ralseiFakeout: e.ralseiFakeout,
    fakeoutHit: e.fakeoutRolled?.hit ?? null,
    swoonHit: e.swoonRoll?.hit ?? null,
    ralseiSprite: e.actors.ra?.sprite ?? null,
    clashPulses: e.clashPulses,
    ouchies: e.ouchies.length,
    swoons: e.swoons.length,
    msgs: e.msgs.length,
    marks: e.marks.length,
    lerps: e.lerps.length,
    draws: { ...e.draws },
    transitions: e.log.length,
    approx: e.approx.length,
  };
}

/** The distinct `sb_con` values the epilogue actually visited. */
export function visitedSbStates(state) {
  const seen = [];
  for (const t of ensureEnding(state).log) {
    if (t.what === 'sbCon' && !seen.includes(t.to)) seen.push(t.to);
  }
  return seen;
}
