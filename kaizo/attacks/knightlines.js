// KAIZO knightlines — obj_knight_tunnel_slasher as EnderCat8's Kaizo Roaring
// Knight v2.3.3 rebuilds it: the vanilla ac-20 spear volley PLUS a whole
// second attack mode, "PierceBlades" (the mod's ac 110) — an 18/34-sword
// carousel orbiting the Knight that flings swords to a staging point right of
// the box, where each snaps onto a horizontal lane and RAKES the arena in one
// frame (a swept hitscan, damage 210, graze 12.5) to embed in the left wall.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// PROVENANCE (knight-research/kaizo-mod/, private):
//   gml_kaizo_dump/CodeEntries/gml_Object_obj_knight_tunnel_slasher_Create_0.gml
//   gml_kaizo_dump/CodeEntries/gml_Object_obj_knight_tunnel_slasher_Step_0.gml
//   gml_kaizo_dump/CodeEntries/gml_Object_obj_knight_tunnel_slasher_Other_21.gml  (User Event 11 — NEW)
//   gml_kaizo_dump/CodeEntries/gml_Object_obj_knight_tunnel_slasher_Draw_0.gml    (RNG only; visuals skipped)
//   gml_kaizo_dump/CodeEntries/gml_Object_obj_knight_tunnel_slasher_CleanUp_0.gml (visual-only; noted below)
//   gml_kaizo_dump/CodeEntries/gml_Object_obj_dbulletcontroller_Step_0.gml        (type == 101, lines 2136-2149)
//   delta specs: knight-research/kaizo-mod/deltas/gml_Object_obj_knight_tunnel_slasher_*.md
//
// COPY OF: sim/attacks/knightlines.js (the VERIFIED vanilla module). Where
// the mod did not change a line, the copy is byte-identical; every divergence
// carries the kaizo file+line. obj_bullet_knight_tunnelslash and
// obj_roaringknight_slash are UNCHANGED in the kaizo dump at the object level
// (diffed byte-for-byte against gml_vanilla_v105) so they are IMPORTED from
// sim/, not copied. (obj_roaringknight_slash's Draw_0/Other_15 DO carry kaizo
// deltas — blue tint, aoedamage wrap removed — but those belong to the
// roaringknight-slash work item, not this module; see open[] in the report.)
//
// WHAT DIVERGES FROM THE SIM MODULE:
//   1. launchKnightlines (the dc type-101 branch): the vanilla
//      `obj_growtangle.x -= 70; obj_heart.x -= 70;` slides are REMOVED
//      (kaizo dbulletcontroller Step_0 lines 2136-2149 keep only
//      `obj_growtangle.image_xscale = 2.5`). The mod's Other_23 arena arm
//      already places the ac-110 board at x-110 with a 1.5 x 2.5 box — that
//      part lives in the central launcher (openVCArena), not here. The
//      launch also takes the dc's scr_bullet_inherit damage (Other_23 sets
//      dc.damage = 103 for both ac 110 and the dormant ac 6).
//   2. Create (kaizo Create_0 lines 11-30): element = 5, boxpush state,
//      attack_type gate on myattackchoice == 110, attack_con, secretswords.
//      `fucking_sword_surface = surface_create(640, 480)` is the Draw
//      pipeline's offscreen buffer — pure renderer machinery, skipped (the
//      matching CleanUp_0 frees it and restores `visible` on the box, soul
//      and dmgwriter that Draw_0 hides — all renderer-side; NOTE the mod
//      forgets obj_grazebox's visible there, a mod quirk for the renderer
//      pass to reproduce, not a sim concern).
//   3. Step (kaizo Step_0): the attack_type dispatcher (lines 1-8) routing
//      mode 1 into event_user(11) — carouselStep() here — and exiting; the
//      staged 93px arena push (boxpushstart/boxpushcon, lines 11-35, armed
//      at slash timer 24); seven `damage = 206` re-pins.
//   4. carouselStep — the whole Other_21, NEW in the mod. Translated in
//      full below with the delta spec's structure.
//
// ONE UNVERIFIED APPROXIMATION, and it is the only one in this file:
// `kaizoIrandomRange` (below). Other_21 line 113 calls
// `irandom_range(gt_miny() + 10, gt_maxy() - 10)` and, for the mod's
// quantised 1.5 x 2.5 ac-110 arena, BOTH BOUNDS ARE FRACTIONAL — the real
// game really does pass reals to irandom_range there. The oracle probe only
// ever measured integer arguments, so what the runner does with a real is a
// modelling choice: this file floors both bounds and then applies the
// verified integer model, which keeps `i`random returning an integer. The
// DRAW COUNT is exact either way — two u32 draws, composed exactly as
// sim/rng.js does — so the shared stream is unaffected by the choice; only
// the returned lane y can differ, and only by one pixel (a rounding model
// would allow 254 where this allows up to 253). **Resolve against the V-C
// oracle recording of the real mod.** No other kaizo module reaches this
// case (audited; see the helper's comment).
//
// THE CAROUSEL'S TINTS ARE NOW APPLIED (they were the file's one remaining
// visual gap, and image_blend is instance state, not a draw argument):
//   - flag A, Other_21 l.167: `merge_color(c_white, c_dkgray,
//     lengthdir_x(-0.5, ang) + 0.5)` — brightness-by-depth, on the same
//     `ang` that sorts the swords around the Knight.
//   - flag B/C, l.184 and l.277: `merge_color(blend1, blend2, blend_con)`.
//     The endpoints are re-armed one frame after the sword lands on its lane
//     (l.129-130: white -> get_swordcolor()), so blend_con is simultaneously
//     the telegraph's colour ramp and the countdown to the rake — one clock,
//     which is why blend_con was already modelled.
//   - l.272: the stride ghosts are retinted to the sword's blend after the
//     sweep, so the whole rake streak carries the blue.
// All of it is colour: not one RNG draw is added or removed. image_blend is
// carried as this engine's [r,g,b] here (it used to hold RAW PACKED REALS,
// which nothing downstream could read); the #020000 ghost TAG keeps its
// value semantics through AFTERIMAGE_TAG / isTagged.
//
// PURE-VISUAL DELTAS SKIPPED (renderer work later), per the translation law:
//   - Draw_0's whole pipeline (shake redraws, subtract-blend surface wall
//     clipping, visible=false juggling) — EXCEPT its RNG: two random_range
//     draws per frame while attack_con > 1, consumed in endStep (the Draw
//     slot's position in the shared stream: after step+collision, before the
//     next frame; no other stream consumer runs between). The rolled offsets
//     are kept on e.shake_x / e.shake_y for the renderer.
//   - CleanUp_0 (see 2 above).
//   LANDED (the "renderer work later" above), split the way the translation
//   law splits it: the PAINTING — the shake redraws, the sword surface, the
//   wall erase — is kaizo/render/draw/stream.js drawObjKnightTunnelSlasher
//   (the kaizo page's Draw override, which reads shake_x / shake_y and never
//   writes state); the `visible = false` writes are STATE the ordinary draw
//   pass reads (an invisible instance is not drawn — GameMaker's rule and
//   render/canvas.js's filter), so they live on knightTunnelSlasher's `draw`
//   slot below (sim/index.js "THE DRAW SLOT"), and CleanUp_0's restores are
//   knightTunnelSlasherCleanUp, called where this module tears itself down —
//   the same explicit-call convention as bulletKnightStreamCleanUp and
//   verticalSplitCleanUp, because the engine has no destroy hook. Neither
//   adds or moves an RNG draw; the endStep consumption above is untouched.
//
// KNOWN ORDERING DEVIATIONS, both bounded and documented:
//   - GameMaker steps instances newest-first; this engine steps oldest-first
//     (sim/entity.js). The carousel's tweens therefore run through a
//     stepOrder:-1 lerpvar clone (lerpvarEarly) so their writes land BEFORE
//     the slasher's step reads them, as in the game. Residual: when two
//     at_gshake lerps overlap (impacts on consecutive frames), the game
//     keeps the OLDER tween's value on top, this engine the newer — shake
//     magnitude is Draw-only (visual) and the RNG draw COUNT is unaffected.
//   - `with (obj_regularbullet)` iterates newest-first (the measured with()
//     order, sim/attacks/pointing-cone.js) — the driver below sorts seq
//     descending to match, which fixes the per-sword jitter draw order.
//
// SPRITE IDS: the dump's `_swordsprite = 4047` / `4996` are raw indices.
// 4996 is special-cased in Draw_0 as spr_roaringknight_sword_ol_alt (a new
// mod asset), which pins 4047 as the vanilla knight sword sheet
// spr_roaringknight_sword_ol (75x31, SWORDOL_MASK) — the resolution the
// delta spec asks to confirm against the kaizo data.win is still open.
// secretswords is 0 everywhere in the dump, so the alt path is dormant.
//
// DEPTH: obj_knight_tunnel_slasher's object-definition depth is not in the
// dump; the slasher's depth is only a BASE for the swords' relative sort
// (draw order only). 0 is used, labelled.
// SINCE CONFIRMED: the object-definition probe has it — knight-research/
// kaizo-mod/sprites/objects_kaizo.csv:248, depth column 0 — so the labelled
// base is the real value, not a guess. The kaizo Draw override draws the
// pose, the shaken arena and the sword surface at this depth, as the game's
// Draw does.

