// MAGIC and ACT — the two lists the button row opens besides the bag.
//
// `global.spell[char][i]` from `scr_gamestart`, indexed by CHARACTER ID:
//
//     spell[1][0] = 7     Kris:   ACT
//     spell[2][0] = 4     Susie:  Rude Buster
//     spell[2][1] = 11            UltraHeal
//     spell[3][0] = 3     Ralsei: Pacify
//     spell[3][1] = 2             Heal Prayer
//
// **KRIS'S "MAGIC" IS ACT.** His only entry is spell 7, whose name is literally
// `"ACT"` and whose `spelltarget` is 0. That is why his button row reads ACT
// where Susie's and Ralsei's read MAGIC — it is one menu slot holding different
// contents, not two different buttons.
//
// Costs are RAW TP out of `global.maxtension = 250`, not percentages, and they
// come out to the familiar numbers: Rude Buster 125/250 = 50%, Heal Prayer
// 80/250 = 32%, Pacify 40/250 = 16%, UltraHeal 225/250 = 90%.
//
// `spelltarget`: 0 none, 1 an ALLY, 2 an ENEMY. It is what decides whether
// choosing the spell opens a target picker, and getting it from the dump
// rather than from the spell's obvious meaning matters for Pacify — it targets
// an enemy despite doing no damage.

import { PARTY, statFor } from './damage.js';
import { spellDamage, damageKnight } from './knight.js';
import { castRudeBuster } from './rudebuster.js';
import { applyHeal } from './items.js';
import { spawnSelfHealNumber } from './dmgnumbers.js';
import { PARTY as PARTY_STATS, partyMaxhp } from './damage.js';

/**
 * `scr_heal_amount_modify_by_equipment` — BlueRibbon's Heal+, and the SPELL
 * path is its only caller (scr_healitemspell / scr_healallitemspell, both
 * reached from scr_spell alone). Items heal their printed amount.
 */
const healAmountModifyByEquipment = (amount, ribbons) =>
  amount + Math.ceil(amount / 8) * ribbons;

/**
 * The spell path's writer: `scr_dmgwriter_selfchar()` at type 3, damage = the
 * MODIFIED heal amount, and `specialmessage = 3` — the MAX graphic — when the
 * heal left them at full.
 *
 * THE TEST IS TAKEN AFTER THE HEAL, and it is `>=`, not `==`: an ally already
 * at max who is healed again still reads MAX, which is what the game does and
 * is the only way "+0" never appears on screen.
 */
function healNumber(state, target, amount) {
  const maxed = state.partyHp[target] >= partyMaxhp(state, target);
  spawnSelfHealNumber(state, target, amount, maxed);
}
import { cue } from './audio.js';
import { ACT_PAGES } from './dialogue.js';

// Where the caster and the Knight stand. Duplicated from sim/actors.js rather
// than imported: actors.js pulls in damage.js which pulls in this, and the
// cycle is not worth untangling for two coordinates.
const PARTY_POS = [{ x: 126, y: 104 }, { x: 80, y: 142 }, { x: 58, y: 190 }];
const KNIGHT_POS = { x: 425, y: 78 };
// The Knight's sprite is 2x from its origin; his mass sits down and right of
// the instance position. Measured against where the hurt strobe draws him.
// `targety -= 50` from the bolt's Create is folded in here: 90 down to his
// mass, 50 back up for the Knight's own aim offset.
const KNIGHT_AIM = { dx: 60, dy: 90 - 50 };

/** `scr_spellinfo`, the cases this fight can reach. */
export const SPELLS = {
  2: { name: 'Heal Prayer', descb: 'Heal#Ally', cost: 80, target: 1 },
  3: { name: 'Pacify', descb: 'Spare#TIRED foe', cost: 40, target: 2 },
  4: { name: 'Rude Buster', descb: 'Rude#Damage#', cost: 125, target: 2 },
  7: { name: 'ACT', descb: 'Use#action', cost: 0, target: 0 },
  11: { name: 'UltraHeal', descb: 'Best#healing', cost: 225, target: 1 },
};

/** `global.spell[char]`, by PARTY SLOT (slot + 1 is the character id here). */
export const SPELL_LIST = [[7], [4, 11], [3, 2]];

