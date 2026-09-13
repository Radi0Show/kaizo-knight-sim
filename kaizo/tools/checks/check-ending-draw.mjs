#!/usr/bin/env node
// THE B-SIDE EPILOGUE IS PAINTED — the DRAW, asserted, not the existence of a
// consumer.
//
//   node kaizo/tools/checks/check-ending-draw.mjs
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
//
// `kaizo/scenes/kaizo-ending.js` has translated con 50.2 since 2026-09-11 and
// `web/kaizo-epilogue.js` has RUN it on the page since the same day — and
// every visual it produced was recorded on `state.kaizo.ending.marks` /
// `.lerps` and read by NOBODY. A grep for a consumer would have passed: the
// values were all there and all correct. That is this repo's signature defect
// at scene scale, and the same shape as the submenu nothing painted that was
// misread for weeks as "an extra Enter on Rude Buster"
// (check-spellenemy-row.mjs), one layer up.
//
// So this drives the REAL scene through the REAL drawer against a recording
// 2d context and asserts the CALLS: which sprite, at which scale, at which
// angle, in which order, on which frame, in which colour. Every assertion
// below fails if `kaizo/render/draw/ending.js` stops reading the field it is
// about — not merely if the field is wrong.
//
// ── THE HONEST CONSTRAINT, repeated because it bounds every claim ──────────
//
// **THERE IS NO RECORDING OF THE WEIRD ROUTE.** Both whole-fight recordings
// are A-Side; the two locks in knight-research/kaizo-mod/locks are an
// animation lock and the roar finale, neither of which is this scene. So this
// check stands over a GML reading, and it asserts the GML's OWN numbers
// (36 degrees, xscale -2, xscale 999, blend c_black, sub-image 13) rather than
// a picture anyone has seen.
//
// ── THE ASSERTIONS ─────────────────────────────────────────────────────────
//   A  the scene paints at all, every frame, for the whole run
//   B  WHITEALL: white at the open, faded out by the 30-frame lerp, BLACK from
//      sb_con 2 t 23, gone at t 38, black again at t 47 and at sb_con 4 t 220.
//      The last one is the finding this check exists to pin: the blend is
//      sticky and the epilogue ends under BLACK, not white.
//   C  the `spr_fx_hitback` clash pairs are blitted during the clash
//   D  `show_clash_overlay` is a full-screen fill that ramps and dies
//   E  the `spr_rk_quickslash` slash marker is drawn at image_angle 36
//   F  the ouchie writers are drawn after obj_dmgwriter's 2-frame delay and
//      taken away by the kill ramp; con 50.2 produces NO SWOON writer (the two
//      swoon_display calls are the A-SIDE's), and the A-Side's IS painted, as
//      spr_battlemsg sub-image 13
//   G  `spr_roaringknight_faceaway_turning` is drawn at xscale -2
//   H  the 1-in-20 `spr_ralsei_swoon` easter egg is PAINTED on the arm that
//      rolls it, and `spr_ralsei_defeat` on the arm that does not
//   I  obj_afterimage ghosts are painted, and the `with (obj_afterimage)
//      instance_destroy()` at sb_con 2 t 38 really takes them away
//   J  DEPTH: the depth juggling decides paint order (su 6000 first)
//   K  the drawer is reachable from kaizo/render/index.js, and the override
//      registry is UNCHANGED at 28 rows (check-lightorb pins those by position)
//   L  every sprite this drawer asks for is in the real merged pack — a gap
//      neither check-sprites (which scans kaizo/attacks|scenes|party only) nor
//      check-render-manifest-kaizo (registry drawers only) covers for this file
//
// SABOTAGE-TESTED 2026-09-12, both directions — see the lane report for the
// two exit codes.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..', '..');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

// ── the recording context ──────────────────────────────────────────────────
//
// Same shape as check-render-depth-kaizo's recorder: a real transform stack,
// so a translate/scale/rotate around a blit is observable, and every drawImage
// lands with the sprite NAME it came from.

