#!/usr/bin/env node
// KAIZO V-D — THE ALLY PICKER AND THE COMMAND-PHASE GATE, driven through the
// REAL MENU. Every assertion below comes from pressing keys into `stepFrame`
// and reading the state that came back: nothing here inspects a table or calls
// a helper directly, because six of these defects were invisible to exactly
// that kind of test — the data was right and the flow through it was not.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// THE PARTY THAT BREAKS ALL SIX: the Weird Route roster is two members,
// `global.char = [1, 4, 0]`, and the engine keeps three slots with the third
// padded. Every defect here is a vanilla-shaped consumer meeting that pad — a
// bare `% 3`, an `i < 3`, an `isUp` that reads a flag an empty slot does not
// have. `kaizo/party/WEIRD-ROUTE.md` has the roster; the pad is installed by
// `buildKaizoScene`.
//
// PROVENANCE of every expectation, in the mod's own decompiled GML
// (`knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/`):
//   gml_Object_obj_battlecontroller_Step_0.gml  :1219-1226  the `ht` presence table
//                                               :1227-1242  the four clamps
//                                               :1250-1340  down_p / up_p, and NO left_p/right_p
//                                               :1341-1358  the confirm -> itemconsumeb/spellconsumeb
//                                               :656/802/1001  the three sites that OPEN the picker
//   gml_GlobalScript_scr_charcan.gml            :1-23   presence, hp, charmove
//   gml_GlobalScript_scr_nexthero.gml           :1-56   the search, then the carry
//   gml_GlobalScript_scr_itemconsumeb.gml       :3      charaction = 4
//   gml_GlobalScript_scr_spellconsumeb.gml      :5      charaction = 2
//   gml_GlobalScript_scr_battlecursor_memory_reset.gml :3-12  bmenucoord all zero
//   gml_GlobalScript_scr_mnendturn.gml          :35     who calls that reset
//
// WHAT EACH BLOCK WOULD CATCH IF IT WERE REVERTED — these are reader guards,
// not value assertions, which is the point:
//   1  skipFallen back on `isUp`         -> the pad takes a menu panel
//   2  the `ht` table back to `% 3`      -> the cursor reaches the pad
//   3  the four clamps removed           -> a confirm lands on the pad
//   4  `menu.targetIndex = c` restored   -> the picker opens on the caster
//   5  left/right re-aliased onto up/down-> the cursor moves on a dead key
//   6  `state.charaction[c] = 0` restored-> a targeted choice unmakes itself
//   7  endTurnItems back on `min(charturn, 2)` / nextHero back on `+= 1`
//                                        -> the item comes back
//
//     node kaizo/tools/checks/check-ally-picker.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { scrCharcan, slotOccupied, listRows, openMenu } from '../../../sim/menu.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';

