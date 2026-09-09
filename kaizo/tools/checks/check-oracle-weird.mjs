#!/usr/bin/env node
// ORACLE DIFF — THE UNDERBOX / WEIRD-CIRCLE FAMILY, held against the real mod.
//
//   node kaizo/tools/checks/check-oracle-weird.mjs [seq.csv] [trace.csv]
//
// BOTH ROUTES. With no arguments this compares the longest recording of EACH
// route it can find — the ordinary chain and the B-Side — and the route is
// MEASURED off each recording with the shared detectRoute(), never assumed.
// That matters for this family specifically: atk_RisingAbyssB is one of the
// three entries the two tables disagree on (ac 3 versus ac 101), and ac 101 is
// a different underbox — the ring's centre drops 92 instead of 32 and the arm
// chains a sword tunnel behind it. Reading a B-Side capture against VC_TABLE
// would have compared the sim's ac-3 ring against the mod's ac-101 one and
// reported the mod's own delta as a divergence.
//
// V-C recreation of EnderCat8's "Kaizo Roaring Knight" v2.3.3 — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate). This file reads a
// recording made by knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1 and
// compares what FOUR schedule entries actually spawned against what the sim's
// V-C launcher spawns for the same rows:
//
//   atk_RisingAbyssB  ac 3   d0 p1   arm: type 106 (underbox), damage 87
//   atk_Frenzy1       ac 7   d0 p1   arm: type 105 (combination 4-2-3)
//   atk_Frenzy2B      ac 102 d0 p2   arm: type 106 + type 108, damage 103
//   atk_Frenzy3       ac 106 d0 p3   arm: type 105 (combination 1-2-5)
//
// It is the per-attack rung above check-oracle-schedule, which verifies that
// the fight SELECTS the right things and raises the right board and says
// nothing about what happens on that board.
//
// ── WHAT IS CLAIMED ───────────────────────────────────────────────────────
//
// Only quantities that survive the two things that genuinely differ between a
// recording and a sim run — the turn's LENGTH (the recorder drives the party
// with a pulsed confirm; the sim uses its own driver) and the RNG STREAM
// (CLAIMED as "mechanics one-to-one, RNG re-anchored per launch"; the streams
// are deliberately not aligned across a fight). So:
//
//   * the SET of object types each entry creates, and which of them are
//     structurally counted (one manager, five orbs, 7 fan bullets per big
//     shot)
//   * SPAWN GEOMETRY that is not drawn from RNG: the five orbs' x and y, to
//     ten decimals, exact string equality through sim/trace.js's real() —
//     the same formatting rule the recorder's string_format(v, 0, 10) uses;
//     the big shot's fixed angle/scales/direction/speed; the fan's seven
//     fixed directions and its 5-at-4 / 2-at-6 speed split
//   * GROUPING and CADENCE: the orbs all appear on ONE frame; a volley is one
//     obj_knight_weird_circle_bullet and exactly seven obj_regularbullet on
//     the SAME frame; consecutive volleys are `delay + 2 * irandom(3)` apart,
//     so every gap sits in a four-value support
//   * RELATIVE intervals inside one turn (orb-appearance -> first volley;
//     last volley vs last falling sword) — never an absolute frame number
//   * whether the turn was ENDED BY THE ATTACK rather than by the clock
//     running out, which is what vcTurnLength's 999999 encodes
//
// ── WHAT IS NOT CLAIMED ───────────────────────────────────────────────────
//
// Absolute frame numbers. Total volley counts (the manager fires until its
// private local_turntimer runs down, and the jitter is RNG). Damage, HP, TP,
// targeting — the recorder pins party and boss HP, so every survival-shaped
// number in the recording is a harness artifact. Anything about the
// afterimage trail: obj_afterimage is created on `global.time % 4 == 0` for
// as long as the attack lives, so its count is a pure function of turn length
// and is excluded by name, not by tolerance.
//
// And nothing about an object this particular recording does not watch. The
// recorder resolves a hardcoded object list that has grown between runs, so
// every count-or-absence claim below is gated on the object appearing
// somewhere in the file (see watchedObjects). Against the older `_schedule`
// recording that silently drops the fan volleys and the sword rain and says
// so; against `_deep` everything runs.
//
// ── HOW THE MOD BUILDS THIS ATTACK (measured, then read back in the dump) ──
//
// obj_dbulletcontroller Step_0 `type == 106` pins global.turntimer = 999999,
// forces the board back to 2x2, and creates obj_knight_weird_bottom_manager at
// the Knight's position; its Other_10 ("full") sets local_turntimer = 340 and
// x += 200. alarm[0] = 16 seeds FIVE obj_knight_weird_circle on one frame at
// angles 72*i; the manager's Step parks them on an ellipse centred on
// (scr_get_box(4), scr_get_box(3) + 43) with radii 120 and 30 — plus 32 for
// ac 102, plus 92 for ac 101. Each manager Alarm_1 lights the front orb with a
// fuse of `delay` (18, or 29 for ac 102 / 27 on the B-Side) and re-arms itself
// at `delay + 2 * irandom(3)`. The orb's Alarm_1 fires one
// obj_knight_weird_circle_bullet straight up (direction 90, speed 6, gravity
// 0.2 along its own heading, image_yscale 3 -> 2 and image_xscale 0 -> 2 over
// 12) and then two diamond fans of obj_regularbullet: five at
// 27.5 + 31.25*a, speed 4, and — with a == 1 and a == 2 skipped — two at
// 40 + 33.333...*a, speed 6.
//
// ── THE TURN CLOCK, AND THE ONE OPEN QUESTION IN THE LEDGER ───────────────
//
// ORACLE-GROUND-TRUTH.md leaves open whether vcTurnLength's 999999 for ac 102
// is the right model. Measured here, from the trace's turntimer column:
//
//   entry             f0    f+1        released   value just before release
//   RisingAbyssB      239   999999     f+313      999661.33
//   Frenzy1           269   999999     f+224      999767.93
//   Frenzy2B          269   600        f+259      336.20
//   Frenzy3           479   999999     f+201      999791.70
//
// All four turns are ENDED BY AN ATTACK OBJECT — the clock is slammed to -1
// with a large positive value still on it, never drained to zero. That is
// exactly what 999999 encodes, and it is asserted below. What 999999 does NOT
// encode is ac 102's actual reading: type 108's block assigns
// global.turntimer = 600 (Step_0:2283) and it runs AFTER type 106's 999999,
// because Other_23 calls scr_bulletspawner twice and the two controllers take
// their first Step in creation order. So for ac 102 the model is
// behaviourally right and numerically wrong, and that is reported as a NOTE
// with the exact launcher edit rather than asserted across — 999999 and 600
// are answers to two different questions.
//
// ── WHAT THIS FILE HAS ALREADY FORCED ─────────────────────────────────────
//
// Three divergences it reported have been fixed at their root. Each is named
// at the assertion that caught it, so none can be tidied back in:
//
//   * `with (obj_knight_swordfall) turn_time = 40` at the end of Other_23's
//     ac-102 arm iterates an EMPTY SET (the swordfall is created by the
//     type-108 controller's Step one frame after the launch — turn f6559,
//     swordfall f6560). The launcher applied it synchronously, which inverted
//     the ring and the rain. Now INERT and labelled ORIGINAL BUG; the rain
//     matches the recording's size on both routes (23/12 and 29/15).
//   * scr_get_box(3) reads `sprite_height`, a BUILT-IN, so it narrows to f32.
//     Computing it in f64 flipped one ac-102 orb's y by a single ULP.
//   * the approx LEDGER could not see a vanilla substitution at all — it only
//     ever recorded a difficulty clamp — so a row running a completely
//     different attack from the mod's reported itself as fully dispatched.
//     kaizo-mod-launcher.js's VANILLA_BODIES now ledgers the body regardless of
//     difficulty, and two assertions below check it.
//
// ── WHAT IS STILL RED, AND WHY IT IS LEFT THAT WAY ────────────────────────
//
//   * orbs -> first volley is ONE frame short, on every row of both routes.
//     Root-caused to sim/entity.js's alarm ordering, not to this attack — see
//     the verdict block. Fixing it changes the alarm phase for the whole tree.
//   * ~~the combination's segments 2 and 3 are the VANILLA modules, so the
//     mod's fanned segment-3 bullets (17 and 23 distinct directions) arrive as
//     one direction, and the B-Side's segment-2 circle spacing is 36 against
//     the mod's 33.~~ **CLOSED 2026-08-29.** Both were the same root: the
//     segments resolved to sim/ bodies. The sim tunnel slasher writes
//     `vspeed` to a plain JS property that nothing reads back, so every blade
//     keeps its `scr_fire_bullet(..., 180, 0.5)` heading, and the sim rotating
//     slash has no B-Side `slash_base` cap, so its aim cycle runs 36 frames
//     where the mod's runs 33. kaizo/attacks/sword-tunnel-revised.js and
//     kaizo/attacks/rotating-slash.js already carry both fixes; what was
//     missing was routing. The comparisons are unchanged and now agree —
//     route C sim 11 distinct directions against the mod's 17, route D 15
//     against 23, and both circle gaps exact.
//
// ── WHAT IS STILL PENDING ELSEWHERE, AND VISIBLE FROM HERE ────────────────
//
// The routing had TWO legs and only one of them is still a stand-in. LEG 2 —
// which module each SEGMENT resolves to — is now the real per-state seam
// (`state.kaizo.hooks.comboChainNext`), installed by runSim on the scene it
// builds itself, exactly as check-rotating-slash installs `vortexendHandoff`
// on its own. The process-local `registerComboAttack` writes for segments 2
// and 3 are GONE. LEG 1 — the launcher's `case 105:` — is still the vanilla
// `launchCombination`, so one narrow stand-in remains, and it is PROBED
// rather than assumed: the block below drives the shipped launcher first and
// installs nothing if the edit has landed. The verdict prints which.

import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createState, stepFrame } from '../../../sim/index.js';
import { destroy } from '../../../sim/entity.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { ensureSoul } from './scaffold-soul.mjs';
import { real } from '../../../sim/trace.js';
import { VC_TABLE, VD_TABLE } from '../../versions/vc-script.js';
import { launchVCAttack, openVCArena, vcTurnLength, vcSelfEnding } from '../../scenes/kaizo-mod-launcher.js';
// The trace plumbing is REUSED, not re-implemented: resolveTraces() carries
// the two documented recording directories and the reason the list is a list,
// recoverLaunches() carries the kaizo_playing attribution rule (trap #1 in
// the ledger), and detectRoute() carries the three-discriminator rule and its
// refusal to guess. A private copy here would be a second place for those to
// drift.
import {
  resolveTraces, readTrace, recoverLaunches, detectRoute,
} from './check-oracle-schedule.mjs';

// The three kaizo segment modules the 4-2-3 chain resolves, imported so the
// routing probe below can name them and so the assertions can test the walked
// segments BY IDENTITY. The sim and kaizo copies share a `type.name`, which is
// exactly why a name test would not be evidence.
import { registerComboAttack, COMBO_ATTACKS } from '../../../sim/attacks/combination.js';
import { rotatingSlash as KAIZO_ROTATING } from '../../attacks/rotating-slash.js';
import { tunnelSlasher2 as KAIZO_TUNNEL } from '../../attacks/sword-tunnel-revised.js';
import { knightSwordfall as KAIZO_SWORDFALL } from '../../attacks/swordfall.js';
// The kaizo combination itself: `kaizoChainNext` is what the seam routes to,
// and `KAIZO_COMBO_ATTACKS` is the table it resolves from.
import { KAIZO_COMBO_ATTACKS, kaizoChainNext } from '../../attacks/combination.js';

