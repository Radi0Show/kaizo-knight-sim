#!/usr/bin/env node
// Build kaizo/assets/sprites/ — the KAIZO SPRITE OVERLAY.
//
//   node kaizo/tools/pack-kaizo-sprites.mjs [vanillaDump] [kaizoDump] [vanillaMeta] [kaizoMeta]
//   defaults: D:/tmp/kzpack_van  D:/tmp/kzpack_kz
//             D:/tmp/sprite_meta_vanilla.json  D:/tmp/sprite_meta_kaizo.json
//
// WHY AN OVERLAY RATHER THAN ADDING TO assets/sprites/.
//
// The main pack is the VANILLA fight's art and the main page is verified
// against it. The kaizo lane needs art the vanilla fight never references —
// some of it vanilla sprites the pack filtered out, and some of it
// EnderCat8's own new art, which the V-C publish gate (kaizo/HANDOFF.md §5-C)
// says must not be published without permission. Keeping it in a separate
// directory means:
//
//   * the main pack cannot be disturbed by kaizo work at all, and
//   * `.gitignore`'s global `*.png` block (whose only carve-out is
//     `!assets/sprites/*.png`) already keeps every file here OUT of commits,
//     which is exactly the behaviour the gate wants.
//
// ── THE REPLACED SPRITES, and why this tool compares two dumps ────────────
//
// The mod's whole visual identity is REPLACED ART, not code. It overwrites 57
// sprites IN PLACE — the Knight's entire set (idle, hurt, front, fly, block,
// attack, roar, sword, arm), his bullets (crescents, diamonds, teeth, stars,
// the flow sheets) and the tension bar — keeping every NAME identical. The
// Knight's own idle averages RGB (93,93,93) in vanilla and (211,221,255) in
// the mod: grey line art becomes blue.
//
// NOTHING IN THE GML SHOWS THIS. A code diff of both dumps is silent, the
// sprite NAME the Create assigns is unchanged, and the recolour is invisible
// to every check that reads code. It was found by extracting the same 254
// names from both data files and byte-comparing the PNGs, which is exactly
// what this tool now does on every run — so the set can never go stale as the
// mod updates, and nobody has to maintain a hand-list of 57 names.
//
// Inputs come from the PRIVATE research repo, neither ever committed:
//   SPR_LIST=<names.txt> UndertaleModCli load <data.win> \
//       -s tools/patches/extract_sprite.csx -o <scratch>   -> PNGs
//   UndertaleModCli load <data.win> -s tools/patches/sprite_meta.csx -o <scratch>
//       -> sprite_meta.json (origins, bboxes, and PRECISE MASK ROWS)
//
// ORIGINS ARE THE POINT. GameMaker draws every sprite relative to its origin;
// art packed without one sits offset from the physics.

import {
  readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'assets', 'sprites');
const MAIN_PACK = join(here, '..', '..', 'assets', 'sprites');

const vanDump = process.argv[2] ?? 'D:/tmp/kzpack_van';
const kzDump = process.argv[3] ?? 'D:/tmp/kzpack_kz';
const vanillaMeta = JSON.parse(readFileSync(process.argv[4] ?? 'D:/tmp/sprite_meta_vanilla.json', 'utf8'));
const kaizoMeta = JSON.parse(readFileSync(process.argv[5] ?? 'D:/tmp/sprite_meta_kaizo.json', 'utf8'));

/**
 * Sprites the overlay carries REGARDLESS of whether the mod changed them —
 * vanilla art the main pack filtered out because the vanilla FIGHT never
 * references it, but kaizo code does.
 */
