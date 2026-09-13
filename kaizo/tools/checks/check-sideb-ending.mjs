#!/usr/bin/env node
// KAIZO V-D (B-Side) — THE EPILOGUE THAT DOES NOT EXIST ANYWHERE ELSE.
//
// Ledger G-15 [5]: on a `global.flag[456]` win the mod's routing forks into
// ~595 lines in which the Knight, having "lost", cuts the whole party down —
// and never gives the room back. Positive assertions on every mechanism
// kaizo/scenes/kaizo-ending.js translates, against the kaizo dump.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C).
//
// **THERE IS NO RECORDING OF THIS ROUTE.** Both whole-fight recordings are
// A-Side, three characters; the only B-Side ground truth on disk is two
// 2,400-frame locks (`kanimB-raw`, `roaringdeltaB-raw`), neither of which is
// the epilogue. So every expectation below is derived from the GML and this
// file is the only thing standing over that derivation. It is written
// accordingly: every number it asserts is quoted with its dump line, and
// every mechanism is paired with a NON-VACUOUS CONTROL — a run in which the
// same code is stepped and the mechanism must NOT happen — because "the
// machine ran and nothing changed" and "the machine never ran" are otherwise
// the same observation (CLAUDE.md, "A green suite does not mean a change took
// effect").
//
// AND THE RNG BUDGET IS A MEASUREMENT, NOT A TALLY (2026-09-12). Section G's
// "exactly 8 u32" used to be asserted against `state.kaizo.ending.draws` — the
// module's own hand-incremented counter — so it only ever asked whether the
// module agreed with itself. A review injected a REAL extra draw into
// `endingFunchance` and this check stayed exit 0. `gmlRng.draws` (sim/rng.js)
// is now the primary witness at every budget assertion; see `assertStream`.
//
// PROVENANCE of the expectations asserted here:
//   gml_Object_obj_ch3_PTB02_Step_0.gml    607-619   the con-8 fork
//                                          1181-1246 con 50.1
//                                          1247-1775 con 50.2
//                                          1974-1991 big_shake
//                                          1992-2172 susie_knight_slash
//   gml_Object_obj_ch3_PTB02_Alarm_0.gml             `con++`
//   gml_Object_obj_ch3_PTB02_Create_0.gml  304-314   ouchie_display
//   gml_Object_obj_knight_enemy_Step_0.gml 1324-1333 flag[50]/[51]
//   gml_Object_obj_knight_enemy_Other_13.gml 76-79   flag[50] -> 1
//   gml_GlobalScript_kaizo_settings_init.gml 22-25   kaizo_funchance
//
//     node kaizo/tools/checks/check-sideb-ending.mjs
//     node kaizo/tools/checks/check-sideb-ending.mjs --sabotage
//
// `--sabotage` proves the check can fail. It injects ONE real defect —
// `susie_knight_shake_time` raised from 80 to 200, so the clash's shrinking-
// interval shake can never pulse inside the 124-frame window — and reruns the
// whole suite, which must go RED. Exit 0 clean / 1 sabotaged; a clean
// --sabotage run would mean the pulse count and the RNG budget are decorative.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { gmlCreate } from '../../../sim/rng.js';
import {
  ensureEnding, endingReport, endingDraws, endingApprox, endingTerminal,
  endingWatchEndcon, markKnightDefeated, endingFunchance, endingSprites,
  ptb02Con8, ptb02Alarm0, enterEnding,
  spawnEndingActors, spawnEndingKnight, kaizoEndingDriver,
  visitedSbStates, clashDraws, ralseiSwoonSprite, pendingEndingDelays,
  scrVarDelay, scrDoom, endingMarker, endingDoom, endingActor, endingDelay,
  stepSbEpilogue, stepSwoonTarget, stepBigShake, stepSusieKnightSlash,
  stepEndingScript, SB_SETUP_SCRIPT, ENDING_SPRITES, ENDING_DIALOGUE_FRAMES,
  CAM_X, CLASH_CAM_X, CAM_KICK_FRAMES, CAM_KICK_RELEASE, CLASH_SHAKE_STEP,
  CLASH_SHAKE_FLOOR, SWOON_CHANCE, SLASH_SPRITE, SLASH_OFFSET, SUSIE_LAUNCH,
  CLASH_OVERLAY_DEFAULT, CLASH_OVERLAY_HALF, WARP_SETTLE,
  SPR, SB_STATES, SB_CLASH_BREAK, SB_TERMINAL, SB_TERMINAL_AT,
  CON_VICTORY, CON_VICTORY_SIDEB, CON_LOSS, CON_ALARM_FRAMES,
  ASIDE_RESUMES_AT_CON, FLAG_WEIRD_ROUTE, FLAG_KNIGHT_OUTCOME,
  FLAG_KNIGHT_VIOLENCED, OUCHIE_SUSIE, OUCHIE_RALSEI, SWOON_SPRITE,
  DEFEAT_SPRITE, FACEAWAY_SPRITE, BOARD_OCEAN, BOARD_OCEAN_VOL,
  BOARD_OCEAN_FADE, CLASH_FINISH_TIME, CLASH_JUMP_BACK_TIME,
  CLASH_SHAKE_TIME, CAM_KICK, ENDING_APPROX,
} from '../../scenes/kaizo-ending.js';
import { buildKaizoScene, kaizoEndingRouteFor } from '../../scenes/kaizo-fight.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const DUMP = join(homedir(), 'knight-research', 'kaizo-mod', 'gml_kaizo_dump', 'CodeEntries');
const SABOTAGE = process.argv.includes('--sabotage');

/**
 * THE WORK ORDER — NOW CLOSED (2026-09-12).
 *
 * This list held every sprite the epilogue names that resolved in NEITHER
 * pack: eighteen overworld cutscene sprites the kaizo overlay's WANT list
 * (`kaizo/tools/pack-kaizo-sprites.mjs`) was never built to carry, because it
 * was built for the FIGHT. The instruction it carried was "add them there,
 * repack, and delete them from here", and that is what happened: all eighteen
 * are in the packer's WANT list and the overlay now resolves every one (16
 * byte-identical vanilla, 2 the mod's own overworld repaint — see the packer's
 * own provenance note and `check-ending-sprite-pack.mjs`).
 *
 * THE LIST STAYS, EMPTY, AND THE ASSERTION STAYS PINNED IN BOTH DIRECTIONS.
 * An empty expectation is not a dead assertion: a name that stops resolving —
 * a WANT entry deleted, a repack run against a dump that lacks it — fails here
 * just as loudly as a name that started resolving used to. That is the whole
 * point of asserting the SET rather than a count.
 */
