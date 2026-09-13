#!/usr/bin/env node
// KAIZO — THE ITEM MENU ON A TWO-PERSON PARTY, DRIVEN.
//
//   node kaizo/tools/checks/check-items-kaizo.mjs
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// Everything below that can be driven IS driven: `createState` ->
// `buildKaizoScene` -> `stepFrame` with real inputs through the real
// `sim/menu.js`, the real target picker and the real resolve phase. Nothing
// here calls an item effect by hand except where the note at the site says
// why, and each such site says which of the two independent fixes it is
// exercising.
//
// ── THE FIVE DEFECTS ──────────────────────────────────────────────────────
//
// (a) HEAL-ALL AND REVIVE-ALL RESURRECTED THE EMPTY THIRD SLOT. Measured
//     before the fix, through this same menu: Kris uses a Spincake with
//     hp [40, 20, 0] and chardead [0, 0, 1]; afterwards chardead is
//     [0, 0, 0], charcantarget [1, 1, 1] and charmove [1, 1, 1] — a
//     character who is not in the fight is standing and targetable, and
//     `scr_randomtarget` reads `global.charcantarget[i]` with no occupancy
//     test of its own.
//
//     The guards are the mod's, and there are TWO of them in two different
//     scripts:
//       `gml_GlobalScript_scr_healall.gml:12`      if (global.char[i] != 0)
//       `gml_GlobalScript_scr_spell.gml:511, 532`  if (global.char[__j] > 0)
//     the second being the revive-all loop of cases 230 (ReviveDust) and
//     231 (ReviveBrite). A third bound sits in `scr_healitem_all` itself:
//     its writer loop runs `i < chartotal`, not `i < 3`.
//
// (b) A SINGLE-TARGET HEAL AIMED AT SLOT 2 RAISED THE PHANTOM TOO, through
//     `applyHeal`'s own missing presence test. That is a SEPARATE fix from
//     the picker no longer offering slot 2, and this file proves it
//     separately — see the note in §5.
//
// (c) THE SIGNATURE DEFECT, INSTANCE ELEVEN. `scrHealall`,
//     `scrHealallitemspell` and `scrHealitemspell` in `kaizo/party/freeze.js`
//     were complete, correct, roster-guarded translations of the mod's three
//     heal scripts with ZERO READERS anywhere in the repo: `sim/items.js`
//     called its own `scrHealitem` / `scrHealitemAll` and no seam existed,
//     so a heal on a k_freeze'd member healed them. §6 asserts the freeze
//     BEHAVIOUR through the menu, which is false unless the engine actually
//     consults the hook — a test of the freeze functions in isolation would
//     reproduce the defect rather than catch it.
//
// (d) THE ITEM TABLE SHIPPED VANILLA NUMBERS WHERE THE MOD CHANGED THEM.
//     §7 drives LightCandy and FavSandwich and pins the rejected row.
//
// (e) THE PER-CHARACTER HEALS FOLLOWED THE SLOT, NOT THE CHARACTER — found
//     while diffing `scr_spell` for (d), and the same family as the Noelle
//     stats report. Cases 212 / 213 / 226 each branch on `global.char[star]`
//     and each has a Noelle arm; the engine's `perChar` arrays are three
//     slot-indexed entries with no room for one, so a HeartsDonut on the
//     Weird Route healed Noelle SUSIE'S 80 instead of her 30. §7b.
//
// ── WHAT MAKES EACH ASSERTION READER-SENSITIVE ────────────────────────────
//
// Deleting the hook consult in `sim/items.js` (`state.kaizo.hooks.scrHealitem`
// / `scrHealitemAll`) reddens §6. Deleting `itemInfo`'s override read reddens
// §7. Deleting the occupancy guards reddens §3, §4 and §5. Deleting
// `installKaizoHeals`'s call in `kaizo/party/roster.js` reddens §2, §6 and §7
// together. Every one of those is a READER or the WRITER going away, not a
// value being wrong.
//
// MEASURED SABOTAGE RESULTS, INCLUDING THE TWO THAT DO NOT DISCRIMINATE —
// recorded because a reader who assumes every guard here is independently
// proven would be wrong, and would find that out the expensive way:
//
//   removed from sim/items.js                            check exit
//   ---------------------------------------------------- ---------
//   applyHeal's `slotHasCharacter` presence test              1 (3 fail)
//   scrHealitemAll's writer bound `i < partySize`             1 (2 fail)
//   the scrHealitem hook consult                              1 (2 fail)
//   the scrHealitemAll hook consult                           1 (1 fail)
//   itemInfo's `state.kaizo.items` read                       1 (6 fail)
//   installKaizoHeals's call in roster.js (the WRITER)        1 (12 fail)
//   kaizo/party/items.js's perChar slot rebase                 1 (5 fail)
//   scr_healall's per-slot `global.char[i] != 0` guard        **0**
//   the revive-all loop's `global.char[__j] > 0` guard        **0**
//
// THE LAST TWO ARE REDUNDANT WITH `applyHeal`'s PRESENCE TEST IN THIS ENGINE,
// and no reachable state tells them apart: both loops reach the pad only by
// calling `applyHeal`, which refuses it and returns 0 before touching HP, the
// revive or the sound. They are transcribed anyway because they are the GML's
// own guards at the GML's own sites — exactly as the dump has it, where
// `scr_heal` likewise has no presence test of its own and every caller does.
// Removing ALL of them together (the pre-fix engine) reddens 8 assertions, so
// the class is covered even though two individual lines are not.

