// KAIZO V-C — obj_tracking_swords_manager + obj_tracking_sword1, dc.type 151,
// as EnderCat8's "Kaizo Roaring Knight" v2.3.3 builds them.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate). Research/playtest only.
//
// THIS FILE IS A COPY of the VERIFIED sim module, sim/attacks/tracking-swords.js,
// with ONLY the mod's deltas applied. Where the mod did not change a line the
// copy is byte-identical to the sim module (comments included). Ground truth:
//
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_tracking_swords_manager_Create_0.gml   (frostveil state, 200-slot script array)
//     gml_Object_obj_tracking_swords_manager_Other_10.gml   (variant table: +3.1/4/5/6/6.1/7/7.1/7.2/8/10/11)
//     gml_Object_obj_tracking_swords_manager_Step_0.gml     (spiral spawn, multi-manager reroll, wheel gate, v10 override)
//     gml_Object_obj_tracking_sword1_Create_0.gml           (anomaly flag)
//     gml_Object_obj_tracking_sword1_Step_0.gml             (growtangle anchor, fade retime + get_swordcolor, destroy at 4)
//     gml_Object_obj_tracking_sword_slash_Draw_0.gml        (2-frame hitbox)
//     gml_Object_obj_tracking_sword_slash_extra_graze_Step_0.gml (variant-11 TP nerf, lifetime moved from Draw)
//
// Every divergence from the sim module quotes its kaizo file+line inline.
// Summary of what diverges:
//   1. manager Create: `shoutouttofrostveil = 0; anomalydir = 270;`, and the
//      setdirection script array is 200 slots (vanilla 50).
//   2. manager Other_10 (init): eleven new variant blocks appended after
//      variant 3 — 3.1, 4 (with a kaizo_sideb() burst retune), 5, 6, 6.1, 7,
//      7.1 (rate 9999 puppet — the kaizo rotating slash pokes `timer = rate - 2`),
//      7.2, 8, 10, 11 (frostveil spiral). Fractional variants compared with
//      gmlEq, never ===.
//   3. manager Step: `_checkswd`/`_trueanomdir` pre-loop locals; frostveil
//      spawns take `anomalydir` (+20/sword, NO RNG DRAW); a multi-manager
//      anti-overlap reroll loop replaces the vanilla wheel when 2+ managers
//      coexist (the wheel is gated to the single-manager case); variant 10
//      overrides the newborn sword's telegraph stats (5/5/10/4, len 88).
//   4. sword: new `anomaly` field — anomaly swords anchor to obj_growtangle
//      instead of the heart while tracking; the telegraph colour ramp runs
//      over a context-dependent _truefadetime (v10: 15, over a live rotating
//      slash: 19 B-Side / 20 A-Side, else 30) toward get_swordcolor() instead
//      of c_red; the sword destroys at con-3 timer 4 (vanilla 5).
//   5. slash hitbox: 2 drawn frames (vanilla 3).
//   6. extra-graze band: variant-11 grazes pay 1 TP (vs 7/4); the band has a
//      3-STEP lifetime. NOTE the lifetime is a BASE-VERSION change too: the
//      mod's base, vanilla v1.05, already ticks it in Draw (the sim's v1.03
//      band has no lifetime at all — its header documents the f508 lingering
//      pay); kaizo moved the tick from Draw_0 into Step_0.
//
// THE TELEGRAPH BLUE IS APPLIED HERE (it is the one entity in the mod that
// was already carrying it — ~2000 blue frames a run). image_blend is sim
// state the renderer and the lock-on afterimage both read, so the VALUE is
// computed with the mod's formula: merge_color(c_white, get_swordcolor(),
// timer / _truefadetime) over all FOUR windows — 15 at variant 10, 19/20
// while a rotating slash is live (B-Side/A-Side), 30 otherwise. No RNG in
// any of it; zero draws. The palette itself now comes from the shared
// kaizo-colors.js (see the import). The sword's afterimage trail and the
// manager's slash surface follow the sim module's existing render
// arrangements.
//
// The B-Side flag: kaizo_sideb() reads obj_knight_enemy.k_sideb; here it is
// state.kaizo?.sideb (boolean, stamped at scene build). Read at INIT time for
// variant 4 and at STEP time for the sword's fade, exactly where the GML reads
// it.

import { spawn, destroy } from '../../sim/entity.js';
// THE MOD'S PALETTE — kaizo/attacks/kaizo-colors.js, the one source of truth.
//
// THIS FILE USED TO CARRY ITS OWN COPY, AND THE COPY WAS WRONG. It decoded
// the dump's reals as $FF4E44 / $FF7665 / $FF8F95, where 16732740 / 16743013 /
// 16749461 are really $FF5244 / $FF7A65 / $FF9395 — three swordtypes off by
// 4-5 in the green channel, silently, because nothing compared the two
// tables. That is the whole reason the palette now has one home; do not
// reintroduce a local get_swordcolor here.
//
// getSwordcolor returns a STABLE array reference (several of the mod's Draw
// gates are `image_blend == get_swordcolor()`); this module only uses it as a
// merge endpoint, but the same import must be used everywhere for those
// gates to keep working.
import { getSwordcolor } from './kaizo-colors.js';
import { masksOverlap, HEART_MASK, HEART_RECT, PXWHITE2_MASK } from '../../sim/masks.js';
import { scrTensionheal } from '../../sim/tension.js';
import { gearOf } from '../../sim/damage.js';
import { partyWearing } from '../../sim/equipment.js';
import { clamp, lerp, lengthdirX, lengthdirY, mergeColor, WHITE, gmlEq } from '../../sim/gml.js';
import { scrBulletInit, collidebulletOther15 } from '../../sim/bullets/regularbullet.js';
import { gmlChoose } from '../../sim/rng.js';
import { cue } from '../../sim/audio.js';
import { afterimageGrow } from '../../sim/fx.js';

