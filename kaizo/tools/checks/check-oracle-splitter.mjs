#!/usr/bin/env node
// THE BOX SPLITTER, HELD AGAINST THE REAL MOD.
//
//   node kaizo/tools/checks/check-oracle-splitter.mjs [seq.csv]
//
// V-C recreation of EnderCat8's "Kaizo Roaring Knight" v2.3.3 — PRIVATE.
// This file describes another author's creative work; do not publish or
// commit it without permission (kaizo/HANDOFF.md 5-C).
//
// check-oracle-schedule proved the fight SELECTS the right things in the
// right order and raises the right board. It says nothing about what happens
// on that board. This is the next rung for ONE family: the three box-splitter
// turns, held against the SPAWN LOG of a real run.
//
//   atk_Splitter1   ac 109  ->  dc.type 99, dc.difficulty 3   (phase 1)
//   atk_Splitter2   ac   2  ->  dc.type 99, dc.difficulty 2   (phase 2, and
//                                the loop replays it)
//   atk_Splitter3   ac 108  ->  dc.type 99, dc.difficulty 5   (phase 3)
//
// (The SCHEDULE difficulty on the row — 2 / 1 / 0 — is not the dispatch
// difficulty. obj_knight_enemy Other_23 hardcodes 3 / 2 / 5 inside each ac
// branch, and every branch below keys on the DISPATCH value.)
//
// == WHAT IS CLAIMED =======================================================
//
// Only quantities that are structural rather than sampled from a stream:
//
//   * the SET of objects each turn creates, and the singletons in it (one
//     manager at the knight's x, one organism, exactly two flame markers at
//     the organism's own fixed offsets)
//   * TEETH PER SPLIT — 13 / 13 / 28. This is the family's difficulty curve
//     and the single most checkable number it has: bullet_count is 13 at
//     Create and difficulty 5 raises it to 14 and runs the loop TWICE
//     (split_growtangle Step_0 8-13, 124-140).
//   * the SHAPE of each split: which of the mod's four spawn geometries it
//     is, the ladder the teeth sit on, and the fixed angles/scales/speeds.
//     The d5 Y ladder is compared VALUE FOR VALUE against the recording —
//     seven f32 numbers, no tolerance.
//   * the CADENCE FLOOR: the shortest gap between consecutive slashes must
//     be exactly `spawn_speed` (39 / 31 / 53, boxsplitter Step_0 4-33).
//
// == WHAT IS NOT CLAIMED, AND WHY ==========================================
//
//   * ABSOLUTE FRAMES. The recording's turn length comes from its own
//     pulsed-confirm input; this driver's comes from a fixed frame budget.
//     Everything below is a gap, a count, or a position.
//
//   * ANY RNG DRAW. The mod's live stream is re-anchored per launch on both
//     sides (CLAUDE.md, "LIVE RNG IS RE-ANCHORED PER ATTACK LAUNCH"), so the
//     per-cut `angleoffset = random_range(-2, 2)` tilt, the `choose(-2,-1,1,2)`
//     tooth weights, the `irandom(1)` vertical/diagonal rolls and the
//     `random_range(-0.12, 0.12)` top-speed jitter are all different numbers
//     on the two sides BY DESIGN. What is asserted is the SHAPE those draws
//     can produce, and the bounds the mod's own literals put on them.
//
//   * DAMAGE, HP, TP OR TARGETING. The recorder pins them.
//
//   * THE NUMBER OF SPLITS IN A TURN, directly. It is contact-dependent: a
//     connected slash sets `obj_knight_split_growtangle.split_delay = 5`
//     (splitslash Other_15) and rewinds the manager's clock (splitslash
//     Step_0 177-183), so the recording's own two launches of atk_Splitter2
//     produced 10 splits and 9. This driver runs with `state.replayContacts`
//     — the existing suppress-computed-contacts switch — so the sim walks the
//     UNPERTURBED cadence, and it is held against the recorded launch of the
//     same entry with the MOST splits. That is the unperturbed one: every
//     contact path in the mod delays a cycle and none can add one.
//
// == THE ATTRIBUTION RULE ==================================================
//
// Rows are grouped by `kaizo_playing`, never `kaizo_atk`. kaizo_atk is the
// pointer to the NEXT entry and flips ON the launch frame; kaizo_playing is
// the mod's own record of what just fired. Grouping by the pointer attributes
// every turn's spawns to the following entry. See check-oracle-schedule's
// header for what that cost when it was got wrong.
//
// == POSITIVE EXECUTION ASSERTIONS =========================================
//
// "The comparison agreed" must be distinguishable from "the comparison never
// ran", so this file asserts, as ordinary checks:
//
//   * all three entries were FOUND in the recording (a family that never
//     played is a skip, not a pass)
//   * the recorder was WATCHING all six object types — a per-type row count
//     over the family's own frames. A negative result is only evidence if the
//     instrument could have produced a positive one; that is exactly how
//     atk_DiamondStorm once read as "the attack does nothing".
//   * the sim actually spawned teeth, and `state.kaizo.approx` is EMPTY for
//     each launch — proof the launcher ran the mod's real difficulty branch
//     rather than clamping to a translated neighbour and ledgering it.
//
// == WHAT IT FOUND, AND WHAT FIXED IT ======================================
//
// This file EXITS 0 as written, on all 430 assertions — the whole tooth ledger
// agrees, 104 / 130 / 224 to the bullet, and the difficulty-5 Y ladder agrees
// to the last f32 bit. It found FOUR things, ALL FOUR NOW FIXED, and none of
// the four was ever a reason to loosen anything above. Each was confirmed by
// reproducing the proposed fix from OUTSIDE the module and re-measuring, and
// then by the fix itself landing and the assertion turning green with the
// comparison still made rather than removed.
//
//  1. FIXED. THE ORGANISM'S SCALE IS `undefined`. The recording pins
//     obj_knight_split_growtangle and its cut effect at 2 x 2; the sim leaves
//     both unset, because the Create translates
//     `image_xscale = obj_growtangle.image_xscale` as `gt.xscale` — a field
//     obj_growtangle does not have (sim/battlebox.js deliberately keeps ONE
//     scale pair, the built-ins). The f32 accessor stores a non-number
//     unchanged, so nothing throws and the value silently becomes NaN at the
//     first `+ N`. This is CLAUDE.md's "OBJECT DEFINITION holds more than the
//     sprite" hazard landing on the scale instead of the depth.
//     FIX: `gt.image_xscale` / `gt.image_yscale`, at BOTH sites —
//     kaizo/attacks/flurry-split-growtangle.js and the vanilla twin
//     sim/attacks/split-growtangle.js. Confirmed: the cut effect then carries
//     2 x 2.
//
//  2. FIXED. THE CUT-FACE FLASH FIRED ONCE A TURN, NOT ONCE A SPLIT. The
//     recording has one obj_knight_split_growtangle_effect per splitslash —
//     8 / 10 / 8. The sim had 1, because of an `&& !e.effectSpawned` latch that
//     the GML does not have: kaizo Step_0 37-47 (v105 Step_0 12-24) is a bare
//     `if (timer <= 1)` inside `if (con == 1)`, with no flag anywhere in the
//     object. `timer <= 1` is already once per con==1 re-entry — splitslash
//     re-arms `con = 1; timer = 0` on every cut (kaizo Step_0 113-114, v105
//     98-99) — and the effect destroys itself after 10 frames (sim/fx.js), so
//     there was never anything to stack. The latch was silently deleting every
//     flash after the first of the turn.
//     FIXED 2026-08-29: the latch is gone from both sites,
//     kaizo/attacks/flurry-split-growtangle.js and the vanilla twin
//     sim/attacks/split-growtangle.js, each with a comment naming the GML line
//     and this measured count so it cannot be "tidied" back in. The three
//     effect-count assertions now pass at exactly 8 / 10 / 8, and the vanilla
//     row-exact suites are unmoved: `node tools/verify-splitter.mjs` (190
//     frames, all columns) and `node tools/verify-splitter-difficulty.mjs`
//     (2226 comparisons x2) both still exit 0.
//
//  3. FIXED. AN ANGLE BUILT-IN IS WRAPPED BEFORE
//     IT IS NARROWED. GameMaker stores
//     `direction` as f32 and THEN wraps to [0, 360). The diagonal fan is the
//     case that tells them apart: `_direction += 360/13` thirteen times gives
//     359.99999999999989 in f64, which f32 rounds to exactly 360 — so the mod
//     records direction 0 and image_angle 360 ON THE SAME ROW. sim/entity.js
//     wraps in f64 first, where 359.99999999999989 is below 360 and survives
//     the modulo, and only then narrows it back up to 360.
//     FIXED in sim/entity.js's ANGLE_BUILTINS normaliser, which narrows first —
//     `(v) => { const f = Math.fround(v); return Math.fround(((f % 360) + 360) % 360); }`.
//     NOT LOCAL TO THIS FAMILY: that same
//     comment cites obj_tracking_swords_manager's anti-repeat wheel, which
//     compares a fresh `direction` against eight remembered ones — a heading
//     that should read 0 and reads 360 is exactly the miss it warns about.
//
//  4. FIXED. THE SLASHMARKER WAS NOT MODELLED. The
//     recording logs one obj_marker per
//     splitslash (`scr_dark_marker`, splitslash Step_0 7) on top of the
//     organism's two flames — 10 / 12 / 10 markers where the sim had 2. Both
//     splitslash modules used to document this as a deliberate visual-only
//     omission; the recording is what made it a countable number rather than
//     a note, and it was left failing rather than excluded precisely because
//     "we chose not to model it" is a decision to re-take with the count in
//     view. RE-TAKEN 2026-08-29: it is modelled.
//     FIXED in sim/attacks/splitslash.js — the VANILLA module, because
//     `slashmarker = scr_dark_marker(x, y, spr_rk_quickslash_upper)` is line 7
//     of the v105 Step_0 as well as of the kaizo one, and a diff of the two
//     entries shows the mod changes nothing about it. The object type and a
//     line-for-line `scrDarkMarker` helper live there and
//     kaizo/attacks/flurry-splitslash.js imports them rather than copying.
//     It is created in the `!init` block at the SLASH's own (x, y) —
//     classifyMarkers() below tells the slashmarker apart from the organism's
//     two flames by position, and a marker placed on one of the flames'
//     offsets would be miscounted — at image_xscale/yscale 2 with
//     `depth = obj_growtangle.depth + 50` and `image_alpha = 0`, taking the
//     slash's UNTILTED image_angle once (Step_0 30 / kaizo 37) and thereafter
//     copying the slash's position, frame, blend and alpha every step
//     (Step_0 40-51). CleanUp_0's `safe_delete(slashmarker)` is carried at both
//     sites that destroy the slash, so nothing accumulates: peak live
//     obj_marker per turn is 1-2 and 0 survive the turn.
//     COSTS NO RNG. obj_marker has NO code entries anywhere in the dump (only
//     the derived `_jitter` / `_wobble` / `_animateOnce` / `_blendmode` /
//     `_palette` variants do), and scr_dark_marker is four assignments around
//     an instance_create — so nothing downstream of it in the stream moved.
//     check-oracle-stream, verify-splitter (190 frames, all columns) and
//     verify-splitter-difficulty (2226 comparisons x2) all still exit 0.
//
// All four are in. Nothing here was relaxed to get there — the three
// slashmarker assertions still compare 8 / 10 / 8 against the recording, and
// dropping every second obj_marker row from a COPY of the recording still
// turns this file red on exactly those assertions.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox, settleBox } from '../../../sim/battlebox.js';
import { gmlCreate } from '../../../sim/rng.js';
import { VC_TABLE } from '../../versions/vc-script.js';
import { launchVCAttack, openVCArena, arenaGeom } from '../../scenes/kaizo-mod-launcher.js';
// The trace-directory resolver, imported rather than re-declared: a check that
// hardcodes its own copy of the search path is how a LOUD SKIP once fired with
// nine recordings sitting one directory away.
import { resolveTraces } from './check-oracle-schedule.mjs';

