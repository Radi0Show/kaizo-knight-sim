#!/usr/bin/env node
// GLOOM IS ON THE SCREEN — the HUD band, the HP-number tint, and the motes.
//
//   node kaizo/tools/checks/check-gloom-hud.mjs
//
// Ledger G-34 ([2] x3) and G-41 ([3]). GLOOM is the Weird Route's whole
// damage-over-time mechanic: it accrues off every hit, it ticks HP away on a
// curve that steepens with its own depth, it prints a call-out at 36, and it
// can walk a character to 0 — and until 2026-09-12 NOTHING about it reached a
// pixel. `kaizoGloomBarSegment` (kaizo/party/gloom.js) was a complete, correct
// translation of the charbox band whose only callers were itself and its own
// check; the HP-number tint and the target picker's band had no translation at
// all; and `kaizoGloomemit` spent the particles' twelve RNG draws and created
// nothing. The player could not see the thing that was killing them.
//
// WHAT CLOSES IT:
//   * a seam — render/menu.js reads `state.partyStatusBar` ({color, values},
//     slot-indexed, inert when absent; knight-sim branch `kaizo-gloom-seams`,
//     v1.0.43) and paints the band on BOTH surfaces it owns: the charbox
//     row's 75px bar (ceil both ends) and the ally target picker's 100px bar
//     (unclamped, as the GML is);
//   * a publisher — `publishGloomHud`, called from the same `kaizoGloomStep`
//     that moves the meter, so the picture and the mechanic are one event;
//   * the motes — `kaizoGloomemit` now spawns the two obj_particle_generic
//     streaks it was already paying for, at the hero, and the generic blit
//     draws them (render/canvas.js's obj_particle_generic row defers to the
//     tail whenever ROARING does not own the frame);
//   * one reader for the segment arithmetic — kaizo/render/draw/roaring.js's
//     finale HP HUD now calls `kaizoGloomBarSegment` instead of carrying a
//     second transcription of the same four lines.
//
// THE GML, all of it:
//   gml_GlobalScript_scr_charbox.gml:725-770       the number and the band
//   gml_Object_obj_battlecontroller_Draw_0.gml:1387-1399   the picker's band
//   gml_GlobalScript_kaizo_settings_init.gml:91-121  gloomcolor + gloomemit
//   gml_Object_obj_heroparent_Create_0.gml:87,124,167,215   myheight
//
// ── THERE IS NO RECORDING OF THE WEIRD ROUTE ──────────────────────────────
// Both whole-fight recordings are A-Side. Every assertion below therefore
// stands over the DUMP, and is written to fail if the code drifts from it:
// the geometry is re-derived here from the GML's own expressions rather than
// from the module's, so a wrong `round`-for-`ceil` in either place shows up as
// a disagreement instead of two copies of one mistake.
//
// SABOTAGE-TESTED 2026-09-12, both directions — see the report in the lane
// summary. L2/L3 go red when the seam's band is removed from render/menu.js;
// L4/L5 go red when the mote spawn is removed from kaizoGloomemit; L6 goes
// red when roaring.js's finale HUD stops calling kaizoGloomBarSegment.

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);

/**
 * A 2d-context stand-in that RECORDS the fills. check-render-smoke-kaizo's
 * proxy throws the arguments away (it compares call NAMES); this one keeps
 * `fillRect(x, y, w, h)` with the `fillStyle` in force and every
 * `fillText`/`drawImage` with its colour, because the whole question here is
 * what colour was painted where.
 *
 * `translate` is tracked because drawMenu applies the intro rise as a
 * translate and the charbox coordinates are relative to it.
 */
/**
 * Every colour ever assigned as a fillStyle on an OFFSCREEN canvas, which is
 * where `tintedGlyph` (render/text.js) bakes a coloured number. The HP digits
 * are sprite glyphs, so "the number is blue" is not a fill on the main
 * context — it is a multiply baked into a cached glyph, and this is the only
 * place it is visible. Never cleared: the glyph cache is module-level and
 * bakes each (glyph, colour) once, so a set that accumulates is the honest
 * probe and a per-test reset would pass once and then lie.
 */
const offscreenFills = new Set();

