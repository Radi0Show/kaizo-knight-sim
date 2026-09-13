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

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
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

// ── 1: every sprite the SHIPPED code names ─────────────────────────────────
// Scanned from source rather than listed by hand: a hand-list goes stale the
// moment a translation adds a sprite, and going stale silently is the whole
// failure mode this file exists to catch.
//
// THIS SCAN WAS EVADABLE TWICE OVER, and both holes were found the expensive
// way — by a person looking at the screen — after this file had reported green.
//
//   QUOTING. It matched /'(spr_[a-z0-9_]+)'/ — SINGLE QUOTES ONLY. The B-Side
//   epilogue's SPR table was written in BACKTICKS, so eighteen sprites that
//   were in neither pack were invisible to an enforced gate, which stayed
//   green on a quoting style. All three JS string delimiters are matched now.
//
//   SCOPE. It walked three directories — kaizo/attacks, kaizo/scenes,
//   kaizo/party. The kaizo PAGE loads far more than that: kaizo/render,
//   kaizo/ui, kaizo/actors, kaizo/versions, kaizo/data, web/, and the whole
//   vendored engine under sim/, render/ and input/, every one of which does
//   `sprites.get('spr_…')` against these same two packs. `spr_tenna_x` — the
//   ACT grid's crossed-out partner heads, render/menu.js:231 — sat unresolved
//   there the whole time. The walk is recursive over every shipped directory
//   now, so the answer does not depend on where a translation happens to live.
//
// COMMENTS ARE STRIPPED FIRST, and that is not a narrowing. This repo's
// translations quote GML and discuss absent art in prose — kaizo/attacks/
// lightorb.js names four sprites precisely to say they were never extracted —
// and markdown backticks around a name in a comment are not something the
// renderer can reach. Enforcing on prose would make the honest thing (writing
// the gap down) the thing that fails the gate. Comment-only names are still
// collected and PRINTED below, so "discussed but absent" stays visible.
const SRC_ROOTS = ['kaizo', 'web', 'sim', 'render', 'input'];

/** Every .js under `dir`, recursively, minus tool directories. */
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

/**
 * Strip // and block comments without touching string literals.
 *
 * Written as a scanner rather than a regex on purpose: a regex that removes
 * `//…` cannot tell a comment from the `//` inside `'https://…'`, and one that
 * removes quoted spans cannot tell a quote from an apostrophe in prose. The
 * two have to be walked together in one pass, which is what this does.
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

// `bg_` as well as `spr_`: bg_snowfall is a SPRITE in this build despite the
// name, and it is one of the two the SnowGrave drawer had nothing to paint
// with. A name-prefix filter that assumed `spr_` would have missed it.
const NAME_RE = /['"`](spr_[A-Za-z0-9_]+|bg_[A-Za-z0-9_]+)['"`]/g;

const referenced = new Map(); // sprite -> Set(file)
const discussed = new Map(); // comment-only mentions -> Set(file)
const srcFiles = SRC_ROOTS.flatMap((r) => jsUnder(join(repo, r)));
for (const p of srcFiles) {
  const raw = readFileSync(p, 'utf8');
  const rel = relative(repo, p).replace(/\\/g, '/');
  const inCode = new Set();
  for (const m of stripComments(raw).matchAll(NAME_RE)) {
    inCode.add(m[1]);
    if (!referenced.has(m[1])) referenced.set(m[1], new Set());
    referenced.get(m[1]).add(rel);
  }
  for (const m of raw.matchAll(NAME_RE)) {
    if (inCode.has(m[1])) continue;
    if (!discussed.has(m[1])) discussed.set(m[1], new Set());
    discussed.get(m[1]).add(rel);
  }
}
console.log(`  --  scanned ${srcFiles.length} shipped .js files under ${SRC_ROOTS.join('/, ')}/`);
ok(referenced.size > 0, `found sprite references to check (${referenced.size} distinct)`);

/**
 * Names a Draw genuinely reaches for that NOTHING can resolve, each with the
 * receipt for why that is correct rather than a hole.
 *
 * This list is the one place the gate is allowed to say "absent and fine", so
 * every entry names the site and the reason. It is NOT a place to silence a
 * failure: an entry here whose name STARTS resolving also fails (below), so a
 * later extraction cannot leave a stale excuse behind.
 */
