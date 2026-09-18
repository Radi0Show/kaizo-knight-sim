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
// (Step_0 1988-1995). Those belong to kaizo/party/scenes.js, which owns
// Step_0 and spends them in source order. What IS this module's is the
// PIECE: scenes.js leaves it on `state.kaizo.deadtp` and stepDeadtp/
// publishSkin below fly it and draw it, because the bar is this module's and
// the import only runs one way (scenes.js imports from here).

import { MAX_TENSION } from '../../sim/tension.js';
import { gmlRandomRange } from '../../sim/rng.js';
import { gmlLte } from '../../sim/gml.js';

/** The B-Side ceiling. `clamp(global.tension, 0, 125)`. */
export const KAIZO_SIDEB_TP_CAP = 125;

/**
 * `sprite_height` on the obj_tensionbar INSTANCE — 196, the height of
 * spr_tensionbar (and of spr_tensionbar_sliced, which is the same 25x196
 * sheet re-drawn: assets/sprites/manifest.json and
 * kaizo/assets/sprites/manifest.json both say `"w":25,"h":196`).
 *
 * The bleed loop reads it three times (`y + sprite_height`), and it is the
 * INSTANCE's sprite, not `_bar_sprite` — the Draw's local never reaches
 * `sprite_index`, so the number is the same on both sides of the shear.
 *
 * It also cross-checks against the fill: 125 TP is `196 * (1 - 125/250)` = 98
 * from the top, which is exactly the `- 98` the loop uses for its spawn line.
 */
export const TENSIONBAR_SPRITE_H = 196;

/**
 * THE BAR'S OWN SCREEN POSITION IS NOT THIS MODULE'S TO KNOW.
 *
 * obj_tensionbar's Draw ends with `y = __view_get(YView, 0) + 40 + yoffset`
 * (and the Create slides `x` in from `view_x - 40`), so every number the GML
 * writes off `x`/`y` is in SCREEN coordinates. The skin this module publishes
 * is in BAR-LOCAL coordinates instead — render/tensionbar.js owns the
 * instance's position and translates to it once (`ctx.translate(barX(frame),
 * 40)`), so publishing `x +`/`y +` here would apply it twice.
 *
 * There is deliberately no `BAR_Y` constant any more: the one that used to
 * live here was added to the marker y and not to the marker x, which put the
 * bleed 40px below the bar for its whole life. See the bleed loop's own note.
 */

/** GameMaker's default `gravity_direction`. Straight down. */
const GRAVITY_DIRECTION = 270;
/** `gravity = 0.35` — obj_tensionbar Draw_0:72. */
const MARKER_GRAVITY = 0.35;
/** GameMaker packs c_orange BGR (0x0080FF) — RGB(255, 128, 0). */
const C_ORANGE = [255, 128, 0];
/** `scr_marker(..., spr_roaringknight_finalslash_mask)` — Draw_0:65. */
const MARKER_SPRITE = 'spr_roaringknight_finalslash_mask';
/** The half the Knight cuts off — obj_tensionbar's `deadtp`. */
const DEADTP_SPRITE = 'spr_tensionbar_sliced_top';

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
  // THE ENGINE'S NAME FOR IT IS `endCutscene` (sim/knight.js:110, set to 1 at
  // :598), and render/tensionbar.js:101 already guards on that one. The two
  // names read here before were `state.kaizo.endCutsceneVersion` and
  // `state.knight.end_cutscene_version` -- NEITHER IS WRITTEN ANYWHERE in this
  // repo, so this always answered 0 and the module kept clamping and kept
  // walking the bleed loop for a bar the renderer had already stopped drawing.
  // Inert today only because no TP is earned during the finale; the kaizo
  // override is kept first so a scene can still drive it.
  if (typeof state.kaizo?.endCutsceneVersion === 'number') {
    return state.kaizo.endCutsceneVersion;
  }
  return state.knight?.endCutscene ?? 0;
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