import { spawn, destroy } from '../../sim/entity.js';
import {
  scrApproach, pointDirection, pointDistance, lengthdirX, lengthdirY,
  gmlEq, gmlRound, clamp, mergeColor, WHITE, BLACK,
} from '../../sim/gml.js';
// THE MOD'S PALETTE — kaizo/attacks/kaizo-colors.js, the one source of truth.
// This module used to keep its own switch returning RAW PACKED REALS, which
// no other part of this engine can consume (blends here are [r,g,b]); the
// shared helper returns the decoded triple, and a STABLE reference.
import { getSwordcolor } from './kaizo-colors.js';
import {
  gmlRandom, gmlIrandom, gmlRandomRange, gmlChoose, gmlU32,
} from '../../sim/rng.js';
import {
  regularbulletCreate, regularbulletStep, collidebulletOther15,
} from '../../sim/bullets/regularbullet.js';
import { lerpvar } from '../../sim/lerpvar.js';
import { scrAfterimage } from '../../sim/fx.js';
import {
  SWORDOL_MASK, HEART_MASK, masksOverlap, enginePairHit, grazeMaskAt,
} from '../../sim/masks.js';
import { roaringknightSlash } from '../../sim/attacks/roaringknight-slash.js';
import { tunnelslashBullet, afterimage } from '../../sim/attacks/knightlines.js';
import { cue } from '../../sim/audio.js';
import { scrDamageSingle, gearOf } from '../../sim/damage.js';
import { grazeFactors } from '../../sim/equipment.js';
import { scrTensionheal } from '../../sim/tension.js';

// obj_bullet_knight_tunnelslash is byte-identical in both dumps — the
// verified sim object ships unchanged. Re-exported so the launcher swaps
// only the import source.
export { tunnelslashBullet, afterimage };

/** scr_get_box — byte-identical copy of the sim module's local helper. */
function boxOf(state) {
  return state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
}
function getBox(state, which) {
  const gt = boxOf(state);
  if (!gt) return which === 0 || which === 2 || which === 4 ? state.view.x + 320 : state.view.y + 170;
  const hw = (gt.image_xscale ?? 2) * 75 * 0.5;
  const hh = (gt.image_yscale ?? 2) * 75 * 0.5;
  switch (which) {
    case 0: return gt.x + hw; // RIGHT
    case 1: return gt.y - hh; // TOP
    case 2: return gt.x - hw; // LEFT
    case 3: return gt.y + hh; // BOTTOM
    case 4: return gt.x; // centre x
    default: return gt.y; // centre y
  }
}

// The mod's gt_* helpers (gml_GlobalScript_gt_minx/miny/maxy):
// `obj_growtangle.x - sprite_width / 2` etc. sprite_width is the 75px board
// sprite times image_xscale — the same 75 the copied getBox uses.
function gtMinx(state) {
  const gt = boxOf(state);
  if (!gt) return state.view.x + 320 - 75; // i_ex guard; unreached in a turn
  return gt.x - (75 * gt.image_xscale) / 2;
}
function gtMiny(state) {
  const gt = boxOf(state);
  if (!gt) return state.view.y + 170 - 75;
  return gt.y - (75 * gt.image_yscale) / 2;
}
function gtMaxy(state) {
  const gt = boxOf(state);
  if (!gt) return state.view.y + 170 + 75;
  return gt.y + (75 * gt.image_yscale) / 2;
}

/**
 * irandom_range WITH REAL BOUNDS — a kaizo-local reimplementation.
 *
 * WHY IT EXISTS. Other_21 line 113 is
 * `irandom_range(gt_miny() + 10, gt_maxy() - 10)`, and gt_miny/gt_maxy are
 * `obj_growtangle.y -/+ sprite_height / 2` — sprite_height being the 75px
 * board sprite times image_yscale. The mod's ac-110 arena is 1.5 x 2.5, and
 * obj_growtangle QUANTISES a non-2 scale to multiples of 1/37.5
 * (`maxyscale = round(maxyscale * 37.5) / 37.5`, sim/battlebox.js), so
 * 2.5 becomes 94/37.5 = 2.5066666..., f32 on store, and the half-height is
 * 93.99999976158142. Both bounds are genuinely fractional: the real game
 * really does call irandom_range with reals here.
 *
 * `sim/rng.js`'s gmlIrandomRange assumes integer bounds (it takes
 * `BigInt(hi - lo + 1)`, which THROWS on 168.99999952316284) and sim/ is
 * off-limits to kaizo (HANDOFF.md §2.3, the isolation contract), so the
 * behaviour is reimplemented here instead of patched there.
 *
 * THE MODEL — **UNVERIFIED APPROXIMATION, pending the V-C oracle recording.**
 * The measured, oracle-validated part of `irandom_range` is: TWO u32 draws,
 * composed to 63 bits (low word full, high word masked to 31), then
 * `lo + i63 % (hi - lo + 1)` — validated only against INTEGER arguments
 * (traces/rng-probe.csv section E is `irandom_range(-3, 3)`; the probe never
 * fed it a real). What a real argument does is therefore a choice, and this
 * takes the one the function's name argues for: **floor both bounds, then
 * apply the verified integer model**, so an `i`random still returns an
 * integer. Note this coincides exactly with the other plausible reading —
 * keeping lo real, truncating the range to int64 and flooring the result —
 * for any positive bounds, which is all this attack produces.
 *
 * The candidate that would differ: ROUNDING the bounds instead of flooring
 * would make the upper bound 254 rather than 253 here, i.e. one pixel more
 * lane at the bottom of the box. That is the whole size of the uncertainty.
 *
 * THE LOAD-BEARING PROPERTY IS THE DRAW COUNT, and it is exact: two u32
 * draws, taken in the same order and composed the same way as sim/rng.js's
 * private gmlI63, so the shared stream lands in the identical place whatever
 * the rounding model turns out to be. With integer bounds this function is
 * bit-identical to gmlIrandomRange (asserted in check-knightlines.mjs), so
 * it is a strict superset, not a divergence.
 *
 * No other kaizo module reaches this case: every other gmlIrandomRange /
 * gmlIrandom call site under kaizo/attacks/ passes integer literals or
 * integer-valued counters (roaring-final-shatter's `-delay..delay` starts at
 * 6 and decrements by 1; sword-vortex's fractional gt.x is added OUTSIDE the
 * irandom). Checked 2026-08-28.
 *
 * EXPORTED so check-knightlines.mjs §G tests THIS function rather than a
 * copy of it, and so a later module hitting the same case can reuse it
 * instead of re-deciding the model. It is not part of the sim module's
 * surface — the launcher does not need it.
 */
