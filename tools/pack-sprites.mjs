#!/usr/bin/env node
// Build assets/sprites/ from a raw sprite dump plus the metadata JSON.
//
//   node tools/pack-sprites.mjs <names.txt> [dumpDir] [metaJson]
//
// Produce the two inputs from the PRIVATE research repo (neither is ever
// committed):
//
//   UndertaleModCli dump <game.ios> --sprites -o /tmp/sprdump
//   UndertaleModCli load <game.ios> -s tools/patches/sprite_meta.csx -o /tmp/x.ios
//   UndertaleModCli load <game.ios> -s tools/patches/sprite_frame_rects.csx  (optional,
//                                                and only needed for a TRIMMED dump)
//
// WHY THE METADATA MATTERS. GameMaker positions every draw relative to a
// sprite's ORIGIN, and the dump has no origins in it. Art packed without them
// sits offset from the physics — the sprite/hitbox mismatch this project
// exists to avoid. manifest.json carries origin, size, frame count and bbox.
//
// Frame counts come from the metadata, never from globbing: `spr_rk_quickslash`
// and `spr_rk_quickslash_lower` share a filename prefix, so a glob would fold
// one into the other.
//
// ── A FRAME SMALLER THAN ITS SPRITE ───────────────────────────────────────
//
// GameMaker packs each frame onto a texture page with its transparent margin
// CROPPED OFF and remembers where the crop sits inside the declared sprite box
// (TargetX/TargetY). An exporter that writes the cropped bitmap and drops that
// offset produces a PNG that is SMALLER than the sprite it belongs to, and
// render/ blits it at `-origin` — so the art draws short AND in the wrong
// place, by exactly the margin that was cut.
//
// THIS SHIPPED, AND A GREEN GATE NEVER SAW IT. The pack carried eleven such
// frames for two weeks: `spr_battlemsg` 0-4 were 74x20 against a declared
// 83x20 (nine columns missing from every battle message box, all five frames)
// and six walk/laugh/caught frames were one row short at the top. Nothing
// noticed, because every check asked whether the FILE EXISTED. A filename is
// not a size.
//
// So this script now compares each frame's real IHDR size against the
// metadata and REFUSES TO PACK A SHORT FRAME. Given the frame-rect JSON it
// repads instead of failing: the trimmed bitmap is composed onto a
// transparent canvas of the sprite's own declared size at (TargetX, TargetY),
// which is what GameMaker itself draws. Padding costs nothing — transparent
// rows deflate to almost zero — and it keeps manifest.json an honest
// description of what the PNG actually is, so a pixel-dimension check is a
// one-line invariant and render/ needs no per-frame offset at all.
//
// A dump made WITH padding (UTMT's own `dump --sprites`, and
// `extract_sprite.csx` since its includePadding fix) needs none of this: those
// frames already match and are copied byte for byte.

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { size as pngSize, decode as pngDecode, encode as pngEncode, pad as pngPad } from './png.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'assets', 'sprites');

const namesFile = process.argv[2] ?? '/tmp/sprlist.txt';
const dumpDir = join(process.argv[3] ?? '/tmp/sprdump', 'Sprites');
const metaFile = process.argv[4] ?? '/tmp/sprite_meta.json';
// Per-frame trim rects, for a dump that cropped. Absent is the normal case.
const rectsFile = process.argv[5] ?? process.env.SPRITE_FRAME_RECTS ?? '/tmp/sprite_frame_rects.json';