// ==========================================================================
// THE ROUTING, IN TWO LEGS - ONE REAL, ONE PROBED STAND-IN
// ==========================================================================
//
// WHAT WAS WRONG, and it took two mechanisms to fix because it was two
// defects. The combination's segments resolved through `chainNext` in
// sim/attacks/combination.js, which reads that module's own `COMBO_ATTACKS`
// registry - and only sim/ modules ever call `registerComboAttack`, because
// kaizo/HANDOFF.md §2.1 forbids the kaizo copies from writing a shared global
// (check-combination's T9 asserts that by identity). So kaizo/attacks/
// combination.js's five-for-five `KAIZO_COMBO_ATTACKS` was READ BY NOTHING:
//
//     f0    obj_knight_swordfall                -> KAIZO   (its own table)
//     f35   obj_knight_rotating_slash           -> SIM
//     f105  obj_knight_tunnel_slasher_2_revised -> SIM
//
// LEG 2 - CLOSED, AND NOT A STAND-IN ANY MORE. `chainNext` now takes an
// optional HANDOFF SITE NAME, and when one is given AND
// `state.kaizo.hooks.comboChainNext` is set it forwards the whole handoff to
// `kaizoChainNext`. Every kaizo segment module passes its own site name
// (swordfall Alarm_3 -> swordfall_alarm3, rotating slash Alarm_2 ->
// rotating_alarm2, revised tunnel -> tunnel_alarm2 / tunnel_step), and every
// call inside sim/ passes two arguments and is therefore never redirected.
// runSim() below sets the hook on the scene IT BUILDS, which is the same thing
// check-rotating-slash does with `vortexendHandoff` - the state is this file's,
// so this is wiring, not a substitution. The three process-local
// `registerComboAttack` writes this block used to make are GONE.
//
// LEG 1 - STILL PENDING, STILL STOOD IN FOR, BUT PROBED FIRST.
// kaizo/scenes/kaizo-mod-launcher.js `case 105:` still returns
// `launchCombination(state)`: the vanilla module, with its module-level 4-2-3
// order, so `launchKaizoCombination` is unreached in a shipped build and the
// launcher ledgers the vanilla body. `probeLeg1()` DRIVES the shipped launcher
// on a scratch scene and asks whether it produced a kaizo first segment;
// nothing is installed if the edit has landed. When it has not, exactly ONE
// registry write stands in - segment 4, the only id the vanilla launcher's
// fixed order uses as its FIRST segment. Segments 2 and 3 arrive through the
// hook, so registering them would now be a write no assertion could see, the
// "a green suite does not mean a change took effect" failure CLAUDE.md records
// twice.
//
// THE ORDER IS NOT STOOD IN FOR. The vanilla launcher walks 4-2-3 whatever the
// arm asks, so atk_Frenzy3 (ac 106, 1-2-5) still walks the wrong chain here
// and the assertions for that row say so - gated on the probe rather than
// hardcoded, so they flip to the shipped claim the moment leg 1 lands.

const KAIZO_SEGMENT_NAMES = new Set([
  'obj_roaringknight_quickslash_attack', 'obj_knight_rotating_slash',
  'obj_knight_tunnel_slasher_2_revised', 'obj_knight_swordfall',
  'obj_knight_weird_bottom_manager',
]);
const KAIZO_SEGMENT_TYPES = new Set(
  Object.values(KAIZO_COMBO_ATTACKS).map((e) => e.type),
);

/**
 * Has kaizo-mod-launcher.js's `case 105:` been pointed at the kaizo
 * combination? MEASURED by driving it, never read off a comment.
 *
 * `state.kaizoComboOrder` is written by `launchKaizoCombination` and by
 * nothing else in the tree, so its presence after a type-105 dispatch is the
 * discriminator. The scratch state is thrown away: its RNG, its ledger and its
 * entities all die with it, so the probe cannot perturb anything it measures.
 */
function probeLeg1() {
  const rows = new Map();
  for (const phase of Object.keys(VC_TABLE)) {
    for (const r of VC_TABLE[phase]) rows.set(r.id, r);
  }
  const row = rows.get('atk_Frenzy1');
  if (!row) return { shipped: false, threw: 'atk_Frenzy1 missing from VC_TABLE' };
  const state = createState({ seed: 1, traceBulletSlots: 0 });
  buildSingleAttackScene(state, { seed: 1, attack: 'underbox', difficulty: 0 });
  ensureSoul(state); // the drill no longer spawns the soul at build (scaffold-soul.mjs)
  const dir = state.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  state.kaizo = {
    version: 'C', sideb: false, approx: [], launched: [], vars: {}, hooks: {},
  };
  state.keepAlive = true;
  openVCArena(state, row, { sideb: false });
  for (let i = 0; i < 12; i++) stepFrame(state, {});
  let threw = null;
  try {
    launchVCAttack(state, row, { sideb: false });
  } catch (err) {
    threw = String(err && err.message);
  }
  const first = state.entities.find(
    (e) => e.alive && KAIZO_SEGMENT_NAMES.has(e.type.name),
  );
  return {
    shipped: state.kaizoComboOrder !== undefined,
    firstIsKaizo: !!first && KAIZO_SEGMENT_TYPES.has(first.type),
    ledgeredBody: state.kaizo.approx.some(
      (a) => a.type === 105 && String(a.asked) === 'type 105 body',
    ),
    threw,
  };
}

/** The receipt. The verdict asserts on it, so "the segments were kaizo" is
 *  never confused with "the install silently did nothing". */
const ROUTED = { leg1: probeLeg1(), installed: [], already: [] };
for (const [id, type] of [[4, KAIZO_SWORDFALL]]) {
  if (ROUTED.leg1.shipped || COMBO_ATTACKS[id].type === type) ROUTED.already.push(id);
  else { registerComboAttack(id, type); ROUTED.installed.push(id); }
}

/**
 * Every handoff site the hook was actually asked for, across every run in this
 * process. POSITIVE EXECUTION for leg 2: without it, "the segments were kaizo"
 * and "the seam never fired and the registry happened to hold kaizo types"
 * print the same line - and one of those is the bug this file spent a round
 * failing to see.
 */
const HOOKED = [];

// ── the family ─────────────────────────────────────────────────────────────

const FAMILY = ['atk_RisingAbyssB', 'atk_Frenzy1', 'atk_Frenzy2B', 'atk_Frenzy3'];

/** The two rows whose arm dispatches controller type 106 directly. */
const UNDERBOX_ROWS = ['atk_RisingAbyssB', 'atk_Frenzy2B'];

/**
 * Object names that are NOT comparable and are dropped by NAME before any set
 * or count is taken. Each has a stated reason; none is a tolerance.
 *
 *   afterimage*      the Knight's rainbow trail (`rgbafterimages = 1`
 *                    unconditionally in this mod). Created on
 *                    `global.time % 4 == 0` for as long as the attack lives,
 *                    so the count measures TURN LENGTH and nothing else.
 *   obj_lerpvar      the sim's reification of scr_lerpvar; the GML tween is an
 *                    instance too, but the recorder does not watch it.
 *   obj_shake        screen shake, same.
 *   actor_party /
 *   obj_knight_enemy /
 *   obj_growtangle /
 *   obj_heart        scene furniture that exists before the launch.
 */
const NOT_COMPARABLE = new Set([
  'obj_afterimage', 'obj_afterimage_blend', 'obj_afterimage_grow',
  'obj_afterimage_screen', 'obj_lerpvar', 'obj_shake', 'actor_party',
  'obj_knight_enemy', 'obj_growtangle', 'obj_heart', 'obj_particle_generic',
]);

/**
 * The sim gives the underbox fan bullets their own type so the module can
 * carry the mod's damage 103 (weird_circle Alarm_1 lines 26/40, halved from
 * vanilla's 206). In the GML they ARE obj_regularbullet —
 * `scr_fire_bullet(x, y, obj_regularbullet, ...)` — so the recording logs them
 * under that name and the two must be identified before any set is compared.
 * This is a NAMING bridge, not a loosened comparison: the arity, the seven
 * directions and the two speeds are all still asserted below.
 */
const SIM_TO_MOD_NAME = new Map([['obj_knight_weird_fan', 'obj_regularbullet']]);

/**
 * Dropped from the object-SET comparison only — still counted, still printed
 * in the ledger above, so the number is never invisible.
 *
 * `obj_marker` is DELTARUNE's generic one-shot sprite stamp (scr_marker /
 * scr_dark_marker / scr_marker_blend / scr_board_flash …), used all over the
 * game; ORACLE-GROUND-TRUTH.md excludes it from its gameplay-object counts for
 * exactly that reason, alongside obj_afterimage. It earns the exclusion HERE
 * on a positive result rather than on that precedent: a grep of the mod's own
 * dump finds NO marker creation site in any object of this family —
 * obj_knight_weird_bottom_manager, obj_knight_weird_circle,
 * obj_knight_weird_circle_bullet, obj_knight_swordfall, obj_fallingsword —
 * so every marker in these turns is another system's stamp landing during
 * them. The ordinary route's underbox turns log none at all and the B-Side's
 * log 303 / 126 / 58, which is the shape of a draw-side difference, not of an
 * attack throwing something extra.
 *
 * NOT dropped from the ledger print, and NOT dropped anywhere else: the
 * splitter's cut-face flames really are obj_marker and really are gameplay
 * geometry (check-oracle-splitter's business, not this file's).
 */
const SET_EXCLUDED = new Set(['obj_marker']);

// ── assertion bookkeeping ──────────────────────────────────────────────────

let checks = 0;
let failures = 0;
const notes = [];
const failed = [];

/**
 * Which route the assertions currently running belong to. Two recordings are
 * compared in one run and their entries share ids, so a bare failure line
 * would not say WHICH fight it came from — and the two routes dispatch
 * atk_RisingAbyssB as different attacks entirely.
 */
let TAG = 'C';

function ok(cond, msg) {
  checks += 1;
  if (cond) return true;
  failures += 1;
  failed.push(`[route ${TAG}] ${msg}`);
  return false;
}

function note(msg) {
  notes.push(`[route ${TAG}] ${msg}`);
}

// POSITIVE EXECUTION FLAGS. An assertion count alone cannot tell "the orb
// geometry agreed" from "the orb-geometry block was skipped and the count came
// from somewhere else", which is the failure mode CLAUDE.md's "Positive
// execution assertions" section exists for. Each block that carries a real
// claim raises its flag, and the verdict asserts on them.
let ranSet = false;
let ranOrbGeometry = false;
let ranCadence = false;
let ranClock = false;

/**
 * Every (mod lead − sim lead) measured for the orbs -> first volley chain.
 * Collected because the SHAPE of the shortfall is the diagnosis: a modelling
 * error in this attack would drift with the cadence, and a structural one
 * would not. See the verdict.
 */
const leadDeltas = [];

/** Exact string equality on a number, through the project's trace formatter. */
const r10 = (v) => real(v);

const sortedStr = (xs) => xs.map(r10).sort().join(' ');

/** consecutive differences of a sorted frame list */
const gaps = (fs) => fs.slice(1).map((v, i) => v - fs[i]);

// ── the recording ──────────────────────────────────────────────────────────

/**
 * The SEQ file that belongs to a given trace file. The recorder writes them as
 * a pair with the same tag (`kaizo_oracle_trace_deep.csv` /
 * `kaizo_oracle_seq_deep.csv`, and the older tagless `..._tracefix1` /
 * `..._seqfix1`), so the name is derived rather than guessed at.
 */
function seqFor(dir, tracePath) {
  const b = basename(tracePath).replace('trace', 'seq');
  const p = join(dir, b);
  return existsSync(p) ? p : null;
}

/** Parse the spawn log into { col, rows } — same shape readTrace returns. */
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
 * One entry's spawn ledger out of the seq log.
 *
 * GROUPED BY kaizo_playing, never kaizo_atk. kaizo_atk is the pointer to the
 * NEXT entry and it transitions ON the launch frame, so grouping by it
 * attributes every spawn to the following turn. This is trap #1 in
 * ORACLE-GROUND-TRUTH.md and it costs a whole run of false divergences.
 */
