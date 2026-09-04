// KAIZO obj_roaringknight_boxsplitter_attack — Flurry's driver, mod build
// (dc.type 99, the mod schedules it at difficulties 2, 3 and 5).
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission.
//
// Provenance: kaizo-mod/gml_kaizo_dump/CodeEntries/
//   gml_Object_obj_roaringknight_boxsplitter_attack_Step_0.gml
//   gml_Object_obj_roaringknight_boxsplitter_attack_Create_0.gml (asset-index
//     noise only — knight 345 -> 344, growtangle 1517 -> 1516)
//   gml_Object_obj_roaringknight_boxsplitter_attack_Draw_0.gml
// Baseline copied from sim/attacks/boxsplitter-attack.js (verified against
// traces/flurry*.csv); only the cited KAIZO hunks diverge.
//
// What diverges from the sim module:
//   - init grows two tiers (kaizo Step_0 17-35): difficulty 3 pins
//     spawn_speed 39 (Side-B 37 — "and this is to go even further
//     beyond!!!!!!!!!!!!"); difficulty 5 is the new invisible-knight
//     vertical-only long turn: spawn_speed 53, timer 52 (first slash on the
//     very first step), local_turntimer 422, global.turntimer parked at 999,
//     and the knight sprite fades out over 20 frames via scr_lerpvar on
//     image_alpha.
//   - the per-fire vertical roll still ALWAYS draws, then difficulty 5
//     overrides the result to 1 — every cut vertical (kaizo Step_0 96-99).
//   - the teardown only releases the turn when the knight is opaque again:
//     `if (image_alpha >= 1) global.turntimer = 0; else image_alpha += 0.1;`
//     then instance_destroy() UNCONDITIONALLY (kaizo Step_0 75-83). For the
//     faded difficulty-5 knight that means the manager dies WITHOUT zeroing
//     the parked turntimer — the mod's own turn machinery ends that turn
//     (flagged in the task return's open[]; the mod script row for d5 also
//     sets its own turntimer).
//   - the Draw gate loosens from `image_alpha == 1` to `> 0` and the ghost
//     trail inherits the current opacity (`0.6 * image_alpha`) so the fading
//     knight still draws and sheds afterimages (kaizo Draw_0 hunks 1-2) —
//     modelled in the pose block's and endStep's gates below.
//
// COLOUR — audited: this object has NO colour delta of its own (every
// obj_roaringknight_boxsplitter_attack event diffs against gml_vanilla_v105
// with only the hunks above), and it never assigns image_blend anywhere. Its
// Draw's hell-surface telegraph is blue in the mod only because it MERGES
// FROM THE SLASH: `_backing = merge_color(c_black, image_blend, 0.5)` and the
// two flow tiles pass `image_blend` straight through (kaizo Draw_0 45/50-51),
// reading each pending obj_roaringknight_splitslash. That instance value is
// the mod's #86A2FF ramp, applied in flurry-splitslash.js — so this surface
// follows automatically the moment the renderer stops using its baked
// dark-red pixel (render/canvas.js drawHellSurface; renderer work, flagged).
//
// Unchanged and kept: the `_devcomm` dev-comment strings are dead locals; the
// dead `var _xx = vertical ? 0 : 33` (kaizo Step_0 100) is not carried, same
// as the sim's treatment of dead locals. `splitbox = -4` stays an ORIGINAL
// BUG. The d5 lerpvar consumes NO RNG.

import { scrAfterimage } from '../../sim/fx.js';
import { spawn, destroy } from '../../sim/entity.js';
import { scrApproach, scrMovetowards, lerp, sign } from '../../sim/gml.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { splitslash } from './flurry-splitslash.js';
import { gmlIrandom } from '../../sim/rng.js';
import { kaizoSideb } from './flurry-damage.js';

