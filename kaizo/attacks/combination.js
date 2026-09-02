// KAIZO obj_knight_combinations — THE COMBINATION CHAIN, dc type 105.
// V-C recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// WHAT THIS CLOSES. The V-C launcher runs type 105 through the verified
// `sim/attacks/combination.js`, whose segment order is a module constant
// (4 -> 2 -> 3, the Knight's Create defaults). The mod dispatches the object
// TWICE with two different orders, so the launcher has been ledgering
//
//     asked: combination 1-2-5   used: vanilla 4-2-3 chain
//     why:   segment order not parameterized yet
//
// on every Frenzy 3. Here the order is an ARGUMENT.
//
// ── PROVENANCE ────────────────────────────────────────────────────────────
//
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_knight_combinations_Create_0.gml       (5 lines)
//     gml_Object_obj_knight_combinations_Other_10.gml       (58)
//     gml_Object_obj_knight_combinations_Destroy_0.gml      (1)
//     gml_Object_obj_knight_enemy_Other_23.gml:283-291      (ac 7,   4-2-3)
//     gml_Object_obj_knight_enemy_Other_23.gml:553-563      (ac 106, 1-2-5)
//     gml_Object_obj_knight_enemy_Other_23.gml:969-977      (side B, ac 7)
//     gml_Object_obj_knight_enemy_Other_23.gml:1247-1257    (side B, ac 106)
//     gml_Object_obj_roaringknight_quickslash_attack_Step_0.gml:60-148
//     gml_Object_obj_knight_rotating_slash_Step_0.gml:64-196, Alarm_2
//     gml_Object_obj_knight_weird_bottom_manager_Step_0.gml:21-50, Alarm_2
//     gml_Object_obj_knight_swordfall_Alarm_3.gml
//     gml_GlobalScript_scr_bullet_inherit.gml
//
// **`obj_knight_combinations` IS BYTE-IDENTICAL TO VANILLA v1.05.** All three
// of its code entries diff clean against `gml_vanilla_v105/CodeEntries/`,
// same decompiler, same run. That settles `deltas/INDEX.md` open question 4
// ("obj_knight_combinations has no delta spec — presumed byte-identical"):
// presumed, now measured. The mod changes the combination by changing the
// KNIGHT'S FIELDS at dispatch, not the object.
//
// ── THE TWO ORDERS, and where they come from ──────────────────────────────
//
// The Knight's Create still says `first_attack = 4; second_attack = 2;
// third_attack = 3; combo_power = 1` (kaizo Create_0:18-21, unchanged), but
// the mod's dispatch OVERWRITES all three immediately before every
// `scr_bulletspawner` call for type 105:
//
//     myattackchoice == 7    -> 4, 2, 3   "Frenzy 1"  (phase 1)
//     myattackchoice == 106  -> 1, 2, 5   "Frenzy 3"  (phase 3, + dc.damage
//                                          80, invc 0.4, scr_turntimer(480))
//
// and the two side-B arms of Other_23 repeat both blocks verbatim. So the
// chains are:
//
//     ac 7    swordfall -> rotating slash -> sword tunnel (revised)
//     ac 106  QUICKSLASH -> rotating slash -> UNDERBOX
//
// Sub-attacks 1 and 5 are the dormant vanilla branches CLAUDE.md describes:
// the switch in Other_10 has had cases for them since v1.05, and vanilla's
// fixed 4-2-3 meant nothing ever took them. `deltas/INDEX.md` item 13 is the
// work item this file answers.
//
// ── INDEX ITEM 13's SWORDFALL-d5 HYPOTHESIS: DISPROVED ────────────────────
//
// The item reads: "translate its dormant sub-attacks 1 and 5 … (suspected
// home of swordfall d5 / vortex variant-4 coexistence)", and open question 5
// lists swordfall d5 among the "undispatched configured difficulties". Three
// greps settle it, and the answer is no:
//
//   1. **Sub-attack 5 is not swordfall.** Other_10's switch maps 5 to
//      `obj_knight_weird_bottom_manager` — the UNDERBOX. Swordfall is
//      sub-attack 4, and the object-index tables in every handoff site agree
//      (630 = swordfall, 1173 = weird_bottom_manager; vanilla 1175/1175
//      renumbered by the mod's added objects).
//   2. **A chained swordfall is difficulty 0 regardless.** Its Create sets
//      `difficulty = 0` and the ONLY thing a chain hands a successor is
//      `scr_bullet_inherit`, which copies damage / grazepoints / timepoints /
//      inv / target / grazed / grazetimer / element — and not `difficulty`
//      (gml_GlobalScript_scr_bullet_inherit.gml, read in full). Nothing in
//      any handoff block writes `difficulty` either.
//   3. **Neither order contains 4 and 5 together anyway.** 4-2-3 has no
//      underbox; 1-2-5 has no swordfall.
//
// So swordfall d5 is NOT reachable through the combination, and
// `kaizo/attacks/swordfall.js`'s d5 branch cannot simply be chained — it
// stays what INDEX open question 5 already calls it, configured-but-
// undispatched content. `dc.difficulty` is the only writer of a swordfall's
// difficulty, and only `obj_dbulletcontroller` type 108 sets that. Recorded
// here so the hypothesis is not re-opened on the same evidence.
//
// ── THE SHUFFLE IS STILL DEAD, AND STILL COSTS 64 DRAWS ───────────────────
//
// Other_10 builds [2,3,4,5], shuffles it, derives all three segments from the
// result, de-dupes twice — and then overwrites all three from
// `obj_knight_enemy`'s fields. CLAUDE.md's `ds_list_shuffle` section is about
// this exact object, and its conclusion holds unchanged in the mod because
// the object is unchanged: the permutation is discarded, the DRAWS are not.
// `gmlShuffle` burns the measured 16 u32 draws per element (four elements,
// 64 draws) and then runs its own Fisher-Yates over the list, which costs
// n-1 more — 67 in total for this call, and check-combination's T3 pins that
// number rather than the headline 64, because 67 is what the shared helper
// actually takes off the stream and the sim module's identical call takes
// exactly the same. The result is discarded exactly as the game does; the
// draws are what keep anything downstream aligned.
//
// The two de-dupe guards are dead twice over — they test for attack 1, which
// a list built from 2, 3, 4 and 5 never contains — and that stays true under
// the mod even though the mod's own order NOW STARTS WITH 1: the guards read
// the SHUFFLED LIST, not the knight's fields.
//
// ── ISOLATION: WHY THIS FILE HAS ITS OWN REGISTRY ─────────────────────────
//
// `sim/attacks/combination.js` keeps a module-level `COMBO_ATTACKS` that the
// sim's own attacks populate with `registerComboAttack`. Every kaizo module
// deliberately refuses to call it — rotating-slash.js, swordfall.js and
// underbox.js each carry the note — because the registry is a shared global
// and overwriting an entry would hand the SIM's SINGLE-mode combination a
// kaizo module. So this file keeps `KAIZO_COMBO_ATTACKS`, a separate table,
// and imports the kaizo modules directly. Nothing here writes to the sim's
// registry, and check-combination's T9 asserts that by identity — importing
// this module must leave `COMBO_ATTACKS[2].type === sim rotatingSlash`.
//
// Import direction stays one-way (kaizo -> sim). There is no cycle: the five
// kaizo segment modules import from sim/, never from here, which is exactly
// the loop the sim module's registry exists to break — and the reason the
// sim's version could not simply hold direct references.
//
// ── HOW THE HANDOFF SITES REACH THIS FILE: A HOOK, NOT AN IMPORT ──────────
//
// THE TRAP, and it is already documented in the sim module's header: this
// file imports quickslash.js / rotating-slash.js / sword-tunnel-revised.js /
// swordfall.js / underbox.js so `KAIZO_COMBO_ATTACKS` can hold direct
// references. If any of those five then imported `kaizoChainNext` from here,
// the cycle would put the registry literal in the temporal dead zone the
// moment a segment module was evaluated first — "Cannot access
// 'quickslashAttack' before initialization". The sim's registry exists
// precisely to break that loop.
//
// So the wiring goes the other way, through the seam the vortex handoff
// already uses (`state.kaizo.hooks.vortexendHandoff`, passed by
// buildKaizoScene): `state.kaizo.hooks.comboChainNext = kaizoChainNext`, and
// each handoff site calls the hook if it is there and ledgers if it is not.
// No segment module imports this one, the cycle never forms, and a build
// with no hook degrades to exactly the behaviour those sites have today.
//
// ── LEG 2 IS BUILT AND LIVE. LEG 1 IS ONE LAUNCHER LINE ───────────────────
//
// `KAIZO_COMBO_ATTACKS` being five-for-five kaizo modules was only half of
// "the combination runs the mod's bodies". The other half is routing, and it
// has two legs. Driving `launchKaizoCombination(state, kaizoComboOrderFor(7))`
// on a fight-shaped bench and reading back each created segment's `type` BY
// IDENTITY used to give:
//
//     f0    obj_knight_swordfall                  -> KAIZO   (this table)
//     f35   obj_knight_rotating_slash             -> SIM
//     f105  obj_knight_tunnel_slasher_2_revised   -> SIM
//
//   LEG 2 — DONE, 2026-08-29. Every kaizo segment module ended its handoff
//   with the SIM's `chainNext`, which resolves successors from the SIM's
//   `COMBO_ATTACKS` — a registry only sim/ modules ever write, because
//   kaizo/HANDOFF.md §2.1 forbids the kaizo copies from touching a shared
//   global. So segment 1 came from this table and every segment after it came
//   from the sim's, whatever this table said, and `kaizoChainNext` had ZERO
//   callers. It now has three: `sim/attacks/combination.js` `chainNext` takes
//   an optional SITE NAME and, when one is given AND
//   `state.kaizo.hooks.comboChainNext` is set, forwards the whole handoff
//   here. kaizo swordfall Alarm_3 passes 'swordfall_alarm3', kaizo
//   rotating-slash Alarm_2 passes 'rotating_alarm2', kaizo
//   sword-tunnel-revised passes 'tunnel_alarm2' / 'tunnel_step'. A call with
//   no site name — every call inside sim/ — is never redirected, so the seam
//   cannot half-convert a vanilla chain.
//
//   LEG 1 — kaizo-mod-launcher.js `case 105:` is still
//   `return launchCombination(state)`, the vanilla module with its
//   module-level 4-2-3 order, so `KAIZO_COMBO_ORDERS` and this registry stay
//   unreached in a shipped build and the launcher still ledgers the vanilla
//   body. The edit is named in the integration report; it is not this file's
//   to make, and it is the ONLY thing left between the ledger and empty for
//   ac 7.
//
// The hook is per STATE, never per process, which is what keeps T9's
// isolation intact: importing this module still leaves the sim's shared
// registry pointing at sim modules, and a scene that never sets the hook runs
// the vanilla chain byte for byte.
//
// ── WHAT LEG 1 WILL AND WILL NOT CLOSE, SAID PLAINLY ──────────────────────
//
//   ac 7 (atk_Frenzy1, 4-2-3) closes completely: swordfall -> rotating slash
//   -> revised tunnel, every handoff in a module that names its site.
//
//   ac 106 (atk_Frenzy3, 1-2-5) does NOT. Segment 1 is the quickslash, and
//   kaizo/attacks/quickslash.js's turn-end fork (Step_0:57-151) still
//   LEDGERS its handoff — "controller frozen, no follow-up spawned" — instead
//   of calling anything, and that file is outside this work item. So the
//   launcher edit trades one ledger row for another there, and worse: the
//   quickslash freezes at local_turntimer 99999 under a clock this launcher
//   pinned at 999999, so nothing hands the turn back. `quickslash_step` below
//   is the transcribed site that fork needs; the one-line change is
//   `kaizoChainNext(state, e, 'quickslash_step')` in place of that ledger
//   call. Landing leg 1 before it is a HANG, not a cosmetic gap.
//
// ── WHAT IS APPROXIMATED (ledgered at the point of use) ───────────────────
//
//   * the chained arms of `obj_knight_weird_bottom_manager`'s Other_10. Its
//     kaizo module implements only the "full" arm (kaizo/attacks/underbox.js
//     `init`), so this file carries the remaining arms from
//     gml_Object_obj_knight_weird_bottom_manager_Other_10.gml:34-56 in
//     `CHAINED_ARMS` — a translation of that event's missing half, living
//     where the chain needs it, labelled, and deletable the day underbox.js
//     grows them.
//
//   * THE OVERLAP. Every handoff this file drives happens when the outgoing
//     segment DIES, because that is where the modules call it from — an
//     alarm, or the tunnel's own mid-Step block. The mod also hands on
//     MID-PATTERN from obj_knight_rotating_slash's Step_0:64-196 (next_up 1 at
//     local_turntimer < 240, 3 at < 220, 4 and 5 at < turn_limit_4), so the
//     successor plays over the outgoing slash for tens of frames.
//     `rotating_step` below is the transcription of those four blocks and
//     NOTHING CALLS IT: kaizo/attacks/rotating-slash.js carries only Alarm_2,
//     so the sim's segment 3 starts late. The consequence is measured and
//     printed rather than assumed — check-oracle-weird reports atk_Frenzy1's
//     segment-3 bullets as mod 28 / sim 20 on route C and NOTEs the overlap on
//     both routes. Not ledgered, because it is a timing shortfall inside a
//     translated body rather than a vanilla body standing in, and the ledger's
//     one job is the latter.
//
// SUITE: kaizo/tools/checks/check-combination.mjs.