// ── THE BLEED, as things that exist on screen ─────────────────────────────
//
// `scr_marker(x, y, spr)` is `instance_create(x, y, obj_marker)` plus a
// sprite and `image_speed = 0` (gml_GlobalScript_scr_marker.gml). obj_marker
// HAS NO EVENTS AT ALL in the dump — only its typed subclasses do — so a
// marker is a bare instance: the runner's built-in motion moves it, its
// obj_lerpvars write over its variables, `draw_self()` draws it, and a
// `scr_script_delayed(instance_destroy, N)` alarm ends it.
//
// TWO DELIBERATE DEVIATIONS, both from the same decision — these are PLAIN
// RECORDS on `state.kaizo.tpMarkers`, not entities in `state.entities`:
//
//  1. THE SLOT. They are advanced from this module's own end-step call, not
//     by the sim's step/motion phases, so every marker is uniformly one slot
//     later in the frame than the game's would be. Nothing collides with
//     them, nothing reads their position, and no trace column has ever
//     carried one; the alternative — real entities — would put 3 to 30 extra
//     instances into the list every graze frame, shifting `seq` for
//     everything spawned after them and handing the end-of-turn sweep
//     something to destroy that the game never destroys.
//  2. THE FRAME. They are held in BAR-LOCAL coordinates (0,0 = the bar's own
//     origin) because render/tensionbar.js draws the bar in SCREEN space,
//     while the game's bar is a world instance that tracks the view. The two
//     frames differ by the bar's own position, which is constant from the
//     end of its 13-frame slide-in — and the shear that switches this whole
//     mechanism on happens thousands of frames later.
//
// Everything else is the GML: the gravity chain is the one sim/index.js
// runMotion measured (18,723 integration steps, 100%), the lerps are
// obj_lerpvar's own "increment the clock, then write lerp(a, b, t/maxtime)",
// and a lerp OVERWRITES what gravity did to that variable while it runs,
// exactly as two instances writing the same field do in the original.

const PI32 = Math.fround(Math.PI);

/**
 * One frame of GameMaker's built-in motion for an instance that was handed
 * hspeed/vspeed directly and carries `gravity`. sim/index.js runMotion, facts
 * 1 and 2: the components ARE the state, and the gravity vector is added to
 * them through an all-f32 chain before the position add.
 *
 * runMotion's fact-3 recomposition of speed/direction is NOT done here, and
 * that is not a shortcut: it exists so a later GML read of `speed` or
 * `direction` sees what the runner would have stored, and nothing — not the
 * mod's Draw, not this module, not the renderer — ever reads either off a
 * bleed marker. The integer fix-up rides on that recomposition, so it has
 * nothing to fix up either.
 */
function markerMotion(m) {
  const gr = Math.fround(Math.fround(Math.fround(GRAVITY_DIRECTION) * PI32) / 180);
  m.hspeed = Math.fround(m.hspeed
    + Math.fround(Math.fround(m.gravity) * Math.fround(Math.cos(gr))));
  m.vspeed = Math.fround(m.vspeed
    + Math.fround(Math.fround(m.gravity) * -Math.fround(Math.sin(gr))));
  m.x = Math.fround(m.x + m.hspeed);
  m.y = Math.fround(m.y + m.vspeed);
}

/** GML `lerp(a, b, t)` — unclamped, which is what makes alpha 4.5 mean anything. */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * obj_lerpvar's Step, for the tweens a marker carries (sim/lerpvar.js is the
 * verified copy; these live on the record instead of in the entity list for
 * the reason in the block comment above). THE CLOCK INCREMENTS BEFORE THE
 * WRITE, so the first value written is `lerp(a, b, 1/maxtime)` and never `a`
 * — the reason `image_alpha` starts its life at obj_marker's own default 1
 * and not at the 1.5 or 4.5 the call names.
 */
function stepMarkerLerps(m) {
  if (!m.lerps.length) return;
  const keep = [];
  for (const t of m.lerps) {
    t.time += 1;
    m[t.name] = lerp(t.a, t.b, t.time / t.maxtime);
    if (t.time < t.maxtime) keep.push(t);
  }
  m.lerps = keep;
}

