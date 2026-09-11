// KAIZO HITBOXES — the two collision masks EnderCat8's mod changed, in the
// shape sim/masks.js consumes. Ledger gap G-23.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// WHY THIS FILE EXISTS. No code diff can see a changed mask: the GML is
// byte-identical at the assignment, both dumps name the same sprite, and
// every check that reads code stays green — the same class of invisibility
// that hid the mod's 57 replaced sprites (kaizo/HANDOFF.md §7, "THE KNIGHT IS
// BLUE BECAUSE THE MOD REPLACED THE ART"). It is visible only in the sprite
// tables, and there it is unambiguous.
//
// MEASURED, from knight-research/kaizo-mod/sprites/sprites_{kaizo,vanilla}.csv
// (the `mask_sha1` column differs on both rows, which is what makes this a
// hitbox change and not a repaint):
//
//   spr_roaringknight_slash_tunnel   (sprite table index 1807)
//     vanilla  99x21  origin (49,10)  bbox [4, 6,94,14]
//              sha1 e9a1c69e3cf4ca6634861d314399f9c40fabe4c0
//     kaizo    99x32  origin (49,10)  bbox [4,14,94,16]
//              sha1 abbff0df15ed5ffeb1084c616c732721134de694
//     Relative to the UNCHANGED origin y = 10 the inked band moves from rows
//     -4..+4 — NINE rows, straddling the line — to +4..+6, THREE rows,
//     entirely below it. The KnightLines spear's hitbox is a third as tall
//     and sits 8px down the blade. It is the bullet's own sprite with no
//     mask_index, and it spawns at image_xscale 4, so the shift is four
//     times as wide on screen as it is in the sheet.
//
//   spr_knight_diamondbullet_l
//     vanilla  99x32  origin (49,15)  bbox [5,14,93,16]
//              sha1 7ff1f40c01a9032fa3460e58074353ab7e4d3f88
//     kaizo    99x32  origin (49,15)  bbox [3,14,94,16]
//              sha1 dcca1eb4d54e218a498e60299c63e8ea3963bd34
//     `ml 5 -> 3`, `mr 93 -> 94`: the long tunnel blade is THREE PIXELS wider
//     (two at the tip, one at the hilt) and the same height. It is
//     obj_sword_tunnel_sword's default sprite with no mask_index, so it IS
//     that sword's collision shape.
//
// THE BITMAPS ARE NOT RE-TYPED HERE. `kaizo/data/masks.js` already carries
// both, extracted from the mod's own data file by
// kaizo/tools/pack-kaizo-sprites.mjs — its header's own note said "nothing in
// kaizo/ imports either sprite's mask yet ... Moving the sim onto the mod's
// masks is a collision change and a separate decision". This file IS that
// decision, taken 2026-09-10.
//
// WHY NOT sim/masks.js. Repo law 6: the vendored engine is the VANILLA
// fight's, and its SPRITE_MASKS entries are right for it. Registering the
// mod's bitmaps there would change the vanilla sim's hitboxes, so the kaizo
// side routes them at its own call sites instead (HANDOFF §2.3, "wrap, don't
// patch").
//
// SUITE: kaizo/tools/checks/check-kaizo-hitboxes.mjs.

import { kaizoMask } from '../data/masks.js';

/**
 * `sim/masks.js` keeps its `build()` private and the extracted rows carry no
 * `px`, so derive it — ONCE, onto the singleton kaizoMask hands back, which
 * is the idiom underbox.js and split-growtangle-vertical.js already use. That
 * matters beyond tidiness: masksOverlapPrecise reads `.px` and nothing else,
 * so a mask handed over without it silently overlaps nothing.
 */
function withPx(m) {
  if (!m.px) m.px = m.rows.map((r) => Array.from(r, (c) => c === '1'));
  return m;
}

/** The KnightLines spear — 3 inked rows, 8px below the origin. */
export const KAIZO_SLASHTUNNEL_MASK = withPx(kaizoMask('spr_roaringknight_slash_tunnel'));

/** obj_sword_tunnel_sword's blade — 3px wider than vanilla's. */
export const KAIZO_DIAMONDBULLET_L_MASK = withPx(kaizoMask('spr_knight_diamondbullet_l'));
