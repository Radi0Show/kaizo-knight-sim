// KAIZO V-C/V-D — scr_damage, rewritten by the mod and re-based on a roster
// that can be two people long.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE (kaizo dump / vanilla v105, knight-research/kaizo-mod):
//   gml_GlobalScript_scr_damage.gml              the whole script
//   gml_GlobalScript_scr_damage_all.gml          scr_damage_all + the NEW
//                                                scr_damage_all_maxhp
//   gml_GlobalScript_scr_damage_maxhp.gml        the fraction path
//   gml_GlobalScript_scr_damage_calculation.gml  the defence walk
//   gml_GlobalScript_scr_randomtarget_old.gml    the dead-target re-roll
//   gml_GlobalScript_kaizo_settings_init.gml     scr_kaizo_target,
//                                                scr_picktarget_weighted
//   gml_Object_obj_knight_enemy_Create_0.gml     aoedamage, damagecounter,
//                                                k_sideb, k_gloom, k_freeze,
//                                                kaizo_block
//   gml_Object_obj_heroparent_Step_0.gml         the party-alive multiplier
//   deltas/gml_GlobalScript_scr_damage.md, .../scr_damage_all.md,
//   .../obj_heroparent_Step_0.md
//
// This is a KAIZO COPY of sim/damage.js (HANDOFF §2.3: copy, never patch).
// sim/damage.js stays exactly as the 60 suites verified it.
//
// ── WHAT THE MOD CHANGES, and every one is implemented below ──────────────
//
//  1. TARGETING IS REPLACED WHOLESALE. Vanilla's ~75-line block becomes one
//     call to `scr_kaizo_target()`. Net effect:
//       · KRIS'S MERCY IS GONE. Vanilla redirected every slot-0 hit onto
//         Susie or Ralsei; kaizo rolls an HP-weighted range in which Kris
//         becomes MORE likely as the others weaken. He is now the default
//         victim, not the protected one.
//       · The ShadowMantle absorbs 2 consecutive hits, not 3.
//       · The sword tunnel's `myattackchoice != 13` exemption is gone — the
//         mantle redirect applies during every attack.
//       · It reads through `global.char[]`, so reordered and 4-character
//         parties work.
//  2. NOELLE TAKES HALF. `if (global.char[target] == 4) tdamage =
//     round(tdamage * 0.5)`, stacking after a mantle 0.33.
//  3. VANILLA'S FLURRY SOFTENING IS GONE. attack 2 at difficulty 1/3 no
//     longer takes x0.66 (sim/damage.js's `opts.flurrySoftened`).
//  4. EVERYONE SWOONS. Kris's `round(-maxhp/2)` DOWN is deleted; every fell
//     in this fight goes to -999 with doomtype 12.
//  5. SIDE-B GLOOM. Every hit banks `ceil(damage/6)` (min 10) of gloom, and
//     raw damage over 120 is softened x0.8 BEFORE the pipeline.
//  6. PRACTICE MODE cannot down anyone (HP set to 2x max, restored after).
//
// ── AND WHAT THE ROSTER CHANGES ───────────────────────────────────────────
// sim/damage.js is three-person in `PARTY`, `PARTY_POS`, `partyWiped`,
// `partyStatus`, `freshParty` and `battleDf`; sim/knight.js's `krisMult`
// reads `partyHp[1]` and `partyHp[2]` by literal index. All of that is
// re-expressed here against `state.kaizo.roster`. Nothing indexes a third
// slot on a two-person party.

import { gmlRound } from '../../sim/gml.js';
import { gmlChoose, gmlRandomRange, gmlIrandom } from '../../sim/rng.js';
import { spawnDmgNumber, TYPE_PARTY, TYPE_DEAD, TYPE_SWOON } from '../../sim/dmgnumbers.js';
import { scrShakescreen } from '../../sim/shake.js';
import { cue } from '../../sim/audio.js';
import {
  CHAR_NONE, CHAR_NOELLE, globalChar, rosterSize, charIdOf, memberAt,
  hpOfChar, setHpOfChar, maxhpOfChar, gearOfChar, statFor, setGloom, isUp,
} from './roster.js';
import { THORN_RING } from './noelle.js';
import { heroHurt } from './heroes.js';

export { statFor, isUp };

/** DEFEND — `global.charaction[slot] == 10`. Unchanged by the mod. */
export const ACTION_DEFEND = 10;
/** `+40` TP per defender. Unchanged. */
export const TP_DEFEND = 40;
/** `global.chararmor1/2[c] == 23` — the ShadowMantle. */
export const SHADOW_MANTLE = 23;

export const UP = 'UP';
export const DOWN = 'DOWN';
export const SWOON = 'SWOON';

/**
 * `PARTY_POS` for a roster — the point a writer over this member pops from.
 * sim/damage.js hardcodes three; this reads the slot the member stands in.
 */
export function partyPos(state, slot) {
  return memberAt(state, slot)?.pos ?? { x: 0, y: 0 };
}

/**
 * UP / DOWN / SWOON.
 *
 * ONE OF THESE THREE IS NOW UNREACHABLE IN THIS FIGHT. Vanilla gave Kris
 * `round(-maxhp / 2)` (DOWN, healable) and everyone else -999 (SWOON); the
 * mod deletes the Kris case, so every fell in the kaizo knight fight lands at
 * -999 and DOWN never occurs. The state is kept because the derivation is
 * still HP-driven and a non-knight caller could produce it — and because
 * erasing it would hide the delta rather than record it.
 */
export function statusOf(state, slot) {
  const hp = state.partyHp[slot];
  if (hp > 0) return UP;
  return hp <= -999 ? SWOON : DOWN;
}

export function partyStatus(state) {
  const out = [];
  for (let i = 0; i < rosterSize(state); i++) out.push(statusOf(state, i));
  return out;
}

/** `scr_dead(slot)` — the five globals. Slot-indexed, roster-bounded. */
export function scrDead(state, slot) {
  if (slot < 0 || slot >= rosterSize(state)) return;
  if (state.charmove) state.charmove[slot] = 0;
  if (state.charcantarget) state.charcantarget[slot] = 0;
  if (state.chardead) state.chardead[slot] = 1;
  if (state.charaction) state.charaction[slot] = 0;
  if (state.charspecial) state.charspecial[slot] = 0;
}

