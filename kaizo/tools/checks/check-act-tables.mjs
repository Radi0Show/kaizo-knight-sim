#!/usr/bin/env node
// KAIZO — THE ACT TABLES ARE THE MOD'S, ROW FOR ROW, BY NAME.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// WHY THIS FILE EXISTS. Twice now a lane has arrived believing the act rows
// this repo ships are invented placeholders — that "S-Action", "R-Action" and
// "N-Action" are our own names, that Ralsei and Noelle have no act row in the
// Kaizo fight, and that the fix is to add rows or delete them. Both readings
// are wrong, and one of them cost the byte gate 3,763 frames before it was
// backed out. This check pins the truth BY NAME so the next reading has to
// argue with a failing assertion instead of with a comment.
//
// THE PRIMARY SOURCE, re-read 2026-09-14 and diffed mod-vs-comparison-tree.
// `obj_knight_enemy`'s Other_22 calls `scr_monstersetup()`, so the knight
// really does take the monstertype-104 block, and that block is the whole act
// table for this fight:
//
//   gml_GlobalScript_scr_monstersetup.gml :1843-1881   (the `== 104` block)
//       global.canact[myself][0]    = 1;  actname "Check"
//                                         actdesc "Useless#analysis"
//       global.canact[myself][1]    = 1;  actname "HoldBreath"
//       global.canactsus[myself][0] = 1;  actnamesus "S-Action"   actsimul 0
//       global.canactral[myself][0] = 1;  actnameral "R-Action"   actsimul 0
//       global.canactnoe[myself][0] = 1;  actnamenoe "N-Action"   actsimul 0
//       if (!scr_havechar(1)) { sus / ral / noe slot 0 all -> "HoldBreath" }
//
//   `diff` against gml_vanilla_v105 shows the 104 block's ONLY deltas are the
//   stat line (maxhp 7300 -> 10000, at 40 -> 52, df 0 -> 5) and the canactnoe
//   rows plus the Kris-less fallback. Check / HoldBreath / S-Action /
//   R-Action are byte-identical in both trees — they are the GAME's names,
//   which is exactly why sim/spells.js's `ACTS` already holds them and why
//   editing that table to suit kaizo would be a regression, not a fix.
//
//   THE GREP THAT MISLEADS: the array is `global.canactnoe`, not
//   `canactnoel`. Grepping the longer spelling returns zero files across the
//   whole dump and reads as "Noelle has no act row". She has one: N-Action,
//   and it is the mod's own addition.
//
//   gml_Object_obj_knight_enemy_Step_0.gml :42-53 (inside `if (k_sideb)`,
//   under `damagereductiontimer == 1`, the knight's first Step)
//       global.canact[myself][2] = 1;  actname "X-Slash"
//                                      actdesc "Physical#damage"
//                                      actactor 11   actcost 62.5
//   B-SIDE ONLY. The A-Side knight never writes index 2, so V-C's Kris has
//   two rows and V-D's has three.
//
//   gml_Object_obj_knight_enemy_Step_0.gml :1163-1180 — the block that clears
//   `canactsus[myself][0]` sits INSIDE `if (_susieact == 1 && actconsus == 1)`:
//   it is the tail of Susie PERFORMING S-Action, not a per-frame swap. Its
//   `if (global.canactsus[myself][1] == 1)` HoldBreath restore is DEAD CODE in
//   this fight — nothing in the mod ever writes `canactsus[<104>][1] = 1`
//   (scr_monstersetup's 104 block sets index 0 only; scr_monster_actreset
//   zeroes every index). So S-Action is one use and then gone, which is what
//   vanilla does and what sim/menu.js's `susieUsed` filter already models.
//
//   gml_GlobalScript_scr_spellmenu_setup.gml — BYTE-IDENTICAL between the two
//   trees. The mod did not touch the menu builder; "does this character get an
//   ACT row" is decided entirely by the canact* arrays above.
//
//     node kaizo/tools/checks/check-act-tables.mjs
//
// SABOTAGE-TESTED: see the lane report. Renaming KAIZO_ACTS_BY_CHAR[4]'s
// "N-Action" to "Noelle-Action" fails section B and C; emptying
// KAIZO_ACTS_BY_CHAR[3] fails B and C; adding a fourth row to
// sim/spells.js's ACTS[0] fails D.

import { createState, stepFrame } from '../../../sim/index.js';
import { buildPracticeScene } from '../../../sim/scenes/practice.js';
import { listRows } from '../../../sim/menu.js';
import { actsFor, ACTS } from '../../../sim/spells.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import {
  installRoster, buildRoster, WEIRD_ROUTE_PARTY, NORMAL_ROUTE_PARTY,
  CHAR_KRIS, CHAR_SUSIE, CHAR_RALSEI, CHAR_NOELLE,
} from '../../party/roster.js';
import { KAIZO_ACTS_BY_CHAR, kaizoActsForRoster } from '../../party/noelle.js';
import { kaizoActList, XSLASH_ACT, XSLASH_ACT_INDEX, installKaizoMenu } from '../../party/spells.js';

