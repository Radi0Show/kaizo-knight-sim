#!/usr/bin/env node
// KAIZO — k_hpscene, THE MAX-HP SHEAR. The fourth turn-hijacking scene, and
// the only one an A-Side (Normal Route) run can reach.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C).
//
// PROVENANCE of every expectation below (kaizo dump,
// knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/):
//   gml_Object_obj_knight_enemy_Step_0.gml   54-63     THE ARM, inside
//                                                      `if (damagereductiontimer == 1)`
//                                            1771-1929 THE SCENE
//                                            1849      the `hp_scene` typo
//                                            2050-2052 the shared float
//   gml_GlobalScript_scr_marker.gml                    the slash mark
//   gml_GlobalScript_scr_minishakeobj.gml              the state-2 shudder
//   gml_Object_obj_shakeobj_{Create_0,Other_10,Step_0}.gml
//   gml_GlobalScript_snd_play.gml:1                    (volume, pitch) order
//   gml_GlobalScript_scr_complete_save_file.gml:269    get_swordcolor
//   gml_Object_obj_battlecontroller_Step_0.gml:23      what special_con does
//
// WHY IT DRIVES A REAL FIGHT RATHER THAN CALLING THE MODULE. This scene's
// whole subject is the turn it takes away: it arms on the knight's FIRST STEP,
// before the opening menu has ever been drawn, and it hands a turn back by
// hand at the end. Calling stepHpscene in a loop would prove the ladder and
// nothing about the hijack, so every block below builds through
// buildKaizoScene and steps through the real director — the same shape
// check-weirdroute-live.mjs uses.
//
// EVERY BLOCK ASSERTS WHAT THE SCENE *CHANGES*, because "the machine ran and
// nothing happened" and "the machine never ran" look identical to a
// regression test (CLAUDE.md, "A green suite does not mean a change took
// effect"). Specifically:
//   - the party's max HP really falls, 300 -> 200/230/180, ON THE FRAME state
//     6 runs and not before; the control is a party ALREADY under the
//     ceilings, which never arms the scene at all;
//   - the turn is really taken: the opening menu, which a default run opens on
//     frame 1, is held shut for 106 frames and opens on the hand-back frame;
//   - the poses land on the LIVE obj_knight_enemy instance, not on a shadow;
//   - the mod's `hp_scene = 5.1` typo is preserved, and its consequence —
//     states 5 through 8 each running exactly TWICE — is asserted as a number;
//   - THE KINEMATIC HALF, added 2026-09-10 after a review found ten poses and
//     moves that could be deleted (five of them inverted) with this file still
//     at 158/158: the bob, the 44-pixel leap, the float release, the drop, the
//     dive, the held pose, the screen shake, the afterimage reparent and both
//     halves of the way home. `sc.lerps` is read here for the first time;
//   - THE HAND-BACK IS ASSERTED AT ITS EFFECT — `state.menu.charturn`, the
//     address sim/menu.js and render/menu.js actually use — and not at
//     `state.kaizo.charturn`, which nothing in this repo reads.
//
//     node kaizo/tools/checks/check-hpscene.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import { PARTY as SIM_PARTY } from '../../../sim/damage.js';
import { spawn } from '../../../sim/entity.js';
import {
  ensureScenes, sceneActive, sceneHijacksTurn, sceneReport, visitedStates,
  sceneDraws, armHpscene, stepHpscene, HP_CEILINGS, HP_SCENE_STATES, HP_CUT_AT,
  scrMinishakeobj, shakeObjTarget, sceneMarker,
  kaizoSceneDriver, scrMnendturnScenes, NH_ARM_TURNS,
  applySceneHandbackCharturn,
} from '../../party/scenes.js';
import { getSwordcolor } from '../../attacks/kaizo-colors.js';
import {
  CHAR_KRIS, CHAR_NOELLE, maxhpOfChar, installRoster,
} from '../../party/roster.js';
// The two READERS the last two blocks assert through, rather than asserting
// the variables the mod happens to name. gloom.js's scrIsphaseBullets is the
// only reader of `state.kaizo.mnfight` in this repo; freeze.js's downLatch is
// the only latch downMessages consults.
import { scrIsphaseBullets } from '../../party/gloom.js';
import { downMessages, ensureFreezeState } from '../../party/freeze.js';

let failures = 0;
let checks = 0;
function ok(cond, label) {
  checks += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); }
}
function eq(got, want, label) {
  checks += 1;
  if (got !== want) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}
