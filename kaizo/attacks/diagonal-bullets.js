// KAIZO V-C — obj_diagonal_bullet_manager + obj_diagonal_bullet, dc.type 152
// (myattackchoice 12, `atk_DiamondStorm`), as EnderCat8's "Kaizo Roaring
// Knight" v2.3.3 builds them.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate). Research/playtest only.
//
// THIS FILE IS A COPY of the verified sim module, sim/attacks/diagonal-bullets.js,
// with ONLY the mod's deltas applied. Where the mod did not change a line the
// copy is byte-identical to the sim module (comments included). Ground truth:
//
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_diagonal_bullet_manager_Create_0.gml  (element 5, stoptime, rownum)
//     gml_Object_obj_diagonal_bullet_manager_Step_0.gml    (locals, sideb entry+jitter, lift shift, brake)
//     gml_Object_obj_diagonal_bullet_Step_0.gml            (damage re-pin, lifetime 180)
//
// A `diff` of each entry against knight-research/gml_dump/CodeEntries/ is the
// whole delta list, and it is short. Every divergence from the sim module
// quotes its kaizo line inline. Summary:
//
//   1. manager Create: `element = 5` (vanilla 0), plus two new fields the Step
//      needs — `stoptime = 0` and `rownum = 0`.
//   2. manager Step: `damage = 103` twice (frame top, and again inside the
//      spawn loop); three new per-wave locals `_hspeed` / `_xoff` / `_xx`; a
//      `kaizo_sideb()` ENTRY branch (odd walls come in from the LEFT with the
//      hspeed sign flipped); a `kaizo_sideb()` per-bullet ±6 JITTER; an
//      unconditional `inst.x += _xoff * 2` on the lifted wall; the `rate`
//      floor now also latches `stoptime = 1`; `rownum++`; and the stoptime
//      BRAKE that walks `horizontalspeed` and every live bullet's `hspeed`
//      toward 0 by 0.05 a frame.
//   3. bullet Step: `damage = 103` re-pinned every frame, and the lifetime
//      drops from `timer > 260` to `timer > 180`.
//
// WHAT THE RECORDING MEASURED (kaizo_oracle_seq_deep.csv / _sideb.csv,
// grouped by `kaizo_playing == 'atk_DiamondStorm'`; both routes create exactly
// 336 obj_diagonal_bullet, 24 a wall over 14 walls). The seq log's x/speed are
// END-OF-FRAME values, so they already carry that frame's motion and brake:
//
//   A-SIDE, gt at (320, 170), so a wall is created at x 620:
//     walls 1-9   x 615 (low) or 627 (LIFTED)     speed 7.8102498055
//     wall 10     x 615.0499877930                speed 7.7783350945
//     wall 11     x 615.4500122070                speed 7.5301060677
//     wall 12     x 615.8499755859                speed 7.2953748703
//     wall 13     x 628.2500000000 (lifted)       speed 7.0754857063
//     wall 14     x 616.6500244141                speed 6.8718628883
//
//   The +12 on a lifted wall (627 - 615) is delta 2's `_xoff * 2`, and the six
//   distinct speeds are delta 2's brake: hypot(6, h) for h = 5, 4.95, 4.55,
//   4.15, 3.75, 3.35 — one 0.05 step on the wall that latches `stoptime`, then
//   eight more per 8-frame wall after it. The sim produced ONE speed and ONE
//   column before this file existed.
//
//   B-SIDE (`global.flag[456] = 1`), same 14 walls, alternating entry side:
//     even rownum  x {609, 621}   (created at 620, jitter ±6, lift ∓12)
//     odd  rownum  x {19, 31}     (created at  20, hspeed +5)
//     wall 10 (odd)   x {18.95, 30.95}     wall 11 (even, lifted) {609.45, 621.45}
//     wall 12 (odd)   x {18.15, 30.15}     wall 13 (even)         {610.25, 622.25}
//     wall 14 (odd)   x {17.35, 29.35}
//
// ── THE OPERATION ORDER IS LOAD-BEARING, AND THE B-SIDE IS WHAT PROVES IT ──
//
// The jitter and the lift SHARE `_xoff`:
//
//     if (kaizo_sideb()) { inst.x += _xoff; _xoff = -_xoff; }   // flips HERE
//     if (_vspeed > 0)   { inst.y = ...;    inst.x += _xoff * 2; }
//
// so on the B-Side the lift uses the ALREADY-FLIPPED value and carries the
// bullet to the OTHER side of the column: bullet 0 goes 620 → +6 = 626 →
// −12 = 614, not 638. The recording says {609, 621} after the −5 of motion,
// which is 614/626 — so the flip really does happen between the two lines.
// Reordering them, or hoisting the flip out of the sideb branch, reproduces
// the A-Side perfectly and gets every B-Side wall wrong by 24px. A-Side never
// flips (the jitter is gated, the lift is not), which is why `_xoff * 2` is a
// constant +12 there and the two features look independent until the B-Side
// recording separates them.
//
// NOT translated: nothing. The bullet's Step is three lines of alpha fade
// (cosmetic) plus the shortened lifetime, and both are here.

