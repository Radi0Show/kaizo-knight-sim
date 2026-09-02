// KAIZO V-C/V-D — THE VARIABLE-SIZE ROSTER. The foundation the rest of the
// B-Side is built on.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE (kaizo dump):
//   gml_GlobalScript_kaizo_settings_init.gml : scr_fixparty (the compaction),
//                                              scr_refreshchar (havechar /
//                                              charpos), scr_picktarget_
//                                              weighted, scr_kaizo_target
//   gml_GlobalScript_scr_havechar.gml        : havechar(1..4) over global.char
//   gml_GlobalScript_scr_encountersetup.gml  : 5-23 the generic 1- and 2-member
//                                              re-stack, 701-719 case 115's
//                                              OVERRIDE of it
//   gml_Object_obj_battlecontroller_Create_0.gml : 185-222 hero spawn —
//                                              position from the SLOT, depth
//                                              `200 - i * 20`, `char` from the
//                                              id, `myself` = the slot
//   gml_Object_obj_knight_enemy_Step_0.gml   : 65-92 the k_sideb sprite swaps
//   gml_GlobalScript_scr_gamestart_chapter_override.gml : the stat block
//
// ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
// sim/ hardcodes a three-person Kris/Susie/Ralsei party in at least five
// places: `PARTY` and `PARTY_POS` and `partyWiped`'s `.every` and
// `partyStatus`'s `[0,1,2].map` (sim/damage.js), `createHeroes`'s
// `[0,1,2].map` and `stepHeroes`'s `c < 3` (sim/heroes.js), `PARTY` again
// (sim/actors.js), `krisMult`'s literal `partyHp[1]` / `partyHp[2]` reads
// (sim/knight.js), the slot arrays in createState, and `ACTS` (sim/spells.js).
// Per HANDOFF §2 none of those may be patched, so kaizo/party/ copies what it
// needs and drives it off a roster instead.
//
// ── THE INDEXING SPLIT, WHICH IS THE WHOLE TRAP ───────────────────────────
// The mod indexes two different ways and never reconciles them:
//
//   CHARACTER-indexed (1..4, 0 = nobody)  global.hp[] global.maxhp[] at[]
//                                         mag[] df[] charweapon[] chararmor1/2[]
//                                         k_gloom[] k_freeze[] havechar[]-1
//   SLOT-indexed (0..2)                   global.char[] charaction[] chardead[]
//                                         charmove[] charcantarget[]
//                                         charspecial[] battledf[] charinstance[]
//                                         charpos[] target/myself
//
// `global.char[slot]` is the bridge, and deltas/INDEX.md item 9 records a
// place where the mod itself crosses the wires (scr_charbox reads k_gloom at
// slot+1 while the damage scripts read it at the char id — the two agree for
// [1,2,3] and DIVERGE the moment Noelle joins).
//
// This module keeps BOTH: the shared contract's slot-indexed
// `state.kaizo.gloom` / `state.kaizo.freeze` (what other agents code against)
// and char-indexed `gloomByChar` / `freezeByChar` mirrors that reproduce the
// mod's own array shape (`[0,0,0,0,0]`, index 0 unused). Every write goes
// through both so a call site can reproduce whichever indexing its GML used.

import { HERO_SPRITES } from '../../sim/heroes.js';
import { PARTY as SIM_PARTY, DEFAULT_GEAR } from '../../sim/damage.js';
import { statsOf } from '../../sim/equipment.js';
import {
  NOELLE_CHAR_ID, noelleSpec, kaizoActsForRoster, KRIS_FELL_SPRITE,
  KRIS_FROZEN_SPRITE,
} from './noelle.js';

export const CHAR_NONE = 0;
export const CHAR_KRIS = 1;
export const CHAR_SUSIE = 2;
export const CHAR_RALSEI = 3;
export const CHAR_NOELLE = NOELLE_CHAR_ID;

