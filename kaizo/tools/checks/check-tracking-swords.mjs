#!/usr/bin/env node
// CHECK — kaizo/attacks/tracking-swords.js (KAIZO V-C, dc.type 151).
//
// Positive assertions on every branch the kaizo module ADDS over the verified
// sim module, plus a copy-fidelity diff proving the vanilla variants are
// byte-equivalent in behaviour. No oracle exists for these yet (the mod
// recording comes later per HANDOFF §K8); each assertion below fails if its
// branch is deleted — none passes vacuously:
//
//   1. the Other_10 variant table (3.1/4/4-sideb/5/6/6.1/7/7.1/7.2/8/10/11),
//      including that fractional variants select their OWN rows;
//   2. cadences: 3.1 differs from 3; variant 4 pairs (4/24) vs the B-Side
//      chain (12s); variant 11's 2-frame endless chain;
//   3. the 90/270 up-down string overriding the first 22 headings;
//   4. variant 10's per-sword override (5/5/10/4, len 88) and its faster
//      slash (27 steps vs 42);
//   5. the telegraph recolour: get_swordcolor (blue default, swordtype rows)
//      and the context fade times 30 / 20 / 19(B-Side) / 15(v10);
//   6. frostveil: anomaly swords, 270+20°/sword spiral, growtangle anchor
//      (heart-anchored at birth, box-anchored from the first step), ZERO rng
//      draws, 2-frame cadence;
//   7. the extra-graze band: variant-11 grazes pay 1 TP (vs 7), and the band
//      dies after exactly 3 steps;
//   8. two managers: same-frame newborn swords never share a heading (the
//      reroll loop) and the vanilla wheel is disabled (single-manager control
//      still nudges);
//   9. variant 7.1: one lead sword, then silence until the rotating-slash
//      poke (`timer = rate - 2`) fires one 2 frames later;
//  10. the damage override flows manager -> sword -> slash;
//  11. kaizo slash/sword live one frame less than the sim module's;
//  12. copy fidelity: variants 0/2/3 spawn frame+heading sequences identical
//      to the sim module on the same seed.
//
//     node kaizo/tools/checks/check-tracking-swords.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { mergeColor, WHITE } from '../../../sim/gml.js';
import {
  trackingSwordsManager as kzManager,
  trackingSlashExtraGraze as kzBand,
} from '../../attacks/tracking-swords.js';
import { trackingSwordsManager as simManager } from '../../../sim/attacks/tracking-swords.js';
import { SWORDCOLORS } from '../../attacks/kaizo-colors.js';

/**
 * GameMaker packs make_colour_rgb(r, g, b) as r + g*256 + b*65536 — BGR, so
 * the dump's decimal 16711680 is pure BLUE, not red. This is the decoder the
 * palette has to satisfy; reading those reals as RGB is what inverts a
 * recolour, and it is the mistake that put $FF4E44 in this file.
 */
const packedToRgb = (n) => [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF];

const idle = { left: false, right: false, up: false, down: false, focus: false };
const HEADINGS = [0, 45, 90, 135, 180, 225, 270, 315];
const BLUE = [0x00, 0x00, 0xFF];

const failures = [];
function assert(cond, msg) {
  if (!cond) failures.push(msg);
}
function eq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Minimal bullet-phase state: a static soul, no board, clock held high. */
function makeState({ seed = 7, turntimer = 100000, kaizo = null, soulX = 314, soulY = 162 } = {}) {
  const state = createState({ seed, traceBulletSlots: 0 });
  state.phase = 'bullets';
  state.turntimer = turntimer;
  state.damageEnabled = false; // oracle-parity switch: contact without damage
  if (kaizo) state.kaizo = kaizo;
  state.soul = spawn(state, soul, { x: soulX, y: soulY });
  return state;
}

function launch(state, manager, variant, { damage, chainedType = null } = {}) {
  const mg = spawn(state, manager, { x: 320, y: state.view.y });
  mg.variant = variant;
  if (damage !== undefined) mg.damage = damage;
  manager.init(mg, state, chainedType);
  return mg;
}

