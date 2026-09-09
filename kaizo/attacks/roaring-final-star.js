// KAIZO obj_knight_roaring_star — the roaring bullets under EnderCat8's
// Kaizo Roaring Knight v2.3.3 (controller type 107; used by BOTH the mod's
// normal roaring turn ac 9 and the choice-104 "Roaring DELTA" finale).
//
// *** V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// *** without permission. (kaizo/HANDOFF.md §5 V-C publish gate.)
//
// METHOD: this file is a COPY of the verified sim module
// sim/attacks/roaring-star.js with ONLY the mod's deltas applied. Every line
// the mod did not touch is byte-identical to the sim module; every divergence
// carries the kaizo GML file+line it translates.
//
// PROVENANCE (ground truth read for every branch below):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_knight_roaring_star_Create_0.gml  (spec = 0, line 18)
//     gml_Object_obj_knight_roaring_star_Step_0.gml    (spec hunk 1-4,
//                                                       con 101 block 120-163)
//     gml_Object_obj_knight_roaring_star_Other_11.gml  (tint recolor, line 28)
//   Delta specs: knight-research/kaizo-mod/deltas/ (same names, .md).
//   Diffed event-by-event against gml_vanilla_v105/: Other_10 and Other_15
//   are byte-identical, so those paths are unmodified sim copies.
//
// DIVERGENCES FROM sim/attacks/roaring-star.js, exhaustively:
//   1. create: `spec = 0` appended after `element = 5` (kaizo Create_0:18).
//   2. step: `if (spec == 1) outbound = false` at the very top, BEFORE the
//      offscreen check (kaizo Step_0:1-4) — a spec star can never be culled
//      offscreen; the finale controller spawns its spiral/curtain stars with
//      spec = 1 and re-derives their positions itself.
//   3. step: the NEW `con == 101` burst state appended after con 3 (kaizo
//      Step_0:120-163) — a fixed-direction 6-way starchild burst
//      ([90,147,213,270,327,33], speed 5, friction 0, FULL parent scale,
//      deceleration 0.04) fired 3 frames after release, star destroyed on
//      the 4th. The finale hands every surviving star `con = 101` at the cut.
//   4. children spawn as the KAIZO starchild (./stars-pointing-starchild.js)
//      — same export symbol; the mod's starchild deltas (aoedamage refactor,
//      coltimer) belong to that module.
//   5. other15 routes the catch through kaizoKnightCatch (bottom of this
//      file) instead of sim/knight.js's. THIS EVENT IS BYTE-IDENTICAL to
//      vanilla — what changed is obj_knight_enemy's Other_12, the event it
//      fires: 40 -> 30 damage (25 defending), the survival clamp rewritten
//      against the live damage, and `hp_visible = 1` on obj_knight_roaring2,
//      which is the ONLY writer of the finale's party-HP HUD flag.
//      (gml_Object_obj_knight_enemy_Other_12.gml — the enemy delta batch;
//      implemented here because this is its only reachable caller.)
//
// VISUAL delta NOT drawn (renderer work later), noted per the project law:
//   Other_11 line 28: the charging tint ramp merge_color(c_gray, c_red, ...)
//   becomes merge_color(c_white, #86A2FF, ...) — the mod-wide blue sword
//   retheme. Pure draw, no RNG consumed, no state.
//
// ────────────────────────────────────────────────────────────────────────
// The sim module's own header, still true of every copied line:
//
// obj_knight_roaring_star — the bullets of ROARING (ac 9, dc.type 107), the
// phase 4 finale.
//
// A SIBLING of obj_knight_pointing_star (the Stars attack), not a copy: same
// con skeleton — friction at con 1, gravity reversed along `direction - 180`
// at con 2, a six-child burst at con 3 — but `diff` on the two Steps is 153
// lines. What roaring adds:
//
//   split      a star can halve into a top and bottom piece that drift apart
//              (con 2.5, `splitease`), and the halves burst separately
//   outbound   it will NOT despawn until it has been on screen at least once.
//              These stars are FIRED FROM OFF SCREEN toward the knight, so
//              without this every one of them would die on its first frame.
//
// and what it drops: the growth phase and the graze timer.
//
// The offscreen bounds are scale-dependent, as in pointing-star.js —
// `sprite_width` is the sprite's width TIMES image_xscale, not a constant.
// That mistake cost a long-standing divergence in the Stars attack; it is not
// repeated here.
//
// NOT translated: Other_10 and Other_11, which are pure drawing (beams, the
// split halves, colour ramps) and carry no state — unlike the CONE's Draw,
// which turned out to drive its opening. Checked, not assumed.
//
// Other_15 IS modelled now. It was skipped when sim/masks.js had no
// `scr_precise_hit`; it has one, so these stars are dangerous again — they
// were flying straight through the soul.
//
//     if (active == 1) {
//         var _hitbox = (obj_heart.sprite_index == spr_dodgeheart_smaller_2px)
//                       ? 0 : 2;
//         if (!scr_precise_hit(_hitbox)) exit;
//         ... damage ...
//         if (destroyonhit == 1) instance_destroy();
//     }
//
// `destroyonhit` is 0 for every star the rings and the roar fire, so they pass
// THROUGH the soul rather than popping on contact — the damage repeats while
// they overlap, gated only by the soul's invulnerability.

