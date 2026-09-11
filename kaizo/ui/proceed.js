// THE UNUSED OPTION IS THE DOOR TO THE WEIRD ROUTE — the kaizo half.
//
// ══ WHAT IS TAKEN FROM THE MOD, AND WHAT IS THIS PROJECT'S ════════════════
//
// CLAUDE.md's fourth law is that nothing invented ships unlabelled, and this
// feature is half transcription and half invention, so the split is written
// down before anything else in the file.
//
// TAKEN from EnderCat8's Kaizo Roaring Knight v2.3.3:
//
//   * THE WORD. On a Weird Route file the mod's game-over screen replaces BOTH
//     of DEVICE_CHOICE's options with the same string:
//         NAME[0][0] = NAME[1][0] =
//             string_hash_to_newline(stringsetloc("PROCEED#(PROCEED)", ...))
//     `gml_Object_DEVICE_FAILURE_Step_0.gml:384-385`, inside
//     `if (gaster_sideb)` (`:380`), where `gaster_sideb = global.flag[456]`
//     (`_Create_0.gml:21`). `#` is a line break in `string_hash_to_newline`,
//     which is why the word appears twice — once plain, once bracketed
//     underneath. render/title.js draws it in that shape.
//
//   * THE REFUSAL TO LEAVE. Vanilla's `global.choice == 1` arm sets
//     `knight_mode_con = 55`, which is the exit. The mod forks it:
//         if (gaster_sideb) knight_mode_con = 53;      // :430-437
//         else              knight_mode_con = 55;
//     53 is the retry path. So on the B-Side NEITHER answer gets you out —
//     both PROCEED. That is the feeling the settings row copies: once it is
//     taken it cannot be untaken, and `taken` never goes back to false.
//
//   * THE RED, AND THE GLASS IT IS MADE OF. `scr_screenshatter_create`
//     (`gml_GlobalScript_scr_lerpvar.gml:28-100`) is the roar finale's screen
//     shatter: 31 pieces of `spr_roaringknight_finalshatter`, and a
//     `shatter_blend` that is `[c_white, 16711680]` normally and, on the final
//     hit (`:57-67`), `[merge_color(c_white, c_red, 0.6), merge_color(c_blue,
//     c_red, 0.6)]`. THAT is the red — sim/modes.js's `UNUSED_RED` evaluates
//     the first of those two expressions, so the ramp's target colour and the
//     fragments' blend are one expression rather than two constants. And that
//     sheet is the sheet the settings row breaks into: 31 sub-images, already
//     packed by `kaizo/tools/pack-kaizo-sprites.mjs`, and until now drawn by
//     nothing at all (ledger G-38 — see kaizo/ui/shatter-draw.js, which closes
//     it).
//     This mod's palette is otherwise BLUE (its identity change is that the
//     Knight and everything he throws stop being white/red), so red is the one
//     colour it keeps for something that is not the Knight.
//
//   * THE BREAK'S SHAPE IS DELTARUNE's OWN, from CHAPTER 4 rather than from
//     the mod: `gml_Object_obj_intro_ch4_Step_0.gml:164-196`, the prophecy
//     shattering. One marker per sub-image, all born at the shattered thing's
//     own x/y, each given `direction = random(360)` immediately but ZERO
//     speed, with `gravity = 0.4 + random(0.12)`, `friction = 0` and
//     `speed = 4` delayed twenty frames so they land together. For those
//     twenty frames the pieces sit exactly where the intact thing was and the
//     image looks unbroken — which is what makes the animation read as playing
//     AT THE SPOT THE ROW WAS AT rather than as a cut to something else.
//     sim/modes.js's `UNUSED_SHATTER` carries every one of those numbers.
//
//   * THE TYPOGRAPHY. The screen the word comes from runs typer 667 —
//     `scr_textsetup(scr_84_get_font("main"), c_white, x, y, 33, 0, 2,
//     snd_nosound, 12, 20, 2)` — so its face is `fnt_main`, not the menu's
//     `fnt_mainbig`. The bracketed second line is drawn in fnt_main for that
//     reason (render/title.js's drawUnusedRow, and drawGameOver's header gives
//     the same derivation for the screen itself).
//
//   * THE DESTINATION. `KAIZO_VERSIONS.D` already IS the Weird Route: the
//     WEIRD_ROUTE_PARTY roster, `sideb: true`, and every attack's k_sideb
//     branch. The mod does not toggle it either — `k_sideb` reads
//     `global.flag[456]`, the game's own Snowgrave flag, so on such a file the
//     fight simply IS the B-Side. Nothing about the fight is invented here;
//     this module only supplies a way in that is not typing `?v=D`.
//
// OURS, invented for this sim and not in EnderCat8's mod or in chapter 4:
//
//   * THE PRESS COUNT AND THE REDDENING RAMP. TWENTY presses, one twentieth of
//     the way to `UNUSED_RED` each, with the count printed beside the row.
//     Neither source has a button that has to be pressed twenty times or that
//     heats up as it is. sim/modes.js's `UNUSED_PRESSES` is the number and its
//     header says why twenty; render/title.js draws the ramp, and the colour is
//     a plain `mergeColor` lerp rather than anything rolled at draw time
//     (CLAUDE.md's 30Hz-vs-monitor-Hz trap).
//   * PUTTING ANY OF IT ON A SETTINGS ROW. The mod's PROCEED is a game-over
//     choice and chapter 4's shatter is a cutscene; a settings menu that breaks
//     is this project's idea.
//   * THE PERSISTENCE below.
//
// ══ THE SHAPE OF THE THING ════════════════════════════════════════════════
//
// The engine seam (sim/modes.js, render/title.js) COUNTS and DRAWS and knows
// nothing about kaizo — it is armed by a driver or it is the inert row it has
// always been, which is what keeps the vanilla build unchanged and the
// isolation contract (kaizo/HANDOFF.md §2) intact: sim/ still imports nothing
// from kaizo/. This module is the kaizo side: what the door OPENS ONTO.