const UNPACKED_SPRITES = [];


let failures = 0;
let checks = 0;
function assert(cond, label) {
  checks += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); }
}
function assertEq(got, want, label) {
  checks += 1;
  if (got !== want) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}
function assertJson(got, want, label) {
  assertEq(JSON.stringify(got), JSON.stringify(want), label);
}

/**
 * ═══ THE STREAM ITSELF, NOT THE MODULE'S BOOKKEEPING ═══════════════════════
 *
 * `endingDraws()` is a HAND-INCREMENTED tally: `draw()` in kaizo-ending.js
 * bumps `state.kaizo.ending.draws[bucket]` at each site the author remembered.
 * Asserting the budget against it only asks "does the module agree with
 * itself", and a review proved that exactly: a REAL extra
 * `gmlIrandomRange(state.gmlRng, 0, 1)` injected into `endingFunchance` moved
 * the stream and both checks stayed exit 0. RNG-stream accounting is what this
 * whole project's byte gate rests on — a translation that spends the wrong
 * number of real draws desynchronises everything downstream — so the budget is
 * MEASURED here.
 *
 * `gmlRng.draws` is the monotonic u32 counter incremented inside `gmlU32`
 * (sim/rng.js) — every draw, from every site, whether or not anyone tallied
 * it. It is the primary. `gmlRng.idx` is the WELL512 RING index and wraps mod
 * 16 (a draw advances it by 15), so it can only ever be a SECOND, independent
 * witness: it is asserted too, because `draws` is one field and a check that
 * trusts one field is the defect this helper exists to close.
 */
function rngMark(st) {
  return { draws: st.gmlRng.draws ?? 0, idx: st.gmlRng.idx };
}
function rngSpent(st, m0) {
  return (st.gmlRng.draws ?? 0) - m0.draws;
}
function assertStream(st, m0, want, label) {
  assertEq(rngSpent(st, m0), want, label);
  // The ring index is derived from a different line of gmlU32, so it cannot be
  // satisfied by a counter that has gone stale or been spoofed.
  assertEq((st.gmlRng.idx - m0.idx) & 15, (15 * want) & 15,
    `${label} — ...and the WELL512 ring index agrees (mod 16)`);
  if (want > 0) {
    assertEq(typeof st.gmlRng.draws, 'number',
      `${label} — ...and the counter is a real number, not an absent field`);
  }
}

const IDLE = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

/**
 * A live sim state on the chosen route, with the ending driver installed. A
 * REAL state, not a literal: every `scr_var_delay` in the epilogue is an
 * ALARM and every `scr_lerpvar` a real obj_lerpvar, so the engine's own alarm,
 * step and motion phases are part of what is under test.
 */
function mk({ sideb = true, seed = 12345, funni = false, defeated = true } = {}) {
  const st = createState({ seed, traceBulletSlots: 0 });
  // createState seeds gmlRng with 0 regardless of `seed` (sim/state.js) —
  // without this the "different seed" control passes vacuously.
  st.gmlRng = gmlCreate(seed);
  st.kaizo = { sideb, funni };
  ensureEnding(st);
  // ── SABOTAGE (`--sabotage`) ───────────────────────────────────────
  // ONE real defect, injected where nothing else can compensate for it:
  // `susie_knight_shake_time` opens at 80 (Create_0:64) and the pulse test is
  // `(shake_timer % shake_time) == 1`, so raising it past the 124-frame cut
  // means the clash NEVER pulses. Sections F and G must go red; a green
  // --sabotage run would mean the pulse count and the draw budget are
  // decorative. Exit code is the verdict: 0 clean, 1 sabotaged.
  if (SABOTAGE) ensureEnding(st).susieKnightShakeTime = 200;
  st.knight = { endcon: defeated ? 2 : 0, endtimer: 60 };
  return st;
}

/** Fight over -> fork -> alarm -> head. Returns the route the head entered. */
function toHead(st) {
  endingWatchEndcon(st);
  const fork = ptb02Con8(st);
  ptb02Alarm0(st);
  const route = enterEnding(st);
  spawn(st, kaizoEndingDriver, {});
  return { fork, route };
}

function run(st, frames, done = () => false) {
  for (let f = 0; f < frames; f++) {
    stepFrame(st, IDLE);
    if (done(st)) return f;
  }
  return -1;
}

// ═══ A: THE FORK — Step_0:607-619 ══════════════════════════════════════════
console.log('the con-8 routing fork');
{
  const st = mk({ sideb: true });
  endingWatchEndcon(st);
  const r = ptb02Con8(st);
  assertEq(r.con, CON_VICTORY_SIDEB, 'A a Weird Route WIN routes to con 49.1');
  assertEq(r.route, 'bside', 'A ...and reports the B-Side route');
  assertEq(r.defeated, true, 'A defeated is flag[50] == 1');
  assertEq(r.battleResult, 1, 'A battle_result 1 (the dr.ini UraBoss write)');
}
// NON-VACUOUS: the same code, the same win, the flag off.
{
  const st = mk({ sideb: false });
  endingWatchEndcon(st);
  const r = ptb02Con8(st);
  assertEq(r.con, CON_VICTORY, 'A- an A-Side WIN routes to con 49, not 49.1');
  assertEq(r.route, 'aside', 'A- ...and reports the A-Side route');
}
// THE SECOND TEST IS ON `con`, NOT ON `defeated`: a LOSS on a Weird Route file
// still goes to 9, because 9 is not 49. The subtle half of the transcription.
{
  const st = mk({ sideb: true, defeated: false });
  const r = ptb02Con8(st);
  assertEq(r.con, CON_LOSS, 'A- a Weird Route LOSS still routes to con 9');
  assertEq(r.route, 'loss', 'A- ...and reports the loss route');
  assertEq(r.battleResult, 2, 'A- battle_result 2 on a loss');
}

