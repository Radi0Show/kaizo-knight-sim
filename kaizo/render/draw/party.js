// KAIZO DRAW — the PARTY. obj_heroparent's Draw_0 and the frozen statue it
// creates, which are the two Draw deltas RENDER-CRITIC item 2b names and the
// only two the mod applies to a hero.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// THE KAIZO GML (read-only, never copied here):
//   gml_Object_obj_heroparent_Draw_0.gml   :10-46 the whole insert, :66 the
//                                          one changed line
//   gml_Object_obj_frozennpc_Create_0.gml  the statue's own defaults
//   gml_Object_obj_frozennpc_Draw_0.gml    the statue's Draw
//   gml_GlobalScript_kaizo_settings_init.gml  kaizo_sideb, kaizo_gloomcolor
// diffed against gml_vanilla_v105/CodeEntries — the vanilla Draw_0 is 53
// lines and every one of them survives; the mod INSERTS 37 lines after
// vanilla's :9 and REPLACES vanilla's two redundant `image_blend = c_white`
// with `image_blend = _blend`.
//
// ── WHAT WAS ACTUALLY MISSING, which is narrower than "the party is not
// drawn" ──────────────────────────────────────────────────────────────────
//
// The heroes ARE painted, and have been since before this file: the kaizo
// scene spawns one `actor_party` entity per occupied slot
// (kaizo/scenes/kaizo-practice.js, from `hooks.party.members`), the actor
// mirrors kaizo/party/heroes.js's state machine onto `sprite_index` /
// `image_index` every Step (sim/actors.js partyActor), and render/canvas.js's
// generic blit draws it at the slot's depth. A grep of render/ and web/ for
// `spr_krisb_*` finds nothing because the sprite NAME travels through state,
// not through the renderer.
//
// What never reached the screen is the mod's two additions, both of which
// kaizo/party/heroes.js already computes and nothing consumed:
//
//   * `h.blend` — the B-Side GLOOM TINT. `partyActor` never writes it to the
//     entity, and the generic blit multiplies by `e.image_blend`, so the tint
//     was computed every frame and thrown away.
//   * `h.frozenHidden` / `h.herofrozen` — the FREEZE. The Draw's `exit` (the
//     hero is not drawn at all) and the obj_frozennpc statue standing in its
//     place. Neither had a drawer.
//
// So this override does what the generic blit did, plus those two. It claims
// the draw (returns true) rather than deferring to the tail, because the tail
// IS the generic blit and would paint an untinted second copy over the top.
//
// ── WHAT THIS FILE DOES NOT MODEL, and why that is not the mod's ──────────
//
// Three of vanilla's own branches have no state behind them in this sim, and
// the mod changes none of them — they are gaps in the ENGINE's hero model
// (sim/heroes.js), recorded here because this is where they would surface:
//
//   * `hurt == 1` (Draw_0 vanilla :10-24): the flinch is drawn at
//     `(x - 20) + (hurtindex * 10)`, walking back to the standing position
//     over the flinch. sim/heroes.js has `hurt` as a countdown and no
//     `hurtindex`, so the hurt POSE is right and the shudder is absent.
//   * `flash == 1` (:32-38): a fogged white copy at
//     `(-cos(fsiner / 5) * 0.4) + 0.6`. No `flash`/`becomeflash` in the sim.
//   * `state == 8` (:40-43): the sprite drawn at the instance's own scales and
//     angle instead of the flat x2. Nothing assigns state 8 here.
//
// Adding any of them would be inventing state, which is the one thing this
// project does not do. They belong to whoever ports obj_heroparent's Step.
//
// And three of vanilla's guards are simply not this encounter's, checked
// rather than assumed: `i_ex(obj_susiezilla_gamecontroller)` (:2-5, exits the
// whole Draw), `normalsprite == spr_gameshow_drowningRalsei_ralsei_origin_edit`
// (:6-9, the only thing that makes `scale` 1 instead of 2), and the mod's own
// `i_ex(obj_tenna_enemy)` fog reset (:10-13). None of those three objects or
// sprites exists in the Knight fight, so `scale` is 2 for every frame of it.
//
// ── ORDER, DEPTH AND THE STATUE ───────────────────────────────────────────
//
// The statue is a separate INSTANCE (`instance_create(x, y, obj_frozennpc)`)
// given the hero's own depth. Same depth, created later, so this engine's
// sorted pass (higher depth first, then `seq`) would draw it immediately
// after its hero — which is exactly where it is drawn here, in one override,
// after the hero's own draw. While the hero is frozen the hero's Draw exits,
// so only the statue shows; once thawed BOTH show, because the statue is
// never destroyed (kaizo/party/heroes.js cleanupKaizoHero: the CleanUp's
// `instance_destroy(herofrozen)` misses, a preserved original bug).

