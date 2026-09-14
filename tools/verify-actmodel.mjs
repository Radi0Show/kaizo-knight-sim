#!/usr/bin/env node
// THE ACT TABLE'S SHAPE — five parallel arrays, two indices, four characters.
//
// NO ORACLE. There cannot be one: the ACT menu is a Draw event and the
// whole-fight recorder traces sim state, not text. Everything here is read out
// of the dump and written into the assertions, and the citations are in
// sim/spells.js beside each table.
//
// WHAT THIS EXISTS TO STOP, because it has now happened three times:
//
//   1. "The ACT list is one list per character" — it is not. Every read is
//      `global.canact*[thisenemy][__acti]`: PER ENEMY and PER CHARACTER, and
//      the character is chosen by `global.char[global.charturn]`, never by the
//      slot. obj_battlecontroller Draw_0:1059-1096.
//   2. "Noelle has no act row anywhere" — from grepping `canactnoel`, which
//      has no trailing L in the game and returns zero files. The array is
//      `canactnoe`, it exists for every enemy, and `scr_spellmenu_setup` has a
//      `global.char[__i] == 4` branch for it. What is TRUE, and section C
//      pins it, is narrower: the v1.05 `monstertype == 104` block never writes
//      it, so the VANILLA Knight gives Noelle nothing.
//   3. "S-Action and R-Action are placeholder names we invented" — they are
//      the game's own strings, byte-identical in both dump trees, and the game
//      itself is the only thing that ever swaps them out (for "Standard", in a
//      picker this fight does not reach — ACT_GENERIC_NAMES).
//
// SABOTAGE-TESTED: giving char 4 a row in ACT_TABLES fails C; making `actsFor`
// index by slot instead of by character id fails B; dropping the `actor` gates
// from `actUsable` fails D; keying the one-use filter back to `c === 1` fails
// F; materialising `actor: 1` onto vanilla rows fails A.
//
//     node tools/verify-actmodel.mjs

import { createState, stepFrame } from '../sim/index.js';
import { buildPracticeScene } from '../sim/scenes/practice.js';
import { listRows, charIdForSlot, HPCOLOR, HP_COLOR_SOFT } from '../sim/menu.js';
import {
  ACTS, ACT_TABLES, ACT_ROW_DEFAULT, ACT_GENERIC_NAMES, ACT_SPECIAL_BY_CHAR,
  KNIGHT_MONSTERTYPE, actsFor, actUsable, enemyMonsterType,
} from '../sim/spells.js';

