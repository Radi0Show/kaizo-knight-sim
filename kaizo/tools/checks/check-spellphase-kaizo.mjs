#!/usr/bin/env node
// KAIZO — obj_spellphase, THE MOD'S STEP (ledger G-25).
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE
//   gml_Object_obj_spellphase_Step_0.gml (KAIZO dump) :21-31  the downed-caster skip
//                                                     :31-81  the `char < 3` guard + else
//                                                     :67-76  the vanilla `using` tail loop, kept
//                                                     :82-83  spelltimer/re_castyet, OUTSIDE the guard
//   gml_Object_obj_spellphase_Step_0.gml (VANILLA v1.05) — the same event without either,
//                                                     which is what `sim/spellphase.js` translates
//
// WHAT THIS PROVES, and why each half is here.
//
//   1. THE LOOP ITSELF. `skipDownedCasters` is `repeat (2) { if (char < 3) {
//      if (global.hp[global.char[char]] <= 0) char += 1; } }` and nothing
//      else — in particular it re-reads HP at the NEW index each iteration
//      and has no early exit, so one standing slot stops it dead and two
//      downed slots in a row are the only way it advances twice. An empty
//      party slot (`global.char[c] == 0`, `global.hp[0] == 0`) is skipped
//      like a downed one, which is what a short roster does in the mod.
//
//   2. PARITY WITH THE ENGINE WHEN NOBODY IS DOWN. The kaizo Step is a
//      re-typed copy of the vendored one plus two branches; if the copy ever
//      drifts from `sim/spellphase.js` — a re-vendor, an engine fix — this
//      block goes red. It drives BOTH objects over a full two-caster phase
//      with the same inputs and compares the whole record and
//      `state.spelldelay` every frame. It also asserts the chain branch
//      actually RAN (both casts landed), because a parity test between two
//      objects that never enter the interesting branch proves nothing.
//      THIS IS THE BYTE-GATE CLAIM IN MINIATURE: `_tok3` casts nothing and
//      `_rev1`'s one spell turn runs with every member standing, so the mod
//      Step must be indistinguishable there — and it is.
//
//   3. THE MOD-ONLY BEHAVIOUR. Two casters queue; the second is knocked down
//      while the first is still resolving. Vanilla poses the corpse, opens a
//      writer for them and burns a full 90-frame `global.spelldelay` on a
//      cast that never happens. The mod skips them, takes the `else` arm,
//      sets `global.spelldelay = 1` and exits on the next frame. Both sides
//      are run on identical states and the difference is asserted in both
//      directions — the vanilla object must still do the vanilla thing, or
//      the "mod-only" claim is unfounded.
//
//     node kaizo/tools/checks/check-spellphase-kaizo.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import {
  createSpellphase, stepSpellphase, needsSpellphase,
  SPELLDELAY_CHAIN, SPELLDELAY_EMPTY, spellSpelldelay,
} from '../../../sim/spellphase.js';
import {
  stepKaizoSpellphase, skipDownedCasters, spellphaseHp,
} from '../../versions/kaizo-spellphase.js';
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
function section(t) { console.log(`\n== ${t}`); }

const RUDE_BUSTER = 1;

/**
 * A state with the vanilla three in their slots and a queued spell per
 * `casters`. No scene: obj_spellphase only reads the queues, the hero
 * records and `global.spelldelay`, and every side effect it can have is
 * routed through the `opts` seam below.
 */
function mk(casters) {
  const s = createState({ seed: 909 });
  s.pendingSpell = [];
  s.pendingItem = [];
  for (const c of casters) s.pendingSpell[c] = { id: RUDE_BUSTER, target: 0 };
  s.spelldelay = SPELLDELAY_CHAIN;
  return s;
}

/** The seam: record the casts instead of creating a Rude Buster. */
function opts(log) {
  return {
    castSpell: (st, c, id, target) => { log.push({ frame: st.frame, c, id, target }); return null; },
    applyItem: () => null,
  };
}

/**
 * Drive one phase to its end, alternating confirm so the battle writer's
 * page can be closed (the recording's token feed presses every other frame).
 * Returns the frame the object destroyed itself, or -1 if it never did.
 */
function run(state, sp, step, o, limit = 600) {
  const e = {};
  let doneAt = -1;
  const perFrame = [];
  for (let i = 0; i < limit && doneAt < 0; i++) {
    state.frame = i;
    state.input = { confirm: i % 2 === 0 };
    const done = step(state, sp, e, o);
    perFrame.push(`${i}|${sp.char}|${sp.spelltimer}|${sp.active}|${state.spelldelay}|${sp.writer ? 'W' : '-'}|${sp.castIn.join(',')}`);
    if (done) doneAt = i;
  }
  return { doneAt, perFrame };
}

