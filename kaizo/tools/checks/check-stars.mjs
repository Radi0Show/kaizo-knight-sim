#!/usr/bin/env node
// CHECK — kaizo/attacks/stars-* (the mod's type-98 Stars rework).
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// POSITIVE assertions on every branch the kaizo deltas add, so a check that
// still passes with a branch deleted does not exist here:
//   * the 33-frame first-star cadence (vs the vanilla sim module, twinned)
//   * the starexp/starry schedules per difficulty and B-Side, and the
//     stay-star behaviour (never recalled, the Draw-block easing)
//   * the turntimer bonus rework (+90, 3.2/3.3 excluded) and endtimer rule
//   * the blast tables (tripods / pentagons / default 6), child speeds
//     4.5 / 4.75, the 3.3 split_blast decoys and +0.35 scale
//   * the delay chain gated on the type-98 controller, delays [25,26,27,...]
//   * delay = 0 at 3.2/3.3 (children never home)
//   * the 3.3 parked shrink (a single -0.01 on the speed==0 arm frame — the
//     gravity arm makes speed nonzero the next motion phase, so the GML
//     block fires once per star; asserted against a flat d1 control)
//   * the widened fade gate (difficulty 2 now fades; 3.3 fades off B-Side
//     only) — twinned against the vanilla module where the delta is a
//     "now happens vs never happens".
//
//     node kaizo/tools/checks/check-stars.mjs        (exit 0/1)

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox, settleBox } from '../../../sim/battlebox.js';
import { BOX, SOUL_START } from '../../../sim/actors.js';
import { gmlCreate, gmlChoose, gmlRandom } from '../../../sim/rng.js';
import { gmlEq, mergeColor, GRAY, clamp01 } from '../../../sim/gml.js';
// THE SHARED PALETTE. Asserted against here rather than re-derived, so a
// module that grows a private copy is caught by the identity checks below.
import { getSwordcolor, KAIZO_TELEGRAPH_COLOR } from '../../attacks/kaizo-colors.js';

/** [r,g,b] equality — blends are arrays in this engine, packed reals in GML. */
const eqRgb = (a, b) => Array.isArray(a) && Array.isArray(b)
  && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
import {
  launchKaizoStars,
  kaizoStarsEndtimer,
  CONE_POS,
} from '../../attacks/stars-controller.js';
import { starsController as vanillaStars } from '../../../sim/attacks/stars-controller.js';
import { pointingCone as vanillaCone } from '../../../sim/attacks/pointing-cone.js';

let failures = 0;
let checks = 0;
function ok(cond, msg) {
  checks += 1;
  if (cond) {
    console.log(`  ok   ${msg}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${msg}`);
  }
}

function buildBase(seed, sideb) {
  const state = createState({ seed });
  state.kaizo = { sideb };
  state.keepAlive = true; // party stands back up; the run never stalls on a wipe
  state.invTimer = -1;
  state.gmlRng = gmlCreate(seed);
  state.turntimer = 300; // scr_turntimer's default floor, decremented per frame below
  settleBox(spawn(state, battlebox, { x: BOX.x, y: BOX.y }));
  state.soul = spawn(state, soul, { ...SOUL_START });
  return state;
}

/** fight.js case 1, verbatim, for the VANILLA twin scenes. */
function launchVanillaStars(state, difficulty) {
  const endtimer = difficulty >= 2 ? 210 : 120;
  const dc = spawn(state, vanillaStars, { ...CONE_POS });
  dc.difficulty = difficulty;
  dc.endtimer = endtimer;
  const cone = spawn(state, vanillaCone, { ...CONE_POS });
  cone.difficulty = difficulty;
  cone.con = 1;
  cone.endtimer = endtimer;
  if (difficulty === 0 && state.gmlRng) dc.side = gmlChoose(state.gmlRng, [-1, 1]);
  if (state.gmlRng) for (let pad = 0; pad < 2; pad++) gmlRandom(state.gmlRng, 1);
  return dc;
}

