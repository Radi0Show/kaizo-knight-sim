#!/usr/bin/env node
// KAIZO WHOLE-FIGHT DIFF — the gate.
//
//   node kaizo/tools/verify-kaizo-fullfight.mjs                # every pair
//   node kaizo/tools/verify-kaizo-fullfight.mjs --only _wf1    # one of them
//   node kaizo/tools/verify-kaizo-fullfight.mjs --context 3    # rows either side
//   node kaizo/tools/verify-kaizo-fullfight.mjs --sabotage     # prove it can fail
//
// ── WHAT THIS IS FOR ──────────────────────────────────────────────────────
//
// The kaizo recreation is verified STRUCTURALLY: eleven oracle checks, ~1,700
// assertions, the whole 28-entry schedule on both routes, and the complete
// per-attack SPAWN ledger — what each turn creates, where, at what angle, to ten
// decimals. Every one of those is a claim about FRAME ZERO of a bullet's life.
// Nothing yet says what happens on frame one.
//
// The vanilla Roaring Knight sim earns its one-to-one claim the other way: six
// whole-fight recordings, ~12,000 frames each, compared row-exact and byte-exact
// under four declared micro-tolerances with the RNG re-anchored per attack
// launch. That claim is carefully hedged and so is this one. This gate is the
// kaizo end of that pipeline: one input feed drives both EnderCat8's patched mod
// and this sim, and the two sides' traces must be the same bytes.
//
// It compares the PAIR the recorder emits (kaizo/tools/diff-kaizo-trace.mjs
// carries the column contract):
//
//   kaizo_oracle_trace<TAG>.csv     21 columns — soul, board, clock, selection
//   kaizo_oracle_bullets<TAG>.csv   2 + 32*7  — every live obj_collidebullet
//
// ── THE FOUR GUARDS, EACH PAID FOR WITH A REAL FAILURE ────────────────────
//
//  1. STALENESS. A sim trace older than the code that produced it was produced
//     by code that no longer exists, so comparing it answers a question about
//     the past and reports it as a pass. tools/verify-fullfight.mjs reached that
//     trap twice in one session — once chasing a divergence in a trace built by
//     a since-reverted experiment, once with two token-21 fights that quietly
//     kept passing across a real change to runMotion. Refused here.
//
//  2. THE LOUD SKIP. The recordings are another author's creative work and are
//     private (kaizo/HANDOFF.md §5-C); most machines will never have one. A
//     hard fail would redden every one of them. A SILENT pass is worse — it
//     would let a green gate mean "the fight is verified" on a machine that has
//     never seen the mod. So: exit 0, and say out loud where it looked.
//
//  3. DEGENERACY. verify-fullfight's most expensive lesson. Its first
//     recordings held confirm instead of pulsing it (`button1_p()` is
//     edge-triggered, so a held button is one press forever), ran ONE turn,
//     flatlined for 790 of 1200 frames — and the differ reported "exact
//     through frame 21". True, and badly misleading: no second turn, no phase
//     transition, no difficulty variant, no phase-4 gate was ever compared. A
//     recording that is not a fight cannot verify a fight, and one that is
//     present but empty is more dangerous than one that is absent, because it
//     looks like evidence.
//
//  4. CAUSAL GROUPING. 21 columns x 12,000 rows is a quarter of a million
//     cells, and the bullets file is another two and a half million. "First
//     mismatch: row 4130, column b7_y" is technically the answer and
//     practically useless: by row 4130 the fight has diverged so far that the
//     first differing CELL says nothing about the first differing CAUSE. So the
//     columns are grouped by SYSTEM, each group's own first divergence is found
//     independently, and they print EARLIEST FIRST — the group that broke first
//     is the one to fix and the rest are usually its downstream.
//
// ── NO TOLERANCES, AND THAT IS A DECISION ─────────────────────────────────
//
// The vanilla differ carries four declared micro-tolerances (position 0.05px,
// angle 0.02deg, scale 5e-5, soul 0.01px), every one of them a MEASURED
// envelope over a real 12,000-frame recording, attributed to the runner's
// proprietary f32 libm. This gate carries none, because there is no kaizo
// recording to measure one from, and a tolerance guessed by analogy is exactly
// the hedge without the measurement — it would silently absorb the first real
// divergence it was meant to find.
//
// WHEN the first recording lands, expect trig-derived columns to part in the
// last bits, and expect to have to declare a tolerance. Derive it from THAT
// recording's own envelope and write the number down here with its receipt. Do
// not copy the vanilla numbers across; do not widen anything until it passes.
//
// ── SABOTAGE MODE ─────────────────────────────────────────────────────────
//
// `--sabotage` is the twin that proves this can fail, in the shape of
// tools/sabotage-fullfight.mjs and kaizo/tools/checks/sabotage-oracle-schedule.
// It builds SYNTHETIC pairs in a per-process scratch directory, corrupts copies
// (never an original), and requires a specific failure for each. It needs no
// game, no recording and no private data, so it runs anywhere.
//
// It is a MODE rather than a separate file on purpose: the harness and the thing
// it guards then cannot drift apart in a commit that touches only one of them.

import {
  readFileSync, writeFileSync, existsSync, readdirSync, statSync, utimesSync,
  mkdirSync, rmSync,
} from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { real } from '../../sim/trace.js';
import { diffKaizoTraces, traceShape, slotCount } from './diff-kaizo-trace.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

// KAIZO_ORACLE_TRACES overrides where the recordings are read from — the same
// escape hatch check-oracle-schedule.mjs gives, and the same two default
// candidates in the same order, because the recorder's output has lived in both
// and a check that hardcoded either one reported a LOUD SKIP with nine
// recordings sitting one directory away. A skip that is really a path bug is
// the worst outcome available here: it looks like an honest absence.
//
// THE FULLFIGHT DIRECTORY COMES FIRST, AND IT IS SEPARATE ON PURPOSE.
// A token-driven whole-fight recording is a DIFFERENT KIND OF ARTIFACT from the
// MODE 0 / MODE 1 schedule captures the per-attack checks read: the player
// DODGES in it, which changes grazing, turn lengths, the RNG stream and the
// whole shape of what those checks measure. Dropping one into `oracle/traces`
// turned SEVEN wired checks red inside a minute, because they auto-select the
// newest or largest recording and silently got a fight of a kind they were
// never written against. That failure mode has now bitten this project three
// times; keeping the two kinds of recording in separate directories is the
// structural fix rather than another note asking people to be careful.
const TRACE_DIRS = process.env.KAIZO_ORACLE_TRACES
  ? [process.env.KAIZO_ORACLE_TRACES]
  : [
    // TRACKED FIRST. Whole-fight recordings moved out of `oracle/` on
    // 2026-08-30: `.gitignore` drops that directory wholesale, so the most
    // expensive artifacts in the project — each one a real ~10-minute game run
    // PLUS the token that drove it — sat untracked and one `git clean` from
    // gone. The old path stays below so an existing checkout keeps working.
    join(homedir(), 'knight-research', 'kaizo-mod', 'fullfight'),
    join(homedir(), 'knight-research', 'kaizo-mod', 'oracle', 'fullfight'),
    join(homedir(), 'knight-research', 'kaizo-mod', 'oracle', 'traces'),
    join(homedir(), 'knight-research', 'kaizo-mod', 'traces'),
  ];

// KAIZO_SIM_OUT is where kaizo/tools/kaizo-trace.mjs was told to write.
const SIM_OUT = process.env.KAIZO_SIM_OUT || join(tmpdir(), 'kaizo-fullfight');

/**
 * THE COLUMN GROUPS, IN THE ORDER A FAULT PROPAGATES.
 *
 * Deliberately CAUSAL, not alphabetical. The selector decides which attack runs;
 * the attack arms the clock and raises the board; the board and the input decide
 * where the soul is; what reaches the soul decides inv; and the bullet
 * population is downstream of all of it. A divergence in a later group with
 * every earlier group clean is a real, local fault. The reverse is almost always
 * the earlier group's shadow.
 *
 * The legacy 11-column row's names (`ac`, `box_*`) are listed alongside the
 * contract's, so a narrow-shape pair groups correctly too.
 */
/**
 * COLUMNS THAT ARE NOT COMPARABLE, and are therefore not compared.
 *
 * Excluding a column REDUCES what this gate proves, so each one needs a reason
 * that survives being read out loud, and the skip is printed on every run in the
 * "WHAT THIS COMPARED, AND WHAT IT DID NOT" block rather than living only here.
 *
 * `phaseturn` — the mod's knight NEVER MOVES IT. Its Other_10 short-circuits on
 * the kaizo_attack struct before reaching vanilla's phase/phaseturn ladder, so
 * the recording holds 0 for all 13,000 frames (measured: 1 distinct value). The
 * sim's director genuinely uses a turn counter and reports its real value (10
 * distinct). Neither side is wrong — they are not the same quantity, and
 * check-oracle-schedule already asserts the mod's 0 directly, so nothing is
 * lost by leaving it out here. Making the sim emit a flattering 0 was the
 * alternative and is worse: it would be inventing agreement.
 */
