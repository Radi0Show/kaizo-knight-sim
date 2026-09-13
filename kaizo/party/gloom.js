// KAIZO GLOOM — the B-Side damage-over-time meter, its accrual sites, and the
// End Step engine that turns it into HP loss.
//
// V-C/V-D recreation of EnderCat8s Kaizo Roaring Knight — do not publish
// without permission.
//
// Provenance (kaizo-mod/gml_kaizo_dump/CodeEntries/):
//   gml_Object_obj_knight_enemy_Step_2.gml          THE ENGINE — the whole
//                                                   `if (k_sideb)` block, lines
//                                                   15-79. This module is its
//                                                   home.
//   gml_Object_obj_knight_enemy_Create_0.gml 115-123  k_sideb / k_gloom /
//                                                   k_gemit / k_glt init
//                                                   (five-element arrays,
//                                                   index 0 unused).
//   gml_GlobalScript_kaizo_settings_init.gml 91-121  kaizo_gloomcolor() and
//                                                   kaizo_gloomemit() — the
//                                                   particle burst, and the
//                                                   RNG it draws.
//   gml_GlobalScript_scr_damage.gml 3-16, 245-266     accrual path A:
//                                                   ceil(damage/6), floor 10,
//                                                   >120 soften, cap 45.
//   gml_GlobalScript_scr_damage_maxhp.gml 169-174,   accrual path B:
//                                       245-261     ceil(tdamage/4), soften
//                                                   0.8, NO 45 cap.
//   gml_GlobalScript_scr_charbox.gml 723-770          the HP-bar gloom segment
//                                                   and the tinted HP number.
//   gml_Object_obj_knight_enemy_Step_0.gml 649-679    the >= 36 battle-message
//                                                   latch (k_gtext) — data
//                                                   only, see below.
//   gml_Object_obj_knight_enemy_Step_0.gml 1715       SnowGrave's re-clamp
//                                                   `k_gloom[_char] =
//                                                   min(hp - 1, k_gloom[_char])`.
//   gml_GlobalScript_scr_isphase.gml (vanilla v105)   "bullets" == mnfight 2.
//
// ── WHAT GLOOM IS ─────────────────────────────────────────────────────────
//
// On the B-Side every hit that lands carves a slice of itself off into a
// second meter, GLOOM, which sits ON TOP of the character's remaining HP and
// then eats it one point at a time. The bar shows it as a discoloured band at
// the right-hand end of the fill: that HP is already spent, it just has not
// drained yet. Gloom is always capped at `hp - 1` on accrual, so it can never
// by itself be the thing that fells you — but the drain does not honour that
// cap once it starts, because the cap is applied at ACCRUAL time and the drain
// removes gloom and HP together. See the hp-0 note on kaizoGloomStep.
//
// The tick rate is the mechanic's teeth: `ceil(max(18 - gloom/5, 1))` frames
// between drains. One point of gloom drains every 18 frames; 45 points (the
// scr_damage cap) drains every 9; past 85 points it drains EVERY FRAME. So
// gloom is not a flat DoT, it is a spiral — taking hits while gloomed makes
// the existing gloom drain faster, and a maxhp hit (which has no 45 cap, see
// kaizoGloomAccrue) can push a character straight into the every-frame band.
//
// ── INDEXING, AND THE INDEX.md DISAGREEMENT ───────────────────────────────
//
// The mod's `k_gloom` / `k_glt` / `k_gemit` are CHARACTER-indexed, [1..4]:
// 1 Kris, 2 Susie, 3 Ralsei, 4 Noelle, with index 0 unused. Every call site
// in the dump agrees:
//
//   Step_2          `for (var i = 1; i <= 4; i++) ... k_gloom[i], global.hp[i]`
//   scr_damage      `k_gloom[chartarget]`, chartarget = global.char[target]
//   scr_damage_maxhp    same
//   battlecontroller Draw  `kn.k_gloom[global.char[i]]`   (slot -> char id)
//   heroparent Draw       `k_gloom[global.char[myself]]`  (slot -> char id)
//   Step_0 (SnowGrave)    `k_gloom[_char]`, _char = global.char[k_sgtarget]
//
// deltas/INDEX.md open item 9 records a divergence — "scr_charbox uses slot+1,
// damage scripts use char id; diverges when Noelle joins". THAT READING IS
// WRONG, and the disagreement is labelled here rather than silently resolved.
// scr_charbox's loop is
//
//     for (c = 0; c < 4; c += 1) if (havechar[c] == 1) { ... k_gloom[c + 1] ... }
//
// and `havechar` is built by obj_battlecontroller's Create (lines 179-220) as
// havechar[0]=Kris, [1]=Susie, [2]=Ralsei, [3]=Noelle — a CHARACTER table, not
// a slot table. The slot is the sibling array `charpos[c]`, which scr_charbox
// uses separately for the x-chunk and the faceaction lookup. So `c` is
// charId - 1, `c + 1` is the char id, and scr_charbox agrees with everything
// else. It also reads `global.hp[c + 1]` in the same expression, which is
// char-indexed for certain — if `c` were a slot that read would be wrong for
// the vanilla party too, and it is not.
//
// What IS mixed in scr_charbox is `mmy[c]` / `hpcolor[c]` (char-indexed)
// against `gc == charpos[c]` (slot) in the same block. That is real, and it is
// not gloom's. kaizoCharboxGloom below reproduces the gloom call site exactly
// as written, char-indexed, so a future reader diffing this module against
// INDEX.md finds the discrepancy explained instead of repeated.
//
// THE CONTRACT is slot-indexed (`state.kaizo.gloom`, `state.partyHp`), because
// that is how the sim has always held the party. This module therefore keeps
// the ledger in slots and walks CHAR IDS 1..4 in the engine, mapping each to
// its slot through the roster — which reproduces the mod's iteration order
// exactly (it matters: the emit order below is char order, not slot order) and
// is bijective, since scr_fixparty guarantees at most one of each char id.
//
// Char ids with no slot are skipped. In the mod their k_gloom entries exist
// but can only ever hold 0: every write site indexes by a char id taken from
// `global.char[...]`, i.e. a character actually in the party.
//
// ── WHAT IS NOT MODELLED (visual, per the translation laws) ───────────────
//
//   * kaizo_gloomemit()'s particles themselves — two obj_particle_generic
//     whitepx streaks per call, lerped to alpha 0 over 5 frames. SKIPPED, but
//     the RNG THEY DRAW IS CONSUMED, exactly and in order; see kaizoGloomemit.
//   * the Rude Buster tint (`_gamt = min(k_gloom[2] / 150, 0.3)` toward
//     kaizo_gloomcolor()) — Susie-only, pure image_blend, no RNG. Exposed as
//     kaizoRudeBusterGloomBlend for a renderer that wants it.
//   * the charbox HP-number tint and the bar's gloom band — geometry exposed
//     by kaizoGloomBarSegment, drawing left to the renderer.

