#!/usr/bin/env node
// KAIZO V-D (B-Side) — the three turn-hijacking scenes. Positive assertions on
// every branch kaizo/party/scenes.js translates, against the kaizo dump.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C).
//
// PROVENANCE of the expectations asserted here:
//   gml_Object_obj_knight_enemy_Step_0.gml   1408-1541 k_nhscene
//                                            1543-1545 the k_sgscene arm
//                                            1547-1770 k_sgscene
//                                            1930-2049 k_tpscene
//   gml_GlobalScript_scr_mnendturn.gml       148-169   both arms
//   gml_Object_obj_spell_snowgrave_Draw_0    the flake spawner + the neutering
//   gml_Object_obj_spell_snowgrave_snowflake_Step_0.gml  con 0..4
//   gml_Object_obj_tensionbar_Draw_0.gml:36  the gate this scene ARMS
//
// EVERY BLOCK ASSERTS WHAT THE SCENE *CHANGES*, because "the machine ran and
// nothing happened" and "the machine never ran" look identical to a
// regression test (CLAUDE.md, "A green suite does not mean a change took
// effect"). Specifically:
//
//   - k_tpscene really ARMS the 125 TP clamp: kaizoTensionClampActive flips
//     false -> true at state 5, and kaizoTensionbarDraw then cuts a 250 TP bar
//     to 125. The non-vacuous half: with the scene un-armed the same state
//     keeps all 250.
//   - k_sgscene really FREEZES someone: k_freeze[Kris] goes true and his HP
//     goes under 0 — and with Noelle as the target it CANNOT, her HP stopping
//     at exactly 1.
//   - all three ADVANCE: the exact state ladders, at the exact frames the
//     scr_delay_var table demands, and never parked at 1.
//   - the RNG budgets are exact, per scene.
//
//     node kaizo/tools/checks/check-scenes.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { gmlCreate } from '../../../sim/rng.js';
import { installRoster } from '../../party/roster.js';
import {
  ensureScenes, kaizoSceneDriver, stepScenes,
  scrMnendturnScenes, armTpscene, armNhscene, armSgsceneIfSpell,
  castSnowgrave, scrDelayVar, pendingDelays, destroyPendingDelays,
  sceneReport, visitedStates, sceneDraws, sceneActive,
  sceneHijacksTurn, sceneStallsSpellphase,
  snowgraveSnowflake, snowgraveSpell,
  TP_SCENE_STATES, SG_SCENE_STATES, NH_SCENE_STATES,
  TP_ARM_PREVATK, TP_ARM_PREVATK_NAME, NH_ARM_TURNS,
  TP_CLAMP_ARMED_AT, NH_KILL_HP, NH_DAMAGE_TEXT, NH_STAR_FLIGHT,
  SG_SPELLDELAY_STALL, SG_SPELLDELAY_RELEASE, SNOWGRAVE_SPELLDELAY,
  SNOWGRAVE_SPAWN_WINDOW, SNOWGRAVE_SPAWN_OFFSETS, SNOW_SCATTER,
} from '../../party/scenes.js';
import {
  kaizoTensionClampActive, kaizoTensionbarDraw, kaizoEffectiveTpCeiling,
  KAIZO_SIDEB_TP_CAP, MAX_TENSION,
} from '../../party/tensionbar.js';
// The no-hit scene's four `*downmessage = true` latches (Step_0:1520-1523)
// live in freeze.js — its `downLatch` is what `downMessages` reads.
import { downMessages, ensureFreezeState } from '../../party/freeze.js';

let failures = 0;
let checks = 0;

function assert(cond, label) {
  checks += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); }
}
function assertEq(got, want, label) {
  checks += 1;
  if (got !== want) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}
function assertJson(got, want, label) {
  assertEq(JSON.stringify(got), JSON.stringify(want), label);
}

const IDLE = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

/**
 * A live sim state with the Weird Route roster and the scene driver installed.
 * A real state, not a hand-built literal: the delays are ALARMS and the
 * snowflakes are entities, so the engine's own alarm and motion phases are
 * part of what is under test.
 */
function mk({ charIds = [1, 4], sideb = true, seed = 12345, knight = {} } = {}) {
  const st = createState({ seed, traceBulletSlots: 0 });
  // createState seeds gmlRng with 0 regardless of `seed` (sim/state.js:106 —
  // scenes seed it themselves). Without this the "different seed" control
  // below passes vacuously, because both runs draw the same stream.
  st.gmlRng = gmlCreate(seed);
  installRoster(st, { charIds, sideb });
  st.knight = {
    practicemode: false,
    haveusedroaring: false,
    nohitmode: false,
    progamer: true,
    turnsafternohit: 0,
    ...knight,
  };
  ensureScenes(st);
  spawn(st, kaizoSceneDriver, {});
  return st;
}