/**
 * THE SLOTS DO NOT MOVE, and this took reading two places to be sure of.
 *
 * `scr_encountersetup` opens with a generic re-stack for short parties:
 *
 *     if (char[0] != 0 && char[1] == 0 && char[2] == 0)  heromakey[0] = yy+140;
 *     if (char[0] != 0 && char[1] != 0 && char[2] == 0) {
 *         heromakey[0] = yy + 100;  heromakey[1] = yy + 180;
 *     }
 *
 * — a two-person party would stand at y 100 / 180, centred. But that runs
 * BEFORE the `switch (encounterno)`, and case 115 (the Knight) overwrites all
 * six values unconditionally:
 *
 *     heromakex[0] = xx+126;  heromakey[0] = yy+104;
 *     heromakex[1] = xx+80;   heromakey[1] = yy+142;
 *     heromakex[2] = xx+58;   heromakey[2] = yy+190;
 *
 * So in THIS fight the re-stack is dead and a two-person party stands in
 * slots 0 and 1 of the three-person formation: Kris where Kris always stands,
 * Noelle where SUSIE always stands, and the bottom-left spot empty. The mod
 * does not move anyone. (These are the same three points sim/actors.js and
 * sim/damage.js already carry — same source, so they agree by construction.)
 */
export const SLOT_POS = [
  { x: 126, y: 104 },
  { x: 80, y: 142 },
  { x: 58, y: 190 },
];

/**
 * `global.charinstance[i].depth = 200 - (i * 20)` — obj_battlecontroller's
 * Create, once per branch and identical in all four. DEPTH IS THE SLOT, not
 * the character: Noelle in slot 1 draws at 180, Susie's depth, because the
 * spawn loop never looks at who she is.
 */
export function slotDepth(slot) {
  return 200 - slot * 20;
}

/** `myheight` — the damage/heal writer anchors at `y + myheight - 24`. */
const WRITER_Y_OFFSET = -24;

/**
 * The three vanilla characters, lifted from the modules that already verified
 * them rather than retyped. Stats: sim/damage.js PARTY (which is
 * scr_gamestart's chapter-3 block). Sprites: sim/heroes.js HERO_SPRITES,
 * which is obj_heroparent's Create.
 *
 * HERO_SPRITES is SLOT-indexed there because the vanilla party is fixed and
 * slot i is always char i+1; here it is re-keyed by CHARACTER id, which is
 * what the Create actually branches on (`object_index == obj_herokris`).
 */
function vanillaSpec(charId, { sideb = false } = {}) {
  const p = SIM_PARTY[charId - 1];
  const spec = { ...HERO_SPRITES[charId - 1] };
  const gear = DEFAULT_GEAR[charId - 1];
  let swoon = spec.defeat;
  let frozen = spec.hurt;

  if (charId === CHAR_KRIS) {
    // obj_heroparent Step, MOD hunk 1: `if (object_index == obj_herokris &&
    // global.encounterno == 115 && global.chapter == 3) defeatsprite =
    // spr_kris_fell;`. Not gated on the B-Side — Kris falls this way in both
    // kaizo routes. obj_knight_enemy's Step sets it a second time inside
    // `if (k_sideb)`; the two agree, so the B-Side write is a no-op.
    swoon = KRIS_FELL_SPRITE;
    // ...and Kris is the ONE character the freeze statue special-cases.
    frozen = KRIS_FROZEN_SPRITE;
  }

  if (charId === CHAR_SUSIE && sideb) {
    // obj_knight_enemy Step_0:65-83, inside `if (k_sideb)` — the B-Side
    // repaints Susie serious/unhappy. Translated for completeness: the Weird
    // Route roster does not contain her, but a B-Side run that DOES field her
    // must not silently draw the cheerful set.
    spec.normal = 'spr_susier_dark_unhappy';
    spec.idle = 'spr_susieb_idle_serious';
    spec.defend = 'spr_susieb_defend_unhappy';
    spec.actready = 'spr_susieb_actready';
    spec.attack = 'spr_susieb_attack_serious';
    spec.item = 'spr_susieb_item_unhappy';
    spec.itemready = 'spr_susieb_itemready_unhappy';
    spec.spellready = 'spr_susieb_spellready_unhappy';
    spec.spell = 'spr_susieb_spell_unhappy';
    spec.defeat = 'spr_susie_dw_fell';
    // `if (global.charweapon[2] == 0) idlesprite = spr_susieb_idle_unarmed_
    // unhappy;` sits in the middle of that block — she carries weapon 24 in
    // this fight, so the branch is recorded and NOT taken.
    swoon = 'spr_susie_dw_fell';
    frozen = spec.hurt;
  }

  return {
    charId,
    name: p.name,
    maxhp: p.maxhp,
    at: p.at,
    magic: p.magic,
    df: p.df,
    gear: { ...gear, armor: [...(gear.armor ?? [])] },
    spells: null,
    // `mywidth`/`myheight` from the same Create block, per character:
    // Kris 68x74, Susie 70x82, Ralsei 52x86 (Noelle's 52x86 is in noelle.js).
    body: { ...BODY_BY_CHAR[charId] },
    spec,
    swoon,
    frozen,
  };
}