import {
  WEIRD_ROUTE_PARTY, GAMESTART_CH3_GEAR, characterSpec, scrFixparty,
  CHAR_KRIS, CHAR_NOELLE, CHAR_NONE,
} from '../party/roster.js';

/**
 * localStorage key. SEPARATE FROM THE SETTINGS ENTRY on purpose.
 *
 * web/kaizo.js's settings key is written on every volume nudge and read
 * through a version-tagged shape; a run-defining, one-way flag has no business
 * riding in it, where a future settings migration could drop it or a shared
 * `?cfg=` link could carry it to someone who has not earned it. This is its
 * own key, and the share encoder never sees it.
 *
 * The page's own prefix, matching web/sw.js's `kaizoknight-` cache: the two
 * sims share an origin in production (docs at web/kaizo.js's SETTINGS_KEY),
 * and the vanilla page must never read this.
 */
export const PROCEED_KEY = 'kaizoknight.proceed';

/**
 * THE SHATTER SHEET THE ROW BREAKS INTO, and the only place its name is
 * written on this side of the seam.
 *
 * `sim/modes.js` must not know it: the vanilla asset pack has no shatter sheet
 * at all, and naming a kaizo-only sprite in `sim/` is exactly the dependency
 * the isolation contract forbids. So the driver hands it over at `armUnused`
 * time and the renderer looks it up.
 *
 * 31 sub-images, `spr_roaringknight_finalshatter` — EnderCat8's own screen
 * shatter, packed by kaizo/tools/pack-kaizo-sprites.mjs and, until
 * kaizo/ui/shatter-draw.js, drawn by nothing (ledger G-38).
 */
export const PROCEED_SHATTER_SPRITE = 'spr_roaringknight_finalshatter';

/**
 * Read the saved state. Returns the `{ presses, taken }` shape `armUnused`
 * takes; every field is re-derived there, so a corrupt or hostile entry cannot
 * produce a row that is half-red and already taken.
 *
 * `gear` rides here too, and NOT in the settings entry. The settings loader
 * accepts a saved loadout only at `length === 3` (a stale entry from before a
 * slot existed must not reach the fight half-formed), so a two-person Weird
 * Route build written there would be silently dropped on the next load — and
 * worse, it would have OVERWRITTEN the three-person A-Side loadout on the way
 * out, losing a setup the player never asked to change. Two routes, two
 * loadouts, two homes.
 */
export function loadProceed(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(PROCEED_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return {};
    const out = { presses: v.presses | 0, taken: !!v.taken };
    // Length-checked against the roster, id-coerced: the same discipline the
    // settings loader applies, for the same reason.
    if (Array.isArray(v.gear) && v.gear.length === WEIRD_ROUTE_PARTY.length) {
      out.gear = v.gear.map((g) => ({
        weapon: g?.weapon | 0,
        armor: (g?.armor ?? []).map((a) => a | 0),
      }));
    }
    return out;
  } catch {
    // Private mode, disabled storage, a browser that throws on access. The
    // row still works for the session; it just starts cold.
    return {};
  }
}

/** Write it. Called on every press, because twenty presses that do not survive
 *  a reload are not progress, they are a chore repeated every visit. */
