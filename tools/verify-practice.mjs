#!/usr/bin/env node
// THE PRACTICE HARNESS — Bad Time Simulator's health/damage/reset model,
// translated onto a three-member party and a turn-indexed fight.
//
// WHAT IS BEING CHECKED, and why each one is here rather than assumed:
//
//   1. PRACTICE IS ON THE MAIN MENU, and the four rows that were already
//      there did not move. The mode list is shared with other work; an
//      appended row is the one edit that cannot renumber somebody else's
//      index, so that property is asserted rather than remembered.
//   2. THE THRESHOLD IS A THRESHOLD. BTS fires on `HP - KR < PracticeTarget`,
//      not on death, so the discriminating case is a party that is ALIVE —
//      every member above zero — and still under the target. A check that
//      only ever wiped the party would pass against a plain `partyWiped`
//      and prove nothing about the translation.
//   3. `KR` HAS NO COUNTERPART AND NONE WAS INVENTED. `effectivePartyHp` is
//      asserted to be exactly the clamped sum of the roster, so a karma-like
//      subtrahend appearing later fails here.
//   4. EFFECTIVE HP IS NOT A NAIVE SUM. A swooned member sits at -999 and a
//      roster is not always three, so both are exercised directly.
//   5. THE RESET IS CHEAP, AND IT STAYS CHEAP. The cost of a retry is
//      asserted against the cost of a fresh build measured IN THE SAME RUN,
//      not against a hardcoded 9 — a number in a suite rots the moment the
//      turn's opening changes, and the property that matters is the ratio.
//   6. THE RETRY DOES NOT DRIFT. Replaying a turn without rewinding
//      `damagereduction` makes the Knight one ramp step tougher per death,
//      which is a practice tool lying to the person practising.
//   7. THE UNINSTRUMENTED PATH IS UNTOUCHED. With no harness the wipe still
//      latches `gameOver` and nothing new exists on the state. This is the
//      cheap half of that guarantee; the expensive half is verify-fullfight,
//      which replays this exact scene byte-for-byte.
//
// SABOTAGE-TESTED BOTH WAYS. Breaking the threshold (never fires) fails
// check 2; over-correcting it (fires unconditionally, ignoring the flag)
// fails check 7. Both directions are reported in the lane notes.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createState, stepFrame } from '../sim/index.js';
import { buildPracticeScene, practiceOptions, PRACTICE_DEFAULTS } from '../sim/scenes/practice.js';
import { effectivePartyHp, partyWiped, freshParty, PARTY } from '../sim/damage.js';
import { MODES } from '../sim/modes.js';