export function kaizoIrandomRange(r, lo, hi) {
  const a = Math.floor(lo);
  const b = Math.floor(hi);
  // The composition sim/rng.js validated: low word full, high word masked to
  // 31 bits. Two draws, always, exactly as gmlI63 takes them.
  const wLo = gmlU32(r);
  const wHi = gmlU32(r) & 0x7fffffff;
  const i63 = (BigInt(wHi) << 32n) | BigInt(wLo);
  return a + Number(i63 % BigInt(b - a + 1));
}

/** kaizo_sideb() (gml_GlobalScript_kaizo_settings_init.gml:79) — the B-Side
 *  flag, stamped on the scene at build: state.kaizo?.sideb. Returned as 0/1
 *  because the GML uses it in arithmetic (`1 + kaizo_sideb()`). */
function kaizoSideb(state) {
  return state.kaizo?.sideb ? 1 : 0;
}

/**
 * `c_dkgray` — GameMaker's own constant, 4210752 = $404040. The carousel's
 * brightness-by-depth endpoint.
 */
const DKGRAY = [64, 64, 64];

/**
 * `#020000` — the packed real 2 (BGR: R 2, G 0, B 0), used by Other_21 as a
 * TAG rather than a colour: the stride ghosts are stamped with it so the two
 * `with (obj_afterimage)` passes can pick out this sword's own ghosts from
 * every other afterimage on screen, and the post-sweep pass untags them by
 * overwriting with the sword's real blend. Compared by VALUE (`isTagged`)
 * exactly as the GML compares the packed real, so a ghost that has been
 * untagged and happens to be re-created can never be confused.
 */
const AFTERIMAGE_TAG = [2, 0, 0];
const isTagged = (a) => Array.isArray(a.image_blend)
  && a.image_blend[0] === 2 && a.image_blend[1] === 0 && a.image_blend[2] === 0;

/**
 * obj_lerpvar with stepOrder -1 — the SAME tween, stepped before the
 * slasher. GameMaker steps newest-first, so a tween created during the
 * carousel writes its frame's value BEFORE the slasher's step reads it; this
 * engine steps oldest-first, which would leave every read one write behind —
 * including the sweep's final `direction`, a real hit-geometry divergence
 * (ease-out t=14/15 on a multi-thousand-degree span is degrees off). Same
 * compensation family as sword-vortex's stepOrder -1.
 */
const lerpvarEarly = { ...lerpvar, stepOrder: -1 };

function scrLerpvarEarly(state, target, varname, pointa, pointb, maxtime, easetype, easeinout) {
  const t = spawn(state, lerpvarEarly, { x: 0, y: 0 });
  t.target = target;
  t.varname = varname;
  t.pointa = pointa;
  t.pointb = pointb;
  t.maxtime = maxtime;
  if (easetype !== undefined) t.easetype = easetype;
  if (easeinout !== undefined) t.easeinout = easeinout;
  return t;
}

/**
 * scr_var_delay(name, value, time) = scr_script_delayed(scr_var, time, ...)
 * (gml_GlobalScript_scr_var_delay.gml): an obj_script_delayed whose alarm[0]
 * fires `time` frames later — in the ALARM phase, before any step — and
 * writes the variable iff the target still exists (Other_10's i_ex guard).
 * Alarms are alarms (project law): this uses the engine's alarm slot, so the
 * write lands before the slasher's step of its frame exactly as in the game.
 */
const scriptDelayed = {
  name: 'obj_script_delayed',
  create(e) {
    e.target = null;
    e.varname = '';
    e.value = undefined;
  },
  alarm: {
    0(e) {
      if (e.target && e.target.alive) e.target[e.varname] = e.value;
      destroy(e); // instance_destroy() (obj_script_delayed Alarm_0)
    },
  },
};

function scrVarDelay(state, target, varname, value, time) {
  const d = spawn(state, scriptDelayed, { x: 0, y: 0 });
  d.target = target;
  d.varname = varname;
  d.value = value;
  d.alarm[0] = time;
  return d;
}

/**
 * A carousel sword — a plain `instance_create(x, y, obj_regularbullet)`
 * (Other_21 attack_con 1) with the mod's instance variables grafted on by
 * the spawner, exactly as the GML does it. Its own events are just the
 * inherited obj_regularbullet Create/Step; everything interesting is done TO
 * it by the slasher's driver. `flag` / `ang` / `targY` / `yscale` / `aft` /
 * `donehit` are plain GML instance vars (none collide with engine fields —
 * `target` here is the bullet-damage target scr_bullet_init owns).
 *
 * The engine pair collision is live the whole time (obj_regularbullet is an
 * obj_collidebullet child): a sword crossing the soul damages it through the
 * normal Other_15 path — 210, destroyonhit 0 — independent of the hitscan,
 * and an embedded wall sword keeps hurting to walk into, like the vanilla
 * spears.
 */
export const carouselSword = {
  name: 'obj_regularbullet',

  create(e, state) {
    regularbulletCreate(e, state); // obj_regularbullet Create (scr_bullet_init)
  },

  step(e, state) {
    regularbulletStep(e, state); // obj_regularbullet Step
  },

  collides(e, heart) {
    if (e.active !== 1 && e.active !== true) return false;
    // spr_roaringknight_sword_ol's mask — the 4047 resolution (see header).
    return enginePairHit(heart, e, SWORDOL_MASK);
  },

  other15: collidebulletOther15,
};

/** The carousel swords, in `with (obj_regularbullet)` order: newest first
 *  (the measured with() iteration order — sim/attacks/pointing-cone.js).
 *  variable_instance_exists(id, "flag") keeps foreign regularbullets out. */
