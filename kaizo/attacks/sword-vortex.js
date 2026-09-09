// KAIZO V-C — obj_sword_vortex_manager + obj_sword_vortex, the MOD's build.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// PROVENANCE (knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/):
//   gml_Object_obj_sword_vortex_manager_Create_0.gml   (variant selection,
//       targetxoff/targetyoff, rate=1 fallback, variant 4 + 3.1 tables,
//       ac-111 movespeed override)
//   gml_Object_obj_sword_vortex_manager_Step_0.gml     (wander target
//       + targetxoff/targetyoff — the only Step change)
//   gml_Object_obj_sword_vortex_Step_0.gml             (visual-only prefix,
//       skipped — see NOT TRANSLATED below)
//   gml_GlobalScript_kaizo_settings_init.gml:137-190   (kaizo_vortexend_step)
//   gml_Object_obj_knight_rotating_slash_CleanUp_0.gml:16-42 (the sideb-111
//       endgame freeze this file exports as kaizoVortexendFreeze)
// Delta specs: knight-research/kaizo-mod/deltas/, same four names.
//
// COPY BASIS: sim/attacks/sword-vortex.js (the VERIFIED module). Every line
// not carrying a "KAIZO" comment is byte-identical to that module; read its
// header for the vanilla story (step order, the manager-is-a-bullet slot,
// the discarded choose() draw). Helpers still come from sim/ untouched.
//
// WHAT DIVERGES FROM THE SIM MODULE (each site carries the GML line):
//   1. Manager Create: vanilla's fixed `variant = 3` becomes context
//      selection — 4 when a swordfall / rotating slash is on screen at
//      create time, else 3, then 3.1 when myattackchoice == 20. The
//      controller's later `_manager.variant = difficulty` still runs AFTER
//      the parameter blocks (kaizo type 154 has no event_user(0) either —
//      gml_Object_obj_dbulletcontroller_Step_0.gml:3037-3047), so dc
//      difficulty stays as inert for the TABLES as it was in vanilla; the
//      mod moved the real switch into the Create's own context checks.
//   2. Manager Create: targetxoff/targetyoff fields, `rate = 1` fallback,
//      the variant 4 table (variant 3 minus centermoves — center pinned),
//      the variant 3.1 table (flatter sine, first sword next frame, wander
//      box 25px left), and `movespeed = 120 - (k_sideb * 20)` under
//      myattackchoice == 111.
//   3. Manager Step: `+ targetxoff` / `+ targetyoff` on the wander roll.
//      RNG draw count unchanged.
//   4. NEW kaizoVortexendStep / kaizoVortexendFreeze / vortexendBullet —
//      the sideb-111 endgame: when the rotating slash's CleanUp fires with
//      kaizo_sideb() && myattackchoice == 111, every vortex sword is frozen
//      into a plain obj_regularbullet that aims at the soul, pulls back 80px
//      over 16 frames (ease-in 2) while spinning +360°, recoils at speed -8,
//      then lunges (speed lerped -8 -> 40 over 15) and ends the turn at
//      timer 60 (global.turntimer = -1).
//
//   5. obj_sword_vortex Step's kaizo prefix (Step_0:1-10) — APPLIED: every
//      vortex blade takes image_blend = get_swordcolor() each frame (the
//      mod's blue; vanilla left them white), or c_white while a Stars cone
//      is on screen. Pure lookup, zero draws.
//
//   6. The cone arm's other two lines (Step_0:4-5) — APPLIED 2026-09-08:
//      sprite_index = spr_roaringknight_sword_ol_alt and
//      depth = obj_knight_pointing_cone.depth - 1. Until then the swap was
//      DELIBERATELY not stored, because the engine's contact path is
//      SPRITE_MASKS[sprite_index] (sim/masks.js spriteMaskHit) and the graze
//      path is `e.mask ?? SPRITE_MASKS[sprite_index]` (sim/index.js grazes),
//      and no _alt mask is registered there — storing the name would have
//      silently disarmed the sword. THE MASKS ARE THE SAME BITMAP: the
//      extraction's mask sha1 for spr_roaringknight_sword_ol_alt is
//      9a44b6583f4d91aac0c6364b7e438eb16f576400, identical to
//      spr_roaringknight_sword_ol's (knight-research/kaizo-mod/sprites/
//      sprites_kaizo.csv rows 4049 and 4998; same 75x31, origin 37,15, bbox
//      [7,13]..[66,17]), and kaizo/data/masks.js carries the extracted rows.
//      So the sword's mask is ALIASED here, kaizo-side, with no engine
//      change: `e.mask = SWORDOL_MASK` at create (the graze path's hook —
//      the very object SPRITE_MASKS.spr_roaringknight_sword_ol is, so
//      nothing moves while the sprite is still sword_ol) and a `collides`
//      override that runs spriteMaskHit's own test over that mask. That is
//      GameMaker's `mask_index = -1` resolved by hand for a sprite whose
//      bitmap the engine already owns. kaizo/tools/checks/check-colours.mjs
//      asserts the two extracted masks are row-identical and that the
//      swapped sword still hits and grazes. Collision cannot move (same
//      bitmap, same test, same call); depth is draw order only.
//
// NOT TRANSLATED (visual only — renderer work later, NO RNG in any of it):
//   - The freeze's `visible = false` on each sword IS stored: the sword's
//     own Step keeps running image_alpha += 0.1 afterwards (GML does the
//     same), so visibility — not alpha — is what hides it. The renderer
//     must honor e.visible === false for that to hold on screen.
//   - kaizo_vortexend_step's snd_play(snd_knight_jump / snd_knight_cut x2)
//     — audio; the sndcon handshake that gates them IS translated because
//     it is cross-instance state.
//   - scr_script_repeat(scr_afterimagefast, 999, 2) at lunge start —
//     cosmetic afterimage trail, no RNG (scr_afterimagefast copies fields,
//     draws nothing random).

