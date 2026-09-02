// KAIZO DRAW — the tracking-sword slashes and the Knight himself. PORTED:
// each export below is a translation of the KAIZO Draw event for its object
// (every call, in order, with the sprite, subimage, origin, scale, angle,
// colour and alpha the GML passes), and the stub notes that follow are kept
// verbatim as the record of the vanilla path each port replaced.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 — do not
// publish without permission (kaizo/HANDOFF.md §5-C).
//
// What the mod changed in this family (diffed, gml_vanilla_v105 -> kaizo):
//   obj_tracking_sword_slash Draw_0:2         `timer == 2` (vanilla 3) — a
//                                             lifetime, no draw call; the sim
//                                             carries it (tracking-swords.js).
//   obj_tracking_sword_slash_extra_graze      Draw_0 is `draw_self();` alone —
//                                             the v105 `timer++ / == 3` moved
//                                             to Step_0:30-34 (tracking-swords.js
//                                             carries that too). Invisible by
//                                             its Create, so it never draws.
//   obj_knight_enemy Draw_0:1                 the bob gate's `|| turntimer < 5`
//                                             (state — kaizo-knight-actor.js draw)
//                    Draw_0:35, 58-90         ghosts wear `idlesprite` and the
//                                             7-colour cycle (state — the actor)
//                    Draw_0:93-142            NEW `state == 10` block: ghost
//                                             spawn (state) + `draw_self()`
//                    Draw_0:151-187           the ending's trigger reworked
//                                             (state — kaizo-vc-hooks.js
//                                             endCutsceneReached)
//                    Draw_0:199-206           the ordinary hurt strobe draws
//                                             `idlesprite` on BOTH arms — the
//                                             ball frame only survives in the
//                                             ending's %3 strobe (:188-198)
//                    Draw_0:209               snd_knight_hurt for hurtb (audio)
//                    Draw_0:221-224           NEW whiteflash copy for state 10
//                    Draw_64                  NEW GUI event, practice-mode HUD —
//                                             nothing on the fight path (below)
//
// The renderer READS. Every counter these Draws bump (siner2, aetimer,
// chargeuptimer, whiteflash--, fsiner/siner inside scr_enemy_drawidle_generic,
// the becomeflash latch, the extra-graze/slash timers) lives in the sim:
// sim/actors.js + sim/knight.js for the vanilla-shaped ones, kaizo/actors/
// kaizo-knight-actor.js for the mod's, kaizo/attacks/tracking-swords.js for
// the two bars. No RNG is called in any of the three Draws.
//
// (Stub header, kept:) STUBS:
// every export delegates to the vanilla drawer through `helpers.drawVanilla`,
// so these objects render on the kaizo page exactly as they do on the main
// page until each is ported.
//
// Contract and helpers: kaizo/render/index.js. The vanilla model is
// render/draw/swords.js drawTrackingSwordsManager (the additive, box-clipped
// slash surface) and, for the Knight, render/knightdraw.js knightDrawCalls
// plus the DRAW_EVENTS.obj_knight_enemy handler in render/canvas.js.
//
// The kaizo GML (read-only, never copied here):
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/gml_Object_<obj>_Draw_0.gml
//   (obj_knight_enemy also has gml_Object_obj_knight_enemy_Draw_64.gml — the
//   GUI-layer draw, in screen space over everything; the seam has no GUI
//   slot, so a port of it is a decision for the family's port, not a stub.)
// diffed against gml_vanilla_v105/CodeEntries/.

import { C_WHITE, NO_FOG } from '../../../render/knightdraw.js';
import { kaizoIdlesprite } from '../../actors/kaizo-knight-actor.js';