/** obj_heroparent Create — `mywidth`/`myheight`, per hero object. */
const BODY_BY_CHAR = {
  [CHAR_KRIS]: { mywidth: 68, myheight: 74 },
  [CHAR_SUSIE]: { mywidth: 70, myheight: 82 },
  [CHAR_RALSEI]: { mywidth: 52, myheight: 86 },
};

/**
 * Every character the mod's `global.char` can hold, by id. Built per call
 * because the B-Side flag changes three of the four.
 */
export function characterSpec(charId, opts = {}) {
  let c = null;
  if (charId === CHAR_NOELLE) c = noelleSpec(opts);
  else if (charId === CHAR_KRIS || charId === CHAR_SUSIE || charId === CHAR_RALSEI) {
    c = vanillaSpec(charId, opts);
  }
  if (!c) return null;
  // THE SWOON SPRITE IS THE DEFEAT SPRITE. The mod does not add a second
  // field — it OVERWRITES `defeatsprite` on the live instance:
  //
  //     with (obj_herokris)   { defeatsprite = spr_kris_fell; }
  //     with (obj_heronoelle) { defeatsprite = spr_noelleb_swooned; }
  //
  // (obj_knight_enemy Step_0:85-92, inside `if (k_sideb)`; obj_heroparent's
  // own Step does Kris's for encounterno 115 generally.) So the animator must
  // see it in `spec.defeat` — carrying it only in `sprites.swoon` would leave
  // the hero state machine drawing the pre-mod pose.
  c.spec.defeat = c.swoon;
  return c;
}

/**
 * `scr_fixparty(arg0)` — kaizo_settings_init, verbatim in shape.
 *
 *     for (i = 0; i < 3; i++) { if (char[i] == 1) _kris = 1; ...; }
 *     global.char = [0, 0, 0];
 *     if (_kris)   char[_ind++] = 1;
 *     if (_susie)  char[_ind++] = 2;
 *     if (_ralsei) char[_ind++] = 3;
 *     if (_noelle) char[_ind++] = 4;
 *
 * TWO PROPERTIES THAT MATTER DOWNSTREAM. First, the output is always sorted
 * BY CHARACTER ID — you cannot ask for Noelle in slot 0; a [4, 1] request
 * comes back [1, 4, 0]. Second, it is a SET: duplicates collapse, and the
 * scan only looks at slots 0..2, so a fourth entry is dropped on the floor.
 * Both are why "the Weird Route roster is [Kris, Noelle]" is a statement
 * about ids, not about order.
 *
 * The original's `arg0` tail (`scr_reset_caterpillars`) is overworld
 * follower plumbing with nothing to do in a battle; `scr_refreshchar` is
 * modelled by `havecharTable` below.
 *
 * @param {number[]} charIds  up to three ids, any order
 * @returns {number[]} length-3 `global.char`, zero-padded
 */
export function scrFixparty(charIds) {
  const seen = [false, false, false, false, false];
  for (let i = 0; i < 3; i++) {
    const c = charIds[i];
    if (c === CHAR_KRIS) seen[1] = true;
    if (c === CHAR_SUSIE) seen[2] = true;
    if (c === CHAR_RALSEI) seen[3] = true;
    if (c === CHAR_NOELLE) seen[4] = true;
  }
  const out = [0, 0, 0];
  let ind = 0;
  for (const id of [CHAR_KRIS, CHAR_SUSIE, CHAR_RALSEI, CHAR_NOELLE]) {
    if (seen[id]) {
      out[ind] = id;
      ind += 1;
    }
  }
  return out;
}

/**
 * `scr_refreshchar()` — obj_darkcontroller's `havechar[0..3]` and
 * `charpos[0..3]`, both indexed by CHARACTER-1 (so havechar[3] is Noelle),
 * plus `chartotal`. scr_picktarget_weighted reads exactly these.
 */
