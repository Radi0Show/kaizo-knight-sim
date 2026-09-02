#!/usr/bin/env node
// THE MULTISLASH FAMILY, HELD AGAINST THE RECORDINGS.
//
//   node kaizo/tools/checks/check-oracle-multislash.mjs [seq.csv [--sideb]]
//
// V-C / V-D recreation of EnderCat8's "Kaizo Roaring Knight" v2.3.3 — do not
// publish without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// check-oracle-schedule proves the fight SELECTS the right entries in the
// right order and raises the right board. It says nothing about what happens
// on that board. This is the next rung for ONE family: ac 5 — the mod's
// rotating slash, dispatched TWICE per turn (`dc.type = 104` twice, kaizo
// Other_23 case 5) — at every difficulty the ordinary chain reaches.
//
//   atk_Multislash1   ac 5  difficulty 0  phase 1
//   atk_Multislash2   ac 5  difficulty 1  phase 2
//   atk_Multislash3   ac 5  difficulty 2  phase 3
//
// One attack, three points on one curve, in one recording — and the same
// three again on the Weird Route when a B-Side recording is present, where
// the ladder's top rung changes shape. That is what makes this family worth
// checking: a sim that merely happened to produce a plausible fan would have
// to produce the RIGHT plausible fan six times, with different ladders, off
// one shared state machine.
//
// ── WHAT IS CLAIMED ───────────────────────────────────────────────────────
//
//   * THE OBJECT SET, over the recorder's own vocabulary (see THE
//     INSTRUMENT'S VOCABULARY below). On the A-Side that is
//     obj_knight_rotating_slash, obj_knight_circle and
//     obj_roaringknight_slash; the B-Side adds obj_regularbullet, the
//     `firstrot` ring the mod fires between fans.
//   * THE COUNTS. 22 / 36 / 94 slashes A-Side and 22 / 36 / 150 B-Side, with
//     10 / 10 / 12 circles and 2 controllers every time. The ladder is the
//     mod's `slash_array` (Other_10: d0 [1,2,2,3,3,4], d1 [2,3,4,4,4,4],
//     d2 [3,4,4,4,4,4]) plus difficulty 2's spiral finisher — 28 groups
//     normally, 56 on the B-Side (`_endslashamt`, Step_0). Every one of those
//     is a different number, so the comparison cannot pass by being blurry.
//   * THE CADENCE, frame for frame. Every circle and every slash the
//     recording logs is matched against the sim's, as an offset from the
//     controller's own first logged frame. There is ONE free parameter — a
//     single +1 frame origin shift, explained and asserted below — and after
//     it every one of the ~480 spawn frames must land exactly.
//   * STRUCTURAL GEOMETRY. Slash image_xscale 2 / image_yscale 0.1 / speed 0
//     / image_angle == direction; circle scale 1x1, angle 0, speed 0;
//     controllers at the Knight's x, scale 2x2. Compared as the recorder's
//     own 10-decimal text (sim/trace.js `real`), never as a float tolerance.
//   * THE FAN. Within one aim cycle the 2n slash angles are TWO fans of n,
//     each an arithmetic progression of step 180/n — the shape of
//     `(360 / (slash_number * 2)) * a + random_offset + aim_direction`. The
//     bases are RNG; the spacing is not.
//   * THE SPIRAL. difficulty 2 only: one group every 3 frames, all from a
//     single frozen aim point, with the `speed_gain` ladder 16,17,...,24
//     then flat 24.
//
// ── WHAT IS NOT CLAIMED, AND ASSERTING IT WOULD BE A BUG ──────────────────
//
//   * ABSOLUTE FRAME NUMBERS. The recordings' turn lengths come from their
//     own pulsed-confirm input; this bench drives the launcher directly. Only
//     offsets within a turn are compared.
//   * ANY RNG DRAW. random_offset, aim_direction, the ds_list_shuffle order,
//     `spin`, `finale_spin` and the box's per-frame jitter are all live
//     stream. CLAUDE.md's honest claim for this project is "mechanics
//     one-to-one, RNG re-anchored per launch", and the streams are
//     deliberately not aligned. The sim's spiral turns the other way from the
//     A-Side recording's (finale_spin = choose(-1, 1)); only the MAGNITUDE
//     ladder and the constancy of the sign are asserted.
//   * obj_afterimage. The Knight's rainbow trail — 1005 to 1372 instances per
//     turn in the B-Side recording against the bench's 116 to 166 — is the
//     largest population in the log and is cosmetic: the mod sets
//     `rgbafterimages = 1` unconditionally, and the rotating-slash module
//     deliberately does not translate `scr_afterimage()`. Its count is also a
//     function of turn length, which is not comparable. Excluded BY NAME and
//     reported as a NOTE, never silently filtered.
//   * obj_marker. Read from the dump rather than guessed: this is
//     obj_tensionbar's Draw (`scr_marker(x + 3.4 + _h * 6.66, ...)`, the
//     orange TP sparkle), spawning three per bar segment at x 41-55 — off the
//     battle box entirely, and driven by `global.tension`. It is UI on a
//     harness-pinned quantity, in the same excluded class as damage and HP.
//   * DAMAGE, HP, TP, TARGETING. The recorder pins party and boss HP, so
//     every survival-shaped number in the recording is a harness artifact.
//     The bench runs with keepAlive for the same reason.
//   * THE CONTROLLER'S y. obj_knight_rotating_slash spawns at the Knight's
//     (x, y) and his y BOBS — the recordings show 85.367 / 72.619 / 72.724
//     and 71.014 / 85.698 / 70.005, six phases of the same cosine. x is
//     compared; y is reported and not asserted.
//
// ── THE INSTRUMENT'S VOCABULARY ───────────────────────────────────────────
//
// The recorder resolves a HARDCODED list of object names, and an object off
// that list is invisible to it. ORACLE-GROUND-TRUTH records what that cost
// once already: two attacks logged "not one spawn" and read as "the attack
// does nothing" when the truth was "the instrument was not looking". So the
// object-set comparison runs over the vocabulary the spawn log itself
// demonstrates — every distinct `object` value anywhere in the file — and the
// sim's set is intersected with it before comparing. An object the recorder
// cannot see is counted against neither side; an object it CAN see and the
// sim omits fails loudly.
//
// ── THE +1 FRAME, WHICH IS THE ONE THING THIS BENCH GETS TO CHOOSE ────────
//
// The recorder logs an instance the first frame it SEES it. In the game the
// controller creates obj_knight_rotating_slash from obj_dbulletcontroller's
// Step, so the object is logged on its creation frame and does not get its
// own first Step until the frame after. This bench calls launchVCAttack
// OUTSIDE stepFrame, so the sim's controller steps immediately and its log
// frame IS its first Step. That is exactly one frame, it is a property of the
// bench rather than of the module (CLAUDE.md, "Mid-phase spawns"), and it is
// asserted as a CONSTANT — the same +1 for every entry on both sides and for
// every one of the ~480 spawns — rather than fitted per row. A drifting
// offset fails.
//
// ── THE ATTRIBUTION RULE ──────────────────────────────────────────────────
//
// Spawns are grouped by `kaizo_playing`, the mod's own `kaizo_prevatk` — the
// entry it records as having just fired. NEVER by `kaizo_atk`, which is the
// pointer to the NEXT entry and transitions ON the launch frame: every row
// this file reads carries kaizo_atk = atk_DiamondStorm / atk_Starstorm3 /
// atk_Quickslash, the successors, not the entries that made them. That is
// trap #1 in knight-research/kaizo-mod/ORACLE-GROUND-TRUTH.md.
//
// ── WHICH RECORDING, AND WHICH SIDE ───────────────────────────────────────
//
// The A-Side and B-Side dispatch the SAME ac at the same difficulty and get
// different attacks, so driving the sim on the wrong side compares the wrong
// thing while looking almost right. The side is therefore MEASURED, never
// taken from a filename: VC_TABLE and VD_TABLE differ on exactly five nodes
// (Other_24:343-350), which makes ac 3 / 17 / 105 A-Side-only markers and
// ac 101 / 112 / 105.1 B-Side-only ones. A recording that shows neither is
// skipped with its name printed — an undetermined side is not a side.

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveTraces, readTrace, recoverLaunches } from './check-oracle-schedule.mjs';
import { createState, stepFrame } from '../../../sim/index.js';
import { destroy } from '../../../sim/entity.js';
import { settleBox } from '../../../sim/battlebox.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { real } from '../../../sim/trace.js';
import { VC_TABLE, VD_TABLE } from '../../versions/vc-script.js';
import {
  launchVCAttack, openVCArena, vcMoveheartDest, vcTurnLength,
} from '../../scenes/kaizo-mod-launcher.js';

