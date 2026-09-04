// KAIZO obj_knight_stream + obj_bullet_knight_stream (+ unchanged
// obj_knight_streamline) — the mod's Knight stream / "XAttacks", reached
// through obj_dbulletcontroller `type = 103` (dispatch: obj_knight_enemy
// Other_23, myattackchoice 107, "xattacks").
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission. (kaizo/HANDOFF.md §5 V-C publish gate.)
//
// PROVENANCE — translated against the kaizo v2.3.3 dump
// (knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/):
//   gml_Object_obj_knight_stream_Create_0.gml         (8 lines)
//   gml_Object_obj_knight_stream_Step_0.gml           (90 lines)
//   gml_Object_obj_bullet_knight_stream_Create_0.gml  (hitbox child + lsnd)
//   gml_Object_obj_bullet_knight_stream_Step_0.gml    (beam hitbox + spray)
//   gml_Object_obj_bullet_knight_stream_CleanUp_0.gml (NEW in kaizo)
// plus the delta specs in knight-research/kaizo-mod/deltas/ with the same
// names. Base copy: sim/attacks/knight-stream.js (the VERIFIED module) —
// where the mod did not change a line, this file keeps the sim's line.
// obj_knight_streamline and the vanilla stream diamond are BYTE-IDENTICAL
// in the mod (diffed against gml_vanilla_v105) and are re-exported from the
// sim module rather than copied.
//
// obj_astream (task list): audio-stream teardown guard + a Step that is
// `exit;` — audio lifecycle only, never referenced by the stream attack's
// gameplay. Nothing to translate (deltas/gml_Object_obj_astream_*.md agree).
//
// WHAT DIVERGES FROM THE SIM MODULE (each site carries its kaizo file:line):
//   * Create: slash_angle 90 ± irandom_range(-145,145) (vanilla ±45); the
//     controller is now a VISIBLE knight pose — image_index lerp 0->1/10f,
//     imgtarget sentinel, fulltimer clock, init flag.
//   * Step: damage pinned 153 every frame; init block dist_diff 54 /
//     time_diff 3 / slash_amt 5 (Side B: 48 / 2); pose driver
//     scr_approach(image_index, imgtarget, 1); at each slash the pose
//     teleports (image_index 3) and the body lerps to xstart±12 / ystart±48
//     over 6f ease-out(2); generalized 5-pair streamline cascade at
//     timer 22 + i*time_diff, offset dist_diff*i (i=0 fires a COINCIDENT
//     pair at offset 0); cycle restart at timer 45 (Side B 42) gated on
//     global.turntimer > 16; slash_angle wrap threshold 70 -> 170;
//     turn-end handshake — turntimer pinned at 16 while beams live, pose
//     reset + fly-back to obj_knight_enemy at turntimer == 12.
//   * Beam (obj_bullet_knight_stream): now a REAL bullet — the mod
//     reparents it to obj_regularbullet (object-data probe:
//     scratchpad object_parents_kaizo.json; vanilla parent is NONE) and its
//     Create calls scr_bullet_init(), latches active = false, and spawns a
//     child obj_regularbullet HITBOX (spr_roaringknight_finalslash_mask,
//     xscale 32, yscale 0, damage 62, destroyonhit/wall_destroy false).
//     Step arms the hitbox from timer 20: damage 52, xscale 64,
//     yscale min(width,23)/10, angle = beam direction, and a MANUAL damage
//     path — heart mask swapped to spr_dodgeheart_smaller_2px_mask,
//     place_meeting, scr_damage + event_user(5), the obj_shake dance, then
//     global.inv = 2 (only 2 inv frames: ~52 every 3rd frame parked in the
//     beam). Spray doubled (% 8 -> % 4), window 40 (Side B 37), offsets
//     from the controller's dist_diff (vanilla fixed 60), bullets are gray
//     sword sprites (spr_roaringknight_sword_ol) at damage 153,
//     grazepoints 1, timepoints 0, friction -0.8 (accelerating),
//     destroyonhit false. New CleanUp destroys the hitbox and stops the
//     laser loop.
//
// THE TYPE-103 DAMAGE CONFLICT (INDEX.md open question 7) — RESOLVED by
// assignment order, read from the kaizo dump:
//   obj_knight_enemy Other_23 (ac 107):    dc.type = 103; dc.damage = 206;
//   obj_dbulletcontroller Step type==103:  scr_bullet_inherit(knight_stream);
//                                          damage = 306;      // AFTER
//   (gml_Object_obj_dbulletcontroller_Step_0.gml:2168-2183)
// scr_bullet_inherit runs BEFORE `damage = 306`, so the stream inherits the
// dispatch's 206 for its create frame only; 306 lands on the controller
// AFTER its one-shot `made` block and nothing ever inherits from it again —
// 306 IS DEAD CODE. From the stream's first Step onward `damage = 153` is
// pinned every frame (kaizo knight_stream Step_0:3), and every damaging
// child sets its own value (beam hitbox 62 -> 52/frame, spray swords 153),
// so neither 206 nor 306 ever reaches a player. This module asserts 153.
//
// PURE-VISUAL DELTAS (renderer work later, NO RNG consumed — both Draw
// events grep clean of random/choose):
//   * knight_stream Draw_0: the pose sprite drawn with a sine bob
//     (fulltimer * 0.1, amp min(global.turntimer, 8)) and an scr_afterimage
//     every 2nd fulltimer frame (alpha 0.6, fade 0.04, hspeed 3).
//   * bullet Draw_0: byte-identical to vanilla.
//   * beam hitbox visible = false / alpha 0; spray swords visible = false
//     (the manager draws them clipped to the box).
//   LANDED (the "renderer work later" above): the pose is painted by
//   kaizo/render/draw/stream.js drawObjKnightStream (the kaizo page's Draw
//   override); the afterimage is STATE — a real obj_afterimage instance the
//   Draw creates — so it lives on knightStream's `draw` slot below
//   (sim/index.js "THE DRAW SLOT": after endStep, where GameMaker runs Draw),
//   and the pose sprite the Draw reads is assigned in create from the object
//   definition (the CLAUDE.md `sprite_index` hole — no event names it).
//   Still no RNG: the ghost's create draws nothing from the stream.
//
// THE BLUE TINT — NO LONGER SKIPPED (was deferred; now applied, zero draws):
//   * the beam lines are recolored get_swordcolor() with a
//     merge_color(get_swordcolor(), c_black, 0.5) inner layer (kaizo Draw_0:26,
//     35, 41 — vanilla c_red / c_maroon). Computed in knightStream's endStep
//     and stored on each beam (image_blend / blend2) so the renderer reads the
//     colour; the palette is imported from kaizo-colors.js, never redefined.
//   * the spray swords' `image_blend = c_gray` (bullet Step_0:85/99) now
//     carries sim/gml.js's GRAY triple instead of the string 'c_gray', which
//     no renderer could tint with.
//
// AUDIO (cue layer, no sim effect): snd_knight_cut on each slash;
// snd_knight_laser sustained at (vol .6, pitch .3) bending -0.01/frame;
// snd_wing stop + triple play (pitch 1.25/.75/.5) per spray volley.
//
// ENGINE-COLLISION NOTE. The beam itself and its hitbox never damage or
// graze through the ENGINE path in the mod: the beam's sprite is
// spr_nothing (no mask -> no pairing) and the hitbox holds active = false
// forever, which gates both obj_collidebullet's Other_15 damage and
// obj_grazebox's `if (!other.active) exit;`. The manual place_meeting path
// in the beam's Step is the ONLY live damage route, so this translation
// gives neither type an other15 — observationally identical, and it keeps
// the unmasked-bullet counter honest. The spray swords use the engine
// default exactly like the vanilla diamonds did.
//
// The mod's own scr_damage deltas (scr_kaizo_target weighted targeting,
// Side-B gloom, universal -999 swoon, no Flurry soften, Noelle x0.5,
// practicemode HP pin) are the damage/economy-layer work item (INDEX item
// 14); the beam tick routes through the sim's scrDamageSingle until that
// lands — flagged in this task's open[].

