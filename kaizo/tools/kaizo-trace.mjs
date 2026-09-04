#!/usr/bin/env node
// THE SIM HALF OF THE KAIZO WHOLE-FIGHT DIFF.
//
//   node kaizo/tools/kaizo-trace.mjs --inputs /tmp/kaizo_oracle_inputs_deep.txt \
//        --version C --keep-alive --out /tmp/kaizo-sim --tag _deep
//
// Replays a REPLAY TOKEN through the V-C (or `--version D`, the B-Side) scene
// headlessly and writes THE SAME TWO FILES the kaizo oracle recorder produces,
// column for column and digit for digit, so a differ can compare them as exact
// text:
//
//   <out>kaizo_oracle_trace<tag>.csv     21 columns, one row per frame
//   <out>kaizo_oracle_bullets<tag>.csv   2 + slots*7 columns, one row per frame
//
// The oracle half already exists and already emits both
// (knight-research/kaizo-mod/tools/patches/oracle_kaizo_fight.csx). This file
// is the half that makes it comparable. It proves nothing on its own.
//
// ── WHAT THIS REPLACES, AND WHY THE OLD SHAPE COULD NOT WORK ──────────────
//
// This tool used to replay the scene with a SYNTHETIC input feed (`--input
// menu` alternates confirm while a menu waits; `--input pulse:N` presses every
// N frames) and write an ELEVEN-column row of its own naming
// (frame,soul_x,soul_y,inv,ac,turntimer,box_x,box_y,box_xscale,box_yscale,
// bullets). Neither half is usable against a recording:
//
//   * A SYNTHETIC FEED CANNOT MATCH A RECORDING. The two sides "pulse confirm"
//     and the two pulses land on different frames the moment anything about
//     the menu differs, so the fight forks at the first turn boundary and
//     every later divergence is that fork's shadow.
//   * THE COLUMN NAMES ARE NOT THE RECORDER'S. `box_x` is `gt_x`, `ac` is
//     `attackchoice`, and eight of the recorder's columns had no sim column at
//     all. A differ that compares headers as sets fails on all of them; one
//     that compares by position silently compares the wrong quantities.
//
// Both modes survive: `--input` still works for a quick self-consistency run
// with no token to hand, and `--narrow` still writes the old eleven columns.
// THE DEFAULT IS THE WIDE PAIR, because that is the shape a recording has.
//
// ── THE ROW CONTRACT — FIXED, TRANSCRIBED, NOT NEGOTIATED ─────────────────
//
// Both files' shapes are the recorder's, read out of the patch that writes
// them rather than agreed in prose. Line numbers are oracle_kaizo_fight.csx.
//
// FILE 1, 21 columns (patch line 490):
//
//   frame,soul_x,soul_y,inv,attackchoice,turntimer,gt_x,gt_y,gt_xs,gt_ys,
//   bullets,spawns,kaizo_atk,kaizo_playing,phase,phaseturn,phase4turn,
//   difficulty,mnfight,rtimer,monsterhp
//
// FILE 2, 2 + 32*7 columns (patch line ~525):
//
//   frame,live,b0_x,b0_y,b0_a,b0_xs,b0_ys,b0_dir,b0_spd, ... b31_spd
//
//   Every live obj_collidebullet SORTED BY INSTANCE ID (= creation order) in
//   32 fixed slots. Here that is every entity with `isBullet` except
//   obj_heart, sorted by `seq` — the sim's own creation counter, and the same
//   population `instance_number(obj_collidebullet)` counts (the soul is
//   `isBullet` in this engine and is not an obj_collidebullet in the game).
//   The vanilla whole-fight diff runs on exactly that correspondence over
//   ~12,000 frames on six recordings, which is what makes it citable here.
//
//   AN ABSENT SLOT WRITES SEVEN EMPTY CELLS, NEVER ZEROS. A bullet at the
//   origin and no bullet are different states, and collapsing them is how a
//   differ reports motion that never happened. `live` carries the true count,
//   so an attack with more than `--slots` simultaneous bullets is visibly
//   truncated rather than silently — the _bsplitter probe peaks at 109.
//
// PRECISION, ONE RULE. Every measured real is GML `string_format(v, 0, 10)` on
// the oracle side and `real()` from sim/trace.js here. NEVER bare
// `toFixed(10)`: GML rounds an exact tie to EVEN and toFixed rounds away from
// zero, so identical bits print differently (CLAUDE.md, "Trace format" —
// caught at t6-splitter f133). `frame`, `bullets`, `spawns` and `live` print
// BARE, because the patch writes those four with `string()` on an integer.
//
// ABSENCE. No soul is TWO empty cells, no box is FOUR, an absent bullet slot
// is SEVEN — the patch writes `,,` / `,,,,` / `,,,,,,,`. An empty cell
// compares like any other cell. A NON-FINITE value is not absence and is
// never smuggled in as one (see `cell`).
//
// ── WHERE EACH COLUMN COMES FROM, INCLUDING THE ONES THAT WILL DIVERGE ────
//
// A column that is fabricated diffs green against nothing and hides the
// divergence next to it, so every one of the 21 is named here with its source
// and its status. REAL means a quantity the sim actually carries; MODELLED
// means a mirror of the game's own rule driven by the sim's own transitions,
// with the rule cited.
//
//   frame          REAL   the pre-step counter (see the loop)
//   soul_x/y       REAL   state.soul, two empty cells when there is none
//   inv            REAL   state.invTimer. UNCLAMPED on both sides — sim/soul.js
//                         says so in as many words ("it goes negative and stays
//                         there between hits. Do not 'fix' this to a floor of
//                         zero"), and the recording runs -1, -2, -3 … from the
//                         soul's first frame, so the two agree by construction.
//   attackchoice   REAL   the selection latch, from the table row (see below)
//   turntimer      REAL   state.turntimer
//   gt_*           REAL   obj_growtangle, four empty cells when there is none
//   bullets        REAL   the live obj_collidebullet population
//   spawns         MODELLED — an INSTRUMENT counter, see WATCHED_OBJECTS.
//                         EXPECTED TO DIVERGE: it counts the Knight's rainbow
//                         afterimage trail and obj_marker, populations this sim
//                         does not claim to reproduce instance for instance.
//                         `--spawns empty` blanks it.
//   kaizo_atk      MODELLED — the mod's kaizo_attack pointer (see naturalNext),
//   kaizo_playing         mirrored from the nextAttack chain and CROSS-CHECKED
//                         against the director's own advance at every turn end
//                         and against the launch ledger at every flip.
//   phase          REAL   state.knightPhase, the knight's own `phase`
//   phaseturn      REAL, AND EXPECTED TO DIVERGE — say so rather than hide it.
//                         The sim drives `state.phaseturn` off the table row
//                         (kaizo-practice.js:1393-1397, the VANILLA selector's
//                         counter). The MOD'S knight never moves its own:
//                         measured over all 13,001 rows of
//                         kaizo_oracle_trace_deep.csv, `phaseturn` is
//                         0.0000000000 on EVERY ONE — kaizo dispatches through
//                         kaizo_setAttack and Other_10's `phaseturn++` is never
//                         reached. So this column will differ on most rows of
//                         any diff, for a bookkeeping reason and not a
//                         behavioural one. Emitting a constant 0 to make it
//                         green would be exactly the fabrication this comment
//                         block exists to refuse; the fix belongs either in the
//                         differ (declare it non-comparable, the way
//                         verify-fullfight declares `menu` COARSE) or in
//                         kaizo-practice.js, and neither is this file.
//   phase4turn     REAL   state.kaizo.vars.phase4turn — found in the dump, not
//                         guessed: the mod sets it through the phase-4 nodes'
//                         own attackSetVar (Other_24 lines 278/288/298/308) and
//                         vcHooks' onSelect applies every setVars pair. Its
//                         pre-selection value is the mod's Create default
//                         (Create_0:72). 0 on every row of every MODE 0
//                         recording, because the gate is pinned shut.
//   difficulty     REAL   latched with attackchoice from the same table row
//   mnfight        MODELLED, COARSE — a three-state machine, every transition a
//                         line of GML the sim already cites (see below)
//   rtimer         MODELLED — a mirror of the game's own counter (see below)
//   monsterhp      REAL   state.knight.hp, pinned like the recorder pins it
//
// ── THE CLAIM THIS CAN EARN, STATED BEFORE IT IS EARNED ───────────────────
//
// "MECHANICS ONE-TO-ONE, RNG RE-ANCHORED PER ATTACK LAUNCH." The vanilla
// wording, and it is this file's too, for the same measured reason: matching
// the game's continuous RNG stream is impossible (CLAUDE.md, "LIVE RNG IS
// RE-ANCHORED PER ATTACK LAUNCH" — random-pitch snd_play_x calls and other
// engine noise no sim should model put one roll thousands of draws from the
// sim's position). Both sides therefore reseed `seed + n * 1000` at
// `scr_bulletspawner`, the one gate every knight attack passes through.
//
// CHECKED, NOT ASSUMED, FOR KAIZO: kaizo/scenes/kaizo-mod-launcher.js's
// `reanchorRng` (line 168) does the same arithmetic —
// `gmlCreate((state.seed + state.spawnn * 1000) >>> 0)` — and
// `spawnControllerByType` calls it once per controller spawn (line 214), so a
// chained dispatch like ac 102 (type 106 then type 108) advances `spawnn`
// twice, exactly as two `scr_bulletspawner` calls would. The oracle patch must
// reseed the same way at the same site or the claim is not available at all.
//
// ── THE INPUT, AND WHY IT IS THE WHOLE PROBLEM ────────────────────────────
//
// Both sides must run the SAME per-frame inputs. There are two ways in and
// they are the same stream at different points in its life:
//
//   --inputs PATH   the `oracle_inputs.txt` the PATCHED GAME ITSELF READ
//                   (patch line 504) — seed on line 1, frame count on line 2,
//                   one integer bitmask per frame after that:
//                     1 left  2 right  4 up  8 down
//                     16 button2_h (SLOW)   32 button1 (confirm, _h and _p)
//                     64 button2_p (CANCEL — same key as 16, different job)
//                     128 button3 (both _h and _p)
//                   PREFER THIS. It is the identical bytes on both sides, so
//                   nothing can drift between the token and what the game was
//                   given. The recorder writes it beside the recording, and
//                   kaizo/tools/verify-kaizo-fullfight.mjs refuses to call a
//                   recording whole-fight evidence without it.
//
//   --token PATH    the replay token those inputs were generated from
//                   (tools/token-to-inputs.mjs writes the file above from it).
//                   Use it when the recording carries `<TAG>.token` instead.
//
// Either way the SEED COMES FROM THE FEED, not from `--seed`. The patch's own
// comment on line 1 of the inputs file is explicit — "the token and the seed
// are one artifact, and a recording made at a different seed from the sim run
// is not comparable to it" — so this tool takes the feed's seed and says on
// stderr when a `--seed` was overridden.
//
// A FILE, NEVER argv. Tokens are ~53 KB and the Windows command line truncates
// long before that (tools/regen-fullfight.mjs records what that cost), so both
// flags take a PATH and the file's contents are read, trimmed and decoded.
//
// THE HELD/EDGE DISTINCTION IS THE TRAP, and the sim's replay path already
// handles it — VERIFIED HERE RATHER THAN ASSUMED, by reading the two sites:
//
//   * sim/replay.js stores HELD state per frame (`packInput` ORs a bit for
//     every button that is down), so a decoded token feeds levels, not edges.
//   * sim/index.js:404 keeps `state.prevInput = state.input` at the end of
//     every frame, and sim/menu.js:470-474 derives `edges[k] = down &&
//     !menu.held[k]` from a held map seeded from `prevInput` at openMenu
//     (menu.js:31-33). So `button1_p()` is reproduced as a real 0->1 edge and
//     a HELD confirm is one press, not one press per frame.
//
// That is the failure verify-fullfight's degeneracy guard exists for: a
// recording whose token holds confirm runs ONE turn and flatlines, and a
// differ reports "exact through frame 21", which is true and useless. The
// degeneracy refusal below is the same guard on this side.
//
// ── THE FRAME EPOCHS DO NOT LINE UP TODAY, AND THAT IS NOT A BUG HERE ─────
//
// Measured, not feared. The oracle recorder sets `global.mnfight = 1` in the
// tester's Create (patch line 246) to dodge the rtimer crash that opening at
// mnfight 2 causes, and its 120 boot frames elapse before row 0 — so in
// `kaizo_oracle_trace_deep.csv` frame 0 is already `mnfight 2, rtimer 1,
// attackchoice 1`, the FIRST FRAME OF THE KNIGHT'S OPENING BULLET PHASE. The
// recording's first `mnfight 0` row is frame 259.
//
// The sim's kaizo scene opens with the PARTY MENU. So sim frame 0 and oracle
// frame 0 describe different moments of the fight, and a differ that joins on
// the frame column compares across that gap. Nothing in THIS file can fix it:
// the fix is either the recorder starting at `mnfight = 0` or the differ
// detecting the offset the way verify-fullfight's `reportDraw` does ("THE
// FRAME OFFSET IS DETECTED, NOT ASSUMED"). It is reported, loudly, rather than
// papered over with a `--frame-offset` flag — a constant offset baked in here
// would hide the difference between a fixed epoch skew and a drifting one,
// which is the whole reason that vanilla code detects instead of hardcoding.
//
// ── PROVING THE PAIR WITH NO ORACLE ───────────────────────────────────────
//
// There is no kaizo whole-fight recording yet, and a differ that has never
// been shown a divergence might report none by construction. Both directions,
// both files, ACROSS SEPARATE NODE PROCESSES:
//
//   # same feed twice -> byte-identical
//   for n in 1 2; do node kaizo/tools/kaizo-trace.mjs \
//       --inputs /tmp/kaizo_oracle_inputs_deep.txt --keep-alive \
//       --tag _deep --out /tmp/p$n; done
//   node kaizo/tools/diff-kaizo-trace.mjs \
//       /tmp/p1/kaizo_oracle_trace_deep.csv /tmp/p2/kaizo_oracle_trace_deep.csv
//   node kaizo/tools/diff-kaizo-trace.mjs \
//       /tmp/p1/kaizo_oracle_bullets_deep.csv /tmp/p2/kaizo_oracle_bullets_deep.csv
//
//   # a different feed (different inputs, or a different seed) -> MUST diverge
//   node kaizo/tools/kaizo-trace.mjs --token /tmp/other.token --keep-alive \
//       --tag _deep --out /tmp/pB
//   node kaizo/tools/diff-kaizo-trace.mjs \
//       /tmp/p1/kaizo_oracle_trace_deep.csv /tmp/pB/kaizo_oracle_trace_deep.csv
//
// MEASURED 2026-08-29 — V-C, 17,000 frames, `--keep-alive`, 35 launches: all
// 27 ordinary entries and eight more round the loop, back into phase 2:
//
//   same feed, two processes   trace   BYTE-IDENTICAL,  4,368,154 bytes
//                              bullets BYTE-IDENTICAL, 16,004,852 bytes
//                              (md5 1c389494… / c3c85070… on both runs)
//   --inputs vs --token        BYTE-IDENTICAL — the two entry points are the
//                              same feed, and this is what proves it
//   different INPUTS, same seed  trace   16,888 / 17,000 rows differ, first
//                                        at row 112
//                                bullets 13,990 / 17,000, first at row 158
//   same inputs, seed 54321      trace   16,891 / 17,000, first at row 109
//                                bullets 11,488 / 17,000, first at row 155
//
// THE CHAIN THAT RUN WALKED matches ORACLE-GROUND-TRUTH.md's recorded table
// entry for entry, in order, INCLUDING THE LOOP: atk_Multislash3 (phase 3's
// last) hands to atk_Quickslash, phase 2's SECOND row — which is what VC_LOOP
// claims and what the `_deep` recording measured. The
// `chain:` line on stderr prints it so a run can be held against that table by
// eye.
//
// AND THE MIRROR IS SABOTAGE-TESTED, because an assertion that has never
// failed is an assertion that might be unable to. Changing `naturalNext`'s
// phase-3 branch from VC_LOOP to `{ phase: 3, turn: 0 }` — the VANILLA rule,
// and the single most plausible way to get this wrong — makes the run report
// "the mirrored nextAttack chain disagreed with the director's own advance 1
// time(s). first at frame 13464: pointer 'atk_Starstorm3', director moved to
// 'atk_Quickslash'." It fires on the first wrap and names both sides. Note
// that a 13,000-frame run never reaches the wrap and the sabotage passes
// silently there: the check is only as good as the run is long, which is
// itself a reason to prefer the whole recording over a window.
//
// AND ONE MORE, WORTH MORE THAN ALL OF THEM. Held against the REAL recording
// `kaizo_oracle_trace_deep.csv` — which was made with the patch's own
// `oracle_frame % 15` pulse, NOT this token, so the two fights part as soon as
// the input matters — 110 of the first 200 oracle rows agree on all fifteen
// core columns (soul, board, bullets, attackchoice, difficulty, both pointer
// columns, phase, phase4turn, rtimer, monsterhp) at a constant offset of 127
// frames, digit for digit at ten decimals. The first core divergence is
// `bullets` 17 vs 16, inside Starstorm1's bullet phase — a question about the
// attack, which is exactly the kind of question this pair exists to ask, and
// not about the row format. The 127 is the epoch skew described above.