/** `scr_revive(slot)` — THREE of the five. charaction/charspecial stay 0. */
export function scrRevive(state, slot) {
  if (slot < 0 || slot >= rosterSize(state)) return;
  if (state.charmove) state.charmove[slot] = 1;
  if (state.charcantarget) state.charcantarget[slot] = 1;
  if (state.chardead) state.chardead[slot] = 0;
}

/**
 * `scr_damage_calculation(damage, slot)` — the defence walk, verbatim,
 * INCLUDING the `max(_tdamage, 1)` the sim's copy leaves off.
 *
 * The two indexings meet inside this one function and it is worth staring at:
 *
 *     var _tdef   = global.battledf[arg1];                  // SLOT
 *     var _tmaxhp = global.maxhp[global.char[arg1]];         // CHARACTER
 *
 * The step size scales with the TARGET'S OWN max HP, which is why Noelle's
 * 120 makes her defence bite at lower absolute damage than Kris's 160 — and
 * why her base DF of 1 (one step, not two) costs her so much.
 *
 * The inner floor is unobservable in the final number (the caller floors at 1
 * again after the multipliers, and every path through the multipliers maps
 * <=1 back to 1) but it is in both the mod's and vanilla v105's source, so it
 * is here.
 */
export function scrDamageCalculation(state, damage, slot) {
  let d = damage;
  const def = statFor(state, slot).df;
  const maxhp = maxhpOfChar(state, charIdOf(state, slot));
  const a = maxhp / 5;
  const b = maxhp / 8;
  for (let i = 0; i < def; i++) {
    if (d > a) d -= 3;
    else if (d > b) d -= 2;
    else d -= 1;
  }
  return Math.max(d, 1);
}

/** `global.chararmor1[c] == 23 || global.chararmor2[c] == 23`, by CHARACTER. */
function charWearsMantle(state, charId) {
  if (charId === CHAR_NONE) return false;
  if (state.noMantle) return false;
  return (gearOfChar(state, charId).armor ?? []).includes(SHADOW_MANTLE);
}

/**
 * `scr_randomtarget_old()` — the dead-target re-roll that opens scr_damage.
 *
 *     mytarget = choose(0, 1, 2);
 *     if (abletotarget) while (global.charcantarget[mytarget] == 0)
 *         mytarget = choose(0, 1, 2);
 *
 * A REJECTION LOOP, so the draw count is unbounded — count them, do not model
 * it as a filtered pick. `charcantarget` for an empty slot is undefined in
 * this roster model and reads as 0, which is what an unset GML array slot
 * does, so a two-person party can never be sent to slot 2.
 *
 * `global.targeted[mytarget] = 1` is menu bookkeeping with no reader in this
 * fight; skipped, and it draws no RNG.
 */
/**
 * THE RULES scr_damage RUNS BEFORE scr_kaizo_target (scr_damage:33-76) --
 * the dead-slot re-roll and the `target == 4` branch. Shared by the kaizo
 * scrDamage below and by kaizoKnightTarget, the hook sim/damage.js
 * knightTarget hands the live single-hit path to (kaizo-fight.js): the hook
 * used to be scr_kaizo_target itself, so on the path every bullet actually
 * travels neither rule ever ran.
 */
export function scrDamagePretarget(state, target) {
  let t = target;

  //     if (target < 3 && global.hp[global.char[target]] <= 0) {
  //         scr_randomtarget_old(); target = mytarget; ... }
  if (t < 3 && t >= 0 && hpOfChar(state, charIdOf(state, t)) <= 0) {
    const m = scrRandomtargetOld(state);
    if (m !== 3) t = m;
  }

  // `if (target == 4)` — scr_damage:56-76. Four is the knight's `mytarget`
  // (scr_randomtarget's chapter-2+ tail), stamped on the controller by
  // scr_bulletspawner and inherited by every manager and bullet under it
  // (kaizo-mod-launcher.js dcInheritable). The roll is scr_randomtarget_old
  // — choose(0,1,2), rolled again while the slot cannot be targeted, and a
  // slot scr_dead cleared STAYS cleared under the recorder's HP pin (the
  // five globals): the f885 sword killed Susie, and the f898 blade's roll
  // landed on her and rolled once more. MEASURED, kaizo_oracle_drawprobe.
  // Then two identical checks against half the party's HP average and one
  // against 0.35 for Kris; unreachable under the pin, translated anyway.
  // `__remtarget` puts the bullet's own target back to 4 at the end
  // (scr_damage:356-359) so it rolls afresh next hit; the caller here
  // passes a value and keeps its own field, so there is nothing to restore.
  // scr_randomtarget_old answers 3 with nobody targetable (a wiped party --
  // the game is over by then); a 3 here has no stats, so the previous slot
  // stands in. Unreachable in a recorded fight.
  const pick = (fallback) => { const m = scrRandomtargetOld(state); return m === 3 ? fallback : m; };
  if (t === 4) {
    t = pick(0);
    if (hpRatioOfSlot(state, t) < scrPartyHpaverage(state) / 2) t = pick(t);
    if (hpRatioOfSlot(state, t) < scrPartyHpaverage(state) / 2) t = pick(t);
    if (t === 0 && hpRatioOfSlot(state, t) < 0.35) t = pick(t);
  }

  return t;
}

/**
 * The kaizo lane's knightTarget hook: scr_damage's pre-targeting rules,
 * then scr_kaizo_target. Registered by kaizo-fight.js for the mod versions.
 */
export function kaizoKnightTarget(state, target, opts = {}) {
  return scrKaizoTarget(state, scrDamagePretarget(state, target), opts);
}
/**
 * `scr_party_hpaverage()` — floor(total hp / total max hp) over the occupied
 * slots, 0 with no hp at all. The floor makes it 1 only when everyone is
 * full and 0 otherwise, so scr_damage's "below half the average" re-rolls
 * can only ever fire against a threshold of 0.5 with a full party — and a
 * full party has no member below it. Translated verbatim regardless.
 */
export function scrPartyHpaverage(state) {
  let totalhp = 0;
  let totalmaxhp = 0;
  for (let i = 0; i < 3; i++) {
    if (i >= rosterSize(state)) continue;
    const ch = charIdOf(state, i);
    if (ch > 0) {
      totalhp += hpOfChar(state, ch);
      totalmaxhp += maxhpOfChar(state, ch);
    }
  }
  return totalhp > 0 ? Math.floor(totalhp / totalmaxhp) : 0;
}

