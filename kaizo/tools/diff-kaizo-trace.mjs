#!/usr/bin/env node
// KAIZO TRACE DIFFER — the other half of kaizo/tools/kaizo-trace.mjs.
//
//   node kaizo/tools/diff-kaizo-trace.mjs <oracle.csv> <sim.csv> [--context 3]
//
// Exact string equality, cell by cell, in the shape of tools/diff-trace.mjs.
// No float tolerance: the whole point is to catch the sub-pixel divergence a
// tolerance would hide. Exits 0 on a match, 1 on a divergence, 2 on a usage
// error.
//
// ── TWO SHAPES, ONE DIFFER ────────────────────────────────────────────────
//
// The kaizo oracle recorder emits a PAIR of files per run, and this compares
// either against its sim counterpart. The shape is DETECTED from the header,
// never passed in — a flag that says which file you handed over is a flag that
// can be wrong, and being wrong here means reporting 226 columns as if they
// were a fight state row.
//
//   TRACE    kaizo_oracle_trace<TAG>.csv, 21 columns
//            frame,soul_x,soul_y,inv,attackchoice,turntimer,gt_x,gt_y,gt_xs,
//            gt_ys,bullets,spawns,kaizo_atk,kaizo_playing,phase,phaseturn,
//            phase4turn,difficulty,mnfight,rtimer,monsterhp
//
//   BULLETS  kaizo_oracle_bullets<TAG>.csv, 2 + 32*7 columns
//            frame,live,b0_x,b0_y,b0_a,b0_xs,b0_ys,b0_dir,b0_spd, ... b31_spd
//            Every live obj_collidebullet, SORTED BY INSTANCE ID (= creation
//            order; `seq` on the sim side), in 32 fixed slots.
//
// The 11-column row this file was originally written for still loads and still
// diffs — it is the TRACE shape with fewer columns, and nothing here is keyed
// to a column count.
//
// ── WHY A 226-COLUMN ROW IS REPORTED DIFFERENTLY ──────────────────────────
//
// "Report the whole row" is right for eleven columns and useless for 226: a
// screen of commas, most of them empty cells, with the one moving number
// somewhere inside it. So a bullets row is reported by SLOT — which slots
// differ, and which of their seven fields moved — and the count is reported
// FIRST, because it decides whether the slot columns mean anything at all.
//
// A slot is positional. If the two sides disagree about how many bullets are
// live, every slot after the missing one shifts and reports as a divergence:
// that is ONE fault, not thirty, and enumerating the thirty is how a differ
// becomes something you stop reading. tools/verify-fullfight.mjs learned the
// same lesson on the vanilla side and suppresses positional columns past a
// count fault; this does the same.
//
// AN ABSENT SLOT IS SEVEN EMPTY CELLS, NEVER ZEROS. A bullet at the origin and
// no bullet are different states, and collapsing them is how a differ reports
// motion that never happened. So a slot that is populated on one side and empty
// on the other is called out as PRESENCE rather than folded in with the field
// deltas — when the counts agree, that combination means one side is writing
// zeros for absence or ordering its slots differently, which is a defect in the
// harness and not in the fight.
//
// ── WHAT THIS ADDS OVER tools/diff-trace.mjs ──────────────────────────────
//
// Four things, each because of a way this project has actually been misled:
//
//  1. IT REPORTS THE WHOLE ROW, not just the first differing cell (on the trace
//     shape, where a row fits on a screen). "soul_x AND gt_x moved together" is
//     a different diagnosis from "soul_x alone" — the first is the board
//     dragging the soul, the second is the soul. The vanilla differ reports the
//     first cell because its rows are 176 columns wide; here that economy costs
//     information for nothing.
//
//  2. IT NAMES A FORMATTING DIVERGENCE AS ONE. If two cells parse to the same
//     number but different text, the fault is in how a side printed it, not in
//     what it computed — and the fix is in the patch, not the sim. The verdict
//     is still FAIL: identical bits printed differently means the two sides
//     are not producing comparable traces, which is a real defect in the
//     pipeline. It is simply a different defect, and saying which one saves
//     the session that would otherwise go hunting for a physics bug.
//
//  3. IT REFUSES TO CALL A DEGENERATE PAIR A MATCH. verify-fullfight learned
//     this the expensive way: the first whole-fight recordings held confirm
//     instead of pulsing it, ran ONE turn, flatlined for 790 of 1200 frames —
//     and the differ cheerfully reported "exact through frame 21", which is
//     true and badly misleading. A trace that contains no fight cannot verify
//     a fight, however exactly the two copies of it agree. `--allow-degenerate`
//     is there for the deliberate short window.
//
//  4. IT KNOWS THE BULLETS SHAPE, above.
//
// A DIFFER THAT CANNOT FAIL IS NOT A DIFFER. Both directions are asserted
// before this is trusted: two runs at the same seed must be byte-identical,
// and two runs at DIFFERENT seeds must diverge. The second is the one that
// proves the tool is doing anything at all. `verify-kaizo-fullfight.mjs
// --sabotage` runs both plus nine synthetic faults against this file.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * The seven fields a bullet slot carries, in the recorder's column order.
 * `dir` and `spd` are the built-ins the motion phase actually integrates, so a
 * position that agrees while a heading does not is a bullet about to diverge —
 * which is worth seeing one frame BEFORE the position moves.
 */