import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { gmlIrandom } from '../../sim/rng.js';
import { dirname, basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { real } from '../../sim/trace.js';
import { createState, stepFrame } from '../../sim/index.js';
import { scrRevive, PARTY } from '../../sim/damage.js';
import { decodeReplay, unpackInput } from '../../sim/replay.js';
import { buildKaizoScene, KAIZO_VERSIONS } from '../scenes/kaizo-fight.js';
import { VC_LOOP, VC_PHASE4_DEFAULT, VC_KNIGHT } from '../versions/vc-script.js';

// ── COLUMNS ────────────────────────────────────────────────────────────────

/** The recorder's 21, in the recorder's order (oracle_kaizo_fight.csx:490). */
export const KAIZO_TRACE_COLUMNS = [
  'frame',
  'soul_x', 'soul_y',
  'inv',
  'attackchoice',
  'turntimer',
  'gt_x', 'gt_y', 'gt_xs', 'gt_ys',
  'bullets',
  'spawns',
  'kaizo_atk', 'kaizo_playing',
  'phase', 'phaseturn', 'phase4turn',
  'difficulty',
  'mnfight',
  'rtimer',
  'monsterhp',
];

/**
 * The OLD eleven, kept behind `--narrow` so the short self-consistency runs
 * that already reference them keep working. Not comparable to any recording.
 */
export const KAIZO_NARROW_COLUMNS = [
  'frame',
  'soul_x', 'soul_y',
  'inv',
  'ac',
  'turntimer',
  'box_x', 'box_y', 'box_xscale', 'box_yscale',
  'bullets',
];

/** The per-frame bullet header for N slots — the recorder's own loop. */
export function bulletColumns(slots) {
  const cols = ['frame', 'live'];
  for (let i = 0; i < slots; i++) {
    cols.push(`b${i}_x`, `b${i}_y`, `b${i}_a`, `b${i}_xs`, `b${i}_ys`,
      `b${i}_dir`, `b${i}_spd`);
  }
  return cols;
}

/** The recorder's default, and the vanilla whole-fight recorder's before it. */
export const DEFAULT_SLOTS = 32;

/**
 * A measured real, or an empty cell when the thing being measured is absent.
 *
 * Absence is a legitimate state for several of these columns — no soul between
 * turns, no box on the charge-up turn, an empty bullet slot — and the oracle
 * writes it the same way. An empty cell compares like any other.
 *
 * A non-finite value is NOT absence and must never be smuggled in as one: NaN
 * in a position is a real fault, and printing it as "" would erase it. So it
 * is passed through as the literal text, which can never match the oracle and
 * therefore fails loudly at the frame it appeared.
 */
export function cell(v) {
  if (v === undefined || v === null) return '';
  if (!Number.isFinite(v)) return String(v);
  return real(v);
}

/**
 * THE PATCH'S OWN "no knight" SENTINEL. Every instance-scoped column defaults
 * to -99 in the recorder (`var _ac = -99;` and friends, patch line ~545) and
 * is written through string_format like any other real, so it prints
 * "-99.0000000000". Reproduced exactly rather than left empty: an empty cell
 * and a -99 are different text and the differ compares text.
 */
const NO_KNIGHT = -99;

// ── THE INSTRUMENT'S WATCH LIST ───────────────────────────────────────────
//
// `spawns` is a CUMULATIVE COUNT of newly-seen instances of these objects —
// the recorder's own `global.oracle_spawns`, incremented once per instance the
// first frame it is seen (patch line ~690). It is an INSTRUMENT counter, not a
// game quantity, so reproducing it means reproducing the instrument: the same
// name list, the same "first frame this instance is alive" rule.
//
// TRANSCRIBED FROM THE PATCH, all 64 names in its order, so a divergence in
// this column is a divergence in the sim's POPULATION and not in the list.
//
// SAY WHAT IT COSTS. Two of these dominate everything else and neither is a
// dodge-relevant object: `obj_afterimage` is the Knight's rainbow trail
// (kaizo-specific, `rgbafterimages = 1` unconditionally) and reaches 3,734
// instances in ONE Tunnel1 turn, and `obj_marker` is DELTARUNE's generic
// one-shot sprite stamp used all over the game. So this column measures how
// much the fight DRAWS at least as much as what it throws at you, and it is
// the likeliest column in the row to diverge first while being the least
// causal. It is emitted anyway, and honestly, because a fabricated or blank
// value would diff green against nothing and hide the divergence next to it —
// `--spawns empty` blanks it for a run where that is wanted.
export const WATCHED_OBJECTS = [
  'obj_bullet_knight_crescentGenerator',
  'obj_bullet_knight_slash',
  'obj_bullet_knight_stream',
  'obj_bullet_knight_tunnelslash',
  'obj_bullet_knightcrescent',
  'obj_dknight_slasher',
  'obj_knight_bullethell1',
  'obj_knight_bullethell2',
  'obj_knight_bullethell_bullet',
  'obj_knight_bullethell_bullet2',
  'obj_knight_bullethell_bullet_bounce',
  'obj_knight_circle',
  'obj_knight_combinations',
  'obj_knight_crescentslash_slashinganimation',
  'obj_knight_crush',
  'obj_knight_diamondswordbullet_ext',
  'obj_knight_lightorb',
  'obj_knight_pointing_cone',
  'obj_knight_pointing_star',
  'obj_knight_pointing_starchild',
  'obj_knight_ring',
  'obj_knight_roaring2',
  'obj_knight_roaring_fx',
  'obj_knight_roaring_star',
  'obj_knight_rotating_slash',
  'obj_knight_slasher',
  'obj_knight_spark',
  'obj_knight_split_growtangle',
  'obj_knight_split_growtangle_backup',
  'obj_knight_split_growtangle_effect',
  'obj_knight_split_growtangle_vertical',
  'obj_knight_stream',
  'obj_knight_streamline',
  'obj_knight_swordfall',
  'obj_knight_swordtunnelanim',
  'obj_knight_triangle',
  'obj_knight_tunnel_slasher',
  'obj_knight_tunnel_slasher_2_revised',
  'obj_knight_warp',
  'obj_knight_weird_bottom_manager',
  'obj_knight_weird_circle',
  'obj_knight_weird_circle_bullet',
  'obj_roaringknight_boxsplitter_attack',
  'obj_roaringknight_fountain_bullet',
  'obj_roaringknight_fountain_bullet_old',
  'obj_roaringknight_quickslash',
  'obj_roaringknight_quickslash_afterimage',
  'obj_roaringknight_quickslash_attack',
  'obj_roaringknight_quickslash_big',
  'obj_roaringknight_slash',
  'obj_roaringknight_split_bullet',
  'obj_roaringknight_splitslash',
  'obj_tracking_swords_manager',
  'obj_tracking_sword1',
  'obj_diagonal_bullet_manager',
  'obj_diagonal_bullet',
  'obj_sword_tunnel_manager',
  'obj_sword_vortex_manager',
  'obj_fallingsword',
  'obj_fake_gt',
  'obj_marker',
  'obj_regularbullet',
  'obj_afterimage',
  'obj_afterimage_fade_to_white',
];
const WATCHED = new Set(WATCHED_OBJECTS);

// ── INPUT FEEDS ───────────────────────────────────────────────────────────

const IDLE = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

/**
 * THE TOKEN FEED — the only feed a diff against a recording can use.
 *
 * `decodeReplay` returns `inputAt(f)`, the HELD state for frame f, which is
 * exactly what `stepFrame` consumes and exactly what token-to-inputs.mjs packs
 * into `oracle_inputs.txt`. Past the token's end it returns idle, so a
 * `--frames` larger than the token is a defined (and warned-about) run rather
 * than a crash.
 */
function tokenInput(replay) {
  return (_state, f) => replay.inputAt(f);
}

/**
 * THE SYNC POINT — the two sides do not start the fight at the same moment.
 *
 * The oracle's frame 0 is ALREADY the first bullet phase: the tester room opens
 * at `mnfight = 1` (enemy talk), walks itself to 2, and the recording's first
 * launch lands at frame 11. The sim's frame 0 is its OPENING PARTY MENU, and
 * its first launch lands at frame 99. Measured skew: 88 frames.
 *
 * Both sides index the SAME input table by their own frame counter, so without
 * a sync the oracle spends the sim's menu-navigation inputs on dodging and the
 * two are not playing the same fight. It is not an offset a differ can shift
 * away — it changes which input reaches which game state.
 *
 * FIXING IT ON THE ORACLE SIDE WAS TRIED AND FAILED. `KAIZO_ORACLE_START=0`
 * opens the tester at the player menu on paper; in practice the battle never
 * starts at all (0 entries played, `rtimer` never assigned, a 13,002-row
 * recording of nothing). The note is in oracle_kaizo_fight.csx so nobody
 * retries it.
 *
 * So the sim leads in. For `f < sync` it walks its own opening with SYNTHETIC
 * input, consuming NO token; from `f === sync` it starts the feed at index 0.
 * The oracle's own `oracle_t0` is exactly this idea applied to the other half.
 *
 * The lead-in is deliberately the menu-gated feed and not idle: the sim's
 * opening menu does not advance without a confirm, and an idle lead-in would
 * park there forever and never reach the sync point at all.
 */
function syncedTokenInput(replay, sync, leadIn) {
  return (state, f) => (f < sync ? leadIn(state, f) : replay.inputAt(f - sync));
}

/**
 * The frame an oracle recording first launched an attack — the row where
 * `kaizo_playing` first carries an entry.
 *
 * This is READ FROM THE RECORDING rather than hardcoded, because it is a
 * property of how that particular capture opened, not a constant. A recording
 * made with a different `-Start`, a different room, or a future recorder would
 * have its own, and a baked 11 would silently mis-sync it.
 */
export function oracleFirstLaunchFrame(path) {
  const lines = readFileSync(path, 'utf8').replace(/\r/g, '').trim().split('\n');
  const header = lines[0].split(',');
  const iPlaying = header.indexOf('kaizo_playing');
  const iFrame = header.indexOf('frame');
  if (iPlaying < 0 || iFrame < 0) {
    throw new Error(`${path} has no kaizo_playing/frame column — it predates the`
      + ' column that names the entry actually on screen, and cannot be synced');
  }
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    if (cells[iPlaying]) return Number(cells[iFrame]);
  }
  throw new Error(`${path} never launched an attack — nothing to sync to`);
}

