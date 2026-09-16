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

// ═══════════════════════════════════════════════════════════════════════════
// PART TWO — THE PACKS AGAINST THE DATA FILES THEMSELVES (2026-09-14)
// ═══════════════════════════════════════════════════════════════════════════
//
// Everything above compares a PNG with the MANIFEST. That settles "is the
// frame the size its own entry claims" and settles nothing about whether the
// entry is right. A sprite with the correct size and the WRONG FRAME COUNT
// animates wrongly, and no assertion up to here could see it.
//
// So this half throws away the manifest as an authority and compares both
// packs, entry by entry and frame by frame, against the GAME'S OWN SPRITE
// TABLE — dumped straight out of each data file by
// `knight-research/kaizo-mod/tools/patches/sprite_hash.csx`:
//
//   sprites_<tag>.csv   w, h, origin, margins (the bbox), FRAME COUNT,
//                       sepmasks, playback, playbacktype
//   frames_<tag>.csv    per frame: the padded texture size and `rgba_sha1`,
//                       a sha1 over the padded RGBA bytes
//   drawn_<tag>.csv     per frame: `drawn_sha1`, the same hash with the RGB
//                       under every alpha-0 pixel zeroed (see "THE NINETY")
//
// `<tag>` is `vanilla` (this machine's DELTARUNE chapter 3 data.win, v0.0.105)
// or `kaizo` (a copy of EnderCat8's patched build, v0.0.091 — both version
// numbers read out of each dump's obj_initializer2 Create_0). WHICH TABLE AN
// ENTRY IS JUDGED AGAINST IS THE ENTRY'S OWN `source` FIELD, which is the
// whole point of the packer recording provenance: a `source: 'mod'` sprite is
// the mod's art and must match the MOD's table, and comparing it against
// vanilla would report the mod's own repaint as a defect.
//
// The hash convention is reproducible here because `extract_sprite.csx` writes
// the same padded image `sprite_hash.csx` hashes: decode the PNG, sha1 the
// RGBA bytes, done. Verified on this machine over the whole extraction —
// 1294/1294 vanilla frames and 1335/1336 kaizo frames re-hash to the value the
// CSV recorded, the single exception being the deliberately repadded
// `spr_roaringknight_sword_ol_alt_0` named in THE_TWELVE above.
//
// ── WHAT IT FOUND, 2026-09-14 ─────────────────────────────────────────────
//
// FRAME COUNTS ARE CLEAN. 254 sprites / 1,065 frames in the vanilla pack and
// 129 / 532 in the kaizo overlay, and not one entry's frame count disagrees
// with its data file. The ACT grid's own set is clean too and is asserted by
// name below, because two other lanes are building that grid right now and a
// head strip with the wrong frame count would land as a visible bug the moment
// their work goes in.
//
// THE NINETY, and why the base pack's "100 differing frames" is not what it
// looked like. 100 of the vanilla pack's 1,065 frames have an RGBA sha1 that
// differs from the data file's. NINETY OF THEM DIFFER ONLY IN THE RGB VALUES
// UNDERNEATH FULLY TRANSPARENT PIXELS — every drawn pixel is identical, so the
// difference cannot reach a screen. That is an exporter artifact (what colour
// a packer leaves beneath alpha 0), not an art delta, and it is why this check
// compares BOTH hashes: the raw one says "the bytes differ" and the drawn one
// says whether anybody could ever see it.
//
// THE TEN are real: a drawn pixel differs.
//
//   spr_susieb_act 0,1,8,9   spr_susieb_victory 16,18,19
//   spr_susieb_hurt 0        spr_tensionbar 0,1
//
// WHICH SIDE IS RIGHT — the question yesterday's audit left open. The base
// pack is built from `game.ios`, the MAC chapter-3 build (tools/pack-sprites.mjs
// says so in its own usage line), and this machine's data.win is the Windows
// v0.0.105. They are DIFFERENT BUILDS, and the ten frames are where the art
// moved between them:
//
//   * five of the ten (spr_susieb_act 0,1,8,9 and spr_susieb_victory 19) match
//     the MOD's v0.0.091 build exactly and differ from v0.0.105 — Toby's churn
//     between 0.091 and 0.105, with the pack on the old side. Note what this
//     also settles: `sprites/diff_sprites.csv` files spr_susieb_act as
//     "replaced ... frames[0 1 8 9]", and it is NOT a repaint by EnderCat8 —
//     it is base-version churn showing through, exactly the reversed-churn trap
//     the mod briefing warns about.
//   * three (spr_susieb_hurt 0, spr_susieb_victory 16, spr_tensionbar 1) are
//     BYTE-IDENTICAL in v0.0.091 and v0.0.105 and differ from the pack anyway,
//     which is the proof that the pack is a third build rather than an old
//     Windows one.
//   * two (spr_susieb_victory 18, spr_tensionbar 0) differ three ways.
//
// So the data file is right and the pack is stale, by a build. THE FIX IS NOT
// TAKEN HERE, deliberately: `assets/sprites/` is the VENDORED engine's pack and
// also serves the vanilla sim, so re-exporting it is knight-sim work behind
// knight-sim's own gates, and "correct it toward the mod" would be the wrong
// direction entirely — v0.0.091 is the mod's base, not a target.
//
// DOES IT MATTER FOR THE KAIZO OVERLAY? Almost not at all, and the number is
// the interesting part. NINE of the ten sit on sprites the mod REPLACED, so
// the overlay already carries the mod's own art for them and the kaizo page
// never reads the stale frame. The tenth, `spr_susieb_hurt_0`, is not in the
// overlay: the kaizo page draws the base pack's copy, which is missing ONE
// opaque pixel at (19,19) — colour (67,153,88) in both data files. One pixel,
// on Susie's hurt pose. That is the entire kaizo-visible blast radius, and it
// is asserted below so the number cannot drift without somebody noticing.
//
// THE OVERLAY ITSELF IS PIXEL-EXACT: 532 of 532 frames byte-match the data
// file they were packed from, 0 frame-count mismatches, 0 metadata mismatches.
//
// ── POSITIVE ASSERTIONS ───────────────────────────────────────────────────
//
// Every count below is asserted as an EXACT number, not a bound. A pack that
// silently gained a frame, lost one, or got re-exported from a different build
// moves one of them. The two known exceptions are named rather than tolerated
// by a fuzzy threshold, so closing either one fails this check and forces the
// finding to be rewritten instead of quietly evaporating.

