// KAIZO obj_knight_pointing_star — the bullets of `Stars` as the mod rebuilds
// them: per-difficulty blast-direction tables (with a real choose() draw),
// the new difficulty family 3 / 3.1 / 3.2 / 3.3, split_blast decoys at 3.3,
// faster children (4.5 / 4.75), the min(_scale, 1) child-size clamp, the 3.3
// parked shrink, and the `stay` lingering-star logic (which lives in the
// original's DRAW event — endStep here).
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// PROVENANCE: copied from the VERIFIED sim/attacks/pointing-star.js and
// changed ONLY where the mod's GML diverges from vanilla v105. Ground truth:
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_knight_pointing_star_Create_0.gml (l.22-24 new fields)
//     gml_Object_obj_knight_pointing_star_Step_0.gml   (init l.6-35, shrink
//                                                       l.59-63, blast l.85-144)
//     gml_Object_obj_knight_pointing_star_Draw_0.gml   (stay block l.15-31)
//     gml_Object_obj_knight_pointing_star_Other_15.gml (behaviour-neutral)
//   delta specs: gml_Object_obj_knight_pointing_star_{Create_0,Step_0,
//     Draw_0,Other_15}.md
//
// DIVERGENCES from the sim module (each cited at its site):
//   * Create: `blast_arr = []` (dead — declare-and-forget), `blast_stars = 6`,
//     `stay = 0` (Create l.22-24). `starry` is NOT defaulted here — every
//     kaizo spawn path stamps it (the dbulletcontroller, l.2059).
//   * Step init: blast_dir/blast_stars/split_blast selection; AT MOST ONE
//     choose() draw, only when difficulty ∈ {3, 3.2, 3.3} or (3.1 && !sideb),
//     on the star's FIRST Step — the draw count is load-bearing.
//   * con==2, speed==0: 3.3 stars shrink 0.01/frame while parked (l.59-63).
//   * the con==3 burst walks blast_dir[i] for i < blast_stars, clamps the
//     child scale at 1, speeds 4.75 (3.1) / 4.5 (else; vanilla 4 — and
//     vanilla's difficulty-0 slow-odd-child rule is GONE), split_blast (3.3)
//     odd-i decoys at speed 1.5 / lifetime 30 and even-i +0.35 scale.
//   * endStep NEW: the Draw event's `stay == 1` block — growspeed eases to 0
//     (0.0005/frame), speed eases down to 2.2 (0.01/frame while above),
//     timer++. GAME LOGIC IN DRAW, translated to this engine's Draw slot.
//   * Other_15: kaizo removes the two `with (obj_knight_enemy) aoedamage`
//     wrappers because its scr_damage_all toggles aoedamage internally —
//     behaviour-neutral; the sim's scrDamageAll({aoe: true}) already models
//     the toggle, so the handler below is byte-identical to the sim's.
//   * endStep ALSO carries the mod's BLUE CHARGE TINT (Draw l.7 / l.16):
//     `_color = merge_color(c_gray, #86A2FF, clamp01(timer / 30))`, and the
//     lingering-star variant from c_white, both replacing vanilla's c_red.
//     The GML keeps `_color` as a Draw local; it is stored on image_blend
//     here because that is this engine's blend transport. No RNG.
//   * NOT TRANSLATED, VISUAL ONLY (renderer work later, none of it draws
//     RNG): easy sprite at difficulty 3.3 (the sim never applied the
//     existing d0 swap either — both sprites are 64x64, and mask/graze use
//     the pinned STAR_MASK); the per-blast_dir telegraph beams (Draw hunk 3 —
//     including 3.1's compounding-length thin beams and non-sideb 3.3's
//     HIDDEN odd-i decoy beams); the Draw's early-out gate on object index
//     545 (`&& stay == 0`), which gates rendering only — the stay block
//     translated here is the only instance-state write in the kaizo Draw.
// Fractional difficulties (3.1/3.2/3.3) are compared with gmlEq, never ===.
//
// Everything below not marked KAIZO is byte-identical to the sim module.
// ---------------------------------------------------------------------------
// (sim header, still true:)
// Lifecycle (con), driven from the Step:
//   0  drift and grow: image_x/yscale += growspeed (0.02) per frame
//   1  friction = 0.5, immediately con++   (set externally by the cone)
//   2  mask on. Once friction has braked speed to 0: gravity 0.1 pointing
//      BACKWARDS along the original direction (direction - 180), friction 0.
//      After 40 frames -> con 3.
//   3  scale up over 2 frames; at timer 3 burst into starchildren; at
//      timer >= 4 destroy self.
//
// KAIZO: a star the cone flags `stay = 1` instead of `con = 1` never leaves
// con 0 — it keeps drifting and growing (at a decaying growspeed) until the
// offscreen cull takes it.

