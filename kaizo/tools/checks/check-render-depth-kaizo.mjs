#!/usr/bin/env node
// THE TWO DEPTH DEFECTS — RENDER-CRITIC items 4a and 4b.
//
//   node kaizo/tools/checks/check-render-depth-kaizo.mjs
//
// Both are the same shape: something is painted at a moment in the frame that
// puts it under, or over, the wrong thing — and the symptom is a picture, so
// no sim suite could ever see it.
//
//  4a  obj_roaringknight_boxsplitter_attack's 142x142 additive hell surface
//      was blitted INLINE, inside the depth-sorted pass, at the manager's
//      depth 1 (kaizo/attacks/flurry-boxsplitter-attack.js:147). The battle
//      box carries no depth at all in the sim, so it sorts as 0 and the pass
//      — deeper first — drew the surface and then painted the box's opaque
//      frame-1 interior over every pixel of it. The telegraph was invisible
//      on the kaizo page for the whole of every splitter turn. The fix is the
//      one the quickslash review already made for quickslash:
//      `helpers.defer`, which runs the blit after the sorted pass and before
//      the soul — the position the VANILLA renderer always used for this same
//      surface ("above the arena, below the soul").
//
//  4b  obj_roaringknight_quickslash_big had no registry entry and no
//      DRAW_EVENTS entry, so render/canvas.js's generic blit painted its
//      `spr_rk_quickslash_marker` definition stand-in on every pending frame.
//      The game draws NOTHING from this object until the cut: its whole Draw
//      is `if (slash) draw_self()` plus the strike overlay.
//
// The assertions are POSITIVE in both directions: the deferred blit really
// happens (with the right blend, at the right place) and really is deferred;
// the finisher really draws its cut and really draws nothing before it.
//
// SABOTAGE-TESTED 2026-09-10, both directions (see the report): restoring the
// inline blit in split.js makes the 4a assertions fail; removing the
// `if (e.slash)` gate in the finisher's drawer makes the 4b ones fail.

// The drawers build offscreen surfaces at import/draw time; give them one.
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 };
    const g = {
      imageSmoothingEnabled: false,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '',
      setTransform() {}, clearRect() {}, fillRect() {}, drawImage() {},
      save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, fill() {}, stroke() {},
      createPattern: () => ({}),
    };
    c.getContext = () => g;
    return c;
  },
};

const { drawObjRoaringknightBoxsplitterAttack } = await import('../../render/draw/split.js');
const { drawObjRoaringknightQuickslashBig } = await import('../../render/draw/quickslash.js');
const { KAIZO_DRAW_OVERRIDES } = await import('../../render/index.js');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

/** A main-canvas context that logs drawImage with the blend mode in effect. */
function recorder() {
  const draws = [];
  let m = { x: 0, y: 0, alpha: 1, op: 'source-over' };
  const stack = [];
  return {
    draws,
    get globalAlpha() { return m.alpha; },
    set globalAlpha(v) { m.alpha = v; },
    get globalCompositeOperation() { return m.op; },
    set globalCompositeOperation(v) { m.op = v; },
    fillStyle: '',
    imageSmoothingEnabled: false,
    save() { stack.push({ ...m }); },
    restore() { if (stack.length) m = stack.pop(); },
    setTransform() { m = { x: 0, y: 0, alpha: m.alpha, op: m.op }; },
    translate(x, y) { m.x += x; m.y += y; },
    scale() {}, rotate() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, fill() {}, stroke() {},
    fillRect() {}, clearRect() {},
    drawImage(img, ...rest) {
      const dx = rest.length >= 8 ? rest[4] : (rest[0] ?? 0);
      const dy = rest.length >= 8 ? rest[5] : (rest[1] ?? 0);
      draws.push({ img, x: m.x + dx, y: m.y + dy, alpha: m.alpha, op: m.op });
    },
  };
}

function entryFor(name, frames = 1) {
  const fs = [];
  for (let i = 0; i < frames; i++) fs.push({ width: 16, height: 16, __sprite: name, __sub: i });
  return { meta: { w: 16, h: 16, ox: 8, oy: 8, frames }, frames: fs };
}

/**
 * spr_rk_slash_heartslice is an 18-frame sheet (the slice, by where the cut
 * crossed the soul); everything else here needs only a few. Given its real
 * frame count so `cuty` is not silently wrapped by the stub.
 */
const FRAME_COUNTS = { spr_rk_slash_heartslice: 18 };

function helpersFor(ctx, names, deferred) {
  const sprites = new Map();
  for (const n of names) sprites.set(n, entryFor(n, FRAME_COUNTS[n] ?? 4));
  return {
    sprites,
    defer: (fn) => deferred.push(fn),
    drawSelf: (e) => {
      const entry = sprites.get(e.sprite_index);
      if (entry) ctx.drawImage(entry.frames[0], -entry.meta.ox, -entry.meta.oy);
    },
    frandCanvas: (frame, salt) => (((frame * 2654435761 + salt * 40503) >>> 0) / 4294967296),
  };
}