/**
 * THE INPUTS FILE — the bytes the patched game itself read.
 *
 * `oracle_inputs.txt` as tools/token-to-inputs.mjs writes it and as the patch
 * parses it (oracle_kaizo_fight.csx:504): seed, frame count, then one integer
 * bitmask per frame. The bit layout is sim/replay.js's `BITS`, so `unpackInput`
 * is the decoder both sides already agree on — no second table to drift.
 *
 * IT VALIDATES THE DECLARED LENGTH, the way decodeReplay does. A file whose
 * header says 12000 frames and carries 11997 masks is a truncated write (the
 * recorder's `file_text_*` writes are BUFFERED — CLAUDE.md), and running it
 * anyway would silently idle the tail and report the divergence as a fight
 * that ended early.
 */
function readInputsFile(path) {
  const lines = readFileSync(path, 'utf8').replace(/\r/g, '').trim().split('\n');
  if (lines.length < 3) {
    throw new Error(`${path} has ${lines.length} line(s); expected seed, frame count, then one mask per frame`);
  }
  const seed = Number(lines[0]);
  const declared = Number(lines[1]);
  if (!Number.isInteger(seed)) throw new Error(`${path} line 1 is not an integer seed ("${lines[0]}")`);
  if (!Number.isInteger(declared) || declared < 1) {
    throw new Error(`${path} line 2 is not a positive frame count ("${lines[1]}")`);
  }
  const masks = lines.slice(2).map((l, i) => {
    const n = Number(l);
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      throw new Error(`${path} line ${i + 3} is not a 0..255 bitmask ("${l}")`);
    }
    return n;
  });
  if (masks.length !== declared) {
    throw new Error(`${path} declares ${declared} frames and carries ${masks.length} mask(s)`
      + ' — a truncated or over-long feed is not the feed the game was given');
  }
  const table = masks.map(unpackInput);
  const idle = unpackInput(0);
  return {
    seed,
    frames: table.length,
    inputAt: (f) => table[f] ?? idle,
  };
}

/**
 * THE MENU-GATED PULSE — the pattern kaizo/tools/checks/* already use, kept
 * for self-consistency runs with no token to hand.
 *
 * Confirm alternates on/off, but ONLY while something is waiting on it. The
 * alternation is what matters: `button1_p()` is edge-triggered, so a HELD
 * confirm is one press forever and the party menu never completes a second
 * time.
 *
 * NOT COMPARABLE TO A RECORDING. The gate reads `state.menu.open`, and nothing
 * on the game side opens and closes on the same frames unless the same token
 * drove both. Use `--token`.
 */
function menuGatedInput() {
  let pulse = false;
  return (state) => {
    if (!state.menu?.open && !state.dialogue?.text && !state.pendingAct) return IDLE;
    pulse = !pulse;
    return { ...IDLE, confirm: pulse };
  };
}

/**
 * THE FRAME-INDEXED PULSE — what oracle_knight_fight.csx does:
 *
 *     function button1_p() { if ((global.oracle_frame % 15) == 0) return 1; ... }
 *
 * A pure function of the frame number, so it IS reproducible on the game side
 * with no shared state. Still not a recording: it presses nothing else, ever.
 */
function pulseInput(period) {
  return (state, f) => ((f % period === 0) ? { ...IDLE, confirm: true } : IDLE);
}

/** Nothing pressed — what a MODE 1 attack-lock recording runs. */
function idleInput() {
  return () => IDLE;
}

// ── THE PARTY, AND WHAT PINNING IT COSTS ──────────────────────────────────

/**
 * KEEP-ALIVE, ROSTER-AWARE — and the reason it is not `state.keepAlive`.
 *
 * sim/index.js's built-in keep-alive calls `freshParty()`, which is the
 * VANILLA trio's max HP, and revives all three slots. On V-D that is wrong
 * twice over: the Weird Route party is Kris + Noelle with their own maxhp, and
 * slot 2 is the empty slot buildKaizoScene deliberately marks dead so the
 * vanilla-shaped consumers stop targeting it. Reviving it puts a third
 * character back in the fight.
 *
 * THE COST, stated plainly: with HP pinned, the turn order and the phase gate
 * are decided by the SCHEDULE and the clock, never by a wipe. That is what
 * makes a long trace comparable at all — a scripted input does not dodge — but
 * it means this run cannot answer any question about survival, targeting, or a
 * swooned character's effect on the menu. The oracle recorder pins the party
 * the same way, so the two sides agree; neither is evidence about HP.
 *
 * No traced column reads party HP, so the refill runs AFTER the row is
 * composed. (The vanilla whole-fight tool has to refill inside the step
 * because its row carries hp0/hp1/hp2.)
 */
/**
 * KEEP-ALIVE, AND THE `revive` HALF IS A HARNESS ASYMMETRY.
 *
 * The RECORDER does exactly one thing (oracle_kaizo_fight.csx:438-439 and
 * 623-627):
 *
 *     for (var _i = 1; _i < 5; _i++)
 *         global.hp[_i] = global.maxhp[_i];
 *
 * It never calls `scr_revive`. CLAUDE.md's "Restoring HP does not stand anyone
 * up" is the whole point: being down is FIVE globals — `charmove`,
 * `charcantarget`, `chardead`, `charaction`, `charspecial` — and topping HP up
 * clears none of them. A character felled inside a frame, before the tester's
 * Step re-pins, stays down at full health for the rest of the recording.
 *
 * This side used to call `scrRevive` on every slot every frame, standing
 * everyone back up. That is not a small difference: it decides how many
 * characters are eligible for the ATTACK BAR, and the measured consequence was
 * the sim's bar carrying THREE bolts where the recording carries ONE, with the
 * extra bolt flight making every sim turn ~24 frames longer — 12% over the
 * fight, on 28 of 28 turns. It read as a turn-length defect in the recreation
 * and it was the harness.
 *
 * `mode` is a flag rather than a silent change because the two behaviours are
 * not interchangeable and the difference is worth being able to measure:
 *   'pin'    — HP only, matching the recorder. THE DEFAULT for a diff.
 *   'revive' — HP and stand everyone up. What this did before.
 *
 * The sim can represent the difference at all only because `sim/damage.js` grew
 * a real `chardead` (`isUp` reads it, not the HP sign); when CLAUDE.md's
 * down-state note was written it could not, which is why reviving was the only
 * option then.
 */
function makeKeepAlive(state, mode = 'pin') {
  const maxhp = state.partyMaxhp ?? PARTY.map((p) => p.maxhp);
  const slots = maxhp.length;
  return () => {
    for (let i = 0; i < slots; i++) {
      state.partyHp[i] = maxhp[i];
      if (mode === 'revive') scrRevive(state, i);
    }
    state.gameOver = false;
  };
}

// ── SCENE ACCESSORS ───────────────────────────────────────────────────────

/** The live battle box, or null — the oracle's `obj_growtangle`. */
function findBox(state) {
  // A CLOSED BOX IS A DESTROYED BOX. The game's obj_growtangle self-destructs
  // when its close finishes (`timer <= 0 && growcon == 3` -> instance_destroy;
  // CLAUDE.md "THE CUSTOM ARENA"), and is CREATED FRESH at the next turn's
  // mnfight-1.5 tick. The sim keeps ONE persistent instance instead and parks
  // it at `growcon = 4` when the close finishes (sim/battlebox.js:225) — that
  // is the documented vanilla model ("a persistent sim box must re-arm it").
  // growcon 4 therefore MEANS "destroyed", and reporting it as a box at scale
  // 0 put `148,170,0,0` in every menu frame where the recording has no box at
  // all. Measured on _tok3: the box is GONE on f672 and back on f780, the
  // first bullets frame, with mnfight 1.5 and the birth inside the same frame.
  return state.entities.find(
    (e) => e.alive && e.type?.name === 'obj_growtangle' && e.growcon !== 4,
  ) ?? null;
}

/** The turn director, or null. */
function findDirector(state) {
  return state.entities.find((e) => e.alive && e.type?.name === 'fight_director') ?? null;
}

/** The knight entity, or null — the oracle's `obj_knight_enemy`. */
function findKnight(state) {
  return state.entities.find((e) => e.alive && e.type?.name === 'obj_knight_enemy') ?? null;
}

/**
 * Live bullets in CREATION ORDER, the population the recorder walks with
 * `with (obj_collidebullet)` and then `ds_list_sort(_bl, true)` on instance
 * id. `seq` is this engine's monotonic spawn counter (sim/entity.js), so
 * sorting by it is the same ordering by construction.
 */
function liveBullets(state) {
  return state.entities
    .filter((e) => e.alive && e.isBullet && e.type?.name !== 'obj_heart')
    .sort((a, b) => a.seq - b.seq);
}

// ── THE SCHEDULE POINTER ──────────────────────────────────────────────────