function near(got, want, tol, label) {
  checks += 1;
  if (!(Math.abs(got - want) <= tol)) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${got}, want ${want} +-${tol}`);
  }
}
function deepEq(got, want, label) { eq(JSON.stringify(got), JSON.stringify(want), label); }
function section(name) { console.log(`\n── ${name}`); }

const IDLE = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

/**
 * A real V-C or V-D fight. `over` is THE IMPORTED OVERLEVELLED SAVE the scene
 * exists to punish: `global.maxhp` and `global.hp` are the two arrays the arm
 * reads (Step_0:56, :60), and here they are `state.partyMaxhp` (the
 * slot-indexed mirror) and `state.partyHp`, plus the roster member's own
 * `maxhp` on a version that fields one.
 *
 * V-C installs NO roster, so its `state.partyMaxhp` does not exist until
 * something makes it — which is the exact shape the scene has to cope with,
 * and the reason this helper writes the array rather than a roster.
 */
function build({
  version = 'C', over = null, seed = 12345, knight = null,
} = {}) {
  const st = createState({ seed, traceBulletSlots: 0 });
  buildKaizoScene(st, { version });
  if (over) {
    const n = st.kaizo.roster ? st.kaizo.roster.length : 3;
    st.partyMaxhp = Array.from(
      { length: n },
      (_, i) => (st.kaizo.roster ? st.kaizo.roster[i].maxhp : SIM_PARTY[i].maxhp),
    );
    for (let i = 0; i < n; i++) {
      if (over.maxhp !== undefined) {
        st.partyMaxhp[i] = over.maxhp;
        if (st.kaizo.roster) st.kaizo.roster[i].maxhp = over.maxhp;
      }
      if (over.hp !== undefined) st.partyHp[i] = over.hp;
    }
  }
  if (knight) Object.assign(st.knight, knight);
  return st;
}

/** Step a real fight, recording one row per frame from `probe`. */
function run(st, frames, probe = null) {
  const rows = [];
  for (let f = 0; f < frames; f++) {
    stepFrame(st, IDLE);
    if (probe) rows.push(probe(st));
  }
  return rows;
}

/** The live obj_knight_enemy instance — the thing the poses must land on. */
function knightInstance(st) {
  return st.entities.find((e) => e.alive && e.type?.name === 'obj_knight_enemy');
}
function marks(st) {
  return st.entities.filter((e) => e.alive && e.type === sceneMarker);
}
function shakeobjs(st) {
  return st.entities.filter((e) => e.alive && e.type === shakeObjTarget);
}
/** The hp ladder as `[frame, value]` pairs. */
function ladder(st) {
  return ensureScenes(st).log.filter((t) => t.scene === 'hp').map((t) => [t.frame, t.to]);
}
/** The frame a given ladder value was first reached. */
function at(st, value) {
  const row = ladder(st).find((r) => r[1] === value);
  return row ? row[0] : null;
}

// ── REPORT, DO NOT THROW ────────────────────────────────────────────────────
// Every read of a receipt this scene may not have produced goes through one of
// these. The sabotage most likely to arrive in a merge is THE ARM NOT FIRING:
// `armedBy`, `cut` and `handback` are all null then, and a bare dereference
// turns 150 assertions into one stack trace. The exit code is 1 either way —
// the gate holds — but a check that dies at assertion 8 cannot say WHICH
// behaviours went with it, and that is the whole job of a regression check.
// Sabotage-tested: with `armHpscene` forced to decline, this file now prints
// every failing assertion and still exits 1.

/** `sc.hp.cut`, shaped so a missing receipt reads as "cut nothing". */
function cutOf(st) {
  return ensureScenes(st).hp.cut ?? { maxhp: {}, hp: {} };
}
/** `sc.hp.handback`, shaped so a missing hand-back reads as absent. */
function handbackOf(st) {
  return ensureScenes(st).hp.handback ?? {};
}
/** One `before`/`after` pair, absent when the character was not written. */
function cutPair(st, which, charId) {
  return cutOf(st)[which][charId] ?? { before: null, after: null };
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE CONTROL: a default party never arms it, and the fight runs anyway');
{
  // scr_gamestart's chapter-3 block: Kris 160, Susie 190, Ralsei 140 — under
  // every one of HP_CEILINGS' 200 / 230 / 180 / 180. The scene CANNOT fire on
  // a legitimate save, which is why this lane cannot move the A-Side byte gate.
  const st = build({ version: 'C' });
  deepEq(st.partyHp, [160, 190, 140], 'control: the default chapter-3 party HP');
  let menuOpenedAt = -1;
  run(st, 400, (s) => {
    if (menuOpenedAt < 0 && s.menu?.open) menuOpenedAt = s.frame;
    return null;
  });
  // NON-VACUOUS: the fight really ran. Without this, "never armed" is also
  // what a fight that never stepped would report.
  eq(menuOpenedAt, 1, 'control: the opening menu opens on frame 1 (the fight ran)');
  ok(st.knight.damagereductiontimer > 300, 'control: the knight stepped every frame');
  eq(st.kaizo.hpscene ?? 0, 0, 'control: k_hpscene never left 0');
  eq(st.kaizo.scenes, undefined, 'control: the scene state was never even stood up');
  ok(!sceneActive(st), 'control: no scene is running');
  ok(!sceneHijacksTurn(st), 'control: special_con never rose');
  for (let i = 0; i < 3; i++) {
    eq(st.partyHp[i], SIM_PARTY[i].maxhp, `control: slot ${i} keeps its HP`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE ARM — Step_0:54-63, on the knight\'s FIRST STEP');
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  // damagereductiontimer++ is Step_0:31, the `== 1` block is :32-114 and the
  // arm is :54-63 inside it. One frame of the whole fight.
  run(st, 1);
  eq(st.knight.damagereductiontimer, 1, 'the arm frame IS damagereductiontimer 1');
  ok((st.kaizo.hpscene ?? 0) > 0, 'k_hpscene armed on the knight\'s first Step');
  eq(at(st, 1), 0, 'and it armed on frame 0, not later');
  // Both `if`s are evaluated and either can arm alone.
  deepEq(ensureScenes(st).hp.armedBy, { maxhp: 1, hp: 1 },
    'both arm tests fired (maxhp at :56 AND hp at :60), naming Kris');
}
{
  // MAXHP OVER, HP UNDER — the first `if` alone. A save levelled up and then
  // beaten down: only :56 can see it.
  const st = build({ version: 'C', over: { maxhp: 300, hp: 50 } });
  run(st, 1);
  ok((st.kaizo.hpscene ?? 0) > 0, 'maxhp alone arms it');
  deepEq(ensureScenes(st).hp.armedBy, { maxhp: 1, hp: null },
    '...through the :56 test only');
}
{
  // HP OVER, MAXHP UNDER. Not reachable by levelling, but it is what the
  // second `if` is FOR, and the two tests are separate statements.
  const st = build({ version: 'C' });
  st.partyHp = [300, 190, 140];
  run(st, 1);
  ok((st.kaizo.hpscene ?? 0) > 0, 'hp alone arms it');
  deepEq(ensureScenes(st).hp.armedBy, { maxhp: null, hp: 1 },
    '...through the :60 test only');
}
{
  // `!practicemode && !nohitmode` — :54. Either suppresses it whole.
  for (const flag of ['practicemode', 'nohitmode']) {
    const st = build({
      version: 'C', over: { maxhp: 300, hp: 300 }, knight: { [flag]: true },
    });
    run(st, 4);
    eq(st.kaizo.hpscene ?? 0, 0, `${flag} suppresses the arm (:54)`);
    eq(st.kaizo.scenes, undefined, `${flag}: and the scene state stays absent`);
  }
}
{
  // THE THRESHOLD IS `>`, NOT `>=`. Exactly at the ceiling is legal.
  const st = build({ version: 'C', over: { maxhp: 180, hp: 180 } });
  st.partyMaxhp = [200, 230, 180];
  st.partyHp = [200, 230, 180];
  run(st, 4);
  eq(st.kaizo.hpscene ?? 0, 0, 'a party sitting EXACTLY on the ceilings does not arm');
  // ...and one point over does.
  const st2 = build({ version: 'C' });
  st2.partyMaxhp = [201, 230, 180];
  st2.partyHp = [201, 230, 180];
  run(st2, 1);
  ok((st2.kaizo.hpscene ?? 0) > 0, 'one point over Kris\'s 200 arms it');
  // `?? {}` RATHER THAN A BARE READ, here and at the V-D twin below. The
  // sabotage most likely to arrive in a merge is the arm not firing at all,
  // and `armedBy` is null then: a bare `.maxhp` THREW, so the run stopped at
  // assertion 8 of 158 with a stack trace and hid the 150 behind it. The exit
  // code was still 1 and the gate still held, but a check that dies is a
  // check that cannot say what broke.
  eq((ensureScenes(st2).hp.armedBy ?? {}).maxhp, CHAR_KRIS,
    '...and names Kris (char id 1)');
}
{
  // `scr_havechar(c)` — the test walks `global.char[0..2]`, so a character who
  // is not in THIS fight cannot arm the scene. On the Weird Route global.char
  // is [1, 4, 0]: Susie (2) and Ralsei (3) have no cell at all, and the arm
  // reads 0 for both however the save was levelled.
  const st = build({ version: 'D' });
  run(st, 4);
  eq(st.kaizo.hpscene ?? 0, 0,
    'V-D: the Weird Route pair (Kris 160, Noelle 120) is under every ceiling');
  // (The scene state DOES exist on V-D — the B-Side drives all four scenes
  // every frame — so the honest assertion here is that the arm never fired,
  // not that the state is absent. The "never stood up" claim belongs to V-C,
  // where it is asserted in THE CONTROL above.)
  eq(ensureScenes(st).hp.armedBy, null, 'V-D: ...and the arm never fired');

  // ...and NOELLE's own ceiling is 180 at CHARACTER id 4, not at her slot (1).
  // Slot 1 is what Susie occupies on the A-Side, whose ceiling is 230 — so a
  // slot-indexed read would need 231 here and a character-indexed one 181.
  const st2 = build({ version: 'D' });
  st2.kaizo.roster[1].maxhp = 200;
  st2.partyMaxhp = [160, 200];
  run(st2, 4);
  ok((st2.kaizo.hpscene ?? 0) > 0,
    'V-D: Noelle at 200 arms it — 200 > 180 (char id 4), not > 230 (slot 1)');
  eq((ensureScenes(st2).hp.armedBy ?? {}).maxhp, CHAR_NOELLE,
    '...and the arm names character 4');
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE HIJACK — the turn the scene takes, measured against the control');
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  let menuOpenedAt = -1;
  const hijacked = [];
  run(st, 200, (s) => {
    if (menuOpenedAt < 0 && s.menu?.open) menuOpenedAt = s.frame;
    if (sceneHijacksTurn(s)) hijacked.push(s.frame);
    return null;
  });
  // `?? {}` rather than a bare read: a sabotage that stops the scene stepping
  // at all leaves this null, and a check that THROWS there reports a stack
  // trace instead of the assertion that would name the defect.
  const handback = handbackOf(st);
  ok(handback.frame > 0, 'the scene reached its hand-back');
  // THE HEADLINE. The control above opens the menu on frame 1; here it is held
  // shut for the whole scene and opens on the very frame state 8 runs.
  eq(menuOpenedAt, handback.frame ?? -1, 'the opening menu opens ON the hand-back frame');
  ok(menuOpenedAt > 100, `...and not before (${menuOpenedAt} frames of held turn)`);
  // Every frame from the arm to the frame BEFORE the hand-back. The hand-back
  // frame itself reads 0, because :1924 releases special_con inside it.
  eq(hijacked.length, (handback.frame ?? 0) - 1, 'special_con held for every frame up to it');
  eq(hijacked[0], 1, '...starting with the first frame after the arm');
  eq(hijacked[hijacked.length - 1], (handback.frame ?? 0) - 1, '...and ending the frame before');
  eq(st.kaizo.specialCon, 0, 'special_con released at :1924');
  ok(!sceneHijacksTurn(st), 'the battle controller runs again');
  ok(!sceneActive(st), 'no scene is running');
  eq((st.kaizo.launched ?? []).length, 0, 'no attack launched while the turn was held');
}
{
  // The four globals state 1 writes (:1780-1782 plus :1776).
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  run(st, 2);
  eq(st.kaizo.specialCon, 1, 'special_con = 1 (:1776, re-asserted every frame)');
  eq(st.kaizo.mnfight, 99, 'global.mnfight = 99 (:1781)');
  eq(st.kaizo.myfight, 99, 'global.myfight = 99 (:1782)');
  eq(st.kaizo.charturn, -1, 'global.charturn = -1 (:1780)');
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE LADDER — exact states, exact delay frames');
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  run(st, 200);
  deepEq(visitedStates(st, 'hp'),
    [1, 1.1, 2, 2.1, 3, 3.1, 4, 4.1, 5, 6, 6.1, 7, 7.1, 7.2, 8, -1],
    'the hp scene walked the whole Step_0:1774-1928 ladder');
  // 5 IS IN THE LADDER, but ONLY as the value state 4's alarm assigned. The
  // branch itself never writes k_hpscene (that is the typo), so there is no
  // 5 -> anything transition and no 5.1 anywhere. Its execution is proved by
  // `runs` in the next block, not by the ladder.
  ok(!visitedStates(st, 'hp').includes(5.1),
    'k_hpscene never became 5.1 — the typo wrote a different variable');
  ok(!ensureScenes(st).log.some((t) => t.scene === 'hp' && t.from === 5 && t.to !== 6),
    'the only transition OUT of 5 is the delay\'s to 6');

  // Every gap is a scr_delay_var, and each is an ALARM: arm on frame N with n
  // and the knight's Step sees the new value on frame N + n exactly.
  //
  // The `from` frame is the state's own landing, which for most rows is the
  // `wait` value it parks on (assigned in the same Step). TWO rows cannot use
  // that: state 5 never assigns anything, and states 7 and 7.2 BOTH park on
  // 7.1 — so `at(7.1)` is state 7's frame and would measure 7.2's delay from
  // the wrong end. Both fall back to the state's own landing value.
  const landing = { 5: 5, 7.2: 7.2 };
  for (const row of HP_SCENE_STATES.filter((r) => r.delay)) {
    const from = at(st, landing[row.at] ?? row.wait);
    const to = at(st, row.delay[0]);
    if (from === null || to === null) { ok(false, `delay ${row.at} -> ${row.delay[0]} present`); continue; }
    eq(to - from, row.delay[1],
      `delay ${row.at} -> ${row.delay[0]} is ${row.delay[1]} frames`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE PRESERVED BUG — `hp_scene = 5.1` (Step_0:1849, no `k_`)');
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  run(st, 200);
  const sc = ensureScenes(st);
  // `hp_scene` occurs exactly once in the whole kaizo dump and has no reader,
  // so k_hpscene stays 5 for both frames of the two-frame delay.
  eq(sc.hp.hpSceneTypo, 2, 'the dead `hp_scene` write happened TWICE');
  eq(sc.hp.runs[5], 2, 'state 5 ran twice — the branch could not clear itself');
  // ...and the doubling propagates, exactly two deep, to the end of the scene.
  for (const s of [6, 7, 7.2, 8]) {
    eq(sc.hp.runs[s], 2, `state ${s} ran twice (the bug's second alarm)`);
  }
  for (const s of [1, 2, 3, 4]) {
    eq(sc.hp.runs[s], 1, `state ${s} ran ONCE (the bug starts at 5)`);
  }
  // It does not compound: 6, 7 and 7.2 each park on a wait value, so each run
  // arms exactly one successor. (The WAIT values — 1.1, 6.1, 7.1 and the rest
  // — run every frame the scene idles and are not branches; only the nine
  // rows of HP_SCENE_STATES are.)
  const branches = HP_SCENE_STATES.map((r) => r.at);
  ok(!branches.some((s) => (sc.hp.runs[s] ?? 0) > 2),
    'no BRANCH ran more than twice — the cascade is bounded');
  ok(branches.every((s) => (sc.hp.runs[s] ?? 0) >= 1),
    'and every branch in the table actually ran');
  // The audible half: two snd_knight_cut per run, so four in the fight.
  eq(sc.msgs.filter((m) => /Not so fast/.test(m.text)).length, 2,
    'the hand-back message is set twice, as the mod sets it');
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE MECHANIC — state 6 shears global.maxhp, and global.hp follows');
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  // Step to the frame BEFORE the cut and prove nothing has been taken yet.
  let cutFrame = -1;
  const before = [];
  for (let f = 0; f < 200; f++) {
    stepFrame(st, IDLE);
    if (cutFrame < 0) {
      if (ensureScenes(st).hp.cut) { cutFrame = st.frame; } else before.push([...st.partyMaxhp]);
    }
  }
  ok(cutFrame > 0, 'the cut landed');
  deepEq(before[before.length - 1], [300, 300, 300],
    'the frame before it, every max HP is still 300 — the cut is state 6\'s');
  eq(cutFrame, at(st, 6) + 1,
    'and it landed on the frame k_hpscene reached 6 (state.frame is one past it)');
  // THE NUMBERS. min(maxhp[c], 200/230/180/180), then hp[c] = min(hp[c], maxhp[c]).
  deepEq(st.partyMaxhp, [200, 230, 180], 'max HP sheared to Kris 200 / Susie 230 / Ralsei 180');
  deepEq(st.partyHp, [200, 230, 180], 'and current HP was clamped to the new maxima');
  for (const c of [1, 2, 3]) {
    eq(cutPair(st, 'maxhp', c).before, 300, `char ${c}: 300 before`);
    eq(cutPair(st, 'maxhp', c).after, HP_CEILINGS[c], `char ${c}: ${HP_CEILINGS[c]} after`);
  }
  eq(HP_CUT_AT, 6, 'the module names state 6 as the cutting state');
}
{
  // THE min() IS A FLOOR, NOT AN ASSIGNMENT: a character already under the
  // ceiling keeps their own number. Ralsei is 140 here and stays 140 while
  // Kris, who armed the scene, is cut.
  const st = build({ version: 'C' });
  st.partyMaxhp = [300, 190, 140];
  st.partyHp = [300, 190, 140];
  run(st, 200);
  deepEq(st.partyMaxhp, [200, 190, 140],
    'min() leaves Susie 190 and Ralsei 140 untouched and cuts Kris to 200');
  deepEq(st.partyHp, [200, 190, 140], '...and only Kris\'s HP is clamped');
}
{
  // V-D: THE CUT MUST REACH THE ROSTER MEMBER, not just the slot mirror.
  // kaizo/party/damage.js reads every ratio in the targeting tree through
  // maxhpOfChar, which reads `member.maxhp` — a cut that landed only in
  // state.partyMaxhp would be the same defect as the four `idlesprite` writes
  // that went to the knight record instead of the instance.
  const st = build({ version: 'D', over: { maxhp: 300, hp: 300 } });
  run(st, 200);
  eq(maxhpOfChar(st, CHAR_KRIS), 200, 'V-D: the ROSTER member Kris reads 200');
  eq(maxhpOfChar(st, CHAR_NOELLE), 180, 'V-D: the ROSTER member Noelle reads 180');
  eq(st.partyMaxhp[0], 200, 'V-D: and the slot mirror agrees for Kris');
  eq(st.partyMaxhp[1], 180, 'V-D: and for Noelle');
  const cut = cutOf(st);
  ok(cut.maxhp[CHAR_NOELLE] !== undefined,
    'Noelle is cut by CHARACTER id 4, not by her slot (1)');
  ok(cut.maxhp[2] === undefined && cut.maxhp[3] === undefined,
    'Susie and Ralsei, absent from global.char, are not written');
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE POSES LAND ON THE LIVE obj_knight_enemy INSTANCE');
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  const rows = run(st, 200, (s) => {
    const kn = knightInstance(s);
    return {
      f: s.frame,
      hp: s.kaizo.hpscene,
      spr: kn?.sprite_index,
      anim: s.knight.animState,
      x: kn?.x,
      y: kn?.y,
      ii: kn?.image_index,
      depth: kn?.depth,
    };
  });
  const row = (f) => rows.find((r) => r.f === f) ?? {};
  const home = row(1);
  ok(!!knightInstance(st), 'there is a live obj_knight_enemy to pose');
  // state 1 (:1783-1784): `state = 10` and the idle pose.
  eq(home.anim, 10, 'state 1 put the instance in animState 10 (`state = 10`)');
  eq(home.spr, 'spr_roaringknight_idle', 'state 1 wore `idlesprite`');
  // state 2 (:1791-1794): x += 26, y += -44, spr_roaringknight_flurry_prepare.
  const puff = row(at(st, 2.1) + 1);
  eq(puff.spr, 'spr_roaringknight_flurry_prepare', 'state 2 wore the puff pose');
  near(puff.x, home.x + 26, 0.001, 'state 2 moved him 26 right ON THE INSTANCE');
  // state 3 (:1828-1832): x -= 12, y += 44, the attack overlay at frame 1, and
  // the dive into obj_battlecontroller.depth - 10.
  const swing = row(at(st, 3.1) + 1);
  eq(swing.spr, 'spr_roaringknight_attack_ol', 'state 3 wore spr_roaringknight_attack_ol');
  eq(swing.ii, 1, 'state 3 set image_index 1');
  eq(swing.depth, -10, 'state 3 dived to obj_battlecontroller.depth - 10 (fallback 0)');
  near(swing.x, puff.x - 12, 0.001, 'state 3 stepped him 12 left');
  // state 4 (:1840): image_index 2.
  eq(row(at(st, 4.1) + 1).ii, 2, 'state 4 set image_index 2');
  // state 5 (:1850-1851): image_index 3 then a two-frame lerp to 5.
  const cutRow = rows.find((r) => r.f > at(st, 4.1) + 1 && r.ii >= 3);
  ok(!!cutRow && cutRow.ii >= 3, 'state 5 drove image_index to 3 and up');
  ok(rows.some((r) => Math.abs(r.ii - 5) < 1e-9), 'the swing lerp reached image_index 5');
  // state 7.2 (:1892, :1900): back to his own depth and the idle sprite.
  const back = row(at(st, 7.2) + 1);
  eq(back.depth, home.depth, 'state 7.2 restored `remdepth`');
  eq(back.spr, 'spr_roaringknight_idle', 'state 7.2 put the idle sprite back');
  // state 8 (:1925): `state = 0` — the vanilla actor takes him back.
  eq(st.knight.animState, 0, 'state 8 handed him back to animState 0');
  near(knightInstance(st).x, knightInstance(st).xstart, 0.001,
    'and he is home at xstart');
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE SLASH MARK — scr_marker at Step_0:1813-1826');
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  let born = null;
  let peakAlpha = 0;
  let minYscale = Infinity;
  let markGoneAt = -1;
  let sawMark = false;
  run(st, 200, (s) => {
    const m = marks(s)[0];
    if (m) {
      sawMark = true;
      if (!born) {
        born = {
          f: s.frame,
          x: m.x,
          y: m.y,
          xs: m.image_xscale,
          ys: m.image_yscale,
          a: m.image_alpha,
          ang: m.image_angle,
          blend: m.image_blend,
          depth: m.depth,
        };
      }
      peakAlpha = Math.max(peakAlpha, m.image_alpha);
      minYscale = Math.min(minYscale, m.image_yscale);
    } else if (sawMark && markGoneAt < 0) markGoneAt = s.frame;
    return null;
  });
  ok(!!born, 'the mark was created');
  // REPORT, DO NOT THROW — see the helpers at the top of this file.
  if (!born) born = {};
  eq(born.f, at(st, 3.1) + 1, 'on the frame state 3 ran');
  // camerax() + 320, cameray() + 339 — the middle of a 640x480 view.
  eq(born.x, 320, 'x = camerax() + 320');
  eq(born.y, 339, 'y = cameray() + 339');
  eq(born.xs, 120, 'image_xscale 120 — a screen-wide sliver');
  eq(born.ys, 11, 'image_yscale 11');
  eq(born.a, 0, 'image_alpha 0 (the alpha lerp starts at -0.15)');
  // THE LIST ORDER, PINNED. `choose` picks `values[u32 % argc]`, so reversing
  // the two arguments draws the SAME u32 and returns the other answer — a
  // change no draw-count audit and no `is it 20 or -20` range test can see
  // (CLAUDE.md, "Measured facts you will need"). Two seeds, measured off this
  // build, one for each branch: reverse the list and both flip.
  eq(born.ang, 20, 'image_angle is choose(20, -20); seed 12345 takes the first arm');
  {
    const alt = build({ version: 'C', over: { maxhp: 300, hp: 300 }, seed: 2 });
    let a = null;
    run(alt, 60, (s) => {
      const m = marks(s)[0];
      if (m && a === null) a = m.image_angle;
      return null;
    });
    eq(a, -20, '...and seed 2 takes the second');
  }
  deepEq(born.blend, getSwordcolor(st), 'image_blend = get_swordcolor()');
  eq(born.depth, -5, 'depth = <knight depth> + 5');
  // The four lerps ran: the sliver thins toward 0.5 and fades UP to 0.75,
  // then state 5 flashes it white and stretches it to 10.
  ok(minYscale < 1, `image_yscale lerped down past 1 (min ${minYscale.toFixed(3)})`);
  ok(peakAlpha > 0.7, `image_alpha lerped up past 0.7 (peak ${peakAlpha.toFixed(3)})`);
  ok(markGoneAt > 0, 'state 8 destroyed it (instance_destroy(hpslash_mark))');
  eq(markGoneAt, handbackOf(st).frame,
    '...on the hand-back frame');
  eq(marks(st).length, 0, 'and no obj_marker survives the scene');
}

