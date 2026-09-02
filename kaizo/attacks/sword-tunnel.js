// KAIZO obj_sword_tunnel_manager + obj_sword_tunnel_sword — dc.type 153 as
// EnderCat8's Kaizo Roaring Knight v2.3.3 rebuilds it.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// SCOPE BOUNDARY (read before adding anything here): dc.type 153 creates
// obj_sword_tunnel_manager and NOTHING ELSE (kaizo dbulletcontroller Step_0
// l.3022-3035). `obj_knight_tunnel_slasher` — the knightlines slasher and the
// mod's ac-110 PierceBlades carousel — is dc.type **101**, a different
// controller that merely shares a number with the KNIGHT's `myattackchoice ==
// 101` (underbox + this tunnel at d10) that the manager's Create reads. It
// lives in kaizo/attacks/knightlines.js; do not duplicate it here.
//
// PROVENANCE: copied from the VERIFIED sim/attacks/sword-tunnel.js and changed
// ONLY where the mod's GML diverges. Ground truth:
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_sword_tunnel_manager_Create_0.gml
//     gml_Object_obj_sword_tunnel_manager_Other_10.gml
//     gml_Object_obj_sword_tunnel_manager_Step_0.gml
//     gml_Object_obj_sword_tunnel_sword_Create_0.gml
//     gml_Object_obj_sword_tunnel_sword_Step_0.gml
//     gml_Object_obj_sword_tunnel_sword_Draw_0.gml
//   delta specs: knight-research/kaizo-mod/deltas/gml_Object_obj_sword_tunnel_*.md
//
// DIVERGENCES from the sim module (each cited at its site):
//   MANAGER
//   * Create: `shoutouttogreenknight = 0; woosh = -4` (Create l.25-26); the
//     wind-up anim is spawned only when `myattackchoice != 101`, its handle
//     kept in `woosh`; the 101 path instead forces `timer = -1` (Create
//     l.28-35). myattackchoice -> state.currentAc (established mapping, see
//     kaizo/attacks/underbox.js header).
//   * Other_10: difficulty 4 gains a B-Side `gapsize = 30` override
//     (l.48-51); NEW tiers 10 (l.53-62), 4.1 (l.63-70) and 11 (l.71-83).
//     4.1 is compared with gmlEq per the fractional-difficulty law.
//   * Step: the soul's mask is forced to the mod's 2px heart mask EVERY frame
//     (l.5-8); a concurrent tracking-swords manager is muted from
//     finishtimermax-20 (l.14-21); the finale flip marks `holyfuck` swords
//     with delay/delaystart 24 (l.28-32); NEW perpendicular spawn branch when
//     `shoutouttogreenknight` (l.37-51); the bottom sword is suppressed at
//     difficulty 10 (l.57-62); NEW difficulty-10 end block pins finishtimer 0
//     and shrinks the gap 2px every 3 frames to a 36 floor (l.177-190).
//   SWORD (BASE-VERSION NOTE: the mod is built on v0.091 — the v105 finale
//   hitbox rework does NOT exist in it. kaizo == v091 here, and where that
//   differs from the v105 text the sim was verified against, this file
//   translates the KAIZO text and cites both.)
//   * Create: no `active = 0` / `create_2nd_hitbox` (v091 base — active stays
//     1 from scr_bullet_init, so the sword damages and grazes at all times);
//     NEW fields delay/delaystart/jumpsnd/cutsnd (Create l.21-24).
//   * Step: the finale's jump/hold/flare/sweep phases run on
//     `_dtimer = timer - delaystart` (l.36) — the cross-tunnel wave sweeps 24
//     frames late; telegraph raise gated on delaystart (l.15-18, l.27-30);
//     `audio_is_playing` gates replaced by per-wave jumpsnd/cutsnd flags
//     (l.39-49, l.68-78); proximity blend is `get_swordcolor()` not c_red
//     (l.91); the near-heart sweep is the v091 `place_meeting` sub-step probe
//     (l.92-105) — NO obj_sword_tunnel_hitbox, NO spr_dodgeheart_smallmask
//     swap, NO collision_line, NO active toggling.
//   * Draw (endStep here): NEW delay countdown pinning telegraphalpha to -0.1
//     (Draw l.9-13); any live tracking-swords manager is destroyed outright
//     once `con > 0` (Draw l.20-23); the finale flash gate compares against
//     get_swordcolor() (Draw l.29-32).
//
// PURE-VISUAL deltas noted, not drawn (renderer work later, no RNG involved):
//   * the laser telegraph is drawn #86A2FF instead of c_red (Draw l.16) —
//     exported as KAIZO_TELEGRAPH_COLOR;
//   * get_swordcolor() tints follow the mod's global.kaizo_swordtype palette
//     (scr_complete_save_file) — read as state.kaizo?.swordtype.
//
// NOT translated (unchanged from the sim module's own scope): tobymodes 1 and
// 2 (tunnel difficulties 1 and 2) — the mod's dispatch never asks for them
// (Other_23 uses 153 at d4 / d4.1 / d10 / d11 only, and V-A's table uses the
// vanilla d0/3/4).
//
// GRAZE NOTE (v091 base): with `active` permanently 1, the engine grazebox
// path pays these swords with no special-case needed — sim/tension.js's
// obj_sword_tunnel_sword exemption (a v105 artifact) is simply never reached
// with a false active flag. Matches the kaizo-mod INDEX finding that tunnel
// swords grant graze TP.
//
// WHICH DIFFICULTIES THE MOD ACTUALLY ASKS FOR (obj_knight_enemy Other_23):
//   ac 13    -> 153 d4    (both arms)              — vanilla tier, B-Side gap 30
//   ac 15.1  -> 153 d4.1 AND 153 d11, turntimer 450 — two crossing corridors
//   ac 101   -> 106 (underbox) + 153 d10, turntimer 240 — one-sided, endless
// d0 and d3 stay reachable through V-A's own table, so both are kept.
//
// VERIFICATION STATUS: translated from the kaizo dump against the delta specs
// (knight-research/kaizo-mod/deltas/); positive-assertion suite at
// kaizo/tools/checks/check-sword-tunnel.mjs. Not yet oracle-diffed against the
// real mod.