/**
 * `with (obj_regularbullet)` VISITS NEWEST-FIRST. Measured three ways, and
 * this replaces a note that said the opposite.
 *
 * WHY IT MATTERS: Other_21's per-frame driver draws ONE u32 per orbiting
 * sword (`direction = random_range(176, 184)`, line 159) and assigns it to
 * `image_angle`, so the visit order decides which sword gets which value and
 * every value lands in the bullets sheet.
 *
 * THE INSTRUMENT THAT SETTLED IT, which is reusable and was not obvious: THE
 * SEQ LOG'S ROW ORDER IS A `with` ITERATION-ORDER READOUT. The recorder logs
 * new instances with
 *     for (_w ...) with (global.oracle_watch[_w])
 *         if (!ds_map_exists(global.oracle_seen, id)) { ...write one row... }
 * (oracle_kaizo_fight.csx:933-955), so within one frame and one watched
 * object the CSV row order IS the order `with` visited the instances.
 * Reading it at three independent sites:
 *
 *   obj_knight_pointing_star  — strictly newest-first, 4 occurrences, over
 *                               stars born on 9-20 different frames
 *   obj_regularbullet         — 7 same-frame-born instances in exact reverse
 *                               creation order, 30 occurrences, 0 deviations
 *   obj_afterimage            — reverse creation, cross-checked by resolving
 *                               each ghost's hspeed/vspeed to its stream index
 *
 * So sim/scenes/fight.js clearTurn's "a with() iterates NEWEST FIRST" is the
 * general rule, and this function was the outlier.
 *
 * THE KNOWN GAP, STATED PLAINLY BECAUSE IT COSTS THE GATE THREE FRAMES.
 * Across the whole carousel (~253 frames, populations 2 through 18, and a
 * SECOND independent run of the same attack at oracle f11967 on anchor n=46)
 * the order is newest-first everywhere EXCEPT oracle f5818/f5819/f5820, which
 * are unambiguously oldest-first. That is the only dissent in either run, and
 * it reproduces byte-for-byte in both, so it is deterministic and structural.
 *
 * NO PER-INSTANCE SORT CAN PRODUCE BOTH. The state pair {ang 90, ang 110}
 * occurs at f5818 and again at f5821 and is visited in OPPOSITE order, so
 * sort(f(state)) is impossible for any f. `ang` is age in closed form
 * (90 + (f - birth + 1) * 360/18/3, never wrapped) and `depth`
 * (= knight.depth - 4*cos ang) is non-monotone but flips at f5829/f5843,
 * where the data is rigidly newest-first. Both are eliminated by measurement.
 *
 * THIS LANE SORTED OLDEST-FIRST UNTIL NOW, fitted to those three frames, and
 * the gate rewarded it: oldest-first reads bullets f5821, newest-first reads
 * f5818. That is backwards as engineering — oldest-first is wrong on ~250 of
 * the 253 frames and wins only because its three correct frames come first.
 * With the three frames overridden by hand the carousel is byte-exact to
 * f5868, so explaining them is worth about fifty frames; a rule that merely
 * SWITCHES on sword count is refused, because the recording refutes it (the
 * attack's tail runs two and three drawing swords newest-first) and because
 * an unexplained switch is a fit, which is what this note is undoing.
 */
function carouselSwords(state) {
  return state.entities
    .filter((s) => s.alive && s.type === carouselSword && s.flag !== undefined)
    .sort((a, b) => b.seq - a.seq);
}

/** place_meeting(x, y, obj_heart) inside the sweep — the sword's current
 *  mask against the soul's. The slasher is newer than the turn's soul, so
 *  its step runs BEFORE the heart's move in the game: the probe tests the
 *  PRE-STEP soul (state.soulPrev), the same compensation the sword tunnel's
 *  swept probe uses (sim/index.js). */
function sweepHitsHeart(state, s) {
  const heart = state.soul;
  if (!heart || !heart.alive) return false;
  const hp = state.soulPrev ?? heart;
  return masksOverlap(
    heart.mask ?? HEART_MASK, hp.x, hp.y,
    SWORDOL_MASK, s.x, s.y, s.image_xscale ?? 1, s.image_yscale ?? 1, s.image_angle ?? 0,
  );
}

/** place_meeting(x, y, obj_grazebox) inside the sweep. obj_grazebox
 *  repositions in its END step, so during any step it sits where the heart
 *  was LAST frame — state.grazePrev (sim/index.js), the same lag the normal
 *  graze pass compensates. Ribbon/bow armour scales the box
 *  (grazeMaskAt), exactly as sim/tension.js's pass does. */
function sweepHitsGrazebox(state, s, sizeFactor) {
  if (!state.soul || !state.soul.alive) return false;
  const gx = state.grazePrev ? state.grazePrev.x : state.soul.x + 10;
  const gy = state.grazePrev ? state.grazePrev.y : state.soul.y + 10;
  return masksOverlap(
    grazeMaskAt(sizeFactor), gx, gy,
    SWORDOL_MASK, s.x, s.y, s.image_xscale ?? 1, s.image_yscale ?? 1, s.image_angle ?? 0,
  );
}

/**
 * Other_21 (User Event 11) — the whole PierceBlades attack, run every frame
 * from the Step gate while attack_type == 1. Structure and line comments
 * follow gml_Object_obj_knight_tunnel_slasher_Other_21.gml top to bottom.
 */
