#!/usr/bin/env node
// THE STARS FAMILY, HELD AGAINST THE REAL MOD.
//
//     node kaizo/tools/checks/check-oracle-stars.mjs [trace.csv]
//
// V-C recreation of EnderCat8's "Kaizo Roaring Knight" v2.3.3 — research
// only, do not publish without permission (kaizo/HANDOFF.md §5-C).
//
// check-oracle-schedule proved the fight SELECTS the right entries, in the
// right order, on the right board. It says nothing about what happens on that
// board. This is the first check that opens one attack family and compares
// what the mod actually SPAWNED against what kaizo/ spawns for the same
// schedule rows:
//
//     atk_Starstorm1       ac  1  d0  phase 1  -> type 98 difficulty 1
//     atk_Starstorm2       ac  1  d1  phase 2  -> type 98 difficulty 3
//     atk_Starstorm3       ac  1  d2  phase 3  -> type 98 difficulty 3.1
//     atk_Starstorm4       ac 20  d0  phase 3  -> type 98 difficulty 3.3
//                                               + type 154 difficulty 3.1
//     atk_Starstorm4Final  ac 20  d0  phase 4  -> the same pair
//
// The last is unreachable in MODE 0 by construction (the recorder pins
// monsterhp and the mod's gate is 0.6), so it is compared only when an
// attack-lock recording is handed in — and then it is, because its table row
// is atk_Starstorm4's byte for byte.
//
// EVERY RUN SAYS WHICH ENTRIES IT ACTUALLY COMPARED, and a run that compared
// some of them prints PARTIAL. Three ways a recording can carry less than the
// whole family, each reported rather than passed over: it predates the
// kaizo_playing column (a skip — spawns cannot be attributed at all); it
// predates the recorder's expanded watch list (the assertions that need
// obj_fake_gt or the sword vortex are skipped, loudly); or it simply starts
// mid-turn, leaving an entry with no cone to anchor its frames to.
//
// ── WHAT IS CLAIMED ───────────────────────────────────────────────────────
//
// Only quantities that are STRUCTURAL — fixed by the mod's code rather than
// by the RNG stream or by how the recorded player played:
//
//   OBJECT SET     which object types each entry creates, with two named
//                  exclusions justified from the GML below.
//   FIXED COUNTS   one cone per turn; for ac 20, one sword-vortex manager and
//                  six swords.
//   FIXED GEOMETRY the cone's spawn point and scale; the BOARD at the frame
//                  the cone is created, read out of the recording's
//                  obj_fake_gt row (see below); every star's spawn point,
//                  recovered exactly; every star's angle and zero scale.
//   CADENCE        the first star's offset from the cone, the gap between
//                  stars, the burst size, the sword-vortex pair cadence.
//   THE BLAST      each burst's direction SET, speed multiset, per-burst
//                  scale STEP, and difficulty 3.3's +0.35 split_blast offset.
//   THE DRAG       obj_growtangle.x frame by frame, from the cone's creation
//                  to the recall. This is the family's whole dodge pressure —
//                  the cone shoves the arena left every frame — and it is
//                  pure arithmetic with no RNG in it, so it is compared as an
//                  exact per-frame equality rather than as a summary.
//
// ── WHAT IS NOT CLAIMED, AND WHY EACH IS UNCOMPARABLE ─────────────────────
//
//   HOW MANY STARS. The controller stops at `global.turntimer <= endtimer+1`
//   and GRAZING DECREMENTS global.turntimer — visibly, in this recording: the
//   clock leaves the integers at atk_Starstorm1 f136 (126.2) and never
//   returns. So the star count is a function of how the recorded player
//   flew, not of the mod. Measured: 25 / 27 / 26 / 21 in the recording
//   against 26 / 26 / 26 / 19 in the sim's parked-soul harness. Asserting
//   equality there would be asserting on the player.
//
//   ABSOLUTE FRAMES. Every frame here is relative to the CONE's creation
//   frame, on both sides, and THAT ANCHOR IS HIDING A KNOWN ONE-FRAME
//   DIFFERENCE which is recorded here rather than papered over.
//
//   The mod's controller burns its first Step on the type-98 `init == 1`
//   block — that is where it creates obj_knight_pointing_cone and
//   obj_heart_follower and resets `btimer` — so the cone appears the frame
//   AFTER the dispatch. Measured: atk_Starstorm1 launches at f11
//   (kaizo_playing transitions, rtimer == 12) and the cone is logged at f12;
//   the same +1 holds for all four entries. The sim's launchKaizoStars does
//   that work at the launch instant, so its cone appears at +0 and the whole
//   attack — the 30-frame charge, the drag onset, the recall test against
//   global.turntimer — sits one frame earlier RELATIVE TO THE TURN CLOCK.
//
//   Nothing in this file can settle whether that costs anything, because the
//   clock itself is graze-driven and therefore uncomparable (above), and a
//   parked-soul harness adds a decrement offset of its own. What IS settled
//   is that every cadence INSIDE the attack agrees to the frame once the cone
//   is the origin. If the offset is ever chased, the fix is the shape of the
//   GML: move the cone and follower out of launchKaizoStars and into the
//   controller's first step, behind the `init == 1` arm.
//
//   ANY PER-STAR DIRECTION OR SPEED. `special += 0.5 + sin(random(1)) * 0.3`
//   is one live draw per star. The project's honest claim is "mechanics
//   one-to-one, RNG re-anchored per launch" (CLAUDE.md), so the streams are
//   deliberately not aligned. The star's SPAWN POINT is compared instead,
//   which the same rows fix exactly.
//
//   ANYTHING AFTER THE RECALL. The recall moment is set by the turn clock, so
//   the knockback pulse, the starchild count and the shards' absolute scales
//   all inherit the graze problem above. The per-burst scale STEP is
//   comparable (it is the star cadence times the star's growspeed) and is
//   checked; the base is not.
//
//   COLOUR, DAMAGE, HP, TP, TARGETING. The recorder pins party and boss HP,
//   and the seq log carries no colour. check-stars.mjs owns the mod's blue.
//
// ── THE TWO OBJECTS THE SIM DOES NOT CREATE ───────────────────────────────
//
// Both are in the recording, both are absent from kaizo/, and both are
// deliberate. Named here rather than filtered silently, because a quiet
// exclusion list is how a real gap gets to look like a design decision.
//
//   obj_fake_gt — created by the cone's Create, one per turn. Its whole
//   implementation is four lines: Create hides obj_growtangle and copies its
//   depth; Step_2 copies the box's x/y/image_xscale/image_yscale; Draw
//   redraws the box at `x + xoffset, y + yoffset`; CleanUp shows the box
//   again. It draws NO random numbers of its own — the two `random_range`
//   calls CLAUDE.md attributes to the shake are in the CONE's Step
//   (gml_Object_obj_knight_pointing_cone_Step_0.gml:95-102), writing into
//   fake_gt's xoffset/yoffset, and kaizo/attacks/stars-pointing-cone.js
//   consumes both at the same stream position as e.fakeGtXoff / e.fakeGtYoff.
//   So the sim folds a renderer proxy into the object that drives it, and the
//   stream cost is paid. Section 5 turns the omission into evidence: because
//   fake_gt IS the box, its logged row is a free measurement OF the box, and
//   the sim's growtangle is asserted against it to the last printed digit.
//
//   obj_afterimage_blend — created only by obj_knight_pointing_starchild's
//   Step at `con == 3` (Step_0.gml:138-144), twice per shard per frame, which
//   is why the recording's groups are all even and grow with the wave. It is
//   a trail. The kaizo starchild module records the omission at its site
//   ("the sim never modelled obj_afterimage_blend here"). It appears for
//   atk_Starstorm2 and atk_Starstorm3 and NOT for atk_Starstorm1 or
//   atk_Starstorm4 — which is itself a confirmation of the difficulty gate
//   the sim implements: the shard's Step arms its delay only under
//   `difficulty >= 2`, and zeroes it again at 3.2/3.3, so d1 and d3.3 shards
//   never reach con 3 and never leave a trail. Section 1 asserts that
//   presence pattern rather than ignoring it.
//
// obj_dbulletcontroller, obj_heart_follower, obj_afterimage and obj_shake are
// on the OTHER side of the same problem: the sim creates them and the
// recorder was not watching them (the watch list in
// knight-research/kaizo-mod/tools/patches/oracle_kaizo_fight.csx names
// neither the controller nor the follower). Their absence from the recording
// is not evidence, so they are excluded from the "the sim spawned something
// extra" test by name, and the exclusion is stated rather than assumed.
//
// ── ATTRIBUTION ───────────────────────────────────────────────────────────
//
// Grouped by `kaizo_playing`, never by `kaizo_atk` — trap #1 of the ledger.
// One further filter, and it is measured rather than assumed: the selector
// assigns the NEXT turn's `attackchoice` under mnfight 1.5 while
// `kaizo_playing` still names the entry that fired, so the last rows of each
// group belong to the next turn's opening. Rows whose `attackchoice` is not
// the entry's own ac are dropped, and section 0 asserts that every dropped
// row is an obj_afterimage — if a Stars object ever appears in that tail the
// filter is wrong and the check says so instead of quietly losing spawns.

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox } from '../../../sim/battlebox.js';
import { SOUL_START } from '../../../sim/actors.js';
import { gmlCreate } from '../../../sim/rng.js';
import { VC_TABLE } from '../../versions/vc-script.js';
import { launchVCAttack, openVCArena, vcTurnLength } from '../../scenes/kaizo-mod-launcher.js';
// The trace resolver and reader are check-oracle-schedule's, imported rather
// than copied so a future move of the recordings is fixed in one place.
import { resolveTraces, readTrace } from './check-oracle-schedule.mjs';