/** GML c_red, as the [r, g, b] the renderer's tint helpers take. */
const C_RED_RGB = [255, 0, 0];
/** The ball frame the hurt strobe alternates with — Draw_0:196 (`, 7,`). */
const SPR_BALL = 'spr_roaringknight_ball_transition';
/**
 * `hurtsprite`. Create_0:6 sets spr_roaringknight_idle, and Step_0:113
 * (vanilla Step_0:42, identical) sets spr_roaringknight_hurt inside
 * `damagereductiontimer == 1` — the fight's first Step, unconditionally — so
 * every Draw that can reach the whiteflash-while-hurt copy reads the hurt
 * sheet (3 frames, origin (0,0), 100x93; index 0 is what Draw_0:227 passes).
 * render/knightdraw.js draws that record with spr_roaringknight_idle on the
 * reading that "hurtsprite is the SAME sprite as idlesprite (Create sets
 * both)" — Create does, Step_0:42 then overrides it; that is the vanilla
 * port's row and outside this file. The mod's sprite is in the kaizo overlay
 * (kaizo/assets/sprites/manifest.json).
 *
 * REACHED ON EVERY KAIZO BLOCK (verifier pass): kaizo Step_0:123-133 sets
 * `whiteflash = 2; state = 3; hurttimer = 30` together when a non-crit FIGHT
 * hit is blocked (`kaizo_block`, kaizo-vc-hooks.js fightDamage), so the two
 * frames after a block draw this record — the hurt sheet's frame 0, origin
 * (0, 0), fogged white at 0.62 over the block pose. The sim carried the
 * arm but not those three writes; kaizo/actors/kaizo-knight-actor.js
 * kaizoBlockStepTail carries them now (ordered after stepKnightAnim as the
 * GML orders them after the hurt tick's caller).
 */
const SPR_HURT = 'spr_roaringknight_hurt';
/**
 * obj_tracking_sword_slash_extra_graze's sprite is set on the OBJECT
 * DEFINITION, not in any event (CLAUDE.md, "A sprite set on the OBJECT is
 * invisible to every grep"): spr_pxwhite2, 1x2, origin (0,1), precise — the
 * name kaizo/attacks/tracking-swords.js's header records from the mask work.
 * The sim never assigns `sprite_index` on the band, and render/sprites.js
 * SPRITE_FOR has no row for it, so `draw_self()` has to name it here.
 */
const SPR_PXWHITE2 = 'spr_pxwhite2';

/** `i_ex(obj_knight_swordtunnelanim)` — the Draw's first `exit`. */
function tunnelAnimAlive(state) {
  return !!state.entities?.some(
    (x) => x.alive && x.type?.name === 'obj_knight_swordtunnelanim',
  );
}

/**
 * A GameMaker colour as the [r, g, b] blit()/tinted()/fogged() take. The
 * vanilla knight path carries `image_blend` as a GameMaker BGR INTEGER
 * (render/knightdraw.js, so the draw log can compare it to the oracle), and
 * the kaizo modules carry theirs as [r, g, b] arrays (kaizo-colors.js) —
 * both spellings arrive here. `null` is "no tint": c_white multiplies to the
 * sprite itself and blit() skips the recolour for it, exactly as the vanilla
 * handler does (`d.blend === C_WHITE_GM ? null : rgbOf(d.blend)`).
 */
function tintOf(c, rgbOf) {
  if (c == null) return null;
  if (Array.isArray(c)) {
    return (c[0] === 255 && c[1] === 255 && c[2] === 255) ? null : c;
  }
  return c === C_WHITE ? null : rgbOf(c);
}
/** A fog colour, either spelling, as [r, g, b] (fog REPLACES, so white is not a no-op). */
function fogOf(c, rgbOf) {
  return Array.isArray(c) ? c : rgbOf(c);
}

/**
 * obj_tracking_sword_slash — PORTED. The whole kaizo Draw_0 (lines 1-5) is
 *
 *     timer++;
 *     if (timer == 2) instance_destroy();
 *
 * — the vanilla event with `3` for `2` (the diff's one line), and no draw
 * call: the bar is a 900x1 spr_pxwhite2 that reaches the screen only through
 * obj_tracking_swords_manager's Draw (its surface, additive and box-clipped —
 * render/draw/swords.js drawTrackingSwordsManager), and THAT Draw is
 * byte-identical between the two dumps (diffed), so the manager's vanilla
 * drawer keeps drawing it. The timer is Draw-time state and the sim carries
 * it where the vanilla sim carries its own: kaizo/attacks/tracking-swords.js
 * trackingSwordSlash.endStep, `if (e.timer === 2) destroy(e)`. Returning true
 * claims the draw so the tail's generic blit does not paint the bar a second
 * time over the manager's copy — the same contract the vanilla DRAW_EVENTS
 * entry (`() => true`) meets.
 *
 * (Stub note, kept:) obj_tracking_sword_slash — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: render/canvas.js DRAW_EVENTS.obj_tracking_sword_slash is
 * `() => true` — the vanilla event is only `timer++; if (timer == 3)
 * instance_destroy();` (carried in the sim's endStep) and the slash reaches
 * the screen through obj_tracking_swords_manager's surface. A port that adds
 * a draw of its own here draws it TWICE unless the manager's copy is
 * accounted for.
 * Sim side: kaizo/attacks/tracking-swords.js.
 */