function oracleLedger(seq, entry) {
  const { col } = seq;
  const rows = seq.rows.filter((r) => r[col.kaizo_playing] === entry);
  if (!rows.length) return null;
  const f0 = Number(rows[0][col.frame]);
  const byObj = new Map();
  for (const r of rows) {
    const name = r[col.object];
    if (NOT_COMPARABLE.has(name)) continue;
    if (!byObj.has(name)) byObj.set(name, []);
    byObj.get(name).push({
      frame: Number(r[col.frame]),
      x: Number(r[col.x]),
      y: Number(r[col.y]),
      angle: Number(r[col.angle]),
      xscale: Number(r[col.xscale]),
      yscale: Number(r[col.yscale]),
      direction: Number(r[col.direction]),
      speed: Number(r[col.speed]),
      // The recorder prints ten decimals; keep the TEXT so equality can be
      // exact rather than a float compare (CLAUDE.md, "Trace format").
      xs: r[col.x],
      ys: r[col.y],
    });
  }
  return { entry, firstRow: f0, byObj, total: rows.length };
}

// ── the sim ────────────────────────────────────────────────────────────────

/**
 * The schedule row for an id, ON THE ROUTE BEING COMPARED.
 *
 * THE TWO TABLES ARE NOT INTERCHANGEABLE FOR THIS FAMILY. They carry the same
 * 31 ids in the same order and differ in three rows, and one of the three is
 * ours: `atk_RisingAbyssB` dispatches ac 3 on the ordinary route and ac 101 on
 * the B-Side. ac 101 is a different underbox — the manager's Step drops the
 * ring's centre by 92 instead of 32, and the arm chains a type-153 sword
 * tunnel behind it — so reading a B-Side recording against VC_TABLE would
 * compare the sim's ac-3 ring against the mod's ac-101 one and report the
 * offset as a divergence. Route detection is therefore MEASURED per recording
 * (detectRoute, shared with check-oracle-schedule), never assumed.
 */
const tableFor = (sideb) => {
  const m = new Map();
  const t = sideb ? VD_TABLE : VC_TABLE;
  for (const phase of Object.keys(t)) for (const row of t[phase]) m.set(row.id, row);
  return m;
};

/**
 * Drive the V-C launcher for one schedule row and record every spawn.
 *
 * The board is opened and then stepped for TWELVE frames before the launch,
 * because that is the mod's own gap: obj_growtangle is raised under
 * mnfight == 1.5 and the attack spawns under mnfight == 2, twelve frames
 * later at `rtimer == 12` (CLAUDE.md, "The turn's real buffers"). The underbox
 * reads the board's settled height every step — center_y is
 * scr_get_box(3) + 43 — so launching against a board still growing in would
 * measure the grow-in rather than the attack.
 */
function runSim(row, { seed = 20260810, frames = 600, sideb = false } = {}) {
  const state = createState({ seed, traceBulletSlots: 0 });
  buildSingleAttackScene(state, { seed, attack: 'underbox', difficulty: 0 });
  ensureSoul(state); // the drill no longer spawns the soul at build (scaffold-soul.mjs)
  const dir = state.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  state.kaizo = {
    version: sideb ? 'D' : 'C', sideb, approx: [], launched: [], vars: {}, hooks: {},
  };
  // LEG 2, the real seam. This scene is this file's, so setting its hooks is
  // wiring rather than a substitution — check-rotating-slash installs
  // `vortexendHandoff` on its own scenes the same way. A shipped build gets it
  // from the launcher's `case 105:` (see the routing block above).
  //
  // The wrapper is the RECEIPT: it records which handoff site each hop asked
  // for, so the verdict can assert that the seam FIRED rather than inferring
  // it from the segment types, which the registry could also explain.
  state.kaizo.hooks.comboChainNext = (st, self, siteName) => {
    HOOKED.push(siteName);
    return kaizoChainNext(st, self, siteName);
  };
  state.keepAlive = true; // the party stands back up; the run never stalls on a wipe

  openVCArena(state, row, { sideb });
  for (let i = 0; i < 12; i++) stepFrame(state, {});
  launchVCAttack(state, row, { sideb });

  const seen = new Set();
  const byObj = new Map();
  // Every TYPE OBJECT this run created, kept because the sim and kaizo copies
  // of a segment share a `type.name` — so "which module ran" is a question
  // only identity can answer, and `state.entities` has forgotten the
  // destroyed ones by the time the assertions read it.
  const typesSeen = new Set();
  let clockAfterLaunch = state.turntimer;
  let releaseFrame = -1;
  for (let f = 0; f < frames; f++) {
    stepFrame(state, {});
    for (const e of state.entities) {
      if (!e.alive || seen.has(e)) continue;
      seen.add(e);
      typesSeen.add(e.type);
      const name = SIM_TO_MOD_NAME.get(e.type.name) ?? e.type.name;
      if (NOT_COMPARABLE.has(name)) continue;
      if (!byObj.has(name)) byObj.set(name, []);
      byObj.get(name).push({
        frame: f,
        x: e.x,
        y: e.y,
        angle: e.image_angle,
        xscale: e.image_xscale,
        yscale: e.image_yscale,
        direction: e.direction,
        speed: e.speed,
      });
    }
    if (releaseFrame < 0 && state.turntimer <= 0) releaseFrame = f;
    // The driver's clock tick. The pinned 999999 is left alone — a real turn
    // under a pinner ends when the ATTACK hands the clock back, which is the
    // behaviour under test, not when this loop counts it down.
    if (state.turntimer > 0 && state.turntimer < 900000) state.turntimer -= 1;
  }
  return {
    state, byObj, typesSeen, clockAfterLaunch, releaseFrame, approx: state.kaizo.approx,
  };
}

const count = (led, name) => (led.byObj.get(name) ?? []).length;
const framesOf = (led, name) => (led.byObj.get(name) ?? []).map((s) => s.frame);
const firstFrame = (led, name) => {
  const fs = framesOf(led, name);
  return fs.length ? Math.min(...fs) : null;
};
const lastFrame = (led, name) => {
  const fs = framesOf(led, name);
  return fs.length ? Math.max(...fs) : null;
};

/**
 * A NEGATIVE RESULT IS ONLY EVIDENCE IF THE INSTRUMENT COULD HAVE PRODUCED A
 * POSITIVE ONE. The recorder resolves a HARDCODED list of object names, and
 * that list has grown: the `_schedule` run watched neither obj_regularbullet
 * nor obj_fallingsword, so this family's fan volleys and sword rain are simply
 * absent from it — 1,139 spawn rows against `_deep`'s 17,542. Reading those
 * absences as "the mod fired no fans" is the exact mistake
 * ORACLE-GROUND-TRUTH.md records under "A BLANK ROW MEANT THE RECORDER WAS NOT
 * WATCHING", where two attacks looked empty and were not.
 *
 * So: every claim about an object's COUNT or ABSENCE is gated on that object
 * appearing SOMEWHERE in this recording. Object types the file never mentions
 * are outside what it can testify to, and are reported as such rather than
 * compared.
 */
function watchedObjects(seq) {
  const s = new Set();
  for (const r of seq.rows) s.add(r[seq.col.object]);
  return s;
}
let WATCHED = new Set();
const isWatched = (name) => WATCHED.has(name);

// ══════════════════════════════════════════════════════════════════════════
// one recording, one route
// ══════════════════════════════════════════════════════════════════════════

/**
 * Hold ONE recording against the sim, driven on the route that recording was
 * measured to be walking.
 *
 * `sideb` is not a parameter the operator supplies: main() reads it off the
 * recording with the shared detectRoute(), so a B-Side capture is compared
 * against the B-Side arm and geometry or not compared at all.
 */
