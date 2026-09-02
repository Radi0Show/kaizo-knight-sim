#!/usr/bin/env node
// CHECK — atk_CrescentSlash (ac 0, difficulty 0, phase 1) against the real mod.
//
//     node kaizo/tools/checks/check-oracle-crescent.mjs        (exit 0/1)
//
// V-C recreation of EnderCat8's "Kaizo Roaring Knight" v2.3.3 — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate). This file reads a
// recording of the author's mod; the recording itself is untracked research
// data and nothing here reproduces it.
//
// ── WHAT THIS IS ──────────────────────────────────────────────────────────
//
// check-oracle-schedule holds the V-C SCHEDULE against a real recording: which
// entry fired, in what order, with which ac/difficulty and which board. It
// says nothing about what happens ON that board, and says so in its own
// header. This is the first check that goes inside one entry.
//
// The instrument is `kaizo_oracle_seq_*.csv` — the recorder's SPAWN log, one
// row per watched instance the first frame obj_time's Draw sees it, carrying
// x, y, image_angle, image_xscale, image_yscale, direction and speed. Because
// the recorder runs in Draw, a row is the instance's state at the END of the
// frame it was created in: created during a Step, moved once by the movement
// phase, then logged. The sim is sampled the same way (after stepFrame), so
// the two are measured alike.
//
// ── WHAT IS CLAIMED ───────────────────────────────────────────────────────
//
//   * the SET of object types the turn creates, restricted to the names the
//     recorder demonstrably watches (see VISIBLE below)
//   * per-type structural geometry: the generator's spawn point, the SIX LANES
//     the whole attack is aimed down, and the fixed x / scale / direction /
//     speed of every crescent, marker, slash animation and tracking sword
//   * grouping and cadence: one wave every 15 frames; within a wave the slash
//     animation, then the marker pair, then the crescent pair, at the offsets
//     the recording shows; two markers and two crescents per wave, mirrored
//   * the wave train's offset from the launch frame (slash +13, crescents +17)
//   * the FIRING GATE — the recorded fact that the last wave lands while
//     global.turntimer > 50 and the next slot is past it
//   * the crescent's DAMAGE — 153 in the mod against vanilla's 206. Sourced
//     from the mod's Create event, NOT from the recording; see section 4a for
//     why the recording cannot settle it and what makes the assertion
//     discriminating anyway.
//
// ── WHAT IS NOT CLAIMED ───────────────────────────────────────────────────
//
//   * ABSOLUTE FRAME NUMBERS. Only offsets relative to the launch frame, and
//     only where both sides run the same clock.
//   * THE TOTAL WAVE COUNT. The recording runs 15 waves; the sim runs 16 on
//     the same rule, because the recorder's turn clock is NOT a clean 1 per
//     frame — between f469 and f760 it takes twelve non-unit decrements,
//     including a TWELVE-unit drop at f636. That is the harness's clock, not
//     the mod's mechanism, so the count is reported and the GATE is asserted.
//   * ANY RNG OUTCOME. Which of the six lanes each wave picks comes from
//     `irandom(yposcount - 1)` and `irandom_range(1, posrange) * choose(-1,1)`,
//     and CLAUDE.md's honest claim is "mechanics one-to-one, RNG re-anchored
//     per launch". Lane MEMBERSHIP is asserted; lane ORDER is not.
//   * obj_afterimage counts. The Knight's rainbow trail is ~1800 instances a
//     turn, RNG- and turn-length-driven. Presence only.
//   * HP, TP, targeting, or ANY damage number as MEASURED. The recorder pins
//     party and boss HP, so every survival-shaped quantity in the recording is
//     a harness artifact. Section 4a asserts the crescent's damage FIELD, which
//     is structural; it does not claim the recording showed a hit for 153.
//
// ── ONE SECTION IS SOURCED FROM THE DUMP, NOT THE RECORDING ───────────────
//
// Section F asserts a branch the recording never exercises, read from
// `gml_Object_obj_bullet_knight_crescentGenerator_Step_0.gml`. It is labelled
// where it runs and its provenance is stated in its own output line, so a
// reader can never mistake it for a measurement.
//
// ── THE MODULE UNDER TEST, AND THE ROUTING EDIT THIS FILE STANDS IN FOR ───
//
// `kaizo/attacks/crescent-slash.js` — the kaizo copy of
// sim/attacks/swordslash.js carrying the mod's three deltas (an unconditional
// `damage = 153` at the generator Step's line 1, the new `turntimer >= 20`
// clock arm at lines 105-116, and `damage = 153` in the crescent's Create).
//
// kaizo/scenes/kaizo-mod-launcher.js still routes controller type 109 to the
// VANILLA module, and that file belongs to the integration pass, so
// `substituteType109` below performs the swap itself — the same idiom
// check-oracle-tunnel and check-oracle-tracking already use for their own
// pending routing edits. It is IDEMPOTENT: the day the launcher imports
// `launchKaizoSwordslash`, it finds the kaizo type already in place and does
// nothing, so this check does not quietly start measuring something else.
//
// Two things keep the substitution honest rather than assumed:
//
//   * section 2b PROVES the minimal swap is the routing edit, by running both
//     modules' `create` over bare objects and requiring the field sets to
//     differ in exactly the one field the kaizo Create adds;
//   * section 2c requires the launcher's pending VANILLA_BODIES[109] ledger row
//     to be present EXACTLY while the substitution is standing in. Landing the
//     import without deleting that row, or the reverse, turns this check red.
//
// ── THE ATTRIBUTION RULE ──────────────────────────────────────────────────
//
// Rows are grouped by `kaizo_playing`, the mod's own `kaizo_prevatk` — never
// by `kaizo_atk`, which is the pointer to the NEXT entry and has already moved
// on by the launch frame. Trap #1 in knight-research/kaizo-mod/
// ORACLE-GROUND-TRUTH.md. Every crescent row in the deep recording carries
// `kaizo_atk = atk_Vortex1` and `kaizo_playing = atk_CrescentSlash`; grouping
// by the wrong column attributes this whole turn to the Vortex.

import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  resolveTraces, readTrace, recoverLaunches, detectRoute,
} from './check-oracle-schedule.mjs';
import { createState, stepFrame } from '../../../sim/index.js';
import { spawn, destroy } from '../../../sim/entity.js';
import { gmlCreate } from '../../../sim/rng.js';
import { real } from '../../../sim/trace.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
// THE MODULE UNDER TEST, and the vanilla one it replaces — imported side by
// side so section 2b can drive both.
import {
  crescentGenerator as kaizoCrescentGenerator,
  knightCrescent as kaizoKnightCrescent,
  launchKaizoSwordslash,
} from '../../attacks/crescent-slash.js';
import {
  crescentGenerator as vanillaCrescentGenerator,
  knightCrescent as vanillaKnightCrescent,
} from '../../../sim/attacks/swordslash.js';

const ENTRY = 'atk_CrescentSlash';

// The object names the recorder is DEMONSTRABLY able to log. Not the patch's
// declared list — the names that actually appear in the recording, which is
// the only thing that proves the instrument could have produced a positive
// result for them. CLAUDE.md / ORACLE-GROUND-TRUTH: "a negative result is only
// evidence if the instrument could have produced a positive one", and this
// recording exists because two attacks once logged as empty when the watch
// list simply omitted their manager.
//
// Anything the sim creates OUTSIDE this set (obj_lerpvar, obj_shake,
// obj_afterimage_grow, obj_tracking_sword_slash_extra_graze) is not evidence
// either way and is deliberately excluded rather than reported as an extra.
let VISIBLE = new Set();

let checks = 0;
let failures = 0;
const notes = [];

function ok(cond, msg) {
  checks += 1;
  if (cond) {
    console.log(`  ok   ${msg}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${msg}`);
  }
}
function note(msg) { notes.push(msg); }

/** GML `string_format(v, 0, 10)`, via sim/trace.js — round-half-to-EVEN. */
const fmt = (v) => real(v);
const uniq = (xs) => [...new Set(xs)];
const sortNum = (xs) => [...xs].sort((a, b) => a - b);
const diffs = (xs) => xs.slice(1).map((v, i) => v - xs[i]);

// ══════════════════════════════════════════════════════════════════════════
// 0. THE RECORDING
// ══════════════════════════════════════════════════════════════════════════

function skip(lines) {
  console.log(`SKIP check-oracle-crescent: ${lines[0]}`);
  for (const l of lines.slice(1)) console.log(`     ${l}`);
  console.log('     NOTHING INSIDE atk_CrescentSlash IS HELD AGAINST THE REAL MOD WITHOUT IT.');
  return 0;
}

