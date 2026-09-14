// KAIZO V-D — NOELLE'S MENU, SPELLS, ACTS AND X-SLASH. What the command
// phase offers a Kris + Noelle party, and what each choice does, translated
// from the mod one case at a time.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE (kaizo dump, knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries;
// `v105` marks a line that is byte-identical in gml_vanilla_v105 — diffed):
//   gml_GlobalScript_scr_gamestart.gml          : 197-204  global.spell[1..4]   v105
//   gml_GlobalScript_scr_spellinfo.gml          : 95-128   cases 8 / 9 / 10     v105
//   gml_GlobalScript_scr_spellconsumeb.gml      : 1-4      the TP the game
//                                                 ACTUALLY deducts            v105
//   gml_GlobalScript_scr_spell.gml              : 6-19     _ctar, k_didspell
//                                                 43-75    case 2 Heal Prayer
//                                                 219-235  case 8 SleepMist    v105
//                                                 236-253  case 9 IceShock     v105
//                                                 254-277  case 10 SnowGrave (+k_sgcaster)
//   gml_GlobalScript_scr_heal.gml               : 1-35                          v105
//   gml_Object_obj_icespell_Create_0.gml / _Draw_0.gml : the IceShock object,
//                                                 kaizo_block branches at 12-21 and 74-101
//   gml_Object_obj_spell_mist_Create_0.gml / _Draw_0.gml : SleepMist's mist    v105
//   gml_GlobalScript_scr_damage_enemy.gml       : 1-40 (:25 is the mod's only delta)
//   gml_Object_obj_battlecontroller_Step_0.gml  : 1057-1096 (Draw_0) the per-
//                                                 character act fill; 1097-1170
//                                                 canpress / tensionselect / the
//                                                 act's TP; 1544-1567 the ThornRing tick
//   gml_Object_obj_battlecontroller_Draw_0.gml  : 1173-1192, 1223, 1257-1296 the
//                                                 X-Slash grid's greyed heads
//   gml_Object_obj_knight_enemy_Step_0.gml      : 42-53 the X-Slash row;
//                                                 950-963 CHECK; 964-978 HoldBreath;
//                                                 980-1033 X-Slash; 1252-1291 N-Action
//   gml_Object_obj_knight_enemy_Other_23.gml    : 1-9 the CHECK strings, both sides
//
// UNUSED CONTENT — `acting == 4`, Step_0:1039-1090. There is a FOURTH Kris
// ACT in the mod's knight: "* Your SOUL shined its power on Susie!", which
// poses an obj_animation of spr_soulshining at Kris's shoulder, flashes all
// three heroes with scr_oflash and sets charspecial[1] = 5. It is not
// translated because the selector cannot reach it, by the same reading
// CLAUDE.md's "THE SELECTOR decides what is real" prescribes.
//
// scr_actselect sets `acting = arg1 + 1`, so `acting == 4` is Kris's ACT
// INDEX 3. The knight declares index 0 (Check) and 1 (HoldBreath) in
// scr_monstersetup's monstertype-104 block (1843-1881, whole block read —
// no index-3 line in it) and index 2 (X-Slash) in his own Step_0:42-48,
// under `if (k_sideb)`. Nothing anywhere in the dump gives him a
// `canact[myself][3]`. Four is a row the ACT menu never draws.
//   gml_Object_obj_knight_enemy_Alarm_4.gml     : `actcon += 1`
//   gml_GlobalScript_scr_actselect.gml          : the slot -> acting/actingnoe map
//   gml_GlobalScript_scr_monstersetup.gml       : 1843-1881 (via kaizo/party/noelle.js)
//
// ── HOW IT REACHES THE FIGHT ─────────────────────────────────────────────
// sim/menu.js and sim/spells.js index their spell and ACT tables by PARTY
// SLOT; the game indexes by CHARACTER ID through `global.char[charturn]`. The
// vendored engine now carries a seam for exactly that (sim/spells.js "THE
// CHARACTER-TABLE SEAM"): `state.kaizo.hooks.{spellInfo, spellList, actList,
// spellCost, castSpell, resolveActPages}`, each `??` the vanilla table.
// `installKaizoMenu` below fills those hooks from the roster and spawns one
// invisible controller entity for the per-frame work (the ThornRing tick and
// the X-Slash alarm). Nothing here is reached unless a roster is installed;
// V-C keeps the vanilla tables and the A-Side gate cannot see any of it.
//
// ── THREE CORRECTIONS TO THE GAP REPORT, from the diff ───────────────────
// 1. `scr_spellinfo` is BYTE-IDENTICAL between vanilla v105 and the mod. The
//    ThornRing half-cost on IceShock and SnowGrave (`if (global.charweapon[4]
//    == 13) cost *= 0.5`) is the GAME's own Snowgrave-route rule, not a mod
//    delta. It still applies here, because Noelle's weapon does.
// 2. The `scr_spell` delta at :170 (`battleat * 12.5`, vanilla 13) is CASE 5
//    — Susie's Red Buster — not IceShock. IceShock's damage line (:245) is
//    vanilla's: `ceil(minbattlemag * 30 + 90 + random(10))`.
// 3. The `* 5.8` at :184 (vanilla 5.5) is CASE 6, the party-wide heal Ralsei
//    casts in later chapters. Heal Prayer is case 2 and stays
//    `battlemag * (5 + 0)`. Neither Kris nor Noelle knows spell 6, so the
//    5.8 is recorded here and reachable by no one on the Weird Route.

import { spawn, destroy } from '../../sim/entity.js';
import { gmlRandom } from '../../sim/rng.js';
import { gmlRound, clamp } from '../../sim/gml.js';
import { cue } from '../../sim/audio.js';
import { damageKnight, KNIGHT_DF } from '../../sim/knight.js';
import { spawnDmgNumber, spawnSelfHealNumber, resetDmgStack } from '../../sim/dmgnumbers.js';
import { MAX_TENSION } from '../../sim/tension.js';
import { ACT_PAGES } from '../../sim/dialogue.js';
import { holdBreath } from '../../sim/spells.js';
import {
  charIdOf, gearOfChar, statFor, memberOf, hpOfChar, setHpOfChar, maxhpOfChar,
  havechar, CHAR_KRIS, CHAR_SUSIE, CHAR_RALSEI, CHAR_NOELLE,
} from './roster.js';
import { THORN_RING, NOELLE_SPELL_SNOWGRAVE } from './noelle.js';
import { scrSpellFreezeGate } from './freeze.js';
import { scrRevive } from './damage.js';
import { castSnowgrave, armSgsceneIfSpell } from './scenes.js';
import { kaizoMonsterXY } from '../actors/kaizo-knight-actor.js';

// ───────────────────────────────────────────────────────────────────────────
// The spell lists — `global.spell[char]`, scr_gamestart:197-204
// ───────────────────────────────────────────────────────────────────────────

/**
 * CHARACTER-indexed, exactly as scr_gamestart writes them (index 0 unused):
 *
 *     global.spell[1][0] = 7;                       Kris:   ACT
 *     global.spell[2][0] = 4;  spell[2][1] = 11;    Susie:  Rude Buster, UltraHeal
 *     global.spell[3][0] = 3;  spell[3][1] = 2;     Ralsei: Pacify, Heal Prayer
 *     global.spell[4][0] = 2;  [4][1] = 8;  [4][2] = 9;   Noelle: Heal Prayer,
 *                                                          SleepMist, IceShock
 *
 * Identical in v105 (diffed). A file transferred from the Chapter 2 weird
 * route carries whatever it learned there in `spell[4][j]` (scr_load.gml:
 * 168-172 reads twelve per character) — SnowGrave, 10, is the one that
 * matters, and it is NOT granted by anything in this dump. `state.kaizo.
 * spells[charId]` overrides the list per character the way `state.kaizo.
 * gear` overrides equipment, so a measured save can be installed without
 * editing data.
 */
export const SPELLS_BY_CHAR = {
  1: [7],
  2: [4, 11],
  3: [3, 2],
  4: [2, 8, 9],
};

/** `global.spell[global.char[slot]]`. An empty slot has no list. */
export function kaizoSpellList(state, slot) {
  const charId = charIdOf(state, slot);
  if (!charId) return [];
  const override = state.kaizo?.spells?.[charId];
  if (override) return override;
  const m = memberOf(state, charId);
  return m?.spells ?? SPELLS_BY_CHAR[charId] ?? [];
}