function compareRecording({ seqPath, tracePath, seq, sideb, tag }) {
  const rowById = tableFor(sideb);
  TAG = tag;
  WATCHED = watchedObjects(seq);
  console.log(`\n${'═'.repeat(74)}`);
  console.log(`ROUTE ${tag} — ${seqPath}`);
  console.log(`  ${seq.rows.length} spawn rows, ${WATCHED.size} distinct object types watched`);
  const blind = ['obj_regularbullet', 'obj_fallingsword', 'obj_knight_weird_circle_bullet',
    'obj_knight_weird_circle', 'obj_knight_weird_bottom_manager',
    'obj_knight_diamondswordbullet_ext'].filter((n) => !isWatched(n));
  if (blind.length) {
    console.log('  NOTE: this recording never logs '
      + `${blind.join(', ')} — the recorder's object list did not include`);
    console.log('        them, so every claim about their count or absence is SKIPPED below.');
    console.log('        (ORACLE-GROUND-TRUTH.md: "a blank row meant the recorder was not watching".)');
  }

  const oracle = new Map();
  for (const id of FAMILY) {
    const led = oracleLedger(seq, id);
    if (led) oracle.set(id, led);
  }
  if (oracle.size === 0) {
    // Degenerate for THIS family, which is a different thing from a broken
    // recording — a MODE 1 lock on some other entry is a perfectly good
    // recording that simply contains none of these four.
    console.log('  SKIP — this recording contains none of the underbox/weird family:');
    console.log(`         ${FAMILY.join(', ')}`);
    console.log('         Record a MODE 0 chain (or a lock on one of these) to diff them.');
    return;
  }
  console.log(`  ${oracle.size} of ${FAMILY.length} family entries present:`
    + ` ${[...oracle.keys()].join(', ')}`);

  // ── THE ORACLE LEDGER, printed whether or not anything passes ────────────
  // This is the ground truth about the mod that this file exists to record,
  // and it belongs in the log even on a failing run.
  console.log('\n  ── the spawn ledger the real mod produced ──');
  for (const [id, led] of oracle) {
    console.log(`  ${id}  (${led.total} spawn rows from f${led.firstRow})`);
    const sorted = [...led.byObj.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [name, list] of sorted) {
      const fs = [...new Set(list.map((s) => s.frame))].sort((a, b) => a - b);
      const g = [...new Set(gaps(fs))].sort((a, b) => a - b);
      console.log(`      ${name.padEnd(38)} x${String(list.length).padStart(3)}`
        + `  rel +${fs[0] - led.firstRow}..+${fs[fs.length - 1] - led.firstRow}`
        + `  on ${fs.length} frame(s)${g.length ? `  gaps ${g.join(',')}` : ''}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1. THE TURN CLOCK — settling the ledger's open question
  // ══════════════════════════════════════════════════════════════════════
  //
  // Read from the TRACE, not the spawn log. Per entry: the dispatch floor at
  // the launch frame, the controller's write one frame later, and the frame
  // the clock is handed back.
  console.log('\n  ── the turn clock ──');
  if (tracePath && existsSync(tracePath)) {
    const t = readTrace(tracePath);
    const launches = recoverLaunches(t);
    const clocks = new Map();
    for (let i = 0; i < launches.length; i++) {
      const L = launches[i];
      if (!oracle.has(L.played) || clocks.has(L.played)) continue;
      // Walk this turn's rows to the release: the frame the clock stops
      // draining and drops to <= 0. `before` is what was still on it.
      const start = t.rows.findIndex((r) => Number(r[t.col.frame]) === L.frame);
      const end = i + 1 < launches.length
        ? t.rows.findIndex((r) => Number(r[t.col.frame]) === launches[i + 1].frame)
        : t.rows.length - 1;
      let releaseAt = -1;
      let before = null;
      for (let j = start + 1; j <= end; j++) {
        const v = Number(t.rows[j][t.col.turntimer]);
        if (v <= 0) { releaseAt = j - start; before = Number(t.rows[j - 1][t.col.turntimer]); break; }
      }
      clocks.set(L.played, { armed: L.turntimerArmed, after: L.turntimerAfter, releaseAt, before });
    }

    for (const [id, c] of clocks) {
      const row = rowById.get(id);
      const want = vcTurnLength(row, { sideb });
      console.log(`    ${id.padEnd(18)} f0 ${String(c.armed).padStart(7)}`
        + `  f+1..3 max ${String(c.after).padStart(7)}`
        + `  released f+${c.releaseAt} with ${c.before} still on it`
        + `   vcTurnLength ${want}`);

      // POSITIVE: the model says "self-ending", and the recording shows the
      // turn really was ended by an attack object rather than by the clock
      // draining. `before > 1` is the whole content of that claim: a turn that
      // ends because the clock ran out passes through 1.
      // The arm answers its FLOOR now (vcTurnLength); self-ending is the
      // property of spawning a PINNER type, whose controller pins 999999
      // on its own Step one frame later (the recording's f+1..3 column).
      ok(vcSelfEnding(row, { sideb }),
        `${id}: vcSelfEnding models this turn as self-ending (the arm floors ${want})`);
      ok(c.releaseAt > 0 && c.before !== null && c.before > 1,
        `${id}: the mod ENDED the turn from an attack object — clock slammed to`
        + ` ${c.before === null ? 'n/a' : '<=0'} at f+${c.releaseAt} with ${c.before} still on it`);
      ranClock = true;
    }

    // The NUMERIC half, which 999999 does not carry. Asserted where the model
    // and the recording answer the same question, NOTED where they do not.
    for (const [id, c] of clocks) {
      const row = rowById.get(id);
      const armsA108 = row.ac === 102; // the only family row whose arm chains type 108
      if (!armsA108) {
        ok(c.after === 999999,
          `${id}: the mod's own clock reads 999999 one frame in — the pinner set`
          + ` really does contain this arm's controller type (got ${c.after})`);
      } else {
        ok(c.after === 600,
          `${id}: the mod's clock reads 600 one frame in (dbulletcontroller`
          + ` Step_0:2283, type 108's assignment, running after type 106's 999999`
          + ` because Other_23 spawns two controllers and they Step in creation`
          + ` order) — got ${c.after}`);
        note(`${id}: vcTurnLength returns 999999 and the mod's global.turntimer reads`
          + ` ${c.after}. BEHAVIOURALLY RIGHT (the turn self-ends at f+${c.releaseAt},`
          + ` ${c.before} still unspent), NUMERICALLY WRONG. The launcher's PINNERS is a`
          + ' SET, so it cannot express "a later controller in the same arm overwrites'
          + ' the pin". See nextSteps for the ordered-clock-write edit.');
      }
    }
  } else {
    note('no trace CSV alongside the spawn log — the turn-clock block did not run');
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. THE UNDERBOX ROWS — ac 3 and ac 102, the two that dispatch type 106
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n  ── underbox rows (controller type 106) ──');
  for (const id of UNDERBOX_ROWS) {
    const led = oracle.get(id);
    if (!led) { note(`${id}: not in this recording — not compared`); continue; }
    const row = rowById.get(id);
    const sim = runSim(row, { sideb });
    console.log(`    ${id} (ac ${row.ac})`);

    // ── the object set, restricted to what this recorder can see ──────────
    const oracleSet = [...led.byObj.keys()].filter((n) => !SET_EXCLUDED.has(n)).sort();
    const simSet = [...sim.byObj.keys()]
      .filter((n) => isWatched(n) && !SET_EXCLUDED.has(n)).sort();
    const unwatched = [...sim.byObj.keys()].filter((n) => !isWatched(n)).sort();
    for (const n of SET_EXCLUDED) {
      if (count(led, n) || count(sim, n)) {
        note(`${id}: ${n} — mod ${count(led, n)}, sim ${count(sim, n)}. Outside the`
          + ' object-set comparison by name (see SET_EXCLUDED), counted here so the'
          + ' exclusion is visible rather than silent.');
      }
    }
    if (unwatched.length) {
      note(`${id}: the sim also creates ${unwatched.join(', ')}, which this recording`
        + ' never logs for any entry — outside what it can testify to.');
    }
    ok(oracleSet.join(',') === simSet.join(','),
      `${id}: object set — mod [${oracleSet.join(' ')}], sim [${simSet.join(' ')}]`);
    ranSet = true;

    // ── the manager and the ring ──────────────────────────────────────────
    ok(count(led, 'obj_knight_weird_bottom_manager') === 1
      && count(sim, 'obj_knight_weird_bottom_manager') === 1,
      `${id}: exactly one obj_knight_weird_bottom_manager (mod`
      + ` ${count(led, 'obj_knight_weird_bottom_manager')}, sim`
      + ` ${count(sim, 'obj_knight_weird_bottom_manager')})`);

    const oOrbs = led.byObj.get('obj_knight_weird_circle') ?? [];
    const sOrbs = sim.byObj.get('obj_knight_weird_circle') ?? [];
    ok(oOrbs.length === 5 && sOrbs.length === 5,
      `${id}: five orbs (mod ${oOrbs.length}, sim ${sOrbs.length})`);
    ok(new Set(oOrbs.map((s) => s.frame)).size === 1
      && new Set(sOrbs.map((s) => s.frame)).size === 1,
      `${id}: all five orbs appear on ONE frame — Alarm_0's repeat(6) seeds the`
      + ' whole ring in a single firing, not one orb per tick');

    // THE ELLIPSE, to ten decimals. The orbs are placed at
    // center + lengthdir(120, 72i + angle) / lengthdir(30, ...) with
    // center = (scr_get_box(4), scr_get_box(3) + 43 [+32 for ac 102]) and
    // `angle = spin * timer`, so this one comparison pins the board geometry,
    // the +32 offset, spin 2, the 16-frame seed alarm, the 120 radius and the
    // 0.25 vertical ratio at once. NO RNG anywhere in it — proved by ac 3 and
    // ac 106 landing on the same five values 7800 frames apart (block 4).
    ok(sortedStr(oOrbs.map((s) => s.x)) === sortedStr(sOrbs.map((s) => s.x)),
      `${id}: orb x, exact to ten decimals\n         mod ${sortedStr(oOrbs.map((s) => s.x))}\n         sim ${sortedStr(sOrbs.map((s) => s.x))}`);
    ok(sortedStr(oOrbs.map((s) => s.y)) === sortedStr(sOrbs.map((s) => s.y)),
      `${id}: orb y, exact to ten decimals\n         mod ${sortedStr(oOrbs.map((s) => s.y))}\n         sim ${sortedStr(sOrbs.map((s) => s.y))}`);
    ranOrbGeometry = true;

    // ── the volley: 1 big shot + 7 fan bullets on ONE frame ───────────────
    for (const [side, l] of [['mod', led], ['sim', sim]]) {
      const bigs = l.byObj.get('obj_knight_weird_circle_bullet') ?? [];
      ok(bigs.length > 0, `${id} [${side}]: the attack fired at least one volley (${bigs.length})`);
      if (!isWatched('obj_regularbullet')) continue; // see watchedObjects()
      const fans = l.byObj.get('obj_regularbullet') ?? [];
      ok(fans.length === bigs.length * 7,
        `${id} [${side}]: seven obj_regularbullet per obj_knight_weird_circle_bullet`
        + ` (${fans.length} vs ${bigs.length} x 7)`);
      const perFrame = new Map();
      for (const f of fans) perFrame.set(f.frame, (perFrame.get(f.frame) ?? 0) + 1);
      ok(bigs.every((b) => perFrame.get(b.frame) === 7),
        `${id} [${side}]: every volley lands its big shot and all seven fans on the SAME frame`);
    }

    // ── the big shot's fixed geometry ─────────────────────────────────────
    // direction 90 and speed 6 at creation, gravity 0.2 along its own heading
    // -> 6.2 by the frame it is first observed; image_yscale 3 and
    // image_xscale 0 with 12-frame lerps to 2 -> 2.9166.. / 0.1666.. one frame
    // in. Every one of these is a literal in weird_circle Alarm_1.
    for (const key of ['angle', 'xscale', 'yscale', 'direction', 'speed']) {
      const o = [...new Set((led.byObj.get('obj_knight_weird_circle_bullet') ?? []).map((s) => r10(s[key])))].sort();
      const s = [...new Set((sim.byObj.get('obj_knight_weird_circle_bullet') ?? []).map((x) => r10(x[key])))].sort();
      ok(o.length > 0 && o.join(' ') === s.join(' '),
        `${id}: big shot ${key} — mod {${o.join(' ')}}, sim {${s.join(' ')}}`);
    }

    // ── the two diamond fans ──────────────────────────────────────────────
    if (isWatched('obj_regularbullet')) {
      const oFan = led.byObj.get('obj_regularbullet') ?? [];
      const sFan = sim.byObj.get('obj_regularbullet') ?? [];
      const dirSet = (xs) => [...new Set(xs.map((s) => r10(s.direction)))].sort().join(' ');
      ok(dirSet(oFan) === dirSet(sFan),
        `${id}: fan directions — mod {${dirSet(oFan)}}, sim {${dirSet(sFan)}}`);
      const split = (xs) => {
        const at4 = xs.filter((s) => s.speed === 4).length;
        const at6 = xs.filter((s) => s.speed === 6).length;
        return `${at4}@4 ${at6}@6 of ${xs.length}`;
      };
      ok(oFan.length > 0 && sFan.length > 0
        && oFan.filter((s) => s.speed === 4).length === oFan.length * 5 / 7
        && sFan.filter((s) => s.speed === 4).length === sFan.length * 5 / 7,
        `${id}: fan speed split five-at-4 / two-at-6 per volley — mod ${split(oFan)}, sim ${split(sFan)}`);
      // image_angle is assigned FROM direction in the with-block, so the two
      // columns must agree bullet for bullet on both sides.
      ok(oFan.every((s) => r10(s.angle) === r10(s.direction))
        && sFan.every((s) => r10(s.angle) === r10(s.direction)),
        `${id}: every fan bullet's image_angle equals its direction`);
    }

    // ── the cadence ───────────────────────────────────────────────────────
    //
    // Manager Alarm_1 re-arms at `delay + 2 * irandom(3)`, so the interval
    // between volleys takes one of FOUR values. THE SUPPORT COMES FROM THE
    // RECORDING, not from a tolerance: `delay` is read as the smallest gap the
    // mod actually produced for this entry, and the assertion is that every
    // gap on both sides lands in {d, d+2, d+4, d+6}. The recording sets it
    // four-for-four on atk_RisingAbyssB (gaps 18,18,20,24,20,22,18,22,20,20,20)
    // and three-of-four on atk_Frenzy2B (29,29,29,29,31,33).
    const oBigF = [...new Set(framesOf(led, 'obj_knight_weird_circle_bullet'))].sort((a, b) => a - b);
    const sBigF = [...new Set(framesOf(sim, 'obj_knight_weird_circle_bullet'))].sort((a, b) => a - b);
    const oGaps = gaps(oBigF);
    const sGaps = gaps(sBigF);
    const d = Math.min(...oGaps);
    const support = [d, d + 2, d + 4, d + 6];
    ok(oGaps.length >= 3 && oGaps.every((g) => support.includes(g)),
      `${id}: the RECORDING's volley gaps all sit in {${support.join(',')}} —`
      + ` this is the row that sets the support (${oGaps.join(',')})`);
    ok(sGaps.length >= 3 && sGaps.every((g) => support.includes(g)),
      `${id}: the sim's volley gaps sit in the same four-value support`
      + ` (${sGaps.join(',')})`);
    // Create_0's `delay`: 18 by default, raised to 29 for ac 102 — and to 27
    // instead when kaizo_sideb() is set, which is the whole of the B-Side's
    // delta to this attack's cadence (kaizo underbox Create_0 lines 38/41).
    // Reading the floor off the RECORDING and asserting the mod's own literal
    // is what makes the support four lines up not a tolerance.
    const wantDelay = row.ac === 102 ? (sideb ? 27 : 29) : 18;
    ok(d === wantDelay,
      `${id}: the mod's own cadence floor is ${wantDelay}`
      + ` (Create_0's delay; ac 102 raises 18 -> ${sideb ? '27 on the B-Side' : '29'})`
      + ` — measured ${d}`);
    ranCadence = true;

    // ── the arming chain, as a RELATIVE interval ──────────────────────────
    //
    // From "the orbs appear" to "the first volley lands": both endpoints are
    // the first observation of an object, measured identically on both sides,
    // so this is comparable where an absolute frame is not. The GML chain is
    // Alarm_0 -> alarm[0] = init_start -> alarm[1] = init -> the orb's own
    // fuse of `delay`.
    const oLead = oBigF[0] - firstFrame(led, 'obj_knight_weird_circle');
    const sLead = sBigF[0] - firstFrame(sim, 'obj_knight_weird_circle');
    leadDeltas.push({ tag, id, oLead, sLead, delta: oLead - sLead });
    ok(oLead === sLead,
      `${id}: orbs -> first volley — mod ${oLead} frames, sim ${sLead}.`
      + ' The orb\'s fuse is written by the MANAGER inside the alarm phase, and'
      + ' sim/entity.js decrements each entity\'s alarms as it reaches it, so an'
      + ' alarm written onto an entity later in state.entities loses a frame.');

    // ── A SECOND SEED, because half of the above could pass by luck ───────
    //
    // The ring's placement carries no RNG, so it must be BIT-IDENTICAL under a
    // different seed — while the cadence, which is `2 * irandom(3)`, must
    // still land in the same four-value support. One seed cannot tell those
    // two claims apart; two can, and a run whose gaps happened to be all-18
    // would be caught here.
    const alt = runSim(row, { seed: 4242, sideb });
    const altOrbs = alt.byObj.get('obj_knight_weird_circle') ?? [];
    ok(sortedStr(altOrbs.map((s) => s.x)) === sortedStr(sOrbs.map((s) => s.x))
      && sortedStr(altOrbs.map((s) => s.y)) === sortedStr(sOrbs.map((s) => s.y)),
      `${id}: orb placement is seed-INDEPENDENT in the sim too (seed 4242 lands on`
      + ' the same five positions) — so the ten-decimal comparison above is a claim'
      + ' about geometry, not about a stream');
    const altGaps = gaps([...new Set(framesOf(alt, 'obj_knight_weird_circle_bullet'))]
      .sort((a, b) => a - b));
    ok(altGaps.length >= 3 && altGaps.every((g) => support.includes(g)),
      `${id}: seed 4242's volley gaps also sit in {${support.join(',')}}`
      + ` (${altGaps.join(',')})`);
    ok(altGaps.join(',') !== sGaps.join(','),
      `${id}: …and the two seeds really do differ (${sGaps.join(',')} vs`
      + ` ${altGaps.join(',')}), so the support assertion is not vacuous`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. ac 102's SECOND controller — the swordfall pairing
  // ══════════════════════════════════════════════════════════════════════
  //
  // The ac-102 arm is `type 106` THEN `type 108`, and the two attacks talk to
  // each other: obj_knight_swordfall's Step (Step_0:30-40) pins every
  // obj_knight_weird_circle's alarms at 999 for as long as its own
  // local_turntimer sits under 120, freezing the ring. Its Other_10 ("full")
  // starts that clock at 324, and its rain-finish block sets it to 99999 —
  // which switches the freeze OFF permanently. Which of the two happens first
  // is decided by `turn_time`, and that is where the recording bites.
  {
    const id = 'atk_Frenzy2B';
    const led = oracle.get(id);
    if (led && !isWatched('obj_fallingsword')) {
      note(`${id}: the type-108 pairing was NOT compared — this recording never logs`
        + ' obj_fallingsword, so it cannot say when the sword rain ended.');
    } else if (led) {
      console.log(`\n  ── ${id}: the type-108 pairing ──`);
      const sim = runSim(rowById.get(id), { sideb });
      const oLastBig = lastFrame(led, 'obj_knight_weird_circle_bullet');
      const oLastSword = lastFrame(led, 'obj_fallingsword');
      const sLastBig = lastFrame(sim, 'obj_knight_weird_circle_bullet');
      const sLastSword = lastFrame(sim, 'obj_fallingsword');
      const oSwordFrames = new Set(framesOf(led, 'obj_fallingsword')).size;
      const sSwordFrames = new Set(framesOf(sim, 'obj_fallingsword')).size;
      console.log(`    mod: last volley +${oLastBig - led.firstRow},`
        + ` last falling sword +${oLastSword - led.firstRow},`
        + ` ${count(led, 'obj_fallingsword')} swords over ${oSwordFrames} frames`);
      console.log(`    sim: last volley +${sLastBig}, last falling sword +${sLastSword},`
        + ` ${count(sim, 'obj_fallingsword')} swords over ${sSwordFrames} frames`);

      ok(oLastBig > oLastSword,
        `${id}: in the RECORDING the ring outlives the sword rain — the last volley`
        + ' comes AFTER the last falling sword (this is the row that sets the claim)');
      // ORDERING, not an absolute frame: which of the two streams ends first.
      //
      // THE FIX THIS ASSERTION FORCED, kept here so it cannot be undone
      // quietly. Other_23's ac-102 arm ends `with (obj_knight_swordfall)
      // turn_time = 40`, and that `with` iterates an EMPTY SET: the arm only
      // creates an obj_dbulletcontroller, and obj_knight_swordfall is made by
      // THAT controller's own Step one frame later (this recording: turn from
      // f6559, obj_knight_swordfall's first row f6560). So turn_time keeps its
      // Create value of 160, the rain finishes early and sets
      // local_turntimer = 99999, and that switches OFF the swordfall Step's
      // `< 120` freeze on every obj_knight_weird_circle's alarms — which is why
      // the ring outlives the rain. The launcher used to apply the op
      // synchronously, where it landed and inverted the pair (last volley +178
      // against last sword +300, 43 swords). It is now INERT and labelled
      // ORIGINAL BUG at kaizo/scenes/kaizo-mod-launcher.js.
      ok(sLastBig > sLastSword,
        `${id}: and the sim agrees — its ring outlives its rain too (last volley`
        + ` +${sLastBig}, last sword +${sLastSword}). If this fails, the dispatch's`
        + ' dead `with (obj_knight_swordfall) turn_time = 40` has been made live'
        + ' again: at 40 the rain is still running when the freeze bites and the'
        + ' ring dies first.');

      // THE RAIN'S SIZE, asserted rather than noted. The header excludes counts
      // whose value is an RNG draw — this one is measurably not: the sim lands
      // 23 swords over 12 frames on seeds 20260810 / 4242 / 1 / 99999 / 777,
      // last sword at +180 every time, because the countdown's irandom only
      // moves WHEN a sword falls inside a fixed window, not how many. So mod vs
      // sim here is a claim about the rain's length, and it is the same finding
      // as the ordering above measured a second way — turn_time 40 produced 43
      // swords over 22 frames.
      ok(count(led, 'obj_fallingsword') === count(sim, 'obj_fallingsword')
        && oSwordFrames === sSwordFrames,
        `${id}: the sword rain is the same size — mod ${count(led, 'obj_fallingsword')}`
        + ` swords over ${oSwordFrames} frames, sim ${count(sim, 'obj_fallingsword')}`
        + ` over ${sSwordFrames}`);
      const altSword = runSim(rowById.get(id), { seed: 4242, sideb });
      ok(count(altSword, 'obj_fallingsword') === count(sim, 'obj_fallingsword')
        && new Set(framesOf(altSword, 'obj_fallingsword')).size === sSwordFrames,
        `${id}: …and it is seed-INDEPENDENT in the sim (seed 4242 lands`
        + ` ${count(altSword, 'obj_fallingsword')} over`
        + ` ${new Set(framesOf(altSword, 'obj_fallingsword')).size}), so the line above`
        + ' is a claim about the rain and not about a stream');
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. THE COMBINATION ROWS — ac 7 and ac 106
  // ══════════════════════════════════════════════════════════════════════
  //
  // Both dispatch controller type 105, which creates obj_knight_combinations.
  // Its Other_10 shuffles [2,3,4,5], throws the result away, and reads
  // first/second/third_attack off obj_knight_enemy — so the ORDER IS FIXED
  // regardless of the shuffle (CLAUDE.md, "ds_list_shuffle — measured, not
  // solved"). The mod sets those three fields per attack choice in Other_23:
  // ac 7 asks for 4-2-3, ac 106 for 1-2-5. The segment ids map
  // 1 quickslash / 2 rotating slash / 3 tunnel slasher 2 revised /
  // 4 swordfall / 5 weird bottom manager.
  console.log('\n  ── combination rows (controller type 105) ──');
  const SEGMENT_OBJECTS = [
    'obj_roaringknight_quickslash_attack', // 1
    'obj_knight_rotating_slash', // 2
    'obj_knight_tunnel_slasher_2_revised', // 3
    'obj_knight_swordfall', // 4
    'obj_knight_weird_bottom_manager', // 5
  ];
  const segmentOrder = (l) => SEGMENT_OBJECTS
    .filter((n) => (l.byObj.get(n) ?? []).length > 0)
    .map((n) => ({ n, f: firstFrame(l, n) }))
    .sort((a, b) => a.f - b.f)
    .map((s) => s.n);

  {
    const id = 'atk_Frenzy1';
    const led = oracle.get(id);
    if (led) {
      const sim = runSim(rowById.get(id), { sideb });
      const oOrder = segmentOrder(led);
      const sOrder = segmentOrder(sim);
      console.log(`    ${id} (ac 7): mod chain ${oOrder.join(' -> ')}`);
      console.log(`                     sim chain ${sOrder.join(' -> ')}`);
      ok(oOrder.join(',') === 'obj_knight_swordfall,obj_knight_rotating_slash,obj_knight_tunnel_slasher_2_revised',
        `${id}: the RECORDING walks 4 -> 2 -> 3, exactly what Other_23's ac-7 arm sets`);
      ok(sOrder.join(',') === oOrder.join(','),
        `${id}: the sim walks the same three segments in the same order`);
      // THE LEDGER, ASSERTED - and this assertion is the INVERSE of the one it
      // replaces. It used to read `sim.approx.length === 0`, "the launcher
      // ledgers no approximation for this row", and it PASSED - against a row
      // whose entire body is the vanilla combination module. That was the
      // ledger being blind, not the dispatch being complete:
      // resolveDifficulty only ever ledgers a CLAMP, SUPPORTED[105] covers the
      // d0 the arm asks for, and nothing anywhere recorded that the segments
      // themselves are vanilla. The old assertion was WRONG - it asserted the
      // blindness - and the segment-3 divergence below is what it was hiding.
      // kaizo-mod-launcher.js carries a VANILLA_BODIES table that ledgers the
      // substitution unconditionally, and this checks it.
      //
      // BOTH DIRECTIONS, gated on the leg-1 PROBE rather than on a literal.
      // The row is about `case 105:` calling the vanilla `launchCombination`,
      // not about which module each SEGMENT resolves to - so the seam does not
      // retire it and the launcher edit does. Asserting only the "still
      // vanilla" half would turn this file red on the day the edit lands,
      // which is a landmine dressed as a regression test; asserting only the
      // "already shipped" half would let today's substitution through unseen.
      const bodyRow = sim.approx.find((a) => a.row === id && a.type === 105
        && String(a.asked) === 'type 105 body');
      if (ROUTED.leg1.shipped) {
        ok(!bodyRow,
          `${id}: leg 1 has landed, so the launcher ledgers NO vanilla body for`
          + ` this row any more (${JSON.stringify(sim.approx)})`);
      } else {
        ok(!!bodyRow && /combination\.js/.test(String(bodyRow.used)),
          `${id}: the launcher LEDGERS that this row's body is the vanilla combination`
          + ` module (${JSON.stringify(sim.approx)})`);
      }
      // SEGMENT 2's own output: seven slashes in two bursts, and two
      // obj_knight_circle — one per `aim` entry (rotating_slash Step_0:278,
      // `instance_create(aim_x, aim_y, obj_knight_circle)`), so their spacing
      // IS the aim cycle's length.
      //
      // THE B-SIDE GAP THIS CAUGHT, and it is the route-D half of the same
      // routing defect as segment 3 below. The mod's Step_0:57-62 adds
      // `else if (kaizo_sideb() && !delay_swords) { if (slash_base > 15)
      // slash_base = 15; }` to a Create that starts slash_base at 18, and the
      // cycle length is read off `slash_base + slash_offset` at Step_0:286/290
      // /302 — so the B-Side's cycle is three frames shorter. Recording:
      // route C gap 36, route D gap 33. sim/attacks/rotating-slash.js has no
      // such cap and gave 36 on BOTH routes; kaizo/attacks/rotating-slash.js
      // carries it, and this row went from red to green the moment the chain
      // resolved that module. Asserted per route rather than as a literal, so
      // it stays a comparison against the recording.
      ok(count(led, 'obj_roaringknight_slash') === count(sim, 'obj_roaringknight_slash'),
        `${id}: obj_roaringknight_slash — mod ${count(led, 'obj_roaringknight_slash')},`
        + ` sim ${count(sim, 'obj_roaringknight_slash')}`);
      const oCircF = framesOf(led, 'obj_knight_circle').sort((a, b) => a - b);
      const sCircF = framesOf(sim, 'obj_knight_circle').sort((a, b) => a - b);
      ok(oCircF.length === 2 && sCircF.length === 2
        && gaps(oCircF)[0] === gaps(sCircF)[0],
        `${id}: two obj_knight_circle, same spacing — mod gap ${gaps(oCircF)[0]},`
        + ` sim gap ${gaps(sCircF)[0]}`);
      // AND THE TWO ROUTES MUST NOT AGREE. Without this the line above passes
      // on any model that happens to produce one number twice — including the
      // unrouted sim's flat 36, which matched route C and only route C. The
      // claim is that the recording itself distinguishes them.
      if (sideb) {
        ok(gaps(oCircF)[0] === 33 && gaps(sCircF)[0] === 33,
          `${id}: on the B-SIDE that gap is 33, not route C's 36 — the mod's`
          + ` slash_base cap of 15 is visible in the recording (mod ${gaps(oCircF)[0]},`
          + ` sim ${gaps(sCircF)[0]})`);
      } else {
        ok(gaps(oCircF)[0] === 36 && gaps(sCircF)[0] === 36,
          `${id}: on the ordinary route that gap is 36 — slash_base stays at its`
          + ` Create value of 18 (mod ${gaps(oCircF)[0]}, sim ${gaps(sCircF)[0]})`);
      }
      // POSITIVE EXECUTION: the segment really is the KAIZO rotating slash, by
      // identity. The two copies share a type.name, so every number above
      // would read the same whichever one ran.
      ok(sim.typesSeen.has(KAIZO_ROTATING),
        `${id}: segment 2 is kaizo/attacks/rotating-slash.js by identity, not the`
        + ' sim copy answering to the same type.name');
      ok(!oOrder.includes('obj_knight_weird_bottom_manager')
        && !sOrder.includes('obj_knight_weird_bottom_manager'),
        `${id}: ac 7's chain contains NO underbox segment on either side (control:`
        + ' this is the family row that does not spawn one)');

      // SEGMENT 3. `obj_knight_tunnel_slasher_2_revised` is registered by the
      // VANILLA module (sim/attacks/sword-tunnel-revised.js) — the kaizo copies
      // deliberately do not call registerComboAttack, so every combination
      // segment runs vanilla. The recording shows the mod's version is not the
      // vanilla one.
      if (isWatched('obj_knight_diamondswordbullet_ext')) {
        const oExt = led.byObj.get('obj_knight_diamondswordbullet_ext') ?? [];
        const sExt = sim.byObj.get('obj_knight_diamondswordbullet_ext') ?? [];
        const oDirs = new Set(oExt.map((s) => r10(s.direction)));
        const sDirs = new Set(sExt.map((s) => r10(s.direction)));
        console.log(`      segment 3 bullets: mod ${oExt.length} with ${oDirs.size} distinct`
          + ` directions, sim ${sExt.length} with ${sDirs.size}`);
        ok(oDirs.size > 1,
          `${id}: the RECORDING's segment-3 bullets carry ${oDirs.size} distinct directions`
          + ' (this is the row that sets the claim)');
        // THE ASSERTION IS UNCHANGED; WHAT CHANGED IS THE MODULE UNDER IT.
        //
        // This read `sim's segment-3 bullets carry only 1 direction` for as
        // long as the chain resolved sim/attacks/sword-tunnel-revised.js,
        // whose blade spawner does `b.vspeed = drift` — a write to a plain JS
        // property. GameMaker stores speed/direction and DERIVES hspeed and
        // vspeed, so in the mod that line tilts each blade off the
        // `scr_fire_bullet(..., 180, 0.5)` heading it was fired on; in the sim
        // nothing reads the property back and every blade stays at a flat
        // 180.0000000000. kaizo/attacks/sword-tunnel-revised.js writes the
        // COMPONENT (`setVspeed`), and the ROUTING EDIT at the top of this
        // file is what puts that module on the chain.
        //
        // NOT loosened: the comparison is the same `> 1`, taken from the same
        // column of the same recording, and it now passes because the sim
        // fans. The count is not asserted equal — the tilt is
        // `dorifto = 0.1 + random(0.5) * choose(1, -1)`, an RNG draw, and the
        // stream is re-anchored per launch by design (CLAUDE.md, "LIVE RNG IS
        // RE-ANCHORED PER ATTACK LAUNCH"). What IS asserted is the shape: more
        // than one heading, and every heading inside the band the recording
        // measured.
        ok(sDirs.size > 1,
          `${id}: the sim's segment-3 bullets carry only ${sDirs.size} direction`
          + ` (${[...sDirs].join(',')}) against the mod's ${oDirs.size}`
          + ` spanning ${Math.min(...oExt.map((s) => s.direction)).toFixed(2)}..`
          + `${Math.max(...oExt.map((s) => s.direction)).toFixed(2)}.`
          + ' If this is red the chain has stopped resolving'
          + ' kaizo/attacks/sword-tunnel-revised.js — see the ROUTING EDIT block.');
        // POSITIVE EXECUTION, by identity: the two copies share a type.name,
        // so without this a revert of the registry would show up only as a
        // count moving, and a count can move for other reasons.
        ok(sim.typesSeen.has(KAIZO_TUNNEL),
          `${id}: segment 3 is kaizo/attacks/sword-tunnel-revised.js by identity`);
        // THE BAND. `sDirs.size > 1` alone would pass on any two headings at
        // all; this says the sim's fan lives where the mod's fan lives. The
        // bound comes from the RECORDING (route C 138.61..243.85, route D
        // 137.65..246.03) with the mod's own `dorifto` support as the slack:
        // the blades leave at 180 and the drift can only tilt them by
        // atan(dorifto / hspeed), so a model that tilted them the wrong way,
        // or by a different magnitude, lands outside.
        const oLo = Math.min(...oExt.map((s) => s.direction));
        const oHi = Math.max(...oExt.map((s) => s.direction));
        const sLo = Math.min(...sExt.map((s) => s.direction));
        const sHi = Math.max(...sExt.map((s) => s.direction));
        ok(oLo > 90 && oHi < 290,
          `${id}: the recording's fan straddles 180 — ${oLo.toFixed(2)}..${oHi.toFixed(2)}`
          + ' (the row that sets the band)');
        ok(sLo > 90 && sHi < 290 && sLo < 180 && sHi > 180,
          `${id}: the sim's fan straddles 180 inside the same band —`
          + ` sim ${sLo.toFixed(2)}..${sHi.toFixed(2)} against mod`
          + ` ${oLo.toFixed(2)}..${oHi.toFixed(2)}. A one-sided fan would mean the`
          + ' drift sign is lost, which is a different bug from not drifting at all.');
      }
      if (isWatched('obj_fallingsword')) {
        note(`${id}: obj_fallingsword — mod ${count(led, 'obj_fallingsword')},`
          + ` sim ${count(sim, 'obj_fallingsword')}. Not asserted: the swordfall's`
          + ' countdown is irandom-driven.');
      }
      note(`${id}: obj_knight_warp — mod ${count(led, 'obj_knight_warp')}, sim`
        + ` ${count(sim, 'obj_knight_warp')}. Not asserted: the teleport puff is`
        + ' created at three different sites along the chain and is cosmetic.');
    }
  }

  {
    const id = 'atk_Frenzy3';
    const led = oracle.get(id);
    if (led) {
      const sim = runSim(rowById.get(id), { sideb });
      const oOrder = segmentOrder(led);
      const sOrder = segmentOrder(sim);
      console.log(`    ${id} (ac 106): mod chain ${oOrder.join(' -> ')}`);
      console.log(`                       sim chain ${sOrder.join(' -> ')}`);
      ok(oOrder.join(',') === 'obj_roaringknight_quickslash_attack,obj_knight_rotating_slash,obj_knight_weird_bottom_manager',
        `${id}: the RECORDING walks 1 -> 2 -> 5, exactly what Other_23's ac-106 arm sets`);
      // THE HONEST ASSERTION for this row, in TWO parts because the row is
      // approximated in two independent ways and one ledger line cannot carry
      // both. The ORDER is wrong (the vanilla launchCombination reads a
      // module-level COMBO_ORDER, so the sim walks 4-2-3 whatever the arm asks
      // for), and so are the segment BODIES. Matching by `asked` rather than by
      // position: the two rows are pushed by different ops of the same arm and
      // a `find` on type alone would silently take whichever happened to be
      // first.
      //
      // BOTH WORLDS, gated on the leg-1 PROBE. This is the row the launcher
      // edit changes most, and writing only today's half would hand integration
      // a red suite for landing the fix this file has been asking for.
      const orderLedger = sim.approx.find((a) => a.row === id && a.type === 105
        && String(a.asked).startsWith('combination '));
      const bodyLedger = sim.approx.find((a) => a.row === id && a.type === 105
        && String(a.asked) === 'type 105 body');
      if (ROUTED.leg1.shipped) {
        // THE SHIPPED CLAIM. `launchKaizoCombination` takes the order as an
        // argument, so ac 106 must start on the QUICKSLASH - which is the one
        // thing the module constant could never produce, and the whole reason
        // kaizo/attacks/combination.js exists.
        ok(sOrder[0] === 'obj_roaringknight_quickslash_attack',
          `${id}: leg 1 landed, so segment 1 is the QUICKSLASH the ac-106 arm asks`
          + ` for, not the Create default's swordfall (sim ${sOrder.join(' -> ')})`);
        ok(!orderLedger && !bodyLedger,
          `${id}: ...and neither the order nor the body is ledgered any more`
          + ` (${JSON.stringify(sim.approx)})`);
        if (sOrder.join(',') === oOrder.join(',')) {
          ok(true, `${id}: the whole 1 -> 2 -> 5 chain walks as the mod's does`);
        } else {
          // MEASURED, on a bench that applied the launcher edit locally: with
          // leg 1 landed and kaizo/attacks/quickslash.js unchanged, the chain
          // stops at segment 1 and the turn never releases - the quickslash's
          // turn-end fork (Step_0:57-151) ledgers instead of calling
          // kaizoChainNext(state, e, 'quickslash_step'), and it has already
          // frozen itself at local_turntimer 99999 under a clock pinned at
          // 999999. Reported as a failure with the exact remaining line rather
          // than as a NOTE, because a turn that cannot end is not a cosmetic
          // gap.
          ok(false,
            `${id}: leg 1 landed but the chain stops at ${sOrder.join(' -> ')}.`
            + " kaizo/attacks/quickslash.js Step_0:57-151 still ledgers its"
            + " handoff; it needs kaizoChainNext(state, e, 'quickslash_step')."
            + ' Until it does, this turn HANGS - the quickslash freezes at'
            + ' local_turntimer 99999 and nothing hands the clock back.');
        }
      } else {
        ok(!!orderLedger && String(orderLedger.asked) === 'combination 1-2-5',
          `${id}: the launcher ledgers the 1-2-5 order as approximated`
          + ` (${JSON.stringify(sim.approx)})`);
        ok(!!bodyLedger && /combination\.js/.test(String(bodyLedger.used)),
          `${id}: ...and it ALSO ledgers that the segments themselves are vanilla`
          + ' bodies - the order being wrong and the bodies being vanilla are two'
          + ' separate approximations of the same row');
        ok(sOrder.join(',') !== oOrder.join(','),
          `${id}: and the ledger is not vacuous - the sim really does walk a different`
          + ` chain (${sOrder.join(' -> ')})`);
      }

      // ORACLE-ONLY, and worth asserting because it is what licenses the
      // ten-decimal orb comparison in block 2: the ring's placement carries NO
      // RNG. atk_Frenzy3's underbox segment runs on the same 320,170 2x2 board
      // as atk_RisingAbyssB, 7850 frames later in the same recording, and lands
      // on the same five positions to the last digit.
      // ROUTE C ONLY, and the restriction is the point rather than an
      // exemption. The comparison needs the two entries to be asking for the
      // SAME ring, and on the ordinary route they are: atk_RisingAbyssB is
      // ac 3 and atk_Frenzy3's segment runs at ac 106, so neither trips the
      // manager Step's `+= 92` (ac 101) or `+= 32` (ac 102) and both sit on the
      // 320,170 2x2 board. On the B-SIDE atk_RisingAbyssB is ac 101 — 92px
      // lower, on its own 3 x 1.5 board at y 114 — so the two rings are
      // supposed to differ there, and asserting equality would be asserting
      // that the B-Side's whole delta to this attack does not exist. The
      // B-Side's determinism claim is carried instead by block 2's ten-decimal
      // orb comparison for ac 101, which is a stronger statement anyway: it
      // holds the mod's ring against the SIM's, not against another entry.
      const a3 = oracle.get('atk_RisingAbyssB');
      if (a3 && !sideb) {
        const o3 = a3.byObj.get('obj_knight_weird_circle') ?? [];
        const o106 = led.byObj.get('obj_knight_weird_circle') ?? [];
        ok(o3.length === 5 && o106.length === 5
          && sortedStr(o3.map((s) => s.x)) === sortedStr(o106.map((s) => s.x))
          && sortedStr(o3.map((s) => s.y)) === sortedStr(o106.map((s) => s.y)),
          'the ring placement is DETERMINISTIC in the mod: atk_Frenzy3 and'
          + ' atk_RisingAbyssB put their five orbs on the same ten-decimal'
          + ' positions, 7850 frames apart — no RNG in the ellipse');
      } else if (a3) {
        // The B-Side's counterpart claim, and it is a POSITIVE one: the two
        // rings must NOT coincide, because ac 101 drops the centre by 92.
        const o3 = a3.byObj.get('obj_knight_weird_circle') ?? [];
        const o106 = led.byObj.get('obj_knight_weird_circle') ?? [];
        ok(o3.length === 5 && o106.length === 5
          && sortedStr(o3.map((s) => s.y)) !== sortedStr(o106.map((s) => s.y)),
          'B-Side: atk_RisingAbyssB (ac 101) and atk_Frenzy3 (ac 106) put their'
          + ' rings in DIFFERENT places — the manager Step\'s +92 for ac 101 is'
          + ' visible in the recording, not just in the dump'
          + `\n         ac 101 ${sortedStr(o3.map((s) => s.y))}`
          + `\n         ac 106 ${sortedStr(o106.map((s) => s.y))}`);
      }
      // …and the volley shape is the same object for object, wherever the
      // segment is reached from.
      if (isWatched('obj_regularbullet')) {
        ok(count(led, 'obj_regularbullet')
          === count(led, 'obj_knight_weird_circle_bullet') * 7,
          `${id}: the mod's underbox segment keeps the 7-fans-per-big-shot volley`
          + ` (${count(led, 'obj_regularbullet')} vs`
          + ` ${count(led, 'obj_knight_weird_circle_bullet')} x 7)`);
      }

      // THE OVERLAP, MEASURED RATHER THAN DESCRIBED. This used to be prose
      // with one number in it (the mod's 11), which is exactly the shape
      // CLAUDE.md warns about under "Instrument before theorising": it named
      // the defect without ever printing what it costs. Both intervals are
      // RELATIVE to the same run, so they are comparable across a recording
      // and a sim launch even though the absolute frames are not.
      {
        const oRot = firstFrame(led, 'obj_knight_rotating_slash');
        const sRot = firstFrame(sim, 'obj_knight_rotating_slash');
        const oMgr = firstFrame(led, 'obj_knight_weird_bottom_manager');
        const sMgr = firstFrame(sim, 'obj_knight_weird_bottom_manager');
        const span = (a, b) => (a === null || b === null ? '?' : b - a);
        const oOrb = firstFrame(led, 'obj_knight_weird_circle');
        const sOrb = firstFrame(sim, 'obj_knight_weird_circle');
        const vol = (l) => framesOf(l, 'obj_knight_weird_circle_bullet')
          .slice().sort((a, b) => a - b);
        const oVol = vol(led);
        const sVol = vol(sim);
        const firstGap = (v) => (v.length > 1 ? v[1] - v[0] : '?');
        note(`${id}: the mod OVERLAPS these segments — obj_knight_rotating_slash's`
          + ' Step_0:169-196 creates the underbox manager at'
          + ' `local_turntimer < turn_limit_4` (250, set by Other_10 for "short mid"),'
          + ' partway through a segment that keeps slashing, and then forces'
          + ' init_start/init back to 4/8 so the manager keeps the "full" arming'
          + ' cadence despite its "short end" turn_type. kaizo/attacks/'
          + 'rotating-slash.js carries only Alarm_2, so the sim hands off on'
          + ' DESTROY and cannot express an overlap at all. WHAT THAT COSTS,'
          + ' measured on this run:'
          + `\n         segment 2 -> segment 3   mod ${span(oRot, oMgr)} frames,`
          + ` sim ${span(sRot, sMgr)}`
          + `\n         manager -> orbs          mod ${span(oMgr, oOrb)} frames,`
          + ` sim ${span(sMgr, sOrb)}   (alarm[0] = 16, unaffected)`
          + `\n         orbs -> first volley     mod ${span(oOrb, oVol[0])} frames,`
          + ` sim ${span(sOrb, sVol[0])}   (init 8 vs the arm's 1)`
          + `\n         first volley -> second   mod ${firstGap(oVol)} frames,`
          + ` sim ${firstGap(sVol)}   (init_start 4 vs the arm's 2: the sim`
          + ' double-fires)'
          + '\n         (LANDED 2026-08-31: kaizo/attacks/rotating-slash.js now'
          + " carries all four Step_0:64-196 early-spawn blocks, so"
          + " 'rotating_step' is called mid-pattern instead of the segment"
          + ' waiting for Alarm_2. The first three spans above went from'
          + ' 11/82, 16/16, 29/34 to exact; they are ASSERTED below now'
          + ' rather than printed. The last span is the remaining residual.)');

        // POSITIVE ASSERTIONS FOR THE EARLY-SPAWN HANDOFF.
        //
        // These exist because the defect they guard was INVISIBLE to every other
        // suite: the segment still appeared, still fired, still tore down, and
        // every count was right -- it was 71 frames late, and only a span
        // measured against the recording says so. A note that prints the number
        // cannot fail, so the three spans the fix made exact are assertions.
        //
        // The fourth span (first volley -> second) is deliberately NOT asserted:
        // it reads mod 18 / sim 24 on one route and 24/24 on the other, so it is
        // still open and the note above still carries it honestly.
        ok(span(oRot, oMgr) === span(sRot, sMgr),
          'segment 2 -> segment 3 spans agree (the id-5 early-spawn block fires'
          + ` mid-pattern, not at Alarm_2) - mod ${span(oRot, oMgr)}, sim ${span(sRot, sMgr)}`);
        ok(span(oMgr, oOrb) === span(sMgr, sOrb),
          `manager -> orbs spans agree - mod ${span(oMgr, oOrb)}, sim ${span(sMgr, sOrb)}`);
        ok(span(oOrb, oVol[0]) === span(sOrb, sVol[0]),
          'orbs -> first volley spans agree (the manager took init 8 from the'
          + ` Step_0 post, not the arm's 1) - mod ${span(oOrb, oVol[0])}, sim ${span(sOrb, sVol[0])}`);
      }

      // The manager's own TEARDOWN is this file's, and it is now the mod's:
      // Alarm_1's else-arm (alarm[2] = 32 for a chained segment, not the
      // standalone 40) landed in kaizo/attacks/underbox.js on 2026-08-30 and
      // took 8 frames off this row's bullet phase in the whole-fight diff.
      // check-underbox's "chained teardown" block pins all four arms.
    }
  }

  comparedRoutes.push(tag);
}

// ══════════════════════════════════════════════════════════════════════════
// main — discover the recordings, MEASURE each one's route, compare each
// ══════════════════════════════════════════════════════════════════════════

/** Routes actually held against the sim this run, in order. */
const comparedRoutes = [];

function main() {
  const explicitSeq = process.argv[2];
  const explicitTrace = process.argv[3];

  /** {seqPath, tracePath} pairs to consider. */
  const candidates = [];
  if (explicitSeq) {
    candidates.push({ seqPath: explicitSeq, tracePath: explicitTrace ?? null });
  } else {
    const { dir, found, looked } = resolveTraces();
    if (!dir) {
      // A LOUD SKIP, NEVER A SILENT PASS — the same convention
      // check-oracle-schedule uses, and for the same reason: this is the only
      // thing in the kaizo gate that holds THIS ATTACK FAMILY against the real
      // mod, so its absence has to be visible in the output. A reader who sees
      // a green gate without this line would reasonably believe the underbox
      // had been diffed against the recording.
      console.log('SKIP check-oracle-weird: no kaizo oracle recording found');
      for (const l of looked) console.log(`     looked in ${l}`);
      console.log('     Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,');
      console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
      console.log('     THE UNDERBOX FAMILY IS NOT HELD AGAINST THE REAL MOD WITHOUT IT.');
      return 0;
    }
    for (const f of found) {
      const t = join(dir, f);
      const s = seqFor(dir, t);
      if (s) candidates.push({ seqPath: s, tracePath: t });
    }
    if (!candidates.length) {
      console.log('SKIP check-oracle-weird: found trace(s) but no matching SPAWN LOG');
      console.log(`     looked beside ${found.length} trace file(s) in ${dir}`);
      console.log('     Per-attack diffs read the seq CSV; the trace alone cannot supply them.');
      return 0;
    }
  }

  console.log(`check-oracle-weird: ${candidates.length} recording(s) with a spawn log`);

  // ── ONE RECORDING PER ROUTE, the longest ────────────────────────────────
  //
  // THE ROUTE IS MEASURED, NEVER ASSUMED. detectRoute is the same function
  // check-oracle-schedule uses, and it refuses to guess: a recording carrying
  // none of the three discriminating entries is AMBIGUOUS and a recording
  // carrying both signatures is a CONFLICT. Both are skipped with a reason
  // rather than compared against a coin flip — and for this family the stakes
  // are concrete, because atk_RisingAbyssB is one of the three discriminators
  // (ac 3 on the ordinary route, ac 101 on the B-Side, +32 versus +92 on the
  // ring's centre).
  //
  // Longest per route for the same reason check-oracle-schedule picks the
  // longest overall: a MODE 1 attack-lock replays one entry and carries at
  // most one of this family.
  const chosen = new Map();
  const rejected = [];
  for (const c of candidates) {
    const seq = readSeq(c.seqPath);
    const missing = ['frame', 'object', 'x', 'y', 'angle', 'direction', 'speed', 'kaizo_playing']
      .filter((need) => seq.col[need] === undefined);
    if (missing.length) {
      // A recording that predates the kaizo_playing column cannot be
      // attributed per attack (ORACLE-GROUND-TRUTH.md, trap #1). Skipped with
      // its reason, not failed: an old capture is not a broken sim.
      rejected.push(`${basename(c.seqPath)}: no ${missing.join('/')} column`);
      continue;
    }
    if (!c.tracePath || !existsSync(c.tracePath)) {
      rejected.push(`${basename(c.seqPath)}: no trace companion, so the route cannot be`
        + ' measured and the turn-clock block has nothing to read');
      continue;
    }
    const det = detectRoute(recoverLaunches(readTrace(c.tracePath)));
    if (!det.route) {
      rejected.push(`${basename(c.seqPath)}: route ${det.conflict ? 'CONFLICT' : 'AMBIGUOUS'}`
        + ` (${det.evidence.length ? det.evidence.join(', ') : 'no discriminating entry'})`
        + ' — an attack-lock recording is usually this');
      continue;
    }
    const n = readFileSync(c.seqPath, 'utf8').length;
    if (!chosen.has(det.route) || chosen.get(det.route).n < n) {
      chosen.set(det.route, { ...c, seq, route: det.route, n, evidence: det.evidence });
    }
  }
  for (const r of rejected) console.log(`  skipped ${r}`);

  if (!chosen.size) {
    console.log('\nSKIP — no recording could be attributed to a route, so the sim cannot be');
    console.log('     driven to match one. atk_RisingAbyssB is ac 3 on the ordinary route');
    console.log('     and ac 101 on the B-Side — a different underbox, +92 on the ring');
    console.log('     centre instead of +32 — so guessing would compare the wrong attack.');
    return 0;
  }

  for (const route of ['C', 'D']) {
    const c = chosen.get(route);
    if (!c) continue;
    console.log(`\n  route ${route} from ${basename(c.seqPath)}`
      + ` — detected on ${c.evidence.join(', ')}`);
    compareRecording({
      seqPath: c.seqPath,
      tracePath: c.tracePath,
      seq: c.seq,
      sideb: route === 'D',
      tag: route,
    });
  }

  // ── the verdict ────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(74)}`);

  // THE SHAPE OF THE ARMING SHORTFALL, printed whether or not it is zero.
  //
  // The orbs -> first volley interval is one frame short in the sim, and it is
  // ONE frame on every row of every route — a constant, not a drift, across
  // cadences 18 and 27/29. That rules out this attack's own arithmetic and
  // points at the engine: the GML chain is manager alarm[0] (16) -> alarm[0]
  // (init_start 4) -> alarm[1] (init 8) -> `with (orb) alarm[1] = fuse`, and
  // the sim reproduces the manager's own alarm[0] -> alarm[1] hop exactly
  // (it loses a frame there, as the mod does: +21 -> +28, 7 not 8). Only the
  // CROSS-INSTANCE write differs. sim/entity.js's runAlarms decrements and
  // fires per entity in state.entities order, so a fuse the manager writes
  // onto an orb — created later, therefore later in that list — is decremented
  // again before the orb is reached, and lands one short. GameMaker's own pass
  // visits obj_knight_weird_circle before obj_knight_weird_bottom_manager, so
  // there the write survives the frame intact.
  //
  // NOT FIXED HERE. The correction belongs in sim/entity.js and would change
  // the alarm phase for every attack in the tree, vanilla included; landing it
  // from this file would be an unverifiable whole-fight change made to turn
  // one check green.
  if (leadDeltas.length) {
    const ds = [...new Set(leadDeltas.map((l) => l.delta))];
    console.log('\n  orbs -> first volley (the arming chain):');
    for (const l of leadDeltas) {
      console.log(`    [route ${l.tag}] ${l.id.padEnd(18)} mod ${l.oLead}, sim ${l.sLead}`
        + `  (${l.delta >= 0 ? '+' : ''}${l.delta})`);
    }
    console.log(`  shortfall values seen: {${ds.join(', ')}}`
      + `${ds.length === 1 && ds[0] === 1
        ? ' — a CONSTANT one frame, which is the signature of the cross-instance'
          + ' alarm write above and not of this attack\'s arithmetic'
        : ''}`);
  }

  // -- THE ROUTING RECEIPT ------------------------------------------------
  //
  // Printed and asserted, so "the combination's segments were the kaizo
  // modules" can never be confused with "the install quietly did nothing".
  // Two legs, reported separately because they close separately.
  if (comparedRoutes.length) {
    TAG = 'all'; // this block is about the run, not about one recording
    console.log('\n  combination segment routing (see THE ROUTING block):');
    console.log(`    leg 1 (launcher case 105) shipped: ${ROUTED.leg1.shipped}`
      + `   stood in for here: [${ROUTED.installed.join(', ') || 'none'}]`
      + `   already routed: [${ROUTED.already.join(', ') || 'none'}]`);
    console.log(`    leg 2 (comboChainNext seam) fired at: `
      + `${[...new Set(HOOKED)].join(', ') || 'NOTHING'}`);

    // THE PROBE ITSELF, ASSERTED. Everything below and both gated blocks in
    // the combination rows read `ROUTED.leg1.shipped`, so a probe that threw
    // would report "not shipped" forever — including after the edit landed —
    // and every gate would quietly take the stale branch. That is the "a green
    // suite does not mean a change took effect" failure with an extra step.
    ok(ROUTED.leg1.threw === null,
      `the leg-1 probe drove the shipped launcher without throwing (${ROUTED.leg1.threw})`);
    // …and its two independent signals agree. `shipped` is
    // `state.kaizoComboOrder !== undefined`, which only launchKaizoCombination
    // writes; `firstIsKaizo` is the created segment's TYPE by identity. They
    // answer the same question from different ends, and the probe is only
    // evidence while they match.
    ok(ROUTED.leg1.shipped === ROUTED.leg1.firstIsKaizo,
      `the probe's two signals agree (kaizoComboOrder ${ROUTED.leg1.shipped},`
      + ` first segment kaizo ${ROUTED.leg1.firstIsKaizo})`);
    ok(ROUTED.leg1.shipped !== ROUTED.leg1.ledgeredBody,
      'the launcher ledgers a vanilla type-105 body EXACTLY when leg 1 is'
      + ` unshipped (shipped ${ROUTED.leg1.shipped}, ledgered`
      + ` ${ROUTED.leg1.ledgeredBody})`);

    // LEG 2, POSITIVE EXECUTION. The seam is what makes segments 2 and 3
    // kaizo, and "the seam fired" is a different claim from "the segment types
    // are kaizo" - a registry write would satisfy the second and not the
    // first, which is exactly how this file measured a chain nobody was going
    // to ship for a whole round. Both handoffs the 4-2-3 chain takes must
    // appear.
    const sites = new Set(HOOKED);
    ok(sites.has('swordfall_alarm3'),
      'the swordfall handed on THROUGH the seam (site swordfall_alarm3)'
      + ` - sites seen: [${[...sites].join(', ') || 'none'}]`);
    ok(sites.has('rotating_alarm2'),
      'the rotating slash handed on THROUGH the seam (site rotating_alarm2)'
      + ` - sites seen: [${[...sites].join(', ') || 'none'}]`);
    ok(HOOKED.every((n) => typeof n === 'string' && n.length > 0),
      'every hop named its handoff site - an unnamed one would take'
      + " kaizoChainNext's default and run another object's block");

    // THE STAND-IN AND THE REAL PATH MUST NAME THE SAME MODULES.
    //
    // Leg 1's one registry write is a stand-in for what `kaizoChainNext`
    // resolves out of `KAIZO_COMBO_ATTACKS`. If those two ever disagree, every
    // number above is about a chain the shipped fix will not produce - which
    // is exactly how segment 3 sat wrong for a round: the kaizo module
    // existed, and the table still pointed at the sim copy. This is the
    // coupling that makes reverting that table red HERE as well as in
    // check-combination.
    ok(KAIZO_COMBO_ATTACKS[2].type === KAIZO_ROTATING
      && KAIZO_COMBO_ATTACKS[3].type === KAIZO_TUNNEL
      && KAIZO_COMBO_ATTACKS[4].type === KAIZO_SWORDFALL,
      'kaizo/attacks/combination.js resolves segments 2/3/4 to the SAME modules this'
      + ' file walked - the stand-in and kaizoChainNext agree'
      + ` (2 ${KAIZO_COMBO_ATTACKS[2].source}, 3 ${KAIZO_COMBO_ATTACKS[3].source},`
      + ` 4 ${KAIZO_COMBO_ATTACKS[4].source})`);

    if (ROUTED.leg1.shipped) {
      note('LEG 1 HAS LANDED - kaizo-mod-launcher.js `case 105:` drives'
        + ' launchKaizoCombination, so the numbers above are what a build'
        + ' produces. The one registry write this file used to make was'
        + ' skipped, as designed, and the block can be deleted. Check the'
        + " atk_Frenzy3 assertions above: they switch to the shipped claim on"
        + ' this same flag.');
    } else {
      note('THE SHIPPED PATH STILL LAUNCHES THE VANILLA COMBINATION. Leg 2 - which'
        + ' module each SEGMENT resolves to - is now real: the kaizo modules pass'
        + ' their handoff site name to sim/attacks/combination.js chainNext, which'
        + ' forwards to kaizoChainNext when state.kaizo.hooks.comboChainNext is'
        + ' set, and runSim sets it on the scene it builds. What is left is ONE'
        + ' launcher edit, and it is not in this pass\'s files:'
        + ' kaizo/scenes/kaizo-mod-launcher.js `case 105:` must set'
        + ' state.kaizo.hooks.comboChainNext = kaizoChainNext and return'
        + ' launchKaizoCombination(state, kaizoComboOrderFor(state.currentAc))'
        + ' instead of the vanilla launchCombination, and VANILLA_BODIES[105]'
        + ' must go with it. Until then this file registers the kaizo swordfall'
        + ` for segment(s) ${ROUTED.installed.join(', ') || 'none'} so the vanilla`
        + " launcher's own fixed 4-2-3 walk starts on a kaizo body."
        + ' MEASURED PRECONDITION: that edit fixes atk_Frenzy1 completely (the'
        + ' 4-2-3 chain runs three kaizo bodies and the turn releases) and'
        + ' HANGS atk_Frenzy3, because kaizo/attacks/quickslash.js Step_0:57-151'
        + ' still ledgers its handoff instead of calling'
        + " kaizoChainNext(state, e, 'quickslash_step'), so segment 1 freezes at"
        + ' local_turntimer 99999 under a clock pinned at 999999 and nothing'
        + ' hands it back. Land the quickslash line first.');
    }
  }

  for (const n of notes) console.log(`\n  NOTE: ${n}`);

  // POSITIVE EXECUTION ASSERTION. Without this, "every comparison agreed" and
  // "no comparison ran" print the same line. The gating above is real — a
  // recording whose object list is short legitimately skips whole blocks — so
  // a bare assertion count is not enough on its own; the flags say WHICH
  // claims were actually tested. The floor of 20 is well under the 80+ a
  // `_deep` run produces on its own and well over zero.
  const RAN_FLOOR = 20;
  console.log(`\n  routes compared: ${comparedRoutes.join(', ') || 'none'}`);
  console.log(`  blocks that ran: object set ${ranSet}, orb geometry ${ranOrbGeometry},`
    + ` cadence ${ranCadence}, turn clock ${ranClock}`);
  if (checks < RAN_FLOOR || !ranOrbGeometry || !ranCadence || !ranSet
      || !comparedRoutes.length) {
    console.log(`  FAIL — ${checks} assertions ran across ${comparedRoutes.length} route(s),`
      + ' and the object-set / orb-geometry / cadence blocks must all have run.'
      + ' The comparison did not happen.');
    return 1;
  }

  if (failures) {
    console.log(`\n  ${failures} FAILURE(S) of ${checks} assertions:`);
    for (const f of failed) console.log(`    - ${f}`);
    console.log('\n  These are DIVERGENCES FROM THE REAL MOD, left failing on purpose.');
    return 1;
  }

  console.log(`\n  ${checks} assertions against the real mod   OK`);
  console.log('  (object sets, orb geometry to ten decimals, volley composition and');
  console.log('   cadence support, the sword rain\'s size, the combination chains, and');
  console.log('   whether each turn was ended by its attack — NOT absolute frames,');
  console.log('   RNG draws, or damage.)');
  return 0;
}

// pathToFileURL: on Windows argv[1] is a `D:\...` path and import.meta.url is
// a `file:///D:/...` URL, so the older `file://${argv[1]}` form is always false
// and main() would silently never run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