export function drawObjTrackingSwordSlash() {
  return true;
}

/**
 * obj_tracking_sword_slash_extra_graze — PORTED. The whole kaizo Draw_0 is
 * line 1, `draw_self();` (the v105 event's `timer++; if (timer == 3)
 * instance_destroy();` on its lines 2-6 moved to the END of Step_0, lines
 * 30-34, which kaizo/attacks/tracking-swords.js trackingSlashExtraGraze.step
 * carries).
 *
 * IT NEVER RUNS. Create_0:6 is `visible = false;` and no event in either dump
 * sets it back (the sim's Create does the same, tracking-swords.js:133), and
 * GameMaker does not run a Draw event for an invisible instance — nor does
 * the seam: render/canvas.js filters `visible === false` out before the loop
 * (the smoke reports this override as "not reached", by construction). The
 * translation is here so the day something makes the band visible it draws
 * what the game would: `draw_self()` = draw_sprite_ext(sprite_index,
 * image_index, x, y, image_xscale, image_yscale, image_angle, image_blend,
 * image_alpha) — spr_pxwhite2 off the object definition (SPR_PXWHITE2 above),
 * xscale 900 / yscale 7 (Create_0:3-4; the sim sets both), image_blend c_red
 * (Create_0:5 — the sim carries no blend on the band, so the Create's value
 * is the default here), alpha 1. Drawn directly rather than through the tail
 * because the tail's generic blit resolves the sprite through SPRITE_FOR,
 * which has no row for this object and would draw nothing.
 *
 * (Stub note, kept:) obj_tracking_sword_slash_extra_graze — NOT PORTED. Kaizo Draw_0 exists.
 * Vanilla today: NO DRAW_EVENTS entry — the generic sprite blit
 * (render/canvas.js drawEntity), or the SPRITE_MASKS silhouette; whether the
 * instance is even visible is the sim's call (kaizo/attacks/tracking-swords.js).
 * Sim side: kaizo/attacks/tracking-swords.js.
 */
export function drawObjTrackingSwordSlashExtraGraze(ctx, e, state, helpers) {
  const { sprites, blit, rgbOf } = helpers;
  const entry = sprites.get(e.sprite_index ?? SPR_PXWHITE2);
  // No sprite and no mask in the pack for a 1x2 white pixel: nothing the tail
  // could add, so the draw is claimed either way.
  if (!entry || !entry.frames.length) return true;
  const idx = Math.abs(Math.floor(e.image_index ?? 0)) % entry.frames.length;
  blit(entry.frames[idx], entry.meta.ox, entry.meta.oy, e.x, e.y,
    e.image_xscale ?? 900, e.image_yscale ?? 7, e.image_angle ?? 0,
    e.image_alpha ?? 1, tintOf(e.image_blend ?? C_RED_RGB, rgbOf));
  return true;
}

/**
 * THE KAIZO KNIGHT'S DRAW, AS DATA — the ordered list of draw calls
 * obj_knight_enemy's kaizo Draw_0 makes this frame, in the record shape
 * render/knightdraw.js knightDrawCalls uses ({sprite, index, x, y, xs, ys,
 * ang, blend, alpha, fog}), so the blit loop below is the vanilla handler's
 * loop and the two ports can be read against each other line by line.
 *
 * Kept as a pure, DOM-free function for the reason knightdraw.js gives: the
 * decisions are checkable headlessly, only the blitting needs a canvas.
 * Everything here that is not a draw call is a citation of where the sim
 * carries the state the GML mutates at that line.
 *
 * `sinerIdle` is knightdraw.js's split: `siner += 1/6` happens INSIDE
 * scr_enemy_drawidle_generic (Draw_0:216), so calls above that line see the
 * old index and calls below it the new one — measured there against the
 * vanilla draw log (-1/6 on every base row, 0 on every strobe row). The
 * helper is byte-identical in the kaizo dump (diffed), as are
 * draw_monster_body_part and draw_sprite_ext_flash, so the split holds.
 */
