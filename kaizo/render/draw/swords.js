// KAIZO DRAW — the swords family. STUBS: every export delegates to the
// vanilla drawer through `helpers.drawVanilla`, so these objects render on
// the kaizo page exactly as they do on the main page until each is ported.
//
// Contract and helpers: kaizo/render/index.js. The vanilla model for how a
// GML Draw becomes canvas calls is render/draw/swordfall.js and
// render/draw/swords.js; the GameMaker primitives are render/draw/gm.js.
//
// The kaizo GML (read-only, never copied here):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/gml_Object_<obj>_Draw_0.gml
// diffed against gml_vanilla_v105/CodeEntries/ — the port translates the
// kaizo event whole, in draw order, citing lines, and marks each deviation.
//
// UPDATE — PORTED. The paragraph above describes this file as it was
// scaffolded; all four exports below are now exact ports of the KAIZO Draw_0
// events (diffed 2026-09-01 against gml_vanilla_v105, each hunk cited at its
// site). Nothing delegates to `helpers.drawVanilla` any more. What the mod
// changed in this family, in one place:
//
//   obj_fallingsword            Draw_0:1 `image_blend = get_swordcolor()`
//                               (a Draw-time STATE write, carried by the sim:
//                               kaizo/attacks/swordfall.js fallingSword.endStep)
//                               and Draw_0:5 the two ghosts tinted
//                               get_swordcolor() instead of c_white.
//   obj_knight_swordfall        Draw_0:8 `image_blend = get_swordcolor()` in
//                               the sword-arm arm only (STATE, carried:
//                               knightSwordfall.endStep). The draw calls are
//                               vanilla's, call for call.
//   obj_sword_tunnel_sword      Draw_0:9-13 the `delay` countdown pinning
//                               telegraphalpha at -0.1 (STATE, carried:
//                               swordTunnelSword.endStep); Draw_0:16 the
//                               telegraph is #86A2FF, not c_red; Draw_0:20-23
//                               `with (obj_tracking_swords_manager)
//                               instance_destroy()` on every finale draw
//                               (STATE, carried: same endStep); Draw_0:29-32
//                               the flash ramp keys on get_swordcolor() rather
//                               than c_red (STATE, carried: same endStep).
//   obj_knight_swordtunnelanim  Draw_0:1-4 `if (!vertical) draw_self();`.
//
// HOW THE STATE HALF IS SPLIT FROM THE PAINT HALF. GameMaker runs a Draw
// after every End Step and the sim mirrors that: instance state a Draw
// WRITES lives in the kaizo attack module (endStep, or the engine's draw
// slot — sim/index.js "THE DRAW SLOT"), and this file only READS the result.
// Every draw call in a kaizo Draw comes after the state lines it depends on,
// so reading the post-endStep value here is the same value the GML read on
// the same line. The one piece of Draw-time state neither sim tree carried
// was the swordfall manager's `_siner++` (kaizo swordfall Draw_0:3); it is
// now a `draw(e, state)` slot on kaizo/attacks/swordfall.js knightSwordfall.
//
// COORDINATES. render/canvas.js translates the context by (-view.x, -view.y)
// before the depth pass, so a Draw's ROOM coordinates are drawn as they are
// and `camerax()` is `state.view.x`. The vanilla drawers this family replaces
// subtract `state.view` a second time (render/draw/swordfall.js:31-44,64-70);
// that is invisible while the view sits at its (0,0) rest and shows only
// under obj_shake (sim/shake.js moves `state.view`), where a `camerax() +
// 544` pose is screen-pinned in the game and room-pinned in vanilla. This
// port follows the GML: one translation, the renderer's.
//
// ADVERSARIAL RE-CHECK (2026-09-02, every draw call of all four events read
// against the kaizo GML side by side — sprite, subimage, origin, x/y, both
// scale signs, rotation sense, colour, alpha, gate, order). No draw-call
// divergence found. Two things this file cannot make exact, recorded so
// nobody re-derives them:
//
//   * `global.time` (obj_knight_swordfall Draw_0:9,13) is the GAME-UPTIME
//     counter — obj_time Step_1:4 `global.time += 1` while unpaused, from
//     boot — so `sin(global.time * 0.1)` sits at a phase that depends on how
//     long the player has had the game open. `state.frame` is the stand-in
//     every drawer in this repo uses (render/draw/swordfall.js, the kaizo
//     quickslash port, the module's own Step_0:9 `% 4` gate), and it differs
//     from the real thing by an unknowable constant. Amplitude and period are
//     exact; the phase is not, and cannot be. `dip` is 2 until Alarm_2:4
//     zeroes it, so the breathe is a ±2 px idle sway — cosmetic.
//   * `depth` for obj_fallingsword / obj_knight_swordfall /
//     obj_sword_tunnel_sword comes from `instance_create` ->
//     `object_get_depth(obj)` (gml_GlobalScript scr_bulletspawner /
//     instance_create in the kaizo dump), i.e. the OBJECT DEFINITION —
//     CLAUDE.md's `depth` hole. gml_GlobalScript___global_object_depths.gml
//     lists only 236 legacy objects (obj_growtangle = 5, obj_afterimage = 0)
//     and none of the chapter-3 knight objects, and no object_depth dump
//     exists on this machine (knight-research/tools/patches/object_depth.csx
//     writes one; nothing under knight-research or knight-sim holds its
//     output). So these three sort at the sim's undefined -> 0, the same as
//     on the vanilla page. Not a Draw-event matter; left for the depth dump.
//
// IMPORTS run one way. kaizo/ may import render/ and sim/ (kaizo/HANDOFF.md
// §2 rule 1); render/ never imports kaizo/, which is why these Draws are
// handed in through the override map rather than looked up.

