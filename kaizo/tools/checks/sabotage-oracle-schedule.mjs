#!/usr/bin/env node
// SABOTAGE TEST for check-oracle-schedule.mjs.
//
//   node kaizo/tools/checks/sabotage-oracle-schedule.mjs [trace.csv]
//
// A check that cannot fail is not a check. check-oracle-schedule reports 84
// assertions green against a recording of EnderCat8's mod, and that number is
// worth exactly nothing until someone has shown the assertions can go red.
//
// This is the concern CLAUDE.md raises under "A green suite does not mean a
// change took effect": twice in one session a change that altered NOTHING
// passed all 39 suites, because "unchanged" and "correct" look identical to a
// regression test. The same trap is wider here, because this check reads its
// truth from a FILE. A typo'd column name, a comparison that always sees
// `undefined === undefined`, a loop that never enters — each produces a clean
// green run against a real recording.
//
// So: corrupt the ORACLE side in known ways and require a specific failure for
// each. The trace is corrupted rather than the sim's tables because that is the
// direction that also proves the check is READING the recording at all.
//
// The four mutations are not arbitrary. Each targets a claim that would
// otherwise rest on one number in one file:
//
//   ac            the dispatch key. If this is not compared, the check verifies
//                 nothing about which attack ran.
//   half-to-even  the tunnel board records 2.9866666794 because GML's round()
//                 sends 3 * 37.5 = 112.5 DOWN to 112. JS Math.round sends it to
//                 113. Feeding the check a clean 3 must fail, or the quantiser
//                 is not in the comparison and sim/battlebox.js's most delicate
//                 line is unguarded.
//   x 148         the mod moves ac 0's board from vanilla's 168. This is a
//                 MOD DELTA — one of the few the geometry table encodes — and
//                 feeding the check the vanilla value must fail.
//   degeneracy    a recording of two launches must be refused, not passed.
//                 verify-fullfight learned this the expensive way: its first
//                 whole-fight recordings ran ONE turn and the differ cheerfully
//                 reported "exact through frame 21".

import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  readTrace, recoverLaunches, checkAgainstTable, degeneracy, classify,
  detectRoute, resolveTraces,
} from './check-oracle-schedule.mjs';

/** Rewrite one column's value on every row inside a frame window. */
function mutate(text, column, from, to, lo, hi) {
  const lines = text.replace(/\r/g, '').trimEnd().split('\n');
  const header = lines[0].split(',');
  const idx = header.indexOf(column);
  if (idx < 0) throw new Error(`no ${column} column`);
  let touched = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const frame = Number(cells[0]);
    if (frame < lo || frame > hi) continue;
    if (cells[idx] !== from) continue;
    cells[idx] = to;
    lines[i] = cells.join(',');
    touched++;
  }
  // A MUTATION THAT CHANGED NOTHING WOULD PASS THE CHECK AND PROVE NOTHING.
  // Without this the sabotage test degrades into the exact false confidence it
  // was written to prevent.
  if (touched === 0) {
    throw new Error(`sabotage did not apply: no row in frames ${lo}..${hi}`
      + ` had ${column} === ${from}`);
  }
  return { text: lines.join('\n'), touched };
}

/**
 * A PER-PROCESS scratch directory, not a fixed path.
 *
 * These files used to be written straight into the OS temp dir as
 * `kaizo-sabotage-<name>.csv`. That name is the same for every run, so two
 * concurrent invocations — the gate running this while someone runs it by hand,
 * or two gate runs at once — overwrite each other's mutations mid-comparison.
 * The result is a corrupted-file check reporting a failure that belongs to the
 * other process, i.e. THE HARNESS FALSELY ACCUSING A CORRECT CHECK. Its twin,
 * sabotage-oracle-checks.mjs, was measured doing exactly that.
 *
 * Also: these are mutated copies of PRIVATE recordings. They are cleaned up on
 * the way out rather than left in the OS temp directory.
 */
const SCRATCH = join(tmpdir(), `kaizo-sabotage-schedule-${process.pid}`);

function tmp(name, text) {
  mkdirSync(SCRATCH, { recursive: true });
  const p = join(SCRATCH, `${name}.csv`);
  writeFileSync(p, text);
  return p;
}

function cleanup() {
  try {
    rmSync(SCRATCH, { recursive: true, force: true });
  } catch {
    // Best effort. A leftover scratch directory is untidy, never wrong — the
    // next run has a different pid and cannot read this one's files.
  }
}

/** Run the check in-process and return its failure list. */
function run(path) {
  const t = readTrace(path);
  const launches = recoverLaunches(t);
  const why = degeneracy(launches);
  if (why.length) return { degenerate: why, failures: [] };
  return { degenerate: [], ...checkAgainstTable(launches) };
}