/** `global.hp[global.char[slot]] / global.maxhp[global.char[slot]]`; 1 off the roster (scr_randomtarget_old's 3). */
function hpRatioOfSlot(state, slot) {
  if (slot < 0 || slot >= rosterSize(state)) return 1;
  const ch = charIdOf(state, slot);
  return hpOfChar(state, ch) / maxhpOfChar(state, ch);
}

export function scrRandomtargetOld(state) {
  let abletotarget = 1;
  let any = false;
  for (let i = 0; i < 3; i++) if (state.charcantarget?.[i]) any = true;
  if (!any) abletotarget = 0;
  const draw = () => (state.gmlRng ? gmlChoose(state.gmlRng, [0, 1, 2]) : 0);
  let mytarget = draw();
  if (abletotarget === 1) {
    // Bounded defensively at 64 rejections: the GML loop cannot terminate if
    // nothing is targetable, but `abletotarget` already guarantees one is.
    let guard = 0;
    while (!state.charcantarget?.[mytarget] && guard < 64) {
      mytarget = draw();
      guard += 1;
    }
  } else {
    mytarget = 3;
  }
  return mytarget;
}

/**
 * `scr_kaizo_target()` — kaizo_settings_init, the mod's whole targeting
 * policy, verbatim in order and in draw count.
 *
 * ── THE RANGE ─────────────────────────────────────────────────────────────
 *
 *     _sus = max(hp[char[1]] / maxhp[char[1]], 0.45);   if char[1]==0 -> 0
 *     _ral = max(hp[char[2]] / maxhp[char[2]], 0.45);   if char[2]==0 -> 0
 *     _krisrange = 2 - _sus - _ral;
 *     _hitstat   = random_range(0, 2);
 *     if (hp[char[0]] < 0) _krisrange = -1;
 *     if (_hitstat > _krisrange) -> hit a COMPANION (Kris only if none up)
 *     else                      -> hit KRIS
 *
 * Read it as a number line from 0 to 2: `[0, _krisrange)` is Kris's share and
 * the rest belongs to the companions. Full-health companions clamp at 1.0
 * each, so a full three-person party gives Kris range 0 — he is never hit —
 * and as the others fall toward the 0.45 floor his share grows to 1.1. A
 * DOWNED Kris sets the range to -1 so every roll goes to a companion.
 *
 * ON A TWO-PERSON WEIRD ROUTE PARTY THE MATH CHANGES SHAPE. `_ral` is
 * forced to 0 by the empty slot 2, so `_krisrange = 2 - _sus` — between 1.0
 * (Noelle at full HP) and 1.55 (Noelle at or below 45%). KRIS TAKES AT LEAST
 * HALF THE HITS FROM THE FIRST FRAME, and up to 77.5% as Noelle weakens.
 * That is the opposite of the vanilla fight, where he takes none.
 *
 * ── THE DRAWS, which is the part a translation gets wrong ─────────────────
 *   · `random_range(0, 2)` — ONE draw, every non-mantle-redirected hit.
 *   · `choose(1, 2)` — a SECOND draw, and ONLY when BOTH companions are up.
 *     A two-person party has `_hp2 == 0` always, so THIS DRAW NEVER FIRES ON
 *     THE WEIRD ROUTE. The RNG stream for a Kris+Noelle run is one draw per
 *     hit; a three-person run is one or two.
 *   · A mantle redirect draws NOTHING.
 *
 * ── THE ODDITY, PRESERVED ─────────────────────────────────────────────────
 * The companion branch opens with `if (_hp0 > 0) target = 0;` — it sets Kris
 * FIRST and only then tries to overwrite him with a companion. So when the
 * roll says "companion" and no companion is up, the hit lands on Kris; and if
 * NOBODY is up, `target` keeps whatever the caller passed. Not a filter, a
 * sequence of overwrites, and translated as one.
 *
 * ── ORIGINAL HAZARD, PRESERVED ────────────────────────────────────────────
 * `_ral` divides by `global.maxhp[global.char[2]]`, which is `global.maxhp[0]`
 * — explicitly `0` in scr_gamestart — whenever slot 2 is empty. The division
 * is evaluated before the `if (char[2] == 0) _ral = 0;` guard overwrites it,
 * so the mod really does compute 0/0 on every two-person hit and then throw
 * the answer away. Reproduced in that order (JS yields NaN and the guard
 * clears it) rather than short-circuited, because the ORDER is the fact.
 *
 * @returns {number} the new `target` slot
 */
export function scrKaizoTarget(state, target, opts = {}) {
  const k = state.knight;
  // `if (obj_knight_enemy.aoedamage == false)` wraps the ENTIRE body — an
  // attack that hits everyone hits everyone, with no roll and no counter.
  // The flag lives on the knight and is set by the CALLER (scr_damage_all
  // brackets its loop with it); `opts.aoe` is for a caller with no knight.
  const aoe = opts.aoe ?? k?.aoedamage ?? false;
  if (aoe) return target;

  const gc = globalChar(state);
  const ch0 = gc[0];
  const ch1 = gc[1];
  const ch2 = gc[2];
  const hp0 = hpOfChar(state, ch0) * (ch0 > 0 ? 1 : 0);
  const hp1 = hpOfChar(state, ch1) * (ch1 > 0 ? 1 : 0);
  const hp2 = hpOfChar(state, ch2) * (ch2 > 0 ? 1 : 0);

  let mantlechar = -1;
  if (charWearsMantle(state, ch0) && hpOfChar(state, ch0) > 0) mantlechar = 0;
  if (charWearsMantle(state, ch1) && hpOfChar(state, ch1) > 0) mantlechar = 1;
  if (charWearsMantle(state, ch2) && hpOfChar(state, ch2) > 0) mantlechar = 2;
  const mc = mantlechar;
  // MANTLE 3 -> 2. Vanilla's counter ran to `< 3`; kaizo disables the
  // redirect at `>= 2`, so the wearer eats two consecutive hits instead of
  // two in every three.
  if ((k?.damagecounter ?? 0) >= 2) mantlechar = -1;

  let t = target;
  if (mantlechar === -1) {
    let sus = Math.max(hpOfChar(state, ch1) / maxhpOfChar(state, ch1), 0.45);
    let ral = Math.max(hpOfChar(state, ch2) / maxhpOfChar(state, ch2), 0.45);
    if (gc[1] === CHAR_NONE) sus = 0;
    if (gc[2] === CHAR_NONE) ral = 0;
    let krisrange = 2 - sus - ral;
    const hitstat = state.gmlRng ? gmlRandomRange(state.gmlRng, 0, 2) : 0;
    if (hpOfChar(state, ch0) < 0) krisrange = -1;
    if (hitstat > krisrange) {
      if (hp0 > 0) t = 0;
      if (hp1 > 0 && hp2 > 0) t = state.gmlRng ? gmlChoose(state.gmlRng, [1, 2]) : 1;
      else if (hp1 > 0) t = 1;
      else if (hp2 > 0) t = 2;
    } else {
      t = 0;
    }
    if (t !== mc) {
      if (k) k.damagecounter = 0;
    }
  } else {
    if (k) k.damagecounter = (k.damagecounter ?? 0) + 1;
    t = mantlechar;
  }
  return t;
}

