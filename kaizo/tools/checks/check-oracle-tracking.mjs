#!/usr/bin/env node
// ORACLE DIFF — THE TRACKING-SWORDS + DIAGONALS FAMILY (ac 0 / 17 / 12 / 16 / 14).
//
//   node kaizo/tools/checks/check-oracle-tracking.mjs [trace.csv]
//
// V-C recreation of EnderCat8's "Kaizo Roaring Knight" v2.3.3 — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// check-oracle-schedule proved the fight SELECTS the right entries and raises
// the right board. It says nothing about what happens on that board. This is
// the first file that opens one of those turns and holds what the sim BUILDS
// against what the mod built, for five entries:
//
//   atk_CrescentSlash ac 0  d0  p1   type 109, then type 151 variant 6 (D: 6.1)
//   atk_Swords1      ac 17  d0  p1   type 151 variant 3
//   atk_DiamondStorm ac 12  d0  p1   type 152, then type 151 variant 7
//   atk_Swords2      ac 16  d0  p2   type 104, then type 151 variant 0 TWICE
//   atk_Swords3      ac 14  d0  p3   type 151 variant 10 TWICE
//
// ── VARIANTS 6 AND 6.1, AND WHY ac 0 IS HERE AT ALL ───────────────────────
//
// ac 0's tracking half was the last type-151 dispatch with NO check of its
// own. It is the only entry whose tracking swords share a turn with another
// family (type 109, the crescent generator — Other_23:169-178 arms both), so
// it reads as "a crescent turn" and was skipped; the FAMILY filter below is
// what makes it comparable, exactly as it already makes ac 16's rotating-slash
// payload invisible here.
//
// It is worth having because variants 6 and 6.1 are the mod's SLOWEST
// cadences and the only ones whose whole ladder fits inside one turn, so the
// recording pins `ratedecay` — which no other row does. Other_10's table says
// variant 6 is rate 64 / decay 2 / min 16 and variant 6.1 is 40 / 2 / 30, and
// `timer = rate - 5` at init. The recordings walk both ladders exactly:
//
//   _deep  ac 0   (Other_23:174-177, difficulty 6)
//     manager offset 1, swords at 6, 68, 128, 186 -> gaps 62, 60, 58
//     = 64-then-decay-2, and the fifth sword never comes because the
//       manager's own `global.turntimer < 70` gate has already shut it off.
//   _sideb ac 0   (Other_23:842-844, difficulty 6.1)
//     manager offset 1, swords at 6, 44, 80, 114, 146, 176 -> 38, 36, 34, 32, 30
//     = 40-then-decay-2, floored at rateminimum 30 on the last step.
//
// Their headings are NOT the roll and NOT the anti-repeat wheel: variant 6 and
// 6.1 both write the 90/270 up-down string into setdirection[1..22]
// (Other_10:109-130 and :139-160), which overwrites `inst.direction` AFTER the
// wheel has run. Both recordings alternate 90, 270, 90, 270 with no exception,
// so the wheel is exercised here and is unobservable here — the alphabet
// assertion below is what covers it.
//
// KNOWN FAILURE, ROUTE D ONLY, AND NOT THIS FAMILY'S: on `_sideb` the two
// soul-anchored assertions for this entry fail, and one cause covers both. The
// mod's soul sits at (137.7333374023, 161) for that whole turn where
// vcMoveheartDest models (gt.x - 10, gt.y - 10) = (138, 160) — the recording's
// gt is (148, 170) on BOTH routes, so the 0.2667/1 offset is not the board
// having moved. The B-Side's ac-0 arena is the narrowest in the fight
// (0.5867 x 2 against route C's 0.8 x 2) and the displacement appears before
// the plateau, while the box is still growing: that is CLAUDE.md's declared
// grow-window gap (`sim/battlebox.js` does not model the grow animation, and
// the effective border is "unverified at other scales"). The steady-state box
// does not explain it — at 0.5867 the interior spans x 128.05..167.95 and the
// soul's mask occupies 140..155, well clear. So the radii on that route are
// measured from an anchor 0.2667 px away from the mod's, and the swords
// themselves are fine: every cadence, count, grouping and heading assertion
// for this entry passes on route D. Left FAILING rather than excluded, because
// the anchor really is wrong and the fix belongs in sim/battlebox.js.
//
// ── WHY THIS FAMILY WAS NEVER LOOKED AT ───────────────────────────────────
//
// Until the recorder's watch list was fixed on 2026-08-29, atk_DiamondStorm
// and atk_Swords1 recorded as COMPLETELY EMPTY — not one spawn row. Their work
// happens inside manager objects the hardcoded list omitted (type 151 ->
// obj_tracking_swords_manager, type 152 -> obj_diagonal_bullet_manager,
// dbulletcontroller Step_0:2995-3021). "The attack does nothing" was really
// "the instrument was not looking", the mistake ORACLE-GROUND-TRUTH.md records
// under A BLANK ROW MEANT THE RECORDER WAS NOT WATCHING. So this file REFUSES
// a recording whose seq log has no manager rows: see the loud skip below.
//
// ── WHAT IS CLAIMED ───────────────────────────────────────────────────────
//
// Per entry, against the seq log grouped by `kaizo_playing` (NEVER `kaizo_atk`
// — trap #1 in the ledger; the pointer transitions at the launch frame and
// names the NEXT entry):
//
//   SET      the family object types the turn creates.
//   COUNT    how many of each, over the recording's own bullet phase.
//   SCHEDULE the spawn offsets from the launch frame, and therefore the
//            cadence and the grouping (how many land on one frame).
//   GEOMETRY the structural half: scales, speeds, the image_angle/direction
//            relation, the heading alphabet (both of the manager's two heading
//            sources), the telegraph RADIUS the sword rests at, and — wall by
//            wall — the diagonal storm's spawn column, row height, launch
//            speed and jitter phase.
//
// ── BOTH ROUTES, AND WHY THAT IS NOT COSMETIC ─────────────────────────────
//
// The route is inferred from the recording with check-oracle-schedule's own
// detectRoute and the arm follows it. This file used to run the A-Side arm
// whatever it was handed, which against `_sideb` compared atk_Swords1's ac 17
// against the B-Side's ac 112 — a DIFFERENT ATTACK (tracking_sword1 9 -> 73) —
// and reported twenty divergences, none of which was one. The B-Side is also
// the only recording that can separate the type-152 arm's per-bullet jitter
// from its lifted-wall shift, because the two share `_xoff`; see
// kaizo/attacks/diagonal-bullets.js.
//
// ── THE TYPE-152 BODY ─────────────────────────────────────────────────────
//
// atk_DiamondStorm's 336 obj_diagonal_bullet are the largest single-object
// population in the fight, and until 2026-08-29 the recorder was not watching
// for them at all. What the recording then measured, and what the sim did:
//
//        oracle                          sim (before kaizo/attacks/)
//   x    615 low / 627 lifted            615 / 615
//   spd  6 distinct over the turn        1
//
// Both are now translated in kaizo/attacks/diagonal-bullets.js and compared
// here wall by wall. The launcher does not import that module yet — see
// substituteType152.
//
// ── WHAT IS NOT CLAIMED, AND WHY EACH IS EXCLUDED ─────────────────────────
//
// ABSOLUTE FRAME NUMBERS. Every frame here is an offset from the launch frame
// the recording itself reports, never a frame index.
//
// THE TURN'S LENGTH. The recorder pilots the fight with a pulsed confirm and
// parks the soul dead centre, so the soul GRAZES the sword slashes all turn
// (`timepoints = 11` on obj_tracking_sword_slash, plus the extra-graze band's
// 1/30). That is what really ends these turns: atk_Swords1's clock is armed at
// 240 and reaches the manager's `turntimer < 70` cutoff at offset 113, not at
// 170. A sim driven by its own clock stops at a different sword. So THE
// RECORDING'S OWN `turntimer` COLUMN IS REPLAYED into the sim frame by frame,
// and the comparison window is closed where the recording's own `soul_x` goes
// empty — the frame obj_heart is swept and the bullet phase is over. Both are
// ranges taken from the recording; neither is a tolerance. The rows that set
// them are named in the per-entry output.
//
// RNG OUTCOMES. `choose(0, 45, ..., 315)` picks each sword's heading and
// `choose(+6, -6)` picks each diagonal row's slant. CLAUDE.md's honest claim is
// "mechanics one-to-one, RNG re-anchored per launch", so the streams are
// deliberately not aligned. Headings are compared as an ALPHABET and a
// relation (angle == direction + 180), never as a sequence; the diagonal rows
// are compared by their two possible shapes, never row by row.
//
// DAMAGE, HP, TP, TARGETING. The recorder pins party and boss HP to keep the
// run alive, so every survival-shaped number is a harness artifact. The two
// damage deltas this family carries are printed as NOTES and asserted nowhere.
//
// SUB-PIXEL NOISE BELOW THE RECORDING'S OWN RESOLUTION. Radii are compared at
// four decimals. That figure is not invented: the recording reports the SAME
// nominal radius with a spread of about 1.1e-5 — atk_Swords1's nine swords log
// 120.000000 and 120.000011, atk_Swords3's thirty-six log 87.999998 through
// 88.000009 — so f32 lengthdir noise is live in the fifth decimal of the
// ground truth itself. Four decimals is one decade coarser than the spread
// those rows show, and it still resolves everything that matters: it keeps
// atk_Swords3's 97.9964 slash asymptote distinct from atk_Swords1's 130.0000.
//
// ── THE ONE-FRAME CONTROLLER OFFSET, MODELLED NOT FUDGED ──────────────────
//
// In the mod the knight's dispatch creates an obj_dbulletcontroller and the
// controller's own Step creates the manager, so the manager first exists ONE
// FRAME after the launch. The sim's launcher has no controller entity — it
// spawns the manager directly at dispatch. So a sim frame f is compared
// against recording offset f + 1. That offset is declared as a constant here
// and asserted (the recording's managers must appear at offset 1); it is not a
// free parameter fitted to make the schedules line up.

