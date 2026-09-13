// THE PAGE'S HALF OF THE PRE-FIGHT — the music router's consumer, and the
// mode select's driver. DOM-FREE ON PURPOSE: web/kaizo.js owns the elements
// and the keys; everything decidable lives here so a check can drive it
// headlessly (the same split web/kaizo-epilogue.js uses for its cue names).
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// The translation is kaizo/scenes/kaizo-prefight.js; read its header first.
// This file is only the wiring: which directory a routed filename lives in,
// which cue it replaces, and the frame-by-frame drive of the four-option
// menu.

import {
  kaizoSetMusic,
  kaizoMusicPlayable,
  musFileExists,
  MUS_KNIGHT,
  MUS_KNIGHT_APPEARS,
  MUS_KAIZOKNIGHT,
  MUS_KAIZOKNIGHT_ALT,
  MUS_ENDER_THEIRTHEME,
  MUS_ENDER_APPEARANCE,
  KAIZO_MUS_ALT_STEM,
  CHOICE_PRACTICE,
  CHOICE_NOHIT,
  CHOICE_STANDARD,
  CHOICE_RETURN,
  MODE_CHOICES_EN,
  createPrefight,
  createPrefightGlobals,
  prefightStepTop,
  prefightConTwo,
  stepPrefight,
} from '../kaizo/scenes/kaizo-prefight.js';

// ── WHICH FOLDER A ROUTED FILENAME COMES FROM ─────────────────────────────
//
// The mod looks in ONE place, `working_directory + "../mus/"` — the game's
// own music folder, where a player drops the optional songs. This build has
// two: `assets/audio/` (the vanilla pack the player extracts, listed by its
// own `index.json`) and `kaizo/assets/audio/` (the mod's optional songs,
// publish-gated by that directory's `.gitignore` because they are not ours
// to ship). So "does `../mus/` have it" is answered by the UNION of the two,
// and the answer to "where do I load it from" is this table.
//
// THE FOUR OPTIONAL NAMES ARE THE MOD'S, so they live in the mod's folder;
// `knight.ogg` and `knight_appears.ogg` are vanilla and come out of the base
// pack, which already has cue entries for both and therefore needs no
// override at all.
export const KAIZO_MUS_NAMES = Object.freeze([
  MUS_KAIZOKNIGHT,
  MUS_KAIZOKNIGHT_ALT,
  MUS_ENDER_THEIRTHEME,
  MUS_ENDER_APPEARANCE,
]);

/** The cue names `render/audio.js` keys the two routed tracks under. */
export const CUE_FIGHT = 'mus_knight';
export const CUE_ARRIVAL = 'knight_appears';

/**
 * THE ONE DEVIATION THIS FILE MAKES, stated where it is made.
 *
 * On the Weird Route the router returns the extension-less stem
 * `"kaizoknight_alt"` whenever `kaizoknight.ogg` is present and
 * `kaizoknight_alt.ogg` is not — which is every install that took the
 * release zip, because the zip ships only `kaizoknight.ogg`. In the real mod
 * that stem goes to a `snd_init` patched to look the name up in the data
 * file's SOUND TABLE (`asset_get_type(arg0) == 2`), and whether it resolves
 * is not decidable from any GML dump. Here it resolves to nothing, so being
 * literal would mean A SILENT B-SIDE FIGHT.
 *
 * So: when the router's answer is not playable, this falls back to the last
 * answer that was, and SAYS SO in the returned record (`deviation`). It is
 * not a repair of the mod — `kaizoSetMusic` itself is untouched and still
 * returns the stem — it is this page choosing audible over literal at the
 * one place the mod's behaviour cannot be known. `verdict` carries the
 * router's own word so a check can assert the faithful value and the played
 * value separately, and they are asserted separately.
 */
export const STEM_FALLBACK_NOTE =
  'kaizo_set_music returned the extension-less stem "kaizoknight_alt" '
  + '(kaizoknight_alt.ogg is absent). The real mod hands that to a patched '
  + 'snd_init that can resolve it from the data file\'s sound table; this '
  + 'page cannot, so it plays kaizoknight.ogg instead of nothing.';

/**
 * Resolve both routed tracks against a real `../mus/` listing.
 *
 * @param {object} opts
 * @param {Iterable<string>} opts.musFiles  every filename the two audio
 *   folders actually hold — the real `file_exists` domain.
 * @param {Record<string,string>} [opts.baseManifest]  `assets/audio/index.json`,
 *   cue -> file. Used only to tell "the base pack already serves this cue"
 *   from "this cue needs an override".
 * @param {boolean} opts.flag456  the Snowgrave flag — B-Side or not.
 * @param {string} [opts.kaizoDirUrl]  where the mod's optional songs live.
 * @returns {{overrides: Record<string,string>, fight: object, arrival: object}}
 */
