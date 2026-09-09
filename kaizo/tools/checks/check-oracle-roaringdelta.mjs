#!/usr/bin/env node
// ORACLE CHECK — atk_RoaringDelta (ac 104 -> dc.type 107), the "Roaring DELTA"
// finale of EnderCat8's Kaizo Roaring Knight v2.3.3, held FRAME FOR FRAME
// against MODE 1 attack-lock recordings of the real mod.
//
//   node kaizo/tools/checks/check-oracle-roaringdelta.mjs [options] [trace.csv]
//
//     --sabotage      corrupt COPIES of the recording (never the files) and
//                     flip the sim's side; every corruption must be caught at
//                     the corrupted cell, or this exits 1
//     --only <tag>    one recording tag: _roaringdelta2 / _roaringdeltaB /
//                     _roaringdelta
//     --frames N      cap the replay at N frames after the board is raised
//     --context N     rows of context around a divergence (default 3)
//     --spawnn N      the RNG anchor index of the FIRST launch (default 1)
//     trace.csv       an explicit kaizo_oracle_trace<tag>.csv (its seq /
//                     bullets / roar companions are looked up beside it)
//
// V-C recreation of another author's creative work — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
//
// kaizo/tools/checks/check-roaring-final.mjs is nineteen sections of positive
// assertions on the translation's OWN numbers: it proves the module does what
// its author believes the GML does, and compares against nothing recorded
// (its §19 excepted). The gap report of 2026-09-08 (scratchpad gap-roaring.md,
// §4-§6) measured that the only roar recording then on disk — `_roaringdelta`,
// 600 frames, crashed at f686 on the HUD's obj_darkcontroller read — stops 17
// frames before the first star, and that ~925 of the finale's ~1140 frames
// (the spiral's second half, the curtains, the cut, the 30 slash lines, the
// 75%-max-HP hit, the shatter, the turn end) had NEVER been held against the
// mod. This is the check that does. It reads whatever RoaringDelta lock
// recordings exist and diffs the sim against every one of them, cell by cell.
//
// ── WHAT IS CLAIMED, per recording and per locked launch ──────────────────
//
// The sim is replayed THROUGH THE LAUNCHER (kaizo/scenes/kaizo-mod-launcher.js:
// openVCArena, then launchVCAttack on the VC_TABLE row itself) — not through
// check-roaring-final's `buildSingleAttackScene` scaffold, whose soul starts at
// 314,162 where the game's is delivered to 310,160 — and compared, frame-aligned
// at C (the obj_knight_roaring2 seq row), against:
//
//   THE TRACE     the 21-column per-frame sheet, restricted to the columns a
//                 MODE 1 lock leaves meaningful: attackchoice, turntimer, the
//                 four obj_growtangle cells, soul_x/soul_y, inv, bullets. The
//                 rest are named as SKIPPED with a reason, every run (below).
//   THE SEQ       every creation the recorder logged in the window — object,
//                 x, y, image_angle, image_xscale, image_yscale, direction,
//                 speed — in the RECORDER'S OWN creation order (watch-list
//                 order across types, newest-first within one type: measured
//                 on the seven ring stars and the six-way starchild fan).
//   THE BULLETS   the 32-slot sheet (kaizo_oracle_bullets<tag>.csv) when the
//                 recording carries one: `live`, then per slot x/y/a/xs/ys/dir/
//                 spd, in the sheet's own order (obj_collidebullet sorted by
//                 instance id = creation order; the sim sorts by `seq`).
//   THE ROAR      the per-frame finale probe (kaizo_oracle_roar<tag>.csv) when
//                 present: final_con, attack_con, attack_timer, attack_grav,
//                 attack_max, attack_dir, player_suck, fake_y, fake_xoff,
//                 fake_yoff, the knight's chargeuptimer, timer, final_hit,
//                 hp_visible, `lines`, and the 32 slash-line slots (x, y,
//                 image_angle, image_xscale, image_blend) against the sim's
//                 obj_knight_roaring2 and its final_lines[].
//
// Every compared cell is EXACT TEXT (sim/trace.js `real`, the recorder's
// string_format(v, 0, 10)) except the bullets sheet's slot columns, which take
// the byte gate's own CELL_TOL (kaizo/tools/verify-kaizo-fullfight.mjs: 0.05 px
// on x/y, 0.001 deg on a/dir, 1e-5 on spd/xs/ys) — the same band, for the same
// reason, and a cell inside it is still printed. Exit 1 on the first divergence
// in any group; exit 0 only when every compared cell agrees.
//
// The report is the byte gate's: the FIRST divergence per group, groups in
// CAUSAL order — the selector, the clock, the arena, the finale's state
// machine, the soul (pulled by player_suck), inv, the bullet population, the
// creations, the slot sheet, the slash lines. The first group listed is the
// one to fix; the rest are usually its downstream.
//
// ── ALIGNMENT, and where every number the replay is handed comes from ─────
//
//   C   the frame of the obj_knight_roaring2 seq row. The controller's Step
//       creates the instance one frame after the knight's dispatch (rtimer
//       12), and the seq logs it that frame with its Create-hoisted y.
//   G   C - 12: the frame obj_growtangle appears in the trace (gt_x turns
//       non-empty), the mnfight-1.5 arena open. Detected, then asserted.
//   S   the frame soul_x turns non-empty (C - 4 in every lock so far): the
//       obj_moveheart delivery. The sim's soul is spawned before that frame's
//       step at the RECORDED position, and global.inv is seeded with the
//       trace's value at G; the soul's own step produces the -1, -2, ... the
//       recording carries from S on.
//   the clock  seeded with the trace's turntimer at G and decremented by a
//       turnClock entity at stepOrder -100 — the kaizo lane's own model
//       (kaizo/scenes/kaizo-practice.js: obj_battlecontroller steps before
//       every attack object), so the launcher's 999999 pin, the outro's
//       `turntimer = 4` and the `-1` hand-back are read in the game's order.
//   the knight's y  the roar is born AT THE KNIGHT (dbulletcontroller
//       Step_0:2259) and Create hoists it 320 up; the knight bobs on siner2,
//       and his phase at C is the whole fight's history, which a lock replay
//       cannot know. Like check-oracle-stream's `ownerAt`, the recorded row's
//       y + 320 is written to the knight before the launch, and the launcher's
//       contract (x = knight.x, y = knight.y - 320) is asserted against it.
//       Printed as a receipt with the sim's own uncorrected bob height.
//   the RNG  the harness re-anchors WELL512 per scr_bulletspawner call
//       (`seed + spawnn * 1000`, CLAUDE.md). A lock run's first turn is
//       atk_Starstorm1 (one spawner call, n = 0), so the first locked roar is
//       n = 1 and each further locked launch in the same file is n + 1. The
//       slash lines (irandom(639), irandom(419), irandom(360) x 30) and the
//       31 shatter pieces are RNG, so the roar file and the obj_marker seq
//       rows are only exact when this anchor and the finale's draw order are.
//
// Frame g of the sim is the state after the step that produces the game's
// frame g, with two same-frame events applied AFTER that step and read in
// that frame's row, as the game's rows read them: the board at G (created in
// the knight's Step, scale 0, not yet stepped) and the launch at C (the
// controller's Step creates roaring2; its first Other_11 is frame C + 1).
//
// ── WHAT IS NOT CLAIMED ───────────────────────────────────────────────────
//
//   * Party HP, damage, targeting, hp_visible's consequence, final_kill: the
//     recorder pins global.hp every frame (oracle_kaizo_fight.csx) and so
//     does this replay (partyHp refilled after every row). `inv` IS compared —
//     a landed catch or hit writes invc * 30 into it on both sides — and
//     `hp_visible` / `final_hit` are compared as the roar file carries them.
//   * The cosmetic populations: obj_afterimage / obj_afterimage_fade_to_white
//     / obj_afterimage_blend (the knight's and the starchildren's trails),
//     obj_afterimage_grow (the finale's grow-ghosts — their draws are taken,
//     no entity is made) and obj_particle_generic (the in-rush streaks, same).
//     They are set aside BY NAME on both sides and their recorded counts are
//     printed, so nothing is quietly tolerated. obj_knight_circle and
//     obj_afterimage_screen ARE real sim entities and ARE compared.
//   * Columns a lock harness owns: spawns (an instrument counter over a
//     different watch list), kaizo_atk (the recorder writes the lock into it
//     every frame), kaizo_playing / phase / phaseturn / phase4turn /
//     difficulty / mnfight / rtimer (constant through the window, and the
//     replay has no director to drive them), monsterhp (pinned).
//   * Anything past slot 31 of the bullets sheet, or line 31 of the roar
//     file: `live` and `lines` carry the true counts, so a truncation is
//     visible on both sides.
//   * Draw order, sprites, sound.
//
// ── SKIP, and the sabotage ────────────────────────────────────────────────
//
// With no RoaringDelta lock on the machine (or KAIZO_ORACLE_TRACES pointing at
// a directory without one) this prints `SKIP check-oracle-roaringdelta` and
// exits 0, so the kaizo gate stays green where knight-research is absent — and
// the loud skip is the point: a green gate with no oracle line has held nothing
// against the mod. A recording whose companions are missing (no bullets sheet,
// no roar file — every lock before 2026-09-09 has neither) SKIPS those two
// comparisons by name and still runs the other two.
//
// `--sabotage` proves the comparisons bite: on in-memory copies it moves one
// obj_growtangle cell, one creation's x, drops one creation, moves one bullet
// slot and one roar cell (each where the recording carries them), and drives
// the sim on the OTHER side (8-star rings against 7) — each must surface as
// the first divergence of its own group at the corrupted cell. The originals
// are never written.
//
// Wired into kaizo/tools/verify-kaizo.mjs's WIRED set (2026-09-09).

