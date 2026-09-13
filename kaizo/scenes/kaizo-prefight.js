// KAIZO — THE PRE-FIGHT: the mode select, and the music router (ledger G-9).
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission. Everything below is read out of a private research dump
// of another author's work (kaizo/HANDOFF.md §5-C).
//
// ── WHY THIS MODULE EXISTS, AND WHY IT IS ONE MODULE ──────────────────────
//
// This is the LAST THING BEFORE THE FIGHT, and in the mod it is two pieces of
// code that only make sense together:
//
//   * `gml_Object_obj_ch3_PTB02_Step_0.gml:1-8, 58-66, 437-528, 548-582, 606-616`
//     — the encounter room's own Step machine. EnderCat8 redirected its
//     `con 3.1` arm from `con = 4` (straight into the fight) to `con = 3.2`,
//     and hung a four-way mode select off it. That select is the ONLY writer
//     of `global.knight_mode`, which is the ONLY thing that turns on
//     `practicemode` / `nohitmode` — fourteen already-translated branches in
//     kaizo/party/ and kaizo/scenes/ that had a consumer
//     (`applyKnightMode`, kaizo/scenes/kaizo-fight.js) and no producer.
//   * `gml_GlobalScript_kaizo_settings_init.gml:27-77` — `kaizo_set_music`,
//     a FILE-EXISTENCE ROUTER, called from exactly two places, both of them
//     in that same Step: the arrival cue at :199 and the battle track at
//     :560. Nothing else in the mod calls it.
//
// Both halves were confirmed to be EnderCat8's and not chapter-build churn by
// diffing the mod's dump against `gml_vanilla_v105/` AND checking retail
// chapter 3 (`knight-research/gml_dump/CodeEntries`): the v105 copy of
// PTB02's Step has none of it, retail ch3's `con == 3.1` arm still reads
// `con = 4` (`gml_dump/.../gml_Object_obj_ch3_PTB02_Step_0.gml:338-340`), and
// `kaizo_set_music` appears in neither retail dump at all.
//
// ── WHAT IS *NOT* HERE ────────────────────────────────────────────────────
//
// The SETTINGS SIGN (`obj_npc_sign`, G-10) is the producer of
// `global.kaizo_practice` — the `_doprac` this machine branches on — and of
// the party the Weird Route fields. It is a different object and a different
// lane; this module takes `kaizo_practice` as an input and says so.
//
// The post-fight fork (`con == 49 && global.flag[456] -> con = 49.1`,
// :606-616) and everything downstream of it is the epilogue's
// (kaizo/scenes/kaizo-ending.js). The ONE line of that hunk translated here
// is `if (char_change) global.char = [1, 2, 3]` — it is the closing half of
// the `char_change` mechanism this module opens, and splitting a
// save/restore pair across two modules is how a restore quietly stops
// happening.

import { gmlEq } from '../../sim/gml.js';

