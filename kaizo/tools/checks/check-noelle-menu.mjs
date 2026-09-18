#!/usr/bin/env node
// KAIZO V-D — NOELLE'S MENU. Positive assertions on what the command phase
// offers a Kris + Noelle party, against the GML constants, through the
// ENGINE'S OWN MENU (sim/menu.js stepMenu driven by inputs), not through
// the kaizo module alone — so a green here means the seam is wired, not
// merely that the data exists.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE of every expectation:
//   gml_GlobalScript_scr_gamestart.gml            :197-204  spell[4] = 2, 8, 9
//   gml_GlobalScript_scr_spellinfo.gml            :95-128   names, descb, costs, targets
//   gml_GlobalScript_scr_spellconsumeb.gml        :3        the TP actually deducted
//   gml_GlobalScript_scr_monstersetup.gml         :1855-1868 Check / HoldBreath / N-Action
//   gml_Object_obj_knight_enemy_Step_0.gml        :42-53 X-Slash row; :950-963 CHECK;
//                                                  :964-978 HoldBreath; :1252-1274 N-Action
//   gml_Object_obj_knight_enemy_Other_23.gml      :1-9 the CHECK strings
//   gml_Object_obj_battlecontroller_Step_0.gml    :1099-1113 canpress; :1163-1170 confirm + TP
//   gml_Object_obj_battlecontroller_Draw_0.gml    :1173-1192, :1223, :1257-1296 the greyed heads
//
// Every block asserts what the feature ADDS, so deleting it fails loudly:
//   - the seam exists in the vendored engine (spellInfo / spellListFor /
//     actsFor / hooks) and V-C installs NOTHING into it (inertness)
//   - slot 1 on V-D lists Heal Prayer / SleepMist / IceShock, not Susie's
//     Rude Buster / UltraHeal; its ACT row is N-Action, not S-Action
//   - costs: IceShock 20 with the ThornRing, 40 without; SnowGrave 250 / 500;
//     every reachable cost survives scr_spellconsumeb's percent rounding
//   - X-Slash is on Kris's grid at index 2 with cost 62.5, unusable while
//     Noelle stands, usable once she is down AND the bar has 62.5
//   - selecting it through the real menu charges 62.5 and queues the act
//   - the acting blocks: CHECK B-Side pages, the mod's HoldBreath repeat
//     line, N-Action's one B-Side page / three A-Side pages, nactcount
//   - the greyed-head strip data follows hp and havechar
//
//     node kaizo/tools/checks/check-noelle-menu.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import * as simSpells from '../../../sim/spells.js';
import { listRows, BUTTONS } from '../../../sim/menu.js';
import { MAX_TENSION } from '../../../sim/tension.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import { installRoster, WEIRD_ROUTE_PARTY, CHAR_KRIS, CHAR_NOELLE } from '../../party/roster.js';
import {
  NOELLE_GEAR_SNOWRING, NOELLE_GEAR_THORNRING, NOELLE_SPELLS, THORN_RING,
  NOELLE_FRESH_FILE, scrSignParty,
} from '../../party/noelle.js';
import {
  SPELLS_BY_CHAR, KAIZO_SPELL_INFO, kaizoSpellList, kaizoSpellCost, scrSpellconsumebTp,
  kaizoActList, xslashRow, xslashCanpress, XSLASH_ACT, XSLASH_ACT_INDEX, xslashGridHeads,
  kaizoResolveActPages, CHECK_PAGES, HOLDBREATH_PAGES, NACTION_PAGES, NOELLE_HOLDBREATH_PAGES,
  XSLASH_PAGES, installKaizoMenu, C_GRAY, C_WHITE_NEG,
} from '../../party/spells.js';

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

function vd(seed = 12345) {
  const s = createState({ seed, traceBulletSlots: 8 });
  buildKaizoScene(s, { version: 'D' });
  return s;
}

/** One edge press: a frame with the key down, then a frame with it up. */
function press(s, key) {
  stepFrame(s, { ...IDLE, [key]: true });
  stepFrame(s, IDLE);
}

function rowsFor(s, slot, submenu) {
  return listRows({ ...s, menu: { ...s.menu, charturn: slot, submenu } });
}