import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn, destroy } from '../../../sim/entity.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { soul } from '../../../sim/soul.js';
import { real } from '../../../sim/trace.js';
import { PARTY } from '../../../sim/damage.js';
import { VC_TABLE, VC_KNIGHT } from '../../versions/vc-script.js';
import { launchVCAttack, openVCArena } from '../../scenes/kaizo-mod-launcher.js';
import { readTrace } from './check-oracle-schedule.mjs';

const ENTRY = 'atk_RoaringDelta';
const ROW = VC_TABLE['4'].find((r) => r.id === ENTRY);

/** run-kaizo-oracle.ps1's `-Seed` default; every lock so far used it. */
const ORACLE_SEED = 20260810;

/**
 * The recordings this check knows how to find, most informative first. `raw`
 * is the recording agent's per-tag output directory under kaizo-mod/locks/;
 * the tag is also looked for in locks/, traces/ and oracle/traces/ (the
 * recorder's default OutDir is traces/, and the two-directory trap
 * check-oracle-schedule.mjs documents applies here too).
 */
const RECORDINGS = [
  {
    tag: '_roaringdelta2', sideb: false, raw: 'roaringdelta2-raw',
    what: 'A-Side finale lock (-Frames 2400 -Roar 1)',
  },
  {
    tag: '_roaringdeltaB', sideb: true, raw: 'roaringdeltaB-raw',
    what: 'B-Side finale lock (-SideB, -Frames 2400 -Roar 1)',
  },
  {
    tag: '_roaringdelta', sideb: false, raw: null,
    what: 'the 600-frame ring-phase lock of 2026-08-29 (crashed at f686 on the'
      + ' HUD; trace to f600, seq to f684; no bullets sheet, no roar file)',
  },
];

function candidateDirs(rec) {
  if (process.env.KAIZO_ORACLE_TRACES) return [process.env.KAIZO_ORACLE_TRACES];
  const km = join(homedir(), 'knight-research', 'kaizo-mod');
  const dirs = [];
  if (rec.raw) dirs.push(join(km, 'locks', rec.raw));
  dirs.push(join(km, 'locks'), join(km, 'traces'), join(km, 'oracle', 'traces'));
  return dirs;
}

// ── the recorder's watch list, IN ITS ORDER ────────────────────────────────
// Transcribed from knight-research/kaizo-mod/tools/patches/oracle_kaizo_fight.csx
// (`_names`, the 64 of 2026-08-29 plus the four roar-furniture names of
// 2026-09-08). The ORDER is load-bearing here, not just the membership: the
// recorder logs a frame's creations by walking this list, so two objects born
// on the same frame appear in list order, and the comparison below sorts the
// sim's creations by the same index.
const WATCH_ORDER = [
  'obj_bullet_knight_crescentGenerator', 'obj_bullet_knight_slash', 'obj_bullet_knight_stream',
  'obj_bullet_knight_tunnelslash', 'obj_bullet_knightcrescent', 'obj_dknight_slasher',
  'obj_knight_bullethell1', 'obj_knight_bullethell2', 'obj_knight_bullethell_bullet',
  'obj_knight_bullethell_bullet2', 'obj_knight_bullethell_bullet_bounce', 'obj_knight_circle',
  'obj_knight_combinations', 'obj_knight_crescentslash_slashinganimation', 'obj_knight_crush',
  'obj_knight_diamondswordbullet_ext', 'obj_knight_lightorb', 'obj_knight_pointing_cone',
  'obj_knight_pointing_star', 'obj_knight_pointing_starchild', 'obj_knight_ring',
  'obj_knight_roaring2', 'obj_knight_roaring_fx', 'obj_knight_roaring_star',
  'obj_knight_rotating_slash', 'obj_knight_slasher', 'obj_knight_spark',
  'obj_knight_split_growtangle', 'obj_knight_split_growtangle_backup',
  'obj_knight_split_growtangle_effect', 'obj_knight_split_growtangle_vertical',
  'obj_knight_stream', 'obj_knight_streamline', 'obj_knight_swordfall',
  'obj_knight_swordtunnelanim', 'obj_knight_triangle', 'obj_knight_tunnel_slasher',
  'obj_knight_tunnel_slasher_2_revised', 'obj_knight_warp', 'obj_knight_weird_bottom_manager',
  'obj_knight_weird_circle', 'obj_knight_weird_circle_bullet',
  'obj_roaringknight_boxsplitter_attack', 'obj_roaringknight_fountain_bullet',
  'obj_roaringknight_fountain_bullet_old', 'obj_roaringknight_quickslash',
  'obj_roaringknight_quickslash_afterimage', 'obj_roaringknight_quickslash_attack',
  'obj_roaringknight_quickslash_big', 'obj_roaringknight_slash', 'obj_roaringknight_split_bullet',
  'obj_roaringknight_splitslash', 'obj_tracking_swords_manager', 'obj_tracking_sword1',
  'obj_diagonal_bullet_manager', 'obj_diagonal_bullet', 'obj_sword_tunnel_manager',
  'obj_sword_vortex_manager', 'obj_fallingsword', 'obj_fake_gt', 'obj_marker',
  'obj_regularbullet', 'obj_afterimage', 'obj_afterimage_fade_to_white',
  'obj_afterimage_grow', 'obj_afterimage_screen', 'obj_afterimage_blend',
  'obj_particle_generic',
];
const WATCH_INDEX = new Map(WATCH_ORDER.map((n, i) => [n, i]));

/**
 * The sim's own names for instances the mod makes through `scr_marker`
 * (gml_GlobalScript_scr_marker.gml: a bare obj_marker): the finale's 30 slash
 * lines (Other_11:627), its 640x480 hideback (:140) and the 31 shatter pieces
 * (scr_lerpvar.gml:95). One recorded name, three sim types, because this
 * engine dispatches behaviour off `type`. Folding them back is a naming
 * difference, not a loosening: their positions, angles and scales are still
 * compared cell by cell.
 */
const MOD_NAME = {
  kaizo_roaring_finalslash_line: 'obj_marker',
  kaizo_roaring_hideback: 'obj_marker',
  kaizo_shatterpiece: 'obj_marker',
  obj_marker_screenpiece: 'obj_marker',
};
const modName = (n) => MOD_NAME[n] ?? n;