let failures = 0;
function ok(label, cond, detail = '') {
  if (cond) {
    console.log(`  OK   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** A scene with the harness installed, stepped to the first steerable soul. */
function scene(practice) {
  const st = createState({ seed: 12345, traceBulletSlots: 0 });
  st.runMode = practice ? 'practice' : 'normal';
  buildPracticeScene(st, { seed: 12345, practice });
  return st;
}

/** Frames from NOW until the soul is steerable, mashing confirm through menus. */
function framesToSoul(st, budget = 600) {
  const from = st.frame;
  for (let i = 0; i < budget; i++) {
    stepFrame(st, { confirm: i % 2 === 0 });
    if (st.soul && st.soul.alive) return st.frame - from;
  }
  return Infinity;
}

// ── 1 — PRACTICE IS ON THE MAIN MENU ──────────────────────────────────────
console.log('\nthe mode list');
{
  const ids = MODES.map((m) => m.id);
  const row = MODES.find((m) => m.id === 'practice');
  ok('PRACTICE has a row in MODES', !!row, `ids: ${ids.join(', ')}`);
  ok('…with a name and a blurb', !!row && !!row.name && !!row.blurb,
    row ? JSON.stringify(row) : 'no row');
  // The four that were already there keep their positions, so the ENDLESS
  // submenu work and TITLE_EXTRAS' `MODES.length` offset both stay put.
  ok('the original four keep their indices',
    ids[0] === 'normal' && ids[1] === 'hitless' && ids[2] === 'endless' && ids[3] === 'single',
    ids.join(', '));
  ok('every row has a unique id', new Set(ids).size === ids.length, ids.join(', '));
  // Voice: the existing blurbs are one short flat sentence. A row that
  // narrates the setting back to the player is the thing that keeps getting
  // rejected, so the length is pinned.
  ok('the blurb is one short line like the others',
    !!row && row.blurb.length <= 48 && !/\n/.test(row.blurb),
    row ? `${row.blurb.length} chars` : 'no row');
}

// ── 2 — THE OPTIONS OBJECT ────────────────────────────────────────────────
console.log('\npracticeOptions');
{
  ok('a falsy argument installs nothing', practiceOptions(null) === null
    && practiceOptions(undefined) === null && practiceOptions(false) === null);
  const d = practiceOptions(true);
  ok('`true` means the defaults',
    d.target === PRACTICE_DEFAULTS.target && d.reset === PRACTICE_DEFAULTS.reset,
    JSON.stringify(d));
  ok('the default reset is the ATTACK, not the run', PRACTICE_DEFAULTS.reset === 'attack',
    PRACTICE_DEFAULTS.reset);
  ok('a custom target is kept', practiceOptions({ target: 250 }).target === 250);
  ok('a junk target falls back to the default',
    practiceOptions({ target: 'x' }).target === PRACTICE_DEFAULTS.target);
  ok('an unknown reset falls back to `attack`',
    practiceOptions({ reset: 'nonsense' }).reset === 'attack');
  ok('`run` is honoured', practiceOptions({ reset: 'run' }).reset === 'run');
}

// ── 3 — EFFECTIVE HP: BTS's LEFT-HAND SIDE, WITH NO KARMA IN IT ───────────
console.log('\neffectivePartyHp — `HP - KR` with KR provably absent');
{
  const st = createState({ seed: 1, traceBulletSlots: 0 });
  st.partyHp = freshParty(st);
  const full = PARTY[0].maxhp + PARTY[1].maxhp + PARTY[2].maxhp;
  ok('a healthy party sums to the roster maxhp exactly', effectivePartyHp(st) === full,
    `${effectivePartyHp(st)} vs ${full}`);

  // NO KARMA. If anything BTS-shaped ever subtracts a pending-damage term,
  // this equality is the first thing that breaks.
  st.partyHp = [100, 50, 25];
  ok('it is the plain clamped sum — nothing is subtracted',
    effectivePartyHp(st) === 175, String(effectivePartyHp(st)));

  // THE SWOON FLOOR. Down members sit at -999 (and Kris at -maxhp/2), so a
  // naive sum reads negative while two members are still standing.
  st.partyHp = [-80, 190, -999];
  ok('a swooned member contributes 0, not -999',
    effectivePartyHp(st) === 190, String(effectivePartyHp(st)));
  ok('…and the naive sum would have been negative',
    st.partyHp.reduce((a, b) => a + b, 0) < 0);

  // THE ROSTER IS NOT ALWAYS THREE. Slot 2 of a two-member party is nobody,
  // and `undefined` there turns any arithmetic into NaN.
  const two = createState({ seed: 1, traceBulletSlots: 0 });
  two.kaizo = { roster: [PARTY[0], PARTY[1]] };
  two.partyHp = [160, 190];
  ok('a two-member roster counts two slots, not NaN',
    effectivePartyHp(two) === 350, String(effectivePartyHp(two)));

  // At target 1 the threshold IS the old death condition, which is what
  // makes the default a strict generalisation rather than a behaviour change.
  const w = createState({ seed: 1, traceBulletSlots: 0 });
  w.partyHp = [0, 0, 0];
  ok('at target 1 the threshold equals partyWiped',
    (effectivePartyHp(w) < 1) === partyWiped(w) && partyWiped(w) === true);
  w.partyHp = [0, 1, 0];
  ok('…and one survivor is neither wiped nor under target 1',
    (effectivePartyHp(w) < 1) === false && partyWiped(w) === false);
}

// ── 4 — THE THRESHOLD FIRES ON A LIVING PARTY ─────────────────────────────
// THE DISCRIMINATING CHECK. Everything above could be satisfied by a rename
// of `partyWiped`. This cannot: every member is above zero and the reset
// still fires, because the target is 300 rather than 1.
console.log('\nthe threshold — continuous, and not a death test');
{
  const st = scene({ target: 300, reset: 'attack' });
  framesToSoul(st);
  for (let i = 0; i < 20; i++) stepFrame(st, {});
  st.partyHp = [50, 50, 50];              // 150 < 300, and nobody is down
  const before = st.practiceRetries;
  let fired = -1;
  for (let i = 0; i < 60; i++) {
    stepFrame(st, {});
    if (st.practiceRetries > before) { fired = i; break; }
  }
  ok('a party that is ALIVE but under target resets', fired >= 0,
    `retries ${before} -> ${st.practiceRetries}`);
  ok('…and it fired without waiting for a turn boundary', fired >= 0 && fired <= 2,
    `after ${fired} frames`);
  ok('…and nobody had to reach zero first', !partyWiped({ partyHp: [50, 50, 50] }));
  ok('the reset refilled the party', effectivePartyHp(st) === freshParty(st).reduce((a, b) => a + b, 0),
    JSON.stringify(st.partyHp));
  ok('the run did not end', st.gameOver === false);

  // ABOVE the target nothing happens — the threshold is a comparison, not a
  // trigger that fires whenever HP moved at all.
  const q = scene({ target: 300, reset: 'attack' });
  framesToSoul(q);
  for (let i = 0; i < 20; i++) stepFrame(q, {});
  q.partyHp = [200, 200, 200];
  const r0 = q.practiceRetries;
  for (let i = 0; i < 30; i++) stepFrame(q, {});
  ok('a party ABOVE the target is left alone', q.practiceRetries === r0,
    `retries ${r0} -> ${q.practiceRetries}`);
}

// ── 5 — THE RESET IS CHEAP ────────────────────────────────────────────────
console.log('\nthe reset cost');
let freshCost = Infinity;
let retryCost = Infinity;
{
  const st = scene({ target: 1, reset: 'attack' });
  freshCost = framesToSoul(st);
  ok('a fresh run reaches a steerable soul', Number.isFinite(freshCost), String(freshCost));

  for (let i = 0; i < 40; i++) stepFrame(st, {});
  st.partyHp = [0, 0, 0];
  // Advance to the frame the threshold fires on, then measure from there.
  const before = st.practiceRetries;
  let guard = 0;
  while (st.practiceRetries === before && guard++ < 60) stepFrame(st, {});
  ok('the wipe was caught', st.practiceRetries > before);
  retryCost = framesToSoul(st, 200);

  ok('a retry reaches a steerable soul', Number.isFinite(retryCost), String(retryCost));
  // The ratio, not the number: the opening of a turn may legitimately change,
  // but a retry costing anything like a fresh run is the regression.
  ok('a retry costs less than a quarter of a fresh run',
    retryCost * 4 < freshCost, `retry ${retryCost} vs fresh ${freshCost}`);
  ok('a retry is under 20 frames', retryCost < 20, String(retryCost));
  ok('the party came back to full',
    JSON.stringify(st.partyHp) === JSON.stringify(freshParty(st)), JSON.stringify(st.partyHp));
  ok('the soul is steerable, not just present', !!(st.soul && st.soul.alive));
}

// ── 6 — THE RETRY DOES NOT DRIFT ──────────────────────────────────────────
// `advanceTurn` ramps `damagereduction` by 0.01 in the same block the turn
// spawns from. Replaying the turn without rewinding it makes every death
// leave the Knight tougher — silently, and only for the person practising.
console.log('\nrepeated retries do not ramp the fight under you');
{
  const st = scene({ target: 1, reset: 'attack' });
  framesToSoul(st);
  const drs = [];
  for (let n = 0; n < 3; n++) {
    for (let i = 0; i < 30; i++) stepFrame(st, {});
    st.partyHp = [0, 0, 0];
    const before = st.practiceRetries;
    let guard = 0;
    while (st.practiceRetries === before && guard++ < 60) stepFrame(st, {});
    framesToSoul(st, 200);
    drs.push(st.knight?.damagereduction);
  }
  ok('three retries happened', st.practiceRetries === 3, String(st.practiceRetries));
  ok('damagereduction is identical across all three',
    drs.every((d) => d === drs[0]), JSON.stringify(drs));
  ok('…and it is a real number, not undefined', Number.isFinite(drs[0]), String(drs[0]));
  ok('the turn index did not run away', st.phaseturn === 1 && st.knightPhase === 1,
    `phaseturn ${st.phaseturn} knightPhase ${st.knightPhase}`);
}

// ── 7 — THE UNINSTRUMENTED PATH IS UNTOUCHED ──────────────────────────────
// This is the cheap half. The expensive half is verify-fullfight, which
// replays this scene byte-for-byte through tools/fullfight-trace.mjs.
console.log('\nno harness, no change');
{
  const st = scene(null);
  ok('nothing is installed on the state', st.practice === undefined, JSON.stringify(st.practice));
  ok('no retry counter exists', st.practiceRetries === undefined);
  framesToSoul(st);
  for (let i = 0; i < 20; i++) stepFrame(st, {});
  st.partyHp = [0, 0, 0];
  stepFrame(st, {});
  ok('a wipe still latches gameOver, exactly as before', st.gameOver === true);
  ok('…and the menu still closes', st.menu.open === false);
  ok('…and nothing rewound the turn', st.practiceRetries === undefined);

  // `reset: 'run'` is the same old behaviour, kept and named.
  const r = scene({ target: 1, reset: 'run' });
  framesToSoul(r);
  for (let i = 0; i < 20; i++) stepFrame(r, {});
  r.partyHp = [0, 0, 0];
  stepFrame(r, {});
  ok("reset:'run' latches gameOver and hands it to the driver", r.gameOver === true);
  ok("…and does NOT rewind the attack", r.practiceRetries === 0, String(r.practiceRetries));
}

// ── 8 — THE DRIVER ACTUALLY INSTALLS IT ───────────────────────────────────
// EVERYTHING ABOVE PASSES IF THE MENU ROW LAUNCHES A FIGHT WITH NO HARNESS.
// The suite calls `buildPracticeScene` directly; the player goes through
// web/main.js, and nothing above this point touches that file. That is the
// project's own "a green suite does not mean a change took effect" trap, so
// the wiring is read from the driver's source — the same thing
// verify-rafloop does with the frame loop, and for the same reason: the
// driver owns real time and the DOM, so it cannot be imported here.
console.log('\nthe driver installs the harness');
{
  const HERE = dirname(fileURLToPath(import.meta.url));
  // WHICH DRIVER. This suite is vendored, and kaizo-knight-sim's page driver
  // is `web/kaizo.js`. A hardcoded `web/main.js` did not fail there, it threw
  // ENOENT and took the suite down — so both names are tried.
  let driverName = null;
  let main = null;
  for (const name of ['main.js', 'kaizo.js']) {
    const at = join(HERE, '..', 'web', name);
    if (existsSync(at)) { driverName = `web/${name}`; main = readFileSync(at, 'utf8'); break; }
  }
  ok('a page driver exists to read', main !== null,
    'tried web/main.js and web/kaizo.js');

  // A DRIVER MAY NOT OFFER THIS MODE AT ALL, and that is a legitimate answer
  // rather than a hole to skip past. The engine is vendored into pages that
  // build their fight with their OWN scene (kaizo-knight-sim calls
  // buildKaizoScene, not buildPracticeScene), and such a page narrows the
  // title's list — `title.modes` — instead of advertising a row it cannot run.
  //
  // So the check is a FORK, and both arms assert something:
  //
  //   offers practice  -> the wiring below must all be present
  //   narrows it away  -> the narrowing must be present AND the driver must
  //                       have no half-wiring pretending otherwise
  //
  // What is NOT allowed is the third state: no narrowing and no wiring, which
  // is a menu row whose blurb promises a rewind over a scene that plays a
  // normal run. That is the shape this fork exists to make impossible.
  const narrows = /title\.modes\s*=/.test(main ?? '');
  // `[\s\S]{0,160}?` and not `[^)]*`: the filter's own callback carries a
  // `)` (`(m) => m.id !== 'practice'`), so a negated-paren class stops dead at
  // the arrow's parameter list and the narrowing reads as absent. That is
  // exactly how this fork first took the WRONG arm on the page it was
  // written for, reporting eight failures against a driver that was correct.
  const excludesPractice = /title\.modes\s*=\s*MODES\.filter\([\s\S]{0,160}?!==\s*'practice'/.test(main ?? '');

  if (narrows && excludesPractice) {
    console.log(`  --    ${driverName} does not offer PRACTICE; asserting it offers none of it`);
    ok('...the narrowing names practice explicitly', excludesPractice);
    // COMMENTS STRIPPED FIRST. A driver that drops the row should SAY why and
    // say what wiring it back would take, and the honest version of that note
    // names `buildPracticeScene` — so a scan of the raw text reddens on the
    // documentation and not on any code. This repo has shipped a check that
    // certified its own prose more than once; verify-actspare strips the same
    // way, for the same reason.
    const liveDriver = main
      .split(String.fromCharCode(10))
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join(String.fromCharCode(10));
    ok('...and the driver carries no half-wiring for a mode it does not offer',
      !/practiceOptsFor|buildPracticeScene/.test(liveDriver),
      'a driver that narrows the row away must not also reference the harness');
  } else {
  ok('buildPracticeScene is called WITH the practice option',
    /buildPracticeScene\(st,\s*\{[^}]*practice:\s*practiceOpts/.test(main),
    'the whole-fight build must forward practiceOpts');
  ok('the option is derived from the mode, not hardcoded',
    /function practiceOptsFor\(/.test(main));
  ok("…and it answers non-null for 'practice'",
    /m === 'practice'\s*\?\s*\{[^}]*reset:\s*'attack'/.test(main));
  ok('startRun sets it from runMode',
    /practiceOpts = practiceOptsFor\(runMode\)/.test(main));
  ok('the shared-link path sets it too',
    /practiceOpts = practiceOptsFor\(title\.mode\)/.test(main));
  // A latched gameOver in PRACTICE must restart, never reach the death
  // screen — the mode exists so that a death does not stop to explain itself.
  ok('a gameOver in PRACTICE restarts rather than ending the run',
    /runMode === 'practice'/.test(main)
    && /runMode === 'endless' \|\| runMode === 'hitless' \|\| runMode === 'practice'/.test(main));
  // `practiceOpts` must be declared before `build`, which runs at module top
  // level for `?mode=` deep links — a `let` below it is a TDZ ReferenceError
  // on exactly the paths that skip the title screen.
  ok('practiceOpts is declared before build() uses it',
    main.indexOf('let practiceOpts') >= 0
    && main.indexOf('let practiceOpts') < main.indexOf('function build(st)'),
    `decl ${main.indexOf('let practiceOpts')}, build ${main.indexOf('function build(st)')}`);

  // AND THE MENU ROW REACHES IT. `startRun` sets `runMode = title.mode`, and
  // `title.mode` is a MODES id — so the row's id and the driver's test have
  // to be the same string, which is the join a rename would quietly break.
  ok("the MODES row id is the string the driver tests for",
    MODES.some((m) => m.id === 'practice') && /runMode === 'practice'/.test(main));
  }
}


// ── THE DAMAGE ALLOWANCE — what makes this mode strict ─────────────────────
//
// The first cut ported Bad Time Simulator's condition literally: `HP - KR <
// PracticeTargetTest`, with that test at 2. It is savage in BTS — 92 HP, one
// pool, no revives, and karma that finishes you from a few ticks — and it
// arrived here as a floor of 1 across 490 HP in THREE pools WITH revives, so
// it fired only on a total wipe. The strictest mode in the reference became
// the most forgiving thing in this tool. Reported from play as exactly that.
//
// What transfers is the SHAPE: take a certain amount and the turn starts over.
{
  const { scrDamage } = await import('../sim/damage.js');

  const st = scene({ reset: 'attack' });
  const total = freshParty(st).reduce((a, b) => a + b, 0);
  ok('the allowance is resolved from the LIVE roster, not a literal',
    st.practice.allowance === Math.max(1, Math.round(total / 5)),
    `allowance ${st.practice.allowance} against a party of ${total}`);
  ok('...and sits between the fight\'s own numbers: over a 50, under a 206',
    st.practice.allowance > 50 && st.practice.allowance < 206,
    `${st.practice.allowance}`);

  // UNDER the allowance nothing happens. This is the half that keeps the mode
  // from being HITLESS, which already exists as its own row.
  const under = Math.max(1, st.practice.allowance - 20);
  scrDamage(st, under, 1, { truedamage: true });
  for (let i = 0; i < 6; i += 1) stepFrame(st, {});
  ok('a hit UNDER the allowance does not rewind the turn',
    st.practiceRetries === 0 && st.practiceDamage >= under,
    `tally ${st.practiceDamage}, retries ${st.practiceRetries}`);

  // OVER it, the turn restarts with everyone standing and the tally cleared.
  scrDamage(st, 60, 1, { truedamage: true });
  for (let i = 0; i < 8; i += 1) stepFrame(st, {});
  ok('crossing the allowance rewinds the turn', st.practiceRetries >= 1,
    `retries ${st.practiceRetries}`);
  ok('...the party comes back up',
    st.partyHp.every((h, i) => h === freshParty(st)[i]), JSON.stringify(st.partyHp));
  ok('...and the tally starts over, or the next graze would rewind instantly',
    (st.practiceDamage ?? 0) === 0, `tally ${st.practiceDamage}`);

  // THE DISCRIMINATING ONE. Every member is comfortably alive, so a check that
  // still measured "are they nearly dead" cannot pass this.
  const s2 = scene({ reset: 'attack' });
  scrDamage(s2, s2.practice.allowance + 5, 1, { truedamage: true });
  for (let i = 0; i < 8; i += 1) stepFrame(s2, {});
  ok('it fires while EVERY member is still standing — damage taken, not HP left',
    s2.practiceRetries >= 1 && !partyWiped(s2) && effectivePartyHp(s2) > 100,
    `retries ${s2.practiceRetries}, effective HP ${effectivePartyHp(s2)}`);

  // And the gate's own build is untouched: no options, no tally, no property.
  const gate = scene(null);
  ok('the byte gate\'s build installs no tally at all',
    gate.practice === undefined && gate.practiceDamage === undefined);
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`} — practice harness\n`);
process.exit(failures === 0 ? 0 : 1);