import { gmlChoose, gmlIrandomRange, gmlRandomRange } from '../../sim/rng.js';
import { spawn } from '../../sim/entity.js';
import { particleGeneric } from '../../sim/fx.js';
import { scrLerpvar } from '../../sim/lerpvar.js';

/**
 * The `> 45` clamp that scr_damage applies to gloom accrual — and that
 * scr_damage_maxhp DOES NOT. The asymmetry is the mod's, not a transcription
 * slip: a maxhp hit can push gloom straight past 45 (up to hp - 1), into the
 * fast half of the tick curve, while ordinary bullet damage cannot.
 */
export const GLOOM_SCR_DAMAGE_CAP = 45;

/**
 * `if (!k_gtext[i] && k_gloom[i] >= 36)` — the threshold at which the knight's
 * end-of-turn message calls the gloom out by name, once per character per
 * fight (obj_knight_enemy Step_0 649-679). The latch and the messages are DATA
 * here; the battle-message module owns the firing. Char-indexed, like the rest
 * of the mod's gloom arrays.
 */
export const GLOOM_TEXT_THRESHOLD = 36;

/** The k_gtext lines, by char id. English only; the mod ships JP alongside. */
export const GLOOM_TEXT = {
  1: '* Kris shivers coldly from GLOOM.&',
  2: '* GLOOM fogs Susie\'s thoughts.&',
  3: '* Ralsei trembles due to GLOOM.&',
  4: '* Noelle\'s GLOOM froze her.&',
};

/**
 * `kaizo_gloomcolor()` — `merge_color(c_blue, #268CAC, 0.5)`.
 *
 * Derivation: c_blue is RGB(0, 0, 255); #268CAC is RGB(38, 140, 172). Halved
 * per channel that is R 19, G 70, B 213.5. The runner stores colour channels
 * as bytes, so the blue channel lands on 213 under truncation and 214 under
 * rounding — a 1/255 difference in a value nothing measures. Truncation is
 * assumed; FLAGGED, not verified.
 */
export const KAIZO_GLOOM_COLOR = '#1346d5';

/** The same, as the {r,g,b} a canvas renderer wants. */
export function kaizoGloomcolor() {
  return { r: 19, g: 70, b: 213, css: KAIZO_GLOOM_COLOR };
}

/**
 * ...and as the `[r, g, b]` an entity's `image_blend` is in this engine —
 * render/draw/gm.js's `tinted()` takes the ARRAY and throws on a string, so a
 * mote cannot be handed `KAIZO_GLOOM_COLOR` directly.
 *
 * IT IS ONE BLUE OFF FROM `kaizo/party/heroes.js`'s `GLOOM_COLOR`, and that is
 * recorded rather than reconciled. Both are `merge_color(c_blue, #268CAC,
 * 0.5)`; the blue channel lands on 213.5, and this file's constant TRUNCATES
 * (the derivation above says so, and flags it as assumed) while heroes.js
 * builds the same colour through `sim/gml.js`'s `mergeColor`, which ROUNDS to
 * 214 — the helper 60 vanilla suites are pinned to. Neither is provably the
 * runner's answer without a capture of a glooming hero. Picking one here
 * would silently move whichever of the two is right, so the disagreement
 * stays visible: the HUD band, the HP number and the motes are all 213 (this
 * file's), the hero's 30%-opacity body tint is 214 (heroes.js's), and at that
 * opacity one unit of blue is below anything either surface can show.
 */