/** Set aside on BOTH sides, by name and for a stated reason. */
const COSMETIC = new Map([
  ['obj_afterimage', 'the knight\'s rainbow trail (kaizo: rgbafterimages = 1);'
    + ' the scaffold knight and the mod\'s are not the same population'],
  ['obj_afterimage_fade_to_white', 'the charge-up\'s white ghosts — atk_KnightGlow\'s,'
    + ' held by check-roaring-final §19 against _knightglow'],
  ['obj_afterimage_blend', 'the starchild dash trail, two per con-3 frame; no sim type'],
  ['obj_afterimage_grow', 'the finale\'s grow-ghosts: their RNG draws are taken,'
    + ' no entity is made (roaring-final.js header, "VISUAL DELTAS NOT DRAWN")'],
  ['obj_particle_generic', 'the in-rush streaks: both irandoms are taken, the'
    + ' particle is not made (same header)'],
]);

// ── the trace's groups, in the order a fault propagates ───────────────────
const TRACE_GROUPS = [
  ['selector', ['attackchoice']],
  ['clock', ['turntimer']],
  ['arena', ['gt_x', 'gt_y', 'gt_xs', 'gt_ys']],
  ['soul', ['soul_x', 'soul_y']],
  ['damage', ['inv']],
  ['population', ['bullets']],
];
const TRACE_SKIPPED = new Map([
  ['spawns', 'an instrument counter over the recorder\'s watch list, which now'
    + ' includes five cosmetic populations this replay does not make'],
  ['kaizo_atk', 'MODE 1: the recorder writes the lock into it every frame'],
  ['kaizo_playing', 'constant atk_RoaringDelta through the window; the replay has no'
    + ' director to advance it'],
  ['phase', 'constant 4 in the lock; no director on the sim side'],
  ['phaseturn', 'the mod\'s knight never moves it (verify-kaizo-fullfight.mjs)'],
  ['phase4turn', 'constant 3 in the lock (the entry\'s own attackSetVar); no director'],
  ['difficulty', 'constant 0 in the lock; no director'],
  ['mnfight', 'constant 2 through the bullet phase; no director'],
  ['rtimer', 'constant 12 through the bullet phase; no director'],
  ['monsterhp', 'pinned at max by the recorder and by this replay'],
]);

const BULLET_GROUPS = [
  ['live', /^live$/],
  ['slot motion (dir, spd)', /^b\d+_(dir|spd)$/],
  ['slot position (x, y)', /^b\d+_[xy]$/],
  ['slot shape (a, xs, ys)', /^b\d+_(a|xs|ys)$/],
];
/** The byte gate's declared micro-tolerances, verbatim. Everything else is exact. */
const CELL_TOL = [
  [/^b\d+_[xy]$/, 0.05],
  [/^b\d+_(a|dir)$/, 0.001],
  [/^b\d+_(spd|xs|ys)$/, 1e-5],
];

const ROAR_GROUPS = [
  ['finale state', ['final_con', 'attack_con', 'attack_timer', 'attack_grav', 'attack_max', 'attack_dir']],
  ['finale knight', ['player_suck', 'fake_y', 'fake_xoff', 'fake_yoff', 'chargeuptimer', 'timer',
    'final_hit', 'hp_visible']],
  ['slash lines', ['lines', /^l\d+_(x|y|angle|xs|blend)$/]],
];

const SEQ_FIELDS = ['x', 'y', 'angle', 'xscale', 'yscale', 'direction', 'speed'];

// ── reading ────────────────────────────────────────────────────────────────

function readCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/\r/g, '').trimEnd();
  const lines = text.split('\n');
  const header = lines[0].split(',');
  return {
    path,
    header,
    col: Object.fromEntries(header.map((h, i) => [h, i])),
    rows: lines.slice(1).filter((l) => l.length).map((l) => l.split(',')),
  };
}

function frameOf(csv, r) {
  return Number(r[csv.col.frame]);
}

function byFrame(csv) {
  const m = new Map();
  for (const r of csv.rows) m.set(frameOf(csv, r), r);
  return m;
}

/** Locate one recording's files. Returns null when the trace is absent. */
function locate(rec, explicitTrace = null) {
  const found = { rec, trace: null, seq: null, bullets: null, roar: null, looked: [] };
  const companions = (dir, tag) => {
    const seq = join(dir, `kaizo_oracle_seq${tag}.csv`);
    const bullets = join(dir, `kaizo_oracle_bullets${tag}.csv`);
    const roar = join(dir, `kaizo_oracle_roar${tag}.csv`);
    found.seq = existsSync(seq) ? seq : null;
    found.bullets = existsSync(bullets) ? bullets : null;
    found.roar = existsSync(roar) ? roar : null;
  };
  if (explicitTrace) {
    if (!existsSync(explicitTrace)) return null;
    found.trace = explicitTrace;
    const m = /^kaizo_oracle_trace(.*)\.csv$/.exec(basename(explicitTrace));
    companions(dirname(explicitTrace), m ? m[1] : rec.tag);
    return found;
  }
  for (const dir of candidateDirs(rec)) {
    found.looked.push(dir);
    const trace = join(dir, `kaizo_oracle_trace${rec.tag}.csv`);
    if (!existsSync(trace)) continue;
    // A trace still being written by the recorder is not a recording yet: a
    // file under 2 KB has no window in it. Treated as absent, said so.
    if (statSync(trace).size < 2048) {
      found.looked.push(`${trace} (present but ${statSync(trace).size} bytes — still recording?)`);
      continue;
    }
    found.trace = trace;
    companions(dir, rec.tag);
    return found;
  }
  return null;
}

// ── the sim ────────────────────────────────────────────────────────────────

/**
 * obj_battlecontroller's one Step line, at the slot the kaizo lane measured
 * for it: stepOrder -100, so every attack object reads the ALREADY-DECREMENTED
 * clock and the finale's own `global.turntimer = 4` / `-1` writes are the last
 * word on their frame (kaizo/scenes/kaizo-practice.js turnClock). A harness
 * entity: not a game object, not on the recorder's watch list.
 */
const turnClock = {
  name: 'kaizo_check_turnclock',
  stepOrder: -100,
  step(e, state) {
    if (e.on) state.turntimer -= 1;
  },
};

/** A cell as the recorder prints it: real() or empty for an absent value. */
function cell(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return real(v ? 1 : 0);
  if (!Number.isFinite(v)) return String(v);
  return real(v);
}

/** GML's packed BGR integer for the sim's [r, g, b] image_blend, as the roar file writes it. */
function blendCell(b) {
  if (Array.isArray(b) && b.length === 3) return String(b[0] + b[1] * 256 + b[2] * 65536);
  if (typeof b === 'number') return String(b);
  return '';
}

function findBox(state) {
  return state.entities.find(
    (e) => e.alive && e.type?.name === 'obj_growtangle' && e.growcon !== 4,
  ) ?? null;
}

/** Live bullets in creation order — the recorder's `with (obj_collidebullet)` + sort by id. */
function liveBullets(state) {
  return state.entities
    .filter((e) => e.alive && e.isBullet && e.type?.name !== 'obj_heart')
    .sort((a, b) => a.seq - b.seq);
}

function simTraceRow(state) {
  const box = findBox(state);
  const s = state.soul && state.soul.alive ? state.soul : null;
  return {
    soul_x: s ? cell(s.x) : '',
    soul_y: s ? cell(s.y) : '',
    inv: cell(state.invTimer),
    attackchoice: cell(state.currentAc),
    turntimer: cell(state.turntimer),
    gt_x: box ? cell(box.x) : '',
    gt_y: box ? cell(box.y) : '',
    gt_xs: box ? cell(box.image_xscale) : '',
    gt_ys: box ? cell(box.image_yscale) : '',
    bullets: String(liveBullets(state).length),
  };
}