// ═══════════════════════════════════════════════════════════════════════════
section('scr_minishakeobj — Step_0:1796, and obj_shakeobj\'s four steps');
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  const trail = [];
  run(st, 200, (s) => {
    const sh = shakeobjs(s)[0];
    const kn = knightInstance(s);
    if (sh) trail.push({ f: s.frame, amt: sh.shakeamt, x: kn.x });
    return null;
  });
  eq(ensureScenes(st).hp.minishakes, 1, 'exactly one scr_minishakeobj, at state 2');
  // REPORT, DO NOT THROW — a scene that never reached state 2 leaves this
  // empty, and `trail[0].f` would end the run here.
  const first = trail[0] ?? {};
  eq(first.f, at(st, 2.1) + 1, '...on the frame state 2 ran');
  eq(first.amt, 4, 'shakeamt 4 (scr_minishakeobj overwrites Create\'s 10)');
  // shakeamt -= 1; on *= -1; target.x = nowx + shakeamt * on -> -3, +2, -1, 0.
  const nowx = first.x;
  deepEq(trail.map((r) => Math.round(r.x - nowx)), [0, -3, 2, -1],
    'the knight is walked -3, +2, -1 around the anchor');
  eq(trail.length, 4, 'and the shakeobj lives exactly four frames');
  eq(shakeobjs(st).length, 0, 'it destroyed itself at shakeamt 0');
  // The anchor is the position AFTER `x += 26` (:1791 then :1796).
  near(nowx, 425 + 26, 0.001, 'nowx latched AFTER the state-2 hop');
}
{
  // The obj_shakeobj Step's `else instance_destroy()` — a shake whose target
  // dies goes with it, rather than throwing on a dead reference.
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  run(st, 1);
  const kn = knightInstance(st);
  const sh = scrMinishakeobj(st, kn);
  ok(!!sh, 'scr_minishakeobj returned an instance');
  eq(sh.target, kn, '...pointed at the knight');
  kn.alive = false;
  run(st, 2);
  ok(!sh.alive, 'a shakeobj whose target is gone destroys itself');
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE HAND-BACK — Step_0:1904-1928, and its index base');
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  run(st, 200);
  const hb = handbackOf(st);
  eq(st.kaizo.mnfight, 0, 'global.mnfight = 0 (:1909)');
  eq(st.kaizo.myfight, 0, 'global.myfight = 0 (:1910)');
  eq(hb.charturn, 0, 'global.charturn = 0 — Kris is up (global.hp[1] > 0)');
  eq(st.kaizo.charturn, 0, '...and it stuck');
  eq(st.kaizo.hpscene, -1, 'k_hpscene = -1, the finished value');
  eq(ensureScenes(st).knight.yoff, 0, 'k_yoff = 0 (:1926)');
}
{
  // THE INDEX BASE, ASSERTED AT ITS EFFECT. `global.hp` is CHARACTER-indexed
  // and `global.charturn` is SLOT-indexed; the two agree only for the vanilla
  // trio. With Kris down, the second test reads global.hp[2] — SUSIE's cell —
  // and hands the turn to slot 1. Driven by hand because a real fight cannot
  // start with a dead Kris.
  //
  // THE EFFECT IS `state.menu.charturn`, NOT the receipt. `sc.hp.handback` and
  // `state.kaizo.charturn` are both bookkeeping this repo has no reader for;
  // the address that decides whose panel rises and whose ACT list the picker
  // walks is sim/menu.js's `state.menu.charturn`. Asserting the receipt alone
  // is how a scene computes the right answer into a dead address — the exact
  // defect this same lane fixed for k_nhscene's four down-message latches.
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  run(st, 1);
  st.partyHp[0] = 0;                     // global.hp[1] — Kris
  const rows = run(st, 200, (s) => ({ f: s.frame, open: !!s.menu.open, ct: s.menu.charturn }));
  eq(handbackOf(st).charturn, 1,
    'a dead Kris hands the turn to slot 1 via global.hp[2]');
  eq(st.menu.charturn, 1,
    '...AND SLOT 1 REALLY TAKES THE TURN: state.menu.charturn is 1');
  ok(st.menu.open, '...with the menu actually open on it');
  // ON THE HAND-BACK FRAME ITSELF, not eventually. The director's `openMenu`
  // runs LATER IN THE SAME FRAME and is scr_mnendturn's reset — `charturn = 0`
  // — so without the re-apply the first menu frame reads slot 0 and only the
  // doubled state 8 (the `hp_scene = 5.1` bug) puts it right a frame later.
  const firstOpen = rows.find((r) => r.open) ?? {};
  eq(firstOpen.f, handbackOf(st).frame, 'the menu opens on the hand-back frame');
  eq(firstOpen.ct, 1, '...ALREADY on slot 1, not one frame late');
  // NON-VACUOUS: openMenu's own reset would have said 0 here, and does on
  // every fight where the scene never armed.
  const ctl = build({ version: 'C' });
  ctl.partyHp[0] = 0;
  run(ctl, 200);
  eq(ctl.menu.charturn, 0,
    'control: with no scene, the same dead Kris still opens the menu on slot 0');
}
{
  // ...and with both down it falls through to slot 2 unconditionally — no
  // liveness test on the third at all (:1919-1922).
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  run(st, 1);
  st.partyHp[0] = 0;
  st.partyHp[1] = 0;
  run(st, 200);
  eq(handbackOf(st).charturn, 2,
    'the final `else` hands slot 2 the turn whether or not slot 2 is alive');
  eq(st.menu.charturn, 2, '...and the menu really opens on slot 2');
}
{
  // THE ORDINARY CASE, and the one that proves the hand-back survives the
  // director's own `openMenu` (which is scr_mnendturn's reset: `charturn = 0`)
  // running later in the SAME frame.
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  const rows = run(st, 200, (s) => ({ f: s.frame, open: !!s.menu.open, ct: s.menu.charturn }));
  const hb = handbackOf(st);
  const opened = rows.find((r) => r.open) ?? {};
  eq(opened.f, hb.frame, 'the first open menu IS the hand-back frame');
  eq(opened.ct, 0, '...on slot 0, the member the scene picked');
  ok(rows.filter((r) => r.open).every((r) => r.ct === 0),
    '...and it stays there for the whole command phase');
  // ONE-SHOT, NOT A PIN (CLAUDE.md law 2): the hand-back is applied at the one
  // menu the game does not reach through scr_mnendturn, and nothing re-asserts
  // it per frame. Proved on the exported entry point rather than on the flag.
  ok(typeof hb.applied === 'boolean',
    'the hand-back receipt carries the one-shot flag the turn loop consumes');
  applySceneHandbackCharturn(st);        // consume whatever is still pending
  eq(applySceneHandbackCharturn(st), null,
    'applySceneHandbackCharturn is ONE-SHOT — a second call returns null');
  st.menu.charturn = 2;
  applySceneHandbackCharturn(st);
  eq(st.menu.charturn, 2, '...and moves nothing once consumed');
  // ...and it never stands the scene state up on a fight that has none, which
  // is what keeps the A-Side byte gate from seeing this lane.
  const clean = build({ version: 'C' });
  run(clean, 30);
  eq(applySceneHandbackCharturn(clean), null, 'a fight with no scene: no-op');
  eq(clean.kaizo.scenes, undefined, '...and the scene state is STILL absent');
}
{
  // THE DOUBLED HAND-BACK REALLY REACHES THE MENU. The `hp_scene = 5.1` typo
  // makes state 8 run twice, one frame apart, and the second run rewrites
  // `global.charturn` while the menu is ALREADY OPEN — so a player who had
  // moved on would be snapped back to the Knight's pick. That is the mod's
  // behaviour and it is the only observable proof that the scene writes
  // `state.menu.charturn` directly rather than only leaving a receipt for the
  // turn loop to honour.
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  let hbFrame = -1;
  for (let f = 0; f < 200; f++) {
    stepFrame(st, IDLE);
    if (hbFrame < 0 && handbackOf(st).frame) {
      hbFrame = handbackOf(st).frame;
      // Move the cursor the way a fast player would, between the two runs.
      st.menu.charturn = 2;
      continue;
    }
    if (st.frame === hbFrame + 1) break;
  }
  ok(hbFrame > 0, 'the scene reached its hand-back');
  eq(st.menu.charturn, 0,
    'the bug\'s SECOND state-8 run put global.charturn back on the open menu');
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE RNG BUDGET, and the sounds');
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  const cues = [];
  for (let f = 0; f < 200; f++) {
    stepFrame(st, IDLE);
    for (const c of st.audioCues ?? []) cues.push({ f: st.frame, ...c });
    st.audioCues = [];
  }
  // The whole scene spends ONE draw: choose(20, -20) at :1817. scr_marker,
  // get_swordcolor and scr_minishakeobj draw nothing.
  eq(sceneDraws(st).hp, 1, 'THE WHOLE hp SCENE SPENDS EXACTLY 1 DRAW');
  eq(sceneDraws(st).tp + sceneDraws(st).sg + sceneDraws(st).nh, 0,
    '...and none in the other three');
  const named = (n) => cues.filter((c) => c.name === n && !c.stop);
  eq(named('snd_knight_puff').length, 1, 'snd_knight_puff once, at state 2');
  eq(named('snd_knight_beam').length, 1, 'snd_knight_beam once, at state 3');
  // snd_play(arg0, VOLUME, PITCH); cue(state, name, PITCH, GAIN).
  // REPORT, DO NOT THROW — a scene that never played it leaves this empty.
  const beam = named('snd_knight_beam')[0] ?? {};
  eq(beam.pitch, 0.1, '...at pitch 0.1');
  eq(beam.gain, 0.75, '...and volume 0.75');
  eq(cues.filter((c) => c.name === 'snd_knight_beam' && c.stop).length, 2,
    'snd_stop(snd_knight_beam) twice — state 5 runs twice');
  const cutSnd = named('snd_knight_cut');
  eq(cutSnd.length, 4, 'four snd_knight_cut: two per state-5 run');
  deepEq(cutSnd.map((c) => [c.pitch, c.gain]),
    [[1, 0.8], [0.5, 0.6], [1, 0.8], [0.5, 0.6]],
    '...(pitch, volume) = (1, 0.8) then (0.5, 0.6), both times');
  // THE MUSIC IS NOT BEHIND THE SCENE GATE. obj_battlecontroller starts the
  // loop in its CREATE, and special_con only makes its STEP exit.
  const music = cues.filter((c) => c.name === 'mus_knight');
  eq(music.length, 1, 'the fight music started');
  // REPORT, DO NOT THROW. `music[0]` is undefined the moment the assertion
  // above fails, and a TypeError here would abort the run at this line and
  // hide every section after it — which is exactly the failure the rest of
  // this file was hardened against, reintroduced in the block that did the
  // hardening.
  eq(music[0]?.f ?? '(no cue)', 1, '...on frame 1, not after the scene');
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE KINEMATICS — the leap, the dive, the shake and the way home');
// THE HALF OF THIS SCENE THAT HAD NO ASSERTION AT ALL. Every behaviour below
// could be deleted — several of them inverted — with the rest of this file
// staying at 158/158 and exit 0. Measured, one sabotage at a time, before
// these blocks were written:
//   1. `k_yoff = -44` (:1793)                    THE LEAP
//   2. `k_scenefloat = 1` (:1777)                THE BOB
//   3. `k_scenefloat = 0` (:1801)                THE RELEASE
//   4. `y += 44` (:1830)                         THE DROP INTO THE SWING
//   5. the state-3 dive lerps, x +30 / y +120    THE DIVE (invertible, too)
//   6. the state-7 glide-home y lerp             THE WAY HOME
//   7. `siner2 = 0` before it (:1884)            ...and what it aims at
//   8. `image_speed = 0` (:1831)                 THE HELD POSE
//   9. `scr_shakescreen(10, 1)` (:1858)          THE IMPACT
//  10. the obj_afterimage depth reparent         THE TRAIL
//
// The scene poses the REAL instance (attachSceneKnight binds it), so every
// assertion below reads the entity. `sc.lerps` is read too: a lerp's TARGET is
// the only evidence of where a move was AIMED, the module has always written
// that array, and no check had ever opened it.
{
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  const rows = run(st, 200, (s) => {
    const kn = knightInstance(s);
    const trail = (s.entities ?? []).filter(
      (e) => e.alive && e.type?.name === 'obj_afterimage' && e.hspeed === 2,
    );
    return {
      f: s.frame,
      hp: s.kaizo.hpscene,
      x: kn?.x,
      y: kn?.y,
      ystart: kn?.ystart,
      xstart: kn?.xstart,
      // THE PROBE SAMPLES AT THE END OF THE FRAME, after sim/actors.js has
      // already done its own `siner2++` — so the float that ran inside
      // stepScenes THIS frame used `siner2 - 1`. Measured, not assumed: with
      // `siner2` itself the formula misses every frame by one step of the bob.
      sinUsed: (kn?.siner2 ?? 1) - 1,
      yoff: kn?.k_yoff,
      float: kn?.k_scenefloat,
      spd: kn?.image_speed,
      trailDepths: [...new Set(trail.map((e) => e.depth))],
      // READ THE FIELD, NOT THE INSTANCE. obj_shake decays its own shakex to 0
      // and then destroys itself, so a row that stored the entity would report
      // the value it ENDED at — 0 — however big the shake was.
      shakes: (s.entities ?? []).filter((e) => e.alive && e.type?.name === 'obj_shake').length,
      shakex: (s.entities ?? []).find((e) => e.alive && e.type?.name === 'obj_shake')?.shakex ?? null,
      vx: s.view?.x ?? 0,
    };
  });
  const row = (f) => rows.find((r) => r.f === f) ?? {};
  const inState = (v) => rows.filter((r) => r.hp === v);
  /** One f32 step at this magnitude, rounded up. See the note at its first use. */
  const F32_TOL = 1e-4;
  /** `ystart + k_yoff + cos(siner2 / 8) * 8` — Step_0:2050-2052, the float. */
  const floatY = (r) => r.ystart + r.yoff + Math.cos(r.sinUsed / 8) * 8;

  // ── 2. THE BOB. State 1 parks him in `state = 10` with k_scenefloat on, and
  // the float tail recomputes y from siner2 on every frame after.
  const bob = inState(1.1);
  ok(bob.length > 15, `state 1 held for its whole 20-frame delay (${bob.length} frames)`);
  ok(bob.every((r) => r.float === 1), 'k_scenefloat = 1 for every frame of state 1');
  // F32, not doubles: sim/gml.js narrows built-ins to float32, so the float
  // tail's cos() lands a few ulps off a double recomputation. F32_TOL is well
  // inside one pixel and far outside the 44-pixel and 8-pixel effects below.
  eq(bob.filter((r) => Math.abs(r.y - floatY(r)) > F32_TOL).length, 0,
    'every state-1 y IS ystart + k_yoff + cos(siner2 / 8) * 8');
  // NON-VACUOUS: a FROZEN y also satisfies a formula nobody re-evaluates.
  const bobSpan = Math.max(...bob.map((r) => r.y)) - Math.min(...bob.map((r) => r.y));
  ok(bobSpan > 5, `...and he really bobs through it (${bobSpan.toFixed(2)} px of travel)`);
  ok(bob.every((r) => r.yoff === 0), 'k_yoff is still 0 — he has not jumped yet');

  // ── 1. THE LEAP (:1791-1793). `k_yoff = -44` is what lifts him; the
  // `y += -44` on the line above is overwritten by the float the same frame
  // and is dead in the mod too (see the note at the site).
  const leap = inState(2.1);
  ok(leap.length > 10, `state 2 held for its 16-frame delay (${leap.length} frames)`);
  ok(leap.every((r) => r.yoff === -44), 'k_yoff = -44 for every frame of state 2');
  eq(leap.filter((r) => Math.abs(r.y - floatY(r)) > F32_TOL).length, 0,
    '...and the float carries it: y tracks the bob 44 pixels higher');
  const leap0 = leap[0] ?? {};   // REPORT, DO NOT THROW
  near(leap0.y - (leap0.ystart + Math.cos(leap0.sinUsed / 8) * 8), -44, F32_TOL,
    'THE LEAP IS 44 PIXELS, measured against the un-offset float');

  // ── 3/4/8. THE RELEASE AND THE DROP (:1801, :1830-1831). k_scenefloat goes
  // OFF first, so the `y += 44` on the swing frame is the last word for y.
  const swingF = at(st, 3.1) + 1;
  const swing = row(swingF);
  const beforeSwing = row(swingF - 1);
  eq(swing.float, 0, 'state 3 released k_scenefloat (:1801)');
  near(swing.y - beforeSwing.y, 44, F32_TOL, 'state 3 dropped him exactly 44 (:1830)');
  eq(swing.spd, 0, 'state 3 froze the animation (image_speed = 0, :1831)');
  ok(inState(3.1).every((r) => r.float === 0),
    '...and the float stays off for the whole wind-up — the dive owns y now');

  // ── 5. THE DIVE. 30 right and 120 DOWN over 19 frames, curve 2 in-out.
  const dive = row(swingF + 19);
  near(dive.x, swing.x + 30, 1e-6, 'the dive lands 30 right of the swing, 19 frames later');
  near(dive.y, swing.y + 120, 1e-6, '...and 120 DOWN');
  const during = rows.filter((r) => r.f > swingF && r.f <= swingF + 19);
  ok(during.every((r, i) => i === 0 || r.x >= during[i - 1].x - 1e-9),
    '...moving right the whole way, never back (an inverted lerp fails here)');
  ok(during.every((r, i) => i === 0 || r.y >= during[i - 1].y - 1e-9),
    '...and down the whole way');
  ok(during.some((r) => r.x > swing.x + 1 && r.x < swing.x + 29),
    '...through the middle, so it is a TWEEN and not a teleport');
  // THE RECORDED TARGETS. `sc.lerps` is the module's own log of where each
  // move was aimed, and nothing read it until now.
  const lerps = ensureScenes(st).lerps;
  const diveX = lerps.find((l) => l.frame === at(st, 3.1) && l.name === 'x') ?? {};
  const diveY = lerps.find((l) => l.frame === at(st, 3.1) && l.name === 'y') ?? {};
  near(diveX.to - diveX.from, 30, 1e-9, 'sc.lerps: the dive x lerp is +30');
  near(diveY.to - diveY.from, 120, 1e-9, 'sc.lerps: the dive y lerp is +120');
  eq(diveX.frames, 19, '...over 19 frames');
  eq(diveY.frames, 19, '...both of them');
  eq(diveX.easetype, 2, '...at curve _l = 2 (Step_0:1772)');
  eq(diveX.easeinout, 'inout', '...in-out');

  // ── 9. THE IMPACT. `instance_create(obj_shake); shakex = 10; shakespeed = 1`
  // (:1858) — TEN, where k_tpscene's is 8. It moves the VIEW, so the shake is
  // assertable without a renderer.
  const shakeRows = rows.filter((r) => r.shakes > 0);
  ok(shakeRows.length > 0, 'state 5 created an obj_shake');
  eq((shakeRows[0] ?? {}).f, at(st, 5) + 1, '...on the frame k_hpscene reached 5');
  eq((shakeRows[0] ?? {}).shakex, 10, 'shakex 10 (k_tpscene\'s is 8)');
  ok(shakeRows.every((r) => r.shakes === 1),
    '...and only ever ONE: obj_shake\'s Create destroys a second instance, so the'
    + ' two stacked calls of the doubled state 5 do not stack two shakes');
  const peak = Math.max(...rows.map((r) => Math.abs(r.vx)));
  eq(peak, 10, 'the view really moved, and its peak offset is the 10 it was given');
  eq(row(handbackOf(st).frame).vx, 0, '...and the camera is back at 0 by the hand-back');

  // ── 10. THE TRAIL. `with (obj_afterimage) if (hspeed == 2) depth =
  // other.depth + 1`: both times the scene moves the knight's depth it drags
  // the ghosts with it, so they do not sort in front of the knight they came
  // from.
  const dived = rows.filter((r) => r.f > swingF && r.f < at(st, 7.2) && r.trailDepths.length);
  ok(dived.length > 20, `the trail was alive through the dive (${dived.length} frames)`);
  ok(dived.every((r) => r.trailDepths.every((d) => d === -9)),
    'every hspeed-2 afterimage rode the knight down to depth -10 + 1');
  const back = rows.filter((r) => r.f > at(st, 7.2) + 1 && r.trailDepths.length);
  ok(back.length > 5 && back.every((r) => r.trailDepths.every((d) => d === 89)),
    '...and state 7.2 brought them back to remdepth + 1');

  // ── 6/7. THE WAY HOME. `siner2 = 0` FIRST (:1884) and the y target reads it
  // back, so he aims at the TOP of the bob — ystart + 8 — and not at wherever
  // the bob happened to be. With the zeroing removed the target is
  // ystart + cos(siner2 / 8) * 8 for a siner2 near 80, which is 15 px out.
  const homeX = lerps.find((l) => l.frame === at(st, 7) && l.name === 'x') ?? {};
  const homeY = lerps.find((l) => l.frame === at(st, 7) && l.name === 'y') ?? {};
  eq(homeX.to, row(1).xstart, 'sc.lerps: the way home aims x at xstart');
  eq(homeY.to, row(1).ystart + 8,
    'sc.lerps: ...and y at ystart + 8, the TOP of the bob (siner2 zeroed first)');
  eq(homeX.frames, 25, '...over 25 frames');
  // ...and the entity really travelled it. The last frame of the scene, before
  // state 8 hands him back to the vanilla actor's own bob.
  const last = row(handbackOf(st).frame - 1);
  near(last.x, row(1).xstart, 1, 'the knight is home at xstart when the scene ends');
  near(last.y, row(1).ystart + 8, 1, '...and back at the top of the bob');
  ok(Math.abs(last.y - dive.y) > 100, '...having really climbed back out of the swing');
}

// ═══════════════════════════════════════════════════════════════════════════
{
  // `image_speed = 0` (:1831) IS VACUOUS AGAINST A DEFAULT FIGHT, and saying
  // so is the point: sim/actors.js's knight sets image_speed 0 in Create and
  // nothing in the vanilla actor ever raises it, so the plain `spd === 0` row
  // above passes with the line deleted. It is not a dead ADDRESS — sim/index.js's
  // runAnimation reads `image_speed` on every entity every frame, and the mod's
  // own attack poses do animate — so the honest test raises it first and proves
  // the scene puts it back on the INSTANCE.
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  let raisedAt = -1;
  const after = [];
  for (let f = 0; f < 200; f++) {
    // Raise it on a frame of state 2, before the wind-up writes it.
    if (raisedAt < 0 && (st.kaizo.hpscene ?? 0) === 2.1) {
      const k = knightInstance(st);
      if (k) { k.image_speed = 0.5; raisedAt = st.frame; }
    }
    stepFrame(st, IDLE);
    const k = knightInstance(st);
    const swingFrame = at(st, 3.1);
    if (k && swingFrame !== null && st.frame > swingFrame) after.push(k.image_speed);
  }
  ok(raisedAt > 0, 'the control raised the knight\'s image_speed to 0.5 mid-scene');
  ok(after.length > 100, `...and the fight ran on past the wind-up (${after.length} frames)`);
  ok(after.every((v) => v === 0),
    'state 3 wrote image_speed = 0 onto the INSTANCE, and nothing raised it again');
  eq(handbackOf(st).frame > 0, true, 'the scene still reached its hand-back');
}

// ════════════════════════════════════════════════════════════════════════════
section('global.mnfight IS NOT PINNED BY THE HAND-BACK (CLAUDE.md law 2)');
{
  // State 8 writes `global.mnfight = 0` (:1909). That is the mod's own write
  // and it stays; what must not happen is the value STICKING, because
  // `state.kaizo.mnfight` is a key kaizo/party/gloom.js reads
  // (scrIsphaseBullets — vanilla scr_isphase("bullets") is
  // `global.mnfight == 2`). A stale 0 is gloom that glows and never drains.
  //
  // The turn loop takes the mirror back on the frame special_con drops, which
  // is exactly where obj_battlecontroller resumes (its Step exits while
  // special_con > 0). Pulsed confirm, because a fight nobody plays never
  // leaves the command phase.
  const st = build({ version: 'C', over: { maxhp: 300, hp: 300 } });
  const seen = new Map();
  for (let f = 0; f < 900; f++) {
    stepFrame(st, { ...IDLE, confirm: (f % 8) < 2 });
    const v = st.kaizo.mnfight;
    if (!seen.has(v)) seen.set(v, st.frame);
  }
  eq(seen.get(99), 1, 'mnfight 99 while the scene holds the turn (:1781)');
  eq(seen.get(0), handbackOf(st).frame, 'mnfight 0 on the hand-back frame (:1909)');
  ok(seen.has(2), 'AND IT REACHES 2: the bullet phase moves it again');
  ok(seen.get(2) > seen.get(0), '...after the hand-back, not before');
  eq(st.kaizo.mnfight, 2, 'the fight ends this window in the bullet phase');
  eq(scrIsphaseBullets(st), true,
    'gloom\'s scr_isphase("bullets") agrees — the value is live, not stale');
  ok((st.kaizo.launched ?? []).length > 0, 'non-vacuous: the fight really launched attacks');
}

// ═══════════════════════════════════════════════════════════════════════════
section('ON LOAN FROM check-scenes.mjs — the k_nhscene down-message latches');
// WHY IT IS HERE. The fix that made those four latches land on the address
// downMessages actually reads (freeze.js's downLatch, not the mod's
// `krisdownmessage` name) is asserted in kaizo/tools/checks/check-scenes.mjs,
// and check-scenes is NOT in verify-kaizo.mjs's WIRED set — so it RUNS on
// every gate and is reported, but a regression there cannot redden anything.
// This block is the same assertion inside a check the gate enforces. DELETE IT
// when check-scenes is wired; it is a duplicate, not a second opinion.
{
  const st = createState({ seed: 12345, traceBulletSlots: 0 });
  installRoster(st, { charIds: [1, 4], sideb: true });
  st.knight = {
    practicemode: false, haveusedroaring: false, nohitmode: false,
    progamer: true, turnsafternohit: NH_ARM_TURNS,
  };
  ensureScenes(st);
  spawn(st, kaizoSceneDriver, {});
  scrMnendturnScenes(st);
  eq(st.kaizo.nhscene, 1, 'k_nhscene armed at turnsafternohit == 7');
  for (let f = 0; f < 600 && st.kaizo.nhscene !== -1; f++) stepFrame(st, IDLE);
  eq(st.kaizo.nhscene, -1, '...and ran to its end');
  const dl = ensureFreezeState(st).downLatch;
  ok(!!dl && dl.kris && dl.susie && dl.ralsei && dl.noelle,
    'all four down-message latches are set (Step_0:1520-1523)');
  eq(downMessages(st).battlemsg, null,
    '...and downMessages prints NOTHING for the slot the Knight one-shot');
  const ctl = createState({ seed: 12345, traceBulletSlots: 0 });
  installRoster(ctl, { charIds: [1, 4], sideb: true });
  ctl.partyHp[0] = 0;
  ok(/Kris|move your body/.test(downMessages(ctl).battlemsg ?? ''),
    'control: an unsuppressed down really does print one');
}

// ═══════════════════════════════════════════════════════════════════════════
section('DETERMINISM and the report');
{
  const a = build({ version: 'C', over: { maxhp: 300, hp: 300 }, seed: 4242 });
  const b = build({ version: 'C', over: { maxhp: 300, hp: 300 }, seed: 4242 });
  run(a, 200); run(b, 200);
  deepEq(ladder(a), ladder(b), 'same seed, same ladder');
  deepEq(a.partyMaxhp, b.partyMaxhp, 'same seed, same cut');
  const r = sceneReport(a);
  eq(r.hpscene, -1, 'sceneReport carries hpscene');
  ok(!!r.hpcut, 'sceneReport carries the cut receipt');
  eq(r.tpscene, 0, '...and the other three are untouched on the A-Side');
  eq(r.sgscene, 0, 'sgscene 0');
  eq(r.nhscene, 0, 'nhscene 0');
}
{
  // stepHpscene is inert when nothing armed it — the guard every caller leans
  // on (`if (s <= 0) return false`).
  const st = build({ version: 'C' });
  run(st, 4);
  eq(stepHpscene(st), false, 'stepHpscene is a no-op with k_hpscene 0');
  eq(armHpscene(st), false, 'armHpscene declines a legal party');
  eq(st.kaizo.scenes, undefined, '...without standing up the scene state');
}

console.log(`\ncheck-hpscene: ${checks - failures}/${checks} assertions passed`);
if (failures) {
  console.log(`check-hpscene: ${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('check-hpscene: green — the Knight shears the party\'s max HP, and gives the turn back.');