export const GLOOM_BLEND = Object.freeze([19, 70, 213]);

/**
 * obj_herosusie's object index in the kaizo dump. kaizo_gloomemit branches on
 * it (`if (_ob == 1410)`) to widen her x spread — and in doing so BURNS AN
 * EXTRA RNG DRAW, because the first random_range is assigned to _xx and then
 * immediately overwritten. Resolved from
 * gml_Object_obj_tenna_board4_gacha_Draw_0.gml:35, which pairs
 * `actor_target == 1410` with `obj_herosusie.hurt`.
 */
const OBJ_HEROSUSIE = 1410;

/**
 * Char id -> the `myheight` kaizo_gloomemit reads for its `random_range(0,
 * myheight - 14)` vertical spread.
 *
 * MEASURED off obj_heroparent's Create (gml_Object_obj_heroparent_Create_0.gml
 * :87 Kris 74, :124 Susie 82, :167 Ralsei 86, :215 Noelle 86 — the file's own
 * `myheight = 37` at :16 is the parent's default and no hero keeps it), and
 * they agree with kaizo/party/roster.js's HERO_BODY, which is the other reader
 * of the same four numbers.
 *
 * THEY USED TO BE 42 / 50 / 42 / 44 — roughly the halves, and wrong for every
 * character. It cost nothing while the particles were counted-but-not-created,
 * because `random_range` is ONE u32 whatever its bounds (CLAUDE.md's RNG
 * model), so the draw was spent identically and only the discarded VALUE was
 * off. It stops being free the moment a mote is placed at that value, which is
 * what `kaizoGloomemit` now does — the streaks would have covered a little
 * over half of each hero. No stream position moves with this correction, by
 * the same argument; asserted in check-gloom-hud.mjs L4.
 */
const HERO_MYHEIGHT = { 1: 74, 2: 82, 3: 86, 4: 86 };

/** The sim's standing party, for scenes that have not built a roster yet. */
const DEFAULT_ROSTER_CHARIDS = [1, 2, 3];

/**
 * The roster as bare char ids, in battle-slot order. Reads the shared
 * `state.kaizo.roster` contract; falls back to Kris/Susie/Ralsei so this
 * module runs against a scene built before the roster module landed.
 */
export function rosterCharIds(state) {
  const roster = state.kaizo?.roster;
  if (Array.isArray(roster) && roster.length > 0) {
    return roster.map((m, i) => (
      typeof m?.charId === 'number' ? m.charId : (DEFAULT_ROSTER_CHARIDS[i] ?? 0)
    ));
  }
  const n = state.partyHp?.length ?? DEFAULT_ROSTER_CHARIDS.length;
  return DEFAULT_ROSTER_CHARIDS.slice(0, n);
}

/** Battle slot holding `charId`, or -1. The mod's `charpos[charId - 1]`. */
export function slotOfCharId(state, charId) {
  return rosterCharIds(state).indexOf(charId);
}

/** Char id in `slot`, or 0 for an empty slot — the mod's `global.char[slot]`. */
export function charIdOfSlot(state, slot) {
  return rosterCharIds(state)[slot] ?? 0;
}

/**
 * Create the three slot-indexed ledgers if they are not there yet, and widen
 * them if the roster grew. NEVER truncates: kaizo/attacks/flurry-damage.js
 * seeds `state.kaizo.gloom` as a bare `[0, 0, 0]` before any roster exists,
 * and a two-person Weird Route roster must not drop that array's third cell
 * out from under a module still holding the reference.
 *
 * `k_gloom` / `k_glt` / `k_gemit` are five-element char-indexed arrays in the
 * mod (Create_0 116-118); here they are slot-indexed per the shared contract.
 */
export function ensureGloom(state) {
  const k = (state.kaizo ??= {});
  const n = rosterCharIds(state).length;
  const widen = (arr) => {
    while (arr.length < n) arr.push(0);
    return arr;
  };
  return {
    /** k_gloom — the meter itself. */
    gloom: widen(k.gloom ??= []),
    /** k_glt — frames since this member's last tick. */
    timer: widen(k.gloomTimer ??= []),
    /** k_gemit — set for exactly the frame a tick fires; read by the emit pass. */
    emit: widen(k.gloomEmit ??= []),
  };
}

/**
 * `scr_isphase("bullets")` — vanilla scr_isphase is `global.mnfight == 2`.
 *
 * The sim has no `mnfight`: `state.phase` is a human-readable trace label, and
 * the dodge-only scenes exist ONLY during the bullet phase — the menu, ACT and
 * enemy-talk stretches where this gate reads false are exactly the frames they
 * do not simulate. So the default is true, and a scene that grows a real turn
 * loop overrides it by setting `state.kaizo.mnfight` (or `state.mnfight`).
 *
 * This gate is the difference between gloom DRAINING and gloom merely GLOWING:
 * outside the bullet phase the timer still fires and the particles still burst,
 * but no HP moves.
 */
export function scrIsphaseBullets(state) {
  if (typeof state.kaizo?.mnfight === 'number') return state.kaizo.mnfight === 2;
  if (typeof state.mnfight === 'number') return state.mnfight === 2;
  return true;
}