// ── 1. the seam exists, and V-C installs nothing into it ───────────────────
section('the character-table seam (sim/spells.js)');
assert(typeof simSpells.spellInfo === 'function' && typeof simSpells.spellListFor === 'function'
  && typeof simSpells.actsFor === 'function', 'sim/spells.js exports spellInfo / spellListFor / actsFor');
{
  const c = createState({ seed: 5, traceBulletSlots: 8 });
  buildKaizoScene(c, { version: 'C' });
  const h = c.kaizo.hooks ?? {};
  // V-C INSTALLS EXACTLY ONE HOOK, AND THIS ASSERTION USED TO FORBID IT.
  //
  // It read `!h.resolveActPages` too, pinning the state in which the mod's
  // S-Action rewrite reached NO player: `installKaizoMenu` is party-gated and
  // `party` is version D alone, so V-C — the only version with a Susie to
  // perform S-Action — never installed it, and V-D installed it with no Susie.
  // The act pages are character-keyed (`charIdOf`) and need no roster, so they
  // are installed for every kaizo version now.
  //
  // What the A-Side must still NOT have is everything the roster feeds. That
  // is the real invariant and it is what is asserted here — a widened install
  // that dragged the slot tables in with it fails this line.
  assert(typeof h.resolveActPages === 'function',
    'V-C installs the act-pages hook (character-keyed, needs no roster)');
  assert(!h.spellList && !h.actList && !h.spellInfo && !h.castSpell,
    'V-C installs NO roster-fed hook (the A-Side keeps the slot tables)');
  assertDeep(simSpells.spellListFor(c, 1), simSpells.SPELL_LIST[1], 'V-C slot 1 spell list is the vanilla table');
  assertDeep(simSpells.actsFor(c, 1).map((a) => a.name), ['S-Action'], 'V-C slot 1 ACT is S-Action');
  assertEq(simSpells.spellCost(c, 1, 4), 125, 'V-C Rude Buster still costs 125 through the seam');
  assert(!c.entities.some((e) => e.type.name === 'kaizo_spell_controller'),
    'V-C spawns no spell controller');
}