/**
 * `scr_picktarget_weighted(a, b, c, d)` — the mod's other picker, CHARACTER-
 * weighted (arg i is character i+1) but returning a SLOT via `charpos`.
 *
 * Nothing in scr_damage calls it; the knight's attack objects do. It lives
 * here because it is roster machinery and every consumer needs it to be
 * roster-driven. ONE draw — `irandom(_targmax)` — and only when the bag is
 * non-empty; an empty bag returns slot 0 with NO draw.
 */
export function scrPicktargetWeighted(state, w1 = 1, w2 = 1, w3 = 1, w4 = 1) {
  const reps = [w1, w2, w3, w4];
  const havechar = state.kaizo?.havechar ?? [0, 0, 0, 0];
  const charpos = state.kaizo?.charpos ?? [0, 0, 0, 0];
  const bag = [];
  let targmax = -1;
  for (let i = 0; i < 4; i++) {
    // `havechar[i] && global.hp[i + 1] > 0` — CHARACTER-indexed HP.
    if (havechar[i] && hpOfChar(state, i + 1) > 0) {
      for (let r = 0; r < reps[i]; r++) {
        targmax += 1;
        bag.push(charpos[i]);
      }
    }
  }
  if (bag.length > 0) {
    // `irandom(_targmax)` — TWO u32 draws in GML (sim/rng.js's gmlIrandom
    // composes a 63-bit value from two words). Reaching for random_range here
    // would produce the same slot and the wrong stream.
    const idx = state.gmlRng ? gmlIrandom(state.gmlRng, targmax) : 0;
    return bag[Math.min(idx, bag.length - 1)];
  }
  return 0;
}

/**
 * SIDE-B GLOOM, the pre-compute. scr_damage's first act inside `global.inv < 0`:
 *
 *     _gloomdmg = ceil(damage / 6);
 *     if (_gloomdmg < 10) _gloomdmg = 10;
 *     if (damage > 120) damage = ceil(damage * 0.8);
 *
 * ORDER IS THE MECHANIC: gloom is banked from the PRE-softened damage, then
 * the softening feeds the whole rest of the pipeline. A 200-damage hit banks
 * 34 gloom and lands for 160-before-defence, not 27 and 160.
 */
export function gloomPrecompute(damage) {
  let gloomdmg = Math.ceil(damage / 6);
  if (gloomdmg < 10) gloomdmg = 10;
  const softened = damage > 120 ? Math.ceil(damage * 0.8) : damage;
  return { gloomdmg, damage: softened };
}

/**
 * SIDE-B GLOOM, the accrual. scr_damage's tail:
 *
 *     if (hp[chartarget] > 1 && !practicemode) {
 *         if (chartarget == 4 && global.charweapon[4] == 13) _gloomdmg = 0;
 *         k_gloom[chartarget] += _gloomdmg;
 *         k_gloom[chartarget] = min(k_gloom[chartarget], hp[chartarget] - 1);
 *         if (k_gloom[chartarget] > 45) k_gloom[chartarget] = 45;
 *     } else k_gloom[chartarget] = 0;
 *
 * THE THORNRING MAKES NOELLE IMMUNE — `charweapon[4] == 13`. Which is exactly
 * the Weird Route loadout, so on the route the mod is named for, gloom
 * accrues on KRIS ALONE.
 *
 * THE 45 CAP IS ASYMMETRIC. scr_damage_maxhp runs the identical block WITHOUT
 * it (only the `hp - 1` clamp). Deliberate or not, both are reproduced —
 * `capAt45` is the switch and the two call sites pass different values.
 *
 * Written through roster.js's `setGloom`, which updates the contract's
 * slot-indexed `state.kaizo.gloom` AND the mod's character-indexed
 * `gloomByChar` mirror. The mod's own array is char-indexed; see roster.js on
 * the scr_charbox divergence.
 */
export function gloomAccrue(state, chartarget, gloomdmg, { capAt45 = true } = {}) {
  const k = state.kaizo;
  if (!k?.sideb) return;
  const hp = hpOfChar(state, chartarget);
  const practicemode = !!k.practicemode;
  let value;
  if (hp > 1 && !practicemode) {
    let g = gloomdmg;
    if (chartarget === CHAR_NOELLE && gearOfChar(state, CHAR_NOELLE).weapon === THORN_RING) g = 0;
    const minhp = hp - 1;
    value = (k.gloomByChar?.[chartarget] ?? 0) + g;
    value = Math.min(value, minhp);
    if (capAt45 && value > 45) value = 45;
  } else {
    value = 0;
  }
  // The mod's array is CHARACTER-indexed and it writes it unconditionally —
  // including `chartarget == 3` when nothing set a real target, which lands
  // on Ralsei's cell whether or not Ralsei is in the party. Write the char
  // mirror always; mirror to the contract's slot array only when that
  // character actually occupies a slot.
  if (k.gloomByChar) k.gloomByChar[chartarget] = value;
  const slot = (k.globalChar ?? []).indexOf(chartarget);
  if (slot >= 0) setGloom(state, slot, value);
}

/**
 * PRACTICE MODE'S HP DANCE. `obj_knight_enemy.practicemode` sets every
 * character to 2x max BEFORE the subtraction and back to max at the gameover
 * check, so the number still displays and nobody can ever be downed.
 *
 * CHARACTER-indexed and unconditional over ids 1..4, including characters who
 * are not in the party — writes to absent ids land nowhere, as in the mod
 * (their `global.hp[c]` is simply not read by this fight).
 */