/** Step `frames`, recording each obj_tracking_sword1 once as it appears. */
function runCollect(state, frames, { name = 'obj_tracking_sword1' } = {}) {
  const seen = new Set();
  const out = [];
  for (let f = 0; f < frames; f++) {
    stepFrame(state, idle);
    for (const s of state.entities) {
      if (s.alive && s.type.name === name && !seen.has(s)) {
        seen.add(s);
        out.push({ frame: state.frame - 1, dir: s.direction, entity: s });
      }
    }
  }
  return out;
}

function gaps(swords) {
  const g = [];
  for (let i = 1; i < swords.length; i++) g.push(swords[i].frame - swords[i - 1].frame);
  return g;
}

// ── 1. the Other_10 variant table ──────────────────────────────────────────
{
  const TABLE = [
    // variant, rate, decay, min, maxswords, msMax, msFrames, string?, frostveil?
    [0, 32, 4, 16, 99, 0, 0, false, false],
    [3, 20, 4, 13, 99, 0, 0, false, false],
    [3.1, 18, 4, 13, 99, 0, 0, false, false],
    [4, 24, 0, 24, 99, 2, 4, true, false],
    [5, 32, 4, 16, 99, 2, 2, false, false],
    [6, 64, 2, 16, 99, 0, 0, true, false],
    [6.1, 40, 2, 30, 99, 0, 0, true, false],
    [7, 32, 2, 16, 99, 0, 0, true, false],
    [7.1, 9999, 0, 9999, 99, 0, 0, true, false],
    [7.2, 26, 2, 14, 99, 0, 0, true, false],
    [8, 32, 4, 16, 99, 0, 0, true, false],
    [10, 26, 4, 14, 99, 0, 0, false, false],
    [11, 13, 0, 13, 9999, 9999, 2, false, true],
  ];
  for (const [v, rate, decay, min, maxs, msMax, msFrames, str, frost] of TABLE) {
    const st = makeState();
    const mg = launch(st, kzManager, v);
    assert(mg.rate === rate, `v${v}: rate ${mg.rate} != ${rate}`);
    assert(mg.ratedecay === decay, `v${v}: ratedecay ${mg.ratedecay} != ${decay}`);
    assert(mg.rateminimum === min, `v${v}: rateminimum ${mg.rateminimum} != ${min}`);
    assert(mg.maxswords === maxs, `v${v}: maxswords ${mg.maxswords} != ${maxs}`);
    assert(mg.multiswordmax === msMax, `v${v}: multiswordmax ${mg.multiswordmax} != ${msMax}`);
    assert(mg.multiswordframes === msFrames, `v${v}: multiswordframes ${mg.multiswordframes} != ${msFrames}`);
    assert(mg.timer === mg.rate - 5, `v${v}: timer ${mg.timer} != rate-5`);
    assert(mg.shoutouttofrostveil === (frost ? 1 : 0), `v${v}: shoutouttofrostveil ${mg.shoutouttofrostveil}`);
    assert(mg.setdirection.length === 200, `v${v}: setdirection has ${mg.setdirection.length} slots, not 200`);
    if (str) {
      for (let i = 1; i <= 22; i++) {
        const want = i % 2 === 1 ? 90 : 270;
        assert(mg.setdirection[i] === want, `v${v}: setdirection[${i}] ${mg.setdirection[i]} != ${want}`);
      }
      assert(mg.setdirection[23] === -1, `v${v}: setdirection[23] should stay -1`);
    } else if (v !== 2) {
      assert(mg.setdirection[1] === -1, `v${v}: setdirection[1] should stay -1`);
    }
  }
  // The B-Side retune of variant 4 (Other_10 lines 65-69), read at init.
  const sb = makeState({ kaizo: { sideb: true } });
  const mg4 = launch(sb, kzManager, 4);
  assert(mg4.multiswordframes === 12 && mg4.multiswordmax === 99,
    `v4 sideb: ms ${mg4.multiswordframes}/${mg4.multiswordmax} != 12/99`);
}