/**
 * obj_roaringknight_boxsplitter_attack's CLEANUP EVENT —
 * `gml_Object_obj_roaringknight_boxsplitter_attack_CleanUp_0.gml:5-9`,
 * byte-identical in `gml_vanilla_v105` and `gml_kaizo_dump`:
 *
 *     if (turn_type != "start" && turn_type != "short start"
 *         && turn_type != "short mid" && scr_bulletparent_count() < 2)
 *     { knight.image_alpha = 1; global.turntimer = -1; }
 *
 * THE MANAGER ENDS THE TURN WHEN IT DIES, and this was not translated. It is
 * the THIRD instance of that exact omission — `obj_knight_swordfall`'s Destroy
 * cost +272 frames on `atk_Vortex1`, and the tunnel was checked for the same
 * shape and found clean. `instance_destroy()` fires CleanUp in GML, so the
 * write is unconditional once the guard passes; the Step's own
 * `if (image_alpha >= 1) turntimer = 0` above is a DIFFERENT, conditional path
 * and the module's old comment ("a still-faded knight dies WITHOUT zeroing the
 * parked turntimer... whatever ends the turn after that is the turn machinery's
 * business") was describing the gap rather than a decision.
 *
 * MEASURED COST: `atk_Splitter3` ran 1092 frames against the mod's 556 — +536,
 * with 514 of it in the bullet phase, the largest divergence left in the fight.
 * The oracle's clock is cut from 515.13 to −2 in ONE frame at f8490; the sim
 * armed the same 998 and let it drain all 999.
 *
 * `scr_bulletparent_count() < 2` is ALWAYS TRUE — the script counts instances
 * whose object_index is EXACTLY `obj_bulletparent`, and nothing in the knight
 * fight creates a bare one (rotating-slash.js documents this at length, and
 * translating it as "live bullets < 2" is what once deadlocked that attack at
 * 999999 forever).
 *
 * `turn_type` defaults to the controller's `"full"`; the guard only suppresses
 * the write for a chained combination segment, whose successor closes the turn
 * instead.
 */
function boxsplitterCleanUp(e, state) {
  const t = e.turn_type ?? 'full';
  if (t === 'start' || t === 'short start' || t === 'short mid') return;
  const knight = state.entities.find(
    (k) => k.alive && k.type.name === 'obj_knight_enemy',
  );
  if (knight) knight.image_alpha = 1;
  state.turntimer = -1;
}

function box(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
}

