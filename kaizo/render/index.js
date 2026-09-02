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
// EVERY ENTRY IS A STUB TODAY: each delegates to `helpers.drawVanilla`, so
// the page renders byte-for-byte as it did before the seam. A family file's
// header says what its vanilla drawer does and where the kaizo GML lives; the
// port replaces the delegation in place and keeps the export name.
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
  drawObjKnightRotatingSlash,
} from './draw/quickslash.js';
import {
  drawObjRoaringknightBoxsplitterAttack, drawObjRoaringknightSplitslash,
  drawObjRoaringknightSplitBullet, drawObjKnightSplitGrowtangleEffect,
} from './draw/split.js';
import {
  drawObjKnightStream, drawObjKnightTunnelSlasher, drawObjKnightTunnelSlasher2Revised,
} from './draw/stream.js';
import {
  drawObjTrackingSwordSlash, drawObjTrackingSwordSlashExtraGraze, drawObjKnightEnemy,
} from './draw/tracking.js';
import { drawObjSpellSnowgrave, drawObjSpellSnowgraveSnowflake } from './draw/snowgrave.js';

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
  // kaizo/render/draw/tracking.js
  obj_tracking_sword_slash: drawObjTrackingSwordSlash,
  obj_tracking_sword_slash_extra_graze: drawObjTrackingSwordSlashExtraGraze,
  obj_knight_enemy: drawObjKnightEnemy,
  // kaizo/render/draw/snowgrave.js
  obj_spell_snowgrave: drawObjSpellSnowgrave,
  obj_spell_snowgrave_snowflake: drawObjSpellSnowgraveSnowflake,
});

/** The 24 object names, in registry order — what the render smoke reports coverage over. */
export const KAIZO_DRAW_OBJECTS = Object.freeze(Object.keys(KAIZO_DRAW_OVERRIDES));