function run(st, frames, done = () => false) {
  for (let f = 0; f < frames; f++) {
    stepFrame(st, IDLE);
    if (done(st)) break;
  }
  return st;
}

/** The transition log as [frame, value] pairs for one scene. */
function ladder(st, scene) {
  return ensureScenes(st).log.filter((t) => t.scene === scene).map((t) => [t.frame, t.to]);
}

// ═══ A: THE HEADLINE — k_tpscene ARMS THE 125 TP CLAMP ══════════════════════
console.log('k_tpscene — the bar slice, and the clamp it arms');
{
  const st = mk();
  st.tension = MAX_TENSION;
  st.kaizo.prevatk = TP_ARM_PREVATK;

  // Before the scene: the gate is shut and the ceiling is vanilla.
  assert(!kaizoTensionClampActive(st), 'A clamp is SHUT before the scene');
  assertEq(kaizoEffectiveTpCeiling(st), MAX_TENSION, 'A ceiling is 250 before the scene');
  kaizoTensionbarDraw(st);
  assertEq(st.tension, MAX_TENSION, 'A un-armed: 250 TP survives a bar draw');

  const armed = scrMnendturnScenes(st);
  assert(armed.tp, 'A scr_mnendturn armed k_tpscene after atk_Frenzy1');
  assertEq(st.kaizo.tpscene, 1, 'A k_tpscene starts at 1');

  // Step to the shear and stop ON the frame the clamp opens.
  let clampFrame = -1;
  let sceneAtClamp = null;
  run(st, 200, (s) => {
    if (clampFrame < 0 && kaizoTensionClampActive(s)) {
      clampFrame = s.kaizo.scenes.log[s.kaizo.scenes.log.length - 1].frame;
      sceneAtClamp = s.kaizo.tpscene;
      return true;
    }
    return false;
  });
  assert(clampFrame >= 0, 'A THE CLAMP ARMED — kaizoTensionClampActive went true');
  assertEq(sceneAtClamp, 10, 'A it armed on the state-5 assignment (k_tpscene = 10)');
  assertEq(TP_CLAMP_ARMED_AT, 5, 'A the module names state 5 as the arming state');

  // THE MECHANIC: the bar's own Draw now cuts the bar in half.
  st.tension = MAX_TENSION;
  const out = kaizoTensionbarDraw(st);
  assert(out.clamped, 'A the tensionbar Draw reports it clamped');
  assertEq(st.tension, KAIZO_SIDEB_TP_CAP, 'A 250 TP -> 125 THE FRAME AFTER THE SLICE');
  assertEq(kaizoEffectiveTpCeiling(st), KAIZO_SIDEB_TP_CAP, 'A ceiling is now 125');
  assert(out.particles > 0 && out.draws === out.particles * 3,
    `A the bleed particles ran (${out.particles} markers, ${out.draws} draws)`);

  // ...and it STAYS armed once the scene ends at -1.
  run(st, 200, (s) => s.kaizo.tpscene === -1);
  assertEq(st.kaizo.tpscene, -1, 'A the scene finished at k_tpscene = -1');
  assert(kaizoTensionClampActive(st), 'A the clamp SURVIVES the scene (the == -1 half)');
  st.tension = MAX_TENSION;
  kaizoTensionbarDraw(st);
  assertEq(st.tension, KAIZO_SIDEB_TP_CAP, 'A and still clamps for the rest of the fight');
}

// Non-vacuous control: the A-Side runs the same numbers and never clamps.
{
  const st = mk({ sideb: false });
  st.tension = MAX_TENSION;
  st.kaizo.tpscene = -1;               // even at the post-scene value
  assert(!kaizoTensionClampActive(st), 'A- V-C (sideb false) never clamps');
  kaizoTensionbarDraw(st);
  assertEq(st.tension, MAX_TENSION, 'A- V-C keeps all 250 TP');
}