import { drawSpriteExt } from '../../../render/draw/gm.js';
import { mergeColor } from '../../../sim/gml.js';

/**
 * `scale = 2` — obj_heroparent Draw_0:1, and it is a DRAW-TIME literal, not
 * the instance's scale. The Create sets `image_xscale = image_yscale = 2` as
 * well (Create_0:14-15), which is what the statue inherits; the two agree, so
 * nothing here has to choose between them.
 */
const HERO_SCALE = 2;

/**
 * `specialcolor = merge_color(c_navy, c_white, 0.8)` — obj_frozennpc
 * Create_0. GameMaker packs colours BGR, so `c_navy` (0x800000) is
 * RGB(0, 0, 128); four fifths of the way to white is (204, 204, 217.6).
 *
 * THE FIFTH OF A CHANNEL IS AMBIGUOUS, exactly as kaizo/party/heroes.js
 * records for the gloom colour: GameMaker's merge_colour truncates and
 * sim/gml.js's mergeColor rounds, so the blue is 217 in the engine and 218
 * here. Recorded rather than special-cased — the helper is the one 61 suites
 * are pinned to.
 */
const FROZEN_SPECIALCOLOR = mergeColor([0, 0, 128], [255, 255, 255], 0.8);

/** `c_blue` — BGR 0xFF0000, so RGB(0, 0, 255). */
const C_BLUE = [0, 0, 255];

/**
 * `draw_sprite_part_ext(spr, sub, left, top, w, h, x, y, xs, ys, col, alpha)`
 * — a source rectangle blitted with NO origin offset of its own (the caller
 * applies one; obj_frozennpc's Draw computes `xoffset`/`yoffset` by hand for
 * exactly that reason).
 *
 * THE SOURCE RECT IS CLAMPED HERE AND IS NOT IN THE GML, and that is a
 * deliberate, labelled deviation. obj_frozennpc passes `sprite_width` and
 * `sprite_height` — GameMaker's SCALED dimensions, twice the sprite's own at
 * this scale — into parameters that take SOURCE pixels, so the rect reaches
 * past the right and bottom edges of the sprite. GameMaker clamps a source
 * rect to the sprite; a canvas `drawImage` with an out-of-range source
 * rectangle is not defined to, so the rect is clamped here and the
 * destination shrinks with it. Same pixels, defined behaviour.
 */
function drawSpritePartExt(ctx, entry, sub, left, top, w, h, x, y, xs, ys, color, alpha) {
  if (!entry || !entry.frames.length) return;
  const img = entry.frames[((sub | 0) % entry.frames.length + entry.frames.length) % entry.frames.length];
  if (!img) return;
  const sx = Math.max(0, left);
  const sy = Math.max(0, top);
  const sw = Math.min(w - (sx - left), img.width - sx);
  const sh = Math.min(h - (sy - top), img.height - sy);
  if (!(sw > 0) || !(sh > 0)) return;
  const a = Math.max(0, Math.min(1, alpha));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(xs, ys);
  // `d3d_set_fog(true, col, 0, 0)` is start == end == 0: every pixel is fully
  // fogged, so the sprite draws as a flat silhouette in the fog colour and
  // the `col` argument never reaches the screen. The caller says which it
  // wants by passing `fogColor`; the four blue copies below are drawn under
  // fog and are therefore specialcolor, not c_blue.
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.restore();
}

/**
 * A fogged source-rect blit: the same rectangle, painted flat in one colour.
 * `helpers.fogged` bakes the silhouette; the rect is then taken out of it.
 */