// ───────────────────────────────────────────────────────────────────────────
// scr_spellinfo — the three cases sim/spells.js's table lacks
// ───────────────────────────────────────────────────────────────────────────

/**
 * scr_spellinfo cases 8 / 9 / 10, in sim/spells.js's SPELLS shape. `cost` is
 * the case's BASE cost; the ThornRing multiply is live state and lives in
 * kaizoSpellCost. `target` is `spelltarget`: 0 none (no picker), 2 an enemy.
 *
 *     case 8:  "SleepMist"  "Spare#TIRED foes"  spelltarget 0  cost 80
 *     case 9:  "IceShock"   "Damage#w/ ICE"     spelltarget 2  cost 40
 *     case 10: "SnowGrave"  "Fatal"             spelltarget 0  cost maxtension * 2
 *
 * SnowGrave's cost is `global.maxtension * 2` — 500 raw TP against this
 * fight's 250 — which is why the SnowRing Noelle can never cast it and the
 * ThornRing one needs a full bar: 250, the whole thing.
 */
export const KAIZO_SPELL_INFO = {
  8: { name: 'SleepMist', descb: 'Spare#TIRED foes', cost: 80, target: 0 },
  9: { name: 'IceShock', descb: 'Damage#w/ ICE', cost: 40, target: 2 },
  10: { name: 'SnowGrave', descb: 'Fatal', cost: MAX_TENSION * 2, target: 0 },
};

/**
 * `global.charweapon[4] == 13` — scr_spellinfo:110 and :123 read NOELLE'S
 * weapon global, whoever is casting. Only she knows 9 and 10, so the
 * distinction cannot show, but the translation reads the same cell.
 */
export function noelleWearsThornRing(state) {
  return gearOfChar(state, CHAR_NOELLE).weapon === THORN_RING;
}

/**
 * scr_spellinfo's `cost`, for the two ids whose cost is not a constant.
 * Returns undefined for every other id — the seam then reads the table.
 *
 *     case 9:  cost = 40;                    if (charweapon[4] == 13) cost *= 0.5;
 *     case 10: cost = global.maxtension * 2; if (charweapon[4] == 13) cost *= 0.5;
 */
export function kaizoSpellCost(state, slot, spellId) {
  if (spellId === 9) {
    let cost = 40;
    if (noelleWearsThornRing(state)) cost *= 0.5;
    return cost;
  }
  if (spellId === NOELLE_SPELL_SNOWGRAVE) {
    let cost = MAX_TENSION * 2;
    if (noelleWearsThornRing(state)) cost *= 0.5;
    return cost;
  }
  return undefined;
}

/**
 * `scr_spellconsumeb` — what selecting a spell ACTUALLY deducts:
 *
 *     global.tension -= floor(floor((cost / global.maxtension) * 100) * 2.5);
 *
 * i.e. the cost is rounded down to a whole PERCENT of the bar and then back
 * to raw TP at 2.5 per percent. sim/menu.js's recordSpell subtracts `cost`
 * directly; the two agree for every cost this fight can reach (20, 40, 80,
 * 125, 225, 250, 500 — all multiples of 2.5), and check-spells-kaizo asserts
 * that equality so a future cost that is not a multiple of 2.5 (none exists
 * today) fails loudly instead of paying the wrong number.
 */
export function scrSpellconsumebTp(cost, maxtension = MAX_TENSION) {
  return Math.floor(Math.floor((cost / maxtension) * 100) * 2.5);
}

// ───────────────────────────────────────────────────────────────────────────
// scr_heal — verbatim, roster-indexed
// ───────────────────────────────────────────────────────────────────────────

/**
 * `scr_heal(arg0, arg1)` — slot in, amount in, the delta out. sim/items.js's
 * applyHeal is the same body against sim/damage.js's three-person PARTY
 * table, which puts Susie's 190 under Noelle's slot; this one reads the
 * roster's char-indexed cells, `global.hp[global.char[slot]]`.
 *
 *     hltarget = global.char[arg0]; _curhp = hp[hltarget];
 *     belowzero = hp <= 0; abovemaxhp = hp > maxhp;
 *     if (!abovemaxhp) { hp += arg1; if (hp > maxhp) hp = maxhp; }
 *     if (belowzero && hp >= 0) { if (hp < ceil(maxhp/6)) hp = ceil(maxhp/6);
 *                                 scr_revive(arg0); }
 *     snd_stop(snd_power); snd_play(snd_power);
 *     return hp - _curhp;
 *
 * An EMPTY slot is a real case: `global.char[2] == 0` on the Weird Route, so
 * `hltarget = 0` and the heal lands on `global.hp[0]`, whose max is the
 * unset-array 0 — the add is immediately clamped back to 0. roster.js keeps
 * that cell as `hpPhantom`, so the write is observable and harms no one.
 */
export function scrHeal(state, slot, amount) {
  const charId = charIdOf(state, slot);
  const curhp = hpOfChar(state, charId);
  const maxhp = maxhpOfChar(state, charId);
  const belowzero = curhp <= 0;
  const abovemaxhp = curhp > maxhp;
  let hp = curhp;
  if (!abovemaxhp) {
    hp += amount;
    if (hp > maxhp) hp = maxhp;
  }
  if (belowzero && hp >= 0) {
    const floor6 = Math.ceil(maxhp / 6);
    if (hp < floor6) hp = floor6;
    setHpOfChar(state, charId, hp);
    scrRevive(state, slot);
  } else {
    setHpOfChar(state, charId, hp);
  }
  cue(state, 'snd_power');
  return hp - curhp;
}

/** `scr_heal_amount_modify_by_equipment` — BlueRibbon's Heal+, per ribbon. */
const healAmountModifyByEquipment = (amount, ribbons) =>
  amount + Math.ceil(amount / 8) * ribbons;

// ───────────────────────────────────────────────────────────────────────────
// scr_damage_enemy — the mod's copy
// ───────────────────────────────────────────────────────────────────────────

/**
 * `scr_damage_enemy(arg0, arg1)` against the Knight (monster slot 0):
 *
 *     dm = instance_create(monsterx, monstery + 20 - hittarget * 20, obj_dmgwriter);
 *     dm.type = global.char[caster] - 1;  if (global.char[caster] == 4) dm.type = 6;
 *     dm.damage = arg1;
 *     global.monsterhp[arg0] -= arg1;
 *     if (arg1 > 0) { shakex = 9; state = 3; hurttimer = 30;
 *                     if (chapter == 3 && i_ex(obj_knight_enemy) && arg1 >= 10000)
 *                         stronghurtanim = true;          // v105: >= 100
 *                     hurtamt = arg1; }
 *     global.hittarget[arg0] += 1;
 *
 * `type 6` is the writer colour the mod adds for Noelle (obj_dmgwriter
 * Draw_0:44-47, `lighty`); sim/dmgnumbers.js's dmgColor has no branch for
 * it and falls to white — a render seam for later, the number's `type` is
 * stored as 6 so the seam has something to read.
 *
 * THE MOD'S ONLY DELTA IN THIS SCRIPT is the strobe threshold: 100 -> 10000,
 * so no party hit ever strobes him. sim/knight.js's damageKnight still arms
 * the vanilla 100 (the FIGHT path in kaizo-practice.js goes through it as
 * is — outside this lane); this copy re-derives the flag from the kaizo line
 * for the hits it lands.
 */
export function kaizoScrDamageEnemy(state, damage, casterSlot) {
  const charId = charIdOf(state, casterSlot);
  const type = charId === CHAR_NOELLE ? 6 : charId - 1;
  // `instance_create(monsterx, monstery + 20 - hittarget * 20, ...)` — and
  // monsterx/monstery are Other_22's CONSTANTS, not the knight's live x/y
  // (kaizoMonsterXY carries the derivation and the mod's -14 / -44). Reading
  // the instance put every X-Slash number at his left edge, and would have
  // dragged them across the screen with him during the TP-slash scene.
  const { x, y } = kaizoMonsterXY(state);
  // The writer is created BEFORE the `arg1 > 0` test — a zero draws MISS.
  spawnDmgNumber(state, x, y, damage, type);
  if (damage > 0) {
    damageKnight(state, damage);
    state.knight.stronghurtanim = damage >= 10000;
  }
  return damage;
}

