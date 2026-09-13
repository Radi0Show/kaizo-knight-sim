// KAIZO V-C/V-D — NOELLE. The B-Side's fourth character, who has never
// existed in this simulator before.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE (kaizo dump, knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries):
//   gml_GlobalScript_scr_gamestart_chapter_override.gml : 55-59  her stats
//   gml_GlobalScript_scr_gamestart.gml                  : 163-165, 202-204
//                                                         gear + spell list
//   gml_Object_obj_heroparent_Create_0.gml              : 169-215  sprite set,
//                                                         incl. the `_sideb`
//                                                         branch the mod turns on
//   gml_Object_obj_ch3_PTB02_Other_17.gml               : 1-23  the prefetch list
//                                                         (23 sprites; 5 _sideb)
//   gml_Object_obj_knight_enemy_Step_0.gml              : 65-92  B-Side defeat
//                                                         sprite swaps
//   gml_Object_obj_heroparent_Draw_0.gml                : 12-46  frozen statue
//   gml_GlobalScript_scr_monstersetup.gml               : 1843-1881 the act menu
//   gml_GlobalScript_scr_havechar.gml                   : the 1..4 alias map
//   gml_GlobalScript_scr_weaponinfo.gml / scr_armorinfo.gml : 12/13, 14/22
//   gml_GlobalScript_scr_spellinfo.gml                  : 2/8/9/10
//
// WHAT THIS FILE IS: pure data plus two small builders. It owns no state and
// touches nothing in sim/. kaizo/party/roster.js turns this into a battle-slot
// roster entry; kaizo/party/heroes.js animates it.
//
// ── ONE CORRECTION TO THE DELTA DOCS ──────────────────────────────────────
// deltas/gml_GlobalScript_scr_monstersetup.md summarises the fallback act
// block as "HoldBreath for all three companions when SUSIE is absent". The
// GML says `if (!scr_havechar(1))` and scr_havechar's own alias table maps
// "susie"->2, "ralsei"->3, "noelle"->4, so 1 is KRIS. The fallback fires when
// KRIS is absent, which the Weird Route (Kris + Noelle) never is — so on the
// B-Side Noelle keeps N-Action. Coded from the GML, not the summary.

/** `global.char` id. 1 Kris, 2 Susie, 3 Ralsei, 4 Noelle. */
export const NOELLE_CHAR_ID = 4;

/**
 * `scr_gamestart_chapter_override`'s chapter-3 block, lines 55-59:
 *
 *     global.maxhp[4] = 120;  global.hp[4] = global.maxhp[4];
 *     global.at[4] = 5;  global.mag[4] = 13;  global.df[4] = 1;
 *
 * DF 1 is the one that is easy to miss and the one that hurts: Kris, Susie
 * and Ralsei all carry the base 2 that `scr_gamestart` hands every character,
 * and the override writes Noelle's down to 1. She is the frailest member of
 * any party this fight can field — 120 max HP against Kris's 160 — and she
 * loses a defence step on top of it. Her x0.5 damage taken (scr_damage) is
 * what pays for that, and it is applied AFTER the defence walk, so the two
 * do not simply cancel.
 */
export const NOELLE_STATS = { maxhp: 120, at: 5, magic: 13, df: 1 };

/** Body box from the Create — `mywidth = 52; myheight = 86;` (same as Ralsei). */
export const NOELLE_BODY = { mywidth: 52, myheight: 86 };

/**
 * EQUIPMENT — and this is the one place the dump does not simply answer.
 *
 * `scr_gamestart`'s CHAPTER 2 block equips her:
 *
 *     global.charweapon[4] = 12;   // SnowRing   at 0  df 0  mag 0
 *     global.chararmor1[4] = 14;   // SilverWatch      df 2
 *     global.chararmor2[4] = 22;   // RoyalPin         df 3  mag 1
 *
 * The mod's CHAPTER 3 override sets her stats and nothing else, and nothing
 * in obj_ch3_PTB02 or obj_knight_enemy force-equips anyone (grepped) — the
 * fight uses whatever the save carries. So the honest reading is: armour is
 * the dump's 14 + 22, and the WEAPON is the route.
 *
 * THE THORNRING IS THE WEIRD ROUTE. Weapon 13 is what the B-Side code keeps
 * asking about — `global.charweapon[4] == 13` gates the gloom immunity
 * (scr_damage:249), the halved ice-spell costs (scr_spellinfo:110,123), a
 * battlecontroller tick (Step_0:1553), the icespell draw (Draw_0:16,82) and a
 * knight Step branch (Step_0:796). A Weird Route Noelle without it would make
 * six live branches dead. So WEIRD_ROUTE is the ThornRing build and the
 * SnowRing build is kept beside it, both labelled, neither invented: the
 * numbers are the dump's, only the choice between them is ours.
 */
