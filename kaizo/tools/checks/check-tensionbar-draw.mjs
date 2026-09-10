#!/usr/bin/env node
// THE B-SIDE TENSION BAR IS DRAWN AS THE B-SIDE'S.
//
//   node kaizo/tools/checks/check-tensionbar-draw.mjs
//
// RENDER-CRITIC item 2a. obj_tensionbar Draw_0:33-94 is the mod's largest
// single Draw insert, and none of it reached the screen: the DATA half has
// been in kaizo/party/tensionbar.js since the clamp landed
// (`kaizoTensionbarSprites`, `kaizoTensionbarLayout`) and render/tensionbar.js
// read neither, so a sheared B-Side bar drew the vanilla casing, the vanilla
// cutout, a TP logo the mod suppresses, a readout 32px too high, and none of
// the orange shard markers bleeding off the 125 line.
//
// What closes it is a seam and a publisher:
//   * render/tensionbar.js reads `state.tensionBar` — a plain data SKIN
//     (bar / cutout / tplogo / yoff / trail / markers), inert when absent
//     (knight-sim branch `kaizo-draw-seams`);
//   * kaizo/party/tensionbar.js publishes it from the same end-step call that
//     runs the clamp, so the picture and the mechanic are one event, as they
//     are in the GML.
//
// THE MARKERS ARE THE PART WORTH CHECKING HARD. They are `scr_marker`
// instances with gravity, two obj_lerpvars and a destroy alarm, and every
// number below is read straight off Draw_0:47-93. The RNG they spend was
// already on the stream before this change (nine draws a TP step, counted by
// `kaizoTensionbarDraw`); what is new is that the values are KEPT instead of
// discarded, so nothing here re-rolls anything and the draw count must not
// move. That is asserted too.
//
// SABOTAGE-TESTED 2026-09-10, both directions (see the report): changing the
// bleed's spawn line from 98 to 97 makes the geometry assertions fail;
// dropping the `_sep = 7.5` branch above 200 TP makes the count assertions
// fail.

// The renderer half (section 9) bakes tints on an offscreen canvas; hand it a
// recording one so an assertion can read the colour back. Installed before
// the imports, because render/draw/gm.js reads `document` at call time.
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0, __ops: [], __sprite: null, __sub: null, __fill: null };
    const g = {
      imageSmoothingEnabled: false,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      get fillStyle() { return c.__fill; },
      set fillStyle(v) { c.__fill = v; c.__ops.push('fill'); },
      setTransform() {}, clearRect() {}, fillRect() {},
      drawImage(img) {
        if (img && img.__sprite) { c.__sprite = img.__sprite; c.__sub = img.__sub; }
        c.__ops.push('drawImage');
      },
    };
    c.getContext = () => g;
    return c;
  },
};

const {
  kaizoTensionbarDraw, kaizoTensionbarSprites, kaizoTensionbarLayout,
  kaizoTpbar, kaizoTpMarkers, TENSIONBAR_SPRITE_H, KAIZO_SIDEB_TP_CAP, MAX_TENSION,
} = await import('../../party/tensionbar.js');
const { gmlCreate } = await import('../../../sim/rng.js');
const { drawTensionBar, resetTensionBar } = await import('../../../render/tensionbar.js');
const { loadFont } = await import('../../../render/font.js');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

/**
 * A state with the shear already done: side B, `k_tpscene = -1` (the
 * permanent post-cutscene value), so the clamp and the bleed are both armed
 * and the `k_tpscene >= 10` in-cutscene branch is NOT taken.
 */
function sheared(tension, { tpscene = -1 } = {}) {
  return {
    frame: 0,
    tension,
    gmlRng: gmlCreate(12345),
    kaizo: { sideb: true, tpscene },
  };
}

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/**
 * The renderer's own fill expression, `top = h - (value / max) * h`
 * (render/tensionbar.js `fill()`), in BAR-LOCAL pixels. Used instead of a
 * second typed `98` so the bleed's spawn line and the 125 fill are one
 * quantity rather than two constants that can drift apart.
 */
