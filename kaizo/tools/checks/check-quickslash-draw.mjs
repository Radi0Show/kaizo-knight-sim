#!/usr/bin/env node
// THE QUICKSLASH FINISHER'S STRIKE OVERLAY DRAWS THE GML'S ARGUMENTS.
//
//   node kaizo/tools/checks/check-quickslash-draw.mjs
//
// NEW FILE, 2026-09-10, from a reviewer finding on kaizo/render/draw/
// quickslash.js. `drawObjRoaringknightQuickslashBig` is a nine-line event and
// two of its arguments were not the GML's — both inherited from
// kaizo/render/draw/split.js's copy of the same block, and both invisible
// today because the states that would expose them do not occur in the fights
// the gate replays. "Currently unreachable" is not a reason to ship a wrong
// argument; it is a reason to pin it, because nothing else will notice when it
// becomes reachable.
//
// The event, obj_roaringknight_quickslash_big Draw_0:5-14 (kaizo dump; the
// file is byte-identical to vanilla's, `diff` exits 0):
//
//     if (playerstrike == 1) {
//         with (obj_heart) {
//             var _xx = irandom(2) - 1;
//             var _yy = irandom(2) - 1;
//             var _fade = remap_clamped(45, 55, 1, 0, other.timer);
//             draw_sprite(sprite_index, image_index, x + _xx, y + _yy);
//             draw_sprite_ext(spr_rk_slash_heartslice, other.cuty,
//                             x + _xx, y + _yy, 1, 1, 0, c_white, _fade);
//         }
//     }
//
// THE TWO FIXES THIS FILE PINS:
//   1. `draw_sprite(sprite_index, image_index, ...)` — the sub-image is
//      obj_heart's OWN `image_index`. It was hardcoded 0, which freezes the
//      soul on frame 0 for the whole strike; the vanilla copy of this block
//      (render/draw/swords.js `drawSplitslashStrike`) passes
//      `heart.image_index`, so the two disagreed.
//   2. `other.cuty`'s FALLBACK is 8 — obj_roaringknight_quickslash_big
//      Create_0:12 is `cuty = 8`, and kaizo/attacks/quickslash.js:507 mirrors
//      it. The 1 that stood here is split.js's object's default, not this
//      one's.
//
// SABOTAGE-TESTED 2026-09-10 in both directions (see the lane report): putting
// the literal 0 back fails the sub-image assertions, putting `?? 1` back fails
// the fallback assertion.

// drawSpriteExt bakes tints on an offscreen canvas. Nothing here passes a
// colour (both calls are `c_white`/none), but render/draw/gm.js reads
// `document` at module scope in some paths, so the stub goes in first.
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0, __ops: [], __sprite: null, __sub: null };
    const g = {
      imageSmoothingEnabled: false,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: null,
      setTransform() {}, clearRect() {}, fillRect() {},
      drawImage(img) { if (img && img.__sprite) { c.__sprite = img.__sprite; c.__sub = img.__sub; } },
    };
    c.getContext = () => g;
    return c;
  },
};

const { drawObjRoaringknightQuickslashBig } = await import('../../render/draw/quickslash.js');
const { quickslashBig } = await import('../../attacks/quickslash.js');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

/** A recording 2d context: it names the sprite and the SUB-IMAGE that landed. */
function recorder() {
  const draws = [];
  let m = { x: 0, y: 0, sx: 1, sy: 1, alpha: 1 };
  const stack = [];
  return {
    draws,
    get globalAlpha() { return m.alpha; },
    set globalAlpha(v) { m.alpha = v; },
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    imageSmoothingEnabled: false,
    save() { stack.push({ ...m }); },
    restore() { if (stack.length) m = stack.pop(); },
    setTransform() { m = { x: 0, y: 0, sx: 1, sy: 1, alpha: m.alpha }; },
    translate(x, y) { m.x += x * m.sx; m.y += y * m.sy; },
    scale(x, y) { m.sx *= x; m.sy *= y; },
    rotate() {},
    fillRect() {}, clearRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, fill() {}, stroke() {},
    drawImage(img, ...rest) {
      draws.push({
        sprite: img.__sprite,
        sub: img.__sub,
        x: m.x + (rest[0] ?? 0) * m.sx,
        y: m.y + (rest[1] ?? 0) * m.sy,
        alpha: m.alpha,
      });
    },
  };
}

const spriteMap = (names) => {
  const map = new Map();
  for (const [n, meta] of Object.entries(names)) {
    const frames = [];
    for (let i = 0; i < meta.frames; i++) {
      frames.push({ width: meta.w ?? 16, height: meta.h ?? 16, __sprite: n, __sub: i });
    }
    map.set(n, { meta: { ox: meta.ox ?? 0, oy: meta.oy ?? 0, ...meta }, frames });
  }
  return map;
};

// `spr_rk_slash_heartslice` needs enough frames that 8 and 1 are TELLABLE
// APART: drawSpriteExt wraps the sub-image modulo the frame count, so a
// two-frame stand-in would fold 8 onto 0 and the assertion would be measuring
// the stub instead of the code.
const SPRITES = spriteMap({
  spr_dodgeheart: { w: 16, h: 16, ox: 8, oy: 8, frames: 4 },
  spr_rk_slash_heartslice: { w: 40, h: 40, ox: 20, oy: 20, frames: 16 },
});