import { drawSpriteExt } from '../../../render/draw/gm.js';
import { KNIGHT } from '../../../sim/actors.js';
import { getSwordcolor, KAIZO_TELEGRAPH_COLOR } from '../../attacks/kaizo-colors.js';

/** GML `lerp(a, b, t)` — `a + (b - a) * t`, the form the trail loops use. */
const lerp = (a, b, t) => a + (b - a) * t;

/** `obj_knight_enemy` — the actor entity, which is where `ystart` lives. */
function knightEntity(state) {
  return state.entities.find((x) => x.alive && x.type.name === 'obj_knight_enemy');
}

/**
 * obj_fallingsword — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/swordfall.js drawFallingSword (the two-ghost
 * motion trail then the blade; DRAW_EVENTS.obj_fallingsword in canvas.js).
 * Sim side: kaizo/attacks/swordfall.js.
 *
 * PORTED — kaizo gml_Object_obj_fallingsword_Draw_0.gml, whole event:
 *
 *     1  image_blend = get_swordcolor();
 *     2  i = max_old - 1;
 *     3  while (i > 0) {
 *     5      draw_sprite_ext(sprite_index, 0, old_x[i], old_y[i],
 *                image_xscale, image_yscale - (0.2 * i), old_angle[i],
 *                get_swordcolor(), image_alpha - (0.3 * i));
 *     6      i--; }
 *     8  draw_self();
 *
 * Diff against vanilla: line 1 is NEW (the sword's own tint) and line 5's
 * colour was `c_white`. Line 1 is instance state — the sim writes it in
 * kaizo/attacks/swordfall.js fallingSword.endStep (`e.image_blend =
 * getSwordcolor(state)`), so `draw_self()` below already blits the blade
 * blue through the vanilla tail. Line 5 is the paint-side half: the two
 * ghosts take `get_swordcolor()` directly (a pure switch on
 * state.kaizo.swordtype, zero RNG — kaizo-colors.js), which is the visible
 * change from the vanilla drawer's untinted trail.
 *
 * `max_old` is 3 (Create_0:14; the sim keeps `old_x/old_y/old_angle` as
 * three-slot arrays, kaizo/attacks/swordfall.js:178-180), so i runs 2, 1.
 * A ghost whose alpha has gone to or below zero is skipped exactly as the
 * vanilla drawer skips it: GameMaker draws nothing at alpha <= 0 and
 * drawSpriteExt would clamp it to a blank drawImage, so the skip is
 * call-count only, never a pixel.
 *
 * Returns FALSY: `draw_self()` closes the event, and the renderer's tail
 * (render/canvas.js drawEntity — sprite_index, floored image_index, the
 * manifest origin, both scales, image_angle, image_alpha, image_blend
 * multiplied) IS draw_self. A missing sprite returns falsy too, so the tail's
 * mask fallback still shows the blade's collision shape.
 */
