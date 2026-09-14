#!/usr/bin/env node
// THE ACT SELECTOR IS KEYED BY CHARACTER, AND THE ENGINE'S TABLE IS VANILLA.
//
//   node kaizo/tools/checks/check-act-selector.mjs
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// ── THE TWO HALVES THIS PINS, AND WHY THEY ARE ONE FILE ────────────────────
//
// The ACT menu's contents come from `obj_battlecontroller`'s Draw
// (Draw_0:1059-1096), which picks one of FOUR sets of five parallel arrays by
// `global.char[global.charturn]` and indexes each `[thisenemy][__acti]`. Two
// indices, and the engine used to have neither: `sim/spells.js`'s `ACTS` was a
// flat list per PARTY SLOT. On the A-Side that is invisible, because
// `global.char` is [1, 2, 3] and slot i really is character i + 1. On the
// B-SIDE IT IS NOT: the Weird Route fields `global.char = [1, 4, 0]`, so slot
// 1 is NOELLE, and a slot-keyed table hands her SUSIE'S row.
//
// That never surfaced in play only because `kaizo/party/spells.js` installs an
// `actList` hook that answers first. A seam whose fallback is wrong is a seam
// that is one uninstalled hook from being wrong on screen, so section C strips
// the hook and asserts the ENGINE alone gets the B-Side party right.
//
// The other half is the direction of the delta. `diff`ing the mod's
// `scr_monstersetup` against `gml_vanilla_v105` over the `monstertype == 104`
// block: the stat line moves (maxhp 7300 -> 10000, at 40 -> 52, df 0 -> 5),
// three `canactnoe` lines APPEAR, and a `!scr_havechar(1)` fallback appears
// that turns all three partners' slot 0 into "HoldBreath". Check / HoldBreath
// / S-Action / R-Action are byte-identical in both trees.
//
//     v105  canact[0] Check ("Useless#analysis") · canact[1] HoldBreath
//           canactsus[0] "S-Action" actsimulsus 0
//           canactral[0] "R-Action" actsimulral 0
//           canactnoe — NEVER WRITTEN
//     mod   ...the same four, plus
//           canactnoe[0] "N-Action" actsimulnoe 0
//
// So **N-Action belongs to the mod and must not be in the engine's table**,
// and S-Action / R-Action are the GAME's strings and must not be renamed out
// of it. Section A holds that line from both sides at once: an engine that
// grows an N-Action row fails, and an engine that loses R-Action fails.
//
// The array is `canactnoe`, with NO TRAILING L. `canactnoel` returns zero
// files across the whole dump and reads as "Noelle has no act row anywhere",
// which is how this was got wrong twice.
//
// X-Slash is the mod's other addition and it is not in monstersetup at all:
// `obj_knight_enemy`'s Step_0:42-53, inside `if (k_sideb)`, writes
// `canact[myself][2] = 1`, actname "X-Slash", actdesc "Physical#damage",
// **actactor 11** and **actcost 62.5**. 11 is a chartime the vanilla Draw does
// not have — the mod adds its arm (Draw_0 mod-side `@@ +1166,30` and
// `@@ +1254,46`) — and it INVERTS the partner test: the row is usable only
// once every partner is down. Sections D and E pin that it still reaches the
// menu with its own `usable`, unchanged by the engine's new `cant` gates.
//
// ── IT IS RED UNTIL THE ENGINE IS RE-VENDORED, AND THAT IS THE POINT ───────
//
// Everything it reads — `ACT_TABLES`, `ACT_ROW_DEFAULT`, `actUsable`, the
// character-keyed `actsFor` and the character-keyed one-use filter — lands in
// knight-sim `kaizo-act-model` (v1.0.52, "the ACT table is per enemy, per
// character, five parallel fields"). Against the snapshot under `sim/` at the
// time this was written the imports resolve to undefined and section A fails
// on the first line. Run `npm run vendor:engine` once that branch is in
// knight-sim's main, and it goes green; it was measured green against the
// staged files before this was committed, and RED against the pristine
// snapshot, which is the pair of readings that says it is checking the change
// rather than the weather. WIRE IT ONLY AFTER THE RE-VENDOR.
//
// SABOTAGE-TESTED: adding an N-Action row to sim/spells.js's ACT_TABLES[104][4]
// fails A; making `actsFor` index the table by `c + 1` fails C; letting
// `actUsable` recompute over a row that already carries `usable` fails D;
// keying listRows' one-use filter back to `c === 1` fails E.