// ── THE ACT TABLE IS FIVE PARALLEL ARRAYS, PICKED BY THE ACTING CHARACTER ──
//
// `obj_battlecontroller`'s Draw, the `bmenuno == 9` fill (Draw_0:1059-1096),
// is the authority on the shape. It does NOT read one list — it reads one of
// FOUR sets of five parallel arrays, chosen by `global.char[global.charturn]`,
// and every one of them is indexed `[thisenemy][__acti]`:
//
//     actcoord = global.bmenucoord[9][global.charturn];
//     for (__acti = 0; __acti < 6; __acti++) {
//         canact[__acti] = 0;
//         if (global.char[global.charturn] == 1) {
//             canact[__acti]    = global.canact[thisenemy][__acti];
//             acttpcost[__acti] = global.actcost[thisenemy][__acti];
//             actsimul[__acti]  = global.actsimul[thisenemy][__acti];
//             actname[__acti]   = global.actname[thisenemy][__acti];
//             actdesc[__acti]   = global.actdesc[thisenemy][__acti];
//         }
//         if (global.char[global.charturn] == 2) { ...canactsus / actcostsus /
//             actsimulsus / actnamesus / actdescsus... }
//         if (global.char[global.charturn] == 3) { ...*ral... }
//         if (global.char[global.charturn] == 4) { ...*noe... }
//     }
//
// So the menu shows the ACTING CHARACTER'S OWN acts against the TARGETED
// enemy. Two dimensions, not one — and the previous model here was a flat
// per-slot list of `{name, descb}` with neither, no cost, no simul, and no
// character 4 at all.
//
// THE ARRAY IS `canactnoe`, WITH NO TRAILING L. Grepping `canactnoel` returns
// zero files across the whole dump and reads as "Noelle has no act row
// anywhere", which is false — the field exists for every enemy and
// `scr_spellmenu_setup` has a `global.char[__i] == 4` branch for it.
//
// A SIXTH FIELD RIDES ALONG: `global.actactor[thisenemy][i]`, read at
// Draw_0:1145 as `chartime` — and read ONLY under `global.char[charturn] == 1`,
// so a partner's own rows never draw a portrait marker. It is not one of the
// five the fill copies; it is read straight out of the global. Its default is
// 1 (see ACT_ROW_DEFAULT) and `scr_actselect` branches on 2/3/4/5 to mark the
// extra performers. `render/menu.js` carries the 11 case.
//
// `actactorsus` / `actactorral` / `actactornoe` DO NOT EXIST as a mechanism.
// `obj_knight_enemy`'s Step has the single line `global.actactorsus[myself][0]
// = 0` and that is the ONLY occurrence of any of the three spellings in the
// entire dump — no initialiser in `scr_monster_actreset`, no reader anywhere.
// ORIGINAL BUG: a write-only variable, the same family as `splitbox` and
// `slice_delay`. It is not modelled and must not be "restored".

/**
 * `scr_monster_actreset(arg0)` — what every row of every enemy's table holds
 * before `scr_monstersetup` writes anything. Byte-identical between the mod
 * and its comparison tree, so this is the vanilla default too.
 *
 *     global.canact[arg0][__fj]     = 0;
 *     global.actname[arg0][__fj]    = " ";
 *     global.actactor[arg0][__fj]   = 1;
 *     global.actdesc[arg0][__fj]    = " ";
 *     global.actcost[arg0][__fj]    = 0;
 *     global.actsimul[arg0][__fj]   = 0;
 *     ...and the sus / ral / noe quintuplets, minus actactor.
 *
 * THE DEFAULT NAME AND DESCRIPTION ARE A SINGLE SPACE, not the empty string.
 * It draws the same (a space inks nothing), but it is what the array holds,
 * and a row the setup block leaves alone keeps it — which is why HoldBreath's
 * description below is `' '`: the monstertype-104 block writes `actdesc[0]`
 * and never `actdesc[1]`.
 */
export const ACT_ROW_DEFAULT = Object.freeze({
  canact: 0, name: ' ', actor: 1, descb: ' ', cost: 0, simul: 0,
});

/**
 * One row of a monstersetup block: the FIVE fields the Draw's fill copies,
 * materialised, with `scr_monster_actreset`'s value for any the block leaves
 * alone.
 *
 * `actactor` IS DELIBERATELY NOT MATERIALISED HERE. It is not one of the five
 * — the fill never touches it, and Draw_0:1145 reads `global.actactor[...][i]`
 * straight out of the global, only under `global.char[charturn] == 1`. So a
 * row carries `actor` when its setup block WRITES one (the mod's X-Slash
 * writes 11) and otherwise carries nothing, and every reader takes
 * `ACT_ROW_DEFAULT.actor` — the 1 `scr_monster_actreset` puts there. Writing a
 * literal 1 onto every vanilla row would say "this block assigned an actor",
 * which none of them do.
 */
