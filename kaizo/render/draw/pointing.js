// KAIZO DRAW — the Stars family (cone, star, starchild). STUBS: every export
// delegates to the vanilla drawer through `helpers.drawVanilla`, so these
// objects render on the kaizo page exactly as they do on the main page until
// each is ported.
//
// Contract and helpers: kaizo/render/index.js. The vanilla model is
// render/draw/pointing-cone.js, pointing-star.js and pointing-starchild.js —
// ported Draw events with surfaces, scanline grates, beam wedges and the
// `scr_draw_outline` glow, all built on render/draw/gm.js.
//
// The kaizo GML (read-only, never copied here):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/gml_Object_<obj>_Draw_0.gml
// diffed against gml_vanilla_v105/CodeEntries/.
//
// PORTED — all three. The first paragraph above is the stub's history and
// no longer describes this file: nothing here delegates. Each export is the
// KAIZO Draw_0 translated call for call, in the GML's order, with the line
// numbers of gml_Object_obj_knight_pointing_{cone,star,starchild}_Draw_0.gml
// (kaizo dump) cited at every site. What the mod changed, from the diffs:
//
//   cone       the additive charge streaks are each issued TWICE and the
//              `timer % 2` gate on the fast one is bypassed by an
//              unconditional duplicate (l.59-65); the closing flare pair is
//              issued twice (l.84-87); the interior's scrolling sheets run in
//              `repeat (2)` over spr_knight_bullet_flow THEN the mod-added
//              spr_knight_bullet_flow_alt (l.114-123, sprite ids 3179 / 4994
//              — the delta spec's identification; the alt sheet is packed in
//              kaizo/assets/sprites and reaches the renderer's Map through
//              web/kaizo.js's overlay). CONFIRMED independently by this
//              port against the kaizo sprite table dumped in asset order
//              (sprite_meta_kaizo.json, 5000 rows): row 3179 is
//              spr_knight_bullet_flow and row 4994 is
//              spr_knight_bullet_flow_alt — the two numbers the decompiler
//              left bare in `_bgsprite` are those sheets and no others.
//   star       the early-out gains `&& stay == 0` (l.1); the charge tint is
//              c_gray -> #86A2FF and a lingering (`stay == 1`) star ramps
//              from c_white (l.7-17, with game logic in Draw that the sim's
//              endStep owns); the pre-blast telegraph is ONE BEAM PER
//              `blast_dir[i]` with kaizo's alpha/width/length rules
//              (l.33-50), replacing the vanilla fan; the sprite gate gains
//              `|| stay == 1` (l.53).
//   starchild  the explosion is c_blue, not c_red (l.8); `coltimer` drives a
//              white -> #86A2FF spawn tint onto image_blend (l.1-4, 12-15;
//              the sim's endStep); the glow is c_blue where vanilla was
//              c_red (l.23, 28); the con-1 arm freezes coltimer and runs
//              image_blend #86A2FF -> c_black (l.27-29; the sim); the fade
//              gate widens (l.39; the sim).
//
// WHAT THE RENDERER READS AND NEVER WRITES. Every instance field these Draws
// step — the cone's con/timer/image_index/aetimer, its bg_x/lines_x/
// star_flicker/draw_angle, the star's stay block, the shard's coltimer/
// drawtimer/image_blend/image_alpha — is stepped by the kaizo attack module's
// endStep (kaizo/attacks/stars-pointing-{cone,star,starchild}.js, this
// engine's Draw slot). Where a Draw READS a field and THEN steps it (the
// cone's timer/bg_x/lines_x/star_flicker, the shard's image_alpha) the module
// also records the value its Draw consumed (`drawn_*`), because this paints
// after that slot and would otherwise be one step ahead of the game's
// picture. See the modules' Create for the full accounting. No RNG is drawn
// by any of the three Draws (measured: no random/irandom/choose in the
// files), so nothing here is seeded from state.frame either.
//
// PRIMITIVES. draw_sprite_ext / scr_draw_beam_color / merge_color /
// scr_pingpong / clamp01 / lengthdir come from render/draw/gm.js (they are
// the vanilla ports of the same GML calls; importing render/ from kaizo/ is
// the allowed direction — render/ never imports back). Implemented HERE
// because gm.js has no equivalent: draw_sprite_part_ext (the beam slices),
// scr_draw_outline with the alpha the Draw READ and GameMaker's fog
// semantics (gm.js's drawOutline reads image_alpha off the entity and
// multiplies instead of fogging), the 2x nearest-neighbour sheet cache and
// the second surface (`starsurf`) — both render-local resources, not state.
// The star's Other_10 (`event_user(0)`, what the cone draws for each star)
// diffs IDENTICAL between the kaizo and vanilla dumps, so the vanilla helper
// render/draw/pointing-star.js drawStarUserEvent0 is called for it.
//
// COLOURS ARE BGR IN GML. 16777215 = c_white; 16711680 = 0x00FF0000 = B 255,
// G 0, R 0 = c_blue (read as RGB it would be red — the exact inversion the
// mod's recolour must not land in; kaizo/attacks/kaizo-colors.js has the
// same warning). `#86A2FF` is a `#RRGGBB` web-style literal = (134, 162,
// 255) = KAIZO_TELEGRAPH_COLOR, the one shared constant.
//
// DEPTH — CHECKED, NOTHING TO CARRY. No event of the three kaizo objects
// assigns `depth` (grep over gml_Object_obj_knight_pointing_*.gml: the one
// hit is the cone's afterimage, Draw l.28 `_after_image.depth =
// obj_knight_enemy.depth + 1`, which stars-pointing-cone.js endStep already
// carries), and neither does their creator — obj_dbulletcontroller's type-98
// block (Step l.1992 instance_create of the cone, l.2056 scr_childbullet of
// each star) sets none, and the star's burst (its own Step) sets none on the
// shards. So all three draw at their OBJECT-DEFINITION depth, the value no
// grep of the code dump can see (CLAUDE.md, "The OBJECT DEFINITION holds
// more than the sprite"); the sim spawns them with no `depth` at all and
// render/canvas.js sorts `depth ?? 0`, deeper first. Identical in vanilla
// and kaizo (the vanilla files grep the same), so it is not a mod delta and
// nothing is added to the modules; reading the real values needs the
// object-definition dump (knight-research/tools/patches/object_sprite.csx,
// extended to depth), not this file.
//
// DEPTH — RESOLVED BY THE VERIFIER (the paragraph above is kept as the
// port's reasoning; this is the measurement it asked for). The object-
// definition dump ALREADY EXISTS: knight-research/kaizo-mod/sprites/
// objects_kaizo.csv (columns object,sprite,depth,visible,persistent,parent,
// mask_sprite) and objects_vanilla.csv beside it. Rows:
//   obj_knight_pointing_cone       spr_roaringknight_point_ol  depth 0  parent obj_bulletparent
//   obj_knight_pointing_star       spr_knight_bullet_star      depth 0  parent obj_collidebullet
//   obj_knight_pointing_starchild  spr_knight_starchild        depth 0  parent obj_regularbullet
//   obj_heart                      spr_dodgeheart              depth 0
//   obj_growtangle                 spr_battlebg_0              depth 0
// identical in the vanilla table. No parent Create/Step assigns depth
// either (obj_regularbullet Create/Step grep clean; obj_bulletparent and
// obj_collidebullet have no code entries in the kaizo dump). So the three
// draw at definition depth 0 — exactly what render/canvas.js's `depth ?? 0`
// already gives an entity the sim spawned with none — and the modules are
// correct to add nothing. Not a gap after all; recorded so the next pass
// does not re-open it. (The starchild's DEFINITION sprite is
// spr_knight_starchild; its Create l.28 overrides it to
// spr_knight_starchild_parts, which the module carries.)

