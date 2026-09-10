#!/usr/bin/env node
// ORACLE CHECK — THE DRAW SHEET: what the mod actually PAINTS, frame by frame,
// held against what the sim paints, for the four MODE 1 colour LOCK recordings
// of 2026-09-09.
//
//   node kaizo/tools/checks/check-colours-sheet.mjs [options]
//
//     --quiet         verdict lines only (kaizo/tools/verify-kaizo.mjs wires
//                     this REPORTED-not-enforced and pipes the detail away)
//     --only <tag>    one recording: _cs_tunnel2 / _cs_starstorm4 /
//                     _cs_multislash1 / _cs_splitter1
//     --object <name> restrict every report to one GML object name
//     --context N     rows of context around a divergence (default 3)
//     --frames N      cap the replay at N frames after the board is raised
//     --sabotage      corrupt COPIES of the sheet (never the files) and drive
//                     the sim at the wrong VC_TABLE row; every corruption must
//                     be caught in its own group AND be a finding the
//                     untouched sheet does not already produce, or this exits 1
//
// V-C recreation of another author's creative work — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
//
// kaizo/tools/checks/check-colours.mjs pins three colour gaps (G1, G2, G3)
// NUMERICALLY TO THE GML, because when it was written no recording carried a
// single draw field: the recorder logged no `image_blend`, `sprite_index`,
// `image_alpha` or `depth` anywhere, so every colour claim in this recreation
// had been read off the dump and none had ever been held against the game
// (the 2026-09-08 colour report, knight-research/kaizo-mod/notes/
// 2026-09-08-gap-attack-colours.md §4).
//
// On 2026-09-09 that changed: four MODE 1 attack locks were recorded with
// `-DrawSheet 1`, 900 frames each, and each carries
// `kaizo_oracle_draw<TAG>.csv` — ONE ROW PER LIVE WATCHED INSTANCE PER FRAME,
// seventeen columns wide (frame, id, object, sprite_index, image_index,
// image_alpha, image_blend, depth, visible, image_xscale, image_yscale,
// image_angle, r, g, b, outline, coltimer). They sat on disk unread until this
// file. This is the check that reads them.
//
// It is check-oracle-roaringdelta.mjs's treatment, applied to colour: replay
// each locked attack through the REAL launcher (kaizo/scenes/
// kaizo-mod-launcher.js openVCArena + launchVCAttack on the VC_TABLE row
// itself), diff the sim's per-frame draw state against the sheet's, GROUP BY
// OBJECT, name the cosmetic-only columns as set aside rather than tolerating
// them quietly, and report the first divergence per group.
//
// ── THE TWO COMPARISONS, and why there are two ────────────────────────────
//
// THE VOCABULARY (primary). For each object and each colour column, the SET of
// distinct values the recording shows — with the row count behind each — held
// against the set the sim shows. This is what a colour claim actually is:
// "the revised blade is white, then eleven steps of 21.25, then rests at
// 21.25 with b pinned at 255, and its blend is c_white throughout" is a
// statement about a VALUE SET, and it stays true under a one-frame skew, a
// different RNG draw, or one extra instance. A value only the mod paints is a
// MISSING colour; a value only the sim paints is an INVENTED one. Both are
// reported, with counts, and both set the exit code.
//
// THE FRAME-EXACT DIFF (secondary). Per object, per frame, instances aligned by
// creation order (the sheet sorts by instance id, which in GameMaker IS
// creation order; the sim sorts by `seq`), first divergence per column. This
// is the strict claim and it is the one a lock replay is least able to keep:
// the harness re-anchors WELL512 per spawner call, so an attack whose bullet
// count or sprite choice is a random draw diverges in POPULATION long before
// it diverges in COLOUR. Reported, and only the columns listed in
// EXACT_GROUPS set the exit code.
//
// ── ALIGNMENT, and where every number the replay is handed comes from ─────
//
//   G   the frame `gt_x` turns non-empty in the trace while `attackchoice`
//       already carries the locked row's ac — the mnfight-1.5 board raise.
//       Detected, then printed.
//   C   G + 12 (`rtimer == 12`, the mnfight-2 dispatch). Asserted against the
//       seq companion's first creation row for the entry's controller object
//       when the recording carries one.
//   the soul  AN INPUT, pinned from the trace's soul_x / soul_y on EVERY
//       frame, not just at the launch. A MODE 1 lock is driven by a pulse
//       token (tools/gen-pulse-token.mjs, mask 32 every fifteenth frame) and
//       this replay has no input feed at all; several of the objects on the
//       sheet aim at obj_heart (obj_knight_rotating_slash's bloom and fan,
//       obj_knight_diamondswordbullet_ext's Other_10 turn, the vortex's
//       tracking), so comparing their colour across two different soul paths
//       would measure the harness. check-oracle-tunnel.mjs pins the soul at
//       the launch frame for exactly this reason; a colour window is long
//       enough that it has to be pinned all the way through.
//   inv  pinned from the trace the same way (the blade's Other_15 catch reads
//       `global.inv < 0`).
//   the clock  seeded with vcTurnLength for the row and decremented once a
//       frame, the bench pattern check-oracle-tunnel.mjs uses.
//   the RNG  the harness re-anchors WELL512 per scr_bulletspawner call
//       (`seed + spawnn * 1000`, CLAUDE.md). A lock run's first turn is
//       atk_Starstorm1 (one spawner call, n = 0), so the first locked launch
//       is n = 1 and each further locked launch in the same file is n + 1.
//
// ── WHAT IS COMPARED, AND WHAT IS SET ASIDE ──────────────────────────────
//
// COMPARED  sprite_index, image_blend, visible, and the mod's own per-instance
//           colour fields r, g, b, outline, coltimer. image_blend is the
//           PACKED BGR INTEGER exactly as the runner holds it; the sim stores
//           `image_blend` as an [r, g, b] array and an unassigned blend is
//           GameMaker's c_white, so the sim side packs the array and defaults
//           to 16777215 — stated here because that default is an assumption
//           the sheet then tests.
//
// SET ASIDE image_index, image_alpha, image_xscale, image_yscale,
//           image_angle — POSE, not colour, and every one of them is already
//           the byte gate's business: verify-kaizo-fullfight.mjs compares
//           xs/ys/angle per bullet slot within CELL_TOL. Naming them here
//           keeps this file about paint.
//
//           depth — REPORTED, never enforced, for a measured reason. The
//           sheet's depths are GameMaker's per-object runtime defaults
//           (`__global_object_depths`: obj_growtangle 5, obj_heart 1,
//           obj_afterimage 89 …) and THIS ENGINE MODELS NONE OF THEM: an
//           entity's `depth` is undefined until some GML line writes it, and
//           the renderer reads that as 0 (RENDER-CRITIC item 4). So every
//           object is offset by its own object default and the offset is not
//           a colour fault. What the report DOES print is the offset itself,
//           per object, and whether it is CONSTANT — a constant offset is the
//           unmodelled default and nothing more, a varying one is a real
//           depth write the sim got wrong. That is how obj_sword_vortex's
//           `depth = cone.depth - 1` and the tunnel decoy's
//           `depth = obj_growtangle.depth - 1` are read off this sheet
//           without pretending the engine has object defaults.
//
// SET ASIDE PER OBJECT  a column the object's GML NEVER WRITES. THIS ONE IS
//           HERE BECAUSE THE CHECK GOT IT WRONG ONCE, and the wrong answer
//           reached the ledger (2026-09-10, "What the check found that nobody
//           was looking for": "obj_knight_pointing_star is c_white on all
//           1,637 recorded rows of Starstorm 4, and the sim tints it — the
//           largest single colour divergence on any of the four sheets").
//           IT IS NOT A DIVERGENCE. `image_blend` is a BUILT-IN: the recorder
//           logs it on every row whether or not anything ever assigned it, and
//           an unassigned one reads GameMaker's c_white. The star's Draw_0
//           paints with `_color = merge_color(c_gray, #86A2FF, clamp01(timer
//           / 30))` (:7, and from c_white at :16 when `stay == 1`) passed as
//           the BLEND ARGUMENT of draw_sprite_ext (:56) — a Draw LOCAL. Its
//           five event files never touch `image_blend`, and neither does any
//           `with (obj_knight_pointing_star)` block in the dump (there are
//           two, both in obj_knight_pointing_cone, and both only call
//           event_user(0)). So the sheet's 1,637 c_white cells say the star
//           never assigned the variable — NOT that the star is white; the
//           mod's star is tinted on screen, and the sim, which has no Draw
//           locals and multiplies its blit by `image_blend`, is RIGHT to
//           carry the tint there (kaizo/attacks/stars-pointing-star.js:405-427
//           says so at the site). Acting on the finding would have deleted a
//           correct tint.
//           NEVER_WRITTEN below is the explicit list, one entry per (object,
//           column) with the GML that proves it, audited against the dump on
//           every run where the dump is present. And because the burden is on
//           the positive claim, EVERY REMAINING image_blend FINDING is checked
//           the same way: an object with no resolvable write anywhere in the
//           dump gets its blend finding filed as UNPROVEN, not as a colour
//           divergence, and the report says what to read before promoting it.
//
// SET ASIDE BY NAME  obj_afterimage — the knight's always-on seven-colour
//           rainbow trail dominates the population (8,536 rows in the Tunnel 2
//           window alone) and this bench mounts the VANILLA knight actor, so
//           the two sides are not the same population. Its BLADE ghosts are
//           the colour fact, and they are still compared: the vocabulary pass
//           runs on obj_afterimage too, it is only the frame-exact pass that
//           skips it. Said out loud on every run, with both counts.
//
//           obj_writer / obj_battleblcon — the director's message box. This
//           replay drives ONE attack and has no director, the same reason
//           check-oracle-roaringdelta sets them aside.
//
// NOT ON THE SHEET AT ALL, on either side: anything outside the recorder's
// watch list. The sheet's population is the seq watch list UNION
// obj_collidebullet (oracle_kaizo_fight.csx, the Draw_75 patch), so the sim
// side applies the same rule and lists what it dropped. obj_knight_enemy was
// added to that patch AFTER these four locks were taken — no lock here has a
// single knight row — so the knight is dropped too, and the check says so
// rather than reporting him as missing.
//
// ── SKIP, and the sabotage ────────────────────────────────────────────────
//
// With no lock on the machine (or KAIZO_ORACLE_TRACES pointing at a directory
// without one) this prints `SKIP check-colours-sheet` and exits 0, so the
// kaizo gate stays green where knight-research is absent — and the loud skip
// is the point: a green gate with no draw-sheet line has held no colour
// against the mod.
//
// `--sabotage` proves the comparisons bite: on in-memory copies it repaints
// one object's blend column, renames one sprite, moves one r cell and flips
// one `visible`, and drives the sim on a DIFFERENT VC_TABLE row; each must
// surface in its own group. The originals are never written.
//
// EVERY CASE IS DIFFERENTIAL, and it has to be: this check is RED BY DESIGN,
// so "a finding exists" is true of every un-sabotaged run and proves nothing.
// A case therefore computes the baseline from the untouched sheet first, picks
// an object that is on BOTH sides and does not already diverge on the column
// (nor have a population divergence at or before the corrupted frame — that
// stops the column comparison), and passes only on a finding the baseline does
// not have. Cases that find no such object say MOOT rather than passing.
//
// Case 5 used to flip `sideb` and ask for any finding. Measured 2026-09-10:
// the route flag changes nothing three of these four A-Side windows can see,
// so the "corruption" was not one. The flip is still run and REPORTED, with
// the observation printed either way; the case itself now launches the sim on
// another attack entirely, which cannot be a no-op.
//
// Wired into kaizo/tools/verify-kaizo.mjs REPORTED-not-enforced (2026-09-10).

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox, settleBox } from '../../../sim/battlebox.js';
import { knightActor, BOX, SOUL_START, KNIGHT } from '../../../sim/actors.js';
import { gmlCreate } from '../../../sim/rng.js';
import { real } from '../../../sim/trace.js';
import { VC_TABLE } from '../../versions/vc-script.js';
import { launchVCAttack, openVCArena, vcTurnLength } from '../../scenes/kaizo-mod-launcher.js';
import { readTrace } from './check-oracle-schedule.mjs';

