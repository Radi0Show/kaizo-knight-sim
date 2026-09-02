#!/usr/bin/env node
// ORACLE DIFF — atk_Quickslash (ac 105, dc type 1001), the mod-only chain node.
//
//   node kaizo/tools/checks/check-oracle-quickslash.mjs [trace.csv]
//
// V-C recreation of EnderCat8's "Kaizo Roaring Knight" v2.3.3 — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// ── WHY THIS ENTRY ────────────────────────────────────────────────────────
//
// atk_Quickslash is the node the whole fight loops back into. The `_deep`
// recording shows launches 27 -> 28 running atk_Multislash3 -> atk_Quickslash:
// after phase 3's last entry the chain does NOT restart at phase 1, it re-enters
// PHASE 2's second node and runs phase 2's material again. Every later turn in
// the mod's endless route is downstream of this one, so its fidelity compounds.
//
// The recording therefore contains this entry TWICE (f4813 and f11359), 465 and
// 435 frames long respectively. That is a free control this check spends: the
// two passes are diffed against EACH OTHER first. If the attack carried state
// across turns they would disagree; they do not, to the frame.
//
// ── WHAT IS CLAIMED ───────────────────────────────────────────────────────
//
// Held against the recording, per pass and against the sim:
//
//   THE OBJECT SET      which watched objects the turn creates, and how many
//                       of each. Counts over one whole turn, not a window.
//   CADENCE             every spawn's offset from the CONTROLLER'S OWN spawn
//                       frame — the inter-cut gaps, the phase-1 -> phase-2
//                       handover gap, the barrage cadence, and the intervals
//                       between the five milestone objects.
//   STRUCTURAL GEOMETRY placements the mod computes from the arena rather than
//                       from RNG: the marker offsets, the split organism's
//                       position and scale, the 13 teeth's x lattice and their
//                       two opposed direction groups, the finisher's +33, the
//                       controller's x, the alternating cut sides, and the
//                       barrage cuts sitting exactly on the box centre.
//   DISTRIBUTION SHAPE  the barrage's y is drawn across the whole box
//                       (gt_miny()+5 .. gt_maxy()-5) and its direction across
//                       180 +- 36. Containment only — the draws themselves are
//                       not compared (see below).
//   THE TURN CLOCK      the dispatch's scr_turntimer(9999) reading 9998 at the
//                       launch frame, and the attack pinning 999999 one frame
//                       later; against vcTurnLength and the launcher's own pin.
//
// ── WHAT IS NOT CLAIMED, AND WHY ASSERTING IT WOULD BE A BUG ──────────────
//
//   ABSOLUTE FRAME NUMBERS. The recording's turn length comes from its own
//   pulsed-confirm input — the two passes of THIS ENTRY ran 465 and 435 frames
//   — while the sim's comes from its driver. Everything below is measured as an
//   offset from the controller's own spawn frame, on both sides.
//
//   ANY VALUE DRAWN FROM RNG. CLAUDE.md's honest claim is "mechanics
//   one-to-one, RNG re-anchored per launch", so the streams are deliberately
//   not aligned. Concretely, three quantities in this turn are draws and none
//   is compared for value:
//     * each cut's y (`random_range(-spawn_range, spawn_range)` off the heart)
//     * the barrage's y and its 180 +- 36 direction
//     * WHICH of the teeth's two halves fires up and which down —
//       `var _flip = choose(true, false)` (split_growtangle Step_0:113). The
//       recording's pass 1 gives the 7-tooth half direction 270; sim seed
//       12345 gives it 90 and seed 777 gives it 270. That is the coin, not a
//       divergence, and this check asserts only that the two halves are
//       OPPOSED and correctly sized.
//
//   obj_afterimage. It is on the recorder's watch list, but the count is the
//   Knight's own rainbow trail (`rgbafterimages = 1` unconditionally in this
//   mod) plus the attack's, and the two recorded passes of this same entry
//   disagree with each other (178 vs 172). A quantity the oracle cannot
//   reproduce against itself is not a quantity to hold the sim to. The sim's
//   harness knight is a stub with no trail, so its number is a harness
//   artifact besides. Reported, never asserted.
//
//   DAMAGE / HP / TP / TARGETING. The recorder pins party and boss HP to keep
//   the run alive, so every survival-shaped number in the file is a harness
//   artifact.
//
//   ANYTHING THE RECORDER WAS NOT WATCHING. The seq log resolves a hardcoded
//   name list (oracle_kaizo_fight.csx `_names`), and an attack whose work
//   happens in an unwatched object records as empty — the mistake that made
//   atk_DiamondStorm look like it did nothing. So the comparison runs over
//   WATCHED (below), copied from that list, and the sim's obj_lerpvar /
//   obj_shake are dropped because the instrument could not have produced a
//   positive result for them. Conversely obj_roaringknight_quickslash_afterimage
//   IS watched and IS zero in both passes — asserted, because that is a
//   negative the instrument could have contradicted (and the kaizo dump has no
//   creator for it anywhere).
//
// ── ONE NAME IS MAPPED, DELIBERATELY ──────────────────────────────────────
//
// The two burning cut-faces are `obj_marker` in the GML
// (split_growtangle Create_0:20/28) and `obj_marker_splitflame` in
// sim/attacks/split-growtangle.js, which renames them so they cannot be
// confused with the other obj_marker users. NAME_MAP carries that one
// equivalence and nothing else; their geometry is compared normally and
// matches the GML offsets exactly on both sides.

import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveTraces, readTrace, recoverLaunches } from './check-oracle-schedule.mjs';

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox, settleBox } from '../../../sim/battlebox.js';
import { gmlCreate } from '../../../sim/rng.js';
import { launchVCAttack, openVCArena, vcTurnLength } from '../../scenes/kaizo-mod-launcher.js';
import { VC_TABLE } from '../../versions/vc-script.js';

const ENTRY = 'atk_Quickslash';
const ROW = VC_TABLE['2'].find((r) => r.id === ENTRY);

/**
 * The recorder's watch list, restricted to what this family can create.
 * Copied from knight-research/kaizo-mod/tools/patches/oracle_kaizo_fight.csx
 * `_names`. A sim spawn whose name is not in here is DROPPED rather than
 * counted as an extra, because the recording could not have logged it.
 */
const WATCHED = new Set([
  'obj_roaringknight_quickslash',
  'obj_roaringknight_quickslash_attack',
  'obj_roaringknight_quickslash_big',
  'obj_roaringknight_quickslash_afterimage',
  'obj_roaringknight_split_bullet',
  'obj_knight_split_growtangle',
  'obj_knight_split_growtangle_effect',
  'obj_knight_split_growtangle_vertical',
  'obj_marker',
  'obj_afterimage',
]);

