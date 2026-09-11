// KAIZO KNIGHT — scene scaffold. NOT WIRED INTO THE PLAYER-FACING PAGE.
//
// This module is the seam between the verified sim and the Kaizo project.
// The isolation contract (kaizo/HANDOFF.md §2) in one line: kaizo/ IMPORTS
// from sim/, and nothing under sim/, render/, web/ or tools/ imports from
// kaizo/. The 60-suite health check must stay green with this directory
// deleted — that is the definition of "separated enough".
//
// Everything here is a DELIBERATE DEVIATION from the real fight and ships
// labelled KAIZO wherever a player could see it (CLAUDE.md: nothing invented
// ships unlabelled). The attack MODULES this schedule points at are the
// verified ones; the SCHEDULE ITSELF is invented.

import { buildKaizoTurnLoop } from './kaizo-practice.js';
import { vcHooks } from './kaizo-vc-hooks.js';
import { kaizoVortexendFreeze } from '../attacks/sword-vortex.js';
import {
  installRoster, WEIRD_ROUTE_PARTY, NORMAL_ROUTE_PARTY, maxhpOfChar, charIdOf,
  CHAR_NONE, CHAR_KRIS, CHAR_NOELLE,
} from '../party/roster.js';
import { scrKaizoTarget, kaizoKnightTarget, kaizoDamageHooks } from '../party/damage.js';
import { kaizoAdvanceBalloon } from '../party/freeze.js';
import { createKaizoHeroes } from '../party/heroes.js';
import { installKaizoMenu } from '../party/spells.js';
import { VC_TABLE, VD_TABLE, VC_KNIGHT } from '../versions/vc-script.js';
import { tensionbarDraw } from '../party/tensionbar.js';
import { spawn } from '../../sim/entity.js';
import { PARTY } from '../../sim/damage.js';

export const KAIZO_NOTE =
  'KAIZO KNIGHT — a recreation of EnderCat8\'s "Kaizo Roaring Knight" mod '
  + '(v2.3.3): its schedule, attacks and party, diffed frame by frame against '
  + 'recordings of the mod. Not the real fight, not our design; every '
  + 'approximation is ledgered.';

/**
 * DRAFT schedule, version A ("KAIZO: AUTHENTIC") — see HANDOFF.md §5.
 *
 * Design rule for v-A: every row uses ONLY content that exists in the real
 * game's code — the highest difficulty variant of each live attack that a
 * suite already verifies, plus the seven translated UNUSED attacks (ac 0, 3,
 * 4, 6, 7, 10, 20 — unreachable in the vanilla selector, no oracle possible,
 * suites are positive-assertion only). The remix is the ORDER and DENSITY,
 * not the content.
 *
 * LIVE since K3: buildKaizoScene() runs this table through the kaizo turn
 * loop (kaizo-practice.js). Difficulty values here are the max each suite
 * verifies today — raise one only after adding the suite that pins it;
 * verify-kaizo enforces the cap.
 */
export const KAIZO_TABLE = {
  1: [
    { ac: 1, difficulty: 2, name: 'Stars', kaizo: 'max verified difficulty (homing starchildren)' },
    { ac: 10, difficulty: 0, name: 'Swordfall', kaizo: 'UNUSED content, no oracle' },
    { ac: 2, difficulty: 3, name: 'Flurry', kaizo: 'phase-3 variant moved up' },
    { ac: 13, difficulty: 4, name: 'Sword Tunnel', kaizo: 'max verified difficulty' },
    { ac: 5, difficulty: 2, name: 'Rotating Slash', kaizo: 'max verified difficulty' },
  ],
  2: [
    { ac: 0, difficulty: 0, name: 'Swordslash', kaizo: 'UNUSED content, no oracle' },
    { ac: 15, difficulty: 0, name: 'Sword Vortex' },
    { ac: 4, difficulty: 0, name: 'Knight Stream', kaizo: 'UNUSED content, no oracle' },
    { ac: 3, difficulty: 0, name: 'Sword Tunnel (revised)', kaizo: 'UNUSED content, no oracle' },
    { ac: 5, difficulty: 2, name: 'Rotating Slash' },
  ],
  3: [
    { ac: 6, difficulty: 0, name: 'Underbox', kaizo: 'UNUSED content, no oracle' },
    { ac: 20, difficulty: 0, name: 'Knightlines', kaizo: 'UNUSED content, no oracle' },
    { ac: 14, difficulty: 0, name: 'Tracking Swords' },
    { ac: 7, difficulty: 0, name: 'Combination', kaizo: 'UNUSED chain: swordfall -> rotating -> tunnel-revised' },
    { ac: 5, difficulty: 2, name: 'Rotating Slash' },
  ],
  4: [
    { ac: 5, difficulty: 2, name: 'Rotating Slash' },
    { ac: -1, difficulty: 1, name: 'Charge-up' },
    { ac: 9, difficulty: 0, name: 'ROARING' },
  ],
};

