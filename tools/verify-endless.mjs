#!/usr/bin/env node
// ENDLESS, PER PHASE — the stage list, and what locking to a phase does to the
// fight's schedule.
//
// No oracle, and there cannot be one: the real fight has no endless mode. What
// IS ground truth here is `sim/scenes/fight.js`'s FIGHT_TABLE, read out of
// `obj_knight_enemy`'s Other_10 selector, and every expectation below is taken
// from that table rather than typed out a second time. A suite that repeated
// the attack order by hand would pass while the fight ran something else.
//
// THE SHAPE IS BAD TIME SIMULATOR'S. Its `Globals.xml` carries `EndlessStage`
// beside `SimulatorMode`; `MainMenu.xml` builds the rows with a loop whose
// index IS the value (`"Phase " & (loopindex + 1)`, then
// `EndlessStage = MenuStack.At(MenuStack.Width-2)`), and `Battle.xml` reads it
// back on entry. **BTS's value is ZERO-BASED — its 0 is "Phase 1", not a whole
// fight** (the literal 0/1 writes elsewhere in MainMenu.xml are the
// `?mode=endless1` / `?mode=endless2` deep links, the same two rows by URL).
// The whole-fight row is this project's own, asked for by name, and it is row
// 0 because it is what ENDLESS already did.
//
// WHAT THIS PINS, and why each one is here rather than assumed:
//
//   1. THE ROW INDEX IS THE PHASE NUMBER. web/kaizo.js resolves the stage
//      WITHOUT importing the table — its `sim/` is vendored and an import of
//      something a stale copy lacks would take the whole page down — so it
//      passes the cursor index through as the phase. That is only correct
//      while the identity holds, and nothing else would notice if a row were
//      inserted at the top.
//   2. THE MENU OPENS AND BACKS OUT. `stepTitle`'s `pressed()` LATCHES, so a
//      second `pressed('cancel')` in the same frame silently eats the press —
//      the bug that cost issue #6 on the SINGLE roster, and a new sub-stage is
//      the obvious place to reintroduce it.
//   3. A LOCKED PHASE ACTUALLY REPEATS, in the selector's own order, wrapping
//      to its first turn. Positive: the turns are collected from a real run of
//      the real scene, not from a flag.
//   4. **THE NORMAL PATH DOES NOT MOVE.** `sim/scenes/practice.js` is the
//      scene the whole-fight byte gate replays (tools/fullfight-trace.mjs
//      imports `buildPracticeScene`), so a stage number sitting on a
//      NORMAL-mode state must change NOTHING — not the outcome, the TRACE,
//      byte for byte, because a single extra RNG draw moves every bullet after
//      it. This is the assertion that fails if `endlessLock` ever stops
//      testing `runMode`.

import {
  createTitle, stepTitle, MODES, ENDLESS_STAGES, endlessPhase,
} from '../sim/modes.js';
import { createState, stepFrame, traceRow } from '../sim/index.js';
import { buildPracticeScene, endlessLock } from '../sim/scenes/practice.js';
import { FIGHT_TABLE } from '../sim/scenes/fight.js';
import { freshParty } from '../sim/damage.js';

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const ROSTER = [
  { id: 'stars', name: 'Stars', difficulties: [0, 1, 2] },
  { id: 'flurry', name: 'Flurry', difficulties: [0, 1, 3] },
];
const NONE = {
  up: false, down: false, left: false, right: false, confirm: false, cancel: false,
};
/** One EDGE press — the menu is edge-triggered, so it needs a released frame. */
function tap(t, key) {
  const r = stepTitle(t, { ...NONE, [key]: true }, ROSTER);
  stepTitle(t, { ...NONE }, ROSTER);
  return r;
}
/** A title parked on a mode row, by id — rows move, ids do not. */
function atMode(id) {
  const t = createTitle();
  const want = MODES.findIndex((m) => m.id === id);
  for (let i = 0; i < want; i++) tap(t, 'down');
  return t;
}