/**
 * `kaizo_sideb()` — kaizo_settings_init.gml 79-89. Local copy so gloom does
 * not import from an attack module; the scene stamps the flag at build.
 */
export function kaizoSideb(state) {
  return !!(state.kaizo && state.kaizo.sideb);
}

// ── ACCRUAL ───────────────────────────────────────────────────────────────

/**
 * scr_damage's gloom split, from the TOP of the function (lines 3-16):
 *
 *     var _gloomdmg = 0;
 *     if (kaizo_sideb()) {
 *         _gloomdmg = ceil(damage / 6);
 *         if (_gloomdmg < 10) _gloomdmg = 10;
 *         if (damage > 120) damage = ceil(damage * 0.8);
 *     }
 *
 * Note WHAT it divides: the RAW incoming `damage`, before scr_damage_calculation
 * takes DF off it, before the mantle's 0.33, before DEFEND and before the
 * element reduction. A 62-damage bullet that lands for 20 after mitigation
 * still books 11 gloom. And the floor is 10, so the mod's smallest bullets pay
 * proportionally the most gloom.
 *
 * The `> 120` softening is the same block's other half and is returned with it
 * because the two are one edit: heavy hits give up 20% of their immediate
 * damage in exchange for the gloom they already booked at full value.
 *
 * @returns {{gloomdmg: number, damage: number}} the split, side A included
 *   (gloomdmg 0, damage untouched).
 */
export function kaizoGloomSplitDamage(state, damage) {
  if (!kaizoSideb(state)) return { gloomdmg: 0, damage };
  let gloomdmg = Math.ceil(damage / 6);
  if (gloomdmg < 10) gloomdmg = 10;
  let out = damage;
  if (damage > 120) out = Math.ceil(damage * 0.8);
  return { gloomdmg, damage: out };
}

/**
 * scr_damage_maxhp's gloom split (lines 169-174), the other ratio:
 *
 *     tdamage = ceil(global.maxhp[chartarget] * arg0);
 *     if (kaizo_sideb()) {
 *         _gloomdmg = ceil(tdamage / 4);
 *         tdamage = ceil(tdamage * 0.8);
 *     }
 *
 * A quarter, not a sixth; no floor of 10; no 120 gate — the soften is
 * unconditional. Gloom comes off the UN-softened value, so a full-maxhp slash
 * on Kris (160) books 40 gloom and lands 128.
 *
 * kaizo/attacks/flurry-damage.js already inlines this at its own site; the
 * export is here so the split has one home and the ratios can be diffed.
 */
export function kaizoGloomSplitMaxhp(state, tdamage) {
  if (!kaizoSideb(state)) return { gloomdmg: 0, damage: tdamage };
  return { gloomdmg: Math.ceil(tdamage / 4), damage: Math.ceil(tdamage * 0.8) };
}

/**
 * The accrual tail both damage scripts share, verbatim from scr_damage
 * 245-266 — the only difference between them being `cap45`:
 *
 *     if (kaizo_sideb()) {
 *         if (global.hp[chartarget] > 1 && !obj_knight_enemy.practicemode) {
 *             if (chartarget == 4 && global.charweapon[4] == 13) _gloomdmg = 0;
 *             var _minhp = global.hp[chartarget] - 1;
 *             obj_knight_enemy.k_gloom[chartarget] += _gloomdmg;
 *             obj_knight_enemy.k_gloom[chartarget] = min(k_gloom, _minhp);
 *             if (k_gloom > 45) k_gloom = 45;        // scr_damage ONLY
 *         } else {
 *             obj_knight_enemy.k_gloom[chartarget] = 0;
 *         }
 *     }
 *
 * Three things worth reading twice:
 *
 *  1. `hp > 1`, not `hp > 0`. A character sitting on exactly 1 HP takes the
 *     ELSE branch and has their gloom WIPED. Being nearly dead clears the
 *     meter — the mod will not let gloom be the killer.
 *  2. `min(gloom, hp - 1)` runs AFTER the add, so the cap is against the HP
 *     the character has now, post-hit.
 *  3. Noelle's exemption is by WEAPON: char id 4 holding weapon 13 books no
 *     gloom at all. (Weapon 13 is the Weird Route's own; the roster module
 *     owns `state.kaizo.charweapon`, char-indexed like the mod's.)
 *
 * @param slot    battle slot (contract-indexed)
 * @param gloomdmg  from one of the two split helpers
 * @param cap45   true for the scr_damage path, false for scr_damage_maxhp
 */
export function kaizoGloomAccrue(state, slot, gloomdmg, { cap45 = false } = {}) {
  if (!kaizoSideb(state)) return 0;
  const led = ensureGloom(state);
  const hp = state.partyHp[slot];
  // `!obj_knight_enemy.practicemode` — practice pins party HP every hit, so
  // gloom is disabled there outright.
  const practice = !!(state.knight?.practicemode ?? state.kaizo?.practicemode);
  if (hp > 1 && !practice) {
    let dmg = gloomdmg;
    const charId = charIdOfSlot(state, slot);
    if (charId === 4 && state.kaizo?.charweapon?.[4] === 13) dmg = 0;
    const minhp = hp - 1;
    led.gloom[slot] = (led.gloom[slot] ?? 0) + dmg;
    led.gloom[slot] = Math.min(led.gloom[slot], minhp);
    if (cap45 && led.gloom[slot] > GLOOM_SCR_DAMAGE_CAP) {
      led.gloom[slot] = GLOOM_SCR_DAMAGE_CAP;
    }
  } else {
    led.gloom[slot] = 0;
  }
  return led.gloom[slot];
}