/**
 * `kaizo_attack`'s natural successor — the mod's `kaizo_AT.nextAttack`.
 *
 * MIRRORED FROM THE MOD, AND CROSS-CHECKED EVERY TURN. The generated table
 * (kaizo/versions/vc-script.js) does not carry a `nextAttack` field because
 * gen-vc-script.mjs WALKED that chain to build the phase arrays — the array
 * order IS the chain — so the successor is:
 *
 *     not the last row of its phase  ->  the next row
 *     last row of phase 3            ->  VC_LOOP (phase 2's Quickslash)
 *     last row of phase 4            ->  "AfterFinal" -> kaizo_resumeAT
 *     last row of phase 1 or 2       ->  the next phase's first row
 *
 * which is exactly the natural branch of kaizo-vc-hooks.js's `advance`
 * (lines 160-175). It is duplicated here rather than called because `advance`
 * is a state MUTATOR — it writes `vars.resume`, sets `state.battlemsg` and
 * decides the phase-4 gate — and running it out of band to read one string
 * would change the fight the trace is describing.
 *
 * A DUPLICATE IS A LIABILITY UNLESS SOMETHING PROVES IT AGREES. So the trace
 * ASSERTS it: at every turn end, the pointer this function produced must equal
 * the id of the row the director's own `advance` actually moved to (when the
 * HP gate did not fire), and every mismatch is counted, named and reported.
 * That is the positive assertion CLAUDE.md requires of a new mechanism — a
 * mirror nothing checks is the `state.pinnedShuffle` failure with a new name.
 */
function naturalNext(table, phase, turn, resume) {
  const list = table[phase];
  const last = turn === list.length - 1;
  if (phase === 4 && last) return resume ?? { phase: 3, turn: 0 };
  if (!last) return { phase, turn: turn + 1 };
  if (phase === 3) return { phase: VC_LOOP.phase, turn: VC_LOOP.turn };
  return { phase: phase + 1, turn: 0 };
}

/** The row id at a table position, or '' for a table without ids (version A). */
function rowId(table, phase, turn) {
  return table?.[phase]?.[turn]?.id ?? '';
}

// ── WHERE THE TWO FILES GO ────────────────────────────────────────────────

/**
 * Resolve `--out` into the trace path and the bullets path beside it.
 *
 * THREE FORMS, because kaizo/tools/verify-kaizo-fullfight.mjs already accepts
 * three sim naming conventions (its `simPaths`) and a producer that emits only
 * one of them is a gate that fails with "not found" for a naming reason:
 *
 *   --out DIR/  or an existing DIRECTORY
 *       -> DIR/kaizo_oracle_trace<TAG>.csv + DIR/kaizo_oracle_bullets<TAG>.csv
 *          the recorder's own basenames. Point KAIZO_SIM_OUT at DIR.
 *
 *   --out .../kaizo_sim_trace<TAG>.csv        (any basename containing "trace")
 *       -> that file, and "trace" -> "bullets" in the basename beside it.
 *
 *   --out .../anything<TAG>.csv               (no "trace" in the basename)
 *       -> that file, and "<...>.bullets.csv" beside it.
 *
 *   --out PREFIX (no .csv, no trailing separator, not a directory)
 *       -> PREFIXkaizo_oracle_trace<TAG>.csv + PREFIXkaizo_oracle_bullets<TAG>.csv
 *
 * A DIRECTORY IS DETECTED, NOT ASSUMED — `--out /tmp/kaizo-fullfight` with
 * that directory present would otherwise produce
 * `/tmp/kaizo-fullfightkaizo_oracle_trace.csv`, which is a file nobody looks
 * for and a diff that never runs.
 */
export function outPaths(out, tag) {
  const isDir = /[\\/]$/.test(out)
    || (existsSync(out) && statSync(out).isDirectory());
  if (isDir) {
    return {
      trace: join(out, `kaizo_oracle_trace${tag}.csv`),
      bullets: join(out, `kaizo_oracle_bullets${tag}.csv`),
    };
  }
  if (/\.csv$/i.test(out)) {
    const dir = dirname(out);
    const base = basename(out);
    const bullets = base.includes('trace')
      ? base.replace('trace', 'bullets')
      : base.replace(/\.csv$/i, '.bullets.csv');
    return { trace: out, bullets: join(dir, bullets) };
  }
  return {
    trace: `${out}kaizo_oracle_trace${tag}.csv`,
    bullets: `${out}kaizo_oracle_bullets${tag}.csv`,
  };
}

// ── THE RUN ───────────────────────────────────────────────────────────────

/**
 * Run the scene and return { header, rows, bulletHeader, bulletRows, stats }.
 *
 * Exported so a verifier can call it directly instead of shelling out and
 * parsing files.
 */