const fillTop = (value) => TENSIONBAR_SPRITE_H - (value / MAX_TENSION) * TENSIONBAR_SPRITE_H;

// ── 1. the skin the renderer is handed ─────────────────────────────────────
{
  const before = { frame: 0, tension: 100, gmlRng: gmlCreate(1), kaizo: { sideb: true, tpscene: 5 } };
  kaizoTensionbarDraw(before);
  ok(before.tensionBar.bar === 'spr_tensionbar'
    && before.tensionBar.cutout === 'spr_tensionbar_cutout'
    && before.tensionBar.tplogo === true
    && before.tensionBar.yoff === 0,
    'BEFORE THE SHEAR the B-Side wears the vanilla bar — k_tpscene 5 is inside the approach, not past it');

  const after = sheared(100);
  kaizoTensionbarDraw(after);
  ok(after.tensionBar.bar === 'spr_tensionbar_sliced'
    && after.tensionBar.cutout === 'spr_tensionbar_sliced_cutout',
    'AFTER: the sprite pair swaps to the mod\'s 4992 / 4991 (spr_tensionbar_sliced / _sliced_cutout)');
  ok(after.tensionBar.tplogo === false && after.tensionBar.yoff === 32,
    'the TP logo is suppressed and the readout drops 32px — `_draw_tptext = 0`, `_yoff = 32`');
  ok(after.tensionBar.trail === kaizoTpbar(after),
    'and the skin hands over THIS module\'s trailing pair, the one the clamp clamps');
  ok(Array.isArray(after.tensionBar.markers), 'the skin carries a marker list');
  // A skin is published on EVERY frame, or the renderer would fall back to
  // the vanilla literals the moment the publisher skipped one.
  const alsoAfter = sheared(0);
  kaizoTensionbarDraw(alsoAfter);
  ok(alsoAfter.tensionBar && alsoAfter.tensionBar.bar === 'spr_tensionbar_sliced',
    'published every frame, including frames with no bleed at all (tension 0)');
  // ...and the end-cutscene early exit still publishes, because the bar is
  // gone but the markers are not.
  const ending = sheared(0);
  ending.kaizo.endCutsceneVersion = 1;
  kaizoTensionbarDraw(ending);
  ok(ending.tensionBar !== undefined,
    'and through the end-cutscene early exit too — the markers outlive the bar');
}

// ── 2. THE SPAWN LINE IS THE 125 LINE ─────────────────────────────────────
//
//     _sy = (y + sprite_height) - 98
//
// 98 is not a magic number: the bar is 196px for 250 TP, so a percentage
// point is 1.96px and 125 TP (50%) is 98px up from the bottom. If the two
// disagree the markers bleed off the wrong place.
{
  ok(TENSIONBAR_SPRITE_H === 196, 'spr_tensionbar is 196px tall (both manifests)');
  ok(near(TENSIONBAR_SPRITE_H * (1 - KAIZO_SIDEB_TP_CAP / MAX_TENSION), 98),
    '...so the 125 cap sits exactly 98px up from the bottom — the loop\'s own `- 98`');

  const st = sheared(126);
  kaizoTensionbarDraw(st);
  const m = kaizoTpMarkers(st);
  ok(m.length === 3, `one TP step past 125 spawns THREE markers, one per column (${m.length})`);
  // `x + 3.4 + (_h * 6.66)` — bar-local, so the `x +` is the origin the
  // renderer translates to. The fill itself spans x 3..w-1 of a 25px bar.
  const xs = m.map((k) => Number(k.x.toFixed(2))).join(',');
  ok(xs === '3.4,10.06,16.72',
    `the three columns stand at 3.4 / 10.06 / 16.72 across the 25px bar (${xs})`);
  ok(m.every((k) => k.x > 3 && k.x < 24),
    'and all three are inside the bar\'s own fill span (x 3 .. w-1)');
  // `_yy` / `_sy` are both recomputed inside the h loop, 1.5px apart.
  const ys = m.map((k) => Number((k.y - m[0].y).toFixed(4))).join(',');
  ok(ys === '0,1.5,3', `the columns are stepped 1.5px apart in y as well (${ys})`);
}