let failed = 0;
let count = 0;
function ok(cond, what) {
  count += 1;
  if (!cond) failed += 1;
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
}
const eq = (got, want, what) =>
  ok(Object.is(got, want), `${what} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const deep = (got, want, what) => eq(JSON.stringify(got), JSON.stringify(want), what);
const section = (t) => console.log(`\n== ${t}`);

const IDLE = {
  left: false, right: false, up: false, down: false,
  confirm: false, cancel: false, focus: false, button3: false,
};

/** The practice scene, driven to the frame the command menu is open. */
function openMenu() {
  const s = createState({ seed: 12345, traceBulletSlots: 8 });
  buildPracticeScene(s, { seed: 12345 });
  for (let i = 0; i < 16 && !s.menu?.open; i++) stepFrame(s, IDLE);
  if (!s.menu?.open) throw new Error('the menu never opened');
  return s;
}
const names = (rows) => rows.map((r) => r.name ?? r.label);
const gridRows = (s, slot) =>
  listRows({ ...s, menu: { ...s.menu, charturn: slot, submenu: 'actgrid' } });

// ── A. THE ROW ────────────────────────────────────────────────────────────
section('A — scr_monster_actreset is the default every row starts from');
{
  eq(ACT_ROW_DEFAULT.canact, 0, 'canact defaults to 0 — an enemy grants nothing until asked');
  eq(ACT_ROW_DEFAULT.name, ' ', 'actname defaults to a SPACE, not the empty string');
  eq(ACT_ROW_DEFAULT.descb, ' ', 'actdesc defaults to a SPACE');
  eq(ACT_ROW_DEFAULT.actor, 1, 'actactor defaults to 1 — the acting character performs alone');
  eq(ACT_ROW_DEFAULT.cost, 0, 'actcost defaults to 0');
  eq(ACT_ROW_DEFAULT.simul, 0, 'actsimul defaults to 0');

  const knight = ACT_TABLES[KNIGHT_MONSTERTYPE];
  const everyRow = [1, 2, 3, 4].flatMap((id) => knight[id]);
  ok(everyRow.length > 0, 'the monstertype-104 table has rows at all');
  ok(everyRow.every((r) => r.canact === 1),
    'every row the 104 block writes is canact 1 — a row that exists is a row it enabled');
  ok(everyRow.every((r) => r.cost === 0),
    'every vanilla row is FREE: the 104 block never writes actcost');
  ok(everyRow.every((r) => r.simul === 0),
    'every vanilla row is SINGLE: actsimul 0 on all of them (actsimulsus/ral written 0 explicitly)');
  // `actactor` is not one of the five fields the Draw's fill copies — it is
  // read straight out of the global at Draw_0:1145 — so a row carries it only
  // when its setup block assigns one. The 104 block assigns none.
  ok(everyRow.every((r) => r.actor === undefined),
    'NO vanilla row carries an actactor: the 104 block never writes one, so all of them take the default 1');
  ok(everyRow.every((r) => Object.isFrozen(r)),
    'the rows are frozen — a menu that mutated the table would leak between fights');
}

// ── B. THE SELECTOR ───────────────────────────────────────────────────────
section('B — Draw_0:1060-1095 picks by global.char[charturn], NOT by slot');
{
  const s = openMenu();
  deep(names(actsFor(s, 0)), ['Check', 'HoldBreath'], 'slot 0 is Kris: canact -> Check / HoldBreath');
  deep(names(actsFor(s, 1)), ['S-Action'], 'slot 1 is Susie: canactsus -> S-Action');
  deep(names(actsFor(s, 2)), ['R-Action'], 'slot 2 is Ralsei: canactral -> R-Action');

  // THE DISCRIMINATING CASE. A slot-indexed table gives the same three answers
  // in the same order however `global.char` is arranged; only a
  // character-indexed one follows the characters.
  const shuffled = { ...s, partyCharIds: [3, 1, 2] };
  deep(names(actsFor(shuffled, 0)), ['R-Action'],
    'global.char = [3,1,2]: slot 0 holds RALSEI and gets canactral');
  deep(names(actsFor(shuffled, 1)), ['Check', 'HoldBreath'],
    '...slot 1 holds KRIS and gets canact');
  deep(names(actsFor(shuffled, 2)), ['S-Action'],
    '...slot 2 holds SUSIE and gets canactsus');

  // The enemy index is the other half of `[thisenemy][__acti]`.
  eq(enemyMonsterType(s), 104, 'this fight faces monstertype 104 (scr_encountersetup case 115)');
  deep(names(actsFor({ ...s, monsterType: 999 }, 0)), [],
    'an enemy with no monstersetup block grants NOBODY a row — the table is per enemy');
}

// ── C. NOELLE, AND THE GREP THAT LIES ─────────────────────────────────────
section('C — the vanilla 104 block writes canact / canactsus / canactral and NOT canactnoe');
{
  const knight = ACT_TABLES[KNIGHT_MONSTERTYPE];
  ok(Array.isArray(knight[4]), 'character 4 HAS an entry — the field exists for every enemy');
  eq(knight[4].length, 0, '...and it is EMPTY: the v1.05 104 block never writes canactnoe');
  const s = openMenu();
  deep(actsFor({ ...s, partyCharIds: [1, 4, 0] }, 1), [],
    'a party that seats Noelle gets [] from the vanilla Knight, not undefined and not a crash');
  deep(Object.keys(knight).sort(), ['1', '2', '3', '4'],
    'the table covers character ids 1..4 and stops there');
  deep(ACT_GENERIC_NAMES, ['S-Action', 'R-Action', 'N-Action'],
    'the three names Draw_0:799-813 swaps for "Standard" — the game\'s own generic label');
  deep(ACT_SPECIAL_BY_CHAR, { 1: 1, 2: 2, 3: 3, 4: 4 },
    'battlespellspecial: scr_spellmenu_setup stamps the character id on an act row');
}

// ── D. `cant` ─────────────────────────────────────────────────────────────
section('D — Draw_0:1140-1246, the gates that grey a row');
{
  const base = openMenu();
  const up = { ...base, partyHp: [160, 190, 140], tension: 100 };
  const susieDown = { ...up, partyHp: [160, 0, 140] };
  const ralseiDown = { ...up, partyHp: [160, 190, 0] };

  const solo = { name: 'x', cost: 0 };
  ok(actUsable(up, 0, solo), 'a row with no actactor and no cost is always white');

  const withSusie = { name: 'x', actor: 2, cost: 0 };
  ok(actUsable(up, 0, withSusie), 'actactor 2 is usable while Susie stands');
  ok(!actUsable(susieDown, 0, withSusie), '...and GREY once she is down (global.hp[2] <= 0)');
  ok(actUsable(ralseiDown, 0, withSusie), '...and unaffected by Ralsei');

  const withRalsei = { name: 'x', actor: 3, cost: 0 };
  ok(actUsable(up, 0, withRalsei), 'actactor 3 is usable while Ralsei stands');
  ok(!actUsable(ralseiDown, 0, withRalsei), '...and GREY once he is down');

  const withBoth = { name: 'x', actor: 4, cost: 0 };
  ok(actUsable(up, 0, withBoth), 'actactor 4 needs BOTH, and both are up');
  ok(!actUsable(susieDown, 0, withBoth), '...grey with Susie down');
  ok(!actUsable(ralseiDown, 0, withBoth), '...grey with Ralsei down');

  const withNoelle = { name: 'x', actor: 5, cost: 0 };
  ok(!actUsable(up, 0, withNoelle),
    'actactor 5 wants NOELLE, who is not in this party at all — grey');
  ok(actUsable({ ...up, partyCharIds: [1, 4, 3] }, 0, withNoelle),
    '...and white in a party that seats her');
  ok(!actUsable({ ...up, partyCharIds: [1, 4, 3], partyHp: [160, 0, 140] }, 0, withNoelle),
    '...grey again once she is down');

  // `global.tension < acttpcost[i]` — Draw_0:1223.
  eq(actUsable({ ...up, tension: 62 }, 0, { name: 'x', cost: 62.5 }), false,
    'a row priced above the bar is grey');
  eq(actUsable({ ...up, tension: 63 }, 0, { name: 'x', cost: 62.5 }), true,
    '...and white the moment the bar covers it');

  // A row that computes its own answer still wins — that is the seam.
  eq(actUsable(up, 0, { name: 'x', actor: 5, cost: 999, usable: true }), true,
    'an explicit `usable` overrides every gate (the hook computes canpress live)');
  eq(actUsable(up, 0, { name: 'x', usable: false }), false, '...in both directions');
  eq(actUsable(up, 0, undefined), false, 'a missing row is never usable');
}

// ── E. THE BRIDGE ─────────────────────────────────────────────────────────
section('E — sim/spells.js resolves the slot the same way sim/menu.js does');
{
  const s = openMenu();
  // Every party with no empty slot: the two accessors must agree exactly.
  const parties = [undefined, [1, 2, 3], [3, 1, 2], [2, 3, 1], [1, 4, 3]];
  let agreed = 0;
  for (const p of parties) {
    const st = p ? { ...s, partyCharIds: p } : s;
    for (let slot = 0; slot < 3; slot++) {
      // actsFor's answer for a slot must be the table row of the id
      // charIdForSlot names. Compare through the table rather than exporting
      // the private accessor.
      const want = ACT_TABLES[KNIGHT_MONSTERTYPE][charIdForSlot(st, slot)] ?? [];
      if (JSON.stringify(actsFor(st, slot)) === JSON.stringify(want)) agreed += 1;
    }
  }
  eq(agreed, parties.length * 3,
    `actsFor and charIdForSlot agree on all ${parties.length * 3} occupied (party, slot) pairs`);

  // AND THE ONE PLACE THEY MUST NOT AGREE. `charIdForSlot` answers `slot + 1`
  // for `global.char[slot] == 0` on purpose — its caller is a colour lookup
  // that must not throw. `global.char[charturn] == 0` matches none of the
  // Draw's four `if`s, so the ACT fill leaves `canact[__acti]` at 0 and the
  // grid is empty; falling back would give an unoccupied slot the rows of
  // whoever the vanilla party seats there.
  const short = { ...s, partyCharIds: [1, 4, 0] };
  eq(charIdForSlot(short, 2), 3, 'charIdForSlot still answers 3 for the empty slot 2');
  deep(actsFor(short, 2), [], '...and actsFor answers [], not Ralsei\'s R-Action');
  eq(listRows({ ...short, menu: { ...short.menu, charturn: 2, submenu: 'actgrid' } }).length, 0,
    '...so the grid an empty slot opens has no rows at all');
}

// ── F. THE LIST THE MENU BUILDS ───────────────────────────────────────────
section('F — listRows carries the row, and the one-use filter is per CHARACTER');
{
  const s = openMenu();
  const kris = gridRows(s, 0);
  deep(kris.map((r) => r.label), ['Check', 'HoldBreath'], 'the ACT grid lists Kris\'s two rows');
  ok(kris.every((r) => r.usable === true), '...both white');
  ok(kris.every((r) => r.cost === 0 && r.simul === 0 && r.actor === 1),
    '...each carrying cost, simul and the actactor default, not just a label');
  eq(kris[0].descb, 'Useless#analysis', 'Check keeps its actdesc');
  eq(kris[1].descb, ' ', 'HoldBreath keeps the reset default — the block never writes actdesc[1]');

  // `global.canactsus[myself][0] = 0` at the tail of Susie's performance.
  const used = { ...s, actCounts: { susieUsed: true } };
  eq(gridRows(used, 1).length, 0, 'once Susie has acted her row is GONE from slot 1');
  eq(gridRows(used, 0).length, 2, '...and Kris keeps both of his');
  eq(gridRows(used, 2).length, 1, '...and Ralsei keeps his');

  // THE DISCRIMINATING CASE: Susie somewhere other than slot 1.
  const moved = { ...used, partyCharIds: [1, 4, 2] };
  eq(gridRows(moved, 2).length, 0, 'with Susie in slot 2, it is SLOT 2 that empties');
  eq(gridRows(moved, 1).length, 0,
    '...slot 1 holds Noelle, whose vanilla list is empty for its own reason');
  deep(gridRows({ ...s, partyCharIds: [1, 4, 2] }, 2).map((r) => r.label), ['S-Action'],
    '...and before she acts, slot 2 shows S-Action');
}

// ── G. VANILLA IS UNMOVED ─────────────────────────────────────────────────
section('G — the shipped fight sees exactly what it always saw');
{
  const s = openMenu();
  deep([0, 1, 2].map((c) => gridRows(s, c).map((r) => r.label)),
    [['Check', 'HoldBreath'], ['S-Action'], ['R-Action']],
    'the three grids, in order');
  deep(ACTS.map((l) => l.map((r) => r.name)),
    [['Check', 'HoldBreath'], ['S-Action'], ['R-Action']],
    'the slot-ordered view derives the same three lists');
  ok(ACTS.length === 3, 'ACTS is this fight\'s three slots and not a fourth');
  ok([0, 1, 2].every((c) => gridRows(s, c).every((r) => r.usable && r.cost === 0)),
    'nothing in the vanilla fight is greyed and nothing costs TP');
}

// ── H. THE COLOUR ─────────────────────────────────────────────────────────
section('H — hpcolorsoft, the "special colour" an act row draws in');
{
  eq(HP_COLOR_SOFT.length, 4, 'four characters, four colours');
  deep(HP_COLOR_SOFT[0], [128, 255, 255],
    'Kris: merge_color(c_aqua, c_white, 0.5) — the value sim/dmgnumbers.js already carries');
  deep(HP_COLOR_SOFT[1], [255, 128, 255], 'Susie: c_fuchsia halfway to white');
  deep(HP_COLOR_SOFT[2], [128, 255, 128], 'Ralsei: c_lime halfway to white');
  deep(HP_COLOR_SOFT[3], [255, 255, 128], 'Noelle: c_yellow halfway to white');
  ok(HP_COLOR_SOFT.every((c, i) => c.every((v, k) => v >= HPCOLOR[i][k])),
    'every channel is at or above its hpcolor — halfway to white never darkens');
}

console.log(`\n${failed ? `${failed} of ${count} FAILED` : `all ${count} assertions pass`}`);
process.exit(failed ? 1 : 0);
