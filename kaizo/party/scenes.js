// KAIZO V-D (B-Side) — THE THREE TURN-HIJACKING SCENES.
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
//   gml_Object_obj_knight_enemy_Step_0.gml         1408-1541 k_nhscene
//                                                  1543-1545 the k_sgscene arm
//                                                  1547-1770 k_sgscene
//                                                  1930-2049 k_tpscene
//                                                  679-756   turnsafternohit
//   gml_GlobalScript_scr_mnendturn.gml             148-169   BOTH arms
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
// ═══ WHAT THESE THREE ARE ═══════════════════════════════════════════════════
//
// Each one takes a WHOLE TURN away from the player and plays a cutscene the
// A-Side fight has no equivalent of. Together they are the third of the Weird
// Route that the sim was missing (WEIRD-ROUTE.md §6.C item 6).
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
// three sites:
//
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
import { cue } from '../../sim/audio.js';
import { KNIGHT } from '../../sim/actors.js';
import { stepSnowgraveFreeze, ensureFreezeState } from './freeze.js';
import { kaizoTensionClampActive, kaizoTpscene } from './tensionbar.js';
import { writerAnchor, charIdOf, rosterSize, slotDepth } from './roster.js';
import { scrPicktargetWeighted, scrDead } from './damage.js';

// ───────────────────────────────────────────────────────────────────────────
// Constants, all cited
// ───────────────────────────────────────────────────────────────────────────

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
    draws: { tp: 0, sg: 0, nh: 0, flakes: 0 },
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

/** True while ANY of the three is running. */
export function sceneActive(state) {
  const k = state.kaizo ?? {};
  return (k.tpscene ?? 0) > 0 || (k.sgscene ?? 0) > 0 || (k.nhscene ?? 0) > 0;
}

// ───────────────────────────────────────────────────────────────────────────
// Internals
// ───────────────────────────────────────────────────────────────────────────

function draw(state, who, n = 1) {
  ensureScenes(state).draws[who] += n;
}

/** `global.battlemsg[0] = ...` / `k_msgsetloc(0, ...)`. Recorded, not drawn. */
function msg(state, text) {
  ensureScenes(state).msgs.push({ frame: state.frame, text });
}

/** `scr_lerpvar(name, from, to, frames, ...)`. Recorded, not animated. */
function noteLerp(state, name, from, to, frames) {
  ensureScenes(state).lerps.push({ frame: state.frame, name, from, to, frames });
}

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
    noteLerp(state, 'x', kt.x, kt.x + 32, 8);
    noteLerp(state, 'y', kt.y, kt.y - 40, 8);
  } else if (s === 2) {
    setScene(state, 'tp', 2.1);
    kt.imageIndex = 1;
    scrDelayVar(state, 'tp', 3, 8);
    // camerax() + 320 / cameray() + 24 — the leap to the top of the screen.
    const vx = state.view?.x ?? 0;
    const vy = state.view?.y ?? 0;
    noteLerp(state, 'x', kt.x, vx + 320, 8);
    noteLerp(state, 'y', kt.y, vy + 24, 8);
  } else if (s === 3) {
    setScene(state, 'tp', 3.1);
    kt.imageIndex = 2;
    scrDelayVar(state, 'tp', 4, 7);
    const vx = state.view?.x ?? 0;
    const vy = state.view?.y ?? 0;
    noteLerp(state, 'x', kt.x, vx + 48, 7);
    noteLerp(state, 'y', kt.y, vy + 64, 7);
  } else if (s === 4) {
    // remdepth = depth; depth = obj_tensionbar.depth - 1; + the afterimage
    // depth juggle. Pure draw order; recorded so it is not silently lost.
    kt.remdepth = kt.depth;
    kt.depth = (state.kaizo.tensionbarDepth ?? 0) - 1;
    setScene(state, 'tp', 4.1);
    scrDelayVar(state, 'tp', 5, 1);
    cue(state, 'snd_knight_cut');
    noteLerp(state, 'image_index', 3, 5, 3);
    noteLerp(state, 'x', kt.x, kt.x - 64, 8);
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
    // instance_create(x, y, obj_shake); shakex = 8; shakespeed = 1.
    sc.shake = { shakex: 8, shakespeed: 1, frame: state.frame };
  } else if (s === 11) {
    kt.depth = kt.remdepth;
    kt.siner2 = 0;
    setScene(state, 'tp', 11.1);
    scrDelayVar(state, 'tp', 11.2, 12);
    noteLerp(state, 'x', kt.x, kt.xstart, 25);
    noteLerp(state, 'y', kt.y, kt.ystart + Math.cos(kt.siner2 / 8) * 8, 25);
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
      noteLerp(state, 'image_index', 0, 4, 3);
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
      // All four down-messages suppressed at once: the Knight has already
      // said it, so the party's own fall lines never print.
      const kk = state.kaizo;
      kk.krisdownmessage = true;
      kk.susiedownmessage = true;
      kk.ralseidownmessage = true;
      kk.noelledownmessage = true;
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
    noteLerp(state, 'image_index', 0, 3, 3);
  } else if (s === 3.1) {
    setScene(state, 'sg', 3);
    scrDelayVar(state, 'sg', 4, 75);
    // scr_lerpvar("k_sgpit", 0.7, 1.1, 75) — the rising whine. Its VALUE
    // feeds the wing pitch above, so unlike the other lerps it is stepped.
    sc.sg.pitLerp = { from: 0.7, to: 1.1, frames: 75, t: 0 };
    noteLerp(state, 'k_sgpit', 0.7, 1.1, 75);
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
    noteLerp(state, 'image_index', 1, 2, 4);
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
    noteLerp(state, 'image_index', 3, 5, 3);
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
    sc.writers.push({
      frame: state.frame,
      x: a.x + 24,
      y: a.y,
      damage: state.kaizo.sgdmg ?? 0,
      // `dm.type = global.char[k_sgcaster] - 1`, then overridden to 6 when the
      // caster is Noelle — which on the Weird Route it always is.
      type: casterChar === 4 ? 6 : casterChar - 1,
    });
    if (state.kaizo.faceaction) state.kaizo.faceaction[sc.sg.target] = 0;
    const targetChar = charIdOf(state, sc.sg.target);
    if (targetChar !== 4) {
      if ((state.partyHp?.[sc.sg.target] ?? 1) <= 0) {
        sc.recruitanim = { frame: state.frame, x: a.x + 38, y: a.y - 32, imageIndex: 12 };
      }
    } else {
      sc.noelleShake = state.frame;    // scr_minishakeobj on obj_heronoelle
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
 * One frame of all three scenes, IN THE ORDER obj_knight_enemy's Step_0 runs
 * them: k_nhscene (1408), the k_sgscene arm (1543), k_sgscene (1547), then
 * k_tpscene (1930, inside the `if (k_sideb || k_hpscene > 0)` block).
 *
 * Call this from the knight's step — the flakes must step AFTER it (they are
 * spawned later, so this engine's phaseList already orders them that way).
 *
 * @returns {{nh:boolean, sg:boolean, tp:boolean}} which scenes ran.
 */
export function stepScenes(state) {
  ensureScenes(state);
  const nh = stepNhscene(state);
  armSgsceneIfSpell(state);
  const sg = stepSgscene(state);
  // The tp block sits inside `if (k_sideb || k_hpscene > 0)`. k_hpscene is
  // the max-HP-cheater scene and is not this module's; the k_sideb half is.
  const tp = state.kaizo.sideb ? stepTpscene(state) : false;
  return { nh, sg, tp };
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
