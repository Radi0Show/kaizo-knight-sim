#!/usr/bin/env node
// THE BOTTOM BAND'S SEAMS ARE `bcolor`, AND `bcolor` IS NOT c_navy.
//
// TWO OBJECTS IN THIS FIGHT DEFINE A VARIABLE CALLED `bcolor`:
//
//     obj_attackpress       Create:65        bcolor = c_navy;
//     obj_battlecontroller  Create:144-145   bcolor = merge_color(c_purple, c_black, 0.7);
//                                            bcolor = merge_color(bcolor, c_dkgray, 0.5);
//
// render/menu.js is the CONTROLLER's band and had the attack bar's value, so
// the two hairlines bracketing the button row — and the idle panels' own top
// edges, which scr_charbox:657-668 also draws in `bcolor` — came out bright
// navy and grey against black. Reported from play in three words: "also blue
// line".
//
// The right answer is arithmetic, not taste. c_purple is RGB(128, 0, 128);
// 0.7 toward c_black is (38, 0, 38); 0.5 toward c_dkgray (64, 64, 64) is
// (51, 32, 51). reference/flipped_oracle_shot_60.png — the real game at this
// exact moment — has 51,32,51 on rows 325-326 and 362-363-364 and nothing
// else, which is both halves at once.
//
// THE HEIGHTS ARE PART OF THE SAME BUG. `draw_rectangle` is INCLUSIVE of both
// corners, so
//
//     draw_rectangle(xx - 10, 480 - bp - 3, xx + 700, 480 - bp - 2, false)
//     draw_rectangle(xx - 10, (480 - bp) + 34, xx + 700, (480 - bp) + 36, false)
//
// are TWO rows and THREE rows, not one and two. Each was one short.
//
// This records the renderer's real fillRect calls. A source scan for the
// constant would only read back the comment above it.