const NOT_COMPARABLE = new Map([
  ['phaseturn', 'the mod\'s knight never moves it (holds 0 for the whole fight);'
    + ' the sim\'s director genuinely counts turns. Not the same quantity.'
    + ' check-oracle-schedule asserts the mod\'s 0 directly.'],
  // `spawns` COUNTS DIFFERENT POPULATIONS ON THE TWO SIDES, and cannot be made
  // to count the same one.
  //
  // The recorder logs every instance of a watched object AND its children —
  // 20,762 rows in _tok3. Of those, 5,630 are `obj_afterimage_blend`, which HAS
  // NO SIM TYPE AT ALL: it is a cosmetic trail the recreation does not model and
  // has no reason to. That is 27% of the column, structurally unreachable.
  //
  // It was the diff's FIRST DIVERGENCE (frame 409, oracle 136 / sim 135) and it
  // is not a defect in the recreation: at f409 the recording logs
  // 5 afterimage + 2 marker + 1 tracking_sword_slash and the sim counted 7 of
  // the 8. Chasing it would mean either modelling thousands of cosmetic
  // instances to satisfy a counter, or editing attack modules to manufacture
  // spawns — the second was proposed and correctly refused.
  //
  // THE POPULATION IS STILL COMPARED, just not through this column: `bullets`
  // counts `obj_collidebullet` on both sides and stays in the POPULATION group,
  // and the bullets sheet compares all 32 slots' positions and motion. Those are
  // the gameplay population; `spawns` was always an instrument counter.
  ['spawns', 'the two sides count different populations by construction — the'
    + ' recorder logs watched objects AND their children (5,630 of 20,762 rows'
    + ' are obj_afterimage_blend, which has no sim type), so 27% of it is'
    + ' structurally unreachable. `bullets` and the 32-slot sheet carry the'
    + ' gameplay population instead.'],
]);

const TRACE_GROUPS = [
  ['turn', ['mnfight', 'phase', 'phase4turn', 'rtimer',
    'kaizo_atk', 'kaizo_playing', 'attackchoice', 'ac', 'difficulty']],
  ['clock', ['turntimer']],
  ['arena', ['gt_x', 'gt_y', 'gt_xs', 'gt_ys',
    'box_x', 'box_y', 'box_xscale', 'box_yscale']],
  ['soul', ['soul_x', 'soul_y']],
  ['damage', ['inv', 'monsterhp']],
  ['population', ['bullets', 'spawns']],
];

/**
 * The bullets file's groups, same rule.
 *
 * `live` first because it decides whether the slot columns mean anything at all
 * — slots are positional, so one missing bullet shifts every slot after it.
 * Then PRESENCE, because a populated-vs-empty slot with the counts agreeing is a
 * harness fault and not a physics one. Then dir/spd BEFORE x/y: the built-ins
 * the motion phase integrates are the CAUSE of next frame's position, so a
 * heading divergence is the position divergence one frame early.
 */
const BULLET_GROUPS = [
  ['live', /^live$/],
  ['slot motion (dir, spd)', /^b\d+_(dir|spd)$/],
  ['slot position (x, y)', /^b\d+_[xy]$/],
  ['slot shape (a, xs, ys)', /^b\d+_(a|xs|ys)$/],
];

/**
 * Read a trace CSV into { header, rows, path, shape }.
 *
 * STRIP THE CARRIAGE RETURNS — GML `file_text_writeln` writes \r\n, and
 * un-stripped the last header column is "monsterhp\r", which makes the header
 * check report the same name as missing from both sides.
 *
 * DROP PRE-EPOCH ROWS. A recorder that starts one frame before its input epoch
 * labels that row frame -1 while the sim's first row is frame 0; pairing by row
 * index with that row present compares oracle frame k-1 against sim frame k for
 * the whole run, and every transition then reads as "the sim is one frame
 * early". Filtering on the frame column makes row order and frame value the same
 * pairing on both sides.
 */
function readCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/\r/g, '').trim();
  const lines = text.split('\n');
  const header = lines[0].split(',');
  const rows = lines.slice(1).filter((l) => l.length)
    .map((l) => l.split(','))
    .filter((r) => Number(r[0]) >= 0);
  return { header, rows, path, shape: traceShape(header), slots: slotCount(header) };
}

const absent = (v) => v === undefined || v === '';

/**
 * THE STALENESS WATERMARK: the newest mtime of any file that decides what a sim
 * trace contains.
 *
 * That is `sim/**\/*.js` and `kaizo/**\/*.js` — the model — plus
 * kaizo/tools/kaizo-trace.mjs, which is the PRODUCER. It is deliberately NOT
 * every .mjs under kaizo/tools: this file and the differ are the INSTRUMENT, and
 * editing an instrument does not falsify a measurement already taken. If it did,
 * no sim trace could survive its own gate being touched, and the guard would be
 * disabled the first time it cried wolf.
 */
function newestModelMtime() {
  let newest = 0;
  let culprit = null;
  const bump = (full) => {
    const m = statSync(full).mtimeMs;
    if (m > newest) { newest = m; culprit = full; }
  };
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.js')) bump(full);
    }
  };
  walk(join(REPO, 'sim'));
  walk(join(REPO, 'kaizo'));
  const producer = join(REPO, 'kaizo', 'tools', 'kaizo-trace.mjs');
  if (existsSync(producer)) bump(producer);
  return { newest, culprit };
}

/**
 * FIND THE WHOLE-FIGHT PAIRS, and refuse to guess.
 *
 * The trace directory already holds nine recordings, and NONE of them is a
 * whole-fight recording: they were made by the MODE 0 / MODE 1 harness, whose
 * input is a frame-indexed pulse generated inside the patch. Diffing one against
 * a sim trace would compare two runs that were never given the same inputs, and
 * the report would be a wall of divergences that measure the harness. That is
 * the mistake ORACLE-GROUND-TRUTH.md records twice under "the harness perturbing
 * the thing it measures".
 *
 * So a recording is only whole-fight evidence if it carries the INPUT FEED it
 * was driven by, beside it: `kaizo_oracle_inputs<TAG>.txt` (the file the patched
 * game read — seed, frame count, one bitmask per frame) or `<TAG>.token` (the
 * replay token it was generated from). Both are written by the recorder; neither
 * is optional, because without one there is no way to make the sim run the same
 * fight.
 *
 * KAIZO_FULLFIGHT_TAGS="_a,_b" forces a list, for the case where the recorder's
 * naming changes before this does.
 */
function resolvePairs() {
  const looked = [];
  const forced = (process.env.KAIZO_FULLFIGHT_TAGS ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  for (const dir of TRACE_DIRS) {
    looked.push(dir);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir);
    const tags = files
      .map((f) => /^kaizo_oracle_trace(.*)\.csv$/.exec(f))
      .filter(Boolean)
      .map((m) => m[1]);
    const pairs = [];
    const rejected = [];
    for (const tag of tags) {
      const trace = join(dir, `kaizo_oracle_trace${tag}.csv`);
      const bullets = join(dir, `kaizo_oracle_bullets${tag}.csv`);
      const inputs = [
        join(dir, `kaizo_oracle_inputs${tag}.txt`),
        join(dir, `${tag}.token`),
        join(dir, `kaizo_oracle_token${tag}.txt`),
      ].find(existsSync);
      if (forced.length ? forced.includes(tag) : !!inputs) {
        pairs.push({ tag, trace, bullets: existsSync(bullets) ? bullets : null, inputs });
      } else {
        rejected.push(tag);
      }
    }
    if (pairs.length) return { dir, pairs, rejected, looked };
    if (tags.length) return { dir, pairs: [], rejected, looked };
  }
  return { dir: null, pairs: [], rejected: [], looked };
}

/**
 * The sim side of a pair.
 *
 * Three naming conventions are accepted and every one tried is NAMED in the
 * failure, because the producer (kaizo/tools/kaizo-trace.mjs) is being widened
 * in a sibling session and a gate that fails with "not found" and no paths is a
 * gate someone disables.
 */
function simPaths(tag) {
  const cands = [
    [join(SIM_OUT, `kaizo_sim_trace${tag}.csv`), join(SIM_OUT, `kaizo_sim_bullets${tag}.csv`)],
    [join(SIM_OUT, `kaizo-fullfight${tag}.csv`), join(SIM_OUT, `kaizo-fullfight${tag}.bullets.csv`)],
    [join(SIM_OUT, `kaizo_oracle_trace${tag}.csv`), join(SIM_OUT, `kaizo_oracle_bullets${tag}.csv`)],
  ];
  const hit = cands.find(([t]) => existsSync(t));
  return {
    trace: hit ? hit[0] : null,
    bullets: hit && existsSync(hit[1]) ? hit[1] : null,
    tried: cands.map(([t]) => t),
  };
}

