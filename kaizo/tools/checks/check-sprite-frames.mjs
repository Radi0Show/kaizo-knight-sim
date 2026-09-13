#!/usr/bin/env node
// EVERY FRAME MUST BE THE SIZE ITS SPRITE DECLARES.
//
//   node kaizo/tools/checks/check-sprite-frames.mjs
//
// ── WHY A SECOND SPRITE CHECK ─────────────────────────────────────────────
//
// `check-sprites.mjs` asks whether every frame a manifest lists EXISTS. That
// is a different question from whether the frame is right, and the difference
// shipped for weeks under a green gate.
//
// GameMaker packs each frame onto a texture page with its transparent margin
// CROPPED OFF and remembers where the crop sits inside the sprite's declared
// box. An exporter that writes the cropped bitmap and drops that offset
// produces a PNG SMALLER than the sprite — and render/ blits every frame at
// `-(meta.ox, meta.oy)`, its natural size, so a short frame draws SHORT and in
// the WRONG PLACE, off by exactly the margin that was cut.
//
// Twelve frames were in that state when this file was written, eleven in the
// vanilla pack and one in the kaizo overlay:
//
//   spr_battlemsg 0-4              74x20  against a declared 83x20
//   spr_susie_walk_right_dw_unhappy 1,3   one row short (42 of 43)
//   spr_ralsei_walk_right_unhappy   1,3   one row short (39 of 40)
//   spr_undyne_dw_caught            1     one row short (33 of 34)
//   spr_susie_laugh_dw              1     one row short (40 of 41)
//   spr_roaringknight_sword_ol_alt  0     74x31 against a declared 75x31
//
// NINE PIXELS OFF EVERY BATTLE MESSAGE BOX, in other words, on the sprite the
// player reads once a turn. No filename check could see any of it, because
// every filename was right.
//
// So this reads the PNG's own IHDR — the real pixel dimensions — and compares
// them with the manifest the renderer positions against. It is deliberately
// the dumbest possible assertion, because the expensive lesson here was that
// the clever ones were all asking about the wrong thing.
//
// POSITIVE ASSERTIONS, per CLAUDE.md: a check that compares nothing passes
// vacuously, and this one would if a manifest failed to parse or a pack moved.
// So it asserts that it actually MEASURED a plausible number of frames, and it
// names the twelve above and requires each to be present and full size — a
// list of known-bad cases is the one thing a regression cannot dodge.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const MAIN_PACK = join(repo, 'assets', 'sprites');
const OVERLAY = join(repo, 'kaizo', 'assets', 'sprites');

// The pack is vendored from knight-sim and the overlay is built by
// pack-kaizo-sprites.mjs; both are big enough that a floor catches "the pack
// went missing" without pinning a number that grows with every translation.
const MIN_MAIN_FRAMES = 1000;
const MIN_OVERLAY_FRAMES = 400;

/**
 * The twelve frames this check was written for, by name, with the size the
 * sprite declares. Any of them coming back short again is the regression.
 */
const THE_TWELVE = [
  ['main', 'spr_battlemsg_0.png', 83, 20],
  ['main', 'spr_battlemsg_1.png', 83, 20],
  ['main', 'spr_battlemsg_2.png', 83, 20],
  ['main', 'spr_battlemsg_3.png', 83, 20],
  ['main', 'spr_battlemsg_4.png', 83, 20],
  ['main', 'spr_susie_walk_right_dw_unhappy_1.png', 25, 43],
  ['main', 'spr_susie_walk_right_dw_unhappy_3.png', 25, 43],
  ['main', 'spr_ralsei_walk_right_unhappy_1.png', 19, 40],
  ['main', 'spr_ralsei_walk_right_unhappy_3.png', 19, 40],
  ['main', 'spr_undyne_dw_caught_1.png', 39, 34],
  ['main', 'spr_susie_laugh_dw_1.png', 28, 41],
  ['overlay', 'spr_roaringknight_sword_ol_alt_0.png', 75, 31],
];

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

/**
 * A PNG's declared pixel size, read straight out of IHDR (fixed at byte 16).
 * Reading the header rather than decoding keeps this cheap over 1,600 frames,
 * and the magic check means a truncated or non-PNG file fails loudly instead
 * of returning a plausible-looking zero.
 */