export function traceKaizo({
  shuffleOrder = null,   // the recording's slash order (kaizo/tools/derive-shuffle.mjs)
  cameraLog = null,      // per-frame view + shake count, to pair with the recorder's
  keepAliveMode = 'pin',
  version = 'C',
  seed = 12345,
  frames = 1800,
  slots = DEFAULT_SLOTS,
  keepAlive = false,
  pinMonsterhp = true,
  spawnsMode = 'count',
  input = menuGatedInput(),
  boltSchedules = null,
  boltSkipBeforeFrame = 0,
  grazeRows = null,
  // THE DRAW PROBE, emulated. The recorder's KAIZO_ORACLE_DRAWPROBE=a-b draws
  // irandom(360) twice at the end of every frame in a..b (oracle frames), after
  // its trace row; a sim run that follows such a recording draws the same here,
  // after its own row. `drawLog` writes `simFrame,oracleFrame,draws,spawnn` per
  // frame so kaizo/tools/probe-diff.mjs can compare cumulative draws per anchor.
  drawProbe = null,
  drawLog = null,
} = {}) {
  if (!KAIZO_VERSIONS[version]) {
    throw new Error(`unknown kaizo version ${version} (have ${Object.keys(KAIZO_VERSIONS).join(', ')})`);
  }

  const state = createState({ seed, traceBulletSlots: 0 });
  buildKaizoScene(state, { version });
  // The recording was made under the recorder talk stall-guard (see the note at
  // the reply site in kaizo-practice.js). Every _tok* recording so far has it,
  // so the tracer emulates it unconditionally; a recording made with
  // KAIZO_ORACLE_TALKSKIP=0 will need this keyed off its receipt.
  state.recorderTalkSkip = true;
  // THE GRAZE FEED IS KEYED BY SIM FRAME. The recording's frame 0 is the token's
  // frame 0, which lands at sim frame `sync` (boltSkipBeforeFrame); every
  // replayed pairing moves by that much, or none of them would ever match.
  if (grazeRows) {
    const byFrame = new Map();
    for (const r of grazeRows) {
      const f = r.fight + boltSkipBeforeFrame;
      if (!byFrame.has(f)) byFrame.set(f, []);
      byFrame.get(f).push({ ...r, used: false });
    }
    state.grazeReplay = byFrame;
    // WHERE THE TABLE STOPS. Past this the engine uses its own geometric graze
    // pass instead of pairing against rows that do not exist — see the note in
    // sim/tension.js stepGraze. _tok3's feed was recorded as _tok4 and its run
    // was cut off by the wall-clock budget, so it covers f10868 and no further.
    state.grazeReplayLast = Math.max(...byFrame.keys());
  }
  if (shuffleOrder) {
    // THE SLASH ORDER, REPLAYED. The burn still happens in the module; this
    // only decides which of the fan's angles goes first, which the bullets
    // sheet compares and the unsolved ds_list_shuffle permutation cannot
    // supply. Same posture as the vanilla lane's --shuffle.
    const entries = [];
    for (const line of shuffleOrder.split(/\r?\n/)) {
      const [f, a] = line.split(',').map(Number);
      if (Number.isFinite(f) && Number.isFinite(a)) entries.push({ frame: f, angle: a });
    }
    state.slashOrder = { entries, at: 0, hits: 0, misses: 0 };
    console.log(`  shuffle: replaying ${entries.length} recorded slash angle(s)`);
  }

  // THE MENU PHASE'S LENGTH IS THE BOLT SCHEDULE AND NOTHING ELSE, so a
  // whole-fight comparison that does not replay it is comparing turn
  // boundaries the sim was never given the inputs to reach. See
  // kaizo/tools/decode-bolts.mjs for the measurement and the decode; the
  // schedule is choose() off the game's live stream, thousands of draws from
  // any anchor, so it cannot be translated into agreement -- only replayed.
  // This mirrors tools/fullfight-trace.mjs's --bolts, which the vanilla
  // whole-fight diff has depended on since it was byte-exact.
  if (boltSchedules) {
    // DEEP-CLONE PER RUN, and this is not defensive tidying -- sharing the
    // table is what made --bolts hang.
    //
    // A bolt is `{ char, frame, alive, red }` and the fight bar MUTATES it:
    // `alive` goes false as each bolt is scored or missed. `--sync auto` runs
    // traceKaizo TWICE against the same parsed table (PASS ONE derives the
    // offset, then the real run), so pass one handed the main run a table whose
    // bolts were already dead. `attacked[i]` latches only when character i's
    // last LIVE bolt is gone, and a bolt that was never alive never gets there:
    // the menu never ended, the run sat in mnfight 0 for 12722 frames and
    // produced ONE launch. The degeneracy guard caught it, which is the only
    // reason this did not read as an attack bug.
    // WHERE THE TABLE STARTS. Bar 0 of the recording is its FIRST TURN; the
    // sim's synthetic lead-in raises a bar before that which the recording
    // never had. Consuming from frame 0 therefore feeds every turn the
    // previous turn's schedule. `sync` is exactly where the token -- and so
    // the comparable fight -- begins, so that is where the table begins.
    state.boltSkipBeforeFrame = boltSkipBeforeFrame;
    state.boltSchedules = boltSchedules.map(
      (bar) => bar.map((b) => ({ ...b, alive: true, red: false })),
    );
    state.boltIndex = 0;
  }

  const refill = keepAlive ? makeKeepAlive(state, keepAliveMode) : null;
  const table = state.kaizo.table;
  const hasIds = !!rowId(table, 1, 0);

  const rows = [];
  const bulletRows = [];

  // ── THE LATCHES ─────────────────────────────────────────────────────────
  //
  // `attackchoice` and `difficulty` are SELECTION-ANCHORED. The oracle reads
  // `obj_knight_enemy.myattackchoice` / `.difficulty`, which the mod's
  // `kaizo_setAttack` assigns during the knight's `mnfight == 1.5` setup and
  // which then PERSIST — through the bullet phase, through the gap, through
  // the whole next party menu — until the next selection overwrites them.
  //
  // So these are not "the attack that is running". They are latches, updated
  // where the sim's director runs its own selector block (kaizo-practice.js
  // sets `e.clockOn = true` on that tick, twelve frames of rtimer before the
  // launch) and held everywhere else. Reading them off the launch ledger
  // instead would lag the game by that spawn window at EVERY turn boundary and
  // look like a fault in turn timing.
  //
  // Before the first selection both read 0, which is what the mod's own
  // obj_knight_enemy Create assigns (`myattackchoice = 0`, Create_0:32), so
  // the opening rows agree by construction rather than by luck.
  //
  // THE DIFFICULTY LATCH TAKES THE TABLE ROW, NOT `knight.difficulty`. The
  // launcher writes `knight.difficulty` with the RESOLVED value, which for a
  // not-yet-translated branch is an approximation it ledgers in
  // state.kaizo.approx (kaizo-mod-launcher.js resolveDifficulty). That is a
  // different quantity from what the mod's selector assigned, and emitting it
  // would report a ledgered approximation as a divergence in the schedule.
  let ac = 0;
  let difficulty = 0;

  // ── THE POINTER PAIR ────────────────────────────────────────────────────
  //
  // `kaizo_atk` is the NEXT entry and `kaizo_playing` is the one that just
  // fired — the mod's `kaizo_attack` and `kaizo_prevatk`. Both flip on ONE
  // line pair inside the rtimer-12 branch (Step_0:526-537):
  //
  //     kaizo_prevatk = kaizo_attack;
  //     kaizo_attack  = kaizo_AT.nextAttack;     // "AfterFinal" -> resumeAT
  //
  // MEASURED IN THE RECORDING, not inferred: `kaizo_oracle_trace_deep.csv`
  // frame 11 is the single frame where rtimer reaches 12, turntimer jumps to
  // 239 (the armed 240, minus the battle controller's own decrement in the
  // same frame), `kaizo_atk` goes atk_Starstorm1 -> atk_CrescentSlash and
  // `kaizo_playing` goes '' -> atk_Starstorm1. One frame, all four facts.
  //
  // THE SIM'S ARM FRAME IS THAT FRAME. kaizo-practice.js arms the clock at
  // `e.spawnDelay === 1` and launches on the NEXT frame, and its own comment
  // says why: "rtimer hits 12 during the knight's Step and scr_turntimer
  // floors the clock right there — one frame before this director's launch".
  // The sim reaches turntimer 239 on that arm frame too (probed at f138 for a
  // 240 attack), so the pointer flips there and not at the ledger's launch.
  //
  // The ledger is still used — as the CHECK. Every flip must be followed, one
  // frame later, by exactly one new `state.kaizo.launched` entry naming the
  // same table row. A flip with no launch behind it is a phantom turn.
  let pointer = hasIds ? rowId(table, 1, 0) : '';
  let playing = '';
  // The game's `attacked == 0` — the flip happens ONCE per bullet phase, not
  // on every frame rtimer sits at its ceiling. Cleared when the bullet phase
  // ends, which is the same event that zeroes rtimer. Guarding on "the id
  // changed" instead would fail silently the first time the chain ever put the
  // same entry twice in a row, which is a property of the mod's table and not
  // something this file should depend on.
  let flippedThisTurn = false;
  let pendingLaunch = null;   // { atFrame, id, phase, turn } awaiting the ledger

  // ── THE MODELLED COLUMNS ────────────────────────────────────────────────
  //
  // `rtimer` — A MODELLED MIRROR OF THE GAME'S OWN RULE, driven by the sim's
  // own transitions. The game's is:
  //
  //     if (scr_isphase("bullets") && attacked == 0 && ecv == 0) {
  //         rtimer += 1;
  //         if (rtimer == 12) { ...spawn... }
  //
  // plus `rtimer = 0` at the bottom of the enemy-talk block, once per turn.
  // The sim has no `rtimer`: it counts DOWN in `e.spawnDelay`, which is reset
  // to 12 at turn end and then sits there through the whole party menu — so
  // `12 - spawnDelay` would read 0 during the menu and 1 the moment the menu
  // ended, one frame before the game's counter starts. Counting up off
  // `clockOn` (set on the selector tick, cleared at turn end) reproduces the
  // game's shape exactly: 1 on the selector frame, 12 on the arm frame,
  // clamped at 12 for the rest of the turn, 0 between turns.
  //
  // CHECKED AGAINST THE RECORDING: _deep frames 0-11 read rtimer 1..12 with
  // the launch at 12, and the sim's selector-to-arm span is the same twelve
  // frames (probe: selector f127, arm f138).
  let rtimer = 0;
  let lastTalkEntries = 0;

  // `mnfight` — A MODELLED THREE-STATE MACHINE, and every transition is a
  // line of GML the sim already cites:
  //
  //   0 -> 1   obj_attackpress's Draw sets `global.mnfight = 1` when the bar
  //            finishes, in the same breath that starts its 13-frame fade.
  //            kaizo-practice.js does exactly that: `e.bar.fade = true;
  //            e.fadingBar = e.bar; e.bar = null;` — so the frame `fadingBar`
  //            appears IS the frame the game assigns mnfight 1.
  //   1 -> 2   the knight's mnfight 1.5 -> 2 transition, which is the same
  //            tick that sets `e.clockOn`.
  //   2 -> 0   `scr_mnendturn()` at turn end: `mnfight = 0`.
  //
  // IT NEVER EMITS 1.5, AND NEITHER DOES THE RECORDING: mnfight goes 1 -> 1.5
  // -> 2 inside a single Step and obj_time's Draw runs after it, so 1.5 is
  // unobservable. Measured over all 13,001 rows of _deep the column takes
  // exactly three values — 0 (2,969 rows), 1 (336) and 2 (9,696) — which is
  // this vocabulary and no more. That is a COARSE column in verify-fullfight's
  // sense: it verifies WHICH PHASE the fight is in, not the exact sub-state.
  let mnfight = 0;
  let sawFadingBar = false;

  // `spawns` — the instrument counter. Keyed by `seq`, which is unique and
  // monotonic and is never reused, so "first frame this instance was alive"
  // is the same rule as the recorder's ds_map of instance ids.
  const seenSeq = new Set();
  let spawns = 0;

  const stats = {
    frames: 0, launches: 0, acValues: new Set(), difficulties: new Set(),
    bulletFrames: 0, maxLive: 0, truncFrames: 0,
    soulFrames: 0, boxFrames: 0, gameOverFrames: 0, multiBoxFrames: 0,
    noKnightFrames: 0, spawns: 0, mnfightHist: new Map(),
    pointerFlips: 0, pointerMismatch: 0, ledgerMismatch: 0, gateTrips: 0,
    firstPointerMismatch: null, firstLedgerMismatch: null,
    // `frame:id` per flip. PRINTED, not merely collected: a stat nothing reads
    // is the `state.pinnedShuffle` failure, and this one is the fastest way to
    // hold a run against ORACLE-GROUND-TRUTH.md's chain table by eye.
    chain: [],
  };

  let prevPhase = null;
  let prevTurn = null;
  // The ledger's high-water mark, kept separate from `stats.launches` (which
  // is the FINAL count, written after the loop) so the two cannot be confused
  // for each other by a later edit.
  let seenLaunches = 0;

  // THE DISPATCH FRAME'S PROBE LANDS ON THE FRESH ANCHOR. The knight reseeds
  // on the dispatch frame and the recorder's end-of-frame probe (--drawprobe)
  // draws its four u32 on that new stream, BEFORE the next frame's manager
  // Creates; this lane launches one frame later, so without this hook every
  // roll of the turn would read the stream four positions early (measured:
  // _drawprobe2 Splitter 1, the game's first slash vertical + second diagonal
  // against the sim's horizontal + straight, identical counts throughout).
  // The launcher calls it after the LAST reseed of a launch; keyed to the
  // recorder, installed only with --drawprobe.
  let curF = -1;
  if (drawProbe) {
    state.kaizo ??= {};
    state.kaizo.hooks ??= {};
    state.kaizo.hooks.afterLaunchReseed = (st) => {
      const of = curF - 1 - boltSkipBeforeFrame;   // the dispatch frame, oracle-numbered
      if (of >= drawProbe[0] && of <= drawProbe[1] && st.gmlRng) {
        gmlIrandom(st.gmlRng, 360);
        gmlIrandom(st.gmlRng, 360);
      }
    };
  }
  for (let f = 0; f < frames; f++) {
    curF = f;
    // THE ROW IS LABELLED WITH THE PRE-STEP COUNTER.
    //
    // stepFrame pushes its own row and THEN does `state.frame += 1`, so row N
    // describes frame N. Reading state.frame after the call would number every
    // row one too high, and a differ that joins on the frame column would then
    // compare the sim's frame N against the oracle's frame N — different
    // moments — and report it as everything downstream being one frame behind.
    // fullfight-trace.mjs hit exactly this.
    const label = state.frame;
    // THE KNIGHT IS CREATED AT THE FIGHT'S START, NOT AT SCENE BUILD. His bob is
    // y = ystart + cos(siner2 / 8) * 8 and siner2 ticks once per frame he is
    // drawn (obj_knight_enemy Draw_0:1-4; an invisible instance draws nothing,
    // so the warp-out windows hold it). The recording reads siner2 == 1 at its
    // frame 0 and 558 at f792 with one held window, f12-246. The sim matched
    // the held window to the frame (sim f140-374) and still read 686 there --
    // 128 high, the synthetic lead-in the token does not cover. Rebase at the
    // sync frame, so the count starts where the encounter does. Measured by
    // the probe (kaizo_oracle_probe: k_siner2, k_y), not inferred; the
    // swordfall manager spawns at the knight's y and every knight-anchored
    // successor (rotating_step) with it.
    if (boltSkipBeforeFrame > 0 && f === boltSkipBeforeFrame) {
      const kn = findKnight(state);
      if (kn) kn.siner2 = 0;
    }
    if (process.env.KAIZO_TRAP) { // DEBUG: arm the rng draw-site logger for sim frames a-b
      const [ta, tb] = process.env.KAIZO_TRAP.split('-').map(Number);
      if (f === 0) globalThis.__pass = (globalThis.__pass ?? 0) + 1;
      globalThis.__simFrame = globalThis.__pass + ":" + f;
      globalThis.__trap = f >= ta && f <= tb;
    }
    stepFrame(state, input(state, f));
    if (drawProbe) {
      const of = f - boltSkipBeforeFrame;
      if (of >= drawProbe[0] && of <= drawProbe[1] && state.gmlRng) {
        gmlIrandom(state.gmlRng, 360);
        gmlIrandom(state.gmlRng, 360);
      }
    }
    if (drawLog) drawLog.push(`${f},${f - boltSkipBeforeFrame},${state.gmlRng?.draws ?? 0},${state.spawnn ?? 0}`);
    // THE CAMERA, to pair with KAIZO_ORACLE_CAMERA=1. Every wall cull is
    // written against the view, so a shake the sim misses or holds moves a
    // destroy boundary and changes the live bullet count -- and shows up in
    // no other column. Written at the same point as the trace row.
    if (cameraLog) {
      const shakes = state.entities.filter((x) => x.alive && x.type?.name === 'obj_shake').length;
      cameraLog.push(`${f - boltSkipBeforeFrame},${real(state.view.x)},${real(state.view.y)},${shakes}`);
    }
    if (process.env.KAIZO_WATCH && globalThis.__trap) { // DEBUG: watch a type's position
      for (const w of state.entities) if (w.alive && w.type?.name === process.env.KAIZO_WATCH) console.error(`WATCH p=${globalThis.__pass} f=${f} ${w.type.name} ` + (process.env.KAIZO_WATCH_FIELDS ?? 'x,y,slash,timer,active,grazed').split(',').map((k) => `${k}=${w[k]}`).join(' ') + ` alive=${state.entities.filter((z) => z.alive && z.type?.name === (process.env.KAIZO_WATCH_COUNT ?? '')).length}`);
    }
    if (process.env.KAIZO_TRAP) { // DEBUG: launch timeline
      const L = state.kaizo?.launched ?? [];
      if (L.length !== (globalThis.__nL ?? 0)) { const r = L[L.length - 1] ?? { name: "(reset)", ac: -1, difficulty: -1, phase: -1, turn: -1 }; console.error(`LAUNCH p=${globalThis.__pass} f=${f} #${L.length} ${r.name} ac=${r.ac} d=${r.difficulty} phase=${r.phase} turn=${r.turn} spawnn=${state.spawnn}`); globalThis.__nL = L.length; }
    }

    // PIN THE KNIGHT'S HP BEFORE THE ROW IS COMPOSED, because the recorder
    // does: `global.monsterhp[0] = global.monstermaxhp[0]` runs in the
    // tester's Step, which is BEFORE obj_time's Draw writes the row. Refilling
    // after the row would show every hit's drop that the oracle never records.
    //
    // AND SAY WHAT IT COSTS, because this is the exact trap CLAUDE.md names
    // under "Never pin a value the game uses to sequence itself": the mod's
    // phase-4 gate is `monsterhp <= maxhp * 0.6`, so pinning it makes PHASE 4
    // UNREACHABLE BY CONSTRUCTION. The recorder accepts that (it is why the
    // four phase-4 entries needed MODE 1 attack-locks), and this side must
    // accept the same or the two fights are not the same fight.
    if (pinMonsterhp && state.knight) state.knight.hp = VC_KNIGHT.maxhp;

    // Values are read AFTER the step, which is the same instant stepFrame
    // composes its own row: reap() has run, nothing but the frame counter
    // moves after it.
    const soul = state.soul && state.soul.alive ? state.soul : null;
    const box = findBox(state);
    const dir = findDirector(state);
    const knight = findKnight(state);
    const vars = state.kaizo?.vars ?? {};

    // ── the selection latches ───────────────────────────────────────────
    if (dir?.clockOn) {
      const row = table?.[dir.phase]?.[dir.turn];
      if (row && typeof row.ac === 'number') ac = row.ac;
      if (row && typeof row.difficulty === 'number') difficulty = row.difficulty;
    }

    // ── rtimer, then the pointer flip it gates ──────────────────────────
    // rtimer IS THREE STATES, NOT A BOOLEAN OF THE CLOCK. From the mod
    // (kaizo obj_knight_enemy Step_0):
    //
    //     enemytalk entry  rtimer = 0                     (:354)
    //     bullets, unlaunched  rtimer += 1; if (rtimer == 12) launch   (:498-501)
    //     everything else  untouched — it HOLDS at 12 after the launch,
    //                      through the party phase and the first talk frame
    //
    // Measured on _tok3 across a turn boundary: f640-671 mn=2 rt=12,
    // f672-778 mn=0 rt=12, f779 mn=1 rt=12, f780 mn=2 rt=1 ... f791 rt=12.
    // The old derivation zeroed it the moment the clock went off, so every
    // menu frame read 0 against the recording's 12 — the gate's first
    // divergence at f672 since the kaizo lane began. The reset now follows
    // the director's talk-entry counter, which is the transcription of the
    // branch the GML resets it in.
    if (dir && (dir.talkEntries ?? 0) !== lastTalkEntries) {
      rtimer = 0;
      lastTalkEntries = dir.talkEntries ?? 0;
    }
    if (dir?.clockOn) {
      if (rtimer < 12) rtimer += 1;
    } else {
      flippedThisTurn = false;
    }

    // THE FLIP IS THE COUNT REACHING 12, NOT THE VALUE BEING 12. rtimer now
    // HOLDS at 12 through the whole party phase (the mod does), so without the
    // clock term this fired on the first menu frame of every turn — a phantom
    // flip per turn, 34 launches against the recording's 33, and every turn
    // boundary wrong. The GML increments and tests inside one block gated on
    // scr_isphase("bullets") && attacked == 0; this is that gate.
    if (hasIds && dir && dir.clockOn && rtimer === 12 && !flippedThisTurn) {
      // The rtimer-12 frame. Flip both, exactly as Step_0:526-537 does.
      flippedThisTurn = true;
      playing = pointer;
      const nx = naturalNext(table, dir.phase, dir.turn, vars.resume);
      pointer = rowId(table, nx.phase, nx.turn);
      stats.pointerFlips += 1;
      pendingLaunch = {
        atFrame: label, id: playing, phase: dir.phase, turn: dir.turn,
      };
      stats.chain.push(`${label}:${playing}`);
    }

    // THE LEDGER IS THE CHECK. `state.kaizo.launched` grows on the director's
    // launch frame, which is the frame after the arm. A flip that no launch
    // follows is a phantom turn — the MODE 1 failure ORACLE-GROUND-TRUTH.md
    // records, where inferring launches from the pointer invented five turns
    // that never happened.
    // A LAUNCH WITH NO FLIP BEHIND IT is the other half of the same check, and
    // it is the half a "did every flip get a launch?" test cannot see. On a
    // table with row ids every launch passes through rtimer 12, so an extra one
    // means the director launched outside the path this column models.
    if (hasIds && state.kaizo.launched.length > seenLaunches && !pendingLaunch) {
      stats.ledgerMismatch += 1;
      stats.firstLedgerMismatch ??= {
        frame: label, flip: null,
        ledger: state.kaizo.launched[state.kaizo.launched.length - 1],
        why: 'a launch with no pointer flip before it',
      };
      seenLaunches = state.kaizo.launched.length;
    }

    if (pendingLaunch) {
      if (state.kaizo.launched.length > seenLaunches) {
        const led = state.kaizo.launched[state.kaizo.launched.length - 1];
        if (led.phase !== pendingLaunch.phase || led.turn !== pendingLaunch.turn) {
          stats.ledgerMismatch += 1;
          stats.firstLedgerMismatch ??= {
            frame: label, flip: pendingLaunch, ledger: led, why: 'named a different row',
          };
        }
        seenLaunches = state.kaizo.launched.length;
        pendingLaunch = null;
      } else if (label - pendingLaunch.atFrame > 4) {
        // A PHANTOM. The director launches on the frame after the arm, so four
        // frames is already generous. Timing out matters as much as detecting
        // it: an unresolved pendingLaunch left in place would make every later
        // flip look resolved by the NEXT turn's launch, turning one fault into
        // a silent one-turn shift for the rest of the run.
        stats.ledgerMismatch += 1;
        stats.firstLedgerMismatch ??= {
          frame: label, flip: pendingLaunch, ledger: null,
          why: 'no launch followed it',
        };
        pendingLaunch = null;
      }
    }

    // ── the turn-end cross-check, and the phase-4 gate ──────────────────
    if (dir && (dir.phase !== prevPhase || dir.turn !== prevTurn)) {
      if (hasIds && prevPhase !== null) {
        if (dir.phase === 4 && prevPhase !== 4) {
          // THE GATE, Step_0:569-576: `kaizo_prevatk = kaizo_attack;
          // kaizo_attack = kaizo_phase4;`. The pointer jumps to the live
          // kaizo_phase4 node and prevatk takes the value the pointer HAD —
          // which is not the entry that fired, and is what the mod does.
          // Unreachable while --pin-monsterhp holds the gate shut.
          playing = pointer;
          pointer = rowId(table, 4,
            Math.max(0, table[4].findIndex(
              (r) => r.id === (vars.kaizo_phase4 ?? VC_PHASE4_DEFAULT),
            )));
          stats.gateTrips += 1;
        } else {
          const want = rowId(table, dir.phase, dir.turn);
          if (pointer !== want) {
            stats.pointerMismatch += 1;
            stats.firstPointerMismatch ??= { frame: label, pointer, want };
          }
        }
      }
      prevPhase = dir.phase;
      prevTurn = dir.turn;
    } else if (dir && prevPhase === null) {
      prevPhase = dir.phase;
      prevTurn = dir.turn;
    }

    // ── mnfight's three-state machine ───────────────────────────────────
    const fading = !!dir?.fadingBar;
    if (dir?.clockOn) mnfight = 2;
    else if (mnfight === 2) mnfight = 0;
    if (mnfight !== 2 && fading && !sawFadingBar) mnfight = 1;
    sawFadingBar = fading;

    // ── the instrument counter ──────────────────────────────────────────
    if (spawnsMode === 'count') {
      for (const e of state.entities) {
        if (!e.alive || !WATCHED.has(e.type?.name)) continue;
        if (seenSeq.has(e.seq)) continue;
        seenSeq.add(e.seq);
        spawns += 1;
      }
    }

    const bullets = liveBullets(state);
    const live = bullets.length;

    // ── FILE 1 ──────────────────────────────────────────────────────────
    rows.push([
      String(label),
      soul ? cell(soul.x) : '',
      soul ? cell(soul.y) : '',
      cell(state.invTimer),
      cell(knight ? ac : NO_KNIGHT),
      cell(state.turntimer),
      box ? cell(box.x) : '',
      box ? cell(box.y) : '',
      box ? cell(box.image_xscale) : '',
      box ? cell(box.image_yscale) : '',
      String(live),
      spawnsMode === 'count' ? String(spawns) : '',
      pointer,
      playing,
      // `phase` is the knight's own, which the director mirrors into
      // state.knightPhase at its selector (kaizo-practice.js:1381) and which
      // vcHooks' advance re-stamps at every turn end. Before the first
      // selection it is undefined and the director's row is the truth.
      cell(knight ? (state.knightPhase ?? dir?.phase ?? NO_KNIGHT) : NO_KNIGHT),
      // `phaseturn` — SEE THE HEADER NOTE. The sim drives a vanilla counter
      // here; the mod's knight never moves its own.
      cell(knight ? (state.phaseturn ?? 0) : NO_KNIGHT),
      // `phase4turn` — a REAL analogue, found in the dump rather than guessed:
      // the mod sets it through the phase-4 nodes' own attackSetVar
      // (Other_24: [["phase4turn", 0]] / 1 / 2 / 3), and vcHooks' onSelect
      // applies every setVars pair into state.kaizo.vars. Its pre-selection
      // value is the mod's Create default (Create_0:72, `phase4turn = 0`).
      cell(knight ? Number(vars.phase4turn ?? 0) : NO_KNIGHT),
      cell(knight ? difficulty : NO_KNIGHT),
      cell(mnfight),
      cell(knight ? rtimer : NO_KNIGHT),
      // NOT gated on the knight INSTANCE. The recorder reads
      // `global.monsterhp[0]` and defaults to -99 only when that GLOBAL is
      // missing, which is a different condition from the knight existing —
      // the monster's HP outlives its instance in both engines.
      cell(state.knight?.hp ?? NO_KNIGHT),
    ].join(','));

    // ── FILE 2 ──────────────────────────────────────────────────────────
    const brow = [String(label), String(live)];
    for (let i = 0; i < slots; i++) {
      const b = bullets[i];
      if (!b) {
        // SEVEN EMPTY CELLS, NEVER ZEROS.
        brow.push('', '', '', '', '', '', '');
        continue;
      }
      brow.push(
        cell(b.x), cell(b.y), cell(b.image_angle),
        cell(b.image_xscale), cell(b.image_yscale),
        cell(b.direction), cell(b.speed),
      );
    }
    bulletRows.push(brow.join(','));

    // ── stats ───────────────────────────────────────────────────────────
    stats.frames += 1;
    stats.acValues.add(ac);
    stats.difficulties.add(difficulty);
    stats.spawns = spawns;
    stats.mnfightHist.set(mnfight, (stats.mnfightHist.get(mnfight) ?? 0) + 1);
    if (live > 0) stats.bulletFrames += 1;
    if (live > stats.maxLive) stats.maxLive = live;
    if (live > slots) stats.truncFrames += 1;
    if (soul) stats.soulFrames += 1;
    if (box) stats.boxFrames += 1;
    if (!knight) stats.noKnightFrames += 1;
    if (state.gameOver) stats.gameOverFrames += 1;
    // More than one live box would make the gt_* columns an arbitrary pick
    // rather than a measurement — the oracle's `obj_growtangle.x` picks
    // arbitrarily too, and the two picks need not agree. Counted so it can
    // never be a silent choice.
    if (state.entities.filter((e) => e.alive && e.type?.name === 'obj_growtangle').length > 1) {
      stats.multiBoxFrames += 1;
    }

    if (refill) refill();
  }

  stats.launches = state.kaizo?.launched?.length ?? 0;
  return {
    header: KAIZO_TRACE_COLUMNS.join(','),
    rows,
    bulletHeader: bulletColumns(slots).join(','),
    bulletRows,
    stats,
    state,
  };
}

