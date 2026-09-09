// KAIZO scr_screenshatter_* — the mod's full-screen glass shatter, fired on
// the finale's final hit (and by the knight's death sequence elsewhere in the
// mod). NEW content: vanilla has no counterpart anywhere; the mod appends
// these four functions to gml_GlobalScript_scr_lerpvar.gml.
//
// *** V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// *** without permission. (kaizo/HANDOFF.md §5 V-C publish gate.)
//
// PROVENANCE (every branch below read from):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_GlobalScript_scr_lerpvar.gml
//       scr_screenshatter_create  (origins table line 48; pieces 74-121)
//       scr_screenshatter_step    (delay jitter / flight / spin-fold / cull)
//       scr_screenshatter_clear   (guarded teardown)
//       scr_screenshatter_repos   (NOT translated — it re-pins pieces to
//                                  screen space on a room change, and the sim
//                                  has no room changes)
//   Delta spec: knight-research/kaizo-mod/deltas/gml_GlobalScript_scr_lerpvar.md
//   (origins table diffed against the dump line 48 — byte-identical).
//
// WHAT IS GAMEPLAY HERE AND WHAT IS NOT. The pieces are pure presentation —
// nothing collides with them — EXCEPT that the finale's party-wipe outro
// (kaizo roaring2 Other_11, attack_con 6) BLOCKS on `array_length(
// shatter_sprs) == 0` before it fires the scripted failure. Piece lifetime
// (velocity, gravity 0.75, the y > cameray()+1000 cull) is therefore
// load-bearing on the kill path, and all of it is translated. What is NOT
// translated, per the visual-delta law (noted, renderer work later):
//   - the surface/sprite slicing (31 screenshot pieces cut along
//     spr_roaringknight_finalshatter frames 0..30) — pieces here are
//     invisible carriers of the verbatim motion;
//   - scr_afterimagefast() per flying piece per frame (no RNG);
//   - obj_dmgwriter.killtimer = -30 on the final hit (damage-number display
//     extension; the sim's dmgwriter has no killtimer).
//
// RNG — ALL DRAWS ARE ON THE SHARED STREAM AND ALL ARE CONSUMED, in the
// GML's order: create = choose(0,1) x2, then per piece random(12,30),
// random(7,15), random(-1,1), random(-3,3), random(-16,16), plus — final-hit
// only — irandom(-2,2) + irandom_range(-2,2); step = irandom_range(-delay,
// delay) x2 per still-delayed piece per frame.
//
// ORIGINAL BUG (kept, flagged): the five 2-argument `random(a, b)` calls.
// GML's builtin random() takes ONE argument; UTMT's compiler (the tool mods
// are built with) does not reject the second, and the runner reads only the
// first — so `hsp *= random(12, 30)` is `hsp *= random(12)`, not a 12..30
// range, and `random(-1, 1)` / `random(-3, 3)` / `random(-16, 16)` land in
// the NEGATIVE-to-zero interval. Translated with first-argument semantics
// (one u32 draw each, matching the stream); the delta spec's prose reads
// them as ranges — the two readings disagree and an oracle recording of the
// real mod is the only settle. Flagged in the work item's open list.
//
// GML->SIM MAPPINGS: the arrays live on state.knight (obj_knight_enemy owns
// them in the mod); scr_screenshatter_step() is called at the very top of
// the mod's obj_knight_enemy Step_0 — here a dedicated controller entity
// spawned by screenshatterCreate steps the pieces, which lands after the
// roaring2 step exactly as the knight's (near-oldest, so near-last in GML's
// newest-first order) call does.

import { spawn, destroy } from '../../sim/entity.js';
import {
  gmlChoose, gmlRandom, gmlIrandom, gmlIrandomRange,
} from '../../sim/rng.js';
import { mergeColor } from '../../sim/gml.js';

/**
 * GML packed colours (BGR: `r | g << 8 | b << 16`) and the [r, g, b] triple
 * the repo's merge_color takes. `shatter_blend` is kept in the mod's own
 * shape — packed ints — because that is what the GML stores and what a
 * future piece drawer would unpack.
 */
const gmUnpack = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
const gmPack = ([r, g, b]) => (r | (g << 8) | (b << 16)) >>> 0;
const C_WHITE = 16777215;
const C_RED = 255;
const C_BLUE = 16711680;
/**
 * scr_lerpvar.gml:59-60, the final-hit tints: `merge_color(c_white, c_red,
 * 0.6)` = (255, 102, 102) = 6711039 and `merge_color(c_blue, c_red, 0.6)` =
 * (153, 0, 102) = 6684825. Computed, not typed, so the arithmetic is the
 * repo's one merge_color.
 */
const SHATTER_HIT_FRONT = gmPack(mergeColor(gmUnpack(C_WHITE), gmUnpack(C_RED), 0.6));
const SHATTER_HIT_BACK = gmPack(mergeColor(gmUnpack(C_BLUE), gmUnpack(C_RED), 0.6));