import { createState, stepFrame } from '../../../sim/index.js';
import {
  ITEMS, itemInfo, itemTable, applyHeal, applyItem, usableSlots, DEFAULT_BAG,
} from '../../../sim/items.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import { KAIZO_ITEMS, KAIZO_ITEMS_REJECTED, installKaizoHeals } from '../../party/items.js';
import { installRoster, WEIRD_ROUTE_PARTY } from '../../party/roster.js';

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

/** One edge press: a frame with the key down, then a frame with it up. */
function press(s, key) {
  stepFrame(s, { ...IDLE, [key]: true });
  stepFrame(s, IDLE);
}

/**
 * A V-D scene with the command phase open on frame 1. `bag` is the ITEMS
 * page's twelve slots and must be set BEFORE the first step, because
 * `openMenu` snapshots `state.inventory` into `tempitem` (sim/menu.js:553) and
 * every later read is of the snapshot.
 */
function vd({ bag = null, hp = null, dead = null, freeze = null, version = 'D' } = {}) {
  const s = createState({ seed: 12345, traceBulletSlots: 8 });
  buildKaizoScene(s, { version });
  if (bag) s.inventory = [...bag];
  stepFrame(s, IDLE);
  if (hp) for (let i = 0; i < hp.length; i++) s.partyHp[i] = hp[i];
  if (dead) s.chardead = [...dead];
  if (freeze) for (let i = 0; i < freeze.length; i++) s.kaizo.freeze[i] = freeze[i];
  return s;
}

/**
 * Walk the button row to ITEM (coord 2), open the grid, move to bag slot
 * `slot`, confirm. The grid is TWO COLUMNS over six rows — left and right are
 * the same toggle with two columns, up/down step by 2 and are CLAMPED, not
 * wrapped (sim/menu.js, "The item menu is not in the charbox"). `tgt` walks
 * the ally picker afterwards for a single-target item.
 */
function chooseItem(s, slot, tgt = null) {
  press(s, 'right'); press(s, 'right');
  press(s, 'confirm');
  const row = Math.floor(slot / 2);
  const col = slot % 2;
  for (let i = 0; i < row; i++) press(s, 'down');
  if (col) press(s, 'right');
  press(s, 'confirm');
  if (tgt !== null) {
    for (let i = 0; i < 6 && s.menu.targetIndex !== tgt; i++) press(s, 'down');
    // `onebuffer` LOCKS CONFIRM OUT FOR TWO FRAMES after the selection that
    // opened the picker (sim/menu.js, "THE BUFFERS GATE CONFIRM AND CANCEL"),
    // so a confirm pressed immediately is SEEN AND DISCARDED. Walking to a
    // different slot burns the buffer by accident; confirming the default
    // target does not, and a drive that skipped this idled its way into a
    // later frame and read `lastItem` before the menu had written it.
    settle(s);
    press(s, 'confirm');
  }
}

/** Idle frames — enough to clear `onebuffer` / `twobuffer`. */
function settle(s, n = 3) {
  for (let i = 0; i < n; i++) stepFrame(s, IDLE);
}

