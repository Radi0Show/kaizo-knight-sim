// KAIZO DRAW — the ROARING family. STUBS: every export delegates to the
// vanilla drawer through `helpers.drawVanilla`, so these objects render on
// the kaizo page exactly as they do on the main page until each is ported.
//
// Contract and helpers: kaizo/render/index.js. The vanilla model is
// render/draw/roaring.js (the star surface, the deferred full-camera cover,
// the screen cut) and render/draw/slash.js (the tapering wedge).
//
// The kaizo GML (read-only, never copied here):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/gml_Object_<obj>_Draw_0.gml
// diffed against gml_vanilla_v105/CodeEntries/.
//
// ── PORT STATUS (2026-09-01) ──────────────────────────────────────────────
// The header above is the stub-era one, kept whole. BOTH exports below are
// now full ports of the KAIZO Draw events, call for call, in the GML's order:
//
//   obj_knight_roaring2      Draw_0 (365 lines) + Other_22 (the party HP HUD
//                            it reaches through `event_user(12)` at 362-364)
//   obj_roaringknight_slash  Draw_0 (15 lines)
//
// WHAT THE MOD CHANGED (the diff against v105, and nothing else):
//   roaring2 Draw_0
//     132-173  the hsv walk is split three ways: roaring_type 0 bounces
//              128..288 as vanilla; roaring_type 1 bounces unless B-Side,
//              where it ramps forever. BOOKKEEPING — the sim carries it
//              (kaizo/attacks/roaring-final.js finaleDrawBookkeeping / endStep).
//     174-185  the B-Side vortex colour: a 5-entry table indexed by
//              `hsv % 300` instead of make_color_hsv, then 20% toward white.
//     194-197  obj_afterimage_grow ghosts draw with THEIR image_blend and
//              only when `target != -1` (vanilla: always, c_white).
//     203      `color =` reassigns the var (vanilla redeclares). No change.
//     219-258  `fix_draw`: the final slash's render path replaces the
//              scanline knight — the knight at `2 * final_xs` with the
//              sprite's origin, then the 30 final lines with an 8-copy dark
//              red outline, then the lines themselves and their targeted
//              grow-ghosts.
//     362-364  `if (hp_visible) event_user(12)` — the HP HUD (Other_22, NEW).
//   roaring_star Other_11:28 (the roar draws its stars through event_user, so
//              the star's user events ARE part of this Draw): the charging
//              colour is merge_color(c_white, #86A2FF, t) — vanilla merged
//              c_gray -> c_red. Other_10 is identical.
//   slash Draw_0:5  `make_color_rgb(0, 0, 255)` — a constant pure BLUE; the
//              vanilla wedge bleached red -> white with image_alpha.
//
// EVERYTHING ELSE IS BYTE-IDENTICAL TO VANILLA and is translated here the
// way render/draw/roaring.js translates it (that file is the model, and its
// measured deviations are mirrored, each cited at its site): the vortex's
// multiply rings, the grate's colour-only write as a source-atop black, the
// row-by-row sine wobble, the -63 degree marker, the deferred full-camera
// cover over the menu, and the screen cut. None of the vanilla drawer's
// helpers are exported, so they are re-implemented locally — see
// "neededPrimitives" in the port report.
//
// STATE THIS DRAW READS THAT THE SIM DID NOT CARRY, added to
// kaizo/attacks/roaring-final.js as Draw-time state (each cited there):
//   * Draw_0:208 `knight_sprite_image += knight_sprite_speed` in FINAL mode
//     (the vanilla-mode step already does it) — the engine's draw slot.
//   * Draw_0:31-39/132-173/208-216 were advanced TWICE a frame in final mode
//     (finaleDrawBookkeeping AND the copied vanilla endStep) — guarded.
//   * Other_11:631 `visible = false` on each final slash line — the lines
//     reach the screen ONLY through this Draw's with-blocks.
//
// STATE WRITES IN THE DRAW THAT ARE NOT MODELLED (reported, not added — they
// change gameplay, not just pixels): Draw_0:114-122, the roar's starchild
// fade `image_alpha = clamp01(remap(45, 60, 1, 0, timer))`, `active = false`
// below 1 and instance_destroy at 0. The sim's starchild lives by its own
// lifetime; the draw below uses the alpha the sim carries.
//
// NO RNG. Neither Draw calls random()/irandom()/choose(); nothing here is
// seeded from state.frame because nothing needs to be.

import {
  drawSpriteExt, drawBeamColor, mergeColor, clamp01, tinted, pingpong, ldx, ldy,
  c_white, c_black, c_red,
} from '../../../render/draw/gm.js';
import { screenCut } from '../../../render/draw/roaring.js';
import { FONTS, drawSpriteText } from '../../../render/text.js';
import { PARTY } from '../../../sim/damage.js';
import { charIdOf } from '../../party/roster.js';
import {
  kaizoCharboxGloom, kaizoGloomBarSegment, kaizoSideb, KAIZO_GLOOM_COLOR,
} from '../../party/gloom.js';
import { KAIZO_TELEGRAPH_COLOR } from '../../attacks/kaizo-colors.js';

/** camerawidth() / cameraheight() — every surface in the Draw is this size. */
const W = 640;
const H = 480;

// GAMEMAKER COLOURS ARE BGR (kaizo/attacks/kaizo-colors.js). The dump's
// decimal constants, decoded once, with the originals kept beside them:
/** c_dkgray — 4210752 = $404040. */
const C_DKGRAY = [64, 64, 64];
/** c_maroon — 128 = $000080: R 128. */
const C_MAROON = [128, 0, 0];
/** c_aqua — 16776960 = $FFFF00: B 255, G 255, R 0. */
const C_AQUA = [0, 255, 255];
/** c_fuchsia — 16711935 = $FF00FF. */
const C_FUCHSIA = [255, 0, 255];
/** c_lime — 65280 = $00FF00. */
const C_LIME = [0, 255, 0];
/** c_yellow — 65535 = $00FFFF: B 0, G 255, R 255. */
const C_YELLOW = [255, 255, 0];
/** c_purple — 8388736 = $800080. */
const C_PURPLE = [128, 0, 128];
/** c_teal — 8421376 = $808000: B 128, G 128, R 0. */
const C_TEAL = [0, 128, 128];
/** c_blue — 16711680 = $FF0000: B 255. */
const C_BLUE = [0, 0, 255];
/** `255` — $0000FF: R 255. The HUD's zero-HP number (Other_22:36). */
const C_RED_CSS = [255, 0, 0];

/**
 * Draw_0:178 — the B-Side vortex ramp:
 *
 *     _col_array = [8421376, 16711680, 16776960,
 *                   merge_color(c_fuchsia, c_purple, 0.4), 8421376];
 *
 * teal -> blue -> aqua -> a dimmed fuchsia -> teal, so `hsv % 300` walks a
 * closed loop. Built once; merge_color rounds per channel (gm.js).
 */
const SIDEB_VORTEX = [C_TEAL, C_BLUE, C_AQUA, mergeColor(C_FUCHSIA, C_PURPLE, 0.4), C_TEAL];

/**
 * Other_22:16 `_charicon = [3665, 2847, 2849, 2848, 2851]`, indexed by the
 * CHARACTER id (global.char[slot]); index 0 is padding. Resolved from
 * knight-research/kaizo-mod/sprites/sprites_kaizo.csv (row = id + 2):
 * spr_nothing, spr_headkris, spr_headsusie, spr_headralsei, spr_headnoelle.
 * spr_headnoelle is NOT in assets/sprites/manifest.json (reported).
 */
