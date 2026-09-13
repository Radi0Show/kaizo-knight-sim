#!/usr/bin/env node
// THE EPILOGUE REACHES THE PAGE — ledger G-15, the driver half.
//
// `kaizo/scenes/kaizo-ending.js` is 2,007 lines and 82 exports, and until this
// lane landed **80 of them were imported by nothing but their own two checks**.
// The only production importers were `kaizo/scenes/kaizo-fight.js`
// (`ensureEnding`) and `kaizo/scenes/kaizo-practice.js` (`endingWatchEndcon`),
// while `web/kaizo.js` called `sim/victory-scene.js`'s `createVictoryScene` /
// `stepVictoryScene` UNCONDITIONALLY — so a Weird Route win played the A-Side
// KNIGHTING. Not a missing cutscene: the wrong one, with full confidence.
// That is this repo's signature defect (a value computed correctly and written
// where nothing reads it) at module scale.
//
// Two fixes, and this file is the positive assertion on both:
//
//   1. `web/kaizo-epilogue.js` — the driver-side scene (create / step / done,
//      the same contract `sim/victory-scene.js` already satisfies), and
//      `web/kaizo.js`'s win seam CHOOSING between it and the knighting.
//   2. `kaizoEndingRouteFor` (kaizo/scenes/kaizo-fight.js) — it keyed the
//      route off the VERSION LETTER while the mod's fork, and this module's
//      own `ptb02Con8`, key it off `global.flag[456]`. Two differently-sourced
//      answers to one question. It reads the flag now, and section A holds the
//      registry answer and the fork answer together for a BUILT SCENE, not
//      merely for the three version letters.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C).
//
// PROVENANCE of everything asserted about the mod itself:
//   gml_Object_obj_ch3_PTB02_Step_0.gml  607-619  the con-8 fork
//                                        1186     `con = 50.2`
//                                        1758     sb_con 99 at sb_timer 555
//   gml_Object_obj_knight_enemy_Create_0.gml 115  `k_sideb = global.flag[456]`
//
// WHAT THIS FILE DELIBERATELY DOES NOT CLAIM: that the epilogue LOOKS right.
// It runs, it sequences and it sounds. Nothing paints its visuals — the
// `spr_fx_hitback` clash pairs, the whiteall overlays, the afterimages, the
// shake, the depth juggling, the ouchie/SWOON writers and the
// `spr_ralsei_swoon` easter egg are recorded on `state.kaizo.ending.marks` /
// `.lerps` and read by nobody. Its 36 sprites are ALL packed now, so what is
// missing is the drawer, not the art — and `board_ocean`, the loop the scene
// parks on, has no file anywhere in this repo, so its music is silent.
// Section B asserts that web/kaizo.js SAYS SO at the call site, because a
// half-wired thing that reads as finished is worse than one that admits it.
//
//     node kaizo/tools/checks/check-ending-driver.mjs
//     node kaizo/tools/checks/check-ending-driver.mjs --sabotage
//
// `--sabotage` injects ONE real defect — `dialogue_frames` raised past any
// runnable budget, so `sb_con 3`'s `d_ex()` stall (Step_0:1478-1482) never
// releases and the epilogue can never reach `sb_con 99`. Sections C and E must
// go RED. A green `--sabotage` run would mean the walk is decorative.
// Exit 0 clean / 1 sabotaged.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createState } from '../../../sim/index.js';
import {
  buildKaizoScene, kaizoEndingRouteFor, kaizoSidebFor, KAIZO_VERSIONS,
} from '../../scenes/kaizo-fight.js';
import {
  ensureEnding, endingWatchEndcon, ptb02Con8, endingTerminal, visitedSbStates,
  FLAG_WEIRD_ROUTE, FLAG_KNIGHT_OUTCOME, FLAG_KNIGHT_VIOLENCED,
  CON_VICTORY, CON_VICTORY_SIDEB, CON_LOSS, SB_TERMINAL, ASIDE_RESUMES_AT_CON,
} from '../../scenes/kaizo-ending.js';
import {
  createKaizoEpilogue, stepKaizoEpilogue, kaizoEpilogueReport, epilogueCueName,
} from '../../../web/kaizo-epilogue.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
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

