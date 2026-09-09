// KAIZO obj_knight_pointing_starchild — the shards each Star bursts into, as
// the mod rebuilds them: the launch-delay stagger chain is gated on the
// controller being TYPE 98, difficulties 3.2 / 3.3 zero the delay entirely
// (all children of a star launch simultaneously and never home), and the
// Draw fade/despawn rule widens from `difficulty < 2` to
// `difficulty <= 2 || (difficulty == 3.3 && !kaizo_sideb())`.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// PROVENANCE: copied from the VERIFIED sim/attacks/pointing-starchild.js and
// changed ONLY where the mod's GML diverges from vanilla v105. Ground truth:
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_knight_pointing_starchild_Create_0.gml (l.27 coltimer)
//     gml_Object_obj_knight_pointing_starchild_Step_0.gml   (init l.1-29;
//                                                  recolors l.115 / l.140)
//     gml_Object_obj_knight_pointing_starchild_Draw_0.gml   (fade gate l.48)
//     gml_Object_obj_knight_pointing_starchild_Other_15.gml (behaviour-neutral)
//   delta specs: gml_Object_obj_knight_pointing_starchild_{Create_0,Step_0,
//     Draw_0,Other_15}.md
//
// DIVERGENCES from the sim module (each cited at its site):
//   * Create: `coltimer = -10` (Create l.27) — drives the Draw's
//     white->#86A2FF spawn-tint ramp. The ramp itself (and its -999999
//     freeze sentinel at con==1) is visual-only and untranslated; the field
//     is kept for state-shape parity.
//   * Step init: the `with (obj_dbulletcontroller)` stagger accumulation is
//     wrapped in `if (type == 98)` (Step l.9) — when no live type-98
//     controller exists the child keeps its base `delay = 25` and the
//     controller chain state is untouched; then
//     `if (difficulty == 3.2 || difficulty == 3.3) delay = 0` (Step l.24-27)
//     — and Create's `if (delay > 0)` wait means delay-0 children NEVER
//     track: they fly straight along blast_dir.
//   * endStep (the Draw's fade rule): gate widened to
//     `difficulty <= 2 || (difficulty == 3.3 && !kaizo_sideb())` (Draw l.48;
//     vanilla `difficulty < 2`). Newly fading: difficulty exactly 2 (vanilla
//     d2 homers persisted until offscreen) and 3.3 off B-Side. Still
//     excluded: 3, 3.1, 3.2, and 3.3 on B-Side.
//   * THE BLUE RECOLOUR SCHEME, now translated (it was the mod's single
//     biggest un-applied visual delta — 9699 shard-frames a run with no
//     tint at all). All of it is colour: NOT ONE DRAW IS CONSUMED.
//       - Step l.115: the con==1 flip outline becomes
//         `merge_color(c_white, get_swordcolor(), cos((timer/5)*pi))`
//         (vanilla c_black -> c_red). `outline` is a real GML instance
//         variable and render/draw/pointing-starchild.js already reads it.
//       - Draw l.1-4 / l.12-15: `coltimer` ticks every drawn frame and
//         drives the spawn tint `merge_color(c_white, #86A2FF,
//         clamp01(coltimer / 30))` onto image_blend.
//       - Draw l.25-30: the con==1 arm freezes the clock at the -999999
//         sentinel and takes image_blend the other way, #86A2FF -> c_black
//         over timer/10 — so a shard that starts aiming goes dark, and the
//         Step's own con==1 white->black flip line is overwritten by it
//         every drawn frame (the GML's Draw runs after its Step; endStep
//         here). BOTH writes are kept, in that order, as the original has
//         them.
//   * STILL NOT TRANSLATED, VISUAL ONLY (renderer work later, no RNG in
//     any of it): the con==4 explosion sprite's c_blue argument (Draw l.8;
//     vanilla c_red) and `_glowcol` (Draw l.18-31; vanilla 255 = c_red,
//     kaizo 16711680 = c_blue) — both are draw_* arguments computed from
//     LOCALS, not instance state, and render/draw/pointing-starchild.js
//     computes its own copy of each. The con==3 dash afterimage
//     `_afbm.image_blend = get_swordcolor()` (Step l.140) also stays out:
//     the sim never modelled obj_afterimage_blend here, and spawning one
//     now would add entities, not a tint.
// Fractional difficulties (3.2/3.3) are compared with gmlEq, never ===.
//
// obj_heart_follower and the chain-delay walker are UNTOUCHED by the mod, so
// they are imported from the sim and re-exported for the launcher swap.
//
// Everything below not marked KAIZO is byte-identical to the sim module.