const actRow = (r) => Object.freeze({
  canact: 1,
  name: ACT_ROW_DEFAULT.name,
  descb: ACT_ROW_DEFAULT.descb,
  cost: ACT_ROW_DEFAULT.cost,
  simul: ACT_ROW_DEFAULT.simul,
  ...r,
});

/**
 * `scr_monstersetup`, the `global.monstertype[myself] == 104` block — THE
 * KNIGHT'S WHOLE ACT TABLE, keyed by CHARACTER ID (1 Kris, 2 Susie,
 * 3 Ralsei, 4 Noelle) exactly as the Draw's four `if`s key it.
 *
 * `obj_knight_enemy`'s Other_22 calls `scr_monstersetup()`, and
 * `scr_encountersetup`'s `case 115` sets `global.monstertype[0] = 104` with
 * `global.monsterinstancetype[0] = obj_knight_enemy`, so the Knight really
 * does take this block and really is enemy slot 0 — `thisenemy` is 0 for the
 * whole fight.
 *
 *     global.canact[myself][0]    = 1;  actname "Check"
 *                                       actdesc "Useless#analysis"
 *     global.canact[myself][1]    = 1;  actname "HoldBreath"
 *     global.canactsus[myself][0] = 1;  actnamesus "S-Action"  actsimulsus 0
 *     global.canactral[myself][0] = 1;  actnameral "R-Action"  actsimulral 0
 *
 * **NOELLE HAS NO ROW HERE, AND THAT IS A MEASURED ABSENCE, NOT A GAP IN THE
 * READING.** The v1.05 comparison tree's 104 block writes `canact`,
 * `canactsus` and `canactral` and never once touches `canactnoe`, so with
 * `scr_monster_actreset`'s 0 still in place her list is EMPTY. She is not in
 * the vanilla party either. Kaizo's mod build is where `canactnoe[myself][0] =
 * 1` ("N-Action") appears, and that belongs to the kaizo side's hook, not
 * here. An empty array is the answer, not a missing key: `actsFor` must be
 * able to say "this character has no acts against this enemy" and be right.
 *
 * `S-Action` and `R-Action` are the GAME'S strings, not placeholders we chose.
 * They are byte-identical in both dumps. Two further sites treat them as a
 * generic label and neither is reachable in this fight — see ACT_GENERIC_NAMES.
 */
export const ACT_TABLES = Object.freeze({
  104: Object.freeze({
    1: Object.freeze([
      actRow({ name: 'Check', descb: 'Useless#analysis' }),
      actRow({ name: 'HoldBreath' }),
    ]),
    2: Object.freeze([actRow({ name: 'S-Action' })]),
    3: Object.freeze([actRow({ name: 'R-Action' })]),
    4: Object.freeze([]),
  }),
});

/** `global.monstertype[0]` for this fight — scr_encountersetup case 115. */
export const KNIGHT_MONSTERTYPE = 104;

/**
 * The three names the game itself treats as "this enemy has nothing specific
 * for you". `obj_battlecontroller`'s Draw_0:794-805, inside the `bmenuno ==
 * 13` arm of the enemy picker, replaces each of them with the literal
 * `"Standard"` before drawing it beside the enemy's name:
 *
 *     var __actname = stringsetloc("Standard", ...);
 *     var __plainactname = __actname;
 *     if (global.char[global.charturn] == 2) __actname = global.actnamesus[i][...];
 *     ...3 -> actnameral, 4 -> actnamenoe...
 *     if (__actname == "S-Action") __actname = __plainactname;
 *     if (__actname == "R-Action") __actname = __plainactname;
 *     if (__actname == "N-Action") __actname = __plainactname;
 *     draw_set_color(hpcolorsoft[global.char[global.charturn] - 1]);
 *
 * NOT REACHED BY THIS FIGHT, and the export exists so the fact has one home
 * rather than being rediscovered as "the sim invented S-Action". bmenuno 13 is
 * the target picker a PARTNER's act row opens out of the spell list, and the
 * spell list is not where this engine puts act rows — see the note on
 * `scr_spellmenu_setup` under ACT_SPECIAL_BY_CHAR.
 */
