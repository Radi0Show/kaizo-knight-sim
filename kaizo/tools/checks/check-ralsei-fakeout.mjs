#!/usr/bin/env node
// KAIZO — THE RALSEI FAKEOUT (ledger G-17 [4]).
//
// `if (kaizo_funchance(100))` at gml_Object_obj_ch3_PTB02_Step_0.gml:1084
// wraps the whole Ralsei-slash aftermath of the A-Side victory cutscene. One
// time in a hundred — or ALWAYS with the mod's Funni setting on — Ralsei
// stands there UNHURT in `spr_ralsei_shocked_right`, waits 90 frames, works
// through three lines of increasingly relieved disbelief, walks left to
// x 2280 over 25 frames, and then BLOCKS on `ralsei_fakeout == 2`. A new
// end-of-Step handler (:2487-2510) drives 1 -> 2, plays one more line, and at
// timer 21 destroys the dialoguer, the writer and the face MID-LINE — at
// which point he collapses after all.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C).
//
// **THERE IS NO RECORDING OF THIS.** Nothing in `knight-research/kaizo-mod`
// records a victory cutscene, let alone a 1-in-100 branch of one, so every
// expectation here is read off the dump and this file is the only thing
// standing over that reading. Every mechanism therefore gets a NON-VACUOUS
// CONTROL: the 99-in-100 arm is run beside it and must NOT do the thing.
//
// THE DRAW COST IS MEASURED, NOT TALLIED (2026-09-12). This file's only stream
// assertion used to be a DIFFERENCE — Funni on against Funni off — which is
// structurally blind to a draw added on BOTH arms. `gmlRng.draws` (sim/rng.js)
// is now read absolutely at the roll and across each whole arm; see
// `assertStream`.
//
// PROVENANCE:
//   gml_Object_obj_ch3_PTB02_Step_0.gml      1084-1118  the fakeout arm
//                                            1120-1133  the ordinary arm
//                                            2487-2510  the end-of-Step half
//   gml_Object_obj_ch3_PTB02_Create_0.gml    10         `ralsei_fakeout = false`
//   gml_GlobalScript_kaizo_settings_init.gml 22-25      `kaizo_funchance`
//
//     node kaizo/tools/checks/check-ralsei-fakeout.mjs
//     node kaizo/tools/checks/check-ralsei-fakeout.mjs --sabotage
//
// `--sabotage` pins `fakeout_timer` at 0 wherever the handler ticks, so it can
// never reach 21: the dialoguer/writer/face are never destroyed, the line is
// never cut off, `ralsei_fakeout` never becomes 2 and the blocked `c_wait_if`
// never releases. The suite must go RED. Exit 0 clean / 1 sabotaged.

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { gmlCreate } from '../../../sim/rng.js';
import {
  ensureEnding, endingDraws, endingReport,
  rollRalseiFakeout, stepRalseiFakeout,
  startEndingScript, endingScriptRunning, stepKaizoEnding,
  spawnEndingActors, spawnEndingKnight, kaizoEndingDriver,
  FAKEOUT_SCRIPT, NO_FAKEOUT_SCRIPT, FAKEOUT_CHANCE, FAKEOUT_LINE,
  FAKEOUT_CUT_AT, SPR,
} from '../../scenes/kaizo-ending.js';

const DUMP = join(homedir(), 'knight-research', 'kaizo-mod', 'gml_kaizo_dump', 'CodeEntries');
const SABOTAGE = process.argv.includes('--sabotage');

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

/**
 * ═══ THE STREAM ITSELF, NOT THE MODULE'S BOOKKEEPING ═══════════════════════
 *
 * `endingDraws()` is kaizo-ending.js's own hand-incremented tally. Until now
 * this file's ONLY stream assertion was a DIFFERENCE — Funni on against Funni
 * off, at section A- — which is structurally blind to a draw added on BOTH
 * arms: the two sides move together and the equality still holds. A review
 * proved the sibling check had the same hole by injecting a real extra
 * `gmlIrandomRange` and watching both checks stay exit 0.
 *
 * So the cost is measured absolutely, off `gmlRng.draws` — the monotonic u32
 * counter inside `gmlU32` (sim/rng.js), which counts every draw from every
 * site whether or not anyone tallied it. `gmlRng.idx` is the WELL512 RING
 * index and wraps mod 16 (a draw advances it by 15); it is carried as a
 * SECOND, independent witness, never as the primary.
 */
