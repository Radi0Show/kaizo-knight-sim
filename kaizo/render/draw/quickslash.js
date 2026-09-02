// KAIZO DRAW — the quickslash family (quickslash, its attack controller, the
// rotating slash). STUBS: every export delegates to the vanilla drawer
// through `helpers.drawVanilla`, so these objects render on the kaizo page
// exactly as they do on the main page until each is ported.
//
// Contract and helpers: kaizo/render/index.js. The vanilla model is
// render/draw/rotating-slash.js (the aim telegraph: marker sprites, rails,
// the box-clipped surface, the bobbing pose) on render/draw/gm.js.
//
// The kaizo GML (read-only, never copied here):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/gml_Object_<obj>_Draw_0.gml
// diffed against gml_vanilla_v105/CodeEntries/.
//
// ── PORT STATUS (supersedes the "STUBS" line above, kept as the pre-port
// record) ─────────────────────────────────────────────────────────────────
//
// ALL THREE EXPORTS ARE PORTED: each is an exact, call-by-call translation of
// the KAIZO Draw_0 (every draw call in the GML's order, with the sprite, the
// subimage, the manifest origin, the signed scales, the counter-clockwise
// angle, the colour, the alpha and the blend mode it names). None of them
// delegates to `helpers.drawVanilla` any more; nothing here calls a vanilla
// drawer for a sub-block either, because none of the three kaizo Draws has a
// sub-block that is both identical to vanilla AND drawn the same way by the
// vanilla port (see each function for what the vanilla path got wrong).
//
// WHAT THE MOD CHANGED (the diffs, vanilla -> kaizo, one line each):
//   obj_roaringknight_quickslash         Draw_0:3  draw_self() -> draw_sprite_ext
//                                        at yscale 1 (the mask runs at 0.4).
//   obj_roaringknight_quickslash_attack  Draw_0:1  `&& !nodraw` gate;
//                                        Draw_0:7  pose frame 3 animates too.
//   obj_knight_rotating_slash            Draw_0:59 wedge colour red -> blue;
//                                        Draw_0:71-97 the whole me_surface
//                                        block (2px quantised pose + the
//                                        scanline grate when two instances
//                                        are alive) is NEW.
//
// THE RULES THIS FILE KEEPS:
//   * READS sim state, never writes it. Nothing random happens in any of the
//     three kaizo Draws (grep'd: no random/irandom/choose in the three files),
//     so there is nothing to seed from state.frame. `global.time` — the
//     grate's flicker parity and the aim bob — is `state.frame`, the same
//     stand-in every render/draw/*.js port uses (rotating-slash.js:107,
//     pointing-cone.js:380); only its PARITY and its 0.1 rad/frame phase
//     matter, and neither the game's absolute time nor its offset from the
//     sim's frame 0 is knowable, so the two knights' complementary scanlines
//     are exact relative to each other and the absolute phase is not.
//   * Draw-time STATE lives on the attack module, not here:
//     obj_roaringknight_quickslash_attack Draw_0:3-28 (animtimer walk,
//     pose-frame advance, aetimer, the every-4-frames scr_afterimage) is
//     kaizo/attacks/quickslash.js quickslashAttack.endStep — the sim carried
//     it before this port and this port only READS `animtimer`-driven
//     `image_index`, `nodraw` and `image_alpha`. Nothing was added.
//   * Depth: every override runs inside the seam's depth-sorted pass at the
//     entity's own depth. Checked against the kaizo GML: quickslash_attack
//     Create_0:12 `depth = obj_heart.depth + 1` is on the sim module
//     (kaizo/attacks/quickslash.js:716); obj_roaringknight_quickslash and
//     obj_knight_rotating_slash assign NO depth in any kaizo event, so theirs
//     is the OBJECT DEFINITION's (CLAUDE.md, "The OBJECT DEFINITION holds
//     more than the sprite") — undumped, and the sim's undefined sorts as 0.
//     Not a render-side fix.
//     VERIFIER'S ADDENDUM — the depths are now SETTLED, and "undefined = 0"
//     is exactly right for both: DELTARUNE's `instance_create` is a GML
//     compat script (`instance_create_depth(x, y, object_get_depth(obj),
//     obj)`) and `object_get_depth` is another one that returns the legacy
//     name-keyed table of gml_GlobalScript___global_object_depths.gml, or 0
//     for an object the table does not name. Neither obj_roaringknight_
//     quickslash nor obj_knight_rotating_slash (nor _big, nor
//     obj_roaringknight_slash) is in it, so every `instance_create` of them
//     lands at depth 0 — the object-definition field is dead under that
//     script (measured 0 anyway: knight-research/tools/patches/
//     object_depth.csx on kaizo-mod/oracle/data-kaizo-pristine.win). What
//     IS in the table: obj_heart 1 (so quickslash_attack draws at 2; the
//     kaizo attack module's fallback was corrected 0 -> 1 for that) and
//     obj_growtangle 5 — the box sits BEHIND all of these in the game, and
//     the sim's box carries no depth (sim/battlebox.js, not this change),
//     so there the tie at 0 is broken by spawn order, which happens to put
//     the box first as well.
//
// SURFACES. GML draws two of these objects through offscreen surfaces. A
// surface whose contents are only ever blitted back with bm_normal at the
// same place is a CLIP (`my_surface`, the arena-sized telegraph) — the
// "over" operator is associative, so drawing through a transparent surface
// and compositing it is the same picture as drawing clipped. A surface that
// is MODIFIED before the blit (`hell_surface`'s bm_add accumulation,
// `me_surface`'s bm_subtract grate) needs a real offscreen canvas, held at
// module level like render/canvas.js's own hellSurface. One canvas per
// surface NAME, not per instance: GML gives each instance its own, but every
// instance fills, uses and blits it inside its own Draw, so nothing lives in
// the surface between two instances' draws and one canvas serves them all.
//
// NOT MODELLED — the GameMaker surface alpha quirk: bm_normal writes
// dest.a = src.a*src.a + dest.a*(1-src.a), so a half-transparent pixel drawn
// onto a cleared surface lands at alpha a^2 and the surface, blitted, reads
// dimmer than a direct draw would. The three surfaces here carry opaque art
// (the knight poses, the grate) or additive marker gradients, where the
// effect is at the edges only; a canvas has no such quirk and none is faked.
//
// SECOND-PASS AUDIT (no code change). The three kaizo Draw_0s were re-diffed
// against gml_vanilla_v105 (the deltas are exactly the four listed under
// "WHAT THE MOD CHANGED") and every draw call below was walked against its
// GML line for sprite, subimage, origin, signed scales, angle, colour, alpha
// and blend mode; nothing deviated, so nothing was rewritten. Two facts the
// walk settled that the port already honours by READING the sim rather than
// by special-casing: (1) on the frame a quickslash is created its Create
// values are what the controller's hell_surface pass sees — thickness 10,
// xdraw/ydraw 250, image_alpha 0.1, image_blend c_gray (quickslash
// Create_0:4-14; Step_0:15 only zeroes thickness on the NEXT frame's init),
// and the sim carries those same values (kaizo/attacks/quickslash.js:291-301,
// :350), so the one-frame faint band the game draws is drawn here too; (2)
// `scr_afterimage()` (attack Draw_0:15, gml_GlobalScript_scr_afterimage.gml)
// and obj_afterimage's Create/Step draw no random numbers, so the Draw-time
// spawn the sim's endStep models does not touch the RNG stream — none of the
// three Draws does. The `depth += 100/99/101` lines in kaizo rotating_slash
// Step_0:340-413 are the slash-mark PARTICLES' depths (inside `with
// (instance_create(..., obj_particle_generic))`), byte-identical to vanilla,
// and not this object's depth — confirmed by diffing the Step; nothing to
// add to the attack module.
//
// THIRD PASS — ADVERSARIAL VERIFICATION (two code changes, both about what
// the picture is COMPOSITED against, not about any draw call's arguments:
// every call above was re-walked against its GML line a third time and none
// moved). (1) quickslash_attack's hell_surface blit is DEFERRED past the
// depth pass — see the comment at the blit: the sim's box has no depth, so
// at the entity's own depth 2 the arena's opaque interior painted over the
// whole telegraph. (2) The rotating slash's cuts now spawn `visible = false`
// as kaizo Step_0:332 says (kaizo/attacks/rotating-slash.js), so the
// clipped blue wedge drawn by Draw_0:53-68 here is the only picture of a
// cut, as it is in the game; the sim had kept them visible for the vanilla
// renderer's sake and the roaring family's slash override was painting a
// second, full-screen wedge over this one. Left open, outside this file's
// remit: obj_roaringknight_quickslash_big has no override (its Draw_0 is
// byte-identical to vanilla, `if (slash) draw_self()` plus the heart-jitter
// block) and the generic blit draws its marker sprite before the cut; and
// the rotating slash's two numeric sprite swaps (Step_0:298 `scr_var_delayed
// ("sprite_index", 3329, 4)` on the aim_type-2 finale, :618 `scr_var
// ("sprite_index", 2128)` on "return" — vanilla lines too) are not in the
// sim, so the me_surface pose keeps the previous sprite through both.

