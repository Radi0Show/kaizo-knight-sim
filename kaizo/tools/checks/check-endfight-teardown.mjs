#!/usr/bin/env node
// THE END OF THE FIGHT — what the mod tears down, and the exit it took away.
//
//   node kaizo/tools/checks/check-endfight-teardown.mjs
//
// Ledger gaps G-20 (the teardown lines) and G-21 (the game over is now
// unconditional on a party wipe).
//
// ── G-21 IS A CHECK BECAUSE IT IS A DELTA WITH NO VISIBLE EFFECT ──────────
//
// Vanilla lets a FIRST-attempt player out of this fight rather than killing
// them for it:
//
//     if (scr_get_knight_total_attempts() > 0) { scr_gameover(); }
//     else {
//         obj_battlecontroller.noreturn = 1;
//         obj_battlecontroller.intro = 2;
//         with (obj_tensionbar) { alarm[5] = 15; hspeed = -10; friction = -0.4; }
//         mus_volume(global.batmusic[1], 0, 90);
//         event_user(3);
//         global.fighting = 0;
//     }
//
// `gml_vanilla_v105/.../gml_Object_obj_knight_enemy_Step_0.gml:754-778`. The
// mod deletes the test and the whole else arm
// (`gml_kaizo_dump/.../:917-925`): every wipe is a game over, first attempt
// or not.
//
// The recreation models NEITHER — it has no attempts counter, so it stops the
// run at the wipe and always has. That means the delta has no visible effect
// today and a comment is all it could ever be... except that a comment does
// not fail. THE ESCAPE HATCH MUST NEVER BE ADDED, and "we did not add it" is
// exactly the kind of correctness that decays silently. Both halves are
// asserted: the DUMP says the mod deleted it, and the recreation's wipe
// produces a game over with nothing standing in the way.
//
// ── AND G-20's ONE LANDED PIECE ───────────────────────────────────────────
//
// `clearAllFreeze` has been in kaizo/party/freeze.js since the freeze module
// landed, translating the end cutscene's
//
//     if (endcon == 1 && endtimer > 45) {
//         k_freeze = [0, 0, 0, 0, 0];
//         with (obj_frozennpc) instance_destroy();
//
// (`gml_Object_obj_knight_enemy_Step_0.gml:1325-1330`), with NOTHING CALLING
// IT — this repo's signature defect, at the fifteenth occurrence. The driver
// calls it now, and the assertions below are about the sweep HAPPENING, not
// about the function returning the right number in isolation.
//
// The other three G-20 pieces are NOT landed and are not asserted here; they
// are in the lane report with the reason each one has nowhere to go. An
// assertion that passes while the thing is undone is worse than no assertion,
// and an inverted one that reddens when someone does the work is a trap.
//
// SABOTAGE-TESTED, both exit codes in the lane report.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createState, stepFrame } from '../../../sim/index.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import {
  clearAllFreeze, ensureFreezeState, freezeSlot, isFrozen, kFreezeArray,
  statueForSlot, stepFrozenDraw,
} from '../../party/freeze.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const DUMP = join(homedir(), 'knight-research', 'kaizo-mod', 'gml_kaizo_dump', 'CodeEntries');
const VANILLA = join(homedir(), 'knight-research', 'kaizo-mod', 'gml_vanilla_v105', 'CodeEntries');

