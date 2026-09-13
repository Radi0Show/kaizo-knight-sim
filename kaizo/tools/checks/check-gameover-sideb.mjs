#!/usr/bin/env node
// THE B-SIDE GAME OVER — where neither answer lets you leave.
//
//   node kaizo/tools/checks/check-gameover-sideb.mjs
//
// Ledger gap G-18, all four pieces, plus G-4 (the swoon sprite that was
// `sideb`-gated and should not be) because it is the other place the same
// misread nesting landed.
//
// ── WHY THIS CHECK IS SHAPED THE WAY IT IS ────────────────────────────────
//
// **THERE IS NO RECORDING OF THE WEIRD ROUTE.** Both whole-fight recordings
// are A-Side, three characters; the only B-Side ground truth on disk is two
// 2,400-frame locks of an animation and the roar finale. So every claim below
// rests on reading the mod's GML, and the DUMP IS THE ONLY THING STANDING
// OVER IT. Where an assertion is about what EnderCat8 wrote, it reads the
// dump and compares — it does not restate a string this repo also holds and
// call the agreement evidence. Where the dump is unavailable (a fresh clone
// with no ~/knight-research) those assertions SKIP LOUDLY rather than pass.
//
// Three assertion shapes, deliberately:
//
//   DUMP      the mod's own bytes. `assertDump` finds the literal in the
//             decompiled event and fails if it is not there.
//   BEHAVIOUR the screen actually stepped, through `makeGameOver` /
//             `stepGameOver`, to the frame a choice is answerable and then
//             answered. Not a field holding a value — a press producing an
//             outcome, which is the failure mode this repo keeps having.
//   SOURCE    `web/kaizo.js` cannot be imported headlessly (it builds a
//             renderer against the DOM on its first lines), so the driver's
//             half is asserted against its text. Weak evidence for behaviour,
//             strong evidence for ABSENCE — it cannot say the call works, but
//             it does say the call is still there.
//
// ── THE FOUR PIECES ───────────────────────────────────────────────────────
//
//   1. BOTH SLOTS READ PROCEED AND NEITHER EXITS. `Step_0:380-397` and
//      `:417-442`. The severity-4 half: reading the chosen INDEX instead of
//      its `knight_mode_con` would let a player leave a screen built to
//      refuse, by pressing right once.
//   2. THE REPLACED LINE. `Step_0:274-278` — one message of the shipped
//      first-loss chain. The other three replacements are third-loss and are
//      asserted against the dump but are NOT reachable in this build; see
//      SIDEB_THIRDLOSS_LINES.
//   3. UNCONDITIONAL ENTRY. The mod deleted vanilla's
//      `if (previous_times_attempted > 0)`. This build already showed the
//      screen every time for its own reason, so the assertion is that BOTH
//      rules are implemented and that the kaizo lane names the one it is
//      under — right by coincidence and right on purpose are the same pixels
//      and a different thing.
//   4. THE RESTORES. The deleted `scr_getchar` force-adds, as a value.
//
// ── AND THE ONE THAT WAS WRITTEN WHERE NOTHING READ IT ────────────────────
//
//   5. `state.kaizo.finalFailure` (`global.tempflag[75]`) — written by
//      `kaizo/attacks/roaring-final.js` since 2026-09-08, read by nobody
//      (the ledger's unwired table, row 13). It is `heart_marker.visible =
//      false` AND the absence of the soul's glide, and both are asserted on
//      the stepped screen.
//
// SABOTAGE-TESTED, both exit codes in the lane report.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import {
  makeGameOver, stepGameOver, KNIGHT_GAMEOVER_SCRIPT, GAMEOVER_ENTRY,
} from '../../../render/title.js';
import {
  kaizoGameOverOptions, gameOverOutcome, SIDEB_GAMEOVER_SCRIPT, SIDEB_CHOICES,
  SIDEB_FIRSTLOSS_LINE, SIDEB_THIRDLOSS_LINES, KAIZO_GAMEOVER_ENTRY,
  CON_RETRY, CON_MOVE_ON,
} from '../../../web/kaizo-gameover.js';
import { knightGameOverRestore, CHAR_SUSIE, CHAR_RALSEI } from '../../party/roster.js';
import { partyTabs } from '../../../sim/modes.js';
import { weirdRouteTabs } from '../../ui/proceed.js';
import { noelleSwoonSprite } from '../../party/noelle.js';
import { characterSpec, CHAR_NOELLE, CHAR_KRIS } from '../../party/roster.js';

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