function carouselStep(e, state) {
  const knightX = e.x + 120; // Other_21 line 1
  const knightY = e.y + 76; // line 2
  const minX = gtMinx(state) + 16; // line 3
  e.timer += 1;
  e.fulltimer += 1;
  // lines 6-10: `_swordsprite = 4047; if (secretswords == 1) _swordsprite =
  // 4996;` — raw ids resolved per the header note. secretswords is never set
  // in the dump, so the alt arm is dormant but kept.
  let swordsprite = 'spr_roaringknight_sword_ol'; // 4047
  if (e.secretswords === 1) swordsprite = 'spr_roaringknight_sword_ol_alt'; // 4996

  // lines 11-17: the attack owns the clock until its end state releases it.
  if (e.attack_con < 4) {
    if (state.turntimer > 0) state.turntimer = 999;
  }

  if (e.attack_con === 0) {
    // ── arm (2 frames) — Other_21 lines 18-44
    if (e.timer === 1) {
      e.at_gshake = 0;
      e.at_swords = [];
      if (kaizoSideb(state)) {
        e.at_num = 34; // B-Side: 34 swords, one per frame
        e.at_delay = 1;
      } else {
        e.at_num = 18; // A-Side: 18 swords, one every 3 frames
        e.at_delay = 3;
      }
      e.at_spin = 360 / e.at_num / e.at_delay;
    }
    e.image_speed = 0;
    e.image_index = 0;
    if (e.timer >= 2) {
      e.attack_con = 1;
      e.timer = 0;
      e.image_index = 1;
    }
  } else if (e.attack_con === 1) {
    // ── spawn the carousel — Other_21 lines 45-88
    if (e.image_index < 2) {
      e.image_index += 0.2;
    }
    if (e.timer % e.at_delay === 0 && e.at_num > 0) {
      e.at_num -= 1;
      cue(state, 'snd_swing', 3, 0.7); // snd_play(snd_swing, 0.7, 3)
      // instance_create(x, y, obj_regularbullet) + the with-block, verbatim
      // (lines 55-75). No RNG in this block.
      const s = spawn(state, carouselSword, { x: e.x, y: e.y });
      s.donehit = false;
      s.sprite_index = swordsprite;
      s.depth = e.depth - 1;
      s.image_alpha = 0;
      // Other_21 l.62: `image_blend = c_black`. The carousel's starting
      // colour, and the value flag A immediately begins merging away from.
      s.image_blend = BLACK;
      scrLerpvarEarly(state, s, 'image_alpha', 0, 1, 10); // scr_lerpvar("image_alpha", 0, 1, 10)
      s.target = 0;
      s.damage = 210; // the mode's damage — NOT the dispatch's 103
      s.grazepoints = 12.5;
      s.destroyonhit = 0;
      s.wall_destroy = 0;
      s.flag = 'A';
      s.ang = 90;
      s.aft = 0;
      s.yscale = 1.25; // plain var, distinct from image_yscale — load-bearing
      s.image_xscale = 1.25;
      s.image_yscale = 1.25;
      e.at_swords.push(s); // array_push(at_swords, _newsword)
    }
    if (e.at_num <= 0) {
      e.attack_con = 2;
      e.timer = 13;
      e.atk_min = 1;
      if (kaizoSideb(state)) {
        e.atk_min = -3; // B-Side starts on a longer window
      }
    }
  } else if (e.attack_con === 2) {
    // ── fling volleys, accelerating — Other_21 lines 89-142
    if (e.timer >= 15) {
      e.timer = Math.floor(e.atk_min); // timer = floor(atk_min)
      e.atk_min = scrApproach(e.atk_min, 8, 0.25);
      if (e.image_index > 3) {
        scrLerpvarEarly(state, e, 'image_index', 1, 2, 4);
      } else {
        scrLerpvarEarly(state, e, 'image_index', 4, 5, 4);
      }
      const rot = 15; // var _rot = 15
      const sr = 1 + kaizoSideb(state); // var _sr — B-Side flings two
      for (let rep = 0; rep < sr; rep++) {
        if (e.at_swords.length > 0) {
          cue(state, 'snd_leaf_dodge', 0.8, 1 / sr);
          cue(state, 'snd_leaf_dodge', 0.75, 1 / sr);
          // RNG, order-critical (lines 111-116): irandom (2 draws),
          // irandom (2), irandom_range (2), random_range (1), then the
          // choose (1) inside the with — 8 draws per fling.
          const swordID = gmlIrandom(state.gmlRng, e.at_swords.length - 1);
          const targetX = (boxOf(state)?.x ?? state.view.x + 320) + 160
            + gmlIrandom(state.gmlRng, 48);
          // irandom_range with REAL bounds — see kaizoIrandomRange. Same two
          // draws sim/rng.js's gmlIrandomRange would take, in the same order.
          const slashY = kaizoIrandomRange(state.gmlRng, gtMiny(state) + 10, gtMaxy(state) - 10);
          let targetY = slashY + gmlRandomRange(state.gmlRng, -56, 56);
          targetY = clamp(targetY, gtMiny(state) - 12, gtMaxy(state) + 12);
          const slashdir = pointDirection(targetX, targetY, minX, slashY) + 1440;
          const s = e.at_swords[swordID];
          if (s && s.alive) { // with() on a dead instance no-ops
            s.flag = 'B';
            s.blend_con = 0;
            s.blend1 = s.image_blend;
            s.blend2 = WHITE; // 16777215 = c_white
            s.targY = slashY;
            scrLerpvarEarly(state, s, 'x', s.x, targetX, rot, 2, 'out');
            scrLerpvarEarly(state, s, 'y', s.y, targetY, rot, 2, 'out');
            // 3-5 extra turns of spin onto the lane (choose: 1 draw).
            scrLerpvarEarly(state, s, 'direction',
              gmlChoose(state.gmlRng, [s.direction + 1080, s.direction + 1800]),
              slashdir, rot, 2, 'out');
            scrVarDelay(state, s, 'flag', 'C', rot + 1);
            scrVarDelay(state, s, 'blend_con', 0, rot + 1);
            // THE TELEGRAPH GOES BLUE (Other_21 l.129-130). One frame after
            // the sword lands on its lane the endpoints are re-armed to
            // white -> get_swordcolor(), and flag C's scr_approach walks
            // blend_con to 1 over 13 frames (15 on the B-Side) — that ramp
            // IS the rake's countdown, so the colour and the danger are the
            // same clock. Pure lookup; no RNG.
            scrVarDelay(state, s, 'blend1', WHITE, rot + 1); // 16777215
            scrVarDelay(state, s, 'blend2', getSwordcolor(state), rot + 1);
            scrLerpvarEarly(state, s, 'blend_con', 0, 1, 10);
          } else {
            // Unreachable in practice (nothing kills a carousel sword:
            // wall_destroy 0, destroyonhit 0) — but GML's with() would
            // simply skip a dead id AFTER the draws above, so the RNG
            // stays consumed either way.
          }
          e.at_swords.splice(swordID, 1); // array_delete(at_swords, _swordID, 1)
        } else {
          e.attack_con = 3;
          e.timer = 0;
        }
      }
    }
  } else if (e.attack_con === 3) {
    // ── end — Other_21 lines 143-150. The sweep's `with (other)` resets
    // timer while slashes are still landing, so this 30-frame wait starts
    // after the LAST embed.
    if (e.timer >= 30) {
      state.turntimer = 0;
      e.attack_con = 4;
      // CleanUp_0 — HERE, on the write that ends the turn. In the game the
      // slasher is destroyed by obj_battlecontroller's sweep (`with
      // (obj_bulletparent) instance_destroy()` — its parent is
      // obj_bulletparent, objects_kaizo.csv:248), which fires CleanUp; the
      // engine has no destroy hook (sim/entity.js destroy() is `alive =
      // false`), so this module calls its own, the convention every kaizo
      // CleanUp follows. THE FRAME: the kaizo scene's director tests the
      // clock in its endStep (kaizo/scenes/kaizo-practice.js, "the sweep
      // lands ON the frame the clock reaches zero"), i.e. THIS frame — the
      // slasher never reaches another draw slot, so nothing below can
      // re-hide what this restores. The game's controller tests in its
      // Step, one frame later, and its Draw at attack_con 4 hides once more
      // before that; the sweep's own timing is the director's, not this
      // module's, and is not moved here.
      knightTunnelSlasherCleanUp(e, state);
    }
  }

  // ── the per-frame sword driver — Other_21 lines 151-289,
  // `with (obj_regularbullet) if (variable_instance_exists(id, "flag"))`,
  // NEWEST-first (measured three ways; see carouselSwords).
  if (e.attack_con > 0) {
    for (const s of carouselSwords(state)) {
      if (s.flag === 'A') {
        // ORBIT (lines 157-180). One draw per orbiting sword per frame —
        // pure image_angle jitter (speed is 0), but it is IN THE STREAM.
        s.direction = gmlRandomRange(state.gmlRng, 176, 184);
        s.image_angle = s.direction;
        s.ang += e.at_spin;
        s.x = knightX + lengthdirX(24, s.ang);
        s.y = knightY + lengthdirY(100, s.ang);
        s.x -= gmlRound(knightY - s.y) / 8; // round() is half-to-even
        s.depth = e.depth - lengthdirX(4, s.ang);
        // lines 166-167: brightness-by-depth. The carousel sword dims as it
        // swings behind the Knight and brightens as it comes round the
        // front, on the same `ang` the depth sort uses. No RNG.
        const dark = lengthdirX(-0.5, s.ang) + 0.5;
        s.image_blend = mergeColor(WHITE, DKGRAY, dark);
        if (!s.aft) {
          // Spawn-frame flourish: two scr_afterimagefast ghosts, each with
          // hspeed/vspeed = random_range(-2, 2) — FOUR draws, once per
          // sword (lines 168-178).
          for (let r = 0; r < 2; r++) {
            const g = scrAfterimage(state, s); // scr_afterimagefast = same copy…
            g.fadeSpeed = 0.08; // …at fadeSpeed 0.08
            const hs = gmlRandomRange(state.gmlRng, -2, 2);
            const vs = gmlRandomRange(state.gmlRng, -2, 2);
            // hspeed/vspeed assignment — the engine stores speed/direction,
            // so the pair is derived (same convention as the sim module's
            // `fade.hspeed = 4` translation).
            g.speed = Math.sqrt(hs * hs + vs * vs);
            g.direction = pointDirection(0, 0, hs, vs);
          }
          s.aft = 1;
        }
      } else if (s.flag === 'B') {
        // FLIGHT (lines 181-185): the sword flies to its staging point while
        // image_blend merges from the grey it carried out of the carousel
        // toward c_white. blend_con is still 0 here — flag C's approach is
        // what moves it — so this holds blend1 until the swap below.
        s.image_angle = s.direction;
        s.image_blend = mergeColor(s.blend1, s.blend2, s.blend_con);
      } else if (s.flag === 'C') {
        // TELEGRAPH, then THE SWEEP (lines 186-278).
        s.image_yscale = 0.3;
        if (s.blend_con >= 1) {
          // The telegraph blend completed (13 scr_approach steps A-Side,
          // 15 B-Side — reaching exactly 1 only because scr_approach
          // clamps on crossing): rake the lane THIS frame.
          s.depth = e.depth - 5;
          if (e.attack_con === 3) {
            e.timer = 0; // the end wait restarts while slashes still land
          }
          scrLerpvarEarly(state, e, 'at_gshake', 4, 0, 4);
          const sr = 1 + kaizoSideb(state);
          cue(state, 'snd_knight_cut', 1, 1 / sr);
          cue(state, 'snd_impact', 1, 1 / sr);
          s.flag = 'D';
          const stepspd = 7.5; // var _stepspd
          const afsteps = 4; // var _afsteps
          let dist = pointDistance(s.x, s.y, minX, s.targY);
          const rep = Math.ceil(dist / stepspd); // var _rep
          let repN = 0;
          const gf = grazeFactors(gearOf(state));
          for (let i = 0; i < rep; i++) {
            repN += 1;
            dist = pointDistance(s.x, s.y, minX, s.targY);
            const spd = Math.min(stepspd, dist);
            if (spd < 1) {
              s.x = minX;
              s.y = s.targY;
            } else {
              s.x += lengthdirX(spd, s.direction);
              s.y += lengthdirY(spd, s.direction);
              if (repN % afsteps === 1 && dist > afsteps * stepspd) {
                // Stride ghosts (lines 223-237). #020000 is the TAG, not a
                // colour — see AFTERIMAGE_TAG.
                const g = scrAfterimage(state, s); // scr_afterimagefast()
                g.fadeSpeed = 0.08;
                g.image_blend = AFTERIMAGE_TAG; // #020000
                g.image_yscale = s.image_yscale * 1.5;
                for (const a of state.entities) {
                  if (a.alive && a.type.name === 'obj_afterimage' && isTagged(a)) {
                    a.image_alpha -= a.fadeSpeed;
                  }
                }
              }
            }
            // THE HITSCAN (lines 239-263): per-stride place_meeting against
            // the heart, else the grazebox — an invulnerable soul is not
            // even probed.
            if (state.invTimer < 0 && !s.donehit) {
              if (sweepHitsHeart(state, s)) {
                s.donehit = 1;
              } else if (sweepHitsGrazebox(state, s, gf.size)) {
                if (s.grazed === 0) {
                  s.grazed = -1; // NOT 1 — the normal graze pass pays nothing more
                  scrTensionheal(state, s.grazepoints * gf.tp);
                  // `with (obj_battlecontroller) grazenoise = 1` — the
                  // controller (oldest instance, steps last) converts the
                  // flag to ONE snd_graze the same frame.
                  cue(state, 'snd_graze');
                  // `with (obj_grazebox) grazetimer = 10` — the ring flash.
                  state.grazeTimer = 10;
                }
              }
            }
          }
          // Post-sweep (lines 265-274): the sword is spent as a grazer.
          s.grazed = 1;
          s.grazepoints = 0;
          s.image_yscale = s.yscale;
          for (const a of state.entities) {
            if (a.alive && a.type.name === 'obj_afterimage' && isTagged(a)) {
              // Untag AND retint (line 272): every ghost this sword left
              // along the rake takes the sword's own telegraph blue, so the
              // whole streak reads as one blue cut rather than a trail of
              // stray sprites.
              a.image_blend = s.image_blend;
            }
          }
        }
        s.blend_con = scrApproach(s.blend_con, 1, 1 / (13 + kaizoSideb(state) * 2));
        // line 277: the telegraph itself — white -> get_swordcolor() on the
        // very counter that decides when the lane rakes. This is the mod's
        // blue on 18 (34 on the B-Side) swords at once, and the single
        // largest colour surface in the attack.
        s.image_blend = mergeColor(s.blend1, s.blend2, s.blend_con);
      } else if (s.flag === 'D') {
        // EMBEDDED (lines 279-286): the sweep's hit pays out the FRAME
        // AFTER, through scr_damage() — single target, its own inv gate,
        // and the chapter-3 targeting block (which can consume a choose).
        if (s.donehit) {
          scrDamageSingle(state, s.damage, s.target ?? 0);
          s.donehit = false;
        }
      }
    }
  }

  // Tail (lines 290-296) — same shape as the vanilla Step's afterimage
  // block. `fade.hspeed = 4` → the derived speed/direction pair, exactly as
  // the sim module translates it.
  if (e.fulltimer % 2 === 0) {
    const fade = scrAfterimage(state, e);
    fade.image_alpha = 0.6;
    fade.fadeSpeed = 0.04;
    fade.speed = 4;
    fade.direction = 0;
  }
}