// ── 2. V-D: the hooks are installed and the rows are Noelle's ──────────────
section('V-D slot 1 is NOELLE, not Susie');
{
  const s = vd();
  stepFrame(s, IDLE);
  assert(s.menu.open, 'the command phase opened on frame 1');
  for (const k of ['spellInfo', 'spellList', 'actList', 'spellCost', 'castSpell', 'resolveActPages', 'actBusy']) {
    assert(!!s.kaizo.hooks[k], `hook ${k} installed`);
  }
  // THE SHIPPED V-D LIST IS FOUR, NOT THREE. scr_gamestart:202-204 still hands
  // out exactly [2, 8, 9] — NOELLE_SPELLS below is that claim, unchanged — and
  // the Weird Route scene grants spell 10 on top of it, because SnowGrave
  // arrives on the save file (scr_load_chapter2.gml:170) and not from this
  // chapter's gamestart. kaizo/scenes/kaizo-fight.js has the reasoning at the
  // grant.
  assertDeep(kaizoSpellList(s, 1), [2, 8, 9, 10],
    'global.spell[4] = the gamestart 2, 8, 9 plus the transferred SnowGrave');
  assertDeep(kaizoSpellList(s, 0), [7], 'global.spell[1] = 7 — Kris\'s "MAGIC" is ACT');
  assertDeep(kaizoSpellList(s, 2), [], 'the empty slot has no list');
  assertDeep(SPELLS_BY_CHAR[4], NOELLE_SPELLS, 'SPELLS_BY_CHAR[4] agrees with noelle.js');
  const magic = rowsFor(s, 1, 'magic');
  assertDeep(magic.map((r) => r.label), ['N-Action', 'Heal Prayer', 'SleepMist', 'IceShock', 'SnowGrave'],
    'MAGIC rows for slot 1 — the ACT row first (scr_spellmenu_setup), then the spells');
  assertDeep(magic.map((r) => r.descb), [' ', 'Heal#Ally', 'Spare#TIRED foes', 'Damage#w/ ICE', 'Fatal'],
    "the act row's reset space, then spelldescb per scr_spellinfo cases 2 / 8 / 9 / 10");
  assertDeep(magic.filter((r) => !r.act).map((r) => r.id), [2, 8, 9, 10], 'row ids are the spell ids');
  assertDeep(magic.map((r) => !!r.act), [true, false, false, false, false],
    "exactly one row carries scr_spellmenu_setup's -1 act marker, and it is first");
  // THE ACT ROW IS NOT A SPELL AND DOES NOT GREY. scr_spellmenu_setup gives it
  // cost 0 and the -1 marker; only the four spells answer to the TP check, and
  // an unaffordable one is drawn c_gray rather than hidden.
  assert(magic.filter((r) => !r.act).every((r) => r.usable === false),
    'all four spells greyed at 0 TP (shown, not hidden)');
  assert(magic.find((r) => r.act)?.usable !== false, 'the ACT row stays usable at 0 TP');
  const acts = rowsFor(s, 1, 'actgrid');
  assertDeep(acts.map((r) => r.label), ['N-Action'], 'ACT row for slot 1 is N-Action (scr_monstersetup:1866-1868)');
  const btn = BUTTONS[1].name;
  assertEq(typeof btn === 'function' ? btn(1) : btn, 'MAGIC', 'button 1 reads MAGIC for slot 1');
  assertEq(simSpells.spellInfo(s, 10).name, 'SnowGrave', 'spellInfo reaches the added id 10');
  assertEq(simSpells.spellInfo(s, 4).name, 'Rude Buster', 'spellInfo still reaches the vanilla ids');
  assertEq(KAIZO_SPELL_INFO[10].cost, MAX_TENSION * 2, 'SnowGrave base cost = maxtension * 2');
  assertEq(KAIZO_SPELL_INFO[9].target, 2, 'IceShock spelltarget 2 (an enemy — no ally picker)');
  assertEq(KAIZO_SPELL_INFO[8].target, 0, 'SleepMist spelltarget 0');
  assertEq(KAIZO_SPELL_INFO[10].target, 0, 'SnowGrave spelltarget 0');
}

// ── 3. costs ────────────────────────────────────────────────────────────────
section('costs — scr_spellinfo:103-128 and scr_spellconsumeb:3');
{
  const s = vd();
  stepFrame(s, IDLE);
  assertEq(s.kaizo.roster[1].gear.weapon, THORN_RING, 'the Weird Route Noelle wears the ThornRing (roster default)');
  assertEq(simSpells.spellCost(s, 1, 9), 20, 'IceShock 40 -> 20 with charweapon[4] == 13');
  assertEq(simSpells.spellCost(s, 1, 10), MAX_TENSION, 'SnowGrave maxtension*2 -> maxtension with the ring (250)');
  assertEq(simSpells.spellCost(s, 1, 2), 80, 'Heal Prayer 80 (unchanged)');
  assertEq(simSpells.spellCost(s, 1, 8), 80, 'SleepMist 80');
  s.kaizo.gear = { 4: { ...NOELLE_GEAR_SNOWRING } };
  assertEq(simSpells.spellCost(s, 1, 9), 40, 'IceShock 40 with the SnowRing');
  assertEq(simSpells.spellCost(s, 1, 10), MAX_TENSION * 2, 'SnowGrave 500 with the SnowRing — never affordable on a 250 bar');
  assertEq(kaizoSpellCost(s, 1, 2), undefined, 'the cost hook hands ids it does not own back to the table');
  s.kaizo.gear = { 4: { ...NOELLE_GEAR_THORNRING } };
  // scr_spellconsumeb: floor(floor(cost/max*100)*2.5) — must equal the raw
  // cost the sim subtracts, for every cost the fight can reach.
  for (const cost of [20, 40, 80, 125, 225, 250, 500]) {
    assertEq(scrSpellconsumebTp(cost, MAX_TENSION), cost, `scr_spellconsumeb deducts exactly ${cost} for cost ${cost}`);
  }
  assertEq(scrSpellconsumebTp(21, MAX_TENSION), 20, '...and would floor an off-grid cost (21 -> 20): the check is not vacuous');
  s.tension = 20;
  const magic = rowsFor(s, 1, 'magic');
  assertDeep(magic.filter((r) => !r.act).map((r) => r.usable), [false, false, true, false],
    'at 20 TP only IceShock lights up');
}