/** The mod's own bytes, or a loud skip. */
function gml(root, entry) {
  const p = join(root, entry);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}
function assertDump(src, needle, label) {
  if (src === null) {
    skipped += 1;
    console.log(`  SKIP ${label} — no dump at ${DUMP}`);
    return;
  }
  assert(src.includes(needle), `DUMP: ${label}`);
}

const FAILURE_STEP = gml(DUMP, 'gml_Object_DEVICE_FAILURE_Step_0.gml');
const FAILURE_CREATE = gml(DUMP, 'gml_Object_DEVICE_FAILURE_Create_0.gml');
const V_FAILURE_CREATE = gml(VANILLA, 'gml_Object_DEVICE_FAILURE_Create_0.gml');
const V_FAILURE_STEP = gml(VANILLA, 'gml_Object_DEVICE_FAILURE_Step_0.gml');
const KNIGHT_STEP = gml(DUMP, 'gml_Object_obj_knight_enemy_Step_0.gml');

console.log('check-gameover-sideb: G-18 (the B-Side game over) and G-4');

/**
 * Step the screen to the frame the choice is answerable, then answer it.
 * The whole timeline, not a poke at `over.choiceT`: 150 frames of glide (or
 * none, with `glide: false`), every message typed out at its own rate with
 * its own pauses, the thirty-frame gaps, then the choice's twenty-frame
 * fade-in before a press counts.
 */
function runToChoice(over, cap = 4000) {
  let frames = 0;
  while (over.choiceT < 0 && frames < cap) {
    stepGameOver(over, { confirm: true });          // held = skip the typing
    stepGameOver(over, {});
    frames += 2;
  }
  for (let i = 0; i < 25; i++) stepGameOver(over, {});   // the fadebuffer
  return frames;
}
/** Move the cursor right `n` times and press. Returns stepGameOver's result. */
function answer(over, n) {
  stepGameOver(over, { right: true });                  // CURX -1 -> 0
  stepGameOver(over, {});
  for (let i = 0; i < n; i++) {
    stepGameOver(over, { right: true });
    stepGameOver(over, {});
  }
  return stepGameOver(over, { confirm: true });
}

// ══════════════════════════════════════════════════════════════════════════
// 1. BOTH SLOTS READ PROCEED, AND NEITHER ONE LEAVES
// ══════════════════════════════════════════════════════════════════════════
section('the choice: two PROCEEDs, both of them con 53');

assertDump(FAILURE_STEP,
  'NAME[0][0] = string_hash_to_newline(stringsetloc("PROCEED#(PROCEED)"',
  'slot 0 is PROCEED#(PROCEED)');
assertDump(FAILURE_STEP,
  'NAME[1][0] = string_hash_to_newline(stringsetloc("PROCEED#(PROCEED)"',
  'slot 1 is PROCEED#(PROCEED) TOO — the same string, not a second option');
assertDump(FAILURE_STEP, 'if (gaster_sideb)\n            {\n                knight_mode_con = 53;',
  '`global.choice == 1` routes to con 53 on the B-Side, not 55');
assertDump(V_FAILURE_STEP, 'knight_mode_con = 55;',
  'vanilla DOES have a con 55 arm — the delta is the mod REMOVING the way out');

assertEq(SIDEB_CHOICES.map((c) => c.name.join('#')),
  ['PROCEED#(PROCEED)', 'PROCEED#(PROCEED)'],
  'both options carry the same two rows, echo included');
assertEq(SIDEB_CHOICES.map((c) => c.con), [CON_RETRY, CON_RETRY],
  'and both carry con 53');
// The coordinates are the VANILLA block's, unchanged — only the words moved.
assertEq(SIDEB_CHOICES.map((c) => [c.x, c.y]),
  KNIGHT_GAMEOVER_SCRIPT.choices.map((c) => [c.x, c.y]),
  'NAMEX/NAMEY are untouched: the options sit where GO BACK and GO FORWARD sat');

