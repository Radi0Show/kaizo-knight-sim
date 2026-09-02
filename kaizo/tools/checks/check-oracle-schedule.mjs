#!/usr/bin/env node
// THE FIRST KAIZO ASSERTION THAT IS NOT POSITIVE-ONLY.
//
//   node kaizo/tools/checks/check-oracle-schedule.mjs [trace.csv]
//
// Every other check under kaizo/tools/checks/ asks "did the module run, did the
// ledger walk the chain, does the same seed give the same bytes". All of those
// can be green while the recreation is wrong, because none of them has ever
// been held against EnderCat8's actual mod. This one is: it reads a recording
// made by `knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1` and holds the
// generated V-C schedule against what the real fight DID.
//
// It is the kaizo half of the method CLAUDE.md describes for the vanilla fight:
// patch the player's own game into an oracle, record it frame by frame, and
// diff. The vanilla side earned every claim that way. Until this file existed,
// kaizo had earned none of them.
//
// ── WHAT IS CHECKED, AND WHY EACH IS THE HONEST QUANTITY ──────────────────
//
// Per launch, three things, all measured rather than read off the mod's code:
//
//   ORDER       the sequence of `kaizo_attack` values the fight walked, against
//               the nextAttack chain in VC_TABLE. This is the whole point: the
//               table was extracted STATICALLY from Other_24, and a static
//               extraction says what the code contains, never what the flow
//               reaches. CLAUDE.md records that exact mistake three times for
//               the vanilla fight ("reading a table of branches instead of the
//               control flow through them"), each time costing a retraction.
//
//   ac + difficulty   the two fields Other_10 copies out of the struct. These
//               are what every downstream dispatch keys on, so a wrong one is
//               a wrong ATTACK, not a cosmetic detail.
//
//   ARENA       the box the launch produced: placement (x, y) at the frame
//               obj_growtangle appears, and max image scale over the turn.
//               This is where the mod's deltas from vanilla actually live —
//               ac 0's board is at x 148 in the mod, and it is the geometry
//               table in kaizo-mod-launcher.js that claims so.
//
// ── THE ATTRIBUTION RULE ──────────────────────────────────────────────────
//
// Which entry was playing on a given frame has two possible answers in the
// recording, and only one of them survives contact with a MODE 1 run.
//
// PREFERRED — the `kaizo_playing` column, which is the mod's own
// `kaizo_prevatk`: the entry obj_knight_enemy records as having just fired. A
// transition of that column IS a launch, with no inference in between.
//
// FALLBACK — `kaizo_attack`, the pointer to the NEXT entry. Step_0 advances it
// to `kaizo_AT.nextAttack` at `rtimer == 12`, the same frame the attack
// launches, so a transition marks a launch and the value BEFORE it names what
// fired. Correct for MODE 0, and used for recordings made before the recorder
// grew the `kaizo_playing` column.
//
// THE FALLBACK IS WRONG FOR MODE 1 AND THAT IS NOT A THEORETICAL CONCERN — it
// is what this file was measured doing. A MODE 1 (attack-lock) recording has
// the recorder writing `kaizo_attack = <lock>` every frame outside the bullet
// phase, so each turn produces TWO transitions: the mod advancing the pointer
// to the real nextAttack, and the recorder shoving it back. The fallback reads
// the second one as a launch of an entry that never launched — a phantom turn
// with no board and the previous turn's ac. Against the Starstorm4Final lock it
// invented five launches of atk_Multislash3Final and reported 14 failures, none
// of which was a divergence: the harness was perturbing the thing it measured.
//
// Neither rule can pass by accident on a schedule recording. The phase-1
// entries dispatch DISTINCT ac values (1, 0, 2, 109, 13, 3, 5), so an
// attribution shifted by one compares every entry against its neighbour and
// fails on all of them at once rather than drifting quietly.
//
// ── WHAT THIS DOES NOT CHECK ──────────────────────────────────────────────
//
// Nothing inside an attack. Not one bullet position, not one frame of timing.
// A green run here says the fight SELECTS the right things in the right order
// and raises the right board for them; it says nothing about what happens on
// that board. Per-attack row-exact diffs are the next rung and want a MODE 1
// (attack-lock) recording each — see the recorder's header.
//
// It also cannot see phase 4. The recorder pins monsterhp at max so the run
// survives to the end of its frame budget, and the mod's phase-4 entries are
// reachable only through the `monsterhp <= 0.6 * max` gate. That is stated in
// the recorder and restated here because a reader of this file's output would
// otherwise reasonably conclude the whole schedule had been walked.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { gmlRound } from '../../../sim/gml.js';
import { VC_TABLE, VD_TABLE, VC_LOOP } from '../../versions/vc-script.js';
import { arenaGeom, vcTurnLength } from '../../scenes/kaizo-mod-launcher.js';