let failed = 0;
let count = 0;
function ok(cond, what) {
  count += 1;
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
}
function eq(got, want, what) {
  ok(got === want, `${what} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}
const deep = (got, want, what) => eq(JSON.stringify(got), JSON.stringify(want), what);
const section = (t) => console.log(`\n== ${t}`);

const IDLE = {
  left: false, right: false, up: false, down: false, confirm: false, cancel: false,
  focus: false, button3: false,
};

function build(kind) {
  const s = createState({ seed: 12345, traceBulletSlots: 8 });
  if (kind === 'vanilla') buildPracticeScene(s, { seed: 12345 });
  else buildKaizoScene(s, { version: kind });
  return s;
}
/** Drive to the open command phase, as the player reaches it. */
function openMenu(kind) {
  const s = build(kind);
  for (let i = 0; i < 8 && !s.menu?.open; i++) stepFrame(s, IDLE);
  if (!s.menu?.open) throw new Error(`${kind}: menu never opened`);
  return s;
}
/** The ACT grid's rows for one slot, through the ENGINE's own list builder. */
const gridNames = (s, slot) =>
  listRows({ ...s, menu: { ...s.menu, charturn: slot, submenu: 'actgrid' } }).map((r) => r.label);
const gridRows = (s, slot) =>
  listRows({ ...s, menu: { ...s.menu, charturn: slot, submenu: 'actgrid' } });

// ── A. THE MONSTERSETUP 104 BLOCK, CHARACTER BY CHARACTER ──────────────────
section('A — scr_monstersetup:1843-1881, the char-keyed table (noelle.js KAIZO_ACTS_BY_CHAR)');
{
  deep(KAIZO_ACTS_BY_CHAR[CHAR_KRIS].map((a) => a.name), ['Check', 'HoldBreath'],
    'char 1 KRIS: canact[0] Check, canact[1] HoldBreath');
  eq(KAIZO_ACTS_BY_CHAR[CHAR_KRIS][0].descb, 'Useless#analysis',
    'canact[0] actdesc is "Useless#analysis"');
  // "never written" is not "empty". scr_monster_actreset.gml:8 seeds every row
  // with " " before scr_monstersetup runs, and the 104 block writes actdesc[0]
  // only — so the row the block skips keeps the RESET's space.
  eq(KAIZO_ACTS_BY_CHAR[CHAR_KRIS][1].descb, ' ',
    'canact[1] HoldBreath keeps the reset SPACE — the 104 block never writes actdesc[1]');
  deep(KAIZO_ACTS_BY_CHAR[CHAR_SUSIE].map((a) => a.name), ['S-Action'],
    'char 2 SUSIE: canactsus[0] "S-Action" — the GAME\'s name, byte-identical in v105');
  deep(KAIZO_ACTS_BY_CHAR[CHAR_RALSEI].map((a) => a.name), ['R-Action'],
    'char 3 RALSEI: canactral[0] "R-Action" — NOT an empty list, NOT invented');
  deep(KAIZO_ACTS_BY_CHAR[CHAR_NOELLE].map((a) => a.name), ['N-Action'],
    'char 4 NOELLE: canactnoe[0] "N-Action" — the MOD\'s own addition (absent from v105)');
  for (const id of [CHAR_SUSIE, CHAR_RALSEI, CHAR_NOELLE]) {
    eq(KAIZO_ACTS_BY_CHAR[id][0].simul, 0, `char ${id}: actsimul* [0] = 0 (no simultaneous act)`);
    eq(KAIZO_ACTS_BY_CHAR[id].length, 1, `char ${id}: exactly ONE row — index 1 is never written`);
  }
  eq(KAIZO_ACTS_BY_CHAR[CHAR_KRIS].length, 2, 'char 1: exactly TWO rows before the B-Side X-Slash');
  // The array the 104 block does not touch. A fifth character id would be an
  // invention; assert the table stops where the GML stops.
  deep(Object.keys(KAIZO_ACTS_BY_CHAR).sort(), ['1', '2', '3', '4'],
    'the table covers char ids 1..4 and nothing else');
}

// ── B. DRIVEN: EVERY CHARACTER'S MENU, ON BOTH ROUTES ──────────────────────
section('B — driven through the engine menu: the exact row list each slot shows');
{
  // V-C — the Normal Route three. No hooks are installed, so these rows come
  // out of the ENGINE's `ACTS`, which is the same 104 block (section D).
  const c = openMenu('C');
  deep(gridNames(c, 0), ['Check', 'HoldBreath'],
    'V-C slot 0 KRIS: Check / HoldBreath — and NO X-Slash (Step_0:42 is k_sideb-gated)');
  deep(gridNames(c, 1), ['S-Action'], 'V-C slot 1 SUSIE: S-Action');
  deep(gridNames(c, 2), ['R-Action'], 'V-C slot 2 RALSEI: R-Action');
  ok(!gridNames(c, 0).includes('X-Slash'), 'V-C: X-Slash appears nowhere on the A-Side');

  // V-D — the Weird Route two. Hooks installed; kaizoActList supplies the rows.
  const d = openMenu('D');
  eq(d.kaizo.roster.length, 2, 'V-D fields two characters (global.char = [1, 4, 0])');
  deep(gridNames(d, 0), ['Check', 'HoldBreath', 'X-Slash'],
    'V-D slot 0 KRIS: Check / HoldBreath / X-Slash at index 2');
  deep(gridNames(d, 1), ['N-Action'],
    'V-D slot 1 NOELLE: N-Action — ONE row, not zero and not "N-Action" plus anything');
  const x = gridRows(d, 0)[XSLASH_ACT_INDEX];
  eq(x.cost, 62.5, 'X-Slash actcost 62.5 (Step_0:47)');
  eq(x.descb, 'Physical#damage', 'X-Slash actdesc (Step_0:45)');
  eq(XSLASH_ACT.actor, 11, 'X-Slash actactor 11 (Step_0:46)');

  // Vanilla must be untouched by any of this — the engine default is shared.
  const v = openMenu('vanilla');
  deep([gridNames(v, 0), gridNames(v, 1), gridNames(v, 2)],
    [['Check', 'HoldBreath'], ['S-Action'], ['R-Action']],
    'vanilla practice is unchanged: the kaizo tables never reach it');
}

// ── C. THE ANTI-DELETION ASSERTIONS ────────────────────────────────────────
section('C — Ralsei and Noelle DO have an act row; asserting it by name');
{
  const c = openMenu('C');
  const d = openMenu('D');
  eq(gridNames(c, 2).length, 1, 'RALSEI\'s list has exactly one row — it is not empty');
  eq(gridNames(c, 2)[0], 'R-Action', '...and that row is named "R-Action"');
  eq(gridNames(d, 1).length, 1, 'NOELLE\'s list has exactly one row — it is not empty');
  eq(gridNames(d, 1)[0], 'N-Action', '...and that row is named "N-Action"');
  // The same answer through the kaizo seam directly, not only through listRows.
  deep(kaizoActList(d, 1).map((a) => a.name), ['N-Action'],
    'kaizoActList(slot 1) is ["N-Action"] — the hook agrees with the menu');
  // And through actsFor, the seam sim/ reads.
  deep(actsFor(d, 1).map((a) => a.name), ['N-Action'], 'actsFor(slot 1) agrees too');
  deep(actsFor(c, 2).map((a) => a.name), ['R-Action'], 'actsFor(V-C slot 2) agrees too');
}

// ── D. THE ENGINE DEFAULT IS ALREADY THE MOD'S TABLE ───────────────────────
section('D — sim/spells.js ACTS is the 104 block verbatim; kaizo must never edit it');
{
  // A ROW THE 104 BLOCK LEAVES UNDESCRIBED KEEPS A SPACE, NOT AN EMPTY STRING.
  // scr_monster_actreset.gml:8 is `global.actdesc[arg0][__fj] = " "`, and
  // scr_monstersetup writes only `actdesc[myself][0]` — so every other row
  // still carries the reset's space. sim/spells.js:146 has it right
  // (ACT_ROW_DEFAULT.descb is a space), and upstream pins it in a WIRED, green
  // suite: knight-sim tools/verify-actmodel.mjs:75, "actdesc defaults to a
  // SPACE".
  //
  // This check asked for the empty string and had therefore NEVER passed —
  // spells.js already held the space when the check was written. A born-red
  // assertion, not a regression, which is exactly why it sat unwired and
  // unenforced for its whole life. Fixed and WIRED 2026-09-16.
  deep(ACTS, [
    [
      { name: 'Check', descb: 'Useless#analysis' },
      { name: 'HoldBreath', descb: ' ' },
    ],
    [{ name: 'S-Action', descb: ' ' }],
    [{ name: 'R-Action', descb: ' ' }],
  ], 'the vendored engine\'s ACTS matches scr_monstersetup\'s 104 block for slots 0..2');
  eq(ACTS.length, 3, 'three slots — the vanilla fight\'s fixed party');
  ok(!JSON.stringify(ACTS).includes('N-Action'),
    'the ENGINE table carries no N-Action: Noelle is kaizo\'s, and she arrives through the hook');
  ok(!JSON.stringify(ACTS).includes('X-Slash'),
    'the ENGINE table carries no X-Slash: it is B-Side, and it arrives through the hook');
}

// ── E. THE `!scr_havechar(1)` FALLBACK ─────────────────────────────────────
section('E — scr_monstersetup:1869-1880: a Kris-less party gets HoldBreath, and only then');
{
  deep(kaizoActsForRoster([CHAR_KRIS, CHAR_NOELLE]).map((a) => a.map((r) => r.name)),
    [['Check', 'HoldBreath'], ['N-Action']],
    'Kris present: the normal rows (the Weird Route ALWAYS has Kris)');
  deep(kaizoActsForRoster(NORMAL_ROUTE_PARTY).map((a) => a.map((r) => r.name)),
    [['Check', 'HoldBreath'], ['S-Action'], ['R-Action']],
    'the Normal Route three: the normal rows');
  // The gate is on KRIS being absent, not Susie — and the consequence is that
  // ALL THREE companion slot-0 rows become HoldBreath, verbatim.
  deep(kaizoActsForRoster([CHAR_SUSIE, CHAR_RALSEI, CHAR_NOELLE]).map((a) => a.map((r) => r.name)),
    [['HoldBreath'], ['HoldBreath'], ['HoldBreath']],
    '!scr_havechar(1): S-, R- and N-Action all become HoldBreath');
  deep(kaizoActsForRoster([CHAR_KRIS, CHAR_SUSIE]).map((a) => a.map((r) => r.name)),
    [['Check', 'HoldBreath'], ['S-Action']],
    '...and it does NOT fire merely because a companion is missing');
}

// ── F. SUSIE'S ROW IS ONE USE, AND THE RESTORE BRANCH IS DEAD ──────────────
section('F — Step_0:1163-1180: S-Action leaves the list after one performance');
{
  const c = openMenu('C');
  deep(gridNames(c, 1), ['S-Action'], 'before: S-Action is on the list');
  c.actCounts = { ...(c.actCounts ?? {}), susieUsed: true };
  deep(gridNames(c, 1), [],
    'after `global.canactsus[myself][0] = 0`: the list is EMPTY, not "HoldBreath"');
  // The HoldBreath restore at :1172 needs `canactsus[myself][1] == 1`, which
  // nothing in the mod ever writes for monstertype 104. Assert the table has
  // no index 1 to restore FROM, which is the same fact from the data side.
  eq(KAIZO_ACTS_BY_CHAR[CHAR_SUSIE].length, 1,
    'there is no canactsus[..][1] row in the 104 block, so the restore branch can never fire');
  // Ralsei and Noelle have no such clear — their row stays for the whole fight.
  const d = openMenu('D');
  d.actCounts = { ...(d.actCounts ?? {}), susieUsed: true };
  deep(gridNames(d, 1), ['N-Action'],
    'the susieUsed filter is SLOT 1 + SUSIE\'s rule and does not strip Noelle\'s row');
}

// ── G. X-SLASH IS B-SIDE ONLY, FROM THE ROSTER UP ──────────────────────────
section('G — Step_0:42 sits inside `if (k_sideb)`');
{
  const a = createState({ seed: 7, traceBulletSlots: 8 });
  installRoster(a, { charIds: WEIRD_ROUTE_PARTY, sideb: false });
  a.knight = { damagereduction: 0.18, hp: 10000 };
  installKaizoMenu(a);
  deep(kaizoActList(a, 0).map((r) => r.name), ['Check', 'HoldBreath'],
    'sideb false: Kris keeps two rows');
  deep(kaizoActList(a, 1).map((r) => r.name), ['N-Action'],
    '...and Noelle keeps hers — N-Action is monstersetup, not k_sideb');
  const b = createState({ seed: 7, traceBulletSlots: 8 });
  installRoster(b, { charIds: WEIRD_ROUTE_PARTY, sideb: true });
  b.knight = { damagereduction: 0.18, hp: 10000 };
  installKaizoMenu(b);
  deep(kaizoActList(b, 0).map((r) => r.name), ['Check', 'HoldBreath', 'X-Slash'],
    'sideb true: X-Slash lands at index 2, not 0 and not 1');
  eq(XSLASH_ACT_INDEX, 2, 'the index is the GML\'s own `canact[myself][2]`');
  // The roster's stored rows are the monstersetup ones on BOTH sides: X-Slash
  // is appended live by kaizoActList because `usable` is live state.
  deep(buildRoster(WEIRD_ROUTE_PARTY, { sideb: true }).map((m) => m.acts.map((r) => r.name)),
    [['Check', 'HoldBreath'], ['N-Action']],
    'buildRoster stores the monstersetup rows only — X-Slash is not baked in');
}

console.log(`\ncheck-act-tables: ${count - failed}/${count} assertions passed`);
process.exit(failed ? 1 : 0);
