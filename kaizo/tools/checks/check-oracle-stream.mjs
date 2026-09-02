#!/usr/bin/env node
// ORACLE CHECK — the KNIGHT STREAM + PIERCE BLADES family, held against a real
// recording of EnderCat8's "Kaizo Roaring Knight" v2.3.3.
//
//     node kaizo/tools/checks/check-oracle-stream.mjs [seq.csv] [trace.csv]
//
// V-C recreation of another author's creative work — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// THE TWO ENTRIES THIS OWNS, both from kaizo/versions/vc-script.js:
//
//     atk_XAttacks      ac 107  difficulty 0  phase 3   -> dc.type 103
//     atk_PierceBlades  ac 110  difficulty 0  phase 2   -> dc.type 101
//
// ── WHAT IS CLAIMED ───────────────────────────────────────────────────────
//
// For each entry, the SPAWN LEDGER the mod produced for one turn, measured
// from the recorder's per-instance seq log and reproduced by driving the sim
// through the SAME public entry points the fight driver uses — openVCArena,
// vcTurnLength and launchVCAttack in kaizo/scenes/kaizo-mod-launcher.js, on
// the VC_TABLE row itself. Specifically:
//
//   * THE OBJECT SET. Every watched object type the recording logged for the
//     entry, and nothing the sim makes that the recording did not — under the
//     recorder's own watch list (transcribed below) and under the sim's
//     two renamed sub-objects (see MOD_NAME).
//   * THE PER-TYPE COUNTS over the whole turn. 370 obj_regularbullet and
//     exactly 100 obj_knight_streamline for atk_XAttacks; 18
//     obj_regularbullet for atk_PierceBlades. These are loop bounds
//     (at_num = 18, slash_amt = 5, the timer%4 spray), not RNG.
//   * SPAWN GEOMETRY THAT IS STRUCTURAL. The Knight-relative x of the
//     PierceBlades carousel swords, ROW-EXACT to the recorder's ten decimals
//     when the sim's slasher is placed at the recording's own slasher
//     position; the fixed 1.25 scales, the zero speeds, the 32 x 0 beam
//     hitbox, the 15.8 spray speed; the 54px streamline ladder; the beams'
//     one-axis irandom offset from the board.
//   * ORDERING AND CADENCE. The spawn-frame histogram of every population:
//     one carousel sword every 3 frames, one beam pair every 45, four
//     streamlines every 3 within a cluster and 33 between clusters, and the
//     merged obj_regularbullet gap histogram {16 x5, 4 x25, 9 x4}.
//
// ── WHAT IS NOT CLAIMED, and asserting on it would be a bug here ──────────
//
//   * ABSOLUTE FRAME NUMBERS. The recording's turn lengths come from its own
//     pulsed-confirm input; nothing below compares a frame index across the
//     two sides. Every cadence claim is a DIFFERENCE of frames within one
//     population, and every offset is measured from the frame the population's
//     own manager was logged.
//   * ANY VALUE DRAWN FROM RNG. The beams' slash_angle, the ±40 board nudge,
//     the carousel swords' 176..184 jitter and the whole afterimage
//     population are re-anchored per launch by design (CLAUDE.md, "LIVE RNG
//     IS RE-ANCHORED PER ATTACK LAUNCH"). Where a random value is checked at
//     all it is checked for its STRUCTURE — the pair sums to 180, the offset
//     lands on one axis, the jitter lies inside the GML's own bounds — never
//     for its value.
//   * DAMAGE, HP, TP OR TARGETING. The recorder pins party and boss HP, so
//     every survival-shaped number in the trace is a harness artifact.
//   * obj_afterimage. It IS on the recorder's watch list and the recording
//     logs 401 / 368 / 201 of them for these turns, but the mod's Knight
//     trails rainbow afterimages unconditionally (rgbafterimages = 1) and the
//     sim scene here has no obj_knight_enemy — so the two populations are not
//     the same set and their counts are not the same measurement. Excluded by
//     name, loudly, rather than quietly tolerated.
//
// ── THE ATTRIBUTION RULE ──────────────────────────────────────────────────
//
// Launches are grouped by the `kaizo_playing` column and never by `kaizo_atk`
// — the mod's own record of what just fired, versus the pointer to what is
// next, which transitions ON the launch frame. This is trap #1 in
// knight-research/kaizo-mod/ORACLE-GROUND-TRUTH.md and it is the same rule
// check-oracle-schedule.mjs uses. atk_PierceBlades fires TWICE in the deep
// recording (the phase-3 -> phase-2 loop), so the seq rows are split into
// CONTIGUOUS runs of that column: one run per launch.
//
// ── THE FRAME THE COMPARISON IS ANCHORED TO ───────────────────────────────
//
// The mod's chain is knight Step (creates the dc) -> dc Step, one frame later
// (creates the attack object) -> the attack object's own first Step, one frame
// after that. The recording shows exactly this: obj_knight_stream and
// obj_knight_tunnel_slasher are both logged ONE frame after their launch
// frame. sim/scenes/practice.js's director models the same delay by arming the
// clock on the knight's frame and calling launchAttack on the next
// (`spawnDelay === 1`), so launchVCAttack corresponds to the mod's DC-STEP
// frame — the frame the attack object appears. Every relative frame below is
// therefore measured from the manager's own spawn row, never from the launch.
//
// ── THE TURN CLOCK EACH ENTRY IS DRIVEN WITH, and where it comes from ─────
//
//   atk_XAttacks     vcTurnLength returns 240; the recording's launch frame
//                    reads 239, the armed floor less the controller's own
//                    decrement. Driven at 240 - 1 = 239, which is the rule
//                    sim/scenes/practice.js already applies every turn.
//   atk_PierceBlades vcTurnLength returns 0 — the ac-110 dispatch arms NO
//                    floor, which is the model agreeing with the recording
//                    rather than a gap. Both recorded launches show the
//                    PREVIOUS turn's clock still draining through the launch
//                    (78 at f6109/f12604, 77 the frame after) until Other_21's
//                    own 999 lands. So the sim is handed 77 — the value the
//                    RECORDING gives for the frame the slasher is created,
//                    from rows f6110 and f12605. No number is invented.
//
// Nothing here depends on that clock being exactly right for atk_XAttacks:
// section D drives the same row at 195 and 285 and shows the cycle count moves
// with it, so "10 beams" is a measured consequence and not a constant.
//
// ── ONE MEASURED SHORTFALL, REPORTED RATHER THAN TOLERATED ────────────────
//
// 96 of the 100 recorded streamlines reconstruct EXACTLY from their own beam
// through the sim's lengthdir model, to the recorder's ten decimals. The other
// four are all on the one beam whose direction came up 45, and they miss by at
// most 3.0517609e-5 px. That is sim/gml.js's f32-pi runner-trig model, shared
// by every module in the project and out of this file's scope to change; the
// bound below is the residual THIS RECORDING measures (rows f9210 x2, f9216,
// f9219 of the seq log set it) and is not a tolerance chosen to make anything
// pass. The zero-tolerance form of the same claim — that every streamline's
// NEAREST ladder rung is the right one, the rungs being 54px apart — is
// asserted separately and holds 100/100.
//
// ── WIRING ────────────────────────────────────────────────────────────────
//
// kaizo/tools/verify-kaizo.mjs discovers every kaizo/tools/checks/check-*.mjs
// automatically, so this file already RUNS in the gate — but it is reported as
// work-in-progress and not enforced until 'check-oracle-stream' is added to
// that file's WIRED set, next to 'check-oracle-schedule' and for the same
// reason: it SKIPs loudly rather than failing when the recording is absent.
// verify-kaizo.mjs belongs to another work item; the one-line change is
// described in this task's handback rather than made here.