// ═══════════════════════════════════════════════════════════════════════════
// §1  kaizo_set_music — THE FILE-EXISTENCE MUSIC ROUTER
// ═══════════════════════════════════════════════════════════════════════════
//
// `gml_GlobalScript_kaizo_settings_init.gml:27-77`, verbatim:
//
//     function kaizo_set_music(arg0 = "")
//     {
//         var dir = working_directory + "../mus/";
//         if (arg0 == "")                       return "";
//         if (arg0 == "knight_appears.ogg")
//         {
//             if (file_exists(dir + "ender_theirappearance.ogg"))
//                 return "ender_theirappearance.ogg";
//             else
//                 return arg0;
//         }
//         if (arg0 == "knight.ogg")
//         {
//             if (file_exists(dir + "kaizoknight.ogg"))
//             {
//                 if (global.flag[456])
//                 {
//                     if (file_exists(dir + "kaizoknight_alt.ogg"))
//                     {
//                         global.tempflag[76] = 1;
//                         return "kaizoknight_alt.ogg";
//                     }
//                     else
//                     {
//                         global.tempflag[76] = 0;
//                         return "kaizoknight_alt";
//                         var _devcomm = "...'NUZLOCKE' by W. D. Gaster";
//                     }
//                 }
//                 else                            return "kaizoknight.ogg";
//             }
//             else if (file_exists(dir + "ender_theirtheme.ogg"))
//                                                 return "ender_theirtheme.ogg";
//             else                                return arg0;
//         }
//     }
//
// THE POINT OF IT: the mod ships with NO music of its own. `kaizoknight.ogg`
// is a "custom song (optional)" the player drops into the game's `mus/`
// folder, and this router is how the mod copes with every combination of
// which optional file a given install actually has. So the ROUTER is the
// deliverable and the FILES ARE NOT: on an install that has only
// `kaizoknight.ogg`, the Weird Route correctly falls back to it. That is the
// faithful outcome, not a failure, and `fileExists` is a real test against a
// real directory listing at every call site (web/kaizo.js probes the two
// audio folders; check-prefight-music.mjs reads them off disk).
//
// ── THREE ORIGINAL BUGS, PRESERVED AND LABELLED (CLAUDE.md law 4) ─────────
//
// BUG 1 — THE MISSING SUFFIX, and it is NOT certainly a bug. The
//   `kaizoknight_alt.ogg` MISS branch returns `"kaizoknight_alt"`, with no
//   `.ogg`. Every other branch returns a filename; this one returns a stem.
//
//   WHAT HAPPENS TO IT DEPENDS ON THE DATA FILE, not on the GML. EnderCat8
//   also patched `snd_init` (diffed against v105, the whole change):
//
//       if (asset_get_type(arg0) == 2)  _mystream = asset_get_index(arg0);
//       else                            _mystream = audio_create_stream(dir + arg0);
//
//   — `asset_type_sound`. So an extension-less name is exactly how the mod
//   hands `snd_init` an INTERNAL sound asset instead of a loose file, and
//   this branch may be deliberate: "no `kaizoknight_alt.ogg` on disk? then
//   try a bundled sound called `kaizoknight_alt`." Whether one exists is in
//   the data file's sound table, which no GML dump can answer — the string
//   `kaizoknight_alt` IS in the mod's string pool
//   (`knight-research/kaizo-mod/v2.3.3/strings-new.txt:809`), but so is the
//   literal in this function, so that proves nothing either way. The
//   COMPLETE-DIFF-LEDGER's adversarial pass reaches the same verdict (§7,
//   "kaizo_set_music's asset-name branch").
//
//   TRANSLATED AS-IS AND NOT DECIDED. The stem is returned verbatim,
//   `KAIZO_MUS_ALT_STEM` is exported so a consumer can *recognise* it
//   without this module pretending it is a filename, and
//   `kaizoMusicPlayable` reports FALSE for it — which is the honest answer
//   for THIS recreation, whose audio layer has files and no sound table.
//   Resolving it needs a UTMT dump of the mod's sound assets; until then,
//   do not "fix" the missing `.ogg`.
//
// BUG 2 — THE FLAG IS BACKWARDS ON THAT BRANCH. The HIT branch sets
//   `global.tempflag[76] = 1` and the MISS branch sets it to 0 — but 0 is
//   also its resting value, so the write carries no information. It does not
//   matter, because of bug 3.
//
// BUG 3 — `global.tempflag[76]` IS WRITTEN IN THESE TWO PLACES AND READ
//   NOWHERE IN THE MOD. Grepped over the whole dump: the only two hits are
//   the two writes above. It is translated as the DEAD WRITE it is — the
//   `tempflag` bag is optional, and check-prefight-music.mjs asserts BOTH
//   that the write happens AND that nothing in this repo reads index 76, so
//   the day someone invents a consumer the check says so. Do not invent one.
//
// BUG 4 (dead code, not a behaviour) — the statement after that `return` is
//   `var _devcomm = "...";`, unreachable. Recorded, not executed.
//
// AND ONE MORE THING THE GML DOES: there is no final `return`. Called with
// anything that is not `""`, `"knight_appears.ogg"` or `"knight.ogg"`, it
// falls off the end and yields `undefined`. Both live call sites pass one of
// the two literals, so it never happens in the mod — but a translation that
// invented a `return arg0` there would be inventing, so this returns
// `undefined` too and the checks pin it.

/** The two arguments the mod ever passes. Anything else falls off the end. */
export const MUS_KNIGHT_APPEARS = 'knight_appears.ogg';
export const MUS_KNIGHT = 'knight.ogg';

/** The optional files the router looks for, in `../mus/`. */
export const MUS_ENDER_APPEARANCE = 'ender_theirappearance.ogg';
export const MUS_ENDER_THEIRTHEME = 'ender_theirtheme.ogg';
export const MUS_KAIZOKNIGHT = 'kaizoknight.ogg';
export const MUS_KAIZOKNIGHT_ALT = 'kaizoknight_alt.ogg';

/**
 * BUG 1's return value — a stem, not a file. Exported so a consumer can test
 * for it (`result === KAIZO_MUS_ALT_STEM`) instead of hard-coding a string
 * that looks like a typo and would be "tidied" by the next reader.
 */
export const KAIZO_MUS_ALT_STEM = 'kaizoknight_alt';

/**
 * `file_exists(working_directory + "../mus/" + name)` over a known listing.
 *
 * @param {Iterable<string>} names the FILENAMES the directory actually holds.
 * @returns {(name: string) => boolean}
 */
export function musFileExists(names) {
  const set = new Set(names);
  return (name) => set.has(name);
}

