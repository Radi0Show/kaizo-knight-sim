#!/usr/bin/env node
// THE PAIR DIFFER. verify-kaizo-fullfight's grouped, first-cause comparison
// (columns grouped by system, each group's own first divergence, turn 1's
// harness clock excluded, the documented micro-tolerances) on ANY recording
// pair -- an audit recording (kaizo-trace --drawprobe), a scratch replay, a
// window capture -- without the gate's fullfight/ discovery or its regen.
//
//   node kaizo/tools/diff-kaizo-pair.mjs <oracle-trace.csv> <sim-trace.csv> \
//        [<oracle-bullets.csv> <sim-bullets.csv>] [--context N]
//
// Exit 0 when every given pair is byte-exact under the gate's rules, 1 otherwise.
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { reportFile } = await import(pathToFileURL(join(HERE, 'verify-kaizo-fullfight.mjs')).href);

const argv = process.argv.slice(2);
const ci = argv.indexOf('--context');
const context = ci >= 0 ? Number(argv[ci + 1]) : 0;
const files = argv.filter((a, i) => !a.startsWith('--') && !(ci >= 0 && i === ci + 1));
if (files.length !== 2 && files.length !== 4) {
  console.error('usage: diff-kaizo-pair.mjs <oracle-trace> <sim-trace> [<oracle-bullets> <sim-bullets>] [--context N]');
  process.exit(2);
}
let ok = reportFile('trace', files[0], files[1], context);
if (files.length === 4) ok = reportFile('bullets', files[2], files[3], context) && ok;
process.exit(ok ? 0 : 1);