export function havecharTable(globalChar) {
  const havechar = [0, 0, 0, 0];
  const charpos = [0, 0, 0, 0];
  let chartotal = 0;
  for (let i = 0; i < 3; i++) {
    const c = globalChar[i];
    if (c !== 0) {
      chartotal += 1;
      if (c === CHAR_KRIS) { havechar[0] = 1; charpos[0] = i; }
      if (c === CHAR_SUSIE) { havechar[1] = 1; charpos[1] = i; }
      if (c === CHAR_RALSEI) { havechar[2] = 1; charpos[2] = i; }
      if (c === CHAR_NOELLE) { havechar[3] = 1; charpos[3] = i; }
    }
  }
  return { havechar, charpos, chartotal };
}

/**
 * `scr_havechar(n)` — is character id `n` in `global.char[0..2]`?
 *
 * The alias table in the dump ("susie"/"su"/"s" -> 2, "ralsei" -> 3,
 * "noelle" -> 4) is what pins 1 = KRIS, which is the fact the monstersetup
 * delta doc gets backwards. See kaizo/party/noelle.js's header.
 */
export function havechar(state, charId) {
  const gc = globalChar(state);
  return gc[0] === charId || gc[1] === charId || gc[2] === charId ? 1 : 0;
}

/**
 * THE WEIRD ROUTE PARTY. Kris and Noelle, and no one else.
 *
 * The mod does not hardcode this anywhere — obj_ch3_PTB02 stashes whatever
 * the save carries (`rem_char = [char[0], char[1], char[2]]`) and restores it
 * for the fight — so the roster is the ROUTE's, not the encounter's. What
 * the mod DOES hardcode is everything downstream of it: the B-Side flag
 * (global.flag[456]) turning on Noelle's dead `_sideb` sprite branch, her
 * whole battle sprite set prefetched by the encounter room, her N-Action slot
 * in monstersetup, and six live branches keyed on `global.charweapon[4]`.
 */
export const WEIRD_ROUTE_PARTY = [CHAR_KRIS, CHAR_NOELLE];
/** The A-Side / Normal Route three. `scr_fixparty` returns them unchanged. */
export const NORMAL_ROUTE_PARTY = [CHAR_KRIS, CHAR_SUSIE, CHAR_RALSEI];

/**
 * Build the shared-contract roster: one entry per OCCUPIED battle slot, in
 * slot order, after scr_fixparty's compaction.
 *
 * Contract (kaizo/HANDOFF §2 addendum, this run):
 *   { charId, name, maxhp, at, magic, df, pos:{x,y},
 *     sprites:{ idle, attack, hurt, swoon, frozen? }, depth }
 *
 * Plus, for consumers that need more than the contract minimum: `slot`,
 * `gear`, `spells`, `body`, `acts`, and `spec` (the complete obj_heroparent
 * sprite/frame block, which kaizo/party/heroes.js animates).
 */
export function buildRoster(charIds = WEIRD_ROUTE_PARTY, { sideb = false } = {}) {
  const gc = scrFixparty(charIds);
  const acts = kaizoActsForRoster(gc);
  const roster = [];
  for (let slot = 0; slot < 3; slot++) {
    const charId = gc[slot];
    if (charId === CHAR_NONE) continue;
    const c = characterSpec(charId, { sideb });
    roster.push({
      charId,
      slot,
      name: c.name,
      maxhp: c.maxhp,
      at: c.at,
      magic: c.magic,
      df: c.df,
      pos: { ...SLOT_POS[slot] },
      depth: slotDepth(slot),
      sprites: {
        idle: c.spec.idle,
        attack: c.spec.attack,
        hurt: c.spec.hurt,
        swoon: c.swoon,
        frozen: c.frozen,
      },
      spec: c.spec,
      gear: c.gear,
      spells: c.spells,
      body: c.body,
      acts: acts[roster.length] ?? [],
    });
  }
  return roster;
}

/** `global.char`, length 3, zero-padded — the bridge between the two indexings. */
export function globalChar(state) {
  if (state.kaizo?.globalChar) return state.kaizo.globalChar;
  // No roster installed: the vanilla three, which is what sim/ assumes.
  return [CHAR_KRIS, CHAR_SUSIE, CHAR_RALSEI];
}

/** How many battle slots are occupied. NEVER assume 3. */
export function rosterSize(state) {
  return state.kaizo?.roster?.length ?? 3;
}

/** SLOT -> character id. `global.char[slot]`, 0 when the slot is empty. */
export function charIdOf(state, slot) {
  return globalChar(state)[slot] ?? CHAR_NONE;
}