export const BULLET_SLOT_FIELDS = ['x', 'y', 'a', 'xs', 'ys', 'dir', 'spd'];

const SLOT_COL = /^b(\d+)_(x|y|a|xs|ys|dir|spd)$/;

/**
 * Which of the two contract shapes this header is.
 *
 * DETECTED, never declared. The bullets file is recognised by its own
 * structure — `frame,live` followed by nothing but well-formed slot columns —
 * so a trace that merely happens to carry a few bullet columns is still a
 * trace, and a bullets file with a mangled column name falls back to the trace
 * shape and fails loudly in the header comparison rather than being silently
 * mis-parsed.
 */
export function traceShape(header) {
  if (header.length > 2 && header[0] === 'frame' && header[1] === 'live'
    && header.slice(2).every((h) => SLOT_COL.test(h))) {
    return 'bullets';
  }
  return 'trace';
}

/** How many slots a bullets header carries. 0 for a trace-shaped header. */
export function slotCount(header) {
  return traceShape(header) === 'bullets' ? (header.length - 2) / 7 : 0;
}

/**
 * Read a trace CSV.
 *
 * STRIP THE CARRIAGE RETURNS. The oracle side comes from GML
 * `file_text_writeln`, which ends every line with \r\n. Without this the last
 * column of the oracle's header is "monsterhp\r" and the last cell of every row
 * carries one too — so the header check fails with the genuinely baffling
 * "only in oracle: monsterhp / only in sim: monsterhp", the same name on both
 * sides, and the comparison is right: those are two different strings.
 */
function load(path) {
  const text = readFileSync(path, 'utf8').replace(/\r/g, '').replace(/\n+$/, '');
  const lines = text.split('\n');
  const header = lines[0].split(',');
  return {
    path,
    header,
    shape: traceShape(header),
    slots: slotCount(header),
    rows: lines.slice(1).filter((l) => l.length > 0),
  };
}

/** Same number, different text — a printing fault rather than a physics one. */
function formattingOnly(a, b) {
  if (a === b) return false;
  const an = Number(a);
  const bn = Number(b);
  if (a.trim() === '' || b.trim() === '') return false;
  if (!Number.isFinite(an) || !Number.isFinite(bn)) return false;
  return an === bn;
}

/**
 * Numerically close but not equal — the shape a real sub-pixel divergence
 * takes. Reported as a MAGNITUDE so the reader can tell "one f32 ulp" from
 * "half a pixel" from "a different attack entirely" at a glance, which is the
 * first question asked of every divergence this project has found.
 */
function delta(a, b) {
  const an = Number(a);
  const bn = Number(b);
  if (!Number.isFinite(an) || !Number.isFinite(bn)) return null;
  return bn - an;
}

/** An empty cell is ABSENCE. `''` and `'0'` are different states; see the header. */
const absent = (v) => v === undefined || v === '';

