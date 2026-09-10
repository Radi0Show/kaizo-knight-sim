// KAIZO TENSION BAR — the B-Side's hard 125 TP clamp, and the bar it wears.
//
// V-C/V-D recreation of EnderCat8s Kaizo Roaring Knight — do not publish
// without permission.
//
// Provenance (kaizo-mod/gml_kaizo_dump/CodeEntries/):
//   gml_Object_obj_tensionbar_Draw_0.gml            the whole event; the mod's
//                                                   insert is lines 33-101
//                                                   plus three sprite swaps
//                                                   and the TP-logo shift.
//   gml_Object_obj_knight_enemy_Step_0.gml 1930-2050  the k_tpscene state
//                                                   machine that arms it
//                                                   (5 -> 10 -> 11 -> 12 -> -1).
//   gml_GlobalScript_scr_mnendturn.gml 150-155        what STARTS it:
//                                                   `k_tpscene = 1` at the end
//                                                   of the turn after
//                                                   atk_Frenzy1, once.
//   gml_GlobalScript_kaizo_settings_init.gml 79-89    kaizo_sideb().
//   gml_GlobalScript_scr_gamestart.gml 32             global.maxtension = 250.
//   gml_GlobalScript_scr_tensionheal.gml              UNCHANGED by the mod —
//                                                   still clamps to 250.
//   deltas/gml_Object_obj_tensionbar_Draw_0.md        the delta spec.
//
// ── WHAT THE B-SIDE DOES TO TP ────────────────────────────────────────────
//
// Partway through the B-Side the Knight cuts the tension bar in half. It is
// staged as a cutscene — he crosses the screen, the bar's top shears off as a
// physics prop (spr_tensionbar_sliced_top), glass breaks — but the mechanical
// result is one line, run every frame from then on:
//
//     global.tension = clamp(global.tension, 0, 125);
//
// `global.maxtension` STAYS 250. The mod does not touch scr_tensionheal, does
// not touch spell costs, and does not touch the percentage formula. So three
// things follow, and all three are gameplay:
//
//  1. You can bank at most 125 TP. Every spell in the fight priced above that
//     becomes uncastable for the rest of the run — the clamp is the mod taking
//     the top half of the party's options away, not a display change.
//  2. The bar can never read above 50%, because the readout is still
//     `floor(apparent / 250 * 100)`, and `maxed` — the yellow MAX state at
//     >= 100 — can never fire again.
//  3. The clamp runs in the DRAW, after every Step of the frame. Anything that
//     reads `global.tension` earlier in the same frame sees the UNCLAMPED
//     value. In practice that is the one frame a graze pushes past 125: the
//     menu could still spend it that frame, and from the next frame on the
//     ceiling is 125 flat. This module keeps that ordering — see
//     kaizoTensionbarDraw's placement note — rather than clamping at heal
//     time, which would be a different mechanic wearing the same number.
//
// THE GATE is not "side B" alone. It is
//
//     kaizo_sideb() && (obj_knight_enemy.k_tpscene >= 10 || k_tpscene == -1)
//
// k_tpscene walks 1 -> 1.1 -> 2 ... -> 5, and it is state 5 that sets it to 10
// and shears the bar. Everything from 10 on (10, 11, 11.1, 11.2, 12) is inside
// the cutscene, and 12 hands off to -1, the permanent post-scene value. So the
// clamp switches on at the shear and never switches off. Before the shear the
// B-Side has the full vanilla 250.
//
// ── VISUAL, SKIPPED, RNG STILL SPENT ──────────────────────────────────────
//
// The bar's LOOK is not modelled here:
//   * spr_tensionbar_sliced (4992) / _cutout (4991) replace the vanilla bar
//     and cutout sprites, and spr_tensionbar_sliced_top (the sheared piece) is
//     spawned by the knight's k_tpscene 5. All three are MOD-ADDED sprites and
//     are already extracted; kaizoTensionbarSprites reports which pair a
//     renderer should use on a given frame.
//   * the TP logo is suppressed and the % readout drops 32px
//     (kaizoTensionbarLayout).
//   * the orange "bleed" — three columns of spr_roaringknight_finalslash_mask
//     markers per 4 TP (7.5 above 200) over the 125 line, gravity 0.35, alpha
//     lerped out.
//
// The bleed's RNG IS spent, in order, because it is drawn from the shared
// stream and the sim's law is that a visual skipped is still a visual paid
// for. Three `random_range` per marker (hspeed, vspeed, image_xscale), three
// markers per TP step: NINE DRAWS PER STEP. scr_marker, scr_lerpvar and
// scr_script_delayed are all RNG-free (checked in the dump), so nine is the
// whole cost. See kaizoTensionbarDraw for the loop.
//
// NOT this module's: the knight-side k_tpscene machine itself, and the three
// `random_range` its state-5 branch spends spawning the sheared bar top
// (Step_0 1988-1995). Those belong to whoever translates Step_0; this module
// only reads k_tpscene.