import { drawSpriteExt, ldx, ldy, rgb, clamp01 } from '../../../render/draw/gm.js';
import { gmlRound } from '../../../sim/gml.js';

// ── GameMaker primitives gm.js does not carry (implemented here) ───────────

/**
 * GML `make_color_rgb(r, g, b)` with REAL arguments — the rotating slash
 * feeds it `r/g/b` walked by scr_approach in steps of 64/7 and the wedge
 * feeds it `(1 - image_alpha) * 255`, neither an integer. The runner packs
 * each argument through an int conversion that TRUNCATES toward zero (the
 * HTML5 runtime's `_r | (_g << 8) | (_b << 16)` is the documented shape of
 * it); translated as Math.trunc, not measured — the two differ by at most
 * one colour step. Returns the [r, g, b] array gm.js's tint helpers want,
 * not the packed BGR integer, because nothing here reads the integer back.
 */
function makeColorRgb(r, g, b) {
  return [Math.trunc(r) & 255, Math.trunc(g) & 255, Math.trunc(b) & 255];
}

/**
 * An instance's `image_blend` as gm.js wants it. The sim stores these as
 * [r, g, b] arrays (sim/gml.js WHITE/GRAY, mergeColor, kaizo-colors.js), a
 * translated literal might arrive as GameMaker's packed BGR integer, and an
 * instance that never assigned one has undefined (c_white). Pure white is
 * handed back as null: a multiply by c_white changes nothing, and null
 * spares drawSpriteExt a tinted() copy of every frame.
 */
