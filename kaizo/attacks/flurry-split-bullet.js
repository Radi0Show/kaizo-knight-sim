// KAIZO obj_roaringknight_split_bullet — the splitter's teeth, mod build.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission.
//
// Provenance: kaizo-mod/gml_kaizo_dump/CodeEntries/
//   gml_Object_obj_roaringknight_split_bullet_Create_0.gml / Step_0.gml
// Baseline copied from sim/attacks/split-bullet.js (oracle-verified vs
// traces/t6-splitter.csv); byte-identical except the two cited insertions.
//
// What diverges from the sim module:
//   - Create adds `coltimer = 0; fade_over = false;` (kaizo Create_0 16-17) —
//     support vars for the mod's tooth tint fade.
//   - Step adds `coltimer += 1;` (kaizo Step_0 12).
//   - Draw_0 6-23 (NEW) is what consumes them: every tooth is born BLUE and
//     cools to white — get_swordcolor() over 40 frames when a quickslash
//     attack owns the cut, #86A2FF over 30 otherwise, latched by `fade_over`.
//     image_blend and fade_over are instance state, so this is translated
//     (in endStep, the Draw slot); it consumes NO RNG.
//
// The kaizo d5 growtangle also drives `speed` and `friction` on these teeth
// through scr_lerpvar tweens, and the d2+ close fades them out via an
// image_alpha lerpvar — all of that lives in flurry-split-growtangle.js; this
// object's own code is untouched by it.

import { TOOTH_MASK, HEART_MASK, masksOverlap } from '../../sim/masks.js';
import {
  regularbulletCreate,
  regularbulletStep,
  collidebulletOther15,
} from '../../sim/bullets/regularbullet.js';
import { scrEaseIn, mergeColor, WHITE } from '../../sim/gml.js';
// The mod's palette, from the one shared source (kaizo/attacks/kaizo-colors.js)
// — never a private copy.
import { getSwordcolor, KAIZO_TELEGRAPH_COLOR } from './kaizo-colors.js';
import { gmlRandomRange } from '../../sim/rng.js';

