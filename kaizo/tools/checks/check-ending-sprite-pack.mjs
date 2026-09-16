#!/usr/bin/env node
// THE EPILOGUE'S 36 SPRITES ARE PACKED, AND THE ENFORCED GATE CAN SEE THEM.
//
//   node kaizo/tools/checks/check-ending-sprite-pack.mjs
//
// ── THE DEFECT THIS CLOSES (2026-09-12) ───────────────────────────────────
//
// `kaizo/tools/checks/check-sprites.mjs` is the enforced gate that says every
// sprite named anywhere in kaizo/ resolves in a pack — the one check that can
// see "the art is missing", because at runtime a missing sprite is invisible
// (the renderer silently falls back to drawing the collision mask). It finds
// the names by scanning source with
//
//     /'(spr_[a-z0-9_]+)'/g          <- SINGLE QUOTES
//
// over kaizo/attacks, kaizo/scenes and kaizo/party. `kaizo/scenes/
// kaizo-ending.js`'s SPR table wrote all 36 of its names in BACKTICKS, so the
// scanner could not see one of them and the gate was green over a module whose
// art was HALF MISSING: eighteen of the 36 resolved in neither pack. The
// overlay's WANT list was built for the FIGHT; the epilogue is an overworld
// CUTSCENE and wanted walk cycles, shocked poses, and the Knight's overworld
// set, which nothing had ever asked the packer for.
//
// A gate that is green because of a quoting style is not a gate. Both halves
// were fixed: the eighteen are in `kaizo/tools/pack-kaizo-sprites.mjs`'s WANT
// list and in the overlay, and the SPR table is back to plain single-quoted
// literals. `check-sprites` now scans 128 distinct names (was 92) and covers
// this module for real — PROVEN, not assumed: removing spr_susie_hurt from the
// overlay manifest reddens it and names kaizo-ending.js as the referrer.
//
// ── WHAT THIS PINS, that check-sprites structurally cannot ────────────────
//
//   E1  the SPR table is SINGLE-QUOTED — the scanner's own regex, run here
//       over kaizo-ending.js, finds all 36 of the table's values. This is the
//       regression guard for the actual defect: a backtick reintroduced here
//       removes a name from an enforced gate SILENTLY, and check-sprites by
//       construction cannot notice a name it cannot see.
//   E2  all 36 resolve (the same claim check-sprites makes, restated against
//       the table as DATA so it holds even if the scan is ever narrowed)
//   E3  the eighteen that used to resolve nowhere are in the OVERLAY, at the
//       dumps' own dimensions, origins and frame counts
//   E4  PROVENANCE, the split measured by extracting all 18 from BOTH data
//       files (on COPIES — never the Steam install) and byte-comparing all 65
//       frames a side: SIXTEEN are byte-identical and pack `source: 'vanilla'`
//       with no `replaced` flag, so they are a vendoring gap, not art the mod
//       made. TWO are the mod's own repaint of the Knight's OVERWORLD set and
//       pack `source: 'mod', replaced: true` — spr_roaringknight_attack_over-
//       world (6/6 frames differ) and spr_roaringknight_faceaway_turning
//       (10/10), the same blue recolour his fight sprites carry. Asserted in
//       BOTH directions, the way check-snowflake-art asserts its two. This
//       mattered doubly while the overlay was publish-gated; with the gate gone
//       (2026-09-16) the split is pure provenance, and it is still worth
//       asserting — it is the only record of which art is whose.
//   E5  every frame file is on disk and the PNG's real pixel size matches the
//       metadata (extracted WITH padding, so the origin lands where the
//       physics expects it)
//   E6  the two mod-sourced sprites REACH A CLONE — not ignored by git, asked
//       of git itself rather than of the .gitignore text. This ran the other
//       way until 2026-09-16, when the publish gate was removed; the failure
//       it guards now is the art silently not shipping, which looks like the
//       Knight rendering vanilla grey on everyone's screen but the packer's.
//
// SABOTAGE-TESTED 2026-09-12, three ways, each confirmed exit 1 and restored
// to exit 0: a backtick put back on one SPR value (E1 alone); spr_susie_hurt
// deleted from the overlay manifest (E2/E3/E5); and the `replaced` flag
// stripped from spr_roaringknight_faceaway_turning (E4).

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPR, ENDING_SPRITES } from '../../scenes/kaizo-ending.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const OVERLAY = join(REPO, 'kaizo', 'assets', 'sprites');
const MAIN_PACK = join(REPO, 'assets', 'sprites');
const ENDING_SRC = join(REPO, 'kaizo', 'scenes', 'kaizo-ending.js');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

