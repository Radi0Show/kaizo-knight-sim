#!/usr/bin/env node
// THE SNOWGRAVE FLAKE HAS A SPRITE — and the drawer that was waiting for it
// now paints one.
//
//   node kaizo/tools/checks/check-snowflake-art.mjs
//
// Ledger G-43 ([3]). `kaizo/render/draw/snowgrave.js` is a complete port of
// the mod's REBUILT snowflake Draw — the `siner != 0` side-copy pair scaled by
// `flakescale`, and the `repeat (2) draw_self()` triple-blit for a flake that
// has gathered — and of obj_spell_snowgrave's two `draw_background_tiled_ext`
// snow sheets. Neither could draw anything: `spr_icespell_snowflake` and
// `bg_snowfall` were in NEITHER sprite pack, so both drawers took their
// `if (!entry) return` and the SnowGrave scene rendered as the white-to-blue
// wash and nothing else. The one scene in the fight where the player is the
// one casting was a blank screen with a gradient on it.
//
// IT WAS A VENDORING GAP, NOT AN ART DELTA. Both sprites are byte-identical
// between the mod's data file and vanilla's — measured, not assumed: they were
// extracted from BOTH (UndertaleModCli + tools/patches/extract_sprite.csx, on
// COPIES of each data file, never the Steam install) and `cmp` says identical,
// which is why `kaizo/tools/pack-kaizo-sprites.mjs` classifies them
// `source: 'vanilla'` and the publish gate does not apply. The vanilla FIGHT
// never casts SnowGrave, so `assets/sprites`'s 254-name pack had filtered them
// out and the kaizo overlay's WANT list had never asked for them.
//
// WHAT THIS PINS:
//   1. both names are in the overlay, vanilla-sourced, at the dump's own
//      dimensions and origins — the publish gate stays honest about them;
//   2. their PNG frames are on disk and are the size the metadata claims;
//   3. the drawers actually reach a blit now, driven through the REAL renderer
//      with the REAL overrides on a live V-D SnowGrave cast.
//
// ── NO RECORDING ─────────────────────────────────────────────────────────
// There is no recording of the Weird Route at all, so nothing here can
// compare against the game. (3) asserts the drawer is REACHED and draws the
// right number of copies for the flake's state; it cannot assert the picture
// is right. A capture of the SnowGrave scene is what would close that, and it
// is the single most valuable recording this lane could be given.
//
// SABOTAGE-TESTED 2026-09-12, both directions: removing either name from the
// overlay manifest reddens L1/L2 and takes L3 with it; making the flake's
// drawer return before `drawSelf()` reddens L3 alone.

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);

const mkCtx = (log = null) => new Proxy({}, {
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
    if (typeof p !== 'string') return undefined;
    return (...args) => { if (log && p === 'drawImage') log.push(args[0]); };
  },
  set(t, p, v) { t[p] = v; return true; },
});
globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    const c = { width: 0, height: 0, style: {} };
    c.getContext = () => mkCtx(null);
    return c;
  },
};
globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;