// ── the family ─────────────────────────────────────────────────────────────
//
// `dcDifficulty` is obj_knight_enemy Other_23's own literal for that ac, and
// `spawnSpeed` is the boxsplitter's `!init` branch for that dispatch
// difficulty (Step_0 4-33). Both are READ FROM THE MOD, and both are what the
// assertions below key on — nothing here is derived from the sim.
const FAMILY = [
  {
    id: 'atk_Splitter1', ac: 109, dcDifficulty: 3, spawnSpeed: 39, perSplit: 13,
  },
  {
    id: 'atk_Splitter2', ac: 2, dcDifficulty: 2, spawnSpeed: 31, perSplit: 13,
  },
  {
    id: 'atk_Splitter3', ac: 108, dcDifficulty: 5, spawnSpeed: 53, perSplit: 28,
  },
];

/** The objects the recorder watches for this family. */
const WATCHED = [
  'obj_roaringknight_boxsplitter_attack',
  'obj_roaringknight_splitslash',
  'obj_knight_split_growtangle',
  'obj_knight_split_growtangle_effect',
  'obj_roaringknight_split_bullet',
  'obj_marker',
];

// ── the mod's own literals, so the bounds below are cited, not chosen ──────
//
// splitslash Step_0 11: `angleoffset = random_range(-2, 2)`. Every non-B-Side
// cut is tilted by at most 2 degrees, which is the ONLY reason a tooth ladder
// is not exactly axis-aligned. It bounds both the ladder's span and how far
// the off-axis coordinate can wander:
//
//     span      = 144 * cos(offset)  in  [144*cos 2deg, 144]
//     off-axis  = +-(144/2) * sin(offset)
//
// split_growtangle Create 63: `bullet_range = 144`.
const CUT_RANGE = 144;
const MAX_TILT_DEG = 2;
const SPAN_MIN = CUT_RANGE * Math.cos((MAX_TILT_DEG * Math.PI) / 180);
const OFFAXIS_MAX = (CUT_RANGE / 2) * Math.sin((MAX_TILT_DEG * Math.PI) / 180);