import { destroy } from '../../sim/entity.js';
// THE MOD'S PALETTE, from the one shared source — never a private copy here
// (kaizo/attacks/kaizo-colors.js). getSwordcolor returns a STABLE reference,
// which matters at the `image_blend == get_swordcolor()` gates elsewhere in
// the mod; this module only reads it as a merge endpoint.
import { getSwordcolor, KAIZO_TELEGRAPH_COLOR } from './kaizo-colors.js';
import {
  angleDifference,
  clamp,
  clamp01,
  gmlEq,
  lengthdirX,
  lengthdirY,
  lerp,
  pointDirection,
  scrMovetowards,
  sign,
  mergeColor,
  WHITE,
  BLACK,
} from '../../sim/gml.js';
import { collidebulletOther15, regularbulletStep, regularbulletCreate } from '../../sim/bullets/regularbullet.js';
import { chainChildDelay } from '../../sim/attacks/pointing-starchild.js';
import { starOther15 } from './stars-pointing-star.js';
// G3 (2026-09-08): IN THE ROAR a starchild's Other_15 is the KNIGHT'S CATCH
// (kaizo obj_knight_pointing_starchild_Other_15.gml:1-16 -> `with
// (obj_knight_enemy) event_user(2)` = Other_12: 30, 25 defending, the hp-1
// clamp, hp_visible), not its own 75 party-wide. The catch lives with the
// roaring star because that file is Other_12's only other caller; the import
// cycle is benign (a hoisted function declaration, read only at call time).
import { kaizoKnightCatch } from './roaring-final-star.js';
import { STARCHILD_MASK, STARCHILD_TRAIL_MASK, scrPreciseHit, enginePairHit } from '../../sim/masks.js';

// UNCHANGED BY THE MOD — the sim's objects, re-exported so a launcher that
// swaps its import source for the kaizo Stars gets the whole roster here.
export { heartFollower, chainChildDelay } from '../../sim/attacks/pointing-starchild.js';

/** scr_rotatetowards — step `from` toward `to` by at most `delta`. */
function scrRotatetowards(from, to, delta) {
  const diff = angleDifference(to, from);
  if (Math.abs(diff) > delta) return from + sign(diff) * delta;
  return to;
}

/** scr_angle_lerp — interpolate along the SHORTER arc. */
function scrAngleLerp(from, to, t) {
  return from + lerp(0, angleDifference(to, from), t);
}

// spr_knight_starchild_parts, the sprite every shard wears (Create).
// GML's sprite_width/sprite_height are the FULL sprite dimensions times the
// SIGNED image scales — see the sim module's onscreen-footprint history.
const STARCHILD_SPRITE_W = 33;
const STARCHILD_SPRITE_H = 32;

/** scr_onscreen_tolerance(self, spacer). */
function onscreen(e, spacer, state) {
  const w = STARCHILD_SPRITE_W * (e.image_xscale ?? 1);
  const h = STARCHILD_SPRITE_H * (e.image_yscale ?? 1);
  if (e.x + w + spacer < state.view.x) return false;
  if (e.x - spacer > state.view.x + 640) return false;
  if (e.y + h + spacer < state.view.y) return false;
  if (e.y - spacer > state.view.y + 480) return false;
  return true;
}