// ── 2a. variant 3.1 cadence differs from 3 ─────────────────────────────────
{
  const s31 = makeState({ seed: 11 });
  launch(s31, kzManager, 3.1);
  const g31 = gaps(runCollect(s31, 80));
  assert(eq(g31.slice(0, 3), [14, 13, 13]), `v3.1 gaps ${g31.slice(0, 3)} != 14,13,13`);

  const s3 = makeState({ seed: 11 });
  launch(s3, kzManager, 3);
  const g3 = gaps(runCollect(s3, 80));
  assert(eq(g3.slice(0, 3), [16, 13, 13]), `v3 gaps ${g3.slice(0, 3)} != 16,13,13`);
  assert(g31[0] !== g3[0], 'v3.1 must differ from v3 (second spawn gap)');
}

// ── 2b/3. variant 4: pairs vs the B-Side chain; the up-down string ─────────
{
  const s4 = makeState({ seed: 5 });
  launch(s4, kzManager, 4);
  const swords = runCollect(s4, 420);
  const g4 = gaps(swords);
  for (let i = 0; i < 8; i++) {
    const want = i % 2 === 0 ? 4 : 24;
    assert(g4[i] === want, `v4 gap[${i}] ${g4[i]} != ${want} (pair rhythm)`);
  }
  for (let i = 0; i < 22; i++) {
    const want = i % 2 === 0 ? 90 : 270;
    assert(swords[i].dir === want, `v4 sword ${i} dir ${swords[i].dir} != ${want} (string)`);
  }
  assert(swords.length > 22, 'v4: need swords past the 22-slot string');
  for (let i = 22; i < swords.length; i++) {
    assert(HEADINGS.includes(swords[i].dir),
      `v4 sword ${i} dir ${swords[i].dir} not a rolled octant after the string`);
  }

  const sb = makeState({ seed: 5, kaizo: { sideb: true } });
  launch(sb, kzManager, 4);
  const gb = gaps(runCollect(sb, 200));
  assert(gb.length >= 8 && gb.slice(0, 8).every((g) => g === 12),
    `v4 sideb gaps ${gb.slice(0, 8)} != all 12 (endless chain)`);
}

// ── 2c. variant 5 pairs on the vanilla-0 decay ─────────────────────────────
{
  const s5 = makeState({ seed: 9 });
  launch(s5, kzManager, 5);
  const g5 = gaps(runCollect(s5, 200));
  assert(eq(g5.slice(0, 6), [2, 24, 2, 16, 2, 16]),
    `v5 gaps ${g5.slice(0, 6)} != 2,24,2,16,2,16`);
}