/**
 * Run `frames` frames, watching every pointing star and starchild. Rows are
 * sampled AFTER each stepFrame (post-endStep, the frame's settled state).
 */
function observe(state, frames) {
  const stars = new Map();
  const children = new Map();
  let releaseFrame = -1;
  let turntimerAfterF0 = null;

  for (let f = 0; f < frames; f++) {
    stepFrame(state, {});
    for (const e of state.entities) {
      if (!e.alive) continue;
      if (e.type.name === 'obj_knight_pointing_star') {
        let rec = stars.get(e.seq);
        if (!rec) {
          rec = {
            spawnFrame: f,
            starry: e.starry,
            ref: e,
            conMax: 0,
            sawStay: false,
            con2Xscale: [], // image_xscale while con == 2 (the parked window)
            staySamples: [], // { growspeed, timer, speed } while stay == 1
            blends: [], // image_blend, the mod's charge tint
            stayBlends: [], // image_blend while stay == 1 (the white-based ramp)
          };
          stars.set(e.seq, rec);
        }
        rec.conMax = Math.max(rec.conMax, e.con ?? 0);
        // The whole life, not a prefix: a star sits at con 0 / timer 0 for its
        // first 40-odd frames, so a short window only ever samples flat c_gray.
        if (rec.blends.length < 400) rec.blends.push(e.image_blend);
        if (e.stay === 1) {
          rec.sawStay = true;
          if (rec.stayBlends.length < 400) rec.stayBlends.push(e.image_blend);
          if (rec.staySamples.length < 8) {
            rec.staySamples.push({ growspeed: e.growspeed, timer: e.timer, speed: e.speed });
          }
        }
        if ((e.con ?? 0) === 2) rec.con2Xscale.push(e.image_xscale);
        if (releaseFrame < 0 && ((e.con ?? 0) >= 1 || e.stay === 1)) releaseFrame = f;
      } else if (e.type.name === 'obj_knight_pointing_starchild') {
        let rec = children.get(e.seq);
        if (!rec) {
          rec = {
            spawnFrame: f,
            dir0: e.direction,
            speed0: e.speed,
            xscale0: e.image_xscale,
            difficulty: e.difficulty,
            lifetime: e.lifetime,
            delay: null,
            conMax: 0,
            sawFade: false,
            blends: [], // image_blend, the coltimer tint scheme
            coltimers: [],
            outlines: [], // the con==1 flip overlay
          };
          children.set(e.seq, rec);
        }
        if (rec.blends.length < 80) {
          rec.blends.push(e.image_blend);
          rec.coltimers.push(e.coltimer);
          rec.outlines.push({ con: e.con, outline: e.outline });
        }
        if (rec.delay === null && f > rec.spawnFrame) rec.delay = e.delay;
        rec.conMax = Math.max(rec.conMax, e.con ?? 0);
        if ((e.image_alpha ?? 1) < 1 && (e.image_alpha ?? 1) > 0) rec.sawFade = true;
      }
    }
    if (f === 0) turntimerAfterF0 = state.turntimer;
    if (state.turntimer > 0) state.turntimer -= 1;
  }
  return { stars, children, releaseFrame, turntimerAfterF0 };
}

function runKaizo(difficulty, { sideb = false, seed = 12345, frames = 560 } = {}) {
  const state = buildBase(seed, sideb);
  launchKaizoStars(state, difficulty);
  return { state, ...observe(state, frames) };
}

function runVanilla(difficulty, { seed = 12345, frames = 560 } = {}) {
  const state = buildBase(seed, false);
  launchVanillaStars(state, difficulty);
  return { state, ...observe(state, frames) };
}