function practiceHp(state, mul) {
  for (let c = 1; c <= 4; c++) {
    const m = maxhpOfChar(state, c);
    if (m > 0) setHpOfChar(state, c, m * mul);
  }
}

/**
 * `scr_damage()` — ONE HIT, the mod's version, in the original's order.
 *
 * `opts`:
 *   aoe             `obj_knight_enemy.aoedamage` for this hit
 *   truedamage      `i_ex(obj_knight_roaring2)` — skips targeting AND the
 *                   whole multiplier chain (the Roaring hit is raw)
 *   elementReduction  scr_element_damage_reduction's factor
 *   retarget        run the caller-level targeting (scr_kaizo_target). The
 *                   AoE loop passes false, because scr_damage_all brackets
 *                   the loop with `aoedamage = true` instead.
 *
 * @returns {number} damage actually dealt
 */
export function scrDamage(state, damage, target, opts = {}) {
  // Scene parity with the oracle harness — sim/damage.js's own rule, kept.
  if (state.damageEnabled === false) return 0;

  const k = state.knight;
  const sideb = !!state.kaizo?.sideb;
  const practicemode = !!state.kaizo?.practicemode;

  // ── 1. GLOOM PRE-COMPUTE + BIG-HIT SOFTENING (B-Side only) ──────────────
  let gloomdmg = 0;
  let dmg = damage;
  if (sideb) {
    const pre = gloomPrecompute(damage);
    gloomdmg = pre.gloomdmg;
    dmg = pre.damage;
  }

  // `with (obj_knight_enemy) progamer = false;` — any landed hit ends the
  // hitless run.
  if (k) k.progamer = false;

  let t = target;

  // ── 2. THE DEAD-TARGET RE-ROLL, which runs BEFORE kaizo targeting ───────
  //     if (target < 3 && global.hp[global.char[target]] <= 0) {
  //         scr_randomtarget_old(); target = mytarget;
  //     }
  // Costs `choose(0,1,2)` draws when it fires. Unchanged from vanilla.
  t = scrDamagePretarget(state, t);

  const truedamage = opts.truedamage ? 1 : 0;

  // ── 3. KAIZO TARGETING ──────────────────────────────────────────────────
  //     `if (global.chapter == 3 && i_ex(obj_knight_enemy) && truedamage == 0)
  //      scr_kaizo_target();` — no aoe test HERE; the aoe test is inside
  //     scr_kaizo_target, reading the flag the caller set.
  let chartarget = 3;
  if (k && truedamage === 0) {
    t = scrKaizoTarget(state, t, { aoe: opts.aoe });
  }

  let tdamage = dmg;
  let shadowmantlereduction = false;

  // ── 4. PRACTICE MODE: 2x max HP before the subtraction ──────────────────
  if (practicemode) practiceHp(state, 2);

  if (t < 3) {
    if (truedamage === 1) {
      // `if (chapter == 3 && truedamage == 1) { }` — an empty branch in the
      // original. The Roaring hit skips defence entirely.
    } else {
      tdamage = scrDamageCalculation(state, tdamage, t);
    }
    chartarget = charIdOf(state, t);

    if (truedamage === 0) {
      // ── 5. THE MANTLE, RE-INDEXED. Vanilla tested chararmor1[1..3] by
      //     literal character id; kaizo tests `global.chararmor1[global.
      //     char[i]]` so a reordered party still finds the wearer. Three
      //     separate `if`s, not an else-chain, and the slot test pins each
      //     one — so only the wearer being hit gets the reduction.
      for (let s = 0; s < 3; s++) {
        if (charWearsMantle(state, charIdOf(state, s)) && t === s) {
          tdamage = gmlRound(tdamage * 0.33);
          shadowmantlereduction = true;
        }
      }
      // ── 6. NOELLE TAKES HALF, and it STACKS on the mantle: the mod runs
      //     `round(round(t * 0.33) * 0.5)` if she wears it. Character id 4,
      //     not slot — she is slot 1 on the Weird Route.
      if (charIdOf(state, t) === CHAR_NOELLE) {
        tdamage = gmlRound(tdamage * 0.5);
      }
    }

    if (truedamage === 1) {
      // empty branch, as above
    } else {
      if (state.charaction?.[t] === ACTION_DEFEND) {
        tdamage = Math.ceil((2 * tdamage) / 3);
      }
      // The element reduction and the mantle NEVER stack — the original's
      // `if (shadowmantlereduction == false)`.
      if (!shadowmantlereduction) {
        tdamage = Math.ceil(tdamage * (opts.elementReduction ?? 1));
      }
    }
    if (tdamage < 1) tdamage = 1;
  }

  // ── 7. THE SHAKE, which is GAMEPLAY. Every offscreen cull compares
  //     against camerax(); sim/damage.js documents the whole-fight frame
  //     this was caught on. One shake per burst (the exists-guard).
  if (!state.entities?.some((sh) => sh.alive && sh.type?.name === 'obj_shake')) {
    scrShakescreen(state);
  }

  // `with (global.charinstance[target]) { hurt = 1; hurttimer = 0; }` — THE
  // FLINCH, which obj_heroparent's Step lets short-circuit every other pose.
  // Placed here, before the HP write, as the original has it. The 12-frame
  // duration is sim/heroes.js's verified model of `hurt`/`hurttimer`, not a
  // second number from the dump.
  heroHurt(state, t);

  let hpdiff = tdamage;
  let doomtype = -1;

  if (t < 3) {
    const hp = hpOfChar(state, chartarget);
    if (hp <= 0) {
      // Already down and hit again: a QUARTER of the damage digs the hole
      // deeper, drawn as a death number. Unchanged from vanilla.
      doomtype = 4;
      setHpOfChar(state, chartarget, hp - gmlRound(tdamage / 4));
      hpdiff = gmlRound(tdamage / 4);
    } else {
      setHpOfChar(state, chartarget, hp - tdamage);
      if (hpOfChar(state, chartarget) <= 0) {
        // ── 8. KRIS'S MERCY IS REMOVED. Vanilla: `target == 0` -> doomtype
        //     4 and `round(-maxhp / 2)`, a hole one heal item can climb out
        //     of. Kaizo sends EVERYONE to -999 with doomtype 12, which
        //     `scr_heal` cannot cross. A down is now permanent for anyone.
        doomtype = 12;
        hpdiff = gmlRound(hpOfChar(state, chartarget) + 999);
        setHpOfChar(state, chartarget, -999);
        scrDead(state, t);
      }
    }
    const pos = partyPos(state, t);
    spawnDmgNumber(
      state, pos.x, pos.y, hpdiff,
      doomtype === -1 ? TYPE_PARTY : (doomtype === 4 ? TYPE_DEAD : TYPE_SWOON),
      2,
    );
  }

  // ── 9. GLOOM ACCRUAL (B-Side). Uses the PRE-softened bank from step 1. ──
  if (sideb) gloomAccrue(state, chartarget, gloomdmg, { capAt45: true });

  // ── 10. `target == 3` — THE WHOLE-PARTY BRANCH, and it carries a bug ────
  //     The knight's AoE goes through scr_damage_all (which guards
  //     `global.char[ti] != 0`), so this branch is not how the fight hits
  //     everyone. It is reachable by any caller that passes target 3.
  if (t === 3) damageAllInline(state, tdamage, opts);

  // ── 11. PRACTICE MODE: restore to max, so nothing can have been downed ──
  if (practicemode) practiceHp(state, 1);

  return t < 3 ? hpdiff : 0;
}