const WANT = [
  // the mod shrinks the soul's mask. PRECISE heart, bbox [4,4,15,15] — NOT
  // the 20x20 AxisAlignedRect [2,2,17,17] of the similarly-named
  // `spr_dodgeheart_smaller_2px` (no `_mask`), which two modules had guessed
  // at differently. The pair follows vanilla's own spr_dodgeheart /
  // spr_dodgeheartmask convention: art and mask are separate sprites.
  'spr_dodgeheart_smaller_2px_mask',
  'spr_dodgeheart_smaller_2px',
  // The quickslash cut's REAL mask: a 6px band (bbox [0,20,249,25]) where
  // the plain marker is one row at y=22. At the mod's image_yscale 0.4 that
  // is 2.4px against 0.4px, and an axis-aligned mask under 1px never
  // registers at all (CLAUDE.md's contact study) — so the difference is
  // "the cut can hit you" versus "it cannot".
  'spr_rk_quickslash_marker_gradient',
  'spr_knight_starchild',   // rotating-slash's B-Side ring bullets
  'spr_kris_fallen_dark',
  'spr_kris_fell',          // Weird Route: Kris down
  'spr_lightfairy',         // swordtunnelanim's vertical-mode burst
  'spr_whitepx',
  // Noelle's CHARBOX portrait and name plate. The vanilla fight never fields
  // her, so the main pack has neither — and without them the Weird Route's
  // HP row drew her health under Susie's face.
  'spr_headnoelle',
  'spr_bnamenoelle',
  // THE MOD'S DRAW EVENTS (kaizo/render/draw) need art the vanilla fight never
  // draws. obj_spell_snowgrave Draw_0 (kaizo dump) hands scr_dark_marker
  // spr_noelleb_spell (:15), swaps to spr_noelleb_spell_special (:43) and
  // back (:96), ends on spr_noelleb_defeat (:108), makes Berdly's marker from
  // spr_berdlyb_idle_shocked (:52) and its dust from spr_shine (:90). All
  // five are pixel- and metadata-identical in the two data files (measured:
  // kaizo-mod/sprites/diff_sprites.csv), so they pack as vanilla-sourced.
  //
  // Two names the same ports asked for are NOT sprite assets and cannot be
  // extracted: `spr_custom_box` is an INSTANCE VARIABLE of obj_growtangle
  // (Create_0:17 `spr_custom_box = sprite_index`, Step_0:23 rebuilt with
  // sprite_create_from_surface from spr_battlebg_stretch drawn to a surface),
  // and `spr_berdly_ice` (obj_spell_snowgrave Draw_0:160, the Berdly
  // `altpath == 1` branch) is a sprite in NEITHER chapter-3 data file.
  'spr_noelleb_spell',
  'spr_noelleb_spell_special',
  'spr_noelleb_defeat',
  'spr_berdlyb_idle_shocked',
  'spr_shine',
  // THE SNOWGRAVE FLAKE AND ITS BACKDROP (ledger G-43, 2026-09-12). The mod
  // REBUILT obj_spell_snowgrave_snowflake's Draw — the `siner != 0` side-copy
  // gate scaled by `flakescale`, and the `repeat (2) draw_self()` triple-blit
  // for a gathered flake — and kaizo/render/draw/snowgrave.js is that
  // translation. It had nothing to paint: neither name is in the main pack
  // (the vanilla Knight fight never casts SnowGrave, so the pack filtered
  // them out) and neither was in this overlay's WANT list, so the drawer
  // bailed and only the white-to-blue wash reached the screen.
  //
  // BOTH ARE VANILLA ART, not the mod's: extracted from both data files and
  // byte-compared here (kaizo/tools/checks/check-snowflake-art.mjs asserts
  // `source: 'vanilla'` and no `replaced` flag, which is what keeps the
  // publish gate honest about them). That makes this a VENDORING gap the
  // packer closes, not an art delta.
  //
  //   spr_icespell_snowflake  46x46, origin (23,23), 1 frame, bbox [2,2,42,44]
  //   bg_snowfall             64x64, origin (0,0),   1 frame — a SPRITE in
  //                           this build despite the `bg_` name, which is why
  //                           it comes through the sprite extractor at all.
  'spr_icespell_snowflake',
  'bg_snowfall',
  // THE B-SIDE EPILOGUE'S OVERWORLD ART (2026-09-12). `kaizo/scenes/
  // kaizo-ending.js`'s SPR table names 36 sprites and EIGHTEEN of them
  // resolved in neither pack: this WANT list was built for the FIGHT, and the
  // epilogue is a CUTSCENE — Kris/Susie/Ralsei overworld walk cycles, the
  // shocked and unhappy poses, the Knight's overworld attack and turn-away,
  // and the one-pixel white stamp the flash uses.
  //
  // The gap was invisible for a reason worth recording: `check-sprites.mjs:61`
  // scans source with /'(spr_[a-z0-9_]+)'/g — SINGLE QUOTES — and that SPR
  // table was written in BACKTICKS, so the enforced gate could not see a
  // single one of the names and stayed green. Packing them is what lets the
  // table go back to plain single-quoted literals (it has) and puts the whole
  // set back under the scanner.
  //
  // PROVENANCE, measured by extracting all 18 from BOTH data files and
  // byte-comparing every frame (65 frames each side; the same answer the
  // whole-file hash in kaizo-mod/sprites/frames_{vanilla,kaizo}.csv gives):
  // SIXTEEN are byte-identical and pack as `source: 'vanilla'`, so they are a
  // vendoring gap and not an art delta. TWO are the mod's own repaint and pack
  // as `source: 'mod', replaced: true` — spr_roaringknight_attack_overworld
  // (6/6 frames differ) and spr_roaringknight_faceaway_turning (10/10). That
  // is the same blue recolour the fight sprites carry, applied to the Knight's
  // OVERWORLD set, and it is publish-gated by kaizo/assets/.gitignore like the
  // rest of EnderCat8's art. `kaizo/tools/checks/check-ending-sprite-pack.mjs`
  // asserts that split by name, in both directions.
  'spr_krisd_dark',
  'spr_krisl_dark',
  'spr_pixel_white',
  'spr_ralsei_down_surprised2',
  'spr_ralsei_shocked_right',
  'spr_ralsei_shocked_standing_right',
  'spr_ralsei_surprised_left_walk',
  'spr_ralsei_surprised_right_walk',
  'spr_ralsei_walk_down_unhappy',
  'spr_ralsei_walk_left_unhappy',
  'spr_ralsei_walk_right_sad',
  'spr_ralsei_walk_up_sad',
  'spr_roaringknight_attack_overworld',
  'spr_roaringknight_faceaway_turning',
  'spr_susie_dw_jump_ball_fixed',
  'spr_susie_hurt',
  'spr_susie_walk_down_dw_unhappy',
  'spr_susie_walk_left_dw_unhappy',
  // THE ACT GRID'S CROSSED-OUT PARTNER HEADS (2026-09-12). render/menu.js:231
  // does `sprites.get('spr_tenna_x')` for the X-SLASH row's portrait strip and
  // draws the sprite TWICE per partner head, frame 1, at 6 and 4 degrees —
  // the double-stamp that makes the mark read as scratched on. The lookup was
  // resolving to nothing: `spr_tenna_x` is in BOTH data files' sprite metadata
  // and in both extraction dumps, but the WANT list was built for the FIGHT
  // and the main pack filtered it out (the vanilla Knight fight never opens an
  // ACT grid with a partner strip). The file's own comment says it "is NOT in
  // any pack this renderer can reach yet" — this is that gap closed, not a new
  // dependency: the call site is unchanged and still skips when absent.
  //
  // What the player saw without it: the partner heads greyed correctly, but
  // the crosses that say WHY the row refuses the confirm never drew.
  //
  // 32x32, origin (16,16), 2 frames, byte-identical in both dumps, so it packs
  // `source: 'vanilla'` with no `replaced` flag.
  'spr_tenna_x',
  // THE B-SIDE SUNBOLT ORB AND ITS PARTICLES (ledger G-1, 2026-09-12).
  // `obj_knight_lightorb` is the Weird Route's sunbolt attack — the organism
  // the vertical box tear creates — and NOT ONE of the four sprites it and its
  // particles draw was in either pack, so `kaizo/render/draw/lightorb.js`
  // painted a canvas RING where the mod paints a 50px disc and the three
  // particle objects had no art to draw at all. A player on the Weird Route
  // saw a placeholder for the whole attack.
  //
  // The names and the objects that carry them, from the mod's own object
  // table (knight-research/kaizo-mod/sprites/objects_kaizo.csv):
  //
  //   obj_knight_lightorb   spr_sneo_bigcircle                  50x50 (25,25) 1f
  //   obj_knight_spark      spr_knight_spark                    17x18 ( 8, 9) 4f
  //   obj_knight_triangle   spr_knight_triangle                 16x16 ( 0, 8) 1f
  //   obj_knight_ring       spr_roaringknight_sword_break_vfx2  64x64 (32,32) 2f
  //
  // (obj_rouxls_power_up_orb, the fourth particle, has an EMPTY sprite column
  // in that table and draws itself from primitives — there is no fifth name to
  // pack. The module header used to say five; it says four now.)
  //
  // PROVENANCE — VANILLA ART, every frame, measured twice. Extracted from the
  // mod's data file (a COPY: kaizo-mod/oracle/data-kaizo-pristine.win) and
  // from a COPY of the player's own vanilla data.win, never the Steam install,
  // with UndertaleModCli + kaizo-mod/tools/patches/sprite_hash.csx; `cmp` says
  // all EIGHT frames are byte-identical, and the whole-file pixel hashes in
  // kaizo-mod/sprites/frames_{kaizo,vanilla}.csv agree sprite for sprite
  // (spr_sneo_bigcircle 602f0262…, spr_knight_triangle 977dc54a…, and both
  // frames of the vfx2 ring and all four of the spark). So the packer
  // classifies them `source: 'vanilla'` with no `replaced` flag and the V-C
  // publish gate does not cover them — a VENDORING gap, not an art delta.
  // kaizo/tools/checks/check-lightorb.mjs L12 asserts that split by name.
  'spr_sneo_bigcircle',
  'spr_knight_spark',
  'spr_knight_triangle',
  'spr_roaringknight_sword_break_vfx2',
];