// ── the family ─────────────────────────────────────────────────────────────

const FAMILY = [
  'atk_Starstorm1', 'atk_Starstorm2', 'atk_Starstorm3', 'atk_Starstorm4',
  // The phase-4 twin. Unreachable in MODE 0 (the recorder pins monsterhp, and
  // the gate is 0.6), so it only appears in an attack-lock recording — but its
  // table row is ac 20 / difficulty 0, byte for byte atk_Starstorm4's, so the
  // same profile below applies and the evidence is free when it is there.
  'atk_Starstorm4Final',
];

/**
 * What the mod's Other_23 arm turns a Stars row into, and what that difficulty
 * makes the star do. Derived from the dispatch (kaizo-mod-launcher.js
 * normalArm cases 1 and 20) rather than keyed by entry id, so an entry added
 * to the schedule is covered by the same rule that covers these.
 *
 *   ac 1, phase 1  -> type 98 difficulty 1     every star explodes, 6 beams
 *   ac 1, phase 2  -> type 98 difficulty 3     tripods
 *   ac 1, phase 3  -> type 98 difficulty 3.1   pentagons, shards at 4.75
 *   ac 20          -> type 98 difficulty 3.3   split_blast, 5-frame cadence
 *                   + type 154 difficulty 3.1  (the paired sword vortex)
 */
function starsProfile(row) {
  if (row.ac === 20) {
    return { d: 3.3, burst: 6, table: 'default6', gap: 5, split: true, vortex: true };
  }
  if (row.phase === 1) return { d: 1, burst: 6, table: 'default6', gap: 4 };
  if (row.phase === 2) return { d: 3, burst: 3, table: 'tripods', gap: 4 };
  return { d: 3.1, burst: 5, table: 'pentagons', gap: 4 };
}

/** Object types the recorder cannot see, so their absence proves nothing. */
const UNWATCHED = new Set([
  'obj_dbulletcontroller', 'obj_heart_follower', 'obj_shake',
  'obj_growtangle', 'obj_heart', 'obj_knight_enemy',
]);
/** Recorded types the sim deliberately does not create — see the header. */
const NOT_MODELLED = new Set(['obj_fake_gt', 'obj_afterimage_blend']);
/**
 * THE RECORDER HAS GENERATIONS, AND AN OLD ONE'S SILENCE IS NOT EVIDENCE.
 *
 * The watch list in oracle_kaizo_fight.csx grew on 2026-08-29 to carry the
 * managers, obj_fake_gt, obj_marker, obj_regularbullet and the afterimages —
 * the fix for the ledger's "A BLANK ROW MEANT THE RECORDER WAS NOT WATCHING"
 * entry, where two attacks recorded as doing nothing. Recordings made before
 * it are still real; they simply cannot say whether obj_fake_gt or the sword
 * vortex was created, and asserting on their silence would reproduce exactly
 * the mistake that fix was for.
 *
 * obj_afterimage is the probe. The mod sets `rgbafterimages = 1`
 * unconditionally, so the Knight trails one on essentially every frame of
 * every turn: a recording that contains a Stars turn and NOT ONE
 * obj_afterimage row is a recording made before the list grew. Every
 * assertion that depends on the added names is skipped, loudly, in that case.
 */