/**
 * IS THE RECORDING A FIGHT? Judged on the ORACLE side — a sim trace can only be
 * as much of a fight as the recording it is held against.
 */
function degeneracy(oracle) {
  const why = [];
  const col = (n) => oracle.header.indexOf(n);
  const rows = oracle.rows.length;
  if (rows === 0) return ['the recording has no rows at all'];

  // WHICH ENTRIES FIRED. `kaizo_playing` is the mod's own record of what just
  // fired; `kaizo_atk` is the POINTER to what is next, and MODE 1 rewrites it
  // every frame outside the bullet phase, which invented five launches that
  // never happened (ORACLE-GROUND-TRUTH.md). Never infer from the pointer.
  const pi = col('kaizo_playing');
  const ai = col('attackchoice') >= 0 ? col('attackchoice') : col('ac');
  const played = new Set();
  if (pi >= 0) for (const r of oracle.rows) if (!absent(r[pi])) played.add(r[pi]);
  const acs = new Set();
  if (ai >= 0) for (const r of oracle.rows) if (!absent(r[ai])) acs.add(r[ai]);
  const entries = pi >= 0 ? played : acs;
  const what = pi >= 0 ? 'kaizo_playing' : 'attackchoice';
  if (entries.size < 3) {
    why.push(`only ${entries.size} distinct ${what} value(s)`
      + ` (${[...entries].join(' ') || 'none'}) — fewer than three turns ran`);
  }

  // THE FLATLINE. A fight that stopped leaves a long tail with nothing on
  // screen, and that tail is where a differ reports a confident match against
  // two copies of nothing.
  const bi = col('bullets') >= 0 ? col('bullets') : col('live');
  if (bi >= 0) {
    let tail = 0;
    for (let r = rows - 1; r >= 0 && Number(oracle.rows[r][bi]) === 0; r--) tail++;
    if (tail / rows > 0.4) {
      why.push(`${tail} of ${rows} trailing frames have no bullets`
        + ` (${Math.round((tail / rows) * 100)}%) — the fight stopped and the`
        + ' rest is a flatline');
    }
    if (!oracle.rows.some((r) => Number(r[bi]) > 0)) {
      why.push('no frame ever had a bullet on screen');
    }
  }

  // THE SOUL MUST HAVE MOVED. A recording whose input feed never reached the
  // game — a mis-parsed inputs file, a mask column read from the wrong event —
  // produces a perfectly well-formed fight in which nothing is ever dodged, and
  // every soul column then matches by construction rather than by agreement.
  const sx = col('soul_x');
  if (sx >= 0) {
    const seen = new Set();
    for (const r of oracle.rows) if (!absent(r[sx])) seen.add(r[sx]);
    if (seen.size < 3) {
      why.push(`the soul took ${seen.size} distinct x position(s) in the whole`
        + ' recording — the input feed never reached the game, so the soul'
        + ' columns would match by construction');
    }
  }
  return why;
}

/** First row where a column differs, or -1. Exact string equality; see header. */
/**
 * THE MICRO-TOLERANCES, ported from tools/verify-fullfight.mjs (2026-09-02).
 *
 * The runner's trig is a proprietary float32 libm (traces/trig-probe.csv);
 * the closest JS reproduction lands within a couple of f32 ulps and cannot
 * be bit-exact. A bullet whose heading or speed is DERIVED from trig
 * therefore drifts by nothing a collision can see, but by more than exact
 * text equality allows -- and an exact gate then reports that wobble as the
 * group's FIRST divergence and is BLIND to every real one after it. That
 * blindness hid a falling sword drifting 0.65 px (a tenth of speed from an
 * epsilon-compare fault, _probeall f993) behind a 2e-6-degree wobble at
 * f156. Receipts for the bands, all _probeall: f156 b11_dir 20.8422660828 vs
 * 20.8422679901 (1.9e-6), b17_spd 0.1000000089 vs 0.1000000015 (7.4e-9);
 * f159 b4_y -1.4954009056 vs -1.4954007864 (1.2e-7); f801 b3_ys
 * -2.8531696796 vs -2.8531694412 (2.4e-7, a scale driven by a trig-derived
 * value). The bands are the vanilla gate's (position 0.05 px, angle 0.001
 * degrees) plus speed and scale at 1e-5, each orders of magnitude above the
 * observed wobble and orders below anything behavioural. Every other column
 * stays exact; a cell beyond its band is a real fault and still fails.
 */
const CELL_TOL = [
  [/^b\d+_[xy]$/, 0.05],
  [/^b\d+_(a|dir)$/, 0.001],
  [/^b\d+_(spd|xs|ys)$/, 1e-5],
];
function cellTolerance(name) {
  for (const [re, tol] of CELL_TOL) if (re.test(name)) return tol;
  return 0;
}
function cellsDiffer(a, b, tol) {
  if (a === b) return false;
  if (!tol) return true;
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true; // empty vs value: a presence fault
  return Math.abs(x - y) > tol;
}
function firstDiff(o, s, oi, si, upto, name = '') {
  // The aligned pair carries no header; the callers pass the column NAME.
  const tol = cellTolerance(name || (o.header?.[oi] ?? ''));
  for (let r = 0; r < upto; r++) {
    if (cellsDiffer(o.rows[r][oi], s.rows[r][si], tol)) return r;
  }
  return -1;
}

/** Align on the FRAME column, never the row index. */
function align(oracle, sim) {
  const byFrame = new Map(oracle.rows.map((r) => [r[0], r]));
  const shared = sim.rows.filter((r) => byFrame.has(r[0]));
  return {
    oracle: { ...oracle, rows: shared.map((r) => byFrame.get(r[0])) },
    sim: { ...sim, rows: shared },
    simOnly: sim.rows.length - shared.length,
    oracleOnly: oracle.rows.length - shared.length,
  };
}

function headerMismatch(oracle, sim) {
  const oSet = new Set(oracle.header);
  const sSet = new Set(sim.header);
  const onlySim = sim.header.filter((c) => !oSet.has(c));
  const onlyOracle = oracle.header.filter((c) => !sSet.has(c));
  if (!onlySim.length && !onlyOracle.length
    && oracle.header.join(',') === sim.header.join(',')) return null;
  if (!onlySim.length && !onlyOracle.length) {
    return 'column mismatch: same columns, DIFFERENT ORDER — the comparison is'
      + ' positional, so this would misreport every column';
  }
  return 'column mismatch\n'
    + `      only in sim:    ${onlySim.join(', ') || '(none)'}\n`
    + `      only in oracle: ${onlyOracle.join(', ') || '(none)'}`;
}

/**
 * Compare one file of a pair and return the findings, grouped and earliest
 * first. `groups` is either TRACE_GROUPS (name -> column list) or BULLET_GROUPS
 * (name -> column regex).
 */
