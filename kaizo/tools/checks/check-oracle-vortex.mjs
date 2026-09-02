#!/usr/bin/env node
// THE SWORD VORTEX FAMILY, HELD AGAINST THE REAL MOD.
//
//   node kaizo/tools/checks/check-oracle-vortex.mjs [trace.csv]
//
// V-C recreation of EnderCat8's "Kaizo Roaring Knight" v2.3.3 — do not
// publish without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// check-oracle-schedule proved the fight SELECTS the right entries in the
// right order and raises the right board for them, and said in its own header
// that it checks "nothing INSIDE an attack". This is the first file that goes
// inside one. It takes the three sword-vortex entries —
//
//     atk_Vortex1   ac   2  difficulty 5  phase 1   type 108 then type 154
//     atk_Vortex2   ac  13  difficulty 3  phase 2   type 104 then type 154
//     atk_Vortex3   ac 111  difficulty 0  phase 3   type 154 then type 104
//
// — reads what the real mod SPAWNED for each of them out of the recorder's
// companion `kaizo_oracle_seq_*.csv`, drives the sim's own launcher for the
// same rows, and diffs the two spawn ledgers.
//
// ── WHAT IS CLAIMED ───────────────────────────────────────────────────────
//
//   * the SET of watched objects each entry creates
//   * the COUNT of every type whose count is deterministic
//   * the CADENCE — each spawn's frame RELATIVE TO THE MANAGER'S OWN
//     creation frame, which is anchor-free (see THE ONE-FRAME OFFSET below)
//   * spawn GEOMETRY that is structural rather than rolled: the vortex ring's
//     radius and headings, the manager's parking spot, the rotating slash's
//     fan centre and blade scales, and the Knight's own falling sword's
//     offset from his arm
//   * that dbulletcontroller type 108 really does ASSIGN global.turntimer =
//     600, and that the sim models it
//
// ── WHAT IS NOT CLAIMED, AND WHY ASSERTING IT WOULD BE A BUG ──────────────
//
//   * ABSOLUTE FRAME NUMBERS. The recording's turn lengths come from its own
//     pulsed-confirm input; the sim's come from this file's driver. Every
//     frame below is relative to the manager's creation.
//   * ANYTHING ROLLED. The project's honest claim is "mechanics one-to-one,
//     RNG re-anchored per launch" (CLAUDE.md), so the streams are deliberately
//     not aligned. Concretely here: the RAIN swords' positions and the number
//     of them. See THE FALLING-SWORD COUNT below — that number is asserted
//     nowhere, and this file proves it is unassertable rather than assuming so.
//   * DAMAGE, HP, TP OR TARGETING. The recorder pins party and boss HP to keep
//     the run alive, so every survival-shaped number is a harness artifact.
//   * THE KNIGHT'S Y. obj_knight_swordfall / obj_knight_rotating_slash are
//     created at the Knight's position, and his hover phase is a function of
//     the absolute frame. His X (425) is constant and IS compared.
//   * obj_afterimage / obj_afterimage_fade_to_white. The mod's rainbow trail
//     (`rgbafterimages = 1` unconditionally), the single largest instance
//     population in the fight, and purely cosmetic — the sim spawns its own
//     and the two are not intended to correspond.
//
// ── THE ONE-FRAME OFFSET, MEASURED RATHER THAN ASSUMED ────────────────────
//
// In the mod the knight's dispatch calls `scr_bulletspawner(..., obj_dbullet-
// controller)`, and the CONTROLLER creates the attack objects from its own
// Step — one frame after the launch. The recording says so directly: at
// atk_Vortex1's launch frame global.turntimer reads 349 (the dispatch's
// scr_turntimer(350), already ticked once), and 600 — the type-108 assignment
// at dbulletcontroller Step_0:2283 — appears on the frame AFTER. Every one of
// the family's objects is logged on that same later frame.
//
// The sim's launcher spawns managers directly, so its manager exists at the
// launch instant. Anchoring every cadence to the MANAGER'S OWN creation frame
// cancels the difference exactly, and nothing here depends on it.
//
// ── THE ATTRIBUTION RULE ──────────────────────────────────────────────────
//
// Grouped by `kaizo_playing`, never by `kaizo_atk`. `kaizo_atk` is the pointer
// to the NEXT entry and it transitions ON the launch frame; `kaizo_playing` is
// the mod's own `kaizo_prevatk`, the entry it records as having just fired.
// Trap #1 in knight-research/kaizo-mod/ORACLE-GROUND-TRUTH.md. Launch recovery
// is check-oracle-schedule's `recoverLaunches`, imported rather than re-written.
//
// ── THE SOUL IS PARKED, AND THAT IS AN ORACLE FACT ────────────────────────
//
// obj_roaringknight_slash and obj_knight_circle are created at the soul's
// CENTRE, so their position is only comparable if both souls are in the same
// place. The recording settles it: through the whole bullet phase of all four
// vortex turns the soul sits at exactly (310, 160) and never moves — which is
// `vcMoveheartDest`'s default, (growtangle.x - 10, growtangle.y - 10). The
// driver below parks the sim's soul at that same function's output and holds
// no input, and ASSERTS the recording really shows that, so the harness choice
// is itself checked rather than assumed.
//
// ── THE FALLING-SWORD COUNT ───────────────────────────────────────────────
//
// atk_Vortex1's type-108 arm rains swords whose cadence is
// `countdown = countdowner - irandom(1)` (kaizo swordfall Step_0, difficulty 0)
// over a fixed window, so the NUMBER that fits is a function of ~14 coin
// flips. The recording caught 17; this sim seed catches 16. That is not a
// divergence and this file does not treat it as one — it asserts instead:
//
//   * the deterministic parts: the Knight's own sword at manager+12 and the
//     first rain sword at manager+53, on both sides;
//   * THE CADENCE LAW — every rain-to-rain gap equals c or c-1, where c is the
//     deterministic ramp scr_approach(29, 5, 5) = 24, 19, 14, 9, 5, 5, ...
//     The recording's 14 gaps satisfy it and so must the sim's. A gap outside
//     {c, c-1} would mean the ramp or the jitter is wrong, which the raw count
//     could never distinguish;
//   * and it DEMONSTRATES the count is rolled, by re-running the sim on other
//     seeds and requiring the count to move while obj_sword_vortex's does not.
//     A quantity proven variable cannot be asserted equal; a quantity proven
//     constant can.
//
// ── THE TWO DIVERGENCES THIS FILE FOUND — BOTH FIXED 2026-08-29 ───────────
//
// Both were in the type-108 half of atk_Vortex1 — the first time any recording
// has reached a swordfall, since ac 10 is unreachable in the vanilla fight and
// that module has never had an oracle. Every assertion that caught them is
// still here and still compared; this check now exits 0 on the deep recording.
//
// D-1 — FIXED 2026-08-29, and the assertions that caught it are still here and
// still compared (they are now STRONGER; see the D-1 block below). The Knight's
// own falling sword (obj_knight_swordfall Alarm_0) used to spawn 75px too far
// right and 115px too high, because sim/attacks/swordfall.js — copied verbatim
// into kaizo/attacks/swordfall.js — had frozen GML's live `sprite_width * 0.5`
// into the constant 75 and dropped the `sprite_height * 0.5` term altogether.
// Both terms are live and both were wrong: by the time alarm 0 fires, alarm 5
// has lerped `image_xscale` to 0, so `sprite_width` is 0 and the x term
// vanishes, while `image_yscale` is untouched at 2 so `sprite_height * 0.5` is
// a full 115. Both files now derive the pair from the live scales, and both
// were edited together — correcting only the kaizo copy would have broken the
// "byte-identical to the sim module except for the mod's deltas" contract its
// own header states.
//
// D-2 — FIXED 2026-08-29, AND THE FIRST DIAGNOSIS OF IT WAS WRONG. The
// finalsword's `speed` on its creation frame read -6 in the mod and
// -3.5999999046 (= -6 + 2.4) in the sim. That was written up here as an ENGINE
// finding — CLAUDE.md's Known-unverified #2, "Mid-phase spawns": an instance
// spawned from an alarm must not run its own Step that frame. It is not. The
// same `with` block created obj_lerpvar instances on the same frame and they
// demonstrably DID write (image_yscale -0.25, image_angle +35.286), which no
// per-phase list freeze could allow. Both instances stepped.
//
// The real cause was one predicate in the swordfall module:
// `if (speed && finalsword) speed += 2.4` translated with JS truthiness
// instead of GML's. GameMaker converts a real to a bool with `> 0.5`, the same
// rule that makes `!alarm[0]` TRUE for an idle -1 — so a sword rearing back at
// -6 gets NO boost, and the sim was handing it one on frame one. Fixed in both
// swordfall modules; the assertion below is unchanged and now passes.
//
// The lesson is the one CLAUDE.md keeps recording: an engine-shaped
// explanation was reached for a divergence before the object's own predicate
// was re-read against the GML.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createState, stepFrame } from '../../../sim/index.js';
import { destroy } from '../../../sim/entity.js';
import { real } from '../../../sim/trace.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { VC_TABLE } from '../../versions/vc-script.js';
import {
  launchVCAttack, openVCArena, vcTurnLength, vcMoveheartDest, vcSelfEnding } from '../../scenes/kaizo-mod-launcher.js';