function mkRecorder(log) {
  let m = { x: 0, y: 0, sx: 1, sy: 1, rot: 0, alpha: 1, fill: '' };
  const stack = [];
  const self = {
    __sprite: null,
    canvas: { width: 640, height: 480 },
    get globalAlpha() { return m.alpha; },
    set globalAlpha(v) { m.alpha = v; },
    get fillStyle() { return m.fill; },
    set fillStyle(v) { m.fill = v; },
    strokeStyle: '',
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: false,
    font: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'top',
    save() { stack.push({ ...m }); },
    restore() { if (stack.length) m = stack.pop(); },
    setTransform() { m = { ...m, x: 0, y: 0, sx: 1, sy: 1, rot: 0 }; },
    translate(x, y) { m.x += x * m.sx; m.y += y * m.sy; },
    scale(x, y) { m.sx *= x; m.sy *= y; },
    rotate(r) { m.rot += r; },
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
    rect() {}, ellipse() {}, bezierCurveTo() {}, quadraticCurveTo() {},
    fill() {}, stroke() {}, clip() {}, clearRect() {}, strokeRect() {},
    setLineDash() {}, getLineDash: () => [], transform() {}, resetTransform() {},
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w || 1, height: h || 1 }),
    getImageData: (a, b, w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w || 1, height: h || 1 }),
    putImageData() {},
    fillText() {},
    fillRect(x, y, w, h) {
      log.push({
        op: 'fillRect', x: m.x + x * m.sx, y: m.y + y * m.sy,
        w: w * m.sx, h: h * m.sy, alpha: m.alpha, fill: m.fill,
      });
    },
    drawImage(img, ...rest) {
      const name = img?.__sprite ?? null;
      const sub = img?.__frame ?? null;
      // The offscreen canvases render/draw/gm.js bakes for a tint carry the
      // source sprite's name forward (see the document stub) so a tinted blit
      // is still attributable.
      if (self.__owner) { self.__owner.__sprite = name; self.__owner.__frame = sub; }
      const dx = rest.length >= 8 ? rest[4] : (rest[0] ?? 0);
      const dy = rest.length >= 8 ? rest[5] : (rest[1] ?? 0);
      log.push({
        op: 'blit', sprite: name, sub,
        x: m.x + dx * m.sx, y: m.y + dy * m.sy,
        xs: m.sx, ys: m.sy, rot: m.rot, alpha: m.alpha, fill: m.fill,
      });
    },
  };
  return self;
}

// Offscreen canvases: the tint/fog bakes in render/draw/gm.js. Each carries
// the name of whatever was drawn into it, so `tinted(spr_battlemsg, c_red)`
// is still recognisably spr_battlemsg at the blit site.
globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') return {};
    const c = { width: 0, height: 0, style: {}, __sprite: null, __frame: null };
    const sink = mkRecorder([]);
    sink.__owner = c;
    c.getContext = () => sink;
    return c;
  },
};
globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;

// ── a sprite pack with real-ish rows ───────────────────────────────────────

const SPRITE_META = {
  spr_pixel_white: { w: 4, h: 4, ox: 0, oy: 0, frames: 1 },
  spr_fx_hitback: { w: 113, h: 111, ox: 0, oy: 0, frames: 5 },
  spr_rk_quickslash: { w: 250, h: 48, ox: 125, oy: 27, frames: 4 },
  spr_battlemsg: { w: 83, h: 20, ox: 83, oy: 0, frames: 15 },
  spr_roaringknight_faceaway_turning: { w: 69, h: 82, ox: -19, oy: -4, frames: 10 },
  spr_ralsei_swoon: { w: 77, h: 47, ox: 0, oy: 0, frames: 1 },
  spr_ralsei_defeat: { w: 40, h: 30, ox: 0, oy: 0, frames: 1 },
};
function entryFor(name) {
  const meta = SPRITE_META[name] ?? { w: 32, h: 32, ox: 16, oy: 16, frames: 4 };
  const frames = [];
  for (let i = 0; i < meta.frames; i++) {
    frames.push({ width: meta.w, height: meta.h, __sprite: name, __frame: i });
  }
  return { meta, frames };
}
const cache = new Map();
/** Every name the drawer asked for, so section L can hold it against the pack. */
const asked = new Set();
const sprites = {
  get(name) {
    if (name === undefined || name === null) return undefined;
    asked.add(name);
    if (!cache.has(name)) cache.set(name, entryFor(name));
    return cache.get(name);
  },
  has: () => true,
};