export const boxsplitterAttack = {
  name: 'obj_roaringknight_boxsplitter_attack',

  // CleanUp_0 -- runs when the turn's end destroys the manager (sim/scenes/
  // fight.js clearTurn, through destroy()) as well as at its own end in the
  // step below. Its `scr_bulletparent_count() < 2` gate counts BARE
  // obj_bulletparent instances only (`object_index == obj_bulletparent`), not
  // descendants; the knight's attacks create none, so the gate is always
  // open here. MEASURED: _tok3 f1472 reads turntimer -1 in the recording.
  cleanUp: boxsplitterCleanUp,

  // AFTER THE SPLIT ORGANISM — same measured ordering as the sim module (see
  // its header for the verify21j receipt).
  stepOrder: 0.25,

  create(e, state) {
    e.spawn_speed = 40;
    e.spawn_range = 4;
    e.min_angle = 145;
    e.max_angle = 215;
    e.timer = 200; // >= spawn_speed on the very first Step, so slash 1 is immediate
    e.slash_count = 0;
    e.image_alpha = 1;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.image_speed = 0;
    e.image_index = 1;
    e.animtimer = 5;

    // THIS OBJECT IS THE VISIBLE KNIGHT for the whole attack — see the sim
    // module (traces/flurry2.csv).
    e.sprite_index = 'spr_roaringknight_attack_ol';
    // Create_0 l.12 `depth = obj_heart.depth + 1` (unchanged by the mod).
    // obj_heart's depth is its OBJECT DEFINITION's 0 (kaizo-mod/sprites/
    // objects_kaizo.csv, the object_depth dump) and no event or script in
    // the dump writes `obj_heart.depth` (grepped 2026-09-01: every hit is a
    // READ, `obj_heart.depth +/- N`), so the manager sits at 1 — the vanilla
    // module's 2 was a hand-resolved guess at the heart's depth. Changed to
    // 1 for the kaizo Draw port (kaizo/render/draw/split.js), which draws
    // the hell surface inside this object's Draw at THIS depth: over the
    // pending slash's own bar (`obj_growtangle.depth + 10`), under the box
    // and the teeth. In the renderer's sort (depth desc, then seq) 1 and 2
    // order this instance identically against every sibling — the teeth's
    // `organism.depth + 1` ties at 1 and the older manager still draws
    // first — so nothing else on screen moves. The ghosts' `depth + 50 /
    // + 100` (endStep) follow it. Depth is in no trace column.
    e.depth = 1;
    e.count = 3;
    e.aetimer = 0;
    e.recoil = 0;
    e.final_slash_anim = false;
    e.slash_anim_count = 0;
    e.flip = false;
    e.flipped = -1;
    e.forward = 0;
    e.flip_mode = true;
    e.turn_segment = -1;
    e.local_turntimer = 330;
    e.next_up = -1;
    e.next_next_up = -1;
    e.auto = true;
    e.splitbox = -4; // ORIGINAL BUG: assigned, read nowhere in the dump
    e.anchor_x = e.x;
    e.anchor_y = e.y;
    e.done = false;
    e.omae_wa_con = 0;
    e.omae_wa_timer = 0;
    e.vertical = false;
    e.difficulty = 2; // the controller overwrites this right after Create
    e.init = false;
    e.force_swap = -1;
    e.first_vertical = false;
    e.diagonal = false;
    e.force_oneside = e.difficulty0Force ?? gmlIrandom(state.gmlRng, 1);

    // `growtangle` starts as the obj_growtangle OBJECT, then splitslash
    // replaces it with the split_growtangle INSTANCE at the first cut.
    // Modelled as null = "the battle box".
    e.splitterRef = null;
  },

  /** The controller does `turn_type = "full"; event_user(0)`. This object has
   *  no Other_10, so event_user(0) is a no-op. */
  init() {},

  // (the CleanUp event lives at boxsplitterCleanUp, below the type)


  step(e, state) {
    e.local_turntimer -= 1;

    if (!e.init) {
      if (e.difficulty === 0) {
        e.spawn_speed = 50;
      } else if (e.difficulty === 1) {
        e.spawn_speed = 46;
        // ORIGINAL BUG: assigned here and read nowhere in the dump.
        e.force_swap = e.force_swap > 0 ? e.force_swap : gmlIrandom(state.gmlRng, 2) + 1;
      } else if (e.difficulty === 2) {
        e.spawn_speed = 31;
      } else if (e.difficulty === 3) {
        // KAIZO (Step_0 17-27): vanilla difficulty 3 had NO init branch and
        // kept the Create's 40. Kaizo pins 39 — 37 on Side-B. Both < 40, so
        // the `difficulty <= 2 && spawn_speed > 40` decay never applies:
        // flat cadence.
        e.spawn_speed = 39;
        if (kaizoSideb(state)) {
          e.spawn_speed = 37;
        }
      } else if (e.difficulty === 5) {
        // KAIZO (Step_0 28-35): the new variant. timer = 52 puts the first
        // slash on this very step (timer++ below reaches 53 = spawn_speed);
        // the local turn stretches to 422 and the GLOBAL clock parks at 999;
        // the knight fades out over 20 frames — the attack runs invisible.
        e.spawn_speed = 53;
        e.timer = 52;
        e.local_turntimer = 422;
        state.turntimer = 999;
        scrLerpvar(state, spawn, e, 'image_alpha', 1, 0, 20);
      }
      e.init = true;
      // The init block has its OWN vertical roll, before any cut. Scenes
      // supply it separately from the per-cut table.
      e.vertical = e.initVertical ?? gmlIrandom(state.gmlRng, 1);
    }

    if (!e.auto) return;

    // The knight's slash animation, from this object's Draw event (see the
    // sim module). KAIZO (Draw_0 hunk 1): the gate loosens from
    // `image_alpha == 1` to `image_alpha > 0` so the fading difficulty-5
    // knight keeps walking its pose frames.
    if (e.image_alpha > 0) {
      if (e.animtimer < 4) e.animtimer += 1;
      else if (e.image_index === 1 || e.image_index === 4) e.image_index += 1;
    }

    if (e.local_turntimer <= 30) {
      // Wind-down: back to the idle pose, then drift up to meet the knight.
      if (e.local_turntimer <= 10 && e.sprite_index !== 'spr_roaringknight_idle') {
        if (e.image_xscale < 0) e.x -= 220;
        e.image_xscale = Math.abs(e.image_xscale);
        e.sprite_index = 'spr_roaringknight_idle';
        e.image_index = 0;
      } else if (e.local_turntimer < 22 && e.image_xscale < 0) {
        e.image_index = 4;
      }

      const knight = state.entities.find((x) => x.alive && x.type.name === 'obj_knight_enemy');
      if (knight && e.x < knight.x) e.x += 1;
      let lt = e.local_turntimer;
      if (lt < 0) lt = 0;
      if (knight) e.y = lerp(e.y, knight.y, (50 - lt) / 50);

      const splitter = state.entities.find(
        (x) => x.alive && x.type.name === 'obj_knight_split_growtangle',
      );
      // `split_seen`, NOT `split` -- the organism publishes the frame-start
      // value at the top of its own step because THE GAME STEPS THIS MANAGER
      // FIRST (object index 8 against the organism's 909), so this read never
      // sees a flag the organism cleared on the same frame.
      //
      // MEASURED, _tok3 f8490: the last cycle's con-4 merge reaches distance 0
      // on f8489 and clears `split` there; the recording holds the turn open one
      // more frame and tears it down on f8490 (turntimer 515.1333 -> -2). Reading
      // the live flag ended it on f8489 -- the trace gate's f8489 divergence, with
      // `inv` and the population stuck a frame ahead for the rest of the fight.
      //
      // WHY NOT A stepOrder: the manager would have to sort before -0.5, which
      // also puts it before every default-0 object in the attack -- and it DRAWS
      // (the per-cut `vertical` roll), so that moves its draws to the front of
      // the frame and rewrites the slash stream. Tried: the run dies outright,
      // the recorded slash-angle queue exhausted. The 8,488 frames that already
      // match are the receipt that the draw order is right as it stands, so the
      // index order is expressed on the one read that measurably needs it.
      const splitSeen = splitter && (splitter.split_seen ?? splitter.split);
      if (e.local_turntimer < 0 && !splitSeen) {
        // KAIZO (Step_0 75-83): the turn only releases once the knight is
        // fully opaque again; otherwise the alpha climbs 0.1 — but
        // instance_destroy() runs UNCONDITIONALLY on this same frame, so the
        // +0.1 path fires at most once and a still-faded knight dies WITHOUT
        // zeroing the parked turntimer. Translated exactly; whatever ends the
        // turn after that is the (central) turn machinery's business.
        if (e.image_alpha >= 1) {
          state.turntimer = 0;
        } else {
          e.image_alpha += 0.1;
        }
        boxsplitterCleanUp(e, state);
        destroy(e);
      }
      return;
    }

    e.timer += 1;
    if (e.timer >= e.spawn_speed) {
      e.timer = 0;

      // ORDER MATTERS: the draw happens even at difficulties 0 and 5, where
      // the value is then thrown away. Skipping it would shift the stream.
      e.vertical = state.splitterVerticals
        ? state.splitterVerticals[state.splitterVIndex++]
        : gmlIrandom(state.gmlRng, 1);
      // A REPLAYED vertical is the recording's FINAL value — force_oneside
      // (the sim's own roll) must not overwrite it at difficulty 0.
      if (e.difficulty === 0 && !state.splitterVerticals) e.vertical = e.force_oneside;
      // KAIZO (Step_0 96-99): difficulty 5 is vertical-only — the roll above
      // still consumed its draw, its result is discarded.
      if (e.difficulty === 5) e.vertical = 1;

      const at = e.splitterRef && e.splitterRef.alive ? e.splitterRef : box(state);
      const s = spawn(state, splitslash, { x: at ? at.x : e.x, y: at ? at.y : e.y });
      s.vertical = e.vertical;
      if (e.difficulty === 3) {
        s.diagonal = e.diagonal;
        if (e.diagonal) {
          e.timer = -4;
          e.diagonal = false;
        } else {
          e.diagonal = state.splitterDiagonals
            ? state.splitterDiagonals[state.splitterDIndex++]
            : gmlIrandom(state.gmlRng, 1);
        }
      }

      e.slash_count += 1;
      if (e.difficulty <= 2 && e.spawn_speed > 40) {
        e.spawn_speed = scrMovetowards(e.spawn_speed, 40, 3);
      }
      e.spawn_range = scrApproach(e.spawn_range, 60, 3);
    }
  },

  /**
   * THE MANAGER'S AFTERIMAGE TRAIL — the same Draw event as the pose flip
   * (see the sim module for the full mechanism).
   *
   * KAIZO (Draw_0 hunks 1-2): the outer gate is `image_alpha > 0` (was
   * `== 1`) and the ghost's alpha scales with the knight's own —
   * `fade.image_alpha = 0.6 * image_alpha` — so the fading difficulty-5
   * knight sheds proportionally fainter ghosts instead of none. The inner
   * `image_alpha != 0` gate is redundant under `> 0` and kept for shape.
   */
  endStep(e, state) {
    if (!(e.image_alpha > 0)) return;
    e.aetimer += 1;
    if (e.aetimer % 4 !== 0) return;
    if (e.image_alpha === 0) return; // kaizo keeps `image_alpha != 0` inside

    const gt = state.entities.find(
      (x) => x.alive && x.type.name === 'obj_growtangle',
    );
    const fade = scrAfterimage(state, e);
    fade.image_alpha = 0.6 * e.image_alpha; // KAIZO (Draw_0 hunk 2)
    fade.fadeSpeed = 0.02;
    // `hspeed = ...` — obj_afterimage moves on built-in motion, and hspeed is
    // derived from speed/direction, so this is the equivalent pair.
    const dir = sign(e.x - (gt ? gt.x : e.x));
    fade.speed = Math.abs(2 * dir);
    fade.direction = dir < 0 ? 180 : 0;
    fade.depth = e.depth + (gt && e.x < gt.x ? 50 : 100);
  },
};