export function resolveKaizoMusic({
  musFiles,
  baseManifest = {},
  flag456 = false,
  kaizoDirUrl = '',
} = {}) {
  const fileExists = musFileExists(musFiles);
  const overrides = {};

  const decide = (arg0, cue) => {
    // `global.tempflag` — passed so the mod's two dead writes to index 76
    // actually happen, exactly as they do in the game. NOTHING READS THIS,
    // and check-prefight-music.mjs asserts that nothing does. See bug 3 in
    // kaizo/scenes/kaizo-prefight.js.
    const tempflag = {};
    const verdict = kaizoSetMusic(arg0, { fileExists, flag456, tempflag });
    const playable = kaizoMusicPlayable(verdict, fileExists);
    let file = verdict;
    let deviation = null;
    if (!playable) {
      if (verdict === KAIZO_MUS_ALT_STEM) {
        deviation = STEM_FALLBACK_NOTE;
        // The branch directly above the stem's in the GML: the A-Side answer
        // for the same install, which `file_exists` has just vouched for.
        file = MUS_KAIZOKNIGHT;
      } else {
        // Nothing else the router can return is unplayable on an install
        // that has the base pack; if it happens, leave the cue alone rather
        // than invent a file.
        file = null;
      }
    }
    // An override is only needed when the answer differs from what the base
    // pack already serves for that cue. Registering `knight.ogg` as an
    // override of `mus_knight` would be a no-op that hides the real case.
    if (file && baseManifest[cue] !== file) {
      overrides[cue] = KAIZO_MUS_NAMES.includes(file) ? `${kaizoDirUrl}${file}` : file;
    }
    return {
      arg0, cue, verdict, playable, file, deviation, tempflag76: tempflag[76],
    };
  };

  // `gml_Object_obj_ch3_PTB02_Step_0.gml:560` and `:199`, the mod's only two
  // callers, in the order the encounter reaches them.
  const arrival = decide(MUS_KNIGHT_APPEARS, CUE_ARRIVAL);
  const fight = decide(MUS_KNIGHT, CUE_FIGHT);
  return { overrides, arrival, fight };
}

// ── THE MODE SELECT, DRIVEN ───────────────────────────────────────────────
//
// The translation is a GML Step machine; a web page is not a GML room. This
// is the adapter, and it keeps the machine's shape rather than reimplementing
// the menu: the page tells it when the choicer is up and what the player
// picked, and reads `con` and `global.knight_mode` back out. The machine
// decides; this decides nothing.
//
// WHY IT IS NOT A PIXEL RECREATION OF `obj_choicer_neo`: that renderer is not
// this lane's (kaizo/render/** belongs to the epilogue lane) and inventing
// one here would ship an invented widget under a KAIZO label. The page draws
// the four rows as plain DOM, LABELLED as a stand-in. The strings, the order,
// the leading newlines and the routing are the mod's; the pixels are not, and
// the page says so.

export { CHOICE_PRACTICE, CHOICE_NOHIT, CHOICE_STANDARD, CHOICE_RETURN, MODE_CHOICES_EN };

/** `global.knight_mode` -> the name `buildKaizoScene({ mode })` takes. */
export const MODE_NAME_BY_CHOICE = Object.freeze({
  [CHOICE_PRACTICE]: 'practice',
  [CHOICE_NOHIT]: 'nohit',
  [CHOICE_STANDARD]: 'standard',
});

/**
 * Build the pre-fight, run con 2, and park it at con 3.2 — the state the
 * sword-draw hands over in (`con == 3.1 && customcon == 1` sets `con = 3.2`,
 * `:351-353`; in vanilla and in retail chapter 3 that same line reads
 * `con = 4`, which is the whole diff).
 *
 * @param {object} opts
 * @param {boolean|number} opts.kaizoPractice `global.kaizo_practice` (G-9's
 *   settings sign is not translated; web/kaizo.js says where the page gets
 *   this instead, and that it is a stand-in).
 * @param {number[]} [opts.char] `global.char` on the way in. Anything but
 *   `[1, 2, 3]` arms `char_change`.
 * @param {boolean} [opts.flag456]
 */
export function openModeSelect({ kaizoPractice = 0, char = [1, 2, 3], flag456 = false } = {}) {
  const w = createPrefightGlobals({
    kaizo_practice: kaizoPractice ? 1 : 0,
    char: [...char],
    flag: { 456: flag456 ? 1 : 0 },
  });
  const pf = createPrefight();
  prefightStepTop(pf, w);
  prefightConTwo(pf, w);
  pf.con = 3.2;
  // The first Step at con 3.2: either the choicer goes up, or `_doprac` is
  // off and the machine falls straight through to con 4 with Standard — in
  // ONE frame, which is what the GML does and why the page never flashes a
  // menu for a player who has not turned practice on.
  const effects = stepPrefight(pf, w);
  return { pf, w, effects };
}

/**
 * The page saw the choicer appear. (`i_ex(obj_choicer_neo)` goes true.)
 */
export function modeSelectChoicerUp({ pf, w }) {
  w.choicerUp = true;
  return stepPrefight(pf, w);
}

/**
 * The player picked a row: the choicer writes `global.choice` and destroys
 * itself, and con 3.4's `!i_ex(obj_choicer_neo)` fires on the next Step.
 */
export function modeSelectChoose({ pf, w }, choice) {
  w.choice = choice;
  w.choicerUp = false;
  return stepPrefight(pf, w);
}

/**
 * The No Hit hint's writer closed (`!d_ex()`), con 3.5 -> con 4.
 */
export function modeSelectHintDone({ pf, w }) {
  w.dialoguerUp = false;
  return stepPrefight(pf, w);
}

/** TRUE once the machine has reached the fight. `con == 4`, `:501`/`:506`. */
export function modeSelectReady(pf) {
  return pf.con === 4;
}

/**
 * The `mode` string for `buildKaizoScene`, or `undefined` when the machine
 * has not committed one.
 *
 * `undefined` IS A REAL VALUE HERE and not a "not ready" sentinel: it models
 * `variable_global_exists("knight_mode") == false`, the state every byte-gate
 * recording is in. It cannot be reached through this function once con 3.2
 * has run — the global is written unconditionally there — which is exactly
 * why the page passing a mode is a behaviour change and passing nothing is
 * not. kaizo/scenes/kaizo-fight.js's `applyKnightMode` note has the rest.
 */
export function modeSelectKnightMode({ w }) {
  return w.knight_mode === undefined ? undefined : MODE_NAME_BY_CHOICE[w.knight_mode];
}