export function kaizoKnightDrawCalls(state, e) {
  const k = state.knight;
  const out = [];
  if (!k || !e) return out;

  const idle = kaizoIdlesprite(e, k);
  const xs = e.image_xscale ?? 1;
  const ys = e.image_yscale ?? 1;
  const ang = e.image_angle ?? 0;
  const alpha = e.image_alpha ?? 1;
  const blend = e.image_blend ?? C_WHITE;
  const siner = k.siner ?? 0;
  const sinerIdle = k.animState === 0 ? siner + (1 / 6) : siner;
  // hurtspriteoffx / hurtspriteoffy: scr_enemy_object_init zeroes both and no
  // event in either dump assigns them (sim/actors.js records the whole-dump
  // grep). shakex is the record's, not the entity's — the Draw adds it at the
  // sites that shake and draw_monster_body_part uses plain x.
  const offx = 0;
  const offy = 0;
  const shakex = k.shakex ?? 0;
  const hurttimer = k.hurttimer ?? 0;

  // AN INVISIBLE INSTANCE HAS NO DRAW EVENT AT ALL (the Stars cone's
  // `obj_knight_enemy.visible = false`). The seam filters these before any
  // override runs; the test is repeated so this list is honest on its own.
  if (e.visible === false) return out;

  // Draw_0:1-4 — `siner2++` under the mod's gate: state, in
  // kaizo/actors/kaizo-knight-actor.js draw (the engine's draw slot).

  // Draw_0:5-8 — `if (i_ex(obj_knight_swordtunnelanim)) exit;`
  if (tunnelAnimAlive(state)) return out;

  // Draw_0:9-21 — the ROARING launch's burn-out, and its `exit`:
  //
  //     chargeuptimer++;                                  (state: sim/actors.js endStep)
  //     d3d_set_fog(true, c_white, 0, 1);
  //     draw_sprite_ext(idlesprite, siner, x, y, image_xscale, image_yscale,
  //                     image_angle, image_blend, (10 - chargeuptimer) / 10);
  //     d3d_set_fog(false, c_black, 0, 0);
  //     if (chargeuptimer == 10) { chargeupcon = 3; image_alpha = 0; }  (state, same place)
  //     exit;
  //
  // Identical to vanilla (diffed). con 3 does NOT exit — the Knight is drawn
  // at image_alpha 0 through the roar, as knightdraw.js records.
  if (k.chargeupcon === 2) {
    out.push({
      tag: 'burnout', sprite: idle, index: siner, x: e.x, y: e.y,
      xs, ys, ang, blend, alpha: (10 - (k.chargeuptimer ?? 0)) / 10, fog: C_WHITE,
    });
    return out;
  }

  // Draw_0:22-92 — `if (state == 0 || state == 3)`: image_index = 0, the bob
  // (y = ystart + cos(siner2 / 8) * 8), aetimer++, and every 4th frame an
  // obj_afterimage spawned at depth + 1 (idle-branch ghost :32-37, hurt-branch
  // ghost :38-51, the shared alpha/fade/hspeed/scale :52-57, the mod's
  // rgbafterimages colour ladder :58-90). ALL STATE, no draw call: the bob is
  // sim/actors.js knightActor.draw, the spawn is knightActor.step, the ghost's
  // `idlesprite` and colour are kaizo-knight-actor.js step. The ghosts are
  // entities of their own and draw at their own depth through the generic
  // blit (render/canvas.js DRAW_EVENTS.obj_afterimage lets them through
  // unless the roar owns the frame).

  // Draw_0:93-142 — NEW in the mod, `if (state == 10)`: aetimer++ and the same
  // every-4th-frame ghost of `sprite_index`/`image_index` with the colour
  // ladder (:95-140, state), then `draw_self();` (:141) — the Knight's own
  // sprite, whatever it is, at his own scale/angle/blend/alpha. State 10 is
  // the mod's scene pose (Step_0:1419 `state = 10` in the no-hit reward, the
  // `k_scenefloat` float); the sim models those scenes on a separate record
  // (kaizo/party/scenes.js ensureScenes(state).knight.knightState, .spriteIndex)
  // that the knight entity does not mirror, so this branch is dormant until
  // the scenes owner writes state.knight.animState = 10 and e.sprite_index —
  // it is translated against the entity because that is what draw_self reads.
  if (k.animState === 10) {
    out.push({
      tag: 'self10', sprite: e.sprite_index ?? idle, index: e.image_index ?? 0,
      x: e.x, y: e.y, xs, ys, ang, blend, alpha, fog: NO_FOG,
    });
  }

  // Draw_0:143-148 — `if (end_cutscene_version == 1) { stronghurtanim = true;
  // state = 3; shakex = 0; }`: state, sim/knight.js stepEndCutscene.

  // Draw_0:149-215 — `if (state == 3 && hurttimer >= 0)`, the hurt strobe.
  if (k.animState === 3 && hurttimer >= 0) {
    // :151-187 — the ending's trigger (chargeupcon == 0 && !dont_fucking_kill_
    // the_knight && haveusedroaring && ecv == 0 && hp <= maxhp * 0.6 && endcon
    // != 1 && blockanim <= 0, then the writer/spellphase teardown, the shake,
    // hurttimer = 999, three snd_knight_hurt): state + audio, carried by
    // kaizo/scenes/kaizo-vc-hooks.js endCutsceneReached and sim/knight.js
    // startEndCutscene. No draw call.
    if (k.endCutscene === 1) {
      // :188-198 — the ending strobes on %3 and DOES keep the ball frame:
      //     if ((hurttimer % 3) == 0 || stronghurtanim == false)
      //         draw_sprite_ext(idlesprite, siner, x + shakex + hurtspriteoffx, y + hurtspriteoffy, 2, 2, 0, image_blend, 1);
      //     else
      //         draw_sprite_ext(spr_roaringknight_ball_transition, 7, <same>, 2, 2, 0, image_blend, 1);
      // Identical to vanilla :99-108.
      const showIdle = (hurttimer % 3) === 0 || !k.stronghurtanim;
      out.push(showIdle
        ? {
          tag: 'strobe_idle', sprite: idle, index: siner,
          x: e.x + shakex + offx, y: e.y + offy, xs: 2, ys: 2, ang: 0, blend, alpha: 1, fog: NO_FOG,
        }
        : {
          tag: 'strobe_ball', sprite: SPR_BALL, index: 7,
          x: e.x + shakex + offx, y: e.y + offy, xs: 2, ys: 2, ang: 0, blend, alpha: 1, fog: NO_FOG,
        });
    } else {
      // :199-206 — THE MOD'S CHANGE. Vanilla :110-117 alternates the idle with
      // the ball frame on %2 while stronghurtanim holds; the kaizo dump's
      // `else` arm (:205) draws `idlesprite, siner` too — both arms are the
      // same call, so an ordinary hit never shows the ball frame under the
      // mod and the `% 2` test decides nothing. One record, unconditionally.
      out.push({
        tag: 'strobe_idle', sprite: idle, index: siner,
        x: e.x + shakex + offx, y: e.y + offy, xs: 2, ys: 2, ang: 0, blend, alpha: 1, fog: NO_FOG,
      });
    }
    // :207-214 — snd_knight_hurt at hurttimer 29 (the mod plays hurt where
    // vanilla plays hurtb) and `stronghurtanim = false` at 15: audio + state,
    // sim/knight.js (the strobe block's tail).
  }

  // Draw_0:216 — `scr_enemy_drawidle_generic(1/6)`, byte-identical to
  // vanilla in the kaizo dump: `if (state == 0) { fsiner += 1; siner += 1/6;
  // thissprite = idlesprite; if (mercymod >= mercymax) thissprite =
  // sparedsprite; draw_monster_body_part(thissprite, siner, x, y); }`. The
  // counters are state (sim/actors.js knightActor.step); the spared branch
  // is unreachable for the Knight in either version (no mercy in this fight,
  // the same reading render/knightdraw.js makes). draw_monster_body_part:
  //     draw_sprite_ext(spr, idx, x, y, image_xscale, image_yscale, image_angle, image_blend, image_alpha);
  //     if (flash == 1) draw_sprite_ext_flash(<same>, (-cos(fsiner / 5) * 0.4) + 0.6);
  // and draw_sprite_ext_flash fogs to its arg7 — image_blend, not a
  // hardcoded white.
  if (k.animState === 0) {
    out.push({ tag: 'base', sprite: idle, index: sinerIdle, x: e.x, y: e.y, xs, ys, ang, blend, alpha, fog: NO_FOG });
    if (k.flash) {
      out.push({
        tag: 'flash', sprite: idle, index: sinerIdle, x: e.x, y: e.y, xs, ys, ang, blend,
        alpha: (-Math.cos((k.fsiner ?? 0) / 5) * 0.4) + 0.6,
        fog: blend,
      });
    }
  }

  // Draw_0:217-234 — `if (whiteflash > 0)`: `whiteflash--` (state,
  // sim/knight.js:319), then fog white around up to three copies at 0.62 —
  // the mod's NEW state-10 copy first (:221-224), then the two vanilla ones.
  if ((k.whiteflash ?? 0) > 0) {
    if (k.animState === 10) {
      // :223 draw_sprite_ext(sprite_index, image_index, x, y, image_xscale,
      //      image_yscale, image_angle, image_blend, 0.62)
      out.push({
        tag: 'wflash_self10', sprite: e.sprite_index ?? idle, index: e.image_index ?? 0,
        x: e.x, y: e.y, xs, ys, ang, blend, alpha: 0.62, fog: C_WHITE,
      });
    }
    if (k.animState === 3 && hurttimer >= 0) {
      // :227 draw_sprite_ext(hurtsprite, 0, x + shakex + hurtspriteoffx,
      //      y + hurtspriteoffy, 2, 2, 0, image_blend, 0.62) — hurtsprite is
      // spr_roaringknight_hurt from the first Step on (SPR_HURT above).
      out.push({
        tag: 'wflash_hurt', sprite: SPR_HURT, index: 0,
        x: e.x + shakex + offx, y: e.y + offy, xs: 2, ys: 2, ang: 0, blend, alpha: 0.62, fog: C_WHITE,
      });
    }
    if (k.animState === 0) {
      // :231 draw_sprite_ext(idlesprite, siner, x, y, image_xscale,
      //      image_yscale, image_angle, image_blend, 0.62) — siner is the
      // post-:216 value here.
      out.push({
        tag: 'wflash_idle', sprite: idle, index: sinerIdle, x: e.x, y: e.y,
        xs, ys, ang, blend, alpha: 0.62, fog: C_WHITE,
      });
    }
  }

  // Draw_0:235-240 — `if (chargeupcon == 1)`: the wind-up's white silhouette
  // fading in, fog white, alpha chargeuptimer / 10. Identical to vanilla.
  if (k.chargeupcon === 1) {
    out.push({
      tag: 'chargeup', sprite: idle, index: sinerIdle, x: e.x, y: e.y,
      xs, ys, ang, blend, alpha: (k.chargeuptimer ?? 0) / 10, fog: C_WHITE,
    });
  }

  // Draw_0:241-245 — `if (becomeflash == 0) flash = 0; becomeflash = 0;`: the
  // one-frame latch, state, sim/actors.js knightActor.step.
  return out;
}