// KAIZO_ORACLE_TRACES overrides the directory, the same escape hatch
// tools/verify-fullfight.mjs gives with KNIGHT_TRACES. The defaults follow the
// documented layout (docs/WINDOWS.md): knight-research sits at
// ~/knight-research, by a junction on this machine.
//
// TWO CANDIDATES, IN THIS ORDER, and the order is the whole reason this is a
// list. The recorder's output has lived in both `kaizo-mod/traces` and
// `kaizo-mod/oracle/traces`, and a check that hardcoded either one reported
// "no recording" — a LOUD SKIP, which reads as "there is nothing to check
// against" — at a moment when nine recordings were sitting on disk one
// directory away. A skip that is really a path bug is the worst outcome
// available here, because it looks like an honest absence.
//
// NOTE for whoever settles the layout: knight-research/.gitignore ignores
// `oracle/` wholesale, so recordings under `oracle/traces` are UNTRACKED. They
// are ground truth and expensive to reproduce (each is a real game run); the
// tracked `kaizo-mod/traces` is the safer home for them.
const TRACE_DIRS = process.env.KAIZO_ORACLE_TRACES
  ? [process.env.KAIZO_ORACLE_TRACES]
  : [
    join(homedir(), 'knight-research', 'kaizo-mod', 'oracle', 'traces'),
    join(homedir(), 'knight-research', 'kaizo-mod', 'traces'),
  ];

/**
 * The first candidate directory that exists AND holds a recording, with the
 * list of everywhere looked so a skip can say where it looked.
 */
export function resolveTraces() {
  for (const dir of TRACE_DIRS) {
    if (!existsSync(dir)) continue;
    const found = readdirSync(dir)
      .filter((f) => /^kaizo_oracle_trace.*\.csv$/.test(f))
      .sort();
    if (found.length) return { dir, found };
  }
  return { dir: null, found: [], looked: TRACE_DIRS };
}

/** Parse a recorder CSV into { header, col, rows }. */
export function readTrace(path) {
  const text = readFileSync(path, 'utf8').replace(/\r/g, '').trimEnd();
  const lines = text.split('\n');
  const header = lines[0].split(',');
  return {
    header,
    col: Object.fromEntries(header.map((h, i) => [h, i])),
    rows: lines.slice(1).filter((l) => l.length).map((l) => l.split(',')),
  };
}

/**
 * A cell as a number, or null for the empty cell the recorder writes when the
 * thing being measured does not exist.
 *
 * `''` and `0` are different states and must not collapse: no box is not a box
 * at the origin. Number('') is 0, so the emptiness test comes first.
 */