function rngMark(st) {
  return { draws: st.gmlRng.draws ?? 0, idx: st.gmlRng.idx };
}
function rngSpent(st, m0) {
  return (st.gmlRng.draws ?? 0) - m0.draws;
}
function assertStream(st, m0, want, label) {
  assertEq(rngSpent(st, m0), want, label);
  assertEq((st.gmlRng.idx - m0.idx) & 15, (15 * want) & 15,
    `${label} — ...and the WELL512 ring index agrees (mod 16)`);
  if (want > 0) {
    assertEq(typeof st.gmlRng.draws, 'number',
      `${label} — ...and the counter is a real number, not an absent field`);
  }
}

const IDLE = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

function mk({ seed = 12345, funni = false } = {}) {
  const st = createState({ seed, traceBulletSlots: 0 });
  st.gmlRng = gmlCreate(seed);
  // The A-Side. The fakeout is NOT B-Side-gated: its `if` is
  // `kaizo_funchance(100)` and nothing else (Step_0:1084).
  st.kaizo = { sideb: false, funni };
  ensureEnding(st);
  spawnEndingActors(st);
  spawnEndingKnight(st);
  spawn(st, kaizoEndingDriver, {});
  return st;
}

/**
 * SABOTAGE (`--sabotage`): one real defect, applied wherever the handler
 * ticks. `fakeout_timer` is pinned at 0, so it can never reach 21, the
 * dialoguer/writer/face are never destroyed, `ralsei_fakeout` never becomes 2
 * and the script's `c_wait_if` never releases — Ralsei stands there forever.
 * Sections B, C, D and G must go RED; a clean --sabotage run would mean the
 * handler assertions are decorative.
 */
function sab(st) {
  if (SABOTAGE) ensureEnding(st).fakeoutTimer = 0;
}

function run(st, frames, done = () => false) {
  for (let f = 0; f < frames; f++) {
    stepFrame(st, IDLE);
    sab(st);
    if (done(st)) return f;
  }
  return -1;
}

/**
 * Roll, load whichever arm won, and run it to the end — then keep stepping.
 *
 * The walk is an `obj_lerpvar`, a separate instance, and BOTH arms end their
 * beat list while it is still running (25 frames against the handler's 21 on
 * the fakeout arm, 30 frames against nothing at all on the other). So the
 * script finishing is not the scene finishing: `xAtEnd` is where he is the
 * frame he collapses, and the tail is what the tween does afterwards.
 */
function play(st) {
  // Mark the real stream before the roll, so the whole arm — roll, beat list,
  // handler and the 60-frame tail — can be measured rather than tallied.
  const rng0 = rngMark(st);
  const roll = rollRalseiFakeout(st);
  startEndingScript(st, roll.script);
  const at = run(st, 3000, (s) => !endingScriptRunning(s));
  const xAtEnd = ensureEnding(st).actors.ra.x;
  run(st, 60);
  return { roll, at, xAtEnd, rng0 };
}