function mkRecCtx(rec = null) {
  const st = { fillStyle: '', tx: 0, ty: 0, stack: [] };
  return new Proxy({}, {
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
      if (p === 'fillStyle') return st.fillStyle;
      if (VALUE_PROPS.has(p)) return t[p] ?? '';
      if (typeof p !== 'string') return undefined;
      return (...args) => {
        // THE TRANSFORM IS TRACKED, save/restore included. drawMenu lays the
        // charbox out relative to `setTransform(1,0,0,1,0,0)` and then a
        // `translate` for the intro rise, and the renderer wraps the whole
        // frame in a device-pixel scale — so a recorder that only summed
        // translates reported the bar hundreds of pixels to the right and
        // every coordinate assertion here was meaningless.
        if (p === 'save') st.stack.push([st.tx, st.ty]);
        else if (p === 'restore') { const s = st.stack.pop(); if (s) { [st.tx, st.ty] = s; } }
        else if (p === 'translate') { st.tx += args[0]; st.ty += args[1]; }
        else if (p === 'setTransform') { st.tx = args[4] ?? 0; st.ty = args[5] ?? 0; }
        if (rec) {
          if (p === 'fillRect') {
            rec.push({
              op: 'fillRect', style: String(st.fillStyle),
              x: args[0] + st.tx, y: args[1] + st.ty, w: args[2], h: args[3],
            });
          } else if (p === 'drawImage') {
            rec.push({ op: 'drawImage', style: String(st.fillStyle) });
          }
        }
        return undefined;
      };
    },
    set(t, p, v) {
      if (p === 'fillStyle') { st.fillStyle = v; return true; }
      t[p] = v; return true;
    },
  });
}

globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    const c = { width: 0, height: 0, style: {} };
    c.getContext = () => new Proxy({}, {
      get(t, p) {
        if (p === 'canvas') return c;
        if (p === 'measureText') return () => ({ width: 10 });
        if (p === 'getImageData' || p === 'createImageData') {
          return (a, b, w, h) => {
            const W = (p === 'createImageData' ? a : w) || 1;
            const H = (p === 'createImageData' ? b : h) || 1;
            return { data: new Uint8ClampedArray(W * H * 4), width: W, height: H };
          };
        }
        if (p === 'createLinearGradient' || p === 'createRadialGradient') {
          return () => ({ addColorStop: noop });
        }
        if (p === 'createPattern') return () => ({});
        if (VALUE_PROPS.has(p)) return t[p] ?? '';
        if (typeof p !== 'string') return undefined;
        return noop;
      },
      set(t, p, v) {
        if (p === 'fillStyle' && typeof v === 'string') offscreenFills.add(v);
        t[p] = v; return true;
      },
    });
    return c;
  },
};
globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;

const { createState, stepFrame } = await import('../../../sim/index.js');
const { PARTY } = await import('../../../sim/damage.js');
const { gmlCreate } = await import('../../../sim/rng.js');
const { buildKaizoScene } = await import('../../scenes/kaizo-fight.js');
const { createRenderer } = await import('../../../render/canvas.js');
const { KAIZO_DRAW_OVERRIDES } = await import('../../render/index.js');
const {
  kaizoGloomStep, kaizoGloomemit, publishGloomHud, kaizoGloomBarSegment,
  kaizoCharboxGloom, KAIZO_GLOOM_COLOR, GLOOM_BLEND, ensureGloom,
} = await import('../../party/gloom.js');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

const fakeImg = { width: 32, height: 32, src: 'stub://frame' };
const fakeEntry = { frames: [fakeImg, fakeImg], meta: { ox: 16, oy: 16, w: 32, h: 32 } };

async function makeRenderer(rec) {
  const canvas = { width: 640, height: 480, style: {}, getContext: () => mkRecCtx(rec) };
  const renderer = await createRenderer(canvas, { overrides: KAIZO_DRAW_OVERRIDES });
  const realGet = renderer.sprites.get.bind(renderer.sprites);
  renderer.sprites.get = (name) => realGet(name) ?? fakeEntry;
  return renderer;
}

const idle = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