/**
 * The column that says which attack is running, whatever the recorder called
 * it, or null.
 *
 * `kaizo_playing` FIRST, and the order is load-bearing rather than cosmetic:
 * ORACLE-GROUND-TRUTH.md records that MODE 1 writes `kaizo_attack` every frame
 * outside the bullet phase, so that column shows two transitions a turn — the
 * mod advancing its pointer and the recorder shoving it back — and inferring
 * launches from it invented five that never happened. `kaizo_playing` is the
 * mod's own record of what just fired. `attackchoice` (and the older narrow
 * row's `ac`) is the dispatch latch and is the honest fallback.
 */
function attackColumn(header) {
  for (const name of ['kaizo_playing', 'attackchoice', 'ac']) {
    const i = header.indexOf(name);
    if (i >= 0) return { name, i };
  }
  return null;
}

/** The column that counts what is on the board — `bullets`, or `live`. */
function populationColumn(header) {
  for (const name of ['bullets', 'live']) {
    const i = header.indexOf(name);
    if (i >= 0) return { name, i };
  }
  return null;
}

/**
 * Is the PAIR evidence? See the header. Judged on the oracle side, which is
 * the recording — a sim trace can only be as much of a fight as the recording
 * it is being held against.
 *
 * Works on either shape. On the trace it reads `kaizo_playing` (which entry
 * fired) and `bullets`; on the bullets file it has only `live`, which still
 * answers "was anything ever on the board" and "did the fight stop early".
 *
 * THE THRESHOLD HERE IS TWO ENTRIES; verify-kaizo-fullfight.mjs's own guard
 * wants THREE, and the difference is deliberate rather than an oversight.
 *
 * This differ is a general tool: a MODE 1 attack-lock recording is a legitimate
 * thing to diff, and it plays exactly two entries — measured on
 * kaizo_oracle_trace_bsplitter.csv, which carries atk_Starstorm1 and
 * atk_Splitter1 and nothing else, over 1801 rows with a 5.3% trailing
 * flatline. Refusing it here would make the per-attack diffs impossible.
 *
 * The GATE is making a much larger claim — "the whole fight is one-to-one" —
 * and a two-entry lock cannot support it, so it asks for three. Same reasoning
 * as verify-fullfight's "distinct phase/turn values >= 3", one rung stricter
 * because it is one claim bigger.
 */
export function traceDegeneracy(t) {
  const why = [];
  if (t.rows.length === 0) {
    why.push('the trace has no rows at all');
    return why;
  }
  const atk = attackColumn(t.header);
  const pop = populationColumn(t.header);

  if (atk) {
    const seen = new Set(
      t.rows.map((r) => r.split(',')[atk.i]).filter((v) => !absent(v)),
    );
    if (seen.size < 2) {
      why.push(`only ${seen.size} distinct ${atk.name} value(s)`
        + ' — the selector never ran twice');
    }
  }

  if (pop) {
    const live = t.rows.filter((r) => Number(r.split(',')[pop.i]) > 0).length;
    if (live === 0) why.push('no frame ever had a bullet on screen');
    let trailing = 0;
    for (let i = t.rows.length - 1; i >= 0; i--) {
      if (Number(t.rows[i].split(',')[pop.i]) !== 0) break;
      trailing++;
    }
    if (trailing / t.rows.length > 0.4) {
      why.push(`${trailing} of ${t.rows.length} trailing frames have no bullets`
        + ` (${Math.round((trailing / t.rows.length) * 100)}%) — the fight stopped`
        + ' and the rest of the recording is a flatline');
    }
  }
  return why;
}

