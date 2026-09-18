// KAIZO — THE FOUR TURN-HIJACKING SCENES. Three are the B-Side's (V-D);
// k_hpscene is BOTH ROUTES'.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — DO NOT PUBLISH
// WITHOUT PERMISSION (kaizo/HANDOFF.md §5-C). Everything below describes
// another author's creative work, read out of a private research dump.
//
// PROVENANCE — every branch is translated from these kaizo dump files
// (D:\ShadowCrystal\knight-research\kaizo-mod\gml_kaizo_dump\CodeEntries\),
// line numbers that dump's:
//
//   gml_Object_obj_knight_enemy_Create_0.gml       115-136  the scene vars
//   gml_Object_obj_knight_enemy_Step_0.gml         54-63     the k_hpscene ARM
//                                                  1408-1541 k_nhscene
//                                                  1543-1545 the k_sgscene arm
//                                                  1547-1770 k_sgscene
//                                                  1771-1929 k_hpscene
//                                                  1930-2049 k_tpscene
//                                                  2050-2052 the shared float
//                                                  679-756   turnsafternohit
//   gml_GlobalScript_scr_mnendturn.gml             148-169   BOTH B-Side arms
//   gml_GlobalScript_scr_marker.gml                scr_marker (obj_marker)
//   gml_GlobalScript_scr_minishakeobj.gml          scr_minishakeobj
//   gml_Object_obj_shakeobj_*.gml                  what it spawns
//   gml_GlobalScript_scr_complete_save_file.gml:269 get_swordcolor
//   gml_Object_obj_spell_snowgrave_Draw_0.gml      the snowflake spawner, and
//                                                  the NEUTERING at line 165
//   gml_Object_obj_spell_snowgrave_snowflake_*.gml the commandeered flakes
//   gml_GlobalScript_scr_spell.gml                 11-18, 257-276  the cast
//   gml_GlobalScript_scr_var_delay.gml             scr_delay_var
//   gml_Object_obj_script_delayed_*.gml            what it really arms
//   gml_GlobalScript_scr_picktarget_weighted (in kaizo_settings_init.gml:381)
//   gml_Object_obj_battlecontroller_Step_0.gml:23  what special_con DOES
//   gml_Object_obj_spellphase_Step_0.gml:8         what spelldelay DOES
//
// ═══ WHAT THESE FOUR ARE ════════════════════════════════════════════════════
//
// Each one takes a WHOLE TURN away from the player and plays a cutscene the
// vanilla fight has no equivalent of. Three of them are the third of the Weird
// Route that the sim was missing (WEIRD-ROUTE.md §6.C item 6); the fourth,
// k_hpscene, is NOT B-Side gated and is the only one an A-Side run can see.
//
//   k_hpscene  the Knight CUTS THE PARTY'S MAX HP DOWN — 200 / 230 / 180 / 180
//              for Kris / Susie / Ralsei / Noelle. Armed on his FIRST STEP
//              (Step_0:54-63, inside `if (damagereductiontimer == 1)`), NOT at
//              a turn end and NOT behind `k_sideb`: the guard is
//              `!practicemode && !nohitmode` and four threshold tests on
//              global.maxhp and global.hp. The thresholds are EXACTLY
//              scr_gamestart's chapter-3 values plus a margin, so a default
//              save (160/190/140) never trips it and an IMPORTED OVERLEVELLED
//              SAVE always does. That is the whole point of the scene: it is
//              the mod's answer to bringing a maxed file to the fight.
//
//   k_tpscene  the Knight SLICES THE TP BAR. Armed by scr_mnendturn at the end
//              of the turn after atk_Frenzy1. Its state 5 is what sets
//              k_tpscene = 10, and `k_tpscene >= 10` is the gate
//              kaizo/party/tensionbar.js already implements — so this machine
//              is the ONLY thing that can arm the 125 TP clamp. Until it
//              existed the clamp was dead code.
//   k_sgscene  the Knight NEUTERS SNOWGRAVE and turns it on the party. Armed
//              by the PLAYER casting the spell. The only writer of k_freeze,
//              which kaizo/party/freeze.js implements and which nothing could
//              previously reach in normal play. Noelle is exempt by a clamp.
//   k_nhscene  the NO-HIT REWARD scene: seven turns after a perfect Roaring
//              DELTA the Knight obliges, and one-shots slot 0 for
//              999999999999999999.
//
// ═══ HOW THEY HIJACK THE TURN — AND A CORRECTION ════════════════════════════
//
// WEIRD-ROUTE.md §6.C item 6 says all three hijack via
// `special_con = 1; global.myfight = 99; global.mnfight = 99; charturn = -1`.
// **That is right for two of the three and wrong for k_sgscene.** Read the
// four sites:
//
//   k_hpscene  NOTHING at the arm (Step_0:56-62 assigns `k_hpscene = 1` and
//              nothing else). The hijack is in the SCENE: :1776 re-asserts
//              `special_con = 1` on every frame `k_hpscene > 0`, the way
//              k_nhscene does, and state 1 (:1780-1782) writes charturn -1 /
//              mnfight 99 / myfight 99. Cleared at :1924 — and state 8 is the
//              only one of the four that HANDS THE TURN BACK by hand:
//              `mnfight = 0; myfight = 0; charturn = <first living>` (:1909-
//              1922), because it fires on the fight's opening frames, before
//              any turn machinery has ever run.
//   k_tpscene  scr_mnendturn:154-158 sets k_tpscene/special_con/myfight/
//              mnfight/charturn. Step_0:1935-1938 sets them AGAIN (charturn
//              -1, mnfight 99, myfight 99, state 10). Cleared at :2042.
//   k_nhscene  scr_mnendturn:162-166, same five. Step_0:1412 re-asserts
//              `special_con = 1` on EVERY frame of the scene. Cleared at :1534.
//   k_sgscene  Step_0:1543-1545 is the whole arm — `k_sgscene = 1` and nothing
//              else. The block NEVER touches special_con, mnfight, myfight or
//              charturn (grep: the only special_con writes in Step_0 are lines
//              1412, 1534, 1776, 1924, 2042, none of them in the sg block).
//              It hijacks by `global.spelldelay = 999999` (:1561), which
//              stalls obj_spellphase — the one thing that reads spelldelay
//              (`if (spelltimer >= global.spelldelay ...)`,
//              gml_Object_obj_spellphase_Step_0.gml:8) — until state 8 puts it
//              back to 1. The spell phase is where the cast resolves, so the
//              turn cannot proceed while the scene runs, and the player's
//              party never gets a menu back mid-scene.
//
// `special_con > 0` is what makes obj_battlecontroller's Step `exit`
// (gml_Object_obj_battlecontroller_Step_0.gml:23), so it is the real "freeze
// the battle" switch; spelldelay is the sg scene's narrower equivalent. Both
// are reported here — `sceneHijacksTurn` / `sceneStallsSpellphase`.
//
// ═══ THE DELAYS ARE ALARMS, NOT COUNTERS (CLAUDE.md rule 5) ═════════════════
//
// `scr_delay_var(name, value, n)` is `scr_script_delayed(scr_var, n, name,
// value)`, which creates an obj_script_delayed with `alarm[0] = n`; its
// Alarm_0 runs `event_user(0); instance_destroy();` and the user event does
// `variable_instance_set(target, name, value)`. GameMaker runs Alarms BEFORE
// Step, so arming with n on frame N means the knight's Step SEES the new value
// on frame N + n exactly. Collapsing that into a counter inside the scene
// would cost a frame in one direction or the other, so it is not collapsed:
// `scrDelayVar` spawns a real entity with a real `alarm[0]` and the sim's own
// alarm phase fires it. `destroyPendingDelays` is the `with (obj_script_delayed)
// instance_destroy()` the no-hit reset does (Step_0:808).
//
// ═══ RNG BUDGET — COUNTED, PER THE WORK ITEM ════════════════════════════════
//
// Draws on `state.gmlRng` (sim/rng.js: random / random_range / choose = 1,
// irandom / irandom_range = 2). Every one is accounted for in
// `state.kaizo.scenes.draws`, split per scene, and check-scenes asserts the
// exact budgets.
//
//   k_hpscene   state 3 only: ONE `choose(20, -20)` — the slash mark's opening
//               tilt (Step_0:1817). `scr_marker` itself draws nothing
//               (gml_GlobalScript_scr_marker.gml is three lines and no
//               randoms), `get_swordcolor()` is a switch over a settings
//               value, `scr_minishakeobj` spawns a deterministic obj_shakeobj,
//               and every other state is sounds, lerps and the min() cut.
//               Total for a whole hp scene: 1. The doubling described under
//               THE PRESERVED BUG below starts at state 5, AFTER the only
//               draw, so it does not multiply this number — which is exactly
//               the kind of claim a check has to pin rather than assume.
//   k_tpscene   state 5 only: THREE random_range, spawning the sheared bar top
//               (Step_0:1994-1996 — image_angle, hspeed, vspeed, in that
//               order). Every other state is sound + lerps: ZERO draws. Total
//               for a whole tp scene: 3.
//   k_nhscene   ZERO in states 1-4 and 7-8. State 5's NON-nohitmode branch
//               spends EIGHT: `repeat (4)` of an obj_dmgwriter at
//               `random_range(-64, 64)`, `random_range(-60, 16)`
//               (Step_0:1493) — 2 per repeat. Total: 8, or 0 in nohitmode
//               (which exits at 5 without the repeat).
//   k_sgscene   the expensive one, and most of it is not in the knight at all:
//               top of block   random(0.5) in snd_wing's pitch — 1 draw on
//                              every EVEN frame once k_sgscene > 1 && k_sgvol > 0
//               state 1        scr_picktarget_weighted = irandom -> 2 draws
//                              (0 if the bag is empty)
//               state 3        per flake per frame: 3 if (con == 1 &&
//                              frame % 5 == 0) [tarX, tarY, alpha]; 3 more on
//                              the frame it is ADOPTED [alpha, tarX, tarY];
//                              0 if it is discarded (odd k_sgcyc -> destroy)
//               state 4        per flake: 2 [tarX, tarY], +1 first [alpha] if
//                              con < 1
//               state 4.1      per flake per frame: 3 if (con == 1 &&
//                              frame % 5 == 0) [alpha, tarX, tarY] — NOTE the
//                              order differs from state 3's
//               state 5        3 (`repeat (3)` snd_rocket_bc pitch)
//               state 6.1      2 + (1 when frame % 2 == 0 and the target is
//                              not Noelle) — delegated to freeze.js's
//                              stepSnowgraveFreeze, which counts its own
//               snowflakes     con 2 -> 2 [direction, speed];
//                              con 2.1 -> 1 [friction]; con 3, only when it
//                              reaches a NOELLE target -> 3 [vspeed's
//                              random_range, then its choose, then the graze
//                              pitch]
//
// ═══ THE PRESERVED BUG — k_hpscene state 5 ══════════════════════════════════
//
// Step_0:1849 is
//
//     hp_scene = 5.1;
//
// with NO `k_`. `hp_scene` occurs exactly ONCE in the whole kaizo dump — that
// write — and has no reader anywhere (whole-dump grep, which is the only kind
// CLAUDE.md trusts). So it is a typo for `k_hpscene = 5.1`, it creates a dead
// instance variable, and `k_hpscene` STAYS 5.
//
// The consequence is not cosmetic and is not a one-frame wobble. The scene
// advances only on `scr_delay_var("k_hpscene", 6, 2)`, an ALARM two frames
// out, so the `k_hpscene == 5` branch runs on BOTH of those frames:
//
//   f+0  state 5 runs: two snd_knight_cut, image_index 3, an image_index
//        lerp, an obj_shake at shakex 10, the mark's flash-out, and delay->6
//   f+1  `k_hpscene` is STILL 5 — all of it again, and a SECOND delay->6
//   f+2  the first alarm lands: state 6 (the max-HP cut), delay->7
//   f+3  the second alarm lands and drives `k_hpscene` back to 6: the cut
//        runs a second time (min() makes it idempotent), and a second delay->7
//   ...  every state from 6 on therefore runs EXACTLY TWICE, in lockstep one
//        frame apart, all the way to state 8's hand-back. It does not compound
//        past two: 6, 7, 7.2 and 8 each park on a wait value, so each run arms
//        exactly one successor.
//
// NOT FIXED, and marked here and at the site (CLAUDE.md law 4 / "Never pin a
// value the game sequences itself with"). The double sounds, the double
// screen shake and the doubled hand-back are what the mod does. The one thing
// this module does NOT reproduce is a phantom variable nothing reads: the
// write is recorded as `sc.hp.hpSceneTypo` so a check can assert it happened
// and assert that `k_hpscene` did not move because of it.
//
// ═══ WHAT IS NOT HERE ═══════════════════════════════════════════════════════
//
// DRAWING, per the work item. Skipped and listed, so nobody has to re-derive
// which visuals were dropped:
//
//   - every `scr_lerpvar` on x / y / image_index (the Knight's leap onto the
//     bar, his three-frame slash pose, the drift home). Targets are RECORDED on
//     `sc.lerps` so a renderer can replay them; they draw no RNG.
//   - the sheared bar top itself (spr_tensionbar_sliced_top). Its three
//     random_range ARE consumed and its resulting hspeed/vspeed/image_angle
//     recorded on `sc.tp.deadtp`; nothing paints it.
//   - obj_shake / scr_shakeobj / scr_minishakeobj / scr_oflash / afterimage
//     depth juggling — all no-RNG.
//   - obj_dmgwriter, obj_recruitanim, the battle text and the message strings.
//     The strings ARE carried (they are content, and the tp scene's k_didspell
//     branch changes which one appears) on `sc.msgs`.
//   - the snowgrave spell's own Draw: background, alpha ramp, snowfall tiling.
//     Its snowflake SPAWNER is not a visual — it is the mechanism the scene
//     runs on — so that half is modelled (`snowgraveSpell`).
//
// UNVERIFIED MODELLING DECISIONS, flagged rather than buried. Nothing here has
// an oracle recording; these are the places where that would bite:
//
//   1. EVENT ORDER. The knight's Step is assumed to run before the snowflakes'
//      (the knight instance long predates them, and this engine's phaseList
//      sorts by spawn seq). The mod's state-3 branch reads flake `y` and the
//      flakes' own Step moves them, so the two orders differ by one frame of
//      flake position.
//   2. FLAKE MOTION. Friction and gravity are applied at the END of the flake's
//      Step, and the position update is the engine's `componentMotion` — the
//      same order GML uses (friction on the speed magnitude, gravity vector
//      into the components, then move) but NOT routed through runMotion's
//      measured f32-pi direction model. The only mechanical consequence is
//      WHICH FRAME `abs(tarX - x) < 36` trips and hands the scene to state 6;
//      that it trips is structural.
//   3. THE KNIGHT'S ANCHOR. The flakes aim at `other.x + 28/136` and are
//      adopted at `y < other.y + other.sprite_height + 40`. x/y come from a
//      live `obj_knight_enemy` entity when the scene has one, else from
//      sim/actors.js's KNIGHT (425, ystart 78); `sprite_height` is 115, read
//      off kaizo/assets/sprites/manifest.json's spr_roaringknight_idle. All
//      three are overridable on `sc.knight`.
//
// ═══ OWNERSHIP ═════════════════════════════════════════════════════════════
//
// This file writes ONLY: `state.kaizo.tpscene` / `.sgscene` / `.nhscene`
// (the names kaizo/party/tensionbar.js already reads), `state.kaizo.scenes`
// (its own bookkeeping), `state.kaizo.mnfight` / `.myfight` / `.charturn` /
// `.specialCon` / `.spelldelay` (the scene's writes to the four globals it
// hijacks with, under the keys kaizo/party/gloom.js already reads mnfight
// from), and — through the modules that own them — `state.partyHp`,
// `state.chardead` and `state.kaizo.freeze`.
//
// ONE EXCEPTION, and it is deliberate: k_hpscene's hand-back (Step_0:1911-
// 1922) also writes `state.menu.charturn`, because that — not
// `state.kaizo.charturn` — is where this engine keeps `global.charturn`, and
// a scene that picks whose turn it is and writes only its own mirror has
// computed the right answer into an address nothing reads. See
// applySceneHandbackCharturn.
//
// It does NOT edit freeze / gloom / tensionbar / roster / damage / heroes. It
// imports them and states its requirements:
//
//   freeze.js       stepSnowgraveFreeze(state, {target}) IS the k_sgscene 6.1
//                   tick, already translated with the Noelle clamp. Called
//                   verbatim; this module supplies the target and the frames.
//   tensionbar.js   kaizoTensionClampActive(state) reads state.kaizo.tpscene.
//                   THIS module is its writer. Nothing else needs to change.
//   roster.js       writerAnchor / charIdOf / rosterSize for the damage-writer
//                   anchor and the slot<->charId bridge.
//   damage.js       scrPicktargetWeighted (the weighted (5,4,3,1) pick) and
//                   scrDead (the no-hit scene's kill).
//
// REQUIREMENTS ON THE SCENE OWNER (see nextSteps in the handoff):
//   - `state.kaizo.prevatk` must hold the mod's `kaizo_prevatk` (the struct id
//     of the turn that just ended) for the tp arm to fire; there is a
//     name-based fallback off state.kaizo.launched.
//   - `state.knight.practicemode` gates BOTH scr_mnendturn arms.
//   - `state.knight.haveusedroaring`, `.progamer`, `.turnsafternohit`,
//     `.nohitmode` gate the arms as in the GML.