export const knightTunnelSlasher = {
  name: 'obj_knight_tunnel_slasher',

  create(e, state) {
    e.sprite_index = 'spr_roaringknight_attack_ol'; // object definition
    // Object-definition depth is not in the dump; 0 is a labelled base — it
    // only feeds draw order and the swords' relative depths (see header).
    e.depth = e.depth ?? 0;
    e.image_speed = 0;
    e.image_index = 1;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.push_left = 4;
    e.timer = 0;
    e.fulltimer = 0;
    // THE ONE RNG DRAW IN THE OBJECT, and it is what makes two launches
    // differ: it phases the sine that places every spear. Consumed in BOTH
    // modes — kaizo Create_0 line 8 runs before the mode check.
    e.individuality = gmlRandom(state.gmlRng, 100);
    e.behavior = 'prepare';
    e.damage = 206;
    // ── KAIZO Create_0 lines 11-30 from here ──
    e.element = 5;
    e.boxpushcon = 0;
    e.boxpushstart = 0;
    e.attack_type = 0;
    e.attack_con = 0;
    // `fucking_sword_surface = -4` / `surface_create(640, 480)` — the Draw
    // pipeline's buffer, renderer-only, skipped (header note 2).
    e.secretswords = 0;
    // `with (obj_knight_enemy) { if (myattackchoice == 110) other.attack_type
    // = 1; }` — state.currentAc is the sim's myattackchoice mirror, set by
    // the launcher before the spawner call. gmlEq: the mod's acs include
    // fractional values, so no bare === on this comparison.
    if (gmlEq(state.currentAc ?? -1, 110)) e.attack_type = 1;
    if (e.attack_type === 1) {
      e.image_speed = 0;
      e.image_index = 0;
    }
  },

  step(e, state) {
    // ── KAIZO Step_0 lines 1-8: the attack-110 dispatcher. In mode 1 NONE
    // of the vanilla step below runs — Other_21 has its own afterimage tail.
    if (e.attack_type > 0) {
      if (e.attack_type === 1) {
        carouselStep(e, state); // event_user(11) — runs inside the Step slot
      }
      return; // exit
    }

    e.fulltimer += 1;
    e.damage = 206; // kaizo Step_0 line 10 — re-pinned every frame

    // ── KAIZO Step_0 lines 11-35: the staged arena push. Armed at slash
    // timer 24; shoves the board AND the soul ~93px left (5px x 7, 3px x 8,
    // then 2px frames; the >89 flag-set does not exit, so the same frame
    // still moves — integer state, exact compares).
    if (e.boxpushstart === 1) {
      const gt = boxOf(state);
      if (e.boxpushcon > 89) {
        e.boxpushstart = -1;
      }
      if (e.boxpushcon < 33) {
        e.boxpushcon += 5;
        if (gt) gt.x -= 5;
        if (state.soul && state.soul.alive) state.soul.x -= 5;
      } else if (e.boxpushcon > 56) {
        e.boxpushcon += 2;
        if (gt) gt.x -= 2;
        if (state.soul && state.soul.alive) state.soul.x -= 2;
      } else {
        e.boxpushcon += 3;
        if (gt) gt.x -= 3;
        if (state.soul && state.soul.alive) state.soul.x -= 3;
      }
    }

    if (e.behavior === 'prepare') {
      e.damage = 206; // kaizo Step_0 line 38
      e.image_index = scrApproach(e.image_index, 2.8, 0.2);
      if (e.push_left) {
        e.x -= e.push_left;
        e.push_left *= 0.8;
        if (e.push_left < 1) e.push_left = 1;
      }
      // `if (image_index == 2.8)` — scr_approach CLAMPS on crossing
      // (`if (from > to) return to`), so this lands on the literal exactly
      // rather than accumulating past it. gmlEq anyway: a real `==` in GML is
      // epsilon-based and this project has been bitten twice by translating
      // one as `===` (see sim/gml.js).
      if (gmlEq(e.image_index, 2.8)) e.timer += 1;
      if (e.timer === 16) {
        e.push_left = 4;
        e.behavior = 'slash';
        e.timer = 0;
        e.image_index = 3;
      }
    }

    if (e.behavior === 'slash') {
      e.damage = 206; // kaizo Step_0 line 63
      if (e.timer < 20) e.image_index = scrApproach(e.image_index, 5.6, 0.4);
      e.timer += 1;
      if (e.push_left) {
        // THE RECOIL — the same variable, now pushing the other way and with
        // no floor under it, so it dies out instead of settling at 1.
        e.x += e.push_left;
        e.push_left *= 0.9;
      }

      if (e.timer % 2 === 0 && e.timer < 24) {
        const offset = Math.sin(e.timer + e.individuality) * 100;
        const temptime = e.timer;
        cue(state, 'snd_smallswing', 3, 1);
        const sx = getBox(state, 0) + 50 + gmlRandom(state.gmlRng, 20) - e.timer * 2;
        // `scr_get_box(1) + scr_get_box(5) * 0.5` — the box's TOP plus half
        // its centre y, the author's shorthand the sim module documents.
        const sy = getBox(state, 1) + getBox(state, 5) * 0.5 + offset;
        const slash = spawn(state, roaringknightSlash, { x: sx, y: sy });
        slash.direction = 240 + gmlRandom(state.gmlRng, 60);
        slash.image_angle = slash.direction;
        slash.damage = 206; // KAIZO Step_0 line 82 — pinned on the slash

        // The spear, fired from the SLASH at speed zero (unchanged object,
        // imported from sim/attacks/knightlines.js).
        const b = spawn(state, tunnelslashBullet, { x: sx, y: sy });
        b.sprite_index = 'spr_roaringknight_slash_tunnel';
        b.direction = gmlChoose(state.gmlRng, [slash.direction, slash.direction + 180]);
        b.speed = 0;
        // `image_angle = other.direction` — the SLASH's angle, not the
        // bullet's own, so the spear is drawn along the cut that threw it.
        b.image_angle = slash.direction;
        b.alarm[0] = 32 + temptime * 4;
        b.damage = 206; // KAIZO Step_0 line 87 — the sim's `b.damage =
        // e.damage` becomes the mod's literal pin (same value: e.damage is
        // re-pinned 206 above)
      }

      if (e.timer === 20) e.image_index -= 1;
      if (e.timer === 24) {
        e.boxpushstart = 1; // KAIZO Step_0 line 97 — arms the arena push
        e.sprite_index = 'spr_roaringknight_point_ol';
        e.image_index = 0;
        e.damage = 206; // kaizo Step_0 line 100
      }
      if (e.timer > 32 && e.timer < 56) {
        e.image_index = scrApproach(e.image_index, 4, 0.35);
        e.push_left = 1;
        e.damage = 206; // kaizo Step_0 line 106
      }
    }

    if (e.fulltimer % 2 === 0) {
      const fade = scrAfterimage(state, e);
      fade.image_alpha = 0.6;
      fade.fadeSpeed = 0.04;
      fade.speed = 4;
      fade.direction = 0;
    }
  },

  endStep(e, state) {
    // Draw_0's stream draws (kaizo Draw_0 lines 14-19): while attack_type ==
    // 1 && attack_con > 1, the Draw event rolls `random_range(-at_gshake,
    // at_gshake)` TWICE per frame from the SHARED stream — even at
    // at_gshake 0. GML's frame order is …collision → End Step → Draw, and
    // nothing else consumes the stream between this slot and the next
    // frame, so consuming here is stream-order-exact. The offsets are kept
    // for the renderer's shake pass.
    if (e.attack_type === 1 && e.attack_con > 1) {
      e.shake_x = gmlRandomRange(state.gmlRng, -e.at_gshake, e.at_gshake);
      e.shake_y = gmlRandomRange(state.gmlRng, -e.at_gshake, e.at_gshake);
    }
  },

  /**
   * KAIZO Draw_0's `visible = false` writes — Draw-time STATE on the engine's
   * draw slot (sim/index.js "THE DRAW SLOT"). The Draw hides everything it
   * repaints itself, jolted by (_sx, _sy), so the ordinary pass draws none of
   * it a second time at its own depth; the painting is the kaizo Draw
   * override (kaizo/render/draw/stream.js), which reads shake_x / shake_y.
   *
   *     if (attack_type == 1) if (attack_con > 1) {
   *         with (obj_growtangle)  visible = false;                            // :10
   *         with (obj_afterimage)  if (sprite_index == spr_roaringknight_sword_ol_alt) visible = false;   // :24-26
   *         with (obj_regularbullet) if (variable_instance_exists(id, "flag")) {
   *             if (flag == "C") visible = false;                              // :38
   *             else if (flag == "D") visible = false;                         // :43
   *         }
   *         with (obj_tracking_sword1) visible = false;                        // :61
   *         with (obj_grazebox)  visible = false;                              // :66  — not an entity here (state.grazeTimer)
   *         with (obj_heart)     visible = false;                              // :75
   *         with (obj_dmgwriter) visible = false;                              // :84  — not entities here (state.dmg.list)
   *     }
   *
   * The box is the one hide with a SIM consequence: obj_growtangle's Step
   * branches on `visible` in the game (Step_0:3 the custom-box init, :54 the
   * grow-in ghosts) and in sim/battlebox.js (:178, :209) alike, and the
   * board is parked (growcon 2, init done) for every frame attack_con > 1,
   * so neither branch can be reached hidden — and knightTunnelSlasherCleanUp
   * has restored it before the sweep's close (growcon 3) does spawn ghosts.
   * obj_grazebox and obj_dmgwriter are not entities in this engine and their
   * late passes ignore `visible` (render/canvas.js), so those two writes
   * have nothing to land on; the soul's is kept as state (nothing reads
   * soul.visible — the soul pass draws it regardless), so that the hide and
   * CleanUp's restore are both on record. `with (obj_regularbullet)` is the
   * carousel's own swords here (carouselSwords: the flagged instances of
   * this module's obj_regularbullet type, newest-first), the only flagged
   * regularbullets that exist while the slasher does.
   *
   * `< 4`: at attack_con 4 the game's Draw runs once more before the
   * controller's sweep restores everything (CleanUp), and in this engine the
   * sweep lands in the SAME frame's endStep, so this slot never runs at 4 in
   * the fight. The term only matters in a scene with no director sweep,
   * where it keeps the CleanUp's restore (called at the 3 -> 4 write) from
   * being undone every frame by a slasher nothing ever destroys.
   *
   * MEASURED (scratch probe, V-C, seed 12345, the render smoke's pulse feed
   * and HP pin, no renderer): the first PierceBlades slasher is born on
   * frame 6465; the box and the soul read visible through attack_con 0/1,
   * hidden from the frame attack_con reaches 2 (6521) through 3 (from
   * 6743) — 272 hidden frames — and the box reads visible on 6793, the
   * frame the slasher is gone, and on every frame after. No frame showed the
   * box hidden without a live slasher.
   */
  draw(e, state) {
    if (e.attack_type !== 1) return;
    if (!(e.attack_con > 1 && e.attack_con < 4)) return;
    for (const gt of state.entities) {
      if (gt.alive && gt.type.name === 'obj_growtangle') gt.visible = false; // :10
    }
    for (const a of state.entities) {
      if (a.alive && a.type.name === 'obj_afterimage'
        && a.sprite_index === 'spr_roaringknight_sword_ol_alt') a.visible = false; // :26
    }
    for (const s of carouselSwords(state)) {
      if (s.flag === 'C' || s.flag === 'D') s.visible = false; // :38, :43
    }
    for (const t of state.entities) {
      if (t.alive && t.type.name === 'obj_tracking_sword1') t.visible = false; // :61
    }
    if (state.soul && state.soul.alive) state.soul.visible = false; // :75
  },
};