/** run-kaizo-oracle.ps1's `-Seed` default; every lock so far used it. */
const ORACLE_SEED = 20260810;

/**
 * The four colour locks, in the order the 2026-09-09 ledger section lists
 * them ("THE DRAW SHEET, USED"). `raw` is the recording agent's per-tag
 * directory under kaizo-mod/locks/; the tag is also looked for in locks/,
 * traces/ and oracle/traces/, the two-directory trap check-oracle-schedule.mjs
 * documents.
 */
const RECORDINGS = [
  {
    tag: '_cs_tunnel2', entry: 'atk_Tunnel2', raw: 'cs_tunnel2-raw', sideb: false,
    what: 'the revised blades (gap G1): obj_knight_diamondswordbullet_ext, 3,601 rows',
  },
  {
    tag: '_cs_starstorm4', entry: 'atk_Starstorm4', raw: 'cs_starstorm4-raw', sideb: false,
    what: 'the vortex under a cone (gap G2): obj_sword_vortex 1,354 rows, obj_knight_pointing_cone 477',
  },
  {
    tag: '_cs_multislash1', entry: 'atk_Multislash1', raw: 'cs_multislash1-raw', sideb: false,
    what: 'the aim bloom (G3) and the slash-mark debris (G6): obj_knight_circle 110 rows,'
      + ' obj_particle_generic 3,774, obj_knight_rotating_slash 468',
  },
  {
    tag: '_cs_splitter1', entry: 'atk_Splitter1', raw: 'cs_splitter1-raw', sideb: false,
    what: 'the teeth ramp (G9 rounding): obj_roaringknight_split_bullet 4,066 rows',
  },
];

function candidateDirs(rec) {
  if (process.env.KAIZO_ORACLE_TRACES) return [process.env.KAIZO_ORACLE_TRACES];
  const km = join(homedir(), 'knight-research', 'kaizo-mod');
  return [join(km, 'locks', rec.raw), join(km, 'locks'), join(km, 'traces'),
    join(km, 'oracle', 'traces')];
}

// ── the recorder's watch list ─────────────────────────────────────────────
//
// Transcribed from knight-research/kaizo-mod/tools/patches/
// oracle_kaizo_fight.csx (`_names`), and RE-DERIVED FROM THAT FILE on every
// run where it is on the machine (`audits()` below) — the transcription
// claim is now checked rather than asserted. Unlike check-oracle-roaringdelta's
// copy the ORDER carries nothing here — the draw sheet sorts by instance id,
// not by watch index — so this is a membership set. It exists so that a sim
// entity the recorder never watched is DROPPED rather than reported as an
// invented object, and so that a watched object the recording never shows can
// be named.
//
// THIS SET IS `_names` AND NOTHING ELSE. Three names that used to sit in it —
// obj_sword_vortex, obj_sword_tunnel_sword, obj_tracking_sword_slash — are NOT
// in `_names` and never were, and the comment that said they were transcribed
// from it was wrong. They are on the sheets all the same, through the OTHER
// half of the population rule: the draw sheet is written from a Draw_75 patch
// whose `with (obj_collidebullet)` catches every bullet, and all three are
// obj_collidebullet children (`scr_bullet_init` in each of their Creates;
// obj_sword_vortex alone is 1,354 rows of the Starstorm 4 sheet). The sim side
// lets them through by the same route — `e.isBullet === true`, which all three
// set — so removing them from WATCHED drops nothing. They are named in
// UNION_BULLETS below so the receipt stays attached to them.
const WATCHED = new Set([
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
  'obj_particle_generic', 'obj_writer', 'obj_battleblcon',
]);

/**
 * On the sheets, but NOT on the recorder's watch list: obj_collidebullet
 * children the Draw_75 patch's `with (obj_collidebullet)` catches. Listed only
 * so the receipt travels with the names — `watchedSim` already lets them (and
 * every other bullet) through on `e.isBullet`, so this set is documentation,
 * and `audits()` proves it by checking that none of them is in `_names`.
 */
const UNION_BULLETS = new Set([
  'obj_sword_vortex', 'obj_sword_tunnel_sword', 'obj_tracking_sword_slash',
]);

/**
 * The sim's own names for instances the mod makes through `scr_marker`
 * (a bare obj_marker). Same folding as check-oracle-roaringdelta's MOD_NAME,
 * for the same reason: this engine dispatches behaviour off `type`, the
 * recorder only ever sees the object name.
 */
const MOD_NAME = {
  kaizo_roaring_finalslash_line: 'obj_marker',
  kaizo_roaring_hideback: 'obj_marker',
  kaizo_shatterpiece: 'obj_marker',
  obj_marker_screenpiece: 'obj_marker',
  // sim/attacks/split-growtangle.js:74 — the split box's flame markers are
  // bare obj_marker instances too (`scr_dark_marker`, image_blend c_gray on
  // spr_rk_split_flame_big). Without this fold the sheet's 604 grey marker
  // rows read as an object the sim never makes.
  obj_marker_splitflame: 'obj_marker',
};
const modName = (n) => MOD_NAME[n] ?? n;

/** Set aside from the FRAME-EXACT pass only, by name and for a stated reason. */
const NO_EXACT = new Map([
  ['obj_afterimage', "the knight's always-on rainbow trail is most of this population and"
    + ' this bench mounts the VANILLA knight actor; the blade ghosts inside it are still'
    + ' compared by the vocabulary pass'],
  ['obj_writer', "the turn-end message box: this replay drives one attack and has no"
    + ' director to speak a line'],
  ['obj_battleblcon', "the balloon frame, the director's too and for the same reason"],
]);