const starSeqs = (r) => [...r.stars.keys()].sort((a, b) => a - b);
const childSeqs = (r) => [...r.children.keys()].sort((a, b) => a - b);
const firstStarFrame = (r) => r.stars.get(starSeqs(r)[0]).spawnFrame;
const starryPattern = (r, n) => starSeqs(r).slice(0, n).map((s) => r.stars.get(s).starry);
const spawnGaps = (r, n) => {
  const fs = starSeqs(r).slice(0, n).map((s) => r.stars.get(s).spawnFrame);
  const gaps = [];
  for (let i = 1; i < fs.length; i++) gaps.push(fs[i] - fs[i - 1]);
  return gaps;
};
/** children grouped by spawn frame (one star's burst lands on one frame). */
function bursts(r) {
  const by = new Map();
  for (const seq of childSeqs(r)) {
    const rec = r.children.get(seq);
    if (!by.has(rec.spawnFrame)) by.set(rec.spawnFrame, []);
    by.get(rec.spawnFrame).push(rec);
  }
  return [...by.values()];
}
const setEq = (arr, set) => arr.length === set.length
  && [...arr].sort((a, b) => a - b).join(',') === [...set].sort((a, b) => a - b).join(',');
/** diffs of consecutive samples */
const diffs = (xs) => xs.slice(1).map((v, i) => v - xs[i]);

const DEFAULT6 = [90, 147, 213, 270, 327, 33];
const TRIPODS = [[90, 213, 327], [147, 270, 33]];
const PENTAGONS = [[0, 72, 144, 216, 288], [36, 108, 180, 252, 324]];

// ── 0. the endtimer rule ───────────────────────────────────────────────────
console.log('kaizoStarsEndtimer');
ok(kaizoStarsEndtimer(0) === 120 && kaizoStarsEndtimer(1) === 120,
  'd0/d1 endtimer 120');
ok(kaizoStarsEndtimer(2) === 210 && kaizoStarsEndtimer(3) === 210
  && kaizoStarsEndtimer(3.1) === 210,
  'd2/d3/d3.1 endtimer 210 (the +90 bonus)');
ok(kaizoStarsEndtimer(3.2) === 120 && kaizoStarsEndtimer(3.3) === 120,
  'd3.2/d3.3 EXCLUDED from the bonus (endtimer 120)');

// ── 1. d1 — cadence vs the vanilla module, all-explode override ────────────
console.log('difficulty 1 (vs vanilla twin)');
{
  const k = runKaizo(1);
  const v = runVanilla(1);
  ok(firstStarFrame(k) === firstStarFrame(v) - 12,
    `first star 12 frames sooner than vanilla (btimer >= 33 vs 45): kaizo f${firstStarFrame(k)}, vanilla f${firstStarFrame(v)}`);
  ok(spawnGaps(k, 6).every((g) => g === 4),
    `follow-up cadence unchanged (every 4 frames): gaps ${spawnGaps(k, 6).join(',')}`);
  ok(k.turntimerAfterF0 === 300 + 30 && v.turntimerAfterF0 === 300 + 30,
    'd1 turn bonus unchanged (+30 base only, both builds)');
  const pat = starryPattern(k, 8);
  ok(pat.length >= 6 && pat.every((s) => s === 1),
    `d1: EVERY star explodes (starry ${pat.join(',')})`);
  ok(![...k.stars.values()].some((s) => s.sawStay),
    'd1: no star is ever flagged stay');
  ok(k.releaseFrame > 0 && [...k.stars.values()].some((s) => s.conMax >= 3),
    `d1: release happened (f${k.releaseFrame}) and stars burst`);
  const kids = [...k.children.values()];
  ok(kids.length > 0 && kids.every((c) => c.speed0 === 4.5),
    `d1 children at 4.5 (vanilla 4): ${kids.length} children`);
}

