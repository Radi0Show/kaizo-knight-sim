// KAIZO obj_knight_lightorb + obj_knight_bullethell2 + obj_knight_bullethell_bullet2
// — THE SIDE-B SUNBOLT SUB-ATTACK. Ledger gap G-1, severity 5.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// WHAT THIS CLOSES. The B-Side quickslash finisher splits the box vertically
// (G-2, kaizo/attacks/split-growtangle-vertical.js) and that organism creates
// ONE of these at the box's centre. Until now that `instance_create` was a
// ledgered approx row reading "nothing spawned", so the recreation's B-Side
// quickslash was missing every bullet the real mod's is famous for: three-
// and five-way sunbolt fans aimed at the soul, fired out of a DRAW event
// every ten frames for the rest of the turn.
//
// PROVENANCE — read for every line below:
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_knight_lightorb_Create_0.gml               (15 lines)
//     gml_Object_obj_knight_lightorb_Draw_0.gml                (202)
//     gml_Object_obj_knight_lightorb_Draw_64.gml                 (1)
//     gml_Object_obj_knight_bullethell2_Create_0.gml            (21)
//     gml_Object_obj_knight_bullethell2_Step_0.gml              (48)
//     gml_Object_obj_knight_bullethell2_Other_10.gml            (41, DEAD — see below)
//     gml_Object_obj_knight_bullethell2_Other_11.gml            (61, DEAD)
//     gml_Object_obj_knight_bullethell_bullet2_Create_0.gml     (10)
//     gml_Object_obj_knight_bullethell_bullet2_Step_0.gml       (55)
//     gml_Object_obj_knight_bullethell_bullet2_Other_15.gml     (17)
//     gml_Object_obj_knight_bullethell_bullet2_Draw_0.gml        (1, draw_self)
//     gml_Object_obj_knight_split_growtangle_vertical_Step_0.gml:15  (the creator)
//   knight-research/kaizo-mod/sprites/objects_kaizo.csv (sprites, parents, depths)
//
// EVERY ONE OF THOSE ELEVEN FILES WAS DIFFED against
// `gml_vanilla_v105/CodeEntries/` file by file. Byte-identical: lightorb
// Draw_64, bullethell2 Other_10, bullethell2 Other_11, bullet2 Create_0,
// bullet2 Step_0, bullet2 Draw_0. The four that differ are the mod's whole
// delta on this sub-attack:
//
//   Create_0        `col = merge_color(c_white, get_swordcolor(), 0.2)`
//                   (vanilla `c_yellow`), and the `type = 1` gate becomes
//                   `kaizo_sideb()` — vanilla gated it on
//                   `obj_knight_enemy.difficulty == 1`, which this attack
//                   never sets, so vanilla's orb was ALWAYS type 0.
//   Draw_0:1-13     A NEW FIRST-LINE GUARD. `if (global.turntimer < 1)
//                   { instance_destroy(); with (obj_knight_bullethell2)
//                   instance_destroy(); exit; }` followed by
//                   `if (!i_ex(obj_heart)) exit;`. Both are `exit`, so on a
//                   turn that has run out the WHOLE Draw is skipped — and
//                   with it every RNG draw below. Vanilla only had the same
//                   destroy at :181, AFTER the sprite blits and after the
//                   volley block had already drawn from the stream.
//   Draw_0:103      the aim window tightens: `+ 36 - 5 + irandom(10)` (a
//                   +-5 degree spread) becomes `+ 36 - 2 + irandom(4)`
//                   (+-2). NOTE the draw COUNT is unchanged — one irandom
//                   either way, two u32 — so this is a value change, not a
//                   stream change. Also newly wrapped in `if (i_ex(obj_heart))`
//                   with a `basedir = 0` default.
//   Draw_0:118-119  every sunbolt gets `target = 0; damage = 166;` (vanilla
//                   set neither and the bullets kept scr_bullet_init's
//                   `target = 0, damage = 10`, i.e. nothing).
//   Draw_0:145-146  the same two lines on the three-way fan.
//   Draw_0:158      `snd_play_x(snd_stardrop, 0.6 / _rep, 1)`, vanilla 0.8 —
//                   so a split orb's two mouths are half as loud each.
//   Draw_0:200      the charge disc is `get_swordcolor()`, vanilla `c_blue`.
//   bullethell2 Create_0  `1186/1463 -> 1184/1462`: BUILD CHURN, NOT A MOD
//                   CHANGE. Those are raw object indices the decompiler could
//                   not name; 1462 is obj_heart in the mod's table and 1463
//                   is obj_heart in v105's (sim/data/object-order.js carries
//                   the MOD's numbering, and CLAUDE.md's "battlecontroller
//                   1393 before heart 1462" is the same table). The mod is
//                   built on chapter build v0.0.091; the whole table shifts
//                   by one. 1184 = obj_mainchara, the overworld Kris — the
//                   fallback when no soul exists.
//   bullethell2 Step_0    THREE changes, and the first two neuter the object:
//                   `repeat (3) -> repeat (0)` (it fires NO bullets at all in
//                   the mod), `timer > 70 -> timer > 700` (so it lives for
//                   the whole turn instead of 70 frames), and a new
//                   `if (obj_heart.y < y) _dir -= 180` flip. `_dir` is only
//                   read by the deleted repeat body, so the flip is DEAD on
//                   arrival — see "what the emitters actually do".
//   bullet2 Other_15      `target = 3 -> 0`, `damage = 206 -> 103`.
//
// ── THE 166 IS DEAD. THE REAL NUMBER IS 103. ──────────────────────────────
//
// Worth stating plainly because the gap list says "166 damage each": the
// sunbolt's own Other_15 opens
//
//     target = 0;
//     damage = 103;
//     if (active == 1) { if (target != 3) scr_damage(); ... }
//
// — unconditionally, BEFORE the damage call. So the `damage = 166` the Draw
// stamps on each bullet at fire time is overwritten by 103 on the frame it
// connects, and 166 never reaches `scr_damage`. Grepped for another reader of
// `damage` on this object: there is none (Create_0, Step_0, Draw_0 and
// Other_15 are the object's only events, and only Other_15 mentions it).
// Both lines are translated anyway, in the original's order, because the
// translation's job is the code and not a tidied version of it — and because
// a future mod build that drops the Other_15 line would make 166 live.
//
// ── WHAT THE EMITTERS ACTUALLY DO: NOTHING BUT SOUND ──────────────────────
//
// `obj_knight_bullethell2` is created twice at `timer == 40` when type == 1,
// at x -+ splitx. In VANILLA its Step fires six obj_knight_bullethell_bullet
// per frame in a rotating fan. In the MOD the loop is `repeat (0)`. What is
// left of its Step is: the `!i_ex(obj_knight_lightorb)` exit, a `_dir`
// computation nothing reads, `timer++`, `snd_stop`/`snd_play_x` of
// snd_heartshot_dr_b EVERY frame, `a = 0`, `b -= 0.1`, and two destroy
// tests. It is a 700-frame sound loop flanking the orb. Translated because
// its EXISTENCE is load-bearing three ways — the orb's two `with
// (obj_knight_bullethell2) instance_destroy()` sweeps target it, its cue
// stream is audible, and `obj_knight_bullethell_bullet` (a different object)
// checks `i_ex` on the orb rather than on it.
//
// Other_10 and Other_11 (event_user(0)/(1)) hold vanilla's live fan and a
// six-way spread. A content grep of the WHOLE kaizo dump finds no
// `event_user` aimed at this object — the only references to
// obj_knight_bullethell2 anywhere are the three lines in the orb's own Draw.
// Dead in the mod, and not translated; recorded here so a later reader does
// not "restore" them.
//
// ── THE DRAW EVENT IS WHERE THE BULLETS COME FROM ─────────────────────────
//
// All of the orb's logic lives in Draw_0. It runs in this engine's DRAW slot
// (`draw(e, state)`, sim/index.js "THE DRAW SLOT") for the reason that slot
// exists: a counter incremented in a Draw is one frame ahead of one
// incremented in a Step, and everything here — `timer`, `con`, `siner`,
// `count`, `splitx` — is such a counter. Instances created in a Draw first
// STEP on the following frame, which is what the engine does with anything
// spawned after the step phase, so the sunbolts' first movement is one frame
// after their creation exactly as in the game.
//
// RNG. Every `random`/`irandom` in the Draw is a stream draw whether or not
// the thing it decorates is modelled (CLAUDE.md, "A visual's draws are still
// draws"), and GML evaluates a call's arguments RIGHT-TO-LEFT, so in
// `instance_create((x - 30) + random(60), (y - 30) + random(60), obj)` the
// **Y** draw comes first.
//
// AND AN `instance_create` DRAWS TWICE OVER: once for whichever of its
// ARGUMENTS rolls, and again for every roll in the created object's own
// CREATE EVENT, which runs synchronously inside the call. Version one of this
// file counted only the arguments and was short by 6 u32 per spark and 2 per
// triangle — 8 every con-1 frame, per mouth. The particle Creates, read in
// full from the kaizo dump (all four are byte-identical to v105):
//
//   obj_knight_spark Create_0        image_index  = irandom(3)      2 u32
//                                    image_blend  = choose(c_white) 1 u32
//                                    image_xscale = choose(-1, 1)   1 u32
//                                    image_yscale = choose(-1, 1)   1 u32
//                                    image_angle  = random(360)     1 u32
//                                                            total  6 u32
//     (`choose` is ONE draw whatever its arity — sim/rng.js gmlChoose is
//      `values[u32 % length]` — so the single-argument `choose(c_white)`,
//      which can only ever return c_white, still costs its u32.)
//   obj_knight_triangle Create_0     dir = random(360)              1 u32
//                                    o   = choose(-1, 1)            1 u32
//                                                            total  2 u32
//   obj_knight_ring Create_0         four constants                 0 u32
//   obj_rouxls_power_up_orb Create_0 sixteen constants              0 u32
//
// The power-up orb's roll is not in its Create at all: it is in its own
// DRAW_0, `random_range(70, 90)` behind an `init == 0` latch — one u32 per
// orb, for its lifetime. All four are real instances now; that one always had
// to be, because a roll one frame later at a different depth cannot be burned
// at this call site at all — see "WHAT IS NOT MODELLED" below.
//
// Per-frame budget, in stream order (a `[+n]` line is a Create event):
//
//   con 0, every frame          spark args: random, random          2 u32
//                               spark Create                       [6 u32]
//   con 0, timer < 18           orb dir:    irandom(360)            2 u32
//   con 1, per repeat, always   triangle Create                    [2 u32]
//   con 1, per repeat, always   triangle:   random(0.5), random(0.7) 2 u32
//   con 1, per repeat, always   ring Create (timer%30==0||timer==1) [0 u32]
//   con 1, per repeat, always   spark args: random, random          2 u32
//                               spark Create                       [6 u32]
//   con 1, per repeat, timer%10 aim:        irandom(4)              2 u32
//   con 1,  ... 5-way arm       re-aim:     irandom(60)             2 u32
//   con 1,  ... 5-way arm       speeds:     random(2) x5            5 u32
//   con 1,  ... 3-way arm       (speed is the constant 4.5)         0 u32
//   ANY frame, BEFORE all of the above, once per power-up orb created on the
//   PREVIOUS frame          orb Draw_0: random_range(70, 90)        1 u32
//
// so an ordinary con-1 frame costs 12 u32 per mouth, a three-way volley 14 and
// a five-way 21; a con-0 frame costs 8, or 10 while timer < 18, plus the 1 for
// the previous frame's power-up orb. The `irandom(4)` at :103 is drawn EVEN
// THOUGH the five-way arm immediately recomputes `basedir` over it — the
// classic dead-value draw this engine has to keep.
//
// check-lightorb.mjs L8 pins EVERY one of those numbers as an exact per-frame
// u32 count against a measured baseline, so adding or removing a single draw
// anywhere in this file fails it.
//
// ── WHAT IS NOT MODELLED, AND WHY ─────────────────────────────────────────
//
//   * NOTHING OF THE ART, ANY MORE — this bullet used to head the list and it
//     is CLOSED (2026-09-12). `obj_knight_lightorb`'s sprite is
//     `spr_sneo_bigcircle` (objects_kaizo.csv) and its particles' are
//     spr_knight_spark (obj_knight_spark), spr_knight_triangle
//     (obj_knight_triangle) and spr_roaringknight_sword_break_vfx2
//     (obj_knight_ring). All FOUR are now extracted and in the kaizo overlay
//     (pack-kaizo-sprites.mjs's WANT list) as `source: 'vanilla'` — they are
//     byte-identical in the mod's data file and the player's own, measured
//     frame by frame, so they are a vendoring gap and not EnderCat8's art.
//     The names are therefore written as ordinary quoted literals here and
//     resolve under check-sprites.mjs; the drawer
//     (kaizo/render/draw/lightorb.js) BLITS the orb body where it used to
//     paint a ring in canvas primitives, and the three particles draw
//     themselves through render/canvas.js's generic tail.
//     THE FOURTH PARTICLE, obj_rouxls_power_up_orb, has an EMPTY sprite
//     column in objects_kaizo.csv — it draws from `draw_circle` primitives in
//     its own Draw, which this repo does not translate — so there is no fifth
//     name to pack and it is still invisible. That is the only art gap left in
//     this attack, and it is a DRAWER gap, not an extraction one.
//   * THE THREE PARTICLES' MOTION IS MODELLED; THEIR CREATES ARE STILL THE
//     STREAM. obj_knight_spark, obj_knight_triangle and obj_knight_ring are
//     pure decoration with no mask, no Other_15 and no reader, and every roll
//     they ever make is in their CREATE event, which runs synchronously inside
//     the `instance_create` that the orb's Draw is already standing at. They
//     were inline burns while their art was unpacked (nothing could have drawn
//     them); now that it is packed they are real types whose `create()` makes
//     those same rolls at the same call site, so the stream is identical and
//     the pictures are real. Their Steps (three, four and five lines) are
//     translated with them.
//   * obj_rouxls_power_up_orb IS SPAWNED, and it is the exception that proves
//     the rule above. Its Create rolls nothing; its ONE roll
//     (`random_range(70, 90)`, Draw_0:22) is in its own DRAW event behind an
//     `init == 0` latch, and the orb's Draw creates it at `depth = depth + 1`.
//     Two consequences an inline burn cannot reproduce, both of which decide
//     WHERE in the stream that u32 lands:
//       - the instance is created DURING the draw phase, so (sim/entity.js
//         `drawList`, which snapshots) its first Draw is the NEXT frame, and
//       - depth 1 sorts BEFORE depth 0, so on that next frame it draws ahead
//         of the light orb's own spark.
//     Declaring the real type and letting the engine's draw ordering place it
//     is the only honest way to get that; a hand-rolled one-frame offset would
//     be a second, unverified model of rules sim/entity.js already states.
//     It carries no sprite, no mask and no Other_15, so the renderer's generic
//     tail draws nothing for it (render/canvas.js `drawEntity` returns false
//     when there is neither a packed sprite nor a SPRITE_MASKS row).
//   * `draw_sprite_ext(spr_zapper_tvturnoff1, ...)` at :45 and the Draw_64
//     blacktile darkener — visual, no state beyond `darken_alpha`, which is
//     kept on the entity for the drawer.
//   * `obj_knight_bullethell_bullet` / `_bounce` / `obj_knight_bullethell1`.
//     Different objects. Nothing in the mod creates them any more (the only
//     `repeat` that did is the `repeat (0)` above), so they are unreachable.
//
// SUITE: kaizo/tools/checks/check-lightorb.mjs.