function num(t, r, name) {
  const i = t.col[name];
  if (i === undefined) return null;
  const v = r[i];
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function text(t, r, name) {
  const i = t.col[name];
  return i === undefined ? '' : (r[i] ?? '');
}

/**
 * obj_growtangle's per-turn `!init` quantiser, from sim/battlebox.js:
 *
 *     if ((maxxscale % 2) != 0) maxxscale = round(maxxscale * 37.5) / 37.5;
 *
 * GML `round` is HALF-TO-EVEN, which is load-bearing here and nowhere else:
 * the sword tunnel's 3 gives 3 * 37.5 = 112.5 exactly, and half-to-even sends
 * that to 112, so the real board is 2.98666..., not 3. JS Math.round would give
 * 113 and a board that is 1/37.5 too wide — a divergence the recording catches
 * on sight.
 *
 * The `% 2` guard means a scale of exactly 2 (or 4) is left alone, which is why
 * most turns record a clean 2.
 */
function quantise(s) {
  return s % 2 !== 0 ? gmlRound(s * 37.5) / 37.5 : s;
}

/** f32, because obj_growtangle's image_xscale is a built-in and narrows on store. */
const f32 = (v) => Math.fround(v);

/**
 * Recover one record per launch from a MODE 0 recording.
 *
 * Returns [{ frame, played, next, ac, difficulty, acStable, box }]. `box` is
 * null when no obj_growtangle was raised for that turn, which is a legitimate
 * state (the charge-up turn raises no board) and not an error.
 */
export function recoverLaunches(t) {
  const out = [];
  if (!t.rows.length) return out;

  // Where the box appears after being absent: the placement frame. Recorded
  // separately from the launch because the two are ~12 frames apart (the board
  // is raised under mnfight == 1.5, the attack spawns under mnfight == 2) and
  // because the ARENA MOVES — the Stars cone drags the board left every frame,
  // so reading placement at the launch frame would measure drift, not
  // placement. CLAUDE.md: "the box travels 102px left" over one Stars turn.
  const creations = [];
  for (let i = 0; i < t.rows.length; i++) {
    const here = num(t, t.rows[i], 'gt_x') !== null;
    const before = i > 0 && num(t, t.rows[i - 1], 'gt_x') !== null;
    if (here && !before) creations.push(i);
  }

  // See the header. `kaizo_playing` names what just fired; `kaizo_atk` names
  // what is next, so under the fallback the entry that fired is the value
  // BEFORE the transition.
  const usePlaying = t.col.kaizo_playing !== undefined;
  const key = usePlaying ? 'kaizo_playing' : 'kaizo_atk';

  let prev = text(t, t.rows[0], key);
  // -1, NOT 0. The board for the FIRST turn is already up on row 0 — the
  // recorder starts recording after the battle has opened — so its creation
  // index is 0, and a `c > prevIdx` window anchored at 0 excludes exactly the
  // one turn whose board is hardest to re-record. It presented as "no
  // obj_growtangle was raised for this turn" against a recording whose very
  // first row has one.
  let prevIdx = -1;
  for (let i = 1; i < t.rows.length; i++) {
    const cur = text(t, t.rows[i], key);
    if (cur === prev) continue;
    // Under kaizo_playing the entry that fired is the NEW value, and the empty
    // opening value (nothing has fired yet) is not a launch.
    const played = usePlaying ? cur : prev;
    if (usePlaying && played === '') { prev = cur; prevIdx = i; continue; }

    // ac/difficulty are assigned by the selector under mnfight == 1.5, twelve
    // frames before this, and hold until the NEXT selection. Sampling four
    // frames in is comfortably inside that plateau at both ends.
    const at = Math.min(i + 4, t.rows.length - 1);
    const ac = num(t, t.rows[at], 'attackchoice');
    const difficulty = num(t, t.rows[at], 'difficulty');

    // A SAMPLE OF ONE FRAME IS NOT A MEASUREMENT unless the value is holding.
    // If ac moves inside the window, the plateau reasoning above is wrong for
    // this recording and the row must not be reported as verified.
    let acStable = true;
    for (let k = i; k <= Math.min(i + 30, t.rows.length - 1); k++) {
      if (num(t, t.rows[k], 'attackchoice') !== ac) { acStable = false; break; }
    }

    // The box belonging to THIS turn is the last one raised at or before the
    // launch and after the previous launch.
    const cIdx = creations.filter((c) => c > prevIdx && c <= i).pop();
    let box = null;
    if (cIdx !== undefined) {
      // Placement is read at creation. Scale is read as the MAX across the
      // turn, because the board grows 0 -> max over ~15 frames: any single
      // early sample measures the grow-in, and the max is the plateau.
      const end = Math.min(i + 30, t.rows.length - 1);
      let xs = 0;
      let ys = 0;
      for (let k = cIdx; k <= end; k++) {
        xs = Math.max(xs, num(t, t.rows[k], 'gt_xs') ?? 0);
        ys = Math.max(ys, num(t, t.rows[k], 'gt_ys') ?? 0);
      }
      box = {
        frame: num(t, t.rows[cIdx], 'frame'),
        x: num(t, t.rows[cIdx], 'gt_x'),
        y: num(t, t.rows[cIdx], 'gt_y'),
        xs,
        ys,
      };
    }

    // THE ARMED TURN CLOCK, read at the launch frame itself and nowhere else.
    //
    // Two different clocks are visible in this column and they must not be
    // confused. At the LAUNCH FRAME it holds the floor the knight's own
    // dispatch armed (kaizo_setAttack -> scr_turntimer). One frame later the
    // ATTACK OBJECT — which gets its first Step after the controller that
    // spawned it — may overwrite it: the pinners jump to 999999, ac 2 d5 and
    // ac 102 set 600.
    //
    // So `turntimerArmed` is the DISPATCH floor and nothing else, and it is
    // read at f0 rather than f0+1 for exactly that reason. It is the armed
    // value MINUS ONE: the battle controller has already decremented it once
    // by the time the row for the launch frame is written. Measured, uniform
    // across all eleven comparable entries, and the same off-by-one shape
    // CLAUDE.md records for a delayed tween ("count n - 1").
    const phase = num(t, t.rows[at], 'phase');
    const phaseturn = num(t, t.rows[at], 'phaseturn');
    const turntimerArmed = num(t, t.rows[i], 'turntimer');
    const turntimerAfter = i + 3 < t.rows.length
      ? Math.max(...[1, 2, 3].map((k) => num(t, t.rows[i + k], 'turntimer') ?? -Infinity))
      : null;

    out.push({
      frame: num(t, t.rows[i], 'frame'),
      played,
      ac,
      difficulty,
      acStable,
      box,
      phase,
      phaseturn,
      turntimerArmed,
      turntimerAfter,
      source: key,
    });
    prev = cur;
    prevIdx = i;
  }
  return out;
}

const TABLES = { C: VC_TABLE, D: VD_TABLE };

/** Flatten a route's table into an id -> row map; ids are unique across phases. */
function tableById(route) {
  const table = TABLES[route];
  const map = new Map();
  for (const phase of Object.keys(table)) {
    for (const row of table[phase]) map.set(row.id, row);
  }
  return map;
}

/**
 * WHICH ROUTE IS THIS A RECORDING OF?
 *
 * The mod has two: the ordinary one, and the B-Side that `global.flag[456]`
 * selects (obj_knight_enemy's Create reads it into `k_sideb`; Other_24 rewrites
 * five entries and Step_0 dispatches through `kaizo_setAttack_sideb`).
 *
 * The recording does not say which it is — there is no flag column — so it has
 * to be inferred, and the inference has to be one that CANNOT quietly pick
 * wrong. The two generated tables carry the SAME 31 entry ids in the SAME
 * order, and differ in exactly three rows' dispatch:
 *
 *     atk_RisingAbyssB   ac 3   -> ac 101
 *     atk_Swords1        ac 17  -> ac 112
 *     atk_Quickslash     ac 105 -> ac 105.1
 *
 * So those three entries, and only those three, are evidence. Every other row
 * is identical between the routes and says nothing. A recording that contains
 * none of them is genuinely AMBIGUOUS — and since the tables agree everywhere
 * else, checking it against either one is correct; the honest thing is to say
 * so rather than to pick silently.
 *
 * This is deliberately NOT "score both tables and take the higher count". That
 * would let 28 uninformative agreements outvote one informative disagreement,
 * and would report a confident answer on a recording that contains no evidence
 * at all.
 */
export function detectRoute(launches) {
  const DISCRIMINATORS = ['atk_RisingAbyssB', 'atk_Swords1', 'atk_Quickslash'];
  const byC = tableById('C');
  const byD = tableById('D');
  const votes = { C: [], D: [] };
  for (const L of launches) {
    if (!DISCRIMINATORS.includes(L.played)) continue;
    const c = byC.get(L.played);
    const d = byD.get(L.played);
    if (c && gmlish(L.ac, c.ac)) votes.C.push(`${L.played} ac ${L.ac}`);
    else if (d && gmlish(L.ac, d.ac)) votes.D.push(`${L.played} ac ${L.ac}`);
  }
  if (votes.C.length && !votes.D.length) return { route: 'C', evidence: votes.C };
  if (votes.D.length && !votes.C.length) return { route: 'D', evidence: votes.D };
  if (votes.C.length && votes.D.length) {
    // A recording cannot be both. Something upstream is wrong — most likely the
    // launch attribution — and guessing here would bury it.
    return { route: null, conflict: true, evidence: [...votes.C, ...votes.D] };
  }
  return { route: null, ambiguous: true, evidence: [] };
}

/**
 * The B-Side dispatches ac 105.1, so route detection compares a REAL against a
 * table literal. GML compares reals with a tolerance and JS `===` does not
 * (CLAUDE.md, "GML `==` ON REALS IS NOT `===`"); the recorder prints ten
 * decimals, so 105.1 arrives as 105.1000000000 and parses back to a value that
 * is not bit-identical to the literal 105.1 in every arithmetic path.
 */
function gmlish(a, b) {
  return a !== null && b !== null && Math.abs(a - b) < 1e-5;
}

/**
 * THE CHAIN. What VC_TABLE says follows `id` on the ordinary route.
 *
 * The mod's schedule is a linked list of structs, each naming its own
 * `nextAttack`. The generated table flattens that into per-phase arrays, so the
 * successor rule is: the next element of the same phase; at the end of a phase,
 * the first element of the next; and at the end of the LAST ordinary phase,
 * `VC_LOOP` — which claims phase 3 chains back into PHASE 2's second entry
 * (`atk_Quickslash`) rather than restarting at phase 1.
 *
 * PHASE 4 IS NOT ON THIS CHAIN and is excluded deliberately. Its four entries
 * are reachable only through the HP gate, which swaps `kaizo_attack` wholesale;
 * they do not follow anything, so asking what precedes them is a category
 * error. A recording that reaches one (a MODE 1 lock does) classifies as
 * 'partial' and never gets here.
 *
 * Returns null when the successor is not defined by the ordinary chain, which
 * is the caller's signal to assert nothing rather than to assert a guess.
 */
function expectedNext(id, route = 'C') {
  const table = TABLES[route];
  const phases = Object.keys(table).filter((p) => p !== '4').sort();
  for (let pi = 0; pi < phases.length; pi++) {
    const rows = table[phases[pi]];
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) continue;
    if (i + 1 < rows.length) return rows[i + 1].id;
    if (pi + 1 < phases.length) return table[phases[pi + 1]][0].id;
    // VC_LOOP is the only loop the generator exports and the two routes carry
    // the same 31 ids in the same order, so it describes both.
    return table[String(VC_LOOP.phase)]?.[VC_LOOP.turn]?.id ?? null;
  }
  return null;
}

