#!/usr/bin/env node
// ORACLE CHECK — THE SWORD TUNNEL FAMILY, held against the real mod.
//
//     node kaizo/tools/checks/check-oracle-tunnel.mjs [trace.csv]
//
// Two schedule entries, both recorded in EnderCat8's "Kaizo Roaring Knight"
// v2.3.3 by knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1:
//
//   atk_Tunnel1   ac 13, difficulty 0, phase 1  — dispatch: type 153 d4 dmg 62
//                                                 then type 151 d4 dmg 206
//   atk_Tunnel2   ac 15, difficulty 0, phase 2  — dispatch: type 102
//                                                 then type 151 d7 dmg 135
//
// V-C recreation of another author's creative work — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// ── WHAT IS CLAIMED ───────────────────────────────────────────────────────
//
// For each entry, the SPAWN LEDGER the recording shows against the spawn
// ledger the sim produces when driven through the same launcher row:
//
//   * the SET of object types the turn creates, and the per-type COUNT where
//     the count is RNG-free (or, where it is not, the window the mod's own
//     GML permits — stated with the line that sets it, never a made-up
//     tolerance);
//   * spawn GEOMETRY that is structural: fixed x, fixed image_angle /
//     image_xscale / image_yscale / direction / speed, positions expressed
//     relative to the battle box or to the soul, and the SHAPE of the
//     scattered coordinates (a gap that is always exactly 140px, a y that is
//     always a multiple of the manager's verticalchange, a clamp that bites);
//   * ORDERING and CADENCE: how many instances land on one frame, and the
//     frame intervals between groups — measured relative to the frame the
//     turn's MANAGER appears, never as an absolute frame number.
//
// ── WHAT IS NOT CLAIMED, AND WHY ASSERTING IT WOULD BE A BUG ──────────────
//
//   * ABSOLUTE FRAME NUMBERS. The recording's turn lengths come from its own
//     pulsed-confirm input; this harness's come from its driver. Everything
//     below is an interval or an offset from the manager's own frame.
//
//   * ANY VALUE DRAWN FROM RNG. CLAUDE.md's honest claim is "mechanics
//     one-to-one, RNG re-anchored per launch". Three quantities in this
//     family are live RNG and are compared only by SHAPE:
//       - obj_sword_tunnel_manager Create's `timer = -40 + irandom(10)`,
//         which sets the frame of the FIRST sword pair and therefore the
//         total sword count (see the count law below);
//       - the same manager's `movedirection = choose("up","down")` /
//         `setcount = choose(2,3,4)` walk, which sets the corridor's y path;
//       - obj_knight_tunnel_slasher_2_revised's `irandom(90)` /
//         `random(0.5)` / `random_range(30,50)`, which set every blade's y
//         and vertical drift.
//
//   * DAMAGE, HP, TP OR TARGETING. The recorder pins party and boss HP, so
//     every survival-shaped number in the trace is a harness artifact. The
//     dispatch damages (62 / 206 / 190 / 90 / 135) are read from the GML here
//     only to identify the branch, never compared against the recording.
//
//   * THE KNIGHT'S OWN y. obj_knight_swordtunnelanim (Tunnel1) and
//     obj_knight_tunnel_slasher_2_revised (Tunnel2) are created at
//     `obj_knight_enemy.x, .y`, and the Knight's idle bob makes that y a
//     function of the ABSOLUTE frame — the recording itself gives two
//     different values for the two turns (72.6316680908 and 74.2502975464)
//     against a bob that spans roughly 70..86. Only the x (425) is compared.
//
//   * ANYTHING ABOUT afterimage / afterimage_blend. They are the mod's
//     rainbow trail (3734 instances in one Tunnel1 turn) and the sim does not
//     model them at all; counting them would compare a renderer against
//     nothing.
//
// ── THE ATTRIBUTION RULE, AND THE FRAME CONVENTION ────────────────────────
//
// Rows are grouped by `kaizo_playing` — the mod's own `kaizo_prevatk`, the
// entry it records as having just fired. NEVER by `kaizo_atk`, which is the
// pointer to the NEXT entry and transitions ON the launch frame; that is trap
// #1 in kaizo-mod/ORACLE-GROUND-TRUTH.md and it silently shifts every row by
// one turn.
//
// The recorder logs an instance on the first frame it SEES it, which is the
// frame it was CREATED and before it has stepped: obj_sword_tunnel_manager
// appears at f1850 and its `finishtimer == finishtimermax` cutoff (230) puts
// the last sword pair at f2079 = 1850 + 229, exactly one step short. So on the
// recording side, `t(instance) = firstSeenFrame - managerFrame` IS the
// manager's step index.
//
// The sim harness reproduces that convention deliberately: `launchVCAttack`
// is called BETWEEN frames, so the manager exists but has not stepped, and
// the first `stepFrame` after it is the manager's step 1. Getting this wrong
// is a silent off-by-one that reads as a real divergence — it is the same
// "count n - 1" shape CLAUDE.md records for a delayed tween.
//
// ── BOTH ROUTES, AND WHY THE ROUTE HAS TO BE DETECTED ─────────────────────
//
// This file used to take the LONGEST recording carrying both entries and
// compare it against a route-C sim. `_deep` (route C) and `_sideb` (route D)
// are both 13000 frames, so which one won was decided by a byte count — and
// on a machine where `_sideb` won, every route-D delta below would have been
// reported as a sim divergence. The route is now DETECTED from the recording
// (check-oracle-schedule's own `recoverLaunches` + `detectRoute`) and every
// recording that carries the entries is run, each against a sim driven on its
// own route.
//
// The two routes disagree about this attack in exactly the places the mod's
// GML says they should, which is what makes the pair worth having:
//
//   route C   real volleys every 8 steps (12, 20 ... 180), 42 decoys every 4
//   route D   real volleys every 7 steps (11, 18 ... 179), 56 decoys every 3
//
// ── SCOPE PER ROUTE ───────────────────────────────────────────────────────
//
// Route C runs the whole file. Route D runs atk_Tunnel2 ONLY — the blade wall
// is what kaizo/attacks/sword-tunnel-revised.js owns, and it is the only place
// where a route-D recording tests something this file is responsible for.
// atk_Tunnel1's route-D corridor and its type-151 chain belong to
// kaizo/attacks/sword-tunnel.js and kaizo/attacks/tracking-swords.js; they are
// NOT silently green here, they are NOT CLAIMED, and the one measured
// difference is printed as a NOTE so it is on the record rather than hidden.
//
// ── WHAT THIS CHECK FOUND, AND WHAT FIXED IT ──────────────────────────────
//
// atk_Tunnel1 matched the recording on every comparable quantity from the
// start. atk_Tunnel2 did not, and all six divergences had ONE root cause:
//
//   THE LAUNCHER ROUTED dc.type 102 AT THE VANILLA MODULE.
//   The mod ships its own obj_knight_tunnel_slasher_2_revised.
//   kaizo/attacks/sword-tunnel-revised.js is now the mod's copy, marked delta
//   by delta against the GML. It was NOT ledgered while it was missing:
//   SUPPORTED[102] is [0] and the ac-15 arm asks for difficulty 0, so
//   resolveDifficulty reported no approximation and state.kaizo.approx stayed
//   empty — a whole substituted attack that verify-kaizo's ledger could not
//   see. The six, and what each one is now:
//
//     1. `with (obj_tracking_swords_manager) instance_destroy(...)` in the
//        slasher's `state == "final"` arm (kaizo Step_0:81-84, no vanilla
//        counterpart). The mod KILLS the chained type-151 manager when the
//        wall ends; the vanilla copy did not, so the turn kept producing
//        tracking swords — 14 against the recording's 8, on both routes.
//     2. `_cap = 38` (kaizo Step_0:279-283 and :325-329). Any real blade that
//        would land within 38px of the board centre is pushed back out to
//        exactly 38. Without it the sim put blades 4.61px from the centre,
//        inside the corridor's own mouth.
//     3. the decoy band: kaizo `random_range(30, 50)`, vanilla
//        `random_range(20, 70)`. Measured 30.74..51.27 (C) and 29.94..50.32
//        (D) against the vanilla sim's 20.08..69.67.
//     4. `vspeed = dorifto` WAS A DEAD WRITE (sim/attacks/sword-tunnel-
//        revised.js:234). runMotion derives hspeed/vspeed from speed/direction
//        every frame for a `builtinMotion` entity and never reads a stored
//        vspeed, so the assignment landed on a property nothing reads and
//        every blade travelled dead horizontal: 1 distinct heading across six
//        seeds against the recording's 64. The kaizo copy writes the COMPONENT
//        (hspeed held, speed/direction recomposed), which is what GML's
//        vspeed actually is.
//     5. GML TRUTHINESS ON THE FIRING GATE. The GML is
//            if ((con >= 0.2 && (turn_type == "full" || ...)) || con)
//        and GameMaker reads a real as true only ABOVE 0.5, so `|| con` is
//        FALSE at con 0.1 and 0.2 — the rule CLAUDE.md records for `!alarm[0]`
//        on an idle -1 and the one this codebase already applies at
//        swordfall.js:125, knightlines.js:164 and roaringknight-slash.js:156.
//        The FIRST arm is what opens the gate, on the step introtimer reaches
//        5. The sim's `if (e.con)` is truthy at 0.1 and started the wall four
//        frames early — 44 volleys against 43. The comment above that line
//        called the first arm "inert. ORIGINAL BUG, preserved"; the recording
//        disproves it and the comment is gone.
//     6. the volley PERIOD is `_delay` (kaizo Step_0:208-224), 8 on route C
//        and 7 on route D — the B-Side arm keys off `myattackchoice == 15`,
//        which is the only ac that reaches this object at all.
//
// THE ROUTING EDIT IS NOT LANDED YET. kaizo/scenes/kaizo-mod-launcher.js is
// owned by the integration pass, so this file performs the substitution itself
// and PROVES it is the same thing: see `installKaizo102` and the
// "the substitution IS the routing edit" section, which drives both launch
// paths on identical benches and requires their whole ledgers to be equal.
// When the launcher's case 102 imports kaizo/attacks/sword-tunnel-revised.js,
// `installKaizo102` finds the module already in place and does nothing.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox, settleBox } from '../../../sim/battlebox.js';
import { knightActor, BOX, SOUL_START, KNIGHT } from '../../../sim/actors.js';
import { gmlCreate } from '../../../sim/rng.js';
import {
  launchVCAttack, openVCArena, vcTurnLength, arenaGeom,
} from '../../scenes/kaizo-mod-launcher.js';
import {
  resolveTraces, readTrace, recoverLaunches, detectRoute,
} from './check-oracle-schedule.mjs';
// THE MODULE UNDER TEST, and the vanilla one it replaces — imported side by
// side so the equivalence section can drive both.
import {
  tunnelSlasher2 as kaizoTunnelSlasher2,
  launchSwordTunnelRevised as kaizoLaunch102,
} from '../../attacks/sword-tunnel-revised.js';
import { launchSwordTunnelRevised as vanillaLaunch102 } from '../../../sim/attacks/sword-tunnel-revised.js';