// ═══ B: THE FLAG PRODUCER — the teardown at endcon 2 ═══════════════════════
{
  const st = mk({ sideb: true, defeated: false });
  assertEq(st.kaizo.flag[FLAG_KNIGHT_OUTCOME], 0, 'B flag[50] starts 0');
  assertEq(st.kaizo.flag[FLAG_WEIRD_ROUTE], 1, 'B flag[456] mirrors state.kaizo.sideb');
  assert(!endingWatchEndcon(st), 'B nothing is written while endcon != 2');
  assertEq(ptb02Con8(st).con, CON_LOSS, 'B ...so the fork reads a loss (a reader with no writer)');

  st.knight.endcon = 2;
  assert(endingWatchEndcon(st), 'B THE TEARDOWN FIRED at endcon 2');
  assertEq(st.kaizo.flag[FLAG_KNIGHT_VIOLENCED], 1, 'B flag[51] = 1 (Step_0:1332)');
  assertEq(st.kaizo.flag[FLAG_KNIGHT_OUTCOME], 1,
    'B flag[50] = 1 — Other_13 tallied the kill (Other_13:76-79)');
  assertEq(ensureEnding(st).teamdefeated, false, 'B teamdefeated cleared');
  assert(!endingWatchEndcon(st), 'B it is idempotent — flag[51] is the latch');
  assert(!markKnightDefeated(st), 'B ...through the direct entry point too');
  assertEq(ptb02Con8(st).con, CON_VICTORY_SIDEB, 'B and NOW the fork routes to 49.1');
}

// ═══ C: Alarm_0 IS `con++` — the whole file ════════════════════════════════
{
  const st = mk();
  ensureEnding(st).con = CON_VICTORY;
  assertEq(ptb02Alarm0(st), 50, 'C 49 -> 50 (the A-Side knighting)');
  ensureEnding(st).con = CON_VICTORY_SIDEB;
  assertEq(ptb02Alarm0(st), 50.1, 'C 49.1 -> 50.1 (the B-Side epilogue)');
  assertEq(CON_ALARM_FRAMES, 30, 'C the alarm is armed 30 frames out (Step_0:615)');
}

// ═══ D: THE HEADLINE — 50 SETS con = 10 AND 50.2 NEVER DOES ════════════════
console.log('the one-line divergence: con = 10 vs con = 50.2');
{
  const st = mk({ sideb: false });
  const { route } = toHead(st);
  assertEq(route, 'aside', 'D the A-Side head ran');
  assertEq(ensureEnding(st).con, ASIDE_RESUMES_AT_CON,
    'D con 50 SETS con = 10 on its first line — the story resumes (Step_0:945)');
  assertJson(endingTerminal(st), { terminal: false, resumedAtCon: 10 },
    'D ...and the A-Side is reported as resuming, never terminal');
}
{
  const st = mk({ sideb: true });
  const { route } = toHead(st);
  assertEq(route, 'bside', 'D the B-Side head ran');
  assertEq(ensureEnding(st).con, 50.2,
    'D con 50.1 sets con = 50.2 on its first line (Step_0:1186)');
  assertJson(endingTerminal(st), { terminal: false, resumedAtCon: null },
    'D ...and resumedAtCon is null and stays null');
}

// ═══ E: THE WHOLE EPILOGUE WALKS, END TO END ═══════════════════════════════
console.log('the sb_con state walk');
const FULL = (() => {
  const st = mk({ sideb: true });
  // Snapshot the REAL stream before a single frame of the epilogue runs, so
  // section G can measure it instead of restating the module's tally.
  const rng0 = rngMark(st);
  toHead(st);
  const at = run(st, 4000, (s) => s.kaizo.ending.terminal);
  return { st, at, rng0 };
})();
{
  const { st, at } = FULL;
  assert(at > 0, `E THE EPILOGUE REACHED ITS END (frame ${at})`);
  assertJson(visitedSbStates(st), [0, 1, 2, 3, 4, SB_TERMINAL],
    'E it visited every sb_con in order and parked at 99');
  assertEq(ensureEnding(st).sbTimer, SB_TERMINAL_AT,
    'E sb_con 99 is entered at sb_timer 555 (Step_0:1762)');
  assertEq(endingTerminal(st).terminal, true, 'E terminal');
  assertEq(endingTerminal(st).resumedAtCon, null,
    'E **con is NEVER set to 10** — the story does not resume');
  assertEq(ensureEnding(st).con, 50.2, 'E ...con is still 50.2');
  // The ladder as data must match the machine that walked it.
  assertJson(SB_STATES.map((s) => s.at), [0, 1, 2, 3, 4, SB_TERMINAL],
    'E the published ladder matches the walk');
  assert(SB_STATES.find((s) => s.at === 2).beats.includes(41),
    'E ...and names sb_timer 41, Susie\'s ouchie beat');
  assert(SB_STATES.find((s) => s.at === 3).beats.includes(65),
    'E ...and sb_timer 65, Ralsei\'s');
}
// THE CLASH BREAK IS AT sb_timer 124 EXACTLY.
{
  const { st } = FULL;
  const log = ensureEnding(st).log;
  const to1 = log.find((t) => t.what === 'sbCon' && t.to === 1);
  const to2 = log.find((t) => t.what === 'sbCon' && t.to === 2);
  assert(!!to1 && !!to2, 'E the 1 -> 2 transition is logged');
  assertEq(to2.frame - to1.frame, SB_CLASH_BREAK - 1,
    'E sb_con 1 -> 2 lands on the frame sb_timer reads 124 (Step_0:1254)');
}