export function drawObjFallingsword(ctx, e, state, helpers) {
  const entry = helpers.sprites.get(e.sprite_index);
  if (!entry || !entry.frames.length || !e.old_x) return false;

  const color = getSwordcolor(state); // Draw_0:5 `get_swordcolor()`
  const xs = e.image_xscale ?? 1;
  const ys = e.image_yscale ?? 1;
  const alpha = e.image_alpha ?? 1;

  // Draw_0:2-7 — `i = max_old - 1; while (i > 0) { ...; i--; }`
  for (let i = e.old_x.length - 1; i > 0; i--) {
    const a = alpha - 0.3 * i;
    if (a <= 0) continue;
    drawSpriteExt(ctx, entry, 0, e.old_x[i], e.old_y[i],
      xs, ys - 0.2 * i, e.old_angle[i], color, a);
  }
  // Draw_0:8 `draw_self()` — the tail, with image_blend = get_swordcolor()
  // from the sim's endStep (Draw_0:1).
  return false;
}

/**
 * obj_knight_swordfall — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/swordfall.js drawSwordfallKnight (the manager's
 * pose at a fixed screen x with its dip breathe).
 * Sim side: kaizo/attacks/swordfall.js (also spawned by combination.js).
 *
 * PORTED — kaizo gml_Object_obj_knight_swordfall_Draw_0.gml, whole event:
 *
 *     1  if (forcexfix && sprite_index == spr_roaringknight_attack_ol_center) {
 *     3      _siner++;
 *     4      draw_sprite_ext(sprite_index, image_index, camerax() + 544,
 *                obj_knight_enemy.ystart + (cos(_siner / 8) * 8),
 *                image_xscale, image_yscale, image_angle, image_blend, image_alpha);
 *     6  } else if (sprite_index == spr_roaringknight_sword_ol) {
 *     8      image_blend = get_swordcolor();
 *     9      draw_sprite_ext(sprite_index, image_index, camerax() + 544,
 *                y + (sin(global.time * 0.1) * dip) + 30,
 *                image_xscale, image_yscale, image_angle, image_blend, image_alpha);
 *    11  } else {
 *    13      draw_sprite_ext(sprite_index, image_index, x,
 *                y + (sin(global.time * 0.1) * dip),
 *                image_xscale, image_yscale, image_angle, image_blend, image_alpha);
 *    14  }
 *
 * Diff against vanilla: ONLY line 8 is new, and it is a state write the sim
 * carries (kaizo/attacks/swordfall.js knightSwordfall.endStep tints
 * image_blend while the sprite is the sword arm; its Step_0:11 `c_white`
 * reset is what wipes it off the attack pose at alarm 2 + 9). So the three
 * draw calls here are vanilla's, and the tint arrives through `image_blend`.
 *
 * Line 3, `_siner++`, is Draw-time state that NEITHER sim tree carried —
 * the vanilla drawer notes "the sim owns it" but sim/attacks/swordfall.js
 * never increments it, so the returning pose sat at cos(0) for its whole
 * hover. It now ticks in knightSwordfall's `draw(e, state)` slot (kaizo
 * module only; the vanilla page is untouched), which runs after endStep the
 * way the GML Draw runs after End Step — this reads the incremented value,
 * as line 4 does.
 *
 * `obj_knight_enemy.ystart` is the knight ACTOR entity's `ystart`
 * (sim/actors.js create: `e.ystart = KNIGHT.ystart`, 78); `state.knight` is
 * the battle record, a different object (sim/actors.js:227-231), so the
 * entity is read first and the record only as a fallback. `global.time` is
 * `state.frame` — the mapping the kaizo module already uses for Step_0:9's
 * `global.time % 4` (kaizo/attacks/swordfall.js:812). `camerax()` is
 * `state.view.x` (see the header on coordinates).
 *
 * Returns TRUE: every arm is a single draw_sprite_ext, no draw_self. With
 * the sprite missing it returns falsy so the tail's mask fallback draws
 * something at the instance position (the fixed-x arms have no mask
 * equivalent; degraded, never blank).
 */
