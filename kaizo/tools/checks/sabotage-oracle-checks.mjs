#!/usr/bin/env node
// SABOTAGE TEST for ALL ELEVEN oracle checks wired into the kaizo gate.
//
//   node kaizo/tools/checks/sabotage-oracle-checks.mjs [--only <family>]
//
// sabotage-oracle-schedule.mjs guards ONE of the eleven, in more depth than the
// one case here does. The rest were sabotage-tested by hand, once, by the agents
// that wrote them. That is worth something and it is not a guard: nothing
// re-runs it, so the next edit to a parser, a column name or a filter is
// unobserved.
//
// WHY THIS MATTERS MORE THAN IT SOUNDS. Every one of these checks reads its
// truth from a FILE. A mistyped column name, a comparison of two `undefined`s,
// a loop that never enters, a filter that selects nothing — each produces a
// clean green run against a real recording, and the gate then reports that the
// kaizo recreation agrees with EnderCat8's mod when nothing was compared.
// CLAUDE.md's "A green suite does not mean a change took effect" is exactly
// this failure mode, and the whole kaizo half of this project's method rests on
// these eleven lines of the gate.
//
// So, for each wired check:
//
//   1. copy the recordings to a scratch directory. NEVER write the originals —
//      they are ground truth and each costs a real game run to reproduce. The
//      manifest at the bottom re-hashes every source file afterwards and fails
//      loudly if one moved by a byte or a millisecond.
//   2. run the check against the UNCORRUPTED copy. THE CONTROL IS MANDATORY:
//      a harness that fails everything looks identical to one that works, and
//      only the control tells them apart.
//   3. corrupt the copy in a way chosen to hit THAT check's own assertions,
//      and require a non-zero exit AND a specific expected failure line.
//   4. point the check at an EMPTY directory and require a LOUD SKIP at exit 0.
//
// STEP 4 IS NOT DECORATION. It is what proves KAIZO_ORACLE_TRACES is honoured
// at all: a check that ignored the variable would find the real recordings in
// ~/knight-research and carry on, so its "skip" would never appear. Without
// that, a sabotage case could be corrupting a file the check never opens and
// the pass/fail would be measuring the harness. It is also the property that
// makes wiring these safe on a machine with no oracle: they must skip,
// never redden.
//
// THE CORRUPTIONS ARE CHOSEN PER FAMILY, BY READING WHAT EACH CHECK ASSERTS.
// A corruption a check does not look at proves nothing, and reporting it as a
// pass would be the exact defect this file exists to catch. Each case below
// names the assertion it is aimed at. If a check cannot be made to fail, that
// is the FINDING and it is reported as a failure of this harness — never
// papered over with a corruption picked because it happened to trip something.
//
//   family        corruption                       assertion it must trip
//   -----------   ------------------------------   ---------------------------
//   schedule      one launch's `difficulty` -> 0    "<id>: difficulty"
//   stars         first star's spawn frame +1       "the first star lands 33
//                                                    frames after the cone"
//   multislash    drop 1 in 3 of atk_Multislash3's  "atk_Multislash3:
//                 obj_roaringknight_slash            obj_roaringknight_slash
//                                                    count"
//   stream        drop 1 in 4 of atk_XAttacks'      "exactly 100
//                 obj_knight_streamline              obj_knight_streamline"
//   tunnel        drop 1 in 4 of atk_Tunnel1's      "N swords = 2 x M pairs"
//                 obj_sword_tunnel_sword
//   tracking      drop 1 in 4 of atk_DiamondStorm's "obj_diagonal_bullet:
//                 obj_diagonal_bullet                count"
//   vortex        drop 1 in 4 of atk_Vortex1's      "obj_fallingsword count
//                 obj_fallingsword                   (N) is outside ..."
//   quickslash    drop 1 in 4 of atk_Quickslash's   "obj_roaringknight_
//                 obj_roaringknight_quickslash       quickslash: oracle N,
//                                                    sim M"
//   crescent      atk_CrescentSlash's telegraph y   "the generator's ypos table
//                 +3px (the lane table moves)        IS the recorded lane table"
//   splitter      drop 1 in 2 of atk_Splitter1's    "atk_Splitter1: slashmarker
//                 SLASHMARKERS, flames untouched     (obj_marker) count"
//   weird         atk_RisingAbyssB's five orbs      "atk_RisingAbyssB: orb x,
//                 moved 3px right                    exact to ten decimals"
//   multislash-D  drop 1 in 3 of atk_Multislash3's  "B/atk_Multislash3:
//   (route D)     obj_roaringknight_slash IN THE     obj_roaringknight_slash
//                 B-SIDE recording                   count"
//
// The row-drop recipe is the one the hand-tests used and it is deliberately
// crude: it changes COUNTS, CADENCE and GROUPING at once, which is the part of
// each ledger the checks are built on. The four non-drop cases exist because a
// row-drop would prove less there — the schedule check reads per-launch scalar
// fields out of the frame trace and never counts spawns at all; the stars check
// explicitly does NOT compare star counts (the turn clock is graze-driven), so
// only a frame shift reaches its cadence assertions; and the crescent and weird
// checks each hold a POSITION against the sim while their populations are
// mostly compared to THEMSELVES (see those two cases below).
//
// THREE OF THE FOUR NEW CASES ARE AIMED AT A CLASSIFIER OR A COORDINATE, NOT AT
// A COUNTER, and that is the point of each:
//
//   * -splitter reads ONE object name, obj_marker, and splits it into two
//     populations BY POSITION (`classifyMarkers()`: the organism's two flame
//     markers sit at the box centre +(2,-1) and +(0,2); every other marker is a
//     per-slash slashmarker). Dropping obj_marker rows blindly would take out a
//     flame and trip "the recording shows N flame markers, not 2" — an
//     assertion about the RECORDING's shape, not about the recreation, and
//     tripping it would prove only that the file has rows in it. This case
//     drops slashmarkers ONLY, so both flame assertions stay GREEN through the
//     sabotage and the failure lands on the slashmarker count. That is a
//     positive result about the classifier as well as about the count.
//   * -crescent recovers the SIX LANES of the attack from the recording itself
//     (every telegraph is created at the generator's y + 18) and holds the
//     sim's generated `ypos` table against them. Its counts are explicitly not
//     comparable — the recorder's turn clock takes twelve non-unit decrements
//     across that turn, so the mod fires 15 waves where the sim fires 16, and
//     the check says so and asserts the GATE instead. A row drop would land on
//     nothing it claims. Moving the telegraphs 3px keeps every self-check of
//     the recording green (six lanes, 20px apart, boxheight 140) and breaks
//     exactly the mod-against-sim comparison.
//   * -weird's fan-bullet populations are mostly compared to THEMSELVES ("seven
//     fans per big shot", "all on the SAME frame", "five at speed 4 and two at
//     6"), so a row drop there describes the recording rather than the
//     recreation. Its five underbox orbs, though, are held against the sim as
//     sorted TEN-DECIMAL strings. Moving them 3px is the smallest corruption
//     that reaches that comparison.
//
// WHAT THIS DOES NOT COVER, stated rather than implied:
//
//   * ROUTE D IS COVERED ONCE, NOT EVERYWHERE. Eleven of the twelve cases
//     corrupt the longest MODE 0 recording (`_deep` — ORACLE-GROUND-TRUTH.md's
//     "the whole ordinary chain", 31 launches), which is route C. Several checks
//     read more than that one: check-oracle-schedule walks all nine recordings,
//     check-oracle-tunnel two, check-oracle-weird both routes, and
//     check-oracle-multislash takes the longest recording PER SIDE, so its
//     B-Side half runs off `_sideb`. The `multislash-D` case is the one that
//     corrupts `_sideb`, and it is worth more than another route-C case would
//     be: route D is a genuinely different fight (54% more gameplay objects,
//     three entries with a different ac, its own arena table), so a check whose
//     D half had quietly stopped comparing would look identical to one that
//     agreed with the mod.
//
//     TWO CASES PIN THE HALVES AS INDEPENDENT, IN BOTH DIRECTIONS. `multislash-D`
//     corrupts the B-Side and requires that not one `A/` assertion moves;
//     `weird` corrupts route C and requires that not one `[route D]` assertion
//     moves. Without those, a corruption that reddened the whole check would
//     satisfy the expected-line test and be credited with a result it did not
//     produce. Still unproven able to fail: the D halves of -tunnel and
//     -tracking, and -crescent's D branch (which reports rather than asserts).
//   * THE SIM SIDE. Every corruption is applied to the ORACLE, deliberately:
//     that is the direction that also proves the check is READING the recording
//     at all (sabotage-oracle-schedule.mjs's rule, for its reason). A check
//     whose sim-side model had been stubbed out would still be caught — the two
//     sides are compared to each other — but a check that had stopped RUNNING
//     the sim would not be, and no case here targets that.
//   * ONE CASE PER CHECK, WHERE sabotage-oracle-schedule.mjs RUNS FOUR. Each
//     check here is proved able to fail on ONE of its assertions, not on all of
//     them; the rest of its assertions are still only as good as they read. A
//     check that lost half its comparisons would keep passing this file. The
//     schedule twin is the model for going deeper on any one of them.
//
// A NOTE ON THE COVERAGE CLAIM ABOVE. The version of this header before
// 2026-08-29 said -crescent, -splitter and -weird were "not wired into the gate,
// so there is nothing here to protect yet". That was true when it was written
// and stopped being true the day all three were wired (verify-kaizo.mjs's WIRED
// set now names every check-oracle-*), and nothing here noticed — a stale
// coverage note reads exactly like an accurate one. The runtime output now
// derives the gap from the case list instead of restating it, so the next check
// wired without a case says so on every run rather than waiting for a reader.