function compareFile(oracle, sim) {
  const hm = headerMismatch(oracle, sim);
  if (hm) return { fatal: hm };

  const a0 = align(oracle, sim);
  // ── THE DECLARED WINDOW: TURN 1 IS NOT COMPARABLE ─────────────────────────
  //
  // The recorder's tester Create hands the fight a starting clock —
  // `global.turntimer = 200` — so TURN ONE runs on a HARNESS value, not on the
  // mod's own `scr_turntimer` floor. Measured on _tok3: turn 1 opens at 199
  // while turn 2 opens at 299, and 300 is exactly the ac-0 dispatch floor the
  // mod itself arms (ORACLE-GROUND-TRUTH.md's turn-clock table). The sim arms
  // its own floor from the first turn, so the two disagree about turn 1 for a
  // reason that is nothing to do with the recreation — and because the clock
  // drives the arena and the turn end, everything in turn 1 is downstream of it.
  //
  // So the window starts at the SECOND launch. This is a REDUCTION in what the
  // gate proves and it is printed on every run, the way the vanilla side states
  // its windows: "state the window honestly; if something outside the model
  // perturbs a column, narrow the claim and write down why" (CLAUDE.md).
  //
  // Removing the pin instead would be better and is not free: `global.turntimer`
  // is a value the game sequences itself with, and CLAUDE.md records that
  // freezing it once stopped the Stars cone releasing entirely. The tester gives
  // it a STARTING value rather than pinning it, which is the sanctioned form —
  // it is just not the mod's starting value.
  const a = (() => {
    const iPlay = a0.oracle.header.indexOf('kaizo_playing');
    if (iPlay < 0) return { ...a0, windowFrom: null };
    let seen = null;
    for (let i = 0; i < a0.oracle.rows.length; i++) {
      const v = a0.oracle.rows[i][iPlay];
      if (!v) continue;
      if (seen === null) { seen = v; continue; }
      if (v !== seen) {
        // `spawns` IS CUMULATIVE, so it carries the skipped turn's history
        // across the window boundary: at frame 364 the oracle reads 298 and the
        // sim 227, a 71-spawn debt inherited entirely from the turn nobody is
        // comparing. Rebasing each side on its own first in-window value makes
        // the column mean "spawns since the window opened", which is the only
        // thing it can honestly mean here. It is an instrument counter, not a
        // game quantity — the same reason kaizo-trace rebases it at the sync
        // frame — and without this it is permanently the loudest finding while
        // saying nothing about the fight.
        const iSp = a0.oracle.header.indexOf('spawns');
        const rebase = (side, rows) => {
          if (iSp < 0 || !rows.length) return rows;
          const base = Number(rows[0][iSp]);
          if (!base) return rows;
          return rows.map((r) => {
            const c = r.slice();
            c[iSp] = String(Number(c[iSp]) - base);
            return c;
          });
        };
        const oRows = a0.oracle.rows.slice(i);
        const sRows = a0.sim.rows.slice(i);
        return {
          ...a0,
          oracle: { ...a0.oracle, rows: rebase('oracle', oRows) },
          sim: { ...a0.sim, rows: rebase('sim', sRows) },
          windowFrom: a0.oracle.rows[i][0],
          windowSkipped: i,
          spawnsRebased: true,
        };
      }
    }
    return { ...a0, windowFrom: null };
  })();

  const rows = a.oracle.rows.length;
  if (rows === 0) {
    return { fatal: 'no frames in common — the two sides do not overlap at all' };
  }

  const oi = (c) => a.oracle.header.indexOf(c);
  const si = (c) => a.sim.header.indexOf(c);
  const findings = [];
  const covered = new Set();

  // NOT-COMPARABLE COLUMNS ARE MARKED COVERED BEFORE ANYTHING RUNS, so they are
  // excluded from the grouped pass AND from the `ungrouped` catch-all below.
  // Marking them here rather than deleting them from TRACE_GROUPS is deliberate:
  // the catch-all exists precisely to stop a column being written, shipped and
  // never compared, and an exclusion that hid inside it would be that same bug
  // wearing the fix's clothes. See NOT_COMPARABLE for why each is on the list.
  for (const c of NOT_COMPARABLE.keys()) covered.add(c);

  if (oracle.shape === 'bullets') {
    // THE COUNT DECIDES WHETHER THE SLOTS MEAN ANYTHING. Past a `live`
    // divergence every positional slot shifts, so the slot groups are cut off
    // there — one fault, reported once.
    const li = oi('live');
    const liveRow = li >= 0 ? firstDiff(a.oracle, a.sim, li, si('live'), rows) : -1;
    if (liveRow >= 0) findings.push({ group: 'live', row: liveRow, col: 'live' });
    covered.add('live');
    const validUpto = liveRow >= 0 ? liveRow : rows;

    // PRESENCE: a slot populated on one side and empty on the other, with the
    // counts agreeing. Its own group, because it is a harness fault (absence
    // collapsed to zeros, or the two sides sorting slots differently) and not a
    // trajectory one.
    let presRow = -1;
    let presCol = null;
    for (let s = 0; s < a.oracle.slots; s++) {
      const base = 2 + s * 7;
      for (let r = 0; r < validUpto; r++) {
        const oAny = a.oracle.rows[r].slice(base, base + 7).some((v) => !absent(v));
        const sAny = a.sim.rows[r].slice(base, base + 7).some((v) => !absent(v));
        if (oAny !== sAny && (presRow < 0 || r < presRow)) {
          presRow = r;
          presCol = a.oracle.header[base];
          break;
        }
      }
    }
    if (presRow >= 0) findings.push({ group: 'slot presence', row: presRow, col: presCol });

    for (const [name, re] of BULLET_GROUPS) {
      if (name === 'live') continue;
      let worst = -1;
      let worstCol = null;
      for (const c of a.oracle.header) {
        if (!re.test(c)) continue;
        covered.add(c);
        const r = firstDiff(a.oracle, a.sim, oi(c), si(c), validUpto, c);
        if (r >= 0 && (worst < 0 || r < worst)) { worst = r; worstCol = c; }
      }
      if (worst >= 0) findings.push({ group: name, row: worst, col: worstCol });
    }
  } else {
    for (const [name, cols] of TRACE_GROUPS) {
      let worst = -1;
      let worstCol = null;
      for (const c of cols) {
        // NOT-COMPARABLE columns are skipped HERE too, not only in the
        // ungrouped catch-all. Marking them `covered` before the loop stops the
        // catch-all picking them up but does NOT stop this pass, which walks the
        // group's own column list — so `spawns` stayed the reported first
        // divergence after being declared non-comparable, which is exactly the
        // sort of half-applied exclusion that makes a gate's own output lie.
        if (NOT_COMPARABLE.has(c)) continue;
        const o = oi(c);
        if (o < 0) continue;
        covered.add(c);
        const r = firstDiff(a.oracle, a.sim, o, si(c), rows, c);
        if (r >= 0 && (worst < 0 || r < worst)) { worst = r; worstCol = c; }
      }
      if (worst >= 0) findings.push({ group: name, row: worst, col: worstCol });
    }
  }

  // ANY COLUMN NOT IN A GROUP IS STILL COMPARED, under `ungrouped`.
  //
  // verify-fullfight's group list silently ignores a column it does not name,
  // so a column added to the recorder and not to the group table would be
  // written, shipped and never compared — the "a green suite does not mean a
  // change took effect" trap with a new face. Here the leftovers are their own
  // group and the count is printed on a clean run, so a column can never fall
  // out of the comparison quietly.
  {
    let worst = -1;
    let worstCol = null;
    const leftover = a.oracle.header.filter((c) => c !== 'frame' && !covered.has(c));
    for (const c of leftover) {
      const r = firstDiff(a.oracle, a.sim, oi(c), si(c), rows);
      if (r >= 0 && (worst < 0 || r < worst)) { worst = r; worstCol = c; }
    }
    if (worst >= 0) findings.push({ group: `ungrouped (${worstCol})`, row: worst, col: worstCol });
    a.leftover = leftover;
  }

  findings.sort((x, y) => x.row - y.row);
  return {
    findings, rows, oracle: a.oracle, sim: a.sim,
    simOnly: a.simOnly, oracleOnly: a.oracleOnly, leftover: a.leftover,
    windowFrom: a.windowFrom, windowSkipped: a.windowSkipped,
  };
}

/** The offending column either side of the divergence. */
function showContext(res, f, context) {
  const oi = res.oracle.header.indexOf(f.col);
  const si = res.sim.header.indexOf(f.col);
  const lo = Math.max(0, f.row - context);
  const hi = Math.min(res.rows - 1, f.row + context);
  const lines = [];
  for (let r = lo; r <= hi; r++) {
    const o = res.oracle.rows[r][oi];
    const s = res.sim.rows[r][si];
    const mark = o === s ? '  ' : '->';
    lines.push(`      ${mark} frame ${String(res.oracle.rows[r][0]).padStart(6)}`
      + `   oracle ${String(o ?? '').padStart(16)}   sim ${String(s ?? '').padStart(16)}`);
  }
  return lines.join('\n');
}

/** Report one file of a pair. Returns true on a clean result. */
function reportFile(label, oraclePath, simPath, context) {
  const oracle = readCsv(oraclePath);
  const sim = readCsv(simPath);
  const res = compareFile(oracle, sim);
  if (res.fatal) {
    console.log(`  ${label}: FAIL — ${res.fatal}`);
    return false;
  }
  const shape = oracle.shape === 'bullets'
    ? `${oracle.header.length} columns / ${oracle.slots} slots`
    : `${oracle.header.length} columns`;
  // THE TWO LENGTH MISMATCHES ARE NOT THE SAME FAULT, and collapsing them
  // would either redden a legitimate run or hide a real one.
  //
  //   sim frames with no oracle counterpart  — the RECORDING stopped first.
  //     Normal: a 1,800-frame capture replayed for 3,000. A note, not a fault.
  //   oracle frames with no sim counterpart  — the SIM stopped first, so part
  //     of the recording was never compared at all. That IS a fault, and it is
  //     the one that would otherwise read as "identical for 6,000 frames".
  const notes = [];
  if (res.simOnly > 0) {
    notes.push(`${res.simOnly} sim frame(s) run past the end of the recording`
      + ' (not compared; the recording stopped first)');
  }
  const short = res.oracleOnly > 0;

  if (res.findings.length === 0 && !short) {
    console.log(`  ${label}: OK — ${res.rows} frames, ${shape}, byte-exact`
      + `${res.leftover.length ? ` (incl. ${res.leftover.length} ungrouped column(s))` : ''}`);
    if (notes.length) console.log(`      note: ${notes.join('; ')}`);
    return true;
  }
  if (res.findings.length === 0 && short) {
    console.log(`  ${label}: FAIL — the ${res.rows} shared frames are byte-exact, and`);
    console.log(`           ${res.oracleOnly} RECORDED frame(s) have no sim counterpart, so`);
    console.log('           that part of the fight was never compared. LENGTH MISMATCH:');
    console.log(`           the sim trace stops short of the recording (${shape}).`);
    if (notes.length) console.log(`      note: ${notes.join('; ')}`);
    return false;
  }

  console.log(`  ${label}: FAIL — first divergence at frame `
    + `${res.oracle.rows[res.findings[0].row][0]}`);
  if (notes.length) console.log(`      note: ${notes.join('; ')}`);
  if (short) {
    console.log(`      note: ${res.oracleOnly} recorded frame(s) have no sim`
      + ' counterpart and were never compared');
  }
  if (res.windowFrom !== null && res.windowFrom !== undefined) {
    console.log(`      WINDOW: comparing from frame ${res.windowFrom} (the SECOND launch).`);
    console.log(`              turn 1 skipped — ${res.windowSkipped} frame(s) — because the`);
    console.log(`              recorder ARMS ITS OWN CLOCK for it (tester Create sets`);
    console.log(`              global.turntimer = 200; the mod would arm 300). Everything in`);
    console.log(`              turn 1 is downstream of that, so it is not comparable.`);
  }
  console.log(`      ${res.rows} frames compared; groups in causal order, earliest first:`);
  for (const f of res.findings) {
    console.log(`\n    ${f.group.toUpperCase()}  frame `
      + `${res.oracle.rows[f.row][0]}, column ${f.col}`);
    console.log(showContext(res, f, context));
  }
  console.log('\n    The FIRST group listed is the one to fix; the rest are usually');
  console.log('    its downstream.');

  // The differ's own first-divergence report, which is where the bullets shape
  // becomes readable: slot by slot, with the count first and the formatting-vs-
  // physics distinction. Reused rather than re-implemented, so the two can
  // never disagree about what diverged.
  const detail = diffKaizoTraces(oraclePath, simPath, { context, allowDegenerate: true });
  console.log(`\n    --- first-divergence detail (diff-kaizo-trace) ---`);
  console.log(detail.message.split('\n').map((l) => `    ${l}`).join('\n'));
  return false;
}