// resolveTraces / readTrace / recoverLaunches are check-oracle-schedule's, and
// they are IMPORTED rather than copied: the loud-skip paths, the empty-cell
// rule and the kaizo_playing attribution have each already cost a session, and
// a second implementation of them is a second place for those to rot.
import {
  resolveTraces, readTrace, recoverLaunches, detectRoute,
} from './check-oracle-schedule.mjs';

// ── the family ─────────────────────────────────────────────────────────────

const FAMILY = ['atk_Vortex1', 'atk_Vortex2', 'atk_Vortex3'];

/** Every object this family can create, from the mod's own arms. */
const FAMILY_OBJECTS = new Set([
  'obj_sword_vortex_manager', 'obj_sword_vortex', 'obj_fallingsword',
  'obj_knight_swordfall', 'obj_roaringknight_slash', 'obj_knight_circle',
  'obj_knight_rotating_slash',
]);

/**
 * Objects the sim creates that the recorder's watch list CANNOT contain, so
 * their absence from the recording is not evidence of anything. Spelled out
 * rather than filtered by a wildcard, because "the sim spawned something the
 * mod does not" is exactly what the set comparison is for.
 *
 *   obj_afterimage*   cosmetic, see the header
 *   obj_lerpvar       this engine's tween carrier; GML's obj_lerpvar is not
 *                     on the recorder's list either
 *   obj_growtangle / obj_heart / obj_knight_enemy / actor_party
 *                     the scene furniture the driver stands up, alive before
 *                     the launch and not created by it
 */
const SIM_ONLY = new Set([
  'obj_afterimage', 'obj_afterimage_fade_to_white', 'obj_lerpvar',
  'obj_growtangle', 'obj_heart', 'obj_knight_enemy', 'actor_party',
  'practice_director',
]);

const NONE = {
  left: 0, right: 0, up: 0, down: 0, focus: 0, confirm: 0, cancel: 0, button3: 0,
};

/**
 * The seed the deep recording was made with (ORACLE-GROUND-TRUTH.md, "MODE 0,
 * seed 20260810"). Used so the sim runs the same generator the mod ran — NOT
 * so any rolled value is expected to match: launchVCAttack re-anchors to
 * `seed + spawnn * 1000` per scr_bulletspawner call and the recording's turn 3
 * is thousands of draws downstream, so the streams are deliberately different.
 */
const SEED = 20260810;

// ── reporting ──────────────────────────────────────────────────────────────

const failures = [];
const notes = [];
let checks = 0;

/**
 * THE RECORDER'S OWN PRECISION, applied to BOTH sides before any compare.
 *
 * The GML side writes `string_format(value, 0, 10)`, so what reaches the CSV
 * is a ten-decimal rendering of an f32 built-in: obj_roaringknight_slash's
 * image_yscale arrives as 0.1000000015, while the sim holds the same bits as
 * 0.10000000149011612. Comparing the parsed numbers directly reports a
 * divergence that is nothing but the file format — CLAUDE.md's "Trace format"
 * rule, from the other direction.
 *
 * `real` is sim/trace.js's, NOT toFixed: GML rounds exact ties to EVEN and
 * toFixed rounds them away from zero, which is a real one-digit disagreement
 * (t6-splitter frame 133). Using the project's own formatter is also what
 * keeps this file honest if that ever changes.
 */
const q = (v) => (typeof v === 'number' && Number.isFinite(v) ? Number(real(v)) : v);
const qa = (a) => a.map(q);

function ok(cond, label) {
  checks += 1;
  if (!cond) failures.push(label);
  return cond;
}

function eq(got, want, label) {
  checks += 1;
  const g = Array.isArray(got) ? qa(got) : q(got);
  const w = Array.isArray(want) ? qa(want) : q(want);
  const same = Array.isArray(g) && Array.isArray(w)
    ? g.length === w.length && g.every((v, i) => Object.is(v, w[i]))
    : Object.is(g, w);
  if (!same) {
    failures.push(`${label} — oracle ${JSON.stringify(w)}, sim ${JSON.stringify(g)}`);
  }
  return same;
}

// ── the recording side ─────────────────────────────────────────────────────

/** `kaizo_oracle_trace_deep.csv` -> `kaizo_oracle_seq_deep.csv`. The recorder
 *  has used both `_trace_TAG` and `traceTAG`, so the swap is on the substring. */
function seqPathFor(tracePath) {
  const b = basename(tracePath);
  if (!b.includes('trace')) return null;
  return join(dirname(tracePath), b.replace('trace', 'seq'));
}