const f32 = (v) => Math.fround(v);
const num = (s) => f32(Number(s));
const uniq = (xs) => [...new Set(xs)].sort((a, b) => a - b);
const key = (xs) => uniq(xs).map((v) => v.toFixed(6)).join(' ');

let checks = 0;
const failures = [];
const notes = [];
function ok(cond, msg) {
  checks += 1;
  if (!cond) failures.push(msg);
}

// ══ THE RECORDING ══════════════════════════════════════════════════════════

/** Parse a recorder SEQ csv (one row per spawn). */
function readSeq(path) {
  const text = readFileSync(path, 'utf8').replace(/\r/g, '').trimEnd();
  const lines = text.split('\n');
  const col = Object.fromEntries(lines[0].split(',').map((h, i) => [h, i]));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].length) continue;
    rows.push(lines[i].split(','));
  }
  return { header: lines[0].split(','), col, rows };
}

/**
 * One record per LAUNCH of a family entry: the contiguous run of rows whose
 * `kaizo_playing` names it. The seq file is frame-ordered and kaizo_playing
 * holds for the whole turn, so a run boundary IS a turn boundary — and the
 * mod's loop replays atk_Splitter2, which is why this returns a list rather
 * than a map.
 */
function recoverLaunches(seq, ids) {
  const want = new Set(ids);
  const out = [];
  let cur = null;
  for (const r of seq.rows) {
    const playing = r[seq.col.kaizo_playing] ?? '';
    if (!want.has(playing)) { cur = null; continue; }
    if (!cur || cur.id !== playing) {
      cur = { id: playing, rows: [] };
      out.push(cur);
    }
    cur.rows.push({
      frame: Number(r[seq.col.frame]),
      object: r[seq.col.object],
      x: num(r[seq.col.x]),
      y: num(r[seq.col.y]),
      angle: num(r[seq.col.angle]),
      xscale: num(r[seq.col.xscale]),
      yscale: num(r[seq.col.yscale]),
      direction: num(r[seq.col.direction]),
      speed: num(r[seq.col.speed]),
      ac: Number(r[seq.col.attackchoice]),
    });
  }
  for (const L of out) {
    L.f0 = L.rows[0].frame;
    L.byObject = new Map();
    for (const row of L.rows) {
      if (!L.byObject.has(row.object)) L.byObject.set(row.object, []);
      L.byObject.get(row.object).push(row);
    }
  }
  return out;
}

// ══ THE SIM ════════════════════════════════════════════════════════════════

const rowById = (() => {
  const m = new Map();
  for (const p of Object.keys(VC_TABLE)) for (const r of VC_TABLE[p]) m.set(r.id, r);
  return m;
})();

/**
 * Drive one V-C row through the mod launcher and collect every entity at the
 * frame it is CREATED.
 *
 * Contacts are suppressed (`state.replayContacts`, the switch the splitslash
 * modules already honour) — see the header: a connected slash perturbs the
 * cadence and the split delay, and the recording shows both. The sim walks the
 * unperturbed line so the structural numbers are not confounded.
 *
 * Identity, not `seq`, keys the "already seen" set. Keying on `seq` collapses
 * teeth from different splits onto one record and reports their positions
 * MANY frames after birth — the first draft of this file did exactly that and
 * produced tooth x values of -89 and +760 for a ladder that spans 248..392.
 */
function runSim(entry, { seed = 12345, frames = 560 } = {}) {
  const row = rowById.get(entry.id);
  const state = createState({ seed, traceBulletSlots: 0 });
  state.view = { x: 0, y: 0 };
  state.kaizo = { sideb: false };
  state.keepAlive = true;
  state.invTimer = -1;
  state.replayContacts = true;
  state.gmlRng = gmlCreate(seed);
  state.turntimer = 300;

  const gt = spawn(state, battlebox, { x: 320, y: 170 });
  openVCArena(state, row);
  // The board is raised twelve frames before the attack spawns and is at its
  // plateau by the time any tooth appears (the first cut is 30+ frames in), so
  // it is settled here rather than grown — the grow-in is check-oracle-
  // schedule's business, not this file's.
  settleBox(gt);
  state.soul = spawn(state, soul, { x: 310, y: 160 });
  const mg = launchVCAttack(state, row);

  const seen = new Set();
  const spawns = [];
  for (let f = 0; f < frames; f++) {
    stepFrame(state, {});
    for (const e of state.entities) {
      if (!e.alive || seen.has(e)) continue;
      seen.add(e);
      spawns.push({
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
    if (state.turntimer > 0) state.turntimer -= 1;
  }

  const byObject = new Map();
  for (const s of spawns) {
    if (!byObject.has(s.object)) byObject.set(s.object, []);
    byObject.get(s.object).push(s);
  }
  return { state, mg, gt, spawns, byObject };
}

// ══ THE SHARED VOCABULARY ══════════════════════════════════════════════════
//
// Both sides are reduced to the SAME record shape before anything is
// compared, so a rule cannot accidentally be applied to only one of them.

/** Teeth grouped by spawn frame — one split lands on exactly one frame. */
function toothGroups(rows) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.frame)) by.set(r.frame, []);
    by.get(r.frame).push(r);
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([frame, teeth]) => ({ frame, teeth }));
}

/**
 * Which of the mod's four spawn geometries a split is (split_growtangle
 * Step_0 159-175 and 217-232), from the teeth alone:
 *
 *   'diagonal'   every tooth at the organism's own (x, y); headings walk
 *                `_direction += 360 / bullet_count`.
 *   'ladderY'    difficulty 5's `_Ytype == 1` rung ladder: the Y set is much
 *                smaller than the tooth count.
 *   'horizontal' `vertical == false`: the teeth march along X, headings +-90.
 *   'vertical'   `vertical == true`:  the teeth march along Y, headings 0/180.
 *
 * THE MARCH AXIS IS THE ONE WITH THE LONG SPAN, not the one with more distinct
 * values. Every cut is tilted by `angleoffset`, so a vertical cut's thirteen
 * teeth have thirteen distinct x as well as thirteen distinct y — counting
 * distinct values calls it horizontal, and then the heading rule fails on
 * every vertical cut in the recording.
 */
