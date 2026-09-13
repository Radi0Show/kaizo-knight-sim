// KAIZO DRAW — the Weird Route's SnowGrave (V-D only: obj_spell_snowgrave and
// its snowflakes, kaizo/party/scenes.js). PORTED: both exports below are
// translations of the KAIZO Draw_0 events, call for call, in order — the
// stub-era notes are kept underneath because the questions they raise were
// this port's first work.
//
// Contract and helpers: kaizo/render/index.js. Neither object exists in the
// vanilla sim, so "vanilla" here is the renderer's DEFAULT path only — the
// generic sprite blit in render/canvas.js drawEntity — never a ported Draw.
// The model for a port is any render/draw/*.js file on render/draw/gm.js.
//
// The kaizo GML (read-only, never copied here):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/gml_Object_<obj>_Draw_0.gml
// (these are DELTARUNE's own spell objects; the vanilla dump has them too,
// under gml_vanilla_v105/CodeEntries/ — diff the pair before porting).
//
// ═══ WHAT THE MOD CHANGED (diff gml_vanilla_v105 -> gml_kaizo_dump) ═════════
//
//   obj_spell_snowgrave Draw_0
//     :123  `draw_set_alpha(1);` added after the wash rectangle — vanilla
//           leaked `bgalpha` as the draw alpha for the rest of the frame.
//           Here every call sets its own globalAlpha, so the leak never
//           existed to fix; nothing to port, noted so the diff is accounted.
//     :165  the whole damage block (:167-206) wrapped in
//           `if (!i_ex(obj_knight_enemy))` — THE NEUTERING. Sim side:
//           kaizo/party/scenes.js (snowgraveSpell's header). Draws nothing.
//   obj_spell_snowgrave_snowflake Draw_0 — REWRITTEN:
//     vanilla: draw_self(); two side copies, unconditionally, at scale 2.
//     kaizo:   draw_self(); side copies ONLY while `siner != 0`, at
//              `2 * flakescale`; otherwise, at con >= 1, `repeat (2)
//              draw_self()` — a gathered flake is painted three times over.
//   obj_spell_snowgrave_snowflake Create_0 (+con, tarX/tarY, tardep,
//   flakenum, flakescale) and Step_0 (the whole con machine) are the sim's.
//
// ═══ WHERE THE VISUALS COME FROM — MEASURED ═════════════════════════════════
//
// The stub-era note below asks it. Answer, off the OBJECT DEFINITIONS of the
// mod's data (UTMT Data.GameObjects / Data.Sprites; the code dump cannot show
// any of this, CLAUDE.md "The OBJECT DEFINITION holds more than the sprite"):
//
//   obj_spell_snowgrave            sprite spr_icespell_snowflake  depth 0  visible True
//   obj_spell_snowgrave_snowflake  sprite spr_icespell_snowflake  depth 0  visible True
//   spr_icespell_snowflake   46x46, origin (23,23), 1 frame, bbox [2,2,42,44]
//   bg_snowfall              64x64, origin (0,0),   1 frame — a SPRITE in this
//                            data (draw_background_tiled_ext is the GMS2
//                            compat shim: gml_GlobalScript_draw_background_
//                            tiled_ext.gml -> draw_sprite_tiled_ext(spr, 0, ...))
//
// No event on either object writes `visible`, so the sim's `visible = false`
// was the sim's own pin — lifted in kaizo/party/scenes.js with the citation.
//
// MISSING SPRITES (neither assets/sprites nor kaizo/assets/sprites carries
// them; code against the names, draw nothing when absent):
//   spr_icespell_snowflake   the flake itself (draw_self and both copies)
//   bg_snowfall              the two scrolling snow layers
// The kaizo overlay is built by kaizo/tools/pack-kaizo-sprites.mjs from the
// private repo's dumps; add these two names to that extraction.
//
// ═══ WHAT IS NOT A DRAW CALL IN obj_spell_snowgrave Draw_0 ══════════════════
//
//   :3-20, :22-118, :159-164, `+ altpath * 30` everywhere — the altpath == 1
//        arm: Berdly's encounter 82 (Noelle's fn marker, Berdly's fb marker,
//        the dust, the bell). altpath is pinned 0 for the Knight (encounter
//        115). NOT PORTED; the guards are kept so the structure reads.
//   :21  timer++                      sim: snowgraveSpell.endStep
//   :127-137, :208-221  bgalpha / snowspeed advance   sim: snowgraveSpell.draw
//   :138-141  audio_play_sound(snd_snowgrave, 50, 0) at timer == 1 — a cue,
//        not a draw; the sim does not cue it today (reported).
//   :142-158  the flake spawner            sim: snowgraveSpell.endStep
//        (`stimer` there is write-only — incremented, reset at 8, read nowhere)
//   :165-207  the neutered damage block. Inside it, :179 and :185
//        `round(random(100))` are RNG in a Draw — gated off by
//        `!i_ex(obj_knight_enemy)` so never drawn in this fight; reported, not
//        modelled (kaizo/party/scenes.js already says the spell spends zero).
//   :222-234  instance_destroy at timer 120 (+150 on altpath)   sim: endStep
//
// ═══ DRAW-TIME STATE the sim now carries for these two Draws ═══════════════
//   (kaizo/party/scenes.js, each with its GML line)
//   spell   bgalphaDrawn / snowspeedDrawn — the values :121-126 read, snapped
//           before :127-137 / :208-221 advance them in the same event.
//   flake   image_xscale / image_yscale — Step_0:1-10, computed at the top
//           of the Step from the PRE-increment siner and last frame's
//           flakescale; the obj_lerpvar tweens scr_lerpvar arms on a flake
//           (flakescale, image_alpha), stepped per obj_lerpvar Step_0.
//
//   VERIFIED (adversarial pass, a scratch probe over 700 frames of the
//   check-scenes.mjs setup, Kris pinned as target, 168 flakes / 13,190
//   flake-frames): the sim's bgalphaDrawn / snowspeedDrawn equal a hand-run
//   model of :127-137 / :208-221 on every paint from timer 1 on; a con-0
//   flake's image_xscale is sin(previous paint's siner) * 2 * flakescale and
//   siner is +1 per paint (Step_0:3,13); a con-1 flake's siner halves to 0
//   (Step_0:27-31) and its scales are 2 * the flakescale standing BEFORE
//   that frame's tween write (obj_lerpvar index 1585 steps after the flake's
//   1427); the tween's first write lands the frame after arming and reaches
//   `to` on its last (Step_0:21-25,42-45); tardep is 199 for slot 0 and the
//   flake drops to it within 120px. image_xscale differs from the GML double
//   by f32 rounding only (sim/entity.js stores it f32; ~3e-8, sub-pixel).
//   TWO ORDERINGS THIS RESTS ON THAT ARE NOT MEASURED against the game:
//     - whether an obj_lerpvar created mid-Step (knight index 344 or the
//       flake 1427, the tween 1585 — later in the walk either way) also runs
//       its first Step THAT frame. The sim says next frame — sim/lerpvar.js
//       "ORDERING", the vanilla fight's model, mirrored here; if the game
//       steps it the same frame, every tween here is one frame late.
//     - same-depth paint order: the spell (depth 0) and its flakes (depth 0
//       until the throw) tie, and render/canvas.js breaks ties by seq, older
//       first, so the wash lies UNDER the flakes — the look the spell is
//       built for. GameMaker's own tie rule is not pinned anywhere in this
//       repo (CLAUDE.md, docs/); canvas.js is not this file's to change.
//
// ═══ DEPTH — MEASURED, and one sim pin corrected by this port ═══════════════
//
//   spell   object-definition 0 (knight-research/kaizo-mod/sprites/
//           objects_kaizo.csv, the mod's data), never written by any of its
//           events nor by scr_spell:268-270 — the sim's `e.depth = 0` is it.
//           The wash therefore paints over everything at depth > 0 (the
//           fountain backdrop, the party at 200/180/160, the Knight at 88,
//           the box at 5) and under everything below 0.
//   flake   Create_0:9 `tardep = depth` (0 at birth, the same definition).
//           obj_knight_enemy Step_0:1669
//           `_tarDepth = global.charinstance[k_sgtarget].depth - 1` and :1681
//           write it to every flake for the throw; the flake's Step_0:57-60
//           then drops to it within 120px of its target. The party's battle
//           depth is obj_battlecontroller Create_0:192 `200 - (i * 20)`
//           (kaizo/party/roster.js slotDepth; the 200/180/160 sim/actors.js
//           measured off the flurry2 trace), so the throw depth is
//           199/179/159 by slot. kaizo/party/scenes.js carried `tardep = -1`
//           (charinstance's depth read as 0, over everything) until this
//           port's depth check; it now writes slotDepth(target) - 1, cited
//           there. Draw order only — no check pins it, no RNG moves.
//
// ═══ WHAT THE FLAKES LEAVE BEHIND, AND IS NOT DRAWN ═════════════════════════
//
//   Step_0:79-82 `with (scr_afterimagefast()) depth = other.depth;` — every
//   con-3 frame each charging flake creates an obj_afterimage carrying its
//   sprite_index / image_index / image_blend / scales / angle, fadeSpeed
//   0.08 (gml_GlobalScript_scr_afterimagefast.gml:3-12). obj_afterimage has
//   no Draw event: draw_self, image_alpha down 0.08 a frame, destroyed under
//   0 (gml_Object_obj_afterimage_Step_0.gml:1-5). That trail is INSTANCES,
//   not draw calls of either object here, and the sim does not spawn them
//   (kaizo/party/scenes.js con 3: "scr_afterimagefast() every frame — no
//   RNG"). Spawning them is a sim decision, not a renderer's — every later
//   instance's seq moves, and seq is what the split teeth's frame-seeded
//   jitter is keyed on — so the trail is REPORTED, not drawn. Cheap the day
//   it is wanted: the copies are pure draw state.
//
//   The SPELL's Draw at timer == 1 plays snd_snowgrave (:138-141) — a cue,
//   not a draw; the sim's spell does not cue it (its endStep could, through
//   sim/audio.js cue()). Reported, not added: audio is not Draw-time state.
//
// ═══ ONE FRAME THIS PORT CANNOT SETTLE ═════════════════════════════════════
//
//   A flake is created INSIDE the spell's Draw (:145-147). Whether GameMaker
//   paints an instance created mid-Draw-pass on that same frame is NOT
//   measured (it depends on where the new instance lands in the depth-walked
//   list — depth 0, the spell's own). The sim paints it that frame: the
//   spawner is the spell's endStep, the draw slot runs after (timer 0, so
//   Create_0:1-2's 2 x 2 — the `timer > 0` guard in scenes.js), and siner is
//   already the spawner's timer / 2, so the two side copies are there from
//   birth. If the game skips that first paint, the port is one frame early
//   on a flake's first appearance, and only there.
//
// ═══ PRIMITIVES gm.js does not have, implemented here ═══════════════════════
//   draw_rectangle_colour (the top-pair / bottom-pair vertical form)
//   draw_sprite_tiled_ext (via the compat shim above)
//
// ── stub-era notes, kept verbatim (the measurements above answer them) ──────
//
// NEITHER STUB HAS EVER RUN, and that is the port's first question. MEASURED
// by kaizo/tools/checks/check-render-smoke-kaizo.mjs (its V-D run casts the
// spell on frame 0): the spell and up to 90 live snowflakes exist, and every
// one keeps the `visible = false` its Create assigns for its whole life. The
// renderer filters invisible instances out before the seam — GameMaker's own
// rule, no Draw event for an invisible instance — so until the sim makes
// them visible (or the port decides their visuals come from somewhere else,
// e.g. the caster's scene), nothing here can draw.