/** A live V-D fight, stepped to `frames`, with the party's HP pinned. */
function weirdRoute(frames = 40, seed = 12345) {
  const st = createState({ seed, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: 'D' });
  for (let f = 0; f < frames; f++) {
    stepFrame(st, idle);
    const maxhp = st.partyMaxhp ?? PARTY.map((p) => p.maxhp);
    for (let i = 0; i < maxhp.length; i++) st.partyHp[i] = maxhp[i];
    st.gameOver = false;
  }
  return st;
}

console.log('L1 — the publisher: state.partyStatusBar, and only on the B-Side');
{
  const st = weirdRoute();
  // Put gloom on BOTH members through the ledger the engine owns, then run
  // the same end-step call the turn loop runs (kaizo-vc-hooks knightEndStep).
  const led = ensureGloom(st);
  led.gloom[0] = 20;
  led.gloom[1] = 7;
  kaizoGloomStep(st, { bullets: false }); // no drain, so the values stand
  const bar = st.partyStatusBar;
  ok(!!bar, 'kaizoGloomStep publishes state.partyStatusBar');
  ok(bar.color === KAIZO_GLOOM_COLOR,
    `the colour is kaizo_gloomcolor() = merge_color(c_blue, #268CAC, 0.5) = ${KAIZO_GLOOM_COLOR}`);
  ok(bar.values[0] === 20 && bar.values[1] === 7,
    'the values are SLOT-indexed and are the meter itself (20 / 7)');
  ok(bar.values.length >= 3 && bar.values[2] === 0,
    'padded to the game\'s three slots — the empty Weird-Route slot reads 0, not undefined');

  // The A-Side must publish NOTHING: the seam is inert and every V-A / V-C
  // pixel is what it was before it existed.
  const a = createState({ seed: 1, traceBulletSlots: 0 });
  buildKaizoScene(a, { version: 'C' });
  a.kaizo.gloom = [30, 0, 0];
  kaizoGloomStep(a, { bullets: true });
  ok(a.partyStatusBar === undefined,
    'an A-SIDE run publishes no skin at all — the seam stays inert (V-C)');
}

console.log('L2 — the charbox row really paints it (real renderer, real menu)');
{
  const rec = [];
  const renderer = await makeRenderer(rec);
  const st = weirdRoute();
  const maxhp = st.partyMaxhp;
  // Kris: 90 HP of 160 with 40 gloom. Noelle: no gloom, so her panel is the
  // control — if the band leaked to every panel this is what catches it.
  st.partyHp[0] = 90;
  const led = ensureGloom(st);
  led.gloom[0] = 40;
  led.gloom[1] = 0;
  publishGloomHud(st);
  // Past the 12-frame intro rise, so the panel translate is zero and the
  // recorded coordinates are the charbox's own.
  st.frame = 40;
  rec.length = 0;
  const tintedBefore = offscreenFills.has(KAIZO_GLOOM_COLOR);
  renderer.draw(st);

  // scr_charbox:757-769, re-derived HERE from the GML rather than from the
  // module, so the two have to agree:
  //     __LX = ceil(((hp - gloom) / maxhp) * 75)
  //     __RX = ceil((hp / maxhp) * 75)
  const lx = Math.ceil(((90 - 40) / maxhp[0]) * 75);
  const rx = Math.ceil((90 / maxhp[0]) * 75);
  // chunk for a TWO-member party is 108 (scr_charbox:37-44), + 128 for the bar.
  const barX = 108 + 128 + lx;
  const band = rec.filter((r) => r.op === 'fillRect'
    && r.style === KAIZO_GLOOM_COLOR
    && Math.abs(r.h - 8) < 1e-9);
  ok(band.length === 1,
    `exactly one gloom band is painted on the charbox row (found ${band.length})`);
  const b0 = band[0] ?? {};
  ok(b0.x === barX,
    `its left edge is x + 128 + ceil(((hp-gloom)/maxhp)*75) = ${barX} (got ${b0.x})`);
  ok(b0.w === rx - lx,
    `its width is ceil(hp/maxhp*75) - ceil((hp-gloom)/maxhp*75) = ${rx - lx} (got ${b0.w})`);
  ok(lx > 0 && rx > lx,
    'and the derivation is not vacuous: the band is a real sub-range of the fill');

  // The band must lie INSIDE the coloured fill it annotates, never past it.
  const fill = rec.find((r) => r.op === 'fillRect' && r.x === 108 + 128
    && Math.abs(r.h - 8) < 1e-9 && r.w === rx);
  ok(!!fill, 'the charbox fill itself is still drawn, at ceil(hp/maxhp*75)');
  ok(b0.x + b0.w === 108 + 128 + rx,
    'the band ENDS where the fill ends — it is the tail of the bar, not a bar of its own');

  // And the tint on the CURRENT number (scr_charbox:735-746). The digits are
  // sprite glyphs, so the colour reaches them as a multiply baked on an
  // offscreen canvas by render/text.js's tintedGlyph — see `offscreenFills`.
  ok(!tintedBefore && offscreenFills.has(KAIZO_GLOOM_COLOR),
    'the current HP number is baked in the gloom colour — and was not, before this frame');
}