/**
 * THE EIGHTEEN, with the metadata both data files report and the provenance
 * the byte comparison measured. Typed out here rather than read back from the
 * manifest, so the manifest has something to be wrong against — a check that
 * reads its expectations out of the artefact it is checking asserts nothing.
 */
const PACKED = {
  spr_krisd_dark: { w: 19, h: 38, ox: 0, oy: 0, frames: 4, source: 'vanilla' },
  spr_krisl_dark: { w: 19, h: 38, ox: 0, oy: 0, frames: 4, source: 'vanilla' },
  spr_pixel_white: { w: 4, h: 4, ox: 0, oy: 0, frames: 1, source: 'vanilla' },
  spr_ralsei_down_surprised2: { w: 21, h: 41, ox: 0, oy: -3, frames: 1, source: 'vanilla' },
  spr_ralsei_shocked_right: { w: 33, h: 36, ox: 14, oy: -6, frames: 1, source: 'vanilla' },
  spr_ralsei_shocked_standing_right: { w: 21, h: 40, ox: 0, oy: -3, frames: 1, source: 'vanilla' },
  spr_ralsei_surprised_left_walk: { w: 19, h: 40, ox: 0, oy: -3, frames: 4, source: 'vanilla' },
  spr_ralsei_surprised_right_walk: { w: 19, h: 40, ox: 0, oy: -3, frames: 4, source: 'vanilla' },
  spr_ralsei_walk_down_unhappy: { w: 21, h: 41, ox: 0, oy: -3, frames: 4, source: 'vanilla' },
  spr_ralsei_walk_left_unhappy: { w: 19, h: 40, ox: 0, oy: -3, frames: 4, source: 'vanilla' },
  spr_ralsei_walk_right_sad: { w: 21, h: 41, ox: 1, oy: -3, frames: 4, source: 'vanilla' },
  spr_ralsei_walk_up_sad: { w: 21, h: 41, ox: 0, oy: -3, frames: 4, source: 'vanilla' },
  spr_roaringknight_attack_overworld: {
    w: 117, h: 115, ox: 7, oy: 23, frames: 6, source: 'mod', replaced: true,
  },
  spr_roaringknight_faceaway_turning: {
    w: 69, h: 82, ox: -19, oy: -4, frames: 10, source: 'mod', replaced: true,
  },
  spr_susie_dw_jump_ball_fixed: { w: 29, h: 30, ox: 1, oy: -9, frames: 4, source: 'vanilla' },
  spr_susie_hurt: { w: 54, h: 45, ox: 20, oy: 0, frames: 1, source: 'vanilla' },
  spr_susie_walk_down_dw_unhappy: { w: 26, h: 43, ox: 0, oy: -2, frames: 4, source: 'vanilla' },
  spr_susie_walk_left_dw_unhappy: { w: 25, h: 43, ox: 0, oy: -2, frames: 4, source: 'vanilla' },
};