import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveTraces, readTrace, recoverLaunches } from './check-oracle-schedule.mjs';
import { createState, stepFrame, spawn } from '../../../sim/index.js';
import { soul } from '../../../sim/soul.js';
import { battlebox } from '../../../sim/battlebox.js';
import { gmlCreate } from '../../../sim/rng.js';
import { lengthdirX, lengthdirY } from '../../../sim/gml.js';
import { real } from '../../../sim/trace.js';
import { KNIGHT } from '../../../sim/actors.js';
import { VC_TABLE } from '../../versions/vc-script.js';
import {
  launchVCAttack, openVCArena, vcTurnLength, arenaGeom,
} from '../../scenes/kaizo-mod-launcher.js';

let failures = 0;
let checks = 0;
/** Comparisons that actually ran against the recording. The positive
 *  execution counter: a run that reports 0 of these has proved nothing. */
let oracleComparisons = 0;

function ok(cond, label) {
  checks += 1;
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`);
  }
}
/** ok(), plus "this one was held against the recording". */
function okO(cond, label) {
  oracleComparisons += 1;
  ok(cond, label);
}

// ── the recorder's watch list ──────────────────────────────────────────────
// Transcribed from knight-research/kaizo-mod/tools/patches/oracle_kaizo_fight.csx
// (the `_names` array its Create resolves to object indices once). It is what
// makes "the recording logged nothing else" mean anything: a negative result is
// only evidence if the instrument could have produced a positive one, and this
// list is exactly the set of positives the instrument can produce. Two whole
// attacks recorded as EMPTY before the managers were added to it.
const WATCHED = new Set([
  'obj_afterimage', 'obj_afterimage_fade_to_white', 'obj_bullet_knight_slash',
  'obj_bullet_knight_stream', 'obj_bullet_knight_tunnelslash',
  'obj_bullet_knightcrescent', 'obj_diagonal_bullet', 'obj_diagonal_bullet_manager',
  'obj_dknight_slasher', 'obj_fake_gt', 'obj_fallingsword', 'obj_knight_bullethell1',
  'obj_knight_bullethell2', 'obj_knight_bullethell_bullet', 'obj_knight_bullethell_bullet2',
  'obj_knight_bullethell_bullet_bounce', 'obj_knight_circle', 'obj_knight_combinations',
  'obj_knight_crescentslash_slashinganimation', 'obj_knight_crush',
  'obj_knight_diamondswordbullet_ext', 'obj_knight_lightorb', 'obj_knight_pointing_cone',
  'obj_knight_pointing_star', 'obj_knight_pointing_starchild', 'obj_knight_ring',
  'obj_knight_roaring2', 'obj_knight_roaring_fx', 'obj_knight_roaring_star',
  'obj_knight_rotating_slash', 'obj_knight_slasher', 'obj_knight_spark',
  'obj_knight_split_growtangle', 'obj_knight_split_growtangle_backup',
  'obj_knight_split_growtangle_effect', 'obj_knight_split_growtangle_vertical',
  'obj_knight_stream', 'obj_knight_streamline', 'obj_knight_swordfall',
  'obj_knight_swordtunnelanim', 'obj_knight_triangle', 'obj_knight_tunnel_slasher',
  'obj_knight_tunnel_slasher_2_revised', 'obj_knight_warp',
  'obj_knight_weird_bottom_manager', 'obj_knight_weird_circle',
  'obj_knight_weird_circle_bullet', 'obj_marker', 'obj_regularbullet',
  'obj_roaringknight_boxsplitter_attack', 'obj_roaringknight_fountain_bullet',
  'obj_roaringknight_fountain_bullet_old', 'obj_roaringknight_quickslash',
  'obj_roaringknight_quickslash_afterimage', 'obj_roaringknight_quickslash_attack',
  'obj_roaringknight_quickslash_big', 'obj_roaringknight_slash',
  'obj_roaringknight_split_bullet', 'obj_roaringknight_splitslash',
  'obj_sword_tunnel_manager', 'obj_sword_vortex_manager', 'obj_tracking_sword1',
  'obj_tracking_swords_manager',
]);

// EXCLUDED FROM EVERY COUNT, by name and for a stated reason (see the header).
const EXCLUDED = new Set(['obj_afterimage', 'obj_afterimage_fade_to_white']);

/**
 * The sim gives two of the mod's plain `obj_regularbullet` instances their own
 * entity types, because this engine dispatches behaviour off `type` and the
 * two do different things (kaizo/attacks/knight-stream.js: the beam's child
 * hitbox, and the doubled spray's sword). The recording sees one object name
 * for both, so the comparison folds them back — a NAMING difference, and
 * folding it is not loosening anything: their COUNTS are still asserted
 * separately below through their distinct scales and speeds.
 */
const MOD_NAME = {
  obj_bullet_stream_hitbox: 'obj_regularbullet',
  obj_bullet_stream_sword: 'obj_regularbullet',
};
const modName = (n) => MOD_NAME[n] ?? n;

// ── reading the seq log ────────────────────────────────────────────────────

/** Parse the recorder's per-spawn CSV. Same shape as readTrace's. */
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
 * One record per LAUNCH of `id`: the contiguous runs of `kaizo_playing`.
 * A contiguous run is the right unit because the seq log is written in frame
 * order and the column holds one entry id for the whole turn — so two runs of
 * the same id are two launches, which is exactly what atk_PierceBlades needs
 * (it fires at f6109 and again at f12604, through VC_LOOP).
 */
function seqRuns(seq) {
  const runs = [];
  let cur = null;
  for (const r of seq.rows) {
    const k = r[seq.col.kaizo_playing];
    if (!cur || cur.key !== k) {
      cur = { key: k, rows: [] };
      runs.push(cur);
    }
    cur.rows.push(r);
  }
  for (const run of runs) {
    run.first = Number(run.rows[0][seq.col.frame]);
    run.last = Number(run.rows[run.rows.length - 1][seq.col.frame]);
  }
  // The LAST run in the file is cut off by the frame budget, not by the turn
  // ending. Flagged rather than dropped: its complete populations (the ones
  // that finish inside the window) are still ground truth.
  if (runs.length) runs[runs.length - 1].truncated = true;
  return runs;
}

/** { name -> [ {frame, x, y, angle, xscale, yscale, direction, speed, raw} ] } */
function ledgerOf(seq, run) {
  const c = seq.col;
  const by = new Map();
  for (const r of run.rows) {
    const name = r[c.object];
    if (EXCLUDED.has(name)) continue;
    if (!by.has(name)) by.set(name, []);
    by.get(name).push({
      frame: Number(r[c.frame]),
      x: Number(r[c.x]),
      y: Number(r[c.y]),
      angle: Number(r[c.angle]),
      xscale: Number(r[c.xscale]),
      yscale: Number(r[c.yscale]),
      direction: Number(r[c.direction]),
      speed: Number(r[c.speed]),
      xs: r[c.x],
      ys: r[c.y], // the RAW ten-decimal strings, for exact comparison
    });
  }
  return by;
}

/** counts per object name, as a stable printable string. */
function countsOf(by) {
  return [...by.entries()]
    .map(([n, rs]) => [n, rs.length])
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
}
const countsKey = (c) => c.map(([n, k]) => `${n}x${k}`).join(' ');

/** frame-gap histogram over the DISTINCT spawn frames of one population. */
function frameShape(rs) {
  const per = new Map();
  for (const r of rs) per.set(r.frame, (per.get(r.frame) ?? 0) + 1);
  const keys = [...per.keys()].sort((a, b) => a - b);
  const gaps = {};
  for (let i = 1; i < keys.length; i++) {
    const g = keys[i] - keys[i - 1];
    gaps[g] = (gaps[g] ?? 0) + 1;
  }
  return {
    frames: keys,
    distinct: keys.length,
    groupSizes: [...new Set(per.values())].sort((a, b) => a - b),
    gaps,
    span: keys.length ? keys[keys.length - 1] - keys[0] : 0,
  };
}
const shapeKey = (s) => `distinct ${s.distinct} sizes[${s.groupSizes.join(',')}] gaps ${JSON.stringify(s.gaps)}`;

// ── driving the sim ────────────────────────────────────────────────────────

/**
 * The scene the central launcher expects: a board placed by the MOD'S OWN
 * arena table, a soul inside it, and twelve frames of grow-in before the
 * attack spawns — the game's `rtimer == 12` gap, during which the board is
 * already growing and the arena is empty (CLAUDE.md, "The turn's real
 * buffers"). No obj_knight_enemy: the mod's rainbow trail is excluded from
 * every count here, and both launches read the Knight's position through
 * knightPos()'s KNIGHT fallback, which the recording confirms at x 425.
 */
function buildVcScene(row, { seed = 12345, sideb = false } = {}) {
  const state = createState({ seed });
  // createState leaves the GameMaker stream on seed 0; every scene re-seeds.
  state.gmlRng = gmlCreate(seed);
  state.kaizo = { sideb };
  state.keepAlive = true; // the party stands back up; the run never stalls
  state.invTimer = -1;
  const g = arenaGeom(row, sideb);
  spawn(state, battlebox, { x: g.x + g.dx, y: g.y + g.dy });
  state.soul = spawn(state, soul, { x: g.x + g.dx - 6, y: g.y + g.dy - 8 });
  openVCArena(state, row, { sideb });
  for (let f = 0; f < 12; f++) stepFrame(state, {});
  return state;
}

/**
 * Launch `row` through the central launcher and watch every entity's FIRST
 * frame, which is what the recorder logs. Frames are numbered from the launch
 * call, and the launch call is the mod's dc-Step frame (header).
 *
 * `clock` is the turn clock handed to the attack. See the header for where
 * each entry's value comes from; nothing here invents one.
 *
 * `ownerAt` overrides the launched controller's position BEFORE its first
 * Step. It exists for one job: re-running a turn with the manager placed
 * exactly where the RECORDING had it, so the sim's geometry can be held
 * against the recording's own numbers instead of against a scene constant.
 * The Knight bobs, so his y is the one input this family's geometry takes
 * that the sim cannot know a priori.
 */
function runVc(row, {
  seed = 12345, sideb = false, frames = 460, clock, ownerAt,
} = {}) {
  const state = buildVcScene(row, { seed, sideb });
  const turnLength = vcTurnLength(row, { sideb });
  const owner = launchVCAttack(state, row, { sideb });
  if (ownerAt && owner) {
    // Built-ins, so they narrow to f32 on store exactly as the game's do.
    owner.x = ownerAt.x;
    owner.y = ownerAt.y;
  }
  state.turntimer = clock ?? (turnLength > 0 ? turnLength - 1 : 0);
  const seen = new Map();
  const clocks = [];
  for (let f = 0; f < frames; f++) {
    stepFrame(state, {});
    for (const e of state.entities) {
      if (!e.alive || seen.has(e.seq)) continue;
      const name = modName(e.type.name);
      seen.set(e.seq, {
        frame: f,
        name,
        x: e.x,
        y: e.y,
        angle: e.image_angle ?? 0,
        xscale: e.image_xscale ?? 1,
        yscale: e.image_yscale ?? 1,
        direction: e.direction ?? 0,
        speed: e.speed ?? 0,
        simName: e.type.name,
        xs: real(e.x),
        ys: real(e.y),
      });
    }
    // obj_battlecontroller's decrement, in the slot sim/scenes/practice.js
    // measured for it: after every Step, gated on a positive clock.
    if (state.turntimer > 0) state.turntimer -= 1;
    clocks.push(state.turntimer);
  }
  const by = new Map();
  for (const r of seen.values()) {
    if (EXCLUDED.has(r.name)) continue;
    if (!WATCHED.has(r.name)) continue; // engine machinery the recorder cannot see
    if (!by.has(r.name)) by.set(r.name, []);
    by.get(r.name).push(r);
  }
  for (const rs of by.values()) rs.sort((a, b) => a.frame - b.frame || a.x - b.x);
  const unwatched = [...new Set([...seen.values()]
    .filter((r) => !WATCHED.has(r.name) && !EXCLUDED.has(r.name))
    .map((r) => r.name))];
  return { state, owner, by, clocks, unwatched, turnLength };
}

const rowById = (id) => {
  for (const p of Object.keys(VC_TABLE)) {
    const r = VC_TABLE[p].find((x) => x.id === id);
    if (r) return r;
  }
  return null;
};

const F32 = Math.fround;

/**
 * Classify each streamline against the ladder its own beam defines:
 * `beam + sign * lengthdir(54 * i, dir + 270)` for i in 0..4. The rungs are
 * 54px apart, so NEAREST is unambiguous and needs no threshold at all.
 * Returns { hist, exact, total, maxResidual, misses }.
 */
function streamlineLadder(beams, lines, { distDiff = 54, slashAmt = 5 } = {}) {
  const hist = new Map();
  const misses = [];
  let exact = 0;
  let maxResidual = 0;
  for (const l of lines) {
    const beam = beams
      .filter((b) => b.direction === l.direction && b.frame < l.frame)
      .sort((a, z) => z.frame - a.frame)[0];
    if (!beam) {
      misses.push({ ...l, why: 'no beam with this direction precedes it' });
      continue;
    }
    let best = null;
    for (let i = 0; i < slashAmt; i += 1) {
      for (const s of [1, -1]) {
        const x = F32(beam.x + s * lengthdirX(distDiff * i, l.direction + 270));
        const y = F32(beam.y + s * lengthdirY(distDiff * i, l.direction + 270));
        const residual = Math.max(Math.abs(x - l.x), Math.abs(y - l.y));
        const isExact = real(x) === l.xs && real(y) === l.ys;
        const key = i === 0 ? '0' : `${s > 0 ? '+' : '-'}${distDiff * i}`;
        if (!best || residual < best.residual) best = { residual, isExact, key };
      }
    }
    hist.set(best.key, (hist.get(best.key) ?? 0) + 1);
    maxResidual = Math.max(maxResidual, best.residual);
    if (best.isExact) exact += 1;
    else misses.push({ frame: l.frame, direction: l.direction, x: l.xs, y: l.ys, residual: best.residual, rung: best.key });
  }
  return { hist, exact, total: lines.length, maxResidual, misses };
}

// Code-unit order, NOT localeCompare: the keys are '+54' / '-54' / '0' and a
// locale collator reorders the signs by rules that vary with the environment,
// which would make this check's own comparison string machine-dependent.
const histKey = (m) => [...m.entries()]
  .sort((a, b) => (a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0)))
  .map(([k, v]) => `${k}:${v}`).join(' ');

/**
 * THE FRAME THE ATTACK OBJECT WAS CREATED, in each side's own numbering.
 *
 * Oracle: the manager's own seq row — the recorder logs an instance on the
 * frame it is made, before it has stepped.
 *
 * Sim: -1. launchVCAttack creates the object BEFORE the loop's first
 * stepFrame, and this engine freezes the entity list at the start of each
 * phase, so the object's first Step is loop frame 0. Loop frame 0 is
 * therefore the game's "one frame after creation", and creation is -1.
 *
 * Getting this wrong is a silent one-frame shift in every cadence offset
 * below, which is exactly the class of error CLAUDE.md records for delayed
 * tweens ("count n - 1").
 */
const SIM_CREATION_FRAME = -1;
/** first spawn of `rs`, in frames after the attack object was created. */
const firstAfter = (rs, anchor) => (rs.length ? rs[0].frame - anchor : null);

// THE RESIDUAL BOUND, MEASURED, NOT CHOSEN. See the header: rows f9210 (x2),
// f9216 and f9219 of kaizo_oracle_seq_deep.csv are the four streamlines the
// sim's f32-pi lengthdir model does not reproduce bit-for-bit, and 3.0517609e-5
// px is the largest of their residuals. Nothing is allowed to move further than
// the recording itself already shows.
const TRIG_RESIDUAL_BOUND = 3.06e-5;

// ═══════════════════════════════════════════════════════════════════════════

function main() {
  let seqPath = process.argv[2];
  let tracePath = process.argv[3];

  if (!seqPath) {
    const { dir, found, looked } = resolveTraces();
    if (!dir) {
      // A LOUD SKIP, NEVER A SILENT PASS — the same convention
      // check-oracle-schedule.mjs uses. A green kaizo gate with no oracle line
      // in it means nothing was held against the real mod on this machine.
      console.log('SKIP check-oracle-stream: no kaizo oracle recording found');
      for (const l of looked ?? []) console.log(`     looked in ${l}`);
      console.log('     Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,');
      console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
      console.log('     ac 107 AND ac 110 ARE THEN UNCHECKED AGAINST THE REAL MOD.');
      return 0;
    }
    // The LONGEST recording, for the same reason check-oracle-schedule picks
    // it: MODE 1 locks are short and replay one entry, so they are the wrong
    // instrument for a chain that has to reach phase 3.
    tracePath = found
      .map((f) => join(dir, f))
      .map((p) => ({ p, n: readFileSync(p, 'utf8').length }))
      .sort((a, b) => b.n - a.n)[0].p;
    // The per-spawn companion sits beside the per-frame trace, with `trace`
    // swapped for `seq` in the basename (the recorder writes both per run).
    seqPath = join(dirname(tracePath), basename(tracePath).replace('trace', 'seq'));
  }

  if (!existsSync(seqPath)) {
    console.log('SKIP check-oracle-stream: the per-frame trace is present but its');
    console.log(`     per-SPAWN companion is not — expected ${seqPath}`);
    console.log('     This check compares spawn ledgers, so the trace alone is not enough.');
    console.log('     Re-record: run-kaizo-oracle.ps1 writes both files per run.');
    return 0;
  }

  const seq = readSeq(seqPath);
  for (const need of ['frame', 'object', 'x', 'y', 'angle', 'xscale', 'yscale', 'direction', 'speed', 'kaizo_playing']) {
    if (seq.col[need] === undefined) {
      console.log(`FAIL check-oracle-stream: ${seqPath} has no "${need}" column`);
      console.log(`     columns present: ${seq.header.join(',')}`);
      return 1;
    }
  }
  if (seq.col.kaizo_playing === undefined) {
    // Unreachable given the loop above; kept as the explicit statement of the
    // attribution rule's precondition.
    console.log('SKIP check-oracle-stream: this recording predates the kaizo_playing column');
    return 0;
  }

  console.log(`check-oracle-stream: ${seqPath}`);
  console.log(`  ${seq.rows.length} spawn rows`);

  const runs = seqRuns(seq);
  const xRuns = runs.filter((r) => r.key === 'atk_XAttacks');
  const pRuns = runs.filter((r) => r.key === 'atk_PierceBlades');
  console.log(`  atk_XAttacks: ${xRuns.length} launch(es)   atk_PierceBlades: ${pRuns.length} launch(es)`);

  if (!xRuns.length && !pRuns.length) {
    console.log('SKIP check-oracle-stream: this recording never played either entry.');
    console.log('     atk_XAttacks is phase 3 turn 3 and atk_PierceBlades phase 2 turn 5,');
    console.log('     so a short MODE 0 run reaches neither. Use a >= 9500-frame recording,');
    console.log('     or a MODE 1 lock on the entry.');
    return 0;
  }

  // ── THE ORACLE LEDGER, printed whether or not anything passes ────────────
  // It is the only ground truth about this family that exists in the tree.
  console.log('\n── ORACLE SPAWN LEDGER (obj_afterimage excluded, see header) ──');
  const oracle = new Map();
  for (const run of [...xRuns, ...pRuns]) {
    const by = ledgerOf(seq, run);
    const list = oracle.get(run.key) ?? [];
    list.push({ run, by });
    oracle.set(run.key, list);
    console.log(`  ${run.key}  f${run.first}..${run.last}`
      + `${run.truncated ? '  [TRUNCATED by the frame budget]' : ''}`);
    for (const [n, rs] of countsOf(by)) {
      const s = frameShape(by.get(n));
      const anchor = by.get(n)[0].frame;
      console.log(`     ${n.padEnd(30)} x${String(rs).padStart(4)}`
        + `  rel f+${anchor - run.first}..+${s.frames[s.frames.length - 1] - run.first}`
        + `  ${shapeKey(s)}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nA. atk_XAttacks (ac 107 -> dc.type 103) — the object set and counts');
  if (!xRuns.length) {
    console.log('  NOT IN THIS RECORDING — sections A, B and D make no claim.');
  } else {
    const row = rowById('atk_XAttacks');
    ok(row?.ac === 107 && row.difficulty === 0 && row.phase === 3,
      `VC_TABLE row is ac ${row?.ac} difficulty ${row?.difficulty} phase ${row?.phase}`);
    const oRun = oracle.get('atk_XAttacks')[0];
    const oBy = oRun.by;
    const sim = runVc(row, { frames: 400 });

    ok(sim.turnLength === 240,
      `vcTurnLength(ac 107) is ${sim.turnLength} — the ac >= 100 arm's own scr_turntimer(240)`);

    const oCounts = countsOf(oBy);
    const sCounts = countsOf(sim.by);
    console.log(`     oracle: ${countsKey(oCounts)}`);
    console.log(`     sim   : ${countsKey(sCounts)}`);
    if (sim.unwatched.length) {
      console.log(`     (sim also made ${sim.unwatched.join(', ')} — engine machinery`);
      console.log('      outside the recorder\'s watch list, so not comparable either way)');
    }
    okO(countsKey(oCounts) === countsKey(sCounts),
      'the whole watched spawn ledger matches, type for type and count for count');

    // Each count called out on its own, so a failure names the population.
    for (const [n, k] of oCounts) {
      okO((sim.by.get(n)?.length ?? 0) === k,
        `${n}: oracle ${k}, sim ${sim.by.get(n)?.length ?? 0}`);
    }
    // POSITIVE EXECUTION: the two round numbers the GML's loop bounds predict.
    okO(oBy.get('obj_knight_streamline')?.length === 100
      && sim.by.get('obj_knight_streamline')?.length === 100,
      'exactly 100 obj_knight_streamline on BOTH sides (5 cycles x 2 beams x'
      + ' slash_amt 5 x 2 signs — a literal loop bound, not RNG)');
    okO(oBy.get('obj_regularbullet')?.length === 370
      && sim.by.get('obj_regularbullet')?.length === 370,
      'exactly 370 obj_regularbullet on BOTH sides (10 beam hitboxes + 5 x 2 x 6 x 6 spray)');

    // ── the manager ────────────────────────────────────────────────────────
    const oMg = oBy.get('obj_knight_stream')?.[0];
    const sMg = sim.by.get('obj_knight_stream')?.[0];
    okO(!!oMg && !!sMg && oMg.x === sMg.x && sMg.x === KNIGHT.x,
      `obj_knight_stream spawns at the Knight's x: oracle ${oMg?.x}, sim ${sMg?.x} (KNIGHT.x ${KNIGHT.x})`);
    okO(!!oMg && !!sMg && oMg.xscale === 2 && oMg.yscale === 2
      && sMg.xscale === 2 && sMg.yscale === 2,
      'obj_knight_stream is 2 x 2 on both sides (scr_darksize)');
    okO(!!oMg && oMg.frame - oRun.run.first === 1,
      `obj_knight_stream is logged ONE frame after the launch — the dc-Step delay`
      + ` (rel f+${oMg ? oMg.frame - oRun.run.first : '?'})`);

    // ── the beams ──────────────────────────────────────────────────────────
    console.log('\nB. atk_XAttacks — beams, streamlines, spray');
    const oBeams = oBy.get('obj_bullet_knight_stream') ?? [];
    const sBeams = sim.by.get('obj_bullet_knight_stream') ?? [];
    const oBeamShape = frameShape(oBeams);
    const sBeamShape = frameShape(sBeams);
    okO(shapeKey(oBeamShape) === shapeKey(sBeamShape)
      && oBeamShape.groupSizes.join() === '2'
      && Object.keys(oBeamShape.gaps).join() === '45',
      `beam pairs: one pair every 45 frames on both sides (${shapeKey(oBeamShape)})`);
    okO(firstAfter(oBeams, oMg.frame) === firstAfter(sBeams, SIM_CREATION_FRAME)
      && firstAfter(oBeams, oMg.frame) === 20,
      `the first beam pair lands 20 frames after obj_knight_stream is created on`
      + ` both sides (oracle +${firstAfter(oBeams, oMg.frame)},`
      + ` sim +${firstAfter(sBeams, SIM_CREATION_FRAME)}) — Step_0's timer == 20`);

    // The pair is (slash_angle, 180 - slash_angle): a STRUCTURE, not a value.
    const pairSums = (bs) => {
      const byFrame = new Map();
      for (const b of bs) {
        if (!byFrame.has(b.frame)) byFrame.set(b.frame, []);
        byFrame.get(b.frame).push(b.direction);
      }
      return [...byFrame.values()].map((d) => d.reduce((a, v) => a + v, 0));
    };
    okO(pairSums(oBeams).every((s) => s === 180) && pairSums(sBeams).every((s) => s === 180),
      `every beam pair's two directions sum to 180 on both sides`
      + ` (oracle ${pairSums(oBeams).join(',')}; sim ${pairSums(sBeams).join(',')})`);

    // The board nudge: `plane_shift = choose(true,false)` moves ONE axis by
    // irandom_range(-40,40) off obj_growtangle. The axis and the amount are
    // RNG; that exactly one axis moves, by an integer inside ±40, is not.
    const nudge = (bs, gx, gy) => bs.map((b) => ({
      dx: b.x - gx, dy: b.y - gy,
    }));
    const oNudge = nudge(oBeams, 320, 170);
    const gtSim = sim.state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
    const sNudge = nudge(sBeams, gtSim.x, gtSim.y);
    const nudgeOk = (ns) => ns.every((n) => (n.dx === 0 || n.dy === 0)
      && Number.isInteger(n.dx) && Number.isInteger(n.dy)
      && Math.abs(n.dx) <= 40 && Math.abs(n.dy) <= 40);
    okO(nudgeOk(oNudge) && nudgeOk(sNudge),
      'every beam pair sits on the board with exactly ONE axis nudged, by an'
      + ` integer within ±40 (oracle ${oNudge.map((n) => `${n.dx},${n.dy}`).join(' | ')};`
      + ` sim ${sNudge.map((n) => `${n.dx},${n.dy}`).join(' | ')})`);

    // ── the streamline ladder ──────────────────────────────────────────────
    const oLines = oBy.get('obj_knight_streamline') ?? [];
    const sLines = sim.by.get('obj_knight_streamline') ?? [];
    const oLineShape = frameShape(oLines);
    const sLineShape = frameShape(sLines);
    okO(shapeKey(oLineShape) === shapeKey(sLineShape),
      `streamline cadence identical: ${shapeKey(oLineShape)}`);
    okO(firstAfter(oLines, oMg.frame) === firstAfter(sLines, SIM_CREATION_FRAME)
      && firstAfter(oLines, oMg.frame) === 22,
      `the first streamline group lands 22 frames after obj_knight_stream is`
      + ` created on both sides (oracle +${firstAfter(oLines, oMg.frame)},`
      + ` sim +${firstAfter(sLines, SIM_CREATION_FRAME)}) — the i = 0 arm of`
      + ' `timer == 22 + i * time_diff`');
    okO(oLineShape.groupSizes.join() === '4'
      && JSON.stringify(oLineShape.gaps) === JSON.stringify({ 3: 20, 33: 4 }),
      'four streamlines per frame, every 3 frames within a cycle (time_diff 3,'
      + ' slash_amt 5) and 33 frames between cycles — on the recording');

    okO([...new Set(oLines.map((l) => l.direction))].sort((a, b) => a - b).join()
      === [...new Set(oBeams.map((b) => b.direction))].sort((a, b) => a - b).join()
      && [...new Set(sLines.map((l) => l.direction))].sort((a, b) => a - b).join()
      === [...new Set(sBeams.map((b) => b.direction))].sort((a, b) => a - b).join(),
      'the streamline direction set is exactly the beam direction set, both sides');

    okO(oLines.every((l) => l.xscale === 1 && l.yscale === 1 && l.speed === 0 && l.angle === 0)
      && sLines.every((l) => l.xscale === 1 && l.yscale === 1 && l.speed === 0 && l.angle === 0),
      'every streamline is 1 x 1, speed 0, image_angle 0 (spr_nothing, speed arg 0)');

    const oLad = streamlineLadder(oBeams, oLines);
    const sLad = streamlineLadder(sBeams, sLines);
    const LADDER = '+108:10 +162:10 +216:10 +54:10 -108:10 -162:10 -216:10 -54:10 0:20';
    okO(histKey(oLad.hist) === LADDER,
      `the recording's streamlines sit on the 54px ladder: ${histKey(oLad.hist)}`);
    okO(histKey(sLad.hist) === LADDER,
      `the sim's do too, rung for rung: ${histKey(sLad.hist)}`);
    // ROW-EXACT, against the recorder's own ten decimals, using the ORACLE'S
    // beam as the input — the sim's geometry predicting the mod's numbers.
    okO(oLad.exact >= 96,
      `${oLad.exact}/${oLad.total} recorded streamlines reconstruct EXACTLY from`
      + ' their own beam through the sim\'s lengthdir model');
    okO(oLad.maxResidual <= TRIG_RESIDUAL_BOUND,
      `and the largest residual is ${oLad.maxResidual.toExponential(6)} px,`
      + ` inside the ${TRIG_RESIDUAL_BOUND} the recording itself measures`);
    for (const m of oLad.misses) {
      console.log(`  NOTE: f${m.frame} dir ${m.direction} rung ${m.rung} — not bit-exact,`
        + ` residual ${m.residual.toExponential(4)} px (sim/gml.js f32-pi trig)`);
    }

    // ── the spray and the hitboxes ─────────────────────────────────────────
    const split = (rs) => ({
      hit: rs.filter((r) => r.xscale === 32),
      spray: rs.filter((r) => r.xscale === 1),
    });
    const oRb = split(oBy.get('obj_regularbullet') ?? []);
    const sRb = split(sim.by.get('obj_regularbullet') ?? []);
    okO(oRb.hit.length === 10 && sRb.hit.length === 10
      && oRb.spray.length === 360 && sRb.spray.length === 360,
      `obj_regularbullet splits the same way: 10 beam hitboxes at xscale 32 +`
      + ` 360 spray swords at xscale 1 (oracle ${oRb.hit.length}/${oRb.spray.length},`
      + ` sim ${sRb.hit.length}/${sRb.spray.length})`);
    okO(oRb.hit.every((r) => r.yscale === 0 && r.speed === 0)
      && sRb.hit.every((r) => r.yscale === 0 && r.speed === 0),
      'the beam hitbox is created 32 x 0 at speed 0 (kaizo bullet Create_0:20-35)');
    okO(oRb.spray.every((r) => r.yscale === 1 && r.speed === 15.8000001907)
      && sRb.spray.every((r) => r.yscale === 1 && real(r.speed) === '15.8000001907'),
      'every spray sword is 1 x 1 at speed 15.8 — scr_fire_bullet 15 plus one'
      + ' frame of the negative friction -0.8, f32');
    const oRbShape = frameShape(oBy.get('obj_regularbullet') ?? []);
    const sRbShape = frameShape(sim.by.get('obj_regularbullet') ?? []);
    okO(shapeKey(oRbShape) === shapeKey(sRbShape)
      && JSON.stringify(oRbShape.gaps) === JSON.stringify({ 4: 25, 9: 4, 16: 5 }),
      `the merged obj_regularbullet spawn-frame shape matches: ${shapeKey(oRbShape)}`);

    // ── D. the cycle count is CLOCK-DRIVEN, not a constant ─────────────────
    console.log('\nD. atk_XAttacks — the 5 cycles are a consequence of the clock (control)');
    const beamsAt = (clock) => runVc(row, { frames: 520, clock })
      .by.get('obj_bullet_knight_stream')?.length ?? 0;
    const c195 = beamsAt(195);
    const c239 = beamsAt(239);
    const c285 = beamsAt(285);
    ok(c239 === 10 && c195 === 8 && c285 === 12,
      `beam count moves with the turn clock: 195 -> ${c195}, 239 -> ${c239},`
      + ` 285 -> ${c285} — so the 10 above is measured, not hardcoded`);
    // Seeds: the ledger is invariant, which is what "RNG re-anchored" must mean.
    const seedCounts = [1, 7, 999, 20260810].map((s) => countsKey(countsOf(
      runVc(row, { frames: 400, seed: s }).by,
    )));
    ok(new Set(seedCounts).size === 1 && seedCounts[0] === countsKey(sCounts),
      'the sim ledger is identical across four seeds — every count above is a'
      + ' loop bound, and only the geometry inside it is random');
  }

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nC. atk_PierceBlades (ac 110 -> dc.type 101) — the carousel');
  if (!pRuns.length) {
    console.log('  NOT IN THIS RECORDING — section C makes no claim.');
  } else {
    const row = rowById('atk_PierceBlades');
    ok(row?.ac === 110 && row.difficulty === 0 && row.phase === 2,
      `VC_TABLE row is ac ${row?.ac} difficulty ${row?.difficulty} phase ${row?.phase}`);
    ok(vcTurnLength(row, { sideb: false }) === 0,
      'vcTurnLength(ac 110) is 0 — the dispatch arms NO floor, which is the'
      + ' model agreeing with the recording rather than a gap');

    // THE TURN CLOCK, from the per-frame trace: the previous turn's clock is
    // still draining through the launch, identically on BOTH launches.
    const t = readTrace(tracePath);
    const launches = recoverLaunches(t).filter((L) => L.played === 'atk_PierceBlades');
    console.log(`     ${launches.length} PierceBlades launch(es) in the per-frame trace:`
      + ` ${launches.map((L) => `f${L.frame} clock ${L.turntimerArmed}`).join(', ')}`);
    okO(launches.length >= 2
      && launches.every((L) => L.turntimerArmed === launches[0].turntimerArmed),
      `both launches read the SAME launch-frame clock (${launches[0]?.turntimerArmed})`
      + ' — turn lengths are deterministic across the phase-3 -> phase-2 loop');

    // Drive the sim at the clock the RECORDING gives for the frame the slasher
    // is created (78 at the launch frame, 77 the frame after).
    const sim = runVc(row, { frames: 200, clock: 77 });
    okO(sim.clocks[0] === 998 && sim.clocks.slice(0, 40).every((c) => c === 998),
      `handed the recording's 77, the sim's carousel pins global.turntimer 999`
      + ` on the attack object's FIRST Step (post-decrement ${sim.clocks[0]}),`
      + ' the same one-frame offset the recording shows at f6111 / f12606');

    const sCounts = countsOf(sim.by);
    console.log(`     sim   : ${countsKey(sCounts)}`);
    if (sim.unwatched.length) {
      console.log(`     (sim also made ${sim.unwatched.join(', ')} — outside the`
        + ' recorder\'s watch list)');
    }

    let passIdx = 0;
    for (const oRun of oracle.get('atk_PierceBlades')) {
      passIdx += 1;
      const oBy = oRun.by;
      const label = `pass ${passIdx} (f${oRun.run.first})`;
      const oCounts = countsOf(oBy);
      console.log(`     ${label} oracle: ${countsKey(oCounts)}`
        + `${oRun.run.truncated ? '   [run truncated at the recording\'s last frame]' : ''}`);
      okO(countsKey(oCounts) === countsKey(sCounts),
        `${label}: the whole watched spawn ledger matches the sim`);
      okO(oBy.get('obj_regularbullet')?.length === 18,
        `${label}: exactly 18 carousel swords (at_num = 18, Other_21 line 27)`);
      okO(oBy.get('obj_knight_tunnel_slasher')?.length === 1,
        `${label}: exactly one obj_knight_tunnel_slasher`);

      const oMg = oBy.get('obj_knight_tunnel_slasher')[0];
      const sMg = sim.by.get('obj_knight_tunnel_slasher')[0];
      okO(oMg.x === sMg.x && sMg.x === KNIGHT.x,
        `${label}: the slasher spawns at the Knight's x (oracle ${oMg.x}, sim ${sMg.x})`);
      okO(oMg.xscale === 2 && oMg.yscale === 2 && sMg.xscale === 2 && sMg.yscale === 2,
        `${label}: the slasher is 2 x 2 on both sides`);
      okO(oMg.frame - oRun.run.first === 1,
        `${label}: the slasher is logged ONE frame after the launch (dc-Step delay)`);

      const oSw = oBy.get('obj_regularbullet');
      const sSw = sim.by.get('obj_regularbullet');
      const oShape = frameShape(oSw);
      const sShape = frameShape(sSw);
      okO(shapeKey(oShape) === shapeKey(sShape)
        && JSON.stringify(oShape.gaps) === JSON.stringify({ 3: 17 }),
        `${label}: one sword every 3 frames, 17 gaps (at_delay = 3): ${shapeKey(oShape)}`);
      okO(firstAfter(oSw, oMg.frame) === firstAfter(sSw, SIM_CREATION_FRAME)
        && firstAfter(oSw, oMg.frame) === 5,
        `${label}: the first sword lands 5 frames after the slasher is created on`
        + ` both sides (oracle +${firstAfter(oSw, oMg.frame)},`
        + ` sim +${firstAfter(sSw, SIM_CREATION_FRAME)}) — Other_21's two con-0`
        + ' frames then timer 3 % at_delay 3');

      okO(oSw.every((s) => s.xscale === 1.25 && s.yscale === 1.25 && s.speed === 0)
        && sSw.every((s) => s.xscale === 1.25 && s.yscale === 1.25 && s.speed === 0),
        `${label}: every carousel sword is 1.25 x 1.25 at speed 0`);
      okO(oSw.every((s) => s.angle === s.direction)
        && sSw.every((s) => s.angle === s.direction),
        `${label}: image_angle tracks direction on every sword`);
      okO(oSw.every((s) => s.direction >= 176 && s.direction <= 184)
        && sSw.every((s) => s.direction >= 176 && s.direction <= 184),
        `${label}: every sword's direction is inside random_range(176, 184)`
        + ` (recorded span ${Math.min(...oSw.map((s) => s.direction)).toFixed(4)}`
        + `..${Math.max(...oSw.map((s) => s.direction)).toFixed(4)})`);

      // ONE x FOR ALL EIGHTEEN, and it is the same number on both sides.
      // Every sword is first seen at ang = 90 + at_spin, so the carousel maths
      // (_knightX + lengthdir_x(24, ang), then the round(_knightY - y)/8 lean)
      // lands them all on one column. Neither side's value has any RNG in it.
      const oX = [...new Set(oSw.map((s) => s.xs))];
      const sX = [...new Set(sSw.map((s) => s.xs))];
      okO(oX.length === 1 && sX.length === 1 && oX[0] === sX[0],
        `${label}: all 18 swords share ONE x, and it is the SAME ten-decimal`
        + ` value on both sides — oracle ${oX.join('|')}, sim ${sX.join('|')}`);

      // …and the y, which depends on the Knight's own bobbing height, is
      // reproduced ROW-EXACT by re-running the sim with the slasher placed
      // where the RECORDING put it. This is the sim's geometry predicting the
      // mod's number from the mod's own input.
      const rerun = runVc(row, { frames: 80, clock: 77, ownerAt: { x: oMg.x, y: oMg.y } });
      const rSw = rerun.by.get('obj_regularbullet') ?? [];
      const rY = [...new Set(rSw.map((s) => s.ys))];
      const oY = [...new Set(oSw.map((s) => s.ys))];
      okO(rSw.length === 18 && rY.length === 1 && oY.length === 1 && rY[0] === oY[0],
        `${label}: with the slasher placed at the recording's own (${oMg.x}, ${oMg.ys}),`
        + ` the sim puts all 18 swords at y ${rY.join('|')} — the recording says`
        + ` ${oY.join('|')}`);
    }

    // A CONTROL, so "18 every 3 frames" is a branch and not a constant: the
    // mod's own B-Side arm is at_num 34 / at_delay 1 (Other_21 lines 22-30).
    const sb = runVc(row, { frames: 200, sideb: true, clock: 77 });
    const sbSw = sb.by.get('obj_regularbullet') ?? [];
    const sbShape = frameShape(sbSw);
    ok(sbSw.length === 34 && JSON.stringify(sbShape.gaps) === JSON.stringify({ 1: 33 }),
      `control: the same row on the B-Side gives ${sbSw.length} swords one frame`
      + ` apart (at_num 34 / at_delay 1) — the 18 x 3 above is a live branch`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n── POSITIVE EXECUTION ──');
  ok(oracleComparisons >= 25,
    `${oracleComparisons} comparisons actually ran against the recording`
    + ' (a run that reports zero here has proved nothing)');

  console.log(`\n${checks - failures}/${checks} checks passed`
    + `   (${oracleComparisons} of them against the real mod)`);
  if (failures) {
    console.log('  Claimed: object set, per-type counts, structural spawn geometry and');
    console.log('  cadence for ac 107 and ac 110. NOT claimed: absolute frames, RNG');
    console.log('  values, damage/HP/TP, or obj_afterimage.');
    return 1;
  }
  console.log('  (object set, per-type counts, structural spawn geometry and cadence for');
  console.log('   ac 107 + ac 110 — NOT absolute frames, NOT RNG values, NOT damage/HP,');
  console.log('   NOT obj_afterimage, and NOTHING about any other entry.)');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
