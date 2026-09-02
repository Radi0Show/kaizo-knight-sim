// KAIZO obj_knight_split_growtangle_vertical — the SIDE-B VERTICAL SPLITTER.
// V-C recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// WHAT THIS CLOSES. `kaizo/attacks/quickslash.js` endtype 1 (the B-Side
// finisher, dc type 97.1) reaches for this object and, until now, spawned the
// verified horizontal organism with `vertical = true` instead, ledgering
//
//     asked: obj_knight_split_growtangle_vertical (Side B vertical finish)
//     used:  obj_knight_split_growtangle with vertical = true
//
// That substitution was never close. The two objects share a NAME and a
// Create, and nothing else: the horizontal organism is a 359-line state
// machine that opens, fires thirteen teeth, CLOSES again and repeats, while
// this one is 130 lines that open ONCE, permanently, and trap the soul in
// whichever half it was standing in. Its End Step is a different clamp with
// different constants, it never rounds the soul's position, and it fires no
// teeth at all.
//
// PROVENANCE — read for every line below:
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_knight_split_growtangle_vertical_Create_0.gml   (32 lines)
//     gml_Object_obj_knight_split_growtangle_vertical_Step_0.gml     (130)
//     gml_Object_obj_knight_split_growtangle_vertical_Step_2.gml     (33)
//     gml_Object_obj_knight_split_growtangle_vertical_Other_10.gml   (2)
//     gml_Object_obj_knight_split_growtangle_vertical_Other_11.gml   (28)
//     gml_Object_obj_knight_split_growtangle_vertical_CleanUp_0.gml  (3)
//     gml_Object_obj_knight_split_growtangle_vertical_Draw_0.gml     (18)
//     gml_Object_obj_roaringknight_quickslash_big_Step_0.gml:44-54   (the creator)
//
// THE MOD'S DELTA IS ONE HUNK. Diffed file by file against
// `gml_vanilla_v105/CodeEntries/` (same decompiler, same run): Create_0,
// Step_2, Other_10/11/12/13, CleanUp_0 and Draw_0 are BYTE-IDENTICAL to
// vanilla, and Step_0 differs by exactly four lines — the soul's mask is
// swapped to `spr_dodgeheart_smaller_2px_mask` on the frame the box tears.
// That matches `deltas/INDEX.md`'s one-line verdict for this file ("swaps
// heart to 2px smaller mask at split fire") and is the only reason the file
// appears in the mod at all. Everything else here is vanilla content that
// vanilla could never reach: CLAUDE.md records this object as having "zero
// creators anywhere in the dump", and the mod is what gives it one.
//
// PROVENANCE OF THE COPY. Per the kaizo convention, this is written against
// the verified `sim/attacks/split-growtangle.js` — its `splitFlameMarker`
// type is IMPORTED rather than re-declared, its `stepOrder: -0.5` ordering
// decision is inherited with the same justification, its `baseDepth` guard
// against the missing object-definition depth is carried over, and its
// box-park / marker-riding idioms are the same lines. What is NOT shared is
// the state machine, because the two objects genuinely do not have one.
//
// ── the shape, in one paragraph ───────────────────────────────────────────
//
//   con 0   twenty frames of nothing (the wind-up under the big slash)
//   con 1   the tear: the soul's mask shrinks, the box is hidden and parked
//           offscreen, `distance` eases OUT to 50 over 30 frames on
//           scr_ease_out(t, 6), and the soul is SHOVED by
//           (Δdistance * heart_y * 1.25) — away from the cut, into the half
//           it was already in
//   con 2   permanent. The con-1 block stops running, so `distance` freezes
//           at its last value and the arena stays cut in two for the rest of
//           the turn. Nothing in the object ever closes it; the turn sweep
//           is what takes it away.
//
// This is why quickslash's endtype-1 wind-down keeps its controller ~100
// frames longer than endtype 0 (`local_turntimer < -160` vs `-60/-110`,
// quickslash Step_0:36-50) — those are the frames the player spends locked
// in half an arena.
//
// ── what is NOT translated, and why ───────────────────────────────────────
//
//   * Other_12 / Other_13 — the fountain WALLS. Dead in vanilla (CLAUDE.md:
//     "nothing ever fires them — no `event_user(2)`/`(3)` targets it") and
//     dead in the mod: a content grep of the whole kaizo dump finds no
//     event_user(2)/(3) aimed here either.
//   * Step_0's second `if (timer == 20 && false)` block — 70 lines that build
//     a 14-bullet fountain wall out of `obj_roaringknight_fountain_bullet`,
//     behind a literal `false`. It is in the decompilation exactly as
//     written, it is unreachable, and it consumes NO RNG because it never
//     runs. Recorded here rather than deleted so a later reader does not
//     "restore" it: the fountain bullets in this attack do not exist.
//   * Other_11's SURFACE work — the same policy the sim module states for
//     its own Other_11 ("surfaces/box sprite regeneration ... visual only").
//     The state writes that are NOT surface work (`customBox`, `maxyscale`,
//     `image_yscale`) ARE applied, because sim/battlebox.js models those
//     fields and the box's geometry reads them. The generated
//     `spr_custom_box` — a box sprite with a 50px slot cut through its middle
//     — is not modelled; it cannot matter while the split is open, because
//     the box is parked at x -9999 for every frame `distance > 0` and the
//     one frame it is not parked (`distance == 0`, the tear frame itself)
//     the soul is already being clamped by Step_2 below.
//   * Draw_0 — pure drawing (two half-box blits at ±dist plus the flame
//     edges). `flame_index += 0.5` is its one piece of state and lives in
//     endStep here, exactly as the sim module places its own.
//   * CleanUp_0 restores `obj_growtangle.visible` and destroys the two
//     markers. There is no destroy hook in sim/entity.js, so it ships as the
//     exported `verticalSplitCleanUp(state, e)` — the sim module has the same
//     gap and simply lets the turn sweep collect the markers.
//
// ── the one APPROXIMATION, ledgered ───────────────────────────────────────
//
// `instance_create(x, y, obj_knight_lightorb)` on the tear frame. That object
// is a whole sub-attack run out of its Draw event — a growing orb that after
// 40 frames starts firing five-way `obj_knight_bullethell_bullet2` sunbolts
// at damage 166 every ten frames, doubled and split ±60px on the B-Side
// (`type = 1` under kaizo_sideb) — and nothing in kaizo/ or sim/ translates
// it. Spawning a stand-in would be inventing bullets; dropping it silently
// would hide live damage. So it is LEDGERED at the point of use, the same
// shape kaizo-mod-launcher.js writes, and `state.kaizo.approx` stays the
// work queue.
//
// SUITE: kaizo/tools/checks/check-split-growtangle-vertical.mjs.