/**
 * Everyone left in the command phase DEFENDs, then the turn resolves.
 *
 * Returns every floating heal number that appeared while it ran. They are
 * collected frame by frame because `state.dmg.heals` is a LIVE list that
 * obj_healwriter's own step drains — reading it at the end sees nothing, which
 * is how a writer-count assertion can be green and mean nothing at all.
 */
function resolveTurn(s, frames = 60) {
  for (let guard = 0; s.menu.open && guard < 20; guard++) {
    for (let i = 0; i < 4; i++) press(s, 'right');
    press(s, 'confirm');
  }
  const seen = new Set();
  const all = [];
  for (let i = 0; i < frames; i++) {
    stepFrame(s, IDLE);
    for (const h of s.dmg?.heals ?? []) {
      if (!seen.has(h)) { seen.add(h); all.push(h); }
    }
  }
  return all;
}

const SPINCAKE = 0;       // DEFAULT_BAG[0]  = 7  Spincake     heal ALL 150
const REVIVEDUST = 8;     // DEFAULT_BAG[8]  = 30 ReviveDust   revive ALL
const DELUXE = 10;        // DEFAULT_BAG[10] = 39 DeluxeDinner heal ONE 140

// ── 0. the seams exist in the vendored engine ─────────────────────────────
section('the engine seams (sim/items.js)');
assert(typeof itemInfo === 'function' && typeof itemTable === 'function',
  'sim/items.js exports itemInfo / itemTable');
assertEq(DEFAULT_BAG[SPINCAKE], 7, 'bag slot 0 is Spincake (the loadout is what these indices assume)');
assertEq(DEFAULT_BAG[REVIVEDUST], 30, 'bag slot 8 is ReviveDust');
assertEq(DEFAULT_BAG[DELUXE], 39, 'bag slot 10 is DeluxeDinner');
{
  // With no state at all, itemInfo is the vanilla table — the fall-through
  // half of the seam, which is what keeps the vanilla tool bit-identical.
  assertEq(itemInfo(null, 23).amount, 120, 'itemInfo(null, LightCandy) is the VANILLA 120');
  assertEq(itemInfo({}, 14).name, 'Favwich', 'itemInfo({}, 14) is the VANILLA Favwich');
  assertEq(itemTable(null), ITEMS, 'itemTable(null) IS the vanilla table object');
}

// ── 1. V-C installs nothing: the A-Side and the byte gate cannot see this ──
section('inertness — V-C has no roster, so nothing is published');
{
  const c = vd({ version: 'C' });
  assert(!c.kaizo.items, 'V-C publishes no item override');
  assert(!c.kaizo.hooks?.scrHealitem && !c.kaizo.hooks?.scrHealitemAll,
    'V-C installs neither heal hook');
  assertEq(itemInfo(c, 23).amount, 120, 'V-C LightCandy is still the vanilla 120');
  // And the vanilla three-slot party still heals in all three slots.
  const st = { partyHp: [10, 10, 10], entities: [], counters: {}, frame: 0 };
  applyHeal(st, 2, 50);
  assertEq(st.partyHp[2], 60, 'no roster -> slot 2 is a real character and heals');
}

// ── 2. V-D publishes both halves ──────────────────────────────────────────
section('V-D publishes the table and the hooks (installRoster -> installKaizoHeals)');
{
  const s = vd();
  assert(!!s.kaizo.items, 'state.kaizo.items is published');
  assert(typeof s.kaizo.hooks.scrHealitem === 'function', 'hook scrHealitem installed');
  assert(typeof s.kaizo.hooks.scrHealitemAll === 'function', 'hook scrHealitemAll installed');
  assertEq(s.kaizo.roster.length, 2, 'the Weird Route roster is two members');
  assertEq(s.partyHp.length, 3, '...and partyHp is padded back out to three battle slots');
  assertEq(s.chardead[2], 1, '...with the pad marked dead');
  assertEq(s.charcantarget[2], 0, '...and untargetable');
}
{
  // The writer stands alone: installRoster is the publisher, and calling
  // installKaizoHeals twice does not double-wrap.
  const bare = {};
  installKaizoHeals(bare);
  const first = bare.kaizo.hooks.scrHealitem;
  installKaizoHeals(bare);
  assertEq(bare.kaizo.hooks.scrHealitem, first, 'installKaizoHeals is idempotent');
}