/** Version registry — the shape multiple Kaizo variants hang off (HANDOFF §5). */
export const KAIZO_VERSIONS = {
  // V-A — the ORIGINAL invented remix (vanilla attacks on an invented
  // schedule). It was the page's default until 2026-09-08, which is why
  // "most attacks that should appear don't appear at all": the mod's own
  // attacks live in V-C. Kept reachable at ?v=A; not the default, not the
  // recreation, and its note says so.
  A: {
    name: 'KAIZO: AUTHENTIC (the invented remix — NOT the mod)',
    table: KAIZO_TABLE,
    invented: 'schedule only',
    note: 'KAIZO: AUTHENTIC — the original invented remix: vanilla attacks on an '
      + 'invented schedule. Not the mod; the recreation is ?v=C.',
  },
  // B: { name: 'KAIZO: B-SIDE', ... }   — invented/revamped content, later.
  //
  // V-C — the ORACLE lane (HANDOFF §5-C): a recreation of EnderCat8's
  // "Kaizo Roaring Knight" v2.3.3, schedule and dispatch transcribed from
  // the mod's own decompiled attack table (kaizo/versions/vc-script.js,
  // generated from private research). PUBLISH-GATED: never commit/push
  // these without the author's permission — see the generated file's
  // header. Attacks at not-yet-translated difficulty branches run
  // APPROXIMATED and ledgered in state.kaizo.approx.
  C: {
    name: 'KAIZO ROARING KNIGHT v2.3.3 — the recreation (the page\'s default)',
    table: VC_TABLE,
    hooks: () => vcHooks({ sideb: false }),
    knight: VC_KNIGHT,
    invented: 'nothing — recreation of EnderCat8\'s mod (approx ledgered)',
  },
  // V-D — the WEIRD ROUTE (the mod's B-Side). Two differences from V-C that
  // are not the schedule: the party is KRIS + NOELLE, and every attack takes
  // its k_sideb branch. The mod does not toggle this — `k_sideb` reads
  // global.flag[456], the game's own Snowgrave save flag, so on a Weird
  // Route file the Kaizo fight simply IS this (kaizo/party/WEIRD-ROUTE.md).
  D: {
    name: 'KAIZO: ORACLE B-SIDE (Weirder Route — Kris & Noelle, WIP)',
    table: VD_TABLE,
    party: WEIRD_ROUTE_PARTY,
    hooks: (roster) => vcHooks({ sideb: true, roster }),
    knight: VC_KNIGHT,
    invented: 'nothing — recreation of EnderCat8\'s mod (approx ledgered)',
  },
};

/**
 * Build the Kaizo scene: the full verified turn loop (kaizo-practice.js — a
 * kaizo-owned copy of the practice machinery, table-parametrized) running the
 * chosen version's schedule. K3 (HANDOFF.md §7) landed: the schedule is live.
 *
 * `state.kaizo.launched` is the launch ledger — every attack the director
 * actually launches is appended, and verify-kaizo's fight-order analog
 * asserts the ledger equals the table. The HUD label alone proves selection;
 * the ledger proves launch.
 */
/**
 * THE RECORDING'S OWN LOADOUT — MEASURED, not chosen.
 *
 * `sim/damage.js`'s DEFAULT_GEAR is the VANILLA whole-fight build, where it is
 * verified byte-exact. It was inherited into the kaizo lane without ever being
 * measured, and it is WRONG for this save — the same class of unmeasured
 * inheritance as `global.flag[10]` (text automash).
 *
 * Read straight out of the mod by the recorder's party receipt
 * (`kaizo_oracle_party<TAG>.txt`, added to oracle_kaizo_fight.csx for exactly
 * this question):
 *
 *     slot,char,maxhp,hp,battledf,battleat,armor1,armor2,weapon
 *     0,1,160,160,5,18,1,10,16      Kris    MechaSaber  + AmberCard + GlowWrist
 *     1,2,190,190,5,22,1,10,17      Susie   AutoAxe     + AmberCard + GlowWrist
 *     2,3,140,140,5,15,1,10,18      Ralsei  FiberScarf  + AmberCard + GlowWrist
 *
 * Every derived number reconciles against the sim's own tables, which is what
 * makes this a measurement rather than a guess: battledf 5 = base 2 + AmberCard
 * 1 + GlowWrist 2 for all three, and battleat 18/22/15 = base at 14/18/12 plus
 * weapon at 4/4/3.
 *
 * **THERE IS NO SHADOWMANTLE.** The default build puts armour 23 on Kris; this
 * save has none, and that changes two mechanisms at once — `scr_kaizo_target`'s
 * `_mantlechar` is permanently −1 so the weighted branch always runs, and
 * nobody gets the mantle's x0.33.
 *
 * WHY IT DECIDES THE ROSTER. This recorder re-pins HP every frame, so a
 * character dies only if ONE frame's damage reaches maxhp, and the knight's
 * biggest bullet is 206 against `206 - 3*battledf`:
 *
 *     df 5 -> 191.   Susie  190 DIES (by 1).  Ralsei 140 DIES.  Kris 160 would
 *                    die too, but with HP pinned full `_krisrange` is 0 and
 *                    scr_kaizo_target essentially never picks him.
 *     df 7 -> 185.   Susie LIVES, and the sim fielded her all fight.
 *
 * That is the whole roster divergence: the recording fields Kris alone from
 * turn 3 (its bars carry one bolt) and the sim fielded two or three.
 */