// ---- 1. the table, and the identity kaizo.js leans on ----------------------

check(ENDLESS_STAGES.length >= 5,
  `ENDLESS_STAGES has ${ENDLESS_STAGES.length} rows; the four phases plus the loop need 5`);
check(ENDLESS_STAGES[0]?.phase === 0,
  'row 0 must be the WHOLE FIGHT (phase 0 = do not lock) — it is what ENDLESS did before');
for (let i = 0; i < ENDLESS_STAGES.length; i++) {
  // THE LINE THIS PROTECTS is in kaizo-knight-sim/web/kaizo.js:
  //     state.endlessStage = runMode === 'endless' ? (title.stageIndex | 0) : 0;
  // Reorder the table and that page practises the wrong phase, silently.
  check(ENDLESS_STAGES[i].phase === i,
    `ENDLESS_STAGES[${i}] carries phase ${ENDLESS_STAGES[i].phase}, not ${i} — `
    + 'the row index IS the phase number, and kaizo.js resolves the stage that way');
  check(typeof ENDLESS_STAGES[i].name === 'string' && ENDLESS_STAGES[i].name.length > 0,
    `ENDLESS_STAGES[${i}] has no name to draw`);
}
for (let p = 1; p <= 4; p++) {
  check(ENDLESS_STAGES.some((s) => s.phase === p),
    `no stage row offers phase ${p}, which FIGHT_TABLE has`);
}
// Every phase a row offers must be a phase the fight actually has, or the
// director indexes FIGHT_TABLE with undefined.
for (const s of ENDLESS_STAGES) {
  check(s.phase === 0 || !!FIGHT_TABLE[s.phase],
    `stage "${s.id}" names phase ${s.phase}, which FIGHT_TABLE does not have`);
}

// `endlessPhase` is the ONE reader of the table, so garbage must land on the
// whole fight rather than on `undefined` reaching FIGHT_TABLE.
check(endlessPhase(0) === 0, 'endlessPhase(0) is not the whole fight');
check(endlessPhase(4) === 4, 'endlessPhase(4) is not phase 4');
check(endlessPhase(99) === 0, 'endlessPhase past the end must fall back to the whole fight');
check(endlessPhase(-1) === 0, 'endlessPhase(-1) must fall back to the whole fight');
check(endlessPhase(undefined) === 0, 'endlessPhase(undefined) must fall back to the whole fight');

// ---- 2. endlessLock — the sim's gate ---------------------------------------

check(endlessLock({ runMode: 'endless', endlessStage: 3 }) === 3,
  'endlessLock did not return the locked phase');
check(endlessLock({ runMode: 'endless', endlessStage: 0 }) === 0,
  'stage 0 must be the whole fight, not a lock');
check(endlessLock({ runMode: 'endless', endlessStage: 7 }) === 0,
  'a phase the fight does not have must not lock');
check(endlessLock({ runMode: 'endless' }) === 0,
  'a missing stage must not lock');
for (const m of ['normal', 'hitless', 'single', undefined]) {
  check(endlessLock({ runMode: m, endlessStage: 3 }) === 0,
    `endlessLock locked a ${m ?? 'mode-less'} run — every branch must be ENDLESS-only`);
}
check(endlessLock(undefined) === 0, 'endlessLock threw or locked on a missing state');

// ---- 3. the menu -----------------------------------------------------------

