#!/usr/bin/env node
// EVERY SPRITE THE KAIZO CODE NAMES MUST RESOLVE — and the gated art must
// stay gated.
//
// A missing sprite is not an error at runtime: the renderer falls back to
// drawing the entity's collision mask, so the attack still plays and still
// hits. It just shows up as a white outline. That is a good failure mode and
// a terrible thing to rely on — it means "the art is wrong" is invisible to
// every other check in this repo, and gets noticed only by someone looking at
// the screen and knowing what it should look like.
//
// So this asserts the whole set at once, which a screenshot cannot:
//   1. every spr_* named in kaizo/ resolves in the vanilla pack or the overlay
//   2. every manifest entry's PNG frames are actually present on disk
//   3. the overlay's frame COUNT matches its manifest (a truncated extraction
//      animates to a blank frame rather than failing)
//   4. THE PUBLISH GATE: every mod-sourced file is ignored by git
//      (kaizo/HANDOFF.md §5-C — EnderCat8's art must not reach a public repo)
//
//   node kaizo/tools/checks/check-sprites.mjs

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const MAIN_PACK = join(repo, 'assets', 'sprites');
const OVERLAY = join(repo, 'kaizo', 'assets', 'sprites');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

// ── the two packs ──────────────────────────────────────────────────────────
const mainManifest = JSON.parse(readFileSync(join(MAIN_PACK, 'manifest.json'), 'utf8'));
const overlayExists = existsSync(join(OVERLAY, 'manifest.json'));
ok(overlayExists, 'the kaizo sprite overlay exists '
  + '(build: node kaizo/tools/pack-kaizo-sprites.mjs)');
if (!overlayExists) process.exit(1);
const overlayManifest = JSON.parse(readFileSync(join(OVERLAY, 'manifest.json'), 'utf8'));

const resolvable = new Set([...Object.keys(mainManifest), ...Object.keys(overlayManifest)]);
console.log(`  --  ${Object.keys(mainManifest).length} sprites in the vanilla pack, `
  + `${Object.keys(overlayManifest).length} in the kaizo overlay`);

// ── 1: every sprite the kaizo code names ───────────────────────────────────
// Scanned from source rather than listed by hand: a hand-list goes stale the
// moment a translation adds a sprite, and going stale silently is the whole
// failure mode this file exists to catch.
const srcDirs = [join(repo, 'kaizo', 'attacks'), join(repo, 'kaizo', 'scenes'),
  join(repo, 'kaizo', 'party')];
const referenced = new Map(); // sprite -> [files]
for (const dir of srcDirs) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const text = readFileSync(join(dir, f), 'utf8');
    for (const m of text.matchAll(/'(spr_[a-z0-9_]+)'/g)) {
      if (!referenced.has(m[1])) referenced.set(m[1], []);
      referenced.get(m[1]).push(f);
    }
  }
}
ok(referenced.size > 0, `found sprite references to check (${referenced.size} distinct)`);

const unresolved = [...referenced.keys()].filter((s) => !resolvable.has(s));
ok(unresolved.length === 0,
  `every sprite named in kaizo/ resolves${unresolved.length
    ? ` — MISSING: ${unresolved.map((s) => `${s} (${referenced.get(s).join(', ')})`).join('; ')}`
    : ` (${referenced.size} checked)`}`);

// ── 2 + 3: the overlay's files are all really there ────────────────────────
{
  const badFiles = [];
  const badCounts = [];
  for (const [name, meta] of Object.entries(overlayManifest)) {
    for (const f of meta.files) {
      if (!existsSync(join(OVERLAY, f))) badFiles.push(`${name}/${f}`);
    }
    if (meta.files.length !== meta.frames) {
      badCounts.push(`${name}: manifest says ${meta.frames} frames, lists ${meta.files.length}`);
    }
  }
  ok(badFiles.length === 0,
    `every overlay frame is on disk${badFiles.length ? ` — MISSING ${badFiles.join(', ')}` : ''}`);
  ok(badCounts.length === 0,
    `every overlay frame count matches its file list${badCounts.length ? ` — ${badCounts.join('; ')}` : ''}`);
}

