#!/usr/bin/env node
// THE ATTACK COLOURS THAT NEED NO RECORDING — pinned numerically to the GML.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
//     node kaizo/tools/checks/check-colours.mjs      exit 0 / 1
//
// No screenshot of the mod exists on this machine and the recorder logs no
// draw field, so "the wall turns blue" had no check at all: the sim faded
// the wrong channel for a week inside a green suite, and the vortex sword
// wore the wrong art while a check named T6 asserted its blend. These are
// Draw-side facts the byte gate structurally cannot see (no trace column
// carries r/g/b, sprite_index or depth), which is exactly why they get a
// check of their own — every constant below is read off the kaizo dump
// (knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/), cited at its
// assertion, and each block carries a VANILLA CONTROL so that deleting the
// kaizo delta reddens it rather than passing vacuously.
//
//   G1  obj_knight_diamondswordbullet_ext (Tunnel 2's revised blades):
//       Step_0:4-5 fades g AND r at 21.25/frame, b stays 255 — the ramp is
//       (255,255,255) -> (0,0,255) in twelve frames, every frame's value
//       pinned; Step_0:14,23 both ghosts wear c_blue; Draw_0:1
//       make_color_rgb(r,g,b) is what the kaizo drawer tints with, read off
//       the instance, and the drawer's jitter is the sim's own extJitter
//       (the four u32 the draw slot consumes), never a private random.
//   G2  obj_sword_vortex (Starstorm 4 under a cone): Step_0:3-5 c_white +
//       spr_roaringknight_sword_ol_alt + depth cone-1, Step_0:9
//       get_swordcolor() otherwise — and COLLISION CANNOT MOVE: the
//       extracted _alt mask is row-identical to the engine's sword_ol mask,
//       the two sprites' mask sha1 in sprites_kaizo.csv are equal (read from
//       the research repo when present, loud skip otherwise), the graze
//       path's `e.mask` IS the engine's own object, and the swapped sword's
//       contact test agrees with the engine's default test on every cell of
//       a position/angle grid.
//   G3  obj_knight_circle (every rotating-slash aim bloom): Create_0:2-4
//       (0,0,128) and Step_0:9-10 fade g and r — the rim stays navy for all
//       ten frames; the kaizo rotating slash spawns THIS type (Step_0:278).
//   G4  obj_knight_rotating_slash's SPIRAL POSE (RENDER-CRITIC 5b): the two
//       sprite writes the translation dropped —
//       Step_0:298-299 `scr_var_delayed("sprite_index", 3329, 4)` +
//       `scr_var_delayed("image_speed", 1, 4)` on the aim_type-2 arm, and
//       Step_0:618-620 `scr_var("sprite_index", 2128); ("image_index", 0);
//       ("image_speed", 0)` at the end of the spiral. Sprite ids resolved
//       against knight-research/kaizo-mod/sprites/sprites_kaizo.csv (index N
//       is row N + 2): 3329 = spr_roaringknight_flurry, 2128 =
//       spr_roaringknight_attack_ol. Both arms are byte-identical in
//       gml_vanilla_v105 (Step_0:236-238 and :461-463), so the control here
//       is the sim module itself — AND, BECAUSE THAT MEANS THE ENGINE IS OWED
//       THE SAME FIX, the control is written as a TWO-STATE assertion (the
//       engine does nothing yet, or it does exactly what the mod does) rather
//       than as "the engine does not do this". See its own header, at the
//       controls. Its last block reproduces the ONE thing a recording says
//       about this object, and says it at the difficulty the recording ran.
//
// Zero RNG in any of it; the check is deterministic and needs no recording.
//
// The DRAW-SHEET counterpart is check-colours-sheet.mjs (2026-09-10), which
// holds these same objects against the four MODE 1 colour locks frame by
// frame. This file stays the numeric pin: it runs with no recording on the
// machine, and it is the one that reddens when a constant moves.

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox, settleBox } from '../../../sim/battlebox.js';
import { gmlCreate } from '../../../sim/rng.js';
import { WHITE } from '../../../sim/gml.js';
import {
  SPRITE_MASKS, SWORDOL_MASK, HEART_RECT, spriteMaskHit,
} from '../../../sim/masks.js';
import { knightCircle as simKnightCircle } from '../../../sim/fx.js';
import { diamondSwordBullet as simDiamondSwordBullet } from '../../../sim/attacks/sword-tunnel-revised.js';
import { swordVortexManager as simVortexManager } from '../../../sim/attacks/sword-vortex.js';
import { KAIZO_MASK_DATA } from '../../data/masks.js';
import { diamondSwordBullet, C_BLUE } from '../../attacks/sword-tunnel-revised.js';
import {
  swordVortex, swordVortexManager, swordOlAliasHit, SWORD_OL_ALT,
} from '../../attacks/sword-vortex.js';
import { kaizoKnightCircle } from '../../attacks/knight-circle.js';
import { spawnRotatingSlash } from '../../attacks/rotating-slash.js';
import { spawnRotatingSlash as simSpawnRotatingSlash } from '../../../sim/attacks/rotating-slash.js';
import { getSwordcolor } from '../../attacks/kaizo-colors.js';
import { KAIZO_DRAW_OVERRIDES } from '../../render/index.js';
import {
  drawObjKnightDiamondswordbulletExt, diamondswordbulletExtColor,
} from '../../render/draw/stream.js';

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) { pass += 1; console.log(`  ok   ${msg}`); } else { fail += 1; console.log(`  FAIL ${msg}`); }
}
const NONE = {
  left: 0, right: 0, up: 0, down: 0, focus: 0, confirm: 0, cancel: 0, button3: 0,
};
const eq3 = (a, b) => Array.isArray(a) && a.length === 3
  && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const alive = (st, name) => st.entities.filter((e) => e.alive && e.type.name === name);