// ── the real modules ───────────────────────────────────────────────────────

// THE PRODUCTION FACTORY, not a re-implementation of it: web/kaizo-epilogue.js
// is DOM-free precisely so a check can run it (its own header says so).
const { createKaizoEpilogue, stepKaizoEpilogue } = await import('../../../web/kaizo-epilogue.js');
const {
  drawKaizoEpilogue, objShakeOffset, epilogueRalseiSprite, KAIZO_DRAW_OBJECTS,
} = await import('../../render/index.js');
const {
  ensureEnding, endingReport, endingAfterimages, SPR, OVERLAY_SCALE,
  SWOON_CHANCE, FLAG_KNIGHT_OUTCOME, FLAG_KNIGHT_VIOLENCED,
  spawnEndingActors, spawnEndingKnight, startEndingScript, stepKaizoEnding,
  NO_FAKEOUT_SCRIPT,
} = await import('../../scenes/kaizo-ending.js');
const { gmlCreate } = await import('../../../sim/rng.js');
const { createState, stepFrame } = await import('../../../sim/index.js');

const IDLE = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

/** A WON Weird Route fight state — exactly what web/kaizo.js hands the factory. */
function wonSideB(seed = 4242) {
  return {
    seed,
    gmlRng: gmlCreate(seed),
    kaizo: {
      sideb: true,
      funni: false,
      flag: { [FLAG_KNIGHT_OUTCOME]: 1, [FLAG_KNIGHT_VIOLENCED]: 1 },
    },
  };
}

/**
 * Run the epilogue and DRAW every frame. Returns one row per driver frame:
 * the report, and the canvas calls the drawer made.
 */
function run(seed = 4242, maxFrames = 2200, tweak = null) {
  const ep = createKaizoEpilogue(wonSideB(seed));
  if (tweak) tweak(ep);
  const trace = [];
  for (let i = 0; i < maxFrames; i++) {
    stepKaizoEpilogue(ep, IDLE);
    const log = [];
    const ctx = mkRecorder(log);
    const report = drawKaizoEpilogue(ctx, ep.st, sprites);
    const r = endingReport(ep.st);
    trace.push({
      t: ep.t, sbCon: r.sbCon, sbTimer: r.sbTimer, report, log,
      ghosts: endingAfterimages(ep.st).length,
    });
    if (ep.done) break;
  }
  return { ep, trace };
}

const blits = (row, name) => row.log.filter((c) => c.op === 'blit' && c.sprite === name);
/** A fill that covers the whole 640x480 view — the whiteall / clash overlay. */
const covers = (c) => c.op === 'fillRect' && c.w >= 640 && c.h >= 480
  && c.x <= 0 && c.y <= 0 && c.alpha > 0.001;
const fullFills = (row) => row.log.filter(covers);
const at = (trace, sbCon, sbTimer) => trace.find((r) => r.sbCon === sbCon && r.sbTimer === sbTimer);

// ═══ THE RUN ═══════════════════════════════════════════════════════════════

const { ep, trace } = run();
const last = trace[trace.length - 1];
ok(ep.done, `the epilogue reached its terminal state (driver frame ${last.t})`);
ok(last.sbCon === 99, `A ...parked at sb_con 99 (${last.sbCon})`);
const visited = [...new Set(trace.map((r) => r.sbCon))];
ok(JSON.stringify(visited) === JSON.stringify([0, 1, 2, 3, 4, 99]),
  `A the ladder walked [0,1,2,3,4,99] (${JSON.stringify(visited)})`);