/**
 * `k_gloom[_char] = min(global.hp[_char] - 1, k_gloom[_char]);` — the re-clamp
 * SnowGrave's freeze scene applies after it has drained HP directly
 * (obj_knight_enemy Step_0 1715). Exported so the scene module can call the
 * same line instead of reaching into the ledger.
 */
export function kaizoGloomClampToHp(state, slot) {
  const led = ensureGloom(state);
  led.gloom[slot] = Math.min(state.partyHp[slot] - 1, led.gloom[slot] ?? 0);
  return led.gloom[slot];
}

// ── THE ENGINE ────────────────────────────────────────────────────────────

/**
 * `_darktime = ceil(max(18 - (k_gloom[i] / 5), 1))` — frames between drains.
 *
 * Real division then ceil, so stacks that are not multiples of 5 round UP to
 * the slower period: 9 gloom gives ceil(16.2) = 17, not 16. The curve:
 *
 *     gloom     1   5  10  20  45  65  85  90+
 *     frames   18  17  16  14   9   5   1   1
 *
 * At 85 the max() takes over and it drains a point of HP every single frame.
 */
export function gloomDarktime(gloom) {
  return Math.ceil(Math.max(18 - (gloom / 5), 1));
}

/**
 * `kaizo_gloomemit()` — kaizo_settings_init.gml 91-121.
 *
 * The particles are SKIPPED (whitepx streaks, alpha-lerped over 5 frames, no
 * gameplay effect). The RNG IS NOT. This fires from the End Step, not a Draw,
 * so its draws sit in the gameplay stream and every one has to be spent in
 * order or nothing downstream lines up.
 *
 * Per call, `repeat (2)` of:
 *
 *     _xx = x + random_range(0, 28) * 2          1 draw
 *     if (_ob == 1410) _xx = x + random_range(0, 32) * 2    +1 draw, SUSIE ONLY
 *     _yy = y + random_range(0, myheight - 14)   1 draw
 *     depth = choose(depth - 1, depth + 1)       1 draw
 *     image_yscale = 2 * irandom_range(4, 6)     2 draws  (irandom is i63)
 *     vspeed = random_range(4, 6)                1 draw
 *
 * = 6 draws, or 7 for Susie whose first `_xx` is computed and thrown away.
 * Twice over: 12 draws, 14 for Susie.
 *
 * And the gate at the top pays nothing at all:
 *
 *     if (i_ex(obj_knight_roaring2)) exit;
 *
 * — while the Roaring finale is on screen the emit is a no-op, 0 draws. The
 * sim carries that as `state.roaringActive`, latched at the top of stepFrame.
 *
 * @returns {number} draws consumed, for the check to assert on.
 */
export function kaizoGloomemit(state, slot) {
  if (state.roaringActive) return 0;
  const rng = state.gmlRng;
  if (!rng) return 0;
  const before = rng.draws ?? 0;
  const charId = charIdOfSlot(state, slot);
  const myheight = HERO_MYHEIGHT[charId] ?? 74;
  // THE MOTES ARE NOW MADE, not just counted (ledger G-41). `spawn` needs a
  // real sim state — an entity list and the spawn counter — and this function
  // is also called from bare harness states that carry neither (check-gloom's
  // draw-count fixtures are literally `{ gmlRng, kaizo }`). So the VALUES are
  // computed unconditionally, in the GML's order, and only the creation is
  // conditional: the RNG stream is identical either way, which is what keeps
  // every existing count assertion true and is asserted directly in
  // check-gloom-hud.mjs L4.
  const canSpawn = Array.isArray(state.entities) && typeof state.nextSpawnSeq === 'number';
  const member = state.kaizo?.roster?.[slot] ?? null;
  const hx = member?.pos?.x ?? 0;
  const hy = member?.pos?.y ?? 0;
  const hdepth = member?.depth ?? 0;
  for (let r = 0; r < 2; r++) {
    // `var _gc = kaizo_gloomcolor();` — inside the repeat, no RNG.
    let xx = hx + gmlRandomRange(rng, 0, 28) * 2;
    // `if (_ob == 1410) _xx = x + random_range(0, 32) * 2;` — SUSIE ONLY, and
    // the first draw above is spent and thrown away. Both draws stay.
    if (charId === 2) xx = hx + gmlRandomRange(rng, 0, 32) * 2;
    const yy = hy + gmlRandomRange(rng, 0, myheight - 14);
    // `depth = choose(other.depth - 1, other.depth + 1)` — `other` is the
    // HERO, so the mote sits one step in front of or behind the character it
    // comes off. The value used to be drawn and dropped.
    const dz = gmlChoose(rng, [-1, 1]);
    const ys = 2 * gmlIrandomRange(rng, 4, 6);
    const vs = gmlRandomRange(rng, 4, 6);
    if (!canSpawn) continue;
    const p = spawn(state, particleGeneric, { x: xx, y: yy });
    p.image_blend = GLOOM_BLEND;
    p.depth = hdepth + dz;
    // `not_outbound = false` IS NOT WRITTEN, deliberately. It is the field
    // the mod ADDS to obj_particle_generic (ledger G-57) together with an
    // Outside-View-0 event — `if (not_outbound) instance_destroy()` — and
    // `sim/fx.js` has NEITHER the field nor any outside-view event, so
    // assigning it here would be one more value nothing reads, which is this
    // repo's signature defect and the reason the grep exists. It would also
    // be inert if it were read: a mote is born on top of a hero, moves down
    // 4-6px a frame and is destroyed by `timer = 5`, so it cannot leave the
    // view inside its own life. When sim/fx.js grows the event (G-57), add
    // the line and the default `false` is already what this wants.
    p.sprite_index = 'spr_whitepx';
    p.image_xscale = 2;
    p.image_yscale = ys;
    // vspeed with nothing else: the engine moves an entity by hspeed/vspeed
    // only under `componentMotion` (sim/index.js runMotion), and declaring it
    // on the TYPE would set a flag nothing reads — the trap
    // kaizo/party/scenes.js records for the snowflakes.
    p.componentMotion = true;
    p.vspeed = vs;
    // `scr_lerpvar("image_alpha", 1, 0, 5); timer = 5;` — the fade and the
    // life are the same five frames, so the mote is gone the frame it would
    // have reached alpha 0 either way.
    scrLerpvar(state, spawn, p, 'image_alpha', 1, 0, 5);
    p.timer = 5;
  }
  return (rng.draws ?? 0) - before;
}