// ── the GML constants, each with its line ─────────────────────────────────
const SHAKE_RATE = 21.25;          // diamondswordbullet_ext Step_0:4-5 scr_approach(_, 0, 21.25)
const SHAKE_FRAMES = 12;           // 255 / 21.25 = 12 exactly
const BLADE_BORN = [255, 255, 255]; // diamondswordbullet_ext Create_0:12-14
const GHOST_BLUE = [0, 0, 255];    // c_blue, Step_0:14 and :23
const CIRCLE_NAVY = [0, 0, 128];   // obj_knight_circle Create_0:2-4
const CIRCLE_VANILLA = [128, 0, 0]; // vanilla obj_knight_circle Create_0:2-4
const CIRCLE_FADE = 255 / 28;      // Step_0:9-10, fade_time 28 (Create_0:8)
const CIRCLE_LIFE = 10;            // Step_0:3 image_alpha -= 0.1 from 1

// ═══ G1: THE REVISED TUNNEL BLADE TURNS BLUE ═══════════════════════════════
console.log('G1. obj_knight_diamondswordbullet_ext — the shake ramp is (255,255,255) -> (0,0,255)');
function bladeScene(type) {
  const st = createState({ seed: 12345 });
  st.damageEnabled = false;
  st.invTimer = -1;
  st.gmlRng = gmlCreate(12345);
  settleBox(spawn(st, battlebox, { x: 320, y: 170 }));
  st.soul = spawn(st, soul, { x: 100, y: 100 });
  st.soul.mask = HEART_RECT;
  const b = spawn(st, type, { x: 560, y: 170 });
  b.sprite_index = 'spr_knight_diamondbullet_m';
  b.image_angle = 90;
  b.direction = 180;
  b.speed = 0;
  b.active = 1;
  return { st, b };
}
{
  const { st, b } = bladeScene(diamondSwordBullet);
  ok(eq3([b.r, b.g, b.b], BLADE_BORN), 'Create_0:12-14: born r = g = b = 255');
  b.shakeme = true;
  let rampOk = true;
  let firstBad = null;
  for (let k = 1; k <= SHAKE_FRAMES + 2; k++) {
    stepFrame(st, NONE);
    const want = Math.max(0, 255 - SHAKE_RATE * k);
    // scr_approach lands exactly on the target (it clamps), so the value is
    // the closed form up to the twelfth frame and 0 after.
    if (!(Math.abs(b.r - want) < 1e-9 && Math.abs(b.g - want) < 1e-9 && b.b === 255)) {
      rampOk = false;
      firstBad = firstBad ?? `f${k}: r ${b.r} g ${b.g} b ${b.b}, want r = g = ${want}, b = 255`;
    }
  }
  ok(rampOk, `Step_0:4-5: g and r fall by ${SHAKE_RATE} a frame and b holds 255 over `
    + `${SHAKE_FRAMES + 2} frames${firstBad ? ` — ${firstBad}` : ''}`);
  ok(eq3([b.r, b.g, b.b], [0, 0, 255]), `after ${SHAKE_FRAMES} frames the blade is pure blue (0, 0, 255)`);
  ok(b.alive, 'and still alive (the colour is not a life gate)');
}
{
  // VANILLA CONTROL: sim/attacks/sword-tunnel-revised.js fades g and b — the
  // wall goes red. If the kaizo module ever reverts to the copy basis, the
  // block above reddens; this one proves the control is a different ramp.
  const { st, b } = bladeScene(simDiamondSwordBullet);
  b.shakeme = true;
  for (let k = 0; k < SHAKE_FRAMES; k++) stepFrame(st, NONE);
  ok(b.r === 255 && b.b === 0 && b.g === 0,
    `vanilla control: the sim blade ends the same ramp RED (${b.r}, ${b.g}, ${b.b})`);
}
{
  // The ghosts (Step_0:7-25): do_afterimage 1 -> one obj_afterimage_grow in
  // c_blue, then every frame an obj_afterimage (scr_afterimagefast) at
  // fadeSpeed 0.33 in c_blue.
  const { st, b } = bladeScene(diamondSwordBullet);
  b.do_afterimage = 1;
  stepFrame(st, NONE);
  const grows = alive(st, 'obj_afterimage_grow');
  ok(grows.length === 1 && grows[0].image_blend === C_BLUE && eq3(grows[0].image_blend, GHOST_BLUE),
    `Step_0:12-14: the grow ghost is c_blue by the shared reference (${grows.length} ghost, `
    + `${JSON.stringify(grows[0]?.image_blend)})`);
  stepFrame(st, NONE);
  const fast = alive(st, 'obj_afterimage');
  ok(fast.length >= 1 && fast.every((a) => a.image_blend === C_BLUE)
    && fast.every((a) => Math.abs(a.fadeSpeed - 0.33) < 1e-12),
    `Step_0:20-24: the fast ghosts are c_blue at fadeSpeed 0.33 (${fast.length} alive)`);
  ok(Object.isFrozen(C_BLUE) && eq3(C_BLUE, GHOST_BLUE), 'C_BLUE is the frozen c_blue singleton');
  ok(C_BLUE !== getSwordcolor(st),
    'and it is NOT get_swordcolor(): the ghosts are a literal, untouched by the swordtype setting');
}
{
  // Draw_0:1 make_color_rgb(r, g, b) — the drawer reads r, g, b off the
  // instance, truncated to channels (unmeasured trunc-vs-round, ±1; see the
  // helper's doc). Pinned at every frame of the ramp.
  const { st, b } = bladeScene(diamondSwordBullet);
  b.shakeme = true;
  let tintOk = true;
  for (let k = 1; k <= SHAKE_FRAMES; k++) {
    stepFrame(st, NONE);
    const c = diamondswordbulletExtColor(b);
    const want = Math.trunc(Math.max(0, 255 - SHAKE_RATE * k));
    if (!eq3(c, [want, want, 255])) tintOk = false;
  }
  ok(tintOk, 'Draw_0:1: the drawer\'s tint is make_color_rgb(r, g, b) on every shake frame');
  ok(eq3(diamondswordbulletExtColor({ r: 233.75, g: 233.75, b: 255 }), [233, 233, 255]),
    'channels are integer (233.75 -> 233)');
  ok(KAIZO_DRAW_OVERRIDES.obj_knight_diamondswordbullet_ext === drawObjKnightDiamondswordbulletExt,
    'the registry routes obj_knight_diamondswordbullet_ext to the blade drawer');

  // The drawer, driven against a stub canvas: it must draw at x/y + the
  // SIM's extJitter (the draw slot's own irandom_range values), tint with
  // the instance colour, and claim the draw (return true). A stub document
  // stands in for the tint canvas the way the render smoke's does.
  const calls = [];
  const mkCtx = () => new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return { width: 640, height: 480 };
      if (typeof p !== 'string') return undefined;
      if (p in t) return t[p];
      return (...args) => { calls.push([p, args]); };
    },
    set(t, p, v) { t[p] = v; return true; },
  });
  globalThis.document = {
    createElement: (tag) => (tag === 'canvas'
      ? { width: 0, height: 0, style: {}, getContext: () => mkCtx() } : {}),
  };
  const img = { width: 32, height: 32, src: 'stub://blade' };
  const helpers = { sprites: new Map([['spr_knight_diamondbullet_m', { frames: [img], meta: { ox: 16, oy: 16 } }]]) };
  b.extJitter = { x: 1, y: -1 };
  const ctx = mkCtx();
  const claimed = drawObjKnightDiamondswordbulletExt(ctx, b, st, helpers);
  const translate = calls.find(([name]) => name === 'translate');
  const drew = calls.some(([name]) => name === 'drawImage');
  ok(claimed === true && drew, 'the drawer draws the sprite and claims the draw (no draw_self)');
  ok(translate && translate[1][0] === b.x + 1 && translate[1][1] === b.y - 1,
    `Draw_0:2: drawn at x + extJitter.x, y + extJitter.y (${translate?.[1]?.join(', ')})`);
  ok(drawObjKnightDiamondswordbulletExt(ctx, b, st, { sprites: new Map() }) === false,
    'a missing sprite returns falsy so the tail\'s mask fallback still shows the blade');
  delete globalThis.document;
}