/**
 * `kaizo_set_music(arg0)`.
 *
 * @param {string} [arg0] the GML default is `""`.
 * @param {object} opts
 * @param {(name: string) => boolean} opts.fileExists  `file_exists` over `../mus/`.
 * @param {boolean|number} [opts.flag456]  `global.flag[456]` — the Snowgrave
 *   flag, i.e. "this is the B-Side". Same flag `k_sideb` reads
 *   (`gml_Object_obj_knight_enemy_Create_0.gml:115`).
 * @param {Record<number, number>|number[]} [opts.tempflag]  `global.tempflag`.
 *   Optional, and writing it changes nothing — see bug 3.
 * @returns {string|undefined} a filename, the bug-1 stem, or `undefined`.
 */
export function kaizoSetMusic(arg0 = '', opts = {}) {
  const { fileExists, flag456 = false, tempflag } = opts;
  if (typeof fileExists !== 'function') {
    // A router with no directory to look at would answer every question with
    // "absent" and look like it worked. The mod's `file_exists` is never
    // optional, so neither is this.
    throw new Error('kaizoSetMusic: opts.fileExists is required (file_exists over ../mus/)');
  }
  if (arg0 === '') return '';
  if (arg0 === MUS_KNIGHT_APPEARS) {
    return fileExists(MUS_ENDER_APPEARANCE) ? MUS_ENDER_APPEARANCE : arg0;
  }
  if (arg0 === MUS_KNIGHT) {
    if (fileExists(MUS_KAIZOKNIGHT)) {
      if (flag456) {
        if (fileExists(MUS_KAIZOKNIGHT_ALT)) {
          // BUG 2/3: a dead write, kept because it is in the original.
          if (tempflag) tempflag[76] = 1;
          return MUS_KAIZOKNIGHT_ALT;
        }
        // BUG 2/3 again, and BUG 1: the stem, with no `.ogg`.
        if (tempflag) tempflag[76] = 0;
        return KAIZO_MUS_ALT_STEM;
        // BUG 4: `var _devcomm = "feels like a good time to mention that the
        // secret song is 'NUZLOCKE' by W. D. Gaster";` — unreachable.
      }
      return MUS_KAIZOKNIGHT;
    }
    if (fileExists(MUS_ENDER_THEIRTHEME)) return MUS_ENDER_THEIRTHEME;
    return arg0;
  }
  // No final return in the GML either.
  return undefined;
}

/**
 * TRUE when the router's answer names a file that is actually there.
 *
 * The point is bug 1: the stem is the ONE answer the router gives that its
 * own `file_exists` never vouched for. Every other return either is a file
 * the router just proved present, or is `arg0` itself (a vanilla track the
 * base pack has). So this is the test a consumer needs before it cues
 * anything — and it answers FALSE for the stem, which is right for an audio
 * layer made of files. It would be WRONG for the real game, where
 * `snd_init`'s patched `asset_get_type` arm may resolve the stem out of the
 * data file's sound table; that is stated at bug 1 and is not decidable
 * here.
 */
export function kaizoMusicPlayable(result, fileExists) {
  return typeof result === 'string' && result !== '' && fileExists(result);
}

// ═══════════════════════════════════════════════════════════════════════════
// §2  THE PRE-FIGHT STATE MACHINE — obj_ch3_PTB02's Step, con 2 .. con 8
// ═══════════════════════════════════════════════════════════════════════════
//
// A GML Step event runs EVERY `if (con == …)` block top to bottom in one
// frame, so a block that advances `con` can be followed by the block it
// advanced into, in the same frame. That fall-through is load-bearing here
// and is reproduced exactly:
//
//   * `_doprac` FALSE: con 3.2's else-arm sets `global.choice = 2` and
//     `con = 3.4` — and con 3.4's block is BELOW it, so the dispatch runs on
//     the SAME frame and the fight starts without a frame of menu.
//   * `_doprac` TRUE: con 3.2 sets `con = 3.3` and creates `obj_dialoguer`.
//     con 3.3 tests `i_ex(obj_choicer_neo)`, and the choicer does not exist
//     yet on that frame (the dialoguer makes it), so it waits.
//   * con 3.4's own guard is `!i_ex(obj_choicer_neo)` — it waits for the
//     choicer to GO AWAY, which is what "the player pressed a button" looks
//     like from here.
//
// `exit` on the Return arm exits the whole Step event: nothing below it runs
// that frame. `stepPrefight` models that by returning immediately.
//
// ── THE FOUR CHOICES, AND WHY THE `else` IS NOT "STANDARD" ────────────────
//
// `:475-502`. The dispatch is a three-way test over `global.choice`:
//
//     if      (global.choice == 3)  { ...restore, room_restart(), exit }  // Return
//     else if (global.choice == 1)  { ...ESC hint; con = 3.5;  knight_mode = choice }
//     else                          { con = 4;                 knight_mode = choice }
//
// The `else` is EVERY choice that is not 3 and not 1 — 0 (Practice) as well
// as 2 (Standard). Reading it as "Standard only" makes Practice unreachable
// and leaves `practicemode` permanently off, which is the exact shape of the
// bug this repo keeps finding. kaizo/scenes/kaizo-fight.js's own note on
// `applyKnightMode` says the same thing from the consumer's side.