import { spawn, destroy } from '../../sim/entity.js';
import { scrEaseOut, GRAY, WHITE } from '../../sim/gml.js';
import { cue } from '../../sim/audio.js';
// The cut-face flame carrier, straight from the verified sim organism — the
// two objects create it identically (obj_marker + spr_rk_split_flame_big at
// double scale, image_speed 0.5, opposite angles), so re-declaring it here
// would be a second type with the same name and the renderer would have to
// know about both.
import { splitFlameMarker } from '../../sim/attacks/split-growtangle.js';
import { kaizoMask } from '../data/masks.js';
import { HEART_RECT } from '../../sim/masks.js';

/** kaizo/data/masks.js hands back the SAME object on every call in every
 *  importer (ES modules are singletons), so deriving `px` onto it — rather
 *  than into a copy — is what makes `state.soul.mask === KAIZO_SMALLER_
 *  HEART_MASK` hold no matter which attack stamped it. Identical idiom, and
 *  deliberately identical VALUE, to underbox.js's copy. */
function maskWithPx(m) {
  if (!m.px) m.px = m.rows.map((r) => Array.from(r, (c) => c === '1'));
  return m;
}

/**
 * `spr_dodgeheart_smaller_2px_mask` — 20x20 Precise, bbox [4,4]..[15,15].
 * The mod's shrunken soul hitbox and the ONLY thing this file's Step_0
 * changes from vanilla (Step_0:6-9).
 *
 * NOT `spr_dodgeheart_smaller_2px`, which is the companion ART sprite and an
 * AxisAlignedRect — using it would square off the hurtbox. The GML names the
 * `_mask` one.
 */
export const KAIZO_SMALLER_HEART_MASK = maskWithPx(
  kaizoMask('spr_dodgeheart_smaller_2px_mask'),
);