export const NOELLE_GEAR_SNOWRING = { weapon: 12, armor: [14, 22] };
export const NOELLE_GEAR_THORNRING = { weapon: 13, armor: [14, 22] };
/** The Weird Route default. `charweapon[4] == 13`. */
export const NOELLE_GEAR_WEIRD_ROUTE = NOELLE_GEAR_THORNRING;

/** `global.charweapon[4] == 13` — the ThornRing, tested by six B-Side sites. */
export const THORN_RING = 13;

/**
 * WHAT A FRESH B-SIDE FILE ACTUALLY CARRIES (gap 10, read 2026-09-08). The
 * report called 120/5/13/1 + ThornRing + [2, 8, 9] "inferred"; here is what
 * each piece is, with the site that decides it.
 *
 * THE SETTINGS SIGN CHOOSES THE ROSTER AND NOTHING ELSE. obj_npc_sign
 * Draw_0:31-41 asks "(How many party members?)" with the choices `1 / 3 / 2`
 * (that order, verbatim), :89-90 maps the choice to `partyleft = [0, 2, 1]
 * [choice]`, :100-103 offers Kris / Susie / Ralsei / Noelle, :124-125 fills
 * `partychar[partyleft] = choice + 1; partyleft--` — the LAST slot first —
 * and :152-155 commits `global.char = partychar; scr_fixparty(0)`, which
 * re-packs by id (kaizo_settings_init:327-379, roster.js scrFixparty). No
 * line of it touches hp/at/mag/df, charweapon, chararmor or spell[]. Its
 * own text says where those come from: "(Equips can be adjusted and so
 * on.)" (:137) — the overworld menu, on whatever the file holds.
 *
 * SO THE FILE DECIDES, AND THE FILE IS THE CHAPTER-2 TRANSFER:
 *   - stats: `scr_load_chapter2.gml:314` runs scr_gamestart_chapter_override
 *     at the END of the transfer, so a file made under the mod carries
 *     120/5/13/1 (override :55-59) from its first save; obj_ch3_PTB02
 *     Step_0:2-6 then floors ONLY maxhp at 120 every frame. A file
 *     transferred under vanilla and later opened in the mod keeps the Ch2
 *     values (`scr_load.gml:120-132` reads at/df/mag back; the bundled
 *     "save file if you need one" is exactly that: 90 / 3 / 1 / 11).
 *   - weapon and armour: `scr_load_chapter2.gml:91-110, 136-140` copy
 *     `charweapon[i]` / `chararmor1[i]` / `chararmor2[i]` for EVERY i,
 *     Noelle included. A Chapter-2 file with flag[456] set is a Snowgrave
 *     file, and that route puts the ThornRing on her (the game's own
 *     scr_spellinfo:110/123 half-cost is written for it). So a fresh
 *     weird-route transfer carries 13 / 14 / 22 — the receipt for
 *     NOELLE_GEAR_WEIRD_ROUTE above, now a transfer fact rather than a
 *     reading of which branches would go dead.
 *   - spells: `scr_load_chapter2.gml:170` copies `spell[i][j]`, twelve per
 *     character. gamestart hands out [2, 8, 9]; the Chapter-2 route teaches
 *     SnowGrave (10) and the transfer would carry it. This dump cannot show
 *     the grant, so NOELLE_SPELLS stays [2, 8, 9] and a measured list is
 *     installed with `state.kaizo.spells = { 4: [2, 8, 9, 10] }`
 *     (kaizo/party/spells.js kaizoSpellList reads it ahead of the roster).
 *
 * WHAT THE USER'S OWN FILE COULD DIFFER IN, decodable offline
 * (`%LOCALAPPDATA%\DELTARUNE\filech3_N`, 62 lines per character from line
 * 17; Noelle's block 265-274, her spells 315-326, flag 456 at line 1009):
 * at/mag/df if it was transferred under vanilla (3/11/1 at LV1, more if she
 * levelled); the weapon if it was re-equipped in the Ch3 menu (12 or 13 are
 * the only two she can wear); whether spell 10 is present; and Kris's own
 * gear (lines 79-88), which is gap 11's.
 */
