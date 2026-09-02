// KAIZO obj_knight_split_growtangle — the box-splitter organism, mod build.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission.
//
// Provenance: kaizo-mod/gml_kaizo_dump/CodeEntries/
//   gml_Object_obj_knight_split_growtangle_Step_0.gml
// Baseline copied from sim/attacks/split-growtangle.js (oracle-verified,
// t6-splitter row-exact); byte-identical except the cited KAIZO hunks.
//
// What diverges from the sim module (all in Step):
//   - init: d5 rows (max_distance 172, split_hold 50, bullet_count 14), the
//     damage table (206 base / 155 d2 / 135 d5 when NOT Side-B), and the
//     trailing unconditional `split_wait = 5` that overrides vanilla d2's 4
//     (kaizo 8-27).
//   - self-start: `if (con == 0) con = 1;` before timer++ (kaizo 29-32), and
//     a finished cycle parks at `con = -1` instead of 0 (kaizo 311).
//   - disable_on_close now fades the disabled teeth out over 12 frames via
//     scr_lerpvar on image_alpha (kaizo 54).
//   - the bullet spawn is wrapped in a wave loop: normal difficulties are one
//     wave with hotter teeth (friction -0.3/-0.15, top 5/2.85 +-0.12; Side-B
//     start moving at 0.5 with slow-tier top 3.35); difficulty 5 runs TWO
//     waves of 14 with a Y ladder over the box height and a 10/7.5/5/2.5
//     speed ladder driven by scr_lerpvar (speed over 5f, friction to -0.36
//     over 57f) (kaizo 124-245).
//
// COLOUR — audited against the dump, and the answer is "nothing to change".
// The mod's blue re-theme does NOT reach this organism, and that is ground
// truth, not an omission: diffing every obj_knight_split_growtangle event
// against gml_vanilla_v105 turns up no colour hunk at all, and the two
// colour sources it does have are both unchanged —
//   * Create l.1 `image_blend = obj_growtangle.image_blend` — the box's
//     merge_color(c_green, c_lime, 0.5) GREEN, in kaizo exactly as in
//     vanilla (obj_growtangle_Create_0 diffs clean); carried below, and
//     passed on to obj_knight_split_growtangle_effect the same way the GML
//     does (that object's Create l.2 reads the box directly).
//   * Create l.26/34 `marker[i].image_blend = c_gray` — obj_marker_splitflame
//     has NO kaizo delta in any event.
// So a live run really does show these three carrying zero blue frames. The
// blue in this attack is on the SLASH (flurry-splitslash.js, #86A2FF
// telegraph) and on the TEETH (flurry-split-bullet.js, the born-blue fade).
// Do not "finish the recolour" here without a GML site to cite.
//
// BASE ARTIFACT, deliberately NOT ported (per the delta spec): the kaizo dump
// is built on pre-v0.092 code that lacks the diagonal marker positioning and
// the marker xoffset/yoffset terms (kaizo 339-356). Those markers are visual
// only; this copy keeps the sim's v105 marker block.
//
// RNG per split (order is the stream): 1x choose(true,false), then per tooth:
// choose(-2,-1,1,2) when the weight ran out, random_range(-0.12, 0.12) ONLY
// on the one-wave path (d5 teeth take NO jitter draw), choose(1,2) when
// |weight| == 1. Difficulty 5 doubles the loop to 28 with the weight/flip
// state carrying across the wave boundary.
import { spawn, destroy } from '../../sim/entity.js';
import { splitGrowtangleEffect } from '../../sim/fx.js';
import { cue } from '../../sim/audio.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { kaizoSideb } from './flurry-damage.js';

// The unchanged flame-marker carrier comes straight from the verified module.
import { splitFlameMarker } from '../../sim/attacks/split-growtangle.js';
export { splitFlameMarker };
import { splitBullet } from './flurry-split-bullet.js';
import {
  scrEaseIn, scrEaseOut, scrMovetowards, inverselerp, sign,
  lengthdirX, lengthdirY, pointDirection, angleDifference, WHITE, GRAY,
} from '../../sim/gml.js';
import { gmlChoose, gmlRandomRange, gmlIrandomRange } from '../../sim/rng.js';

import { scrBulletInherit } from '../../sim/bullets/regularbullet.js';