import { spawn, destroy } from '../../sim/entity.js';
import { cue } from '../../sim/audio.js';
import { clamp01, scrEaseOut } from '../../sim/gml.js';
import { STAR_FULL_MASK, scrPreciseHit, enginePairHit } from '../../sim/masks.js';
import { scrBulletInit, collidebulletOther15 } from '../../sim/bullets/regularbullet.js';
// KAIZO: the vanilla `knightCatch` (sim/knight.js) is NOT used — the mod
// retunes obj_knight_enemy's Other_12, which is the event the star's Other_15
// fires. See kaizoKnightCatch at the bottom of this file.
//
// G5 (2026-09-08): the catch's `scr_damage()` is the MOD's script — kaizo
// gml_GlobalScript_scr_damage.gml — not the vendored vanilla one: B-Side
// gloom `_gloomdmg = ceil(damage / 6)`, floored at 10, and `damage > 120 ->
// ceil(damage * 0.8)` (5-17); `progamer = false`; `truedamage = 1` while
// obj_knight_roaring2 exists (84), so no target reroll. kaizo/party/damage.js
// is the faithful copy; this used to import sim/damage.js, so a B-Side catch
// banked no gloom at all.
import { scrDamage, ACTION_DEFEND } from '../party/damage.js';
// `global.char[ti] == 0 -> continue` — the roster's slot count, not 3.
import { rosterSize } from '../party/roster.js';
import { scrChildbulletCopy } from '../../sim/childbullet.js';
// KAIZO: the mod's starchild (same export symbol as the sim's) — the con-101
// burst children must carry the mod's starchild deltas, not the vanilla's.
import { pointingStarchild } from './stars-pointing-starchild.js';

