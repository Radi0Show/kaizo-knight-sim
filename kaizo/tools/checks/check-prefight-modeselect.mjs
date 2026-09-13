#!/usr/bin/env node
// KAIZO — THE PRE-FIGHT MODE SELECT (ledger G-6, with G-10/G-11/G-12).
//
//   node kaizo/tools/checks/check-prefight-modeselect.mjs
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE. `gml_Object_obj_ch3_PTB02_Step_0.gml`, mod-side line numbers:
//   :1-8      `_doprac`, and Noelle's 120 HP floor
//   :58-70    con 2 — `rem_char` / `char_change`
//   :351-353  con 3.1 — `con = 4` becomes `con = 3.2` (the whole diff)
//   :437-528  con 3.2 .. 3.7 — the four-option menu and its dispatch
//   :550-582  the battle-start block, mode-gated items + the party swap-back
//   :606-616  con 8 — the vanilla three restored for the aftermath
//
// Each was diffed against `gml_vanilla_v105/CodeEntries` AND checked against
// retail chapter 3 (`knight-research/gml_dump/CodeEntries`), because roughly
// 170 of the audit's 845 rows are official churn running backwards. None of
// this is: v105's PTB02 Step has none of it, and retail ch3's `con == 3.1`
// arm still reads `con = 4`. §A asserts that against the dumps directly.
//
// WHY IT MATTERS. `global.knight_mode` is the SOLE producer of
// `obj_knight_enemy.practicemode` and `.nohitmode`
// (`gml_Object_obj_knight_enemy_Create_0.gml:95-109`), and those two flags
// are read in fourteen already-translated branches. Before this, they had a
// consumer and no producer: every one of those branches was permanently on
// its false arm. §D drives the machine into the real scene builder and reads
// the flags back out, and §F asserts that web/kaizo.js is what drives it —
// a producer with no caller would be the same defect from the other side.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

import { createState } from '../../../sim/index.js';
import {
  buildKaizoScene, KNIGHT_MODE_PRACTICE, KNIGHT_MODE_NOHIT, KNIGHT_MODE_STANDARD,
} from '../../scenes/kaizo-fight.js';
import {
  createPrefight, createPrefightGlobals,
  prefightStepTop, prefightConTwo, stepPrefight,
  prefightBattleStart, prefightConEight, restoreKnightBattleItems,
  musFileExists,
  CHOICE_PRACTICE, CHOICE_NOHIT, CHOICE_STANDARD, CHOICE_RETURN,
  MODE_CHOICES_EN, MODE_CHOICES_JA, NOHIT_HINT_EN, NOHIT_HINT_JA,
  MSG_CHOICE4, MSG_CLEAR, VANILLA_CHAR, NOELLE_CHAR_ID, NOELLE_MIN_MAXHP,
  BATTLE_START_COVER,
} from '../../scenes/kaizo-prefight.js';
import {
  openModeSelect, modeSelectChoicerUp, modeSelectChoose, modeSelectHintDone,
  modeSelectReady, modeSelectKnightMode,
} from '../../../web/kaizo-prefight.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const RESEARCH = join(homedir(), 'knight-research');
const MOD = join(RESEARCH, 'kaizo-mod', 'gml_kaizo_dump', 'CodeEntries');
const V105 = join(RESEARCH, 'kaizo-mod', 'gml_vanilla_v105', 'CodeEntries');
const CH3 = join(RESEARCH, 'gml_dump', 'CodeEntries');
const PTB02 = 'gml_Object_obj_ch3_PTB02_Step_0.gml';