// ── 3. THE MARKER BLEEDS UPWARD, off the line, to where its TP would be ───
{
  const st = sheared(200);
  kaizoTensionbarDraw(st);
  const m = kaizoTpMarkers(st);
  // Every marker starts ON the line (the h-stagger aside) and its `y` tween
  // ends ABOVE it, because _tpnum > 50 for every _i past 125.
  // THE SPAWN LINE, DERIVED THE WAY THE FILL DERIVES IT — not a second typed
  // 98, and not a screen-space one. The skin is BAR-LOCAL (render/tensionbar.js
  // "THE SKIN SEAM"), and the renderer stops a `value` fill at
  // `h - (value / max) * h`; for the B-Side's 125 cap on a 196px bar that is
  // 98, which is the loop's own `- 98`. Section 9 asserts the two against each
  // other on the renderer's real output.
  const line = fillTop(KAIZO_SIDEB_TP_CAP);
  ok(m.every((k) => k.y >= line && k.y < line + 4),
    `every marker is born on the 125 line at y ${line} (+ the 0/1.5/3 column stagger)`);
  const tween = m.map((k) => k.lerps.find((t) => t.name === 'y')).filter(Boolean);
  ok(tween.length === m.length, 'each carries a y tween — scr_lerpvar("y", _sy, _yy, _delay)');
  ok(tween.every((t) => t.b < t.a),
    'and every one of them ends ABOVE where it started — the TP is bleeding out of the top');
  // The destination is the height that TP would have reached: 1.96px a point.
  const first = m[0];
  const yTween = first.lerps.find((t) => t.name === 'y');
  const tpnum = 125.1 / 2.5;
  ok(near(yTween.b, TENSIONBAR_SPRITE_H - tpnum * 1.96),
    'the destination is `sprite_height - (_i / 2.5) * 1.96` — where that TP would have stood, bar-local');
  // BOTH HALVES OF THE RECORD ARE IN ONE FRAME. The x drops the GML's `x +`
  // because the renderer translates by the bar's own x; the y must drop
  // `y +` for the same reason. A y that still carried the bar's 40 would sit
  // below the 196px sprite entirely at the top of the bleed.
  ok(m.every((k) => k.y >= 0 && k.y <= TENSIONBAR_SPRITE_H),
    'and every spawn y is inside the bar\'s own 0..196 — the record is bar-local in y as it is in x');
  ok(tween.every((t) => t.b >= 0 && t.b <= TENSIONBAR_SPRITE_H),
    'so is every destination');
}

// ── 4. `_sep`, and how many markers a bleed is ────────────────────────────
//
//     var _sep = 4;  if (global.tension >= 200) _sep = 7.5;
//     var _i = 125.1;  while (_i <= global.tension) { 3 markers; _i += _sep; }
//
// `_sep` is chosen ONCE from the PRE-CLAMP tension, and `_i` accumulates in
// f64 from an inexact 125.1 — so the count is a walk, not a division.
{
  const count = (t) => {
    const st = sheared(t);
    const out = kaizoTensionbarDraw(st);
    return { particles: out.particles, draws: out.draws, live: kaizoTpMarkers(st).length };
  };
  const walk = (t) => {
    let n = 0;
    let i = 125.1;
    const sep = t >= 200 ? 7.5 : 4;
    while (i <= t) { n += 3; i += sep; }
    return n;
  };
  for (const t of [124, 125, 126, 150, 199, 200, 201, 250]) {
    const c = count(t);
    ok(c.particles === walk(t) && c.live === c.particles,
      `tension ${t}: ${c.particles} markers, and every one of them is on the list`);
  }
  ok(count(125).particles === 0,
    'AT 125 the loop does not run at all — `_i` starts at 125.1, above the cap');
  ok(count(200).particles < count(199).particles,
    `the `.concat('`_sep = 7.5` branch THINS the bleed above 200 TP ')
      + `(${count(199).particles} markers at 199, ${count(200).particles} at 200)`);
  // NINE DRAWS A STEP, unchanged: three random_range per marker, three
  // markers per step. Keeping the values instead of discarding them must not
  // move the stream.
  for (const t of [126, 150, 250]) {
    const c = count(t);
    ok(c.draws === c.particles * 3,
      `tension ${t}: ${c.draws} RNG draws for ${c.particles} markers — three each, nine a TP step`);
  }
}