export const roaringStar = {
  name: 'obj_knight_roaring_star',

  /**
   * THE STAR STEPS BEFORE THE CONTROLLER THAT PROMOTES IT.
   *
   * obj_knight_roaring2's Step releases one caught star per frame with
   * `con = 1`, and the star's own Step turns that into `friction = 0.5; con++`.
   * If the star runs after the controller it sees `con == 1` on the SAME frame
   * it was released, and the whole brake -> reverse -> burst arc finishes in 44
   * frames. The recording takes 45.
   *
   * That one frame is the entire f679+ divergence: from the first burst the
   * engine was a star short for the rest of the run, and stayed EXACTLY one
   * short, because the stars die one per frame and every one of them died a
   * frame early.
   *
   * This is the second sighting of the same ordering — obj_sword_vortex steps
   * before its manager too, reading the previous frame's `siner` (CLAUDE.md,
   * "Mid-phase spawns"). Two independent attacks now need the spawned object to
   * step first, which is a good deal more than one special case.
   */
  stepOrder: -1,

  create(e, state) {
    scrBulletInit(e);
    e.image_xscale = 0;
    e.image_yscale = 0;
    e.even = false;
    e.destroyonhit = false;
    e.timer = 0;
    e.con = 0;
    e.growstart = 0;
    e.playSound = true;
    e.beamflicker = 0;
    e.split = 0;
    e.outbound = false;
    e.splitmax = 14;
    e.splitease = 0;
    e.finalx = 0;
    e.damage = 206;
    e.element = 5;
    // KAIZO — Create_0 line 18: `spec = 0;` appended after `element = 5`.
    // Default off; only the finale controller (kaizo roaring2 Other_11) sets
    // spec = 1 on the stars it spawns.
    e.spec = 0;
    e.sprite_index = 'spr_knight_bullet_star';
    e.isBullet = true;
    e.builtinMotion = true;
  },

  /**
   * `scr_precise_hit(2)` — a 2px probe at the soul's centre against the star's
   * mask. The 0 variant is for the shrunken soul sprite, which this project
   * does not use.
   *
   * THE MASK IS THE SPRITE'S OWN — the full 2040px spiked star. Unlike the
   * Stars attack's pointing star, this object sets NO mask_index, so both the
   * engine pair test and the probe run against `spr_knight_bullet_star`
   * itself. It ran against the small diamond (42% of the ink) for a while,
   * which made the rings pass visibly through the soul without registering —
   * reported from play, and the report was right.
   */
  collides(e, heart, state) {
    if (state && state.replayContacts) return false;
    if (e.active !== 1 && e.active !== true) return false;
    // Engine pair test first, then the Other_15 probe — see enginePairHit.
    if (!enginePairHit(heart, e, STAR_FULL_MASK)) return false;
    return scrPreciseHit(heart, e, STAR_FULL_MASK, 2);
  },

  /**
   * `obj_knight_roaring_star`'s Other_15 — a CATCH, not a hit.
   *
   *     if (i_ex(obj_knight_roaring2)) with (obj_knight_enemy) event_user(2);
   *     else { target != 3 ? scr_damage() : scr_damage_all(); }
   *
   * Roaring stars only exist while Roaring is on screen, so the catch is the
   * live path and the damage branch is unreachable in practice. This had the
   * generic handler, which dealt the star's own 206 to one character and made
   * the finale the most lethal attack in the fight — when the real thing is
   * 40 to everyone and cannot fell anybody.
   *
   * KAIZO: this event is BYTE-IDENTICAL to vanilla (diffed), but the event it
   * fires — obj_knight_enemy's Other_12 — is RETUNED by the mod, so the catch
   * routes through kaizoKnightCatch below instead of sim/knight.js's.
   */
  other15(e, state) {
    if (e.active !== 1 && e.active !== true) return;
    if (state.roaringActive) kaizoKnightCatch(state);
    else collidebulletOther15(e, state);
    // destroy takes the entity — see the note in pointing-star's other15.
    if (e.destroyonhit === 1) destroy(e);
  },

  step(e, state) {
    // KAIZO — Step_0 lines 1-4, BEFORE the offscreen check:
    //
    //     if (spec == 1) { outbound = false; }
    //
    // Runs every step, so a spec star can never arm the offscreen destroy —
    // the `else { outbound = true }` below still fires while it is on screen,
    // and this line re-clears it before the next frame's bounds test. The
    // finale's spiral/curtain stars are spawned far outside the camera and
    // re-positioned by the controller each frame; without this they would be
    // culled the moment the corral maths swings them out of view.
    if (e.spec === 1) {
      e.outbound = false;
    }
    // Scale-dependent bounds; spr_knight_bullet_star is 64x64.
    const halfW = 64 * Math.abs(e.image_xscale);
    const halfH = 64 * Math.abs(e.image_yscale);
    const off =
      e.x < state.view.x - halfW ||
      e.x > state.view.x + 640 + halfW ||
      e.y < state.view.y - halfH ||
      e.y > state.view.y + 480 + halfH;

    if (off) {
      // Only once it has been seen. These are fired from off screen.
      if (e.outbound) {
        destroy(e);
        return;
      }
    } else {
      e.outbound = true;
    }

    if (e.con === 1) {
      e.friction = 0.5;
      e.con += 1;
    } else if (e.con === 2) {
      if (e.speed === 0 && e.gravity === 0) {
        // Braked to a stop; now it falls BACKWARDS along its original heading
        // and accelerates away.
        e.gravity = 0.1;
        e.gravity_direction = e.direction - 180;
        e.friction = 0;
      }
      e.timer += 1;
      if (e.timer >= 40 && !e.split) {
        e.timer = 0;
        e.con += 1;
        // The star going off. `playSound` is false for the ones the controller
        // bursts in bulk, so a wave does not fire fifteen copies at once.
        if (e.playSound) cue(state, 'snd_explosion_firework');
      }
      e.growstart = e.image_xscale;
    } else if (e.con === 2.5) {
      if (e.split === 1) {
        e.speed = 0;
        e.gravity = 0;
        e.sprite_index = 'spr_knight_bullet_star_top';
        e.timer = -10;
        e.split = 2;
      }
      e.timer += 1;
      e.splitease = scrEaseOut(clamp01(e.timer / 20), 4) * e.splitmax * e.image_xscale;
      if (e.timer === 20) {
        e.con = 3;
        e.timer = 0;
      }
    } else if (e.con === 3) {
      e.timer += 1;
      e.image_xscale = e.growstart + clamp01(e.timer / 2);
      e.image_yscale = e.growstart + clamp01(e.timer / 2);

      if (e.timer === 3) {
        let angle = 90;
        for (let i = 0; i < 6; i++) {
          let xx = e.x;
          let yy = e.y;
          if (e.split > 0) {
            // A split star throws its children from the two halves rather
            // than from its centre.
            if (i === 0 || i >= 4) {
              xx += (e.splitmax * e.image_xscale) / 2;
              yy += e.splitmax * e.image_xscale;
            } else {
              xx -= (e.splitmax * e.image_xscale) / 2;
              yy -= e.splitmax * e.image_xscale;
            }
          }
          // NOTE the original creates the child at (x, y), NOT at (_xx, _yy) —
          // it computes the split offsets and then does not use them.
          // ORIGINAL BUG, preserved.
          const d = spawn(state, pointingStarchild, { x: e.x, y: e.y });
          // scr_childbullet's copy set, grazed/grazetimer included — see
          // sim/childbullet.js.
          scrChildbulletCopy(d, e);
          d.image_angle = angle;
          d.direction = angle;
          d.speed = 1;
          d.friction = -0.1;
          d.image_xscale = e.image_xscale * 0.5;
          d.image_yscale = e.image_yscale * 0.5;
          d.deceleration = 0.15;
          angle += i === 1 || i === 4 ? 57 : 66;
        }
      }

      if (e.timer >= 4) {
        if (globalThis.process?.env?.KNIGHT_RSTAR_DEBUG) {
          console.error(`[rstar] burst f=${state.frame} seq=${e.seq}`
            + ` (${e.x.toFixed(2)},${e.y.toFixed(2)})`);
        }
        destroy(e);
      }
    }

    // KAIZO — Step_0 lines 120-163: the NEW `con == 101` burst, appended
    // after the vanilla con 3 block as its own plain `if` (NOT part of the
    // chain above — GML has two separate ifs; con never crosses between them
    // in one frame, but the shape is kept).
    //
    // The finale controller (kaizo roaring2 Other_11, knight_sprite_image
    // 3.5 cut frame) hands every surviving star `spec = 0; outbound = true;
    // con = 101`. Three star-steps later it bursts — a FIXED six-direction
    // fan, not the vanilla accumulating 57/66-degree walk — and dies on the
    // fourth.
    if (e.con === 101) {
      e.timer += 1;
      if (e.timer === 3) {
        // var _angle = 90; — assigned and immediately overwritten by the
        // array read each iteration. Kept as the array read.
        const dirarr = [90, 147, 213, 270, 327, 33];
        for (let i = 0; i < 6; i++) {
          const angle = dirarr[i];
          let xx = e.x;
          let yy = e.y;
          if (e.split > 0) {
            // Same dead computation as vanilla con 3: _xx/_yy are built and
            // then NOT passed to scr_childbullet. ORIGINAL BUG, preserved —
            // children always spawn at (x, y).
            if (i === 0 || i >= 4) {
              xx += (e.splitmax * e.image_xscale) / 2;
              yy += e.splitmax * e.image_xscale;
            } else {
              xx -= (e.splitmax * e.image_xscale) / 2;
              yy -= e.splitmax * e.image_xscale;
            }
          }
          const d = spawn(state, pointingStarchild, { x: e.x, y: e.y });
          scrChildbulletCopy(d, e);
          d.image_angle = angle;
          d.direction = angle;
          // vs the vanilla con-3 burst: speed 5 (was 1), friction 0 (was
          // -0.1), FULL parent scale (was x0.5), deceleration 0.04 (was
          // 0.15). Kaizo Step_0 lines 145-151.
          d.speed = 5;
          d.friction = 0;
          d.image_xscale = e.image_xscale;
          d.image_yscale = e.image_yscale;
          d.deceleration = 0.04;
        }
      }
      if (e.timer >= 4) {
        // The GML exit also bumps image_xscale/yscale by +16px-equivalent and
        // fires a scr_afterimage with fadeSpeed x3 before destroying — the
        // same pre-destroy visual the sim's con 3 block already skips
        // (afterimage churn, no RNG, nothing else reads the scale). Skipped
        // here identically; renderer work later.
        destroy(e);
      }
    }
  },
};