/** Header comparison, shared by both shapes. */
function headerFault(a, b) {
  if (a.header.join(',') === b.header.join(',')) return null;
  // Named as sets as well as sequences: a column present on one side only is
  // a harness bug worth pointing at, and an ORDER difference with identical
  // sets is a different bug that would otherwise read the same.
  const aSet = new Set(a.header);
  const bSet = new Set(b.header);
  const onlyOracle = a.header.filter((c) => !bSet.has(c));
  const onlySim = b.header.filter((c) => !aSet.has(c));
  const same = onlyOracle.length === 0 && onlySim.length === 0;
  // A 226-column header printed in full is four screens of noise. Print it
  // whole only when it fits; otherwise the set difference IS the report.
  const wide = a.header.length > 30 || b.header.length > 30;
  const show = (t) => (wide
    ? `${t.header.length} columns (${t.shape}${t.slots ? `, ${t.slots} slots` : ''})`
    : t.header.join(','));
  return {
    ok: false,
    message: 'HEADER MISMATCH\n'
      + `  oracle: ${show(a)}\n`
      + `  sim:    ${show(b)}\n`
      + (same
        ? '  Same columns, DIFFERENT ORDER. The differ compares by position,\n'
        + '  so this would misreport every column rather than fail here.'
        : `  only in oracle: ${onlyOracle.join(', ') || '(none)'}\n`
        + `  only in sim:    ${onlySim.join(', ') || '(none)'}`)
      + (a.shape !== b.shape
        ? `\n  THE TWO FILES ARE DIFFERENT SHAPES — oracle is the ${a.shape} file,`
        + `\n  sim is the ${b.shape} file. The pair is trace-vs-trace and`
        + '\n  bullets-vs-bullets; crossing them compares two unrelated files.'
        : ''),
  };
}

/** One differing cell, formatted with its note. */
function cellNote(av, bv) {
  if (formattingOnly(av, bv)) {
    return '   <- SAME NUMBER, DIFFERENT TEXT: a printing fault, not a'
      + ' physics one. Both sides must use string_format(v, 0, 10) / real().';
  }
  if (absent(av) !== absent(bv)) {
    return `   <- ABSENCE vs VALUE: one side has no measurement here, the other`
      + ' does. Empty and zero are different states.';
  }
  const d = delta(av, bv);
  return d === null ? '' : `   (sim - oracle = ${d})`;
}

/** The report for a diverging TRACE row: the whole row, plus context. */
function traceRowReport(a, b, i, ca, cb, context, n) {
  const bad = [];
  for (let c = 0; c < Math.max(ca.length, cb.length); c++) {
    const av = ca[c] ?? '<missing>';
    const bv = cb[c] ?? '<missing>';
    if (av === bv) continue;
    bad.push({ col: a.header[c] ?? `col${c}`, av, bv });
  }

  const lines = [];
  lines.push(`→ DIVERGENCE at row ${i} (frame ${ca[0]})`);
  lines.push('');
  const width = Math.max(11, ...bad.map((f) => f.col.length));
  for (const f of bad) {
    lines.push(`    ${f.col.padEnd(width)} oracle ${String(f.av).padStart(16)}`
      + `   sim ${String(f.bv).padStart(16)}${cellNote(f.av, f.bv)}`);
  }
  lines.push('');
  // The whole row either side, but only while a row still fits on a screen.
  // Past that the differing columns above ARE the report.
  if (a.header.length <= 30) {
    lines.push(`  context (${context} row(s) either side):`);
    lines.push(`    ${'    '}${a.header.join(',')}`);
    const lo = Math.max(0, i - context);
    const hi = Math.min(n - 1, i + context);
    for (let r = lo; r <= hi; r++) {
      const mark = r === i ? '->' : '  ';
      lines.push(`  ${mark}  O ${a.rows[r]}`);
      lines.push(`      S ${b.rows[r]}`);
    }
  } else {
    lines.push(`  (${a.header.length} columns — the differing cells above are the`
      + ' whole report; a full row would not fit)');
  }
  return lines.join('\n');
}

/**
 * The report for a diverging BULLETS row: by SLOT, with the count first.
 *
 * The count first is not presentation. A slot is positional — slot 3 is the
 * fourth live bullet in instance-id order on each side — so if the two sides
 * disagree about HOW MANY are live, every slot from the missing one on shifts
 * and reports as a divergence. That is one fault. Enumerating its thirty
 * shadows buries it.
 */