/** Every frame file for `name` in a dump dir, in frame order. */
function framesIn(dir, name, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const f = `${name}_${i}.png`;
    if (existsSync(join(dir, f))) out.push(f);
  }
  return out;
}

/** Do the two dumps hold byte-identical art for this sprite? */
function sameArt(name, count) {
  const a = framesIn(vanDump, name, count);
  const b = framesIn(kzDump, name, count);
  if (a.length !== b.length || a.length === 0) return false;
  for (const f of a) {
    if (!existsSync(join(kzDump, f))) return false;
    if (!readFileSync(join(vanDump, f)).equals(readFileSync(join(kzDump, f)))) return false;
  }
  return true;
}

const mainManifest = existsSync(join(MAIN_PACK, 'manifest.json'))
  ? JSON.parse(readFileSync(join(MAIN_PACK, 'manifest.json'), 'utf8'))
  : {};

// Everything we might carry: the explicit WANT list, every sprite the MAIN
// PACK holds (to detect in-place replacement), and every Noelle sprite in the
// dump (the Weird Route roster cannot draw without them).
const noelle = [...new Set(readdirSync(kzDump)
  .map((f) => f.replace(/_\d+\.png$/, ''))
  .filter((n) => n.startsWith('spr_noelle')))];

// EVERY SPRITE THE MOD ADDED that we actually extracted. Derived the same way
// as the replacements — present in the kaizo build, absent from vanilla —
// rather than hand-listed, so a mod update that adds art cannot leave a name
// behind. Scoped to what is in the dump directory, because the full kaizo
// build has ~5000 sprites and the overlay only wants the ones this project
// asked to extract.
const modOnlyInDump = [...new Set(readdirSync(kzDump)
  .map((f) => f.replace(/_\d+\.png$/, '')))]
  .filter((n) => !Object.prototype.hasOwnProperty.call(vanillaMeta, n)
    && Object.prototype.hasOwnProperty.call(kaizoMeta, n));