import { spawn, destroy } from '../../sim/entity.js';
import { gmlRandom, gmlRandomRange, gmlChoose } from '../../sim/rng.js';
import { lerp, lengthdirX, lengthdirY, pointDirection, gmlRound } from '../../sim/gml.js';
import { cue, cueStop } from '../../sim/audio.js';
import { spawnDmgNumber } from '../../sim/dmgnumbers.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { scrShakescreen } from '../../sim/shake.js';
import { KNIGHT, partyActor } from '../../sim/actors.js';
import { PARTY as SIM_PARTY } from '../../sim/damage.js';
import { getSwordcolor } from '../attacks/kaizo-colors.js';
import { stepSnowgraveFreeze, ensureFreezeState } from './freeze.js';
import { kaizoTensionClampActive, kaizoTpscene } from './tensionbar.js';
import {
  writerAnchor, charIdOf, rosterSize, slotDepth, havechar, slotOf, memberAt,
} from './roster.js';
import { scrPicktargetWeighted, scrDead } from './damage.js';

// ───────────────────────────────────────────────────────────────────────────
// Constants, all cited
// ───────────────────────────────────────────────────────────────────────────

/**
 * THE FOUR CEILINGS, CHARACTER-INDEXED (index 0 unused, as `global.maxhp[0]`
 * is in the mod). One table, because the mod uses the same four numbers twice:
 *
 *   Step_0:56   `global.maxhp[1] > 200 && scr_havechar(1)` ... the ARM test
 *   Step_0:60   `global.hp[1] > 200 && scr_havechar(1)`    ... the ARM test
 *   Step_0:1871 `global.maxhp[1] = min(global.maxhp[1], 200)` ... the CUT
 *
 * They sit just above scr_gamestart's chapter-3 values (Kris 160, Susie 190,
 * Ralsei 140 — sim/damage.js PARTY; Noelle's own 120, kaizo/party/noelle.js),
 * which is why a default save cannot arm this scene and an imported
 * overlevelled one always can.
 */
export const HP_CEILINGS = [0, 200, 230, 180, 180];

/** `kaizo_prevatk == "atk_Frenzy1"` — scr_mnendturn:152. Phase 1's last node. */
export const TP_ARM_PREVATK = 'atk_Frenzy1';

/** The same row's display name, for the launched-ledger fallback. */
export const TP_ARM_PREVATK_NAME = 'Frenzy 1';

/** `turnsafternohit == 7` — scr_mnendturn:160. */
export const NH_ARM_TURNS = 7;

/** `var _snowS = 56;` — Step_0:1549, the flake scatter radius. */
export const SNOW_SCATTER = 56;

/**
 * `sprite_height` of spr_roaringknight_idle. MEASURED, not guessed:
 * kaizo/assets/sprites/manifest.json gives 117x115 for that sprite, and GML's
 * `sprite_height` is the UNSCALED height (the knight draws at image_yscale 2,
 * which this value deliberately does not include).
 */
export const KNIGHT_SPRITE_HEIGHT = 115;

/** `global.spelldelay = 999999` (Step_0:1561) and `= 1` (Step_0:1761). */
export const SG_SPELLDELAY_STALL = 999999;
export const SG_SPELLDELAY_RELEASE = 1;

/** `global.spelldelay = 140` — scr_spell case 10, after the spell is created. */
export const SNOWGRAVE_SPELLDELAY = 140;

/** `global.hp[global.char[0]] = -999999999999999999;` — Step_0:1501. */
export const NH_KILL_HP = -999999999999999999;

/** `dm.damage = "999999999999999999"` — Step_0:1490. A STRING in the original. */
export const NH_DAMAGE_TEXT = '999999999999999999';

/**
 * The five globals scr_mnendturn's arm writes, and the two the sg scene uses
 * instead. Exported so a turn system can assert it honours them.
 */
export const SCENE_HIJACK_KEYS = ['specialCon', 'mnfight', 'myfight', 'charturn'];

// ───────────────────────────────────────────────────────────────────────────
// State
// ───────────────────────────────────────────────────────────────────────────

/**
 * Stand up `state.kaizo.scenes` and the three scene variables.
 *
 * The scene numbers live on `state.kaizo` and NOT inside `scenes`, because
 * kaizo/party/tensionbar.js already reads `state.kaizo.tpscene` — that read
 * is the contract this module was written to satisfy, and moving it would
 * break the module that has been waiting for a writer.
 *
 * obj_knight_enemy Create_0:123-136 initialises every one of these to 0 /
 * false, except `progamer = true` (:65) and `k_lastpro = true` (:133).
 */
export function ensureScenes(state) {
  const k = (state.kaizo ??= {});
  if (typeof k.tpscene !== 'number') k.tpscene = 0;
  if (typeof k.sgscene !== 'number') k.sgscene = 0;
  if (typeof k.nhscene !== 'number') k.nhscene = 0;
  // Create_0:124. NOT re-zeroed on the A-Side: Step_0:50's `k_hpscene = 0` is
  // inside the `if (k_sideb)` block at :42, so a Normal Route run carries
  // Create's 0 into the arm test eleven lines later.
  if (typeof k.hpscene !== 'number') k.hpscene = 0;
  if (typeof k.specialCon !== 'number') k.specialCon = 0;
  if (k.scenes) return k.scenes;

  k.scenes = {
    // ── the knight's anchor (see UNVERIFIED note 3) ──────────────────────
    knight: {
      x: KNIGHT.x,
      y: KNIGHT.ystart,
      ystart: KNIGHT.ystart,
      xstart: KNIGHT.x,
      spriteHeight: KNIGHT_SPRITE_HEIGHT,
      // `state = 10` / `k_scenefloat` / `k_yoff` — the float pose the three
      // scenes park him in (Step_0:1538-1540, 1766-1768, 2050-2052).
      knightState: 0,
      sceneFloat: 0,
      yoff: 0,
      siner2: 1,
      spriteIndex: 'spr_roaringknight_idle',
      imageIndex: 0,
      imageSpeed: 0,
      depth: 88,
      remdepth: 88,
    },
    // ── per-scene bookkeeping ────────────────────────────────────────────
    // k_hpscene. `mark` is the live hpslash_mark instance (Step_0:1813);
    // `cut` records what the max-HP shear actually did, per CHARACTER id,
    // because "the scene ran" and "the scene cut nothing" are otherwise the
    // same observation once the numbers are already under the ceiling.
    // `armedBy` names WHICH of the two arm tests fired (:56 maxhp, :60 hp) —
    // they are separate `if`s and either can arm alone. `hpSceneTypo` is the
    // dead `hp_scene = 5.1` write (see THE PRESERVED BUG in the header).
    hp: {
      mark: null, cut: null, armedBy: null, hpSceneTypo: 0,
      runs: Object.create(null), minishakes: 0, handback: null,
    },
    tp: { deadtp: null, nospellsaw: 0 },
    // k_sgtarget / k_sgnum / k_sgvol / k_sgpit / k_sgcyc / k_sgdmg /
    // k_sgcaster — Step_0:1562-1566, 1670-1671, and scr_spell:274.
    // `ticks` and `peakVol` are NOT the mod's — they are positive-execution
    // counters in the sense CLAUDE.md means (state.counters): without them
    // "the freeze tick ran 24 times" and "the tick never ran" are the same
    // observation from outside, because k_sgvol is zeroed at state 5 and
    // k_sgscene has left 6.1 by the time anything can look.
    sg: {
      target: 0, num: 0, vol: 0, pit: 0.7, cyc: 0, caster: 0, spell: null,
      ticks: 0, peakVol: 0,
    },
    nh: { star: null, siner: 0 },
    // ── recorded, never drawn ────────────────────────────────────────────
    lerps: [],
    msgs: [],
    writers: [],
    // ── the audit trail the check reads ──────────────────────────────────
    log: [],
    draws: {
      hp: 0, tp: 0, sg: 0, nh: 0, flakes: 0,
    },
    // scr_mnendturn, injectable. The default is the `with (obj_knight_enemy)`
    // block ONLY — the rest of scr_mnendturn (the turn reset, the menu, the
    // revive heal that this fight deletes) belongs to the turn system.
    onMnendturn: null,
  };
  ensureFreezeState(state);
  return k.scenes;
}

/** Total RNG this module has spent, per scene. */
export function sceneDraws(state) {
  return { ...ensureScenes(state).draws };
}

/**
 * `obj_battlecontroller`'s Step gate: `if (i_ex(obj_knight_enemy) &&
 * obj_knight_enemy.special_con > 0) exit;` — the whole battle is frozen.
 */
export function sceneHijacksTurn(state) {
  return (state.kaizo?.specialCon ?? 0) > 0;
}

/**
 * The sg scene's narrower stall: obj_spellphase cannot advance while
 * `global.spelldelay` is 999999. See the CORRECTION at the top of this file.
 */
export function sceneStallsSpellphase(state) {
  return (state.kaizo?.spelldelay ?? 0) >= SG_SPELLDELAY_STALL;
}

/** True while ANY of the four is running. */
export function sceneActive(state) {
  const k = state.kaizo ?? {};
  return (k.hpscene ?? 0) > 0 || (k.tpscene ?? 0) > 0
    || (k.sgscene ?? 0) > 0 || (k.nhscene ?? 0) > 0;
}

// ───────────────────────────────────────────────────────────────────────────
// Internals
// ───────────────────────────────────────────────────────────────────────────

function draw(state, who, n = 1) {
  ensureScenes(state).draws[who] += n;
}

/**
 * `global.battlemsg[0] = ...` / `k_msgsetloc(0, ...)`.
 *
 * RECORDED **AND** DELIVERED. This used to only push to the ledger, and the
 * ledger has no readers outside the checks — so the Knight cut the TP bar in
 * silence, and k_hpscene's "Not so fast." never appeared either. The seam the
 * rest of the mod's turn-end text already uses is `state.battlemsg`
 * (kaizo/scenes/kaizo-vc-hooks.js:310); this call site simply was not taking
 * it. The downstream half of the same block WAS wired — `k_nospellsaw` travels
 * and feeds the later taunt — which is what made the gap hard to see.
 *
 * LAST WRITE WINS, which is what the GML does: the tp scene's `!k_didspell`
 * branch (Step_0:2034) overwrites the :2031 line in the same frame, and
 * `scr_mnendturn()` — called one line later — never touches `battlemsg`, so
 * the string survives into the next turn's message box.
 */
function msg(state, text) {
  ensureScenes(state).msgs.push({ frame: state.frame, text });
  state.battlemsg = text;
}

/**
 * `scr_lerpvar(name, from, to, frames, easetype, easeinout)`.
 *
 * Always recorded — check-scenes.mjs reads the log, and a lerp is the only
 * evidence of a move that has no other side effect. ALSO RUN, as a real
 * obj_lerpvar on the real knight, when the call site is one the mod makes in
 * obj_knight_enemy's own scope AND attachSceneKnight has bound an instance:
 * pass `knight: true`. The sites inside a `with (flake)` or `with (star)`
 * do not pass it, because `id` there is not the knight.
 *
 * The ease arguments are the GML's: `_l` is 2 (Step_0:1772) and the mode is
 * whichever string that call passes; omitting both is scr_lerpvar's
 * `argument_count < 6` arm, which leaves obj_lerpvar's Create defaults
 * (easetype 0 — linear).
 */
function noteLerp(state, name, from, to, frames, opts = {}) {
  const { easetype, easeinout, knight = false } = opts;
  const sc = ensureScenes(state);
  sc.lerps.push({ frame: state.frame, name, from, to, frames, easetype, easeinout });
  if (knight && sc.live?.alive) {
    scrLerpvar(state, spawn, sc.live, name, from, to, frames, easetype, easeinout);
  }
}

/** The knight-scope lerp, with `_l` already filled in (Step_0:1772). */
const L = 2;
const kl = (easeinout) => ({ easetype: L, easeinout, knight: true });

function logTransition(state, scene, from, to) {
  ensureScenes(state).log.push({ frame: state.frame, scene, from, to });
}

function setScene(state, scene, value) {
  const k = state.kaizo;
  const key = `${scene}scene`;
  const from = k[key];
  if (from === value) return;
  k[key] = value;
  logTransition(state, scene, from, value);
}

/**
 * The knight's live position, if the scene has a real actor. `other.x` /
 * `other.y` inside the mod's `with (obj_spell_snowgrave_snowflake)` loops is
 * the Knight, so the flakes chase whatever he is doing.
 */
function knightAnchor(state) {
  const sc = ensureScenes(state);
  const live = state.entities?.find(
    (e) => e.alive && e.type?.name === 'obj_knight_enemy',
  );
  if (live) {
    return {
      x: live.x,
      y: live.y,
      spriteHeight: sc.knight.spriteHeight,
    };
  }
  return { x: sc.knight.x, y: sc.knight.y, spriteHeight: sc.knight.spriteHeight };
}

/**
 * BIND THE SCENE TO THE REAL KNIGHT — the difference between a cutscene that
 * is bookkept and one that is PLAYED.
 *
 * Every pose in this file is a write to obj_knight_enemy's own variables:
 * `state = 10`, `sprite_index`, `image_index`, `image_speed`, `x`, `y`,
 * `depth`, `remdepth`, `siner2`, `k_scenefloat`, `k_yoff`
 * (Step_0:1930-2049 for k_tpscene; 1408-1541 and 1547-1770 for the other
 * two). The module was written before it had an actor to write them to, so
 * it kept a shadow `sc.knight` and posed that — with the consequence that
 * the Knight went through the whole TP-slash without moving, changing sprite
 * or leaving his bob.
 *
 * Binding hands those field names to the live instance and to state.knight,
 * which is where this engine keeps obj_knight_enemy's `state`
 * (sim/knight.js calls it `animState`; sim/actors.js gates the idle pose,
 * the bob and the afterimage trail on `animState === 0 || === 3`, exactly as
 * the GML gates them on `state == 0 || state == 3`). So `state = 10` stops
 * the vanilla actor of its own accord and the scene's float takes the y —
 * the two compose without either one knowing about the other.
 *
 * `k_scenefloat` / `k_yoff` / `remdepth` are instance variables of
 * obj_knight_enemy in the mod (Create_0:115-136), so they are stored on the
 * instance here too rather than in this module's bookkeeping.
 *
 * Idempotent, and re-binds if the instance is ever replaced. Unbound — the
 * standalone drives in check-scenes.mjs, which have no entity list — every
 * pose still lands on the shadow and nothing below changes behaviour.
 */
export function attachSceneKnight(state) {
  const sc = ensureScenes(state);
  const ent = state.entities?.find(
    (e) => e.alive && e.type?.name === 'obj_knight_enemy',
  );
  if (!ent) { sc.live = null; return sc.knight; }
  if (sc.live === ent) return sc.knight;

  const shadow = sc.knight;
  const kb = (state.knight ??= {});
  // The knight's own scene variables, seeded from the shadow so a bind that
  // happens mid-scene inherits the pose rather than resetting it.
  if (ent.k_scenefloat === undefined) ent.k_scenefloat = shadow.sceneFloat ?? 0;
  if (ent.k_yoff === undefined) ent.k_yoff = shadow.yoff ?? 0;
  if (ent.remdepth === undefined) ent.remdepth = ent.depth;

  const bind = (obj, key) => ({
    get: () => obj[key],
    set: (v) => { obj[key] = v; },
    enumerable: true,
    configurable: true,
  });
  const live = { spriteHeight: shadow.spriteHeight };
  Object.defineProperties(live, {
    x: bind(ent, 'x'),
    y: bind(ent, 'y'),
    xstart: bind(ent, 'xstart'),
    ystart: bind(ent, 'ystart'),
    siner2: bind(ent, 'siner2'),
    depth: bind(ent, 'depth'),
    remdepth: bind(ent, 'remdepth'),
    spriteIndex: bind(ent, 'sprite_index'),
    imageIndex: bind(ent, 'image_index'),
    imageSpeed: bind(ent, 'image_speed'),
    sceneFloat: bind(ent, 'k_scenefloat'),
    yoff: bind(ent, 'k_yoff'),
    // `state`, the mod's name; sim/knight.js's `animState`, this engine's.
    knightState: bind(kb, 'animState'),
  });
  sc.knight = live;
  sc.live = ent;
  return live;
}

/**
 * The mod's `with (obj_afterimage) if (hspeed == 2) depth = other.depth + 1`
 * — Step_0:1967-1973 and again at 2007-2013. The knight's ghost trail drifts
 * right at hspeed 2 (sim/actors.js's spawn block), and both times the scene
 * moves his depth it drags the trail with it so the ghosts do not suddenly
 * sort in front of the knight they came from.
 */