/**
 * KAIZO obj_knight_enemy Other_12 — THE STAR CATCH, RETUNED. The full file,
 * kaizo/gml_kaizo_dump/CodeEntries/gml_Object_obj_knight_enemy_Other_12.gml:
 *
 *     if (global.inv < 0) {
 *         with (obj_knight_roaring2) hp_visible = 1;
 *         var _dmg = 30;
 *         remdamage = damage;  _temptarget = target;
 *         for (ti = 0; ti < 3; ti++) {
 *             var _char = global.char[ti];
 *             if (_char == 0) continue;
 *             global.inv = -1;
 *             damage = _dmg;
 *             if (global.charaction[ti] == 10) damage = _dmg - 5;
 *             if (global.hp[_char] > 1 && global.hp[_char] <= damage)
 *                 damage = global.hp[_char] - 1;
 *             target = ti;
 *             if (global.hp[global.char[ti]] > 0 && global.char[ti] != 0)
 *                 scr_damage();
 *         }
 *         global.inv = global.invc * 30;
 *         target = _temptarget;
 *     }
 *
 * THREE CHANGES from the vanilla catch (sim/knight.js `knightCatch`), and
 * each one matters to the finale's balance:
 *
 *  1. **40 becomes 30**, and **DEFENDING drops it to 25** — vanilla has no
 *     defend term at all here. This is the mod being *kinder* per touch,
 *     which it can afford because the finale's spiral puts far more stars on
 *     the soul than the vanilla roar ever does.
 *  2. **The survival clamp is rewritten against the LIVE damage**:
 *     vanilla is `hp > 1 && hp < 41` with a fixed 40, kaizo is
 *     `hp > 1 && hp <= damage`. The vanilla form is only correct because 41
 *     happens to be 40+1; the kaizo form tracks the defend reduction, so a
 *     defending character on 27 HP is clamped to 26 where the vanilla shape
 *     would not have clamped at all.
 *     THE 1-HP HOLE SURVIVES BOTH: the guard is `hp > 1`, so someone already
 *     on exactly 1 takes the full 30 and dies. "Cannot fell anyone" is the
 *     obvious reading of the clamp and it is wrong at the one value where it
 *     matters most — preserved, not corrected.
 *  3. **`with (obj_knight_roaring2) hp_visible = 1`** — the first star that
 *     touches you is what REVEALS the party HP HUD (Other_22). The HUD is
 *     not on a timer; it is the mod telling you it is now worth watching.
 *
 * `global.inv = -1` before each call, so all three land on the same frame
 * rather than the first granting invulnerability against the other two.
 *
 * SCOPE NOTE: Other_12 belongs to the obj_knight_enemy delta batch, not to
 * this work item's file list. It is implemented here because it is the only
 * caller reachable from the roaring modules and because `hp_visible` — which
 * this module's controller reads every frame — has no other writer. If the
 * enemy batch later lands a central version, this becomes its call site.
 */