/**
 * scr_damage's `if (target == 3)` loop, verbatim — and TWO original bugs.
 *
 *     for (hpi = 0; hpi < 3; hpi += 1) {
 *         chartarget = global.char[hpi];
 *         if (global.hp[chartarget] >= 0) {
 *             tdamage = scr_damage_calculation(tdamage, hpi);
 *             ...armour checks on chararmor1[1], [2], [3]...
 *             global.hp[chartarget] -= tdamage;
 *             if (global.hp[chartarget] <= 0)
 *                 global.hp[chartarget] = round(-global.maxhp[0] / 2);
 *         }
 *     }
 *
 * ORIGINAL BUG 1 — `tdamage` IS NOT RESET between members. Each pass feeds
 * the previous pass's already-reduced number back into the defence walk, so
 * the second and third party members take strictly less. Present in vanilla
 * v105 too; preserved.
 *
 * ORIGINAL BUG 2 — NO `global.char[hpi] != 0` GUARD, unlike scr_damage_all
 * which has one. On a two-person party the third pass runs with
 * `chartarget == 0`: it reads `global.hp[0]` (0, so `>= 0` passes), computes
 * against `global.maxhp[0]` (also 0, making both thresholds 0), and writes
 * damage into a character who does not exist, finishing at
 * `round(-global.maxhp[0] / 2) == 0`. Harmless because nothing reads slot 0 —
 * and modelled through `state.kaizo.hpPhantom` so it stays visible instead of
 * silently landing on a real member. THIS IS THE ONE PLACE A TWO-PERSON
 * ROSTER TOUCHES A THIRD INDEX, and it does so in the original.
 *
 * ORIGINAL QUIRK 3 — the armour checks here use LITERAL character ids
 * (`chararmor1[1]`, `[2]`, `[3]`) against SLOT tests (`hpi == 0/1/2`), while
 * the single-target path above was re-indexed to `global.char[slot]`. The mod
 * re-indexed one and not the other; on a reordered party this branch checks
 * the wrong person's armour. Preserved.
 */
function damageAllInline(state, startDamage, opts = {}) {
  let tdamage = startDamage;
  let shadowmantlereduction = false;
  for (let hpi = 0; hpi < 3; hpi++) {
    const chartarget = charIdOf(state, hpi);
    if (hpOfChar(state, chartarget) >= 0) {
      tdamage = scrDamageCalculation(state, tdamage, hpi);
      // ORIGINAL QUIRK 3 — literal ids 1/2/3 against slot tests 0/1/2.
      const literal = [1, 2, 3];
      for (let s = 0; s < 3; s++) {
        if (charWearsMantle(state, literal[s]) && hpi === s) {
          tdamage = gmlRound(tdamage * 0.33);
          shadowmantlereduction = true;
        }
      }
      if (!shadowmantlereduction) {
        tdamage = Math.ceil(tdamage * (opts.elementReduction ?? 1));
      }
      if (state.charaction?.[hpi] === ACTION_DEFEND) {
        setHpOfChar(state, chartarget,
          hpOfChar(state, chartarget) - Math.ceil((3 * tdamage) / 4));
      } else {
        setHpOfChar(state, chartarget, hpOfChar(state, chartarget) - tdamage);
      }
      if (hpOfChar(state, chartarget) <= 0) {
        // `round(-global.maxhp[0] / 2)` — index 0, not the target's own max.
        setHpOfChar(state, chartarget, gmlRound(-maxhpOfChar(state, CHAR_NONE) / 2));
      }
    }
  }
}

/**
 * `scr_damage()` reached from a bullet — one target, its own inv gate.
 * Targeting runs; `state.invTimer` is set from `global.invc * 30`.
 */
export function scrDamageSingle(state, damage, target = 0, opts = {}) {
  if (state.damageEnabled === false) return 0;
  if (state.invTimer >= 0) return 0;
  const dealt = scrDamage(state, damage, target, opts);
  state.invTimer = state.invc * 30;
  if (dealt > 0) cue(state, 'snd_damage');
  return dealt;
}

/**
 * `scr_damage_all()` — the mod's version, with its NEW bracket:
 *
 *     with (obj_knight_enemy) aoedamage = true;
 *     for (ti = 0; ti < 3; ti += 1) {
 *         global.inv = -1; damage = remdamage; target = ti;
 *         if (global.hp[global.char[ti]] > 0 && global.char[ti] != 0)
 *             scr_damage();
 *     }
 *     with (obj_knight_enemy) aoedamage = false;
 *
 * The bracket is the mod's addition and it MATTERS FOR THE RNG: with
 * `aoedamage == true`, scr_kaizo_target returns immediately, so a party-wide
 * hit draws NOTHING. A translation that let the targeting roll per member
 * would burn two or three draws per AoE and desync the stream forever after.
 *
 * `damage = remdamage` inside the loop is why each member takes the FULL
 * number here, unlike the `target == 3` branch above.
 *
 * The `global.char[ti] != 0` guard is what keeps this path off the phantom
 * slot: a two-person party runs exactly two iterations.
 */
