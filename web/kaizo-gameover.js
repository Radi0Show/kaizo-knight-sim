// THE B-SIDE GAME OVER — where neither answer lets you leave.
//
// ── WHY THIS FILE IS ON THIS SIDE OF THE ENGINE LINE ──────────────────────
//
// `render/title.js` draws the Knight's game over and, since knight-sim
// v1.0.44 (`kaizo-gameover-seams`), takes the script as an argument. The
// engine keeps ONE script — the shipping game's — and this file holds the
// mod's, because the words below are EnderCat8's and the vanilla repo must
// not carry them (CLAUDE.md law 7 in spirit: the mod's content lives here).
//
// Everything here is quoted from
// `knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/` v2.3.3, diffed
// against `gml_vanilla_v105/`. Ledger gap G-18.
//
// ── THE GATE IS `gaster_sideb`, NOT A SETTING ─────────────────────────────
//
//     gaster_sideb = global.flag[456];          DEVICE_FAILURE_Create_0:21
//
// The same Weird-Route/Snowgrave flag `obj_knight_enemy`'s Create reads into
// `k_sideb` (`_Create_0.gml:115`). One save flag drives the fight AND its
// game over, so a build on the Weird Route gets both or neither — which is
// why this module takes the same `sideb` the scene does and not a flag of
// its own.
//
// ── PROVENANCE OF THE WORD "PROCEED" ──────────────────────────────────────
//
// The settings hub's UNUSED row becomes PROCEED, in red, and refuses to go
// back (kaizo/ui/proceed.js). It took all three of those from THIS screen.
// The bracketed echo that knight-sim v1.0.42 removed from the settings row
// STAYS here, and that is not an inconsistency: on a choice box every option
// carries a bracketed second line, and when both lines read the same word the
// echo is the whole joke — it is what tells you the two answers are identical
// before you press either one.

import { KNIGHT_GAMEOVER_SCRIPT, GAMEOVER_ENTRY } from '../render/title.js';

/**
 * THE ONE REPLACED LINE IN THE SHIPPED CHAIN.
 *
 * DEVICE_FAILURE's Step is five independent `knight_mode_con` chains, picked
 * by `global.knight_battle_losses`:
 *
 *     con 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 50   FIRST loss
 *     con 20 -> 21 -> 50                                    SECOND, mantle on
 *     con 40 -> 41 -> 42 -> 43 -> 50                        SECOND, no mantle
 *     con 30 -> 32 -> 33 -> 34 -> 50                        THIRD
 *
 * `render/title.js` ships the FIRST-loss chain and says so in its own header:
 * a practice tool restarts constantly, so a loss counter would mean something
 * different here than it does in a playthrough. The B-Side replaces exactly
 * ONE message in that chain — index 1, the `con == 1` block:
 *
 *     global.msg[0] = "\\M0 YOUR LOSS HERE^6& &     IS ALL^6& & BUT GUARANTEED./%"
 *     if (gaster_sideb)
 *         global.msg[0] = "\\M0 YOUR ADVERSARY^6& &IS STRONGER THAN&I EVER COULD HAVE&POSSIBLY IMAGINED./%"
 *
 * `gml_Object_DEVICE_FAILURE_Step_0.gml:274-278`. Same loc id on both
 * (`..._gml_300_0`), which is how the mod replaces a line without adding a
 * string: the B-Side write simply lands on top a statement later.
 *
 * THE OTHER FOUR MESSAGES OF THIS CHAIN ARE UNTOUCHED. He still opens with
 * "VERY INTERESTING", still says "AND YET YOU PERSIST...", "IF YOU ARE SO
 * DETERMINED TO TRY ONCE MORE" and "THEN SHALL WE HASTEN?" — the Weird Route
 * changes what he thinks of your opponent, not what he thinks of you.
 *
 * ── HOW THE ROWS AND THE PAUSE KEY ARE DERIVED ────────────────────────────
 *
 * `&` is the line break and `^6` is a forty-frame pause (obj_writer's Alarm 0
 * table, in render/title.js). `& &` — break, one space, break — is the blank
 * row between phrases. The rows below are the string split on `&` with the
 * leading spaces KEPT: that hand padding is the layout, and there is no
 * centring code anywhere on this screen.
 *
 * The pause key is an index into `rows.join('')`, which is what
 * `typedCount` walks, so a blank row modelled as `''` contributes nothing.
 * " YOUR ADVERSARY" is fifteen characters, so the `^6` sits at 15 — the same
 * position the vanilla line it replaces has its first pause at.
 */
export const SIDEB_FIRSTLOSS_LINE = [
  ' YOUR ADVERSARY', '', 'IS STRONGER THAN', 'I EVER COULD HAVE', 'POSSIBLY IMAGINED.',
];
export const SIDEB_FIRSTLOSS_PAUSE = { 15: 6 };

