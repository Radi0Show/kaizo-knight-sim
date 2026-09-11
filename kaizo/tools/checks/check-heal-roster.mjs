#!/usr/bin/env node
// NO-HIT MODE'S OPENING HEAL, AND THE SLOT IT MUST NOT TOUCH.
//
//   node kaizo/tools/checks/check-heal-roster.mjs
//
// GML: `gml_Object_obj_knight_enemy_Create_0.gml:104-107`
//
//     nohitmode = 1;                        // :103
//     global.hp[1] = global.maxhp[1];       // :104
//     global.hp[2] = global.maxhp[2];       // :105
//     global.hp[3] = global.maxhp[3];       // :106
//     global.hp[4] = global.maxhp[4];       // :107
//
// ── THE BUG THIS OWNS ─────────────────────────────────────────────────────
//
// `healPartyToMax` (kaizo/scenes/kaizo-fight.js) walks `state.partyHp` BY
// SLOT, because that is how this engine indexes the party. `state.partyHp`
// is not the roster, though: `buildKaizoScene` pads a short party back out to
// three, with the spare marked dead and untargetable, because that is exactly
// what `global.char = [1, 4, 0]` looks like to the many vanilla-shaped
// consumers that walk slots 0..2.
//
// So on the Weird Route the walk ran slot 2 as well — a slot with no
// character in it. `maxhpOfChar` returned 0 for it (right), `state.partyMaxhp`
// has only the roster's two entries (right), and the chain fell through to the
// engine's vanilla table: `PARTY[2].maxhp`, RALSEI'S 140, written into a slot
// the Weird Route's party does not have.
//
//     buildKaizoScene({ version: 'D', mode: 'nohit' })
//     partyHp  [160, 120, 0]  ->  [160, 120, 140]   with chardead [0, 0, 1]
//
// WHY THE EXISTING CHECK MISSED IT, which is the more useful half. The
// assertion in check-knight-mode.mjs that was supposed to pin the max-lookup
// ORDER built its own state and set `partyHp = [1, 1]` — a two-entry array.
// buildKaizoScene never produces that shape. The walk therefore stopped at
// slot 1 and never reached the pad, so the assertion was testing a roster
// this program cannot be in. Everything here goes through buildKaizoScene.
//
// ── WHAT IS ASSERTED, and all of it is positive ───────────────────────────
//
//   1. The heal HAPPENS, on every version, and is a real change.
//   2. It reads the ROSTER's max (Noelle 120), never PARTY[1] = Susie 190.
//   3. The padded slot is left exactly as the padding made it — 0, dead,
//      untargetable — and stays consistent with `chardead` after the heal.
//   4. Practice and Standard heal nobody at Create.
//   5. A THREE-person roster is healed in full, so the skip is "no character
//      here", not "stop at the roster length".
//
// SABOTAGE-TESTED: dropping the CHAR_NONE guard — putting the fall-through
// back — reddens three assertions here and one in check-knight-mode.mjs.
//
// AN HONEST NOTE ABOUT WHAT THIS CANNOT DISTINGUISH. Writing the guard as
// `slot >= rosterSize(state)` instead of "this slot holds a character" also
// passes, every assertion, measured. The two are equivalent for every roster
// this program can be in, because `scr_fixparty` COMPACTS — it packs the
// chosen characters toward slot 0 and zero-fills the tail, so an occupied slot
// can never sit after an empty one and there is no reachable state that tells
// them apart. The character test is still the one written, because it is the
// one the GML makes: the mod indexes `global.hp[]` by character and an absent
// character's cell is simply somewhere nothing reads. Do not "simplify" it
// into a length test on the strength of this check staying green.

import { createState } from '../../../sim/index.js';
import { PARTY } from '../../../sim/damage.js';
import { buildKaizoScene, applyKnightMode, KNIGHT_MODES } from '../../scenes/kaizo-fight.js';
import { charIdOf, maxhpOfChar, CHAR_NONE } from '../../party/roster.js';

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

/** A built scene, through the real builder and nothing else. */
function build(version, mode) {
  const st = createState({ seed: 4242, traceBulletSlots: 0 });
  return buildKaizoScene(st, { version, mode });
}