export const ACT_GENERIC_NAMES = Object.freeze(['S-Action', 'R-Action', 'N-Action']);

/**
 * `global.battlespellspecial[__i][__fj]` — `scr_spellmenu_setup` stamps 1 on
 * Kris's act rows, 2 on Susie's, 3 on Ralsei's, 4 on Noelle's (:30, :54, :78,
 * :98), and obj_battlecontroller's Draw_0:955-958 is the only reader:
 *
 *     draw_set_color(c_white);
 *     if (global.battlespellspecial[thischar][...] >= 1)
 *         draw_set_color(hpcolorsoft[global.char[thischar] - 1]);
 *
 * so an ACT row sitting in a character's SPELL list draws in that character's
 * own soft HP colour instead of white — the "special colours" of S-Action,
 * R-Action and N-Action. The colour itself is `HP_COLOR_SOFT` in sim/menu.js,
 * derived there from the `HPCOLOR` that file already carries, because
 * `hpcolorsoft` and `hpcolor` are the SAME four lines of
 * obj_battlecontroller's Create (:230-237) and splitting them across two
 * modules is how one of them drifts.
 *
 * `c_gray` STILL WINS over the character colour: the draw sets the soft colour
 * first and the `global.tension < battlespellcost || _cant` test overwrites it
 * (:966-969). An unaffordable S-Action is grey, not a dim fuchsia.
 *
 * **THIS ENGINE DOES NOT PUT ACT ROWS IN THE SPELL LIST, AND THAT IS A
 * MEASURED POSITION RATHER THAN AN OVERSIGHT.** `scr_spellmenu_setup` is
 * byte-identical between the mod and the comparison tree and does build them —
 * `canactsus[0][0] == 1` becomes `battlespell[slot][0] = -1`, pushing Rude
 * Buster to index 1. Landing that in this engine has now cost the kaizo byte
 * gate 3,763 frames TWICE (`_rev1` trace f12492 -> f8729, first group TURN /
 * `mnfight`: the oracle leaves the menu and the sim does not). `_rev1` is a
 * recording of the real thing, and a recording outranks a GML reading. The
 * table and the colour rule are recorded here; the row placement is not
 * modelled until a recording says where the rows go.
 */
export const ACT_SPECIAL_BY_CHAR = Object.freeze({ 1: 1, 2: 2, 3: 3, 4: 4 });

/**
 * THE SLOT-ORDERED VIEW, for this fight's fixed party only.
 *
 * Kept because it is the shape every existing reader and check already knows,
 * and derived from ACT_TABLES so there is still one source. `global.char` is
 * [1, 2, 3] here, so slot i holds character i + 1 — the identity bridge, and
 * the ONLY arrangement in which a slot-indexed act table is correct at all.
 * Anything that fields a different party reads `actsFor`, which resolves the
 * character id first.
 */
export const ACTS = [1, 2, 3].map((id) =>
  ACT_TABLES[KNIGHT_MONSTERTYPE][id].map((r) => ({ name: r.name, descb: r.descb })));

// ── THE CHARACTER-TABLE SEAM ────────────────────────────────────────────────
//
// The three tables above are indexed by PARTY SLOT because this fight's party
// is fixed: slot i is always character i + 1, so `SPELL_LIST[1]` is Susie's
// list and `ACTS[1]` is hers. The game does not index that way. Every one of
// these reads is `global.spell[global.char[charturn]]`, `global.canactsus`
// / `actnamesus` (obj_battlecontroller Draw_0, the bmenuno-9 fill) and
// `scr_actselect`'s `global.char[global.charturn] == 1 / 2 / 3 / 4` — by
// CHARACTER ID, through the slot -> id bridge. The two agree only while the
// bridge is the identity, which it is for Kris/Susie/Ralsei and nothing else.
//
// A scene that fields a different party (a kaizo lane: Kris + Noelle, whose
// `global.char` is [1, 4, 0]) supplies its own character-keyed answer through
// `state.kaizo.hooks`, and each accessor below falls back to the slot table
// when no hook is installed — `??`, exactly the shape render/menu.js's
// `state.partySprites` seam takes. Vanilla installs nothing, reads nothing
// different, and the six whole-fight diffs pin that. sim/ still imports
// nothing from any scene; the hook is a plain state field.
//
//   spellInfo(state, id)        scr_spellinfo's row for one id; a hook may
//                               ADD ids this table lacks (8, 9, 10) and never
//                               needs to restate the ones it has
//   spellListFor(state, slot)   `global.spell[global.char[slot]]`
//   actsFor(state, slot)        the canact/actcost/actsimul/actname/actdesc
//                               fill, for the CHARACTER the slot holds and
//                               the enemy the fight is against. A hook's row
//                               may carry `usable` (the mod's `canpress` /
//                               `cant` gates, computed live) and `cost`
//                               (`actcost`, TP spent at the grid's confirm);
//                               listRows and the confirm handler read both,
//                               and a vanilla row's cost is 0, so vanilla
//                               spends nothing.
//   spellCost / castSpell / resolveActPages take a hook the same way: it
//   answers, or returns undefined (pages: a falsy value) to hand the id
//   back to the vanilla body below.
export function spellInfo(state, id) {
  return state?.kaizo?.hooks?.spellInfo?.[id] ?? SPELLS[id];
}