section('BEHAVIOUR: neither answer produces a way out');
{
  for (const n of [0, 1]) {
    const over = makeGameOver(null, 100, 100, kaizoGameOverOptions({ sideb: true }));
    runToChoice(over);
    const r = answer(over, n);
    assert(r.chosen === n, `B-Side: option ${n} is answerable at all`);
    assertEq(r.con, CON_RETRY, `B-Side: option ${n} hands back con 53`);
    assertEq(gameOverOutcome(r.con), 'retry',
      `B-Side: option ${n} is a RETRY — pressing right does not let you leave`);
  }
}
section('BEHAVIOUR: and the A-Side still does, which is what makes it a delta');
{
  const outcomes = [];
  for (const n of [0, 1]) {
    const over = makeGameOver(null, 100, 100, kaizoGameOverOptions({ sideb: false }));
    runToChoice(over);
    outcomes.push(gameOverOutcome(answer(over, n).con));
  }
  assertEq(outcomes, ['retry', 'moveOn'],
    'A-Side: GO BACK retries and GO FORWARD leaves');
}
// THE ONE-SIDED ASSERTION THIS GUARDS AGAINST: "no B-Side option leaves" is
// also true of an empty list, a broken script or a `con` nobody set.
assert(SIDEB_GAMEOVER_SCRIPT.choices.length === 2,
  'the B-Side still offers TWO options — it is a choice that does not matter, '
  + 'not the absence of a choice');
assert(!SIDEB_GAMEOVER_SCRIPT.choices.some((c) => c.con === CON_MOVE_ON),
  'and con 55 appears on neither of them');

// ══════════════════════════════════════════════════════════════════════════
// 2. THE REPLACED LINE
// ══════════════════════════════════════════════════════════════════════════
section('the message: one replacement in the chain this build ships');

assertDump(FAILURE_STEP,
  '"\\\\M0 YOUR ADVERSARY^6& &IS STRONGER THAN&I EVER COULD HAVE&POSSIBLY IMAGINED./%"',
  'the B-Side first-loss line, verbatim');
assertDump(FAILURE_STEP,
  '"\\\\M0 YOUR LOSS HERE^6& &     IS ALL^6& & BUT GUARANTEED./%"',
  'and the A-Side line it lands on top of is still there');

assertEq(SIDEB_FIRSTLOSS_LINE,
  [' YOUR ADVERSARY', '', 'IS STRONGER THAN', 'I EVER COULD HAVE', 'POSSIBLY IMAGINED.'],
  'the rows are the string split on `&` with the hand padding kept');
assertEq(SIDEB_GAMEOVER_SCRIPT.lines[1], SIDEB_FIRSTLOSS_LINE,
  'and index 1 of the B-Side script is that line');
// EXACTLY ONE. The Weird Route changes what he thinks of your opponent, not
// what he thinks of you — so a second difference is a translation error.
{
  const diff = SIDEB_GAMEOVER_SCRIPT.lines
    .map((l, i) => (JSON.stringify(l) === JSON.stringify(KNIGHT_GAMEOVER_SCRIPT.lines[i]) ? null : i))
    .filter((i) => i !== null);
  assertEq(diff, [1], 'exactly ONE of the five messages differs from the A-Side');
}
// The `^6` key is an index into `rows.join('')`, which is what typedCount
// walks — 15, the length of " YOUR ADVERSARY".
assertEq(SIDEB_GAMEOVER_SCRIPT.pauses[1], { 15: 6 },
  'the forty-frame pause sits after " YOUR ADVERSARY"');
assert(SIDEB_FIRSTLOSS_LINE[0].length === 15,
  'and 15 IS that length — the key is derived, not guessed');

section('BEHAVIOUR: the screen types the B-Side line and not the A-Side one');
{
  const over = makeGameOver(null, 100, 100, kaizoGameOverOptions({ sideb: true }));
  // Advance to message 1 and let it finish.
  let guard = 0;
  while (over.line < 1 && guard < 2000) { stepGameOver(over, { confirm: true }); guard += 1; }
  assert(over.line === 1, 'the screen reaches message 1');
  assertEq(over.script.lines[over.line], SIDEB_FIRSTLOSS_LINE,
    'and the message it is on is the B-Side one');
}

section('the three third-loss replacements: recorded, and NOT reachable');
assertDump(FAILURE_STEP, '"\\\\M0 BEYOND ALL ODDS^6& & YOU WERE THERE./%"',
  'con 32 -> 33 replacement, verbatim');
assertDump(FAILURE_STEP, '"\\\\M0    THE END./%"',
  'con 33 -> 34 replacement, verbatim');
assertDump(FAILURE_STEP, '"\\\\M0YOU MUST PERSIST^6&A LITTLE LONGER./%"',
  'con 34 -> 50 replacement, verbatim');