// ── 2. d0 — the %3 starexp schedule and the stay stars ─────────────────────
console.log('difficulty 0');
{
  const k = runKaizo(0, { frames: 420 });
  const pat = starryPattern(k, 9);
  ok(pat.length >= 6 && pat.every((s, i) => s === ((i + 1) % 3 >= 1 ? 1 : 0)),
    `d0 starexp = 2 of every 3 (starid %3): ${pat.join(',')}`);
  const stays = [...k.stars.values()].filter((s) => s.sawStay);
  ok(stays.length >= 1, `d0: ${stays.length} star(s) flagged stay at the release`);
  ok(stays.every((s) => s.conMax === 0),
    'stay stars are never recalled (con stays 0)');
  // The Draw block, sampled per frame while stay == 1: growspeed eases
  // toward 0 at 0.0005/frame, speed toward 2.2 at 0.01/frame (f32 store),
  // timer advances once per Draw.
  const st = stays.find((s) => s.staySamples.length >= 5);
  ok(!!st, 'a stay star lived 5+ frames past the release for sampling');
  if (st) {
    const g = diffs(st.staySamples.map((x) => x.growspeed));
    ok(g.every((d) => Math.abs(d + 0.0005) < 1e-9),
      `stay star growspeed eases -0.0005/frame (${g[0].toFixed(6)})`);
    const t = diffs(st.staySamples.map((x) => x.timer));
    ok(t.every((d) => d === 1),
      'stay star timer advances once per Draw slot');
    const sp = st.staySamples.map((x) => x.speed);
    ok(sp[0] > 2.2 && diffs(sp).every((d) => Math.abs(d + 0.01) < 1e-3),
      `stay star speed eases toward 2.2 at -0.01/frame (from ${sp[0].toFixed(3)})`);
  }
  const kids = [...k.children.values()];
  ok(kids.length > 0 && kids.every((c) => c.speed0 === 4.5),
    'd0 children ALL at 4.5 — vanilla\'s slow-odd-child rule (speed 1) is GONE');
  ok(kids.every((c) => DEFAULT6.includes(c.dir0)),
    'd0 blast directions from the fixed table [90,147,213,270,327,33]');
  const b = bursts(k).filter((g) => g.length === 6);
  ok(b.length >= 1, `d0 bursts of 6 (${b.length} clean bursts)`);
}

// ── 3. d3 — turn bonus, tripods, homers, the delay chain ───────────────────
console.log('difficulty 3');
{
  const k = runKaizo(3);
  ok(k.turntimerAfterF0 === 300 + 30 + 90,
    `d3 turn bonus +90 (vanilla +60): turntimer ${k.turntimerAfterF0} after f0`);
  const pat = starryPattern(k, 9);
  ok(pat.length >= 6 && pat.every((s, i) => s === ((i + 1) % 3 >= 1 ? 1 : 0)),
    `d3 starexp default %3 schedule: ${pat.join(',')}`);
  const groups = bursts(k).filter((g) => g.length === 3);
  ok(groups.length >= 2, `d3 bursts of 3 (${groups.length} clean tripod bursts)`);
  ok(groups.every((g) => TRIPODS.some((t) => setEq(g.map((c) => c.dir0), t))),
    'each d3 burst is one of the two tripods [90,213,327]/[147,270,33]');
  const kids = childSeqs(k).map((s) => k.children.get(s));
  ok(kids.length > 0 && kids.every((c) => c.difficulty === 3 && c.speed0 === 4.5),
    'd3 children: difficulty 3, speed 4.5');
  const delays = kids.slice(0, 6).map((c) => c.delay);
  const expect = [25, 26, 27, 28, 29, 34].slice(0, delays.length);
  ok(delays.length >= 3 && delays.join(',') === expect.join(','),
    `delay chain through the type-98 controller: [${delays.join(',')}] (expect [${expect.join(',')}])`);
  ok(kids.some((c) => c.conMax >= 2),
    'd3 children HOME (the chain gate passed; con reaches 2+)');
  ok(!kids.some((c) => c.sawFade),
    'd3 children never fade (difficulty 3 outside the widened gate)');
}