// ═══ G2: THE VORTEX SWORD UNDER A CONE ═════════════════════════════════════
console.log('G2. obj_sword_vortex — spr_roaringknight_sword_ol_alt in c_white at cone.depth - 1, mask unmoved');
function vortexScene(managerType, { cone = false } = {}) {
  const st = createState({ seed: 12345 });
  st.damageEnabled = false;
  st.invTimer = -1;
  st.gmlRng = gmlCreate(12345);
  st.turntimer = 300;
  st.kaizo = { sideb: false };
  const gt = spawn(st, { name: 'obj_growtangle' }, { x: 320, y: 170 });
  st.soul = spawn(st, { name: 'obj_heart' }, { x: 314, y: 162 });
  if (cone) spawn(st, { name: 'obj_knight_pointing_cone' }, { x: 100, y: 100 });
  const mg = spawn(st, managerType, { x: gt.x, y: 0 });
  mg.damage = 120;
  return { st, mg };
}
const swordsOf = (st) => alive(st, 'obj_sword_vortex').sort((a, b) => a.seq - b.seq);
{
  const { st } = vortexScene(swordVortexManager, { cone: true });
  for (let f = 0; f < 90; f++) stepFrame(st, NONE);
  const sw = swordsOf(st);
  ok(sw.length === 6, `six vortex swords alive under the cone (${sw.length})`);
  ok(sw.every((s) => s.sprite_index === SWORD_OL_ALT),
    'Step_0:4: every sword wears spr_roaringknight_sword_ol_alt');
  ok(sw.every((s) => s.image_blend === WHITE && eq3(s.image_blend, [255, 255, 255])),
    'Step_0:3: every sword is c_white (untinted: the _alt art is pre-painted)');
  ok(sw.every((s) => s.depth === -1),
    `Step_0:5: depth = cone.depth - 1 = -1 (cone depth is the object default 0) (${sw.map((s) => s.depth).join(',')})`);
}
{
  const { st } = vortexScene(swordVortexManager, { cone: false });
  for (let f = 0; f < 90; f++) stepFrame(st, NONE);
  const sw = swordsOf(st);
  ok(sw.length === 6 && sw.every((s) => s.sprite_index === 'spr_roaringknight_sword_ol'),
    'no cone: the swords keep spr_roaringknight_sword_ol');
  ok(sw.every((s) => s.image_blend === getSwordcolor(st)),
    'Step_0:9: and carry get_swordcolor() by the shared reference');
  ok(sw.every((s) => s.depth === undefined),
    'no cone: depth untouched (the engine default)');
}
{
  // The mod never swaps back: a cone that dies leaves the swords that
  // STEPPED under it in _alt (and at depth -1), while a sword whose first
  // Step comes after wears sword_ol. The cone is killed on the frame the
  // sixth sword is born — an entity spawned mid-frame steps the NEXT frame
  // (CLAUDE.md "Creation frame"), so that one is the never-swapped control.
  const { st } = vortexScene(swordVortexManager, { cone: true });
  for (let f = 0; f < 30; f++) stepFrame(st, NONE);
  const sawCone = new Set(swordsOf(st).filter((s) => s.sprite_index === SWORD_OL_ALT).map((s) => s.seq));
  for (const c of alive(st, 'obj_knight_pointing_cone')) c.alive = false;
  for (let f = 0; f < 40; f++) stepFrame(st, NONE);
  const before = swordsOf(st).filter((s) => sawCone.has(s.seq));
  const after = swordsOf(st).filter((s) => !sawCone.has(s.seq));
  ok(before.length > 0 && before.every((s) => s.sprite_index === SWORD_OL_ALT && s.depth === -1
    && s.image_blend === getSwordcolor(st)),
    `cone gone: the ${before.length} swords that saw it keep _alt and depth -1 (no else branch resets them), blend back to get_swordcolor()`);
  ok(after.length > 0 && after.every((s) => s.sprite_index === 'spr_roaringknight_sword_ol' && s.depth === undefined),
    `cone gone: the ${after.length} sword(s) whose first Step came after never swap`);
}
{
  // VANILLA CONTROL: the sim module has no Step prefix at all.
  const { st } = vortexScene(simVortexManager, { cone: true });
  for (let f = 0; f < 60; f++) stepFrame(st, NONE);
  const sw = swordsOf(st);
  ok(sw.length > 0 && sw.every((s) => s.sprite_index === 'spr_roaringknight_sword_ol'
    && s.image_blend === undefined && s.depth === undefined),
    'vanilla control: the sim vortex sword never swaps sprite, blend or depth under a cone');
}
console.log('    ...and collision cannot move:');
{
  const alt = KAIZO_MASK_DATA[SWORD_OL_ALT];
  ok(!!alt, 'kaizo/data/masks.js carries the extracted spr_roaringknight_sword_ol_alt mask');
  const eng = SPRITE_MASKS.spr_roaringknight_sword_ol;
  ok(eng === SWORDOL_MASK, 'SPRITE_MASKS.spr_roaringknight_sword_ol IS the engine\'s SWORDOL_MASK object');
  ok(SPRITE_MASKS[SWORD_OL_ALT] === undefined,
    'the ENGINE registers no _alt mask (the alias below is why the swap is safe; if this fails, drop the alias)');
  const geom = alt && alt.w === eng.w && alt.h === eng.h && alt.originX === eng.originX
    && alt.originY === eng.originY && JSON.stringify(alt.bbox) === JSON.stringify(eng.bbox);
  ok(geom, `same geometry: ${alt?.w}x${alt?.h}, origin ${alt?.originX},${alt?.originY}, bbox ${JSON.stringify(alt?.bbox)}`);
  let rowsSame = !!alt && alt.rows.length === eng.px.length;
  let set = 0;
  if (rowsSame) {
    for (let y = 0; y < alt.rows.length && rowsSame; y++) {
      const r = alt.rows[y];
      if (r.length !== eng.px[y].length) { rowsSame = false; break; }
      for (let x = 0; x < r.length; x++) {
        const v = r[x] === '1';
        if (v) set += 1;
        if (v !== eng.px[y][x]) { rowsSame = false; break; }
      }
    }
  }
  ok(rowsSame && set > 0, `the extracted _alt rows are pixel-identical to the engine's sword_ol mask (${set} set pixels)`);

  // The research repo's extraction, when present: both sprites' mask sha1.
  const csv = join(homedir(), 'knight-research', 'kaizo-mod', 'sprites', 'sprites_kaizo.csv');
  if (existsSync(csv)) {
    const rows = readFileSync(csv, 'utf8').split(/\r?\n/);
    const sha = (name) => rows.find((r) => r.startsWith(`${name},`))?.split(',').pop();
    const a = sha('spr_roaringknight_sword_ol');
    const b = sha(SWORD_OL_ALT);
    ok(!!a && a.length === 40 && a === b, `sprites_kaizo.csv: mask sha1 equal (${a} / ${b})`);
  } else {
    console.log(`  --   SKIP sprites_kaizo.csv not on this machine (${csv}) — sha1 equality not re-read`);
  }

  // The graze path reads `e.mask` first (sim/index.js grazes): it must be
  // the engine's own object, so a sword_ol-wearing sword grazes exactly as
  // before the alias existed.
  const { st } = vortexScene(swordVortexManager, { cone: false });
  for (let f = 0; f < 30; f++) stepFrame(st, NONE);
  const sw = swordsOf(st);
  ok(sw.length > 0 && sw.every((s) => s.mask === SWORDOL_MASK),
    'every sword\'s `mask` is the engine\'s SWORDOL_MASK object (the graze path\'s hook)');
  ok(swordVortex.collides === swordOlAliasHit, 'the type\'s contact test is the alias test');

  // The alias test agrees with the engine's default test on every cell of a
  // grid: the same sword pose, tested as sword_ol through spriteMaskHit and
  // as _alt through swordOlAliasHit, must hit or miss identically.
  const heart = { x: 314, y: 162, mask: HEART_RECT };
  let cells = 0;
  let hits = 0;
  let disagree = 0;
  for (let dx = -60; dx <= 60; dx += 3) {
    for (let dy = -40; dy <= 40; dy += 4) {
      for (const ang of [0, 17, 45, 90, 123, 270, 315]) {
        const pose = {
          x: heart.x + 10 + dx, y: heart.y + 10 + dy, image_angle: ang,
          image_xscale: 1, image_yscale: 1,
        };
        const asOl = spriteMaskHit({ ...pose, sprite_index: 'spr_roaringknight_sword_ol' }, heart);
        const asAlt = swordOlAliasHit({ ...pose, sprite_index: SWORD_OL_ALT, mask: SWORDOL_MASK }, heart);
        cells += 1;
        if (asOl) hits += 1;
        if (asOl !== asAlt) disagree += 1;
      }
    }
  }
  ok(disagree === 0 && hits > 0 && hits < cells,
    `the _alt contact test agrees with the engine's sword_ol test on ${cells} cells (${hits} hits, ${disagree} disagreements)`);
  ok(swordOlAliasHit({ x: 0, y: 0, sprite_index: SWORD_OL_ALT }, heart) === null,
    'and with no mask it returns null, as spriteMaskHit does (counted as unmasked, never a silent miss)');
}

