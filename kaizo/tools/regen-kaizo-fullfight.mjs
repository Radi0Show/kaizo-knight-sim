#!/usr/bin/env node
// Regenerate the kaizo whole-fight sim trace the gate compares — with EVERY
// replay feed the recording carries. The kaizo analog of tools/regen-fullfight.mjs.
//
//   npm run regen:kaizo
//   node kaizo/tools/regen-kaizo-fullfight.mjs [--tag _tok3] [--dry-run]
//
// WHY THIS EXISTS. verify-kaizo-fullfight.mjs does not produce the sim trace it
// compares; it READS one from KAIZO_SIM_OUT and refuses a stale one. That is
// the right split (the gate should never quietly re-run the producer), but it
// leaves the producer's FLAGS as folklore, and the whole-fight comparison is
// only honest with all of them:
//
//   --inputs     the recording's own input table — one feed drives both sides
//   --oracle     the recording, so --sync auto can read its first-launch frame
//   --sync auto  the lead-in offset, derived from data on both sides
//   --keep-alive the recorder pins party HP; the sim must too
//   --slots 32   the recorder's bullet sheet has 32 slots
//   --bolts      the mod's attack-bar schedules, decoded from the seq CSV.
//                A menu phase's length is that schedule and nothing else, and
//                it is choose() off the game's live stream — it cannot be
//                translated, only replayed (kaizo/tools/decode-bolts.mjs).
//   --grazes     the recorder's graze log, when present -- each graze event's
//                global.inv as the event saw it, because hit-vs-graze order on a
//                shared frame is not static and is replayed, not modelled.
//
// A trace made without --bolts compares turn boundaries the sim was never
// given the inputs to reach; that is how the gate sat at "first divergence
// f672" for the whole life of the kaizo lane while the fight underneath it
// went from 733 frames of drift to 176.
//
// NAMING. The gate looks for `kaizo_sim_trace<tag>.csv` FIRST, then two other
// spellings. kaizo-trace.mjs writes `kaizo_oracle_trace<tag>.csv`, which the
// gate also accepts — but a stale first-candidate file would shadow it. So this
// tool writes through the producer and then installs the result under the
// first-candidate names, replacing anything stale.

import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
};
const TAG = flag('--tag', '_tok3');
const DRY = argv.includes('--dry-run');

// Same resolution order as the gate: tracked fullfight/ first, then the legacy
// oracle/fullfight/, then KAIZO_ORACLE_TRACES.
const CANDIDATES = process.env.KAIZO_ORACLE_TRACES
  ? [process.env.KAIZO_ORACLE_TRACES]
  : [
    join(homedir(), 'knight-research', 'kaizo-mod', 'fullfight'),
    join(homedir(), 'knight-research', 'kaizo-mod', 'oracle', 'fullfight'),
  ];
const SIM_OUT = process.env.KAIZO_SIM_OUT || join(tmpdir(), 'kaizo-fullfight');

const dir = CANDIDATES.find((d) => existsSync(join(d, `kaizo_oracle_trace${TAG}.csv`)));
if (!dir) {
  console.error(`regen-kaizo: no recording kaizo_oracle_trace${TAG}.csv under:`);
  for (const d of CANDIDATES) console.error(`  ${d}`);
  process.exit(2);
}
const oracle = join(dir, `kaizo_oracle_trace${TAG}.csv`);
const inputs = join(dir, `kaizo_oracle_inputs${TAG}.txt`);
const seq = join(dir, `kaizo_oracle_seq${TAG}.csv`);
const bolts = join(dir, `kaizo_oracle_bolts${TAG}.csv`);
// The slash ORDER, derived from the same seq log: ds_list_shuffle's
// permutation is unsolved and the bullets sheet compares every slash's angle,
// so the recording supplies the order the way the vanilla lane's --shuffle
// does. The draws are the sim's own either way.
const shuffle = join(dir, `kaizo_oracle_shuffle${TAG}.csv`);
const grazes = join(dir, `kaizo_oracle_grazes${TAG}.csv`);   // optional: the graze feed, when the recording carries one
for (const [what, p] of [['inputs', inputs], ['seq', seq]]) {
  if (!existsSync(p)) {
    console.error(`regen-kaizo: recording has no ${what} file: ${p}`);
    process.exit(2);
  }
}

function run(label, args) {
  console.log(`  ${label}: node ${args.join(' ')}`);
  if (DRY) return 0;
  const r = spawnSync(process.execPath, args, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  const err = String(r.stderr || '');
  for (const line of err.split('\n')) if (/bolts:|sync AUTO|launches|DEGENERATE/.test(line)) console.log(`      ${line.trim()}`);
  if (r.status !== 0) {
    console.error(String(r.stdout || ''));
    console.error(err);
    console.error(`regen-kaizo: ${label} failed (${r.status})`);
    process.exit(r.status ?? 1);
  }
  return r.status;
}

console.log(`regen-kaizo: recording ${TAG} from ${dir}`);
console.log(`             sim trace -> ${SIM_OUT}`);
mkdirSync(SIM_OUT, { recursive: true });

// The bolt schedule is DERIVED from the recording; (re)decode it so a fresh
// recording never runs with a stale or missing table.
run('decode-bolts', ['kaizo/tools/decode-bolts.mjs', seq, '--out', bolts, '--quiet']);
run('derive-shuffle', ['kaizo/tools/derive-shuffle.mjs', seq, '--out', shuffle, '--quiet']);

run('kaizo-trace', [
  'kaizo/tools/kaizo-trace.mjs',
  '--inputs', inputs,
  '--oracle', oracle,
  '--sync', 'auto',
  '--keep-alive',
  '--slots', '32',
  '--bolts', bolts,
  ...(existsSync(grazes) ? ['--grazes', grazes] : []),
  ...(existsSync(shuffle) ? ['--shuffle', shuffle] : []),
  '--tag', TAG,
  '--out', SIM_OUT,
]);

if (!DRY) {
  // Install under the gate's first-candidate names, over anything stale.
  for (const [from, to] of [
    [`kaizo_oracle_trace${TAG}.csv`, `kaizo_sim_trace${TAG}.csv`],
    [`kaizo_oracle_bullets${TAG}.csv`, `kaizo_sim_bullets${TAG}.csv`],
  ]) {
    const src = join(SIM_OUT, from);
    if (!existsSync(src)) { console.error(`regen-kaizo: producer wrote no ${from}`); process.exit(1); }
    copyFileSync(src, join(SIM_OUT, to));
  }
  console.log(`  installed kaizo_sim_trace${TAG}.csv + kaizo_sim_bullets${TAG}.csv`);
}
console.log('regen-kaizo: done — now run `npm run verify:fullfight` (kaizo/tools/verify-kaizo-fullfight.mjs)');
