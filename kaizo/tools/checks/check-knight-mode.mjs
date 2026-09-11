#!/usr/bin/env node
// KAIZO — global.knight_mode, AND THE FOURTEEN READERS IT TURNS ON (ledger G-6).
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE
//   gml_Object_obj_knight_enemy_Create_0.gml:88-109   practicemode / nohitmode / the heal
//   gml_Object_obj_ch3_PTB02_Step_0.gml:444, 495-500  global.knight_mode = global.choice
//                                                     (0 Practice, 1 No Hit, 2 Standard, 3 Return)
//
// WHAT WAS WRONG. `practicemode` and `nohitmode` were READ IN FOURTEEN
// PLACES AND WRITTEN IN NONE, so every practice and no-hit branch already
// translated sat permanently on its false arm — a whole class of translated
// code that no suite could distinguish from code that had never been written.
// This check is the other half: it drives each reader with the flag ON and
// with it OFF and asserts the two answers DIFFER, so a reader that stopped
// consulting the flag fails here even though its own check stays green.
//
// THE SITE LIST, and where each is probed below:
//    1  kaizo/party/damage.js   gloomAccrue          `hp > 1 && !practicemode`
//    2  kaizo/party/damage.js   scrDamage            practiceHp(2) / practiceHp(1)
//    3  kaizo/party/damage.js   scrDamageMaxhp       practiceHp(2) / practiceHp(1)
//    4  kaizo/party/freeze.js   kaizoAdvanceBalloon  `practicemode || k_sideb || !susie`
//    5  kaizo/party/gloom.js    kaizoGloomAccrue     `!obj_knight_enemy.practicemode`
//    6  kaizo/party/spells.js   stepThornringTick    `with (knight) if (practicemode) _dotick = 0`
//    7  kaizo/party/scenes.js   scrMnendturnScenes   `if (k_sideb && !practicemode)`
//    8  kaizo/party/scenes.js   armHpscene           `if (!practicemode && !nohitmode)`
//    9  kaizo/party/scenes.js   k_nhscene state 5    the nohitmode abort
//   10  kaizo/party/scenes.js   k_sgscene state 6    the nohitmode abort
//   11  kaizo/scenes/kaizo-vc-hooks.js  RoaringDelta turn-end line  `&& !practicemode`
//   12  kaizo/scenes/kaizo-vc-hooks.js  Multislash2 turn-end line   `&& !practicemode`
//   13  kaizo/scenes/kaizo-vc-hooks.js  k_lastpro latch             `&& !practicemode`
//   14  kaizo/render/draw/tracking.js   the practice HUD — NOT TRANSLATED, and
//        deliberately: Draw_64:8-227 is a debug overlay this renderer has no
//        text layer for. It is listed so the count is honest, and asserted as
//        absent rather than quietly dropped.
//
// THE TWO HOMES. Sites 1-6 and 11-13 read `state.kaizo.practicemode`; sites
// 7-10 read it off `state.knight`. In the GML there is one instance and one
// variable. `applyKnightMode` writes both, and this check proves each reader
// from the OUTSIDE — by its behaviour, not by the field it happens to read —
// so the day someone unifies the two homes this check still means something.
//
// THE DEFAULT IS UNCHANGED AND THAT IS ASSERTED. `buildKaizoScene` with no
// `mode` models `variable_global_exists("knight_mode") == false`, which is
// what the oracle recorder produces (it boots straight into the battle room
// and PTB02 never runs). Both flags stay 0 and the byte gate cannot move.
//
//     node kaizo/tools/checks/check-knight-mode.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { gmlCreate } from '../../../sim/rng.js';
import { PARTY } from '../../../sim/damage.js';
import {
  buildKaizoScene, applyKnightMode, KNIGHT_MODES,
  KNIGHT_MODE_PRACTICE, KNIGHT_MODE_NOHIT, KNIGHT_MODE_STANDARD,
} from '../../scenes/kaizo-fight.js';
import { vcHooks } from '../../scenes/kaizo-vc-hooks.js';
import { VD_TABLE, VC_KNIGHT } from '../../versions/vc-script.js';
import {
  installRoster, WEIRD_ROUTE_PARTY, NORMAL_ROUTE_PARTY, maxhpOfChar, charIdOf,
} from '../../party/roster.js';
import { gloomAccrue, scrDamage, scrDamageMaxhp } from '../../party/damage.js';
import { kaizoGloomAccrue } from '../../party/gloom.js';
import { kaizoAdvanceBalloon } from '../../party/freeze.js';
import { stepThornringTick, installKaizoMenu } from '../../party/spells.js';
import {
  ensureScenes, kaizoSceneDriver, scrMnendturnScenes, armHpscene,
  castSnowgrave, NH_ARM_TURNS,
} from '../../party/scenes.js';