// ── 1. the skip loop, on its own ───────────────────────────────────────────
section('gml_Object_obj_spellphase_Step_0.gml:21-31 — the downed-caster skip');
{
  const s = mk([0, 1, 2]);
  assertEq(spellphaseHp(s, 0), s.partyHp[0], 'spellphaseHp reads global.hp[global.char[slot]]');
  assert(s.partyHp[0] > 0 && s.partyHp[1] > 0 && s.partyHp[2] > 0, 'a fresh party is standing');

  assertEq(skipDownedCasters(s, 0), 0, 'nobody down: char is untouched');
  assertEq(skipDownedCasters(s, 2), 2, 'nobody down: char 2 is untouched');

  s.partyHp[0] = 0;
  assertEq(skipDownedCasters(s, 0), 1, 'slot 0 down: char 0 -> 1');
  assertEq(skipDownedCasters(s, 1), 1, '...and the loop stops at the standing slot 1');

  s.partyHp[1] = 0;
  assertEq(skipDownedCasters(s, 0), 2, 'slots 0+1 down: char 0 -> 2 (both repeats fire)');

  s.partyHp[2] = 0;
  assertEq(skipDownedCasters(s, 0), 2, 'THE REPEAT IS TWO, NOT A WHILE: three down still only advances 2');
  assertEq(skipDownedCasters(s, 1), 3, 'slots 1+2 down: char 1 -> 3, which is the else arm');
  assertEq(skipDownedCasters(s, 3), 3, '`if (char < 3)` guards both repeats: char 3 is untouched');

  // A slot the roster does not fill: `global.char[c] == 0`, `global.hp[0] == 0`.
  const short = createState({ seed: 1 });
  installRoster(short, { charIds: WEIRD_ROUTE_PARTY, sideb: true });
  assertEq(spellphaseHp(short, 2), 0, 'an unfilled slot reads global.hp[0] = 0');
  assertEq(skipDownedCasters(short, 2), 3, '...so a two-person roster skips slot 2 like a corpse');
}

// ── 2. parity with sim/spellphase.js when nobody is down ───────────────────
section('PARITY — the byte-gate claim: identical to the engine with everyone standing');
{
  const a = mk([0, 2]);
  const b = mk([0, 2]);
  assert(needsSpellphase(a), 'scr_attackphase would create the phase at all');
  const logA = [];
  const logB = [];
  const spA = createSpellphase(a);
  const spB = createSpellphase(b);
  const ra = run(a, spA, stepKaizoSpellphase, opts(logA));
  const rb = run(b, spB, stepSpellphase, opts(logB));

  assert(ra.doneAt > 0, `the kaizo phase ended (frame ${ra.doneAt})`);
  assertEq(ra.doneAt, rb.doneAt, 'both objects destroy themselves on the same frame');
  assertEq(ra.perFrame.join('\n') === rb.perFrame.join('\n'), true,
    'char / spelltimer / active / global.spelldelay / writer / castIn agree EVERY frame');
  assertEq(JSON.stringify(logA), JSON.stringify(logB), 'the same casts fire on the same frames');
  // The interesting branch really ran: two casters means the `else if
  // (scr_monsterpop() > 0)` chain was walked at least once.
  assertEq(logA.length, 2, 'both queued spells cast (the chain branch was entered)');
  assertEq(spA.castFrames[2] >= 0, true, 'the SECOND caster resolved — parity over a non-trivial path');
  assertEq(spA.kaizoSkipped.length, 0, 'and the mod loop skipped NOBODY, which is why the gate cannot move');
}

