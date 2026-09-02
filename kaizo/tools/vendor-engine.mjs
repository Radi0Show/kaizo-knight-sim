#!/usr/bin/env node
// RE-VENDOR THE ENGINE from knight-sim's working tree.
//
//   npm run vendor:engine                       (from ../knight-sim)
//   node kaizo/tools/vendor-engine.mjs <path>   (from another checkout)
//
// sim/, render/, input/, assets/ and tools/ in this repo are a SNAPSHOT of
// knight-sim's, and the rule is the one thedevice already lives by: never
// hand-edit a vendored copy. A fault found here that belongs to the engine is
// fixed in knight-sim, proven against its 60 suites, and then re-vendored with
// this script. If a fix has to land here first to keep a gate moving, port it
// back the same day and note it in docs/VENDOR.md's "pending" list.
//
// The script mirrors each directory (delete + copy, so removals propagate),
// then rewrites docs/VENDOR.md with the source's commit and the dirty files
// INSIDE the mirrored directories — the provenance a future reader needs to
// know which knight-sim this is. Dirty files elsewhere in the source tree are
// listed separately, because they were not vendored.
import { cpSync, rmSync, existsSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SRC = process.argv[2] ?? join(REPO, '..', 'knight-sim');
const DIRS = ['sim', 'render', 'input', 'assets', 'tools'];
for (const d of DIRS) {
  if (!existsSync(join(SRC, d))) { console.error(`vendor-engine: ${SRC}/${d} not found -- is ${SRC} a knight-sim checkout?`); process.exit(2); }
}
// NEVER MIRROR A TREE ONTO ITSELF: the delete below runs before the copy, so
// a source that resolves to this repo would erase the engine with nothing to
// restore from.
if (realpathSync(SRC) === realpathSync(REPO)) { console.error('vendor-engine: source and destination are the same tree'); process.exit(2); }

const rev = execSync('git rev-parse HEAD', { cwd: SRC, encoding: 'utf8' }).trim();
// Only the trailing newline is trimmed: porcelain's first column is a status
// letter OR A SPACE, and a full trim would eat it off the first line.
const porcelain = execSync('git status --porcelain', { cwd: SRC, encoding: 'utf8' }).replace(/\r?\n+$/, '');
const lines = porcelain ? porcelain.split(/\r?\n/) : [];
const inDirs = (l) => DIRS.some((d) => l.slice(3).startsWith(d + '/'));
const vendoredDirty = lines.filter(inDirs);
const otherDirty = lines.filter((l) => !inDirs(l));

const filter = (p) => !/[\\/](node_modules|_site)([\\/]|$)/.test(p) && !/\.DS_Store$/.test(p);
for (const d of DIRS) {
  rmSync(join(REPO, d), { recursive: true, force: true });
  cpSync(join(SRC, d), join(REPO, d), { recursive: true, filter });
  console.log(`  mirrored ${d}/`);
}

const t = new Date();
const stamp = [t.getFullYear(), String(t.getMonth() + 1).padStart(2, '0'), String(t.getDate()).padStart(2, '0')].join('-');
const vendorMd = join(REPO, 'docs', 'VENDOR.md');
const prev = existsSync(vendorMd) ? readFileSync(vendorMd, 'utf8') : '';
const pending = (prev.match(/## Pending port-backs[\s\S]*$/) ?? ['## Pending port-backs\n\n(none)\n'])[0];
writeFileSync(vendorMd, [
  '# VENDOR.md -- which knight-sim this engine is',
  '',
  'Written by kaizo/tools/vendor-engine.mjs. sim/, render/, input/, assets/ and',
  'tools/ are a snapshot of knight-sim; never hand-edit them here (see the',
  "script's header and CLAUDE.md).",
  '',
  `- source: ${SRC}`,
  `- commit: ${rev}`,
  `- vendored: ${stamp}`,
  vendoredDirty.length
    ? '- the source tree was DIRTY inside the mirrored directories; these uncommitted files were vendored as they stood:'
    : '- the mirrored directories were clean in the source tree',
  ...vendoredDirty.map((l) => `    ${l}`),
  ...(otherDirty.length ? ['- also dirty in the source tree, OUTSIDE the mirrored directories (not vendored):', ...otherDirty.map((l) => `    ${l}`)] : []),
  '',
  pending.trimEnd(),
  '',
].join('\n'));
console.log('vendor-engine: docs/VENDOR.md rewritten');