const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
const rects = existsSync(rectsFile) ? JSON.parse(readFileSync(rectsFile, 'utf8')) : {};
const names = readFileSync(namesFile, 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

mkdirSync(OUT, { recursive: true });

// THIS SCRIPT REBUILDS THE PACK FROM SCRATCH — it deletes every PNG and copies
// back only what `namesFile` lists. That is right for a full rebuild and
// catastrophic for the thing it kept getting used for: adding two sprites.
//
// Running it with a two-name list deleted 745 PNGs and left a manifest with
// two entries in it. The suites all stayed green, because sim/ does not read
// sprites — the loss only showed as a browser rendering nothing, one round
// trip later. The PNGs are gitignored, so there was no `git checkout` back.
//
// So: refuse to shrink the pack by more than half unless asked. `--replace`
// is the full-rebuild path and says so at the call site.
const manifestPath = join(OUT, 'manifest.json');
const replace = process.argv.includes('--replace');
if (!replace && existsSync(manifestPath)) {
  const prev = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const prevCount = Object.keys(prev.sprites ?? prev).length;
  if (prevCount > 0 && names.length < prevCount / 2) {
    console.error(
      `refusing to shrink the pack from ${prevCount} sprites to ${names.length}.\n` +
      'This rebuilds from scratch — it does not merge. To ADD a sprite, append\n' +
      "its name to the full list and re-run; to rebuild anyway, pass --replace.",
    );
    process.exit(1);
  }
}

for (const f of readdirSync(OUT)) {
  if (f.endsWith('.png')) unlinkSync(join(OUT, f));
}

const manifest = {};
const missing = [];
/** Frames whose PNG is not the size the sprite declares and could not be repadded. */
const short = [];
let copied = 0;
let repadded = 0;

for (const name of [...new Set(names)].sort()) {
  const m = meta[name];
  if (!m) {
    missing.push(`${name} (not a sprite in this build)`);
    continue;
  }

  const files = [];
  for (let i = 0; i < m.frames; i++) {
    const file = `${name}_${i}.png`;
    const src = join(dumpDir, file);
    if (!existsSync(src)) {
      missing.push(`${file} (metadata says ${m.frames} frames)`);
      continue;
    }
    // THE SIZE IS CHECKED, NOT ASSUMED — see "A FRAME SMALLER THAN ITS
    // SPRITE" above. A frame that already matches is copied byte for byte, so
    // a padded dump reproduces the previous pack exactly.
    const bytes = readFileSync(src);
    const got = pngSize(bytes);
    if (got.w === m.w && got.h === m.h) {
      copyFileSync(src, join(OUT, file));
    } else {
      const r = rects[`${name}_${i}`];
      // Only the RAW trim rect is repadded. A frame of any other odd size is
      // refused rather than guessed at: placing it wrongly would reintroduce
      // exactly the offset bug this is here to stop, and silently.
      if (!r || got.w !== r.tw || got.h !== r.th) {
        short.push(`${file} — PNG is ${got.w}x${got.h}, sprite declares ${m.w}x${m.h}`
          + (r ? ` (trim rect says ${r.tw}x${r.th} at ${r.tx},${r.ty})` : ' (no trim rect available)'));
        continue;
      }
      writeFileSync(join(OUT, file), pngEncode(pngPad(pngDecode(bytes), m.w, m.h, r.tx, r.ty)));
      repadded += 1;
    }
    files.push(file);
    copied += 1;
  }
  if (!files.length) continue;

  manifest[name] = {
    w: m.w,
    h: m.h,
    ox: m.ox,
    oy: m.oy,
    frames: files.length,
    bbox: m.bbox,
    sepmasks: m.sepmasks,
    // GameMaker multiplies image_speed by the SPRITE's own playback rate.
    playback: m.playback,
    playbacktype: m.playbacktype,
    files,
  };
}

writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);

console.log(`packed ${Object.keys(manifest).length} sprites, ${copied} frames -> assets/sprites`
  + (repadded ? `, ${repadded} repadded to the declared size` : ''));
if (missing.length) {
  console.log(`\n${missing.length} missing:`);
  for (const s of missing.slice(0, 20)) console.log(`  ${s}`);
  if (missing.length > 20) console.log(`  ... and ${missing.length - 20} more`);
}

// A SHORT FRAME IS A FAILURE, not a warning. It draws short and offset in the
// browser and nothing downstream can tell; the pack is left without it rather
// than shipped wrong, and the exit code says so.
if (short.length) {
  console.error(`\n${short.length} frame(s) SMALLER THAN THE SPRITE THEY BELONG TO — not packed:`);
  for (const s of short) console.error(`  ${s}`);
  console.error('\nThe dump was written TRIMMED. Re-export with padding (UTMT\'s own\n'
    + '`dump --sprites`, or extract_sprite.csx, which passes includePadding: true),\n'
    + 'or supply the frame rects so they can be repadded:\n'
    + '  UndertaleModCli load <data.win> -s tools/patches/sprite_frame_rects.csx < NUL\n'
    + '  SPRITE_FRAME_RECTS=<that json> node tools/pack-sprites.mjs ...');
  process.exit(1);
}
