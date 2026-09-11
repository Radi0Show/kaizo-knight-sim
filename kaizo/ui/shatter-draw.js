// THE ROAR FINALE'S SCREEN SHATTER, PAINTED AT LAST — ledger G-38.
//
// *** V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// *** without permission. (kaizo/HANDOFF.md §5 V-C publish gate.)
//
// ── WHAT WAS WRONG ────────────────────────────────────────────────────────
//
// `kaizo/attacks/roaring-final-shatter.js` translated all four of the mod's
// `scr_screenshatter_*` functions in 2026-09-08: 31 pieces, their velocities,
// the delay jitter, the spin fold, the blend that swaps by the sign of
// `image_xscale`, the `y > cameray() + 1000` cull. Every number is right and
// NOTHING PAINTED ANY OF IT — the pieces carry no `sprite_index`, the renderer
// has no DRAW_EVENTS row for `kaizo_shatterpiece`, and the generic tail has
// neither a packed sprite nor a mask to fall back on. So the fight's own
// ending drew empty air while the sim dutifully simulated a screen coming
// apart. That is the ledger's G-38, severity 4: "the screen shatter is
// simulated and invisible".
//
// This module is the drawer. It is REGISTERED BY web/kaizo.js, alongside
// `KAIZO_DRAW_OVERRIDES`, because render/canvas.js's seam is keyed by object
// name and `kaizo_shatterpiece` is an object name like any other.
//
// ── AND IT IS THE SAME DRAWER THE SETTINGS ROW USES ───────────────────────
//
// `render/shatter.js` — an ENGINE file, so both sides can reach it — cuts a
// picture along a shatter sheet's sub-images and draws one piece, general over
// (sprite, origin, fragment count, blend). The UNUSED row's twenty-press break
// is its other caller. A drawer only the menu could call would have been the
// seventh instance of this repo's signature defect; this is the half that
// makes it two callers instead of one.
//
// ── THE ONE APPROXIMATION, STATED PLAINLY ─────────────────────────────────
//
// The mod's pieces are SCREENSHOTS. `scr_screenshatter_create` renders the
// live `application_surface` into a surface, subtracts sub-image `_i` of
// `spr_roaringknight_finalshatter` from a white field, subtracts THAT from the
// screenshot, and `sprite_create_from_surface`s the hole — so each piece is
// the actual pixels of the screen inside that shard's outline
// (`gml_GlobalScript_scr_lerpvar.gml:74-90`). The browser renderer has no
// equivalent of that surface at the point in the depth pass where these pieces
// are drawn, and grabbing one would include the pieces already drawn this
// frame. So the shard is painted as its SILHOUETTE in the piece's own
// `image_blend` — the mod's `[merge_color(c_white, c_red, 0.6),
// merge_color(c_blue, c_red, 0.6)]` on the final hit, `[c_white, c_blue]`
// otherwise (`:57-67`), which the sim already computes and already swaps by
// the spin fold's sign. Everything else — position, angle, the fold, the cull
// — is the sim's, verbatim.
//
// Labelled here rather than assumed: this is a VISUAL deviation of the kind
// roaring-final-shatter.js's header already lists (the afterimages, the
// dmgwriter killtimer), and it is the same class as the other kaizo drawers'
// stand-ins. It is 31 red-and-blue shards of glass flying off the screen,
// which is what the moment looks like; it is not the screen itself flying off.
//
// ── HOW A PIECE KNOWS WHICH SHARD IT IS ───────────────────────────────────
//
// It does not carry one, and `kaizo/attacks/**` is not this lane's to change.
// Both facts the drawer needs — the sub-image and where that sub-image is
// pinned — are recovered ON THE PIECE'S FIRST DRAW and remembered, which is
// exact because of two things the engine guarantees:
//
//   * A DRAW EVENT RUNS ON THE INSTANCE'S CREATION FRAME (CLAUDE.md,
//     "Creation frame"), and the pieces do not move until the screenshatter
//     CONTROLLER steps — which, being spawned during the step phase, is the
//     next frame at the earliest. So the first frame this drawer sees a piece,
//     it is still sitting at its birth position, `state.view.x + _sx`.
//   * `screenshatterCreate` fills `state.knight.shatter_insts` in sub-image
//     order, 0..30, and only ever REMOVES from it afterwards. So the array
//     index on that first frame IS `_i`.
//
// Both are recovered together, in one pass over the array, the first time the
// field is seen. If a later re-create replaces the array the pass simply runs
// again (the key is the array identity, not the frame). A piece somehow first
// seen after a cull would take a shifted sub-image — a different shard of the
// same glass, at the right place — and the check below pins the exact case
// rather than trusting the reasoning.