// ── 1. THE SHAPE THE BUILDER REALLY MAKES ─────────────────────────────────
section('the builder pads to three, and slot 2 of the Weird Route is nobody');
{
  const d = build('D');
  assertEq(d.partyHp.length, 3, 'V-D partyHp is THREE long, not two');
  assertEq(d.kaizo.roster.length, 2, '...over a roster of two');
  assertEq(charIdOf(d, 2), CHAR_NONE, 'slot 2 holds character 0 — nobody');
  assertEq(d.chardead[2], 1, '...and the pad is dead');
  assertEq(d.charcantarget[2], 0, '...and untargetable');
  assertEq(maxhpOfChar(d, charIdOf(d, 2)), 0, '...and has no max HP to heal to');
  // The fall-through's source, named so this check says WHY 140 and not some
  // other number.
  assertEq(PARTY[2].maxhp, 140, 'PARTY[2] is RALSEI 140 — the value that used to land here');
}

// ── 2. THE HEAL, ON THE WEIRD ROUTE ───────────────────────────────────────
section('mode "nohit" on V-D: two members healed, the pad untouched');
{
  const off = build('D');
  assertEq(off.partyHp.join(','), '160,120,0', 'CONTROL: no mode, the built party');

  const on = build('D', 'nohit');
  assertEq(on.partyHp.join(','), '160,120,0',
    'the heal leaves the PAD at 0 — Ralsei\'s 140 never lands in slot 2');
  assertEq(on.kaizo.nohitmode, true, '...and it really was no-hit mode (the heal ran)');
  assertEq(on.partyHp[1], 120,
    'slot 1 is NOELLE\'s 120, off the roster — not PARTY[1] = Susie 190');
  assert(on.partyHp[1] !== PARTY[1].maxhp, '...and 120 is not 190, so the order is observable');
  // The pad stays internally consistent: dead, untargetable, and empty.
  assert(on.chardead[2] === 1 && on.partyHp[2] === 0,
    'the pad is still dead AND still empty — no HP on a slot nobody can use');
}

// ── 3. THE HEAL IS A REAL CHANGE, not a no-op that happens to agree ───────
//
// HURT THE PARTY FIRST, THEN RUN THE CREATE BLOCK. A second `buildKaizoScene`
// would not do: `installRoster` rebuilds `state.partyHp` from the roster, so
// the party is already back to full before the heal is reached and the whole
// assertion is vacuous (measured — it passed all three modes). `applyKnightMode`
// is the last thing the builder calls, so calling it here is the production
// path with nothing in front of it.
section('the heal moves HP it is given the chance to move');
{
  const st = build('D');
  st.partyHp[0] = 7;
  st.partyHp[1] = 9;
  applyKnightMode(st, KNIGHT_MODES.nohit);
  assertEq(st.partyHp.slice(0, 2).join(','), '160,120',
    'a hurt Weird Route party is put back to full');
  assertEq(st.partyHp[2], 0, '...and the pad is STILL 0 after a real heal ran');
}

// ── 4. THE OTHER TWO MODES HEAL NOBODY AT CREATE ──────────────────────────
section('only mode 1 heals');
{
  for (const [label, mode] of [
    ['practice', KNIGHT_MODES.practice],
    ['standard', KNIGHT_MODES.standard],
    ['(the global does not exist)', undefined],
  ]) {
    const st = build('D');
    st.partyHp[0] = 7;
    st.partyHp[1] = 9;
    applyKnightMode(st, mode);
    assertEq(st.partyHp.slice(0, 2).join(','), '7,9',
      `mode ${label} heals nobody at Create`);
  }
}

// ── 5. A FULL ROSTER IS HEALED IN FULL ────────────────────────────────────
//
// This is what distinguishes "skip a slot with no character" from "stop at the
// roster length". V-C installs no roster at all, so `charIdOf` falls back to
// the vanilla three and every slot has somebody in it — all three must heal,
// slot 2 included.
section('V-C: three characters, three heals — the guard is per-character');
{
  const st = build('C');
  const full = st.partyHp.slice();
  st.partyHp[0] = 3;
  st.partyHp[1] = 4;
  st.partyHp[2] = 5;
  applyKnightMode(st, KNIGHT_MODES.nohit);
  assertEq(st.partyHp.join(','), full.join(','),
    'all three slots are healed back to the vanilla maxes');
  assertEq(st.partyHp[2], PARTY[2].maxhp,
    '...INCLUDING slot 2, which on V-C is a real character (Ralsei 140)');
  for (let s = 0; s < 3; s++) {
    assert(charIdOf(st, s) !== CHAR_NONE, `V-C slot ${s} really does hold a character`);
  }
}

console.log(`\ncheck-heal-roster: ${count - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