const HEADINGS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Count of live managers — GML `instance_number(obj_tracking_swords_manager)`. */
function managerCount(state) {
  let n = 0;
  for (const m of state.entities) {
    if (m.alive && m.type.name === 'obj_tracking_swords_manager') n += 1;
  }
  return n;
}

/**
 * The 90/270 up-down direction string — kaizo Other_10 writes it as 22
 * literal assignment lines (`setdirection[1] = 90; ... setdirection[22] =
 * 270;`, byte-identical across variants 4/6/6.1/7/7.1/7.2/8, e.g. lines
 * 70-91 for variant 4). Loop-compressed here the same way the sim module
 * compresses variant 2's block. Beyond index 22 the entries stay -1, so
 * sword 23+ reverts to the rolled heading.
 */
function setUpDownString(e) {
  for (let i = 1; i <= 22; i++) e.setdirection[i] = (i % 2 === 1) ? 90 : 270;
}

/**
 * obj_tracking_sword_slash_extra_graze — a 900x7 invisible bar spawned WITH
 * the slash, whose whole job is one graze: `if (global.inv < 0)` and
 * place_meeting with the heart pays TP, shaves 1/30 off the turn clock, and
 * destroys itself. KAIZO/v105: the band also has a 3-STEP lifetime (the tick
 * lives at the END of Step_0, lines 30-34 — moved there from v105's Draw_0),
 * so a missed band no longer lingers the way the sim module's v1.03 band
 * does. The TP chain gains a variant-11 branch: frostveil grazes pay 1
 * (extra_graze Step_0 lines 11-14) — the endless spiral would otherwise be a
 * TP fountain. Its factor arithmetic is its OWN Create's, not the grazebox's:
 * TensionBow and LodeStone only for TP, SilverWatch only for time — NO ribbon
 * terms on either (the grazebox subtracts them), capped at 3. Sprite
 * spr_pxwhite2 (1x2, origin (0,1), precise), scaled 900x7; no collidebullet
 * parent, so it neither occupies a trace slot nor talks to the grazebox.
 */
export const trackingSlashExtraGraze = {
  name: 'obj_tracking_sword_slash_extra_graze',

  create(e, state) {
    e.timer = 0;
    e.con = 0;
    e.image_xscale = 900;
    e.image_yscale = 7;
    e.visible = false;
  },

  step(e, state) {
    // KAIZO RESTRUCTURE: the sim module early-returns out of the graze check;
    // kaizo appends the lifetime tick AFTER it (Step_0 lines 30-34), so the
    // gate nests instead — a heartless or inv-blocked frame still ticks.
    //
    // PRE-DECREMENT inv, like the pre-move soul below: the recording pays at
    // f508, the frame AFTER inv crosses below zero, because the band's step
    // runs before obj_heart's decrement.
    if ((state.invAtFrameStart ?? state.invTimer) < 0) {
      const heart = state.soul;
      if (heart) {
        // PRE-MOVE soul, like the grazebox and the sword's aim: the band pays
        // on the frame the recording pays (f508, not f507) only against the
        // soul's last-frame position. grazePrev is heart+10 on both axes.
        //
        // THE CHECK IS `place_meeting`, so it runs the project's OWN
        // calibrated precise-mask routine — see the sim module's header for
        // the 2,586-probe calibration story. The mask is spr_pxwhite2 (1x2,
        // origin (0,1)) scaled 900x7 against the fight soul's 20x20 rect.
        const overlaps = (sx, sy) => masksOverlap(
          HEART_RECT, sx, sy, PXWHITE2_MASK, e.x, e.y, 900, 7, e.image_angle,
        );
        const hx = state.grazePrev ? state.grazePrev.x - 10 : heart.x;
        const hy = state.grazePrev ? state.grazePrev.y - 10 : heart.y;
        const bandHit = overlaps(hx, hy);
        if (bandHit) {
          const loadout = gearOf(state);
          let tp = 1 + partyWearing(loadout, 15) * 0.1 + partyWearing(loadout, 24) * 0.05;
          let time = 1 + partyWearing(loadout, 14) * 0.1;
          if (tp > 3) tp = 3;
          if (time > 3) time = 3;

          // KAIZO TP CHAIN — extra_graze Step_0 lines 7-22. An if/else-if
          // chain (the sim module's vanilla-v103 form merged variant-1 and
          // vortex into one 4-or-7 pick), with the NEW variant-11 else-if:
          // frostveil grazes pay 1 * factor. FIRST-INSTANCE semantics: GML
          // `obj_tracking_swords_manager.variant` reads the FIRST instance —
          // the mod runs concurrent managers, so this is .find (oldest
          // spawn), NOT .some (delta spec's explicit warning).
          const mgr = state.entities.find(
            (m) => m.alive && m.type.name === 'obj_tracking_swords_manager',
          );
          if (mgr && mgr.variant === 1) {
            scrTensionheal(state, 4 * tp);
          } else if (mgr && mgr.variant === 11) {
            // kaizo extra_graze Step_0 lines 11-14 (the one new branch)
            scrTensionheal(state, 1 * tp);
          } else if (state.entities.some(
            (m) => m.alive && m.type.name === 'obj_sword_vortex_manager',
          )) {
            scrTensionheal(state, 4 * tp);
          } else {
            scrTensionheal(state, 7 * tp);
          }
          if (state.turntimer >= 10) state.turntimer -= (1 / 30) * time;
          destroy(e);
        }
      }
    }
    // KAIZO — extra_graze Step_0 lines 30-34: the 3-frame lifetime, moved
    // here from the (v105) Draw event. Runs even on the graze frame, exactly
    // as GML runs it after instance_destroy(): the ++ on a just-destroyed
    // band is harmless on both sides.
    e.timer += 1;
    if (e.timer === 3) destroy(e);
  },
};