// ── 4. d3.1 — pentagons off B-Side, default table on it, 4.75 both ─────────
console.log('difficulty 3.1');
{
  const n = runKaizo(3.1);
  const s = runKaizo(3.1, { sideb: true });
  for (const [r, name, want] of [[n, 'normal', 5], [s, 'B-Side', 6]]) {
    const pat = starryPattern(r, 8);
    ok(pat.length >= 6 && pat.every((v, i) => v === ((i + 1) % 2 >= 1 ? 1 : 0)),
      `3.1 ${name}: starexp = every 2nd star (${pat.join(',')})`);
    const groups = bursts(r).filter((g) => g.length === want);
    ok(groups.length >= 2, `3.1 ${name}: bursts of ${want} (${groups.length} clean)`);
    const kids = [...r.children.values()];
    ok(kids.length > 0 && kids.every((c) => c.speed0 === 4.75),
      `3.1 ${name}: children at 4.75`);
    if (name === 'normal') {
      ok(groups.every((g) => PENTAGONS.some((t) => setEq(g.map((c) => c.dir0), t))),
        '3.1 normal: each burst is one of the two pentagons');
    } else {
      ok(groups.every((g) => setEq(g.map((c) => c.dir0), DEFAULT6)),
        '3.1 B-Side: keeps the 6-beam default table (no pentagon choose draw)');
    }
  }
}

// ── 5. d3 on the B-Side — the %4 schedule ──────────────────────────────────
console.log('difficulty 3, B-Side');
{
  const k = runKaizo(3, { sideb: true });
  const pat = starryPattern(k, 8);
  ok(pat.length >= 8 && pat.every((s, i) => s === ((i + 1) % 4 >= 1 ? 1 : 0)),
    `sideb non-3.1 starexp = 3 of every 4 (starid %4): ${pat.join(',')}`);
}

// ── 6. d3.2 — configured-but-undispatched tier, straight shots ─────────────
console.log('difficulty 3.2');
{
  const k = runKaizo(3.2);
  ok(k.turntimerAfterF0 === 300 + 30,
    `d3.2 excluded from the +90 turn bonus (turntimer ${k.turntimerAfterF0})`);
  const groups = bursts(k).filter((g) => g.length === 3);
  ok(groups.length >= 2
    && groups.every((g) => TRIPODS.some((t) => setEq(g.map((c) => c.dir0), t))),
    'd3.2 bursts: tripods, like d3');
  const kids = [...k.children.values()];
  ok(kids.length > 0 && kids.every((c) => c.delay === 0),
    'd3.2 children: delay forced to 0');
  ok(kids.every((c) => c.conMax === 0),
    'd3.2 children NEVER home (delay 0 never arms the con-0 wait)');
  ok(!kids.some((c) => c.sawFade),
    'd3.2 children never fade (outside the widened gate)');
}