/** The family: every schedule row that dispatches ac 5 on the ordinary chain. */
const AC = 5;
const familyRows = (sideb) => Object.entries(sideb ? VD_TABLE : VC_TABLE)
  .filter(([p]) => p !== '4') // phase 4 is off the chain — see check-oracle-schedule
  .flatMap(([, rows]) => rows)
  .filter((r) => r.ac === AC);

/** Printing order for the ledger. */
const PRIMARY = ['obj_knight_rotating_slash', 'obj_knight_circle',
  'obj_roaringknight_slash', 'obj_regularbullet'];

/** Cosmetic populations the sim does not translate — header, "NOT CLAIMED". */
const COSMETIC = new Set(['obj_afterimage', 'obj_afterimage_blend', 'obj_particle_generic']);
/** UI on a harness-pinned quantity — obj_tensionbar's Draw. Header again. */
const UI = new Set(['obj_marker']);
const EXCLUDED = new Set([...COSMETIC, ...UI]);

let checks = 0;
const failures = [];
const notes = [];

function ok(cond, msg) {
  checks += 1;
  if (!cond) failures.push(msg);
  return cond;
}
function eq(got, want, msg) {
  checks += 1;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) failures.push(`${msg} — sim ${g}, oracle ${w}`);
  return g === w;
}

// ── the recording ──────────────────────────────────────────────────────────

/** Parse a recorder SEQ csv (one row per spawn). */
function readSeq(path) {
  const text = readFileSync(path, 'utf8').replace(/\r/g, '').trimEnd();
  const lines = text.split('\n');
  const header = lines[0].split(',');
  return {
    header,
    col: Object.fromEntries(header.map((h, i) => [h, i])),
    rows: lines.slice(1).filter((l) => l.length).map((l) => l.split(',')),
  };
}

/**
 * The SEQ companion of a trace file: `kaizo_oracle_trace_deep.csv` ->
 * `kaizo_oracle_seq_deep.csv`, and the older `..._tracefix1` -> `..._seqfix1`.
 * Null when it is not on disk — a trace with no companion predates the spawn
 * log, and this check has nothing to read from it.
 */
function seqFor(tracePath) {
  const p = join(dirname(tracePath), basename(tracePath).replace('trace', 'seq'));
  return existsSync(p) ? p : null;
}

/** ac values unique to one table — the measured side markers. */
function sideMarkers() {
  const a = new Set(Object.values(VC_TABLE).flat().map((r) => r.ac));
  const b = new Set(Object.values(VD_TABLE).flat().map((r) => r.ac));
  return {
    aOnly: [...a].filter((v) => !b.has(v)),
    bOnly: [...b].filter((v) => !a.has(v)),
  };
}

/** 'A' | 'B' | null, from the attackchoice values the trace actually shows. */
function sideOf(trace) {
  const { aOnly, bOnly } = sideMarkers();
  const seen = new Set();
  for (const r of trace.rows) {
    const v = Number(r[trace.col.attackchoice]);
    if (Number.isFinite(v)) seen.add(v);
  }
  const sawA = aOnly.some((v) => seen.has(v));
  const sawB = bOnly.some((v) => seen.has(v));
  if (sawA && !sawB) return 'A';
  if (sawB && !sawA) return 'B';
  return null;
}

/** Every spawn row of one entry, by object name. */
function ledgerFor(seq, entry) {
  const rows = seq.rows.filter((r) => r[seq.col.kaizo_playing] === entry);
  const byObj = new Map();
  for (const r of rows) {
    const o = r[seq.col.object];
    if (!byObj.has(o)) byObj.set(o, []);
    byObj.get(o).push({
      frame: Number(r[seq.col.frame]),
      object: o,
      x: r[seq.col.x], y: r[seq.col.y],
      angle: r[seq.col.angle],
      xscale: r[seq.col.xscale], yscale: r[seq.col.yscale],
      direction: r[seq.col.direction], speed: r[seq.col.speed],
    });
  }
  return { rows, byObj };
}

// ── the sim ────────────────────────────────────────────────────────────────

/**
 * A fight-shaped bench: the Knight, the party, the box and the soul, with the
 * practice director removed so nothing but this file drives the turn.
 */
function bench(seed, sideb) {
  const st = createState({ seed, traceBulletSlots: 0 });
  buildSingleAttackScene(st, { seed, attack: 'rotating', difficulty: 0 });
  const dir = st.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  st.kaizo = {
    version: sideb ? 'D' : 'C', sideb, approx: [], launched: [], vars: {}, hooks: {},
  };
  // The recorder pins party HP; this pins the party upright for the same
  // reason. Nothing about damage is compared — see the header.
  st.keepAlive = true;
  st.invTimer = -1;
  return st;
}

/**
 * Run one V-C/V-D row through the real launcher and collect every spawn.
 *
 * The soul is parked at vcMoveheartDest — the mod's OWN delivery destination
 * for this row, `(gt.x - 10, gt.y - 10)` — and given no input, which is what
 * both recordings show (soul_x/soul_y hold at 310/160 for every frame of
 * every ac-5 turn). That matters because the aim point IS the soul:
 * `aim_x = obj_heart.x + 10`.
 */