import { spawn, destroy } from '../../sim/entity.js';
import {
  lerp, mergeColor, pointDirection, scrEaseIn, lengthdirX, lengthdirY, WHITE,
  gmlEq, gmlLt,
} from '../../sim/gml.js';
import {
  gmlRandom, gmlIrandom, gmlChoose, gmlRandomRange,
} from '../../sim/rng.js';
import { cue, cueStop } from '../../sim/audio.js';
import { scrShakescreen } from '../../sim/shake.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { enginePairHit } from '../../sim/masks.js';
import {
  regularbulletCreate, regularbulletStep, collidebulletOther15,
} from '../../sim/bullets/regularbullet.js';
import { getSwordcolor } from './kaizo-colors.js';
import { kaizoSideb } from './flurry-damage.js';

/**
 * `spr_sunbolt`'s PRECISE MASK — 25x9, origin (16, 4), inked rows 3..5 at
 * columns 8..12, i.e. a 5x3 core well left of the origin.
 *
 * Extracted from the data files' own sprite metadata
 * (`sprite_meta_kaizo.json` / `sprite_meta_vanilla.json`, the UTMT
 * `sprite_meta.csx` dump the packer reads), and IDENTICAL in both builds —
 * `sprites_kaizo.csv` and `sprites_vanilla.csv` agree on every column
 * including `mask_sha1 = deae9294e1780c4ef0c109c1703c4a522a88f032`. So this
 * is vanilla geometry that the mod inherited, not mod art.
 *
 * WHY IT IS A LITERAL HERE rather than a `kaizoMask('spr_sunbolt')` call.
 * `kaizo/data/masks.js` is generated by pack-kaizo-sprites.mjs, and that tool
 * skips any vanilla-sourced sprite the MAIN pack already carries — spr_sunbolt
 * is exactly that, so the packer emits no mask for it and `kaizoMask` throws.
 * The engine's `SPRITE_MASKS` has no entry either, which is the failure this
 * engine has hit hardest: a bullet with no registered mask is SKIPPED by
 * runCollisions (counted as `unmaskedBullets`) and is silently harmless. So
 * the mask is carried here, with its sha1, and the type declares an explicit
 * `collides`.
 */