import { spawn, destroy } from '../../sim/entity.js';
// THE MOD'S PALETTE — one source of truth for every kaizo module.
import { getSwordcolor, KAIZO_TELEGRAPH_COLOR } from './kaizo-colors.js';
import { viewFor } from '../../sim/shake.js';
import { afterimage, afterimageGrow } from '../../sim/fx.js';
import {
  lerp, lengthdirX, lengthdirY, mergeColor, pointDirection, scrAnglechange,
  gmlEq, WHITE,
} from '../../sim/gml.js';
import { scrBulletInit, collidebulletOther15 } from '../../sim/bullets/regularbullet.js';
import { DIAMOND_MASK, HEART_MASK, masksOverlap } from '../../sim/masks.js';
import { gmlChoose, gmlIrandom } from '../../sim/rng.js';
import { cue } from '../../sim/audio.js';
import { swordTunnelAnim } from './sword-tunnel-anim.js';
// THE SHRUNKEN SOUL MASK IS SHARED CONTENT, so it is imported rather than
// redefined: seven kaizo objects stamp `spr_dodgeheart_smaller_2px_mask` onto
// obj_heart, and they must all mean the same pixels or the same dodge reads
// differently per attack. kaizo/attacks/underbox.js owns the definition.
// OPEN (flagged for the central integration, not decidable here): the `_mask`
// sprite itself is NOT in assets/sprites/manifest.json — only its companion
// `spr_dodgeheart_smaller_2px` (20x20, AxisAlignedRect, bbox [2,2,17,17]) is.
// underbox.js reads the pair the way vanilla pairs spr_dodgeheart with
// spr_dodgeheartmask (rect sprite + PRECISE mask), giving the heart shape
// inset 2px, bbox [4,4,15,15]; kaizo/attacks/swordfall.js instead defines its
// own AxisAlignedRect [2,2,17,17]. The two disagree, and only an extraction of
// the real sprite settles it.
import { KAIZO_SMALLER_HEART_MASK } from './underbox.js';

// Export-name parity with the sim module: the v105 finale hitbox object.
// The KAIZO sword NEVER spawns it (v091 base — see header); re-exported so a
// launcher that swaps the import source resolves every symbol.
export { swordTunnelHitbox } from '../../sim/attacks/sword-tunnel.js';

function box(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
}

/**
 * THE PALETTE IS NOT DEFINED HERE ANY MORE. It lives in one place,
 * kaizo/attacks/kaizo-colors.js, and every kaizo module imports it — this
 * file used to carry a private copy of the table and two others had drifted
 * from it (tracking-swords.js had 0x4E/0x76/0x8F where the dump's reals
 * decode to 0x52/0x7A/0x93), which is exactly the failure one source of
 * truth prevents.
 *
 * getSwordcolor still returns a STABLE array reference, and that is
 * load-bearing here: the sword's Draw gate is
 * `if (image_blend == get_swordcolor())` — an exact equality against the
 * value the Step assigned the same frame — translated as reference equality
 * (endStep below). Never build a fresh array at either end of that test.
 *
 * Both names stay EXPORTED from this module: check-sword-tunnel.mjs and any
 * future renderer import them from here, and re-exporting keeps that entry
 * point while the definition moves.
 */