import { drawSpriteExt, rgb, c_white, clamp01 } from '../../../render/draw/gm.js';

/** The object-definition sprite of both objects (measured, see the header). */
const SNOWFLAKE_SPRITE = 'spr_icespell_snowflake';
/** `bg_snowfall` — the tiled snow sheet, drawn at scale 2 (128x128 tiles). */
const SNOWFALL_SPRITE = 'bg_snowfall';

/**
 * GML `c_blue` is 16711680 — colours are BGR integers, so that is
 * r = 16711680 & 255 = 0, g = (>> 8) & 255 = 0, b = (>> 16) & 255 = 255.
 */
const C_BLUE = [0, 0, 255];

/**
 * `draw_rectangle_colour(x1, y1, x2, y2, col1, col2, col3, col4, false)` —
 * the FILLED quad with a colour per corner (top-left, top-right,
 * bottom-right, bottom-left). GameMaker renders it as two Gouraud triangles;
 * when the top pair and the bottom pair match, as the one call here does,
 * both triangles interpolate purely along y and the result is exactly a
 * vertical linear gradient from `top` to `bottom`. Only that form is
 * implemented. GML's filled rectangle covers x1..x2 and y1..y2 INCLUSIVE,
 * hence the + 1 on each side. `alpha` is the `draw_set_alpha` in force.
 */