/** Colour columns, compared as exact text and grouped for the report. */
const EXACT_GROUPS = [
  ['sprite', ['sprite_index']],
  ['blend', ['image_blend']],
  ['colour fields', ['r', 'g', 'b', 'outline', 'coltimer']],
  ['visible', ['visible']],
];
const VOCAB_COLS = ['sprite_index', 'image_blend', 'visible', 'r', 'g', 'b', 'outline', 'coltimer'];

/** Named, never compared. The reason is printed on every run. */
const SET_ASIDE_COLS = new Map([
  ['image_index', 'pose, not paint — and the animation clock is check-oracle-* territory'],
  ['image_alpha', 'pose: the lerpvar fade, already held by the per-attack checks'],
  ['image_xscale', "the byte gate's: verify-kaizo-fullfight.mjs compares xs per bullet slot within CELL_TOL"],
  ['image_yscale', 'same'],
  ['image_angle', 'same (0.001 deg there)'],
  ['depth', "GameMaker's per-object runtime default (__global_object_depths) is not modelled"
    + ' in this engine; REPORTED as a per-object offset instead — see the header'],
]);

// ── THE COLUMNS AN OBJECT NEVER WRITES ────────────────────────────────────
//
// `image_blend`, `visible` and `sprite_index` are BUILT-INS: the patch logs
// them unguarded (oracle_kaizo_fight.csx:1913-1918), so a row carries a value
// for them whether or not any line of GML ever assigned one. For image_blend
// that default is c_white — and GameMaker paints through `draw_sprite_ext`'s
// blend ARGUMENT, which does not have to come from image_blend. Comparing the
// column on an object that never writes it therefore measures the RECORDER,
// not the paint.
//
// One entry per (object, column), each with the GML that proves it. Set aside
// on BOTH sides, printed on every run, and re-derived from the dump by
// `blendWrites()` below whenever the dump is on the machine: an entry the dump
// contradicts is a FAILURE here, not a silent loosening. See the header for
// the finding this list exists to retract.
const NEVER_WRITTEN = new Map([
  ['obj_knight_pointing_star.image_blend',
    'five event files (Create_0, Step_0, Draw_0, Other_10, Other_15) with no `image_blend`'
    + ' anywhere, and all THREE `with (obj_knight_pointing_star)` blocks in the dump'
    + ' (obj_knight_pointing_cone Draw_0:144 and :155, and its Step_0:46) set no blend. The star paints'
    + ' with a DRAW LOCAL: `_color = merge_color(c_gray, #86A2FF, clamp01(timer / 30))`'
    + ' (Draw_0:7, and from c_white at :16 under `stay == 1`), passed as the blend argument of'
    + ' draw_sprite_ext at :56. The recorded c_white is an unassigned built-in; the mod\'s star'
    + ' IS tinted, and the sim carries that tint on image_blend because this engine\'s blit'
    + ' multiplies by it (kaizo/attacks/stars-pointing-star.js:405-427)'],
]);

/**
 * Objects whose `image_blend` IS written, but from the CREATOR's scope — a
 * `with (<handle>)` the static scan below cannot resolve to an object name.
 * Hand-audited from the dump's unresolved sites; without this list their blend
 * findings would be filed UNPROVEN and a real divergence would go quiet.
 */
const BLEND_FROM_CREATOR = new Map([
  ['obj_afterimage_grow', 'scr_afterimage_grow_attached: `with (scr_afterimage_grow())'
    + ' image_blend = argument[1]` — the caller hands the ghost its colour, and the handle is'
    + " the script's return value, so no static scan can resolve it to a name"],
]);
// obj_marker, obj_particle_generic and obj_regularbullet were on this list too
// and did not belong: their colouring sites are `with (instance_create(...,
// obj_X))`, which the scan DOES resolve (scr_marker_ext, kaizo_settings_init,
// scr_fire_bullet). The audit below said so, which is what it is for.

const DUMP_DIR = () => join(homedir(), 'knight-research', 'kaizo-mod',
  'gml_kaizo_dump', 'CodeEntries');

const OBJ_EVENT = new RegExp('^gml_Object_(.+?)_(Create|Destroy|Step|Draw|Alarm|Other|Collision'
  + '|CleanUp|KeyPress|KeyRelease|Keyboard|Mouse|PreCreate|Gesture|Async|RoomStart|RoomEnd'
  + '|GameStart|GameEnd)_');

/**
 * Walk one GML file line by line, reporting the enclosing `with` target at
 * every line that assigns `col` (or names it as a string literal, which is how
 * `scr_var` / `variable_instance_set` write). `null` means self scope.
 *
 * The `with` stack is depth-tracked: a `with (...)` line opens a scope that
 * ends at the matching brace, and a brace-less `with (x) stmt;` ends on its own
 * line. Anything the scan cannot resolve to a literal object name is handed
 * back verbatim and counted as a blind spot rather than guessed at.
 */
function scanWrites(text, col, onHit) {
  const assign = new RegExp(`(^|[^\\w.])${col}\\s*(=[^=]|\\+=|-=|\\*=|/=)`);
  const literal = `"${col}"`;
  const stack = [];
  let depth = 0;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '');
    const w = /^\s*with\s*\(([^{}]*)\)\s*\{?\s*$/.exec(line);
    if (assign.test(line) || line.includes(literal)) {
      onHit(stack.length ? stack[stack.length - 1].t : null, line.trim());
    }
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    if (w) stack.push({ t: w[1].trim(), d: depth, open: false });
    depth += opens - closes;
    for (const s of stack) if (depth > s.d) s.open = true;
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.open && depth <= top.d) stack.pop();
      else if (!top.open && !w) stack.pop();
      else break;
    }
  }
}

let blendCache = null;

/**
 * Which objects the kaizo dump can be shown to write `image_blend` on, and how.
 * Three scopes resolve: the object's own events at self scope, any
 * `with (obj_X)` block, and `with (instance_create(..., obj_X))`. Everything
 * else — `with (<handle>)`, overwhelmingly a creator colouring the instance it
 * just made — is the NAMED BLIND SPOT, returned with its sites so the report
 * can print how big it is; BLEND_FROM_CREATOR is its hand-audited answer.
 *
 * Returns null when the dump is not on this machine, and the caller then says
 * so out loud rather than treating "no evidence" as "never written".
 */
function blendWrites() {
  if (blendCache !== null) return blendCache;
  const dir = DUMP_DIR();
  if (!existsSync(dir)) { blendCache = { absent: true, dir }; return blendCache; }
  const how = new Map();
  const unresolved = [];
  const note = (obj, kind) => { if (!how.has(obj)) how.set(obj, kind); };
  for (const f of readdirSync(dir)) {
    const text = readFileSync(join(dir, f), 'utf8');
    if (!text.includes('image_blend')) continue;
    const m = OBJ_EVENT.exec(f);
    scanWrites(text, 'image_blend', (target, line) => {
      if (target === null || target === 'self' || target === 'id') {
        if (m) note(m[1], 'its own events, at self scope');
        return;
      }
      if (/^obj_[A-Za-z0-9_]+$/.test(target)) { note(target, `a with (${target}) block`); return; }
      const created = /instance_create\w*\s*\([^)]*?(obj_[A-Za-z0-9_]+)\s*\)/.exec(target);
      if (created) { note(created[1], `with (${target})`); return; }
      unresolved.push(`${f}: with (${target}) ${line}`);
    });
  }
  blendCache = { absent: false, dir, how, unresolved };
  return blendCache;
}

/** True when (object, column) is on the explicit NEVER_WRITTEN list. */
const setAside = (object, col) => NEVER_WRITTEN.has(`${object}.${col}`);

/**
 * Why an `image_blend` finding on this object is not yet a colour claim, or
 * null when it is one. Null is also the answer when the dump is absent — "no
 * evidence" is not "never written", and the report says the dump was missing.
 */
function blendUnproven(object) {
  const w = blendWrites();
  if (w.absent) return null;
  if (BLEND_FROM_CREATOR.has(object)) return null;
  if (w.how.has(object)) return null;
  return 'no image_blend write resolves to it anywhere in the kaizo dump — read its Draw'
    + " event before calling this a colour divergence: draw_sprite_ext's blend argument does"
    + ' not have to come from image_blend, and the recorded c_white may simply be the'
    + ' unassigned built-in';
}

/** The recorder's `_names`, re-read from the patch when it is on the machine. */
function patchNames() {
  const p = join(homedir(), 'knight-research', 'kaizo-mod', 'tools', 'patches',
    'oracle_kaizo_fight.csx');
  if (!existsSync(p)) return null;
  const text = readFileSync(p, 'utf8');
  const block = /var _names = \[([\s\S]*?)\n    \];/.exec(text);
  if (!block) return null;
  const body = block[1].split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  return new Set([...body.matchAll(/""([A-Za-z_0-9]+)""/g)].map((m) => m[1]));
}

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