function bulletRowReport(a, b, i, ca, cb, context, n, maxSlots) {
  const slots = a.slots;
  const lines = [];
  lines.push(`→ DIVERGENCE at row ${i} (frame ${ca[0]})`);
  lines.push('');

  const liveO = ca[1] ?? '<missing>';
  const liveS = cb[1] ?? '<missing>';
  const countFault = liveO !== liveS;

  // Walk every slot regardless, so the count report can say how many slots the
  // shift touched without pretending to diagnose them.
  const diffSlots = [];
  for (let s = 0; s < slots; s++) {
    const base = 2 + s * 7;
    const fields = [];
    let oAny = false;
    let sAny = false;
    for (let k = 0; k < 7; k++) {
      const av = ca[base + k];
      const bv = cb[base + k];
      if (!absent(av)) oAny = true;
      if (!absent(bv)) sAny = true;
      if (av !== bv) fields.push({ name: BULLET_SLOT_FIELDS[k], av: av ?? '<missing>', bv: bv ?? '<missing>' });
    }
    if (fields.length) diffSlots.push({ slot: s, fields, oPresent: oAny, sPresent: sAny });
  }

  if (countFault) {
    lines.push(`    live       oracle ${String(liveO).padStart(16)}`
      + `   sim ${String(liveS).padStart(16)}`);
    lines.push('');
    lines.push('    THE COUNTS DISAGREE, so the slot columns are suppressed for this');
    lines.push('    frame. Slots are positional — sorted by instance id on the oracle');
    lines.push('    side and by `seq` on the sim side — so one missing or extra bullet');
    lines.push(`    shifts every slot after it. ${diffSlots.length} slot(s) differ here and`);
    lines.push('    that is almost certainly ONE fault wearing many hats. Fix the count.');
    if (Number(liveO) > slots || Number(liveS) > slots) {
      lines.push(`    Note: one side reports more than ${slots} live bullets, so this file`);
      lines.push('    is TRUNCATED at the slot limit on that side by construction.');
    }
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`    live ${liveO} on both sides; ${diffSlots.length} of ${slots} slot(s) differ:`);
  lines.push('');
  const shown = diffSlots.slice(0, maxSlots);
  for (const d of shown) {
    if (d.oPresent !== d.sPresent) {
      // Counts agree and yet one side has no bullet in this slot. That is not a
      // trajectory fault; it is one side collapsing absence to zeros, or the
      // two sides ordering their slots differently.
      lines.push(`    slot ${String(d.slot).padStart(2)}  PRESENCE: `
        + `oracle ${d.oPresent ? 'populated' : 'EMPTY'}, `
        + `sim ${d.sPresent ? 'populated' : 'EMPTY'}`);
      lines.push('             With the counts equal this is a HARNESS fault, not a');
      lines.push('             physics one: an absent slot is seven empty cells, never');
      lines.push('             zeros, and the two sides must sort slots the same way.');
      continue;
    }
    lines.push(`    slot ${String(d.slot).padStart(2)}`);
    for (const f of d.fields) {
      lines.push(`        ${f.name.padEnd(4)} oracle ${String(f.av).padStart(16)}`
        + `   sim ${String(f.bv).padStart(16)}${cellNote(f.av, f.bv)}`);
    }
  }
  if (diffSlots.length > shown.length) {
    lines.push(`    ... and ${diffSlots.length - shown.length} more slot(s)`
      + ' (--max-slots to widen)');
  }

  // Context for the FIRST diverging slot only — its seven fields across the
  // window. The other 31 slots either side are the noise this shape exists to
  // avoid printing.
  const first = shown[0];
  if (first) {
    lines.push('');
    lines.push(`  context (${context} row(s) either side), slot ${first.slot} only:`);
    lines.push(`         frame  ${BULLET_SLOT_FIELDS.map((f) => f.padStart(16)).join(' ')}`);
    const lo = Math.max(0, i - context);
    const hi = Math.min(n - 1, i + context);
    const base = 2 + first.slot * 7;
    for (let r = lo; r <= hi; r++) {
      const oc = a.rows[r].split(',');
      const sc = b.rows[r].split(',');
      const mark = r === i ? '->' : '  ';
      const fmt = (cells) => BULLET_SLOT_FIELDS
        .map((_, k) => String(cells[base + k] ?? '').padStart(16)).join(' ');
      lines.push(`  ${mark}  O ${String(oc[0]).padStart(5)}  ${fmt(oc)}`);
      lines.push(`      S ${String(sc[0]).padStart(5)}  ${fmt(sc)}`);
    }
  }
  return lines.join('\n');
}

