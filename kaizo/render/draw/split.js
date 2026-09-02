// KAIZO DRAW — the Flurry / box-splitter family. STUBS: every export
// delegates to the vanilla drawer through `helpers.drawVanilla`, so these
// objects render on the kaizo page exactly as they do on the main page until
// each is ported.
//
// Contract and helpers: kaizo/render/index.js. The vanilla model is
// render/canvas.js (drawHellSurface, drawTelegraph, the split-tooth jitter in
// drawEntity), render/draw/swords.js drawSplitslashStrike and
// render/draw/splitcut.js drawSplitCut.
//
// THE MOD'S COLOUR IS ALREADY IN THE SIM. kaizo/attacks/flurry-splitslash.js
// carries the #86A2FF ramp on `image_blend`, and flurry-boxsplitter-attack.js
// records (its header, "COLOUR — audited") that the hell surface is blue in
// the mod only because it merges FROM the slash: `_backing =
// merge_color(c_black, image_blend, 0.5)` and both flow tiles pass
// `image_blend` through (kaizo boxsplitter Draw_0 45/50-51). The vanilla
// renderer bakes a dark-red pixel instead (canvas.js `tintedPixel`,
// merge_color(c_black, c_red, 0.5)) — that is the first thing this family's
// port changes.
//
// The kaizo GML (read-only, never copied here):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/gml_Object_<obj>_Draw_0.gml
// diffed against gml_vanilla_v105/CodeEntries/.
//
// STATUS 2026-09-01 — ALL FOUR ARE PORTED. The header above and the "NOT
// PORTED" paragraphs on each export are the seam's own history and stay
// verbatim: they still describe exactly what the VANILLA path drew for each
// object, which is what every deviation below is measured against. Each
// export is now an EXACT translation of the kaizo Draw_0 (every call, in
// order); the vanilla helper is reused only where a sub-block is
// byte-identical to vanilla, and each such reuse says so with the lines.
//
// AUDITED 2026-09-02 — every call re-read against the four kaizo Draw_0s
// (diffed against v105 again: the hunks listed below are the whole diff) and
// MEASURED through the renderer: a scratch probe drove V-C (seed 12345,
// 10,000 frames, the kaizo smoke's pulse feed and HP pin) with manifest-
// shaped sprite entries and a transform-tracking ctx, recording every
// drawImage these four overrides issue together with its destination rect.
// The figures quoted below as MEASURED are that run's. Two hardenings
// landed: the hell surface and its scratch are per renderer (a WeakMap on
// `helpers`) instead of module singletons, and the strike's soul sprite
// falls back to spr_dodgeheart the way the vanilla drawer does. No draw
// call changed; the three gates (tools/verify-render-smoke.mjs, the kaizo
// render smoke, npm run verify) were green before and after.
//
// WHAT THE MOD CHANGED (diff gml_vanilla_v105 -> gml_kaizo_dump, Draw_0):
//   boxsplitter_attack  l.1  `image_alpha == 1` -> `> 0`; l.17 ghost alpha
//                       `0.6` -> `0.6 * image_alpha`. Both are STATE, already
//                       on flurry-boxsplitter-attack.js (step / endStep).
//   splitslash          l.1-11 NEW with-block: `exit` when any OTHER slash
//                       holds a playerstrike; l.21 `_backing` merges from
//                       #86A2FF instead of c_red; l.38-41 NEW `with (manager)
//                       { timer--; local_turntimer++; }` (STATE, modelled in
//                       flurry-splitslash.js endStep).
//   split_bullet        l.6-24 NEW blue-to-white tint ramp (STATE, modelled
//                       in flurry-split-bullet.js endStep). The draw call
//                       itself (l.25) is byte-identical to vanilla l.6.
//   growtangle_effect   l.37 the vertical cut's SECOND screen half reads the
//                       snapshot from left 0, not `_sx` — the right side of
//                       the screen shows the LEFT side of the picture.
//
// WHAT THE VANILLA RENDERER GOT DIFFERENT (and this port corrects on the
// kaizo page only — render/ is not touched):
//   * the hell surface drew after the whole depth pass (canvas.js's late
//     pass, "above the arena, below the soul") — here it draws where the GML
//     draws it, inside the manager's own Draw at the manager's depth
//     (`ownsHellSurface`), and only while the manager is alive;
//   * the surface's bar and flow tiles were the baked dark-red pixel and an
//     UNTINTED, single, non-tiled flow copy under `source-atop` — here the
//     bar is `merge_color(c_black, slash.image_blend, 0.5)`, the tiles are
//     tinted by `slash.image_blend`, TILED across the 142x142 surface, and
//     composited with `gpu_set_blendmode_ext(bm_dest_alpha, bm_dest_alpha)`
//     (additive, clipped to the bar) — see blendDestAlphaAdd;
//   * the splitslash drew its strike overlay (the jittered soul copy and the
//     slice) BEFORE its own telegraph / draw_self; the GML order is the
//     reverse (Draw_0 12-27 then 28-37);
//   * the cut effect's six box halves were drawn UNTINTED and BOTH at the
//     first half's position; the GML tints them with `image_blend` (the
//     box's green) and places the second three at the split offset
//     (draw_sprite_part_ext_rot's anchor arithmetic, translated below);
//   * the cut effect's screen halves used 0 for `camerax()/cameray()`; here
//     they use `state.view`, which sim/shake.js moves (measured: five
//     distinct view offsets in a 10,000-frame run).
//
// RANDOM IN THESE DRAWS — reported, NOT modelled, per the hard rule (the
// renderer never advances state.rng; a Draw-random is a pure function of
// state.frame):
//   * splitslash Draw_0 32-33: `irandom(2) - 1` twice per striking frame
//     (vanilla-identical). Frame-seeded here via helpers.frandCanvas; the sim
//     strips it (sim/attacks/splitslash.js and the kaizo copy both say so).
//   * split_bullet Draw_0 25: `random_range(-0.1, 0.1)` twice per tooth per
//     frame (vanilla-identical). Frame-seeded in render/canvas.js drawEntity
//     ("THE SPLIT TEETH PULSE"), which `helpers.drawSelf` runs.
//
// UPDATE 2026-09-02 (adversarial pass over this family): both of those draws
// are now ON THE STREAM in the kaizo attack layer — flurry-splitslash.js
// `draw(e, state)` writes `strikeJitter` (Draw_0:32-33) and
// flurry-split-bullet.js `draw(e, state)` writes `drawJitterXs/Ys`
// (Draw_0:25) — the stream family's stream-fidelity work, the other half of
// the byte gate; this file and render/canvas.js drawEntity READ those when
// an instance carries them and keep the frame-seeded pair only as the
// fallback for one that does not. Found on that pass, and fixed in the
// module: flurry-splitslash.js carried TWO `draw` keys in one type literal,
// and a JS object literal keeps the LAST duplicate silently, so the
// strike-jitter slot had been replaced by the Animation End arm and
// `strikeJitter` never existed (runtime check: `splitslash.draw.length`
// was 1, its body the Other_7 arm) — the two are one slot there now, in the
// game's order. Found and NOT fixable from here: the quickslash_big cut
// (kaizo/attacks/quickslash.js) still spawns the VANILLA organism and
// VANILLA teeth (sim/attacks/split-growtangle.js / split-bullet.js), which
// carry neither the mod's coltimer ramp nor a draw slot — see
// drawObjRoaringknightSplitBullet for the ramp, and the task return for the
// rest.
//
// PRIMITIVES render/draw/gm.js does not have, implemented here (kept local
// because gm.js is not this family's to edit): draw_sprite_general with a
// signed part rect, draw_sprite_part_ext_rot (the global script, verbatim
// arithmetic), draw_sprite_tiled_ext onto a surface, the
// (bm_dest_alpha, bm_dest_alpha) blend, draw_surface_part_ext, remap_clamped
// and a frame-seeded irandom.