// ── 3. (a) SPINCAKE — the heal-all, driven ────────────────────────────────
section('(a) heal-all: Spincake through the real menu leaves the empty slot alone');
{
  const s = vd({ hp: [40, 20, 0], dead: [0, 0, 1] });
  const before = [...s.partyHp];
  chooseItem(s, SPINCAKE);
  assertEq(s.menu.lastItem, 'Spincake!', 'the MENU recorded a Spincake (the drive really happened)');
  assertDeep(s.pendingItem[0], { id: 7, target: 0 }, 'it is queued, not applied, at selection');
  assertDeep(s.partyHp, before, '...so nothing has healed yet');
  resolveTurn(s);
  // The positive half FIRST: if the heal did not happen, the guards below are
  // vacuous and this check would be asserting nothing.
  assertEq(s.partyHp[0], 160, 'Kris healed 40 -> his own max 160');
  assert(s.partyHp[1] > 20, `Noelle healed from 20 (now ${s.partyHp[1]})`);
  // ...and now the defect.
  assertEq(s.partyHp[2], 0, 'THE EMPTY SLOT IS STILL 0');
  assertEq(s.chardead[2], 1, '...still dead (was flipped to 0 before the fix)');
  assertEq(s.charcantarget[2], 0, '...still untargetable');
  assertEq(s.charmove[2], 0, '...still immobile');
}

// ── 3b. THE ENGINE HALF, WITH THE HOOK TAKEN AWAY ─────────────────────────
//
// `sim/items.js` is SHARED, and the kaizo hook is installed only on a version
// that installs a roster — so its own loops have to be right whether or not
// anything is hooked in front of them. This block drives the same Spincake on
// a real V-D state with the hooks deleted, which is the only way to reach
// `scrHealitemAll`'s own two loops at all.
//
// AND IT IS THE ONE PLACE THE WRITER BOUND IS OBSERVABLE. `scr_healitem_all`
// spawns its floating green numbers over `i < chartotal`, not `i < 3`
// (gml_GlobalScript_scr_healitem_all.gml:4) — so the pad gets no number
// either. `applyHeal`'s presence test cannot cover that: a writer is spawned
// whether or not the heal moved anything.
section('(a) the engine\'s own loops, hook removed — the writer bound included');
{
  const s = vd({ hp: [40, 20, 0], dead: [0, 0, 1] });
  delete s.kaizo.hooks.scrHealitemAll;
  delete s.kaizo.hooks.scrHealitem;
  chooseItem(s, SPINCAKE);
  const heals = resolveTurn(s);
  assertEq(s.partyHp[0], 160, 'Kris still heals through the engine\'s own scrHealitemAll');
  assertEq(s.partyHp[2], 0, '...the pad does not');
  assertEq(s.chardead[2], 1, '...and is not revived');
  assertEq(heals.length, 2, 'TWO green numbers, not three — the `i < chartotal` writer bound');
  assertDeep(heals.map((h) => h.healamt), [150, 150], '...one per character, at the requested amount');
}

// ── 4. (a) REVIVEDUST — the second guard, a different script ──────────────
section('(a) revive-all: ReviveDust through the real menu leaves the empty slot alone');
{
  const s = vd({ hp: [40, -999, 0], dead: [0, 1, 1] });
  chooseItem(s, REVIVEDUST);
  assertEq(s.menu.lastItem, 'ReviveDust!', 'the MENU recorded a ReviveDust');
  resolveTurn(s);
  // scr_spell case 230: standing members get a token 10, a downed one gets
  // ceil(maxhp / 4) + abs(hp) — Noelle's 120/4 = 30 out of -999.
  assertEq(s.partyHp[0], 50, 'Kris, standing, gets the token 10');
  assertEq(s.partyHp[1], 30, 'Noelle is revived to a quarter of HER 120, not Susie\'s 190');
  assertEq(s.chardead[1], 0, '...and stands up');
  assertEq(s.partyHp[2], 0, 'THE EMPTY SLOT IS STILL 0');
  assertEq(s.chardead[2], 1, '...still dead');
  assertEq(s.charcantarget[2], 0, '...still untargetable');
}

