// KAIZO obj_knight_swordtunnelanim — the Knight's tunnel performance, with
// the mod's `vertical` mode (sword tunnel difficulty 11's cross corridor).
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// COPY OF: sim/attacks/sword-tunnel-anim.js (the VERIFIED module). Where the
// mod did not change a line the copy is byte-identical; every divergence
// carries its kaizo file+line.
//
// PROVENANCE (knight-research/kaizo-mod/, private):
//   gml_kaizo_dump/CodeEntries/gml_Object_obj_knight_swordtunnelanim_Create_0.gml
//   gml_kaizo_dump/CodeEntries/gml_Object_obj_knight_swordtunnelanim_Step_0.gml
//   gml_kaizo_dump/CodeEntries/gml_Object_obj_afterimage_{Create_0,Step_0}.gml
//   gml_kaizo_dump/CodeEntries/gml_GlobalScript_scr_script_delayed.gml
//   gml_kaizo_dump/CodeEntries/gml_Object_obj_script_delayed_{Create_0,Alarm_0,Other_10}.gml
//   delta spec: knight-research/kaizo-mod/deltas/
//     gml_Object_obj_knight_swordtunnelanim_Step_0.md
//
// WHAT DIVERGES FROM THE SIM MODULE (three hunks, all gated on `vertical`):
//   1. Create l.20: `vertical = false` — a NEW field. Flipped to true through
//      the tunnel manager's `woosh` handle by Other_10's difficulty-11 block
//      (see sword-tunnel.js `init`).
//   2. Step l.15-18: in vertical mode the anim hides itself at timer 1
//      (`visible = false`). GM stops Draw_0, NOT Step_0 — the whole timeline
//      (sounds, lerpvars, the con 0 -> 1 handoff, the teardown) keeps running,
//      so nothing else moves.
//   3. Step l.31-47: at timer 20, vertical mode bursts TWELVE spr_lightfairy
//      particles from just above the screen. Cosmetic — but it CONSUMES RNG in
//      the Step phase, so the draws are reproduced exactly (see below).
//   4. Step l.103: the afterimage trail gate becomes `drawtrail && !vertical`.
//      The sim module never spawned that trail (its ghosts are Draw-only and
//      it models just the `drawtrail` flag), so this hunk has nothing to gate
//      here — recorded for whenever the trail is rendered.
//
// THE RNG IS THE LOAD-BEARING PART OF HUNK 3. Per particle, in this order:
//     irandom(220)          (2 draws)  the x scatter, evaluated as
//                                      instance_create's first argument
//     random_range(-2, 2)   (1 draw)   hspeed
//     random_range(2.5, 4)  (1 draw)   vspeed
//     irandom_range(20, 30) (2 draws)  the image_index lerp duration, the
//                                      FOURTH scr_lerpvar's last argument
// 6 draws x 12 = 72 draws in a single Step frame, shifting the shared stream
// for everything that draws after it that frame. Skipping them because the
// particles are decorative would desync the corridor itself.
//
// COLOUR — audited for the mod's blue re-theme, and there is NOTHING TO
// APPLY here. Every obj_knight_swordtunnelanim event was diffed against
// gml_vanilla_v105: Create_0 adds only `vertical = false`, Step_0 the three
// hunks above, Draw_0 only wraps `draw_self()` in `if (!vertical)`, and the
// word `image_blend` does not appear in any of them. The light-fairy burst
// sets sprite, speeds and four lerpvars — no blend either. This object's
// tint is whatever the Knight sprite ships with, in both builds. (The blue
// in this attack is on the SWORDS: sword-tunnel.js.)
//
// PURE-VISUAL, not drawn (renderer work later, no RNG involved): the fairies'
// sprite and fade, `visible`, and the vanilla shinka/leafpitch audio lerps the
// sim module already leaves out (`fadeaudio` at timer 15/20, `shinkafade` and
// `leafpitch` in con 1 — byte-identical to vanilla, so parity with the
// verified module is kept rather than widening scope here).

import { gmlRandom, gmlRandomRange, gmlIrandom, gmlIrandomRange } from '../../sim/rng.js';
import { spawn, destroy } from '../../sim/entity.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
// obj_afterimage is BYTE-IDENTICAL in the kaizo dump (Create_0 and Step_0 both
// diff clean against gml_vanilla_v105), so the verified type is imported, not
// copied — the one-way-import law.
import { afterimage } from '../../sim/fx.js';

/**
 * `obj_script_delayed` — the engine-side half of `scr_script_delayed(fn, n)`
 * (gml_GlobalScript_scr_script_delayed.gml): a bare instance carrying the
 * caller's `id` as `target` and `alarm[0] = n`; its Alarm_0 runs `event_user(0)`
 * (Other_10, which does `with (target) script_execute(script)`) and then
 * destroys itself.
 *
 * The only form this module needs is `scr_script_delayed(instance_destroy, 31)`
 * from the light-fairy burst, so `script` is fixed to the destroy. Alarms fire
 * BEFORE Step in this engine exactly as in GameMaker, so the target dies on the
 * 31st frame after the burst — an alarm, never a counter (CLAUDE.md rule 5).
 *
 * Same shape as the `scriptDelayed` helpers in kaizo/attacks/rotating-slash.js
 * and knightlines.js; kept module-local rather than shared so this file has no
 * kaizo-to-kaizo dependency.
 */
const scriptDelayed = {
  name: 'obj_script_delayed',

  create(e) {
    e.target = null;
    e.rate = 1;
    e.arg_count = 0;
  },

  alarm: {
    0(e) {
      // Other_10: `with (target) script_execute(instance_destroy)`.
      if (e.target && e.target.alive) destroy(e.target);
      destroy(e); // obj_script_delayed Alarm_0's own instance_destroy()
    },
  },
};

