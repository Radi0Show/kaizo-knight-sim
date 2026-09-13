// KAIZO DRAW — THE B-SIDE EPILOGUE (ledger G-15) and the A-Side fakeout's
// actors. This is the drawer `kaizo/scenes/kaizo-ending.js` never had.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 — DO NOT
// PUBLISH WITHOUT PERMISSION (kaizo/HANDOFF.md §5-C).
//
// ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
//
// The epilogue's machine has run correctly on the page since 2026-09-11 —
// `sb_con` walks [0,1,2,3,4,99], the alarms fire, the cues reach the mixer —
// and **every visual it produced was written where nothing read it**: the
// clash pairs, the whiteall fills, the afterimages, the shakes, the depth
// juggling, the 36-degree slash marker, the ouchie/SWOON writers and the
// 1-in-20 `spr_ralsei_swoon`. What a player saw was the room, the receding
// white and the wind. That is this repo's signature defect at scene scale.
//
// ── WHY IT IS A SCENE DRAWER AND NOT A REGISTRY ENTRY ─────────────────────
//
// `kaizo/render/index.js`'s `KAIZO_DRAW_OVERRIDES` is the seam for objects the
// renderer meets inside `render/canvas.js`'s depth-sorted pass, and that pass
// positions everything by `state.view` — the BATTLE's camera, which is 0 here.
// The epilogue is an OVERWORLD cutscene at `camerax() ~ 2230-2400` with its
// own `sb_camX` kick, so its entities cannot be positioned by that pass
// without either lying to `state.view` (which sim/shake.js already owns, and
// `big_shake` really does move) or teaching `render/` about kaizo.
//
// The vanilla port already answers this, for THIS ROOM and THIS BEAT:
// `render/draw/victory-scene.js` draws the A-Side knighting as one scene
// function called by the page, taking `cam` and subtracting it. This file is
// the B-Side's counterpart, at the address kaizo work belongs at, and its
// layering follows the same order for the same reasons.
//
// **IT IS NOT WIRED TO THE PAGE YET.** `web/kaizo.js` (another lane's file)
// paints the room and the receding white and returns; the call it needs is
// `drawKaizoEpilogue(ctx, ep.st, renderer.sprites)` in place of that block.
// Until that lands this drawer has a check over it and no player-facing
// consumer, which is stated here rather than implied.
//
// ── PROVENANCE ────────────────────────────────────────────────────────────
//
// Every geometry constant below is the mod's, from
// `knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/`:
//
//   gml_Object_obj_ch3_PTB02_Step_0.gml     1247-1775  con 50.2
//                                           1992-2172  susie_knight_slash
//   gml_Object_obj_ch3_PTB02_Create_0.gml   31-36      whiteall
//                                           280-314    swoon/ouchie displays
//                                           289-301    show_clash_overlay
//   gml_Object_obj_dmgwriter_Draw_0.gml                the writers' dynamics
//   gml_Object_obj_afterimage_Create_0/Step_0.gml      fadeSpeed 0.04
//   gml_Object_obj_afterimage_grow_Create_0/Step_0.gml 0.1 / +0.2 scale
//   gml_GlobalScript_scr_dark_marker.gml               image_xscale = 2
//   gml_Object_obj_ch3_PTB02_roaringknight_Step_0.gml  the trail and shakeamt
//
// ── WHAT IS PAINTED HERE AND WHAT IS STILL APPROXIMATE ────────────────────
//
// PAINTED, off real instance state:
//   * the three party actors and the Knight, at overworld scale 2, with
//     `image_index`, `image_angle`, `image_alpha` and `image_xscale` — which
//     is what makes `spr_roaringknight_faceaway_turning` at xscale -2 read as
//     the Knight facing away, and the `spr_ralsei_swoon` easter egg visible;
//   * every `scr_dark_marker`: the `spr_fx_hitback` clash pairs, the
//     `spr_rk_quickslash` slash at `image_angle = 36`, the sword-break piece,
//     the shine — each at the marker's own scale, angle, index and alpha, all
//     of which sim/lerpvar.js is tweening for real;
//   * `whiteall` and `show_clash_overlay`, as the full-screen obj_markers they
//     are (4x4 `spr_pixel_white` at `image_xscale = 999`), IN THEIR OWN BLEND
//     — which is why the last third of this scene is BLACK, not white;
//   * `obj_afterimage` and `obj_afterimage_grow`, off the emitter's records;
//   * the ouchie and SWOON writers, as obj_dmgwriter (fa_right at `x + 30`,
//     the squash, the bounce, the kill fade), with the ouchie's own
//     `lightb = 255` — which GameMaker packs BGR, so the number is RED;
//   * the DEPTH JUGGLING, because the pass below sorts by the same `depth`
//     field the scene writes: su 6000 at the jump, ra at su-5, su at ra+5,
//     the Knight at kr+1 and then kr-1 in sb_con 4.
//
// APPROXIMATE, labelled at each site and in ENDING_APPROX:
//   * the per-object shakes (`scr_shakeobj_ext`, `scr_minishakeobj`) — a
//     decaying jitter seeded by the sim frame, because the real one runs in an
//     object Step this scene does not run and spends RNG the budget cannot;
//   * the dialogue box geometry, inherited from render/draw/victory-scene.js's
//     measurement of the same dark-zone box rather than re-derived, with no
//     `\E` expression decoding — the face is the speaker's frame 0.
//
// NOTHING HERE WRITES SIM STATE and nothing here touches `state.rng`. Every
// frame-varying quantity is a pure function of `state.frame` (CLAUDE.md, "A
// GML Draw runs at 30Hz; a browser renderer does not"), so a paused frame
// redraws identically.
//
// ── THE HONEST CONSTRAINT ─────────────────────────────────────────────────
//
// THERE IS NO RECORDING OF THIS SCENE. Both whole-fight recordings are A-Side;
// the two locks in knight-research/kaizo-mod/locks are an animation lock and
// the roar finale. Every claim above rests on the GML and on
// `kaizo/tools/checks/check-ending-draw.mjs`, which drives this file with a
// recording 2d context and asserts the calls.