function runSim(row, { seed = 4242, frames = 900, sideb = false } = {}) {
  const st = bench(seed, sideb);
  openVCArena(st, row, { sideb });
  const gt = st.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
  // The board is raised under mnfight 1.5 and the attack spawns 12 frames
  // later under mnfight 2, so it is already at its plateau when the
  // controller lands. settleBox is that plateau.
  settleBox(gt);
  const dest = vcMoveheartDest(row, gt, st.view);
  st.soul.x = dest.x;
  st.soul.y = dest.y;
  st.turntimer = vcTurnLength(row, { sideb });
  launchVCAttack(st, row, { sideb });

  const seen = new Set();
  const spawns = [];
  // THE TURN CLOCK, watched for the whole run. type 104 pins it at 999999
  // (dbulletcontroller Step_0:2188) and only the closing controller's CleanUp
  // hands it back — see the clock assertions in compareRecording.
  let ttMax = -Infinity;
  let ttEnd = -1;
  for (let f = 0; f < frames; f++) {
    stepFrame(st, {});
    for (const e of st.entities) {
      if (!e.alive || seen.has(e.seq)) continue;
      seen.add(e.seq);
      spawns.push({
        frame: f,
        object: e.type.name,
        x: real(e.x), y: real(e.y),
        angle: real(e.image_angle),
        xscale: real(e.image_xscale), yscale: real(e.image_yscale),
        direction: real(e.direction), speed: real(e.speed),
      });
    }
    ttMax = Math.max(ttMax, st.turntimer);
    if (ttEnd < 0 && st.turntimer <= 0) ttEnd = f;
    if (st.turntimer > 0) st.turntimer -= 1;
  }
  const byObj = new Map();
  for (const s of spawns) {
    if (!byObj.has(s.object)) byObj.set(s.object, []);
    byObj.get(s.object).push(s);
  }
  return {
    st, spawns, byObj, frames, ttMax, ttEnd,
    aim: { x: real(dest.x + 10), y: real(dest.y + 10) },
  };
}

// ── shared shape helpers (run over BOTH sides, identically) ────────────────

/** frame -> rows, in log order. */
function byFrame(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.frame)) m.set(r.frame, []);
    m.get(r.frame).push(r);
  }
  return m;
}

/**
 * Slash frames clustered into AIM CYCLES: consecutive frames belong to one
 * cycle (the GML fires one entry of `slash_list` per frame), a gap starts a
 * new one. The spiral finisher's 3-frame cadence therefore reads as a run of
 * one-frame cycles, which is exactly what it is.
 *
 * DEDUPE FIRST. Two controllers fire on every frame, so the raw frame list
 * carries each value twice; a naive scan reads the 0 between the pair as a
 * gap and starts a new cycle at EVERY slash — which presents as "difficulty 0
 * has ten spiral groups". Caught by this file's own d0 run.
 */
function cycles(frames) {
  const fs = [...new Set(frames)].sort((a, b) => a - b);
  if (!fs.length) return [];
  const out = [];
  let cur = [fs[0]];
  for (let i = 1; i < fs.length; i++) {
    if (fs[i] - fs[i - 1] === 1) cur.push(fs[i]);
    else { out.push(cur); cur = [fs[i]]; }
  }
  out.push(cur);
  return out;
}

/**
 * Split a turn's cycles into the AIM phase and difficulty 2's SPIRAL.
 *
 * The spiral is the TRAILING run of one-frame cycles: `aim_type` reaches 2 and
 * cooldown goes straight back to "slash", so each group is a single frame.
 * Everything up to and including the last multi-frame cycle is the aim phase —
 * d0's opening 1-slash fan lives in there, which is why "length === 1" alone
 * cannot be the test.
 */
function splitCycles(cyc) {
  let last = -1;
  for (let i = 0; i < cyc.length; i++) if (cyc[i].length > 1) last = i;
  return { aim: cyc.slice(0, last + 1), finale: cyc.slice(last + 1) };
}

/**
 * THE FAN TEST.
 *
 * `(360 / (slash_number * 2)) * a + random_offset + aim_direction` means the n
 * angles of one controller's fan are congruent modulo 180/n. Two controllers
 * fire into one cycle, so the 2n residues form exactly TWO clusters of n. This
 * returns the tightest such split's worst within-cluster spread — 0 in exact
 * arithmetic, one f32 ulp in practice, and a large number for a wrong step.
 */
function fanSpread(angles, step) {
  const res = angles.map((a) => ((a % step) + step) % step).sort((a, b) => a - b);
  const n = angles.length / 2;
  let best = Infinity;
  for (let k = 0; k < res.length; k++) {
    const rot = res.map((_, i) => (i < res.length - k ? res[(i + k) % res.length]
      : res[(i + k) % res.length] + step));
    const A = rot.slice(0, n);
    const B = rot.slice(n);
    best = Math.min(best, Math.max(A[A.length - 1] - A[0], B[B.length - 1] - B[0]));
  }
  return best;
}

/**
 * The spiral's per-group angle advance. Both controllers step by the same
 * `speed_gain * spin`, so of the four differences between one group's angle
 * pair and the next's, TWO coincide — that repeated value is the advance. The
 * pair is chosen by argmin separation (no threshold), and the separation is
 * returned so the caller can hold the sim to the recording's own worst.
 */
function spiralSteps(groups) {
  const out = [];
  for (let i = 1; i < groups.length; i++) {
    const cand = [];
    for (const a of groups[i]) for (const b of groups[i - 1]) cand.push((((a - b) % 360) + 360) % 360);
    cand.sort((x, y) => x - y);
    let best = { delta: null, sep: Infinity };
    for (let k = 0; k + 1 < cand.length; k++) {
      const sep = cand[k + 1] - cand[k];
      if (sep < best.sep) best = { delta: (cand[k] + cand[k + 1]) / 2, sep };
    }
    out.push(best);
  }
  return out;
}

/** |advance| as a turn magnitude: a spiral that turns the other way is the
 *  same ladder read through `spin = choose(-1, 1)`. */
const magnitude = (d) => Math.min(d, 360 - d);

// ══════════════════════════════════════════════════════════════════════════

/**
 * Compare every ac-5 entry in ONE recording against the sim, on the side that
 * recording measured as. Returns per-entry facts for the summary.
 */