{
  const t = atMode('endless');
  check(t.pickingStage === false, 'the stage list was open before ENDLESS was confirmed');
  const r = tap(t, 'confirm');
  check(t.pickingStage === true, 'confirming ENDLESS did not open the stage list');
  check(r.chosen !== true, 'confirming ENDLESS started a run instead of opening its list');
  check(t.mode === null, 'confirming ENDLESS picked a mode before a stage was chosen');

  // The cursor walks THIS list now, not the mode list.
  const before = t.index;
  tap(t, 'down');
  check(t.stageIndex === 1, `down on the stage list moved to ${t.stageIndex}, not 1`);
  check(t.index === before, 'the stage list moved the MODE cursor underneath it');
  tap(t, 'up');
  check(t.stageIndex === 0, 'up did not come back to the first stage');
  // …and it wraps, like every other list on this screen.
  tap(t, 'up');
  check(t.stageIndex === ENDLESS_STAGES.length - 1,
    `up off the top landed on ${t.stageIndex}, not the last row`);
}
{
  // X BACKS OUT TO THE MODE LIST AND STARTS NOTHING. One `pressed('cancel')`
  // read per frame is what makes this work; see the header.
  const t = atMode('endless');
  tap(t, 'confirm');
  tap(t, 'down');
  const r = tap(t, 'cancel');
  check(t.pickingStage === false, 'X did not leave the stage list');
  check(t.mode === null, 'X started a run');
  check(r.moved === true, 'X out of the stage list reported no movement (no sound)');
  check(t.stageIndex === 1, 'X forgot the row the player was on');
}
{
  // CONFIRMING A STAGE IS WHAT STARTS THE RUN.
  const t = atMode('endless');
  tap(t, 'confirm');
  tap(t, 'down');
  tap(t, 'down');
  const r = tap(t, 'confirm');
  check(r.chosen === true, 'confirming a stage did not start the run');
  check(t.mode === 'endless', `the run started in mode "${t.mode}", not endless`);
  check(endlessPhase(t.stageIndex) === 2, 'the third row did not resolve to phase 2');
}
{
  // NOTHING ELSE GREW A STAGE LIST. NORMAL and HITLESS still start on one
  // press, and SINGLE still opens its own roster.
  for (const id of ['normal', 'hitless']) {
    const t = atMode(id);
    const r = tap(t, 'confirm');
    check(r.chosen === true, `${id.toUpperCase()} no longer starts on one press`);
    check(t.pickingStage === false, `${id.toUpperCase()} opened the stage list`);
  }
  const t = atMode('single');
  tap(t, 'confirm');
  check(t.pickingAttack === true, 'SINGLE no longer opens its roster');
  check(t.pickingStage === false, 'SINGLE opened the stage list');
}

// ---- 4. a locked phase repeats, in the selector's order --------------------

const MAX_FRAMES = 14000;
const idle = { left: false, right: false, up: false, down: false, focus: false };

/**
 * Walk the real scene and return the turn labels it visits, in order.
 *
 * KEPT ALIVE, the way verify-fight-order is: an idle party dies inside phase 1
 * and a survival question must not decide a turn-order question. The menu is
 * driven with a PULSED confirm because it is edge-triggered — a held key must
 * not blow through three characters in three frames.
 */
function walkTurns(runMode, endlessStage, wanted) {
  const state = createState({ seed: 12345, traceBulletSlots: 0 });
  // BEFORE the build: `buildPracticeScene` spawns the director, and the
  // director reads the mode and the stage in its own Create. This is the order
  // web/main.js's reset() has for exactly that reason.
  state.runMode = runMode;
  state.endlessStage = endlessStage;
  buildPracticeScene(state, { seed: 12345 });

  let pulse = false;
  const visited = [];
  let last = null;
  for (let f = 0; f < MAX_FRAMES && visited.length < wanted; f++) {
    let input = idle;
    if (state.menu?.open || state.dialogue?.text || state.pendingAct) {
      pulse = !pulse;
      input = { ...idle, confirm: pulse };
    }
    stepFrame(state, input);
    state.partyHp = freshParty();
    state.gameOver = false;
    if (state.phase !== last) {
      visited.push(state.phase);
      last = state.phase;
    }
  }
  return visited;
}