// ── A: it paints, on every frame ──────────────────────────────────────────
{
  const silent = trace.filter((r) => r.log.length === 0);
  ok(silent.length === 0,
    `A every one of the ${trace.length} frames issued canvas calls`
    + `${silent.length ? ` — ${silent.length} silent, first at t ${silent[0].t}` : ''}`);
  const total = trace.reduce((n, r) => n + r.log.length, 0);
  ok(total > 5000, `A ...${total} calls over the whole scene`);
  const drewActors = trace.filter((r) => r.report.actors >= 3);
  ok(drewActors.length > trace.length * 0.5,
    `A the four actors are painted for most of it (${drewActors.length}/${trace.length} frames with 3+)`);
}

// ── B: WHITEALL, the sticky blend, and the BLACK ending ───────────────────
{
  const white = (r) => fullFills(r).some((c) => /255,\s*255,\s*255/.test(c.fill));
  const black = (r) => fullFills(r).some((c) => /rgb\(0,\s*0,\s*0\)/.test(c.fill) && c.alpha > 0.5);

  ok(white(trace[0]),
    'B the scene OPENS under the white whiteall (con 8 `if (defeated) visible = 1`)');
  // `c_var_lerp_to_instance(whiteall, "image_alpha", 0, 30)` — gone by the
  // time the setup script's waits have run it out.
  const faded = trace.slice(75, 130).every((r) => !white(r));
  ok(faded, 'B ...and the 30-frame alpha lerp takes it away (Step_0:1202)');

  const t23 = at(trace, 2, 23);
  ok(!!t23 && black(t23), 'B sb_con 2 t 23 fills the screen BLACK (image_blend = c_black)');
  const t38 = at(trace, 2, 38);
  ok(!!t38 && !black(t38), 'B ...and t 38 takes it away');
  const t47 = at(trace, 3, 47);
  ok(!!t47 && black(t47), 'B sb_con 3 t 47 is BLACK, not white — the blend is sticky');
  const t220 = at(trace, 4, 220);
  ok(!!t220 && black(t220),
    'B THE SCENE ENDS UNDER BLACK: sb_con 4 t 220 fills black, and nothing in '
    + 'con 50.2 ever sets image_blend back to c_white');
  const t221 = at(trace, 4, 300);
  ok(!!t221 && black(t221), 'B ...and it is still black at t 300, under board_ocean');
  ok(!white(last), 'B the LAST frame of the scene is not white');
}

// ── C: the clash pairs ────────────────────────────────────────────────────
{
  const clash = trace.filter((r) => r.sbCon === 1);
  const withHitback = clash.filter((r) => blits(r, SPR.fxHitback).length > 0);
  ok(withHitback.length > 0,
    `C spr_fx_hitback is painted during the clash (${withHitback.length} frames)`);
  const pair = withHitback.find((r) => blits(r, SPR.fxHitback).length >= 2);
  ok(!!pair, 'C ...and the pulse really is a PAIR of markers (2+ in one frame)');
  // scr_dark_marker's own image_xscale = 2, and the pulse's second copy is at
  // image_alpha 0.5 lerping to 0.
  const scales = blits(pair ?? withHitback[0], SPR.fxHitback).map((c) => Math.abs(c.xs));
  ok(scales.every((s) => Math.abs(s - 2) < 0.001),
    `C ...at scr_dark_marker's scale 2 (${JSON.stringify(scales)})`);
  const alphas = clash.flatMap((r) => blits(r, SPR.fxHitback).map((c) => c.alpha));
  ok(alphas.some((a) => a > 0.9) && alphas.some((a) => a <= 0.55),
    'C ...and the second copy is the 0.5-alpha one (both alphas observed)');
}