const IDLE = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

/** A built kaizo scene, optionally carried through the battle teardown. */
function fight(version, { won = true, seed = 12345 } = {}) {
  const st = createState({ seed, traceBulletSlots: 0 });
  buildKaizoScene(st, { version });
  // The REAL producer of flag[50], at the site kaizo-practice.js calls it:
  // `endcon == 2` is where sim/knight.js's stepEndCutscene lands.
  st.knight = { endcon: won ? 2 : 0, endtimer: 60 };
  endingWatchEndcon(st);
  return st;
}

/** The production factory, plus the injected defect when asked. */
function epilogueOf(st) {
  const ep = createKaizoEpilogue(st);
  if (SABOTAGE) ensureEnding(ep.st).dialogueFrames = 10 ** 7;
  return ep;
}

function runEpilogue(ep, frames = 4000) {
  const cues = [];
  for (let f = 0; f < frames; f++) {
    for (const c of stepKaizoEpilogue(ep, IDLE)) cues.push(c);
    if (ep.done) return { at: f, cues };
  }
  return { at: -1, cues };
}

// ═══ A: THE ROUTE IS THE FLAG'S ANSWER, NOT THE LETTER'S ═══════════════════
console.log('kaizoEndingRouteFor reads global.flag[456]');
{
  // The three letters still answer, because a driver picking a scene before it
  // has a state has only the letter — and lane 2's check-sideb-ending holds
  // these too. They are the WEAK half of the assertion; the built scenes below
  // are the strong half.
  assertEq(kaizoEndingRouteFor('D'), 'bside', 'A version D ends on the B-Side epilogue');
  assertEq(kaizoEndingRouteFor('C'), 'aside', 'A version C ends on the A-Side knighting');
  assertEq(kaizoEndingRouteFor('A'), 'aside', 'A the invented remix keeps the A-Side');
  assertEq(kaizoEndingRouteFor('nope'), 'aside', 'A an unregistered letter is not the B-Side');

  // ONE SOURCE for "is this build the Weird Route". Everything downstream —
  // state.kaizo.sideb, installRoster, ensureEnding's flag[456] mirror — hangs
  // off kaizoSidebFor, so the registry cannot drift from the fork.
  assertEq(kaizoSidebFor('D'), true, 'A kaizoSidebFor is the single source (D)');
  assertEq(kaizoSidebFor('C'), false, 'A ...and the A-Side control (C)');
}

// THE ASSERTION THE OLD IMPLEMENTATION COULD NOT MAKE: for a BUILT SCENE, the
// registry answer, the state answer and `ptb02Con8`'s own answer agree.
for (const version of Object.keys(KAIZO_VERSIONS)) {
  const st = fight(version);
  const byLetter = kaizoEndingRouteFor(version);
  const byState = kaizoEndingRouteFor(st);
  const byFork = ptb02Con8(st).route;
  assertEq(byState, byLetter, `A ${version}: the built scene agrees with the registry`);
  assertEq(byFork, byLetter, `A ${version}: **and the fork agrees with both** (${byFork})`);
  assertEq(st.kaizo.sideb, kaizoSidebFor(version),
    `A ${version}: state.kaizo.sideb came from kaizoSidebFor`);
  assertEq(st.kaizo.flag[FLAG_WEIRD_ROUTE], kaizoSidebFor(version) ? 1 : 0,
    `A ${version}: ...and ensureEnding mirrored it into flag[456]`);
}