const KNOWN_ABSENT = {
  // sim/data/masks.js is a generated MASK table; this is the `name` field of a
  // collision mask, not a sheet anything blits. The mask rows travel with the
  // entry, so nothing looks the sprite up in either pack.
  spr_bullet_knightcrescent_hitbox: 'mask-table name in sim/data/masks.js, never drawn',
  // kaizo/render/draw/stream.js:471, obj_growtangle Draw_0's customBox arm.
  // The arm is unreachable while the slasher draws — the board is parked at
  // growcon 2 by then and the `growcon != 2` test is false — and the name is
  // in NEITHER data file's sprite metadata, so there is no art to extract.
  // Kept as a faithful translation of a dead branch (law 4).
  spr_custom_box: 'unreachable customBox arm; absent from both data files entirely',
};

const unresolved = [...referenced.keys()]
  .filter((s) => !resolvable.has(s) && !(s in KNOWN_ABSENT));
ok(unresolved.length === 0,
  `every sprite named in shipped code resolves${unresolved.length
    ? ` — MISSING: ${unresolved.map((s) => `${s} (${[...referenced.get(s)].join(', ')})`).join('; ')}`
    : ` (${referenced.size} checked, ${Object.keys(KNOWN_ABSENT).length} known-absent)`}`);

// The excuses must stay true in BOTH directions.
{
  const stale = Object.keys(KNOWN_ABSENT).filter((s) => resolvable.has(s));
  ok(stale.length === 0,
    `no KNOWN_ABSENT entry has quietly started resolving${stale.length
      ? ` — REMOVE: ${stale.join(', ')}` : ''}`);
  const unused = Object.keys(KNOWN_ABSENT).filter((s) => !referenced.has(s));
  ok(unused.length === 0,
    `every KNOWN_ABSENT entry is still named by real code${unused.length
      ? ` — DEAD EXCUSE: ${unused.join(', ')}` : ''}`);
}