const NOTE = `
WHAT THIS COMPARED, AND WHAT IT DID NOT
  compared   the 21 trace columns and every bullet slot's seven fields, as
             EXACT TEXT. No float tolerance anywhere — see the header for why
             none is declared yet and what to do when one has to be.
  NOT        party HP, TP, damage numbers, targeting or survival of any kind:
             the recorder pins party HP and monsterhp to keep a long run alive,
             so every survival-shaped quantity in these columns is a harness
             artifact rather than a measurement.
  NOT        the RNG stream. Both sides RE-ANCHOR per attack launch (CLAUDE.md,
             "LIVE RNG IS RE-ANCHORED PER ATTACK LAUNCH"), because the game
             burns draws in random-pitch sounds and engine noise no sim should
             model. Report results as "mechanics one-to-one, RNG re-anchored
             per launch", never as "the same random stream".
  NOT        anything past slot 31. \`live\` carries the true count, so an attack
             with more than 32 simultaneous bullets is visibly truncated — the
             kaizo splitter peaks at 109 — and the slots below it are still
             compared.
  NOT        draw order, sprites, sound, or anything the trace has no column for.`
  // EVERY EXCLUDED COLUMN IS NAMED ON EVERY RUN, appended to the note rather
  // than left in a source constant: an exclusion nobody sees is a quiet
  // reduction in what this gate proves.
  + [...NOT_COMPARABLE].map(([c, why]) => `\n  SKIPPED    ${c} — ${why}`).join('');

function main(argv) {
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const context = argv.includes('--context')
    ? Number(argv[argv.indexOf('--context') + 1]) : 2;

  const { dir, pairs, rejected, looked } = resolvePairs();

  if (!dir || pairs.length === 0) {
    // THE LOUD SKIP. See guard 2 in the header.
    console.log('SKIP verify-kaizo-fullfight: no kaizo WHOLE-FIGHT recording found.');
    for (const l of looked) console.log(`     looked in ${l}`);
    if (rejected.length) {
      console.log(`     ${rejected.length} recording(s) present but not whole-fight:`);
      console.log(`       ${rejected.join(' ')}`);
      console.log('     A whole-fight recording must carry the INPUT FEED it was driven');
      console.log('     by, beside it — kaizo_oracle_inputs<TAG>.txt or <TAG>.token.');
      console.log('     Without it the two sides were never given the same inputs and a');
      console.log('     diff would measure the harness, not the fight. The recordings');
      console.log('     above are MODE 0 / MODE 1 schedule captures; they are checked by');
      console.log('     kaizo/tools/checks/check-oracle-*.mjs instead.');
    }
    console.log('     (private data — another author\'s mod; run this on the machine');
    console.log('     with the recording. See kaizo/HANDOFF.md.)');
    console.log(NOTE);
    return 0;
  }

  const model = newestModelMtime();
  let failed = 0;
  let ran = 0;

  for (const p of pairs) {
    if (only && !p.tag.includes(only)) continue;
    ran++;
    console.log(`\n=== kaizo whole-fight ${p.tag || '(untagged)'} ===`);
    console.log(`  oracle: ${p.trace}`);
    console.log(`  inputs: ${p.inputs ?? '(forced by KAIZO_FULLFIGHT_TAGS)'}`);

    const s = simPaths(p.tag);

    // A FILE COMPARED AGAINST ITSELF IS A PERFECT MATCH AND MEANS NOTHING.
    //
    // The third accepted sim name is the oracle's own basename, which is what
    // you get from `--out` pointed at a directory. Point KAIZO_SIM_OUT at the
    // traces directory — by habit, by a copy-paste, by leaving it unset on a
    // machine where they coincide — and this gate would diff the recording
    // against itself and report the fight one-to-one. That is the single worst
    // outcome available here, and it is silent, so it is refused by identity
    // rather than trusted to convention.
    if (s.trace && resolve(s.trace) === resolve(p.trace)) {
      console.log('  FAIL: the sim trace IS the oracle trace — same file.');
      console.log(`          ${s.trace}`);
      console.log('        A file compared against itself matches perfectly and');
      console.log('        proves nothing. KAIZO_SIM_OUT must not point at the');
      console.log('        recordings directory.');
      failed++;
      continue;
    }

    if (!s.trace) {
      console.log('  FAIL: no sim trace. Tried:');
      for (const t of s.tried) console.log(`          ${t}`);
      console.log('  produce it by replaying the SAME input feed through the sim,');
      console.log('  with every replay feed the recording carries:');
      console.log('    npm run regen:kaizo        (kaizo/tools/regen-kaizo-fullfight.mjs)');
      console.log('  which runs, for each recording:');
      console.log(`    node kaizo/tools/kaizo-trace.mjs --inputs ${p.inputs ?? '<inputs.txt>'} \\`);
      console.log('         --oracle <trace.csv> --sync auto --keep-alive --slots 32 \\');
      console.log('         --bolts <bolts.csv> --tag <tag> --out <KAIZO_SIM_OUT>');
      console.log('  A trace made WITHOUT --bolts and the measured loadout compares turn');
      console.log('  boundaries the sim was never given the inputs to reach.');
      failed++;
      continue;
    }

    // GUARD 1 — STALENESS.
    const mt = statSync(s.trace).mtimeMs;
    if (mt < model.newest) {
      console.log('  FAIL: the sim trace is STALE — older than the code that');
      console.log('        produces it, so it was made by code that has since');
      console.log('        changed and IS NOT EVIDENCE.');
      console.log(`          sim trace  ${new Date(mt).toISOString()}  ${s.trace}`);
      console.log(`          newer      ${new Date(model.newest).toISOString()}  ${model.culprit}`);
      console.log('        Regenerate it from the same input feed, or delete it.');
      failed++;
      continue;
    }

    const oracle = readCsv(p.trace);

    // GUARD 3 — DEGENERACY.
    const why = degeneracy(oracle);
    if (why.length) {
      console.log('  FAIL: THE RECORDING IS DEGENERATE — refusing to report a diff');
      console.log('        against it.');
      for (const w of why) console.log(`          - ${w}`);
      console.log('        A fight that stops after one turn cannot verify a fight, and');
      console.log('        a recording that contains no fight is more dangerous than one');
      console.log('        that is absent, because it looks like evidence. The usual');
      console.log('        cause is an input feed that HOLDS confirm rather than pulsing');
      console.log('        it: button1_p() is edge-triggered, so a held button is one');
      console.log('        press forever and the party menu never completes again.');
      console.log('        Re-record with a pulsing token and the party kept alive.');
      failed++;
      continue;
    }

    let clean = reportFile('trace  ', p.trace, s.trace, context);

    if (p.bullets && s.bullets) {
      clean = reportFile('bullets', p.bullets, s.bullets, context) && clean;
    } else if (p.bullets && !s.bullets) {
      console.log('  bullets: FAIL — the oracle recorded the per-frame bullet feed and');
      console.log('           the sim did not. Tried:');
      for (const t of s.tried) console.log(`             ${t.replace(/trace/, 'bullets').replace(/\.csv$/, '.csv')}`);
      console.log('           Without it NOTHING PAST FRAME ZERO of a bullet\'s life is');
      console.log('           compared, which is the entire reason this gate exists.');
      clean = false;
    } else if (!p.bullets) {
      console.log('  bullets: absent on the ORACLE side — this recording predates the');
      console.log('           per-frame bullet feed, so the trace columns are all that');
      console.log('           can be compared and no post-spawn motion is verified.');
    }

    if (!clean) failed++;
  }

  if (ran === 0) {
    console.log(`SKIP verify-kaizo-fullfight: no recording matched --only ${only}`);
    console.log(`     available tags: ${pairs.map((p) => p.tag).join(' ')}`);
    return 0;
  }

  console.log(NOTE);
  if (failed) {
    console.log(`\nverify-kaizo-fullfight: ${failed} of ${ran} pair(s) diverged`);
    return 1;
  }
  console.log(`\nverify-kaizo-fullfight: ${ran} pair(s) one-to-one`
    + ' (mechanics; RNG re-anchored per attack launch)');
  return 0;
}