for (let phase = 1; phase <= 4; phase++) {
  const table = FIGHT_TABLE[phase];
  // ONE FULL PASS PLUS THE WRAP — the (n+1)th turn is the whole point of the
  // mode, and collecting no further keeps the ENDLESS HP wrap (phase 4 only,
  // after ROARING) out of a turn-ORDER assertion.
  const want = table.length + 1;
  const visited = walkTurns('endless', phase, want);
  if (visited.length < want) {
    failures.push(
      `phase ${phase} locked: only ${visited.length} of ${want} turns ran in ${MAX_FRAMES} frames`
      + ` (last: ${visited[visited.length - 1] ?? 'none'})`,
    );
    continue;
  }
  for (let i = 0; i < want; i++) {
    const row = table[i % table.length];
    const got = visited[i];
    const okPhase = got.startsWith(`phase ${phase} ·`);
    const okName = got.endsWith(row.name);
    if (!okPhase || !okName) {
      failures.push(
        `phase ${phase} locked, turn ${i + 1}: expected phase ${phase} … ${row.name}, got "${got}"`,
      );
      break;
    }
  }
}

// ---- 5. the whole-fight row still walks the whole fight --------------------

{
  // Stage 0 must behave exactly as ENDLESS always did: phase 1's five turns,
  // then phase 2's. If the lock leaked into it, turn 6 would be phase 1 again.
  const want = FIGHT_TABLE[1].length + 2;
  const visited = walkTurns('endless', 0, want);
  check(visited.length === want,
    `whole-fight endless: only ${visited.length} of ${want} turns ran`);
  if (visited.length === want) {
    check(visited[FIGHT_TABLE[1].length].startsWith('phase 2 ·'),
      `whole-fight endless stayed in phase 1: turn ${FIGHT_TABLE[1].length + 1}`
      + ` is "${visited[FIGHT_TABLE[1].length]}"`);
  }
}

// ---- 6. THE NORMAL PATH DOES NOT MOVE -------------------------------------
//
// The byte gate replays this scene. A stage number on a NORMAL state must
// produce the SAME TRACE, not merely the same outcome — see the header.

function traceRun(endlessStage, frames = 1200) {
  const state = createState({ seed: 12345, traceBulletSlots: 8 });
  state.runMode = 'normal';
  if (endlessStage !== null) state.endlessStage = endlessStage;
  buildPracticeScene(state, { seed: 12345 });
  let pulse = false;
  const rows = [];
  for (let f = 0; f < frames; f++) {
    let input = idle;
    if (state.menu?.open || state.dialogue?.text || state.pendingAct) {
      pulse = !pulse;
      input = { ...idle, confirm: pulse };
    }
    stepFrame(state, input);
    rows.push(traceRow(state));
  }
  return rows.join('\n');
}

const baseline = traceRun(null);
check(baseline.length > 0, 'the NORMAL control run produced no trace at all');
// POSITIVE EXECUTION ASSERTION: the control must actually be a fight, not
// 1,200 frames of an empty menu — otherwise a byte-identical comparison below
// would prove nothing. Distinct rows is the cheapest honest measure of that.
{
  const distinct = new Set(baseline.split('\n')).size;
  check(distinct > 100,
    `the NORMAL control run only produced ${distinct} distinct trace rows — it is not moving`);
}
for (const stage of [0, 1, 3, 4, 99]) {
  check(traceRun(stage) === baseline,
    `endlessStage ${stage} changed a NORMAL run's trace — the lock is leaking out of ENDLESS`);
}

// ---- 7. the stage list DRAWS -----------------------------------------------
//
// Nothing else reaches it. `verify-render-smoke` walks the SETTINGS pages and
// the binding list; the mode list's sub-stages are not among them, and a throw
// inside a title draw freezes the menu exactly the way the tinted() crash
// froze the fight — reported from play, invisible to every state suite.
//
// The stub is the smoke test's, in miniature: a Proxy canvas, a DOM shim, and
// a FONT THAT RESOLVES. That last one is not optional — `drawTitle` returns on
// its second line when `loadFont()` is not ready, so without it this block
// would draw nothing and pass forever (found by sabotage on that very file).