// ── 5. (b) A SINGLE-TARGET HEAL AIMED AT SLOT 2 ───────────────────────────
//
// THIS IS THE ONE FIX IN THIS FILE THE MENU CANNOT DRIVE END TO END ANY MORE,
// and that is the point of asserting it separately. The ally picker no longer
// offers slot 2 (a separate lane's fix, asserted here as a control), so the
// only way to aim an item at the pad is to hand the resolve phase a pending
// item that names it. `applyHeal` refusing is what makes the two fixes
// independent: put the picker back and nothing below changes.
section('(b) a single-target heal cannot raise the pad, picker or no picker');
{
  const s = vd({ hp: [40, 20, 0], dead: [0, 0, 1] });
  chooseItem(s, DELUXE, 2);
  // CONTROL, and it is the other lane's assertion, not this one's: the picker
  // walked the occupied slots and never landed on 2.
  assert(s.pendingItem[0].target !== 2,
    `the picker refused slot 2 (landed on ${s.pendingItem[0].target})`);
  // Now aim it there anyway, and let the ENGINE'S OWN resolve phase run it.
  s.pendingItem[0] = { id: 39, target: 2 };
  const before = [...s.partyHp];
  const heals = resolveTurn(s);
  assertEq(s.partyHp[2], before[2], 'a DeluxeDinner resolved on slot 2 moves no HP');
  assertEq(heals.length, 0, '...and puts no green number over a slot with nobody in it');
  assertEq(s.chardead[2], 1, '...and does not stand the pad up');
  assertEq(s.charcantarget[2], 0, '...or make it targetable');
}
{
  // The guard itself, at the funnel, with no menu in the way — so a future
  // caller that reaches applyHeal by another route is covered too.
  const s = vd({ hp: [40, 20, 0], dead: [0, 0, 1] });
  assertEq(applyHeal(s, 2, 999), 0, 'applyHeal on the pad returns 0');
  assertEq(s.partyHp[2], 0, '...and writes nothing');
  assertEq(s.chardead[2], 1, '...and does not revive');
  assert(applyHeal(s, 1, 50) > 0, 'CONTROL: applyHeal on Noelle still heals');
}

// ── 6. (c) THE FREEZE GATE — the hook's reader is what makes this true ────
section('(c) k_freeze: freeze.js\'s heal scripts are REACHED, not merely written');
{
  // A frozen Kris. `scr_healitemspell` returns false before healing, before
  // the animation and before the number, and the item is already spent —
  // the action is WASTED, not refused (gml_GlobalScript_scr_healitemspell.gml:3-9).
  const s = vd({ hp: [40, 20, 0], dead: [0, 0, 1], freeze: [true, false] });
  chooseItem(s, DELUXE, 0);
  assertEq(s.menu.lastItem, 'DeluxeDinner!', 'the menu recorded a DeluxeDinner on Kris');
  resolveTurn(s);
  assertEq(s.partyHp[0], 40, 'A FROZEN KRIS IS NOT HEALED — the hook ran');
  assertEq(s.kaizo.spelldelay, 15, '...and the GML\'s global.spelldelay = 15 was written');
}
{
  // CONTROL, the same drive with nobody frozen: this is what says the
  // assertion above is about the freeze and not about the item being broken.
  const s = vd({ hp: [40, 20, 0], dead: [0, 0, 1] });
  chooseItem(s, DELUXE, 0);
  resolveTurn(s);
  assertEq(s.partyHp[0], 160, 'CONTROL: an unfrozen Kris IS healed by the same drive');
}
{
  // The all-heal's skip is PER MEMBER, not the whole party: scr_healall
  // continues past a frozen slot rather than breaking out (the broken one is
  // scr_spell case 6, which freeze.js preserves separately).
  const s = vd({ hp: [40, 20, 0], dead: [0, 0, 1], freeze: [false, true] });
  chooseItem(s, SPINCAKE);
  resolveTurn(s);
  assertEq(s.partyHp[0], 160, 'Spincake still heals Kris while Noelle is frozen');
  assertEq(s.partyHp[1], 20, '...and Noelle, frozen, is skipped');
  assertEq(s.partyHp[2], 0, '...and the pad is untouched either way');
}