export { getSwordcolor, KAIZO_TELEGRAPH_COLOR };

export const swordTunnelSword = {
  name: 'obj_sword_tunnel_sword',

  create(e, state) {
    scrBulletInit(e);
    e.grazepoints = 0.8;
    e.destroyonhit = 0;
    e.timer = 0;
    e.con = 0;
    e._maxspeed = 30;
    // KAIZO/v091 BASE (sword Create): NO `active = 0`, NO `create_2nd_hitbox`
    // — those are v105's finale-hitbox rework, absent from the mod's base.
    // `active` stays 1 from scr_bullet_init, so the sword's ordinary
    // collidebullet contact and graze paths are live every frame.
    e.image_index = 2;
    e.image_speed = 0;
    e.mydirection = 180;
    // The original assigns _speed/_gravity twice; the second pair wins.
    e._speed = 6;
    e._gravity = 1;
    e.image_yscale = 0;
    e.randx = -20 + gmlIrandom(state.gmlRng, 40);
    e.randy = -20 + gmlIrandom(state.gmlRng, 40);
    e.targetangle = 0;
    e.anglespeed = 8;
    e.telegraph = 0;
    e.telegraphalpha = 0;
    // KAIZO sword Create l.21-24: the cross-tunnel finale stagger and the
    // per-wave sound-dedup flags.
    e.delay = 0;
    e.delaystart = 0;
    e.jumpsnd = 0;
    e.cutsnd = 0;
    // MEASURED (sim module): the object-definition sprite is
    // spr_knight_diamondbullet_l; the visible blades are drawn by
    // obj_knight_swordtunnelanim. Unchanged by the mod.
    e.sprite_index = 'spr_knight_diamondbullet_l';
    e.isBullet = true;
  },

  step(e, state) {
    e._speed += e._gravity;
    if (e._speed > e._maxspeed) e._speed = e._maxspeed;

    let xadd = lengthdirX(1, e.mydirection);
    let yadd = lengthdirY(1, e.mydirection);

    // ---- con 1: THE FINALE ------------------------------------------------
    // Same shape as the verified sim module, with the KAIZO delaystart shift:
    // the homing turn and the brake stay on the RAW timer; jump-back, hold,
    // flare and sweep run on `_dtimer = timer - delaystart` (sword Step l.36)
    // — so a holyfuck (cross-tunnel) sword finishes turning on the same
    // absolute frames as wave 0 and then WAITS 24 frames before it launches.
    if (e.con === 1) {
      e.timer += 1;
      const c = 10;
      if (e.timer === 1) {
        e._gravity = 0;
        // KAIZO sword Step l.15-18: only the zero wave telegraphs at once.
        if (!e.delaystart) e.telegraph = 1;
      }
      if (e.timer < 10 + c / 2) {
        e.anglespeed = lerp(8, 0, e.timer / (10 + c / 2));
        // PRE-STEP soul position, same as the swept probe (sim module,
        // verify21i f1491).
        const hp = state.soulPrev ?? state.soul;
        if (hp) {
          const want = pointDirection(e.x, e.y, hp.x + 10 + e.randx, hp.y + 10 + e.randy);
          e.image_angle += scrAnglechange(e.image_angle, want, e.anglespeed);
        }
        e.targetangle += e.anglespeed;
      }
      // KAIZO sword Step l.27-30: the delayed wave's telegraph raise.
      if (e.timer === 1 + e.delaystart) e.telegraph = 1;
      e.direction = e.image_angle;
      if (e.timer < 10 + c) {
        e._speed = lerp(e._speed, 0, e.timer / 10);
      }
      const dtimer = e.timer - e.delaystart; // KAIZO sword Step l.36
      if (dtimer >= 11 + c && dtimer < 15 + c) {
        // KAIZO sword Step l.39-49: the audio_is_playing gate becomes a
        // per-wave flag — each delaystart wave plays ONE jump, exactly once.
        if (!e.jumpsnd) {
          cue(state, 'snd_knight_jump', 0.8, 1);
          for (const s of state.entities) {
            if (s.alive && s.type.name === 'obj_sword_tunnel_sword'
              && s.delaystart === e.delaystart) s.jumpsnd = 1;
          }
        }
        e._speed = 2;
        xadd = lengthdirX(2, e.image_angle + 180);
        yadd = lengthdirY(2, e.image_angle + 180);
      }
      if (dtimer >= 15 + c && dtimer < 20 + c) {
        xadd = 0;
        yadd = 0;
      }
      if (dtimer === 20 + c) {
        const flare = spawn(state, afterimageGrow, { x: e.x, y: e.y });
        flare.sprite_index = e.sprite_index;
        flare.image_angle = e.image_angle;
        flare.image_blend = e.image_blend;
        flare.xrate = 0.4;
        flare.yrate = 0.4;
        flare.fade = 0.2;
      }
      if (dtimer >= 20 + c) {
        // KAIZO sword Step l.68-78: cutsnd flag, same per-wave dedup.
        if (e.cutsnd === 0) {
          cue(state, 'snd_knight_cut', 0.8, 1);
          for (const s of state.entities) {
            if (s.alive && s.type.name === 'obj_sword_tunnel_sword'
              && s.delaystart === e.delaystart) s.cutsnd = 1;
          }
        }
        e.telegraph = 0;
        e.damage = 160;
        e._speed = 80;
        xadd = lengthdirX(1, e.image_angle);
        yadd = lengthdirY(1, e.image_angle);
      }
    }

    // THE SWEPT HIT TEST — v091 BASE (kaizo sword Step l.86-106). Within 80px
    // of the soul the sword advances in 8px sub-steps and runs a plain
    // `place_meeting(x, y, obj_heart)` at each one, firing event_user(5) on
    // contact, then restores its position. The v105 rework the sim module was
    // verified against (active toggling, the 999x0.4 obj_sword_tunnel_hitbox,
    // the spr_dodgeheart_smallmask swap, the 37px collision_line probe) does
    // NOT exist in the mod's base and is deliberately absent here.
    e.image_blend = WHITE;

    const heart = state.soul;
    // NO SOUL, NO TARGET (sim module note — unchanged).
    if (!heart) return;
    // THE SOUL'S PRE-STEP POSITION (state.soulPrev) — the sword steps before
    // the soul in the runner, so both the proximity band and the sweep read
    // the soul where it stood at the top of the frame (sim module,
    // verify21i f1486).
    const hp = state.soulPrev ?? heart;
    if (
      e.x > hp.x - 80 &&
      e.x < hp.x + 80 &&
      e.y < hp.y + 80 &&
      e.y > hp.y - 80
    ) {
      // KAIZO sword Step l.91: get_swordcolor(), not c_red.
      e.image_blend = getSwordcolor(state);
      const remx = e.x;
      const remy = e.y;
      const steps = Math.max(Math.floor(e._speed / 8), 1);
      for (let i = 0; i < steps; i++) {
        e.x += xadd * 8;
        e.y += yadd * 8;
        // v091: place_meeting against the sword's OWN mask (sprite
        // spr_knight_diamondbullet_l at current scales/angle) — note
        // image_yscale under 1 cannot register, per the calibrated model,
        // which is what keeps a freshly-spawned sword harmless.
        if (masksOverlap(
          heart.mask ?? HEART_MASK, hp.x, hp.y,
          DIAMOND_MASK, e.x, e.y, e.image_xscale, e.image_yscale, e.image_angle,
        )) {
          e.tunnelHits = (e.tunnelHits ?? 0) + 1;
          state.tunnelHits = (state.tunnelHits ?? 0) + 1;
          // `event_user(5)` IS Other_15 — the sweep deals the damage itself.
          swordTunnelSword.other15(e, state);
        }
      }
      e.x = remx;
      e.y = remy;
    }

    e.x += xadd * e._speed;
    e.y += yadd * e._speed;

    // ONE AFTERIMAGE PER FRAME, at the MIDPOINT of the move (sim module —
    // unchanged by the mod; kaizo sword Step l.109-116).
    const ghost = spawn(state, afterimage, {
      x: (e.x + e.xprevious) / 2,
      y: (e.y + e.yprevious) / 2,
    });
    ghost.sprite_index = e.sprite_index;
    ghost.image_index = e.image_index;
    ghost.image_angle = e.image_angle;
    ghost.image_xscale = e.image_xscale;
    ghost.image_yscale = e.image_yscale;
    ghost.image_alpha = 0.4;
    ghost.image_blend = e.con > 0 ? WHITE : e.image_blend;

    // THE CULL RIDES THE SCREEN SHAKE — see viewFor (sim module).
    const vw = viewFor(state, e);
    if (e.x <= vw.x - 100) return destroy(e);
    if (e.x >= vw.x + 740) return destroy(e);
    if (e.y >= vw.y + 600) return destroy(e);
    if (e.y <= vw.y - 250) return destroy(e);

    if (e.con === 0) {
      e.image_yscale = lerp(e.image_yscale, e._speed / 20, 0.1);
    }
  },

  /**
   * The sword's OWN mask overlap — obj_heart's ordinary collision with a
   * collidebullet. In the v091 base `active` is permanently 1, so this path
   * (and the engine grazebox) is always live; contact resolves through
   * collidebulletOther15 exactly as the ordinary bullet family does.
   */
  collides(e, heart) {
    return masksOverlap(
      heart.mask ?? HEART_MASK, heart.x, heart.y,
      DIAMOND_MASK, e.x, e.y, e.image_xscale, e.image_yscale, e.image_angle,
    );
  },

  /**
   * THE DRAW EVENT'S STATE (kaizo sword Draw_0). Same ramp pair as the sim
   * module, plus the mod's three functional hunks.
   */
  endStep(e, state) {
    if (e.telegraph === 0 && e.telegraphalpha > 0) e.telegraphalpha -= 0.1;
    if (e.telegraph === 1 && e.telegraphalpha < 0.5) e.telegraphalpha += 0.05;

    // KAIZO Draw l.9-13: the finale stagger counts down IN DRAW, pinning the
    // telegraph invisible until it runs out — so the cross wave's laser
    // appears ~24 draws late, matching its delaystart-shifted Step timeline.
    if (e.delay > 0) {
      e.delay -= 1;
      e.telegraphalpha = -0.1;
    }

    if (e.con > 0) {
      // KAIZO Draw l.20-23: the first finale draw destroys any concurrent
      // tracking-swords manager outright (complements the manager Step's
      // rate-mute at finishtimermax - 20).
      for (const t of state.entities) {
        if (t.alive && t.type.name === 'obj_tracking_swords_manager') destroy(t);
      }
      const t = Math.min(e.timer, 10);
      // KAIZO Draw l.29-32: the flash gate compares against get_swordcolor()
      // — only the frame the blend FIRST took the sword colour starts the
      // ramp (reference equality, the sim module's RED idiom).
      if (e.image_blend === getSwordcolor(state)) {
        e.image_blend = mergeColor(getSwordcolor(state), WHITE, t / 10);
      }
    }
  },

  other15: collidebulletOther15,
};