/**
 * The NARROW row, unchanged from the pre-token tool, for a quick look with no
 * recording in play. NOT COMPARABLE TO ANY RECORDING — different column names.
 */
function narrowRows(wide) {
  const idx = (c) => KAIZO_TRACE_COLUMNS.indexOf(c);
  const take = ['frame', 'soul_x', 'soul_y', 'inv', 'attackchoice', 'turntimer',
    'gt_x', 'gt_y', 'gt_xs', 'gt_ys', 'bullets'].map(idx);
  return wide.rows.map((r) => {
    const c = r.split(',');
    return take.map((i) => c[i]).join(',');
  });
}

/**
 * IS THIS TRACE EVIDENCE? — the same question verify-fullfight asks of a
 * recording before it will report a diff against one.
 *
 * A trace of a fight that never started is not a trace of a fight, and a diff
 * against it passes for reasons that have nothing to do with the fight being
 * right. Two attacks and some bullets is the minimum that makes the columns
 * mean anything: one `attackchoice` value means the selector never ran twice,
 * and zero bullet frames means nothing was ever on the board to hit.
 */
export function degeneracy(stats) {
  const why = [];
  if (stats.launches < 2) why.push(`only ${stats.launches} attack(s) launched`);
  if (stats.acValues.size < 2) why.push(`only ${stats.acValues.size} distinct attackchoice value(s)`);
  if (stats.bulletFrames === 0) why.push('no frame ever had a bullet on screen');
  // A GAME OVER ENDS THE FIGHT AND NOT THE RECORDING. This one does not
  // announce itself: a wiped party leaves the last turn's bullets frozen on
  // the board, so `bullets` stays non-zero and the trailing-flatline test that
  // catches a stalled menu sees nothing wrong. A 1800-frame V-C run with the
  // default input dies around f814 and spends the remaining 986 frames looking
  // busy. The oracle recorder keeps its party alive, so a sim trace that dies
  // is not comparable to one at all.
  if (stats.gameOverFrames > 0) {
    why.push(`the party wiped — ${stats.gameOverFrames} of ${stats.frames} frames`
      + ' ran after Game Over (a scripted input does not dodge; pass --keep-alive,'
      + ' which the oracle recorder does too)');
  }
  return why;
}