import { spawn } from '../../sim/entity.js';
import {
  lengthdirX, lengthdirY, lerp, gmlEq, pointDirection, WHITE,
} from '../../sim/gml.js';
// The mod's palette, from the one shared source (kaizo/attacks/kaizo-colors.js)
// — never a private copy. getSwordcolor returns a STABLE array reference.
import { getSwordcolor } from './kaizo-colors.js';
import {
  scrBulletInit, collidebulletOther15, regularbulletCreate, regularbulletStep,
} from '../../sim/bullets/regularbullet.js';
import { gmlChoose, gmlIrandom } from '../../sim/rng.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { SWORDOL_MASK, HEART_MASK, masksOverlap } from '../../sim/masks.js';

const HEADINGS = [0, 45, 90, 135, 180, 225, 270, 315];

/** The kaizo-only blade art the cone arm swaps in (Step_0:4). */
export const SWORD_OL_ALT = 'spr_roaringknight_sword_ol_alt';

/**
 * The sword's contact test with its mask resolved by hand — see header
 * item 6. Byte-for-byte the body of sim/masks.js spriteMaskHit (same
 * masksOverlap call, same argument order, no `?? 1` defaults) with
 * `e.mask` in place of SPRITE_MASKS[e.sprite_index], so a blade wearing
 * spr_roaringknight_sword_ol_alt collides on the sha1-identical
 * spr_roaringknight_sword_ol bitmap the engine already carries. Returns
 * null with no mask, as spriteMaskHit does ("unmasked", counted).
 */
export function swordOlAliasHit(e, heart) {
  const m = e.mask;
  if (!m) return null;
  return masksOverlap(
    heart.mask ?? HEART_MASK, heart.x, heart.y,
    m, e.x, e.y, e.image_xscale, e.image_yscale, e.image_angle,
  );
}

function box(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
}

function manager(state) {
  return state.entities.find(
    (e) => e.alive && e.type.name === 'obj_sword_vortex_manager',
  );
}

/** GML `i_ex(obj_x)` over this engine's entity list. */
function iEx(state, name) {
  return state.entities.some((e) => e.alive && e.type.name === name);
}