// ── D: show_clash_overlay ─────────────────────────────────────────────────
{
  // The flash is a full-screen WHITE fill whose alpha ramps 0 -> peak and back
  // down, and which is doomed at 2*frames + 2. Distinguished from whiteall by
  // its alpha never sitting at exactly 1 for long and by dying.
  const clash = trace.filter((r) => r.sbCon === 1);
  const overlayFrames = clash.filter((r) => r.report.overlays > 0);
  ok(overlayFrames.length > 0,
    `D show_clash_overlay reaches the screen as a full-screen marker (${overlayFrames.length} frames)`);
  const peak = Math.max(...overlayFrames.map((r) => Math.max(0,
    ...fullFills(r).map((c) => c.alpha))));
  ok(peak > 0.2, `D ...and it actually ramps (peak alpha ${peak.toFixed(3)})`);
  const after = clash.filter((r) => r.report.overlays === 0);
  ok(after.length > 0, 'D ...and scr_doom takes every one of them away again');
}

// ── E: the 36-degree slash marker ─────────────────────────────────────────
{
  const slashRows = trace.filter((r) => blits(r, SPR.rkQuickslash).length > 0);
  ok(slashRows.length > 0,
    `E spr_rk_quickslash is painted (${slashRows.length} frames)`);
  // drawSpriteExt rotates by (-angle * PI / 180); image_angle 36 (Step_0:1361).
  const want = (-36 * Math.PI) / 180;
  const got = slashRows[0] ? blits(slashRows[0], SPR.rkQuickslash)[0].rot : NaN;
  ok(Math.abs(got - want) < 1e-9,
    `E ...at image_angle 36 (rotate ${got.toFixed(6)} vs ${want.toFixed(6)})`);
  // sb_con 3 t 47 re-points it at Ralsei with image_angle = 0.
  const straight = slashRows.find((r) => r.sbCon === 3
    && blits(r, SPR.rkQuickslash).some((c) => Math.abs(c.rot) < 1e-9));
  ok(!!straight, 'E ...and sb_con 3 re-points it at angle 0 over Ralsei');
}

// ── F: the ouchie and SWOON writers ───────────────────────────────────────
{
  const ouchieAt = at(trace, 2, 41);
  ok(!!ouchieAt && ouchieAt.report.writerRecords >= 1,
    'F the ouchie writer EXISTS the frame ouchie_display fires (sb_con 2 t 41)');
  ok(!!ouchieAt && ouchieAt.report.writers === 0,
    'F ...and is NOT painted yet — obj_dmgwriter has `delay = 2`');
  const painted41 = trace.filter((r) => r.sbCon === 2 && r.sbTimer >= 43 && r.sbTimer <= 60
    && r.report.writers > 0);
  ok(painted41.length > 0,
    `F ...and IS painted once the delay elapses (${painted41.length} frames)`);
  // The writer is drawn a couple of frames later (obj_dmgwriter's `delay = 2`)
  // through the damage sprite font.
  const writing = trace.filter((r) => r.sbCon === 2 && r.sbTimer >= 44 && r.sbTimer <= 70);
  const drew = writing.filter((r) => r.log.some((c) => c.op === 'blit'
    && /numbersfontbig|spr_battlemsg/.test(String(c.sprite))));
  ok(drew.length > 0, `F ...and it is PAINTED after its 2-frame delay (${drew.length} frames)`);
  // SWOON: `swoon_display` is called from the A-SIDE's two scripts
  // (FAKEOUT_SCRIPT / NO_FAKEOUT_SCRIPT end with it) and NOT from con 50.2 —
  // asserted in both directions so "no SWOON here" reads as a fact rather than
  // as a hole in this check.
  ok(last.report.writerRecords === 2,
    `F the B-Side epilogue produces exactly the two OUCHIES and no SWOON `
    + `(${last.report.writerRecords} writers)`);
  ok(trace.every((r) => blits(r, 'spr_battlemsg').length === 0),
    'F ...so spr_battlemsg is never blitted on this route');
  {
    // ...and the A-Side's SWOON writer, driven for real, IS.
    const st = createState({ seed: 7, traceBulletSlots: 0 });
    st.gmlRng = gmlCreate(7);
    st.kaizo = { sideb: false, funni: false };
    ensureEnding(st);
    spawnEndingActors(st);
    spawnEndingKnight(st);
    startEndingScript(st, NO_FAKEOUT_SCRIPT);
    let sawSwoon = false;
    let redFrame13 = false;
    for (let i = 0; i < 400; i++) {
      stepFrame(st, IDLE);
      stepKaizoEnding(st);
      const log = [];
      drawKaizoEpilogue(mkRecorder(log), st, sprites);
      const hits = log.filter((c) => c.op === 'blit' && c.sprite === 'spr_battlemsg');
      if (hits.length) {
        sawSwoon = true;
        // `type == 12 -> message = 10 -> draw_sprite_ext(msg, 13, ..., c_red)`.
        // The tint goes through render/draw/gm.js's bake; the document stub
        // carries the source sprite AND its sub-image through that bake, so
        // both halves of the call are observable here.
        if (hits.some((c) => c.sub === 13)) redFrame13 = true;
      }
    }
    ok(sawSwoon, 'F the A-Side swoon_display writer IS painted (spr_battlemsg)');
    ok(redFrame13, 'F ...as the SWOON graphic, sub-image 13 (type 12 -> message 10)');
  }
  // The kill ramp really removes them: no writer survives to the last frame.
  ok(last.report.writers === 0 && last.report.writerRecords > 0,
    `F ...and the kill ramp (killtimer > 35, kill += 0.08) takes them off screen `
    + `while the records stay (${last.report.writerRecords} records, ${last.report.writers} painted)`);
}