import { spawn } from '../../sim/entity.js';
import { gmlShuffle } from '../../sim/rng.js';
import { cue } from '../../sim/audio.js';
import { knightWarp, knightWarpIn, knightWarpOut } from '../../sim/fx.js';
// ── the four KAIZO segment modules ────────────────────────────────────────
import { quickslashAttack } from './quickslash.js';
import { rotatingSlash } from './rotating-slash.js';
import { knightSwordfall } from './swordfall.js';
import { weirdBottomManager } from './underbox.js';
// SEGMENT 3 IS NOW THE KAIZO MODULE — swapped 2026-08-29, and this is the
// import that used to read `../../sim/attacks/sword-tunnel-revised.js`.
//
// WHAT WAS WRONG. The sim copy's blade spawner writes `b.vspeed = drift` onto
// a PLAIN JS PROPERTY. GameMaker stores speed/direction and DERIVES
// hspeed/vspeed, so in the original that line rotates the blade off its
// heading; in the sim nothing ever reads the property back and every blade
// keeps the `scr_fire_bullet(..., 180, 0.5)` heading it was born with. The
// kaizo copy fixes it (`setVspeed` / `setComponents`, its own header names the
// defect) along with the mod's ten Step/Create/Draw deltas.
//
// WHAT THE RECORDING MEASURED. `kaizo_oracle_seq_deep.csv`, grouped by
// kaizo_playing == atk_Frenzy1: the mod's segment-3
// obj_knight_diamondswordbullet_ext carry 17 DISTINCT directions spanning
// 138.61..243.85 on route C, and `_sideb` gives 23 spanning 137.65..246.03 —
// against the sim module's single flat 180.0000000000. Same fan the tunnel
// module's own check measured on atk_Tunnel2 (real blades -0.374..0.582 of
// vspeed, decoys -0.700..1.684); the combination reaches the same object
// through a different door.
//
// The previous round backed this swap out because check-combination's T6
// asserted the OLD truth — that segment 3 is 'sim' and that the substitution
// is ledgered — and the integration pass rightly declined to edit an
// assertion to fit its own change. T6 now asserts the new truth by identity
// (`KAIZO_COMBO_ATTACKS[3].type === tunnelSlasher2` from kaizo/attacks/) and
// that NO ledger row is written for it, because there is no longer anything
// to confess. See that block's header note.
//
// STILL NOT SHIPPED, and the reason is routing, not this table: see
// "WHAT REACHES THIS FILE TODAY" below.
import { tunnelSlasher2 } from './sword-tunnel-revised.js';