function locate(rec) {
  for (const dir of candidateDirs(rec)) {
    const draw = join(dir, `kaizo_oracle_draw${rec.tag}.csv`);
    const trace = join(dir, `kaizo_oracle_trace${rec.tag}.csv`);
    if (!existsSync(draw) || !existsSync(trace)) continue;
    // A sheet still being written is not a recording yet.
    if (statSync(draw).size < 2048) continue;
    const seq = join(dir, `kaizo_oracle_seq${rec.tag}.csv`);
    return { rec, dir, draw, trace, seq: existsSync(seq) ? seq : null };
  }
  return null;
}

// ── the sim side ───────────────────────────────────────────────────────────

const IDLE = { left: false, right: false, up: false, down: false, focus: false };

/**
 * A fight-shaped bench with nothing but the Knight, the board and the soul —
 * no director, so the only thing that ever launches is the row under test.
 * check-oracle-tunnel.mjs's `bench`, verbatim in shape.
 */
function bench(seed, sideb) {
  const st = createState({ seed, traceBulletSlots: 0 });
  st.view = { x: 0, y: 0 };
  st.hp = 0;
  st.invTimer = -1;
  st.keepAlive = true;
  st.damageEnabled = false; // oracle-parity: contact without a Game Over
  st.invc = 1;
  st.gmlRng = gmlCreate(seed);
  st.seed = seed;
  st.kaizo = {
    version: sideb ? 'D' : 'C', sideb, approx: [], launched: [], vars: {}, hooks: {},
  };
  st.knight = spawn(st, knightActor, { x: KNIGHT.x, y: KNIGHT.ystart });
  settleBox(spawn(st, battlebox, { x: BOX.x, y: BOX.y }));
  st.soul = spawn(st, soul, { ...SOUL_START });
  return st;
}

/** GML's packed BGR integer for the sim's [r, g, b] image_blend. */
function packBlend(b) {
  if (Array.isArray(b) && b.length === 3) {
    return String(Math.trunc(b[0]) + (Math.trunc(b[1]) * 256) + (Math.trunc(b[2]) * 65536));
  }
  if (typeof b === 'number') return String(b);
  // GameMaker's default. An assumption, and the sheet is what tests it.
  return '16777215';
}

/** A cell as the recorder prints it: string_format(v, 0, 10), or empty. */
function cell(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return real(v ? 1 : 0);
  if (typeof v === 'string') return v;
  if (!Number.isFinite(v)) return String(v);
  return real(v);
}

/**
 * One live instance as the draw sheet would have logged it. `sprite_index` is
 * the sprite NAME (the sim already stores names); `outline` is written by
 * `string()` in the patch, not string_format, so it is passed through raw.
 */
function simDrawRow(e) {
  return {
    object: modName(e.type.name),
    sprite_index: e.sprite_index ?? '',
    image_blend: packBlend(e.image_blend),
    depth: e.depth === undefined ? '' : cell(e.depth),
    visible: e.visible === false ? '0' : '1',
    r: cell(e.r),
    g: cell(e.g),
    b: cell(e.b),
    // `outline` is a COLOUR on both sides (obj_knight_pointing_starchild
    // Step_0:115 writes merge_color into it), so the sim holds an [r, g, b]
    // array where the patch logs `string(outline)`, the packed int. Packed
    // here for the same reason image_blend is: comparing "0,0,0" against "0"
    // would report a divergence that is only a representation.
    outline: e.outline === undefined ? '' : packBlend(e.outline),
    coltimer: cell(e.coltimer),
    seq: e.seq,
  };
}

/**
 * The recorder's own population rule, applied to the sim: the seq watch list
 * UNION obj_collidebullet (oracle_kaizo_fight.csx's Draw_75 patch), minus
 * obj_heart, which is a collidebullet child the patch's `with (obj_collidebullet)`
 * does NOT reach (the soul is obj_heart, not a bullet, in both worlds).
 */
function watchedSim(e, { knightRow }) {
  const n = modName(e.type.name);
  if (n === 'obj_heart') return false;
  if (n === 'obj_knight_enemy') return knightRow;
  return WATCHED.has(n) || e.isBullet === true;
}

/**
 * Replay one locked launch. `plan` carries every number the recording supplies
 * (see the header's ALIGNMENT section); nothing else is invented.
 */
function replay(plan, { frames, sideb, spawnn, row, knightRow }) {
  const st = bench(ORACLE_SEED, sideb);
  st.spawnn = spawnn;
  openVCArena(st, row, { sideb });

  const t = plan.trace;
  const pin = (f) => {
    const r = t.by.get(f);
    if (!r) return;
    if (st.soul && r[t.col.soul_x] !== '') {
      st.soul.x = Number(r[t.col.soul_x]);
      st.soul.y = Number(r[t.col.soul_y]);
    }
    if (r[t.col.inv] !== '') st.invTimer = Number(r[t.col.inv]);
  };

  // The board is raised under mnfight 1.5 and the attack spawns twelve frames
  // later under mnfight 2 (rtimer == 12), so eleven steps put the sim at the
  // point of the grow-in the recording is at on its launch frame.
  for (let i = 0; i < 11; i++) stepFrame(st, IDLE);
  pin(plan.C);
  st.turntimer = vcTurnLength(row, { sideb });
  launchVCAttack(st, row, { sideb });

  const rows = new Map();
  const dropped = new Set();
  const record = (f) => {
    const live = [];
    for (const e of st.entities) {
      if (!e.alive) continue;
      if (!watchedSim(e, { knightRow })) { dropped.add(e.type.name); continue; }
      live.push(e);
    }
    // The sheet sorts by instance id, which in GameMaker is creation order;
    // the sim's `seq` is the same ordering.
    live.sort((a, b) => a.seq - b.seq);
    rows.set(f, live.map(simDrawRow));
  };
  record(plan.C);
  for (let f = plan.C + 1; f <= plan.C + frames; f++) {
    stepFrame(st, IDLE);
    pin(f);
    if (st.turntimer > 0) st.turntimer -= 1;
    record(f);
    if (f > plan.E) break;
  }
  return { rows, dropped, state: st };
}

// ── the oracle side ────────────────────────────────────────────────────────

/** The sheet, as frame -> [row], each row already keyed by column name. */
function oracleRows(draw, from, to) {
  const c = draw.col;
  const out = new Map();
  for (const r of draw.rows) {
    const f = Number(r[c.frame]);
    if (f < from || f > to) continue;
    if (!out.has(f)) out.set(f, []);
    out.get(f).push({
      object: r[c.object],
      id: r[c.id],
      sprite_index: r[c.sprite_index],
      image_index: r[c.image_index],
      image_alpha: r[c.image_alpha],
      image_blend: r[c.image_blend],
      depth: r[c.depth],
      visible: r[c.visible],
      r: r[c.r],
      g: r[c.g],
      b: r[c.b],
      outline: r[c.outline],
      coltimer: r[c.coltimer],
    });
  }
  // The patch writes ids already sorted ascending; make that an observation.
  return out;
}

// ── the vocabulary ─────────────────────────────────────────────────────────

function vocabulary(frames, pick) {
  const voc = new Map();
  for (const [, list] of frames) {
    for (const e of list) {
      const o = pick(e);
      if (!voc.has(o)) voc.set(o, { n: 0, cols: new Map(VOCAB_COLS.map((c) => [c, new Map()])) });
      const g = voc.get(o);
      g.n += 1;
      for (const c of VOCAB_COLS) {
        const m = g.cols.get(c);
        const v = e[c] ?? '';
        m.set(v, (m.get(v) ?? 0) + 1);
      }
    }
  }
  return voc;
}

const show = (v) => (v === '' ? '(unset)' : v);

/**
 * Compare two value sets for one (object, column). A value only the mod paints
 * is MISSING; a value only the sim paints is INVENTED. Counts are printed on
 * both sides but never compared — a population difference is not a colour
 * fault, and saying so is the point of this pass.
 */
function diffVocab(o, s) {
  const missing = [];
  const invented = [];
  for (const [v, n] of o) if (!s.has(v)) missing.push([v, n]);
  for (const [v, n] of s) if (!o.has(v)) invented.push([v, n]);
  const sortByCount = (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]));
  missing.sort(sortByCount);
  invented.sort(sortByCount);
  return { missing, invented };
}

// ── the frame-exact diff ───────────────────────────────────────────────────

/**
 * First divergence per group, per object: the oracle's k-th live instance of
 * an object on frame f against the sim's k-th. A COUNT difference is reported
 * as its own finding (`population`) and stops that object's column comparison
 * at that frame, because past it the k-th instances are not the same instance.
 */