export function saveProceed(unused, gear = null, storage = globalThis.localStorage) {
  try {
    storage?.setItem(PROCEED_KEY, JSON.stringify({
      v: 1,
      presses: unused?.presses | 0,
      taken: !!unused?.taken,
      gear: Array.isArray(gear) ? gear : undefined,
    }));
  } catch { /* unsaved, still playable */ }
}

/**
 * THE EQUIP SCREEN'S ROSTER, once the door is taken.
 *
 * `sim/modes.js`'s `partyTabs` contract: one entry per tab, `char` being the
 * char1..4 FLAG index (0 Kris, 1 Susie, 2 Ralsei, 3 Noelle) and `base` the
 * stat block the preview sums equipment onto. Built from the same roster
 * machinery the fight uses — `scr_fixparty` for the order and
 * `characterSpec` for the numbers — so the menu cannot disagree with the
 * party that walks into the battle.
 *
 * SUSIE AND RALSEI ARE GONE, and that is the mod's own arithmetic rather than
 * a decision made here: `scr_fixparty([1, 4])` returns `[1, 4, 0]`, and the
 * third slot is nobody.
 */
export function weirdRouteTabs() {
  const gc = scrFixparty(WEIRD_ROUTE_PARTY);
  const tabs = [];
  for (const charId of gc) {
    if (charId === CHAR_NONE) continue;
    const c = characterSpec(charId, { sideb: true });
    tabs.push({
      name: c.name.toUpperCase(),
      char: charId - 1,           // char1..4 -> the flag index canEquip wants
      charId,
      base: { at: c.at, df: c.df, magic: c.magic, maxhp: c.maxhp },
      // scr_charbox draws `spr_head<name>` per CHARACTER; Noelle's is the one
      // the vanilla title screen has never needed.
      head: charId === CHAR_NOELLE ? 'spr_headnoelle' : undefined,
    });
  }
  return tabs;
}

/**
 * The loadout the equip screen opens on — one entry per TAB, in tab order,
 * which is what `title.gear` is indexed by.
 *
 * Kris keeps `scr_gamestart`'s chapter-3 build (MechaSaber + AmberCard +
 * GlowWrist, the same one KAIZO_TOK3_GEAR was measured to be); Noelle carries
 * the Weird Route's ThornRing set, which is the mod's own default and the one
 * six B-Side sites test for (`global.charweapon[4] == 13`).
 */
export function weirdRouteGear() {
  return weirdRouteTabs().map((t) => {
    const g = t.charId === CHAR_KRIS
      ? GAMESTART_CH3_GEAR[CHAR_KRIS]
      : characterSpec(t.charId, { sideb: true }).gear;
    return { weapon: g.weapon, armor: [...(g.armor ?? [])] };
  });
}

/**
 * Turn the equip screen's tab-indexed `title.gear` into the CHARACTER-indexed
 * override `installRoster({ gear })` takes (`state.kaizo.gear[charId]`, read
 * by `gearOfChar`).
 *
 * THIS IS THE WIRE THAT MAKES THE MENU MEAN ANYTHING. Without it the equip
 * page edits an array the Weird Route fight never reads — the roster supplies
 * its own gear and the player's choices land nowhere. That is this repo's
 * signature defect (a value computed correctly and written where nothing reads
 * it), so it is stated here and asserted from the outside by
 * check-proceed-route.mjs rather than trusted.
 */
export function gearOverrideFromTabs(tabs, gear) {
  const out = {};
  for (let i = 0; i < tabs.length; i++) {
    const g = gear?.[i];
    if (!g) continue;
    out[tabs[i].charId] = { weapon: g.weapon | 0, armor: [...(g.armor ?? [])] };
  }
  return out;
}

/**
 * `state.loadout.gear` MUST STAY THREE LONG.
 *
 * `sim/damage.js`'s `gearOf` hands its array to consumers that walk slots
 * 0..2 — the same vanilla-shaped walk the party-size trap is about
 * (kaizo/scenes/kaizo-fight.js's padding note). A two-entry loadout gives
 * slot 2 `undefined` and the first consumer to read `.weapon` off it throws.
 * Pad with an empty build, which is what an absent character is equipped
 * with anyway (`gearOfChar` returns `{ weapon: 0, armor: [] }` for nobody).
 */
export function padLoadout(gear) {
  const out = gear.map((g) => ({ weapon: g.weapon, armor: [...(g.armor ?? [])] }));
  while (out.length < 3) out.push({ weapon: 0, armor: [] });
  return out;
}

/** The version the door opens onto. One place, so nothing can drift. */
export const PROCEED_VERSION = 'D';