import { spawn, destroy } from '../../sim/entity.js';
import { clamp, lerp, scrApproach } from '../../sim/gml.js';
import { scrBulletInit, collidebulletOther15 } from '../../sim/bullets/regularbullet.js';
import { gmlChoose } from '../../sim/rng.js';

function box(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
}

/** kaizo_sideb() (gml_GlobalScript_kaizo_settings_init.gml:79) — reads
 *  obj_knight_enemy.k_sideb in the mod; the scene stamps the flag as
 *  state.kaizo.sideb (kaizo-fight.js, version D). */
function kaizoSideb(state) {
  return !!(state.kaizo && state.kaizo.sideb);
}

/** dbulletcontroller Step_0 sets `damage = 103` on the type-152 dispatch, and
 *  both objects re-pin it from their own Step every frame. Named rather than
 *  inlined three times so the three sites are visibly the same number. */
const KAIZO_DIAGONAL_DAMAGE = 103;

export const diagonalBullet = {
  name: 'obj_diagonal_bullet',

  create(e, state) {
    e.timer = 0;
    e.con = 0;
    e.image_alpha = 0;
    scrBulletInit(e);
    e.destroyonhit = 0;
    // spr_smallbullet comes from the OBJECT DEFINITION, not any event — the
    // same grep-invisible hole as obj_basicattack (object_sprite.csx found
    // it). Without it the bullet had no sprite, no mask, no contact and no
    // graze: the verifiers caught all three the day it joined ATTACK_MENU.
    e.sprite_index = 'spr_smallbullet';
    e.isBullet = true;
    e.componentMotion = true;
    e.hspeed = 0;
    e.vspeed = 0;
  },

  step(e, state) {
    e.timer += 1;
    // KAIZO DELTA (obj_diagonal_bullet Step_0:2) — the bullet re-pins its own
    // damage every frame. Vanilla has no such line and the bullet keeps
    // whatever the manager handed it.
    e.damage = KAIZO_DIAGONAL_DAMAGE;

    // Fades in as it nears the box horizontally and out as it leaves it
    // vertically, so only the part of the wall crossing the arena is visible.
    const gt = box(state);
    if (gt) {
      const a = clamp(Math.abs(e.x - gt.x) / 300, 0, 1);
      const maxalpha = lerp(1.3, 0, a);
      e.image_alpha = lerp(maxalpha, 0, Math.abs(e.y - gt.y) / 200);
    }

    // KAIZO DELTA (obj_diagonal_bullet Step_0:6) — `timer > 180`, where
    // vanilla (and sim/attacks/diagonal-bullets.js) destroys at `timer > 260`.
    // A bullet therefore lives 181 frames instead of 261. Invisible in the seq
    // log, which records CREATIONS only: this one is read out of the mod's GML
    // and asserted against the sim directly in check-oracle-tracking.
    if (e.timer > 180) destroy(e);
  },

  other15: collidebulletOther15,
};

