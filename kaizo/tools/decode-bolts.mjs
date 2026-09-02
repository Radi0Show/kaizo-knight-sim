#!/usr/bin/env node
// Recover the MOD's attack-bar bolt schedules from a kaizo recording.
//
// WHY THIS EXISTS
//
// A menu phase's length is the bolt schedule and nothing else. Measured on the
// _tok3 pair, a menu phase is exactly
//
//     nav + (lastBoltFrame + 38) + 1
//
// because every bolt is scored at `close == 13` (the token presses confirm every
// other frame, so a bolt is taken on the first pressed frame inside the
// `close < 15` window), the last character's `attacked[]` latches one frame
// later, and `posttimer` then runs its 51. So a schedule difference IS a
// turn-boundary difference, frame for frame.
//
// The schedule is `choose()` off the GAME's live stream:
//
//     // gml_Object_obj_attackpress_Create_0.gml, my_method == 1
//     boltxoff += lastbolt;  boltframe[i] = 30 + boltxoff;
//     lastbolt = choose(0, diff, diff * 1.5);   // gap 0 / 12 / 18
//
// and those draws happen mid-menu, thousands of draws from any anchor. CLAUDE.md,
// "LIVE RNG IS RE-ANCHORED PER ATTACK LAUNCH": the continuous stream is
// deliberately not modelled, so this cannot be translated into agreement. It has
// to be REPLAYED — exactly as the vanilla whole-fight tool already replays it
// through `tools/fullfight-trace.mjs --bolts`.
//
// THE DECODE. `obj_attackpress`'s Draw trails each live bolt with an
// `obj_afterimage` at
//
//     x = (x + 80 + boltframe[i] * boltspeed) - boltx * boltspeed
//     y = y + 38 * boltchar[i]
//
// With the bar at x = 2, y = 365 and boltspeed = 8, any afterimage on a row in
// {365, 403, 441} is a bolt trail: its row gives the character and
// `close = (x - 82) / 8`. `boltx` is 0 on the bar's first Draw, so
//
//     boltframe = close + (frame - barCreatedFrame)
//
// which is INVARIANT across a bolt's whole trail — every frame the bolt advances
// one step and `close` drops by one. That invariance is the built-in check: this
// tool asserts it rather than trusting a single row.
//
// Output is the same format tools/fullfight-trace.mjs consumes:
//
//     barCreatedFrame,boltframe:char|boltframe:char|...
//
// Usage:
//   node kaizo/tools/decode-bolts.mjs <seq.csv> [--out <file>] [--quiet]

import { readFileSync, writeFileSync } from 'node:fs';

const BAR_X = 2;
const BAR_Y = 365;
const BOLT_SPEED = 8;
const ROW_GAP = 38;                    // y + 38 * boltchar
const ROWS = { [BAR_Y]: 0, [BAR_Y + ROW_GAP]: 1, [BAR_Y + 2 * ROW_GAP]: 2 };

// Trails within one bar arrive every frame; the next bar is a whole turn away.
// Anything past this is a new bar. Turns are ~330+ frames, bars ~50, so there is
// a wide safe margin here.
const NEW_BAR_GAP = 60;

export function decodeBolts(csvText) {
  const lines = csvText.replace(/\r/g, '').trim().split('\n');
  const head = lines[0].split(',');
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const need of ['frame', 'object', 'x', 'y']) {
    if (col[need] === undefined) throw new Error(`seq csv has no "${need}" column`);
  }

  const trails = [];
  for (let i = 1; i < lines.length; i++) {
    const r = lines[i].split(',');
    if (r[col.object] !== 'obj_afterimage') continue;
    const y = Math.round(Number(r[col.y]));
    if (ROWS[y] === undefined) continue;
    const x = Number(r[col.x]);
    // A bolt trail sits on an exact 8px lattice from the bar origin. Anything
    // else on these rows is a different afterimage that happens to share a row,
    // and must not be read as a bolt.
    const close = (x - (BAR_X + 80)) / BOLT_SPEED;
    if (!Number.isInteger(close)) continue;
    trails.push({ frame: Number(r[col.frame]), char: ROWS[y], close, row: i });
  }
  if (!trails.length) return { bars: [], warnings: ['no bolt trails found'] };

  // Split into bars on the frame gap.
  const bars = [];
  let cur = [trails[0]];
  for (let i = 1; i < trails.length; i++) {
    if (trails[i].frame - trails[i - 1].frame > NEW_BAR_GAP) { bars.push(cur); cur = []; }
    cur.push(trails[i]);
  }
  bars.push(cur);

  const warnings = [];
  const out = [];
  for (const bar of bars) {
    const start = bar[0].frame;
    // boltframe = close + (frame - start), invariant along a bolt's trail.
    const byBolt = new Map();          // `${char}:${boltframe}` -> trail rows
    for (const t of bar) {
      const boltframe = t.close + (t.frame - start);
      const key = `${t.char}:${boltframe}`;
      if (!byBolt.has(key)) byBolt.set(key, []);
      byBolt.get(key).push(t);
    }
    const bolts = [...byBolt.entries()].map(([key, ts]) => {
      const [char, boltframe] = key.split(':').map(Number);
      return { char, boltframe, firstRow: ts[0].row, trails: ts.length, lastClose: ts[ts.length - 1].close };
    });
    // Order: by boltframe, ties in the order the recorder logged them (which is
    // the bar's own bolt index order).
    bolts.sort((a, b) => a.boltframe - b.boltframe || a.firstRow - b.firstRow);

    // Every bolt's last trail should sit at close 13 -- the scoring frame.
    for (const b of bolts) {
      if (b.trails > 1 && b.lastClose !== 13) {
        warnings.push(`bar f${start} char ${b.char} bolt ${b.boltframe}: last trail at close ${b.lastClose}, expected 13`);
      }
    }
    out.push({ start, bolts });
  }
  return { bars: out, warnings };
}

export function formatBolts(bars) {
  return bars.map((b) => `${b.start},${b.bolts.map((x) => `${x.boltframe}:${x.char}`).join('|')}`).join('\n');
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const argv = process.argv.slice(2);
  const src = argv.find((a) => !a.startsWith('--'));
  if (!src) {
    console.error('usage: node kaizo/tools/decode-bolts.mjs <seq.csv> [--out <file>] [--quiet]');
    process.exit(2);
  }
  const outIdx = argv.indexOf('--out');
  const quiet = argv.includes('--quiet');
  const { bars, warnings } = decodeBolts(readFileSync(src, 'utf8'));
  const text = formatBolts(bars);
  if (outIdx >= 0) {
    writeFileSync(argv[outIdx + 1], text + '\n');
    if (!quiet) console.log(`wrote ${bars.length} bar(s) -> ${argv[outIdx + 1]}`);
  } else {
    console.log(text);
  }
  if (!quiet) {
    for (const w of warnings) console.error(`  warn: ${w}`);
    const counts = bars.map((b) => b.bolts.length);
    console.error(`  ${bars.length} bars, ${counts.reduce((a, b) => a + b, 0)} bolts ` +
      `(min ${Math.min(...counts)}, max ${Math.max(...counts)} per bar), ${warnings.length} warning(s)`);
  }
}
