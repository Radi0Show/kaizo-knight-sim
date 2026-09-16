#!/usr/bin/env node
// A HALTED PARTY ACTOR HOLDS FRAME 0 FOR THE WHOLE INTRO.
//
// obj_actor's Step, inside `auto_walk == 1 && walk == 1` — both set by its own
// Create, so the branch always runs for a cutscene actor:
//
//     if (v_speed == 0)
//     {
//         stopped = 1;
//         image_index = 0;
//         image_speed = 0;
//     }
//
// It does not slow down and it does not stop where it happens to be: it SNAPS
// TO FRAME 0. obj_actor's Create opens `image_speed = 0` besides, so there are
// two independent routes to the same value, and obj_ch3_PTB02 sets image_speed
// sixteen times — every one of them on the ROARING KNIGHT or on a marker,
// never on a party actor.
//
// WHY THIS IS A SUITE AND NOT A ONE-LINE FIX LEFT ALONE. It was reported from
// play, and the report pointed at the wrong object:
//
//     "in the intro. the snow at susie's legs keeps appearing and
//      disappearing"                                            — aaser_
//
// The snow was innocent. The intro backdrop is pixel-static — measured, zero
// changed pixels over 60 frames in the band across her legs. What moved was
// SUSIE: the three actors were idling at image_speed 0.2, a 20-frame loop over
// the four frames of spr_susie_idle_serious, and there is a 3-pixel notch
// between her boots that is OPEN on frames 1-3 and SHUT on frame 0. The loop
// cut a hole in her legs and closed it again 1.5 times a second, and what
// showed through the hole was the backdrop. She was blinking; the snow was
// only what the blink revealed.
//
// A sim-state assertion (`sc.actors.susie.index === 0`) would restate
// sim/intro.js. This records what actually reaches the canvas, because the
// frame the PLAYER sees is the claim — the renderer floors and wraps the index
// itself, so a fractional index that never advances and a renderer that floors
// to 0 regardless are different bugs with the same state.
//
// THE KNIGHT IS THE CONTROL. He animates at 0.1 and PTB02 really does set that
// (Step_0:221), so a build that zeroed every speed in the scene — the lazy way
// to pass the first assertion — fails the second.

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);

// Every drawImage of a NAMED, INDEXED sprite frame, in call order. Scratch
// canvases (the backdrop offscreen, the sword cut-out) blit through here too
// and carry no tag; they are skipped rather than guessed at.
let drawn = [];
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
      return (img) => {
        if (img && img.__name !== undefined) {
          drawn.push({ name: img.__name, frame: img.__frame });
        }
      };
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

const { createIntroScene, stepIntroScene } = await import('../sim/intro.js');
const { drawIntroScene } = await import('../render/draw/intro-fx.js');
const { createRenderer } = await import('../render/canvas.js');

const failures = [];
const canvas = { width: 640, height: 480, style: {}, getContext: () => mkCtx() };
const renderer = await createRenderer(canvas);

// ONE TAGGED ENTRY PER NAME, and every FRAME tagged with its own index, so the
// recorder can say not just which sprite was drawn but which frame of it. A
// shared stub entry cannot answer the question this suite exists to ask.
const made = new Map();
const realGet = renderer.sprites.get.bind(renderer.sprites);
renderer.sprites.get = (name) => {
  const real = realGet(name);
  if (real) {
    real.frames.forEach((fr, i) => {
      if (fr && fr.__name === undefined) { fr.__name = name; fr.__frame = i; }
    });
    return real;
  }
  if (!made.has(name)) {
    made.set(name, {
      frames: Array.from({ length: 4 }, (_, i) => (
        { width: 32, height: 32, src: 'stub://frame', __name: name, __frame: i }
      )),
      meta: { ox: 16, oy: 16, w: 32, h: 32, frames: 4 },
    });
  }
  return made.get(name);
};