const SUNBOLT_MASK_RAW = {
  name: 'spr_sunbolt',
  w: 25,
  h: 9,
  originX: 16,
  originY: 4,
  bbox: [8, 3, 12, 5],
  rows: [
    '0000000000000000000000000',
    '0000000000000000000000000',
    '0000000000000000000000000',
    '0000000011111000000000000',
    '0000000011111000000000000',
    '0000000011111000000000000',
    '0000000000000000000000000',
    '0000000000000000000000000',
    '0000000000000000000000000',
  ],
};

/** `sim/masks.js` keeps its `build()` private, so derive `px` the way
 *  split-growtangle-vertical.js does — once, onto the singleton, so identity
 *  comparisons against it hold in every importer. */
export const SUNBOLT_MASK = (() => {
  const m = { ...SUNBOLT_MASK_RAW };
  m.px = m.rows.map((r) => Array.from(r, (c) => c === '1'));
  return m;
})();

/** The approx ledger — the same shape kaizo-mod-launcher.js writes. */
function ledger(state, entry) {
  if (!state.kaizo) state.kaizo = {};
  (state.kaizo.approx ??= []).push(entry);
}

function heartOf(state) {
  return state.soul && state.soul.alive ? state.soul : null;
}

function orbOf(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_knight_lightorb') ?? null;
}

function quickslashControllerOf(state) {
  return state.entities.find(
    (e) => e.alive && e.type.name === 'obj_roaringknight_quickslash_attack',
  ) ?? null;
}

function knightOf(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy') ?? null;
}

// ── THE THREE PARTICLE OBJECTS ──────────────────────────────────────────────
//
// `instance_create` runs the created object's Create event INSIDE the call, so
// every roll a Create makes lands at the call site, in this order, after
// whichever of the call's own arguments rolled. All three objects are
// byte-identical to v105 in the dump — both files were diffed; the mod changes
// none of them.
//
// THEY WERE INLINE BURNS UNTIL 2026-09-12, and the reason was honest: their
// rolls are all in their Create, which runs synchronously inside the
// `instance_create` the orb's Draw is already standing at, so burning the
// draws at the call site put them at exactly the stream position the game puts
// them at and no instance was needed. What that could not do is PAINT — and
// the reason it did not need to was that none of the three sprites was in any
// pack this repo can reach, so an instance would have drawn nothing anyway.
//
// All three are packed now (pack-kaizo-sprites.mjs's WANT list, vanilla art,
// byte-identical in both data files), so they are real types again: `spawn()`
// runs `create()` synchronously, in the same place the burn stood, so the u32
// budget check-lightorb L8 pins is UNCHANGED by the conversion — and the
// Weird Route's orb finally throws the sparks, triangles and rings the mod
// throws. None of them carries a mask, an Other_15 or a reader, so nothing
// else in the sim can see them: they are drawn by render/canvas.js's generic
// tail off `sprite_index`, which is what a GML object with no Draw event does.