// ── the two rows this file owns ───────────────────────────────────────────
//
// `row` is the shape kaizo/versions/vc-script.js stores and the launcher
// consumes. The ac / difficulty / phase triples are the ones
// check-oracle-schedule already verified against this same recording, so this
// file takes them as settled and only asks what the launch then MAKES. Both
// rows are identical on the two routes — the B-Side rewrites ac only for
// atk_RisingAbyssB, atk_Swords1 and atk_Quickslash.
const ENTRIES = [
  {
    id: 'atk_Tunnel1',
    row: { id: 'atk_Tunnel1', ac: 13, phase: 1, difficulty: 0 },
    // obj_sword_tunnel_manager difficulty 4: rate 4, gapsize 40,
    // verticalchange 10, tobymode 0 (Create_0, the `difficulty == 4` block).
    tunnelRate: 4,
    tunnelGap: 40,
    verticalChange: 10,
  },
  {
    id: 'atk_Tunnel2',
    row: { id: 'atk_Tunnel2', ac: 15, phase: 2, difficulty: 0 },
  },
];

/** atk_Tunnel2 is the only entry this file claims on the B-Side. See SCOPE. */
const ENTRIES_BY_ROUTE = {
  C: ENTRIES,
  D: ENTRIES.filter((e) => e.id === 'atk_Tunnel2'),
};

/**
 * The mod's own `_delay` / `_fdelay` for THIS attack, per route
 * (kaizo Step_0:208-219 and :367-371). Route D takes 7 rather than 6 because
 * the B-Side arm reads `myattackchoice == 15`, and ac 15 is the only dispatch
 * in the whole schedule that creates this object.
 */
const ROUTE_PARAMS = {
  C: { sideb: false, delay: 8, fdelay: 4 },
  D: { sideb: true, delay: 7, fdelay: 3 },
};

/** Every object type this family is expected to create (afterimages excluded). */
const FAMILY_OBJECTS = new Set([
  'obj_knight_swordtunnelanim',
  'obj_sword_tunnel_manager',
  'obj_sword_tunnel_sword',
  'obj_knight_tunnel_slasher_2_revised',
  'obj_knight_diamondswordbullet_ext',
  'obj_tracking_swords_manager',
  'obj_tracking_sword1',
  'obj_tracking_sword_slash',
]);

/**
 * The objects created by the LAUNCH itself (the controllers' first Step),
 * which the recorder therefore sees on the manager frame. Used to derive the
 * per-turn time origin.
 */
const MANAGERS = new Set([
  'obj_sword_tunnel_manager',
  'obj_knight_tunnel_slasher_2_revised',
  'obj_tracking_swords_manager',
  'obj_knight_swordtunnelanim',
]);

/**
 * The mod's rainbow trail. Real instances, deliberately not modelled in the
 * sim, and excluded from every count below — see the header.
 */
const AFTERIMAGES = new Set(['obj_afterimage', 'obj_afterimage_blend']);

// ── plumbing ──────────────────────────────────────────────────────────────

let checks = 0;
let failures = [];
let notes = [];

function ok(cond, msg) {
  checks += 1;
  if (cond) console.log(`  ok   ${msg}`);
  else { failures.push(msg); console.log(`  FAIL ${msg}`); }
}
function note(msg) { notes.push(msg); }

/** f32, because every position built-in narrows on store. */
const f32 = (v) => Math.fround(v);
const uniq = (xs) => [...new Set(xs)].sort((a, b) => a - b);
const fmt = (xs) => `[${xs.join(', ')}]`;

/**
 * The seq companion of a trace file. The recorder writes
 * `kaizo_oracle_trace<TAG>.csv` and `kaizo_oracle_seq<TAG>.csv` side by side,
 * and the TAG is sometimes separated by an underscore (`_deep`) and sometimes
 * not (`fix1`) — so the substitution is on the fixed prefix, never on `_trace`.
 */
function seqPathFor(tracePath) {
  const b = basename(tracePath);
  if (!b.startsWith('kaizo_oracle_trace')) return null;
  return join(dirname(tracePath), `kaizo_oracle_seq${b.slice('kaizo_oracle_trace'.length)}`);
}

/**
 * A cell as a number, or NULL for the empty cell the recorder writes when the
 * thing being measured does not exist.
 *
 * `''` and `0` are DIFFERENT STATES and must not collapse: no soul is not a
 * soul at the origin, and no board is not a board at (0, 0). `Number('')` is
 * 0, so the emptiness test has to come first — the same guard
 * check-oracle-schedule's `num()` carries, and leaving it out here put the
 * whole family's geometry at x 10 (`soul.x + 10` with soul.x read as 0).
 */