/** Character id -> SLOT, or -1. `charpos[charId - 1]` with a presence test. */
export function slotOf(state, charId) {
  const gc = globalChar(state);
  for (let i = 0; i < 3; i++) if (gc[i] === charId) return i;
  return -1;
}

/** The roster entry for a slot. */
export function memberAt(state, slot) {
  return state.kaizo?.roster?.[slot] ?? null;
}

/** The roster entry for a character id. */
export function memberOf(state, charId) {
  const s = slotOf(state, charId);
  return s < 0 ? null : memberAt(state, s);
}

/**
 * `global.hp[charId]` from the slot-indexed `state.partyHp`.
 *
 * INDEX 0 IS A REAL CELL, not an error. `global.hp[0]` exists in GML (an
 * unset array slot reads 0) and the mod DOES reach it: scr_damage's
 * `target == 3` branch loops `hpi < 3` with no `char[hpi] != 0` guard, so a
 * two-person party runs one iteration against character id 0. Modelled as
 * `state.kaizo.hpPhantom` so the write lands somewhere observable instead of
 * corrupting a real slot. See kaizo/party/damage.js.
 */
export function hpOfChar(state, charId) {
  if (charId === CHAR_NONE) return state.kaizo?.hpPhantom ?? 0;
  const slot = slotOf(state, charId);
  return slot < 0 ? 0 : state.partyHp[slot];
}

export function setHpOfChar(state, charId, value) {
  if (charId === CHAR_NONE) {
    if (state.kaizo) state.kaizo.hpPhantom = value;
    return;
  }
  const slot = slotOf(state, charId);
  if (slot >= 0) state.partyHp[slot] = value;
}

/** `global.maxhp[charId]`. Index 0 reads 0 — GML's unset-array-slot value. */
export function maxhpOfChar(state, charId) {
  const m = memberOf(state, charId);
  return m ? m.maxhp : 0;
}

/**
 * `global.chararmor1[c] / chararmor2[c] / charweapon[c]` — CHARACTER-indexed
 * equipment. Absent characters and id 0 read as unequipped, which is what an
 * unset GML array slot does.
 */
export function gearOfChar(state, charId) {
  const override = state.kaizo?.gear?.[charId];
  if (override) return override;
  const m = memberOf(state, charId);
  return m?.gear ?? { weapon: 0, armor: [] };
}

/** Same, by SLOT. */
export function gearOfSlot(state, slot) {
  return gearOfChar(state, charIdOf(state, slot));
}

/**
 * `global.battleat/battledf/battlemag[slot]` — base stats plus everything
 * equipped, through the verified sim/equipment.js summer.
 *
 * The stat BASE is character-indexed and the RESULT is slot-indexed, which is
 * exactly the split scr_damage_calculation walks:
 * `global.battledf[slot]` against `global.maxhp[global.char[slot]]`.
 */
export function statFor(state, slot) {
  const m = memberAt(state, slot);
  if (!m) return { at: 0, df: 0, magic: 0, mantle: false, healRibbons: 0, rudeBusterCost: 125, equipped: [] };
  return statsOf(
    { name: m.name, maxhp: m.maxhp, at: m.at, magic: m.magic, df: m.df },
    gearOfSlot(state, slot),
  );
}

/**
 * `!global.chardead[slot]` — the menu/target gate, which is NOT the HP sign.
 * A heal that lifts a -999 ally to -899 leaves them dead here and standing to
 * an HP test; sim/damage.js's own note records the session that cost. Same
 * rule, roster-bounded.
 */
export function isUp(state, slot) {
  if (slot < 0 || slot >= rosterSize(state)) return false;
  if (state.chardead) return !state.chardead[slot];
  return state.partyHp[slot] > 0;
}

/**
 * The literal GML anchor for a writer over a party member —
 * `instance_create(charinstance[t].x, charinstance[t].y + myheight - 24,
 * obj_dmgwriter)`, unchanged by the mod.
 *
 * NOT what the damage path uses. sim/damage.js spawns its number at the raw
 * slot position (its PARTY_POS, which is the heromake point) and that is the
 * behaviour 60 verified suites are pinned to; kaizo/party/damage.js matches
 * it exactly rather than "correcting" a verified module in a copy. This
 * helper exposes the formula for anything that genuinely needs the offset.
 */
