// KAIZO DRAW — the stream / tunnel-slasher family. STUBS: every export
// delegates to the vanilla drawer through `helpers.drawVanilla`, so these
// objects render on the kaizo page exactly as they do on the main page until
// each is ported.
//
// Contract and helpers: kaizo/render/index.js. The vanilla model is
// render/draw/knight-stream.js (the manager draws the beams, streamlines and
// diamonds itself, clipped to the box) and the two inline DRAW_EVENTS
// handlers in render/canvas.js for the tunnel slashers.
//
// The kaizo GML (read-only, never copied here):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/gml_Object_<obj>_Draw_0.gml
// diffed against gml_vanilla_v105/CodeEntries/.
//
// ── PORT STATUS (supersedes the "STUBS" line above, kept as the pre-port
// record) ─────────────────────────────────────────────────────────────────
//
// ALL THREE EXPORTS ARE PORTED: each is a call-by-call translation of the
// KAIZO Draw_0 (every draw call in the GML's order, with the sprite, the
// floored-and-wrapped subimage, the manifest origin, the signed scales, the
// counter-clockwise angle, the colour, the alpha and the blend mode it
// names). None delegates to `helpers.drawVanilla` any more. The one vanilla
// drawer still called is `helpers.drawVanilla` on obj_tracking_sword1 — the
// slasher's `event_perform(ev_draw, ev_draw_normal)` on that object, whose
// kaizo Draw_0 is byte-identical to vanilla (diffed).
//
// WHAT THE MOD CHANGED (diff vanilla -> kaizo, by Draw_0 line):
//   obj_knight_stream                    :1-2   draw_self() -> draw_sprite_ext
//                                        at y + sin(fulltimer * 0.1) *
//                                        min(global.turntimer, 8);
//                                        :3-10  scr_afterimage every 2nd
//                                        fulltimer frame (NEW; sim-side);
//                                        :11    scr_draw_in_box_ext_begin
//                                        (-4, -4) -> (-3, -3);
//                                        :26/35/41 beams c_red / c_maroon ->
//                                        get_swordcolor() / merge_color(
//                                        get_swordcolor(), c_black, 0.5).
//   obj_knight_tunnel_slasher            :2-88  the whole PierceBlades
//                                        pipeline is NEW (line 1, the pose,
//                                        is vanilla).
//   obj_knight_tunnel_slasher_2_revised  :14    fade.hspeed 4 -> 3 — sim-side
//                                        (kaizo/attacks/sword-tunnel-revised.js
//                                        already carries it); the seven draw
//                                        lines :1-7 are byte-identical.
//
// THE RULES THIS FILE KEEPS:
//   * READS sim state, never writes it, never touches state.rng. The one
//     random in these three Draws — obj_knight_tunnel_slasher Draw_0:6-7's
//     two `random_range(-at_gshake, at_gshake)` — is consumed by the SIM
//     (knightlines.js endStep, stream-order-exact, documented there) and kept
//     on e.shake_x / e.shake_y; this file reads those. obj_knight_stream's
//     Draw_0 and the revised slasher's draw lines have no random call at all
//     (grep'd), so nothing here is seeded from state.frame either.
//   * Draw-time STATE the GML does inside these Draws lives on the attack
//     modules' `draw` slot (sim/index.js "THE DRAW SLOT"), never here: the
//     stream's afterimage (knight-stream.js `draw`), the slasher's
//     `visible = false` writes (knightlines.js `draw`) and the CleanUp that
//     restores them (knightlines.js knightTunnelSlasherCleanUp).
//     WHERE THAT STATE SITS IN TIME, since a paint here shows the state a
//     sim frame left behind: the draw slot runs after endStep, so a hide or
//     a ghost the game's Draw makes on frame N is on screen at this
//     renderer's paint of frame N's state, the same frame. The one edge is
//     the slasher's teardown — CleanUp fires on the turn sweep, which the
//     kaizo director lands in the endStep of the frame the slasher writes
//     `global.turntimer = 0` (the game's controller tests the clock in its
//     Step, a frame later), so knightlines.js calls the CleanUp at that
//     write and the arena reappears one frame before the game's; the sweep
//     frame is the director's decision, not this family's.
//   * obj_knight_tunnel_slasher_2_revised's `siner++` (Draw_0:1) NOW TICKS IN
//     THE DRAW SLOT (sword-tunnel-revised.js `tunnelSlasher2.draw`), with the
//     afterimage's `random_range` (Draw_0:15) beside it. This paragraph used
//     to say the opposite — that the increment lived in the step, that the
//     0.27 px of bob phase it cost was not worth a byte-gate change, and that
//     moving it would shift that draw across the frame's other consumers.
//     THE LAST PART WAS RIGHT AND WAS THE REASON TO MOVE IT: a Draw event
//     runs on the creation frame and this engine's step does not, so the step
//     copy reached `siner % 4 == 0` a frame late — on the far side of
//     obj_knight_warp's alarm, which is what restores the alpha the check
//     gates on. The game's first afterimage is siner 8; the step copy fired
//     at siner 4. Measured, and the canonical bullets gate moved f3805 ->
//     f3866 on it (see that module's `draw` note).
//   * The seam's ctx is already view-translated (render/canvas.js draw():
//     `ctx.translate(-state.view.x, -state.view.y)` before the entity pass),
//     so WORLD coordinates go straight to the canvas. `screenx()` /
//     `camerax()` appear only where the GML draws to a SURFACE, whose pixels
//     are screen space. (render/draw/knight-stream.js subtracts state.view a
//     second time inside that same translated ctx — a vanilla-port double
//     offset during camera shake — and that is not carried here.)
//   * Sprites resolve through helpers.sprites (entry.meta = the manifest
//     row); a missing sprite draws nothing rather than throwing (gm.js
//     drawSpriteExt's guard). Named by these Draws but ABSENT from
//     assets/sprites/manifest.json: spr_custom_box (obj_growtangle's
//     customBox arm, unreachable while the slasher draws — see
//     drawShakenBox), spr_roaringknight_sword_ol_alt (the secretswords
//     sheet; secretswords is 0 everywhere in the dump) and
//     spr_roaringknight_finalslash_mask (the beam hitbox's mask sprite,
//     reached by `with (obj_regularbullet) draw_self()` at image_yscale 0
//     or image_alpha 0 — never a visible pixel in the game either).
//   * GameMaker colours are BGR-packed reals; every colour here is this
//     engine's [r, g, b] triple. c_gray = (128,128,128), c_black = (0,0,0);
//     get_swordcolor() is kaizo/attacks/kaizo-colors.js (decoded there, the
//     packed originals in its comments); the literal 16777215 (c_white,
//     slasher Draw_0:47) multiplies to nothing and is "no tint".
//   * `ossafe_fill_rectangle` / `draw_rectangle(x1, y1, x2, y2, false)` fill
//     x2/y2 INCLUSIVE on this platform: the script's own PS4/PS5/Vita branch
//     does `x2++; y2++` to make those runners match the others
//     (gml_GlobalScript_ossafe_fill_rectangle, the os_type branch before
//     its draw_rectangle), so a rectangle here is (x2 - x1 + 1) wide.
//     TRANSLATED from that evidence, not measured; the vanilla clipToBox in
//     render/draw/knight-stream.js omits the +1.
//   * VERIFIED CALL-BY-CALL (adversarial pass, every draw call of the three
//     kaizo Draw_0s re-read against this file): sprite, floored subimage,
//     manifest origin, signed scales, CCW angle (blit/drawSpriteExt negate
//     for canvas), BGR colour, alpha, blend mode, call order and gates all
//     agree. Two suspicions were run down and REFUTED, kept for the record:
//       - the dest-alpha REPLACE inside scr_draw_in_box_ext_begin (a
//         fragment with alpha >= 1/255 is written fully opaque in the game)
//         could differ from canvas source-over only on semi-transparent
//         sprite pixels; every sprite that reaches the clip here
//         (spr_roaringknight_sword_ol — the spray) is hard-alpha, MEASURED
//         from the packed PNG: 1004 pixels at 255, 1321 at 0, none between.
//         So REPLACE and source-over paint the same pixels.
//       - the slasher's event_perform on obj_tracking_sword1 runs the
//         vanilla drawer (render/draw/swords.js), whose con-2
//         `d3d_set_fog(true, c_white, 0, 0)` pass is a c_white MULTIPLY (a
//         no-op) rather than a fogged silhouette; that file is not this
//         family's to edit, and no tracking sword can be alive while the
//         PierceBlades slasher is (ac 110 is type 101 alone — obj_knight_enemy
//         Other_23:592-598 — and the turn sweep clears between turns), so the
//         path is unreachable in the fight. Reported, not changed.
//     Also checked: the streamline / beam endpoint ramps run in the sim's
//     endStep on the BIRTH frame too (sim/entity.js phaseList filters on
//     `alive` at phase start, so a beam fired in the manager's Step is in
//     that frame's endStep list), which is when the game's Draw first runs
//     them — no one-frame lag on the first line.
//   * `global.time * pi` (stream Draw_0:41/48) is fed state.frame, the same
//     clock the vanilla port uses. It cannot matter: global.time is an
//     integer frame counter, and sin(n * pi) is 0 for every integer n up to
//     floating-point noise, so both inner beam layers sit at their base
//     widths (0.8 / 0.65) on every frame in the game as well — the "pulse"
//     is a no-op in the original.

