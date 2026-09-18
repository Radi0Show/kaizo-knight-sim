#!/usr/bin/env node
// THE ACT SWING WAITS FOR THE TURN, AND SPARE HAS A ROW.
//
// Both were reported from play on the shipped sim, and both were real.
//
// ── 1. "the party immediately does the act animation instead of waiting for
//       everyone elses actions"
//
// sim/menu.js called `heroAct(state, c, HERO_ACT)` at the ACT confirm, under a
// comment asserting that `state = 6` "plays NOW" and outlasts the menu. That
// comment cited nothing and the dump contradicts it:
//
//     if (global.myfight == 3 && global.faceaction[myself] == 6 && state != 8)
//         state = 6;
//     (obj_heroparent's Step_0:9-12)
//
// `state = 6` is gated on the FIGHT PHASE. `global.myfight = 3` is set by
// scr_endturn:79-81 — which runs once every character has committed, and sets
// `charturn = 3` (nobody is choosing) and `currentactingchar = 0` beside it.
// So acts play in their own phase AFTER the command phase closes.
//
// What the confirm legitimately sets is `faceaction`, the READY pose:
// obj_heroparent's `state == 0` branch picks actreadysprite off it. Ready at
// selection, swing at resolution — which is the split this codebase had
// already made for the act's EFFECTS ("SELECTION QUEUES, RESOLUTION COUNTS" in
// sim/menu.js). The animation was the one piece still landing early.
//
// ── 2. "sparing doesn't have a menu"
//
// SPARE fell through to `charaction = 0` — a bare pass that advanced the turn.
// The game makes it a two-press command like FIGHT:
//
//     if (global.bmenuno == 12) {
//         global.faceaction[global.charturn] = 10;
//         global.chartarget[global.charturn] = global.bmenucoord[12][global.charturn];
//         global.charaction[global.charturn] = 2;
//         global.charspecial[global.charturn] = 100;
//         scr_nexthero();
//     }
//
// render/menu.js has drawn that row all along — its comment says in as many
// words that the sim stage was missing. This asserts the stage.