import { MAX_TENSION } from '../../sim/tension.js';
import { gmlRandomRange } from '../../sim/rng.js';

/** The B-Side ceiling. `clamp(global.tension, 0, 125)`. */
export const KAIZO_SIDEB_TP_CAP = 125;

/** Re-exported so callers can compare the two without importing both files. */
export { MAX_TENSION };

/**
 * `kaizo_sideb()` — kaizo_settings_init.gml 79-89. Local copy; this module
 * imports one-way from sim/ and sideways from nothing.
 */
export function kaizoSideb(state) {
  return !!(state.kaizo && state.kaizo.sideb);
}

/**
 * `obj_knight_enemy.k_tpscene`. 0 before the scene, 1..5 (with .1 sub-states)
 * during the approach, 10/11/11.1/11.2/12 during the shear, -1 after.
 *
 * Kept on `state.kaizo` per the shared contract; `state.knight.k_tpscene` is
 * honoured too, since that is where a Step_0 translation would naturally put
 * it.
 */
export function kaizoTpscene(state) {
  if (typeof state.kaizo?.tpscene === 'number') return state.kaizo.tpscene;
  if (typeof state.knight?.k_tpscene === 'number') return state.knight.k_tpscene;
  return 0;
}

/**
 * `obj_knight_enemy.end_cutscene_version` — the Draw's LAST early exit
 * (`if (chapter == 3 && i_ex(obj_knight_enemy) && end_cutscene_version > 0)
 * exit;`). While the finale plays there is no bar, so no particles and NO
 * CLAMP: tension is left wherever it was.
 */
function endCutsceneVersion(state) {
  if (typeof state.kaizo?.endCutsceneVersion === 'number') {
    return state.kaizo.endCutsceneVersion;
  }
  return state.knight?.end_cutscene_version ?? 0;
}

/**
 * The gate: side B, and the shear has happened.
 *
 *     kaizo_sideb() && (k_tpscene >= 10 || k_tpscene == -1)
 *
 * `== -1` is a plain integer comparison against a literal assignment
 * (Step_0 2043, `k_tpscene = -1;`) — nothing accumulates into it, so no
 * gmlEq() is warranted. The `>= 10` half covers the fractional in-scene values
 * 11.1 and 11.2 by construction.
 */
export function kaizoTensionClampActive(state) {
  if (!kaizoSideb(state)) return false;
  const s = kaizoTpscene(state);
  return s >= 10 || s === -1;
}

/**
 * The bar's trailing pair, `apparent` and `current`, which live on the
 * obj_tensionbar INSTANCE in the game.
 *
 * render/tensionbar.js keeps its own module-local copy for the vanilla sim,
 * and that copy is invisible to this clamp — the mod clamps all three values
 * together, so the B-Side needs them somewhere the sim can reach. This is that
 * somewhere; a kaizo renderer should read it instead of the renderer-local
 * trail, and `maxed` here is the same `maxed` the vanilla bar computes.
 */
export function kaizoTpbar(state) {
  const k = (state.kaizo ??= {});
  return (k.tpbar ??= { apparent: 0, current: 0, changetimer: 0, maxed: 0 });
}

/** GML `clamp(val, lo, hi)`. */
function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * Which bar sprites to paint this frame. Vanilla 1392/1393 are
 * spr_tensionbar / spr_tensionbar_cutout; 4992/4991 are the MOD-ADDED
 * spr_tensionbar_sliced / spr_tensionbar_sliced_cutout. Visual; reported so a
 * renderer does not have to re-derive the gate.
 */