export function kaizoKnightCatch(state) {
  // THE WHOLE CATCH IS `if (global.inv < 0)` — a star that clips the soul
  // during invulnerability does nothing at all, exactly as vanilla.
  if (state.invTimer >= 0) return 0;

  // `with (obj_knight_roaring2) hp_visible = 1;`
  for (const r of state.entities) {
    if (r.alive && r.type.name === 'obj_knight_roaring2') r.hp_visible = 1;
  }

  const dmgBase = 30;
  let total = 0;
  const slots = rosterSize(state);
  for (let ti = 0; ti < 3; ti++) {
    // `var _char = global.char[ti]; if (_char == 0) continue;` — an empty
    // slot (the Weird Route's third) is skipped BEFORE `global.inv = -1`.
    if (ti >= slots) continue;
    const hp = state.partyHp[ti];
    let damage = dmgBase;
    if (state.charaction?.[ti] === ACTION_DEFEND) damage = dmgBase - 5;
    if (hp > 1 && hp <= damage) damage = hp - 1;
    state.invTimer = -1;
    // `if (global.hp[global.char[ti]] > 0 ...)` — the guard is AFTER the
    // clamp in the GML, so a downed member still runs the arithmetic and
    // simply takes no damage.
    if (hp > 0) total += scrDamage(state, damage, ti, { truedamage: true });
  }
  state.invTimer = state.invc * 30;
  return total;
}