console.log('L3 — the target picker paints it too, and UNCLAMPED');
{
  const rec = [];
  const renderer = await makeRenderer(rec);
  const st = weirdRoute();
  // gloom DEEPER than hp: obj_battlecontroller's band has no clamp, so the
  // left edge falls outside the 100px trough. Faithful, and the ledger says
  // so explicitly — a renderer that clamped it would be correcting the mod.
  st.partyHp[0] = 10;
  const led = ensureGloom(st);
  led.gloom[0] = 60;
  publishGloomHud(st);
  st.frame = 40;
  st.menu.open = true;
  st.menu.submenu = 'target';
  st.menu.targetIndex = 0;
  st.menu.bmenuno = 7;
  rec.length = 0;
  renderer.draw(st);

  const maxhp = st.partyMaxhp[0];
  const lx = 400 + ((10 - 60) / maxhp) * 100;
  const rx = 400 + (10 / maxhp) * 100;
  const band = rec.filter((r) => r.op === 'fillRect'
    && r.style === KAIZO_GLOOM_COLOR && Math.abs(r.h - 16) < 1e-9);
  const hit = band.find((r) => Math.abs(r.x - lx) < 1e-9 && Math.abs(r.w - (rx - lx)) < 1e-9);
  ok(!!hit,
    `the picker's band runs ${lx.toFixed(2)}..${rx.toFixed(2)} over the 100px trough`);
  ok(!!hit && hit.x < 400,
    `and the PAINTED left edge is OUTSIDE the trough (${hit ? hit.x.toFixed(2) : 'n/a'} < 400) — `
    + 'unclamped, obj_battlecontroller Draw_0:1391-1398');
  // The trough itself starts at 400, so this is only meaningful because the
  // band really was drawn to the left of it.
  ok(rec.some((r) => r.op === 'fillRect' && r.x === 400 && r.w === 101 && r.h === 16),
    'the maroon trough it overflows is drawn at 400, 101 wide');
}

console.log('L4 — the motes cost the stream exactly what they always did');
{
  // The correction to HERO_MYHEIGHT (42/50/42/44 -> the dump's 74/82/86/86)
  // and the mote creation must BOTH be free: random_range is one u32 whatever
  // its bounds, and a spawn draws nothing. If either were not, the A-Side
  // byte gate would move on the next Weird-Route change and nobody would know
  // which one did it.
  const bare = { gmlRng: gmlCreate(777), kaizo: { sideb: true, roster: null } };
  const drawsBare = kaizoGloomemit(bare, 0);
  ok(drawsBare === 12,
    `a non-Susie emit is 12 draws (2 x [xx, yy, choose, irandom x2, vspeed]) — got ${drawsBare}`);
  const susie = {
    gmlRng: gmlCreate(777),
    kaizo: { sideb: true, roster: [{ charId: 2, pos: { x: 0, y: 0 }, depth: 0 }] },
  };
  ok(kaizoGloomemit(susie, 0) === 14,
    'SUSIE is 14 — her widened x-spread computes _xx twice and throws the first away');

  // Same seed, one state with entities and one without: the RNG must land in
  // the same place, or the motes are paid for twice.
  const withEnt = createState({ seed: 777, traceBulletSlots: 0 });
  buildKaizoScene(withEnt, { version: 'D' });
  withEnt.gmlRng = gmlCreate(777);
  const n0 = withEnt.entities.length;
  const drawsLive = kaizoGloomemit(withEnt, 0);
  ok(drawsLive === drawsBare,
    `spawning the motes draws nothing extra (${drawsLive} vs ${drawsBare})`);
  ok(withEnt.gmlRng.draws === bare.gmlRng.draws,
    'and the stream is in the same position afterwards');
  ok(withEnt.entities.length > n0,
    `...while the live state actually GAINED entities (${withEnt.entities.length - n0})`);
}

