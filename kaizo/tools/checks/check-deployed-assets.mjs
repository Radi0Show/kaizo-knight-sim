#!/usr/bin/env node
// THE SAME PROOF, RUN AGAINST A DEPLOYED COPY.
//
//   node kaizo/tools/checks/check-deployed-assets.mjs [root]
//   default root: this repo. The one that matters:
//   node kaizo/tools/checks/check-deployed-assets.mjs D:/ShadowCrystal/thedevice/DEVICE_KAIZO
//
// WHY THIS EXISTS SEPARATELY FROM check-sprites.mjs.
//
// The page the player actually loads is not this repo. It is the VENDORED copy
// under thedevice/DEVICE_KAIZO, and the vendor step is not a plain file copy:
// it strips comments, deletes every .md and .txt, and does not ship
// `kaizo/tools` at all. So every gate in this repo — including the one that
// found the last two art holes — is structurally unable to run against the
// thing that is served. "The repo is green" and "the site works" are two
// claims, and only one of them was ever being checked.
//
// This check is therefore written to take the ROOT as an argument and to
// assume NOTHING about what else is next to it: no git, no research repo, no
// dumps, no source comments. Everything it asserts, it reads off the deployed
// tree itself.
//
// It deliberately does NOT re-assert the publish gate. That gate is about what
// reaches a PUBLIC repo and is git's job in the source tree; by the time art
// is in a deployed folder the decision has already been made.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE_REPO = join(here, '..', '..', '..');
const root = process.argv[2] ?? SOURCE_REPO;

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

console.log(`  --  root: ${root}`);
ok(existsSync(root), 'the root exists');
if (!existsSync(root)) process.exit(1);

// ── the packs, read off the deployed tree ─────────────────────────────────
const MAIN = join(root, 'assets', 'sprites');
const OVERLAY = join(root, 'kaizo', 'assets', 'sprites');
const mainOk = existsSync(join(MAIN, 'manifest.json'));
const overOk = existsSync(join(OVERLAY, 'manifest.json'));
ok(mainOk, 'assets/sprites/manifest.json shipped');
ok(overOk, 'kaizo/assets/sprites/manifest.json shipped (the kaizo overlay went out with the page)');
if (!mainOk || !overOk) process.exit(1);
const mainManifest = JSON.parse(readFileSync(join(MAIN, 'manifest.json'), 'utf8'));
const overlayManifest = JSON.parse(readFileSync(join(OVERLAY, 'manifest.json'), 'utf8'));
const resolvable = new Set([...Object.keys(mainManifest), ...Object.keys(overlayManifest)]);
console.log(`  --  ${Object.keys(mainManifest).length} vanilla + `
  + `${Object.keys(overlayManifest).length} overlay sprites`);

// ── every frame file the manifests promise is really served ───────────────
// THE POINT OF THIS CHECK. A manifest entry whose PNG did not survive the
// vendor step resolves fine in JS, fetches, 404s, and draws nothing — the
// renderer's fallback turns it into a white outline and no error reaches
// anyone. That is a file-level failure a source-tree check cannot see.
{
  const gone = [];
  const mismatched = [];
  const noOrigin = [];
  for (const [label, man, dir] of [['vanilla', mainManifest, MAIN], ['overlay', overlayManifest, OVERLAY]]) {
    for (const [name, m] of Object.entries(man)) {
      for (const f of m.files ?? []) {
        if (!existsSync(join(dir, f))) gone.push(`${label}/${name}:${f}`);
      }
      if ((m.files ?? []).length !== m.frames) {
        mismatched.push(`${label}/${name}: frames=${m.frames} files=${(m.files ?? []).length}`);
      }
      if (typeof m.ox !== 'number' || typeof m.oy !== 'number') noOrigin.push(`${label}/${name}`);
    }
  }
  ok(gone.length === 0,
    `every frame the two manifests name is on the deployed disk`
    + `${gone.length ? ` — ${gone.length} MISSING: ${gone.slice(0, 8).join(', ')}` : ''}`);
  ok(mismatched.length === 0,
    `every deployed frame count matches its file list`
    + `${mismatched.length ? ` — ${mismatched.slice(0, 6).join('; ')}` : ''}`);
  ok(noOrigin.length === 0,
    `every deployed sprite carries an origin`
    + `${noOrigin.length ? ` — ${noOrigin.slice(0, 8).join(', ')}` : ''}`);
}

// ── CASE. The one way this whole file can be green on Windows and wrong live ─
// `existsSync` on NTFS is case-INSENSITIVE: a manifest that says
// `spr_Foo_0.png` next to a file called `spr_foo_0.png` passes every check
// above on this machine and 404s on GitHub Pages and Cloudflare, which are
// case-sensitive. That is precisely the shape of failure this lane exists to
// stop — an enforced gate green for a reason that has nothing to do with the
// art. So the names are compared as STRINGS against the real directory
// listing, which no filesystem can fuzz.
{
  const wrongCase = [];
  for (const [label, man, dir] of [['vanilla', mainManifest, MAIN], ['overlay', overlayManifest, OVERLAY]]) {
    if (!existsSync(dir)) continue;
    const onDisk = new Set(readdirSync(dir));
    for (const [name, m] of Object.entries(man)) {
      for (const f of m.files ?? []) {
        if (!onDisk.has(f)) {
          const ci = [...onDisk].find((d) => d.toLowerCase() === f.toLowerCase());
          wrongCase.push(`${label}/${name}: manifest "${f}"${ci ? ` but disk has "${ci}"` : ' (absent)'}`);
        }
      }
    }
  }
  ok(wrongCase.length === 0,
    'every manifest filename matches the deployed directory listing EXACTLY, case included '
    + '(a case-only mismatch 404s on a case-sensitive host and passes every existsSync here)'
    + `${wrongCase.length ? ` — ${wrongCase.slice(0, 6).join(' | ')}` : ''}`);
}