import { drawSpriteExt, tinted, ldx, ldy } from '../../../render/draw/gm.js';
import {
  scrEaseOut, clamp01, lerp, mergeColor, BLACK, WHITE, pointDirection, pointDistance,
} from '../../../sim/gml.js';
// The mod's palette, from the one shared source (kaizo/attacks/kaizo-colors.js)
// — never a private copy (the rule every flurry module already applies).
import { KAIZO_TELEGRAPH_COLOR, getSwordcolor } from '../../attacks/kaizo-colors.js';

const VIEW_W = 640;
const VIEW_H = 480;
/** `surface_create(142, 142)` — kaizo boxsplitter Draw_0:32. */
const HELL = 142;

/** A colour only if it is the [r,g,b] array tinted() accepts; else "no tint". */
const asColor = (c) => (Array.isArray(c) ? c : null);

/** `draw_sprite_*`'s subimage: floored and wrapped on the frame count. */
function frameOf(entry, sub) {
  if (!entry || !entry.frames || !entry.frames.length) return null;
  const n = entry.frames.length;
  return entry.frames[(((Math.floor(sub) | 0) % n) + n) % n] ?? null;
}

/** A W x H offscreen surface with nearest-neighbour sampling, once. */
function makeSurface(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}

/**
 * GML `remap_clamped(in_min, in_max, out_min, out_max, v)`
 * (gml_GlobalScript_scr_remapvalue.gml): the linear remap, clamped to the
 * output range whichever way round it is.
 */
function remapClamped(inMin, inMax, outMin, outMax, v) {
  const r = outMin + ((v - inMin) * (outMax - outMin)) / (inMax - inMin);
  const lo = Math.min(outMin, outMax);
  const hi = Math.max(outMin, outMax);
  return r < lo ? lo : r > hi ? hi : r;
}

/**
 * `irandom(n)` as a pure function of the sim frame — the 30Hz Draw-random
 * rule (CLAUDE.md, "A GML Draw runs at 30Hz; a browser renderer does not").
 * `frand` is helpers.frandCanvas; `salt` keeps two draws in one frame apart.
 */
function irandomFrame(frand, frame, salt, n) {
  return Math.floor(frand(frame, salt) * (n + 1));
}

/**
 * GML `draw_sprite_general(sprite, subimg, left, top, width, height, x, y,
 * xscale, yscale, rot, c1, c2, c3, c4, alpha)` with the four corner colours
 * equal (every caller here passes one `image_blend` four times).
 *
 * (x, y) is the TOP-LEFT of the drawn part — the sprite origin is ignored —
 * and the part is scaled about it and rotated `rot` degrees about it.
 *
 * THE PART RECT IS SIGNED, and that is load-bearing. draw_sprite_part_ext_rot
 * (below) hands this a NEGATIVE width or height for the second half of the
 * cut box: `_splitwidth / xscale - _splitleft` = 75/2 - 75 = -37.5. GameMaker
 * builds the quad from the four signed corners — (x, y) .. (x + w*xs, y +
 * h*ys) in position, (left, top) .. (left + w, top + h) in texture — with
 * culling off, so a negative extent draws the quad from the far corner back
 * to (x, y) with the texture likewise reversed: an UPRIGHT image occupying
 * the normalised rectangle. That is what makes the six calls in the effect's
 * Draw produce two distinct halves in the game. Canvas's drawImage maps
 * source corners to destination corners the same way, so normalising both
 * rects reproduces it; a sign mismatch between the two (never the case here,
 * both go negative together) would be a flip, and is left to drawImage's own
 * corner mapping by keeping the sign on the destination extent.
 */
function drawSpriteGeneral(ctx, entry, sub, left, top, width, height, x, y, xs, ys, rot, blend, alpha) {
  const img = frameOf(entry, sub);
  if (!img || width === 0 || height === 0 || xs === 0 || ys === 0) return;
  const src = blend ? tinted(img, blend) : img;
  const sx0 = Math.min(left, left + width);
  const sy0 = Math.min(top, top + height);
  const sw = Math.abs(width);
  const sh = Math.abs(height);
  // Destination in LOCAL (pre-scale) units: a negative extent runs from the
  // far corner back to the anchor.
  const dx0 = Math.min(0, width);
  const dy0 = Math.min(0, height);
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.translate(x, y);
  if (rot) ctx.rotate((-rot * Math.PI) / 180);
  ctx.scale(xs, ys);
  ctx.drawImage(src, sx0, sy0, sw, sh, dx0, dy0, sw, sh);
  ctx.restore();
}

/**
 * GML `draw_sprite_part_ext_rot(sprite, subimg, left, top, width, height, x,
 * y, xscale, yscale, rot, colour, alpha)` —
 * gml_GlobalScript_draw_sprite_part_ext_rot.gml, arithmetic verbatim:
 *
 *     if (left < 0) left = 0;  if (top < 0) top = 0;
 *     __xoffset = sprite_get_xoffset(sprite) * xscale;
 *     __yoffset = sprite_get_yoffset(sprite) * yscale;
 *     __newx = left * xscale;  __newy = top * yscale;
 *     __theta  = point_direction(__xoffset, __yoffset, __newx, __newy) + rot;
 *     __radius = point_distance(__xoffset, __yoffset, __newx, __newy);
 *     __xx = x + lengthdir_x(__radius, __theta);
 *     __yy = y + lengthdir_y(__radius, __theta);
 *     draw_sprite_general(sprite, subimg, left, top,
 *                         (width / xscale) - left, (height / yscale) - top,
 *                         __xx, __yy, xscale, yscale, rot, col x4, alpha);
 *
 * i.e. `width`/`height` are the part's SCREEN extent measured from the
 * sprite's top-left (the callers pass `sprite_width`, which is already
 * scaled), `left`/`top` are in SPRITE pixels, and the anchor is the sprite
 * origin rotated with the part. With rot 0 the anchor reduces to
 * (x - ox*xs + left*xs, y - oy*ys + top*ys). The script's own sub-pixel f32
 * trig noise on the anchor is not reproduced (< 1e-4 px at these radii).
 */