export const KAIZO_TOK3_GEAR = [
  { weapon: 16, armor: [1, 10] },
  { weapon: 17, armor: [1, 10] },
  { weapon: 18, armor: [1, 10] },
];

// ── global.knight_mode AND THE TWO FLAGS IT PRODUCES (ledger G-6) ──────────
//
// THE PROBLEM THIS SOLVES. `practicemode` and `nohitmode` are read in
// FOURTEEN already-translated branches across kaizo/party/ and
// kaizo/scenes/, and until now they were written NOWHERE — every one of them
// was permanently on its false arm. This is the fight's own half of G-6: the
// knight's Create block, and a way for a scene to say which mode it is. The
// PRE-FIGHT ROOM that lets a player choose (the sword-draw's four-option
// menu, the kaizo settings sign) is G-9/G-10 and is NOT here.
//
// THE PRODUCER, `gml_Object_obj_ch3_PTB02_Step_0.gml:444, 495, 500`: `con 3.2`
// sets `global.knight_mode = 0` unconditionally (:444 — so from that moment the
// global EXISTS, whatever is chosen next) and offers Practice / No Hit /
// Standard / Return as choices 0..3. The commit is a two-armed test at con 3.4,
// and WHICH ARM WRITES WHAT is the whole point:
//
//     if (global.choice == 3)        { ... room_restart(); exit; }   // Return
//     else if (global.choice == 1)   { ...; global.knight_mode = global.choice; }  // :495
//     else                           { con = 4; global.knight_mode = global.choice; } // :500
//
// The `else` at :500 is not "Standard"; it is EVERY choice that is not 3 and
// not 1 — which is 0 (Practice) as well as 2 (Standard). So all three playable
// choices write the global, and only Return does not. Reading it as "1 and 2
// only" makes Practice unreachable, which contradicts the consumer below:
// `practicemode = 1` needs `global.knight_mode == 0` to have been written, and
// :500 is the line that writes it.
//
// With `global.kaizo_practice` unset the menu is skipped entirely and
// `global.choice = 2` — Standard.
//
// THE CONSUMER, `gml_Object_obj_knight_enemy_Create_0.gml:88-109`, verbatim:
//
//     practicemode = 0;
//     nohitmode = 0;
//     knight_items = [];  for (i = 0; i < 13; i++) knight_items[i] = global.item[i];
//     if (variable_global_exists("knight_mode"))
//     {
//         if (global.knight_mode == 0)
//             practicemode = 1;
//         if (global.knight_mode == 1)
//         {
//             nohitmode = 1;
//             global.hp[1] = global.maxhp[1];
//             global.hp[2] = global.maxhp[2];
//             global.hp[3] = global.maxhp[3];
//             global.hp[4] = global.maxhp[4];
//         }
//     }
//
// `variable_global_exists` IS LOAD-BEARING, and it is why the byte-gate
// recordings are Standard runs. The oracle patch boots the game and
// `room_goto(room_bullettest_new)` — PTB02 never runs, `global.knight_mode`
// is never created, the test is FALSE and both flags stay 0. So "no mode
// given" is not a convenience default here; it is the recorded state, and
// `undefined` models the missing global exactly. Passing 2 (Standard) reaches
// the same two zeroes down the other road, and both are asserted.
//
// `knight_items` is the inventory snapshot, G-12's business (the mod moved it
// behind `global.knight_mode == 2`); this lane's bag is a title-screen
// loadout, a different model, so it is not translated here.
export const KNIGHT_MODE_PRACTICE = 0;
export const KNIGHT_MODE_NOHIT = 1;
export const KNIGHT_MODE_STANDARD = 2;

/** The names `buildKaizoScene({ mode })` takes, and the global they mean. */
export const KNIGHT_MODES = {
  practice: KNIGHT_MODE_PRACTICE,
  nohit: KNIGHT_MODE_NOHIT,
  standard: KNIGHT_MODE_STANDARD,
};