import { createState } from '../sim/index.js';
import { createMenu, openMenu, stepMenu, BUTTONS, listRows } from '../sim/menu.js';
import { HERO_ACT, FACE_SPARE, FACE_IDLE } from '../sim/heroes.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}${extra ? `  (${extra})` : ''}`);
  if (!c) failed += 1;
};
const eq = (got, want, m) => ok(Object.is(got, want), m, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const NONE = {
  up: false, down: false, left: false, right: false, confirm: false, cancel: false,
};
/** One edge press, with enough released frames to clear the game's onebuffer. */
function tap(st, key) {
  stepMenu(st, { ...NONE, [key]: true });
  for (let i = 0; i < 3; i += 1) stepMenu(st, { ...NONE });
}
function fresh() {
  const st = createState({ seed: 1 });
  st.menu = createMenu();
  openMenu(st);
  return st;
}
const nameAt = (i) => {
  const n = BUTTONS[i].name;
  return typeof n === 'function' ? n({}, 0) : n;
};
const indexOfButton = (want) => BUTTONS.findIndex((_, i) => nameAt(i) === want);
/** Walk the button row to `want` with right-presses, then confirm. */
function pickButton(st, want) {
  const target = indexOfButton(want);
  for (let i = 0; i < BUTTONS.length && st.menu.selected[st.menu.charturn] !== target; i += 1) {
    tap(st, 'right');
  }
  eq(nameAt(st.menu.selected[st.menu.charturn]), want, `cursor reached ${want}`);
  tap(st, 'confirm');
}

console.log('\nA — SPARE opens a target row instead of passing the turn');
{
  const st = fresh();
  const c = st.menu.charturn;
  pickButton(st, 'SPARE');
  eq(st.menu.submenu, 'spare', 'A the SPARE button opens its row');
  eq(st.charaction[c], 0, 'A ...and commits NOTHING yet — the first press is not the command');
  // NOR THE POSE. This line used to demand faceaction 10 HERE, one stage
  // early, under a label that said in as many words that the confirm writes
  // it — and the dump agrees with the label: all four assignments sit
  // together inside `if (global.bmenuno == 12)`, the ROW's confirm, quoted in
  // this file's own header. A player found what that cost on the MAGIC menu:
  // "using rude buster but then cancelling makes the sprite of susie
  // preparing still show". SPARE had the same shape. See setFace's header in
  // sim/menu.js and the pose block in tools/verify-animation.mjs.
  eq(st.heroes[c].faceaction, FACE_IDLE,
    'A ...nor the pose — faceaction travels with the charaction, at the confirm');
}

console.log('\nB — the row\'s confirm is what commits the mercy attempt');
{
  const st = fresh();
  const c = st.menu.charturn;
  pickButton(st, 'SPARE');
  tap(st, 'confirm');
  eq(st.charaction[c], 2, 'B charaction 2 — the same value a spell commits');
  eq(st.charspecial[c], 100, 'B charspecial 100 — the marker that separates it from a spell');
  eq(st.heroes[c].faceaction, FACE_SPARE,
    'B ...and faceaction 10, the line directly above them in the dump');
  ok(st.menu.submenu !== 'spare', 'B ...and the row closed behind it');
}

console.log('\nC — cancelling the row commits nothing');
{
  const st = fresh();
  const c = st.menu.charturn;
  pickButton(st, 'SPARE');
  tap(st, 'cancel');
  ok(st.menu.submenu !== 'spare', 'C X closes the row');
  eq(st.charaction[c], 0, 'C ...and leaves charaction untouched');
  eq(st.charspecial[c], 0, 'C ...and charspecial untouched');
}

console.log('\nD — the ACT swing does NOT start at the confirm');
{
  const st = fresh();
  const c = st.menu.charturn;
  ok(listRows({ ...st, menu: { ...st.menu, submenu: 'actgrid' } }).length > 0,
    'D Kris has acts to choose (the grid is not empty)');
  pickButton(st, 'ACT');
  eq(st.menu.submenu, 'actpick', 'D ACT opens the enemy picker first');
  tap(st, 'confirm');
  eq(st.menu.submenu, 'actgrid', 'D ...and its confirm opens the 2x6 grid');
  tap(st, 'confirm');

  ok(!!st.pendingAct, 'D choosing an act QUEUES it');
  // THE ASSERTION THIS FILE EXISTS FOR.
  ok(st.heroes[c].state !== HERO_ACT,
    'D ...and the swing has NOT started — state 6 waits for myfight == 3',
    `hero state ${st.heroes[c].state}`);
}

console.log('\nE — but the swing does still happen, at the acting block');
{
  // WEAKER THAN D ON PURPOSE, AND HERE IS WHY. D drives the real menu, so it
  // is behavioural. The resolve half lives in the scene's endStep behind a
  // full turn's phase flow (the menu re-opens and returns before it), so
  // reaching it from a unit test means playing a turn out. Until that harness
  // exists, this asserts the call site survives — which is exactly the failure
  // mode D cannot see: deleting `heroAct` outright would satisfy "the swing
  // does not start early" perfectly.
  //
  // Comments are stripped first. A source scan that cannot tell code from a
  // note about code is a check that certifies its own prose, and this repo has
  // shipped that mistake more than once.
  const src = readFileSync(join(root, 'sim', 'scenes', 'practice.js'), 'utf8');
  const live = src
    .split(String.fromCharCode(10))
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join(String.fromCharCode(10));
  ok(/heroAct\(\s*state\s*,\s*a\.c\s*\?\?\s*0\s*,\s*HERO_ACT\s*\)/.test(live),
    'E practice.js starts the swing at the acting block (live code, not a comment)');
  ok(/a\.w = \{[^}]*\};[\s\S]{0,400}?heroAct\(/.test(live),
    'E ...inside the writer\'s birth, where the act\'s counts already land');

  const menuSrc = readFileSync(join(root, 'sim', 'menu.js'), 'utf8');
  const menuLive = menuSrc
    .split(String.fromCharCode(10))
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join(String.fromCharCode(10));
  ok(!/heroAct\(/.test(menuLive),
    'E ...and the command phase starts no pose at all');
}

console.log(`\nverify-actspare: ${failed === 0 ? 'all assertions passed' : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