export const NOELLE_FRESH_FILE = {
  stats: NOELLE_STATS,
  gear: NOELLE_GEAR_THORNRING,
  spells: [2, 8, 9],
  /** SnowGrave, if the Chapter-2 file carried it — not decidable from this dump. */
  maybeSpells: [10],
};

/**
 * obj_npc_sign Draw_0:31-41, :89-90, :124-125, :152-155 — the picker,
 * translated. `sizeChoice` is the "(How many party members?)" index over
 * the choices `1 / 3 / 2` (0 -> one member, 1 -> three, 2 -> two); `picks`
 * are the "(Select who you want.)" indices 0..3 (Kris, Susie, Ralsei,
 * Noelle) in the order chosen. Returns `global.char` as scr_fixparty leaves
 * it. The sign fills the highest slot first, and the compaction re-sorts by
 * id, so the order picked never matters — which is why the sim's
 * WEIRD_ROUTE_PARTY can be written [Kris, Noelle] without a slot table.
 */
export function scrSignParty(sizeChoice, picks) {
  const _pl = [0, 2, 1];
  let partyleft = _pl[sizeChoice] ?? 0;
  const partychar = [0, 0, 0];
  for (const choice of picks) {
    if (partyleft < 0) break;
    partychar[partyleft] = choice + 1;
    partyleft -= 1;
  }
  // scr_fixparty(0), inlined: present ids in order 1 < 2 < 3 < 4 from slot 0.
  const seen = [false, false, false, false, false];
  for (let i = 0; i < 3; i++) if (partychar[i] >= 1 && partychar[i] <= 4) seen[partychar[i]] = true;
  const out = [0, 0, 0];
  let ind = 0;
  for (let id = 1; id <= 4; id++) if (seen[id]) { out[ind] = id; ind += 1; }
  return out;
}

/**
 * `sprite_prefetch(...)` — obj_ch3_PTB02's Other_17 (Room Start), verbatim and
 * in order. The mod prefetches Noelle's WHOLE battle set for a fight vanilla
 * never lets her enter; that list is itself the evidence the B-Side party is
 * Kris + Noelle.
 *
 * Five carry the `_sideb` suffix (see NOELLE_SIDEB_SPRITES) and one —
 * `spr_noelleb_swooned` — exists only in the mod.
 */
export const NOELLE_SPRITE_PREFETCH = [
  'spr_noelleb_pray',
  'spr_noelleb_orb',
  'spr_noelleb_spellready',
  'spr_noelleb_spell',
  'spr_noelleb_spell_special',
  'spr_noelleb_attack',
  'spr_noelleb_attackready',
  'spr_noelleb_victory',
  'spr_noelleb_battleintro',
  'spr_noelleb_act',
  'spr_noelleb_actready',
  'spr_noelleb_defeat',
  'spr_noelleb_defend',
  'spr_noelleb_hurt',
  'spr_noelleb_idle',
  'spr_noelleb_item',
  'spr_noelleb_itemready',
  'spr_noelleb_battleintro_sideb',
  'spr_noelleb_defend_sideb',
  'spr_noelleb_float_sideb',
  'spr_noelleb_idle_sideb',
  'spr_noelleb_hurt_sideb',
  'spr_noelleb_swooned',
];

/** The five `_sideb` variants in that list. */
export const NOELLE_SIDEB_SPRITES = [
  'spr_noelleb_battleintro_sideb',
  'spr_noelleb_defend_sideb',
  'spr_noelleb_float_sideb',
  'spr_noelleb_idle_sideb',
  'spr_noelleb_hurt_sideb',
];