/**
 * Other_10's `switch (first_attack)` — id -> object, with the mod's own
 * object indices from the handoff tables (kaizo values; the vanilla dump's
 * 367/672/806/1175 are the same objects, renumbered by the mod's additions).
 *
 * `source` is the honesty column: 'kaizo' means the mod's translated copy,
 * 'sim' means the verified vanilla module standing in because no kaizo copy
 * exists yet. EVERY ROW IS 'kaizo' AS OF 2026-08-29 — segment 3 was the last
 * 'sim' one. The column stays because `kaizoChainNext` and
 * `launchKaizoCombination` still ledger on it, and a future sixth segment
 * would arrive that way; it is not dead, it is currently unexercised, and
 * check-combination's T6 asserts the ledger stays EMPTY for segment 3 rather
 * than deleting the branch that writes it.
 */
export const KAIZO_COMBO_ATTACKS = {
  1: {
    name: 'obj_roaringknight_quickslash_attack',
    objectIndex: 366,
    type: quickslashAttack,
    source: 'kaizo',
  },
  2: {
    name: 'obj_knight_rotating_slash',
    objectIndex: 669,
    type: rotatingSlash,
    source: 'kaizo',
  },
  3: {
    name: 'obj_knight_tunnel_slasher_2_revised',
    objectIndex: 802,
    type: tunnelSlasher2,
    source: 'kaizo',
  },
  4: {
    name: 'obj_knight_swordfall',
    objectIndex: 630,
    type: knightSwordfall,
    source: 'kaizo',
  },
  5: {
    name: 'obj_knight_weird_bottom_manager',
    objectIndex: 1173,
    type: weirdBottomManager,
    source: 'kaizo',
  },
};