import {
  readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync, statSync,
  existsSync, readdirSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  resolveTraces, readTrace, recoverLaunches, detectRoute,
} from './check-oracle-schedule.mjs';

const HERE = join(fileURLToPath(import.meta.url), '..');
const SCRATCH_MARK = 'kaizo-sabotage-oracle-checks';

/**
 * THE SCRATCH ROOT IS PER-PROCESS, and that is not a tidiness preference.
 *
 * It used to be a fixed path that `main()` clears on entry, so two runs of this
 * harness at once — the gate and a developer, two gates, an orphaned earlier
 * run — deleted and re-copied each other's evidence mid-comparison. MEASURED,
 * not reasoned: two concurrent runs produce, in one pass,
 *
 *   FAIL could not apply the sabotage: no row in frames 979..1009 had difficulty === 5
 *   FAIL oracle: 54 swords = 2 x 42 pairs        (96 -> 72 -> 54: corrupted twice)
 *   FAIL exit 0 ... THE CHECK PASSED ON A CORRUPTED RECORDING
 *
 * The last of those is the dangerous one. A check pointed at a directory whose
 * recordings have just been deleted SKIPS LOUDLY AT EXIT 0 — the contract step 4
 * requires of it — and this harness read that exit 0 as "the check passed on a
 * corrupted recording" and accused it of the exact defect this file exists to
 * catch. A harness that reports a false positive against a correct check is
 * worse than no harness, because the next reader edits the check.
 *
 * `SCRATCH_MARK` stays in the name so the "refusing to clear an unmarked
 * directory" guard below still bites. Stale per-pid directories are left only
 * by FAILING runs (a successful one deletes its own), which is the same trade
 * the failure path already makes: the corrupted copy is the evidence.
 */
const SCRATCH_ROOT = join(tmpdir(), `${SCRATCH_MARK}-${process.pid}`);

// ── CSV surgery ───────────────────────────────────────────────────────────
//
// Both recorder files are plain CSV with a header row, so the mutators work on
// text rather than through the checks' own parsers. That is deliberate: a
// mutator built on the parser under test could be fooled by the same bug.

function load(path) {
  const lines = readFileSync(path, 'utf8').replace(/\r/g, '').trimEnd().split('\n');
  return {
    head: lines[0],
    col: Object.fromEntries(lines[0].split(',').map((h, i) => [h, i])),
    rows: lines.slice(1).filter((l) => l.length),
  };
}

function store(path, d, rows) {
  writeFileSync(path, [d.head, ...rows].join('\n') + '\n');
}

/**
 * A MUTATION THAT CHANGED NOTHING WOULD PASS THE CHECK AND PROVE NOTHING.
 * sabotage-oracle-schedule.mjs learned this the same way; without the guard the
 * sabotage test degrades into the exact false confidence it was written to
 * prevent, and it degrades SILENTLY because "corrupted, and the check still
 * passed" and "never corrupted" produce identical output.
 */
function mustHaveApplied(n, what) {
  if (!n) throw new Error(`sabotage did not apply: ${what}`);
  return n;
}

/**
 * Drop every Nth row of one object inside one entry's group.
 *
 * `only` narrows the population BEFORE the every-Nth counter runs, for the
 * checks that read one object name as two different things. Rows it rejects are
 * neither counted nor dropped, so a case can corrupt one sub-population and
 * leave the other provably intact — see the splitter case, where the two flame
 * markers must survive for the failure to mean what it claims.
 */