/** obj_tracking_sword_slash — a 900x1 bar along the sword's heading, alive
 *  for TWO frames under kaizo (slash Draw_0 line 2: `timer == 2`; vanilla 3).
 *  This, not the hovering sword, is what hits. */
export const trackingSwordSlash = {
  name: 'obj_tracking_sword_slash',

  create(e, state) {
    e.timer = 0;
    e.con = 0;
    e.image_xscale = 900;
    e.image_yscale = 1;
    scrBulletInit(e);
    e.active = 1;
    e.destroyonhit = 0;
    e.damage = 1;
    // GRAZEPOINTS ARE HALVED IN TWO CASES, and this hardcoded the un-halved 4:
    //
    //     grazepoints = 4;
    //     if (i_ex(obj_sword_vortex_manager)) grazepoints = 2;
    //     if (i_ex(obj_tracking_swords_manager) && variant == 1) grazepoints = 2;
    //
    // `variant` is the attack's DIFFICULTY (`_manager.variant = difficulty`).
    // KAIZO: this Create is byte-identical to vanilla (diffed) — kept as the
    // sim module has it. (The variant==1 read is first-instance in GML and
    // .some here; indistinguishable, since no kaizo dispatch row uses
    // difficulty 1 for type 151.)
    const vortex = state.entities.some(
      (x) => x.alive && x.type.name === 'obj_sword_vortex_manager',
    );
    const variantOne = state.entities.some(
      (x) => x.alive && x.type.name === 'obj_tracking_swords_manager' && x.variant === 1,
    );
    e.grazepoints = (vortex || variantOne) ? 2 : 4;
    e.timepoints = 11;
    e.sprite_index = 'spr_pxwhite2';
    e.isBullet = true;
  },

  // The original counts this down in its DRAW event, not its Step, so the bar
  // survives exactly the drawn frames. KAIZO — slash Draw_0 line 2: the
  // destroy fires at timer == 2 (vanilla 3), one fewer active damage frame.
  endStep(e) {
    e.timer += 1;
    if (e.timer === 2) destroy(e);
  },

  other15: collidebulletOther15,
};