// ═══ G3: THE AIM BLOOM IS NAVY ═════════════════════════════════════════════
console.log('G3. obj_knight_circle — Create (0,0,128), Step fades g and r: the rim stays navy for its whole life');
function circleScene(type) {
  const st = createState({ seed: 12345 });
  st.damageEnabled = false;
  st.invTimer = -1;
  st.gmlRng = gmlCreate(12345);
  settleBox(spawn(st, battlebox, { x: 320, y: 170 }));
  st.soul = spawn(st, soul, { x: 314, y: 162 });
  const c = spawn(st, type, { x: 320, y: 170 });
  return { st, c };
}
{
  const { st, c } = circleScene(kaizoKnightCircle);
  ok(c.type.name === 'obj_knight_circle', 'the kaizo circle keeps the object name (seq logs, oracle checks, drawer key)');
  ok(eq3([c.r, c.g, c.b], CIRCLE_NAVY), `Create_0:2-4: born (${c.r}, ${c.g}, ${c.b}) = navy`);
  ok(c.fade_time === 28 && Math.abs((255 / c.fade_time) - CIRCLE_FADE) < 1e-12,
    'Create_0:8: fade_time 28 (255/28 a frame)');
  let steady = true;
  let frames = 0;
  while (c.alive && frames < CIRCLE_LIFE + 5) {
    stepFrame(st, NONE);
    frames += 1;
    if (c.alive && !eq3([c.r, c.g, c.b], CIRCLE_NAVY)) steady = false;
  }
  ok(steady, 'Step_0:9-10: g and r fade from 0 (no-ops), b is never touched — navy on every frame');
  // Its life is the alpha countdown's and nothing else: b sits at 128 so the
  // `r == 0 && b == 0` test can never fire. MEASURED: both types die after
  // 10 steps (the engine's own 0.1 accumulation), so the life is pinned to
  // the VANILLA copy's rather than to a hand-derived 11.
  const { st: sv, c: cv } = circleScene(simKnightCircle);
  let vFrames = 0;
  while (cv.alive && vFrames < CIRCLE_LIFE + 5) { stepFrame(sv, NONE); vFrames += 1; }
  ok(!c.alive && frames === vFrames && frames <= CIRCLE_LIFE + 1 && c.b === 128,
    `it dies on the alpha countdown after ${frames} frames, the same frame as the vanilla type (${vFrames}), with b still 128`);
  ok(c.isBullet === undefined && c.mask === undefined, 'not a bullet, no mask — invisible to the byte gate');
}
{
  // VANILLA CONTROL: sim/fx.js knightCircle is born maroon.
  const { st, c } = circleScene(simKnightCircle);
  ok(eq3([c.r, c.g, c.b], CIRCLE_VANILLA), `vanilla control: the sim circle is born (${c.r}, ${c.g}, ${c.b}) = maroon`);
  stepFrame(st, NONE);
  ok(c.r === 128, 'vanilla control: and its r never fades (vanilla fades g and b)');
}
{
  // The rotating slash spawns THIS type on its aim frame (Step_0:278).
  const st = createState({ seed: 4242 });
  st.view = { x: 0, y: 0 };
  st.invTimer = -1;
  st.turntimer = 999999;
  st.gmlRng = gmlCreate(4242);
  st.damageEnabled = false;
  st.kaizo = { sideb: false };
  st.currentAc = 5;
  spawn(st, { name: 'obj_knight_enemy' }, { x: 425, y: 78 });
  settleBox(spawn(st, battlebox, { x: 320, y: 170 }));
  st.soul = spawn(st, soul, { x: 314, y: 162 });
  spawnRotatingSlash(st, 425, 78, { difficulty: 2 });
  let seen = null;
  for (let f = 0; f < 200 && !seen; f++) {
    stepFrame(st, NONE);
    seen = alive(st, 'obj_knight_circle')[0] ?? null;
  }
  ok(!!seen && seen.type === kaizoKnightCircle,
    `the kaizo rotating slash's aim bloom is the kaizo circle type (${seen ? seen.type === kaizoKnightCircle : 'none spawned'})`);
  ok(!!seen && eq3([seen.r, seen.g, seen.b], CIRCLE_NAVY),
    `and it is navy on its first live frame (${seen ? [seen.r, seen.g, seen.b].join(',') : '-'})`);
  ok(!!seen && seen.type !== simKnightCircle, 'and NOT sim/fx.js\'s maroon one');
}