function dropEveryNth(path, { object, playing, n, only = null, what = null }) {
  const d = load(path);
  if (d.col.object === undefined || d.col.kaizo_playing === undefined) {
    throw new Error(`${basename(path)} has no object/kaizo_playing column`);
  }
  let seen = 0;
  let dropped = 0;
  const kept = d.rows.filter((l) => {
    const c = l.split(',');
    if (c[d.col.object] !== object) return true;
    if (c[d.col.kaizo_playing] !== playing) return true;
    if (only && !only(c, d.col)) return true;
    seen += 1;
    if (seen % n === 0) { dropped += 1; return false; }
    return true;
  });
  mustHaveApplied(dropped, `no ${what ?? object} row under ${playing} in ${basename(path)}`);
  store(path, d, kept);
  return `dropped ${dropped} of ${seen} ${what ?? object} rows under ${playing}`;
}

/**
 * Add `delta` to one numeric column on every row of one object inside one
 * entry's group, at the recorder's own ten-decimal precision.
 *
 * A SHIFT, NOT A DROP, and the difference is the whole point where it is used:
 * a drop changes a population and a check that never counts that population
 * would not notice, while a shift changes a POSITION and leaves every count and
 * every cadence exactly where it was.
 */
function shiftColumn(path, {
  object, playing, column, delta,
}) {
  const d = load(path);
  if (d.col[column] === undefined) throw new Error(`${basename(path)} has no ${column} column`);
  let touched = 0;
  const out = d.rows.map((l) => {
    const c = l.split(',');
    if (c[d.col.object] !== object) return l;
    if (c[d.col.kaizo_playing] !== playing) return l;
    c[d.col[column]] = (Number(c[d.col[column]]) + delta).toFixed(10);
    touched += 1;
    return c.join(',');
  });
  mustHaveApplied(touched, `no ${object} row under ${playing} in ${basename(path)}`);
  store(path, d, out);
  return `${column} ${delta > 0 ? '+' : ''}${delta} on ${touched} ${object} row(s) under ${playing}`;
}

/** Move the FIRST spawn of one object inside one entry by `delta` frames. */
function shiftFirstSpawn(path, { object, playing, delta }) {
  const d = load(path);
  let touched = 0;
  const out = d.rows.map((l) => {
    if (touched) return l;
    const c = l.split(',');
    if (c[d.col.object] !== object) return l;
    if (c[d.col.kaizo_playing] !== playing) return l;
    c[d.col.frame] = String(Number(c[d.col.frame]) + delta);
    touched += 1;
    return c.join(',');
  });
  mustHaveApplied(touched, `no ${object} row under ${playing} in ${basename(path)}`);
  store(path, d, out);
  return `moved the first ${object} of ${playing} by ${delta > 0 ? '+' : ''}${delta} frame(s)`;
}

/** Rewrite one numeric column across a frame window. */
function setColumnInWindow(path, { column, from, to, lo, hi }) {
  const d = load(path);
  if (d.col[column] === undefined) throw new Error(`${basename(path)} has no ${column} column`);
  let touched = 0;
  const out = d.rows.map((l) => {
    const c = l.split(',');
    const frame = Number(c[0]);
    if (!(frame >= lo && frame <= hi)) return l;
    if (Number(c[d.col[column]]) !== from) return l;
    c[d.col[column]] = to.toFixed(10);
    touched += 1;
    return c.join(',');
  });
  mustHaveApplied(touched, `no row in frames ${lo}..${hi} had ${column} === ${from}`);
  store(path, d, out);
  return `${column} ${from} -> ${to} on ${touched} row(s) in frames ${lo}..${hi}`;
}

// ── running a check ───────────────────────────────────────────────────────