/** `global.choice` values the choicer produces, in `global.choicemsg` order. */
export const CHOICE_PRACTICE = 0;
export const CHOICE_NOHIT = 1;
export const CHOICE_STANDARD = 2;
export const CHOICE_RETURN = 3;

/**
 * `global.choicemsg[0..3]`, :452-455 — the four rows, ENGLISH.
 *
 * The leading `\n` on rows 0 and 1 and its absence on 2 and 3 is the mod's
 * own vertical alignment, not a transcription slip: "Practice" and "No Hit"
 * are pushed down a line so the two-line Japanese "ノーヒット\nモード" lines
 * up with them. Dropping them moves the menu.
 */
export const MODE_CHOICES_EN = Object.freeze([
  '\nPractice',
  '\nNo Hit',
  'Standard',
  'Return',
]);

/**
 * The `k_stringsetloc` second arguments, :452-455 — JAPANESE.
 *
 * Row 3 is `"装備"` — "EQUIPMENT", not "Return". The English says what the
 * choice DOES (it leaves the encounter) and the Japanese says where it takes
 * you (the dark-world equip menu, which is what `con 3.7` re-opens). Both are
 * the mod's; neither is a better translation of the other.
 */
export const MODE_CHOICES_JA = Object.freeze([
  '\n練習',
  '\nノーヒット\nモード',
  '通常モード',
  '装備',
]);

/** `:483-484` — the line No Hit prints before the fight. */
export const NOHIT_HINT_EN = '* (Press ESC at any time to exit No Hit mode.)/%';
export const NOHIT_HINT_JA = '＊（ESCキーを押すと&　ノーヒットモードを解除できます。)/%';

/**
 * `:450` — `global.msg[0] = "\C4"`, the writer's four-way-choice control
 * code. (The decompiler prints it `"\\C4"`; the runtime string is `\C4`.)
 * `sim/dialogue.js:258` already documents `\C<n>` as halt mode 5, the
 * choicer, so this is the code that page's writer would act on.
 */
export const MSG_CHOICE4 = '\\C4';
/** `:471` — what replaces it once the choicer is up. */
export const MSG_CLEAR = '%%';

/** `global.char` for the vanilla three, the value con 3.7 and con 8 force. */
export const VANILLA_CHAR = Object.freeze([1, 2, 3]);

/** Noelle's floor, `:2-6`. */
export const NOELLE_CHAR_ID = 4;
export const NOELLE_MIN_MAXHP = 120;

/**
 * The globals this machine reads and writes. A plain bag on purpose: every
 * field is a `global.*` the GML names, so a check can assert the mod's own
 * variable and not a field this translation invented.
 */
export function createPrefightGlobals(over = {}) {
  return {
    /** `global.kaizo_practice` — the settings sign's toggle (G-10). */
    kaizo_practice: 0,
    /** `global.kaizo_intro` — read by the sign at `obj_npc_sign_Other_10:423,432`. */
    kaizo_intro: 0,
    /** `global.msc`. */
    msc: 0,
    /**
     * `global.knight_mode`. `undefined` models
     * `variable_global_exists("knight_mode") == false` — the state the
     * oracle recordings are in, because the recorder boots straight into
     * `room_bullettest_new` and PTB02 never runs.
     */
    knight_mode: undefined,
    /** `global.choice`, the choicer's answer. */
    choice: undefined,
    /** `global.char` — three slots, the third often 0. */
    char: [1, 2, 3],
    /** `global.maxhp` / `global.hp`, CHARACTER-indexed. */
    maxhp: [0, 160, 190, 140, 120],
    hp: [0, 160, 190, 140, 120],
    /** `global.flag` — only 456 (Snowgrave) and 9/54 are touched here. */
    flag: {},
    /** `global.tempflag` — 76 (dead) and 90 (the overworld return slot). */
    tempflag: {},
    /** `global.item`, the 12-slot bag plus the mod's 13th read. */
    item: [],
    /** `global.knight_battle_items` — absent until the Standard arm writes it. */
    knight_battle_items: undefined,
    /** `global.interact`, `global.menuno`, `global.msg`, `global.choicemsg`. */
    interact: 0,
    menuno: 0,
    msg: [],
    choicemsg: [],
    /** `scr_speaker(...)`'s argument, last set. */
    speaker: null,
    /** `i_ex(obj_choicer_neo)` and `d_ex()` — supplied by whoever drives this. */
    choicerUp: false,
    dialoguerUp: false,
    ...over,
  };
}