/**
 * PREFETCHED BUT NOT ASSIGNED by obj_heroparent's Create. Recorded so nobody
 * later "fixes" their absence from the sprite spec: the Create never points a
 * hero field at them, so a faithful hero animator must not use them.
 *
 *   spr_noelleb_battleintro / _battleintro_sideb  the encounter intro pose
 *   spr_noelleb_float_sideb                       B-Side idle float, used by
 *                                                 the mod's own scenes
 *   spr_noelleb_orb / spr_noelleb_spell_special   IceShock / SnowGrave VFX
 */
export const NOELLE_PREFETCH_UNASSIGNED = [
  'spr_noelleb_battleintro',
  'spr_noelleb_battleintro_sideb',
  'spr_noelleb_float_sideb',
  'spr_noelleb_orb',
  'spr_noelleb_spell_special',
];

/**
 * `obj_heroparent`'s Create, `if (object_index == obj_heronoelle)` block —
 * every field, in the original's order, in the shape sim/heroes.js's HERO_
 * SPRITES uses so the same state machine can drive her.
 *
 * THE `_sideb` BRANCH IS DEAD IN VANILLA. v105 hardcodes `_sideb = 0` two
 * lines above it; the mod writes `_sideb = global.flag[456] > 0` and Toby's
 * own unreachable branch comes alive. The only line inside it the mod itself
 * changed is `attackreadysprite` — vanilla's dead branch had
 * `spr_noelleb_idle` there, kaizo has `spr_noelleb_spellready`.
 *
 * SHE HAS NO FIGHT ANIMATION ON THE B-SIDE. `attacksprite = spr_noelleb_spell`
 * and `attackreadysprite = spr_noelleb_spellready`: her physical attack pose
 * IS her casting pose, the same trick obj_heroparent plays on Kris (whose
 * spell sprites are his ACT sprites). Snowgrave Noelle does not swing.
 *
 * `defendframes = 0` in the base block is REAL and is hers — sim/heroes.js
 * carries a note about that zero being mis-copied onto Ralsei once. The
 * `_sideb` branch raises it to 5, so a B-Side Noelle does animate her guard.
 *
 * `victoryframes = sprite_get_number(victorysprite)` in the base block — a
 * runtime read with no constant in the dump, so it stays null and the
 * animator falls back to the sprite's own frame count. The `_sideb` branch
 * pins it to 10.
 */
export function noelleSprites(sideb = false) {
  const spec = {
    name: 'NOELLE',
    // attackspeed = 0.5 — the same half-frame cadence every hero uses.
    attackframes: 4,
    itemframes: 9,
    defendframes: 0,
    actframes: 7,
    actreturnframes: 10,
    spellframes: 6,
    victoryframes: null,
    normal: 'spr_noelle_walk_right_dw',
    idle: 'spr_noelleb_idle',
    defend: 'spr_noelleb_defend',
    hurt: 'spr_noelleb_hurt',
    attackready: 'spr_noelleb_attackready',
    attack: 'spr_noelleb_attack',
    item: 'spr_noelleb_item',
    itemready: 'spr_noelleb_itemready',
    spellready: 'spr_noelleb_spellready',
    spell: 'spr_noelleb_spell',
    defeat: 'spr_noelleb_defeat',
    victory: 'spr_noelleb_victory',
    actready: 'spr_noelleb_actready',
    act: 'spr_noelleb_act',
  };
  // The Create's `if (global.encounterno == 73) idlesprite = spr_noelle_
  // shocked_dw;` and `if (global.encounterno == 82)` re-assignment are other
  // encounters (the knight is 115), so neither applies here. Recorded, not
  // translated — a faithful port of an unreachable branch is still dead code.
  if (sideb) {
    spec.attackready = 'spr_noelleb_spellready';
    spec.attack = 'spr_noelleb_spell';
    spec.attackframes = 6;
    spec.victory = 'spr_noelleb_pray';
    spec.victoryframes = 10;
    spec.defendframes = 5;
    spec.defend = 'spr_noelleb_defend_sideb';
    spec.hurt = 'spr_noelleb_hurt_sideb';
    spec.idle = 'spr_noelleb_idle_sideb';
  }
  return spec;
}