export const splitBullet = {
  name: 'obj_roaringknight_split_bullet',

  create(e, state) {
    e.sprite_index = 'spr_roaringknight_tooth';
    regularbulletCreate(e, state); // event_inherited()
    e.element = 5;
    e.speed_mult = 0;
    e.top_speed = 0;
    e.image_xscale = 1;
    e.image_yscale = 1;
    e.active = false;

    // ORIGINAL BUG: Create sets `destroy_on_hit`, the damage gate reads
    // `destroyonhit` (= 1 from scr_bullet_init). Different variables, so this
    // line does nothing. Divergent by design. Do not "fix".
    e.destroy_on_hit = false;

    e.grazepoints = 0;

    // ORIGINAL BUG (dead feature): turn_timer / turn_dir / turn_start are
    // assigned here and read NOWHERE in the entire dump — the teeth have
    // turning logic that was never wired up. They fly straight. Kept for
    // fidelity of the variable set; do not implement turning.
    e.turn_timer = 0;
    e.turn_dir = 0;
    e.turn_start = false;

    e.grazed = 1;
    e.distance = 0;
    e.anim_timer = 0;
    // KAIZO (Create_0 16-17): the tint-fade support vars, inserted between
    // `anim_timer = 0` and `image_speed = 0` exactly as the mod does.
    e.coltimer = 0;
    e.fade_over = false;
    e.image_speed = 0;
  },

  /**
   * obj_roaringknight_split_bullet Draw_0:25 -- the warping the teeth have in
   * the real fight:
   *
   *     draw_sprite_ext(sprite_index, image_index, x, y,
   *         image_xscale + random_range(-0.1, 0.1),
   *         image_yscale + random_range(-0.1, 0.1), image_angle, image_blend, image_alpha);
   *
   * TWO STREAM DRAWS PER TOOTH PER FRAME. The vanilla recorder patches this
   * event to strip them (oracle_fullfight.csx, "visual draw-jitter excluded"),
   * so the vanilla sim must not consume; the KAIZO recorder leaves the mod's
   * Draw intact, and the draw probe over Splitter 1 (kaizo_oracle_drawprobe2)
   * counted them: 13 teeth x 2 = 26 of the 34 draws the game made every frame
   * from f1178. GML evaluates call arguments RIGHT-TO-LEFT, so the yscale
   * jitter is drawn before the xscale one. The renderer reads drawJitterXs /
   * drawJitterYs in place of its frame-seeded stand-in. An invisible instance
   * runs no Draw. The event's state work (image_index, anim_timer, the blend
   * fade) stays modelled in step/endStep above -- same values, one phase
   * early, nothing here reads them within the frame.
   */
  draw(e, state) {
    if (e.visible === false) return;
    const rng = state.gmlRng;
    e.drawJitterYs = rng ? gmlRandomRange(rng, -0.1, 0.1) : 0;
    e.drawJitterXs = rng ? gmlRandomRange(rng, -0.1, 0.1) : 0;
  },

  step(e, state) {
    regularbulletStep(e, state); // event_inherited()
    e.grazepoints = 3;

    // THE TOOTH WARPS AS IT LEAVES THE CUT — its Draw's first two lines:
    //
    //     image_index = floor(scr_ease_in(anim_timer, 2) * image_number);
    //     if (anim_timer < 1) anim_timer += 0.1;
    //
    // `image_number` is 2, and curve 2 is `power(t, 2)`, so the frame eases
    // from 0 to 1 over ten frames instead of cutting straight over — the
    // shape distorting as it forms. Neither the timer nor the index was
    // advanced here, so every tooth drew frame 0 for its whole life
    // (GitHub #5: the projectiles have no warping animation).
    //
    // ORDER MATTERS and is preserved: the index is computed from the CURRENT
    // timer, then the timer advances. The float error is load-bearing too —
    // ten additions of 0.1 land on 0.9999999999999999, so `floor(t * t * 2)`
    // ends on 1 rather than the wrap-to-0 an exact 1.0 would give.
    const frames = state.spriteFrames?.[e.sprite_index] ?? 2;
    e.image_index = Math.floor(scrEaseIn(e.anim_timer, 2) * frames);
    if (e.anim_timer < 1) e.anim_timer += 0.1;

    if (e.speed_mult < 1) {
      e.speed_mult += 0.2;
      if (!e.active && e.speed_mult >= 0.1) {
        e.active = true;
      }
      e.speed = e.speed_mult * e.top_speed;
    }

    // KAIZO (Step_0 12): the tint clock, after the ramp, before the scale
    // pins — exactly where the mod inserts it.
    e.coltimer += 1;

    e.image_xscale = 1;
    e.image_yscale = 1;
    // The original's two `if (image_xscale != 1)` branches follow here and
    // are unreachable — the assignments above just forced them to 1.

    e.distance += e.speed;
  },

  /**
   * THE TOOTH'S BLUE-TO-WHITE FADE — kaizo Draw_0 6-23, NEW in the mod and
   * the reason Create/Step carry `coltimer` and `fade_over` at all. A tooth
   * is born the mod's blue and cools to white as it flies:
   *
   *     if (fade_over == false) {
   *         if (i_ex(obj_roaringknight_quickslash_attack))
   *             image_blend = merge_color(get_swordcolor(), c_white, coltimer / 40);
   *         else
   *             image_blend = merge_color(#86A2FF, c_white, coltimer / 30);
   *     }
   *     if (image_blend == c_white) fade_over = true;
   *     if (fade_over == true)     image_blend = c_white;
   *
   * Two different blues and two different rates: teeth cut out by a
   * quickslash (rotating slash / combination) start from the swordtype
   * colour and take 40 frames; Flurry's own take the #86A2FF telegraph blue
   * and take 30. `fade_over` latches so a tooth can never un-fade.
   *
   * IN endStep, not step: the GML reads coltimer in Draw, AFTER Step_0 12
   * has already incremented it, so folding this in beside the anim lines
   * above would read it one frame early. (The anim lines stay where the
   * verified sim module put them — moving those is not this change.)
   *
   * NO RNG. The Draw's two `random_range(-0.1, 0.1)` scale jitters stay
   * stripped, exactly as the sim module documents.
   */
  endStep(e, state) {
    if (e.fade_over === false) {
      const quickslash = state.entities.some(
        (x) => x.alive && x.type.name === 'obj_roaringknight_quickslash_attack',
      );
      e.image_blend = quickslash
        ? mergeColor(getSwordcolor(state), WHITE, e.coltimer / 40)
        : mergeColor(KAIZO_TELEGRAPH_COLOR, WHITE, e.coltimer / 30);
    }
    // GML compares packed colour reals; this engine carries [r,g,b], so the
    // `== c_white` test is the same equality component-wise. mergeColor
    // rounds, so it lands EXACTLY on 255,255,255 at the end of the ramp.
    if (e.image_blend[0] === 255 && e.image_blend[1] === 255 && e.image_blend[2] === 255) {
      e.fade_over = true;
    }
    if (e.fade_over === true) e.image_blend = WHITE;
  },

  collides(e, heart) {
    return masksOverlap(
      heart.mask ?? HEART_MASK, heart.x, heart.y,
      TOOTH_MASK, e.x, e.y, e.image_xscale, e.image_yscale, e.image_angle,
    );
  },

  other15: collidebulletOther15,
};