/** The restore half of the swap, for scenes that do not respawn the soul per
 *  turn. The GML never restores; obj_moveheart's next handoff does. Same
 *  contract as underbox.js's `restoreHeartMask`, and interchangeable with it
 *  — both compare against the one shared mask object. */
export function restoreHeartMask(state) {
  if (state.soul && state.soul.mask === KAIZO_SMALLER_HEART_MASK) {
    state.soul.mask = HEART_RECT;
  }
}

function box(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
}

/** The organism's own depth is set in the OBJECT DEFINITION, which no code
 *  dump contains — see sim/attacks/split-growtangle.js for the full note and
 *  for why `undefined + 10` (NaN) scrambled draw order before this existed. */
function baseDepth(e) {
  return e.depth ?? 0;
}

/** The approx ledger — the same shape kaizo-mod-launcher.js and quickslash.js
 *  write; verify-kaizo prints it. Guarded so a bare check-state can run. */
function ledger(state, entry) {
  if (!state.kaizo) state.kaizo = {};
  (state.kaizo.approx ??= []).push(entry);
}

/** Other_10 — event_user(0). Two lines, and this object calls it once. */
function eventUser0(e) {
  e.timer = 0;
  e.con += 1;
}

/**
 * Other_11 — event_user(1). The box is rebuilt as a taller sprite with a
 * 50px slot cut out of its middle; the surface work is skipped (header) and
 * the three state writes that drive sim/battlebox.js's geometry are kept.
 *
 * The `if (obj_growtangle.customBox) exit;` guard is the FIRST line and is
 * load-bearing: it makes the whole event idempotent, so a second tear (or a
 * box that some earlier attack already customised) leaves the scale alone.
 */
function eventUser1(state, e) {
  const gt = box(state);
  if (!gt) return;
  if (gt.customBox) return;
  // 10/3 exactly as the decompiler printed it — the literal, not a division,
  // so the f64 bits are the original's.
  const newyscale = 3.3333333333333335;
  gt.customBox = true;
  gt.image_yscale = newyscale;
  gt.maxyscale = newyscale;
  e.customBoxBuilt = true;
}