function readSeq(path) {
  const text = readFileSync(path, 'utf8').replace(/\r/g, '').trimEnd();
  const lines = text.split('\n');
  const header = lines[0].split(',');
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const num = (r, n) => {
    const i = col[n];
    if (i === undefined) return null;
    const v = r[i];
    // '' and 0 are different states — the same rule check-oracle-schedule's
    // num() exists for.
    if (v === undefined || v === '') return null;
    const f = Number(v);
    return Number.isFinite(f) ? f : null;
  };
  const rows = lines.slice(1).filter((l) => l.length).map((l) => l.split(','))
    .map((r) => ({
      frame: num(r, 'frame'),
      object: r[col.object],
      x: num(r, 'x'),
      y: num(r, 'y'),
      angle: num(r, 'angle'),
      xscale: num(r, 'xscale'),
      yscale: num(r, 'yscale'),
      direction: num(r, 'direction'),
      speed: num(r, 'speed'),
      playing: col.kaizo_playing === undefined ? '' : (r[col.kaizo_playing] ?? ''),
    }));
  return { header, col, rows };
}

/**
 * One launch's spawn ledger, as the recording has it.
 *
 * The window is [launch, nextLaunch) and rows are matched on `kaizo_playing`
 * as well, so a row cannot be dragged in from a neighbouring turn by an
 * off-by-one in the window.
 */
function oracleLedger(seq, launch, endFrame) {
  const rows = seq.rows.filter(
    (r) => r.playing === launch.played && r.frame >= launch.frame && r.frame < endFrame,
  );
  const mgr = rows.find((r) => r.object === 'obj_sword_vortex_manager');
  const byType = new Map();
  for (const r of rows) {
    if (!FAMILY_OBJECTS.has(r.object)) continue;
    if (!byType.has(r.object)) byType.set(r.object, []);
    byType.get(r.object).push(r);
  }
  return {
    played: launch.played,
    launchFrame: launch.frame,
    endFrame,
    managerFrame: mgr ? mgr.frame : null,
    rows,
    byType,
  };
}

// ── the sim side ───────────────────────────────────────────────────────────

function rowById(id) {
  for (const p of Object.keys(VC_TABLE)) {
    for (const r of VC_TABLE[p]) if (r.id === id) return r;
  }
  return null;
}

/**
 * Drive one V-C row through the real launcher and log every entity the frame
 * it appears, which is the recorder's own convention: obj_time's Draw_0 runs
 * once per frame AFTER every Step and after the movement pass, so a spawn is
 * logged with one frame of built-in motion already applied. `note()` runs
 * after `stepFrame` for exactly that reason.
 *
 * `frames` is the window the RECORDING sets — the last family spawn it saw,
 * relative to the manager — so neither side's turn length enters the compare.
 */