/**
 * One `with (scr_marker(...))` block — Draw_0:65-93, assignment for
 * assignment. The three `random_range` results arrive already drawn from the
 * shared stream (the caller spends them in the loop's own order); this only
 * arranges them.
 *
 *     depth = other.depth - 1;          // in front of the bar — the renderer
 *                                       // paints these after it, see the seam
 *     hspeed = random_range(...);        // handed in
 *     vspeed = random_range(...);        // handed in
 *     image_blend = c_orange;
 *     image_xscale = random_range(0.46, 0.68);
 *     image_yscale = image_xscale / 1.75;
 *     gravity = 0.35;
 *
 * THEN THE TWO LIVES DIVERGE ON `_delay`:
 *
 *   delay > 0 (the slow bleed, one frame of delay per 20 TP above 125)
 *     lerpvar("vspeed", 0, vspeed, delay)      the roll is the DESTINATION,
 *                                              so it drifts up from a standstill
 *     lerpvar("y", _sy, _yy, delay)            climbs off the 125 line
 *     lerpvar("image_alpha", 1.5, 0, 25+delay) opaque for the first third
 *     destroy at 35 + delay
 *
 *   delay == 0 (inside the shear cutscene, and only there)
 *     y = _yy                                  placed, not tweened
 *     lerpvar("image_alpha", 4.5, 0, 45)       opaque for the first 34 frames
 *     destroy at 45
 *
 * `image_alpha` starts at obj_marker's own default of 1: the Create sets no
 * alpha, and the lerp's first WRITE is a frame later (see stepMarkerLerps).
 * The 1.5 and the 4.5 are hold times dressed as alphas — anything above 1
 * draws as 1 — which is why the two paths fade so differently despite both
 * ending at 0.
 */
function makeMarker({ x, y, hspeed, vspeed, xscale, yy, sy, delay }) {
  const m = {
    x,
    y,
    hspeed,
    vspeed,
    gravity: MARKER_GRAVITY,
    image_xscale: xscale,
    image_yscale: xscale / 1.75,
    image_alpha: 1,
    age: 0,
    life: delay > 0 ? 35 + delay : 45,
    lerps: [],
  };
  if (delay > 0) {
    m.lerps.push({ name: 'vspeed', a: 0, b: vspeed, maxtime: delay, time: 0 });
    m.lerps.push({ name: 'y', a: sy, b: yy, maxtime: delay, time: 0 });
    m.lerps.push({ name: 'image_alpha', a: 1.5, b: 0, maxtime: 25 + delay, time: 0 });
  } else {
    m.y = yy;
    m.lerps.push({ name: 'image_alpha', a: 4.5, b: 0, maxtime: 45, time: 0 });
  }
  return m;
}

/** The live bleed markers. Created lazily so a non-B-Side state carries none. */
export function kaizoTpMarkers(state) {
  const k = (state.kaizo ??= {});
  return (k.tpMarkers ??= []);
}

/**
 * Advance every live marker one frame and drop the expired ones.
 *
 * `scr_script_delayed(instance_destroy, N)` arms an alarm N frames out and
 * GameMaker runs alarms BEFORE steps, so the instance is gone on the frame
 * its age reaches N — it never gets that frame's motion. Modelled as the
 * first thing in the walk.
 */
function stepMarkers(state) {
  const live = kaizoTpMarkers(state);
  if (!live.length) return;
  const keep = [];
  for (const m of live) {
    m.age += 1;
    if (m.age >= m.life) continue; // the instance_destroy alarm
    stepMarkerLerps(m); // the obj_lerpvars, which may overwrite vspeed and y
    markerMotion(m); // then the runner's move step
    keep.push(m);
  }
  state.kaizo.tpMarkers = keep;
}

/**
 * THE SHEARED BAR TOP — Step_0:1986-1998, the other half of the cut.
 *
 * `with (obj_tensionbar) { deadtp = scr_marker(x, y,
 *  spr_tensionbar_sliced_top); with (deadtp) { depth = obj_tensionbar.depth
 *  + 1; image_angle = random_range(1, 10); hspeed = random_range(-5, -7);
 *  vspeed = random_range(-2, -5); gravity = 0.25; } }`
 *
 * It is one prop, not a particle: no tweens, no destroy alarm, and the only
 * thing that ends it is `instance_destroy(deadtp)` at k_tpscene 12. The
 * three rolls and the record are kaizo/party/scenes.js's — that module owns
 * the k_tpscene machine and spends the draws in source order. This module
 * owns the BAR, so it owns the piece's motion and its draw, and reading it
 * off a plain `state.kaizo` field keeps the import going one way (scenes.js
 * imports from here).
 *
 * Same `markerMotion` the bleed uses — the runner's measured move step with
 * gravity recomposed in f32 — because that is what a GameMaker instance
 * handed hspeed/vspeed and a gravity does, whatever sprite it wears.
 */