/**
 * BOTH ANSWERS ARE PROCEED, AND BOTH COME BACK TO THE FIGHT.
 *
 *     if (gaster_sideb) with (_choice) {
 *         NAME[0][0] = "PROCEED#(PROCEED)";
 *         NAME[1][0] = "PROCEED#(PROCEED)";
 *         NAMEX 70 / 190;  NAMEY 180 / 180;  XMAX = 1;  CURX = -1;
 *         fadebuffer = 20;  scr_lerpvar("choice_y_offset", 20, 0, 20);
 *     }
 *
 * `gml_Object_DEVICE_FAILURE_Step_0.gml:380-397`. Every coordinate is the
 * vanilla block's, unchanged — the two options sit exactly where GO BACK and
 * GO FORWARD sat. Only the words moved.
 *
 * AND THE OUTCOME MOVED WITH THEM:
 *
 *     if (global.choice == 0) knight_mode_con = 53;
 *     if (global.choice == 1) { if (gaster_sideb) knight_mode_con = 53;
 *                               else              knight_mode_con = 55; }
 *
 * `:417-442`. 53 is the RETRY arm — white fade, `tempflag[90] = 4`, the party
 * healed, back into the room. 55 is the one that leaves: `tempflag[90] = 1`,
 * `scr_flag_set(1047, 2)`, everyone on 1 HP, on with the chapter. On the
 * Weird Route `con 55` IS UNREACHABLE. There is no way out of this fight
 * except through it.
 *
 * `#` is the newline in `string_hash_to_newline`, so each option is two rows.
 */
export const SIDEB_CHOICES = [
  { name: ['PROCEED', '(PROCEED)'], x: 70, y: 180, con: 53 },
  { name: ['PROCEED', '(PROCEED)'], x: 190, y: 180, con: 53 },
];

/** `knight_mode_con` 53 — the retry arm. Both B-Side answers land here. */
export const CON_RETRY = 53;
/** `knight_mode_con` 55 — the move-on arm. Unreachable on the B-Side. */
export const CON_MOVE_ON = 55;

/**
 * The B-Side first-loss script, as `makeGameOver` wants it: the engine's own
 * five messages with index 1 and the choices swapped out.
 *
 * Built from `KNIGHT_GAMEOVER_SCRIPT` rather than restating it, so a change
 * to the four shared lines reaches this one too and the two cannot drift.
 */
export const SIDEB_GAMEOVER_SCRIPT = {
  lines: KNIGHT_GAMEOVER_SCRIPT.lines.map(
    (l, i) => (i === 1 ? SIDEB_FIRSTLOSS_LINE : l),
  ),
  pauses: KNIGHT_GAMEOVER_SCRIPT.pauses.map(
    (p, i) => (i === 1 ? SIDEB_FIRSTLOSS_PAUSE : p),
  ),
  choices: SIDEB_CHOICES,
};

/**
 * THE THREE REPLACEMENTS THIS BUILD CANNOT REACH, recorded rather than
 * dropped.
 *
 * The `con 30` chain is the THIRD loss, and it is the only one that needs
 * `global.tempflag[96]` and `scr_flag_get(1263)` — the "you did something
 * remarkable" arm. The mod replaces three of its four messages:
 *
 *     con 32 -> 33   " I FELT IT THERE^6& &    SHINING."
 *                 -> " BEYOND ALL ODDS^6& & YOU WERE THERE."      :324-327
 *     con 33 -> 34   "   YOUR POWER."   ->  "    THE END."        :334-337
 *     con 34 -> 50   "A LITTLE FURTHER."
 *                 -> "YOU MUST PERSIST^6&A LITTLE LONGER."        :344-347
 *
 * NOT REACHABLE HERE, and the reason is upstream of this file: neither this
 * repo nor knight-sim ships the second- or third-loss chains at all, because
 * neither counts `global.knight_battle_losses`. Carried so the four B-Side
 * replacements G-18 names are all in one place with their receipts, and
 * asserted verbatim against the dump by
 * `kaizo/tools/checks/check-gameover-sideb.mjs` — which is what keeps a
 * recorded-but-unreachable string from quietly rotting.
 *
 * Wiring these is a two-part job listed in the lane report: a loss counter in
 * the driver, and the vanilla 20/30/40 chains in `render/title.js` first.
 */
export const SIDEB_THIRDLOSS_LINES = [
  { con: 33, rows: [' BEYOND ALL ODDS', '', ' YOU WERE THERE.'], pauses: { 16: 6 } },
  { con: 34, rows: ['    THE END.'], pauses: {} },
  { con: 50, rows: ['YOU MUST PERSIST', 'A LITTLE LONGER.'], pauses: { 16: 6 } },
];