export function kaizoTensionbarSprites(state) {
  return kaizoTensionClampActive(state)
    ? { bar: 'spr_tensionbar_sliced', cutout: 'spr_tensionbar_sliced_cutout', tplogo: false }
    : { bar: 'spr_tensionbar', cutout: 'spr_tensionbar_cutout', tplogo: true };
}

/**
 * The `_yoff` the mod applies to the % readout when the TP logo is
 * suppressed: 0 normally, 32 once the bar is sheared. Visual.
 */
export function kaizoTensionbarLayout(state) {
  return { yoff: kaizoTensionClampActive(state) ? 32 : 0 };
}

/**
 * obj_tensionbar's Draw_0 — the mechanical half, translated.
 *
 * CALL IT ONCE PER FRAME, AFTER THE END STEP. The game runs it in the Draw,
 * which is after every Step of the frame; the sim's nearest equivalent slot is
 * the end of stepFrame. That ordering is the mechanic, not bookkeeping: the
 * clamp deliberately trails a frame behind anything that reads tension during
 * the Step, which is what lets a graze past 125 be spent on the frame it lands
 * and never again. `tensionbarDraw` below is the entity wrapper.
 *
 * The order inside is the event's own:
 *
 *   1. early exit while the end cutscene runs (no bar, no clamp);
 *   2. if the gate is open: walk the bleed loop from 125.1 up to the CURRENT,
 *      still-unclamped tension, spending 9 draws a step;
 *   3. clamp tension / apparent / current to [0, 125];
 *   4. the vanilla trailing-pair chase, which therefore starts from the
 *      already-clamped values.
 *
 * The bleed loop, verbatim:
 *
 *     var _i = 125.1;
 *     var _sep = 4;
 *     if (global.tension >= 200) _sep = 7.5;
 *     while (_i <= global.tension) { ...3 markers...; _i += _sep; }
 *
 * `_sep` is chosen ONCE, from the pre-clamp tension, and `_i` accumulates in
 * f64 from an inexact 125.1 — replicated literally rather than rewritten as an
 * integer count, because the accumulation decides the last iteration and the
 * last iteration is nine draws.
 *
 * It also means the bleed only ever runs on frames where tension is ABOVE 125,
 * and since step 3 clamps it back down, that is normally the single frame the
 * shear lands plus one frame per graze that overshoots afterwards.
 *
 * @returns {{clamped: boolean, particles: number, draws: number}}
 */