function drive(id, frames, seed = SEED) {
  const row = rowById(id);
  const st = createState({ seed, traceBulletSlots: 0 });
  buildSingleAttackScene(st, { seed, attack: 'rotating-slash', difficulty: 0 });
  // The single-attack drill's own director would relaunch on its own clock.
  const dir = st.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  st.kaizo = {
    version: 'C', sideb: false, approx: [], launched: [], vars: {}, hooks: {},
  };
  // The recorder pins party and boss HP; damage is out of scope either way.
  st.damageEnabled = false;

  openVCArena(st, row, { sideb: false });
  // The mod raises the board under mnfight 1.5 and spawns the attack twelve
  // frames later under mnfight 2 (`rtimer == 12`) — CLAUDE.md, "The turn's
  // real buffers". The board is still GROWING at the launch, in the mod as
  // here, and every geometry read below uses gt.x/gt.y, which are final from
  // the moment openVCArena places them.
  for (let f = 0; f < 12; f++) stepFrame(st, NONE);

  const gt = st.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
  const dest = vcMoveheartDest(row, gt, st.view);
  st.soul.x = dest.x;
  st.soul.y = dest.y;

  const armed = vcTurnLength(row, { sideb: false });
  st.turntimer = armed;
  const before = st.turntimer;
  launchVCAttack(st, row, { sideb: false });

  const seen = new Set();
  const log = [];
  const note = (f) => {
    for (const e of st.entities) {
      if (seen.has(e.seq)) continue;
      seen.add(e.seq);
      log.push({
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
    }
  };
  note(0);
  const afterLaunch = st.turntimer;
  const soulSeen = new Set([`${st.soul.x},${st.soul.y}`]);
  for (let f = 1; f <= frames; f++) {
    stepFrame(st, NONE);
    note(f);
    soulSeen.add(`${st.soul.x},${st.soul.y}`);
  }

  const byType = new Map();
  for (const r of log) {
    if (!byType.has(r.object)) byType.set(r.object, []);
    byType.get(r.object).push(r);
  }
  return {
    st, row, log, byType, gt, dest, armed, before, afterLaunch, soulSeen,
  };
}

// ── the comparison ─────────────────────────────────────────────────────────

const rel = (rows, anchor) => rows.map((r) => r.frame - anchor);
// Deduped at the RECORDER'S precision, so "one distinct value" means one value
// as the CSV could have expressed it, not one f64 bit pattern.
const uniq = (rows, k) => [...new Set(rows.map((r) => q(r[k])))];

/**
 * The deterministic countdowner ramp for difficulty 0:
 *   countdowner = scr_approach(countdowner, 5, 5)  from 29
 * evaluated once per volley, and `countdown = countdowner - irandom(1)`.
 */
function rainRamp(n) {
  const out = [];
  let c = 29;
  for (let i = 0; i < n; i++) {
    c = c > 5 ? Math.max(5, c - 5) : 5;
    out.push(c);
  }
  return out;
}

/**
 * spr_roaringknight_idle, unscaled, from BOTH sprite tables
 * (kaizo/assets/sprites/manifest.json and assets/sprites/manifest.json agree
 * at 117x115). GML's `sprite_width` / `sprite_height` are these times the live
 * image scales.
 */
const KNIGHT_IDLE_SPRITE_W = 117;
const KNIGHT_IDLE_SPRITE_H = 115;

/** `scr_lerpvar("x", x, x + 110, 8, 1, "out")` — obj_knight_swordfall Alarm_5:2. */
const ALARM5_SLIDE = 110;

/**
 * Where obj_knight_swordfall's Alarm_0 puts his own sword, as the RECORDER
 * would log it: the GML expression evaluated against a manager row, plus the
 * one frame of built-in motion every Draw-time row carries.
 *
 * Everything live in it comes from the row itself — `mgr.yscale` is read, not
 * assumed — except the two facts alarm 5 establishes and which the manager row
 * (logged 12 frames earlier, before alarm 5 runs) therefore cannot show:
 * `image_xscale` has reached 0 and `x` has slid +110. Alarm 5 arms
 * `alarm[0] = 8` and its two tweens are 8 frames long, so both have landed.
 *
 * f32 at every store, because x/y/image_* are built-ins (CLAUDE.md, "Float32
 * built-ins"). That is not decoration here: it is the whole reason the four
 * recorded launches do not share one dy.
 */
function predictKnightSword(mgr) {
  const f32 = Math.fround;
  const xAtAlarm0 = f32(f32(mgr.x) + ALARM5_SLIDE);
  const spriteWidth = KNIGHT_IDLE_SPRITE_W * 0; // image_xscale, lerped to 0
  const spriteHeight = KNIGHT_IDLE_SPRITE_H * mgr.yscale; // untouched at 2
  const spawnX = f32(xAtAlarm0 + (spriteWidth * 0.5));
  const spawnY = f32((f32(mgr.y) + (spriteHeight * 0.5)) - 30);
  // One motion frame: speed -4, direction 90. vspeed is exactly +4 (the
  // runner's cardinal snap, sim/index.js runMotion); hspeed narrows to
  // nothing against a coordinate this large.
  return { x: spawnX, y: f32(spawnY + 4) };
}

/** Split a falling-sword list into the Knight's own / the rain / the final. */
function classifySwords(rows) {
  const knight = rows.filter((r) => r.angle === -90);
  const final = rows.filter((r) => r.yscale === -0.25);
  const rain = rows.filter((r) => r.angle !== -90 && r.yscale !== -0.25);
  return { knight, rain, final };
}

function compareEntry(o, s) {
  const tag = o.played;
  const oAnchor = o.managerFrame;

  // ── the object SET ───────────────────────────────────────────────────────
  const oSet = [...o.byType.keys()].sort();
  const sSet = [...s.byType.keys()].filter((n) => !SIM_ONLY.has(n)).sort();
  eq(sSet, oSet, `${tag}: object set`);
  // …and nothing outside the family universe, so an extra spawn is caught
  // rather than filtered away by the intersection above.
  const stray = sSet.filter((n) => !FAMILY_OBJECTS.has(n));
  ok(stray.length === 0,
    `${tag}: the sim created ${stray.join(', ')}, which is neither a family object`
    + ' nor a known sim-only object — the allowlist or the launch is wrong');

  for (const type of oSet) {
    const orows = o.byType.get(type) ?? [];
    const srows = s.byType.get(type) ?? [];

    // ── COUNT + CADENCE, for every type whose count is deterministic ───────
    // obj_fallingsword is the one exception and it has its own block below.
    if (type !== 'obj_fallingsword') {
      eq(srows.length, orows.length, `${tag}: ${type} count`);
      eq(rel(srows, 0), rel(orows, oAnchor),
        `${tag}: ${type} spawn frames (relative to the manager's own creation)`);
    }

    // ── GEOMETRY ─────────────────────────────────────────────────────────--
    switch (type) {
      case 'obj_sword_vortex_manager':
        // Parked at (growtangle.x, cameray()) from its creation frame — it is
        // a collidebullet in its own right and the whole-fight differ pairs
        // bullets by slot, so where it sits is load-bearing, not bookkeeping.
        eq(uniq(srows, 'x'), uniq(orows, 'x'), `${tag}: ${type} x`);
        eq(uniq(srows, 'y'), uniq(orows, 'y'), `${tag}: ${type} y`);
        break;

      case 'obj_sword_vortex':
        // The RING. setdirection[i] = (i odd ? 0 : 180) makes the six blades
        // strictly alternate across the centre at startinglen 80, and
        // image_angle = dir - 90. Nothing here is rolled: the manager takes a
        // choose() draw for the heading and then throws it away.
        eq(uniq(srows, 'x'), uniq(orows, 'x'), `${tag}: ${type} spawn x (centre +/- startinglen)`);
        eq(uniq(srows, 'y'), uniq(orows, 'y'), `${tag}: ${type} spawn y (the centre row)`);
        eq(srows.map((r) => r.angle), orows.map((r) => r.angle),
          `${tag}: ${type} image_angle, blade by blade`);
        eq(uniq(srows, 'xscale'), uniq(orows, 'xscale'), `${tag}: ${type} image_xscale`);
        eq(uniq(srows, 'yscale'), uniq(orows, 'yscale'), `${tag}: ${type} image_yscale`);
        eq(uniq(srows, 'speed'), uniq(orows, 'speed'), `${tag}: ${type} speed`);
        break;

      case 'obj_roaringknight_slash':
      case 'obj_knight_circle':
        // Created at the soul's centre. Comparable only because both souls are
        // parked at vcMoveheartDest — asserted in the S-block below.
        eq(uniq(srows, 'x'), uniq(orows, 'x'), `${tag}: ${type} x (the fan centre)`);
        eq(uniq(srows, 'y'), uniq(orows, 'y'), `${tag}: ${type} y (the fan centre)`);
        if (type === 'obj_roaringknight_slash') {
          // The blade itself: 2 wide, 0.1 tall. CLAUDE.md's contact study says
          // an axis-aligned mask under 1px never registers and a tilted one
          // always does, so this pair IS the hitbox.
          eq(uniq(srows, 'xscale'), uniq(orows, 'xscale'), `${tag}: ${type} image_xscale`);
          eq(uniq(srows, 'yscale'), uniq(orows, 'yscale'), `${tag}: ${type} image_yscale`);
          // The fan ANGLES are ds_list_shuffle'd (CLAUDE.md: measured, not
          // solved) so they are not compared — but the count that carries them
          // was, above.
        }
        break;

      case 'obj_knight_swordfall':
      case 'obj_knight_rotating_slash':
        // Created at the Knight. His x is fixed; his y is the hover phase and
        // is a function of the absolute frame, so only x is comparable.
        eq(uniq(srows, 'x'), uniq(orows, 'x'), `${tag}: ${type} x (the Knight's column)`);
        notes.push(`${tag}: ${type} y — oracle ${orows.map((r) => r.y).join(', ')},`
          + ` sim ${srows.map((r) => r.y).join(', ')}; the Knight's hover phase,`
          + ' a function of the absolute frame and NOT comparable');
        break;

      default:
        break;
    }
  }

  // ── obj_fallingsword — atk_Vortex1's type-108 arm ────────────────────────
  if (o.byType.has('obj_fallingsword')) {
    const O = classifySwords(o.byType.get('obj_fallingsword'));
    const S = classifySwords(s.byType.get('obj_fallingsword') ?? []);

    ok(O.knight.length === 1 && S.knight.length === 1,
      `${tag}: exactly one sword at image_angle -90 (the Knight's own, Alarm_0)`
      + ` — oracle ${O.knight.length}, sim ${S.knight.length}`);
    ok(O.final.length === 1 && S.final.length === 1,
      `${tag}: exactly one sword at image_yscale -0.25 (the finalsword, Alarm_1 d0)`
      + ` — oracle ${O.final.length}, sim ${S.final.length}`);
    ok(O.rain.length > 5 && S.rain.length > 5,
      `${tag}: the rain ran on both sides — oracle ${O.rain.length}, sim ${S.rain.length}`);

    // The deterministic frames.
    if (O.knight.length && S.knight.length) {
      eq(S.knight[0].frame, O.knight[0].frame - oAnchor,
        `${tag}: the Knight's own sword drops at manager+N`);
    }
    if (O.rain.length && S.rain.length) {
      eq(S.rain[0].frame, O.rain[0].frame - oAnchor,
        `${tag}: the first rain sword falls at manager+N`);
    }

    // ── D-1: THE KNIGHT'S OWN SWORD'S OFFSET FROM HIS ARM ─────────────────
    //
    // GML (obj_knight_swordfall Alarm_0:1), BOTH TERMS LIVE:
    //     instance_create(x + (sprite_width * 0.5),
    //                     (y + (sprite_height * 0.5)) - 30, obj_fallingsword)
    //
    // By the time alarm 0 fires, alarm 5 has run its two 8-frame tweens —
    // image_xscale to 0 and x to x + 110 — so `sprite_width` is 0 and the x
    // term VANISHES, while image_yscale is untouched at 2 and
    // sprite_height * 0.5 is a full 115 (spr_roaringknight_idle is 117x115 in
    // the mod's own sprite table, kaizo/assets/sprites/manifest.json, and in
    // the vanilla one — the mod replaces the image, not the size).
    //
    // WHAT IS ASSERTED, AND WHY IT IS NOT A CROSS-SIDE dx/dy PAIR ANY MORE.
    // This block used to compare the sim's (sword - manager) offset against
    // the recording's, and that comparison was wrong in a way the recording
    // itself exposes once a second route is available. The four launches now
    // on disk are:
    //     deep  atk_Vortex1   mgr (425, 83.8656005859) sword (535, 172.8656005859)
    //     deep  atk_Frenzy2B  mgr (425, 71.0049285889) sword (535, 160.0049285889)
    //     sideb atk_Vortex1   mgr (425, 84.0428771973) sword (535, 173.0428771973)
    //     sideb atk_Frenzy2B  mgr (425, 74.9304122925) sword (535, 163.9304199219)
    // dx is +110 every time, but dy is 89 on three of them and 89.0000076294
    // on the fourth — one f32 ulp, because `y` is a built-in that narrows on
    // store and its ulp DOUBLES as the sum crosses 128. So dy is a function of
    // where in his hover the Knight happened to be, and his y is the one
    // quantity this file already declares NOT comparable (see the header). An
    // exact cross-side dy equality asserts the recorder's hover phase, not the
    // mod's arithmetic.
    //
    // The replacement is strictly STRONGER, not looser: evaluate the GML
    // expression on EACH side's own manager row and require it to reproduce
    // that side's own sword row bit-for-bit. The oracle is held to the model
    // too — `predictKnightSword` reproduces all four launches above exactly,
    // including the ulp on the fourth — so the model cannot be satisfied by a
    // sim that merely got a difference right by luck. The original bug was off
    // by 75 and 115 and fails this just as loudly.
    //
    // The +4 in y is the one frame of built-in motion the recorder's
    // Draw-time log always includes (speed -4 along direction 90); the sim's
    // log is taken at the same point and carries the same +4. In x the same
    // frame contributes nothing: cos(90 deg) narrows to 0 against a coordinate
    // of 535.
    if (O.knight.length && S.knight.length) {
      const oMgr = o.byType.get('obj_knight_swordfall')[0];
      const sMgr = s.byType.get('obj_knight_swordfall')[0];
      const oWant = predictKnightSword(oMgr);
      const sWant = predictKnightSword(sMgr);
      eq(q(O.knight[0].x), q(oWant.x),
        `${tag}: ORACLE control — the recording's own sword x is not`
        + " `manager.x + 110 + sprite_width*0.5` with sprite_width 0");
      eq(q(O.knight[0].y), q(oWant.y),
        `${tag}: ORACLE control — the recording's own sword y is not`
        + ' `(manager.y + sprite_height*0.5) - 30` plus one frame of motion');
      eq(q(S.knight[0].x), q(sWant.x),
        `${tag}: the Knight's own sword x, from HIS OWN arm at alarm 0`);
      eq(q(S.knight[0].y), q(sWant.y),
        `${tag}: the Knight's own sword y, from HIS OWN arm at alarm 0`);
      // dx stays a cross-side equality because it IS bit-stable: both
      // managers sit at x 425, the slide is a literal 110, and the sprite_width
      // term is exactly zero. This is the crisp statement that the x term
      // vanished, and it is what the frozen `+75` failed at 185 vs 110.
      eq(q(S.knight[0].x) - q(sMgr.x), q(O.knight[0].x) - q(oMgr.x),
        `${tag}: the Knight's own sword, x offset from his arm`);
    }

    // ── D-2: WHAT HAS ALREADY HAPPENED TO A SWORD ON ITS CREATION FRAME ───
    //
    // Both sides log at the SAME observation point — the recorder lives in
    // obj_time's Draw_0, which the patch's own comment says "runs once per
    // frame AFTER every Step", and `note()` below runs after stepFrame — so
    // the state a spawn carries in its row is directly comparable.
    //
    // The recording says three things about the finalsword's first row, and
    // they do not all point the same way:
    //   * it MOVED. y is 4 past its creation value (speed -4 along
    //     direction 90), so the built-in movement pass ran.
    //   * its LERPS ran. image_angle is 274.9741210938 while `direction`,
    //     assigned once at create, is 239.6880 — a gap of 35.28 =
    //     360 * sin(pi/32), exactly one write of
    //     scr_lerpvar("image_angle", ia, ia + 360, 16, 1, "out").
    //   * its own STEP did NOT run. `speed` is still the -6 Alarm_1 assigned:
    //     neither the scr_approach ramp nor the finalsword's `speed += 2.4`
    //     (kaizo fallingsword Step_0:43-52) has touched it.
    //
    // THE FIRST READING OF THOSE THREE FACTS WAS WRONG, AND THE THIRD IS WHY.
    // They were taken together as "the mod's swords have not run their own
    // Step on the frame they are born, and the sim's have" — CLAUDE.md's
    // Known-unverified #2, "Mid-phase spawns", so an ENGINE question about
    // sim/entity.js's per-phase list rebuild. But the second fact refutes the
    // first: obj_lerpvar was created by the same `with` block on the same
    // frame and it wrote, so the frame's Step pass did reach instances born in
    // the alarm. Both stepped. Nothing about the engine had to change.
    //
    // What was actually wrong was one predicate in the swordfall module.
    // `if (speed && finalsword) speed += 2.4` is GML truthiness, which is
    // `speed > 0.5` — the same rule that makes `!alarm[0]` TRUE for an idle
    // -1 — so a sword still rearing back at -6 gets no boost. The sim
    // translated it with JS truthiness and boosted on frame one. Fixed in
    // sim/attacks/swordfall.js and kaizo/attacks/swordfall.js together; this
    // assertion is unchanged and now passes.
    //
    // It stays an assertion rather than a note because both sides are measured
    // at the same point and the quantity is not rolled: declining to assert it
    // would be loosening the comparison to make the file pass.
    if (O.final.length && S.final.length) {
      eq(S.final[0].speed, O.final[0].speed,
        `${tag}: the finalsword's speed as logged on its creation frame`);
    }

    // ── THE CADENCE LAW, asserted on BOTH sides ───────────────────────────
    const gapsOf = (rows) => rows.slice(1).map((r, i) => r.frame - rows[i].frame);
    for (const [side, rows] of [['oracle', O.rain], ['sim', S.rain]]) {
      const gaps = gapsOf(rows);
      const ramp = rainRamp(gaps.length);
      const bad = gaps
        .map((g, i) => (g === ramp[i] || g === ramp[i] - 1 ? null : `#${i} ${g} (ramp ${ramp[i]})`))
        .filter(Boolean);
      ok(bad.length === 0,
        `${tag}: ${side} rain cadence — ${bad.join(', ')} outside {c, c-1} for the`
        + ' scr_approach(29, 5, 5) ramp');
    }

    // The rain's own shape: 1 wide, 0 tall (the yscale wobble starts at 0),
    // rearing back at -4.
    for (const [side, rows] of [['oracle', O.rain], ['sim', S.rain]]) {
      ok(rows.every((r) => r.xscale === 1 && r.yscale === 0 && r.speed === -4),
        `${tag}: ${side} rain swords are not all (xscale 1, yscale 0, speed -4)`);
      // The aim target is clamped to the sword's own column +/- 20 (kaizo
      // swordfall Step_0:137-138 — 40 in vanilla v105), and the sword falls
      // from box.y - 110 + random(30) toward box.y + 110, so the drop is at
      // least 190px and the aim can never be more than atan(20/190) off
      // straight down. That bound is the mod's arithmetic, not a tolerance
      // fitted to these rows.
      const lim = Math.atan2(20, 190) * (180 / Math.PI);
      const wild = rows.filter((r) => Math.abs(r.angle - 270) > lim);
      ok(wild.length === 0,
        `${tag}: ${side} rain aim outside 270 +/- ${lim.toFixed(4)} deg:`
        + ` ${wild.map((r) => r.angle).join(', ')}`);
    }

    notes.push(`${tag}: obj_fallingsword count — oracle ${o.byType.get('obj_fallingsword').length},`
      + ` sim ${(s.byType.get('obj_fallingsword') ?? []).length}. NOT ASSERTED either way:`
      + ' the rain cadence is `countdowner - irandom(1)` per volley, so how many fit the'
      + ' window is ~14 coin flips. Agreement here is luck and disagreement is not a'
      + ' divergence; the cadence law above is the comparable quantity.');
  }
}

// ── main ───────────────────────────────────────────────────────────────────

function main() {
  const explicit = process.argv[2];
  let path = explicit;

  if (!path) {
    const { dir, found, looked } = resolveTraces();
    if (!dir) {
      // A LOUD SKIP, NEVER A SILENT PASS — check-oracle-schedule's convention,
      // and for the same reason: a green kaizo gate with no oracle line in it
      // means nothing was held against the real mod on this machine.
      console.log('SKIP check-oracle-vortex: no kaizo oracle recording found');
      for (const l of looked) console.log(`     looked in ${l}`);
      console.log('     Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,');
      console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
      console.log('     THE SWORD VORTEX FAMILY IS THEN HELD AGAINST NOTHING.');
      return 0;
    }
    // The LONGEST recording, same rule as check-oracle-schedule: MODE 1 locks
    // are short and replay one entry, so length is the crude but correct proxy
    // for "walked furthest along the chain".
    path = found
      .map((f) => join(dir, f))
      .map((p) => ({ p, n: readFileSync(p, 'utf8').length }))
      .sort((a, b) => b.n - a.n)[0].p;
  }

  const seqPath = seqPathFor(path);
  if (!seqPath || !existsSync(seqPath)) {
    console.log('SKIP check-oracle-vortex: the trace is here but its SPAWN LOG is not');
    console.log(`     trace: ${path}`);
    console.log(`     wanted: ${seqPath ?? '(could not derive a seq name)'}`);
    console.log('     This check diffs SPAWN LEDGERS, so the per-frame trace alone');
    console.log('     cannot feed it. Re-record; the recorder writes both files.');
    return 0;
  }

  const t = readTrace(path);
  if (t.col.kaizo_playing === undefined) {
    console.log('SKIP check-oracle-vortex: this recording predates the kaizo_playing column');
    console.log(`     ${path}`);
    console.log('     Per-attack work MUST be grouped by kaizo_playing — kaizo_atk is the');
    console.log('     pointer to the NEXT entry and transitions on the launch frame');
    console.log('     (ORACLE-GROUND-TRUTH.md, trap #1). Re-record to get the column.');
    return 0;
  }

  const seq = readSeq(seqPath);
  const launches = recoverLaunches(t);
  for (let i = 0; i < launches.length; i++) {
    launches[i].endFrame = i + 1 < launches.length ? launches[i + 1].frame : Infinity;
  }
  const mine = launches.filter((L) => FAMILY.includes(L.played));

  console.log(`check-oracle-vortex: ${path}`);
  console.log(`  spawn log: ${seqPath}`);
  console.log(`  ${t.rows.length} frames, ${launches.length} launch(es),`
    + ` ${mine.length} of them in the SWORD VORTEX family`);

  // ── WHICH ROUTE IS THIS, AND CAN THIS FILE READ IT? ──────────────────────
  //
  // The driver below is hardcoded to route C: `openVCArena(..., { sideb: false })`,
  // `launchVCAttack(..., { sideb: false })`, `st.kaizo.version = 'C'`. Held
  // against a B-SIDE recording it therefore compares route D's mod against
  // route C's sim, and every difference it reports is the instrument rather
  // than a divergence. Measured, not assumed: on kaizo_oracle_trace_sideb.csv
  // it produced thirteen "failures", and ORACLE-GROUND-TRUTH.md's own content
  // census explains all of them — the B-Side gives atk_Vortex1 26 falling
  // swords against 17 and atk_Vortex2 65 obj_roaringknight_slash against 22.
  // That is more content, not a wrong sim.
  //
  // So a B-Side recording is a LOUD SKIP, the same rule this file already
  // applies to an unanchorable ledger: a negative result is only evidence if
  // the instrument could have produced a positive one.
  //
  // MAKING IT REAL is a threading job plus a content job, and the content job
  // is the larger half: pass the detected route through `drive()` into
  // openVCArena / launchVCAttack / st.kaizo, and then the sim's kaizo
  // sword-vortex and rotating-slash modules have to grow the B-Side branches
  // that produce those extra spawns. Threading alone would only move the
  // failures, so it is deliberately NOT done here.
  const det = detectRoute(launches);
  if (det.conflict) {
    console.log('\n  FAIL: the recording carries signatures of BOTH routes, which the mod');
    console.log('  cannot produce — the launch attribution is wrong, so nothing below');
    console.log(`  would mean anything. Evidence: ${det.evidence.join(', ')}`);
    return 1;
  }
  if (det.route === 'D') {
    console.log('\n  SKIP — this is a B-SIDE (route D) recording'
      + ` (evidence: ${det.evidence.join(', ')}).`);
    console.log('     This file drives the sim on route C only. The B-Side is not a');
    console.log('     difficulty tweak, it is more content: atk_Vortex1 rains 26 falling');
    console.log('     swords against route C\'s 17 and atk_Vortex2 throws 65');
    console.log('     obj_roaringknight_slash against 22, so every count and cadence below');
    console.log('     would report the ROUTE, not the sim.');
    console.log('     THE SWORD VORTEX FAMILY IS NOT CHECKED AGAINST THIS RECORDING.');
    return 0;
  }
  if (!det.route) {
    console.log('  route AMBIGUOUS — no atk_RisingAbyssB / atk_Swords1 / atk_Quickslash'
      + ' launch to tell them apart; checking against route C, which the other 28'
      + ' entries share.');
  }

  if (mine.length === 0) {
    console.log('  SKIP — this recording contains no atk_Vortex1/2/3 launch.');
    console.log('     A MODE 1 (attack-lock) recording of another entry legitimately');
    console.log('     does not, and a short MODE 0 one may not have reached ac 2 yet.');
    console.log('     NOTHING ABOUT THE SWORD VORTEX FAMILY IS CHECKED HERE.');
    return 0;
  }

  // ── the ledger, printed whether or not it passes ──────────────────────────
  const ledgers = mine.map((L) => oracleLedger(seq, L, L.endFrame));
  console.log('\n  THE ORACLE SPAWN LEDGER (grouped by kaizo_playing; frames relative');
  console.log('  to the manager\'s own creation frame, which is launch + 1):');
  for (const o of ledgers) {
    console.log(`    ${o.played}  launch f${o.launchFrame}..f${o.endFrame}`
      + `  manager f${o.managerFrame}`);
    for (const [type, rows] of [...o.byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const r = rel(rows, o.managerFrame);
      const show = r.length > 26 ? `${r.slice(0, 26).join(',')},…` : r.join(',');
      console.log(`      ${type.padEnd(26)} x${String(rows.length).padStart(3)}  @ ${show}`);
    }
  }

  // ── AN UNANCHORABLE LEDGER IS AN INSTRUMENT GAP, NOT A DIVERGENCE ────────
  //
  // Every relative frame below is measured from obj_sword_vortex_manager, so a
  // recording with no manager row cannot be compared at all. That is exactly
  // what the pre-2026-08-29 recordings look like: the recorder resolved a
  // hardcoded list of object names and the MANAGERS were not on it, so
  // `_schedule`'s atk_Vortex1 logged one lonely obj_knight_swordfall and
  // atk_Vortex2 logged no vortex at all (ORACLE-GROUND-TRUTH.md, "A BLANK ROW
  // MEANT THE RECORDER WAS NOT WATCHING").
  //
  // Reporting that as a FAILURE would blame the sim for the instrument, which
  // is the one mistake this whole method exists to avoid: a negative result is
  // only evidence if the instrument could have produced a positive one. So it
  // is a LOUD SKIP — visible, exit 0, and it names the fix.
  const unanchored = ledgers.filter((o) => o.managerFrame === null);
  if (unanchored.length) {
    console.log('\n  SKIP — this recording\'s spawn log has no obj_sword_vortex_manager for'
      + ` ${unanchored.map((o) => o.played).join(', ')}.`);
    console.log('     The recorder resolves a hardcoded list of object names and the MANAGERS');
    console.log('     were added to it on 2026-08-29; before that every attack whose work');
    console.log('     happens inside one recorded as (nearly) empty. This is the INSTRUMENT,');
    console.log('     not the mod and not the sim — re-record with the current recorder.');
    console.log('     THE SWORD VORTEX FAMILY IS NOT CHECKED AGAINST THIS RECORDING.');
    return 0;
  }

  // ── S: the soul really is parked where the driver parks it ───────────────
  //
  // Asserted BEFORE anything reads a soul-relative position, because if it
  // fails, every obj_roaringknight_slash / obj_knight_circle comparison below
  // is measuring the recorder's input rather than the mod.
  const tf = t.col.frame;
  const sx = t.col.soul_x;
  const sy = t.col.soul_y;
  for (const o of ledgers) {
    // THE WINDOW IS THE COMPARISON'S WINDOW, not the whole inter-launch gap.
    // `kaizo_playing` keeps naming this entry after its bullet phase ends, and
    // the NEXT turn's obj_moveheart delivers the soul to its own board inside
    // that tail — atk_PierceBlades' board is at x 210, so the soul reads
    // (200, 160) there. Those rows are after every spawn this file compares
    // and belong to the next entry's setup; including them measured the wrong
    // turn.
    const lastF = Math.max(...[...o.byType.values()].flat().map((r) => r.frame));
    const seen = new Set();
    for (const r of t.rows) {
      const f = Number(r[tf]);
      if (f < o.launchFrame || f > lastF) continue;
      if (r[sx] === '' || r[sx] === undefined) continue; // between turns: no soul
      const v = `${Number(r[sx])},${Number(r[sy])}`;
      if (v !== '0,0') seen.add(v);
    }
    ok(seen.size === 1 && seen.has('310,160'),
      `${o.played}: the recording's soul is not parked at (310,160) across f${o.launchFrame}`
      + `..f${lastF} — saw ${[...seen].join(' | ')}.`
      + ' The fan-centre comparisons below assume it.');
  }

  // ── drive the sim, once per entry ────────────────────────────────────────
  const runs = new Map();
  for (const id of new Set(ledgers.map((o) => o.played))) {
    const o = ledgers.find((L) => L.played === id);
    // The window comes from the RECORDING: one frame past its last family
    // spawn. Neither side's turn length is involved.
    const last = Math.max(...[...o.byType.values()].flat().map((r) => r.frame));
    const frames = (last - o.managerFrame) + 2;
    runs.set(id, drive(id, frames));
  }

  console.log('\n  THE SIM SPAWN LEDGER (same anchor: the manager is created at 0):');
  for (const [id, s] of runs) {
    console.log(`    ${id}  ac ${s.row.ac} d ${s.row.difficulty} p ${s.row.phase}`
      + `  vcTurnLength ${s.armed}  soul parked at (${s.dest.x},${s.dest.y})`);
    for (const [type, rows] of [...s.byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
      if (SIM_ONLY.has(type)) continue;
      const r = rows.map((x) => x.frame);
      const show = r.length > 26 ? `${r.slice(0, 26).join(',')},…` : r.join(',');
      console.log(`      ${type.padEnd(26)} x${String(rows.length).padStart(3)}  @ ${show}`);
    }
  }

  // POSITIVE EXECUTION — "the comparison ran and agreed" must be
  // distinguishable from "the comparison never ran". A suite of equalities
  // between two empty ledgers is perfectly green.
  const totalOracleRows = ledgers.reduce((n, o) => n + [...o.byType.values()].flat().length, 0);
  ok(totalOracleRows >= 60,
    `only ${totalOracleRows} family spawn rows recovered from the recording —`
    + ' too few for the comparison to mean anything');
  for (const [id, s] of runs) {
    const n = [...s.byType.entries()]
      .filter(([k]) => FAMILY_OBJECTS.has(k))
      .reduce((a, [, v]) => a + v.length, 0);
    ok(n >= 8, `${id}: the sim produced only ${n} family spawns — the launch did not run`);
    ok(s.st.counters.motionSteps > 0, `${id}: no motion steps counted — nothing moved`);
    ok(s.soulSeen.size === 1,
      `${id}: the sim's soul moved during the turn (${[...s.soulSeen].join(' | ')});`
      + ' the recording holds it still, so the fan-centre compares would be invalid');
  }

  // ── the per-entry diffs ──────────────────────────────────────────────────
  for (const o of ledgers) compareEntry(o, runs.get(o.played));

  // ── the two atk_Vortex2 launches agree with each other ───────────────────
  //
  // The deep recording walks the loop, so atk_Vortex2 fires twice, ~6500
  // frames apart. Their ledgers being identical is the recording telling us,
  // on its own, which of these quantities are deterministic — the strongest
  // evidence available that the equalities above are not one-off coincidences.
  const v2 = ledgers.filter((o) => o.played === 'atk_Vortex2');
  if (v2.length >= 2) {
    for (const type of FAMILY_OBJECTS) {
      const a = v2[0].byType.get(type);
      const b = v2[1].byType.get(type);
      if (!a || !b) continue;
      eq(rel(b, v2[1].managerFrame), rel(a, v2[0].managerFrame),
        `atk_Vortex2 x2: the recording's own two launches disagree on ${type} cadence`);
    }
  } else {
    notes.push('atk_Vortex2 fired once in this recording, so its internal-consistency'
      + ' cross-check (the loop replays it) did not run.');
  }

  // ── T: THE TURN CLOCK — type 108 assigns global.turntimer = 600 ──────────
  //
  // The question this file was asked to settle. Three separate facts, and the
  // third is the one that makes 600 an ASSIGNMENT rather than a floor.
  const v1 = ledgers.find((o) => o.played === 'atk_Vortex1');
  if (v1) {
    const tt = t.col.turntimer;
    const i0 = t.rows.findIndex((r) => Number(r[tf]) === v1.launchFrame);
    const atLaunch = Number(t.rows[i0][tt]);
    const atNext = Number(t.rows[i0 + 1][tt]);
    // (1) the dispatch floor the knight armed: scr_turntimer(350), already
    //     ticked once by the battle controller when the row is written.
    eq(atLaunch, vcTurnLength(rowById('atk_Vortex1'), { sideb: false }) - 1,
      'atk_Vortex1: the armed dispatch floor at the launch frame');
    // (2) and the very next frame — the dbulletcontroller's first Step —
    //     the mod overwrites it with 600.
    ok(atNext === 600,
      `atk_Vortex1: the mod set turntimer ${atNext} one frame after launch, not 600`
      + ' (dbulletcontroller Step_0:2283, type == 108)');
    // (3) the sim models it, and models it as the assignment it is: the
    //     launcher's case 108 stamps 600 over the 350 floor.
    const s1 = runs.get('atk_Vortex1');
    ok(s1.before === 350,
      `atk_Vortex1: the sim's pre-launch floor is ${s1.before}, not the 350 the`
      + ' <100 table arms — the control for the assertion below is broken');
    ok(s1.afterLaunch === 600,
      `atk_Vortex1: the sim's turntimer after launch is ${s1.afterLaunch}, not 600`);
    // …and it is not a scr_turntimer FLOOR: a higher clock is stamped DOWN.
    const probe = drive('atk_Vortex1', 1);
    probe.st.turntimer = 9999;
    launchVCAttack(probe.st, rowById('atk_Vortex1'), { sideb: false });
    ok(probe.st.turntimer === 600,
      `atk_Vortex1: with the clock at 9999 the sim launched to ${probe.st.turntimer};`
      + ' GML `global.turntimer = 600` is an assignment, not a floor');
  }

  // Vortex2/3 hand the clock to the rotating slash instead — the recording
  // shows 999999 one frame in, and vcTurnLength says so too.
  for (const o of ledgers.filter((L) => L.played !== 'atk_Vortex1')) {
    const tt = t.col.turntimer;
    const i0 = t.rows.findIndex((r) => Number(r[tf]) === o.launchFrame);
    ok(Number(t.rows[i0 + 1][tt]) === 999999,
      `${o.played}: the mod did not pin turntimer at 999999 one frame after launch`
      + ` (saw ${Number(t.rows[i0 + 1][tt])})`);
    // vcTurnLength answers the arm's floor; the 999999 one frame in (asserted
    // above from the recording) is the attack object's pin -- vcSelfEnding.
    ok(vcSelfEnding(rowById(o.played), { sideb: false }),
      `${o.played}: vcSelfEnding does not model this turn as self-ending`);
  }

  // ── R: WHICH COUNTS ARE ROLLED, DEMONSTRATED RATHER THAN ASSUMED ─────────
  //
  // The falling-sword count is not asserted anywhere above. This is why: it
  // MOVES with the seed while the vortex ring does not. Without this block a
  // reader could not tell a deliberately-unasserted quantity from a forgotten
  // one, and the "17 vs 16" line in the notes would read like an excuse.
  if (v1) {
    // A SWEEP, not a hand-picked pair. Seeds 1..12 plus the recording's own,
    // driven long enough (250 frames) for the whole rain to land, so the
    // result cannot be an artifact of a window that truncates it.
    const seeds = [SEED, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const swords = [];
    const rings = [];
    for (const seed of seeds) {
      const r = drive('atk_Vortex1', 250, seed);
      swords.push((r.byType.get('obj_fallingsword') ?? []).length);
      rings.push((r.byType.get('obj_sword_vortex') ?? []).length);
    }
    ok(new Set(swords).size > 1,
      `obj_fallingsword count is ${swords.join('/')} across ${seeds.length} seeds — it did`
      + ' NOT move, so the reason this file gives for not asserting it is wrong');
    ok(new Set(rings).size === 1 && rings[0] === 6,
      `obj_sword_vortex count is ${rings.join('/')} across ${seeds.length} seeds — the ring`
      + ' is supposed to be a deterministic 6, and the cadence equality above assumes it');
    ok(swords.includes(v1.byType.get('obj_fallingsword').length),
      `the recording's obj_fallingsword count (${v1.byType.get('obj_fallingsword').length})`
      + ` is outside everything the sim produces across ${seeds.length} seeds`
      + ` (${[...new Set(swords)].sort().join(', ')}) — that would be a real divergence,`
      + ' not a roll');
    notes.push(`RNG demonstration over ${seeds.length} seeds: obj_fallingsword takes`
      + ` {${[...new Set(swords)].sort().join(', ')}} (the recording caught`
      + ` ${v1.byType.get('obj_fallingsword').length}), obj_sword_vortex is`
      + ` ${rings[0]} every time.`);
  }

  // ── report ───────────────────────────────────────────────────────────────
  console.log('');
  for (const n of notes) console.log(`  NOTE: ${n}`);

  if (failures.length) {
    console.log(`\n  ${failures.length} FAILURE(S) of ${checks} assertions:`);
    for (const f of failures) console.log(`    - ${f}`);
    console.log('\n  A failure here is a claim about the SIM, not about the recording.');
    console.log('  Read the D-1 and D-2 blocks in this file\'s header before touching');
    console.log('  anything — both record a divergence this check found AND how the');
    console.log('  first explanation of one of them turned out to be wrong.');
    return 1;
  }

  console.log(`\n  ${checks} assertions against the real mod   OK`);
  console.log('  (object sets, deterministic counts, spawn cadence relative to the');
  console.log('   manager, structural spawn geometry, and the type-108 turntimer');
  console.log('   assignment — NOT frame numbers, NOT rolled values, NOT damage.)');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