function compareRecording({ seqPath, tracePath, seq, sideb, tag }) {
  const rows = familyRows(sideb);
  const present = rows.filter((r) => seq.rows.some((x) => x[seq.col.kaizo_playing] === r.id));
  const side = sideb ? 'B-Side (Weird Route)' : 'A-Side';
  console.log(`\n${'─'.repeat(74)}`);
  console.log(`  ${side}: ${seqPath}`);
  console.log(`  ${seq.rows.length} spawn rows; ac-5 entries present:`
    + ` ${present.length ? present.map((r) => r.id).join(', ') : 'NONE'}`);
  if (!present.length) {
    notes.push(`${tag}: no ac-5 turn in this recording — nothing of this family to compare`);
    return { compared: [], slashCounts: new Map(), offsets: [], frameEqualities: 0, fanCycles: 0 };
  }

  // THE RECORDER'S VOCABULARY — see the header. Everything it ever logged.
  const vocab = new Set(seq.rows.map((r) => r[seq.col.object]));

  // ── the schedule facts for THIS family ──────────────────────────────────
  // Not a re-run of check-oracle-schedule: this only confirms the rows being
  // compared below really are ac 5 at the table's difficulty, so a
  // mislabelled recording cannot quietly compare the wrong attack.
  let trace = null;
  if (tracePath) {
    trace = readTrace(tracePath);
    const launches = recoverLaunches(trace);
    for (const row of present) {
      const L = launches.find((x) => x.played === row.id);
      if (!L) { notes.push(`${tag}/${row.id}: spawn rows exist but no launch was recovered`); continue; }
      eq(L.ac, AC, `${tag}/${row.id}: the recording launched ac ${AC}`);
      eq(L.difficulty, row.difficulty, `${tag}/${row.id}: difficulty (table ${row.difficulty})`);
    }
  } else {
    notes.push(`${tag}: no trace companion beside the spawn log — ac/difficulty not re-confirmed`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // THE MEASURED SPAWN LEDGER. Printed whether or not anything below
  // passes: it is ground truth about another author's mod, it cost a real
  // game run, and it is the deliverable even if the comparison is hard.
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n  THE ORACLE LEDGER — what each ac-5 turn actually created');
  const oracle = new Map();
  for (const row of present) {
    const L = ledgerFor(seq, row.id);
    oracle.set(row.id, L);
    const objs = [...L.byObj.entries()].sort((a, b) => b[1].length - a[1].length);
    console.log(`   ${row.id}  (ac ${row.ac} d${row.difficulty} phase ${row.phase})`);
    console.log(`     ${objs.map(([o, r]) => `${o.replace('obj_', '')}x${r.length}`).join(' ')}`);
    const order = [...PRIMARY.filter((o) => L.byObj.has(o)),
      ...[...L.byObj.keys()].filter((o) => !PRIMARY.includes(o) && !EXCLUDED.has(o))];
    for (const o of order) {
      const rs = L.byObj.get(o);
      const f0 = rs[0].frame;
      const sizes = [...new Set([...byFrame(rs).values()].map((v) => v.length))].sort((a, b) => a - b);
      const uniq = (k) => [...new Set(rs.map((r) => Number(r[k])))];
      const angles = uniq('angle');
      console.log(`       ${o} x${rs.length}  spans ${rs[rs.length - 1].frame - f0} frames`
        + `  ${sizes.join('/')} per frame`);
      console.log(`         pos ${[...new Set(rs.map((r) => `(${Number(r.x)},${Number(r.y)})`))].join(' ')}`
        + `  xscale ${uniq('xscale').join(',')}  yscale ${uniq('yscale').join(',')}`
        + `  speed ${uniq('speed').length <= 3 ? uniq('speed').join(',') : `${uniq('speed').length} distinct`}`
        + `  angle ${angles.length === 1 ? angles[0] : `${angles.length} distinct`}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // THE COMPARISON
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n  SIM vs ORACLE');
  const offsets = [];
  const compared = [];
  const slashCounts = new Map();
  let frameEqualities = 0;
  let fanCycles = 0;

  for (const row of present) {
    const id = row.id;
    const O = oracle.get(id);
    const oMgAll = O.byObj.get('obj_knight_rotating_slash') ?? [];

    // ONE TURN PER ENTRY. A MODE 1 (attack-lock) recording replays the same
    // entry many times and its rows all carry one kaizo_playing value, so the
    // counts below would be a sum over turns. That is a different measurement,
    // not a divergence — report it and move on rather than failing.
    if (oMgAll.length !== 2) {
      if (oMgAll.length && oMgAll.length % 2 === 0) {
        notes.push(`${tag}/${id}: ${oMgAll.length / 2} turns of this entry in one recording`
          + ' (an attack-lock replay) — per-turn counts are not separable here, SKIPPED');
      } else {
        failures.push(`${tag}/${id}: the ac-5 arm must dispatch type 104 TWICE;`
          + ` the recording logged ${oMgAll.length} obj_knight_rotating_slash`);
        checks += 1;
      }
      continue;
    }
    checks += 1; // the arm dispatched type 104 twice

    const S = runSim(row, { seed: 4242, frames: 900, sideb });
    compared.push(id);

    // ── the launcher took the row without approximating ──────────────────
    // The ledger is the launcher's own record of "the mod asked for a
    // difficulty branch that is not translated". A non-empty one here means
    // the numbers below came from a SUBSTITUTE attack, and every agreement
    // would be an accident.
    eq(S.st.kaizo.approx, [], `${tag}/${id}: the launcher ran ac ${AC} d${row.difficulty} with no approximation`);

    // ── the object set, over the recorder's vocabulary ───────────────────
    const oSet = [...O.byObj.keys()].filter((o) => !EXCLUDED.has(o)).sort();
    const sSet = [...S.byObj.keys()].filter((o) => vocab.has(o) && !EXCLUDED.has(o)).sort();
    eq(sSet, oSet, `${tag}/${id}: object set (over the recorder's ${vocab.size}-name vocabulary,`
      + ` cosmetic + tensionbar UI excluded)`);
    const oAft = (O.byObj.get('obj_afterimage') ?? []).length;
    const sAft = (S.byObj.get('obj_afterimage') ?? []).length;
    notes.push(`${tag}/${id}: obj_afterimage — oracle ${oAft}, sim ${sAft}; cosmetic and`
      + ' turn-length-driven, excluded by name rather than by a filter');

    // ── the counts ───────────────────────────────────────────────────────
    for (const o of oSet) {
      const on = (O.byObj.get(o) ?? []).length;
      const sn = (S.byObj.get(o) ?? []).length;
      eq(sn, on, `${tag}/${id}: ${o} count`);
      if (o === 'obj_roaringknight_slash') slashCounts.set(id, on);
    }

    const sMg = S.byObj.get('obj_knight_rotating_slash') ?? [];
    if (!ok(sMg.length === 2, `${tag}/${id}: the sim's ac-5 arm also spawns type 104 twice`
      + ` (it made ${sMg.length})`)) continue;

    // Both controllers land on ONE frame — the arm's two scr_bulletspawner
    // calls are in the same event.
    ok(oMgAll[0].frame === oMgAll[1].frame, `${tag}/${id}: oracle's two controllers share a spawn frame`);
    ok(sMg[0].frame === sMg[1].frame, `${tag}/${id}: sim's two controllers share a spawn frame`);
    eq(sMg[0].x, oMgAll[0].x, `${tag}/${id}: controller x (the Knight's x)`);
    eq([sMg[0].xscale, sMg[0].yscale], [oMgAll[0].xscale, oMgAll[0].yscale], `${tag}/${id}: controller scale`);
    eq(sMg[0].speed, oMgAll[0].speed, `${tag}/${id}: controller speed`);
    notes.push(`${tag}/${id}: controller y — oracle ${Number(oMgAll[0].y)}, sim ${Number(sMg[0].y)};`
      + ' the Knight bobs and the launch phase of that cosine is not comparable');

    // ── THE TIMELINE, offset from each side's own controller frame ───────
    const timeline = (byObj, base) => [
      ...(byObj.get('obj_knight_circle') ?? []),
      ...(byObj.get('obj_roaringknight_slash') ?? []),
    ].map((r) => r.frame - base).sort((a, b) => a - b);
    const oRel = timeline(O.byObj, oMgAll[0].frame);
    const sRel = timeline(S.byObj, sMg[0].frame);
    if (ok(oRel.length === sRel.length && oRel.length > 0,
      `${tag}/${id}: same number of timed spawns (oracle ${oRel.length}, sim ${sRel.length})`)) {
      const delta = oRel[0] - sRel[0];
      offsets.push(delta);
      const bad = [];
      for (let i = 0; i < oRel.length; i++) {
        frameEqualities += 1;
        if (oRel[i] - sRel[i] !== delta) bad.push(`#${i} oracle +${oRel[i]}, sim +${sRel[i]}`);
      }
      ok(bad.length === 0,
        `${tag}/${id}: every one of ${oRel.length} circle/slash spawn frames matches at a`
        + ` CONSTANT +${delta} origin shift — ${bad.length} drifted: ${bad.slice(0, 4).join('; ')}`);
    }

    // THE WINDOW IS BIG ENOUGH. Without this the counts could agree because
    // the sim's turn was still running when the bench stopped looking.
    const lastFam = Math.max(...(S.byObj.get('obj_roaringknight_slash') ?? [{ frame: 0 }])
      .map((r) => r.frame));
    ok(lastFam < S.frames - 100,
      `${tag}/${id}: the sim's turn finished inside the ${S.frames}-frame window`
      + ` (last slash at ${lastFam}) — the counts are totals, not truncations`);

    // ── THE TURN CLOCK, and the CleanUp fix it depends on ────────────────
    //
    // `dc.type = 104` pins global.turntimer at 999999 and ONLY the closing
    // controller's CleanUp hands it back:
    //
    //   if (turn_type != "start" && ... && scr_bulletparent_count() < 2)
    //       global.turntimer = -1;
    //
    // scr_bulletparent_count() counts instances whose object_index is EXACTLY
    // obj_bulletparent, and nothing in the knight fight ever creates one, so
    // the test is always true. Translating it as "alive bullets < 2" instead
    // is the misreading the sim module carries a documented fix for — and it
    // DEADLOCKS this family the moment a sibling is alive at the handover,
    // which on the B-Side the `firstrot` regularbullet ring guarantees. Both
    // halves are asserted, against the recording's own turntimer column:
    // the clock really does reach 999999, and it really does come back.
    const tt = trace ? trace.rows.filter((r) => r[trace.col.kaizo_playing] === id)
      .map((r) => Number(r[trace.col.turntimer])).filter(Number.isFinite) : [];
    if (tt.length) {
      eq(Math.max(...tt), 999999,
        `${tag}/${id}: the mod pins global.turntimer at 999999 for this turn (type 104)`);
      ok(Math.min(...tt) <= 0,
        `${tag}/${id}: and the recording's clock comes back (min ${Math.min(...tt)}) — the turn ends`);
    }
    eq(S.ttMax, 999999, `${tag}/${id}: the sim pins the clock at 999999 too`);
    ok(S.ttEnd > lastFam,
      `${tag}/${id}: the sim's CleanUp hands the clock back at frame ${S.ttEnd}, after the last`
      + ` slash at ${lastFam} — without the scr_bulletparent_count fix this NEVER happens and`
      + ' the turn hangs at 999999');

    // ── per-frame grouping: one slash from each controller, every frame ──
    for (const [who, rowsOf] of [['oracle', O.byObj], ['sim', S.byObj]]) {
      const sizes = [...new Set([...byFrame(rowsOf.get('obj_roaringknight_slash') ?? []).values()]
        .map((v) => v.length))];
      eq(sizes, [2], `${tag}/${id}: ${who} fires exactly 2 slashes per frame (one per controller)`);
    }

    // ── the aim-cycle ladder (slash_array) ───────────────────────────────
    const oCyc = cycles((O.byObj.get('obj_roaringknight_slash') ?? []).map((r) => r.frame));
    const sCyc = cycles((S.byObj.get('obj_roaringknight_slash') ?? []).map((r) => r.frame));
    const oSplit = splitCycles(oCyc);
    const sSplit = splitCycles(sCyc);
    eq(sSplit.aim.map((c) => c.length), oSplit.aim.map((c) => c.length),
      `${tag}/${id}: aim-cycle sizes (the mod's slash_array ladder)`);

    // ── circle -> first slash of its cycle ───────────────────────────────
    // (slash_base + slash_offset + 6) - 1 per cycle. The dual-controller
    // branch pins slash_offset back to 6 (7 on the B-Side) every Step while
    // slash_base decays 18 -> 15, so this is a decaying, side-sensitive
    // signature rather than a constant.
    const lead = (circles_, cyc) => {
      const cf = [...new Set(circles_.map((r) => r.frame))].sort((a, b) => a - b);
      return cf.map((f, i) => (cyc[i] ? cyc[i][0] - f : null));
    };
    const oLead = lead(O.byObj.get('obj_knight_circle') ?? [], oCyc);
    const sLead = lead(S.byObj.get('obj_knight_circle') ?? [], sCyc);
    eq(sLead, oLead, `${tag}/${id}: circle -> first slash of each cycle`);

    // ── geometry, as the recorder's own 10-decimal text ──────────────────
    for (const [o, fields] of [
      ['obj_roaringknight_slash', ['xscale', 'yscale', 'speed']],
      ['obj_knight_circle', ['xscale', 'yscale', 'angle', 'speed']],
    ]) {
      const oRows = O.byObj.get(o) ?? [];
      const sRows = S.byObj.get(o) ?? [];
      for (const f of fields) {
        eq([...new Set(sRows.map((r) => r[f]))], [...new Set(oRows.map((r) => r[f]))],
          `${tag}/${id}: ${o}.${f}`);
      }
    }
    // image_angle == direction on every slash: the GML assigns
    // `direction = <list value>; image_angle = direction;`.
    for (const [who, rowsOf] of [['oracle', O.byObj], ['sim', S.byObj]]) {
      const rs = rowsOf.get('obj_roaringknight_slash') ?? [];
      ok(rs.length > 0 && rs.every((r) => r.angle === r.direction),
        `${tag}/${id}: ${who} slashes all carry image_angle == direction`);
    }

    // ── positions ────────────────────────────────────────────────────────
    // The aim point is the soul: `aim_x = obj_heart.x + 10`. Both recordings
    // hold the soul at 310,160 for every frame of every ac-5 turn, and the
    // bench parks it at the same delivery point, so the AIM CYCLES' spawn
    // point is a comparable structural quantity — and the expected value is
    // COMPUTED from vcMoveheartDest rather than written down here.
    const aimFrames = (split) => new Set(split.aim.flat());
    const oAimF = aimFrames(oSplit);
    const sAimF = aimFrames(sSplit);
    const posSet = (rs, keep) => [...new Set(rs.filter((r) => keep.has(r.frame))
      .map((r) => `${r.x},${r.y}`))];
    const oPos = posSet(O.byObj.get('obj_roaringknight_slash') ?? [], oAimF);
    const sPos = posSet(S.byObj.get('obj_roaringknight_slash') ?? [], sAimF);
    eq(sPos, oPos, `${tag}/${id}: aim-cycle slashes all spawn at one point`);
    eq(oPos, [`${S.aim.x},${S.aim.y}`],
      `${tag}/${id}: and that point is vcMoveheartDest + (10, 10) — the soul's own slot`);
    const cutoff = Math.max(...oAimF);
    const sCutoff = Math.max(...sAimF);
    eq(posSet(S.byObj.get('obj_knight_circle') ?? [],
      new Set((S.byObj.get('obj_knight_circle') ?? []).map((r) => r.frame).filter((f) => f <= sCutoff))),
    posSet(O.byObj.get('obj_knight_circle') ?? [],
      new Set((O.byObj.get('obj_knight_circle') ?? []).map((r) => r.frame).filter((f) => f <= cutoff))),
    `${tag}/${id}: aim circles spawn at the same point as their fan`);

    // ── THE FAN: two arithmetic progressions of step 180/n ───────────────
    //
    // WHAT THIS ASSERTS: the aim cycle's slashes lie on TWO arithmetic
    // progressions of step 180/n. `fanSpread` returns the worst within-fan
    // residual after fitting that model, so a correct model leaves nothing but
    // f32 quantisation and a wrong one leaves geometry.
    //
    // THE BOUND USED TO BE `sWorst <= oWorst` — the sim held to the oracle's own
    // worst residual — AND THAT WAS A DEFECTIVE ASSERTION, not a defect in the
    // sim. The residuals are exact f32 ULPs: measured, the sim's worst is
    // 6.104e-5 (2^-14) and the oracle's are 1.526e-5 (2^-16) and 3.052e-5
    // (2^-15). An f32 ULP is 2^(floor(log2 m) - 23), so those three numbers say
    // only that the raw angles sat in [512,1024) on one side and [128,512) on
    // the other.
    //
    // Neither side controls that magnitude. `image_angle` is an f32 built-in;
    // the raw angle is `360/(n*2)*a + random_offset + aim_direction`; and
    // `aim_direction` accumulates UNWRAPPED for the whole turn
    // (rotating-slash.js: `+= rotation * spin` per aim frame, `+= speed_gain *
    // spin` in the spiral). The RNG is re-anchored per launch by design
    // (CLAUDE.md), so the two sides legitimately arrive at different
    // magnitudes and therefore different quantisation grids. Comparing the
    // grids compares nothing about the fan.
    //
    // THE BOUND IS NOW MODEL-DERIVED AND APPLIED TO BOTH SIDES: one f32 ULP at
    // |raw angle| < 16384 degrees. It is a cap on QUANTISATION, which is the
    // only residual the model permits at all. For scale: the mod's own
    // Multislash angles reach a 2^-11 grid, and the wrong-step control below
    // lands three orders of magnitude above this cap.
    //
    // It was tempting to set the cap at 2^-13, which the sim's current sample
    // satisfies. That would have been fitting the bound to the sample — raising
    // a number until the gate went green — and the mod's own 2^-11 grid
    // disproves it.
    const FAN_ULP_CAP = 2 ** -10;
    const oByF = byFrame(O.byObj.get('obj_roaringknight_slash') ?? []);
    const sByF = byFrame(S.byObj.get('obj_roaringknight_slash') ?? []);
    const angsOf = (c, m) => c.flatMap((f) => m.get(f).map((r) => Number(r.angle)));
    let oWorst = 0;
    let sWorst = 0;
    let wrongStep = 0;
    let fanN = 0;
    for (const c of oSplit.aim) {
      if (c.length < 2) continue;
      fanN += 1;
      fanCycles += 1;
      oWorst = Math.max(oWorst, fanSpread(angsOf(c, oByF), 180 / c.length));
      // A WRONG step must NOT look like a fan. Without this the test could
      // be passing because fanSpread returns something small for any input —
      // the "negative result with no positive control" trap.
      wrongStep = Math.max(wrongStep, fanSpread(angsOf(c, oByF), 180 / (c.length + 1)));
    }
    for (const c of sSplit.aim) {
      if (c.length < 2) continue;
      sWorst = Math.max(sWorst, fanSpread(angsOf(c, sByF), 180 / c.length));
    }
    // THE CONTROL, now stated against the CAP rather than against the oracle's
    // own residual — otherwise the control moves whenever the grid does, and a
    // control that tracks the thing it is controlling for is not one. A wrong
    // step must land far above the cap, which is what makes the cap
    // discriminating rather than merely permissive.
    ok(fanN > 0 && wrongStep > FAN_ULP_CAP * 8,
      `${tag}/${id}: control — the same angles read at the WRONG step 180/(n+1) do not`
      + ` form two fans (spread ${wrongStep.toExponential(3)}, well above the`
      + ` ${FAN_ULP_CAP.toExponential(3)} cap; at the right step the oracle's own`
      + ` worst is ${oWorst.toExponential(3)})`);
    // BOTH SIDES, same bound. The oracle half is not ceremony: if a recording
    // ever produced a residual above this cap, the fan model would be wrong
    // about the MOD, and every sim-side conclusion drawn from it would be
    // resting on a model the recording had already refuted.
    ok(oWorst <= FAN_ULP_CAP,
      `${tag}/${id}: the MOD's aim cycles are two fans of step 180/n — worst`
      + ` within-fan residual ${oWorst.toExponential(3)} is f32 quantisation`
      + ` (cap ${FAN_ULP_CAP.toExponential(3)}), over ${fanN} multi-slash cycles`);
    ok(sWorst <= FAN_ULP_CAP,
      `${tag}/${id}: sim aim cycles are TWO fans of step 180/n — worst within-fan`
      + ` residual ${sWorst.toExponential(3)} is f32 quantisation`
      + ` (cap ${FAN_ULP_CAP.toExponential(3)})`);

    // ── THE SPIRAL FINISHER (difficulty 2) ──────────────────────────────
    const oFin = oSplit.finale;
    const sFin = sSplit.finale;
    if (row.difficulty !== 2) {
      eq(sFin.length, 0, `${tag}/${id}: no spiral finisher below difficulty 2 (sim)`);
      eq(oFin.length, 0, `${tag}/${id}: no spiral finisher below difficulty 2 (oracle)`);
      continue;
    }

    // `_endslashamt` — 28, or 56 on the B-Side with no sword-vortex manager
    // in play (Step_0's cooldown block). ac 5 never pairs with the vortex, so
    // the 42 arm is unreachable from this family.
    const wantAmt = sideb ? 56 : 28;
    eq(sFin.length, oFin.length, `${tag}/${id}: spiral slash groups`);
    eq(oFin.length, wantAmt, `${tag}/${id}: and _endslashamt is ${wantAmt} on this side`);
    const cad = (fin) => [...new Set(fin.slice(1).map((c, i) => c[0] - fin[i][0]))];
    eq(cad(sFin), cad(oFin), `${tag}/${id}: spiral cadence`);
    eq(cad(oFin), [3], `${tag}/${id}: the spiral fires every 3 frames (slash_timer 2 + cooldown_time 2)`);

    // ONE frozen aim point for all of them — aim_x/aim_y are pinned to the
    // box centre once, in the do_final block, and never re-read.
    const finPos = (fin, m) => [...new Set(fin.flatMap((c) => m.get(c[0])
      .map((r) => `${Number(r.x)},${Number(r.y)}`)))];
    const oFinPos = finPos(oFin, oByF);
    const sFinPos = finPos(sFin, sByF);
    eq(oFinPos.length, 1, `${tag}/${id}: oracle's spiral slashes all share ONE frozen aim point (${oFinPos})`);
    eq(sFinPos.length, 1, `${tag}/${id}: sim's spiral slashes all share ONE frozen aim point (${sFinPos})`);
    // That point is a SAMPLE of the jittering box centre, so its value is
    // RNG. The comparable claim is that it lies inside the box's own travel —
    // and the envelope comes from the recording's gt_x/gt_y columns on the
    // frames this entry was playing, nowhere else.
    if (trace) {
      const gx = [];
      const gy = [];
      for (const r of trace.rows) {
        if (r[trace.col.kaizo_playing] !== id) continue;
        const vx = r[trace.col.gt_x];
        const vy = r[trace.col.gt_y];
        if (vx === '' || vy === '' || vx === undefined) continue;
        gx.push(Number(vx));
        gy.push(Number(vy));
      }
      if (gx.length) {
        const box = [Math.min(...gx), Math.max(...gx), Math.min(...gy), Math.max(...gy)];
        const inside = (p) => {
          const [px, py] = p.split(',').map(Number);
          return px >= box[0] && px <= box[1] && py >= box[2] && py <= box[3];
        };
        const env = `x ${box[0]}..${box[1]} y ${box[2]}..${box[3]} over ${gx.length} rows`;
        ok(inside(oFinPos[0]),
          `${tag}/${id}: control — the ORACLE's own spiral point ${oFinPos[0]} is inside the`
          + ` box travel it recorded (${env})`);
        ok(inside(sFinPos[0]),
          `${tag}/${id}: the sim's spiral point ${sFinPos[0]} is inside that same recorded box`
          + ` travel (${env}) — the point is a jitter sample, so only the envelope is comparable`);
      }
    }

    // The speed_gain ladder: 16, then +1 a group, flat at 24. The SIGN is
    // finale_spin = choose(-1, 1) and is not compared; the magnitude and the
    // sign's CONSTANCY are. The advance is measured off f32 angles, so the
    // integer ladder is recovered by rounding and the ROUNDING RESIDUAL is
    // held to the recording's own worst — the same rule as the fan.
    const oSteps = spiralSteps(oFin.map((c) => oByF.get(c[0]).map((r) => Number(r.angle))));
    const sSteps = spiralSteps(sFin.map((c) => sByF.get(c[0]).map((r) => Number(r.angle))));
    const want = Array.from({ length: oFin.length - 1 }, (_, i) => Math.min(16 + i, 24));
    const ladder = (steps) => steps.map((s) => Math.round(magnitude(s.delta)));
    const resid = (steps) => Math.max(...steps.map((s) => Math.abs(magnitude(s.delta) - Math.round(magnitude(s.delta)))));
    eq(ladder(oSteps), want, `${tag}/${id}: oracle spiral advance ladder 16..24 then flat`);
    eq(ladder(sSteps), want, `${tag}/${id}: sim spiral advance ladder 16..24 then flat`);
    ok(resid(sSteps) <= Math.max(resid(oSteps), 0),
      `${tag}/${id}: the sim's advance is as close to the integer ladder as the oracle's`
      + ` (sim ${resid(sSteps).toExponential(3)}, oracle ${resid(oSteps).toExponential(3)})`);
    for (const [who, steps] of [['oracle', oSteps], ['sim', sSteps]]) {
      const signs = new Set(steps.map((s) => (s.delta < 180 ? '+' : '-')));
      eq([...signs].length, 1, `${tag}/${id}: ${who} spiral turns one way for all of them (spin is constant)`);
    }
    notes.push(`${tag}/${id}: spiral direction — oracle ${oSteps[0].delta < 180 ? '+' : '-'},`
      + ` sim ${sSteps[0].delta < 180 ? '+' : '-'}; finale_spin = choose(-1, 1), so this is`
      + ' stream, not shape');
  }

  return { compared, slashCounts, offsets, frameEqualities, fanCycles };
}

// ══════════════════════════════════════════════════════════════════════════

function main() {
  const explicit = process.argv[2];
  const candidates = [];

  if (explicit) {
    const guess = join(dirname(explicit), basename(explicit).replace('seq', 'trace'));
    candidates.push({ seqPath: explicit, tracePath: existsSync(guess) ? guess : null });
  } else {
    const { dir, found, looked } = resolveTraces();
    if (!dir) {
      // A LOUD SKIP, NEVER A SILENT PASS — the same convention
      // check-oracle-schedule uses, and for the same reason: a green kaizo
      // gate with no oracle line in it means nothing was held against the
      // real mod on this machine.
      console.log('SKIP check-oracle-multislash: no kaizo oracle recording found');
      for (const l of looked) console.log(`     looked in ${l}`);
      console.log('     Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,');
      console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
      console.log('     THE ac-5 FAMILY IS THEN UNVERIFIED AGAINST THE REAL MOD.');
      return 0;
    }
    for (const f of found) {
      const t = join(dir, f);
      const s = seqFor(t);
      if (s) candidates.push({ seqPath: s, tracePath: t });
    }
    if (!candidates.length) {
      console.log('SKIP check-oracle-multislash: recordings exist but none has a spawn log');
      console.log(`     looked beside ${found.length} trace file(s) in ${dir}`);
      console.log('     for the kaizo_oracle_seq*.csv companion. Re-record: the spawn log is');
      console.log('     the only place per-attack creation counts exist.');
      return 0;
    }
  }

  // ── choose: the longest recording per MEASURED side ──────────────────────
  const chosen = new Map();
  const rejected = [];
  for (const c of candidates) {
    const seq = readSeq(c.seqPath);
    if (seq.col.kaizo_playing === undefined) {
      // The pointer column CANNOT stand in here. kaizo_atk names the NEXT
      // entry and flips on the launch frame, so grouping spawns by it would
      // credit every slash to the following turn. No safe fallback.
      rejected.push(`${basename(c.seqPath)}: no kaizo_playing column (predates it) —`
        + ' spawns cannot be attributed');
      continue;
    }
    if (!c.tracePath) {
      rejected.push(`${basename(c.seqPath)}: no trace companion, so the side cannot be measured`);
      continue;
    }
    const side = sideOf(readTrace(c.tracePath));
    if (!side) {
      const { aOnly, bOnly } = sideMarkers();
      rejected.push(`${basename(c.seqPath)}: side UNDETERMINED — it shows no A-only ac`
        + ` (${aOnly.join('/')}) and no B-only ac (${bOnly.join('/')}); an attack-lock`
        + ' recording is usually this');
      continue;
    }
    const n = readFileSync(c.seqPath, 'utf8').length;
    if (!chosen.has(side) || chosen.get(side).n < n) chosen.set(side, { ...c, seq, side, n });
  }

  console.log('check-oracle-multislash: the ac-5 rotating-slash family');
  console.log(`  ${candidates.length} recording(s) with a spawn log; using the longest per side`);
  for (const r of rejected) console.log(`  skipped ${r}`);
  if (!chosen.size) {
    console.log('\nSKIP — no recording could be attributed to a side, so the sim cannot be');
    console.log('     driven to match one. The A-Side and B-Side dispatch ac 5 at the same');
    console.log('     difficulty and get different attacks (slash_offset 6 vs 7,');
    console.log('     _endslashamt 28 vs 56), so guessing would compare the wrong thing.');
    return 0;
  }

  const totals = { compared: [], offsets: [], frameEqualities: 0, fanCycles: 0 };
  const ladders = new Map();
  for (const side of ['A', 'B']) {
    const c = chosen.get(side);
    if (!c) continue;
    const r = compareRecording({
      seqPath: c.seqPath, tracePath: c.tracePath, seq: c.seq,
      sideb: side === 'B', tag: side === 'B' ? 'B' : 'A',
    });
    totals.compared.push(...r.compared.map((id) => `${side}/${id}`));
    totals.offsets.push(...r.offsets);
    totals.frameEqualities += r.frameEqualities;
    totals.fanCycles += r.fanCycles;
    ladders.set(side, [...r.slashCounts.values()]);
  }

  console.log(`\n${'─'.repeat(74)}`);

  // ── THE ORIGIN SHIFT IS A CONSTANT, NOT A PER-ROW FIT ───────────────────
  if (totals.offsets.length) {
    eq([...new Set(totals.offsets)], [1],
      'the sim/oracle origin shift is exactly +1 frame, identical for every entry on'
      + ` every side (saw ${JSON.stringify(totals.offsets)}) — the controller is created`
      + ' mid-Step in the game and does not run until the next frame; the bench steps it'
      + ' immediately');
  }

  // ══════════════════════════════════════════════════════════════════════
  // POSITIVE EXECUTION ASSERTIONS. Without these the whole file could pass
  // by comparing nothing to nothing — the failure mode CLAUDE.md records
  // under "a suite of negative results can hide a dead code path".
  // ══════════════════════════════════════════════════════════════════════
  ok(totals.compared.length > 0,
    `at least one ac-5 turn was actually compared (${totals.compared.join(', ') || 'NONE'})`);
  ok(totals.frameEqualities >= 30 * totals.compared.length,
    `the frame-by-frame comparison actually ran: ${totals.frameEqualities} spawn frames compared`);
  ok(totals.fanCycles >= 4 * totals.compared.length,
    `the fan test actually ran: ${totals.fanCycles} multi-slash aim cycles inspected`);

  // THE LADDER IS THE POINT, and it must be DIFFERENT numbers. If the
  // difficulty branch were dead, all three would agree and everything above
  // would still be green.
  const WANT_LADDER = { A: [22, 36, 94], B: [22, 36, 150] };
  for (const [side, got] of ladders) {
    if (got.length !== 3) {
      notes.push(`${side}-Side: only ${got.length} of the 3 ac-5 entries were in that`
        + ' recording, so THE DIFFICULTY LADDER IS NOT CLAIMED for this side');
      continue;
    }
    eq(got, WANT_LADDER[side], `${side}-Side d0/d1/d2 slash ladder`);
    eq(new Set(got).size, 3, `${side}-Side: the three rungs are distinct (the difficulty branch is live)`);
  }
  if (ladders.has('A') && ladders.has('B') && ladders.get('A').length === 3 && ladders.get('B').length === 3) {
    ok(ladders.get('A')[2] !== ladders.get('B')[2],
      'and the two sides part company at d2 (94 vs 150) — the B-Side branch is live too');
  }

  // A DISCRIMINATION CONTROL: the same comparison, run wrong, must disagree.
  {
    const d0 = runSim({ id: 'control', ac: AC, difficulty: 0, phase: 1 }, { sideb: false });
    const n0 = (d0.byObj.get('obj_roaringknight_slash') ?? []).length;
    const anyD2 = [...ladders.values()].map((l) => l[2]).filter((v) => v !== undefined);
    ok(anyD2.length > 0 && anyD2.every((v) => v !== n0),
      `control: a d0 launch does NOT produce d2's ${anyD2.join('/')} slashes (it made ${n0})`
      + ' — the count comparison discriminates');
    const sb = runSim({ id: 'control', ac: AC, difficulty: 2, phase: 3 }, { sideb: true });
    const na = runSim({ id: 'control', ac: AC, difficulty: 2, phase: 3 }, { sideb: false });
    ok((sb.byObj.get('obj_roaringknight_slash') ?? []).length
      !== (na.byObj.get('obj_roaringknight_slash') ?? []).length,
    'control: the sim\'s A-Side and B-Side d2 differ, so the sideb flag is not inert');
  }

  // SEED INDEPENDENCE. The structure asserted above must be a property of the
  // module, not of one lucky RNG stream.
  {
    const a = runSim({ id: 'seedA', ac: AC, difficulty: 2, phase: 3 }, { seed: 4242 });
    const b = runSim({ id: 'seedB', ac: AC, difficulty: 2, phase: 3 }, { seed: 777 });
    const shape = (r) => {
      const base = (r.byObj.get('obj_knight_rotating_slash') ?? [{ frame: 0 }])[0].frame;
      return (r.byObj.get('obj_roaringknight_slash') ?? []).map((x) => x.frame - base).join(',');
    };
    eq(shape(b), shape(a), 'd2 cadence is seed-independent (seed 777 against 4242)');
    const ang = (r) => (r.byObj.get('obj_roaringknight_slash') ?? []).map((x) => x.angle).join(',');
    ok(ang(a) !== ang(b), 'control: the ANGLES do differ by seed (the RNG is live, not pinned)');
  }

  // ── report ───────────────────────────────────────────────────────────────
  console.log('');
  for (const n of notes) console.log(`  NOTE: ${n}`);
  if (failures.length) {
    console.log(`\n  ${failures.length} FAILURE(S) of ${checks} assertions:`);
    for (const f of failures) console.log(`    - ${f}`);
    return 1;
  }
  console.log(`\n  ${checks} assertions against the real mod   OK`);
  console.log(`  compared: ${totals.compared.join(', ')}`);
  const full = [...ladders.entries()].filter(([, l]) => l.length === 3).map(([s]) => s);
  if (full.length) {
    console.log(`  FULL DIFFICULTY LADDER on ${full.map((s) => `${s}-Side`).join(' and ')}`
      + ' — object set, per-type counts, the slash_array ladder, every circle/slash spawn');
    console.log('  frame at a constant +1 origin shift, spawn geometry, the two-fan angle');
    console.log('  structure and difficulty 2\'s spiral finisher. NOTHING about absolute');
    console.log('  timing, RNG draws, damage, HP or TP.');
  } else {
    // THE WORDING IS THE POINT, exactly as in check-oracle-schedule: a
    // one-entry recording passing must not read like the three-point ladder.
    console.log('  PARTIAL — no side supplied all three ac-5 entries, so THE DIFFICULTY');
    console.log('  LADDER IS NOT CLAIMED. Per-entry counts, cadence and geometry only.');
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