export function scrDamageAll(state, damage, opts = {}) {
  if (state.damageEnabled === false) return 0;
  if (state.invTimer >= 0) return 0;
  const k = state.knight;
  if (k) k.aoedamage = true;
  let total = 0;
  for (let ti = 0; ti < 3; ti++) {
    const charId = charIdOf(state, ti);
    if (hpOfChar(state, charId) > 0 && charId !== CHAR_NONE) {
      total += scrDamage(state, damage, ti, { ...opts, aoe: true });
    }
  }
  if (k) k.aoedamage = false;
  state.invTimer = state.invc * 30;
  // `damagenoise = 1` — one snd_damage for the whole party.
  if (total > 0) cue(state, 'snd_damage');
  return total;
}

/**
 * `scr_damage_maxhp(fraction, ignoreDefend, cannotFell)` — the FRACTION path.
 *
 * Kaizo's deltas here are close cousins of scr_damage's but NOT the same
 * numbers, and mixing them up would be invisible until a suite noticed:
 *
 *   · NOELLE IS x0.75, NOT x0.5 — and it is applied to the FRACTION
 *     (`arg0 *= 0.75`) before anything, the same place the mantle's `arg0 /= 2`
 *     goes. The mantle halves and then Noelle three-quarters: 0.66 -> 0.33 ->
 *     0.2475.
 *   · SIDE-B softens EVERY hit, not just those over 120:
 *     `_gloomdmg = ceil(tdamage / 4); tdamage = ceil(tdamage * 0.8);` — a
 *     different divisor (4, not 6), no 10 floor, and the softening is
 *     unconditional.
 *   · GLOOM HAS NO 45 CAP on this path. Only `min(hp - 1)`. Asymmetric with
 *     scr_damage; reproduced.
 *   · The targeting is INLINED rather than calling scr_kaizo_target, and is
 *     gated `!i_ex(obj_knight_roaring2)` — during Roaring there is no
 *     redirect at all.
 *   · Death is the same -999 / doomtype 12 as scr_damage: no Kris mercy.
 *
 * `clamp(tdamage, 1, hp - 1)` keeps GML's operand order — `min(max(v, lo), hi)`
 * — so a target already at 1 HP takes 0 and the hit reads MISS. sim/damage.js
 * has the whole story; the mod does not change it.
 */
export function scrDamageMaxhp(state, fraction, ignoreDefend = false, cannotFell = false, opts = {}) {
  if (state.invTimer >= 0) return 0;
  const k = state.knight;
  const sideb = !!state.kaizo?.sideb;
  const practicemode = !!state.kaizo?.practicemode;

  let t = opts.target ?? 0;
  let arg0 = fraction;

  // `if (chapter == 3 && i_ex(obj_knight_enemy) && !i_ex(obj_knight_roaring2))
  //  { if (obj_knight_enemy.aoedamage == false) { ...everything... } }`
  //
  // THE FRACTION REDUCTIONS LIVE INSIDE THE aoedamage GUARD, not outside it —
  // read the brace depth, not the indentation. So a party-wide maxhp hit
  // (scr_damage_all_maxhp, which brackets the loop with `aoedamage = true`)
  // gives NOBODY the mantle halving and gives NOELLE NO x0.75. She eats the
  // full fraction of her 120 max HP from every AoE. That is the one place her
  // resistance does not apply, and it is not an oversight we may tidy.
  const aoe = opts.aoe ?? k?.aoedamage ?? false;
  if (state.knight && !state.roaringActive && !aoe) {
    t = scrKaizoTarget(state, t, { aoe: false });
    // `if (target == i && (chararmor1[char[i]] == 23 || chararmor2[...]))
    //  arg0 /= 2;` — an ELSE-CHAIN here, unlike scr_damage's three separate
    // ifs. Same outcome for one wearer; kept as a chain.
    for (let s = 0; s < 3; s++) {
      if (t === s && charWearsMantle(state, charIdOf(state, s))) {
        arg0 /= 2;
        break;
      }
    }
    if (charIdOf(state, t) === CHAR_NOELLE) arg0 *= 0.75;
  }

  const chartarget = charIdOf(state, t);
  let tdamage = Math.ceil(maxhpOfChar(state, chartarget) * arg0);
  let gloomdmg = 0;
  if (sideb) {
    gloomdmg = Math.ceil(tdamage / 4);
    tdamage = Math.ceil(tdamage * 0.8);
  }
  if (state.charaction?.[t] === ACTION_DEFEND && !ignoreDefend) {
    tdamage = Math.ceil(tdamage / 1.5);
  }
  if (cannotFell) {
    tdamage = Math.min(Math.max(tdamage, 1), hpOfChar(state, chartarget) - 1);
  }
  if (practicemode) practiceHp(state, 2);

  if (!state.entities?.some((sh) => sh.alive && sh.type?.name === 'obj_shake')) {
    scrShakescreen(state);
  }

  // `with (global.charinstance[target]) { hurt = 1; hurttimer = 0; }`
  heroHurt(state, t);

  // NO EARLY RETURN AT ZERO — the writer, the flinch and the inv all still
  // happen, and a 0 draws MISS.
  if (tdamage < 0) tdamage = 0;

  let hpdiff = tdamage;
  let doomtype = -1;
  const hp = hpOfChar(state, chartarget);
  if (hp <= 0) {
    doomtype = 4;
    setHpOfChar(state, chartarget, hp - gmlRound(tdamage / 4));
    hpdiff = gmlRound(tdamage / 4);
  } else {
    setHpOfChar(state, chartarget, hp - tdamage);
    if (hpOfChar(state, chartarget) <= 0) {
      doomtype = 12;
      hpdiff = gmlRound(hpOfChar(state, chartarget) + 999);
      setHpOfChar(state, chartarget, -999);
      scrDead(state, t);
    }
  }
  const pos = partyPos(state, t);
  spawnDmgNumber(
    state, pos.x, pos.y, hpdiff,
    doomtype === -1 ? TYPE_PARTY : (doomtype === 4 ? TYPE_DEAD : TYPE_SWOON),
    2,
  );

  // NO 45 CAP on this path — the asymmetry the delta doc flags.
  if (sideb) gloomAccrue(state, chartarget, gloomdmg, { capAt45: false });

  if (practicemode) practiceHp(state, 1);
  state.invTimer = state.invc * 30;
  return tdamage;
}

