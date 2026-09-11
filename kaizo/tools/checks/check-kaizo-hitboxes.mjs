#!/usr/bin/env node
// KAIZO V-C — THE TWO COLLISION MASKS THE MOD CHANGED (ledger G-23), and the
// B-Side blade dash windup (ledger G-44).
//
// PUBLISH GATE: V-C recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 —
// do not publish without permission (kaizo/HANDOFF.md §5-C).
//
// WHY BOTH LIVE IN ONE FILE: both are `obj_knight_diamondswordbullet_ext` /
// tunnel-family changes that NO CODE DIFF CAN SEE. G-23 is invisible because
// the GML is byte-identical at the assignment and the change is in the sprite
// table; G-44 is visible in the GML but was translated with only one arm of a
// two-arm fork, which reads as complete.
//
// What this pins:
//
//   H1  THE BITMAPS DIFFER, measured rather than asserted from prose. The
//       mod's spr_roaringknight_slash_tunnel is a 3-row bar at rows 14..16
//       where the engine's is a 9-row lens at rows 6..14 (same origin y 10,
//       so the inked band moves from -4..+4 to +4..+6); the mod's
//       spr_knight_diamondbullet_l spans columns 3..94 where the engine's
//       spans 5..93.
//   H2  THE SPEAR'S HITBOX REALLY MOVED. Two soul positions are found that
//       the two masks DISAGREE about — one the engine's mask hits and the
//       mod's misses, one the reverse — and `kaizoTunnelslashBullet.collides`
//       answers the MOD's way at both. A regression to the sim type answers
//       the engine's way and fails both.
//   H3  THE BLADE IS 3PX WIDER, the same way: a soul one pixel past the
//       engine's tip is hit by the mod's mask and not by the engine's.
//   H3b …AND `diamondSwordBullet.collides` READS `e.mask` TO GET THERE. H3
//       measures the two bitmaps and H5(c) proves the long blade carries the
//       mod's one, but the `if (e.mask) return enginePairHit(…)` line that
//       joins them was asserted by nothing — delete it and `spriteMaskHit`
//       resolves SPRITE_MASKS instead, so the blade grazes on the mod's shape
//       and is hit-tested on the engine's, which is the split its own comment
//       says it exists to prevent. Asserted through the type, at both edges,
//       with the field-less control and the graze path beside it.
//   H4  BOTH READERS AGREE. sim/index.js's `grazes` resolves
//       `e.mask ?? SPRITE_MASKS[sprite_index]` and consults NO type override,
//       so a mask installed only in `collides` would have the spear hit on
//       one shape and graze on another. Asserted through the real frame loop:
//       the graze box sees the mod's band and not the engine's.
//   H5  THE SPAWNERS REALLY INSTALL IT — the "computed and never read" trap
//       this repo keeps hitting. The kaizo KnightLines volley spawns
//       `kaizoTunnelslashBullet` (not the sim type) with `mask` set; the
//       kaizo sword tunnel's sword carries the mod's mask from Create; and
//       the revised tunnel's LONG blade carries it while its short and medium
//       blades do not.
//   H6  G-44 — the dash windup forks on kaizo_sideb(). A-Side: -4->0 over 8f
//       at delay 13, 0->24 over 12f at delay 21, afterimages at 21. B-Side:
//       5f at 13, 8f at 18, afterimages at 18. Driven through the real
//       Other_10 and the real Step, so what is asserted is the SPEED CURVE
//       and the frame it reaches 24 — 26 on the B-Side against 33 on the A —
//       not the shape of the schedule array.
//
//     node kaizo/tools/checks/check-kaizo-hitboxes.mjs        exit 0 / 1

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn, destroy } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox } from '../../../sim/battlebox.js';
import {
  HEART_RECT, SLASHTUNNEL_MASK, DIAMOND_MASK, masksOverlap, SPRITE_MASKS,
} from '../../../sim/masks.js';
import {
  KAIZO_SLASHTUNNEL_MASK, KAIZO_DIAMONDBULLET_L_MASK,
} from '../../attacks/kaizo-hitboxes.js';
import { kaizoTunnelslashBullet } from '../../attacks/knightlines.js';
import { tunnelslashBullet } from '../../../sim/attacks/knightlines.js';
import { diamondSwordBullet, launchSwordTunnelRevised } from '../../attacks/sword-tunnel-revised.js';
import { swordTunnelSword } from '../../attacks/sword-tunnel.js';

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) { pass += 1; } else { fail += 1; console.log(`  FAIL ${msg}`); }
}
function eq(got, want, msg) {
  ok(got === want, `${msg}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/** The inked span of one mask row, as [first, last] or null. */
function rowSpan(m, y) {
  const r = m.px[y];
  if (!r) return null;
  const on = [];
  for (let i = 0; i < r.length; i += 1) if (r[i]) on.push(i);
  return on.length ? [on[0], on[on.length - 1]] : null;
}
/** Which rows of a mask carry any ink. */
function inkedRows(m) {
  const out = [];
  for (let y = 0; y < m.px.length; y += 1) if (rowSpan(m, y)) out.push(y);
  return out;
}

// ── H1 — the bitmaps differ, measured ──────────────────────────────────────
{
  const vanSpear = inkedRows(SLASHTUNNEL_MASK);
  const kzSpear = inkedRows(KAIZO_SLASHTUNNEL_MASK);
  eq(vanSpear.join(','), '6,7,8,9,10,11,12,13,14',
    'H1: the ENGINE spear is nine rows, 6..14 (origin y 10, so -4..+4)');
  eq(kzSpear.join(','), '14,15,16',
    'H1: the MOD spear is three rows, 14..16 (origin y 10, so +4..+6)');
  eq(SLASHTUNNEL_MASK.originY, KAIZO_SLASHTUNNEL_MASK.originY,
    'H1: …at the SAME origin y, which is what makes it a move and not a resize');
  eq(SLASHTUNNEL_MASK.h, 21, 'H1: engine sheet 21 tall');
  eq(KAIZO_SLASHTUNNEL_MASK.h, 32, 'H1: mod sheet 32 tall');

  const vanBlade = rowSpan(DIAMOND_MASK, 15);
  const kzBlade = rowSpan(KAIZO_DIAMONDBULLET_L_MASK, 15);
  eq(vanBlade.join(','), '5,93', 'H1: the ENGINE blade spans columns 5..93');
  eq(kzBlade.join(','), '3,94', 'H1: the MOD blade spans columns 3..94 — 3px wider');
  eq(inkedRows(KAIZO_DIAMONDBULLET_L_MASK).join(','), '14,15,16',
    'H1: …and the same three rows, so the change is width only');

  // The engine keeps the vanilla bitmaps — this is a kaizo-side routing, not
  // a patch of sim/ (repo law 6). If someone "helpfully" registers the mod's
  // masks there, the vanilla fight's hitboxes change and this says so.
  ok(SPRITE_MASKS.spr_roaringknight_slash_tunnel === SLASHTUNNEL_MASK,
    'H1: sim/masks.js still carries the VANILLA spear mask');
  ok(SPRITE_MASKS.spr_knight_diamondbullet_l === DIAMOND_MASK,
    'H1: sim/masks.js still carries the VANILLA blade mask');
  ok(KAIZO_SLASHTUNNEL_MASK !== SLASHTUNNEL_MASK && KAIZO_DIAMONDBULLET_L_MASK !== DIAMOND_MASK,
    'H1: …and the kaizo masks are different objects');
}

// ── H2 — the spear's hitbox really moved ───────────────────────────────────
/** One bullet at (bx, by), unrotated and unscaled, against a soul rect. */
function hits(mask, bx, by, sx, sy) {
  return masksOverlap(HEART_RECT, sx, sy, mask, bx, by, 1, 1, 0);
}

{
  const BX = 300;
  const BY = 200;
  // ABOVE the blade's line: rows -4..-1 are inked in the engine's lens and
  // bare in the mod's bar. A 20x20 soul rect at y BY-20 covers BY-20..BY-1.
  const ABOVE_Y = BY - 20;
  // BELOW it: the mod's bar reaches +6, the engine's lens stops at +4. A rect
  // at y BY+6 covers BY+6..BY+25.
  const BELOW_Y = BY + 6;
  const SX = BX - 10; // well inside both masks' columns

  ok(hits(SLASHTUNNEL_MASK, BX, BY, SX, ABOVE_Y),
    'H2: the ENGINE mask hits a soul sitting just ABOVE the blade line');
  ok(!hits(KAIZO_SLASHTUNNEL_MASK, BX, BY, SX, ABOVE_Y),
    'H2: …and the MOD mask does not — the band moved 8px down');
  ok(!hits(SLASHTUNNEL_MASK, BX, BY, SX, BELOW_Y),
    'H2: the ENGINE mask misses a soul 6px BELOW the line');
  ok(hits(KAIZO_SLASHTUNNEL_MASK, BX, BY, SX, BELOW_Y),
    'H2: …and the MOD mask hits it');

  // THE TYPE ANSWERS THE MOD'S WAY at both, and the sim type the engine's.
  const heartAt = (x, y) => ({ x, y, mask: HEART_RECT });
  const spear = {
    active: 1, x: BX, y: BY, image_xscale: 1, image_yscale: 1, image_angle: 0,
    sprite_index: 'spr_roaringknight_slash_tunnel',
  };
  ok(kaizoTunnelslashBullet.collides(spear, heartAt(SX, BELOW_Y)) === true,
    'H2: kaizoTunnelslashBullet.collides hits BELOW the line …');
  ok(kaizoTunnelslashBullet.collides(spear, heartAt(SX, ABOVE_Y)) === false,
    'H2: … and misses ABOVE it');
  ok(tunnelslashBullet.collides(spear, heartAt(SX, ABOVE_Y)) === true,
    'H2: the SIM type still answers the engine\'s way ABOVE (vanilla untouched) …');
  ok(tunnelslashBullet.collides(spear, heartAt(SX, BELOW_Y)) === false,
    'H2: … and the engine\'s way BELOW');
  // The guard survived the wrap.
  ok(kaizoTunnelslashBullet.collides({ ...spear, active: 0 }, heartAt(SX, BELOW_Y)) === false,
    'H2: an inactive spear still collides with nothing');
  eq(kaizoTunnelslashBullet.name, 'obj_bullet_knight_tunnelslash',
    'H2: the wrapper keeps the GML object name the oracle checks map by');
}

// ── H3 — the blade is 3px wider ────────────────────────────────────────────
{
  const BX = 300;
  const BY = 200;
  const SY = BY - 10; // the rect covers BY-10..BY+9, over the 3 inked rows
  // The engine's right edge is column 93 -> x BX+44; the mod's is 94 -> BX+45.
  const RIGHT = BX + 45;
  // The engine's left edge is column 5 -> BX-44; the mod's is 3 -> BX-46. A
  // 20-wide rect at BX-65 covers BX-65..BX-46.
  const LEFT = BX - 65;
  ok(!hits(DIAMOND_MASK, BX, BY, RIGHT, SY),
    'H3: the ENGINE blade misses one pixel past its tip');
  ok(hits(KAIZO_DIAMONDBULLET_L_MASK, BX, BY, RIGHT, SY),
    'H3: …the MOD blade reaches it');
  ok(!hits(DIAMOND_MASK, BX, BY, LEFT, SY),
    'H3: the ENGINE blade misses two pixels past its hilt');
  ok(hits(KAIZO_DIAMONDBULLET_L_MASK, BX, BY, LEFT, SY),
    'H3: …the MOD blade reaches it');

  // ── H3b — `diamondSwordBullet.collides` PREFERS `e.mask` ─────────────────
  //
  // THE HOLE THIS CLOSES. Everything above measures the two BITMAPS, and H5c
  // below proves the long blade CARRIES the mod's one — but the line that
  // makes the hit test read it,
  //
  //     if (e.mask) return enginePairHit(heart, e, e.mask);
  //     return spriteMaskHit(e, heart);
  //
  // was asserted by nothing. `spriteMaskHit` resolves SPRITE_MASKS and
  // IGNORES `mask`, so deleting that line leaves the blade grazing on the
  // mod's three-pixel-wider shape (sim/index.js `grazes` reads `e.mask`) and
  // being hit-tested on the engine's — the exact split its comment says it
  // exists to prevent, and green everywhere.
  //
  // The blade at the RIGHT position above is one pixel past the engine's tip:
  // a `collides` that reads `e.mask` says yes, one that falls through to
  // spriteMaskHit says no.
  const heartAt = (x, y) => ({ x, y, mask: HEART_RECT });
  const blade = {
    active: 1, x: BX, y: BY, image_xscale: 1, image_yscale: 1, image_angle: 0,
    sprite_index: 'spr_knight_diamondbullet_l',
    mask: KAIZO_DIAMONDBULLET_L_MASK,
  };
  ok(diamondSwordBullet.collides(blade, heartAt(RIGHT, SY)) === true,
    'H3b: diamondSwordBullet.collides reaches one pixel past the ENGINE tip — '
    + 'it reads e.mask, not SPRITE_MASKS');
  ok(diamondSwordBullet.collides(blade, heartAt(LEFT, SY)) === true,
    'H3b: …and two pixels past the engine hilt');
  // THE CONTROL, on the same instance: without the field it answers the
  // engine's way at both, which is what a deleted `if (e.mask)` line would
  // make EVERY long blade do.
  const bare = { ...blade, mask: undefined };
  ok(diamondSwordBullet.collides(bare, heartAt(RIGHT, SY)) === false,
    'H3b: …while the same blade with no mask misses — SPRITE_MASKS is the '
    + 'vanilla bitmap and the fall-through really is narrower');
  ok(diamondSwordBullet.collides(bare, heartAt(LEFT, SY)) === false,
    'H3b: …at the hilt too');
  // Both answer the same inside the shared span, so H3b is measuring the
  // 3px edge and not a blanket difference.
  const INSIDE = BX - 10;
  ok(diamondSwordBullet.collides(blade, heartAt(INSIDE, SY)) === true
    && diamondSwordBullet.collides(bare, heartAt(INSIDE, SY)) === true,
  'H3b: …and both shapes agree well inside the blade');
  // The `active` guard survives in front of the mask line.
  ok(diamondSwordBullet.collides({ ...blade, active: 0 }, heartAt(INSIDE, SY)) === false,
    'H3b: a FAKE blade (active false) still collides with nothing');

  // AND THE GRAZE PATH READS THE SAME FIELD, which is the other half of the
  // comment's claim. `grazes` consults no type override at all, so the only
  // way the two can agree is `e.mask` — asserted by taking it away.
  const grazeScene = (mask) => {
    const state = createState({ seed: 2024 });
    state.damageEnabled = false;
    state.invTimer = -30;
    spawn(state, battlebox, { x: 320, y: 220 });
    state.soul = spawn(state, soul, { x: 300, y: 220 });
    state.soul.mask = HEART_RECT;
    const b = spawn(state, diamondSwordBullet, { x: 320, y: 230 });
    b.active = 1;
    b.speed = 0;
    b.gravity = 0;
    b.image_angle = 0;
    b.image_xscale = 1;
    b.image_yscale = 1;
    b.sprite_index = 'spr_knight_diamondbullet_l';
    b.mask = mask;
    for (let f = 0; f < 3; f += 1) stepFrame(state, {});
    return b.grazed;
  };
  //
  // The graze box is 50x50, far larger than the three pixels the two bitmaps
  // differ by, so no soul position can tell the mod's mask from the engine's
  // THERE (H4 makes the same point for the spear). What CAN be shown, and is
  // what the assertion needs, is that `e.mask` is the value the path reads: a
  // blank mask of the same dimensions on the same instance grazes nothing.
  const blankBlade = {
    name: 'blank', w: 99, h: 32, originX: 49, originY: 15, bbox: [0, 0, 98, 31],
    px: Array.from({ length: 32 }, () => new Array(99).fill(false)),
  };
  ok(grazeScene(KAIZO_DIAMONDBULLET_L_MASK) > 0,
    'H3b: the long blade GRAZES with the mod\'s mask installed');
  ok(grazeScene(blankBlade) === 0,
    'H3b: …and a blank mask on the same instance grazes nothing — `grazes` '
    + 'reads e.mask, the same field `collides` prefers');
}

// ── H4 — the graze path reads the same shape ───────────────────────────────
/** A minimal fight frame with one spear parked beside the soul. */
function grazeScene({ mask, soulY }) {
  const state = createState({ seed: 12345 });
  state.damageEnabled = false;
  state.invTimer = -30;
  spawn(state, battlebox, { x: 320, y: 220 });
  state.soul = spawn(state, soul, { x: 290, y: soulY });
  state.soul.mask = HEART_RECT;
  const b = spawn(state, kaizoTunnelslashBullet, { x: 300, y: 200 });
  b.sprite_index = 'spr_roaringknight_slash_tunnel';
  b.active = 1;
  b.speed = 0;
  b.image_angle = 0;
  b.image_xscale = 1;
  b.image_yscale = 1;
  if (mask) b.mask = mask;
  return { state, b };
}
{
  // The graze box is 50x50 around the soul's centre and ONE FRAME BEHIND it
  // (sim/index.js), so two frames of standing still settle it. A soul far
  // below the mod's band grazes nothing; one on it grazes.
  const far = grazeScene({ mask: KAIZO_SLASHTUNNEL_MASK, soulY: 200 + 120 });
  for (let f = 0; f < 3; f += 1) stepFrame(far.state, {});
  const farGrazed = far.b.grazed;

  const near = grazeScene({ mask: KAIZO_SLASHTUNNEL_MASK, soulY: 200 + 6 });
  for (let f = 0; f < 3; f += 1) stepFrame(near.state, {});
  ok(near.b.grazed > 0, 'H4: a soul on the MOD\'s band grazes the spear');
  eq(farGrazed, 0, 'H4: …and one 120px away does not (the box is 50 wide)');

  // THE POINT: `grazes` resolves `e.mask ?? SPRITE_MASKS[sprite_index]` and
  // consults NO type override, so `e.mask` is a SECOND reader of the shape.
  // The graze box is 50x50, far larger than the 8px the two bitmaps differ
  // by, so no soul position can tell the two bitmaps apart THERE — what the
  // assertion needs, and what this shows, is that `e.mask` is the value the
  // graze path actually reads: the same scene with a blank mask of the same
  // size grazes nothing, so installing the mod's is what the path sees.
  const blank = {
    name: 'blank', w: 99, h: 32, originX: 49, originY: 10, bbox: [0, 0, 98, 31],
    px: Array.from({ length: 32 }, () => new Array(99).fill(false)),
  };
  const blanked = grazeScene({ mask: blank, soulY: 200 + 6 });
  for (let f = 0; f < 3; f += 1) stepFrame(blanked.state, {});
  eq(blanked.b.grazed, 0,
    'H4: `grazes` reads e.mask — a blank mask on the same instance grazes nothing');
}

// ── H5 — the spawners really install it ────────────────────────────────────
{
  // (a) the kaizo KnightLines volley. Driven through the real attack rather
  // than by inspecting source: the trap this guards is a mask computed and
  // never read.
  const { launchKnightlines } = await import('../../attacks/knightlines.js');
  const state = createState({ seed: 4242 });
  state.damageEnabled = false;
  state.turntimer = 9999;
  // ac 101, NOT 110: `myattackchoice == 110` is what arms attack_type 1, the
  // CAROUSEL. The spear volley is the attack_type-0 prepare/slash chain.
  state.currentAc = 101;
  // The same board shape check-knightlines's scaffold uses: 1.5 x 2.5 at x-110.
  spawn(state, battlebox, { x: 210, y: 170 });
  state.soul = spawn(state, soul, { x: 200, y: 170 });
  state.soul.mask = HEART_RECT;
  state.kaizo = { sideb: false, approx: [] };
  const mg = launchKnightlines(state, 425, 78, { damage: 103 });
  let spears = [];
  for (let f = 0; f < 400 && spears.length === 0; f += 1) {
    stepFrame(state, {});
    spears = state.entities.filter(
      (e) => e.alive && e.sprite_index === 'spr_roaringknight_slash_tunnel',
    );
  }
  ok(spears.length > 0, 'H5: the kaizo KnightLines volley puts spears on screen');
  if (spears.length) {
    ok(spears.every((s) => s.type === kaizoTunnelslashBullet),
      'H5: …and every one is kaizoTunnelslashBullet, not the sim type');
    ok(spears.every((s) => s.mask === KAIZO_SLASHTUNNEL_MASK),
      'H5: …carrying the mod\'s mask for the graze path too');
  }
  void mg;
}
{
  // (b) the kaizo sword tunnel's sword installs it at Create.
  const state = createState({ seed: 7 });
  spawn(state, battlebox, { x: 320, y: 220 });
  state.soul = spawn(state, soul, { x: 311, y: 222 });
  const sw = spawn(state, swordTunnelSword, { x: 300, y: 100 });
  eq(sw.sprite_index, 'spr_knight_diamondbullet_l', 'H5: the sword\'s sprite');
  ok(sw.mask === KAIZO_DIAMONDBULLET_L_MASK,
    'H5: …and obj_sword_tunnel_sword carries the mod\'s mask from Create');
  destroy(sw);
}
{
  // (c) the revised tunnel's LONG blade carries it; the short/medium do not.
  const state = createState({ seed: 99 });
  state.damageEnabled = false;
  state.turntimer = 9999;
  spawn(state, battlebox, { x: 320, y: 220 });
  state.soul = spawn(state, soul, { x: 311, y: 222 });
  state.soul.mask = HEART_RECT;
  state.kaizo = { sideb: false, approx: [] };
  launchSwordTunnelRevised(state);
  const seen = new Map();
  for (let f = 0; f < 600; f += 1) {
    stepFrame(state, {});
    for (const e of state.entities) {
      if (e.type === diamondSwordBullet && !seen.has(e.seq)) {
        seen.set(e.seq, { sprite: e.sprite_index, mask: e.mask });
      }
    }
  }
  const blades = [...seen.values()];
  ok(blades.length > 0, `H5: the revised tunnel fires blades (${blades.length})`);
  const longs = blades.filter((b) => b.sprite === 'spr_knight_diamondbullet_l');
  const others = blades.filter((b) => b.sprite !== 'spr_knight_diamondbullet_l');
  ok(longs.length > 0, `H5: …some of them are the LONG sheet (${longs.length})`);
  ok(longs.every((b) => b.mask === KAIZO_DIAMONDBULLET_L_MASK),
    'H5: …and every long blade carries the mod\'s wider mask');
  ok(others.every((b) => b.mask === undefined),
    'H5: …while the _s / _m blades carry none — only spr_knight_diamondbullet_l changed');
}

// ── H6 — G-44, the dash windup fork ────────────────────────────────────────
/**
 * ONE BLADE, through the real Other_10 and the real Step. What is measured is
 * the speed curve, not the schedule array, so stripping the fork and leaving
 * the array shape alone still fails.
 */
function dash(sideb) {
  const state = createState({ seed: 31337 });
  state.damageEnabled = false;
  state.turntimer = 9999;
  spawn(state, battlebox, { x: 320, y: 220 });
  state.soul = spawn(state, soul, { x: 311, y: 222 });
  state.soul.mask = HEART_RECT;
  state.kaizo = { sideb, approx: [] };
  const b = spawn(state, diamondSwordBullet, { x: 500, y: 220 });
  b.active = 1;
  b.image_angle = 90;
  b.speed = 0;
  diamondSwordBullet.init(b, state); // Other_10
  const speeds = [];
  let afterimageAt = -1;
  for (let f = 0; f < 45; f += 1) {
    stepFrame(state, {});
    speeds.push(b.speed);
    // `do_afterimage` is set to 1 by the schedule and bumped to 2 by the SAME
    // step's afterimage block, so the 1 is never observable from out here —
    // watch for it becoming truthy instead.
    if (afterimageAt < 0 && b.do_afterimage) afterimageAt = b.pendingT;
  }
  return { b, speeds, afterimageAt };
}
{
  const a = dash(false);
  const s = dash(true);

  // `scr_script_delayed(scr_var, 21|18, "do_afterimage", 1)`.
  eq(a.afterimageAt, 21, 'H6: A-Side afterimages arm at delay 21');
  eq(s.afterimageAt, 18, 'H6: B-Side afterimages arm at delay 18 (Other_10:46)');

  // The rock-back: `-4 -> 0` over 8 frames (A) or 5 (B), both at delay 13.
  // scr_lerpvar's first write lands one frame after creation, so the trough
  // is the frame the second delay's lerp has not started on.
  const trough = (r) => Math.min(...r.speeds);
  ok(trough(a) < -2 && trough(s) < -2,
    `H6: both sides rock BACKWARDS first (A ${trough(a)}, B ${trough(s)})`);
  // AND THE A-SIDE'S IS DEEPER: the same -4 -> 0 ease over 8 frames instead
  // of 5, so its first written step is a smaller fraction of the way back.
  ok(trough(a) < trough(s),
    `H6: the A-Side rock-back is the deeper one (A ${trough(a)} < B ${trough(s)})`);

  // THE NUMBER THAT MATTERS: the frame the blade reaches full dash speed.
  const fullAt = (r) => r.speeds.findIndex((v) => v >= 24) + 1;
  eq(fullAt(a), 33, 'H6: the A-Side blade is at 24 on frame 33 (delay 21 + 12)');
  eq(fullAt(s), 26, 'H6: the B-Side blade is at 24 on frame 26 (delay 18 + 8) — '
    + 'SEVEN frames of dodge window off every blade of the wall');

  // …and it is genuinely faster the whole way in, not just at the end.
  const at = (r, f) => r.speeds[f - 1];
  ok(at(s, 22) > at(a, 22),
    `H6: the B-Side blade is already faster at frame 22 (B ${at(s, 22)} > A ${at(a, 22)})`);
  // Both schedules share the delay-13 rock-back, so frame 14 — the first
  // written step of it — is the same sign on both sides and the fork has not
  // bitten yet.
  ok(at(a, 14) < 0 && at(s, 14) < 0,
    `H6: …and the shared delay-13 rock-back has both moving backwards at 14 `
    + `(A ${at(a, 14)}, B ${at(s, 14)})`);
}

console.log(fail === 0
  ? `check-kaizo-hitboxes: all ${pass} checks passed\n`
    + '  H1 the bitmaps / H2 the spear moved 8px down / H3 the blade is 3px wider\n'
    + '  H3b the revised tunnel\'s collides really prefers e.mask\n'
    + '  H4 hit and graze read the same mask / H5 the spawners install it\n'
    + '  H6 G-44, the B-Side dash is full speed on frame 26, not 33'
  : `check-kaizo-hitboxes: ${fail} of ${pass + fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