console.log('L5 — what a mote is');
{
  const st = createState({ seed: 4242, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: 'D' });
  const before = st.entities.filter((e) => e.alive && e.type?.name === 'obj_particle_generic');
  kaizoGloomemit(st, 0);
  const motes = st.entities.filter((e) => e.alive && e.type?.name === 'obj_particle_generic'
    && !before.includes(e));
  ok(motes.length === 2, `repeat (2) — two obj_particle_generic per emit (got ${motes.length})`);
  const hero = st.kaizo.roster[0];
  // TWO ASSERTIONS, AND THE SECOND IS THE ONE THAT CAN FAIL.
  //
  // The identity test below proves the mote carries THE module's constant and
  // not a copy — worth having, because `image_blend` is an array and a
  // per-mote clone would drift. But on its own it CERTIFIES ITSELF: it
  // compares an imported constant against the value that constant produced, so
  // `GLOOM_BLEND = [99, 99, 99]` passed it. Verified by doing exactly that.
  //
  // So the channels are asserted as LITERALS, derived from the measured model
  // rather than from the module: `merge_color(c_blue, #268CAC, 0.5)` is
  // `round_half_to_even(f32(f32(c1 * f32(1 - f32(a))) + f32(c2 * f32(a))))`
  // per channel (ORACLE-GROUND-TRUTH.md, gap G9 — 4,969 rows, zero misses), so
  // (0,0,255) and (38,140,172) at 0.5 give 19, 70 and 213.5 -> **214**, the
  // even neighbour. This is the assertion that would have caught the
  // truncated 213 the module carried until 2026-09-16.
  ok(motes.every((m) => m.image_blend === GLOOM_BLEND),
    'each carries THE module constant, not a per-mote copy');
  ok(GLOOM_BLEND[0] === 19 && GLOOM_BLEND[1] === 70 && GLOOM_BLEND[2] === 214,
    'kaizo_gloomcolor() is merge_color(c_blue, #268CAC, 0.5) = 19/70/214 — '
    + `half-to-even on the .5 blue channel (got ${GLOOM_BLEND.join('/')})`);
  ok(motes.every((m) => m.sprite_index === 'spr_whitepx' && m.image_xscale === 2),
    'sprite_index = spr_whitepx at image_xscale 2');
  ok(motes.every((m) => m.image_yscale >= 8 && m.image_yscale <= 12
    && m.image_yscale % 2 === 0),
    'image_yscale = 2 * irandom_range(4, 6), i.e. 8 / 10 / 12');
  ok(motes.every((m) => m.vspeed >= 4 && m.vspeed <= 6 && m.componentMotion === true),
    'vspeed is random_range(4, 6) and the entity is actually moved by it');
  ok(motes.every((m) => Math.abs(m.depth - hero.depth) === 1),
    'depth = choose(other.depth - 1, other.depth + 1) — one step off the HERO, both signs used over time');
  ok(motes.every((m) => m.timer === 5), 'timer = 5');
  ok(motes.every((m) => m.x >= hero.pos.x && m.x <= hero.pos.x + 56),
    'x = hero.x + random_range(0, 28) * 2');
  // myheight 74 for Kris: the y spread is 0..60, which is the whole character.
  // The old 42 would have capped it at 28 — half a Kris.
  ok(motes.every((m) => m.y >= hero.pos.y && m.y <= hero.pos.y + 60),
    'y = hero.y + random_range(0, myheight - 14), myheight 74 (obj_heroparent Create_0:87)');
  const lerps = st.entities.filter((e) => e.alive && e.type?.name === 'obj_lerpvar'
    && motes.includes(e.target) && e.varname === 'image_alpha');
  ok(lerps.length === 2 && lerps.every((l) => l.maxtime === 5),
    'each mote carries scr_lerpvar("image_alpha", 1, 0, 5)');

  // ROARING suppresses the whole emit — `if (i_ex(obj_knight_roaring2)) exit;`
  const st2 = createState({ seed: 4242, traceBulletSlots: 0 });
  buildKaizoScene(st2, { version: 'D' });
  st2.roaringActive = true;
  const n2 = st2.entities.length;
  ok(kaizoGloomemit(st2, 0) === 0 && st2.entities.length === n2,
    'while ROARING is on screen the emit is a no-op — no draws, no motes');
}