/**
 * Compare the recovered launches against the generated schedule.
 * Returns { checks, failures, notes }.
 */
export function checkAgainstTable(launches, { route = 'C' } = {}) {
  // THE ROUTE PICKS THE TABLE **AND** THE GEOMETRY BRANCH TOGETHER, because in
  // the mod they are the same switch: `k_sideb` selects both the rewritten
  // Other_24 entries and the `kaizo_setAttack_sideb` dispatch. Taking the
  // B-Side's schedule with the normal route's arenas would be a fight that does
  // not exist, and every arena assertion would be against a board the mod never
  // raises.
  const sideb = route === 'D';
  const byId = tableById(route);
  const failures = [];
  const notes = [];
  let checks = 0;

  // ── THE ORDER, asserted rather than implied ──────────────────────────────
  //
  // Everything below this block verifies one launch against one table row, and
  // a suite of those can be entirely green while the fight plays its attacks in
  // a completely different sequence. "The schedule is verified" is a claim
  // about SUCCESSION, and until this loop existed nothing here tested it — the
  // summary line said "schedule ORDER" on the strength of a human reading the
  // printed chain, which is precisely the sort of claim CLAUDE.md means by
  // "a claim is only true if a suite checks it".
  //
  // ONLY ON A SCHEDULE RECORDING. In a MODE 1 attack-lock run the recorder
  // writes `kaizo_attack = <lock>` every frame outside the bullet phase, so the
  // succession is the HARNESS's and not the mod's: every lock recording shows
  // atk_Starstorm1 followed by the locked entry, and asserting the chain there
  // reports a divergence that measures the instrument. The check's own summary
  // already says a partial recording "makes NO claim about the order of the
  // chain"; before this guard, the code contradicted that sentence.
  if (classify(launches) === 'schedule') {
    for (let i = 0; i + 1 < launches.length; i++) {
      const want = expectedNext(launches[i].played, route);
      if (want === null) continue;
      checks += 1;
      if (launches[i + 1].played !== want) {
        failures.push(`chain — after ${launches[i].played} the table says`
          + ` ${want}, the mod played ${launches[i + 1].played}`
          + ` (frame ${launches[i + 1].frame})`);
      }
    }
  } else {
    notes.push('succession NOT checked — this is a partial/attack-lock recording,'
      + " where the order is the recorder's and not the mod's");
  }

  for (const L of launches) {
    const row = byId.get(L.played);
    if (!row) {
      failures.push(`${L.played}: the recording played an entry the generated`
        + ' table does not contain — the extraction is incomplete');
      continue;
    }

    if (!L.acStable) {
      // Reported, never silently tolerated: an unstable ac means the model of
      // when the selector runs is wrong for this recording, and every other
      // number sampled the same way is then suspect.
      notes.push(`${L.played}: attackchoice did not hold across the 30 frames`
        + ` after launch (frame ${L.frame}) — sampled value ${L.ac} is not a plateau`);
    }

    checks += 1;
    // gmlish, not ===: the B-Side dispatches ac 105.1 and the recorder prints
    // it to ten decimals. See the note on gmlish() and CLAUDE.md's
    // "GML `==` ON REALS IS NOT `===`".
    if (!gmlish(L.ac, row.ac)) {
      failures.push(`${L.played}: ac — table ${row.ac}, oracle ${L.ac}`);
    }
    checks += 1;
    if (!gmlish(L.difficulty, row.difficulty)) {
      failures.push(`${L.played}: difficulty — table ${row.difficulty}, oracle ${L.difficulty}`);
    }

    // ── the phase ──────────────────────────────────────────────────────────
    // The struct's own attackPhase, which the mod copies into the knight. This
    // is what the schedule's phase-1/2/3 grouping in VC_TABLE claims, and the
    // recording is the only thing that can confirm the boundaries land where
    // the extraction says they do.
    checks += 1;
    if (L.phase !== row.phase) {
      failures.push(`${L.played}: phase — table ${row.phase}, oracle ${L.phase}`);
    }

    // THE VANILLA LADDER IS DEAD, ASSERTED RATHER THAN ASSUMED.
    //
    // Vanilla's selector walks `phaseturn` 1..5 per phase, and the mod's
    // Other_10 short-circuits on the kaizo_attack struct before reaching any
    // of it. If phaseturn were still moving, some part of the old ladder would
    // still be running and the linked-list model of this fight would be
    // incomplete. It holds at 0 for every recorded launch — a positive result
    // about a mechanism being ABSENT, which is the only kind worth having.
    checks += 1;
    if (L.phaseturn !== 0) {
      failures.push(`${L.played}: phaseturn is ${L.phaseturn}, not 0 — the mod is`
        + " supposed to short-circuit vanilla's phaseturn ladder entirely");
    }

    // ── the armed turn clock ───────────────────────────────────────────────
    //
    // Only the comparable half is asserted. `vcTurnLength` SHORT-CIRCUITS to
    // 999999 whenever the row's arm contains a pinner type, which is a model of
    // the attack's own override rather than of the dispatch floor — so for
    // those rows the sim simply does not carry a number this column can be
    // held against. Asserting anyway would compare two different quantities
    // that happen to agree most of the time, which is the failure mode
    // sim/trace.js's `phaseturn` note exists to warn about.
    const want = vcTurnLength(row, { sideb });
    if (want === 999999) {
      // What CAN be checked: the mod really does hand this attack a
      // self-ending clock. A positive assertion, so "the pinner set is right"
      // is distinguishable from "nothing looked".
      checks += 1;
      if (L.turntimerAfter !== 999999) {
        notes.push(`${L.played}: the sim models this turn as self-ending (a pinner),`
          + ` and the mod set turntimer ${L.turntimerAfter} within 3 frames of launch`
          + ' rather than 999999 — the pinner set may be wrong for this ac');
        checks -= 1;
      }
    } else if (want > 0) {
      checks += 1;
      if (L.turntimerArmed !== want - 1) {
        failures.push(`${L.played}: armed turn clock — table ${want}`
          + ` (so ${want - 1} after one tick), oracle ${L.turntimerArmed}`);
      }
    } else {
      // vcTurnLength 0 means the dispatch arms NO floor and the previous
      // turn's clock keeps draining. The recording shows exactly that for
      // ac 110 (78, 77, then the attack's own 999), so this is the model
      // agreeing rather than a gap — but there is no equality to assert.
      notes.push(`${L.played}: the dispatch arms no turn floor (ac ${row.ac});`
        + ` the clock was at ${L.turntimerArmed} on the launch frame, still draining`);
    }

    // ── the arena ──────────────────────────────────────────────────────────
    if (row.ac === -1) {
      // The charge-up turn raises no board, in the mod as in vanilla, and that
      // is an assertion worth making rather than a case to skip.
      checks += 1;
      if (L.box) failures.push(`${L.played}: ac -1 is the charge-up and must raise NO board, but one appeared at frame ${L.box.frame}`);
      continue;
    }
    if (!L.box) {
      failures.push(`${L.played}: no obj_growtangle was raised for this turn`);
      continue;
    }

    const g = arenaGeom(row, sideb);
    // The recorder's room puts the camera at the origin, which the recording
    // itself shows (a default board records x 320, and the sim's table says
    // view.x + 320). If that ever stops being true the x comparison shifts by
    // the camera and fails loudly on every row rather than drifting.
    const wantX = g.x + g.dx;
    const wantY = g.y + g.dy;
    checks += 1;
    if (L.box.x !== wantX || L.box.y !== wantY) {
      failures.push(`${L.played}: arena placement — table (${wantX}, ${wantY}),`
        + ` oracle (${L.box.x}, ${L.box.y})`);
    }
    checks += 1;
    const wantXs = f32(quantise(g.xscale));
    const wantYs = f32(quantise(g.yscale));
    if (f32(L.box.xs) !== wantXs || f32(L.box.ys) !== wantYs) {
      failures.push(`${L.played}: arena scale — table (${wantXs}, ${wantYs}),`
        + ` oracle (${L.box.xs}, ${L.box.ys})`);
    }
  }

  return { checks, failures, notes };
}