import {
  drawSpriteExt, drawBeamColor, mergeColor, pingpong, clamp01, ldx, ldy, rgb,
  c_white, c_gray, c_black,
} from '../../../render/draw/gm.js';
import { drawStarUserEvent0 } from '../../../render/draw/pointing-star.js';
import { gmlEq } from '../../../sim/gml.js';
import { KAIZO_TELEGRAPH_COLOR } from '../../attacks/kaizo-colors.js';

/** GameMaker's c_blue, 16711680 — BGR, so B 255 (see the header). */
const c_blue = [0, 0, 255];

/** The flow sheets are 320 wide, drawn at scale 2 (cone Draw l.118-121); the wrap is 640 (l.126-133). */
const TILE = 640;

/**
 * A 2x nearest-neighbour copy of a sheet frame, made once and kept — the
 * cone's surface draws EIGHT of these a frame (two sheets, four draws each,
 * l.116-123) and rescaling a 320x240 texture eight times a frame is the cost
 * render/draw/pointing-cone.js measured on Firefox. Smoothing is off on the
 * surface, so the pre-scale is pixel-identical to scaling at draw time.
 * Keyed on the image object (a re-extracted pack yields fresh copies); a
 * WeakMap lets them go with the pack. Render-local cache, not state.
 */
const x2Cache = new WeakMap();
function x2(img) {
  if (!img) return null;
  const hit = x2Cache.get(img);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = img.width * 2;
  c.height = img.height * 2;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, c.width, c.height);
  x2Cache.set(img, c);
  return c;
}

/**
 * `starsurf` (cone Draw l.46-49, `surface_create(640, 480)`): the second
 * surface the cone needs. `helpers.scratch` is the first (`surf`) and this
 * one is composited INTO it, so it cannot be borrowed. Render-local.
 */
let starCanvas = null;
function starSurface(w, h) {
  if (!starCanvas) starCanvas = document.createElement('canvas');
  if (starCanvas.width !== w || starCanvas.height !== h) {
    starCanvas.width = w;
    starCanvas.height = h;
  }
  return starCanvas;
}

/** Last frame's dirty boxes per cone, so a clear covers shrink as well as growth. Render-local. */
const prevRect = new WeakMap();
const prevStarRect = new WeakMap();