/**
 * `global.hp[1..4] = global.maxhp[1..4]` — no-hit mode's opening heal.
 *
 * BY SLOT, because the party arrays in this engine are slot-indexed and the
 * roster is what maps a slot to a character. The GML writes four character
 * cells whether or not those characters are in the fight; a write to an
 * absent character lands nowhere that this fight reads, which is the same
 * reading kaizo/party/damage.js's `practiceHp` records for the practice-mode
 * HP dance.
 *
 * THE MAX COMES FROM THE ROSTER FIRST, and getting that order wrong is a
 * silent corruption rather than a crash: `PARTY[1].maxhp` is SUSIE'S 190, and
 * the Weird Route's slot 1 is Noelle with 120. `maxhpOfChar` reads the
 * installed roster (0 when none is), `state.partyMaxhp` is the HUD's copy
 * that buildKaizoScene writes for a roster version, and the engine's
 * chapter-3 table is the last resort for a vanilla-shaped three.
 *
 * ── THE PADDED SPARE IS NOT A CHARACTER, AND IT WAS BEING HEALED ──────────
 *
 * `state.partyHp.length` IS NOT THE ROSTER SIZE. buildKaizoScene pads a short
 * party back out to three with the spare marked dead and untargetable, because
 * that is what `global.char = [1, 4, 0]` looks like to every vanilla-shaped
 * consumer (the note at the padding loop has the full reasoning). So on the
 * Weird Route this walk ran slots 0, 1 AND 2 — and slot 2 has no character at
 * all. `maxhpOfChar` correctly returned 0 for it, `state.partyMaxhp` is the
 * roster's own two entries so index 2 was undefined, and the walk fell all the
 * way through to `PARTY[2].maxhp` — RALSEI'S 140, written into a slot the
 * Weird Route's party does not have. Measured:
 *
 *     buildKaizoScene({ version: 'D', mode: 'nohit' })
 *     partyHp  [160, 120, 0]  ->  [160, 120, 140]      chardead [0, 0, 1]
 *
 * A slot that is dead, untargetable and holding 140 HP is a contradiction
 * waiting for the first consumer that reads HP without reading `chardead`
 * beside it — the exact failure mode the padding note warns about, arriving
 * from the other direction.
 *
 * The GML is CHARACTER-indexed and answers this by construction: it writes
 * `global.hp[1..4]`, and a character who is not in the fight has its cell
 * written somewhere nothing reads. Modelled here by resolving the slot's
 * character FIRST and skipping the slot when there is none — `CHAR_NONE` is
 * the mod's own 0, so this is the same test `scr_fixparty` and `hpOfChar`
 * make, not a guard invented for this site.
 */
function healPartyToMax(state) {
  if (!Array.isArray(state.partyHp)) return;
  for (let slot = 0; slot < state.partyHp.length; slot++) {
    const charId = charIdOf(state, slot);
    // `global.hp[0]` — an empty slot is character 0, and the GML's write to a
    // character not in the party lands nowhere this fight reads.
    if (charId === CHAR_NONE) continue;
    const m = maxhpOfChar(state, charId)
      || state.partyMaxhp?.[slot]
      || PARTY[slot]?.maxhp;
    if (typeof m === 'number' && m > 0) state.partyHp[slot] = m;
  }
}

/**
 * obj_knight_enemy's Create block for the two mode flags. Call it once the
 * knight record exists — the GML runs it in the Knight's own Create, before
 * his first Step, and his first Step is where `armHpscene` reads
 * `!practicemode && !nohitmode` (kaizo/party/scenes.js:1042).
 *
 * IT WRITES BOTH HOMES ON PURPOSE. The fourteen readers do not agree on
 * where the flags live: kaizo/party/scenes.js and kaizo/party/gloom.js read
 * them off `state.knight` (the obj_knight_enemy instance record), while
 * kaizo/party/damage.js, freeze.js, spells.js and kaizo-vc-hooks.js read
 * `state.kaizo.practicemode`. In the GML there is one instance and one
 * variable; writing one home only would have left half the branches dead and
 * a green suite either way, which is exactly the failure this repo keeps
 * hitting. Both are written, and check-knight-mode.mjs asserts every reader
 * from the outside rather than trusting the field name.
 *
 * @param {*} state
 * @param {number|undefined} knightMode `global.knight_mode`; `undefined`
 *        means the global does not exist, which is the recorded fight.
 */