/**
 * The organism's own depth — see sim/attacks/split-growtangle.js for why the
 * dump cannot supply it and 0 keeps the stated RELATIVE order.
 */
function baseDepth(e) {
  return e.depth ?? 0;
}

function box(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
}

/**
 * `gt_miny()` / `gt_maxy()` — NEW kaizo global scripts (gml_GlobalScript_
 * gt_miny.gml / gt_maxy.gml): `obj_growtangle.y -/+ sprite_height / 2`.
 * spr_battlebg_0 is 75px tall, so sprite_height = 75 * image_yscale.
 */
function gtMiny(state) {
  const gt = box(state);
  return gt ? gt.y - (75 * gt.image_yscale) / 2 : 0;
}
function gtMaxy(state) {
  const gt = box(state);
  return gt ? gt.y + (75 * gt.image_yscale) / 2 : 0;
}

/** Other_10 — event_user(0). */
/**
 * Other_11 -- THE ARENA COMES BACK. Run from CleanUp_0 (`event_user(1)`), which
 * the turn's end reaches through `with (obj_bulletparent) instance_destroy()`:
 *
 *     boxgone = true;
 *     if (obj_growtangle.customBox) exit;
 *     ...paint the seam line into source_surf...
 *     with (obj_growtangle) {
 *         visible = true; x = xstart; y = ystart; customBox = true;
 *         spr_custom_box = sprite_create_from_surface(other.source_surf, ...);
 *         growscale = 1;
 *     }
 *
 * MEASURED, _tok3 f1472: the recording's box reads x 320 on the turn's last
 * frame (parked at -9999 while the split was open, Step_0:359) where the sim's
 * stayed parked -- the step that un-parks it never runs on that frame. The
 * arena's sprite becomes the cut box's own image (a runtime sprite, not an
 * asset): `customBoxFromSplit` is that fact for the renderer.
 */
function eventUser1(e, state) {
  e.boxgone = true;
  const gt = box(state);
  if (!gt || gt.customBox) return;
  gt.visible = true;
  gt.x = gt.xstart;
  gt.y = gt.ystart;
  gt.customBox = true;
  gt.customBoxFromSplit = true;
  gt.growscale = 1;
}

function eventUser0(e) {
  e.timer = 0;
  e.con += 1;
}