/**
 * The room object's own instance variables.
 *
 * `rem_char` / `char_change` are `obj_ch3_PTB02`'s, not globals — which is
 * why they survive the whole encounter and can still be read at con 8.
 */
export function createPrefight(over = {}) {
  return {
    con: 2,
    /** `_doprac`, re-read from `global.kaizo_practice` at the top of EVERY Step. */
    doprac: 0,
    /** `:59` — the party as it was when the encounter began. */
    rem_char: [...VANILLA_CHAR],
    /** `:60` — "the sign changed the party and we had to put it back". */
    char_change: 0,
    /** `alarm[0]`, set to 5 by con 3.7. */
    alarm0: -1,
    /** JAPANESE strings instead of English, `k_stringsetloc`'s two arms. */
    japanese: false,
    /** Everything the machine DID, in order — the checks read this. */
    effects: [],
    ...over,
  };
}

function emit(pf, type, detail) {
  const ev = { type, con: pf.con, ...detail };
  pf.effects.push(ev);
  return ev;
}

/**
 * `:1-8`, the TOP of the Step, before every `if (con == …)`:
 *
 *     var _doprac = global.kaizo_practice;
 *     if (global.maxhp[4] < 120)
 *     {
 *         global.maxhp[4] = 120;
 *         global.hp[4] = 120;
 *     }
 *
 * NOELLE'S FLOOR, and it runs on every frame of the encounter, not once.
 * Character 4 is Noelle; 120 is the Weird Route roster's maxhp
 * (kaizo/party/noelle.js, WEIRD-ROUTE.md §2). A Weird Route save arrives here
 * with whatever chapter-3 Noelle had, and the mod raises the floor AND heals
 * her to it — `global.hp[4] = 120` is not clamped to the old hp, so a Noelle
 * who walked in hurt is walked in healed. That is the mod's, not a mercy this
 * translation added.
 *
 * It is UNCONDITIONAL — no `flag[456]` test — so an A-Side run that somehow
 * has Noelle in the party gets it too.
 */
export function prefightStepTop(pf, w) {
  pf.doprac = w.kaizo_practice;
  if (w.maxhp[NOELLE_CHAR_ID] < NOELLE_MIN_MAXHP) {
    w.maxhp[NOELLE_CHAR_ID] = NOELLE_MIN_MAXHP;
    w.hp[NOELLE_CHAR_ID] = NOELLE_MIN_MAXHP;
    emit(pf, 'noelle-maxhp-floor', { maxhp: NOELLE_MIN_MAXHP });
  }
  return pf.doprac;
}

/**
 * `:58-70` — con 2, where `rem_char` / `char_change` are born:
 *
 *     rem_char = [global.char[0], global.char[1], global.char[2]];
 *     char_change = 0;
 *     if (rem_char[0] != 1 || rem_char[1] != 2 || rem_char[2] != 3)
 *     {
 *         scr_refreshchar();
 *         scr_reset_caterpillars(1, 2, 3);
 *         char_change = 1;
 *     }
 *
 * THE WHOLE CUTSCENE IS HARD-CODED FOR KRIS/SUSIE/RALSEI. The mod's settings
 * sign lets a player field any party — Kris and Noelle above all — and the
 * arrival cutscene's actors, positions and lines assume the vanilla three. So
 * the mod REMEMBERS the real party, forces `[1, 2, 3]` for the cutscene, and
 * puts the real one back at `scr_battle` time (§3). `char_change` is the
 * one-bit "we did that" it carries between the two, and it is read in three
 * places: :565 (put it back for the fight), :477 (put it back before a
 * room_restart) and :609 (put the vanilla three back after the fight).
 *
 * The test is `!=` on three small integers — exact, not epsilon — so it is a
 * plain `!==` here.
 *
 * NOT MODELLED, and named rather than dropped: `scr_refreshchar()` and
 * `scr_reset_caterpillars(1, 2, 3)` are overworld actor/caterpillar plumbing
 * with nothing in this recreation to act on. The flag they set is the part
 * the fight can observe, and that is translated.
 */
export function prefightConTwo(pf, w) {
  pf.rem_char = [w.char[0], w.char[1], w.char[2]];
  pf.char_change = 0;
  if (pf.rem_char[0] !== 1 || pf.rem_char[1] !== 2 || pf.rem_char[2] !== 3) {
    // scr_refreshchar(); scr_reset_caterpillars(1, 2, 3);
    pf.char_change = 1;
    emit(pf, 'char-change-armed', { rem_char: [...pf.rem_char] });
  }
  pf.con = 3;
  return pf.char_change;
}