import { readFileSync, existsSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn, destroy } from '../../../sim/entity.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { ensureSoul } from './scaffold-soul.mjs';
// THE KAIZO MODULE, not the vanilla one. kaizo/attacks/diagonal-bullets.js is
// the copy carrying the mod's type-152 deltas; sim/attacks/diagonal-bullets.js
// is the v1.03 original and stays the vanilla suite's subject. See
// substituteType152 below for why the import is not enough on its own.
import {
  diagonalBullet as kaizoDiagonalBullet,
  diagonalBulletManager as kaizoDiagonalBulletManager,
} from '../../attacks/diagonal-bullets.js';
// Read-only, as a CONTROL: the vanilla module must still be the v1.03 object.
import { diagonalBullet as vanillaDiagonalBullet } from '../../../sim/attacks/diagonal-bullets.js';
import {
  launchVCAttack, openVCArena, vcMoveheartDest,
} from '../../scenes/kaizo-mod-launcher.js';
// resolveTraces/readTrace are check-oracle-schedule's, imported rather than
// re-implemented so a change to where recordings live moves ONE file. That
// module runs nothing at import (its main() is behind the argv guard).
// recoverLaunches/detectRoute come from the same place for the same reason —
// the route inference has one implementation and one set of caveats.
import {
  resolveTraces, readTrace, recoverLaunches, detectRoute,
} from './check-oracle-schedule.mjs';

// ── the four rows this file owns, exactly as the generated tables have them ─
//
// `ac` is the ORDINARY route's (VC_TABLE), `acD` the B-Side's (VD_TABLE). Two
// of the four differ, and atk_Swords1's 17 -> 112 is not a difficulty tweak but
// a different attack (ORACLE-GROUND-TRUTH.md: tracking_sword1 9 -> 73). Running
// the A-Side arm against a B-Side recording therefore compares two unrelated
// turns, which is what this file used to do when handed _sideb: it reported 20
// divergences, none of which was a divergence. The route is now inferred from
// the recording and the arm follows it.
const ROWS = [
  { id: 'atk_CrescentSlash', ac: 0, acD: 0, difficulty: 0, phase: 1 },
  { id: 'atk_Swords1', ac: 17, acD: 112, difficulty: 0, phase: 1 },
  { id: 'atk_DiamondStorm', ac: 12, acD: 12, difficulty: 0, phase: 1 },
  { id: 'atk_Swords2', ac: 16, acD: 16, difficulty: 0, phase: 2 },
  { id: 'atk_Swords3', ac: 14, acD: 14, difficulty: 0, phase: 3 },
];

/** The objects this family owns. Everything else the seq log carries during
 *  these turns (obj_afterimage — the mod's unconditional rainbow trail, ~140
 *  instances a turn — and ac 16's rotating-slash payload) belongs to another
 *  family's check and is filtered out on BOTH sides. */
const FAMILY = [
  'obj_tracking_swords_manager',
  'obj_tracking_sword1',
  'obj_tracking_sword_slash',
  'obj_diagonal_bullet_manager',
  'obj_diagonal_bullet',
];
const FAMILY_SET = new Set(FAMILY);

/** dbulletcontroller Step_0: the knight creates the controller, the
 *  controller's Step creates the manager. See the header. */
const CONTROLLER_FRAME = 1;

/** manager Step_0 line 20: `choose(0, 45, 90, 135, 180, 225, 270, 315)`. */
const HEADINGS = [0, 45, 90, 135, 180, 225, 270, 315];

/** The mod's OTHER heading source: the frostveil spiral walks `anomalydir`
 *  (270 at the manager's Create — kaizo manager Create_0, and
 *  kaizo/attacks/tracking-swords.js carries it) by +20 degrees a sword and
 *  takes no RNG draw. It is what the B-Side's ac 112 (type 151 variant 11)
 *  dispatches, and the recording's eighteen spokes at 10, 30 … 350 are it. */
const ANOMALYDIR = 270;
const SPIRAL_STEP = 20;

let checks = 0;
let failures = 0;
const notes = [];

function ok(cond, label) {
  checks += 1;
  if (cond) return true;
  failures += 1;
  console.log(`    FAIL ${label}`);
  return false;
}

function eqList(got, want, label) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  return ok(a === b, `${label}\n           oracle ${b}\n           sim    ${a}`);
}