/**
 * The mod's two dispatched orders, Other_23 verbatim. `power` is
 * `combo_power`, which the Knight's Create sets to 1 and nothing in either
 * dump ever changes — so both chains take the THREE-segment "short" form
 * (composition 1 => turn_type "short start", turn_segment 0).
 *
 * Keyed by `myattackchoice` so the launcher can look one up by row.
 */
export const KAIZO_COMBO_ORDERS = {
  7: { first: 4, second: 2, third: 3, power: 1 },   // Frenzy 1, Other_23:285-287
  106: { first: 1, second: 2, third: 5, power: 1 }, // Frenzy 3, Other_23:555-557
};

/** The Knight's Create defaults, which are also ac 7's order — kept separate
 *  from the table above so "the dispatch overwrote these" stays legible. */
export const KAIZO_COMBO_CREATE_DEFAULTS = {
  first: 4, second: 2, third: 3, power: 1,
};

/** Look one up by attack choice; falls back to the Knight's Create defaults,
 *  which is what a dispatch that forgot to write the fields would get. */
export function kaizoComboOrderFor(ac) {
  return KAIZO_COMBO_ORDERS[ac] ?? KAIZO_COMBO_CREATE_DEFAULTS;
}

/** Naming, for HUD labels and for the suites. */
export function kaizoComboSequence(order) {
  return [order.first, order.second, order.third]
    .map((id) => KAIZO_COMBO_ATTACKS[id]?.name ?? `#${id}`);
}

/** The approx ledger — same shape kaizo-mod-launcher.js writes. */
function ledger(state, entry) {
  if (!state.kaizo) state.kaizo = {};
  (state.kaizo.approx ??= []).push(entry);
}

function knightOf(state) {
  return state.entities.find((k) => k.alive && k.type.name === 'obj_knight_enemy');
}

/**
 * `obj_knight_weird_bottom_manager` Other_10, the arms its kaizo module does
 * not implement (underbox.js `init` is the "full" arm alone: local_turntimer
 * 340, x += 200, two delayed lerps — all wrong for a chained segment).
 *
 * Straight from gml_Object_obj_knight_weird_bottom_manager_Other_10.gml:20-56,
 * which is byte-identical to vanilla. DELETE THIS TABLE the day underbox.js's
 * `init` takes turn_type into account; `applyChainedArm` below is the only
 * caller and it no-ops for every other segment.
 */
const CHAINED_ARMS = {
  obj_knight_weird_bottom_manager: {
    // "start": local_turntimer 200, x lerped +96 over 16, alpha 0 at 16.
    // Unreachable from either dispatched order (composition is always 1, so
    // segment 1 is "short start" and never plain "start"), and listed for
    // completeness rather than translated — a lerp nothing can arm is a
    // branch a suite cannot pin.
    'short start': null,
    'short mid': (e, state) => {
      e.init_start = 2;
      e.init = 1;
      cue(state, 'snd_knight_teleport');
      e.local_turntimer = 170;
      e.image_alpha = 0;
      e.image_index = 5;
    },
    'short end': (e, state) => {
      e.init_start = 2;
      e.init = 1;
      cue(state, 'snd_knight_teleport');
      e.local_turntimer = 170;
      e.image_alpha = 0;
      e.image_index = 5;
    },
    end: (e, state) => {
      e.init_start = 2;
      e.init = 1;
      cue(state, 'snd_knight_teleport');
      e.local_turntimer = 200;
      e.image_alpha = 0;
      e.image_index = 5;
    },
  },
};

/**
 * `event_user(0)` on the new segment. Calls the module's own Other_10, and
 * supplements it from CHAINED_ARMS where the module only translated the
 * "full" arm — never both: a module that HAS the arm gets its own code and
 * nothing else, because a supplement applied twice is a divergence that looks
 * like a tuning value.
 */
function applyChainedArm(state, next, entry) {
  const arms = CHAINED_ARMS[entry.name];
  const arm = arms ? arms[next.turn_type] : undefined;
  if (arm === undefined) {
    // No supplement registered — the module owns every arm.
    if (entry.type.init) entry.type.init(next, state);
    return { supplemented: false };
  }
  if (arm === null) {
    // Registered as KNOWN-MISSING and deliberately not translated.
    ledger(state, {
      type: 105,
      asked: `${entry.name} event_user(0) arm "${next.turn_type}"`,
      used: 'no setup',
      why: 'arm unreachable from either dispatched order; not translated',
    });
    return { supplemented: false };
  }
  arm(next, state);
  return { supplemented: true };
}

/**
 * THE HANDOFF, written once because all five participants write it
 * identically — quickslash_attack's Step_0, rotating_slash's Step_0 and
 * Alarm_2, weird_bottom_manager's Step_0 and Alarm_2, and swordfall's
 * Alarm_3 all carry the same block:
 *
 *     with (new_knight) {
 *         turn_type = "end";
 *         if (other.turn_segment == 0) { turn_type = "short mid";
 *                                        turn_segment = 1;
 *                                        next_up = other.next_next_up; }
 *         if (other.turn_segment == 1) { turn_type = "short end";
 *                                        turn_segment = 2; }
 *         anchor_x = other.anchor_x;  anchor_y = other.anchor_y;
 *         event_user(0);
 *     }
 *
 * The promotion is by SEGMENT, not by `next_up`: a segment that does not know
 * it is in a combination (turn_segment -1) hands its successor "end", the
 * two-attack form. `composition` is what starts the three-attack form, by
 * setting segment 0.
 *
 * Sets the fields only — `event_user(0)` is the caller's, because two sites
 * insert their own writes between the anchor copy and the event.
 */