const { readFileSync, existsSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const { join, dirname } = await import('node:path');

const HERE = dirname(fileURLToPath(import.meta.url));
const PACK = join(HERE, '..', '..', 'assets', 'sprites');
const MAIN_PACK = join(HERE, '..', '..', '..', 'assets', 'sprites');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

/**
 * The two names, with the metadata BOTH data files report for them (identical
 * in the two, which is the measurement that makes this a vendoring gap).
 * Typed out here rather than read from the manifest so the manifest has
 * something to be wrong against.
 */
const WANT = {
  spr_icespell_snowflake: { w: 46, h: 46, ox: 23, oy: 23, frames: 1 },
  bg_snowfall: { w: 64, h: 64, ox: 0, oy: 0, frames: 1 },
};

console.log('L1 — the overlay carries both, as VANILLA art');
const manifest = existsSync(join(PACK, 'manifest.json'))
  ? JSON.parse(readFileSync(join(PACK, 'manifest.json'), 'utf8'))
  : null;
if (!manifest) {
  // A fresh clone has no overlay (CLAUDE.md, "Machine facts"); the sprite
  // check hard-exits for the same reason, so say so and stop rather than
  // reporting a repack as a regression.
  console.log('  -- kaizo/assets/sprites is not built; run pack-kaizo-sprites.mjs. SKIPPED.');
  process.exit(0);
}
const mainManifest = existsSync(join(MAIN_PACK, 'manifest.json'))
  ? JSON.parse(readFileSync(join(MAIN_PACK, 'manifest.json'), 'utf8'))
  : {};
for (const [name, want] of Object.entries(WANT)) {
  const e = manifest[name];
  ok(!!e, `${name} is in the kaizo overlay's manifest`);
  if (!e) continue;
  ok(e.source === 'vanilla' && !e.replaced,
    `  ...as VANILLA art, unreplaced — so the publish gate does not cover it`);
  ok(e.w === want.w && e.h === want.h && e.ox === want.ox && e.oy === want.oy
    && e.frames === want.frames,
    `  ...at ${want.w}x${want.h}, origin (${want.ox},${want.oy}), ${want.frames} frame`);
  ok(!mainManifest[name],
    `  ...and the MAIN pack still does not carry it — the overlay is the only copy, `
    + 'so the vanilla page is untouched');
}

console.log('L2 — the frames are on disk at the size the metadata claims');
for (const [name, want] of Object.entries(WANT)) {
  const file = join(PACK, `${name}_0.png`);
  ok(existsSync(file), `${name}_0.png exists in the overlay`);
  if (!existsSync(file)) continue;
  const b = readFileSync(file);
  // PNG IHDR: width at byte 16, height at 20, both big-endian u32.
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  ok(w === want.w && h === want.h,
    `  ...and the PNG really is ${want.w}x${want.h} (got ${w}x${h}) — extracted WITH padding, `
    + 'so the origin still lands where the physics expects it');
}

console.log('L3 — the drawers are reached on a live V-D SnowGrave cast');
{
  const { createState, stepFrame } = await import('../../../sim/index.js');
  const { buildKaizoScene } = await import('../../scenes/kaizo-fight.js');
  const { createRenderer } = await import('../../../render/canvas.js');
  const { KAIZO_DRAW_OVERRIDES } = await import('../../render/index.js');
  const { castSnowgrave, ensureScenes } = await import('../../party/scenes.js');
  const {
    drawObjSpellSnowgraveSnowflake, drawObjSpellSnowgrave,
  } = await import('../../render/draw/snowgrave.js');

  // The real sprite entries, built from the overlay's own PNG metadata — the
  // renderer cannot decode images in Node, so the entry is synthesised at the
  // DECLARED size rather than faked at 32x32. That matters: the flake's side
  // copies are scaled by `flakescale` off the sprite's own dimensions.
  const entryFor = (name) => {
    const m = manifest[name];
    const img = { width: m.w, height: m.h, src: `pack://${name}` };
    return { frames: [img], meta: { ox: m.ox, oy: m.oy, w: m.w, h: m.h } };
  };
  const flakeEntry = entryFor('spr_icespell_snowflake');
  const snowEntry = entryFor('bg_snowfall');
  const fallbackImg = { width: 32, height: 32, src: 'stub://frame' };
  const fallback = { frames: [fallbackImg], meta: { ox: 16, oy: 16, w: 32, h: 32 } };

  const log = [];
  const canvas = { width: 640, height: 480, style: {}, getContext: () => mkCtx(log) };
  const renderer = await createRenderer(canvas, { overrides: KAIZO_DRAW_OVERRIDES });
  renderer.sprites.get = (name) => {
    if (name === 'spr_icespell_snowflake') return flakeEntry;
    if (name === 'bg_snowfall') return snowEntry;
    return fallback;
  };

  const idle = {
    left: false, right: false, up: false, down: false, focus: false,
    confirm: false, cancel: false, button3: false,
  };
  const st = createState({ seed: 12345, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: 'D' });
  castSnowgrave(st, { caster: 1, magic: 13 });

  let flakeFrames = 0;
  let flakeBlits = 0;
  let snowBlits = 0;
  for (let f = 0; f < 400; f++) {
    ensureScenes(st).sg.target = 0;
    log.length = 0;
    renderer.draw(st);
    flakeBlits += log.filter((i) => i && i.src === 'pack://spr_icespell_snowflake').length;
    snowBlits += log.filter((i) => i && i.src === 'pack://bg_snowfall').length;
    if (st.entities.some((e) => e.alive && e.visible !== false
      && e.type?.name === 'obj_spell_snowgrave_snowflake')) flakeFrames += 1;
    stepFrame(st, idle);
  }
  ok(flakeFrames > 0,
    `the scene really produces VISIBLE snowflakes (${flakeFrames} frames with at least one)`);
  ok(flakeBlits > 0,
    `spr_icespell_snowflake is BLITTED (${flakeBlits} times over 400 frames) — before the `
    + 'pack carried it this number was 0');
  ok(snowBlits > 0,
    `bg_snowfall is blitted too (${snowBlits}) — the two scrolling snow sheets`);

  // ...and the per-flake copy count, which is the mod's own rebuild
  // (Draw_0:1-12) and the whole reason the drawer is a port and not a blit:
  //   siner != 0            -> draw_self + two mirrored side copies  = 3
  //   siner == 0, con >= 1  -> draw_self + repeat (2) draw_self      = 3
  //   siner == 0, con == 0  -> draw_self                             = 1
  const probe = (vars) => {
    const out = [];
    const ctx = mkCtx(out);
    drawObjSpellSnowgraveSnowflake(ctx, {
      x: 100, y: 100, image_index: 0, image_xscale: 2, image_yscale: 2,
      image_alpha: 1, image_angle: 0, flakescale: 1, siner: 0, con: 0, ...vars,
    }, st, { sprites: renderer.sprites });
    return out.length;
  };
  ok(probe({ siner: 10 }) === 3,
    'a RISING flake (siner != 0) draws three copies — itself and the two sin-mirrored ones');
  ok(probe({ siner: 0, con: 2 }) === 3,
    'a GATHERED flake (siner 0, con >= 1) draws three — draw_self plus `repeat (2) draw_self()`');
  ok(probe({ siner: 0, con: 0 }) === 1,
    'and a plain one draws once');

  // The spell's own wash-and-sheets Draw, at a timer where both sheets are up.
  const out = [];
  drawObjSpellSnowgrave(mkCtx(out), { timer: 30, bgalpha: 0.5, snowspeed: 26 }, st,
    { sprites: renderer.sprites, VIEW_W: 640, VIEW_H: 480 });
  ok(out.filter((i) => i && i.src === 'pack://bg_snowfall').length > 0,
    'obj_spell_snowgrave tiles bg_snowfall across the view (two sheets, :125-126)');
}

console.log(failed === 0 ? '\ncheck-snowflake-art: PASS' : `\ncheck-snowflake-art: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