// ═══ A: THE ROLL IS 1-IN-100 AND COSTS 2 u32 ON BOTH ARMS ══════════════════
console.log('kaizo_funchance(100)');
{
  assertEq(FAKEOUT_CHANCE, 100, 'A the gate is kaizo_funchance(100) (Step_0:1084)');
  // PINNED TO A LITERAL, for the reason section C cannot pin it: the handler
  // is DRIVEN by FAKEOUT_CUT_AT and section C's expectations are the same
  // constant, so a mutation moves both sides together. (The 21-vs-25 race in
  // section B catches a LENGTHENED cut and nothing else.)
  assertEq(FAKEOUT_CUT_AT, 21,
    'A the handler cuts the line at fakeout_timer 21 (Step_0:2487-2510)');
  const st = mk();
  assertJson(endingDraws(st), { clash: 0, epilogue: 0, fakeout: 0 }, 'A nothing spent yet');
  const rng0 = rngMark(st);
  const r = rollRalseiFakeout(st);
  assertEq(r.cost, 2, 'A irandom_range(1, 100) costs 2 u32 (sim/rng.js)');
  assertEq(endingDraws(st).fakeout, 2, 'A ...and the budget records it');
  // THE MEASUREMENT. `cost` and the bucket are both the module's arithmetic;
  // this is the generator's. One irandom_range, two real u32 off the stream —
  // a second draw smuggled into the roll fails here and nowhere else.
  assertStream(st, rng0, 2, 'A ...and the REAL stream moved by exactly 2, no more');
  assertEq(rngSpent(st, rng0), endingDraws(st).fakeout,
    'A ...so the tally is a measurement of the stream, not a restatement of itself');
  assertEq(r.n, 100, 'A ...against the 100 the call site passes');
  assertEq(typeof r.hit, 'boolean', 'A it answers yes or no');
}
// THE ODDS ARE THE ODDS. Reading the roll back would only restate the code; a
// hit RATE over many seeds is a positive assertion about `irandom_range(1,
// 100) <= 1` that a wrong bound (99, 101, `< 1`, `<= 2`) would fail.
{
  let hits = 0;
  const N = 4000;
  for (let seed = 1; seed <= N; seed++) {
    const st = mk({ seed });
    if (rollRalseiFakeout(st).hit) hits += 1;
  }
  assert(hits > 0, `A- it CAN hit (${hits} of ${N})`);
  assert(hits < N / 20, `A- ...and it is rare — well under 1 in 20 (${hits} of ${N})`);
  assert(hits > N / 400 && hits < N / 25,
    `A- ...and lands near 1 in 100 (${hits} of ${N}, expected ~${N / 100})`);
}
// THE STREAM DOES NOT FORK. `irandom_range(1, arg0)` is the LEFT operand of
// the `||`, so GameMaker's short-circuit cannot skip it: a Funni run and an
// ordinary run spend the SAME two draws and leave the stream in the same
// place. That is the difference between a budget that holds for every player
// and one that silently depends on a settings file.
{
  const a = mk({ funni: false });
  const b = mk({ funni: true });
  const ma = rngMark(a);
  const mb = rngMark(b);
  const ra = rollRalseiFakeout(a);
  const rb = rollRalseiFakeout(b);
  assertEq(endingDraws(a).fakeout, endingDraws(b).fakeout,
    'A- Funni on or off spends the same 2 u32');
  assertEq(a.gmlRng.idx, b.gmlRng.idx,
    'A- ...and leaves the stream in the SAME position (the || cannot short-circuit)');
  // A DIFFERENCE IS NOT A BUDGET. Both assertions above compare the two arms
  // against EACH OTHER, so a draw added to both moves them in lockstep and
  // neither notices. These two say what each arm actually cost.
  assertStream(a, ma, 2, 'A- Funni OFF really spends 2 u32 off the stream');
  assertStream(b, mb, 2, 'A- ...and Funni ON really spends 2 as well');
  assertEq(rb.hit, true, 'A- but Funni ON makes it a certainty');
  assertEq(rb.funni, true, 'A- ...and the roll says which half won');
  assertEq(ra.funni, false, 'A- while Funni OFF is the honest 1-in-100');
}