import {
  drawSpriteExt, mergeColor, rgb, c_gray, c_black,
} from '../../../render/draw/gm.js';
import { getSwordcolor } from '../../attacks/kaizo-colors.js';

/**
 * `with (obj_regularbullet)` — the object AND every descendant. Membership is
 * a parent-chain fact of the object data, invisible to any grep of the code
 * dump, so the family is transcribed from the object-definition probe
 * (knight-research/kaizo-mod/sprites/objects_kaizo.csv, `parent` column,
 * walked to obj_regularbullet: 46 objects), plus the two names this engine
 * gives the mod's anonymous `instance_create(x, y, obj_regularbullet)`
 * children of the stream beam (kaizo/attacks/knight-stream.js: the hitbox
 * and the spray sword — the same MOD_NAME map check-oracle-stream.mjs uses).
 * obj_heart is `isBullet` in this engine but is not a regularbullet in the
 * game (its parent is empty), which is why this is a NAME set and not an
 * `isBullet` test. Iteration order is newest-first — the measured with()
 * order (sim/attacks/pointing-cone.js).
 */
const REGULARBULLET_FAMILY = Object.freeze(new Set([
  // objects_kaizo.csv, parent chain reaches obj_regularbullet:
  'obj_regularbullet', 'obj_bullet_dice', 'obj_knight_roaring_star',
  'obj_shutta_reticle_bullet', 'obj_bullet_knight_stream', 'obj_fallingsword',
  'obj_roaringknight_fountain_bullet_old', 'obj_tracking_swords_manager',
  'obj_celestial_body_parent', 'obj_sword_vortex', 'obj_knight_diamondswordbullet_ext',
  'obj_elnina_snowring', 'obj_tracking_sword_slash', 'obj_snowflake_ult_bullet',
  'obj_bullet_knightcrescent', 'obj_knight_pointing_starchild',
  'obj_precipitation_bullet_parent', 'obj_diagonal_bullet_manager', 'obj_diagonal_bullet',
  'obj_watercooler_bullet_rainball', 'obj_ribbick_battle_fly', 'obj_ribbick_battle_frog',
  'obj_bullet_rain', 'obj_rabbitbullet', 'obj_elnina_raindrop', 'obj_sword_tunnel_manager',
  'obj_roaringknight_fountain_bullet', 'obj_bullet_sun', 'obj_roaringknight_split_bullet',
  'obj_bullet_knight_tunnelslash', 'obj_tracking_sword1', 'obj_bullet_umbrella',
  'obj_tracking_sword2', 'obj_bullet_snow', 'obj_rainwater', 'obj_bullet_homing',
  'obj_lanino_solar_system', 'obj_knight_bullethell_bullet2', 'obj_knight_bullethell_bullet',
  'obj_bullet_moon', 'obj_sword_tunnel_sword', 'obj_spinningbullet',
  'obj_shutta_reticle_bullet2', 'obj_bullet_submoon', 'obj_sword_vortex_manager',
  'obj_bullet_knight_slash',
  // this engine's names for the mod's anonymous obj_regularbullet children:
  'obj_bullet_stream_hitbox', 'obj_bullet_stream_sword',
]));