function main() {
  let path = process.argv[2];
  if (!path) {
    const { dir, found, looked } = resolveTraces();
    if (!dir) {
      console.log('SKIP sabotage-oracle-schedule: no kaizo oracle recording found');
      for (const l of looked) console.log(`     looked in ${l}`);
      return 0;
    }
    // The LONGEST recording. The mutations below need somewhere to land — a
    // MODE 1 attack-lock run replays one entry and contains no Tunnel1 turn to
    // corrupt — and the degeneracy case is built by truncating this one rather
    // than needing a second file.
    path = found
      .map((f) => join(dir, f))
      .map((p) => ({ p, n: readFileSync(p, 'utf8').length }))
      .sort((a, b) => b.n - a.n)[0].p;
  }

  const base = readFileSync(path, 'utf8');
  console.log(`sabotage-oracle-schedule: ${path}`);

  // THE CONTROL. If the unmutated recording does not pass, every "it failed"
  // below is uninformative — a check that fails on everything is as useless as
  // one that passes on everything, and only the control tells them apart.
  const control = run(path);
  if (control.degenerate.length || control.failures.length) {
    console.log('  CONTROL FAILED — the unmutated recording does not pass, so');
    console.log('  nothing below can be attributed to the sabotage:');
    for (const w of [...control.degenerate, ...control.failures]) console.log(`    - ${w}`);
    return 1;
  }
  console.log(`  control: ${control.checks} assertions green on the real recording`);

  // Frame windows come from the recovered chain rather than being hardcoded, so
  // a re-recording with different turn lengths does not silently stop landing.
  const launches = recoverLaunches(readTrace(path));
  const find = (id) => {
    const i = launches.findIndex((L) => L.played === id);
    if (i < 0) throw new Error(`the recording never played ${id}`);
    const lo = i === 0 ? 0 : launches[i - 1].frame + 1;
    return { lo, hi: launches[i].frame + 20 };
  };

  const cases = [];

  {
    const w = find('atk_Tunnel1');
    const m = mutate(base, 'attackchoice', '13.0000000000', '12.0000000000', w.lo, w.hi);
    cases.push({
      name: 'ac 13 -> 12 on the Tunnel1 turn',
      path: tmp('ac', m.text),
      expect: /atk_Tunnel1: ac — table 13, oracle 12/,
      why: 'the dispatch key is not being compared',
    });
  }

  {
    // 112.5 rounds to 112 under GML's half-to-even and to 113 under JS's
    // half-away-from-zero. Handing the check a clean 3.0 is handing it the
    // answer an unquantised model would produce.
    const w = find('atk_Tunnel1');
    const m = mutate(base, 'gt_xs', '2.9866666794', '3.0000000000', w.lo, w.hi);
    cases.push({
      name: 'tunnel board 2.9866666794 -> a clean 3 (the un-quantised value)',
      path: tmp('quant', m.text),
      expect: /atk_Tunnel1: arena scale/,
      why: 'the 1/37.5 half-to-even quantiser is not in the comparison',
    });
  }

  {
    const w = find('atk_CrescentSlash');
    const m = mutate(base, 'gt_x', '148.0000000000', '168.0000000000', w.lo, w.hi);
    cases.push({
      name: "ac 0's board 148 -> 168 (the VANILLA position)",
      path: tmp('placement', m.text),
      expect: /atk_CrescentSlash: arena placement/,
      why: "the mod's own arena deltas are not being checked",
    });
  }

  {
    // THE CHAIN. Rename one turn to a DIFFERENT REAL ENTRY from later in the
    // schedule. Every per-launch assertion could still be satisfied by a
    // recording that played the right attacks in the wrong sequence, so the
    // order needs its own sabotage — this is the case that distinguishes "the
    // schedule is verified" from "these attacks all appear somewhere".
    const w = find('atk_Tunnel1');
    const m = mutate(base, 'kaizo_playing', 'atk_Tunnel1', 'atk_Swords3',
      launches.find((L) => L.played === 'atk_Tunnel1').frame, w.hi);
    cases.push({
      name: 'Tunnel1 relabelled as Swords3 (right attacks, wrong order)',
      path: tmp('chain', m.text),
      expect: /^chain — after atk_Splitter1/,
      why: 'succession is not being asserted, only per-entry facts',
    });
  }

  {
    // THE ARMED TURN CLOCK. The tunnel's dispatch floor is 450, so the launch
    // frame records 449 (one tick already taken). Feeding the check 350 — the
    // splitter's floor, a real number from a real turn — must fail, or
    // vcTurnLength is not being compared against anything.
    const w = find('atk_Tunnel1');
    const m = mutate(base, 'turntimer', '449.0000000000', '349.0000000000',
      launches.find((L) => L.played === 'atk_Tunnel1').frame, w.hi);
    cases.push({
      name: 'tunnel armed clock 449 -> 349 on the launch frame',
      path: tmp('turntimer', m.text),
      expect: /atk_Tunnel1: armed turn clock/,
      why: 'the dispatch turn floor is not being compared',
    });
  }

  {
    // NOTHING LAUNCHED. Truncated before the first launch, so the recording is
    // a battle that opened and stopped. It must be refused outright.
    const lines = base.replace(/\r/g, '').trimEnd().split('\n');
    const cut = launches[0].frame - 1;
    const kept = [lines[0], ...lines.slice(1).filter((l) => Number(l.split(',')[0]) <= cut)];
    cases.push({
      name: `truncated to ${cut} frames (nothing ever launched)`,
      path: tmp('degenerate', kept.join('\n')),
      expect: /nothing fired/,
      why: 'a recording with no fight in it is being reported as a match',
    });
  }

  let bad = 0;
  for (const c of cases) {
    const r = run(c.path);
    const msgs = [...r.degenerate, ...r.failures];
    const hit = msgs.some((m) => c.expect.test(m));
    if (hit) {
      console.log(`  OK   ${c.name}`);
      console.log(`         -> ${msgs.find((m) => c.expect.test(m))}`);
    } else {
      bad++;
      console.log(`  FAIL ${c.name}`);
      console.log(`         expected ${c.expect}, got ${msgs.length ? msgs.join(' | ') : 'NO FAILURES AT ALL'}`);
      console.log(`         ${c.why}`);
    }
  }

  // ── THE OVERCLAIM GUARD ───────────────────────────────────────────────────
  //
  // The cases above test that wrong numbers fail. This tests something the exit
  // code cannot express: that a recording which is NOT a schedule is not
  // DESCRIBED as one. A two-launch recording passes now — correctly, it pins two
  // entries — and the only thing standing between that and "the schedule is
  // verified" is the classification.
  //
  // This is the failure verify-fullfight actually shipped once: a differ
  // reporting "exact through frame 21" on a recording containing one turn. The
  // number was true. The sentence was not.
  {
    const lines = base.replace(/\r/g, '').trimEnd().split('\n');
    const cut = launches[1].frame + 30;
    const kept = [lines[0], ...lines.slice(1).filter((l) => Number(l.split(',')[0]) <= cut)];
    const p = tmp('partial', kept.join('\n'));
    const got = classify(recoverLaunches(readTrace(p)));
    const full = classify(recoverLaunches(readTrace(path)));
    if (got === 'partial' && full === 'schedule') {
      console.log('  OK   a 2-launch recording classifies as "partial", the full one as "schedule"');
    } else {
      bad++;
      console.log('  FAIL classification collapsed');
      console.log(`         2-launch -> "${got}" (want "partial"), full -> "${full}" (want "schedule")`);
      console.log('         a recording that pins one entry would be reported as verifying the chain');
    }
  }

  // ── THE ROUTE GUARD ───────────────────────────────────────────────────────
  //
  // The two routes share 28 of 31 entries, so most of the check would pass
  // against either table. If route selection were inert — the wrong branch, a
  // default that ignores its argument — the three entries that DO differ, plus
  // the whole B-Side arena table, would go unchecked and nothing would say so.
  //
  // Checking a route-C recording against route D must therefore fail, and it
  // must fail on the discriminators specifically.
  {
    const launches = recoverLaunches(readTrace(path));
    const det = detectRoute(launches);
    const other = det.route === 'D' ? 'C' : 'D';
    const wrong = checkAgainstTable(launches, { route: other });
    const rightRoute = det.route
      ? checkAgainstTable(launches, { route: det.route })
      : { failures: ['route could not be detected'] };
    const hitDiscriminator = wrong.failures.some((f) => /atk_(RisingAbyssB|Swords1|Quickslash): ac —/.test(f));
    if (det.route && rightRoute.failures.length === 0 && hitDiscriminator) {
      console.log(`  OK   route ${det.route} passes; forcing route ${other} fails`
        + ` (${wrong.failures.length} failures, incl. the ac discriminators)`);
    } else {
      bad++;
      console.log('  FAIL route selection is not load-bearing');
      console.log(`         detected=${det.route} rightRouteFailures=${rightRoute.failures.length}`
        + ` wrongRouteFailures=${wrong.failures.length} hitDiscriminator=${hitDiscriminator}`);
      console.log('         the B-Side table and arenas would go unchecked without this');
    }
  }

  if (bad) {
    console.log(`  ${bad} of ${cases.length + 2} sabotage case(s) were not caught.`);
    console.log('  check-oracle-schedule\'s green result cannot be trusted until they are.');
    return 1;
  }
  console.log(`  all ${cases.length + 2} sabotage cases caught   OK`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let code = 1;
  try {
    code = main();
  } finally {
    // ALWAYS, including on a throw — the scratch holds mutated copies of the
    // private recordings, and the twin harness was measured leaving ~19MB of
    // them behind whenever a run failed.
    cleanup();
  }
  process.exit(code);
}