// ═══ B: THE FAKEOUT ARM — the whole beat list plays ════════════════════════
console.log('the fakeout');
const HIT = (() => {
  const st = mk({ funni: true });
  return { st, ...play(st) };
})();
{
  const { st, roll, at } = HIT;
  assertEq(roll.hit, true, 'B the fakeout arm was taken');
  assertJson(roll.script, FAKEOUT_SCRIPT, 'B ...and it loaded the fakeout script');
  assert(at > 0, `B the arm ran to completion (${at} frames)`);
  const e = ensureEnding(st);

  // THE THREE LINES, in order, verbatim from Step_0:1096/1099/1108.
  const said = e.msgs.map((m) => m.text);
  assert(said.includes('\\EZ* ^2.^2.^2.&* W-Wait./%'), 'B "…W-Wait."');
  assert(said.includes('\\EL* I\'m..^2. alright...?/%'), 'B "I\'m.. alright...?"');
  assert(said.includes('\\EZ* I guess I\'m fine.../%'), 'B "I guess I\'m fine..."');
  // ...and the FOURTH, which the handler adds and then cuts off.
  assert(said.includes(FAKEOUT_LINE), 'B and the handler\'s "L-Let\'s just try to help Susie now"');
  assertEq(said.length, 4, 'B exactly four lines');
  assert(e.msgs.every((m) => m.speaker === 'ralsei'), 'B all four are Ralsei\'s');

  // HE STANDS UNHURT FIRST. The arm opens on spr_ralsei_shocked_right, which
  // is the whole gag — the slash landed and he is fine.
  const firstSprite = FAKEOUT_SCRIPT.find((b) => b[0] === 'sprite');
  assertEq(firstSprite[2], SPR.ralseiShockedRight,
    'B he opens in spr_ralsei_shocked_right, not spr_ralsei_defeat');

  // HE WALKS TO 2280, then collapses ANYWAY — and the collapse BEATS THE
  // WALK. `c_var_lerp_to("x", 2280, 25)` is armed one beat before
  // `ralsei_fakeout = 1`, and the handler releases the block at timer 21, so
  // he is cut down four frames short of where he was heading. That falls out
  // of the two real clocks rather than being asserted into existence, which
  // is why it is worth pinning: collapse a 25-frame tween into a wait and it
  // silently stops being true.
  assert(HIT.xAtEnd > 2280,
    `B the 21-frame handler beats the 25-frame walk — he collapses at x ${Math.round(HIT.xAtEnd)}`);
  assert(HIT.xAtEnd < 2328, 'B ...but he did get most of the way there');
  assertEq(Math.round(e.actors.ra.x), 2280, 'B and the tween finishes after him (Step_0:1114)');
  assertEq(e.actors.ra.sprite, SPR.ralseiDefeat, 'B ...and ends in spr_ralsei_defeat after all');
  assertEq(e.swoons.length, 1, 'B the SWOON writer fires over him');
  assertEq(e.swoons[0].who, 'ra', 'B ...over Ralsei');
  assertEq(e.ralseiFakeout, 2, 'B ralsei_fakeout ended at 2');
}

// ═══ C: THE END-OF-STEP HANDLER — Step_0:2487-2510 ═════════════════════════
console.log('the ralsei_fakeout handler');
{
  const st = mk();
  const e = ensureEnding(st);
  // `variable_instance_exists(id, "fakeout_timer")` — the timer does NOT
  // exist until the handler creates it, and that is observable: it proves the
  // HANDLER made it and not the constructor.
  assertEq(e.fakeoutTimer, null, 'C fakeout_timer does not exist yet');
  assert(!stepRalseiFakeout(st), 'C the handler is inert while ralsei_fakeout is false');
  assertEq(e.fakeoutTimer, null, 'C ...and still has not created it');

  e.ralseiFakeout = 1;
  sab(st);
  assert(stepRalseiFakeout(st), 'C ralsei_fakeout = 1 starts the handler');
  assertEq(e.fakeoutTimer, 1, 'C the timer is created and ticks to 1');
  assertEq(e.msgs.length, 1, 'C timer 1 plays the line (Step_0:2497)');
  assertEq(e.msgs[0].text, FAKEOUT_LINE, 'C ...the right one');
  assert(e.dialogueOpen, 'C ...and the box is open');

  for (let i = 2; i < FAKEOUT_CUT_AT; i++) {
    sab(st);
    stepRalseiFakeout(st);
    assertEq(e.ralseiFakeout, 1, `C still 1 at timer ${i} (nothing early)`);
  }
  sab(st);
  stepRalseiFakeout(st);
  assertEq(e.fakeoutTimer, FAKEOUT_CUT_AT, 'C the timer reached 21');
  assertEq(e.ralseiFakeout, 2, 'C ralsei_fakeout 1 -> 2 at timer 21 exactly');
  assert(!e.dialogueOpen, 'C the box is gone');
  const destroyed = e.marks.filter((m) => Array.isArray(m.destroyed));
  assert(destroyed.length === 1, 'C one destroy event');
  assertJson(destroyed[0].destroyed, ['obj_dialoguer', 'obj_writer', 'obj_face'],
    'C MID-LINE: the dialoguer, the writer and the face all go (Step_0:2505-2507)');
  // The line was SPOKEN and then cut. Both halves matter: a translation that
  // never spoke it and a translation that let it finish look the same from
  // the outside if only the end state is asserted.
  assertEq(e.msgs.length, 1, 'C the line was spoken before it was cut');
  assert(!stepRalseiFakeout(st), 'C and the handler is inert once ralsei_fakeout is 2');
}