function stepDeadtp(state) {
  const d = state.kaizo?.deadtp;
  if (!d) return;
  markerMotion(d);
}

/**
 * The bar SKIN the renderer reads — `state.tensionBar`, the seam in
 * render/tensionbar.js (its "THE SKIN SEAM" header). Data only; the renderer
 * imports nothing from kaizo/ (HANDOFF §2.1).
 *
 * `trail` hands the renderer THIS module's trailing pair rather than its own
 * module-local one, which is the whole point of publishing it: the clamp
 * above clamps `apparent` and `current`, and a renderer stepping a second,
 * unclamped copy would draw a fill that disagrees with the number the sim is
 * enforcing. The renderer reads it and writes nothing back.
 *
 * `markers` is the live bleed, converted to the draw calls Draw_0:65-73
 * issues: `draw_self()` on an obj_marker is `draw_sprite_ext(sprite_index,
 * image_index, x, y, image_xscale, image_yscale, image_angle, image_blend,
 * image_alpha)`, and a marker never sets `image_angle` or advances
 * `image_index` (`image_speed = 0`, one-frame sprite).
 */
function publishSkin(state) {
  const sprites = kaizoTensionbarSprites(state);
  const bar = kaizoTpbar(state);
  const markers = kaizoTpMarkers(state).map((m) => ({
    sprite: MARKER_SPRITE,
    subimage: 0,
    x: m.x,
    y: m.y,
    xscale: m.image_xscale,
    yscale: m.image_yscale,
    blend: C_ORANGE,
    alpha: m.image_alpha,
  }));
  // The sheared top rides the same list. No blend — obj_marker's
  // `image_blend` default is c_white and the cut piece is drawn in its own
  // colours, unlike the orange bleed — and it is the one marker that carries
  // an `angle`.
  const d = state.kaizo?.deadtp;
  if (d) {
    markers.push({
      sprite: DEADTP_SPRITE,
      subimage: 0,
      x: d.x,
      y: d.y,
      xscale: 1,
      yscale: 1,
      angle: d.imageAngle,
      alpha: 1,
    });
  }
  // `early` — the draw-order request render/canvas.js honours. TRUE exactly
  // between the GML's depth write and its restore: obj_knight_enemy takes
  // `obj_tensionbar.depth - 1` at k_tpscene 4 (Step_0:1965) and takes its own
  // depth back at k_tpscene 11 (:2009), dragging the afterimage trail with it
  // both ways (:1967-1973, :2010-2013). The whole beat is staged IN FRONT of
  // the bar, and the engine's screen-space bar is painted last, so without
  // this the Knight is occluded by a 25px sprite for the ~25 frames of the
  // shear. Measured before the seam existed: x 48 -> -16 across the bar's
  // column, hidden the whole way.
  const tp = kaizoTpscene(state);
  state.tensionBar = {
    bar: sprites.bar,
    cutout: sprites.cutout,
    tplogo: sprites.tplogo,
    yoff: kaizoTensionbarLayout(state).yoff,
    trail: bar,
    markers,
    early: tp >= 4 && tp < 11,
  };
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

  // THE MARKERS ARE NOT PART OF THE BAR'S DRAW. They are their own instances,
  // so they keep moving through every early exit this event has — including
  // the end-cutscene one below, which removes the bar and nothing else.
  // Stepped BEFORE the loop spawns this frame's batch, because a marker
  // created in a Draw gets its first Step on the following frame.
  stepMarkers(state);
  stepDeadtp(state);

  if (endCutsceneVersion(state) > 0) {
    publishSkin(state);
    return out;
  }

  if (kaizoTensionClampActive(state)) {
    const rng = state.gmlRng;
    const before = rng?.draws ?? 0;
    const live = kaizoTpMarkers(state);
    let i = 125.1;
    let sep = 4;
    if (state.tension >= 200) sep = 7.5;
    // gmlLte, not `<=`: GameMaker compares reals with an epsilon (CLAUDE.md,
    // measured facts) and `i` accumulates in f64 from the inexact 125.1.
    // Tension is not always integer -- scrTensionheal adds (grazepoints / 30)
    // * grazetpfactor per graze frame -- so a boundary case here is one
    // iteration, three markers and NINE u32 draws: a stream divergence.
    while (gmlLte(i, state.tension)) {
      // `_delay = ceil((_i - 125) / 20)` and the _hsp/_vsp swap at
      // k_tpscene >= 10 change the SPREAD the two random_ranges below sample
      // from — not how many they spend. Kept so the bounds are the mod's.
      const inScene = kaizoTpscene(state) >= 10;
      const hsp = inScene ? [-3, -5] : [-1, 1];
      const vsp = inScene ? [-2, -5] : [-2, -1];
      // `_tpnum = _i / 2.5` is the PERCENTAGE this step of TP sits at
      // (250 maxtension, 100%), and 1.96 is the bar's 196 pixels per
      // percentage point — so `_yy` is the height that much TP WOULD have
      // reached and `_sy` is the 125 line it is cut off at
      // (196 * (1 - 125/250) = 98). The marker starts on the line and bleeds
      // up to where the TP should have been.
      const tpnum = i / 2.5;
      // `_delay = ceil((_i - 125) / 20)`, and the whole scene branch flattens
      // it to 0. GML `ceil` is JS `Math.ceil`.
      const delay = inScene ? 0 : Math.ceil((i - 125) / 20);
      for (let h = 0; h < 3; h++) {
        // Draw_0:60-61 — BOTH recomputed inside the h loop, 1.5px apart, so
        // the three columns are also stepped diagonally.
        //
        // ONE COORDINATE FRAME, AND IT IS BAR-LOCAL. The GML writes these in
        // SCREEN coordinates, off the instance's own x/y:
        //
        //     _yy = ((_h * 1.5) + (y + sprite_height)) - (_tpnum * 1.96)
        //     _sy = ((_h * 1.5) + (y + sprite_height)) - 98
        //     scr_marker(x + 3.4 + (_h * 6.66), _sy, ...)
        //
        // and the renderer this publishes to (render/tensionbar.js, "THE SKIN
        // SEAM": `markers` is "a flat list of sprite draws to paint OVER the
        // bar, in BAR-LOCAL coordinates") does the `x +` and the `y +` itself
        // by translating to `(barX(frame), 40)`. So BOTH halves drop the
        // instance's own position: the x drops `x +`, and the y drops `y +`
        // — i.e. `BAR_Y`. Keeping BAR_Y here while dropping `x +` mixed the
        // two frames in one struct and put every marker 40px low for its
        // whole life, spawn AND destination.
        //
        // The bar-local spawn line is therefore `sprite_height - 98` = 98,
        // which is exactly where the renderer's own fill stops for 125 TP
        // (`h - (125/250) * h`) — the equality check-tensionbar-draw asserts
        // rather than re-typing 98 a second time.
        const yy = (h * 1.5) + TENSIONBAR_SPRITE_H - (tpnum * 1.96);
        const sy = (h * 1.5) + TENSIONBAR_SPRITE_H - 98;
        // scr_marker() -> instance_create + sprite_index + image_speed. No RNG
        // (checked: gml_GlobalScript_scr_marker.gml). The three draws are the
        // marker's own assignments, in source order.
        const hspeed = rng ? gmlRandomRange(rng, hsp[0], hsp[1]) : 0;
        const vspeed = rng ? gmlRandomRange(rng, vsp[0], vsp[1]) : 0;
        const xscale = rng ? gmlRandomRange(rng, 0.46, 0.68) : 0.57;
        live.push(makeMarker({
          // `x + 3.4 + (_h * 6.66)` — three columns across the 25px bar,
          // inside the fill's own x 3..w-1 span. Bar-local, so the `x +` is
          // the origin the renderer translates to.
          x: 3.4 + (h * 6.66),
          y: sy,
          hspeed,
          vspeed,
          xscale,
          yy,
          sy,
          delay,
        }));
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

  // Everything above is what the event COMPUTES; this is how it reaches the
  // screen. Published last so the renderer sees this frame's clamp, this
  // frame's pair and this frame's markers — the same values the Draw would
  // have painted with, because in the game they are the same event.
  publishSkin(state);

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
