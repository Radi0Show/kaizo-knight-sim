#!/usr/bin/env node
// RUDE BUSTER IS DRAWN AT SUSIE'S DEPTH, AND NEVER LEAVES A GAP.
//
// obj_rudebuster_anim's Create, verbatim from the dump:
//
//     if (instance_exists(obj_herosusie))
//     {
//         depth = obj_herosusie.depth;
//         with (obj_herosusie)
//         {
//             visible = 0;
//         }
//     }
//
// and its Step restores `visible = 1` in the same breath as `instance_destroy()`.
// Two consequences, and this build broke both at once:
//
//   1. THE CAST IS AT HER LAYER. Ralsei's depth is 160 against her 180, so he
//      paints after her and stands in front of the cast exactly as he stands
//      in front of her. The animation was drawn from render/rudebuster.js
//      instead — a pass that runs after the entity loop, after the charbox
//      row, after the attack vfx — so it went over him and over the UI.
//   2. THERE IS NO FRAME WITHOUT ONE OR THE OTHER. Her actor was hidden by
//      `state.rude.anim`, read in the STEP phase, while the director clears
//      that flag in its endStep — so on the clearing frame the step had
//      already hidden her and the anim was gone before the draw.
//
// Reported from play as one sentence: "using a rude buster makes susie's
// sprite layer goes on top of ralsei then disappears and then comes back".
//
// This drives the REAL renderer against a recording canvas and reads the order
// sprites actually reach drawImage. Asserting on `depth` alone would only
// restate sim/actors.js; the draw order is the thing the player sees.

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);