/** `shatter_origins` — scr_lerpvar.gml line 48, verbatim (31 pairs). */
const SHATTER_ORIGINS = [
  [39, 41], [122, 59], [184, 20], [245, 53], [378, 27], [545, 68],
  [15, 150], [190, 105], [363, 112], [496, 160], [613, 178], [92, 134],
  [577, 206], [41, 195], [165, 213], [354, 207], [578, 272], [262, 228],
  [63, 281], [445, 295], [293, 352], [163, 340], [21, 351], [120, 352],
  [607, 396], [72, 410], [124, 463], [222, 439], [519, 423], [419, 440],
  [313, 464],
];

/**
 * One glass piece — a scr_marker in the mod, promoted to depth -999999999
 * with its own screenshot-slice sprite. Passive here: the controller below
 * moves every piece in ARRAY ORDER (the GML steps them from a loop, not from
 * their own events, and the delay jitter draws RNG — order is stream order).
 */
export const shatterPiece = {
  name: 'kaizo_shatterpiece',
  create(e) {
    e.depth = -999999999;
    e.image_speed = 0;
  },
};

/**
 * The stepper. In the mod, `scr_screenshatter_step()` is the FIRST line of
 * obj_knight_enemy's Step; kaizo owns this controller instead (isolation:
 * no sim/knight edits). Spawned by screenshatterCreate, it outlives the
 * roaring2 instance within the turn; the turn sweep reclaims it — on the
 * non-kill path the pieces would visually persist ~1-2s into the next turn
 * in the real mod, which the sweep truncates (noted for the launcher).
 */
export const screenshatterController = {
  name: 'kaizo_screenshatter',
  step(e, state) {
    screenshatterStep(state);
  },
};

/**
 * `scr_screenshatter_create()` — knight scope. `finalHit` mirrors the
 * `with (obj_knight_roaring2) if (final_hit)` read (the caller passes the
 * live flag rather than the function re-finding the instance).
 */
export function screenshatterCreate(state, { finalHit = false } = {}) {
  const k = state.knight;
  if (!k) return;
  // `if (variable_instance_exists(id, "shatter_sprs"))` — a re-create first
  // destroys every leftover piece and voids both arrays' slots.
  if (k.shatter_sprs) {
    for (let i = 0; i < k.shatter_sprs.length; i++) {
      const inst = k.shatter_insts[i];
      if (inst && inst !== -4 && inst.alive) destroy(inst);
      k.shatter_insts[i] = -4;
      k.shatter_sprs[i] = -4;
    }
  }
  const rng = state.gmlRng;
  const shatterFlipX = gmlChoose(rng, [0, 1]);
  const shatterFlipY = gmlChoose(rng, [0, 1]);
  let shatterDelay = 0;
  // shatter_surf / shatter_surf2: the screenshot slicing surfaces — renderer
  // work later (see header). Arrays and blends are the gameplay-adjacent
  // state and are kept faithfully.
  k.shatter_sprs = [];
  k.shatter_insts = [];
  k.shatter_blend = [C_WHITE, C_BLUE]; // c_white front, c_blue back (packed BGR)
  if (finalHit) {
    // `shatter_blend = [merge_color(c_white, c_red, 0.6), merge_color(c_blue,
    // c_red, 0.6)]` (scr_lerpvar.gml:59-60) — packed ints, see the constants.
    // These were the STRINGS 'merge(c_white,c_red,0.6)' / 'merge(c_blue,
    // c_red,0.6)' until 2026-09-08 — a data bug: image_blend is what
    // render/draw/gm.js tinted() reads, and it throws on anything that is not
    // a colour BY DESIGN, so the first sprite ever attached to a piece would
    // have killed the draw loop on the final-hit path (the class
    // roaring-final.js's C_RED note documents). No drawer here: the pieces
    // are unrecorded and the renderer is another lane's.
    k.shatter_blend = [SHATTER_HIT_FRONT, SHATTER_HIT_BACK];
    shatterDelay = 6;
    // `with (obj_dmgwriter) killtimer = -30;` — display-time extension for
    // the damage number; the sim's dmgnumbers carry no killtimer. Skipped.
  }
  for (let i = 0; i <= 30; i++) {
    let sx = SHATTER_ORIGINS[i][0];
    if (shatterFlipX) sx = 640 - sx;
    let sy = SHATTER_ORIGINS[i][1];
    if (shatterFlipY) sy = 480 - sy;
    // (surface slicing skipped — see header.)
    const p = spawn(state, shatterPiece, {
      x: state.view.x + sx,
      y: state.view.y + sy,
    });
    p.grav = 0.75;
    p.hsp = (sx - 320) / 320;
    p.vsp = (sy - 240) / 240;
    p.hsp *= gmlRandom(rng, 12); // ORIGINAL BUG: `random(12, 30)` — see header
    p.vsp *= gmlRandom(rng, 7); // ORIGINAL BUG: `random(7, 15)`
    p.vsp -= 5;
    p.image_angle = gmlRandom(rng, -1); // ORIGINAL BUG: `random(-1, 1)`
    p.rot = gmlRandom(rng, -3); // ORIGINAL BUG: `random(-3, 3)`
    p.spin = 3600;
    p.spin_amt = gmlRandom(rng, -16); // ORIGINAL BUG: `random(-16, 16)`
    p.delay = shatterDelay;
    if (p.delay > 0) {
      // `x += irandom(-2, 2);` — same 2-argument pattern; GML's irandom of a
      // NEGATIVE first argument lands in {-2..0}. Two u32 draws either way;
      // translated as the negated positive roll (same count, same interval).
      p.x += -gmlIrandom(rng, 2);
      p.y += gmlIrandomRange(rng, -2, 2);
      p.xstart = p.x;
      p.ystart = p.y;
    }
    k.shatter_insts.push(p);
    // shatter_sprs holds sprite handles in the mod; the sim keeps a parallel
    // stand-in ref because `array_length(shatter_sprs) == 0` is the finale's
    // kill-path gate — LENGTH is the observable, and both arrays are pruned
    // in lockstep exactly as the GML prunes them.
    k.shatter_sprs.push(p);
  }
  if (!state.entities.some((s) => s.alive && s.type.name === 'kaizo_screenshatter')) {
    spawn(state, screenshatterController, { x: 0, y: 0 });
  }
}