// ── 4/5. variant 10: sword override, fast slash, and the recolour ──────────
{
  const s10 = makeState({ seed: 3 });
  launch(s10, kzManager, 10);
  const sw = runCollect(s10, 10)[0];
  assert(sw, 'v10: no sword spawned');
  assert(sw.entity.fadetohalftime === 5 && sw.entity.waittime === 5
    && sw.entity.fadetofulltime === 10 && sw.entity.flashtime === 4,
    `v10 sword timeline ${sw.entity.fadetohalftime}/${sw.entity.waittime}/${sw.entity.fadetofulltime}/${sw.entity.flashtime} != 5/5/10/4`);
  assert(sw.entity.len === 88 && sw.entity.lenstart === 88,
    `v10 sword len ${sw.entity.len}/${sw.entity.lenstart} != 88`);

  // Slash arrives 24 frames after the sword appears (vanilla timeline: 39 —
  // the delta spec's "24f telegraph instead of 39f"; each con transition
  // falls through into the next block the same step, so 5/5/10/4 lands at
  // 24, not the naive 27).
  const slashDelay = (state, manager, variant) => {
    const st = makeState({ seed: 3 });
    launch(st, manager, variant);
    let swordFrame = -1;
    let slashFrame = -1;
    for (let f = 0; f < 90 && slashFrame < 0; f++) {
      stepFrame(st, idle);
      for (const e of st.entities) {
        if (e.type.name === 'obj_tracking_sword1' && swordFrame < 0) swordFrame = st.frame - 1;
        if (e.type.name === 'obj_tracking_sword_slash' && slashFrame < 0) slashFrame = st.frame - 1;
      }
    }
    return slashFrame - swordFrame;
  };
  assert(slashDelay(null, kzManager, 10) === 24, 'v10: slash should land 24 frames after the sword');
  assert(slashDelay(null, kzManager, 0) === 39, 'v0: slash should land 39 frames after the sword');

  // Lock-on colour is get_swordcolor, not c_red: blue by default…
  const lockBlend = (kaizo) => {
    const st = makeState({ seed: 3, kaizo });
    launch(st, kzManager, 10);
    let sword = null;
    for (let f = 0; f < 60; f++) {
      stepFrame(st, idle);
      for (const e of st.entities) {
        if (e.type.name === 'obj_tracking_sword1' && !sword) sword = e;
      }
      if (sword && sword.con === 2) return sword.image_blend;
    }
    return null;
  };
  assert(eq(lockBlend(null), BLUE), `v10 lock blend ${JSON.stringify(lockBlend(null))} != blue`);
  // …and the swordtype-1 cosmetic row selects its own colour.
  //
  // EXPECTATION CORRECTED. This asserted [0x44, 0x4E, 0xFF] against the
  // module's own private copy of the palette, and BOTH were wrong: the dump
  // returns 16732740 for swordtype 1 (scr_complete_save_file.gml:274), and
  // 16732740 = $FF5244, i.e. B 255 / G 0x52 / R 0x44 -> [68, 82, 255]. The
  // old pair agreed with each other and with nothing else, which is what a
  // duplicated table buys you. tracking-swords.js now imports the shared
  // kaizo-colors.js, so assert against THAT — and against the decimal from
  // the dump, so the shared table cannot drift either.
  assert(eq(lockBlend({ swordtype: 1 }), [68, 82, 255]),
    `swordtype 1 lock blend ${JSON.stringify(lockBlend({ swordtype: 1 }))} != $FF5244`);
  assert(eq(lockBlend({ swordtype: 1 }), SWORDCOLORS[1]),
    'swordtype 1 lock blend is the SHARED kaizo-colors row, not a local copy');
  assert(eq(SWORDCOLORS[1], packedToRgb(16732740))
    && eq(SWORDCOLORS[2], packedToRgb(16743013))
    && eq(SWORDCOLORS[3], packedToRgb(16749461))
    && eq(SWORDCOLORS.default, packedToRgb(16711680)),
    'the shared palette decodes get_swordcolor()\'s four BGR reals exactly');

  // The FOURTH fade window (5b covers 30 / 20 / 19): variant 10 runs the ramp
  // over 15, pairing with its 5/5/10/4 timeline. Sampled mid-ramp, where 15
  // and the default 30 give visibly different colours — asserting only the
  // finished lock colour above would pass at either rate.
  const blendAt = (variant, wantTimer) => {
    const st = makeState({ seed: 3 });
    launch(st, kzManager, variant);
    let sword = null;
    for (let f = 0; f < 80; f++) {
      stepFrame(st, idle);
      for (const e of st.entities) {
        if (e.type.name === 'obj_tracking_sword1' && !sword) sword = e;
      }
      if (sword && sword.con === 1 && sword.timer === wantTimer) return sword.image_blend;
    }
    return null;
  };
  assert(eq(blendAt(10, 7), mergeColor(WHITE, BLUE, 7 / 15)),
    `v10 fade at timer 7 ${JSON.stringify(blendAt(10, 7))} != merge(white, blue, 7/15)`);
  assert(!eq(blendAt(10, 7), mergeColor(WHITE, BLUE, 7 / 30)),
    'v10 must NOT run the default 30-frame ramp');
}