// Every drawImage of a NAMED sprite frame, in call order, for the frame being
// drawn. Scratch canvases blit through here too and carry no name; they are
// skipped rather than guessed at.
let order = [];
const mkCtx = () => new Proxy({}, {
  get(t, p) {
    if (p === 'canvas') return { width: 640, height: 480 };
    if (p === 'measureText') return () => ({ width: 10 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient') {
      return () => ({ addColorStop: noop });
    }
    if (p === 'createPattern') return () => ({});
    if (p === 'getImageData' || p === 'createImageData') {
      return (a, b, w, h) => {
        const W = (p === 'createImageData' ? a : w) || 1;
        const H = (p === 'createImageData' ? b : h) || 1;
        return { data: new Uint8ClampedArray(W * H * 4), width: W, height: H };
      };
    }
    if (VALUE_PROPS.has(p)) return t[p] ?? '';
    if (p === 'drawImage') {
      return (img) => { if (img && img.__name) order.push(img.__name); };
    }
    return () => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    const c = { width: 0, height: 0, style: {} };
    c.getContext = () => mkCtx();
    return c;
  },
};
globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;
{
  const META = {
    page: { w: 1520, h: 24 },
    glyphs: Array.from({ length: 96 }, (_, i) => ({
      c: 32 + i, x: i * 16, y: 0, w: 12, h: 24, shift: 14, offset: 0,
    })),
  };
  globalThis.fetch = async () => ({ json: async () => META });
  globalThis.Image = class {
    constructor() { this.width = 1520; this.height = 24; }
    set src(v) { this._src = v; queueMicrotask(() => this.onload && this.onload()); }
    get src() { return this._src; }
  };
}

const { createState, stepFrame } = await import('../sim/index.js');
const { buildPracticeScene } = await import('../sim/scenes/practice.js');
const { createRenderer } = await import('../render/canvas.js');
const { castRudeBuster, ANIM_FRAMES } = await import('../sim/rudebuster.js');
const { PARTY_POS } = await import('../sim/damage.js');

const failures = [];
const canvas = { width: 640, height: 480, style: {}, getContext: () => mkCtx() };
const renderer = await createRenderer(canvas);

// ONE TAGGED ENTRY PER NAME, so the recorder can tell the sprites apart. The
// smoke test's single shared entry cannot — every missing sprite is the same
// object there, which is fine for "does it throw" and useless for "in what
// order".
const made = new Map();
const realGet = renderer.sprites.get.bind(renderer.sprites);
renderer.sprites.get = (name) => {
  const real = realGet(name);
  if (real) {
    for (const fr of real.frames) if (fr && !fr.__name) fr.__name = name;
    return real;
  }
  if (!made.has(name)) {
    made.set(name, {
      frames: [{ width: 32, height: 32, src: 'stub://frame', __name: name }],
      meta: { ox: 16, oy: 16, w: 32, h: 32 },
    });
  }
  return made.get(name);
};

const st = createState({ seed: 3 });
buildPracticeScene(st, { seed: 3 });
st.keepAlive = true;
st.spriteFrames = renderer.spriteFrames;
st.spriteRate = renderer.spriteRate;

const idle = {
  left: false, right: false, up: false, down: false,
  focus: false, confirm: false, cancel: false,
};

// Settle into the fight before casting, so the party actors exist and the
// director is running its normal phases.
for (let f = 0; f < 60; f++) stepFrame(st, idle);

const isSusie = (n) => n.startsWith('spr_susieb_') || n === 'spr_susie_rudebuster';
const isRalsei = (n) => n.startsWith('spr_ralsei');
const isKris = (n) => n.startsWith('spr_krisb_');

castRudeBuster(st, PARTY_POS[1].x, PARTY_POS[1].y, 50, 425, 100);

let sawCast = 0;
let sawCastUnderRalsei = 0;
let castAfterKris = 0;
const blankFrames = [];
const overRalsei = [];

for (let f = 0; f < ANIM_FRAMES + 12; f++) {
  order = [];
  renderer.draw(st);

  const cast = order.indexOf('spr_susie_rudebuster');
  const susie = order.findIndex(isSusie);
  const ralsei = order.findIndex(isRalsei);
  const kris = order.findIndex(isKris);

  if (cast >= 0) {
    sawCast += 1;
    // Ralsei is depth 160 to her 180: he must reach the canvas AFTER her.
    if (ralsei >= 0) {
      if (ralsei > cast) sawCastUnderRalsei += 1;
      else overRalsei.push(f);
    }
    // ...and Kris, at 200, before.
    if (kris >= 0 && cast > kris) castAfterKris += 1;
  }

  // The gap. Susie is on screen every frame of a fight — as herself or as the
  // cast standing in for her — and there is no third state.
  if (susie < 0) blankFrames.push(f);

  stepFrame(st, idle);
}

if (sawCast === 0) {
  failures.push('the cast sprite never reached the canvas — spr_susie_rudebuster '
    + 'was not drawn on any of the spell’s frames');
}
if (sawCast > 0 && sawCastUnderRalsei === 0) {
  failures.push('Ralsei was never drawn after the cast, so nothing here proves '
    + 'the layer order (is he on screen at all?)');
}
if (overRalsei.length) {
  failures.push(`the cast was drawn OVER Ralsei on ${overRalsei.length} frame(s) `
    + `(${overRalsei.slice(0, 6).join(', ')}) — obj_rudebuster_anim takes `
    + 'obj_herosusie.depth, which is behind him');
}
if (sawCast > 0 && castAfterKris === 0) {
  failures.push('the cast was never drawn after Kris — at depth 180 against his '
    + '200 it belongs in front of him');
}
if (blankFrames.length) {
  failures.push(`Susie vanished entirely on ${blankFrames.length} frame(s) `
    + `(${blankFrames.slice(0, 6).join(', ')}) — the anim ended before her actor `
    + 'came back. The game restores `visible` in the same statement that '
    + 'destroys the anim; there is no frame between them.');
}

if (failures.length) {
  for (const f of failures) console.log(`→ FAILURE  ${f}`);
  process.exit(1);
}
console.log(`the cast draws at Susie's depth for ${sawCast} frames `
  + `(${sawCastUnderRalsei} of them with Ralsei proven on top), and she is on `
  + 'screen on every frame of the spell');