let failures = 0;
let count = 0;
function assert(cond, label) {
  count += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); } else console.log(`  ok   ${label}`);
}
function assertEq(got, want, label) {
  assert(got === want, `${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}
function section(t) { console.log(`\n== ${t}`); }

const IDLE = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

/**
 * A roster + knight record + scene driver, with the mode applied THROUGH
 * `applyKnightMode` rather than hand-set — the point of the exercise is that
 * the producer reaches the readers, so nothing here writes a flag directly.
 */
function mk({ charIds = WEIRD_ROUTE_PARTY, sideb = true, seed = 12345, mode } = {}) {
  const st = createState({ seed, traceBulletSlots: 0 });
  st.gmlRng = gmlCreate(seed);
  installRoster(st, { charIds, sideb });
  st.kaizo.sideb = sideb;
  st.kaizo.vars = { kaizo_block: true };
  st.knight = {
    ...st.knight,
    haveusedroaring: false,
    progamer: true,
    turnsafternohit: 0,
    damagereduction: 0.18,
    hp: VC_KNIGHT.maxhp,
    blockanim: 0,
    holdbreathcount: 0,
  };
  ensureScenes(st);
  spawn(st, kaizoSceneDriver, {});
  applyKnightMode(st, mode);
  return st;
}
function run(st, frames, done = () => false) {
  for (let f = 0; f < frames; f++) {
    stepFrame(st, IDLE);
    if (done(st)) break;
  }
  return st;
}

// ── 0. THE CREATE BLOCK ────────────────────────────────────────────────────
section('obj_knight_enemy Create_0:88-109 — the producer');
{
  assertEq(KNIGHT_MODES.practice, KNIGHT_MODE_PRACTICE, 'Practice is global.choice 0');
  assertEq(KNIGHT_MODES.nohit, KNIGHT_MODE_NOHIT, 'No Hit is global.choice 1');
  assertEq(KNIGHT_MODES.standard, KNIGHT_MODE_STANDARD, 'Standard is global.choice 2');

  // `variable_global_exists("knight_mode")` false — the recorded fight.
  const absent = mk({});
  assertEq(absent.knight.practicemode, false, 'no knight_mode: practicemode 0 on the instance');
  assertEq(absent.knight.nohitmode, false, 'no knight_mode: nohitmode 0 on the instance');
  assertEq(absent.kaizo.practicemode, false, 'no knight_mode: practicemode 0 on state.kaizo');
  assertEq(absent.kaizo.nohitmode, false, 'no knight_mode: nohitmode 0 on state.kaizo');
  assertEq(absent.kaizo.knightMode, null, '...and the global is recorded as ABSENT, not as 2');

  // Standard reaches the same two zeroes down the other road.
  const std = mk({ mode: KNIGHT_MODE_STANDARD });
  assertEq(std.knight.practicemode, false, 'Standard: practicemode 0');
  assertEq(std.knight.nohitmode, false, 'Standard: nohitmode 0');
  assertEq(std.kaizo.knightMode, KNIGHT_MODE_STANDARD, '...but knight_mode reads 2 (G-8/G-12 branch on it)');

  const prac = mk({ mode: KNIGHT_MODE_PRACTICE });
  assertEq(prac.knight.practicemode, true, 'mode 0: practicemode 1 on the instance');
  assertEq(prac.kaizo.practicemode, true, 'mode 0: practicemode 1 on state.kaizo');
  assertEq(prac.knight.nohitmode, false, 'mode 0 does NOT set nohitmode');

  const nh = mk({ mode: KNIGHT_MODE_NOHIT });
  assertEq(nh.knight.nohitmode, true, 'mode 1: nohitmode 1 on the instance');
  assertEq(nh.kaizo.nohitmode, true, 'mode 1: nohitmode 1 on state.kaizo');
  assertEq(nh.knight.practicemode, false, 'mode 1 does NOT set practicemode');

  // :104-107 — the four `global.hp[c] = global.maxhp[c]` lines, and the heal
  // must be a real change. (:103 is `nohitmode = 1`; the citation used to
  // start a line early, here and at the call site in kaizo-fight.js.)
  const hurt = createState({ seed: 5, traceBulletSlots: 0 });
  installRoster(hurt, { charIds: NORMAL_ROUTE_PARTY, sideb: false });
  hurt.knight = { ...hurt.knight };
  hurt.partyHp = [11, 12, 13];
  applyKnightMode(hurt, KNIGHT_MODE_NOHIT);
  assertEq(hurt.partyHp.join(','), PARTY.map((p) => p.maxhp).join(','),
    'mode 1 heals global.hp[1..4] to global.maxhp[1..4]');
  // AND IT USES THE ROSTER'S MAX, not the vanilla trio's: PARTY[1] is Susie's
  // 190 and the Weird Route's slot 1 is Noelle's 120.
  //
  // THROUGH buildKaizoScene, NOT A HAND-BUILT STATE. This assertion used to
  // set `wr.partyHp = [1, 1]` — a TWO-entry array, which is a shape the
  // builder never produces. buildKaizoScene pads a short party back out to
  // three (the spare dead and untargetable, which is what `global.char =
  // [1, 4, 0]` looks like), so the real array is length 3 and slot 2 is the
  // pad. Exercising the length-2 shape meant the walk never reached the pad,
  // and the bug it was written to catch — the heal falling through to
  // PARTY[2] and writing RALSEI'S 140 into a slot the Weird Route does not
  // have — was structurally invisible to it. See check-heal-roster.mjs, which
  // owns this mechanism now; this one keeps the ordering assertion it was
  // always about, on a shape the builder really makes.
  const wr = createState({ seed: 5, traceBulletSlots: 0 });
  buildKaizoScene(wr, { version: 'D', mode: 'nohit' });
  assertEq(wr.partyHp.length, 3, 'buildKaizoScene pads the Weird Route back to three slots');
  assertEq(wr.partyHp.join(','), '160,120,0',
    '...off the ROSTER (Noelle 120), never PARTY[1] = Susie 190 — and the PAD stays 0');
  const hurt2 = createState({ seed: 5, traceBulletSlots: 0 });
  installRoster(hurt2, { charIds: NORMAL_ROUTE_PARTY, sideb: false });
  hurt2.knight = { ...hurt2.knight };
  hurt2.partyHp = [11, 12, 13];
  applyKnightMode(hurt2, KNIGHT_MODE_PRACTICE);
  assertEq(hurt2.partyHp.join(','), '11,12,13', 'practice mode heals NOBODY at Create (only no-hit does)');

  // The named form, and the default page's contract.
  const named = createState({ seed: 7, traceBulletSlots: 8 });
  buildKaizoScene(named, { version: 'C', mode: 'practice' });
  assertEq(named.kaizo.practicemode, true, 'buildKaizoScene({ mode: "practice" }) reaches the knight');
  const page = createState({ seed: 7, traceBulletSlots: 8 });
  buildKaizoScene(page, { version: 'C' });
  assertEq(page.kaizo.practicemode, false, 'THE DEFAULT PAGE IS UNCHANGED: no mode -> Standard behaviour');
  assertEq(page.kaizo.nohitmode, false, '...on both flags');
  let threw = false;
  try {
    buildKaizoScene(createState({ seed: 7 }), { version: 'C', mode: 'nohitt' });
  } catch { threw = true; }
  assert(threw, 'a misspelt mode is an error, not a silent Standard');
}

// ── 1. damage.js gloomAccrue ───────────────────────────────────────────────
section('READER 1 — kaizo/party/damage.js gloomAccrue (scr_damage:245-265)');
{
  const off = mk({ mode: KNIGHT_MODE_STANDARD });
  gloomAccrue(off, 1, 12);
  const on = mk({ mode: KNIGHT_MODE_PRACTICE });
  gloomAccrue(on, 1, 12);
  assert((off.kaizo.gloom?.[0] ?? 0) > 0, `Standard banks gloom (${off.kaizo.gloom?.[0]})`);
  assertEq(on.kaizo.gloom?.[0] ?? 0, 0, 'practice mode takes the else arm and WIPES it');
}

// ── 2/3. damage.js practiceHp, through both damage entry points ────────────
section('READERS 2+3 — practiceHp: scrDamage and scrDamageMaxhp');
{
  for (const [label, hit] of [
    ['scrDamage', (s) => scrDamage(s, 60, 0)],
    ['scrDamageMaxhp', (s) => scrDamageMaxhp(s, 0.25, true, false, { target: 0 })],
  ]) {
    const off = mk({ mode: KNIGHT_MODE_STANDARD });
    off.invTimer = -1;
    const before = off.partyHp.slice();
    hit(off);
    assert(off.partyHp.some((h, i) => h < before[i]), `${label}: Standard really costs HP`);

    const on = mk({ mode: KNIGHT_MODE_PRACTICE });
    on.invTimer = -1;
    hit(on);
    // THE MAX IS THE ROSTER'S, not the vanilla table's: this state is the
    // Weird Route pair, so slot 1 is Noelle's 120 and not Susie's 190.
    const max = on.partyHp.map((_, i) => maxhpOfChar(on, charIdOf(on, i)));
    assertEq(on.partyHp.join(','), max.join(','),
      `${label}: practice mode leaves everyone at max (the 2x/1x dance)`);
  }
}

// ── 4. freeze.js kaizoAdvanceBalloon ───────────────────────────────────────
section('READER 4 — kaizo/party/freeze.js kaizoAdvanceBalloon (Step_0:206-211)');
{
  // A-SIDE, Susie present: the reset fires ONLY because of practicemode.
  const engine = () => 'ENGINE-LINE';
  const off = mk({ charIds: NORMAL_ROUTE_PARTY, sideb: false, mode: KNIGHT_MODE_STANDARD });
  const dlgOff = { balloonturn: 5 };
  assertEq(kaizoAdvanceBalloon(dlgOff, off, engine), 'ENGINE-LINE',
    'Standard defers to the engine\'s own balloon advance');
  assertEq(dlgOff.balloonturn, 5, '...and does not touch balloonturn');

  const on = mk({ charIds: NORMAL_ROUTE_PARTY, sideb: false, mode: KNIGHT_MODE_PRACTICE });
  const dlgOn = { balloonturn: 5 };
  const line = kaizoAdvanceBalloon(dlgOn, on, engine);
  assert(line !== 'ENGINE-LINE', 'practice mode takes the RESET arm instead');
  assertEq(dlgOn.balloonturn, 0, '...balloonturn knocked to -1 then incremented to 0: no taunt can match');
}

// ── 5. gloom.js kaizoGloomAccrue ───────────────────────────────────────────
section('READER 5 — kaizo/party/gloom.js kaizoGloomAccrue');
{
  const off = mk({ mode: KNIGHT_MODE_STANDARD });
  const bankedOff = kaizoGloomAccrue(off, 0, 12, { cap45: true });
  const on = mk({ mode: KNIGHT_MODE_PRACTICE });
  const bankedOn = kaizoGloomAccrue(on, 0, 12, { cap45: true });
  assert(bankedOff > 0, `Standard accrues (${bankedOff})`);
  assertEq(bankedOn, 0, 'practice mode accrues nothing');
  assertEq(on.kaizo.gloom?.[0] ?? 0, 0, '...and the ledger cell is cleared');
}

// ── 6. spells.js stepThornringTick ─────────────────────────────────────────
section('READER 6 — kaizo/party/spells.js stepThornringTick (obj_battlecontroller:1544-1567)');
{
  const off = mk({ mode: KNIGHT_MODE_STANDARD });
  installKaizoMenu(off);
  const noelleOff = off.partyHp[1];
  stepThornringTick(off);
  assert(off.partyHp[1] < noelleOff, `Standard: the ring takes a point (${noelleOff} -> ${off.partyHp[1]})`);

  const on = mk({ mode: KNIGHT_MODE_PRACTICE });
  installKaizoMenu(on);
  const noelleOn = on.partyHp[1];
  stepThornringTick(on);
  assertEq(on.partyHp[1], noelleOn, 'practice mode: _dotick = 0, the ring is inert');
}

// ── 7. scenes.js scrMnendturnScenes ────────────────────────────────────────
section('READER 7 — kaizo/party/scenes.js scrMnendturnScenes (scr_mnendturn:148-169)');
{
  const armed = (mode) => {
    const st = mk({ mode });
    st.knight.turnsafternohit = NH_ARM_TURNS;
    return scrMnendturnScenes(st);
  };
  const off = armed(KNIGHT_MODE_STANDARD);
  assertEq(off.nh, true, 'Standard arms the no-hit scene');
  const on = armed(KNIGHT_MODE_PRACTICE);
  assertEq(on.nh, false, 'practice mode suppresses BOTH arms');
  assertEq(on.tp, false, '...the tp arm too');
}

// ── 8. scenes.js armHpscene ────────────────────────────────────────────────
section('READER 8 — kaizo/party/scenes.js armHpscene (Step_0:54-63)');
{
  const over = (mode) => {
    const st = mk({ charIds: NORMAL_ROUTE_PARTY, sideb: false, mode });
    st.partyHp[0] = 250;              // Kris's ceiling is 200
    return armHpscene(st);
  };
  assertEq(over(KNIGHT_MODE_STANDARD), true, 'Standard: an overlevelled save arms k_hpscene');
  assertEq(over(KNIGHT_MODE_PRACTICE), false, 'practice mode suppresses it whole');
  assertEq(over(KNIGHT_MODE_NOHIT), false, 'no-hit mode suppresses it too (BOTH terms are live)');
}

// ── 9. scenes.js — the no-hit scene's own nohitmode abort ──────────────────
section('READER 9 — kaizo/party/scenes.js k_nhscene state 5 (Step_0:1493)');
{
  const drive = (mode) => {
    const st = mk({ mode });
    st.knight.turnsafternohit = NH_ARM_TURNS;
    scrMnendturnScenes(st);
    run(st, 600, (s) => s.kaizo.nhscene === 0 && s.frame > 5);
    return st;
  };
  const off = drive(KNIGHT_MODE_STANDARD);
  assert(off.partyHp[0] <= 0 || off.kaizo.mnfight !== 99,
    'Standard: the scene runs its course (it does not hand back through mnfight 99)');
  const on = drive(KNIGHT_MODE_NOHIT);
  assertEq(on.kaizo.nhscene, 0, 'no-hit mode aborts the scene to 0');
  assertEq(on.kaizo.mnfight, 99, '...and hands back through mnfight 99');
  assertEq(on.partyHp[0], PARTY[0].maxhp, '...killing nobody');
}

// ── 10. scenes.js — the SnowGrave scene's nohitmode abort ──────────────────
section('READER 10 — kaizo/party/scenes.js k_sgscene state 6');
{
  const drive = (mode) => {
    const st = mk({ mode });
    castSnowgrave(st, { caster: 1, magic: 13 });
    const sc = ensureScenes(st);
    run(st, 600, (s) => { sc.sg.target = 0; return false; });
    return st;
  };
  const on = drive(KNIGHT_MODE_NOHIT);
  assertEq(on.kaizo.sgscene, 0, 'no-hit mode settles the sg scene back at 0');
  assert(!on.kaizo.freeze[0] && !on.kaizo.freeze[1], '...freezing nobody');
  const off = drive(KNIGHT_MODE_STANDARD);
  assert(!!(off.kaizo.freeze[0] || off.kaizo.freeze[1]),
    'CONTROL: Standard freezes somebody, so the abort is the mode and not the harness');
}

// ── 11-13. vc-hooks.js — the turn-end message block ────────────────────────
section('READERS 11-13 — kaizo/scenes/kaizo-vc-hooks.js sidebTurnEndMessages (Step_0:679, :751, :771)');
{
  // The observable that needs no particular attack: the k_lastpro latch.
  //     if (!progamer && lastpro && !practicemode) { lastpro = false; ... }
  // The two message arms above it (:679 RoaringDelta, :751 Multislash2) sit
  // behind the SAME `!practicemode`, read from the same local, one line up.
  const latch = (mode) => {
    const st = mk({ mode });
    st.knight.progamer = false;
    st.knight.lastpro = true;
    st.knight.didfullnohit = false;
    const hooks = vcHooks({ sideb: true });
    hooks.advance(st, { table: VD_TABLE }, { prevPhase: 1, prevTurn: 0 });
    return st.knight.lastpro;
  };
  assertEq(latch(KNIGHT_MODE_STANDARD), false, 'Standard: the turn end clears k_lastpro');
  assertEq(latch(KNIGHT_MODE_PRACTICE), true, 'practice mode: the whole block is skipped, latch untouched');
}

// ── 14. the practice HUD, honestly absent ──────────────────────────────────
section('READER 14 — the practice HUD (Draw_64:8-227) is NOT translated');
{
  // Listed so the count of fourteen is honest. If a text layer ever lands,
  // this assertion is the thing that tells you to wire the HUD too.
  const drawn = await import('../../render/draw/tracking.js');
  assertEq(typeof drawn.drawPracticeHud, 'undefined',
    'no practice HUD exists yet — the debug overlay stays a ledger row, not a silent gap');
}

console.log(`\ncheck-knight-mode: ${count - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