export function applyKnightMode(state, knightMode) {
  // :88-89 — the defaults, unconditional.
  let practicemode = false;
  let nohitmode = false;
  // :95 — `variable_global_exists("knight_mode")`.
  if (knightMode !== undefined && knightMode !== null) {
    if (knightMode === KNIGHT_MODE_PRACTICE) practicemode = true;
    if (knightMode === KNIGHT_MODE_NOHIT) {
      nohitmode = true;
      // :104-107 — the four `global.hp[c] = global.maxhp[c]` lines. (:103 is
      // `nohitmode = 1`, the line above; the citation used to start there.)
      healPartyToMax(state);
    }
  }
  if (state.knight) {
    state.knight.practicemode = practicemode;
    state.knight.nohitmode = nohitmode;
  }
  if (state.kaizo) {
    state.kaizo.practicemode = practicemode;
    state.kaizo.nohitmode = nohitmode;
    // The producer's own value, kept so a reader can tell "Standard was
    // chosen" (2) from "the global never existed" (undefined) — G-12's
    // inventory snapshot and G-8's ESC restart both branch on `== 2`.
    state.kaizo.knightMode = knightMode ?? null;
  }
  return { practicemode, nohitmode };
}

/**
 * @param {*} state
 * @param {object} [opts]
 * @param {string} [opts.version] a KAIZO_VERSIONS key.
 * @param {string|number} [opts.mode] `global.knight_mode` (see KNIGHT_MODES).
 * @param {Record<number, {weapon: number, armor: number[]}>} [opts.gear]
 *   A CHARACTER-INDEXED equipment override, forwarded to `installRoster`'s
 *   own `gear` parameter and read back through `gearOfChar`
 *   (`state.kaizo.gear[charId]`).
 *
 *   IT ONLY APPLIES TO A VERSION THAT BRINGS A ROSTER — V-D today. That is
 *   not a limitation, it is the scope: `installRoster` is the only thing that
 *   reads it, and a version without a roster has no `state.kaizo.gear` for
 *   `gearOfChar` to consult. Passing it to V-C would be a value written where
 *   nothing reads it, which is this repo's signature defect, so it is
 *   documented as ignored rather than left to be discovered.
 *
 *   WHY IT EXISTS: the equip screen. `kaizo/ui/proceed.js` puts the Weird
 *   Route's two members on the title's equip page, and without this the
 *   player's choices would edit `title.gear` and never reach the fight — the
 *   roster would keep supplying its own defaults and the menu would be a
 *   decoration. check-proceed-route.mjs asserts the wire from the outside.
 *
 *   DEFAULT UNCHANGED: omitted means `installRoster` is called exactly as it
 *   was, and the A-Side byte gate (V-C, no roster) never reaches this at all.
 */