export const swordVortex = {
  name: 'obj_sword_vortex',

  // MEASURED: these swords step BEFORE the manager that spawned them, so each
  // frame they orbit around the manager's PREVIOUS-frame `siner` and centre.
  // See the phaseList comment in sim/entity.js for the evidence.
  stepOrder: -1,

  create(e, state) {
    e.timer = 0;
    e.con = 0;
    e.dir = 0;
    e.image_alpha = 0;
    scrBulletInit(e);
    e.destroyonhit = 0;
    e.damage = 10;
    e.grazepoints = 2;
    e.timepoints = 1;
    e.spinspeed = 4;
    e.speedtowardscenter = 0.4;
    e.len = 70;
    e.sinpower = 65;
    e.sinspeed = 24;
    e.shrinkrate = 0;
    e.lenstart = e.len;
    e.sprite_index = 'spr_roaringknight_sword_ol';
    e.isBullet = true;
    // The mask alias (header item 6): the graze path reads `e.mask` first,
    // and this IS SPRITE_MASKS.spr_roaringknight_sword_ol — identical to
    // the default path until the cone arm swaps the sprite, identical in
    // bitmap after it (sha1 9a44b658… on both sprites).
    e.mask = SWORDOL_MASK;
  },

  step(e, state) {
    // KAIZO obj_sword_vortex Step_0:1-10 — THE VORTEX BLADES ARE BLUE, and
    // repainted every single frame:
    //
    //     if (i_ex(obj_knight_pointing_cone)) {
    //         image_blend  = c_white;
    //         sprite_index = spr_roaringknight_sword_ol_alt;
    //         depth        = obj_knight_pointing_cone.depth - 1;
    //     } else {
    //         image_blend = get_swordcolor();
    //     }
    //
    // Vanilla has no prefix at all, so a vortex sword was plain white for
    // its whole life. get_swordcolor() is a pure switch on
    // global.kaizo_swordtype (scr_complete_save_file.gml:269-286) — NO RNG,
    // and the STABLE reference from kaizo-colors.js, so a later
    // `image_blend == get_swordcolor()` gate would still compare true.
    //
    // ALL THREE LINES OF THE CONE ARM ARE APPLIED (2026-09-08; the swap and
    // the depth were held back until the mask alias in `create` made the
    // swap safe — header item 6). `_alt` is the PRE-PAINTED blue-and-white
    // blade (kaizo-only art, kaizo/assets/sprites/), drawn untinted;
    // `depth` puts it one step above the cone. The cone's own depth is the
    // object default 0 (objects_kaizo.csv: obj_knight_pointing_cone depth
    // 0; no code entry of it writes `depth`), which this engine leaves
    // undefined — hence `?? 0`. Note the mod never swaps BACK: a blade that
    // saw a cone keeps `_alt` and its depth after the cone dies, and so
    // does this one. `obj_knight_pointing_cone.depth` reads the FIRST live
    // cone in GML's object-index enumeration — the oldest — and there is
    // only ever one.
    const cone = state.entities.find(
      (x) => x.alive && x.type.name === 'obj_knight_pointing_cone',
    );
    if (cone) {
      e.image_blend = WHITE;
      e.sprite_index = SWORD_OL_ALT;
      e.depth = (cone.depth ?? 0) - 1;
    } else {
      e.image_blend = getSwordcolor(state);
    }

    e.image_alpha += 0.1;

    // Spins faster the closer in it is.
    e.dir -= e.spinspeed * lerp(2, 1, e.len / 120);
    e.image_angle = e.dir - 90;

    const mg = manager(state);
    if (mg) {
      // The radius breathes on the MANAGER's clock, so all six swords pulse
      // together.
      e.len = e.lenstart + Math.sin(mg.siner / e.sinspeed) * e.sinpower;
      e.x = mg.swordcirclecenterx + lengthdirX(e.len, e.dir);
      e.y = mg.swordcirclecentery + lengthdirY(e.len, e.dir);
      e.lenstart -= e.shrinkrate;
    }

    e.timer += 1;
    if (e.timer % 4 === 0) e.grazed = 0;
  },

  // `mask_index = -1` resolved by hand (header item 6): the same test the
  // engine's default path runs, over the aliased mask, so the `_alt` sprite
  // collides exactly as spr_roaringknight_sword_ol does.
  collides: swordOlAliasHit,

  other15: collidebulletOther15,
};