/** `scr_screenshatter_step()` — verbatim loop, array order = stream order. */
export function screenshatterStep(state) {
  const k = state.knight;
  if (!k || !k.shatter_insts) return;
  for (let i = 0; i < k.shatter_insts.length; i++) {
    const inst = k.shatter_insts[i];
    if (inst && inst !== -4 && inst.alive) {
      if (inst.delay > 0) {
        inst.delay -= 1;
        inst.x = inst.xstart + gmlIrandomRange(state.gmlRng, -inst.delay, inst.delay) / 2;
        inst.y = inst.ystart + gmlIrandomRange(state.gmlRng, -inst.delay, inst.delay) / 2;
      } else {
        inst.x += inst.hsp;
        inst.y += inst.vsp;
        inst.vsp += inst.grav;
        // `with (scr_afterimagefast()) fadeSpeed = 0.2;` — visual, no RNG;
        // skipped (see header).
        inst.spin += inst.spin_amt;
        let rspin = inst.spin % 360; // GML mod keeps the dividend's sign; so does JS %
        inst.image_angle += inst.rot;
        // var _spint / _spinb — dead decompiler locals, dropped.
        if (rspin >= 180) rspin = 360 - rspin;
        // The 0-90-180 triangle fold that fakes the 3D flip: xscale runs
        // +1 -> 0 -> -1 -> 0 as spin sweeps a full turn.
        if (rspin <= 90) inst.image_xscale = (90 - rspin) / 90;
        else inst.image_xscale = (rspin - 90) / -90;
        if (inst.image_xscale > 0) inst.image_blend = k.shatter_blend[0];
        else inst.image_blend = k.shatter_blend[1];
        if (inst.y > state.view.y + 1000) {
          // `with (obj_afterimage) if (sprite_index == ...) destroy` — the
          // piece's afterimages; none are spawned here (visual), nothing to
          // sweep.
          destroy(inst);
        }
      }
    } else {
      // A culled (or externally destroyed) piece: void both slots, then
      // delete them — the GML's -4 writes before array_delete are kept in
      // shape even though the deletes immediately drop the voided rows.
      k.shatter_insts[i] = -4;
      k.shatter_sprs[i] = -4;
      k.shatter_insts.splice(i, 1);
      k.shatter_sprs.splice(i, 1);
      i -= 1;
    }
  }
}

/**
 * `scr_screenshatter_clear()` — kaizo roaring2's Create runs this in knight
 * scope on EVERY launch (both roaring modes). Faithful quirk: only rows
 * whose instance still EXISTS are destroyed and deleted; already-dead (-4)
 * rows are left in place, so a cleared array is not necessarily empty.
 */
export function screenshatterClear(state) {
  const k = state.knight;
  if (!k || !k.shatter_insts) return; // variable_instance_exists gate
  for (let i = 0; i < k.shatter_insts.length; i++) {
    const inst = k.shatter_insts[i];
    if (inst && inst !== -4 && inst.alive) {
      destroy(inst);
      k.shatter_insts[i] = -4;
      k.shatter_sprs[i] = -4;
      k.shatter_insts.splice(i, 1);
      k.shatter_sprs.splice(i, 1);
      i -= 1;
    }
  }
}
