#!/usr/bin/env node
// THE OVERLAY WINS. SO IT HAD BETTER BE THE ART THAT SHOULD WIN.
//
//   node kaizo/tools/checks/check-overlay-shadow.mjs
//
// ── WHY A THIRD SPRITE CHECK ──────────────────────────────────────────────
//
// The kaizo page loads the vanilla pack and then merges the overlay ON TOP of
// it (`web/kaizo.js`, `loadKaizoOverlay`): the merge is `sprites.set(name, …)`
// into the renderer's existing Map, so for any name BOTH packs carry, the
// overlay's art and the overlay's metadata are what the kaizo page draws and
// the main pack's copy is dead. Fifty-eight names are in that state today.
//
// For the fifty-six the mod REPAINTED that is the entire point — the Knight's
// blue line art, his bullets, the tension bar. For the rest it is a hazard,
// and a specific one this project has already paid for once:
//
//   knight-sim 81811f9 repadded eleven frames that had shipped SHORT for two
//   weeks (spr_battlemsg 0-4 were 74x20 under a declared 83x20 — nine columns
//   missing from every battle message box). The fix landed in the main pack
//   and the vendor step carried it here byte for byte. But a vanilla-sourced
//   sprite the OVERLAY also carries would have kept its own pre-fix copy and
//   gone on shadowing the fix on the kaizo page, silently, because every
//   existing check reads one pack at a time:
//
//     check-sprites          — does every frame the manifest names EXIST?
//     check-sprite-frames    — is every frame the SIZE its own manifest says?
//     check-deployed-assets  — did the files survive the vendor step?
//
//   All three are green with a stale shadow in place. None of them ever
//   compares the two packs to each other, which is the only place the fault
//   lives. The overlay's packer even exempts its `WANT` names from the "the
//   main pack already has this, skip it" rule — deliberately, because kaizo
//   needs some of them with the mod's own metadata — so the duplicate is
//   created on purpose and nothing downstream re-examines it.
//
// So this check asks the one question the others structurally cannot: FOR
// EVERY NAME IN BOTH PACKS, is the overlay's copy there for a reason?
//
//   source: 'vanilla'  the overlay is carrying the SAME art the main pack has.
//                      Then it must be the same art: identical bytes in every
//                      frame and identical geometry. Anything else means one
//                      of the two has moved and the kaizo page is drawing the
//                      older one.
//
//   source: 'mod'      the overlay is carrying EnderCat8's repaint. Then it
//                      must say so (`replaced: true`) and at least one frame
//                      must actually differ from the main pack's — a
//                      "replacement" that is byte-identical is a duplicate
//                      with a second copy to drift from, not a repaint.
//
// PIXELS, NOT FILENAMES (CLAUDE.md, and the twelve short frames). Every
// comparison here reads the PNG bytes off disk. A filename check is what let
// the twelve ship, and a manifest-only check would miss a frame whose entry is
// right and whose file is stale.
//
// POSITIVE ASSERTIONS: a check that compares nothing passes vacuously, so this
// asserts it actually FOUND a plausible number of shared names, and it names
// the two vanilla shadows that exist today by name and requires each to still
// be present and still be identical. A named list is the one thing a
// regression cannot dodge.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const MAIN = join(repo, 'assets', 'sprites');
const OVERLAY = join(repo, 'kaizo', 'assets', 'sprites');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

// The overlay is publish-gated and absent from a fresh clone (CLAUDE.md,
// "Machine facts"). Say so in the words that name the fix, the way
// check-sprites does, rather than failing on a missing file.
for (const [label, dir] of [['vanilla pack', MAIN], ['kaizo overlay', OVERLAY]]) {
  if (!existsSync(join(dir, 'manifest.json'))) {
    console.log(`FAIL  the ${label} is not packed (${join(dir, 'manifest.json')} missing)`);
    console.log('       run: node kaizo/tools/pack-kaizo-sprites.mjs');
    process.exit(1);
  }
}
const main = JSON.parse(readFileSync(join(MAIN, 'manifest.json'), 'utf8'));
const overlay = JSON.parse(readFileSync(join(OVERLAY, 'manifest.json'), 'utf8'));

// Floors, not exact counts: both packs grow with every translation, and a
// number that has to be edited on every commit stops being read.
const MIN_MAIN_SPRITES = 200;
const MIN_OVERLAY_SPRITES = 100;
ok(Object.keys(main).length >= MIN_MAIN_SPRITES,
  `the vanilla pack was read (${Object.keys(main).length} sprites, want >= ${MIN_MAIN_SPRITES})`);
ok(Object.keys(overlay).length >= MIN_OVERLAY_SPRITES,
  `the kaizo overlay was read (${Object.keys(overlay).length} sprites, want >= ${MIN_OVERLAY_SPRITES})`);

const shared = Object.keys(overlay).filter((n) => Object.prototype.hasOwnProperty.call(main, n)).sort();
console.log(`  --  ${shared.length} names are in BOTH packs; on the kaizo page the overlay's copy wins`);
// If this ever hits zero the merge has stopped overriding anything and every
// assertion below would pass by having nothing to look at.
ok(shared.length > 0, 'the overlay actually shadows the vanilla pack (the comparison is not vacuous)');