// ── 4a: the hell surface is DEFERRED, not drawn inline ────────────────────
{
  const gt = { alive: true, type: { name: 'obj_growtangle' }, x: 320, y: 170 };
  const pending = {
    alive: true, type: { name: 'obj_roaringknight_splitslash' }, slash: false,
    timer: 12, flip: 1, image_blend: [134, 162, 255], image_angle: 40,
    xoffset: 0, yoffset: 0, angleoffset: 0,
  };
  const manager = {
    alive: true, type: { name: 'obj_roaringknight_boxsplitter_attack' },
    x: 320, y: 170, depth: 1, image_alpha: 1, sprite_index: 'spr_manager', seq: 3,
  };
  const state = { frame: 40, entities: [gt, pending, manager] };

  const ctx = recorder();
  const deferred = [];
  const helpers = helpersFor(ctx,
    ['spr_pxwhite10_center', 'spr_knight_bullet_flow', 'spr_manager'], deferred);

  const claimed = drawObjRoaringknightBoxsplitterAttack(ctx, manager, state, helpers);
  ok(claimed === true, 'the manager claims its draw (its Draw has no trailing draw_self)');

  // What lands INLINE is the manager's own pose and nothing else. The surface
  // is filled offscreen, so a fill leaves no trace on the main canvas.
  ok(ctx.draws.length === 1,
    `inline, the manager draws only its own pose — one blit (${ctx.draws.length})`);
  ok(ctx.draws[0].op === 'source-over',
    'and that pose is drawn normally, not additively — the additive blend belongs to the surface');

  ok(deferred.length === 1,
    `the 142x142 hell surface is DEFERRED — exactly one closure queued (${deferred.length})`);

  // Run it: this is what render/canvas.js does after the whole sorted pass.
  deferred[0]();
  const late = ctx.draws[1];
  ok(late !== undefined, 'the deferred closure blits the surface when it is flushed');
  ok(late.op === 'lighter',
    '`draw_set_blend_mode(bm_add)` — the surface goes on additively (canvas `lighter`)');
  ok(late.x === 320 - 71 && late.y === 170 - 71,
    `at (obj_growtangle.x - 71, obj_growtangle.y - 71) = (${late.x}, ${late.y}) — the 142x142 centred on the box`);
  ok(late.img && late.img.width === 142 && late.img.height === 142,
    `and what it blits is the 142x142 surface itself (${late.img?.width}x${late.img?.height})`);

  // THE LATE PASS MUST STILL STEP ASIDE. The port owns the surface, so
  // render/canvas.js's own `drawHellSurface` must not run it a second time.
  ok(KAIZO_DRAW_OVERRIDES.obj_roaringknight_boxsplitter_attack.ownsHellSurface === true,
    '`ownsHellSurface` is still set, so the vanilla late pass does not draw a second copy');
}

// ── 4a, the other half: no pending slash, nothing is deferred ─────────────
{
  const gt = { alive: true, type: { name: 'obj_growtangle' }, x: 320, y: 170 };
  const manager = {
    alive: true, type: { name: 'obj_roaringknight_boxsplitter_attack' },
    x: 320, y: 170, depth: 1, image_alpha: 0, sprite_index: 'spr_manager', seq: 3,
  };
  const state = { frame: 40, entities: [gt, manager] };
  const ctx = recorder();
  const deferred = [];
  const helpers = helpersFor(ctx, ['spr_manager'], deferred);
  drawObjRoaringknightBoxsplitterAttack(ctx, manager, state, helpers);
  ok(deferred.length === 0,
    'with no pending cut there is no surface and nothing is queued — the additive blit of a cleared surface is a no-op');
  ok(ctx.draws.length === 0,
    'and `image_alpha > 0` is the mod\'s own gate: a faded manager draws no pose either');
}