// ── 7. d3.3 — split_blast, cadence, shrink, fade split ─────────────────────
console.log('difficulty 3.3');
{
  const k = runKaizo(3.3);
  ok(k.turntimerAfterF0 === 300 + 30,
    `d3.3 excluded from the +90 turn bonus (turntimer ${k.turntimerAfterF0})`);
  ok(spawnGaps(k, 6).every((g) => g === 5),
    `d3.3 cadence: btimer = -1 makes it every 5 frames (gaps ${spawnGaps(k, 6).join(',')})`);
  const pat = starryPattern(k, 8);
  ok(pat.length >= 6 && pat.every((s) => s === 1),
    `d3.3: EVERY star explodes (${pat.join(',')})`);
  // The parked shrink. The GML block fires on the one frame the star sits at
  // speed exactly 0 (the gravity it arms makes speed 0.1 the next motion
  // phase), so a star that RIDES OUT con 2 shows a SINGLE -0.01 step in its
  // xscale trace. Stars culled offscreen mid-brake never park — filter to
  // the ones sampled through the full window. d1 control: perfectly flat.
  const parked = [...k.stars.values()].filter((s) => s.con2Xscale.length >= 20);
  ok(parked.length >= 3, `d3.3: ${parked.length} star(s) rode out con 2 for sampling`);
  ok(parked.length >= 3 && parked.every((s) => {
    const dd = diffs(s.con2Xscale);
    const steps = dd.filter((d) => Math.abs(d + 0.01) < 1e-4);
    const flats = dd.filter((d) => d === 0);
    return steps.length === 1 && steps.length + flats.length === dd.length;
  }), 'every full-window d3.3 star shows exactly one -0.01 shrink step');
  ok([...k.stars.values()].every((s) => diffs(s.con2Xscale)
    .every((d) => d === 0 || Math.abs(d + 0.01) < 1e-4)),
    'd3.3 con-2 xscale only ever moves by the -0.01 shrink');
  const control = runKaizo(1, { frames: 420 });
  const flat = [...control.stars.values()].filter((s) => s.con2Xscale.length >= 20);
  ok(flat.length >= 3 && flat.every((s) => diffs(s.con2Xscale).every((d) => d === 0)),
    'control: d1 parked stars do NOT shrink');
  // split_blast: odd-i decoys at 1.5/lifetime 30, even-i +0.35 scale.
  const groups = bursts(k).filter((g) => g.length === 6);
  ok(groups.length >= 2, `d3.3 bursts of 6 (${groups.length} clean)`);
  for (const g of groups.slice(0, 2)) {
    const slow = g.filter((c) => c.speed0 === 1.5);
    const fast = g.filter((c) => c.speed0 === 4.5);
    ok(slow.length === 3 && fast.length === 3,
      'd3.3 burst: 3 decoys at 1.5 + 3 shots at 4.5');
    ok(slow.every((c) => c.lifetime === 30),
      'd3.3 decoys: lifetime 30');
    if (slow.length && fast.length) {
      const d = fast[0].xscale0 - slow[0].xscale0;
      ok(Math.abs(d - 0.35) < 1e-3,
        `d3.3 even-i children +0.35 scale (measured +${d.toFixed(4)})`);
    }
  }
  const kids = [...k.children.values()];
  ok(kids.length > 0 && kids.every((c) => c.delay === 0 && c.conMax === 0),
    'd3.3 children: delay 0, never home');
  ok(kids.some((c) => gmlEq(c.difficulty, 3.3) && c.sawFade),
    'd3.3 (normal route) children DO fade — the widened gate\'s 3.3 arm');
  const sb = runKaizo(3.3, { sideb: true });
  const sbKids = [...sb.children.values()];
  ok(sbKids.length > 0 && !sbKids.some((c) => c.sawFade),
    'd3.3 B-Side children NEVER fade (gate excludes 3.3 on sideb)');
}

// ── 8. d2 — the fade gate now covers difficulty exactly 2 ──────────────────
console.log('difficulty 2 (fade delta vs vanilla twin)');
{
  const k = runKaizo(2);
  const v = runVanilla(2);
  const kHomers = [...k.children.values()].filter((c) => c.difficulty === 2);
  const vHomers = [...v.children.values()].filter((c) => c.difficulty === 2);
  ok(kHomers.length > 0 && vHomers.length > 0,
    `both builds burst d2 homers (kaizo ${kHomers.length}, vanilla ${vHomers.length})`);
  ok(kHomers.some((c) => c.sawFade),
    'KAIZO d2 homers fade by lifetime (difficulty <= 2 gate)');
  ok(!vHomers.some((c) => c.sawFade),
    'vanilla d2 homers never fade (control: the delta is real)');
  ok(kHomers.every((c) => c.speed0 === 4.5),
    'kaizo d2 homers launch at 4.5 (vanilla 4)');
  ok(vHomers.every((c) => c.speed0 === 4),
    'vanilla twin homers still at 4 (control)');
  // The kaizo d2 blast uses the table, not vanilla's 90+side walk.
  ok(kHomers.every((c) => DEFAULT6.includes(c.dir0)),
    'kaizo d2 directions come from the blast table');
}