// ── 5. THE TWO LIVES, and the branch that picks them ─────────────────────
{
  // Out of the cutscene: `_delay = ceil((_i - 125) / 20)`, so the first 20 TP
  // above the cap get delay 1, the next 20 delay 2, and so on.
  const slow = sheared(126);
  kaizoTensionbarDraw(slow);
  const m = kaizoTpMarkers(slow)[0];
  ok(m.life === 36, `delay 1 lives 35 + delay = 36 frames (${m.life})`);
  ok(m.lerps.some((t) => t.name === 'vspeed' && t.a === 0),
    'its vspeed is TWEENED UP from a standstill — the roll is the destination, not the start');
  ok(m.lerps.some((t) => t.name === 'image_alpha' && t.a === 1.5 && t.maxtime === 26),
    'and its alpha lerps 1.5 -> 0 over 25 + delay frames');
  ok(near(m.gravity, 0.35), 'gravity 0.35');
  ok(m.image_yscale === m.image_xscale / 1.75, 'image_yscale = image_xscale / 1.75');
  ok(m.image_xscale >= 0.46 && m.image_xscale <= 0.68,
    `image_xscale is inside random_range(0.46, 0.68) (${m.image_xscale.toFixed(4)})`);

  // Inside the shear cutscene: delay 0, a different spread, placed not tweened.
  const scene = sheared(126, { tpscene: 11.1 });
  kaizoTensionbarDraw(scene);
  const s = kaizoTpMarkers(scene)[0];
  ok(s.life === 45, `in the cutscene every marker lives 45 frames flat (${s.life})`);
  ok(!s.lerps.some((t) => t.name === 'y') && !s.lerps.some((t) => t.name === 'vspeed'),
    'it is PLACED at its destination (`y = _yy`) with no y or vspeed tween');
  ok(s.lerps.length === 1 && s.lerps[0].a === 4.5 && s.lerps[0].maxtime === 45,
    'its only tween is alpha 4.5 -> 0 over 45 — opaque for the first 34 frames, then a fast fade');
  ok(s.hspeed <= -3 && s.hspeed >= -5,
    `and it is thrown LEFT, hard — the cutscene's `.concat('`_hsp = [-3, -5]` ')
      + `(hspeed ${s.hspeed.toFixed(3)})`);
  ok(s.vspeed <= -2 && s.vspeed >= -5,
    `and up, over a wider spread than the ordinary bleed's [-2,-1] (vspeed ${s.vspeed.toFixed(3)})`);
  // The fractional in-scene values are inside the gate by construction.
  ok(kaizoTensionbarSprites(scene).bar === 'spr_tensionbar_sliced',
    'k_tpscene 11.1 is `>= 10`, so the sheared bar is already on during the cutscene');
}