const EXPANDED_LIST_PROBE = 'obj_afterimage';
/** The Knight's rainbow trail. Both sides make it; it is not a bullet and its
 *  population is a function of turn length, so it is counted, never compared. */
const TRAIL = new Set(['obj_afterimage']);

/**
 * THE STAR'S SPAWN POINT, exact.
 *
 *   `scr_childbullet(bulletmaker.x + 22, bulletmaker.y + 56, ...)`
 *
 * with the cone parked at `(gt.x + 115, gt.y - 56)` and the board at
 * (320, 170) puts every star at (457, 170) — and the recording agrees, for
 * all 99 stars across the four entries, once ONE frame of built-in motion is
 * backed out (the recorder logs an instance at the end of the frame it was
 * created, by which time obj_regularbullet's speed/direction have already
 * moved it). See STAR_SPAWN_EPS for the bound.
 */
const STAR_SPAWN = { x: 457, y: 170 };
/**
 * The bound is READ OFF THE DATA, not chosen for convenience. Backing the
 * motion out of the recording's own rows leaves a worst residual under
 * 1.6e-5 px (1.55e-5 measured, and each run prints its own) — f32 position
 * storage plus the CSV's ten printed decimals. The nearest physically
 * different answer is 0.25 px, the
 * cone's own `x += 0.25` drift, one frame of which would show up here if it
 * were happening (it is not: the cone never reaches the `else` arm). Any
 * bound between 1.6e-5 and 0.25 separates those two, and 1e-3 is inside it
 * with three decades of margin on each side.
 */
const STAR_SPAWN_EPS = 1e-3;

/**
 * The blast tables the mod's obj_knight_pointing_star picks from. Listed so
 * the direction sets below are asserted against a NAMED table rather than
 * against whatever the sim produced — a self-consistent sim would pass the
 * latter. check-stars.mjs asserts the same three tables from the sim side.
 */
const BLAST = {
  default6: [33, 90, 147, 213, 270, 327],
  tripods: [[90, 213, 327], [33, 147, 270]],
  pentagons: [[0, 72, 144, 216, 288], [36, 108, 180, 252, 324]],
};

/**
 * The drag window floor. The windows the `_deep` recording actually affords —
 * the cone's own frame to whichever side recalls first — are 132
 * (atk_Starstorm1), 138 (atk_Starstorm2), 137 (atk_Starstorm3) and 126
 * (atk_Starstorm4) frames; the shortest is atk_Starstorm4's, where the SIM
 * recalls first because its parked soul grazes less than the recorded player
 * did, and the shortest across ALL the recordings on this machine is
 * atk_Starstorm4Final's 126 in the attack-lock run. The floor sits well under
 * those so a shift in either recall does not turn a passing comparison into a
 * failure, while a collapse of the window toward nothing — which would make
 * the drag comparison vacuous — fails loudly.
 */
const DRAG_WINDOW_FLOOR = 90;

// ── plumbing ───────────────────────────────────────────────────────────────

let checks = 0;
let failures = 0;
const notes = [];
function ok(cond, what) {
  checks += 1;
  if (cond) {
    console.log(`    ok   ${what}`);
  } else {
    failures += 1;
    console.log(`    FAIL ${what}`);
  }
}

const rad = (d) => (d * Math.PI) / 180;
const nums = (a) => [...a].sort((x, y) => x - y).map((v) => Number(v.toFixed(6))).join(',');
const setEq = (a, b) => nums(a) === nums(b);

/** Read the recorder's per-spawn CSV into typed rows. */
function readSeq(path) {
  const text = readFileSync(path, 'utf8').replace(/\r/g, '').trimEnd();
  const lines = text.split('\n');
  const col = Object.fromEntries(lines[0].split(',').map((h, i) => [h, i]));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].length) continue;
    const r = lines[i].split(',');
    rows.push({
      frame: Number(r[col.frame]),
      object: r[col.object],
      x: Number(r[col.x]),
      y: Number(r[col.y]),
      angle: Number(r[col.angle]),
      xscale: Number(r[col.xscale]),
      yscale: Number(r[col.yscale]),
      direction: Number(r[col.direction]),
      speed: Number(r[col.speed]),
      ac: Number(r[col.attackchoice]),
      playing: r[col.kaizo_playing] ?? '',
      raw: { xscale: r[col.xscale], yscale: r[col.yscale], x: r[col.x], y: r[col.y] },
    });
  }
  return { col, rows };
}

/** The trace's obj_growtangle x, by frame. */
function boxSeries(trace) {
  const map = new Map();
  for (const r of trace.rows) {
    const f = Number(r[trace.col.frame]);
    const v = r[trace.col.gt_x];
    map.set(f, v === '' || v === undefined ? null : Number(v));
  }
  return map;
}

/**
 * Where the cone's recall pulse lands in a box-x series.
 *
 * Before the recall the drag is `angle / target_angle / 2`, at most 0.5 px a
 * frame, so `round(gt_x)` can only move the box by 0 or 1 — verified on every
 * pre-recall frame of all four recorded entries. `knockback = 10` moves it by
 * ~10 in one frame. So the first step larger than 1 IS the recall, with no
 * threshold invented: 1 is the mechanism's own ceiling.
 */
function preRecallLength(series) {
  for (let i = 1; i < series.length; i++) {
    if (Math.abs(series[i] - series[i - 1]) > 1) return i;
  }
  return series.length;
}

/** Group spawn records by frame, in frame order. */
function bursts(records) {
  const by = new Map();
  for (const r of records) {
    if (!by.has(r.frame)) by.set(r.frame, []);
    by.get(r.frame).push(r);
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([frame, rs]) => ({ frame, rs }));
}