/**
 * obj_knight_enemy's Step_2 (End Step) — THE GLOOM ENGINE, in full.
 *
 *     if (k_sideb) {
 *         for (var i = 1; i <= 4; i++) {
 *             k_gemit[i] = 0;
 *             if (k_gloom[i] > 0) {
 *                 if (global.hp[i] < 0) { k_gloom[i] = 0; k_glt[i] = 0; }
 *                 else {
 *                     k_glt[i]++;
 *                     var _darktime = ceil(max(18 - (k_gloom[i] / 5), 1));
 *                     if (k_glt[i] >= _darktime) {
 *                         k_gemit[i] = 1;
 *                         k_glt[i] = 0;
 *                         if (scr_isphase("bullets")) { k_gloom[i]--; global.hp[i]--; }
 *                     }
 *                 }
 *             }
 *         }
 *         with (obj_herokris)   if (other.k_gemit[1]) kaizo_gloomemit();
 *         with (obj_herosusie)  if (other.k_gemit[2]) kaizo_gloomemit();
 *         with (obj_rudebuster_anim) { ...gloom tint from k_gloom[2]... }
 *         with (obj_heroralsei) if (other.k_gemit[3]) kaizo_gloomemit();
 *         with (obj_heronoelle) if (other.k_gemit[4]) kaizo_gloomemit();
 *     }
 *
 * Read in that order, four details survive translation:
 *
 *  * `_darktime` is computed from the PRE-decrement gloom, so the tick that
 *    takes gloom from 10 to 9 was scheduled at 10's period, and the next one
 *    waits 9's.
 *  * `k_gemit` is set — and the particles burst — whether or not the bullet
 *    phase is running. Only the two decrements are gated.
 *  * `global.hp[i]--` has NO floor and calls NOTHING. A member can be walked
 *    from 1 to 0 and then to -1 by gloom alone, with no scr_dead, no swoon
 *    sprite and no death message; the `< 0` branch then wipes the meter on the
 *    following frame and the drain stops. That is the mod's behaviour, not an
 *    oversight of this translation — a gloom-drained character sits at 0 HP,
 *    still "alive" to every one of the five down-flags the sim tracks.
 *  * the emit pass walks CHARACTERS (Kris, Susie, Ralsei, Noelle), not slots.
 *    On the Weird Route roster [Kris, Noelle] that means slot 0 then slot 1;
 *    on a hypothetical [Noelle, Kris] it would be slot 1 then slot 0. With
 *    today's draw counts that reordering is INVISIBLE in the stream — WELL512
 *    lands in the same place after 26 draws however they were split — so the
 *    char order below is faithfulness, not a measured constraint. It stops
 *    being free the moment an emit's cost depends on anything the previous
 *    emit touched, which is exactly the kind of thing a later patch adds.
 *
 * The engine lives on obj_knight_enemy, which in this sim is a plain
 * `state.knight` record rather than an entity, so this is a function the scene
 * calls from the END STEP — see `gloomEngine` for the entity wrapper. End Step
 * is the right slot for the same reason the game puts it there: the HP
 * decrement has to be visible to the HP bars drawn later the same frame.
 *
 * @returns {{ticks: number, emits: number, draws: number}}
 */