// THE FOUR FRAMES ARE READ OFF THE SHIPPED PACK, not assumed. The harness's
// stub `fetch` only serves font metadata, so the renderer falls back to stub
// sprite entries — fine for a question about draw ORDER and frame INDEX, and
// the pattern every headless suite here uses. But the header's claim is about
// a REAL sprite with REAL frames, so that half is pinned to the manifest on
// disk. If the pack is ever repacked with a different frame count, this is
// where it surfaces instead of the header quietly going stale.
{
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const man = JSON.parse(readFileSync(join(here, '..', 'assets', 'sprites', 'manifest.json'), 'utf8'));
  const e = man.spr_susie_idle_serious;
  if (!e) {
    failures.push('spr_susie_idle_serious is not in assets/sprites/manifest.json — '
      + 'the intro draws Susie with it, so this is a missing-art bug, and the '
      + 'renderer would silently fall back to her collision mask');
  } else {
    const n = e.frames ?? (e.files ?? []).length;
    if (n !== 4) {
      failures.push(`spr_susie_idle_serious has ${n} frame(s), not the 4 this `
        + 'suite’s reasoning is written on — the notch between her boots is '
        + 'open on frames 1-3 and shut on frame 0, and that split is what made '
        + 'the idle loop look like flickering snow');
    }
  }
}

const sc = createIntroScene();
const PARTY = {
  kris: sc.actors.kris.sprite,
  susie: sc.actors.susie.sprite,
  ralsei: sc.actors.ralsei.sprite,
};
const KNIGHT = sc.knight.sprite;

// The whole tableau and the roar — well past the 20-frame idle loop the bug
// rode on, so a 0.2 rate could not hide inside the window.
const FRAMES = 240;
const offFrame0 = { kris: [], susie: [], ralsei: [] };
const seen = { kris: 0, susie: 0, ralsei: 0 };
const knightFrames = new Set();

for (let f = 0; f < FRAMES; f++) {
  drawn = [];
  drawIntroScene(mkCtx(), sc, renderer.sprites);

  for (const [who, spriteName] of Object.entries(PARTY)) {
    for (const d of drawn) {
      if (d.name !== spriteName) continue;
      seen[who] += 1;
      if (d.frame !== 0) offFrame0[who].push({ f, frame: d.frame });
    }
  }
  for (const d of drawn) if (d.name === KNIGHT) knightFrames.add(d.frame);

  stepIntroScene(sc, []);
}

for (const who of Object.keys(PARTY)) {
  if (seen[who] === 0) {
    failures.push(`${who} never reached the canvas — ${PARTY[who]} was not drawn `
      + `on any of ${FRAMES} frames, so nothing here proves anything about him/her`);
  } else if (offFrame0[who].length) {
    const first = offFrame0[who].slice(0, 5)
      .map((o) => `f${o.f}:frame ${o.frame}`).join(', ');
    failures.push(`${who} left frame 0 on ${offFrame0[who].length} of ${seen[who]} `
      + `draw(s) (${first}) — a halted obj_actor snaps to image_index 0 and sets `
      + 'image_speed 0, and for Susie the frames off 0 are the ones that open the '
      + 'notch between her boots and let the backdrop snow through');
  }
}

// THE CONTROL. Without this, `speed: 0` on every object in the scene passes.
if (knightFrames.size < 2) {
  failures.push(`the Knight held a single frame for all ${FRAMES} frames `
    + `(saw ${[...knightFrames].join(', ') || 'nothing'}) — PTB02 sets his `
    + 'image_speed to 0.1 at Step_0:221 and he is the proof that this suite is '
    + 'asserting "the PARTY is still", not "nothing in the intro moves"');
}

if (failures.length) {
  for (const f of failures) console.log(`→ FAILURE  ${f}`);
  process.exit(1);
}
console.log(`the halted party hold frame 0 across all ${FRAMES} intro frames `
  + `(${seen.kris} + ${seen.susie} + ${seen.ralsei} draws), while the Knight `
  + `cycles ${knightFrames.size} frames at his own 0.1`);