// ═══ F: THE CLASH IS TRUNCATED — and the control proves it ═════════════════
console.log('the clash, and the tail the B-Side never reaches');
{
  const { st } = FULL;
  assertJson(clashDraws(st), { pulses: 2, draws: 2 },
    'F only TWO shake pulses fire before the cut (slash_timer 10 and 80)');
  assertEq(ensureEnding(st).susieKnightSlash, false,
    'F susie_knight_slash was cleared by sb_con 1 (Step_0:1262)');
  assertEq(ensureEnding(st).susieKnightShakeSequence, false,
    'F ...and so was the shake sequence (:1263)');
  const marks = ensureEnding(st).marks;
  assert(!marks.some((m) => m.sprite === SPR.roaringknightSwordBreakPieceSmall),
    'F the sword shard NEVER spawns — its beat is at slash_timer 320');
  assert(!marks.some((m) => m.sprite === SPR.shineWhite),
    'F ...and neither does the shine');
}
// NON-VACUOUS CONTROL: the SAME handler, with no sb machine to cut it, runs
// the whole A-Side tail — five pulses, the parry, the shard and the shine.
{
  const st = mk({ sideb: false });
  spawnEndingActors(st);
  spawnEndingKnight(st);
  const e = ensureEnding(st);
  e.susieKnightSlash = true;
  spawn(st, kaizoEndingDriver, {});
  run(st, CLASH_JUMP_BACK_TIME + 40, (s) => !s.kaizo.ending.susieKnightSlash
    && s.kaizo.ending.susieKnightSlashTimer > CLASH_JUMP_BACK_TIME);
  assertEq(e.susieKnightSlashTimer, CLASH_JUMP_BACK_TIME + 20,
    'F- the untruncated clash runs to slash_timer 340');
  assertEq(clashDraws(st).pulses, 5,
    'F- FIVE pulses — shake_time 80, 70, 60, 50, 40 then <= 30 (Step_0:2040-2046)');
  assertEq(CLASH_SHAKE_TIME, 80, 'F- the sequence opens at 80 (Create_0:64)');
  assert(ensureEnding(st).marks.some((m) => m.sprite === SPR.roaringknightSwordBreakPieceSmall),
    'F- THE SWORD SHARD spawns on the A-Side');
  assert(ensureEnding(st).marks.some((m) => m.sprite === SPR.shineWhite),
    'F- ...and the shine marks it');
  assertEq(CLASH_FINISH_TIME, 300, 'F- the parry is at 300 (Step_0:2092)');
}

// ═══ G: THE RNG BUDGET — 8 DRAWS, AND WHERE EACH ONE GOES ══════════════════
console.log('the RNG budget');
{
  const { st, rng0 } = FULL;
  const d = endingDraws(st);
  // THE MEASUREMENT COMES FIRST. `gmlRng.draws` counts every u32 the WELL512
  // generator actually produced between the snapshot in FULL and the terminal
  // state — tallied sites, untallied sites, sites nobody knew about. A tally
  // that counts itself is not a measurement; this is the measurement.
  assertStream(st, rng0, 8,
    'G THE REAL STREAM moved exactly 8 u32 across the whole epilogue');
  // ...and ONLY THEN is the module's bookkeeping compared against it. If these
  // two ever disagree, the module is spending draws it does not admit to (or
  // admitting to draws it does not spend) — the exact desync the byte gate
  // cannot tolerate.
  assertEq(rngSpent(st, rng0), d.clash + d.epilogue + d.fakeout,
    'G ...and the module\'s own tally is that same number, not a parallel fiction');
  assertJson(d, { clash: 2, epilogue: 6, fakeout: 0 },
    'G the whole epilogue spends exactly 8 u32: 2 clash + 6 epilogue');
  // 6 epilogue = 2 (Susie's ouchie) + 2 (Ralsei's) + 2 (the swoon funchance).
  // Each is an irandom_range, which sim/rng.js prices at 2 u32.
  assertEq(ensureEnding(st).ouchies.length, 2, 'G two ouchie numbers were drawn');
  assert(!!ensureEnding(st).swoonRoll, 'G ...and the swoon funchance was rolled');
  assertEq(ensureEnding(st).swoonRoll.cost, 2, 'G   at 2 u32 (irandom_range)');
}
// THE FUNNI SETTING DOES NOT MOVE THE STREAM. `irandom_range(1, n)` is the
// LEFT operand of the `||`, so it is spent either way — which is what makes
// the budget a property of the route and not of a settings file.
{
  const st = mk({ sideb: true, funni: true });
  const rng0 = rngMark(st);
  toHead(st);
  run(st, 4000, (s) => s.kaizo.ending.terminal);
  assertStream(st, rng0, 8,
    'G- Funni ON moves the REAL stream by the same 8 — the settings file cannot shift it');
  assertJson(endingDraws(st), { clash: 2, epilogue: 6, fakeout: 0 },
    'G- Funni ON spends the SAME 8 draws');
  assertEq(ralseiSwoonSprite(st), SWOON_SPRITE,
    'G- ...and Funni forces the 1-in-20 — spr_ralsei_swoon is WORN');
}

// ═══ H: THE OUCHIE NUMBERS ═════════════════════════════════════════════════
{
  const { st } = FULL;
  const [su, ra] = ensureEnding(st).ouchies;
  assertEq(su.who, 'su', 'H the first ouchie is Susie\'s');
  assert(su.damage >= OUCHIE_SUSIE[0] && su.damage <= OUCHIE_SUSIE[1],
    `H   irandom_range(7000, 9000) -> ${su.damage}`);
  assertEq(ra.who, 'ra', 'H the second is Ralsei\'s');
  assert(ra.damage >= OUCHIE_RALSEI[0] && ra.damage <= OUCHIE_RALSEI[1],
    `H   irandom_range(45000, 57500) -> ${ra.damage}`);
  assertEq(su.type, 0, 'H ouchie_display writes type 0 (Create_0:311)');
  assertEq(su.lightb, 255, 'H ...and lightb 255 (:312)');
  assertEq(su.x - ensureEnding(st).actors.su.x >= 0, true,
    'H the writer is offset from the actor, not the room origin');
  // Ralsei's number is an order of magnitude larger than Susie's. That is the
  // mod's joke and it is load-bearing for the scene reading right.
  assert(ra.damage > su.damage * 5, 'H Ralsei\'s number dwarfs Susie\'s');
}