/**
 * `spr_noelleb_swooned` — MOD-ONLY, and its assignment site is not the hero's
 * own Create but obj_knight_enemy's Step:
 *
 *     :65   if (k_sideb)
 *     :66       with (obj_herosusie) {            <- seventeen lines, Susie's
 *     ...           normalsprite = ...               B-Side repaint
 *     :83           defeatsprite = spr_susie_dw_fell;
 *     :84       }                                  <- THE BLOCK CLOSES HERE
 *     :85   with (obj_herokris)   { defeatsprite = spr_kris_fell; }
 *     :89   with (obj_heronoelle) { defeatsprite = spr_noelleb_swooned; }
 *
 * **NOT `sideb`-GATED.** The `if (k_sideb)` opens at :65 and closes at :84,
 * and only Susie's `with` is inside it; Kris's and Noelle's are one line
 * below, on both routes. This function used to read `sideb ? swooned :
 * defeat` on a misreading of that nesting, which drew the vanilla
 * `spr_noelleb_defeat` on a downed A-Side Noelle — and the mod's own party
 * sign lets a player field Noelle on an A-Side save, so that was reachable.
 * Ledger G-4, corrected against the dump 2026-09-12; the ledger's §7.2 item
 * 12 is the same correction from the audit side.
 *
 * Kris's `spr_kris_fell` is set twice over — here, and by obj_heroparent's
 * own Step for encounter 115 generally. `roster.js` has always had his
 * un-gated for that reason, and the two now agree.
 *
 * The parameter is kept so every caller's `{ sideb }` keeps flowing through
 * one shape, and so a reader who remembers the old gate sees it ignored on
 * purpose rather than silently dropped.
 */
// eslint-disable-next-line no-unused-vars
export function noelleSwoonSprite(sideb = false) {
  return 'spr_noelleb_swooned';
}

/**
 * THE FROZEN STATUE (k_freeze). obj_heroparent's Draw spawns obj_frozennpc
 * with `sprite_index = other.hurtsprite`, and ONLY Kris is special-cased:
 *
 *     with (herofrozen) {
 *         sprite_index = other.hurtsprite;
 *         if (_mychar == 1) sprite_index = spr_krisb_frozen;
 *     }
 *
 * So Noelle freezes as her own HURT pose — `spr_noelleb_hurt_sideb` on the
 * B-Side, which is the only side that has freezing. There is no
 * `spr_noelleb_frozen`; do not invent one.
 */
export function noelleFrozenSprite(sideb = false) {
  return noelleSprites(sideb).hurt;
}

/** Kris's mod-only freeze statue. `spr_krisb_frozen`, from the same Draw. */
export const KRIS_FROZEN_SPRITE = 'spr_krisb_frozen';
/** Kris's knight-fight defeat sprite — obj_heroparent Step, encounterno 115. */
export const KRIS_FELL_SPRITE = 'spr_kris_fell';

/**
 * `global.spell[4][0..2]` from scr_gamestart — 2 Heal Prayer, 8 SleepMist,
 * 9 IceShock. IDENTICAL IN VANILLA v105 (diffed): the mod does not change
 * her spell list at gamestart.
 *
 * SNOWGRAVE (spell 10) IS NOT GRANTED HERE. `scr_spellinfo` defines it —
 * `cost = global.maxtension * 2`, halved by the ThornRing, `spelltarget = 0`
 * (all enemies) — and the mod ships obj_spell_snowgrave, so the B-Side does
 * reach it; the grant site is a route flag outside this dump's gamestart.
 * Recorded as data, not wired: a spell list that hands out SnowGrave because
 * it "must be there" would be invention.
 */
export const NOELLE_SPELLS = [2, 8, 9];
export const NOELLE_SPELL_SNOWGRAVE = 10;

/**
 * ICE COSTS HALVE WITH THE THORNRING. scr_spellinfo cases 9 and 10:
 *
 *     cost = 40;  if (global.charweapon[4] == 13) cost *= 0.5;   // IceShock
 *     cost = global.maxtension * 2;
 *                 if (global.charweapon[4] == 13) cost *= 0.5;   // SnowGrave
 *
 * Note the multiply, not a table swap — SnowGrave's cost tracks maxtension.
 */