import { spawn, destroy } from '../../sim/entity.js';
import {
  lengthdirX, lengthdirY, scrApproach, gmlEq, mergeColor, BLACK, GRAY,
} from '../../sim/gml.js';
import { gmlIrandomRange, gmlIrandom, gmlChoose, gmlRandomRange } from '../../sim/rng.js';
import { scrBulletInit, regularbulletCreate, regularbulletStep, collidebulletOther15 } from '../../sim/bullets/regularbullet.js';
import { SWORDOL_MASK, enginePairHit, masksOverlap } from '../../sim/masks.js';
import { kaizoMask } from '../data/masks.js';
import { getSwordcolor } from './kaizo-colors.js';
import { scrDamageSingle } from '../../sim/damage.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { scrAfterimage } from '../../sim/fx.js';
import { cue, cueSustain, cueTune, cueStop } from '../../sim/audio.js';

// Unchanged objects, re-exported so the launcher swaps only the import
// source: obj_knight_streamline and the vanilla diamond are byte-identical
// between gml_vanilla_v105 and gml_kaizo_dump (diffed 2026-08-28). The
// diamond is UNUSED by the kaizo stream (the spray is swords now) but the
// symbol survives for import parity.
export { knightStreamline, streamDiamond } from '../../sim/attacks/knight-stream.js';
import { knightStreamline } from '../../sim/attacks/knight-stream.js';

/** `kaizo_sideb()` as an arithmetic 0/1, the way the GML multiplies it. */
function sideb(state) {
  return state.kaizo?.sideb ? 1 : 0;
}