// ═══ I: THE SWOON EASTER EGG — spr_ralsei_swoon FINALLY HAS A CONSUMER ═════
console.log('spr_ralsei_swoon');
{
  // A seed whose funchance(20) MISSES: he wears the ordinary defeat sprite.
  let missed = null;
  for (const seed of [12345, 1, 2, 3, 4, 5, 6, 7]) {
    const st = mk({ sideb: true, seed });
    toHead(st);
    run(st, 4000, (s) => s.kaizo.ending.terminal);
    if (!ensureEnding(st).swoonRoll.hit) { missed = st; break; }
  }
  assert(!!missed, 'I a seed exists where the 1-in-20 misses');
  if (missed) {
    assertEq(ralseiSwoonSprite(missed), DEFEAT_SPRITE,
      'I a MISS leaves him in spr_ralsei_defeat');
  }
  // ...and a seed where it HITS, without the Funni override.
  let hit = null;
  for (let seed = 1; seed < 400 && !hit; seed++) {
    const st = mk({ sideb: true, seed });
    toHead(st);
    run(st, 4000, (s) => s.kaizo.ending.terminal);
    if (ensureEnding(st).swoonRoll.hit) hit = st;
  }
  assert(!!hit, 'I a seed exists where the 1-in-20 HITS on its own');
  if (hit) {
    assertEq(ralseiSwoonSprite(hit), SWOON_SPRITE,
      'I THE EASTER EGG: a natural hit wears spr_ralsei_swoon');
  }
}

// ═══ J: THE d_ex() STALL IS REAL — sb_con 3 BLOCKS ═════════════════════════
console.log('the dialogue stall at sb_con 3');
{
  const st = mk({ sideb: true });
  toHead(st);
  const e = ensureEnding(st);
  // Hand the box over only AFTER the con-50.1 script is done with it — that
  // script's own `c_talk_wait` beats block on the same flag, so taking it from
  // the driver earlier would stall the setup instead of the machine.
  run(st, 4000, (s) => s.kaizo.ending.sbCon === 2);
  e.dialogueAuto = false;            // the driver owns the box from here
  run(st, 4000, (s) => s.kaizo.ending.sbCon === 3);
  assertEq(e.sbCon, 3, 'J reached sb_con 3');
  assert(e.dialogueOpen, 'J ...with the "S-Susie!!!" box still open');
  run(st, 300);
  assertEq(e.sbTimer, 0, 'J THE MACHINE IS PINNED at sb_timer 0 (Step_0:1478-1482)');
  assertEq(e.sbCon, 3, 'J ...and has not advanced');
  e.dialogueOpen = false;            // the player closes it
  const moved = run(st, 400, (s) => s.kaizo.ending.sbTimer > 5);
  assert(moved > 0, 'J closing the box releases the stall — it advances again');
}

// ═══ K: board_ocean.ogg, THE LAST THING THAT HAPPENS ═══════════════════════
{
  const { st } = FULL;
  const m = ensureEnding(st).music.find((x) => x.track === BOARD_OCEAN);
  assert(!!m, 'K board_ocean.ogg is started at sb_con 99');
  if (m) {
    assertEq(m.from, 0, 'K ...at volume 0 (snd_volume(..., 0, 0))');
    assertEq(m.to, BOARD_OCEAN_VOL, 'K ...faded to 0.7');
    assertEq(m.frames, BOARD_OCEAN_FADE, 'K ...over 240 frames (Step_0:1764)');
  }
  const cues = (st.audioCues ?? []).filter((c) => c.name === BOARD_OCEAN);
  assert(cues.length === 1 && cues[0].loop, 'K it is a LOOP, not a one-shot');
}

// ═══ L: THE KNIGHT REAPPEARS BEHIND KRIS ═══════════════════════════════════
{
  const { st } = FULL;
  const kn = ensureEnding(st).actors.knight;
  const kr = ensureEnding(st).actors.kr;
  assert(ensureEnding(st).log.some((t) => t.what === 'sbCon4Gate'),
    'L sb_con 4\'s gate fired — Kris drifted past camerax() - 8');
  assertEq(kn.image_xscale, -2, 'L the Knight is mirrored (image_xscale -2, Step_0:1690)');
  assert(kn.visible, 'L ...and visible again');
  assertEq(typeof FACEAWAY_SPRITE, 'string', 'L the faceaway sprite is named');
  // He is BEHIND him by the end: depth kr - 1 after the sb_timer-166 beat.
  assertEq(kn.depth, (kr.depth ?? 0) - 1, 'L and ends BEHIND Kris (depth kr - 1)');
  // The camera kick really moved the camera.
  assertEq(ensureEnding(st).camX, 2400 + CAM_KICK,
    'L the -160 camera kick landed (Step_0:1278)');
  // `endingReport` is the one-read surface a HUD or a driver would use. It
  // gets an assertion for the same reason every other export does: this
  // repo's signature defect is a value computed correctly and written where
  // nothing reads it, and an unread reporter is that defect with a nicer name.
  const rep = endingReport(st);
  assertEq(rep.sideb, true, 'L the report knows it is the B-Side');
  assertEq(rep.terminal, true, 'L ...that the epilogue ended');
  assertEq(rep.resumedAtCon, null, 'L ...and that nothing resumed');
  assertEq(rep.sbCon, SB_TERMINAL, 'L ...parked at sb_con 99');
  assertEq(rep.ouchies, 2, 'L ...with both ouchie numbers on the board');
  assertEq(rep.ralseiSprite, ralseiSwoonSprite(st), 'L ...agreeing with the sprite read');
}

// ═══ M: DETERMINISM ════════════════════════════════════════════════════════
{
  const fingerprint = (seed) => {
    const st = mk({ sideb: true, seed });
    toHead(st);
    run(st, 4000, (s) => s.kaizo.ending.terminal);
    const e = ensureEnding(st);
    return JSON.stringify({
      log: e.log, draws: e.draws, ouchies: e.ouchies.map((o) => o.damage),
      swoon: e.swoonRoll.hit,
    });
  };
  const a = fingerprint(12345);
  assertEq(fingerprint(12345), a, 'M same seed: byte-identical epilogue');
  assert(fingerprint(54321) !== a, 'M different seed: different run (non-vacuous)');
}