function drawSpritePartFogged(ctx, helpers, entry, sub, left, top, w, h, x, y, xs, ys, color, alpha) {
  if (!entry || !entry.frames.length) return;
  const img = entry.frames[((sub | 0) % entry.frames.length + entry.frames.length) % entry.frames.length];
  if (!img) return;
  const baked = helpers.fogged(img, color);
  drawSpritePartExt(ctx, { frames: [baked], meta: entry.meta }, 0,
    left, top, w, h, x, y, xs, ys, null, alpha);
}

/**
 * obj_frozennpc's Draw_0 — the statue, translated for the one shape the mod
 * can produce: a battle statue (`inbattle = 1`) created by a hero's own Draw.
 *
 * The event's state machine (`fresh` 0 -> 2, the `returntoxy` overworld
 * teleport at `fresh` 3/5/6, the chapter-2 Berdly fade) is not reachable from
 * a battle: `fresh` starts at obj_npc_parent's own 0, so the FIRST Draw takes
 * the `fresh == 0` arm — `image_alpha = 1`, play snd_petrify, `fresh = 2` —
 * and `fresh == 3` needs `global.fighting == 0`, which is false for the whole
 * fight. So every frame after the first is: draw_self, advance `timer`, the
 * four blue offset copies, the additive core. That is what this draws.
 *
 * THE ICE CREEPS UP, and the mechanism is the source rect:
 *
 *     if (timer < 1) timer += 0.05;
 *     var t = (sprite_height / 2) - (timer * (sprite_height / 2));
 *     ...draw_sprite_part_ext(spr, sub, 0, t, sprite_width, sprite_height - t,
 *                             ..., y +- 2 + (t * 2) + yoffset, ...)
 *
 * `timer` walks 0 -> 1 over 20 frames, so `t` walks from half the SCALED
 * height down to 0 and the source window opens from nothing to the whole
 * sprite while its destination rises. `timer` is set to 1 outright by the
 * `fresh == 1` arm, which is the overworld path — a battle statue always
 * plays the 20-frame freeze.
 *
 * `snd_petrify` on the first frame is audio and is not this file's; noted so
 * whoever wires the statue's cue knows where it is.
 */
export function drawFrozenStatue(ctx, statue, state, helpers) {
  const entry = helpers.sprites.get(statue.sprite);
  if (!entry || !entry.frames.length) return;
  const sub = statue.image_index ?? 0;
  const xs = statue.image_xscale ?? 2;
  const ys = statue.image_yscale ?? 2;
  const alpha = statue.image_alpha ?? 1;
  const { x, y } = statue;

  // `draw_self()`.
  drawSpriteExt(ctx, entry, sub, x, y, xs, ys, 0, null, alpha);

  // `if (timer < 1) timer += 0.05;` — the ice clock. It is INSTANCE STATE the
  // game advances in its Draw; the renderer may not write sim state, so the
  // clock is derived from how long the statue has existed instead
  // (`statue.age`, which kaizo/party/heroes.js ticks). Same 20-frame ramp,
  // and it is a pure function of the frame, so a paused inspection redraws
  // identically (CLAUDE.md, "A GML Draw runs at 30Hz").
  const timer = Math.min(1, (statue.age ?? 0) * 0.05);
  const spriteW = (entry.meta?.w ?? entry.frames[0].width) * xs;
  const spriteH = (entry.meta?.h ?? entry.frames[0].height) * ys;
  const t = (spriteH / 2) - (timer * (spriteH / 2));
  // `yoffset = -(sprite_get_yoffset(sprite_index) * image_yscale)` — the
  // origin, applied by hand because draw_sprite_part_ext does not apply one.
  const xoff = -((entry.meta?.ox ?? 0) * xs);
  const yoff = -((entry.meta?.oy ?? 0) * ys);

  // The four offset copies, in the GML's order and with its alphas: the
  // up-left and down-right pair at 0.8, the other diagonal at 0.4. All four
  // are inside `d3d_set_fog(true, specialcolor, 0, 0)`, so the `c_blue` they
  // name never shows — they are specialcolor silhouettes, and that is the
  // frosted double-image the statue reads as.
  const parts = [
    [x - 2 + xoff, y - 2 + (t * 2) + yoff, 0.8],
    [x + 2 + xoff, y - 2 + (t * 2) + yoff, 0.4],
    [x - 2 + xoff, y + 2 + (t * 2) + yoff, 0.4],
    [x + 2 + xoff, y + 2 + (t * 2) + yoff, 0.8],
  ];
  for (const [px, py, pa] of parts) {
    drawSpritePartFogged(ctx, helpers, entry, sub, 0, t, spriteW, spriteH - t,
      px, py, xs, ys, FROZEN_SPECIALCOLOR, alpha * pa);
  }
  // ORIGINAL BEHAVIOUR: `c_blue` is passed to all four and discarded by the
  // fog. Named here so a later pass cannot "restore" a blue that never drew.
  void C_BLUE;

  // `draw_set_blend_mode(bm_add)` then one more copy, FOG OFF — so this one
  // really is tinted specialcolor, additively, at 0.4. It is the glow.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawSpritePartExt(ctx, { frames: [helpers.tinted(entry.frames[Math.abs(Math.floor(sub)) % entry.frames.length], FROZEN_SPECIALCOLOR)], meta: entry.meta },
    0, 0, t, spriteW, spriteH - t, x + xoff, y + (t * 2) + yoff, xs, ys, null, alpha * 0.4);
  ctx.restore();
}