/**
 * `obj_knight_spark` — the orb's constant shower.
 *
 * `gml_Object_obj_knight_spark_Create_0.gml`, 6 u32:
 *
 *     image_speed  = 0;
 *     image_index  = irandom(3);       // 2
 *     image_blend  = choose(c_white);  // 1 — one argument, still a draw
 *     image_xscale = choose(-1, 1);    // 1
 *     image_yscale = choose(-1, 1);    // 1
 *     image_angle  = random(360);      // 1
 *     life = 2;
 *
 * and `gml_Object_obj_knight_spark_Step_0.gml` is `life--; if (life == 0)
 * instance_destroy();` — the whole object. `image_speed = 0` with a random
 * `image_index` is why the sprite's four frames read as four different sparks
 * rather than an animation.
 */
export const knightSpark = {
  name: 'obj_knight_spark',

  create(e, state) {
    const rng = state.gmlRng;
    e.image_speed = 0;
    e.image_index = rng ? gmlIrandom(rng, 3) : 0;
    e.image_blend = rng ? gmlChoose(rng, [WHITE]) : WHITE;
    e.image_xscale = rng ? gmlChoose(rng, [-1, 1]) : 1;
    e.image_yscale = rng ? gmlChoose(rng, [-1, 1]) : 1;
    e.image_angle = rng ? gmlRandom(rng, 360) : 0;
    e.life = 2;
    // objects_kaizo.csv: sprite spr_knight_spark, depth 0. `depth` has no
    // INSTANCE_DEFAULT in this engine (kaizo/HANDOFF.md §8), and the draw
    // order sorts on it.
    e.sprite_index = 'spr_knight_spark';
    e.depth = 0;
  },

  step(e, state) {
    e.life -= 1;
    if (e.life === 0) destroy(e, state);
  },
};

/**
 * `obj_knight_triangle` — the ring of spinning shards around the orb's mouth.
 *
 * `gml_Object_obj_knight_triangle_Create_0.gml`, 2 u32:
 *
 *     len = 10;
 *     dir = random(360);   // 1
 *     o   = choose(-1, 1); // 1
 *
 * Its Step shrinks `image_xscale` by 0.4 a frame, spins `dir` by +-4, and
 * rides a 10px circle around its spawn point until the orb is gone:
 *
 *     image_xscale -= 0.4;
 *     if (image_xscale < 0) instance_destroy();
 *     dir += (o == 1) ? 4 : -4;
 *     if (i_ex(obj_knight_lightorb)) { x = xstart + lengthdir_x(len, dir);
 *         y = ystart + lengthdir_y(len, dir); image_angle = dir; }
 *     else instance_destroy();
 *
 * `gmlLt` because GML's `<` is epsilon-tolerant and the orb starts it at
 * `1 + random(0.7)`, which can land on an exact multiple of 0.4.
 */
export const knightTriangle = {
  name: 'obj_knight_triangle',

  create(e, state) {
    const rng = state.gmlRng;
    e.len = 10;
    e.dir = rng ? gmlRandom(rng, 360) : 0;
    e.o = rng ? gmlChoose(rng, [-1, 1]) : 1;
    // objects_kaizo.csv: sprite spr_knight_triangle, depth 0. The orb
    // overwrites both scales straight after the call.
    e.sprite_index = 'spr_knight_triangle';
    e.depth = 0;
  },

  step(e, state) {
    e.image_xscale -= 0.4;
    if (gmlLt(e.image_xscale, 0)) {
      destroy(e, state);
      return;
    }
    e.dir += (e.o === 1) ? 4 : -4;
    if (orbOf(state)) {
      e.x = e.xstart + lengthdirX(e.len, e.dir);
      e.y = e.ystart + lengthdirY(e.len, e.dir);
      e.image_angle = e.dir;
    } else {
      destroy(e, state);
    }
  },
};

/**
 * `obj_knight_ring` — the expanding shockwave, every thirtieth con-1 frame.
 *
 * `gml_Object_obj_knight_ring_Create_0.gml` is four constants and rolls
 * NOTHING (`timer = 0; image_alpha = 0; image_xscale = 1.4; image_yscale =
 * 1.4;`), which is why its line in the budget below is 0 u32 — it was the one
 * particle whose conversion could not move the stream even in principle.
 *
 * Its Step fades IN while it shrinks, and the empty `if (image_xscale == 0.6)`
 * is in the dump verbatim — a branch the mod (and vanilla) left hollow:
 *
 *     timer++; image_alpha += (1/3);
 *     image_xscale -= 0.2; image_yscale -= 0.2;
 *     if (image_xscale == 0.6) { }
 *     if (image_xscale == 0) instance_destroy();
 *
 * `gmlEq` for both: 1.4 less seven 0.2s is -2.2e-16 in float64, so a literal
 * `=== 0` would never fire and the ring would live forever, shrinking through
 * negative scales. GML's `==` is epsilon-tolerant and the game's does fire.
 */
export const knightRing = {
  name: 'obj_knight_ring',

  create(e) {
    e.timer = 0;
    e.image_alpha = 0;
    e.image_xscale = 1.4;
    e.image_yscale = 1.4;
    // objects_kaizo.csv: sprite spr_roaringknight_sword_break_vfx2, depth 0.
    e.sprite_index = 'spr_roaringknight_sword_break_vfx2';
    e.depth = 0;
  },

  step(e, state) {
    e.timer += 1;
    e.image_alpha += (1 / 3);
    e.image_xscale -= 0.2;
    e.image_yscale -= 0.2;
    // `if (image_xscale == 0.6) { }` — empty in the dump, and left out here
    // rather than translated as an empty block: it holds no statement, makes
    // no draw and changes nothing. Recorded so a later reader does not go
    // looking for the missing arm.
    if (gmlEq(e.image_xscale, 0)) destroy(e, state);
  },
};

// ── obj_rouxls_power_up_orb — the ONE particle that has to be an instance ───

/**
 * The wind-up's flying spark, created once a frame for the first nine drawn
 * frames (`if (timer < 18)` against a timer that starts at 9).
 *
 * WHY IT IS A REAL TYPE and the other three are inline draws: its only roll is
 * in its own Draw event, one frame later, at a depth that sorts ahead of the
 * light orb's. See the header's "WHAT IS NOT MODELLED" for the two rules that
 * decide that (sim/entity.js `drawList` snapshots, and sorts depth-descending).
 *
 * Create_0 is sixteen constant assignments and rolls nothing. FOURTEEN are
 * carried, and every one of them is READ by the Draw below — the branches the
 * light orb never takes are translated as branches rather than dropped, which
 * is what keeps `parenttarget`, `thin`, `track_target`, `_type` and
 * `distance_multiplier` from becoming fields nothing reads (this repo's
 * signature defect; CLAUDE.md and every review of this tree).
 *
 * THE TWO THAT ARE NOT CARRIED are `image_alpha` and `radius`, with
 * `max_radius` and the `radius = lerp(max_radius, 1, _progress)` that feeds
 * it. They are the arguments of the three `draw_circle` primitives in the
 * else arm and NOTHING ELSE — no mask, no reader, and no drawer, because this
 * object has no entry in kaizo/render/index.js and its art was never
 * extracted. Parking them "for the drawer" when there is no drawer is exactly
 * the write-with-no-reader this file is otherwise careful about, so they are
 * named here instead of assigned.
 */