// ═══ B: THE TP STATE WALK — exact ladder, exact frames ══════════════════════
{
  const st = mk();
  st.kaizo.prevatk = TP_ARM_PREVATK;
  scrMnendturnScenes(st);

  // While it runs, the battle is frozen (obj_battlecontroller's `exit`).
  assert(sceneHijacksTurn(st), 'B special_con > 0 — the battle controller exits');
  assertEq(st.kaizo.mnfight, 99, 'B global.mnfight = 99');
  assertEq(st.kaizo.myfight, 99, 'B global.myfight = 99');
  assertEq(st.kaizo.charturn, -1, 'B global.charturn = -1');

  let deadtpMid = null;
  run(st, 300, (s) => {
    if (!deadtpMid && s.kaizo.scenes.tp.deadtp) deadtpMid = { ...s.kaizo.scenes.tp.deadtp };
    return s.kaizo.tpscene === -1;
  });

  assertJson(visitedStates(st, 'tp'),
    [1, 1.1, 2, 2.1, 3, 3.1, 4, 4.1, 5, 10, 11, 11.1, 11.2, 12, -1],
    'B the tp scene walked the whole Step_0:1930-2049 ladder');
  assert(visitedStates(st, 'tp').length > 2, 'B it did NOT sit in state 1');

  // The delay table, frame for frame. Every gap is a scr_delay_var, and each
  // is an ALARM: arm on frame N with n -> the Step sees it on frame N + n.
  const L = ladder(st, 'tp');
  const jump = (from, to) => {
    const a = L.find((r) => r[1] === from);
    const b = L.find((r) => r[1] === to);
    return a && b ? b[0] - a[0] : null;
  };
  assertEq(jump(1.1, 2), 8, 'B delay 1 -> 2 is 8 frames');
  assertEq(jump(2.1, 3), 8, 'B delay 2 -> 3 is 8 frames');
  assertEq(jump(3.1, 4), 7, 'B delay 3 -> 4 is 7 frames');
  assertEq(jump(4.1, 5), 1, 'B delay 4 -> 5 is 1 frame');
  assertEq(jump(10, 11), 24, 'B delay 5 -> 11 is 24 frames');
  assertEq(jump(11.1, 11.2), 12, 'B delay 11 -> 11.2 is 12 frames');
  assertEq(jump(11.2, 12), 14, 'B delay 11.2 -> 12 is 14 frames');

  // The sheared bar top: THREE random_range, and the whole scene's budget.
  assert(!!deadtpMid, 'B the sheared bar top (spr_tensionbar_sliced_top) spawned');
  if (deadtpMid) {
    assertEq(deadtpMid.sprite, 'spr_tensionbar_sliced_top', 'B ...with the mod-added sprite');
    assert(deadtpMid.imageAngle >= 1 && deadtpMid.imageAngle <= 10,
      `B image_angle in random_range(1, 10) (${deadtpMid.imageAngle})`);
    assert(deadtpMid.hspeed <= -5 && deadtpMid.hspeed >= -7,
      `B hspeed in random_range(-5, -7) (${deadtpMid.hspeed})`);
    assert(deadtpMid.vspeed <= -2 && deadtpMid.vspeed >= -5,
      `B vspeed in random_range(-2, -5) (${deadtpMid.vspeed})`);
    assertEq(deadtpMid.gravity, 0.25, 'B gravity 0.25');
  }
  assertEq(sceneDraws(st).tp, 3, 'B THE WHOLE tp SCENE SPENDS EXACTLY 3 DRAWS');
  assertEq(sceneDraws(st).sg + sceneDraws(st).nh, 0, 'B ...and none in the other two');
  assertEq(st.kaizo.scenes.tp.deadtp, null, 'B state 12 destroyed the sheared top');
  assertEq(st.kaizo.specialCon, 0, 'B state 12 released special_con');
  assert(!sceneHijacksTurn(st), 'B the battle controller runs again');
  assert(!sceneActive(st), 'B no scene is running');

  // The taunt fork: k_didspell has not been set, so the "No spells yet" line.
  const texts = st.kaizo.scenes.msgs.map((m) => m.text);
  assert(texts.some((t) => /Let's keep this interesting/.test(t)),
    'B the base state-12 line printed');
  assert(texts.some((t) => /No spells yet/.test(t)),
    'B the !k_didspell line printed (no spell cast this run)');
  assertEq(st.kaizo.nospellsaw, 1, 'B k_nospellsaw armed for the phase-2 callback');
}

// The other side of the fork: a run that HAS cast gets neither.
{
  const st = mk();
  st.kaizo.prevatk = TP_ARM_PREVATK;
  st.kaizo.didspell = 1;                       // scr_spell.gml:11-18
  scrMnendturnScenes(st);
  run(st, 300, (s) => s.kaizo.tpscene === -1);
  const texts = st.kaizo.scenes.msgs.map((m) => m.text);
  assert(!texts.some((t) => /No spells yet/.test(t)),
    'B k_didspell suppresses the "No spells yet" line');
  assert(st.kaizo.nospellsaw !== 1, 'B ...and k_nospellsaw stays clear');
}

// ═══ C: THE ARMS — scr_mnendturn:148-169 ════════════════════════════════════
console.log('scr_mnendturn — the two guarded arms');
{
  // practicemode suppresses BOTH (WEIRD-ROUTE.md §1.3, at its source).
  const st = mk({ knight: { practicemode: true, turnsafternohit: NH_ARM_TURNS } });
  st.kaizo.prevatk = TP_ARM_PREVATK;
  assertJson(scrMnendturnScenes(st), { tp: false, nh: false },
    'C practice mode suppresses both arms');
  assertEq(st.kaizo.tpscene, 0, 'C ...and nothing armed');
}
{
  const st = mk({ sideb: false, knight: { turnsafternohit: NH_ARM_TURNS } });
  st.kaizo.prevatk = TP_ARM_PREVATK;
  assertJson(scrMnendturnScenes(st), { tp: false, nh: false },
    'C the A-Side (k_sideb false) has no scenes at all');
}
{
  const st = mk();
  st.kaizo.prevatk = 'atk_Starstorm1';
  assert(!armTpscene(st), 'C a different kaizo_prevatk does not arm the tp scene');
  st.kaizo.prevatk = TP_ARM_PREVATK;
  st.knight.haveusedroaring = true;
  assert(!armTpscene(st), 'C haveusedroaring blocks the tp scene');
  st.knight.haveusedroaring = false;
  assert(armTpscene(st), 'C atk_Frenzy1 + !haveusedroaring arms it');
  assert(!armTpscene(st), 'C ONE-SHOT: k_tpscene != 0 refuses a second arm');
}
{
  // The launched-ledger fallback, for a launcher that has no kaizo_prevatk yet.
  const st = mk();
  st.kaizo.launched = [{ ac: 7, difficulty: 0, name: TP_ARM_PREVATK_NAME }];
  assert(armTpscene(st), 'C the launch-ledger name fallback arms the tp scene');
}
{
  const st = mk();
  st.kaizo.launched = [{ ac: 1, difficulty: 0, name: 'Starstorm 1' }];
  assert(!armTpscene(st), 'C ...and only for the Frenzy 1 row');
}
{
  // turnsafternohit is an EQUALITY, not a >=.
  for (const n of [0, 6, 8, 99]) {
    const st = mk({ knight: { turnsafternohit: n } });
    assert(!armNhscene(st), `C turnsafternohit ${n} does not arm the no-hit scene`);
  }
  const st = mk({ knight: { turnsafternohit: NH_ARM_TURNS } });
  assert(armNhscene(st), 'C turnsafternohit == 7 arms it');
  assert(!armNhscene(st), 'C ONE-SHOT: k_nhscene != 0 refuses a second arm');
}
{
  const st = mk({ knight: { progamer: false, turnsafternohit: NH_ARM_TURNS } });
  assert(!armNhscene(st), 'C a single hit taken (progamer false) kills the scene');
}
{
  // Both guards can be true on the same scr_mnendturn call.
  const st = mk({ knight: { turnsafternohit: NH_ARM_TURNS } });
  st.kaizo.prevatk = TP_ARM_PREVATK;
  assertJson(scrMnendturnScenes(st), { tp: true, nh: true },
    'C both arms can fire on one call — nothing in the tp arm blocks the nh arm');
}

// ═══ D: k_nhscene — THE NO-HIT REWARD ═══════════════════════════════════════
console.log('k_nhscene — the reward that kills you');
{
  const st = mk({ knight: { turnsafternohit: NH_ARM_TURNS } });
  scrMnendturnScenes(st);
  assertEq(st.kaizo.nhscene, 1, 'D k_nhscene starts at 1');
  const hp0 = st.partyHp[0];
  run(st, 600, (s) => s.kaizo.nhscene === -1);

  assertJson(visitedStates(st, 'nh'), [1, 1.1, 2, 3, 3.1, 4, 5, 6, 7, 8, -1],
    'D the no-hit scene walked the whole Step_0:1408-1541 ladder');
  assert(visitedStates(st, 'nh').length > 2, 'D it did NOT sit in state 1');

  const L = ladder(st, 'nh');
  const at = (v) => (L.find((r) => r[1] === v) ?? [null])[0];
  assertEq(at(2) - at(1.1), 10, 'D delay 1 -> 2 is 10 frames');
  assertEq(at(4) - at(3.1), 20, 'D delay 3 -> 4 is 20 frames');
  assertEq(at(6) - at(5), NH_STAR_FLIGHT, `D the star flies ${NH_STAR_FLIGHT} frames`);
  assertEq(at(7) - at(6), 65, 'D delay 6 -> 7 is 65 frames');

  // WHAT IT CHANGES: slot 0 is deleted.
  assert(st.partyHp[0] < hp0, 'D slot 0 lost HP');
  assertEq(st.partyHp[0], NH_KILL_HP, 'D ...to -999999999999999999 exactly');
  assertEq(st.chardead[0], 1, 'D scr_dead(0) ran');
  assertEq(st.charmove[0], 0, 'D ...and took charmove with it');
  assertEq(st.partyHp[1], 120, 'D Noelle is untouched (the star aims at slot 0 only)');
  assertEq(st.knight.progamer, false, 'D progamer cleared');
  assertEq(st.knight.didfullnohit, false, 'D didfullnohit cleared');

  // EIGHT DRAWS: `repeat (4)` of a dmgwriter at two random_range each.
  assertEq(sceneDraws(st).nh, 8, 'D THE WHOLE nh SCENE SPENDS EXACTLY 8 DRAWS');
  const w = st.kaizo.scenes.writers;
  assertEq(w.length, 5, 'D five damage writers: the number plus four type-12s');
  assertEq(w[0].damage, NH_DAMAGE_TEXT, 'D the headline number is the 18-digit STRING');
  assert(w.slice(1).every((r) => r.type === 12), 'D the other four are type 12');
  assertEq(st.kaizo.specialCon, 0, 'D special_con released at state 8');

  // ── THE SUPPRESSION, ASSERTED AT ITS EFFECT (Step_0:1520-1523) ──────────
  // This block used to read `st.kaizo.krisdownmessage`, which is the mod's
  // variable name and NOT an address anything in this repo reads — so it went
  // green while the suppression did nothing and the fall line printed on the
  // next turn anyway. The latch `downMessages` actually consults is
  // freeze.js's `downLatch`, and the honest assertion is what the reader does
  // with it.
  const dl = ensureFreezeState(st).downLatch;
  assert(!!dl && dl.kris && dl.susie && dl.ralsei && dl.noelle,
    'D all four down-message latches are set');
  assertEq(downMessages(st).battlemsg, null,
    'D ...and downMessages prints NOTHING for the slot the Knight one-shot');
  // NON-VACUOUS: the identical state WITHOUT the scene does print a line.
  const ctl = mk();
  ctl.partyHp[0] = 0;
  assert(/Kris|move your body/.test(downMessages(ctl).battlemsg ?? ''),
    'D control: an unsuppressed down really does print one');
}
{
  // The nohitmode fork: it ABORTS at state 5, spends nothing, kills nobody.
  const st = mk({ knight: { nohitmode: true, turnsafternohit: NH_ARM_TURNS } });
  scrMnendturnScenes(st);
  run(st, 600, (s) => s.kaizo.nhscene === 0 && s.frame > 5);
  assertEq(st.kaizo.nhscene, 0, 'D nohitmode aborts the scene to 0');
  assertEq(sceneDraws(st).nh, 0, 'D nohitmode spends ZERO draws (the repeat never runs)');
  assertEq(st.partyHp[0], 160, 'D nohitmode leaves the party alive');
  assertEq(st.knight.progamer, false, 'D nohitmode still clears progamer');
  assertEq(st.kaizo.mnfight, 99, 'D nohitmode hands back through mnfight 99, not 0');
}

// ═══ E: k_sgscene — SNOWGRAVE, TURNED AROUND ════════════════════════════════
console.log('k_sgscene — the spell the Knight takes away from you');
{
  const st = mk();
  assert(!armSgsceneIfSpell(st), 'E no spell object, no scene');
  assertEq(st.kaizo.sgscene, 0, 'E k_sgscene stays 0');

  const spell = castSnowgrave(st, { caster: 1, magic: 13 });
  assertEq(st.kaizo.didspell, 1, 'E scr_spell set k_didspell');
  assertEq(st.kaizo.spelldelay, SNOWGRAVE_SPELLDELAY, 'E the cast set spelldelay 140');
  assertEq(spell.damage, Math.ceil(13 * 40 + 600), 'E damage = ceil(mag*40 + 600) = 1120');
  assert(armSgsceneIfSpell(st), 'E the spell existing arms k_sgscene');
  assertEq(st.kaizo.sgscene, 1, 'E k_sgscene starts at 1');
}
{
  // THE HEADLINE: Kris is the target, and Kris FREEZES.
  const st = mk();
  castSnowgrave(st, { caster: 1, magic: 13 });
  const sc = ensureScenes(st);
  let stalled = false;
  let peakFlakes = 0;
  run(st, 900, (s) => {
    sc.sg.target = 0;                       // pin Kris; the pick is weighted
    if (sceneStallsSpellphase(s)) stalled = true;
    const n = s.entities.filter((e) => e.alive && e.type === snowgraveSnowflake).length;
    if (n > peakFlakes) peakFlakes = n;
    return s.kaizo.sgscene === 0 && s.frame > 60;
  });

  assertJson(visitedStates(st, 'sg'),
    [1, 1.1, 2, 2.1, 3.1, 3, 4, 4.1, 5, 5.1, 6, 6.1, 7, 7.1, 8, 0],
    'E the sg scene walked the whole Step_0:1547-1770 ladder');
  assert(visitedStates(st, 'sg').length > 2, 'E it did NOT sit in state 1');

  // WHAT IT CHANGES: a party member is frozen solid, for good.
  assert(st.kaizo.freeze[0], 'E KRIS IS FROZEN — k_freeze[1] = 1');
  assert(st.partyHp[0] <= 0, `E ...because his HP reached 0 (${st.partyHp[0]})`);
  assertEq(st.chardead[0], 1, 'E scr_dead ran on the freeze branch');
  assert(!st.kaizo.freeze[1], 'E Noelle, who was not the target, is untouched');
  assertEq(st.partyHp[1], 120, 'E ...at full HP');

  // The 6 -> 7 window is 25 frames of delay, so 24 damage ticks.
  assertEq(sc.sg.ticks, 24, 'E the freeze tick ran on all 24 frames between 6 and 7');
  assert((st.kaizo.sgdmg ?? 0) > 0, `E k_sgdmg accumulated (${st.kaizo.sgdmg})`);

  // The hijack: spelldelay, not special_con. (WEIRD-ROUTE.md §6.C says
  // special_con for all three; for this one that is wrong — see scenes.js.)
  assert(stalled, 'E the scene STALLED obj_spellphase (spelldelay 999999)');
  assertEq(st.kaizo.spelldelay, SG_SPELLDELAY_RELEASE, 'E state 8 released it to 1');
  assert(!sceneStallsSpellphase(st), 'E ...so the spell phase can advance again');
  assertEq(st.kaizo.specialCon, 0, 'E the sg scene never touches special_con');

  // The snowflakes are the mechanism, not decoration.
  const [lo, hi] = SNOWGRAVE_SPAWN_WINDOW;
  assert(peakFlakes > 0, `E the commandeered snowflakes existed (peak ${peakFlakes})`);
  assert(sc.sg.num > 0, `E ...and ${sc.sg.num} of them were ADOPTED into the gather`);
  assert(sc.sg.cyc >= sc.sg.num * 2 - 1,
    `E half the snowfall is discarded (${sc.sg.cyc} counted, ${sc.sg.num} kept)`);
  assert(sc.sg.peakVol > 0,
    `E k_sgvol rose to ${sc.sg.peakVol.toFixed(3)}, so the wing loop was audible and spending`);
  assertEq(sc.sg.vol, 0, 'E ...and state 5 zeroed it again');
  assert(st.audioCues.some((c) => c.name === 'snd_wing'),
    'E the wing loop actually cued (its pitch is the draw)');
  assertEq(SNOWGRAVE_SPAWN_OFFSETS.length, 3, 'E three flakes per spawn frame');
  assertEq(hi - lo + 1, 56, 'E the spawn window is 56 frames (timer 20..75)');
  assertEq(SNOW_SCATTER, 56, 'E _snowS = 56');
  assert(st.entities.every((e) => !(e.alive && e.type === snowgraveSpell)),
    'E state 8 destroyed obj_spell_snowgrave');
  assert(st.entities.every((e) => !(e.alive && e.type === snowgraveSnowflake)),
    'E state 8 destroyed every snowflake');

  // The wing loop dominates the budget, which is the point of counting it.
  const d = sceneDraws(st);
  assert(d.sg > 1000, `E the sg scene spends heavily on the wing loop (${d.sg} draws)`);
  assert(d.flakes > 0, `E the snowflakes spend their own (${d.flakes} draws)`);
  assertEq(d.tp + d.nh, 0, 'E and nothing leaked into the other two scenes');
}
{
  // THE NOELLE EXEMPTION — the whole B-Side in one clamp.
  const st = mk();
  castSnowgrave(st, { caster: 1, magic: 13 });
  const sc = ensureScenes(st);
  let minNoelle = Infinity;
  run(st, 900, (s) => {
    sc.sg.target = 1;                       // pin Noelle
    minNoelle = Math.min(minNoelle, s.partyHp[1]);
    return s.kaizo.sgscene === 0 && s.frame > 60;
  });
  assertJson(visitedStates(st, 'sg'),
    [1, 1.1, 2, 2.1, 3.1, 3, 4, 4.1, 5, 5.1, 6, 6.1, 7, 7.1, 8, 0],
    'E the scene still completes with Noelle as the target');
  assert(!st.kaizo.freeze[1], 'E NOELLE CANNOT BE FROZEN — k_freeze[4] stays 0');
  assertEq(st.partyHp[1], 1, 'E her HP stops at exactly 1 (the min(hp-1) clamp)');
  assertEq(minNoelle, 1, 'E ...and never dipped below it on any of the 24 ticks');
  assert(!st.kaizo.freeze[0], 'E Kris, not the target, is untouched');
}
{
  // A one-person Noelle party: the same rule, with nobody else to absorb it.
  const st = mk({ charIds: [4] });
  castSnowgrave(st, { caster: 0, magic: 13 });
  run(st, 900, (s) => s.kaizo.sgscene === 0 && s.frame > 60);
  assertEq(ensureScenes(st).sg.target, 0, 'E a solo Noelle party targets slot 0');
  assert(!st.kaizo.freeze[0], 'E ...and she still cannot be frozen');
  assertEq(st.partyHp[0], 1, 'E ...HP 1, the clamp holding');
}
{
  // POSITIVE EXECUTION of the flake's Noelle branch: deflecting off her costs
  // three extra draws per flake, so the two targets cannot spend the same.
  const kris = mk();
  castSnowgrave(kris, { caster: 1, magic: 13 });
  const kc = ensureScenes(kris);
  run(kris, 900, (s) => { kc.sg.target = 0; return s.kaizo.sgscene === 0 && s.frame > 60; });

  const noelle = mk();
  castSnowgrave(noelle, { caster: 1, magic: 13 });
  const nc = ensureScenes(noelle);
  run(noelle, 900, (s) => { nc.sg.target = 1; return s.kaizo.sgscene === 0 && s.frame > 60; });

  assert(sceneDraws(noelle).flakes > sceneDraws(kris).flakes,
    'E the Noelle deflection branch RAN: '
    + `${sceneDraws(noelle).flakes} flake draws vs ${sceneDraws(kris).flakes} for Kris`);
  assert(noelle.audioCues.some((c) => c.name === 'snd_graze'),
    'E ...and it grazed off her (snd_graze cued)');
  assert(!kris.audioCues.some((c) => c.name === 'snd_graze'),
    'E ...which never happens on a Kris target');
}

{
  // The nohitmode abort at state 6, and the thrash the mod's own ordering
  // produces. ORIGINAL BEHAVIOUR, preserved: the delay to 7 is armed BEFORE
  // k_sgscene is overwritten, and the flakes keep pushing it back to 6.
  const st = mk({ knight: { nohitmode: true } });
  castSnowgrave(st, { caster: 1, magic: 13 });
  const sc = ensureScenes(st);
  run(st, 600, (s) => { sc.sg.target = 0; return false; });
  assertEq(st.knight.progamer, false, 'E nohitmode aborts the sg scene and clears progamer');
  assert(!st.kaizo.freeze[0] && !st.kaizo.freeze[1],
    'E ...freezing nobody');
  assertJson(st.partyHp, [160, 120], 'E ...and costing nobody any HP');
  const zeros = ladder(st, 'sg').filter((r) => r[1] === 0).length;
  assert(zeros > 1,
    `E the documented 6 -> 6.1 -> 0 -> 6 thrash really happens (${zeros} aborts)`);
  assertEq(st.kaizo.sgscene, 0, 'E ...and it settles back at 0');
}

// ═══ F: THE DELAYS ARE ALARMS ═══════════════════════════════════════════════
console.log('scr_delay_var — a real alarm, not a counter');
{
  const st = mk();
  const inst = scrDelayVar(st, 'tp', 42, 5);
  assertEq(inst.alarm[0], 5, 'F the delay armed alarm[0] = 5');
  assertJson(pendingDelays(st), [{ scene: 'tp', value: 42, frames: 5 }],
    'F pendingDelays reports the armed assignment');
  let fired = -1;
  for (let f = 0; f < 12; f++) {
    stepFrame(st, IDLE);
    if (fired < 0 && st.kaizo.tpscene === 42) fired = f + 1;
  }
  assertEq(fired, 5, 'F it fired 5 frames later, in the ALARM phase before the Step');
  assertJson(pendingDelays(st), [], 'F ...and destroyed itself');
}
{
  const st = mk();
  scrDelayVar(st, 'sg', 3, 40);
  scrDelayVar(st, 'nh', 4, 40);
  assertEq(destroyPendingDelays(st), 2,
    'F destroyPendingDelays clears them all (the no-hit reset\'s `with`)');
  assertJson(pendingDelays(st), [], 'F nothing left armed');
}

// ═══ G: THE STATE TABLES ARE THE DUMP'S ═════════════════════════════════════
{
  assertJson(TP_SCENE_STATES.map((r) => r.at), [1, 2, 3, 4, 5, 11, 11.2, 12],
    'G the tp table lists the eight branches Step_0:1930-2049 has');
  assertEq(TP_SCENE_STATES.find((r) => r.at === 5).draws, 3,
    'G ...and only state 5 spends RNG');
  assertEq(TP_SCENE_STATES.filter((r) => r.draws).length, 1, 'G exactly one');
  assertJson(NH_SCENE_STATES.map((r) => r.at), [1, 2, 3, 4, 5, 7, 8],
    'G the nh table lists the seven branches (there is no state 6 body)');
  assertJson(SG_SCENE_STATES.map((r) => r.at),
    [1, 2, 3.1, 3, 4, 4.1, 5, 6, 6.1, 7, 8],
    'G the sg table lists the eleven branches, 3.1 BEFORE 3 as in the source');
  assertEq(SG_SPELLDELAY_STALL, 999999, 'G the stall value');
}

// ═══ H: DETERMINISM ═════════════════════════════════════════════════════════
console.log('determinism');
{
  const fingerprint = (seed) => {
    const st = mk({ seed });
    castSnowgrave(st, { caster: 1, magic: 13 });
    st.kaizo.prevatk = TP_ARM_PREVATK;
    run(st, 900, (s) => s.kaizo.sgscene === 0 && s.frame > 60);
    return JSON.stringify({
      log: ensureScenes(st).log,
      draws: sceneDraws(st),
      hp: st.partyHp,
      freeze: st.kaizo.freeze,
    });
  };
  const a = fingerprint(12345);
  assertEq(fingerprint(12345), a, 'H same seed: byte-identical scene run');
  assert(fingerprint(54321) !== a, 'H different seed: different run (non-vacuous)');
}

// ═══ I: THE REPORT ══════════════════════════════════════════════════════════
{
  const st = mk();
  const r = sceneReport(st);
  assertEq(r.tpscene, 0, 'I report reads k_tpscene through tensionbar.js');
  assertEq(r.clampActive, false, 'I ...and the clamp gate through it too');
  assertEq(r.transitions, 0, 'I nothing has happened yet');
  assert(!sceneActive(st), 'I no scene is running');
  // stepScenes is callable directly — the "per-frame step the scene owner can
  // drive" the work item asks for.
  const ran = stepScenes(st);
  // FOUR keys since 2026-09-10: `hp` is k_hpscene, the max-HP shear
  // (Step_0:1774-1928), which is NOT B-Side gated and has its own check —
  // kaizo/tools/checks/check-hpscene.mjs. It reports false here for the same
  // reason the other three do: nothing armed it.
  assertJson(ran, {
    nh: false, sg: false, hp: false, tp: false,
  }, 'I stepScenes is a no-op with nothing armed');
  assertEq(r.hpscene, 0, 'I report reads k_hpscene too');
  assertEq(sceneDraws(st).hp, 0, 'I ...and its draw budget starts at 0');
}

console.log('');
console.log(`check-scenes: ${checks - failures}/${checks} assertions passed`);
if (failures) {
  console.log(`check-scenes: ${failures} FAILING`);
  process.exit(1);
}