function drawSpritePartExtRot(ctx, entry, sub, left, top, width, height, x, y, xs, ys, rot, blend, alpha) {
  if (!entry || !entry.meta) return;
  if (left < 0) left = 0;
  if (top < 0) top = 0;
  const xoffset = (entry.meta.ox ?? 0) * xs;
  const yoffset = (entry.meta.oy ?? 0) * ys;
  const newx = left * xs;
  const newy = top * ys;
  const theta = pointDirection(xoffset, yoffset, newx, newy) + rot;
  const radius = pointDistance(xoffset, yoffset, newx, newy);
  const xx = x + ldx(radius, theta);
  const yy = y + ldy(radius, theta);
  drawSpriteGeneral(ctx, entry, sub, left, top, width / xs - left, height / ys - top,
    xx, yy, xs, ys, rot, blend, alpha);
}

/**
 * GML `draw_sprite_tiled_ext(sprite, subimg, x, y, xscale, yscale, colour,
 * alpha)` with a SURFACE as the render target: the sprite, placed with its
 * origin at (x, y), repeated on its scaled size until the whole W x H target
 * is covered. spr_knight_bullet_flow's origin is (0, 0) (manifest), so the
 * origin term is inert here and kept for the function's shape.
 */
function drawSpriteTiledExt(ctx, entry, sub, x, y, xs, ys, blend, alpha, W, H) {
  const img = frameOf(entry, sub);
  if (!img) return;
  const tw = (entry.meta?.w ?? img.width) * xs;
  const th = (entry.meta?.h ?? img.height) * ys;
  if (!(tw > 0) || !(th > 0)) return;
  const src = blend ? tinted(img, blend) : img;
  let startX = ((((x - (entry.meta?.ox ?? 0) * xs) % tw) + tw) % tw);
  if (startX > 0) startX -= tw;
  let startY = ((((y - (entry.meta?.oy ?? 0) * ys) % th) + th) % th);
  if (startY > 0) startY -= th;
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  for (let ty = startY; ty < H; ty += th) {
    for (let tx = startX; tx < W; tx += tw) {
      ctx.drawImage(src, tx, ty, tw, th);
    }
  }
  ctx.restore();
}

/**
 * `gpu_set_blendmode_ext(bm_dest_alpha, bm_dest_alpha)` for one tiled draw
 * onto the hell surface (kaizo boxsplitter Draw_0:49-52):
 *
 *     final.rgb = src.rgb * dst.a + dst.rgb * dst.a
 *     final.a   = src.a   * dst.a + dst.a   * dst.a
 *
 * The surface holds ONLY the bar (alpha 1 inside it, 0 elsewhere — the bar
 * is spr_pxwhite10_center, opaque, drawn with smoothing off), so this is
 * "ADD the tile where the bar is; leave everything else untouched": inside
 * the bar `src + dst`, outside `0` where it was already 0. Canvas has no
 * dest-alpha factor, so the same picture is built in two steps — the tiles
 * go onto a scratch, the scratch is multiplied by the surface's alpha
 * (`destination-in`), and the result is added (`lighter`). Exact where the
 * bar's alpha is 0 or 1, which with nearest-neighbour rotation is every
 * pixel; a partial-alpha edge pixel would differ by (a - a*a) in alpha only.
 * [RECHECKED 2026-09-02: not alpha only. At such a pixel the RGB reaching
 * the screen differs too — this path adds (bar + tile) * a under `lighter`,
 * GameMaker's surface pixel would be (bar + tile) * a at alpha a + a*a and
 * its bm_add blit adds (bar + tile) * a*a * (1 + a). Such a pixel exists
 * only where canvas antialiases the rotated bar's edge, which GameMaker does
 * not do at all, so it is a rasteriser difference, not a blend one.]
 *
 * ONE MORE THING THE FACTOR IGNORES: the SOURCE alpha. GameMaker's fragment
 * is (rgb, a) un-premultiplied and bm_dest_alpha multiplies rgb by dst.a
 * regardless of src.a, so a transparent texel would still add its rgb —
 * which is why the flow texture's transparent texels matter. Decoded
 * (assets/sprites/spr_knight_bullet_flow_2.png): every alpha-0 texel is
 * (0, 0, 0), so they add nothing in the game and nothing here, and the
 * pattern is the white (255,255,255) texels tinted by `image_blend`.
 */
function blendDestAlphaAdd(hell, flow, draw) {
  const fg = flow.g;
  fg.setTransform(1, 0, 0, 1, 0, 0);
  fg.globalCompositeOperation = 'source-over';
  fg.globalAlpha = 1;
  fg.clearRect(0, 0, HELL, HELL);
  draw(fg);
  fg.globalCompositeOperation = 'destination-in';
  fg.drawImage(hell.c, 0, 0);
  fg.globalCompositeOperation = 'source-over';
  const hg = hell.g;
  hg.globalCompositeOperation = 'lighter';
  hg.drawImage(flow.c, 0, 0);
  hg.globalCompositeOperation = 'source-over';
}

/**
 * GML `draw_surface_part_ext(surface, left, top, width, height, x, y, 1, 1,
 * c_white, alpha)` — the part of a surface at (x, y), unscaled, untinted;
 * the caller has set the alpha. A zero or negative extent draws nothing.
 */
function drawSurfacePart(ctx, surf, left, top, width, height, x, y) {
  if (!(width > 0) || !(height > 0)) return;
  ctx.drawImage(surf, left, top, width, height, x, y, width, height);
}

function findAlive(state, name) {
  return state.entities.find((x) => x.alive && x.type.name === name);
}

// ── obj_roaringknight_boxsplitter_attack ───────────────────────────────────

/** `hell_surface` (Draw_0:30-33) and the scratch the dest-alpha blend needs. */
// PER RENDERER, keyed on the frozen `helpers` bag createRenderer builds (one
// per canvas — the vanilla canvas.js keeps its hellSurface in that same
// closure). These were module singletons first; two renderers alive at once
// (the kaizo smoke builds several, and a page could host two) would have
// shared one surface and one scratch across their frames. `hell_surface` is
// an INSTANCE variable in the GML and the manager is a singleton per fight,
// so per renderer is per instance here. Created on first use, like
// `surface_create` under `!surface_exists` (Draw_0:30-33), then reused.
const hellSurfaces = new WeakMap();
function hellSurfacesFor(helpers) {
  let s = hellSurfaces.get(helpers);
  if (!s) {
    s = { hell: makeSurface(HELL, HELL), flow: makeSurface(HELL, HELL) };
    hellSurfaces.set(helpers, s);
  }
  return s;
}