/** Union of two [x0,y0,x1,y1] boxes; either may be null. */
function unionRect(a, b) {
  if (!a) return b;
  if (!b) return a;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/**
 * `draw_sprite_part_ext(spr, sub, left, top, w, h, x, y, xs, ys, col, alpha)`
 * — a rectangle cut out of one frame, stretched at (x, y). The cone's charge
 * beam and closing flare are built entirely from these: a 1px-tall slice of
 * spr_knight_bullet_flow frame 2, stretched across the screen at the cone's
 * mouth.
 *
 * `col` MULTIPLIES the texture in GameMaker. Every caller here passes
 * `c_gray` under `bm_add`, and under an additive blend a grey multiply of
 * g/255 is exactly a globalAlpha of g/255 (`lighter` adds src * alpha), so
 * the grey is folded into the alpha rather than costing a tinted copy of a
 * 320x240 texture per slice. (128/255, not 0.5 — the vanilla port rounded.)
 * Only a grey is folded; the fold would be wrong under a non-additive blend,
 * and no caller has one.
 */
function drawSpritePartExt(ctx, entry, sub, left, top, w, h, dx, dy, xs, ys, color, alpha) {
  if (!entry || !entry.frames.length) return;
  const n = entry.frames.length;
  const img = entry.frames[(((sub | 0) % n) + n) % n];
  if (!img) return;
  const sw = Math.max(0, Math.min(w, img.width - left));
  const sh = Math.max(0, Math.min(h, img.height - top));
  if (sw <= 0 || sh <= 0 || left < 0 || top < 0 || left >= img.width || top >= img.height) return;
  const grey = color ? color[0] / 255 : 1;
  ctx.save();
  ctx.globalAlpha = clamp01(alpha) * grey;
  ctx.drawImage(img, left, top, sw, sh, dx, dy, sw * xs, sh * ys);
  ctx.restore();
}

/**
 * `scr_draw_outline(dist, col, alpha)` (gml_GlobalScript_scr_draw_outline.gml
 * l.1-20): four copies of the instance's own sprite at its current
 * `image_index`, offset +/-dist along the axes (rotated with image_angle when
 * it is not a multiple of 90), each at `image_alpha * alpha`, under
 * `gpu_set_fog(true, col, 0, 0)` — every pixel REPLACED by the colour, alpha
 * kept (render/draw/gm.js fogged). gm.js's drawOutline multiplies instead
 * and takes image_alpha off the entity; this one fogs, and takes the
 * image_alpha the Draw READ (`imageAlpha`, see drawObjKnightPointingStarchild).
 * For the all-white shard art the two tints coincide; the fog is the
 * translation.
 */
function scrDrawOutline(ctx, entry, e, dist, color, alpha, imageAlpha) {
  const ang = e.image_angle ?? 0;
  let xA = dist;
  let xB = 0;
  let yA = 0;
  let yB = dist;
  if (ang % 90 !== 0) {
    xA = ldx(dist, ang);
    xB = ldx(dist, ang + 90);
    yA = ldy(dist, ang + 90);
    yB = ldy(dist, ang);
  }
  const a = imageAlpha * alpha;
  // l.15-18, in this order: +A, -A, +B, -B.
  for (const [dx, dy] of [[xA, yA], [-xA, -yA], [xB, yB], [-xB, -yB]]) {
    drawSpriteExt(ctx, entry, e.image_index ?? 0, e.x + dx, e.y + dy,
      e.image_xscale, e.image_yscale, ang, color, a, true);
  }
}

/**
 * Which branch the cone's Draw took, when the entity was not made by the
 * kaizo module (no `drawn_branch` — a vanilla sim cone on a kaizo page):
 * derived from the post-Draw con/timer the way render/draw/pointing-cone.js
 * does, which is one Draw-step ahead on the flip frames. The kaizo module
 * records the real thing (stars-pointing-cone.js endStep).
 */
function fallbackBranch(e) {
  if (e.con >= 4) return 'none';
  if (e.con <= 1) return 'charge';
  if (e.con === 3 && e.timer > 0) return 'flare';
  return 'surface';
}

/**
 * obj_knight_pointing_cone — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/pointing-cone.js drawPointingCone (draw_self
 * first, then the beam and the star surface; every path returns true).
 * Its Create sets `obj_knight_enemy.visible = false` for the whole of Stars,
 * which is why the knight's own override never runs meanwhile.
 * Sim side: kaizo/attacks/stars-pointing-cone.js.
 *
 * PORTED (the "NOT PORTED" above is the stub's note, kept as history). The
 * kaizo Draw_0, 171 lines, translated in order:
 *
 *   l.1-15    the pose animation            -> instance state, the sim's endStep
 *   l.16-19   `if (con < 5) draw_self();`   -> helpers.drawSelf, FIRST, under everything
 *   l.20-37   aetimer / scr_afterimage      -> instance + entity state, the sim
 *   l.38-41   `if (con >= 4) exit;`
 *   l.42-49   the two surfaces               -> helpers.scratch (surf), starSurface (starsurf)
 *   l.50-80   con <= 1: THE CHARGE BEAM, doubled, then exit
 *   l.81-95   con == 3 && timer > 0: THE CLOSING FLARE, doubled, then exit
 *   l.96-171  THE OPEN CONE: wedge, two flow sheets, the soul punched out,
 *             the star surface under its grate, the whole thing ADDED to the room
 *
 * The branch and the read-then-stepped values (`timer`, `bg_x`, `lines_x`,
 * `star_flicker`) come from the sim module's `drawn_*` record, not from the
 * post-Draw fields — see the module's Create for why.
 *
 * BLEND STATES, and what they become on canvas (each measured against the
 * art's alpha, see the notes at the sites):
 *   bm_add (l.58, 83, 168)                                   -> 'lighter'
 *   sepalpha(src_alpha, one, dest_alpha, zero) + alphatest   -> 'lighter' INSIDE a clip to the wedge
 *   bm_subtract on an opaque-or-clear sprite (l.134, 151)    -> 'destination-out'
 *   sepalpha(src_alpha, inv_src_alpha, dest_alpha, zero) + alphatest (l.164) -> 'source-atop'
 * Every one is applied inside a save/restore, so nothing leaks into the next
 * drawer — the GML resets to bm_normal at l.66, 89, 171 itself.
 */
export function drawObjKnightPointingCone(ctx, e, state, helpers) {
  const { sprites, VIEW_W, VIEW_H, scratch } = helpers;
  const camX = state.view.x;
  const camY = state.view.y;

  // l.16-19 `if (con < 5) draw_self();` — THE KNIGHT GOES UNDER THE BACKDROP:
  // the pointing pose is the third statement of the event, before the beam
  // and before the surface, so every path below returns true and nothing
  // lands under him. draw_self as the renderer defines it (sprite_index,
  // image_index, the scales, image_blend, image_alpha; the mask fallback if
  // the art is missing). con 5 is unreachable (the sim module's ORIGINAL BUG
  // note on the con-4 restore), so this is every frame of the cone's life.
  if (e.con < 5) helpers.drawSelf(e, state);

  // l.38-41 `if (con >= 4) exit;` — the backdrop is gone while he travels home.
  const branch = e.drawn_branch ?? fallbackBranch(e);
  if (branch === 'none') return true;

  const flow = sprites.get('spr_knight_bullet_flow');
  const mouthX = e.x + 22; // `screenx(x + 22)` is this minus camerax()
  const mouthY = e.y + 54;
  const width = (mouthX - camX) / 2; // `screenx(x + 22) / 2`, the slice's source width

  // ---- l.50-80  con <= 1: THE CHARGE BEAM, and nothing else ----------------
  //
  // A 1px scanline of flow frame 2 stretched from the left edge of the screen
  // to the cone's mouth, thickening as `timer` climbs, then past 28 a solid
  // white bar. l.52-55's con 0 -> 1 and l.73-78's timer++ / con 2 / cue are
  // the sim's; `timer` here is the value l.59-71 drew with, BEFORE l.73.
  if (branch === 'charge') {
    const timer = e.drawn_timer ?? e.timer;
    if (timer < 28) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; // l.58 draw_set_blend_mode(bm_add)
      // l.59 AND l.60 — the same slice, issued twice (vanilla has l.59 once):
      // double brightness under the additive blend.
      drawSpritePartExt(ctx, flow, 2, timer * 1, timer * 4 + e.yoff - 2, width, 1, camX, mouthY, 2, 2, c_gray, 1);
      drawSpritePartExt(ctx, flow, 2, timer * 1, timer * 4 + e.yoff - 2, width, 1, camX, mouthY, 2, 2, c_gray, 1);
      // l.61-64 — the faster-scrolling slice on even timers...
      if (timer % 2 === 0) {
        drawSpritePartExt(ctx, flow, 2, timer * 2, timer * 4 + e.yoff, width, 1, camX, mouthY, 2, 2, c_gray, 1);
      }
      // l.65 — ...and, in the mod, unconditionally as well: once on odd
      // timers, twice on even.
      drawSpritePartExt(ctx, flow, 2, timer * 2, timer * 4 + e.yoff, width, 1, camX, mouthY, 2, 2, c_gray, 1);
      ctx.restore(); // l.66 draw_set_blend_mode(bm_normal)
    } else {
      // l.70-71 draw_set_color(c_white); ossafe_fill_rectangle(camerax(),
      // y + 54, x + 22, y + 56, false) — the charged bar. Two rows, as the
      // vanilla port measured it. (draw_set_color leaks in GML, but every
      // later draw names its own colour.)
      //
      // CORRECTION — THREE ROWS, AND ONE MORE COLUMN. The "measured" above
      // was this port's own note on inheriting render/draw/pointing-cone.js's
      // `fillRect(..., 2)`, and that drawer carries no measurement of it.
      // What the repo HAS established, twice, is that GameMaker's
      // `draw_rectangle` is INCLUSIVE of both corners (render/dialogue.js:77
      // "draw_rectangle is inclusive; +1"; render/draw/intro-fx.js:463-464
      // "INCLUSIVE of both corners, so x+34..x+75 is 42 columns"), and
      // ossafe_fill_rectangle corroborates it from the other side: its only
      // platform branch adds one to x2 and y2 on PS4/PS5/Vita
      // (gml_GlobalScript_ossafe_fill_rectangle.gml l.24-28) — the console
      // runners fill exclusive and are padded UP to what Windows draws. So
      // `y + 54 .. y + 56` is rows 54, 55 and 56, and `camerax() .. x + 22`
      // is (x + 22 - camerax() + 1) columns. Translated by the repo's rule,
      // not measured against the game; the vanilla drawer keeps its two rows
      // (not this file's to change). Kaizo and vanilla are identical on
      // these two lines, so this is an exactness fix, not a mod delta.
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(camX, mouthY, mouthX - camX + 1, 3);
      ctx.restore();
    }
    return true; // l.79 exit
  }

  // ---- l.81-95  con == 3 && timer > 0: THE CLOSING FLARE, and nothing else -
  //
  // Two slices peeling apart from the mouth as `timer` counts 10 down to 0,
  // fading with it — and in the mod the pair is issued twice (l.84-87).
  // `timer` is the value drawn with, BEFORE l.88's `timer--`; l.90-93's
  // con 4 is the sim's.
  if (branch === 'flare') {
    const t = e.drawn_timer ?? e.timer;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // l.83 bm_add
    drawSpritePartExt(ctx, flow, 2, (10 - t) * 2, e.yoff - (10 - t) * 4, width, 1, camX, mouthY, 2, 2, c_gray, t / 10); // l.84
    drawSpritePartExt(ctx, flow, 2, (10 - t) * 2, e.yoff + (10 - t) * 4, width, 1, camX, mouthY, 2, 2, c_gray, t / 10); // l.85
    drawSpritePartExt(ctx, flow, 2, (10 - t) * 2, e.yoff - (10 - t) * 4, width, 1, camX, mouthY, 2, 2, c_gray, t / 10); // l.86
    drawSpritePartExt(ctx, flow, 2, (10 - t) * 2, e.yoff + (10 - t) * 4, width, 1, camX, mouthY, 2, 2, c_gray, t / 10); // l.87
    ctx.restore(); // l.89 bm_normal
    return true; // l.94 exit
  }

  // ---- l.96-171  THE OPEN CONE -----------------------------------------------
  //
  // l.96-99 surface_set_target(surf); draw_clear_alpha(c_black, 0); bm_normal;
  // draw_set_alpha(1). The surface is screen-sized and screen-anchored
  // (drawn at camerax(), cameray() at l.170), so everything inside it is in
  // SCREEN space: `screenx(v)` = v - camX.
  const angle = e.angle ?? 0;
  const target = e.target_angle || 60;
  // l.102-103 `draw_angle = 1 - draw_angle; var _angle = (angle > 0) ? angle
  // + draw_angle : 0;` — the wedge widens and narrows by one degree every
  // frame. The toggle is instance state (the sim module, post-toggle here).
  const openAngle = angle > 0 ? angle + (e.draw_angle ?? 0) : 0;
  const xLeft = ldx(600, 180 + openAngle / 2); // l.104
  const yTop = ldy(600, 180 - openAngle / 2); // l.105
  const yBottom = ldy(600, 180 + openAngle / 2); // l.106
  const sx = mouthX - camX; // screenx(x + 22)
  const sy56 = e.y + 56 - camY; // screeny(y + 56)
  const sy58 = e.y + 58 - camY; // screeny(y + 58)

  // THE WEDGE'S SCREEN BOX — the only region of the surface that ever holds a
  // pixel (the fill and the sheets are clipped to the path; the soul and the
  // stars only ever remove or re-cover pixels inside it). The clear, the star
  // composite and the final add are cropped to it, padded 2px for the
  // antialiased edge and UNIONED with last frame's box so the shrink of the
  // one-degree jitter and the closing ease cannot leave a stale rim. A pure
  // optimisation: outside the box the surface is transparent and every one
  // of those passes is a no-op on transparent pixels (render/draw/
  // pointing-cone.js measured the whole-surface passes as the Firefox lag).
  const rect = [
    Math.max(0, Math.floor(Math.min(sx + xLeft, sx)) - 2),
    Math.max(0, Math.floor(Math.min(sy56 + yTop, sy56, sy58 + yBottom)) - 2),
    Math.min(VIEW_W, Math.ceil(Math.max(sx + xLeft, sx)) + 2),
    Math.min(VIEW_H, Math.ceil(Math.max(sy56 + yTop, sy56, sy58 + yBottom)) + 2),
  ];
  const clearR = unionRect(rect, prevRect.get(e));
  prevRect.set(e, rect);

  const buf = scratch(VIEW_W, VIEW_H); // l.42-45 surf = surface_create(640, 480)
  const b = buf.getContext('2d');
  b.imageSmoothingEnabled = false;
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'source-over';
  b.globalAlpha = 1;
  b.clearRect(clearR[0], clearR[1], clearR[2] - clearR[0], clearR[3] - clearR[1]); // l.97

  // l.101-111 THREE VERTICES, NOT FOUR:
  //
  //     draw_primitive_begin(pr_trianglelist);
  //     draw_vertex(screenx(x + 22) + _xleft, screeny(y + 56) + _ytop);
  //     draw_vertex(screenx(x + 22),          screeny(y + 56));
  //     draw_vertex(screenx(x + 22) + _xleft, screeny(y + 58) + _ybottom);
  //     draw_vertex(screenx(x + 22),          screeny(y + 58));
  //     draw_primitive_end();
  //
  // pr_trianglelist consumes vertices in threes; the fourth is discarded, so
  // the cone is ONE triangle (render/draw/pointing-cone.js has the history of
  // reading it as a bowtie quad). Drawn even at `_angle == 0` — the Step can
  // land angle_lerp exactly on 0 while con is still 2, and on that one frame
  // the game shows the degenerate 2px-tall white sliver (merge_color at 0 is
  // c_white); the vanilla port skipped it.
  //
  // THE CLIP IS THE MASK for l.112-113 — `gpu_set_alphatestenable(true)` +
  // `gpu_set_blendmode_ext_sepalpha(bm_src_alpha, bm_one, bm_dest_alpha,
  // bm_zero)`: colour ADDED, alpha = src.a * dst.a (the wedge's own alpha,
  // kept), and the alpha test discards fully transparent texels so they do
  // not zero the wedge (sheet frame 1, the lines, is 98.8% transparent —
  // measured). 'lighter' inside a clip to the same path is that exactly:
  // nothing is painted outside the wedge, opaque texels add, transparent
  // texels add nothing, and the fill under them is opaque so the alpha it
  // would add is already saturated.
  b.save();
  b.beginPath();
  b.moveTo(sx + xLeft, sy56 + yTop);
  b.lineTo(sx, sy56);
  b.lineTo(sx + xLeft, sy58 + yBottom);
  b.closePath();
  b.clip();
  // l.100 draw_set_color(merge_color(c_white, c_black, angle / target_angle))
  // — white closed, black open; the vertices take the draw colour.
  b.fillStyle = rgb(mergeColor(c_white, c_black, angle / target));
  b.fill();

  // l.114-123 the two flow sheets, in `repeat (2)`:
  //
  //     var _bgsprite = 3179;                       // spr_knight_bullet_flow
  //     repeat (2) {
  //         draw_sprite_ext(_bgsprite, 0, bg_x, 0, 2, 2, 0, c_white, _blend);
  //         draw_sprite_ext(_bgsprite, 0, bg_x + 640, 0, 2, 2, 0, c_white, _blend);
  //         draw_sprite_ext(_bgsprite, 1, lines_x, 0, 2, 2, 0, c_white, _blend);
  //         draw_sprite_ext(_bgsprite, 1, lines_x + 640, 0, 2, 2, 0, c_white, _blend);
  //         _bgsprite = 4994;                       // spr_knight_bullet_flow_alt
  //     }
  //
  // THIS IS WHERE THE COLOUR COMES FROM: the sheets are added over the grey
  // wedge, frame 0 the wash and frame 1 the lines, both scrolling (bg_x /
  // lines_x are the values l.118-121 drew with — the sim records them before
  // l.124-133 steps them). `_blend` is 1 and c_white multiplies to identity.
  // The alt sheet is the mod's own art; when the overlay has not loaded it
  // the Map has no entry and the second pass draws nothing (missing art
  // degrades, never throws).
  //
  // MEASURED (this port; alpha histograms of the packed PNGs through a
  // scratch zlib decoder): every sheet this block composites is BINARY-alpha.
  // spr_knight_bullet_flow frames 0 / 1 / 2 hold 76800 / 951 / 52722 opaque
  // texels of 76800 and NO partial alpha — in the vanilla pack and in the
  // mod's replacement in kaizo/assets/sprites (`replaced: true` in its
  // manifest; the histograms are identical, the recolour is in the RGB) —
  // and the mod's spr_knight_bullet_flow_alt frames 0 / 1 / 2 carry the same
  // three counts (same cut, different paint). So the sepalpha rule
  // `alpha = src.a * dst.a` never meets a fractional src.a, and the clip +
  // 'lighter' translation above is texel-exact, not approximate. (Frame 1's
  // 951 / 76800 is the "98.8% transparent" the clip note cites.) The grate
  // (38400 / 38400), spr_dodgeheart (90 clear / 310 opaque, both frames),
  // the star sheets and the shard art were re-measured the same way and are
  // binary too, so every `destination-out` / `source-atop` below stands on
  // the same footing.
  b.globalCompositeOperation = 'lighter';
  const bgX = e.drawn_bg_x ?? 0;
  const linesX = e.drawn_lines_x ?? 0;
  for (const name of ['spr_knight_bullet_flow', 'spr_knight_bullet_flow_alt']) {
    const sheet = sprites.get(name);
    if (!sheet || !sheet.frames.length) continue;
    const f0 = x2(sheet.frames[0]);
    const f1 = x2(sheet.frames[1 % sheet.frames.length]);
    if (f0) b.drawImage(f0, bgX, 0);
    if (f0) b.drawImage(f0, bgX + TILE, 0);
    if (f1) b.drawImage(f1, linesX, 0);
    if (f1) b.drawImage(f1, linesX + TILE, 0);
  }
  b.restore(); // pops the clip and the blend; the soul's punch-out must be able to cut the wedge's own edge

  // l.134-138 draw_set_blend_mode(bm_subtract); with (obj_heart)
  // draw_sprite(sprite_index, image_index, screenx(), screeny()) — the soul
  // is PUNCHED OUT of the backdrop so it stays readable against it.
  // bm_subtract takes src off every channel; spr_dodgeheart's alpha is
  // binary (measured: 90 clear, 310 opaque, none between), so on its opaque
  // texels the surface's alpha goes to 0 and on its clear ones nothing
  // changes — which is 'destination-out'. draw_sprite draws at the sprite's
  // origin (0,0 for spr_dodgeheart; taken from the manifest regardless).
  const soul = state.soul;
  if (soul && soul.alive) {
    const hs = sprites.get(soul.sprite_index ?? 'spr_dodgeheart');
    if (hs && hs.frames.length) {
      const hn = hs.frames.length;
      const hi = ((Math.floor(soul.image_index ?? 0) % hn) + hn) % hn;
      b.save();
      b.globalCompositeOperation = 'destination-out';
      b.drawImage(hs.frames[hi], soul.x - camX - (hs.meta.ox ?? 0), soul.y - camY - (hs.meta.oy ?? 0));
      b.restore();
    }
  }

  // l.139-166 THE STAR SURFACE — `if (instance_exists(obj_knight_pointing_star))`:
  //
  //     surface_set_target(starsurf); bm_normal; draw_clear_alpha(c_black, 0);
  //     with (obj_knight_pointing_star) if (image_xscale > 0.5) event_user(0);
  //     bm_subtract; draw_sprite_ext(spr_knight_line_grate, 0, 0, star_flicker, 2, 2, 0, c_black, 1);
  //     star_flicker = 2 - star_flicker;   bm_normal;
  //     with (obj_knight_pointing_star) if (image_xscale <= 0.5) event_user(0);
  //     surface_reset_target(); alphatest(true);
  //     sepalpha(bm_src_alpha, bm_inv_src_alpha, bm_dest_alpha, bm_zero);
  //     draw_surface(starsurf, 0, 0);
  //
  // EVERY live star, whatever its con — the `with` has no filter, so a fired
  // star is drawn twice a frame, once here as a flat white blob and once by
  // its own Draw (render/draw/pointing-cone.js kept `con == 0` only; the
  // GML does not). Grown stars (> 0.5) go in BEFORE the grate and get
  // striped; small ones after and stay solid — a fresh star reads as a hard
  // point of light, a grown one as a shimmering mass. `star_flicker` is the
  // value l.152 drew with (the sim records it before l.153 flips it).
  const stars = state.entities.filter(
    (x) => x.alive && x.type.name === 'obj_knight_pointing_star',
  );
  if (stars.length) {
    // THE STARS' OWN BOX, same reasoning as the wedge's: 48px of pad per side
    // covers the largest star sprite at its grown scale (64px art, +16 grown),
    // unioned with last frame's for the clear. Outside it starsurf is
    // transparent, and every pass below is a no-op there.
    let sr = null;
    for (const st of stars) {
      const pad = 48 * Math.max(1, st.image_xscale ?? 1);
      const stx = st.x - camX;
      const sty = st.y - camY;
      sr = unionRect(sr, [stx - pad, sty - pad, stx + pad, sty + pad]);
    }
    sr = [
      Math.max(0, Math.floor(sr[0])), Math.max(0, Math.floor(sr[1])),
      Math.min(VIEW_W, Math.ceil(sr[2])), Math.min(VIEW_H, Math.ceil(sr[3])),
    ];
    const sClear = unionRect(sr, prevStarRect.get(e));
    prevStarRect.set(e, sr);

    const sbuf = starSurface(VIEW_W, VIEW_H); // l.46-49 starsurf = surface_create(640, 480)
    const s = sbuf.getContext('2d');
    s.imageSmoothingEnabled = false;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over'; // l.142 bm_normal
    s.globalAlpha = 1;
    s.clearRect(sClear[0], sClear[1], sClear[2] - sClear[0], sClear[3] - sClear[1]); // l.143

    // l.144-150 — Other_10 draws at screenx()/screeny(): world minus camera.
    s.save();
    s.translate(-camX, -camY);
    for (const st of stars) if (st.image_xscale > 0.5) drawStarUserEvent0(s, st, sprites);
    s.restore();

    // l.151-152 bm_subtract; draw_sprite_ext(spr_knight_line_grate, 0, 0,
    // star_flicker, 2, 2, 0, c_black, 1) — the grate is opaque-black-or-clear
    // (measured: 38400 / 38400, none between), so the subtract is again an
    // alpha punch-out: 'destination-out', the 2x sheet at (0, flick), cropped
    // to the star box (the mapping is exact — the sheet sits at (0, flick)
    // and the source rect is the same box shifted up by flick).
    const grate = sprites.get('spr_knight_line_grate');
    if (grate && grate.frames.length) {
      const flick = e.drawn_star_flicker ?? 0;
      const g2 = x2(grate.frames[0]);
      const gx0 = Math.max(sr[0], 0);
      const gy0 = Math.max(sr[1], flick);
      const gx1 = Math.min(sr[2], g2.width);
      const gy1 = Math.min(sr[3], flick + g2.height);
      if (gx1 > gx0 && gy1 > gy0) {
        s.save();
        s.globalCompositeOperation = 'destination-out';
        s.drawImage(g2, gx0, gy0 - flick, gx1 - gx0, gy1 - gy0, gx0, gy0, gx1 - gx0, gy1 - gy0);
        s.restore();
      }
    }
    // l.153 star_flicker flip: the sim. l.154 bm_normal.

    // l.155-161 — the small ones, after the grate, unstriped.
    s.save();
    s.translate(-camX, -camY);
    for (const st of stars) if (st.image_xscale <= 0.5) drawStarUserEvent0(s, st, sprites);
    s.restore();

    // l.162-165 back on surf: alphatest(true) +
    // sepalpha(bm_src_alpha, bm_inv_src_alpha, bm_dest_alpha, bm_zero);
    // draw_surface(starsurf, 0, 0). Colour blends normally; alpha becomes
    // src.a * dst.a — the WEDGE'S alpha, so a star outside the wedge (or over
    // the soul's hole) is written with alpha 0 and never reaches the screen,
    // while the alpha test keeps starsurf's transparent texels from zeroing
    // the wedge. That is 'source-atop': the star art is binary-alpha
    // (measured), so src.a * dst.a and atop's dst.a agree texel for texel.
    // The vanilla port composited 'source-over', which let stars spill past
    // the wedge and fill the soul's hole.
    const scw = sClear[2] - sClear[0];
    const sch = sClear[3] - sClear[1];
    if (scw > 0 && sch > 0) {
      b.save();
      b.globalCompositeOperation = 'source-atop';
      b.drawImage(sbuf, sClear[0], sClear[1], scw, sch, sClear[0], sClear[1], scw, sch);
      b.restore();
    }
  }

  // l.167-171 gpu_set_alphatestenable(false); draw_set_blend_mode(bm_add);
  // surface_reset_target(); draw_surface(surf, camerax(), cameray());
  // bm_normal — the whole backdrop is ADDED to the room, so it glows over the
  // battle background instead of covering it, and the soul's punched-out hole
  // shows the background through untouched. Screen space, cropped to the
  // wedge's box (everything painted this frame lies inside `rect`, and the
  // clear already took last frame's pixels off the rest).
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  const ow = rect[2] - rect[0];
  const oh = rect[3] - rect[1];
  if (ow > 0 && oh > 0) ctx.drawImage(buf, rect[0], rect[1], ow, oh, rect[0], rect[1], ow, oh);
  ctx.restore();

  return true; // draw_self() already happened at the top — every path returns true
}