function drawRectangleColourVertical(ctx, x1, y1, x2, y2, top, bottom, alpha) {
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  const g = ctx.createLinearGradient(0, y1, 0, y2);
  g.addColorStop(0, rgb(top));
  g.addColorStop(1, rgb(bottom));
  ctx.fillStyle = g;
  ctx.fillRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
  ctx.restore();
}

/**
 * `draw_sprite_tiled_ext(sprite, subimg, x, y, xscale, yscale, colour, alpha)`
 * — the sprite repeated across the whole view, one tile's ORIGIN at (x, y)
 * and the rest on a `w * xscale` by `h * yscale` grid from there. The grid
 * anchor formula is the one render/draw/intro-fx.js tiledArea already uses
 * for scr_draw_sprite_tiled_area (translated, not measured): the first
 * column/row is the last grid line at or before the view's edge, minus one
 * tile so a partial tile at the edge is never skipped. Fractional offsets are
 * kept — the snow's x scroll is `snowspeed / 1.5` — as every drawer here
 * keeps them. `color` null = c_white (an identity multiply).
 */
function drawSpriteTiledExt(ctx, entry, sub, x, y, xs, ys, color, alpha, vx, vy, W, H) {
  if (!entry || !entry.frames.length) return;
  const tw = (entry.meta.w ?? 0) * xs;
  const th = (entry.meta.h ?? 0) * ys;
  if (!(tw > 0) || !(th > 0)) return;
  const ox = (entry.meta.ox ?? 0) * xs;
  const oy = (entry.meta.oy ?? 0) * ys;
  // Grid in top-left terms, then back to origin terms for drawSpriteExt.
  const px = x - ox;
  const py = y - oy;
  const startX = px + Math.ceil((vx - px) / tw - 1) * tw;
  const startY = py + Math.ceil((vy - py) / th - 1) * th;
  for (let ty = startY; ty < vy + H; ty += th) {
    if (ty + th <= vy) continue;
    for (let tx = startX; tx < vx + W; tx += tw) {
      if (tx + tw <= vx) continue;
      drawSpriteExt(ctx, entry, sub, tx + ox, ty + oy, xs, ys, 0, color, alpha);
    }
  }
}

