#!/usr/bin/env node
// THE WHOLE-FIGHT RNG AUDIT. Compare the game's draws against the sim's, frame
// by frame, across an entire recording made with the draw probe on every frame.
//
//   node kaizo/tools/probe-diff.mjs <drawprobe.csv> <sim-drawlog.csv> [--seed N] [--per-turn]
//
// WHAT THE TWO FILES ARE
//   drawprobe.csv  the recorder's KAIZO_ORACLE_DRAWPROBE=a-b output: `frame,q1,q2`,
//                  q1/q2 = irandom(360) drawn at the END of that frame, after the
//                  trace row (oracle_kaizo_fight.csx). Each irandom is TWO u32.
//   drawlog.csv    the tracer's --drawlog: `simFrame,oracleFrame,draws,spawnn`
//                  per frame, from a run with --drawprobe a-b so the sim consumed
//                  the same four u32 per frame. `draws` is the live rng object's
//                  count since its last reseed (sim/rng.js gmlU32); `spawnn` is
//                  the spawner count (post-increment), so the anchor in force is
//                  seed + (spawnn - 1) * 1000 and it changes on a launch frame.
//
// HOW THE GAME'S COUNT IS RECOVERED
//   The recorder reseeds per scr_bulletspawner call exactly as the sim does
//   (seed + n*1000), so within a turn the probe pairs sit on ONE known stream.
//   For each probed frame the decoder finds the first stream position at or
//   after the previous frame's where four consecutive u32 decode to (q1, q2);
//   the position is the number of u32 the game drew since the anchor before
//   this frame's probe. The search restarts at 0 on every frame the sim's
//   spawnn changed (the reseed lands mid-frame, the probe after it).
//
// WHY CUMULATIVE, NOT PER-FRAME
//   obj_time (the recorder) draws at depth 0; a deeper object's Draw-event RNG
//   lands after the probe inside a frame and shows up in the NEXT frame's
//   delta. Cumulative counts since the anchor cancel that; the first frame the
//   cumulative differs is a real count fault. Within a turn the sim's
//   `draws` already includes its emulated probe u32 for that frame, so it is
//   compared minus four.
//
// REPORT
//   One line per turn (anchor): the first oracle frame where cumulative
//   differs, with both counts and the running difference -- or "exact" if the
//   turn never differs. A turn that follows a differing turn is still
//   compared fresh (each turn re-anchors), so every line is a finding of its
//   own. Feed the frame to KAIZO_TRAP=a-b (sim frames) to see the sim's sites.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const rng = await import(pathToFileURL(join(HERE, '..', '..', 'sim', 'rng.js')).href);

const argv = process.argv.slice(2);
const files = argv.filter((a) => !a.startsWith('--'));
if (files.length < 2) {
  console.error('usage: probe-diff.mjs <drawprobe.csv> <sim-drawlog.csv> [--seed N]');
  process.exit(2);
}
const seedIdx = argv.indexOf('--seed');
const SEED = seedIdx >= 0 ? Number(argv[seedIdx + 1]) : 20260810;

const probe = new Map();
for (const line of readFileSync(files[0], 'utf8').split(/\r?\n/)) {
  const [f, q1, q2] = line.split(',').map(Number);
  if (Number.isFinite(f) && Number.isFinite(q1) && Number.isFinite(q2)) probe.set(f, [q1, q2]);
}
const sim = [];
for (const line of readFileSync(files[1], 'utf8').split(/\r?\n/).slice(1)) {
  const [sf, of, draws, spawnn] = line.split(',').map(Number);
  if (Number.isFinite(of)) sim.push({ sf, of, draws, spawnn });
}
if (!probe.size || !sim.length) { console.error('empty input'); process.exit(2); }

// The anchor streams, generated lazily and cached: n -> Uint32Array of draws.
const STREAM_LEN = 400000;
const streams = new Map();
function stream(n) {
  if (!streams.has(n)) {
    const r = rng.gmlCreate((SEED + n * 1000) >>> 0);
    const u = new Uint32Array(STREAM_LEN);
    for (let k = 0; k < STREAM_LEN; k++) u[k] = rng.gmlU32(r);
    streams.set(n, u);
  }
  return streams.get(n);
}
function ir360(u, k) {
  const lo = BigInt(u[k]);
  const hi = BigInt(u[k + 1]);
  return Number((lo | ((hi & 0x7fffffffn) << 32n)) % 361n);
}