// ── 5b. the fade-time gates: 30 plain / 20 over a rotating slash / 19 B-Side ─
{
  const blendAtTimer19 = (withSlash, sideb) => {
    const st = makeState({ seed: 3, kaizo: sideb ? { sideb: true } : null });
    if (withSlash) spawn(st, { name: 'obj_knight_rotating_slash' }, { x: 320, y: 170 });
    launch(st, kzManager, 0);
    let sword = null;
    for (let f = 0; f < 80; f++) {
      stepFrame(st, idle);
      for (const e of st.entities) {
        if (e.type.name === 'obj_tracking_sword1' && !sword) sword = e;
      }
      if (sword && sword.con === 1 && sword.timer === 19) return sword.image_blend;
    }
    return null;
  };
  assert(eq(blendAtTimer19(false, false), mergeColor(WHITE, BLUE, 19 / 30)),
    'plain fade at timer 19 != merge(white, blue, 19/30)');
  assert(eq(blendAtTimer19(true, false), mergeColor(WHITE, BLUE, 19 / 20)),
    'rotating-slash fade at timer 19 != merge(white, blue, 19/20)');
  assert(eq(blendAtTimer19(true, true), mergeColor(WHITE, BLUE, 19 / 19)),
    'B-Side rotating-slash fade at timer 19 != merge(white, blue, 1)');
  assert(!eq(blendAtTimer19(true, false), blendAtTimer19(false, false)),
    'the rotating-slash gate must change the ramp');
}

// ── 6. frostveil (variant 11) ──────────────────────────────────────────────
{
  const st = makeState({ seed: 13, soulX: 100, soulY: 160 });
  const gt = spawn(st, { name: 'obj_growtangle' }, { x: 500, y: 170 });
  const mg = launch(st, kzManager, 11);
  const draws0 = st.gmlRng.draws ?? 0;
  const swords = [];
  const seen = new Set();
  const birthPos = new Map(); // end of the SPAWN frame (manager reposition)
  const firstStepPos = new Map(); // end of the first STEP frame (re-anchor)
  for (let f = 0; f < 40; f++) {
    stepFrame(st, idle);
    for (const s of st.entities) {
      if (s.type.name !== 'obj_tracking_sword1') continue;
      if (s.alive && !seen.has(s)) {
        seen.add(s);
        swords.push({ frame: st.frame - 1, dir: s.direction, entity: s });
        birthPos.set(s, { x: s.x, y: s.y });
      } else if (seen.has(s) && !firstStepPos.has(s) && s.timer >= 1) {
        firstStepPos.set(s, { x: s.x, y: s.y });
      }
    }
  }
  assert((st.gmlRng.draws ?? 0) === draws0,
    `frostveil consumed ${(st.gmlRng.draws ?? 0) - draws0} rng draws (must be 0)`);
  assert(swords.length >= 10, `frostveil spawned only ${swords.length} swords in 40 frames`);
  const g11 = gaps(swords);
  assert(g11.slice(0, 8).every((g) => g === 2), `frostveil gaps ${g11.slice(0, 8)} != all 2`);
  for (let i = 0; i < Math.min(10, swords.length); i++) {
    const want = (270 + 20 * i) % 360;
    assert(swords[i].dir === want, `frostveil sword ${i} dir ${swords[i].dir} != ${want}`);
    assert(swords[i].entity.anomaly === 1, `frostveil sword ${i} anomaly != 1`);
  }
  assert(mg.anomalydir === 270 + 20 * swords.length,
    `anomalydir ${mg.anomalydir} != 270 + 20*${swords.length}`);
  // Birth anchor is the HEART (manager reposition, kaizo Step_0 112-118)…
  const first = swords[0];
  const b = birthPos.get(first.entity);
  assert(Math.abs(b.x - 110) < 0.01 && Math.abs(b.y - 290) < 0.01,
    `frostveil sword born at (${b.x},${b.y}), expected heart ring (110,290)`);
  // …and its own first Step re-anchors to the growtangle ring (sword Step_0
  // lines 8-12), at len still 120: (510, clamp(170+10+120)=300).
  const p = firstStepPos.get(first.entity);
  assert(p && Math.abs(p.x - (gt.x + 10)) < 0.01,
    `frostveil sword x ${p?.x} not on the box ring (${gt.x + 10})`);
  assert(p && Math.abs(p.y - 300) < 0.01,
    `frostveil sword y ${p?.y} != 300 (box ring)`);
}