// ── every sprite the DEPLOYED code names resolves ─────────────────────────
// Scanned the same way check-sprites.mjs does — all three quote styles, every
// shipped directory — against the deployed JS, which is not the same text as
// the source: the vendor strips comments, so this scan sees exactly what the
// browser parses and nothing else.
const SRC_ROOTS = ['kaizo', 'web', 'sim', 'render', 'input'];
function jsUnder(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n === 'tools' || n === 'node_modules') continue;
      jsUnder(p, out);
    } else if (n.endsWith('.js')) out.push(p);
  }
  return out;
}
const NAME_RE = /['"`](spr_[A-Za-z0-9_]+|bg_[A-Za-z0-9_]+)['"`]/g;
const KNOWN_ABSENT = new Set(['spr_bullet_knightcrescent_hitbox', 'spr_custom_box']);

/**
 * Same stripper as check-sprites.mjs, and needed here for the same reason.
 *
 * On the VENDORED tree it is a no-op — the vendor step has already removed
 * every comment, which is why running this file against DEVICE_KAIZO and
 * against the source gave different answers before it was added. That
 * difference is exactly why it belongs here: the check has to give the same
 * verdict on both trees, or it is measuring the vendor step instead of the
 * art, and whoever runs it on the source repo gets three "missing" sprites
 * that are only ever discussed in prose.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { out += c + (src[i + 1] ?? ''); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i += 1; continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2; continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    out += c; i += 1;
  }
  return out;
}

const srcFiles = SRC_ROOTS.flatMap((r) => jsUnder(join(root, r)));
ok(srcFiles.length > 0, `the deployed tree ships JS to scan (${srcFiles.length} files)`);
{
  const named = new Map();
  for (const p of srcFiles) {
    const rel = relative(root, p).replace(/\\/g, '/');
    for (const m of stripComments(readFileSync(p, 'utf8')).matchAll(NAME_RE)) {
      if (!named.has(m[1])) named.set(m[1], new Set());
      named.get(m[1]).add(rel);
    }
  }
  const missing = [...named.keys()].filter((s) => !resolvable.has(s) && !KNOWN_ABSENT.has(s));
  ok(missing.length === 0,
    `every sprite the DEPLOYED code names resolves (${named.size} distinct)`
    + `${missing.length ? ` — MISSING: ${missing.map((s) => `${s} (${[...named.get(s)].join(', ')})`).join('; ')}` : ''}`);
}

// ── audio: the manifest and the files went out together ───────────────────
{
  const AUD = join(root, 'assets', 'audio');
  const idxPath = join(AUD, 'index.json');
  ok(existsSync(idxPath), 'assets/audio/index.json shipped');
  if (existsSync(idxPath)) {
    const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
    const gone = Object.entries(idx).filter(([, f]) => !existsSync(join(AUD, f)));
    ok(gone.length === 0,
      `every cue in the deployed index.json has its file (${Object.keys(idx).length})`
      + `${gone.length ? ` — MISSING: ${gone.map(([k, f]) => `${k}->${f}`).join(', ')}` : ''}`);
  }
  // The kaizo lane's own music is served by an override pointing into this
  // directory; if the directory did not ship, the fight is silent.
  const KAUD = join(root, 'kaizo', 'assets', 'audio');
  const kfiles = existsSync(KAUD) ? readdirSync(KAUD).filter((f) => /\.(ogg|m4a|wav|mp3)$/.test(f)) : [];
  ok(kfiles.includes('kaizoknight.ogg'),
    `the kaizo lane's own music shipped (kaizo/assets/audio: ${kfiles.join(', ') || 'EMPTY'})`);
}

// ── and the deployed tree is not BEHIND the source ────────────────────────
// Only meaningful when the two are different trees. A vendored copy that is
// merely OLD passes every assertion above and still shows a player the last
// release's art, which is the failure mode a per-tree check cannot reach.
if (root !== SOURCE_REPO && existsSync(join(SOURCE_REPO, 'kaizo', 'assets', 'sprites', 'manifest.json'))) {
  const src = JSON.parse(readFileSync(join(SOURCE_REPO, 'kaizo', 'assets', 'sprites', 'manifest.json'), 'utf8'));
  const behind = Object.keys(src).filter((n) => !overlayManifest[n]);
  const ahead = Object.keys(overlayManifest).filter((n) => !src[n]);
  ok(behind.length === 0 && ahead.length === 0,
    `the deployed overlay matches the source overlay name for name`
    + `${behind.length ? ` — NOT DEPLOYED YET (re-vendor): ${behind.join(', ')}` : ''}`
    + `${ahead.length ? ` — DEPLOYED BUT GONE FROM SOURCE: ${ahead.join(', ')}` : ''}`);

  const srcAudio = join(SOURCE_REPO, 'assets', 'audio', 'index.json');
  if (existsSync(srcAudio) && existsSync(join(root, 'assets', 'audio', 'index.json'))) {
    const a = Object.keys(JSON.parse(readFileSync(srcAudio, 'utf8')));
    const b = Object.keys(JSON.parse(readFileSync(join(root, 'assets', 'audio', 'index.json'), 'utf8')));
    const miss = a.filter((k) => !b.includes(k));
    ok(miss.length === 0,
      `the deployed audio index matches the source's${miss.length ? ` — NOT DEPLOYED: ${miss.join(', ')}` : ''}`);
  }
}

console.log('');
if (failed) {
  console.log(`check-deployed-assets: ${failed} FAILING`);
  process.exit(1);
}
console.log('check-deployed-assets: green.');