// NON-VACUOUS, AND THIS IS THE DEFECT ITSELF. Move the FLAG on a built A-Side
// scene — the one input `obj_ch3_PTB02`'s con 8 actually reads — and the route
// must move with it. The version-keyed implementation returned 'aside' here
// while the fork said 'bside': one question, two answers, which is how the
// page came to play the wrong cutscene.
//
// `state.kaizo.sideb` is where this repo KEEPS flag[456] (`ensureEnding`
// re-mirrors it on every call — the mod never writes the flag, so the mirror
// is one-way by design). Moving it is therefore moving the fork's own input,
// and the version letter the scene was built as stays where it was.
{
  const st = fight('C');
  assertEq(kaizoEndingRouteFor(st), 'aside', 'A- a V-C build is the A-Side');
  st.kaizo.sideb = true;
  ensureEnding(st);
  assertEq(st.kaizo.flag[FLAG_WEIRD_ROUTE], 1, 'A- flag[456] follows state.kaizo.sideb');
  assertEq(kaizoEndingRouteFor(st), 'bside',
    'A- FLIPPING flag[456] FLIPS THE ROUTE — it is not keyed off the letter');
  assertEq(ptb02Con8(st).route, 'bside', 'A- ...and the fork moved with it');
  assertEq(kaizoEndingRouteFor('C'), 'aside',
    'A- ...while the letter C, unbuilt, still answers for the registry');
}
{
  const st = fight('D');
  assertEq(kaizoEndingRouteFor(st), 'bside', 'A- a V-D build is the B-Side');
  st.kaizo.sideb = false;
  ensureEnding(st);
  assertEq(st.kaizo.flag[FLAG_WEIRD_ROUTE], 0, 'A- flag[456] cleared with it');
  assertEq(kaizoEndingRouteFor(st), 'aside', 'A- clearing flag[456] clears the route too');
  assertEq(ptb02Con8(st).route, 'aside', 'A- ...and the fork agrees again');
}
// A LOSS IS THE FORK'S BUSINESS, NOT THIS FUNCTION'S: con 9 on both routes,
// and a driver must ask ptb02Con8 rather than assume. Stated as an assertion
// so the division of labour cannot rot into a bug.
{
  const st = fight('D', { won: false });
  assertEq(kaizoEndingRouteFor(st), 'bside', 'A- the route of a WIN is still the B-Side...');
  assertEq(ptb02Con8(st).con, CON_LOSS, 'A- ...but this run lost, and the fork says con 9');
  assertEq(ptb02Con8(st).route, 'loss', 'A- ...and reports the loss route');
}
// A state with no kaizo marker at all (the vanilla page's) is never the B-Side.
assertEq(kaizoEndingRouteFor(createState({ seed: 1, traceBulletSlots: 0 })), 'aside',
  'A- a state with no kaizo marker is the A-Side');