// ── 6. THEY FALL, THEY FADE, THEY GO ─────────────────────────────────────
{
  const st = sheared(126);
  kaizoTensionbarDraw(st);
  const born = { ...kaizoTpMarkers(st)[0] };
  const track = [];
  for (let f = 1; f <= 40; f++) {
    st.frame = f;
    st.tension = 0; // nothing new spawns; only the existing three run out
    kaizoTensionbarDraw(st);
    const live = kaizoTpMarkers(st);
    track.push({ f, n: live.length, y: live[0]?.y, a: live[0]?.image_alpha, v: live[0]?.vspeed });
  }
  const alive = track.filter((t) => t.n > 0);
  ok(alive.length === 35,
    `a delay-1 marker survives 35 more frames and is destroyed on its 36th (${alive.length})`);
  ok(track[35].n === 0, 'and the list is empty from that frame on — the instance_destroy alarm');
  // GRAVITY WINS once the tweens are done: y must end BELOW where it was
  // placed, even though the y tween took it up first.
  const last = alive[alive.length - 1];
  ok(last.y > born.y,
    `gravity 0.35 pulls it back down past the line it came off (${born.y.toFixed(1)} -> ${last.y.toFixed(1)})`);
  ok(last.v > alive[0].v,
    `and its vspeed climbs every frame it is not being tweened (${alive[0].v.toFixed(3)} -> ${last.v.toFixed(3)})`);
  // The alpha ramp: 1.5 -> 0 over 26, so it crosses 1 (visible full) a third
  // of the way in and hits 0 at 26 — nine frames before the destroy.
  ok(alive[0].a > 1 && alive[25].a <= 0.0001,
    `alpha starts above 1 (drawn opaque) and reaches 0 at frame 26 (${alive[0].a.toFixed(3)} -> ${alive[25].a.toFixed(3)})`);
  ok(alive.slice(26).every((t) => t.a <= 0.0001),
    'and stays there for the nine frames the marker outlives its own fade');
}

// ── 7. THE MARKERS THE RENDERER IS HANDED ────────────────────────────────
{
  const st = sheared(140);
  kaizoTensionbarDraw(st);
  const skin = st.tensionBar;
  const live = kaizoTpMarkers(st);
  ok(skin.markers.length === live.length && live.length > 0,
    `every live marker is published (${skin.markers.length} of ${live.length})`);
  ok(skin.markers.every((d) => d.sprite === 'spr_roaringknight_finalslash_mask'),
    'all of them wear spr_roaringknight_finalslash_mask — Draw_0:65');
  ok(skin.markers.every((d) => d.blend[0] === 255 && d.blend[1] === 128 && d.blend[2] === 0),
    'and c_orange, which GameMaker packs BGR as 0x0080FF = RGB(255, 128, 0)');
  ok(skin.markers.every((d) => d.subimage === 0),
    'sub-image 0 — `image_speed = 0` on a one-frame sprite, so nothing animates');
  ok(skin.markers.every((d, i) => d.x === live[i].x && d.y === live[i].y
    && d.xscale === live[i].image_xscale && d.yscale === live[i].image_yscale),
    'and the draw call carries the marker\'s own position and scales, unmodified');
}

// ── 8. THE CLAMP STILL CLAMPS, and the pair the renderer reads is clamped ─
{
  const st = sheared(240);
  const out = kaizoTensionbarDraw(st);
  ok(out.clamped === true, 'the gate is open and the clamp ran');
  ok(st.tension === KAIZO_SIDEB_TP_CAP, `global.tension is clamped to 125 (${st.tension})`);
  const bar = st.tensionBar.trail;
  ok(bar.apparent <= KAIZO_SIDEB_TP_CAP && bar.current <= KAIZO_SIDEB_TP_CAP,
    `and so are both halves of the pair the bar draws (${bar.apparent} / ${bar.current})`);
  ok(bar.maxed === 0,
    'MAX is unreachable on a sheared bar — maxtension is still 250, so the readout tops out at 50%');
}