function simBulletsRow(state, slots = 32) {
  const bl = liveBullets(state);
  const row = { live: String(bl.length) };
  for (let i = 0; i < slots; i++) {
    const b = bl[i];
    row[`b${i}_x`] = b ? cell(b.x) : '';
    row[`b${i}_y`] = b ? cell(b.y) : '';
    row[`b${i}_a`] = b ? cell(b.image_angle) : '';
    row[`b${i}_xs`] = b ? cell(b.image_xscale) : '';
    row[`b${i}_ys`] = b ? cell(b.image_yscale) : '';
    row[`b${i}_dir`] = b ? cell(b.direction) : '';
    row[`b${i}_spd`] = b ? cell(b.speed) : '';
  }
  return row;
}

function simRoarRow(state, e, slots = 32) {
  const row = {
    final_con: cell(e.final_con),
    attack_con: cell(e.attack_con),
    attack_timer: cell(e.attack_timer),
    attack_grav: cell(e.attack_grav),
    attack_max: cell(e.attack_max),
    attack_dir: cell(e.attack_dir),
    player_suck: cell(e.player_suck),
    fake_y: cell(e.fake_y),
    fake_xoff: cell(e.fake_xoff),
    fake_yoff: cell(e.fake_yoff),
    chargeuptimer: cell(state.knight?.chargeuptimer),
    timer: cell(e.timer),
    final_hit: cell(e.final_hit),
    hp_visible: cell(e.hp_visible),
  };
  const lines = Array.isArray(e.final_lines) ? e.final_lines : [];
  row.lines = String(lines.length);
  for (let i = 0; i < slots; i++) {
    const l = lines[i];
    const ok = l && l.alive;
    row[`l${i}_x`] = ok ? cell(l.x) : '';
    row[`l${i}_y`] = ok ? cell(l.y) : '';
    row[`l${i}_angle`] = ok ? cell(l.image_angle) : '';
    row[`l${i}_xs`] = ok ? cell(l.image_xscale) : '';
    row[`l${i}_blend`] = ok ? blendCell(l.image_blend) : '';
  }
  return row;
}

/**
 * Replay one locked launch through the launcher. `plan` carries every number
 * the recording supplies (see the header's ALIGNMENT section); nothing else is
 * invented. Returns per-frame rows keyed by the GAME's frame number, the
 * creation ledger in the recorder's order, and the birth receipt.
 */
function replay(plan, { frames, sideb, seed = ORACLE_SEED, spawnn }) {
  const state = createState({ seed });
  buildSingleAttackScene(state, { seed, attack: 'roaring', difficulty: 0 });
  // The drill's director would launch on its own schedule; the single scene
  // may already have launched the SIM roaring. The launcher is under test.
  for (const e of [...state.entities]) {
    if (!e.alive) continue;
    if (e.type.name === 'practice_director' || e.type.name === 'obj_knight_roaring2' || e.isBullet) {
      destroy(e, state);
    }
  }
  state.kaizo = { version: sideb ? 'D' : 'C', sideb, approx: [], launched: [], vars: {}, hooks: {} };
  state.soul = null;
  state.seed = seed;
  state.spawnn = spawnn;
  state.invc = 1;
  state.invTimer = plan.invAtG;
  state.turntimer = plan.turntimerAtG;
  if (state.knight) state.knight.hp = VC_KNIGHT.maxhp;
  const maxhp = state.partyMaxhp ?? PARTY.map((p) => p.maxhp);
  const pin = () => {
    for (let i = 0; i < maxhp.length; i++) state.partyHp[i] = maxhp[i];
    state.gameOver = false;
    if (state.knight) state.knight.hp = VC_KNIGHT.maxhp;
  };
  const clock = spawn(state, turnClock);
  clock.on = true;
  const knight = state.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy');

  const out = {
    state, trace: new Map(), bullets: new Map(), roar: new Map(), seq: [],
    unwatched: new Set(), owner: null, birth: null, milestones: [],
  };
  const seen = new Set(state.entities.filter((e) => e.alive).map((e) => e.seq));
  const scan = (g) => {
    const fresh = [];
    for (const e of state.entities) {
      if (!e.alive || seen.has(e.seq)) continue;
      seen.add(e.seq);
      fresh.push(e);
    }
    // The recorder's order: watch-list index across types, newest-first within.
    fresh.sort((a, b) => {
      const ia = WATCH_INDEX.get(modName(a.type.name)) ?? 9999;
      const ib = WATCH_INDEX.get(modName(b.type.name)) ?? 9999;
      return ia - ib || b.seq - a.seq;
    });
    for (const e of fresh) {
      const name = modName(e.type.name);
      if (!WATCH_INDEX.has(name)) {
        out.unwatched.add(e.type.name);
        continue;
      }
      out.seq.push({
        frame: g,
        name,
        simName: e.type.name,
        vals: [cell(e.x), cell(e.y), cell(e.image_angle ?? 0), cell(e.image_xscale ?? 1),
          cell(e.image_yscale ?? 1), cell(e.direction ?? 0), cell(e.speed ?? 0)],
      });
    }
  };
  let lastKey = null;
  const record = (g) => {
    out.trace.set(g, simTraceRow(state));
    out.bullets.set(g, simBulletsRow(state));
    if (out.owner && out.owner.alive) {
      out.roar.set(g, simRoarRow(state, out.owner));
      const key = `${out.owner.final_con}.${out.owner.attack_con}`;
      if (key !== lastKey) {
        out.milestones.push({ frame: g, key });
        lastKey = key;
      }
    }
    scan(g);
    pin();
  };

  openVCArena(state, ROW, { sideb });
  record(plan.G);
  for (let g = plan.G + 1; g <= plan.G + frames; g++) {
    if (g === plan.S) {
      state.soul = spawn(state, soul, { x: plan.soulX, y: plan.soulY });
    }
    stepFrame(state, {});
    if (g === plan.C) {
      const simKnightY = knight ? knight.y : null;
      if (knight && plan.knightY !== null && plan.knightY !== undefined) knight.y = plan.knightY;
      out.owner = launchVCAttack(state, ROW, { sideb });
      out.birth = {
        x: out.owner ? out.owner.x : null,
        y: out.owner ? out.owner.y : null,
        knightX: knight ? knight.x : null,
        knightY: knight ? knight.y : null,
        simKnightY,
      };
    }
    record(g);
    // The hand-back: obj_battlecontroller sweeps at `turntimer <= 0` and the
    // clock stops with the turn. Only after the pin — before C the previous
    // turn's clock is draining through the grow-in, as the recording shows.
    if (g > plan.C && state.turntimer <= 0) clock.on = false;
    if (g > plan.C && (!out.owner || !out.owner.alive) && state.turntimer < 0) break;
  }
  return out;
}

// ── comparing ──────────────────────────────────────────────────────────────

function tolFor(name) {
  for (const [re, tol] of CELL_TOL) if (re.test(name)) return tol;
  return 0;
}
function cellsDiffer(a, b, tol) {
  if (a === b) return false;
  if (!tol) return true;
  const x = Number(a);
  const y = Number(b);
  if (a === '' || b === '' || !Number.isFinite(x) || !Number.isFinite(y)) return true;
  return Math.abs(x - y) > tol;
}

/**
 * First divergence per group over frames [from, to] of an oracle sheet
 * against sim rows keyed by frame. `cols(name)` says which columns belong to a
 * group; `skipEmptyOracle` treats an empty oracle cell as "variable not yet
 * assigned" (the roar probe's guarded reads) and does not compare it.
 */