/**
 * `scr_damage_all_maxhp(arg0, arg1, arg2)` — NEW IN KAIZO. Same aoedamage
 * bracket, same `global.char[ti] != 0` guard, one inv set at the end.
 */
export function scrDamageAllMaxhp(state, fraction = 1, ignoreDefend = false, cannotFell = false, opts = {}) {
  if (state.invTimer >= 0) return 0;
  const k = state.knight;
  if (k) k.aoedamage = true;
  let total = 0;
  for (let ti = 0; ti < 3; ti++) {
    const charId = charIdOf(state, ti);
    if (hpOfChar(state, charId) > 0 && charId !== CHAR_NONE) {
      // `global.inv = -1` per iteration — the per-call gate must not swallow
      // members 2 and 3.
      state.invTimer = -1;
      total += scrDamageMaxhp(state, fraction, ignoreDefend, cannotFell, {
        ...opts, target: ti, aoe: true,
      });
    }
  }
  if (k) k.aoedamage = false;
  state.invTimer = state.invc * 30;
  return total;
}

/**
 * `gameover` — scr_damage's tail, which is the roster-shaped test:
 *
 *     gameover = 1;
 *     if (global.char[0] != 0 && global.hp[global.char[0]] > 0) gameover = 0;
 *     if (global.char[1] != 0 && global.hp[global.char[1]] > 0) gameover = 0;
 *     if (global.char[2] != 0 && global.hp[global.char[2]] > 0) gameover = 0;
 *
 * THE `!= 0` GUARD IS WHY THIS IS SAFE ON A SHORT PARTY: an empty slot never
 * clears the flag and never reads a phantom HP. sim/damage.js's
 * `state.partyHp.every(h => h <= 0)` would have been correct here by accident
 * (the array is roster-length) — but only because the array was resized;
 * against a fixed three-element array it would demand a third corpse that
 * never exists.
 */
export function partyWiped(state) {
  let gameover = 1;
  for (let i = 0; i < 3; i++) {
    const charId = charIdOf(state, i);
    if (charId !== CHAR_NONE && hpOfChar(state, charId) > 0) gameover = 0;
  }
  return gameover === 1;
}

/**
 * ...and the mod then THROWS IT AWAY for this fight:
 *
 *     if (global.chapter == 3 && i_ex(obj_knight_enemy)) gameover = 0;
 *
 * The knight fight never triggers scr_gameover from a hit — the ending is
 * driven by the encounter's own scene. Exposed separately so a caller can ask
 * either question; `partyWiped` is the fight-state one.
 */
export function scrGameover(state) {
  if (state.knight) return false;
  return partyWiped(state);
}

/**
 * LIVING RECRUITED PARTY MEMBERS — obj_heroparent's Step, MOD hunk 3:
 *
 *     var _partyalive = (scr_havechar(1) * (global.hp[1] > 0))
 *                     + (scr_havechar(2) * (global.hp[2] > 0))
 *                     + (scr_havechar(3) * (global.hp[3] > 0))
 *                     + (scr_havechar(4) * (global.hp[4] > 0));
 *
 * CHARACTER-indexed across all four ids, gated by presence — boolean
 * arithmetic, so a character not in the party contributes 0 whatever their
 * saved HP says. Note `> 0`, not vanilla's `< 0`: a character sitting at
 * EXACTLY 0 counts as dead here and counted as alive in vanilla's test. The
 * mod's own -999 fell makes that unreachable in practice; it is still the
 * rule, so it is the rule here.
 */
export function partyAliveCount(state) {
  const gc = globalChar(state);
  let n = 0;
  for (let c = 1; c <= 4; c++) {
    const present = gc[0] === c || gc[1] === c || gc[2] === c ? 1 : 0;
    n += present * (hpOfChar(state, c) > 0 ? 1 : 0);
  }
  return n;
}

/**
 * KRIS'S DAMAGE MULTIPLIER, and this is the fight's biggest single number
 * change:
 *
 *     if (_partyalive <= 1)      damage = ceil(damage * 2.5);
 *     else if (_partyalive == 2) damage = ceil(damage * 1.5);
 *     // three or more: NOTHING
 *
 * VANILLA WAS THE OTHER SHAPE ENTIRELY — `hp[2] < 0 && hp[3] < 0` doubled,
 * one down left it alone, and a HEALTHY FULL PARTY HALVED Kris's damage
 * (`round(damage * 0.5)`). Kaizo deletes the halving, so a full party's Kris
 * hits twice as hard as vanilla's, and the bonuses are ceils rather than
 * integer multiplies.
 *
 * ON A TWO-PERSON WEIRD ROUTE PARTY THIS IS A DIFFERENT FIGHT. Kris + a
 * living Noelle is `_partyalive == 2`, so KRIS SWINGS AT ceil(x1.5) FROM THE
 * OPENING TURN — a bonus the three-person route can only reach by losing a
 * member. Lose Noelle and it is ceil(x2.5) immediately. In the vanilla
 * three-person fight the same two states would be x0.5 and x1.
 *
 * Applied AFTER `damage = ceil(damage * damagereduction)` and BEFORE the
 * knightblock `ceil(damage / 5)` — order per the Step's hunks 3 -> 4.
 */
export function applyKrisPartyMultiplier(damage, state) {
  const alive = partyAliveCount(state);
  if (alive <= 1) return Math.ceil(damage * 2.5);
  if (alive === 2) return Math.ceil(damage * 1.5);
  return damage;
}

/**
 * The vanilla rule, kept beside it so the delta is readable and testable.
 * sim/knight.js's `krisMult` in roster terms — `partyHp[1] < 0 &&
 * partyHp[2] < 0`, which cannot be evaluated at all when there is no slot 2.
 */
export function vanillaKrisMult(state) {
  const n = rosterSize(state);
  const down = (s) => (s < n ? state.partyHp[s] < 0 : true);
  const a = down(1);
  const b = down(2);
  if (a && b) return 2;
  if (a || b) return 1;
  return 0.5;
}

/** Full-health HP for the installed roster. */
export function freshParty(state) {
  return (state.kaizo?.roster ?? []).map((m) => m.maxhp);
}