function compareExact(oFrames, sFrames, { from, to, only }) {
  const findings = [];
  const stats = { frames: 0, cells: 0, objects: new Set() };
  const byObject = new Map();
  const push = (map, f, e, o) => {
    if (!map.has(o)) map.set(o, new Map());
    const m = map.get(o);
    if (!m.has(f)) m.set(f, []);
    m.get(f).push(e);
  };
  for (let f = from; f <= to; f++) {
    const ol = oFrames.get(f);
    const sl = sFrames.get(f);
    if (!ol || !sl) continue;
    stats.frames += 1;
    for (const e of ol) push(byObject, f, e, `o:${e.object}`);
    for (const e of sl) push(byObject, f, e, `s:${e.object}`);
  }
  const names = new Set();
  for (const k of byObject.keys()) names.add(k.slice(2));
  for (const name of [...names].sort()) {
    if (only && name !== only) continue;
    if (NO_EXACT.has(name)) continue;
    stats.objects.add(name);
    const oM = byObject.get(`o:${name}`) ?? new Map();
    const sM = byObject.get(`s:${name}`) ?? new Map();
    let popFinding = null;
    let stopAt = to + 1;
    for (let f = from; f <= to && !popFinding; f++) {
      if (!oFrames.has(f) || !sFrames.has(f)) continue;
      const a = (oM.get(f) ?? []).length;
      const b = (sM.get(f) ?? []).length;
      if (a !== b) {
        popFinding = { object: name, group: 'population', frame: f, col: 'live',
          oracle: String(a), sim: String(b) };
        stopAt = f;
      }
    }
    for (const [group, allCols] of EXACT_GROUPS) {
      // A column this object never writes is not compared on either side.
      const cols = allCols.filter((c) => !setAside(name, c));
      if (!cols.length) continue;
      let best = null;
      for (let f = from; f < stopAt && !best; f++) {
        const ol = oM.get(f);
        const sl = sM.get(f);
        if (!ol || !sl) continue;
        for (let i = 0; i < Math.min(ol.length, sl.length) && !best; i++) {
          for (const c of cols) {
            const ov = ol[i][c] ?? '';
            const sv = sl[i][c] ?? '';
            stats.cells += 1;
            if (ov !== sv) {
              best = { object: name, group, frame: f, col: c, slot: i, oracle: ov, sim: sv };
              break;
            }
          }
        }
      }
      if (best) findings.push(best);
    }
    if (popFinding) findings.push(popFinding);
  }
  return { findings, stats };
}

// ── the depth report ───────────────────────────────────────────────────────

/**
 * Per object, the offset between the recorded depth and the sim's, and
 * whether it is CONSTANT. A constant offset is GameMaker's unmodelled object
 * default; a varying one is a depth WRITE the sim got wrong. Never a finding —
 * see the header.
 */
function depthReport(oFrames, sFrames, { from, to }) {
  const per = new Map();
  for (let f = from; f <= to; f++) {
    const ol = oFrames.get(f);
    const sl = sFrames.get(f);
    if (!ol || !sl) continue;
    const group = (list) => {
      const m = new Map();
      for (const e of list) {
        if (!m.has(e.object)) m.set(e.object, []);
        m.get(e.object).push(e);
      }
      return m;
    };
    const og = group(ol);
    const sg = group(sl);
    for (const [name, oList] of og) {
      const sList = sg.get(name);
      if (!sList || sList.length !== oList.length) continue;
      if (!per.has(name)) per.set(name, new Map());
      const m = per.get(name);
      for (let i = 0; i < oList.length; i++) {
        const ov = oList[i].depth === '' ? null : Number(oList[i].depth);
        const sv = sList[i].depth === '' ? 0 : Number(sList[i].depth);
        if (ov === null) continue;
        const key = Number.isFinite(sv) ? String(ov - sv) : `sim ${sList[i].depth || 'unset'}`;
        m.set(key, (m.get(key) ?? 0) + 1);
      }
    }
  }
  return per;
}

// ── reporting ──────────────────────────────────────────────────────────────

function pad(v, n) { return String(v ?? '').padStart(n); }

function showExactContext(oFrames, sFrames, f, context) {
  const lines = [];
  for (let r = f.frame - context; r <= f.frame + context; r++) {
    const ol = (oFrames.get(r) ?? []).filter((e) => e.object === f.object);
    const sl = (sFrames.get(r) ?? []).filter((e) => e.object === f.object);
    if (!ol.length && !sl.length) continue;
    const ov = f.col === 'live' ? String(ol.length) : (ol[f.slot ?? 0]?.[f.col] ?? '(no instance)');
    const sv = f.col === 'live' ? String(sl.length) : (sl[f.slot ?? 0]?.[f.col] ?? '(no instance)');
    const mark = ov === sv ? '  ' : '->';
    lines.push(`      ${mark} frame ${pad(r, 6)}   oracle ${pad(ov, 20)}   sim ${pad(sv, 20)}`);
  }
  return lines.join('\n');
}

// ── one locked launch ──────────────────────────────────────────────────────