function compareSheet(oracle, simRows, { from, to, groups, skipEmptyOracle = false, tolerant = false }) {
  const oByFrame = byFrame(oracle);
  const findings = [];
  const stats = { frames: 0, cells: 0, withinTol: 0, skippedEmpty: new Map(), oracleOnly: 0 };
  // A group's spec is a LIST of names and/or patterns — or, in BULLET_GROUPS,
  // a single pattern standing alone (`['live', /^live$/]`). Both spellings are
  // in this file's own tables, so normalise here rather than rewriting a table
  // and leaving the next one to crash: [].concat() wraps the lone pattern and
  // passes a list through unchanged.
  const groupCols = groups.map(([g, spec]) => [g, oracle.header.filter((h) => {
    if (h === 'frame') return false;
    return [].concat(spec).some((s) => (s instanceof RegExp ? s.test(h) : s === h));
  })]);
  const frames = [];
  for (let f = from; f <= to; f++) if (oByFrame.has(f)) frames.push(f);
  for (const f of frames) {
    if (!simRows.has(f)) stats.oracleOnly += 1;
    else stats.frames += 1;
  }
  for (const [group, cols] of groupCols) {
    let best = null;
    for (const f of frames) {
      const o = oByFrame.get(f);
      const s = simRows.get(f);
      if (!s) continue;
      for (const c of cols) {
        const ov = o[oracle.col[c]] ?? '';
        const sv = s[c] ?? '';
        if (skipEmptyOracle && ov === '') {
          stats.skippedEmpty.set(c, (stats.skippedEmpty.get(c) ?? 0) + 1);
          continue;
        }
        stats.cells += 1;
        const tol = tolerant ? tolFor(c) : 0;
        if (ov !== sv && !cellsDiffer(ov, sv, tol)) stats.withinTol += 1;
        if (cellsDiffer(ov, sv, tol)) {
          best = { group, frame: f, col: c, oracle: ov, sim: sv };
          break;
        }
      }
      if (best) break;
    }
    if (best) findings.push(best);
  }
  return { findings, stats, frames, oByFrame };
}

/**
 * The creation ledgers, walked in order. Presence first (frame + object at
 * each index), then values (the seven recorded fields).
 */
function compareSeq(oRows, sRows) {
  const findings = [];
  const n = Math.min(oRows.length, sRows.length);
  let presence = null;
  for (let i = 0; i < n; i++) {
    const o = oRows[i];
    const s = sRows[i];
    if (o.frame !== s.frame || o.name !== s.name) {
      presence = { group: 'creation order', index: i, frame: o.frame, col: 'object',
        oracle: `f${o.frame} ${o.name}`, sim: `f${s.frame} ${s.name}` };
      break;
    }
  }
  if (!presence && oRows.length !== sRows.length) {
    const i = n;
    const o = oRows[i];
    const s = sRows[i];
    presence = { group: 'creation order', index: i, frame: (o ?? s).frame, col: 'object',
      oracle: o ? `f${o.frame} ${o.name}` : '(nothing more)',
      sim: s ? `f${s.frame} ${s.name}` : '(nothing more)' };
  }
  if (presence) findings.push(presence);
  const upto = presence ? presence.index : n;
  let values = null;
  for (let i = 0; i < upto && !values; i++) {
    const o = oRows[i];
    const s = sRows[i];
    for (let k = 0; k < SEQ_FIELDS.length; k++) {
      if (o.vals[k] !== s.vals[k]) {
        values = { group: 'creation values', index: i, frame: o.frame, col: SEQ_FIELDS[k],
          oracle: o.vals[k], sim: s.vals[k], name: o.name };
        break;
      }
    }
  }
  if (values) findings.push(values);
  return { findings, compared: upto, presence, values };
}

// ── reporting (the byte gate's shape) ──────────────────────────────────────

function pad(v, n) {
  return String(v ?? '').padStart(n);
}

function showSheetContext(oracle, simRows, f, context) {
  const oByFrame = byFrame(oracle);
  const lines = [];
  for (let r = f.frame - context; r <= f.frame + context; r++) {
    const o = oByFrame.get(r);
    const s = simRows.get(r);
    if (!o && !s) continue;
    const ov = o ? (o[oracle.col[f.col]] ?? '') : '(no row)';
    const sv = s ? (s[f.col] ?? '') : '(no row)';
    const mark = ov === sv ? '  ' : '->';
    lines.push(`      ${mark} frame ${pad(r, 6)}   oracle ${pad(ov, 18)}   sim ${pad(sv, 18)}`);
  }
  return lines.join('\n');
}

function showSeqContext(oRows, sRows, i, context) {
  const lines = [];
  const fmt = (r) => (r ? `f${r.frame} ${r.name} [${r.vals.join(' ')}]` : '(none)');
  for (let k = Math.max(0, i - context); k <= i + context; k++) {
    if (k >= oRows.length && k >= sRows.length) break;
    const mark = k === i ? '->' : '  ';
    lines.push(`      ${mark} #${pad(k, 4)}  oracle ${fmt(oRows[k])}`);
    lines.push(`         ${''.padStart(4)}  sim    ${fmt(sRows[k])}`);
  }
  return lines.join('\n');
}

function reportSheet(label, oracle, simRows, res, context, extra = '') {
  const { findings, stats } = res;
  const tail = stats.oracleOnly
    ? `; ${stats.oracleOnly} recorded frame(s) past the replay were NOT compared`
    : '';
  if (!findings.length) {
    console.log(`  ${label}: OK — ${stats.frames} frames, ${stats.cells} cells`
      + `${stats.withinTol ? ` (${stats.withinTol} within CELL_TOL, not byte-exact)` : ', byte-exact'}`
      + `${extra}${tail}`);
    return;
  }
  console.log(`  ${label}: FAIL — first divergence at frame ${findings[0].frame}`
    + ` (${stats.frames} frames, ${stats.cells} cells compared${extra}${tail})`);
  for (const f of findings) {
    console.log(`\n    ${f.group.toUpperCase()}  frame ${f.frame}, column ${f.col}`);
    console.log(showSheetContext(oracle, simRows, f, context));
  }
}

// ── the window of one locked launch ────────────────────────────────────────

/**
 * Everything the recording says about one locked launch: C, G, S, the soul's
 * delivery point, the clock and inv at G, the knight's y at C, and where each
 * sheet's window ends (the hand-back, the next launch, or the file's end).
 */
function planLaunch(data, roaringRow, launchIndex, nextC) {
  const t = data.trace;
  const tBy = byFrame(t);
  const C = Number(roaringRow[data.seq.col.frame]);
  const lastTrace = frameOf(t, t.rows[t.rows.length - 1]);
  // G: the frame obj_growtangle appears (gt_x non-empty after an empty row).
  let G = null;
  for (let f = C; f >= Math.max(0, C - 40); f--) {
    const r = tBy.get(f);
    const p = tBy.get(f - 1);
    if (r && p && r[t.col.gt_x] !== '' && p[t.col.gt_x] === '') { G = f; break; }
  }
  if (G === null) G = C - 12;
  // S: the frame obj_heart appears.
  let S = null;
  for (let f = G; f <= C; f++) {
    const r = tBy.get(f);
    if (r && r[t.col.soul_x] !== '') { S = f; break; }
  }
  const sRow = S !== null ? tBy.get(S) : null;
  const gRow = tBy.get(G);
  // The trace window ends at the hand-back (turntimer < 0 after C), the next
  // launch's board, or the file.
  let E = lastTrace;
  for (let f = C + 1; f <= lastTrace; f++) {
    const r = tBy.get(f);
    if (!r) continue;
    if (Number(r[t.col.turntimer]) < 0) { E = f; break; }
  }
  if (nextC !== null) E = Math.min(E, nextC - 13);
  const seqRows = data.seq.rows
    .filter((r) => {
      const f = Number(r[data.seq.col.frame]);
      if (f < G) return false;
      if (nextC !== null && f >= nextC - 12) return false;
      return f >= C || r[data.seq.col.kaizo_playing] === ENTRY;
    });
  const seqEnd = seqRows.length ? Number(seqRows[seqRows.length - 1][data.seq.col.frame]) : C;
  let roarEnd = C;
  if (data.roar) {
    for (const r of data.roar.rows) {
      const f = frameOf(data.roar, r);
      if (f >= C && (nextC === null || f < nextC) && f > roarEnd) roarEnd = f;
    }
  }
  return {
    launchIndex,
    C, G, S, E, seqEnd, roarEnd,
    gDetected: G === C - 12,
    soulX: sRow ? Number(sRow[t.col.soul_x]) : 310,
    soulY: sRow ? Number(sRow[t.col.soul_y]) : 160,
    soulRecorded: !!sRow,
    invAtG: gRow ? Number(gRow[t.col.inv]) : 0,
    turntimerAtG: gRow ? Number(gRow[t.col.turntimer]) : 0,
    knightY: Number(roaringRow[data.seq.col.y]) + 320,
    roaringX: roaringRow[data.seq.col.x],
    roaringY: roaringRow[data.seq.col.y],
    seqRows,
  };
}