export const diagonalBulletManager = {
  name: 'obj_diagonal_bullet_manager',

  create(e, state) {
    // A COLLIDEBULLET IN ITS OWN RIGHT. The object's parent chain (dumped via
    // object_parents.csx) is obj_diagonal_bullet_manager -> obj_regularbullet -> the
    // collidebullet base — so the real game's bullet enumeration counts the
    // MANAGER itself, sitting at (growtangle.x, cameray()) from its creation
    // frame. The whole-fight differ pairs bullets by slot, and without this
    // flag every bullet of the turn sat one slot early against the recording
    // (turn 2's f450: oracle b0 is the manager, sim b0 was the first sword).
    // maskOff keeps it out of the collision and graze loops: parked at the
    // camera top it never touches the soul, and its own damage never fires.
    e.isBullet = true;
    e.maskOff = true;
    e.timer = 0;
    e.con = 0;
    e.damage = 1;
    e.grazepoint = 2;
    e.timepoints = 2;
    e.inv = 0;
    e.target = 4;
    e.grazed = 0;
    e.grazetimer = 0;
    // KAIZO DELTA (manager Create_0:12) — `element = 5`; vanilla sets 0.
    // Nothing in the translated tree branches on it yet, so it is carried
    // rather than used; dropping it would silently un-do a real delta.
    e.element = 5;
    e.rate = 44;
    e.verticalspeed = 6;
    e.horizontalspeed = -5;
    e.gapsize = 56;
    e.bulletcount = 24;
    // One frame short of the first wave, so it fires on the very first Step.
    e.timer = e.rate - 1;
    // KAIZO DELTA (manager Create_0:19-20) — two new fields. `stoptime` latches
    // the brake; `rownum` counts walls and its parity picks the B-Side entry
    // side.
    e.stoptime = 0;
    e.rownum = 0;
  },

  step(e, state) {
    e.timer += 1;
    // KAIZO DELTA (manager Step_0:2).
    e.damage = KAIZO_DIAGONAL_DAMAGE;

    if (e.timer === e.rate) {
      e.timer = 0;

      const gt = box(state);
      // The sim module's guard, kept: obj_growtangle.x is read unguarded in
      // the GML (no board, no attack), and a missing board here would poison
      // every spawn x with NaN rather than failing loudly.
      if (gt) {
        // ONE draw for the whole wave — the entire wall slants the same way.
        const vspeed = state.diagonalFlips
          ? state.diagonalFlips[state.diagonalIndex++]
          : gmlChoose(state.gmlRng, [e.verticalspeed, e.verticalspeed * -1]);

        // KAIZO DELTA (manager Step_0:7-14) — the three per-wave locals, and
        // the B-Side ENTRY branch. On odd walls the B-Side sends the wall in
        // from obj_growtangle.x - 300 travelling RIGHT (`-horizontalspeed`),
        // so the arena is swept from alternating sides. A-Side keeps 300/-5
        // on every wall. `_xoff` is declared here and MUTATED per bullet
        // below; see the header for why that order is load-bearing.
        let _hspeed = e.horizontalspeed;
        let _xoff = 6;
        let _xx = 300;
        if (kaizoSideb(state) && (e.rownum % 2) === 1) {
          _xx = -300;
          _hspeed = -e.horizontalspeed;
        }

        for (let i = 0; i < e.bulletcount; i++) {
          const inst = spawn(state, diagonalBullet, {
            x: gt.x + _xx,
            y: gt.y - 100 + e.gapsize * i,
          });
          inst.hspeed = _hspeed;
          inst.vspeed = vspeed;
          // KAIZO DELTA (manager Step_0:20) — a second `damage = 103`, on the
          // MANAGER, inside the loop. It is already 103 from the frame top, so
          // the line does nothing; it is kept because the copy tracks the mod
          // line for line and a later reader should not have to re-derive that
          // it is a no-op.
          e.damage = KAIZO_DIAGONAL_DAMAGE;
          inst.damage = e.damage;
          // KAIZO DELTA (manager Step_0:21-25) — the per-bullet ±6 jitter,
          // B-Side only. The flip lands BETWEEN this and the lift below.
          if (kaizoSideb(state)) {
            inst.x += _xoff;
            _xoff = -_xoff;
          }
          if (vspeed > 0) {
            inst.y = inst.y - e.bulletcount * e.gapsize + 300;
            // KAIZO DELTA (manager Step_0:29) — NOT gated on kaizo_sideb().
            // The recording measures it as a flat +12 on every lifted A-Side
            // wall (x 627 against the low wall's 615), and as a ∓12 on the
            // B-Side, where `_xoff` has already flipped for this bullet.
            inst.x += _xoff * 2;
          }
        }

        e.rate -= 4;
        if (e.rate < 8) {
          // KAIZO DELTA (manager Step_0:35) — the floor now LATCHES the brake.
          // Vanilla only clamps the rate.
          e.stoptime = 1;
          e.rate = 8;
        }
        // KAIZO DELTA (manager Step_0:38).
        e.rownum += 1;
      }
    }

    // KAIZO DELTA (manager Step_0:40-47) — THE BRAKE. Once latched it runs
    // EVERY frame, including the frame that latched it and the frames a wall
    // is created on, and it walks the manager's own `horizontalspeed` and
    // every live bullet's `hspeed` toward 0 by 0.05.
    //
    // It runs AFTER the spawn block in the same Step, so a wall created on a
    // braking frame is itself braked before it ever moves — which is exactly
    // why the recording's wall 10 reports x 615.0499877930 (620 - 4.95) rather
    // than 615 (620 - 5) on the very frame `stoptime` latched. Six distinct
    // launch speeds over the turn; the sim had one.
    //
    // `with (obj_diagonal_bullet)` is by OBJECT INDEX, so it catches the 24
    // bullets spawned moments ago in this same Step (sim/entity.js pushes on
    // spawn) as well as every older wall still on screen. Order is irrelevant
    // here — each bullet's hspeed depends only on its own — so this does not
    // touch the unresolved `with`-ordering question in CLAUDE.md.
    if (e.stoptime) {
      e.horizontalspeed = scrApproach(e.horizontalspeed, 0, 0.05);
      for (const b of state.entities) {
        if (!b.alive || b.type.name !== 'obj_diagonal_bullet') continue;
        b.hspeed = scrApproach(b.hspeed, 0, 0.05);
      }
    }
  },
};