export const swordVortexManager = {
  name: 'obj_sword_vortex_manager',

  create(e, state) {
    // A COLLIDEBULLET IN ITS OWN RIGHT. The object's parent chain (dumped via
    // object_parents.csx) is obj_sword_vortex_manager -> obj_regularbullet -> the
    // collidebullet base — so the real game's bullet enumeration counts the
    // MANAGER itself, sitting at (growtangle.x, cameray()) from its creation
    // frame. The whole-fight differ pairs bullets by slot, and without this
    // flag every bullet of the turn sat one slot early against the recording
    // (turn 2's f450: oracle b0 is the manager, sim b0 was the first sword).
    // maskOff keeps it out of the collision and graze loops: parked at the
    // camera top it never touches the soul, and its own damage never fires.
    e.isBullet = true;
    e.maskOff = true;
    const gt = box(state);
    e.timer = 0;
    e.siner = 0;
    e.con = 0;

    // KAIZO manager Create_0:4-18 — vanilla's fixed `variant = 3` becomes:
    //     if (i_ex(obj_knight_swordfall) || i_ex(obj_knight_rotating_slash))
    //         variant = 4;  else variant = 3;
    //     with (obj_knight_enemy) if (myattackchoice == 20)
    //         other.variant = 3.1;
    // Creation order decides variant 4: whichever attack object already
    // exists when THIS Create runs. state.currentAc is this sim's
    // obj_knight_enemy.myattackchoice (see sim/scenes/fight.js:284); the
    // `with` guard (no knight -> no override) maps to currentAc being unset.
    if (iEx(state, 'obj_knight_swordfall') || iEx(state, 'obj_knight_rotating_slash')) {
      e.variant = 4;
    } else {
      e.variant = 3;
    }
    if (state.currentAc === 20) e.variant = 3.1;

    e.firstsword = false;
    e.swordcount = 0;
    // KAIZO-live defaults (vanilla Create_0:21-32). The sim module omitted
    // the ones its always-variant-3 block overwrote; kaizo's variant 4 table
    // sets NO centermoves/movespeed, so the defaults now decide behavior
    // (center pinned, movespeed 60 for the ac-111 override's baseline).
    e.sinpower = 65;
    e.sinspeed = 24;
    e.startinglen = 70;
    e.shrinkrate = 0;
    e.multiswordmax = 0;
    e.multiswordframes = 0;
    e.multiswordcon = 0;
    e.multiswordcount = 0;
    e.centermoves = 0;
    e.centermovescon = 0;
    e.centermovestimer = 0;
    e.movespeed = 60;
    e.swordcirclecenterx = gt ? gt.x : 320;
    e.swordcirclecentery = gt ? gt.y : 170;
    e.startx = e.swordcirclecenterx;
    e.starty = e.swordcirclecentery;
    e.targetx = 0;
    e.targety = 0;
    e.setcount = 0;
    // KAIZO manager Create_0:40-41 — the wander-target offset fields.
    e.targetxoff = 0;
    e.targetyoff = 0;
    e.setdirection = new Array(50).fill(-1);
    scrBulletInit(e);
    // KAIZO manager Create_0:49 — safety default; vanilla only defined
    // `rate` inside variant blocks, and with fractional variants a miss
    // would crash on `timer = rate - 5`. Unreachable in practice (the
    // selection above always lands on a table below), carried faithfully.
    e.rate = 1;

    // Variant 0/1/2 tables (kaizo Create_0:50-99, vanilla-identical):
    // UNREACHABLE — the kaizo selection only ever produces 3, 4 or 3.1, and
    // the controller's `_manager.variant = difficulty` runs after these
    // blocks with no event_user(0) re-fire (dbulletcontroller Step_0:
    // type == 154), the same inertia the sim module documents for vanilla.
    // Not translated, same policy as the sim module's vanilla copy.

    // Variant 3 (kaizo Create_0:100-119) — byte-for-byte the sim module's
    // always-taken block, now genuinely conditional.
    if (gmlEq(e.variant, 3)) {
      e.rate = 11;
      e.ratedecay = 0;
      e.rateminimum = 1;
      e.maxswords = 6;
      e.multiswordmax = 2;
      e.multiswordframes = 1;
      e.sinpower = 17;
      e.sinspeed = 22;
      e.startinglen = 80;
      for (let i = 1; i <= 6; i++) e.setdirection[i] = i % 2 === 1 ? 0 : 180;
      e.centermoves = 1;
      e.movespeed = 60;
    }
    // KAIZO manager Create_0:120-137 — NEW variant 4 (vortex overlaying a
    // swordfall / rotating slash): identical numbers to variant 3 EXCEPT no
    // centermoves/movespeed — the center stays pinned at the growtangle
    // while the paired attack provides the movement pressure.
    if (gmlEq(e.variant, 4)) {
      e.rate = 11;
      e.ratedecay = 0;
      e.rateminimum = 1;
      e.maxswords = 6;
      e.multiswordmax = 2;
      e.multiswordframes = 1;
      e.sinpower = 17;
      e.sinspeed = 22;
      e.startinglen = 80;
      for (let i = 1; i <= 6; i++) e.setdirection[i] = i % 2 === 1 ? 0 : 180;
    }

    e.timer = e.rate - 5;

    // KAIZO manager Create_0:139-160 — NEW variant 3.1 (myattackchoice 20),
    // placed AFTER `timer = rate - 5` so its `timer = 10` overrides it: the
    // first sword fires on the manager's NEXT step (10+1 == rate 11) where
    // variants 3/4 wait five frames. Flatter, slower sine (8/10 vs 17/22),
    // wider start ring (90), and the wander box shifted 25px left.
    if (gmlEq(e.variant, 3.1)) {
      e.rate = 11;
      e.timer = 10;
      e.ratedecay = 0;
      e.rateminimum = 1;
      e.maxswords = 6;
      e.multiswordmax = 2;
      e.multiswordframes = 1;
      e.sinpower = 8;
      e.sinspeed = 10;
      e.startinglen = 90;
      for (let i = 1; i <= 6; i++) e.setdirection[i] = i % 2 === 1 ? 0 : 180;
      e.centermoves = 1;
      e.movespeed = 60;
      e.targetxoff = -25;
    }

    // KAIZO manager Create_0:161-167 — attack 111 (vortex + rotating slash
    // d8) doubles the center-move duration:
    //     with (obj_knight_enemy) if (myattackchoice == 111)
    //         other.movespeed = 120 - (k_sideb * 20);
    // 120 on side A, 100 on the B-Side. In the mod's Other_23 the vortex
    // spawns FIRST for attack 111 (rotating slash second), so the variant-3
    // path is live here and this override matters — preserve that creation
    // order in the launcher. k_sideb reads as state.kaizo?.sideb.
    if (state.currentAc === 111) {
      e.movespeed = 120 - ((state.kaizo?.sideb ? 1 : 0) * 20);
    }
  },

  step(e, state) {
    e.timer += 1;
    e.siner += 1;

    const gt = box(state);

    const fire =
      (e.timer === e.rate && e.swordcount < e.maxswords) ||
      (e.timer === e.multiswordframes && e.multiswordcon === 1);

    if (fire) {
      const inst = spawn(state, swordVortex, {
        x: gt ? gt.x : 320,
        y: gt ? gt.y : 170,
      });

      // Rolled, then thrown away by setdirection below — but the draw is
      // taken, so it must be taken here too.
      inst.dir = gmlChoose(state.gmlRng, HEADINGS);
      inst.variant = e.variant;
      inst.sinpower = e.sinpower;
      inst.sinspeed = e.sinspeed;
      inst.len = e.startinglen;
      inst.lenstart = inst.len;
      inst.shrinkrate = e.shrinkrate;
      inst.damage = e.damage;
      inst.target = e.target;

      e.swordcount += 1;
      e.setcount += 1;
      if (e.setdirection[e.setcount] !== -1) inst.dir = e.setdirection[e.setcount];

      if (e.multiswordmax > 0) e.multiswordcount += 1;
      if (e.multiswordcon === 0 && e.multiswordmax > 0) e.multiswordcon = 1;
      if (e.multiswordcon === 1 && e.multiswordcount === e.multiswordmax) {
        e.multiswordcon = 0;
        e.multiswordcount = 0;
      }

      inst.x = inst.xstart + lengthdirX(inst.len, inst.dir);
      inst.y = inst.ystart + lengthdirY(inst.len, inst.dir);
      inst.image_angle = inst.dir - 90;

      e.rate -= e.ratedecay;
      if (e.rate < e.rateminimum) e.rate = e.rateminimum;
      e.timer = 0;
    }

    if (e.centermoves === 1) {
      if (e.centermovescon === 0) {
        e.startx = e.swordcirclecenterx;
        e.starty = e.swordcirclecentery;
        const rec = state.vortexTargets ? state.vortexTargets[state.vortexIndex++] : null;
        // KAIZO manager Step_0:53-54 — the only Step change:
        //     targetx = (obj_growtangle.x - 60) + irandom(120) + targetxoff;
        //     targety = (obj_growtangle.y - 60) + irandom(120) + targetyoff;
        // Same two irandom draws in the same order; only the trailing offset
        // is new (nonzero only for variant 3.1's targetxoff = -25).
        e.targetx = rec
          ? rec.x
          : (gt ? gt.x : 320) - 60 + gmlIrandom(state.gmlRng, 120) + e.targetxoff;
        e.targety = rec
          ? rec.y
          : (gt ? gt.y : 170) - 60 + gmlIrandom(state.gmlRng, 120) + e.targetyoff;
        e.centermovescon = 1;
      }
      if (e.centermovescon === 1) {
        e.centermovestimer += 1;
        e.swordcirclecenterx = lerp(e.startx, e.targetx, e.centermovestimer / e.movespeed);
        e.swordcirclecentery = lerp(e.starty, e.targety, e.centermovestimer / e.movespeed);
        if (e.centermovestimer === e.movespeed) {
          e.centermovestimer = 0;
          e.centermovescon = 0;
        }
      }
    }
  },
};