export function kaizoComboPromote(self, next) {
  next.turn_type = 'end';
  if (self.turn_segment === 0) {
    next.turn_type = 'short mid';
    next.turn_segment = 1;
    next.next_up = self.next_next_up;
  }
  if (self.turn_segment === 1) {
    next.turn_type = 'short end';
    next.turn_segment = 2;
  }
  next.anchor_x = self.anchor_x;
  next.anchor_y = self.anchor_y;
  return next;
}

/**
 * THE HANDOFF SITES. Each `with (new_knight)` block in the mod adds its own
 * writes around the shared promotion above, and they are NOT the same — the
 * offsets, the warp and the successor seeds all differ per source object.
 * Rather than guess a common shape, each site is transcribed here with its
 * GML citation, and the module that owns the site names it.
 *
 * `at`      where the successor is created (the `instance_create` arguments)
 * `pre`     writes before the shared promotion, per successor id
 * `warp`    does this site create an obj_knight_warp for the successor
 * `post`    writes AFTER `event_user(0)`, per successor id
 */
export const KAIZO_CHAIN_SITES = {
  /** obj_roaringknight_quickslash_attack Step_0:60-148 (the turn-end fork,
   *  reached on turn_type start / short start / short mid). */
  quickslash_step: {
    gml: 'gml_Object_obj_roaringknight_quickslash_attack_Step_0.gml:60-148',
    at: (state) => {
      const k = knightOf(state);
      return { x: (k ? k.x : 0) - 100, y: k ? k.y : 0 };
    },
    // `if (new_knight == 630) x -= 50; else if (new_knight == 802) x += 25;
    //  else x += 50;` — by OBJECT INDEX, so it keys off the successor id.
    pre: {
      2: (n) => { n.x += 50; },
      3: (n) => { n.x += 25; },
      4: (n) => { n.x -= 50; },
      5: (n) => { n.x += 50; },
    },
    // `if (new_knight != 1173) { with (instance_create_depth(...)) { master
    //  = other.id; event_user(0); } }` — the underbox arrives without one.
    warp: (id) => id !== 5,
    warpEvent: 'in',
    post: {
      // `if (new_knight == 669) knight_stream.timer = 4;`
      2: (n) => { n.timer = 4; },
      // `if (new_knight == 1173) { alarm[0] = 1; init_start = 3; init = 4; }`
      5: (n) => { n.alarm[0] = 1; n.init_start = 3; n.init = 4; },
    },
    // `slash_count` on the OUTGOING controller, set from the successor before
    // the spawn: 993 for the underbox and swordfall, 999 for the other two.
    // It is the caller's own field, so it rides here rather than in `pre`.
    self: (self, id) => {
      self.done = true;
      self.local_turntimer = 99999;
      self.slash_count = (id === 5 || id === 4) ? 993 : 999;
      if (id > 0) {
        self.nodraw = true;
        self.auto = false;
      }
    },
  },

  /** obj_knight_rotating_slash Step_0:64-196 — FOUR early-spawn blocks
   *  (next_up 1 at local_turntimer < 240, 3 at < 220, 4 and 5 at
   *  < turn_limit_4). They fire mid-turn, so the successor OVERLAPS the
   *  outgoing slash; Alarm_2 then finds next_up == -999 and only destroys. */
  rotating_step: {
    gml: 'gml_Object_obj_knight_rotating_slash_Step_0.gml:64-196',
    at: (state) => {
      const k = knightOf(state);
      return { x: k ? k.x : 0, y: k ? k.y : 0 };
    },
    // The threshold each block waits for, so a driver can reproduce the
    // overlap rather than firing everything at the alarm.
    threshold: { 1: 240, 3: 220, 4: 'turn_limit_4', 5: 'turn_limit_4' },
    warp: (id) => id === 1 || id === 3 || id === 4,
    warpEvent: 'in',
    warpOffset: {
      1: { x: 50, y: -44 },
      3: { x: 25, y: -44 },
      4: { x: -60, y: -44 },
    },
    /**
     * THE ID-3 BLOCK DOES NOT USE THE SHARED PROMOTION, and this is the only
     * place in the whole chain where that is true. Transcribed verbatim from
     * Step_0:112-135:
     *
     *     turn_type = "end";
     *     if (other.turn_segment == 0) { turn_type = "short mid";
     *                                    turn_segment = 1;
     *                                    next_up = other.next_next_up;
     *                                    timer = -8; }
     *     if (other.turn_segment == 1) { turn_type = "short mid";
     *                                    turn_segment = 2; }
     *
     * The second branch says **"short mid"**, where every other handoff in
     * both dumps says "short end" — so a revised tunnel reached from here as
     * the THIRD segment carries a turn_type its own CleanUp reads as
     * non-closing (`turn_type != "short mid"` is one of the three terms in
     * gml_Object_obj_knight_tunnel_slasher_2_revised_CleanUp_0.gml).
     *
     * That does NOT hang the fight, and the reason is worth writing down
     * because "short mid on the last segment" reads like a turn that can never
     * end. A last segment keeps its Create `next_up = -1`, which satisfies
     * `local_turntimer < 60 && (turn_type == "full" || next_up == -1)` at
     * Step_0:66 — the "final" state — and that state hands `global.turntimer`
     * its -1 at timer 92 (Step_0:148-154), CleanUp uninvolved. The recording
     * agrees: atk_Frenzy1 ends after ~360 frames and atk_Starstorm2 follows.
     *
     * Preserved rather than "corrected" to "short end": it is the mod's own
     * text, it is vanilla's too (the block diffs clean), and the ending it
     * produces is the one the recording shows.
     */
    promote: {
      3: (self, next) => {
        next.turn_type = 'end';
        if (self.turn_segment === 0) {
          next.turn_type = 'short mid';
          next.turn_segment = 1;
          next.next_up = self.next_next_up;
          // Immediately overwritten by the -12 in `post` below, because that
          // block fires for exactly the turn_types this one can produce. Kept
          // because the LINE EXISTS and a transcription that dropped it would
          // read as an omission.
          next.timer = -8;
        }
        if (self.turn_segment === 1) {
          next.turn_type = 'short mid';
          next.turn_segment = 2;
        }
        next.anchor_x = self.anchor_x;
        next.anchor_y = self.anchor_y;
        return next;
      },
    },
    post: {
      // `timer = spawn_speed;` — the quickslash starts mid-cadence.
      1: (n) => { n.timer = n.spawn_speed; },
      // AFTER event_user(0), Step_0:136-140:
      //     if (turn_type == "short mid" || turn_type == "short end")
      //     { timer = -12; local_turntimer += 12; }
      // The tunnel's Other_10 has just set local_turntimer from the arm, so
      // the +12 lands on 100 ("short mid") or 90 ("short end"), and the -12
      // buys the successor twelve frames before its first blade.
      3: (n) => {
        if (n.turn_type === 'short mid' || n.turn_type === 'short end') {
          n.timer = -12;
          n.local_turntimer += 12;
        }
      },
      // `init_start = 4; init = 8;` — the underbox seeds its ring faster.
      5: (n) => { n.init_start = 4; n.init = 8; },
    },
  },

  /** obj_knight_rotating_slash Alarm_2 — the LATE handoff, armed by the
   *  turn-end fork when no early block claimed next_up. Its switch has cases
   *  1/3/4/5 and NO case 2: a rotating slash cannot chain into another one,
   *  and neither dispatched order asks it to. */
  rotating_alarm2: {
    gml: 'gml_Object_obj_knight_rotating_slash_Alarm_2.gml',
    at: (state, self) => ({ x: self.x, y: self.y }),
    warp: () => false,
    post: {
      1: (n) => { n.timer = n.spawn_speed; },
    },
    unsupported: [2],
  },

  /** obj_knight_weird_bottom_manager Alarm_2. Cases 1/2/3/4 — no case 5,
   *  so the underbox cannot chain into another underbox. */
  underbox_alarm2: {
    gml: 'gml_Object_obj_knight_weird_bottom_manager_Alarm_2.gml',
    at: (state, self) => ({ x: self.x, y: self.y }),
    warp: () => true,
    warpEvent: 'in',
    post: {
      1: (n) => { n.timer = n.spawn_speed; },
      4: (n) => { n.countdowner = 10; },
    },
    unsupported: [5],
  },

  /** obj_knight_tunnel_slasher_2_revised Step_0:5-64 — TWO literal blocks
   *  rather than a switch, one for `next_up == 4` and one for `next_up == 5`,
   *  both gated on `local_turntimer < turntimer_limit`. They fire mid-pattern,
   *  so the successor overlaps the tunnel's blades. Nothing else can reach
   *  them: there is no block for 1, 2 or 3 at all.
   *
   *  UNREACHED BY EITHER DISPATCHED ORDER. The revised tunnel is ac 7's THIRD
   *  segment and appears nowhere in ac 106, and a third segment keeps its
   *  Create default `next_up`, so `local_turntimer < turntimer_limit` never
   *  meets a positive `next_up` here. Transcribed anyway so the module's call
   *  names a real block instead of defaulting into another object's. */
  tunnel_step: {
    gml: 'gml_Object_obj_knight_tunnel_slasher_2_revised_Step_0.gml:5-64',
    // `instance_create(obj_knight_enemy.x - 100, obj_knight_enemy.y - 88, ...)`
    // — the only site that offsets the CREATE call itself.
    at: (state) => {
      const k = knightOf(state);
      return { x: (k ? k.x : 0) - 100, y: (k ? k.y : 0) - 88 };
    },
    // `with (knight_stream) { x -= 20; y -= 66; ... }`, block 1 only.
    pre: {
      4: (n) => { n.x -= 20; n.y -= 66; },
    },
    // Block 1 warps the swordfall IN before the promotion; block 2 gives the
    // underbox nothing, the same asymmetry quickslash_step has.
    warp: (id) => id === 4,
    warpEvent: 'in',
    post: {
      // `init_start = 3; init = 6;` — one tick slower than the rotating
      // slash's 4/8 for the same successor, which is why these tables are per
      // SITE and not per successor.
      5: (n) => { n.init_start = 3; n.init = 6; },
    },
    unsupported: [1, 2, 3],
    unsupportedWhy: 'ORIGINAL: this Step has blocks for next_up 4 and 5 only,'
      + ' so no other id hands on from here at all',
  },

  /** obj_knight_tunnel_slasher_2_revised Alarm_2. Cases 1/2/4/5 — NO case 3,
   *  so the revised tunnel cannot chain into another one. Also unreached by
   *  either dispatched order, for the same reason as tunnel_step. */
  tunnel_alarm2: {
    gml: 'gml_Object_obj_knight_tunnel_slasher_2_revised_Alarm_2.gml',
    at: (state, self) => ({ x: self.x, y: self.y }),
    // The `next_up == -999` arm of this event DOES create an obj_knight_warp
    // (event_user(1), the warp OUT), but that is the tunnel's own exit, not
    // the successor's arrival — the guard at the top of kaizoChainNext has
    // already returned by then, so it is not this table's business.
    warp: () => false,
    pre: {
      // TWO ORIGINAL BUGS IN ONE LINE, both preserved and labelled:
      //
      //     if (knight == 366 && (turn_type != "short start"
      //                           || turn_type != "short mid"))
      //     { knight.local_turntimer -= knight.spawn_speed - knight.timer;
      //       knight.timer = knight.spawn_speed; }
      //
      //   1. the `||` makes the second test a TAUTOLOGY — a string cannot be
      //      unequal to neither, so it is always true and the author's intent
      //      (`&&`) is unreachable. Same shape as the two dead de-dupe guards
      //      in Other_10.
      //   2. `knight` here is the local `var knight` holding an OBJECT INDEX
      //      (366), not the instance — so `knight.local_turntimer` addresses
      //      "the first instance of obj_roaringknight_quickslash_attack",
      //      which is the one just created because nothing else of that object
      //      is alive during a combination. It lands on the successor, which
      //      is what the author meant, by accident.
      //
      // POSITION: the GML runs this AFTER the promotion and BEFORE the anchor
      // copy. It rides in `pre` instead, which is before the promotion —
      // equivalent, because kaizoComboPromote touches turn_type, turn_segment,
      // next_up and the anchor and none of timer / spawn_speed /
      // local_turntimer. What does matter is that it is before `event_user(0)`,
      // so the values it reads are the successor's CREATE defaults and not its
      // arm's, and `pre` preserves that.
      //
      // AND HALF OF IT IS DEAD, measured rather than reasoned. Driven on a
      // bench, the quickslash's Create leaves spawn_speed 10 / timer 5 /
      // local_turntimer 600, so this writes 595 and timer 10 — and then
      // `event_user(0)`'s "short mid" arm reassigns local_turntimer to 160 and
      // spawn_speed to 12 while leaving `timer` alone. So the local_turntimer
      // arithmetic is thrown away every time and the `timer = spawn_speed`
      // survives, carrying the CREATE spawn_speed (10) rather than the arm's
      // (12). Both halves are the original's; neither is corrected here.
      1: (n) => {
        n.local_turntimer -= n.spawn_speed - n.timer;
        n.timer = n.spawn_speed;
      },
    },
    unsupported: [3],
  },

  /** obj_knight_swordfall Alarm_3. Cases 1/2/3/5 — no case 4. */
  swordfall_alarm3: {
    gml: 'gml_Object_obj_knight_swordfall_Alarm_3.gml',
    at: (state, self) => ({ x: self.x, y: self.y }),
    warp: (id) => id === 5,
    warpEvent: 'out',
    post: {
      3: (n) => { n.timer = -8; n.fake_timer = -8; },
      5: (n) => { n.alarm[0] = 1; },
    },
    unsupported: [4],
  },
};