import { drawSpriteExt } from '../../../render/draw/gm.js';
import { drawSnowBackdrop } from '../../../render/draw/intro-fx.js';
import { drawSpriteText, FONTS } from '../../../render/text.js';
import { loadFont, drawText } from '../../../render/font.js';
import { formatWriter, revealed } from '../../../sim/dialogue.js';
import {
  ensureEnding, endingActor, endingMarker, endingAfterimages,
  SPR, OVERLAY_SCALE, C_WHITE,
} from '../../scenes/kaizo-ending.js';

const VIEW_W = 640;
const VIEW_H = 480;

/** Overworld actors and `scr_dark_marker` both draw at 2x in this room —
 *  scr_dark_marker sets it outright, and render/draw/victory-scene.js measured
 *  the same 2 for the party in the same cutscene. */
const ACTOR_SCALE = 2;

/**
 * A frame-seeded [0, 1). The shakes below are the only frame-varying values in
 * this file and they MUST be pure functions of the sim frame — same hash
 * render/draw/victory-scene.js uses for the Knight's warp ghosts, so the two
 * cutscenes jitter with the same grain.
 */
function srand(frame, salt) {
  let t = (frame * 374761393 + salt * 668265263) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177) >>> 0;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** `[r, g, b]` -> css. `null` means "no tint", which drawSpriteExt takes. */