// ── the sideb-111 endgame — kaizo_vortexend_step ───────────────────────────
//
// gml_Object_obj_knight_rotating_slash_CleanUp_0.gml:16-42: when the
// rotating slash of attack 111 ends on the B-Side, every obj_sword_vortex is
// frozen into a fresh plain obj_regularbullet (position, sprite, angle,
// scales, damage copied; destroyonhit 0, wall_destroy 0) driven every frame
// by kaizo_vortexend_step via scr_script_repeat(kaizo_vortexend_step, 999, 1)
// while the sword itself is deactivated and hidden. global.turntimer = 999
// buys the endgame its time; the step stomps it to -1 at timer 60.

/**
 * kaizo_vortexend_step (kaizo_settings_init.gml:137-190), run in the frozen
 * bullet's own context every frame. No RNG anywhere in it.
 *
 * con 0 (one frame): aim at soul centre (obj_heart.x/y + 10), arm three
 * 16-frame ease-in(2) tweens — x/y pulled 80px AWAY from the soul
 * (lengthdir of _pnt - 180) and image_angle to _pnt + 360, one full spin
 * landing pointed at where the soul was. con 1: `direction = image_angle`
 * every frame; timer 20 recoils at speed -8 (with the double cut sound the
 * sndcon handshake gates — audio skipped); timer 21 lerps speed -8 -> 40
 * over 15 frames (the lunge; its scr_afterimagefast trail is cosmetic,
 * skipped); timer 60 sets global.turntimer = -1, ending the turn.
 *
 * The `with (obj_regularbullet) if (variable_instance_exists(id, "sndcon"))`
 * broadcasts translate as "every alive entity that defines sndcon" — only
 * the frozen vortexend bullets do, exactly the set the guard selects in GML.
 */