// ── 4. X-Slash on Kris's grid ───────────────────────────────────────────────
section('X-Slash — Step_0:42-53, canpress Step_0:1099-1113');
{
  const s = vd();
  stepFrame(s, IDLE);
  const acts = rowsFor(s, 0, 'actgrid');
  assertDeep(acts.map((r) => r.label), ['Check', 'HoldBreath', 'X-Slash'], 'Kris: Check / HoldBreath / X-Slash');
  assertEq(acts[XSLASH_ACT_INDEX].descb, 'Physical#damage', 'actdesc "Physical#damage"');
  assertEq(acts[XSLASH_ACT_INDEX].cost, 62.5, 'actcost 62.5');
  assertEq(XSLASH_ACT.actor, 11, 'actactor 11');
  assertEq(acts[XSLASH_ACT_INDEX].usable, false, 'unusable while Noelle stands (canpress 0)');
  assertEq(xslashCanpress(s), false, 'canpress 0: havechar[3] && hp[4] > 0');
  // Down her.
  s.partyHp[1] = -999;
  s.chardead[1] = 1;
  s.charcantarget[1] = 0;
  s.charmove[1] = 0;
  assertEq(xslashCanpress(s), true, 'canpress 1 once Noelle is down');
  assertEq(xslashRow(s).usable, false, '...but still greyed at 0 TP (Draw_0:1223 cant, Step_0:1163 tension >= tensionselect)');
  s.tension = 62.5;
  assertEq(xslashRow(s).usable, true, 'usable at exactly 62.5 TP');
  // A-Side roster (sideb false) has no X-Slash row at all.
  const a = createState({ seed: 7, traceBulletSlots: 8 });
  installRoster(a, { charIds: WEIRD_ROUTE_PARTY, sideb: false });
  a.knight = { damagereduction: 0.18, hp: 10000 };
  installKaizoMenu(a);
  assertDeep(kaizoActList(a, 0).map((r) => r.name), ['Check', 'HoldBreath'], 'no X-Slash without k_sideb');
}

// ── 5. selecting X-Slash through the REAL menu ─────────────────────────────
section('X-Slash through stepMenu: the confirm charges 62.5 and queues the act');
{
  const s = vd(777);
  // Down Noelle before the menu opens; give Kris the TP.
  s.partyHp[1] = -999;
  s.chardead[1] = 1;
  s.charcantarget[1] = 0;
  s.charmove[1] = 0;
  s.tension = 100;
  stepFrame(s, IDLE);
  assert(s.menu.open && s.menu.charturn === 0, 'menu open on Kris');
  press(s, 'right');                       // FIGHT -> ACT
  assertEq(s.menu.selected[0], 1, 'cursor on ACT');
  press(s, 'confirm');                     // bmenuno 11, the enemy picker
  assertEq(s.menu.submenu, 'actpick', 'the ACT picker stage');
  press(s, 'confirm');                     // bmenuno 9, the grid
  assertEq(s.menu.submenu, 'actgrid', 'the option grid');
  press(s, 'down');                        // coord 0 -> 2
  assertEq(s.menu.gridIndex, 2, 'cursor on X-Slash (row 2)');
  const tpBefore = s.tension;
  press(s, 'confirm');
  assertEq(s.tension, tpBefore - 62.5, 'global.tension -= acttpcost (Step_0:1170)');
  assert(s.pendingAct && s.pendingAct.c === 0 && s.pendingAct.act === 2, 'pendingAct = { c: 0, act: 2 }');
  assert(!s.menu.open, 'the menu closed — Noelle is down, nobody else to command');
}