/**
 * `spr_roaringknight_finalslash_mask` — NEW kaizo-mod sprite, extracted from
 * data-kaizo.win (tools/patches/extract_mask.csx):
 *
 *     w=10 h=10 ox=5 oy=5  bbox=[0,0,9,9]  sepmasks=Precise maskcount=0
 *
 * maskcount = 0: the sprite ships NO pixel mask data, so the runner falls
 * back to its bounding box — a solid, CENTRED 10x10 square (same family as
 * spr_dodgeheart / spr_grazemask, whose maskcount-0 rects the calibrated
 * model already reproduces). At the armed transform (xscale 64,
 * yscale min(width,23)/10) that is a rotated bar 640px long and up to 23px
 * thick, centred on the beam's spawn point.
 */
export const FINALSLASH_MASK = {
  name: 'spr_roaringknight_finalslash_mask',
  w: 10,
  h: 10,
  originX: 5,
  originY: 5,
  bbox: [0, 0, 9, 9],
  px: Array.from({ length: 10 }, () => new Array(10).fill(true)),
};

/**
 * An extracted mask, given the `px` boolean grid sim/masks.js's samplers walk.
 *
 * kaizo/data/masks.js stores rows as '0'/'1' strings and its `kaizoMask()`
 * hands back THE SAME OBJECT on every call, in every importer (ES modules are
 * singletons). Deriving the grid ONTO that object rather than into a copy is
 * what makes this mask one shared value across modules — knight-stream.js,
 * swordfall.js and underbox.js all hold the identical reference — so
 * `state.soul.mask === ...` tests and underbox's restoreHeartMask() hold no
 * matter which attack stamped it. Idempotent and additive; regenerating
 * kaizo/data/masks.js drops the memo and the next call rebuilds it.
 */
function maskWithPx(m) {
  if (!m.px) m.px = m.rows.map((r) => Array.from(r, (c) => c === '1'));
  return m;
}

/**
 * `spr_dodgeheart_smaller_2px_mask` — the mod's tighter soul hurtbox for the
 * beam check only. READ from the extraction (kaizo/data/masks.js, packed by
 * kaizo/tools/pack-kaizo-sprites.mjs, not hand-built): 20x20, origin (0,0),
 * Precise with real pixel data, bbox [4,4]..[15,15] — a shrunken heart shape
 * inset 2px beyond the vanilla precise mask's [2,2]..[17,17]. The hand-built
 * copy this replaces happened to be geometrically right; swordfall.js's was
 * not (it used the ART sprite spr_dodgeheart_smaller_2px, a rect), which is
 * why all three now read the one extracted object.
 *
 * The beam's Step swaps obj_heart onto it for ONE place_meeting and restores
 * the old mask the same frame, so this never touches the engine's live heart
 * mask here either — it is passed straight into the overlap test.
 */
export const HEART_2PX_MASK = maskWithPx(kaizoMask('spr_dodgeheart_smaller_2px_mask'));

/**
 * The beam's `place_meeting(x, y, obj_heart)` with the heart swapped onto
 * the 2px mask (kaizo bullet Step_0:30-34, 47). Same A/B orientation as
 * enginePairHit — the soul never rotates or scales, so it is the A side of
 * the calibrated sampler and the hitbox carries the transform.
 */
export function beamPlaceMeetingHeart(hb, heart) {
  return masksOverlap(
    HEART_2PX_MASK, heart.x, heart.y,
    FINALSLASH_MASK, hb.x, hb.y,
    hb.image_xscale ?? 1, hb.image_yscale ?? 1, hb.image_angle ?? 0,
  );
}

/**
 * The beam's child hitbox — a bare `obj_regularbullet` in the mod (kaizo
 * bullet Create_0:20). It holds `active = false` for its whole life, which
 * gates the inherited Other_15 AND the graze event, so it carries no
 * other15 here (see the header's engine-collision note): the manual
 * place_meeting path in the beam's Step is its only live route, exactly as
 * in the mod.
 */
export const streamHitbox = {
  name: 'obj_bullet_stream_hitbox',

  create(e, state) {
    regularbulletCreate(e, state);
  },

  step: regularbulletStep,
};

/** The doubled spray's sword — `obj_regularbullet` fired with
 *  spr_roaringknight_sword_ol (kaizo bullet Step_0:78, 92). Same shape as
 *  the vanilla module's streamDiamond, different sprite and stats. */
export const streamSword = {
  name: 'obj_bullet_stream_sword',

  create(e, state) {
    regularbulletCreate(e, state);
    // scr_fire_bullet arg5 — spr_roaringknight_sword_ol (kaizo Step_0:78).
    e.sprite_index = 'spr_roaringknight_sword_ol';
    // `visible = false` — the manager draws every obj_regularbullet itself,
    // CLIPPED TO THE BOX (and c_gray-tinted — kaizo Step_0:86); an unclipped
    // instance draw would put swords outside the arena. Renderer honours it.
    e.visible = false;
    e.isBullet = true;
    e.builtinMotion = true;
  },

  step: regularbulletStep,

  collides(e, heart) {
    if (e.active !== 1 && e.active !== true) return false;
    return enginePairHit(heart, e, SWORDOL_MASK);
  },

  other15: collidebulletOther15,
};