export const swordTunnelAnim = {
  name: 'obj_knight_swordtunnelanim',

  create(e, state) {
    e.con = 0;
    e.timer = 0;
    e.siner = 0;
    e.animindex = 0;
    e.sprite_index = 'spr_roaringknight_point_ol';
    e.image_speed = 0;
    e.image_index = 0;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.drawtrail = true;
    e.shadowtimer = 0;
    e.dir = 4;
    e.fadeaudio = 0;
    e.fadeaudio2 = 0;
    e.shinkafade = 0;
    e.leafpitch = 1;
    e.endtimer = 0;
    // KAIZO Create l.20: the vertical-corridor mode flag. Set through the
    // manager's `woosh` handle by Other_10's difficulty-11 block, which runs
    // AFTER this Create — the delta spec's ordering trap.
    e.vertical = false;
    e.visible = true;
    e.componentMotion = true;
    e.hspeed = 0;
    e.vspeed = 0;
    e.ystart = e.y;

    // `depth = obj_growtangle.depth - 1` — in front of the arena.
    const gt = state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
    e.depth = (gt ? gt.depth : 5) - 1;
  },

  step(e, state) {
    if (e.con === 0) {
      // TWO PITCH ROLLS EVERY THIRD FRAME, checked BEFORE the increment
      // (sim module — the mod does not touch this).
      if (e.timer < 60 && e.timer % 3 === 0 && state.gmlRng) {
        gmlRandom(state.gmlRng, 0.2);
        gmlRandom(state.gmlRng, 0.2);
      }
      e.timer += 1;

      if (e.timer === 1) {
        // KAIZO Step l.15-18: the vertical tunnel's wind-up is invisible. The
        // timeline still runs — `visible = false` stops Draw_0, not Step_0.
        if (e.vertical) e.visible = false;
        scrLerpvar(state, spawn, e, 'image_index', 0, 4, 10);
        scrLerpvar(state, spawn, e, 'dir', 4, -18, 40, 2);
      }
      if (e.timer === 20) {
        scrLerpvar(state, spawn, e, 'image_alpha', 1, 0, 10);
        e.hspeed = -4;
        // KAIZO Step l.31-47: THE LIGHT-FAIRY BURST. Twelve obj_afterimage
        // instances raining from `cameray() - 24` across
        // `camerax() + 210 .. +430`, decelerating to a stop over 30 frames and
        // destroyed at 31 — the telegraph that this tunnel's swords come from
        // ABOVE. Cosmetic; the DRAWS are not. See the header for the order.
        if (e.vertical) {
          for (let i = 0; i < 12; i++) {
            // `instance_create(camerax() + 210 + irandom(220), ...)` — the
            // argument is evaluated before the instance exists, so this draw
            // lands ahead of the two random_ranges below.
            const fx = state.view.x + 210 + gmlIrandom(state.gmlRng, 220);
            const f = spawn(state, afterimage, { x: fx, y: state.view.y - 24 });
            f.sprite_index = 'spr_lightfairy';
            // GML drives these particles by hspeed/vspeed directly. The shared
            // obj_afterimage type opts into `builtinMotion` (speed/direction);
            // the component branch is tested first in the motion phase, so
            // opting this instance in is what makes hspeed/vspeed the state
            // that moves — GameMaker's own derivation, per-instance and
            // without touching the shared type.
            f.componentMotion = true;
            f.hspeed = gmlRandomRange(state.gmlRng, -2, 2);
            f.vspeed = gmlRandomRange(state.gmlRng, 2.5, 4);
            scrLerpvar(state, spawn, f, 'vspeed', f.vspeed, 0, 30);
            scrLerpvar(state, spawn, f, 'hspeed', f.hspeed, 0, 30);
            scrLerpvar(state, spawn, f, 'image_alpha', 1, 0, 30);
            scrLerpvar(state, spawn, f, 'image_index', 0, 4,
              gmlIrandomRange(state.gmlRng, 20, 30));
            // `scr_script_delayed(instance_destroy, 31)`.
            const d = spawn(state, scriptDelayed, { x: 0, y: 0 });
            d.target = f;
            d.alarm[0] = 31;
          }
        }
      }
      // KAIZO Step l.103 (`drawtrail && !vertical`) gates a Draw-side trail the
      // sim module does not spawn — see header.
      if (e.timer === 26) e.drawtrail = 0;
      if (e.timer === 60) {
        e.timer = 0;
        e.con = 1;
      }
    }
    // A SEPARATE IF, not else-if (sim module — the transition frame runs the
    // con-1 block the SAME frame).
    if (e.con === 1) {
      e.timer += 1;
      // Con 1's pitch pair, POST-increment and ungated by time (sim module).
      if (e.timer % 3 === 0 && state.gmlRng) {
        gmlRandomRange(state.gmlRng, 0, 0.2);
        gmlRandomRange(state.gmlRng, 0, 0.2);
      }
    }

    // THE TEARDOWN (sim module — `global.turntimer < 10` read on the game's
    // mid-step clock, hence the -1; measured, see the sim module's note).
    if (state.turntimer - 1 < 10) {
      e.endtimer = (e.endtimer ?? 0) + 1;
      e.image_alpha = 1;
      const knight = state.entities.find(
        (x) => x.alive && x.type.name === 'obj_knight_enemy',
      );
      if (knight) e.x = knight.x;
      if (e.endtimer === 1) {
        e.sprite_index = 'spr_roaringknight_ball_transition_sword';
        e.image_index = 5;
        e.image_speed = 0.5;
      }
      if (e.endtimer === 8) {
        destroy(e);
        return;
      }
    }

    e.siner += 1;
    e.y = e.ystart + Math.sin(e.siner / 16) * 8;
  },
};