// ── 5b. an unusable X-Slash refuses the confirm and charges nothing ────────
section('X-Slash refused while a partner stands');
{
  const s = vd(778);
  s.tension = 100;
  stepFrame(s, IDLE);
  press(s, 'right');
  press(s, 'confirm');
  press(s, 'confirm');
  press(s, 'down');
  press(s, 'confirm');
  assertEq(s.tension, 100, 'no TP charged');
  assert(!s.pendingAct, 'no act queued');
  assertEq(s.menu.submenu, 'actgrid', 'still on the grid');
}

// ── 6. the acting blocks ───────────────────────────────────────────────────
section('acting blocks — CHECK, HoldBreath, N-Action, X-Slash pages');
{
  const s = vd();
  stepFrame(s, IDLE);
  // CHECK, B-Side (Other_23:4-8).
  assertDeep(kaizoResolveActPages(s, 0, 0), CHECK_PAGES.b.first, 'CHECK first: "tried to analyze... froze" / "You brought this upon yourself."');
  assertDeep(kaizoResolveActPages(s, 0, 0), CHECK_PAGES.b.again, 'CHECK again: "Your actions were used up."');
  assertEq(s.actCounts.check, 2, 'checkcount counts');
  assertEq(CHECK_PAGES.b.first[0], '* Kris tried to analyze the enemy, but they froze.', 'B-Side check1A verbatim');
  assertEq(CHECK_PAGES.a.first[1], "* But the numbers didn't seem feasible...", 'A-Side check1B verbatim');
  // HoldBreath: the mod's repeat line, and the buff still lands once.
  assertDeep(kaizoResolveActPages(s, 0, 1), HOLDBREATH_PAGES.first, 'HoldBreath first: the vanilla three lines');
  assertEq(s.knight.holdbreathcount, 1, 'holdbreathcount clamped to 1');
  assertDeep(kaizoResolveActPages(s, 0, 1), HOLDBREATH_PAGES.again, 'HoldBreath again: "They felt dizzy" (v105: "Kris smiled")');
  assertEq(s.knight.holdbreathcount, 1, 'still 1 — the buff cannot stack');
  assert(HOLDBREATH_PAGES.again[0].includes('They felt dizzy'), 'the repeat line is the mod\'s');
  // N-Action, B-Side: one page, every time.
  assertDeep(kaizoResolveActPages(s, 1, 0), NACTION_PAGES.again, 'N-Action on the B-Side: "couldn\'t bring herself to say anything."');
  assertDeep(kaizoResolveActPages(s, 1, 0), NACTION_PAGES.again, '...and again');
  assertEq(s.actCounts.nact, 2, 'nactcount counts');
  assertEq(NACTION_PAGES.first_a.length, 3, 'the A-Side first use is three pages');
  assertEq(NACTION_PAGES.first_a[2], '* (Why does this feel..^1.&so familiar...?)', 'third page verbatim, pause code kept');
  // N-Action, A-Side roster: three pages once, then one.
  const a = createState({ seed: 9, traceBulletSlots: 8 });
  installRoster(a, { charIds: WEIRD_ROUTE_PARTY, sideb: false });
  a.knight = { damagereduction: 0.18, hp: 10000, holdbreathcount: 0 };
  installKaizoMenu(a);
  assertDeep(kaizoResolveActPages(a, 1, 0), NACTION_PAGES.first_a, 'A-Side first N-Action: the three-page version');
  assertDeep(kaizoResolveActPages(a, 1, 0), NACTION_PAGES.again, 'A-Side repeat: the one-page version');
  // Noelle's HoldBreath fallback — Kris absent (unreachable on the Weird Route).
  const n = createState({ seed: 10, traceBulletSlots: 8 });
  installRoster(n, { charIds: [CHAR_NOELLE], sideb: true });
  n.knight = { damagereduction: 0.18, hp: 10000, holdbreathcount: 0 };
  installKaizoMenu(n);
  assertDeep(kaizoActList(n, 0).map((r) => r.name), ['HoldBreath'], 'Kris absent: N-Action becomes HoldBreath (scr_monstersetup:1869-1880)');
  assertDeep(kaizoResolveActPages(n, 0, 0), NOELLE_HOLDBREATH_PAGES.first, 'Noelle HoldBreath first (Step_0:1278-1283)');
  assertEq(n.knight.holdbreathcount, 1, 'holdbreathcount++ once');
  assertDeep(kaizoResolveActPages(n, 0, 0), NOELLE_HOLDBREATH_PAGES.again, 'Noelle HoldBreath again (Step_0:1284-1288)');
  assertEq(XSLASH_PAGES[0], '* Kris used X-Slash!', 'X-Slash page verbatim (Step_0:984)');
}