export const trackingSword = {
  name: 'obj_tracking_sword1',

  create(e, state) {
    e.timer = 0;
    e.con = 0;
    e.afterimagecon = 0;
    e.targetx = 0;
    e.targety = 0;
    e.variant = 0;
    e.image_alpha = 0;
    scrBulletInit(e);
    e.element = 5;
    e.fadetohalftime = 5;
    e.waittime = 10;
    e.fadetofulltime = 20;
    e.flashtime = 4;
    e.len = 120;
    e.lenstart = e.len;
    // KAIZO — sword1 Create_0 line 16: the frostveil flag. 0 = vanilla
    // heart-tracking; the manager sets 1 on spiral swords, which then anchor
    // to obj_growtangle instead of the heart (Step below).
    e.anomaly = 0;
    e.sprite_index = 'spr_roaringknight_sword_ol';
    e.image_xscale = 1;
    e.image_yscale = 1;
    // THE HOVERING SWORD IS A BULLET TOO. It has no Other_15 of its own, which
    // by the dump's own convention means it inherits obj_collidebullet's — the
    // same reasoning that puts obj_sword_tunnel_sword and
    // obj_tracking_sword_slash in the "counted" column in CLAUDE.md. And
    // `scr_bullet_init` leaves it `active = 1` with `grazepoints = 1`.
    //
    // Without this flag it was invisible to BOTH passes: the collision phase
    // skipped it (no other15) and the graze box could not see it (no isBullet),
    // so the sword you spend the whole attack manoeuvring around was the one
    // object on screen that could neither hurt you nor pay you TP.
    e.isBullet = true;
  },

  step(e, state) {
    const heart = state.soul;
    // NO SOUL, NO TARGET. obj_heart exists only during the bullet phase — the
    // Knight delivers it per turn via scr_moveheart and it is gone by the
    // party's menu — so a bullet that outlives its turn by a frame has
    // nothing to aim at. Skipping the frame leaves it where it was until the
    // turn sweep takes it; inventing a position would make it lunge at a soul
    // that is not there.
    //
    // KAIZO NOTE: an anomaly (frostveil) sword never dereferences obj_heart
    // in its Step, so the mod's GML would keep advancing `con` on a heartless
    // frame where this guard freezes. The window is the same turn-sweep
    // boundary the sim module's guard already accepts (a frame at most,
    // bullets swept immediately after); kept identical to the sim module.
    if (!heart) return;
    // NO SOUL, NO TRACKING. obj_heart exists only during the bullet phase —
    // the Knight delivers it per turn via scr_moveheart and it is gone by the
    // party's menu — so a sword that outlives its turn by a frame has nothing
    // to follow. Skipping the frame leaves it exactly where it was until the
    // turn sweep takes it, which is what the original's sweep does; inventing
    // a target position would make it lunge at a soul that is not there.
    if (!heart) return;

    // Tracking. It follows the soul right up until it commits at con 2 —
    // and it reads the soul's PRE-MOVE position: the recording's sword sits
    // at (soul_last_frame + 10) every frame it tracks (spawn f455: sword y
    // 154 with the soul already at 140, having been at 144). state.grazePrev
    // is exactly that value — obj_heart's position as of last frame, +10 on
    // both axes — maintained for the graze box, which lags the same way.
    //
    // KAIZO — sword1 Step_0 lines 1-13: the tracking anchor forks on
    // `anomaly`. 0 = the heart (vanilla, byte-identical); 1 = obj_growtangle
    // (the battle box), read LIVE — the spiral rings the box, not the player.
    if (e.con < 2) {
      if (e.anomaly === 0) {
        const aim = state.grazePrev ?? { x: heart.x + 10, y: heart.y + 10 };
        e.x = aim.x + lengthdirX(e.len, e.direction);
        e.y = clamp(
          aim.y + lengthdirY(e.len, e.direction),
          state.view.y + 40,
          state.view.y + 320,
        );
      }
      if (e.anomaly === 1) {
        // kaizo sword1 Step_0 lines 8-12. Same +10 offset and cameray()
        // clamp as the heart branch, on the box's live position.
        const gt = state.entities.find(
          (m) => m.alive && m.type.name === 'obj_growtangle',
        );
        if (gt) {
          e.x = gt.x + 10 + lengthdirX(e.len, e.direction);
          e.y = clamp(
            gt.y + 10 + lengthdirY(e.len, e.direction),
            state.view.y + 40,
            state.view.y + 320,
          );
        }
      }
    }

    if (e.con === 0) {
      e.timer += 1;
      if (e.timer === 1) cue(state, 'snd_knight_jump_quick', 1.3);
      e.image_alpha = lerp(0, 0.5, e.timer / e.fadetohalftime);
      // Exact equality, as the original has it: alpha lands on 0.5 at timer 5.
      if (e.image_alpha === 0.5) {
        e.con = 1;
        e.timer = 0;
      }
    }

    if (globalThis.process?.env?.KNIGHT_TRACK_DEBUG) {
      const f = globalThis.__simFrame;
      const [a, b] = globalThis.process.env.KNIGHT_TRACK_DEBUG.split('-').map(Number);
      if (f >= a && f <= (b ?? a)) {
        console.error(`[trk] f=${f} seq=${e.seq} con=${e.con} timer=${e.timer}`
          + ` len=${e.len} dir=${e.direction} x=${e.x}`);
      }
    }
    if (e.con === 1) {
      e.timer += 1;
      if (e.timer >= e.waittime) {
        const t = (e.timer - e.waittime) / e.fadetofulltime;
        e.image_alpha = lerp(0.8, 1, t);
        // `len` is re-lerped from its CURRENT value each frame, so it eases
        // out rather than moving linearly. (KAIZO kept the vanilla alpha/len
        // lines; the colour line below moved AFTER len in the mod's Step —
        // order preserved from the kaizo GML.)
        e.len = lerp(e.len, e.lenstart + 10, t);
        // KAIZO — sword1 Step_0 lines 35-51: THE TELEGRAPH RECOLOUR. The ramp
        // denominator is context-dependent (`_truefadetime`): 15 for the
        // variant-10 fast swords (pairs with their 5/5/10 timeline), 19/20
        // when a rotating slash is live (B-Side/A-Side — kaizo_sideb() is
        // state.kaizo?.sideb here), else the vanilla 30. And the target is
        // get_swordcolor() — c_blue by default — not c_red. Without it the
        // sword is white until it fires and the attack loses its only
        // warning. No RNG in any of it.
        let truefadetime = 30;
        if (e.variant === 10) {
          truefadetime = 15;
        } else if (state.entities.some(
          (m) => m.alive && m.type.name === 'obj_knight_rotating_slash',
        )) {
          truefadetime = state.kaizo?.sideb ? 19 : 20;
        }
        e.image_blend = mergeColor(WHITE, getSwordcolor(state), e.timer / truefadetime);
      }
      if (e.image_alpha === 1) {
        e.con = 2;
        e.timer = 0;
        // ONE growing ghost on the lock-on, not a per-frame trail.
        const a = spawn(state, afterimageGrow, { x: e.x, y: e.y });
        a.sprite_index = e.sprite_index;
        a.image_angle = e.image_angle;
        a.image_blend = e.image_blend;
        a.xrate = 0.2;
        a.yrate = 0.2;
        a.fade = 0.3;
      }
    }

    if (e.con === 2) {
      e.timer += 1;
      if (e.timer === e.flashtime + 1) {
        e.con = 3;
        e.timer = 0;
      }
    }

    if (e.con === 3) {
      e.timer += 1;
      if (e.timer === 1) {
        e.afterimagecon = 1;
        e.targetx = e.x + lengthdirX(900, e.direction + 180);
        e.targety = e.y + lengthdirY(900, e.direction + 180);
        cue(state, 'snd_knight_cut2', 1.3);
      }
      if (e.timer === 2) {
        const s = spawn(state, trackingSwordSlash, { x: e.x, y: e.y });
        s.image_angle = e.image_angle;
        s.direction = e.direction;
        s.damage = e.damage;
        const s2 = spawn(state, trackingSlashExtraGraze, { x: e.x, y: e.y });
        s2.image_angle = e.image_angle;
        s2.direction = e.direction;
        // variant 1 also seeds 27 obj_tracking_sword2 along the path; variant
        // 1 is not reached by ac 11 and is not translated yet. (KAIZO: still
        // unreached — no kaizo dispatch row launches type 151 at difficulty
        // 1; the sword2 block is byte-identical to vanilla in the mod.)
      }
      // KAIZO — sword1 Step_0 lines 109-112: the sword destroys at timer 4
      // (vanilla 5). One frame less of the dash afterimage; with the 2-frame
      // slash the whole resolution is one frame tighter.
      if (e.timer === 4) destroy(e);
    }
  },

  other15: collidebulletOther15,

  /**
   * `afterimagecon` walks 1 -> 2 -> 3, and the value selects which streak is
   * drawn: 1 is the full 40-copy launch trail, 2 is the same trail at half
   * alpha, 3 draws nothing. Without the advance it would be drawn every frame
   * for the rest of the sword's life.
   *
   * BEGIN STEP, NOT END STEP — and the difference is visible. The original
   * advances it at the BOTTOM of its Draw event: Draw READS the value, then
   * increments. So the frame the Step sets it to 1, Draw still sees 1.
   *
   * Advancing in endStep — the phase that otherwise stands in for Draw — runs
   * BEFORE the renderer, so the renderer would see 2 on that frame and 3 on the
   * next: the full-brightness streak, which is the whole effect, would never be
   * drawn at all. Advancing here instead means the increment lands on the
   * following frame, which is what "read then increment" actually means.
   *
   * The rule generalises: a Draw-event counter goes in endStep when the event
   * increments it BEFORE using it (obj_knight_roaring2's ball_counter and hsv,
   * the starchild's drawtimer), and in beginStep when it increments AFTER
   * (this, and roaring's star_flicker).
   */
  beginStep(e) {
    if (e.afterimagecon === 1 || e.afterimagecon === 2) e.afterimagecon += 1;
  },
};