export const rouxlsPowerUpOrb = {
  name: 'obj_rouxls_power_up_orb',

  create(e) {
    e.init = 0;
    e.lifetime = 30; // the light orb overwrites this with 12
    e.xx = e.x;
    e.yy = e.y;
    e.timer = 0;
    e.parenttarget = -1;
    e.thin = 0;
    e._type = 0;
    e.track_target = -4;
    e.xoff = 0;
    e.yoff = 0;
    e.distance_multiplier = 1;
    // No sprite in objects_kaizo.csv's row and depth 0; the creator assigns
    // `depth = <orb>.depth + 1` straight after instance_create, and that
    // value is what puts this ahead of the light orb in the draw order.
    e.depth = 0;
  },

  /**
   * Draw_0, everything in it that is not a `draw_*` call. Each guard is here
   * because the object is shared with the rest of the game and the light orb
   * takes only one path through it; translating the guard rather than the
   * path is what makes the Create fields above live.
   *
   *     if (parenttarget != -1 && !i_ex(parenttarget)) { destroy; exit; }
   *     if (parenttarget != -1 &&  i_ex(parenttarget)) { xstart = …; ystart = …; }
   *     if (init == 0) { init = 1;
   *         if (thin) lifetime /= 2;
   *         if (track_target != -4) { xstart = 0; ystart = 0; }
   *         var _distance = random_range(70, 90) * distance_multiplier;
   *         if (_type == 1) _distance = random_range(40, 45);
   *         xx = xstart + lengthdir_x(_distance, direction); x = xx;
   *         yy = ystart + lengthdir_y(_distance, direction); y = yy; }
   *     if (track_target != -4) { xoff = track_target.x; yoff = track_target.y; }
   *     timer++;
   *     if (timer > lifetime) { instance_destroy(); exit; }
   *     x = lerp(xx, xstart, scr_ease_in(timer / lifetime, 2)) + xoff;
   *     y = lerp(yy, ystart, scr_ease_in(timer / lifetime, 2)) + yoff;
   *
   * ONE u32 for the instance's whole life — `random_range(70, 90)`, behind the
   * `init == 0` latch. The `_type == 1` line is a SECOND draw when it is
   * taken, not a free re-read: `random_range` rolls again and throws the first
   * value away. `_type` is 0 on every instance the light orb makes, so it is
   * never taken here, and the branch is written so a caller that sets `_type`
   * gets the right count rather than the wrong one.
   */
  draw(e, state) {
    const rng = state.gmlRng;
    const parent = e.parenttarget !== -1 && e.parenttarget && e.parenttarget.alive
      ? e.parenttarget : null;
    if (e.parenttarget !== -1 && !parent) {
      destroy(e, state);
      return;
    }
    if (parent) {
      e.xstart = parent.x;
      e.ystart = parent.y;
    }
    if (e.init === 0) {
      e.init = 1;
      if (e.thin) e.lifetime /= 2;
      if (e.track_target !== -4) { e.xstart = 0; e.ystart = 0; }
      let distance = (rng ? gmlRandomRange(rng, 70, 90) : 80) * e.distance_multiplier;
      if (e._type === 1) distance = rng ? gmlRandomRange(rng, 40, 45) : 42.5;
      e.xx = e.xstart + lengthdirX(distance, e.direction ?? 0);
      e.x = e.xx;
      e.yy = e.ystart + lengthdirY(distance, e.direction ?? 0);
      e.y = e.yy;
    }
    if (e.track_target !== -4 && e.track_target) {
      e.xoff = e.track_target.x;
      e.yoff = e.track_target.y;
    }
    e.timer += 1;
    if (e.timer > e.lifetime) {
      destroy(e, state);
      return;
    }
    const progress = e.timer / e.lifetime;
    e.x = lerp(e.xx, e.xstart, scrEaseIn(progress, 2)) + e.xoff;
    e.y = lerp(e.yy, e.ystart, scrEaseIn(progress, 2)) + e.yoff;
  },
};

// ── obj_knight_bullethell_bullet2 — the sunbolt ─────────────────────────────

/**
 * Parent chain per objects_kaizo.csv: `obj_regularbullet`. Its Create_0 and
 * Step_0 in the dump ARE obj_regularbullet's, inlined by the decompiler
 * (event_inherited with no body of its own), and both are byte-identical to
 * vanilla — so `regularbulletCreate`/`regularbulletStep` are the translation,
 * not an approximation of it.
 */
export const knightBullethellBullet2 = {
  name: 'obj_knight_bullethell_bullet2',

  create(e, state) {
    regularbulletCreate(e, state); // event_inherited()
    // objects_kaizo.csv: obj_knight_bullethell_bullet2 depth 0. Set
    // explicitly because `depth` has no INSTANCE_DEFAULT and the Draw's
    // `depth -= 100` would otherwise produce NaN (kaizo/HANDOFF.md §8).
    e.depth = 0;
    e.sprite_index = 'spr_sunbolt';
    // `mask_index = spr_sunbolt` (Draw_0:124/151). Same sprite, so this is
    // GameMaker's default anyway.
    //
    // THE ONE INSTALL SITE, and it is the field this module exists for.
    // spr_sunbolt has no row in the engine's SPRITE_MASKS and none in
    // kaizo/data/masks.js (the packer skips a vanilla-sourced sprite the main
    // pack already carries), so a bolt without `mask` is SKIPPED by
    // runCollisions, counted as `unmaskedBullets`, and is silently harmless.
    // Both readers go through here: `collides` below, and sim/index.js's
    // `grazes`, which resolves `e.mask ?? SPRITE_MASKS[sprite_index]` and
    // consults no type override. fireSunbolt used to write it a SECOND time
    // for the GML's `mask_index` line; it no longer does, so this assignment
    // is the only one and deleting it costs every sunbolt its hitbox —
    // check-lightorb.mjs L6 fires a bolt at a parked soul and asserts the hit.
    e.mask = SUNBOLT_MASK;
  },

  step(e, state) {
    regularbulletStep(e, state); // event_inherited()
  },

  /** The engine pair test — obj_heart's collision event with no
   *  scr_precise_hit refinement, which is what Other_15 does here. */
  collides(e, heart) {
    return enginePairHit(heart, e, SUNBOLT_MASK);
  },

  /**
   * Other_15 — the mod's two-line override, then vanilla's body.
   *
   *     target = 0;      // vanilla 3
   *     damage = 103;    // vanilla 206
   *
   * Both are written BEFORE the `active == 1` gate and therefore before
   * `scr_damage`, so they win over the `target = 0; damage = 166` the orb's
   * Draw stamped at fire time. See the header: 166 is dead.
   */
  other15(e, state) {
    e.target = 0;
    e.damage = 103;
    collidebulletOther15(e, state);
  },
};