// ── 3b: THE MOD'S REPLACED ART actually overrides the vanilla pack ─────────
// The mod's visual identity is REPLACED SPRITES, not code: it repaints ~57
// sprites in place and keeps every name. The Knight's own idle goes from grey
// (91,91,91) to blue (212,222,255) with the same name, size and pixel count —
// which means NO code check can see it and the overlay is the only thing
// standing between "the Knight is blue" and "the Knight looks vanilla".
//
// Asserted two ways, because either alone is weak: the packer must have
// CLASSIFIED them as replacements, and the bytes on disk must actually differ
// from the main pack's. A manifest flag with identical bytes behind it would
// be a lie; differing bytes with no flag would mean the next repack drops them.
{
  const replaced = Object.entries(overlayManifest).filter(([, m]) => m.replaced);
  ok(replaced.length >= 50,
    `the overlay carries the mod's in-place repaints (${replaced.length} sprites)`);

  const knight = overlayManifest.spr_roaringknight_idle;
  ok(!!knight && knight.replaced === true && knight.source === 'mod',
    "the KNIGHT's own idle is carried as mod-replaced art — without it he renders vanilla grey");

  const notActuallyDifferent = [];
  for (const [name, m] of replaced) {
    const mainEntry = mainManifest[name];
    if (!mainEntry) continue; // mod-only art has nothing to differ from
    // EVERY frame, not just the first. A multi-frame sprite can be repainted
    // on a later frame only — spr_roaringknight_sword_grab_hand_new is one,
    // and comparing frame 0 alone reported it as a false replacement.
    let anyDiffers = false;
    for (const f of m.files) {
      const a = join(OVERLAY, f);
      const b = join(MAIN_PACK, f);
      if (!existsSync(a) || !existsSync(b)) { anyDiffers = true; break; }
      if (!readFileSync(a).equals(readFileSync(b))) { anyDiffers = true; break; }
    }
    if (!anyDiffers) notActuallyDifferent.push(name);
  }
  ok(notActuallyDifferent.length === 0,
    'every sprite flagged `replaced` really does differ from the main pack'
    + `${notActuallyDifferent.length ? ` — IDENTICAL: ${notActuallyDifferent.slice(0, 5).join(', ')}` : ''}`);
}

// ── 4: THE PUBLISH GATE ────────────────────────────────────────────────────
// The gate is only real if git actually refuses these. Asserting the
// .gitignore TEXT would prove nothing — patterns interact, and the root
// ignore's `!assets/sprites/*.png` carve-out is exactly the kind of rule that
// can start matching a new directory. So ask git itself.
{
  const modEntries = Object.entries(overlayManifest).filter(([, m]) => m.source === 'mod');
  ok(modEntries.length > 0, `the overlay carries mod-sourced art to gate (${modEntries.length} sprites)`);

  // EVERY mod frame, not a sample — the gate is only as good as its weakest
  // path, and a sample cannot find the one file a future pattern misses.
  const probes = [...modEntries.flatMap(([, m]) => m.files), 'manifest.json', 'masks.json']
    .map((f) => `kaizo/assets/sprites/${f}`);

  // NO `-q` HERE. `git check-ignore -q` is "only valid with a single
  // pathname" and exits 128 — a FATAL ERROR that a bare try/catch reads as
  // "not ignored". This assertion failed that way on its first run and the
  // gate was in fact holding fine: a check that cannot tell a crash from a
  // negative is worse than no check, because it burns trust in the real
  // failures. Without -q, check-ignore prints one line per ignored path, so
  // the returned set is compared against the probes and names the misses.
  let ignoredSet = new Set();
  try {
    const out = execFileSync('git', ['check-ignore', ...probes],
      { cwd: repo, encoding: 'utf8' });
    ignoredSet = new Set(out.split('\n').map((l) => l.trim().replace(/\\/g, '/')).filter(Boolean));
  } catch (err) {
    // exit 1 = none ignored (stdout empty). Anything else is a real error.
    if (err.status !== 1) {
      ok(false, `PUBLISH GATE: git check-ignore failed (${err.status}): ${err.stderr ?? err.message}`);
    }
  }
  const unGated = probes.filter((p) => !ignoredSet.has(p));
  ok(unGated.length === 0,
    `PUBLISH GATE: git ignores all ${probes.length} mod-sourced files and their metadata `
    + `(EnderCat8's work — HANDOFF §5-C)${unGated.length
      ? ` — NOT GATED: ${unGated.slice(0, 5).join(', ')}${unGated.length > 5 ? ` (+${unGated.length - 5})` : ''}`
      : ''}`);

  // ...and the gate must not swallow its own documentation.
  let gateTracked = false;
  try {
    execFileSync('git', ['check-ignore', '-q', join(OVERLAY, '..', '.gitignore')],
      { cwd: repo, stdio: 'pipe' });
  } catch {
    gateTracked = true; // exit 1 == not ignored == committable
  }
  ok(gateTracked, 'kaizo/assets/.gitignore is itself committable, so the gate survives a clone');
}

console.log('');
if (failed) {
  console.log(`check-sprites: ${failed} FAILING`);
  process.exit(1);
}
console.log('check-sprites: green.');