export const splitGrowtangle = {
  name: 'obj_knight_split_growtangle',

  /**
   * CleanUp_0 -- `event_user(1)` (the arena restored, above), the two flame
   * markers destroyed, the surfaces freed. Runs from the turn-end sweep
   * (sim/scenes/fight.js clearTurn -> destroy(e, state)) as the game runs it.
   */
  cleanUp(e, state) {
    eventUser1(e, state);
    if (e.markers) for (const m of e.markers) if (m && m.alive) destroy(m, state);
  },

  // BEFORE THE SOUL — same measured ordering as the sim module (see its
  // header for the verify21j receipt).
  stepOrder: -0.5,

  create(e, state) {
    const gt = box(state);
    // See the note in sim/attacks/split-growtangle.js: the box carries only
    // the BUILT-IN scale pair, so `gt.xscale` was `undefined` here too and
    // reached the renderer as NaN. Fixed in both copies together — this file
    // is a kaizo-owned copy of that module and a fix in one that misses the
    // other is exactly how the two drift.
    e.image_xscale = gt ? gt.image_xscale : 2;
    e.image_yscale = gt ? gt.image_yscale : 2;
    // THE FLAMES IN THE GAP — unchanged from the sim module.
    e.markers = [0, 1].map((i) => {
      const m = spawn(state, splitFlameMarker, {
        x: e.x + (i === 0 ? 2 : 0),
        y: e.y + (i === 0 ? -1 : 2),
      });
      m.sprite_index = 'spr_rk_split_flame_big';
      m.image_speed = 0.5;
      m.image_xscale = 2;
      m.image_yscale = 2;
      m.image_angle = i === 0 ? 180 : 0;
      m.image_blend = GRAY;
      m.depth = baseDepth(e) + 10;
      return m;
    });

    e.image_blend = gt ? gt.image_blend : WHITE;
    e.con = 0;
    e.timer = 0;
    e.distance = 0;
    e.old_distance = 0;
    if (gt) gt.visible = false;
    e.heart_y = 0;
    e.heart_x = 0;
    e.split_dist = 50;
    e.slow = 4;
    e.fast = 8;
    e.child_bullet = [];
    e.count = 0;
    e.flame_index = 0;
    e.split = false;
    e.vertical = false;
    e.diagonal = false;
    e.launch_force = 0;
    e.open_time = 45;
    e.boxgone = false;
    e.max_distance = 70;
    e.split_delay = 0;
    e.vshift = 0;
    e.hshift = 0;
    e.xoffset = 0;
    e.yoffset = 0;
    e.angle = 0;
    e.h_change = 0;
    e.v_change = 0;
    e.update_box = false;
    e.difficulty = 0;
    e.split_wait = 5;
    e.split_hold = 30;
    e.init = false;
    e.bullet_count = 13;
    e.bullet_range = 144;
    e.disable_on_close = true;
  },

  /**
   * obj_knight_split_growtangle Draw_0 -- the stream draws of the cut box,
   * in the event's order (kaizo_oracle_drawprobe2: 8 of the game's 34 draws
   * per frame while the halves are apart):
   *
   *     var _xx  = (distance > 0) ? irandom_range(-1, 1) : 0;   // Draw_0:10-13
   *     var _yy  = ...; var _xx2 = ...; var _yy2 = ...;
   *     if (distance == 0) { ...; update_box = true; }           // Draw_0:26-30
   *     if (distance != 0 && update_box) {                       // Draw_0:31-85
   *         ...rebuild the half surfaces...
   *         var _change = choose(-2, -1, 1, 2);                  // Draw_0:63
   *         _deviation = _change - (vertical ? v_change : h_change); ...
   *         update_box = false; }
   *
   * The four jitters shake the two halves (drawJitter, read by the renderer);
   * the choose is ONE draw per rebuild, the frame the halves first part
   * (update_box is armed only while the box is whole). `visible` gates the
   * whole event.
   */
  draw(e, state) {
    if (e.visible === false) return;
    const rng = state.gmlRng;
    const irr = () => (rng ? gmlIrandomRange(rng, -1, 1) : 0);
    const open = e.distance > 0;
    const xx = open ? irr() : 0;
    const yy = open ? irr() : 0;
    const xx2 = open ? irr() : 0;
    const yy2 = open ? irr() : 0;
    e.drawJitter = { xx, yy, xx2, yy2 };
    if (e.distance === 0) e.update_box = true;
    if (e.distance !== 0 && e.update_box) {
      const change = rng ? gmlChoose(rng, [-2, -1, 1, 2]) : 1;
      if (e.vertical) {
        e.drawDeviation = change - e.v_change;
        e.v_change = change;
      } else {
        e.drawDeviation = change - e.h_change;
        e.h_change = change;
      }
      e.update_box = false;
    }
  },

  step(e, state) {
    if (!e.init) {
      if (e.difficulty === 2) {
        e.split_wait = 4;
        e.split_hold = 26;
      }
      // KAIZO (Step_0 8-13): the difficulty-5 organism — wider gap, longer
      // hold, one more tooth per row.
      if (e.difficulty === 5) {
        e.max_distance = 172;
        e.split_hold = 50;
        e.bullet_count = 14;
      }
      // KAIZO (Step_0 14-25): the damage table. Side-B keeps 206 everywhere;
      // normal mode nerfs d2 to 155 and d5 to 135. Vanilla set no damage here
      // at all (the inherit chain from the slash carried 206 down); this
      // assignment OVERRIDES the inherited value on the organism, and the
      // teeth inherit it from here.
      e.damage = 206;
      if (!kaizoSideb(state)) {
        if (e.difficulty === 2) e.damage = 155;
        if (e.difficulty === 5) e.damage = 135;
      }
      // KAIZO (Step_0 26): unconditional — overrides the vanilla d2
      // `split_wait = 4` that just ran above. Kaizo split_wait is 5 at init
      // at EVERY difficulty; only the end-of-cycle ramps move it after.
      e.split_wait = 5;
      e.init = true;
    }
    // KAIZO (Step_0 29-32): self-start. Create leaves con = 0; kaizo
    // instances auto-promote to 1 on their first step, and a finished cycle
    // parks at -1 (see the con-4 block) so this cannot re-fire it.
    if (e.con === 0) {
      e.con = 1;
    }
    e.timer += 1;
    e.old_distance = e.distance;

    if (e.con === 1) {
      // THE CUT EFFECT, on the first frame of EVERY split — unchanged from
      // vanilla (kaizo Step_0 35-47 diffs clean against the v105 entry).
      //
      // ONCE A SPLIT, NOT ONCE A TURN. This test used to carry an
      // `&& !e.effectSpawned` latch (with `e.effectSpawned = true` inside) that
      // has NO counterpart in the GML: kaizo Step_0 37-47 is a bare
      // `if (timer <= 1)` nested in `if (con == 1)`, and there is no flag
      // anywhere in the object. It was not a harmless guard either, because
      // obj_roaringknight_splitslash RE-ARMS the organism on every cut —
      // `obj_knight_split_growtangle.con = 1; obj_knight_split_growtangle.timer
      // = 0;` at kaizo splitslash Step_0 113-114 — so `timer <= 1` is already
      // exactly once per re-entry, and the effect destroys itself ten frames
      // later (splitGrowtangleEffect's endStep in sim/fx.js), so nothing could
      // ever stack. What it did instead was delete every cut flash after the
      // first one of the turn.
      //
      // MEASURED, and this family is where it showed:
      // kaizo_oracle_seq_deep.csv grouped by kaizo_playing logs one
      // obj_knight_split_growtangle_effect per splitslash — 8 / 10 / 8 for
      // atk_Splitter1 / atk_Splitter2 / atk_Splitter3 — against the latched
      // sim's 1. check-oracle-splitter asserts that count against the
      // recording. Do not reintroduce it.
      if (e.timer <= 1) {
        const fx = spawn(state, splitGrowtangleEffect, { x: e.x, y: e.y });
        fx.angle = e.angle;
        fx.diagonal = e.diagonal;
        fx.xoffset = e.xoffset;
        fx.yoffset = e.yoffset;
        fx.vertical = e.vertical;
        fx.image_xscale = e.image_xscale;
        fx.image_yscale = e.image_yscale;
        fx.image_blend = e.image_blend;
        fx.sprite_index = e.sprite_index;
        // kaizo Step_0 44 (v105 21, unchanged): `effect.depth = depth - 100;`
        // — the cut flash draws a hundred steps in FRONT of this organism,
        // i.e. over the teeth (`depth - 10`), the flames (`depth + 10`) and
        // the slash debris (obj_afterimage, -50). The sim's spawn left it at
        // the default (0, sorted among the organism itself) and the vanilla
        // twin still does; added 2026-09-01 for the kaizo Draw port
        // (kaizo/render/draw/split.js): the effect's Draw takes a
        // `surface_copy` of the frame AS IT STANDS at its own depth, and
        // that snapshot has to hold the teeth to cut the right picture in
        // two. `baseDepth` is the same 0-for-undefined guard the teeth use.
        // Depth is in no trace column; the byte gate does not move.
        fx.depth = baseDepth(e) - 100;
      }

      if (e.timer >= e.split_wait + e.split_delay) {
        if (e.disable_on_close) {
          for (const b of state.entities) {
            if (b.alive && b.type.name === 'obj_roaringknight_split_bullet') {
              // KAIZO (Step_0 54): the disabled teeth FADE over 12 frames
              // instead of popping — `scr_lerpvar("image_alpha", 1, 0, 12)`
              // runs inside the `with (split_bullet)` before `active = false`.
              scrLerpvar(state, spawn, b, 'image_alpha', 1, 0, 12);
              b.active = false;
            }
          }
          e.child_bullet = [];
          e.count = 0;
        }

        // THE BOX BREAKING — unchanged.
        cue(state, 'snd_knight_boxbreak', 1.1);

        eventUser0(e); // -> con 2, timer 0

        const heart = state.soul;
        // NO SOUL, NO TARGET — see the sim module.
        if (!heart) return;
        if (e.diagonal) {
          const hd = pointDirection(
            e.x + e.xoffset, e.y + e.yoffset, heart.x + 10, heart.y + 10,
          );
          const cutNormal = (e.angle ?? 0) + (e.vertical ? 45 : -45);
          if (Math.abs(angleDifference(cutNormal, hd)) < 90) {
            e.heart_x = 1;
            e.heart_y = e.vertical ? -1 : 1;
          } else {
            e.heart_x = -1;
            e.heart_y = e.vertical ? 1 : -1;
          }
        } else {
          e.heart_x = heart.x + 10 < e.x + e.xoffset ? -1 : 1;
          e.heart_y = heart.y + 10 < e.y + e.yoffset ? -1 : 1;
        }

        if (e.split_delay > 0) cue(state, 'snd_chargeshot_fire', 0.5);
        cue(state, 'snd_chargeshot_fire');

        e.split_delay = 0;

        const range = e.bullet_range;
        let total = e.bullet_count;
        let odd = false;
        if (e.bullet_count % 2 === 1) {
          odd = true;
          total += 1;
        }
        let flip = gmlChoose(state.gmlRng, [true, false]);
        const trueangle = e.vertical ? e.angle + 90 : e.angle;
        const xrange = lengthdirX(range, trueangle);
        let yrange = lengthdirY(range, trueangle);
        const xshift = xrange / (total / 2 - 1);
        let yshift = yrange / (total / 2 - 1);
        let xstart = e.x - xrange / 2;
        let ystart = e.y - yrange / 2;
        let weight = 0;
        let direction = 0;

        // KAIZO (Step_0 124-133): the wave preamble. Difficulty 5 runs two
        // waves with the vertical march skewed (+19.5 range, +3.25 shift) and
        // the Y ladder switched on.
        let waves = 1;
        let wave = 0;
        let Ytype = 0;
        if (e.difficulty === 5) {
          Ytype = 1;
          waves = 2;
          yrange += 19.5;
          yshift += 3.25;
        }
        // KAIZO (Step_0 134-245): `repeat (_waves)` around the vanilla loop.
        // weight and flip carry ACROSS the wave boundary — only the marching
        // start point and `count` reset per wave.
        for (let w = 0; w < waves; w++) {
          const bulletoffset = e.bullet_count * wave;
          xstart = e.x - xrange / 2;
          ystart = e.y - yrange / 2;
          e.count = bulletoffset;
          for (let i = 0; i < e.bullet_count; i++) {
            if (!e.diagonal && i === total / 2) {
              xstart = e.x - xrange / 2;
              ystart = e.y - yrange / 2;
              if (odd) {
                xstart += xshift / 2;
                ystart += yshift / 2;
              }
              weight = 0;
              flip = !flip;
            }
            if (weight === 0) {
              weight = gmlChoose(state.gmlRng, [-2, -1, 1, 2]);
            }
            const speedClass = inverselerp(-1, 1, sign(-weight));

            // KAIZO (Step_0 159-175): the third spawn path — difficulty 5's
            // teeth take their Y from a uniform ladder over the box height:
            // gt_miny() + 15 + (i % (count/2)) * ((gt_maxy()-gt_miny()-8) /
            // floor(count/2)). With count 14 that is two 7-rung ladders per
            // wave.
            let b;
            if (e.diagonal) {
              b = spawn(state, splitBullet, { x: e.x, y: e.y });
            } else if (Ytype === 0) {
              b = spawn(state, splitBullet, { x: xstart, y: ystart });
            } else {
              const height = gtMaxy(state) - gtMiny(state) - 8;
              const heightdif = height / Math.floor(e.bullet_count / 2);
              const bulY = i % (e.bullet_count / 2);
              const Yoff = bulY * heightdif;
              const bY = gtMiny(state) + 15 + Yoff;
              b = spawn(state, splitBullet, { x: xstart, y: bY });
            }

            // KAIZO (Step_0 176-214): the speed/friction assignment is fully
            // replaced. Kaizo order: cosmetic fields first, then the tier.
            b.image_speed = 0.5;
            b.depth = baseDepth(e) + 1;
            b.image_xscale = 2;
            b.image_yscale = 2;
            b.active = false;
            b.speed = 0;
            let tsp = [5, 2.85];
            if (kaizoSideb(state)) {
              // Side-B teeth start moving immediately and the slow tier tops
              // out higher (kaizo 183-187).
              b.speed = 0.5;
              tsp = [5, 3.35];
            }
            if (waves === 1) {
              // Hotter than vanilla (-0.2/-0.05, top 4/2 +-0.2): kaizo
              // 188-193.
              //
              // ORIGINAL BUG (preserved, and inherited from vanilla): the
              // friction is NEGATIVE. GameMaker applies friction to the speed
              // MAGNITUDE, so this ACCELERATES the tooth toward `top_speed`
              // rather than damping it. The mod kept the sign and only made the
              // numbers hotter, which is why the teeth read as launched. The
              // vanilla twin is oracle-verified row-exact with the same sign
              // (tools/verify-splitter.mjs); do not "correct" it in either copy.
              b.friction = speedClass === 1 ? -0.3 : -0.15;
              const topspeed = speedClass === 1 ? tsp[0] : tsp[1];
              b.top_speed = topspeed + gmlRandomRange(state.gmlRng, -0.12, 0.12);
            } else if (waves >= 2) {
              // KAIZO (Step_0 194-214): the d5 ladder — _spd = 10 -
              // (10/4)*_div with _div = (fast?0:1) + wave*2, so 10 / 7.5 / 5
              // / 2.5. No jitter draw. Speed lerps 0 -> _spd over 5 frames
              // and friction lerps 0 -> -0.36 over 57, both scr_lerpvar
              // tweens onto the BUILT-IN fields (f32 on store).
              let div = speedClass === 1 ? 0 : 1;
              const maxwave = waves * 2;
              div += wave * 2;
              const max = 10;
              const spd = max - (max / maxwave) * div;
              const topspeed = spd;
              b.friction = 0;
              b.top_speed = topspeed;
              b.depth = baseDepth(e) - 1;
              scrLerpvar(state, spawn, b, 'speed', 0, topspeed, 5);
              scrLerpvar(state, spawn, b, 'friction', 0, -0.36, 57);
              // Dead at current tunings (min _div = 3 -> 2.5), kept exactly.
              if (spd === 0) b.x = -9999;
            }

            if (e.diagonal) direction += 360 / e.bullet_count;
            else if (e.vertical) direction = flip ? 180 : 0;
            else direction = flip ? 90 : -90;

            b.direction = direction;
            b.image_angle = direction;
            scrBulletInherit(e, b);
            b.grazed = -1;
            e.child_bullet[e.count] = b;
            e.count += 1;

            if (Math.abs(weight) === 1) {
              weight = gmlChoose(state.gmlRng, [1, 2]) * sign(-weight);
            } else {
              weight = scrMovetowards(weight, 0, 1);
            }
            xstart += xshift;
            ystart += yshift;
          }
          // KAIZO (Step_0 244): `_wave++` closes the repeat.
          wave += 1;
        }
      }
    }

    const hold = e.diagonal ? e.split_hold + 2 : e.split_hold;

    if (e.con === 2) {
      e.split = true;
      if (e.timer === 7) {
        for (let i = 0; i < e.count; i++) {
          const b = e.child_bullet[i];
          if (b && b.alive) {
            b.depth = baseDepth(e) - 10;
            b.active = true;
            b.grazed = 0;
          }
        }
      }
      if (e.timer <= hold / 2) {
        e.distance = scrEaseOut(e.timer / (e.split_hold / 2), 3) * e.max_distance;
        const heart = state.soul;
        // NO SOUL, NO TARGET — see the sim module.
        if (!heart) return;
        if (e.diagonal) {
          heart.x += (e.distance - e.old_distance) * e.heart_x * 1;
          heart.y += (e.distance - e.old_distance) * e.heart_y * 1;
        } else if (e.vertical) {
          heart.x += (e.distance - e.old_distance) * e.heart_x * 1.25;
        } else {
          heart.y += (e.distance - e.old_distance) * e.heart_y * 1.25;
        }
      } else {
        eventUser0(e);
      }
    }

    if (e.con === 3) {
      e.distance = e.max_distance - scrEaseIn(e.timer / (e.split_hold / 2), 3) * e.max_distance;
      if (e.timer >= hold / 2) {
        if (e.vertical || e.diagonal) {
          e.vshift = gmlIrandomRange(state.gmlRng, -3, 3);
        } else {
          e.hshift = gmlIrandomRange(state.gmlRng, -3, 3);
        }
        if (e.diagonal) e.hshift = e.vshift;
        eventUser0(e);
      }
    }

    if (e.con === 4) {
      e.distance = scrMovetowards(e.distance, 0, 12);
      if (e.distance === 0) {
        // KAIZO (Step_0 311): a finished cycle parks INERT at -1 (vanilla:
        // 0). The next splitslash re-fires it by setting con = 1 directly;
        // combined with the self-start above, con 0 no longer means "idle".
        e.con = -1;
        e.split = false;
        if (e.difficulty === 3) {
          if (e.split_wait > 3) e.split_wait -= 1;
          if (e.split_hold > 26) e.split_hold -= 2;
        } else {
          if (e.split_wait > 5) e.split_wait -= 1;
          if (e.split_hold > 30) e.split_hold -= 2;
        }
        // The box SLAMMING SHUT — unchanged.
        cue(state, 'snd_locker');
      }
    }

    // THE FLAMES RIDE THE CUT FACES — kept from the VERIFIED v105 module.
    // BASE ARTIFACT NOT PORTED: the kaizo dump (pre-v0.092 base) lacks the
    // diagonal branch and the xoffset/yoffset terms here (kaizo Step_0
    // 339-356); per the delta spec these are reversed official fixes, not mod
    // intent, and the markers are visual-only.
    if (e.markers && e.markers.length === 2) {
      const [m0, m1] = e.markers;
      const d = Math.round(e.distance);
      if (e.diagonal) {
        m0.image_angle = e.vertical ? -45 : 225;
        m1.image_angle = e.vertical ? 135 : 45;
        const sq = Math.SQRT1_2 * d;
        m0.x = e.x - sq - 1 + e.xoffset;
        m1.x = e.x + sq + 3 + e.xoffset;
        m0.y = e.y - sq - 1 + e.yoffset;
        m1.y = e.y + sq + 3 + e.yoffset;
      } else if (e.vertical) {
        m0.image_angle = -90;
        m1.image_angle = 90;
        m0.x = e.x - d - 1 + e.xoffset;
        m1.x = e.x + d + 3 + e.xoffset;
        m0.y = e.y - 1 + e.yoffset;
        m1.y = e.y + 3 + e.yoffset;
      } else {
        m0.image_angle = 180;
        m1.image_angle = 0;
        m0.y = e.y - d - 1 + e.yoffset;
        m1.y = e.y + d + 3 + e.yoffset;
        m0.x = e.x - 1 + e.xoffset;
        m1.x = e.x + 3 + e.xoffset;
      }
    }

    // Park the main box offscreen while the split is open — unchanged.
    const gt = box(state);
    if (gt) {
      if (e.distance > 0) gt.x = -9999;
      else gt.x = gt.xstart;
    }
  },

  // Step_2 — End Step. Unchanged from the sim module.
  endStep(e, state) {
    e.flame_index = (e.flame_index ?? 0) + 0.5;

    const heart = state.soul;
    if (!heart) return;
    const gt = box(state);
    if (!heart || !gt) return;

    let dist = Math.round(e.distance);
    if (e.con === 0) dist = 0;

    let sw = e.vertical ? dist : 0;
    let sh = e.vertical ? 0 : dist;
    if (e.diagonal) {
      sw = Math.sqrt(0.5) * dist;
      sh = Math.sqrt(0.5) * dist;
    }

    const tlx = gt.xstart - 70 - sw;
    const tly = gt.ystart - 70 - sh;
    const brx = gt.xstart + 52 + sw;
    const bry = gt.ystart + 52 + sh;

    const distChange = Math.sqrt(0.5) * (dist - Math.round(e.old_distance));
    let startX = 0;
    let startY = 0;
    if (e.diagonal && distChange !== 0) {
      startX = heart.x;
      startY = heart.y;
    }

    if (heart.x < tlx) heart.x = tlx;
    if (heart.x > brx) heart.x = brx;
    if (heart.y < tly) heart.y = tly;
    if (heart.y > bry) heart.y = bry;

    if (e.diagonal && distChange !== 0) {
      const cx = Math.max(-Math.abs(distChange), Math.min(Math.abs(distChange), heart.x - startX));
      const cy = Math.max(-Math.abs(distChange), Math.min(Math.abs(distChange), heart.y - startY));
      if (cx !== 0) {
        if (!e.vertical) heart.y += cx;
        else heart.y -= cx;
      }
      if (cy !== 0) {
        if (!e.vertical) heart.x += cy;
        else heart.x -= cy;
      }
    }

    heart.x = Math.round(heart.x);
    heart.y = Math.round(heart.y);
  },
};