/**
 * CleanUp_0 (gml_Object_obj_knight_tunnel_slasher_CleanUp_0.gml), whole event:
 *
 *     if (surface_exists(fucking_sword_surface)) surface_free(fucking_sword_surface);   // :1-4  renderer-side
 *     with (obj_growtangle) visible = true;                                              // :5-8
 *     with (obj_dmgwriter)  visible = true;                                              // :9-12 — not entities here
 *     with (obj_heart)      visible = true;                                              // :13-16
 *
 * Restores what the draw slot hid. obj_grazebox is NOT restored — the mod
 * forgets it (header note 2), a quirk with no counterpart here since the
 * graze ring is not an entity. The carousel swords, the tracking swords and
 * the alt-sprite ghosts are not restored either, in the game or here: the
 * sweep that fires this destroys them. The surface is the renderer's
 * (kaizo/render/draw/stream.js keeps one 640x480 buffer for the page's
 * life); there is nothing to free on the sim side.
 *
 * Exported for the same reason verticalSplitCleanUp is: the engine has no
 * destroy hook, so a scene that tears the slasher down early calls this.
 * knightTunnelSlasher's step calls it at the turn-ending write (attack_con
 * 3 -> 4), the moment the sweep that would fire it lands.
 */
export function knightTunnelSlasherCleanUp(e, state) {
  for (const gt of state.entities) {
    if (gt.alive && gt.type.name === 'obj_growtangle') gt.visible = true;
  }
  if (state.soul && state.soul.alive) state.soul.visible = true;
}