/**
 * ENTRY IS UNCONDITIONAL, ON PURPOSE — the third piece of G-18.
 *
 * Vanilla wraps the whole knight-mode setup in a guard:
 *
 *     var previous_times_attempted = scr_get_knight_total_attempts();
 *     if (previous_times_attempted > 0) { knight_mode = true; ... }
 *
 * `gml_vanilla_v105/.../gml_Object_DEVICE_FAILURE_Create_0.gml:30-38`. The mod
 * still COMPUTES the local and never tests it
 * (`gml_kaizo_dump/.../_Create_0.gml:38-40`) — the `if` is simply gone, and
 * the whole body de-indents one level. So under the mod a FIRST loss to the
 * Knight gets the drone, the typewriter and the choice, where the shipping
 * game would have given you the ordinary game over.
 *
 * This recreation has always shown the screen every time, which happens to
 * be the mod's behaviour — but it was never the mod's REASON. It showed the
 * screen every time because a practice tool is entered at the fight and has
 * no first attempt to count. That is right by coincidence, and coincidence is
 * not translation: nothing would have caught a future change on either side.
 *
 * `GAMEOVER_ENTRY.ALWAYS` is that decision made on purpose. The engine seam
 * carries the other answer too — `.GUARDED`, under which `makeGameOver`
 * returns null on attempt zero — so "the mod deleted the guard" is now a
 * choice between two implemented rules rather than the absence of one.
 *
 * NOT `sideb`-GATED. The guard deletion is in the Create, outside every
 * `gaster_sideb` test; the A-Side recreation gets it too.
 */
export const KAIZO_GAMEOVER_ENTRY = GAMEOVER_ENTRY.ALWAYS;

/**
 * EVERYTHING THE DRIVER NEEDS, IN ONE CALL.
 *
 * `web/kaizo.js` passes the result straight into `makeGameOver`. One function
 * rather than four fields read at the call site, so that "does this build get
 * the B-Side screen?" has exactly one answer and a check can ask it.
 *
 * @param {object}  o
 * @param {boolean} o.sideb         the Weird Route — `global.flag[456]`.
 * @param {boolean} o.finalFailure  `global.tempflag[75]`, below.
 *
 * ── `finalFailure` IS THE ROARING DELTA'S SCRIPTED DEATH ──────────────────
 *
 * `obj_knight_roaring2`'s Other_11, at the end of the finale:
 *
 *     audio_stop_all(); snd_free_all();
 *     global.tempflag[75] = 1; room_goto(PLACE_FAILURE);
 *
 * (`gml_Object_obj_knight_roaring2_Other_11.gml:865`), and DEVICE_FAILURE's
 * Create reads it back:
 *
 *     if (global.tempflag[75] == 1) { knight_alt = 1;
 *                                     heart_marker.visible = false;
 *                                     global.tempflag[75] = 0; }
 *
 * (`_Create_0.gml:32-37`). TWO consequences, and this is the whole of what
 * `knight_alt` does anywhere in the 7,613-entry dump:
 *
 *   1. THE SOUL IS NOT ON THE SCREEN. `heart_marker.visible = false` — you
 *      did not survive long enough to have one.
 *   2. THERE IS NO GLIDE. This path is a `room_goto` straight to
 *      PLACE_FAILURE; `scr_gameover` never ran, so `obj_gameover_init` — the
 *      frozen screenshot and the soul easing up to (312, 80) — never existed.
 *      The Knight is simply already talking.
 *
 * `kaizo/attacks/roaring-final.js:2560` has been writing
 * `state.kaizo.finalFailure` since 2026-09-08 with nothing reading it (the
 * ledger's unwired table, row 13). This is the read.
 */
export function kaizoGameOverOptions({ sideb = false, finalFailure = false } = {}) {
  return {
    entry: KAIZO_GAMEOVER_ENTRY,
    script: sideb ? SIDEB_GAMEOVER_SCRIPT : KNIGHT_GAMEOVER_SCRIPT,
    marker: !finalFailure,
    glide: !finalFailure,
  };
}

/**
 * What the chosen option DOES — off its `con`, never off its index.
 *
 * This is the difference the whole seam exists for. `web/kaizo.js` used to
 * read `chosen === 0 ? reset() : exitRun()`, which on the B-Side would send
 * the second PROCEED to the mode menu: a way out of a fight whose game-over
 * screen offers none, reachable by pressing right once. `con` is the game's
 * own answer and it is on the option, so two identical options give two
 * identical outcomes without the driver knowing anything about routes.
 *
 * @returns {'retry'|'moveOn'} — `moveOn` is unreachable on the Weird Route.
 */
export function gameOverOutcome(con) {
  return con === CON_MOVE_ON ? 'moveOn' : 'retry';
}