/** Live entities matching `pred`, in with() order: newest first. */
function withOrder(state, pred) {
  return state.entities
    .filter((x) => x.alive && pred(x))
    .sort((a, b) => b.seq - a.seq);
}

const isRegularbullet = (x) => REGULARBULLET_FAMILY.has(x.type.name);

/**
 * GML's subimage rule for `draw_sprite_ext(spr, image_index, ...)`: the
 * real is FLOORED, then wrapped on the frame count (negatives wrap too).
 * The vanilla inline handlers use `Math.abs(Math.floor(i)) % n`, which is
 * the same for the non-negative indices these objects carry.
 */
function frameOf(entry, idx) {
  const n = entry.frames.length;
  const i = Math.floor(idx ?? 0);
  return entry.frames[((i % n) + n) % n];
}

/**
 * GameMaker's colour argument as this engine's tint: an [r, g, b] triple
 * passes through; a packed real is decoded BGR (helpers.rgbOf), with
 * c_white (16777215) meaning "no tint" — a multiply by white changes nothing
 * and gm.js tinted() would only spend a canvas on it. Anything else throws,
 * as tinted() itself does, so a stray string (the old 'c_gray' bug the
 * attack modules once carried) fails loudly instead of drawing untinted.
 */
function tintOf(blend, helpers) {
  if (blend == null) return null;
  if (Array.isArray(blend)) return blend;
  if (typeof blend === 'number') return blend === helpers.C_WHITE_GM ? null : helpers.rgbOf(blend);
  throw new TypeError(`stream.js: image_blend must be [r,g,b] or a packed real, got ${JSON.stringify(blend)}`);
}

/** The one live arena, or null. */
function growtangle(state) {
  return state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle') ?? null;
}

/**
 * gt_minx() / gt_miny() / gt_maxx() / gt_maxy() —
 * `obj_growtangle.x -+ obj_growtangle.sprite_width / 2`, and sprite_width is
 * the board sprite's 75 times image_xscale (spr_battlebg_0 and
 * spr_battlebg_stretch_hitbox are both 75 wide), the same constant the sim's
 * gtMinx in kaizo/attacks/knightlines.js uses — so the clip and the hitscan
 * agree on where the wall is.
 */
const gtMinx = (gt) => gt.x - (75 * (gt.image_xscale ?? 2)) / 2;
const gtMaxx = (gt) => gt.x + (75 * (gt.image_xscale ?? 2)) / 2;
const gtMiny = (gt) => gt.y - (75 * (gt.image_yscale ?? 2)) / 2;
const gtMaxy = (gt) => gt.y + (75 * (gt.image_yscale ?? 2)) / 2;

/**
 * `scr_draw_in_box_ext_begin(arg0, arg1)` (gml_GlobalScript_scr_draw_in_box_begin):
 *
 *     if (!instance_exists(obj_growtangle)) exit;         // the SCRIPT exits — the Draw goes on, unclipped
 *     ...alpha 0 over the whole view, then alpha 1 over
 *     ossafe_fill_rectangle(gt_minx() + 5 - arg0, gt_miny() + 5 - arg1,
 *                           gt_maxx() - 4 + arg0, gt_maxy() - 4 + arg1);
 *     gpu_set_blendmode_ext(bm_dest_alpha, bm_inv_dest_alpha);  alpha test on, ref 1
 *
 * i.e. every draw until scr_draw_in_box_end lands only where the destination
 * alpha is 1 — the inset rectangle. That is a clip; canvas clip() is the
 * translation. Two things it is NOT: the dest-alpha blend REPLACES inside
 * the box rather than source-over blending (only a sprite's semi-transparent
 * edge pixels can tell), and a fractional edge is rasterised by GameMaker
 * where canvas anti-aliases the clip — both sub-pixel, neither modelled.
 * The rectangle is x2/y2-inclusive (header), hence the +1s. Returns whether
 * a clip was pushed, so the caller's scr_draw_in_box_end pops exactly then.
 * (Superseded on one point: the caller now owns the save/restore pair — it
 * brackets the WHOLE beam pass, clipped or not, so the stroke state the
 * line calls set (lineWidth, strokeStyle, lineCap) never leaks past this
 * Draw into the next entity's when no arena is alive. The clip path itself
 * is still pushed only when a box exists, exactly as the script's `exit`
 * has it; the return value now says whether a clip was cut, not whether a
 * save happened.)
 */
function drawInBoxExtBegin(ctx, gt, arg0, arg1) {
  if (!gt) return false;
  const x1 = gtMinx(gt) + 5 - arg0;
  const y1 = gtMiny(gt) + 5 - arg1;
  const x2 = gtMaxx(gt) - 4 + arg0;
  const y2 = gtMaxy(gt) - 4 + arg1;
  ctx.beginPath();
  ctx.rect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
  ctx.clip();
  return true;
}

/**
 * `draw_line_width_color(x1, y1, x2, y2, w, c1, c2)` — a w-wide quad along
 * the segment with square (butt) ends, which is a butt-capped canvas stroke.
 * Both colours are always the same here (c1 == c2 at every call site), so a
 * flat stroke is exact. A zero or negative width draws nothing in either
 * runtime.
 */
function drawLineWidthColor(ctx, l, width, color) {
  if (!(width > 0)) return;
  ctx.strokeStyle = rgb(color);
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(l.x1, l.y1);
  ctx.lineTo(l.x2, l.y2);
  ctx.stroke();
}