import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { decode as pngDecode } from '../../../tools/png.mjs';

const SPRITE_DATA = join(homedir(), 'knight-research', 'kaizo-mod', 'sprites');

/** Sprite-table rows, keyed by name. */
function readCsv(path) {
  const lines = readFileSync(path, 'utf8').trim().split('\n');
  const head = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    head.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

const GT_FILES = ['sprites_vanilla.csv', 'sprites_kaizo.csv', 'frames_vanilla.csv',
  'frames_kaizo.csv', 'drawn_vanilla.csv', 'drawn_kaizo.csv']
  .map((f) => join(SPRITE_DATA, f));
const haveGroundTruth = GT_FILES.every((f) => existsSync(f));

// A LOUD SKIP, NOT A FAILURE — the same contract check-oracle-schedule keeps.
// Everything above this line is answerable from the repo alone: the packed
// PNGs' own IHDRs against the manifest the renderer positions with. Everything
// BELOW compares those packs against the DATA FILES' sprite tables, which live
// in ~/knight-research and are not in any repo and never will be (CLAUDE.md
// law 7). Asserting their presence made this check exit 1 on a fresh clone, so
// it could not be wired into the gate without reddening every machine without
// an oracle on it — and an unwired check guards nothing.
//
// The skip is LOUD because a silent one is worse than the failure: a reader
// who sees a green gate and no such line would reasonably believe the packs
// had been held against the real data files, which is the expensive half.
if (!haveGroundTruth) {
  console.log('SKIP check-sprite-frames: no data-file sprite tables on this machine');
  console.log(`     looked in ${SPRITE_DATA}`);
  for (const f of GT_FILES.filter((p) => !existsSync(p))) {
    console.log(`     missing ${f.slice(SPRITE_DATA.length + 1)}`);
  }
  console.log('     Regenerate them with knight-research/kaizo-mod/tools (sprite tables),');
  console.log('     THE PACKS ARE NOT COMPARED AGAINST THE REAL SPRITES WITHOUT THEM —');
  console.log('     only against their own manifest, which is what the assertions above do.');
}

if (haveGroundTruth) {
  const SPRITES = {}; const FRAMES = {}; const DRAWN = {};
  for (const tag of ['vanilla', 'kaizo']) {
    SPRITES[tag] = new Map(readCsv(join(SPRITE_DATA, `sprites_${tag}.csv`)).map((r) => [r.sprite, r]));
    FRAMES[tag] = new Map(readCsv(join(SPRITE_DATA, `frames_${tag}.csv`)).map((r) => [`${r.sprite}_${r.frame}`, r]));
    DRAWN[tag] = new Map(readCsv(join(SPRITE_DATA, `drawn_${tag}.csv`)).map((r) => [`${r.sprite}_${r.frame}`, r]));
  }

  /**
   * Both hashes for one packed frame: the raw padded RGBA, and the same with
   * the RGB under every alpha-0 pixel zeroed. The pair is what separates "the
   * bytes differ" from "a player could see it".
   */
  function frameHashes(path) {
    const img = pngDecode(readFileSync(path));
    const raw = createHash('sha1').update(Buffer.from(img.px)).digest('hex');
    const vis = Buffer.alloc(img.px.length);
    for (let i = 0; i < img.px.length; i += 4) {
      const a = img.px[i + 3];
      vis[i + 3] = a;
      if (a) { vis[i] = img.px[i]; vis[i + 1] = img.px[i + 1]; vis[i + 2] = img.px[i + 2]; }
    }
    return { raw, drawn: createHash('sha1').update(vis).digest('hex'), w: img.w, h: img.h };
  }

  /** Audit one pack against the data files its entries name as their source. */
  function against(dir, label, tagOf) {
    const sprites = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    const r = {
      sprites: 0, frames: 0, unknown: [], count: [], meta: [], padded: [],
      rawDiff: [], drawnDiff: [],
    };
    for (const [name, m] of Object.entries(sprites.sprites ?? sprites)) {
      const tag = tagOf(m);
      const gt = SPRITES[tag].get(name);
      r.sprites += 1;
      if (!gt) { r.unknown.push(`${label}/${name} is in no ${tag} sprite table`); continue; }

      const want = Number(gt.frames);
      if (Number(m.frames) !== want || (m.files ?? []).length !== want) {
        r.count.push(`${label}/${name}: manifest says ${m.frames} (${(m.files ?? []).length} files), `
          + `the ${tag} data file says ${want}`);
      }

      const bad = [];
      const fields = [['w', Number(gt.w)], ['h', Number(gt.h)], ['ox', Number(gt.ox)],
        ['oy', Number(gt.oy)], ['sepmasks', gt.sepmasks], ['playback', Number(gt.playback)],
        ['playbacktype', gt.playbacktype]];
      for (const [k, v] of fields) if (m[k] !== v) bad.push(`${k} ${JSON.stringify(m[k])} != ${JSON.stringify(v)}`);
      const bbox = [Number(gt.ml), Number(gt.mt), Number(gt.mr), Number(gt.mb)];
      if (JSON.stringify(m.bbox) !== JSON.stringify(bbox)) {
        bad.push(`bbox ${JSON.stringify(m.bbox)} != ${JSON.stringify(bbox)}`);
      }
      if (bad.length) r.meta.push(`${label}/${name} [${tag}]: ${bad.join('; ')}`);

      for (const file of m.files ?? []) {
        const path = join(dir, file);
        if (!existsSync(path)) continue; // absence is asserted in part one
        const idx = file.replace(/^.*_(\d+)\.png$/, '$1');
        const fr = FRAMES[tag].get(`${name}_${idx}`);
        if (!fr) { r.unknown.push(`${label}/${file} is in no ${tag} frame table`); continue; }
        r.frames += 1;
        const got = frameHashes(path);
        if (got.w !== Number(fr.texw) || got.h !== Number(fr.texh)) {
          r.padded.push(`${label}/${file} is ${got.w}x${got.h}, the ${tag} padded frame is ${fr.texw}x${fr.texh}`);
          continue;
        }
        if (got.raw === fr.rgba_sha1) continue;
        r.rawDiff.push(`${name}_${idx}`);
        const dr = DRAWN[tag].get(`${name}_${idx}`);
        if (!dr || got.drawn !== dr.drawn_sha1) r.drawnDiff.push(`${name}_${idx}`);
      }
    }
    return r;
  }

  const gtMain = against(MAIN_PACK, 'assets/sprites', () => 'vanilla');
  console.log(`  --  vanilla pack vs data.win v0.0.105: ${gtMain.sprites} sprites, ${gtMain.frames} frames compared`);

  ok(gtMain.sprites === 254 && gtMain.frames === 1065,
    `the vanilla pack was compared entry for entry (${gtMain.sprites} sprites / ${gtMain.frames} frames, want 254 / 1065)`);
  ok(gtMain.unknown.length === 0,
    `every vanilla-pack sprite and frame exists in the data file's own table (${gtMain.unknown.length} strangers)`);
  for (const u of gtMain.unknown.slice(0, 20)) console.log(`       ${u}`);

  // THE HEADLINE. Frame counts, which nothing before this could see.
  ok(gtMain.count.length === 0,
    `every vanilla-pack sprite has the FRAME COUNT its data file declares (${gtMain.count.length} wrong)`);
  for (const c of gtMain.count) console.log(`       ${c}`);

  // ONE KNOWN METADATA DEFECT, named. `spr_battleblcon_parts` (the dialogue
  // balloon, render/dialogue.js:127) carries bbox [20,2,95,58] where the data
  // file's margins are [20,2,44,21], and its entry is missing `sepmasks`,
  // `playback` and `playbacktype` entirely — the shape of a HAND-ADDED
  // manifest entry rather than one pack-sprites.mjs wrote. It is in the
  // vendored pack, so the correction is knight-sim's; it is pinned by name
  // here so it cannot grow a second case unnoticed.
  const META_KNOWN = 'assets/sprites/spr_battleblcon_parts';
  const metaOther = gtMain.meta.filter((m) => !m.startsWith(`${META_KNOWN} `));
  ok(gtMain.meta.length === 1 && metaOther.length === 0,
    `exactly one vanilla-pack metadata defect, the known spr_battleblcon_parts bbox (${gtMain.meta.length})`);
  for (const m of gtMain.meta) console.log(`       ${m}`);

  ok(gtMain.padded.length === 0,
    `every vanilla-pack frame is the size the data file pads it to (${gtMain.padded.length})`);
  for (const p of gtMain.padded) console.log(`       ${p}`);

  // THE NINETY AND THE TEN.
  console.log(`  --  vanilla pack: ${gtMain.rawDiff.length} frames differ in RGBA bytes, `
    + `${gtMain.drawnDiff.length} of them in DRAWN pixels`);
  ok(gtMain.rawDiff.length === 100,
    `the vanilla pack differs from data.win v0.0.105 on exactly 100 frames (${gtMain.rawDiff.length})`);
  ok(gtMain.rawDiff.length - gtMain.drawnDiff.length === 90,
    'ninety of those differ ONLY beneath alpha 0 and cannot reach a screen '
    + `(${gtMain.rawDiff.length - gtMain.drawnDiff.length})`);

  // The ten, by name. A frame joining or leaving this set is a build change in
  // the pack and has to be argued for, not absorbed.
  const THE_TEN = [
    'spr_susieb_act_0', 'spr_susieb_act_1', 'spr_susieb_act_8', 'spr_susieb_act_9',
    'spr_susieb_hurt_0',
    'spr_susieb_victory_16', 'spr_susieb_victory_18', 'spr_susieb_victory_19',
    'spr_tensionbar_0', 'spr_tensionbar_1',
  ];
  const tenGot = [...gtMain.drawnDiff].sort().join(' ');
  ok(tenGot === [...THE_TEN].sort().join(' '),
    `the ten stale drawn frames are exactly the ten the Mac build left behind (${gtMain.drawnDiff.length})`);
  if (tenGot !== [...THE_TEN].sort().join(' ')) console.log(`       got: ${tenGot}`);

  // THE ONE THAT REACHES THE KAIZO PAGE. Nine of the ten sit on sprites the
  // mod replaced, so the overlay masks them; spr_susieb_hurt is not in the
  // overlay, and the pack's copy is missing the opaque pixel at (19,19) that
  // BOTH data files carry as (67,153,88,255). Asserted on the pixel itself, so
  // the claim is about the art and not about a hash.
  const overlayNames = overlayExists
    ? new Set(Object.keys(JSON.parse(readFileSync(join(OVERLAY, 'manifest.json'), 'utf8'))))
    : new Set();
  const masked = THE_TEN.filter((f) => overlayNames.has(f.replace(/_\d+$/, '')));
  ok(masked.length === 9,
    `nine of the ten are sprites the mod replaced, so the overlay masks them on the kaizo page (${masked.length})`);
  const hurt = join(MAIN_PACK, 'spr_susieb_hurt_0.png');
  if (existsSync(hurt)) {
    const img = pngDecode(readFileSync(hurt));
    const i = (19 * img.w + 19) * 4;
    ok(img.px[i + 3] === 0,
      'the one stale frame the kaizo page still draws is spr_susieb_hurt_0, '
      + `transparent at (19,19) where the game paints (67,153,88) (alpha ${img.px[i + 3]})`);
  } else {
    ok(false, 'spr_susieb_hurt_0.png is missing');
  }

  // ── the overlay against the build each entry names ──────────────────────
  if (overlayExists) {
    const gtOv = against(OVERLAY, 'kaizo/assets/sprites',
      (m) => (m.source === 'mod' ? 'kaizo' : 'vanilla'));
    console.log(`  --  kaizo overlay vs its own sources: ${gtOv.sprites} sprites, ${gtOv.frames} frames compared`);
    ok(gtOv.sprites === 129 && gtOv.frames === 532,
      `the overlay was compared entry for entry (${gtOv.sprites} sprites / ${gtOv.frames} frames, want 129 / 532)`);
    ok(gtOv.unknown.length === 0,
      `every overlay sprite and frame exists in the table its source names (${gtOv.unknown.length} strangers)`);
    for (const u of gtOv.unknown.slice(0, 20)) console.log(`       ${u}`);
    ok(gtOv.count.length === 0,
      `every overlay sprite has the FRAME COUNT its data file declares (${gtOv.count.length} wrong)`);
    for (const c of gtOv.count) console.log(`       ${c}`);
    ok(gtOv.meta.length === 0,
      `every overlay sprite's size, origin, bbox and playback match its data file (${gtOv.meta.length} wrong)`);
    for (const m of gtOv.meta) console.log(`       ${m}`);
    ok(gtOv.rawDiff.length === 0,
      `every overlay frame is PIXEL-EXACT against the build it was packed from (${gtOv.rawDiff.length} differ)`);
    for (const d of gtOv.rawDiff.slice(0, 20)) console.log(`       ${d}`);

    // The one padded-size exception, named rather than tolerated.
    // `spr_roaringknight_sword_ol_alt` declares 75x31 while its texture entry's
    // bounding box is 74x31, so an `includePadding: true` export CLIPS the last
    // opaque column. The overlay ships the repadded 75x31 frame — the sprite's
    // own declared size, which is what render/ blits against — and that is why
    // it reads as a padded-size mismatch here. Closing it means the repad was
    // lost.
    ok(gtOv.padded.length === 1
      && gtOv.padded[0].includes('spr_roaringknight_sword_ol_alt_0.png'),
      `the overlay's only padded-size exception is the deliberate 75x31 repad (${gtOv.padded.length})`);
    for (const p of gtOv.padded) console.log(`       ${p}`);
  }

  // ── THE ACT GRID'S OWN SPRITES, by name ─────────────────────────────────
  //
  // render/menu.js's ACT grid draws the heart cursor, the partner HEAD strip
  // (sim/menu.js:230-233) and `spr_tenna_x` frame 1 twice per head at 6 and 4
  // degrees, and the charbox row draws the name plates. Two lanes are building
  // the per-character act tables right now; a head strip with the wrong frame
  // count is a bug that only shows up once their work lands, so the counts are
  // pinned here by name with the data file's own numbers beside them.
  const ACT_GRID = [
    ['spr_heart', 2], ['spr_tenna_x', 2],
    ['spr_headkris', 11], ['spr_headsusie', 11], ['spr_headralsei', 11], ['spr_headnoelle', 11],
    ['spr_bnamekris', 1], ['spr_bnamesusie', 1], ['spr_bnameralsei', 1], ['spr_bnamenoelle', 1],
  ];
  const mainSprites = JSON.parse(readFileSync(join(MAIN_PACK, 'manifest.json'), 'utf8'));
  const ovSprites = overlayExists
    ? JSON.parse(readFileSync(join(OVERLAY, 'manifest.json'), 'utf8')) : {};
  let actOk = 0; const actBad = [];
  for (const [name, frames] of ACT_GRID) {
    const m = ovSprites[name] ?? mainSprites[name];
    if (!m) { actBad.push(`${name} is in neither pack`); continue; }
    const tag = (ovSprites[name] && m.source === 'mod') ? 'kaizo' : 'vanilla';
    const gt = SPRITES[tag].get(name);
    if (!gt) { actBad.push(`${name} is in no ${tag} sprite table`); continue; }
    if (Number(gt.frames) !== frames) { actBad.push(`${name}: the ${tag} data file says ${gt.frames} frames, this check expects ${frames}`); continue; }
    if (m.frames !== frames || (m.files ?? []).length !== frames) {
      actBad.push(`${name}: packed ${m.frames} (${(m.files ?? []).length} files), data file says ${frames}`);
      continue;
    }
    actOk += 1;
  }
  ok(actOk === ACT_GRID.length,
    `every sprite the ACT grid draws has the data file's own frame count (${actOk}/${ACT_GRID.length})`);
  for (const b of actBad) console.log(`       ${b}`);
}

console.log(failed ? `\ncheck-sprite-frames: ${failed} FAILED` : '\ncheck-sprite-frames: ok');
process.exit(failed ? 1 : 0);