/**
 * obj_bullet_knight_stream's NEW CleanUp (kaizo CleanUp_0, whole event):
 *
 *     if (i_ex(hitbox)) instance_destroy(hitbox);
 *     if (audio_is_playing(lsnd)) audio_stop_sound(lsnd);
 *
 * The engine has no CleanUp hook, so the beam's own timer-50 death calls
 * this inline. An EXTERNAL destroy (the turn sweep) does not route through
 * it — the sweep kills the hitbox in the same pass, and the launcher owns
 * stopping a leaked laser loop on teardown (see this task's open[]).
 */
export function bulletKnightStreamCleanUp(e, state) {
  if (e.hitbox && e.hitbox.alive) destroy(e.hitbox);
  // audio_is_playing(-4) is false, so the guard is safe pre-arm; a finished
  // sample makes the stop a no-op in the renderer, matching the original.
  if (e.lsnd !== -4) cueStop(state, 'snd_knight_laser');
}

/** obj_bullet_knight_stream — one arm of the cross. KAIZO: a real bullet
 *  whose child hitbox damages on contact; sheds sword spray. */
export const bulletKnightStream = {
  name: 'obj_bullet_knight_stream',

  create(e, state) {
    // KAIZO Create_0:1-2 — scr_bullet_init() and the active latch. The mod
    // also reparents this object to obj_regularbullet (object-data probe),
    // so it lives in the bullet system now; active stays false for life,
    // which gates every engine damage/graze path (header note).
    scrBulletInit(e);
    e.active = false;
    e.x1 = e.x;
    e.y1 = e.y;
    e.x2 = e.x;
    e.y2 = e.y;
    e.width = 8;
    e.width_goal = 8;
    e.line_length = 0;
    e.timer = 0;
    e.can_do_slashes = true;
    // instance_create leaves the beam at obj_bullet_knight_stream's
    // DEFINITION depth, 0 (object_depth probe on data-kaizo.win) — assigned
    // so `hitbox.depth = other.depth - 1` below has a number to read
    // (HANDOFF §8: an unassigned depth base is NaN).
    e.depth = 0;
    // KAIZO Create_0:20-35 — hitbox = instance_create(x, y, obj_regularbullet)
    // + the with-block. The spawner sets `direction` AFTER instance_create,
    // so `image_angle = other.direction` here reads the DEFAULT 0 — a stale
    // angle, corrected every armed frame by the Step. Faithful, and inert
    // either way: image_yscale is 0 until timer 20.
    const hb = spawn(state, streamHitbox, { x: e.x, y: e.y });
    e.hitbox = hb;
    e.lsnd = -4; // no sound yet (kaizo Create_0:21); becomes the live pitch
    hb.active = false;
    hb.sprite_index = 'spr_roaringknight_finalslash_mask';
    hb.visible = false;
    hb.destroyonhit = false;
    hb.wall_destroy = false;
    hb.damage = 62;
    hb.grazepoints = 1;
    hb.timepoints = 0;
    hb.image_xscale = 32;
    hb.image_yscale = 0;
    hb.image_angle = e.direction;
    hb.depth = 0; // obj_regularbullet definition depth (object_depth probe)
    e.isBullet = true; // parent obj_regularbullet in the mod's object data
  },

  step(e, state) {
    e.timer += 1;
    if (e.timer === 20) {
      // `line_width = 0` — assigned and read NOWHERE in the dump.
      // ORIGINAL BUG, the `linex`/`splitbox` family. Kept as a no-op.
      // KAIZO Step_0:5 — lsnd = snd_play(snd_knight_laser, 0.6, 0.3):
      // volume 0.6, pitch 0.3 (snd_play arg order), bent below.
      e.lsnd = 0.3;
      cueSustain(state, 'snd_knight_laser', 0.3, 0.6);
    }
    if (e.timer >= 20 && e.timer < 40) {
      if (e.timer < 24) {
        e.width_goal = 64 + Math.sin(e.timer * 2.35) * 16;
      } else {
        e.width_goal = 32 + Math.sin(e.timer * 2.35) * 16;
      }
    } else if (e.timer >= 40) {
      e.width_goal = 0;
    } else if (e.timer > 8) {
      e.width_goal = 0;
    }

    // KAIZO Step_0:26-68 — THE BEAM IS A DAMAGING HITBOX from timer 20 to
    // death: heart mask swapped to the 2px mask for ONE place_meeting,
    // manual scr_damage at 52, and global.inv = 2 — a soul parked in the
    // beam takes ~52 every 3rd frame.
    if (e.timer >= 20) {
      // audio_sound_pitch(lsnd, audio_sound_get_pitch(lsnd) - 0.01)
      // (Step_0:28) — the laser sags in pitch every frame it is armed.
      e.lsnd = e.lsnd - 0.01;
      cueTune(state, 'snd_knight_laser', e.lsnd);
      const _width = Math.min(e.width, 23); // Step_0:29
      const hb = e.hitbox;
      // `with (hitbox)` iterates nothing once the instance is gone.
      if (hb && hb.alive) {
        hb.damage = 52; // overrides Create's 62 every armed frame (Step_0:37)
        hb.visible = false;
        hb.image_alpha = 0;
        hb.depth = e.depth - 1;
        hb.image_xscale = 64;
        hb.image_yscale = _width / 10;
        hb.image_angle = e.direction;
        hb.target = 0;
        if (state.invTimer < 0) { // global.inv < 0 (Step_0:45)
          // place_meeting(x, y, obj_heart) with the heart on the 2px mask
          // (Step_0:30-34, 47) — the swap-and-restore collapses to passing
          // the mask straight into the calibrated sampler.
          // THE SOUL'S PRE-STEP POSITION, not its current one.
          // obj_bullet_knight_stream is OBJECT INDEX 140 and obj_heart is
          // 1462, so the game runs this place_meeting BEFORE the heart's
          // `x += px` (obj_heart Step_0:241-242) and it always tests where the
          // soul was at the START of the frame. This lane steps OLDEST FIRST
          // (kaizo-fight.js: `stepNewestFirst` is deliberately not set), and
          // the soul is the oldest object in the fight, so by the time a beam
          // born mid-turn steps, `state.soul` has already moved. Same per-read
          // compensation as the tunnel sword's probe and the splitter's split
          // flag -- kaizo-fight.js's own note: "the one measured handoff is
          // emulated at its site".
          //
          // MEASURED, _tok3. The hitbox is frozen at x 320, y 196,
          // image_xscale 64, image_yscale 2.2999999523, image_angle 205/335 --
          // byte-identical in both bullets sheets -- and this probe is FALSE at
          // soul x 222, TRUE at x 226. The soul is 222 on f8721 and 226 on
          // f8722, so reading the live position fired a frame early: inv 2 at
          // f8722 where the recording has -23 and takes the tick on f8723.
          //
          // TWO-SIDED, not a single-frame fit. Replayed over all five
          // armed-beam windows against the recording's own soul path and inv
          // column, the pre-step read reproduces every tick (8723, 8739, 8777,
          // 8780, 8783, 8786) and the live read gets two wrong in OPPOSITE
          // directions: a spurious hit at f8722 and a MISSED hit at f8780,
          // where the soul moves on y instead of x. A tighter mask would fix
          // the first and worsen the second; only the read convention explains
          // both.
          const heart = state.soul;
          const heartPos = state.soulPrev ?? heart;
          if (heart && heart.alive && beamPlaceMeetingHeart(hb, heartPos)) {
            // The obj_shake dance (Step_0:49-59): remember whether a shake
            // existed, scr_damage() (which spawns one), and destroy the new
            // one if none pre-existed — beam ticks do not screen-shake. The
            // shake dies before its first Step, so the view never moves.
            const hadShake = state.entities.some(
              (s) => s.alive && s.type.name === 'obj_shake',
            );
            // scr_damage() reads the CALLER's damage/target — 52, single
            // target. Routed through the sim's scr_damage (scrDamageSingle:
            // Kris redirect, mantle brunt, its choose() draws); the mod's
            // own scr_damage deltas are the economy-layer item — open[].
            scrDamageSingle(state, hb.damage, hb.target);
            // event_user(5) — the inherited Other_15. active === false and
            // global.inv just went >= 0, so every branch is gated off; run
            // for faithfulness (it is a no-op by the same gates the mod's is).
            collidebulletOther15(hb, state);
            if (!hadShake) {
              // instance_destroy(obj_shake) — all instances (Step_0:56-58).
              for (const s of state.entities) {
                if (s.alive && s.type.name === 'obj_shake') destroy(s);
              }
            }
            state.invTimer = 2; // global.inv = 2 (Step_0:60) — AFTER scr_damage's invc*30
          }
        }
      }
      // with (obj_heart) mask_index = rem_mask — nothing to restore here:
      // the live heart mask was never touched.
    }

    // THE SPRAY, DOUBLED AND RE-ARMED (kaizo Step_0:69-104): every 4th frame
    // (vanilla 8th) between 16 and 39 (Side B window 36 — the same volley
    // set, kept verbatim), three swords out each side along the beam's
    // perpendicular at the CONTROLLER's dist_diff spacing (vanilla fixed
    // 60), all flying BACK down the beam at speed 15 and ACCELERATING
    // (friction -0.8), damage 153, non-destroying.
    if (e.timer > 15 && e.timer % 4 === 0 && e.timer < 40 - sideb(state) * 3) {
      // var _dist = obj_knight_stream.dist_diff (Step_0:71) — a static read
      // of the controller; GML would crash without one, and so does this.
      const mg = state.entities.find(
        (x) => x.alive && x.type.name === 'obj_knight_stream',
      );
      const _dist = mg.dist_diff;
      // snd_stop(snd_wing); snd_play(snd_wing, 1, 1.25 / 0.75 / 0.5)
      cueStop(state, 'snd_wing');
      cue(state, 'snd_wing', 1.25, 1);
      cue(state, 'snd_wing', 0.75, 1);
      cue(state, 'snd_wing', 0.5, 1);
      // Two loops exactly as the GML has them (270 side, then 90 side).
      for (const side of [270, 90]) {
        for (let a = 1; a < 4; a++) {
          const b = spawn(state, streamSword, {
            x: e.x1 + lengthdirX(_dist * a, e.direction + side),
            y: e.y1 + lengthdirY(_dist * a, e.direction + side),
          });
          b.direction = e.direction + 180;
          b.speed = 15;
          // the with-block (Step_0:79-88 / 93-102)
          b.timepoints = 0;
          b.grazepoints = 1;
          b.damage = 153;
          b.visible = false;
          // `image_angle = direction` — the BULLET's own direction (already
          // direction+180), NOT the beam's. The sword sprite is not
          // 180-symmetric, so the distinction is real here.
          b.image_angle = b.direction;
          // KAIZO bullet Step_0:85/99 — `image_blend = c_gray`. Was carried
          // here as the STRING 'c_gray', which is not a colour: this tree's
          // image_blend is an [r,g,b] triple (sim/gml.js GRAY), and the
          // renderer's tinted() throws on anything else.
          b.image_blend = GRAY;
          b.friction = -0.8;
          b.destroyonhit = false;
        }
      }
    }

    if (e.timer === 50) {
      destroy(e);
      // CleanUp fires on instance_destroy (kaizo CleanUp_0) — inline, since
      // the engine has no teardown hook. See bulletKnightStreamCleanUp.
      bulletKnightStreamCleanUp(e, state);
    }
  },

  /** Same per-frame ramps as the streamline — see its endStep. */
  endStep: knightStreamline.endStep,
};