/**
 * The vanilla-sourced shadows that exist today, by name.
 *
 * Both are in the packer's `WANT` list, which is what exempts them from the
 * "the main pack already carries this, skip it" rule — so they are duplicates
 * by design and are exactly the entries that can go stale.
 *
 *   spr_dodgeheart_smaller_2px          the soul the mod shrinks
 *   spr_rk_quickslash_marker_gradient   the quickslash cut's real 6px mask
 *
 * A name leaving this list is fine (the packer stopped duplicating it); a name
 * in it that is no longer identical is the regression.
 */
const KNOWN_VANILLA_SHADOWS = [
  'spr_dodgeheart_smaller_2px',
  'spr_rk_quickslash_marker_gradient',
];

/** Every byte of a frame, or null when the file is not there. */
const frameBytes = (dir, file) => (existsSync(join(dir, file)) ? readFileSync(join(dir, file)) : null);

/** The fields the renderer positions and animates against. */
const GEOMETRY = ['w', 'h', 'ox', 'oy', 'frames', 'sepmasks', 'playback', 'playbacktype'];

const vanillaShadows = [];
const modShadows = [];
const drifted = [];      // vanilla-sourced and NOT identical — the fault
const unflagged = [];    // mod-sourced without `replaced: true`
const pointless = [];    // mod-sourced but byte-identical to the vanilla pack
const absent = [];       // a frame file the manifest names is not on disk
let framesCompared = 0;

for (const name of shared) {
  const o = overlay[name];
  const m = main[name];
  const of = o.files ?? [];
  const mf = m.files ?? [];

  // Compare frame for frame, in the order each manifest lists them — that is
  // the order the renderer indexes with image_index.
  let anyDiffer = of.length !== mf.length;
  const differing = [];
  for (let i = 0; i < Math.min(of.length, mf.length); i += 1) {
    const a = frameBytes(OVERLAY, of[i]);
    const b = frameBytes(MAIN, mf[i]);
    if (a === null) { absent.push(`overlay/${of[i]}`); continue; }
    if (b === null) { absent.push(`vanilla/${mf[i]}`); continue; }
    framesCompared += 1;
    if (!a.equals(b)) { anyDiffer = true; differing.push(of[i]); }
  }
  const geomDiff = GEOMETRY.filter((k) => o[k] !== m[k]);

  if (o.source === 'mod') {
    modShadows.push(name);
    if (!o.replaced && Object.prototype.hasOwnProperty.call(main, name)) {
      // `replaced` is what the publish gate reads to tell a repaint of a
      // vanilla sprite from art that is wholly the mod's. A mod-sourced entry
      // that shares a name with the vanilla pack IS a repaint by definition.
      unflagged.push(name);
    }
    if (!anyDiffer) pointless.push(name);
    continue;
  }

  vanillaShadows.push(name);
  if (anyDiffer || geomDiff.length) {
    drifted.push(`${name}: `
      + (differing.length ? `${differing.length} frame(s) differ [${differing.slice(0, 3).join(', ')}] ` : '')
      + (of.length !== mf.length ? `file counts ${of.length} vs ${mf.length} ` : '')
      + (geomDiff.length ? `meta [${geomDiff.map((k) => `${k} ${m[k]}/${o[k]}`).join(', ')}]` : ''));
  }
}

console.log(`  --  ${vanillaShadows.length} vanilla-sourced · ${modShadows.length} mod-sourced · `
  + `${framesCompared} frames byte-compared`);

ok(framesCompared > 0, `frames were actually read off disk and compared (${framesCompared})`);
ok(absent.length === 0,
  `every frame both manifests name is on disk, so nothing was skipped silently (${absent.length} missing)`);
for (const a of absent.slice(0, 10)) console.log(`       ${a}`);

// ── THE FAULT THIS FILE EXISTS FOR ────────────────────────────────────────
ok(drifted.length === 0,
  'every VANILLA-sourced overlay entry is byte- and metadata-identical to the vanilla pack, '
  + `so the overlay cannot shadow a fix that landed in the main pack (${drifted.length} drifted)`);
for (const d of drifted) console.log(`       ${d}`);

ok(unflagged.length === 0,
  `every MOD-sourced entry that shares a vanilla name is flagged replaced: true (${unflagged.length} unflagged)`);
for (const u of unflagged) console.log(`       ${u}`);

ok(pointless.length === 0,
  'every entry the overlay claims the mod REPLACED really does differ from the vanilla pack '
  + `(${pointless.length} are byte-identical duplicates)`);
for (const p of pointless) console.log(`       ${p}`);

// ── the named list a regression cannot dodge ──────────────────────────────
{
  const stillHere = KNOWN_VANILLA_SHADOWS.filter((n) => vanillaShadows.includes(n));
  const gone = KNOWN_VANILLA_SHADOWS.filter((n) => !Object.prototype.hasOwnProperty.call(overlay, n));
  ok(gone.length === 0,
    `the two known vanilla shadows are still in the overlay (${stillHere.length}/${KNOWN_VANILLA_SHADOWS.length})`);
  for (const g of gone) console.log(`       ${g} is no longer packed`);
  for (const n of stillHere) {
    const bad = drifted.some((d) => d.startsWith(`${n}:`));
    ok(!bad, `  ${n} is identical in both packs`);
  }
}

console.log(failed ? `\ncheck-overlay-shadow: ${failed} FAILED` : '\ncheck-overlay-shadow: ok');
process.exit(failed ? 1 : 0);