function pngSize(path) {
  const buf = readFileSync(path);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${path} is not a PNG (${buf.length} bytes)`);
  }
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** @returns {{frames: number, bad: string[], absent: string[]}} */
function measure(dir, label) {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  // pack-sprites writes the sprite map at the top level; the kaizo packer has
  // carried both shapes. Accept either rather than silently measuring nothing.
  const sprites = manifest.sprites ?? manifest;
  let frames = 0;
  const bad = [];
  const absent = [];
  for (const [name, meta] of Object.entries(sprites)) {
    for (const file of meta.files ?? []) {
      const path = join(dir, file);
      if (!existsSync(path)) { absent.push(`${label}/${file}`); continue; }
      const got = pngSize(path);
      frames += 1;
      if (got.w !== meta.w || got.h !== meta.h) {
        bad.push(`${label}/${file} is ${got.w}x${got.h}, ${name} declares ${meta.w}x${meta.h}`);
      }
    }
  }
  return { frames, bad, absent };
}

// ── the vanilla pack ───────────────────────────────────────────────────────
const main = measure(MAIN_PACK, 'assets/sprites');
console.log(`  --  measured ${main.frames} frames in assets/sprites`);
ok(main.frames >= MIN_MAIN_FRAMES,
  `the vanilla pack was actually measured (${main.frames} frames, want >= ${MIN_MAIN_FRAMES})`);
ok(main.bad.length === 0, 'every vanilla frame is the size its sprite declares');
for (const b of main.bad) console.log(`       ${b}`);
// Absence is check-sprites.mjs's assertion, not this one's, but a frame that
// vanished would otherwise quietly shrink the number measured above.
ok(main.absent.length === 0, `no vanilla frame is missing (${main.absent.length})`);

// ── the kaizo overlay ──────────────────────────────────────────────────────
// Publish-gated (kaizo/assets/.gitignore): a fresh clone has none of it, and
// check-sprites.mjs already hard-exits in that case. Say the same thing here
// rather than passing on an overlay that is not there.
const overlayExists = existsSync(join(OVERLAY, 'manifest.json'));
ok(overlayExists, 'the kaizo sprite overlay exists '
  + '(build: node kaizo/tools/pack-kaizo-sprites.mjs)');
let overlay = { frames: 0, bad: [], absent: [] };
if (overlayExists) {
  overlay = measure(OVERLAY, 'kaizo/assets/sprites');
  console.log(`  --  measured ${overlay.frames} frames in kaizo/assets/sprites`);
  ok(overlay.frames >= MIN_OVERLAY_FRAMES,
    `the kaizo overlay was actually measured (${overlay.frames} frames, want >= ${MIN_OVERLAY_FRAMES})`);
  ok(overlay.bad.length === 0, 'every kaizo overlay frame is the size its sprite declares');
  for (const b of overlay.bad) console.log(`       ${b}`);
  ok(overlay.absent.length === 0, `no overlay frame is missing (${overlay.absent.length})`);
}

// ── the twelve, by name ────────────────────────────────────────────────────
let twelveOk = 0;
const twelveBad = [];
for (const [which, file, w, h] of THE_TWELVE) {
  const dir = which === 'main' ? MAIN_PACK : OVERLAY;
  if (which === 'overlay' && !overlayExists) continue;
  const path = join(dir, file);
  if (!existsSync(path)) { twelveBad.push(`${file} is absent`); continue; }
  const got = pngSize(path);
  if (got.w === w && got.h === h) twelveOk += 1;
  else twelveBad.push(`${file} is ${got.w}x${got.h}, want ${w}x${h}`);
}
const wantTwelve = overlayExists ? THE_TWELVE.length : THE_TWELVE.length - 1;
ok(twelveOk === wantTwelve,
  `the twelve frames this check was written for are all full size (${twelveOk}/${wantTwelve})`);
for (const b of twelveBad) console.log(`       ${b}`);

console.log(failed ? `\ncheck-sprite-frames: ${failed} FAILED` : '\ncheck-sprite-frames: ok');
process.exit(failed ? 1 : 0);