export function writerAnchor(state, slot) {
  const m = memberAt(state, slot);
  if (!m) return { x: 0, y: 0 };
  return { x: m.pos.x, y: m.pos.y + m.body.myheight + WRITER_Y_OFFSET };
}

/**
 * Full-health party HP, SLOT-indexed and roster-length. sim/damage.js's
 * `freshParty()` is a three-element literal and cannot be reused.
 */
export function freshParty(roster) {
  return roster.map((m) => m.maxhp);
}

/**
 * INSTALL. Stamps `state.kaizo.roster` and resizes every slot-indexed array
 * the fight touches, so nothing downstream can be caught assuming three.
 *
 * The B-Side arrays are stamped in BOTH indexings (see the header): the
 * contract's slot-indexed `freeze` / `gloom` and the mod's own
 * character-indexed `[0,0,0,0,0]` mirrors, which is literally what
 * `obj_knight_enemy`'s Create writes:
 *
 *     k_gloom  = [0, 0, 0, 0, 0];
 *     k_freeze = [0, 0, 0, 0, 0];
 */
export function installRoster(state, {
  charIds = WEIRD_ROUTE_PARTY,
  sideb = false,
  gear = null,
} = {}) {
  const globalCharArr = scrFixparty(charIds);
  const roster = buildRoster(charIds, { sideb });
  const n = roster.length;

  state.kaizo = state.kaizo ?? {};
  state.kaizo.sideb = sideb;
  state.kaizo.globalChar = globalCharArr;
  state.kaizo.roster = roster;
  state.kaizo.acts = roster.map((m) => m.acts);
  const table = havecharTable(globalCharArr);
  state.kaizo.havechar = table.havechar;
  state.kaizo.charpos = table.charpos;
  state.kaizo.chartotal = table.chartotal;
  if (gear) state.kaizo.gear = gear;

  // `global.hp[0]` — the cell the target==3 loop reaches on a short party.
  state.kaizo.hpPhantom = 0;

  state.partyHp = freshParty(roster);
  state.charaction = new Array(n).fill(0);
  state.chardead = new Array(n).fill(0);
  state.charmove = new Array(n).fill(1);
  state.charcantarget = new Array(n).fill(1);
  state.charspecial = new Array(n).fill(0);

  // THE B-SIDE ARRAYS, both ways round.
  state.kaizo.freeze = new Array(n).fill(false);
  state.kaizo.gloom = new Array(n).fill(0);
  state.kaizo.freezeByChar = [0, 0, 0, 0, 0];
  state.kaizo.gloomByChar = [0, 0, 0, 0, 0];

  if (state.knight) {
    // scr_kaizo_target reads both of these off obj_knight_enemy.
    state.knight.damagecounter = state.knight.damagecounter ?? 0;
    state.knight.aoedamage = false;
  }
  return state;
}

/**
 * The two mirrors, written together. `slot` is the contract's index and
 * `charId` the mod's; call this rather than assigning either array, so a
 * consumer reading one never sees a value the other has not got.
 *
 * ORIGINAL BEHAVIOUR, PRESERVED: the mod does NOT do this. It writes
 * `k_gloom[chartarget]` (char id) in the damage scripts and reads
 * `k_gloom[slot + 1]` in scr_charbox — deltas/INDEX.md item 9. Those agree
 * for [1,2,3] and disagree for [1,4]: with Noelle in slot 1, the damage path
 * writes index 4 and the HP bar reads index 2. A call site reproducing
 * scr_charbox must therefore read `gloomByChar[slot + 1]` DELIBERATELY, not
 * `gloom[slot]` — the divergence is the mod's, and hiding it would be a fix.
 */
export function setGloom(state, slot, value) {
  const k = state.kaizo;
  if (!k) return;
  if (k.gloom) k.gloom[slot] = value;
  const charId = charIdOf(state, slot);
  if (k.gloomByChar) k.gloomByChar[charId] = value;
}

export function setFreeze(state, slot, value) {
  const k = state.kaizo;
  if (!k) return;
  if (k.freeze) k.freeze[slot] = !!value;
  const charId = charIdOf(state, slot);
  if (k.freezeByChar) k.freezeByChar[charId] = value ? 1 : 0;
}

/** `obj_knight_enemy.k_freeze[global.char[myself]] == 1` — the Draw's gate. */
export function isFrozen(state, slot) {
  return !!state.kaizo?.freeze?.[slot];
}

export { kaizoActsForRoster };