export function kaizoVortexendStep(e, state) {
  e.timer += 1;
  if (e.con === 0) {
    if (e.sndcon === 0) {
      // snd_play(snd_knight_jump) — audio, renderer-side; see the header.
    }
    for (const b of state.entities) {
      if (b.alive && b.sndcon !== undefined) b.sndcon = 1;
    }
    // NO SOUL, NO AIM — same guard pattern as tracking-swords: obj_heart
    // always exists when the real CleanUp fires; a harness without one gets
    // the arena centre instead of a crash.
    const hx = state.soul && state.soul.alive ? state.soul.x : 310;
    const hy = state.soul && state.soul.alive ? state.soul.y : 160;
    let _pnt = pointDirection(e.x, e.y, hx + 10, hy + 10);
    scrLerpvar(state, spawn, e, 'x', e.x, e.x + lengthdirX(80, _pnt - 180), 16, 2, 'in');
    scrLerpvar(state, spawn, e, 'y', e.y, e.y + lengthdirY(80, _pnt - 180), 16, 2, 'in');
    _pnt += 360;
    scrLerpvar(state, spawn, e, 'image_angle', e.image_angle, _pnt, 16, 2, 'in');
    e.con = 1;
    e.timer = 0;
  } else if (e.con === 1) {
    if (e.timer === 20) {
      e.speed = -8;
      if (e.sndcon === 1) {
        // snd_play(snd_knight_cut); snd_play(snd_knight_cut, 1, 0.75) —
        // audio, skipped; the handshake below is the translated part.
      }
      for (const b of state.entities) {
        if (b.alive && b.sndcon !== undefined) b.sndcon = 2;
      }
    }
    e.direction = e.image_angle;
    if (e.timer === 21) {
      scrLerpvar(state, spawn, e, 'speed', -8, 40, 15);
      // scr_script_repeat(scr_afterimagefast, 999, 2) — cosmetic, no RNG,
      // skipped (see the header).
    }
    if (e.timer === 60) {
      state.turntimer = -1; // global.turntimer = -1 — the turn ends here.
    }
  }
}