/**
 * obj_knight_enemy — PORTED (Draw_0; Draw_64 below draws nothing on the fight
 * path). The GML's draw calls come from kaizoKnightDrawCalls above; the loop
 * that blits them is the vanilla handler's, call for call (blit with the
 * manifest origin, `d3d_set_fog` as a fogged silhouette, c_white blend
 * skipped), so on every frame where the mod's Draw makes the same calls as
 * vanilla the canvas sees the same sequence.
 *
 * THE CHARGE-UP'S GHOST TRAILS, drawn first, are NOT this Draw: they are
 * obj_afterimage_fade_to_white instances the Knight's STEP spawns
 * (Step_0:1385-1402, `fade.direction = random(360)` — Step RNG, identical in
 * the mod), which the sim does not spawn. The vanilla handler stands them in
 * renderer-side, frame-seeded per the 30Hz Draw-random rule and LABELLED
 * approximate in their fade; that stand-in is repeated here verbatim (same
 * seed, same salt 71, same cadence) so the port does not regress the page —
 * a decision about the trail belongs to whoever gives the sim the object.
 *
 * DRAW_64 — the mod's new GUI-layer event. Every draw in it sits under
 * `if (practicemode)` (Draw_64:8-227: the practice HUD — attack name, phase,
 * HoldBreath toggle, the hold-to-exit bar, in draw_text_outline over a
 * 12-step black gradient) or under `var _drawdebug = 0; if (_drawdebug)`
 * (:228-241, a dead debug print). practicemode is 0 on the fight path
 * (Create_0:88; set to 1 only by `global.knight_mode == 0`, :95-100, which
 * the sim never models — kaizo/party/damage.js reads state.kaizo.practicemode
 * and nothing writes it). So on this page Draw_64 draws NOTHING, and there is
 * nothing to port; if a practice lane ever sets practicemode it needs text
 * rendering (fonts f_dotum/f_main, draw_text_outline, k_stringsetloc,
 * is_english) and a GUI-space slot the seam does not have — REPORTED as
 * blocked for that lane, not modelled.
 *
 * (Stub note, kept:) obj_knight_enemy — NOT PORTED. Kaizo Draw_0 and Draw_64 exist.
 * Vanilla today: render/canvas.js DRAW_EVENTS.obj_knight_enemy — the
 * charge-up's frame-seeded afterimage ghosts (LABELLED approximate there),
 * then every record of render/knightdraw.js knightDrawCalls(state, e) blitted
 * in order (the hurt strobe, the base + selection flash, the block-hit white
 * flash, the wind-up silhouette; fog colours as GameMaker BGR integers via
 * helpers.rgbOf, c_white blend skipped). Its exits — invisible during Stars,
 * `i_ex(obj_knight_swordtunnelanim)`, chargeupcon 2 — are in that list.
 * knightDrawCalls is what the vanilla draw log is diffed against, so a port
 * keeps it as the source of the vanilla-shaped calls and adds the mod's
 * on top (`helpers.knightDrawCalls`). The kaizo knight's rainbow afterimage
 * trail is separate obj_afterimage instances (kaizo/actors/kaizo-knight-actor.js).
 * Sim side: sim/actors.js + kaizo/actors/kaizo-knight-actor.js.
 */