export function buildKaizoScene(state, { version = 'A', mode, gear } = {}) {
  const v = KAIZO_VERSIONS[version];
  // The ledgers must exist before the turn loop's first launch. Launches only
  // happen inside stepFrame, after build returns — but setting the marker
  // first keeps the ordering obvious rather than merely true.
  // The recreation lanes play the RECORDING's save, not the vanilla build.
  // Set before anything can read gear, and only when the caller has not already
  // supplied a loadout of its own.
  // SCOPED TO THE THREE-PERSON A-SIDE ONLY. `v.party` marks a version that
  // brings its OWN roster — V-D is the Weird Route (Kris + Noelle, global.char
  // = [1, 4, 0]) and `installRoster` supplies its gear from kaizo/party/. The
  // receipt above was read off an A-SIDE recording, so applying it there put a
  // three-person build on a two-person party and took check-weirdroute red on
  // all four B-Side launch assertions.
  // ONLY THE RECREATION LANES. `v.knight` marks the versions that recreate
  // the recording (V-C, and V-D which then supplies its own roster via
  // `v.party`). V-A is the playable AUTHENTIC mode with an invented schedule;
  // it keeps the vanilla build so an oracle measurement does not change the
  // feel of the mode people actually play. Scoping on `!v.party` alone
  // silently re-geared V-A too.
  if (v.knight && !v.party && !state.loadout?.gear) {
    state.loadout = { ...(state.loadout ?? {}), gear: KAIZO_TOK3_GEAR };
  }
  // TEXT AUTO-ADVANCE (global.flag[10]) IS OFF IN THE RECORDING'S SAVE — the
  // same class of save-dependent input as the gear above, inferred from the
  // enemy-talk frame budget (nine holds of 10-74 frames, each ended by a
  // button3 press; automash-on collapsed them to 7-14). The vanilla reference
  // save has it ON and sim/scenes/practice.js keeps that default; the
  // recreation lanes set it explicitly here, and the practice loop reads it
  // with vanilla's own `!== false` semantics.
  // THE AUTO-ADVANCE IS ON IN THE REFERENCE SAVE, and this lane used to force
  // it off. MEASURED (the recorder's writer sidecar, _writer recording,
  // balloonturn 6): automash_timer toggles on the token's b3 frames and
  // prevent_mash_buffer reads 2 there, which only happens under
  // global.flag[10] == 1. With it off the sim closed every balloon on the
  // first confirm after the halt and ran each talk phase two frames short.
  if (v.knight && state.textAutoMash === undefined) state.textAutoMash = true;

  // THE KNIGHT NEVER STROBES FROM A PARTY HIT IN THIS MOD.
  //
  // scr_damage_enemy's one interesting line is the strobe arm, and EnderCat8
  // moved its literal:
  //
  //     v105    if (chapter == 3 && i_ex(obj_knight_enemy) && arg1 >= 100)
  //     kaizo   if (chapter == 3 && i_ex(obj_knight_enemy) && arg1 >= 10000)
  //
  // (the ONLY line that differs between the two copies of the script). No
  // party hit in this fight comes near 10000 — X-Slash, the biggest, is
  // ceil(ceil(((52 * 160) / 20) - df * 3) * 1.05) * 2, under 900 — so
  // `stronghurtanim` is only ever set by the ENDING (sim/knight.js
  // startEndCutscene, Draw_0:143-148), which is the one place the mod still
  // wants the flicker.
  //
  // It gates two things, both of them the Knight's reaction animation: the
  // strobe branch (kaizo/render/draw/tracking.js — under the mod both arms
  // draw idlesprite anyway, so this only decides the ENDING's %3 flicker)
  // and the delayed thud one frame in, `hurttimer == 29 && stronghurtanim`,
  // which the sim was playing on every heavy swing.
  //
  // Both versions: the script is shared, and V-C is the mod too.
  if (v.knight) state.stronghurtDamage = 10000;

  // THE TP BAR'S DRAW, which is what makes the TP slash mean anything.
  //
  // obj_tensionbar's Draw carries `global.tension = clamp(global.tension, 0,
  // 125)` behind `kaizo_sideb() && (k_tpscene >= 10 || k_tpscene == -1)` —
  // so from the frame the Knight shears the bar, the party can bank at most
  // half the TP it could before, every spell priced above 125 is gone for the
  // rest of the run, and the readout can never pass 50%. The module was
  // translated with its bleed particles and its nine-draw loop and nothing
  // ran it, which made the whole k_tpscene cutscene a light show over a bar
  // that still filled to 250.
  //
  // B-Side only: the gate's first term is kaizo_sideb(), so V-C would carry
  // an entity that can never clamp, and the A-Side byte gate would step it
  // for 13,000 frames to no purpose.
  //
  // AND IT HAS TO SURVIVE THE TURN. The end-of-turn sweep is a stand-in for
  // `with (obj_bulletparent) instance_destroy()` working off a list of
  // vanilla names, so anything this scene installs is swept unless it says
  // otherwise (knight-sim v1.0.31). Both of this lane's battle-long
  // instances were dying at the first turn end, at frame 359 of every fight:
  // obj_tensionbar and the spell controller both live for the whole battle
  // in the game.
  (state.survivesTurn ??= new Set())
    .add('kaizo_tensionbar_draw')
    .add('kaizo_spell_controller');
  if (version === 'D') spawn(state, tensionbarDraw, { x: 0, y: 0 });

  state.kaizo = {
    version,
    // Per version: the remix says it is the remix; the recreations carry
    // the page's note.
    note: v.note ?? KAIZO_NOTE,
    table: v.table,
    scheduleActive: true,
    launched: [],
    approx: [],
    // `kaizo_block = 1` in the mod knight's Create — every non-crit party
    // hit is blocked to ceil(/5) until the 40% guard drop. Meaningless for
    // versions without the mod hooks.
    vars: v.knight ? { kaizo_block: true } : {},
    // The B-Side flag kaizo modules read as state.kaizo.sideb.
    sideb: version === 'D',
    // CROSS-MODULE SEAMS. The mod couples two attacks that live in separate
    // translated modules: the B-Side's ac-111 rotating slash ends its turn
    // by FREEZING the sword vortex's blades into bullets
    // (obj_knight_rotating_slash CleanUp_0:16-43 -> kaizo_vortexend_step).
    // The rotating module calls this hook; without it, it falls back to the
    // vanilla `turntimer = -1` and ledgers the deviation.
    hooks: v.knight ? { vortexendHandoff: kaizoVortexendFreeze } : {},
  };
  // THE ROSTER IS INSTALLED BEFORE THE SCENE IS BUILT. installRoster rewrites
  // state.partyHp, the char arrays and the B-Side freeze/gloom mirrors to the
  // roster's LENGTH, and the turn loop spawns one party actor per member — so
  // doing it afterwards would build a three-person scene and then contradict
  // it. It also re-stamps state.kaizo, hence the marker being merged back in
  // rather than assigned before.
  let roster = null;
  if (v.party) {
    const marker = state.kaizo;
    installRoster(state, { charIds: v.party, sideb: version === 'D', gear: gear ?? null });
    roster = state.kaizo.roster;
    state.kaizo = { ...marker, ...state.kaizo };
    // LANE W2 (menu / spells / ACTs / X-Slash): fill the engine's
    // character-table seam (sim/spells.js) from the roster and spawn the
    // spell controller. Roster-gated by construction -- this block is
    // `if (v.party)`. kaizo/party/spells.js has the provenance.
    installKaizoMenu(state);

    // THE GAME KEEPS THREE SLOTS AND LEAVES THE SPARE EMPTY.
    //
    // `global.char` is a THREE-entry array however many characters are in the
    // party — the Weird Route's is `[1, 4, 0]`, Kris, Noelle, nobody — and the
    // absent slot is simply never targetable. installRoster sizes its arrays
    // to the roster (2), which is right for anything reading the roster, and
    // wrong for the many vanilla-shaped consumers that walk slots 0..2:
    // sim/damage.js's isUp reads `!chardead[slot]`, so an ABSENT slot came
    // back `!undefined` = standing, took targeting rolls, and had damage
    // written to it — `partyHp` grew a third entry mid-fight.
    //
    // Padding to three with the spare marked dead and untargetable is not a
    // workaround for that; it is what the original data looks like. Every
    // vanilla-shaped consumer then does the right thing with no change, which
    // is the whole reason the mod could add Noelle without rewriting them.
    // THE HUD READS THESE. render/menu.js's charbox row defaults to the
    // vanilla trio's portraits, name plates and max HP; without these it
    // drew Noelle's 120 HP under SUSIE's face and name. They are plain
    // state fields precisely so render/ can honour a different party
    // without importing anything from kaizo/.
    // scr_charbox draws `spr_head<name>` and `spr_bname<name>` per character
    // id, not per slot — which is exactly the distinction that put Noelle's
    // HP under Susie's portrait. Keyed by charId so the panel follows the
    // character wherever scr_fixparty packs them.
    const CHARBOX_ART = {
      1: { head: 'spr_headkris', name: 'spr_bnamekris' },
      2: { head: 'spr_headsusie', name: 'spr_bnamesusie' },
      3: { head: 'spr_headralsei', name: 'spr_bnameralsei' },
      4: { head: 'spr_headnoelle', name: 'spr_bnamenoelle' },
    };
    state.partySprites = roster.map((m) => CHARBOX_ART[m.charId] ?? CHARBOX_ART[1]);
    state.partyMaxhp = roster.map((m) => m.maxhp);

    for (let slot = roster.length; slot < 3; slot++) {
      state.partyHp[slot] = 0;
      state.chardead[slot] = 1;
      state.charcantarget[slot] = 0;
      state.charmove[slot] = 0;
      state.charaction[slot] = 0;
      state.charspecial[slot] = 0;
    }
    // `createState()` built three heroes before any scene existed
    // (sim/state.js). A two-person party needs its own, or obj_heroparent
    // steps a member who is not in the fight.
    state.heroes = createKaizoHeroes(state);

    // ── THE PARTY LAYER GOES LIVE HERE, and only here ─────────────────────
    //
    // sim/damage.js's four entry points (scrDamage, scrDamageSingle,
    // scrDamageAll, scrDamageMaxhp) each defer whole to a hook of the same
    // name on `state.kaizo.hooks`, and sim/dialogue.js's advanceBalloon to
    // `hooks.advanceBalloon`. Installing them is what puts kaizo/party/
    // damage.js on the path every bullet actually travels
    // (sim/bullets/regularbullet.js:145-147, the slashes, the splitslash,
    // knight-stream.js:418, knightlines.js:951, the two local
    // scr_damage_all_maxhp loops, roaring-final-star.js's direct scrDamage):
    // Noelle's x0.5 (scr_damage.gml:157-160), the B-Side gloom precompute and
    // accrual (:5-17, :245-265), the -999 fell for everyone (:225-231),
    // scr_kaizo_target through global.char, scr_damage_maxhp's own ratios —
    // and takes the Susie exchange off the B-Side (Step_0:206-211).
    //
    // ROSTER-GATED BY CONSTRUCTION: this block only runs for a version that
    // brings its own party. V-C keeps the engine's scr_damage under the
    // knightTarget hook below, which is what the _tok3 byte gate is pinned
    // to; the mod's A-Side deltas that ride in the same script (the -999
    // fell for Kris, the deleted Flurry softening) are therefore NOT live on
    // V-C from here — they need the roster layer, and under the gate's HP
    // pin they are invisible either way. `??=` for the reason the
    // knightTarget install records: a check's recording wrapper must win.
    state.kaizo.hooks ??= {};
    const dmgHooks = kaizoDamageHooks();
    for (const name of Object.keys(dmgHooks)) state.kaizo.hooks[name] ??= dmgHooks[name];
    state.kaizo.hooks.advanceBalloon ??= kaizoAdvanceBalloon;
  }

  // ── TARGETING. The mod DELETES vanilla's block; sim/damage.js keeps it ───
  //
  // `gml_GlobalScript_scr_damage.gml:88-91` (kaizo) is one call to
  // `scr_kaizo_target()` where v105 has ~75 inline lines — verified by
  // diffing kaizo-mod/gml_vanilla_v105 against kaizo-mod/gml_kaizo_dump, the
  // matching-version pair, so this is a kaizo delta and not a build
  // difference. `scr_damage_maxhp.gml:59-165` carries the SAME body inlined,
  // and `sim/damage.js`'s `knightTarget` is the one place both of the sim's
  // entry points (`scrDamageSingle`, `scrDamageMaxhp`) go through — so one
  // hook covers both, and every live bullet with it
  // (`sim/bullets/regularbullet.js:122`).
  //
  // `??=`, NOT `=`, for the reason the combination seam records at
  // kaizo/scenes/kaizo-mod-launcher.js:262: a check that installs a RECORDING
  // WRAPPER to prove the seam fired gets silently eaten by an unconditional
  // assignment, and the check then goes red reporting that nothing happened.
  // Anything installed ahead of this still resolves to scr_kaizo_target if it
  // delegates, so deferring here concedes the instrumentation and not the
  // routing.
  //
  // Gated on `v.knight` — the mod-recreation marker, the same gate the
  // vortexend seam above uses. V-A is an INVENTED schedule over vanilla
  // attack bodies and keeps vanilla targeting.
  //
  // WHAT THE WEARER SCAN READS, and it is currently right by absence rather
  // than by statement. `scr_kaizo_target` looks for armour 23 through
  // `gearOfChar` (kaizo/party/roster.js), which on a version with no roster
  // installed — V-C — reports every character unequipped, so `_mantlechar`
  // stays -1 and every hit takes the `random_range(0, 2)` branch. That
  // MATCHES the recording: `obj_initializer2` Create:102 calls
  // `scr_gamestart()` unconditionally at boot, the recorder loads no save (it
  // counts 120 boot frames and then `room_goto(room_bullettest_new)` —
  // tools/patches/oracle_kaizo_fight.csx), and scr_gamestart's chapter-3
  // block equips `chararmor1[1..3] = 1, chararmor2[1..3] = 10`. NO ARMOUR 23
  // IS IN THE RECORDED FIGHT. `sim/damage.js`'s DEFAULT_GEAR puts 23 on Kris
  // and the kaizo trace harness sets no `state.noMantle`, so give V-C a
  // roster built from DEFAULT_GEAR and the mantle branch switches on and the
  // draw count changes under you. check-roster asserts the absence directly.
  state.kaizo.hooks ??= {};
  // scr_damage's pre-targeting rules ride in front of scr_kaizo_target on the
  // hook path (kaizo/party/damage.js kaizoKnightTarget): the `target == 4`
  // roll every controller-inherited bullet makes on every hit.
  // The runner steps NEWEST INSTANCE FIRST (sim/entity.js phaseList has the
  // receipts, the kaizo one being _tok3 f1212: a newer slash writes the cut
  // box's con/timer and the older box steps in the same frame). NOT SWITCHED
  // ON HERE: `state.stepNewestFirst = true` moved the byte gate from f1215
  // back to f449 and reddened check-oracle-crescent -- this lane carries its
  // own oldest-first fits, and each one has to be found and undone with the
  // GML in hand before the flag can go on. Until then the one measured
  // handoff is emulated at its site (flurry-splitslash.js).
  if (v.knight) state.kaizo.hooks.knightTarget ??= kaizoKnightTarget;

  buildKaizoTurnLoop(state, {
    seed: state.seed,
    table: v.table,
    hooks: v.hooks ? v.hooks(roster) : {},
  });
  // The mod's stat block (scr_monstersetup): HP 10000. The knight entity was
  // just created by the build with the vanilla 7300.
  if (v.knight && state.knight) state.knight.hp = v.knight.maxhp;

  // obj_knight_enemy Create_0:88-109 — G-6. HERE because the knight record
  // does not exist until buildKaizoTurnLoop has run, and it must exist
  // before the first Step: `knightFirstStep` (kaizo-vc-hooks.js:327) reads
  // `!practicemode && !nohitmode` through armHpscene on the frame
  // `damagereductiontimer == 1`.
  //
  // DEFAULT IS THE RECORDED FIGHT. `mode` unset means `global.knight_mode`
  // does not exist, both flags are 0, and nothing about the page changes —
  // web/kaizo.js passes no mode and stays on Standard. Nothing in this repo
  // is a player-facing mode selector yet; that is G-9/G-10.
  const knightMode = typeof mode === 'string' ? KNIGHT_MODES[mode] : mode;
  if (typeof mode === 'string' && knightMode === undefined) {
    throw new Error(`buildKaizoScene: unknown mode "${mode}" (practice | nohit | standard)`);
  }
  applyKnightMode(state, knightMode);
  return state;
}