import { spawn, destroy } from '../../sim/entity.js';
import { cue } from '../../sim/audio.js';
import { gmlChoose } from '../../sim/rng.js';
import { clamp01, gmlEq, scrApproach, mergeColor, GRAY, WHITE } from '../../sim/gml.js';
// The mod's palette, from the one shared source (kaizo/attacks/kaizo-colors.js).
import { KAIZO_TELEGRAPH_COLOR } from './kaizo-colors.js';
import { STAR_MASK, scrPreciseHit, enginePairHit } from '../../sim/masks.js';
import { scrChildbulletCopy } from '../../sim/childbullet.js';
import { scrBulletInit, collidebulletOther15 } from '../../sim/bullets/regularbullet.js';
import { scrDamageAll } from '../../sim/damage.js';
import { pointingStarchild } from './stars-pointing-starchild.js';

export const pointingStar = {
  name: 'obj_knight_pointing_star',

  create(e, state) {
    scrBulletInit(e);
    // MEASURED from the recording's sprite column (see the sim module).
    e.sprite_index = 'spr_knight_bullet_star';
    e.growspeed = 0.02;
    e.image_xscale = 0;
    e.image_yscale = 0;
    e.even = false;
    e.destroyonhit = false;
    e.timer = 0;
    e.con = 0;
    e.growstart = 0;
    e.playSound = true;
    e.damage = 1;
    e.grazepoints = 2;
    e.element = 5;
    e.difficulty = 0;
    e.grazetimer = 0;
    e.side = 0;
    e.init = false;
    e.rotation = 0;

    // The Create's `dir = choose(-1, 1)`. The value only feeds the Draw, but
    // the DRAW IS REAL and sits between the spawn and the controller's
    // size/special rolls — the oracle's ledger for the first star places it
    // at exactly that position. (Kaizo Create keeps it verbatim.)
    e.dir = state?.gmlRng ? gmlChoose(state.gmlRng, [-1, 1]) : 1;

    // KAIZO Create l.22-24, appended after `dir = choose(-1, 1)`:
    //     blast_arr = [];   // never read or written again in the kaizo dump —
    //                       // declare-and-forget, kept for state-shape parity
    //     blast_stars = 6;  // Create default; Step's init overwrites
    //     stay = 0;         // the lingering-star flag the cone's recall sets
    e.blast_arr = [];
    e.blast_stars = 6;
    e.stay = 0;

    e.isBullet = true;
    e.builtinMotion = true;
    e.speed = 0;
    e.direction = 0;
    e.image_angle = 0;
    // `mask_index = spr_knight_bullet_star_mask` — CREATE line 19. The star is
    // dangerous from the moment it is fired. (See the sim module's maskOff
    // history note.)
    e.maskOff = false;
    // The SMALL diamond, not the sprite's own spiked mask — pinned on the
    // entity so the graze test uses the override exactly as the game's
    // grazebox collides with the instance's current mask.
    e.mask = STAR_MASK;
    e.burst = 0; // starchildren that WOULD have spawned
  },

  step(e, state) {
    // Offscreen cull, from the top of the original Step:
    //
    //   x < camerax() - sprite_width / 2 ||
    //   y < cameray() - sprite_height / 2 ||
    //   y > cameray() + 480 + sprite_height / 2
    //
    // THE MARGIN IS NOT A CONSTANT — GameMaker's `sprite_width` is the
    // sprite's width TIMES `image_xscale` (see the sim module's history).
    // spr_knight_bullet_star / _easy are both 64x64.
    const halfW = (64 * Math.abs(e.image_xscale)) / 2;
    const halfH = (64 * Math.abs(e.image_yscale)) / 2;
    if (
      e.x < state.view.x - halfW ||
      e.y < state.view.y - halfH ||
      e.y > state.view.y + 480 + halfH
    ) {
      destroy(e);
      return;
    }

    // KAIZO Step init, l.6-35 (replaces vanilla's sprite-only init):
    //
    //     if (!init) {
    //         if (difficulty == 0 || difficulty == 3.3)
    //             sprite_index = spr_knight_bullet_star_easy;   // visual —
    //                             // untranslated, like the sim's d0 swap
    //         blast_dir = [90, 147, 213, 270, 327, 33];
    //         blast_stars = 6;
    //         split_blast = 0;
    //         if (difficulty == 3 || difficulty == 3.2) {
    //             blast_dir = choose([90, 213, 327], [147, 270, 33]);
    //             blast_stars = 3;
    //         }
    //         if (difficulty == 3.3) {
    //             blast_dir = choose([90, 147, 213, 270, 327, 33],
    //                                [147, 213, 270, 327, 33, 90]);
    //             blast_stars = 6;
    //             split_blast = 1;
    //         }
    //         if (!kaizo_sideb()) {
    //             if (difficulty == 3.1) {
    //                 blast_dir = choose([0, 72, 144, 216, 288],
    //                                    [36, 108, 180, 252, 324]);
    //                 blast_stars = 5;
    //             }
    //         }
    //         init = true;
    //     }
    //
    // AT MOST ONE choose() draw (the difficulty values are mutually
    // exclusive), on the star's FIRST Step, in spawn order — the draw count
    // and position are load-bearing on the shared stream. The default
    // 6-beam table replaces vanilla's incremental +48/+66 walk (which
    // produced 90,156,204,270,336,24 — NOT the same set). On B-Side, 3.1
    // keeps the 6-beam default and draws NOTHING here.
    //
    // THE SPRITE SWAP IS NOW CARRIED (the "visual — untranslated" note in
    // the block above is the earlier state of this file, kept as history).
    // KAIZO Step l.8-11 `if (difficulty == 0 || difficulty == 3.3)
    // sprite_index = spr_knight_bullet_star_easy;` is a Step-time write of
    // real instance state that the star's own Draw (l.5-6 sprite_get_width,
    // l.55-61 draw_sprite_ext(sprite_index, ...)) and the cone's
    // event_user(0) (Other_10) READ — the kaizo renderer
    // (kaizo/render/draw/pointing.js) draws whatever sprite_index the sim
    // carries, so leaving it on spr_knight_bullet_star put the wrong sheet
    // on every difficulty-0 / 3.3 star. Nothing in the sim reads
    // sprite_index for this object: the mask is the pinned STAR_MASK
    // (Create l.19 mask_index = spr_knight_bullet_star_mask, unchanged by
    // the swap), the cull uses the literal 64 (both sheets are 64x64), and
    // no check or trace compares it. No RNG, no stream change. Zero draws.
    if (!e.init) {
      const kaizoSideb = !!(state.kaizo && state.kaizo.sideb);
      // KAIZO Step l.8-11 (see the note above). `difficulty == 0` is an
      // integer compare; 3.3 is fractional and takes gmlEq like its siblings.
      if (e.difficulty === 0 || gmlEq(e.difficulty, 3.3)) {
        e.sprite_index = 'spr_knight_bullet_star_easy';
      }
      e.blast_dir = [90, 147, 213, 270, 327, 33];
      e.blast_stars = 6;
      e.split_blast = 0;
      if (e.difficulty === 3 || gmlEq(e.difficulty, 3.2)) {
        e.blast_dir = state?.gmlRng
          ? gmlChoose(state.gmlRng, [[90, 213, 327], [147, 270, 33]])
          : [90, 213, 327];
        e.blast_stars = 3;
      }
      if (gmlEq(e.difficulty, 3.3)) {
        e.blast_dir = state?.gmlRng
          ? gmlChoose(state.gmlRng, [
            [90, 147, 213, 270, 327, 33],
            [147, 213, 270, 327, 33, 90],
          ])
          : [90, 147, 213, 270, 327, 33];
        e.blast_stars = 6;
        e.split_blast = 1;
      }
      if (!kaizoSideb) {
        if (gmlEq(e.difficulty, 3.1)) {
          e.blast_dir = state?.gmlRng
            ? gmlChoose(state.gmlRng, [
              [0, 72, 144, 216, 288],
              [36, 108, 180, 252, 324],
            ])
            : [0, 72, 144, 216, 288];
          e.blast_stars = 5;
        }
      }
      e.init = true;
    }

    e.grazetimer += 1;
    if (e.grazetimer % 4 === 0) e.grazed = 0;

    if (e.con === 0) {
      e.image_xscale += e.growspeed;
      e.image_yscale += e.growspeed;
    } else if (e.con === 1) {
      e.friction = 0.5;
      e.con += 1;
    } else if (e.con === 2) {
      e.maskOff = false; // the Step re-assigns the same mask at con 2
      if (e.speed === 0) {
        // Friction has braked it to a stop; now it falls BACKWARDS along its
        // original heading and accelerates away.
        e.gravity = 0.1;
        e.gravity_direction = e.direction - 180;
        e.friction = 0;
        // KAIZO Step l.59-63: parked 3.3 stars shrink while waiting out the
        // 40-frame fuse (growspeed is 0.02, so 0.01/frame):
        //     if (difficulty == 3.3) {
        //         image_xscale -= (growspeed / 2);
        //         image_yscale -= (growspeed / 2);
        //     }
        if (gmlEq(e.difficulty, 3.3)) {
          e.image_xscale -= e.growspeed / 2;
          e.image_yscale -= e.growspeed / 2;
        }
      }
      e.timer += 1;
      if (e.timer >= 40) {
        e.timer = 0;
        e.con += 1;
        // The star going off. `playSound` is false for the ones the controller
        // bursts in bulk, so a wave does not fire fifteen copies at once.
        if (e.playSound) cue(state, 'snd_explosion_firework');
      }
      e.growstart = e.image_xscale;
    } else if (e.con === 3) {
      e.timer += 1;
      e.image_xscale = e.growstart + clamp01(e.timer / 2);
      e.image_yscale = e.growstart + clamp01(e.timer / 2);

      if (e.timer === 3) {
        // KAIZO Step l.85-144 — THE BLAST, rebuilt. Replaces vanilla's
        // `_angle = 90` + incremental +48/+66 walk (and its unused `_count`
        // ORIGINAL BUG, which is gone with it):
        //
        //     for (i = 0; i < blast_stars; i++) {
        //         d = scr_childbullet(x, y, obj_knight_pointing_starchild);
        //         d.image_angle = blast_dir[i];
        //         d.direction = blast_dir[i];
        //         var _scale = image_xscale * 0.5;
        //         _scale = min(_scale, 1);            // NEW: size clamp
        //         d.image_xscale = _scale;
        //         d.image_yscale = _scale;
        //         d.deceleration = 0.15;
        //         if (difficulty == 2 && (i % 3) > 0) { ...vanilla trail
        //             branch, verbatim... }
        //         else {
        //             d.difficulty = difficulty;
        //             if (difficulty == 3.1) d.speed = 4.75;
        //             else                   d.speed = 4.5;   // vanilla: 4,
        //                       // and vanilla's d0 slow-odd-child rule is GONE
        //             if (split_blast) {                       // 3.3 only
        //                 if ((i % 2) == 1) { d.speed = 1.5; d.lifetime = 30; }
        //                 else { _scale += 0.35;
        //                        d.image_xscale = _scale;
        //                        d.image_yscale = _scale; }
        //             }
        //         }
        //     }
        //     active = false;
        //
        // `_scale` is re-derived from image_xscale each iteration (var inside
        // the loop), so the += 0.35 never compounds. No RNG in the loop —
        // the shards' directions come straight off blast_dir.
        for (let i = 0; i < e.blast_stars; i++) {
          const d = spawn(state, pointingStarchild, { x: e.x, y: e.y });
          // The full scr_childbullet copy set — including `grazed` and
          // `grazetimer` (see sim/childbullet.js: a star bursting mid-graze
          // seeds shards that trickle, never fresh-graze). NOT copied:
          // difficulty, which is why it is assigned explicitly below.
          scrChildbulletCopy(d, e);
          d.image_angle = e.blast_dir[i];
          d.direction = e.blast_dir[i];
          let _scale = e.image_xscale * 0.5;
          _scale = Math.min(_scale, 1);
          d.image_xscale = _scale;
          d.image_yscale = _scale;
          d.deceleration = 0.15;

          if (e.difficulty === 2 && i % 3 > 0) {
            // Vanilla's difficulty-2 trail branch, kept verbatim by the mod:
            // four of six become inert trail shards.
            d.difficulty = -1;
            d.lifetime = 30;
            d.speed = 2;
            if (i === 1 || i === 4) {
              d.speed /= 3;
              d.minspeed /= 3;
              d.deceleration /= 3;
            } else {
              d.speed *= 2 / 3;
              d.minspeed *= 2 / 3;
              d.deceleration *= 2 / 3;
            }
            d.sprite_index = 'spr_knight_starchild_trail';
          } else {
            d.difficulty = e.difficulty;
            // KAIZO: 4.75 at 3.1, else 4.5 (vanilla 4).
            if (gmlEq(e.difficulty, 3.1)) d.speed = 4.75;
            else d.speed = 4.5;
            // KAIZO split_blast (3.3): odd-i slow decoys, even-i +0.35 scale.
            if (e.split_blast) {
              if (i % 2 === 1) {
                d.speed = 1.5;
                d.lifetime = 30;
              } else {
                _scale += 0.35;
                d.image_xscale = _scale;
                d.image_yscale = _scale;
              }
            }
          }
        }

        // Sim-side bookkeeping (not GML): the count actually spawned.
        e.burst = e.blast_stars;
        e.active = false;
      }
      if (e.timer >= 4) {
        destroy(e);
      }
    }
  },

  /**
   * KAIZO Draw_0 l.15-31 — the `stay == 1` lingering-star block. GAME LOGIC
   * IN THE DRAW EVENT (delta spec: "the stay-star motion is gameplay, and it
   * lives in Draw"), so it runs in endStep, this engine's Draw slot — after
   * the Step and the collisions, exactly where GML's Draw sits:
   *
   *     if (stay == 1) {
   *         growspeed = scr_approach(growspeed, 0, 0.0005);
   *         if (speed > 2.2) speed = scr_approach(speed, 2.2, 0.01);
   *         timer++;
   *         _color = merge_color(c_white, #86A2FF, clamp01(timer / 30));
   *     }
   *
   * The tint is visual (not translated); growspeed/speed/timer are not: a
   * stay star keeps drifting at con 0, its growth tapering off and its speed
   * easing down toward 2.2, until the Step's offscreen cull removes it. The
   * Draw's early-out (`instance_exists(545 && con == 0) && stay == 0`) can
   * only skip stay==0 stars, which write nothing in the kaizo Draw — so the
   * gate is render-only and is not modelled.
   */
  endStep(e, state) {
    // KAIZO Draw l.7: the charge tint. Vanilla ramped c_gray -> c_red over
    // 30 frames; the mod ramps c_gray -> #86A2FF. In the GML this is the
    // LOCAL `_color`, passed to the star's own draw_sprite_ext calls — but
    // this engine's generic blit multiplies by `image_blend`, so the value
    // is carried there (the documented transport for a Draw-local tint; no
    // other reader of image_blend exists on this object). Zero draws.
    let color = mergeColor(GRAY, KAIZO_TELEGRAPH_COLOR, clamp01(e.timer / 30));

    if (e.stay === 1) {
      e.growspeed = scrApproach(e.growspeed, 0, 0.0005);
      if (e.speed > 2.2) e.speed = scrApproach(e.speed, 2.2, 0.01);
      e.timer += 1;
      // KAIZO Draw l.16: a lingering star recomputes _color from WHITE, and
      // AFTER the timer++ above — so its first drawn frame is already one
      // step along the ramp. Order preserved.
      color = mergeColor(WHITE, KAIZO_TELEGRAPH_COLOR, clamp01(e.timer / 30));
    }

    e.image_blend = color;
  },

  /**
   * `scr_precise_hit(3)` — a 3px probe at the soul's CENTRE against the star's
   * mask, not a mask-vs-mask overlap. (See the sim module's history.)
   */
  collides(e, heart) {
    // Engine pair test first, then the Other_15 probe — see enginePairHit.
    if (!enginePairHit(heart, e, STAR_MASK)) return false;
    return scrPreciseHit(heart, e, STAR_MASK, 3);
  },

  other15: starOther15,
};

/**
 * `obj_knight_pointing_star`'s Other_15 — and it is NOT the inherited one.
 *
 * KAIZO (behaviour-neutral refactor): the mod deletes vanilla's two
 * `with (obj_knight_enemy) { aoedamage = true/false }` wrappers because its
 * scr_damage_all toggles aoedamage internally around the per-character loop
 * (kaizo gml_GlobalScript_scr_damage_all.gml l.8-25). The sim's
 * scrDamageAll(state, dmg, { aoe: true }) already models exactly that
 * toggle, so this handler is byte-identical to the sim's. The `target != 3
 * -> scr_damage()` path (which in kaizo would run WITHOUT aoedamage) is dead
 * in both builds: `target` is hard-set to 3 one line earlier.
 *
 * The damage is 75, SET AT CONTACT; `target = 3` means the whole party;
 * aoedamage for the duration — see the sim module's three-point history.
 */
export function starOther15(e, state) {
  if (e.active !== 1 && e.active !== true) return;
  e.damage = 75;
  e.target = 3;
  scrDamageAll(state, e.damage, { aoe: true, element: 5 });
  // `destroy` takes THE ENTITY — see the sim module's note.
  if (e.destroyonhit === 1) destroy(e);
}