/** Watched, but excluded from the count/geometry diff — see the header. */
const NOT_COMPARABLE = new Set(['obj_afterimage']);

/** sim entity name -> the GML object name the recorder logs. */
const NAME_MAP = new Map([['obj_marker_splitflame', 'obj_marker']]);

let failures = 0;
let checks = 0;
/** POSITIVE EXECUTION COUNTER — see the tail. Incremented only inside a real
 *  oracle-vs-sim comparison, so "the diff ran and agreed" is distinguishable
 *  from "the diff never ran". */
let compared = 0;

function ok(cond, msg) {
  checks += 1;
  if (cond) return true;
  failures += 1;
  console.log(`  FAIL ${msg}`);
  return false;
}

/** An oracle-vs-sim comparison: counts toward `compared` as well as `checks`. */
function diff(cond, msg) {
  compared += 1;
  return ok(cond, msg);
}

function skip(lines) {
  console.log(`SKIP check-oracle-quickslash: ${lines[0]}`);
  for (const l of lines.slice(1)) console.log(`     ${l}`);
  console.log('     NOTHING IN THIS CHECK IS HELD AGAINST THE REAL MOD WITHOUT IT.');
  return 0;
}

// ── the seq log ────────────────────────────────────────────────────────────

/** The spawn log that accompanies a trace: kaizo_oracle_trace* -> *_seq*. */
function seqPathFor(tracePath) {
  const b = basename(tracePath);
  if (!b.startsWith('kaizo_oracle_trace')) return null;
  return join(dirname(tracePath), b.replace('kaizo_oracle_trace', 'kaizo_oracle_seq'));
}

function readSeq(path) {
  const text = readFileSync(path, 'utf8').replace(/\r/g, '').trimEnd();
  const lines = text.split('\n');
  const header = lines[0].split(',');
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows = lines.slice(1).filter((l) => l.length).map((l) => {
    const c = l.split(',');
    return {
      frame: Number(c[col.frame]),
      object: c[col.object],
      x: Number(c[col.x]),
      y: Number(c[col.y]),
      angle: Number(c[col.angle]),
      xscale: Number(c[col.xscale]),
      yscale: Number(c[col.yscale]),
      direction: Number(c[col.direction]),
      speed: Number(c[col.speed]),
      playing: c[col.kaizo_playing] ?? '',
    };
  });
  return { header, rows };
}

// ── shared helpers ─────────────────────────────────────────────────────────

const BOX_X = 320;
const BOX_Y = 170;
/**
 * gt_maxy() / gt_miny() at this entry's board. The arena table gives ac 105 the
 * DEFAULT 2 x 2 board at (320, 170), and the recording confirms it (gt_xs/gt_ys
 * settle at 2.0 four frames after each launch). GML `sprite_height` is already
 * scaled, so the half-height is 75 * 2 / 2 = 75.
 */
const GT_HALF_H = (75 * 2) / 2;
const GT_MINY = BOX_Y - GT_HALF_H;
const GT_MAXY = BOX_Y + GT_HALF_H;

/**
 * ONE f32 ULP AT 360 — AND IT IS NOT AN INVENTED TOLERANCE, IT IS THE STORE.
 *
 * `image_angle` and `direction` are both f32 built-ins (CLAUDE.md, "Float32
 * built-ins": every built-in instance field narrows to f32 on store), and GML
 * NORMALIZES `direction` into [0, 360) before that store while leaving
 * `image_angle` raw. So `image_angle = d; direction = d;` with d = -1.9801483
 * stores fround(-1.9801483) in one and fround(358.0198517) in the other, and
 * re-normalizing the first can no longer land on the second: the two are
 * quantised at different magnitudes.
 *
 * Measured on the recording rather than assumed — six of the 56 recorded cuts
 * miss by EXACTLY 1.52587890625e-5 (2^-16, half the f32 spacing in [256, 512))
 * and the other fifty land dead on: seq_deep f4938, f11365, f11385, f11422,
 * f11439, f11509. Those rows set this bound. Rounding can go either way at
 * either end, so the bound is the full spacing, 2^-15.
 *
 * The assertion this buys is still worth making: a heading that was genuinely
 * wrong would miss by degrees, not by 3e-5.
 */
const F32_ULP_AT_360 = 2 ** -15;

/** image_angle and direction name the same heading, normalized to [0, 360). */
const norm360 = (a) => ((a % 360) + 360) % 360;
const sameHeading = (ang, dir) => {
  const d = Math.abs(norm360(ang) - norm360(dir));
  return d <= F32_ULP_AT_360 || Math.abs(d - 360) <= F32_ULP_AT_360;
};

/** A ledger: per-object counts and the rows, anchored on the controller. */
function ledgerOf(rows, anchorFrame) {
  const byObj = new Map();
  for (const r of rows) {
    const name = NAME_MAP.get(r.object) ?? r.object;
    if (!WATCHED.has(name)) continue;
    if (!byObj.has(name)) byObj.set(name, []);
    byObj.get(name).push({ ...r, object: name, t: r.frame - anchorFrame });
  }
  for (const g of byObj.values()) g.sort((a, b) => a.t - b.t);
  return byObj;
}

const countsOf = (led) => Object.fromEntries(
  [...led.entries()]
    .filter(([n]) => !NOT_COMPARABLE.has(n))
    .map(([n, g]) => [n, g.length])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
);

const gapsOf = (ts) => ts.slice(1).map((v, i) => v - ts[i]);
const uniqSorted = (xs) => [...new Set(xs)].sort((a, b) => a - b);

/** The one anchor both sides share: the controller's own spawn frame. */
function anchorFrameOf(rows) {
  const c = rows.find((r) => r.object === 'obj_roaringknight_quickslash_attack');
  return c ? c.frame : null;
}

/**
 * The structural summary a pass (oracle) or a run (sim) reduces to. Everything
 * in here is frame-offset or arena-relative; nothing is an absolute frame and
 * nothing is an RNG value.
 */