// ───────────────────────────────────────────────────────────────────────────
// scr_spell, the cases a Kris + Noelle party can reach
// ───────────────────────────────────────────────────────────────────────────

/**
 * The seam's scr_spell. Returns undefined for an id it does not translate,
 * which hands the id to sim/spells.js's vanilla cases (Rude Buster, Pacify,
 * UltraHeal — none of which this roster knows, but a Kris + Susie roster
 * would).
 *
 *     global.spelldelay = 10;
 *     if (arg0 > 1 && arg0 <= 100) with (obj_knight_enemy) k_didspell = 1;
 *
 * `k_didspell` (scr_spell:13-19) is the flag the tp scene's "No spells
 * yet..." taunt reads (kaizo/party/scenes.js); it is set for EVERY spell
 * id in (1, 100], including the vanilla ones handed back.
 *
 * `global.spelldelay` drives obj_spellphase, which neither the vanilla sim
 * nor this lane models as a timer; it is kept on `state.kaizo.spelldelay`
 * because kaizo/party/scenes.js's SnowGrave scene reads and stalls it
 * (SG_SPELLDELAY_STALL), so the value has one consumer and is not a dead
 * write.
 */
export function kaizoCastSpell(state, slot, spellId, target = 0) {
  const k = state.kaizo;
  k.spelldelay = 10;
  if (spellId > 1 && spellId <= 100) k.didspell = 1;
  switch (spellId) {
    case 2: return castHealPrayer(state, slot, target);
    case 8: return castSleepMist(state, slot);
    case 9: return castIceShock(state, slot);
    case NOELLE_SPELL_SNOWGRAVE: return castSnowGraveSpell(state, slot);
    default: return undefined;
  }
}

/**
 * Case 2 — Heal Prayer (scr_spell:43-75):
 *
 *     if (i_ex(obj_knight_enemy)) if (obj_knight_enemy.k_freeze[_ctar])
 *         { global.spelldelay = 15; break; }                    // mod
 *     healnum = scr_heal_amount_modify_by_equipment(battlemag[arg1] * (5 + 0));
 *     scr_heal(star, healnum);
 *     with (charinstance[star]) { obj_healanim; dmgwr type 3 delay 8;
 *         if (hp[char] >= maxhp[char]) specialmessage = 3; damage = healnum; tu++ }
 *     global.spelldelay = 15;
 *
 * ×5, not ×5.8 — see the header. Noelle's battlemag with the ThornRing is
 * 13 + 12 (weapon) + 1 (RoyalPin) = 26, so she heals 130; with the SnowRing
 * 14, so 70. The freeze gate is W1's kaizo/party/freeze.js, imported.
 */
function castHealPrayer(state, slot, target) {
  const k = state.kaizo;
  const gate = scrSpellFreezeGate(state, 2, slot, target);
  if (gate.blocked) {
    k.spelldelay = gate.spelldelay;
    return null;
  }
  const st = statFor(state, slot);
  const healnum = healAmountModifyByEquipment(st.magic * (5 + 0), st.healRibbons);
  scrHeal(state, target, healnum);
  // `with (global.charinstance[star])` — no instance on an empty slot, no
  // number. Same test as scr_heal's hltarget: the char id is 0.
  const charId = charIdOf(state, target);
  if (charId) {
    const maxed = hpOfChar(state, charId) >= maxhpOfChar(state, charId);
    spawnSelfHealNumber(state, target, healnum, maxed);
  }
  k.spelldelay = 15;
  return null;
}

/**
 * obj_spell_mist — SleepMist's mist, one per living enemy (Create_0 +
 * Draw_0, identical in v105). Against the Knight it can only FAIL:
 *
 *     success = (global.monsterstatus[myself] == 1);     // TIRED — never, here
 *     if (initdelay == 0) { snd_ghostappear; if (success) snd_spell_pacify; }
 *     initdelay--;
 *     if (initdelay <= 0) { siner++; image_alpha = sin(siner/9) - 0.3 + success*0.3;
 *         amp = sin(siner/9) * 30;  ...two draws...  stimer++;
 *         if (siner == 12 && success) scr_monsterdefeat();
 *         if (stimer >= 3 && siner <= 24) { stimer = 0; if (success) hex... }
 *         if (siner >= 40) instance_destroy(); }
 *
 * The RNG in it (`random(sprite_width)`, `random(5)`) is inside `if (success
 * == 1)`, so a failing mist draws NOTHING from the stream. The draw counters
 * are kept for a renderer; no damage, no status, forty frames and gone.
 */
export const spellMist = {
  name: 'obj_spell_mist',
  create(e, state) {
    e.visible = true;
    e.siner = 0;
    e.amp = 0;
    e.image_xscale = 3;
    e.image_yscale = 2;
    e.stimer = 0;
    e.initdelay ??= 0;
    e.myself ??= -1;
    e.success = 0;
    // `global.monsterstatus[myself] == 1` — the Knight's status never leaves
    // 0 (sim/spells.js Pacify carries the same reading).
    if (e.myself >= 0 && (state.monsterstatus?.[e.myself] ?? 0) === 1) e.success = 1;
  },
  // Draw event: endStep is this engine's slot for it.
  endStep(e, state) {
    if (e.initdelay === 0) {
      cue(state, 'snd_ghostappear');
      if (e.success === 1) cue(state, 'snd_spell_pacify');
    }
    e.initdelay -= 1;
    if (e.initdelay <= 0) {
      e.siner += 1;
      e.image_alpha = (Math.sin(e.siner / 9) - 0.3) + (e.success * 0.3);
      e.amp = Math.sin(e.siner / 9) * 30;
      e.stimer += 1;
      if (e.stimer >= 3 && e.siner <= 24) e.stimer = 0;
      if (e.siner >= 40) destroy(e, state);
    }
  },
};

/**
 * Case 8 — SleepMist (scr_spell:219-235):
 *
 *     for (_spelli = 0; _spelli < 3; _spelli++) if (global.monster[_spelli] == 1)
 *         with (monsterinstance[_spelli]) { _icemist = obj_spell_mist at monsterx/y;
 *             target = id; myself; initdelay = _mistcount * 10; _mistcount++; }
 *     global.spelldelay = 20 + (_mistcount * 10);
 *
 * One enemy, one mist, spelldelay 30. Eighty TP for a pretty fog.
 */
function castSleepMist(state, slot) {
  const k = state.kaizo;
  const knight = state.entities.find((en) => en.alive && en.type.name === 'obj_knight_enemy');
  let mistcount = 0;
  if (knight && (state.knight?.hp ?? 1) > 0) {
    spawn(state, spellMist, {
      x: knight.x, y: knight.y, target: knight, myself: 0, initdelay: mistcount * 10,
    });
    mistcount += 1;
  }
  k.spelldelay = 20 + mistcount * 10;
  void slot;
  return null;
}