let anchor = null;
let pos = 0;
let turn = 0;
let turnStart = null;
let reported = false;
let firstBad = null;      // { of, sf, game, sim } of the turn's first mismatch
let recoveredAt = null;   // first frame after it where cumulative agrees again
let lastDelta = 0;        // sim - game at the turn's last probed frame
let lastOf = null;
let offset = 0;
const lines = [];
function endTurn(exactThrough) {
  if (turnStart === null) return;
  const head = `turn ${String(turn).padStart(2)}  anchor n=${String(anchor).padStart(2)}`;
  if (!reported) { lines.push(`${head}  f${turnStart}-f${exactThrough}  exact`); return; }
  // A mismatch that RECOVERS is a draw that happened on a different frame on
  // the two sides (a timing difference, one frame either way); one that
  // PERSISTS to the turn's end is a count fault -- a draw one side never
  // makes. Both are findings; only the second shifts every later value.
  const b = firstBad;
  const tail = recoveredAt !== null
    ? `recovers f${recoveredAt}; turn ends at ${lastDelta > 0 ? '+' : ''}${lastDelta}`
    : `PERSISTS; turn ends at ${lastDelta > 0 ? '+' : ''}${lastDelta}`;
  lines.push(`${head}  FIRST MISMATCH f${b.of} (sim f${b.sf}): game ${b.game} sim ${b.sim} (sim ${b.sim - b.game > 0 ? '+' : ''}${b.sim - b.game}); ${tail}`);
}
for (let i = 0; i < sim.length; i++) {
  const row = sim[i];
  const n = row.spawnn - 1;
  if (n < 0) continue;                    // before the first launch: no anchor
  // The game's dispatch frame (the sim re-anchors on the NEXT row): its probe
  // already sits on the new anchor, so this row cannot be compared under the
  // old one -- it is decoded when the new anchor opens, below.
  const dispatchFrame = i + 1 < sim.length && sim[i + 1].spawnn !== row.spawnn;
  if (n !== anchor) {                     // the sim's launch frame: new stream
    endTurn(lastOf);
    anchor = n; pos = 0; turn += 1; turnStart = row.of; reported = false; offset = 0; firstBad = null; recoveredAt = null; lastDelta = 0;
    // THE DISPATCH FRAME IS ONE EARLIER. The game reseeds in the knight's Step
    // on the dispatch frame and the director launches on the frame after
    // (kaizo-practice.js: "each one frame after its flip"), so the dispatch
    // frame's probe sits on the NEW anchor: decode it here to place the
    // position and compare nothing. The sim draws the same four u32 through
    // the launcher's afterLaunchReseed hook (kaizo-trace.mjs installs it with
    // --drawprobe), so no offset is carried; a sim run WITHOUT that hook
    // would read every later value four positions early.
    const qPrev = probe.get(row.of - 1);
    if (qPrev) {
      const uPrev = stream(anchor);
      let hitPrev = -1;
      for (let k = 0; k + 3 < STREAM_LEN; k++) {
        if (ir360(uPrev, k) === qPrev[0] && ir360(uPrev, k + 2) === qPrev[1]) { hitPrev = k; break; }
      }
      if (hitPrev >= 0) { pos = hitPrev + 4; offset = 0; } // the tracer's afterLaunchReseed hook draws these four on the sim side too
    }
  }
  lastOf = row.of;
  if (dispatchFrame) continue;
  const q = probe.get(row.of);
  if (!q) continue;
  const u = stream(anchor);
  let hit = -1;
  for (let k = pos; k + 3 < STREAM_LEN; k++) {
    if (ir360(u, k) === q[0] && ir360(u, k + 2) === q[1]) { hit = k; break; }
  }
  if (hit < 0) {
    if (!reported) { lines.push(`turn ${String(turn).padStart(2)}  anchor n=${String(anchor).padStart(2)}  f${row.of}: probe pair (${q[0]},${q[1]}) NOT FOUND after position ${pos} -- the sim's anchor or the reseed frame differs`); reported = true; firstBad = { of: row.of, sf: row.sf, game: NaN, sim: row.draws - 4 }; }
    continue;
  }
  const game = hit - offset;              // u32 the game drew since the anchor, before this frame's probe, minus the dispatch frame's probe
  const simDraws = row.draws - 4;         // the sim's, minus this frame's emulated probe
  if (!reported && game !== simDraws) {
    firstBad = { of: row.of, sf: row.sf, game, sim: simDraws };
    reported = true;
  } else if (reported && recoveredAt === null && game === simDraws) {
    recoveredAt = row.of;
  }
  lastDelta = simDraws - game;
  pos = hit + 4;
}
endTurn(lastOf);
console.log(lines.join('\n'));