// ── CLI ───────────────────────────────────────────────────────────────────

function usage(msg) {
  if (msg) console.error(`kaizo-trace: ${msg}`);
  console.error(`usage: node kaizo/tools/kaizo-trace.mjs [options]

  --inputs PATH     replay the oracle_inputs.txt THE PATCHED GAME READ — seed,
                    frame count, one bitmask per frame. PREFER THIS: identical
                    bytes on both sides. Its seed WINS over --seed and its
                    length sets --frames.
  --token PATH      replay the REPLAY TOKEN those inputs came from, read from
                    this FILE. Same rules. A PATH, never the token itself:
                    tokens are ~53 KB and the Windows command line truncates
                    long before that.
  --version C|D     which kaizo version to replay        (default C)
  --seed N          RNG seed, ignored when a feed carries one   (default 12345)
  --frames N        frames to step         (default: the feed's, else 1800)
  --slots N         bullet slots in file 2                     (default 32)
  --out PATH        where the PAIR goes. A directory (or a trailing separator)
                    writes the recorder's own basenames into it; a path ending
                    .csv is the trace file and the bullets file is named beside
                    it; anything else is a filename PREFIX.
                    (default traces/kaizo-sim-)
  --tag TAG         the recorder's tag, used by the directory/prefix forms
  --input RULE      menu | pulse:N | idle — SYNTHETIC, not comparable to a
                    recording. Ignored when a feed is given.   (default menu)
  --keep-alive      pin the party at full HP each frame (roster-aware). The
                    oracle recorder does the same. Costs every survival claim.
  --no-pin-monsterhp
                    stop pinning the Knight's HP. The recorder pins it
                    unconditionally, so a run without this flag is the
                    comparable one; pinning also holds the phase-4 gate shut.
  --spawns MODE     count | empty — the instrument counter (default count).
                    'empty' writes the column blank for a run where the
                    Knight's afterimage population is known to differ.
  --narrow          write ONE file, the old eleven columns, to --out taken as
                    a literal path ('-' for stdout). Not comparable.
  --allow-degenerate  write the files even if the run never became a fight`);
  process.exit(2);
}

const FLAGS_WITH_VALUES = ['--inputs', '--token', '--version', '--seed', '--frames',
  '--slots', '--out', '--tag', '--input', '--spawns', '--sync', '--oracle', '--bolts', '--grazes', '--drawprobe', '--drawlog', '--shuffle', '--cameralog'];
const FLAGS_BARE = ['--keep-alive', '--no-pin-monsterhp', '--narrow',
  '--allow-degenerate', '--help'];