import { sliceShatter, drawShatterFragment } from '../../render/shatter.js';

/** `spr_roaringknight_finalshatter` — 31 sub-images, the mod's own sheet and
 *  the same one the UNUSED row breaks into (kaizo/ui/proceed.js). */
export const SHATTER_SHEET = 'spr_roaringknight_finalshatter';

/**
 * GameMaker packs colours BGR — `r | g << 8 | b << 16`. The sim stores
 * `image_blend` in that packed form because that is what the GML stores
 * (roaring-final-shatter.js's `gmPack`), so the drawer unpacks it.
 * Reading one of these as RGB inverts the whole re-theme; it is the single
 * most-repeated mistake in this repo's colour work.
 */
const unpack = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];

/**
 * Per-piece bookkeeping, keyed by the ENTITY, plus the slice cache keyed by
 * the blend. Module-level and WeakMap-based, which is the convention
 * render/canvas.js's header states for drawer-private state: the `helpers` bag
 * is frozen and shared, and a drawer that stashed state on it would couple
 * every other drawer to this one.
 */
const pieceInfo = new WeakMap();   // entity -> { i, ox, oy }
const seenArray = new WeakMap();   // shatter_insts array -> true
/** blend key -> slices. Two blends exist per fight at most (front and back),
 *  so this never grows: a Map, not a WeakMap, because the key is a string. */
const sliceCache = new Map();

/**
 * One pass over the live array, the first time this array is seen: sub-image
 * index and birth origin together. See the header for why both are exact.
 */
function indexPieces(state) {
  const insts = state.knight?.shatter_insts;
  if (!Array.isArray(insts) || seenArray.has(insts)) return;
  seenArray.set(insts, true);
  for (let i = 0; i < insts.length; i++) {
    const p = insts[i];
    if (!p || p === -4) continue;
    pieceInfo.set(p, {
      i,
      // `_sx` / `_sy` — the shard's anchor inside the 640x480 frame, which is
      // the origin `sprite_create_from_surface(..., _sx, _sy)` gave the piece.
      ox: p.x - (state.view?.x ?? 0),
      oy: p.y - (state.view?.y ?? 0),
    });
  }
}

function slicesFor(entry, blend) {
  const key = blend.join(',');
  const hit = sliceCache.get(key);
  if (hit && hit.entry === entry) return hit.slices;
  const slices = sliceShatter(entry, {
    width: entry.meta?.w ?? 640,
    height: entry.meta?.h ?? 480,
    blend,
    // NO `paint` — the flat-silhouette path. The header says why the
    // screenshot the mod cuts is not available here.
  });
  sliceCache.set(key, { entry, slices });
  return slices;
}

/**
 * The draw override for `kaizo_shatterpiece`.
 *
 * Returns TRUE: the mod's pieces have a sprite and no `draw_self()` after it,
 * so the vanilla tail must not run — it would paint the collision-mask
 * fallback over the glass.
 */
export function drawKaizoShatterPiece(ctx, e, state, helpers) {
  const entry = helpers?.sprites?.get(SHATTER_SHEET);
  // NO SHEET: a clone whose sprite overlay has not been packed
  // (kaizo/tools/pack-kaizo-sprites.mjs). Draw nothing and let the tail be
  // skipped anyway — the mask fallback for a 640x480 axis-aligned rect is a
  // white screen, which is worse than an invisible one.
  if (!entry) return true;
  indexPieces(state);
  const info = pieceInfo.get(e);
  if (!info) return true;
  const slices = slicesFor(entry, unpack(e.image_blend ?? 16777215));
  if (!slices.length) return true;
  drawShatterFragment(ctx, slices[info.i % slices.length], e.x, e.y, {
    ox: info.ox,
    oy: info.oy,
    // The spin fold: `image_xscale` runs +1 -> 0 -> -1 -> 0 across a turn and
    // the blend swaps with its sign, both in the sim already. A negative scale
    // flips the piece, which is the fold.
    xscale: e.image_xscale ?? 1,
    yscale: e.image_yscale ?? 1,
    angle: e.image_angle ?? 0,
    alpha: e.image_alpha ?? 1,
  });
  return true;
}

/** The registry row, in the shape web/kaizo.js spreads over
 *  `KAIZO_DRAW_OVERRIDES`. One entry, named once. */
export const KAIZO_SHATTER_OVERRIDE = Object.freeze({
  kaizo_shatterpiece: drawKaizoShatterPiece,
});