// ── 7. (d) THE ITEM TABLE ─────────────────────────────────────────────────
section('(d) the mod\'s scr_itemuse / scr_iteminfo deltas, driven');
{
  const s = vd({ bag: [23, 14, 7, 39, 39, 39, 39, 39, 39, 39, 39, 39], hp: [40, 20, 0], dead: [0, 0, 1] });
  assertEq(itemInfo(s, 23).amount, 200, 'LightCandy is 200 in the kaizo fight');
  assertEq(itemInfo(s, 23).desc, 'Heals#200HP', '...and its description says so (scr_iteminfo:181)');
  chooseItem(s, 0, 0);
  resolveTurn(s);
  // 40 + 200 = 240, clamped to Kris's 160. The number that discriminates the
  // two is the REFUSAL below, so assert both.
  assertEq(s.partyHp[0], 160, 'a LightCandy on Kris at 40 fills him');
}
{
  // The discriminating drive: Kris at 1, healed by exactly the item's amount.
  // 1 + 120 = 121 (vanilla) vs 1 + 200 = 201 -> clamped 160 (the mod).
  const s = vd({ bag: [23, 7, 39, 39, 39, 39, 39, 39, 39, 39, 39, 39], hp: [1, 20, 0], dead: [0, 0, 1] });
  chooseItem(s, 0, 0);
  resolveTurn(s);
  assert(s.partyHp[0] === 160, `LightCandy 200 fills Kris from 1 (got ${s.partyHp[0]}; the vanilla 120 would leave 121)`);
}
{
  const s = vd({ bag: [14, 7, 39, 39, 39, 39, 39, 39, 39, 39, 39, 39], hp: [1, 1, 0], dead: [0, 0, 1] });
  assertEq(itemInfo(s, 14).name, 'FavSandwich', 'Favwich is renamed FavSandwich (scr_iteminfo:116)');
  assertEq(itemInfo(s, 14).amount, 5000, '...and heals 5000 (scr_itemuse:261)');
  chooseItem(s, 0, 0);
  // WHAT THE MENU STILL SHOWS, AND WHOSE IT IS. `recordItem` and the list
  // rows in `sim/menu.js` index `ITEMS[id]` directly, so the confirmation
  // line and the ITEM list still read "Favwich" — the vanilla name — while
  // the EFFECT is the mod's 5000. That file belongs to the menu lane;
  // `itemInfo` is the function it should be reading and this is the assertion
  // that says the drive got that far. NOT pinned to the vanilla spelling on
  // purpose: the day the menu is moved onto `itemInfo` this must keep
  // passing, not start failing.
  assert(typeof s.menu.lastItem === 'string' && s.menu.lastItem.length > 0,
    `the menu recorded the item (shows ${JSON.stringify(s.menu.lastItem)} — sim/menu.js still reads ITEMS directly)`);
  resolveTurn(s);
  assertEq(s.partyHp[0], 160, '...and it fills Kris from 1');
  // applyItem's own log line goes through itemInfo too.
  const t = vd({ hp: [1, 1, 0], dead: [0, 0, 1] });
  assert(String(applyItem(t, 14, 0)).startsWith('FavSandwich:'), 'applyItem names it FavSandwich');
}
{
  // THE REJECTED ROW. Spincake's mod hunk is official churn reversed — the
  // mod inherited v0.0.091's older three-`if` shape, and the Chapter 4+ retail
  // build carries the same 140 at chapter 3, so 150 is what this engine's
  // reference build (Chapter 3 v1.03) does and 150 is what stays.
  assert(!('7' in KAIZO_ITEMS) && !(7 in KAIZO_ITEMS),
    'KAIZO_ITEMS does not override Spincake');
  assert(!!KAIZO_ITEMS_REJECTED[7], '...and the rejection is recorded with its reason');
  assert(/churn/i.test(KAIZO_ITEMS_REJECTED[7].reason), '...naming it as churn');
  const s = vd({ hp: [1, 1, 0], dead: [0, 0, 1] });
  assertEq(itemInfo(s, 7).amount, 150, 'Spincake is still the Chapter 3 retail 150');
  chooseItem(s, SPINCAKE);
  resolveTurn(s);
  assertEq(s.partyHp[0], 151, '...and heals 1 -> 151, not 141');
}
{
  // The override is EXACTLY the mod's two edited ids plus the three
  // per-character ones — the "and nothing else" half, which is what catches a
  // churn hunk being folded in later.
  const s = vd();
  assertDeep(Object.keys(s.kaizo.items).map(Number).sort((a, b) => a - b), [12, 13, 14, 23, 26],
    'the override names exactly ids 12, 13, 14, 23, 26');
  assertEq(itemTable(s)[39].amount, 140, 'every other id falls through to the vanilla table');
  assertEq(KAIZO_ITEMS[12], undefined, 'ids 12/13/26 are NOT mod edits — they are the slot rebase');
}