/**
 * obj_knight_stream — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/knight-stream.js drawKnightStream — inside
 * `scr_draw_in_box_ext_begin(-4, -4)`: the diamonds, the grey streamlines,
 * the red / maroon / black beam layers pulsing on `sin(global.time * pi)`;
 * returns true. The GML event OPENS with `draw_self()` and the vanilla port
 * blits no manager sprite of its own — whether obj_knight_stream carries one
 * on its object definition (the CLAUDE.md `sprite_index` hole) is for the
 * port to check. obj_bullet_knight_stream, obj_knight_streamline and
 * obj_bullet_stream_diamond are `() => true` in canvas.js (drawn here, not
 * by themselves) and stay that way for a kaizo override.
 * Sim side: kaizo/attacks/knight-stream.js.
 *
 * PORTED (supersedes the paragraph above). The object DOES carry a sprite on
 * its definition — spr_roaringknight_attack_ol, objects_kaizo.csv:1690 (and
 * vanilla's, objects_vanilla.csv:1691, the same sheet) — and the kaizo
 * attack module now assigns it in create, so the pose and its ghosts have
 * art. The kaizo Draw_0, in order:
 *
 *     :1   var _sinamt = min(global.turntimer, 8);
 *     :2   draw_sprite_ext(sprite_index, image_index, x, y + (sin(fulltimer * 0.1) * _sinamt),
 *              image_xscale, image_yscale, image_angle, image_blend, image_alpha);
 *     :3-10  if ((fulltimer % 2) == 0) { fade = scr_afterimage(); ... }   -> SIM (knight-stream.js draw slot)
 *     :11  scr_draw_in_box_ext_begin(-3, -3);
 *     :12-15 with (obj_regularbullet) draw_self();
 *     :16-25 with (obj_knight_streamline) { ...approach/lengthdir maths...; draw_line_width_color(x1, y1, x2, y2, width, c_gray, c_gray); }
 *     :26  var _ds = merge_color(get_swordcolor(), c_black, 0.5);
 *     :27-36 with (obj_bullet_knight_stream) { ...same maths...; draw_line_width_color(..., width, get_swordcolor(), get_swordcolor()); }
 *     :37-43 with (obj_bullet_knight_stream) if (width > 8) draw_line_width_color(..., width * (0.8 + (sin(global.time * pi) * 0.2)), _ds, _ds);
 *     :44-50 with (obj_bullet_knight_stream) if (width > 8) draw_line_width_color(..., width * (0.65 + (sin(global.time * pi) * 0.2)), c_black, c_black);
 *     :51  scr_draw_in_box_end();
 *
 * The line_length / width / x1..y2 writes inside the with-blocks (:18-23,
 * :29-34) are per-frame STATE the sim advances in its endStep
 * (knight-stream.js, "Same per-frame ramps as the streamline"), exactly as
 * the vanilla port reasons; this reads the results. `global.turntimer` is
 * state.turntimer; `fulltimer` is post-Step (Step_0:2), as the Draw sees it.
 * The manager's own image_blend / image_alpha / image_angle are never
 * assigned by the mod (GML defaults: c_white, 1, 0), so they read as
 * undefined here and take those defaults.
 *
 * DEVIATION FROM THE VANILLA PORT, on purpose: with no obj_growtangle alive
 * the vanilla drawer returns without drawing anything, but the GML's `exit`
 * is inside the SCRIPT and only skips the clip — the beams still draw,
 * unclipped. Translated as the GML has it.
 */
export function drawObjKnightStream(ctx, e, state, helpers) {
  const { sprites, blit } = helpers;

  // Draw_0:1-2 — the pose, bobbing on the manager's own clock with an
  // amplitude that collapses to the turn's last eight frames.
  const _sinamt = Math.min(state.turntimer ?? 0, 8);
  const pose = sprites.get(e.sprite_index);
  if (pose && pose.frames.length) {
    blit(frameOf(pose, e.image_index), pose.meta.ox, pose.meta.oy,
      e.x, e.y + (Math.sin(e.fulltimer * 0.1) * _sinamt),
      e.image_xscale ?? 1, e.image_yscale ?? 1, e.image_angle ?? 0,
      e.image_alpha ?? 1, tintOf(e.image_blend, helpers));
  }

  // Draw_0:3-10 — the afterimage: sim-side (kaizo/attacks/knight-stream.js
  // `draw`); the ghost is an obj_afterimage entity the ordinary pass draws.

  // Draw_0:11 — the save brackets everything to scr_draw_in_box_end (canvas
  // hygiene, see drawInBoxExtBegin); the clip is cut only with a box alive.
  const gt = growtangle(state);
  ctx.save();
  drawInBoxExtBegin(ctx, gt, -3, -3);

  // Draw_0:12-15 — `with (obj_regularbullet) draw_self();` — every
  // regularbullet, hidden or not (with() ignores `visible`): in the stream
  // that is the spray swords (visible = false, the grey sword sheet), the
  // beams (no sprite on the definition — objects_kaizo.csv:142 — so nothing)
  // and their hitboxes (image_yscale 0 until armed, image_alpha 0 after).
  // helpers.drawSelf is the generic `draw_self()` — sprite by name, origin
  // from the manifest, image_index floored, image_blend multiplied. (Its one
  // extra, the frame-seeded split-tooth jitter, belongs to that object's own
  // Draw and would be wrong for a bare draw_self; teeth never share a turn
  // with the stream, so it cannot arise here.)
  for (const b of withOrder(state, isRegularbullet)) helpers.drawSelf(b, state);

  // Draw_0:16-25 — the grey streamlines (unchanged from vanilla).
  for (const l of withOrder(state, (x) => x.type.name === 'obj_knight_streamline')) {
    drawLineWidthColor(ctx, l, l.width, c_gray);
  }

  // Draw_0:26 — the mod's inner layer: the sword blue halved toward black.
  // merge_color's channel rounding is not measured; sim/gml.js's mergeColor
  // (the same rounding as gm.js's, and what the sim stores on each beam as
  // `blend2`) is used so the sim and the paint agree to the unit.
  const sword = getSwordcolor(state);
  const _ds = mergeColor(sword, c_black, 0.5);

  // Draw_0:27-50 — three passes over the beams, each a full with() sweep
  // before the next (the GML has three separate with-blocks, so every beam's
  // body is under every beam's inner layers, not interleaved per beam).
  const beams = withOrder(state, (x) => x.type.name === 'obj_bullet_knight_stream');
  for (const b of beams) drawLineWidthColor(ctx, b, b.width, sword);
  const pulse = Math.sin(state.frame * Math.PI); // `sin(global.time * pi)` — see the header
  for (const b of beams) {
    if (b.width > 8) drawLineWidthColor(ctx, b, b.width * (0.8 + (pulse * 0.2)), _ds);
  }
  for (const b of beams) {
    if (b.width > 8) drawLineWidthColor(ctx, b, b.width * (0.65 + (pulse * 0.2)), c_black);
  }

  // Draw_0:51 — scr_draw_in_box_end(), which also `exit`s without a box.
  // The restore pops the clip when one was cut and, either way, the stroke
  // state of the line calls (the save above is unconditional).
  ctx.restore();
  return true;
}