// ── 7. the extra-graze band: variant-11 TP nerf, and the 3-step lifetime ───
{
  const bandTension = (withV11Manager) => {
    const st = makeState({ seed: 17, turntimer: 60 }); // manager silent below 70
    if (withV11Manager) launch(st, kzManager, 11);
    st.invTimer = -50;
    const band = spawn(st, kzBand, { x: st.soul.x - 400, y: st.soul.y + 10 });
    band.image_angle = 0;
    const t0 = st.tension;
    stepFrame(st, idle);
    return st.tension - t0;
  };
  assert(bandTension(true) === 1, `variant-11 band graze paid ${bandTension(true)} TP, not 1`);
  assert(bandTension(false) === 7, `plain band graze paid ${bandTension(false)} TP, not 7`);

  // A band that never grazes dies after exactly 3 steps (kaizo Step_0 30-34).
  const st = makeState({ seed: 17 });
  const band = spawn(st, kzBand, { x: st.soul.x + 2000, y: st.soul.y + 2000 });
  band.image_angle = 0;
  stepFrame(st, idle);
  stepFrame(st, idle);
  assert(band.alive, 'band should still be alive after 2 steps');
  stepFrame(st, idle);
  assert(!band.alive, 'band should be destroyed on its 3rd step');
}

// ── 8. two managers: the reroll replaces the wheel ─────────────────────────
{
  let pairFrames = 0;
  let clashes = 0;
  let twoMgrNudges = 0;
  for (const seed of [21, 22, 23]) {
    const st = makeState({ seed });
    const a = launch(st, kzManager, 0);
    const b = launch(st, kzManager, 0);
    const seen = new Set();
    for (let f = 0; f < 600; f++) {
      stepFrame(st, idle);
      const born = [];
      for (const s of st.entities) {
        if (s.alive && s.type.name === 'obj_tracking_sword1' && !seen.has(s)) {
          seen.add(s);
          born.push(s.direction);
        }
      }
      if (born.length >= 2) {
        pairFrames += 1;
        if (new Set(born).size !== born.length) clashes += 1;
      }
    }
    twoMgrNudges += (a.wheelNudges ?? 0) + (b.wheelNudges ?? 0);
  }
  assert(pairFrames >= 20, `only ${pairFrames} same-frame pairs — scenario broken`);
  assert(clashes === 0,
    `${clashes}/${pairFrames} same-frame pairs shared a heading (reroll dead; chance rate ~12.5%)`);
  assert(twoMgrNudges === 0, `wheel nudged ${twoMgrNudges} times with 2 managers (must be gated off)`);

  // Single-manager control: the wheel still runs.
  let soloNudges = 0;
  for (const seed of [21, 22, 23]) {
    const st = makeState({ seed });
    const mg = launch(st, kzManager, 0);
    for (let f = 0; f < 600; f++) stepFrame(st, idle);
    soloNudges += mg.wheelNudges ?? 0;
  }
  assert(soloNudges > 0, 'single-manager wheel never nudged across 3 seeds (gate too wide)');
}

// ── 9. variant 7.1: one lead sword, then the puppet poke ───────────────────
{
  const st = makeState({ seed: 31 });
  const mg = launch(st, kzManager, 7.1);
  const swords = runCollect(st, 200);
  assert(swords.length === 1, `v7.1 spawned ${swords.length} swords in 200 frames (expect the 1 lead)`);
  assert(swords[0].dir === 90, `v7.1 lead sword dir ${swords[0].dir} != 90 (setdirection[1])`);
  // The kaizo rotating slash's poke: `with (obj_tracking_swords_manager)
  // { timer = rate - 2; }` (rotating-slash delta; simulated here).
  mg.timer = mg.rate - 2;
  const pokeFrame = st.frame; // next stepFrame runs this frame index
  const after = runCollect(st, 5);
  assert(after.length === 1, `v7.1 poke produced ${after.length} swords, not 1`);
  if (after.length === 1) {
    assert(after[0].frame === pokeFrame + 1,
      `v7.1 poked sword landed at frame ${after[0].frame}, expected ${pokeFrame + 1} (2 steps after the poke)`);
    assert(after[0].dir === 270, `v7.1 poked sword dir ${after[0].dir} != 270 (setdirection[2])`);
  }
}