function numOrNull(t, r, name) {
  const i = t.col[name];
  if (i === undefined) return null;
  const v = r[i];
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ══════════════════════════════════════════════════════════════════════════
// THE RECORDING SIDE
// ══════════════════════════════════════════════════════════════════════════

/**
 * One entry's measured spawn ledger, from the seq CSV grouped by
 * kaizo_playing plus the box and soul read out of the frame trace.
 *
 * `t` is the manager-relative step index (see the header's frame convention).
 */
function oracleLedger(trace, seq, id) {
  const S = seq.col;
  const raw = seq.rows.filter((r) => r[S.kaizo_playing] === id);
  const spawnsAll = raw.map((r) => ({
    frame: Number(r[S.frame]),
    object: r[S.object],
    x: Number(r[S.x]),
    y: Number(r[S.y]),
    angle: Number(r[S.angle]),
    xscale: Number(r[S.xscale]),
    yscale: Number(r[S.yscale]),
    direction: Number(r[S.direction]),
    speed: Number(r[S.speed]),
  }));
  const spawns = spawnsAll.filter((s) => !AFTERIMAGES.has(s.object));
  const afterimages = spawnsAll.length - spawns.length;

  const managerFrames = spawns.filter((s) => MANAGERS.has(s.object)).map((s) => s.frame);
  const t0 = managerFrames.length ? Math.min(...managerFrames) : null;
  for (const s of spawns) s.t = t0 === null ? null : s.frame - t0;

  // ── THE ATTACK WINDOW ────────────────────────────────────────────────
  //
  // A `kaizo_playing` group does NOT end when the attack does. It runs until
  // the NEXT entry fires, so its tail covers the turn's wind-down, the
  // party's turn, and the NEXT turn's board being raised under mnfight 1.5 —
  // during which the soul is re-delivered to (gt.x - 10, gt.y - 10) and the
  // board is a different board. Reading soul/box over the whole group
  // therefore reports three positions and no fixed board, which is true about
  // the group and false about the attack.
  //
  // The window this file compares is [launch frame .. the last FAMILY spawn]:
  // everything the entry created that this file compares happened inside it,
  // so every geometry assertion below is sampled where the attack was actually
  // running.
  //
  // FAMILY, not "anything that is not an afterimage". Route D's atk_Tunnel2
  // also logs 87 obj_marker — the game's generic one-shot sprite stamp
  // (scr_marker, used all over DELTARUNE; ORACLE-GROUND-TRUTH.md names it) —
  // and the last of them lands 97 frames after the attack's own last creation,
  // inside the NEXT turn's setup where the soul does not exist. Taking the
  // window from those rows put 97 blank soul/board cells inside it and made
  // the preconditions fail for a reason that had nothing to do with the turn.
  const T = trace.col;
  const group = trace.rows.filter((r) => r[T.kaizo_playing] === id);
  const familyFrames = spawns.filter((s) => FAMILY_OBJECTS.has(s.object)).map((s) => s.frame);
  const lastSpawn = familyFrames.length ? Math.max(...familyFrames) : null;
  const rows = group.filter((r) => {
    const f = numOrNull(trace, r, 'frame');
    return f !== null && lastSpawn !== null && f <= lastSpawn;
  });
  const col = (name) => rows.map((r) => numOrNull(trace, r, name));
  const soulX = uniq(col('soul_x').filter((v) => v !== null));
  const soulY = uniq(col('soul_y').filter((v) => v !== null));
  const gtX = uniq(col('gt_x').filter((v) => v !== null));
  const gtY = uniq(col('gt_y').filter((v) => v !== null));
  const gtXs = Math.max(...col('gt_xs').map((v) => v ?? 0));
  const gtYs = Math.max(...col('gt_ys').map((v) => v ?? 0));
  const blanks = rows.filter((r) => numOrNull(trace, r, 'soul_x') === null
    || numOrNull(trace, r, 'gt_x') === null).length;

  return {
    id,
    spawns,
    afterimages,
    managerFrame: t0,
    windowFrames: rows.length,
    groupFrames: group.length,
    blanks,
    launchFrame: group.length ? numOrNull(trace, group[0], 'frame') : null,
    lastSpawnFrame: lastSpawn,
    soulX,
    soulY,
    box: { x: gtX[0], y: gtY[0], xs: gtXs, ys: gtYs },
    boxXValues: gtX,
    boxYValues: gtY,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// THE SIM SIDE
// ══════════════════════════════════════════════════════════════════════════

const IDLE = {
  left: false, right: false, up: false, down: false, focus: false,
};

/**
 * A fight-shaped bench with nothing but the Knight, the board and the soul —
 * no director, so the only thing that ever launches is the row under test.
 */
function bench(seed, sideb = false) {
  const st = createState({ seed, traceBulletSlots: 0 });
  st.view = { x: 0, y: 0 };
  st.hp = 0;
  st.invTimer = -1;
  st.keepAlive = true;   // the party stands back up; the run never stalls on a wipe
  st.damageEnabled = false; // oracle-parity: contact without a Game Over
  st.invc = 1;
  st.gmlRng = gmlCreate(seed);
  st.kaizo = {
    version: sideb ? 'D' : 'C', sideb, approx: [], launched: [], vars: {}, hooks: {},
  };
  st.knight = spawn(st, knightActor, { x: KNIGHT.x, y: KNIGHT.ystart });
  settleBox(spawn(st, battlebox, { x: BOX.x, y: BOX.y }));
  st.soul = spawn(st, soul, { ...SOUL_START });
  return st;
}

/**
 * THE ROUTING EDIT, APPLIED FROM HERE UNTIL THE LAUNCHER CARRIES IT.
 *
 * kaizo/scenes/kaizo-mod-launcher.js case 102 still calls the VANILLA
 * `launchSwordTunnelRevised`, and that file belongs to the integration pass.
 * The two launch functions are line-for-line identical (the controller block
 * is not one of the mod's deltas) and the two Create events differ in exactly
 * one line — `damage = 206` against the mod's `damage = 190`, Create_0:6 — so
 * "spawn the vanilla object, then point it at the kaizo type and set the one
 * field the kaizo Create would have set" IS the routing edit, executed one
 * instant later.
 *
 * That is an argument, so the check does not rely on it: the
 * "the substitution IS the routing edit" section below drives BOTH paths on
 * identical benches and requires the whole resulting ledger to be equal.
 *
 * Once the launcher imports the kaizo module, the entity already has the
 * kaizo type and this function does nothing — so it is safe on both sides of
 * that edit and needs no removal.
 */
function installKaizo102(state) {
  let swapped = 0;
  let already = 0;
  for (const e of state.entities) {
    if (!e.alive || e.type.name !== 'obj_knight_tunnel_slasher_2_revised') continue;
    if (e.type === kaizoTunnelSlasher2) { already += 1; continue; }
    e.type = kaizoTunnelSlasher2;
    e.damage = 190; // kaizo Create_0:6
    swapped += 1;
  }
  return { swapped, already };
}

/**
 * Drive one V-C / V-D row and collect its spawn ledger in the recording's own
 * coordinates: `t` is the manager's step index, so t == 0 is "created by the
 * launch, has not stepped yet" — exactly what the recorder logs.
 *
 * The soul is pinned to the position the RECORDING had at its launch frame.
 * That is an input, not a result: obj_tracking_swords_manager places every
 * sword at `obj_heart.x + 10 + lengthdir_x(len, direction)`, so comparing
 * sword positions across two different soul positions would measure the
 * harness rather than the attack.
 */
function simLedger(entry, soulPos, frames, seed, route) {
  const { sideb } = ROUTE_PARAMS[route];
  const st = bench(seed, sideb);
  openVCArena(st, entry.row, { sideb });
  // The board is raised under mnfight 1.5 and the attack spawns twelve frames
  // later under mnfight 2 (`rtimer == 12`), so the board is already growing
  // while the arena is still empty. Eleven steps puts the sim at the same
  // point of the grow-in the recording is at on its launch frame.
  for (let i = 0; i < 11; i++) stepFrame(st, IDLE);
  st.soul.x = soulPos.x;
  st.soul.y = soulPos.y;
  st.turntimer = vcTurnLength(entry.row, { sideb });

  const before = new Set(st.entities);
  launchVCAttack(st, entry.row, { sideb });
  const install = installKaizo102(st);
  const t0 = st.frame; // the frame index this launch belongs to

  const seen = new Set();
  const spawns = [];
  const record = (e, t) => {
    seen.add(e);
    if (!FAMILY_OBJECTS.has(e.type.name)) return;
    spawns.push({
      t,
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
  // t == 0: everything the launch itself made, before any step.
  for (const e of st.entities) if (!before.has(e)) record(e, 0);

  const soulSeen = new Set();
  for (let f = 0; f < frames; f++) {
    stepFrame(st, IDLE);
    soulSeen.add(`${st.soul.x},${st.soul.y}`);
    for (const e of st.entities) {
      if (!e.alive || seen.has(e)) continue;
      record(e, st.frame - t0);
    }
    // The battle controller's own decrement (mnfight == 2 && timeron == 1).
    if (st.turntimer > 0) st.turntimer -= 1;
  }

  const gt = st.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
  return {
    spawns,
    soulSeen: [...soulSeen],
    approx: st.kaizo.approx,
    install,
    box: {
      x: gt.x, y: gt.y, xs: gt.image_xscale, ys: gt.image_yscale,
    },
  };
}

// ── ledger helpers, shared by both sides ──────────────────────────────────

const countsOf = (spawns) => {
  const m = new Map();
  for (const s of spawns) m.set(s.object, (m.get(s.object) ?? 0) + 1);
  return m;
};
/** distinct spawn frames of one object, ascending, with their group sizes. */
function groupsOf(list) {
  const per = new Map();
  for (const s of list) per.set(s.t, (per.get(s.t) ?? 0) + 1);
  const ts = [...per.keys()].sort((a, b) => a - b);
  return { ts, sizes: ts.map((t) => per.get(t)), per };
}
const gapsOf = (ts) => ts.slice(1).map((v, i) => v - ts[i]);

/** Print a ledger block — the deliverable, printed whether or not it passes. */
function printLedger(label, spawns, extra = '') {
  const c = countsOf(spawns);
  console.log(`  ${label}${extra}`);
  for (const [o, n] of [...c.entries()].sort((a, b) => b[1] - a[1])) {
    const list = spawns.filter((s) => s.object === o);
    const { ts, sizes } = groupsOf(list);
    const g = uniq(gapsOf(ts));
    console.log(`      ${o.padEnd(38)} x${String(n).padStart(3)}`
      + `  t ${ts[0]}..${ts[ts.length - 1]}`
      + `  groups ${ts.length} of ${uniq(sizes).join('/')}`
      + `  gaps ${g.length ? fmt(g) : '-'}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// THE BLADE WALL'S CLOSED FORM
// ══════════════════════════════════════════════════════════════════════════

/**
 * The manager-steps atk_Tunnel2 fires on, derived from the mod's GML alone —
 * no recorded value, no fitted constant, and therefore assertable against BOTH
 * sides rather than transcribed from one of them.
 *
 *   the gate      `(con >= 0.2 && turn_type == "full") || con` opens on the
 *                 step `introtimer` reaches 5, since `|| con` is false below
 *                 0.5 (GML truthiness). GATE_STEP = 5.
 *   the tick      `timer++` and `fake_timer++` are the FIRST statements inside
 *                 the gate, so the opening step is already tick 1 and
 *                 tick(t) == t - GATE_STEP + 1. Counting the gate's own step
 *                 as tick 0 is the "count n - 1" off-by-one CLAUDE.md records
 *                 for a delayed tween, and it puts every volley one step late.
 *   real volleys  fire and reset at `timer >= _delay` -> every t whose tick is
 *                 a multiple of `delay`; the first is GATE_STEP - 1 + delay.
 *   decoys        `fake_timer` is never reset, so the gate
 *                 `fake_timer > 2*_fdelay && (fake_timer + 2*_fdelay) % _fdelay == 0`
 *                 reads straight off the same tick.
 *   the end       `local_turntimer` starts at 240 (Other_10's "full" arm) and
 *                 the `< 60` finale test fires at step 181, which `exit`s
 *                 before either gate. LAST_STEP = 180.
 *
 * Route C gives reals 12, 20 ... 180 and decoys 16, 20 ... 180 (42 of them);
 * route D gives reals 11, 18 ... 179 and decoys 13, 16 ... 178 (56). Both are
 * exactly what the two recordings contain.
 */
const GATE_STEP = 5;
const LAST_STEP = 180; // local_turntimer 240 - 60, the step before the finale
function expectedVolleys(delay, fdelay) {
  const realTs = [];
  const fakeTs = [];
  for (let t = GATE_STEP; t <= LAST_STEP; t += 1) {
    const tick = t - GATE_STEP + 1;
    if (tick % delay === 0) realTs.push(t);
    if (tick > fdelay * 2 && (tick + fdelay * 2) % fdelay === 0) fakeTs.push(t);
  }
  return { realTs, fakeTs };
}

/**
 * `_cap = 38` and the one drift step between placement and the log.
 *
 * The clamp puts a real blade EXACTLY 38 from the board centre, on whichever
 * side its own `sign(_yy - mbox)` chose. Both sides then log it after one
 * motion step of `vspeed = dorifto` with `dorifto = 0.1 + random(0.5) *
 * choose(1, -1)` (kaizo Step_0:271), so |dorifto| <= 0.6 and the logged
 * distance from the centre is 38 +/- 0.6. Every number here is a GML literal;
 * none of it is a tolerance.
 *
 * On both recorded boards it is the LOWER blade that gets capped (its
 * uncapped `_yy` runs 4..18px from the centre for a low hole, while the upper
 * blade's never comes within 42), so the observed values sit in the upper half
 * of that band — 38.0643 on route C, 37.6887 on route D. The band asserted is
 * the one the GML guarantees, not the half this pair of recordings happened to
 * land in.
 */
const CAP = 38;
const DORIFTO_MAX = 0.6;

// ══════════════════════════════════════════════════════════════════════════
// ONE RECORDING
// ══════════════════════════════════════════════════════════════════════════

/** Seeds the RNG-shape assertions are aggregated over, so no result is a lucky draw. */
const SEEDS = [1, 2, 3, 7, 12345, 20260810];

function runRecording(tracePath, seqPath, route) {
  checks = 0;
  failures = [];
  notes = [];

  const { sideb, delay, fdelay } = ROUTE_PARAMS[route];
  const entries = ENTRIES_BY_ROUTE[route];
  const full = route === 'C';

  // The SAME parser check-oracle-schedule uses, deliberately: two readers of
  // one recording that disagree about a blank cell or a trailing line is a
  // divergence between checks, not between the sim and the mod.
  const trace = readTrace(tracePath);
  const seq = readTrace(seqPath);
  for (const need of ['frame', 'soul_x', 'soul_y', 'gt_x', 'gt_y', 'gt_xs', 'gt_ys', 'kaizo_playing']) {
    if (trace.col[need] === undefined) {
      console.log(`FAIL check-oracle-tunnel: ${tracePath} has no "${need}" column`);
      return 1;
    }
  }
  for (const need of ['frame', 'object', 'x', 'y', 'angle', 'xscale', 'yscale', 'direction', 'speed', 'kaizo_playing']) {
    if (seq.col[need] === undefined) {
      console.log(`FAIL check-oracle-tunnel: ${seqPath} has no "${need}" column`);
      return 1;
    }
  }
  if (seq.col.kaizo_playing === undefined) {
    // Belt and braces: the pointer column would shift every row by one turn.
    console.log('FAIL check-oracle-tunnel: the seq log predates the kaizo_playing column;');
    console.log('     grouping by kaizo_atk attributes every spawn to the WRONG entry.');
    return 1;
  }

  console.log(`check-oracle-tunnel: ${tracePath}`);
  console.log(`                     ${seqPath}`);
  console.log(`  route ${route} (${sideb ? 'B-Side' : 'ordinary'}), _delay ${delay},`
    + ` _fdelay ${fdelay} — ${trace.rows.length} frames, ${seq.rows.length} spawn rows`);
  if (!full) {
    console.log('  atk_Tunnel2 ONLY on this route. The blade wall is what');
    console.log('  kaizo/attacks/sword-tunnel-revised.js owns; atk_Tunnel1\'s corridor and');
    console.log('  the type-151 chain belong to kaizo/attacks/sword-tunnel.js and');
    console.log('  kaizo/attacks/tracking-swords.js and are NOT claimed here on route D.');
  }
  console.log('');

  const O = {};
  for (const e of entries) O[e.id] = oracleLedger(trace, seq, e.id);

  // ── POSITIVE EXECUTION GUARD ────────────────────────────────────────────
  // Nothing below is worth reading if the recording did not actually contain
  // the turns. A negative result is only evidence if the instrument could
  // have produced a positive one.
  for (const e of entries) {
    const L = O[e.id];
    if (!L.spawns.length || L.managerFrame === null) {
      console.log(`FAIL check-oracle-tunnel: ${e.id} has no non-afterimage spawn rows in`);
      console.log('     this recording — there is nothing to compare against.');
      return 1;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // THE MEASURED ORACLE LEDGER — printed first, because it is the ground
  // truth this file exists to record and it is worth having even when the
  // comparison below is hard.
  // ══════════════════════════════════════════════════════════════════════
  console.log('THE RECORDED SPAWN LEDGER (grouped by kaizo_playing, afterimages excluded)');
  for (const e of entries) {
    const L = O[e.id];
    printLedger(`${e.id}  ac ${e.row.ac} d${e.row.difficulty} phase ${e.row.phase}`,
      L.spawns,
      `   launch f${L.launchFrame}, manager f${L.managerFrame},`
      + ` window f${L.launchFrame}..f${L.lastSpawnFrame} (${L.windowFrames} of`
      + ` ${L.groupFrames} group frames), box (${L.box.x}, ${L.box.y})`
      + ` ${L.box.xs} x ${L.box.ys},`
      + ` soul (${L.soulX.join('/')}, ${L.soulY.join('/')}),`
      + ` ${L.afterimages} afterimage(s) ignored`);
  }
  console.log('');

  // The soul must be STILL for the whole attack window, or pinning the sim's
  // soul to one position is not a faithful reproduction of the input.
  console.log('the recording\'s own preconditions');
  for (const e of entries) {
    const L = O[e.id];
    ok(L.blanks === 0,
      `${e.id}: the soul and the board exist on every frame of the attack window`
      + ` (${L.windowFrames} frames, ${L.blanks} blank)`);
    ok(L.soulX.length === 1 && L.soulY.length === 1,
      `${e.id}: the soul is stationary for the whole attack at`
      + ` (${L.soulX.join('/')}, ${L.soulY.join('/')}) — the sim can be pinned there`);
    ok(L.boxXValues.length === 1 && L.boxYValues.length === 1,
      `${e.id}: the board does not travel (x ${fmt(L.boxXValues)}, y ${fmt(L.boxYValues)})`);
    const mgrs = uniq(L.spawns.filter((s) => MANAGERS.has(s.object)).map((s) => s.frame));
    ok(mgrs.length === 1,
      `${e.id}: every manager object appears on ONE frame (f${mgrs.join('/')}),`
      + ' so the manager-relative clock has a single origin');
  }
  console.log('');

  // ── drive the sim ───────────────────────────────────────────────────────
  const S = {};
  const SS = {};
  for (const e of entries) {
    const L = O[e.id];
    const soulPos = { x: L.soulX[0], y: L.soulY[0] };
    // Long enough that neither side is cut short: the recording's own window
    // plus a margin, so a sim that keeps spawning past the mod's cutoff is
    // VISIBLE rather than truncated into agreement.
    const frames = (L.lastSpawnFrame - L.launchFrame) + 140;
    S[e.id] = simLedger(e, soulPos, frames, 12345, route);
    SS[e.id] = SEEDS.map((s) => simLedger(e, soulPos, frames, s, route));
  }

  console.log('THE SIM\'S SPAWN LEDGER (same launcher row, same soul, seed 12345)');
  for (const e of entries) {
    printLedger(`${e.id}`, S[e.id].spawns,
      `   box (${S[e.id].box.x}, ${S[e.id].box.y}) ${S[e.id].box.xs} x ${S[e.id].box.ys},`
      + ` soul ${S[e.id].soulSeen.join(' ')},`
      + ` ${S[e.id].approx.length} ledger row(s)`);
  }
  console.log('');

  // ══════════════════════════════════════════════════════════════════════
  // 0. THE BOARD — every position below is measured off it.
  // ══════════════════════════════════════════════════════════════════════
  console.log('the board (obj_growtangle), which everything here is relative to');
  for (const e of entries) {
    const L = O[e.id];
    const g = arenaGeom(e.row, sideb);
    ok(S[e.id].box.x === L.box.x && S[e.id].box.y === L.box.y,
      `${e.id}: board placement — oracle (${L.box.x}, ${L.box.y}),`
      + ` sim (${S[e.id].box.x}, ${S[e.id].box.y}) [table asks ${g.x + g.dx}, ${g.y + g.dy}]`);
    ok(f32(S[e.id].box.xs) === f32(L.box.xs) && f32(S[e.id].box.ys) === f32(L.box.ys),
      `${e.id}: board scale — oracle ${L.box.xs} x ${L.box.ys},`
      + ` sim ${S[e.id].box.xs} x ${S[e.id].box.ys}`);
  }
  // The half-to-even showcase, stated explicitly because this family is where
  // it bites: obj_growtangle quantises a non-even scale to multiples of 1/37.5,
  // and ac 13 asks for 3. 3 * 37.5 = 112.5 exactly, which GML's HALF-TO-EVEN
  // round sends DOWN to 112, so the real board is 112/37.5 = 2.98666...
  // JS Math.round would give 113 and a board 1/37.5 too wide — and since every
  // sword_tunnel_sword, every tracking sword and every blade below is placed
  // off this board, that error would be everywhere at once.
  if (full) {
    ok(f32(O.atk_Tunnel1.box.xs) === f32(112 / 37.5),
      `atk_Tunnel1: the recorded board is 112/37.5 = ${(112 / 37.5).toFixed(10)},`
      + ' NOT 3 and not Math.round\'s 113/37.5 — half-to-even, measured');
    ok(f32(O.atk_Tunnel1.box.xs) !== f32(113 / 37.5),
      'atk_Tunnel1: and it is provably not the Math.round board (control)');
  }
  console.log('');

  // ══════════════════════════════════════════════════════════════════════
  // 1. THE OBJECT SETS
  // ══════════════════════════════════════════════════════════════════════
  //
  // Route D only: the recording's atk_Tunnel2 also carries 87 obj_marker, the
  // game's GENERIC one-shot sprite stamp (scr_marker / scr_dark_marker, used
  // all over DELTARUNE and named as such in ORACLE-GROUND-TRUTH.md). They
  // appear from manager-step 44, which is where the type-151 chain's first
  // slash lands, so they belong to the tracking swords rather than to the
  // blade wall. Route D therefore compares the objects it names, one at a
  // time, instead of asserting a closed set it does not own.
  if (full) {
    console.log('the set of objects each entry creates');
    for (const e of entries) {
      const oSet = [...countsOf(O[e.id].spawns).keys()].sort();
      const sSet = [...countsOf(S[e.id].spawns).keys()].sort();
      ok(oSet.every((o) => FAMILY_OBJECTS.has(o)),
        `${e.id}: the recording creates only known family objects — ${oSet.join(' ')}`);
      ok(oSet.join(' ') === sSet.join(' '),
        `${e.id}: object set — oracle {${oSet.join(' ')}}, sim {${sSet.join(' ')}}`);
    }
    // The two entries are DIFFERENT attacks and the object set says so: only
    // Tunnel1 raises the wind-up animation and the corridor manager, only
    // Tunnel2 raises the revised slasher and its blades. A check that passed
    // with the two swapped would not be checking anything.
    const has = (id, o) => O[id].spawns.some((s) => s.object === o);
    ok(has('atk_Tunnel1', 'obj_sword_tunnel_sword') && !has('atk_Tunnel2', 'obj_sword_tunnel_sword'),
      'obj_sword_tunnel_sword is Tunnel1 ONLY (type 153 -> obj_sword_tunnel_manager)');
    ok(has('atk_Tunnel2', 'obj_knight_diamondswordbullet_ext')
      && !has('atk_Tunnel1', 'obj_knight_diamondswordbullet_ext'),
      'obj_knight_diamondswordbullet_ext is Tunnel2 ONLY (type 102 -> the revised slasher)');
    ok(has('atk_Tunnel1', 'obj_tracking_sword1') && has('atk_Tunnel2', 'obj_tracking_sword1'),
      'both entries chain a type-151 tracking-swords manager');
    console.log('');
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. atk_Tunnel1 — THE CORRIDOR (obj_sword_tunnel_sword)
  //
  // obj_sword_tunnel_manager Step, tobymode 0:
  //     sword = instance_create(swordx, swordy - 50 - (gapsize / 2), ...)  angle 270
  //     sword = instance_create(swordx, swordy + 50 + (gapsize / 2), ...)  angle  90
  // with swordx = camerax() + camerawidth() + 20, swordy starting at
  // obj_growtangle.y, and `if (movedirection == "up") swordy -= verticalchange`.
  // difficulty 4 gives rate 4 / gapsize 40 / verticalchange 10.
  // ══════════════════════════════════════════════════════════════════════
  if (full) {
    console.log('atk_Tunnel1 — the sword corridor');
    const e = ENTRIES[0];
    const halfGap = 50 + e.tunnelGap / 2; // 70
    const boardY = O[e.id].box.y;
    const analyse = (spawns, label) => {
      const list = spawns.filter((s) => s.object === 'obj_sword_tunnel_sword');
      const { ts, sizes, per } = groupsOf(list);
      const mids = [];
      let badPair = 0;
      for (const t of ts) {
        const g = list.filter((s) => s.t === t);
        const up = g.find((s) => s.angle === 270);
        const dn = g.find((s) => s.angle === 90);
        if (g.length !== 2 || !up || !dn || dn.y - up.y !== 2 * halfGap) badPair += 1;
        else mids.push((up.y + dn.y) / 2);
      }
      return {
        label, list, ts, sizes, per, mids, badPair, gaps: uniq(gapsOf(ts)),
      };
    };
    const o = analyse(O[e.id].spawns, 'oracle');
    const s = analyse(S[e.id].spawns, 'sim');

    // ── the count law ─────────────────────────────────────────────────────
    // The manager's Create sets `timer = -40 + irandom(10)` and its Step
    // fires when `timer >= rate` (4), so the FIRST pair lands on manager-step
    // t1 = 44 - irandom(10), i.e. t1 in 34..44 — LIVE RNG, and it is the only
    // thing that varies. Spawning stops when `finishtimer == finishtimermax`
    // (230), and finishtimer is the step index, so the last pair is the last
    // t <= 229. Both sides must obey the same closed form; only t1 differs.
    const law = (t1) => ({
      groups: Math.floor((229 - t1) / 4) + 1,
      last: t1 + 4 * Math.floor((229 - t1) / 4),
    });
    for (const r of [o, s]) {
      const t1 = r.ts[0];
      const L = law(t1);
      ok(t1 >= 34 && t1 <= 44,
        `${r.label}: first pair at manager-step ${t1}, inside the 34..44 window`
        + ' `timer = -40 + irandom(10)` permits (obj_sword_tunnel_manager Create)');
      ok(r.ts.length === L.groups && r.ts[r.ts.length - 1] === L.last,
        `${r.label}: ${r.ts.length} pairs ending at t${r.ts[r.ts.length - 1]} — the`
        + ` finishtimermax-230 cutoff predicts ${L.groups} ending at t${L.last}`);
      ok(r.sizes.every((n) => n === 2),
        `${r.label}: every group is exactly TWO swords (${r.ts.length} groups)`);
      ok(r.gaps.length === 1 && r.gaps[0] === e.tunnelRate,
        `${r.label}: cadence is one pair every ${e.tunnelRate} frames (gaps ${fmt(r.gaps)})`);
      ok(r.badPair === 0,
        `${r.label}: every pair is one angle-270 sword ${2 * halfGap}px above an`
        + ` angle-90 sword (gapsize ${e.tunnelGap} -> 50 + gapsize/2 = ${halfGap} each side)`);
      const xs = uniq(r.list.map((v) => v.x));
      ok(xs.length === 1 && xs[0] === 660,
        `${r.label}: every sword spawns at x ${fmt(xs)} = camerax + camerawidth + 20`);
      ok(r.list.every((v) => v.xscale === 1 && v.yscale === 0
        && v.direction === 0 && v.speed === 0),
        `${r.label}: every sword is xscale 1, yscale 0, direction 0, speed 0`);
      ok(r.list.every((v) => (v.y - boardY) % e.verticalChange === 0),
        `${r.label}: every sword y is a multiple of verticalchange ${e.verticalChange}`
        + ` off the board's y (${boardY})`);
      const midD = uniq(r.mids.slice(1).map((v, i) => v - r.mids[i]));
      ok(midD.every((d) => Math.abs(d) === e.verticalChange || d === 0),
        `${r.label}: the corridor's centre steps by 0 or +/-${e.verticalChange}`
        + ` between pairs (${fmt(midD)}) — the up/down/none walk`);
    }
    // The recorded draw, for the record. 96 is what THIS recording rolled;
    // the mod can legitimately produce 94 or 98 from the same code.
    const oCount = o.list.length;
    ok(oCount === 2 * o.ts.length,
      `oracle: ${oCount} swords = 2 x ${o.ts.length} pairs (the recording's own draw)`);
    const simCounts = uniq(SS[e.id].map((r) => r.spawns.filter((v) => v.object === 'obj_sword_tunnel_sword').length));
    ok(simCounts.every((n) => n >= 94 && n <= 98 && n % 2 === 0),
      `sim over ${SEEDS.length} seeds: sword counts ${fmt(simCounts)}, all inside the`
      + ' 94..98 the irandom(10) start offset permits (oracle drew ' + oCount + ')');
    ok(simCounts.includes(oCount),
      `sim reaches the recording's own count (${oCount}) on at least one seed`);
    console.log('');
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. THE TRACKING SWORDS (dc.type 151).
  //
  // obj_tracking_swords_manager Step places each sword at
  //     x = obj_heart.x + 10 + lengthdir_x(len, direction)
  //     y = obj_heart.y + 10 + lengthdir_y(len, direction)
  // with len 120 at birth (Create) and the setdirection[] string overriding
  // every heading to the 90 / 270 alternation for variants 4 and 7.
  // obj_tracking_sword1's own Step then clamps y to [cameray+40, cameray+320]
  // and eases len to lenstart + 10 = 130 before the slash fires.
  //
  // On route D only atk_Tunnel2's chain is compared — see SCOPE in the header.
  // ══════════════════════════════════════════════════════════════════════
  console.log('the tracking swords (type 151) — heart-relative geometry');
  for (const e of entries) {
    const L = O[e.id];
    const soulX = L.soulX[0];
    const soulY = L.soulY[0];
    for (const [label, spawns] of [['oracle', L.spawns], ['sim', S[e.id].spawns]]) {
      const sw = spawns.filter((s) => s.object === 'obj_tracking_sword1');
      const sl = spawns.filter((s) => s.object === 'obj_tracking_sword_slash');
      ok(sw.length > 0 && sl.length > 0,
        `${e.id} ${label}: the type-151 chain actually fired`
        + ` (${sw.length} sword(s), ${sl.length} slash(es))`);
      ok(sw.every((v) => v.x === soulX + 10),
        `${e.id} ${label}: every sword at x = soul.x + 10 = ${soulX + 10}`
        + ` (lengthdir_x(len, 90|270) is 0)`);
      // len 120 at birth; the y is clamped into the camera band.
      ok(sw.every((v) => v.y === Math.min(Math.max(
        soulY + 10 + (v.direction === 90 ? -120 : 120), 40), 320)),
        `${e.id} ${label}: every sword at soul.y + 10 -/+ len(120), clamped to`
        + ` [40, 320] — ${fmt(uniq(sw.map((v) => v.y)))}`);
      ok(sw.every((v) => v.angle === v.direction + 180),
        `${e.id} ${label}: image_angle is direction + 180 on every sword`);
      const dirs = sw.map((v) => v.direction);
      ok(dirs.every((d, i) => d === (i % 2 === 0 ? 90 : 270)),
        `${e.id} ${label}: headings alternate 90/270 from the setdirection[] string`
        + ` (${dirs.join(',')})`);
      ok(sw.every((v) => v.xscale === 1 && v.yscale === 1 && v.speed === 0),
        `${e.id} ${label}: swords are xscale 1, yscale 1, speed 0`);
      // The slash: one per sword, fixed lag, same x, and the len has eased to
      // 130 by the time it fires — which the upper/lower asymmetry proves,
      // because 130 puts the lower slash past the clamp and the upper one not.
      ok(sl.length === sw.length,
        `${e.id} ${label}: exactly one slash per sword (${sl.length}/${sw.length})`);
      const lags = uniq(sw.map((v, i) => (sl[i] ? sl[i].t - v.t : NaN)));
      ok(lags.length === 1 && lags[0] === 39,
        `${e.id} ${label}: every slash lands exactly 39 frames after its sword`
        + ` (lags ${fmt(lags)}) — con 0->1->2->3 plus the timer-2 spawn`);
      ok(sl.every((v) => v.x === soulX + 10),
        `${e.id} ${label}: slashes inherit the sword's x (${soulX + 10})`);
      ok(sl.every((v) => v.y === Math.min(Math.max(
        soulY + 10 + (v.direction === 90 ? -130 : 130), 40), 320)),
        `${e.id} ${label}: slashes at soul.y + 10 -/+ len(130) CLAMPED to [40, 320]`
        + ` — ${fmt(uniq(sl.map((v) => v.y)))}`);
      ok(sl.every((v) => v.xscale === 900),
        `${e.id} ${label}: every slash is image_xscale 900 (the 900px reach)`);
    }
    // The cadence is the variant's own rate table and is RNG-free.
    const oSw = L.spawns.filter((s) => s.object === 'obj_tracking_sword1');
    const sSw = S[e.id].spawns.filter((s) => s.object === 'obj_tracking_sword1');
    const oG = gapsOf(oSw.map((v) => v.t));
    const sG = gapsOf(sSw.map((v) => v.t));
    ok(oSw[0].t === sSw[0].t,
      `${e.id}: the first tracking sword lands on the same manager-step`
      + ` (oracle t${oSw[0].t}, sim t${sSw[0].t}) — timer = rate - 5`);
    ok(sG.join(',') === oG.join(','),
      `${e.id}: cadence — oracle ${fmt(oG)}, sim ${fmt(sG)}`);
    // THE `state == "final"` DESTROY, seen from the other end. This is the
    // count the mod's kaizo-only `with (obj_tracking_swords_manager)
    // instance_destroy(...)` produces: the wall's finale deletes the chained
    // manager at its step 182, and the 9th sword would have landed at 189.
    ok(sSw.length === oSw.length,
      `${e.id}: tracking sword COUNT — oracle ${oSw.length}, sim ${sSw.length}`);
  }
  {
    // The positive form of the same claim, stated where it can be read: the
    // cut-off is what distinguishes the mod from vanilla here, so say the
    // number and say when it happens rather than only that the two agree.
    const L = O.atk_Tunnel2;
    const oSw = L.spawns.filter((s) => s.object === 'obj_tracking_sword1');
    const lastT = oSw[oSw.length - 1].t;
    ok(oSw.length === 8 && lastT < 182,
      `atk_Tunnel2: the recording's tracking chain STOPS at ${oSw.length} swords,`
      + ` last at manager-step ${lastT} — before the slasher's finale destroys the`
      + ' manager at step 182 (kaizo Step_0:81-84; vanilla runs to 14)');
    ok(gapsOf(oSw.map((v) => v.t)).join(',') === '30,28,26,24,22,20,18',
      'atk_Tunnel2: and the eight gaps are [30 28 26 24 22 20 18] — variant 7\'s'
      + ' rate 32 with ratedecay 2, so the cut-off is not the cadence running out');
  }
  console.log('');

  // ══════════════════════════════════════════════════════════════════════
  // 4. THE MANAGERS AND THE WIND-UP
  // ══════════════════════════════════════════════════════════════════════
  console.log('the managers');
  for (const e of entries) {
    const L = O[e.id];
    for (const [label, spawns] of [['oracle', L.spawns], ['sim', S[e.id].spawns]]) {
      const mgrs = spawns.filter((s) => s.object === 'obj_tracking_swords_manager'
        || s.object === 'obj_sword_tunnel_manager');
      ok(mgrs.length > 0 && mgrs.every((m) => m.x === L.box.x && m.y === 0),
        `${e.id} ${label}: every controller manager at (obj_growtangle.x, cameray())`
        + ` = (${L.box.x}, 0) — ${mgrs.map((m) => `${m.object}@${m.x},${m.y}`).join(' ')}`);
      ok(mgrs.every((m) => m.t === 0),
        `${e.id} ${label}: the managers exist on the launch's own frame (t0)`);
    }
  }
  // The wind-up / slasher is created at obj_knight_enemy's live position. Only
  // x is comparable — see the header on the Knight's bob.
  const windups = full
    ? [['atk_Tunnel1', 'obj_knight_swordtunnelanim'],
      ['atk_Tunnel2', 'obj_knight_tunnel_slasher_2_revised']]
    : [['atk_Tunnel2', 'obj_knight_tunnel_slasher_2_revised']];
  for (const [id, obj] of windups) {
    const o = O[id].spawns.find((s) => s.object === obj);
    const s = S[id].spawns.find((s2) => s2.object === obj);
    ok(o && s && o.x === s.x && o.x === KNIGHT.x,
      `${id}: ${obj} spawns at the Knight's x (${KNIGHT.x}) on both sides`);
    ok(o && s && o.xscale === s.xscale && o.yscale === s.yscale,
      `${id}: ${obj} scale — oracle ${o && o.xscale}x${o && o.yscale},`
      + ` sim ${s && s.xscale}x${s && s.yscale}`);
    note(`${id}: ${obj} y is the Knight's idle bob and is NOT comparable`
      + ` — oracle ${o && o.y}, sim ${s && s.y}; the recording itself gives two`
      + ' different values for the two turns.');
  }
  console.log('');

  // ══════════════════════════════════════════════════════════════════════
  // 5. atk_Tunnel2 — THE BLADE WALL (obj_knight_diamondswordbullet_ext)
  //
  // obj_knight_tunnel_slasher_2_revised Step, per firing frame:
  //     REAL  scr_fire_bullet(scr_get_box(0) + 40, _yy, ..., 180, 0.5)
  //           image_xscale = 15, image_angle 270 (upper) / 90 (lower),
  //           gravity_direction 180, gravity 0.4, vspeed = dorifto,
  //           and the mod's `_cap = 38` pushes _yy away from the box centre.
  //     FAKE  scr_fire_bullet(scr_get_box(0) + 40,
  //                           obj_growtangle.y + random_range(30, 50) * choose(-1, 1),
  //                           ..., 180, 0.35)
  //           image_xscale = 0, vspeed = dorifto * 2.
  // Both are logged AFTER one motion step, so the recorded speed/direction
  // already carry the gravity kick: hspeed = -(0.5 + 0.4) and -(0.35 + 0.4).
  // ══════════════════════════════════════════════════════════════════════
  console.log('atk_Tunnel2 — the blade wall');
  {
    const id = 'atk_Tunnel2';
    const L = O[id];
    // scr_get_box(0) = obj_growtangle.x + sprite_width * 0.5, and
    // spr_battlebg_stretch_hitbox is 75px wide. The blade is created there +40
    // and stored into an f32 built-in, THEN moved once before the recorder
    // sees it: hspeed = -(fire speed + gravity 0.4).
    const boxRight = f32(L.box.x + (75 * L.box.xs) / 2);
    const spawnX = (fireSpeed) => f32(f32(boxRight + 40) - (fireSpeed + 0.4));
    const mbox = L.box.y;                            // mean(box top, box bottom)
    const hs = (b) => b.speed * Math.cos((b.direction * Math.PI) / 180);
    const vs = (b) => -b.speed * Math.sin((b.direction * Math.PI) / 180);
    const want = expectedVolleys(delay, fdelay);

    for (const [label, spawns] of [['oracle', L.spawns], ['sim', S[id].spawns]]) {
      const all = spawns.filter((s) => s.object === 'obj_knight_diamondswordbullet_ext');
      const real = all.filter((b) => b.xscale === 15);
      const fake = all.filter((b) => b.xscale === 0);
      ok(all.length === real.length + fake.length,
        `${label}: every blade is either a real (image_xscale 15) or a decoy`
        + ` (image_xscale 0) — ${real.length} + ${fake.length} of ${all.length}`);
      ok(all.length > 0 && real.length > 0 && fake.length > 0,
        `${label}: the slasher fired both blade kinds`
        + ` (${real.length} real at xscale 15, ${fake.length} decoy at xscale 0)`);

      // ── THE CADENCE, against the closed form and not against each other ──
      // `_delay` and `_fdelay` are the mod's own per-route constants; every t
      // below comes out of the GML, so a run where BOTH sides drifted the same
      // way still fails.
      const realTs = groupsOf(real).ts;
      const fakeTs = groupsOf(fake).ts;
      ok(realTs.join(',') === want.realTs.join(','),
        `${label}: real volleys land on manager-steps ${want.realTs[0]},`
        + ` ${want.realTs[1]} ... ${want.realTs[want.realTs.length - 1]}`
        + ` — the gate opening at introtimer 5 plus \`timer >= _delay\` (${delay});`
        + ` got ${realTs.length} at ${realTs[0]}..${realTs[realTs.length - 1]}`
        + `${realTs.join(',') === want.realTs.join(',') ? '' : ` = ${fmt(realTs)}`}`);
      ok(fakeTs.join(',') === want.fakeTs.join(','),
        `${label}: decoys land on manager-steps ${want.fakeTs[0]}, ${want.fakeTs[1]}`
        + ` ... ${want.fakeTs[want.fakeTs.length - 1]} — \`fake_timer > 2*_fdelay\``
        + ` with _fdelay ${fdelay}; got ${fakeTs.length} at`
        + ` ${fakeTs[0]}..${fakeTs[fakeTs.length - 1]}`);
      // The decoy COUNT is fully RNG-free (one per qualifying step, always),
      // so it is a straight equality rather than a band.
      ok(fake.length === want.fakeTs.length,
        `${label}: exactly ${want.fakeTs.length} decoys — one per qualifying step,`
        + ` never RNG-gated (got ${fake.length})`);
      // The reals are 1 or 2 per volley: `vertical_pos > -20` fires the upper
      // blade and `vertical_pos < 20` the lower, and vertical_pos is clamped
      // into [-60, 60], so at least one of the two always fires.
      const perVolley = uniq(realTs.map((t) => real.filter((b) => b.t === t).length));
      ok(perVolley.every((n) => n === 1 || n === 2),
        `${label}: every real volley is ONE or TWO blades (${fmt(perVolley)}) —`
        + ' `vertical_pos > -20` and `vertical_pos < 20` can never both be false');

      ok(uniq(real.map((b) => f32(b.x))).join() === String(spawnX(0.5)),
        `${label}: every real blade at scr_get_box(0) + 40, moved by -(0.5 + gravity`
        + ` 0.4) = ${spawnX(0.5)} — ${fmt(uniq(real.map((b) => b.x)))}`);
      ok(uniq(fake.map((b) => f32(b.x))).join() === String(spawnX(0.35)),
        `${label}: every decoy at scr_get_box(0) + 40, moved by -(0.35 + gravity`
        + ` 0.4) = ${spawnX(0.35)} — ${fmt(uniq(fake.map((b) => b.x)))}`);
      ok(uniq(real.map((b) => b.angle)).join(',') === '90,270',
        `${label}: real blades come as angle-270 (upper) and angle-90 (lower)`);
      ok(uniq(fake.map((b) => b.angle)).join(',') === '90',
        `${label}: decoys are always image_angle 90`);
      ok(all.every((b) => b.yscale === 1),
        `${label}: every blade is image_yscale 1`);
      ok(real.every((b) => Math.abs(f32(hs(b)) + 0.9) < 1e-6),
        `${label}: every real blade's hspeed is exactly -(0.5 + 0.4)`);
      ok(fake.every((b) => Math.abs(f32(hs(b)) + 0.75) < 1e-6),
        `${label}: every decoy's hspeed is exactly -(0.35 + 0.4)`);
    }

    // ── the drift, aggregated over seeds so no single draw decides it ─────
    // `vspeed = dorifto` (real) and `vspeed = dorifto * 2` (decoy). The
    // recording shows the whole wall sagging and rising; a wall with no
    // vertical component at all is a different attack to dodge.
    const oAll = L.spawns.filter((s) => s.object === 'obj_knight_diamondswordbullet_ext');
    const oReal = oAll.filter((b) => b.xscale === 15);
    const oFake = oAll.filter((b) => b.xscale === 0);
    const oRealV = oReal.map(vs);
    const oFakeV = oFake.map(vs);
    ok(uniq(oAll.map((b) => b.direction)).length > 10,
      `oracle: the wall drifts — ${uniq(oAll.map((b) => b.direction)).length} distinct`
      + ` headings across ${oAll.length} blades`);
    const simV = SS[id].flatMap((r) => r.spawns
      .filter((s) => s.object === 'obj_knight_diamondswordbullet_ext').map(vs));
    const simDirs = uniq(SS[id].flatMap((r) => r.spawns
      .filter((s) => s.object === 'obj_knight_diamondswordbullet_ext').map((b) => b.direction)));
    ok(simDirs.length > 10,
      `sim over ${SEEDS.length} seeds: the wall drifts too —`
      + ` ${simDirs.length} distinct headings (oracle`
      + ` ${uniq(oAll.map((b) => b.direction)).length}); observed ${fmt(simDirs.slice(0, 6))}`);
    ok(Math.max(...simV.map(Math.abs)) > 0.05,
      `sim: blades carry a nonzero vspeed (max |vspeed| ${Math.max(...simV.map(Math.abs)).toFixed(6)};`
      + ` oracle real ${Math.min(...oRealV).toFixed(4)}..${Math.max(...oRealV).toFixed(4)},`
      + ` decoy ${Math.min(...oFakeV).toFixed(4)}..${Math.max(...oFakeV).toFixed(4)})`);
    // The drift's own envelope, from the two GML lines and nothing else:
    // |dorifto| <= 0.6 on a real blade and <= 1.7 on a decoy
    // (0.25 + random(0.6), doubled). A sim that over-drove the component
    // would pass the "it moves at all" test above and fail here.
    ok(Math.max(...oRealV.map(Math.abs)) <= DORIFTO_MAX
      && Math.max(...oFakeV.map(Math.abs)) <= 1.7,
      `oracle: the drift stays inside the draws' own envelope (real <= ${DORIFTO_MAX},`
      + ` decoy <= 1.7)`);
    const simRealV = SS[id].flatMap((r) => r.spawns
      .filter((s) => s.object === 'obj_knight_diamondswordbullet_ext' && s.xscale === 15)
      .map(vs));
    const simFakeV = SS[id].flatMap((r) => r.spawns
      .filter((s) => s.object === 'obj_knight_diamondswordbullet_ext' && s.xscale === 0)
      .map(vs));
    ok(Math.max(...simRealV.map(Math.abs)) <= DORIFTO_MAX
      && Math.max(...simFakeV.map(Math.abs)) <= 1.7,
      `sim over ${SEEDS.length} seeds: the drift stays inside the same envelope`
      + ` (real max ${Math.max(...simRealV.map(Math.abs)).toFixed(4)},`
      + ` decoy max ${Math.max(...simFakeV.map(Math.abs)).toFixed(4)})`);

    // ── the `_cap = 38` — a kaizo-only clamp, and the recording exercises it ─
    // See the CAP / DORIFTO_MAX note above for the derivation of the band.
    const oCap = Math.min(...oReal.map((b) => Math.abs(b.y - mbox)));
    ok(oCap >= CAP - DORIFTO_MAX,
      `oracle: every real blade is >= ${CAP} - ${DORIFTO_MAX}px from the box centre`
      + ` (closest ${oCap.toFixed(4)}) — the mod's _cap = 38 plus one drift step`);
    // AND THE CAP IS NOT VACUOUS ON THIS RECORDING. If the closest blade sat
    // far above the cap, the assertion above would be satisfied by the y
    // formula alone and would say nothing about the clamp — so this is the
    // half that makes the pair evidence. A future recording where no blade
    // comes near the cap SHOULD fail here: it would mean the assertion above
    // had quietly become vacuous.
    ok(oCap <= CAP + DORIFTO_MAX,
      `oracle: and the cap BITES — the closest blade sits on it`
      + ` (${oCap.toFixed(4)}, inside 38 +/- the max drift ${DORIFTO_MAX})`);
    const sCap = Math.min(...SS[id].flatMap((r) => r.spawns
      .filter((s) => s.object === 'obj_knight_diamondswordbullet_ext' && s.xscale === 15)
      .map((b) => Math.abs(b.y - mbox))));
    ok(sCap >= CAP - DORIFTO_MAX,
      `sim over ${SEEDS.length} seeds: every real blade is >= ${CAP} - ${DORIFTO_MAX}px`
      + ` from the box centre (closest ${sCap.toFixed(4)})`);
    // The same both-halves rule on the sim side, which the file did not have
    // before: without it a sim that simply never came near the centre would
    // satisfy the floor while implementing no clamp at all.
    ok(sCap <= CAP + DORIFTO_MAX,
      `sim over ${SEEDS.length} seeds: and the sim's cap BITES too`
      + ` (${sCap.toFixed(4)}) — the clamp is implemented, not merely avoided`);

    // ── the decoy band ────────────────────────────────────────────────────
    // `obj_growtangle.y + random_range(30, 50) * choose(-1, 1)`, then one step
    // of vspeed = dorifto * 2 (|dorifto| <= 0.85), so |y - box.y| must land in
    // [30 - 1.7, 50 + 1.7]. The recording measures 30.7379..51.2676 (route C)
    // and 29.9369..50.3201 (route D).
    const oBand = oFake.map((b) => Math.abs(b.y - mbox));
    ok(Math.min(...oBand) >= 28.3 && Math.max(...oBand) <= 51.7,
      `oracle: decoys sit ${Math.min(...oBand).toFixed(4)}..${Math.max(...oBand).toFixed(4)}`
      + ' from the box centre — random_range(30, 50) plus one drift step');
    const sBand = SS[id].flatMap((r) => r.spawns
      .filter((s) => s.object === 'obj_knight_diamondswordbullet_ext' && s.xscale === 0)
      .map((b) => Math.abs(b.y - mbox)));
    ok(Math.min(...sBand) >= 28.3 && Math.max(...sBand) <= 51.7,
      `sim over ${SEEDS.length} seeds: decoys sit ${Math.min(...sBand).toFixed(4)}`
      + `..${Math.max(...sBand).toFixed(4)} from the box centre`);
    // The control that makes the band mean something: vanilla's
    // random_range(20, 70) reaches 20.08..69.67, so a band that a vanilla run
    // would also satisfy is not evidence about the mod's narrower draw.
    ok(51.7 < 69.67 - 1.7 && 28.3 > 20.08,
      'and the band EXCLUDES the vanilla draw random_range(20, 70), which the'
      + ' unfixed sim measured at 20.0759..69.6702 — the two are distinguishable');
  }
  console.log('');

  // ══════════════════════════════════════════════════════════════════════
  // 6. THE SUBSTITUTION IS THE ROUTING EDIT
  //
  // Everything above drove the sim through `launchVCAttack`, whose case 102
  // still calls the VANILLA module, and then swapped the created instance onto
  // the kaizo type (installKaizo102). That is an argument about two Create
  // events differing in one line; this section is the measurement. Two benches
  // with the same seed, one launched vanilla-then-swapped and one launched
  // straight from the kaizo module, stepped side by side — the whole spawn
  // ledger must be identical, or the swap is not the routing edit and every
  // number above is about something else.
  // ══════════════════════════════════════════════════════════════════════
  console.log('the substitution is the routing edit (equivalence bench)');
  {
    const ledgerOf = (launch, swap) => {
      const st = bench(4242, sideb);
      st.currentAc = 15;
      for (let i = 0; i < 11; i++) stepFrame(st, IDLE);
      launch(st);
      if (swap) installKaizo102(st);
      const seen = new Set(st.entities.filter((e) => e.type.name !== 'obj_knight_tunnel_slasher_2_revised'));
      const out = [];
      const rec = (e, t) => {
        seen.add(e);
        out.push(`${t} ${e.type.name} ${e.x} ${e.y} ${e.image_angle} ${e.image_xscale}`
          + ` ${e.image_yscale} ${e.direction} ${e.speed} ${e.damage}`);
      };
      for (const e of st.entities) if (!seen.has(e)) rec(e, 0);
      for (let f = 0; f < 220; f++) {
        stepFrame(st, IDLE);
        for (const e of st.entities) {
          if (!e.alive || seen.has(e)) continue;
          rec(e, f + 1);
        }
      }
      return out;
    };
    const viaSwap = ledgerOf(vanillaLaunch102, true);
    const viaKaizo = ledgerOf(kaizoLaunch102, false);
    ok(viaSwap.length > 40,
      `the equivalence bench actually ran (${viaSwap.length} spawn rows on each side)`);
    const firstDiff = viaSwap.findIndex((r, i) => r !== viaKaizo[i]);
    ok(viaSwap.length === viaKaizo.length && firstDiff === -1,
      'vanilla-launch-then-swap and kaizo-launch produce the SAME ledger'
      + ` (${viaSwap.length} vs ${viaKaizo.length} rows`
      + `${firstDiff === -1 ? '' : `, first difference at row ${firstDiff}:`
        + ` "${viaSwap[firstDiff]}" vs "${viaKaizo[firstDiff]}"`})`);
    const inst = S.atk_Tunnel2.install;
    ok(inst.swapped + inst.already === 1,
      `and the launcher's own route was found exactly once per launch`
      + ` (${inst.swapped} swapped, ${inst.already} already kaizo)`);
    if (inst.already === 1) {
      note('kaizo-mod-launcher.js case 102 ALREADY routes to the kaizo module —'
        + ' installKaizo102 did nothing, as designed.');
    } else {
      note('kaizo-mod-launcher.js case 102 still imports'
        + ' sim/attacks/sword-tunnel-revised.js. The routing edit is one line:'
        + ' import { launchSwordTunnelRevised } from \'../attacks/sword-tunnel-revised.js\';'
        + ' (and move 102 out of the PENDING TRANSLATION block of SUPPORTED).');
    }
  }
  console.log('');

  // ══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════
  for (const n of notes) console.log(`  NOTE: ${n}`);
  console.log('');

  // POSITIVE EXECUTION ASSERTION — "the comparison agreed" must not look like
  // "the comparison never ran". These are the counters, printed.
  const totalOracle = entries.reduce((a, e) => a + O[e.id].spawns.length, 0);
  const totalSim = entries.reduce((a, e) => a + S[e.id].spawns.length, 0);
  const minChecks = full ? 60 : 30;
  console.log(`  compared ${totalOracle} recorded spawns against ${totalSim} simulated ones`
    + ` across ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} and`
    + ` ${SEEDS.length} seeds`);
  if (totalOracle < 60 || totalSim < 60 || checks < minChecks) {
    console.log('  FAIL: the comparison did not actually run at scale'
      + ` (${totalOracle} oracle / ${totalSim} sim spawns, ${checks} assertions).`);
    return 1;
  }

  if (failures.length) {
    console.log(`\n  ${failures.length} DIVERGENCE(S) of ${checks} assertions:`);
    for (const f of failures) console.log(`    - ${f}`);
    console.log('\n  These are findings ABOUT THE SIM, not tolerances to widen.');
    return 1;
  }
  console.log(`\n  ${checks} assertions against the real mod   OK`);
  console.log('  (object sets, per-type counts, structural spawn geometry and cadence');
  console.log('   — no RNG value, no absolute frame, no damage/HP/TP quantity is compared.)');
  return 0;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN — every recording that carries the entries, each on its own route
// ══════════════════════════════════════════════════════════════════════════

function main() {
  const explicit = process.argv[2];
  const cands = [];

  if (explicit) {
    cands.push(explicit);
  } else {
    const { dir, found, looked } = resolveTraces();
    if (!dir) {
      console.log('SKIP check-oracle-tunnel: no kaizo oracle recording found');
      for (const l of looked) console.log(`     looked in ${l}`);
      console.log('     Record one with knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1,');
      console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
      console.log('     THE SWORD TUNNEL IS THEN HELD AGAINST NOTHING.');
      return 0;
    }
    // EVERY trace/seq pair whose seq log carries atk_Tunnel2 — the entry this
    // file's module owns. Route C additionally needs atk_Tunnel1, which is
    // checked per recording once the route is known. Longest first, so the
    // most informative recording is the one printed at the top.
    const pairs = found
      .map((f) => join(dir, f))
      .map((p) => ({ p, s: seqPathFor(p) }))
      .filter((c) => c.s && existsSync(c.s))
      .map((c) => ({ ...c, n: readFileSync(c.p, 'utf8').length }))
      .sort((a, b) => b.n - a.n)
      .filter((c) => readFileSync(c.s, 'utf8').includes('atk_Tunnel2'));
    if (!pairs.length) {
      console.log('SKIP check-oracle-tunnel: no recording carries the sword-tunnel entries');
      console.log(`     looked in ${dir}`);
      console.log('     A MODE 0 run of >= 7000 frames reaches both (atk_Tunnel1 at turn 5,');
      console.log('     atk_Tunnel2 at turn 17 of the recorded chain).');
      return 0;
    }
    for (const c of pairs) cands.push(c.p);
  }

  let bad = 0;
  let ran = 0;
  for (const tracePath of cands) {
    const seqPath = seqPathFor(tracePath);
    if (!seqPath || !existsSync(seqPath)) {
      console.log(`SKIP check-oracle-tunnel: ${tracePath} has no kaizo_oracle_seq companion`);
      console.log('     The per-spawn log is what this check diffs; the frame trace alone');
      console.log('     carries no object identities.');
      continue;
    }
    const trace = readTrace(tracePath);
    // ROUTE DETECTION, not route ASSUMPTION. The two tables hold the same 31
    // entries in the same order and differ in exactly three rows, so a
    // recording that contains none of them is genuinely ambiguous —
    // check-oracle-schedule's detector says so rather than picking silently,
    // and an ambiguous recording is safe to read as C because the tables agree
    // everywhere this file looks.
    let route = 'C';
    try {
      const det = detectRoute(recoverLaunches(trace));
      if (det.conflict) {
        console.log(`FAIL check-oracle-tunnel: ${tracePath} carries BOTH route`
          + ' signatures, which the mod cannot produce — the launch attribution is wrong.');
        bad += 1;
        continue;
      }
      if (det.route) route = det.route;
      else {
        console.log(`  (route AMBIGUOUS in ${basename(tracePath)}; the three distinguishing`
          + ' entries are absent, so C and D agree on every row this file reads)');
      }
    } catch (err) {
      console.log(`  (route detection unavailable for ${basename(tracePath)}:`
        + ` ${err.message}; defaulting to C)`);
    }
    const seqText = readFileSync(seqPath, 'utf8');
    if (route === 'C' && !seqText.includes('atk_Tunnel1')) {
      console.log(`SKIP check-oracle-tunnel: ${basename(tracePath)} (route C) has no`
        + ' atk_Tunnel1 — the corridor half of this file cannot run against it.');
      continue;
    }
    // A BLANK ROW MEANT THE RECORDER WAS NOT WATCHING.
    // The recorder resolves a HARDCODED list of object names, and every
    // recording made before 2026-08-29 omitted the type-151 and type-153
    // MANAGERS — so both of this family's turns look almost empty in them
    // (`_schedule` logs one obj_knight_swordtunnelanim for the whole of
    // atk_Tunnel1). Comparing against that is not a weaker measurement, it is
    // a measurement of the instrument: ORACLE-GROUND-TRUTH.md records it as
    // its own section. A negative result is only evidence if the instrument
    // could have produced a positive one.
    const needWatched = route === 'C'
      ? ['obj_sword_tunnel_manager', 'obj_tracking_swords_manager']
      : ['obj_tracking_swords_manager'];
    const missing = needWatched.filter((o) => !seqText.includes(o));
    if (missing.length) {
      console.log(`SKIP check-oracle-tunnel: ${basename(tracePath)} predates the recorder's`
        + ` manager watch list — it never logs ${missing.join(' or ')},`);
      console.log('     so this family\'s turns read as empty in it. Re-record with the'
        + ' current run-kaizo-oracle.ps1.');
      continue;
    }
    ran += 1;
    if (runRecording(tracePath, seqPath, route) !== 0) bad += 1;
    console.log('');
  }

  if (!ran) {
    console.log('SKIP check-oracle-tunnel: no usable recording after route detection.');
    console.log('     THE SWORD TUNNEL IS THEN HELD AGAINST NOTHING.');
    return 0;
  }
  console.log(`check-oracle-tunnel: ${ran} recording(s) checked, ${bad} with divergences`);
  return bad ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
