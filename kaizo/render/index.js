// KAIZO DRAW OVERRIDES — the registry the kaizo page hands to the renderer.
//
// EnderCat8's Kaizo Roaring Knight v2.3.3 changed the Draw events of the 24
// objects listed here (every gml_Object_<obj>_Draw_0.gml in the kaizo dump
// that diffs against gml_vanilla_v105; obj_knight_enemy also carries a
// Draw_64 — the brief that named this set counted "23", the list it gave
// has 24 entries, and all 24 have a kaizo Draw_0 in the dump, so 24 it is).
// The renderer draws everything through the VANILLA port
// (render/canvas.js + render/draw/*.js), so until each family below is
// translated the kaizo page renders the mod's changed objects with the
// vanilla look. This map is the seam that closes that gap one family at a
// time: render/canvas.js consults it by object name at the top of its
// depth-sorted pass (see createRenderer's header, "THE DRAW OVERRIDE SEAM")
// and calls the function here INSTEAD OF its own DRAW_EVENTS entry.
//
// ONE-WAY, BY CONTRACT. web/kaizo.js imports this and passes it to
// `createRenderer(canvas, { overrides })`; render/ never imports from kaizo/
// (kaizo/HANDOFF.md §2). Deleting kaizo/ and web/kaizo.js leaves the main
// page's renderer exactly as it was.
//
// THE CONTRACT EACH ENTRY MEETS — `fn(ctx, e, state, helpers)`:
//   * returns TRUE when it drew the object entirely (GML Draw with no
//     draw_self), FALSY when `draw_self()` still follows — the vanilla tail
//     (render/canvas.js drawTail: the cut box's surfaces, the splitslash
//     telegraph, the generic sprite/mask blit) then runs for the entity.
//   * READS sim state, never writes it, never advances state.rng. Anything
//     random in a Draw is a pure function of state.frame (CLAUDE.md, "A GML
//     Draw runs at 30Hz; a browser renderer does not"). Draw-time state the
//     sim does not carry belongs on the kaizo attack module's `draw(e, state)`
//     slot (sim/index.js, "THE DRAW SLOT"), not in the renderer.
//   * draws at the entity's depth: the seam runs it inside the sorted pass,
//     and an invisible instance (`visible === false`) never reaches it.
//   * `helpers` is the frozen bag render/canvas.js builds: blit/tinted/fogged,
//     the sprite Map (entry.meta is the manifest row), SPRITE_FOR, the masks,
//     scratch/boxRect, the GameMaker colour helpers, `vanilla(name)`,
//     `drawVanilla(e, state)`, `drawSelf(e, state)`, `drawTail(e, state)`,
//     `defer(fn)`, and the roaring/hell-surface machinery.
//
// (THE HEADER LINE THAT USED TO STAND HERE — "EVERY ENTRY IS A STUB TODAY:
// each delegates to helpers.drawVanilla" — has been false since the ports
// landed and is kept only as the pre-port record. Every entry below is a
// translation of its object's Draw; the one remaining `helpers.drawVanilla`
// call in the whole tree is stream.js's on obj_tracking_sword1, whose Draw is
// byte-identical to vanilla. A family file's header says what its vanilla
// drawer did and where the kaizo GML lives.)
//
// kaizo/tools/checks/check-render-smoke-kaizo.mjs drives the kaizo scene
// through the real renderer WITH this map against a stub canvas and fails on
// any throw — run it (`npm run check:render:kaizo`) after every port.

import {
  drawObjFallingsword, drawObjKnightSwordfall, drawObjSwordTunnelSword,
  drawObjKnightSwordtunnelanim,
} from './draw/swords.js';
import {
  drawObjKnightPointingCone, drawObjKnightPointingStar, drawObjKnightPointingStarchild,
} from './draw/pointing.js';
import { drawObjKnightRoaring2, drawObjRoaringknightSlash } from './draw/roaring.js';
import {
  drawObjRoaringknightQuickslash, drawObjRoaringknightQuickslashAttack,
  drawObjRoaringknightQuickslashBig, drawObjKnightRotatingSlash,
} from './draw/quickslash.js';
import {
  drawObjRoaringknightBoxsplitterAttack, drawObjRoaringknightSplitslash,
  drawObjRoaringknightSplitBullet, drawObjKnightSplitGrowtangleEffect,
} from './draw/split.js';
import {
  drawObjKnightStream, drawObjKnightTunnelSlasher, drawObjKnightTunnelSlasher2Revised,
  drawObjKnightDiamondswordbulletExt,
} from './draw/stream.js';
import {
  drawObjTrackingSwordSlash, drawObjTrackingSwordSlashExtraGraze, drawObjKnightEnemy,
} from './draw/tracking.js';
import { drawObjSpellSnowgrave, drawObjSpellSnowgraveSnowflake } from './draw/snowgrave.js';
import { drawActorParty } from './draw/party.js';