// ═══ E1: THE SCANNER CAN SEE THE TABLE ═════════════════════════════════════
// The literal regex from check-sprites.mjs:61. If that line ever changes this
// copy goes stale — but stale in the safe direction: this asserts the names
// are single-quoted, which is what the scanner needs and what the defect broke.
console.log('E1 — the enforced scanner sees every name in the SPR table');
{
  const src = readFileSync(ENDING_SRC, 'utf8');
  const seen = new Set([...src.matchAll(/'(spr_[a-z0-9_]+)'/g)].map((m) => m[1]));
  const invisible = ENDING_SPRITES.filter((n) => !seen.has(n));
  ok(invisible.length === 0,
    `all ${ENDING_SPRITES.length} SPR values appear as SINGLE-QUOTED literals in `
    + `kaizo-ending.js${invisible.length ? ` — INVISIBLE TO check-sprites: ${invisible.join(', ')}` : ''}`);

  // ...and nothing in the table has slipped back to a backtick. Stated
  // separately because it is the failure mode with a name: a backticked entry
  // is not an error anywhere else in this repo.
  const backticked = [...src.matchAll(/^\s{2}[A-Za-z0-9]+: `(spr_[a-z0-9_]+)`,$/gm)]
    .map((m) => m[1]);
  ok(backticked.length === 0,
    `no SPR entry is written in BACKTICKS${backticked.length
      ? ` — ${backticked.join(', ')} would vanish from the enforced gate` : ''}`);

  ok(new Set(ENDING_SPRITES).size === ENDING_SPRITES.length,
    `the table's ${ENDING_SPRITES.length} names are distinct`);
}

// ═══ the packs ═════════════════════════════════════════════════════════════
const overlayPath = join(OVERLAY, 'manifest.json');
if (!existsSync(overlayPath)) {
  // A fresh clone has no overlay (CLAUDE.md, "Machine facts") — say so and
  // stop, rather than reporting an unbuilt pack as a regression. E1 above has
  // already run, and it is the half that needs no art.
  console.log('\n  -- kaizo/assets/sprites is not built; run '
    + 'node kaizo/tools/pack-kaizo-sprites.mjs. E2-E6 SKIPPED.');
  console.log(`\ncheck-ending-sprite-pack: ${failed ? `${failed} FAILING` : 'green (E1 only).'}`);
  process.exit(failed ? 1 : 0);
}
const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));
const mainPack = JSON.parse(readFileSync(join(MAIN_PACK, 'manifest.json'), 'utf8'));
const resolvable = new Set([...Object.keys(mainPack), ...Object.keys(overlay)]);

// ═══ E2: ALL 36 RESOLVE ════════════════════════════════════════════════════
console.log('E2 — every sprite the epilogue names resolves in a pack');
{
  const unresolved = ENDING_SPRITES.filter((n) => !resolvable.has(n));
  ok(unresolved.length === 0,
    `all ${ENDING_SPRITES.length} resolve in the vanilla pack or the kaizo overlay`
    + `${unresolved.length ? ` — MISSING: ${unresolved.join(', ')}` : ''}`);
  // The swoon easter egg and the clash flash by name: they were already packed
  // before this round, and a repack that dropped them would otherwise only
  // show up as a count.
  ok(resolvable.has(SPR.ralseiSwoon), '  ...including spr_ralsei_swoon, the 1-in-20 easter egg');
  ok(resolvable.has(SPR.fxHitback), '  ...and spr_fx_hitback, the clash flash');
}