/** Consecutive differences of a list. */
const diffs = (xs) => xs.slice(1).map((v, i) => Number((v - xs[i]).toFixed(6)));

// ── the sim side ───────────────────────────────────────────────────────────

/**
 * Drive one V-C row through the real launcher and log every spawn the way the
 * recorder does: the first frame the instance is visible, sampled AFTER the
 * frame's steps, so both sides carry one frame of motion.
 *
 * THE BOARD IS PRE-GROWN TWELVE FRAMES, because the mod raises it twelve
 * frames before the attack spawns (obj_growtangle under mnfight 1.5, the
 * dispatch under mnfight 2 at `rtimer == 12`). The recording shows the box at
 * 12 of its 15 grow steps on the frame the cone appears; section 5 asserts
 * that number rather than assuming it.
 *
 * The soul is PARKED and the input empty, so this run is deterministic and
 * the only thing it cannot reproduce is the recorded player's grazing — which
 * is exactly the quantity the header refuses to compare.
 */
function runSim(row, { seed = 12345, frames = 240 } = {}) {
  const state = createState({ seed });
  state.gmlRng = gmlCreate(seed);
  state.kaizo = { sideb: false };
  state.keepAlive = true;
  state.invTimer = -1;
  const gt = spawn(state, battlebox, { x: 320, y: 170 });
  openVCArena(state, row);
  for (let i = 0; i < 12; i++) stepFrame(state, {});
  const boardAtLaunch = {
    x: gt.x, y: gt.y, xscale: gt.image_xscale, yscale: gt.image_yscale,
  };
  state.soul = spawn(state, soul, { ...SOUL_START });
  state.turntimer = vcTurnLength(row);
  launchVCAttack(state, row);

  // Frame 0 is the launch instant: launchKaizoStars has already made the
  // controller and the cone (the mod makes the cone one frame later, off the
  // controller's init step — see the header's ABSOLUTE FRAMES note).
  const seen = new Map();
  const boxX = [];
  const coneDraws = [];
  const record = (f) => {
    for (const e of state.entities) {
      if (!e.alive || seen.has(e.seq)) continue;
      seen.set(e.seq, {
        frame: f,
        object: e.type.name,
        x: e.x, y: e.y,
        angle: e.image_angle ?? 0,
        xscale: e.image_xscale ?? 0,
        yscale: e.image_yscale ?? 0,
        direction: e.direction ?? 0,
        speed: e.speed ?? 0,
      });
    }
  };
  record(0);
  boxX.push(gt.x);
  const cone = state.entities.find((e) => e.alive && e.type.name === 'obj_knight_pointing_cone');
  for (let f = 1; f <= frames; f++) {
    stepFrame(state, {});
    record(f);
    boxX.push(gt.x);
    // The cone's two fake_gt draws, sampled while it is dragging. `con` is
    // advanced in the cone's endStep, AFTER its Step has already taken the
    // `if (con < 2) return` exit — the mod's own ordering — so the frame that
    // flips con to 2 legitimately carries no pair. Anything after that must.
    if (cone && cone.alive && (cone.con ?? 0) >= 2) {
      const p = [cone.fakeGtXoff, cone.fakeGtYoff];
      if (Number.isFinite(p[0]) && Number.isFinite(p[1])) coneDraws.push(p);
      else if (coneDraws.length) coneDraws.push(null); // a frame that skipped the draws
    }
    if (state.turntimer > 0) state.turntimer -= 1;
  }
  return {
    records: [...seen.values()], boxX, boardAtLaunch, coneDraws, state,
  };
}

// ── the comparison ─────────────────────────────────────────────────────────

const tableById = new Map();
for (const p of Object.keys(VC_TABLE)) for (const r of VC_TABLE[p]) tableById.set(r.id, r);