export function drawObjKnightSwordfall(ctx, e, state, helpers) {
  const entry = helpers.sprites.get(e.sprite_index);
  if (!entry || !entry.frames.length) return false;

  const sub = Math.floor(e.image_index ?? 0);
  const xs = e.image_xscale ?? 1;
  const ys = e.image_yscale ?? 1;
  const ang = e.image_angle ?? 0;
  const alpha = e.image_alpha ?? 1;
  const dip = e.dip ?? 0;
  const camx = state.view.x; // camerax()
  // `sin(global.time * 0.1) * dip` — global.time is game uptime (obj_time
  // Step_1:4), so state.frame reproduces the period and amplitude, not the
  // phase (see the header's re-check note). dip = 2 until Alarm_2:4.
  const breathe = Math.sin(state.frame * 0.1) * dip; // sin(global.time * 0.1) * dip

  if (e.forcexfix && e.sprite_index === 'spr_roaringknight_attack_ol_center') {
    // Draw_0:3 `_siner++` — kaizo/attacks/swordfall.js knightSwordfall.draw.
    // Draw_0:4.
    const k = knightEntity(state);
    const ystart = k?.ystart ?? state.knight?.ystart ?? KNIGHT.ystart;
    drawSpriteExt(ctx, entry, sub, camx + 544, ystart + Math.cos((e._siner ?? 0) / 8) * 8,
      xs, ys, ang, e.image_blend, alpha);
  } else if (e.sprite_index === 'spr_roaringknight_sword_ol') {
    // Draw_0:8 `image_blend = get_swordcolor()` — knightSwordfall.endStep.
    // Draw_0:9.
    drawSpriteExt(ctx, entry, sub, camx + 544, e.y + breathe + 30,
      xs, ys, ang, e.image_blend, alpha);
  } else {
    // Draw_0:13.
    drawSpriteExt(ctx, entry, sub, e.x, e.y + breathe,
      xs, ys, ang, e.image_blend, alpha);
  }
  return true;
}

/**
 * obj_sword_tunnel_sword — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/draw/swords.js drawSwordTunnelSword (red telegraph
 * line + ten-copy trail), which returns FALSE so the generic blit draws the
 * sword itself — `draw_self()` closes the event. A port that keeps that
 * shape returns falsy too; one that draws the blade itself returns true.
 * Sim side: kaizo/attacks/sword-tunnel.js.
 *
 * PORTED — kaizo gml_Object_obj_sword_tunnel_sword_Draw_0.gml, whole event:
 *
 *     1  if (telegraph == 0 && telegraphalpha > 0) telegraphalpha -= 0.1;
 *     5  if (telegraph == 1 && telegraphalpha < 0.5) telegraphalpha += 0.05;
 *     9  if (delay > 0) { delay--; telegraphalpha = -0.1; }
 *    14  if (telegraphalpha > 0)
 *    16      draw_sprite_ext(spr_lasergun_laser_telegraph, 0, x, y, 999, 0.4,
 *                image_angle, #86A2FF, telegraphalpha);
 *    18  if (con > 0) {
 *    20      with (obj_tracking_swords_manager) instance_destroy();
 *    24      var _timer = timer; if (_timer > 10) _timer = 10;
 *    29      if (image_blend == get_swordcolor())
 *    31          image_blend = merge_color(get_swordcolor(), c_white, _timer / 10);
 *    33  }
 *    34  for (i = 0; i < 10; i++)
 *    36      draw_sprite_ext(sprite_index, image_index, lerp(xprevious, x, i / 10),
 *                lerp(yprevious, y, i / 10), image_xscale, image_yscale,
 *                image_angle, image_blend, i / 10);
 *    38  draw_self();
 *
 * Diff against vanilla: lines 9-13 NEW (the finale stagger's countdown),
 * line 16's colour `c_red` -> `#86A2FF`, lines 20-23 NEW (the tracking
 * manager destroy), lines 29-31 `c_red` -> `get_swordcolor()` in the flash
 * gate and its ramp base. Every state line — 1-13, 20-32 — is carried by
 * kaizo/attacks/sword-tunnel.js swordTunnelSword.endStep (telegraphalpha,
 * delay, the destroy, the reference-equality flash gate and mergeColor), so
 * this reads `telegraphalpha` and `image_blend` after that endStep, which is
 * the value lines 16 and 36 read after lines 1-13 and 18-33 ran. The
 * renderer never writes any of it.
 *
 * `#86A2FF` is a GML RRGGBB literal — (134, 162, 255), KAIZO_TELEGRAPH_COLOR
 * in kaizo-colors.js, written literally at the draw site and so NOT tied to
 * the swordtype setting (that file's note). The vanilla drawer's [255, 0, 0]
 * is the one argument this port changes on the telegraph call. `xprevious`
 * is latched by the engine at the top of every frame (sim/index.js:411-418),
 * so the trail has its previous position to interpolate from.
 *
 * Returns FALSY: `draw_self()` closes the event (line 38) — the tail's blit
 * with the endStep's image_blend. The trail's first copy (i = 0) draws at
 * alpha 0 exactly as the GML does; drawSpriteExt clamps it, and issuing the
 * call keeps the sequence the vanilla drawer issues.
 */