/**
 * WHAT KIND OF EVIDENCE IS THIS RECORDING?
 *
 * Not a yes/no, because the recorder makes two genuinely different kinds and
 * collapsing them costs something either way. A MODE 0 run walks the chain. A
 * MODE 1 run pins ONE entry and replays it — which is the only way to reach the
 * four phase-4 entries at all, since the recorder holds monsterhp at max and
 * the phase-4 gate needs it at 0.6 — and it is real evidence about that entry
 * while being no evidence at all about ordering.
 *
 *   'schedule'   >= 3 launches of >= 3 distinct entries. The chain claim holds.
 *   'partial'    >= 1 launch. Per-entry facts hold; ORDER IS NOT CLAIMED.
 *   'degenerate' nothing launched.
 *
 * The 'partial' verdict is the one to watch: it passes, and it must never be
 * reported in the words used for 'schedule'. verify-fullfight learned exactly
 * this the expensive way — its first whole-fight recordings ran ONE turn and
 * the differ reported "exact through frame 21", which was true and badly
 * misleading. The wording, not the exit code, is what a reader acts on.
 */
export function classify(launches) {
  if (launches.length === 0) return 'degenerate';
  const distinct = new Set(launches.map((L) => L.played));
  if (launches.length >= 3 && distinct.size >= 3) return 'schedule';
  return 'partial';
}