export const swordTunnelManager = {
  name: 'obj_sword_tunnel_manager',

  create(e, state) {
    // A COLLIDEBULLET IN ITS OWN RIGHT (sim module — the manager occupies a
    // bullet slot; maskOff keeps it out of collision/graze).
    e.isBullet = true;
    e.maskOff = true;
    const gt = box(state);

    e.timer = -40 + gmlIrandom(state.gmlRng, 10);
    e.finishtimer = 0;
    // Reads the KNIGHT's difficulty in Create (sim module note — the launcher
    // must set knight.difficulty before spawning; knightDifficulty fallback).
    const theKnight = state.entities.find(
      (x) => x.alive && x.type.name === 'obj_knight_enemy',
    );
    const kd = theKnight?.difficulty ?? e.knightDifficulty;
    e.finishtimermax = kd === 3 ? 250 : 230;
    e.con = 0;
    // camerax() + camerawidth() + 20
    e.swordx = state.view.x + 640 + 20;
    e.swordy = gt ? gt.y : 190;
    e.swordxrel = 340;
    e.swordyrel = 0;
    e.sworddirection = 180;
    e.swordcount = 0;
    e.setcount = gmlChoose(state.gmlRng, [2, 3, 4]);
    e.waitsetcount = gmlChoose(state.gmlRng, [1, 2, 3]);
    e.movedirection = gmlChoose(state.gmlRng, ['up', 'down']);
    e.tobymode = 0;
    e.tobytimer = 0;
    // `tobyvolleyamount = 10 + irandom(6)` — ORIGINAL BUG: write-only, but
    // the irandom still takes its two draws (sim module; kaizo identical).
    gmlIrandom(state.gmlRng, 6);
    e.difficulty = 0;
    e.stopsfxtimer = 0;
    e.tobyvolleymode = 0;
    e.tobyvolleycount = 0;
    e.tobyvolleymodeinitspeed = 1;
    // KAIZO Create l.25-26: the cross-tunnel flag and the wind-up-anim
    // handle (-4 = noone; `with (woosh)` on it iterates nothing).
    e.shoutouttogreenknight = 0;
    e.woosh = -4;
    // KAIZO Create l.28-35: attack 101 (underbox + one-sided d10 tunnel)
    // spawns NO wind-up anim and starts the corridor almost immediately —
    // the rolled `timer = -40 + irandom(10)` (whose draws already happened
    // above, so the stream is identical on both paths) is overwritten with
    // -1. Everything else keeps the vanilla last line, with the handle kept.
    // `obj_knight_enemy.myattackchoice` -> state.currentAc (the established
    // mapping — set by fight.js, single.js and the V-C launcher).
    if (state.currentAc !== 101) {
      const knight = state.entities.find(
        (x) => x.alive && x.type.name === 'obj_knight_enemy',
      );
      if (knight) {
        e.woosh = spawn(state, swordTunnelAnim, { x: knight.x, y: knight.y });
      }
    } else {
      e.timer = -1;
    }
    if (globalThis.process?.env?.KNIGHT_TUNNEL_DEBUG) {
      console.error(`[tun:create] f=${state.frame} ac=${state.currentAc}`
        + ` seed=${state.seed} spawnn=${state.spawnn}`
        + ` timer=${e.timer} (irandom10=${e.timer + 40}) set=${e.setcount}`
        + ` wait=${e.waitsetcount} dir=${e.movedirection} swordy=${e.swordy}`);
    }
  },

  /**
   * Other_10 — event_user(0). The launcher calls this ONCE, after assigning
   * `difficulty` (the sim's collapsed two-phase init). NEVER re-fire it: tier
   * 10's `swordy += 50` compounds on a second pass (delta spec's ordering
   * trap).
   */
  init(e, state) {
    e.rate = 6;
    e.gapsize = 50;
    e.verticalchange = 15;
    e.tobymode = 0;
    e.maxswords = 999;
    if (e.difficulty === 0) {
      e.rate = 4;
      e.gapsize = 45;
      e.verticalchange = 10;
      e.tobymode = 0;
      e.maxswords = 999;
    }
    if (e.difficulty === 3) {
      e.rate = 4;
      e.gapsize = 45;
      e.verticalchange = 7;
      e.tobymode = 3;
      e.tobytimer = 0;
      e.maxswords = 999;
    }
    // Difficulties 1 and 2 (tobymodes 1/2) are NOT translated — neither the
    // vanilla selector nor the mod's dispatch ever asks for them.
    if (e.difficulty === 4) {
      e.rate = 4;
      e.gapsize = 40;
      e.verticalchange = 10;
      e.tobymode = 0;
      e.maxswords = 999;
      // KAIZO Other_10 l.48-51: the B-Side tightens the gap.
      if (state?.kaizo?.sideb) {
        e.gapsize = 30;
      }
    }
    // KAIZO Other_10 l.53-62: NEW tier 10 — attack 101's one-sided endless
    // tunnel. tobytimer starts at 2 so the first shrink lands on the very
    // first spawn step; swordy shifts 50px below the box centre, once.
    if (e.difficulty === 10) {
      e.rate = 4;
      e.gapsize = 220;
      e.verticalchange = 0;
      e.maxswords = 1500;
      e.tobymode = 0;
      e.tobytimer = 2;
      e.swordy += 50;
    }
    // KAIZO Other_10 l.63-70: NEW tier 4.1 — the fast wide tunnel (attack
    // 15.1's horizontal half). FRACTIONAL id: gmlEq, never ===.
    if (gmlEq(e.difficulty, 4.1)) {
      e.rate = 3;
      e.gapsize = 64;
      e.verticalchange = 8;
      e.tobymode = 0;
      e.maxswords = 999;
    }
    // KAIZO Other_10 l.71-83: NEW tier 11 — the perpendicular cross tunnel
    // (attack 15.1's vertical half). `with (woosh)` iterates nothing when the
    // handle is still -4 (the create-time pass, or the attack-101 path).
    if (e.difficulty === 11) {
      e.rate = 3;
      e.gapsize = 92;
      e.verticalchange = 8;
      e.tobymode = 0;
      e.maxswords = 999;
      e.shoutouttogreenknight = 1;
      if (e.woosh && e.woosh !== -4 && e.woosh.alive) {
        e.woosh.vertical = true;
      }
    }
  },

  step(e, state) {
    e.timer += 1;
    e.finishtimer += 1;

    const gt = box(state);

    // KAIZO Step l.5-8: `with (obj_heart) mask_index =
    // spr_dodgeheart_smaller_2px_mask` — EVERY frame the manager lives, the
    // soul collides as the mod's shrunken 2px heart (extracted from
    // data-kaizo.win — see kaizo/attacks/underbox.js, which shares the mask).
    // Restore is the next turn's soul handoff, exactly as the GML leaves it.
    if (state.soul && state.soul.alive) {
      state.soul.mask = KAIZO_SMALLER_HEART_MASK;
    }

    // KAIZO Step l.14-21: from 20 frames before the finale, any concurrent
    // tracking-swords manager stops spawning (rate huge, timer far negative).
    // At difficulty 10 finishtimer oscillates 1 -> 0 (pinned below AFTER the
    // increment above), so this never fires there — ordering preserved.
    if (e.finishtimer >= e.finishtimermax - 20) {
      for (const t of state.entities) {
        if (t.alive && t.type.name === 'obj_tracking_swords_manager') {
          t.rate = 9999;
          t.timer = -9999;
        }
      }
    }

    if (e.finishtimer === e.finishtimermax) {
      e.con = 1;
      for (const s of state.entities) {
        if (s.alive && s.type.name === 'obj_sword_tunnel_sword') {
          s.con = 1;
          // KAIZO Step l.28-32: cross-tunnel swords (marked holyfuck by the
          // perpendicular branch) sweep 24 frames late — two walls, two
          // waves. `variable_instance_exists(id, "holyfuck")`.
          if (s.holyfuck !== undefined) {
            s.delay = 24;
            s.delaystart = s.delay;
          }
        }
      }
    }

    if (e.timer >= e.rate && e.con === 0) {
      if (e.shoutouttogreenknight) {
        // KAIZO Step l.37-51: NEW perpendicular spawn branch (difficulty 11).
        // The corridor state (swordx, swordy) is rotated 90 degrees about the
        // box centre — a LEFT and RIGHT sword above the arena, both
        // travelling straight down (mydirection 180 + 90 = 270), both marked
        // holyfuck for the finale stagger. The wander logic below still
        // mutates swordy, which after rotation moves this corridor
        // HORIZONTALLY. No RNG in this branch (the swords' own creates roll
        // their randx/randy as always).
        // (GML reads obj_growtangle directly; guarded here per module idiom.)
        const gx = gt ? gt.x : state.view.x + 320;
        const gy = gt ? gt.y : state.view.y + 180;
        const sx = gx + (e.swordy - gy);
        const sy = gy - (e.swordx - gx);
        const a = spawn(state, swordTunnelSword, {
          x: sx - 50 - e.gapsize / 2,
          y: sy,
        });
        a.image_angle = 0;
        a.damage = e.damage;
        a.holyfuck = 1;
        a.mydirection += 90;
        const b = spawn(state, swordTunnelSword, {
          x: sx + 50 + e.gapsize / 2,
          y: sy,
        });
        b.image_angle = 180;
        b.mydirection += 90;
        b.holyfuck = 1;
        b.damage = e.damage;
      } else if (e.tobymode === 3) {
        // DIFFICULTY 3 (sim module, byte-identical in the kaizo dump):
        // the corridor SWEEPS around the box; tobytimer incremented TWICE per
        // spawn, sine reads the ODD value. Preserved as written.
        e.tobytimer += 1;
        if (!e.tobyvolleymode) {
          // PLAIN Math.sin — measured (sim module).
          e.verticalchange = Math.abs(Math.sin(e.tobytimer / 8)) * 5;
          e.gapsize = 34 + e.verticalchange * 1.4;
        }

        const cx = gt ? gt.x : 300;
        const cy = gt ? gt.y : 190;
        const dir = e.sworddirection;

        const sx = lengthdirX(e.swordxrel, dir + 180);
        const sy = lengthdirY(e.swordxrel, dir + 180);
        const syaddx = lengthdirX(e.swordy - cy, dir + 270);
        const syaddy = lengthdirY(e.swordy - cy, dir + 270);
        const sgapx = lengthdirX(e.gapsize, dir + 270) * 2;
        const sgapy = lengthdirY(e.gapsize, dir + 270) * 2;

        e.tobytimer += 1;

        const speedproportion = lerp(1, 0.8, Math.abs(lengthdirY(1, dir + 180)));
        const gravity =
          (2 * speedproportion - e.verticalchange / 15) * e.tobyvolleymodeinitspeed;

        const a = spawn(state, swordTunnelSword, {
          x: cx + sx - sgapx + syaddx,
          y: cy + sy - sgapy + syaddy,
        });
        a.image_angle = dir + 270;
        a.mydirection = dir;
        a.damage = e.damage;
        a._speed = -8 * speedproportion;
        a._gravity = gravity;

        const b = spawn(state, swordTunnelSword, {
          x: cx + sx + sgapx + syaddx,
          y: cy + sy + sgapy + syaddy,
        });
        b.image_angle = dir + 90;
        b.mydirection = dir;
        b.damage = e.damage;
        b._speed = -8 * speedproportion;
        b._gravity = gravity;

        e.sworddirection += 8;
      } else if (e.tobymode === 0) {
        const upper = spawn(state, swordTunnelSword, {
          x: e.swordx,
          y: e.swordy - 50 - e.gapsize / 2,
        });
        upper.image_angle = 270;
        upper.damage = e.damage;

        // KAIZO Step l.57-62: at difficulty 10 the corridor has a ceiling
        // but no floor — the underbox occupies the bottom (attack 101 pairs
        // them). Only the wrapper is new; the sword itself is vanilla.
        if (e.difficulty !== 10) {
          const lower = spawn(state, swordTunnelSword, {
            x: e.swordx,
            y: e.swordy + 50 + e.gapsize / 2,
          });
          lower.image_angle = 90;
          lower.damage = e.damage;
        }
      }

      if (globalThis.process?.env?.KNIGHT_TUNNEL_DEBUG) {
        console.error(`[tun] f=${globalThis.__simFrame} toby=${e.tobytimer}`
          + ` dir=${e.movedirection} sy=${e.swordy} sc=${e.swordcount}`
          + ` set=${e.setcount} wait=${e.waitsetcount} vc=${e.verticalchange}`);
      }
      if (e.movedirection === 'up') e.swordy -= e.verticalchange;
      if (e.movedirection === 'down') e.swordy += e.verticalchange;

      e.swordcount += 1;

      const boundary =
        (e.setcount === e.swordcount &&
          (e.movedirection === 'down' || e.movedirection === 'up')) ||
        (e.waitsetcount === e.swordcount && e.movedirection === 'none');

      if (boundary) {
        e.swordcount = 0;

        const rec = state.tunnelSets ? state.tunnelSets[state.tunnelIndex++] : null;
        e.setcount = rec ? rec.setcount : gmlChoose(state.gmlRng, [2, 3, 4]);
        e.waitsetcount = rec ? rec.waitsetcount : gmlChoose(state.gmlRng, [1, 2, 3]);

        // Alternate between a moving run and a stationary run.
        if (e.movedirection === 'none') {
          e.movedirection = rec ? rec.movedirection : gmlChoose(state.gmlRng, ['up', 'down']);
        } else {
          e.movedirection = 'none';
        }

        // Refuse to wander more than 20px past the box centre.
        const cy = gt ? gt.y : 190;
        if (e.movedirection === 'up' && e.swordy < cy - 20) e.movedirection = 'down';
        if (e.movedirection === 'down' && e.swordy > cy + 20) e.movedirection = 'up';
      }
    }

    // KAIZO Step l.177-190: NEW difficulty-10 end block. The finale never
    // triggers from this manager (finishtimer pinned 0 AFTER the top-of-step
    // increment — the attack's own scr_turntimer(240) ends the turn instead),
    // and the gap shrinks 2px every 3rd frame down to a 36px floor: 220 -> 36
    // over ~276 frames of corridor.
    if (e.difficulty === 10) {
      e.finishtimer = 0;
      e.tobytimer += 1;
      if (e.tobytimer >= 3) {
        e.tobytimer = 0;
        e.gapsize -= 2;
      }
      if (e.gapsize < 36) e.gapsize = 36;
    }

    if (e.timer >= e.rate && e.stopsfxtimer < 3) {
      if (e.con === 1) e.stopsfxtimer += 1;
      cue(state, 'snd_heavy_passing', 1.2, 0.3);
      e.timer = 0;
    }

    if (e.swordcount >= e.maxswords) destroy(e);
  },
};

