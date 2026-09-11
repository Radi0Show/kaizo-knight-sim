// KAIZO DRAW — obj_knight_lightorb, the Side-B sunbolt orb (ledger G-1).
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// Contract and helpers: kaizo/render/index.js. The GML is
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_knight_lightorb_Draw_0.gml   (202 lines)
//     gml_Object_obj_knight_lightorb_Draw_64.gml  (1 line, the darkener)
// diffed against gml_vanilla_v105/CodeEntries/. What the mod changed in the
// DRAWING is one line: the charge disc is `get_swordcolor()` where vanilla
// wrote `c_blue` (Draw_0:200). Everything else in the diff is state or
// bullets, and lives in kaizo/attacks/lightorb.js.
//
// WHAT THE VANILLA RENDERER DREW FOR THIS OBJECT: nothing. render/canvas.js
// has no DRAW_EVENTS entry for obj_knight_lightorb (the object is unreachable
// in the vanilla fight — it has no creator anywhere in the v105 dump), and
// the generic tail needs a sprite or a mask, of which this instance has
// neither in the pack. Without this entry the orb is invisible while its
// bullets are not, which reads as "sunbolts out of nowhere".
//
// THE STATE IS THE SIM'S. Everything below reads fields the attack module's
// `draw(e, state)` slot wrote this frame — `darken_alpha`, `flashAlpha`,
// `drawScale`, `image_blend`, `drawSplit`, `splitx`, `radius`,
// `circle_alpha`, `discColor`. Nothing here advances a counter and nothing
// here touches state.rng, per the seam's contract.
//
// ── THE ART GAP, LABELLED (repo law 4) ────────────────────────────────────
//
// `obj_knight_lightorb`'s sprite is **spr_sneo_bigcircle**
// (knight-research/kaizo-mod/sprites/objects_kaizo.csv), and its four
// particle objects use spr_knight_spark, spr_knight_triangle,
// spr_roaringknight_sword_break_vfx2 and obj_rouxls_power_up_orb's art. NONE
// of those is in this repo's extracted pack: they are present in both data
// files' sprite metadata (D:/tmp/sprite_meta_{kaizo,vanilla}.json) but were
// never pulled as PNGs, so neither assets/sprites/manifest.json nor the kaizo
// overlay carries them, and `kaizo/tools/pack-kaizo-sprites.mjs` cannot pack
// what the extraction did not dump.
//
// So the ORB BODY here is a PLACEHOLDER: a ring drawn with canvas primitives
// in the instance's own `image_blend`, at the GML's scale and position. It is
// deliberately NOT a `sprites.get('spr_sneo_bigcircle')` call — an absent
// name would draw nothing at all AND would trip
// check-render-manifest-kaizo's "every sprite the ports ask for is in the
// pack" assertion, which is the right assertion and not one to weaken. To
// finish this: re-run the sprite extraction with the five names above added,
// repack, then replace `drawOrbBodyPlaceholder` with the blit and delete this
// paragraph.
//
// The two sprites the event uses that ARE in the pack — spr_zapper_tvturnoff1
// (the wind-up flash) and spr_board_blacktile (the Draw End darkener) — are
// drawn for real.

/** GameMaker colour argument -> css rgb. An [r,g,b] triple passes through; a
 *  packed real decodes BGR through helpers.rgbOf; c_white means white. */
function css(c, rgbOf) {
  if (Array.isArray(c)) return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  if (typeof c === 'number') {
    const [r, g, b] = rgbOf(c);
    return `rgb(${r},${g},${b})`;
  }
  return 'rgb(255,255,255)';
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * THE PLACEHOLDER. `draw_sprite_ext(sprite_index, image_index, x, y, scale,
 * scale, image_angle, image_blend, image_alpha)` — Draw_0:174/175/179, with
 * sprite_index = spr_sneo_bigcircle (not extracted; see the header).
 *
 * spr_sneo_bigcircle is a filled soft disc; this stands in with a ring at the
 * same radius so the orb reads as a shape at the right place and size without
 * pretending to be the art. 25px is the sprite's own half-width, measured
 * from the data files' sprite metadata (50x50, origin 25,25 — identical in
 * both builds), so the geometry is real and only the pixels are invented.
 */