// EVERY IN-PLACE REPAINT WE EXTRACTED, whether or not the main pack carries
// the name. The replacement test below used to run only over main-pack names,
// so a vanilla sprite the vanilla FIGHT never draws — and the pack therefore
// filtered out — could be repainted by the mod and never reach the overlay.
// `spr_attack_shard` is that case: obj_knight_enemy Step_0:1008/1028 (kaizo
// dump, absent from vanilla) puts it on the attack VFX when Kris holds
// weapon 26 (the WHITE SHARD), the mod repaints all three drawn frames, and
// the main pack has no entry to compare against. Found by the whole-file
// pixel hash (knight-research/kaizo-mod/tools/patches/sprite_hash.csx +
// tools/sprite-hash-diff.mjs), which is also where the 84-sprite replaced
// set now comes from; this dump-dir test is kept as the packer's own check.
const replacedInDump = [...new Set(readdirSync(kzDump)
  .map((f) => f.replace(/_\d+\.png$/, '')))]
  .filter((n) => Object.prototype.hasOwnProperty.call(vanillaMeta, n)
    && Object.prototype.hasOwnProperty.call(kaizoMeta, n)
    && !sameArt(n, Math.max(vanillaMeta[n].frames, kaizoMeta[n].frames)));

const candidates = [...new Set([
  ...WANT, ...Object.keys(mainManifest), ...noelle, ...modOnlyInDump, ...replacedInDump,
])].sort();