/**
 * Create the next segment from `self.next_up`, at one of the sites above.
 *
 * The GML's order inside `with (new_knight)`, preserved exactly, because two
 * of the sites interleave their own writes with the shared promotion:
 *
 *     instance_create -> scr_bullet_inherit -> creatorid/creator
 *     -> [site pre]  -> promote (turn_type / turn_segment / next_up)
 *     -> [site warp] -> anchor copy -> event_user(0) -> [site post]
 *
 * `self.next_up = -999` is the caller's last line at every site, and it is
 * what makes the handoff one-shot; it is done here so no site can forget.
 *
 * Returns the new segment, or null when nothing was created.
 */
export function kaizoChainNext(state, self, siteName = 'rotating_alarm2') {
  const site = KAIZO_CHAIN_SITES[siteName];
  if (!site) throw new Error(`kaizoChainNext: unknown handoff site ${siteName}`);

  const id = self.next_up;
  // `if (next_up != -999)` — the alarm sites' outer guard. -1 is the Create
  // default for a standalone launch and reaches the same nothing.
  if (id === -999 || id === -1 || id === undefined) return null;

  if (site.unsupported && site.unsupported.includes(id)) {
    // The switch has no case for this id, so `knight` stays -4 and
    // `instance_create(x, y, -4)` creates NOTHING. Faithful, and loud.
    ledger(state, {
      type: 105,
      asked: `${siteName} -> segment ${id}`,
      used: 'nothing (the site\'s switch has no case for it)',
      why: site.unsupportedWhy
        ?? 'ORIGINAL: instance_create(x, y, -4); no dispatched order reaches it',
    });
    self.next_up = -999;
    return null;
  }

  const entry = KAIZO_COMBO_ATTACKS[id];
  if (!entry || !entry.type) {
    // THE CHAIN DEAD-ENDS, and it has to end the TURN as well as itself —
    // every segment's CleanUp leaves global.turntimer alone unless it is the
    // closing one, so with the successor missing NOBODY hands the clock back
    // and the turn sits at the controller's 999999 forever. Same stand-in,
    // and the same reasoning, as the sim module's.
    ledger(state, {
      type: 105,
      asked: `combination segment ${id}`,
      used: 'turn ended early',
      why: 'no module registered for that segment id',
    });
    const knight = knightOf(state);
    if (knight) knight.image_alpha = 1;
    state.turntimer = -1;
    self.next_up = -999;
    return null;
  }

  const at = site.at(state, self);
  const next = spawn(state, entry.type, { x: at.x, y: at.y });

  // `scr_bullet_inherit(new_knight)` — damage / grazepoints / timepoints /
  // inv / target / grazed / grazetimer / element, and NOT difficulty (see
  // the header's disproof). Copied by hand rather than through the sim's
  // scrBulletInherit so the -1 sentinels behave exactly as the script's
  // `if (x != -1)` guards do on fields a translated module may not define.
  for (const f of ['damage', 'grazepoints', 'timepoints', 'inv', 'target']) {
    if (self[f] !== undefined && self[f] !== -1) next[f] = self[f];
  }
  if (self.grazed !== undefined && self.grazed !== -1) next.grazed = 0;
  if (self.grazetimer !== undefined && self.grazetimer !== -1) next.grazetimer = 0;
  if (self.element !== undefined) next.element = self.element;
  next.creatorid = self.creatorid;
  next.creator = self.creator;

  if (site.pre && site.pre[id]) site.pre[id](next, self, state);

  // The shared promotion, unless the site's own block departs from it. Only
  // rotating_step's id-3 arm does, and it says so at length where it is
  // written; every other site's `with (new_knight)` opens with the identical
  // five lines kaizoComboPromote holds.
  (site.promote?.[id] ?? kaizoComboPromote)(self, next);

  if (site.warp && site.warp(id)) {
    const off = (site.warpOffset && site.warpOffset[id]) || { x: 0, y: 0 };
    // `with (instance_create_depth(x, y, depth, obj_knight_warp)) { other.x
    // += dx; other.y += dy; master = other.id; event_user(N); }` — note the
    // offsets are applied to `other`, the NEW SEGMENT, not to the warp.
    next.x += off.x;
    next.y += off.y;
    const w = spawn(state, knightWarp, { x: next.x, y: next.y });
    w.master = next;
    if (site.warpEvent === 'out') knightWarpOut(state, w);
    else knightWarpIn(state, w);
  }

  // anchor copy + event_user(0), in that order.
  next.anchor_x = self.anchor_x;
  next.anchor_y = self.anchor_y;
  const armed = applyChainedArm(state, next, entry);

  if (site.post && site.post[id]) site.post[id](next, self, state);

  if (entry.source !== 'kaizo') {
    // Reached the chain, but through the VERIFIED SIM module because no
    // kaizo copy of that attack exists yet. Same row shape the launch path
    // writes, so the queue reads the same wherever the segment sat.
    ledger(state, {
      type: 105,
      asked: `combination segment ${id} (${entry.name})`,
      used: `the verified sim module (${entry.why ?? 'no kaizo copy'})`,
      why: 'segment module not translated for kaizo yet',
    });
  }

  self.next_up = -999;
  state.kaizoComboSegments = (state.kaizoComboSegments ?? 0) + 1;
  state.kaizoComboArmSupplemented = armed.supplemented;
  return next;
}