export function kaizoGloomStep(state, { bullets = null } = {}) {
  if (!kaizoSideb(state)) return { ticks: 0, emits: 0, draws: 0 };
  const led = ensureGloom(state);
  const chars = rosterCharIds(state);
  // `scr_isphase("bullets")` — the turn loop passes its own answer (the
  // director's `clockOn`, which is the sim's `mnfight == 2`: it rises with
  // the arena and holds through the sweep until alarm[2] fires, exactly
  // the span the controller decrements turntimer over); a caller with no
  // loop gets the state-field fallback.
  const inBullets = bullets === null ? scrIsphaseBullets(state) : !!bullets;
  let ticks = 0;

  // `for (var i = 1; i <= 4; i++)` — char ids, mapped to slots. Char ids with
  // no slot are skipped: in the mod their entries exist but no write site can
  // reach them (every one indexes through global.char[...]).
  for (let charId = 1; charId <= 4; charId++) {
    const slot = chars.indexOf(charId);
    if (slot < 0) continue;
    led.emit[slot] = 0;
    if (!(led.gloom[slot] > 0)) continue;
    if (state.partyHp[slot] < 0) {
      led.gloom[slot] = 0;
      led.timer[slot] = 0;
      continue;
    }
    led.timer[slot] += 1;
    const darktime = gloomDarktime(led.gloom[slot]);
    if (led.timer[slot] >= darktime) {
      led.emit[slot] = 1;
      led.timer[slot] = 0;
      if (inBullets) {
        led.gloom[slot] -= 1;
        state.partyHp[slot] -= 1;
        ticks += 1;
      }
    }
  }
  // The roster module's CHARACTER-indexed mirror (`state.kaizo.gloomByChar`,
  // the mod's own `k_gloom[0..4]` shape — roster.js setGloom) is kept in
  // step with the slot ledger the engine just moved, so a reader of either
  // indexing sees the same meter. Only when the roster installed it.
  if (Array.isArray(state.kaizo?.gloomByChar)) {
    for (let charId = 1; charId <= 4; charId++) {
      const slot = chars.indexOf(charId);
      if (slot >= 0) state.kaizo.gloomByChar[charId] = led.gloom[slot] ?? 0;
    }
  }

  // The emit pass, in the mod's char order. obj_rudebuster_anim's tint sits
  // between Susie and Ralsei and draws no RNG, so it costs the stream nothing
  // and is left to the renderer (kaizoRudeBusterGloomBlend).
  let emits = 0;
  let draws = 0;
  for (let charId = 1; charId <= 4; charId++) {
    const slot = chars.indexOf(charId);
    if (slot < 0) continue;
    if (!led.emit[slot]) continue;
    emits += 1;
    draws += kaizoGloomemit(state, slot);
  }

  // AND THE HUD, from the same event that moved the meter — see
  // publishGloomHud. Last, so what the player sees is this frame's value and
  // not the previous one's.
  publishGloomHud(state);
  return { ticks, emits, draws };
}

/**
 * THE HUD SEAM — `state.partyStatusBar`, read by render/menu.js's
 * `statusOverlay` (knight-sim branch `kaizo-gloom-seams`, v1.0.43).
 *
 * Ledger G-34, all three of its sites, closed by one publish:
 *
 *   scr_charbox:735-746   the CURRENT hp number turns kaizo_gloomcolor()
 *   scr_charbox:757-769   a band on the 75px bar, (hp-gloom)/maxhp .. hp/maxhp
 *   obj_battlecontroller  the same band on the target picker's 100px bar
 *     Draw_0:1387-1399    (unclamped there — the renderer honours that)
 *
 * Until this existed, GLOOM was a damage-over-time meter the player could not
 * see: it ticked, it drained HP, it printed its own call-out at 36, and every
 * surface that could have shown it drew vanilla DELTARUNE's colours.
 * `kaizoGloomBarSegment` below is a faithful translation of the middle site
 * that nothing but its own check had ever called.
 *
 * SLOT-INDEXED, and that is the contract's indexing, not the mod's. Both
 * GML sites read a CHARACTER id — `k_gloom[c + 1]` where scr_charbox's `c`
 * walks `havechar[0..3]` (so `c + 1` IS the char id, not slot + 1; this
 * file's header has the whole argument), and `k_gloom[global.char[i]]` in
 * obj_battlecontroller. Both resolve, per panel, to "the gloom of whoever is
 * in this slot", which is exactly `led.gloom[slot]`.
 *
 * PADDED TO THREE. The renderer walks the picker's three rows and the
 * charbox's `partySprites.length` panels; a Weird Route roster is two long,
 * and the empty third slot must read 0 rather than `undefined` so a reader
 * cannot take `undefined > 0` as a band.
 *
 * A-SIDE PUBLISHES NOTHING: the only caller returns before this on
 * `!kaizoSideb`, so `state.partyStatusBar` stays absent and every pixel of a
 * V-A / V-C run is what it was. That is also why the field is not cleared
 * here — nothing can have set it.
 */
export function publishGloomHud(state) {
  const led = ensureGloom(state);
  const values = [0, 0, 0];
  for (let slot = 0; slot < Math.max(3, led.gloom.length); slot++) {
    values[slot] = led.gloom[slot] ?? 0;
  }
  state.partyStatusBar = { color: KAIZO_GLOOM_COLOR, values };
  return state.partyStatusBar;
}