const noop = () => {};
const VALUE_PROPS = new Set(['strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);

let rects = [];
const mkCtx = () => {
  const store = { fillStyle: '' };
  return new Proxy(store, {
    get(t, p) {
      if (p === 'canvas') return { width: 640, height: 480 };
      if (p === 'fillStyle') return t.fillStyle;
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
      if (p === 'fillRect') {
        return (x, y, w, h) => rects.push({ x, y, w, h, color: t.fillStyle });
      }
      if (VALUE_PROPS.has(p)) return t[p] ?? '';
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
};
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

const failures = [];
const canvas = { width: 640, height: 480, style: {}, getContext: () => mkCtx() };
const renderer = await createRenderer(canvas);
const fakeImg = { width: 32, height: 32, src: 'stub://frame' };
const fakeEntry = { frames: [fakeImg], meta: { ox: 16, oy: 16, w: 32, h: 32 } };
const realGet = renderer.sprites.get.bind(renderer.sprites);
renderer.sprites.get = (name) => realGet(name) ?? fakeEntry;

const st = createState({ seed: 3 });
buildPracticeScene(st, { seed: 3 });
st.keepAlive = true;
const idle = {
  left: false, right: false, up: false, down: false,
  focus: false, confirm: false, cancel: false,
};

// The moment the report is about — "* The Roaring Knight appeared.", the panel
// row up, no menu open. reference/flipped_oracle_shot_60.png is this frame.
for (let f = 0; f < 60; f++) stepFrame(st, idle);
rects = [];
renderer.draw(st);

// `merge_color(merge_color(c_purple, c_black, 0.7), c_dkgray, 0.5)`, done the
// way GameMaker does it — per channel, linear, no rounding until the end.
const merge = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const C_PURPLE = [128, 0, 128];
const C_BLACK = [0, 0, 0];
const C_DKGRAY = [64, 64, 64];
const BCOLOR = merge(merge(C_PURPLE, C_BLACK, 0.7), C_DKGRAY, 0.5);
const WANT = `rgb(${BCOLOR.join(',')})`;

if (WANT !== 'rgb(51,32,51)') {
  failures.push(`the merge arithmetic no longer lands on the colour the real `
    + `game shows: ${WANT}, and flipped_oracle_shot_60.png has rgb(51,32,51)`);
}

// `bp = 152`, so the band's top edge is 480 - 152 = 328.
const TOP = 328;
const band = (y, h) => rects.find((r) => r.y === y && r.h === h && r.w >= 700);

const upper = band(TOP - 3, 2);
const lower = band(TOP + 34, 3);

if (!upper) {
  const near = rects.filter((r) => r.w >= 700 && Math.abs(r.y - (TOP - 3)) <= 2);
  failures.push('the upper seam is not a 2-row full-width bar at y 325 — '
    + `draw_rectangle(.., 480 - bp - 3, .., 480 - bp - 2) covers BOTH rows. `
    + `Found: ${JSON.stringify(near)}`);
} else if (upper.color !== WANT) {
  failures.push(`the upper seam is ${upper.color}, not ${WANT} — that is `
    + 'obj_attackpress’s bcolor, not the battle controller’s');
}

if (!lower) {
  const near = rects.filter((r) => r.w >= 700 && Math.abs(r.y - (TOP + 34)) <= 2);
  failures.push('the lower seam is not a 3-row full-width bar at y 362 — '
    + `draw_rectangle(.., +34, .., +36) covers 362, 363 AND 364. `
    + `Found: ${JSON.stringify(near)}`);
} else if (lower.color !== WANT) {
  failures.push(`the lower seam is ${lower.color}, not ${WANT} — this is the `
    + 'line the report called blue');
}

// THE IDLE PANELS' TOP EDGES TAKE THE SAME COLOUR (scr_charbox:657-668), which
// is what makes the row read as one seam rather than a second, brighter line.
// The panels are 212 wide at 0 / 213 / 426; with no menu open every one of
// them is idle.
const PANEL_W = 212;
const CHUNK = [0, 213, 426];
const edges = rects.filter((r) => r.w === PANEL_W && r.y <= TOP - 3 && r.h >= 1);
// The character whose turn it is gets `charcolor`; the rest get bcolor. The
// menu IS open on this frame — Kris's panel is raised and cyan in the
// reference shot too — so the check has to exclude exactly his and require
// the others, which is also what makes it discriminating: a build that
// painted EVERY panel bcolor would fail the first arm.
const turn = st.menu?.open ? (st.menu.charturn ?? 0) : -1;
const activeX = turn >= 0 ? CHUNK[turn] : null;
const idleEdges = edges.filter((r) => r.x !== activeX);
const activeEdges = edges.filter((r) => r.x === activeX);

if (idleEdges.length < 2) {
  failures.push(`expected a top edge on each idle charbox panel; found `
    + `${idleEdges.length} of ${edges.length} (active panel at x ${activeX})`);
} else {
  const wrong = idleEdges.filter((r) => r.color !== WANT);
  if (wrong.length) {
    failures.push(`${wrong.length} idle charbox panel(s) drew a top edge in `
      + `${wrong[0].color} instead of ${WANT} — scr_charbox's else branch is `
      + '`draw_set_color(bcolor)`, and anything brighter there is a second '
      + 'line across the row');
  }
}
if (turn >= 0 && activeEdges.length && activeEdges.every((r) => r.color === WANT)) {
  failures.push('the ACTIVE panel drew its edge in bcolor too — it takes '
    + '`charcolor`, and a build that painted every panel the band colour '
    + 'would pass the idle check above without this one');
}

if (failures.length) {
  for (const f of failures) console.log(`→ FAILURE  ${f}`);
  process.exit(1);
}
console.log(`the band's seams are ${WANT} (merge_color(c_purple, c_black, 0.7) `
  + `then 0.5 toward c_dkgray) — 2 rows at ${TOP - 3}, 3 at ${TOP + 34}, and `
  + `${idleEdges.length} idle panel edges to match, the active one still `
  + 'on charcolor');