// ══════════════════════════════════════════════════════════════════════════
// SABOTAGE MODE
// ══════════════════════════════════════════════════════════════════════════

/**
 * A PER-PROCESS scratch directory, not a fixed path.
 *
 * A fixed temp path was MEASURED making a sibling harness falsely accuse a
 * correct check: two concurrent runs overwrite each other's mutations
 * mid-comparison, and the failure that surfaces belongs to the other process.
 * It also left ~19MB of copies behind. This one is cleaned up in a `finally`,
 * including on a throw.
 */
const SCRATCH = join(tmpdir(), `kaizo-sab-fullfight-${process.pid}`);
const SAB_TRACES = join(SCRATCH, 'traces');
const SAB_SIM = join(SCRATCH, 'sim');
const TAG = '_sab';

/** A tiny deterministic PRNG. This is a FIXTURE generator, not a model. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Build a synthetic whole-fight PAIR in the contract's two shapes.
 *
 * Synthetic on purpose. These cases test the DIFFER AND THE GATE, not the sim:
 * driving them off the real producer would couple this harness to a file being
 * widened in a sibling session, and a sabotage test that cannot run is a
 * sabotage test that does not exist. Every column is nevertheless written the
 * way the contract requires — `real()` for measured reals, bare for the counts,
 * seven EMPTY cells for an absent slot — so the shapes exercised here are the
 * shapes the recorder emits.
 */
function synthPair({ seed = 1, frames = 1200, turnLen = 200, slots = 32 } = {}) {
  const rnd = lcg(seed);
  const ENTRIES = ['atk_Starstorm1', 'atk_CrescentSlash', 'atk_Vortex1',
    'atk_Splitter1', 'atk_Tunnel1', 'atk_RisingAbyssB'];
  const ACS = [1, 0, 2, 109, 13, 3];

  const traceHeader = 'frame,soul_x,soul_y,inv,attackchoice,turntimer,gt_x,gt_y,'
    + 'gt_xs,gt_ys,bullets,spawns,kaizo_atk,kaizo_playing,phase,phaseturn,'
    + 'phase4turn,difficulty,mnfight,rtimer,monsterhp';
  const bulletHeader = ['frame', 'live'];
  for (let s = 0; s < slots; s++) {
    for (const f of ['x', 'y', 'a', 'xs', 'ys', 'dir', 'spd']) bulletHeader.push(`b${s}_${f}`);
  }

  const traceRows = [];
  const bulletRows = [];
  let spawns = 0;
  let soulX = 320;
  let soulY = 170;

  for (let f = 0; f < frames; f++) {
    const turn = Math.floor(f / turnLen);
    const tf = f % turnLen;
    const entry = ENTRIES[turn % ENTRIES.length];
    const ac = ACS[turn % ACS.length];
    const diff = turn % 3;
    const phase = 1 + Math.floor(turn / 3);

    // The soul walks a square and is nudged by the seed, so two seeds give two
    // different fights — which is the whole point of the divergence case.
    const leg = Math.floor(f / 17) % 4;
    const step = 1 + Math.floor(rnd() * 2);
    if (leg === 0) soulX += step;
    else if (leg === 1) soulY += step;
    else if (leg === 2) soulX -= step;
    else soulY -= step;
    soulX = Math.max(300, Math.min(340, soulX));
    soulY = Math.max(150, Math.min(190, soulY));

    // Bullets: none for the first 30 frames of a turn, a ramp, then a clear-out
    // before the next turn. The tail is short, so the flatline guard is not
    // tripped by a well-formed fixture.
    let live = 0;
    if (tf >= 30 && tf < 170) live = Math.min(slots + 6, Math.floor((tf - 30) / 4));
    if (tf >= 30 && tf < 34) spawns += live;

    const boxUp = tf >= 5;
    traceRows.push([
      String(f),
      real(soulX), real(soulY),
      real(tf % 97 === 0 ? 30 : 0),
      real(ac),
      real(300 - (tf % turnLen)),
      boxUp ? real(320) : '', boxUp ? real(170) : '',
      boxUp ? real(Math.min(2, tf / 20) * 1.12) : '',
      boxUp ? real(Math.min(2, tf / 20) * 0.88) : '',
      String(live),
      String(spawns),
      ENTRIES[(turn + 1) % ENTRIES.length],
      tf < 5 && turn === 0 ? '' : entry,
      real(phase), real(turn % 3), real(0), real(diff), real(2), real(tf),
      real(10000),
    ].join(','));

    const brow = [String(f), String(live)];
    const shown = Math.min(live, slots);
    for (let s = 0; s < slots; s++) {
      if (s >= shown) {
        // SEVEN EMPTY CELLS, never zeros. An absent slot and a bullet at the
        // origin are different states.
        brow.push('', '', '', '', '', '', '');
        continue;
      }
      const dir = (s * 11 + turn * 37) % 360;
      const spd = 2 + (s % 5) * 0.5;
      const age = tf - 30 - s * 4;
      brow.push(
        real(320 + Math.cos((dir * Math.PI) / 180) * spd * age),
        real(170 + Math.sin((dir * Math.PI) / 180) * spd * age),
        real(dir),
        real(1), real(1),
        real(dir), real(spd),
      );
    }
    bulletRows.push(brow.join(','));
  }

  return {
    trace: `${traceHeader}\n${traceRows.join('\n')}\n`,
    bullets: `${bulletHeader.join(',')}\n${bulletRows.join('\n')}\n`,
  };
}

/** Edit one cell of a CSV text and hand it back. Throws if nothing changed. */
function poke(text, frame, col, value) {
  const lines = text.replace(/\r/g, '').trimEnd().split('\n');
  const header = lines[0].split(',');
  const c = header.indexOf(col);
  if (c < 0) throw new Error(`no column ${col}`);
  const r = lines.findIndex((l, i) => i > 0 && Number(l.split(',')[0]) === frame);
  if (r < 0) throw new Error(`no frame ${frame}`);
  const cells = lines[r].split(',');
  if (cells[c] === value) {
    // A MUTATION THAT CHANGED NOTHING WOULD PASS AND PROVE NOTHING — the exact
    // false confidence this harness exists to prevent.
    throw new Error(`sabotage did not apply: ${col} at frame ${frame} was already ${value}`);
  }
  cells[c] = value;
  lines[r] = cells.join(',');
  return `${lines.join('\n')}\n`;
}

/** Empty a slot's seven cells over a frame window, leaving `live` alone. */
function emptySlot(text, slot, lo, hi) {
  const lines = text.replace(/\r/g, '').trimEnd().split('\n');
  const base = 2 + slot * 7;
  let touched = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const f = Number(cells[0]);
    if (f < lo || f > hi) continue;
    if (cells.slice(base, base + 7).every((v) => v === '')) continue;
    for (let k = 0; k < 7; k++) cells[base + k] = '';
    lines[i] = cells.join(',');
    touched++;
  }
  if (touched === 0) throw new Error(`sabotage did not apply: slot ${slot} was already empty in ${lo}..${hi}`);
  return `${lines.join('\n')}\n`;
}

function writePair(oracle, sim) {
  mkdirSync(SAB_TRACES, { recursive: true });
  mkdirSync(SAB_SIM, { recursive: true });
  writeFileSync(join(SAB_TRACES, `kaizo_oracle_trace${TAG}.csv`), oracle.trace);
  writeFileSync(join(SAB_TRACES, `kaizo_oracle_bullets${TAG}.csv`), oracle.bullets);
  // The input feed is what makes this a WHOLE-FIGHT recording rather than a
  // schedule capture — writing it exercises the selection rule too.
  writeFileSync(join(SAB_TRACES, `kaizo_oracle_inputs${TAG}.txt`), '9\n1200\n0\n');
  writeFileSync(join(SAB_SIM, `kaizo_sim_trace${TAG}.csv`), sim.trace);
  writeFileSync(join(SAB_SIM, `kaizo_sim_bullets${TAG}.csv`), sim.bullets);
}

