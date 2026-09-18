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
import { NOELLE_SPELLS, NOELLE_SPELL_SNOWGRAVE } from '../party/noelle.js';
import { installKaizoMenu, installKaizoActPages } from '../party/spells.js';
import { VC_TABLE, VD_TABLE, VC_KNIGHT, VC_GATE_FRACTION } from '../versions/vc-script.js';
import { tensionbarDraw } from '../party/tensionbar.js';
import { ensureEnding, FLAG_WEIRD_ROUTE } from './kaizo-ending.js';
import { spawn } from '../../sim/entity.js';
import { PARTY } from '../../sim/damage.js';
import { VICTORY_LINES, buildVictoryScript, setVictoryVariant } from '../../sim/victory-scene.js';

// THE ONE LABEL THE FOURTH LAW REQUIRES, in plain words.
//
// It used to run four lines and speak in the project's own vocabulary
// ("diffed frame by frame", "every approximation is ledgered"), which is the
// working notes talking, not the game. Shortening it to the title alone went
// too far the other way: verify-kaizo asserts this string says KAIZO and
// disclaims authenticity, because a recreation that never says it is one is
// exactly what law 4 forbids. Two sentences do both jobs.
export const KAIZO_NOTE =
  'KAIZO KNIGHT — EnderCat8\'s "Kaizo Roaring Knight" v2.3.3, recreated in '
  + 'the browser. NOT the real fight.';

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
    { ac: 1, difficulty: 2, name: 'Stars', kaizo: 'the game\'s hardest Stars (homing starchildren)' },
    { ac: 10, difficulty: 0, name: 'Swordfall', kaizo: 'UNUSED content' },
    { ac: 2, difficulty: 3, name: 'Flurry', kaizo: 'phase-3 variant moved up' },
    { ac: 13, difficulty: 4, name: 'Sword Tunnel', kaizo: 'the game\'s hardest Sword Tunnel' },
    { ac: 5, difficulty: 2, name: 'Rotating Slash', kaizo: 'the game\'s hardest Rotating Slash' },
  ],
  2: [
    { ac: 0, difficulty: 0, name: 'Swordslash', kaizo: 'UNUSED content' },
    { ac: 15, difficulty: 0, name: 'Sword Vortex' },
    { ac: 4, difficulty: 0, name: 'Knight Stream', kaizo: 'UNUSED content' },
    { ac: 3, difficulty: 0, name: 'Sword Tunnel (revised)', kaizo: 'UNUSED content' },
    { ac: 5, difficulty: 2, name: 'Rotating Slash' },
  ],
  3: [
    { ac: 6, difficulty: 0, name: 'Underbox', kaizo: 'UNUSED content' },
    { ac: 20, difficulty: 0, name: 'Knightlines', kaizo: 'UNUSED content' },
    { ac: 14, difficulty: 0, name: 'Tracking Swords' },
    { ac: 7, difficulty: 0, name: 'Combination', kaizo: 'UNUSED chain: swordfall -> rotating -> tunnel (revised)' },
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
  // attacks live in V-C. Kept reachable at ?v=A, and not the default.
  //
  // It used to carry a `note` and an `invented` field saying, in prose, that
  // it was not the mod. Nothing read either one except a console.log, and the
  // shipped build should not spend its strings apologising for itself. What
  // each version IS belongs in this comment; what it is NOT belongs nowhere.
  A: {
    name: 'KAIZO: AUTHENTIC',
    table: KAIZO_TABLE,
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
    name: 'KAIZO ROARING KNIGHT v2.3.3',
    table: VC_TABLE,
    hooks: () => vcHooks({ sideb: false }),
    knight: VC_KNIGHT,
  },
  // V-D — the WEIRD ROUTE (the mod's B-Side). Two differences from V-C that
  // are not the schedule: the party is KRIS + NOELLE, and every attack takes
  // its k_sideb branch. The mod does not toggle this — `k_sideb` reads
  // global.flag[456], the game's own Snowgrave save flag, so on a Weird
  // Route file the Kaizo fight simply IS this (kaizo/party/WEIRD-ROUTE.md).
  D: {
    name: 'KAIZO: WEIRD ROUTE — Kris & Noelle',
    table: VD_TABLE,
    party: WEIRD_ROUTE_PARTY,
    hooks: (roster) => vcHooks({ sideb: true, roster }),
    knight: VC_KNIGHT,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// THE MOD'S ENDING CUTSCENE — ledger G-14 and G-16.
//
// `sim/victory-scene.js` plays con 50, the A-Side knighting, and EnderCat8
// replaced the end of it. A won fight on V-C used to play the vanilla beat:
// the Knight repositions to (2326, 44), holds `spr_roaring_knight_kris_
// knighting` frame 1 with Kris hidden inside the art, lowers the blade over
// 90 frames, and Kris is revealed in `spr_krisb_defeat`. In the mod none of
// that happens.
//
// SOURCE: `gml_Object_obj_ch3_PTB02_Step_0.gml:1009-1177` (mod) against
// `gml_vanilla_v105/.../:880-1008`. The retail Chapter 3 dump
// (`knight-research/gml_dump/CodeEntries/`) is BYTE-IDENTICAL to the v105
// comparison tree for this whole file, so every line below is EnderCat8's
// work and none of it is official churn read backwards — checked, because the
// mod is built on chapter build v0.0.091 and the comparison tree is v0.0.105.
//
// ─── G-14, THE KNIGHTING BECOMES A THIRD SLASH ───────────────────────────
//
// Every one of vanilla's six knighting lines is DELETED — `y = 44`,
// `x = 2326`, `hover_pause = true`, `image_index = 1`, `image_speed = 0`,
// `after_active = false`, and `c_sel(kr); c_visible(0)`. What is left is the
// bare `sprite_index = spr_roaring_knight_kris_knighting` assignment, and in
// its place comes the same slash beat Susie and Ralsei each got:
//
//     c_mus("pause")                          a SECOND pause, after the one
//                                             the script already did
//     5x c_snd_play_x(snd_knight_cut2, 12, .06/.1/.12/.18/.24)
//     whiteall visible 1                      (image_blend is still 0/black
//                                             from Susie's cut)
//     white_slash depth -120, (2420, 150), visible 1
//     c_sel(kr); c_setxy(kr_actor.x, kr_actor.y); c_sprite(spr_kris_fell)
//     c_wait(90); c_mus("resume")
//     big_shake; whiteall 0; white_slash 0; swoon_target = kr_actor
//
// THE KNIGHT IS NOT THERE. His `x` was last set at Susie's cut to
// `camerax() + view_wport[0] + 300` — off the right of the frame — and the
// mod deletes every line that would bring him back, so the knighting SPRITE
// is assigned to an off-screen instance and the `image_index 1 -> 4` lower
// that follows plays where nobody can see it. He returns only at the end,
// when the vanilla tail sets `x = 2655` with his sword. That is the joke: the
// ceremony is assigned and never staged, and Kris is cut down like the other
// two.
//
// ─── G-16, THE REST OF THE CUTSCENE'S EDITS ──────────────────────────────
//
//   * Susie's taunt and Ralsei's grief line are cut off MID-WORD, and the
//     truncation is `%%` — a bare `%` ends a message the frame the writer
//     reaches it, where vanilla's `/%` waits for a press first. So the line
//     does not merely LOOK shorter: the slash lands immediately, with no beat
//     for the player to acknowledge it. That is `noWait` below.
//   * FIVE BEATS DELETED between the taunt and the cut — `c_sprite(
//     spr_susie_laugh_dw)`, `c_imagespeed(0.25)`, `c_mus2("loopsfx", 169, 0)`,
//     `c_wait(26)`, `c_mus("loopsfxstop")`. Susie's second laugh is gone.
//   * ALL TEN `snd_knight_cut2` go volume 8 -> 12.
//   * `unskip_writer = true` moves ~100 lines EARLIER (from Ralsei's cry to
//     Susie's "Heheh..."), widening the window in which the writer cannot be
//     skipped. NOT MODELLED: this engine's ending has no skip-the-writer
//     mechanic at all — X ends the whole scene — so there is no window to
//     widen. Recorded here rather than silently dropped.
//
// ─── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────
//
// The `if (kaizo_funchance(100))` Ralsei fakeout (G-17) wraps the aftermath of
// RALSEI's slash, not Kris's. The script below takes the `else` arm — the
// 99-in-100 path — and the fakeout is `kaizo/scenes/kaizo-ending.js`'s.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The two truncated lines, keyed by their index in the ENGINE's table so the
 * renderer's per-line face-frame map still applies (both keep their `\EY` /
 * `\EZ` expression codes — the mod only cut the text).
 *
 * `was` is a tripwire, not decoration: this variant DERIVES from
 * `VICTORY_LINES`, and if the engine ever rewords one of these the derivation
 * would silently truncate a different sentence.
 */
const KAIZO_VICTORY_LINE_EDITS = {
  // "\\EY* Not so tough NOW^1, are y%%/%"  (Step_0:1026)
  4: { was: '* Not so tough NOW, are you!?', text: '* Not so tough NOW, are y' },
  // "\\EZ* H..^1. how cou%%/%"             (Step_0:1070)
  6: { was: '* H.. how could you...', text: '* H.. how cou' },
};

export const KAIZO_VICTORY_LINES = Object.freeze(VICTORY_LINES.map((line, i) => {
  const edit = KAIZO_VICTORY_LINE_EDITS[i];
  if (!edit) return line;
  if (line.text !== edit.was) {
    throw new Error(
      `kaizo victory line ${i}: expected the vanilla text ${JSON.stringify(edit.was)}, `
      + `found ${JSON.stringify(line.text)} — the mod's truncation is derived from it `
      + 'and would now cut a different sentence. Re-read Step_0:1026/1070.',
    );
  }
  return Object.freeze({ speaker: line.speaker, text: edit.text, noWait: true });
}));

/** All ten `c_snd_play_x(snd_knight_cut2, 12, ...)` — vanilla plays 8. */
export const KAIZO_CUT_VOLUME = 12;

/** `c_var_instance(white_slash, "x"/"y", ...)` for the THIRD slash, the one
 *  that replaces the knighting. Susie's is (2420, 182), Ralsei's (2408, 240). */
export const KAIZO_KNIGHTING_SLASH_XY = Object.freeze([2420, 150]);

/**
 * The mod's con-50, DERIVED from the engine's so the shared two thirds cannot
 * drift. Three structural edits, each located by what it is rather than by an
 * index — an index would move the first time the vanilla script gained a beat.
 */
export function buildKaizoVictoryScript() {
  const script = buildVictoryScript();
  const at = (pred, what) => {
    const i = script.findIndex(pred);
    if (i < 0) throw new Error(`kaizo victory script: ${what} is not in the vanilla script`);
    return i;
  };

  // 1. THE FIVE DELETED BEATS. `laughAgain` is spr_susie_laugh_dw @0.25 plus
  //    loopsfx 169 (= snd_suslaugh); the `c_wait(26)` behind it is the pause
  //    the mod removes so the cut lands on the truncated word.
  const laugh = at(([op]) => op === 'laughAgain', "the second laugh ('laughAgain')");
  const after = script[laugh + 1];
  if (!(after && after[0] === 'w' && after[1] === 26)) {
    throw new Error("kaizo victory script: expected ['w', 26] after 'laughAgain' (c_wait(26))");
  }
  script.splice(laugh, 2);

  // 2. THE KNIGHTING BECOMES A SLASH. Vanilla is `['black'], ['knighting'],
  //    ['w', 90], ['unblack'], ['music', 'wind'], ...`; the mod keeps the
  //    black and the 90, and puts a cut and a SWOON where the ceremony was.
  const knighting = at(([op]) => op === 'knighting', "the knighting ('knighting')");
  script.splice(knighting, 1,
    ['knightingSlash'],
    ['w', 90],
    ['music', 'wind'],   // c_mus("resume")
    ['reveal', 'kris'],  // big_shake + whiteall 0 + white_slash 0 + swoon_target
  );

  // 3. THE LAST REVEAL IS spr_kris_fell, NOT spr_krisb_defeat.
  const down = at(([op]) => op === 'krisDown', "the final reveal ('krisDown')");
  script[down] = ['krisFell'];

  return script;
}

/**
 * The ops the derived script adds. They run through the engine's default arm
 * (`sc.ops`), so the mod's beats live here and `sim/victory-scene.js` stays
 * vanilla. `api` hands over the engine's own measured helpers — `fiveCuts` is
 * the five-cut stack, and re-implementing it here would be a second copy of a
 * measured mechanism.
 */
export const KAIZO_VICTORY_OPS = Object.freeze({
  /**
   * Step_0:1142-1157. The knighting sprite is assigned and NOTHING else about
   * the Knight is touched — see the header: he is off-screen when this runs.
   */
  knightingSlash(sc, a, b, cues, api) {
    const k = sc.knight;
    const kr = sc.actors.kris;
    // `c_var_instance(roaring_knight, "sprite_index", spr_roaring_knight_
    // kris_knighting)` — the ONE line vanilla's knighting block has left.
    k.sprite = 'spr_roaring_knight_kris_knighting';
    // `c_mus("pause")` a second time, one line after the script's own.
    cues.push({ music: 'stop' });
    api.fiveCuts(cues, sc.cutVolume);
    // whiteall: still image_blend 0 (black) from Susie's cut, re-shown here.
    sc.white.black = true;
    sc.white.alpha = 1;
    sc.white.visible = true;
    const [sx, sy] = KAIZO_KNIGHTING_SLASH_XY;
    sc.slash.x = sx;
    sc.slash.y = sy;
    sc.slash.visible = true;
    // ORIGINAL BUG, PRESERVED: `c_sel(kr); c_setxy(kr_actor.x, kr_actor.y)`.
    // `kr` is the cutscene actor SLOT and `kr_actor` is the instance that slot
    // drives (`scr_maincharacters_actors.gml:5-6`, `scr_actor_setup(kr,
    // kr_actor, "kris")`) — so this sets Kris to the position he is already
    // at. Susie's and Ralsei's cuts both `c_setxy` to a real literal; this one
    // does not move him. Written out rather than dropped so a later reader
    // cannot "restore" a reposition that the mod never had.
    kr.x = kr.x;
    kr.y = kr.y;
    kr.sprite = 'spr_kris_fell';
    kr.index = 0;
    kr.speed = 0;
    // `c_visible(0)` IS DELETED — Kris is NOT hidden. Stated because the
    // vanilla op hides him and an inherited `visible = false` here would be
    // an empty screen for the rest of the scene.
    kr.visible = true;
  },

  /**
   * Step_0:1167-1168 — the vanilla `krisDown` with one sprite changed.
   * `spr_krisb_defeat` is the kneeling knighted pose; `spr_kris_fell` is the
   * swoon. He was never knighted, so he is never in that pose.
   */
  krisFell(sc, a, b, cues, api) {
    const kr = sc.actors.kris;
    const k = sc.knight;
    kr.visible = true;               // c_visible(1)
    kr.sprite = 'spr_kris_fell';     // vanilla: spr_krisb_defeat
    kr.index = 0;
    k.sprite = 'spr_roaringknight_idle_overworld_sword';
    k.index = 0;
    k.speed = 0.1;
    k.x = 2655;
    k.hoverPause = false;
  },
});

/**
 * The installed variant. `sim/victory-scene.js` reads this back out of its own
 * module state when the page calls `createVictoryScene()` — the page's call
 * takes no arguments, and `sim/` may not import `kaizo/`, so an install is the
 * only seam there is.
 */
export const KAIZO_VICTORY_VARIANT = Object.freeze({
  name: 'kaizo-v233-aside',
  lines: KAIZO_VICTORY_LINES,
  cutVolume: KAIZO_CUT_VOLUME,
  ops: KAIZO_VICTORY_OPS,
  get script() { return buildKaizoVictoryScript(); },
});

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
  // THE ENDING CUTSCENE THE MOD REPLACED (G-14 / G-16, the block above).
  //
  // WHY IT IS INSTALLED HERE AND NOT PASSED AT THE CALL SITE: the page's only
  // call is `createVictoryScene()` with no arguments (`web/kaizo.js`), and
  // `sim/` may not import `kaizo/`. So the build ARMS the ending for the
  // fight it is building, exactly as it arms the damage and target hooks
  // below, and the factory reads it back when the player wins.
  //
  // TOTAL, NOT CONDITIONAL. `setVictoryVariant(null)` on a version without
  // `knight` RESTORES the vanilla knighting: a page that opens V-C and then
  // V-A in the same tab must not keep the mod's ending, and V-A is the
  // invented remix — it is not the mod and never had this cutscene.
  //
  // V-D INSTALLS IT AND NEVER PLAYS IT, which is correct rather than wasteful:
  // a Weird Route win forks to the B-Side epilogue (`kaizoEndingRouteFor`), so
  // this is the answer to "what would a flag[456]-off win on the mod play".
  setVictoryVariant(v.knight ? KAIZO_VICTORY_VARIANT : null);

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
    // The B-Side flag kaizo modules read as state.kaizo.sideb. ONE SOURCE:
    // kaizoSidebFor() (below) is the only place a version letter becomes this
    // answer, so the registry and the ending fork cannot disagree.
    sideb: kaizoSidebFor(version),
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
  // THE ACT PAGES GO IN FOR EVERY KAIZO VERSION, not just the one with a
  // roster. The block below is party-gated and correctly so — it installs a
  // character table built FROM the roster — but the act pages are keyed by
  // character id and need no roster at all, and leaving them inside the gate
  // put the mod's S-Action rewrite where no player could reach it: V-C has the
  // Susie who performs it and never installed the hook; V-D installed it and
  // has no Susie.
  installKaizoActPages(state);

  let roster = null;
  if (v.party) {
    const marker = state.kaizo;
    installRoster(state, { charIds: v.party, sideb: kaizoSidebFor(version), gear: gear ?? null });
    roster = state.kaizo.roster;
    state.kaizo = { ...marker, ...state.kaizo };
    // LANE W2 (menu / spells / ACTs / X-Slash): fill the engine's
    // character-table seam (sim/spells.js) from the roster and spawn the
    // spell controller. Roster-gated by construction -- this block is
    // `if (v.party)`. kaizo/party/spells.js has the provenance.
    installKaizoMenu(state);

    // SNOWGRAVE IS A SAVE-FILE SPELL, NOT A scr_gamestart ONE.
    //
    // `scr_gamestart` gives Noelle [2, 8, 9] (noelle.js:371) and NEVER 10;
    // `scr_load_chapter2.gml:170` is what puts SnowGrave in her book, so in
    // the real mod it is there only on a save that took the Weird Route —
    // which is exactly the save this side is recreating. Without this the
    // spell was fully built (scr_spellinfo case 10, scr_spell case 10, the
    // whole k_sgscene) and had NO WAY IN from the menu.
    //
    // `spellmenuActs` is the other half of the same menu: the mod's spell
    // list for a non-Kris caster opens with that character's ACT rows
    // (scr_spellmenu_setup builds the slot's ACT rows first, marker -1, then
    // the spells) — the N-Action / S-Action / R-Action rows, which were built
    // and asserted by direct call and unreachable through the shipped menu.
    //
    // BOTH ARE sideb-GATED, and that is deliberate: `fullfight/` is Normal
    // Route on both tracked pairs (CLAUDE.md, 'The one number'), so a seam
    // behind this gate is structurally invisible to the byte gate.
    if (kaizoSidebFor(version)) {
      state.kaizo.spells = { [CHAR_NOELLE]: [...NOELLE_SPELLS, NOELLE_SPELL_SNOWGRAVE] };
      state.spellmenuActs = true;
    }

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
  // A FALL IS PERMANENT ON BOTH SIDES OF THE MOD, not just the Weird Route.
  //
  // The v105-vs-kaizo diff shows BOTH damage scripts lose vanilla's Kris-only
  // mercy, and neither deletion is gated on `k_sideb`:
  //
  //   MOD  (scr_damage.gml:224-232): doomtype = 12; hpdiff = round(hp + 999);
  //        global.hp[chartarget] = -999; scr_dead(target) — for EVERY target.
  //   v105: `if (target == 0) { ... global.hp[chartarget] =
  //        round(-global.maxhp[chartarget] / 2); doomtype = 4; } else { ... }`
  //
  // Same deletion in scr_damage_maxhp.gml:225-231. MEASURED before this line
  // existed: V-C, one 206 hit on slot 0, left Kris at -80 with the DOWN
  // graphic — down and liftable by a single heal, which is not the mod.
  //
  // WHY THE FLAG AND NOT THE MOD'S WHOLE scr_damage. Installing
  // kaizoDamageHooks() on V-C was tried and REVERTED: the mod's scripts read
  // their stats through the roster accessors, and a version with no roster
  // reports every character unequipped, so the party's DF collapses to 0 —
  // measured, a 100 hit landed 100 where it should land 85. The flag carries
  // the one A-Side delta without dragging the roster stat layer behind it.
  //
  // `sim/damage.js` reads it at both fell sites and at both doomtype sites;
  // `tools/verify-permanentfell.mjs` in ../knight-sim holds it, ON and OFF.
  // THE BYTE GATE: the recordings pin party HP, so no fell branch is ever
  // reached in them — re-proven byte-exact after this landed.
  if (v.knight) state.permanentFell = true;
  // ...AND THE HUD HAS TO BE TOLD. Both readouts of the Knight's HP divide by
  // a maximum, and both were still dividing by vanilla's 7300 while he stood
  // at 10000:
  //   * render/menu.js's enemy bar — (hp / 7300) * 80 overflows its own 80px
  //     track, so the bar read FULL for the first 2700 damage;
  //   * render/background.js's `battleprog`, obj_bgfountaintest's running
  //     readout of a '???' enemy, which reached 0 about 2700 HP late and sat
  //     at a NEGATIVE alpha from frame 0.
  // The mod also retunes battleprog itself: `obj_bgfountaintest_Draw_0.gml`
  // line 14 is the file's ENTIRE diff against v105 — `* 0.8` becomes `* 0.6`
  // and `* 5` becomes `* 2.5`, so it ramps from the 60% gate at half the
  // slope. 0.6 is VC_GATE_FRACTION, the same number phase 4 opens on.
  // Plain optional state fields, the sanctioned seam (HANDOFF §7): render/
  // imports nothing from kaizo/.
  if (v.knight) {
    state.knightMaxhp = v.knight.maxhp;
    state.knightProgPivot = VC_GATE_FRACTION;
    state.knightProgSlope = 2.5;
  }

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

  // ── THE ENDING'S ROUTE, STAMPED AT BUILD (ledger G-15) ─────────────────
  //
  // `obj_ch3_PTB02`'s con 8 reads `global.flag[456]`, not `k_sideb`
  // (Step_0:616-619) — a SECOND read of the same save flag, in a different
  // object, after the battle controller is gone. `ensureEnding` mirrors
  // `state.kaizo.sideb` into `state.kaizo.flag[456]` so the fork has its
  // input before anything can ask, and stands up `state.kaizo.ending`.
  //
  // It spawns nothing and steps nothing: the epilogue only runs when a driver
  // calls `ptb02Con8` / `enterEnding` after the fight, so this is inert for
  // every gate. What it buys is that the route is decided by the version the
  // scene was BUILT as, rather than by whatever a post-fight driver happens
  // to believe — which is how a V-D win ends up playing the A-Side knighting.
  ensureEnding(state);

  return state;
}

/**
 * THE ONE PLACE A VERSION LETTER BECOMES `k_sideb`.
 *
 * `k_sideb = global.flag[456]` (obj_knight_enemy Create_0:115) — the mod has
 * no switch for it, so in this repo the letter the scene is BUILT as is the
 * stand-in for the save flag. Everything downstream (state.kaizo.sideb,
 * installRoster's `sideb`, ensureEnding's `flag[456]` mirror, and through it
 * `ptb02Con8`'s fork) hangs off this single expression. Two copies of it is
 * how a registry and a fork come to give different answers to one question.
 */
export function kaizoSidebFor(version) {
  return version === 'D';
}

/**
 * Which post-fight cutscene a WIN plays. `bside` is the epilogue (con 49.1 ->
 * 50.1 -> 50.2, terminal); `aside` is the knighting (con 49 -> 50 -> con 10,
 * the story resumes).
 *
 * **IT KEYS OFF THE FLAG, NOT OFF THE VERSION.** It used to read
 *
 *     KAIZO_VERSIONS[version]?.party && version === 'D' ? 'bside' : 'aside'
 *
 * which asked a different question than the mod's own fork does: `obj_ch3_
 * PTB02`'s con 8 reads `global.flag[456]` (Step_0:616-619), and so does this
 * module's `ptb02Con8`. The `.party` conjunct was dead as well — D is the only
 * registry entry that carries a `party` key — so the registry answer and the
 * fork answer had two different sources and nothing made them agree.
 *
 * Pass a BUILT STATE and it reads the fork's own input, `state.kaizo.flag[456]`
 * (falling back to `state.kaizo.sideb`, which `ensureEnding` mirrors into it);
 * pass a version letter and it reads `kaizoSidebFor`, the single expression
 * `buildKaizoScene` stamps that flag from. Either way there is one source.
 *
 * A LOSS is not this function's business: `ptb02Con8` reports `'loss'` for one
 * (con 9 on both routes) and a driver must ask it, not this. This answers only
 * "if the player wins THIS build, which cutscene".
 */
export function kaizoEndingRouteFor(versionOrState) {
  if (typeof versionOrState === 'string') {
    return kaizoSidebFor(versionOrState) ? 'bside' : 'aside';
  }
  const k = versionOrState?.kaizo;
  if (!k) return 'aside';
  const flag = k.flag?.[FLAG_WEIRD_ROUTE];
  const sideb = flag === undefined ? !!k.sideb : !!flag;
  return sideb ? 'bside' : 'aside';
}