/**
 * obj_icespell — IceShock's projectile, and the two places the mod reaches
 * into it (Draw_0:12-21 and :74-101). The Draw event is the whole object;
 * endStep is its slot here. `timer++` first (:1), then by timer:
 *
 *     1   snd_icespell; hex[0] at (x-25, y-20)
 *     4   if (monsterinstance[star] is obj_knight_enemy)
 *             with it: if (kaizo_block && charweapon[4] == 13 && !haveusedroaring)
 *                          blockanim = 0.5;                       // MOD
 *         hex[1] at (x+25, y-20)
 *     7   hex[2] at (x, y+20)
 *     10  each hex bursts six 0.75-scale hexagons (VFX)
 *     11  the three hexes die
 *     15  if (global.fighting == 1) {
 *             global.hittarget[star] = 0;
 *             if (damage >= monsterhp && freezable) flag[51 + star] = 6;
 *             if (the target is obj_knight_enemy && obj_knight_enemy.kaizo_block) {   // MOD
 *                 _div = 1;
 *                 if (charweapon[4] == 13)               _div = 7   - damagereduction * 9.5;
 *                 else if (scr_havechar(2) && hp[2] > 0) _div = 6   - damagereduction * 7.5;
 *                 else                                   _div = 4.5 - damagereduction * 7.5;
 *                 if (_div < 1) _div = 1;
 *                 damage = ceil(damage / _div);
 *                 if (blockanim == 0.5) blockanim = 1;
 *             }
 *             scr_damage_enemy(star, damage);
 *             if (global.monster[star] == 1) with (target) scr_oflash(); }
 *     10..30  three expanding white rings (draw only)
 *     60  instance_destroy()
 *
 * `blockanim = 0.5` at timer 4 is a PRIMED block: obj_knight_enemy's Step
 * reacts to `blockanim == 1` only (Step_0:123-147, the metal-hit and the
 * block sprite), so 0.5 sits inert for eleven frames and the hit at 15
 * promotes it to 1 — the guard goes up as the number lands, not as the
 * spell starts. Without the ThornRing there is no 0.5 and no block
 * animation at all: the damage is still divided, but the Knight shows
 * nothing.
 *
 * The divisor at damagereduction 0.18 (the mod's opening value): ThornRing
 * 7 - 1.71 = 5.29; a Kris + Noelle party without it 4.5 - 1.35 = 3.15; the
 * Susie branch 6 - 1.35 = 4.65 is dead on this roster. `hp[2] > 0` there is
 * the CHAR-indexed cell — Susie's 190 in a party she is not in — which is
 * why the `scr_havechar(2)` in front of it matters.
 *
 * `global.hittarget[star] = 0` before the hit resets the Knight's number
 * stack, so IceShock's number always sits at the bottom of the column.
 * `freezable` is never set on obj_knight_enemy (grepped: no Create writes
 * it), and the `>= monsterhp` branch would need a 10000-HP kill, so the
 * flag[51 + star] = 6 write is recorded and unreachable.
 */
export const icespell = {
  name: 'obj_icespell',
  create(e) {
    e.visible = true;
    e.timer = 0;
    e.star ??= 0;
    e.damage ??= 0;
    e.caster ??= 0;
    e.hexes = [];
  },
  endStep(e, state) {
    e.timer += 1;
    const t = e.timer;
    const kn = state.knight;
    if (t === 1) {
      cue(state, 'snd_icespell');
      e.hexes.push({ x: e.x - 25, y: e.y - 20 });
    }
    if (t === 4) {
      if (kn && (state.kaizo?.vars?.kaizo_block ?? false)
        && noelleWearsThornRing(state) && !kn.haveusedroaring) {
        kn.blockanim = 0.5;
      }
      e.hexes.push({ x: e.x + 25, y: e.y - 20 });
    }
    if (t === 7) e.hexes.push({ x: e.x, y: e.y + 20 });
    if (t === 11) e.hexes = [];
    if (t === 15 && !state.gameOver) {
      resetDmgStack(state);
      let damage = e.damage;
      if (kn && (state.kaizo?.vars?.kaizo_block ?? false)) {
        damage = Math.ceil(damage / icespellDivisor(state));
        if (kn.blockanim === 0.5) kn.blockanim = 1;
      }
      e.dealt = kaizoScrDamageEnemy(state, damage, e.caster);
    }
    if (t === 60) destroy(e, state);
  },
};

/** The `_div` block above, on the live state; floor 1. */
export function icespellDivisor(state) {
  const dr = state.knight?.damagereduction ?? 0;
  let div;
  if (noelleWearsThornRing(state)) div = 7 - dr * 9.5;
  else if (havechar(state, CHAR_SUSIE) && hpOfChar(state, CHAR_SUSIE) > 0) div = 6 - dr * 7.5;
  else div = 4.5 - dr * 7.5;
  if (div < 1) div = 1;
  return div;
}

/**
 * Case 9 — IceShock (scr_spell:236-253, identical in v105):
 *
 *     cancelattack = 0; global.spelldelay = 30;
 *     if (global.monster[star] == 0) scr_retarget_spell();
 *     if (cancelattack == 0) {
 *         global.flag[925]++;
 *         var minbattlemag = clamp(global.battlemag[arg1] - 10, 1, 999);
 *         global.spelldelay = 40;
 *         damage = ceil((minbattlemag * 30) + 90 + random(10));
 *         attack = obj_icespell at monsterx/monstery; damage, star, caster, target
 *     }
 *
 * ONE DRAW from the live stream — `random(10)`, 1 u32 — so a cast moves the
 * RNG by one slot before the bar's own draws. `minbattlemag` floors the
 * magic at 1 AFTER subtracting 10: Noelle's 26 with the ThornRing gives
 * 16 * 30 + 90 = 570 + [0, 10), her 14 without it 4 * 30 + 90 = 210 + [0, 10).
 * The Knight then divides it (obj_icespell above) — 570 / 5.29 -> 108.
 *
 * `global.flag[925]` is the game's IceShock counter ("LV~1 Frostmancer" in
 * the overworld menu); kept on state.kaizo.flag925 because two readers in
 * this dump test it.
 */
function castIceShock(state, slot) {
  const k = state.kaizo;
  k.spelldelay = 30;
  const knight = state.entities.find((en) => en.alive && en.type.name === 'obj_knight_enemy');
  if (!knight) return null;   // `global.monster[star] == 0` -> retarget finds nobody
  k.flag925 = (k.flag925 ?? 0) + 1;
  const minbattlemag = clamp(statFor(state, slot).magic - 10, 1, 999);
  k.spelldelay = 40;
  const damage = Math.ceil(minbattlemag * 30 + 90 + gmlRandom(state.gmlRng, 10));
  spawn(state, icespell, { x: knight.x, y: knight.y, damage, star: 0, caster: slot, target: knight });
  return null;
}

/**
 * Case 10 — SnowGrave (scr_spell:254-277):
 *
 *     cancelattack = 0; global.spelldelay = 30;
 *     if (scr_monsterpop() == 0) cancelattack = 1;
 *     if (cancelattack == 0) {
 *         damage = ceil((global.battlemag[arg1] * 40) + 600);
 *         attack = obj_spell_snowgrave; caster; damage;
 *         global.spelldelay = 140;
 *         with (obj_knight_enemy) k_sgcaster = other.caster;     // MOD
 *     }
 *
 * The spell object's own damage block is dead against the Knight
 * (obj_spell_snowgrave Draw_0:165 wraps it in `if (!i_ex(obj_knight_enemy))`)
 * — the Knight commandeers the cast as the k_sgscene, which freezes a party
 * member instead. kaizo/party/scenes.js owns both the object and the scene;
 * this case is exactly its castSnowgrave (same `ceil(magic * 40 + 600)`,
 * same spelldelay 140, same k_sgcaster), called with the caster's LIVE
 * battlemag rather than the module's default 13.
 *
 * THE ARM. `if (k_sgscene == 0 && i_ex(obj_spell_snowgrave)) k_sgscene = 1;`
 * is obj_knight_enemy's Step (:1543-1545) and belongs to the scene driver
 * that steps the knight's scenes each frame — which the live V-D loop does
 * not spawn yet (gap 9, not this lane). armSgsceneIfSpell is that line; it
 * is called here so the cast reaches k_sgscene = 1 the frame it happens
 * instead of never. When the driver lands, its own call finds the scene
 * already armed and returns false — the two sites cannot double-arm.
 */