// ── 7b. THE PER-CHARACTER HEALS ───────────────────────────────────────────
//
// scr_spell cases 212 / 213 / 226 branch on `global.char[star]`, a CHARACTER
// id, and each has a Noelle arm. The engine's `perChar` arrays are
// SLOT-indexed with three entries, so with `global.char = [1, 4, 0]` Noelle
// took Susie's number. Byte-identical between the mod and v105 — this is the
// game's own table missing a fourth row, not something EnderCat8 changed.
section('per-character heals follow the CHARACTER, not the slot');
{
  // The Weird Route: HeartsDonut is 20 for Kris and THIRTY for Noelle.
  const s = vd({ bag: [12, 7, 39, 39, 39, 39, 39, 39, 39, 39, 39, 39], hp: [1, 1, 0], dead: [0, 0, 1] });
  assertDeep(itemInfo(s, 12).perChar, [20, 30, 0], 'HeartsDonut: Kris 20, Noelle 30, nobody 0');
  assertDeep(itemInfo(s, 13).perChar, [80, 70, 0], 'ChocDiamond: Kris 80, Noelle 70');
  assertDeep(itemInfo(s, 26).perChar, [100, 90, 0], 'JavaCookie: Kris 100, everyone else 90');
  assertDeep(ITEMS[12].perChar, [20, 80, 50], 'CONTROL: the engine literal is still Kris/Susie/Ralsei');
  // Driven: Noelle at 1 HP takes exactly 30.
  chooseItem(s, 0, 1);
  resolveTurn(s);
  assertEq(s.partyHp[1], 31, 'a HeartsDonut on Noelle heals 30 (Susie\'s 80 would give 81)');
}
{
  // A THREE-PERSON kaizo party rebuilds the engine's own arrays value for
  // value, so the rebase cannot be a change in disguise.
  const st = { partyHp: [0, 0, 0], entities: [], counters: {}, frame: 0 };
  installRoster(st, { charIds: [1, 2, 3], sideb: false });
  assertDeep(itemInfo(st, 12).perChar, ITEMS[12].perChar, '[1,2,3] -> HeartsDonut is the vanilla array');
  assertDeep(itemInfo(st, 13).perChar, ITEMS[13].perChar, '[1,2,3] -> ChocDiamond is the vanilla array');
  assertDeep(itemInfo(st, 26).perChar, ITEMS[26].perChar, '[1,2,3] -> JavaCookie is the vanilla array');
}

// ── 8. usableSlots on a two-person party ──────────────────────────────────
section('the grey-out reads the roster, not the pad');
{
  const s = vd({ hp: [160, 120, 0], dead: [0, 0, 1] });
  const u = usableSlots(s);
  assertEq(u[REVIVEDUST], false, 'nobody down -> ReviveDust greys out (the pad is not "down")');
  assertEq(u[SPINCAKE], false, '...and a full party greys out Spincake');
  const hurt = vd({ hp: [160, 60, 0], dead: [0, 0, 1] });
  assertEq(usableSlots(hurt)[SPINCAKE], true, 'CONTROL: Noelle hurt -> Spincake is offered');
  const down = vd({ hp: [160, -999, 0], dead: [0, 1, 1] });
  assertEq(usableSlots(down)[REVIVEDUST], true, 'CONTROL: Noelle down -> ReviveDust is offered');
}

// ── 9. installRoster stands alone ─────────────────────────────────────────
section('installRoster publishes the seams without buildKaizoScene');
{
  const st = { partyHp: [0, 0, 0], entities: [], counters: {}, frame: 0 };
  installRoster(st, { charIds: WEIRD_ROUTE_PARTY, sideb: true });
  assert(!!st.kaizo.items, 'installRoster alone publishes the item override');
  assert(typeof st.kaizo.hooks.scrHealitemAll === 'function', '...and the hooks');
}

console.log(`\ncheck-items-kaizo: ${count - failures}/${count} assertions passed`);
process.exit(failures ? 1 : 0);