const { createState, stepFrame } = await import('../../../sim/index.js');
const { buildPracticeScene } = await import('../../../sim/scenes/practice.js');
const { buildKaizoScene } = await import('../../scenes/kaizo-fight.js');
const { listRows } = await import('../../../sim/menu.js');
const {
  ACT_TABLES, KNIGHT_MONSTERTYPE, ACT_ROW_DEFAULT, actsFor, actUsable,
} = await import('../../../sim/spells.js');

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
  left: false, right: false, up: false, down: false, confirm: false, cancel: false,
  focus: false, button3: false,
};

function build(kind) {
  const s = createState({ seed: 12345, traceBulletSlots: 8 });
  if (kind === 'vanilla') buildPracticeScene(s, { seed: 12345 });
  else buildKaizoScene(s, { version: kind });
  return s;
}
function openMenu(kind) {
  const s = build(kind);
  for (let i = 0; i < 12 && !s.menu?.open; i++) stepFrame(s, IDLE);
  if (!s.menu?.open) throw new Error(`${kind}: the menu never opened`);
  return s;
}
const names = (rows) => (rows ?? []).map((r) => r.name ?? r.label);
const gridRows = (s, slot) =>
  listRows({ ...s, menu: { ...s.menu, charturn: slot, submenu: 'actgrid' } });
/** The same state with kaizo's actList hook removed, so the ENGINE answers. */
function unhooked(s) {
  return { ...s, kaizo: { ...s.kaizo, hooks: { ...s.kaizo?.hooks, actList: undefined } } };
}

// ── A. THE ENGINE'S TABLE IS THE COMPARISON TREE'S, NOT THE MOD'S ──────────
section('A — sim/spells.js carries v105\'s monstertype-104 block and none of the mod\'s deltas');
{
  const t = ACT_TABLES[KNIGHT_MONSTERTYPE];
  deep(names(t[1]), ['Check', 'HoldBreath'], 'char 1 KRIS: canact[0] Check, canact[1] HoldBreath');
  eq(t[1][0].descb, 'Useless#analysis', '...and canact[0]\'s actdesc');
  deep(names(t[2]), ['S-Action'], 'char 2 SUSIE: canactsus[0] "S-Action" — the GAME\'s string');
  deep(names(t[3]), ['R-Action'], 'char 3 RALSEI: canactral[0] "R-Action" — present, not empty');
  deep(names(t[4]), [], 'char 4 NOELLE: canactnoe is NEVER WRITTEN by the v105 block');

  const every = [1, 2, 3, 4].flatMap((id) => t[id]);
  ok(!every.some((r) => r.name === 'N-Action'),
    'N-Action is NOT in the engine table — it is the MOD\'s addition and arrives by hook');
  ok(!every.some((r) => r.name === 'X-Slash'),
    'X-Slash is NOT in the engine table — obj_knight_enemy writes it, under k_sideb');
  ok(every.every((r) => r.simul === 0),
    'every v105 row is actsimul 0: no simultaneous act against this enemy');
  ok(every.every((r) => (r.cost ?? 0) === 0),
    'every v105 row is free: the block writes no actcost (X-Slash\'s 62.5 is the mod\'s)');
  ok(every.every((r) => r.actor === undefined),
    'no v105 row writes actactor, so all of them take the reset default'
    + ` of ${ACT_ROW_DEFAULT.actor} — actactor 11 is the mod's`);
}

// ── B. THE SEAM STILL ANSWERS FIRST ────────────────────────────────────────
section('B — with the hook installed, V-C and V-D read exactly as they did');
{
  const c = openMenu('C');
  deep(gridRows(c, 0).map((r) => r.label), ['Check', 'HoldBreath'],
    'V-C slot 0 KRIS: the A-Side has no X-Slash (Step_0:42 is k_sideb-gated)');
  deep(gridRows(c, 1).map((r) => r.label), ['S-Action'], 'V-C slot 1 SUSIE');
  deep(gridRows(c, 2).map((r) => r.label), ['R-Action'], 'V-C slot 2 RALSEI');

  const d = openMenu('D');
  deep(gridRows(d, 0).map((r) => r.label), ['Check', 'HoldBreath', 'X-Slash'],
    'V-D slot 0 KRIS: X-Slash at index 2');
  deep(gridRows(d, 1).map((r) => r.label), ['N-Action'],
    'V-D slot 1 NOELLE: the mod\'s own row, one of them');

  const v = openMenu('vanilla');
  deep([0, 1, 2].map((slot) => gridRows(v, slot).map((r) => r.label)),
    [['Check', 'HoldBreath'], ['S-Action'], ['R-Action']],
    'the vanilla practice fight is untouched by any of it');
}