// ── G: the Knight faces away at xscale -2 ─────────────────────────────────
{
  const away = trace.filter((r) => blits(r, SPR.roaringknightFaceawayTurning).length > 0);
  ok(away.length > 0,
    `G spr_roaringknight_faceaway_turning is painted in sb_con 4 (${away.length} frames)`);
  const neg = away.find((r) => blits(r, SPR.roaringknightFaceawayTurning)
    .some((c) => c.xs < 0));
  ok(!!neg, 'G ...MIRRORED, at image_xscale -2 (a negative x scale reached the canvas)');
  const mag = neg ? Math.abs(blits(neg, SPR.roaringknightFaceawayTurning)[0].xs) : 0;
  ok(Math.abs(mag - 2) < 0.001, `G ...and the magnitude is 2 (${mag})`);
  ok(away.every((r) => r.sbCon === 4),
    'G ...and only in sb_con 4, which is the only place the GML assigns it');
}

// ── H: the 1-in-20 spr_ralsei_swoon easter egg, BOTH arms, PAINTED ────────
{
  let hit = null;
  let miss = null;
  for (let seed = 1; seed <= 240 && (!hit || !miss); seed++) {
    const r = run(seed, 1400);
    const rows = r.trace.filter((x) => x.sbCon === 3 && x.sbTimer > 65);
    if (!rows.length) continue;
    const sprite = epilogueRalseiSprite(r.ep.st);
    const painted = rows.some((x) => blits(x, sprite).length > 0);
    if (sprite === SPR.ralseiSwoon && !hit) hit = { seed, painted };
    if (sprite === SPR.ralseiDefeat && !miss) miss = { seed, painted };
  }
  ok(!!hit, `H the 1-in-${SWOON_CHANCE} swoon arm was reached (seed ${hit?.seed})`);
  ok(!!hit && hit.painted, 'H ...and spr_ralsei_swoon is actually PAINTED on it');
  ok(!!miss, `H the ordinary arm was reached too (seed ${miss?.seed})`);
  ok(!!miss && miss.painted, 'H ...and it paints spr_ralsei_defeat instead');
}