// ── 7. the greyed-head strip data ──────────────────────────────────────────
section('X-Slash grid heads — Draw_0:1173-1192, 1257-1296');
{
  const s = vd();
  stepFrame(s, IDLE);
  let g = xslashGridHeads(s);
  assertEq(g.heads.length, 1, 'one partner head on the Weird Route');
  assertEq(g.heads[0].sprite, 'spr_headnoelle', 'spr_headnoelle');
  assertEq(g.heads[0].blend, C_GRAY, 'grey while she stands');
  assertEq(g.krsblend, C_GRAY, 'Kris\'s own head greys while any partner stands');
  assertEq(g.cant, true, 'cant = 1');
  assertEq(g.charoffset, 30, 'charoffset = 30 * partners present');
  assertDeep(g.heads[0].crosses.map((c) => c.angle), [6, 4], 'two spr_tenna_x crosses, angles 6 and 4');
  assertEq(g.heads[0].x, 28, 'first head at xx + 28');
  s.partyHp[1] = -999;
  g = xslashGridHeads(s);
  assertEq(g.heads[0].blend, C_WHITE_NEG, '-1 (white) once she is down');
  assertEq(g.krsblend, C_WHITE_NEG, 'Kris\'s head back to white');
  assertEq(g.cant, false, 'cant = 0');
  void CHAR_KRIS;
}

// ── 8. gap 10 — the sign picks the roster, the file supplies the rest ──────
section('the settings sign (obj_npc_sign Draw_0:31-41, 89-90, 124-125, 152-155) and the fresh file');
{
  assertDeep(scrSignParty(2, [3, 0]), [1, 4, 0], '"2" then Noelle, Kris -> [1, 4, 0]');
  assertDeep(scrSignParty(2, [0, 3]), [1, 4, 0], '"2" then Kris, Noelle -> [1, 4, 0] (order never matters)');
  assertDeep(scrSignParty(0, [3]), [4, 0, 0], '"1" then Noelle -> [4, 0, 0]');
  assertDeep(scrSignParty(1, [2, 1, 0]), [1, 2, 3], '"3" -> the normal trio, re-sorted by id');
  assertDeep(scrSignParty(1, [3, 2, 1]), [2, 3, 4], '"3" without Kris -> [2, 3, 4]');
  assertDeep(scrSignParty(2, [3, 3]), [4, 0, 0], 'a repeated pick collapses (scr_fixparty is a set)');
  assertDeep(NOELLE_FRESH_FILE.stats, { maxhp: 120, at: 5, magic: 13, df: 1 }, 'fresh file: the override\'s 120/5/13/1');
  assertEq(NOELLE_FRESH_FILE.gear.weapon, THORN_RING, 'fresh file: the ThornRing rides the Ch2 transfer (scr_load_chapter2:91-96)');
  assertDeep(NOELLE_FRESH_FILE.spells, [2, 8, 9], 'fresh file: the gamestart list');
  assertDeep(NOELLE_FRESH_FILE.maybeSpells, [10], 'SnowGrave: transfer-dependent, not granted here');
  // The override path: a measured save's list is installed without editing data.
  const s = vd(99);
  stepFrame(s, IDLE);
  s.kaizo.spells = { 4: [2, 8, 9, 10] };
  assertDeep(rowsFor(s, 1, 'magic').map((r) => r.label),
    ['N-Action', 'Heal Prayer', 'SleepMist', 'IceShock', 'SnowGrave'],
    'state.kaizo.spells[4] adds SnowGrave to the MAGIC list, under the ACT row');
  s.tension = MAX_TENSION;
  assertEq(rowsFor(s, 1, 'magic')[3].usable, true, 'SnowGrave lights up at a full bar with the ring (cost 250)');
}

console.log(`\ncheck-noelle-menu: ${count - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