function shapeOf(led) {
  const cuts = led.get('obj_roaringknight_quickslash') ?? [];
  const big = led.get('obj_roaringknight_quickslash_big') ?? [];
  const gt = led.get('obj_knight_split_growtangle') ?? [];
  const fx = led.get('obj_knight_split_growtangle_effect') ?? [];
  const mk = led.get('obj_marker') ?? [];
  const teeth = led.get('obj_roaringknight_split_bullet') ?? [];
  const ctl = led.get('obj_roaringknight_quickslash_attack') ?? [];

  // The barrage cuts are the ones the mod plants on the box centre exactly
  // (Other_13:36-44 `x = obj_growtangle.x`); the side cuts are orbited off it
  // and never land on it. That is the partition, read off geometry rather than
  // off a frame number.
  const side = cuts.filter((c) => c.x !== BOX_X);
  const barrage = cuts.filter((c) => c.x === BOX_X);

  return {
    counts: countsOf(led),
    ctlT: ctl.length ? ctl[0].t : null,
    cutTs: cuts.map((c) => c.t),
    sideGaps: gapsOf(side.map((c) => c.t)),
    barrageGaps: gapsOf(barrage.map((c) => c.t)),
    handoverGap: side.length && barrage.length ? barrage[0].t - side[side.length - 1].t : null,
    firstCutT: cuts.length ? cuts[0].t : null,
    sideN: side.length,
    barrageN: barrage.length,
    // milestone intervals, each measured from the event that causes it
    bigAfterLastCut: big.length && cuts.length ? big[0].t - cuts[cuts.length - 1].t : null,
    gtAfterBig: gt.length && big.length ? gt[0].t - big[0].t : null,
    fxAfterGt: fx.length && gt.length ? fx[0].t - gt[0].t : null,
    mkAfterGt: mk.length && gt.length ? mk[0].t - gt[0].t : null,
    teethAfterGt: teeth.length && gt.length ? teeth[0].t - gt[0].t : null,
    side,
    barrage,
    big,
    gt,
    fx,
    mk,
    teeth,
    ctl,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// THE SIM SIDE
// ══════════════════════════════════════════════════════════════════════════

/**
 * A fight-shaped state: the mod's default board, a soul in it, and a knight
 * stub at the Knight's rest position. The knight is a stub on purpose — the
 * quickslash module only ever matches it by type.name, reads x/y/phase and
 * writes image_alpha (the same stub check-quickslash.mjs uses). Its LACK of a
 * rainbow trail is exactly why obj_afterimage is not comparable here.
 */
const knightStub = { name: 'obj_knight_enemy' };

function buildSimState(seed) {
  const st = createState({ seed, traceBulletSlots: 0 });
  st.view = { x: 0, y: 0 };
  st.invTimer = -1;
  st.turntimer = 300;
  st.gmlRng = gmlCreate(seed);
  st.damageEnabled = false;
  st.keepAlive = true;
  st.kaizo = {
    version: 'C', sideb: false, approx: [], launched: [], vars: {}, hooks: {},
  };
  const k = spawn(st, knightStub, { x: 425, y: 78 });
  k.phase = ROW.phase; // the mod's board for this entry is raised under phase 2
  st.knightPhase = ROW.phase;
  settleBox(spawn(st, battlebox, { x: BOX_X, y: BOX_Y }));
  st.soul = spawn(st, soul, { x: 314, y: 162 });
  return st;
}

/**
 * Run one turn through THE LAUNCHER, not through the module directly: the
 * arena is opened (the mnfight 1.5 slot), twelve frames pass with the board
 * empty (`rtimer == 12`, the buffer CLAUDE.md documents and the recording
 * shows — gt_xs is still growing at the launch frame), then launchVCAttack
 * fires the ac-105 arm. Anything wrong between VC_TABLE and the dc type is
 * therefore inside the diff rather than bypassed by it.
 */
function runSim(seed, frames = 700) {
  const st = buildSimState(seed);
  openVCArena(st, ROW, { sideb: false });
  for (let i = 0; i < 12; i++) stepFrame(st, {});

  const before = new Set(st.entities.filter((e) => e.alive).map((e) => e.seq));
  const turntimerBefore = st.turntimer;
  launchVCAttack(st, ROW, { sideb: false });
  const turntimerAfter = st.turntimer;

  const seen = new Set(before);
  const rows = [];
  const take = (e, f) => {
    rows.push({
      frame: f,
      object: e.type.name,
      x: e.x,
      y: e.y,
      angle: e.image_angle,
      xscale: e.image_xscale,
      yscale: e.image_yscale,
      direction: e.direction,
      speed: e.speed,
    });
  };
  for (const e of st.entities) {
    if (e.alive && !seen.has(e.seq)) { seen.add(e.seq); take(e, 0); }
  }
  for (let f = 1; f <= frames; f++) {
    stepFrame(st, {});
    // The party is held up and the run kept alive for the same reason the
    // recorder pins HP: this is a spawn-ledger diff, not a survival test.
    st.partyHp = st.partyHp.map(() => 100);
    st.gameOver = false;
    for (const e of st.entities) {
      if (!e.alive || seen.has(e.seq)) continue;
      seen.add(e.seq);
      take(e, f);
    }
  }
  return { st, rows, turntimerBefore, turntimerAfter };
}

// ── WHICH ROUTE A RECORDING WALKED ────────────────────────────────────────
//
// atk_Quickslash is one of the THREE entries whose `ac` differs between the
// routes, and it is the one that differs most: 105 on the ordinary route,
// 105.1 ("quickslash true", dc type 97.1) on the B-Side. ORACLE-GROUND-TRUTH
// measures the gap — 45 gameplay objects against 936, twenty times the
// content, with obj_knight_spark x378 / obj_knight_triangle x346 /
// obj_knight_bullethell_bullet2 x170 that route C never creates at all, 24
// cuts instead of 28, and a VERTICAL split organism instead of the horizontal
// one. They are not the same attack under two difficulties.
//
// `ac 105.1 is a REAL, so the comparison uses a tolerance rather than ===`
// (ORACLE-GROUND-TRUTH, "Telling the routes apart"; CLAUDE.md, "GML == ON
// REALS IS NOT ==="). 1e-6 is far below the 0.1 that separates the two and far
// above any f32 store noise on a value of this size.
const QUICKSLASH_AC_C = 105;
const QUICKSLASH_AC_D = 105.1;
const acIs = (a, b) => a !== null && Number.isFinite(a) && Math.abs(a - b) < 1e-6;

/**
 * Probe used only for CHOOSING a recording. Returns false rather than throwing
 * on anything it cannot read: a candidate this cannot parse is simply not
 * preferred, and the gate in main() then reports on it properly.
 */
function isRouteCQuickslash(tracePath) {
  try {
    const sp = seqPathFor(tracePath);
    if (!sp || !existsSync(sp)) return false;
    const L = recoverLaunches(readTrace(tracePath)).filter((x) => x.played === ENTRY);
    return L.length > 0 && acIs(L[0].ac, QUICKSLASH_AC_C);
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

function main() {
  let path = process.argv[2];
  if (!path) {
    const { dir, found, looked } = resolveTraces();
    if (!dir) {
      return skip([
        'no kaizo oracle recording found',
        ...looked.map((l) => `looked in ${l}`),
        'Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,',
        'or point KAIZO_ORACLE_TRACES at the directory.',
      ]);
    }
    // The LONGEST recording, for the same reason check-oracle-schedule picks
    // it: MODE 1 locks are short and replay one entry, and only a long MODE 0
    // run reaches atk_Quickslash at all (it is launch 12 of the chain).
    const bySize = found
      .map((f) => join(dir, f))
      .map((p) => ({ p, n: readFileSync(p, 'utf8').length }))
      .sort((a, b) => b.n - a.n)
      .map((o) => o.p);
    // ...but LONGEST IS NOT ENOUGH ON ITS OWN, because two routes exist and
    // this check models exactly one. `_deep` (route C) and `_sideb` (route D)
    // are both 13,000-frame MODE 0 runs and their sizes differ by under 1.2%,
    // so "the longest" is a coin flip that a single re-record could turn over —
    // and route D's atk_Quickslash is ac 105.1, a DIFFERENT attack (see the
    // route gate below). Prefer the longest recording that actually walked the
    // route this file drives the sim through; fall back to the longest so the
    // gate can name what it found instead of silently reporting nothing.
    path = bySize.find((p) => isRouteCQuickslash(p)) ?? bySize[0];
  }
  if (!existsSync(path)) {
    return skip([`recording ${path} does not exist`]);
  }

  const seqPath = seqPathFor(path);
  if (!seqPath || !existsSync(seqPath)) {
    return skip([
      `no spawn log beside ${basename(path)}`,
      `expected ${seqPath}`,
      'This check diffs SPAWNS; the per-frame trace alone cannot feed it.',
    ]);
  }

  const trace = readTrace(path);
  const seq = readSeq(seqPath);
  console.log(`check-oracle-quickslash: ${path}`);
  console.log(`  spawn log: ${basename(seqPath)} (${seq.rows.length} rows)`);

  if (seq.header.indexOf('kaizo_playing') < 0) {
    return skip([
      `${basename(seqPath)} has no kaizo_playing column`,
      'Per-attack work MUST group by kaizo_playing (the mod\'s own kaizo_prevatk).',
      'kaizo_atk points at the NEXT entry and transitions on the launch frame,',
      'so grouping by it attributes every spawn to the wrong turn.',
    ]);
  }

  // ── THE INSTRUMENT'S OWN VINTAGE, CHECKED BEFORE ANYTHING IS DIFFED ─────
  //
  // A NEGATIVE RESULT IS ONLY EVIDENCE IF THE INSTRUMENT COULD HAVE PRODUCED A
  // POSITIVE ONE — and this file would otherwise report a false divergence on
  // any recording older than 2026-08-29. The recorder resolves a hardcoded name
  // list, and the older list carried neither `obj_marker` nor `obj_afterimage`;
  // run against `_schedule`, this check's object-SET diff fails with "the sim
  // makes two markers the mod does not", which is the instrument, not the sim.
  // (`_schedule` agrees with `_deep` on every quantity it CAN see — 28 cuts,
  // the same gaps, the same teeth — which is why the wrong answer would have
  // looked credible.)
  //
  // `obj_afterimage` is the discriminator: it is the Knight's kaizo-only
  // rainbow trail, it exists on every frame of every turn, and it was added to
  // the watch list in the same edit as `obj_marker`. Zero of them in the whole
  // file means the old list.
  if (!seq.rows.some((r) => r.object === 'obj_afterimage')) {
    return skip([
      `${basename(seqPath)} predates the 2026-08-29 watch-list fix`,
      'It logs no obj_afterimage anywhere, so its recorder also lacked obj_marker —',
      'and this check diffs the OBJECT SET, which would then report the sim\'s two',
      'cut-face markers as a divergence the recording merely could not see.',
      'Use a recording made after that fix (kaizo_oracle_seq_deep.csv is one).',
    ]);
  }

  // ── launches, recovered the established way ──────────────────────────────
  const launches = recoverLaunches(trace).filter((L) => L.played === ENTRY);
  if (!launches.length) {
    return skip([
      `${basename(path)} contains no launch of ${ENTRY}`,
      'It is launch 12 of the ordinary chain; a recording must reach ~5000 frames.',
    ]);
  }
  console.log(`  ${ENTRY}: ${launches.length} launch(es) at `
    + `f${launches.map((L) => L.frame).join(', f')}`);

  // ── THE ROUTE GATE — the second half of "could the instrument have been
  //    right?", and it belongs here for the same reason the vintage gate does.
  //
  // Everything below drives the sim through `{ sideb: false }`, hardcoded: the
  // ac-105 arm, dc type 1001. Held against a route-D recording that arm is
  // being compared with ac 105.1 — a different attack — and the check reported
  // FOURTEEN divergences on `_sideb` before this gate, then crashed reading a
  // split organism route D does not create (it makes the VERTICAL one). Not
  // one of those was a divergence; every one measured the harness pointing at
  // the wrong attack. That is the mistake ORACLE-GROUND-TRUTH names twice
  // ("a divergence that measured the instrument").
  //
  // This is a DECLINE, not a pass: route D's interior is explicitly unverified
  // ("nothing has yet held the sim's type 97.1 module against those 378 sparks
  // and 346 triangles"), and it wants its own check, not a loosened version of
  // this one. Nothing route C claims is weakened by saying so.
  const recordedAc = launches[0].ac;
  if (!acIs(recordedAc, QUICKSLASH_AC_C)) {
    return skip([
      `${basename(path)} plays ${ENTRY} at ac ${recordedAc}, not ac ${QUICKSLASH_AC_C}`,
      ...(acIs(recordedAc, QUICKSLASH_AC_D) ? [
        `ac ${QUICKSLASH_AC_D} is the B-SIDE route's "quickslash true" (dc type 97.1) —`,
        'a different attack, not a harder one: 24 cuts instead of 28, a VERTICAL',
        'split organism, and obj_knight_spark / obj_knight_triangle /',
        'obj_knight_bullethell_bullet2 that ac 105 never creates.',
      ] : [
        'That is neither route this entry is known to run on; check the recording.',
      ]),
      'This check drives the sim through the ac-105 arm ({ sideb: false }), so it',
      'CANNOT be held against this recording without comparing two different',
      'attacks. Route D\'s type-97.1 interior is unverified and wants its own',
      'check (ORACLE-GROUND-TRUTH, "The dispatch for ac 105.1 is already correct',
      'in the sim ... What is NOT verified is that attack\'s INTERIOR").',
      'Run this against a route-C recording (kaizo_oracle_trace_deep.csv is one).',
    ]);
  }

  // ── THE ORACLE LEDGER — the deliverable, printed whether or not it agrees ─
  const passes = [];
  for (let i = 0; i < launches.length; i++) {
    const f0 = launches[i].frame;
    const f1 = i + 1 < launches.length ? launches[i + 1].frame : Infinity;
    // Rows belong to this pass by the mod's OWN attribution (kaizo_playing)
    // AND by the launch window, so the loop's two visits do not merge.
    const rows = seq.rows.filter((r) => r.playing === ENTRY && r.frame >= f0 && r.frame < f1);
    const anchor = anchorFrameOf(rows);
    if (anchor === null) {
      ok(false, `pass ${i + 1}: no obj_roaringknight_quickslash_attack was logged`
        + ' — the controller itself never appeared, so nothing can be anchored');
      continue;
    }
    const led = ledgerOf(rows, anchor);
    passes.push({
      index: i + 1, f0, anchor, rows, led, shape: shapeOf(led),
      afterimages: (led.get('obj_afterimage') ?? []).length,
    });
  }
  if (!passes.length) return 1;

  console.log('\n  ── ORACLE SPAWN LEDGER (per launch, offsets from the controller) ──');
  for (const p of passes) {
    const s = p.shape;
    console.log(`  pass ${p.index}: launch f${p.f0}, controller f${p.anchor} (launch +${p.anchor - p.f0})`);
    for (const [n, c] of Object.entries(s.counts)) {
      const g = p.led.get(n);
      const ts = g.map((r) => r.t);
      const geo = uniqSorted(g.map((r) => r.x)).length <= 4
        ? `x ${uniqSorted(g.map((r) => r.x)).join('/')}`
        : `x ${Math.min(...g.map((r) => r.x)).toFixed(3)}..${Math.max(...g.map((r) => r.x)).toFixed(3)}`;
      const angs = uniqSorted(g.map((r) => r.angle));
      const ang = angs.length <= 4 ? `ang ${angs.join('/')}`
        : `ang ${angs[0].toFixed(3)}..${angs[angs.length - 1].toFixed(3)}`;
      console.log(`      ${n.padEnd(38)} x${String(c).padStart(3)}  t +${ts[0]}`
        + `${ts.length > 1 ? `..+${ts[ts.length - 1]}` : ''}  ${geo}  ${ang}`
        + `  scale ${uniqSorted(g.map((r) => r.xscale)).join('/')}`
        + `x${uniqSorted(g.map((r) => r.yscale)).join('/')}`);
    }
    console.log(`      cut cadence: side ${s.sideN} cuts, gaps [${s.sideGaps.join(',')}]`);
    console.log(`      handover gap ${s.handoverGap}, then barrage ${s.barrageN} cuts,`
      + ` gaps [${s.barrageGaps.join(',')}]`);
    console.log(`      big +${s.bigAfterLastCut} after the last cut; split box +${s.gtAfterBig}`
      + ` after the big; effect +${s.fxAfterGt}, markers +${s.mkAfterGt},`
      + ` teeth +${s.teethAfterGt} after the box`);
    console.log(`      (obj_afterimage ${p.afterimages} — REPORTED, NOT COMPARED)`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1. THE LOOP'S TWO PASSES, AGAINST EACH OTHER.
  //    The mod re-enters this node from phase 3. If the attack carried state
  //    across turns the second pass would differ; this is the control that
  //    says the sim is allowed to model one turn in isolation at all.
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n  ── the loop: pass 2 against pass 1 ──');
  if (passes.length < 2) {
    console.log('  NOTE: this recording holds only ONE pass of the loop node, so the');
    console.log('        "no state carried across turns" control DID NOT RUN. The sim');
    console.log('        comparison below still holds; the loop claim does not.');
  } else {
    const a = passes[0].shape;
    for (const p of passes.slice(1)) {
      const b = p.shape;
      ok(JSON.stringify(a.counts) === JSON.stringify(b.counts),
        `pass ${p.index}: object counts differ from pass 1 —`
        + ` ${JSON.stringify(a.counts)} vs ${JSON.stringify(b.counts)}`);
      ok(a.cutTs.join(',') === b.cutTs.join(','),
        `pass ${p.index}: cut offsets differ from pass 1 — the attack carries state`
        + ` across turns (${a.cutTs.join(',')} vs ${b.cutTs.join(',')})`);
      for (const [k, label] of [
        ['bigAfterLastCut', 'the finisher\'s delay after the last cut'],
        ['gtAfterBig', 'the split box\'s delay after the finisher'],
        ['fxAfterGt', 'the split effect\'s delay'],
        ['mkAfterGt', 'the cut-face markers\' delay'],
        ['teethAfterGt', 'the teeth\'s delay'],
      ]) {
        ok(a[k] === b[k], `pass ${p.index}: ${label} differs from pass 1 (${a[k]} vs ${b[k]})`);
      }
      // The turn LENGTHS differ (465 vs 435 frames in the _deep recording)
      // because the recorder's confirm pulse decides them — so the fact that
      // every offset above agrees anyway is the whole point of this block.
      ok(uniqSorted(a.teeth.map((t) => t.x)).join(',')
        === uniqSorted(b.teeth.map((t) => t.x)).join(','),
        `pass ${p.index}: the teeth lattice differs from pass 1`);
      ok(a.mk.map((m) => `${m.x},${m.y},${m.angle}`).sort().join(' | ')
        === b.mk.map((m) => `${m.x},${m.y},${m.angle}`).sort().join(' | '),
        `pass ${p.index}: the cut-face markers differ from pass 1`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1b. THE BOARD THE CONSTANTS ABOVE ASSUME.
  //     BOX_X / BOX_Y / GT_HALF_H are the arena table's default 2 x 2 board at
  //     (320, 170), and half this file's geometry is expressed relative to it —
  //     including the side/barrage partition. So it is READ BACK from the
  //     recording rather than trusted: if a future build moved ac 105's board,
  //     everything downstream would silently compare against the wrong origin.
  // ══════════════════════════════════════════════════════════════════════
  for (const L of launches) {
    const i = trace.rows.findIndex((r) => Number(r[trace.col.frame]) === L.frame);
    // Ten frames in: past the grow-in (the recording shows gt_xs reaching 2.0
    // four frames after each of these launches) and long before anything moves.
    const r = trace.rows[i + 10];
    const g = ['gt_x', 'gt_y', 'gt_xs', 'gt_ys'].map((k) => Number(r[trace.col[k]]));
    ok(g[0] === BOX_X && g[1] === BOX_Y && g[2] === 2 && g[3] === 2,
      `launch f${L.frame}: the board is (${g[0]}, ${g[1]}) ${g[2]}x${g[3]}, not the`
      + ` (${BOX_X}, ${BOX_Y}) 2x2 this file's geometry is expressed against`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. THE TURN CLOCK, from the per-frame trace.
  //    Other_23:535-541 arms scr_turntimer(9999); dbulletcontroller
  //    Step_0:2264 pins global.turntimer = 999999 from the attack object's
  //    first Step, one frame later.
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n  ── the turn clock ──');
  for (const L of launches) {
    ok(L.turntimerArmed === 9998,
      `launch f${L.frame}: the dispatch floor reads ${L.turntimerArmed} at the launch`
      + ' frame, not 9998 (scr_turntimer(9999) minus the controller\'s one tick)');
    ok(L.turntimerAfter === 999999,
      `launch f${L.frame}: the attack set turntimer ${L.turntimerAfter} within 3 frames`
      + ' of launch rather than pinning 999999');
  }
  // The arm's floor is scr_turntimer(9999) (Other_23:535-541); the 999999 pin
  // is the attack object's, one frame later -- measured above as 9998 then
  // 999999. vcTurnLength is the ARM: it answers the floor.
  diff(vcTurnLength(ROW, { sideb: false }) === 9999,
    `vcTurnLength models ${ENTRY} as ${vcTurnLength(ROW, { sideb: false })},`
    + " but the arm floors scr_turntimer(9999); the 999999 is the attack object's pin");

  // ══════════════════════════════════════════════════════════════════════
  // 3. THE SIM, through the launcher.
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n  ── the sim, driven through launchVCAttack(atk_Quickslash) ──');
  const SEEDS = [12345, 777, 4242];
  const runs = SEEDS.map((s) => {
    const r = runSim(s);
    const anchor = anchorFrameOf(r.rows);
    const led = anchor === null ? new Map() : ledgerOf(r.rows, anchor);
    return { seed: s, ...r, anchor, led, shape: shapeOf(led) };
  });

  // POSITIVE EXECUTION: the sim actually launched and actually spawned.
  const r0 = runs[0];
  ok(r0.anchor !== null,
    'the sim never created obj_roaringknight_quickslash_attack — the ac-105 arm did not fire');
  if (r0.anchor === null) return 1;
  ok(r0.turntimerBefore !== 999999 && r0.turntimerAfter === 999999,
    `the launcher pins global.turntimer 999999 (before ${r0.turntimerBefore},`
    + ` after ${r0.turntimerAfter})`);
  {
    const gt = r0.st.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
    ok(gt && gt.x === BOX_X && gt.y === BOX_Y
      && gt.image_xscale === 2 && gt.image_yscale === 2,
      'the sim\'s board is not the (320, 170) 2x2 the recording shows for this entry'
      + ` (got (${gt && gt.x}, ${gt && gt.y}) ${gt && gt.image_xscale}x${gt && gt.image_yscale})`);
  }
  ok((r0.st.kaizo.approx ?? []).length === 0,
    `the ac-105 launch ledgered ${JSON.stringify(r0.st.kaizo.approx)} —`
    + ' this entry is supposed to be fully translated');
  for (const [n, c] of Object.entries(r0.shape.counts)) {
    ok(c > 0, `the sim produced zero ${n}`);
  }

  const sim = r0.shape;
  console.log(`  sim (seed ${r0.seed}): ${JSON.stringify(sim.counts)}`);
  console.log(`      cut cadence: side ${sim.sideN} cuts, gaps [${sim.sideGaps.join(',')}]`);
  console.log(`      handover gap ${sim.handoverGap}, then barrage ${sim.barrageN} cuts,`
    + ` gaps [${sim.barrageGaps.join(',')}]`);
  console.log(`      big +${sim.bigAfterLastCut} after the last cut; split box +${sim.gtAfterBig}`
    + ` after the big; effect +${sim.fxAfterGt}, markers +${sim.mkAfterGt},`
    + ` teeth +${sim.teethAfterGt} after the box`);

  // Every structural claim must hold on all three seeds, so a coincidence of
  // one RNG stream cannot carry the diff.
  for (const r of runs.slice(1)) {
    ok(JSON.stringify(r.shape.counts) === JSON.stringify(sim.counts),
      `sim seed ${r.seed} produced different counts from seed ${r0.seed}`
      + ` (${JSON.stringify(r.shape.counts)}) — this turn is not seed-stable`);
    ok(r.shape.cutTs.join(',') === sim.cutTs.join(','),
      `sim seed ${r.seed} produced a different cut cadence from seed ${r0.seed}`);
  }

  const O = passes[0].shape;

  // ── 3a. the object SET ──────────────────────────────────────────────────
  const oNames = Object.keys(O.counts).join(',');
  const sNames = Object.keys(sim.counts).join(',');
  diff(oNames === sNames,
    `the object SET differs — oracle {${oNames}}, sim {${sNames}}`);

  // ── 3b. per-type COUNTS ─────────────────────────────────────────────────
  for (const n of Object.keys(O.counts)) {
    diff(O.counts[n] === sim.counts[n],
      `${n}: oracle ${O.counts[n]}, sim ${sim.counts[n]}`);
  }

  // ── 3c. the cut cadence, split at the geometry boundary ─────────────────
  diff(O.firstCutT === sim.firstCutT,
    `first cut lands +${O.firstCutT} after the controller in the mod,`
    + ` +${sim.firstCutT} in the sim (Create's timer = spawn_speed - 5)`);
  diff(O.sideN === sim.sideN,
    `phase-1 cut count — oracle ${O.sideN}, sim ${sim.sideN}`
    + ' (the 0.25/spawn walk from spawn_speed 10 down to spawn_min 5)');
  diff(O.sideGaps.join(',') === sim.sideGaps.join(','),
    `phase-1 cadence — oracle [${O.sideGaps.join(',')}],`
    + ` sim [${sim.sideGaps.join(',')}]`);
  diff(O.handoverGap === sim.handoverGap,
    `the phase-1 -> phase-2 handover gap (Step_0:165-172, timer = -7 with no`
    + ` spawn on that tick) — oracle ${O.handoverGap}, sim ${sim.handoverGap}`);
  diff(O.barrageN === sim.barrageN,
    `BARRAGE CUT COUNT — oracle ${O.barrageN}, sim ${sim.barrageN}.`
    + ' Step_0:174-186 walks spawn_phase 2 + n*0.03 and exits at'
    + ' `if (spawn_phase >= 2.27)`. The accumulated f64 after nine increments is'
    + ' 2.26999999999999824, which is 1.78e-15 BELOW the literal — so a bit-exact'
    + ' `>=` runs one extra cut. GameMaker compares reals through math_set_epsilon'
    + ' (CLAUDE.md, "GML == ON REALS IS NOT ==="), so the mod exits on that'
    + ' increment. THE RECORDING IS DECISIVE: `_deep` holds this entry twice,'
    + ' 6,546 frames apart, and both passes show 8 barrage cuts (f4983..f4997,'
    + ' f11529..f11543) inside 28 obj_roaringknight_quickslash; `_schedule`'
    + ' agrees at 28. FIXED 2026-08-29 — kaizo/attacks/quickslash.js now reads'
    + ' `if (gmlLte(2.27, e.spawn_phase))` (sim/gml.js gmlLte(a,b) is'
    + ' `a <= b + GML_EPSILON`, i.e. exactly the epsilon-tolerant `>=` GML'
    + ' performs). A sim of 9 here means that helper was reverted to a bare'
    + ' `>=`; that is the regression, not the number.');
  diff(O.barrageGaps.join(',') === sim.barrageGaps.join(','),
    `barrage cadence — oracle [${O.barrageGaps.join(',')}],`
    + ` sim [${sim.barrageGaps.join(',')}]`);

  // ── 3d. the milestone intervals ─────────────────────────────────────────
  for (const [k, label] of [
    ['bigAfterLastCut', 'the finisher after the last cut (Step_0:201-208, slash_count 1000)'],
    ['gtAfterBig', 'the split organism after the finisher (big_Step_0, timer == 40)'],
    ['fxAfterGt', 'the split effect after the organism'],
    ['mkAfterGt', 'the cut-face markers after the organism (same Create)'],
    ['teethAfterGt', 'the teeth after the organism'],
  ]) {
    diff(O[k] === sim[k], `${label} — oracle +${O[k]}, sim +${sim[k]}`);
  }

  // ── 3e. structural geometry ─────────────────────────────────────────────
  console.log('\n  ── structural geometry ──');

  // the controller: created at the Knight's own position, at double scale.
  for (const [tag, s] of [['oracle', O], ['sim', sim]]) {
    const c = s.ctl[0];
    ok(c && c.x === 425, `${tag}: the controller sits at the Knight's x 425 (got ${c && c.x})`);
    ok(c && c.xscale === 2 && c.yscale === 2,
      `${tag}: the controller is at scale 2x2 (got ${c && c.xscale}x${c && c.yscale})`);
    ok(c && c.angle === 0, `${tag}: the controller's image_angle is 0 (got ${c && c.angle})`);
  }

  // the cuts: sides alternate, image_xscale is the side, barrage on centre.
  for (const [tag, s] of [['oracle', O], ['sim', sim]]) {
    const sides = s.side.map((c) => Math.sign(c.x - BOX_X));
    const scales = s.side.map((c) => c.xscale);
    ok(sides.every((v, i) => v === (i % 2 === 0 ? -1 : 1)),
      `${tag}: the phase-1 cuts do not alternate LEFT/RIGHT off the box centre`
      + ` (${sides.join(',')})`);
    ok(scales.every((v, i) => v === (i % 2 === 0 ? 1 : -1)),
      `${tag}: image_xscale does not alternate +1/-1 starting +1 (${scales.join(',')})`
      + ' — Other_11\'s one-shot pre-flip puts the first pose on the LEFT');
    ok(s.side.every((c) => c.yscale === 1) && s.barrage.every((c) => c.yscale === 1),
      `${tag}: a cut spawned at image_yscale != 1`);
    ok(s.side.every((c) => c.speed === 0) && s.barrage.every((c) => c.speed === 0),
      `${tag}: a cut spawned with speed != 0 (the cut is a static line)`);
    ok([...s.side, ...s.barrage].every((c) => sameHeading(c.angle, c.direction)),
      `${tag}: a cut's image_angle and direction disagree`);
    ok(s.barrage.every((c) => c.x === BOX_X),
      `${tag}: a barrage cut is not on the box centre (Other_13:37 x = obj_growtangle.x)`);
    // 180 +- 36 comes from Other_13:39, not from this file.
    ok(s.barrage.every((c) => norm360(c.direction) >= 144 && norm360(c.direction) <= 216),
      `${tag}: a barrage cut fired outside 180 +- 36`
      + ` (${s.barrage.map((c) => c.direction.toFixed(2)).join(',')})`);
    // the whole box, 5px in at each end — Other_13:38.
    ok(s.barrage.every((c) => c.y >= GT_MINY + 5 && c.y <= GT_MAXY - 5),
      `${tag}: a barrage cut's y fell outside gt_miny()+5 .. gt_maxy()-5`
      + ` [${GT_MINY + 5}, ${GT_MAXY - 5}]`
      + ` (${s.barrage.map((c) => c.y.toFixed(2)).join(',')})`);
  }
  // The side sequence itself, held across builds: which cut goes left, which
  // right, and the mirroring flag that goes with it. Other_11's one-shot
  // pre-flip is what puts cut 1 on the LEFT, so a build that dropped it would
  // produce the exact mirror of this string and fail here rather than pass on
  // "they both alternate".
  const sideKey = (s) => s.side.map((c) => `${Math.sign(c.x - BOX_X)}${c.xscale > 0 ? '+' : '-'}`)
    .join('');
  diff(sideKey(O) === sideKey(sim),
    `the phase-1 side sequence — oracle ${sideKey(O)}, sim ${sideKey(sim)}`);

  // the finisher: gt.x + 33, gt.y, scale 1 (big_Create_0 inherits the cut's).
  diff(O.big[0].x - BOX_X === sim.big[0].x - BOX_X,
    `the finisher's x offset from the box — oracle +${O.big[0].x - BOX_X},`
    + ` sim +${sim.big[0].x - BOX_X} (Step_0:203, gt.x + 33)`);
  diff(O.big[0].y === sim.big[0].y,
    `the finisher's y — oracle ${O.big[0].y}, sim ${sim.big[0].y}`);
  diff(O.big[0].xscale === sim.big[0].xscale && O.big[0].yscale === sim.big[0].yscale,
    `the finisher's scale — oracle ${O.big[0].xscale}x${O.big[0].yscale},`
    + ` sim ${sim.big[0].xscale}x${sim.big[0].yscale}`);

  // the split organism and its effect: the box's own place and the box's own
  // scale (split_growtangle Create_0:2-3, `image_xscale = obj_growtangle.image_xscale`).
  for (const [k, label] of [['gt', 'the split organism'], ['fx', 'the split effect']]) {
    diff(O[k][0].x === sim[k][0].x && O[k][0].y === sim[k][0].y,
      `${label}'s position — oracle (${O[k][0].x}, ${O[k][0].y}),`
      + ` sim (${sim[k][0].x}, ${sim[k][0].y})`);
    diff(O[k][0].xscale === sim[k][0].xscale && O[k][0].yscale === sim[k][0].yscale,
      `${label}'s SCALE — oracle ${O[k][0].xscale}x${O[k][0].yscale},`
      + ` sim ${sim[k][0].xscale}x${sim[k][0].yscale}.`
      + ' obj_knight_split_growtangle Create_0:2-3 is'
      + ' `image_xscale = obj_growtangle.image_xscale`, and the recording reads 2x2.'
      + ' sim/attacks/split-growtangle.js:140-141 reads `gt.xscale` / `gt.yscale`,'
      + ' a pair sim/battlebox.js deliberately DELETED (battlebox.js:53-58), so both'
      + ' land on undefined and propagate to the effect (split-growtangle.js:231-232)'
      + ' and to render/draw/splitcut.js:72\'s ctx.scale. FIX (sim/, not mine to make):'
      + ' read gt.image_xscale / gt.image_yscale.');
  }

  // the two burning cut faces: (x+2, y-1) at 180 and (x, y+2) at 0, scale 2.
  const mkKey = (g) => g.map((m) => `${m.x - BOX_X},${m.y - BOX_Y},${m.angle},${m.xscale},${m.yscale}`)
    .sort().join(' | ');
  diff(mkKey(O.mk) === mkKey(sim.mk),
    `the cut-face markers — oracle [${mkKey(O.mk)}], sim [${mkKey(sim.mk)}]`
    + ' (split_growtangle Create_0:20-35: x+2/y-1 at 180, x/y+2 at 0, both 2x2)');

  // the teeth: one frame, one row, a 24px lattice, two opposed halves 7 / 6.
  for (const [tag, s] of [['oracle', O], ['sim', sim]]) {
    ok(uniqSorted(s.teeth.map((t) => t.t)).length === 1,
      `${tag}: the 13 teeth did not all spawn on one frame`);
    ok(s.teeth.every((t) => t.y === BOX_Y),
      `${tag}: a tooth spawned off the cut line y = ${BOX_Y}`);
    ok(s.teeth.every((t) => t.xscale === 2 && t.yscale === 2),
      `${tag}: a tooth spawned at a scale other than 2x2`);
    ok(s.teeth.every((t) => sameHeading(t.angle, t.direction)),
      `${tag}: a tooth's image_angle and direction disagree`);
    const dirs = uniqSorted(s.teeth.map((t) => norm360(t.direction)));
    ok(dirs.length === 2 && dirs[0] === 90 && dirs[1] === 270,
      `${tag}: the teeth's directions are ${dirs.join('/')}, not the opposed 90/270`);
    // The half CONTAINING the box centre is the seven; the other is offset by
    // half a step. Which one fires up is `choose(true, false)` — not compared.
    const base = s.teeth.filter((t) => (t.x - BOX_X) % 24 === 0);
    const off = s.teeth.filter((t) => (t.x - BOX_X) % 24 !== 0);
    ok(base.length === 7 && off.length === 6,
      `${tag}: the teeth split ${base.length}/${off.length}, not 7/6`);
    ok(uniqSorted(base.map((t) => norm360(t.direction))).length === 1
      && uniqSorted(off.map((t) => norm360(t.direction))).length === 1
      && norm360(base[0].direction) !== norm360(off[0].direction),
      `${tag}: the two tooth halves are not uniformly opposed`);
  }
  diff(uniqSorted(O.teeth.map((t) => t.x - BOX_X)).join(',')
    === uniqSorted(sim.teeth.map((t) => t.x - BOX_X)).join(','),
    `the teeth's x lattice relative to the box —`
    + ` oracle [${uniqSorted(O.teeth.map((t) => t.x - BOX_X)).join(',')}],`
    + ` sim [${uniqSorted(sim.teeth.map((t) => t.x - BOX_X)).join(',')}]`);

  // ── 3f. a negative the instrument could have contradicted ───────────────
  // obj_roaringknight_quickslash_afterimage is ON the recorder's watch list
  // and has NO creator anywhere in the kaizo dump. Both sides must be zero,
  // and the recorder proves it was looking.
  const oAfter = passes.reduce((n, p) => n
    + (p.led.get('obj_roaringknight_quickslash_afterimage') ?? []).length, 0);
  const sAfter = (r0.led.get('obj_roaringknight_quickslash_afterimage') ?? []).length;
  diff(oAfter === 0 && sAfter === 0,
    `obj_roaringknight_quickslash_afterimage — oracle ${oAfter}, sim ${sAfter}.`
    + ' It is on the recorder\'s watch list and has no creator in the kaizo dump,'
    + ' so zero on both sides is a measured negative, not an unlooked-at one.');

  // ── the reported-but-not-compared column ────────────────────────────────
  console.log(`\n  NOTE: obj_afterimage — oracle ${passes.map((p) => p.afterimages).join(' / ')}`
    + ` across ${passes.length} pass(es), sim ${(r0.led.get('obj_afterimage') ?? []).length}.`);
  console.log('        NOT COMPARED: the count is dominated by the Knight\'s own rainbow');
  console.log('        trail (rgbafterimages = 1 in this mod), the two recorded passes of');
  console.log('        this same entry disagree with each other, and the sim harness\'s');
  console.log('        knight is a stub with no trail.');

  // ══════════════════════════════════════════════════════════════════════
  // POSITIVE EXECUTION ASSERTION — the whole point of this counter.
  // ══════════════════════════════════════════════════════════════════════
  ok(compared >= 25,
    `only ${compared} oracle-vs-sim comparisons ran; this file is written to make`
    + ' at least 25, so a run reporting fewer has skipped the diff rather than passed it');

  console.log(`\n  ${compared} oracle-vs-sim comparisons inside ${checks} assertions`);
  if (failures) {
    console.log(`  ${failures} FAILURE(S) — see above. Each is a claim about the SIM,`);
    console.log('  measured against the recording; none has been loosened to pass.');
    return 1;
  }
  console.log('  OK — the spawn ledger, cadence and structural geometry of');
  console.log(`  ${ENTRY} agree with the real mod. Nothing about RNG values,`);
  console.log('  absolute frames, damage or the afterimage trail is claimed.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