function runGate(extraEnv = {}, args = []) {
  const self = fileURLToPath(import.meta.url);
  try {
    return {
      code: 0,
      out: execFileSync(process.execPath, [self, ...args], {
        cwd: REPO,
        env: {
          ...process.env,
          KAIZO_ORACLE_TRACES: SAB_TRACES,
          KAIZO_SIM_OUT: SAB_SIM,
          ...extraEnv,
        },
        encoding: 'utf8',
      }),
    };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

function sabotage() {
  rmSync(SCRATCH, { recursive: true, force: true });
  mkdirSync(SAB_TRACES, { recursive: true });
  mkdirSync(SAB_SIM, { recursive: true });

  const A = synthPair({ seed: 1 });
  const B = synthPair({ seed: 7 });

  // THE CONTROL, FIRST AND SEPARATELY. If the unmutated pair does not pass,
  // every "it failed" below is uninformative — a gate that fails on everything
  // is as useless as one that passes on everything, and only the control tells
  // them apart.
  const CASES = [
    {
      name: 'CONTROL: the same fixture on both sides passes, both files',
      oracle: () => A, sim: () => A,
      code: 0,
      expect: [/trace\s*: OK/, /bullets: OK/, /one-to-one/],
      reject: [/FAIL/],
    },
    {
      name: 'A DIFFERENT FIXTURE DIVERGES (the differ can fail at all)',
      oracle: () => A, sim: () => B,
      code: 1,
      expect: [/FAIL/, /SOUL\s+frame/],
    },
    {
      name: 'one perturbed cell is named SOUL, at its frame',
      oracle: () => ({ ...A, trace: poke(A.trace, 500, 'soul_x', '999.0000000000') }),
      sim: () => A,
      code: 1,
      expect: [/SOUL\s+frame 500, column soul_x/],
    },
    {
      name: 'a selection divergence is named TURN, not SOUL',
      oracle: () => ({ ...A, trace: poke(A.trace, 640, 'attackchoice', '77.0000000000') }),
      sim: () => A,
      code: 1,
      expect: [/TURN\s+frame 640, column attackchoice/],
    },
    {
      name: 'an arena divergence is named ARENA',
      oracle: () => ({ ...A, trace: poke(A.trace, 300, 'gt_x', '148.0000000000') }),
      sim: () => A,
      code: 1,
      expect: [/ARENA\s+frame 300, column gt_x/],
    },
    {
      // THE ORDERING RULE. A fault at frame 200 prints before one at 900
      // regardless of which group it is in, because the earlier one is the
      // cause and the later one is usually its shadow.
      name: 'groups print EARLIEST first, not in group order',
      oracle: () => ({
        ...A,
        trace: poke(poke(A.trace, 900, 'soul_x', '999.0000000000'),
          200, 'monsterhp', '4321.0000000000'),
      }),
      sim: () => A,
      code: 1,
      expect: [/DAMAGE\s+frame 200[\s\S]*SOUL\s+frame 900/],
    },
    {
      // IDENTICAL BITS, DIFFERENT TEXT. GML rounds an exact tie to EVEN and
      // toFixed rounds away from zero, so a side that used the wrong formatter
      // produces cells that parse equal and compare unequal. Naming it saves
      // the session that would otherwise hunt a physics bug.
      name: 'a formatting-only divergence is named as a PRINTING fault',
      oracle: () => ({ ...A, trace: poke(A.trace, 400, 'monsterhp', '10000.00000000000') }),
      sim: () => A,
      code: 1,
      expect: [/SAME NUMBER, DIFFERENT TEXT/],
    },
    {
      // A SIM TRACE THAT STOPS SHORT is the length mismatch that matters: the
      // shared prefix is byte-exact and the rest of the recording was never
      // compared at all, which is exactly the shape of "exact through frame 21".
      name: 'a truncated SIM trace is a LENGTH MISMATCH, not a silent pass',
      oracle: () => A,
      sim: () => ({
        ...A,
        trace: `${A.trace.trimEnd().split('\n').slice(0, 601).join('\n')}\n`,
      }),
      code: 1,
      expect: [/LENGTH MISMATCH/, /600 RECORDED frame\(s\) have no sim counterpart/],
      reject: [/pair\(s\) one-to-one/],
    },
    {
      // THE OTHER DIRECTION IS NOT A FAULT, and the asymmetry is deliberate: a
      // 1,800-frame capture replayed for 3,000 frames is normal use. Tested so
      // nobody "fixes" it into a failure and reddens every honest run.
      name: 'a sim trace that RUNS PAST the recording is a note, not a failure',
      oracle: () => ({
        ...A,
        trace: `${A.trace.trimEnd().split('\n').slice(0, 601).join('\n')}\n`,
        bullets: `${A.bullets.trimEnd().split('\n').slice(0, 601).join('\n')}\n`,
      }),
      sim: () => A,
      code: 0,
      expect: [/run past the end of the recording/, /pair\(s\) one-to-one/],
      reject: [/FAIL/],
    },
    {
      name: 'a renamed column is fatal and says which side',
      oracle: () => ({ ...A, trace: A.trace.replace('turntimer', 'turn_timer') }),
      sim: () => A,
      code: 1,
      expect: [/column mismatch/, /only in oracle:\s*turn_timer/],
    },
    {
      // THE 32-SLOT CASE. Emptying a middle slot while `live` stays put is the
      // fault an "empty means zero" collapse produces, and it must be reported
      // as PRESENCE — a harness fault — rather than folded in with trajectory
      // deltas.
      name: 'a middle slot that empties early is reported as SLOT PRESENCE',
      oracle: () => A,
      sim: () => ({ ...A, bullets: emptySlot(A.bullets, 5, 300, 340) }),
      code: 1,
      expect: [/SLOT PRESENCE\s+frame 3\d\d/, /PRESENCE: oracle populated, sim EMPTY/],
    },
    {
      name: 'a bullet heading divergence is named SLOT MOTION',
      oracle: () => ({ ...A, bullets: poke(A.bullets, 350, 'b2_dir', '13.0000000000') }),
      sim: () => A,
      code: 1,
      expect: [/SLOT MOTION \(DIR, SPD\)\s+frame 350, column b2_dir/],
    },
    {
      // THE COUNT DECIDES WHETHER THE SLOTS MEAN ANYTHING. One missing bullet
      // shifts every slot after it; reporting thirty faults for one is how a
      // differ becomes something you stop reading.
      name: 'a live-count fault SUPPRESSES the slot columns after it',
      oracle: () => ({
        ...A,
        bullets: poke(poke(A.bullets, 300, 'live', '99'), 400, 'b0_x', '777.0000000000'),
      }),
      sim: () => A,
      code: 1,
      expect: [/LIVE\s+frame 300, column live/, /THE COUNTS DISAGREE/],
      reject: [/SLOT POSITION \(X, Y\)\s+frame 4/],
    },
    {
      // THE DEGENERACY REFUSAL. verify-fullfight's most expensive lesson.
      name: 'a recording that runs one turn and flatlines is REFUSED, not diffed',
      oracle: () => {
        const lines = A.trace.trimEnd().split('\n');
        const h = lines[0].split(',');
        const bi = h.indexOf('bullets');
        const pi = h.indexOf('kaizo_playing');
        for (let i = 1; i < lines.length; i++) {
          const c = lines[i].split(',');
          if (Number(c[0]) > 200) { c[bi] = '0'; c[pi] = 'atk_Starstorm1'; }
          lines[i] = c.join(',');
        }
        return { ...A, trace: `${lines.join('\n')}\n` };
      },
      sim: () => A,
      code: 1,
      expect: [/DEGENERATE/, /distinct kaizo_playing value/, /edge-triggered/],
      reject: [/first divergence at frame/],
    },
    {
      // A SOUL THAT NEVER MOVED means the input feed never reached the game,
      // and every soul column would then match by construction rather than by
      // agreement — a pass that measures nothing.
      name: 'a recording whose soul never moves is REFUSED',
      oracle: () => {
        const lines = A.trace.trimEnd().split('\n');
        const h = lines[0].split(',');
        const xi = h.indexOf('soul_x');
        for (let i = 1; i < lines.length; i++) {
          const c = lines[i].split(',');
          c[xi] = '320.0000000000';
          lines[i] = c.join(',');
        }
        return { ...A, trace: `${lines.join('\n')}\n` };
      },
      sim: () => A,
      code: 1,
      expect: [/DEGENERATE/, /distinct x position/],
    },
    {
      // CRLF. GML's file_text_writeln ends every line with \r\n; un-stripped
      // the last header column is "monsterhp\r" and the report becomes the
      // baffling "the same name is missing from both sides". A regression case,
      // not a hypothetical.
      name: 'CRLF line endings in the oracle are stripped, not reported',
      oracle: () => ({
        trace: A.trace.replace(/\n/g, '\r\n'),
        bullets: A.bullets.replace(/\n/g, '\r\n'),
      }),
      sim: () => A,
      code: 0,
      expect: [/trace\s*: OK/, /bullets: OK/],
      reject: [/column mismatch/, /FAIL/],
    },
    {
      name: 'the sim side missing its bullets half is a FAIL, not a quiet pass',
      oracle: () => A,
      sim: () => ({ ...A, bullets: null }),
      code: 1,
      expect: [/bullets: FAIL/, /NOTHING PAST FRAME ZERO/],
    },
  ];

  let failed = 0;
  for (const c of CASES) {
    rmSync(SAB_TRACES, { recursive: true, force: true });
    rmSync(SAB_SIM, { recursive: true, force: true });
    let oracle;
    let sim;
    try {
      oracle = c.oracle();
      sim = c.sim();
    } catch (e) {
      failed++;
      console.log(`FAIL  ${c.name}`);
      console.log(`        the mutation itself failed: ${e.message}`);
      continue;
    }
    mkdirSync(SAB_TRACES, { recursive: true });
    mkdirSync(SAB_SIM, { recursive: true });
    writeFileSync(join(SAB_TRACES, `kaizo_oracle_trace${TAG}.csv`), oracle.trace);
    writeFileSync(join(SAB_TRACES, `kaizo_oracle_bullets${TAG}.csv`), oracle.bullets);
    writeFileSync(join(SAB_TRACES, `kaizo_oracle_inputs${TAG}.txt`), '9\n1200\n0\n');
    writeFileSync(join(SAB_SIM, `kaizo_sim_trace${TAG}.csv`), sim.trace);
    if (sim.bullets) writeFileSync(join(SAB_SIM, `kaizo_sim_bullets${TAG}.csv`), sim.bullets);

    const { code, out } = runGate();
    const problems = [];
    if (code !== c.code) problems.push(`exit ${code}, wanted ${c.code}`);
    for (const re of c.expect ?? []) if (!re.test(out)) problems.push(`missing ${re}`);
    for (const re of c.reject ?? []) if (re.test(out)) problems.push(`should not have reported ${re}`);
    if (problems.length) {
      failed++;
      console.log(`FAIL  ${c.name}`);
      for (const p of problems) console.log(`        ${p}`);
      console.log(out.split('\n').slice(0, 60).map((l) => `      | ${l}`).join('\n'));
    } else {
      console.log(`ok    ${c.name}`);
    }
  }

  let extra = 0;

  // ── THE STALENESS GUARD ───────────────────────────────────────────────────
  // Backdate the sim trace past every .js under sim/ and kaizo/ and it must be
  // refused. Nothing else in this harness can reach that branch, and it is the
  // guard that stops a passing diff from being a claim about code that no
  // longer exists.
  {
    rmSync(SAB_TRACES, { recursive: true, force: true });
    rmSync(SAB_SIM, { recursive: true, force: true });
    writePair(A, A);
    const p = join(SAB_SIM, `kaizo_sim_trace${TAG}.csv`);
    const old = new Date('2000-01-01T00:00:00Z');
    utimesSync(p, old, old);
    const { code, out } = runGate();
    if (code === 1 && /STALE/.test(out) && /IS NOT EVIDENCE/.test(out)) {
      console.log('ok    a sim trace older than sim/ or kaizo/ is refused as STALE');
    } else {
      extra++;
      console.log('FAIL  a stale sim trace was not refused');
      console.log(out.split('\n').slice(0, 30).map((l) => `      | ${l}`).join('\n'));
    }
  }

  // ── THE LOUD SKIP ─────────────────────────────────────────────────────────
  // No recording at all: exit 0, and SAY where it looked. A hard fail here
  // would redden every machine without the private recordings; a silent pass
  // would let a green gate mean the fight is verified on a machine that has
  // never seen the mod.
  {
    rmSync(SAB_TRACES, { recursive: true, force: true });
    rmSync(SAB_SIM, { recursive: true, force: true });
    mkdirSync(SAB_TRACES, { recursive: true });
    mkdirSync(SAB_SIM, { recursive: true });
    const { code, out } = runGate();
    if (code === 0 && /SKIP verify-kaizo-fullfight/.test(out) && /looked in/.test(out)) {
      console.log('ok    no recording present: LOUD skip at exit 0, naming where it looked');
    } else {
      extra++;
      console.log('FAIL  the absent-recording skip is not loud, or not exit 0');
      console.log(out.split('\n').slice(0, 30).map((l) => `      | ${l}`).join('\n'));
    }
  }

  // ── SCHEDULE CAPTURES ARE NOT WHOLE-FIGHT RECORDINGS ──────────────────────
  // The nine MODE 0 / MODE 1 recordings on a real machine were driven by the
  // patch's own frame-indexed pulse, not by a shared input feed. Diffing one
  // against a sim trace would report a wall of divergences that measure the
  // harness. They must be SKIPPED and NAMED, never picked up.
  {
    rmSync(SAB_TRACES, { recursive: true, force: true });
    rmSync(SAB_SIM, { recursive: true, force: true });
    mkdirSync(SAB_TRACES, { recursive: true });
    mkdirSync(SAB_SIM, { recursive: true });
    writeFileSync(join(SAB_TRACES, 'kaizo_oracle_trace_deep.csv'), A.trace);
    const { code, out } = runGate();
    if (code === 0 && /not whole-fight/.test(out) && /_deep/.test(out)) {
      console.log('ok    a schedule capture with no input feed is skipped and NAMED');
    } else {
      extra++;
      console.log('FAIL  a recording with no input feed was treated as whole-fight evidence');
      console.log(out.split('\n').slice(0, 30).map((l) => `      | ${l}`).join('\n'));
    }
  }

  // ── THE SELF-COMPARISON GUARD ─────────────────────────────────────────────
  // Point KAIZO_SIM_OUT at the recordings directory and every file matches
  // itself perfectly. It is the only fault here that produces a CONFIDENT PASS
  // rather than a confusing failure, which makes it the one most worth a case.
  {
    rmSync(SAB_TRACES, { recursive: true, force: true });
    rmSync(SAB_SIM, { recursive: true, force: true });
    writePair(A, A);
    const { code, out } = runGate({ KAIZO_SIM_OUT: SAB_TRACES });
    if (code === 1 && /the sim trace IS the oracle trace/.test(out)) {
      console.log('ok    a file compared against ITSELF is refused, not reported one-to-one');
    } else {
      extra++;
      console.log('FAIL  the gate compared a recording against itself and did not refuse');
      console.log(out.split('\n').slice(0, 25).map((l) => `      | ${l}`).join('\n'));
    }
  }

  // ── THE HONEST-REPORT GUARD ───────────────────────────────────────────────
  // The clean run must SAY what it did not compare. A gate that reports
  // "one-to-one" without the caveats overstates exactly the way the vanilla
  // one-turn recording did.
  {
    rmSync(SAB_TRACES, { recursive: true, force: true });
    rmSync(SAB_SIM, { recursive: true, force: true });
    writePair(A, A);
    const { code, out } = runGate();
    const ok = code === 0
      && /RNG re-anchored per/.test(out)
      && /party HP/.test(out)
      && /past slot 31/.test(out);
    if (ok) {
      console.log('ok    a clean run prints what was NOT compared (HP, RNG, slot limit)');
    } else {
      extra++;
      console.log('FAIL  the clean run does not disclose what it did not compare');
      console.log(out.split('\n').slice(-25).map((l) => `      | ${l}`).join('\n'));
    }
  }

  const total = CASES.length + 5;
  console.log('');
  if (failed + extra) {
    console.log(`sabotage: ${failed + extra} of ${total} cases failed —`
      + ' verify-kaizo-fullfight\'s green result cannot be trusted until they pass');
    return 1;
  }
  console.log(`sabotage: ${total}/${total} — the gate catches every fault it is meant to`);
  return 0;
}

function entry() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log('usage: node kaizo/tools/verify-kaizo-fullfight.mjs'
      + ' [--only TAG] [--context N] [--sabotage]');
    console.log('  env: KAIZO_ORACLE_TRACES  where the recordings are');
    console.log('       KAIZO_SIM_OUT        where the sim traces are');
    console.log('       KAIZO_FULLFIGHT_TAGS force a comma-separated tag list');
    return 0;
  }
  if (argv.includes('--sabotage')) {
    try {
      return sabotage();
    } finally {
      // ALWAYS, including on a throw. The scratch holds copies of trace data
      // and a sibling harness was measured leaving ~19MB of them behind.
      try { rmSync(SCRATCH, { recursive: true, force: true }); } catch { /* untidy, never wrong */ }
    }
  }
  return main(argv);
}

// pathToFileURL, not `file://${process.argv[1]}`: on Windows argv[1] is a
// backslash path and import.meta.url is `file:///D:/...`, so the older form is
// false and main() never runs — the gate would exit 0 having compared nothing,
// which is the single worst failure mode a gate has.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(entry());
}

export { compareFile, degeneracy, readCsv, synthPair, reportFile };