/**
 * The KAIZO `type = 101` branch of obj_dbulletcontroller
 * (gml_Object_obj_dbulletcontroller_Step_0.gml lines 2136-2149):
 *
 *     if (!made) {
 *         made = true;
 *         obj_growtangle.image_xscale = 2.5;
 *         with (creatorid) image_alpha = 0;
 *         var roarknight_tunnel_slasher = instance_create(creatorid.x,
 *             creatorid.y, obj_knight_tunnel_slasher);
 *         scr_bullet_inherit(roarknight_tunnel_slasher);
 *     }
 *
 * THE VANILLA SLIDES ARE GONE. v105's branch opens with
 * `obj_growtangle.x -= 70; obj_heart.x -= 70;` — the mod removed both.
 * For ac 110 the board was already placed at x-110 with a 1.5 x 2.5 box by
 * Other_23's arena arm (the central launcher's openVCArena); the
 * image_xscale = 2.5 write lands mid-grow-in there and is stomped by the
 * box's own growth the next frame, exactly as in the game.
 *
 * TURN LENGTH: the mod's ac-110 arm sets no scr_turntimer, and in mode 1
 * Other_21 pins global.turntimer = 999 every frame until its end state
 * writes 0 — the attack owns its clock. The pin's gate is `turntimer > 0`,
 * so the launcher must hand the turn a POSITIVE starting clock.
 *
 * `opts.damage` is scr_bullet_inherit's damage copy — the dispatch sets
 * dc.damage = 103 (Other_23, ac 110 line 598 / the dormant ac 6). In mode 1
 * the Step exits before the 206 re-pin, so the slasher KEEPS the 103 — inert
 * in play (the carousel swords carry their own 210; the slasher has no
 * contact path) but faithful state. In mode 0 the Step re-pins 206
 * immediately. The inherit's other fields (grazepoints/timepoints/inv/
 * target/element off the dc) feed nothing this object ever reads after its
 * Step runs once, and are not modelled.
 */
export function launchKnightlines(state, x, y, opts = {}) {
  const knight = state.entities.find(
    (k) => k.alive && k.type.name === 'obj_knight_enemy',
  );
  const gt = boxOf(state);
  // `obj_growtangle.image_xscale = 2.5` (kaizo dbulletcontroller line 2141),
  // AND IT IS DEAD ON ARRIVAL IN THE GAME — which is the only reason it can be
  // skipped while the box is still growing.
  //
  // The write is made by obj_dbulletcontroller (object index 1432) and
  // obj_growtangle is 1516, so the box steps AFTER it on the same frame and
  // its growth block re-derives `image_xscale = maxxscale * sizer` from the
  // timer, throwing the 2.5 away before any Draw or trace row can see it.
  // Nothing between those two indices reads the box scale.
  //
  // THIS LANE CANNOT REPRODUCE THAT IN PLACE, because its launch runs one
  // phase later than the game's: the director launches from `endStep`
  // (kaizo-practice.js), which is after every entity's `step`, so the box has
  // already grown for the frame and there is nothing left to stomp the write.
  // Applying it unconditionally therefore leaves a value on screen that the
  // game never shows.
  //
  // MEASURED on _tok3 f5810, the atk_PierceBlades open. The recording's gt_xs
  // walks the grow-in ramp straight through: 1.0951111317 at f5809,
  // 1.1946666241 at f5810, 1.2942222357 at f5811. The sim read 2.5 on f5810
  // alone and rejoined the ramp on f5811 — a one-frame spike, and the whole
  // of the ARENA front there. gt_ys was never touched, which is what named
  // the write: 2.5 is this arena's yscale (`set(1.5, 2.5)` for ac 110 in
  // kaizo-mod-launcher.js), landing in the x field.
  //
  // So the write is kept ONLY when the box is not mid-growth, where the game
  // would not stomp it either (the growth block is gated on
  // `timer < maxtimer && growcon === 1`, sim/battlebox.js). This is a phase
  // compensation and is labelled as one; the standing alternative, if a third
  // site ever needs it, is to have obj_growtangle re-assert its own growth
  // invariant at the end of the frame instead — that belongs in the engine and
  // has to earn the vanilla 60 first.
  if (gt && !(gt.growcon === 1 && gt.timer < gt.maxtimer)) gt.image_xscale = 2.5;
  if (knight) knight.image_alpha = 0;

  const e = spawn(state, knightTunnelSlasher, {
    x: x ?? knight?.x ?? 0,
    y: y ?? knight?.y ?? 0,
  });
  if (opts.damage !== undefined) e.damage = opts.damage; // scr_bullet_inherit
  return e;
}