/**
 * obj_spell_snowgrave — kaizo Draw_0, the three draw calls of the altpath 0
 * arm, in order. No draw_self: returns true.
 *
 *     xx = __view_get(e__VW.XView, 0); yy = __view_get(e__VW.YView, 0);   :1-2
 *     timer++;                                                            :21
 *     if (timer > 0) {                                                    :119
 *         draw_set_alpha(bgalpha);                                        :121
 *         draw_rectangle_colour(xx - 10, yy - 10, xx + 700, yy + 500,
 *                               c_white, c_white, c_blue, c_blue, false);  :122
 *         draw_set_alpha(1);                                              :123
 *     }
 *     draw_background_tiled_ext(bg_snowfall, snowspeed / 1.5, timer * 6,
 *                               2, 2, c_white, bgalpha);                  :125
 *     draw_background_tiled_ext(bg_snowfall, snowspeed, timer * 8,
 *                               2, 2, c_white, bgalpha * 2);              :126
 *
 * The wash is a white-to-blue vertical gradient over the whole view (710 x
 * 510 from 10px outside the top-left corner) at `bgalpha`, which ramps
 * 0 -> 0.5 over the first ten frames and back down 0.02 a frame from timer
 * 90; the two snow sheets slide sideways at `snowspeed` (growing 20 + timer/5
 * a frame) and downward at 6 / 8 px a frame, the nearer one twice as bright.
 * `timer` is already post-increment (sim endStep); `bgalpha` / `snowspeed`
 * are the pre-advance snapshots the sim's draw slot leaves (falling back to
 * the live values on a frame before that slot has run — creation frame only,
 * where both are 0 and nothing is visible either way).
 *
 * Depth: object-definition 0, on the sim entity — this runs at it in the
 * sorted pass. The ctx arrives translated by -view, so `xx`/`yy` are
 * `state.view` and the coordinates below are world coordinates.
 */
export function drawObjSpellSnowgrave(ctx, e, state, helpers) {
  const { sprites, VIEW_W, VIEW_H } = helpers;
  const xx = state.view?.x ?? 0;                        // :1
  const yy = state.view?.y ?? 0;                        // :2
  const timer = e.timer ?? 0;                           // post :21
  const bgalpha = e.bgalphaDrawn ?? e.bgalpha ?? 0;     // as read at :121, :125, :126
  const snowspeed = e.snowspeedDrawn ?? e.snowspeed ?? 0; // as read at :125, :126
  // :22-118 — altpath == 1 only (Berdly); not ported, never reached here.

  if (timer > 0) {                                      // :119
    // :121-123 — draw_set_alpha(bgalpha) ... draw_set_alpha(1): the alpha is
    // scoped to this one call here, which is what the mod's added reset does.
    drawRectangleColourVertical(ctx, xx - 10, yy - 10, xx + 700, yy + 500,
      c_white, C_BLUE, bgalpha);                        // :122
  }
  const snow = sprites.get(SNOWFALL_SPRITE);            // packed 2026-09-12 (G-43)
  // :125 — the far sheet, at bgalpha
  drawSpriteTiledExt(ctx, snow, 0, snowspeed / 1.5, timer * 6, 2, 2, null,
    bgalpha, xx, yy, VIEW_W, VIEW_H);
  // :126 — the near sheet, faster and at bgalpha * 2 (clamped by the primitive)
  drawSpriteTiledExt(ctx, snow, 0, snowspeed, timer * 8, 2, 2, null,
    bgalpha * 2, xx, yy, VIEW_W, VIEW_H);
  // :127-234 — state, sound, the spawner, the neutered damage, the destroy:
  // none is a draw call (header). Nothing else paints.
  return true;
}