assertEq(SIDEB_THIRDLOSS_LINES.map((l) => l.rows.join('&')),
  [' BEYOND ALL ODDS&& YOU WERE THERE.', '    THE END.', 'YOU MUST PERSIST&A LITTLE LONGER.'],
  'all three are carried with their rows');
// The honest half: they are NOT in the shipped script, and saying so here is
// what keeps a recorded-but-unreachable string from being mistaken for a
// landed one. Wiring them needs a loss counter AND the vanilla 20/30/40
// chains in render/title.js, neither of which exists — see the lane report.
{
  const shipped = JSON.stringify(SIDEB_GAMEOVER_SCRIPT.lines);
  assert(!SIDEB_THIRDLOSS_LINES.some((l) => shipped.includes(JSON.stringify(l.rows))),
    'and none of them is in the shipped first-loss chain — third-loss is unreachable here');
}

// ══════════════════════════════════════════════════════════════════════════
// 3. UNCONDITIONAL ENTRY — right on purpose, not by coincidence
// ══════════════════════════════════════════════════════════════════════════
section('entry: the mod deleted the guard, and this lane says so');

assertDump(V_FAILURE_CREATE, 'if (previous_times_attempted > 0)',
  'VANILLA guards the whole knight-mode setup on a previous attempt');
if (FAILURE_CREATE !== null) {
  assert(FAILURE_CREATE.includes('var previous_times_attempted = scr_get_knight_total_attempts();'),
    'DUMP: the mod still COMPUTES the local...');
  assert(!FAILURE_CREATE.includes('if (previous_times_attempted > 0)'),
    'DUMP: ...and never tests it — the `if` is gone, so a FIRST loss gets this screen');
} else { skipped += 2; console.log('  SKIP entry guard (no dump)'); }

assertEq(KAIZO_GAMEOVER_ENTRY, GAMEOVER_ENTRY.ALWAYS,
  'the kaizo lane declares ALWAYS');
assertEq(kaizoGameOverOptions({}).entry, GAMEOVER_ENTRY.ALWAYS,
  'and passes it on every game over, A-Side and B-Side alike');
// BOTH RULES ARE IMPLEMENTED. Without this the declaration above is a string
// nobody could have got wrong, and "we show it every time" stays an omission.
assert(makeGameOver(null, 0, 0, { entry: GAMEOVER_ENTRY.GUARDED, attempts: 0 }) === null,
  'the guard is real: GUARDED + attempt zero gets NO knight game over');
assert(makeGameOver(null, 0, 0, { entry: GAMEOVER_ENTRY.GUARDED, attempts: 1 }) !== null,
  'GUARDED + a previous attempt does');
assert(makeGameOver(null, 0, 0, { entry: GAMEOVER_ENTRY.ALWAYS, attempts: 0 }) !== null,
  'ALWAYS + attempt zero does — which is the mod, and is what this build runs');

// ══════════════════════════════════════════════════════════════════════════
// 4. THE RESTORES
// ══════════════════════════════════════════════════════════════════════════
section('the arms: no force-adds, on either answer');

assertDump(V_FAILURE_STEP, 'if (!scr_havechar(2))',
  'VANILLA force-adds Susie at the game over');
assertDump(V_FAILURE_STEP, 'if (!scr_havechar(3))',
  'VANILLA force-adds Ralsei too');
if (FAILURE_STEP !== null) {
  assert(!FAILURE_STEP.includes('scr_getchar(2)') && !FAILURE_STEP.includes('scr_getchar(3)'),
    'DUMP: the mod deletes both, from BOTH arms');
  assert(FAILURE_STEP.includes('for (var i = 0; i <= 4; i++)'),
    'DUMP: and widens the retry heal to i <= 4 — Noelle');
  assert(FAILURE_STEP.includes('global.hp[4] = 1;'),
    'DUMP: and appends hp[4] = 1 to the move-on arm');
} else { skipped += 3; console.log('  SKIP restores (no dump)'); }

assertEq(knightGameOverRestore(CON_RETRY).arm, 'retry', 'con 53 is the retry arm');
assertEq(knightGameOverRestore(CON_MOVE_ON).arm, 'moveOn', 'con 55 is the move-on arm');
assertEq(knightGameOverRestore(CON_RETRY).getchar, [], 'retry adds nobody');
assertEq(knightGameOverRestore(CON_MOVE_ON).getchar, [], 'move on adds nobody');
// AND THE LOOP IS NOT VACUOUS. An empty list is also what a function that
// forgot to return one gives you, so the vanilla route is asked for the pair
// the driver's loop WOULD add.
assertEq(knightGameOverRestore(CON_RETRY, { route: 'vanilla' }).getchar,
  [CHAR_SUSIE, CHAR_RALSEI],
  'the vanilla route returns Susie and Ralsei — the deletion is a value, not a blank');