/**
 * The slasher's private surface — `fucking_sword_surface = surface_create(640,
 * 480)` (kaizo obj_knight_tunnel_slasher Create_0:29, freed in CleanUp_0:1-4).
 * Its lifetime is renderer-side; one 640x480 buffer for the module, made on
 * first use (never at import time: this module is imported by the kaizo
 * page and the kaizo render smoke, and only the smoke shims `document`).
 */
let swordSurface = null;
function getSwordSurface() {
  if (!swordSurface) {
    swordSurface = document.createElement('canvas');
    swordSurface.width = 640;
    swordSurface.height = 480;
  }
  return swordSurface;
}

/**
 * obj_knight_tunnel_slasher Draw_0:8-21 — `with (obj_growtangle)`: the arena
 * redrawn by the slasher, SHAKEN by (_sx, _sy), in the box's own Draw
 * order (obj_growtangle Draw_0, byte-identical in the mod):
 *
 *     visible = false;                                             -> SIM (knightlines.js draw slot)
 *     draw_sprite_ext(sprite_index, 1, x + _sx, y + _sy, image_xscale, image_yscale, image_angle, image_blend, image_alpha);
 *     if (customBox && growth && growcon != 2) {
 *         var _scale = sizer * growscale;
 *         draw_sprite_ext(spr_custom_box, 0, x + _sx, y + _sy, _scale, _scale, image_angle, image_blend, image_alpha);
 *     } else {
 *         draw_sprite_ext(sprite_index, image_index, x + _sx, y + _sy, image_xscale, image_yscale, image_angle, image_blend, image_alpha);   // draw_self()
 *     }
 *
 * The box's sprite is on its definition (spr_battlebg_0, objects_kaizo.csv:
 * 1518) and the sim never assigns it, so it resolves the way the vanilla
 * drawer does: `e.sprite_index ?? SPRITE_FOR.obj_growtangle`. ONE KNOWN
 * DEVIATION, shared with that drawer: for a custom arena — and the
 * PierceBlades board is one, 1.5 x 2.5 — the game's obj_growtangle Step_0:5
 * swaps `sprite_index = spr_battlebg_stretch_hitbox`, and sim/battlebox.js
 * keeps the mask swap but not the sprite one, so the redraw here paints
 * spr_battlebg_0 where the game paints the stretch sheet (both 75x75,
 * two-frame rings; the manifest has both). Carried as the sim has it, so
 * the shaken copy and the ordinary pass agree on the sheet. `growth` and
 * `sizer` are Step-locals the sim does not store (sim/battlebox.js computes
 * `growing` / `sizer` inline and keeps neither): re-derived from the same
 * test on the post-Step timer (obj_growtangle Step_0:30-38 — `timer <
 * maxtimer && growcon == 1`, or `timer > 0 && growcon == 3`), which is off
 * by one frame only at the two boundaries (timer == maxtimer just reached,
 * timer == 0 just reached). It cannot matter here: the slasher draws only
 * while attack_con > 1, by which time the board is parked at growcon 2
 * (sim/battlebox.js:29) — `growcon != 2` is false and the else arm runs —
 * and the slasher is swept before the board closes. spr_custom_box is not in
 * the manifest (header); the arm is kept for the record and draws nothing.
 */
function drawShakenBox(ctx, gt, sx, sy, helpers) {
  const { sprites, SPRITE_FOR } = helpers;
  const entry = sprites.get(gt.sprite_index ?? SPRITE_FOR.obj_growtangle);
  const xs = gt.image_xscale ?? 1;
  const ys = gt.image_yscale ?? 1;
  const ang = gt.image_angle ?? 0;
  const alpha = gt.image_alpha ?? 1;
  const blend = tintOf(gt.image_blend, helpers);
  drawSpriteExt(ctx, entry, 1, gt.x + sx, gt.y + sy, xs, ys, ang, blend, alpha);
  const growth = (gt.timer < gt.maxtimer && gt.growcon === 1) || (gt.timer > 0 && gt.growcon === 3);
  if (gt.customBox && growth && gt.growcon !== 2) {
    const sizer = gt.maxtimer ? gt.timer / gt.maxtimer : 0;
    const _scale = sizer * (gt.growscale ?? 2);
    drawSpriteExt(ctx, sprites.get('spr_custom_box'), 0, gt.x + sx, gt.y + sy, _scale, _scale, ang, blend, alpha);
  } else {
    drawSpriteExt(ctx, entry, Math.floor(gt.image_index ?? 0), gt.x + sx, gt.y + sy, xs, ys, ang, blend, alpha);
  }
}