function classify(teeth) {
  const xs = uniq(teeth.map((t) => t.x));
  const ys = uniq(teeth.map((t) => t.y));
  if (xs.length === 1 && ys.length === 1) return 'diagonal';
  if (ys.length * 2 <= teeth.length) return 'ladderY';
  const xspan = xs[xs.length - 1] - xs[0];
  const yspan = ys[ys.length - 1] - ys[0];
  return xspan >= yspan ? 'horizontal' : 'vertical';
}

/** The ladder's rung gaps, for a set of coordinates that should be uniform. */
function rungGaps(values) {
  const v = uniq(values);
  const gaps = [];
  for (let i = 1; i < v.length; i++) gaps.push(v[i] - v[i - 1]);
  return gaps;
}
const spread = (gaps) => (gaps.length ? Math.max(...gaps) - Math.min(...gaps) : 0);

/** A split reduced to the numbers that are comparable across the two sides. */
function describeSplit(g, box) {
  const kind = classify(g.teeth);
  const xs = uniq(g.teeth.map((t) => t.x));
  const ys = uniq(g.teeth.map((t) => t.y));
  const along = kind === 'horizontal' ? xs : ys;
  return {
    frame: g.frame,
    n: g.teeth.length,
    kind,
    xs,
    ys,
    span: along.length > 1 ? along[along.length - 1] - along[0] : 0,
    rungSpread: spread(rungGaps(along)),
    // The coordinate the cut does NOT march along. `angleoffset` is the only
    // thing that can move it off the box centre.
    offAxis: kind === 'horizontal'
      ? Math.max(...ys.map((y) => Math.abs(y - box.y)))
      : Math.max(...xs.map((x) => Math.abs(x - box.x))),
    directions: uniq(g.teeth.map((t) => t.direction)),
    angles: uniq(g.teeth.map((t) => t.angle)),
    xscales: uniq(g.teeth.map((t) => t.xscale)),
    yscales: uniq(g.teeth.map((t) => t.yscale)),
    speeds: uniq(g.teeth.map((t) => t.speed)),
  };
}

/** Consecutive gaps between the frames a list of rows was created on. */
function frameGaps(rows) {
  const fs = uniq(rows.map((r) => r.frame));
  const gaps = [];
  for (let i = 1; i < fs.length; i++) gaps.push(fs[i] - fs[i - 1]);
  return gaps;
}

/**
 * The two flame markers the organism's Create makes, told apart from the
 * per-slash `slashmarker` by POSITION: Create 20/28 puts them at
 * (x + 2, y - 1) and (x, y + 2), while scr_dark_marker puts a slashmarker at
 * the slash's own (x, y). The organism sits at the box centre, so the three
 * are separable with no ambiguity.
 */
function classifyMarkers(rows, box) {
  const flames = [];
  const slash = [];
  for (const r of rows) {
    const isA = r.x === box.x + 2 && r.y === box.y - 1;
    const isB = r.x === box.x && r.y === box.y + 2;
    if (isA || isB) flames.push({ ...r, which: isA ? 'A' : 'B' });
    else slash.push(r);
  }
  return { flames, slash };
}

// ══ MAIN ═══════════════════════════════════════════════════════════════════

/**
 * IS THIS RECORDING THE B-SIDE ROUTE? Read out of the mod, not guessed:
 * split_growtangle Step_0 183-187 is the ONLY place a tooth is born moving —
 *
 *     if (kaizo_sideb()) { _b.speed = 0.5; _tsp = [5, 3.35]; }
 *
 * — so a normal-route tooth is logged at speed exactly 0 and a B-Side one
 * never is. It matters twice over. The B-Side retunes this family outright
 * (spawn_speed 39 -> 37 at difficulty 3, `angleoffset` +-2 -> +-12), so
 * holding it against a normal-route sim launch compares two different
 * attacks; and because its teeth are already moving when the recorder writes
 * the row, its positions are NOT spawn geometry at all — the ladder spans
 * come out at 1.4px and 19.9px instead of 144.
 */
function isSidebSeq(text) {
  const re = /^[^,]*,obj_roaringknight_split_bullet,(?:[^,]*,){6}([^,]*),/gm;
  let m = re.exec(text);
  while (m) {
    if (Number(m[1]) !== 0) return true;
    m = re.exec(text);
  }
  return false;
}

function pickSeq(explicit) {
  if (explicit) return { path: explicit };
  const { dir, looked } = resolveTraces();
  if (!dir) return { path: null, looked };
  const found = readdirSync(dir).filter((f) => /^kaizo_oracle_seq.*\.csv$/.test(f));
  if (!found.length) return { path: null, looked: [dir], reason: 'no seq companion' };
  // THE ONE WITH THE MOST OF THIS FAMILY IN IT, not the longest and not the
  // last alphabetically. A MODE 1 (attack-lock) recording can be enormous and
  // contain no splitter turn at all; a short MODE 0 one can contain three.
  let best = null;
  let bestSideb = null;
  for (const f of found) {
    const path = join(dir, f);
    const text = readFileSync(path, 'utf8');
    let n = 0;
    for (const e of FAMILY) {
      const m = text.match(new RegExp(`,${e.id}$`, 'gm'));
      n += m ? m.length : 0;
    }
    if (n === 0) continue;
    const cand = { path, n };
    if (isSidebSeq(text)) {
      if (!bestSideb || n > bestSideb.n) bestSideb = cand;
    } else if (!best || n > best.n) best = cand;
  }
  if (best) return { path: best.path };
  if (bestSideb) {
    return {
      path: null,
      looked: [dir],
      reason: `the only recording holding this family (${bestSideb.path}) is a B-SIDE run`
        + ' — its teeth are born at speed 0.5 and are already moving when they are'
        + ' logged, and the route retunes spawn_speed and the cut tilt. This check'
        + ' compares the NORMAL route; a MODE 0 normal-route recording is needed.',
    };
  }
  return { path: null, looked: [dir], reason: 'no recording contains a Splitter turn' };
}