/**
 * The trace + seq pair with the MOST rows for this entry.
 *
 * Not "the longest recording" (check-oracle-schedule's rule, correct for a
 * schedule claim) and not "the first found": a MODE 1 lock on some other entry
 * is a perfectly good recording that contains none of this attack, and a check
 * that picked it would report a scary empty ledger about a recording that was
 * never going to have one. The seq log is REQUIRED — the frame trace carries
 * no spawn rows at all, so a directory with traces and no seq files is a loud
 * skip rather than a silent pass.
 */
function resolveCrescent() {
  const { dir, found, looked } = resolveTraces();
  if (!dir) {
    return {
      skip: [
        'no kaizo oracle recording found',
        ...(looked ?? []).map((l) => `looked in ${l}`),
        'Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,',
        'or point KAIZO_ORACLE_TRACES at the directory.',
      ],
    };
  }
  const cands = [];
  for (const f of found) {
    const tracePath = join(dir, f);
    const seqPath = join(dir, basename(f).replace('_trace', '_seq'));
    if (!existsSync(seqPath)) continue;
    const seq = readTrace(seqPath);
    if (seq.col.kaizo_playing === undefined) continue; // pre-kaizo_playing
    const n = seq.rows.filter((r) => r[seq.col.kaizo_playing] === ENTRY).length;
    if (n) cands.push({ tracePath, seqPath, seq, n });
  }
  if (!cands.length) {
    return {
      skip: [
        `no recording in ${dir} contains a spawn log for ${ENTRY}`,
        `traces present: ${found.join(', ')}`,
        'This check needs the companion kaizo_oracle_seq_*.csv (the SPAWN log)',
        'with a kaizo_playing column, from a MODE 0 run long enough to reach',
        "phase 1's second entry.",
      ],
    };
  }
  cands.sort((a, b) => b.n - a.n);
  return cands[0];
}

const picked = resolveCrescent();
if (picked.skip) {
  process.exit(skip(picked.skip));
}

const { tracePath, seqPath, seq } = picked;
const trace = readTrace(tracePath);
const tcol = trace.col;
const scol = seq.col;

// Every object name that appears ANYWHERE in this recording — the instrument's
// demonstrated coverage.
VISIBLE = new Set(seq.rows.map((r) => r[scol.object]));

// The launch frame: the first row of the frame trace whose kaizo_playing IS
// this entry. kaizo_playing is kaizo_prevatk, set by the mod at the dispatch,
// so its first frame IS the launch frame — the same frame check-oracle-schedule
// recovers as the launch.
const launchRow = trace.rows.find((r) => r[tcol.kaizo_playing] === ENTRY);
if (!launchRow) {
  process.exit(skip([
    `${basename(tracePath)} has spawn rows for ${ENTRY} but no frame rows`,
    'the two recordings are from different runs — re-record both together',
  ]));
}
const oLaunch = Number(launchRow[tcol.frame]);
const ttAt = new Map(trace.rows.map((r) => [Number(r[tcol.frame]), Number(r[tcol.turntimer])]));
const boxYsAtLaunch = launchRow[tcol.gt_ys];

/** The oracle's spawn rows for this entry, as {rel, name, x, y, ...}. */
const oracle = seq.rows
  .filter((r) => r[scol.kaizo_playing] === ENTRY)
  .map((r) => ({
    frame: Number(r[scol.frame]),
    rel: Number(r[scol.frame]) - oLaunch,
    name: r[scol.object],
    x: Number(r[scol.x]),
    y: Number(r[scol.y]),
    angle: Number(r[scol.angle]),
    xscale: Number(r[scol.xscale]),
    yscale: Number(r[scol.yscale]),
    direction: Number(r[scol.direction]),
    speed: Number(r[scol.speed]),
    // The raw strings, so a comparison is text-against-text at the recorder's
    // own precision rather than float-against-float (CLAUDE.md, "Trace format").
    sx: r[scol.x],
    sy: r[scol.y],
    sangle: r[scol.angle],
    sxs: r[scol.xscale],
    sys: r[scol.yscale],
    sdir: r[scol.direction],
    sspd: r[scol.speed],
  }));

const GEN = 'obj_bullet_knight_crescentGenerator';
const CRESC = 'obj_bullet_knightcrescent';
const SLASH = 'obj_knight_crescentslash_slashinganimation';
const MARKER = 'obj_marker';
const WARP = 'obj_knight_warp';
const TSMAN = 'obj_tracking_swords_manager';
const TSWORD = 'obj_tracking_sword1';
const TSLASH = 'obj_tracking_sword_slash';
const AFTER = 'obj_afterimage';

const groupBy = (rows) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.name)) m.set(r.name, []);
    m.get(r.name).push(r);
  }
  for (const v of m.values()) v.sort((a, b) => a.rel - b.rel);
  return m;
};
const oByName = groupBy(oracle);

/** Waves: each slash animation and everything spawned before the next one. */
function waves(rows) {
  const slashes = rows.filter((r) => r.name === SLASH).sort((a, b) => a.rel - b.rel);
  return slashes.map((s, i) => {
    const next = slashes[i + 1]?.rel ?? Infinity;
    const within = (n) => rows.filter((r) => r.name === n && r.rel >= s.rel && r.rel < next);
    return { slash: s, markers: within(MARKER), crescents: within(CRESC) };
  });
}
const oWaves = waves(oracle);

// ── WHICH ROUTE IS THIS? ───────────────────────────────────────────────────
//
// atk_CrescentSlash dispatches ac 0 / difficulty 0 / phase 1 on BOTH routes
// (kaizo/versions/vc-script.js, VC_TABLE and VD_TABLE carry the row verbatim),
// so it is not one of check-oracle-schedule's three discriminators and the
// entry itself says nothing about the route. The RECORDING does, through those
// discriminators, and it has to be said out loud because THIS CHECK DRIVES A
// ROUTE-C SIM UNCONDITIONALLY (section 2, `version: 'C'`).
//
// MEASURED, on kaizo_oracle_{trace,seq}_sideb.csv: the B-Side's crescent turn
// is NOT the same turn. Three structural facts of this file do not survive it,
// and none of them is the mod disagreeing with the sim — they are this check's
// own shape assuming route C:
//
//   * the ac-0 arm's second controller makes SIX obj_tracking_sword1 there
//     against route C's four, at a different x (the sim's route-C walk makes
//     four, and a `version: 'D'` walk makes seven — wrong in both directions,
//     so the B-Side tracking-swords arm is untranslated, not misconfigured);
//   * the wave shape is not uniform (crescents land at +4 AND +3), so
//     section 5's `oCresD.length === 1` is false of the recording itself;
//   * the last wave fires at turntimer 49.63, i.e. BELOW section 6's gate.
//
// So a B-Side recording is not evidence this file can read yet. It is reported
// here rather than skipped: the section-7 result below is route-independent
// (it is sourced from the mod's GML, not from any recording) and stays
// meaningful. See nextSteps — B-Side support is a separate piece of work that
// needs the tracking-swords module, which this cluster does not own.
const routeInfo = (() => {
  try { return detectRoute(recoverLaunches(trace)); } catch { return { route: null }; }
})();

// ── THE MEASURED LEDGER, printed whether or not anything passes ────────────
console.log(`check-oracle-crescent: ${basename(tracePath)} + ${basename(seqPath)}`);
console.log(`  route ${routeInfo.route ?? (routeInfo.ambiguous ? 'AMBIGUOUS' : 'UNDETERMINED')}`
  + ` (evidence: ${(routeInfo.evidence ?? []).join(', ') || 'none — no discriminator entry'})`);