// ═══ E3 + E4: THE EIGHTEEN, AND WHERE THEIR ART CAME FROM ══════════════════
console.log('E3/E4 — the eighteen are in the overlay, with measured provenance');
{
  const names = Object.keys(PACKED);
  ok(names.length === 18, `the work order was eighteen names (${names.length})`);
  ok(names.every((n) => ENDING_SPRITES.includes(n)),
    '  ...and every one of them is still named by the SPR table');

  for (const [name, want] of Object.entries(PACKED)) {
    const e = overlay[name];
    ok(!!e, `${name} is in the kaizo overlay`);
    if (!e) continue;
    ok(e.w === want.w && e.h === want.h && e.ox === want.ox && e.oy === want.oy
      && e.frames === want.frames,
      `  ...${want.w}x${want.h}, origin (${want.ox},${want.oy}), ${want.frames} frame(s)`);
    ok(e.source === want.source && Boolean(e.replaced) === Boolean(want.replaced),
      `  ...source '${want.source}'${want.replaced ? ', REPLACED in place by the mod' : ', unreplaced'}`
      + ` (got '${e.source}'${e.replaced ? ', replaced' : ''})`);
    ok(!mainPack[name],
      '  ...and the MAIN pack still does not carry it — the vanilla page is untouched');
  }

  const vanillaSourced = Object.entries(PACKED).filter(([, w]) => w.source === 'vanilla');
  const modSourced = Object.entries(PACKED).filter(([, w]) => w.source === 'mod');
  ok(vanillaSourced.length === 16,
    `SIXTEEN are byte-identical between the two data files — a vendoring gap, not art the mod made`);
  ok(modSourced.length === 2 && modSourced.every(([n]) => n.startsWith('spr_roaringknight_')),
    "TWO are the mod's own repaint, and both are the KNIGHT's overworld art");
}

// ═══ E5: THE FRAMES ARE REALLY THERE ═══════════════════════════════════════
console.log('E5 — every frame file is on disk at the size the metadata claims');
{
  let checked = 0;
  const bad = [];
  for (const [name, want] of Object.entries(PACKED)) {
    const e = overlay[name];
    if (!e) continue;
    ok(e.files.length === e.frames,
      `${name}: the manifest lists all ${e.frames} frame file(s)`);
    for (const f of e.files) {
      const p = join(OVERLAY, f);
      if (!existsSync(p)) { bad.push(`${f} missing`); continue; }
      const b = readFileSync(p);
      // PNG IHDR: width at byte 16, height at 20, big-endian u32.
      const w = b.readUInt32BE(16);
      const h = b.readUInt32BE(20);
      if (w !== want.w || h !== want.h) bad.push(`${f} is ${w}x${h}, metadata says ${want.w}x${want.h}`);
      checked += 1;
    }
  }
  ok(bad.length === 0,
    `all ${checked} PNG frames are present and padded to their declared size`
    + `${bad.length ? ` — ${bad.slice(0, 6).join('; ')}` : ''}`);
  ok(checked === 65, `  ...sixty-five frames, the count both extractions reported (${checked})`);
}

// ═══ E6: THE MOD'S TWO OVERWORLD REPAINTS ACTUALLY SHIP ════════════════════
// Inverted 2026-09-16 with the rest of the publish gate: this asserted that
// git REFUSED these sixteen frames. Everything ships now, so the question is
// whether they reach a clone — the Knight's overworld set renders vanilla grey
// if they do not, which is the same silent wrong-art failure E5 guards for the
// fight sprites.
console.log("E6 — EnderCat8's two overworld repaints ship (HANDOFF 5-C, permission given)");
{
  const modFiles = Object.entries(PACKED)
    .filter(([, w]) => w.source === 'mod')
    .flatMap(([name]) => (overlay[name]?.files ?? []).map((f) => relative(REPO, join(OVERLAY, f))));
  ok(modFiles.length === 16,
    `the two mod-sourced sprites contribute 16 frame files (${modFiles.length})`);
  let ignored = [];
  try {
    // `git check-ignore` exits 1 when NOTHING is ignored, so a non-zero exit
    // with empty output is the failure we want to see, not a crash.
    const out = execFileSync('git', ['check-ignore', '--', ...modFiles],
      { cwd: REPO, encoding: 'utf8' });
    ignored = out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (err) {
    ignored = String(err.stdout ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  }
  ok(ignored.length === 0,
    `git ships all ${modFiles.length} of them — the mod's art reaches a public clone `
    + `(${ignored.length} still ignored)`);
}

console.log('');
console.log(`check-ending-sprite-pack: ${failed ? `${failed} FAILING` : 'green.'}`);
process.exit(failed ? 1 : 0);