/**
 * kaizo boxsplitter Draw_0:30-58, verbatim in order:
 *
 *     if (!surface_exists(hell_surface)) hell_surface = surface_create(142, 142);
 *     draw_set_blend_mode(bm_normal);
 *     surface_set_target(hell_surface);
 *     draw_clear_alpha(c_black, 0);
 *     var _gtx = gt_minx() + 5;   // dead locals, read nowhere (Draw_0:37-38)
 *     var _gty = gt_miny() + 5;
 *     with (obj_roaringknight_splitslash) {
 *         if (!slash) {
 *             var _ease    = scr_ease_out(clamp01(timer / 30), 3);
 *             var _spin    = ((_ease * 15) - 15) * flip;
 *             var _backing = merge_color(c_black, image_blend, 0.5);
 *             var _size    = lerp(4, 0, _ease);
 *             var _length  = clamp01(timer / 30) * 90;
 *             draw_sprite_ext(spr_pxwhite10_center, 0, 71 + xoffset, 71 + yoffset,
 *                             _length, _size, _spin + image_angle + angleoffset, _backing, 1);
 *             gpu_set_blendmode_ext(bm_dest_alpha, bm_dest_alpha);
 *             draw_sprite_tiled_ext(spr_knight_bullet_flow, 2, timer, timer, 0.25, 0.25, image_blend, 1);
 *             draw_sprite_tiled_ext(spr_knight_bullet_flow, 2, -timer + 40, -timer + 40, 0.25, 0.25, image_blend, 1);
 *             gpu_set_blendmode(bm_normal);
 *         }
 *     }
 *     surface_reset_target();
 *     draw_set_blend_mode(bm_add);
 *     draw_surface(hell_surface, obj_growtangle.x - 71, obj_growtangle.y - 71);
 *     draw_set_blend_mode(bm_normal);
 *
 * Inside the `with`, `image_blend` is the SLASH's — the #86A2FF ramp
 * flurry-splitslash.js assigns at its Step_0:56 — so the bar is half of that
 * ramp and the tiles are the ramp itself: black for the first frames, blue by
 * frame 20. `with` walks the slashes in instance order; the sim's entity
 * order is creation order, the same thing.
 *
 * `obj_growtangle` is the BATTLE BOX itself, not the manager's `growtangle`
 * reference — and the organism parks that box at x = -9999 while the split
 * is open (flurry-split-growtangle.js, "Park the main box offscreen"), so in
 * the game this surface is simply off screen for those frames. Translated
 * as read. With no obj_growtangle instance the GML would error; nothing is
 * drawn.
 *
 * MEASURED 2026-09-02 (the probe in the header): 780 surface blits over the
 * run — 26 slashes x 30 pending frames — of which 174 had the box on screen
 * and 606 had it parked at -9999. So on the kaizo page, as in the game, the
 * flowing surface shows for a turn's FIRST cut, and every later cut's
 * telegraph is the slash's own screen-wide bar alone (that one follows the
 * manager's `growtangle`, which is the organism after the first cut and
 * stays where the box was — drawObjRoaringknightSplitslash below). The
 * vanilla late pass keyed on the same `obj_growtangle.x`, so nothing moved
 * here; the split is recorded because it is easy to misread as a bug.
 *
 * The additive blit of a cleared surface is a no-op, so the whole block is
 * skipped when no slash is pending — same pixels, no per-frame surface work.
 */