// ══════════════════════════════════════════════════════════════════════════
// READING THE RECORDING
// ══════════════════════════════════════════════════════════════════════════

/** Contiguous runs of `kaizo_playing`. A run IS one turn: the column holds the
 *  entry that fired until the next launch overwrites it, so grouping this way
 *  needs no inference and survives a MODE 1 recording. */
function playingRuns(t) {
  const out = [];
  let cur = null;
  for (const r of t.rows) {
    const k = r[t.col.kaizo_playing];
    if (!cur || cur.key !== k) {
      cur = { key: k, rows: [] };
      out.push(cur);
    }
    cur.rows.push(r);
  }
  return out;
}

const cell = (t, r, name) => {
  const i = t.col[name];
  return i === undefined ? '' : (r[i] ?? '');
};
const numOf = (t, r, name) => {
  const v = cell(t, r, name);
  return v === '' ? null : Number(v);
};

/** The seq CSV that belongs to a trace CSV (`..._trace_deep` -> `..._seq_deep`). */
function seqPathFor(tracePath) {
  const dir = dirname(tracePath);
  const name = basename(tracePath).replace('trace', 'seq');
  const p = join(dir, name);
  return existsSync(p) ? p : null;
}

// ══════════════════════════════════════════════════════════════════════════
// DRIVING THE SIM
// ══════════════════════════════════════════════════════════════════════════

/**
 * A fight-shaped state with no director, ready for a launcher call — the same
 * bench check-weirdroute uses.
 */
function bench(seed, sideb = false) {
  const st = createState({ seed, traceBulletSlots: 0 });
  buildSingleAttackScene(st, { seed, attack: 'rotating-slash', difficulty: 0 });
  ensureSoul(st); // the drill no longer spawns the soul at build (scaffold-soul.mjs)
  const dir = st.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  st.kaizo = {
    version: sideb ? 'D' : 'C', sideb, approx: [], launched: [], vars: {}, hooks: {},
  };
  // The party stands back up; this file compares what SPAWNS, and a wipe would
  // end the run for a reason that has nothing to do with the comparison.
  st.keepAlive = true;
  return st;
}

/**
 * THE LAUNCHER EDIT THIS FILE ANTICIPATES, applied here because the launcher is
 * not this cluster's to edit.
 *
 * `kaizo/scenes/kaizo-mod-launcher.js` still imports `diagonalBulletManager`
 * from `sim/attacks/diagonal-bullets.js` (its "STILL VANILLA" block), so a
 * type-152 arm spawns the v1.03 manager. The mod's manager is
 * `kaizo/attacks/diagonal-bullets.js`. Until the one-line import swap lands
 * (see this run's launcherEdits), the arm is RE-TYPED here, in place:
 *
 *   - re-typing rather than destroy+respawn keeps the entity's `seq` and its
 *     position in `state.entities`, so the spawn ordering the whole-fight
 *     differ pairs bullets by is untouched;
 *   - the kaizo Create is then run over the same instance, which is exactly
 *     what the launcher's `spawn()` would have done;
 *   - `damage` is re-applied afterwards because the launcher assigns it AFTER
 *     the spawn (`mg.damage = opts.damage ?? VC_BASE_DAMAGE`), and the kaizo
 *     Step re-pins 103 on its first frame anyway.
 *
 * IDEMPOTENT ON PURPOSE. Once the launcher import is swapped this finds the
 * kaizo type already in place and does nothing, so the check does not silently
 * start measuring something else the day the integration pass lands. The count
 * of substitutions is returned and asserted on, so "the swap never ran" cannot
 * pass as "the swap was unnecessary".
 */
function substituteType152(st) {
  let swapped = 0;
  let already = 0;
  for (const e of st.entities) {
    if (!e.alive || e.type.name !== 'obj_diagonal_bullet_manager') continue;
    if (e.type === kaizoDiagonalBulletManager) { already += 1; continue; }
    const { damage } = e;
    e.type = kaizoDiagonalBulletManager;
    kaizoDiagonalBulletManager.create(e, st);
    e.damage = damage;
    swapped += 1;
  }
  return { swapped, already };
}

/**
 * Run one V-C row and record the first frame each family object exists,
 * mirroring the recorder ("the first frame it sees each instance").
 *
 * `clock` is the recording's own turntimer column, replayed; `end` is the
 * offset at which the recording's soul goes away. See the header for why both
 * come from the recording rather than from the sim's driver.
 */
function simulate(row, clock, end, { seed = 12345, sideb = false } = {}) {
  const st = bench(seed, sideb);
  openVCArena(st, row, { sideb });
  // THE BOARD IS RAISED TWELVE FRAMES BEFORE THE ATTACK — obj_growtangle goes
  // up under mnfight 1.5 and the attack spawns under mnfight 2 at rtimer 12
  // (CLAUDE.md, "The turn's real buffers"). Launching on the same frame the
  // board starts growing puts the soul inside a wall that is still expanding,
  // and obj_battlesolid shoves it two pixels down — which then moves every
  // sword, because the manager anchors them to obj_heart. The recording shows
  // the board already 73% grown at offset 0 (atk_Swords1: gt_xs 0.743 of its
  // 1.0133 plateau), which is what a 12-frame lead into a 15-frame grow looks
  // like. Pre-rolling reproduces the mod's own ordering.
  st.turntimer = clock[0];
  for (let i = 0; i < 12; i++) {
    stepFrame(st, {});
    st.partyHp = st.partyHp.map(() => 100);
    st.gameOver = false;
    st.turntimer = clock[0];
  }
  // scr_moveheart's destination for this row — the launcher's OWN model of
  // where the Knight delivers the soul, not a number invented here. The
  // recording confirms it: soul_x/soul_y hold at ONE point for every frame of
  // each turn — (310, 160) for the four wide boards, (138, 160) for ac 0's
  // 0.8-wide one — and that is asserted below.
  const gt = st.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
  const dest = vcMoveheartDest(row, gt, st.view);
  st.soul.x = dest.x;
  st.soul.y = dest.y;
  // grazePrev is the soul's position as of LAST frame (+10 on both axes) — the
  // value the manager and the sword both aim at. Seeding it with the delivered
  // position keeps the first sword from aiming at where the soul used to be.
  st.grazePrev = { x: st.soul.x + 10, y: st.soul.y + 10 };

  st.turntimer = clock[CONTROLLER_FRAME] ?? clock[0];
  launchVCAttack(st, row, { sideb });
  const routed = substituteType152(st);

  const seen = new Set();
  const out = [];
  for (let f = 0; f + CONTROLLER_FRAME < end; f++) {
    for (const e of st.entities) {
      if (!e.alive || !FAMILY_SET.has(e.type.name) || seen.has(e.seq)) continue;
      seen.add(e.seq);
      out.push({
        off: f + CONTROLLER_FRAME,
        object: e.type.name,
        x: e.x,
        y: e.y,
        angle: e.image_angle,
        xscale: e.image_xscale,
        yscale: e.image_yscale,
        direction: e.direction,
        speed: e.speed,
      });
    }
    stepFrame(st, {});
    st.partyHp = st.partyHp.map(() => 100);
    st.gameOver = false;
    st.turntimer = Number(clock[f + CONTROLLER_FRAME + 1] ?? clock[clock.length - 1]);
  }
  return { st, rows: out, soul: { x: st.soul.x, y: st.soul.y }, routed };
}