function drawOrbBodyPlaceholder(ctx, x, y, scale, blend, alpha, rgbOf) {
  const r = 25 * Math.abs(scale);
  if (!(r > 0.5) || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.strokeStyle = css(blend, rgbOf);
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawObjKnightLightorb(ctx, e, state, helpers) {
  const { sprites, blit, rgbOf, defer } = helpers;

  // Draw_0:1-13 — the mod's guard. The sim destroys the instance in the same
  // place, so an orb that reaches the renderer has passed it; the test is
  // repeated because `visible` is not what gates it and a paused frame can
  // still hand us one.
  if ((state.turntimer ?? 1) < 1) return true;

  // :38-46 — `draw_sprite_ext(spr_zapper_tvturnoff1, 0, x, y, 40, aa, 0,
  // c_white, 1)`. Forty times wide, `aa` tall: a horizontal white slit that
  // collapses as the wind-up runs. `aa` is the sim's `flashAlpha` — the GML
  // passes it as the Y SCALE, not as an alpha, despite the name.
  const flash = e.flashAlpha ?? 0;
  if (e.con === 0 && flash > 0) {
    const entry = sprites.get('spr_zapper_tvturnoff1');
    if (entry) {
      blit(entry.frames[0], entry.meta.ox, entry.meta.oy,
        e.x, e.y, 40, flash, 0, 1, null);
    }
  }

  // :172-180 — one blit, or two at +-splitx once the orb has split.
  const scale = e.drawScale ?? 0.8;
  const blend = e.image_blend ?? [255, 255, 255];
  const alpha = e.image_alpha ?? 1;
  if (e.drawSplit) {
    drawOrbBodyPlaceholder(ctx, e.x + (e.splitx ?? 0), e.y, scale, blend, alpha, rgbOf);
    drawOrbBodyPlaceholder(ctx, e.x - (e.splitx ?? 0), e.y, scale, blend, alpha, rgbOf);
  } else {
    drawOrbBodyPlaceholder(ctx, e.x, e.y, scale, blend, alpha, rgbOf);
  }

  // :189-201 — the charge disc. `draw_set_alpha(circle_alpha);
  // draw_circle_color(x, y, radius, get_swordcolor(), get_swordcolor(),
  // false); draw_set_alpha(1);` — a FLAT fill (both colour stops are the same
  // value), which is the whole mod delta in this event: vanilla passed c_blue
  // twice. `radius` shrinks from 120 by 4 a frame while `circle_alpha` climbs
  // to 0.4, so it reads as the orb sucking the arena in.
  if (e.con === 0 && (e.radius ?? 0) > 0 && (e.circle_alpha ?? 0) > 0) {
    ctx.save();
    ctx.globalAlpha = clamp01(e.circle_alpha);
    ctx.fillStyle = css(e.discColor ?? blend, rgbOf);
    ctx.beginPath();
    ctx.arc(e.x, e.y, Math.max(1, e.radius), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw_64 (Draw END) — `draw_sprite_ext(spr_board_blacktile, 0, 0, 0, 100,
  // 100, 0, c_white, darken_alpha)`. A 16x16 black tile scaled a hundredfold
  // from the room origin: a 1600x1600 black sheet over everything drawn so
  // far, at `darken_alpha`. DEFERRED because Draw End runs after the whole
  // depth pass, and the override seam runs this function inside it — without
  // the defer the orb's own body would be painted over by its own darkener.
  const dark = e.darken_alpha ?? 0;
  if (dark > 0) {
    defer(() => {
      const tile = sprites.get('spr_board_blacktile');
      if (tile) {
        blit(tile.frames[0], tile.meta.ox, tile.meta.oy, 0, 0, 100, 100, 0, clamp01(dark), null);
      } else {
        // The tile is in the pack, so this arm is unreachable — kept because
        // a black rect IS what a 16x16 black tile scaled 100x draws, and a
        // missing darkener would silently brighten the whole attack.
        ctx.save();
        ctx.globalAlpha = clamp01(dark);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 1600, 1600);
        ctx.restore();
      }
    });
  }

  // TRUE — the GML Draw has no draw_self(), so nothing of the vanilla tail
  // should follow. (It would draw nothing anyway: the instance has no packed
  // sprite and no mask. Returning true says so on purpose.)
  return true;
}