function blendOf(c) {
  if (c == null) return null;
  const a = typeof c === 'number' ? [c & 255, (c >> 8) & 255, (c >> 16) & 255] : c;
  if (a[0] === 255 && a[1] === 255 && a[2] === 255) return null;
  return a;
}

/** `draw_triangle_color(x1, y1, x2, y2, x3, y3, col, col, col, false)` — one
 *  flat colour at all three corners, filled, at the given draw alpha. (gm.js's
 *  drawBeamColor is the GRADIENT wedge; this is the flat one the with-block
 *  in obj_knight_rotating_slash's Draw needs.) */
function drawTriangleColor(ctx, x1, y1, x2, y2, x3, y3, col, alpha) {
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.fillStyle = rgb(col);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** `draw_line_width_color(x1, y1, x2, y2, w, col, col)` at the given draw
 *  alpha. GameMaker draws a quad with square (butt) ends; canvas's default
 *  lineCap is butt and is set explicitly so no caller's leaked state changes
 *  the shape. */
function drawLineWidthColor(ctx, x1, y1, x2, y2, w, col, alpha) {
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.strokeStyle = rgb(col);
  ctx.lineWidth = w;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * `surface_create` / `surface_resize` / `surface_set_target` +
 * `draw_clear_alpha(c_black, 0)` in one: a module-level offscreen canvas per
 * surface name, resized when the GML resizes it, handed back CLEARED and with
 * a reset transform and blend mode. Created lazily on the first draw, never
 * at import, so the module loads where there is no `document`.
 */
const surfaces = new Map();
function surface(key, w, h) {
  let c = surfaces.get(key);
  if (!c) {
    c = document.createElement('canvas');
    surfaces.set(key, c);
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, w, h); // draw_clear_alpha(c_black, 0)
  return c;
}

// ── the GlobalScript helpers the three Draws call ──────────────────────────

function growtangle(state) {
  return state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
}

/**
 * `scr_get_box(i)` — gml_GlobalScript_scr_get_box.gml, index for index:
 * 0 is the RIGHT edge (`x + sprite_width * 0.5`), 1 top, 2 LEFT, 3 bottom,
 * 4/5 the centre; 0 with no box (`if (!i_ex(obj_growtangle)) return 0`).
 * `gt_minx()` / `gt_miny()` (their own GlobalScripts) are the same
 * expressions as 2 and 1. The sprite size is what the sim modules' own
 * boxEdges copies read (kaizo/attacks/rotating-slash.js:1082-1083): the
 * entity's spriteWidth/Height when a scene set them, else spr_battlebg_0's
 * 75px at the live image scale — the same number render/canvas.js boxRect
 * uses, so the clip here and the sim's aim geometry agree.
 */
function scrGetBox(state, i) {
  const gt = growtangle(state);
  if (!gt) return 0;
  const hw = (gt.spriteWidth ?? 75 * gt.image_xscale) * 0.5;
  const hh = (gt.spriteHeight ?? 75 * gt.image_yscale) * 0.5;
  switch (i) {
    case 0: return gt.x + hw;
    case 1: return gt.y - hh;
    case 2: return gt.x - hw;
    case 3: return gt.y + hh;
    case 4: return gt.x;
    case 5: return gt.y;
    default: return false;
  }
}

/** `instance_number(obj)` — alive instances by object name. */
function instanceNumber(state, name) {
  let n = 0;
  for (const x of state.entities) if (x.alive && x.type.name === name) n += 1;
  return n;
}

// ── obj_roaringknight_quickslash ───────────────────────────────────────────

/**
 * obj_roaringknight_quickslash — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: NO DRAW_EVENTS entry — the generic sprite blit
 * (render/canvas.js drawEntity), or the SPRITE_MASKS silhouette when the
 * sprite is not in the pack. This object does not exist in the vanilla sim
 * at all (kaizo/attacks/quickslash.js is its only definition), so "vanilla"
 * here is only the renderer's default path, never a ported Draw.
 * Sim side: kaizo/attacks/quickslash.js.
 *
 * PORTED (the paragraph above is the pre-port record). The kaizo Draw_0, all
 * four lines of it:
 *
 *     if (slash)
 *         draw_sprite_ext(sprite_index, image_index, x, y, image_xscale, 1,
 *                         image_angle, image_blend, image_alpha);   // :3
 *
 * Vanilla's line 3 is `draw_self()`. The one-word delta is the mod's whole
 * hitbox nerf made visible: kaizo quickslash_Step_0:38 squashes
 * `image_yscale` to 0.4 from the telegraph's midpoint on and never restores
 * it, so the MASK the soul collides with is a 0.4-scale band while the cut
 * is DRAWN at full height — yscale is the literal 1 here, not
 * e.image_yscale. The generic blit drew the squashed sprite.
 *
 * BEFORE THE CUT NOTHING IS DRAWN BY THIS OBJECT. Its telegraph — the
 * marker gradient sliding in along xdraw/ydraw — is painted by the
 * controller's Draw into its hell_surface (below). The generic blit was
 * drawing `sprite_index` (spr_rk_quickslash_marker, the sim's definition
 * stand-in) here every frame, at image_yscale, in image_blend: a second,
 * wrong telegraph the mod never shows.
 *
 * Fields, in the order the call reads them: `sprite_index` is
 * spr_rk_quickslash from the cut frame on (quickslash_Step_0:47; 4 frames,
 * manifest origin (125,27)); `image_index` walks 0..3 at image_speed 1
 * (sim/index.js runAnimation advances it at frame start, exactly as
 * GameMaker does, and the sim destroys the slash on the wrap —
 * kaizo/attacks/quickslash.js:422); `image_xscale` is ±1 (Other_13:23 flips
 * it) and the sign rides ctx.scale; `image_angle` is `_targetdir`
 * (Other_13:34); `image_blend` is c_white by then (Step_0:44 — a no-op
 * multiply, handed to drawSpriteExt as null); `image_alpha` 1.
 *
 * Returns true: the event has no draw_self(), so the vanilla tail must not
 * run (it would blit the squashed sprite on top).
 */
export function drawObjRoaringknightQuickslash(ctx, e, state, helpers) {
  // Draw_0:1 `if (slash)` — a GML bool the sim stores as true/false.
  if (e.slash) {
    // Draw_0:3. A sprite missing from the pack draws nothing (drawSpriteExt
    // returns on a null entry) rather than falling to the mask silhouette:
    // spr_rk_quickslash is in assets/sprites/manifest.json, so the fallback
    // has no case to serve.
    const entry = helpers.sprites.get(e.sprite_index);
    drawSpriteExt(ctx, entry, e.image_index, e.x, e.y,
      e.image_xscale, 1, e.image_angle, blendOf(e.image_blend), e.image_alpha);
  }
  return true;
}

// ── obj_roaringknight_quickslash_attack ────────────────────────────────────

/**
 * obj_roaringknight_quickslash_attack — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: NO DRAW_EVENTS entry — the generic sprite blit
 * (render/canvas.js drawEntity).
 * Sim side: kaizo/attacks/quickslash.js (also chained by combination.js).
 *
 * PORTED (the paragraph above is the pre-port record). The kaizo Draw_0 is
 * two blocks:
 *
 *   Draw_0:1-29  `if (image_alpha == 1 && !nodraw) { ...state...; draw_self();
 *                ...aetimer / scr_afterimage...; }`
 *   Draw_0:30-48 hell_surface: a 142x142 surface at (gt_minx()+5,
 *                gt_miny()+5), cleared, bm_add, `with (obj_roaringknight_
 *                quickslash) if (!slash) draw_sprite_ext(spr_rk_quickslash_
 *                marker_gradient, image_index, (x - _gtx) + xdraw,
 *                (y - _gty) + ydraw, image_xscale, thickness, image_angle,
 *                image_blend, image_alpha)`, bm_normal, blitted at (_gtx,_gty).
 *
 * The mod's deltas are both in the first block: the `!nodraw` gate (:1,
 * vanilla tested image_alpha alone) and pose frame 3 advancing (:7). The
 * hell_surface block is byte-identical to vanilla — but the vanilla renderer
 * never ported it (this object is combination-only in v1.05, unreachable,
 * and never had a drawer), so there is no vanilla helper to call for it.
 *
 * THE STATE WORK IN DRAW_0:3-28 IS NOT DONE HERE. `animtimer++`,
 * `image_index++`, `aetimer++` and the every-4-frames afterimage spawn are
 * instance state the game mutates in its Draw; the sim carries them in
 * kaizo/attacks/quickslash.js quickslashAttack.endStep (its comment cites
 * this event), gated on the same `image_alpha == 1 && !nodraw`, so by the
 * time this runs `image_index` already holds the frame the game would draw
 * and the afterimage entity already exists at depth+50/+100 for the sorted
 * pass to draw through its own (vanilla) path. This function only draws.
 *
 * `draw_self()` (:11) is `helpers.drawSelf` — the renderer's generic blit,
 * which IS draw_self: sprite_index (spr_roaringknight_attack_ol, the pose
 * sheet, then spr_roaringknight_idle in the wind-down), image_index,
 * signed image_xscale (±2 — the side the knight faces), image_yscale 2,
 * image_angle 0, image_blend (never assigned: c_white), image_alpha 1. The
 * generic blit used to run UNGATED: while `nodraw` held (the chain handoff,
 * the post-barrage stretch) the vanilla page kept drawing a knight the mod
 * hides.
 *
 * THE HELL SURFACE. `_gtx`/`_gty` are gt_minx()+5 / gt_miny()+5 (the box's
 * top-left corner inset 5px; the 142x142 surface then ends 3px short of the
 * right/bottom edges of a default 150px box). Each pending cut's gradient
 * is drawn into it in SURFACE coordinates — `(x - _gtx) + xdraw` — so the
 * blit at (_gtx, _gty) lands it at world `x + xdraw`; xdraw/ydraw are the
 * slide-in offset (250 -> 0 over timerA frames, quickslash_Step_0:19-33),
 * `thickness` is the y SCALE (0 -> 1.5 by 0.5/frame, Step_0:34; the sprite
 * is 250x46 with origin (125,23), so the band is 46*thickness px tall),
 * `image_blend` ramps grey -> get_swordcolor() (Step_0:39), and
 * `image_index` is 0 for a slash (image_speed 0 from Create, never advanced
 * before the cut) — the 2-frame gradient's frame 1 is the big's (its Create
 * sets image_index = 1). bm_add is canvas 'lighter' (premultiplied add on
 * every channel — GameMaker's (bm_src_alpha, bm_one) on colour and alpha),
 * the same translation render/canvas.js drawHellSurface uses for the
 * boxsplitter's twin of this surface. The surface itself is then drawn
 * bm_normal, so the additive light only accumulates between the cuts, not
 * against the arena.
 *
 * `with (obj_roaringknight_quickslash)` ITERATES CHILDREN TOO, and
 * obj_roaringknight_quickslash_big is taken as one: its Create opens with
 * `event_inherited()` and then overrides exactly the fields quickslash's
 * Create sets (thickness, trailthickness, destroyonhit, xdraw, ydraw), its
 * Step reads `slash` and fades `image_alpha` up from the parent's 0.1 —
 * kaizo/attacks/quickslash.js:449-455 records the same inference ("inferred
 * from behaviour, not metadata": the parent lives in the object definition,
 * which nothing dumped). So while the big is pending (`!slash`, timer < 40)
 * its gradient (xdraw/ydraw 0, thickness 1, image_index 1, alpha climbing
 * 0.1 -> 1, blend white -> swordcolor over frames 20-39) goes into this
 * surface too — the crawling marker across the box centre before the
 * finisher. If the definition ever says otherwise, drop the second name in
 * the filter below. GML `with` visits invisible instances as well, so no
 * `visible` test is made.
 * THE DEFINITION HAS NOW SAID: knight-research/tools/patches/
 * object_parents.csx on kaizo-mod/oracle/data-kaizo-pristine.win (every
 * object, 1720 rows) gives `obj_roaringknight_quickslash_big ->
 * obj_roaringknight_quickslash` and NO other child of it (quickslash itself
 * is a child of obj_collidebullet; the afterimage is a sibling, not a
 * child), so the two-name filter is exact.
 *
 * Nothing is drawn for the surface when no obj_growtangle is alive: GML's
 * gt_minx() returns undefined then and the whole block would be arithmetic
 * on undefined — in the fight the box always outlives the controller, and a
 * canvas drawImage at NaN is a no-op anyway, so the guard only spares work.
 *
 * Returns true: draw_self() ran (or was gated off) above; the tail must not
 * blit the knight a second time.
 */
export function drawObjRoaringknightQuickslashAttack(ctx, e, state, helpers) {
  // Draw_0:1. `image_alpha == 1` — a literal-assigned f32 built-in (Create
  // :9, Other_11:18), never accumulated, so === is exact (CLAUDE.md, "GML ==
  // ON REALS"). `nodraw` is a GML bool.
  if (e.image_alpha === 1 && !e.nodraw) {
    // Draw_0:3-10 (animtimer / image_index) already applied by the sim's
    // endStep — see the header. Draw_0:11:
    helpers.drawSelf(e, state);
    // Draw_0:12-28 (aetimer / scr_afterimage) — sim endStep, see the header.
  }

  // Draw_0:30-48 — hell_surface.
  const gt = growtangle(state);
  if (gt) {
    const surf = surface('quickslash_attack.hell_surface', 142, 142); // :30-35
    const g = surf.getContext('2d');
    g.globalCompositeOperation = 'lighter'; // :36 draw_set_blend_mode(bm_add)
    const _gtx = scrGetBox(state, 2) + 5; // :37 gt_minx() + 5
    const _gty = scrGetBox(state, 1) + 5; // :38 gt_miny() + 5
    const grad = helpers.sprites.get('spr_rk_quickslash_marker_gradient');
    // :39-45 with (obj_roaringknight_quickslash) — parent and child, see above.
    for (const s of state.entities) {
      if (!s.alive) continue;
      const n = s.type.name;
      if (n !== 'obj_roaringknight_quickslash' && n !== 'obj_roaringknight_quickslash_big') continue;
      if (s.slash) continue; // :41 `if (!slash)`
      // :43 — surface coordinates; the blit at (_gtx, _gty) restores world.
      drawSpriteExt(g, grad, s.image_index,
        (s.x - _gtx) + s.xdraw, (s.y - _gty) + s.ydraw,
        s.image_xscale, s.thickness, s.image_angle, blendOf(s.image_blend), s.image_alpha);
    }
    g.globalCompositeOperation = 'source-over'; // :46 bm_normal
    // :47-48 surface_reset_target; draw_surface(hell_surface, _gtx, _gty).
    //
    // VERIFIER'S FIX — DEFERRED, NOT DRAWN HERE. In the game this blit lands
    // at THIS object's depth, 2 (Create_0:12 `obj_heart.depth + 1`, obj_heart
    // 1 in the compat table), and the arena is at 5 (obj_growtangle, the
    // same table) — so the telegraph is painted OVER the box. In the sim the
    // box carries NO depth (sim/battlebox.js assigns none; measured on the
    // kaizo scene: obj_growtangle depth undefined, which the sorted pass
    // reads as 0) and the pass draws deeper first, so the entity at 2 draws
    // BEFORE the box and the box's frame 1 — measured opaque black across
    // its whole interior, assets/sprites/spr_battlebg_0_1.png — then covered
    // every pixel of a surface that sits entirely inside it: the quickslash
    // telegraph was invisible on the kaizo page. `helpers.defer` runs the
    // blit after the depth pass, before the soul (render/canvas.js seam
    // header), inside the same -view translation, which is where the vanilla
    // renderer puts the boxsplitter's twin surface for the same reason ("above
    // the arena, below the soul"). The deviation this buys: the surface now
    // also lands over the depth-0 objects the game draws OVER it — the cut
    // sprites of obj_roaringknight_quickslash / _big and the rotating slash's
    // pose — where a pending band's 6-source-row gradient crosses one of
    // them. The exact fix is the box carrying the table's 5 in sim/, which
    // this pass may not touch. The canvas is module-level and nothing else
    // draws into it before the deferred blit runs this frame.
    const sx = _gtx;
    const sy = _gty;
    helpers.defer(() => ctx.drawImage(surf, sx, sy));
  }
  return true;
}

// ── obj_knight_rotating_slash ──────────────────────────────────────────────

/**
 * obj_knight_rotating_slash — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/rotating-slash.js drawRotatingSlashTelegraph —
 * the aim markers (gradient in the instance's r/g/b, then the black marker),
 * the line2/line3 rails, every live obj_roaringknight_slash wedge redrawn
 * inside the box clip, then the knight's pose with its `sin(time*0.1)*2`
 * bob outside the clip; returns true.
 * Sim side: kaizo/attacks/rotating-slash.js (also chained by combination.js).
 *
 * PORTED (the paragraph above is the pre-port record). The kaizo Draw_0,
 * 97 lines, in three parts, all translated here in order:
 *
 *   Draw_0:1-10   my_surface: `surface_create(scr_get_box(0) - scr_get_box(2)
 *                 - 8, scr_get_box(3) - scr_get_box(1) - 8)`, resized every
 *                 frame, cleared. Draw_0:70 blits it at (scr_get_box(2) + 5,
 *                 scr_get_box(1) + 5) with bm_normal and nothing else touches
 *                 it, so it is a CLIP to the box inset 5px on the left/top
 *                 and 3px on the right/bottom (the vanilla drawer clipped to
 *                 the whole box; the inset is the GML's). Everything inside
 *                 is drawn at `(aim_x - (scr_get_box(2) + 5))` in surface
 *                 space, which the blit puts back at world aim_x — so it is
 *                 drawn in world space here, once, and the clip does the rest.
 *   Draw_0:11-52  `if (state == "aim" && timer)`: the gradient pass (:13-18),
 *                 the black marker pass (:19-23), the line2 rails (:24-37),
 *                 the line3 rails (:38-51). Byte-identical to vanilla; the
 *                 vanilla drawer's translation rounded r/g/b where
 *                 make_color_rgb truncates, and drew the two rail passes
 *                 with one strokeStyle — the same picture to within a colour
 *                 step, but this is the call-for-call form.
 *   Draw_0:53-68  `with (obj_roaringknight_slash)`: every live slash's
 *                 wedge, in the box clip. THE MOD'S COLOUR DELTA (:59):
 *                 `make_color_rgb((1 - image_alpha) * 255, (1 - image_alpha)
 *                 * 255, 255)` — pure BLUE at full alpha bleaching to white
 *                 (vanilla: red). No draw_set_alpha inside the block, so it
 *                 draws at alpha 1 — NOT the `image_alpha * 2` of the slash's
 *                 own Draw, which the vanilla drawer reused via
 *                 drawSlashWedge. And `if (slashdir)` is GML truthiness on a
 *                 choose(-1, 1): true for 1 only (a real is true above 0.5 —
 *                 CLAUDE.md's `!alarm[0]` rule), where JS would take -1 as
 *                 true too and put every wedge on the same side.
 *                 NOTE FOR THE PAGE: in the mod these slashes are spawned
 *                 `visible = false` (kaizo rotating_slash Step_0:332), so this
 *                 clipped, blue, alpha-1 wedge is the ONLY picture of a
 *                 rotating-slash cut the game shows; the sim keeps them
 *                 visible (kaizo/attacks/rotating-slash.js:832), so the
 *                 slash's own Draw (the roaring family's obj_roaringknight_
 *                 slash port) also draws its full-screen wedge on top. Not
 *                 this file's to change.
 *   Draw_0:71-97  me_surface, NEW in the mod: a 640x480 surface at the
 *                 camera, the knight drawn at SCREEN coordinates (screenx(),
 *                 screeny() + sin(global.time * 0.1) * 2 — the aim bob),
 *                 both QUANTISED to even pixels when two rotating slashes are
 *                 alive (:79-83, `round(_k / 2) * 2` — GML round is
 *                 half-to-even, sim/gml.js gmlRound), and then — two alive
 *                 only — spr_knight_line_grate at (0, _flickerY * 2), scale
 *                 (2, 2), c_black, alpha 1, under bm_subtract (:85-95), the
 *                 surface blitted at (camerax(), cameray()) (:97).
 *
 * THE GRATE. spr_knight_line_grate is 320x240 of alternating 1px white rows
 * (row 0 clear; manifest origin (0,0)), drawn at 2x it covers the surface in
 * 2px stripes. bm_subtract is (bm_zero, bm_inv_src_colour): every channel
 * of the destination is multiplied by (1 - source), and with the sprite
 * tinted c_black the source colour is 0 — RGB untouched — while the source
 * ALPHA is the grate's ink, so where a stripe lands the knight's alpha goes
 * to zero. Canvas 'destination-out' is exactly that (dest *= 1 - src.a; the
 * colour argument is irrelevant to it, hence null). `_flickerY` is
 * `global.time % 2`, INVERTED for the instance whose `firstrot` is 0
 * (:87-91): the two knights are cut on complementary rows, each set
 * crawling by 2px every frame — one interlaced, flickering pair. With one
 * instance alive the surface round-trip is the identity on opaque art and
 * only the bob remains. (render/draw/pointing-cone.js:378-397 translates
 * the same grate under the same blend the same way.)
 *
 * Returns true: no draw_self() anywhere in the event.
 */
export function drawObjKnightRotatingSlash(ctx, e, state, helpers) {
  const { sprites } = helpers;

  // Draw_0:1-10 + :70 — my_surface as a clip (see above). With no box every
  // scr_get_box is 0 and the surface would be -8 x -8: nothing can be drawn
  // into it, so the clip is empty.
  const bx = scrGetBox(state, 2) + 5;
  const by = scrGetBox(state, 1) + 5;
  const bw = scrGetBox(state, 0) - scrGetBox(state, 2) - 8;
  const bh = scrGetBox(state, 3) - scrGetBox(state, 1) - 8;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, Math.max(0, bw), Math.max(0, bh));
  ctx.clip();

  // Draw_0:11 `if (state == "aim" && timer)` — `timer` under GML truthiness
  // (a real is true above 0.5); it is an integer count from 1 in "aim".
  if (e.state === 'aim' && e.timer > 0.5) {
    const grad = sprites.get('spr_rk_quickslash_marker_gradient');
    const mark = sprites.get('spr_rk_quickslash_marker');
    const sx = e.timer * 0.2;
    const sy = 1 + (2 * (1 - (e.timer / (e.slash_base + 6 + e.slash_offset))));

    // :13-18 — the gradient pass, subimage 0, make_color_rgb(r, g, b), alpha 1.
    for (let a = 0; a < e.slash_number; a++) {
      const dir = ((360 / (e.slash_number * 2)) * a) + e.random_offset + e.aim_direction;
      const color = makeColorRgb(e.r, e.g, e.b);
      drawSpriteExt(ctx, grad, 0, e.aim_x, e.aim_y, sx, sy, dir, color, 1);
    }
    // :19-23 — the black marker pass over it.
    for (let a = 0; a < e.slash_number; a++) {
      const dir = ((360 / (e.slash_number * 2)) * a) + e.random_offset + e.aim_direction;
      drawSpriteExt(ctx, mark, 0, e.aim_x, e.aim_y, sx, sy, dir, [0, 0, 0], 1);
    }
    // :24-37 line2, :38-51 line3 — the same block twice, on a different
    // counter. `if (line2)`: GML truthiness again (idle is -1, the cycle is
    // 0..7 — 0 is false). draw_set_alpha(1 - line / 7) wraps each pass and
    // draw_set_alpha(1) closes it; the alpha rides each call here and the
    // closing reset is implicit (nothing after reads the draw alpha).
    // The counters ADVANCE in kaizo/attacks/rotating-slash.js (Step_0:207-216
    // `line2++; line2 %= 8` and Alarm_1 `line3 = 0`, added by the verifier):
    // before that neither counter ever left 0/-1 and these passes were dead.
    for (const ln of [e.line2, e.line3]) {
      if (!(ln > 0.5)) continue;
      const alpha = 1 - (ln / 7);
      for (let a = 0; a < e.slash_number; a++) {
        const dir = ((360 / (e.slash_number * 2)) * a) + e.random_offset + e.aim_direction;
        const dirx = ldx(320, dir);
        const diry = ldy(320, dir);
        const color = makeColorRgb(e.r, e.g, e.b);
        const ox = ldx(ln * 6, dir + 90);
        const oy = ldy(ln * 6, dir + 90);
        // :33 / :47 — the rail offset +perp; :34 / :48 — the rail offset -perp.
        drawLineWidthColor(ctx,
          e.aim_x + dirx + ox, e.aim_y + diry + oy,
          (e.aim_x - dirx) + ox, (e.aim_y - diry) + oy,
          e.line_width, color, alpha);
        drawLineWidthColor(ctx,
          (e.aim_x + dirx) - ox, (e.aim_y + diry) - oy,
          e.aim_x - dirx - ox, e.aim_y - diry - oy,
          e.line_width, color, alpha);
      }
    }
  }

  // Draw_0:53-68 — with (obj_roaringknight_slash). `with` visits invisible
  // instances too; the sim's slashes carry no `visible` anyway.
  for (const s of state.entities) {
    if (!s.alive || s.type.name !== 'obj_roaringknight_slash') continue;
    const hx = ldx(640, s.direction); // :55
    const hy = ldy(640, s.direction); // :56
    const hxoff = ldx(s.width, s.direction + 90); // :57
    const hyoff = ldy(s.width, s.direction + 90); // :58
    const a = s.image_alpha;
    // :59 — KAIZO: blue at full alpha, white when spent (vanilla was red).
    const color = makeColorRgb((1 - a) * 255, (1 - a) * 255, 255);
    // :60 `if (slashdir)` — choose(-1, 1) under GML truthiness: 1 is true, -1
    // is not. Draw alpha is 1 in this block (no draw_set_alpha here).
    if (s.slashdir > 0.5) {
      drawTriangleColor(ctx, // :62
        s.x - (hx * a), s.y - (hy * a),
        s.x + hx + hxoff, s.y + hy + hyoff,
        (s.x + hx) - hxoff, (s.y + hy) - hyoff,
        color, 1);
    } else {
      drawTriangleColor(ctx, // :66
        s.x + (hx * a), s.y + (hy * a),
        (s.x - hx) + hxoff, (s.y - hy) + hyoff,
        s.x - hx - hxoff, s.y - hy - hyoff,
        color, 1);
    }
  }

  ctx.restore(); // :69-70 surface_reset_target; draw_surface(my_surface, ...)

  // Draw_0:71-97 — me_surface, at the camera. `camerax()`/`cameray()` are
  // state.view (render/canvas.js translates the context by -view, so a draw
  // at (view.x, view.y) is screen (0, 0)); `screenx()` is x - camerax().
  const me = surface('rotating_slash.me_surface', 640, 480); // :71-76
  const g = me.getContext('2d');
  let _kX = e.x - state.view.x; // :77
  let _kY = (e.y - state.view.y) + (Math.sin(state.frame * 0.1) * 2); // :78
  const paired = instanceNumber(state, 'obj_knight_rotating_slash') > 1;
  if (paired) { // :79-83
    _kX = gmlRound(_kX / 2) * 2;
    _kY = gmlRound(_kY / 2) * 2;
  }
  // :84 — the pose, in surface (= screen) space.
  drawSpriteExt(g, sprites.get(e.sprite_index), e.image_index, _kX, _kY,
    e.image_xscale, e.image_yscale, e.image_angle, blendOf(e.image_blend), e.image_alpha);
  if (paired) { // :85-95
    let _flickerY = state.frame % 2; // :87 global.time % 2
    if (!e.firstrot) { // :88-91
      _flickerY = 1 - _flickerY;
    }
    // :92-94 — bm_subtract of the c_black grate: alpha-only erase (header).
    g.globalCompositeOperation = 'destination-out';
    drawSpriteExt(g, sprites.get('spr_knight_line_grate'), 0, 0, _flickerY * 2, 2, 2, 0, null, 1);
    g.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(me, state.view.x, state.view.y); // :96-97
  return true;
}