// ── obj_knight_bullethell2 — the two flanking emitters ──────────────────────

export const knightBullethell2 = {
  name: 'obj_knight_bullethell2',

  /** Create_0. The only mod diff is the two object-index literals, which are
   *  build churn (header). `dir` is computed and, in the mod, never read by
   *  anything that survives — kept because it is the object's only state
   *  besides the counters. */
  create(e, state) {
    e.timer = 0;
    e.con = 0;
    e.a = 0;
    e.b = 0;
    e.c = 0;
    e.dir = 90;
    e.spd = 20;
    e.frc = -0.04;
    // objects_kaizo.csv row 1197: `obj_knight_bullethell2,,0,1,0,,` — no
    // sprite, depth 0, **visible 1**. An earlier draft wrote `visible = false`
    // and cited that same row for it, which the row does not say; the object
    // is visible and simply has nothing to draw, so the renderer's generic
    // tail paints nothing for it either way (render/canvas.js `drawEntity`
    // returns false with no packed sprite and no SPRITE_MASKS entry). Inert
    // today; written to agree with its citation rather than against it.
    e.depth = 0;
    e.visible = true;
    // `var target_obj = 1184; if (i_ex(obj_heart)) target_obj = 1462;`
    // 1462 = obj_heart, 1184 = obj_mainchara (see the header). No soul means
    // no fight, and obj_mainchara does not exist in a fight room, so the
    // fallback is unreachable here; modelled as "no target" rather than
    // invented coordinates.
    const target = heartOf(state);
    if (!target) {
      e.dir = 90;
      return;
    }
    // `if (i_ex(obj_knight_split_growtangle) && ...heart_y == -1)` — the
    // HORIZONTAL organism, which the B-Side quickslash never spawns (that is
    // exactly what G-2 corrected), so this reads the else arm. Translated
    // whole so a caller that does have one behaves.
    const horiz = state.entities.find(
      (h) => h.alive && h.type.name === 'obj_knight_split_growtangle',
    );
    e.dir = pointDirection(e.x, e.y, target.x, target.y)
      - ((horiz && horiz.heart_y === -1) ? 24 : 50);
  },

  /**
   * Step_0. `repeat (0)` in the mod: no bullets, ever. What remains is the
   * heartshot cue every frame, the two counters, and the destroy tests.
   */
  step(e, state) {
    const orb = orbOf(state);
    if (!orb) return; // `if (!i_ex(obj_knight_lightorb)) exit;`

    // `var _dir = dir + sin(timer/10)*15; if (orb.type == 1) _dir = dir;`
    // then the mod's new `if (obj_heart.y < y) _dir -= 180;`. NOTHING READS
    // _dir once `repeat (3)` became `repeat (0)` — computed here only so the
    // shape of the event survives, and parked on `lastDir` so the check can
    // MEASURE the flip's deadness instead of asserting it from prose.
    //
    // check-lightorb.mjs L11b is that measurement, and it is a differential,
    // not a "a number is present": the same emitter is stepped by hand with
    // the soul above it and with the soul below it, and every other field it
    // owns — timer, con, a, b, c, dir, x, y, alive — plus the room's whole
    // entity population and the RNG draw count come out IDENTICAL, while
    // `lastDir` differs by exactly 180. Nothing downstream of the flip exists.
    // L11c closes the other half by grepping kaizo/ and sim/ for a READER of
    // `lastDir`: the check itself is the only one. If either ever changes,
    // this field has become live and this comment is wrong.
    let dir = e.dir + Math.sin(e.timer / 10) * 15;
    if (orb.orbtype === 1) dir = e.dir;
    const heart = heartOf(state);
    if (heart && heart.y < e.y) dir -= 180;
    e.lastDir = dir;

    e.timer += 1;
    if (e.con === 0 && e.timer >= 0) {
      // `repeat (0) { ... }` — the mod deleted the fan. See the header.
      cueStop(state, 'snd_heartshot_dr_b');
      cue(state, 'snd_heartshot_dr_b', 0.8, 1);
      e.a = 0;
      e.b -= 0.1;
    }
    if (knightOf(state) && state.turntimer < 1) {
      destroy(e, state);
      return;
    }
    // vanilla `timer > 70`; the mod lets it run the whole turn.
    if (e.timer > 700) destroy(e, state);
  },
};

// ── obj_knight_lightorb ─────────────────────────────────────────────────────