export function drawObjKnightEnemy(ctx, e, state, helpers) {
  const { sprites, blit, fogged, rgbOf, frandCanvas, SPRITE_FOR } = helpers;
  const k = state.knight;

  // The charge-up's stand-in trails (see the header above — not the Draw).
  if (k?.chargeupcon === 1) {
    const entry0 = sprites.get(e.sprite_index ?? SPRITE_FOR.obj_knight_enemy);
    if (entry0 && entry0.frames.length) {
      const idx0 = Math.abs(Math.floor(e.image_index ?? 0)) % entry0.frames.length;
      const t = k.chargeuptimer ?? 0;
      // The trails, oldest first: one born every 4th frame past 10, each
      // drifting speed 4 along a seeded direction, fading over ~12 frames.
      for (let back = 12; back >= 1; back--) {
        const bf = t - back;
        if (bf <= 10 || bf % 4 !== 0) continue;
        const dir = frandCanvas(bf, 71) * Math.PI * 2;
        const dist = back * 4;
        const alpha = Math.max(0, 0.6 - back * 0.05);
        if (alpha <= 0) continue;
        // FOGGED, not tinted — a white multiply is a no-op on dark art.
        blit(fogged(entry0.frames[idx0], [255, 255, 255]), entry0.meta.ox, entry0.meta.oy,
          e.x + Math.cos(dir) * dist, e.y + Math.sin(dir) * dist,
          e.image_xscale ?? 1, e.image_yscale ?? 1, 0, alpha);
      }
    }
  }

  const calls = kaizoKnightDrawCalls(state, e);
  // AN EMPTY LIST MUST MEAN "DELIBERATELY INVISIBLE", NOT "FELL THROUGH" — the
  // vanilla handler's rule, kept: the Draw's real exits are an invisible
  // instance, the sword-tunnel anim and the con-2 burn-out (con 3 draws at
  // alpha 0, which is a record, not an empty list). A state the list has no
  // branch for falls back to the generic blit rather than an empty arena.
  if (!calls.length) {
    const hidden = e.visible === false
      || (k?.chargeupcon ?? 0) >= 2
      || tunnelAnimAlive(state);
    if (!hidden) return false;
  }
  for (const d of calls) {
    const entry = sprites.get(d.sprite);
    if (!entry || !entry.frames.length) continue;
    const idx = Math.abs(Math.floor(d.index)) % entry.frames.length;
    // `d3d_set_fog(true, colour, 0, 1)` renders the sprite as a solid
    // silhouette in that colour; NO_FOG (-1) is the record's "off".
    const img = d.fog !== NO_FOG && d.fog != null
      ? fogged(entry.frames[idx], fogOf(d.fog, rgbOf))
      : entry.frames[idx];
    blit(img, entry.meta.ox, entry.meta.oy, d.x, d.y, d.xs, d.ys, d.ang, d.alpha,
      tintOf(d.blend, rgbOf));
  }
  return true;
}