// ══════════════════════════════════════════════════════════════════════════
// THE COMPARABLE SHAPES
// ══════════════════════════════════════════════════════════════════════════

const byType = (rows) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.object)) m.set(r.object, []);
    m.get(r.object).push(r);
  }
  return m;
};
const offsets = (rows) => [...new Set(rows.map((r) => r.off))].sort((a, b) => a - b);
const gapsOf = (rows) => {
  const f = offsets(rows);
  return f.slice(1).map((v, i) => v - f[i]);
};
/** how many land together, per spawn frame — the mod's paired managers show 2. */
const groupSizes = (rows) => offsets(rows).map((f) => rows.filter((r) => r.off === f).length);
const uniq = (rows, fn) => [...new Set(rows.map(fn))].sort();
const f4 = (v) => Number(v).toFixed(4);
const f6 = (v) => Number(v).toFixed(6);

/** The radius the telegraph rests at, measured from where the manager aims:
 *  `obj_heart.x + 10`, `obj_heart.y + 10` (manager Step_0:112-118). */
const radiusOf = (r, ax, ay) => Math.hypot(r.x - ax, r.y - ay);

/** One diagonal wall, reduced to the shape that is not an RNG outcome. */
function diagonalRows(rows) {
  return offsets(rows).map((off) => {
    const g = rows.filter((r) => r.off === off);
    const ys = g.map((r) => r.y);
    // THE JITTER'S PHASE. The wall's bullets are created in index order and
    // `gapsize` is positive, so sorting by y recovers that order on a low wall
    // and on a lifted one alike. `phase` is which side of the column bullet 0
    // sits on relative to bullet 1: 0 when they share a column (the A-Side,
    // which takes no jitter), +1 or -1 on the B-Side. See the assertion.
    const byY = [...g].sort((a, b) => a.y - b.y);
    const phase = byY.length > 1 ? Math.sign(byY[0].x - byY[1].x) : 0;
    return {
      off,
      n: g.length,
      phase,
      x: uniq(g, (r) => f6(r.x)),
      speed: uniq(g, (r) => f6(r.speed)),
      // The wall is 24 bullets 56px apart; `_vspeed > 0` lifts the whole column
      // by (bulletcount * gapsize) - 300 = 1044. So a row is either the low
      // column or the lifted one, and which is an RNG draw.
      lifted: Math.min(...ys) < 0,
      span: [Math.min(...ys), Math.max(...ys)],
    };
  });
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

function main() {
  let path = process.argv[2];
  if (!path) {
    const { dir, found, looked } = resolveTraces();
    if (!dir) {
      // A LOUD SKIP, NEVER A SILENT PASS — the same convention
      // check-oracle-schedule uses, and for the same reason: a green kaizo gate
      // with no oracle line in it means nothing was held against the real mod.
      console.log('SKIP check-oracle-tracking: no kaizo oracle recording found');
      for (const l of looked) console.log(`     looked in ${l}`);
      console.log('     Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,');
      console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
      console.log('     NOTHING IN THIS FAMILY IS HELD AGAINST THE REAL MOD WITHOUT IT.');
      return 0;
    }
    // The longest recording, same rule as check-oracle-schedule: MODE 1 locks
    // are short and replay one entry, so they cannot carry five turns.
    path = found
      .map((f) => join(dir, f))
      .map((p) => ({ p, n: readFileSync(p, 'utf8').length }))
      .sort((a, b) => b.n - a.n)[0].p;
  }

  const seqPath = seqPathFor(path);
  console.log(`check-oracle-tracking: ${path}`);
  if (!seqPath) {
    console.log('SKIP check-oracle-tracking: that recording has no companion seq CSV');
    console.log(`     expected ${basename(path).replace('trace', 'seq')} beside it.`);
    console.log('     The trace CSV is one row per FRAME; spawns live only in the seq CSV.');
    return 0;
  }
  console.log(`  seq: ${seqPath}`);

  const trace = readTrace(path);
  const seq = readTrace(seqPath);
  for (const need of ['frame', 'kaizo_playing', 'turntimer', 'soul_x', 'gt_x']) {
    if (trace.col[need] === undefined) {
      console.log(`FAIL check-oracle-tracking: ${path} has no "${need}" column`);
      return 1;
    }
  }
  for (const need of ['frame', 'object', 'x', 'y', 'angle', 'xscale', 'yscale',
    'direction', 'speed', 'kaizo_playing']) {
    if (seq.col[need] === undefined) {
      console.log(`FAIL check-oracle-tracking: ${seqPath} has no "${need}" column`);
      return 1;
    }
  }

  // THE WATCH-LIST GATE. A recording made before 2026-08-29 has no manager
  // rows at all, and this family is ENTIRELY manager-driven — so it would read
  // as "the mod creates nothing", the exact false negative
  // ORACLE-GROUND-TRUTH.md was written to stop. Refuse it loudly instead.
  const sawManager = seq.rows.some((r) => {
    const o = cell(seq, r, 'object');
    return o === 'obj_tracking_swords_manager' || o === 'obj_diagonal_bullet_manager';
  });
  if (!sawManager) {
    console.log('SKIP check-oracle-tracking: this recording predates the manager watch list.');
    console.log('     obj_tracking_swords_manager / obj_diagonal_bullet_manager appear');
    console.log('     nowhere in its seq log, and THIS WHOLE FAMILY LIVES INSIDE THEM —');
    console.log('     ac 17/12/16/14 would read as "the attack does nothing", which is');
    console.log('     what the pre-2026-08-29 recorder really did report.');
    console.log('     Re-record with the fixed watch list (_deep or later).');
    return 0;
  }

  // ── WHICH ROUTE IS THIS? ─────────────────────────────────────────────────
  // Inferred with check-oracle-schedule's own detectRoute (the three
  // discriminating entries and nothing else — see its header for why a vote
  // over all 31 would be wrong). An AMBIGUOUS recording carries none of the
  // three, and since the tables agree everywhere else, running it as the
  // ordinary route is correct; the log says so rather than picking silently.
  const det = detectRoute(recoverLaunches(trace));
  const route = det.route ?? 'C';
  const sideb = route === 'D';
  if (det.conflict) {
    console.log('FAIL check-oracle-tracking: this recording carries BOTH routes\''
      + ' signatures, which the mod cannot produce.');
    for (const e of det.evidence) console.log(`     ${e}`);
    return 1;
  }
  console.log(`  route ${route}${det.ambiguous ? ' (AMBIGUOUS — no discriminating entry'
    + ' in this recording; the tables agree everywhere else, so C is checked)' : ''}`
    + `${det.evidence?.length ? ` from ${det.evidence.join(', ')}` : ''}`);

  const tRuns = playingRuns(trace);
  const sRuns = playingRuns(seq);

  let entriesCompared = 0;
  let simSpawnsSeen = 0;
  let oracleSpawnsSeen = 0;
  let substitutions = 0;

  for (const base of ROWS) {
    // The row AS THIS ROUTE DISPATCHES IT. Two of the four change ac on the
    // B-Side and one of those is a different attack entirely.
    const row = { ...base, ac: sideb ? base.acD : base.ac };
    const tr = tRuns.find((r) => r.key === row.id);
    const sr = sRuns.find((r) => r.key === row.id);
    console.log(`\n  ${row.id}  (ac ${row.ac}, difficulty ${row.difficulty}, phase ${row.phase})`);
    if (!tr) {
      console.log('    SKIP — this recording never played this entry.');
      continue;
    }

    const f0 = numOf(trace, tr.rows[0], 'frame');
    const clock = tr.rows.map((r) => numOf(trace, r, 'turntimer'));

    // THE WINDOW. The `kaizo_playing` run reaches all the way to the NEXT
    // launch, so it swallows the menu and the next turn's board. The BULLET
    // PHASE is the stretch where obj_heart exists; the frame soul_x goes empty
    // is the frame the turn's bullets are swept.
    let end = tr.rows.length;
    for (let i = 0; i < tr.rows.length; i++) {
      if (cell(trace, tr.rows[i], 'soul_x') === '') { end = i; break; }
    }

    // THE SOUL WAS PARKED. Every geometry claim below is relative to where the
    // manager aims (obj_heart + 10), so a moving soul would make the radii
    // meaningless. Asserted, not assumed — and if a future recording is made
    // with a moving soul this fails loudly instead of comparing rings that
    // were never concentric.
    const souls = tr.rows.slice(0, end)
      .map((r) => `${numOf(trace, r, 'soul_x')},${numOf(trace, r, 'soul_y')}`);
    const soulSet = [...new Set(souls)];
    ok(soulSet.length === 1,
      `the recorded soul holds one position for the whole bullet phase (saw ${soulSet.join(' ')})`);
    const [ax0, ay0] = soulSet[0].split(',').map(Number);
    const anchor = { x: ax0 + 10, y: ay0 + 10 };

    const oracle = (sr ? sr.rows : [])
      .map((r) => ({
        off: numOf(seq, r, 'frame') - f0,
        object: cell(seq, r, 'object'),
        x: numOf(seq, r, 'x'),
        y: numOf(seq, r, 'y'),
        angle: numOf(seq, r, 'angle'),
        xscale: numOf(seq, r, 'xscale'),
        yscale: numOf(seq, r, 'yscale'),
        direction: numOf(seq, r, 'direction'),
        speed: numOf(seq, r, 'speed'),
      }))
      .filter((r) => FAMILY_SET.has(r.object) && r.off < end);

    if (!oracle.length) {
      // Degenerate, and it must never read like a pass. Every entry here is
      // manager-driven, so "no family spawns" is a broken instrument.
      console.log('    FAIL — the recording logged NO family spawn for this entry.');
      failures += 1;
      checks += 1;
      continue;
    }

    const { st, rows: sim, soul, routed } = simulate(row, clock, end, { sideb });
    entriesCompared += 1;
    oracleSpawnsSeen += oracle.length;
    simSpawnsSeen += sim.length;
    substitutions += routed.swapped + routed.already;

    console.log(`    window: offsets 0..${end - 1} (soul_x goes empty at ${end}),`
      + ` clock ${clock[0]} -> ${clock[end - 1]} replayed from the recording`);
    console.log(`    soul parked at (${ax0}, ${ay0}); sim delivered to (${soul.x}, ${soul.y})`);

    // The sim's soul must sit where the recording's did, or every radius below
    // is measured from a different centre.
    ok(soul.x === ax0 && soul.y === ay0,
      `vcMoveheartDest puts the soul where the recording had it`);

    // No launch may have been silently clamped to a difficulty the sim
    // implements — a POSITIVE check that the arm ran as written.
    //
    // ONE ROW IS EXPECTED, AND ONLY WHILE THE LAUNCHER EDIT IS PENDING. The
    // launcher's VANILLA_BODIES table ledgers type 152 as "the mod's
    // DiamondStorm body is not translated". That is now a statement about the
    // launcher's IMPORT rather than about the body: the body is translated, in
    // kaizo/attacks/diagonal-bullets.js, and substituteType152 is standing in
    // for the one-line routing swap. So that row is admitted — and ONLY that
    // row, and ONLY when the substitution actually fired. The moment the
    // launcher routes to the kaizo module, `routed.swapped` is 0, the whole
    // ledger has to be empty again, and the VANILLA_BODIES entry must be
    // deleted in the same edit or this fails. Nothing else is excused: a
    // clamped difficulty on any other type still fails here.
    const pending = st.kaizo.approx.filter((a) => a.type === 152 && a.asked === 'type 152 body');
    const rest = st.kaizo.approx.filter((a) => !(a.type === 152 && a.asked === 'type 152 body'));
    eqList(rest, [], 'the launch ledgered no approximation');
    ok(pending.length === (routed.swapped ? 1 : 0),
      'the launcher\'s pending type-152 ledger row is present exactly while'
      + ` substituteType152 is standing in (swapped ${routed.swapped},`
      + ` ledger rows ${pending.length})`);

    // ── the object SET ────────────────────────────────────────────────────
    const oTypes = uniq(oracle, (r) => r.object);
    const sTypes = uniq(sim, (r) => r.object);
    eqList(sTypes, oTypes, 'the set of family object types the turn creates');
    ok(oTypes.every((t) => FAMILY.includes(t)) && oTypes.length > 0,
      `the recording's types for this entry are all family objects (${oTypes.join(', ')})`);

    const entryStart = { checks, failures };
    for (const type of oTypes) {
      const o = oracle.filter((r) => r.object === type);
      const s = sim.filter((r) => r.object === type);
      const tag = `${type}`;

      // THE LEDGER, PRINTED WHETHER OR NOT IT PASSES. This measurement is the
      // only description of what these five turns actually build that exists
      // anywhere in the tree, and it belongs in the log — the same reason
      // check-oracle-schedule prints the chain it recovered.
      const gs = [...new Set(groupSizes(o))];
      console.log(`    ${tag.padEnd(29)} x${String(o.length).padStart(3)}`
        + `  offsets ${offsets(o).slice(0, 10).join(',')}${offsets(o).length > 10 ? ',…' : ''}`
        + `  gaps ${[...new Set(gapsOf(o))].join('/') || '—'}`
        + `  ${gs.length === 1 && gs[0] > 1 ? `${gs[0]} per frame` : ''}`);

      // ── COUNT ───────────────────────────────────────────────────────────
      ok(o.length === s.length,
        `${tag}: count — oracle ${o.length}, sim ${s.length}`);

      // ── SCHEDULE: offsets, cadence, grouping ────────────────────────────
      eqList(offsets(s), offsets(o), `${tag}: spawn offsets from the launch frame`);
      eqList(gapsOf(s), gapsOf(o), `${tag}: cadence (gaps between spawn frames)`);
      eqList(groupSizes(s), groupSizes(o), `${tag}: how many spawn on each frame`);

      if (!o.length || !s.length) continue;

      // ── GEOMETRY, per type ──────────────────────────────────────────────
      if (type === 'obj_tracking_swords_manager' || type === 'obj_diagonal_bullet_manager') {
        // instance_create(obj_growtangle.x, cameray(), ...) — the manager is
        // parked at the camera top and never moves. Every field is exact.
        for (const k of ['x', 'y', 'angle', 'xscale', 'yscale', 'direction', 'speed']) {
          eqList(uniq(s, (r) => f6(r[k])), uniq(o, (r) => f6(r[k])), `${tag}: ${k}`);
        }
        // THE ONE-FRAME CONTROLLER OFFSET, asserted rather than assumed. The
        // header says a sim frame f is compared against recording offset
        // f + CONTROLLER_FRAME because obj_dbulletcontroller's Step — not the
        // knight's dispatch — creates the manager. If the mod ever created it
        // at dispatch, every schedule above would be off by one and this is
        // the assertion that says so out loud instead.
        eqList(offsets(o), [CONTROLLER_FRAME],
          `${tag}: the mod's manager first exists ${CONTROLLER_FRAME} frame after`
          + ' the launch (obj_dbulletcontroller Step_0, not the knight\'s dispatch)');
      }

      if (type === 'obj_tracking_sword1' || type === 'obj_tracking_sword_slash') {
        // The slash is a 900x1 bar along the sword's heading; the sword is 1x1.
        eqList(uniq(s, (r) => f6(r.xscale)), uniq(o, (r) => f6(r.xscale)), `${tag}: image_xscale`);
        eqList(uniq(s, (r) => f6(r.yscale)), uniq(o, (r) => f6(r.yscale)), `${tag}: image_yscale`);
        eqList(uniq(s, (r) => f6(r.speed)), uniq(o, (r) => f6(r.speed)), `${tag}: speed (these never move)`);

        // `inst.image_angle = inst.direction + 180` (manager Step_0:70 and
        // again at :118) — assigned WITHOUT a wrap, which is why both sides
        // log 495 for a heading of 315. Asserted as the relation, so it holds
        // whatever headings the stream happened to roll.
        const rel = (arr) => uniq(arr, (r) => f6(r.angle - r.direction));
        eqList(rel(s), rel(o), `${tag}: image_angle - direction`);
        ok(rel(o).length === 1 && rel(o)[0] === '180.000000',
          `${tag}: the mod really assigns image_angle = direction + 180 (unwrapped)`);

        // ── THE HEADING ALPHABET ──────────────────────────────────────────
        //
        // Not the sequence: which octant each sword took is an RNG outcome and
        // is deliberately not aligned.
        //
        // THE MANAGER HAS TWO HEADING SOURCES, and the old form of this
        // assertion knew about only one:
        //
        //   * manager Step_0:20, `choose(0, 45, ..., 315)` — the ordinary
        //     spawn, one draw a sword;
        //   * the mod's FROSTVEIL spiral, which walks `anomalydir` (270 at the
        //     manager's Create) by +20 a sword and takes NO draw at all.
        //
        // The B-Side's atk_Swords1 is ac 112, which is the spiral, and the
        // recording says so without ambiguity: eighteen spokes at 10, 30, 50 …
        // 350, twenty degrees apart, not one of them an octant. So the octant
        // test FAILED ON THE RECORDING ITSELF for that row — an assertion
        // measuring the instrument rather than the sim, the same shape as the
        // MODE 1 phantom launches in ORACLE-GROUND-TRUTH.md. It is REPLACED,
        // not dropped: every heading on either side must still belong to one of
        // the manager's two alphabets, and for the octant variants that is
        // exactly the old claim.
        const onOctant = (d) => HEADINGS.includes(d);
        const onSpiral = (d) => Number.isInteger((d - ANOMALYDIR) / SPIRAL_STEP);
        const alphabet = (arr) => uniq(arr, (r) => r.direction).map(Number);
        const named = `choose(0,45,...,315) or the frostveil spiral`
          + ` (${ANOMALYDIR} + ${SPIRAL_STEP}k)`;
        ok(alphabet(o).every((d) => onOctant(d) || onSpiral(d)),
          `${tag}: every recorded heading is ${named} — saw ${alphabet(o).join(',')}`);
        ok(alphabet(s).every((d) => onOctant(d) || onSpiral(d)),
          `${tag}: every simulated heading is ${named} — saw ${alphabet(s).join(',')}`);

        // AND WHERE THE HEADINGS ARE NOT AN RNG OUTCOME, COMPARE THEM. The
        // spiral consumes no draw, so its alphabet is fully determined and the
        // "deliberately not aligned" exemption above does not apply to it. This
        // is only skipped when the recording's own headings include an octant
        // the spiral cannot produce, i.e. when a draw really was involved.
        // 90 and 270 sit on BOTH wheels, so "all on the spiral" is not enough
        // on its own — a lucky octant run of 90s and 270s would qualify. At
        // least one heading has to be off the octant wheel entirely.
        const spiralOnly = (arr) => arr.length > 0
          && arr.every((d) => onSpiral(d)) && arr.some((d) => !onOctant(d));
        if (spiralOnly(alphabet(o))) {
          eqList(alphabet(s).sort((a, b) => a - b), alphabet(o).sort((a, b) => a - b),
            `${tag}: the frostveil spiral's headings (no RNG draw, so compared)`);
        }

        // THE RADIUS. This is the load-bearing geometry of the whole family:
        // the sword hovers at `len` from the soul and eases out to
        // `lenstart + 10` before it fires, so the SWORD ring and the SLASH ring
        // are different sizes, and variant 10 (ac 14) shrinks both. Four
        // decimals — see the header for where that figure comes from.
        const rad = (arr) => uniq(arr, (r) => f4(radiusOf(r, anchor.x, anchor.y)));
        eqList(rad(s), rad(o), `${tag}: telegraph radius from (soul + 10)`);
      }

      if (type === 'obj_diagonal_bullet') {
        eqList(uniq(s, (r) => f6(r.angle)), uniq(o, (r) => f6(r.angle)), `${tag}: image_angle`);
        eqList(uniq(s, (r) => f6(r.xscale)), uniq(o, (r) => f6(r.xscale)), `${tag}: image_xscale`);
        eqList(uniq(s, (r) => f6(r.yscale)), uniq(o, (r) => f6(r.yscale)), `${tag}: image_yscale`);

        const oRows = diagonalRows(o);
        const sRows = diagonalRows(s);
        eqList(sRows.map((r) => r.n), oRows.map((r) => r.n),
          `${tag}: bullets per wall (bulletcount = 24)`);
        // The SHAPES a wall can take, as a set: the low column and the one the
        // `_vspeed > 0` branch lifts by 1044. Which row is which is the
        // `choose(+6, -6)` draw and is not compared.
        const shapes = (rr) => [...new Set(rr.map((r) => `${r.lifted}:${r.span.join('..')}`))].sort();
        eqList(shapes(sRows), shapes(oRows), `${tag}: the two wall shapes`);

        // ── THE SPAWN COLUMN, WALL BY WALL ────────────────────────────────
        //
        // This assertion REPLACES the older `columnMap` one — which reduced the
        // first nine walls to {slant -> spawn x} — and it is strictly stronger
        // on the A-Side (it pins EVERY wall's column, not one per slant) while
        // being the only one of the two that is correct on the B-Side. The old
        // shape keyed on the slant, which is the `choose(+6, -6)` DRAW; on the
        // B-Side the column depends on `rownum` parity instead, so keying by
        // slant compared the sim's RNG against the recording's and would have
        // failed for a reason that is not a divergence. Nothing is loosened:
        // the +12 lift the old assertion existed to catch still fails this one
        // if it is missing.
        //
        // What is deterministic, on both routes:
        //   * a wall is created at obj_growtangle.x + `_xx`, and `_xx` is +300
        //     except on the B-Side's ODD walls, where it is -300 and the
        //     hspeed sign flips (manager Step_0:10-14);
        //   * the seq log's x is END OF FRAME, so it already carries that
        //     frame's hspeed — which the brake walks toward 0 by 0.05;
        //   * the B-Side's per-bullet jitter is a fixed alternating +/-6, and
        //     `_xoff * 2` on a lifted wall uses the ALREADY-FLIPPED value, so
        //     it maps the {-6, +6} pair onto ITSELF. The column set is the same
        //     whichever way the wall slants.
        // The only thing the RNG picks is the slant, and on the A-Side that
        // contributes a flat +12 which is removed here.
        const liftShift = sideb ? 0 : 12;
        const column = (r) => r.x
          .map((v) => f6(Number(v) - (r.lifted ? liftShift : 0)))
          .sort();
        eqList(sRows.map(column), oRows.map(column),
          `${tag}: the spawn column of every wall, lift removed`
          + ` (the mod shifts a LIFTED wall by _xoff * 2)`);

        // ── THE JITTER'S PHASE, AND WHY IT IS ASSERTED SEPARATELY ─────────
        //
        // On the B-Side the lift maps the ±6 jitter pair ONTO ITSELF, so the
        // column SET above cannot see `inst.x += _xoff * 2` at all: dropping
        // that line entirely leaves every B-Side column unchanged and only
        // swaps which bullet sits on which side. That is a divergence a set
        // comparison is structurally blind to, so it is measured directly —
        // bullet 0 against bullet 1, in creation order.
        //
        //   A-Side   no jitter, one column        -> phase 0 on every wall
        //   B-Side   low wall: bullet 0 is +6     -> phase +1
        //            LIFTED:  `_xoff` has already flipped for bullet 0, so the
        //                     lift carries it to -6                -> phase -1
        //
        // Keying on the slant is correct HERE (unlike the old columnMap) — the
        // phase is a deterministic function of it, not of which slant the RNG
        // happened to roll. Each side is reduced over its OWN walls, and a
        // single-valued list per slant also asserts the phase never wavered
        // within a slant.
        const phaseBySlant = (rr) => {
          const m = { low: [], lifted: [] };
          for (const r of rr) m[r.lifted ? 'lifted' : 'low'].push(r.phase);
          return {
            low: [...new Set(m.low)].sort(),
            lifted: [...new Set(m.lifted)].sort(),
          };
        };
        eqList(phaseBySlant(sRows), phaseBySlant(oRows),
          `${tag}: which side of the column bullet 0 sits on, by slant`
          + ' (the B-Side lift uses the ALREADY-FLIPPED _xoff)');

        // ── THE BRAKE ─────────────────────────────────────────────────────
        // Once `rate` would drop below 8 the mod sets `stoptime = 1` and from
        // then on runs scr_approach(hspeed, 0, 0.05) on the manager AND on
        // every live bullet, so the last walls crawl. `|vspeed|` is 6 whichever
        // way the slant fell, so a wall's speed is hypot(6, |hspeed|) and the
        // whole SEQUENCE is RNG-independent — compared in order, not as a set.
        eqList(sRows.map((r) => r.speed), oRows.map((r) => r.speed),
          `${tag}: the launch speed of every wall, in order (stoptime braking)`);
        const speeds = (rr) => [...new Set(rr.map((r) => r.speed.join('/')))];
        ok(speeds(sRows).length === speeds(oRows).length,
          `${tag}: distinct launch speeds over the turn — oracle ${speeds(oRows).length}`
          + ` (${speeds(oRows).join(', ')}), sim ${speeds(sRows).length}`
          + ` (${speeds(sRows).join(', ')})`);
        const slower = (rr) => Number(rr[rr.length - 1].speed[0]) < Number(rr[0].speed[0]);
        ok(slower(oRows), `${tag}: the recording's last wall IS slower than its first`
          + ` (${oRows[oRows.length - 1].speed[0]} < ${oRows[0].speed[0]})`);
        ok(slower(sRows), `${tag}: the sim's last wall is slower than its first`
          + ` (stoptime braking) — sim ${sRows[sRows.length - 1].speed[0]}`
          + ` vs ${sRows[0].speed[0]}`);
      }
    }
    const ran = checks - entryStart.checks;
    const bad = failures - entryStart.failures;
    console.log(bad
      ? `    ${bad} FAILURE(S) of ${ran} assertions on this entry`
      : `    ${ran} assertions   OK`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // A DELTA THE SEQ LOG CANNOT SEE, read out of the mod's GML instead.
  //
  // The seq CSV records CREATIONS, so a lifetime is invisible in it. The mod's
  // obj_diagonal_bullet Step_0 destroys at `timer > 180`; the base game's (and
  // the sim module's) is `timer > 260`. Asserted directly against the sim
  // rather than against the recording, and labelled as such.
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n  obj_diagonal_bullet lifetime (from the mod\'s GML, not the recording)');
  {
    const lifetimeOf = (type) => {
      const st = bench(4242);
      const b = spawn(st, type, { x: 900, y: 900 });
      for (let f = 1; f <= 400; f += 1) {
        stepFrame(st, {});
        st.partyHp = st.partyHp.map(() => 100);
        st.gameOver = false;
        if (!b.alive) return f;
      }
      return -1;
    };
    const kaizoLife = lifetimeOf(kaizoDiagonalBullet);
    ok(kaizoLife === 181,
      'kaizo obj_diagonal_bullet Step_0 destroys at `timer > 180`, so a bullet'
      + ` lives 181 frames — kaizo/attacks/diagonal-bullets.js kept it for ${kaizoLife}`
      + ' (261 is the VANILLA lifetime, `timer > 260`)');
    // THE CONTROL. Two modules with the same object name is exactly the shape
    // that reads as a pass when the copy accidentally aliases the original —
    // and "unchanged" and "correct" look identical to a regression test
    // (CLAUDE.md, "A green suite does not mean a change took effect"). So the
    // vanilla module is measured in the same bench and must STILL be 261: this
    // pair of numbers is what proves the kaizo copy is a distinct object and
    // that sim/ was not edited to get here.
    const vanillaLife = lifetimeOf(vanillaDiagonalBullet);
    ok(vanillaLife === 261,
      'the vanilla sim/attacks/diagonal-bullets.js bullet still lives 261 frames'
      + ` (measured ${vanillaLife}) — the kaizo copy is a separate object and`
      + ' sim/ is untouched');
    ok(kaizoDiagonalBullet !== vanillaDiagonalBullet,
      'the two obj_diagonal_bullet types are distinct objects');
  }

  // ══════════════════════════════════════════════════════════════════════
  // POSITIVE EXECUTION ASSERTIONS.
  //
  // Everything above is a comparison, and a comparison that never ran agrees
  // with everything. These distinguish "the diff ran and matched" from "the
  // diff found nothing to look at" — the failure mode CLAUDE.md records under
  // "Positive execution assertions" and "A green suite does not mean a change
  // took effect".
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n  positive execution assertions');
  const posStart = { checks, failures };
  ok(entriesCompared === ROWS.length,
    `all ${ROWS.length} family entries were compared (ran ${entriesCompared})`);
  ok(oracleSpawnsSeen >= 400,
    `the recording supplied family spawn rows to compare (${oracleSpawnsSeen};`
    + ' the five turns carry 4+4+1, 9+8+1, 336+10+10+1+1, 10+10+2 and 36+36+2)');
  ok(simSpawnsSeen >= 400, `the sim produced family spawns to compare (${simSpawnsSeen})`);
  // THE TYPE-152 ROUTING RAN. Exactly one diagonal manager exists, in exactly
  // one of the five turns, and it must be the KAIZO object by the time the
  // comparison reads it — whether the launcher already routes there or
  // substituteType152 stood in. Without this, a substitution that silently
  // stopped matching (a renamed export, an import reverted) would leave the
  // vanilla manager in place and every diagonal assertion would go back to
  // measuring v1.03 while the log still said OK.
  ok(substitutions === 1,
    'the type-152 arm produced exactly one diagonal manager carrying the KAIZO'
    + ` module (saw ${substitutions})`);

  // NON-VACUITY CONTROLS. If the launcher's arms were wired to the wrong
  // controller types every comparison above could still pass by both sides
  // being empty, so name what must and must NOT appear.
  {
    const probe = (base) => {
      const row = { ...base, ac: sideb ? base.acD : base.ac };
      const tr = tRuns.find((r) => r.key === row.id);
      if (!tr) return null;
      const clock = tr.rows.map((r) => numOf(trace, r, 'turntimer'));
      let end = tr.rows.length;
      for (let i = 0; i < tr.rows.length; i++) {
        if (cell(trace, tr.rows[i], 'soul_x') === '') { end = i; break; }
      }
      return byType(simulate(row, clock, end, { sideb }).rows);
    };
    // BY ID, NEVER BY INDEX. These were `ROWS[0..3]`, and inserting
    // atk_CrescentSlash at the head of ROWS silently re-pointed every one of
    // them at the wrong entry — ac 12's probe read atk_Swords1 and failed, on a
    // B-Side recording that had been green. The probe answers "which arm did
    // the launcher wire", so it has to name the arm.
    const byId = (id) => {
      const base = ROWS.find((r) => r.id === id);
      return base ? probe(base) : null;
    };
    const s0 = byId('atk_CrescentSlash');
    const s17 = byId('atk_Swords1');
    const s12 = byId('atk_DiamondStorm');
    const s16 = byId('atk_Swords2');
    const s14 = byId('atk_Swords3');
    if (s0) {
      // ac 0 arms type 109 (the crescent generator, another family's) and then
      // type 151 at difficulty 6 — Other_23:169-178. Only the tracking half is
      // this file's, so the assertion is "one tracking manager, and the
      // diagonal arm was NOT wired here".
      ok(s0.get('obj_tracking_swords_manager')?.length === 1
        && !s0.has('obj_diagonal_bullet_manager'),
      'ac 0 arms ONE tracking manager (type 109, then type 151 difficulty 6)');
    }
    if (s17) {
      ok(s17.get('obj_tracking_swords_manager')?.length === 1
        && !s17.has('obj_diagonal_bullet_manager'),
      `ac ${sideb ? 112 : 17} arms ONE tracking manager and no diagonal manager`);
    }
    if (s12) {
      ok(s12.get('obj_diagonal_bullet_manager')?.length === 1
        && s12.get('obj_tracking_swords_manager')?.length === 1,
      'ac 12 arms one diagonal manager AND one tracking manager (type 152 then 151)');
    }
    if (s16) {
      ok(s16.get('obj_tracking_swords_manager')?.length === 2,
        'ac 16 arms TWO tracking managers (type 104, then type 151 twice)');
    }
    if (s14) {
      ok(s14.get('obj_tracking_swords_manager')?.length === 2,
        'ac 14 arms TWO tracking managers — the mod dispatches type 151 twice'
        + ' (Other_23:388-401), which is why atk_Swords3 spawns swords in pairs');
    }
  }
  {
    const ran = checks - posStart.checks;
    const bad = failures - posStart.failures;
    console.log(bad ? `    ${bad} FAILURE(S) of ${ran}` : `    ${ran} assertions   OK`);
  }

  for (const n of notes) console.log(`  NOTE: ${n}`);

  console.log('');
  if (failures) {
    console.log(`  ${failures} FAILURE(S) of ${checks} assertions against the real mod.`);
    console.log('  Every other assertion in this file AGREED, so the failures above are');
    console.log('  a report about the sim, not about the comparison. See the file header.');
    return 1;
  }
  console.log(`  ${checks} assertions against the real mod   OK`);
  console.log('  (object set, per-type counts, spawn cadence and grouping, and the');
  console.log('   structural geometry of five turns — NOT turn length, NOT RNG');
  console.log('   outcomes, NOT damage.)');
  return 0;
}

// The mod's damage/field deltas for this family, printed rather than asserted:
// the recorder pins HP, so nothing survival-shaped in the recording measures
// them. Both were read from the dump.
notes.push('dbulletcontroller Step_0:3014 sets `damage = 103` on the type-152'
  + ' dispatch, and the mod re-pins it from BOTH Steps every frame'
  + ' (manager Step_0:2 and :20, bullet Step_0:2). kaizo/attacks/diagonal-bullets.js'
  + ' now carries all three lines, so the launcher\'s VC_BASE_DAMAGE (260) is'
  + ' overwritten on the manager\'s first frame. Translated but NOT asserted —'
  + ' damage is a harness-pinned quantity in this recording.');
notes.push('the mod’s obj_diagonal_bullet_manager Create sets `element = 5`'
  + ' (vanilla 0). Carried in kaizo/attacks/diagonal-bullets.js; invisible in'
  + ' the seq log, and nothing in the translated tree branches on it yet.');
// 2026-08-29, the integration pass: the import swap LANDED, together with the
// deletion of VANILLA_BODIES[152]. substituteType152() now finds the kaizo type
// already in place on every launch and does nothing, and the assertion above
// (`pending.length === (routed.swapped ? 1 : 0)`) is what proves the two halves
// landed together — it is red if either one is reverted alone. Kept, because it
// is the thing that would catch a revert.
notes.push('kaizo/scenes/kaizo-mod-launcher.js now imports diagonalBulletManager'
  + ' from kaizo/attacks/diagonal-bullets.js, so the type-152 arm spawns the'
  + ' KAIZO manager and the VANILLA_BODIES[152] ledger row is gone.'
  + ' substituteType152() is therefore a no-op standing guard: it still counts'
  + ' what it found, and the ledger assertion above fails if the import is'
  + ' reverted without the ledger row coming back, or the reverse.');

// pathToFileURL: on Windows argv[1] is a `D:\...` path and import.meta.url is
// a `file:///D:/...` URL, so the older `file://${argv[1]}` form is always false
// and main() would silently never run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