// AND THE LOOP THAT WALKS IT IS CORRECT WHEN THE LIST IS NOT EMPTY. The
// driver's body is reproduced here against the same two functions it calls,
// because a loop that only ever runs zero times can be wrong in a way nothing
// observes — looking Susie up in the WEIRD ROUTE's tabs, for instance, gives
// `undefined` and would push it. Both directions:
{
  const addTo = (party, list) => {
    for (const charId of list) {
      if (party.some((t) => (t.charId ?? t.char + 1) === charId)) continue;
      const tab = partyTabs(null).find((t) => (t.charId ?? t.char + 1) === charId);
      if (tab) party.push(tab);
    }
    return party.map((t) => t.name);
  };
  assertEq(addTo(weirdRouteTabs(), knightGameOverRestore(CON_RETRY).getchar),
    ['KRIS', 'NOELLE'],
    'the mod\'s empty list leaves a Weird Route party as Kris and Noelle');
  assertEq(addTo(weirdRouteTabs(), knightGameOverRestore(CON_RETRY, { route: 'vanilla' }).getchar),
    ['KRIS', 'NOELLE', 'SUSIE', 'RALSEI'],
    'and vanilla\'s would have handed it two characters the route does not have — '
    + 'four real tabs, so the lookup resolves and the loop is proven, not merely unrun');
}

// ══════════════════════════════════════════════════════════════════════════
// 5. tempflag[75] — the value that was written where nothing read it
// ══════════════════════════════════════════════════════════════════════════
section('the Roaring DELTA\'s scripted death: no soul, and no glide');

assertDump(gml(DUMP, 'gml_Object_obj_knight_roaring2_Other_11.gml'),
  'global.tempflag[75] = 1;',
  'the finale raises tempflag[75] and room_gotos PLACE_FAILURE');
assertDump(FAILURE_CREATE, 'heart_marker.visible = false;',
  'and DEVICE_FAILURE\'s Create hides the marker when it reads it back');
assertDump(FAILURE_CREATE, 'knight_alt = 1;',
  'via knight_alt, which does nothing else anywhere in the dump');

{
  const off = kaizoGameOverOptions({ finalFailure: false });
  const on = kaizoGameOverOptions({ finalFailure: true });
  assertEq([off.marker, off.glide], [true, true], 'an ordinary wipe keeps both');
  assertEq([on.marker, on.glide], [false, false],
    'the scripted death has neither — heart_marker.visible = false, and no '
    + 'obj_gameover_init ran to glide a soul');
  const over = makeGameOver(null, 100, 100, on);
  assertEq(over.marker, false, 'the screen holds marker false');
  assertEq(over.t, 150,
    'and STARTS at PLACE_FAILURE (t 150) — a room_goto, not a scr_gameover');
  // BEHAVIOUR: it is already talking on frame one, where an ordinary wipe is
  // still showing the frozen screenshot.
  const ordinary = makeGameOver(null, 100, 100, off);
  stepGameOver(ordinary, {});
  stepGameOver(over, {});
  assert(ordinary.t < 150 && over.t > 150,
    'one frame in, the scripted death is past the glide and the wipe is not');
}

// ══════════════════════════════════════════════════════════════════════════
// 6. G-4 — the swoon sprite that was `sideb`-gated and should not be
// ══════════════════════════════════════════════════════════════════════════
section('G-4: Noelle swoons the same way on both routes');