export function noelleSpellCost(spellId, weapon, maxtension = 100) {
  let cost;
  if (spellId === 9) cost = 40;
  else if (spellId === NOELLE_SPELL_SNOWGRAVE) cost = maxtension * 2;
  else return null;
  if (weapon === THORN_RING) cost *= 0.5;
  return cost;
}

/**
 * THE ACT MENU — `scr_monstersetup`, monstertype 104 (the Knight).
 *
 * Vanilla v105's 104 block has `canact[0] Check`, `canact[1] HoldBreath`,
 * `canactsus[0] S-Action`, `canactral[0] R-Action` and stops. The mod adds:
 *
 *     global.canactnoe[myself][0] = 1;
 *     global.actnamenoe[myself][0] = "N-Action";
 *     global.actsimulnoe[myself][0] = 0;
 *     if (!scr_havechar(1))
 *     {
 *         ... S-Action, R-Action and N-Action all become "HoldBreath" ...
 *     }
 *
 * TWO SEPARATE FACTS, and the second is the one the delta doc gets wrong
 * (see the header): the fallback is gated on KRIS being absent, not Susie.
 * Kris carries the party's only Check/HoldBreath pair, so a Kris-less party
 * would have no HoldBreath at all — the block hands one to whoever is left.
 * The Weird Route always has Kris, so the Weird Route always shows N-Action.
 *
 * `actsimul* = 0` on every companion entry: none of these act simultaneously.
 */
export const ACT_N_ACTION = { name: 'N-Action', descb: '', simul: 0 };
export const ACT_HOLD_BREATH = { name: 'HoldBreath', descb: '', simul: 0 };

/**
 * CHAR-INDEXED act table for monstertype 104 (index 0 unused, as global.char
 * ids are 1..4). Kris's pair is `canact[0..1]`, the shared list; the other
 * three each get one `canact<x>[0]` entry.
 */
export const KAIZO_ACTS_BY_CHAR = {
  1: [
    { name: 'Check', descb: 'Useless#analysis' },
    { name: 'HoldBreath', descb: '' },
  ],
  2: [{ name: 'S-Action', descb: '', simul: 0 }],
  3: [{ name: 'R-Action', descb: '', simul: 0 }],
  4: [ACT_N_ACTION],
};

/**
 * The act list for one roster, SLOT-indexed — what a menu wants.
 *
 * @param {number[]} charIds  compacted `global.char`, e.g. [1, 4] or [1, 4, 0]
 * @returns {Array<Array<{name:string, descb:string}>>} one entry per SLOT
 */
export function kaizoActsForRoster(charIds) {
  const live = charIds.filter((c) => c !== 0);
  // `!scr_havechar(1)` — Kris absent. Verbatim gate, verbatim consequence:
  // all THREE companion slot-0 acts are replaced, not just the one in play.
  const krisAbsent = !live.includes(1);
  return live.map((charId) => {
    const acts = KAIZO_ACTS_BY_CHAR[charId] ?? [];
    if (krisAbsent && charId !== 1) return [{ ...ACT_HOLD_BREATH }];
    return acts.map((a) => ({ ...a }));
  });
}

/**
 * Noelle as a character spec, in the shape kaizo/party/roster.js consumes.
 * Position and depth are NOT here: obj_battlecontroller assigns both from the
 * SLOT (`global.heromakex[i]`, `depth = 200 - i * 20`), never from who the
 * character is — see roster.js's SLOT_POS note.
 */
export function noelleSpec({ sideb = false } = {}) {
  const sprites = noelleSprites(sideb);
  return {
    charId: NOELLE_CHAR_ID,
    name: 'NOELLE',
    maxhp: NOELLE_STATS.maxhp,
    at: NOELLE_STATS.at,
    magic: NOELLE_STATS.magic,
    df: NOELLE_STATS.df,
    gear: { ...NOELLE_GEAR_WEIRD_ROUTE, armor: [...NOELLE_GEAR_WEIRD_ROUTE.armor] },
    spells: [...NOELLE_SPELLS],
    body: { ...NOELLE_BODY },
    spec: sprites,
    swoon: noelleSwoonSprite(sideb),
    frozen: noelleFrozenSprite(sideb),
  };
}