/** Object name -> Draw override. Family order matches the file layout. */
export const KAIZO_DRAW_OVERRIDES = Object.freeze({
  // kaizo/render/draw/swords.js
  obj_fallingsword: drawObjFallingsword,
  obj_knight_swordfall: drawObjKnightSwordfall,
  obj_sword_tunnel_sword: drawObjSwordTunnelSword,
  obj_knight_swordtunnelanim: drawObjKnightSwordtunnelanim,
  // kaizo/render/draw/pointing.js
  obj_knight_pointing_cone: drawObjKnightPointingCone,
  obj_knight_pointing_star: drawObjKnightPointingStar,
  obj_knight_pointing_starchild: drawObjKnightPointingStarchild,
  // kaizo/render/draw/roaring.js
  obj_knight_roaring2: drawObjKnightRoaring2,
  obj_roaringknight_slash: drawObjRoaringknightSlash,
  // kaizo/render/draw/quickslash.js
  obj_roaringknight_quickslash: drawObjRoaringknightQuickslash,
  obj_roaringknight_quickslash_attack: drawObjRoaringknightQuickslashAttack,
  // THE 26TH ENTRY IS NOT A CHANGED DRAW EITHER. obj_roaringknight_quickslash_
  // big's kaizo Draw_0 is byte-identical to vanilla, and render/canvas.js has
  // no DRAW_EVENTS entry for it, so the generic blit painted its
  // spr_rk_quickslash_marker definition stand-in across the box on every
  // pending frame where the game shows only the controller's hell-surface
  // gradient (RENDER-CRITIC item 4b). Same shape as the blade fill below;
  // receipt in the drawer's header.
  obj_roaringknight_quickslash_big: drawObjRoaringknightQuickslashBig,
  obj_knight_rotating_slash: drawObjKnightRotatingSlash,
  // kaizo/render/draw/split.js
  obj_roaringknight_boxsplitter_attack: drawObjRoaringknightBoxsplitterAttack,
  obj_roaringknight_splitslash: drawObjRoaringknightSplitslash,
  obj_roaringknight_split_bullet: drawObjRoaringknightSplitBullet,
  obj_knight_split_growtangle_effect: drawObjKnightSplitGrowtangleEffect,
  // kaizo/render/draw/stream.js
  obj_knight_stream: drawObjKnightStream,
  obj_knight_tunnel_slasher: drawObjKnightTunnelSlasher,
  obj_knight_tunnel_slasher_2_revised: drawObjKnightTunnelSlasher2Revised,
  // THE 25TH ENTRY IS NOT A CHANGED DRAW. obj_knight_diamondswordbullet_ext's
  // kaizo Draw_0 is byte-identical to vanilla, but render/canvas.js has no
  // DRAW_EVENTS entry for it at all, so the generic blit ignored the r/g/b
  // fields its Step fades and the mod's blue shake never reached the screen
  // (Law 6: the vanilla hole is a port-back candidate; this is the kaizo
  // fill, receipt in the drawer's header and the ledger, 2026-09-08).
  obj_knight_diamondswordbullet_ext: drawObjKnightDiamondswordbulletExt,
  // kaizo/render/draw/tracking.js
  obj_tracking_sword_slash: drawObjTrackingSwordSlash,
  obj_tracking_sword_slash_extra_graze: drawObjTrackingSwordSlashExtraGraze,
  obj_knight_enemy: drawObjKnightEnemy,
  // kaizo/render/draw/snowgrave.js
  obj_spell_snowgrave: drawObjSpellSnowgrave,
  obj_spell_snowgrave_snowflake: drawObjSpellSnowgraveSnowflake,
  // kaizo/render/draw/party.js
  //
  // THE 27TH ENTRY IS NOT A GAME OBJECT. `actor_party` is sim/actors.js's
  // cosmetic per-slot hero actor — the sim's stand-in for obj_heroparent,
  // which it does not instantiate — and it is here because obj_heroparent's
  // Draw_0 IS one of the mod's changed Draws (RENDER-CRITIC item 2b): the
  // B-Side gloom tint and the frozen statue. The actor is the only place in
  // the entity list where a hero exists, so it is the only place the seam can
  // reach one; the drawer's header says exactly what the vanilla path was
  // already doing and what these two add.
  actor_party: drawActorParty,
});

/** The 27 object names (24 changed Draws + the blade fill, the finisher fill and the party actor), in registry order — what the render smoke reports coverage over. */
export const KAIZO_DRAW_OBJECTS = Object.freeze(Object.keys(KAIZO_DRAW_OVERRIDES));