// ═══ B: THE PRODUCTION WIRE — web/kaizo.js ═════════════════════════════════
//
// web/kaizo.js cannot be imported outside a browser, so the wire is read as
// SOURCE. That is exactly why the scene itself lives in web/kaizo-epilogue.js:
// everything below this section runs the real code.
console.log('the win seam in web/kaizo.js');
{
  const src = readFileSync(join(repo, 'web', 'kaizo.js'), 'utf8');

  assert(/import\s*\{[^}]*\bkaizoEndingRouteFor\b[^}]*\}\s*from\s*'\.\.\/kaizo\/scenes\/kaizo-fight\.js'/s
    .test(src), 'B web/kaizo.js imports kaizoEndingRouteFor');
  assert(/import\s*\{[^}]*\bcreateKaizoEpilogue\b[^}]*\}\s*from\s*'\.\/kaizo-epilogue\.js'/s.test(src),
    'B ...and createKaizoEpilogue');
  assert(/\bstepKaizoEpilogue\s*\(/.test(src), 'B ...and STEPS it (an unstepped scene is the defect)');
  assert(/\bkaizoEpilogueReport\s*\(/.test(src), 'B ...and reads kaizoEpilogueReport');

  // THE FORK ITSELF. `createVictoryScene()` used to be unconditional; it must
  // now sit in the else of the route test, and the B-Side must be the if.
  const calls = src.match(/createVictoryScene\(\)/g) ?? [];
  assertEq(calls.length, 1, 'B createVictoryScene() is called in exactly one place');
  const seam = src.slice(src.indexOf('(state.endFade ?? 0) >= 1'));
  const head = seam.slice(0, 900);
  assert(/kaizoEndingRouteFor\(state\)\s*===\s*'bside'/.test(head),
    'B the win seam asks kaizoEndingRouteFor(state) — the fork\'s own input');
  assert(head.indexOf('createKaizoEpilogue(state)') > 0
    && head.indexOf('createKaizoEpilogue(state)') < head.indexOf('createVictoryScene()'),
    'B ...takes the epilogue on the B-Side and the knighting only in the else');

  // THE HONESTY REQUIREMENT, as an assertion. A half-wired cutscene that reads
  // as finished is how the next session ships a "fixed" ending that is blank.
  const preamble = src.slice(Math.max(0, src.indexOf('(state.endFade ?? 0) >= 1') - 2200),
    src.indexOf('(state.endFade ?? 0) >= 1'));
  assert(/nothing paints/i.test(preamble),
    'B the call site SAYS the epilogue\'s visuals are unpainted');
  assert(/kaizo-epilogue\.js/.test(preamble),
    'B ...and points at the file that lists what is missing');

  // Escape out of the epilogue must not leave a sim state stepping.
  const exit = src.slice(src.indexOf('function exitRun()'), src.indexOf('function exitRun()') + 700);
  assert(/epilogueSeq\s*=\s*null/.test(exit), 'B exitRun() drops the epilogue');
}
{
  const src = readFileSync(join(repo, 'web', 'kaizo-epilogue.js'), 'utf8');
  assert(/nothing paints/i.test(src), 'B kaizo-epilogue.js states the same caveat in its header');
  assert(/ONE MORE DEVIATION, on purpose/.test(src) && /never gives the room/.test(src),
    'B ...and labels the tool\'s one deviation (con 50.2 never resumes)');
}

// ═══ C: THE EPILOGUE RUNS, THROUGH THE PRODUCTION FACTORY ══════════════════
console.log('the B-Side epilogue, end to end, from a won V-D fight');
const D = (() => {
  const st = fight('D');
  const ep = epilogueOf(st);
  const { at, cues } = runEpilogue(ep);
  return { st, ep, at, cues };
})();
{
  const { st, ep, at } = D;
  assertEq(ep.route, 'bside', 'C the fork routed the win to the B-Side');
  assertEq(ep.con, CON_VICTORY_SIDEB, 'C con 49.1 (Step_0:616-619)');
  assertEq(ep.head, 'bside', 'C the con-50.1 head ran and set con = 50.2 (Step_0:1186)');
  assertEq(ensureEnding(ep.st).con, 50.2, 'C ...and con is 50.2');
  assert(at > 0, `C THE EPILOGUE REACHED ITS END on the page's own loop (frame ${at})`);
  assertJson(visitedSbStates(ep.st), [0, 1, 2, 3, 4, SB_TERMINAL],
    'C it visited every sb_con in order and parked at 99');
  assertJson(endingTerminal(ep.st), { terminal: true, resumedAtCon: null },
    'C **con is NEVER set to 10** — the story does not resume');

  // THE FLAG CROSSED THE SEAM. `endingWatchEndcon` has written flag[50] since
  // the epilogue landed and NOTHING READ IT; the fork reads it here.
  assertEq(st.kaizo.flag[FLAG_KNIGHT_OUTCOME], 1, 'C the fight latched flag[50] = 1');
  assertEq(st.kaizo.flag[FLAG_KNIGHT_VIOLENCED], 1, 'C ...and flag[51] = 1');
  assertEq(ep.st.kaizo.flag[FLAG_KNIGHT_OUTCOME], 1,
    'C ...and the epilogue\'s own state carries it (the fork\'s input)');
  assertEq(ep.st.kaizo.flag[FLAG_WEIRD_ROUTE], 1, 'C ...beside flag[456]');

  // The one-read surface a driver uses. An unread reporter is this repo's
  // signature defect with a nicer name.
  const rep = kaizoEpilogueReport(ep);
  assertEq(rep.done, true, 'C the report knows the scene ended');
  assertEq(rep.route, 'bside', 'C ...on the B-Side');
  assertEq(rep.sbCon, SB_TERMINAL, 'C ...parked at sb_con 99');
  assertEq(rep.resumedAtCon, null, 'C ...and that nothing resumed');
  assert(rep.t >= at, 'C ...and counted the frames the page stepped');
}

// ═══ D: THE EPILOGUE SOUNDS, EVEN THOUGH IT DOES NOT DRAW ══════════════════
console.log('the cues that actually reach the page');
{
  const { cues } = D;
  assert(cues.length > 0, 'D the epilogue put cues on the page\'s queue');
  const names = new Set(cues.map((c) => c.name));
  assert(names.has('wind_highplace'), 'D wind_highplace plays under the scene');
  assert(names.has('board_ocean'), 'D board_ocean plays at sb_con 99 (Step_0:1764)');
  // THE NAME FIX, and it is load-bearing: the sim carries the GML's own
  // `snd_init("board_ocean.ogg")` string and render/audio.js keys its manifest
  // on `board_ocean`. Unstripped, the epilogue plays in silence, invisibly.
  assert(!cues.some((c) => /\.ogg$/.test(c.name)),
    'D no cue reaches the driver with the manifest-invisible .ogg suffix');
  assertEq(epilogueCueName('board_ocean.ogg'), 'board_ocean', 'D epilogueCueName strips it');
  assertEq(epilogueCueName('snd_impact'), 'snd_impact', 'D ...and leaves a plain cue alone');
  const ocean = cues.filter((c) => c.name === 'board_ocean');
  assertEq(ocean.length, 1, 'D board_ocean is cued once');
  assertEq(!!ocean[0]?.loop, true, 'D ...as a LOOP, not a one-shot');
}

// ═══ E: THE CONTROL — AN A-SIDE WIN MUST NOT GET THIS SCENE ════════════════
//
// "The machine ran and nothing changed" and "the machine never ran" are the
// same observation without this.
console.log('the A-Side control');
{
  const st = fight('C');
  const ep = epilogueOf(st);
  assertEq(ep.route, 'aside', 'E a V-C win routes to the A-Side...');
  assertEq(ep.con, CON_VICTORY, 'E ...con 49, not 49.1');
  assertEq(ep.head, 'aside', 'E ...and the con-50 head hands the room back');
  const { at } = runEpilogue(ep, 2000);
  assertEq(at, -1, 'E it NEVER reaches a terminal state — there is no epilogue here');
  assertJson(endingTerminal(ep.st), { terminal: false, resumedAtCon: ASIDE_RESUMES_AT_CON },
    'E con = 10: the story resumes (Step_0:945) — which is what sim/victory-scene.js draws');
  assertJson(visitedSbStates(ep.st), [], 'E and no sb_con state was ever entered');
}
// A LOST fight handed to the factory enters nothing at all.
{
  const ep = epilogueOf(fight('D', { won: false }));
  assertEq(ep.route, 'loss', 'E- a loss routes to con 9');
  assertEq(ep.head, 'none', 'E- ...and no head runs');
  assertEq(runEpilogue(ep, 600).at, -1, 'E- ...so nothing ever terminates');
}

// ═══ F: DETERMINISM — the page's scene is a pure function of its inputs ════
{
  const walk = (seed) => {
    const ep = createKaizoEpilogue(fight('D', { seed }));
    const out = [];
    for (let f = 0; f < 4000; f++) {
      for (const c of stepKaizoEpilogue(ep, IDLE)) out.push(`${f}:${c.name}`);
      if (ep.done) break;
    }
    return `${ep.t}|${out.join(',')}`;
  };
  const a = walk(12345);
  assertEq(walk(12345), a, 'F the same seed replays byte-identically');
  assert(a.length > 32, 'F ...and the fingerprint is not empty');
}

console.log(`\ncheck-ending-driver: ${checks - failures}/${checks} assertions`
  + `${SABOTAGE ? ' (SABOTAGED — failures are the point)' : ''}`);
if (failures) {
  console.log(`check-ending-driver: ${failures} FAILING`);
  process.exit(1);
}
process.exit(0);