export function kaizoTensionbarDraw(state) {
  const bar = kaizoTpbar(state);
  const out = { clamped: false, particles: 0, draws: 0 };

  if (endCutsceneVersion(state) > 0) return out;

  if (kaizoTensionClampActive(state)) {
    const rng = state.gmlRng;
    const before = rng?.draws ?? 0;
    let i = 125.1;
    let sep = 4;
    if (state.tension >= 200) sep = 7.5;
    while (i <= state.tension) {
      // `_delay = ceil((_i - 125) / 20)` and the _hsp/_vsp swap at
      // k_tpscene >= 10 change the SPREAD the two random_ranges below sample
      // from — not how many they spend. Kept so the bounds are the mod's.
      const inScene = kaizoTpscene(state) >= 10;
      const hsp = inScene ? [-3, -5] : [-1, 1];
      const vsp = inScene ? [-2, -5] : [-2, -1];
      for (let h = 0; h < 3; h++) {
        // scr_marker() -> instance_create + sprite_index + image_speed. No RNG
        // (checked: gml_GlobalScript_scr_marker.gml). The three draws are the
        // marker's own assignments, in source order.
        if (rng) {
          gmlRandomRange(rng, hsp[0], hsp[1]); // hspeed
          gmlRandomRange(rng, vsp[0], vsp[1]); // vspeed
          gmlRandomRange(rng, 0.46, 0.68); // image_xscale
        }
        out.particles += 1;
      }
      i += sep;
    }
    out.draws = (rng?.draws ?? 0) - before;

    // THE MECHANIC.
    state.tension = clamp(state.tension, 0, KAIZO_SIDEB_TP_CAP);
    bar.apparent = clamp(bar.apparent, 0, KAIZO_SIDEB_TP_CAP);
    bar.current = clamp(bar.current, 0, KAIZO_SIDEB_TP_CAP);
    out.clamped = true;
  }

  // ── vanilla trailing pair, unchanged by the mod ─────────────────────────
  // `apparent` chases global.tension at +-20 a frame and snaps within 20;
  // `current` waits 15 frames then closes on apparent in a cascade. Mirrors
  // render/tensionbar.js, which is the verified copy — held here too because
  // the clamp above has to have something to clamp.
  const t = state.tension ?? 0;
  if (Math.abs(bar.apparent - t) < 20) bar.apparent = t;
  if (bar.apparent < t) bar.apparent += 20;
  if (bar.apparent > t) bar.apparent -= 20;

  if (bar.apparent !== bar.current) {
    bar.changetimer += 1;
    if (bar.changetimer > 15) {
      const d = bar.apparent - bar.current;
      if (d > 0) bar.current += 2;
      if (d > 10) bar.current += 2;
      if (d > 25) bar.current += 3;
      if (d > 50) bar.current += 4;
      if (d > 100) bar.current += 5;
      if (d < 0) bar.current -= 2;
      if (d < -10) bar.current -= 2;
      if (d < -25) bar.current -= 3;
      if (d < -50) bar.current -= 4;
      if (d < -100) bar.current -= 5;
      if (Math.abs(bar.apparent - bar.current) < 3) bar.current = bar.apparent;
    }
  }

  // `tamt = floor((apparent / global.maxtension) * 100); maxed = 0; if
  // (tamt >= 100) maxed = 1;` — maxtension is STILL 250 on side B, so once the
  // bar is sheared this tops out at 50 and MAX is unreachable for the rest of
  // the fight.
  const tamt = Math.floor((bar.apparent / MAX_TENSION) * 100);
  bar.maxed = tamt >= 100 ? 1 : 0;

  return out;
}

/**
 * The Draw as a spawnable entity, for scenes that carry it in the entity list.
 *
 * Its handler is `endStep`, which is the sim's after-every-Step slot — the
 * placement the Draw's ordering requires. It is NOT named `obj_tensionbar`:
 * the sim's `i_ex` checks are name scans and nothing should start answering
 * them for a bar the sim does not otherwise instantiate.
 *
 * `stepOrder` PUTS IT LAST, and that is the point rather than a detail. The
 * game runs this in a Draw, so every Step and End Step of the frame has
 * already happened when the clamp lands; sim/entity.js sorts the End Step
 * phase by `stepOrder` and then creation order, and this entity is built
 * with the scene — near the FRONT of creation order, which would clamp
 * before the knight, the director and the menu had run. A large stepOrder
 * moves it behind all of them. That trailing frame is the mechanic: a graze
 * that pushes past 125 can still be spent on the frame it lands.
 */
export const tensionbarDraw = {
  name: 'kaizo_tensionbar_draw',
  stepOrder: 1000,
  create(e) {
    e.visible = false;
    e.depth = 0;
  },
  endStep(e, state) {
    kaizoTensionbarDraw(state);
  },
};

/**
 * The percentage the bar shows: `floor(apparent / global.maxtension * 100)`.
 * maxtension is 250 on both sides, so a sheared B-Side bar reads 50 at full.
 */
export function kaizoTensionPercent(state) {
  return Math.floor((kaizoTpbar(state).apparent / MAX_TENSION) * 100);
}

/**
 * The ceiling TP can actually be held at, for a menu that wants to say so:
 * 125 once the bar is sheared, 250 otherwise.
 *
 * INFORMATIONAL ONLY. Do not clamp scr_tensionheal with it — the mod does not,
 * and clamping at heal time would erase the one-frame window described at the
 * top of this file. The clamp belongs in kaizoTensionbarDraw and nowhere else.
 */
export function kaizoEffectiveTpCeiling(state) {
  return kaizoTensionClampActive(state) ? KAIZO_SIDEB_TP_CAP : MAX_TENSION;
}

/**
 * `if (global.tension < cost)` — the menu's affordability test, unchanged by
 * the mod. Here so the 125 ceiling's consequence is testable in one place: on
 * a sheared bar every spell priced above 125 is permanently out of reach.
 */
export function kaizoCanAfford(state, cost) {
  return (state.tension ?? 0) >= cost;
}