/** Kept for callers that want the old shape: a non-empty list means "refuse". */
export function degeneracy(launches) {
  return classify(launches) === 'degenerate'
    ? ['no launch was recovered from the recording — nothing fired']
    : [];
}

function main() {
  const argv = process.argv.slice(2);
  const routeIdx = argv.indexOf('--route');
  const routeOverride = routeIdx >= 0 ? String(argv[routeIdx + 1] ?? '').toUpperCase() : null;
  if (routeOverride && !TABLES[routeOverride]) {
    console.log(`FAIL check-oracle-schedule: --route must be C or D, got "${routeOverride}"`);
    return 1;
  }
  // `i !== routeIdx + 1` skips --route's VALUE so it is not mistaken for a
  // path. The guard on routeIdx >= 0 is load-bearing: with no --route present
  // routeIdx is -1, so routeIdx + 1 is 0 and the condition would silently
  // discard the FIRST positional argument — the explicit path. That defect
  // shipped for one commit and presented as two different recordings both
  // reporting the same 244 assertions, because both had quietly fallen back to
  // the longest file on disk. "A green suite does not mean a change took
  // effect" (CLAUDE.md), arriving by the least interesting door available.
  const valueIdx = routeIdx >= 0 ? routeIdx + 1 : -1;
  const explicit = argv.find((a, i) => !a.startsWith('--') && i !== valueIdx) ?? null;

  if (explicit) return runOne(explicit, routeOverride);

  const { dir, found, looked } = resolveTraces();
  if (!dir) {
    // A LOUD SKIP, NEVER A SILENT PASS. This check is the only thing in the
    // kaizo gate that can fail for a reason outside kaizo/, so its absence
    // has to be visible in the output — a reader who sees a green gate and
    // does not see this line would reasonably believe the schedule had been
    // held against the mod.
    console.log('SKIP check-oracle-schedule: no kaizo oracle recording found');
    for (const l of looked) console.log(`     looked in ${l}`);
    console.log('     Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,');
    console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
    console.log('     NOTHING IN THE KAIZO GATE IS HELD AGAINST THE REAL MOD WITHOUT IT.');
    return 0;
  }

  // EVERY RECORDING, NOT THE LONGEST ONE.
  //
  // This used to check only the largest file, on the reasoning that it walked
  // furthest along the chain. That reasoning is fine and the conclusion was
  // wrong: the recordings are not redundant. They cover DIFFERENT THINGS — the
  // ordinary route, the B-Side route (a different table AND a different arena
  // table), and one attack-lock per phase-4 entry, which no MODE 0 run can
  // reach because the recorder pins boss HP above the gate. Checking the
  // longest left the B-Side and all four phase-4 entries verified once, by
  // hand, and re-verified by nothing.
  //
  // They are milliseconds each. Check them all, and let the summary say how
  // many recordings the claim rests on.
  const paths = found.map((f) => join(dir, f))
    .map((p) => ({ p, n: readFileSync(p, 'utf8').length }))
    .sort((a, b) => b.n - a.n)
    .map((x) => x.p);

  let bad = 0;
  for (const p of paths) {
    if (runOne(p, routeOverride) !== 0) bad++;
    console.log('');
  }
  if (bad) {
    console.log(`check-oracle-schedule: ${bad} of ${paths.length} recording(s) FAILED`);
    return 1;
  }
  console.log(`check-oracle-schedule: all ${paths.length} recording(s) of the real mod agree   OK`);
  return 0;
}