// ── I: the afterimages, and the destroy that clears them ──────────────────
{
  const clash = trace.filter((r) => r.sbCon === 1);
  const withGhosts = clash.filter((r) => r.ghosts > 0);
  ok(withGhosts.length > 0,
    `I obj_afterimage ghosts exist during the clash (${withGhosts.length} frames)`);
  const painted = withGhosts.filter((r) => r.report.afterimages > 0);
  ok(painted.length > 0, `I ...and the drawer paints them (${painted.length} frames)`);
  const t38 = at(trace, 2, 38);
  const t39 = at(trace, 2, 39);
  // `with (obj_afterimage) { instance_destroy(); }` — Step_0:1372. The grow
  // copies are a DIFFERENT object and this `with` never reaches one, but none
  // is ever alive this late (fade 0.1 -> ten frames).
  ok(!!t39 && t39.ghosts === 0,
    `I the t-38 destroy really clears them (t38 ${t38?.ghosts}, t39 ${t39?.ghosts})`);
  // ...and the trail comes back once after_active is on again.
  const later = trace.filter((r) => r.sbCon === 2 && r.sbTimer > 10 && r.sbTimer < 38);
  ok(later.some((r) => r.ghosts > 0), 'I ...and the Knight\'s trail re-emits after sb_con 2 t 10');
}

// ── J: the depth juggling decides paint order ─────────────────────────────
{
  // `su_actor.depth = 6000` at susie_knight_slash t 1 — deeper than everything
  // else in the scene, so she paints FIRST while she is mid-jump.
  const jump = trace.find((r) => r.sbCon === 1 && r.sbTimer >= 2 && r.sbTimer <= 8);
  ok(!!jump, 'J found a frame inside the clash jump');
  const susieSprite = SPR.susieClashJump;
  const order = jump ? jump.log.filter((c) => c.op === 'blit').map((c) => c.sprite) : [];
  const iSu = order.indexOf(susieSprite);
  const iKn = order.findIndex((s) => s === SPR.roaringknightIdle
    || s === SPR.roaringKnightSusieClash);
  ok(iSu >= 0, `J Susie's jump pose is painted (${susieSprite})`);
  ok(iSu >= 0 && iKn >= 0 && iSu < iKn,
    `J ...FIRST, because depth 6000 sorts deepest (su at ${iSu}, knight at ${iKn})`);
}

// ── J2: the depth sort is LOAD-BEARING, and this is what proves it ──────
{
  // ASSERTION J ABOVE CANNOT FAIL. It checks that Susie paints before the
  // Knight at the clash jump — and Susie is CREATED before the Knight, so plain
  // creation order satisfies it too. Deleting the depth sort in
  // kaizo/render/draw/ending.js leaves J green while the painted order changes
  // on roughly 983 of the epilogue's 1734 frames.
  //
  // The fix is to assert something a CONSTANT order cannot produce: an
  // INVERSION. The Knight's depth is written relative to Kris twice —
  // `kn.depth = kr.depth + 1` when he reappears behind Kris, then
  // `kn.depth = kr.depth - 1` at t 166 (kaizo/scenes/kaizo-ending.js:2047,
  // :2074). The sort is descending, so deeper paints first: the first write
  // puts the Knight BEFORE Kris and the second puts him AFTER. Creation order
  // is fixed for the whole run and can yield only one of those two, so
  // requiring BOTH is unsatisfiable without the sort.
  const isKris = (n) => typeof n === 'string' && n.startsWith('spr_kris');
  const isKnight = (n) => typeof n === 'string' && n.startsWith('spr_roaringknight');
  let knightFirst = 0;
  let krisFirst = 0;
  for (const r of trace) {
    const order = r.log.filter((c) => c.op === 'blit').map((c) => c.sprite);
    const iKr = order.findIndex(isKris);
    const iKnight = order.findIndex(isKnight);
    if (iKr < 0 || iKnight < 0) continue;
    if (iKnight < iKr) knightFirst += 1;
    else if (iKr < iKnight) krisFirst += 1;
  }
  ok(knightFirst > 0,
    `J2 the Knight paints BEFORE Kris on some frames (depth kr+1) — ${knightFirst}`);
  ok(krisFirst > 0,
    `J2 ...and AFTER him on others (depth kr-1, t 166) — ${krisFirst}`);
  ok(knightFirst > 0 && krisFirst > 0,
    'J2 BOTH orderings occur, which a creation-order sort cannot produce');
}