/**
 * `actor_party` — obj_heroparent's Draw_0, kaizo.
 *
 * The entity is sim/actors.js's cosmetic actor, one per occupied slot, whose
 * Step copies kaizo/party/heroes.js's `sprite` and `index` onto
 * `sprite_index` / `image_index`. Everything this override adds comes off
 * `state.heroes[e.slot]`, which the same module fills:
 *
 *     h.frozenHidden   `obj_knight_enemy.k_freeze[global.char[myself]] == 1`
 *     h.herofrozen     the statue record, or -4 (none) / -99 (cleaned)
 *     h.blend          `merge_color(c_white, kaizo_gloomcolor(),
 *                       min(k_gloom[global.char[myself]] / 150, 0.3))`
 *
 * THE GLOOM INDEX IS THE CHARACTER, not the slot — heroes.js resolves that
 * (its `gloomTint` note; scr_charbox reads the same array at `slot + 1` and
 * the two disagree the moment Noelle joins). Nothing is re-derived here.
 *
 * A hero with no kaizo record — every V-A and V-C run, where the roster hook
 * is not installed and `state.heroes` holds sim/heroes.js's plain records —
 * takes `blend` undefined and `frozenHidden` undefined, which is white and
 * not frozen: the vanilla picture, drawn by the same call.
 */
export function drawActorParty(ctx, e, state, helpers) {
  const h = state.heroes?.[e.slot];

  // Draw_0:15-38 — the freeze. The statue is SPAWNED in the Draw (heroes.js
  // does that, in the Step slot, because a renderer may not create sim
  // state); what the Draw does here is exit, and draw nothing of the hero.
  const statue = h && typeof h.herofrozen === 'object' ? h.herofrozen : null;
  if (h?.frozenHidden) {
    if (statue) drawFrozenStatue(ctx, statue, state, helpers);
    return true; // `exit` — no hurt flash, no defend flash, no pose
  }

  // Draw_0:39-45 — the gloom tint, and vanilla's :29-30 replaced by it. The
  // default is `16777215`, c_white, which multiplies to a no-op; the blit is
  // handed null for it so the tint cache is not asked for a white bake.
  const blend = h?.blend && !(h.blend[0] === 255 && h.blend[1] === 255 && h.blend[2] === 255)
    ? h.blend
    : null;

  // vanilla :25-31 — `if (specdraw == 0 && state != 8)`. `specdraw` is set
  // only by the hurt branch above it, which this sim has no state for (see
  // the header), so it is 0 every frame here.
  const entry = helpers.sprites.get(e.sprite_index);
  drawSpriteExt(ctx, entry, e.image_index ?? 0, e.x, e.y,
    HERO_SCALE, HERO_SCALE, 0, blend, e.image_alpha ?? 1);

  // The statue OUTLIVES the freeze — see the header's last paragraph. Drawn
  // after the hero because it is a later instance at the same depth.
  if (statue) drawFrozenStatue(ctx, statue, state, helpers);
  return true;
}