// ── 10/11. damage flow, and the one-frame-tighter slash/sword ──────────────
{
  const st = makeState({ seed: 41 });
  launch(st, kzManager, 6, { damage: 153 });
  let sword = null;
  let slash = null;
  let band = null;
  for (let f = 0; f < 130; f++) {
    stepFrame(st, idle);
    for (const e of st.entities) {
      if (e.type.name === 'obj_tracking_sword1' && !sword) sword = e;
      if (e.type.name === 'obj_tracking_sword_slash' && !slash) slash = e;
      if (e.type.name === 'obj_tracking_sword_slash_extra_graze' && !band) band = e;
    }
  }
  assert(sword && sword.damage === 153, `v6 sword damage ${sword?.damage} != 153`);
  assert(sword && sword.direction === 90, `v6 first sword dir ${sword?.direction} != 90 (string)`);
  assert(slash && slash.damage === 153, `v6 slash damage ${slash?.damage} != 153 (override flow)`);
  assert(slash && band && slash.image_angle === band.image_angle,
    'slash and graze band should share an angle');

  // Lifetimes, relative to the sim module on the same seed: one frame less.
  const firstLifetimes = (manager) => {
    const s = makeState({ seed: 43 });
    launch(s, manager, 0);
    let sw = null;
    let sl = null;
    let swFrames = 0;
    let slFrames = 0;
    for (let f = 0; f < 130; f++) {
      stepFrame(s, idle);
      for (const e of s.entities) {
        if (e.type.name === 'obj_tracking_sword1' && !sw) sw = e;
        if (e.type.name === 'obj_tracking_sword_slash' && !sl) sl = e;
      }
      if (sw && sw.alive) swFrames += 1;
      if (sl && sl.alive) slFrames += 1;
    }
    return { swFrames, slFrames };
  };
  const kz = firstLifetimes(kzManager);
  const sim = firstLifetimes(simManager);
  assert(kz.slFrames === sim.slFrames - 1,
    `kaizo slash alive ${kz.slFrames} boundaries vs sim ${sim.slFrames} (must be one less)`);
  assert(kz.swFrames === sim.swFrames - 1,
    `kaizo sword alive ${kz.swFrames} boundaries vs sim ${sim.swFrames} (must be one less)`);
}

// ── 12. copy fidelity: vanilla variants match the sim module exactly ───────
{
  for (const variant of [0, 2, 3]) {
    const run = (manager) => {
      const s = makeState({ seed: 51 });
      launch(s, manager, variant);
      return runCollect(s, 400).map(({ frame, dir }) => ({ frame, dir }));
    };
    const a = run(kzManager);
    const b = run(simManager);
    assert(a.length > 5, `fidelity v${variant}: too few swords (${a.length})`);
    assert(eq(a, b), `fidelity v${variant}: kaizo and sim sword sequences diverge\n`
      + `  kaizo ${JSON.stringify(a.slice(0, 6))}\n  sim   ${JSON.stringify(b.slice(0, 6))}`);
  }
}

// ── report ─────────────────────────────────────────────────────────────────
if (failures.length) {
  for (const f of failures) console.log(`→ FAILURE  ${f}`);
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log('PASS  kaizo tracking-swords: variant table, cadences, string, v10, '
  + 'recolour gates, frostveil, band TP/lifetime, reroll, 7.1 puppet, damage flow, '
  + 'lifetimes, and sim fidelity (no oracle — see header)');