// ── 3. the mod-only behaviour ──────────────────────────────────────────────
section('THE DELTA — a caster knocked down after queueing is skipped, not posed');
{
  // Slot 0 casts; slot 2 queued a spell and is downed while slot 0 resolves.
  const mod = mk([0, 2]);
  const van = mk([0, 2]);
  const logM = [];
  const logV = [];
  const spM = createSpellphase(mod);
  const spV = createSpellphase(van);
  const eM = {};
  const eV = {};
  const oM = opts(logM);
  const oV = opts(logV);
  let doneM = -1;
  let doneV = -1;
  let elseArmDelay = null;
  for (let i = 0; i < 600 && (doneM < 0 || doneV < 0); i++) {
    // THE KNOCKDOWN. Frame 30 is after the alarm (5) and inside the first
    // caster's 90-frame spelldelay, so the phase has already committed to
    // walking to slot 2 — exactly the case the mod added the loop for.
    if (i === 30) { mod.partyHp[2] = 0; van.partyHp[2] = 0; }
    mod.frame = i;
    van.frame = i;
    mod.input = { confirm: i % 2 === 0 };
    van.input = { confirm: i % 2 === 0 };
    if (doneM < 0 && stepKaizoSpellphase(mod, spM, eM, oM)) doneM = i;
    if (doneV < 0 && stepSpellphase(van, spV, eV, oV)) doneV = i;
    if (spM.char === 3 && elseArmDelay === null && spM.active === 1 && mod.spelldelay === SPELLDELAY_EMPTY) {
      elseArmDelay = mod.spelldelay;
    }
  }

  assert(doneM > 0 && doneV > 0, `both phases ended (mod ${doneM}, vanilla ${doneV})`);
  assertEq(spM.kaizoSkipped.join(','), '2', 'the mod loop walked past slot 2 exactly once');
  assertEq(spM.castFrames[2], -1, 'the downed caster NEVER cast');
  assertEq(logM.length, 1, 'one cast in the mod: the standing slot 0 only');
  assertEq(elseArmDelay, SPELLDELAY_EMPTY, 'the `else` arm set global.spelldelay = 1 (:78-81)');

  // The other direction: the vendored object must still do the vanilla thing,
  // or "mod-only" is an empty claim.
  assertEq(spV.kaizoSkipped, undefined, 'the vendored object has no skip ledger at all');
  assert(spV.castFrames[2] >= 0, 'VANILLA poses the downed caster and fires their cast');
  assertEq(logV.length, 2, '...so vanilla logs two casts, one of them by a corpse');
  assert(doneV > doneM, `and vanilla runs LONGER (${doneV} vs ${doneM}) — the burnt spelldelay`);
  // WHAT THE SAVING ACTUALLY IS, measured in this harness rather than
  // reasoned: 29 frames, NOT 90. The chain arms `global.spelldelay = 90`
  // (:61) but the corpse's cast then fires through `fire()` and Rude
  // Buster's own case rewrites it to 30 — so vanilla's wasted stretch is the
  // 30 it waits after a cast that did nothing, and the mod spends 1. Pin the
  // number: if it moves, one of the two objects changed.
  assertEq(doneV - doneM, 29,
    'vanilla burns 29 more frames on the corpse (its cast rewrote spelldelay 90 -> 30)');

  // `spelltimer = 0; re_castyet = 0;` are outside the guard (:82-83): after
  // the else arm the timer restarted, which is what makes the exit take
  // exactly one more frame rather than firing immediately.
  assertEq(spellSpelldelay(RUDE_BUSTER), 30, 'Rude Buster still writes its own 30 through fire()');
  assertEq(SPELLDELAY_CHAIN, 90, 'the chain delay the mod skips is 90');
}

// ── 4. THE READER — the director really calls this object ──────────────────
section('WIRING — kaizo/scenes/kaizo-practice.js steps the MOD object, live');
{
  // THE FAILURE MODE THIS EXISTS FOR (CLAUDE.md law 5, and the repo's own
  // five-times-and-counting pattern): a module translated correctly and never
  // called. Sections 1-3 all pass with the director still on the vendored
  // `stepSpellphase`. So drive a REAL V-D turn to a real cast and look at the
  // object the director is holding: `kaizoSkipped` is written by
  // stepKaizoSpellphase on every frame and by nothing else, so its presence
  // is proof of which function ran.
  const IDLE = {
    left: false, right: false, up: false, down: false, confirm: false, cancel: false,
    focus: false, button3: false,
  };
  const press = (s, key) => {
    stepFrame(s, { ...IDLE, [key]: true });
    stepFrame(s, IDLE);
    for (let g = 0; g < 4 && (s.menu?.onebuffer ?? -1) >= 0; g++) stepFrame(s, IDLE);
  };
  const s = createState({ seed: 4242, traceBulletSlots: 8 });
  buildKaizoScene(s, { version: 'D' });
  s.tension = 40;
  stepFrame(s, IDLE);
  assert(s.menu.open && s.menu.charturn === 0, 'menu open on Kris');
  press(s, 'left');                 // DEFEND, +40 TP
  press(s, 'confirm');
  press(s, 'right');                // MAGIC
  press(s, 'confirm');
  // The grid opens on N-Action (scr_spellmenu_setup puts the caster's ACT rows
  // ahead of the spells for anyone who is not Kris), so IceShock is index 3:
  // down is +2 down the two columns, right is +1 across.
  press(s, 'down');                 // 0 -> 2, SleepMist
  press(s, 'right');                // 2 -> 3, IceShock
  press(s, 'confirm');              // spelltarget 2 -> the enemy row
  press(s, 'confirm');              // commit
  assertEq(s.pendingSpell?.[1]?.id, 9, 'Noelle queued IceShock — the turn needs obj_spellphase');

  const dir = () => s.entities.find((x) => x.alive && x.type?.name === 'fight_director');
  let sp = null;
  for (let f = 0; f < 90 && !sp; f++) {
    stepFrame(s, IDLE);
    sp = dir()?.spellphase ?? null;
  }
  assert(!!sp, 'the director created obj_spellphase for the cast');
  assert(Array.isArray(sp?.kaizoSkipped),
    'THE MOD STEP RAN: the director\'s phase carries kaizoSkipped, which only stepKaizoSpellphase writes');
  assertEq(sp?.kaizoSkipped?.length, 0, 'and it skipped nobody — nobody is down in a fresh fight');
}

console.log(`\ncheck-spellphase-kaizo: ${count - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