export const splitGrowtangleVertical = {
  name: 'obj_knight_split_growtangle_vertical',

  // BEFORE THE SOUL, for the reason the sim organism documents at length: the
  // runner steps newest-first, this object is born mid-turn, and in the game
  // its Step — the easing, the con-1 heart shove, and the box's park/return
  // at the tail — runs before obj_heart's. Same number, same justification.
  stepOrder: -0.5,

  /** Create_0 — byte-identical to vanilla v105 (diffed). Note what is ABSENT
   *  next to the horizontal organism's Create: no `effect`, no
   *  `old_distance`, no `heart_x`, and none of the 28 configuration fields
   *  (`split`, `vertical`, `diagonal`, `difficulty`, `bullet_count`, …). This
   *  object has no difficulty axis and no teeth. */
  create(e, state) {
    const gt = box(state);
    e.image_blend = gt ? gt.image_blend : WHITE;
    // `image_xscale = obj_growtangle.image_xscale;` — the box's LIVE scale.
    // NOTE the sim organism's own Create reads `gt.xscale`, a field
    // sim/battlebox.js removed on purpose (its line 55 note: "There used to
    // be a second pair, xscale/yscale…"), so that read has been `undefined`
    // there. Copying the stale name forward would import a bug; the GML
    // names image_xscale and so does this.
    e.image_xscale = gt ? gt.image_xscale : 2;
    e.image_yscale = gt ? gt.image_yscale : 2;
    e.depth = baseDepth(gt ?? e) + 100;
    e.con = 0;
    e.timer = 0;
    e.distance = 0;
    if (gt) gt.visible = false;
    e.heart_y = 0;
    e.sprite_index = gt ? gt.sprite_index : 'spr_battlebg_0';
    e.split_dist = 50;
    e.slow = 4;
    e.fast = 8;
    // `child_bullet[0] = -4; count = 0;` — the fountain-wall bookkeeping the
    // dead branch would have filled. `count` stays 0 forever, which is what
    // makes the con-1 `timer == 7` depth loop below a no-op. Kept because the
    // loop reads them.
    e.child_bullet = [-4];
    e.count = 0;
    e.flame_index = 0;

    // THE FLAMES IN THE GAP — two obj_markers, created facing opposite ways
    // at double scale. Only their Y is re-driven each Step (the GML never
    // touches marker X after Create), so marker 0 keeps its +2 x offset and
    // marker 1 its +0 for the whole attack.
    e.markers = [0, 1].map((i) => {
      const m = spawn(state, splitFlameMarker, {
        x: e.x + (i === 0 ? 2 : 0),
        y: e.y + (i === 0 ? -1 : 2),
      });
      m.sprite_index = 'spr_rk_split_flame_big';
      m.image_speed = 0.5;
      m.image_xscale = 2;
      m.image_yscale = 2;
      m.image_angle = i === 0 ? 180 : 0;
      m.image_blend = GRAY;
      m.depth = baseDepth(e) + 10;
      return m;
    });
  },

  /** Step_0. */
  step(e, state) {
    e.timer += 1;

    if (e.con === 0) {
      if (e.timer === 20) {
        // ── THE MOD'S ONE DELTA (Step_0:6-9) ──────────────────────────────
        // `with (obj_heart) mask_index = spr_dodgeheart_smaller_2px_mask;`
        // The soul's hurtbox shrinks from the full 20x20 heart to the 2px
        // one for the rest of the turn — 100 solid pixels instead of the
        // vanilla mask's heart. Every other line in this file is vanilla.
        if (state.soul) state.soul.mask = KAIZO_SMALLER_HEART_MASK;

        e.timer = 0;
        e.con = 1;
        eventUser1(state, e); // event_user(1) — the split box sprite
        cue(state, 'snd_knight_boxbreak', 1.1);
        cue(state, 'snd_chargeshot_fire');

        // `instance_create(x, y, obj_knight_lightorb)` — APPROX, ledgered.
        // See the header: the lightorb is an untranslated sub-attack that
        // fires damage-166 sunbolts out of its Draw event. One row per tear,
        // and the tear happens once.
        ledger(state, {
          type: 97.1,
          asked: 'obj_knight_lightorb (vertical split, Step_0:16)',
          used: 'nothing spawned',
          why: 'lightorb sunbolt sub-attack not translated yet',
        });

        // WHICH HALF THE SOUL IS IN, decided once and never revisited. The
        // +10 is the soul sprite's centre (origin is its top-left corner).
        // Note it compares against the box's LIVE y, not ystart — the box
        // has not been parked yet on this frame, and only x is ever parked.
        const gt = box(state);
        const heart = state.soul;
        if (heart && gt) {
          e.heart_y = (heart.y + 10) < gt.y ? -1 : 1;
        }
      }
      // `if (timer == 20 && false) { ...14 fountain bullets... }` — the dead
      // branch. See the header: unreachable, consumes no RNG, not translated.
    }

    if (e.con === 1) {
      if (e.timer === 7) {
        // `for (i = 0; i < count; i++) child_bullet[i].depth = ...` — count
        // is 0 because the only thing that fills child_bullet is the dead
        // branch above. Kept as the no-op it is.
        for (let i = 0; i < e.count; i += 1) {
          const b = e.child_bullet[i];
          const gt = box(state);
          if (b && b.alive && gt) b.depth = baseDepth(gt) - 10;
        }
      }

      if (e.timer <= 30) {
        // `var _old_distance = distance;` — a LOCAL, captured here. This
        // object has no `old_distance` instance variable at all (the
        // horizontal one does), which is why the delta cannot leak across
        // frames.
        const oldDistance = e.distance;
        // scr_ease_out(t, 6) is `-2^(-10t) + 1`, so the open never quite
        // reaches 50: at timer 30 it is 49.951171875, and that is the value
        // the gap holds for the rest of the turn.
        e.distance = scrEaseOut(e.timer / 30, 6) * 50;
        // THE SHOVE. The soul is pushed by 1.25x the frame's growth, away
        // from the cut — this is what makes the tear feel like it throws you
        // rather than merely moving the walls.
        if (state.soul) {
          state.soul.y += (e.distance - oldDistance) * e.heart_y * 1.25;
        }
      } else {
        // con 1 -> 2, and there is no con 2 block. The gap is now permanent.
        eventUser0(e);
      }
    }

    // THE FLAMES RIDE THE CUT FACES. Y only, and the offsets are the
    // original's asymmetric -1 / +3.
    const dist = Math.round(e.distance);
    if (e.markers && e.markers.length === 2) {
      const [m0, m1] = e.markers;
      if (m0.alive) m0.y = e.y - dist - 1;
      if (m1.alive) m1.y = e.y + dist + 3;
    }

    // Park the main box offscreen while the split is open — the original's
    // own mechanism for taking the un-split arena out of the collision world.
    const gt = box(state);
    if (gt) {
      if (e.distance > 0) gt.x = -9999;
      else gt.x = gt.xstart;
    }
  },

  /**
   * Step_2 — End Step, and it is NOT the horizontal organism's clamp.
   *
   * Two differences that decide where the soul can stand, both measured off
   * the GML rather than adapted:
   *   * the X band is FIXED at [xstart - 70, xstart + 52] — it does not widen
   *     with the cut, because the cut is horizontal;
   *   * the Y band is one HALF, chosen by `heart_y`, and it is 62 pixels tall
   *     either way: [y - 122, y - 60] above, [y + 40, y + 100] below. The
   *     soul cannot cross the gap once the tear starts.
   * And there is NO `round()` on the soul afterwards — the horizontal
   * organism rounds both coordinates every End Step, which is why soul
   * positions stay integral throughout THAT attack and do not here.
   *
   * `obj_growtangle.xstart` for X and `obj_growtangle.y` for Y is the
   * original's own mix, and it is deliberate: x is parked at -9999 by then.
   */
  endStep(e, state) {
    // `flame_index += 0.5` is the last line of the object's Draw. Same
    // placement decision as the sim module: a Draw counter that must live on
    // the sim frame, use-then-increment, and it survives `?frames=N`.
    e.flame_index = (e.flame_index ?? 0) + 0.5;

    if (e.con <= 0) return;
    const heart = state.soul;
    const gt = box(state);
    // NO SOUL, NO CLAMP — obj_heart exists only during the bullet phase, so
    // an organism that outlives its turn by a frame has nothing to hold.
    if (!heart || !gt) return;

    if (heart.x < gt.xstart - 70) heart.x = gt.xstart - 70;
    if (heart.x > gt.xstart + 52) heart.x = gt.xstart + 52;
    if (e.heart_y === -1) {
      if (heart.y < gt.y - 122) heart.y = gt.y - 122;
      if (heart.y > gt.y - 60) heart.y = gt.y - 60;
    } else {
      if (heart.y > gt.y + 100) heart.y = gt.y + 100;
      if (heart.y < gt.y + 40) heart.y = gt.y + 40;
    }
  },
};