/**
 * obj_knight_tunnel_slasher Draw_0:30-58 — the sword surface:
 *
 *     surface_set_target(fucking_sword_surface);
 *     draw_clear_alpha(c_black, 0);
 *     with (obj_regularbullet) {
 *         if (variable_instance_exists(id, "flag")) {
 *             if (flag == "C") {
 *                 visible = false;                                                        -> SIM
 *                 draw_sprite_ext(sprite_index, image_index, screenx(), screeny(), image_xscale, yscale, image_angle, image_blend, image_alpha);
 *             } else if (flag == "D") {
 *                 visible = false;                                                        -> SIM
 *                 var _secretswordblend = image_blend;
 *                 if (sprite_index == spr_roaringknight_sword_ol_alt) _secretswordblend = 16777215;
 *                 draw_sprite_ext(sprite_index, image_index, screenx() + _sx, screeny() + _sy, image_xscale, yscale, image_angle, _secretswordblend, image_alpha);
 *             }
 *         }
 *     }
 *     gpu_set_blendmode(bm_subtract);
 *     draw_set_color(c_white);
 *     draw_rectangle(0, 0, screenx(gt_minx() + 4), 480);
 *     gpu_set_blendmode(bm_normal);
 *     surface_reset_target();
 *     draw_surface(fucking_sword_surface, camerax(), cameray());
 *
 * A flag-C sword (on its lane, telegraphing) is drawn UNSHAKEN; a flag-D sword
 * (embedded) shakes with the arena. Both use `yscale` — the PLAIN instance
 * variable the carousel sets to 1.25 (Other_21, knightlines.js "load-
 * bearing"), NOT image_yscale (0.3 while telegraphing, so the hitscan mask
 * is thin) — which is why the drawn blade is full height while its mask is
 * not. Subtracting c_white takes every channel of the rectangle to 0, alpha
 * included, so clearRect is the exact translation: everything left of the
 * wall + 4 is erased before the surface is composited, and the embedded
 * swords read as driven INTO the wall rather than through it. The surface
 * is screen space (screenx = x - camerax), and draw_surface at (camerax,
 * cameray) puts it back at world = camera, i.e. (state.view.x, state.view.y)
 * on the seam's view-translated ctx. `draw_set_color(c_white)` leaks past
 * the event as GML draw state; nothing later in this family reads the draw
 * colour (every line call passes its own), so there is nothing to carry.
 */
function drawSwordSurface(ctx, state, sx, sy, helpers) {
  const { sprites } = helpers;
  const surf = getSwordSurface();
  const g = surf.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, 640, 480); // draw_clear_alpha(c_black, 0)
  const vx = state.view.x;
  const vy = state.view.y;
  for (const b of withOrder(state, isRegularbullet)) {
    if (b.flag === undefined) continue; // variable_instance_exists(id, "flag")
    const entry = sprites.get(b.sprite_index);
    const sub = Math.floor(b.image_index ?? 0);
    const ys = b.yscale ?? b.image_yscale ?? 1; // `yscale`, the plain var — see above
    if (b.flag === 'C') {
      drawSpriteExt(g, entry, sub, b.x - vx, b.y - vy,
        b.image_xscale ?? 1, ys, b.image_angle ?? 0, tintOf(b.image_blend, helpers), b.image_alpha ?? 1);
    } else if (b.flag === 'D') {
      let _secretswordblend = b.image_blend;
      if (b.sprite_index === 'spr_roaringknight_sword_ol_alt') _secretswordblend = helpers.C_WHITE_GM; // 16777215
      drawSpriteExt(g, entry, sub, (b.x - vx) + sx, (b.y - vy) + sy,
        b.image_xscale ?? 1, ys, b.image_angle ?? 0, tintOf(_secretswordblend, helpers), b.image_alpha ?? 1);
    }
  }
  // bm_subtract + c_white over (0, 0)..(screenx(gt_minx() + 4), 480), inclusive.
  // gt_minx() without a board is GML `undefined` and the arithmetic would
  // throw in the game; the slasher never runs without one, so a missing
  // board just skips the erase rather than inventing a wall.
  const gt = growtangle(state);
  if (gt) {
    const edge = (gtMinx(gt) + 4) - vx;
    g.clearRect(0, 0, edge + 1, 481);
  }
  ctx.drawImage(surf, vx, vy); // draw_surface(surf, camerax(), cameray())
}