/**
 * ONE Step event's worth of the mode select: `:437-528`, blocks in source
 * order, with the fall-through the GML has.
 *
 * @param {*} pf   from createPrefight
 * @param {*} w    from createPrefightGlobals
 * @returns {Array} the effects this frame produced (also appended to pf.effects)
 */
export function stepPrefight(pf, w) {
  const before = pf.effects.length;

  // ── con 3.2 — :437-461. The commit point: the global is CREATED here, and
  // `kaizo_settings_save()` writes `Intro = 1` to dr.ini so the settings sign
  // stops offering the intro (`obj_npc_sign_Other_10:423, 432` reads it).
  if (gmlEq(pf.con, 3.2)) {
    pf.con = 3.3;
    w.msc = -1;
    // :444 — UNCONDITIONAL, and it is what makes
    // `variable_global_exists("knight_mode")` true from here on, whatever is
    // chosen next. A player who backs out with Return leaves it at 0, which
    // is Practice; nothing reads it on that path because the room restarts.
    w.knight_mode = 0;
    w.kaizo_intro = 1;
    emit(pf, 'settings-save', { kaizo_intro: 1 });
    if (pf.doprac) {
      w.speaker = 'none';
      w.msg[0] = MSG_CHOICE4;
      const rows = pf.japanese ? MODE_CHOICES_JA : MODE_CHOICES_EN;
      w.choicemsg[0] = rows[0];
      w.choicemsg[1] = rows[1];
      w.choicemsg[2] = rows[2];
      w.choicemsg[3] = rows[3];
      // `with (instance_create(0, 0, obj_dialoguer)) side = 1;`
      w.dialoguerUp = true;
      emit(pf, 'choicer-open', { rows: [...rows], side: 1 });
    } else {
      // :458-460 — no menu at all, and the answer is Standard.
      w.choice = CHOICE_STANDARD;
      pf.con = 3.4;
      emit(pf, 'choicer-skipped', { choice: CHOICE_STANDARD });
    }
  }

  // ── con 3.3 — :464-468. Waits for the choicer to EXIST, then blanks the
  // control code so the writer stops re-raising it.
  if (gmlEq(pf.con, 3.3) && w.choicerUp) {
    pf.con = 3.4;
    w.msg[0] = MSG_CLEAR;
  }

  // ── con 3.4 — :470-502. Waits for the choicer to be GONE, then dispatches.
  if (gmlEq(pf.con, 3.4) && !w.choicerUp) {
    w.interact = 1;
    if (gmlEq(w.choice, CHOICE_RETURN)) {
      // :473-482 — LEAVE. Put the player's real party back first, or the
      // restarted room inherits the cutscene's forced Kris/Susie/Ralsei.
      if (pf.char_change) {
        w.char = [pf.rem_char[0], pf.rem_char[1], pf.rem_char[2]];
      }
      w.tempflag[90] = 0;
      w.interact = 0;
      // instance_create(0, 0, obj_persistentfadein); room_restart();
      emit(pf, 'room-restart', { char: [...w.char] });
      // `exit` — the rest of the Step does not run this frame.
      return pf.effects.slice(before);
    }
    if (gmlEq(w.choice, CHOICE_NOHIT)) {
      w.speaker = 'none';
      w.msg[0] = pf.japanese ? NOHIT_HINT_JA : NOHIT_HINT_EN;
      w.dialoguerUp = true;
      pf.con = 3.5;
      w.knight_mode = w.choice;
      emit(pf, 'nohit-hint', { knight_mode: w.knight_mode });
    } else {
      // :498-501 — Practice (0) AND Standard (2) both land here.
      pf.con = 4;
      w.knight_mode = w.choice;
      emit(pf, 'fight-start', { knight_mode: w.knight_mode });
    }
  }

  // ── con 3.5 — :504-507. Hold until the hint's writer is gone.
  if (gmlEq(pf.con, 3.5) && !w.dialoguerUp) {
    pf.con = 4;
    emit(pf, 'fight-start', { knight_mode: w.knight_mode });
  }

  // ── con 3.7 — :507-527. THE EQUIP-MENU RETURN ARM.
  //
  // UNREACHABLE IN THE MOD AS SHIPPED, and that is a measurement, not a
  // guess: `con = 3.7` is assigned NOWHERE in the whole kaizo dump (grepped
  // for `con = 3.7` across `gml_kaizo_dump/CodeEntries`, zero hits), and the
  // two other objects that reach into `obj_ch3_PTB02` write different fields
  // (`obj_npc_sign_Draw_0:68`, `obj_readable_room1_Other_10:2016`) while
  // `obj_border_controller_Create_0:118` only reads `con >= 10`.
  //
  // It is translated anyway, for the reason CLAUDE.md law 4 gives: it is in
  // the mod, it is coherent (it re-opens the dark-world menu — `menuno = -1`,
  // `charcon = 0`, `deschaver = 0` on obj_darkcontroller — and rewinds the
  // cutscene to con 2.2 one alarm later), and the Japanese label on choice 3
  // is "装備", EQUIPMENT, which is exactly what this arm does. The most
  // likely history is that Return once came here instead of restarting the
  // room. A check pins it as unreachable so that a future dump that DOES
  // reach it shows up as a failing assertion rather than as nothing.
  if (gmlEq(pf.con, 3.7)) {
    if (!gmlEq(w.menuno, 2)) {
      if (pf.char_change) {
        w.char = [...VANILLA_CHAR];
      }
      w.interact = 1;
      // with (obj_darkcontroller) { global.menuno = -1; charcon = 0; deschaver = 0; }
      w.menuno = -1;
      pf.con = 2.2;
      pf.alarm0 = 5;
      emit(pf, 'equip-menu-rewind', { con: 2.2, alarm0: 5 });
    }
  }

  return pf.effects.slice(before);
}