// ── C. THE ENGINE ALONE, ON THE B-SIDE PARTY ───────────────────────────────
section('C — strip the hook: the engine must key by global.char, not by slot');
{
  const d = openMenu('D');
  const chars = d.kaizo?.globalChar ?? d.partyCharIds;
  deep(chars?.slice(0, 3), [1, 4, 0], 'V-D publishes global.char = [1, 4, 0]');

  const bare = unhooked(d);
  deep(names(actsFor(bare, 0)), ['Check', 'HoldBreath'],
    'slot 0 holds KRIS (char 1) and gets canact');
  deep(names(actsFor(bare, 1)), [],
    'slot 1 holds NOELLE (char 4) and gets canactnoe — EMPTY in v105, NOT Susie\'s S-Action');
  ok(!names(actsFor(bare, 1)).includes('S-Action'),
    '...naming the failure the slot-keyed table produced, so it cannot come back quietly');
  deep(names(actsFor(bare, 2)), [],
    'slot 2 is empty (global.char 0) and gets nothing');

  // And the A-Side party, where slot and character coincide — the case that
  // cannot tell the two models apart, asserted so the fix is not a swap.
  const bareC = unhooked(openMenu('C'));
  deep([0, 1, 2].map((slot) => names(actsFor(bareC, slot))),
    [['Check', 'HoldBreath'], ['S-Action'], ['R-Action']],
    'V-C (global.char [1, 2, 3]) is unchanged: slot and character coincide there');
}

// ── D. X-SLASH KEEPS ITS OWN `cant` ────────────────────────────────────────
section('D — actactor 11 INVERTS the partner test, so the row computes its own grey');
{
  const d = openMenu('D');
  const x = gridRows(d, 0)[2];
  ok(x !== undefined, 'V-D slot 0 has a row at index 2');
  eq(x.label, 'X-Slash', '...and it is X-Slash');
  eq(x.cost, 62.5, '...carrying actcost 62.5 (Step_0:48)');
  eq(x.descb, 'Physical#damage', '...and actdesc "Physical#damage" (Step_0:46)');
  eq(x.actor, 11, '...and actactor 11 (Step_0:47), the chartime the mod\'s Draw arm adds');

  // The engine's own `cant` gates would grey an actactor-11 row the moment it
  // saw one, because 11 is not in the 2/3/4/5 set and the row costs 62.5. The
  // hook's live `canpress` has to win, in BOTH directions.
  const st = { ...d, tension: 250, partyHp: [160, 0, 0] };
  eq(actUsable(st, 0, { ...x, usable: true }), true,
    'a row that says it is usable stays usable, whatever the engine gates think');
  eq(actUsable({ ...st, tension: 0 }, 0, { ...x, usable: true }), true,
    '...including against the engine\'s TP gate, because the mod charges at confirm');
  eq(actUsable(st, 0, { ...x, usable: false }), false, '...and a refusal is honoured too');
  // Without the hook's answer the engine falls back to its own gates, and 62.5
  // against an empty bar is grey — the readout check-actgrid-tpcost draws.
  const { usable: _drop, ...noAnswer } = x;
  eq(actUsable({ ...st, tension: 0 }, 0, noAnswer), false,
    'a row with no answer of its own and 0 TP is grey on the engine\'s gate alone');
  eq(actUsable({ ...st, tension: 250 }, 0, noAnswer), true, '...and white with the bar full');
}

// ── E. THE ONE-USE FILTER IS SUSIE'S, NOT SLOT 1'S ─────────────────────────
section('E — canactsus[myself][0] = 0 belongs to a CHARACTER');
{
  // `obj_knight_enemy`'s Step, at the tail of Susie performing S-Action, sets
  // `global.canactsus[myself][0] = 0`. Keyed by slot, that flag emptied slot 1
  // of whatever party was seated there — on the Weird Route, Noelle.
  const d = openMenu('D');
  const used = { ...d, actCounts: { ...(d.actCounts ?? {}), susieUsed: true } };
  deep(gridRows(used, 1).map((r) => r.label), ['N-Action'],
    'V-D slot 1 is NOELLE and keeps her row when Susie\'s flag is set');
  eq(gridRows(used, 0).length, 3, '...and Kris keeps all three of his');

  const c = openMenu('C');
  const usedC = { ...c, actCounts: { ...(c.actCounts ?? {}), susieUsed: true } };
  eq(gridRows(usedC, 1).length, 0, 'V-C slot 1 IS Susie, so there the row really does go');
  eq(gridRows(usedC, 2).length, 1, '...and Ralsei is untouched by it');
}

console.log(`\n${failed ? `${failed} of ${count} FAILED` : `all ${count} assertions pass`}`);
process.exit(failed ? 1 : 0);