/** Oracle seq rows as the comparison's records, cosmetic names set aside. */
function oracleSeqRecords(seq, rows) {
  const c = seq.col;
  const out = [];
  const cosmetic = new Map();
  for (const r of rows) {
    const name = r[c.object];
    if (COSMETIC.has(name)) {
      cosmetic.set(name, (cosmetic.get(name) ?? 0) + 1);
      continue;
    }
    out.push({
      frame: Number(r[c.frame]),
      name,
      vals: SEQ_FIELDS.map((k) => r[c[k]]),
    });
  }
  return { records: out, cosmetic };
}

function countsOf(records) {
  const m = new Map();
  for (const r of records) m.set(r.name, (m.get(r.name) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([n, k]) => `${n} x${k}`).join(', ');
}

/**
 * Run one locked launch: replay, compare every sheet, report. Returns the
 * findings (empty = byte-exact) and the pieces the sabotage needs.
 */
function checkLaunch(data, plan, { sideb, spawnn, frames, context, quiet = false }) {
  const say = (...a) => { if (!quiet) console.log(...a); };
  const runFrames = Math.max(1, Math.min(frames, Math.max(plan.E, plan.seqEnd, plan.roarEnd) - plan.G + 2));
  const sim = replay(plan, { frames: runFrames, sideb, spawnn });

  say(`\n  launch ${plan.launchIndex + 1}: C = f${plan.C} (obj_knight_roaring2's seq row),`
    + ` G = f${plan.G} (board raised${plan.gDetected ? ', C-12' : ` — NOT C-12: C-${plan.C - plan.G}`}),`
    + ` soul at f${plan.S ?? '?'} (${plan.soulX}, ${plan.soulY}${plan.soulRecorded ? '' : ' — assumed, no soul row before C'})`);
  say(`    clock at G ${plan.turntimerAtG}, inv at G ${plan.invAtG}; RNG anchor n = ${spawnn}`
    + ` (seed ${ORACLE_SEED}); replayed f${plan.G}..f${plan.G + runFrames} (${runFrames} frames)`
    + ` through launchVCAttack(${ENTRY}) sideb ${sideb}`);
  const b = sim.birth;
  say(`    birth: sim x ${b?.x} y ${cell(b?.y)} (knight x ${b?.knightX}, y ${cell(b?.knightY)};`
    + ` the sim's own bob had him at y ${cell(b?.simKnightY)}) — recorded ${plan.roaringX}, ${plan.roaringY}`);
  const findings = [];
  const birthOk = b && b.x === b.knightX && Math.abs(b.y - (b.knightY - 320)) < 1e-9;
  if (!birthOk) {
    findings.push({ group: 'birth', frame: plan.C, col: 'obj_knight_roaring2 x/y',
      oracle: `at the knight, y - 320`, sim: `x ${b?.x} y ${b?.y} vs knight ${b?.knightX}, ${b?.knightY}` });
    say('    FAIL birth: the launcher did not birth roaring2 at the knight, hoisted 320');
  }

  // ── the trace ──────────────────────────────────────────────────────────
  const trace = compareSheet(data.trace, sim.trace, {
    from: plan.G, to: plan.E, groups: TRACE_GROUPS,
  });

  // ── the roar file ──────────────────────────────────────────────────────
  let roar = null;
  if (data.roar) {
    roar = compareSheet(data.roar, sim.roar, {
      from: plan.C, to: plan.roarEnd, groups: ROAR_GROUPS, skipEmptyOracle: true,
    });
  }

  // ── the seq ────────────────────────────────────────────────────────────
  const oSeq = oracleSeqRecords(data.seq, plan.seqRows);
  const sSeqAll = sim.seq.filter((r) => r.frame >= plan.G && r.frame <= plan.seqEnd);
  const sCosmetic = new Map();
  const sSeq = sSeqAll.filter((r) => {
    if (COSMETIC.has(r.name)) {
      sCosmetic.set(r.name, (sCosmetic.get(r.name) ?? 0) + 1);
      return false;
    }
    return true;
  });
  const seq = compareSeq(oSeq.records, sSeq);

  // ── the bullets sheet ──────────────────────────────────────────────────
  let bullets = null;
  if (data.bullets) {
    bullets = compareSheet(data.bullets, sim.bullets, {
      from: plan.G, to: plan.E, groups: BULLET_GROUPS, tolerant: true,
    });
  }

  // ── the report, groups in causal order ─────────────────────────────────
  // selector, clock, arena (trace) -> finale state (roar) -> soul, damage,
  // population (trace) -> creations (seq) -> slots (bullets) -> slash lines.
  const traceEarly = trace.findings.filter((f) => ['selector', 'clock', 'arena'].includes(f.group));
  const traceLate = trace.findings.filter((f) => !['selector', 'clock', 'arena'].includes(f.group));
  const roarState = roar ? roar.findings.filter((f) => f.group !== 'slash lines') : [];
  const roarLines = roar ? roar.findings.filter((f) => f.group === 'slash lines') : [];

  say('');
  reportSheet('trace  ', data.trace, sim.trace,
    { findings: [...traceEarly, ...traceLate], stats: trace.stats }, context,
    `, ${TRACE_GROUPS.flatMap((g) => g[1]).length} columns compared (f${plan.G}..f${plan.E})`);
  if (!quiet && roar) {
    const sk = [...roar.stats.skippedEmpty.entries()];
    reportSheet('roar   ', data.roar, sim.roar, { findings: [...roarState, ...roarLines], stats: roar.stats },
      context, ` (f${plan.C}..f${plan.roarEnd}${sk.length
        ? `; ${sk.reduce((a, [, n]) => a + n, 0)} empty oracle cells not compared: ${sk.map(([c, n]) => `${c} x${n}`).join(', ')}`
        : ''})`);
  } else if (!quiet) {
    console.log(`  roar   : SKIPPED — no kaizo_oracle_roar${data.rec.tag}.csv beside the trace`
      + ' (record with -Roar 1; every lock before 2026-09-09 has none)');
  }
  if (!quiet) {
    const oc = [...oSeq.cosmetic.entries()].map(([n, k]) => `${n} x${k}`).join(', ');
    const sc = [...sCosmetic.entries()].map(([n, k]) => `${n} x${k}`).join(', ');
    console.log(`     seq object set  oracle: ${countsOf(oSeq.records) || '(none)'}`);
    console.log(`                     sim   : ${countsOf(sSeq) || '(none)'}`);
    if (oc || sc) {
      console.log(`     set aside (cosmetic, by name): oracle ${oc || '(none)'}; sim ${sc || '(none)'}`);
    }
    if (sim.unwatched.size) {
      console.log(`     (sim also made ${[...sim.unwatched].join(', ')} — outside the recorder's watch list)`);
    }
    if (!seq.findings.length) {
      console.log(`  seq    : OK — ${seq.compared} creation rows (f${plan.G}..f${plan.seqEnd}),`
        + ' byte-exact in the recorder\'s creation order');
    } else {
      console.log(`  seq    : FAIL — first divergence at creation #${seq.findings[0].index}`
        + ` (frame ${seq.findings[0].frame}); ${seq.compared} rows compared before it`);
      for (const f of seq.findings) {
        console.log(`\n    ${f.group.toUpperCase()}  creation #${f.index}, frame ${f.frame}, ${f.col}`
          + `${f.name ? ` (${f.name})` : ''}: oracle ${f.oracle}, sim ${f.sim}`);
        console.log(showSeqContext(oSeq.records, sSeq, f.index, Math.min(context, 2)));
      }
    }
    if (bullets) {
      reportSheet('bullets', data.bullets, sim.bullets, bullets, context,
        `, 32 slots (f${plan.G}..f${plan.E})`);
    } else {
      console.log(`  bullets: SKIPPED — no kaizo_oracle_bullets${data.rec.tag}.csv beside the trace`
        + ' (the lock predates the sheet)');
    }
    if (sim.milestones.length) {
      console.log(`     sim finale milestones (final_con.attack_con @ frame): `
        + sim.milestones.map((m) => `${m.key}@f${m.frame}(C+${m.frame - plan.C})`).join(' '));
      const end = [...sim.trace.entries()].find(([g, r]) => g > plan.C && Number(r.turntimer) < 0);
      if (end) console.log(`     sim hand-back (turntimer -1) at f${end[0]} (C+${end[0] - plan.C})`);
    }
  }

  const all = [...findings, ...traceEarly, ...roarState, ...traceLate, ...seq.findings,
    ...(bullets ? bullets.findings : []), ...roarLines];
  return { findings: all, sim, trace, roar, seq, bullets, oSeq: oSeq.records, sSeq };
}

// ── the sabotage ───────────────────────────────────────────────────────────

function cloneCsv(csv) {
  return { ...csv, rows: csv.rows.map((r) => r.slice()) };
}

/** One corruption: run the launch quietly and require the named finding. */
function sabotageCase(label, data, plan, opts, want) {
  const res = checkLaunch(data, plan, { ...opts, quiet: true });
  const hit = res.findings.find((f) => f.group === want.group
    && (want.frame === undefined || f.frame === want.frame)
    && (want.col === undefined || f.col === want.col)
    && (want.index === undefined || f.index === want.index));
  const first = res.findings.find((f) => f.group === want.group);
  console.log(`  ${hit ? 'ok  ' : 'FAIL'} ${label}`);
  console.log(`         wanted ${want.group}${want.frame !== undefined ? ` @ f${want.frame}` : ''}`
    + `${want.index !== undefined ? ` #${want.index}` : ''}${want.col ? ` ${want.col}` : ''};`
    + ` got ${first ? `${first.group} @ f${first.frame}${first.index !== undefined ? ` #${first.index}` : ''} ${first.col}` : 'nothing in that group'}`);
  return !!hit;
}

function sabotage(found, data, plans, opts) {
  console.log('\n── SABOTAGE (copies of the recording; the sim flipped to the other side) ──');
  const plan = plans[0];
  let bad = 0;
  const run = (label, mutate, want) => {
    const copy = {
      ...data,
      trace: cloneCsv(data.trace),
      seq: cloneCsv(data.seq),
      bullets: data.bullets ? cloneCsv(data.bullets) : null,
      roar: data.roar ? cloneCsv(data.roar) : null,
    };
    const p = mutate(copy) ?? planLaunch(copy, copy.seq.rows.find((r) => r[copy.seq.col.object] === 'obj_knight_roaring2'), 0, null);
    if (!sabotageCase(label, copy, p, opts, want)) bad += 1;
  };
  const poke = (csv, frame, col, fn) => {
    const r = csv.rows.find((x) => frameOf(csv, x) === frame);
    if (!r) throw new Error(`sabotage: no row at f${frame} in ${csv.path}`);
    r[csv.col[col]] = fn(r[csv.col[col]]);
  };
  const plus = (d) => (v) => real(Number(v) + d);

  // 1. the arena, during the grow-in: gt_xs at G+3.
  run(`trace: gt_xs at f${plan.G + 3} + 0.5`, (c) => {
    poke(c.trace, plan.G + 3, 'gt_xs', plus(0.5));
  }, { group: 'arena', frame: plan.G + 3, col: 'gt_xs' });
  // 2. the clock, on the pin frame.
  run(`trace: turntimer at f${plan.C} - 1`, (c) => {
    poke(c.trace, plan.C, 'turntimer', plus(-1));
  }, { group: 'clock', frame: plan.C, col: 'turntimer' });
  // 3. a creation's value: roaring2's own row (creation #0) x + 1.
  run('seq: obj_knight_roaring2\'s x + 1', (c) => {
    const r = c.seq.rows.find((x) => x[c.seq.col.object] === 'obj_knight_roaring2');
    r[c.seq.col.x] = real(Number(r[c.seq.col.x]) + 1);
  }, { group: 'creation values', index: 0, col: 'x' });
  // 4. a creation dropped: the first obj_knight_roaring_star row.
  const firstStar = data.seq.rows.findIndex((r) => r[data.seq.col.object] === 'obj_knight_roaring_star'
    && Number(r[data.seq.col.frame]) > plan.C);
  if (firstStar >= 0) {
    const starIdx = plan.seqRows.filter((r) => !COSMETIC.has(r[data.seq.col.object]))
      .findIndex((r) => r === data.seq.rows[firstStar]);
    run(`seq: the first obj_knight_roaring_star row (f${data.seq.rows[firstStar][data.seq.col.frame]}) dropped`,
      (c) => { c.seq.rows.splice(firstStar, 1); },
      { group: 'creation order', index: starIdx });
  } else {
    console.log('  --   seq: no obj_knight_roaring_star after C in this recording; the drop case is moot');
  }
  // 5. the sim on the other side: rings of 8 (7) against a recording of 7 (8).
  if (firstStar >= 0) {
    const f = Number(data.seq.rows[firstStar][data.seq.col.frame]);
    const starIdx = plan.seqRows.filter((r) => !COSMETIC.has(r[data.seq.col.object]))
      .findIndex((r) => r === data.seq.rows[firstStar]);
    const res = checkLaunch(data, plan, { ...opts, sideb: !opts.sideb, quiet: true });
    const hit = res.findings.find((x) => x.group === 'creation order' && x.frame >= f && x.index <= starIdx + 8);
    const first = res.findings.find((x) => x.group === 'creation order');
    console.log(`  ${hit ? 'ok  ' : 'FAIL'} sim driven sideb ${!opts.sideb} against a sideb ${opts.sideb} recording`);
    console.log(`         wanted creation order around f${f} (the first ring: 7 stars vs 8);`
      + ` got ${first ? `creation order @ f${first.frame} #${first.index}` : 'nothing'}`);
    if (!hit) bad += 1;
  }
  // 6. the bullets sheet, where it carries a slot.
  if (data.bullets) {
    const r = data.bullets.rows.find((x) => frameOf(data.bullets, x) > plan.C
      && frameOf(data.bullets, x) <= plan.E && Number(x[data.bullets.col.live]) > 0);
    if (r) {
      const f = frameOf(data.bullets, r);
      run(`bullets: b0_x at f${f} + 1`, (c) => { poke(c.bullets, f, 'b0_x', plus(1)); },
        { group: 'slot position (x, y)', frame: f, col: 'b0_x' });
      run(`bullets: live at f${f} + 1`, (c) => { poke(c.bullets, f, 'live', (v) => String(Number(v) + 1)); },
        { group: 'live', frame: f, col: 'live' });
    } else {
      console.log('  --   bullets: no populated slot inside the window; the slot cases are moot');
    }
  } else {
    console.log('  --   bullets: no sheet with this recording; its two cases are moot until one lands');
  }
  // 7. the roar file: the finale's timer one frame after C, and a line slot.
  if (data.roar) {
    run(`roar: timer at f${plan.C + 1} + 1`, (c) => { poke(c.roar, plan.C + 1, 'timer', plus(1)); },
      { group: 'finale knight', frame: plan.C + 1, col: 'timer' });
    run(`roar: final_con at f${plan.C + 1} + 1`, (c) => { poke(c.roar, plan.C + 1, 'final_con', plus(1)); },
      { group: 'finale state', frame: plan.C + 1, col: 'final_con' });
    const lr = data.roar.rows.find((x) => frameOf(data.roar, x) > plan.C && x[data.roar.col.l0_x] !== '');
    if (lr) {
      const f = frameOf(data.roar, lr);
      run(`roar: l0_x at f${f} + 1`, (c) => { poke(c.roar, f, 'l0_x', plus(1)); },
        { group: 'slash lines', frame: f, col: 'l0_x' });
    } else {
      console.log('  --   roar: no slash line inside the window; the line case is moot');
    }
  } else {
    console.log('  --   roar: no probe file with this recording; its three cases are moot until one lands');
  }
  // The originals were never opened for writing; say so with a byte count.
  for (const p of [found.trace, found.seq, found.bullets, found.roar].filter(Boolean)) {
    console.log(`  (untouched: ${basename(p)}, ${statSync(p).size} bytes)`);
  }
  return bad;
}

// ── main ───────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const flag = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
  };
  const doSabotage = argv.includes('--sabotage');
  // `--quiet` keeps the verdict lines and drops the per-launch detail, for a
  // caller that only reads the exit code (kaizo/tools/verify-kaizo.mjs wires
  // this check REPORTED-not-enforced and pipes its output away).
  const quiet = argv.includes('--quiet');
  const only = flag('--only', null);
  const frames = Number(flag('--frames', '2400'));
  const context = Number(flag('--context', '3'));
  const spawnnBase = Number(flag('--spawnn', '1'));
  const explicit = argv.find((a) => !a.startsWith('--') && /\.csv$/i.test(a)
    && argv[argv.indexOf(a) - 1] !== '--only' && argv[argv.indexOf(a) - 1] !== '--frames'
    && argv[argv.indexOf(a) - 1] !== '--context' && argv[argv.indexOf(a) - 1] !== '--spawnn') ?? null;

  if (!ROW || ROW.ac !== 104) {
    console.log(`FAIL check-oracle-roaringdelta: VC_TABLE has no ${ENTRY} row with ac 104`);
    return 1;
  }

  // ── which recordings ─────────────────────────────────────────────────────
  const located = [];
  const looked = new Set();
  if (explicit) {
    const m = /^kaizo_oracle_trace(.*)\.csv$/.exec(basename(explicit));
    const tag = m ? m[1] : '';
    const rec = RECORDINGS.find((r) => r.tag === tag)
      ?? { tag, sideb: /B$/i.test(tag), raw: null, what: 'an explicit trace' };
    const f = locate(rec, explicit);
    if (f) located.push(f);
    else looked.add(explicit);
  } else {
    for (const rec of RECORDINGS) {
      if (only && rec.tag !== only) continue;
      const f = locate(rec);
      if (f) located.push(f);
      else {
        const probe = { rec, looked: [] };
        for (const d of candidateDirs(rec)) probe.looked.push(join(d, `kaizo_oracle_trace${rec.tag}.csv`));
        for (const l of probe.looked) looked.add(l);
      }
    }
  }
  if (!located.length) {
    console.log('SKIP check-oracle-roaringdelta: no RoaringDelta lock recording found (SKIPPED)');
    for (const l of [...looked].sort()) console.log(`     looked for ${l}`);
    console.log('     Record one: knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1 -Mode 1'
      + ' -Lock atk_RoaringDelta -Frames 2400 -Roar 1 -Tag _roaringdelta2 [-SideB 1 -Tag _roaringdeltaB]');
    console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
    console.log('     THE ROARING DELTA FINALE IS THEN UNCHECKED AGAINST THE REAL MOD.');
    return 0;
  }

  let failures = 0;
  let launches = 0;
  let sabotageBad = 0;
  let sabotageRan = false;
  for (const found of located) {
    const rec = found.rec;
    console.log(`\ncheck-oracle-roaringdelta: ${found.trace}`);
    console.log(`  ${rec.tag} — ${rec.what}; sideb ${rec.sideb}`);
    if (!found.seq) {
      console.log(`  SKIP this recording: its seq companion is missing (kaizo_oracle_seq${rec.tag}.csv),`
        + ' and C is the obj_knight_roaring2 seq row — nothing can be aligned without it.');
      continue;
    }
    const data = {
      rec,
      trace: readTrace(found.trace),
      seq: readCsv(found.seq),
      bullets: found.bullets ? readCsv(found.bullets) : null,
      roar: found.roar ? readCsv(found.roar) : null,
    };
    for (const need of ['frame', 'soul_x', 'soul_y', 'inv', 'attackchoice', 'turntimer', 'gt_x', 'gt_xs', 'bullets']) {
      if (data.trace.col[need] === undefined) {
        console.log(`  FAIL: the trace has no "${need}" column (${data.trace.header.join(',')})`);
        failures += 1;
        continue;
      }
    }
    console.log(`  trace ${data.trace.rows.length} rows (f${frameOf(data.trace, data.trace.rows[0])}`
      + `..f${frameOf(data.trace, data.trace.rows[data.trace.rows.length - 1])}), seq ${data.seq.rows.length} rows`
      + `, bullets ${data.bullets ? `${data.bullets.rows.length} rows` : 'ABSENT'}`
      + `, roar ${data.roar ? `${data.roar.rows.length} rows` : 'ABSENT'}`);

    const roaringRows = data.seq.rows.filter((r) => r[data.seq.col.object] === 'obj_knight_roaring2');
    if (!roaringRows.length) {
      console.log('  SKIP this recording: the seq logs no obj_knight_roaring2 — the lock never launched the roar');
      continue;
    }
    const plans = roaringRows.map((r, i) => planLaunch(data, r, i,
      i + 1 < roaringRows.length ? Number(roaringRows[i + 1][data.seq.col.frame]) : null));
    console.log(`  ${plans.length} locked launch(es): ${plans.map((p) => `C=f${p.C}`).join(', ')}`);

    for (const plan of plans) {
      launches += 1;
      const opts = { sideb: rec.sideb, spawnn: spawnnBase + plan.launchIndex, frames, context, quiet };
      const res = checkLaunch(data, plan, opts);
      if (res.findings.length) {
        failures += 1;
        console.log('\n    The FIRST group listed is the one to fix; the rest are usually its downstream.');
      }
    }
    if (doSabotage) {
      sabotageRan = true;
      sabotageBad += sabotage(found, data, plans, { sideb: rec.sideb, spawnn: spawnnBase, frames, context });
    }
  }

  console.log('\nWHAT THIS COMPARED, AND WHAT IT DID NOT');
  console.log('  compared   attackchoice, turntimer, gt_x/gt_y/gt_xs/gt_ys, soul_x/soul_y, inv, bullets');
  console.log('             as EXACT TEXT from the board\'s birth to the hand-back; every recorded');
  console.log('             creation in the window (object, x, y, angle, xscale, yscale, direction,');
  console.log('             speed) in the recorder\'s own order; the 32 bullet slots within CELL_TOL');
  console.log('             and the finale probe\'s state + 32 slash-line slots, where those files exist.');
  console.log('  NOT        party HP / damage / targeting (pinned on both sides); the RNG stream');
  console.log('             beyond the per-launch anchor; draw order, sprites, sound.');
  for (const [c, why] of TRACE_SKIPPED) console.log(`  SKIPPED    ${c} — ${why}`);
  for (const [n, why] of COSMETIC) console.log(`  SET ASIDE  ${n} — ${why}`);

  if (doSabotage) {
    if (!sabotageRan) {
      console.log('\n  sabotage: nothing to corrupt (no recording with a seq companion)');
      return failures ? 1 : 0;
    }
    console.log(`\n  sabotage: ${sabotageBad ? `${sabotageBad} case(s) NOT caught` : 'every case caught at its cell'}`);
    return sabotageBad ? 1 : 0;
  }
  console.log(`\ncheck-oracle-roaringdelta: ${launches} launch(es) over ${located.length} recording(s) — `
    + (failures ? `${failures} with a divergence` : 'byte-exact'));
  return failures ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