/**
 * obj_knight_tunnel_slasher — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/canvas.js DRAW_EVENTS.obj_knight_tunnel_slasher —
 * the pose blitted at `y + sin(fulltimer * 0.1) * 2` (its own clock, not
 * global.time); returns true.
 * Sim side: kaizo/attacks/knightlines.js.
 *
 * PORTED (supersedes the paragraph above). Draw_0:1 is the vanilla pose;
 * everything after it is the mod's PierceBlades pipeline, live only in mode
 * 1 (attack_type == 1, ac 110) once the carousel has thrown (attack_con > 1):
 *
 *     :1     draw_sprite_ext(sprite_index, image_index, x, y + (sin(fulltimer * 0.1) * 2), image_xscale, image_yscale, image_angle, image_blend, image_alpha);
 *     :2-4   if (attack_type == 1) if (attack_con > 1) {
 *     :6-7   var _sx = random_range(-at_gshake, at_gshake); var _sy = ...;   -> SIM (knightlines.js endStep: e.shake_x / e.shake_y)
 *     :8-21  with (obj_growtangle) { visible = false; ...redrawn shaken... }  -> drawShakenBox
 *     :22-29 with (obj_afterimage) if (sprite_index == spr_roaringknight_sword_ol_alt) { visible = false; draw_self(); }
 *     :30-58 the sword surface                                             -> drawSwordSurface
 *     :59-63 with (obj_tracking_sword1) { visible = false; event_perform(ev_draw, ev_draw_normal); }
 *     :64-72 with (obj_grazebox) { visible = false; x += _sx; y += _sy; event_perform(ev_draw, ev_draw_normal); x -= _sx; y -= _sy; }
 *     :73-81 with (obj_heart)    { visible = false; x += _sx; y += _sy; event_perform(ev_draw, ev_draw_normal); x -= _sx; y -= _sy; }
 *     :82-86 with (obj_dmgwriter) { visible = false; event_perform(ev_draw, ev_draw_normal); }
 *     :87-88 } }
 *
 * The shape of it: the slasher hides the board, the soul, the graze ring, the
 * embedded swords and the damage numbers, and repaints them all itself at
 * ITS depth, jolted by the same (_sx, _sy) — so an embed shakes the whole
 * arena as one picture. The hides are sim state (knightlines.js `draw`),
 * which is what keeps the ordinary pass from drawing the board and the swords
 * a second time at their own depths. Their lifetime, for the record: the
 * slot hides while attack_con is 2 or 3 and knightTunnelSlasherCleanUp
 * restores at the 3 -> 4 write that ends the turn, which is the frame the
 * kaizo director's sweep lands on (header, "WHERE THAT STATE SITS IN
 * TIME"); this override, gated on attack_con > 1 like the GML, therefore
 * never paints a frame at 4 in the fight — the slasher is gone before the
 * next paint — and the arena returns to the ordinary pass unshaken.
 *
 * NOT REPRODUCED, and why — three of the four event_performs target things
 * that are not entities in this engine and are painted by late passes in
 * render/canvas.js that ignore `visible`:
 *   * obj_heart (:73-81): state.soul, drawn by draw()'s soul pass after the
 *     entity loop. Drawing a shaken copy here would put TWO hearts on screen
 *     (the late pass still draws the unshaken one), which is worse than the
 *     deviation it fixes; the soul therefore does not jolt with the arena
 *     and sits over everything drawn after the slasher. The sim still
 *     records the hide/restore (soul.visible) for fidelity of state.
 *   * obj_grazebox (:64-72): state.grazeTimer, render/graze.js — same late
 *     pass problem; the ring does not jolt. (The mod's CleanUp forgets
 *     obj_grazebox's `visible` — knightlines.js header — a quirk with no
 *     renderer-side counterpart here.)
 *   * obj_dmgwriter (:82-86): state.dmg.list, render/draw/dmgnumbers.js,
 *     screen space after the arena; the numbers draw where they always do.
 * obj_tracking_sword1 (:59-63) IS an entity: hidden by the sim, redrawn here
 * through helpers.drawVanilla — its own Draw event (identical in both
 * dumps), at the slasher's depth, as event_perform runs it.
 */
export function drawObjKnightTunnelSlasher(ctx, e, state, helpers) {
  const { sprites, blit } = helpers;

  // Draw_0:1 — the pose, on the instance's own clock.
  const pose = sprites.get(e.sprite_index);
  if (pose && pose.frames.length) {
    blit(frameOf(pose, e.image_index), pose.meta.ox, pose.meta.oy,
      e.x, e.y + (Math.sin(e.fulltimer * 0.1) * 2),
      e.image_xscale ?? 1, e.image_yscale ?? 1, e.image_angle ?? 0,
      e.image_alpha ?? 1, tintOf(e.image_blend, helpers));
  }

  if (e.attack_type === 1) { // :2
    if (e.attack_con > 1) { // :4
      // :6-7 — this frame's two shake draws, rolled by the sim's endStep from
      // the shared stream (knightlines.js), never here.
      const _sx = e.shake_x ?? 0;
      const _sy = e.shake_y ?? 0;

      // :8-21
      for (const gt of withOrder(state, (x) => x.type.name === 'obj_growtangle')) {
        drawShakenBox(ctx, gt, _sx, _sy, helpers);
      }

      // :22-29 — the secretswords ghosts; dormant (secretswords is never 1
      // in the dump), translated so the day it is not, this is already here.
      for (const a of withOrder(state, (x) => x.type.name === 'obj_afterimage')) {
        if (a.sprite_index === 'spr_roaringknight_sword_ol_alt') helpers.drawSelf(a, state);
      }

      // :30-58
      drawSwordSurface(ctx, state, _sx, _sy, helpers);

      // :59-63 — `event_perform(ev_draw, ev_draw_normal)` on each tracking
      // sword: its Draw event, the vanilla drawer plus tail, here.
      for (const t of withOrder(state, (x) => x.type.name === 'obj_tracking_sword1')) {
        helpers.drawVanilla(t, state);
      }

      // :64-72 obj_grazebox, :73-81 obj_heart, :82-86 obj_dmgwriter — not
      // reproduced; see the function comment.
    }
  }
  return true;
}

/**
 * obj_knight_tunnel_slasher_2_revised — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/canvas.js DRAW_EVENTS.obj_knight_tunnel_slasher_2_revised
 * — `ymod = sin(siner / 30) * 8`; when the body is spr_roaringknight_noarm
 * the arm (spr_roaringknight_armpoint, frame `armpoint_index`, rotated by
 * `armpoint`) at (x + 116, y + 62 + ymod) FIRST, then the body at y + ymod;
 * returns true. `siner` is advanced by the sim, not the renderer.
 * Sim side: kaizo/attacks/sword-tunnel-revised.js (also chained by
 * combination.js).
 *
 * PORTED (supersedes the paragraph above). The kaizo Draw_0, in order:
 *
 *     :1  siner++;                                                     -> SIM (sword-tunnel-revised.js `tunnelSlasher2.draw`: `e.siner += 1`)
 *     :2  var ymod = sin(siner / 30) * 8;
 *     :3  if (sprite_index == spr_roaringknight_noarm)
 *     :5      draw_sprite_ext(spr_roaringknight_armpoint, armpoint_index, x + 116, y + 62 + ymod,
 *                 image_xscale, image_yscale, armpoint, image_blend, image_alpha);
 *     :7  draw_sprite_ext(sprite_index, image_index, x, y + ymod, image_xscale, image_yscale, image_angle, image_blend, image_alpha);
 *     :8-16 if ((siner % 4) == 0 && image_alpha != 0) { fade = scr_afterimage(); ... fade.hspeed = 3; fade.vspeed = random_range(...); }
 *                                                                       -> SIM (sword-tunnel-revised.js, incl. the random_range)
 *
 * The seven draw lines are byte-identical to vanilla (diffed); the mod's one
 * change, :14 `fade.hspeed = 4` -> 3, is state and already on the sim. The
 * vanilla inline handler in canvas.js is the same two calls — this is the
 * same translation written against the kaizo file, so the family reads one
 * way: the renderer sees `siner` after the sim's increment, which is the
 * value the GML's own `siner++` leaves for line 2.
 *
 * DEPTH (verification pass): the object definition's 0 (objects_kaizo.csv:
 * 804) is now ASSIGNED by kaizo/attacks/sword-tunnel-revised.js create —
 * before that the instance carried no depth at all and sorted as 0 only
 * through the pass's `?? 0`. Same order, but a number where the GML has
 * one, so this paints at the depth the game paints at by state rather than
 * by fallback.
 */