if (routeInfo.route === 'D') {
  console.log('  !! B-SIDE RECORDING, ROUTE-C SIM. This check is route-C only; the');
  console.log('     tracking-sword counts, the wave shape and the section-6 gate all');
  console.log('     differ on the B-Side and their failures below measure THIS FILE,');
  console.log('     not the recreation. Section 7 (sourced from the GML) still holds.');
}
console.log(`  ${ENTRY} launched at f${oLaunch} (grouped by kaizo_playing, never kaizo_atk)`);
console.log(`  box at the launch frame: gt_ys ${boxYsAtLaunch} — the grow-in is STILL RUNNING`);
console.log('  THE ORACLE SPAWN LEDGER for this turn:');
for (const [name, rs] of [...oByName.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const f = (k) => uniq(rs.map((r) => r[k]));
  const brief = (k) => {
    const u = sortNum(f(k));
    return u.length <= 6 ? `[${u.map((v) => Number(v.toFixed(4))).join(' ')}]`
      : `${u.length} values ${Number(u[0].toFixed(4))}..${Number(u[u.length - 1].toFixed(4))}`;
  };
  console.log(`    ${name.padEnd(46)} x${String(rs.length).padStart(4)}`
    + `  rel ${rs[0].rel}..${rs[rs.length - 1].rel}`);
  if (name !== AFTER) {
    console.log(`      x ${brief('x')}  y ${brief('y')}  angle ${brief('angle')}`);
    console.log(`      scale ${brief('xscale')} x ${brief('yscale')}`
      + `  dir ${brief('direction')}  speed ${brief('speed')}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 1. THE ORACLE LEDGER IS WELL FORMED — a positive assertion about the
//    INSTRUMENT, before a single sim number is compared. If the recording is
//    degenerate, everything below would "agree" with nothing.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n1. the recording is usable evidence');
ok(oracle.length > 0, `the recording carries ${oracle.length} spawn rows for ${ENTRY}`);
ok(oWaves.length >= 10,
  `it captured ${oWaves.length} complete waves (a turn's worth, not a fragment)`);
for (const n of [GEN, CRESC, SLASH, MARKER, WARP, TSMAN, TSWORD, TSLASH, AFTER]) {
  ok(oByName.has(n), `the recorder saw ${n} (it could have produced a positive result)`);
}
ok(oByName.get(GEN).length === 1,
  'exactly ONE crescent generator — type 109 creates it once, under `if (!made)`');

// THE SIX LANES, derived from the recording rather than from the model.
// obj_knight_crescentslash_slashinganimation is created at (gen.x + 12,
// gen.y + 18), so every recorded slash y is a lane + 18. The generator's own
// y is only ever a lane (its movecon lerp targets ypos[...]), so this recovers
// the lane table with no arithmetic from the sim side at all.
const oLanes = sortNum(uniq(oByName.get(SLASH).map((r) => r.y - 18)));
const laneGaps = uniq(diffs(oLanes));
console.log(`  lanes recovered from the recording: [${oLanes.join(' ')}]`);
ok(oLanes.length === 6, `six lanes (yposcount = 6): ${oLanes.length} distinct`);
ok(laneGaps.length === 1 && laneGaps[0] === 20,
  `the lanes are evenly spaced 20px apart (gaps ${laneGaps.join(',')})`);
// ypos[i] = (box.y - H/2) + (H / (yposcount + 1)) * (i + 1), box.y = 170 and
// yposcount = 6, so a 20px gap means H = 140 EXACTLY. `boxheight` is
// `box.sprite_height` = 75 * image_yscale, so the generator read the board at
// image_yscale 1.8666667 — the FOURTEENTH of the grow-in's fifteen frames, one
// frame before the board reaches its full 2. This is the sharpest number in
// the whole family: 13 grow-frames would give 130 and 18.571px lanes, 15 would
// give 150 and 21.43px lanes, and the recording admits neither.
const oBoxheight = laneGaps[0] * 7;
ok(oBoxheight === 140,
  `so obj_growtangle.sprite_height was ${oBoxheight} when the generator read it`
  + ' (75 * 1.8666667 — the board was one frame short of full)');

// ══════════════════════════════════════════════════════════════════════════
// 2. THE SIM — the REAL V-C scene, walked to this entry's turn.
//
//    Not a hand-built bench. The lane table above is decided by WHEN the
//    generator reads the board during the 15-frame grow-in, which is decided
//    by the turn director's rtimer window; a bench that opens the arena and
//    launches by hand is testing the bench's alignment, not the sim's. So this
//    runs kaizo/scenes/kaizo-fight.js's own scene and lets its director place
//    the board and fire the dispatch.
// ══════════════════════════════════════════════════════════════════════════

const idle = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};
/** Pulse CONFIRM only while a menu or dialogue is asking — the idiom
 *  check-weirdroute uses to walk the chain without steering the soul. */
function makeMenuInput() {
  let pulse = false;
  return (state) => {
    if (!state.menu?.open && !state.dialogue?.text && !state.pendingAct) return idle;
    pulse = !pulse;
    return { ...idle, confirm: pulse };
  };
}

/**
 * THE ROUTING EDIT, APPLIED FROM HERE UNTIL THE LAUNCHER CARRIES IT.
 *
 * kaizo/scenes/kaizo-mod-launcher.js case 109 still calls the VANILLA
 * `launchSwordslash`, and that file belongs to the integration pass. The two
 * launch functions are line-for-line identical — the mod's dbulletcontroller
 * type-109 block is byte-identical to vanilla's (kaizo Step_0:2307-2326 against
 * vanilla's 2233-2252) — and the two generator `create`s differ in exactly one
 * field, which section 2b asserts rather than asserting here. So "spawn the
 * vanilla generator, then point it at the kaizo type and set the one field the
 * kaizo Create would have set" IS the routing edit, executed one instant later.
 *
 * ONE SWAP CARRIES THE WHOLE FAMILY. The generator's `firePair` and its
 * `createslash` both spawn from their own module's bindings, so a generator
 * holding the kaizo type produces kaizo crescents, kaizo slash animations and
 * kaizo markers. Nothing else needs substituting.
 *
 * IT RUNS BEFORE THE GENERATOR'S FIRST STEP. sim/entity.js freezes the entity
 * list at the start of each phase, so an entity created during the launcher's
 * dispatch does not step on the frame it was made; this is called immediately
 * after that frame's `stepFrame` returns, so no vanilla Step has run.
 *
 * IDEMPOTENT ON PURPOSE. Once the launcher import is swapped this finds the
 * kaizo type already in place and does nothing. The counts are returned and
 * asserted on, so "the swap never ran" cannot pass as "the swap was
 * unnecessary".
 *
 * `seenGens` makes the counts PER GENERATOR rather than per frame: this is
 * called on every one of ~300 frames, and without it a landed launcher edit
 * would report `already` in the hundreds and the section-2c pairing assertion
 * would be comparing a frame count to a routing decision.
 */
function substituteType109(st, seenGens) {
  let swapped = 0;
  let already = 0;
  for (const e of st.entities) {
    if (!e.alive || e.type.name !== 'obj_bullet_knight_crescentGenerator') continue;
    if (seenGens.has(e)) continue;
    seenGens.add(e);
    if (e.type === kaizoCrescentGenerator) { already += 1; continue; }
    e.type = kaizoCrescentGenerator;
    // The single field the kaizo Create adds (see section 2b). Its Step
    // overwrites it with 153 on its first line anyway; it is set here so the
    // instance is byte-for-byte what the launcher's own `spawn()` would have
    // produced, rather than nearly so.
    e.damage = 0;
    swapped += 1;
  }
  return { swapped, already };
}

/**
 * Walk the V-C scene to the ac-0 / phase-1 turn and record every spawn, with
 * frames relative to the launch — measured exactly as the recorder measures:
 * one sample per frame, AFTER the frame has run, first sighting wins.
 *
 * ── THE BASELINE IS THE ARM FRAME, NOT THE LEDGER FRAME ───────────────────
 *
 * The oracle side takes `oLaunch` from the first trace row whose
 * `kaizo_playing` is this entry — the mod's own POINTER FLIP, which happens
 * when the knight's rtimer hits 12 and scr_turntimer arms the clock. The sim's
 * `state.kaizo.launched` ledger is pushed by the director on the NEXT frame,
 * and kaizo-trace.mjs says so where it derives the same thing: "the pointer
 * flips there and not at the ledger's launch ... every flip must be followed,
 * one frame later, by exactly one new state.kaizo.launched entry".
 *
 * This walk used to baseline on the ledger frame, so every `rel` it produced
 * was one too small. That went unnoticed because the module under test had a
 * compensating one-frame bug (a bare `return` standing in for the generator
 * Step's `if (init)` guard, which cost it an extra Step before its clock
 * started). Two off-by-ones, opposite signs, and the wave train landed on the
 * recorded offsets for the wrong reason — the shape check-oracle-crescent's
 * own NOTE flagged as "a cancellation and not a coincidence worth relying on".
 * Fixing the module in kaizo/attacks/crescent-slash.js exposed this half.
 *
 * The correction is MEASURED, not asserted by fiat: `armAlignment` below
 * carries the sim's turn clock and board scale on the arm frame, and section 2
 * checks them against the recording's own launch row. Both are bit-identical
 * (turntimer 299, gt_ys 1.4666666985), which is what makes "the arm frame is
 * the recording's launch frame" a receipt rather than a convention.
 */
function walkToCrescent({ seed = 12345, budget = 6000, after = 420 } = {}) {
  const st = createState({ seed, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: 'C' });
  const input = makeMenuInput();
  const seen = new Set();
  const seenGens = new Set();
  const sightings = [];
  const routed = { swapped: 0, already: 0 };
  let launchFrame = -1;
  let launched = 0;
  let gen = null;
  let boxYsAtLaunchSim = null;
  let ttAtLaunchSim = null;
  // The previous frame's post-step board and clock, so the arm frame's values
  // are still in hand when the ledger names the entry a frame later.
  let prevYs = null;
  let prevTt = null;

  for (let f = 0; f < budget; f++) {
    stepFrame(st, input(st));
    // The pending routing edit, before anything reads the generator or its
    // spawns — including this loop's own first-sighting ledger below.
    {
      const r = substituteType109(st, seenGens);
      routed.swapped += r.swapped;
      routed.already += r.already;
    }
    // Keep the run alive; this check is about spawn geometry, not survival.
    // Same device check-weirdroute's chain walk uses.
    st.partyHp = st.partyHp.map(() => 100);
    st.gameOver = false;

    if (st.kaizo.launched.length !== launched) {
      launched = st.kaizo.launched.length;
      const row = st.kaizo.launched[launched - 1];
      if (launchFrame < 0 && row.ac === 0 && row.phase === 1) {
        // ONE FRAME BACK — see the header. The ledger row is the launch; the
        // arm is the frame before it, and that is what the recording calls f0.
        launchFrame = f - 1;
        boxYsAtLaunchSim = prevYs;
        ttAtLaunchSim = prevTt;
      } else if (launchFrame >= 0) {
        break; // the next entry took over
      }
    }
    // FIRST SIGHTINGS ARE COLLECTED FROM FRAME ZERO, with the absolute frame,
    // and rebased at the end. The baseline is only known one frame after the
    // arm, so a ledger gated on `launchFrame >= 0` would drop anything the arm
    // frame itself created. Rows before the baseline are dropped below, which
    // is exactly what the oracle side's `kaizo_playing` filter does.
    for (const e of st.entities) {
      if (!e.alive || seen.has(e)) continue;
      seen.add(e);
      sightings.push({
        f,
        name: e.type.name,
        x: e.x, y: e.y, angle: e.image_angle,
        xscale: e.image_xscale, yscale: e.image_yscale,
        direction: e.direction, speed: e.speed,
        damage: e.damage,
      });
    }
    {
      const gt = st.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
      prevYs = gt ? gt.image_yscale : null;
      prevTt = st.turntimer;
    }
    if (launchFrame >= 0) {
      gen = gen ?? st.entities.find((e) => e.alive && e.type.name === GEN);
      if (f - launchFrame >= after) break;
    }
  }
  const rows = launchFrame < 0 ? [] : sightings
    .filter((s) => s.f >= launchFrame)
    .map(({ f, ...rest }) => ({ rel: f - launchFrame, ...rest }));
  return { st, rows, launchFrame, gen, boxYsAtLaunchSim, ttAtLaunchSim, routed };
}

console.log('\n2. the sim ran this entry (positive execution)');
const run = walkToCrescent();
ok(run.launchFrame >= 0,
  `the V-C scene launched ac 0 / phase 1 inside its frame budget (f${run.launchFrame})`);
if (run.launchFrame < 0) {
  console.log('  the sim never reached the entry — nothing below could have compared anything');
  process.exit(1);
}
const sim = run.rows.filter((r) => VISIBLE.has(r.name));
const sByName = groupBy(sim);
const sWaves = waves(sim);
ok(sim.length > 0,
  `the turn produced ${sim.length} recorder-visible spawn rows`
  + ` (${run.rows.length} total, ${run.rows.length - sim.length} outside the watch list)`);
ok(!!run.gen, 'the type-109 branch created a crescent generator');
ok(sWaves.length >= 10, `the sim ran ${sWaves.length} complete waves`);

// ── THE BASELINE RECEIPT ──────────────────────────────────────────────────
// Every `rel` below is a difference of two frame numbers measured on two
// different clocks, so the two zeroes have to be shown to be the same instant
// rather than assumed to be. walkToCrescent baselines on the director's ARM
// frame (the pointer flip), one before the launch ledger; the recording
// baselines on the first `kaizo_playing` row. If those are the same instant,
// then the two quantities the turn resets on it — the arm's own turn clock and
// the board's grow-in phase — read the same on both sides.
//
// They do, to the last digit, which is what licenses every offset in sections
// 3-6. It is asserted rather than noted because the previous version of this
// walk baselined one frame late, and the only thing that flagged it was a
// printed NOTE nobody could act on.
ok(fmt(run.ttAtLaunchSim) === fmt(ttAt.get(oLaunch)),
  `the sim's baseline frame arms the same turn clock as the recording's launch`
  + ` row (sim ${fmt(run.ttAtLaunchSim)}, mod ${fmt(ttAt.get(oLaunch))})`);
ok(fmt(run.boxYsAtLaunchSim) === boxYsAtLaunch,
  'and its board is at the same point of the 15-frame grow-in'
  + ` (sim gt_ys ${fmt(run.boxYsAtLaunchSim)}, mod ${boxYsAtLaunch})`);

// ══════════════════════════════════════════════════════════════════════════
// 2b. THE MINIMAL SWAP *IS* THE ROUTING EDIT — proved, not argued.
//
//     substituteType109 reassigns `e.type` and sets one field instead of
//     re-running the kaizo Create over the instance. That is only legitimate
//     if the two Creates agree everywhere else, which is a claim about two
//     functions and can therefore be MEASURED rather than reasoned about:
//     run both over bare objects and diff the field sets. The kaizo Create is
//     allowed to add exactly `damage` (kaizo/attacks/crescent-slash.js — the
//     mod's Step writes it from line 1 and this engine needs the field to
//     exist first); anything else means this file is standing in for an edit
//     that is not the edit the launcher will make.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n2b. the substitution reproduces the kaizo Create exactly');
{
  const probe = (t) => { const o = {}; t.create(o, {}); return o; };
  const v = probe(vanillaCrescentGenerator);
  const k = probe(kaizoCrescentGenerator);
  const added = Object.keys(k).filter((key) => !(key in v));
  const removed = Object.keys(v).filter((key) => !(key in k));
  const changed = Object.keys(v).filter((key) => key in k
    && JSON.stringify(v[key]) !== JSON.stringify(k[key]));
  ok(Object.keys(v).length > 20,
    `the probe actually ran a Create (${Object.keys(v).length} fields) — not an empty diff`);
  ok(added.join(',') === 'damage',
    `the kaizo Create adds exactly one field, \`damage\` (added: [${added.join(' ')}])`);
  ok(removed.length === 0 && changed.length === 0,
    'and changes nothing else'
    + `${removed.length ? ` — REMOVED [${removed.join(' ')}]` : ''}`
    + `${changed.length ? ` — CHANGED [${changed.join(' ')}]` : ''}`);
  ok(k.damage === 0,
    `the field the substitution sets by hand matches the Create's value (${k.damage})`);
  // The launch function is the other half of the routing edit, and the mod's
  // dbulletcontroller type-109 block is byte-identical to vanilla's, so it has
  // to build the same two variants: difficulty 0 -> variant 2 (the Create's own
  // second assignment) and difficulty 1 -> variant 3.
  const bench = () => {
    const s = createState({ seed: 1, traceBulletSlots: 0 });
    s.view = { x: 0, y: 0 };
    s.entities = [];
    s.kaizo = { approx: [], launched: [] };
    return s;
  };
  const v0 = launchKaizoSwordslash(bench(), 0);
  const v1 = launchKaizoSwordslash(bench(), 1);
  ok(v0.variant === 2 && v1.variant === 3,
    `launchKaizoSwordslash builds the mod's two variants (d0 -> ${v0.variant},`
    + ` d1 -> ${v1.variant}) — the same pair SUPPORTED[109] = [0, 1] promises`);
  ok(v0.type === kaizoCrescentGenerator,
    'and it builds the KAIZO generator, so the launcher edit needs no second change');
}

// ══════════════════════════════════════════════════════════════════════════
// 2c. THE TWO HALVES OF THE ROUTING EDIT MUST LAND TOGETHER.
//
//     kaizo-mod-launcher.js ledgers type 109 in VANILLA_BODIES — "the mod's
//     CrescentSlash body is not translated; the arm reaches the vanilla
//     swordslash". That row is now a statement about the launcher's IMPORT,
//     not about the body: the body is translated, in
//     kaizo/attacks/crescent-slash.js, and substituteType109 is standing in
//     for the one-line routing swap.
//
//     So the row is admitted — and ONLY that row, and ONLY while the
//     substitution actually fired. The moment the launcher imports
//     `launchKaizoSwordslash`, `routed.swapped` is 0, the ledger row has to be
//     gone, and the VANILLA_BODIES entry must be deleted in the same edit or
//     this fails. That pairing is what stops one half from landing alone.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n2c. the pending routing edit is ledgered exactly while it is pending');
{
  const { swapped, already } = run.routed;
  ok(swapped + already === 1,
    `exactly one crescent generator was routed this turn (${swapped} swapped,`
    + ` ${already} already kaizo)`);
  if (already) {
    note('kaizo-mod-launcher.js case 109 ALREADY routes to the kaizo module —'
      + ' substituteType109 found nothing to do and can be deleted from this file.');
  } else {
    note('kaizo-mod-launcher.js case 109 still imports launchSwordslash from'
      + ' sim/attacks/swordslash.js; substituteType109 is standing in for'
      + " `import { launchKaizoSwordslash } from '../attacks/crescent-slash.js';`"
      + ' and `case 109: return launchKaizoSwordslash(state, difficulty);`.');
  }
  const pending = run.st.kaizo.approx.filter(
    (a) => a.type === 109 && a.asked === 'type 109 body',
  );
  const other109 = run.st.kaizo.approx.filter(
    (a) => a.type === 109 && a.asked !== 'type 109 body',
  );
  ok(pending.length === (swapped ? 1 : 0),
    "the launcher's pending type-109 body ledger row is present exactly while"
    + ` substituteType109 is standing in (swapped ${swapped},`
    + ` ledger rows ${pending.length})`);
  ok(other109.length === 0,
    'and no type-109 DIFFICULTY was clamped — the arm ran as the mod wrote it'
    + `${other109.length ? ` (${JSON.stringify(other109)})` : ''}`);
}

// ══════════════════════════════════════════════════════════════════════════
// 3. THE OBJECT SET AND THE LANES
// ══════════════════════════════════════════════════════════════════════════
console.log('\n3. the object set and the six lanes');
{
  const oSet = [...oByName.keys()].sort();
  const sSet = [...sByName.keys()].sort();
  ok(oSet.join(',') === sSet.join(','),
    `the same recorder-visible object set\n       oracle ${oSet.join(' ')}\n       sim    ${sSet.join(' ')}`);

  const sLanes = sortNum(uniq(sByName.get(SLASH).map((r) => r.y - 18)));
  ok(sLanes.every((v) => oLanes.includes(v)),
    `every sim lane is one of the recorded six [${sLanes.join(' ')}]`);
  ok(sLanes.length >= 4,
    `and the sim visited ${sLanes.length} distinct lanes, so that is not vacuous`);
  // The generator's own table, compared through the f32 narrowing every
  // built-in position takes on store (CLAUDE.md, "Float32 built-ins"): the
  // model computes 119.99999978712627 and the game stores 120.
  const genLanes = (run.gen?.ypos ?? []).map((v) => Math.fround(v));
  ok(genLanes.length === 6 && genLanes.every((v, i) => v === oLanes[i]),
    `the generator's ypos table IS the recorded lane table [${genLanes.join(' ')}]`);
  ok(Math.round(run.gen?.boxheight ?? 0) === oBoxheight,
    `and it read boxheight ${run.gen?.boxheight} against the recording's ${oBoxheight}`);
}

// ══════════════════════════════════════════════════════════════════════════
// 4. PER-TYPE GEOMETRY — every asserted value comes off a recorded row.
//
//    Fields are compared as the recorder's own text (string_format(v, 0, 10),
//    round-half-to-even) rather than as floats, so an f32 position matches
//    digit for digit or fails: 478.6499938965 is the crescent's x after ONE
//    frame of `hspeed = -1` with `friction = -0.35`, and 478.65 is not.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n4. per-type spawn geometry');

/**
 * Assert that every sim row of `name` matches the recording on `fields`,
 * comparing SETS of formatted values (order is RNG, membership is not).
 */
function sameFieldSets(name, fields) {
  const os = oByName.get(name) ?? [];
  const ss = sByName.get(name) ?? [];
  ok(os.length > 0 && ss.length > 0,
    `${name}: both sides created some (oracle ${os.length}, sim ${ss.length})`);
  for (const [field, raw] of fields) {
    const want = uniq(os.map((r) => r[raw])).sort();
    const got = uniq(ss.map((r) => fmt(r[field]))).sort();
    ok(got.length > 0 && got.every((v) => want.includes(v)),
      `${name}.${field}: every sim value is one the mod produced`
      + `\n       mod [${want.join(' ')}]\n       sim [${got.join(' ')}]`);
  }
}

// ── the generator: created by type 109 at (camerax() + 480, cameray() + 160)
sameFieldSets(GEN, [['x', 'sx'], ['y', 'sy'], ['xscale', 'sxs'], ['yscale', 'sys'],
  ['speed', 'sspd']]);
ok((sByName.get(GEN) ?? []).length === 1, 'exactly one generator in the sim too');

// ── the crescents: a mirrored pair at the generator's y +-5, thrown left on
//    `hspeed = -1` with NEGATIVE friction -0.35, so the first logged frame
//    already reads speed 1.35 and x 480 - 1.35.
sameFieldSets(CRESC, [['x', 'sx'], ['y', 'sy'], ['angle', 'sangle'],
  ['xscale', 'sxs'], ['yscale', 'sys'], ['direction', 'sdir'], ['speed', 'sspd']]);
{
  const oy = sortNum(uniq(oByName.get(CRESC).map((r) => r.y)));
  ok(oy.length === 12 && oLanes.every((l) => oy.includes(l - 5) && oy.includes(l + 5)),
    'the mod\'s crescent y values are exactly lane +-5, twelve of them');
  const sy = sortNum(uniq((sByName.get(CRESC) ?? []).map((r) => r.y)));
  ok(sy.every((v) => oy.includes(v)), `the sim's crescent y values are the same lane +-5 set`);
}


// ── the markers: scr_dark_marker(x - 12, y - 18) off the slash animation, so
//    they start at the GENERATOR's own x, with `hspeed = 2` and gravity -+0.5.
//    One frame of movement is already in the logged row: x 482, y lane -+0.5,
//    speed sqrt(2^2 + 0.5^2), direction +-14.0362434387.
sameFieldSets(MARKER, [['x', 'sx'], ['y', 'sy'], ['angle', 'sangle'],
  ['xscale', 'sxs'], ['yscale', 'sys'], ['direction', 'sdir'], ['speed', 'sspd']]);

// ── the slash animation: instance_create(x + 12, y + 18), still, unrotated.
sameFieldSets(SLASH, [['x', 'sx'], ['y', 'sy'], ['angle', 'sangle'],
  ['xscale', 'sxs'], ['yscale', 'sys'], ['direction', 'sdir'], ['speed', 'sspd']]);

// ── the Knight's warp: `with (creatorid) instance_create_depth(x, y, ...)` on
//    the way out, and the generator's CleanUp on the way back. TWO, both at
//    the Knight's own x.
{
  const ow = oByName.get(WARP);
  const sw = sByName.get(WARP) ?? [];
  ok(ow.length === 2, `the mod warps the Knight twice this turn (out, then back)`);
  ok(sw.length === 2, `and the sim warps him twice (${sw.length})`);
  ok(sw.every((r) => fmt(r.x) === ow[0].sx),
    `both sim warps sit at the Knight's x ${ow[0].sx}`);
}

// ── the second controller: `dc.type = 151, dc.difficulty = 6, dc.damage = 153`
//    in the same ac-0 arm. Its manager and its swords are the recorder's proof
//    that ac 0 dispatches TWO controllers, not one.
sameFieldSets(TSMAN, [['x', 'sx'], ['y', 'sy']]);
{
  const os = oByName.get(TSWORD);
  const ss = sByName.get(TSWORD) ?? [];
  ok(ss.length === os.length,
    `${TSWORD}: ${os.length} in the mod, ${ss.length} in the sim`);
  sameFieldSets(TSWORD, [['x', 'sx'], ['angle', 'sangle'], ['xscale', 'sxs'],
    ['yscale', 'sys'], ['direction', 'sdir'], ['speed', 'sspd']]);
  const ots = oByName.get(TSLASH);
  const sts = sByName.get(TSLASH) ?? [];
  ok(sts.length === ots.length,
    `${TSLASH}: ${ots.length} in the mod, ${sts.length} in the sim`);
  sameFieldSets(TSLASH, [['x', 'sx'], ['xscale', 'sxs'], ['yscale', 'sys']]);
}

// ── the rainbow trail: presence only, and said so out loud.
ok((sByName.get(AFTER) ?? []).length > 0,
  `obj_afterimage present in both (mod ${oByName.get(AFTER).length},`
  + ` sim ${(sByName.get(AFTER) ?? []).length}) — COUNT NOT COMPARED, it is the`
  + " Knight's RNG-driven trail and scales with the turn's length");

// ══════════════════════════════════════════════════════════════════════════
// 4a. THE CRESCENT'S DAMAGE — 153, from the mod's Create, NOT from the
//     recording.
//
//     PROVENANCE: gml_Object_obj_bullet_knightcrescent_Create_0.gml:2 reads
//     `damage = 153;` where vanilla's reads `damage = 206;`, and a diff of
//     that entry across the two dumps shows it is the file's ONLY difference.
//
//     WHY IT IS NOT MEASURED. The recorder pins party and boss HP to keep a
//     13,000-frame run alive, so every survival-shaped quantity in the
//     recording is a harness artifact — this check's own header says damage is
//     outside what it can measure, and that stands. What is asserted instead
//     is STRUCTURAL: the number the created bullet carries, read off the same
//     spawn ledger every other section reads.
//
//     WHY NOTHING CAUGHT THIS BEFORE. tools/verify-damage.mjs and
//     verify-kaizo §6 both test that no live bullet still holds
//     scr_bullet_init's PLACEHOLDER of 10. 206 and 153 pass that identically,
//     so a bullet running the wrong fight's damage was invisible to every
//     suite in the tree — the shape CLAUDE.md records under
//     "scr_bullet_inherit is how damage reaches a bullet", where a wrong
//     number does not look broken, it looks weak, and a human playing the
//     fight found the last one.
//
//     THE CONTROL MAKES IT DISCRIMINATING. A bare "every crescent holds 153"
//     would also pass if `damage` were undefined-and-coerced, or if the field
//     the ledger reads were the wrong one. So the VANILLA module's own
//     `knightCrescent` is spawned into the same state through the same
//     `spawn()` and must come back 206: the two modules are then shown to
//     disagree on exactly this field, and the assertion is known to be capable
//     of failing.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n4a. the crescent damage delta (source: the mod\'s Create event)');
{
  const cs = sByName.get(CRESC) ?? [];
  ok(cs.length >= 20,
    `the ledger holds ${cs.length} crescents to read damage off (not a vacuous set)`);
  const dmg = uniq(cs.map((r) => r.damage));
  ok(dmg.length === 1 && dmg[0] === 153,
    `every crescent the kaizo module fires carries damage 153 — the mod's`
    + ` Create_0:2 (sim values seen: [${dmg.join(' ')}])`);

  // The control, through the real spawn path in the real state.
  const probeK = spawn(run.st, kaizoKnightCrescent, { x: -9999, y: -9999 });
  const probeV = spawn(run.st, vanillaKnightCrescent, { x: -9999, y: -9999 });
  const [dk, dv] = [probeK.damage, probeV.damage];
  destroy(probeK);
  destroy(probeV);
  ok(dv === 206,
    `the VANILLA module spawned in the same state still carries 206 (${dv}) —`
    + ' so this field really is where the two disagree, and sim/attacks/'
    + 'swordslash.js is untouched by this cluster');
  ok(dk === 153 && dk !== dv,
    `and the kaizo module carries ${dk} through the same spawn path`);
}

// ══════════════════════════════════════════════════════════════════════════
// 5. GROUPING AND CADENCE — the shape of a wave, and the shape of the train.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n5. wave structure and cadence');
{
  const oGaps = uniq(diffs(oWaves.map((w) => w.slash.rel)));
  const sGaps = uniq(diffs(sWaves.map((w) => w.slash.rel)));
  ok(oGaps.length === 1 && oGaps[0] === 15,
    `the mod fires one wave every ${oGaps.join(',')} frames (shootrate 15)`);
  ok(sGaps.length === 1 && sGaps[0] === oGaps[0],
    `the sim's cadence is the same (gaps ${sGaps.join(',')})`);

  // Within a wave. The mod's order is telegraph, marker pair, crescent pair:
  //   shoottimer == shootrate - 4  ->  createslash
  //   +2 frames                    ->  the slash animation reaches image_index 1
  //                                    (image_speed 0.5) and throws the markers
  //   shoottimer >= shootrate      ->  the crescents
  const oMarkD = uniq(oWaves.flatMap((w) => w.markers.map((m) => m.rel - w.slash.rel)));
  const oCresD = uniq(oWaves.flatMap((w) => w.crescents.map((c) => c.rel - w.slash.rel)));
  const sMarkD = uniq(sWaves.flatMap((w) => w.markers.map((m) => m.rel - w.slash.rel)));
  const sCresD = uniq(sWaves.flatMap((w) => w.crescents.map((c) => c.rel - w.slash.rel)));
  ok(oMarkD.length === 1 && oCresD.length === 1,
    `in the mod every wave has the same internal shape`
    + ` (markers +${oMarkD.join(',')}, crescents +${oCresD.join(',')})`);
  ok(sCresD.length === 1 && sCresD[0] === oCresD[0],
    `crescents land ${oCresD[0]} frames after the telegraph in both`
    + ` (sim +${sCresD.join(',')})`);
  ok(sMarkD.length === 1 && sMarkD[0] === oMarkD[0],
    `the marker pair lands ${oMarkD[0]} frames after the telegraph in the mod;`
    + ` the sim puts it at +${sMarkD.join(',')}`);

  ok(oWaves.every((w) => w.markers.length === 2 && w.crescents.length === 2),
    'every recorded wave is exactly two markers and two crescents');
  ok(sWaves.every((w) => w.markers.length === 2 && w.crescents.length === 2),
    'every sim wave is exactly two markers and two crescents');
  const mirrored = (rs) => rs.length === 2
    && uniq(rs.map((r) => Math.sign(r.yscale))).length === 2;
  ok(oWaves.every((w) => mirrored(w.markers) && mirrored(w.crescents)),
    'and each pair is one blade and its mirror (image_yscale +-)');
  ok(sWaves.every((w) => mirrored(w.markers) && mirrored(w.crescents)),
    'the sim mirrors both pairs the same way');
  ok(sWaves.every((w) => uniq(w.crescents.map((c) => c.rel)).length === 1
      && uniq(w.markers.map((m) => m.rel)).length === 1),
    'both members of each sim pair spawn on ONE frame, as in the recording');

  // The train's offset from the launch frame. Comparable because both sides
  // count from their own dispatch and both run the generator's init on the
  // same schedule; the ABSOLUTE frames are not compared anywhere.
  ok(sWaves[0].slash.rel === oWaves[0].slash.rel,
    `the first telegraph is launch+${oWaves[0].slash.rel} in the mod`
    + ` and launch+${sWaves[0].slash.rel} in the sim`);
  ok(sWaves[0].crescents[0].rel === oWaves[0].crescents[0].rel,
    `the first crescent pair is launch+${oWaves[0].crescents[0].rel} in both`);

  // ── 5b. THE TELEGRAPH'S LIFETIME, counted in its own afterimages ────────
  //
  // The header says afterimage counts are PRESENCE ONLY, and for the Knight's
  // ~1800-instance rainbow trail that is right — it is RNG- and turn-length-
  // driven. This ONE afterimage stream is not that: the slash animation is
  // motionless, so every `fade = scr_afterimage()` its Step lays down sits at
  // the animation's exact spawn point, one per frame, and the run's LENGTH is a
  // pure statement about when the object stops stepping. Nothing else in the
  // turn stands at that coordinate (the markers go to x-12, y-18; the crescents
  // move).
  //
  // WHAT IT PINS. The Step opens `if (image_index > 7) { instance_destroy(); }`
  // — with no `exit`, and GameMaker's instance_destroy() does not end the
  // event. So the death frame still runs the rest of the Step and still lays
  // its afterimage: at image_speed 0.5 the object is born at rel R, first Steps
  // at R+1, passes 7 at R+15, and the stream is R+1..R+15 INCLUSIVE — fifteen,
  // not fourteen. A translation that returns after destroying lays fourteen.
  //
  // This is here because that bug SHIPPED and this check could not see it: the
  // whole-fight diff caught it as a population column one short on every
  // telegraph death frame (oracle 392 / 407 / 422), and nothing local failed.
  // A one-instance-per-frame stream is exactly the kind of afterimage the
  // "presence only" rule should not have covered.
  const streamAt = (rows, tele, next) => rows
    .filter((r) => r.name === 'obj_afterimage'
      && fmt(r.x) === fmt(tele.x) && fmt(r.y) === fmt(tele.y)
      && r.rel > tele.rel && r.rel < next)
    .map((r) => r.rel)
    .sort((a, b) => a - b);
  // Guarded: a later telegraph may land on the SAME lane as the first, and its
  // stream would be indistinguishable. Bound the window at the next telegraph
  // that reuses the coordinate rather than assuming none does.
  const nextSame = (rows, tele) => rows
    .filter((r) => r.name === SLASH && r.rel > tele.rel
      && fmt(r.x) === fmt(tele.x) && fmt(r.y) === fmt(tele.y))
    .map((r) => r.rel)
    .sort((a, b) => a - b)[0] ?? Infinity;
  const oTele = oWaves[0].slash;
  const sTele = sWaves[0].slash;
  const oStream = streamAt(oracle, oTele, nextSame(oracle, oTele));
  const sStream = streamAt(sim, sTele, nextSame(sim, sTele));
  ok(oStream.length === 15
    && oStream[0] === oTele.rel + 1
    && oStream[oStream.length - 1] === oTele.rel + 15,
    `the mod's first telegraph lays ${oStream.length} afterimages, launch+`
    + `${oStream[0]}..${oStream[oStream.length - 1]} — the LAST one on the frame`
    + ' image_index passes 7, because instance_destroy() does not end the event');
  ok(sStream.length === oStream.length
    && sStream[0] === oStream[0]
    && sStream[sStream.length - 1] === oStream[oStream.length - 1],
    `and the sim lays ${sStream.length}, launch+${sStream[0]}..`
    + `${sStream[sStream.length - 1]} — the same run, death frame included`);
}

// ══════════════════════════════════════════════════════════════════════════
// 6. THE FIRING GATE — why the two runs do not fire the same NUMBER of waves,
//    asserted as the rule rather than as the count.
//
//    `if (global.turntimer > 50) shoottimer++` ... `else if >= 20` ... else
//    destroy. So the last wave is the last one whose shot lands while the
//    clock is still over 50. Both sides are held to that; the counts are only
//    reported, because the recorder's clock is not a clean 1 per frame.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n6. the turntimer > 50 firing gate');
{
  const oLast = oWaves[oWaves.length - 1].crescents[0];
  const ttLast = ttAt.get(oLast.frame);
  const ttNext = ttAt.get(oLast.frame + 15);
  ok(ttLast !== undefined && ttLast > 50,
    `the mod's last wave fired at turntimer ${ttLast} (> 50)`);
  ok(ttNext !== undefined && ttNext <= 50,
    `and the slot 15 frames later was at ${ttNext} (<= 50), so there was no next wave`);

  // The sim's clock runs from the same armed floor (vcTurnLength ac 0 d0 = 300,
  // recorded as 299 at the launch frame in ORACLE-GROUND-TRUTH's turn-clock
  // table), one per frame. Same rule, more frames above 50.
  const sLast = sWaves[sWaves.length - 1].crescents[0];
  const ttSimLast = run.ttAtLaunchSim - sLast.rel;
  ok(ttSimLast > 50,
    `the sim's last wave fires at turntimer ~${ttSimLast} (> 50) — the same gate`);
  const drops = (() => {
    let odd = 0;
    let prev = null;
    for (const r of trace.rows) {
      const f = Number(r[tcol.frame]);
      if (f < oLaunch || f > oLast.frame + 60) continue;
      const tt = Number(r[tcol.turntimer]);
      if (prev !== null && Math.abs((prev - tt) - 1) > 1e-9) odd += 1;
      prev = tt;
    }
    return odd;
  })();
  console.log(`  wave count: mod ${oWaves.length}, sim ${sWaves.length} — NOT ASSERTED.`);
  console.log(`  The recorder's clock takes ${drops} non-unit decrements across this turn`);
  console.log('  (the largest is 12 units in one frame), so the mod had fewer frames');
  console.log('  above 50 than a clean clock gives. The GATE is the comparable thing.');
}

// ══════════════════════════════════════════════════════════════════════════
// 7. FROM THE DUMP, NOT THE RECORDING — a branch this recording never reaches.
//
//    PROVENANCE: gml_Object_obj_bullet_knight_crescentGenerator_Step_0.gml,
//    the con == 1 clock block. Diffing the mod's copy against the vanilla one
//    (knight-research/gml_dump/) shows the middle arm is a KAIZO ADDITION —
//    vanilla goes straight from `> 50` to `< 20 -> destroy`:
//
//        else if (global.turntimer >= 20) {
//            if (shoottimer >= (shootrate - 4)) shoottimer = shootrate;
//            else                               shoottimer = 0;
//        }
//
//    Read plainly: once the clock drops into [20, 50] the generator HONOURS A
//    TELEGRAPH IT HAS ALREADY DRAWN — a slash animation is on screen at
//    shoottimer 11, so the pair it promised still comes — and otherwise parks
//    shoottimer at 0. The recording's clock happened to cross 50 with
//    shoottimer at ~5, so it took the zeroing arm and this is invisible there.
//    That is exactly why it is asserted from the dump instead: a branch no
//    recording exercises is still a branch the player meets.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n7. the [20,50] telegraph-honouring arm (source: the mod\'s GML)');

// THIS SECTION WAS RED UNTIL 2026-08-29, and the record of why belongs next to
// it. Both assertions were always correct about EnderCat8's mod and NEITHER HAS
// BEEN WIDENED, reordered or removed; what changed is the module they measure.
//
//   Vanilla's clock block is `if (> 50) {shoottimer++; timer++} else if (< 20)
//   destroy`, with NO arm for [20,50]; the mod replaces the second arm with
//   `else if (>= 20) { shoottimer = (shoottimer >= shootrate - 4) ? shootrate
//   : 0 } else destroy`. Against the vanilla module the probe measured 0
//   crescents and 1 EXTRA telegraph — and BOTH of those are vanilla behaving
//   faithfully: with no arm in the window `shoottimer` simply freezes, and
//   frozen at exactly shootrate-4 the next line, `if (shoottimer == shootrate
//   - 4) createslash = 1`, re-arms on EVERY frame of the 30-frame window while
//   the fire test (which needs 15) can never be reached. That is an ORIGINAL
//   BUG in v1.03 and sim/attacks/swordslash.js PRESERVES AND LABELS it rather
//   than correcting it, exactly as this project's rules require.
//
//   So the arm could never land in sim/ — it would change the vanilla fight,
//   and change it for the worse. It landed in the kaizo copy instead:
//   kaizo/attacks/crescent-slash.js, delta 2, at the con-1 clock block. The
//   two assertions below now run against that module through
//   substituteType109 (section 2b/2c), and pass.
{
  // A SHORT walk — 60 frames past the launch, four waves in. The generator
  // deletes itself at turntimer < 20 (rel ~278), so a probe that reused the
  // long walk above would be holding a DEAD instance with a stale shoottimer
  // and would report whatever that frozen number happened to be. It did,
  // before this comment existed: "caught the generator on its telegraph frame
  // (shoottimer 1)", which is the failure mode CLAUDE.md means by a suite full
  // of negative results hiding a path that never ran.
  const b = walkToCrescent({ seed: 12345, after: 60 });
  const gen = b.gen;
  ok(!!gen && gen.alive, 'a short second walk reached a LIVE generator for the forced-clock probe');
  if (gen && gen.alive) {
    // Step to the frame the telegraph is drawn, then drop the clock into the
    // window the way the end of a turn does.
    let guard = 0;
    while (gen.alive && gen.shoottimer !== gen.shootrate - 4 && guard < 200) {
      stepFrame(b.st, idle);
      b.st.partyHp = b.st.partyHp.map(() => 100);
      b.st.gameOver = false;
      guard += 1;
    }
    ok(gen.alive && gen.shoottimer === gen.shootrate - 4,
      `the probe caught the generator on its telegraph frame (shoottimer ${gen.shoottimer})`);

    // CREATIONS, BY IDENTITY — not a delta of alive counts. Four waves are
    // already in flight and a crescent that leaves the room is destroyed, so a
    // count difference can go negative for a reason that has nothing to do
    // with this arm; on the parked frame below it would silently turn "nothing
    // was fired" into a failure. A Set of entities seen so far makes each
    // number a CREATION count, which is what the assertion is about.
    const born = new Set(b.st.entities);
    const newly = (name) => b.st.entities
      .filter((e) => e.alive && e.type.name === name && !born.has(e)).length;

    b.st.turntimer = 45; // inside [20, 50]
    stepFrame(b.st, idle);
    const firedCres = newly(CRESC);
    const firedSlash = newly(SLASH);
    ok(firedCres === 2,
      'clock into [20,50] with the telegraph up: the mod snaps shoottimer to'
      + ` shootrate and fires the promised pair — the sim created ${firedCres}`);
    ok(firedSlash === 0,
      'and draws NO new telegraph (shoottimer is 15 now, not 11) — the sim'
      + ` created ${firedSlash} more`);
    // The snap itself, read off the generator rather than inferred from its
    // output: 11 -> 15 -> 0 on one frame (the arm sets shootrate, the fire test
    // consumes it, the fire block zeroes it). A pair appearing for some other
    // reason would satisfy the two counts above and fail this.
    ok(gen.alive && gen.shoottimer === 0,
      'and shoottimer came out of the frame at 0 — snapped to shootrate by the'
      + ` arm, then zeroed by the shot it enabled (read back: ${gen.shoottimer})`);

    // THE OTHER HALF OF THE SAME ARM, which the frame above cannot reach:
    // below the telegraph threshold it PARKS shoottimer at 0 instead of
    // letting it climb, so nothing further fires and no telegraph is drawn
    // while the clock walks down to 20. Under VANILLA this frame increments
    // nothing either (the window has no arm at all), so the discriminating
    // half is the frame above; this one is here because a generator that had
    // simply gone quiet for some other reason would still be counting, and
    // shoottimer says which.
    const born2 = new Set(b.st.entities);
    const newly2 = (name) => b.st.entities
      .filter((e) => e.alive && e.type.name === name && !born2.has(e)).length;
    b.st.turntimer = 45;
    stepFrame(b.st, idle);
    ok(gen.alive && gen.shoottimer === 0,
      'the next frame in [20,50] parks shoottimer at 0 rather than letting it'
      + ` climb (${gen.shoottimer})`);
    ok(newly2(CRESC) === 0 && newly2(SLASH) === 0,
      'and fires nothing more — the promise was honoured once, not repeatedly'
      + ` (${newly2(CRESC)} crescents, ${newly2(SLASH)} telegraphs)`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 8. THE DESTROY EVENT IS A DRAW  (source: the mod's GML + the tok3 recording)
// ══════════════════════════════════════════════════════════════════════════
//
// gml_Object_obj_bullet_knightcrescent_Destroy_0.gml is the same five-line
// body as the Step's ghost, `random_range(-0.5, 0.5)` included, so a crescent
// costs the shared stream ONE MORE u32 on the frame it dies than on any other
// frame. It is byte-identical in vanilla's dump, so this is a translation gap
// rather than a kaizo delta — but it is a gap the whole-fight diff feels,
// because CLAUDE.md's re-anchored stream makes every later draw in the turn
// depend on the count.
//
// WHY THIS IS ASSERTED BY COUNTING DRAWS AND NOT BY A POSITION. The oracle
// records positions, and a missing draw shows up there only as a different
// random OUTCOME several frames later — which is exactly how it hid. The draw
// count is the mechanism; measure the mechanism.
//
// The discriminator is sim/attacks/swordslash.js's vanilla crescent, which has
// no Destroy translation: run the identical scenario through both and the
// kaizo module must cost one draw more. If someone deletes the Destroy hook
// this section fails; if the engine ever grows a real Destroy event and the
// hook is removed in favour of it, this section still passes, because it
// asks about the stream and not about the plumbing.
console.log('\n8. the Destroy event is a DRAW (source: the mod\'s GML + tok3)');
{
  const drawsFor = (type, offscreen) => {
    const st = createState({ seed: 12345 });
    st.gmlRng = gmlCreate(12345);
    const e = spawn(st, type, { x: st.view.x + 320, y: st.view.y + 160 });
    e.alive = true; // regularbulletCreate kills it when there is no soul
    // ...and that kill went through destroy(), which ran the type's Destroy
    // event and CleanUp ONCE (sim/entity.js guards both). A fight never revives
    // an instance; this harness does, so it must clear the guards or the
    // death below fires no Destroy and the count reads one (2026-09-02).
    delete e.destroyed;
    delete e.cleanedUp;
    if (offscreen) e.x = st.view.x - 200; // past obj_regularbullet's wall test
    const before = st.gmlRng.draws ?? 0;
    type.step(e, st);
    return { n: (st.gmlRng.draws ?? 0) - before, alive: e.alive };
  };

  const live = drawsFor(kaizoKnightCrescent, false);
  const died = drawsFor(kaizoKnightCrescent, true);
  const vanillaDied = drawsFor(vanillaKnightCrescent, true);

  ok(live.alive && live.n === 1,
    'an ordinary crescent frame costs the stream exactly one draw — the Step\'s'
    + ` own ghost (${live.n})`);
  ok(!died.alive,
    'a crescent past the wall is destroyed by the inherited obj_regularbullet'
    + ' Step, as the mod\'s own event_inherited() does');
  ok(died.n === 2,
    'and its LAST frame costs two — the Destroy event\'s random_range(-0.5,'
    + ` 0.5) and then the Step's ghost, because instance_destroy() does not end`
    + ` the event (${died.n})`);
  ok(vanillaDied.n === 1,
    'the vanilla module, which has no Destroy translation, still costs one on'
    + ` the same frame — so this check discriminates (${vanillaDied.n})`);
  ok(died.n - vanillaDied.n === 1,
    'exactly ONE draw of difference, which is the offset the tok3 recording'
    + ' needs: shot f411 +1, f426 +2 (one crescent died f421), f441 +3 (one'
    + ' more died f435), with the f431 tracking-sword choose independently'
    + ' pinned at +2');
}

// ══════════════════════════════════════════════════════════════════════════
// NOTES — differences that are real but outside what this check asserts.
// ══════════════════════════════════════════════════════════════════════════

// The payload's birth frame. This USED to report launch+1 in the mod against
// launch+0 in the sim, blamed on kaizo-mod-launcher.js collapsing
// obj_dbulletcontroller's own first Step into the dispatch. That reading was
// WRONG, and the note is kept as a live assertion instead of a printed
// observation because being wrong quietly is what let it stand.
//
// The launcher collapses nothing. The generator is born one frame after the
// director arms the turn on BOTH sides; what was off was this file's baseline,
// which took the launch ledger (one frame after the pointer flip — see
// walkToCrescent's header and kaizo-trace.mjs's own derivation) where the
// recording takes the flip. Now that both sides start from the arm, the two
// birth frames agree, so the difference is asserted away rather than narrated.
{
  const oBirth = oByName.get(GEN)[0].rel;
  const sBirth = (sByName.get(GEN) ?? [{}])[0]?.rel;
  ok(oBirth === sBirth,
    `the generator is born at launch+${oBirth} in the mod and launch+${sBirth}`
    + ' in the sim — the same frame off the same arm');
}

// Damage USED to be a note here — "not asserted, the recorder pins HP". The
// note was right about the RECORDING and wrong about what could be asserted:
// the bullet's own `damage` field is structural, comes off the same spawn
// ledger every other section reads, and is now section 4a. The recording still
// says nothing about damage and section 4a still says so out loud.

// ══════════════════════════════════════════════════════════════════════════
console.log('');
for (const n of notes) console.log(`  NOTE: ${n}`);
console.log('');
if (failures) {
  console.log(`  ${failures} FAILURE(S) of ${checks} assertions against the real mod.`);
  console.log('  Every asserted number above came off a recorded row or, in sections 4a');
  console.log('  and 7, off the mod\'s own decompiled events. None was widened to pass.');
  process.exit(1);
}
console.log(`  ${checks} assertions against the real mod   OK`);
console.log(`  (${ENTRY}: object set, the six lanes, per-type spawn geometry,`);
console.log('   wave grouping and cadence, the turntimer > 50 firing gate, the');
console.log('   [20,50] telegraph-honouring arm, the crescent\'s 153 damage and the');
console.log('   one-draw cost of its Destroy event —');
console.log('   NOT the wave count, NOT any RNG outcome, NOT HP or survival.)');
process.exit(0);