/**
 * THE GLOOM CALL-OUT — obj_knight_enemy Step_0:647-676, the `downcount == 0`
 * arm of the turn-end message block, verbatim in shape:
 *
 *     if (downcount == 0) {
 *         if (k_sideb) {
 *             var _gmsg = "";
 *             if (!k_gtext[1] && k_gloom[1] >= 36) { _gmsg += "* Kris shivers coldly from GLOOM.&"; k_gtext[1] = true; }
 *             ...[2], [3], [4] likewise...
 *             if (_gmsg != "") global.battlemsg[0] = _gmsg;
 *         }
 *     }
 *
 * CHARACTER-indexed (`k_gloom[1..4]`, `k_gtext[1..4]`), once per character
 * per fight, and the four lines CONCATENATE when more than one crosses 36 on
 * the same turn end. Returns the string to put in `global.battlemsg[0]`, or
 * null when nothing fires — the caller (kaizo-vc-hooks.js's turn end) owns
 * the `downcount == 0` gate and the write. `k_gtext` is the knight's Create
 * `[0, 0, 0, 0, 0]` (Create_0:119), kept here as `state.kaizo.gtext`.
 */
export function kaizoGloomMessages(state) {
  if (!kaizoSideb(state)) return null;
  const k = state.kaizo;
  const gtext = (k.gtext ??= [0, 0, 0, 0, 0]);
  let gmsg = '';
  for (let charId = 1; charId <= 4; charId++) {
    if (!gtext[charId] && kaizoCharboxGloom(state, charId) >= GLOOM_TEXT_THRESHOLD) {
      gmsg += GLOOM_TEXT[charId];
      gtext[charId] = 1;
    }
  }
  return gmsg !== '' ? gmsg : null;
}

/**
 * The engine as a spawnable entity, for scenes that would rather carry it in
 * the entity list than call it by hand.
 *
 * DELIBERATELY NOT NAMED `obj_knight_enemy`: sim/actors.js already publishes a
 * knight actor under that name, and the sim's `i_ex` checks are name scans, so
 * a second instance would answer them. This is a harness carrier for one event
 * of the knight's, not the knight.
 */
export const gloomEngine = {
  name: 'kaizo_gloom_engine',
  create(e) {
    e.visible = false;
    e.depth = 0;
  },
  endStep(e, state) {
    kaizoGloomStep(state);
  },
};

// ── READERS (the drawing is the renderer's; the indexing is the mod's) ────

/**
 * scr_charbox's gloom read, at its own call site: `kn.k_gloom[c + 1]` with `c`
 * the havechar index, i.e. `charId - 1`. Takes a CHAR ID for that reason — see
 * the indexing note in this file's header for why INDEX.md calls this slot+1
 * and why that reading does not survive obj_battlecontroller's Create.
 *
 * Returns 0 for a character not in the party, matching the mod, where the
 * whole block sits under `if (havechar[c] == 1)`.
 */
export function kaizoCharboxGloom(state, charId) {
  const slot = slotOfCharId(state, charId);
  if (slot < 0) return 0;
  return ensureGloom(state).gloom[slot] ?? 0;
}

/**
 * The gloom band on the HP bar (scr_charbox 755-770), as fractions of the
 * 75-pixel fill:
 *
 *     __LV = global.hp[c + 1] - kn.k_gloom[c + 1];
 *     __RV = global.hp[c + 1];
 *     __LX = ceil((__LV / global.maxhp[c + 1]) * 75);
 *     __RX = ceil((__RV / global.maxhp[c + 1]) * 75);
 *
 * ceil on BOTH ends, not round — the delta spec flags the 1px accuracy for
 * pixel comparisons. Returns null when there is nothing to draw, i.e. exactly
 * when the mod's `if (k_gloom[c + 1] > 0)` guard fails.
 *
 * @param charId char id, per the call site.
 * @param maxhp  optional; defaults to the roster entry's `maxhp`.
 * @returns {{lx: number, rx: number, color: string}|null} pixel offsets from
 *   the fill's left edge.
 */
export function kaizoGloomBarSegment(state, charId, maxhp) {
  if (!kaizoSideb(state)) return null;
  const gloom = kaizoCharboxGloom(state, charId);
  if (!(gloom > 0)) return null;
  const slot = slotOfCharId(state, charId);
  const hp = state.partyHp[slot];
  const mx = maxhp ?? state.kaizo?.roster?.[slot]?.maxhp ?? 0;
  // The enclosing guard in scr_charbox is `hp > 0 && maxhp > 0`.
  if (!(hp > 0 && mx > 0)) return null;
  return {
    lx: Math.ceil(((hp - gloom) / mx) * 75),
    rx: Math.ceil((hp / mx) * 75),
    color: KAIZO_GLOOM_COLOR,
  };
}

/**
 * The Rude Buster tint from Step_2: `min(k_gloom[2] / 150, 0.3)` — how far
 * Susie's bolt animation merges toward the gloom colour. Susie-only and
 * hardcoded to char id 2 in the mod, so it is 0 on a roster without her.
 * Pure image_blend, no RNG.
 */
export function kaizoRudeBusterGloomBlend(state) {
  if (!kaizoSideb(state)) return 0;
  return Math.min(kaizoCharboxGloom(state, 2) / 150, 0.3);
}