function castSnowGraveSpell(state, slot) {
  const k = state.kaizo;
  k.spelldelay = 30;
  const knight = state.entities.find((en) => en.alive && en.type.name === 'obj_knight_enemy');
  if (!knight) return null;   // scr_monsterpop() == 0
  castSnowgrave(state, { caster: slot, magic: statFor(state, slot).magic });
  armSgsceneIfSpell(state);
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// The ACT grid — rows, the X-Slash gate, the greyed heads
// ───────────────────────────────────────────────────────────────────────────

/** obj_knight_enemy Step_0:42-53, inside `if (k_sideb)` at damagereductiontimer 1. */
export const XSLASH_ACT_INDEX = 2;
export const XSLASH_ACT = { name: 'X-Slash', descb: 'Physical#damage', actor: 11, cost: 62.5 };

/**
 * obj_battlecontroller Step_0:1099-1113 — `canpress`, for a Kris row whose
 * `actactor` is 11:
 *
 *     if (havechar[1] == 1 && global.hp[2] > 0) canpress = 0;    // Susie
 *     if (havechar[2] == 1 && global.hp[3] > 0) canpress = 0;    // Ralsei
 *     if (havechar[3] == 1 && global.hp[4] > 0) canpress = 0;    // Noelle
 *
 * `havechar[]` is obj_darkcontroller's char-1 table; `global.hp[]` is
 * CHAR-indexed. X-Slash is selectable only once every partner in the party
 * is down — on the Weird Route, once Noelle is.
 */
export function xslashCanpress(state) {
  const hc = state.kaizo?.havechar ?? [0, 0, 0, 0];
  if (hc[1] === 1 && hpOfChar(state, CHAR_SUSIE) > 0) return false;
  if (hc[2] === 1 && hpOfChar(state, CHAR_RALSEI) > 0) return false;
  if (hc[3] === 1 && hpOfChar(state, CHAR_NOELLE) > 0) return false;
  return true;
}

/**
 * The X-Slash row as the seam wants it. `usable` folds the two gates the
 * game applies at the confirm — `canpress` and `global.tension >=
 * tensionselect` (Step_0:1163) — and the grey the Draw applies at :1223
 * (`if (global.tension < acttpcost[i]) cant = 1`). The confirm charges
 * `cost` (Step_0:1170).
 */
export function xslashRow(state) {
  return {
    ...XSLASH_ACT,
    usable: xslashCanpress(state) && state.tension >= XSLASH_ACT.cost,
  };
}

/**
 * The seam's act list for a slot: the roster's monstersetup rows
 * (kaizo/party/noelle.js kaizoActsForRoster — Check / HoldBreath, S-Action,
 * R-Action, N-Action, the HoldBreath fallback) plus, for KRIS on the B-Side,
 * `canact[myself][2]` = X-Slash. The knight writes that row at
 * damagereductiontimer == 1 — its first Step — so it is present for the
 * whole fight; it is appended here rather than stored in the roster because
 * `usable` is live state.
 */
export function kaizoActList(state, slot) {
  const charId = charIdOf(state, slot);
  if (!charId) return [];
  const rows = (state.kaizo?.acts?.[slot] ?? []).map((a) => ({ ...a }));
  if (charId === CHAR_KRIS && state.kaizo?.sideb) {
    while (rows.length < XSLASH_ACT_INDEX) rows.push({ name: '', descb: '', usable: false });
    rows[XSLASH_ACT_INDEX] = xslashRow(state);
  }
  return rows;
}

/** GameMaker's `c_gray`, 8421504 = 0x808080; -1 is every bit set, white. */
export const C_GRAY = 8421504;
export const C_WHITE_NEG = -1;

/**
 * obj_battlecontroller Draw_0:1173-1192 and :1257-1296 — the X-Slash row's
 * portrait strip (`chartime == 11`): Kris's own head greys if ANY partner is
 * alive, and each present partner's head is drawn grey with two spr_tenna_x
 * crosses over it, or in -1 (white) once they are down:
 *
 *     krsblend = c_white; if (hp[2] > 0 && havechar(2)) krsblend = c_gray; ...
 *     charoffset = 30 * (havechar[1] + havechar[2] + havechar[3]);
 *     _sb = c_gray; if (havechar[1] == 0 || hp[2] <= 0) _sb = -1;   (Susie)
 *     if (havechar[1]) { spr_headsusie at (28 + _xoff, 380) blend _sb;
 *                        spr_tenna_x frame 1 scale 0.7 angle 6 and angle 4
 *                        at (44 + _xoff, 391) blend _sb; _xoff += 30; }
 *     ...Ralsei with spr_headralsei / _rb, Noelle with spr_headnoelle / _nb
 *
 * Data for a renderer; nothing in render/ draws it yet (the ACT grid's
 * portrait strip is a render seam, like the charbox x positions). The cross
 * is the game's `spr_tenna_x` (32x32, 2 frames, identical in both data
 * files: sprites_kaizo.csv:3910) and it is NOT in the kaizo overlay — the
 * extracted frame dumps the pack tool reads hold no copy — so it is named
 * here as a glyph, not as a resolvable sprite; a drawer adds it to
 * pack-kaizo-sprites' WANT with a fresh extraction first, and check-sprites
 * is what refuses a quoted sprite name the overlay cannot serve.
 */
export function xslashGridHeads(state) {
  const hc = state.kaizo?.havechar ?? [0, 0, 0, 0];
  const partners = [
    [CHAR_SUSIE, 'spr_headsusie'],
    [CHAR_RALSEI, 'spr_headralsei'],
    [CHAR_NOELLE, 'spr_headnoelle'],
  ];
  let krsblend = C_WHITE_NEG;
  let cant = false;
  const heads = [];
  let xoff = 0;
  for (const [charId, sprite] of partners) {
    const present = hc[charId - 1] === 1;
    const alive = hpOfChar(state, charId) > 0;
    if (present && alive) { krsblend = C_GRAY; cant = true; }
    if (present) {
      const blend = alive ? C_GRAY : C_WHITE_NEG;
      heads.push({
        charId, sprite, x: 28 + xoff, y: 380, blend,
        crosses: [{ glyph: 'tenna_x', x: 44 + xoff, y: 391, scale: 0.7, angle: 6, blend },
          { glyph: 'tenna_x', x: 44 + xoff, y: 391, scale: 0.7, angle: 4, blend }],
      });
      xoff += 30;
    }
  }
  return { krsblend, cant, charoffset: 30 * (hc[1] + hc[2] + hc[3]), heads };
}

// ───────────────────────────────────────────────────────────────────────────
// The acting blocks — obj_knight_enemy Step_0, by character
// ───────────────────────────────────────────────────────────────────────────

/**
 * Other_23:1-9 — the CHECK strings, chosen once at the knight's Create by
 * `k_sideb`. Step_0:950-963 plays them by `checkcount`:
 *
 *     checkcount++;
 *     if (checkcount == 1) { msgset(0, kaizo_check1A); msgnext(kaizo_check1B); }
 *     else                 { msgset(0, kaizo_check2); }
 *
 * Two pages the first time, one after. The A-Side strings are the mod's
 * too (vanilla's "* But Kris couldn't learn anything." is gone on both
 * sides) — but the hooks are installed only with a roster, so V-C still
 * shows sim/dialogue.js's vanilla CHECK; that is a V-C text gap outside
 * this lane and recorded in the ledger.
 */
export const CHECK_PAGES = {
  a: {
    first: ['* Kris analyzed the enemy!', "* But the numbers didn't seem feasible..."],
    again: ["* Kris couldn't bear to check again."],
  },
  b: {
    first: ['* Kris tried to analyze the enemy, but they froze.', '* You brought this upon yourself.'],
    again: ['* Your actions were used up.'],
  },
};

/**
 * Step_0:964-978 — HoldBreath, and the mod changed its REPEAT line:
 *
 *     holdbreathcount++;
 *     if (holdbreathcount <= 1) "* Kris held their breath.&* Their heartbeat quickened.
 *                                &* The SOUL now moves faster./%"          (v105)
 *     if (holdbreathcount > 1)  "* Kris held their breath...&* They felt dizzy.
 *                                &* Nothing happened./%"       (v105: "* Kris smiled.")
 *     holdbreathcount = 1;
 *
 * The count and its clamp are sim/spells.js's holdBreath (the soul-speed
 * buff hangs off the same counter, and there must be one); only the page
 * text is the mod's.
 */
export const HOLDBREATH_PAGES = {
  first: ['* Kris held their breath.&* Their heartbeat quickened.&* The SOUL now moves faster.'],
  again: ['* Kris held their breath...&* They felt dizzy.&* Nothing happened.'],
};

/**
 * Step_0:1252-1274 — N-Action (`_noelleact == 1 && actconnoe == 1`):
 *
 *     if (nactcount == 0 && !k_sideb) {
 *         "* Noelle tries to talk to the Knight!/"
 *         "* But a strange chill made her unable to speak./"
 *         scr_anyface_next("noelle", "e");
 *         "* (Why does this feel..^1.&so familiar...?)/%"
 *     } else {
 *         "* Noelle couldn't bring herself to say anything./%"
 *     }
 *     nactcount++;
 *
 * Three pages once on the A-Side; one page every time on the B-Side. `^1`
 * is obj_writer's pause code and is kept in the string (it is the game's
 * text); the sim's writer counts it as two silent characters rather than a
 * pause — the writer's timing model is the engine's, not this lane's.
 * `scr_anyface_next` is the portrait beside the second page; the sim draws
 * no battle portraits (sim/dialogue.js says the same of Susie's).
 *
 * Step_0:1276-1291 — the same row when KRIS IS ABSENT (`_noelleact == 2`,
 * scr_monstersetup's HoldBreath fallback): shares the knight's
 * holdbreathcount, first use only while it is 0, and never clamps it —
 * unreachable on the Weird Route, translated because the row exists.
 */
export const NACTION_PAGES = {
  first_a: [
    '* Noelle tries to talk to the Knight!',
    '* But a strange chill made her unable to speak.',
    '* (Why does this feel..^1.&so familiar...?)',
  ],
  again: ["* Noelle couldn't bring herself to say anything."],
};
export const NOELLE_HOLDBREATH_PAGES = {
  first: ['* Noelle held her breath in panic..^1.&* The SOUL now moves faster.'],
  again: ['* Noelle held her breath in panic..^1.&* But nothing seemed to happen.'],
};

/**
 * S-ACTION — Step_0:1152-1167 (`_susieact == 1 && actconsus == 1`), and the
 * mod CUT ITS LAST PAGE. This is the one act-text delta the 104 block does
 * not show, because it lives in the knight's Step and not in monstersetup.
 *
 * The block is byte-identical to `gml_vanilla_v105`'s (Step_0:818-826) for
 * its first six `msg` writes, and then the two trees part:
 *
 *     v105  scr_anyface_next("none", 0);
 *           msgnextloc("* (Susie will not ACT any more.)/%", "..._gml_432_0");
 *     mod   global.msg[6] = string_replace_all(global.msg[6], "/", "/%");
 *
 * `msgset(0, s)` writes `msg[0]`; `scr_anyface_next` is `global.msgno++`
 * followed by `scr_susface(msgno, e)`, which writes a CONTROL-ONLY page
 * (`"\TX \F0 \E~1 \FS \TS %"` — gml_GlobalScript_scr_susface.gml:3, a `%`
 * auto-advance that shows no text) into `msg[1]`; the five `msgnext` calls
 * then fill `msg[2..6]`. So `msg[6]` IS the mod's last written page, "Then
 * we'll just. Have to do things the hard way.", and the replace re-terminates
 * it from `/` (page halt, more to come) to `/%` (halt and end).
 *
 * THE MOD'S S-ACTION IS THEREFORE THE VANILLA LIST MINUS ITS FINAL PAGE —
 * `sim/dialogue.js`'s `ACT_PAGES.susie.slice(0, -1)`, which the check asserts
 * BOTH ways so a correction to the vanilla text cannot silently desync this
 * one. It is written out in full here because this file's other page tables
 * are (CHECK_PAGES, NACTION_PAGES), and because "* (Susie will not ACT any
 * more.)" is a line a reader will look for and must be able to find absent.
 *
 * The `\EJ`/`\EV`/`\EW`/`\EX` face codes are stripped exactly as
 * `sim/dialogue.js` strips them: the sim draws no battle portraits.
 */
export const SACTION_PAGES = [
  '* Susie talked to the Knight!',
  "* I don't know what the hell you are, but...",
  '* Leave Toriel alone! You hear me!?',
  '* ...',
  "* ... Fine, you don't wanna listen?",
  '* Then we\'ll just. Have to do things the hard way.',
];

/**
 * THE KRIS-LESS FALLBACK ROWS, all three of them. `scr_monstersetup`'s 104
 * block ends with `if (!scr_havechar(1))`, which replaces slot 0 of Susie's,
 * Ralsei's AND Noelle's act list with "HoldBreath"
 * (scr_monstersetup.gml:1869-1880 — the mod's own addition; the block does not
 * exist in `gml_vanilla_v105`). The knight's Step_0 answers it with a matching
 * `_xact = 2` arm per character (Step_0:933-946 sets the 2; the arms are
 * :1190-1205 Susie, :1235-1250 Ralsei, :1276-1291 Noelle) and all three are
 * the SAME shape:
 *
 *     if (holdbreathcount == 0) { <first>;  holdbreathcount++; }
 *     else                      { <again>; }
 *
 * — the KNIGHT's one shared `holdbreathcount` (`state.knight.holdbreathcount`,
 * the same counter `sim/spells.js`'s `holdBreath` clamps for Kris), tested at
 * ZERO rather than Kris's `<= 1`, and NEVER clamped back.
 *
 * NOTHING HERE CLEARS THE ROW. `global.canactsus[myself][0] = 0` is inside the
 * `_susieact == 1` arm only, so the fallback HoldBreath is REPEATABLE where
 * S-Action is once-only — which is why the Susie branch below must not set
 * `susieUsed` on this path.
 *
 * UNREACHABLE IN BOTH SHIPPING ROUTES, and translated anyway because the rows
 * exist: `scr_havechar(1)` is party MEMBERSHIP, not survival, and Kris is in
 * `global.char` for the Normal Route ([1, 2, 3]) and the Weird Route
 * ([1, 4, 0]) alike. `kaizoActsForRoster` already builds the names for a
 * Kris-less roster; without these the row would be LABELLED HoldBreath and
 * play S-Action's six-page monologue.
 */
export const SUSIE_HOLDBREATH_PAGES = {
  first: ['* Susie kept her breath held in focus..^1.&* The SOUL now moves faster.'],
  again: ['* Susie kept her breath held in focus..^1.&* But nothing seemed to happen.'],
};
export const RALSEI_HOLDBREATH_PAGES = {
  first: ['* Ralsei held his breath to stay calm..^1.&* The SOUL now moves faster.'],
  again: ['* Ralsei held his breath to stay calm..^1.&* But nothing seemed to happen.'],
};

/**
 * The `_xact == 2` arm, once. Returns `first` while the knight's shared
 * `holdbreathcount` is 0 (incrementing it), `again` forever after.
 */
function companionHoldBreath(state, pages) {
  const kn = state.knight;
  if ((kn.holdbreathcount ?? 0) === 0) {
    kn.holdbreathcount = 1;
    return pages.first;
  }
  return pages.again;
}

/** `* Kris used X-Slash!/%` — Step_0:984, one page. */
export const XSLASH_PAGES = ['* Kris used X-Slash!'];

/**
 * The seam's acting block. Called by the director when the ACT's writer is
 * born (sim/spells.js resolveActPages's contract), never at selection.
 * Returns the pages, or undefined for a slot it does not own.
 */
export function kaizoResolveActPages(state, slot, actId) {
  const charId = charIdOf(state, slot);
  state.actCounts = state.actCounts ?? {};
  const n = state.actCounts;
  const side = state.kaizo?.sideb ? 'b' : 'a';

  if (charId === CHAR_KRIS) {
    if (actId === 0) {
      n.check = (n.check ?? 0) + 1;
      return n.check === 1 ? CHECK_PAGES[side].first : CHECK_PAGES[side].again;
    }
    if (actId === 1) {
      return holdBreath(state) === 'holdbreath_first' ? HOLDBREATH_PAGES.first : HOLDBREATH_PAGES.again;
    }
    if (actId === XSLASH_ACT_INDEX) {
      xslashStart(state, slot);
      return XSLASH_PAGES;
    }
    return undefined;
  }
  // `if (!scr_havechar(1)) { _susieact = 2; _ralseiact = 2; _noelleact = 2; }`
  // — Step_0:933-946, ALL THREE companions at once and before any of the arms
  // below is tested. See SUSIE_HOLDBREATH_PAGES for the whole receipt.
  const krisAbsent = !havechar(state, CHAR_KRIS);

  if (charId === CHAR_SUSIE) {
    // `_susieact == 2` does NOT clear the row, so `susieUsed` stays unset and
    // the fallback HoldBreath can be taken every turn.
    if (krisAbsent) return companionHoldBreath(state, SUSIE_HOLDBREATH_PAGES);
    // `global.canactsus[myself][0] = 0` — one performance (Step_0:1167).
    n.susieUsed = true;
    return SACTION_PAGES;
  }
  if (charId === CHAR_RALSEI) {
    if (krisAbsent) return companionHoldBreath(state, RALSEI_HOLDBREATH_PAGES);
    n.ralsei = (n.ralsei ?? 0) + 1;
    return ACT_PAGES[n.ralsei <= 1 ? 'ralsei' : 'ralsei_again'];
  }
  if (charId === CHAR_NOELLE) {
    // `_noelleact = 2` — the HoldBreath fallback row.
    if (krisAbsent) return companionHoldBreath(state, NOELLE_HOLDBREATH_PAGES);
    const nact = n.nact ?? 0;
    n.nact = nact + 1;
    if (nact === 0 && side === 'a') return NACTION_PAGES.first_a;
    return NACTION_PAGES.again;
  }
  return undefined;
}

// ───────────────────────────────────────────────────────────────────────────
// X-Slash — Step_0:980-1033 and Alarm_4
// ───────────────────────────────────────────────────────────────────────────

/** `alarm[4] = 14` — both hits, and the release after the second. */
export const XSLASH_ALARM = 14;

/**
 * The damage, computed every Step while `acting == 3` (Step_0:980-990):
 *
 *     var _xslashred = 0.15 + ((damagereduction - 0.15) * 1.25);
 *     if (_xslashred > 1.05) _xslashred = 1.05;
 *     _xslashdmg = round(((global.battleat[myself] * 160) / 20) - (global.monsterdf[chartarget[myself]] * 3));
 *     _xslashdmg = ceil(_xslashdmg * _xslashred);
 *     _xslashdmg = ceil(_xslashdmg * 2);
 *
 * `myself` is the knight's monster slot, 0, so `battleat[0]` is SLOT 0's
 * attack — Kris's, the only character who can select the row. A perfect
 * FIGHT bar is 150 points; this is 160 with no bar, reduced through a
 * steeper curve than the fight's `damagereduction` alone (0.18 -> 0.1875,
 * 0.35 -> 0.40, capped 1.05 at dr 0.87), then doubled — and landed twice.
 * `round` is GML's half-to-even.
 *
 * ── STILL DIVERGENT: THE DF SHOULD BE 5, NOT 0 (ledger G-22) ──────────────
 * `KNIGHT_DF` below is `sim/knight.js`'s VANILLA constant, 0. The mod's
 * `scr_monstersetup` monstertype-104 block sets `global.monsterdf[myself] =
 * 5`, and `global.chartarget[myself]` resolves to the Knight's own monster
 * slot 0, so this term is a flat 15 in the mod and 0 here — the act is
 * overstated by 15 points before the x1.25 curve and the doubling, about 37
 * per hit and 75 across the pair. This is the THIRD of the three formulas the
 * ledger names; the FIGHT bar (kaizo-vc-hooks fightDamage) and Rude Buster
 * (kaizo-vc-hooks vcCastSpell) already read `VC_KNIGHT.df`.
 *
 * NOT CHANGED HERE, and the reason is a stale test, not a doubt about the
 * number: `kaizo/tools/checks/check-spells-kaizo.mjs:328` computes its
 * expected value as `gmlRound((at * 160) / 20 - 0)` — the df term written as
 * a literal `0` — and four of its assertions (:329, :332, :339, :349) go red
 * the moment this line is correct. That file belongs to another lane. The
 * one-line fix is `VC_KNIGHT.df * 3` here (VC_KNIGHT from
 * ../versions/vc-script.js) plus `- VC_KNIGHT.df * 3` in the check's two
 * `want` expressions.
 */
export function xslashDamage(state) {
  const dr = state.knight?.damagereduction ?? 0;
  let red = 0.15 + (dr - 0.15) * 1.25;
  if (red > 1.05) red = 1.05;
  const at = statFor(state, 0).at;
  let dmg = gmlRound((at * 160) / 20 - KNIGHT_DF * 3);
  dmg = Math.ceil(dmg * red);
  dmg = Math.ceil(dmg * 2);
  return dmg;
}

/**
 * `acting == 3 && actcon == 0` (Step_0:991-1010) — the first hit, the frame
 * the ACT resolves:
 *
 *     k_didspell = 1;  dont_fucking_kill_the_knight = 1;
 *     "* Kris used X-Slash!/%"  scr_battletext_default();
 *     actcon = 21;
 *     krs = scr_act_charsprite("kris", spr_krisb_attack, 0.25, 1); depth = kris + 1;
 *     alarm[4] = 14;
 *     snd_pitch(snd_play(snd_scytheburst), 1.2);
 *     att = obj_basicattack at (x + 119, y + 76), scale 2 x 2;
 *     if (global.charweapon[1] == 26) att.sprite_index = spr_attack_shard;
 *     caster = 0; global.hittarget[0] = 0;
 *     scr_damage_enemy(0, _xslashdmg);
 *
 * `dont_fucking_kill_the_knight` is read in ONE place — obj_knight_enemy
 * Draw_0:151, the post-ROARING 60% cutscene gate — so the two hits cannot
 * trigger the ending mid-act. It is exposed as `state.kaizo.xslash.dontKill`;
 * the V-C gate lives in kaizo/scenes/kaizo-vc-hooks.js (endCutsceneReached)
 * and does not read it yet — outside this lane, noted in the ledger.
 *
 * `scr_act_charsprite` hides the hero (`image_alpha = 0`) and draws a
 * separate sprite instance over him; heroes are not drawn in this build
 * (gap 7), so the sprite name is recorded for the drawer that will.
 */
export function xslashStart(state, slot = 0) {
  const k = state.kaizo;
  const ctl = ensureSpellController(state);
  k.didspell = 1;
  const xs = k.xslash = {
    active: true,
    actcon: 21,
    dontKill: 1,
    hits: [],
    charsprite: 'spr_krisb_attack',
    vfx: [],
  };
  cue(state, 'snd_scytheburst', 1.2);
  xslashHit(state, xs, slot, { xscale: 2 });
  // `global.hittarget[0] = 0` sits BEFORE the first scr_damage_enemy — the
  // number column resets for the act. (The second hit's `global.hittarget[11]
  // = 0` is a typo in the mod, index 11 being nobody's stack; the second
  // number therefore stacks on the first, and so it does here.)
  ctl.alarm[4] = XSLASH_ALARM;
  return xs;
}

function xslashHit(state, xs, slot, { xscale }) {
  const knight = state.entities.find((en) => en.alive && en.type.name === 'obj_knight_enemy');
  const kx = knight?.x ?? 425;
  const ky = knight?.y ?? 78;
  const shard = gearOfChar(state, CHAR_KRIS).weapon === 26;
  xs.vfx.push({
    sprite: shard ? 'spr_attack_shard' : 'obj_basicattack', x: kx + 119, y: ky + 76,
    image_xscale: xscale, image_yscale: 2,
  });
  if (xs.hits.length === 0) resetDmgStack(state);
  const dmg = xslashDamage(state);
  kaizoScrDamageEnemy(state, dmg, slot);
  xs.hits.push({ frame: state.frame, damage: dmg });
}

/**
 * Alarm_4 is `actcon += 1`, and the Step reads the result (Step_0:1011-1033):
 *
 *     actcon == 22:  dont_fucking_kill_the_knight = 0; actcon = 23;
 *                    scr_act_charsprite_end(); krs = ...spr_krisb_attack again;
 *                    alarm[4] = 14; snd_scytheburst at pitch 0.8;
 *                    obj_basicattack at (x + 119, y + 76), scale -2 x 2 (mirrored);
 *                    caster = 0; global.hittarget[11] = 0;
 *                    scr_damage_enemy(0, _xslashdmg);
 *     actcon == 24:  scr_act_charsprite_end(); actcon = 1;
 *
 * So: hit, 14 frames, hit, 14 frames, done — `actcon == 1` is what lets
 * `scr_nextact` run once the writer is gone, so the turn holds for 28
 * frames after the text regardless of how fast it is dismissed.
 */
function xslashAlarm4(state) {
  const xs = state.kaizo?.xslash;
  if (!xs?.active) return;
  xs.actcon += 1;
  if (xs.actcon === 22) {
    xs.dontKill = 0;
    xs.actcon = 23;
    cue(state, 'snd_scytheburst', 0.8);
    xslashHit(state, xs, 0, { xscale: -2 });
    ensureSpellController(state).alarm[4] = XSLASH_ALARM;
  } else if (xs.actcon === 24) {
    xs.actcon = 1;
    xs.active = false;
    xs.charsprite = null;
  }
}

/**
 * `actcon == 1 && !instance_exists(obj_writer)` — the knight's gate before
 * scr_nextact. The director holds the turn while this is true; it is the
 * ONE call this lane adds to kaizo/scenes/kaizo-practice.js.
 */
export function kaizoActBusy(state) {
  const xs = state.kaizo?.xslash;
  return !!(xs?.active && xs.actcon !== 1);
}

// ───────────────────────────────────────────────────────────────────────────
// The ThornRing tick — obj_battlecontroller Step_0:1544-1567
// ───────────────────────────────────────────────────────────────────────────

/**
 *     var _dotick = 1;
 *     with (obj_knight_enemy) if (practicemode) _dotick = 0;
 *     if (_dotick && global.charweapon[4] == 13) {
 *         var _tick = 6;  if (i_ex(obj_knight_enemy)) _tick = 12;
 *         if ((t_siner % _tick) == 0)
 *             if (global.hp[4] > round(global.maxhp[4] / 3)) global.hp[4]--;
 *     }
 *     t_siner++;
 *
 * Every twelfth frame of the battle — menu, bullets, text, all of it — the
 * ring takes one HP off Noelle until she is at a third: 120 -> 40 over
 * 960 frames. `t_siner` starts at 0 (Create) and is tested BEFORE the
 * increment, so the first tick is the controller's first Step. Off in
 * practice mode; the tick is 6 outside this fight. It reads `global.hp[4]`
 * whether or not Noelle is in the party — `charweapon[4] == 13` is the only
 * gate — which is faithful and, on the Weird Route, the only case.
 */
export function stepThornringTick(state) {
  const k = state.kaizo;
  k.tSiner = k.tSiner ?? 0;
  const dotick = !k.practicemode;
  if (dotick && noelleWearsThornRing(state)) {
    const tick = state.knight ? 12 : 6;
    if (k.tSiner % tick === 0) {
      const hp = hpOfChar(state, CHAR_NOELLE);
      if (hp > gmlRound(maxhpOfChar(state, CHAR_NOELLE) / 3)) {
        setHpOfChar(state, CHAR_NOELLE, hp - 1);
      }
    }
  }
  k.tSiner += 1;
}

// ───────────────────────────────────────────────────────────────────────────
// global.charname — who the battle text says is casting
// ───────────────────────────────────────────────────────────────────────────

/**
 * `global.charname[]`, CHARACTER-indexed, from
 * `gml_GlobalScript_scr_initialize_charnames.gml:5-8` (identical in
 * `gml_vanilla_v105`, and re-stated at obj_initializer's Create:36-38 for the
 * first three):
 *
 *     global.charname[1] = "Kris";    global.charname[2] = "Susie";
 *     global.charname[3] = "Ralsei";  global.charname[4] = "Noelle";
 *
 * Every line scr_spelltext writes is `stringsetsubloc(..., global.charname[
 * global.char[caster]], ...)` — `~1` resolved through the SLOT -> ID bridge,
 * never off the slot. sim/spellphase.js's fallback reads `PARTY[slot].name`
 * instead, and sim/damage.js's PARTY slot 1 is SUSIE, so on the Weird Route
 * Noelle's Heal Prayer printed "* Susie cast HEAL PRAYER!" and her SleepMist
 * "* Susie cast SLEEPMIST!". Both were driven out of `state.battlemsg`.
 *
 * THE READER ALREADY EXISTED. `charName` (sim/spellphase.js:242-251) has
 * consulted `state.kaizo.hooks.charName` since the seam was cut; nothing ever
 * installed it. That is this repo's signature defect wearing its other face —
 * a reader with no writer — so `check-castername-kaizo.mjs` fails when the
 * READER is removed as well as when the name is wrong.
 */
export const CHARNAME_BY_CHAR = {
  1: 'Kris',
  2: 'Susie',
  3: 'Ralsei',
  4: 'Noelle',
};

/**
 * The `charName` hook: `global.charname[global.char[slot]]`.
 *
 * Returns undefined for a slot the roster does not fill — the engine's `??`
 * fallback then answers, which is what an empty pad slot deserves. A roster
 * member's own `name` is the HUD's upper-case spelling ("NOELLE"), so the
 * table above is read by character id rather than title-casing that.
 */
export function kaizoCharName(state, slot) {
  const charId = charIdOf(state, slot);
  return CHARNAME_BY_CHAR[charId];
}

// ───────────────────────────────────────────────────────────────────────────
// The controller entity and the install
// ───────────────────────────────────────────────────────────────────────────

/**
 * One invisible instance per fight, the way kaizo/party/scenes.js's
 * kaizoSceneDriver is: its Step is obj_battlecontroller's ThornRing tick,
 * its alarm[4] is obj_knight_enemy's Alarm_4 for the X-Slash. Neither event
 * touches the RNG. Spawned only by installKaizoMenu, i.e. only with a
 * roster.
 */
export const kaizoSpellController = {
  name: 'kaizo_spell_controller',
  create(e) {
    e.visible = false;
  },
  step(e, state) {
    stepThornringTick(state);
  },
  alarm: {
    4: (e, state) => xslashAlarm4(state),
  },
};

export function ensureSpellController(state) {
  let e = state.entities.find((en) => en.alive && en.type === kaizoSpellController);
  if (!e) e = spawn(state, kaizoSpellController, {});
  return e;
}

/**
 * INSTALL — fill the engine's character-table seam from the roster and
 * spawn the controller. Called by kaizo/scenes/kaizo-fight.js right after
 * installRoster, for versions that carry a party (V-D). `??=` on each hook
 * so a check that wraps one to prove it fired is not silently replaced
 * (the same courtesy kaizo-fight.js extends knightTarget).
 */
/**
 * THE ACT PAGES, INSTALLED WITHOUT A ROSTER.
 *
 * `installKaizoMenu` below is roster-gated by construction — kaizo-fight.js
 * calls it inside `if (v.party)`, and `party` is defined on version D alone.
 * That was right for everything it installs EXCEPT the act pages, and the
 * exception made the S-Action rewrite unreachable in every shipping version:
 * V-C is the only one with a Susie to perform it and never installed the hook,
 * while V-D installed it and has no Susie. A player saw the vanilla seven
 * pages, ending on "(Susie will not ACT any more.)", which the mod deletes.
 *
 * `kaizoResolveActPages` is CHARACTER-keyed — it opens with
 * `charIdOf(state, slot)` and reads nothing the roster provides — so it is
 * installable on its own. Everything else in installKaizoMenu genuinely does
 * need the roster and stays behind the gate.
 *
 * `??=` so a version that installs the full menu afterwards is not replaced.
 */
export function installKaizoActPages(state) {
  state.kaizo = state.kaizo ?? {};
  const hooks = state.kaizo.hooks = state.kaizo.hooks ?? {};
  hooks.resolveActPages ??= kaizoResolveActPages;
  return hooks;
}

export function installKaizoMenu(state) {
  state.kaizo = state.kaizo ?? {};
  const hooks = state.kaizo.hooks = state.kaizo.hooks ?? {};
  hooks.spellInfo ??= KAIZO_SPELL_INFO;
  hooks.spellList ??= kaizoSpellList;
  hooks.actList ??= kaizoActList;
  hooks.spellCost ??= kaizoSpellCost;
  hooks.castSpell ??= kaizoCastSpell;
  hooks.resolveActPages ??= kaizoResolveActPages;
  hooks.actBusy ??= kaizoActBusy;
  // `global.charname[global.char[caster]]` — sim/spellphase.js's charName has
  // read this hook all along and nothing wrote it, so every spell and item
  // line named the SLOT's vanilla character. See CHARNAME_BY_CHAR above.
  //
  // `hooks.spellText` (sim/spellphase.js:280) is the other half of that seam
  // and it stays UNINSTALLED on purpose: once charName answers, the engine's
  // own SPELL_TEXT table produces this roster's lines verbatim — the mod's
  // scr_spelltext cases 2/8/9/10 are byte-identical to the vanilla strings
  // sim/spellphase.js already carries. The mod's one addition is the k_freeze
  // "* It had no effect...!" suffix (scr_spelltext.gml:108-114 and :287-293),
  // which belongs with the freeze mechanic, not here.
  hooks.charName ??= kaizoCharName;
  ensureSpellController(state);
  return hooks;
}