// THE NESTING IS THE WHOLE FINDING. `if (k_sideb)` opens at :65 and closes at
// :84; Kris's and Noelle's `with`es are at :85 and :89, one line below it.
if (KNIGHT_STEP !== null) {
  const lines = KNIGHT_STEP.split(/\r?\n/);
  const noelle = lines.findIndex((l) => l.includes('defeatsprite = spr_noelleb_swooned;'));
  const kris = lines.findIndex((l) => l.includes('defeatsprite = spr_kris_fell;'));
  // THE LAST `if (k_sideb)` ABOVE THE SITE, not the first in the event. This
  // Step has five of them (:42, :65, :593, :635, :649) and :42 is the ACT
  // table's, which closes at :53 — taking that one would make "Noelle is
  // outside it" true of a block she was never near, and the assertion would
  // pass while proving nothing. The one that matters is :65, Susie's repaint,
  // the block the ledger's correction is about.
  let open = -1;
  for (let i = 0; i < noelle; i++) if (lines[i].trim() === 'if (k_sideb)') open = i;
  assert(open >= 0 && noelle > open, 'DUMP: both sites found');
  assert(lines.slice(open, noelle).some((l) => l.includes('spr_susieb_idle_serious')),
    'DUMP: and the block found is SUSIE\'S repaint — the one the finding is about');
  // Walk the braces from the `if (k_sideb)` and find where its block ends.
  let depth = 0;
  let close = -1;
  for (let i = open + 1; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth += 1;
      else if (ch === '}') { depth -= 1; if (depth === 0) close = i; }
    }
    if (close >= 0) break;
  }
  assert(close > open, 'DUMP: the k_sideb block closes');
  assert(noelle > close,
    `DUMP: Noelle's defeatsprite (line ${noelle + 1}) is OUTSIDE the k_sideb `
    + `block (closes line ${close + 1}) — both routes`);
  assert(kris > close,
    `DUMP: and so is Kris's (line ${kris + 1}) — which roster.js already had un-gated`);
} else { skipped += 5; console.log("  SKIP G-4 nesting (no dump)"); }

assertEq(noelleSwoonSprite(false), 'spr_noelleb_swooned',
  'an A-SIDE downed Noelle draws spr_noelleb_swooned');
assertEq(noelleSwoonSprite(true), 'spr_noelleb_swooned', 'and so does a B-Side one');
assertEq(characterSpec(CHAR_NOELLE, { sideb: false }).spec.defeat, 'spr_noelleb_swooned',
  'and it reaches spec.defeat, which is what the animator draws');
assertEq(characterSpec(CHAR_NOELLE, { sideb: true }).spec.defeat, 'spr_noelleb_swooned',
  'on both routes');
assertEq(characterSpec(CHAR_KRIS, { sideb: false }).spec.defeat, 'spr_kris_fell',
  'Kris is un-gated the same way — the two now agree');
// The reverse divergence, named: the vanilla sprite must NOT come back.
assert(characterSpec(CHAR_NOELLE, { sideb: false }).spec.defeat !== 'spr_noelleb_defeat',
  'spr_noelleb_defeat is gone from the kaizo lane entirely');

// ══════════════════════════════════════════════════════════════════════════
// 7. THE DRIVER ACTUALLY CALLS ALL OF IT
// ══════════════════════════════════════════════════════════════════════════
section('web/kaizo.js: the wires, asserted against its source');
{
  const src = readFileSync(join(REPO, 'web', 'kaizo.js'), 'utf8');
  const wires = [
    ["import { kaizoGameOverOptions, gameOverOutcome } from './kaizo-gameover.js';",
      'the B-Side script module is imported'],
    ['const outcome = gameOverOutcome(r.con);',
      'the outcome comes off `con` — NOT off `r.chosen`, which is the bug'],
    ['for (const charId of knightGameOverRestore(r.con).getchar) {',
      'the restore\'s force-add list is WALKED, so the deletion is a value'],
    ['kaizoGameOverOptions({',
      'and makeGameOver is given the kaizo options'],
    ['sideb: !!state.kaizo?.sideb,',
      'gated on the SCENE\'s flag[456], not on the driver\'s weirdRoute — '
      + '`?v=D` does not set that one'],
    ['finalFailure: !!state.kaizo?.finalFailure,',
      'and tempflag[75] reaches the screen'],
    ['if (state.gameOver || state.kaizo?.finalFailure) {',
      'the scripted death enters the game over at all'],
    ['if (!scripted) audio.play([{ name: \'snd_hurt1\', pitch: 1, gain: 1 }]);',
      'and takes no snd_hurt1 with it — that cue is scr_gameover\'s, and the '
      + 'scripted death never calls it'],
  ];
  for (const [needle, why] of wires) assert(src.includes(needle), `driver: ${why}`);
  // THE OLD ROUTING MUST BE GONE, not merely joined by the new one.
  assert(!/if \(r\.chosen === 0\) \{/.test(src),
    'driver: the index-based routing is gone, not shadowed');
}

console.log(`\ncheck-gameover-sideb: ${count - failures} passed, ${failures} failed`
  + (skipped ? `, ${skipped} skipped (no dump)` : ''));
process.exit(failures ? 1 : 0);