function drawHellSurfaceKaizo(ctx, state, helpers) {
  const gt = findAlive(state, 'obj_growtangle');
  if (!gt) return;
  const pending = state.entities.filter(
    (s) => s.alive && s.type.name === 'obj_roaringknight_splitslash' && !s.slash,
  );
  if (!pending.length) return;

  const { sprites } = helpers;
  const px = sprites.get('spr_pxwhite10_center');
  const flowSprite = sprites.get('spr_knight_bullet_flow');

  const { hell, flow } = hellSurfacesFor(helpers); // Draw_0:30-33, once per renderer
  const hg = hell.g;
  hg.setTransform(1, 0, 0, 1, 0, 0);
  hg.globalCompositeOperation = 'source-over';
  hg.globalAlpha = 1;
  hg.clearRect(0, 0, HELL, HELL); // draw_clear_alpha(c_black, 0)

  for (const s of pending) {
    const t = clamp01((s.timer ?? 0) / 30);
    const ease = scrEaseOut(t, 3);
    const spin = (ease * 15 - 15) * (s.flip ?? 1);
    const blend = asColor(s.image_blend) ?? BLACK;
    const backing = mergeColor(BLACK, blend, 0.5);
    const size = lerp(4, 0, ease);
    const length = t * 90;
    if (px) {
      drawSpriteExt(hg, px, 0, 71 + (s.xoffset ?? 0), 71 + (s.yoffset ?? 0),
        length, size, spin + (s.image_angle ?? 0) + (s.angleoffset ?? 0), backing, 1);
    }
    if (flowSprite) {
      const timer = s.timer ?? 0;
      blendDestAlphaAdd(hell, flow, (fg) => {
        drawSpriteTiledExt(fg, flowSprite, 2, timer, timer, 0.25, 0.25, blend, 1, HELL, HELL);
      });
      blendDestAlphaAdd(hell, flow, (fg) => {
        drawSpriteTiledExt(fg, flowSprite, 2, -timer + 40, -timer + 40, 0.25, 0.25, blend, 1, HELL, HELL);
      });
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; // draw_set_blend_mode(bm_add)
  ctx.globalAlpha = 1;
  ctx.drawImage(hell.c, gt.x - 71, gt.y - 71);
  ctx.restore();
}

/**
 * obj_roaringknight_boxsplitter_attack — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today, in TWO places: the generic blit for the manager's own pose
 * in the depth pass (render/canvas.js drawEntity), and the 142x142 additive
 * hell surface — this object's Draw_0 — drawn by canvas.js AFTER the depth
 * pass ("above the arena, below the soul"), keyed on the pending splitslashes
 * rather than on this instance. The late pass keeps running while this stub
 * delegates. A port that draws the surface itself at the manager's real
 * depth sets `drawObjRoaringknightBoxsplitterAttack.ownsHellSurface = true`
 * (the seam header in render/canvas.js) and the late pass steps aside;
 * `helpers.drawHellSurface(state)` and `helpers.tintedPixel` are the vanilla
 * pieces if it wants to reuse them.
 * Sim side: kaizo/attacks/flurry-boxsplitter-attack.js.
 *
 * PORTED 2026-09-01 — kaizo Draw_0, both halves:
 *
 *     if (image_alpha > 0) {                       // l.1  (vanilla: == 1)
 *         if (animtimer < 4) animtimer++;          // l.3-10  STATE: module step
 *         else if (image_index == 1 || image_index == 4) image_index++;
 *         draw_self();                             // l.11  THE ONE DRAW
 *         aetimer++;                               // l.12-28 STATE: module
 *         if ((aetimer % 4) == 0 && image_alpha != 0) { fade = scr_afterimage(); ... }
 *     }
 *     ...the hell surface, l.30-58 — drawHellSurfaceKaizo above.
 *
 * The pose counters and the ghost trail are instance state and spawns, and
 * flurry-boxsplitter-attack.js already models them where the CLAUDE.md table
 * puts Draw-side state (step for the pose, endStep for the increment-before-
 * use `aetimer`); the ghosts are obj_afterimage instances the depth pass
 * draws on its own. So this Draw's own pixels are `draw_self()` under the
 * mod's `> 0` gate — vanilla's blit drew the manager at every alpha, the GML
 * does not draw it at all at alpha 0 (the faded difficulty-5 knight) — and
 * then the surface, at THIS object's depth: `obj_heart.depth + 1` (Create_0:
 * 12; obj_heart's depth is its object definition's 0, written nowhere in the
 * dump — kaizo-mod/sprites/objects_kaizo.csv), carried as 1 on the module.
 * That places the surface OVER the pending slash's own screen-wide bar
 * (depth `obj_growtangle.depth + 10`) and UNDER the box and the teeth, which
 * the late pass could not do.
 *
 * MEASURED (the probe in the header): 909 manager frames drew something;
 * `draw_self` was issued on 689 of them and skipped on the 220 where the
 * difficulty-5 fade held `image_alpha` at 0 — the mod's `> 0` gate, same
 * pixels as an alpha-0 blit, one call fewer. The surface blit landed at
 * (gt.x - 71, gt.y - 71) under `lighter` on every frame it was drawn.
 */
export function drawObjRoaringknightBoxsplitterAttack(ctx, e, state, helpers) {
  if (e.image_alpha > 0) helpers.drawSelf(e, state); // draw_self(), Draw_0:11
  drawHellSurfaceKaizo(ctx, state, helpers);          // Draw_0:30-58
  return true;
}
/** The surface is drawn here, at the manager's depth — the late pass steps aside. */
drawObjRoaringknightBoxsplitterAttack.ownsHellSurface = true;

// ── obj_roaringknight_splitslash ───────────────────────────────────────────

/**
 * `merge_color(c_black, #86A2FF, 0.5)` — kaizo splitslash Draw_0:21, a Draw
 * LOCAL at a fixed 0.5 of the telegraph blue (NOT the instance's 20-frame
 * ramp; that one feeds the hell surface). Vanilla: c_red. mergeColor rounds
 * the .5 channel up (128); whether the runner truncates it to 127 is not
 * measured — one LSB on one channel.
 */
const SPLITSLASH_BACKING = mergeColor(BLACK, KAIZO_TELEGRAPH_COLOR, 0.5);

/**
 * obj_roaringknight_splitslash — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/swords.js drawSplitslashStrike (the
 * `playerstrike` overlay: the jittered soul copy and spr_rk_slash_heartslice)
 * which returns FALSE, then the tail: while `!e.slash` canvas.js
 * drawTelegraph (the long additive bar spinning into place, in the baked
 * dark red), otherwise the generic blit. A port returns falsy to keep the
 * tail or true to own the whole event; `helpers.drawTelegraph(e, state)` is
 * the vanilla bar.
 * Sim side: kaizo/attacks/flurry-splitslash.js (the #86A2FF image_blend).
 *
 * PORTED 2026-09-01 — kaizo Draw_0, in order:
 *
 *     var _me = id;                                        // l.1-11 NEW
 *     with (obj_roaringknight_splitslash)
 *         if (id != _me) if (playerstrike) exit;           // the WHOLE Draw
 *     if (slash) draw_self();                              // l.12-15
 *     else {                                               // l.16-27
 *         gpu_set_blendmode(bm_add);
 *         var _ease       = scr_ease_out(clamp01(timer / 30), 3);
 *         var _spin       = ((_ease * 15) - 15) * flip;
 *         var _backing    = merge_color(c_black, #86A2FF, 0.5);   // vanilla: c_red
 *         var _growtangle = obj_roaringknight_boxsplitter_attack.growtangle;
 *         var _size       = lerp(4, 0, _ease);
 *         var _length     = _ease * 180;
 *         draw_sprite_ext(spr_pxwhite10_center, 0, _growtangle.x + xoffset, _growtangle.y + yoffset,
 *                         _length, _size, _spin + image_angle + angleoffset, _backing, 1);
 *         gpu_set_blendmode(bm_normal);
 *     }
 *     if (playerstrike == 1) {                             // l.28-43
 *         with (obj_heart) {
 *             var _xx = irandom(2) - 1;  var _yy = irandom(2) - 1;      // l.32-33 RNG
 *             var _fade = remap_clamped(45, 55, 1, 0, other.timer);
 *             draw_sprite(sprite_index, image_index, x + _xx, y + _yy);
 *             draw_sprite_ext(spr_rk_slash_heartslice, other.cuty, x + _xx, y + _yy, 1, 1, 0, c_white, _fade);
 *         }
 *         with (obj_roaringknight_boxsplitter_attack) { timer--; local_turntimer++; }  // l.38-42 STATE
 *     }
 *
 * `exit` inside a `with` leaves the event, so while any OTHER slash holds a
 * strike this one draws nothing — its telegraph vanishes for the strike's
 * length. The manager freeze at l.38-42 is modelled in
 * flurry-splitslash.js endStep (with this same gate); nothing here writes.
 *
 * `_growtangle` is the MANAGER's `growtangle` variable: the obj_growtangle
 * OBJECT until the first cut (so the first instance's position — the battle
 * box), the organism INSTANCE after it (splitslash Step_0:98-101). The
 * module carries that as `splitterRef` (null = the box); with no manager
 * alive the GML would error, and the organism-then-box lookup the vanilla
 * drawTelegraph used stands in.
 *
 * THE SOUL COPY. `draw_sprite` takes no tint or alpha of its own; the
 * sprite is obj_heart's spr_dodgeheart (objects_kaizo.csv; the Side-B
 * vertical splitter swaps the MASK, not the sprite). Its `image_index` is 0
 * on every striking frame BY DERIVATION, not read from the sim: Other_15:8
 * sets `global.inv = -1` at the strike and obj_heart Step_0:249-258 then
 * runs `global.inv -= 1; if (global.inv > 0) image_speed = 0.25; else {
 * image_speed = 0; image_index = 0; }` every frame until the hurt frame
 * destroys this slash — so the value is pinned. The sim's soul carries a
 * free-running frame counter in `image_index` (its Step never pins it; the
 * vanilla soul draw in render/canvas.js ignores it and blits frame 0 too),
 * and spr_dodgeheart's frame 1 is a different picture (188 differing
 * bytes), so reading it would be wrong. `other.cuty` (1..14 of the slice's
 * 18 frames) is the module's `cuty`. The jitter is frame-seeded (the rule
 * above); `remap_clamped(45, 55, 1, 0, timer)` reads the kaizo module's
 * NON-monotonic timer as-is.
 *
 * Not fixable from here, reported: render/canvas.js draws the soul itself
 * every frame regardless of `image_alpha`, so during a strike the kaizo page
 * still shows the steady soul under this jittered copy — the exact double
 * the GML's `obj_heart.image_alpha = 0` (Other_15:7) exists to prevent.
 */
export function drawObjRoaringknightSplitslash(ctx, e, state, helpers) {
  // Draw_0:1-11 — another slash's strike suppresses this whole Draw.
  for (const s of state.entities) {
    if (s.alive && s !== e && s.type.name === 'obj_roaringknight_splitslash' && s.playerstrike) {
      return true;
    }
  }
  const { sprites } = helpers;

  if (e.slash) {
    helpers.drawSelf(e, state); // Draw_0:14 draw_self()
  } else {
    // Draw_0:18-26 — the screen-wide additive bar spinning into place.
    const px = sprites.get('spr_pxwhite10_center');
    const mg = findAlive(state, 'obj_roaringknight_boxsplitter_attack');
    const growtangle = mg
      ? (mg.splitterRef && mg.splitterRef.alive ? mg.splitterRef : findAlive(state, 'obj_growtangle'))
      : (findAlive(state, 'obj_knight_split_growtangle') ?? findAlive(state, 'obj_growtangle'));
    if (px && growtangle) {
      const ease = scrEaseOut(clamp01((e.timer ?? 0) / 30), 3);
      const spin = (ease * 15 - 15) * (e.flip ?? 1);
      const size = lerp(4, 0, ease);
      const length = ease * 180;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; // gpu_set_blendmode(bm_add)
      drawSpriteExt(ctx, px, 0, growtangle.x + (e.xoffset ?? 0), growtangle.y + (e.yoffset ?? 0),
        length, size, spin + (e.image_angle ?? 0) + (e.angleoffset ?? 0), SPLITSLASH_BACKING, 1);
      ctx.restore();                             // gpu_set_blendmode(bm_normal)
    }
  }

  // Draw_0:28-37 — the strike: the soul, redrawn by the slash with the slice
  // over it. (`playerstrike == 1`: the module stores 1 / 0 / false.)
  if (e.playerstrike === 1 || e.playerstrike === true) {
    const heart = state.soul;
    if (heart && heart.alive !== false) {
      const frame = state.frame ?? 0;
      // The slash's draw slot drew the pair on the stream (flurry-splitslash.js
      // draw(), strikeJitter); the frame-seeded pair is the fallback for a
      // state that carries none.
      const dx = e.strikeJitter ? e.strikeJitter.xx : irandomFrame(helpers.frandCanvas, frame, 0x51a5 + e.seq * 2 + 1, 2) - 1;
      const dy = e.strikeJitter ? e.strikeJitter.yy : irandomFrame(helpers.frandCanvas, frame, 0x51a5 + e.seq * 2 + 2, 2) - 1;
      const fade = remapClamped(45, 55, 1, 0, e.timer ?? 0);
      // obj_heart's `sprite_index`. The sim's soul carries none (sim/soul.js
      // never assigns one), so this is spr_dodgeheart; a name the manifest
      // lacks falls back to the object definition's sprite the way the
      // vanilla drawSplitslashStrike does, rather than dropping the copy.
      const hs = sprites.get(heart.sprite_index) ?? sprites.get('spr_dodgeheart');
      if (hs) drawSpriteExt(ctx, hs, 0, heart.x + dx, heart.y + dy, 1, 1, 0, null, 1);
      const slice = sprites.get('spr_rk_slash_heartslice');
      // c_white multiplies to itself — passed as "no tint" to skip the bake.
      if (slice) drawSpriteExt(ctx, slice, e.cuty ?? 1, heart.x + dx, heart.y + dy, 1, 1, 0, null, fade);
    }
    // Draw_0:38-42 `with (manager) { timer--; local_turntimer++; }` — STATE,
    // flurry-splitslash.js endStep. The renderer writes nothing.
  }
  return true;
}

// ── obj_roaringknight_split_bullet ─────────────────────────────────────────

/**
 * obj_roaringknight_split_bullet — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: NO DRAW_EVENTS entry — the generic blit, but with the
 * tooth's own Draw already folded in: `image_xscale + random_range(-0.1,
 * 0.1)` on both axes, reinstated as `frandCanvas(state.frame, seq)` so it is
 * a pure function of the sim frame (render/canvas.js drawEntity, "THE SPLIT
 * TEETH PULSE"); TOOTH_MASK is the fallback shape. A port keeps that rule:
 * the kaizo Draw's random_range must NOT be advanced per paint and must NOT
 * be added to the sim's stream — `helpers.frandCanvas(frame, salt)`.
 * Sim side: kaizo/attacks/flurry-split-bullet.js.
 *
 * PORTED 2026-09-01 — kaizo Draw_0 is 25 lines and 24 of them are STATE:
 *
 *     image_index = floor(scr_ease_in(anim_timer, 2) * image_number);   // l.1-5  module step
 *     if (anim_timer < 1) anim_timer += 0.1;
 *     if (fade_over == false) image_blend = merge_color(... , coltimer / 40 | 30);  // l.6-24 NEW,
 *     if (image_blend == c_white) fade_over = true;                                //   module endStep
 *     if (fade_over == true) image_blend = c_white;
 *     draw_sprite_ext(sprite_index, image_index, x, y,                  // l.25 — THE DRAW,
 *                     image_xscale + random_range(-0.1, 0.1),           //   byte-identical to
 *                     image_yscale + random_range(-0.1, 0.1),           //   vanilla Draw_0:6
 *                     image_angle, image_blend, image_alpha);
 *
 * flurry-split-bullet.js carries every variable the draw reads (the anim
 * pair in step, the tint ramp and its latch in endStep — its header says
 * why endStep), so the one draw call is exactly what render/canvas.js
 * drawEntity's split-tooth branch issues: sprite_index, floored image_index,
 * the two frame-seeded scale jitters, image_angle, image_blend (the mod's
 * blue-to-white ramp, an [r,g,b] on the instance) and image_alpha (the d2+
 * close fade's lerpvar). `helpers.drawSelf` IS that branch; reused rather
 * than re-typed so the jitter stays the one generator the vanilla page uses.
 *
 * RECHECKED 2026-09-02 — TWO KINDS OF TOOTH REACH THIS OVERRIDE. The mod has
 * one obj_roaringknight_split_bullet; the kaizo page has two sim types with
 * that name. Flurry's cut spawns the kaizo type above (flurry-split-
 * growtangle.js -> flurry-split-bullet.js) and everything the paragraph
 * above says holds, with the jitter now the STREAM's (`drawJitterXs/Ys`
 * from its draw slot, read by drawEntity). The quickslash_big cut of the
 * rotating slash spawns the VANILLA organism (kaizo/attacks/quickslash.js
 * l.104/532/548 -> sim/attacks/split-growtangle.js -> sim/attacks/
 * split-bullet.js): those teeth carry no `coltimer`, no `fade_over`, no
 * `image_blend` and no draw slot. MEASURED (scratch probe, V-C seed 12345,
 * 10,000 frames, the kaizo smoke's pulse feed and HP pin): 752 of 22,413
 * tooth draws were that kind — one Quickslash cut, 13 teeth, every frame
 * with obj_roaringknight_quickslash_attack alive — and helpers.drawSelf
 * drew them WHITE, where the mod's Draw_0:6-24 paints them the sword colour
 * cooling to white over 40 frames.
 *
 * What this override does about it: for a tooth with no `coltimer` the
 * ramp is DERIVED, statelessly, from what the sim does carry. `coltimer` is
 * the number of Steps since Create (kaizo Create_0:16 `coltimer = 0`,
 * Step_0:12 `coltimer += 1`, read in Draw after Step) and the renderer
 * draws after endStep with `state.frame` already advanced (sim/index.js,
 * `state.frame += 1` at the end of stepFrame), so on every kaizo tooth
 * `coltimer === state.frame - bornFrame - 1` (MEASURED: 20,909 of 20,909
 * draws); the vanilla tooth gets the same expression. The branch
 * (`i_ex(obj_roaringknight_quickslash_attack)`, l.8) is read per frame
 * exactly as the GML reads it. The `fade_over` latch (l.17-23) is the
 * ramp's own monotonic end — merge_color reaches c_white at coltimer 40 /
 * 30 and mergeColor's clamp holds it there — so the stateless read gives
 * the game's colour on every frame but the one edge the latch exists for:
 * a branch switch AFTER white would re-open the ramp here and not in the
 * game, which needs the quickslash attack created mid-flight, and the
 * rotating slash creates it before its first cut. Nothing here writes; the
 * derived tint reaches drawSelf through a prototype-chained view of the
 * entity (its f32 accessors read through the chain — sim/entity.js
 * installF32Builtins closes over its store), so the blit, the frame-seeded
 * jitter fallback and the mask fallback stay the one code path in
 * render/canvas.js. NOT done here, reported: the Draw's `random_range` pair
 * for these teeth is not on the stream (no draw slot on the vanilla type;
 * sim/ is not this seam's to edit), and the vanilla organism's mechanics
 * are not the mod's — making quickslash_big spawn the kaizo organism is the
 * attack layer's decision, since it moves the stream.
 */
export function drawObjRoaringknightSplitBullet(ctx, e, state, helpers) {
  if (e.coltimer === undefined) {
    // A vanilla-typed tooth: kaizo Draw_0:6-24, derived (see above).
    const frame = state.frame ?? 0;
    const coltimer = Math.max(0, frame - (e.bornFrame ?? frame) - 1);
    const quickslash = state.entities.some(
      (s) => s.alive && s.type.name === 'obj_roaringknight_quickslash_attack',
    );
    const blend = quickslash
      ? mergeColor(getSwordcolor(state), WHITE, coltimer / 40)   // l.8-10
      : mergeColor(KAIZO_TELEGRAPH_COLOR, WHITE, coltimer / 30); // l.12-14
    // l.17-23: `== c_white` latches c_white — mergeColor's clamp is that value.
    helpers.drawSelf(Object.create(e, { image_blend: { value: blend } }), state); // Draw_0:25
    return true;
  }
  helpers.drawSelf(e, state); // Draw_0:25
  return true;
}

// ── obj_knight_split_growtangle_effect ─────────────────────────────────────

/**
 * `surf` — one snapshot per effect instance, taken on its first drawn frame
 * (`surface_copy(surf, 0, 0, application_surface)` under
 * `if (!surface_exists(surf))`, kaizo effect Draw_0:1-7). A render resource
 * like the surface it stands in for, not sim state: the picture is the
 * canvas as it stands at this object's depth, which only the renderer has.
 * WeakMap-keyed so it dies with the instance, exactly as the vanilla
 * splitcut.js keeps its own.
 */
const snapshots = new WeakMap();

/**
 * obj_knight_split_growtangle_effect — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/splitcut.js drawSplitCut — the box halves
 * peeling apart, a one-shot snapshot of the whole screen cut in two, and the
 * two white flash bars; returns true. The snapshot is taken on the effect's
 * first drawn frame (a per-entity WeakMap), which a port has to keep to.
 * Sim side: sim/fx.js (kaizo spawns the vanilla type; the kaizo box is
 * kaizo/attacks/flurry-split-growtangle.js / split-growtangle-vertical.js).
 *
 * PORTED 2026-09-01 — kaizo Draw_0, in order:
 *
 *     if (!surface_exists(surf)) {                          // l.1-7 once
 *         surf = surface_create(640, 480);
 *         surface_copy(surf, 0, 0, application_surface);
 *         xmul = lengthdir_x(1, angle);  ymul = lengthdir_y(1, angle);
 *     }
 *     timer++;                                              // l.8  sim/fx.js endStep
 *     var _fade   = (10 - timer) / 10;
 *     var _htimer = (vertical ? 0 : timer) * xmul;
 *     var _vtimer = (vertical ? timer : 0) * ymul;
 *     var _splitwidth = sprite_width;  var _splitheight = sprite_height;
 *     var _splitleft = 0;  var _splittop = 0;
 *     if (vertical) { _splitleft = sprite_width / 2;  _splitwidth /= 2; }
 *     else          { _splittop = sprite_height / 2;  _splitheight /= 2; }
 *     draw_sprite_part_ext_rot(sprite_index, 0, 0, 0, _splitwidth, _splitheight,        // l.26-28
 *         x - (_htimer * 8|6|4), y - (_vtimer * 8|6|4), image_xscale, image_yscale, 0, image_blend, clamp01(_fade) | clamp01(_fade) | _fade);
 *     draw_sprite_part_ext_rot(sprite_index, 0, _splitleft, _splittop, _splitwidth, _splitheight,  // l.29-31
 *         x + (_htimer * 8|6|4), y + (_vtimer * 8|6|4), image_xscale, image_yscale, 0, image_blend, clamp01(_fade) | clamp01(_fade) | _fade);
 *     var _sx = screenx();  var _sy = screeny();            // x - camerax(), y - cameray()
 *     if (vertical) {                                       // l.34-38
 *         draw_surface_part_ext(surf, 0, 0, _sx, 480,       camerax(), cameray() - (timer * 8), 1, 1, c_white, _fade / 2);
 *         draw_surface_part_ext(surf, 0, 0, 640 - _sx, 480, x,         cameray() + (timer * 8), 1, 1, c_white, _fade / 2);  // KAIZO l.37: left 0 (vanilla: _sx)
 *     } else {                                              // l.39-43
 *         draw_surface_part_ext(surf, 0, 0,   640, _sy,       camerax() - (timer * 8), cameray(), 1, 1, c_white, _fade / 2);
 *         draw_surface_part_ext(surf, 0, _sy, 640, 480 - _sy, camerax() + (timer * 8), y,         1, 1, c_white, _fade / 2);
 *     }
 *     draw_set_color(c_white);                              // l.44 leaks nothing a canvas reads
 *     var _angle = angle;  if (vertical) _angle += 90;  if (diagonal) _angle += 45;
 *     draw_sprite_ext(spr_pxwhite10_center, 0, x + xoffset, y + yoffset, 50, _fade,       _angle, c_white, 1);    // l.54
 *     draw_sprite_ext(spr_pxwhite10_center, 0, x + xoffset, y + yoffset, 50, _fade * 1.4, _angle, c_white, 0.5);  // l.55
 *     if (timer == 10) instance_destroy();                  // l.56-59 sim/fx.js endStep
 *
 * `xmul`/`ymul` are assigned once from `angle`, and `angle` is written only
 * at spawn (the organism's Step_0:40), so recomputing them per frame is the
 * same value — no Draw-time state to add. AND `angle` IS THE WOBBLE ALONE:
 * the organism's `angle` is the slash's `angleoffset` (kaizo splitslash
 * Step_0:110 `_splitter.angle = angleoffset`, +-2 in the mod), never the
 * cut's direction — the vertical case adds its 90 only for the flash bar
 * (l.46-48). So a VERTICAL cut has `ymul = lengthdir_y(1, +-2)` ~ 0 and its
 * six box halves stay put while the two screen halves shear by `timer * 8`;
 * a HORIZONTAL cut has `xmul` ~ 1 and its halves slide 8/6/4 px a frame.
 * MEASURED (the probe in the header): 27 effects, every |angle| <= 2; for
 * the box at (320, 170) scale 2 the vertical halves sat at x 246..321 and
 * 321..396 on every frame (offset under 0.3 px), the horizontal ones at
 * x - 74 -/+ 8 * timer. That asymmetry is the game's arithmetic, not a
 * port artefact. `sprite_width` is the sprite's
 * width times image_xscale (75 * 2 for spr_battlebg_0 at the box's scale;
 * the sprite is the organism's, which is the object definition's
 * spr_battlebg_0 — objects_kaizo.csv — carried on the spawn). The six halves
 * are tinted with `image_blend`, the box's green, and the second three land
 * at the split offset through draw_sprite_part_ext_rot's signed extents —
 * both documented on the primitives above and both things the vanilla
 * splitcut.js did not do.
 *
 * THE MOD'S ONE HUNK is l.37: the vertical cut's right-hand screen piece
 * reads the snapshot from column 0 instead of `_sx`, so the right side of
 * the screen slides away carrying the LEFT side of the picture. Whether that
 * is intent or a typo is not this port's call; it is what the mod draws.
 *
 * DEPTH: the organism creates this at `depth - 100` (kaizo organism
 * Step_0:44, vanilla-identical) — the sim's spawn left it at the default
 * and it now rides flurry-split-growtangle.js. That is what puts the
 * snapshot late enough to hold the teeth and the flames: `surface_copy`
 * copies the frame AS IT STANDS at this object's depth.
 *
 * Not fixable from here, reported: the snapshot never holds the SOUL.
 * render/canvas.js draws the soul after the whole depth pass ("Soul last so
 * a bullet never hides it"), so at this object's turn in the pass it is not
 * on the canvas yet — where the game's obj_heart sits at depth 0 (object
 * definition), above -100, and its `surface_copy` carries the heart into
 * both sliding halves. The vanilla splitcut.js has the same gap; closing it
 * is a canvas.js decision (draw the soul at its depth), not this family's.
 */
export function drawObjKnightSplitGrowtangleEffect(ctx, e, state, helpers) {
  const { sprites } = helpers;

  // Draw_0:1-7 — the one-shot snapshot of the application surface.
  let snap = snapshots.get(e);
  if (!snap) {
    snap = makeSurface(VIEW_W, VIEW_H);
    snap.g.drawImage(ctx.canvas, 0, 0);
    snapshots.set(e, snap);
  }
  const angle = e.angle ?? 0;
  const xmul = ldx(1, angle);
  const ymul = ldy(1, angle);

  const timer = e.timer ?? 0;
  const fade = (10 - timer) / 10;
  const htimer = (e.vertical ? 0 : timer) * xmul;
  const vtimer = (e.vertical ? timer : 0) * ymul;

  // Draw_0:12-31 — the box halves, peeling apart along the cut normal.
  const entry = sprites.get(e.sprite_index ?? 'spr_battlebg_0');
  const xs = e.image_xscale ?? 1;
  const ys = e.image_yscale ?? 1;
  if (entry && entry.frames && entry.frames.length) {
    const spriteWidth = (entry.meta?.w ?? entry.frames[0].width) * xs;   // sprite_width
    const spriteHeight = (entry.meta?.h ?? entry.frames[0].height) * ys; // sprite_height
    let splitwidth = spriteWidth;
    let splitheight = spriteHeight;
    let splitleft = 0;
    let splittop = 0;
    if (e.vertical) {
      splitleft = spriteWidth / 2;
      splitwidth /= 2;
    } else {
      splittop = spriteHeight / 2;
      splitheight /= 2;
    }
    const blend = asColor(e.image_blend);
    const part = (left, top, mul, alpha) => drawSpritePartExtRot(ctx, entry, 0,
      left, top, splitwidth, splitheight,
      e.x + htimer * mul, e.y + vtimer * mul, xs, ys, 0, blend, alpha);
    part(0, 0, -8, clamp01(fade));                    // l.26
    part(0, 0, -6, clamp01(fade));                    // l.27
    part(0, 0, -4, fade);                             // l.28 (unclamped in the GML)
    part(splitleft, splittop, 8, clamp01(fade));      // l.29
    part(splitleft, splittop, 6, clamp01(fade));      // l.30
    part(splitleft, splittop, 4, fade);               // l.31 (unclamped in the GML)
  }

  // Draw_0:32-43 — the screen itself, cut in two. camerax()/cameray() are
  // the view (the ctx is already translated by it, so world = view + screen).
  const camx = state.view?.x ?? 0;
  const camy = state.view?.y ?? 0;
  const sx = e.x - camx; // screenx()
  const sy = e.y - camy; // screeny()
  ctx.save();
  ctx.globalAlpha = clamp01(fade / 2);
  if (e.vertical) {
    drawSurfacePart(ctx, snap.c, 0, 0, sx, VIEW_H, camx, camy - timer * 8);
    // KAIZO l.37 — source left 0 where vanilla reads from `_sx`.
    drawSurfacePart(ctx, snap.c, 0, 0, VIEW_W - sx, VIEW_H, e.x, camy + timer * 8);
  } else {
    drawSurfacePart(ctx, snap.c, 0, 0, VIEW_W, sy, camx - timer * 8, camy);
    drawSurfacePart(ctx, snap.c, 0, sy, VIEW_W, VIEW_H - sy, camx + timer * 8, e.y);
  }
  ctx.restore();

  // Draw_0:44-55 — the flash along the cut line. c_white is an identity
  // multiply, passed as "no tint".
  const px = sprites.get('spr_pxwhite10_center');
  if (px) {
    let a = angle;
    if (e.vertical) a += 90;
    if (e.diagonal) a += 45;
    const fx = e.x + (e.xoffset ?? 0);
    const fy = e.y + (e.yoffset ?? 0);
    drawSpriteExt(ctx, px, 0, fx, fy, 50, fade, a, null, 1);
    drawSpriteExt(ctx, px, 0, fx, fy, 50, fade * 1.4, a, null, 0.5);
  }
  // Draw_0:56-59 `if (timer == 10) instance_destroy();` — sim/fx.js endStep.
  return true;
}