export const knightStream = {
  name: 'obj_knight_stream',

  create(e, state) {
    scrBulletInit(e);
    // THE OBJECT DEFINITION, not an event: obj_knight_stream carries
    // spr_roaringknight_attack_ol (knight-research/kaizo-mod/sprites/
    // objects_kaizo.csv:1690 — and vanilla's objects_vanilla.csv:1691, the
    // same sheet) and depth 0 (same row). No Create/Step line names either,
    // so no grep of the code dump finds them (CLAUDE.md, "The OBJECT
    // DEFINITION holds more than the sprite"). The Draw reads both: Draw_0:2
    // `draw_sprite_ext(sprite_index, image_index, ...)` is the visible Knight
    // pose for the whole attack (the launcher zeroes obj_knight_enemy's
    // alpha), and depth is where that pose sorts. spr_roaringknight_attack_ol
    // is in no mask table (sim/masks.js SPRITE_MASKS, kaizo/data/masks.js),
    // so naming it here gives the manager no collision mask — the same
    // assignment obj_knight_tunnel_slasher and _2_revised already carry.
    e.sprite_index = 'spr_roaringknight_attack_ol';
    e.depth = 0;
    // scr_darksize()
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.image_speed = 0;
    // KAIZO Create_0:3 — irandom_range(-145, 145), vanilla ±45. Still ONE
    // logical draw (2 stream pulls), 291 outcomes: the opening cross can
    // face nearly any way, including cuts vanilla never produces.
    e.slash_angle = 90 + gmlIrandomRange(state.gmlRng, -145, 145);
    e.timer = 0;
    e.fulltimer = 0; // KAIZO Create_0:5 — never-reset clock (Draw bob)
    // KAIZO Create_0:6 — scr_lerpvar("image_index", 0, 1, 10): the pose
    // sprite animates 0 -> 1 over 10 frames (first write next frame).
    scrLerpvar(state, spawn, e, 'image_index', 0, 1, 10);
    e.imgtarget = -1; // KAIZO Create_0:7 — pose driver disabled until Step
    e.init = 0; // KAIZO Create_0:8
  },

  step(e, state) {
    e.timer += 1;
    e.fulltimer += 1; // KAIZO Step_0:2
    e.damage = 153; // KAIZO Step_0:3 — pinned every frame (header: the
    //                 206/306 dispatch conflict both lose to this)

    // KAIZO Step_0:4-15 — one-shot cadence init; Side B tightens the fan.
    if (!e.init) {
      e.dist_diff = 54;
      e.time_diff = 3;
      e.slash_amt = 5;
      if (state.kaizo?.sideb) {
        e.dist_diff = 48;
        e.time_diff = 2;
      }
      e.init = 1;
    }

    // KAIZO Step_0:16-19 — the pose eases toward imgtarget at 1/frame.
    // image_index accumulates through the create lerp, so GML's != gets the
    // epsilon compare.
    if (e.imgtarget !== -1 && !gmlEq(e.image_index, e.imgtarget)) {
      e.image_index = scrApproach(e.image_index, e.imgtarget, 1);
    }

    if (e.timer === 20) {
      // KAIZO Step_0:22-30 — pose flip (1 <-> 5 targets through the slash
      // frame 3) and the body's jitter lerp: 2 NEW random_range draws,
      // BEFORE the vanilla choose/irandom_range — the whole stream diverges
      // from vanilla here by exactly two draws per cycle.
      if (gmlEq(e.image_index, 1)) {
        e.imgtarget = 5;
      } else {
        e.imgtarget = 1;
      }
      e.image_index = 3;
      scrLerpvar(state, spawn, e, 'x', e.x,
        e.xstart + gmlRandomRange(state.gmlRng, -12, 12), 6, 2, 'out');
      scrLerpvar(state, spawn, e, 'y', e.y,
        e.ystart + gmlRandomRange(state.gmlRng, -48, 48), 6, 2, 'out');
      e.damage = 153; // KAIZO Step_0:33 — re-set, kept verbatim

      const gt = state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
      const gx = gt ? gt.x : state.view.x + 320;
      const gy = gt ? gt.y : state.view.y + 170;
      let xoff = 0;
      let yoff = 0;
      // `plane_shift = choose(true, false)` — which axis the pair is nudged
      // along. The draw happens either way; only its use is conditional.
      const planeShift = gmlChoose(state.gmlRng, [true, false]);
      if (planeShift) xoff = gmlIrandomRange(state.gmlRng, -40, 40);
      else yoff = gmlIrandomRange(state.gmlRng, -40, 40);

      for (const dir of [e.slash_angle, 180 - e.slash_angle]) {
        const b = spawn(state, bulletKnightStream, { x: gx + xoff, y: gy + yoff });
        b.direction = dir;
        b.speed = 0;
      }
      cue(state, 'snd_knight_cut'); // KAIZO Step_0:47 — new in the mod
    }

    // THE CASCADE, GENERALIZED (kaizo Step_0:49-67): slash_amt streamline
    // pairs per beam at timer 22 + i*time_diff, offset dist_diff * i —
    // frames 22/25/28/31/34 at 0/54/108/162/216 (Side B 22/24/26/28/30 at
    // 0/48/96/144/192). Vanilla: fixed 3 at 60/120/180 on 23/26/29. i = 0
    // fires BOTH lines at offset 0 — two COINCIDENT streamlines on the
    // stream axis, kept. The last pair latches can_do_slashes false.
    for (let i = 0; i < e.slash_amt; i++) {
      if (e.timer === 22 + i * e.time_diff) {
        for (const beam of state.entities) {
          if (!beam.alive || beam.type.name !== 'obj_bullet_knight_stream') continue;
          if (!beam.can_do_slashes) continue;
          beam.damage = 153; // KAIZO Step_0:57 — each beam's own field
          for (const sign of [1, -1]) {
            const l = spawn(state, knightStreamline, {
              x: beam.x + sign * lengthdirX(e.dist_diff * i, beam.direction + 270),
              y: beam.y + sign * lengthdirY(e.dist_diff * i, beam.direction + 270),
            });
            l.direction = beam.direction;
            l.speed = 0;
          }
          if (i + 1 === e.slash_amt) beam.can_do_slashes = false;
        }
      }
    }

    // KAIZO Step_0:68-76 — cycle restart: 45 frames, 42 on Side B (vanilla
    // 45), gated on the turn clock; the angle walk's wrap threshold is
    // raised 70 -> 170, so the cross sweeps a far wider fan.
    if (e.timer === 45 - sideb(state) * 3 && state.turntimer > 16) {
      e.slash_angle += 25 + gmlIrandom(state.gmlRng, 25);
      if (e.slash_angle > 170) e.slash_angle -= 40;
      e.timer = 0;
    }

    // KAIZO Step_0:77-90 — THE TURN-END HANDSHAKE (new; vanilla never
    // touches the clock): while beams are live the turn cannot end — the
    // clock is pinned at 16 — and once they are gone, at exactly 12 the
    // pose resets and the body flies back to the Knight over 11 frames.
    if (state.turntimer <= 16) {
      if (state.entities.some((b) => b.alive && b.type.name === 'obj_bullet_knight_stream')) {
        state.turntimer = 16;
      } else if (gmlEq(state.turntimer, 12)) {
        // == on the ACCUMULATED clock (graze timepoints subtract fractions)
        // -> gmlEq, per the project rule.
        e.image_index = 0;
        e.imgtarget = -1;
        const knight = state.entities.find(
          (k) => k.alive && k.type.name === 'obj_knight_enemy',
        );
        // obj_knight_enemy.x — a static read; the fight always has one. A
        // scene without a knight skips the fly-back rather than crashing
        // (same guard the sim's other modules use).
        if (knight) {
          scrLerpvar(state, spawn, e, 'x', e.x, knight.x, 11, 2, 'out');
          scrLerpvar(state, spawn, e, 'y', e.y, knight.y, 11, 2, 'out');
        }
      }
    }
  },

  /**
   * KAIZO Draw_0:3-10 — Draw-time STATE, on the engine's draw slot
   * (sim/index.js "THE DRAW SLOT": after endStep, where GameMaker runs Draw,
   * so `fulltimer` is the post-Step value the game's Draw tests):
   *
   *     if ((fulltimer % 2) == 0) {
   *         fade = scr_afterimage();
   *         fade.image_alpha = 0.6;
   *         fade.fadeSpeed = 0.04;
   *         fade.hspeed = 3;
   *         fade.depth = obj_knight_enemy.depth + 1;
   *     }
   *
   * A real obj_afterimage instance of the pose (sprite, subimage, blend and
   * scales copied by scr_afterimage — sim/fx.js), spawned at the manager's
   * own (x, y): the Draw paints the pose at a bobbed y but creates the ghost
   * at the instance position. `fade.hspeed = 3` is the derived speed/
   * direction pair, the way every other module here translates an hspeed
   * write onto the built-in motion (knightlines.js `fade.speed = 4`). The
   * depth base is the sim's obj_knight_enemy (88, sim/actors.js) plus one —
   * the game's relative placement, one layer behind the Knight, on this
   * engine's depth scale. The ghost is drawn by the ordinary pass, not by
   * the stream's own Draw override, exactly as obj_afterimage draws itself.
   *
   * NO RNG: nothing in this block draws from the stream, so the byte gate is
   * untouched; `seq` advances by one per ghost, which orders entities only.
   * A scene without a Knight (the single-attack sandbox) gets `depth + 1`
   * over 0, the same guard the fly-back above uses.
   *
   * MEASURED (scratch probe, V-C, seed 12345, the render smoke's pulse feed
   * and HP pin, no renderer): the first stream is born on frame 9395 and
   * ghosts on fulltimer 0, 2, 4, ... — 133 over the turn, every one with
   * alpha 0.6 (f32: 0.6000000238), fadeSpeed 0.04, speed 3 / direction 0,
   * depth 89 against the Knight's 88, at the manager's own (425, 84.02).
   * The fulltimer-0 ghost is the engine's spawn-frame rule (sim/entity.js:
   * a new instance steps from the frame after its birth, so its first draw
   * slot sees fulltimer 0); whether the game's Draw sees 0 or 1 on the birth
   * frame is the same open question every kaizo module carries, and the
   * cadence from then on is identical.
   */
  draw(e, state) {
    if (e.fulltimer % 2 === 0) {
      const fade = scrAfterimage(state, e);
      fade.image_alpha = 0.6;
      fade.fadeSpeed = 0.04;
      fade.speed = 3; // fade.hspeed = 3
      fade.direction = 0;
      const knight = state.entities.find(
        (k) => k.alive && k.type.name === 'obj_knight_enemy',
      );
      fade.depth = (knight?.depth ?? 0) + 1;
    }
  },

  /**
   * Draw_0's COLOUR state — the mod's blue re-theme of the cross.
   *
   * The manager draws every beam as three stacked lines, and the mod recolors
   * the outer two (kaizo knight_stream Draw_0):
   *
   *     l.26  var _ds = merge_color(get_swordcolor(), c_black, 0.5);
   *     l.35  draw_line_width_color(..., get_swordcolor(), get_swordcolor());
   *     l.41  draw_line_width_color(..., _ds, _ds);          // vanilla c_maroon
   *     l.48  draw_line_width_color(..., c_black, c_black);  // unchanged
   *
   * versus vanilla's c_red / c_maroon (v105 Draw_0:25/31). The streamlines
   * stay c_gray (l.24, unchanged) and the pose is drawn with the manager's own
   * image_blend, which nothing tints.
   *
   * Stored per beam rather than recomputed at paint time so the renderer reads
   * a colour instead of hardcoding one — render/draw/knight-stream.js lives
   * outside kaizo/ and still paints rgb(255,0,0)/rgb(128,0,0); when it is
   * taught to read these, the beams turn blue with no further sim change.
   * `blend2` is the second-blend field name knightlines.js already uses.
   * get_swordcolor consumes no RNG, so the stream is untouched.
   */
  endStep(e, state) {
    const _ds = mergeColor(getSwordcolor(state), BLACK, 0.5); // Draw_0:26
    for (const b of state.entities) {
      if (!b.alive || b.type.name !== 'obj_bullet_knight_stream') continue;
      b.image_blend = getSwordcolor(state); // Draw_0:35
      b.blend2 = _ds; // Draw_0:41
    }
  },
};