/**
 * CleanUp_0, three lines. sim/entity.js has no destroy hook, so this is
 * explicit — call it wherever the organism is torn down early. The turn sweep
 * collects the markers on its own, so the only thing that is genuinely lost
 * without a call is the box's `visible`, which clearTurn rebuilds anyway.
 */
export function verticalSplitCleanUp(state, e) {
  const gt = box(state);
  if (gt) gt.visible = true;
  for (const m of e.markers ?? []) if (m && m.alive) destroy(m);
  e.markers = [];
}

/**
 * The creator, `obj_roaringknight_quickslash_big` Step_0:44-54 — the endtype
 * fork's B-Side arm. Exported so quickslash.js's endtype-1 branch becomes the
 * three lines the GML actually is:
 *
 *     const sp = spawnVerticalSplit(state, e);   // instance_create + inherit
 *     armKaizoSplitter(sp);                      // stays quickslash's
 *
 * `scr_bullet_inherit` is the caller's (quickslash imports it already), so it
 * is passed in rather than re-imported: `inherit` runs on the new organism
 * before `target = 0` overrides the inherited target, exactly as the GML
 * orders those two lines.
 */
export function spawnVerticalSplit(state, creator, inherit) {
  const gt = box(state);
  const sp = spawn(state, splitGrowtangleVertical, {
    x: gt ? gt.x : creator.x,
    y: gt ? gt.y : creator.y,
  });
  if (inherit) inherit(creator, sp);
  // `_splitter.target = 0;` — NEW in the mod on BOTH endtype arms: the
  // organism's damage is forced onto slot 0's redirect path instead of the
  // inherited target 3.
  sp.target = 0;
  return sp;
}