// ═══ N: THE ALARMS ARE ALARMS ══════════════════════════════════════════════
{
  const st = mk({ sideb: true });
  spawnEndingActors(st);
  const su = ensureEnding(st).actors.su;
  su.hspeed = 99;
  scrVarDelay(st, su, 'hspeed', -10, 3);
  assertEq(pendingEndingDelays(st).length, 1, 'N scr_var_delay armed a real instance');
  stepFrame(st, IDLE);
  stepFrame(st, IDLE);
  assertEq(su.hspeed, 99, 'N ...which has NOT fired after two frames');
  stepFrame(st, IDLE);
  assertEq(su.hspeed, -10, 'N and lands on frame N + 3 exactly (CLAUDE.md rule 5)');
  assertEq(pendingEndingDelays(st).length, 0, 'N ...then destroys itself');
}

// ═══ O: THE ROUTE REGISTRY AGREES WITH THE FORK ════════════════════════════
{
  assertEq(kaizoEndingRouteFor('D'), 'bside', 'O version D ends on the B-Side epilogue');
  assertEq(kaizoEndingRouteFor('C'), 'aside', 'O version C ends on the A-Side knighting');
  assertEq(kaizoEndingRouteFor('A'), 'aside', 'O the invented remix keeps the A-Side');
  const stD = createState({ seed: 1, traceBulletSlots: 0 });
  buildKaizoScene(stD, { version: 'D' });
  assertEq(stD.kaizo.flag[FLAG_WEIRD_ROUTE], 1,
    'O buildKaizoScene(D) stamps global.flag[456] = 1 for the fork');
  assertEq(ptb02Con8(stD).route, 'loss',
    'O ...and with no win latched, the fork honestly says "loss"');
  const stC = createState({ seed: 1, traceBulletSlots: 0 });
  buildKaizoScene(stC, { version: 'C' });
  assertEq(stC.kaizo.flag[FLAG_WEIRD_ROUTE], 0, 'O buildKaizoScene(C) stamps flag[456] = 0');
}

// ═══ P: THE APPROXIMATION LEDGER IS HONEST ═════════════════════════════════
{
  const st = mk();
  const approx = endingApprox(st);
  assert(approx.length >= 5, `P the ledger names what is stood in for (${approx.length} rows)`);
  assert(approx.every((r) => r.what && r.stand_in && r.gml), 'P every row is complete');
  assert(approx.some((r) => /INVENTED/.test(r.what)),
    'P the one invented number is labelled INVENTED (CLAUDE.md law 4)');
  assertEq(approx.length, ENDING_APPROX.length, 'P the report matches the table');
  if (existsSync(DUMP)) {
    const cited = approx.map((r) => r.gml.split(':')[0]).filter((f) => f.endsWith('.gml'));
    const missing = cited.filter((f) => !existsSync(join(DUMP, f)));
    assertJson(missing, [], 'P every GML file the ledger cites is real');
  } else {
    console.log('  --  (dump absent — the GML-citation assertion is skipped)');
  }
}