// ── K: the address, and the registry it deliberately does not join ────────
{
  ok(typeof drawKaizoEpilogue === 'function',
    'K drawKaizoEpilogue is reachable from kaizo/render/index.js');
  ok(typeof objShakeOffset === 'function' && typeof epilogueRalseiSprite === 'function',
    'K ...with the two reads a page or a HUD needs');
  ok(KAIZO_DRAW_OBJECTS.length === 28,
    `K the override registry is unchanged at 28 rows (${KAIZO_DRAW_OBJECTS.length}) — `
    + 'check-lightorb pins those by name AND position');
  ok(!KAIZO_DRAW_OBJECTS.includes('kaizo_ending_actor')
    && !KAIZO_DRAW_OBJECTS.includes('obj_marker'),
    'K ...and the epilogue is a SCENE drawer, not a row in it (see index.js\'s note)');
  // The per-object shake is a real read, not a decoration: a record produces a
  // non-zero offset and a decayed one produces nothing.
  const sc = ensureEnding(ep.st);
  ok(sc.shakes.some((s) => s.objshake),
    `K scr_shakeobj_ext / scr_minishakeobj records exist (${sc.shakes.filter((s) => s.objshake).length})`);
  const rec = sc.shakes.find((s) => s.objshake);
  const live = objShakeOffset(sc, rec.target, rec.frame);
  const dead = objShakeOffset(sc, rec.target, rec.frame + 10000);
  ok(live[0] !== 0 || live[1] !== 0, `K ...and they jitter their target (${JSON.stringify(live)})`);
  ok(dead[0] === 0 && dead[1] === 0, 'K ...and decay to nothing (shakereduct)');
  ok(OVERLAY_SCALE === 999, 'K the full-screen markers are the GML\'s xscale 999');
}

// ── L: every sprite this drawer asks for is really in the pack ────────────
//
// THIS GATE HAS A HOLE AND THIS CLOSES IT FOR THIS FILE. `check-sprites` scans
// kaizo/attacks, kaizo/scenes and kaizo/party — NOT kaizo/render — and
// `check-render-manifest-kaizo` only exercises drawers reachable through
// `KAIZO_DRAW_OVERRIDES`, which this scene drawer deliberately is not. So a
// name typed wrong here would resolve to `undefined`, `drawSpriteExt` would
// return without drawing, and the object would be silently absent — the exact
// failure class check-render-manifest-kaizo exists for, one address over.
{
  const { readFileSync, existsSync } = await import('node:fs');
  const baseP = join(REPO, 'assets', 'sprites', 'manifest.json');
  const kaizoP = join(REPO, 'kaizo', 'assets', 'sprites', 'manifest.json');
  if (!existsSync(kaizoP)) {
    // Same posture as check-sprites and check-render-manifest-kaizo: the
    // overlay is publish-gated (EnderCat8's art), so a fresh clone has none.
    console.log('  --  kaizo overlay absent (publish-gated); L skipped.');
    console.log('  --  Build it with: node kaizo/tools/pack-kaizo-sprites.mjs');
  } else {
    const merged = new Set([
      ...Object.keys(JSON.parse(readFileSync(baseP, 'utf8'))),
      ...Object.keys(JSON.parse(readFileSync(kaizoP, 'utf8'))),
    ]);
    // KNOWN ABSENT, each a fact: the dark-zone textbox art is the A-Side
    // drawer's too (render/draw/victory-scene.js asks for exactly these and
    // degrades the same way), and the damage sprite font is resolved by
    // render/text.js's own FONTS table, not by a manifest row of this name.
    const ALLOWED = new Set([]);
    const missing = [...asked].filter((n) => !merged.has(n) && !ALLOWED.has(n));
    ok(asked.size > 15, `L the drawer asked for ${asked.size} distinct sprite names`);
    ok(missing.length === 0,
      `L every one of them is in the merged pack${missing.length ? ` — MISSING: ${missing.join(', ')}` : ''}`);
  }
}

console.log('');
if (failed) {
  console.log(`FAIL  kaizo ending draw — ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('PASS  kaizo ending draw — the B-Side epilogue is painted, call by call');