export function spellListFor(state, c) {
  return state?.kaizo?.hooks?.spellList?.(state, c) ?? SPELL_LIST[c];
}

/**
 * `global.monstertype[thisenemy]` — which enemy's table the grid reads. This
 * fight has exactly one monster and it is slot 0 (scr_encountersetup case 115
 * fills `monstertype[0]` and zeroes 1 and 2), so `thisenemy` is 0 and the type
 * is 104. `state.monsterType` is the override a scene may publish; nothing in
 * `sim/` writes it, which is what keeps the vanilla answer constant.
 */
export function enemyMonsterType(state) {
  return state?.monsterType ?? KNIGHT_MONSTERTYPE;
}

/**
 * `global.char[global.charturn]` — the character id in a party SLOT.
 *
 * The same two state fields `sim/menu.js`'s `charIdForSlot` reads, written out
 * here rather than imported: `sim/menu.js` already imports this module, and
 * the file's own note about `sim/actors.js` records that the cycle is not
 * worth untangling for an accessor. `tools/verify-actmodel.mjs` asserts the
 * two agree on every slot of every party, so the duplication cannot drift.
 *
 * ONE DELIBERATE DIFFERENCE, AND IT IS THE EMPTY SLOT. `charIdForSlot` answers
 * `slot + 1` for a `global.char` of 0, because its caller is a COLOUR lookup
 * and "must never be the thing that throws" — its own note says so. The ACT
 * fill has no such licence: `global.char[global.charturn] == 0` matches none
 * of the Draw's four `if`s, so `canact[__acti]` keeps the 0 the loop wrote and
 * the grid is EMPTY. Returning 0 here and letting `actsFor` answer `[]` is
 * that behaviour; falling back would hand an unoccupied slot the rows of
 * whoever the vanilla party seats there, which on the Weird Route
 * (`global.char = [1, 4, 0]`) gave the empty third slot Ralsei's R-Action.
 * Found by check-act-selector, section C.
 */
function charIdOfSlot(state, slot) {
  const ids = state?.partyCharIds ?? state?.kaizo?.globalChar;
  if (Array.isArray(ids)) return ids[slot] > 0 ? ids[slot] : 0;
  return slot + 1;
}

/**
 * THE DRAW'S OWN SELECTOR, in one function: the acting character's rows
 * against the targeted enemy.
 *
 * `obj_battlecontroller` Draw_0:1059-1096 picks the quintuplet by
 * `global.char[global.charturn]` and indexes it `[thisenemy][__acti]`. So the
 * argument is a SLOT and the table is keyed by CHARACTER — the two coincide
 * only while `global.char` is [1, 2, 3], which is this fight and nothing else.
 *
 * A character with no row for this enemy gets `[]`, not `undefined`: the fill
 * zeroes `canact[__acti]` before every branch, so "no rows" is a real, drawn
 * answer (an empty grid, which the confirm handler already turns into
 * `snd_error`) and not a missing lookup.
 */
export function actsFor(state, c) {
  const hooked = state?.kaizo?.hooks?.actList?.(state, c);
  if (hooked) return hooked;
  const table = ACT_TABLES[enemyMonsterType(state)];
  return table?.[charIdOfSlot(state, c)] ?? [];
}