export function drawObjKnightTunnelSlasher2Revised(ctx, e, state, helpers) {
  const { sprites, blit } = helpers;
  const ymod = Math.sin((e.siner ?? 0) / 30) * 8; // :2
  const xs = e.image_xscale ?? 1;
  const ys = e.image_yscale ?? 1;
  const alpha = e.image_alpha ?? 1;
  const blend = tintOf(e.image_blend, helpers);
  if (e.sprite_index === 'spr_roaringknight_noarm') { // :3
    const arm = sprites.get('spr_roaringknight_armpoint');
    if (arm && arm.frames.length) {
      blit(frameOf(arm, e.armpoint_index), arm.meta.ox, arm.meta.oy, // :5
        e.x + 116, e.y + 62 + ymod, xs, ys, e.armpoint ?? 0, alpha, blend);
    }
  }
  const body = sprites.get(e.sprite_index);
  if (body && body.frames.length) {
    blit(frameOf(body, e.image_index), body.meta.ox, body.meta.oy, // :7
      e.x, e.y + ymod, xs, ys, e.image_angle ?? 0, alpha, blend);
  }
  return true;
}

/**
 * obj_knight_diamondswordbullet_ext — the revised tunnel's blades
 * (atk_Tunnel2, ac 15; also the combination's tunnel segment).
 *
 * NOT ONE OF THE MOD'S 24 CHANGED DRAWS: the kaizo Draw_0 is byte-identical
 * to vanilla (diffed 2026-09-08). It is here because NEITHER renderer had a
 * drawer for it — render/canvas.js DRAW_EVENTS has no entry, so the generic
 * blit drew the blade with `image_blend` (never set: white) and ignored the
 * r/g/b fields the Step fades. On the kaizo page that hid the ONE visible
 * change the mod made to this object: the wall turning blue while it shakes
 * (kaizo/attacks/sword-tunnel-revised.js, Step_0:4-5). The vanilla page has
 * the same hole (its wall should turn red) — a candidate port-back to
 * knight-sim's DRAW_EVENTS, recorded in the ledger; this entry is the kaizo
 * fill with its receipt (Law 6, CLAUDE.md).
 *
 * The whole event (gml_Object_obj_knight_diamondswordbullet_ext_Draw_0.gml):
 *
 *     1  var color = make_color_rgb(r, g, b);
 *     2  draw_sprite_ext(sprite_index, image_index,
 *            x + irandom_range(-shakeme, shakeme),
 *            y + irandom_range(-shakeme, shakeme),
 *            image_xscale, image_yscale, image_angle, color, image_alpha);
 *
 * THE JITTER IS THE GAME'S OWN, NOT FRAME-SEEDED. Line 2's two irandom_range
 * are four u32 off the shared stream every frame per live blade, and the sim
 * already consumes them in the type's draw slot (sword-tunnel-revised.js
 * diamondSwordBullet.draw, "the extended blade draws four u32 a frame",
 * ledger 2026-09-02) and parks them as `e.extJitter = {x, y}` — the same
 * arrangement the split tooth uses (`drawJitterXs`). This drawer READS those;
 * it never draws RNG of its own (STRATEGY §2 "Rules for consuming Draw-event
 * RNG"). On an entity's creation frame the slot has not run yet and the
 * jitter is zero, which is also what `irandom_range(-0, 0)` returns for an
 * unshaken blade.
 *
 * No draw_self: returns TRUE. A missing sprite returns FALSY so the tail's
 * mask fallback still shows the collision shape.
 */
export function drawObjKnightDiamondswordbulletExt(ctx, e, state, helpers) {
  const entry = helpers.sprites.get(e.sprite_index);
  if (!entry || !entry.frames.length) return false;
  const jx = e.extJitter ? e.extJitter.x : 0;
  const jy = e.extJitter ? e.extJitter.y : 0;
  drawSpriteExt(ctx, entry, Math.floor(e.image_index ?? 0), // :2
    e.x + jx, e.y + jy,
    e.image_xscale ?? 1, e.image_yscale ?? 1, e.image_angle ?? 0,
    diamondswordbulletExtColor(e), e.image_alpha ?? 1);
  return true;
}

/**
 * Draw_0:1 `make_color_rgb(r, g, b)` as this engine's tint. The fields are
 * reals mid-ramp (255 - 21.25k: 233.75, 212.5, 191.25, ...), and
 * make_color_rgb packs them to integer channels; whether the runner
 * TRUNCATES or ROUNDS there is UNMEASURED (the same open question as
 * merge_color's, ledger G9) — truncation is taken, the way the packed-int
 * builders in this repo do, and the difference is at most one unit per
 * channel on four of the twelve shake frames. Exported so
 * kaizo/tools/checks/check-colours.mjs can pin the ramp without a canvas.
 */
export function diamondswordbulletExtColor(e) {
  return [Math.trunc(e.r ?? 255), Math.trunc(e.g ?? 255), Math.trunc(e.b ?? 255)];
}