function runCheck(family, tracesDir) {
  const file = join(HERE, `check-oracle-${family}.mjs`);
  try {
    const out = execFileSync(process.execPath, [file], {
      env: { ...process.env, KAIZO_ORACLE_TRACES: tracesDir },
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 64 * 1024 * 1024,
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

/**
 * The expected message has to be matched ON A FAILURE LINE, not anywhere in the
 * output. Three of the eight print their assertions whether they pass or fail
 * (`  ok   <msg>` / `  FAIL <msg>`), so a bare substring search would match the
 * check REPORTING SUCCESS on the very assertion the corruption was supposed to
 * break. The other five stay silent on success and list failures as `  - <msg>`.
 */
function failureLine(pattern) {
  return new RegExp(`^\\s*(?:FAIL|-)\\s+.*(?:${pattern})`, 'm');
}

// ── the recordings, and the copy ──────────────────────────────────────────

function headerOf(path) {
  return readFileSync(path, 'utf8').slice(0, 8192).split('\n')[0];
}

/**
 * The trace/seq pair to corrupt: the LONGEST recording that carries a per-spawn
 * companion and the `kaizo_playing` column.
 *
 * This is the same rule the checks themselves use to choose, and it is derived
 * rather than hardcoded so a re-recording does not silently stop landing. It is
 * still only a PREDICTION of what each check will open, so every case below
 * also asserts that the control run named the file the case corrupts — see
 * `looksAt`. A corruption applied to a file the check never reads would
 * otherwise report "this check cannot be made to fail" for a harness reason.
 */
function pairsIn(dir, found) {
  return found
    .map((f) => ({ trace: f, seq: f.replace('trace', 'seq') }))
    .filter((p) => existsSync(join(dir, p.seq)))
    .filter((p) => headerOf(join(dir, p.trace)).includes('kaizo_playing')
      && headerOf(join(dir, p.seq)).includes('kaizo_playing'))
    .map((p) => ({ ...p, n: statSync(join(dir, p.trace)).size }))
    .sort((a, b) => b.n - a.n);
}

/**
 * The largest pair whose recording IS a given route, or null.
 *
 * DERIVED, NOT NAMED. The B-Side recording is conventionally tagged `_sideb`,
 * and reading the route off the filename would make this harness agree with a
 * label rather than with the data — the same mistake check-oracle-splitter's
 * `isSidebSeq` exists to avoid, and the same one ORACLE-GROUND-TRUTH records
 * under "Telling the routes apart". So the route comes from
 * check-oracle-schedule's own `detectRoute`, which votes only on the THREE
 * entries whose ac differs between the tables (RisingAbyssB 3/101, Swords1
 * 17/112, Quickslash 105/105.1) and abstains on everything else.
 *
 * Candidates are walked largest-first and the walk STOPS at the first match, so
 * on a normal machine this parses two frame traces, not nine.
 */
function pickRoute(dir, cands, route) {
  for (const p of cands) {
    let got = null;
    try {
      got = detectRoute(recoverLaunches(readTrace(join(dir, p.trace)))).route;
    } catch { got = null; }
    if (got === route) return { ...p, route };
  }
  return null;
}

/**
 * The oracle checks verify-kaizo.mjs actually ENFORCES, read out of its WIRED
 * set rather than restated here.
 *
 * WHY IT IS SCANNED AND NOT LISTED. The header of this file carried a hardcoded
 * coverage note that said -crescent, -splitter and -weird were "not wired into
 * the gate, so there is nothing here to protect yet". It was true when written
 * and false from the day all three were wired, and nothing noticed, because a
 * stale coverage note is indistinguishable from an accurate one. A list here
 * would rot the same way. This is a TEXT SCAN of another file's source, which is
 * fragile in a different direction — so it refuses to report "no gaps" when it
 * cannot see at least the checks this file already covers, because a scan that
 * silently matched nothing would recreate the exact defect it replaces.
 */
function wiredOracleChecks() {
  let text;
  try {
    text = readFileSync(join(HERE, '..', 'verify-kaizo.mjs'), 'utf8');
  } catch {
    return null;
  }
  const block = /const\s+WIRED\s*=\s*new\s+Set\(\[([\s\S]*?)\]\);/.exec(text);
  if (!block) return null;
  const names = new Set();
  for (const m of block[1].matchAll(/'(check-oracle-[a-z0-9-]+)'/g)) {
    names.add(m[1].replace('check-oracle-', ''));
  }
  return names.size ? names : null;
}

/** size + mtime + sha256 of every source file, so "untouched" is provable. */
function manifest(dir) {
  const out = new Map();
  for (const f of readdirSync(dir).filter((x) => /\.csv$/.test(x))) {
    const p = join(dir, f);
    const s = statSync(p);
    out.set(f, {
      size: s.size,
      mtimeMs: s.mtimeMs,
      sha: createHash('sha256').update(readFileSync(p)).digest('hex'),
    });
  }
  return out;
}

function main() {
  const only = process.argv.includes('--only')
    ? process.argv[process.argv.indexOf('--only') + 1] : null;

  const { dir, found, looked } = resolveTraces();
  if (!dir) {
    // The same loud skip the checks themselves give, for the same reason: on a
    // machine with no oracle there is nothing to sabotage, and reddening the
    // gate here would punish exactly the machines the loud-skip contract exists
    // to protect.
    console.log('SKIP sabotage-oracle-checks: no kaizo oracle recording found');
    for (const l of looked ?? []) console.log(`     looked in ${l}`);
    console.log('     THE TEN WIRED ORACLE CHECKS COVERED HERE ARE UNGUARDED ON THIS MACHINE.');
    return 0;
  }

  const cands = pairsIn(dir, found);
  const pair = cands[0] ?? null;
  if (!pair) {
    console.log('SKIP sabotage-oracle-checks: no recording here carries both a per-spawn');
    console.log(`     companion and the kaizo_playing column. Found: ${found.join(', ')}`);
    console.log(`     in ${dir}. Re-record with the current run-kaizo-oracle.ps1.`);
    return 0;
  }

  // THE B-SIDE PAIR, for the one case that proves a route-D comparison can
  // fail. Its absence is not an error: the recorder pinned global.flag[456] to
  // 0 until 2026-08-29, so every recording made before then is route C and a
  // machine can legitimately hold nothing else. It is announced loudly instead,
  // the same contract the whole-harness skip above follows.
  const sideb = pickRoute(dir, cands, 'D');

  console.log(`sabotage-oracle-checks: ${dir}`);
  console.log(`  corrupting copies of ${pair.trace} / ${pair.seq}`);
  console.log(sideb
    ? `  route-D pair: ${sideb.seq} (detected from its own launches, not its name)`
    : '  route-D pair: NONE — no recording here detects as the B-Side route');

  // ── the scratch copy ────────────────────────────────────────────────────
  const root = SCRATCH_ROOT;
  if (!root.includes(SCRATCH_MARK)) throw new Error('refusing to clear an unmarked directory');
  rmSync(root, { recursive: true, force: true });
  const work = join(root, 'work');
  const empty = join(root, 'empty');
  mkdirSync(work, { recursive: true });
  mkdirSync(empty, { recursive: true });

  const before = manifest(dir);
  for (const f of before.keys()) copyFileSync(join(dir, f), join(work, f));
  console.log(`  copied ${before.size} file(s) to ${work}`);

  // The pristine text of every file a case may rewrite, held in memory so a
  // restore never re-reads (and can never accidentally re-WRITE) the source.
  //
  // Only the files a case ACTUALLY corrupted are written back. The recordings
  // are 3-5 MB each and the harness runs inside the kaizo gate; rewriting all
  // of them before every case cost more than the corruptions themselves, and a
  // slow gate is one people stop running. `dirty` is the exact set, so this is
  // cheaper without being weaker — a file that was never touched cannot need
  // restoring, and the manifest at the bottom re-hashes the SOURCES either way.
  const pristine = new Map();
  const dirty = new Set();
  const arm = (files) => {
    for (const f of files) {
      if (!pristine.has(f)) pristine.set(f, readFileSync(join(work, f), 'utf8'));
    }
  };
  const restore = () => {
    for (const f of dirty) writeFileSync(join(work, f), pristine.get(f));
    dirty.clear();
  };
  arm([pair.trace, pair.seq, ...(sideb ? [sideb.seq] : [])]);

  // ── the schedule case needs a target picked out of the recording ────────
  //
  // Not hardcoded: `difficulty` is a per-launch scalar and which entries carry
  // a non-zero one is a property of the mod's schedule, not of this file. The
  // first launch with a non-zero difficulty is the target, and zeroing it must
  // be reported as a mismatch against the generated table.
  const launches = recoverLaunches(readTrace(join(work, pair.trace)));
  const diffTarget = launches.find((L) => L.difficulty !== null && L.difficulty !== 0);
  if (!diffTarget) {
    console.log('  NOTE: no launch in this recording carries a non-zero difficulty, so the');
    console.log('        schedule case has nothing to zero. Reported as a failure below.');
  }

  const CASES = [
    {
      family: 'schedule',
      // The one field of the four the selector copies out of the mod's struct
      // that sabotage-oracle-schedule does NOT already corrupt (it covers ac,
      // the arena, the turn clock and the chain). If `difficulty` is not in the
      // comparison, every variant-selecting number in the schedule is unchecked.
      name: diffTarget
        ? `${diffTarget.played}'s difficulty ${diffTarget.difficulty} -> 0`
        : 'a launch difficulty -> 0',
      looksAt: pair.trace,
      apply: () => {
        if (!diffTarget) throw new Error('no launch with a non-zero difficulty to corrupt');
        return setColumnInWindow(join(work, pair.trace), {
          column: 'difficulty',
          from: diffTarget.difficulty,
          to: 0,
          lo: diffTarget.frame,
          hi: diffTarget.frame + 30,
        });
      },
      expect: diffTarget ? `${diffTarget.played}: difficulty` : 'difficulty',
      why: 'the schedule\'s difficulty column is not being compared, so every'
        + ' variant-selecting number in the table is unchecked',
    },
    {
      family: 'stars',
      // NOT a row drop. check-oracle-stars says so itself: "counts NOT
      // compared, the turn clock is graze-driven". Its timing claims are the
      // first star's offset from the cone and the single-valued gap set, so a
      // ONE-FRAME shift is the corruption that reaches them.
      name: 'the first star of the opening Starstorm moved one frame later',
      looksAt: pair.seq,
      apply: () => shiftFirstSpawn(join(work, pair.seq), {
        object: 'obj_knight_pointing_star', playing: 'atk_Starstorm1', delta: 1,
      }),
      expect: 'the first star lands 33 frames after the cone',
      why: 'the cone-relative spawn frame is not being compared, so the stars'
        + ' could fire on any cadence and the check would still be green',
    },
    {
      family: 'multislash',
      name: 'one slash in three dropped from atk_Multislash3',
      looksAt: pair.seq,
      apply: () => dropEveryNth(join(work, pair.seq), {
        object: 'obj_roaringknight_slash', playing: 'atk_Multislash3', n: 3,
      }),
      expect: 'atk_Multislash3: obj_roaringknight_slash count',
      why: 'the per-type spawn counts are not reaching the diff, and the'
        + ' difficulty-2 rung of the slash ladder is the whole point of this check',
    },
    {
      family: 'stream',
      // 100 is a literal loop bound (5 cycles x 2 beams x slash_amt 5 x 2
      // signs), which is what makes it a good target: the check asserts the
      // number on BOTH sides, so a parser that read nothing would see 0 == 0
      // only if the assertion were written the lazy way. It is not, and this
      // proves it.
      name: 'one streamline in four dropped from atk_XAttacks',
      looksAt: pair.seq,
      apply: () => dropEveryNth(join(work, pair.seq), {
        object: 'obj_knight_streamline', playing: 'atk_XAttacks', n: 4,
      }),
      expect: 'exactly 100 obj_knight_streamline on BOTH sides',
      why: 'the streamline ledger is not being read, so ac 107\'s beam geometry'
        + ' is unverified',
    },
    {
      family: 'tunnel',
      name: 'one corridor sword in four dropped from atk_Tunnel1',
      looksAt: pair.seq,
      apply: () => dropEveryNth(join(work, pair.seq), {
        object: 'obj_sword_tunnel_sword', playing: 'atk_Tunnel1', n: 4,
      }),
      expect: 'swords = 2 x \\d+ pairs',
      why: 'the corridor ledger is not being read, so the tunnel\'s pair'
        + ' structure and its up/down/none walk are unverified',
    },
    {
      family: 'tracking',
      name: 'one diagonal bullet in four dropped from atk_DiamondStorm',
      looksAt: pair.seq,
      apply: () => dropEveryNth(join(work, pair.seq), {
        object: 'obj_diagonal_bullet', playing: 'atk_DiamondStorm', n: 4,
      }),
      expect: 'obj_diagonal_bullet: count',
      why: 'the type-152 ledger is not being read — and this check is the only'
        + ' thing holding kaizo/attacks/diagonal-bullets.js against the mod',
    },
    {
      family: 'vortex',
      // The count is compared through the sim's own 13-seed spread {16, 17, 18}
      // rather than to a literal, so this also proves that envelope is not
      // wide enough to swallow anything.
      name: 'one falling sword in four dropped from atk_Vortex1',
      looksAt: pair.seq,
      apply: () => dropEveryNth(join(work, pair.seq), {
        object: 'obj_fallingsword', playing: 'atk_Vortex1', n: 4,
      }),
      expect: 'obj_fallingsword count \\(\\d+\\) is outside everything the sim produces',
      why: 'the type-108 rain is not being counted, or the 13-seed envelope has'
        + ' been widened until it accepts anything',
    },
    {
      family: 'quickslash',
      name: 'one quickslash cut in four dropped from atk_Quickslash',
      looksAt: pair.seq,
      apply: () => dropEveryNth(join(work, pair.seq), {
        object: 'obj_roaringknight_quickslash', playing: 'atk_Quickslash', n: 4,
      }),
      expect: 'obj_roaringknight_quickslash: oracle \\d+, sim \\d+',
      why: 'the cut ledger is not being read, so the barrage exit test this'
        + ' check was written to pin (gmlLte(2.27, spawn_phase)) is unguarded',
    },
    {
      family: 'crescent',
      // NOT a row drop, and check-oracle-crescent says why itself: "THE TOTAL
      // WAVE COUNT" is explicitly NOT claimed, because the recorder's turn clock
      // takes twelve non-unit decrements across this turn (one of them 12 units
      // in a single frame), so the mod fires 15 waves where the sim fires 16 and
      // the check asserts the GATE instead of the count. Dropping crescents
      // would land on a population it deliberately does not compare.
      //
      // What it DOES compare, and what nothing else in the tree does, is a
      // POSITION: the six lanes the whole attack is aimed down, recovered from
      // the recording (every telegraph is created at the generator's y + 18) and
      // held against the sim generator's own generated `ypos` table. That table
      // is decided by WHEN the generator reads the board during the 15-frame
      // grow-in, so it is the sharpest number in the family — 13 grow-frames
      // would give 18.571px lanes and 15 would give 21.43px.
      //
      // +3px is chosen so the recording still passes its OWN self-checks: the
      // lanes stay six, stay 20px apart, and still imply boxheight 140, so
      // section 1 is green throughout and the failure is unambiguously the
      // mod-against-sim comparison rather than "the file got mangled".
      name: "atk_CrescentSlash's telegraphs moved 3px down (the lane table moves with them)",
      looksAt: pair.seq,
      apply: () => shiftColumn(join(work, pair.seq), {
        object: 'obj_knight_crescentslash_slashinganimation',
        playing: 'atk_CrescentSlash',
        column: 'y',
        delta: 3,
      }),
      expect: "the generator's ypos table IS the recorded lane table",
      why: 'the six lanes are not being compared, so ac 0 could aim anywhere'
        + ' and the check would still be green — and the lane table is the one'
        + " number that pins WHICH grow-in frame the generator read the board on",
    },
    {
      family: 'splitter',
      // THE MARKER POPULATION IS TWO POPULATIONS. check-oracle-splitter reads a
      // single object name, obj_marker, and splits it by POSITION
      // (`classifyMarkers`): the organism's Create puts two flame markers at the
      // box centre +(2,-1) and +(0,2), and every other marker is the per-slash
      // slashmarker scr_dark_marker drops at the slash's own (x, y).
      //
      // A blind drop would take out a flame and trip "the recording shows N
      // flame markers, not 2" — an assertion about the RECORDING's shape, which
      // says nothing about whether the recreation is being compared to anything.
      // That is the wrong assertion for the wrong reason, and reporting it as a
      // pass would be this file's own defect.
      //
      // So `only` keeps the two flames out of the drop entirely. Both flame
      // assertions stay GREEN through the sabotage, which makes this case a
      // positive result about the classifier as well as a negative one about the
      // count: the slashmarker half moved, the flame half did not, and the check
      // told them apart.
      //
      // The centre is the 2x2 board at (320, 170) that all three splitter rows
      // raise — the check reads it from `arenaGeom` and asserts it before using
      // it, so the two offsets below are not a second, unchecked copy of it.
      name: 'one slashmarker in two dropped from atk_Splitter1 — BOTH FLAME MARKERS KEPT',
      looksAt: pair.seq,
      apply: () => dropEveryNth(join(work, pair.seq), {
        object: 'obj_marker',
        playing: 'atk_Splitter1',
        n: 2,
        what: 'slashmarker (obj_marker away from the flame offsets)',
        only: (c, col) => {
          const x = Number(c[col.x]);
          const y = Number(c[col.y]);
          const flameA = x === 322 && y === 169; // box (320,170) + (2,-1)
          const flameB = x === 320 && y === 172; // box (320,170) + (0, 2)
          return !flameA && !flameB;
        },
      }),
      expect: 'atk_Splitter1: slashmarker \\(obj_marker\\) count',
      why: 'the slashmarker ledger is not reaching the diff — and the'
        + ' slashmarker is the whole reason this check exists: it was UNMODELLED'
        + ' in splitslash.js until this check measured it',
      // The flames must survive the sabotage, or the case proved something else.
      also: (out) => (/^\s*-\s+.*flame markers/m.test(out)
        ? 'a FLAME marker assertion failed too, so the drop did not respect'
          + ' classifyMarkers() and this case is tripping the wrong assertion'
        : null),
    },
    {
      family: 'weird',
      // THE ELEVENTH CHECK, and until this case it was the one wired check with
      // no repeatable guard at all.
      //
      // A row drop would land badly here. check-oracle-weird's population
      // assertions about obj_regularbullet are almost all MOD-INTERNAL — "seven
      // fans per big shot", "every volley lands on the SAME frame", "five at
      // speed 4 and two at 6" — so dropping fan rows trips a description of the
      // recording rather than a comparison with the recreation, which is the
      // splitter trap in a different costume.
      //
      // The orb ring is the opposite: `oOrbs`/`sOrbs` are compared as sorted
      // ten-decimal strings, mod against sim, and the check's own summary names
      // "orb geometry to ten decimals" as one of the four blocks it ran. Moving
      // the five orbs 3px sideways is the smallest thing that reaches it.
      //
      // It also trips the mod-internal claim that ac 3's ring and ac 106's ring
      // land on the SAME ten-decimal positions 7850 frames apart (no RNG in the
      // ellipse) — because only one of the two entries is moved. That is a
      // second, independent assertion catching the same corruption, which is
      // what a well-built check should do.
      name: "atk_RisingAbyssB's five underbox orbs moved 3px right",
      looksAt: pair.seq,
      apply: () => shiftColumn(join(work, pair.seq), {
        object: 'obj_knight_weird_circle',
        playing: 'atk_RisingAbyssB',
        column: 'x',
        delta: 3,
      }),
      expect: 'atk_RisingAbyssB: orb x, exact to ten decimals',
      why: 'the orb ring is not being compared to the sim, so the ellipse ac 3'
        + ' and ac 106 both lay their five orbs on — the geometry the whole'
        + ' underbox family hangs off — is unverified',
      // The route-D half must not move: this case corrupts the route-C
      // recording only, and -weird reads BOTH. Together with the multislash-D
      // case below (which corrupts the B-Side and must leave route C alone)
      // this pins the two halves as independent in BOTH directions.
      also: (out) => {
        const d = out.split('\n').filter((l) => /^\s*-\s+\[route D\]/.test(l));
        return d.length
          ? `${d.length} ROUTE-D assertion(s) failed too, from a corruption applied`
            + ' only to the route-C recording: ' + d[0].trim().slice(0, 110)
          : null;
      },
    },
    ...(sideb ? [{
      family: 'multislash',
      label: 'multislash (ROUTE D)',
      // THE ONLY CASE THAT CORRUPTS THE B-SIDE RECORDING.
      //
      // check-oracle-multislash takes the longest recording PER SIDE and runs
      // the whole ladder twice, tagging every assertion `A/` or `B/`. Nine of
      // the cases above corrupt `_deep`, which reddens its A half and says
      // nothing about its B half — and route D is not a difficulty tweak, it is
      // more content (ORACLE-GROUND-TRUTH: 54% more gameplay objects, three
      // entries with a different ac, its own arena table). atk_Multislash3 is
      // 94 slashes on route C and 150 on route D, so a B half that had stopped
      // comparing would look exactly like one that agreed with the mod.
      //
      // `also` is what makes this a route-D case rather than a tenth route-C
      // one: NOT ONE `A/` assertion may move. If corrupting the B-Side recording
      // reddened the A-Side too, the failure would be the check falling over
      // rather than its D half doing its job, and the case would prove nothing
      // about route D at all.
      name: "one slash in three dropped from the B-SIDE's atk_Multislash3",
      looksAt: sideb.seq,
      corrupts: [sideb.seq],
      apply: () => dropEveryNth(join(work, sideb.seq), {
        object: 'obj_roaringknight_slash', playing: 'atk_Multislash3', n: 3,
      }),
      expect: 'B/atk_Multislash3: obj_roaringknight_slash count',
      why: "the B-Side half of this check's comparisons is not reading the"
        + ' recording, so route D — the harder, larger fight — is unverified'
        + ' while the gate reports it green',
      also: (out) => {
        const aSide = out.split('\n').filter((l) => /^\s*-\s+A\//.test(l));
        return aSide.length
          ? `${aSide.length} ROUTE-C assertion(s) failed too, so this case did not`
            + ' isolate the D half: ' + aSide[0].trim().slice(0, 110)
          : null;
      },
    }] : []),
  ]
    .map((c) => ({ ...c, label: c.label ?? c.family, corrupts: c.corrupts ?? [c.looksAt] }))
    .filter((c) => !only || c.family === only || c.label === only);

  let bad = 0;
  const timings = [];

  for (const c of CASES) {
    const t0 = Date.now();
    console.log(`\n  check-oracle-${c.label}`);
    restore();

    // ── 1. THE CONTROL ────────────────────────────────────────────────────
    const control = runCheck(c.family, work);
    if (control.code !== 0) {
      bad += 1;
      console.log('    CONTROL FAILED — the check does not pass against an UNCORRUPTED');
      console.log(`    copy of the recordings (exit ${control.code}), so nothing below could be`);
      console.log('    attributed to the sabotage. Fix the check, or the copy, first.');
      for (const l of control.out.split('\n').filter((l) => /FAIL|Error/.test(l)).slice(0, 6)) {
        console.log(`      ${l.trim()}`);
      }
      timings.push([c.label, Date.now() - t0]);
      continue;
    }
    // The check must be LOOKING AT the file the case corrupts. Every one of the
    // eight prints the recording it opened; if the name is absent, the case is
    // about to corrupt a file nobody reads and a green result would mean
    // nothing at all.
    if (!control.out.includes(c.looksAt)) {
      bad += 1;
      console.log(`    CANNOT TARGET: the check never named ${c.looksAt}, so it is`);
      console.log('    reading some other recording and this case would corrupt a file it');
      console.log('    never opens. Not a pass and not a failure of the check — a failure of');
      console.log('    THIS harness to aim, and it must be fixed rather than reported green.');
      timings.push([c.label, Date.now() - t0]);
      continue;
    }
    console.log(`    control: passes on the clean copy, reading ${c.looksAt}`);

    // ── 2. THE EMPTY DIRECTORY ────────────────────────────────────────────
    // Exit 0 and a loud skip. This is also the proof that KAIZO_ORACLE_TRACES
    // is honoured — without it the corruption below could be landing on a file
    // the check never opens and the whole case would be measuring nothing.
    const skip = runCheck(c.family, empty);
    const skipped = new RegExp(`SKIP check-oracle-${c.family}`).test(skip.out);
    if (skip.code === 0 && skipped) {
      console.log('    empty trace dir: SKIPs loudly at exit 0 (safe to wire on a machine'
        + ' with no oracle)');
    } else {
      bad += 1;
      console.log(`    FAIL empty trace dir: exit ${skip.code}, loud skip ${skipped ? 'yes' : 'NO'}`);
      console.log('         wiring this check would redden every machine without the private');
      console.log('         recordings — or, at exit 0 with no SKIP line, would report a');
      console.log('         machine that checked NOTHING as one that agrees with the mod.');
    }

    // ── 3. THE SABOTAGE ───────────────────────────────────────────────────
    // Marked dirty BEFORE the mutation, not after: a mutator that threw
    // halfway through `store()` would leave a half-written file that the
    // restore must still put back.
    for (const f of c.corrupts) {
      if (!pristine.has(f)) throw new Error(`case ${c.label} corrupts unarmed file ${f}`);
      dirty.add(f);
    }
    let applied;
    try {
      applied = c.apply();
    } catch (e) {
      bad += 1;
      console.log(`    FAIL could not apply the sabotage: ${e.message}`);
      console.log('         A corruption that did not land would leave the check passing on a');
      console.log('         clean file and be reported as "cannot fail" — so it is refused here.');
      restore();
      timings.push([c.label, Date.now() - t0]);
      continue;
    }
    console.log(`    sabotage: ${c.name}`);
    console.log(`              (${applied})`);

    // ── 3a. THE FILE THE CHECK IS ABOUT TO OPEN IS THE MUTATED ONE ────────
    //
    // Two different claims, and only both together mean anything:
    //
    //   mustHaveApplied  the mutator's row filter MATCHED — in memory, in this
    //                    process. Says nothing about the filesystem.
    //   this             the file at that path still exists and is no longer
    //                    the pristine copy. Says nothing about WHAT changed.
    //
    // They came apart exactly once, and expensively: a concurrent run of this
    // harness re-copied the scratch directory between the mutation and the
    // check, so the check read a pristine file, passed, and was reported as
    // having "passed on a corrupted recording" — a false accusation against a
    // check that was working. Reading the bytes back closes that gap for any
    // cause, not just that one, at the price of a few MB of I/O against a
    // comparison that already spawns a Node process.
    const notOnDisk = c.corrupts.filter((f) => {
      try {
        return readFileSync(join(work, f), 'utf8') === pristine.get(f);
      } catch {
        return true; // gone entirely — the strongest form of the same fault
      }
    });
    if (notOnDisk.length) {
      bad += 1;
      console.log(`    FAIL the corrupted copy is not on disk: ${notOnDisk.join(', ')} reads`);
      console.log('         byte-for-byte as the pristine copy, or has vanished. The check');
      console.log('         below would be measuring an UNCORRUPTED recording and its result');
      console.log('         would mean nothing either way. This is a fault in THIS harness or');
      console.log('         in its scratch directory — never evidence about the check. Look');
      console.log(`         for a second process writing ${work}.`);
      restore();
      timings.push([c.label, Date.now() - t0]);
      continue;
    }

    const r = runCheck(c.family, work);
    const want = failureLine(c.expect);
    const hit = want.exec(r.out);
    // A SECOND CONDITION, where the expected failure line alone would not say
    // what the case claims. Both users are cases whose point is that something
    // else must NOT have moved: the splitter's two flame markers, and every
    // route-C assertion in the route-D case. Without it, a corruption that
    // reddened the whole check would satisfy the regex and be reported as proof
    // of something it did not show.
    const alsoBad = hit && r.code !== 0 && c.also ? c.also(r.out) : null;
    if (r.code !== 0 && hit && !alsoBad) {
      console.log(`    OK   exit ${r.code}, and it failed on the expected assertion:`);
      console.log(`           ${hit[0].trim().slice(0, 150)}`);
      if (c.also) console.log('           (and nothing this case requires to stay green moved)');
    } else if (alsoBad) {
      bad += 1;
      console.log(`    FAIL exit ${r.code} on the expected assertion, but the case did not`);
      console.log('         isolate what it claims to isolate:');
      console.log(`           ${alsoBad}`);
      console.log('         Reporting this green would credit the case with a result it did');
      console.log('         not produce, which is the defect this file exists to catch.');
      console.log(`         ${c.why}`);
    } else {
      bad += 1;
      console.log(`    FAIL exit ${r.code}; expected a failure line matching /${c.expect}/`);
      if (r.code === 0 && new RegExp(`SKIP check-oracle-${c.family}`).test(r.out)) {
        // EXIT 0 WITH A LOUD SKIP IS NOT A PASS, and calling it one is how this
        // harness once accused a correct check. The skip contract (step 4) says
        // a check that cannot find a recording must exit 0 and say so; if it
        // says so HERE, the scratch copy it was pointed at is not there, which
        // is a fault in this harness and not in the check.
        console.log('         THE CHECK SKIPPED — it found no recording in the scratch copy,');
        console.log('         which is the loud-skip contract working, not a defect. Something');
        console.log(`         removed the recordings from ${work} mid-run.`);
        console.log('         Do NOT read this as "the check passed on a corrupted recording".');
      } else if (r.code === 0) {
        console.log('         THE CHECK PASSED ON A CORRUPTED RECORDING. Whatever it is');
        console.log('         reporting green, it is not this.');
      } else {
        const fails = r.out.split('\n').filter((l) => /^\s*(?:FAIL|-)\s/.test(l)).slice(0, 6);
        console.log('         it did fail, but on something else:');
        for (const l of fails) console.log(`           ${l.trim().slice(0, 140)}`);
      }
      console.log(`         ${c.why}`);
    }
    restore();
    timings.push([c.label, Date.now() - t0]);
  }

  // ── THE RECORDINGS ARE GROUND TRUTH AND EACH COSTS A GAME RUN ───────────
  // Size, mtime and sha256 of every source file, compared against the manifest
  // taken before the copy. A sabotage harness that damaged the thing it is
  // guarding would be the single worst outcome available in this directory.
  const after = manifest(dir);
  const moved = [];
  for (const [f, b] of before) {
    const a = after.get(f);
    if (!a) { moved.push(`${f}: GONE`); continue; }
    if (a.sha !== b.sha) moved.push(`${f}: CONTENT CHANGED`);
    else if (a.size !== b.size) moved.push(`${f}: size ${b.size} -> ${a.size}`);
    else if (a.mtimeMs !== b.mtimeMs) moved.push(`${f}: mtime moved`);
  }
  for (const f of after.keys()) if (!before.has(f)) moved.push(`${f}: NEW FILE in the source dir`);
  console.log('');
  if (moved.length) {
    bad += 1;
    console.log(`  THE ORIGINAL RECORDINGS WERE MODIFIED — ${moved.length} file(s):`);
    for (const m of moved) console.log(`    - ${m}`);
    console.log('  Each of these is a real game run. Restore them before anything else.');
  } else {
    console.log(`  the ${before.size} original recordings are byte-identical and untouched`
      + ' (size, mtime, sha256)');
  }

  const total = timings.reduce((s, [, ms]) => s + ms, 0);
  console.log(`  runtime ${(total / 1000).toFixed(1)}s — `
    + timings.map(([f, ms]) => `${f} ${(ms / 1000).toFixed(1)}s`).join(', '));

  // WHAT IS STILL UNGUARDED, SAID EVERY RUN rather than left to this file's
  // header. A coverage gap nobody reads is a coverage gap nobody closes, and
  // this harness's whole purpose is to stop "green" from meaning less than it
  // looks. Both lines below are conditions of the MACHINE and the WIRED set,
  // not failures, so neither reddens the gate.
  const families = new Set(CASES.map((c) => c.family));
  const wired = only ? null : wiredOracleChecks();
  if (!only && !wired) {
    console.log('  COVERAGE UNKNOWN: could not read verify-kaizo.mjs\'s WIRED set, so this');
    console.log('  run cannot say whether every wired oracle check has a case here. Do not');
    console.log('  read the OK below as "all of them" until that scan works again.');
  } else if (wired) {
    const uncovered = [...wired].filter((f) => !families.has(f)).sort();
    if (uncovered.length) {
      console.log(`  NOT COVERED HERE: check-oracle-${uncovered.join(', check-oracle-')}`
        + ` — WIRED into the gate (${wired.size} check(s)) with no case in this file, so`);
      console.log('  each rests on a one-off manual sabotage run that nothing re-runs.');
    } else {
      console.log(`  every one of verify-kaizo.mjs's ${wired.size} WIRED oracle checks has a`
        + ' case here');
    }
    const extra = [...families].filter((f) => !wired.has(f)).sort();
    if (extra.length) {
      console.log(`  (cases here for check(s) NOT in the WIRED set: ${extra.join(', ')} —`
        + ' harmless, but they are guarding something the gate does not enforce)');
    }
  }
  if (!sideb && !only) {
    console.log('  ROUTE D IS UNGUARDED ON THIS MACHINE: no recording here detects as the');
    console.log('  B-Side, so every case above corrupted a route-C recording and the D half');
    console.log('  of every check is unproven able to fail. Record one with -SideB 1.');
  }

  if (bad) {
    // KEPT ON FAILURE, deliberately: the corrupted copy is the evidence, and
    // re-running one check by hand against it is the first thing anyone will
    // want to do. The path is printed because it is not obvious.
    console.log(`\n  the scratch copy is left at ${work} for inspection`);
    console.log(`\n  ${bad} of ${CASES.length} sabotage case(s) did NOT prove what they claim.`);
    console.log('  Until they do, the green lines those checks print in the kaizo gate are');
    console.log('  claims about the parser, not about EnderCat8\'s mod.');
    return 1;
  }
  // DELETED ON SUCCESS. These are copies of the private recordings
  // (knight-research is never published) and there is no reason to leave 18 MB
  // of them sitting in the OS temp directory once they have done their job.
  rmSync(root, { recursive: true, force: true });
  // "oracle check(s)", not "WIRED oracle check(s)" — whether they are all wired
  // is the coverage line's claim above, and it is not always able to make it.
  console.log(`\n  all ${CASES.length} sabotage case(s) over ${families.size} oracle`
    + ' check(s): control green, empty dir skips, corrupted recording caught   OK');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