const CHAR_ICON = ['spr_nothing', 'spr_headkris', 'spr_headsusie', 'spr_headralsei', 'spr_headnoelle'];
/** obj_darkcontroller Create_0:157-160 `hpcolor[0..3]` — c_aqua, c_fuchsia, c_lime, c_yellow. */
const HPCOLOR = [C_AQUA, C_FUCHSIA, C_LIME, C_YELLOW];

/**
 * Draw_0:229-236 — the EIGHT outline copies of each final line, in the GML's
 * order. `(-2, +2)` appears TWICE (lines 233 and 234); the duplicate is kept
 * because it is what the mod draws (a second copy at the same offset adds a
 * second layer of alpha there).
 */
const LINE_OUTLINE_OFFSETS = [[0, 2], [2, 0], [2, 2], [-2, -2], [-2, 2], [-2, 2], [0, -2], [-2, 0]];

const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** GML `image_blend == c_white`: an UNSET blend is c_white (the built-in's default). */
function isWhite(b) {
  return b == null || (Array.isArray(b) && b[0] === 255 && b[1] === 255 && b[2] === 255);
}
/** GML `image_blend == c_dkgray`. */
function isDkgray(b) {
  return Array.isArray(b) && b[0] === 64 && b[1] === 64 && b[2] === 64;
}
/**
 * A draw colour for gm.js: c_white MULTIPLIES to identity, so it is passed as
 * null (no tinted copy); anything else is the [r,g,b] the sim carries.
 */
const blendOrNull = (b) => (isWhite(b) ? null : b);

/** `with (obj_x)` — the sim's model of GameMaker's iteration order: NEWEST FIRST (sim/attacks/roaring.js starsNewestFirst). */
function withBlock(state, name) {
  return state.entities
    .filter((x) => x.alive && x.type.name === name)
    .sort((a, b) => b.seq - a.seq);
}

// ── the surfaces (Draw_0:1-16, created on first use as the GML does) ─────
const surfaces = {};
function surf(key, w = W, h = H) {
  let c = surfaces[key];
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    surfaces[key] = c;
  }
  return c;
}

/**
 * GML `make_color_hsv(h, s, v)` — h/s/v are 0..255, not 0..360. Local copy of
 * render/draw/roaring.js makeColorHsv (not exported there).
 */
function makeColorHsv(h, s, v) {
  const hh = ((h / 255) * 6) % 6;
  const ss = s / 255;
  const vv = v / 255;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = vv * (1 - ss);
  const q = vv * (1 - ss * f);
  const t = vv * (1 - ss * (1 - f));
  const map = [[vv, t, p], [q, vv, p], [p, vv, t], [p, q, vv], [t, p, vv], [vv, p, q]];
  const c = map[i % 6];
  return [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];
}

/**
 * `make_color_rgb(r, g, b)` on the lerped reals r/g/b (Draw_0:203). The
 * runner's real -> byte conversion is not measured; Math.round mirrors
 * render/draw/roaring.js so the two pages agree to the last bit.
 */
function makeColorRgb(r, g, b) {
  return [Math.round(r), Math.round(g), Math.round(b)];
}

/** `draw_sprite_tiled(spr, sub, x, y)` — repeats the frame over the surface (Draw_0:24/28). */
function drawTiled(g, entry, sub, x, y) {
  if (!entry || !entry.frames.length) return;
  const img = entry.frames[sub % entry.frames.length];
  if (!img) return;
  const tw = img.width;
  const th = img.height;
  let ox = x % tw;
  if (ox > 0) ox -= tw;
  let oy = y % th;
  if (oy > 0) oy -= th;
  for (let py = oy; py < H; py += th) {
    for (let px = ox; px < W; px += tw) g.drawImage(img, px, py, tw, th);
  }
}

/**
 * `scr_draw_outline_ext(spr, sub, x, y, xs, ys, angle, col, alpha, dist)` —
 * gml_GlobalScript (contents grep): `gpu_set_fog(true, col, 0, 0)` and FOUR
 * copies of the sprite offset by `dist` along the axes (rotated with the
 * angle when it is not a multiple of 90). Fog REPLACES every pixel with the
 * colour and keeps the alpha — gm.js `fogged`, not `tinted` (a white tint of
 * dark art is a silent no-op; a white fog is a silhouette).
 */
function drawOutlineExt(g, entry, sub, x, y, xs, ys, angle, color, alpha, dist) {
  let xA = dist;
  let xB = 0;
  let yA = 0;
  let yB = dist;
  if (angle % 90 !== 0) {
    xA = ldx(dist, angle);
    xB = ldx(dist, angle + 90);
    yA = ldy(dist, angle + 90);
    yB = ldy(dist, angle);
  }
  drawSpriteExt(g, entry, sub, x + xA, y + yA, xs, ys, angle, color, alpha, true);
  drawSpriteExt(g, entry, sub, x - xA, y - yA, xs, ys, angle, color, alpha, true);
  drawSpriteExt(g, entry, sub, x + xB, y + yB, xs, ys, angle, color, alpha, true);
  drawSpriteExt(g, entry, sub, x - xB, y - yB, xs, ys, angle, color, alpha, true);
}

/**
 * obj_knight_roaring_star's KAIZO Other_10 (event_user(0)) and Other_11
 * (event_user(1)) — what Draw_0:58-106 call on every star, three passes.
 * Other_10 is identical to vanilla; Other_11 differs at ONE line (28), the
 * charging colour. Positions are room coordinates: the star surface is
 * translated by the camera once, so `screenx()` is `x` here.
 */