export const pointingStarchild = {
  name: 'obj_knight_pointing_starchild',

  create(e, state) {
    // `event_inherited()` — the FIRST line of the original's Create. The
    // parent (obj_regularbullet) Create runs scr_bullet_init AND sets the
    // step-cull's fields: `wall_destroy = 1` is what lets the inherited
    // step remove a homer that flies off past view -80.
    regularbulletCreate(e, state);
    e.deceleration = 0.1;
    e.minspeed = 1;
    e.timer = 0;
    e.drawtimer = 0;
    e.damage = 1;
    e.element = 5;
    e.lifetime = 60;
    e.difficulty = 0;
    e.con = 0;
    e.tracking = true;
    e.start_angle = 0;
    e.target_angle = 0;
    e.rotation = 0;
    e.delay = 0;
    e.init = false;
    e.rotatespeed = 10;
    e.ease = 0;
    e.xscale_start = 0;
    e.yscale_start = 0;
    // `outline = 0` is c_black, which adds nothing under bm_add — the overlay
    // is invisible until the Step's flip drives it toward red.
    e.outline = BLACK;
    e.image_blend = WHITE;
    e.accel = 0.5;
    e.sprite_index = 'spr_knight_starchild_parts';
    e.isBullet = true;
    e.builtinMotion = true;
    // KAIZO Create l.27: `coltimer = -10;` — the Draw's spawn-tint clock.
    // It starts NEGATIVE, and clamp01 floors the ramp at 0, so the shard is
    // pure white for its first 10 drawn frames and only then begins turning
    // #86A2FF, reaching it 30 frames later. Frozen at the -999999 sentinel
    // the moment it starts aiming. Driven in endStep (the Draw slot).
    e.coltimer = -10;
    // Sim-side bookkeeping, not a GML field: the image_alpha this frame's
    // Draw READ. Draw l.32-38 blit at `image_alpha` and only THEN l.39-50
    // rewrite it for the fade — while the kaizo renderer (kaizo/render/draw/
    // pointing.js) paints after endStep, the Draw slot, and would otherwise
    // see the rewritten value, one frame further into the fade than the game
    // showed. Recorded at the top of endStep; Create's own image_alpha stands
    // for the frame before the first Draw. Nothing in the sim reads it.
    e.drawn_image_alpha = e.image_alpha ?? 1;
  },

  step(e, state) {
    if (!e.init) {
      e.init = true;
      if (e.difficulty >= 2) {
        // KAIZO Step l.1-29 — two changes inside the vanilla init:
        //
        //     delay = 25;
        //     with (obj_dbulletcontroller) {
        //         if (type == 98) {            // KAIZO l.9: mode-tag gate
        //             other.delay += delay;
        //             ...subdelay walk...
        //         }
        //     }
        //     if (difficulty == 3.2 || difficulty == 3.3) {   // KAIZO l.24-27
        //         delay = 0;
        //     }
        //
        // The controller's `type` is renamed `ctype` in the kaizo entity
        // (engine-field collision — see stars-controller.js). When a live
        // type-98 controller exists the chain walk runs (chainChildDelay is
        // the sim's UNCHANGED translation of the with-block body, controller
        // fields modelled as state.childDelay/childSubdelay); when none does,
        // the child keeps the bare 25 and the chain state is untouched —
        // vanilla mutated the controller on EVERY starchild spawn.
        const dc98 = state.entities.some(
          (x) => x.alive && x.type.name === 'obj_dbulletcontroller' && x.ctype === 98,
        );
        if (dc98) {
          chainChildDelay(e, state);
        } else {
          e.delay = 25;
        }
        // KAIZO l.24-27: 3.2 / 3.3 children launch with NO delay — and the
        // con==0 wait below only arms via `if (delay > 0)`, so a delay-0
        // child NEVER tracks: it flies straight along its blast_dir at the
        // parent's 4.5/1.5, decelerating toward minspeed. Do not "optimize"
        // this into an instant launch — the `delay > 0` interaction is the
        // load-bearing subtlety (delta spec, translation notes).
        if (gmlEq(e.difficulty, 3.2) || gmlEq(e.difficulty, 3.3)) {
          e.delay = 0;
        }
        // The sim's --shards replay override (matched by frame + position)
        // stays last, as the recording's word over the model — no kaizo
        // recording feeds it yet, so it is inert here.
        const rows = state.shardDelays?.get(state.frame);
        const match = rows?.find((r) => !r.used
          && Math.abs(r.x - e.x) <= 0.1 && Math.abs(r.y - e.y) <= 0.1);
        if (match) {
          match.used = true;
          e.delay = match.delay;
        }
      }
      if (globalThis.process?.env?.KNIGHT_SHARD_DEBUG) {
        console.error(`[shard] init f=${globalThis.__simFrame} seq=${e.seq}`
          + ` diff=${e.difficulty} delay=${e.delay} y=${e.y.toFixed(1)}`);
      }
    }

    // `event_inherited()` — the FIRST line after the init in the original.
    // The parent (obj_regularbullet) runs the wall_destroy cull: any shard
    // past view -80 / +760 / -80 / +580 is destroyed.
    if (globalThis.process?.env?.KNIGHT_SHARD_DEBUG
        && (e.x < state.view.x - 70 || e.y < state.view.y - 70)) {
      console.error(`[shard] edge f=${globalThis.__simFrame} seq=${e.seq}`
        + ` x=${e.x.toFixed(1)} y=${e.y.toFixed(1)} wd=${e.wall_destroy}`
        + ` view=${state.view?.x},${state.view?.y}`);
    }
    regularbulletStep(e, state);
    if (!e.alive) return;

    // `if (!i_ex(obj_knight_roaring2))` WRAPS THE ENTIRE REST OF THE STEP —
    // while the roar lives, a starchild is an inert ballistic bullet.
    // (Unchanged in kaizo.)
    if (state.entities.some((x) => x.alive && x.type.name === 'obj_knight_roaring2')) {
      return;
    }

    const follower = state.entities.find(
      (x) => x.alive && x.type.name === 'obj_heart_follower',
    );

    // `con <= 2 && con <= 3` in the original — the second test is redundant.
    if (e.con <= 2) {
      if (e.speed > e.minspeed) {
        e.speed = scrMovetowards(e.speed, e.minspeed, e.deceleration);
      }
      if (e.con === 0 && e.delay > 0) {
        e.timer += 1;
        if (e.timer >= e.delay) {
          if (globalThis.process?.env?.KNIGHT_SHARD_DEBUG) {
            console.error(`[shard] check f=${globalThis.__simFrame} seq=${e.seq}`
              + ` delay=${e.delay} y=${e.y.toFixed(1)} on=${onscreen(e, 10, state)}`);
          }
          // A child that has drifted off screen by the time its turn comes
          // never gets to home.
          if (!onscreen(e, 10, state)) {
            destroy(e);
            return;
          }
          e.timer = 0;
          e.con = 1;
        }
      }
    }

    if (e.con >= 1 && e.con <= 3) {
      if (follower) {
        e.target_angle = pointDirection(e.x, e.y, follower.x + 10, follower.y + 10);
      }
      if (e.con >= 2 && e.tracking) {
        const difference = angleDifference(e.target_angle, e.direction);
        if (Math.abs(difference) < 90) {
          if (e.con < 3) {
            e.direction = scrRotatetowards(e.direction, e.target_angle, 2);
            e.image_angle = e.direction;
          } else if (Math.abs(difference) <= 4) {
            e.rotation = 0;
          } else if (Math.abs(difference) > 30) {
            e.rotation = sign(difference) * 2;
          } else {
            e.rotation = sign(difference);
          }
        } else if (e.con >= 3) {
          // Once the soul is behind it, it gives up and keeps turning the way
          // it was already turning.
          e.tracking = false;
          e.rotation = sign(e.rotation);
        }
      } else {
        e.direction += e.rotation;
        e.image_angle += e.rotation;
      }
    }

    if (e.con === 1) {
      e.image_angle = scrAngleLerp(e.direction, e.target_angle, e.timer / 10);
      e.timer += 1;
      if (e.timer >= 10) {
        e.timer = 0;
        e.con = 2;
        e.direction = e.image_angle;
        e.tracking = true;
      }
      if (e.xscale_start === 0) e.xscale_start = e.image_xscale;
      if (e.yscale_start === 0) e.yscale_start = e.image_yscale;
      const flip = Math.cos((e.timer / 5) * Math.PI);
      e.image_yscale = e.yscale_start * flip;
      // THE FLIP'S COLOUR, on the same cosine as the squash. Visual only, but
      // it belongs in the Step because that is where the original computes it.
      e.image_blend = mergeColor(WHITE, BLACK, flip);
      // KAIZO Step l.115: `outline = merge_color(c_white, get_swordcolor(),
      // cos((timer / 5) * pi))` — vanilla was merge_color(c_black, c_red, ...).
      // BOTH endpoints move: the overlay now starts WHITE rather than black,
      // so it is visible through the whole flip instead of only at the ends,
      // and it lands on the swordtype blue. Pure lookup, zero draws.
      e.outline = mergeColor(WHITE, getSwordcolor(state), flip);
    }

    if (e.con === 2) {
      e.timer += 1;
      if (e.timer >= 10) {
        e.timer = 0;
        e.con = 3;
      }
    }

    // A backward drift that decays over 40 frames — the child slides away from
    // its target as it winds up, which is what makes the lunge read.
    if (e.con >= 1 && e.ease < 40) {
      const s = (1 - e.ease / 40) * 2;
      e.x -= lengthdirX(s, e.target_angle);
      e.y -= lengthdirY(s, e.target_angle);
      e.ease += 1;
    }

    if (e.con === 3) {
      // KAIZO Step l.140 (VISUAL, untranslated like the sim's vanilla copy):
      // the con-3 dash afterimage's image_blend is get_swordcolor() instead
      // of c_red — the sim never modelled obj_afterimage_blend here at all.
      e.speed = scrMovetowards(e.speed, 25, 0.5);
      e.image_xscale = e.xscale_start + e.speed / 60;
      e.image_yscale = e.yscale_start - e.speed / 90;
    }

    if (e.con === 4) {
      e.speed = 0;
      e.timer += 1;
      if (e.timer >= 4) destroy(e);
    }
  },

  /**
   * THE DRAW EVENT'S TAIL, which is not decoration — it is how shards die by
   * lifetime. KAIZO Draw_0 l.48 WIDENS THE GATE:
   *
   *     if (difficulty <= 2 || (difficulty == 3.3 && !kaizo_sideb())) {
   *         image_alpha = clamp01(remap(lifetime - 15, lifetime, 1, 0, drawtimer));
   *         if (image_alpha < 1) active = false;
   *         if (image_alpha == 0) instance_destroy();
   *     }
   *
   * Vanilla was `difficulty < 2`. Newly covered: difficulty EXACTLY 2 — the
   * vanilla homers never faded and persisted until offscreen; kaizo's expire
   * by lifetime like everyone else — and 3.3 off the B-Side (its straight
   * shots die at lifetime 60, its decoys at 30). Still excluded, persisting
   * until offscreen: 3, 3.1, 3.2, and 3.3 ON the B-Side. The parent-stamped
   * -1 trail children fall into `<= 2` exactly as they fell into `< 2`.
   *
   * `lifetime` is 60 (30 for decoys/trails): the shard fades over its last
   * 15 draws, stops dealing damage the moment the fade starts, and removes
   * itself at the end. Runs in endStep because that is the phase that sits
   * where Draw does: after the Step, before the next frame.
   *
   * ORDER NOTE: `drawtimer++` sits AFTER the con==4 `exit` in the GML, so a
   * detonating shard's drawtimer freezes. This body now follows that order
   * (it used to increment before the early-out). Nothing downstream changes
   * — the fade block is unreachable at con 4 and the renderer's glow
   * ping-pong is skipped there too — but the field now reads true.
   */
  endStep(e, state) {
    // What the Draw READ (see Create): image_alpha before the fade block —
    // Draw l.32-38 draw with it, l.39-50 rewrite it. Recorded first, ahead of
    // every write in this slot. The con-4 explosion (l.5-10) draws at alpha 1
    // and never reads it.
    e.drawn_image_alpha = e.image_alpha;

    // KAIZO Draw l.1-4: the tint clock ticks FIRST, ahead of the con==4
    // early-out below — a detonating shard still advances it, it just stops
    // being repainted.
    if (e.coltimer !== -999999) e.coltimer += 1;

    // KAIZO Draw l.5-10: con 4 draws spr_thrash_missile_explosion and
    // `exit`s. Nothing after this line runs — not the blend, not drawtimer,
    // not the fade. (The explosion's own c_blue argument is a draw local;
    // see the header.)
    if (e.con === 4) return;

    // KAIZO Draw l.12-15: the spawn tint. `image_blend` is instance state,
    // so this is the shard's colour for every reader — the renderer's frame-0
    // blit included. clamp01 holds it at white while coltimer is negative.
    if (e.coltimer !== -999999) {
      e.image_blend = mergeColor(WHITE, KAIZO_TELEGRAPH_COLOR, clamp01(e.coltimer / 30));
    }

    e.drawtimer += 1;

    // KAIZO Draw l.19-31. The `con > 1` arm only recolours `_glowcol` (a draw
    // local — see the header), so the single instance-state write is the
    // con==1 else: freeze the clock, then run image_blend the OTHER way,
    // #86A2FF -> c_black over timer/10. It lands after the Step's own
    // `merge_color(c_white, c_black, flip)` on the same frame, exactly as
    // GameMaker orders Step then Draw, so the aiming shard darkens from blue.
    // The GML nests this as `if (con >= 1) { if (con > 1) {...} else {...} }`;
    // con is an integer and con 4 has already returned, so the else is exactly
    // con == 1. The `con > 1` arm is not dropped — it writes only the draw
    // local `_glowcol` (kaizo 16711680 = c_blue, vanilla 255 = c_red), which
    // has no instance state to carry.
    if (e.con === 1) {
      e.coltimer = -999999;
      e.image_blend = mergeColor(KAIZO_TELEGRAPH_COLOR, BLACK, e.timer / 10);
    }

    const kaizoSideb = !!(state.kaizo && state.kaizo.sideb);
    const fades = e.difficulty <= 2 || (gmlEq(e.difficulty, 3.3) && !kaizoSideb);
    if (!fades) return;
    const fadeStart = e.lifetime - 15;
    e.image_alpha = clamp((e.lifetime - e.drawtimer) / (e.lifetime - fadeStart), 0, 1);
    if (e.image_alpha < 1) e.active = false;
    if (e.image_alpha === 0) destroy(e);
  },

  /**
   * `scr_precise_hit(_hitbox)`, and the SIZE depends on which attack is
   * running — see the sim module. (Kaizo Other_15 keeps both hitbox
   * ternaries verbatim.)
   */
  collides(e, heart, state) {
    if (e.active !== 1 && e.active !== true) return false;
    const roaring = state.entities.some(
      (x) => x.alive && x.type.name === 'obj_knight_roaring2',
    );
    const n = roaring ? 2 : 5;
    const mask =
      e.sprite_index === 'spr_knight_starchild_trail'
        ? STARCHILD_TRAIL_MASK
        : STARCHILD_MASK;
    // Engine pair test first, then the Other_15 probe — see enginePairHit.
    if (!enginePairHit(heart, e, mask)) return false;
    return scrPreciseHit(heart, e, mask, n);
  },

  /**
   * Other_15 — TWO arms on `i_ex(obj_knight_roaring2)` (kaizo l.1-33 and
   * 34-68), both kept from vanilla but for the aoedamage with-wrappers.
   * OUTSIDE the roar it is the parent's 75 party-wide (starOther15, which
   * models the wrappers via scrDamageAll({aoe: true})). IN THE ROAR the hit
   * is the knight's catch:
   *
   *     if (active == 1) {
   *         var _hitbox = (obj_heart.sprite_index == spr_dodgeheart_smaller_2px) ? 0 : 2;
   *         if (!scr_precise_hit(_hitbox)) exit;          // collides() above
   *         if (i_ex(obj_knight_roaring2)) with (obj_knight_enemy) event_user(2);
   *         if (destroyonhit == 1) instance_destroy();
   *     }
   *
   * No `target = 3; damage = 75` in this arm — those are the non-roar arm's
   * first two lines. REACHABLE: the finale's cut hands every curtain star
   * con 101, whose six-way fan (speed 5, and no deceleration while the roar
   * lives — Step_0:31 above) flies through a soul the curtains pinned to the
   * top edge. Until 2026-09-08 this was `other15: starOther15` with no roar
   * branch: 75 to everyone, two and a half catches per touch, and the HUD
   * never raised.
   */
  other15(e, state) {
    const roaring = state.entities.some(
      (x) => x.alive && x.type.name === 'obj_knight_roaring2',
    );
    if (!roaring) return starOther15(e, state);
    if (e.active !== 1 && e.active !== true) return;
    kaizoKnightCatch(state);
    // `destroy` takes THE ENTITY — see the sim module's note.
    if (e.destroyonhit === 1) destroy(e);
  },
};