// ═══ D: THE BLOCK IS REAL — the script waits on the handler ════════════════
{
  const st = mk({ funni: true });
  const roll = rollRalseiFakeout(st);
  startEndingScript(st, roll.script);
  const e = ensureEnding(st);
  // Run until the script has armed ralsei_fakeout = 1 and is blocked.
  const at = run(st, 3000, (s) => s.kaizo.ending.ralseiFakeout === 1);
  assert(at > 0, 'D the script reaches `ralsei_fakeout = 1` and blocks');
  // FREEZE the handler by hand: without it, the wait can never release.
  e.ralseiFakeout = 1;
  const before = e.actors.ra.sprite;
  // Step the script alone — the handler is what unblocks it, so stepping the
  // script without ever letting the handler reach 21 must leave him standing.
  for (let i = 0; i < 400; i++) { e.fakeoutTimer = 1; stepKaizoEnding(st); sab(st); }
  assertEq(e.actors.ra.sprite, before,
    'D held at 1, he never collapses — the c_wait_if is a real block');
  assert(e.swoons.length === 0, 'D ...and no SWOON is written');
}

// ═══ E: THE 99-IN-100 ARM — the non-vacuous control ════════════════════════
console.log('the ordinary arm');
const MISS = (() => {
  // Find a seed that misses (almost all of them do).
  for (let seed = 1; seed < 200; seed++) {
    const st = mk({ seed });
    const r = play(st);
    if (!r.roll.hit) return { st, ...r };
  }
  return null;
})();
{
  assert(!!MISS, 'E a missing roll is easy to find (it is 99-in-100)');
  if (MISS) {
    const { st, roll, at } = MISS;
    assertJson(roll.script, NO_FAKEOUT_SCRIPT, 'E it loaded the ORDINARY script');
    const e = ensureEnding(st);
    assertEq(e.msgs.length, 0, 'E he says NOTHING — the three lines are fakeout-only');
    assertEq(e.ralseiFakeout, false,
      'E ralsei_fakeout is never armed, so the handler never runs');
    assertEq(e.fakeoutTimer, null, 'E ...and fakeout_timer is never created');
    assertEq(e.actors.ra.sprite, SPR.ralseiDefeat, 'E he is down from the first frame');
    assertEq(e.swoons.length, 1, 'E the SWOON writer still fires');
    assert(at > 0 && at < HIT.at, `E and it is much shorter (${at} vs ${HIT.at} frames)`);
  }
}
// BOTH ARMS END THE SAME WAY. That is what makes the fakeout a fakeout: the
// cutscene rejoins itself and the next beat (the knighting) does not care.
{
  if (MISS) {
    const a = ensureEnding(HIT.st);
    const b = ensureEnding(MISS.st);
    assertEq(a.actors.ra.sprite, b.actors.ra.sprite, 'E- both arms end in spr_ralsei_defeat');
    assertEq(Math.round(a.actors.ra.x), 2280, 'E- the fakeout arm settles at x 2280');
    assertEq(Math.round(b.actors.ra.x), 2280,
      'E- ...and so does the ordinary one (30 frames, ease "out")');
    assertEq(a.swoons.length, b.swoons.length, 'E- both write one SWOON');
    assertEq(a.bigShake, b.bigShake, 'E- both leave big_shake consumed');
    assertEq(endingDraws(HIT.st).fakeout, 2, 'E- the fakeout arm spent 2 u32');
    assertEq(endingDraws(MISS.st).fakeout, 2, 'E- ...and so did the ordinary one');
    // THE WHOLE ARM, MEASURED. `play()` marks the stream before the roll and
    // these cover everything after it — the beat list, the obj_lerpvar walk,
    // the end-of-Step handler and the 60-frame tail. NOTHING in the aftermath
    // is allowed to draw: the roll is the cutscene's entire RNG cost, on both
    // arms, and that is a claim about the mod rather than about the tally.
    assertStream(HIT.st, HIT.rng0, 2,
      'E- the fakeout arm moves the REAL stream by 2 and no more, start to finish');
    assertStream(MISS.st, MISS.rng0, 2,
      'E- ...and so does the ordinary one');
    for (const [name, r] of [['fakeout', HIT], ['ordinary', MISS]]) {
      const d = endingDraws(r.st);
      assertEq(rngSpent(r.st, r.rng0), d.clash + d.epilogue + d.fakeout,
        `E- the ${name} arm's tally equals the stream it actually moved`);
    }
  }
}