const helpers = (ctx) => ({
  sprites: SPRITES,
  drawSelf() { ctx.draws.push({ sprite: '__drawSelf', sub: null }); },
  frandCanvas: () => 0.5,
});

/**
 * The finisher mid-strike, with the jitter pair already parked by the sim's
 * own draw slot (`e.strikeJitter`), so nothing here re-rolls anything.
 */
function striking({ cuty, imageIndex } = {}) {
  const e = {
    slash: false,
    playerstrike: 1,
    timer: 40,
    seq: 0,
    strikeJitter: { xx: 0, yy: 0 },
  };
  if (cuty !== undefined) e.cuty = cuty;
  const soul = { x: 300, y: 200, alive: true, sprite_index: 'spr_dodgeheart' };
  if (imageIndex !== undefined) soul.image_index = imageIndex;
  return { e, state: { frame: 100, soul } };
}

const shot = (opts) => {
  const ctx = recorder();
  const { e, state } = striking(opts);
  drawObjRoaringknightQuickslashBig(ctx, e, state, helpers(ctx));
  return {
    heart: ctx.draws.find((d) => d.sprite === 'spr_dodgeheart'),
    slice: ctx.draws.find((d) => d.sprite === 'spr_rk_slash_heartslice'),
    draws: ctx.draws,
  };
};

// ── 1. THE HEART IS DRAWN AT ITS OWN SUB-IMAGE ───────────────────────────
{
  const a = shot({ cuty: 8, imageIndex: 2 });
  ok(a.heart && a.slice, 'a striking finisher paints the soul copy and the slice over it');
  ok(a.heart.sub === 2,
    `the soul copy carries obj_heart's own image_index — 2 in, ${a.heart.sub} drawn `
    + '(`draw_sprite(sprite_index, image_index, ...)`, Draw_0:10)');
  const b = shot({ cuty: 8, imageIndex: 3 });
  ok(b.heart.sub === 3,
    `and it FOLLOWS the soul: image_index 3 draws sub-image ${b.heart.sub}, not a frozen 0`);
  ok(a.heart.sub !== b.heart.sub,
    'the two differ — a hardcoded sub-image would make them identical, which is the bug this pins');
  const none = shot({ cuty: 8 });
  ok(none.heart.sub === 0,
    `a soul carrying no image_index at all falls back to 0 (${none.heart.sub}) — sim/soul.js assigns none`);
  // The overlay is the soul's position plus the parked jitter, alpha 1.
  ok(a.heart.alpha === 1, `and the copy is drawn at alpha 1 — `.concat('`draw_sprite` takes none (')
    + `${a.heart.alpha})`);
}

// ── 2. THE SLICE IS DRAWN AT `other.cuty`, AND ITS DEFAULT IS 8 ──────────
{
  const at8 = shot({ cuty: 8, imageIndex: 0 });
  ok(at8.slice.sub === 8, `cuty 8 draws slice frame ${at8.slice.sub}`);
  const at14 = shot({ cuty: 14, imageIndex: 0 });
  ok(at14.slice.sub === 14,
    `and the catch's own remap_clamped(-16, 16, 1, 14, ...) value passes through (${at14.slice.sub})`);

  // THE FALLBACK. Draw_0:11 reads `other.cuty`, and this object's Create sets
  // it to 8 — obj_roaringknight_quickslash_big Create_0:12. The 1 that used
  // to stand here belongs to split.js's object, not this one.
  const bare = shot({ imageIndex: 0 });
  ok(bare.slice.sub === 8,
    `a finisher whose cuty never got assigned falls back to the Create's OWN 8, not to 1 `
    + `(${bare.slice.sub})`);
  ok(bare.slice.sub !== 1,
    'and specifically not to split.js\'s 1 — the two objects have different Create defaults');

  // AND THE SIM AGREES: the fallback is not a number invented in the renderer,
  // it is the value kaizo/attacks/quickslash.js's Create assigns.
  const e = {};
  quickslashBig.create(e, { frame: 0, kaizo: {}, entities: [], soul: { x: 320, y: 200 } });
  ok(e.cuty === 8,
    `kaizo/attacks/quickslash.js's Create sets cuty = ${e.cuty} — the renderer's fallback is that number`);
  ok(e.cuty === bare.slice.sub,
    'so the two halves agree by construction rather than by two typed literals');
}

// ── 3. THE GATE, and the tail the event owns ─────────────────────────────
{
  const ctx = recorder();
  const { e, state } = striking({ cuty: 8, imageIndex: 1 });
  e.playerstrike = 0;
  drawObjRoaringknightQuickslashBig(ctx, e, state, helpers(ctx));
  ok(!ctx.draws.some((d) => d.sprite === 'spr_rk_slash_heartslice'),
    'no overlay while `playerstrike != 1` — Draw_0:5');

  const ctx2 = recorder();
  const s2 = striking({ cuty: 8, imageIndex: 1 });
  s2.e.slash = true;
  const ret = drawObjRoaringknightQuickslashBig(ctx2, s2.e, s2.state, helpers(ctx2));
  ok(ctx2.draws.some((d) => d.sprite === '__drawSelf'),
    '`if (slash) draw_self()` is issued by the event itself — Draw_0:1-4');
  ok(ret === true,
    'and it returns true, so the generic blit does not paint a second unconditional copy');
}

console.log('');
if (failed) {
  console.log(`FAIL  kaizo quickslash finisher draw — ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('PASS  kaizo quickslash finisher draw — obj_roaringknight_quickslash_big Draw_0:1-14');