function main() {
  const picked = pickSeq(process.argv[2]);
  if (!picked.path) {
    // A LOUD SKIP, NEVER A SILENT PASS.
    console.log('SKIP check-oracle-splitter: no kaizo oracle spawn log for this family');
    for (const l of picked.looked ?? []) console.log(`     looked in ${l}`);
    if (picked.reason) console.log(`     (${picked.reason})`);
    console.log('     Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,');
    console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
    console.log('     NOTHING ABOUT THE BOX SPLITTER IS HELD AGAINST THE REAL MOD WITHOUT IT.');
    return 0;
  }

  const seq = readSeq(picked.path);
  for (const need of ['frame', 'object', 'x', 'y', 'angle', 'xscale', 'yscale', 'direction', 'speed', 'kaizo_playing']) {
    if (seq.col[need] === undefined) {
      console.log(`FAIL check-oracle-splitter: ${picked.path} has no "${need}" column`);
      console.log(`     columns present: ${seq.header.join(',')}`);
      return 1;
    }
  }

  const launches = recoverLaunches(seq, FAMILY.map((e) => e.id));
  console.log(`check-oracle-splitter: ${picked.path}`);
  console.log(`  ${seq.rows.length} spawn rows, ${launches.length} box-splitter launch(es) recovered via kaizo_playing`);

  if (!launches.length) {
    console.log('  DEGENERATE — the recording contains no box-splitter turn.');
    return 1;
  }

  // THE ROUTE. Read out of the data rather than off the filename — see
  // isSidebSeq. An explicitly-passed file skips the picker, so the guard is
  // repeated here where nothing can get past it.
  const moving = launches.flatMap((L) => (L.byObject.get('obj_roaringknight_split_bullet') ?? []))
    .filter((r) => r.speed !== 0);
  if (moving.length) {
    console.log('  REFUSING — this is a B-SIDE recording (teeth logged at speed'
      + ` ${uniq(moving.map((r) => r.speed)).join('/')}; split_growtangle Step_0 183-187`
      + ' gives a tooth speed 0.5 only under kaizo_sideb()).');
    console.log('  The B-Side retunes this family (spawn_speed 39 -> 37 at difficulty 3,');
    console.log('  the cut tilt +-2deg -> +-12deg) AND its teeth are already moving when');
    console.log('  they are logged, so its rows are not spawn geometry. Comparing them');
    console.log('  against a normal-route sim launch would compare two different attacks.');
    return 1;
  }

  // The board these turns are fought on. Which board each row raises is
  // check-oracle-schedule's business; it is read here so the geometry rules
  // below have a CHECKED centre rather than a hardcoded one.
  const geoms = FAMILY.map((e) => arenaGeom(rowById.get(e.id), false));
  const box = { x: geoms[0].x + geoms[0].dx, y: geoms[0].y + geoms[0].dy };
  ok(geoms.every((g) => g.x + g.dx === box.x && g.y + g.dy === box.y
    && g.xscale === 2 && g.yscale === 2),
    'the three box-splitter rows do not all raise the same 2x2 board, so the'
    + ' single centre the geometry rules below use is wrong'
    + ` (${geoms.map((g) => `${g.x + g.dx},${g.y + g.dy} ${g.xscale}x${g.yscale}`).join(' | ')})`);

  // ══ THE ORACLE LEDGER ════════════════════════════════════════════════════
  console.log('');
  console.log('  ── THE SPAWN LEDGER, MEASURED ──────────────────────────────');
  const oracle = new Map(); // id -> [launch summaries]
  for (const L of launches) {
    const entry = FAMILY.find((e) => e.id === L.id);
    const teeth = L.byObject.get('obj_roaringknight_split_bullet') ?? [];
    const groups = toothGroups(teeth).map((g) => describeSplit(g, box));
    const slashes = L.byObject.get('obj_roaringknight_splitslash') ?? [];
    const markers = classifyMarkers(L.byObject.get('obj_marker') ?? [], box);
    const summary = {
      id: L.id,
      f0: L.f0,
      ac: L.rows[0].ac,
      entry,
      groups,
      teeth: teeth.length,
      slashes,
      slashGaps: frameGaps(slashes),
      markers,
      organism: L.byObject.get('obj_knight_split_growtangle') ?? [],
      effects: L.byObject.get('obj_knight_split_growtangle_effect') ?? [],
      manager: L.byObject.get('obj_roaringknight_boxsplitter_attack') ?? [],
      byObject: L.byObject,
    };
    if (!oracle.has(L.id)) oracle.set(L.id, []);
    oracle.get(L.id).push(summary);

    console.log(`  ${L.id}  ac ${summary.ac}  f${L.f0}..${L.rows[L.rows.length - 1].frame}`);
    console.log(`    split_bullet x${teeth.length} = ${groups.length} split(s) x ${groups.length ? groups[0].n : 0}`
      + `   splitslash x${slashes.length}   growtangle x${summary.organism.length}`
      + `   effect x${summary.effects.length}`);
    console.log(`    marker x${markers.flames.length + markers.slash.length}`
      + ` (${markers.flames.length} flame + ${markers.slash.length} slashmarker)`
      + `   manager x${summary.manager.length}`
      + `${summary.manager.length ? ` at x ${summary.manager[0].x}` : ''}`);
    console.log(`    slash frames (rel) ${uniq(slashes.map((s) => s.frame - L.f0)).join(' ')}`);
    console.log(`    slash gaps ${summary.slashGaps.join(' ')}   (floor = spawn_speed ${entry.spawnSpeed})`);
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      console.log(`      split ${i} f+${g.frame - L.f0} n=${g.n} ${g.kind.padEnd(10)}`
        + ` span ${g.span.toFixed(4)} rung-spread ${g.rungSpread.toExponential(2)}`
        + ` off-axis ${g.offAxis.toFixed(4)}`
        + ` dir {${g.directions.map((v) => v.toFixed(4)).join(' ')}}`);
    }
  }
  console.log('  ────────────────────────────────────────────────────────────');
  console.log('');

  // ══ POSITIVE EXECUTION: the recorder was watching ════════════════════════
  //
  // A negative result is only evidence if the instrument could have produced
  // a positive one.
  for (const e of FAMILY) {
    ok(oracle.has(e.id),
      `${e.id}: the recording contains no launch of this entry — the comparison`
      + ' for it did not run (re-record with a larger -Frames budget)');
  }
  for (const objName of WATCHED) {
    const total = launches.reduce((n, L) => n + (L.byObject.get(objName)?.length ?? 0), 0);
    ok(total > 0,
      `the recorder logged ZERO ${objName} across every box-splitter turn —`
      + ' the instrument was not watching it, so its absence from the sim'
      + ' comparison proves nothing');
  }

  // ══ THE RECORDING SETS THE BOUNDS ════════════════════════════════════════
  //
  // No invented tolerance. The tooth positions are f32 built-ins, so a ladder
  // that is uniform in exact arithmetic is not uniform to the last bit once
  // stored. Rather than pick a number, take the WIDEST rung-spread the real
  // mod itself produced and hold the sim to that.
  let ladderBound = 0;
  let ladderWitness = null;
  for (const [, list] of oracle) {
    for (const L of list) {
      for (let i = 0; i < L.groups.length; i++) {
        if (L.groups[i].kind === 'diagonal') continue;
        if (L.groups[i].rungSpread > ladderBound) {
          ladderBound = L.groups[i].rungSpread;
          ladderWitness = `${L.id} f${L.f0} split ${i}`;
        }
      }
    }
  }
  console.log(`  ladder-uniformity bound ${ladderBound.toExponential(3)} px,`
    + ` set by ${ladderWitness} (the widest rung spread the MOD itself produced)`);

  // ══ THE COMPARISON ═══════════════════════════════════════════════════════
  let simGroupsCompared = 0;
  let oracleGroupsCompared = 0;

  for (const entry of FAMILY) {
    const recorded = oracle.get(entry.id);
    if (!recorded) continue;
    const sim = runSim(entry);
    const simTeeth = sim.byObject.get('obj_roaringknight_split_bullet') ?? [];
    const simGroups = toothGroups(simTeeth).map((g) => describeSplit(g, box));
    const simSlashes = sim.byObject.get('obj_roaringknight_splitslash') ?? [];
    const simMarkers = classifyMarkers(
      [...(sim.byObject.get('obj_marker') ?? []), ...(sim.byObject.get('obj_marker_splitflame') ?? [])],
      box,
    );
    const simOrganism = sim.byObject.get('obj_knight_split_growtangle') ?? [];
    const simEffects = sim.byObject.get('obj_knight_split_growtangle_effect') ?? [];
    const simManager = sim.byObject.get('obj_roaringknight_boxsplitter_attack') ?? [];

    // The unperturbed recorded launch: contacts only ever DELAY a cycle, so
    // the launch with the most splits is the one the suppressed-contact sim is
    // comparable with. (See the header.)
    const ref = recorded.reduce((a, b) => (b.teeth > a.teeth ? b : a));
    const others = recorded.filter((r) => r !== ref);
    for (const o of others) {
      if (o.teeth !== ref.teeth) {
        notes.push(`${entry.id}: the recording holds ${recorded.length} launches with`
          + ` ${recorded.map((r) => r.teeth).join('/')} teeth — a connected slash rewinds the`
          + ' manager clock (splitslash Other_15 / Step_0 177), so the fullest one is'
          + ' the unperturbed line and is what the sim is held against');
      }
    }

    console.log(`\n  ${entry.id} — ac ${entry.ac}, dc.difficulty ${entry.dcDifficulty}`);
    console.log(`    oracle  ${ref.teeth} teeth = ${ref.groups.length} x ${ref.groups[0]?.n}`
      + `   sim  ${simTeeth.length} teeth = ${simGroups.length} x ${simGroups[0]?.n}`);

    // ── the launcher ran the mod's own branch, not a clamp ────────────────
    ok((sim.state.kaizo.approx ?? []).length === 0,
      `${entry.id}: the launcher LEDGERED an approximation`
      + ` (${JSON.stringify(sim.state.kaizo.approx)}) — the sim did not run dc.difficulty`
      + ` ${entry.dcDifficulty} and nothing below is a comparison with the mod`);
    ok(sim.mg && sim.mg.difficulty === entry.dcDifficulty,
      `${entry.id}: the manager was armed at difficulty ${sim.mg && sim.mg.difficulty},`
      + ` not the ${entry.dcDifficulty} Other_23 hardcodes for ac ${entry.ac}`);
    ok(sim.mg && sim.mg.spawn_speed === entry.spawnSpeed,
      `${entry.id}: spawn_speed ${sim.mg && sim.mg.spawn_speed} after init,`
      + ` want ${entry.spawnSpeed} (boxsplitter Step_0 4-33)`);
    // The board the sim actually raised, so the geometry rules are measured
    // against the same arena the recording was.
    ok(sim.gt.x === box.x && sim.gt.y === box.y
      && sim.gt.image_xscale === 2 && sim.gt.image_yscale === 2,
      `${entry.id}: the sim's arena is (${sim.gt.x}, ${sim.gt.y})`
      + ` ${sim.gt.image_xscale}x${sim.gt.image_yscale}, not the`
      + ` (${box.x}, ${box.y}) 2x2 the geometry rules assume`);

    // ── the object set ────────────────────────────────────────────────────
    ok(simTeeth.length > 0 && simGroups.length > 0,
      `${entry.id}: the SIM produced no teeth at all — the comparison below never ran`);
    ok(simManager.length === 1 && ref.manager.length === 1,
      `${entry.id}: manager count — oracle ${ref.manager.length}, sim ${simManager.length}; the mod makes exactly one`);
    ok(simOrganism.length === 1 && ref.organism.length === 1,
      `${entry.id}: split_growtangle count — oracle ${ref.organism.length}, sim ${simOrganism.length};`
      + ' the mod makes exactly one per turn (splitslash Step_0 93 guards on i_ex)');
    if (simManager.length && ref.manager.length) {
      ok(simManager[0].x === ref.manager[0].x,
        `${entry.id}: the manager spawns at the knight's x — oracle ${ref.manager[0].x},`
        + ` sim ${simManager[0].x}`);
    }

    // ── TEETH PER SPLIT: the family's difficulty curve ────────────────────
    const oracleN = uniq(ref.groups.map((g) => g.n));
    const simN = uniq(simGroups.map((g) => g.n));
    ok(oracleN.length === 1 && oracleN[0] === entry.perSplit,
      `${entry.id}: the RECORDING's splits are not a uniform ${entry.perSplit} teeth`
      + ` (${oracleN.join('/')}) — the ledger above is not what this file assumed`);
    ok(simN.length === 1 && simN[0] === entry.perSplit,
      `${entry.id}: teeth per split — oracle ${oracleN.join('/')}, sim ${simN.join('/')};`
      + ` bullet_count ${entry.dcDifficulty === 5 ? '14 x 2 waves' : '13 x 1 wave'}`);
    ok(simGroups.length === ref.groups.length,
      `${entry.id}: splits in the turn — oracle ${ref.groups.length}, sim ${simGroups.length}`
      + ` (contacts suppressed on the sim side; the oracle reference launch is f${ref.f0})`);
    ok(simTeeth.length === ref.teeth,
      `${entry.id}: TOTAL TEETH — oracle ${ref.teeth}, sim ${simTeeth.length}`);

    // ── the cadence floor ─────────────────────────────────────────────────
    const oracleFloor = Math.min(...ref.slashGaps);
    const simFloor = Math.min(...frameGaps(simSlashes));
    ok(ref.slashGaps.length > 0 && oracleFloor === entry.spawnSpeed,
      `${entry.id}: the RECORDING's shortest slash gap is ${oracleFloor}, not the`
      + ` spawn_speed ${entry.spawnSpeed} the mod's !init branch sets`);
    ok(simFloor === entry.spawnSpeed,
      `${entry.id}: slash cadence floor — oracle ${oracleFloor}, sim ${simFloor}`);
    ok(frameGaps(simSlashes).every((g) => g === entry.spawnSpeed
      || g === entry.spawnSpeed + 4),
      `${entry.id}: with contacts suppressed every sim gap must be spawn_speed`
      + ` (${entry.spawnSpeed}) or spawn_speed+4 (the difficulty-3 diagonal's`
      + ` \`timer = -4\`), got {${uniq(frameGaps(simSlashes)).join(' ')}}`);

    // ── the flame markers ─────────────────────────────────────────────────
    ok(ref.markers.flames.length === 2,
      `${entry.id}: the recording shows ${ref.markers.flames.length} flame markers, not 2`);
    ok(simMarkers.flames.length === 2,
      `${entry.id}: flame markers — oracle ${ref.markers.flames.length}, sim ${simMarkers.flames.length}`
      + ' (split_growtangle Create 20/28 makes exactly two)');
    if (ref.markers.flames.length === 2 && simMarkers.flames.length === 2) {
      const shape = (ms) => ms.map((m) => `${m.which}:${m.x},${m.y},${m.angle},${m.xscale}x${m.yscale}`)
        .sort().join(' | ');
      ok(shape(ref.markers.flames) === shape(simMarkers.flames),
        `${entry.id}: flame marker geometry — oracle [${shape(ref.markers.flames)}],`
        + ` sim [${shape(simMarkers.flames)}]`);
    }
    // The per-slash slashmarker: the recording has one per slash, and both sim
    // modules now create it (scr_dark_marker at splitslash Step_0 7, identical
    // in v105 and the mod). The 1:1 rule is asserted on the RECORDING first, so
    // a run where it does not hold is reported rather than quietly reclassified.
    ok(ref.markers.slash.length === ref.slashes.length,
      `${entry.id}: the recording shows ${ref.markers.slash.length} slashmarkers for`
      + ` ${ref.slashes.length} slashes — the 1:1 rule this file classifies by does not hold`);
    ok(simMarkers.slash.length === ref.markers.slash.length,
      `${entry.id}: slashmarker (obj_marker) count — oracle ${ref.markers.slash.length}`
      + ` (one per splitslash, scr_dark_marker at splitslash Step_0 7), sim`
      + ` ${simMarkers.slash.length}. It is created in the \`!init\` block at the`
      + " SLASH's own (x, y); a marker parked on one of the organism's two flame"
      + ' offsets would be classified as a flame and this count would stay at 0');

    // ── the cut-face effect: one per SPLIT ────────────────────────────────
    ok(ref.effects.length === ref.slashes.length,
      `${entry.id}: the recording shows ${ref.effects.length} cut effects for`
      + ` ${ref.slashes.length} slashes — the one-per-split rule does not hold in the mod`);
    ok(simEffects.length === ref.effects.length,
      `${entry.id}: split_growtangle_effect count — oracle ${ref.effects.length}`
      + ` (one per split: Step_0 37-47 runs on every con==1 re-entry, and the`
      + ` effect destroys itself after 10 frames so nothing can stack), sim`
      + ` ${simEffects.length}`);

    // ── the organism and its effect carry the BOX's scale ─────────────────
    //
    // split_growtangle Create 2-3 and effect Create 3-4 both read
    // `obj_growtangle.image_xscale`. The recording pins 2 x 2 on both.
    for (const [name, oRows, sRows] of [
      ['obj_knight_split_growtangle', ref.organism, simOrganism],
      ['obj_knight_split_growtangle_effect', ref.effects, simEffects],
    ]) {
      if (!oRows.length || !sRows.length) continue;
      ok(oRows[0].xscale === 2 && oRows[0].yscale === 2,
        `${entry.id}: the recording's ${name} is not 2x2 (${oRows[0].xscale}x${oRows[0].yscale})`);
      ok(sRows[0].xscale === oRows[0].xscale && sRows[0].yscale === oRows[0].yscale,
        `${entry.id}: ${name} scale — oracle ${oRows[0].xscale}x${oRows[0].yscale},`
        + ` sim ${sRows[0].xscale}x${sRows[0].yscale}`);
    }

    // ── THE SPLITS, SHAPE BY SHAPE ────────────────────────────────────────
    //
    // Which cycles are horizontal / vertical / diagonal is an `irandom(1)`
    // per cycle and the stream is re-anchored per launch, so the SEQUENCE is
    // not comparable. What is comparable is that every shape the recording
    // produced obeys the mod's rule, and that every shape the sim produced
    // obeys the SAME rule — and that the shapes the two sides produce are
    // drawn from the same set.
    const rules = (side, g, label) => {
      ok(g.xscales.length === 1 && g.xscales[0] === 2
        && g.yscales.length === 1 && g.yscales[0] === 2,
        `${label}: teeth spawn at image scale 2x2 (Step_0 178-179), got`
        + ` ${g.xscales.join('/')} x ${g.yscales.join('/')} (${side})`);
      ok(g.speeds.length === 1 && g.speeds[0] === 0,
        `${label}: teeth spawn at speed 0 (Step_0 181; the d5 ladder lerps up`
        + ` from 0 over 5 frames), got {${g.speeds.join(' ')}} (${side})`);
      if (g.kind === 'diagonal') {
        // `_direction += (360 / bullet_count)` runs BEFORE each assignment, so
        // the headings are the running sum for k = 1..13 — reproduced by
        // accumulation, not by a multiply, because the two disagree in f64 and
        // the last term is where it shows.
        const acc = [];
        let d = 0;
        for (let k = 0; k < g.n; k++) { d += 360 / g.n; acc.push(f32(d)); }
        ok(key(g.angles) === key(acc),
          `${label}: the diagonal fan's image_angle set is`
          + ` {${g.angles.map((v) => v.toFixed(4)).join(' ')}}, want the`
          + ` \`_direction += 360/${g.n}\` walk {${uniq(acc).map((v) => v.toFixed(4)).join(' ')}} (${side})`);
        // `direction` is a GML BUILT-IN: GameMaker narrows it to f32 and THEN
        // wraps to [0, 360). The 13th heading accumulates to
        // 359.99999999999989, which f32 rounds to exactly 360 — so the mod
        // stores 0. Wrapping in f64 first leaves 359.99999999999989, which f32
        // then rounds back up to 360, and the wrap never happens.
        const wrapped = uniq(acc.map((v) => f32(((v % 360) + 360) % 360)));
        ok(key(g.directions) === key(wrapped),
          `${label}: the diagonal fan's DIRECTION set is`
          + ` {${g.directions.map((v) => v.toFixed(4)).join(' ')}}, want the same walk`
          + ` narrowed to f32 and then wrapped to [0,360)`
          + ` {${wrapped.map((v) => v.toFixed(4)).join(' ')}} (${side})`);
      } else if (g.kind === 'ladderY') {
        ok(key(g.directions) === '0.000000 180.000000',
          `${label}: difficulty 5 is vertical-only (boxsplitter Step_0 98), so`
          + ` headings must be {0 180}, got {${g.directions.join(' ')}} (${side})`);
        ok(g.ys.length === g.n / 4,
          `${label}: the d5 Y ladder has ${g.ys.length} rungs for ${g.n} teeth;`
          + ` \`_i % (bullet_count / 2)\` over 2 waves gives ${g.n / 4} (${side})`);
        ok(g.rungSpread <= ladderBound,
          `${label}: the Y ladder's rung gaps vary by ${g.rungSpread.toExponential(3)}px,`
          + ` past the ${ladderBound.toExponential(3)}px the mod itself produced`
          + ` (${ladderWitness}) (${side})`);
        ok(g.offAxis <= OFFAXIS_MAX,
          `${label}: the d5 column sits ${g.offAxis.toFixed(4)}px off the box centre;`
          + ` its x comes from \`_xrange = lengthdir_x(144, angle + 90)\`, so a`
          + ` ${MAX_TILT_DEG}deg tilt allows at most ${OFFAXIS_MAX.toFixed(4)} (${side})`);
      } else {
        const wantDirs = g.kind === 'horizontal' ? '90.000000 270.000000' : '0.000000 180.000000';
        ok(key(g.directions) === wantDirs,
          `${label}: a ${g.kind} cut's headings are {${wantDirs}} (Step_0 217-232),`
          + ` got {${g.directions.map((v) => v.toFixed(4)).join(' ')}} (${side})`);
        ok(g.xs.length === g.n && g.ys.length === g.n,
          `${label}: a ${g.kind} cut puts each of its ${g.n} teeth on its own rung,`
          + ` got ${g.xs.length} x / ${g.ys.length} y (${side})`);
        ok(g.span >= SPAN_MIN && g.span <= CUT_RANGE,
          `${label}: the ladder spans ${g.span.toFixed(4)}px; bullet_range is`
          + ` ${CUT_RANGE} and the cut can tilt by at most ${MAX_TILT_DEG}deg`
          + ` (splitslash Step_0 11), so the span must lie in`
          + ` [${SPAN_MIN.toFixed(4)}, ${CUT_RANGE}] (${side})`);
        ok(g.rungSpread <= ladderBound,
          `${label}: the ladder's rung gaps vary by ${g.rungSpread.toExponential(3)}px,`
          + ` past the ${ladderBound.toExponential(3)}px the mod itself produced`
          + ` (${ladderWitness}) (${side})`);
        ok(g.offAxis <= OFFAXIS_MAX,
          `${label}: the cut wanders ${g.offAxis.toFixed(4)}px off the box centre;`
          + ` a ${MAX_TILT_DEG}deg tilt over ${CUT_RANGE / 2}px allows at most`
          + ` ${OFFAXIS_MAX.toFixed(4)} (${side})`);
      }
    };

    for (let i = 0; i < ref.groups.length; i++) {
      rules('oracle', ref.groups[i], `${entry.id} oracle split ${i}`);
      oracleGroupsCompared += 1;
    }
    for (let i = 0; i < simGroups.length; i++) {
      rules('sim', simGroups[i], `${entry.id} sim split ${i}`);
      simGroupsCompared += 1;
    }

    // ── THE D5 Y LADDER, VALUE FOR VALUE ──────────────────────────────────
    //
    // The one place in this family where an exact cross-side comparison is
    // legitimate: the rungs come from the BOX, not from any draw —
    // `gt_miny() + 15 + (i % 7) * ((gt_maxy() - gt_miny() - 8) / 7)`. Seven
    // f32 numbers, no tolerance, and they must agree exactly.
    if (entry.dcDifficulty === 5) {
      const oy = key(ref.groups[0].ys);
      const sy = simGroups.length ? key(simGroups[0].ys) : '(none)';
      ok(oy === sy,
        `${entry.id}: the d5 Y ladder — oracle [${oy}], sim [${sy}]`);
      ok(ref.groups.every((g) => key(g.ys) === oy),
        `${entry.id}: the recording's d5 Y ladder moves between splits — it is`
        + ' supposed to be a pure function of the box');
      ok(simGroups.every((g) => key(g.ys) === sy),
        `${entry.id}: the sim's d5 Y ladder moves between splits`);
    }

    // ── the diagonal branch, when the recording caught one ────────────────
    //
    // difficulty 3 rolls `diagonal = irandom(1)` per cycle, so whether a given
    // launch contains one is RNG. When BOTH sides produced one, their fans are
    // compared as sets.
    const oDiag = ref.groups.find((g) => g.kind === 'diagonal');
    const sDiag = simGroups.find((g) => g.kind === 'diagonal');
    if (oDiag && sDiag) {
      ok(key(oDiag.angles) === key(sDiag.angles),
        `${entry.id}: the diagonal fan's image_angle set — oracle`
        + ` [${key(oDiag.angles)}], sim [${key(sDiag.angles)}]`);
      ok(key(oDiag.directions) === key(sDiag.directions),
        `${entry.id}: the diagonal fan's DIRECTION set — oracle`
        + ` [${key(oDiag.directions)}], sim [${key(sDiag.directions)}].`
        + ' GameMaker narrows a built-in to f32 and THEN wraps it to [0,360):'
        + ' the 13th heading accumulates to 359.99999999999989, which f32'
        + ' rounds to exactly 360, so the mod stores 0.');
    } else if (oDiag && !sDiag) {
      notes.push(`${entry.id}: the recording caught a diagonal cut and this sim launch`
        + ' did not (the per-cycle irandom(1) is re-anchored) — the fan comparison'
        + ' did not run for this entry');
    }
  }

  // ══ POSITIVE EXECUTION: the comparison actually ran ══════════════════════
  ok(oracleGroupsCompared >= 8 && simGroupsCompared >= 8,
    `only ${oracleGroupsCompared} recorded and ${simGroupsCompared} simulated splits`
    + ' were examined — too few for this to be a comparison of the family');

  console.log('');
  for (const n of [...new Set(notes)]) console.log(`  NOTE: ${n}`);

  if (failures.length) {
    console.log(`\n  ${failures.length} FAILURE(S) of ${checks} assertions:`);
    for (const f of failures) console.log(`    - ${f}`);
    console.log('');
    console.log('  A FAILURE HERE IS A FINDING ABOUT THE SIM, not a reason to loosen');
    console.log('  the comparison. Every bound above is either a literal read out of');
    console.log('  the mod or a number the recording itself set.');
    return 1;
  }

  console.log(`\n  ${checks} assertions against the real mod   OK`);
  console.log(`  (${oracleGroupsCompared} recorded splits and ${simGroupsCompared} simulated ones:`);
  console.log('   object set, teeth per split, the four spawn geometries, the ladder');
  console.log('   spans and rungs, the cadence floor and the flame markers. NOT frame');
  console.log('   numbers, NOT any RNG draw, NOT damage.)');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