function compareEntry(id, seq, box, expanded) {
  const row = tableById.get(id);
  const prof = starsProfile(row);
  const group = seq.rows.filter((r) => r.playing === id);

  // ── 0. attribution ──────────────────────────────────────────────────────
  //
  // ONE TURN, not one group. In MODE 0 an entry fires once and the two are the
  // same thing; a MODE 1 attack-lock replays the SAME entry over and over, so
  // its group carries five cones and five waves of stars, and folding them
  // together would report five turns' worth of spawns as one turn's ledger.
  // The turn is [group start, the SECOND cone) — the cone is created once per
  // turn by the controller's init, so it is the turn's own marker.
  const cones = group.filter((r) => r.object === 'obj_knight_pointing_cone')
    .sort((a, b) => a.frame - b.frame);
  const turnEnd = cones.length > 1 ? cones[1].frame : Infinity;
  const turn = group.filter((r) => r.frame < turnEnd);

  const mine = turn.filter((r) => r.ac === row.ac);
  const tail = turn.filter((r) => r.ac !== row.ac);
  console.log(`\n  ${id}  (ac ${row.ac}, schedule difficulty ${row.difficulty}, phase ${row.phase}`
    + ` -> type 98 difficulty ${prof.d}${prof.vortex ? ' + type 154 difficulty 3.1' : ''})`);
  console.log(`    ${group.length} spawn rows in the group, ${turn.length} in the first turn;`
    + ` ${tail.length} dropped as the next turn's opening`
    + (cones.length > 1 ? `; ${cones.length} turns of this entry recorded, comparing the first` : ''));
  ok(tail.every((r) => TRAIL.has(r.object)),
    `every dropped tail row is the Knight's trail, not a Stars object (${[...new Set(tail.map((t) => t.object))].join(', ') || 'none'})`);

  const oCone = mine.filter((r) => r.object === 'obj_knight_pointing_cone');
  if (oCone.length !== 1) {
    ok(false, `exactly one obj_knight_pointing_cone in the turn (found ${oCone.length}) — cannot anchor this entry`);
    return { compared: false };
  }
  const coneFrame = oCone[0].frame;
  const oRel = (r) => r.frame - coneFrame;

  const sim = runSim(row);
  const sRecords = sim.records;

  // ── 1. the object set ───────────────────────────────────────────────────
  const oTypes = new Set(mine.map((r) => r.object));
  const sTypes = new Set(sRecords.map((r) => r.object));
  const missing = [...oTypes].filter(
    (t) => !TRAIL.has(t) && !NOT_MODELLED.has(t) && !sTypes.has(t),
  );
  ok(missing.length === 0,
    `the sim creates every recorded object type for this entry (missing: ${missing.join(', ') || 'none'})`);
  if (expanded) {
    const extra = [...sTypes].filter(
      (t) => !TRAIL.has(t) && !UNWATCHED.has(t) && !oTypes.has(t),
    );
    ok(extra.length === 0,
      `the sim creates nothing the recording does not show (extra: ${extra.join(', ') || 'none'})`);
  } else {
    notes.push(`${id}: "the sim creates nothing extra" NOT asserted — this recording predates`
      + ' the expanded watch list, so most object types could not have been logged');
  }

  // The trail gate, asserted rather than filtered: obj_afterimage_blend is the
  // homing shard's con-3 dash trail, so it must appear exactly when the mod
  // arms the shard delay — difficulty >= 2 and not 3.2/3.3.
  const homes = prof.d >= 2 && prof.d !== 3.2 && prof.d !== 3.3;
  if (expanded) {
    ok(oTypes.has('obj_afterimage_blend') === homes,
      `obj_afterimage_blend ${homes ? 'present' : 'absent'} — the shard delay is ${homes ? 'armed' : 'zeroed'} at this entry's difficulty`);
  } else {
    // obj_afterimage_blend reaches the log only as a CHILD of obj_afterimage,
    // which the pre-expansion watch list does not name — so its absence here
    // is the instrument's, not the mod's.
    notes.push(`${id}: the shard-delay gate could not be read from obj_afterimage_blend —`
      + ' this recording does not watch the afterimages it descends from');
  }

  // ── 2. the cone ─────────────────────────────────────────────────────────
  const sCone = sRecords.filter((r) => r.object === 'obj_knight_pointing_cone');
  ok(sCone.length === 1, `exactly one cone on both sides (oracle 1, sim ${sCone.length})`);
  if (sCone.length === 1) {
    ok(oCone[0].x === 425 && sCone[0].x === 425,
      `cone spawns at x 425 on both sides (oracle ${oCone[0].x}, sim ${sCone[0].x})`);
    ok(oCone[0].xscale === 2 && oCone[0].yscale === 2
      && sCone[0].xscale === 2 && sCone[0].yscale === 2,
      'cone image scale 2 x 2 on both sides');
    ok(oCone[0].angle === 0 && sCone[0].angle === 0,
      'cone image_angle 0 on both sides');
    ok(sCone[0].frame === 0, `the sim's cone anchors frame 0 (found ${sCone[0].frame})`);
  }

  // ── 3. the stars ────────────────────────────────────────────────────────
  const oStars = mine.filter((r) => r.object === 'obj_knight_pointing_star')
    .sort((a, b) => a.frame - b.frame);
  const sStars = sRecords.filter((r) => r.object === 'obj_knight_pointing_star')
    .sort((a, b) => a.frame - b.frame);
  ok(oStars.length > 0 && sStars.length > 0,
    `both sides spawned stars (oracle ${oStars.length}, sim ${sStars.length}) — counts NOT compared, the turn clock is graze-driven`);

  if (oStars.length && sStars.length) {
    ok(oRel(oStars[0]) === 33 && sStars[0].frame === 33,
      `the first star lands 33 frames after the cone on both sides (oracle ${oRel(oStars[0])}, sim ${sStars[0].frame})`);

    const oGaps = new Set(diffs(oStars.map((r) => r.frame)));
    const sGaps = new Set(diffs(sStars.map((r) => r.frame)));
    const wantGap = prof.gap;
    ok(oGaps.size === 1 && sGaps.size === 1 && [...oGaps][0] === wantGap && [...sGaps][0] === wantGap,
      `star cadence: one every ${wantGap} frames on both sides`
      + ` (oracle {${[...oGaps].join(',')}}, sim {${[...sGaps].join(',')}})`
      + (prof.gap === 5 ? ' — the difficulty-3.3 `btimer = -1` arm' : ''));

    // The spawn point, recovered exactly on both sides.
    const backout = (r) => ({
      x: r.x - r.speed * Math.cos(rad(r.direction)),
      y: r.y + r.speed * Math.sin(rad(r.direction)),
    });
    const worst = (rs) => rs.reduce((m, r) => {
      const b = backout(r);
      return Math.max(m, Math.abs(b.x - STAR_SPAWN.x), Math.abs(b.y - STAR_SPAWN.y));
    }, 0);
    const ow = worst(oStars);
    const sw = worst(sStars);
    ok(ow < STAR_SPAWN_EPS,
      `every recorded star spawns at (${STAR_SPAWN.x}, ${STAR_SPAWN.y}) — worst residual ${ow.toExponential(2)} px over ${oStars.length} stars`);
    ok(sw < STAR_SPAWN_EPS,
      `every simulated star spawns at the same point — worst residual ${sw.toExponential(2)} px over ${sStars.length} stars`);

    ok(oStars.every((r) => r.angle === 0 && r.xscale === 0 && r.yscale === 0)
      && sStars.every((r) => r.angle === 0 && r.xscale === 0 && r.yscale === 0),
      'every star is born at image_angle 0 and scale 0 x 0 on both sides');
  }

  // ── 4. the blast ────────────────────────────────────────────────────────
  const oKids = bursts(mine.filter((r) => r.object === 'obj_knight_pointing_starchild'));
  const sKids = bursts(sRecords.filter((r) => r.object === 'obj_knight_pointing_starchild'));
  ok(oKids.length > 0 && sKids.length > 0,
    `both sides burst starchildren (oracle ${oKids.length} bursts, sim ${sKids.length})`);

  if (oKids.length && sKids.length) {
    const oSizes = new Set(oKids.map((b) => b.rs.length));
    const sSizes = new Set(sKids.map((b) => b.rs.length));
    const wantSize = prof.burst;
    ok(oSizes.size === 1 && sSizes.size === 1
      && [...oSizes][0] === wantSize && [...sSizes][0] === wantSize,
      `every burst is ${wantSize} shards on both sides (oracle {${[...oSizes].join(',')}}, sim {${[...sSizes].join(',')}})`);

    // The direction table, named rather than inferred.
    const tables = prof.table === 'default6' ? [BLAST.default6] : BLAST[prof.table];
    const label = prof.table === 'default6' ? 'the 6-beam default table'
      : prof.table === 'tripods' ? 'one of the two tripods'
        : 'one of the two pentagons';
    const fromTable = (bs) => bs.every((b) => tables.some((t) => setEq(b.rs.map((r) => r.direction), t)));
    ok(fromTable(oKids), `every recorded burst is ${label}`);
    ok(fromTable(sKids), `every simulated burst is ${label}`);

    ok(oKids.every((b) => b.rs.every((r) => r.angle === r.direction))
      && sKids.every((b) => b.rs.every((r) => r.angle === r.direction)),
      'every shard carries image_angle == direction on both sides');

    const speeds = (bs) => nums(new Set(bs.flatMap((b) => b.rs.map((r) => r.speed))));
    ok(speeds(oKids) === speeds(sKids),
      `shard launch speeds agree: {${speeds(oKids)}} on both sides`);

    // The per-burst scale STEP. The base is the exploding star's own size at
    // the recall, so it depends on WHEN the recall came and is not comparable;
    // the STEP is the star cadence times growspeed 0.02, halved by
    // `_scale = image_xscale * 0.5`, and is fixed by the mod.
    //
    // CAPPED BURSTS ARE EXCLUDED, and the cap is the mod's own number:
    // `_scale = min(_scale, 1)` (obj_knight_pointing_star Step_0.gml:93). Once
    // a wave's stars are old enough the base sits at exactly 1 for every
    // remaining burst, so their steps are 0 and the last uncapped step is
    // whatever remainder was left — both artefacts of where the cap fell, not
    // of the cadence. Excluding them is not loosening the comparison: the
    // uncapped steps are still compared as an exact set, and the SHAPE of that
    // set is what distinguishes the four difficulties (every star recalled ->
    // one step; the %3 schedule -> two, alternating; %2 -> one, doubled).
    const base = (b) => Math.min(...b.rs.map((r) => r.xscale));
    // f32 image_xscale carries ~7 significant decimal digits, so the step is
    // compared at 4 — inside what the storage can represent, and three decades
    // below the smallest step the mod produces (0.04).
    const q = (v) => Number(v.toFixed(4));
    const steps = (bs) => new Set(diffs(bs.map(base).filter((v) => v < 1)).map(q));
    const oStep = steps(oKids);
    const sStep = steps(sKids);
    ok(oStep.size > 0 && setEq(oStep, sStep),
      `the per-burst scale step matches below the mod's min(_scale, 1) cap:`
      + ` oracle {${nums(oStep)}}, sim {${nums(sStep)}}`);

    if (prof.split) {
      // split_blast: odd-i decoys at speed 1.5, even-i shots at 4.5 and
      // +0.35 scale (the kaizo star's Step, the 3.3 arm).
      const split = (bs) => bs.every((b) => {
        const slow = b.rs.filter((r) => r.speed === 1.5);
        const fast = b.rs.filter((r) => r.speed === 4.5);
        if (slow.length !== 3 || fast.length !== 3) return false;
        const d = Math.min(...fast.map((r) => r.xscale)) - Math.min(...slow.map((r) => r.xscale));
        return Math.abs(d - 0.35) < 1e-4;
      });
      ok(split(oKids), 'recorded 3.3 bursts: 3 decoys at 1.5 + 3 shots at 4.5, the shots exactly +0.35 scale');
      ok(split(sKids), 'simulated 3.3 bursts: the same split_blast shape');
    }
  }

  // ── 5. the board, read out of obj_fake_gt ───────────────────────────────
  const oGt = mine.filter((r) => r.object === 'obj_fake_gt');
  if (!expanded) {
    notes.push(`${id}: the board could not be read — obj_fake_gt is not on this recording's`
      + ' watch list, so its absence says nothing about whether the cone made one');
  } else {
    ok(oGt.length === 1, `one obj_fake_gt in the recording (found ${oGt.length})`);
  }
  if (oGt.length === 1) {
    ok(oGt[0].frame === coneFrame,
      'obj_fake_gt is created on the cone\'s own frame (the cone\'s Create makes it)');
    const b = sim.boardAtLaunch;
    const same = (a, c) => Number(a.toFixed(7)) === Number(c.toFixed(7));
    ok(oGt[0].x === b.x && oGt[0].y === b.y,
      `the board is at (${oGt[0].x}, ${oGt[0].y}) on both sides`);
    ok(same(oGt[0].xscale, b.xscale) && same(oGt[0].yscale, b.yscale),
      `the board's f32 scale matches to the last printed digit:`
      + ` oracle (${oGt[0].raw.xscale}, ${oGt[0].raw.yscale}),`
      + ` sim (${b.xscale}, ${b.yscale})`);
  }

  // ── 6. the sword vortex the ac-20 arm pairs with Stars ──────────────────
  if (prof.vortex && !expanded) {
    notes.push(`${id}: the paired type-154 sword vortex could not be checked — the manager and`
      + ' its swords were added to the recorder\'s watch list after this recording was made');
  } else if (prof.vortex) {
    const oMg = mine.filter((r) => r.object === 'obj_sword_vortex_manager');
    const sMg = sRecords.filter((r) => r.object === 'obj_sword_vortex_manager');
    ok(oMg.length === 1 && sMg.length === 1,
      `one obj_sword_vortex_manager on both sides (oracle ${oMg.length}, sim ${sMg.length})`);
    const oSw = mine.filter((r) => r.object === 'obj_sword_vortex').sort((a, b) => a.frame - b.frame);
    const sSw = sRecords.filter((r) => r.object === 'obj_sword_vortex').sort((a, b) => a.frame - b.frame);
    ok(oSw.length === 6 && sSw.length === 6,
      `six obj_sword_vortex on both sides (oracle ${oSw.length}, sim ${sSw.length})`);
    ok(setEq(new Set(oSw.map((r) => r.x)), new Set(sSw.map((r) => r.x))),
      `the vortex swords stand at the same x on both sides {${nums(new Set(oSw.map((r) => r.x)))}}`);
    ok(setEq(new Set(oSw.map((r) => r.angle)), new Set(sSw.map((r) => r.angle))),
      `and at the same image_angle {${nums(new Set(oSw.map((r) => r.angle)))}}`);
    ok(oSw.map((r) => oRel(r)).join(',') === sSw.map((r) => r.frame).join(','),
      `and on the same frames relative to the cone`
      + ` (oracle ${oSw.map((r) => oRel(r)).join(',')}, sim ${sSw.map((r) => r.frame).join(',')})`);
  }

  // ── 7. THE DRAG ─────────────────────────────────────────────────────────
  const oBox = [];
  for (let f = coneFrame; f <= Math.min(coneFrame + 240, turnEnd - 1); f++) {
    const v = box.get(f);
    if (v === undefined || v === null) break;
    oBox.push(v);
  }
  const sBox = sim.boxX;
  const window = Math.min(preRecallLength(oBox), preRecallLength(sBox));
  let agree = 0;
  while (agree < window && oBox[agree] === sBox[agree]) agree += 1;
  ok(window >= DRAG_WINDOW_FLOOR,
    `the pre-recall drag window is ${window} frames (floor ${DRAG_WINDOW_FLOOR}; oracle ${preRecallLength(oBox)}, sim ${preRecallLength(sBox)})`);
  ok(agree === window,
    `obj_growtangle.x is identical frame for frame across all ${window} of them`
    + (agree === window ? '' : ` — first difference at cone+${agree}: oracle ${oBox[agree]}, sim ${sBox[agree]}`));
  ok(window > 0 && oBox[window - 1] < oBox[0] && oBox[window - 1] === sBox[window - 1],
    `and the box really travelled: ${oBox[0]} -> ${oBox[window - 1]} (${oBox[0] - oBox[window - 1]} px left) on both sides`);

  // ── 8. positive execution — the fake_gt draws ARE being consumed ────────
  const draws = sim.coneDraws;
  ok(draws.length > 0 && draws.every((p) => p !== null),
    `the cone pays obj_fake_gt's two random_range draws on every dragging frame`
    + ` (${draws.filter(Boolean).length} of ${draws.length})`);
  // A FRESH pair every frame, not one value held over: with f64 draws a repeat
  // is not a coincidence, it is a frame that did not draw. This is the whole
  // reason the omitted obj_fake_gt is not a stream divergence.
  ok(draws.length > 0 && new Set(draws.filter(Boolean).map(([x]) => x)).size === draws.filter(Boolean).length,
    `and all ${draws.filter(Boolean).length} pairs are distinct — live draws, not a constant standing in for them`);

  return {
    compared: true,
    oracleRows: mine.length,
    simRecords: sRecords.length,
    dragFrames: window,
    stars: [oStars.length, sStars.length],
    kids: [oKids.length, sKids.length],
  };
}