export const knightLightorb = {
  name: 'obj_knight_lightorb',

  /**
   * Create_0, 15 lines. `type` is RENAMED to `orbtype`: `type` is this
   * engine's entity descriptor and assigning a number over it silently
   * un-types the instance (sim/entity.js says so at length).
   */
  create(e, state) {
    e.timer = 8;
    e.con = 0;
    e.siner = 0;
    e.ringcon = 0;
    e.count = 0;
    e.darken_alpha = 0;
    e.radius = 120;
    e.circle_alpha = 0;
    // `col = merge_color(c_white, get_swordcolor(), 0.2)` — vanilla merged
    // toward c_yellow. get_swordcolor() is kaizo/attacks/kaizo-colors.js.
    e.col = mergeColor(WHITE, getSwordcolor(state), 0.2);
    // `type = 0; if (kaizo_sideb()) type = 1;` — vanilla gated this on
    // `obj_knight_enemy.difficulty == 1`, which nothing in this chain sets,
    // so vanilla's orb never split.
    e.orbtype = kaizoSideb(state) ? 1 : 0;
    e.splitx = 0;
    // objects_kaizo.csv: sprite spr_sneo_bigcircle, depth 0. The sprite IS in
    // the extracted pack since 2026-09-12 (pack-kaizo-sprites.mjs's WANT
    // list), so `sprite_index` is assigned like any other object's and
    // kaizo/render/draw/lightorb.js blits it — it used to be left unset with
    // the drawer painting a ring in its place.
    e.sprite_index = 'spr_sneo_bigcircle';
    e.depth = 0;
    e.image_blend = WHITE;
    // Draw-time values the renderer reads; initialised so the first frame
    // before any draw has them.
    e.drawScale = 0.8;
  },

  /**
   * Draw_0, 202 lines. The whole object.
   *
   * ORDER IS THE POINT. The mod's new guard is the FIRST thing, before
   * `var scale`, so a turn that has run out spends no draws; vanilla's
   * identical destroy at :181 sits after the volley block and therefore after
   * that frame's RNG had already been taken.
   */
  draw(e, state) {
    // Draw_0:1-9 — NEW. Kills the orb AND both emitters, then exits.
    //
    // SELF FIRST, then the `with` sweep, which is the GML's own order:
    //
    //     instance_destroy();
    //     with (obj_knight_bullethell2) { instance_destroy(); }
    //
    // An earlier draft swept the emitters first. `destroy()` here only marks
    // `alive = false` and runs Destroy/CleanUp, neither of which this object
    // declares, so the two orders were indistinguishable — but "indis-
    // tinguishable today" is how an ordering fault gets planted, and the GML
    // is free.
    if (state.turntimer < 1) {
      destroy(e, state);
      for (const b of state.entities) {
        if (b.alive && b.type.name === 'obj_knight_bullethell2') destroy(b, state);
      }
      return;
    }
    // Draw_0:10-13 — NEW. No soul, no draws at all.
    const heart = heartOf(state);
    if (!heart) return;

    // `var scale = 0.8 + sin(siner / 4) * 0.2;`
    let scale = 0.8 + Math.sin(e.siner / 4) * 0.2;
    const rng = state.gmlRng;

    if (e.con === 0) {
      e.timer += 1;
      if (e.timer < 15 && e.darken_alpha < 0.35) e.darken_alpha += 0.05;
      if (e.timer > 15) e.darken_alpha -= 0.1;
      if (e.timer === 9) cue(state, 'snd_knight_stretch', 1.5, 0.6);
      if (e.timer % 3 === 0) scrShakescreen(state);
      // `if ((timer % 1) == 0)` — always true.
      //
      //     instance_create((x - 30) + random(60), (y - 30) + random(60),
      //                     obj_knight_spark);
      //
      // TWO argument draws, Y FIRST (GML call arguments evaluate
      // right-to-left), then the SIX in obj_knight_spark's own Create, which
      // instance_create runs here — hence the spawn AFTER both, with the
      // values it rolled.
      const sparkY = rng ? gmlRandom(rng, 60) : 30;
      const sparkX = rng ? gmlRandom(rng, 60) : 30;
      spawn(state, knightSpark, { x: (e.x - 30) + sparkX, y: (e.y - 30) + sparkY });
      // :38-46 — the tvturnoff flash. Visual; `aa` parked for the drawer.
      if (e.timer < 40) {
        let aa = 0.25 - (e.timer / 100);
        if (aa < 0) aa = 0;
        e.flashAlpha = aa;
      } else {
        e.flashAlpha = 0;
      }
      // :47-54 — obj_rouxls_power_up_orb. `instance_create` FIRST (its Create
      // rolls nothing), then the four assignments the orb makes on it, of
      // which `direction = irandom(360)` is the only draw. The instance is
      // real because its own Draw rolls one more u32 on the NEXT frame, at
      // `depth + 1`, ahead of this object — see the header.
      if (e.timer < 18) {
        const d = spawn(state, rouxlsPowerUpOrb, { x: e.x, y: e.y });
        d.direction = rng ? gmlIrandom(rng, 360) : 0;
        d.lifetime = 12;
        d.depth = e.depth + 1;
        d.image_blend = e.image_blend;
      }
      // `scale = lerp(scale * 0.001, scale, timer / 40);`
      scale = lerp(scale * 0.001, scale, e.timer / 40);
      if (e.timer === 40) {
        e.con = 1;
        e.timer = 0;
        cueStop(state, 'snd_knight_stretch');
        if (e.orbtype === 1) {
          // The two flanking emitters, at the FULL split width — splitx has
          // already reached 60 over frames 30..39 below.
          spawn(state, knightBullethell2, { x: e.x - e.splitx, y: e.y });
          spawn(state, knightBullethell2, { x: e.x + e.splitx, y: e.y });
        }
      }
      // AFTER the con switch, which is why this never fires on the frame the
      // switch happens (`timer` is 0 by then).
      if (e.orbtype === 1 && e.splitx < 60 && e.timer >= 30) e.splitx += 6;
    }

    if (e.con === 1) {
      e.timer += 1;
      let x2 = 0;
      if (e.orbtype === 1) x2 = e.splitx;
      let rep = 1;
      if (e.orbtype === 1) rep = 2;
      for (let r = 0; r < rep; r += 1) {
        // obj_knight_triangle. `instance_create(x + _x, y, …)` — no argument
        // rolls, then TWO in its Create (random(360), choose(-1, 1)), and only
        // then the two the orb writes onto it. The Create's pair comes FIRST
        // because instance_create returns after running it.
        //
        //     tri = instance_create(x + _x, y, obj_knight_triangle);
        //     tri.image_yscale = 1 + random(0.5);
        //     tri.image_xscale = 1 + random(0.7);
        //
        // yscale before xscale — two statements, in that order.
        const tri = spawn(state, knightTriangle, { x: e.x + x2, y: e.y });
        tri.image_yscale = 1 + (rng ? gmlRandom(rng, 0.5) : 0);
        tri.image_xscale = 1 + (rng ? gmlRandom(rng, 0.7) : 0);
        // obj_knight_ring at `timer % 30 == 0 || timer == 1` — four constant
        // assignments in its Create, so no draws either way.
        if (e.timer % 30 === 0 || e.timer === 1) {
          spawn(state, knightRing, { x: e.x + x2, y: e.y });
        }
        // The spark again: two argument draws, Y first, then its six. Its x
        // carries the mouth offset — `(x - 30) + random(60) + _x`.
        const sparkY = rng ? gmlRandom(rng, 60) : 30;
        const sparkX = rng ? gmlRandom(rng, 60) : 30;
        spawn(state, knightSpark, {
          x: (e.x - 30) + sparkX + x2,
          y: (e.y - 30) + sparkY,
        });

        if (e.timer % 10 === 0) {
          // :100-104 — the aim. The mod narrowed +-5 to +-2 and wrapped it in
          // an i_ex guard; the draw count is unchanged.
          let basedir = 0;
          if (rng) {
            basedir = ((pointDirection(e.x + x2, e.y, heart.x + 10, heart.y + 10) + 36) - 2)
              + gmlIrandom(rng, 4);
          }
          e.count += 1;
          let n = 0;
          // `obj_roaringknight_quickslash_attack.local_turntimer < -60 ||
          //  obj_knight_enemy.difficulty == 0`. GML `||` short-circuits and
          // neither side draws, so the order only decides which is read.
          const ctrl = quickslashControllerOf(state);
          const knight = knightOf(state);
          const panic = (ctrl ? ctrl.local_turntimer < -60 : false)
            || (knight ? knight.difficulty === 0 : false);
          if (panic) {
            // THE FIVE-WAY. `irandom(60)` is drawn on top of the irandom(4)
            // above and overwrites its value — a dead value, a live draw.
            basedir = ((pointDirection(e.x + x2, e.y, heart.x + 10, heart.y + 10) + 36) - 30)
              + (rng ? gmlIrandom(rng, 60) : 0);
            if (e.count % 2 === 0) {
              basedir = pointDirection(e.x + x2, e.y, heart.x + 10, heart.y + 10);
            }
            for (let i = 0; i < 5; i += 1) {
              // `5 + random(2)` — arg4 of scr_fire_bullet, evaluated before
              // arg3 (right-to-left), though only one of them draws.
              const spd = 5 + (rng ? gmlRandom(rng, 2) : 0);
              fireSunbolt(state, e.x + x2, e.y, basedir + (72 * n), spd);
              n += 1;
            }
          } else {
            // THE THREE-WAY, at the constant speed 4.5 — no draws here at
            // all, which is why this arm's volley costs 2 u32 over an ordinary
            // frame and the five-way's costs 9.
            if (e.count % 3 === 0 && x2 > 0) {
              basedir = pointDirection(e.x + x2, e.y, heart.x + 10, heart.y + 10);
            }
            if (e.count % 5 === 0 && x2 < 0) {
              basedir = pointDirection(e.x + x2, e.y, heart.x + 10, heart.y + 10);
            }
            for (let i = 0; i < 3; i += 1) {
              fireSunbolt(state, e.x + x2, e.y, basedir + (120 * n), 4.5);
              n += 1;
            }
          }
          // `snd_play_x(snd_stardrop, 0.6 / _rep, 1)` — vanilla 0.8, and the
          // gain is halved when the orb has two mouths.
          cue(state, 'snd_stardrop', 1, 0.6 / rep);
        }
        // `_x = splitx * -1;` at the END of each iteration, so mouth 2 is the
        // mirror of mouth 1.
        x2 = e.splitx * -1;
      }
    }

    // :163-171 — the two-frame colour flicker between `col` and c_white.
    e.siner += 1;
    e.image_blend = (e.siner % 2 === 0) ? e.col : WHITE;
    e.drawScale = scale;
    // :172-180 — one blit, or two at +-splitx. Parked for the drawer.
    e.drawSplit = (e.orbtype === 1 && e.con === 0 && e.timer > 29)
      || (e.orbtype === 1 && e.con === 1);

    // :181-188 — VANILLA's destroy, kept. Unreachable now that the same test
    // opens the event, and translated because it is in the file. Same
    // self-then-sweep order as the guard above, for the same reason.
    if (state.turntimer < 1) {
      destroy(e, state);
      for (const b of state.entities) {
        if (b.alive && b.type.name === 'obj_knight_bullethell2') destroy(b, state);
      }
      return;
    }

    // :189-201 — the charge disc, `get_swordcolor()` where vanilla was
    // c_blue. State only; the drawer paints it.
    if (e.con === 0) {
      if (e.radius > 0) e.radius -= 4;
      if (e.circle_alpha < 0.4) e.circle_alpha += 0.1;
      e.discColor = getSwordcolor(state);
    }
  },
};