// A NAME BUILT AT RUNTIME CANNOT BE CHECKED BY ANY OF THE ABOVE, so the gate
// has to at least know it exists. Nothing in the tree does this today (every
// sprite name is a whole literal); this assertion is what keeps that true,
// because the day one appears is the day this file's answer stops being
// complete and it should say so rather than stay green.
{
  const dynamic = [];
  for (const p of srcFiles) {
    const stripped = stripComments(readFileSync(p, 'utf8'));
    if (/['"`](?:spr_|bg_)[A-Za-z0-9_]*(?:\$\{|['"`]\s*\+|\+\s*['"`])/.test(stripped)
      || /\$\{[^}]*\}[A-Za-z0-9_]*['"`]/.test(stripped.match(/`(?:spr_|bg_)[^`]*`/)?.[0] ?? '')) {
      dynamic.push(relative(p, repo) ? relative(repo, p).replace(/\\/g, '/') : p);
    }
  }
  ok(dynamic.length === 0,
    `no sprite name is assembled at runtime, so a name scan is complete${dynamic.length
      ? ` — DYNAMIC: ${dynamic.join(', ')}` : ''}`);
}

// Informational: names that appear only in prose. Not enforced (see above),
// but printed every run so the set of "known gaps we wrote down" is in front
// of whoever reads this output, instead of only in a comment nobody opens.
{
  const absentProse = [...discussed.keys()]
    .filter((s) => !resolvable.has(s) && !referenced.has(s)).sort();
  console.log(`  --  ${absentProse.length} sprite name(s) discussed in comments but in neither pack`
    + `${absentProse.length ? `: ${absentProse.join(', ')}` : ''}`);
}

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

// ── 3a: RESOLVING IS NOT THE SAME AS BEING RIGHT ──────────────────────────
// A sprite can resolve, have every file on disk, and still be wrong on screen:
// the wrong FRAME COUNT animates to a blank or loops early, and a missing or
// wrong ORIGIN puts the art somewhere the physics is not — GameMaker draws
// every sprite relative to its origin, which is the whole reason the packer
// carries ox/oy at all. Presence checks cannot see either, and neither can a
// screenshot of one frame.
//
// Run over BOTH packs, because a kaizo Draw reads whichever one resolves the
// name and the vanilla pack is the one that answers most of them.
{
  const bad = [];
  for (const [label, man, dir] of [['vanilla', mainManifest, MAIN_PACK],
    ['overlay', overlayManifest, OVERLAY]]) {
    for (const [name, m] of Object.entries(man)) {
      const p = [];
      if (!Array.isArray(m.files) || m.files.length === 0) p.push('no files[]');
      else {
        const missingFrames = m.files.filter((f) => !existsSync(join(dir, f)));
        if (missingFrames.length) p.push(`frame file(s) absent: ${missingFrames.join(',')}`);
        if (m.files.length !== m.frames) p.push(`frames=${m.frames} but ${m.files.length} file(s)`);
      }
      // ORIGIN: 0 is a legitimate origin, so this must test the TYPE. A
      // `!m.ox` test would pass every top-left-anchored sprite through as
      // broken and — worse — pass an entry whose origin key was renamed.
      if (typeof m.ox !== 'number' || typeof m.oy !== 'number') p.push('no ox/oy origin');
      if (!(m.w > 0) || !(m.h > 0)) p.push(`degenerate size ${m.w}x${m.h}`);
      if (p.length) bad.push(`${label}/${name}: ${p.join('; ')}`);
    }
  }
  ok(bad.length === 0,
    `every sprite in both packs has its frames on disk, a frame count that matches, `
    + `an origin and a real size (${Object.keys(mainManifest).length
      + Object.keys(overlayManifest).length} entries)`
    + `${bad.length ? ` — ${bad.slice(0, 6).join(' | ')}${bad.length > 6 ? ` (+${bad.length - 6})` : ''}` : ''}`);
}

// ── 3a-1: THE PIXELS THEMSELVES ───────────────────────────────────────────
// Everything above this point trusts the manifest. The manifest is a JSON file
// written by an extractor, and the extractor can be wrong — so the last thing
// worth asserting is the one fact that comes from the IMAGE: read each PNG's
// IHDR and check its real width and height against the size the manifest
// promises for that sprite.
//
// This is what catches a truncated or half-written extraction, which is the
// failure the packer's own header warns about ("a truncated extraction animates
// to a blank frame rather than failing"). It also catches a frame the extractor
// TRIMMED: render/draw/gm.js draws from `img.width` — the PNG's natural size —
// so a frame narrower than its sprite is painted narrower, anchored at the same
// origin, and every pixel after the trim is in the wrong place.
//
// Reading the IHDR directly rather than decoding: the first 24 bytes of a PNG
// are signature + IHDR length/type + width + height, so this costs one small
// read per file and pulls in nothing.
{
  /**
   * Frames pinned as MEASURED to be smaller than their sprite.
   *
   * NOT a whitelist of things that are fine — a list of a real defect, pinned
   * so it could not grow silently while the gate stayed green.
   *
   * **EMPTY SINCE 2026-09-12: ALL TWELVE ARE FIXED.** The list held
   * spr_battlemsg 0-4 (74x20 against a declared 83x20 — nine pixels off every
   * battle message box), the epilogue's Susie and Ralsei unhappy walk cycles
   * and two more party frames one row short, and the overlay's
   * spr_roaringknight_sword_ol_alt_0 at 74x31 against 75x31.
   *
   * The cause was the extractor writing each frame's TRIMMED bitmap and
   * dropping the trim offset, so the eleven vanilla frames were re-extracted
   * untrimmed at the declared size (knight-sim, branch `kaizo-sprite-frames`;
   * `tools/pack-sprites.mjs` now refuses to pack a short frame and repads one
   * when given the frame rects). The overlay frame was worse: UTMT's
   * `ExportAsPNG(..., includePadding: true)` composes onto the TEXTURE's
   * bounding box, which the mod declares one pixel narrower than the sprite,
   * so the export clipped a column — one opaque pixel, lost. It was re-exported
   * from the raw source rect and composed onto the sprite's own 75x31 box.
   *
   * Leave it empty. A frame that ever comes back short should FAIL, and
   * `check-sprite-frames.mjs` asserts the same twelve by name.
   */
  const KNOWN_TRIMMED = new Set([]);

  /** [width, height] from a PNG's IHDR, or null if it is not a PNG. */
  const pngSize = (p) => {
    const b = readFileSync(p);
    if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };

  const notPng = [];
  const mismatched = [];
  const healed = [];
  for (const [label, man, dir] of [['vanilla', mainManifest, MAIN_PACK],
    ['overlay', overlayManifest, OVERLAY]]) {
    for (const [name, m] of Object.entries(man)) {
      for (const f of m.files ?? []) {
        const p = join(dir, f);
        if (!existsSync(p)) continue; // already reported above
        const size = pngSize(p);
        const key = `${label}/${f}`;
        if (!size) { notPng.push(key); continue; }
        const wrong = size[0] !== m.w || size[1] !== m.h;
        if (wrong && !KNOWN_TRIMMED.has(key)) {
          mismatched.push(`${key}: png ${size[0]}x${size[1]} vs manifest ${m.w}x${m.h} (${name})`);
        } else if (!wrong && KNOWN_TRIMMED.has(key)) {
          healed.push(key);
        }
      }
    }
  }
  ok(notPng.length === 0,
    `every frame file is a real PNG${notPng.length ? ` — CORRUPT/EMPTY: ${notPng.slice(0, 6).join(', ')}` : ''}`);
  ok(mismatched.length === 0,
    `no NEW frame is smaller than the sprite it belongs to `
    + `(${KNOWN_TRIMMED.size} known-trimmed frames pinned)`
    + `${mismatched.length ? ` — ${mismatched.slice(0, 6).join(' | ')}` : ''}`);
  ok(healed.length === 0,
    `no pinned trimmed frame has been fixed without updating the list`
    + `${healed.length ? ` — REMOVE FROM KNOWN_TRIMMED: ${healed.join(', ')}` : ''}`);
}

// ── 3a-2: WHERE THE TWO PACKS DISAGREE ABOUT GEOMETRY ─────────────────────
// The overlay shadows the vanilla pack by name, so when both carry a name the
// overlay's numbers are the ones that reach the screen. A silent geometry
// change there is the nastiest failure in this file's remit: the art looks
// plausible and sits in the wrong place, or animates a frame short.
//
// One disagreement is REAL and measured — spr_roaringknight_slash_tunnel is
// 99x32 in the mod against vanilla's 99x21 (the packer's "METADATA FOLLOWS THE
// ART" note has the receipt). So this does not forbid disagreement; it forbids
// UNEXPLAINED disagreement: only an entry the packer classified as the mod's
// own art may differ, because that is the only way the numbers can honestly
// have changed. A vanilla-sourced entry that disagrees with the vanilla pack
// means one of the two was packed from the wrong metadata.
{
  const wrong = [];
  let differing = 0;
  for (const [name, o] of Object.entries(overlayManifest)) {
    const m = mainManifest[name];
    if (!m) continue;
    const d = [];
    if (o.frames !== m.frames) d.push(`frames ${m.frames}->${o.frames}`);
    if (o.ox !== m.ox || o.oy !== m.oy) d.push(`origin (${m.ox},${m.oy})->(${o.ox},${o.oy})`);
    if (o.w !== m.w || o.h !== m.h) d.push(`size ${m.w}x${m.h}->${o.w}x${o.h}`);
    if (!d.length) continue;
    differing += 1;
    if (o.source !== 'mod') wrong.push(`${name} [source=${o.source}]: ${d.join('; ')}`);
  }
  ok(wrong.length === 0,
    `every overlay entry whose geometry differs from the vanilla pack is mod-sourced art `
    + `(${differing} differ)${wrong.length ? ` — UNEXPLAINED: ${wrong.join(' | ')}` : ''}`);
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