// ── 9. THE BLUE RE-THEME ───────────────────────────────────────────────────
//
// Stars is where the mod's recolour is loudest — obj_knight_pointing_starchild
// alone draws ~9700 frames a run — and every assertion below fails if the
// corresponding line is deleted, because each pins a value that is only
// reachable through the mod's own colour formula. Twinned against the vanilla
// modules wherever vanilla has a competing red.
console.log('the blue re-theme (kaizo-colors.js)');
{
  // The star's charge tint: merge_color(c_gray, #86A2FF, clamp01(timer / 30))
  // — kaizo Draw l.7, replacing vanilla's merge_color(c_gray, c_red, ...).
  const k = runKaizo(2);
  const stars = [...k.stars.values()].filter((s) => s.blends.length >= 31);
  ok(stars.length > 0, 'stars observed long enough to watch the charge tint');
  const s0 = stars[0];
  ok(s0 && s0.blends.every((b) => Array.isArray(b) && b.length === 3),
    'every star frame carries an [r,g,b] image_blend');
  // Gray is 128,128,128 and the target is 134,162,255: BLUE MUST OUTRUN RED,
  // and by the end of the ramp the blue channel is pinned at 255.
  ok(s0 && s0.blends.every((b) => b[2] >= b[0]),
    'the star charge tint is blue-dominant on every frame (b >= r)');
  // A star sits at con 0 / timer 0 for most of its life, so the ramp only
  // shows once the cone releases it — take the bluest frame ACROSS the whole
  // wave rather than from one star. con 2 runs `timer` out to 40, past the
  // ramp's 30, so a released star does reach the endpoint exactly.
  const all = stars.flatMap((s) => s.blends);
  const peak = all.reduce((a, b) => (b[2] - b[0] > a[2] - a[0] ? b : a));
  ok(eqRgb(peak, KAIZO_TELEGRAPH_COLOR),
    `the star charges all the way to #86A2FF (peak ${JSON.stringify(peak)})`);
  ok(eqRgb(peak, mergeColor(GRAY, KAIZO_TELEGRAPH_COLOR, clamp01(40 / 30))),
    'exactly merge_color(c_gray, #86A2FF, clamp01(timer / 30)) — clamped at con 2\'s timer 40');
  // …and it is a ramp: intermediate values exist between gray and the endpoint.
  ok(all.some((b) => b[2] > 128 && b[2] < 255),
    'the charge is a ramp through gray, not a colour swap');

  // Reference check: the same value from the shared palette module, computed
  // independently here. If someone re-derives #86A2FF locally and gets it
  // wrong, this catches it.
  ok(eqRgb(KAIZO_TELEGRAPH_COLOR, [134, 162, 255]),
    'KAIZO_TELEGRAPH_COLOR is #86A2FF');
  ok(eqRgb(mergeColor(GRAY, KAIZO_TELEGRAPH_COLOR, 1), [134, 162, 255])
    && !eqRgb(mergeColor(GRAY, KAIZO_TELEGRAPH_COLOR, 1), [255, 0, 0]),
    'the charge endpoint is the telegraph blue, not c_red (control)');
}
{
  // The lingering star's ramp starts from c_white, not c_gray (Draw l.16),
  // and only a `stay` star ever takes that arm.
  const k = runKaizo(3.2);
  const stayed = [...k.stars.values()].filter((s) => s.sawStay && s.stayBlends.length > 2);
  ok(stayed.length > 0, 'a lingering (stay) star was observed');
  if (stayed.length) {
    const first = stayed[0].stayBlends[0];
    ok(first && first[0] > 128,
      `the stay tint ramps from WHITE, not gray (first ${JSON.stringify(first)})`);
    const lastStay = stayed[0].stayBlends[stayed[0].stayBlends.length - 1];
    ok(lastStay && lastStay[2] >= lastStay[0],
      'and still lands blue-dominant');
  }
}
{
  // THE SHARD. coltimer starts at -10 and ticks once per drawn frame; the
  // blend is white until it goes positive, then ramps to #86A2FF over 30.
  const k = runKaizo(2);
  const kids = [...k.children.values()].filter((c) => c.blends.length > 45);
  ok(kids.length > 0, 'starchildren observed long enough to watch the tint');
  const c0 = kids[0];
  ok(c0 && c0.coltimers[0] === -9,
    `coltimer starts at -10 and ticks in the Draw slot (first sample ${c0 && c0.coltimers[0]})`);
  ok(c0 && eqRgb(c0.blends[0], [255, 255, 255]),
    'a fresh shard is WHITE while coltimer is negative (clamp01 floor)');
  // …and it is a RAMP, not a step: a mid-ramp sample sits between.
  const at15 = c0 && c0.blends[c0.coltimers.indexOf(15)];
  ok(at15 && at15[0] > 134 && at15[0] < 255 && at15[2] === 255,
    `mid-ramp the shard is part-way to blue (${JSON.stringify(at15)})`);
  // THE FULL RAMP needs a shard that never starts aiming, because the con==1
  // arm freezes the clock. Difficulty 3.2 gives exactly that: `delay = 0`, so
  // Create's `if (delay > 0)` wait never arms and con stays 0 for life.
  const straight = [...runKaizo(3.2).children.values()]
    .filter((c) => c.coltimers.includes(30))[0];
  ok(straight, 'a 3.2 shard runs its clock past 30 without freezing');
  const at30 = straight && straight.blends[straight.coltimers.indexOf(30)];
  ok(at30 && eqRgb(at30, [134, 162, 255]),
    `the shard reaches #86A2FF exactly at coltimer 30 (${JSON.stringify(at30)})`);
  const at45 = straight && straight.blends[straight.coltimers.indexOf(45)];
  ok(!straight.coltimers.includes(45) || eqRgb(at45, [134, 162, 255]),
    'and clamp01 holds it there afterwards');
  // CONTROL: the vanilla shard has no coltimer scheme at all, so its blend
  // is achromatic for its whole life (white, or the con==1 white->black
  // flip). If the kaizo ramp above were deleted, kaizo would look like this.
  const v = runVanilla(2);
  const vk = [...v.children.values()].filter((c) => c.blends.length > 45)[0];
  ok(vk, 'a vanilla shard was observed for the control');
  ok(vk && vk.blends.every((b) => Array.isArray(b) && b[0] === b[1] && b[1] === b[2]),
    'the vanilla shard stays achromatic — the blue is genuinely a kaizo delta');
  ok(c0 && c0.blends.some((b) => b[0] !== b[2]),
    'and the kaizo shard is NOT achromatic (the delta actually landed)');
}
{
  // The con==1 arm: the clock freezes at the -999999 sentinel and image_blend
  // runs #86A2FF -> c_black. Both are instance writes the GML makes in Draw.
  const k = runKaizo(2);
  let froze = false;
  let darkened = false;
  for (const c of k.children.values()) {
    const i = c.coltimers.indexOf(-999999);
    if (i >= 0) {
      froze = true;
      // The frame it freezes is the frame it is repainted from the telegraph
      // blue: red channel <= 134 and falling toward black.
      const b = c.blends[i];
      if (b && b[0] <= 134 && b[2] <= 255) darkened = true;
    }
  }
  ok(froze, 'an aiming shard freezes coltimer at the -999999 sentinel');
  ok(darkened, 'and its blend is repainted from #86A2FF toward c_black');
}
{
  // Step l.115: outline = merge_color(c_white, get_swordcolor(), cos(...)).
  // Vanilla merged c_black -> c_red, so the two disagree on BOTH endpoints;
  // the kaizo overlay is never a pure red and is blue-dominant at the flip.
  const k = runKaizo(2);
  let sawKaizoOutline = false;
  let anyRedOutline = false;
  for (const c of k.children.values()) {
    for (const o of c.outlines) {
      if (o.con !== 1 || !Array.isArray(o.outline)) continue;
      sawKaizoOutline = true;
      if (o.outline[0] > o.outline[2]) anyRedOutline = true;
    }
  }
  ok(sawKaizoOutline, 'the con==1 flip writes an outline colour');
  ok(!anyRedOutline,
    'the flip overlay is never red-dominant — it merges toward get_swordcolor()');
  ok(eqRgb(getSwordcolor({ kaizo: {} }), [0, 0, 255]),
    'get_swordcolor() defaults to pure BLUE (16711680 read as BGR)');
  ok(getSwordcolor({ kaizo: {} }) === getSwordcolor({ kaizo: { swordtype: 0 } }),
    'and returns a STABLE reference, so `image_blend == get_swordcolor()` gates hold');
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