/**
 * obj_spell_snowgrave_snowflake — kaizo Draw_0, verbatim:
 *
 *     draw_self();                                                        :1
 *     if (siner != 0) {                                                   :2
 *         draw_sprite_ext(sprite_index, image_index, x + (sin(siner / 3) * 30), y,
 *             sin(siner / 3) * 2 * flakescale, 2 * flakescale, 0, c_white, image_alpha);  :4
 *         draw_sprite_ext(sprite_index, image_index, x - (sin(siner / 3) * 30), y,
 *             sin(siner / 3) * 2 * flakescale, 2 * flakescale, 0, c_white, image_alpha);  :5
 *     } else if (con >= 1) {                                              :7
 *         repeat (2) { draw_self(); }                                     :9-12
 *     }
 *
 * draw_self() is sprite_index (the object's spr_icespell_snowflake, measured)
 * at image_index, x, y, image_xscale, image_yscale (Step_0:1-10, on the sim's
 * draw slot), image_angle (never written: 0), image_blend (never written:
 * c_white -> null), image_alpha. The side copies read the POST-Step siner
 * and flakescale, which is what the entity holds by paint time; their
 * xscale goes NEGATIVE with sin(siner / 3) and the sign is kept (a mirrored
 * flake). `siner != 0` is exact here: siner is a half-integer >= 10 at birth,
 * halves until |siner| < 1 and is then written 0 (Step_0:27-31), or is
 * written 0 outright (con >= 2), so no epsilon question arises. A gathered
 * flake (siner 0, con >= 1) is painted three times over — at image_alpha
 * under 1 that reads as brighter, which is the look of the flock.
 *
 * Depth: the sim's (object-definition 0, then `tardep` — the target's
 * depth - 1 — once within 120px, Step_0:57-60). Sub-image: floor + wrap on
 * the frame count (drawSpriteExt). Returns true: draw_self is the port's.
 *
 * THE SPRITE IS PACKED as of 2026-09-12 (ledger G-43): `spr_icespell_snowflake`
 * and `bg_snowfall` are in kaizo/assets/sprites, vanilla-sourced and
 * byte-identical between the two data files, so this was a VENDORING gap and
 * not an art delta. The early-return above is kept for a tree whose overlay
 * has not been built (a fresh clone has none) — it is no longer the normal
 * case. kaizo/tools/checks/check-snowflake-art.mjs drives a live V-D SnowGrave
 * cast through the real renderer and counts the blits.
 */
export function drawObjSpellSnowgraveSnowflake(ctx, e, state, helpers) {
  const entry = helpers.sprites.get(e.sprite_index ?? SNOWFLAKE_SPRITE);
  if (!entry || !entry.frames.length) return true;      // packed 2026-09-12 (G-43)
  const sub = Math.floor(e.image_index ?? 0);
  const xs = e.image_xscale ?? 2;                       // Step_0:1-9 (draw slot)
  const ys = e.image_yscale ?? 2;                       // Step_0:10
  const alpha = e.image_alpha ?? 1;
  const fs = e.flakescale ?? 1;
  const blend = e.image_blend ?? null;                  // c_white unless written; never is
  const drawSelf = () => drawSpriteExt(ctx, entry, sub, e.x, e.y, xs, ys,
    e.image_angle ?? 0, blend, alpha);

  drawSelf();                                           // :1
  if (e.siner !== 0) {                                  // :2
    const s = Math.sin(e.siner / 3);
    drawSpriteExt(ctx, entry, sub, e.x + s * 30, e.y, s * 2 * fs, 2 * fs, 0, null, alpha); // :4
    drawSpriteExt(ctx, entry, sub, e.x - s * 30, e.y, s * 2 * fs, 2 * fs, 0, null, alpha); // :5
  } else if (e.con >= 1) {                              // :7
    drawSelf();                                         // :9-12 repeat (2)
    drawSelf();
  }
  return true;
}