// ═══════════════════════════════════════════════════════════════════════════
// §3  THE BATTLE-START BLOCK — :548-582
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `:550-582`, the half of con 5 this lane owns:
 *
 *     snd_free_all();
 *     if (global.knight_mode == 2)
 *     {
 *         global.knight_battle_items = [];
 *         for (var i = 0; i < 13; i++)
 *             global.knight_battle_items[i] = global.item[i];
 *     }
 *     global.flag[9] = 2;
 *     global.batmusic[0] = snd_init(kaizo_set_music("knight.ogg"));
 *     ...
 *     scr_battle(115, 1, knight_marker, 0, 0);
 *     if (char_change)
 *     {
 *         event_user(7);
 *         global.char[0..2] = rem_char[0..2];
 *         with (instance_create(0, 0, obj_marker)) { ...black screen... }
 *     }
 *
 * ── THE ITEM SNAPSHOT MOVED BEHIND A MODE TEST, AND THAT IS THE DIFF ──────
 *
 * v105 took the snapshot UNCONDITIONALLY (diffed: the `if` is EnderCat8's,
 * the loop inside it is vanilla's, re-indented). So the question is who reads
 * it, and the answer is the GAME OVER screen:
 * `gml_Object_DEVICE_FAILURE_Step_0.gml:462-469`, on `knight_mode_con == 54`
 * (the retry arm kaizo/ui/proceed.js already documents), copies it back into
 * `global.item` and empties it. The other reader,
 * `gml_Object_obj_time_Draw_64.gml:36-43`, is the ESC quit — and it is gated
 * on `obj_knight_enemy.nohitmode == 1`.
 *
 * SO THE MOD MADE THE ESC READER UNREACHABLE. `knight_mode` is one value per
 * run: the snapshot exists only when it is 2, and the ESC restore runs only
 * when it is 1. A No Hit player's ESC finds `variable_global_exists` false
 * (first run) or an empty array (after a game over restored it), and restores
 * nothing. No Hit gets its items back a different way —
 * `gml_Object_obj_knight_enemy_CleanUp_0.gml:1-6` restores from the
 * instance's own `knight_items`, which IS taken unconditionally
 * (`_Create_0:90-94`). Reported, not repaired.
 *
 * `13` is the mod's own bound and it over-runs a 12-slot bag by one; vanilla
 * wrote the same 13. Kept.
 *
 * NOT MODELLED, named: `event_user(7)`, `obj_battleback`'s teardown and the
 * `obj_marker` black-screen cover are overworld-to-battle transition
 * plumbing. The marker's numbers are recorded in `BATTLE_START_COVER` so the
 * one thing a renderer would need — a full-screen black quad at
 * depth -999999999 for 25 frames — is stated rather than lost; nothing in
 * this recreation draws the transition, and inventing a draw for it in a
 * lane that owns no renderer is how a value gets written where nothing
 * reads it.
 */
// THE SPRITE NAME IS IN PROSE, NOT IN A STRING, and that is deliberate.
// `check-sprites.mjs` asserts that every `'spr_*'` literal in kaizo/ resolves
// in the vanilla pack or the overlay, because a name that does not resolve is
// invisible at runtime — the renderer silently falls back to drawing the
// collision mask. The mod's marker uses the vanilla sprite spr_whitepx_10,
// which this build's pack does not carry, and NOTHING HERE DRAWS IT: this
// lane ships no renderer for the transition cover. Holding the name as a live
// string would be a value written where nothing reads it AND a sprite
// reference that cannot resolve — two of this repo's own failure modes at
// once. When a renderer for the cover exists, it adds the sprite to the pack
// and the name with it.
export const BATTLE_START_COVER = Object.freeze({
  image_blend: 'c_black',
  depth: -999999999,
  // `image_xscale = room_width / 9`, `image_yscale = room_height / 9`. The
  // divisor is the mod's literal 9; this module does not claim to know
  // spr_whitepx_10's pixel size (the sprite is a vanilla asset and its
  // dimensions are in the data file, not in any GML). Recorded as the
  // number the mod writes, so a renderer that later wants it does not have
  // to guess it back out of a comment.
  scaleDivisor: 9,
  destroyAfterFrames: 25,
});

export function prefightBattleStart(pf, w, opts = {}) {
  const { fileExists, tempflag = w.tempflag } = opts;
  // snd_free_all();
  emit(pf, 'snd-free-all', {});
  // :551 — THE MODE GATE. `== 2` on a real: gmlEq, per the repo's rule.
  if (gmlEq(w.knight_mode, CHOICE_STANDARD)) {
    w.knight_battle_items = [];
    for (let i = 0; i < 13; i++) w.knight_battle_items[i] = w.item[i];
    emit(pf, 'items-snapshot', { count: w.knight_battle_items.length });
  }
  w.flag[9] = 2;
  const track = kaizoSetMusic(MUS_KNIGHT, {
    fileExists,
    flag456: !!w.flag[456],
    tempflag,
  });
  emit(pf, 'batmusic', { track, playable: kaizoMusicPlayable(track, fileExists) });
  if (pf.char_change) {
    w.char = [pf.rem_char[0], pf.rem_char[1], pf.rem_char[2]];
    emit(pf, 'char-restored-for-fight', { char: [...w.char], cover: BATTLE_START_COVER });
  }
  w.flag[9] = 1;
  pf.con = 6;
  return track;
}

/**
 * `:199` — the ARRIVAL cue, `c_mus2("initloop", kaizo_set_music("knight_appears.ogg"), 0)`.
 *
 * ONE OF THE TWO ARRIVAL CUES IS ROUTED AND THE OTHER IS NOT. The vanilla
 * Step has `c_mus2("initloop", "knight_appears.ogg", 0)` twice, at v105:185
 * and v105:597; the mod routed the first (:199) and left the second (:724)
 * as a bare literal. So on an install that HAS `ender_theirappearance.ogg`
 * the two arrivals play different songs. Reported here, not repaired: the
 * literal is what the mod runs.
 */
export function prefightArrivalTrack(w, fileExists) {
  return kaizoSetMusic(MUS_KNIGHT_APPEARS, { fileExists, flag456: !!w.flag[456] });
}

// ═══════════════════════════════════════════════════════════════════════════
// §4  AFTER THE FIGHT — :606-616, and the item restore
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `:608-611` — con 8's opening lines:
 *
 *     if (char_change)
 *         global.char = [1, 2, 3];
 *
 * THE CLOSING HALF OF con 2's SAVE, and note which way round it goes: con 5
 * put the PLAYER'S party back for the fight, and this puts the VANILLA THREE
 * back for the aftermath — because the post-fight cutscene is hard-coded the
 * same way the arrival was. The player's party is `rem_char`, still on the
 * instance, and the mod never restores it again in this object; the overworld
 * gets it back through the settings sign.
 *
 * The rest of that hunk — `if (con == 49 && global.flag[456]) con = 49.1` —
 * is the epilogue's entry and belongs to kaizo/scenes/kaizo-ending.js.
 */
export function prefightConEight(pf, w) {
  if (pf.char_change) {
    w.char = [...VANILLA_CHAR];
    emit(pf, 'char-vanilla-for-aftermath', { char: [...w.char] });
  }
  return w.char;
}

/**
 * THE READER for `global.knight_battle_items` —
 * `gml_Object_DEVICE_FAILURE_Step_0.gml:462-469` (game over, retry arm) and
 * `gml_Object_obj_time_Draw_64.gml:36-43` (the ESC quit, unreachable — see
 * prefightBattleStart's note). Both bodies are identical:
 *
 *     if (variable_global_exists("knight_battle_items"))
 *     {
 *         for (var i = 0; i < array_length(global.knight_battle_items); i++)
 *             global.item[i] = global.knight_battle_items[i];
 *         global.knight_battle_items = [];
 *     }
 *
 * IT EMPTIES THE ARRAY BUT DOES NOT UNSET IT, so `variable_global_exists`
 * stays true forever after the first restore and every later one copies zero
 * entries. That is why a Practice run started after a Standard game over
 * still finds the global and still restores nothing — the mod's own
 * behaviour, and the reason this function returns the number of slots it
 * actually wrote instead of a boolean.
 *
 * @returns {number} slots copied back.
 */
export function restoreKnightBattleItems(w) {
  if (w.knight_battle_items === undefined) return 0;
  const n = w.knight_battle_items.length;
  for (let i = 0; i < n; i++) w.item[i] = w.knight_battle_items[i];
  w.knight_battle_items = [];
  return n;
}