/**
 * obj_knight_pointing_star — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/pointing-star.js drawPointingStar (grey->red
 * ramp, pulsing glow, beam spikes; the `instance_exists(cone) && con == 0`
 * early exit — the cone draws the unreleased star into its own surface).
 * Sim side: kaizo/attacks/stars-pointing-star.js.
 *
 * PORTED (the "NOT PORTED" above is the stub's note, kept as history). The
 * kaizo Draw_0, 62 lines, translated in order:
 *
 *   l.1-4    `if (instance_exists(<cone> && con == 0) && stay == 0) exit;`
 *            — the dump's `instance_exists(545 && con == 0)` is the
 *            decompiler's rendering of `instance_exists(obj) && con == 0`
 *            (545 is the cone's object index in the mod's table; vanilla's
 *            dump says 548 for the same line), the reading the vanilla port
 *            established. The mod's `&& stay == 0`: a lingering star never
 *            takes the early-out.
 *   l.5-6    `_xscale/_yscale = (sprite_width + 16) / sprite_get_width(...)`
 *            — sprite_width is width x image_xscale, so this is "grow by 16
 *            screen pixels": image_xscale + 16 / w.
 *   l.7      `_color = merge_color(c_gray, #86A2FF, clamp01(timer / 30))`
 *   l.8-17   the stay block: growspeed / speed / timer++ are GAME LOGIC IN
 *            DRAW, owned by the sim module's endStep; `timer` here is the
 *            incremented value l.16 reads; the tint restarts from c_white.
 *   l.18     `_alpha = (sin(timer * 3) + 1) * 0.25`
 *   l.19-52  con 2/3: the telegraph — one scr_draw_beam_color per
 *            blast_dir[i], under bm_add
 *   l.53-57  con 1/2 or stay: the two-layer sprite
 *   l.58-62  con 3/4: the bursting frame, twice
 *
 * No draw_self(); every path returns true (or false only when the sprite is
 * missing entirely, handing the entity to the mask fallback as the vanilla
 * port does).
 */