function runOne(path, routeOverride) {
  const t = readTrace(path);
  for (const need of ['frame', 'attackchoice', 'difficulty', 'kaizo_atk', 'gt_x', 'gt_y', 'gt_xs', 'gt_ys']) {
    if (t.col[need] === undefined) {
      console.log(`FAIL check-oracle-schedule: ${path} has no "${need}" column`);
      console.log(`     columns present: ${t.header.join(',')}`);
      return 1;
    }
  }

  const launches = recoverLaunches(t);
  const kind = classify(launches);
  const via = launches[0]?.source ?? (t.col.kaizo_playing !== undefined ? 'kaizo_playing' : 'kaizo_atk');

  console.log(`check-oracle-schedule: ${path}`);
  console.log(`  ${t.rows.length} frames, ${launches.length} launch(es) recovered via ${via}`);
  if (via === 'kaizo_atk') {
    // Not a warning about this run so much as about the next one: the fallback
    // is silently wrong for MODE 1, and a reader needs to know which rule
    // produced the numbers below.
    console.log('  NOTE: this recording predates the kaizo_playing column, so launches are');
    console.log('        inferred from the kaizo_attack pointer. That inference is WRONG for');
    console.log('        MODE 1 (attack-lock) recordings — re-record to get kaizo_playing.');
  }

  if (kind === 'degenerate') {
    console.log('  DEGENERATE — nothing launched in this recording.');
    console.log('    Re-record with a larger -Frames budget.');
    return 1;
  }

  // ── WHICH ROUTE ────────────────────────────────────────────────────────────
  const det = detectRoute(launches);
  if (det.conflict) {
    // Both routes' signatures in one recording is impossible in the mod, so
    // something upstream is wrong — most likely the launch attribution. Failing
    // here is the point: picking a winner would bury it.
    console.log('  FAIL: the recording carries signatures of BOTH routes, which the mod');
    console.log('        cannot produce. The launch attribution is probably wrong.');
    for (const e of det.evidence) console.log(`          ${e}`);
    return 1;
  }
  const route = routeOverride ?? det.route ?? 'C';
  if (routeOverride) {
    console.log(`  route ${route} (forced with --route)`);
    if (det.route && det.route !== routeOverride) {
      console.log(`        WARNING: the recording's own evidence says route ${det.route}`);
      for (const e of det.evidence) console.log(`          ${e}`);
    }
  } else if (det.route) {
    console.log(`  route ${route} — ${route === 'D' ? 'THE B-SIDE (global.flag[456] = 1)' : 'the ordinary route'}`
      + `, from ${det.evidence.join(', ')}`);
  } else {
    // Honest: the two tables agree on 28 of 31 entries, so a recording with no
    // discriminating entry in it is checked correctly either way — but the
    // reader must not be told this was route C on evidence.
    console.log('  route AMBIGUOUS — this recording contains none of the three entries');
    console.log('        that differ between the routes (RisingAbyssB, Swords1, Quickslash).');
    console.log('        Checking against route C; the two tables agree everywhere else,');
    console.log('        so the result holds for either. Pass --route D to force.');
  }

  const { checks, failures, notes } = checkAgainstTable(launches, { route });

  // The launches, printed whether or not they pass: this is the only ground
  // truth about the mod that exists in the tree, and it belongs in the log.
  console.log(kind === 'schedule'
    ? '  the chain the real fight walked:'
    : '  the entr(ies) this recording pinned:');
  for (const L of launches) {
    const b = L.box ? `box (${L.box.x},${L.box.y}) ${L.box.xs}x${L.box.ys}` : 'no board';
    console.log(`    f${String(L.frame).padStart(5)}  ${L.played.padEnd(22)}`
      + ` ac ${String(L.ac).padStart(3)}  diff ${String(L.difficulty).padStart(3)}  ${b}`);
  }

  for (const n of notes) console.log(`  NOTE: ${n}`);

  if (failures.length) {
    console.log(`  ${failures.length} FAILURE(S) of ${checks} assertions:`);
    for (const f of failures) console.log(`    - ${f}`);
    return 1;
  }

  console.log(`  ${checks} assertions against the real mod   OK`);
  if (kind === 'schedule') {
    console.log('  (schedule ORDER, ac, difficulty, phase, the dead phaseturn ladder,');
    console.log('   the armed turn clock and arena geometry — nothing INSIDE an attack.)');
  } else {
    // THE WORDING IS THE POINT. A lock recording passing must not read like a
    // schedule recording passing.
    const which = [...new Set(launches.map((L) => L.played))].join(', ');
    console.log(`  PARTIAL RECORDING — this pins ${which} and makes NO claim`);
    console.log('  about the order of the chain. Per-entry ac, difficulty and arena only.');
  }
  return 0;
}

// pathToFileURL: on Windows argv[1] is a `D:\...` path and import.meta.url is a
// `file:///D:/...` URL, so the older `file://${argv[1]}` form is always false
// and main() would silently never run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