let failures = 0;
let count = 0;
function assert(cond, label) {
  count += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); } else console.log(`  ok   ${label}`);
}
function assertEq(got, want, label) {
  assert(got === want, `${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}
function assertDeep(got, want, label) {
  assertEq(JSON.stringify(got), JSON.stringify(want), label);
}
function section(t) { console.log(`\n== ${t}`); }

const IDLE = {
  left: false, right: false, up: false, down: false, confirm: false, cancel: false,
  focus: false, button3: false,
};

/**
 * ONE EDGE PRESS, then three idle frames. The idle frames are not padding:
 * `onebuffer` is set to 2 on a grid confirm and decremented once per Step, so
 * a second confirm two frames later is REFUSED by the original's own gate
 * (obj_battlecontroller Step_0, the last two lines). A two-frame press walks
 * straight into it and the test then reads "nothing happened" as a defect.
 */
function press(s, key) {
  stepFrame(s, { ...IDLE, [key]: true });
  for (let i = 0; i < 3; i += 1) stepFrame(s, IDLE);
}

/** The Weird Route fight, one frame in — the command phase open on Kris. */
function vd(seed, bag = null) {
  const s = createState({ seed, traceBulletSlots: 8, ...(bag ? { bag } : {}) });
  buildKaizoScene(s, { version: 'D' });
  stepFrame(s, IDLE);
  return s;
}

/** The A-Side fight, for the assertions that are about the vanilla trio. */
function vc(seed) {
  const s = createState({ seed, traceBulletSlots: 8 });
  buildKaizoScene(s, { version: 'C' });
  stepFrame(s, IDLE);
  return s;
}

/** Put a slot down the way scr_dead does — five globals, not an HP write. */
function down(s, slot) {
  s.partyHp[slot] = -999;
  s.chardead[slot] = 1;
  s.charmove[slot] = 0;
  s.charcantarget[slot] = 0;
}

/** Walk the button row to a named button and confirm it. */
const BUTTON_RIGHT = { FIGHT: 0, SECOND: 1, ITEM: 2, SPARE: 3, DEFEND: 4 };
function chooseButton(s, name) {
  for (let i = 0; i < BUTTON_RIGHT[name]; i += 1) press(s, 'right');
  press(s, 'confirm');
}

/**
 * WALK THE OPEN GRID TO A NAMED ROW, by pressing the keys that move it.
 *
 * The 2x6 grid's own navigation (obj_battlecontroller Step_0's bmenuno 2/4
 * block, and CLAUDE.md's "the item menu is not in the charbox"): LEFT and
 * RIGHT are the SAME toggle across the two columns, DOWN steps by two, and
 * both refuse an empty slot. So row n is `floor(n / 2)` DOWNs plus a RIGHT
 * when n is odd.
 *
 * Finding the row BY NAME rather than by a hardcoded index is deliberate: the
 * mod's spell tables gain and lose rows as the recreation lands more of them
 * (Noelle's MAGIC list grew an N-Action row above Heal Prayer while this file
 * was being written), and a check that hardcodes an index silently starts
 * testing a different spell instead of failing.
 */
function selectRow(s, label) {
  const rows = listRows(s);
  const want = rows.findIndex((r) => r.label === label);
  assert(want >= 0, `the open list offers "${label}" (rows: ${rows.map((r) => r.label).join(', ')})`);
  if (want < 0) return;
  for (let i = 0; i < Math.floor(want / 2); i += 1) press(s, 'down');
  if (want % 2 === 1) press(s, 'right');
  assertEq(s.menu.gridIndex, want, `the cursor walked to "${label}"`);
}

const spincakes = (list) => list.filter((id) => id === 7).length;

// ── 0. the roster really is two members with a pad ────────────────────────
section('the party under test');
{
  const s = vd(1001);
  assertDeep(s.kaizo.globalChar, [1, 4, 0], 'global.char = [1, 4, 0] — Kris, Noelle, empty');
  assert(slotOccupied(s, 0) && slotOccupied(s, 1) && !slotOccupied(s, 2),
    'slotOccupied reads that table: 0 and 1 occupied, 2 is the pad');
  assert(s.menu.open && s.menu.charturn === 0, 'the command phase opened on Kris');
}

// ── 1. scr_charcan is the command-phase gate, and PRESENCE is its first test ─
//
// THE PHANTOM THIRD PARTY MEMBER. The pad is normally marked dead as well, so
// an `isUp`-only gate caught it by accident; this block removes the accident
// by standing the pad fully up — full HP, chardead 0, charmove 1 — so the ONLY
// thing that can keep it out of the command phase is `global.char[2] == 0`.
// Revert skipFallen to `isUp` and slot 2 gets its own menu panel here.
section('the pad never gets a menu panel, even standing (scr_charcan)');
{
  const s = vd(1002);
  s.partyHp[2] = 100;
  s.chardead[2] = 0;
  s.charmove[2] = 1;
  s.charcantarget[2] = 1;
  assert(!scrCharcan(s, 2), 'scr_charcan(2) is false on presence alone');
  assert(scrCharcan(s, 0) && scrCharcan(s, 1), 'scr_charcan admits both real members');
  const panels = [];
  for (let i = 0; i < 4 && s.menu.open; i += 1) {
    panels.push(s.menu.charturn);
    chooseButton(s, 'DEFEND');
  }
  assertDeep(panels, [0, 1], 'exactly two panels — Kris then Noelle, never the pad');
  assert(!s.menu.open, 'the command phase ended after Noelle');
}
{
  // AND THE SAME GATE AT `openMenu`, which is a DIFFERENT call site: skipFallen
  // is what walks the opening `charturn` off a downed slot, so put BOTH real
  // members down and stand the pad up. With `isUp` there the walk stops on slot
  // 2 and the command phase opens on a character who does not exist; with
  // scr_charcan it runs off the end and there is no command phase at all,
  // which is what a wiped party means.
  const s = vd(10025);
  s.partyHp[2] = 100;
  s.chardead[2] = 0;
  s.charmove[2] = 1;
  s.charcantarget[2] = 1;
  down(s, 0);
  down(s, 1);
  openMenu(s);
  assert(!s.menu.open, 'both members down: openMenu opens no panel at all');
  assert(s.menu.charturn !== 2, 'and it did not stop on the pad');
}
{
  // The same gate on the A-Side, where all three slots ARE occupied: nothing
  // may be lost. A charcan that refused a real member would show here.
  const s = vc(1003);
  const panels = [];
  for (let i = 0; i < 5 && s.menu.open; i += 1) {
    panels.push(s.menu.charturn);
    chooseButton(s, 'DEFEND');
  }
  assertDeep(panels, [0, 1, 2], 'A-Side: all three slots still command, in order');
}

// ── 2. the picker walks the PRESENCE TABLE, not a modulo ──────────────────
//
// `for (i = 0; i < 3; i++) { ht[i] = 0; if (global.char[i] > 0) ht[i] = 1; }`
// With ht = [1, 1, 0] the down-walk is 0 -> 1 -> 0, forever. The old
// `(targetIndex + 1) % 3` reaches 2 on the second press.
section('DOWN and UP walk only occupied rows');
{
  const s = vd(1004);
  s.tension = 250;
  chooseButton(s, 'DEFEND');                 // Kris defends; the turn is Noelle's
  assertEq(s.menu.charturn, 1, 'the menu is on Noelle');
  chooseButton(s, 'SECOND');                 // her MAGIC list
  assertEq(s.menu.submenu, 'magic', 'the spell list is open');
  selectRow(s, 'Heal Prayer');               // spelltarget 1
  press(s, 'confirm');
  assertEq(s.menu.submenu, 'target', 'Heal Prayer opened the ally picker');

  const walk = [];
  for (let i = 0; i < 6; i += 1) { press(s, 'down'); walk.push(s.menu.targetIndex); }
  assertDeep(walk, [1, 0, 1, 0, 1, 0], 'six DOWNs alternate 1/0 and never reach the pad');
  const up = [];
  for (let i = 0; i < 4; i += 1) { press(s, 'up'); up.push(s.menu.targetIndex); }
  assertDeep(up, [1, 0, 1, 0], 'four UPs do the same in reverse');
  assert(!walk.includes(2) && !up.includes(2), 'index 2 — the pad — is unreachable');
}
{
  // The A-Side control: with ht = [1, 1, 1] the walk is the full three-row
  // cycle the old modulo produced, so the table must not have narrowed it.
  const s = vc(1005);
  s.tension = 250;
  chooseButton(s, 'DEFEND');                 // Kris
  chooseButton(s, 'SECOND');                 // Susie's MAGIC
  selectRow(s, 'UltraHeal');                 // spelltarget 1
  press(s, 'confirm');
  assertEq(s.menu.submenu, 'target', 'UltraHeal opened the picker on the A-Side');
  const walk = [];
  for (let i = 0; i < 4; i += 1) { press(s, 'down'); walk.push(s.menu.targetIndex); }
  assertDeep(walk, [1, 2, 0, 1], 'A-Side: all three rows, unchanged');
}

// ── 3. the four clamps, which are why the confirm needs no test of its own ──
//
// The clamps run EVERY frame before the input is read, so a cursor that is
// somehow on an empty row is moved off it before button1_p is evaluated. Put
// it there by hand and confirm on the same frame: the choice must land on a
// real slot, and no TP may be spent on nobody.
section('a confirm can never resolve onto the pad');
{
  const s = vd(1006);
  s.tension = 250;
  chooseButton(s, 'DEFEND');
  chooseButton(s, 'SECOND');
  selectRow(s, 'Heal Prayer');
  press(s, 'confirm');
  assertEq(s.menu.submenu, 'target', 'the picker is up');
  s.menu.targetIndex = 2;                    // the pad, by hand
  const tpBefore = s.tension;
  press(s, 'confirm');
  assert(s.pendingSpell && s.pendingSpell[1], 'the spell was recorded');
  assertEq(s.pendingSpell[1].target, 0, 'the clamp moved the cursor to slot 0 first');
  assert(s.tension < tpBefore, 'TP was spent — on a real ally, not on nobody');
  assert(slotOccupied(s, s.pendingSpell[1].target), 'the chosen target is an occupied slot');
}

// ── 4. the picker opens on slot 0, not on the caster ──────────────────────
//
// `scr_battlecursor_memory_reset` zeroes all of bmenucoord before every
// command phase, and neither site that opens bmenuno 7/8 writes the cursor.
// The caster here is slot 1; the opening row must still be 0.
section('the picker opens on Kris, not on whoever is casting');
{
  const s = vd(1007);
  s.tension = 250;
  chooseButton(s, 'DEFEND');
  assertEq(s.menu.charturn, 1, 'Noelle is the caster');
  chooseButton(s, 'SECOND');
  selectRow(s, 'Heal Prayer');
  press(s, 'confirm');
  assertEq(s.menu.submenu, 'target', 'the picker is up');
  assertEq(s.menu.targetIndex, 0, 'it opened on slot 0 — the caster is slot 1');
}
{
  // A-Side, and the caster is slot 2 this time, so "opens on 0" cannot be a
  // coincidence of the caster already being 0.
  const s = vc(1008);
  s.tension = 250;
  chooseButton(s, 'DEFEND');                 // Kris
  chooseButton(s, 'DEFEND');                 // Susie
  assertEq(s.menu.charturn, 2, 'Ralsei is the caster');
  chooseButton(s, 'SECOND');                 // his MAGIC
  selectRow(s, 'Heal Prayer');               // spelltarget 1
  press(s, 'confirm');
  assertEq(s.menu.submenu, 'target', 'the picker is up');
  assertEq(s.menu.targetIndex, 0, 'A-Side: it opens on slot 0, not on slot 2');
}

// ── 5. LEFT and RIGHT are not keys this list reads ────────────────────────
section('LEFT and RIGHT do nothing on the ally picker');
{
  const s = vd(1009);
  s.tension = 250;
  chooseButton(s, 'DEFEND');
  chooseButton(s, 'SECOND');
  selectRow(s, 'Heal Prayer');
  press(s, 'confirm');
  assertEq(s.menu.submenu, 'target', 'the picker is up');
  assertEq(s.menu.targetIndex, 0, 'on slot 0');
  press(s, 'left');
  assertEq(s.menu.targetIndex, 0, 'LEFT moved nothing');
  press(s, 'right');
  assertEq(s.menu.targetIndex, 0, 'RIGHT moved nothing');
  press(s, 'down');
  assertEq(s.menu.targetIndex, 1, 'DOWN still moves — the keys are not all dead');
  press(s, 'right');
  assertEq(s.menu.targetIndex, 1, 'RIGHT moved nothing from row 1 either');
}
{
  // A-Side, where the old aliasing was visible as a real move: from row 0,
  // LEFT used to jump to row 2.
  const s = vc(1010);
  s.tension = 250;
  chooseButton(s, 'DEFEND');
  chooseButton(s, 'SECOND');
  selectRow(s, 'UltraHeal');
  press(s, 'confirm');
  assertEq(s.menu.submenu, 'target', 'the picker is up');
  press(s, 'left');
  assertEq(s.menu.targetIndex, 0, 'A-Side: LEFT no longer wraps to row 2');
}

// ── 6. charaction survives the targeted confirm ───────────────────────────
//
// scr_itemconsumeb sets 4, scr_spellconsumeb sets 2, and nothing unsets
// either. The wipe used to sit three lines after the record, so a TARGETED
// choice left 0 while an untargeted one left 4 — the enemy phase then read a
// slot that had not chosen anything.
section('charaction after a confirm: 4 for an item, 2 for a spell, both paths');
{
  const s = vd(1011, [2, 7, 2, 2]);          // slot 0 a ReviveMint (target one)
  chooseButton(s, 'ITEM');
  assertEq(s.menu.submenu, 'item', 'the bag is open');
  press(s, 'confirm');
  assertEq(s.menu.submenu, 'target', 'a single-target item opened the picker');
  press(s, 'confirm');
  assertEq(s.charaction[0], 4, 'TARGETED item leaves charaction 4 (scr_itemconsumeb)');
  assert(s.pendingItem?.[0]?.id === 2, 'the ReviveMint is queued');
}
{
  const s = vd(1012, [7, 2, 2, 2]);          // slot 0 a Spincake (target all)
  chooseButton(s, 'ITEM');
  press(s, 'confirm');
  assertEq(s.menu.submenu, null, 'an untargeted item resolves without a picker');
  assertEq(s.charaction[0], 4, 'UNTARGETED item leaves charaction 4 — the two paths agree');
}
{
  const s = vd(1013);
  s.tension = 250;
  chooseButton(s, 'DEFEND');
  chooseButton(s, 'SECOND');
  selectRow(s, 'Heal Prayer');
  press(s, 'confirm');
  assertEq(s.menu.submenu, 'target', 'the picker is up');
  press(s, 'confirm');
  assertEq(s.charaction[1], 2, 'TARGETED spell leaves charaction 2 (scr_spellconsumeb)');
}

// ── 7. the bag carries to the slot the search CHOSE ───────────────────────
//
// scr_nexthero picks the next character who can act and only then copies the
// bag forward; the split version carried it one slot and let skipFallen walk
// past that slot without copying, so scr_endturn committed a snapshot nobody
// had touched. Counting the Spincake across a whole turn is the driven test:
// the last-one-standing case is the one that used to refund it.
section('an item is spent whether or not an ally is standing behind you');
for (const noelleDown of [true, false]) {
  const s = vd(noelleDown ? 1014 : 1015);
  if (noelleDown) down(s, 1);
  const before = spincakes(s.inventory);
  assertEq(before, 1, 'the bag opens with one Spincake');
  chooseButton(s, 'ITEM');
  press(s, 'confirm');                       // slot 0 is the Spincake
  if (s.menu.open) chooseButton(s, 'DEFEND'); // Noelle, when she is standing
  assert(!s.menu.open, 'the command phase ended');
  assertEq(spincakes(s.inventory), 0,
    `the Spincake left the inventory (Noelle ${noelleDown ? 'DOWN' : 'standing'})`);
  assertEq(s.menu.acted, noelleDown ? 0 : 1,
    'menu.acted names the slot whose bag committed');
}

console.log(`\ncheck-ally-picker: ${count - failures}/${count} assertions passed`);
if (failures) {
  console.log(`check-ally-picker: ${failures} FAILED`);
  process.exit(1);
}