// ═══ G4: THE SPIRAL'S POSE ═════════════════════════════════════════════════
console.log('G4. obj_knight_rotating_slash — the two sprite writes RENDER-CRITIC 5b named');

/**
 * The bench the G3 block above uses for the rotating slash, reused verbatim.
 * `difficulty` defaults to 2 — the only value that reaches the spiral
 * (kaizo/attacks/rotating-slash.js:1155, `e.difficulty === 2 && e.turn_type
 * === 'full'`), and therefore the only one the two sprite writes below live
 * on. The difficulty-0 block at the end of this section passes 0 on purpose.
 */
function slashScene(spawnFn, { difficulty = 2 } = {}) {
  const st = createState({ seed: 4242 });
  st.view = { x: 0, y: 0 };
  st.invTimer = -1;
  st.turntimer = 999999;
  st.gmlRng = gmlCreate(4242);
  st.damageEnabled = false;
  st.kaizo = { sideb: false };
  st.currentAc = 5;
  spawn(st, { name: 'obj_knight_enemy' }, { x: 425, y: 78 });
  settleBox(spawn(st, battlebox, { x: 320, y: 170 }));
  st.soul = spawn(st, soul, { x: 314, y: 162 });
  const e = spawnFn(st, 425, 78, { difficulty });
  // The intro runs itself out; every assertion below starts from the aim.
  for (let i = 0; i < 80 && e.state !== 'aim'; i++) stepFrame(st, NONE);
  return { st, e };
}