console.log('L6 — kaizoGloomBarSegment has a caller that is not a test');
{
  // The ledger's UNWIRED row. The finale's own HP HUD (Other_22:59-77) draws
  // the same band over the same 75px fill as scr_charbox, so it is the
  // natural second reader — and having ONE arithmetic means a `ceil` cannot
  // become a `round` on one surface only.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../render/draw/roaring.js', import.meta.url), 'utf8');
  // A CALL, not a mention: an import left behind after the call was ripped
  // out would satisfy a bare name match and the row would stay green while
  // the function went back to having no reader at all.
  ok(/kaizoGloomBarSegment\(state,/.test(src),
    'kaizo/render/draw/roaring.js CALLS kaizoGloomBarSegment(state, ...)');
  ok(!/const lx = Math\.ceil\(\(\(lv \/ maxhp\)/.test(src),
    'and no longer carries its own transcription of the same four lines');

  const st = weirdRoute();
  st.partyHp[0] = 90;
  ensureGloom(st).gloom[0] = 40;
  const seg = kaizoGloomBarSegment(st, 1, st.partyMaxhp[0]);
  ok(seg !== null && seg.lx === Math.ceil(((90 - 40) / st.partyMaxhp[0]) * 75)
    && seg.rx === Math.ceil((90 / st.partyMaxhp[0]) * 75),
    'and it returns the GML\'s own __LX / __RX for Kris at 90/160 with 40 gloom');
  ok(kaizoGloomBarSegment(st, 4, st.partyMaxhp[1]) === null,
    'null for a member with no gloom — the mod\'s `if (k_gloom[c + 1] > 0)` guard');
  ok(kaizoCharboxGloom(st, 1) === 40 && kaizoCharboxGloom(st, 2) === 0,
    'the charbox read is by CHARACTER id: Kris 40, an absent Susie 0');
}

console.log('L7 — the A-Side picture is untouched');
{
  // The seam's whole claim. Two V-C frames, one with the field force-cleared
  // and one as the lane leaves it, must issue identical fills.
  const recA = [];
  const rA = await makeRenderer(recA);
  const a = createState({ seed: 9, traceBulletSlots: 0 });
  buildKaizoScene(a, { version: 'C' });
  for (let f = 0; f < 20; f++) stepFrame(a, idle);
  a.frame = 40;
  recA.length = 0;
  rA.draw(a);

  const recB = [];
  const rB = await makeRenderer(recB);
  const b = createState({ seed: 9, traceBulletSlots: 0 });
  buildKaizoScene(b, { version: 'C' });
  for (let f = 0; f < 20; f++) stepFrame(b, idle);
  b.frame = 40;
  b.partyStatusBar = undefined;
  recB.length = 0;
  rB.draw(b);

  const key = (r) => `${r.op}|${r.style}|${r.x}|${r.y}|${r.w}|${r.h}`;
  ok(recA.length === recB.length && recA.every((r, i) => key(r) === key(recB[i])),
    `a V-C frame draws the same ${recA.length} operations with and without the field`);
  ok(!recA.some((r) => r.style === KAIZO_GLOOM_COLOR),
    'and no gloom colour is painted anywhere on an A-Side frame');
}

console.log(failed === 0 ? '\ncheck-gloom-hud: PASS' : `\ncheck-gloom-hud: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