/**
 * The frozen sword — a plain obj_regularbullet instance (that IS its object
 * in the mod: `instance_create(x, y, obj_regularbullet)`), with the
 * per-frame kaizo_vortexend_step attached. scr_script_repeat(fn, 999, 1)
 * is modeled INSIDE the step: obj_script_delayed (constant=1, rate=1,
 * timer=999) fires on its own first Step — the frame after creation — and
 * every frame thereafter, in the target's context, immediately after the
 * bullet's own Step in creation order (bullet A, repeat A, bullet B,
 * repeat B interleave exactly as base-then-helper per entity here). Its
 * 999-call cap is not modeled: the turn ends at timer 60, frame ~61.
 */
export const vortexendBullet = {
  name: 'obj_regularbullet',

  create(e, state) {
    regularbulletCreate(e, state); // obj_regularbullet Create_0
  },

  step(e, state) {
    regularbulletStep(e, state); // obj_regularbullet Step_0
    kaizoVortexendStep(e, state); // the constant script_repeat, rate 1
  },

  // The freeze copies the sword's sprite_index, and a sword that has seen a
  // Stars cone wears spr_roaringknight_sword_ol_alt — so the frozen bullet
  // carries the same mask alias (`b.mask` below) and the same resolved test.
  // Unreachable in the shipped schedule (attack 111 has no cone) and cheap
  // to be right about.
  collides: swordOlAliasHit,

  other15: collidebulletOther15,
};

/**
 * The freeze itself — obj_knight_rotating_slash CleanUp_0:18-41, the
 * `with (obj_sword_vortex)` body plus the `global.turntimer = 999` that
 * follows it. The rotating-slash/launcher side calls this INSTEAD of the
 * vanilla `global.turntimer = -1` when its CleanUp's end-of-turn branch
 * fires with `kaizo_sideb() && obj_knight_enemy.myattackchoice == 111`
 * (state.kaizo?.sideb && state.currentAc === 111). Field-by-field per the
 * GML; image_blend is carried although the renderer ignores it today.
 */
export function kaizoVortexendFreeze(state) {
  for (const sw of [...state.entities]) {
    if (!sw.alive || sw.type.name !== 'obj_sword_vortex') continue;
    const b = spawn(state, vortexendBullet, { x: sw.x, y: sw.y });
    b.timer = 0;
    b.sndcon = 0;
    b.con = 0;
    b.sprite_index = sw.sprite_index;
    b.mask = sw.mask; // engine plumbing, not GML: the mask alias travels with the sprite name (header item 6)
    b.active = 1;
    b.image_angle = sw.image_angle;
    b.direction = sw.direction;
    b.image_xscale = sw.image_xscale;
    b.image_yscale = sw.image_yscale;
    b.image_blend = sw.image_blend;
    b.damage = sw.damage;
    b.destroyonhit = 0;
    b.wall_destroy = 0;
    // scr_script_repeat(kaizo_vortexend_step, 999, 1) — inside
    // vortexendBullet.step; first call lands next frame, like the repeat's
    // own first Step would.
    sw.active = 0;
    sw.image_alpha = 0;
    sw.visible = false;
  }
  state.turntimer = 999; // global.turntimer = 999
}