/**
 * Put the instance one step short of `timer == slash_base + slash_offset` on
 * the SPIRAL arm (aim_type 2), wearing the prepare sheet the kaizo Step_0:260
 * gave it, then step once so the trigger line runs.
 */
function armSpiralPose(st, e) {
  e.aim_type = 2;
  e.state = 'aim';
  e.timer = e.slash_base + e.slash_offset - 1;
  e.sprite_index = 'spr_roaringknight_flurry_prepare';
  e.image_speed = 0;
  stepFrame(st, NONE);
}
const delayeds = (st, target) => st.entities.filter(
  (x) => x.alive && x.type.name === 'obj_script_delayed' && x.target === target,
);

/**
 * One module's whole answer to the spiral-pose trigger, as comparable text:
 * the delayed writes it arms (sorted, `name=value@alarm`), whether the trigger
 * frame itself moved the pose, and which step after the trigger the flurry
 * sheet lands on (null = never, within eight).
 *
 * It exists so the CONTROLS below can compare the two modules instead of
 * asserting that the vendored engine still lacks something. See their header.
 */
function spiralPose(spawnFn) {
  const { st, e } = slashScene(spawnFn);
  armSpiralPose(st, e);
  const armed = delayeds(st, e)
    .map((x) => `${x.varname}=${JSON.stringify(x.value)}@${x.alarm[0]}`)
    .sort();
  const atTrigger = `${e.sprite_index}@${e.image_speed}`;
  let landed = null;
  for (let k = 1; k <= 8 && landed === null; k++) {
    stepFrame(st, NONE);
    if (e.sprite_index === 'spr_roaringknight_flurry') landed = k;
  }
  return { st, e, armed, atTrigger, landed, sprite: e.sprite_index, speed: e.image_speed };
}