export const trackingSwordsManager = {
  name: 'obj_tracking_swords_manager',

  // BEFORE THE VORTEX MANAGER. ac 15 creates the vortex controller first and
  // the tracking controller second; the runner steps newest-first, so the
  // game's tracking manager runs BEFORE the vortex's — its first telegraph
  // takes the earlier spawn seq on their shared birth frame (verify21j
  // f3366: oracle b2 is the telegraph, the sim's was the vortex's first
  // sword; the trajectories were identical and only the slot order
  // diverged). Every solo-tracking turn (ac 11/14) has no vortex to order
  // against, and soulPrev reads are snapshot-based, so the earlier slot is
  // safe there.
  stepOrder: -0.1,

  create(e, state) {
    e.timer = 0;
    e.con = 0;
    e.variant = 0;
    e.firstsword = false;
    e.multiswordmax = 0;
    e.multiswordframes = 0;
    e.multiswordcon = 0;
    e.multiswordcount = 0;
    e.setcount = 0;
    // KAIZO — manager Create_0 lines 10-12: the frostveil spiral state, and
    // the setdirection script array grows 50 -> 200 slots (the mod's long
    // 90/270 strings only reach index 22, but variant 11's endless turn
    // walks setcount far past vanilla's 50).
    e.shoutouttofrostveil = 0;
    e.anomalydir = 270;
    e.setdirection = new Array(200).fill(-1);
    // A COLLIDEBULLET IN ITS OWN RIGHT. The object's parent chain (dumped via
    // object_parents.csx) is obj_tracking_swords_manager -> obj_regularbullet -> the
    // collidebullet base — so the real game's bullet enumeration counts the
    // MANAGER itself, sitting at (growtangle.x, cameray()) from its creation
    // frame. The whole-fight differ pairs bullets by slot, and without this
    // flag every bullet of the turn sat one slot early against the recording
    // (turn 2's f450: oracle b0 is the manager, sim b0 was the first sword).
    // maskOff keeps it out of the collision and graze loops: parked at the
    // camera top it never touches the soul, and its own damage never fires.
    e.isBullet = true;
    e.maskOff = true;
    scrBulletInit(e);
    e.swordcount = 0;
    e.directionprev = new Array(8).fill(-1);
    e.wheelNudges = 0;
  },

  /** Other_10 — event_user(0), fired from the Create in the original.
   *  KAIZO appends eleven variant blocks after vanilla's 0/1/2/3 (Other_10
   *  lines 49-299); the trailing obj_dbulletcontroller retune scan and
   *  `timer = rate - 5` are byte-identical to vanilla. As in the sim module,
   *  the launch site sets `variant` first and calls this once — the game's
   *  double-init (Create's event_user(0) with variant 0, then the creator's)
   *  is equivalent because the variant-0 pass writes only fields every later
   *  pass overwrites, and no setdirection entries. */
  init(e, state, chainedType = null) {
    if (e.variant === 0) {
      e.rate = 32;
      e.ratedecay = 4;
      e.rateminimum = 16;
      e.maxswords = 99;
      e.multiswordmax = 0;
    }
    if (e.variant === 1) {
      // The original assigns a first set of values and then immediately
      // overwrites every one of them. Kept as-is: the dead assignments are
      // what the code does, and "tidying" them is how a divergence gets
      // introduced later.
      e.rate = 50;
      e.ratedecay = 10;
      e.rateminimum = 6;
      e.maxswords = 5;
      e.multiswordmax = 0;
      e.rate = 24;
      e.ratedecay = 0;
      e.rateminimum = 24;
      e.maxswords = 99;
      e.multiswordmax = 0;
    }
    if (e.variant === 2) {
      e.rate = 24;
      e.ratedecay = 0;
      e.rateminimum = 24;
      e.maxswords = 99;
      e.multiswordmax = 2;
      e.multiswordframes = 4;
      const set = [0, 45, 90, 135, 180, 225, 270, 315, 0, 45];
      for (let i = 0; i < set.length; i++) e.setdirection[i + 1] = set[i];
    }
    if (e.variant === 3) {
      e.rate = 20;
      e.ratedecay = 4;
      e.rateminimum = 13;
      e.maxswords = 99;
      e.multiswordmax = 0;
    }
    // ── KAIZO variant table, Other_10 lines 49-299. Fractional variants are
    // compared with gmlEq (GML `==` tolerance; the values are assigned
    // literals so === would hold today, but gmlEq is the project rule for
    // fractional reals). ──────────────────────────────────────────────────
    if (gmlEq(e.variant, 3.1)) {
      // kaizo Other_10 lines 49-56 — variant 3 a touch denser up front.
      e.rate = 18;
      e.ratedecay = 4;
      e.rateminimum = 13;
      e.maxswords = 99;
      e.multiswordmax = 0;
    }
    if (e.variant === 4) {
      // kaizo Other_10 lines 57-92 — paired spawns on the up-down string.
      e.rate = 24;
      e.ratedecay = 0;
      e.rateminimum = 24;
      e.maxswords = 99;
      e.multiswordmax = 2;
      e.multiswordframes = 4;
      if (state.kaizo?.sideb) {
        // lines 65-69: kaizo_sideb() — the pair burst becomes an endless
        // chain, one sword every 12 frames.
        e.multiswordframes = 12;
        e.multiswordmax = 99;
      }
      setUpDownString(e); // lines 70-91
    }
    if (e.variant === 5) {
      // kaizo Other_10 lines 93-101 — vanilla-0 cadence plus 2-frame pairs.
      e.rate = 32;
      e.ratedecay = 4;
      e.rateminimum = 16;
      e.maxswords = 99;
      e.multiswordmax = 2;
      e.multiswordframes = 2;
    }
    if (e.variant === 6) {
      // kaizo Other_10 lines 102-131 — slow-opening up-down rain.
      e.rate = 64;
      e.ratedecay = 2;
      e.rateminimum = 16;
      e.maxswords = 99;
      e.multiswordmax = 0;
      setUpDownString(e); // lines 109-130
    }
    if (gmlEq(e.variant, 6.1)) {
      // kaizo Other_10 lines 132-161 — the same string, gentler floor.
      e.rate = 40;
      e.ratedecay = 2;
      e.rateminimum = 30;
      e.maxswords = 99;
      e.multiswordmax = 0;
      setUpDownString(e); // lines 139-160
    }
    if (e.variant === 7) {
      // kaizo Other_10 lines 162-191.
      e.rate = 32;
      e.ratedecay = 2;
      e.rateminimum = 16;
      e.maxswords = 99;
      e.multiswordmax = 0;
      setUpDownString(e); // lines 169-190
    }
    if (gmlEq(e.variant, 7.1)) {
      // kaizo Other_10 lines 192-221 — THE PUPPET MANAGER. rate 9999 means
      // its own timer never fires; the kaizo rotating slash pokes
      // `with (obj_tracking_swords_manager) timer = rate - 2` to trigger a
      // spawn on ITS schedule (rotating-slash delta, not this file's).
      e.rate = 9999;
      e.ratedecay = 0;
      e.rateminimum = 9999;
      e.maxswords = 99;
      e.multiswordmax = 0;
      setUpDownString(e); // lines 199-220
    }
    if (gmlEq(e.variant, 7.2)) {
      // kaizo Other_10 lines 222-251.
      e.rate = 26;
      e.ratedecay = 2;
      e.rateminimum = 14;
      e.maxswords = 99;
      e.multiswordmax = 0;
      setUpDownString(e); // lines 229-250
    }
    if (e.variant === 8) {
      // kaizo Other_10 lines 252-281 — vanilla-0 cadence on the string.
      e.rate = 32;
      e.ratedecay = 4;
      e.rateminimum = 16;
      e.maxswords = 99;
      e.multiswordmax = 0;
      setUpDownString(e); // lines 259-280
    }
    if (e.variant === 10) {
      // kaizo Other_10 lines 282-289. Pairs with the Step's per-sword stat
      // override (fast telegraph, len 88).
      e.rate = 26;
      e.ratedecay = 4;
      e.rateminimum = 14;
      e.maxswords = 99;
      e.multiswordmax = 0;
    }
    if (e.variant === 11) {
      // kaizo Other_10 lines 290-299 — FROSTVEIL ("shoutouttofrostveil").
      // Endless: multiswordcount never reaches 9999, so once the first sword
      // fires the 2-frame multisword chain never closes — a sword every 2
      // frames, spiralling via anomalydir, until the turn clock (< 70) shuts
      // the manager off.
      e.rate = 13;
      e.ratedecay = 0;
      e.rateminimum = 13;
      e.maxswords = 9999;
      e.multiswordmax = 9999;
      e.multiswordframes = 2;
      e.shoutouttofrostveil = 1;
    }

    // Chained launches retune the cadence: rotatingslash (104) makes it much
    // sparser, the sword vortex (154) keeps it dense. The dump's Other_10
    // scans live obj_dbulletcontroller instances for the sibling's type; the
    // sim spawns its managers directly and has no dc entities to find, so
    // the launch site passes the sibling type in (`chainedType`) — the
    // entity scan stays for any scene that does model the controllers.
    // Without this, ac 15's tracking ran rate 32 and its second sword came
    // at +33 instead of the recording's +25 (verify21j f3386).
    // (KAIZO: the scan is byte-identical to vanilla — Other_10 lines 300-325
    // still check only types 104 and 154, so the mod's chainedType 102/152/
    // 153 rows deliberately keep their variant table untouched.)
    if (chainedType === 104 || chainedType === 154) {
      e.rate = chainedType === 104 ? 55 : 24;
      e.ratedecay = chainedType === 104 ? 0 : 4;
      e.rateminimum = chainedType === 104 ? 24 : 16;
      e.maxswords = 99;
      e.multiswordmax = 0;
      if (chainedType === 104) e.multiswordframes = 0;
    }
    for (const dc of state.entities) {
      if (!dc.alive || dc.type.name !== 'obj_dbulletcontroller') continue;
      if (dc.dcType === 104) {
        e.rate = 55;
        e.ratedecay = 0;
        e.rateminimum = 24;
        e.maxswords = 99;
        e.multiswordmax = 0;
        e.multiswordframes = 0;
      }
      if (dc.dcType === 154) {
        e.rate = 24;
        e.ratedecay = 4;
        e.rateminimum = 16;
        e.maxswords = 99;
        e.multiswordmax = 0;
      }
    }

    e.timer = e.rate - 5;
  },

  step(e, state) {
    // The manager stops feeding the turn well before it ends.
    if (state.turntimer < 70) return;

    // KAIZO — manager Step_0 line 5: `_checkswd`, latched BEFORE the spawn so
    // the reroll loop below sees the manager population as of this line.
    const checkswd = managerCount(state) > 1;
    e.timer += 1;
    // KAIZO — manager Step_0 line 7: the spiral heading snapshot.
    const trueanomdir = e.anomalydir;
    const fire =
      (e.timer === e.rate && e.swordcount <= e.maxswords) ||
      (e.timer === e.multiswordframes && e.multiswordcon === 1);
    if (!fire) return;

    const inst = spawn(state, trackingSword, { x: e.x, y: e.y });
    // KAIZO — manager Step_0 lines 11-12: variant/damage are assigned BEFORE
    // the direction now (vanilla order was direction, variant, damage). Two
    // non-RNG statements moved — the draw count is unchanged.
    inst.variant = e.variant;
    inst.damage = e.damage;

    if (e.shoutouttofrostveil === 1) {
      // KAIZO — manager Step_0 lines 13-18: FROSTVEIL. No RNG AT ALL — the
      // sword takes the snapshotted spiral heading and the spiral advances
      // 20°/sword (18 swords to a full ring, starting straight down at 270).
      // ZERO draws is load-bearing for stream alignment across the spiral
      // section: do not "consume anyway" here.
      inst.anomaly = 1;
      inst.direction = trueanomdir;
      e.anomalydir += 20;
    } else {
      // Past the end of a replayed list, fall back to the live stream: a
      // spawn-count divergence in a later turn must show up as a diff, not as
      // an undefined direction crashing the trace.
      // THE CHOOSE IS CONSUMED EITHER WAY. The game rolls
      // `choose(0,45,...,315)` for every sword; the replay only substitutes
      // the OUTCOME (the post-wheel heading the oracle logged). Skipping the
      // draw under replay left the anchored stream one short per sword —
      // invisible on tracking-only turns, but ac 15's vortex rolls its second
      // centermove target from the same stream and verify21j f3423 read
      // irandom(120)=54 at the sim's position where the game (three swords
      // in) drew 65 three positions later.
      const rolledHeading = state.gmlRng ? gmlChoose(state.gmlRng, HEADINGS) : null;
      inst.direction = state.swordDirections && state.swordIndex < state.swordDirections.length
        ? state.swordDirections[state.swordIndex++]
        : rolledHeading;

      // KAIZO — manager Step_0 lines 22-43: the MULTI-MANAGER ANTI-OVERLAP
      // REROLL. When 2+ managers coexist, reroll the heading while any OTHER
      // pre-first-step sword (`timer == 0 && con == 0` — spawned since its
      // last step opportunity, i.e. this frame by an earlier manager or last
      // frame) already holds it. Each reroll iteration consumes one choose()
      // draw — the stream cost is real and unbounded, exactly as the GML's.
      let already = -1;
      const mysword = inst;
      let mydir = inst.direction;
      if (checkswd) {
        let spins = 0;
        while (already !== 0) {
          already = 0;
          for (const s of state.entities) {
            if (s.alive && s.type.name === 'obj_tracking_sword1'
              && s !== mysword && s.timer === 0 && s.con === 0
              && s.direction === mydir) {
              already = 1;
            }
          }
          if (already === 1) {
            if (!state.gmlRng) break; // no stream, no reroll — cannot hang
            mydir = gmlChoose(state.gmlRng, HEADINGS);
          }
          // The GML loop has no bound: with all eight octants held by fresh
          // swords it would hang the real game too. The mod's dispatch runs
          // at most a handful of managers, so this is unreachable; be loud
          // rather than silent if a scene ever gets there.
          if (++spins > 1000) {
            throw new Error('tracking-swords kaizo reroll: all octants held (unreachable in the mod)');
          }
        }
      }
      inst.direction = mydir;
    }

    // KAIZO — manager Step_0 lines 45-56: variant 10's per-sword override.
    // Telegraph compressed to fade 5 / wait 5 / full 10 / flash 4 (24-frame
    // read instead of 39) at radius 88 instead of 120.
    if (e.variant === 10) {
      inst.fadetohalftime = 5;
      inst.waittime = 5;
      inst.fadetofulltime = 10;
      inst.flashtime = 4;
      inst.len = 88;
      inst.lenstart = 88;
    }

    // ANTI-REPEAT. Nudge the heading by 45 until it is not one the last few
    // swords used. The `repeat (8)` around it lets a heading walk several
    // steps when the wheel is crowded.
    //
    // KAIZO — manager Step_0 lines 57-69: the wheel now runs ONLY in the
    // single-manager case (`instance_number(obj_tracking_swords_manager) <=
    // 1`) — with 2+ managers the reroll loop above replaces it. Note the GML
    // gate applies to frostveil spawns too: the wheel scans the spiral's
    // heading against directionprev, and never actually nudges one (eight
    // consecutive multiples of 20 are distinct, and an exact revisit is 18
    // spawns away — long past the 8-slot window), but the code runs.
    //
    // SKIPPED when the replayed directions are POST-wheel: the whole-fight
    // recording logs each sword's direction as first sighted — after the
    // game's own wheel already ran — so running the wheel again here could
    // double-nudge a value into a heading the game never used. The raw
    // choose() sits at an unresolved offset into the anchored stream (some
    // consumer between the spawns is unaccounted), which is exactly why the
    // whole-fight replays these like the shuffle and the bolt schedules.
    if (managerCount(state) <= 1) {
      if (!state.swordDirectionsPostWheel) {
        for (let r = 0; r < 8; r++) {
          for (let i = 0; i < 8; i++) {
            if (inst.direction === e.directionprev[i]) {
              inst.direction += 45;
              // Instrumentation, not behaviour: a nudge that never happens is
              // indistinguishable from a wheel that had nothing to fix, and
              // this whole mechanism is invisible in the oracle traces (they
              // replay post-wheel headings). verify-tracking-wheel asserts on
              // it.
              e.wheelNudges = (e.wheelNudges ?? 0) + 1;
            }
          }
        }
      }
    }

    inst.image_angle = inst.direction + 180;
    e.directionprev[e.swordcount] = inst.direction;

    // Forget the three slots ahead, so the wheel reopens behind the sword.
    for (let i = 1; i < 4; i++) {
      let a = i + e.swordcount;
      if (a > 7) a -= 7;
      e.directionprev[a] = -1;
    }

    e.swordcount += 1;
    if (e.swordcount > e.maxswords && e.variant === 0) state.turntimer = 70;
    if (e.swordcount > e.maxswords && e.variant === 1) state.turntimer = 120;
    if (e.swordcount > 7 && e.swordcount < e.maxswords) e.swordcount = 0;

    e.setcount += 1;
    // The KAIZO array is EXACTLY 200 slots (`for (i = 0; i < 200; i++)`,
    // Create_0 line 12 — vanilla's 50, widened for the mod's long turns), and
    // an out-of-range read would hard-error the real game. The mod's longest
    // string is variant 11's (a sword every 2 frames), which tops out around
    // setcount ~195 on its 460-frame turn — inside the array, and the modder
    // sized it that way. As in the sim module, out of range here means "past
    // the scripted opening" — no override, no crash. (An `undefined` read
    // would have been treated as a scripted override and NaN'd the heading —
    // the sim module's own war story.)
    const setdir = e.setcount < 200 ? e.setdirection[e.setcount] : -1;
    if (setdir !== -1) inst.direction = setdir;

    if (e.multiswordmax > 0) e.multiswordcount += 1;
    if (e.multiswordcon === 0 && e.multiswordmax > 0) e.multiswordcon = 1;
    if (e.multiswordcon === 1 && e.multiswordcount === e.multiswordmax) {
      e.multiswordcon = 0;
      e.multiswordcount = 0;
    }

    // Place it around the soul. Note this runs AFTER setdirection may have
    // overridden the heading, so the two always agree.
    //
    // KAIZO NOTE: this reposition is byte-identical to vanilla (Step_0 lines
    // 112-118) and UNQUALIFIED — a frostveil (anomaly) sword is ALSO born
    // heart-anchored here, and only re-anchors to the battle box on its own
    // first Step. Preserved: the spiral's swords visibly snap from the
    // player's ring to the box's ring one frame after birth in the mod too.
    const heart = state.soul;
    // NO SOUL, NO TARGET. obj_heart exists only during the bullet phase — the
    // Knight delivers it per turn via scr_moveheart and it is gone by the
    // party's menu — so a bullet that outlives its turn by a frame has
    // nothing to aim at. Skipping the frame leaves it where it was until the
    // turn sweep takes it; inventing a position would make it lunge at a soul
    // that is not there.
    if (!heart) return;
    // NO SOUL, NO TRACKING. obj_heart exists only during the bullet phase —
    // the Knight delivers it per turn via scr_moveheart and it is gone by the
    // party's menu — so a sword that outlives its turn by a frame has nothing
    // to follow. Skipping the frame leaves it exactly where it was until the
    // turn sweep takes it, which is what the original's sweep does; inventing
    // a target position would make it lunge at a soul that is not there.
    if (!heart) return;
    // Same pre-move read as the tracking loop above — the newborn sword's
    // first traced position already lags the soul by one movement step.
    // NO CLAMP HERE: the recording's sword can be born above the tracking
    // clamp's ceiling (b2 at y=38 with the floor at cameray()+40) — only the
    // Step's own positioning line clamps.
    {
      const aim = state.grazePrev ?? { x: heart.x + 10, y: heart.y + 10 };
      inst.x = aim.x + lengthdirX(inst.len, inst.direction);
      inst.y = aim.y + lengthdirY(inst.len, inst.direction);
    }
    inst.ystart = inst.y;
    inst.image_angle = inst.direction + 180;

    if (globalThis.process?.env?.KNIGHT_TRACKING_DEBUG) {
      console.error(`[trk] f=${state.frame} variant=${e.variant}`
        + ` dir=${inst.direction} rate=${e.rate} swordcount=${e.swordcount}`
        + ` setcount=${e.setcount} tt=${state.turntimer}`);
    }

    e.rate -= e.ratedecay;
    if (e.rate < e.rateminimum) e.rate = e.rateminimum;
    e.timer = 0;
  },
};