/**
 * The dc.type-153 branch, as one call — kaizo obj_dbulletcontroller Step_0
 * l.3022-3035:
 *
 *     var _manager = instance_create(obj_growtangle.x, cameray(),
 *                                    obj_sword_tunnel_manager);
 *     scr_bullet_inherit(_manager);
 *     _manager.difficulty = difficulty;
 *     _manager.damage     = damage;
 *     with (_manager) event_user(0);
 *
 * THE ORDER IS THE WHOLE POINT and it is the two traps stacked:
 *
 *  1. `difficulty` is assigned BEFORE `event_user(0)`, and this engine's
 *     `spawn()` runs create() before a caller can touch the entity — so the
 *     tier table has to be applied by an explicit `init` afterwards, never
 *     from inside create(). (The sim module documents the same for
 *     `knightDifficulty`, which Create reads off the KNIGHT.)
 *  2. `init` runs EXACTLY ONCE here where the GML runs Other_10 twice (once
 *     from Create at `difficulty = 0`, once from the controller). The two are
 *     equivalent because Other_10 re-applies its defaults header on every
 *     pass — except for tier 10's `swordy += 50`, which COMPOUNDS. Calling
 *     init a second time would drop the d10 corridor another 50px. Do not.
 *
 * `state.currentAc` must already hold the KNIGHT's `myattackchoice` (101 for
 * the underbox pairing, which suppresses the wind-up anim and starts the
 * corridor at once) — Create reads it.
 */
export function launchSwordTunnel(state, { difficulty = 0, damage = 62, x, y } = {}) {
  const gt = box(state);
  const mg = spawn(state, swordTunnelManager, {
    x: x ?? (gt ? gt.x : state.view.x + 320),
    y: y ?? state.view.y, // cameray()
  });
  mg.difficulty = difficulty;
  // Create already read the live knight; this is the oracle-scene fallback the
  // sim module keeps for scenes with no obj_knight_enemy.
  mg.knightDifficulty = difficulty;
  mg.damage = damage;
  swordTunnelManager.init(mg, state);
  return mg;
}