// ── 4b: the finisher draws NOTHING before its cut ────────────────────────
{
  ok(typeof KAIZO_DRAW_OVERRIDES.obj_roaringknight_quickslash_big === 'function',
    'obj_roaringknight_quickslash_big has a registry entry at all — it had none, and the generic blit filled the gap');

  const heart = { alive: true, x: 300, y: 160, sprite_index: 'spr_dodgeheart' };
  const pendingBig = {
    alive: true, type: { name: 'obj_roaringknight_quickslash_big' }, seq: 9,
    slash: false, playerstrike: 0, timer: 20, cuty: 8,
    // Exactly what kaizo/attacks/quickslash.js's Create leaves on it — the
    // definition stand-in the generic blit was painting.
    sprite_index: 'spr_rk_quickslash_marker', image_index: 0,
    image_xscale: 1, image_yscale: 1, image_angle: 0, image_alpha: 1,
    x: 320, y: 170,
  };
  const state = { frame: 100, soul: heart, entities: [heart, pendingBig] };
  const ctx = recorder();
  const helpers = helpersFor(ctx,
    ['spr_rk_quickslash_marker', 'spr_dodgeheart', 'spr_rk_slash_heartslice'], []);

  const claimed = drawObjRoaringknightQuickslashBig(ctx, pendingBig, state, helpers);
  ok(claimed === true,
    'it claims the draw, so the vanilla tail cannot blit the stand-in behind its back');
  ok(ctx.draws.length === 0,
    `and while `.concat('`slash` is false it draws NOTHING — the game shows only the ')
      + `controller's hell-surface gradient here (${ctx.draws.length} draws)`);
}

// ── 4b: ...and everything, at the cut ────────────────────────────────────
{
  const heart = { alive: true, x: 300, y: 160, sprite_index: 'spr_dodgeheart' };
  const big = {
    alive: true, type: { name: 'obj_roaringknight_quickslash_big' }, seq: 9,
    slash: true, playerstrike: 1, timer: 47, cuty: 11,
    strikeJitter: { xx: 1, yy: -1 },
    sprite_index: 'spr_rk_quickslash', image_index: 2,
    image_xscale: 1, image_yscale: 1, image_angle: 0, image_alpha: 1,
    x: 320, y: 170,
  };
  const state = { frame: 100, soul: heart, entities: [heart, big] };
  const ctx = recorder();
  const helpers = helpersFor(ctx,
    ['spr_rk_quickslash', 'spr_dodgeheart', 'spr_rk_slash_heartslice'], []);

  drawObjRoaringknightQuickslashBig(ctx, big, state, helpers);
  ok(ctx.draws.length === 3,
    `at the cut: draw_self, the jittered soul copy and the heart slice — three blits (${ctx.draws.length})`);
  ok(ctx.draws[0].img.__sprite === 'spr_rk_quickslash',
    'the first is `draw_self()` — the cut sprite, under the `if (slash)` gate');
  const soulCopy = ctx.draws[1];
  ok(soulCopy.img.__sprite === 'spr_dodgeheart'
    && soulCopy.x === 300 + 1 - 8 && soulCopy.y === 160 - 1 - 8,
    `the soul is REDRAWN by the slash at (x + _xx, y + _yy) with the jitter its draw slot rolled (${soulCopy.x}, ${soulCopy.y})`);
  const slice = ctx.draws[2];
  ok(slice.img.__sprite === 'spr_rk_slash_heartslice' && slice.img.__sub === 11,
    `and spr_rk_slash_heartslice on top at sub-image `.concat('`cuty` = 11'));
  // `remap_clamped(45, 55, 1, 0, timer)`: at timer 47 the slice is 80% there.
  ok(Math.abs(slice.alpha - 0.8) < 1e-9,
    `its alpha is remap_clamped(45, 55, 1, 0, 47) = 0.8 (${slice.alpha})`);
}

// ── 4b: the two irandom are NOT re-rolled in the renderer ────────────────
{
  const heart = { alive: true, x: 300, y: 160, sprite_index: 'spr_dodgeheart' };
  const big = {
    alive: true, type: { name: 'obj_roaringknight_quickslash_big' }, seq: 9,
    slash: false, playerstrike: 1, timer: 46, cuty: 4,
    strikeJitter: { xx: 0, yy: 1 },
    sprite_index: 'spr_rk_quickslash', image_index: 0, image_alpha: 1,
    x: 320, y: 170,
  };
  // A live RNG that would notice: any draw off it moves `draws`.
  const { gmlCreate } = await import('../../../sim/rng.js');
  const rng = gmlCreate(999);
  const state = { frame: 100, soul: heart, entities: [heart, big], gmlRng: rng };
  const ctx = recorder();
  const helpers = helpersFor(ctx, ['spr_dodgeheart', 'spr_rk_slash_heartslice'], []);
  const before = rng.draws ?? 0;
  drawObjRoaringknightQuickslashBig(ctx, big, state, helpers);
  ok((rng.draws ?? 0) === before,
    `the drawer spends NO RNG — the two irandom are the sim's, on the stream, parked on `
    + `strikeJitter (draws ${before} -> ${rng.draws ?? 0})`);
  ok(ctx.draws.length === 2 && ctx.draws[0].x === 300 + 0 - 8 && ctx.draws[0].y === 160 + 1 - 8,
    'and it uses that parked pair, not a fresh one');
}

console.log('');
if (failed) {
  console.log(`FAIL  kaizo render depth — ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('PASS  kaizo render depth — 4a the deferred hell surface, 4b the finisher\'s empty pending frames');