/** The same, for the end-of-spiral reset: the pose the module ends on. */
function spiralReset(spawnFn) {
  const { st, e } = slashScene(spawnFn);
  e.aim_type = 2;
  e.difficulty = 2;
  e.turn_type = 'full';
  e.slashes_done = true;
  e.do_final = false;
  e.final_counter = 27;
  e.state = 'cooldown';
  e.timer = e.cooldown_time - 1;
  e.sprite_index = 'spr_roaringknight_flurry';
  e.image_index = 2;
  e.image_speed = 1;
  stepFrame(st, NONE);
  return { st, e, pose: `${e.sprite_index}@${e.image_index}/${e.image_speed}` };
}

{
  const { st, e } = slashScene(spawnRotatingSlash);
  armSpiralPose(st, e);
  const d = delayeds(st, e).map((x) => [x.varname, x.value, x.alarm[0]]);
  const sprite = d.find((x) => x[0] === 'sprite_index');
  const speed = d.find((x) => x[0] === 'image_speed');
  ok(!!sprite && sprite[1] === 'spr_roaringknight_flurry' && sprite[2] === 4,
    'Step_0:298: scr_var_delayed("sprite_index", 3329, 4) arms an obj_script_delayed'
    + ` carrying spr_roaringknight_flurry at alarm[0] = 4 (${JSON.stringify(sprite)})`);
  ok(!!speed && speed[1] === 1 && speed[2] === 4,
    `Step_0:299: and its twin carries image_speed = 1 at the same delay (${JSON.stringify(speed)})`);
  ok(e.sprite_index === 'spr_roaringknight_flurry_prepare' && e.image_speed === 0,
    'A DELAY, NOT A WRITE: the trigger frame itself leaves the pose alone'
    + ` (${e.sprite_index} @ ${e.image_speed})`);

  // MEASURED, then pinned: the write lands on the FOURTH step after the
  // trigger frame — an entity spawned in the step phase first sees its alarm
  // phase next frame, so alarm[0] = 4 is four frames, not three or five.
  const landed = [];
  for (let k = 1; k <= 8; k++) {
    stepFrame(st, NONE);
    if (e.sprite_index === 'spr_roaringknight_flurry') { landed.push(k); break; }
  }
  ok(landed[0] === 4 && e.image_speed === 1,
    `the pair lands on step ${landed[0] ?? 'never'} after the trigger (want 4), image_speed ${e.image_speed}`);
  ok(delayeds(st, e).length === 0, 'and the two runners destroyed themselves (Alarm_0 ends in instance_destroy)');
}
// ── THE CONTROLS, WRITTEN TO SURVIVE THE PORT-BACK ────────────────────────
//
// BOTH ARMS ARE VANILLA (gml_vanilla_v105 Step_0:236-238 and :461-463 are
// byte-identical to the kaizo lines), so `sim/attacks/rotating-slash.js` is
// owed the same fix and CLAUDE.md law 6 says it lands in ../knight-sim and is
// re-vendored. The day it does, the vendored module starts arming the pair
// and resetting the sheet.
//
// A control that says "the engine does not do this yet" would go RED on that
// day — asserting the ABSENCE of a fix somebody is about to make, inside a
// file `npm run verify:kaizo` runs. So these pin the MOD's answer and then
// hold the engine to ONE OF TWO states: it does nothing yet, or it does
// EXACTLY what the mod does. A third state — the engine arming a DIFFERENT
// pair, or landing the sheet on a different step — is what a control is for,
// and it still fails. Which of the two states the engine is in is printed on
// every run, so the port-back is visible the day it lands and nobody has to
// come back and edit an assertion to notice.
{
  const kz = spiralPose(spawnRotatingSlash);
  const vn = spiralPose(simSpawnRotatingSlash);
  const WANT = ['image_speed=1@4', 'sprite_index="spr_roaringknight_flurry"@4'];
  ok(kz.armed.join(' | ') === WANT.join(' | '),
    `THE MOD ARMS EXACTLY: ${WANT.join(' | ')} (kaizo module: ${kz.armed.join(' | ') || 'nothing'})`);
  const ported = vn.armed.length > 0;
  ok(!ported || vn.armed.join(' | ') === kz.armed.join(' | '),
    `control: the vendored engine arms ${ported ? 'THE SAME PAIR — the port-back has landed'
      : 'nothing yet — the port-back is still owed'}`
    + `, never a different one (${vn.armed.join(' | ') || 'nothing'})`);
  ok(vn.landed === (ported ? kz.landed : null),
    `control: and its sheet lands on step ${JSON.stringify(vn.landed)}`
    + ` (want ${ported ? `the mod's ${kz.landed}` : 'never, nothing being armed'})`);
  ok(vn.sprite === (ported ? kz.sprite : 'spr_roaringknight_flurry_prepare'),
    `control: eight steps on it wears ${vn.sprite}`
    + ` (want ${ported ? kz.sprite : 'the untouched spr_roaringknight_flurry_prepare'})`);
}
{
  // The RESET. `scr_var` with no target is variable_instance_set(id, ...) —
  // immediate, on self. Driven by putting the instance one step short of the
  // cooldown's fire with final_counter at 27, so the ++ reaches the route-C
  // _endslashamt of 28.
  const { st, e } = slashScene(spawnRotatingSlash);
  e.aim_type = 2;
  e.difficulty = 2;
  e.turn_type = 'full';
  e.slashes_done = true;
  e.do_final = false;
  e.final_counter = 27;
  e.state = 'cooldown';
  e.timer = e.cooldown_time - 1;
  e.sprite_index = 'spr_roaringknight_flurry';
  e.image_index = 2;
  e.image_speed = 1;
  stepFrame(st, NONE);
  ok(e.final_counter === 28 && e.state === 'return',
    `the spiral's 28th slash ends it (final_counter ${e.final_counter}, state ${e.state})`);
  ok(e.sprite_index === 'spr_roaringknight_attack_ol',
    `Step_0:618: sprite_index back to 2128 = spr_roaringknight_attack_ol (${e.sprite_index})`);
  ok(e.image_index === 0 && e.image_speed === 0,
    `Step_0:619-620: image_index 0 and image_speed 0 with it (${e.image_index}, ${e.image_speed})`);
  ok(e.alarm[3] === 22, 'and Alarm_3 is still armed at 22 (the write did not displace it)');
}
{
  // THE CONTROL FOR THE RESET, same two-state form and the same reason.
  const kz = spiralReset(spawnRotatingSlash);
  const vn = spiralReset(simSpawnRotatingSlash);
  ok(kz.pose === 'spr_roaringknight_attack_ol@0/0',
    `THE MOD ENDS THE SPIRAL AT: spr_roaringknight_attack_ol@0/0 (kaizo module: ${kz.pose})`);
  // The engine leaves image_speed 1 running, so its image_index has already
  // ticked past the 2 the bench set — the SHEET is what says whether the
  // reset happened, not the frame within it.
  const ported = vn.e.sprite_index !== 'spr_roaringknight_flurry';
  ok(vn.e.state === 'return' && (!ported || vn.pose === kz.pose),
    `control: the vendored engine ends it ${ported ? `at ${vn.pose} — the port-back has landed`
      : `still wearing the stale ${vn.pose} — the port-back is still owed`}`);
}
{
  // THE ONE THING THE DRAW SHEET SAYS ABOUT THIS OBJECT, and it is a negative:
  // over the whole atk_Multislash1 lock (468 rows, cs_multislash1-raw) the
  // rotating slash NEVER leaves spr_roaringknight_attack_ol. That window is
  // DIFFICULTY 0, which never reaches aim_type 2 (kaizo/attacks/
  // rotating-slash.js:1155 forks into the spiral only on `difficulty === 2 &&
  // turn_type === 'full'`), so the flurry arm above is unexercised by every
  // recording on disk.
  //
  // SO THIS BLOCK RUNS DIFFICULTY 0, and asserts what the sheet says: the
  // sprite VOCABULARY over the entity's whole life is that one name and
  // nothing else. A membership test would have been satisfied by the opening
  // pose alone and would have passed at any difficulty — the set equality is
  // the claim, and the difficulty-2 companion below is what proves the
  // assertion can tell the two apart.
  const walk = (difficulty) => {
    const { st, e } = slashScene(spawnRotatingSlash, { difficulty });
    const seen = new Set([e.sprite_index]);
    const aims = new Set([e.aim_type]);
    let frames = 0;
    for (let k = 0; k < 900; k++) {
      stepFrame(st, NONE);
      if (!e.alive) break;
      frames += 1;
      seen.add(e.sprite_index);
      aims.add(e.aim_type);
    }
    return { seen: [...seen].sort(), aims: [...aims].sort(), frames };
  };
  const d0 = walk(0);
  ok(d0.seen.length === 1 && d0.seen[0] === 'spr_roaringknight_attack_ol',
    'the Multislash 1 sheet\'s negative, reproduced: over the difficulty-0 slash\'s whole'
    + ` ${d0.frames} frames the ONLY sprite is spr_roaringknight_attack_ol (saw ${d0.seen.join(', ')})`);
  ok(!d0.aims.includes(2),
    `and it never reaches aim_type 2, which is why (aim_types ${d0.aims.join(',')})`);
  const d2 = walk(2);
  ok(d2.seen.includes('spr_roaringknight_flurry') && d2.seen.length > 1,
    'and the assertion above discriminates: difficulty 2 DOES leave that sheet'
    + ` (${d2.seen.join(', ')})`);
}

console.log(`\ncheck-colours: ${pass} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