// ── main ───────────────────────────────────────────────────────────────────

/**
 * The whole comparison, exported so a sabotage harness can run it after
 * patching a kaizo module in memory and confirm the failure lands — the
 * non-vacuity test sabotage-oracle-schedule.mjs performs for the schedule.
 * Returns { checks, failures, present, skipped }.
 */
export function checkStarsAgainstOracle(explicitTrace) {
  checks = 0;
  failures = 0;
  notes.length = 0;
  const code = main(explicitTrace);
  return { checks, failures, exit: code };
}

function main(explicitTrace) {
  let tracePath = explicitTrace;
  if (!tracePath) {
    const { dir, found, looked } = resolveTraces();
    if (!dir) {
      // A LOUD SKIP, NEVER A SILENT PASS — check-oracle-schedule's rule, for
      // the same reason: this is the only thing in the kaizo gate that holds
      // the STARS family against EnderCat8's actual mod, so a reader who sees
      // a green gate without this line would reasonably believe it had been.
      console.log('SKIP check-oracle-stars: no kaizo oracle recording found');
      for (const l of looked) console.log(`     looked in ${l}`);
      console.log('     Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,');
      console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
      console.log('     NOTHING IN THE STARS FAMILY IS HELD AGAINST THE REAL MOD WITHOUT IT.');
      return 0;
    }
    // The LONGEST USABLE recording. Longest, for check-oracle-schedule's
    // reason: MODE 1 locks are short and replay one entry. Usable, because
    // this check needs two things the oldest recordings do not have — a
    // per-spawn companion file and the kaizo_playing column — and picking a
    // recording that cannot be read, then skipping on it, would report "no
    // evidence" on a machine holding a recording that works.
    const usable = found
      .map((f) => join(dir, f))
      .filter((p) => {
        const s = join(dirname(p), basename(p).replace('trace', 'seq'));
        if (!existsSync(s)) return false;
        return readFileSync(p, 'utf8').slice(0, 4096).split('\n')[0].includes('kaizo_playing');
      });
    if (!usable.length) {
      console.log('SKIP check-oracle-stars: no recording here carries a per-spawn companion');
      console.log('     and the kaizo_playing column, which this check needs to attribute a');
      console.log(`     spawn to an entry at all. Found: ${found.join(', ')}`);
      console.log(`     in ${dir}. Re-record with the current recorder.`);
      return 0;
    }
    tracePath = usable
      .map((p) => ({ p, n: readFileSync(p, 'utf8').length }))
      .sort((a, b) => b.n - a.n)[0].p;
  }

  // The per-spawn companion sits beside the trace under the same tag.
  const seqPath = join(dirname(tracePath), basename(tracePath).replace('trace', 'seq'));
  if (!existsSync(seqPath)) {
    console.log('SKIP check-oracle-stars: the trace has no per-spawn companion');
    console.log(`     trace ${tracePath}`);
    console.log(`     wanted ${seqPath}`);
    console.log('     Only a recording made by the CURRENT recorder carries one; re-record.');
    return 0;
  }

  const trace = readTrace(tracePath);
  const seq = readSeq(seqPath);
  // NO kaizo_playing MEANS THIS RECORDING CANNOT BE READ, NOT THAT THE SIM IS
  // WRONG. The column is the mod's own kaizo_prevatk and it is the only
  // attribution rule that survives contact with a MODE 1 run (ledger trap #1);
  // the older `kaizo_atk` pointer names the NEXT entry and would file every
  // spawn under its successor. So a pre-column recording is a SKIP, worded as
  // one — exiting 1 here would report a recorder upgrade as a divergence.
  if (trace.col.kaizo_playing === undefined || seq.col.kaizo_playing === undefined) {
    console.log('SKIP check-oracle-stars: this recording predates the kaizo_playing column');
    console.log(`     ${tracePath}`);
    console.log('     Spawns can only be attributed to an entry through kaizo_playing (the mod\'s');
    console.log('     own kaizo_prevatk); the kaizo_attack pointer names the NEXT entry and would');
    console.log('     file every star under the following turn. Re-record with the current recorder.');
    return 0;
  }
  for (const need of ['frame', 'gt_x']) {
    if (trace.col[need] === undefined) {
      console.log(`FAIL check-oracle-stars: ${tracePath} has no "${need}" column`);
      console.log(`     columns present: ${trace.header.join(',')}`);
      return 1;
    }
  }
  for (const need of ['frame', 'object', 'attackchoice']) {
    if (seq.col[need] === undefined) {
      console.log(`FAIL check-oracle-stars: ${seqPath} has no "${need}" column`);
      return 1;
    }
  }

  console.log('check-oracle-stars — the STARS family against EnderCat8\'s mod');
  console.log(`  trace ${tracePath}`);
  console.log(`  seq   ${seqPath}`);

  // AN ENTRY IS COMPARABLE ONLY IF ITS CONE IS IN THE RECORDING. Every frame
  // below is measured from the cone, so a group whose cone is missing — which
  // is what a recording that STARTS mid-turn looks like, and the attack-lock
  // runs all do — cannot be anchored at all. Reported as an un-anchorable
  // entry rather than failed, and never counted as checked.
  const seen = FAMILY.filter((id) => seq.rows.some((r) => r.playing === id));
  const present = seen.filter((id) => seq.rows.some(
    (r) => r.playing === id && r.object === 'obj_knight_pointing_cone',
  ));
  const unanchored = seen.filter((id) => !present.includes(id));
  if (!present.length) {
    // Not a failure and not a silent pass: the recording is real, it simply
    // never played a whole Starstorm turn (a MODE 1 lock on another entry does
    // this). Worded so it cannot be read as "the family was checked".
    console.log('  SKIP: this recording contains no complete Starstorm turn.');
    console.log(`        entries seen: ${[...new Set(seq.rows.map((r) => r.playing))].filter(Boolean).join(', ') || 'none'}`);
    if (unanchored.length) {
      console.log(`        seen but not anchorable (no cone — the recording starts mid-turn): ${unanchored.join(', ')}`);
    }
    console.log('        NOTHING IN THE STARS FAMILY WAS HELD AGAINST THE MOD BY THIS RUN.');
    console.log('        Re-record in MODE 0 with a budget past the first turn, or lock a Starstorm entry.');
    return 0;
  }
  const absent = FAMILY.filter((id) => !seen.includes(id));
  console.log(`  ${present.length} of ${FAMILY.length} Stars entries comparable here: ${present.join(', ')}`);
  if (unanchored.length) {
    notes.push(`seen but NOT checked — the recording holds no cone for them, so no frame can be`
      + ` anchored: ${unanchored.join(', ')}`);
  }
  if (absent.length) notes.push(`not in this recording, so NOT checked: ${absent.join(', ')}`);

  // Which generation of the recorder made this? See EXPANDED_LIST_PROBE.
  const expanded = seq.rows.some((r) => r.object === EXPANDED_LIST_PROBE);
  console.log(`  recorder watch list: ${expanded ? 'expanded (2026-08-29 or later)' : 'PRE-EXPANSION'}`
    + ` — ${[...new Set(seq.rows.map((r) => r.object))].length} object types logged in all`);
  if (!expanded) {
    notes.push('this recording predates the recorder\'s expanded watch list, so every assertion'
      + ' that needed obj_fake_gt or the sword-vortex objects was SKIPPED, not passed');
  }

  const box = boxSeries(trace);
  const totals = { oracleRows: 0, simRecords: 0, dragFrames: 0, entries: 0 };
  for (const id of present) {
    const res = compareEntry(id, seq, box, expanded);
    if (res && res.compared) {
      totals.entries += 1;
      totals.oracleRows += res.oracleRows;
      totals.simRecords += res.simRecords;
      totals.dragFrames += res.dragFrames;
    }
  }

  // ── the positive execution assertion ────────────────────────────────────
  // "The comparison ran and agreed" must be distinguishable from "the
  // comparison never ran" — a green run whose loops all iterated zero times
  // is the failure mode this whole file exists to avoid.
  console.log('');
  ok(totals.entries === present.length,
    `all ${present.length} comparable ${present.length === 1 ? 'entry was' : 'entries were'}`
    + ` compared end to end (${totals.entries})`);
  ok(totals.oracleRows > 0 && totals.simRecords > 0,
    `${totals.oracleRows} recorded spawns and ${totals.simRecords} simulated spawns went through the comparison`);
  ok(totals.dragFrames >= DRAG_WINDOW_FLOOR * present.length,
    `${totals.dragFrames} frames of arena drag compared across the family`);

  for (const n of notes) console.log(`  NOTE: ${n}`);

  if (failures) {
    console.log(`\n  ${failures} FAILURE(S) of ${checks} assertions against the real mod.`);
    return 1;
  }
  console.log(`\n  ${checks} assertions against the real mod   OK`);
  console.log(`  (object set, fixed counts, cone geometry, ${expanded ? 'the board, ' : ''}star spawn`);
  console.log('   point, cadence, blast tables and the arena drag — NOT star counts, NOT');
  console.log('   any RNG-drawn heading or speed, NOT anything after the recall.)');
  if (present.length < FAMILY.length) {
    // THE WORDING, not the exit code, is what a reader acts on — the lesson
    // check-oracle-schedule records under its 'partial' verdict. A run that
    // compared one entry must not read like a run that compared five.
    console.log(`  PARTIAL: ${present.length} of ${FAMILY.length} Stars entries. The others are`);
    console.log('  NOT claimed by this run — see the NOTE lines above for which and why.');
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv[2]));
}