// ═══ Q: EVERY EXPORT HAS A READER ══════════════════════════════════════════
//
// THE REPO'S SIGNATURE DEFECT, at seven occurrences and counting, is a value
// computed correctly and written where NOTHING reads it — the last one found
// by a player. A module this size can grow one silently, so every constant and
// every entry point it publishes is exercised here, and the numbers are
// checked against the dump lines they came from rather than against
// themselves.
console.log('the published surface');
{
  // The constants, each with its dump line.
  assertEq(CAM_X, 2230, "Q camerax() at the epilogue's open");
  assertEq(CLASH_CAM_X, 2400, "Q c_pan(2400, 0, 30) — Susie's advance (Step_0:1222)");
  assertEq(CAM_KICK, -160, 'Q the camera kick is -160 (Step_0:1278)');
  assertEq(CAM_KICK_FRAMES, 20, 'Q ...over 20 frames');
  assertEq(CAM_KICK_RELEASE, 21, 'Q ...released one frame later (scr_var_delay, :1279)');
  assertEq(CLASH_SHAKE_STEP, 10, 'Q the shake interval steps down by 10 (Step_0:2041)');
  assertEq(CLASH_SHAKE_FLOOR, 30, 'Q ...and the sequence ends at <= 30 (:2042)');
  assertEq(SWOON_CHANCE, 20, 'Q the swoon egg is kaizo_funchance(20) (Step_0:1640)');
  assertEq(SLASH_SPRITE, SPR.rkQuickslash, 'Q the slash marker is spr_rk_quickslash (:1358)');
  assertJson(SLASH_OFFSET, [40, 216], 'Q ...offset lengthdir(40, 216) (:1363-1364)');
  assertJson(SUSIE_LAUNCH, [150, 140, 216],
    'Q Susie is launched lengthdir(150 on x, 140 on y, 216) — the lengths DIFFER (:1404-1405)');
  assertJson(CLASH_OVERLAY_DEFAULT, [8, 1], 'Q show_clash_overlay defaults (Create_0:289)');
  assertJson(CLASH_OVERLAY_HALF, [8, 0.5], 'Q ...and the (8, 0.5) every other site passes');
  assertEq(WARP_SETTLE, 95, 'Q the warp settle, inherited from sim/victory-scene.js');
  assertEq(ENDING_DIALOGUE_FRAMES, 90, 'Q the invented dialogue lifetime');

  // ── THE LADDER NUMBERS, PINNED TO LITERALS ──────────────────────────────
  //
  // THE SHAPE THIS BLOCK EXISTS TO KILL: a constant that DRIVES the machine
  // and is ALSO the expected value. `SB_TERMINAL_AT` was exactly that —
  // kaizo-ending.js:1764 branches on it and section E asserted
  // `sbTimer === SB_TERMINAL_AT`, so a review's `555 -> 556` mutation moved
  // both sides together and neither check noticed. "The machine parks where
  // the machine says it parks" is not an assertion about the mod.
  //
  // Every constant below was AUDITED for that shape and pinned to the literal
  // its dump line reads, so a mutation has something outside itself to fail
  // against. The audit's findings are recorded at each line.
  //
  // THE ONE THE REVIEW FOUND — driver + expectation, nothing else in reach:
  assertEq(SB_TERMINAL_AT, 555,
    'Q sb_con 99 is entered at sb_timer 555 (Step_0:1762)');
  // ...and its partner, which had the identical shape and was never mutated:
  // the machine assigns SB_TERMINAL (:1765) and sections E and L expect
  // SB_TERMINAL. Renumber the terminal state and every assertion follows it.
  assertEq(SB_TERMINAL, 99, 'Q ...and the terminal sb_con is 99 (Step_0:1764)');
  // SAME SHAPE, but caught INDIRECTLY today: the machine breaks the clash on
  // SB_CLASH_BREAK (:1400) and section E expects `SB_CLASH_BREAK - 1`. A
  // mutation is caught only because a longer window also changes the pulse
  // COUNT (section F's 2). Pinned so it is caught directly.
  assertEq(SB_CLASH_BREAK, 124, 'Q the clash breaks at sb_timer 124 (Step_0:1256)');
  // SAME SHAPE: section F- asserts `susieKnightSlashTimer === the constant +
  // 20`, against a machine driven by the same constant.
  assertEq(CLASH_JUMP_BACK_TIME, 320,
    'Q _jump_back_time = _susie_finish_time + 20 (Step_0:2096)');
  assertEq(CLASH_FINISH_TIME, 300, 'Q _susie_finish_time = 300 (Step_0:2095)');
  assertEq(CLASH_SHAKE_TIME, 80, 'Q the shake sequence opens at 80 (Create_0:64)');
  // SAME SHAPE: section H bounds each ouchie by the constant that generated
  // it, so a wrong range is self-consistent and invisible.
  assertJson(OUCHIE_SUSIE, [7000, 9000],
    'Q irandom_range(7000, 9000) — Susie\'s ouchie (Step_0:1417)');
  assertJson(OUCHIE_RALSEI, [45000, 57500],
    'Q irandom_range(45000, 57500) — Ralsei\'s (Step_0:1609)');
  // SAME SHAPE: section K reads the fade back out of the record the constants
  // wrote.
  assertEq(BOARD_OCEAN_VOL, 0.7, 'Q snd_volume(..., 0.7, 240) (Step_0:1768)');
  assertEq(BOARD_OCEAN_FADE, 240, 'Q ...over 240 frames (Step_0:1768)');
  // SAME SHAPE: sections A and B assert the fork's `con` against the same
  // constants the fork returns. 49/49.1 are pinned a second way by section C
  // (the alarm's `con++` lands on literal 50/50.1), 9 was not pinned at all.
  assertEq(CON_VICTORY, 49, 'Q the A-Side win is con 49 (Step_0:616)');
  assertEq(CON_VICTORY_SIDEB, 49.1, 'Q ...and the Weird Route win is 49.1 (Step_0:618)');
  assertEq(CON_LOSS, 9, 'Q ...and a loss is con 9');
  assertEq(ASIDE_RESUMES_AT_CON, 10, 'Q the A-Side resumes the story at con 10');
  // SAME SHAPE: sections B and O index `state.kaizo.flag` with the very
  // constants the producers write, so a renumbered flag agrees with itself.
  assertEq(FLAG_WEIRD_ROUTE, 456, 'Q global.flag[456] is Snowgrave (Create_0:115)');
  assertEq(FLAG_KNIGHT_OUTCOME, 50, 'Q global.flag[50] is the kill tally (Step_0:613)');
  assertEq(FLAG_KNIGHT_VIOLENCED, 51, 'Q global.flag[51] is the latch (Step_0:1332)');
  // AUDIT RESULT, for the record: CAM_X, CLASH_CAM_X, CAM_KICK,
  // CAM_KICK_FRAMES, CAM_KICK_RELEASE, CLASH_SHAKE_STEP, CLASH_SHAKE_FLOOR,
  // SWOON_CHANCE, SLASH_OFFSET, SUSIE_LAUNCH, CLASH_OVERLAY_*, WARP_SETTLE,
  // ENDING_DIALOGUE_FRAMES and CON_ALARM_FRAMES (section C) were ALREADY
  // pinned to literals above. Every remaining number this module publishes is
  // now pinned exactly once, to a literal, with the dump line it came from.
  assertEq(ENDING_SPRITES.length, Object.values(SPR).length,
    'Q ENDING_SPRITES is the flat SPR table');
  assertJson(endingSprites(), ENDING_SPRITES, 'Q ...and endingSprites() returns it');
  assert(SB_SETUP_SCRIPT.length > 20, 'Q the con-50.1 beat list is published');
  assert(SB_SETUP_SCRIPT.some((b) => b[0] === 'init'), 'Q ...and opens with the sb_* init');
  assert(SB_SETUP_SCRIPT.some((b) => b[0] === 'var' && b[1] === 'sbCon' && b[2] === 1),
    'Q ...and ends by arming sb_con = 1 (Step_0:1244)');
  assert(SB_SETUP_SCRIPT.some((b) => b[0] === 'var' && b[1] === 'susieKnightSlash'),
    'Q ...one beat after susie_knight_slash — the lockstep (Step_0:1243)');

  // The entity types.
  assertEq(endingActor.name, 'kaizo_ending_actor', 'Q the actor type is named');
  assertEq(endingMarker.name, 'obj_marker', 'Q the marker type is obj_marker');
  assertEq(endingDoom.name, 'obj_doom', 'Q the doom type is obj_doom');
  assertEq(endingDelay.name, 'obj_script_delayed', 'Q the delay type is obj_script_delayed');

  // scr_doom really destroys, on a real alarm.
  {
    const st = mk({ sideb: true });
    spawnEndingActors(st);
    const victim = ensureEnding(st).actors.su;
    scrDoom(st, victim, 3);
    stepFrame(st, IDLE); stepFrame(st, IDLE);
    assert(victim.alive, 'Q scr_doom has not fired after two frames');
    stepFrame(st, IDLE);
    assert(!victim.alive, 'Q ...and destroys its target on frame N + 3 exactly');
  }

  // The per-handler entry points are all callable on their own, which is what
  // a driver that owns its own event order needs.
  {
    const st = mk({ sideb: true });
    spawnEndingActors(st);
    spawnEndingKnight(st);
    assertEq(stepSbEpilogue(st), false, 'Q stepSbEpilogue is a no-op before con 50.1');
    assertEq(stepSwoonTarget(st), false, 'Q stepSwoonTarget is a no-op with no target');
    assertEq(stepBigShake(st), false, 'Q stepBigShake is a no-op unarmed');
    assertEq(stepSusieKnightSlash(st), false, 'Q stepSusieKnightSlash is a no-op unarmed');
    assertEq(stepEndingScript(st), false, 'Q stepEndingScript is a no-op with no script');
    // ...and each one DOES something when armed (the non-vacuous half).
    const e = ensureEnding(st);
    e.swoonTarget = e.actors.ra;
    assertEq(stepSwoonTarget(st), true, 'Q- ...and fires with a target');
    assertEq(e.swoons.length, 1, 'Q- writing the SWOON (Create_0:280-287)');
    e.bigShake = true;
    assertEq(stepBigShake(st), true, 'Q- big_shake fires when armed');
    assertEq(e.shakes[0].shakex, 10, 'Q- obj_shake at shakex 10 (Step_0:1986)');
    assertEq(e.shakes[0].shakesign, 2, 'Q- ...shakesign 2, a MULTIPLIER (:1988)');
    e.susieKnightSlash = true;
    assertEq(stepSusieKnightSlash(st), true, 'Q- the clash runs when armed');
    assertEq(e.susieKnightSlashTimer, 1, 'Q- ...and its timer ticks');
  }

  // endingFunchance is the wrapper over kaizo/party/freeze.js's translation —
  // ONE copy of `kaizo_funchance`, with this scene's draw accounting on top.
  {
    const st = mk({ sideb: true, funni: true });
    const rng0 = rngMark(st);
    const r = endingFunchance(st, 20, 'epilogue');
    assertEq(r.hit, true, 'Q endingFunchance honours Funni');
    assertEq(r.cost, 2, 'Q ...and prices the roll at 2 u32');
    assertEq(r.n, 20, 'Q ...and reports which bound it rolled against');
    assertEq(endingDraws(st).epilogue, 2, 'Q ...into the epilogue bucket');
    // THE PRICE IS A MEASUREMENT. `cost` and the bucket are both the module's
    // own arithmetic; this is the generator's. One call, one irandom_range,
    // two real u32 — a second draw smuggled in here (the review's injection)
    // fails on this line and on nothing else in the block.
    assertStream(st, rng0, 2,
      'Q ...and it really spends exactly 2 u32 off the stream, no more');
  }
}