function main() {
  const argv = process.argv.slice(2);
  const flag = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : dflt;
  };

  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    if (!FLAGS_WITH_VALUES.includes(argv[i]) && !FLAGS_BARE.includes(argv[i])) {
      usage(`unknown option ${argv[i]}`);
    }
  }
  if (argv.includes('--help')) usage();

  const version = String(flag('--version', 'C')).toUpperCase();
  const tokenPath = flag('--token', null);
  let syncFrames = 0;
  const inputsPath = flag('--inputs', null);
  const outSpec = flag('--out', 'traces/kaizo-sim-');
  const tag = flag('--tag', '');
  const slots = Number(flag('--slots', String(DEFAULT_SLOTS)));
  const inputSpec = String(flag('--input', 'menu'));
  const spawnsMode = String(flag('--spawns', 'count'));
  const keepAlive = argv.includes('--keep-alive');
  const pinMonsterhp = !argv.includes('--no-pin-monsterhp');
  const narrow = argv.includes('--narrow');
  const allowDegenerate = argv.includes('--allow-degenerate');

  // --bolts <file>: the MOD's attack-bar schedules, in
  // tools/fullfight-trace.mjs's format (`barFrame,boltframe:char|...` per
  // line). Produce one with kaizo/tools/decode-bolts.mjs from the recording's
  // seq CSV. Without it the sim rolls its OWN schedule and every turn boundary
  // moves, which reads as attack drift and is nothing of the kind.
  // --grazes <file>: the recorder's graze log (kaizo_oracle_grazes<TAG>.csv),
  // same columns as the vanilla oracle_grazelog.csv and read by the same rule
  // as tools/fullfight-trace.mjs: fight frame = log frame + 1 (the collision
  // fires before the Draw that advances oracle_frame). Each row carries
  // global.inv AS THE GRAZE EVENT SAW IT, which is the only honest resolution
  // of hit-vs-graze ordering on a shared frame -- the order is not static
  // (sim/index.js runCollisions cites the measurement). The sim's own
  // graze-first pass awarded on _tok3 f862, the frame a hit landed; the log
  // reads inv 12 there and stepGraze's rowInv gate skips it.
  const grazesPath = flag('--grazes', null);
  const drawProbeSpec = flag('--drawprobe', null);
  const drawProbe = drawProbeSpec ? drawProbeSpec.split('-').map(Number) : null;
  const drawLogPath = flag('--drawlog', null);
  // --shuffle: the recording's slash order (kaizo/tools/derive-shuffle.mjs).
  // The 16-per-element burn stays the sim's own; only the ORDER comes from the
  // recording, which is what the vanilla lane's --shuffle does and why the
  // unsolved ds_list_shuffle permutation does not block a whole-fight diff.
  const shufflePath = flag('--shuffle', null);
  const cameraLogPath = flag('--cameralog', null);
  const cameraLog = cameraLogPath ? [] : null;
  const shuffleOrder = shufflePath === null ? null : readFileSync(shufflePath, 'utf8');
  const drawLog = drawLogPath ? [] : null;
  const grazeRows = grazesPath === null ? null : (() => {
    const rows = [];
    for (const line of readFileSync(grazesPath, 'utf8').trim().split(/\r?\n/)) {
      const r = line.split(',');
      if (r.length < 11) continue;
      const fight = Number(r[0]) + 1;
      if (!Number.isFinite(fight)) continue;
      rows.push({ fight, type: r[2], x: Number(r[4]), y: Number(r[5]), active: Number(r[8]), inv: Number(r[10]) });
    }
    return rows;
  })();
  if (grazeRows) console.error(`  grazes: ${grazeRows.length} recorded pairing(s) from ${grazesPath}`);

  const boltsPath = flag('--bolts', null);
  const boltSchedules = boltsPath === null ? null : (() => {
    const text = readFileSync(boltsPath, 'utf8').trim();
    if (!text) return [];
    return text.split(/\r?\n/).map((line) => line.split(',').slice(1).join(',')
      .split('|').filter(Boolean).map((b) => {
        const [frame, char] = b.split(':').map(Number);
        return { char, frame, alive: true, red: false };
      }));
  })();
  if (boltSchedules) console.error(`  bolts: replaying ${boltSchedules.length} recorded schedule(s) from ${boltsPath}`);


  if (!KAIZO_VERSIONS[version]) usage(`--version must be one of ${Object.keys(KAIZO_VERSIONS).join(', ')}`);
  if (!Number.isInteger(slots) || slots < 1) usage('--slots must be a positive integer');
  if (!['count', 'empty'].includes(spawnsMode)) usage('--spawns must be "count" or "empty"');

  let seed = Number(flag('--seed', '12345'));
  let frames = argv.includes('--frames') ? Number(flag('--frames')) : null;
  let input;
  let feedName;

  if (inputsPath && tokenPath) {
    usage('--inputs and --token are two views of ONE feed; give exactly one.'
      + ' If they disagree the run is comparable to neither.');
  }

  if (inputsPath || tokenPath) {
    // A PATH. If someone pastes a token itself the read below fails with a
    // clear message rather than looking for a file named after 53 KB of
    // base64.
    const path = inputsPath ?? tokenPath;
    let feed;
    try {
      if (inputsPath) {
        feed = readInputsFile(inputsPath);
      } else {
        const replay = decodeReplay(readFileSync(tokenPath, 'utf8').trim());
        feed = { seed: replay.meta.seed, frames: replay.frames, inputAt: replay.inputAt };
      }
    } catch (err) {
      usage(`${inputsPath ? '--inputs' : '--token'}: ${err.code === 'ENOENT'
        ? `cannot read ${path} — it takes a PATH to the file, not its contents`
        : err.message}`);
    }
    if (argv.includes('--seed') && Number(flag('--seed')) !== feed.seed) {
      console.error(`kaizo-trace: --seed ${flag('--seed')} IGNORED — the feed carries`
        + ` seed ${feed.seed}, and the feed and the seed are one artifact.`);
    }
    seed = feed.seed;
    // THE DEFAULT MUST COVER THE RECORDING, AND THE FEED'S OWN LENGTH DOES NOT.
    // syncedTokenInput reads the feed at `f - sync`, so a run of exactly
    // feed.frames frames stops `sync` frames SHORT of the recording's end: with
    // _tok3's sync of 127 the sim's last row was oracle f12872 against the
    // recording's f13000, and the gate reported "128 recorded frame(s) have no
    // sim counterpart" for the whole life of this lane -- 128 frames it had
    // never once looked at. The real default is feed.frames + sync, which
    // consumes feed indices 0..feed.frames-1 exactly and lands on oracle
    // f12999. (Only the recording's very last frame stays out of reach: no feed
    // entry exists for it.) Applied below, once the sync is known.
    const framesExplicit = frames !== null;
    input = tokenInput(feed);
    feedName = `${inputsPath ? 'inputs' : 'token'} ${path}`
      + ` (${feed.frames} frames, seed ${seed})`;

    // ── THE SYNC POINT ────────────────────────────────────────────────────
    // See syncedTokenInput. `--sync auto --oracle <trace.csv>` derives it from
    // data on both sides rather than baking 88: the oracle's first-launch frame
    // is read out of the recording, the sim's is found by a throwaway PASS ONE
    // on the lead-in feed alone, and the offset is the difference.
    const syncSpec = flag('--sync', null);
    // eslint-disable-next-line no-use-before-define
    if (syncSpec !== null) {
      const leadIn = menuGatedInput();
      let sync;
      if (syncSpec === 'auto') {
        const oraclePath = flag('--oracle', null);
        if (!oraclePath) usage('--sync auto needs --oracle <oracle trace.csv> to read the recording\'s own first-launch frame from');
        const oracleFirst = oracleFirstLaunchFrame(oraclePath);
        // PASS ONE, discarded: run the lead-in alone to find where THIS sim
        // build first launches. Deterministic, so pass two reproduces it.
        const probe = traceKaizo({
          // PASS ONE SIZES ITSELF. `frames` is still null here when the caller
          // did not pass --frames, because the real default needs the sync this
          // pass is computing. The probe only has to reach the first launch, so
          // the feed's own length is more than enough.
          version, seed, frames: frames ?? feed.frames, slots, keepAlive, pinMonsterhp, spawnsMode,
          input: menuGatedInput(),
          // PASS ONE DELIBERATELY GETS NO SCHEDULES. It exists only to find
          // where this sim's first launch lands on the synthetic lead-in, and
          // the recording has no bar for that lead-in at all. Feeding it the
          // table moved the derived offset by 17 frames and turn 1 absorbed
          // every one of them (Starstorm1 went from exact to +17).
        });
        // `stats.chain` already holds "frame:id" per pointer flip and is
        // already printed on every run; reusing it beats adding a stat that
        // only this path would ever read.
        const simFirst = Number(String(probe.stats?.chain?.[0] ?? '').split(':')[0]);
        if (!Number.isInteger(simFirst)) {
          usage('--sync auto: pass one never launched an attack, so there is nothing to sync to');
        }
        sync = simFirst - oracleFirst;
        console.error(`  sync AUTO: oracle first launch f${oracleFirst}, sim f${simFirst}`
          + ` -> token index 0 lands at sim frame ${sync}`);
        if (sync < 0) {
          usage(`--sync auto computed ${sync}: the sim launches EARLIER than the`
            + ' recording, which this lead-in cannot express');
        }
      } else {
        sync = Number(syncSpec);
        if (!Number.isInteger(sync) || sync < 0) usage('--sync must be a non-negative integer or "auto"');
        console.error(`  sync ${sync}: token index 0 lands at sim frame ${sync}`);
      }
      input = syncedTokenInput(feed, sync, leadIn);
      syncFrames = sync;
      feedName += `, synced at ${sync}`;
      if (!framesExplicit) {
        frames = feed.frames + sync;
        console.error(`  frames: ${frames} = the feed's ${feed.frames} + the sync ${sync},`
          + " so the run reaches the recording's last input-driven frame");
      }
      // THE WARNING HAS TO COUNT THE OFFSET TOO. It used to fire on
      // `frames > feed.frames`, which is true of every correctly-sized synced
      // run, so the one message that should mean "you are running past your
      // inputs" cried wolf on the default.
      if (frames - sync > feed.frames) {
        console.error(`kaizo-trace: WARNING --frames ${frames} runs past the feed:`
          + ` with sync ${sync} it needs ${frames - sync} input frames and the feed`
          + ` has ${feed.frames}; frames ${feed.frames + sync}..${frames - 1} run on`
          + ' IDLE input, which no recording of this feed can match.');
      }
    }
  } else {
    if (frames === null) frames = 1800;   // no feed: nothing to size against
    if (inputSpec === 'menu') {
      input = menuGatedInput();
    } else if (inputSpec === 'idle') {
      input = idleInput();
    } else if (/^pulse(:\d+)?$/.test(inputSpec)) {
      const period = Number(inputSpec.split(':')[1] ?? 15);
      if (!Number.isInteger(period) || period < 1) usage('--input pulse:N needs N >= 1');
      input = pulseInput(period);
    } else {
      usage(`--input must be "menu", "pulse:N" or "idle", got "${inputSpec}"`);
    }
    feedName = `SYNTHETIC ${inputSpec} (not comparable to a recording)`;
  }

  if (!Number.isInteger(seed)) usage('--seed must be an integer');
  if (!Number.isInteger(frames) || frames <= 0) usage('--frames must be a positive integer');

  const res = traceKaizo({
    version, seed, frames, slots, keepAlive, pinMonsterhp, spawnsMode, input,
    boltSchedules, boltSkipBeforeFrame: syncFrames, grazeRows,
    drawProbe, drawLog, shuffleOrder, cameraLog,
  });
  const { stats } = res;
  // THE ORDER FEED REPORTS ITSELF. A fan that finds no matching entries leaves
  // itself as the burn left it and counts a miss; without this line a feed that
  // stops covering the fight (a short recording, a renamed object) would look
  // exactly like one that worked.
  if (res.state?.slashOrder) {
    const q = res.state.slashOrder;
    console.error(`  shuffle: ${q.hits ?? 0} fan(s) reordered from the recording,`
      + ` ${q.misses ?? 0} unmatched, ${q.entries.length} angle(s) unused`);
  }
  if (cameraLog) {
    writeFileSync(cameraLogPath, 'frame,camerax,cameray,shakes' + String.fromCharCode(10) + cameraLog.join(String.fromCharCode(10)) + String.fromCharCode(10));
    console.error(`  cameralog: ${cameraLog.length} rows -> ${cameraLogPath}`);
  }
  if (drawLog) {
    writeFileSync(drawLogPath, 'simFrame,oracleFrame,draws,spawnn\n' + drawLog.join('\n') + '\n');
    console.error(`  drawlog: ${drawLog.length} rows -> ${drawLogPath}`);
  }

  // THE PROVENANCE GOES TO STDERR, NEVER INTO THE FILES. A `#` comment line
  // would land in the differ's header comparison and fail every diff.
  console.error(`kaizo-trace: V-${version} seed ${seed} frames ${frames}`
    + ` slots ${slots}${keepAlive ? ' keep-alive' : ''}`
    + `${pinMonsterhp ? ' pin-monsterhp' : ''}`);
  // A --bolts RUN MUST NOT LOOK LIKE IT REPLAYED MORE THAN IT DID. The scene
  // rejects any recorded schedule whose character set does not match the bar's
  // roster, and on _tok3 that is 30 of 32 — the recording's party is down from
  // turn 3 and the sim's keep-alive fields two or three. Silently falling back
  // reads as "replayed 32 schedules" in the line above, which is how a reader
  // concludes the bolts are handled and goes looking for the drift elsewhere.
  if (res.state?.boltRosterWarned?.length) {
    const w = res.state.boltRosterWarned;
    console.error(`  bolts: ${w.length} schedule(s) REJECTED on roster mismatch`
      + ` (recording had chars [${w[0].recChars}], the sim fielded [${w[0].barChars}]`
      + `${w.some((x) => x.barChars !== w[0].barChars) ? ' and others' : ''}) —`
      + ' those bars fell back to the generated schedule');
  }
  console.error(`  feed: ${feedName}`);
  console.error(`  launches ${stats.launches}`
    + ` · attackchoice [${[...stats.acValues].join(' ')}]`
    + ` · difficulty [${[...stats.difficulties].join(' ')}]`);
  console.error(`  bullet frames ${stats.bulletFrames}/${stats.frames}`
    + ` (peak live ${stats.maxLive})`
    + ` · soul ${stats.soulFrames} · box ${stats.boxFrames}`
    + ` · spawns ${spawnsMode === 'count' ? stats.spawns : 'EMPTY'}`
    + (stats.gameOverFrames ? ` · GAME OVER for ${stats.gameOverFrames} frames` : ''));
  console.error(`  mnfight (MODELLED, coarse): `
    + [...stats.mnfightHist].sort((a, b) => a[0] - b[0])
      .map(([k, v]) => `${k}=${v}`).join(' '));

  // ── THE ASSERTIONS THAT KEEP THE MODELLED COLUMNS HONEST ────────────────
  if (stats.pointerFlips === 0 && stats.launches > 0) {
    console.error('  WARNING: the schedule pointer never flipped although attacks'
      + ' launched — kaizo_atk/kaizo_playing are inert for this table (no row ids).');
  }
  if (stats.pointerMismatch) {
    const m = stats.firstPointerMismatch;
    console.error(`  FAIL: the mirrored nextAttack chain disagreed with the director's`
      + ` own advance ${stats.pointerMismatch} time(s).`);
    console.error(`        first at frame ${m.frame}: pointer "${m.pointer}",`
      + ` director moved to "${m.want}".`);
    console.error('        naturalNext() no longer mirrors kaizo-vc-hooks.js advance.');
  } else if (stats.pointerFlips) {
    console.error(`  pointer: ${stats.pointerFlips} flip(s), every one confirmed against`
      + " the director's own advance at turn end");
  }
  if (stats.ledgerMismatch) {
    const m = stats.firstLedgerMismatch;
    console.error(`  FAIL: ${stats.ledgerMismatch} pointer flip(s) did not match the launch`
      + ' ledger — a flip with no launch behind it is a phantom turn.');
    console.error(`        first at frame ${m.frame}: ${m.why}.`
      + (m.flip ? ` Flip named phase ${m.flip.phase} turn ${m.flip.turn} (${m.flip.id}).` : '')
      + (m.ledger ? ` Ledger recorded phase ${m.ledger.phase} turn ${m.ledger.turn}.` : ''));
  } else if (stats.pointerFlips) {
    console.error(`  ledger: ${stats.launches} launch(es), each one frame after its flip`);
  }
  if (stats.chain.length) {
    console.error(`  chain: ${stats.chain.join(' ')}`);
  }
  if (stats.gateTrips) {
    console.error(`  NOTE: the phase-4 HP gate tripped ${stats.gateTrips} time(s).`
      + ' The recorder pins monsterhp, so no recording can contain this.');
  }
  if (stats.truncFrames) {
    console.error(`  NOTE: ${stats.truncFrames} frame(s) had more than ${slots} live`
      + ` bullets (peak ${stats.maxLive}); those rows are TRUNCATED on both sides.`
      + ' `live` carries the true count so the truncation is visible.');
  }
  if (stats.multiBoxFrames) {
    console.error(`  WARNING: ${stats.multiBoxFrames} frame(s) had more than one live`
      + ' obj_growtangle — the gt_* columns are an arbitrary pick on both sides.');
  }
  if (stats.noKnightFrames) {
    console.error(`  NOTE: ${stats.noKnightFrames} frame(s) had no knight;`
      + ' those rows carry the recorder\'s own -99 sentinel.');
  }

  const why = degeneracy(stats);
  if (why.length) {
    console.error('  DEGENERATE — this run never became a fight:');
    for (const w of why) console.error(`    - ${w}`);
    console.error('    A diff against this passes for reasons that are not the fight.');
    if (!allowDegenerate) {
      console.error('    Refusing to write it. Raise --frames, add --keep-alive, or');
      console.error('    pass --allow-degenerate if you meant to capture a short window.');
      process.exit(1);
    }
    console.error('    (--allow-degenerate: writing it anyway)');
  }

  if (narrow) {
    const csv = `${[KAIZO_NARROW_COLUMNS.join(','), ...narrowRows(res)].join('\n')}\n`;
    if (outSpec === '-') {
      process.stdout.write(csv);
    } else {
      mkdirSync(dirname(outSpec) || '.', { recursive: true });
      writeFileSync(outSpec, csv);
      console.error(`  NARROW: ${res.rows.length} rows,`
        + ` ${KAIZO_NARROW_COLUMNS.length} columns -> ${outSpec}`);
    }
    return;
  }

  const { trace: tracePath, bullets: bulletPath } = outPaths(outSpec, tag);
  mkdirSync(dirname(tracePath) || '.', { recursive: true });
  // ── THE SYNC FRAME IS THE SIM'S FRAME 0 ───────────────────────────────────
  //
  // With a sync point the two sides now agree on which INPUT reaches which game
  // state, but not yet on which ROW is which: the sim still carries its
  // lead-in, so its row N is the oracle's row N - sync. The differ compares by
  // row index, so it would report every row as divergent while the fights
  // actually matched.
  //
  // Dropping the lead-in and renumbering from 0 is exactly what `oracle_t0`
  // does on the recorder side — the recording does not carry its 120 boot
  // frames either. The lead-in is the sim walking its opening menu, which the
  // recording has no counterpart for and which nothing can be held against.
  //
  // The banner above still describes the FULL run, including the lead-in, so
  // the launch chain and counts printed there are one-indexed to the run and
  // not to the file. Said here because a reader comparing the chain line
  // against the file's frame numbers would otherwise find them off by `sync`.
  const relabel = (rows, dropped) => rows.slice(dropped).map((r) => {
    const i = r.indexOf(',');
    return `${Number(r.slice(0, i)) - dropped}${r.slice(i)}`;
  });

  // `spawns` IS A PER-RUN INSTRUMENT COUNTER, NOT A GAME QUANTITY, so it has to
  // be rebased with the rows. The oracle's starts at 0 at its own `oracle_t0`;
  // the sim's had already counted everything created during the lead-in (32 by
  // the sync frame), so an unrebased column diverges on row 0 forever while
  // agreeing about every actual spawn after it.
  const rebaseSpawns = (rows, header) => {
    const cols = header.split(',');
    const i = cols.indexOf('spawns');
    if (i < 0 || !rows.length) return rows;
    const base = Number(rows[0].split(',')[i]);
    if (!base) return rows;
    return rows.map((r) => {
      const c = r.split(',');
      c[i] = String(Number(c[i]) - base);
      return c.join(',');
    });
  };

  const outRows = syncFrames > 0
    ? rebaseSpawns(relabel(res.rows, syncFrames), res.header)
    : res.rows;
  const outBullets = syncFrames > 0 ? relabel(res.bulletRows, syncFrames) : res.bulletRows;
  if (syncFrames > 0) {
    console.error(`  sync: dropped the ${syncFrames}-frame lead-in; the sync frame is`
      + ` this file's frame 0 (${outRows.length} rows written)`);
  }

  writeFileSync(tracePath, `${[res.header, ...outRows].join('\n')}\n`);
  writeFileSync(bulletPath, `${[res.bulletHeader, ...outBullets].join('\n')}\n`);
  console.error(`  ${res.rows.length} rows, ${KAIZO_TRACE_COLUMNS.length} columns`
    + ` -> ${tracePath}`);
  console.error(`  ${res.bulletRows.length} rows,`
    + ` ${res.bulletHeader.split(',').length} columns -> ${bulletPath}`);
}

// `import.meta.url === file://${process.argv[1]}` — the form the older tools
// use — is FALSE ON WINDOWS: argv[1] is `D:\...\kaizo-trace.mjs` and the URL is
// `file:///D:/.../kaizo-trace.mjs`, so main() would silently never run and the
// tool would exit 0 having written nothing. pathToFileURL normalises both.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