let failures = 0;
let count = 0;
function assert(cond, label) {
  count += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); } else console.log(`  ok   ${label}`);
}
function assertEq(got, want, label) {
  assert(Object.is(got, want), `${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}
function assertDeepEq(got, want, label) {
  assert(JSON.stringify(got) === JSON.stringify(want),
    `${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}
function section(t) { console.log(`\n== ${t}`); }

// ═══ A: THE DUMPS ══════════════════════════════════════════════════════════
section('A — it is EnderCat8\'s, not chapter-build churn');
{
  const read = (base) => (existsSync(join(base, PTB02)) ? readFileSync(join(base, PTB02), 'utf8') : null);
  const mod = read(MOD);
  const v105 = read(V105);
  const ch3 = read(CH3);
  // The dumps are private research and a fresh clone has none of them. Say so
  // and skip rather than fail — but never silently: a skipped provenance
  // check that looks like a pass is how a wrong attribution survives.
  if (!mod || !v105 || !ch3) {
    console.log('  SKIP the GML dumps are not on this machine (~/knight-research)');
  } else {
    assert(mod.includes('if (con == 3.2)'), 'the mod has con 3.2');
    assert(!v105.includes('con == 3.2'), '...and v105 does not');
    assert(!ch3.includes('con == 3.2'), '...and retail chapter 3 does not either');
    assert(mod.includes('global.knight_mode = global.choice'),
      'the mod writes global.knight_mode from global.choice');
    assert(!v105.includes('knight_mode'), '...a name v105 does not contain at all');
    assert(mod.includes('if (global.knight_mode == 2)'),
      'the item snapshot is mode-gated in the mod (G-12)');
    assert(v105.includes('global.knight_battle_items = [];')
      && !v105.includes('global.knight_mode'),
      '...and v105 took the same snapshot UNCONDITIONALLY');
    assert(mod.includes('char_change = 1;') && !v105.includes('char_change'),
      'char_change is the mod\'s (G-10)');
    // con 3.7 has no setter anywhere in the mod — the unreachable arm.
    assert(mod.includes('if (con == 3.7)'), 'con 3.7 exists in the mod');
    assert(!/con = 3\.7/.test(mod), '...and NOTHING in that file sets con = 3.7 (G-11, unreachable)');
    // The four strings, verbatim.
    for (const s of MODE_CHOICES_EN) {
      assert(mod.includes(JSON.stringify(s).slice(1, -1).replace(/\\n/g, '\\n')),
        `the English row ${JSON.stringify(s)} is in the dump verbatim`);
    }
    assert(mod.includes(NOHIT_HINT_EN), 'the No Hit ESC hint is in the dump verbatim');
  }
}

// ═══ B: THE STRINGS ════════════════════════════════════════════════════════
section('B — the four rows, in the mod\'s order');
{
  assertDeepEq([...MODE_CHOICES_EN], ['\nPractice', '\nNo Hit', 'Standard', 'Return'],
    ':452-455 — global.choicemsg[0..3], English');
  assertDeepEq([...MODE_CHOICES_JA], ['\n練習', '\nノーヒット\nモード', '通常モード', '装備'],
    '...and the k_stringsetloc Japanese arm');
  // THE LEADING NEWLINES ARE THE MOD'S LAYOUT, not a transcription slip.
  assert(MODE_CHOICES_EN[0].startsWith('\n') && MODE_CHOICES_EN[1].startsWith('\n'),
    'rows 0 and 1 carry a leading newline');
  assert(!MODE_CHOICES_EN[2].startsWith('\n') && !MODE_CHOICES_EN[3].startsWith('\n'),
    '...and rows 2 and 3 do not');
  assertEq(MODE_CHOICES_JA[3], '装備', 'the Japanese row 3 says EQUIPMENT, not "return" (con 3.7\'s job)');
  assertEq(MSG_CHOICE4, '\\C4', ':450 — the writer\'s four-way choice code');
  assertEq(MSG_CLEAR, '%%', ':471 — what replaces it once the choicer is up');
  assert(NOHIT_HINT_EN.endsWith('/%'), 'the ESC hint ends on the writer\'s close marker');
  assert(NOHIT_HINT_JA.includes('&'), '...and the Japanese one keeps its line break');
  // The choice VALUES are positional: they index choicemsg.
  assertDeepEq([CHOICE_PRACTICE, CHOICE_NOHIT, CHOICE_STANDARD, CHOICE_RETURN], [0, 1, 2, 3],
    'the four global.choice values are the row indices');
}

// ═══ C: THE MACHINE ════════════════════════════════════════════════════════

/** Park a fresh machine at con 3.2, the way the sword-draw hands it over. */
function atModeSelect({ doprac = 1, char = [1, 2, 3], japanese = false } = {}) {
  const w = createPrefightGlobals({ kaizo_practice: doprac, char: [...char] });
  const pf = createPrefight({ japanese });
  prefightStepTop(pf, w);
  prefightConTwo(pf, w);
  pf.con = 3.2;
  return { pf, w };
}

section('C1 — _doprac OFF: no menu, and the fight starts in the SAME frame');
{
  const { pf, w } = atModeSelect({ doprac: 0 });
  const fx = stepPrefight(pf, w);
  assertEq(w.choice, CHOICE_STANDARD, ':459 — global.choice is forced to 2');
  assertEq(pf.con, 4, '...and con reaches 4 on the same Step (the GML\'s fall-through)');
  assertEq(w.knight_mode, KNIGHT_MODE_STANDARD, '...with global.knight_mode = 2');
  assert(fx.some((e) => e.type === 'choicer-skipped'), '...and no choicer was ever raised');
  assert(!fx.some((e) => e.type === 'choicer-open'), '...really none');
  assertEq(w.msc, -1, ':443 — global.msc = -1 still happened');
  assertEq(w.kaizo_intro, 1, ':445 — and global.kaizo_intro = 1 (the sign reads it)');
  assert(fx.some((e) => e.type === 'settings-save'), '...and kaizo_settings_save() ran');
}

section('C2 — _doprac ON: the choicer goes up and the machine WAITS');
{
  const { pf, w } = atModeSelect({ doprac: 1 });
  const fx = stepPrefight(pf, w);
  assertEq(pf.con, 3.3, ':447 — con 3.3, waiting for obj_choicer_neo');
  assertEq(w.msg[0], MSG_CHOICE4, '...the writer has the \\C4 code');
  assertDeepEq(w.choicemsg, [...MODE_CHOICES_EN], '...and the four rows are loaded');
  assertEq(w.speaker, 'none', ':449 — scr_speaker("none")');
  assert(fx.some((e) => e.type === 'choicer-open' && e.side === 1), '...with side = 1');
  // THE CHOICER DOES NOT EXIST YET on the frame the dialoguer is made, so
  // con 3.3 must NOT fall through in the same Step.
  assertEq(w.choicerUp, false, '...and obj_choicer_neo does not exist on this frame');

  // Next frame: it does.
  w.choicerUp = true;
  stepPrefight(pf, w);
  assertEq(pf.con, 3.4, 'con 3.4 once the choicer exists');
  assertEq(w.msg[0], MSG_CLEAR, ':471 — and the message is blanked to "%%"');
  // ...and con 3.4 waits for it to GO AWAY.
  stepPrefight(pf, w);
  assertEq(pf.con, 3.4, '...and holds there while the choicer is still up');
  assertEq(w.knight_mode, KNIGHT_MODE_PRACTICE,
    '...global.knight_mode is still :444\'s unconditional 0, not a commitment');

  const jp = atModeSelect({ doprac: 1, japanese: true });
  stepPrefight(jp.pf, jp.w);
  assertDeepEq(jp.w.choicemsg, [...MODE_CHOICES_JA], 'the Japanese arm loads the Japanese rows');
}

section('C3 — the dispatch: all four arms');
{
  // PRACTICE (0) — the `else`, which is what makes practicemode reachable.
  {
    const { pf, w } = atModeSelect();
    stepPrefight(pf, w); w.choicerUp = true; stepPrefight(pf, w);
    w.choice = CHOICE_PRACTICE; w.choicerUp = false;
    stepPrefight(pf, w);
    assertEq(pf.con, 4, 'Practice goes straight to con 4');
    assertEq(w.knight_mode, KNIGHT_MODE_PRACTICE, '...writing global.knight_mode = 0');
  }
  // NO HIT (1) — the hint, then con 3.5.
  {
    const { pf, w } = atModeSelect();
    stepPrefight(pf, w); w.choicerUp = true; stepPrefight(pf, w);
    w.choice = CHOICE_NOHIT; w.choicerUp = false;
    stepPrefight(pf, w);
    assertEq(pf.con, 3.5, 'No Hit parks at con 3.5');
    assertEq(w.msg[0], NOHIT_HINT_EN, '...with the ESC hint in the writer');
    assertEq(w.knight_mode, KNIGHT_MODE_NOHIT, '...and global.knight_mode = 1 ALREADY (:495)');
    stepPrefight(pf, w);
    assertEq(pf.con, 3.5, '...holding while d_ex() is true');
    w.dialoguerUp = false;
    stepPrefight(pf, w);
    assertEq(pf.con, 4, '...and con 4 once the writer closes (:504-507)');
  }
  // STANDARD (2) — the same `else` as Practice.
  {
    const { pf, w } = atModeSelect();
    stepPrefight(pf, w); w.choicerUp = true; stepPrefight(pf, w);
    w.choice = CHOICE_STANDARD; w.choicerUp = false;
    stepPrefight(pf, w);
    assertEq(pf.con, 4, 'Standard goes to con 4');
    assertEq(w.knight_mode, KNIGHT_MODE_STANDARD, '...writing 2');
  }
  // RETURN (3) — room_restart, and NOTHING BELOW IT RUNS.
  {
    // Arm char_change so the restore is observable: the player's real party.
    const { pf, w } = atModeSelect({ char: [1, 4, 0] });
    assertEq(pf.char_change, 1, 'a non-vanilla party arms char_change (:61-66)');
    stepPrefight(pf, w); w.choicerUp = true; stepPrefight(pf, w);
    w.choice = CHOICE_RETURN; w.choicerUp = false;
    const fx = stepPrefight(pf, w);
    assertDeepEq(w.char, [1, 4, 0], ':477 — the player\'s party is put back before the restart');
    assertEq(w.tempflag[90], 0, ':480 — tempflag[90] cleared');
    assertEq(w.interact, 0, ':481 — and interact released');
    assert(fx.some((e) => e.type === 'room-restart'), '...room_restart()');
    assertEq(pf.con, 3.4, '...con is NOT advanced');
    // The `exit` is the point: con 3.5 and con 3.7 below must not have run.
    assert(!fx.some((e) => e.type === 'fight-start' || e.type === 'equip-menu-rewind'),
      '...and `exit` stopped the rest of the Step (no fight-start, no con 3.7)');
  }
}

section('C4 — con 3.7, the unreachable equip-menu arm (G-11)');
{
  const { pf, w } = atModeSelect({ char: [1, 4, 0] });
  pf.con = 3.7;
  w.menuno = 2;
  stepPrefight(pf, w);
  assertEq(pf.con, 3.7, ':509 — menuno == 2 means the menu is still open; nothing happens');
  w.menuno = 0;
  const fx = stepPrefight(pf, w);
  assertDeepEq(w.char, [...VANILLA_CHAR], ':513 — the VANILLA three, not rem_char');
  assertEq(w.menuno, -1, ':518 — obj_darkcontroller reset');
  assertEq(pf.con, 2.2, ':522 — rewound to con 2.2');
  assertEq(pf.alarm0, 5, ':523 — five frames later');
  assert(fx.some((e) => e.type === 'equip-menu-rewind'), '...recorded');
}

section('C5 — Noelle\'s 120 floor (:2-6) and char_change (:58-70)');
{
  const w = createPrefightGlobals({ maxhp: [0, 160, 190, 140, 90], hp: [0, 160, 190, 140, 12] });
  const pf = createPrefight();
  prefightStepTop(pf, w);
  assertEq(w.maxhp[NOELLE_CHAR_ID], NOELLE_MIN_MAXHP, 'maxhp[4] raised to 120');
  assertEq(w.hp[NOELLE_CHAR_ID], NOELLE_MIN_MAXHP, '...and hp[4] SET to 120, not clamped');
  // Idempotent, because it runs every frame of the encounter.
  w.hp[NOELLE_CHAR_ID] = 40;
  prefightStepTop(pf, w);
  assertEq(w.hp[NOELLE_CHAR_ID], 40, '...and it does not re-heal once maxhp is already 120');

  // char_change is armed by ANY party that is not exactly [1, 2, 3].
  for (const [char, want] of [[[1, 2, 3], 0], [[1, 4, 0], 1], [[1, 3, 2], 1], [[2, 2, 3], 1]]) {
    const g = createPrefightGlobals({ char: [...char] });
    const p = createPrefight();
    prefightConTwo(p, g);
    assertEq(p.char_change, want, `char_change for [${char}] is ${want}`);
    assertDeepEq(p.rem_char, char, `...and rem_char remembers [${char}]`);
  }
}

section('C6 — the battle-start block (:550-582) and con 8 (:608-611)');
{
  const bag = [1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0];
  const mus = musFileExists(['knight.ogg', 'kaizoknight.ogg']);

  // STANDARD banks the inventory.
  {
    const { pf, w } = atModeSelect({ doprac: 0, char: [1, 4, 0] });
    stepPrefight(pf, w);
    w.item = [...bag];
    const track = prefightBattleStart(pf, w, { fileExists: mus });
    assert(Array.isArray(w.knight_battle_items), 'Standard: global.knight_battle_items exists');
    assertEq(w.knight_battle_items.length, 13, '...13 slots, the mod\'s own over-run of a 12-slot bag');
    assertEq(track, 'kaizoknight.ogg', '...and the battle track came through kaizo_set_music');
    assertDeepEq(w.char, [1, 4, 0], ':566-568 — the player\'s party restored for the fight');
    // ...and the black cover is recorded rather than invented.
    assertEq(BATTLE_START_COVER.depth, -999999999, 'the cover\'s depth is the mod\'s');
    assertEq(BATTLE_START_COVER.destroyAfterFrames, 25, '...and it lives 25 frames');

    // THE READER. Nothing else in this repo reads knight_battle_items, so the
    // snapshot would be a value written where nothing looks — the repo's
    // signature defect. `restoreKnightBattleItems` is the mod's own reader
    // (DEVICE_FAILURE_Step_0:462-469), and it is asserted here.
    w.item = [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9];
    const n = restoreKnightBattleItems(w);
    assertEq(n, 13, 'the game-over restore copied all 13 slots back');
    assertDeepEq(w.item.slice(0, 6), [1, 2, 3, 4, 5, 6], '...and the bag is the pre-fight one');
    assertEq(restoreKnightBattleItems(w), 0,
      '...a second restore copies nothing: the array is emptied, not unset');

    // con 8 puts the VANILLA three back for the aftermath.
    prefightConEight(pf, w);
    assertDeepEq(w.char, [...VANILLA_CHAR], ':609-610 — con 8 forces [1, 2, 3]');
  }

  // PRACTICE and NO HIT do not bank it — the mod's gate, and the thing v105
  // did not do.
  for (const [choice, name] of [[CHOICE_PRACTICE, 'Practice'], [CHOICE_NOHIT, 'No Hit']]) {
    const { pf, w } = atModeSelect();
    stepPrefight(pf, w); w.choicerUp = true; stepPrefight(pf, w);
    w.choice = choice; w.choicerUp = false; stepPrefight(pf, w);
    w.dialoguerUp = false; stepPrefight(pf, w);
    w.item = [...bag];
    prefightBattleStart(pf, w, { fileExists: mus });
    assertEq(w.knight_battle_items, undefined,
      `${name}: NO inventory snapshot (:551 — v105 took one unconditionally)`);
    assertEq(restoreKnightBattleItems(w), 0, `...so the game-over restore has nothing to give back`);
  }

  // The B-Side battle track routes through the flag.
  {
    const { pf, w } = atModeSelect({ doprac: 0 });
    w.flag[456] = 1;
    stepPrefight(pf, w);
    const track = prefightBattleStart(pf, w, { fileExists: mus });
    assertEq(track, 'kaizoknight_alt', 'the B-Side battle track is the router\'s stem (bug 1, preserved)');
    const fx = pf.effects.filter((e) => e.type === 'batmusic');
    assertEq(fx[0].playable, false, '...and the block records that it names no file');
  }
}

// ═══ D: THE FLAGS IT PRODUCES, THROUGH THE REAL SCENE BUILDER ══════════════
section('D — the whole point: practicemode / nohitmode actually turn on');
{
  const drive = (choice) => {
    const ms = openModeSelect({ kaizoPractice: 1 });
    modeSelectChoicerUp(ms);
    modeSelectChoose(ms, choice);
    if (choice === CHOICE_NOHIT) modeSelectHintDone(ms);
    return ms;
  };

  for (const [choice, mode, prac, nohit] of [
    [CHOICE_PRACTICE, 'practice', true, false],
    [CHOICE_NOHIT, 'nohit', false, true],
    [CHOICE_STANDARD, 'standard', false, false],
  ]) {
    const ms = drive(choice);
    assert(modeSelectReady(ms.pf), `${mode}: the machine reached con 4`);
    assertEq(modeSelectKnightMode(ms), mode, `...and names the mode "${mode}"`);
    const st = createState({ seed: 777, traceBulletSlots: 0 });
    buildKaizoScene(st, { version: 'D', mode: modeSelectKnightMode(ms) });
    assertEq(st.kaizo.practicemode, prac, `...state.kaizo.practicemode ${prac}`);
    assertEq(st.knight.nohitmode, nohit, `...state.knight.nohitmode ${nohit}`);
    assertEq(st.kaizo.knightMode,
      { practice: KNIGHT_MODE_PRACTICE, nohit: KNIGHT_MODE_NOHIT, standard: KNIGHT_MODE_STANDARD }[mode],
      `...and global.knight_mode is recorded as the number the mod wrote`);
  }

  // RETURN never reaches a fight.
  {
    const ms = drive(CHOICE_RETURN);
    assert(!modeSelectReady(ms.pf), 'Return does NOT reach con 4');
    assert(ms.pf.effects.some((e) => e.type === 'room-restart'), '...it restarts the room instead');
    assertEq(modeSelectKnightMode(ms), 'practice',
      '...and the global it leaves behind is :444\'s unconditional 0, which nothing on that '
      + 'path reads — the room restarts and con 3.2 writes it again');
  }

  // PRACTICE OFF is the default and is the whole reason this is invisible to
  // a player who has not asked for it.
  {
    const ms = openModeSelect({ kaizoPractice: 0 });
    assert(modeSelectReady(ms.pf), 'practice off: con 4 in one frame');
    assertEq(modeSelectKnightMode(ms), 'standard', '...and the mode is Standard');
    const st = createState({ seed: 778, traceBulletSlots: 0 });
    buildKaizoScene(st, { version: 'D', mode: 'standard' });
    assertEq(st.kaizo.practicemode, false, '...practicemode off');
    assertEq(st.kaizo.nohitmode, false, '...nohitmode off');
  }

  // AND THE RECORDED STATE IS STILL REACHABLE. `mode` undefined models
  // `variable_global_exists("knight_mode") == false`, which is what every
  // byte-gate recording is in, and it must keep landing on the same zeros.
  {
    const st = createState({ seed: 779, traceBulletSlots: 0 });
    buildKaizoScene(st, { version: 'C' });
    assertEq(st.kaizo.knightMode, null, 'no mode passed: the global is ABSENT, not 2');
    assertEq(st.kaizo.practicemode, false, '...and both flags are off — the recorded fight');
    assertEq(st.kaizo.nohitmode, false, '...both');
  }
}

// ═══ E: NO-HIT'S OPENING HEAL ══════════════════════════════════════════════
section('E — nohitmode heals the party (Create_0:104-107)');
{
  const st = createState({ seed: 780, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: 'D' });
  const before = [...st.partyHp];
  st.partyHp[0] = 5;
  st.partyHp[1] = 5;
  const st2 = createState({ seed: 780, traceBulletSlots: 0 });
  buildKaizoScene(st2, { version: 'D', mode: 'nohit' });
  assertDeepEq(st2.partyHp, before, 'the Weird Route party starts at full HP under No Hit');
  assertEq(st2.knight.nohitmode, true, '...with the flag on');
}

// ═══ F: THE CALLER EXISTS ══════════════════════════════════════════════════
section('F — web/kaizo.js really drives it (a producer with no caller is the same defect)');
{
  const page = readFileSync(join(REPO, 'web', 'kaizo.js'), 'utf8');
  const code = page.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert(/openModeSelect\(/.test(code), 'web/kaizo.js calls openModeSelect');
  assert(/modeSelectChoicerUp\(/.test(code), '...and raises the choicer');
  assert(/modeSelectChoose\(/.test(code), '...and commits a choice');
  assert(/modeSelectHintDone\(/.test(code), '...and closes the No Hit hint');
  assert(/mode:\s*knightModeName/.test(code),
    '...and HANDS THE ANSWER TO buildKaizoScene — the wire that turns the flags on');
  assert(/beginRun\(\)/.test(code), '...through beginRun, on the title\'s chosen row');
  // THE ROW STRINGS REACH THE PLAYER, not a retyped copy.
  assert(/MODE_CHOICES_EN/.test(code), '...and the menu draws the mod\'s own strings');
  // The practice setting is read, or the menu can never appear.
  assert(/kaizoPractice/.test(code), '...and `global.kaizo_practice` has a source');
  // The element the overlay needs.
  const html = readFileSync(join(REPO, 'web', 'kaizo.html'), 'utf8');
  for (const id of ['modeselect', 'modeselect-rows', 'modeselect-msg']) {
    assert(html.includes(`id="${id}"`), `web/kaizo.html has #${id}`);
  }
  assert(/stand-in/i.test(html), '...and the overlay is LABELLED as a stand-in (CLAUDE.md law 4)');
}

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${count - failures}/${count} assertions`);
process.exit(failures ? 1 : 0);