// ═══ S: THE SPRITE GAP, ASSERTED BY NAME ═══════════════════════════════════
//
// See the SPR table's header in kaizo/scenes/kaizo-ending.js: most of this
// epilogue's art is not in either pack, check-sprites cannot see it because
// the names are carried as data, and THIS is where the gap is stated. It is
// asserted in BOTH directions so it cannot drift silently: a name that starts
// resolving (someone packed it) fails here just as loudly as one that stops.
console.log('the sprite gap');
{
  const mainPack = JSON.parse(readFileSync(join(repo, 'assets', 'sprites', 'manifest.json'), 'utf8'));
  const overlayPath = join(repo, 'kaizo', 'assets', 'sprites', 'manifest.json');
  const overlay = existsSync(overlayPath) ? JSON.parse(readFileSync(overlayPath, 'utf8')) : {};
  const resolvable = new Set([...Object.keys(mainPack), ...Object.keys(overlay)]);
  const names = Object.values(SPR);
  const unpacked = names.filter((n) => !resolvable.has(n)).sort();
  const packed = names.filter((n) => resolvable.has(n)).sort();
  assert(packed.length > 0, `S some of the epilogue's art IS packed (${packed.length})`);
  assert(resolvable.has(SWOON_SPRITE),
    'S spr_ralsei_swoon is packed — the easter egg can actually be drawn');
  assert(resolvable.has(SPR.rkQuickslash), 'S so is the slash marker');
  assert(resolvable.has(SPR.fxHitback), 'S ...and the clash flash');
  console.log(`  --  ${unpacked.length} of ${names.length} epilogue sprites are NOT packed`);
  if (unpacked.length) console.log(`  --  ${unpacked.join(' ')}`);
  // PINNED IN BOTH DIRECTIONS. A name that starts resolving (someone added it
  // to WANT and repacked) fails here just as loudly as one that stops — which
  // is the point: this list is the work order, and it has to be edited on
  // purpose. It is empty now; see UNPACKED_SPRITES for why that is still an
  // assertion and not a hole.
  assertJson(unpacked, UNPACKED_SPRITES,
    'S the unpacked set is exactly what the packer WANT list still needs');
  // The literal, not `UNPACKED_SPRITES.length` — a count that reads its own
  // expectation off the list it is checking would be the same self-referential
  // shape section Q's pins exist to kill.
  assertEq(unpacked.length, 0,
    'S ...and none of them: the epilogue\'s whole SPR table now resolves');
  // THE NON-VACUOUS HALF, so the empty expectation can never mean "nothing was
  // looked at": every name in the table must be in a pack, and there must be a
  // real number of them.
  assertEq(packed.length, names.length, 'S every epilogue sprite resolves in one of the packs');
  assertEq(names.length, 36, 'S ...and the SPR table is 36 names (kaizo-ending.js SPR)');
}

console.log('');
if (SABOTAGE) {
  console.log('--sabotage: the clash shake interval was raised past the 124-frame cut, '
    + 'so no pulse can fire.');
  console.log(`check-sideb-ending --sabotage: ${failures} assertion(s) caught it `
    + `(of ${checks}); a 0 here would mean the pulse and draw assertions are decorative.`);
  process.exit(failures > 0 ? 1 : 2);
}
console.log(`check-sideb-ending: ${checks - failures}/${checks} assertions passed`);
if (failures) {
  console.log(`check-sideb-ending: ${failures} FAILING`);
  process.exit(1);
}