/**
 * `obj_dbulletcontroller` type 105 plus the whole of obj_knight_combinations:
 * the object exists for ONE frame, creates the first segment and destroys
 * itself. Nothing here is per-frame, so it is a function rather than a type.
 *
 * `order` is the parameterisation this file exists for — pass
 * `kaizoComboOrderFor(row.ac)`, or the object itself. Omitting it falls back
 * to the Knight's Create defaults, which is exactly what a dispatch that
 * never wrote the fields would produce.
 *
 * Returns the first segment, or null.
 */
export function launchKaizoCombination(state, order = KAIZO_COMBO_CREATE_DEFAULTS) {
  const knight = knightOf(state);
  // dbulletcontroller type 105 hides the Knight and pins the clock; the
  // closing segment's CleanUp is what hands it back.
  if (knight) knight.image_alpha = 0;
  state.turntimer = 999999;
  state.kaizoComboSegments = 0;
  state.kaizoComboOrder = [order.first, order.second, order.third];

  // Create_0: `composition = 0; with (obj_knight_enemy) other.composition =
  // combo_power;` — the controller reads the Knight's own field.
  const composition = order.power ?? 1;

  // THE DEAD SHUFFLE, consumed anyway: 16 u32 draws per element on the
  // measured model (CLAUDE.md), four elements, 64 draws off the shared
  // stream — and the permutation thrown away three lines later, exactly as
  // the game does. The mod's order does not come from here.
  if (state.gmlRng) gmlShuffle(state.gmlRng, [2, 3, 4, 5]);

  const entry = KAIZO_COMBO_ATTACKS[order.first];
  if (!entry || !entry.type) {
    ledger(state, {
      type: 105,
      asked: `combination first segment ${order.first}`,
      used: 'nothing launched',
      why: 'no module registered for that segment id',
    });
    return null;
  }

  // `instance_create(creatorid.x, creatorid.y, ...)` — creatorid is the
  // Knight (scr_bulletspawner ran inside `with (obj_knight_enemy)`).
  const first = spawn(state, entry.type, {
    x: knight ? knight.x : state.view.x + 425,
    y: knight ? knight.y : state.view.y + 78,
  });

  first.turn_type = composition === 1 ? 'short start' : 'start';
  first.turn_segment = composition ? 0 : -1;
  first.next_up = order.second;
  first.next_next_up = order.third;
  // `scr_bullet_inherit(knight); knight.creatorid = creatorid;` — AFTER the
  // with-block in the GML, which is why it sits below event_user(0) here too.
  // Through applyChainedArm rather than `type.init` directly: an order whose
  // FIRST segment is the underbox would otherwise get that module's "full"
  // arm (local_turntimer 340, x += 200) for a "short start" turn. Neither
  // dispatched order does that today; a future one must not be silently wrong.
  applyChainedArm(state, first, entry);
  first.creatorid = knight ?? null;
  first.creator = knight ?? null;
  state.kaizoComboSegments = 1;

  if (entry.source !== 'kaizo') {
    ledger(state, {
      type: 105,
      asked: `combination segment ${order.first} (${entry.name})`,
      used: `the verified sim module (${entry.why ?? 'no kaizo copy'})`,
      why: 'segment module not translated for kaizo yet',
    });
  }
  return first;
}