/**
 * `cant` — the ACT grid's grey, computed from the row rather than supplied.
 *
 * obj_battlecontroller Draw_0:1140-1246 walks six gates and any one of them
 * sets `cant = 1`, which swaps `draw_set_color(c_white)` for `c_gray` and
 * makes the confirm refuse. Two of the six are enemy-specific (monstertype 59
 * with `flag[1044] < 150`, and monstertype 103's Tenna score) and neither
 * enemy is in this fight, so they are not modelled. The four that generalise:
 *
 *     chartime == 2 || chartime == 4 -> havechar[1] == 0 || global.hp[2] <= 0
 *     chartime == 3 || chartime == 4 -> havechar[2] == 0 || global.hp[3] <= 0
 *     chartime == 5                  -> havechar[3] == 0 || global.hp[4] <= 0
 *     global.tension < acttpcost[i]
 *
 * — a row performed WITH somebody needs that somebody present and standing,
 * and any row needs its TP. `chartime` is `actactor`, so `actor` 4 is the
 * both-of-them case and is tested twice, which is why it is two conditions
 * here rather than a switch.
 *
 * `actor` 11 is the mod's own and INVERTS the test — the row is usable only
 * once every partner is DOWN (Draw_0:1173-1192). It is listed here so the
 * vanilla values 1..5 are not mistaken for the whole set; the 11 case is a
 * kaizo row and arrives with its own `usable`, which wins below.
 *
 * VANILLA IS INERT THROUGH THIS: every row of monstertype 104 has `actor` 1
 * and `cost` 0, so nothing is ever greyed and the answer is always true.
 */
export function actUsable(state, slot, row) {
  if (!row) return false;
  if (row.usable !== undefined) return row.usable;
  const actor = row.actor ?? ACT_ROW_DEFAULT.actor;
  // `havechar[n] == 0 || global.hp[c] <= 0` — the partner has to be IN the
  // party and STANDING. `charIdOfSlot` answers 0 for an unoccupied slot, which
  // no character id matches, so the presence half needs no second test.
  const upById = (id) => {
    for (let s = 0; s < 3; s++) {
      if (charIdOfSlot(state, s) !== id) continue;
      return (state?.partyHp?.[s] ?? 0) > 0;
    }
    return false;
  };
  if (actor === 2 || actor === 4) { if (!upById(2)) return false; }
  if (actor === 3 || actor === 4) { if (!upById(3)) return false; }
  if (actor === 5) { if (!upById(4)) return false; }
  if ((state?.tension ?? 0) < (row.cost ?? ACT_ROW_DEFAULT.cost)) return false;
  return true;
}

/**
 * `scr_spellconsumeb`'s TP check. A spell you cannot pay for is still SHOWN —
 * greyed, not hidden — because the list is built from what the character
 * knows, not from what they can afford this second.
 */
export function spellCost(state, slot, spellId) {
  // The seam (see spellInfo): a character-keyed cost, or undefined to fall
  // through to the table.
  const hook = state?.kaizo?.hooks?.spellCost;
  if (hook) {
    const v = hook(state, slot, spellId);
    if (v !== undefined) return v;
  }
  const s = spellInfo(state, spellId);
  if (!s) return Infinity;
  // Devilsknife's "Buster TP DOWN" — 125 -> 100, the familiar 50% -> 40%.
  if (spellId === 4) return statFor(state, slot).rudeBusterCost;
  return s.cost;
}

export function canAfford(state, spellId, slot = 1) {
  return state.tension >= spellCost(state, slot, spellId);
}

/**
 * HOLDBREATH, from obj_knight_enemy's Step:
 *
 *     if (acting == 2 && actcon == 0) {
 *         actcon = 1;
 *         holdbreathcount++;
 *         if (holdbreathcount <= 1) "* The SOUL now moves faster."
 *         if (holdbreathcount > 1)  "* Nothing happened."
 *         holdbreathcount = 1;
 *     }
 *
 * and then, at the top of the same Step:
 *
 *     if (holdbreathcount > 0 && i_ex(obj_heart))                 wspeed = 5;
 *     if (holdbreathcount > 0 && i_ex(obj_knight_roaring2) ...)    wspeed = 6;
 *
 * **IT ONLY WORKS ONCE.** The counter is incremented and then hard-assigned
 * back to 1, so the second use prints "Nothing happened" and changes nothing.
 * A naive `holdbreathcount++` would let it stack forever.
 *
 * The payoff is soul speed 4 -> 5, and 6 while Roaring is on screen — the
 * fight's one permanent buff, and the reason the ACT is worth a turn.
 */