/**
 * `with (scr_fire_bullet(x, y, obj_knight_bullethell_bullet2, dir, spd,
 *  spr_sunbolt)) { ... }` — Draw_0:116-127 and :143-154, identical bodies.
 *
 * SIX ARGUMENTS, so arg6 and arg7 DEFAULT. Read the script
 * (gml_GlobalScript_scr_fire_bullet.gml) rather than guessing at it:
 *
 *     function scr_fire_bullet(arg0, arg1, arg2, arg3, arg4, arg5 = -4,
 *                              arg6 = 0, arg7 = false, arg8 = 87135) {
 *         bullet = instance_create(arg0, arg1, arg2);
 *         with (bullet) { direction = arg3; speed = arg4;
 *             if (arg5 != -4) sprite_index = arg5;
 *             updateimageangle = arg6;              // 0 here
 *             if (arg6) image_angle = arg3;         // NOT taken
 *             if (arg7) with (other) scr_bullet_inherit(other.id); }
 *
 * so the call leaves `updateimageangle = 0` and never touches `image_angle`;
 * a previous draft's comment claimed the opposite on both counts. Both are
 * then set by the `with (…)` block below — `updateimageangle = 1` and
 * `image_angle = direction`, the INSTANCE's direction — which is why the net
 * result is the same and the description was still wrong. arg7 false is the
 * load-bearing default: no scr_bullet_inherit, so the bullet keeps
 * scr_bullet_init's `damage = 10, target = 0` until the block overwrites them.
 * No RNG anywhere in scr_fire_bullet itself.
 */
function fireSunbolt(state, x, y, direction, speed) {
  const b = spawn(state, knightBullethellBullet2, { x, y });
  // scr_fire_bullet's own body, in its order: direction, speed, sprite_index
  // (arg5 is spr_sunbolt, so the `!= -4` guard passes), then
  // `updateimageangle = arg6` with arg6 defaulted to 0 — and `if (arg6)`
  // therefore leaves image_angle alone.
  b.direction = direction;
  b.speed = speed;
  b.sprite_index = 'spr_sunbolt';
  b.updateimageangle = 0;
  // …then the `with (…)` block, Draw_0:118-126.
  // `target = 0; damage = 166;` — the mod's two new lines. 166 is
  // overwritten by Other_15's 103 on contact; see the header.
  b.target = 0;
  b.damage = 166;
  // `updateimageangle = 1; image_angle = direction;
  //  gravity_direction = direction + 180; gravity = speed / 90;` — the last
  // three read the INSTANCE's built-ins, which this engine narrows to float32
  // on assignment (installF32Builtins). Read them back off the bullet rather
  // than reusing the f64 locals: `5 + random(2)` is a double, `b.speed` is
  // not, and `speed / 90` off the wrong one is a different number in the last
  // bits.
  b.updateimageangle = 1;
  b.image_angle = b.direction;
  b.gravity_direction = b.direction + 180;
  b.gravity = b.speed / 90;
  // `mask_index = spr_sunbolt`. The mask itself is installed ONCE, in
  // knightBullethellBullet2.create — same sprite, same singleton — so this
  // line is the GML's restatement of a value the instance already carries and
  // not a second write. Writing it twice is what the reviewers caught; the
  // Create is the right home for it because `collides` and sim/index.js's
  // `grazes` both read `e.mask` and a bolt spawned on any other path would
  // otherwise be skipped as `unmaskedBullets`.
  b.depth -= 100;
  // `scr_lerpvar("gravity", gravity, 0, 30)` — the retro-thrust decays to
  // nothing over 30 frames, so the bolt slows, stops shrinking its speed and
  // then coasts. pointa is the NUMBER, read now.
  scrLerpvar(state, spawn, b, 'gravity', b.gravity, 0, 30);
  return b;
}

/**
 * `instance_create(x, y, obj_knight_lightorb)` —
 * obj_knight_split_growtangle_vertical Step_0:15, on the tear frame.
 *
 * Exported so that call site is one line. There is nothing else to it: the
 * orb takes no arguments and reads its own configuration out of
 * `kaizo_sideb()` and `get_swordcolor()`.
 */
export function spawnLightorb(state, x, y) {
  return spawn(state, knightLightorb, { x, y });
}

/** Re-exported so a caller that wants to ledger a partial translation has the
 *  same helper the rest of kaizo/ uses. Nothing here ledgers today. */
export { ledger as lightorbLedger };