function drawRoaringStar(g, e, sprites, userEvent) {
  const entry = sprites.get(e.sprite_index);
  if (!entry || !entry.frames.length) return;
  const top = sprites.get('spr_knight_bullet_star_top') ?? entry;
  const bottom = sprites.get('spr_knight_bullet_star_bottom') ?? entry;
  // Other_10:1-2 / Other_11:1-2 — `(sprite_width + 16) / sprite_get_width(...)`:
  // sprite_width is the SCALED width, so this is image_xscale + 16 / w.
  const xs = e.image_xscale + 16 / entry.frames[0].width;
  const ys = e.image_yscale + 16 / entry.frames[0].height;
  const split = e.split ?? 0;
  const ease = e.splitease ?? 0;
  const tx = e.x + ease / 2;
  const ty = e.y + ease;
  const bx = e.x - ease / 2;
  const by = e.y - ease;

  if (userEvent === 0) {
    // Other_10:3-11 — whole star, or the two halves peeling apart by splitease.
    if (split < 2) {
      drawSpriteExt(g, entry, 0, e.x, e.y, xs, ys, e.image_angle, blendOrNull(e.image_blend), e.image_alpha);
    } else {
      drawSpriteExt(g, top, 0, tx, ty, xs, ys, e.image_angle, blendOrNull(e.image_blend), e.image_alpha);
      drawSpriteExt(g, bottom, 0, bx, by, xs, ys, e.image_angle, blendOrNull(e.image_blend), e.image_alpha);
    }
    return;
  }

  // Other_11:3 — the strobe every charging layer reads.
  const alpha = (Math.sin(e.timer * 3) + 1) * 0.25;
  // Other_11:8-25 — six additive beams, alternating top/bottom halves.
  if (e.con === 2 || e.con === 2.5 || e.con === 3) {
    let a = 1;
    let length = 120;
    if (e.con === 2) {
      a = clamp01(e.timer / 30 - alpha);
      length = 50 * clamp01(e.timer / 30 - (e.timer % 2) * 0.75) + 50;
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    drawBeamColor(g, tx, ty, length, 10, 90, c_white, a);
    drawBeamColor(g, bx, by, length, 10, 156, c_white, a);
    drawBeamColor(g, tx, ty, length, 10, 24, c_white, a);
    drawBeamColor(g, bx, by, length, 10, 270, c_white, a);
    drawBeamColor(g, tx, ty, length, 10, 336, c_white, a);
    drawBeamColor(g, bx, by, length, 10, 204, c_white, a);
    g.restore();
  }
  // Other_11:26-36 — THE MOD'S LINE 28: `merge_color(c_white, #86A2FF,
  // clamp01(timer / 30))` — white to the mod's telegraph blue (the same
  // literal kaizo-colors.js carries), where vanilla merged c_gray -> c_red.
  if (e.con === 1 || e.con === 2 || e.con === 2.5) {
    const color = mergeColor(c_white, KAIZO_TELEGRAPH_COLOR, clamp01(e.timer / 30));
    drawSpriteExt(g, entry, 1, tx, ty, xs + 0.1, ys + 0.1, 0, null, alpha);
    drawSpriteExt(g, entry, 0, tx, ty, xs, ys, 0, color, 1);
    if (split >= 2) {
      drawSpriteExt(g, bottom, 1, bx, by, xs + 0.1, ys + 0.1, 0, null, alpha);
      drawSpriteExt(g, bottom, 0, bx, by, xs, ys, 0, color, 1);
    }
  }
  // Other_11:37-46 — the armed frame, strobing faster.
  if (e.con === 3 || e.con === 4) {
    const s = (Math.sin(e.timer * 6) + 1) * 0.25;
    drawSpriteExt(g, entry, 2, tx, ty, xs + 0.1, ys + 0.1, 0, null, s);
    drawSpriteExt(g, entry, 2, tx, ty, xs, ys, 0, null, 1);
    if (split >= 2) {
      drawSpriteExt(g, bottom, 2, bx, by, xs + 0.1, ys + 0.1, 0, null, s);
      drawSpriteExt(g, bottom, 2, bx, by, xs, ys, 0, null, 1);
    }
  }
}

/**
 * THE KNIGHT, one scanline at a time — Draw_0:261-278 (unchanged from
 * vanilla; the model is render/draw/roaring.js drawKnightRows, not exported).
 *
 * `draw_sprite_part_ext(knight_sprite, knight_sprite_image, bl, a, 70, 1, x,
 * y, 2, 2, image_blend, alpha)`: each row of the frame is a 70x1 strip from
 * bbox_left, blitted at double scale, x displaced by
 * `sin((a + time*4) * 0.2) * intensify * 0.3`. Above intensify 1.5 a second
 * pass (261-274) draws first, at 0.75 alpha, thrown `* 8` in ALTERNATING
 * directions per row parity.
 *
 * `y` is `fake_y + a*2 + sin(bobble_count*0.1)*bobble_amp - 10 - bt*2`.
 * `image_blend` is honoured (a tinted copy of the frame; the controller's
 * blend is never set by the sim, so this is the raw frame in practice).
 */
function drawKnightRows(g, entry, e, time, originX, originY) {
  if (!entry || !entry.frames.length) return;
  const n = entry.frames.length;
  const idx = ((Math.floor(e.knight_sprite_image ?? 0) % n) + n) % n;
  const frame = entry.frames[idx];
  if (!frame) return;
  const img = isWhite(e.image_blend) ? frame : tinted(frame, e.image_blend);
  // sprite_get_bbox_left / sprite_get_bbox_top (Draw_0:217-218)
  const bl = entry.meta.bbox ? entry.meta.bbox[0] : 0;
  const bt = entry.meta.bbox ? entry.meta.bbox[1] : 0;
  const h = frame.height; // sprite_get_height(knight_sprite)
  const bob = Math.sin(e.bobble_count * 0.1) * e.bobble_amp;
  const intensify = e.intensify ?? 0;
  const fakeAlpha = e.fake_alpha ?? 1;
  const rowY = (a) => originY + e.fake_y + a * 2 + bob - 10 - bt * 2;

  if (intensify > 1.5) {
    g.save();
    g.globalAlpha = clamp01(fakeAlpha * 0.75);
    for (let a = 0; a < h; a++) {
      const off = Math.sin((a + time * 4) * 0.15) * (intensify - 1.5) * 8;
      const x = a % 2 === 0
        ? originX + e.fake_x - 70 + off
        : originX + e.fake_x - 70 - off;
      g.drawImage(img, bl, a, 70, 1, x, rowY(a), 140, 2);
    }
    g.restore();
  }

  g.save();
  g.globalAlpha = clamp01(fakeAlpha);
  for (let a = 0; a < h; a++) {
    const x = originX + e.fake_x - 70 + Math.sin((a + time * 4) * 0.2) * intensify * 0.3;
    g.drawImage(img, bl, a, 70, 1, x, rowY(a), 140, 2);
  }
  g.restore();
}

/**
 * A FINAL SLASH LINE'S SPRITE, or its mask when the sprite is missing.
 *
 * `spr_roaringknight_finalslash_mask` is not in assets/sprites/manifest.json
 * (reported in missingSprites). The project's rule for a missing asset is
 * to degrade to the COLLISION MASK — exactly the shape the physics uses
 * (CLAUDE.md, "Sprites") — so a line whose sprite is absent is drawn from
 * `line.mask` (FINALSLASH_MASK, a solid centred 10x10), baked once per
 * colour. Baked in the colour directly rather than tinted: the mask is
 * solid white where set, so multiply-by-colour and fill-with-colour agree,
 * and a baked canvas has no `src` for gm.js's tint cache to key on.
 */
const maskEntries = new Map();
function maskEntry(mask, color, bakeMask) {
  const key = `${mask.name}|${color[0]},${color[1]},${color[2]}`;
  let en = maskEntries.get(key);
  if (!en) {
    const hex = `#${[color[0], color[1], color[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    en = {
      frames: [bakeMask(mask, hex)],
      meta: { ox: mask.originX, oy: mask.originY, w: mask.w, h: mask.h },
    };
    maskEntries.set(key, en);
  }
  return en;
}

/**
 * `draw_sprite_ext(sprite_index, image_index, x + dx, y + dy, image_xscale,
 * image_yscale, image_angle, color, image_alpha)` for one final line — the
 * shape of every call in Draw_0:229-236 and of the line's `draw_self()` at
 * 247 (colour = its own image_blend). Line positions are SCREEN space
 * (irandom(639) / irandom(419), kaizo/attacks/roaring-final.js
 * finalSlashLine) and my_surface is screen space, so they are used raw.
 */
function drawLineSprite(g, line, dx, dy, color, sprites, helpers) {
  const alpha = line.image_alpha ?? 1;
  const entry = sprites.get(line.sprite_index);
  if (entry && entry.frames.length) {
    drawSpriteExt(g, entry, line.image_index ?? 0, line.x + dx, line.y + dy,
      line.image_xscale, line.image_yscale, line.image_angle, blendOrNull(color), alpha);
    return;
  }
  if (!line.mask || !line.mask.px) return;
  const en = maskEntry(line.mask, color ?? c_white, helpers.bakeMask);
  drawSpriteExt(g, en, 0, line.x + dx, line.y + dy,
    line.image_xscale, line.image_yscale, line.image_angle, null, alpha);
}

/**
 * THE SCREEN IS CUT IN TWO — Draw_0:314-341, unchanged from vanilla.
 *
 * `terrible_surface` <- my_surface at `darkness` plus obj_heart (314-320);
 * then, with blending DISABLED and alpha 0 (321-322 / 334-335), a rectangle
 * and a triangle are "drawn" — which writes zero alpha, i.e. cuts a hole —
 * and what survives becomes a sprite (327 / 341) with its origin at a
 * quarter / three quarters of the screen. The two primitives per half are
 * transcribed as they stand; the diagonal they share, (200, 0) -> (440, 480),
 * is the -63 degree line the `line_timer` marker has been telegraphing.
 *
 * The halves are handed to render/draw/roaring.js's exported `screenCut`
 * (what obj_marker_screenpiece's vanilla drawer reads), and canvas.js resets
 * it when the roaring2 instance disappears — keyed on the object NAME, so
 * this port inherits the reset.
 *
 * INHERITED LIMITATION: the sim's endStep destroys obj_heart on the same
 * frame it arms `stop`, BEFORE this draw runs, so `state.soul` is already
 * null here and the soul is not in the photograph. The vanilla drawer has
 * the same gap (render/draw/roaring.js takeScreenCut). Drawn when it exists.
 */
function takeScreenCut(my, e, state, sprites) {
  screenCut.taken = true;
  const vx = state.view.x;
  const vy = state.view.y;
  const midway = W * 0.5;

  const src = document.createElement('canvas');
  src.width = W;
  src.height = H;
  {
    const g = src.getContext('2d');
    g.imageSmoothingEnabled = false;
    // 315-316: draw_clear_alpha(c_black, 0); draw_surface_ext(my_surface, ..., darkness)
    g.globalAlpha = clamp01(e.darkness);
    g.drawImage(my, 0, 0);
    g.globalAlpha = 1;
    // 317-320: with (obj_heart) draw_sprite_ext(sprite_index, image_index, screenx(), screeny(), ...)
    const heart = state.soul;
    if (heart && heart.alive) {
      const hs = sprites.get(heart.sprite_index ?? 'spr_dodgeheart');
      if (hs) {
        drawSpriteExt(g, hs, heart.image_index ?? 0, heart.x - vx, heart.y - vy,
          heart.image_xscale ?? 1, heart.image_yscale ?? 1, heart.image_angle ?? 0,
          blendOrNull(heart.image_blend), heart.image_alpha ?? 1);
      }
    }
  }

  for (let i = 0; i < 2; i++) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0);
    // gpu_set_blendenable(false) + draw_set_alpha(0): the primitives WRITE
    // alpha 0 where they land. 'destination-out' is that hole.
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    if (i === 0) {
      // 323: ossafe_fill_rectangle_color(midway + 120, -1, camerawidth(), cameraheight())
      g.fillRect(midway + 120, -1, W - (midway + 120), H + 1);
      // 324: draw_triangle_color(midway - 120, -1, midway + 120, cameraheight(), midway + 120, -1)
      g.beginPath();
      g.moveTo(midway - 120, -1);
      g.lineTo(midway + 120, H);
      g.lineTo(midway + 120, -1);
      g.closePath();
      g.fill();
    } else {
      // 336: ossafe_fill_rectangle_color(midway - 119, 0, -1, cameraheight()) — x from -1 to midway - 119
      g.fillRect(-1, 0, midway - 119 + 1, H);
      // 337: draw_triangle_color(midway - 120, 0, midway - 120, cameraheight(), midway + 120, cameraheight())
      g.beginPath();
      g.moveTo(midway - 120, 0);
      g.lineTo(midway - 120, H);
      g.lineTo(midway + 120, H);
      g.closePath();
      g.fill();
    }
    screenCut.halves[i] = c;
  }
}

/**
 * THE PARTY HP HUD — obj_knight_roaring2's Other_22 (event_user(12)), the
 * whole event, NEW in the mod. A 360x32 surface: per occupied slot a 120px
 * black panel with the character's head icon, `hp / maxhp` in the sprite
 * HP font (right-aligned at +72 and +117 with spr_hpslash between), and a
 * 75px bar — black frame, maroon trough, the character's hpcolor fill, and
 * on the B-Side the gloom band drawn over the fill in kaizo_gloomcolor().
 *
 * Indexing is the mod's split (kaizo/party/roster.js header): the LOOP is
 * over slots (`global.char[i]`, `charaction[i]`), the values are by CHARACTER
 * (`global.hp[_char]`, `k_gloom[_char]`). A slot's HP is its character's HP
 * (`global.char[slot]` is the bridge), so `state.partyHp[i]` reads the
 * former and kaizoCharboxGloom(state, charId) the latter.
 *
 * `draw_rectangle(x1, y1, x2, y2, false)` is INCLUSIVE of x2/y2, hence the
 * `+ 1`s. Row 32 of the 120x33 panel falls outside the 32px surface.
 *
 * Returns the surface; the caller blits it at (140, 448 + hp_y) at hp_alpha
 * (Other_22:80 `draw_surface_ext(hp_surf, camerax() + 140, cameray() + 448
 * + hp_y, 1, 1, 0, -1, hp_alpha)` — colour -1 is no tint).
 */
function drawHpHud(state, sprites) {
  const hud = surf('hp_surf', 360, 32);
  const g = hud.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, 360, 32); // 6: draw_clear_alpha(c_black, 0)

  // 7-8: _charamt = (char[0] > 0) + (char[1] > 0) + (char[2] > 0); _xs = 180 - _charamt * 60
  const chars = [charIdOf(state, 0), charIdOf(state, 1), charIdOf(state, 2)];
  const charamt = chars.filter((c) => c > 0).length;
  const xs = 180 - charamt * 60;
  const sideb = kaizoSideb(state);

  for (let i = 0; i < 3; i++) {
    const ch = chars[i];
    if (ch === 0) continue; // 12-15
    const icon = CHAR_ICON[ch] ?? CHAR_ICON[0];
    const charcolor = HPCOLOR[ch - 1] ?? c_white; // 17: obj_darkcontroller.hpcolor[_char - 1]
    // `global.hp[_char]` / `global.maxhp[_char]` through the slot (see above).
    const hp = state.partyHp?.[i] ?? 0;
    const maxhp = state.partyMaxhp?.[i] ?? PARTY[i]?.maxhp ?? 0;
    // 18-22: the defend pose (charaction 10) while alive
    let charind = 0;
    if (state.charaction?.[i] === 10 && hp > 0) charind = 4;
    const x = xs + i * 120; // 23

    // 24-25: the panel — draw_rectangle(_x, 0, _x + 119, 32) in c_black
    g.fillStyle = '#000000';
    g.fillRect(x, 0, 120, 33);
    // 26-28: draw_set_color(c_white); draw_set_font(global.hpfont); draw_sprite(icon, _charind, _x + 3, 4)
    const ic = sprites.get(icon);
    if (ic && ic.frames.length) drawSpriteExt(g, ic, charind, x + 3, 4, 1, 1, 0, null, 1);

    // 29-37: _tc — 16777215 white; 65535 ($00FFFF) yellow at <= 25%; 255 red at <= 0
    let tc = null; // white: no tint
    if (maxhp > 0 && hp / maxhp <= 0.25) tc = rgb(C_YELLOW);
    if (hp <= 0) tc = rgb(C_RED_CSS);
    // 38-48: `kn = 344` is obj_knight_enemy; on the B-Side the CURRENT number
    // turns kaizo_gloomcolor() while the character carries gloom.
    let curColor = tc;
    if (sideb && kaizoCharboxGloom(state, ch) > 0) curColor = KAIZO_GLOOM_COLOR;
    // 49-50: fa_right; draw_text(_x + 72, 4, hp)
    drawSpriteText(g, sprites, FONTS.hp, hp, x + 72, 4, { halign: 'right', color: curColor });
    // 51: draw_sprite(spr_hpslash, 0, _x + 71, 6)
    const slash = sprites.get('spr_hpslash');
    if (slash && slash.frames.length) drawSpriteExt(g, slash, 0, x + 71, 6, 1, 1, 0, null, 1);
    // 52-53: draw_set_color(_tc); draw_text(_x + 117, 4, maxhp)
    drawSpriteText(g, sprites, FONTS.hp, maxhp, x + 117, 4, { halign: 'right', color: tc });
    // 54: fa_left (no state to carry)

    // 55-56: the bar's frame — draw_rectangle(_x + 39, 16, _x + 116, 26) in c_black
    g.fillStyle = '#000000';
    g.fillRect(x + 39, 16, 78, 11);
    // 57-58: the trough — draw_rectangle(_x + 40, 17, _x + 115, 25) in c_maroon
    g.fillStyle = rgb(C_MAROON);
    g.fillRect(x + 40, 17, 76, 9);
    // 59-77: the fill, and the B-Side gloom band over it
    if (hp > 0 && maxhp > 0) {
      g.fillStyle = rgb(charcolor);
      const fill = Math.ceil((hp / maxhp) * 75);
      g.fillRect(x + 40, 17, fill + 1, 9); // draw_rectangle(_x + 40, 17, _x + 40 + ceil(...), 25)
      // THE SEGMENT ARITHMETIC IS `kaizoGloomBarSegment`'s, not this file's.
      // Other_22:59-77 and scr_charbox:757-769 are the SAME four lines over
      // the same 75px fill — `ceil` on both ends of `(hp - gloom)/maxhp` and
      // `hp/maxhp` — and this file used to carry its own transcription of
      // them beside the charbox row's. Two copies of one formula is how a
      // `ceil` becomes a `round` on one surface and not the other, so there
      // is now one, in kaizo/party/gloom.js, and this is a reader of it
      // (ledger G-34: until 2026-09-12 its only callers were itself and its
      // own check). Its `null` covers both guards this branch used to spell
      // out — `k_gloom > 0`, and the enclosing `hp > 0 && maxhp > 0`.
      if (sideb) {
        const seg = kaizoGloomBarSegment(state, ch, maxhp);
        if (seg) {
          const xx = x + 40;
          g.fillStyle = seg.color;
          // draw_rectangle(__xx + __LX, 17, __xx + __RX, 25) — GML's filled
          // rectangle covers x1..x2 INCLUSIVE, hence the +1, and that is the
          // one thing that is this surface's and not the segment's.
          g.fillRect(xx + seg.lx, 17, seg.rx - seg.lx + 1, 9);
        }
      }
    }
  }
  return hud;
}

/**
 * obj_knight_roaring2 — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/roaring.js drawRoaring. THREE THINGS a port has
 * to carry that are not inside one entity's draw:
 *   1. it draws obj_knight_roaring_star, obj_particle_generic, obj_afterimage,
 *      obj_afterimage_grow and (during the roar) obj_knight_pointing_starchild
 *      ITSELF, from `with` blocks into its surface — canvas.js suppresses
 *      their own draws while `helpers.roaringOwnsIt(state)` is true, and that
 *      stays true for a kaizo override, so a port that stops delegating must
 *      draw them or they vanish;
 *   2. the full-camera composite over the menu is DEFERRED: drawRoaring arms
 *      `helpers.roaringCover` and canvas.js blits it after the battle UI via
 *      `helpers.drawRoaringCover` — a port either arms the same record or
 *      accepts drawing under the panels;
 *   3. the finale's screen cut (`screenCut`, `helpers.resetScreenCut`) is
 *      module state in render/draw/roaring.js, reset by canvas.js when the
 *      roaring2 instance disappears — keyed on the OBJECT NAME, so a port
 *      inherits the reset.
 * Sim side: kaizo/attacks/roaring-final.js (+ roaring-final-star.js,
 * roaring-final-shatter.js).
 *
 * (The paragraph above is the stub-era note, kept whole. The object IS
 * ported now; all three things it lists are carried — the with-blocks are
 * drawn here, the same `roaringCover` record is armed, and `screenCut` is
 * written through render/draw/roaring.js's export.)
 *
 * THE PORT, Draw_0 top to bottom. Each block below cites its lines. The
 * entity's own fields are the sim's (kaizo/attacks/roaring-final.js is a
 * copy of sim/attacks/roaring.js with the mod's deltas); `global.time` is
 * state.frame; camerax()/cameray() are state.view.
 *
 * THREE DEVIATIONS, all inherited from the vanilla drawer and kept so the
 * two pages disagree nowhere the mod did not change:
 *   * Draw_0:17 `draw_self()` is drawn ONLY after the vanilla finale's cut
 *     (`stop && screenCut.taken`), never before and never in final mode.
 *     In the game the instance sits at its creator's position — the Knight,
 *     parked off screen at y -242 for the whole turn (the vanilla recording)
 *     — so its plain sprite is invisible until the roaring_timer-299 leap
 *     moves it to the arena. The sim spawns it AT the arena
 *     (kaizo/scenes/kaizo-mod-launcher.js case 107, (320, 88)), so drawing it
 *     early would put a second, wrongly-posed knight beside the scanline one.
 *     The final mode never moves it (Other_11 writes x/y only inside its
 *     with-blocks), so there the plain sprite is never visible in the game
 *     and never drawn here.
 *   * Draw_0:281 `draw_surface_ext(my_surface, camerax(), cameray(), ...
 *     darkness)` is not blitted at this depth: the composite is REGISTERED as
 *     `roaringCover` and canvas.js draws it after the battle UI, the way the
 *     game's legacy depths put it over the charboxes. The soul (282-285) is
 *     re-drawn over it by canvas.js. When the HP HUD is on (362-364) it is
 *     composited INTO the cover image — exact for the surface + HUD (the
 *     cover is drawn at alpha 1 with `darkness` pre-multiplied), with the one
 *     ordering difference that the soul then rides ABOVE the HUD where the
 *     GML has the HUD above the soul; the HUD is at hp_alpha 0.5, so where
 *     they overlap (the bottom band, y 448+) the soul shows through either
 *     way at a different weight.
 *   * Draw_0:296-313, the finale frame's second scanline pass over the
 *     composite, is drawn by canvas.js's drawRoaringCover (`fakeScreen`),
 *     which is the vanilla drawer's port of those identical lines.
 */
export function drawObjKnightRoaring2(ctx, e, state, helpers) {
  const { sprites, roaringCover } = helpers;
  const time = state.frame ?? 0;
  const vx = state.view.x;
  const vy = state.view.y;

  // ── 17-21: draw_self(); if (stop) exit; ────────────────────────────────
  // NOT `if (e.stop)` alone. The sim arms `stop` in the same endStep that
  // sets `do_fake_screen`, and that runs BEFORE this — so on the vanilla
  // finale's frame `stop` is already true and the frame still has to be
  // composited and photographed. The snapshot is the gate for that mode; in
  // final mode (`do_fake_screen` never set) `stop` exits at once, as the GML.
  if (e.stop && (screenCut.taken || !e.do_fake_screen)) {
    if (screenCut.taken) {
      // The leap after the cut (see the deviation note): draw_self() at the
      // instance's own position, in room coordinates (ctx is camera-translated).
      const self = sprites.get(e.sprite_index);
      if (self && self.frames.length) {
        drawSpriteExt(ctx, self, e.image_index ?? 0, e.x, e.y,
          e.image_xscale ?? 1, e.image_yscale ?? 1, e.image_angle ?? 0,
          blendOrNull(e.image_blend), e.image_alpha ?? 1);
      }
    }
    return true;
  }

  // ── 22-47: ball_surface — the vortex ────────────────────────────────────
  const ball = surf('ball');
  const bg = ball.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.setTransform(1, 0, 0, 1, 0, 0);
  bg.globalCompositeOperation = 'source-over';
  bg.globalAlpha = 1;
  bg.clearRect(0, 0, W, H); // 23: draw_clear_alpha(c_black, 0)
  // 24-30: the flow texture tiled once, then four more times under bm_add
  const flow = sprites.get('spr_knight_bullet_flow');
  drawTiled(bg, flow, 0, e.fake_x + time * 2, e.fake_y);
  bg.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) drawTiled(bg, flow, 0, e.fake_x + time * 2, e.fake_y);
  bg.globalCompositeOperation = 'source-over';
  // 31-39: ball_counter bookkeeping — the sim's (endStep / finaleDrawBookkeeping).
  // 40-46: `gpu_set_blendmode_ext(bm_zero, bm_src_color)` is dst * src — a
  // MULTIPLY. Six radial gradients whose radii sweep 1800 -> 0 cut the flat
  // texture into rings; the last (640, white -> black) is the vignette.
  bg.globalCompositeOperation = 'multiply';
  const cx = e.fake_x;
  const cy = e.fake_y + 57;
  const ring = (radius, outer) => {
    if (radius <= 0) return;
    const grad = bg.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, outer);
    bg.fillStyle = grad;
    bg.beginPath();
    bg.arc(cx, cy, radius, 0, Math.PI * 2);
    bg.fill();
  };
  for (let a = 0; a < 6; a++) ring(1800 - ((e.ball_counter + 300 * a) % 1800), '#595959');
  ring(640, '#000000');
  bg.globalCompositeOperation = 'source-over';

  // ── 48-128: star_surface — everything that lives in the vortex ──────────
  const starC = surf('star');
  const sg = starC.getContext('2d');
  sg.imageSmoothingEnabled = false;
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.globalCompositeOperation = 'source-over';
  sg.globalAlpha = 1;
  sg.clearRect(0, 0, W, H); // 49
  sg.save();
  sg.translate(-vx, -vy); // screenx()/screeny() for every with-block below

  // 50-53: `with (obj_knight_circle) event_user(1);` — a NO-OP: obj_knight_circle
  // has Create/Step/Draw/CleanUp and no Other_11 in the kaizo dump either
  // (ls'd), and GameMaker silently ignores a user event with no handler. The
  // circle draws itself through its own Draw (render/draw/knight-circle.js).

  // 54-57: the streak particles, with their own blend
  for (const p of withBlock(state, 'obj_particle_generic')) {
    const entry = sprites.get(p.sprite_index);
    if (entry && entry.frames.length) {
      drawSpriteExt(sg, entry, p.image_index, p.x, p.y,
        p.image_xscale, p.image_yscale, p.image_angle, blendOrNull(p.image_blend), p.image_alpha);
    }
  }

  // 58-106: THREE PASSES over the roaring stars, through their user events:
  //   pass A (58-72)   `if (image_blend == c_white) continue;`  -> dark stars only
  //   pass B (73-87)   `if (image_blend == c_dkgray) continue;` -> white stars
  //   ...the grate (88-91)...
  //   pass C (92-106)  `if ((image_blend == c_dkgray || image_xscale > 1) && con < 1) continue;`
  // So every star is drawn under the grate, and the white small ones — plus
  // ANY star that has begun charging — again on top of it.
  //
  // `image_blend = c_dkgray` is assigned only in roaring2's Other_10:172, an
  // event nothing calls (no `event_user(0)` targets obj_knight_roaring2 in
  // the dump; Step_0 has no such star), and the sim carries no blend on its
  // stars — so pass A draws nothing and every star is "white". The passes
  // are transcribed whole regardless.
  const stars = withBlock(state, 'obj_knight_roaring_star');
  const drawStar = (st) => drawRoaringStar(sg, st, sprites, st.con === 0 ? 0 : 1);
  for (const st of stars) { if (!isWhite(st.image_blend)) drawStar(st); }   // pass A
  for (const st of stars) { if (!isDkgray(st.image_blend)) drawStar(st); }  // pass B

  // 88-91: `gpu_set_colorwriteenable(true, true, true, false)` and the grate
  // tinted c_black at (0, star_flicker), scale 2: colour is written, alpha is
  // not — wherever the grate has ink the pixels turn black and keep their
  // alpha, and black adds nothing when star_surface is added onto my_surface,
  // so the striped rows vanish from the glow. 'source-atop' with a
  // black-tinted copy is that write (render/draw/roaring.js's reading).
  // Line 90's `star_flicker = 2 - star_flicker` is the sim's beginStep.
  const grate = sprites.get('spr_knight_line_grate');
  if (grate && grate.frames[0]) {
    sg.save();
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'source-atop';
    sg.drawImage(tinted(grate.frames[0], c_black), 0, e.star_flicker,
      grate.frames[0].width * 2, grate.frames[0].height * 2);
    sg.restore();
  }

  for (const st of stars) {                                                // pass C
    const dark = isDkgray(st.image_blend);
    const large = (st.image_xscale ?? 1) > 1;
    if ((dark || large) && (st.con ?? 0) < 1) continue;
    drawStar(st);
  }

  // 107-123: the starchildren, drawn INLINE by the roar (not through their
  // own Draw): an additive fog-white outline at `scr_pingpong(timer, 2) / 4`
  // times image_alpha, offset by image_xscale, then the sprite additively in
  // c_white. Lines 114-122 then WRITE image_alpha / active / destroy from
  // `timer` — state the sim does not carry (header); the alpha drawn is the
  // one the sim's own starchild fade produces.
  for (const k of withBlock(state, 'obj_knight_pointing_starchild')) {
    const entry = sprites.get(k.sprite_index);
    if (!entry || !entry.frames.length) continue;
    const glow = pingpong(k.timer ?? 0, 2) / 4;
    const ka = k.image_alpha ?? 1;
    sg.save();
    sg.globalCompositeOperation = 'lighter'; // 109: draw_set_blend_mode(bm_add)
    drawOutlineExt(sg, entry, k.image_index ?? 0, k.x, k.y, k.image_xscale, k.image_yscale,
      k.image_angle ?? 0, c_white, glow * ka, k.image_xscale);
    drawSpriteExt(sg, entry, k.image_index ?? 0, k.x, k.y, k.image_xscale, k.image_yscale,
      k.image_angle ?? 0, null, ka);
    sg.restore(); // 113: draw_set_blend_mode(bm_normal)
  }

  // 124-127: the afterimages, always c_white
  for (const a of withBlock(state, 'obj_afterimage')) {
    const entry = sprites.get(a.sprite_index);
    if (entry && entry.frames.length) {
      drawSpriteExt(sg, entry, a.image_index, a.x, a.y,
        a.image_xscale, a.image_yscale, a.image_angle, null, a.image_alpha);
    }
  }
  sg.restore();

  // ── 129-280: my_surface — the wobble, the tint, the knight ──────────────
  const my = surf('my');
  const mg = my.getContext('2d');
  mg.imageSmoothingEnabled = false;
  mg.setTransform(1, 0, 0, 1, 0, 0);
  mg.globalCompositeOperation = 'source-over';
  mg.globalAlpha = 1;
  // 130-131: cleared, then filled black corner to corner
  mg.fillStyle = '#000000';
  mg.fillRect(0, 0, W, H);

  // 132-173: the hsv walk — the sim's (kaizo/attacks/roaring-final.js).
  // 174-185: THE COLOUR. `make_color_hsv(hsv % 255, 255, 255)` — one fully
  // saturated hue per frame — unless B-Side, where `hsv % 300` indexes the
  // five-entry ramp (floor / ceil / frac) and the result is merged 20% toward
  // white. `kaizo_sideb()` is obj_knight_enemy.k_sideb: state.kaizo.sideb.
  let color = makeColorHsv(e.hsv % 255, 255, 255);
  if (kaizoSideb(state)) {
    const hsv = e.hsv % 300;
    const hsvind = (hsv / 300) * 4;
    const colA = SIDEB_VORTEX[Math.floor(hsvind)];
    const colB = SIDEB_VORTEX[Math.ceil(hsvind)];
    const colF = hsvind - Math.floor(hsvind); // frac()
    color = mergeColor(mergeColor(colA, colB, colF), c_white, 0.2);
  }

  // 186-189: ONE ROW AT A TIME under bm_add. `draw_surface_part_ext(ball_surface,
  // 0, a, w, 1, dx, a, 1, 1, color, ball_darkness)`: each scanline of the
  // vortex shifted by two summed sines scaled by `intensity`, tinted `color`,
  // at alpha ball_darkness. The tint is applied once to a copy (multiply,
  // alpha restored), then the rows are cut from that; at ball_darkness 0 the
  // rows would draw nothing, so the pass is skipped.
  if (e.ball_darkness > 0) {
    const tintC = surf('tint');
    const tg = tintC.getContext('2d');
    tg.imageSmoothingEnabled = false;
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.globalCompositeOperation = 'source-over';
    tg.globalAlpha = 1;
    tg.clearRect(0, 0, W, H);
    tg.drawImage(ball, 0, 0);
    tg.globalCompositeOperation = 'multiply';
    tg.fillStyle = rgb(color);
    tg.fillRect(0, 0, W, H);
    tg.globalCompositeOperation = 'destination-in';
    tg.drawImage(ball, 0, 0);
    tg.globalCompositeOperation = 'source-over';

    mg.save();
    mg.globalCompositeOperation = 'lighter';
    mg.globalAlpha = clamp01(e.ball_darkness);
    for (let a = 0; a < H; a++) {
      const dx = Math.sin((a + time) * 0.1) * 4 * e.intensity
        + Math.sin((a + time) * 0.35) * 0.5 * e.intensity;
      mg.drawImage(tintC, 0, a, W, 1, dx, a, W, 1);
    }
    mg.restore();
  }

  // 190-191: star_surface added on, then bm_normal
  mg.save();
  mg.globalCompositeOperation = 'lighter';
  mg.drawImage(starC, 0, 0);
  mg.restore();

  // 192-198: THE MOD'S GROW-GHOST LINES — `if (target != -1)` and the ghost's
  // OWN image_blend (vanilla drew every one, in c_white). obj_afterimage_grow's
  // Create sets target -4 and the finale's targeted ghosts point at a line,
  // so nothing the sim makes reads -1; the test is transcribed as written.
  for (const a of withBlock(state, 'obj_afterimage_grow')) {
    if (a.target === -1) continue;
    const entry = sprites.get(a.sprite_index);
    if (entry && entry.frames.length) {
      mg.save();
      mg.translate(-vx, -vy);
      drawSpriteExt(mg, entry, a.image_index, a.x, a.y,
        a.image_xscale, a.image_yscale, a.image_angle, blendOrNull(a.image_blend), a.image_alpha);
      mg.restore();
    }
  }

  // 199-207: THE PRE-CUT MARKER. From roaring_timer 275 a bar grows out along
  // -63 degrees through the centre of the screen, reddening as r/g/b ramp:
  // a gradient copy in make_color_rgb(r, g, b), then a solid black copy over
  // it, both `line_timer * 1` long and `4 + 8 * (1 - min(line_timer, 16) / 16)`
  // thick. `gpu_set_colorwriteenable(true, true, true, false)` with NORMAL
  // blending replaces what is under them while leaving the surface's alpha
  // alone; my_surface is opaque black-filled, so plain source-over is exact
  // (render/draw/roaring.js's reading). Line 203 only reassigns `color`.
  if (e.line_timer > -1) {
    const grad = sprites.get('spr_rk_quickslash_marker_gradient');
    const mark = sprites.get('spr_rk_quickslash_marker');
    const dir = -63;
    const mx = W * 0.5 - ldx(280, -63);
    const myy = H * 0.5 - ldy(280, -63);
    const thick = 4 + 8 * (1 - Math.min(e.line_timer, 16) / 16);
    color = makeColorRgb(e.r, e.g, e.b);
    if (grad) drawSpriteExt(mg, grad, 0, mx, myy, e.line_timer * 1, thick, dir, color, 1);
    if (mark) drawSpriteExt(mg, mark, 0, mx, myy, e.line_timer * 1, thick, dir, c_black, 1);
  }

  // 208-216: `knight_sprite_image += knight_sprite_speed` and the intensify
  // tracking — the sim's (step in vanilla mode; the draw slot and
  // finaleDrawBookkeeping in final mode). 217-218: the bbox reads are inside
  // drawKnightRows.

  if (e.fix_draw) {
    // ── 219-258: THE FINAL SLASH'S RENDER PATH (final_con 3 onward) ───────
    // 221: the knight as ONE sprite at its origin — not scanlines — at
    // (fake_x + fake_xoff, fake_y + bob - 10 + 55 + fake_yoff), xscale
    // `2 * final_xs` (he flips left/right on every beat of the cut), yscale
    // 2, no rotation, image_blend, fake_alpha.
    const kentry = sprites.get(e.knight_sprite);
    const ky = ((e.fake_y + (Math.sin(e.bobble_count * 0.1) * e.bobble_amp)) - 10) + 55 + e.fake_yoff;
    if (kentry && kentry.frames.length) {
      drawSpriteExt(mg, kentry, e.knight_sprite_image, e.fake_x + e.fake_xoff, ky,
        2 * e.final_xs, 2, 0, blendOrNull(e.image_blend), e.fake_alpha ?? 1);
    }
    // 222: `_oc = merge_color(c_red, c_black, 0.75)` — a dark red, (64, 0, 0)
    const oc = mergeColor(c_red, c_black, 0.75);
    const lines = e.final_lines ?? [];
    // 223-239: every living line, eight offset copies in _oc (its own
    // sprite, frame, scale, angle and alpha). `i_ex(final_lines[_i])`.
    for (const line of lines) {
      if (!line || line === -4 || !line.alive) continue;
      for (const [dx, dy] of LINE_OUTLINE_OFFSETS) {
        drawLineSprite(mg, line, dx, dy, oc, sprites, helpers);
      }
    }
    // 240-257: then each line's draw_self() (its own image_blend — c_red,
    // c_white on the flash frame), and over it every obj_afterimage_grow
    // whose `target` is that line, drawn with ITS draw_self(). The sim skips
    // the lines' trailing ghosts (roaring-final.js, "visual, no RNG"), so the
    // inner with-block finds nothing today; transcribed for the day it does.
    const grows = withBlock(state, 'obj_afterimage_grow');
    for (const line of lines) {
      if (!line || line === -4 || !line.alive) continue;
      drawLineSprite(mg, line, 0, 0, line.image_blend, sprites, helpers);
      for (const g of grows) {
        if (g.target !== line) continue;
        const entry = sprites.get(g.sprite_index);
        if (entry && entry.frames.length) {
          drawSpriteExt(mg, entry, g.image_index ?? 0, g.x, g.y,
            g.image_xscale, g.image_yscale, g.image_angle, blendOrNull(g.image_blend), g.image_alpha ?? 1);
        } else if (g.mask && g.mask.px) {
          const en = maskEntry(g.mask, g.image_blend ?? c_white, helpers.bakeMask);
          drawSpriteExt(mg, en, 0, g.x, g.y, g.image_xscale, g.image_yscale, g.image_angle, null, g.image_alpha ?? 1);
        }
      }
    }
  } else if (!e.do_fake_screen) {
    // ── 259-279: the scanline knight (vanilla) ────────────────────────────
    drawKnightRows(mg, sprites.get(e.knight_sprite), e, time, 0, 0);
  }

  // ── 280-285: surface_reset_target(); draw_surface_ext(my_surface, ...,
  // darkness); with (obj_heart) draw_self(); ───────────────────────────────
  // DEFERRED — see the deviation note: the composite is registered as the
  // cover canvas.js draws after the battle UI, and the soul is re-drawn over
  // it there. `fakeScreen` + `entity` hand drawRoaringCover the finale
  // frame's second scanline pass (296-313).
  roaringCover.fakeScreen = !!e.do_fake_screen;
  roaringCover.entity = e;

  // ── 286-361: do_fake_screen — the vanilla finale ─────────────────────────
  // 290-293 (starchildren destroyed), 342 (`stop = true`), 343-360 (obj_heart
  // destroyed, the two halves handed to markers) are the sim's endStep. The
  // photograph (314-341) is taken here, once, from this frame's composite.
  if (e.do_fake_screen && !screenCut.taken) {
    takeScreenCut(my, e, state, sprites);
  }

  // ── 362-364: if (hp_visible) event_user(12) — the HP HUD ─────────────────
  // Drawn AFTER the composite and the soul in the GML, i.e. above the cover;
  // composited into the cover image so it rides the same deferred blit
  // (deviation note: the cover then carries `darkness` itself and is drawn at
  // alpha 1, which composites identically).
  if (e.hp_visible) {
    const hud = drawHpHud(state, sprites);
    const cover = surf('cover');
    const cg = cover.getContext('2d');
    cg.imageSmoothingEnabled = false;
    cg.setTransform(1, 0, 0, 1, 0, 0);
    cg.globalCompositeOperation = 'source-over';
    cg.globalAlpha = 1;
    cg.clearRect(0, 0, W, H);
    cg.globalAlpha = clamp01(e.darkness);
    cg.drawImage(my, 0, 0);
    // Other_22:80: draw_surface_ext(hp_surf, camerax() + 140, cameray() + 448 + hp_y, 1, 1, 0, -1, hp_alpha)
    cg.globalAlpha = clamp01(e.hp_alpha ?? 0.5);
    cg.drawImage(hud, 140, 448 + (e.hp_y ?? 0));
    cg.globalAlpha = 1;
    roaringCover.img = cover;
    roaringCover.alpha = 1;
  } else {
    roaringCover.img = my;
    roaringCover.alpha = clamp01(e.darkness);
  }
  roaringCover.active = true;

  return true;
}

/**
 * obj_roaringknight_slash — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/slash.js drawRoaringknightSlash — the 640px
 * tapering wedge whose apex retreats with image_alpha and whose colour
 * bleaches red -> white; returns true (the event has no draw_self). NOTE the
 * rotating slash's telegraph (render/draw/rotating-slash.js) draws the SAME
 * wedge again inside its box-clipped surface through drawSlashWedge — a
 * port that changes the wedge's look changes only this copy unless the
 * quickslash family's obj_knight_rotating_slash port follows suit.
 * Sim side: sim/attacks/roaringknight-slash.js (kaizo spawns the vanilla type).
 *
 * (The paragraph above is the stub-era note, kept whole. The object IS
 * ported now.)
 *
 * THE PORT — kaizo Draw_0, 15 lines, ONE changed against vanilla:
 *
 *     1-4   hx/hy = lengthdir(640, direction); hxoff/hyoff = lengthdir(width, direction + 90)
 *     5     color = make_color_rgb(0, 0, 255)          <- the mod: pure BLUE,
 *           constant. Vanilla: make_color_rgb(255, (1 - image_alpha) * 255,
 *           (1 - image_alpha) * 255), red bleaching to white as it fades.
 *     6     draw_set_alpha(image_alpha * 2)           — clamped by the hardware
 *     7-14  draw_triangle_color(...) — the wedge, one of two mirror images
 *     15    draw_set_alpha(1)
 *
 * `if (slashdir)` is GML truthiness on `choose(-1, 1)`: a real is true only
 * above 0.5 (CLAUDE.md, the alarm-truthiness rule), so -1 takes the ELSE
 * branch — apex at `x + hx * image_alpha`, base toward `-hx`. The vanilla
 * drawer tests JS truthiness, where -1 is true, and so mirrors every
 * slashdir -1 wedge (ROARING's cut forces -1); this port takes the GML's
 * branch. Reported, not patched there.
 *
 * Same canvas calls in the same order as the vanilla wedge (save, beginPath,
 * moveTo, lineTo, lineTo, closePath, fill, restore), so the kaizo smoke's
 * call-sequence comparison is unaffected by the port.
 */
export function drawObjRoaringknightSlash(ctx, e) {
  const dir = e.direction;
  const hx = ldx(640, dir);
  const hy = ldy(640, dir);
  const hxoff = ldx(e.width, dir + 90);
  const hyoff = ldy(e.width, dir + 90);
  const a = e.image_alpha ?? 1;

  ctx.save();
  ctx.globalAlpha = clamp01(a * 2);   // 6: draw_set_alpha(image_alpha * 2)
  ctx.fillStyle = rgb(C_BLUE);        // 5: make_color_rgb(0, 0, 255)
  ctx.beginPath();
  if (e.slashdir > 0.5) {
    // 9: (x - hx*a, y - hy*a), (x + hx + hxoff, y + hy + hyoff), (x + hx - hxoff, y + hy - hyoff)
    ctx.moveTo(e.x - hx * a, e.y - hy * a);
    ctx.lineTo(e.x + hx + hxoff, e.y + hy + hyoff);
    ctx.lineTo(e.x + hx - hxoff, e.y + hy - hyoff);
  } else {
    // 13: (x + hx*a, y + hy*a), (x - hx + hxoff, y - hy + hyoff), (x - hx - hxoff, y - hy - hyoff)
    ctx.moveTo(e.x + hx * a, e.y + hy * a);
    ctx.lineTo(e.x - hx + hxoff, e.y - hy + hyoff);
    ctx.lineTo(e.x - hx - hxoff, e.y - hy - hyoff);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();                      // 15: draw_set_alpha(1)
  return true; // no draw_self() in the event
}