export function drawObjSwordTunnelSword(ctx, e, state, helpers) {
  // Draw_0:1-13 — telegraphalpha ramp and the delay pin: swordTunnelSword.endStep.
  // Draw_0:14-17.
  if (e.telegraphalpha > 0) {
    const tel = helpers.sprites.get('spr_lasergun_laser_telegraph');
    if (tel && tel.frames.length) {
      drawSpriteExt(ctx, tel, 0, e.x, e.y, 999, 0.4, e.image_angle ?? 0,
        KAIZO_TELEGRAPH_COLOR, e.telegraphalpha);
    }
  }

  // Draw_0:18-33 — the manager destroy and the flash ramp: swordTunnelSword.endStep.
  const entry = helpers.sprites.get(e.sprite_index);
  if (!entry || !entry.frames.length) return false;

  // Draw_0:34-37.
  const px = e.xprevious ?? e.x;
  const py = e.yprevious ?? e.y;
  const sub = Math.floor(e.image_index ?? 0);
  const xs = e.image_xscale ?? 1;
  const ys = e.image_yscale ?? 1;
  const ang = e.image_angle ?? 0;
  for (let i = 0; i < 10; i++) {
    drawSpriteExt(ctx, entry, sub, lerp(px, e.x, i / 10), lerp(py, e.y, i / 10),
      xs, ys, ang, e.image_blend, i / 10);
  }

  // Draw_0:38 `draw_self()` — the tail.
  return false;
}

/**
 * obj_knight_swordtunnelanim — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: NO DRAW_EVENTS entry — the generic sprite blit
 * (render/canvas.js drawEntity: sprite_index, image_index floored and
 * wrapped, origin from the manifest, image_blend multiplied). While this
 * object exists obj_knight_enemy's own Draw exits (knightDrawCalls), so this
 * IS the knight for the whole animation.
 * Sim side: kaizo/attacks/sword-tunnel-anim.js.
 *
 * PORTED — kaizo gml_Object_obj_knight_swordtunnelanim_Draw_0.gml, whole
 * event:
 *
 *     1  if (!vertical)
 *     3      draw_self();
 *
 * Diff against vanilla: the whole thing — vanilla is a bare `draw_self()`.
 * `vertical` is the mod's cross-corridor flag (Create_0:20 `vertical =
 * false`, flipped through the tunnel manager's `woosh` handle by its
 * Other_10:79-82 difficulty-11 block; kaizo/attacks/sword-tunnel-anim.js
 * create/step carry it). A vertical anim hides itself on its first Step
 * (Step_0:15-18 `visible = false`, which the seam's filter honours), so this
 * line only decides its CREATION frame — the one frame it is alive, vertical
 * and still visible — and any vertical frame before the Step runs. The
 * vanilla path blits the Knight there; the mod draws nothing.
 *
 * Returns TRUE when vertical (the event drew nothing and nothing follows),
 * FALSY otherwise so the tail's blit is the `draw_self()`.
 */
export function drawObjKnightSwordtunnelanim(ctx, e, state, helpers) {
  // Draw_0:1-4.
  return e.vertical ? true : false;
}