function css(c) {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

/**
 * obj_shakeobj / obj_shakeobj_ext, as a decaying jitter (see the header's
 * "APPROXIMATE"). `shakexamt` decays by `shakereduct` every `shakespeed`
 * frames and the offset flips sign each step, which is the shape sim/shake.js
 * measured for the camera's obj_shake and the only one with a receipt.
 *
 * Returns [dx, dy] for `who` at this frame, summed over every live record.
 */
export function objShakeOffset(sc, who, frame) {
  let dx = 0;
  let dy = 0;
  for (const s of sc.shakes) {
    if (!s.objshake || s.target !== who) continue;
    const age = frame - s.frame;
    if (age < 0) continue;
    const speed = Math.max(1, s.shakespeed ?? 1);
    const steps = Math.floor(age / speed);
    const ax = (s.shakexamt ?? 0) - steps * (s.shakereduct ?? 1);
    const ay = (s.shakeyamt ?? 0) - steps * (s.shakereduct ?? 1);
    if (ax <= 0 && ay <= 0) continue;
    const sign = steps % 2 === 0 ? 1 : -1;
    if (ax > 0) dx += sign * Math.round(ax * (srand(s.frame + steps, 11) * 0.5 + 0.5));
    if (ay > 0) dy += sign * Math.round(ay * (srand(s.frame + steps, 12) * 0.5 + 0.5));
  }
  return [dx, dy];
}

/**
 * The Knight's own `shakeamt` branch: `shakex = random_range(-shakeamt,
 * shakeamt)` every `shaketime` (1) frames, in his Step. Not simulated (the RNG
 * budget); drawn as the same magnitude of frame-seeded jitter.
 */
function shakeamtOffset(e, frame) {
  const amt = e.shakeamt ?? 0;
  if (!(amt > 0)) return [0, 0];
  return [
    (srand(frame, 21) * 2 - 1) * amt,
    (srand(frame, 22) * 2 - 1) * amt,
  ];
}

/**
 * A full-screen obj_marker — `whiteall` and every `show_clash_overlay`. Both
 * are a 4x4 `spr_pixel_white` at `image_xscale = image_yscale = 999`, so the
 * instance really is a 3996px square anchored at room (-10, -10); at every
 * camera this scene uses that covers the view.
 *
 * Drawn as a RECTANGLE rather than as a 999x blit of a 4-pixel sprite: the
 * pixels are identical (the sprite is one solid colour), it does not depend on
 * `spr_pixel_white` being in whichever pack is mounted, and it cannot be
 * defeated by a tint cache. The rect is the instance's OWN room rect, so a
 * marker that genuinely did not cover the view would not cover it here either.
 */
function drawFullscreenMarker(ctx, m, cam) {
  const w = 4 * (m.image_xscale ?? 1);
  const h = 4 * (m.image_yscale ?? 1);
  const a = clamp01(m.image_alpha ?? 1);
  if (a <= 0) return false;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = css(m.image_blend ?? C_WHITE);
  ctx.fillRect(m.x - cam, m.y, w, h);
  ctx.restore();
  return true;
}

/** One `scr_dark_marker` instance. Returns whether it painted anything. */
function drawMarker(ctx, sprites, m, cam) {
  if (m.visible === false) return false;
  if ((m.image_xscale ?? 1) === OVERLAY_SCALE) return drawFullscreenMarker(ctx, m, cam);
  const entry = sprites.get(m.sprite);
  if (!entry || !entry.frames.length) return false;
  if (clamp01(m.image_alpha ?? 1) <= 0) return false;
  drawSpriteExt(ctx, entry, Math.floor(m.image_index ?? 0),
    m.x - cam, m.y, m.image_xscale ?? 2, m.image_yscale ?? 2,
    m.image_angle ?? 0, null, clamp01(m.image_alpha ?? 1));
  return true;
}

/** One actor — kr / su / ra / knight. Returns whether it painted anything. */
function drawEndingActor(ctx, sprites, a, cam, frame) {
  if (a.visible === false) return false;
  const entry = sprites.get(a.sprite);
  if (!entry || !entry.frames.length) return false;
  const [jx, jy] = shakeamtOffset(a, frame);
  drawSpriteExt(ctx, entry, Math.floor(a.image_index ?? 0),
    a.x - cam + jx, a.y + jy,
    // `image_xscale` is the flip: sb_con 4 sets -2 on the Knight, and the
    // negative is the whole reason he reads as turned away. Every other actor
    // carries the engine default 1, which this room draws at 2.
    (a.image_xscale ?? 1) === 1 ? ACTOR_SCALE : a.image_xscale,
    (a.image_yscale ?? 1) === 1 ? ACTOR_SCALE : a.image_yscale,
    a.image_angle ?? 0, null, clamp01(a.image_alpha ?? 1));
  return true;
}

/** obj_afterimage / obj_afterimage_grow. */
function drawAfterimage(ctx, sprites, g, cam) {
  const entry = sprites.get(g.sprite);
  if (!entry || !entry.frames.length) return false;
  const a = clamp01(g.image_alpha);
  if (a <= 0) return false;
  drawSpriteExt(ctx, entry, Math.floor(g.image_index ?? 0), g.x - cam, g.y,
    (g.image_xscale ?? 1) === 1 ? ACTOR_SCALE : g.image_xscale,
    (g.image_yscale ?? 1) === 1 ? ACTOR_SCALE : g.image_yscale,
    g.image_angle ?? 0, null, a);
  return true;
}

/**
 * `ouchie_display` / `swoon_display` — obj_dmgwriter, whose whole animation
 * lives in its Draw event:
 *
 *     delaytimer == delay  ->  vspeed = -5 - random(2); hspeed = 10;
 *     hspeed decays to 0 by 1 a frame
 *     vspeed += 1 while bounces < 2; y > ystart bounces at vstart / 2, twice
 *     stretch 0.2, +0.4 a frame, clamped at 1  ->  scale (2 - stretch, stretch)
 *     killtimer > 35  ->  kill += 0.08; alpha 1 - kill, y scale stretch + kill
 *
 * Replayed here from the record's age rather than stepped, because this is a
 * renderer. **`vspeed = -5 - random(2)` IS AN RNG DRAW in the real object and
 * is taken as -6, the midpoint** — LABELLED (law 4): the epilogue's counted
 * budget has no room for it (kaizo-ending.js's RNG BUDGET), and every other
 * number here is the GML's.
 *
 * `type` picks the colour and the graphic: the SWOON writer is `type = 12`,
 * which the Draw turns into `spr_battlemsg` sub-image 13 in `c_red`; the
 * ouchie is `type = 0` with `lightb` OVERWRITTEN TO 255 by ouchie_display
 * (Create_0:304-314) — GameMaker packs colours BGR, so 255 is pure RED, not
 * the aqua `lightb` defaults to.
 */
const OUCHIE_COLOR = [255, 0, 0];
const WRITER_DELAY = 2;          // obj_dmgwriter Create: `delay = 2`
const WRITER_VSPEED = -6;        // INVENTED midpoint of `-5 - random(2)`

function writerPose(age) {
  let t = age - WRITER_DELAY;
  if (t < 0) return null;
  let vspeed = WRITER_VSPEED;
  const vstart = vspeed;
  let hspeed = 10;
  let dx = 0;
  let dy = 0;
  let bounces = 0;
  const killStart = 35;
  for (let i = 0; i < t; i++) {
    if (hspeed > 0) hspeed -= 1;
    else if (hspeed < 0) hspeed += 1;
    if (Math.abs(hspeed) < 1) hspeed = 0;
    dx += hspeed;
    const killactive = i >= killStart ? 1 : 0;
    if (bounces < 2) vspeed += 1;
    dy += vspeed;
    if (dy > 0 && bounces < 2 && killactive === 0) {
      dy = 0;
      vspeed = vstart / 2;
      bounces += 1;
    }
    if (bounces >= 2 && killactive === 0) { vspeed = 0; dy = 0; }
  }
  const stretch = Math.min(1, 0.2 + 0.4 * t);
  const kill = t > killStart ? (t - killStart) * 0.08 : 0;
  if (kill >= 1) return null;
  return { dx, dy, stretch, kill };
}

function drawWriters(ctx, sprites, sc, frame) {
  let painted = 0;
  const msg = sprites.get('spr_battlemsg');
  const all = [
    ...sc.ouchies.map((o) => ({ ...o, type: 0, color: OUCHIE_COLOR })),
    ...sc.swoons.map((s) => ({ ...s, type: 12, color: OUCHIE_COLOR })),
  ];
  for (const w of all) {
    const pose = writerPose(frame - w.frame);
    if (!pose) continue;
    const xs = 2 - pose.stretch;
    const ys = pose.stretch + pose.kill;
    const alpha = clamp01(1 - pose.kill);
    if (xs <= 0 || ys <= 0 || alpha <= 0) continue;
    // THE WRITERS DO NOT MOVE WITH THE CAMERA in the real object either —
    // obj_dmgwriter's Create takes `xx = camerax()` and `stayincamera = 1`.
    // Its x is a ROOM x, so the camera subtraction is the same as everything
    // else's; `stayincamera` only clamps it into the view, which no writer in
    // this scene ever reaches the edge of.
    const x = w.x - Math.round(sc.camX) + pose.dx + 30;
    const y = w.y + pose.dy;
    if (w.type === 12) {
      if (!msg) continue;
      drawSpriteExt(ctx, msg, 13, x, y, xs, ys, 0, w.color, alpha);
      painted += 1;
      continue;
    }
    // `draw_text_transformed` scales about the DRAW ORIGIN and `fa_right`
    // puts that origin at the string's right edge — so the translate-then-
    // scale is what reproduces both at once. Same treatment, and the same
    // sprite font (`global.damagefont` = spr_numbersfontbig), that
    // render/dmgnumbers.js uses for every damage number in the fight.
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(xs, ys);
    drawSpriteText(ctx, sprites, FONTS.damage, String(w.damage), 0, 0, {
      halign: 'right', color: css(w.color),
    });
    ctx.restore();
    painted += 1;
  }
  return painted;
}

/**
 * The dark-zone textbox. GEOMETRY INHERITED, not re-derived: the rect, the
 * border pieces and the writer/face offsets are render/draw/victory-scene.js's
 * measurement of scr_darkbox_black for this very room, repeated as numbers
 * because render/ is vendored and this lane may not import a private helper
 * out of it. LABELLED as approximate: no `\E` expression decoding (the face is
 * frame 0), and the reveal is one character a frame.
 */
function drawEndingBox(ctx, sprites, sc, frame) {
  if (!sc.dialogueOpen || !sc.msgs.length) return;
  const m = sc.msgs[sc.msgs.length - 1];
  const bx0 = 24;
  const by0 = 312;
  const bx2 = 616;
  const by3 = 478;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(bx0 + 20, by0 + 20, bx2 - 20 - (bx0 + 20), by3 - 20 - (by0 + 20));
  const top = sprites.get('spr_textbox_top');
  const left = sprites.get('spr_textbox_left');
  const corner = sprites.get('spr_textbox_topleft');
  const bw = bx2 - bx0 - 63;
  const bh = by3 - by0 - 63;
  if (top) {
    drawSpriteExt(ctx, top, 0, bx0 + 32, by0, bw, 2, 0, null, 1);
    drawSpriteExt(ctx, top, 0, bx0 + 32, by3 + 1, bw, -2, 0, null, 1);
  }
  if (left) {
    drawSpriteExt(ctx, left, 0, bx2 + 1, by0 + 32, -2, bh, 0, null, 1);
    drawSpriteExt(ctx, left, 0, bx0, by0 + 32, 2, bh, 0, null, 1);
  }
  if (corner) {
    const jewel = Math.floor(frame / 10) % (corner.meta.frames ?? 8);
    drawSpriteExt(ctx, corner, jewel, bx0, by0, 2, 2, 0, null, 1);
    drawSpriteExt(ctx, corner, jewel, bx2 + 1, by0, -2, 2, 0, null, 1);
    drawSpriteExt(ctx, corner, jewel, bx0, by3 + 1, 2, -2, 0, null, 1);
    drawSpriteExt(ctx, corner, jewel, bx2 + 1, by3 + 1, -2, -2, 0, null, 1);
  }
  const writerX = bx0 + 36;
  const writerY = by0 + 26;
  const face = sprites.get(m.speaker === 'susie' ? 'spr_face_susie_alt' : 'spr_face_r_nohat');
  if (face) {
    const fx = m.speaker === 'susie' ? writerX + 16 - 5 : writerX + 16 - 15;
    const fy = m.speaker === 'susie' ? writerY + 10 : writerY + 10 - 10;
    drawSpriteExt(ctx, face, 0, fx, fy, 2, 2, 0, null, 1);
  }
  const font = loadFont('../assets/fonts', 'fnt_mainbig');
  if (font?.ready) {
    const lines = revealed(formatWriter(m.text, 26), Math.max(0, frame - m.frame), 1);
    for (let i = 0; i < lines.length; i++) {
      drawText(ctx, font, lines[i], writerX + 116, writerY + 8 + i * 36,
        { color: 'rgb(255,255,255)', advance: 16, special: 1 });
    }
  }
  ctx.restore();
}

/**
 * THE WHOLE SCENE, one call.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} st       the epilogue's OWN sim state (web/kaizo-epilogue.js's
 *                          `ep.st`), not the fight's
 * @param {Map}    sprites  `renderer.sprites`, the merged vanilla + kaizo pack
 * @returns {object} a small report — what it actually painted this frame. It
 *                   exists so a check can assert the DRAW rather than the
 *                   existence of a consumer, and so a console breadcrumb can
 *                   say "the scene is running and painting N things".
 */
export function drawKaizoEpilogue(ctx, st, sprites) {
  const sc = ensureEnding(st);
  const frame = st.frame ?? 0;
  const cam = Math.round(sc.camX ?? 0);
  const report = {
    cam, actors: 0, markers: 0, overlays: 0, afterimages: 0, writers: 0, box: false,
  };

  // obj_shake moves the CAMERA — sim/shake.js writes it into state.view and
  // `big_shake` fires it three times in this scene. Everything in the world
  // shifts with it; the overlays and the box below do not.
  const vx = st.view?.x ?? 0;
  const vy = st.view?.y ?? 0;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // The apron: the jitter exposes strips at the edges, and this scene is
  // played over a black room. Same reason render/draw/victory-scene.js does it.
  ctx.fillStyle = '#000';
  ctx.fillRect(-16, -16, VIEW_W + 32, VIEW_H + 32);
  // NEGATED, matching render/canvas.js's own `translate(-state.view.x,
  // -state.view.y)`: `state.view` is where the CAMERA is, so the world moves
  // the other way. (render/draw/victory-scene.js translates by a positive
  // `sc.shake.offset`, but that is a scene-local offset of its own and not
  // this field — the two conventions are not in conflict.)
  ctx.translate(-vx, -vy);

  // 1. The room — the same snow vista the A-Side cutscene stands in, at this
  //    scene's camera. `fountain_speed` is the vista's own accumulator; the
  //    epilogue has no fountain state, so it runs at the frame rate the intro
  //    uses (0.1/frame), which is what the fight's renderer does too.
  drawSnowBackdrop(ctx, cam, 0.1 * frame, sprites);

  // 2. Everything with a depth, in GameMaker's painter order: deeper first,
  //    ties by creation order. THE DEPTH JUGGLING IS REAL HERE — su 6000 at
  //    the clash jump, ra = su - 5 and su = ra + 5 as they trade places, the
  //    Knight at kr + 1 and then kr - 1 — and this sort is the only thing that
  //    makes any of it visible.
  const world = st.entities
    .filter((e) => e.alive && (e.type === endingActor || e.type === endingMarker))
    .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0) || a.seq - b.seq);

  // The afterimages belong to their emitter's depth ± 1; drawn as one group
  // just before the Knight, which is where every one of them sits (the trail
  // at depth + 1, the clash ghosts at his own depth).
  const ghosts = endingAfterimages(st);

  for (const e of world) {
    if (e.type === endingActor && e.who === 'knight') {
      // COUNTED ONLY WHEN IT PAINTED, for the same reason the overlays are.
      for (const g of ghosts) {
        if (drawAfterimage(ctx, sprites, g, cam)) report.afterimages += 1;
      }
    }
    if (e.type === endingActor) {
      const [sx, sy] = objShakeOffset(sc, e.who, frame);
      let painted;
      if (sx || sy) {
        ctx.save();
        ctx.translate(sx, sy);
        painted = drawEndingActor(ctx, sprites, e, cam, frame);
        ctx.restore();
      } else {
        painted = drawEndingActor(ctx, sprites, e, cam, frame);
      }
      if (painted) report.actors += 1;
    } else if (drawMarker(ctx, sprites, e, cam)) {
      // COUNTED ONLY WHEN IT PAINTED. `whiteall` is one instance that lives
      // for the whole scene at `visible = true` and `image_alpha = 0` for most
      // of it; counting its existence rather than its ink would make "the
      // overlay is on screen" true from the first frame to the last, which is
      // exactly the kind of report that hides a missing draw.
      if ((e.image_xscale ?? 1) === OVERLAY_SCALE) report.overlays += 1;
      else report.markers += 1;
    }
  }

  ctx.restore();   // the screen shake does not move the writers or the box

  // 3. The damage writers, over everything in the world. obj_dmgwriter has no
  //    depth of its own in this scene and the A-Side port draws them here too.
  //
  //    `writers` is what was PAINTED; `writerRecords` is what EXISTS. They
  //    differ for the first two frames of every writer (obj_dmgwriter's
  //    `delay = 2`) and for every frame after its kill ramp finishes — which
  //    is the whole reason they are two numbers and not one.
  report.writers = drawWriters(ctx, sprites, sc, frame);
  report.writerRecords = sc.ouchies.length + sc.swoons.length;

  // 4. The box.
  if (sc.dialogueOpen && sc.msgs.length) {
    drawEndingBox(ctx, sprites, sc, frame);
    report.box = true;
  }
  return report;
}

/** Which sprite the epilogue is actually painting for Ralsei — the 1-in-20
 *  `spr_ralsei_swoon` arm has a consumer only if something reads this. */
export function epilogueRalseiSprite(st) {
  return ensureEnding(st).actors.ra?.sprite ?? null;
}

/** Named so a check (and a reader) can see the easter egg has a drawer. */
export const SWOON_EASTER_EGG = SPR.ralseiSwoon;