export function drawObjKnightPointingStar(ctx, e, state, helpers) {
  const { sprites } = helpers;

  // l.1-4 — while the cone is up, an unreleased star that is not lingering
  // does NOT draw itself: the cone draws it into starsurf via event_user(0).
  const coneUp = state.entities.some(
    (x) => x.alive && x.type.name === 'obj_knight_pointing_cone',
  );
  if (coneUp && e.con === 0 && (e.stay ?? 0) === 0) return true;

  const entry = sprites.get(e.sprite_index);
  if (!entry || !entry.frames.length) return false;

  // l.5-6 — sprite_get_width/height: the frame's own size (64 for both star
  // sheets; the sim keeps sprite_index on spr_knight_bullet_star, see the
  // note at the end of this file).
  // (Superseded: the kaizo module now swaps sprite_index to
  // spr_knight_bullet_star_easy at difficulty 0 / 3.3 per Step l.8-11 — see
  // the closing note at the end of this file — so `entry` is the sheet the
  // game draws. Both are 64x64, so `w`/`h` are unchanged either way.)
  const w = entry.frames[0].width;
  const h = entry.frames[0].height;
  const xs = e.image_xscale + 16 / w;
  const ys = e.image_yscale + 16 / h;

  // l.7 — the charge ramp, c_gray -> #86A2FF (vanilla: -> c_red).
  let color = mergeColor(c_gray, KAIZO_TELEGRAPH_COLOR, clamp01(e.timer / 30));
  // l.8-17 — a lingering star: growspeed -> 0, speed -> 2.2, timer++ are the
  // sim's (stars-pointing-star.js endStep, in that order); l.16 then
  // recomputes the tint from WHITE with the incremented timer, which is what
  // e.timer already is here. (The sim module also stores this very value on
  // image_blend as its transport; computed here from the GML's inputs, and
  // the two agree.)
  if (e.stay === 1) {
    color = mergeColor(c_white, KAIZO_TELEGRAPH_COLOR, clamp01(e.timer / 30));
  }
  // l.18
  const alpha = (Math.sin(e.timer * 3) + 1) * 0.25;

  // l.19-52 — THE TELEGRAPH. `_a`, `_length`, `_prog` as vanilla (l.21-28:
  // the `(timer % 2) * 0.75` is a per-frame STROBE on the length, and timer
  // can be negative from the cone's `timer = -i` stagger — GML's `%` keeps
  // the dividend's sign, exactly as JS's does). l.29 `_offset = 66` and l.30
  // `_sublength` are assigned and never read in the kaizo Draw — the vanilla
  // fan they fed is gone — so nothing is drawn for them.
  if (e.con === 2 || e.con === 3) {
    let a = 1;
    let length = 120;
    const prog = clamp01(e.timer / 30);
    if (e.con === 2) {
      a = clamp01(prog - alpha);
      length = 50 * clamp01(prog - (e.timer % 2) * 0.75) + 50;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // l.31 bm_add
    // l.32 `_beamcolor = (difficulty >= 2) ? _color : 16777215` (c_white).
    const beamcolor = e.difficulty >= 2 ? color : c_white;
    // kaizo_sideb() — obj_knight_enemy.k_sideb in the mod, state.kaizo.sideb here.
    const sideb = !!(state.kaizo && state.kaizo.sideb);
    const dirs = e.blast_dir ?? [];
    const count = e.blast_stars ?? 0;
    // l.33-50:
    //     for (var i = 0; i < blast_stars; i++) {
    //         var _amult = 1;
    //         if (split_blast && (i % 2) == 1) _amult = 0.5;
    //         var _width = 10;
    //         if (difficulty == 3.1) { _length *= 1.05; _width = 8; }
    //         if (kaizo_sideb() || !split_blast || (split_blast && (i % 2) == 0))
    //             scr_draw_beam_color(x, y, _length, _width, blast_dir[i], _beamcolor, 0, _a * _amult, false);
    //     }
    // The 3.1 `_length *= 1.05` sits INSIDE the loop, so it compounds: beam
    // i is 1.05^(i+1) times the base. Preserved, not hoisted. At 3.3
    // (split_blast) the odd-i decoys draw at half alpha on the B-Side and
    // NOT AT ALL off it — the multiplier is computed and then unused there,
    // as the GML has it. Fractional difficulties compare with gmlEq.
    for (let i = 0; i < count; i++) {
      let amult = 1;
      if (e.split_blast && i % 2 === 1) amult = 0.5;
      let beamWidth = 10;
      if (gmlEq(e.difficulty, 3.1)) {
        length *= 1.05;
        beamWidth = 8;
      }
      if (sideb || !e.split_blast || (e.split_blast && i % 2 === 0)) {
        // scr_draw_beam_color(x, y, len, width, dir, col, outer = 0, alpha, circle = false)
        drawBeamColor(ctx, e.x, e.y, length, beamWidth, dirs[i] ?? 0, beamcolor, a * amult);
      }
    }
    ctx.restore(); // l.51 bm_normal
  }

  // l.53-57 — `if (con == 1 || con == 2 || stay == 1)`: the pulsing glow copy
  // (frame 1, a notch larger, c_white at _alpha) under the charging star
  // (frame 0 at _color). c_white multiplies to identity, so no tint copy.
  if (e.con === 1 || e.con === 2 || e.stay === 1) {
    drawSpriteExt(ctx, entry, 1, e.x, e.y, xs + 0.1, ys + 0.1, e.image_angle, null, alpha); // l.55
    drawSpriteExt(ctx, entry, 0, e.x, e.y, xs, ys, e.image_angle, color, 1); // l.56
  }
  // l.58-62 — the BURSTING star, frame 2: the glow copy throbs at double rate.
  if (e.con === 3 || e.con === 4) {
    drawSpriteExt(ctx, entry, 2, e.x, e.y, xs + 0.1, ys + 0.1, e.image_angle, null, (Math.sin(e.timer * 6) + 1) * 0.25); // l.60
    drawSpriteExt(ctx, entry, 2, e.x, e.y, xs, ys, e.image_angle, null, 1); // l.61
  }

  return true; // fully drawn — there is no draw_self() in this event
}

/**
 * obj_knight_pointing_starchild — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/canvas.js DRAW_EVENTS.obj_knight_pointing_starchild,
 * a WRAPPER — `if (roaringOwnsIt(state)) return true;` (during ROARING the
 * roar composites the child into its star surface with its own numbers)
 * and otherwise render/draw/pointing-starchild.js drawPointingStarchild.
 * A port replaces the wrapper too, so it must keep that roaring guard:
 * `helpers.roaringOwnsIt(state)`.
 * Sim side: kaizo/attacks/stars-pointing-starchild.js.
 *
 * PORTED (the "NOT PORTED" above is the stub's note, kept as history; the
 * guard it asks for is the first line). The kaizo Draw_0, 50 lines,
 * translated in order:
 *
 *   l.1-4    coltimer++                          -> the sim's endStep
 *   l.5-10   con 4: spr_thrash_missile_explosion at `timer`, c_blue, exit
 *   l.11     bm_add
 *   l.12-15  image_blend = merge_color(c_white, #86A2FF, coltimer / 30) -> the sim
 *   l.16-17  drawtimer++; _glow = scr_pingpong(drawtimer, 2) / 4  (drawtimer is the sim's, post-increment)
 *   l.18-31  _glowcol: c_white; con > 1: 16711680 = c_blue; con == 1:
 *            merge_color(c_white, c_blue, timer / 10) (+ coltimer freeze and
 *            image_blend #86A2FF -> c_black: the sim)
 *   l.32     scr_draw_outline(image_xscale, _glowcol, _glow * image_alpha)
 *   l.33-36  con > 0: frame 1 tinted `outline`, additively
 *   l.37     bm_normal
 *   l.38     frame 0 tinted `image_blend`
 *   l.39-50  the fade / active / destroy                 -> the sim
 *
 * `image_alpha` at l.32-38 is the value BEFORE l.39-50 rewrites it — the sim
 * module records it as `drawn_image_alpha` (see its Create). The one frame
 * the port cannot draw: the GML paints a shard once more at 1/15 alpha on
 * the frame the fade reaches 0 and destroys it; here that destroy lands in
 * endStep and the dead entity never reaches the seam.
 */
export function drawObjKnightPointingStarchild(ctx, e, state, helpers) {
  // The wrapper's roaring guard, kept: during ROARING the roar composites the
  // shards into its own star surface (render/canvas.js drawRoaring).
  if (helpers.roaringOwnsIt(state)) return true;
  const { sprites } = helpers;

  // l.1-4 coltimer++: the sim.

  // l.5-10 — the shard detonating: `draw_sprite_ext(spr_thrash_missile_
  // explosion, timer, x, y, _scale, _scale, image_angle - 90, c_blue, 1)`
  // — c_blue where vanilla had c_red; the tint multiplies the white-and-black
  // explosion art. `timer` indexes the four frames (drawSpriteExt wraps).
  if (e.con === 4) {
    const boom = sprites.get('spr_thrash_missile_explosion');
    const scale = (e.image_yscale + e.image_xscale) / 2;
    drawSpriteExt(ctx, boom, e.timer, e.x, e.y, scale, scale, e.image_angle - 90, c_blue, 1);
    return true; // l.9 exit
  }

  const entry = sprites.get(e.sprite_index);
  if (!entry || !entry.frames.length) return false;

  // l.11 bm_add. l.12-15 image_blend, l.16 drawtimer++: the sim (e.drawtimer
  // is already the incremented value l.17 reads).
  const glow = pingpong(e.drawtimer ?? 0, 2) / 4; // l.17
  let glowcol = c_white; // l.18 — 16777215
  if (e.con >= 1) {
    if (e.con > 1) {
      glowcol = c_blue; // l.23 — 16711680 = c_blue (vanilla 255 = c_red)
    } else {
      // l.27-29: coltimer = -999999 and the image_blend ramp are the sim's;
      // the glow colour is the draw local.
      glowcol = mergeColor(c_white, c_blue, e.timer / 10); // l.28
    }
  }
  // l.32-38 read image_alpha as it stood BEFORE the fade block (l.39-50).
  const imageAlpha = e.drawn_image_alpha ?? e.image_alpha ?? 1;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; // l.11 bm_add
  scrDrawOutline(ctx, entry, e, e.image_xscale, glowcol, glow * imageAlpha, imageAlpha); // l.32
  if (e.con > 0) { // l.33-36 — frame 1 tinted with `outline` (the Step drives it white -> get_swordcolor())
    drawSpriteExt(ctx, entry, 1, e.x, e.y, e.image_xscale, e.image_yscale,
      e.image_angle, e.outline ?? c_black, imageAlpha);
  }
  ctx.restore(); // l.37 bm_normal

  // l.38 — frame 0 tinted with image_blend (the coltimer ramp / the con-1
  // darkening, both the sim's).
  drawSpriteExt(ctx, entry, 0, e.x, e.y, e.image_xscale, e.image_yscale,
    e.image_angle, e.image_blend ?? c_white, imageAlpha);

  // l.39-50 the fade: the sim.
  return true;
}

// KNOWN GAPS, all outside this file's ownership (reported, not papered over):
//   * obj_knight_pointing_star Step l.8-11 swaps `sprite_index` to
//     spr_knight_bullet_star_easy at difficulty 0 and 3.3 — a STEP-time
//     write the kaizo sim module leaves on spr_knight_bullet_star (as the
//     vanilla sim did for difficulty 0). This Draw reads whatever
//     sprite_index the sim carries. Both sheets are 64x64.
//     CLOSED BY THE VERIFIER: kaizo/attacks/stars-pointing-star.js's Step
//     init now carries the swap (Step l.8-11, cited there), so this Draw and
//     the cone's Other_10 pass draw spr_knight_bullet_star_easy at
//     difficulty 0 and 3.3, as the game does. The bullet points above are
//     kept as the port's record of the gap; it no longer exists.
//   * scr_draw_beam_color's Gouraud triangle is gm.js's linear gradient over
//     the beam's LENGTH; the far edge sits at length * cos(width / 2), a
//     0.4% (10 deg) / 0.2% (8 deg) shorter ramp than the gradient's end.
//     Inherited from the vanilla primitive, shared by every beam in the
//     renderer.