/**
 * THE KNIGHT'S ACTING BLOCKS — the counts, their clamps, and the page choice
 * they drive, exactly as obj_knight_enemy's Step performs each ACT after the
 * menu closes:
 *
 *     acting == 2:    actcon = 1; checkcount++;  pages by checkcount == 1
 *     acting == 2b:   holdbreathcount++; pages by <= 1; holdbreathcount = 1
 *     actingsus == 1: seven pages; sactcount = 1; canactsus[0] = 0
 *     actingral == 1: ractcount++; five pages or three by ractcount == 1
 *
 * Called by the director when the ACT's writer is BORN — the sim's "after the
 * menu" — never at selection. At selection these effects could not be undone:
 * an X after choosing HoldBreath left the speed buff live and the repeat page
 * armed, and cancelling Ralsei's first R-Action burned his five-page variant
 * unseen.
 */
export function resolveActPages(state, c, actId) {
  state.actCounts = state.actCounts ?? {};
  const n = state.actCounts;
  // The seam (see spellInfo): a character-keyed acting block, or a falsy
  // value to hand the act back to the slot-keyed blocks below.
  const hook = state.kaizo?.hooks?.resolveActPages;
  if (hook) {
    const pages = hook(state, c, actId);
    if (pages) return pages;
  }
  if (c === 0) {
    if (actId === 1) return ACT_PAGES[holdBreath(state)];
    n.check = (n.check ?? 0) + 1;
    return ACT_PAGES[n.check === 1 ? 'check' : 'point'];
  }
  if (c === 1) {
    // `global.canactsus[myself][0] = 0` — one performance, then the row
    // leaves her list. Read by listRows.
    n.susieUsed = true;
    return ACT_PAGES.susie;
  }
  n.ralsei = (n.ralsei ?? 0) + 1;
  return ACT_PAGES[n.ralsei <= 1 ? 'ralsei' : 'ralsei_again'];
}

export function holdBreath(state) {
  // RETURNS THE PAGE KEY, not a sentence. It used to return its own condensed
  // text —
  //
  //     '* Kris held their breath. The SOUL now moves faster.'
  //
  // — against the dump's
  //
  //     "* Kris held their breath.&* Their heartbeat quickened.&
  //      * The SOUL now moves faster./%"
  //
  // so the chatbox lost a whole line ("Their heartbeat quickened.", and
  // "* Kris smiled." on the repeat) and ran the rest together on one row. The
  // correct pages were already in ACT_PAGES and driving the writer, so the
  // fight showed two different texts for the same act depending on which one
  // you were looking at. One source now; the caller pulls both from ACT_PAGES.
  //
  // The count is the dump's, verbatim: `holdbreathcount++`, pick on `<= 1`,
  // then CLAMP back to 1 — which is what stops the buff stacking.
  const n = (state.knight.holdbreathcount ?? 0) + 1;
  state.knight.holdbreathcount = 1;
  return n <= 1 ? 'holdbreath_first' : 'holdbreath_again';
}

/** The soul's `wspeed`, which HoldBreath is the only thing that changes. */
export function soulSpeed(state) {
  if (!state.knight?.holdbreathcount) return 4;
  return state.roaringActive ? 6 : 5;
}

/**
 * Cast. Returns a line for the HUD, or null if it could not be paid for.
 *
 * `scr_spellconsumeb` spends the TP FIRST and the effect runs after, so a
 * spell that turns out to do nothing still costs — Pacify against an enemy
 * that cannot be spared is a wasted 40, and this fight's Knight is exactly
 * that enemy.
 */