let failures = 0;
let count = 0;
let skipped = 0;
function assert(cond, label) {
  count += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); } else console.log(`  ok   ${label}`);
}
function assertEq(got, want, label) {
  assert(JSON.stringify(got) === JSON.stringify(want),
    `${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}
function section(t) { console.log(`\n== ${t}`); }

function gml(root, entry) {
  const p = join(root, entry);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}
function assertDump(src, needle, label) {
  if (src === null) { skipped += 1; console.log(`  SKIP ${label} — no dump`); return; }
  assert(src.includes(needle), `DUMP: ${label}`);
}

const MOD_STEP = gml(DUMP, 'gml_Object_obj_knight_enemy_Step_0.gml');
const V_STEP = gml(VANILLA, 'gml_Object_obj_knight_enemy_Step_0.gml');
const MOD_DRAW = gml(DUMP, 'gml_Object_obj_knight_enemy_Draw_0.gml');
const V_DRAW = gml(VANILLA, 'gml_Object_obj_knight_enemy_Draw_0.gml');
const MOD_CLEANUP = gml(DUMP, 'gml_Object_obj_knight_enemy_CleanUp_0.gml');

console.log('check-endfight-teardown: G-20 (teardown) and G-21 (no way out of a wipe)');

/** A built kaizo fight, either version. */
function fight(version) {
  const st = createState({ seed: 7, traceBulletSlots: 0 });
  buildKaizoScene(st, { version });
  return st;
}
/** Lay the whole party out — HP to zero AND the swoon flag, because `isUp`
 *  reads `chardead` and not the HP sign (CLAUDE.md: swoon is five globals). */
function wipe(st) {
  for (let s = 0; s < 3; s++) {
    st.partyHp[s] = 0;
    if (st.chardead) st.chardead[s] = 1;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 1. G-21 — THE ESCAPE HATCH
// ══════════════════════════════════════════════════════════════════════════
section('G-21: vanilla lets a first-attempt player out, and the mod does not');

assertDump(V_STEP, 'if (scr_get_knight_total_attempts() > 0)',
  'vanilla tests the attempt count before calling scr_gameover');
assertDump(V_STEP, 'obj_battlecontroller.noreturn = 1;',
  'and its else arm is the escape hatch — noreturn, intro 2, the bar flying off');
if (MOD_STEP !== null && V_STEP !== null) {
  assert(!MOD_STEP.includes('scr_get_knight_total_attempts()'),
    'DUMP: the mod does not call scr_get_knight_total_attempts in this event at all');
  // ...and the call it guarded is still there, un-guarded. Without this the
  // assertion above is also true of an event that deleted the wipe outright.
  assert(MOD_STEP.includes('scr_gameover();'),
    'DUMP: scr_gameover() survives, now unconditional');
  // NO `else` AFTER IT. `noreturn = 1` cannot be counted file-wide — the
  // VICTORY teardown at `:1371` sets it too, and always did; vanilla has the
  // name TWICE (`:766` the escape hatch, `:919` the victory) and the mod
  // once. So the assertion is about the shape at the wipe itself.
  const i = MOD_STEP.indexOf('scr_gameover();');
  assert(!MOD_STEP.slice(i, i + 200).includes('else'),
    'DUMP: nothing follows it — the else arm is gone from the wipe');
  const count2 = (s) => (s.match(/obj_battlecontroller\.noreturn = 1;/g) ?? []).length;
  assertEq([count2(V_STEP), count2(MOD_STEP)], [2, 1],
    'DUMP: vanilla writes noreturn twice (escape hatch + victory), the mod once');
} else { skipped += 4; console.log('  SKIP mod wipe arm (no dump)'); }

section('G-21: and the recreation stops the run, on a FIRST attempt, both routes');
for (const v of ['C', 'D']) {
  const st = fight(v);
  assert(st.gameOver !== true, `V-${v}: a fresh fight is not already over`);
  wipe(st);
  stepFrame(st, {});
  assertEq(st.gameOver, true, `V-${v}: a party wipe ends the run`);
  // THE POSITIVE HALF OF "NO ESCAPE HATCH": nothing about a first attempt
  // changes the answer, because there is no attempts counter to consult.
  // Re-asserted per version because V-D's roster is two members and the
  // wipe test is roster-bounded — a three-corpse rule would never fire here.
  assert(st.menu?.open !== true, `V-${v}: and the battle menu is closed with it`);
}
{
  // ...and an UNwiped party is not stopped, so the assertion above is not
  // passing on a state that was over before it started.
  const st = fight('D');
  for (let i = 0; i < 60; i++) stepFrame(st, {});
  assertEq(st.gameOver, false, 'V-D: a party that is still standing keeps fighting');
}

section('G-21: the hatch is absent from the recreation, by name');
{
  const files = [
    ['sim', 'scenes', 'practice.js'], ['sim', 'knight.js'],
    ['kaizo', 'scenes', 'kaizo-practice.js'], ['kaizo', 'scenes', 'kaizo-vc-hooks.js'],
    ['web', 'kaizo.js'],
  ];
  // `scr_get_knight_total_attempts` is the ONE name the escape hatch cannot
  // be written without, and it is the right one to watch: `noreturn` and
  // `intro = 2` are shared with the VICTORY teardown, which a later lane may
  // legitimately port, and an assertion that reddens on correct work is a
  // trap rather than a guard. Asserted across every file on the path from a
  // wipe to a stopped run, so re-adding the test anywhere on it fails here.
  for (const parts of files) {
    const src = readFileSync(join(REPO, ...parts), 'utf8');
    const path = parts.join('/');
    assert(!/scr_get_knight_total_attempts\s*\(|knightTotalAttempts|previousTimesAttempted/
      .test(src), `${path}: nothing consults a previous-attempt count`);
  }
  // AND THE POSITIVE HALF: the wipe ends the run whatever the state was built
  // from. Five seeds, because "unconditional" is a claim about every run and
  // one run cannot make it.
  for (const seed of [1, 7, 99, 4242, 65535]) {
    const st = createState({ seed, traceBulletSlots: 0 });
    buildKaizoScene(st, { version: 'D' });
    wipe(st);
    stepFrame(st, {});
    assertEq(st.gameOver, true, `V-D seed ${seed}: the wipe still ends the run`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 2. G-20 — THE FREEZE SWEEP AT THE ENDING
// ══════════════════════════════════════════════════════════════════════════
section('G-20: k_freeze = [0,0,0,0,0] and the statues die');

assertDump(MOD_STEP, 'k_freeze = [0, 0, 0, 0, 0];',
  'the end cutscene clears the whole array');
if (MOD_STEP !== null) {
  const i = MOD_STEP.indexOf('k_freeze = [0, 0, 0, 0, 0];');
  const after = MOD_STEP.slice(i, i + 200);
  assert(after.includes('with (obj_frozennpc)'),
    'DUMP: ...and destroys every obj_frozennpc in the same block');
} else { skipped += 1; console.log('  SKIP frozennpc sweep (no dump)'); }
assertDump(V_STEP, 'if (endcon == 1 && endtimer > 45)',
  'the block it was added to is vanilla\'s own endtimer > 45 teardown');
if (V_STEP !== null) {
  assert(!V_STEP.includes('k_freeze'),
    'DUMP: vanilla has no k_freeze anywhere — the two lines are the mod\'s');
} else { skipped += 1; console.log('  SKIP vanilla k_freeze (no dump)'); }

section('BEHAVIOUR: a frozen party, swept');
{
  const st = fight('D');
  ensureFreezeState(st);
  freezeSlot(st, 0);
  freezeSlot(st, 1);
  // The statue only exists once the Draw has run — obj_frozennpc is spawned
  // by obj_heroparent's Draw, not by the freeze write.
  stepFrozenDraw(st);
  assert(isFrozen(st, 0) && isFrozen(st, 1), 'both members are frozen');
  assert(!!statueForSlot(st, 0) && !!statueForSlot(st, 1), 'and both have a statue');
  assertEq(kFreezeArray(st).length, 5, 'k_freeze is the five-slot char-indexed array');

  const destroyed = clearAllFreeze(st);
  assertEq(destroyed, 2, 'the sweep destroys both statues');
  assert(!isFrozen(st, 0) && !isFrozen(st, 1), 'and nobody is frozen after it');
  assertEq(kFreezeArray(st), [0, 0, 0, 0, 0], 'k_freeze is [0,0,0,0,0], all five');
  assert(!statueForSlot(st, 0) && !statueForSlot(st, 1),
    'and no statue answers for either slot');
}

section('the driver calls it, at endcon 2, once');
{
  const src = readFileSync(join(REPO, 'web', 'kaizo.js'), 'utf8');
  const wires = [
    ["import { clearAllFreeze } from '../kaizo/party/freeze.js';",
      'freeze.js is imported by the driver at all'],
    ['if (state.knight?.endcon === 2 && state.kaizo && !state.kaizo.freezeSwept) {',
      'the sweep is gated on the ending\'s own endcon, with a one-shot latch'],
    ['state.kaizo.freezeSwept = true;', 'the latch is set before the call'],
    ['clearAllFreeze(state);', 'and the sweep is actually called'],
  ];
  for (const [needle, why] of wires) assert(src.includes(needle), `driver: ${why}`);
  // THE LATCH IS ON THE STATE, not on the module — so a reset re-arms it and
  // no second place has to remember. A module-level `let` would survive a
  // restart and the sweep would silently never run again.
  assert(!/^let freezeSwept/m.test(src),
    'driver: the latch is NOT a module-level variable a reset would leave set');
}
section('...and endcon reaches 2 through the engine, so the gate is reachable');
{
  // `stepEndCutscene` moves endcon 1 -> 2 at endtimer > 45. Driven directly
  // rather than by winning a fight, because the gate is the thing under test
  // and a 12,000-frame win is not.
  const st = fight('D');
  st.knight.endCutscene = 1;
  st.knight.endcon = 1;
  st.knight.endtimer = 46;
  st.tensionbarFly = { x: 38, hspeed: 0, friction: -0.4, alarm: -1 };
  const { stepEndCutscene } = await import('../../../sim/knight.js');
  stepEndCutscene(st);
  assertEq(st.knight.endcon, 2, 'endcon 1 -> 2 at endtimer > 45');
}

// ══════════════════════════════════════════════════════════════════════════
// 3. THE G-20 PIECES THAT ARE NOT LANDED — receipts, not assertions
// ══════════════════════════════════════════════════════════════════════════
section('G-20: what the dump says about the three pieces still open');
assertDump(MOD_DRAW, 'instance_destroy(obj_shake);',
  'the ending trigger destroys the live obj_shake before making its own');
if (MOD_DRAW !== null && V_DRAW !== null) {
  assert(!V_DRAW.includes('instance_destroy(obj_shake);'),
    'DUMP: vanilla does not — its instance_create loses to the shake already running');
  const i = MOD_DRAW.indexOf('end_cutscene_version = 1;');
  assert(MOD_DRAW.slice(Math.max(0, i - 600), i).includes('instance_destroy(obj_face);'),
    'DUMP: and the trigger kills the writer and its face first');
} else { skipped += 2; console.log('  SKIP ending trigger (no dump)'); }
assertDump(MOD_CLEANUP, 'global.hp[4] = global.maxhp[4];',
  'CleanUp_0 heals the whole party unconditionally, Noelle included');
assertDump(MOD_CLEANUP, 'global.item[i] = knight_items[i];',
  'and restores the 13-slot inventory — but only `if (nohitmode)`');
if (MOD_CLEANUP !== null) {
  assert(MOD_CLEANUP.indexOf('if (nohitmode)') < MOD_CLEANUP.indexOf('global.item[i] = knight_items[i];'),
    'DUMP: the inventory restore is inside the nohitmode guard, which is why it '
    + 'cannot reach this build — nothing writes nohitmode (ledger G-6)');
} else { skipped += 1; console.log('  SKIP cleanup guard (no dump)'); }
console.log('  NOTE  the three above are recorded, not modelled. See the lane report:');
console.log('        - the ending trigger\'s writer/face/shake destroys need a flag set in');
console.log('          kaizo/scenes/kaizo-fight.js, which this lane does not own.');
console.log('        - CleanUp\'s heal and inventory restore have nowhere to land: a rebuilt');
console.log('          fight is at maxhp by construction and `nohitmode` is never written.');

console.log(`\ncheck-endfight-teardown: ${count - failures} passed, ${failures} failed`
  + (skipped ? `, ${skipped} skipped (no dump)` : ''));
process.exit(failures ? 1 : 0);