mkdirSync(OUT, { recursive: true });

const manifest = {};
const masks = {};
const missing = [];
const replaced = [];
const absentFromMod = [];
let copied = 0;

for (const name of candidates) {
  const inVanillaMeta = Object.prototype.hasOwnProperty.call(vanillaMeta, name);
  if (!inVanillaMeta && !Object.prototype.hasOwnProperty.call(kaizoMeta, name)) {
    missing.push(`${name}: no metadata in either dump`);
    continue;
  }

  // ABSENT FROM THE MOD'S BUILD ENTIRELY — not a replacement.
  //
  // The mod is built on chapter 3 v0.091 and the sim's reference is v0.105,
  // so a sprite Toby ADDED in between exists on the vanilla side and simply
  // is not there on the mod's. `spr_dodgeheart_smallmask` is one. Reading
  // "no kaizo frames" as "the mod replaced it" would file a base-version gap
  // as mod art and then fail trying to copy frames that do not exist.
  const inKaizoMeta = Object.prototype.hasOwnProperty.call(kaizoMeta, name);
  if (inVanillaMeta && !inKaizoMeta) {
    absentFromMod.push(name);
    continue; // the main pack already carries it; the kaizo lane cannot use it
  }

  // WHERE DOES THIS SPRITE'S ART COME FROM?
  //   not in vanilla at all      -> mod-only art
  //   in both, bytes differ      -> the mod REPLACED it in place
  //   in both, bytes identical   -> vanilla art
  const modOnly = !inVanillaMeta;
  const identical = !modOnly
    && sameArt(name, Math.max(vanillaMeta[name].frames, kaizoMeta[name].frames));
  const isReplaced = !modOnly && !identical;
  const source = (modOnly || isReplaced) ? 'mod' : 'vanilla';
  const from = source === 'mod' ? kzDump : vanDump;
  if (isReplaced) replaced.push(name);

  // METADATA FOLLOWS THE ART. A repaint is not always the same size: the mod's
  // spr_roaringknight_slash_tunnel is 99x32 where vanilla's is 99x21 (bbox
  // [4,14,94,16] against [4,6,94,14], a different precise mask), and its
  // spr_knight_diamondbullet_l keeps 99x32 but widens the mask's margins
  // (ml 5->3, mr 93->94). Both measured from the two data files
  // (knight-research/kaizo-mod/sprites/sprites_{kaizo,vanilla}.csv). This
  // used to take the VANILLA metadata for any name vanilla knew, so the
  // overlay shipped the mod's 32px tunnel slash under a 21px entry and
  // vanilla mask rows under mod pixels. The origin, bbox, frame count,
  // playback and mask rows of a mod-sourced entry now come from the mod's
  // own file; a vanilla-sourced entry is unchanged.
  //
  // NOTE for masks.js: nothing in kaizo/ imports either sprite's mask yet
  // (kaizoMask() is called only for spr_dodgeheart_smaller_2px_mask and
  // spr_rk_quickslash_marker_gradient), and the sim collides with
  // sim/data/masks.json's vanilla rows for both. Moving the sim onto the
  // mod's masks is a collision change and a separate decision.
  const meta = source === 'mod' ? kaizoMeta[name] : vanillaMeta[name];

  // A vanilla sprite the MAIN PACK already carries unchanged does not belong
  // in the overlay — it would be a duplicate that can silently drift.
  if (source === 'vanilla' && mainManifest[name] && !WANT.includes(name)) continue;

  const files = [];
  for (let i = 0; i < meta.frames; i++) {
    const png = `${name}_${i}.png`;
    if (!existsSync(join(from, png))) { missing.push(`${name}: frame ${i} missing from ${from}`); continue; }
    copyFileSync(join(from, png), join(OUT, png));
    files.push(png);
    copied += 1;
  }
  if (files.length === 0) continue;

  manifest[name] = {
    w: meta.w, h: meta.h, ox: meta.ox, oy: meta.oy,
    frames: files.length, bbox: meta.bbox, sepmasks: meta.sepmasks,
    playback: meta.playback, playbacktype: meta.playbacktype,
    files,
    // PROVENANCE, carried in the data rather than a comment: this is what the
    // publish gate is checked against. `replaced` distinguishes the mod's
    // repaint of a vanilla sprite from art that is wholly its own.
    source,
    ...(isReplaced ? { replaced: true } : {}),
  };

  if (Array.isArray(meta.rows) && meta.rows.length) {
    masks[name] = {
      name, w: meta.w, h: meta.h,
      originX: meta.ox, originY: meta.oy,
      bbox: meta.bbox, rows: meta.rows,
    };
  }
}

writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
writeFileSync(join(OUT, 'masks.json'), `${JSON.stringify(masks, null, 1)}\n`);

// ...and the masks as an IMPORTABLE MODULE. kaizo/ runs in the browser like
// sim/ does, so it cannot read JSON at runtime — sim/data/masks.js exists for
// exactly this reason and this mirrors it. Emitting both from one tool is what
// keeps a module's collision geometry and the packed art from drifting apart:
// without it a translator hand-builds a mask from spec prose, which already
// happened twice with two different answers.
const maskModule = join(here, '..', 'data', 'masks.js');
mkdirSync(dirname(maskModule), { recursive: true });
writeFileSync(maskModule,
  '// GENERATED by kaizo/tools/pack-kaizo-sprites.mjs — do not edit by hand.\n'
  + '//\n'
  + '// Precise collision masks extracted from the real data files, in the same\n'
  + '// shape as sim/data/masks.js. Import these instead of hand-building a mask\n'
  + '// from a spec: the spec describes the geometry, this IS the geometry.\n\n'
  + `export const KAIZO_MASK_DATA = ${JSON.stringify(masks)};\n\n`
  + '/** One mask by sprite name, in the engine\'s {w,h,originX,originY,bbox,rows} shape. */\n'
  + 'export function kaizoMask(name) {\n'
  + '  const m = KAIZO_MASK_DATA[name];\n'
  + '  if (!m) throw new Error(`kaizoMask: no extracted mask for ${name} — `\n'
  + '    + \'add it to WANT in kaizo/tools/pack-kaizo-sprites.mjs and repack\');\n'
  + '  return m;\n'
  + '}\n');

const vanillaCount = Object.values(manifest).filter((e) => e.source === 'vanilla').length;
const modCount = Object.values(manifest).length - vanillaCount;
console.log(`kaizo sprite overlay: ${Object.keys(manifest).length} sprites, ${copied} frames`);
console.log(`  ${vanillaCount} vanilla-sourced · ${modCount} mod-sourced (PUBLISH-GATED)`);
console.log(`  ${replaced.length} of those are sprites the mod REPLACED IN PLACE`);
if (absentFromMod.length) {
  console.log(`  ${absentFromMod.length} vanilla sprite(s) absent from the mod's older base, left to the main pack:`);
  for (const n of absentFromMod) console.log(`      ${n}`);
}
console.log(`  ${Object.keys(masks).length} precise masks -> masks.json`);
if (missing.length) {
  console.log(`\n${missing.length} MISSING:`);
  for (const m of missing.slice(0, 20)) console.log(`  ${m}`);
  process.exit(1);
}