export function castSpell(state, slot, spellId, target = 0, opts = {}) {
  // The seam (see spellInfo): a character-keyed scr_spell case, or undefined
  // to hand the id to the cases below. It runs BEFORE the TP test on purpose:
  // the hook is a whole scr_spell case, and scr_spell does not charge —
  // scr_spellconsumeb already did, at selection (recordSpell in sim/menu.js).
  const hook = state.kaizo?.hooks?.castSpell;
  if (hook) {
    const r = hook(state, slot, spellId, target, opts);
    if (r !== undefined) return r;
  }
  const s = spellInfo(state, spellId);
  if (!s) return null;
  // `scr_spellconsumeb` deducts TP when the spell is SELECTED, not when it
  // resolves — that is what stops two characters spending the same 125 in one
  // turn. The menu's recordSpell has already paid, so the resolve pass must
  // not charge again.
  if (!opts.alreadyPaid) {
    if (state.tension < s.cost) return null;
    state.tension -= s.cost;
  }

  if (spellId === 4) {
    // RUDE BUSTER DOES NOT RESOLVE HERE. It is a timing minigame: the
    // animation plays, a bolt flies, and pressing Z just before it lands adds
    // up to +30 before the Knight's halving. Subtracting the damage on cast —
    // which is what this did — threw the whole mechanic away and made the
    // spell a worse Rude Buster than the game's.
    //
    // See sim/rudebuster.js. `scr_spell` sets `global.spelldelay = 70`, so the
    // turn holds while it resolves.
    // AIM AT THE KNIGHT WHERE HE ACTUALLY IS, not at a constant. `targetx/y`
    // come from `global.monsterx/monstery`, which track the instance — and
    // this Knight BOBS (`y = ystart + cos(siner2 / 8) * 8`) and shakes when
    // hit. A fixed origin sent the bolt to where he was at scene build, so it
    // flew past him and detonated on empty air.
    //
    // The sprite is drawn at scale 2 from its origin, so the visual centre is
    // well right of and below `x, y` — aiming at the raw origin puts the
    // impact off his shoulder even when the coordinates are live.
    const k = state.entities.find((en) => en.alive && en.type.name === 'obj_knight_enemy');
    const kx = (k?.x ?? KNIGHT_POS.x) + KNIGHT_AIM.dx;
    const ky = (k?.y ?? KNIGHT_POS.y) + KNIGHT_AIM.dy;
    castRudeBuster(state, PARTY_POS[slot].x, PARTY_POS[slot].y,
      spellDamage(state, slot), kx, ky);
    return 'Rude Buster!';
  }
  if (spellId === 2) {
    // Heal Prayer heals `magic * 5` — 55 at Ralsei's magic of 11. Through
    // scr_heal, so it lands on the fallen and floors at ceil(maxhp / 6).
    // `magic * 5`, off the EQUIPPED magic — Dealmaker's +5 is most of
    // Ralsei's healing. BlueRibbon's Heal+ multiplies what the WEARER heals.
    const st = statFor(state, slot);
    const amount = healAmountModifyByEquipment(st.magic * 5, st.healRibbons);
    applyHeal(state, target, st.magic * 5, st.healRibbons);
    healNumber(state, target, amount);
    // NO CHATBOX LINE. scr_spell's case 2 heals, spawns obj_healanim, and
    // writes the number through scr_dmgwriter_selfchar at type 3 (green) with
    // `specialmessage = 3` when the target is already full — and that number
    // above the character IS the entire feedback. `Heal Prayer: +55` was
    // invented text in a box the game leaves alone.
    //
    // `global.spelldelay` is NOT translated, deliberately. It drives
    // obj_spellphase, which this sim does not model. The per-character resolve
    // delay the director DOES use is obj_attackpress's own `spelldelay[c]`,
    // which the dump initialises to 10 and the director already hardcodes at
    // that. A state field nothing reads is the dead-write hazard this project
    // keeps tripping over, so it is left out rather than left inert.
    return null;
  }
  if (spellId === 11) {
    // UltraHeal's cost is `225 - round(global.flag[1045] * 2.5)`; flag 1045 is
    // 0 in this fight's state, so it is the flat 225.
    const st2 = statFor(state, slot);
    const amount = healAmountModifyByEquipment(st2.magic * 5 + 100, st2.healRibbons);
    const did = applyHeal(state, target, st2.magic * 5 + 100, st2.healRibbons);
    healNumber(state, target, amount);
    return `UltraHeal: +${did}`;
  }
  if (spellId === 3) {
    // PACIFY FAILS VISIBLY, it does not print an excuse. scr_spell's case 3
    // spares only a TIRED enemy (`global.monsterstatus[star] == 1`); the
    // Knight's status never leaves 0, so the else branch runs:
    //
    //     _pspell = instance_create(0, 0, obj_pacifyspell);
    //     _pspell.target = global.monsterinstance[star];
    //     _pspell.fail = 1;
    //     global.spelldelay = 20;
    //
    // and obj_pacifyspell's `fail` path skips the lift-and-sparkle entirely
    // (con 1 -> con 5) for a colour flash: con 6 walks image_blend toward
    // c_blue at 0.12 a frame for 8 frames, con 8 walks it back to c_white at
    // 0.16 for 8 more, con 9 restores white and destroys.
    //
    // `Pacify: the Knight is not TIRED` was invented text explaining a thing
    // the game shows you instead.
    state.pacifyFail = { con: 6, alarm: 8 };
    return null;
  }
  return null;
}