// ═══ F: THE SCRIPTS ARE THE DUMP'S, IN ORDER ═══════════════════════════════
{
  // The fakeout arm's sprite beats, in the order Step_0:1094-1112 plays them.
  const sprites = FAKEOUT_SCRIPT.filter((b) => b[0] === 'sprite').map((b) => b[2]);
  assertJson(sprites, [
    SPR.ralseiShockedRight,
    SPR.ralseiSurprisedRightWalk,
    SPR.ralseiShockedStandingRight,
    SPR.ralseiShockedStandingRight,
    SPR.ralseiSurprisedLeftWalk,
    SPR.ralseiDownSurprised2,
    SPR.ralseiWalkLeftUnhappy,
    SPR.ralseiDefeat,
  ], 'F the fakeout\'s eight sprite beats, in dump order');
  const waits = FAKEOUT_SCRIPT.filter((b) => b[0] === 'w').map((b) => b[1]);
  assertJson(waits, [90, 40, 20, 20, 24, 15], 'F ...and its six waits (90, 40, 20, 20, 24, 15)');
  const ow = NO_FAKEOUT_SCRIPT.filter((b) => b[0] === 'w').map((b) => b[1]);
  assertJson(ow, [90], 'F the ordinary arm waits once, for 90');
  assert(FAKEOUT_SCRIPT.some((b) => b[0] === 'waitFakeout'),
    'F only the fakeout arm carries the ralsei_fakeout == 2 block');
  assert(!NO_FAKEOUT_SCRIPT.some((b) => b[0] === 'waitFakeout'),
    'F ...and the ordinary one does not');
  // Both set him down at (2328, 190) first — Step_0:1088 and :1122.
  for (const [name, script] of [['fakeout', FAKEOUT_SCRIPT], ['ordinary', NO_FAKEOUT_SCRIPT]]) {
    const xy = script.find((b) => b[0] === 'setxy');
    assertJson([xy[2], xy[3]], [2328, 190], `F the ${name} arm places him at (2328, 190)`);
  }
}

// ═══ G: THE REPORT ═════════════════════════════════════════════════════════
{
  const r = endingReport(HIT.st);
  assertEq(r.fakeoutHit, true, 'G the report carries the roll');
  assertEq(r.ralseiFakeout, 2, 'G ...and the field\'s final value');
  assertEq(r.msgs, 4, 'G ...and the four lines');
  if (MISS) assertEq(endingReport(MISS.st).fakeoutHit, false, 'G ...and a miss reads false');
}

// ═══ H: THE DUMP SITES ARE REAL ════════════════════════════════════════════
{
  if (existsSync(DUMP)) {
    for (const f of [
      'gml_Object_obj_ch3_PTB02_Step_0.gml',
      'gml_Object_obj_ch3_PTB02_Create_0.gml',
      'gml_GlobalScript_kaizo_settings_init.gml',
    ]) {
      assert(existsSync(join(DUMP, f)), `H ${f} is a real file in the dump`);
    }
  } else {
    console.log('  --  (dump absent — the GML-file assertions are skipped)');
  }
}

console.log('');
if (SABOTAGE) {
  console.log('--sabotage: the handler\'s cut was pushed from timer 21 to 999, so the '
    + 'blocked c_wait_if can never release.');
  console.log(`check-ralsei-fakeout --sabotage: ${failures} assertion(s) caught it `
    + `(of ${checks}); a 0 here would mean the handler assertions are decorative.`);
  process.exit(failures > 0 ? 1 : 2);
}
console.log(`check-ralsei-fakeout: ${checks - failures}/${checks} assertions passed`);
if (failures) {
  console.log(`check-ralsei-fakeout: ${failures} FAILING`);
  process.exit(1);
}