function reparentAfterimages(state, depth) {
  for (const e of state.entities ?? []) {
    if (e.alive && e.type?.name === 'obj_afterimage' && e.hspeed === 2) {
      e.depth = depth + 1;
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// scr_delay_var — a real alarm, not a counter
// ───────────────────────────────────────────────────────────────────────────

/**
 * `obj_script_delayed` narrowed to its one use here: `scr_var(name, value)`
 * on a target that is always obj_knight_enemy.
 *
 * Create sets `alarm[0] = 1` and scr_script_delayed then overwrites it with
 * the caller's n; Alarm_0 is `event_user(0); instance_destroy();` and
 * Other_10 is `with (target) script_execute(scr_var, arg0, arg1)`.
 */
export const scriptDelayedVar = {
  name: 'obj_script_delayed',
  create(e) {
    e.visible = false;
    // `??=`, NOT `=`. spawn() applies `vars` BEFORE running create, so a plain
    // assignment here would wipe the two fields the caller just passed in —
    // and the alarm would then fire with a null target and silently do
    // nothing, which is exactly the "green suite, dead code path" failure
    // CLAUDE.md warns about.
    e.varName ??= null;
    e.varValue ??= 0;
  },
  alarm: {
    0(e, state) {
      // event_user(0) — the assignment.
      if (e.varName) setScene(state, e.varName, e.varValue);
      // instance_destroy() — same event, right after.
      destroy(e);
    },
  },
};

/**
 * `scr_delay_var("k_<scene>scene", value, frames)`.
 *
 * `scene` is 'tp' | 'sg' | 'nh'. Requires a sim state with an entity list —
 * the alarm phase is what makes the timing right (CLAUDE.md rule 5), so there
 * is deliberately no counter fallback.
 */
export function scrDelayVar(state, scene, value, frames) {
  ensureScenes(state);
  return spawn(state, scriptDelayedVar, {
    alarm: (() => {
      const a = new Array(12).fill(-1);
      a[0] = frames;
      return a;
    })(),
    varName: scene,
    varValue: value,
  });
}

/** Every armed-but-unfired delay, for a check or a debug HUD. */
export function pendingDelays(state) {
  return (state.entities ?? [])
    .filter((e) => e.alive && e.type === scriptDelayedVar)
    .map((e) => ({ scene: e.varName, value: e.varValue, frames: e.alarm[0] }));
}

/**
 * `with (obj_script_delayed) instance_destroy();` — Step_0:808, the no-hit
 * reset. Exported because a scene owner tearing a turn down needs it.
 */
export function destroyPendingDelays(state) {
  let n = 0;
  for (const e of state.entities ?? []) {
    if (e.alive && e.type === scriptDelayedVar) { destroy(e); n += 1; }
  }
  return n;
}

// ───────────────────────────────────────────────────────────────────────────
// THE ARMS — scr_mnendturn:148-169
// ───────────────────────────────────────────────────────────────────────────

/**
 * The five globals both arms write. scr_mnendturn:154-158 / 162-166:
 *
 *     k_<x>scene = 1;
 *     special_con = 1;
 *     global.myfight = 99;
 *     global.mnfight = 99;
 *     global.charturn = -1;
 */
function hijackTurn(state) {
  const k = state.kaizo;
  k.specialCon = 1;
  k.myfight = 99;
  k.mnfight = 99;
  k.charturn = -1;
}

/**
 * `kaizo_prevatk == "atk_Frenzy1"`.
 *
 * The mod compares against the STRUCT ID. `state.kaizo.prevatk` is where a
 * launcher translation should put it; until one does, the launch ledger's
 * display name is an unambiguous stand-in (only one row is called "Frenzy 1").
 */
function prevAtkIsFrenzy1(state) {
  const k = state.kaizo ?? {};
  if (typeof k.prevatk === 'string') return k.prevatk === TP_ARM_PREVATK;
  const last = Array.isArray(k.launched) && k.launched.length
    ? k.launched[k.launched.length - 1]
    : null;
  return !!last && last.name === TP_ARM_PREVATK_NAME;
}

/**
 * scr_mnendturn:152-159.
 *
 *     if (k_tpscene == 0 && kaizo_prevatk == "atk_Frenzy1" && !haveusedroaring)
 *
 * @returns {boolean} whether the scene armed.
 */
export function armTpscene(state) {
  ensureScenes(state);
  const kn = state.knight ?? {};
  if ((state.kaizo.tpscene ?? 0) !== 0) return false;
  if (!prevAtkIsFrenzy1(state)) return false;
  if (kn.haveusedroaring) return false;
  setScene(state, 'tp', 1);
  hijackTurn(state);
  return true;
}

/**
 * scr_mnendturn:160-167.
 *
 *     if (k_nhscene == 0 && progamer && turnsafternohit == 7)
 *
 * `turnsafternohit` is EQUALITY, not `>=`: it only ever equals 7 on one turn,
 * and the counter is bumped once per turn in the enemy-talk block
 * (Step_0:702) while `didfullnohit && progamer`. Taking a single hit anywhere
 * clears `progamer` (scr_damage.gml:32) and the scene is gone for the run.
 */
export function armNhscene(state) {
  ensureScenes(state);
  const kn = state.knight ?? {};
  if ((state.kaizo.nhscene ?? 0) !== 0) return false;
  if (!kn.progamer) return false;
  if (kn.turnsafternohit !== NH_ARM_TURNS) return false;
  setScene(state, 'nh', 1);
  hijackTurn(state);
  return true;
}

/**
 * THE WHOLE `with (obj_knight_enemy)` BLOCK — scr_mnendturn:148-169.
 *
 *     if (k_sideb && !practicemode) { <tp arm>  <nh arm> }
 *
 * In source order, and both can fire on the same call: nothing in the tp arm
 * makes the nh arm's guard false. Practice mode suppresses both, which is the
 * §1.3 claim in WEIRD-ROUTE.md read at its source.
 *
 * @returns {{tp:boolean, nh:boolean}}
 */
export function scrMnendturnScenes(state) {
  ensureScenes(state);
  const kn = state.knight ?? {};
  if (!state.kaizo.sideb || kn.practicemode) return { tp: false, nh: false };
  const tp = armTpscene(state);
  const nh = armNhscene(state);
  return { tp, nh };
}

// ───────────────────────────────────────────────────────────────────────────
// k_hpscene — Step_0:54-63 (THE ARM) and 1771-1929 (THE SCENE).
// THE MAX-HP SHEAR: the fourth scene, and the only one an A-Side run reaches.
// ───────────────────────────────────────────────────────────────────────────

/**
 * `obj_marker` — the game's generic one-shot sprite stamp.
 *
 * IT HAS NO CODE ENTRIES ANYWHERE IN THE DUMP (a whole-dump listing of
 * `gml_Object_obj_marker_*` returns only the derived `_jitter` / `_wobble` /
 * `_animateOnce` / `_blendmode` / `_palette` variants), so it is inert: nothing
 * steps it, nothing draws itself with RNG in it, and creating one consumes no
 * draws. sim/attacks/splitslash.js reached the same conclusion for the slash's
 * marker and its `slashMarker` says so at length; this is the same object,
 * declared here because a scene must not import an attack's internals.
 */
export const sceneMarker = { name: 'obj_marker' };

/**
 * `scr_marker(x, y, sprite)` — gml_GlobalScript_scr_marker.gml, whole:
 *
 *     thismarker = instance_create(arg0, arg1, obj_marker);
 *     with (thismarker) { sprite_index = arg2; image_speed = 0; }
 *     return thismarker;
 *
 * NOT `scr_dark_marker`, which is the same script plus `image_xscale = 2;
 * image_yscale = 2` (sim/attacks/splitslash.js's scrDarkMarker). k_hpscene
 * sets its own scales, so taking the doubling one would put the slash mark at
 * 240 x 22 instead of 120 x 11.
 */
export function scrMarker(state, x, y, sprite) {
  const m = spawn(state, sceneMarker, { x, y });
  m.sprite_index = sprite;
  m.image_speed = 0;
  return m;
}

/**
 * `obj_shakeobj` — gml_Object_obj_shakeobj_{Create_0,Other_10,Step_0}.gml.
 *
 * NOT obj_shake. obj_shake moves the CAMERA; this one grabs a single instance
 * by `target` and walks its `x` back and forth around the position it held when
 * the shake started, decaying by `shakereduct` per Step and destroying itself
 * when the amplitude reaches zero. With scr_minishakeobj's 4/1 that is exactly
 * four Steps: -3, +2, -1, 0.
 *
 * Create's `if (global.darkzone == 0) { shakeamt = 5; shakereduct = 1; }` is
 * the light-world softening and is dead here twice over — the fight is in the
 * dark world, and scr_minishakeobj overwrites both fields immediately after
 * the create either way. The Create defaults are kept anyway so a future
 * caller that does NOT overwrite them gets the right ones.
 *
 * `shakespeed` is set by scr_minishakeobj and read by NOTHING in this object
 * (obj_shakeobj_ext and obj_shakeobj_susiezilla are the ones with a `timer`).
 * Carried, not used — recording it is cheaper than re-reading three files to
 * find out it does nothing.
 */
export const shakeObjTarget = {
  name: 'obj_shakeobj',
  create(e) {
    e.visible = false;
    e.active = 0;
    e.target = null;
    e.shakeamt = 10;
    e.shakereduct = 2;
    e.shakespeed = 1;
    e.nowx = 0;
    e.nowy = 0;
    e.on = 1;
    e.timer = 0;
  },
  step(e, state) {
    // Step_0:1-4. Two separate `if`s in the original, not an else — but the
    // destroy in the first makes the second's `active == 1` false anyway.
    if (e.active === 0) { destroy(e); return; }
    if (e.active === 1) {
      if (!e.target || !e.target.alive) { destroy(e); return; }
      e.shakeamt -= e.shakereduct;
      e.on *= -1;
      e.target.x = e.nowx + (e.shakeamt * e.on);
      if (e.shakeamt <= 0) destroy(e);
    }
  },
};

/**
 * `scr_minishakeobj()` — gml_GlobalScript_scr_minishakeobj.gml, whole:
 *
 *     shakeobj = instance_create(x, y, obj_shakeobj);
 *     shakeobj.target = id;  shakeobj.shakeamt = 4;  shakeobj.shakereduct = 1;
 *     with (shakeobj) { event_user(0); }
 *
 * `event_user(0)` is Other_10 and it runs IMMEDIATELY, inside the caller's
 * Step — it latches `nowx = target.x` and flips `active` to 1. So the anchor
 * is wherever the target stands at the call, which for k_hpscene state 2 is
 * AFTER the `x += 26` two lines above it (Step_0:1791 then :1796).
 *
 * Shared, not private: any kaizo site that hits scr_minishakeobj can import it
 * from here. It lives in this module because k_hpscene is its only caller in
 * the knight's own code today; if a second family of callers appears it should
 * move to a shared kaizo module rather than be copied.
 *
 * @returns {object|null} the shakeobj, or null when the target is gone.
 */
/**
 * The party actor standing in `slot` — `charinstance[slot]`, which the GML
 * names directly (`obj_heronoelle`) and this engine keeps as a spawned actor
 * carrying its slot. Returns null for an empty slot or before the actors
 * exist, and every caller here treats that as "shake nobody", which is what
 * `with (obj_heronoelle)` does when the instance is absent.
 */
function heroActorAt(state, slot) {
  return (state.entities ?? []).find(
    (e) => e.alive && e.type === partyActor && e.slot === slot,
  ) ?? null;
}

export function scrMinishakeobj(state, target) {
  if (!target || !target.alive) return null;
  const sh = spawn(state, shakeObjTarget, { x: target.x, y: target.y });
  sh.target = target;
  sh.shakeamt = 4;
  sh.shakereduct = 1;
  // event_user(0) — Other_10, right here in the caller's frame.
  sh.active = 1;
  sh.nowx = target.x;
  sh.nowy = target.y;
  ensureScenes(state).hp.minishakes += 1;
  return sh;
}

/**
 * `global.maxhp[charId]` for the shear — a READ that has to work on both
 * routes, which is why it is not simply roster.js's maxhpOfChar.
 *
 * The mod keeps one array; this engine keeps the same number in up to three
 * places and roster.js's reader only knows one of them:
 *   - `state.partyMaxhp` — the SLOT-indexed mirror kaizo/scenes/kaizo-fight.js
 *     builds for a roster version, and the array sim/damage.js's hpaverage and
 *     render/menu.js's charbox already read;
 *   - the roster member's own `maxhp`, which kaizo/party/damage.js reads
 *     through maxhpOfChar for every ratio in the targeting tree;
 *   - sim/damage.js's PARTY constants, which are all a NON-roster version
 *     (V-C, the Normal Route) has.
 * Preferring partyMaxhp first is what makes the cut visible on V-C at all:
 * maxhpOfChar returns 0 there, because V-C installs no roster.
 */
function hpsceneMaxhp(state, charId) {
  const slot = slotOf(state, charId);
  if (slot < 0) return 0;
  const arr = state.partyMaxhp;
  if (Array.isArray(arr) && typeof arr[slot] === 'number') return arr[slot];
  const m = memberAt(state, slot);
  if (m && typeof m.maxhp === 'number') return m.maxhp;
  return SIM_PARTY[slot]?.maxhp ?? 0;
}

/** `global.hp[charId]`, same two-route read. `state.partyHp` is slot-indexed. */
function hpsceneHp(state, charId) {
  const slot = slotOf(state, charId);
  if (slot < 0) return 0;
  return state.partyHp?.[slot] ?? 0;
}

/**
 * `global.maxhp[charId] = value` — Step_0:1871-1874.
 *
 * Writes every mirror named above that IS a variable, because a cut that lands
 * in one of them and not the others is the same defect as the four
 * `idlesprite` writes that landed on the wrong object: computed correctly,
 * read never. A V-C run has no `state.partyMaxhp` until this materialises one
 * from the values the fight is actually using, which is the honest shape —
 * `global.maxhp` exists in the game before the Knight ever touches it.
 *
 * THE THIRD MIRROR IS A CONSTANT AND THIS CANNOT REACH IT — recorded here
 * rather than claimed away, because an earlier note in this lane said the
 * shear "reaches every mirror this engine keeps the number in" and that is
 * false. sim/damage.js's `PARTY` table is a frozen transcription of
 * scr_gamestart's chapter-3 block (Kris 160 / Susie 190 / Ralsei 140), and
 * three sites read `PARTY[target].maxhp` DIRECTLY rather than through
 * `state.partyMaxhp`: scr_damage_maxhp's `ceil(maxhp * fraction)`
 * (sim/damage.js:732 — Flurry's 0.66 slash), scr_damage's defence step ladder
 * (:161) and Kris's `round(-maxhp / 2)` down value (:572, :788).
 *
 * WHY IT IS NOT PATCHED HERE. `PARTY` is a module-level `const` array shared
 * by every state in the process; writing through it from a scene would poison
 * the vanilla suites and every other fight built in the same run, and sim/ is
 * vendored (CLAUDE.md law 6) so the read sites cannot be changed from this
 * repo either.
 *
 * WHY IT DOES NOT CHANGE WHAT THIS SCENE DOES. The disagreement is owned by
 * the OVERLEVELLED-IMPORT path, not by the shear: a party at 300 already
 * disagrees with `PARTY`'s 160 before the Knight's first Step, and the shear
 * moves `state.partyMaxhp` back TOWARD those constants (300 -> 200), never
 * away. Every number this scene's own check measures — the cut, the hp clamp,
 * maxhpOfChar, the slot mirror — comes from the two mirrors written here.
 * What a live V-C fight would still get wrong afterwards is scr_damage_maxhp
 * choosing 0.66 * 160 where the mod would take 0.66 * 200, and that is an
 * import-path fault to fix where the import lands, with its own gate.
 */
function hpsceneSetMaxhp(state, charId, value) {
  const slot = slotOf(state, charId);
  if (slot < 0) return;
  if (!Array.isArray(state.partyMaxhp)) {
    state.partyMaxhp = [0, 1, 2].map((s) => hpsceneMaxhp(state, charIdOf(state, s)));
  }
  state.partyMaxhp[slot] = value;
  const m = memberAt(state, slot);
  if (m) m.maxhp = value;
}

/** `global.hp[charId] = value`. */
function hpsceneSetHp(state, charId, value) {
  const slot = slotOf(state, charId);
  if (slot < 0 || !state.partyHp) return;
  state.partyHp[slot] = value;
}

/**
 * THE ARM — obj_knight_enemy Step_0:54-63, inside `if (damagereductiontimer
 * == 1)`, i.e. THE KNIGHT'S FIRST STEP OF THE FIGHT:
 *
 *     if (!practicemode && !nohitmode)
 *     {
 *         if ((global.maxhp[1] > 200 && scr_havechar(1)) || (global.maxhp[2] > 230 && scr_havechar(2))
 *          || (global.maxhp[3] > 180 && scr_havechar(3)) || (global.maxhp[4] > 180 && scr_havechar(4)))
 *             k_hpscene = 1;
 *         if ((global.hp[1] > 200 && scr_havechar(1)) || ... )
 *             k_hpscene = 1;
 *     }
 *
 * THREE THINGS THIS IS NOT:
 *   1. NOT `k_sideb` gated. The two `if`s sit at :54, outside the `if (k_sideb)`
 *      block that closes at :53 — so this fires on the Normal Route too, and
 *      k_hpscene is the reason the scene block's own gate at :1771 reads
 *      `k_sideb || k_hpscene > 0` rather than `k_sideb`.
 *   2. NOT at a turn end. scr_mnendturn arms the other two; this one arms on
 *      the knight's first Step, before the opening menu has ever been drawn.
 *   3. NOT one test. They are two separate `if`s over two different arrays and
 *      either can arm alone — an overlevelled save whose CURRENT hp has been
 *      spent below the ceilings still trips the first, and a save whose maxhp
 *      is legal but whose hp was pushed past it by an item trips only the
 *      second. Both are evaluated (`sc.hp.armedBy` records which fired).
 *
 * `scr_havechar(c)` is roster.js's havechar: it walks `global.char[0..2]`, so
 * a character who is not in this fight cannot arm the scene with a stale save
 * value.
 *
 * @returns {boolean} whether the scene armed.
 */
export function armHpscene(state) {
  const kn = state.knight ?? {};
  // :54 — practice and no-hit mode both suppress it whole.
  if (kn.practicemode || kn.nohitmode) return false;

  const over = (read) => {
    for (let c = 1; c <= 4; c++) {
      if (read(state, c) > HP_CEILINGS[c] && havechar(state, c)) return c;
    }
    return 0;
  };
  // Source order: the maxhp test at :56, then the hp test at :60. Both run.
  const byMaxhp = over(hpsceneMaxhp);
  const byHp = over(hpsceneHp);
  if (!byMaxhp && !byHp) return false;

  // Only NOW does the scene state exist. A Normal Route fight whose party is
  // under every ceiling must leave `state.kaizo.scenes` untouched — the same
  // discipline kaizo-practice.js applies to the B-Side driver, and what keeps
  // the A-Side byte gate from seeing this lane at all.
  const sc = ensureScenes(state);
  setScene(state, 'hp', 1);
  sc.hp.armedBy = { maxhp: byMaxhp || null, hp: byHp || null };
  return true;
}

/**
 * The state table, as data. `wait` is the value the branch parks on; `delay`
 * is the `scr_delay_var(value, frames)` it arms.
 *
 * STATE 5 IS THE ODD ONE OUT AND IT IS THE MOD'S BUG, NOT A TYPO HERE: its
 * `wait` is 5, because Step_0:1849 writes `hp_scene = 5.1` — a variable with
 * no `k_` and no reader in the whole dump. See THE PRESERVED BUG in this
 * file's header for what that does to the rest of the ladder.
 */
export const HP_SCENE_STATES = [
  { at: 1, wait: 1.1, delay: [2, 20], draws: 0 },
  { at: 2, wait: 2.1, delay: [3, 16], draws: 0 },
  { at: 3, wait: 3.1, delay: [4, 13], draws: 1 },
  { at: 4, wait: 4.1, delay: [5, 9], draws: 0 },
  { at: 5, wait: 5, delay: [6, 2], draws: 0, bug: 'hp_scene = 5.1' },
  { at: 6, wait: 6.1, delay: [7, 20], draws: 0 },
  { at: 7, wait: 7.1, delay: [7.2, 12], draws: 0 },
  { at: 7.2, wait: 7.1, delay: [8, 14], draws: 0 },
  { at: 8, wait: -1, delay: null, draws: 0 },
];

/** The state that actually shears the party's max HP — Step_0:1869-1881. */
export const HP_CUT_AT = 6;

/**
 * `obj_battlecontroller.depth`, which NO GREP OF THE CODE DUMP CAN FIND.
 *
 * The runtime depth lives in the OBJECT DEFINITION (`__global_object_depths`),
 * not in any event, and the dumped object CSV
 * (knight-research/kaizo-mod/sprites/objects_kaizo.csv:1395) carries a stale 0
 * for it — the same hole RENDER-CRITIC §4 records for obj_growtangle and
 * obj_heart, whose CSV zeroes are really 5 and 1. sim/attacks/splitslash.js's
 * `boxDepth()` set the precedent: fall back to 0, which keeps the RELATIVE
 * order the code states (`- 10` in front of the controller, the mark `+ 5`
 * behind the knight) — the part the dump does give us — and label it.
 *
 * Overridable on `state.kaizo.battlecontrollerDepth` for the day a recording
 * measures it, exactly as `state.kaizo.tensionbarDepth` is for k_tpscene.
 */
function battlecontrollerDepth(state) {
  return state.kaizo?.battlecontrollerDepth ?? 0;
}

/** GameMaker's `c_white`, as this engine's RGB triple. */
const C_WHITE = [255, 255, 255];

// obj_tensionbar's depth. NOT MEASURED: the object assigns none in any event,
// so it lives on the object definition, which the CodeEntries dump does not
// carry. Declared stand-in; override on `state.kaizo.tensionbarDepth`.
const TENSIONBAR_DEPTH_STANDIN = 0;

/**
 * One frame of the max-HP shear. Everything below is Step_0:1771-1929 in
 * order; `var _l = 2` (:1773) is the ease curve for every knight-scope lerp,
 * the same constant k_tpscene uses.
 */
export function stepHpscene(state) {
  const k = state.kaizo;
  const s = k.hpscene ?? 0;
  if (s <= 0) return false;
  const sc = ensureScenes(state);
  const kt = sc.knight;
  const vx = state.view?.x ?? 0;
  const vy = state.view?.y ?? 0;

  // :1776 — re-asserted on EVERY frame the scene is up, the way k_nhscene does
  // at :1412. Not a one-shot at the arm: nothing else in the fight can clear it
  // while this is running.
  k.specialCon = 1;
  // POSITIVE EXECUTION (CLAUDE.md rule 5): without a per-state run count, "the
  // ladder advanced" and "the ladder advanced and state 6 ran twice" are the
  // same observation from outside — and here they are the difference between
  // the mod's behaviour and a silently fixed bug.
  sc.hp.runs[s] = (sc.hp.runs[s] ?? 0) + 1;

  if (s === 1) {
    // :1777-1788.
    kt.sceneFloat = 1;
    k.charturn = -1;
    k.mnfight = 99;
    k.myfight = 99;
    kt.knightState = 10;
    // `sprite_index = idlesprite` — the knight's CURRENT idle, not the
    // literal: after the B-Side full-no-hit reward that is
    // spr_roaringknight_idle2 (kaizo/actors/kaizo-knight-actor.js's
    // kaizoIdlesprite is the one reader, and it looks at the instance).
    kt.spriteIndex = sc.live?.idlesprite ?? 'spr_roaringknight_idle';
    kt.y = kt.ystart + Math.cos(kt.siner2 / 8) * 8;
    setScene(state, 'hp', 1.1);
    scrDelayVar(state, 'hp', 2, 20);
  } else if (s === 2) {
    // :1789-1798. THE PUFF: he hops up and right and shudders in place.
    kt.x += 26;
    // `y += -44` (:1792) IS DEAD, IN THE MOD TOO, and is kept only so a reader
    // diffing this against the dump does not go looking for the line. State 1
    // set `k_scenefloat = 1` and `state = 10`, so the float tail at :2050-2052
    // — floatKnight(), the last thing this function does every frame —
    // recomputes `y` from `ystart + k_yoff + cos(siner2 / 8) * 8` before
    // anything can read it. MEASURED, not assumed: with this line deleted the
    // knight's y is identical on every frame of the scene, which is why
    // check-hpscene's kinematic block asserts `k_yoff` and the float FORMULA
    // rather than this assignment. It is `k_yoff` on the next line that
    // actually lifts him 44 pixels.
    kt.y += -44;
    kt.yoff = -44;
    kt.spriteIndex = 'spr_roaringknight_flurry_prepare';
    cue(state, 'snd_knight_puff');
    // scr_minishakeobj() AFTER the `x += 26`, so the shake anchors on the new
    // position — see scrMinishakeobj's header.
    if (sc.live?.alive) scrMinishakeobj(state, sc.live);
    setScene(state, 'hp', 2.1);
    scrDelayVar(state, 'hp', 3, 16);
  } else if (s === 3) {
    // :1800-1837. THE WIND-UP, and the scene's one RNG draw.
    kt.sceneFloat = 0;
    // snd_play(snd, VOLUME, PITCH) — gml_GlobalScript_snd_play.gml:1
    // `function snd_play(arg0, arg1 = 1, arg2 = 1)` with arg1 -> snd_volume
    // and arg2 -> snd_pitch. cue()'s order is (pitch, gain), so the two swap.
    cue(state, 'snd_knight_beam', 0.1, 0.75);
    kt.remdepth = kt.depth;
    kt.depth = battlecontrollerDepth(state) - 10;
    reparentAfterimages(state, kt.depth);

    // hpslash_mark = scr_marker(camerax() + 320, cameray() + 339,
    //                           spr_roaringknight_finalslash_mask);
    // A 120 x 11 sliver across the middle of the screen, tilted, that widens
    // into the cut. THE ORDER OF THE SIX FIELD WRITES IS THE GML'S, because
    // the image_angle lerp two lines later reads image_angle back.
    const mark = state.entities ? scrMarker(
      state, vx + 320, vy + 339, 'spr_roaringknight_finalslash_mask',
    ) : null;
    // choose(20, -20) — ONE u32 (sim/rng.js: choose = 1 draw). It is a real
    // RNG draw inside a Step, so it moves the stream and is counted.
    // THE LIST ORDER IS THE GML'S, and it is load-bearing: `choose` picks
    // `values[u32 % argc]`, so [-20, 20] would draw the same u32 and hand back
    // the other answer — invisibly to any count audit (CLAUDE.md, "Measured
    // facts you will need").
    const angle = state.gmlRng ? gmlChoose(state.gmlRng, [20, -20]) : 20;
    draw(state, 'hp', 1);
    if (mark) {
      mark.image_xscale = 120;
      mark.image_yscale = 11;
      mark.image_alpha = 0;
      mark.image_angle = angle;
      // get_swordcolor() — kaizo/attacks/kaizo-colors.js, the ONE copy of the
      // mod's palette. Reads global.kaizo_swordtype off state.kaizo.swordtype.
      mark.image_blend = getSwordcolor(state);
      mark.depth = kt.depth + 5;
      // with (hpslash_mark) { four scr_lerpvar } — the target is the MARK, not
      // the knight, so these do not go through noteLerp's `knight: true` arm.
      // The third takes scr_lerpvar's four-argument form (argument_count < 6),
      // which leaves obj_lerpvar's Create defaults: easetype 0, linear.
      scrLerpvar(state, spawn, mark, 'y', vy + 350, vy + 339, 19, L, 'inout');
      scrLerpvar(state, spawn, mark, 'image_angle', mark.image_angle, 0, 21, L, 'inout');
      scrLerpvar(state, spawn, mark, 'image_alpha', -0.15, 0.75, 19);
      scrLerpvar(state, spawn, mark, 'image_yscale', 11, 0.5, 21, L, 'inout');
    }
    sc.hp.mark = mark;
    // :1827 repeats `depth = obj_battlecontroller.depth - 10` verbatim, after
    // the `with`. Redundant in the original (nothing between the two writes
    // touches the knight's depth) and kept so a reader diffing this against
    // the dump does not go looking for the line.
    kt.depth = battlecontrollerDepth(state) - 10;
    kt.x -= 12;
    kt.y += 44;
    kt.spriteIndex = 'spr_roaringknight_attack_ol';
    kt.imageSpeed = 0;
    kt.imageIndex = 1;
    setScene(state, 'hp', 3.1);
    scrDelayVar(state, 'hp', 4, 13);
    // The dive: 30 right and 120 DOWN over 19 frames, curve 2 in-out.
    noteLerp(state, 'x', kt.x, kt.x + 30, 19, kl('inout'));
    noteLerp(state, 'y', kt.y, kt.y + 120, 19, kl('inout'));
  } else if (s === 4) {
    // :1838-1843.
    kt.imageIndex = 2;
    setScene(state, 'hp', 4.1);
    scrDelayVar(state, 'hp', 5, 9);
  } else if (s === 5) {
    // :1844-1868. THE CUT ITSELF — and THE BUG (see the file header).
    cueStop(state, 'snd_knight_beam');
    // snd_play(snd_knight_cut, 0.8)      -> volume 0.8, pitch 1 (default)
    // snd_play(snd_knight_cut, 0.6, 0.5) -> volume 0.6, pitch 0.5
    cue(state, 'snd_knight_cut', 1, 0.8);
    cue(state, 'snd_knight_cut', 0.5, 0.6);
    // ── Step_0:1849: `hp_scene = 5.1;` — NO `k_`. ────────────────────────
    // Preserved, not fixed. `hp_scene` appears exactly once in the whole kaizo
    // dump (that write) and has no reader anywhere, so it creates a dead
    // instance variable and `k_hpscene` STAYS 5 — which is why this branch
    // runs on both frames of the two-frame delay below, and why every state
    // from 6 on runs twice. CLAUDE.md law 4: nothing invented ships
    // unlabelled, and a bug quietly repaired is invention.
    sc.hp.hpSceneTypo += 1;
    kt.imageIndex = 3;
    // Four arguments -> linear (obj_lerpvar's easetype 0 default).
    noteLerp(state, 'image_index', 3, 5, 2, { knight: true });
    scrDelayVar(state, 'hp', 6, 2);
    // `inst = instance_create(x, y, obj_shake); shakex = 10; shakespeed = 1`
    // — TEN, where k_tpscene's is 8 (:2003).
    //
    // It is unguarded, unlike scr_damage's `if (!i_ex(obj_shake))`, so the
    // `hp_scene` typo above really does run this line on two consecutive
    // frames — but the SECOND SHAKE NEVER STARTS. obj_shake's own Create
    // carries `instance_number(object_index) >= 2` counting itself, so the
    // newcomer sets `active = -1` and destroys itself while the running shake
    // continues undisturbed (sim/shake.js:74-80). The screen shakes once, at
    // 10, for its normal length. An earlier draft of this comment said the two
    // frames stack two shakes; they do not, and the guard is in the object
    // rather than at the call site, which is why the call reads as if they
    // would.
    scrShakescreen(state, { shakex: 10, shakespeed: 1 });
    // with (hpslash_mark) — the flash-out: white, opaque, unrotated, then
    // faded from 1.5 (past opaque, so it holds solid for a third of the ramp)
    // while it stretches from 1 to 10 tall over 8 frames.
    const mark = sc.hp.mark;
    if (mark?.alive) {
      mark.image_blend = C_WHITE;
      mark.image_alpha = 1;
      mark.image_yscale = 1;
      mark.image_angle = 0;
      scrLerpvar(state, spawn, mark, 'image_alpha', 1.5, 0, 8);
      scrLerpvar(state, spawn, mark, 'image_yscale', 1, 10, 8);
    }
  } else if (s === 6) {
    // :1869-1881. THE MECHANIC, and the whole reason the scene exists.
    //
    //     global.maxhp[1] = min(global.maxhp[1], 200);   ... 2/230, 3/180, 4/180
    //     global.hp[1]    = min(global.hp[1], global.maxhp[1]);   ... and 2, 3, 4
    //
    // CHARACTER-indexed, all four. THE GML HAS NO havechar GUARD and writes
    // all four cells; THIS CODE SKIPS THE ONES WITH NO SLOT, and the two agree
    // on every observable — which is the only reason the difference is
    // allowed to stand. `global.maxhp` is a four-cell array in the mod, so an
    // absent character's cell is a real address there; this engine keeps the
    // number SLOT-indexed (state.partyMaxhp, and the roster member's own
    // `maxhp`), so a character outside `global.char` has no cell to write —
    // hpsceneSetMaxhp/hpsceneSetHp would return early on `slot < 0` even
    // without the guard. The guard is here so `sc.hp.cut` records only the
    // characters that were really in the fight, which is what makes
    // "Susie and Ralsei, absent from global.char, are not written" assertable
    // on V-D. An earlier version of this comment claimed the code wrote every
    // cell "as the GML has it"; it never did.
    //
    // The hp clamp reads the max BACK, so it uses the value just written.
    const cut = { maxhp: {}, hp: {} };
    for (let c = 1; c <= 4; c++) {
      const before = hpsceneMaxhp(state, c);
      const after = Math.min(before, HP_CEILINGS[c]);
      if (slotOf(state, c) >= 0) {
        hpsceneSetMaxhp(state, c, after);
        cut.maxhp[c] = { before, after };
      }
    }
    for (let c = 1; c <= 4; c++) {
      if (slotOf(state, c) < 0) continue;
      const before = hpsceneHp(state, c);
      const after = Math.min(before, hpsceneMaxhp(state, c));
      hpsceneSetHp(state, c, after);
      cut.hp[c] = { before, after };
    }
    // The SECOND run (the bug) must not overwrite the receipt of the first —
    // by then every `before` already equals its `after` and the record would
    // read as "the scene cut nothing".
    if (!sc.hp.cut) sc.hp.cut = cut;
    setScene(state, 'hp', 6.1);
    scrDelayVar(state, 'hp', 7, 20);
  } else if (s === 7) {
    // :1882-1889. The glide home. `siner2 = 0` FIRST and the y target reads it
    // back, so he aims at the TOP of the bob (`ystart + cos(0) * 8`) rather
    // than wherever the bob happened to be — the same ordering k_tpscene's
    // state 11 has at :2017-2021.
    kt.siner2 = 0;
    setScene(state, 'hp', 7.1);
    scrDelayVar(state, 'hp', 7.2, 12);
    noteLerp(state, 'x', kt.x, kt.xstart, 25, kl('inout'));
    noteLerp(state, 'y', kt.y, kt.ystart + Math.cos(kt.siner2 / 8) * 8, 25, kl('inout'));
  } else if (s === 7.2) {
    // :1890-1903. Back to his own depth, trail with him, idle pose.
    kt.depth = kt.remdepth;
    reparentAfterimages(state, kt.depth);
    kt.spriteIndex = 'spr_roaringknight_idle';
    setScene(state, 'hp', 7.1);
    scrDelayVar(state, 'hp', 8, 14);
  } else if (s === 8) {
    // :1904-1928. THE HAND-BACK — the only one of the four scenes that has to
    // build a turn rather than return to one, because it fires before the
    // opening menu has ever existed.
    kt.sceneFloat = 1;
    msg(state, '\\ck* Not so fast.');
    kt.siner2 = 0;
    // `global.mnfight = 0` (:1909) — the command phase. THIS IS NOT A PIN
    // (CLAUDE.md law 2): it is the mod's own write, and the ONLY reader of
    // `state.kaizo.mnfight` in this repo is gloom.js's scrIsphaseBullets
    // (`global.mnfight == 2`), whose live callers all pass their own `bullets`
    // instead. What WAS wrong is that nothing ever wrote the key again, so a
    // fallback reader was left with a stale 0 for the rest of the fight —
    // gloom that glows and never drains. The turn loop now owns the mirror
    // from the frame special_con drops (kaizo/scenes/kaizo-practice.js, the
    // `state.kaizo.mnfight` refresh directly under the scene gate; the gate is
    // obj_battlecontroller's own `special_con > 0 -> exit`, so the controller
    // cannot touch mnfight while a scene runs, exactly as here). This write is
    // the last word for one frame only, which is what the GML does too.
    k.mnfight = 0;
    k.myfight = 0;
    // THE INDEX BASE IS THE TRAP, and it is the mod's, not this translation's:
    //
    //     if (global.hp[1] > 0)      global.charturn = 0;
    //     else if (global.hp[2] > 0) global.charturn = 1;
    //     else                       global.charturn = 2;
    //
    // `global.hp` is CHARACTER-indexed (1 Kris, 2 Susie, 3 Ralsei, 4 Noelle)
    // and `global.charturn` is SLOT-indexed. The two agree only for the
    // vanilla trio [1, 2, 3]. On the Weird Route `global.char` is [1, 4, 0], so
    // the second test reads SUSIE's hp for a Susie who is not in the fight —
    // a save value, not a battle one — and the final `else` hands the turn to
    // slot 2, which on that route is nobody. Faithful, and flagged: the same
    // wire-crossing roster.js's header records for scr_charbox's k_gloom.
    //
    // WHERE IT GOES. `state.kaizo.charturn` is this module's mirror of the
    // five hijack globals (SCENE_HIJACK_KEYS) and HAS NO READER — writing only
    // there is the same defect this lane found and fixed for k_nhscene's four
    // down-message latches: computed correctly, read never. This engine keeps
    // `global.charturn` on `state.menu.charturn`: sim/menu.js is its writer
    // (openMenu, scrNexthero, scrPrevhero, skipFallen), render/menu.js raises
    // that character's panel, and sim/actors.js aims the ACT/target picker
    // through `bmenucoord[...][charturn]`. So the pick is written THERE as
    // well, and `sc.hp.handback` carries it for the turn loop.
    if (hpsceneHp(state, 1) > 0) k.charturn = 0;
    else if (hpsceneHp(state, 2) > 0) k.charturn = 1;
    else k.charturn = 2;
    if (state.menu) state.menu.charturn = k.charturn;
    // `applied` is for the turn loop, not the mod: this scene runs INSIDE the
    // knight's Step, and this engine's director opens the fight's first menu
    // later in the SAME frame — openMenu re-seeds `charturn` to 0 the way
    // scr_mnendturn does at a turn end. The hand-back is the one menu the game
    // does NOT reach through scr_mnendturn (nothing has ended a turn yet), so
    // the director re-applies this pick once, right after openMenu, through
    // applySceneHandbackCharturn below. The bug's second run re-arms it and
    // rewrites `state.menu.charturn` a frame later, which is what the mod does.
    sc.hp.handback = { frame: state.frame, charturn: k.charturn, applied: false };
    setScene(state, 'hp', -1);
    k.specialCon = 0;
    kt.knightState = 0;
    kt.yoff = 0;
    // instance_destroy(hpslash_mark) — a no-op on the bug's second run.
    if (sc.hp.mark?.alive) destroy(sc.hp.mark);
    sc.hp.mark = null;
  }

  // `if (state == 10 && k_scenefloat) y = ystart + k_yoff + cos(siner2/8)*8`
  // — Step_0:2050-2052, the tail of the whole `k_sideb || k_hpscene > 0`
  // block. It sits after the k_tpscene block in the original, so on the one
  // arrangement where both scenes could be up at once the tp branch would win;
  // they cannot be (this one arms on the knight's first Step and is finished
  // long before atk_Frenzy1 ends a turn), and the write is an idempotent
  // recompute from siner2/k_yoff either way, so calling it from both is the
  // same value twice.
  floatKnight(state);
  return true;
}

/**
 * THE HAND-BACK'S `global.charturn`, APPLIED WHERE THE TURN CAN SEE IT.
 *
 * k_hpscene state 8 (:1911-1922) picks the first living member and assigns
 * `global.charturn`. In the mod that is the whole job: the fight's first menu
 * has never been opened, so obj_battlecontroller reads the value the Knight
 * just wrote. In THIS engine the director opens that menu through
 * sim/menu.js's `openMenu`, which is scr_mnendturn's reset as well as the
 * open, and its `menu.charturn = 0` runs later in the same frame — so the
 * scene's pick has to be re-applied once, after the open. That is this.
 *
 * ONE-SHOT, and the receipt says so: `handback.applied` flips on the first
 * call, so a later turn's openMenu (which the game really does reach through
 * scr_mnendturn, and which really does start at slot 0) is left alone. It is
 * not a pin — nothing re-asserts it per frame.
 *
 * Reads `state.kaizo.scenes` DIRECTLY and never calls ensureScenes: a V-C run
 * whose party is under every ceiling must not have the scene state stood up
 * behind its back, which is what keeps the A-Side byte gate from seeing this
 * lane at all.
 *
 * @returns {number|null} the slot applied, or null when there was nothing to
 *   apply (no scene, no hand-back yet, or already applied).
 */
export function applySceneHandbackCharturn(state) {
  const hb = state.kaizo?.scenes?.hp?.handback;
  if (!hb || hb.applied) return null;
  hb.applied = true;
  if (state.menu) state.menu.charturn = hb.charturn;
  return hb.charturn;
}

// ───────────────────────────────────────────────────────────────────────────
// k_tpscene — Step_0:1930-2049. THE BAR SLICE.
// ───────────────────────────────────────────────────────────────────────────

/**
 * The state table, as data, so a check can walk it without re-reading the GML.
 * `wait` is the value the branch parks on; `delay` is `[value, frames]`.
 */
export const TP_SCENE_STATES = [
  { at: 1, wait: 1.1, delay: [2, 8], draws: 0 },
  { at: 2, wait: 2.1, delay: [3, 8], draws: 0 },
  { at: 3, wait: 3.1, delay: [4, 7], draws: 0 },
  { at: 4, wait: 4.1, delay: [5, 1], draws: 0 },
  { at: 5, wait: 10, delay: [11, 24], draws: 3 },
  { at: 11, wait: 11.1, delay: [11.2, 12], draws: 0 },
  { at: 11.2, wait: 11.1, delay: [12, 14], draws: 0 },
  { at: 12, wait: -1, delay: null, draws: 0 },
];

/** The state whose assignment opens tensionbar.js's `k_tpscene >= 10` gate. */
export const TP_CLAMP_ARMED_AT = 5;

/**
 * One frame of the tp scene. Everything below is Step_0:1930-2049 in order;
 * `var _l = 2` (:1773) is the lerp curve and is visual.
 */
export function stepTpscene(state) {
  const k = state.kaizo;
  const s = k.tpscene ?? 0;
  if (s <= 0) return false;
  const sc = ensureScenes(state);
  const kt = sc.knight;

  if (s === 1) {
    cue(state, 'snd_knight_jump_quick');
    k.charturn = -1;
    k.mnfight = 99;
    k.myfight = 99;
    kt.knightState = 10;
    kt.sceneFloat = 0;
    setScene(state, 'tp', 1.1);
    kt.spriteIndex = 'spr_roaringknight_attack_ol';
    kt.imageSpeed = 0;
    kt.imageIndex = 0;
    scrDelayVar(state, 'tp', 2, 8);
    noteLerp(state, 'x', kt.x, kt.x + 32, 8, kl('inout'));
    noteLerp(state, 'y', kt.y, kt.y - 40, 8, kl('inout'));
  } else if (s === 2) {
    setScene(state, 'tp', 2.1);
    kt.imageIndex = 1;
    scrDelayVar(state, 'tp', 3, 8);
    // camerax() + 320 / cameray() + 24 — the leap to the top of the screen.
    const vx = state.view?.x ?? 0;
    const vy = state.view?.y ?? 0;
    noteLerp(state, 'x', kt.x, vx + 320, 8, kl('in'));
    noteLerp(state, 'y', kt.y, vy + 24, 8, kl('in'));
  } else if (s === 3) {
    setScene(state, 'tp', 3.1);
    kt.imageIndex = 2;
    scrDelayVar(state, 'tp', 4, 7);
    const vx = state.view?.x ?? 0;
    const vy = state.view?.y ?? 0;
    noteLerp(state, 'x', kt.x, vx + 48, 7, kl('out'));
    noteLerp(state, 'y', kt.y, vy + 64, 7, kl('out'));
  } else if (s === 4) {
    // remdepth = depth; depth = obj_tensionbar.depth - 1; then the
    // afterimage depth juggle (Step_0:1967-1973). He goes IN FRONT of the TP
    // bar for the cut and the trail follows him there.
    kt.remdepth = kt.depth;
    // TENSIONBAR_DEPTH IS A DECLARED STAND-IN, not a measurement.
    // obj_tensionbar assigns no depth in any event, so its real one lives on
    // the object definition — CLAUDE.md's `depth` hole, which the CodeEntries
    // dump does not carry. 0 is the stand-in; a recording can override it on
    // `state.kaizo.tensionbarDepth`, the same seam battlecontrollerDepth has.
    // What actually decides the beat is not this number: the engine paints its
    // bar in screen space after every entity, so the ordering is carried by
    // the skin's `early` flag (kaizo/party/tensionbar.js's publishSkin, true
    // over exactly this 4..11 window) and this depth only orders the Knight
    // against other ENTITIES, where -1 keeps him in front of them too.
    kt.depth = (state.kaizo.tensionbarDepth ?? TENSIONBAR_DEPTH_STANDIN) - 1;
    reparentAfterimages(state, kt.depth);
    setScene(state, 'tp', 4.1);
    scrDelayVar(state, 'tp', 5, 1);
    cue(state, 'snd_knight_cut');
    // The SWING: three frames of spr_roaringknight_attack_ol, 3 -> 5. No
    // easetype (scr_lerpvar's short arm), so it is linear.
    noteLerp(state, 'image_index', 3, 5, 3, { knight: true });
    noteLerp(state, 'x', kt.x, kt.x - 64, 8, kl('out'));
  } else if (s === 5) {
    // ── THE CUT. This assignment is what arms tensionbar.js's clamp. ──────
    setScene(state, 'tp', 10);
    scrDelayVar(state, 'tp', 11, 24);
    cue(state, 'snd_impact');
    cue(state, 'snd_glassbreak', 0.8, 1);
    cue(state, 'snd_glassbreak', 1, 0.9);

    // with (obj_tensionbar) { deadtp = scr_marker(x, y,
    //   spr_tensionbar_sliced_top); with (deadtp) { ... } }
    // scr_marker draws no RNG (gml_GlobalScript_scr_marker.gml). THE THREE
    // DRAWS, in source order — Step_0:1994-1996.
    const rng = state.gmlRng;
    const imageAngle = rng ? gmlRandomRange(rng, 1, 10) : 0;
    const hspeed = rng ? gmlRandomRange(rng, -5, -7) : 0;
    const vspeed = rng ? gmlRandomRange(rng, -2, -5) : 0;
    draw(state, 'tp', 3);
    sc.tp.deadtp = {
      sprite: 'spr_tensionbar_sliced_top',
      imageAngle, hspeed, vspeed, gravity: 0.25,
      spawnedFrame: state.frame,
    };
    // AND PUBLISH IT, so it is a thing on screen and not only a row in the
    // ledger. The record above carried the three rolls and nothing else — no
    // position, no motion, no reader anywhere — so the Knight cut the bar,
    // 51 orange shards bled, and the half he cut off simply was not there.
    //
    // `state.kaizo.deadtp` rather than a direct call, because tensionbar.js
    // is the module that owns the bar's markers and THIS file imports from
    // it; a call the other way would close a cycle. It steps the record and
    // puts it in `state.tensionBar.markers`.
    //
    // (0, 0) is BAR-LOCAL — the GML is `with (obj_tensionbar) { deadtp =
    // scr_marker(x, y, ...) }`, i.e. the bar's own origin, which is exactly
    // what the markers seam's local frame means.
    //
    // NO LIFE AND NO LERPS. Unlike a bleed particle this has no
    // `scr_script_delayed(instance_destroy, N)`; it flies until k_tpscene 12
    // destroys it, which is the `sc.tp.deadtp = null` at the bottom of this
    // machine.
    //
    // ONE DEVIATION, LABELLED: the GML puts it at `obj_tensionbar.depth + 1`
    // — BEHIND the bar — and the markers list is painted in front. It clears
    // the bar's 25px footprint inside two frames at hspeed -5..-7, so the
    // cost is two frames of the piece not being occluded. Writing that down
    // beats inventing a second seam for it.
    state.kaizo.deadtp = {
      x: 0, y: 0, hspeed, vspeed, gravity: 0.25, imageAngle,
    };
    // `inst = instance_create(x, y, obj_shake); inst.shakex = 8;
    //  inst.shakespeed = 1;` — Step_0:1999-2004. UNGUARDED, unlike
    // scr_damage's `if (!i_ex(obj_shake))`, and the two writes land after
    // the Create so they override obj_shake's own 4/1 (sim/shake.js).
    sc.shake = { shakex: 8, shakespeed: 1, frame: state.frame };
    scrShakescreen(state, { shakex: 8, shakespeed: 1 });
  } else if (s === 11) {
    kt.depth = kt.remdepth;
    reparentAfterimages(state, kt.depth);
    // `siner2 = 0` FIRST, and the y lerp below reads it — so the target is
    // `ystart + cos(0) * 8` = ystart + 8, the top of the bob, not wherever
    // the bob happened to be. Step_0:2014-2021, in that order.
    kt.siner2 = 0;
    setScene(state, 'tp', 11.1);
    scrDelayVar(state, 'tp', 11.2, 12);
    noteLerp(state, 'x', kt.x, kt.xstart, 25, kl('inout'));
    noteLerp(state, 'y', kt.y, kt.ystart + Math.cos(kt.siner2 / 8) * 8, 25, kl('inout'));
  } else if (s === 11.2) {
    kt.spriteIndex = 'spr_roaringknight_idle';
    setScene(state, 'tp', 11.1);
    scrDelayVar(state, 'tp', 12, 14);
  } else if (s === 12) {
    kt.yoff = 0;
    kt.sceneFloat = 1;
    msg(state, '\\ck* Let\'s keep this interesting.');
    // THE SPELL TAUNT. k_didspell is set by scr_spell for any spell id in
    // (1, 100] — scr_spell.gml:11-18 — so this fires only on a run that has
    // cast nothing by phase 1's end.
    if (!state.kaizo.didspell) {
      sc.tp.nospellsaw = 1;
      state.kaizo.nospellsaw = 1;
      msg(state, '\\ck* No spells yet...^1?&* Guess you didn\'t need that anyways.');
    }
    kt.siner2 = 0;
    // scr_mnendturn() — INSIDE the scene, while k_tpscene is still 12. So the
    // tp arm's `k_tpscene == 0` guard is false and it cannot re-arm itself,
    // but the NH arm can fire from here. Faithful, and load-bearing.
    (sc.onMnendturn ?? scrMnendturnScenes)(state);
    setScene(state, 'tp', -1);
    state.kaizo.specialCon = 0;
    kt.knightState = 0;
    sc.tp.deadtp = null;   // with (obj_tensionbar) instance_destroy(deadtp)
    state.kaizo.deadtp = null;
  }

  // `if (state == 10 && k_scenefloat) y = ystart + k_yoff + cos(siner2/8)*8`
  floatKnight(state);
  return true;
}

/** The float tail all three scenes share (Step_0:1538-1540 / 1766 / 2050). */
function floatKnight(state) {
  const kt = ensureScenes(state).knight;
  if (kt.knightState === 10 && kt.sceneFloat) {
    kt.y = kt.ystart + kt.yoff + Math.cos(kt.siner2 / 8) * 8;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// k_nhscene — Step_0:1408-1541. THE NO-HIT REWARD.
// ───────────────────────────────────────────────────────────────────────────

export const NH_SCENE_STATES = [
  { at: 1, wait: 1.1, delay: [2, 10], draws: 0 },
  { at: 2, wait: 3, delay: null, draws: 0 },      // waits on the writer
  { at: 3, wait: 3.1, delay: [4, 20], draws: 0 }, // gated on !w_ex()
  { at: 4, wait: 5, delay: null, draws: 0 },      // waits on the star's flight
  { at: 5, wait: 6, delay: [7, 65], draws: 8 },   // or -> 0 in nohitmode
  { at: 7, wait: 8, delay: null, draws: 0 },      // waits on the writer
  { at: 8, wait: -1, delay: null, draws: 0 },
];

/**
 * `scr_lerpvar("x", x, targetX, 135, 2, "out")` on the reward star: 135
 * frames. `point_distance(...) < 1` is the state-5 gate, so the scene sits in
 * 5 for the whole flight. Modelled as a countdown on the star record rather
 * than as a lerped position — the star is a visual, its ARRIVAL is the
 * mechanism.
 */
export const NH_STAR_FLIGHT = 135;

/**
 * One frame of the no-hit scene.
 *
 * `w_ex()` is `instance_exists(obj_writer)` — the battle text box. The sim has
 * no writer object, so the two waits read `state.dialogue?.text` (the sim's
 * equivalent) and fall through when there is none, which is the "text finished"
 * case. Documented rather than silently collapsed.
 */
export function stepNhscene(state) {
  const k = state.kaizo;
  const s = k.nhscene ?? 0;
  if (s <= 0) return false;
  const sc = ensureScenes(state);
  const kt = sc.knight;
  const kn = state.knight ?? {};

  // `special_con = 1;` — RE-ASSERTED EVERY FRAME of this scene (:1412),
  // unlike the tp scene which sets it once from scr_mnendturn.
  k.specialCon = 1;

  if (s === 1) {
    setScene(state, 'nh', 1.1);
    scrDelayVar(state, 'nh', 2, 10);
  } else if (s === 2) {
    setScene(state, 'nh', 3);
    kt.knightState = 10;
    kt.sceneFloat = 1;
    kt.y = kt.ystart + Math.cos(kt.siner2 / 8) * 8;
    msg(state, '\\ck* ^2.^2.^2.&* Well^1, if you truly insist...^4 ^3 ^3 %%');
    sc.writerOpen = true;
  } else if (s === 3) {
    if (!writerExists(state, sc)) {
      sc.nh.siner = kt.siner2;            // k_siner = siner2
      kt.sceneFloat = 0;
      kt.spriteIndex = 'spr_roaringknight_point_ol';
      kt.imageIndex = 0;
      kt.imageSpeed = 0;
      noteLerp(state, 'image_index', 0, 4, 3, { knight: true });  // :1435
      setScene(state, 'nh', 3.1);
      scrDelayVar(state, 'nh', 4, 20);
    }
  } else if (s === 4) {
    cue(state, 'snd_stardrop');
    // snd_pause(global.batmusic[1]) — the music stops for the whole beat.
    sc.musicPaused = true;
    const anchor = nhTargetAnchor(state);
    setScene(state, 'nh', 5);
    sc.nh.star = {
      x: kt.x + 28,
      y: kt.y + 60,
      targetX: anchor.x,
      targetY: anchor.y,
      // scr_lerpvar("x"/"y", ..., 135, 2, "out") — the flight. No RNG.
      flight: NH_STAR_FLIGHT,
      sprite: 'spr_knight_bullet_star',
    };
  } else if (s === 5) {
    const star = sc.nh.star;
    if (star) star.flight -= 1;
    // `point_distance(star.x, star.y, star.targetX, star.targetY) < 1`
    const arrived = !!star && star.flight <= 0;
    if (arrived) {
      if (kn.nohitmode) {
        // The nohitmode branch: the scene ABORTS, spends NO RNG, and hands
        // the fight back through mnfight/myfight 99 rather than 0.
        kn.progamer = false;
        setScene(state, 'nh', 0);
        k.mnfight = 99;
        k.myfight = 99;
      } else {
        kn.progamer = false;
        kn.didfullnohit = false;
        setScene(state, 'nh', 6);
        scrDelayVar(state, 'nh', 7, 65);
        cue(state, 'snd_bageldefeat', 0.8, 0.8);
        cue(state, 'snd_damage');
        cue(state, 'snd_glassbreak', 0.4, 0.8);
        cue(state, 'snd_glassbreak', 0.3, 0.6);
        cue(state, 'snd_impact', 0.5, 0.8);

        // dm.damage = "999999999999999999" (a STRING), then
        // `repeat (4)` of a type-12 writer at random offsets — EIGHT DRAWS,
        // two per repeat, in source order (Step_0:1493).
        sc.writers.push({ frame: state.frame, x: star.x + 128, y: star.y,
          damage: NH_DAMAGE_TEXT, type: 0 });
        const rng = state.gmlRng;
        for (let i = 0; i < 4; i++) {
          const ox = rng ? gmlRandomRange(rng, -64, 64) : 0;
          const oy = rng ? gmlRandomRange(rng, -60, 16) : 0;
          sc.writers.push({ frame: state.frame, x: star.x + ox, y: star.y + oy,
            damage: null, type: 12 });
        }
        draw(state, 'nh', 8);

        // global.hp[global.char[0]] = -999999999999999999; scr_dead(0);
        if (Array.isArray(state.partyHp) && rosterSize(state) > 0) {
          state.partyHp[0] = NH_KILL_HP;
        }
        scrDead(state, 0);
        sc.nh.star = null;   // instance_destroy(k_nhstar); k_nhstar = -4;
      }
    }
  } else if (s === 7) {
    setScene(state, 'nh', 8);
    kt.spriteIndex = 'spr_roaringknight_idle2';
    msg(state, '\\ck* There we go. ^4 ^3 ^3 %%');
    sc.writerOpen = true;
  } else if (s === 8) {
    if (!writerExists(state, sc)) {
      // Step_0:1520-1523 — all four down-messages suppressed at once: the
      // Knight has already said it, so the party's own fall lines never
      // print. `krisdownmessage` and its three siblings are the mod's own
      // LATCH names, and the sim's latch for the same four booleans is
      // kaizo/party/freeze.js's `downLatch` — the thing `downMessages` reads
      // (its `!latch[DOWN_LATCH_KEYS[charId]]` guard). This used to write
      // `state.kaizo.krisdownmessage` and the other three, which NOTHING IN
      // THE REPO READS (whole-tree grep): the suppression was computed
      // correctly and had no effect, so the fall line printed anyway on the
      // turn after the Knight's one-shot. Same class as the four `idlesprite`
      // writes that landed on the knight record instead of the instance.
      // Written through the module that owns the latch, and the mod's own
      // names kept beside them so a reader can find the GML line.
      const dl = (ensureFreezeState(state).downLatch ??= {
        kris: false, susie: false, ralsei: false, noelle: false,
      });
      dl.kris = true;      // krisdownmessage   = true;   (:1520)
      dl.susie = true;     // susiedownmessage  = true;   (:1521)
      dl.ralsei = true;    // ralseidownmessage = true;   (:1522)
      dl.noelle = true;    // noelledownmessage = true;   (:1523)
      const who = nhVictimName(state);
      msg(state, `* ${who} was..^3. uh..^3.&* Yeah^1, I've got nothing.`);
      sc.musicPaused = false;
      kt.spriteIndex = 'spr_roaringknight_idle';
      kt.siner2 = sc.nh.siner;
      (sc.onMnendturn ?? scrMnendturnScenes)(state);
      setScene(state, 'nh', -1);
      k.specialCon = 0;
      kt.knightState = 0;
    }
  }

  floatKnight(state);
  return true;
}

/**
 * `w_ex()` = `instance_exists(obj_writer)`. The sim has no writer object; the
 * closest thing is the scene's dialogue box. A scene owner that HAS one should
 * set `state.kaizo.scenes.writerOpen = false` when its text finishes; with no
 * dialogue system at all the two waits fall straight through, which is the
 * "text already dismissed" case and keeps the machine advancing.
 */
function writerExists(state, sc) {
  if (state.dialogue && state.dialogue.text) return true;
  if (sc.writerOpen) { sc.writerOpen = false; return true; }
  return false;
}

/**
 * `global.charinstance[0].x + 16`, `... .y + myheight - 24` — the reward star
 * aims at SLOT 0, unconditionally. On the Weird Route that is Kris (charId 1),
 * because scr_fixparty sorts by id and 1 < 4.
 */
function nhTargetAnchor(state) {
  const a = writerAnchor(state, 0);
  return { x: a.x + 16, y: a.y };
}

function nhVictimName(state) {
  const r = state.kaizo?.roster;
  return r && r[0] ? (r[0].name ?? 'KRIS') : 'KRIS';
}

// ───────────────────────────────────────────────────────────────────────────
// obj_spell_snowgrave + its snowflakes
// ───────────────────────────────────────────────────────────────────────────

/**
 * The flake spawner from obj_spell_snowgrave's Draw (:142-158), which is the
 * only part of that event with a mechanism in it:
 *
 *     if (timer >= 20 && timer <= (75 + altpath * 30)) {
 *         snowflake[0] = instance_create(xx + 455, yy + 560, ...);
 *         snowflake[1] = instance_create(xx + 500, yy + 600, ...);
 *         snowflake[2] = instance_create(xx + 545, yy + 520, ...);
 *         for (i = 0; i < 3; i++) { gravity = -2;
 *             vspeed = sin(timer / 2) * 0.5; siner = timer / 2; }
 *     }
 *
 * `altpath` is 1 only for encounter 82 (the Berdly fight), so in the Knight
 * fight it is 0 and the window is timer 20..75 — 56 frames, THREE flakes each,
 * 168 in total.
 *
 * THE NEUTERING lives in the same event, at :165: the entire
 * `scr_damage_enemy` block is wrapped in `if (!i_ex(obj_knight_enemy))`. So
 * against the Knight SnowGrave does nothing at all — and, because the block
 * it skips contains the only `random()` on this path (`damage +
 * round(random(100))`, :179), the spell spends ZERO RNG in this fight.
 */
export const SNOWGRAVE_SPAWN_WINDOW = [20, 75];
export const SNOWGRAVE_SPAWN_OFFSETS = [
  [455, 560], [500, 600], [545, 520],
];
export const SNOWGRAVE_DESTROY_TIMER = 120;

export const snowgraveSpell = {
  name: 'obj_spell_snowgrave',
  create(e) {
    // VISIBLE, AT DEPTH 0 — MEASURED off the OBJECT DEFINITION (UTMT
    // Data.GameObjects on the mod's data: sprite spr_icespell_snowflake,
    // depth 0, visible True; the code dump cannot show any of the three,
    // CLAUDE.md "The OBJECT DEFINITION holds more than the sprite"), and no
    // event of this object, nor the knight's k_sgscene block, ever writes
    // `visible`. It was pinned false here while the spell's Draw_0 went
    // unmodelled; kaizo/render/draw/snowgrave.js now ports that Draw, and the
    // renderer's depth-sorted pass filters `visible === false` out before
    // the override seam, so the instance has to be what the game has.
    e.visible = true;
    e.depth = 0;
    // Draw_0's own bookkeeping (Create_0:1,3): the wash alpha and the snow
    // scroll. The draw calls read them (:121-126) and the same event then
    // advances them (:127-137, :208-221) — see the `draw` slot below.
    e.bgalpha = 0;
    e.snowspeed = 0;
    e.timer = 0;
    // `??=` for the two the caster passes in — spawn() applies `vars` BEFORE
    // create, so a plain assignment silently zeroes them.
    e.caster ??= 0;
    e.damage ??= 0;
    e.altpath = 0;   // encounterno 115 is the knight, not 82
  },
  // The spawner lives in the DRAW event, so it runs after every Step —
  // endStep is this engine's slot for that (the same placement
  // tensionbar.js's own Draw uses).
  endStep(e, state) {
    e.timer += 1;
    // :138-141 — `if (timer == 1) audio_play_sound(snd_snowgrave, 50, 0);`
    // The spell's signature cue, and the one sound in this scene that was
    // neither called nor shipped: the other five (snd_wing, snd_knight_cut,
    // snd_rocket_bc, snd_graze, snd_damage) were cued correctly all along,
    // so the scene played with everything EXCEPT the sound that announces
    // it. check-audio-cues scans for cues named in shipped code, which is
    // why an unnamed one was invisible to it by construction.
    if (e.timer === 1) cue(state, 'snd_snowgrave');
    const [lo, hi] = SNOWGRAVE_SPAWN_WINDOW;
    if (e.timer >= lo && e.timer <= hi) {
      const vx = state.view?.x ?? 0;
      const vy = state.view?.y ?? 0;
      for (const [ox, oy] of SNOWGRAVE_SPAWN_OFFSETS) {
        spawn(state, snowgraveSnowflake, {
          x: vx + ox,
          y: vy + oy,
          gravity: -2,
          vspeed: Math.sin(e.timer / 2) * 0.5,
          siner: e.timer / 2,
        });
      }
    }
    if (e.timer === SNOWGRAVE_DESTROY_TIMER) destroy(e);
  },
  // THE DRAW SLOT (sim/index.js "THE DRAW SLOT": after every End Step,
  // before the renderer paints). obj_spell_snowgrave's Draw_0 draws FIRST
  // and advances its state AFTERWARDS in the same event, so the values the
  // renderer must paint with are the ones standing before this runs:
  // snapshot, then advance, in the GML's order. `timer++` (:21) precedes the
  // draws in the GML and is endStep's above, so `e.timer` is already the
  // drawn value. Nothing here touches the RNG.
  //
  // One frame the renderer never paints: at timer 120 (:222-234) endStep
  // destroys the instance before this slot and the paint, where the game
  // draws once more and then destroys. COMPUTED, not measured: bgalpha is
  // 0.49999999999999994 after its ten 0.05 steps and the 0.02 ramp from
  // timer 90 has driven it to ~0 by timer 115, so that last frame's wash and
  // snow are at alpha ~0 either way.
  draw(e) {
    e.bgalphaDrawn = e.bgalpha;       // read at :121 (draw_set_alpha) and :125-126
    e.snowspeedDrawn = e.snowspeed;   // read at :125-126
    // :127-133
    if (e.timer <= 10 && e.timer >= 0) {
      if (e.bgalpha < 0.5) e.bgalpha += 0.05;
    }
    // :134-137
    if (e.timer >= 0) e.snowspeed += 20 + e.timer / 5;
    // :208-221. altpath is pinned 0 above (encounter 82 is Berdly's, never
    // the Knight's); the altpath arm is carried verbatim, not reachable.
    if (e.timer >= 90 + e.altpath * 30) {
      if (e.altpath === 0) {
        if (e.bgalpha > 0) e.bgalpha -= 0.02;
      }
      if (e.altpath === 1) e.bgalpha -= 0.005;
    }
  },
};

/** Live flakes, in creation order — GML `with` iterates by instance id. */
function flakes(state) {
  return (state.entities ?? []).filter(
    (e) => e.alive && e.type === snowgraveSnowflake,
  );
}

/**
 * Write a speed/direction pair through to the components, the way GML does
 * (hspeed/vspeed are the storage; speed and direction are views of them).
 */
function setMotion(e, speed, direction) {
  e.speed = speed;
  e.direction = direction;
  e.hspeed = lengthdirX(speed, direction);
  e.vspeed = lengthdirY(speed, direction);
}

/**
 * DRAW-TIME STATE: an obj_lerpvar the mod arms ON A FLAKE with `scr_lerpvar`.
 *
 * Every lerp is recorded on `sc.lerps` (noteLerp) and, for the two variables
 * nothing mechanical reads — `flakescale` (Step_0:9-10 folds it into
 * image_xscale/yscale, Draw_0:4-5 into the two side copies) and
 * `image_alpha` (Draw only; con 4's scr_approach is the sim's own) — that was
 * the whole story until the Draw was ported (kaizo/render/draw/snowgrave.js).
 * Now the flake carries the tween itself and its `draw` slot steps it the way
 * obj_lerpvar's Step does (gml_Object_obj_lerpvar_Step_0.gml:21-25,42-45):
 * `time++`, then `lerp(pointa, pointb, time / maxtime)`, gone at
 * time >= maxtime. Its first write lands the frame AFTER it is armed — the
 * instance is created during a Step and this engine's phase list is frozen
 * per phase (sim/lerpvar.js, ORDERING) — hence `fresh`. No RNG here: the
 * targets are rolled by the callers, in the stream order the GML has.
 */
function armFlakeLerp(f, varname, from, to, maxtime) {
  (f.drawLerps ??= []).push({ varname, from, to, maxtime, time: 0, fresh: true });
}

/**
 * obj_spell_snowgrave_snowflake — Create_0 + Step_0, the mod's rework.
 *
 * Vanilla's flake is a drifting decoration; the mod bolts a `con` machine onto
 * it (0 rise -> 1 gather at the Knight -> 2/2.1 aim -> 3 charge the party ->
 * 4 bounce off Noelle) and it is the flakes, not the Knight, that hand
 * k_sgscene from 5.1 to 6.
 */
export const snowgraveSnowflake = {
  name: 'obj_spell_snowgrave_snowflake',
  create(e) {
    // VISIBLE, and its sprite is spr_icespell_snowflake (46x46, origin 23,23,
    // one frame) — both MEASURED off the OBJECT DEFINITION (UTMT
    // Data.GameObjects on the mod's data; depth 0 there too, which is what
    // the `?? 0` below lands on). No event writes `visible` or `sprite_index`
    // on a flake, so Draw_0:1's draw_self() IS that sprite; the flake was
    // pinned invisible here only while its Draw went unported
    // (kaizo/render/draw/snowgrave.js). `sprite_index` is set so the
    // engine's runAnimation advances image_index off the real sprite once it
    // is packed (kaizo/assets/sprites — not yet; see missingSprites in the
    // port's header).
    //   ...which is NOT done here after all: the sprite's NAME lives on the
    // renderer (snowgrave.js SNOWFLAKE_SPRITE), because check-sprites scans
    // kaizo/party for every quoted spr_* and the overlay does not carry this
    // one yet, and because with a single frame there is nothing for
    // runAnimation to advance. Pack it, then set sprite_index here if a
    // multi-frame version ever appears.
    e.visible = true;
    // PER-ENTITY, NOT PER-TYPE. sim/index.js's runMotion reads
    // `e.componentMotion`, so declaring it on the type descriptor sets a flag
    // nothing looks at — the flakes then accelerate to speed 95 and never
    // move, which reads exactly like "the scene hangs at 5.1".
    e.componentMotion = true;
    e.image_xscale = 2;
    e.image_yscale = 2;
    // `??=`, like the spell's caster/damage above: Create_0:3 is `siner = 0`
    // and the spawner then writes `snowflake[i].siner = timer / 2`
    // (obj_spell_snowgrave Draw_0:152) — but spawn() applies `vars` BEFORE
    // create (sim/entity.js:180 vs :193), so a plain `= 0` here clobbered
    // the spawner's value and every flake rose with siner 0 instead of
    // 10..37.5. DRAW-ONLY: siner feeds image_xscale (Step_0:3) and the two
    // side copies (Draw_0:2-5) and nothing else, so the sim's mechanics and
    // RNG stream are unchanged; the side copies now exist from birth, as in
    // the game (`siner != 0` there from the first Draw).
    e.siner ??= 0;
    e.timer = 0;
    e.image_alpha = 1;
    e.con = 0;
    e.tarX = -4;
    e.tarY = -4;
    // `depth` is NOT in this engine's INSTANCE_DEFAULTS (sim/entity.js), so it
    // has to be assigned before `tardep = depth` reads it — otherwise the
    // f32 accessor stores NaN and every later depth comparison reads false.
    e.depth = e.depth ?? 0;
    e.tardep = e.depth;
    e.flakenum = 0;
    e.flakescale = 1;
    e.hspeed = e.hspeed ?? 0;
    e.vspeed = e.vspeed ?? 0;
  },
  step(e, state) {
    const sc = ensureScenes(state);
    const rng = state.gmlRng;

    // image_xscale / image_yscale are pure draw; the `siner` they read is not.
    if (e.con < 1) e.siner += 1;
    e.timer += 1;

    if (e.con === 0) {
      if (e.timer >= 30) { destroy(e); return; }
    } else if (e.con === 1) {
      e.vspeed = 0;
      e.gravity = 0;
      e.siner = lerp(e.siner, 0, 0.5);
      if (Math.abs(e.siner) < 1) e.siner = 0;
      e.x = lerp(e.x, e.tarX, 0.21);
      e.y = lerp(e.y, e.tarY, 0.21);
    } else if (e.con === 2) {
      e.siner = 0;
      // `timer = round(-1 - (flakenum / 6))` — a NEGATIVE timer, so the later
      // flakes wait longer before their charge. GML `round` is ties-to-even;
      // sim/gml.js's gmlRound is the faithful one, but every value here is
      // produced by round() of a negative non-tie except flakenum multiples of
      // 3 — where -1 - n/6 lands on a .5 tie. Kept on gmlRound for that.
      e.timer = gmlRound(-1 - (e.flakenum / 6));
      e.con = 2.1;
      // TWO DRAWS, in source order.
      const dir = pointDirection(e.x, e.y, e.tarX, e.tarY)
        + (rng ? gmlRandomRange(rng, -5, 5) : 0);
      const spd = rng ? gmlRandomRange(rng, 0.25, 0.5) : 0.375;
      draw(state, 'flakes', 2);
      setMotion(e, spd, dir);
    } else if (e.con === 2.1) {
      e.siner = 0;
      if (e.timer >= 0) {
        noteLerp(state, 'flakescale', e.flakescale, 0.8, 12);
        armFlakeLerp(e, 'flakescale', e.flakescale, 0.8, 12);   // Step_0:48
        // ONE DRAW. Negative friction accelerates (CLAUDE.md, the splitter's
        // teeth) — this is what turns a drifting flake into a projectile.
        e.friction = -1.2 - (rng ? gmlRandom(rng, 1) : 0.5);
        draw(state, 'flakes', 1);
        e.con = 3;
        e.timer = 0;
      }
    } else if (e.con === 3) {
      e.siner = 0;
      if (Math.abs(e.tarX - e.x) < 120) e.depth = e.tardep;
      if (Math.abs(e.tarX - e.x) < 36) {
        // `with (obj_knight_enemy) { k_sgscene = max(6, k_sgscene); ... }`
        // Runs EVERY frame the flake is inside 36px, not once — harmless,
        // because max() never pulls a later state backwards.
        const cur = state.kaizo.sgscene ?? 0;
        const next = Math.max(6, cur);
        if (next !== cur) setScene(state, 'sg', next);
        // THE NOELLE BOUNCE. `global.char[k_sgtarget] == 4` -> the flake is
        // deflected instead of landing. This is the visible half of the rule
        // that makes Noelle unfreezable; the arithmetic half is the
        // min(hp - 1) clamp in freeze.js's stepSnowgraveFreeze.
        if (charIdOf(state, sc.sg.target) === 4) {
          e.con = 4;
          e.hspeed /= 5;
          noteLerp(state, 'flakescale', e.flakescale, 0.25, 20);
          armFlakeLerp(e, 'flakescale', e.flakescale, 0.25, 20);   // Step_0:72
          // THREE DRAWS: random_range, then choose, then the graze pitch.
          const mag = rng ? gmlRandomRange(rng, 3, 6) : 4.5;
          const sign = rng ? gmlChoose(rng, [1, -1]) : 1;
          e.vspeed = mag * sign;
          const pitch = 1.1 + (rng ? gmlRandom(rng, 0.3) : 0.15);
          draw(state, 'flakes', 3);
          cue(state, 'snd_graze', pitch, 0.6);
        }
      }
      // scr_afterimagefast() every frame — no RNG (checked).
      if (e.timer === 60) { destroy(e); return; }
    } else if (e.con === 4) {
      e.siner = 0;
      e.image_alpha = Math.max(0, e.image_alpha - 0.08);   // scr_approach -> 0
      e.friction = 2;
      if (e.timer === 60) { destroy(e); return; }
    }

    // ── the move step's own arithmetic (UNVERIFIED note 2) ────────────────
    // GML order: friction on the speed MAGNITUDE, then the gravity vector into
    // the components, then move. The move itself is the engine's
    // componentMotion, which runs in the motion phase right after this.
    if (e.friction) {
      let s = e.speed;
      if (s > 0) { s -= e.friction; if (s < 0) s = 0; } else if (s < 0) {
        s += e.friction; if (s > 0) s = 0;
      }
      if (s !== e.speed) setMotion(e, s, e.direction);
    }
    if (e.gravity) {
      e.hspeed += lengthdirX(e.gravity, e.gravity_direction);
      e.vspeed += lengthdirY(e.gravity, e.gravity_direction);
    }
  },
  // THE DRAW SLOT — what the flake's Draw_0 reads that nothing mechanical
  // carries (sim/index.js "THE DRAW SLOT": after every End Step, before the
  // renderer paints). No RNG.
  draw(e) {
    // Step_0:1-10, in effect:
    //     if (con == 0) image_xscale = sin(siner) * 2; else image_xscale = 2;
    //     image_xscale *= flakescale;  image_yscale = 2 * flakescale;
    // These are the scales draw_self() paints with (Draw_0:1,11). The step
    // above skipped them as "pure draw" — true, and this is where pure draw
    // state goes. They are computed at the TOP of the Step, so the siner is
    // the one BEFORE this frame's `siner++` (:11-14, con < 1 only — exactly
    // siner - 1 for con 0) and the flakescale is the one standing BEFORE this
    // frame's obj_lerpvar writes: obj_lerpvar is object index 1585 and the
    // flake 1427 (sim/data/object-order.js), so its Step runs after the
    // flake's and the flake reads last frame's value. A flake born this frame
    // (timer 0 — the spawner runs in the spell's endStep, no Step of its own
    // yet) keeps Create_0:1-2's 2 x 2, which the same expression yields at
    // flakescale 1. `con` is what the Step saw: the knight (index 344) writes
    // it before the flake's Step in the game, and this engine's scene runs
    // before the flakes too (the knight entity predates them).
    const fs = e.flakescale;
    e.image_xscale = (e.con === 0 && e.timer > 0 ? Math.sin(e.siner - 1) * 2 : 2) * fs;
    e.image_yscale = 2 * fs;
    // obj_lerpvar Step_0:21-25,42-45 for every tween armed on this flake, in
    // arming order (instance-id order — a later tween on the same variable
    // writes last and wins the frame, as in the game). The Draw then reads
    // the POST-write flakescale / image_alpha (Draw_0:4-5), which is why this
    // comes after the scales above and before the renderer. `fresh` is the
    // arming frame: obj_lerpvar's first Step is the next one.
    const lerps = e.drawLerps;
    if (lerps && lerps.length) {
      for (const t of lerps) {
        if (t.fresh) { t.fresh = false; continue; }
        t.time += 1;
        e[t.varname] = lerp(t.from, t.to, t.time / t.maxtime);
      }
      e.drawLerps = lerps.filter((t) => t.fresh || t.time < t.maxtime);
    }
  },
};

// ───────────────────────────────────────────────────────────────────────────
// k_sgscene — Step_0:1543-1770. SNOWGRAVE, TURNED AROUND.
// ───────────────────────────────────────────────────────────────────────────

export const SG_SCENE_STATES = [
  { at: 1, wait: 1.1, delay: [2, 17], draws: 2 },     // picktarget = irandom
  { at: 2, wait: 2.1, delay: [3.1, 2], draws: 0 },
  { at: 3.1, wait: 3, delay: [4, 75], draws: 0 },
  { at: 3, wait: 3, delay: null, draws: 'per-flake' },  // persistent
  { at: 4, wait: 4.1, delay: [5, 25], draws: 'per-flake' },
  { at: 4.1, wait: 4.1, delay: null, draws: 'per-flake' },
  { at: 5, wait: 5.1, delay: null, draws: 3 },        // the flakes advance it
  { at: 6, wait: 6.1, delay: [7, 25], draws: 0 },
  { at: 6.1, wait: 6.1, delay: null, draws: '2 or 3' },
  { at: 7, wait: 7.1, delay: [8, 30], draws: 0 },
  { at: 8, wait: 0, delay: null, draws: 0 },
];

/**
 * `scr_spell(10, caster)` — the player's cast (scr_spell.gml:257-276).
 *
 *     global.spelldelay = 30; ... damage = ceil(battlemag * 40 + 600);
 *     attack = instance_create(x, y, obj_spell_snowgrave);
 *     attack.caster = caster; attack.damage = damage;
 *     global.spelldelay = 140;
 *     with (obj_knight_enemy) { k_sgcaster = other.caster; }
 *
 * `k_didspell = 1` is set at the top of scr_spell for any id in (1, 100]
 * (:11-18), so casting SnowGrave also silences the tp scene's "No spells
 * yet..." line — the two scenes are coupled through that one flag.
 *
 * @param {object} state
 * @param {{caster?:number, magic?:number}} opts caster is a SLOT.
 */
export function castSnowgrave(state, { caster = 0, magic = 13 } = {}) {
  const sc = ensureScenes(state);
  const k = state.kaizo;
  k.didspell = 1;                          // scr_spell:11-18
  const damage = Math.ceil(magic * 40 + 600);
  const spell = spawn(state, snowgraveSpell, { caster, damage });
  k.spelldelay = SNOWGRAVE_SPELLDELAY;
  sc.sg.caster = caster;                   // k_sgcaster
  sc.sg.spell = spell;
  return spell;
}

/**
 * Step_0:1543-1545, VERBATIM and top-level in the Step:
 *
 *     if (k_sgscene == 0 && i_ex(obj_spell_snowgrave)) k_sgscene = 1;
 *
 * NOT gated on k_sideb here. The gate is upstream: the spell can only be cast
 * by Noelle, who is only in the party on the Weird Route.
 *
 * THE RE-ARM IS LIVE, and it is why the `nohitmode` abort at state 6 does not
 * simply end the scene. State 8 puts k_sgscene back to 0 while destroying the
 * spell in the same breath, so nothing can re-arm from there; the nohitmode
 * abort sets 0 with the spell STILL ALIVE, so this line is armed and waiting.
 *
 * MEASURED, not reasoned (a 600-frame nohitmode run): the re-arm to 1 never
 * actually fires, because the flakes get there first. Each frame a flake still
 * inside 36px of its target re-sets `k_sgscene = max(6, 0) = 6` from its own
 * Step, so by the time this line runs the value is 6, not 0. What the run
 * produces instead is a 6 -> 6.1 -> 0 -> 6 thrash for as long as any flake
 * lives (~20 frames), each pass arming another delayed `k_sgscene = 7`, and
 * then that whole queue firing 25 frames later. Faithful, and harmless: no
 * freeze, no HP change, progamer cleared exactly once.
 *
 * In the real mod the thrash is cut shorter than this, because nohitmode's own
 * reset (Step_0:800-830) does `with (obj_script_delayed) instance_destroy()`
 * and restarts the turn. That block is the scene owner's, not this module's —
 * `destroyPendingDelays` is the primitive it needs.
 */
export function armSgsceneIfSpell(state) {
  ensureScenes(state);
  if ((state.kaizo.sgscene ?? 0) !== 0) return false;
  const spell = (state.entities ?? []).find(
    (e) => e.alive && e.type === snowgraveSpell,
  );
  if (!spell) return false;
  setScene(state, 'sg', 1);
  return true;
}

/** One frame of the SnowGrave scene. Step_0:1547-1770, in order. */
export function stepSgscene(state) {
  const k = state.kaizo;
  const s = k.sgscene ?? 0;
  if (s <= 0) return false;
  const sc = ensureScenes(state);
  const kt = sc.knight;
  const kn = state.knight ?? {};
  const rng = state.gmlRng;
  const snowS = SNOW_SCATTER;
  const anchor = knightAnchor(state);

  // ── the wing loop, ABOVE the branch ladder (:1550-1556) ────────────────
  // `if (k_sgscene > 1 && k_sgvol > 0) if ((global.time % 2) == 0)
  //      snd_play(snd_wing, k_sgvol, k_sgpit + random(0.5));`
  // ONE DRAW every even frame, for as long as the scene runs past state 1.
  // It is by far the biggest consumer in this file.
  if (s > 1 && sc.sg.vol > 0 && (state.frame % 2) === 0) {
    const pitch = sc.sg.pit + (rng ? gmlRandom(rng, 0.5) : 0.25);
    draw(state, 'sg', 1);
    cue(state, 'snd_wing', pitch, sc.sg.vol);
  }

  if (s === 1) {
    kt.sceneFloat = 1;
    kt.y = kt.ystart + Math.cos(kt.siner2 / 8) * 8;
    k.spelldelay = SG_SPELLDELAY_STALL;          // THE HIJACK
    // scr_picktarget_weighted(5, 4, 3, 1) — Kris five times as likely as
    // Noelle. TWO DRAWS (irandom), or none when the bag is empty.
    const before = rng?.draws ?? 0;
    sc.sg.target = scrPicktargetWeighted(state, 5, 4, 3, 1);
    draw(state, 'sg', (rng?.draws ?? 0) - before);
    sc.sg.num = 0;
    sc.sg.pit = 0.7;
    sc.sg.vol = 0;
    sc.sg.cyc = 0;
    setScene(state, 'sg', 1.1);
    scrDelayVar(state, 'sg', 2, 17);
    kt.spriteIndex = 'spr_roaringknight_idle';
    kt.knightState = 10;
  } else if (s === 2) {
    setScene(state, 'sg', 2.1);
    scrDelayVar(state, 'sg', 3.1, 2);
    kt.spriteIndex = 'spr_roaringknight_point_ol';
    kt.imageIndex = 0;
    kt.imageSpeed = 0;
    noteLerp(state, 'image_index', 0, 3, 3, { knight: true });    // :1579
  } else if (s === 3.1) {
    setScene(state, 'sg', 3);
    scrDelayVar(state, 'sg', 4, 75);
    // scr_lerpvar("k_sgpit", 0.7, 1.1, 75) — the rising whine. Its VALUE
    // feeds the wing pitch above, so unlike the other lerps it is stepped.
    sc.sg.pitLerp = { from: 0.7, to: 1.1, frames: 75, t: 0 };
    // k_sgpit is the knight's own variable, so the tween writes it there.
    noteLerp(state, 'k_sgpit', 0.7, 1.1, 75, { knight: true });   // :1585
  } else if (s === 3) {
    // ── THE GATHER (:1587-1622) ─────────────────────────────────────────
    const snowX = 28;
    const snowY = 60;
    for (const f of flakes(state)) {
      if (!f.alive) continue;
      // Retarget, three draws, in SOURCE order: tarX, tarY, alpha.
      if (f.con === 1 && (state.frame % 5) === 0) {
        f.tarX = anchor.x + snowX + (rng ? gmlRandomRange(rng, -snowS, snowS) : 0);
        f.tarY = anchor.y + snowY + (rng ? gmlRandomRange(rng, -snowS, snowS) : 0);
        f.image_alpha = 0.05 + (rng ? gmlRandom(rng, 0.4) : 0.2);
        draw(state, 'sg', 3);
      }
      // ADOPTION: a flake that has risen past the Knight is taken, or thrown
      // away, on alternating counts. HALF THE SNOWFALL IS DISCARDED.
      if (f.y < (anchor.y + anchor.spriteHeight + 40) && f.con === 0) {
        sc.sg.cyc += 1;
        if ((sc.sg.cyc % 2) === 0) {
          sc.sg.vol += 0.025;
          if (sc.sg.vol > sc.sg.peakVol) sc.sg.peakVol = sc.sg.vol;
          noteLerp(state, 'flakescale', 1, 0.32, 12);
          f.image_alpha_target = 0.1 + (rng ? gmlRandom(rng, 0.2) : 0.1);
          // Step_0:1606-1607, in this order: scr_lerpvar("flakescale", 1,
          // 0.32, 12) then scr_lerpvar("image_alpha", image_alpha, <the roll
          // above>, 12). Draw-time tweens — see armFlakeLerp.
          armFlakeLerp(f, 'flakescale', 1, 0.32, 12);
          armFlakeLerp(f, 'image_alpha', f.image_alpha, f.image_alpha_target, 12);
          f.flakenum = sc.sg.num;
          sc.sg.num += 1;
          f.con = 1;
          f.tarX = anchor.x + snowX + (rng ? gmlRandomRange(rng, -snowS, snowS) : 0);
          f.tarY = anchor.y + snowY + (rng ? gmlRandomRange(rng, -snowS, snowS) : 0);
          draw(state, 'sg', 3);
        } else {
          destroy(f);
        }
      }
    }
  } else if (s === 4) {
    // ── THE WIND-UP (:1623-1647) ────────────────────────────────────────
    setScene(state, 'sg', 4.1);
    scrDelayVar(state, 'sg', 5, 25);
    const snowX = 136;
    const snowY = 48;
    kt.spriteIndex = 'spr_roaringknight_attack_ol';
    kt.imageIndex = 1;
    noteLerp(state, 'image_index', 1, 2, 4, { knight: true });    // :1631
    // `with (obj_spell_snowgrave) timer = 89;` — cuts the spawner off (the
    // window closes at 75 anyway) and pulls its self-destruct 31 frames out.
    for (const e of state.entities ?? []) {
      if (e.alive && e.type === snowgraveSpell) e.timer = 89;
    }
    for (const f of flakes(state)) {
      if (!f.alive) continue;
      if (f.con < 1) {
        noteLerp(state, 'flakescale', 1, 0.3, 8);
        f.image_alpha_target = 0.1 + (rng ? gmlRandom(rng, 0.2) : 0.1);
        // Step_0:1637-1638 — the same pair as the adoption's, over 8.
        armFlakeLerp(f, 'flakescale', 1, 0.3, 8);
        armFlakeLerp(f, 'image_alpha', f.image_alpha, f.image_alpha_target, 8);
        draw(state, 'sg', 1);
      }
      f.con = 1;
      f.tarX = anchor.x + snowX + (rng ? gmlRandomRange(rng, -snowS, snowS) : 0);
      f.tarY = anchor.y + snowY + (rng ? gmlRandomRange(rng, -snowS, snowS) : 0);
      draw(state, 'sg', 2);
    }
  } else if (s === 4.1) {
    // Same retarget as state 3, but the DRAW ORDER IS DIFFERENT: alpha first.
    // Faithful, and it matters — the stream is order-sensitive.
    const snowX = 136;
    const snowY = 48;
    for (const f of flakes(state)) {
      if (!f.alive) continue;
      if (f.con === 1 && (state.frame % 5) === 0) {
        f.image_alpha = 0.05 + (rng ? gmlRandom(rng, 0.4) : 0.2);
        f.tarX = anchor.x + snowX + (rng ? gmlRandomRange(rng, -snowS, snowS) : 0);
        f.tarY = anchor.y + snowY + (rng ? gmlRandomRange(rng, -snowS, snowS) : 0);
        draw(state, 'sg', 3);
      }
    }
  } else if (s === 5) {
    // ── THE THROW (:1662-1686) ──────────────────────────────────────────
    cue(state, 'snd_knight_cut');
    setScene(state, 'sg', 5.1);
    noteLerp(state, 'image_index', 3, 5, 3, { knight: true });    // :1666
    const a = writerAnchor(state, sc.sg.target);
    const tarX = a.x + 16;
    const tarY = a.y;
    sc.sg.vol = 0;
    // k_sgdmg = 0 — the running total the state-7 writer prints. freeze.js
    // accumulates it on state.kaizo.sgdmg.
    state.kaizo.sgdmg = 0;
    sc.sg.ticks = 0;             // counter, not the mod's
    // `repeat (3) snd_play(snd_rocket_bc, 0.8, random_range(0.3, 0.7))`
    // THREE DRAWS.
    for (let i = 0; i < 3; i++) {
      const pitch = rng ? gmlRandomRange(rng, 0.3, 0.7) : 0.5;
      cue(state, 'snd_rocket_bc', pitch, 0.8);
    }
    draw(state, 'sg', 3);
    for (const f of flakes(state)) {
      if (!f.alive) continue;
      f.x -= 48;
      f.y += 22;
      // Step_0:1680 `scr_lerpvar("image_alpha", image_alpha, 1, 8)` — the
      // flakes brighten back to full for the throw. Purely visual (only the
      // Draw reads image_alpha at con >= 2), so it had gone unrecorded;
      // noted like the others and armed as a draw-time tween.
      noteLerp(state, 'image_alpha', f.image_alpha, 1, 8);
      armFlakeLerp(f, 'image_alpha', f.image_alpha, 1, 8);
      // _tarDepth = charinstance.depth - 1 — obj_knight_enemy Step_0:1669,
      // written to every flake at :1681; the flake's own Step_0:57-60 drops
      // it to this depth within 120px of its target. It WAS pinned -1 here,
      // which reads charinstance's depth as 0 — but obj_battlecontroller
      // Create_0:192 (the same line in all four of its branches) sets
      // `global.charinstance[i].depth = 200 - (i * 20)`: the 200/180/160
      // sim/actors.js measured off the flurry2 trace, and roster.js's
      // slotDepth(). So a flake thrown at slot 0 charges at depth 199 — just
      // over Kris, still BEHIND slots 1-2, the Knight (88) and the box (5) —
      // not at -1, over everything. DRAW ORDER ONLY: nothing mechanical reads
      // depth (sim/entity.js phaseList sorts by seq), no kaizo check pins
      // tardep, and the RNG stream is untouched. Found by the Draw port's
      // depth check (kaizo/render/draw/snowgrave.js, "DEPTH").
      f.tardep = slotDepth(sc.sg.target) - 1;
      f.con = 2;
      f.tarX = tarX;
      f.tarY = tarY;
    }
    // NOTE: no delay is armed here. The scene sits at 5.1 until a flake
    // reaches its target and sets k_sgscene = max(6, ...) from its own Step.
  } else if (s === 6) {
    // Delay armed FIRST, then the value — so the nohitmode abort below leaves
    // a `k_sgscene = 7` in flight that resurrects the scene 25 frames later.
    // ORIGINAL BEHAVIOUR, preserved: combined with the re-arm at :1543 it can
    // restart the scene from 1 in the meantime.
    scrDelayVar(state, 'sg', 7, 25);
    setScene(state, 'sg', 6.1);
    if (kn.nohitmode) {
      kn.progamer = false;
      setScene(state, 'sg', 0);
      k.mnfight = 99;
      k.myfight = 99;
    }
  } else if (s === 6.1) {
    // ── THE FREEZE TICK — freeze.js owns this, verbatim (:1699-1725) ────
    // Runs on each of the 24 frames between state 6 and the delayed 7.
    const before = rng?.draws ?? 0;
    const r = stepSnowgraveFreeze(state, { target: sc.sg.target });
    draw(state, 'sg', (rng?.draws ?? 0) - before);
    sc.sg.ticks += 1;
    if (r.frozen) sc.sg.frozeOn = state.frame;
  } else if (s === 7) {
    // ── THE TALLY (:1726-1756) ──────────────────────────────────────────
    kt.knightState = 0;
    scrDelayVar(state, 'sg', 8, 30);
    setScene(state, 'sg', 7.1);
    const a = writerAnchor(state, sc.sg.target);
    const casterChar = charIdOf(state, sc.sg.caster);
    const sgdmg = state.kaizo.sgdmg ?? 0;
    // `dm.type = global.char[k_sgcaster] - 1`, then overridden to 6 when the
    // caster is Noelle — which on the Weird Route it always is.
    const writerType = casterChar === 4 ? 6 : casterChar - 1;
    sc.writers.push({
      frame: state.frame,
      x: a.x + 24,
      y: a.y,
      damage: sgdmg,
      type: writerType,
    });
    // AND ACTUALLY SPAWN IT. The record above is the scene's own ledger, which
    // the checks read; it is not a writer, and nothing painted it, so the one
    // number that tells the player what the spell just did — the whole
    // accumulated k_sgdmg, in Noelle's type-6 yellow — existed as data with
    // zero consumers. Same shape as the xslashGridHeads defect: computed,
    // never read.
    //
    // Through the ENGINE's entry point, not a private drawer, so it inherits
    // obj_dmgwriter's pose, its bounces and its kill ramp. `delay = 2` is the
    // Create's own. The `random(600)` placeholder roll inside spawnDmgNumber
    // is obj_dmgwriter's and is what the GML spends here too, so the scene's
    // draw budget gains exactly the draw the game gains.
    spawnDmgNumber(state, a.x + 24, a.y, sgdmg, writerType, 2);
    draw(state, 'sg', 1);
    if (state.kaizo.faceaction) state.kaizo.faceaction[sc.sg.target] = 0;
    const targetChar = charIdOf(state, sc.sg.target);
    if (targetChar !== 4) {
      if ((state.partyHp?.[sc.sg.target] ?? 1) <= 0) {
        sc.recruitanim = { frame: state.frame, x: a.x + 38, y: a.y - 32, imageIndex: 12 };
      }
    } else {
      // `scr_minishakeobj(obj_heronoelle)` (:1745-1751) — the target is Noelle
      // herself, who cannot be frozen, so the spell shakes her instead. This
      // recorded a frame number and shook nobody; scrMinishakeobj is right
      // here in this file and takes the actor.
      sc.noelleShake = state.frame;
      scrMinishakeobj(state, heroActorAt(state, sc.sg.target));
    }
  } else if (s === 8) {
    // ── TEARDOWN (:1757-1765) ───────────────────────────────────────────
    for (const f of flakes(state)) destroy(f);
    for (const e of state.entities ?? []) {
      if (e.alive && e.type === snowgraveSpell) destroy(e);
    }
    k.spelldelay = SG_SPELLDELAY_RELEASE;        // THE RELEASE
    setScene(state, 'sg', 0);
    kt.sceneFloat = 1;
    kt.yoff = 0;
  }

  // `scr_lerpvar("k_sgpit", 0.7, 1.1, 75)` — stepped because its value is read
  // by the wing pitch above. Linear, matching obj_lerpvar's default curve.
  const pl = sc.sg.pitLerp;
  if (pl && pl.t < pl.frames) {
    pl.t += 1;
    sc.sg.pit = pl.from + (pl.to - pl.from) * (pl.t / pl.frames);
  }

  floatKnight(state);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// THE PER-FRAME STEP
// ───────────────────────────────────────────────────────────────────────────

/**
 * One frame of all four scenes, IN THE ORDER obj_knight_enemy's Step_0 runs
 * them: k_nhscene (1408), the k_sgscene arm (1543), k_sgscene (1547), then the
 * `if (k_sideb || k_hpscene > 0)` block, which holds k_hpscene (1774) and
 * k_tpscene (1930) in that order.
 *
 * THE OUTER GATE IS THE GML'S, LITERALLY. `k_sideb || k_hpscene > 0` — so an
 * A-SIDE run with the max-HP shear armed still steps this block, which is the
 * whole reason the mod wrote the gate that way instead of `if (k_sideb)`. The
 * two branch bodies each re-test their own scene number, so the tp branch is a
 * no-op on the A-Side rather than something this function has to guard.
 *
 * Call this from the knight's step — the flakes must step AFTER it (they are
 * spawned later, so this engine's phaseList already orders them that way).
 *
 * @returns {{nh:boolean, sg:boolean, hp:boolean, tp:boolean}} which scenes ran.
 */
export function stepScenes(state) {
  ensureScenes(state);
  const nh = stepNhscene(state);
  armSgsceneIfSpell(state);
  const sg = stepSgscene(state);
  const blockOpen = !!state.kaizo.sideb || (state.kaizo.hpscene ?? 0) > 0;
  const hp = blockOpen ? stepHpscene(state) : false;
  const tp = blockOpen ? stepTpscene(state) : false;
  return {
    nh, sg, hp, tp,
  };
}

/**
 * The driver as an entity, for a scene that would rather spawn it than call
 * `stepScenes` by hand. Spawn it BEFORE anything else that reads scene state,
 * so it steps first (phaseList sorts by spawn seq).
 */
export const kaizoSceneDriver = {
  name: 'kaizo_knight_scenes',
  create(e, state) {
    e.visible = false;
    ensureScenes(state);
  },
  step(e, state) {
    stepScenes(state);
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Reporting
// ───────────────────────────────────────────────────────────────────────────

/**
 * Everything a HUD or a check wants, in one read. `clampActive` is
 * tensionbar.js's own gate, asked through its own function so the two can
 * never drift apart.
 */
export function sceneReport(state) {
  const sc = ensureScenes(state);
  const k = state.kaizo;
  return {
    hpscene: k.hpscene ?? 0,
    hpcut: sc.hp.cut,
    tpscene: kaizoTpscene(state),
    sgscene: k.sgscene ?? 0,
    nhscene: k.nhscene ?? 0,
    clampActive: kaizoTensionClampActive(state),
    hijacked: sceneHijacksTurn(state),
    spellphaseStalled: sceneStallsSpellphase(state),
    target: sc.sg.target,
    flakes: flakes(state).length,
    draws: { ...sc.draws },
    transitions: sc.log.length,
  };
}

/** The distinct states a scene actually visited — the check's anti-stall read. */
export function visitedStates(state, scene) {
  const seen = [];
  for (const t of ensureScenes(state).log) {
    if (t.scene === scene && !seen.includes(t.to)) seen.push(t.to);
  }
  return seen;
}