function checkLaunch(data, plan, opts) {
  const { sideb, spawnn, frames, context, quiet, only } = opts;
  const say = (...a) => { if (!quiet) console.log(...a); };
  const runFrames = Math.max(1, Math.min(frames, plan.E - plan.C + 2));
  const knightRow = data.hasKnightRows;
  const sim = replay(plan, { frames: runFrames, sideb, spawnn, row: data.row, knightRow });

  const oFrames = oracleRows(data.draw, plan.C, plan.E);
  const sFrames = sim.rows;

  say(`\n  launch ${plan.index + 1}: G = f${plan.G} (board raised, attackchoice ${plan.acAtG}),`
    + ` C = f${plan.C} (G + 12${plan.seqConfirm ? `, confirmed by the seq's ${plan.seqConfirm} row` : ''}),`
    + ` window f${plan.C}..f${plan.E} (${plan.E - plan.C + 1} frames)`);
  say(`    clock ${vcTurnLength(data.row, { sideb })} at launch, soul + inv pinned from the trace every frame;`
    + ` RNG anchor n = ${spawnn} (seed ${ORACLE_SEED}); replayed through launchVCAttack(${data.rec.entry})`
    + ` sideb ${sideb}`);

  // ── the vocabulary ─────────────────────────────────────────────────────
  const oVoc = vocabulary(oFrames, (e) => e.object);
  const sVoc = vocabulary(sFrames, (e) => e.object);
  const names = [...new Set([...oVoc.keys(), ...sVoc.keys()])]
    .filter((n) => !only || n === only)
    .sort((a, b) => (oVoc.get(b)?.n ?? 0) - (oVoc.get(a)?.n ?? 0) || a.localeCompare(b));

  const vocabFindings = [];
  const unproven = [];
  const agreed = [];
  const asideHits = new Set();
  say('\n    VOCABULARY — the distinct values each side paints, per object and colour column');
  for (const name of names) {
    const o = oVoc.get(name);
    const s = sVoc.get(name);
    if (!o) {
      vocabFindings.push({ object: name, kind: 'sim-only object', detail: `${s.n} sim rows, none recorded` });
      say(`      ${name}: SIM ONLY — ${s.n} rows here, the recording has none`);
      continue;
    }
    if (!s) {
      vocabFindings.push({ object: name, kind: 'missing object', detail: `${o.n} recorded rows, none in the sim` });
      say(`      ${name}: MISSING — ${o.n} recorded rows, the sim makes none`);
      continue;
    }
    const bad = [];
    for (const c of VOCAB_COLS) {
      // A column this object never writes is not compared on either side.
      if (setAside(name, c)) { asideHits.add(`${name}.${c}`); continue; }
      const d = diffVocab(o.cols.get(c), s.cols.get(c));
      if (!d.missing.length && !d.invented.length) continue;
      bad.push({ col: c, ...d });
    }
    if (!bad.length) {
      agreed.push(`${name} (${o.n}/${s.n} rows)`);
      continue;
    }
    say(`      ${name}: ${o.n} recorded rows, ${s.n} sim rows`);
    for (const b of bad) {
      const why = b.col === 'image_blend' ? blendUnproven(name) : null;
      const f = { object: name, kind: 'vocabulary', col: b.col,
        missing: b.missing, invented: b.invented };
      if (why) unproven.push({ ...f, why }); else vocabFindings.push(f);
      const tag = why ? '  [UNPROVEN]' : '';
      if (b.missing.length) {
        say(`        ${b.col}  MOD PAINTS, SIM NEVER${tag}: `
          + b.missing.slice(0, 6).map(([v, n]) => `${show(v)} x${n}`).join(', ')
          + (b.missing.length > 6 ? ` (+${b.missing.length - 6} more)` : ''));
      }
      if (b.invented.length) {
        say(`        ${b.col}  SIM PAINTS, MOD NEVER${tag}: `
          + b.invented.slice(0, 6).map(([v, n]) => `${show(v)} x${n}`).join(', ')
          + (b.invented.length > 6 ? ` (+${b.invented.length - 6} more)` : ''));
      }
    }
  }
  if (agreed.length) say(`      AGREE on every colour column: ${agreed.join(', ')}`);
  if (asideHits.size) {
    say(`      SET ASIDE, the object never writes the column: ${[...asideHits].sort().join(', ')}`);
  }

  // ── the frame-exact diff ───────────────────────────────────────────────
  const exact = compareExact(oFrames, sFrames, { from: plan.C, to: plan.E, only });
  // A blend divergence on an object the dump shows never writing image_blend
  // is filed UNPROVEN and does NOT set the exit code — see the header.
  exact.findings = exact.findings.filter((f) => {
    const why = f.group === 'blend' ? blendUnproven(f.object) : null;
    if (why) unproven.push({ ...f, kind: 'frame-exact', why });
    return !why;
  });
  say(`\n    FRAME-EXACT — ${exact.stats.frames} frames, ${exact.stats.objects.size} objects,`
    + ` ${exact.stats.cells} cells compared, instances aligned by creation order`);
  if (!exact.findings.length) {
    say('      OK — every compared cell agrees');
  } else {
    const byObj = new Map();
    for (const f of exact.findings) {
      if (!byObj.has(f.object)) byObj.set(f.object, []);
      byObj.get(f.object).push(f);
    }
    for (const [name, fs] of byObj) {
      say(`      ${name}:`);
      for (const f of fs) {
        say(`        ${f.group.toUpperCase()} at frame ${f.frame}`
          + `${f.col === 'live' ? '' : ` instance #${f.slot}`}, column ${f.col}`);
        say(showExactContext(oFrames, sFrames, f, context));
      }
    }
  }

  // ── depth, reported ────────────────────────────────────────────────────
  const depth = depthReport(oFrames, sFrames, { from: plan.C, to: plan.E });
  if (!quiet && depth.size) {
    console.log('\n    DEPTH (reported, never enforced — oracle minus sim, per object)');
    for (const [name, m] of [...depth.entries()].sort()) {
      if (only && name !== only) continue;
      const es = [...m.entries()].sort((a, b) => b[1] - a[1]);
      const constant = es.length === 1;
      console.log(`      ${name}: ${es.map(([k, n]) => `${k} x${n}`).join(', ')}`
        + `  ${constant ? '(constant — the unmodelled object default)'
          : '(VARIES — a real depth write differs)'}`);
    }
  }

  if (!quiet && sim.dropped.size) {
    console.log(`\n    (sim also made ${[...sim.dropped].sort().join(', ')} — outside the`
      + " recorder's watch list, dropped on the sim side the way the patch drops them)");
  }

  if (unproven.length) {
    const byObj = new Map();
    for (const u of unproven) {
      if (!byObj.has(u.object)) byObj.set(u.object, u.why);
    }
    say('\n    NOT A COLOUR CLAIM YET — image_blend divergences on objects whose GML never'
      + ' writes image_blend. Reported, never counted:');
    for (const [name, why] of byObj) say(`      ${name} — ${why}`);
  }

  return { vocabFindings, unproven, asideHits, exact, depth, sim, oFrames, sFrames };
}

// ── the window of one locked launch ────────────────────────────────────────

/**
 * Everything the recording says about one locked launch: G (the board raise
 * whose frame already carries the row's ac), C = G + 12, and E (the turn's
 * hand-back, `turntimer < 0`, or the next raise, or the sheet's last frame).
 */
function planLaunches(data) {
  const t = data.trace;
  const by = new Map(t.rows.map((r) => [Number(r[t.col.frame]), r]));
  const last = Number(t.rows[t.rows.length - 1][t.col.frame]);
  const drawLast = Math.max(...data.draw.rows.map((r) => Number(r[data.draw.col.frame])));
  const raises = [];
  for (const [f, r] of by) {
    const p = by.get(f - 1);
    if (!p) continue;
    if (r[t.col.gt_x] === '' || p[t.col.gt_x] !== '') continue;
    if (Number(r[t.col.attackchoice]) !== data.row.ac) continue;
    raises.push(f);
  }
  raises.sort((a, b) => a - b);
  const seqFirst = (from) => {
    if (!data.seq) return null;
    const c = data.seq.col;
    const hit = data.seq.rows.find((r) => Number(r[c.frame]) >= from
      && r[c.kaizo_playing] === data.rec.entry && r[c.object] !== 'obj_afterimage');
    return hit ? `${hit[c.object]} @ f${hit[c.frame]}` : null;
  };
  return raises.map((G, index) => {
    const C = G + 12;
    let E = Math.min(last, drawLast);
    for (let f = C + 1; f <= E; f++) {
      const r = by.get(f);
      if (r && Number(r[t.col.turntimer]) < 0) { E = f; break; }
    }
    if (index + 1 < raises.length) E = Math.min(E, raises[index + 1] - 1);
    return {
      index, G, C, E,
      sheetLast: drawLast,
      acAtG: by.get(G)[t.col.attackchoice],
      seqConfirm: seqFirst(C),
      trace: { by, col: t.col },
    };
  });
}

// ── the sabotage ───────────────────────────────────────────────────────────

function cloneCsv(csv) { return { ...csv, rows: csv.rows.map((r) => r.slice()) }; }

function sabotage(data, plan, opts) {
  console.log('\n── SABOTAGE (copies of the sheet; then the sim driven at the wrong row) ──');
  let bad = 0;
  const c = data.draw.col;

  // THE BASELINE, from the untouched sheet. Two things need it: every case
  // below has to corrupt an object the comparison can actually SEE on both
  // sides (corrupting one the sim never makes proves nothing — the finding is
  // already 'missing object', with no column to land on), and case 5 has to
  // know which findings are already there before it claims to have caused one.
  const key = (f) => `${f.object}|${f.kind ?? f.group}|${f.col ?? '-'}`;
  const base = checkLaunch(data, plan, { ...opts, quiet: true });
  const namesIn = (frames) => {
    const s = new Set();
    for (const [, list] of frames) for (const e of list) s.add(e.object);
    return s;
  };
  const oNames = namesIn(base.oFrames);
  const sNames = namesIn(base.sFrames);
  const bothSides = new Set([...oNames].filter((n) => sNames.has(n)));
  const baseKeys = new Set([...base.vocabFindings, ...base.exact.findings].map(key));
  console.log(`  (baseline: ${bothSides.size} object(s) on both sides — ${[...bothSides].sort().join(', ')}`
    + `; ${baseKeys.size} finding(s) already there)`);

  const pickRow = (pred) => data.draw.rows.findIndex((r) => Number(r[c.frame]) >= plan.C
    && Number(r[c.frame]) <= plan.E && bothSides.has(r[c.object]) && pred(r));

  const run = (label, mutate, want) => {
    const copy = { ...data, draw: cloneCsv(data.draw) };
    mutate(copy);
    const res = checkLaunch(copy, plan, { ...opts, quiet: true });
    // DIFFERENTIAL, like case 5: the finding has to be one the UNTOUCHED sheet
    // does not already produce. `pickRow` already refuses an object that has a
    // baseline finding on the column, so this is the belt to that's braces.
    const hitV = res.vocabFindings.some((f) => want.vocab
      && f.object === want.object && f.col === want.vocab && !baseKeys.has(key(f)));
    const hitE = res.exact.findings.some((f) => f.object === want.object
      && (want.group === undefined || f.group === want.group) && !baseKeys.has(key(f)));
    const hit = want.vocab ? hitV : hitE;
    console.log(`  ${hit ? 'ok  ' : 'FAIL'} ${label}`);
    console.log(`         wanted a NEW ${want.vocab ? `vocabulary finding on ${want.object}.${want.vocab}`
      : `exact ${want.group} finding on ${want.object}`}; got `
      + `${res.vocabFindings.length} vocabulary + ${res.exact.findings.length} exact finding(s)`
      + ` against the baseline's ${baseKeys.size}`);
    if (!hit) bad += 1;
  };

  // A column the object ALREADY diverges on cannot host a sabotage case: the
  // finding would be there without the corruption. Nor can an object whose
  // population differs, because a population finding stops that object's
  // column comparison at the frame it fires.
  const baseVocab = new Set(base.vocabFindings.filter((f) => f.kind === 'vocabulary')
    .map((f) => `${f.object}|${f.col}`));
  const baseGroup = new Set(base.exact.findings.map((f) => `${f.object}|${f.group}`));
  const basePop = new Map(base.exact.findings.filter((f) => f.group === 'population')
    .map((f) => [f.object, f.frame]));
  const untouchedVocab = (obj, col) => !baseVocab.has(`${obj}|${col}`);
  const untouchedGroup = (obj, group, frame) => !baseGroup.has(`${obj}|${group}`)
    && !(basePop.has(obj) && basePop.get(obj) <= Number(frame));

  // 1. repaint one object's blend on every row it owns: the vocabulary must
  //    report a value the mod "paints" that the sim never does. The object has
  //    to be one whose blend is actually COMPARED — an object that never writes
  //    image_blend has that column set aside or filed UNPROVEN, so corrupting
  //    it would prove nothing (and would fail this case for the right reason).
  const blendIdx = pickRow((r) => r[c.object] !== 'obj_afterimage' && r[c.image_blend] !== ''
    && !setAside(r[c.object], 'image_blend') && !blendUnproven(r[c.object])
    && untouchedVocab(r[c.object], 'image_blend'));
  if (blendIdx >= 0) {
    const obj = data.draw.rows[blendIdx][c.object];
    run(`draw: every ${obj} image_blend + 1`, (copy) => {
      for (const r of copy.draw.rows) {
        if (r[c.object] === obj && r[c.image_blend] !== '') {
          r[c.image_blend] = String(Number(r[c.image_blend]) + 1);
        }
      }
    }, { object: obj, vocab: 'image_blend' });
  } else {
    console.log('  --   draw: no blend row inside the window; the blend case is moot');
  }

  // 2. rename one object's sprite everywhere: a MISSING sprite name.
  const sprIdx = pickRow((r) => r[c.object] !== 'obj_afterimage' && r[c.sprite_index] !== ''
    && untouchedVocab(r[c.object], 'sprite_index'));
  if (sprIdx >= 0) {
    const obj = data.draw.rows[sprIdx][c.object];
    run(`draw: every ${obj} sprite_index renamed`, (copy) => {
      for (const r of copy.draw.rows) {
        if (r[c.object] === obj && r[c.sprite_index] !== '') r[c.sprite_index] += '_SABOTAGE';
      }
    }, { object: obj, vocab: 'sprite_index' });
  } else {
    console.log('  --   draw: no sprite row inside the window; the sprite case is moot');
  }

  // 3. move ONE r cell: the frame-exact pass must see it even though the
  //    vocabulary pass may not (one row of one value).
  const rIdx = pickRow((r) => r[c.r] !== ''
    && untouchedGroup(r[c.object], 'colour fields', r[c.frame]));
  if (rIdx >= 0) {
    const obj = data.draw.rows[rIdx][c.object];
    const f = data.draw.rows[rIdx][c.frame];
    run(`draw: one ${obj} r cell at f${f} + 1`, (copy) => {
      copy.draw.rows[rIdx][c.r] = real(Number(copy.draw.rows[rIdx][c.r]) + 1);
    }, { object: obj, group: 'colour fields' });
  } else {
    console.log('  --   draw: no r/g/b row inside the window; the colour-field case is moot');
  }

  // 4. flip one `visible`.
  const vIdx = pickRow((r) => r[c.object] !== 'obj_afterimage' && r[c.visible] === '1'
    && untouchedGroup(r[c.object], 'visible', r[c.frame]));
  if (vIdx >= 0) {
    const obj = data.draw.rows[vIdx][c.object];
    const f = data.draw.rows[vIdx][c.frame];
    run(`draw: one ${obj} visible at f${f} flipped to 0`, (copy) => {
      copy.draw.rows[vIdx][c.visible] = '0';
    }, { object: obj, group: 'visible' });
  } else {
    console.log('  --   draw: no visible row inside the window; the visible case is moot');
  }

  // 5. THE SIM SIDE, DRIVEN AT THE WRONG ROW — and the claim is DIFFERENTIAL.
  //
  // This case used to flip `sideb` and ask whether ANY finding existed. That
  // was vacuous twice over: the check is red by design, so every un-sabotaged
  // run already has findings, and — measured 2026-09-10 — flipping the route
  // flag changes NOTHING any of these four A-Side windows can see, so the
  // "corruption" was not even a corruption. Both halves are fixed here: the
  // sim is launched on a DIFFERENT VC_TABLE entry (a different attack, on the
  // same sheet), and the case passes only on a finding the correct row does
  // NOT produce. The sideb flip is still run, and REPORTED, so the fact that
  // it is observably a no-op here stays on the record instead of masquerading
  // as coverage.
  {
    const wrong = RECORDINGS.map((r) => r.entry).filter((id) => id !== data.rec.entry)
      .map((id) => Object.values(VC_TABLE).flat().find((r) => r.id === id))
      .find((r) => r && r.ac !== data.row.ac);
    if (!wrong) {
      console.log('  --   sim: no other VC_TABLE row with a different ac; the wrong-row case is moot');
    } else {
      const res = checkLaunch({ ...data, row: wrong }, plan, { ...opts, quiet: true });
      const all = [...res.vocabFindings, ...res.exact.findings];
      const fresh = all.map(key).filter((k) => !baseKeys.has(k));
      const hit = fresh.length > 0;
      console.log(`  ${hit ? 'ok  ' : 'FAIL'} sim launched on ${wrong.id} (ac ${wrong.ac}) against`
        + ` a ${data.rec.entry} (ac ${data.row.ac}) recording`);
      console.log('         wanted a finding the correct row does NOT have; the correct row has'
        + ` ${baseKeys.size}, the wrong one ${all.length}, of which ${fresh.length} are new`
        + `${fresh.length ? `: ${fresh.slice(0, 4).join(', ')}${fresh.length > 4 ? ', …' : ''}` : ''}`);
      if (!hit) bad += 1;
    }

    const flip = checkLaunch(data, plan, { ...opts, sideb: !opts.sideb, quiet: true });
    const flipFresh = [...flip.vocabFindings, ...flip.exact.findings].map(key)
      .filter((k) => !baseKeys.has(k));
    console.log(`  --   reported: driving the sim sideb ${!opts.sideb} against this sideb`
      + ` ${opts.sideb} recording produces ${flipFresh.length} finding(s) the correct route does`
      + ` not — ${flipFresh.length ? 'the route flag is observable here' : 'the route flag is'
        + " NOT observable in this window, so it is no test of the differ's sensitivity"}`);
  }

  console.log(`  (untouched: ${basename(data.draw.path)}, ${statSync(data.draw.path).size} bytes)`);
  return bad;
}

// ── the audits: the two hand-written tables, held against their sources ────

/**
 * Everything this file CLAIMS about files that live outside it, re-derived on
 * every run where those files are on the machine. Both claims used to be
 * comments, and one of them (WATCHED "transcribed from `_names`") was wrong.
 * Returns the number of failures.
 */
function audits() {
  let bad = 0;

  // 1. WATCHED IS `_names`. Membership, both directions, plus the promise that
  //    UNION_BULLETS names things `_names` does NOT have.
  const names = patchNames();
  if (!names) {
    console.log('  --   audit: oracle_kaizo_fight.csx not on this machine — WATCHED is'
      + ' unverified transcription this run');
  } else {
    const extra = [...WATCHED].filter((n) => !names.has(n));
    const missing = [...names].filter((n) => !WATCHED.has(n));
    if (extra.length || missing.length) {
      console.log(`  FAIL audit: WATCHED is not the patch's _names (${names.size} names).`
        + `${extra.length ? ` Here but not in _names: ${extra.join(', ')}.` : ''}`
        + `${missing.length ? ` In _names but not here: ${missing.join(', ')}.` : ''}`);
      bad += 1;
    } else {
      console.log(`  ok   audit: WATCHED is exactly the recorder's _names (${names.size} names,`
        + ' re-read from oracle_kaizo_fight.csx)');
    }
    const wrong = [...UNION_BULLETS].filter((n) => names.has(n));
    if (wrong.length) {
      console.log(`  FAIL audit: ${wrong.join(', ')} IS in _names — UNION_BULLETS says it is not`);
      bad += 1;
    } else {
      console.log(`  ok   audit: UNION_BULLETS (${[...UNION_BULLETS].join(', ')}) is in no _names`
        + " entry — they reach the sheet through the Draw_75 patch's with (obj_collidebullet)");
    }
  }

  // 2. NEVER_WRITTEN and BLEND_FROM_CREATOR, against the dump.
  const w = blendWrites();
  if (w.absent) {
    console.log(`  --   audit: the kaizo GML dump is not on this machine (${w.dir}) — the`
      + ' never-written list is unverified this run, and no blend finding can be filed UNPROVEN');
    return bad;
  }
  console.log(`  ok   audit: read image_blend writes out of the dump — ${w.how.size} objects have`
    + ` one, ${w.unresolved.length} sites are a creator's with (<handle>) and are answered by`
    + ` BLEND_FROM_CREATOR (${[...BLEND_FROM_CREATOR.keys()].join(', ')})`);
  for (const key of NEVER_WRITTEN.keys()) {
    const [object, col] = [key.slice(0, key.lastIndexOf('.')), key.slice(key.lastIndexOf('.') + 1)];
    if (col !== 'image_blend') continue;
    if (w.how.has(object)) {
      console.log(`  FAIL audit: NEVER_WRITTEN says ${key}, but the dump writes it in`
        + ` ${w.how.get(object)} — the entry is stale and the column must go back to being compared`);
      bad += 1;
    } else if (BLEND_FROM_CREATOR.has(object)) {
      console.log(`  FAIL audit: ${object} is on BOTH never-written and blend-from-creator`);
      bad += 1;
    } else {
      console.log(`  ok   audit: ${key} — no image_blend write resolves to it anywhere in the dump`);
    }
  }
  for (const [object, why] of BLEND_FROM_CREATOR) {
    if (w.how.has(object)) {
      console.log(`  FAIL audit: BLEND_FROM_CREATOR lists ${object} as written only from a`
        + ` creator's scope, but the dump writes it in ${w.how.get(object)} — drop the entry`);
      bad += 1;
    } else if (!w.unresolved.some((s) => s.includes(why.split(':')[0]))) {
      console.log(`  FAIL audit: BLEND_FROM_CREATOR's ${object} cites ${why.split(':')[0]},`
        + ' which the dump scan does not report as an unresolved with-target site');
      bad += 1;
    } else {
      console.log(`  ok   audit: ${object} — no image_blend write resolves to it, and the`
        + ` creator site it names (${why.split(':')[0]}) is one of the scan's unresolved handles`);
    }
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
  const quiet = argv.includes('--quiet');
  const doSabotage = argv.includes('--sabotage');
  const only = flag('--only', null);
  const onlyObject = flag('--object', null);
  const context = Number(flag('--context', '3'));
  const frames = Number(flag('--frames', '900'));

  // THE AUDITS RUN FIRST, and they run even when no recording is on the
  // machine: they are claims about files that are not the recordings, and they
  // are the only content this check has on a machine with the research repo
  // but no lock. Their verdict rides BOTH exit paths, including --sabotage's.
  const auditBad = audits();

  const located = [];
  const looked = new Set();
  for (const rec of RECORDINGS) {
    if (only && rec.tag !== only) continue;
    const f = locate(rec);
    if (f) located.push(f);
    else for (const d of candidateDirs(rec)) looked.add(join(d, `kaizo_oracle_draw${rec.tag}.csv`));
  }
  if (!located.length) {
    console.log('SKIP check-colours-sheet: no draw-sheet lock recording found (SKIPPED)');
    for (const l of [...looked].sort()) console.log(`     looked for ${l}`);
    console.log('     Record one: knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1 -Mode 1'
      + ' -Lock <entry> -Frames 900 -DrawSheet 1 -Grazes 1 -Tag _cs_<entry>');
    console.log('     or point KAIZO_ORACLE_TRACES at the directory.');
    console.log('     NOTHING THE MOD PAINTS IS THEN HELD AGAINST THE MOD.');
    return auditBad ? 1 : 0;
  }

  // COUNTED SEPARATELY. `auditBad` is a failure of the INSTRUMENT — a watched
  // name the recorder never wrote, or a column an object never sets — and
  // folding it in here printed an instrument fault as a COLOUR DIVERGENCE and
  // let the divergence count exceed the number of launches. The exit code
  // still reflects both (see the returns below); only the reporting is
  // disentangled.
  let failures = 0;
  let launches = 0;
  let sabotageBad = 0;
  let sabotageRan = false;
  let unprovenTotal = 0;
  const asideSeen = new Set();

  for (const found of located) {
    const rec = found.rec;
    const row = Object.values(VC_TABLE).flat().find((r) => r.id === rec.entry);
    console.log(`\ncheck-colours-sheet: ${found.draw}`);
    console.log(`  ${rec.tag} — ${rec.what}`);
    if (!row) {
      console.log(`  FAIL: VC_TABLE has no ${rec.entry} row`);
      failures += 1;
      continue;
    }
    const draw = readCsv(found.draw);
    const data = {
      rec,
      row,
      draw,
      trace: readTrace(found.trace),
      seq: found.seq ? readCsv(found.seq) : null,
      hasKnightRows: draw.rows.some((r) => r[draw.col.object] === 'obj_knight_enemy'),
    };
    for (const need of ['frame', 'id', 'object', 'sprite_index', 'image_blend', 'depth', 'visible', 'r']) {
      if (draw.col[need] === undefined) {
        console.log(`  FAIL: the draw sheet has no "${need}" column (${draw.header.join(',')})`);
        failures += 1;
      }
    }
    console.log(`  ${draw.rows.length} draw rows, ${data.trace.rows.length} trace rows,`
      + ` seq ${data.seq ? `${data.seq.rows.length} rows` : 'ABSENT'};`
      + ` ${rec.entry} is ac ${row.ac} difficulty ${row.difficulty}`);
    if (!data.hasKnightRows) {
      console.log('  obj_knight_enemy: NOT ON THIS SHEET — the Draw_75 patch gained the knight'
        + ' AFTER these locks were taken, so the sim\'s knight is dropped too rather than'
        + ' reported as missing.');
    }

    const plans = planLaunches(data);
    if (!plans.length) {
      console.log(`  SKIP this recording: no board raise carries attackchoice ${row.ac}`
        + ' — the lock never launched the entry');
      continue;
    }
    console.log(`  ${plans.length} locked launch(es): ${plans.map((p) => `C=f${p.C}`).join(', ')}`);

    for (const plan of plans) {
      // A lock's LAST raise can fall inside the frame budget while its window
      // does not: the draw sheet drops the game to ~6 fps, so a 900-frame lock
      // ends mid-turn. Comparing zero frames and reporting the sim's own
      // entities as "SIM ONLY" would be a finding about the budget.
      if (plan.E <= plan.C) {
        console.log(`\n  launch ${plan.index + 1}: C = f${plan.C} — SKIPPED, the sheet ends at`
          + ` f${plan.sheetLast} (${plan.C - plan.sheetLast} frames before the launch's first`
          + ' drawn frame). Record more frames to reach it.');
        continue;
      }
      launches += 1;
      const opts = {
        sideb: rec.sideb, spawnn: 1 + plan.index, frames, context, quiet, only: onlyObject,
      };
      const res = checkLaunch(data, plan, opts);
      const n = res.vocabFindings.length + res.exact.findings.length;
      if (n) failures += 1;
      unprovenTotal += res.unproven.length;
      for (const k of res.asideHits) asideSeen.add(k);
      console.log(`\n  launch ${plan.index + 1}: ${n
        ? `${res.vocabFindings.length} vocabulary + ${res.exact.findings.length} frame-exact finding(s)`
        : 'every compared cell agrees'}`
        + (res.unproven.length ? `, and ${res.unproven.length} blend divergence(s) filed`
          + ' UNPROVEN (not counted)' : ''));
    }

    if (doSabotage && plans.length) {
      sabotageRan = true;
      sabotageBad += sabotage(data, plans[0], {
        sideb: rec.sideb, spawnn: 1, frames, context, only: onlyObject,
      });
    }
  }

  console.log('\nWHAT THIS COMPARED, AND WHAT IT DID NOT');
  console.log('  compared   per object, per frame: sprite_index, image_blend (packed BGR),');
  console.log('             visible, and the mod\'s own r / g / b / outline / coltimer, as EXACT');
  console.log('             TEXT, instances aligned by creation order — plus the VALUE SET each');
  console.log('             side paints for every one of those columns.');
  console.log('  NOT        pose (image_index / image_alpha / xscale / yscale / angle), depth');
  console.log('             (reported as a per-object offset), party HP, damage, the RNG stream');
  console.log('             beyond the per-launch anchor, sound, and the drawn PIXELS.');
  for (const [c, why] of SET_ASIDE_COLS) console.log(`  SET ASIDE  ${c} — ${why}`);
  for (const [n, why] of NO_EXACT) console.log(`  NO EXACT   ${n} — ${why}`);
  for (const [k, why] of NEVER_WRITTEN) {
    console.log(`  NEVER WRITTEN  ${k}${asideSeen.has(k) ? ' (hit this run)' : ''} — ${why}`);
  }
  if (unprovenTotal) {
    console.log(`  UNPROVEN   ${unprovenTotal} image_blend divergence(s) on objects with no`
      + ' resolvable image_blend write in the dump. NOT counted as colour divergences, and NOT'
      + ' to be written down as one until somebody reads the object\'s Draw event — this is'
      + ' the class of mistake the obj_knight_pointing_star entry above exists to retract.');
  }

  if (doSabotage) {
    if (!sabotageRan) {
      console.log('\n  sabotage: nothing to corrupt (no recording with a locked launch)');
      return auditBad ? 1 : 0;
    }
    console.log(`\n  sabotage: ${sabotageBad ? `${sabotageBad} case(s) NOT caught`
      : 'every case caught in its own group'}`);
    if (auditBad) console.log(`  sabotage: and ${auditBad} audit(s) FAILED`);
    return (sabotageBad || auditBad) ? 1 : 0;
  }
  console.log(`\ncheck-colours-sheet: ${launches} launch(es) over ${located.length} recording(s) — `
    + (failures ? `${failures} with a colour divergence` : 'every compared cell agrees'));
  return failures ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