{
  const noop = () => {};
  const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
    'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
    'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
    'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
    'filter']);
  const mkCtx = () => new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return { width: 640, height: 480 };
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      if (p === 'createPattern') return () => ({});
      if (p === 'getImageData' || p === 'createImageData') {
        return (a, b, w, h) => {
          const W = (p === 'createImageData' ? a : w) || 1;
          const H = (p === 'createImageData' ? b : h) || 1;
          return { data: new Uint8ClampedArray(W * H * 4), width: W, height: H };
        };
      }
      if (VALUE_PROPS.has(p)) return t[p] ?? '';
      if (p === 'drawImage' || p === 'fillText') {
        return () => { globalThis.__drawn = (globalThis.__drawn ?? 0) + 1; };
      }
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
  globalThis.document ??= {
    createElement: (tag) => {
      if (tag !== 'canvas') return {};
      const c = { width: 0, height: 0, style: {} };
      c.getContext = () => mkCtx();
      return c;
    },
  };
  globalThis.window ??= globalThis;
  globalThis.devicePixelRatio ??= 1;
  const META = {
    page: { w: 1520, h: 24 },
    glyphs: Array.from({ length: 96 }, (_, i) => ({
      c: 32 + i, x: i * 16, y: 0, w: 12, h: 24, shift: 14, offset: 0,
    })),
  };
  globalThis.fetch = async () => ({ json: async () => META });
  globalThis.Image = class {
    constructor() { this.width = 1520; this.height = 24; }
    set src(v) { this._src = v; queueMicrotask(() => this.onload && this.onload()); }
    get src() { return this._src; }
  };

  // DYNAMIC, and after the stub: `loadFont` caches per name, so anything that
  // imports the renderer before the shim is in place caches a font that is not
  // ready and every draw below returns early.
  const { drawTitle } = await import('../render/title.js');
  const { loadFont } = await import('../render/font.js');
  loadFont();
  // The loader resolves on a microtask (the Image shim above), so give it one.
  await new Promise((r) => setTimeout(r, 20));

  const sprites = { get: () => ({ frames: [{ width: 32, height: 32 }], meta: { ox: 16, oy: 16, w: 32, h: 32 } }) };
  const ctx = mkCtx();
  globalThis.__drawn = 0;
  for (let i = 0; i < ENDLESS_STAGES.length; i++) {
    const t = createTitle();
    t.index = MODES.findIndex((m) => m.id === 'endless');
    t.pickingStage = true;
    t.stageIndex = i;
    try {
      drawTitle(ctx, t, sprites, ROSTER);
    } catch (err) {
      failures.push(`drawTitle threw on stage row ${i}: ${err.message}`);
      break;
    }
  }
  // POSITIVE EXECUTION ASSERTION: the draws above must have actually put text
  // on the stub, not returned early on an unready font. Without this the block
  // is five silent no-ops that can never fail.
  check(globalThis.__drawn > 20,
    `the stage list drew only ${globalThis.__drawn} times — drawTitle is returning early, so this proves nothing`);
}

// ---- report ---------------------------------------------------------------

if (failures.length) {
  for (const f of failures) console.log(`→ FAILURE  ${f}`);
  console.log(`\n${failures.length} FAILURE(S)`);
  process.exit(1);
}

console.log(`→ ${ENDLESS_STAGES.length} stage rows; every row's index IS its phase (kaizo.js leans on this)`);
console.log('→ ENDLESS opens the stage list, X backs out, confirming a stage starts the run');
console.log('→ phases 1-4 each repeat their own turns, in the selector\'s order, wrapping to turn 1');
console.log('→ the WHOLE FIGHT row still hands phase 1 over to phase 2');
console.log('→ a NORMAL run traces byte-identically with any stage number on it');
console.log('→ every stage row draws without throwing');