// ── 9. THE SEAM ITSELF: render/tensionbar.js reads the skin ──────────────
//
// Everything above is about the PUBLISHER. This is the other half: the engine
// file that consumes it (knight-sim branch `kaizo-draw-seams`). Without this
// the skin could be perfect and the bar could still draw vanilla.
//
// The bar is drawn straight, with a context that keeps the translate/scale
// stack, so an assertion can say WHICH sprite landed WHERE.
{
  /**
   * A recording 2d context: transform-aware, and it names what it drew.
   *
   * `fills` is recorded too, and it is not decoration: the bleed's spawn line
   * and the bar's 125 fill are the SAME line, computed by two different files,
   * and the only way to assert that is to read the fill the renderer actually
   * issued rather than re-typing 98 here (below, "THE SPAWN LINE IS THE FILL
   * LINE").
   */
  function recorder() {
    const draws = [];
    const fills = [];
    let m = { x: 0, y: 0, sx: 1, sy: 1, alpha: 1, op: 'source-over' };
    const stack = [];
    return {
      draws,
      fills,
      get globalAlpha() { return m.alpha; },
      set globalAlpha(v) { m.alpha = v; },
      get globalCompositeOperation() { return m.op; },
      set globalCompositeOperation(v) { m.op = v; },
      fillStyle: '',
      imageSmoothingEnabled: false,
      save() { stack.push({ ...m }); },
      restore() { if (stack.length) m = stack.pop(); },
      setTransform() { m = { x: 0, y: 0, sx: 1, sy: 1, alpha: m.alpha, op: m.op }; },
      translate(x, y) { m.x += x * m.sx; m.y += y * m.sy; },
      scale(x, y) { m.sx *= x; m.sy *= y; },
      rotate() {},
      fillRect(x, y, w, h) {
        fills.push({
          style: this.fillStyle,
          x: m.x + x * m.sx,
          y: m.y + y * m.sy,
          w: w * m.sx,
          h: h * m.sy,
        });
      },
      clearRect() {},
      drawImage(img, ...rest) {
        // Two call shapes reach here: `drawImage(img, dx, dy)` from the bar
        // itself, and the 9-argument `drawImage(img, sx, sy, sw, sh, dx, dy,
        // dw, dh)` the font's glyph blitter issues.
        const nine = rest.length >= 6;
        const ox = (nine ? rest[4] : rest[0]) ?? 0;
        const oy = (nine ? rest[5] : rest[1]) ?? 0;
        const baked = Array.isArray(img.__ops);
        draws.push({
          sprite: img.__sprite,
          tint: baked && img.__ops[0] === 'drawImage' ? img.__fill : null,
          x: m.x + ox * m.sx,
          y: m.y + oy * m.sy,
          sx: m.sx,
          sy: m.sy,
          alpha: m.alpha,
        });
      },
    };
  }
  const spriteMap = (names) => {
    const map = new Map();
    for (const [n, meta] of Object.entries(names)) {
      const frames = [];
      for (let i = 0; i < (meta.frames ?? 2); i++) {
        frames.push({ width: meta.w ?? 25, height: meta.h ?? 196, __sprite: n, __sub: i });
      }
      map.set(n, { meta: { ox: meta.ox ?? 0, oy: meta.oy ?? 0, ...meta }, frames });
    }
    return map;
  };
  const SPRITES = spriteMap({
    spr_tensionbar: { w: 25, h: 196, frames: 2 },
    spr_tensionbar_cutout: { w: 25, h: 197, frames: 1 },
    spr_tensionbar_sliced: { w: 25, h: 196, frames: 2 },
    spr_tensionbar_sliced_cutout: { w: 25, h: 197, frames: 1 },
    spr_tplogo: { w: 22, h: 44, frames: 1 },
    spr_tensionmarker: { w: 19, h: 2, frames: 1 },
    spr_roaringknight_finalslash_mask: { w: 10, h: 10, ox: 5, oy: 5, frames: 1 },
  });

  // VANILLA: no skin on state, and the bar is what it always was.
  resetTensionBar();
  const vctx = recorder();
  drawTensionBar(vctx, { frame: 200, tension: 60 }, SPRITES);
  const vnames = vctx.draws.map((d) => d.sprite);
  ok(vnames.includes('spr_tensionbar') && vnames.includes('spr_tensionbar_cutout'),
    'NO SKIN: the vanilla casing and cutout — the seam is inert when nothing publishes one');
  ok(vnames.includes('spr_tplogo'), 'and the TP logo is drawn');
  ok(!vnames.includes('spr_roaringknight_finalslash_mask'), 'and there are no markers');

  // SHEARED: the skin the publisher above builds.
  const st = sheared(150);
  kaizoTensionbarDraw(st);
  // PAST THE SLIDE-IN. obj_tensionbar's Create launches it at `view_x - 40`
  // with hspeed 13 and friction 1, so it travels 78px over 13 frames and
  // rests at x 38 — which is where the markers' bar-local coordinates are
  // meant to be read against. Any frame past 13 gives the rest position.
  st.frame = 200;
  resetTensionBar();
  const kctx = recorder();
  drawTensionBar(kctx, st, SPRITES);
  const knames = kctx.draws.map((d) => d.sprite);
  ok(knames.includes('spr_tensionbar_sliced') && knames.includes('spr_tensionbar_sliced_cutout'),
    'WITH THE SKIN: the sheared casing and its own cutout are what the bar wears');
  ok(!knames.includes('spr_tensionbar') && !knames.includes('spr_tensionbar_cutout'),
    'and the vanilla pair is not drawn at all');
  ok(!knames.includes('spr_tplogo'),
    'the TP logo is SUPPRESSED — `_draw_tptext = 0`');

  const painted = kctx.draws.filter((d) => d.sprite === 'spr_roaringknight_finalslash_mask');
  ok(painted.length === st.tensionBar.markers.length && painted.length > 0,
    `every published marker is painted (${painted.length} of ${st.tensionBar.markers.length})`);
  const first = painted[0];
  const m0 = st.tensionBar.markers[0];
  ok(Math.abs(first.sx - m0.xscale) < 1e-9,
    `and at its own random_range(0.46, 0.68) scale (${first.sx.toFixed(4)})`);
  ok(first.tint === 'rgb(255,128,0)',
    `and in c_orange (${first.tint})`);

  // THE SPAWN LINE IS THE FILL LINE. This is the assertion that ties the two
  // halves of the seam together, and the one that fails when the record mixes
  // coordinate frames.
  //
  // The bleed is born on the 125 line (`_sy = ... - 98`, published bar-local)
  // and the bar's own fill STOPS on the 125 line (`top = h - (value/max) * h`,
  // computed inside the renderer's translate). Two files, two expressions, one
  // line — so the honest test is to read the fill the renderer actually issued
  // and compare it to the shard the renderer actually painted, in screen
  // pixels, with neither number typed here.
  //
  // The previous version of this asserted `first.y === Y + m0.y - 5*scale`,
  // which is a restatement of the translate the renderer obviously did: it
  // held just as well while the publisher was shipping a screen-space y and
  // the whole bleed sat 40px below the bar. It could not fail.
  //
  // Posed with the pair SETTLED AT THE CAP so the fill the renderer issues is
  // the 125 fill (the chase is mid-flight on the frame the shear lands, and a
  // fill at `apparent` would be measuring something else).
  const capped = sheared(126);
  kaizoTensionbarDraw(capped);
  capped.frame = 200;
  const cpair = capped.tensionBar.trail;
  cpair.apparent = KAIZO_SIDEB_TP_CAP;
  cpair.current = KAIZO_SIDEB_TP_CAP;
  const fctx = recorder();
  drawTensionBar(fctx, capped, SPRITES);
  const shards = fctx.draws.filter((d) => d.sprite === 'spr_roaringknight_finalslash_mask');
  const sm = capped.tensionBar.markers;
  ok(fctx.fills.length === 1 && shards.length === 3,
    `the settled 125 fill and the three shards are on one frame `
    + `(${fctx.fills.length} fill(s), ${shards.length} shard(s))`);
  const capFill = fctx.fills[0];
  // Undo the 10x10 sprite's centred origin to recover the marker's own point.
  const shardY = shards.map((d, i) => d.y + (5 * sm[i].yscale));
  ok(near(shardY[0], capFill.y),
    `a shard is born EXACTLY where the 125 fill stops — shard ${shardY[0].toFixed(4)} against fill `
    + `${capFill.y.toFixed(4)}, both in screen pixels, neither one typed in this file`);
  ok(near(shardY[1] - shardY[0], 1.5) && near(shardY[2] - shardY[1], 1.5),
    'and the other two columns are the loop\'s own 1.5px stagger below it');
  // The x half of the same statement: the shard column must sit inside the
  // fill's own span, which the renderer draws from x 3 to w-1 of the casing.
  const shardX = shards.map((d, i) => d.x + (5 * sm[i].xscale));
  ok(shardX.every((x) => x >= capFill.x && x <= capFill.x + capFill.w),
    `and all three columns stand inside the fill's own x span `
    + `(${capFill.x.toFixed(1)} .. ${(capFill.x + capFill.w).toFixed(1)})`);

  // THE READOUT DROP, ON THE CONSUMER SIDE. `_draw_tptext = 0` and
  // `_yoff = 32` are one decision in the GML; section 1 asserts the publisher
  // ships `yoff === 32`, which says nothing about whether the renderer ever
  // moves a pixel for it. The readout is drawn with a real font asset, and
  // `loadFont` never resolves under node (its fetch is a file:// URL), so the
  // cache is filled by hand here — one glyph is enough to see where the pen
  // was put.
  const font = loadFont();
  font.meta = { name: 'fnt_mainbig__check_stub' };
  font.img = { width: 64, height: 64, __sprite: '__glyph' };
  font.glyphs = new Map([[0x30, { c: 0x30, x: 0, y: 0, w: 8, h: 12, shift: 9, offset: 0 }]]);
  font.ready = true;
  const readoutY = (yoff) => {
    capped.tensionBar.yoff = yoff;
    const c = recorder();
    drawTensionBar(c, capped, SPRITES);
    const g = c.draws.filter((d) => d.sprite === '__glyph');
    return g.length ? g[0].y : null;
  };
  const dropped = readoutY(32);
  const flat = readoutY(0);
  capped.tensionBar.yoff = 32;
  ok(dropped !== null && flat !== null,
    `the readout puts glyphs on the screen with the stub font (${dropped}, ${flat})`);
  ok(dropped - flat === 32,
    `and the skin's yoff MOVES it: 32 published, ${dropped - flat} pixels of travel — `
    + 'the renderer honours `_yoff`, it does not merely receive it');
  ok(dropped - flat === kaizoTensionbarLayout(capped).yoff,
    'and the travel is the layout\'s own number, not a constant that happens to match');

  // THE RENDERER MUST NOT STEP THE PAIR IT DOES NOT OWN. The publisher runs
  // the chase in its own end-step slot; a second chase here would move the
  // fill twice a frame and disagree with the number the clamp enforces.
  const pair = st.tensionBar.trail;
  // POSED SO A SECOND CHASE WOULD SHOW. The pair is put far from the live
  // tension, which is exactly the state the chase exists to close: a renderer
  // that stepped it would move `apparent` 20 a call and `current` off 0. A
  // pair that already agreed with the tension would sit still either way, and
  // the assertion would prove nothing.
  pair.apparent = 0;
  pair.current = 0;
  pair.changetimer = 0;
  st.tension = 125;
  const snapshot = { ...pair };
  const c2 = recorder();
  drawTensionBar(c2, st, SPRITES);
  drawTensionBar(c2, st, SPRITES);
  ok(pair.apparent === snapshot.apparent && pair.current === snapshot.current
    && pair.changetimer === snapshot.changetimer && pair.maxed === snapshot.maxed,
    'two draws with the pair 125 away from the live tension leave it UNTOUCHED — '
    + `the renderer reads a published pair and writes nothing back (apparent ${pair.apparent})`);
}

console.log('');
if (failed) {
  console.log(`FAIL  kaizo tension bar draw — ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('PASS  kaizo tension bar draw — obj_tensionbar Draw_0:33-94: sliced skin, layout, the bleed');