/**
 * Compare two kaizo traces.
 *
 * Returns { ok, message, frame }. Exported so a verifier can call it directly
 * rather than shelling out and parsing stdout.
 */
export function diffKaizoTraces(oraclePath, simPath, {
  context = 3, allowDegenerate = false, maxSlots = 8,
} = {}) {
  const a = load(oraclePath);
  const b = load(simPath);

  const hf = headerFault(a, b);
  if (hf) return hf;

  const n = Math.min(a.rows.length, b.rows.length);
  if (n === 0) {
    return { ok: false, message: 'one of the traces has no data rows' };
  }

  for (let i = 0; i < n; i++) {
    if (a.rows[i] === b.rows[i]) continue;
    const ca = a.rows[i].split(',');
    const cb = b.rows[i].split(',');
    const message = a.shape === 'bullets'
      ? bulletRowReport(a, b, i, ca, cb, context, n, maxSlots)
      : traceRowReport(a, b, i, ca, cb, context, n);
    return { ok: false, frame: i, shape: a.shape, message };
  }

  if (a.rows.length !== b.rows.length) {
    return {
      ok: false,
      frame: n,
      shape: a.shape,
      message: `→ traces agree through row ${n - 1}, then LENGTH MISMATCH: `
        + `oracle has ${a.rows.length} rows, sim has ${b.rows.length}`,
    };
  }

  // THE MATCH IS NOT REPORTED UNTIL THE PAIR IS SHOWN TO BE A FIGHT.
  const why = allowDegenerate ? [] : traceDegeneracy(a);
  if (why.length) {
    return {
      ok: false,
      frames: n,
      shape: a.shape,
      message: `→ the ${n} rows are identical, and THAT IS NOT A RESULT:\n`
        + why.map((w) => `    - ${w}`).join('\n')
        + '\n  A trace with no fight in it cannot verify a fight. Two copies of\n'
        + '  nothing agree perfectly. Re-record with a longer window, a\n'
        + '  pulsing confirm (button1_p is edge-triggered — a HELD confirm is\n'
        + '  one press forever) and the party kept alive, or pass\n'
        + '  --allow-degenerate if this short window is deliberate.',
    };
  }

  const shape = a.shape === 'bullets'
    ? `${a.header.length} columns / ${a.slots} bullet slots`
    : `${a.header.length} columns`;
  return {
    ok: true,
    frames: n,
    shape: a.shape,
    message: `→ traces match through row ${n - 1} (frame ${a.rows[n - 1].split(',')[0]})`
      + `, ${shape}   OK`,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const valueOf = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : dflt;
  };
  const context = Number(valueOf('--context', 3));
  const maxSlots = Number(valueOf('--max-slots', 8));
  const allowDegenerate = argv.includes('--allow-degenerate');

  // A flag that takes a value would otherwise have its value read as a path.
  const taken = new Set(['--context', '--max-slots']
    .map((f) => argv.indexOf(f)).filter((i) => i >= 0).map((i) => argv[i + 1]));
  const paths = argv.filter((x) => !x.startsWith('--') && !taken.has(x));
  const [oracle, sim] = paths;

  if (!oracle || !sim || !Number.isFinite(context) || context < 0
    || !Number.isFinite(maxSlots) || maxSlots < 1) {
    console.error('usage: node kaizo/tools/diff-kaizo-trace.mjs <oracle.csv> <sim.csv>'
      + ' [--context N] [--max-slots N] [--allow-degenerate]');
    process.exit(2);
  }

  let result;
  try {
    result = diffKaizoTraces(oracle, sim, { context, allowDegenerate, maxSlots });
  } catch (err) {
    console.error(`diff-kaizo-trace: ${err.message}`);
    process.exit(2);
  }
  console.log(result.message);
  process.exit(result.ok ? 0 : 1);
}

// pathToFileURL, not `file://${process.argv[1]}`: on Windows argv[1] is
// `D:\...\diff-kaizo-trace.mjs` and import.meta.url is `file:///D:/...`, so the
// older form is false and main() never runs — the differ would exit 0 having
// compared nothing, which is the single worst failure mode a differ has.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
