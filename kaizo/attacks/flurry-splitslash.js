// KAIZO obj_roaringknight_splitslash — Flurry's cut, mod build.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission.
//
// Provenance: kaizo-mod/gml_kaizo_dump/CodeEntries/
//   gml_Object_obj_roaringknight_splitslash_Step_0.gml
//   gml_Object_obj_roaringknight_splitslash_Other_15.gml
//   gml_Object_obj_roaringknight_splitslash_Draw_0.gml
// Baseline copied from sim/attacks/splitslash.js (oracle-verified); only the
// cited KAIZO hunks diverge. These retunes apply at ALL difficulties — this
// is the mod's retune layer over the whole flurry family.
//
// What diverges from the sim module:
//   - Aim scatter tightened: angleoffset +-2 (was +-12), with the wide +-12
//     roll RESTORED — as an extra second draw — only on Side-B when the
//     owning boxsplitter runs difficulty 3 (kaizo Step_0 11-18). Positional
//     scatter halved: +-4*2 on the vertical/horizontal axes (was +-8*2);
//     diagonal unchanged (kaizo Step_0 31, 35).
//   - NEW cross-instance freeze: while any OTHER splitslash holds a
//     playerstrike, this one's timer is decremented once per striker each
//     step — pending telegraphs stall during a strike (kaizo Step_0 39-49).
//     The timer is therefore NON-MONOTONIC; every `=== N` gate is kept as
//     equality, never converted to >=.
//   - The catch window tightens: scr_precise_hit(2) instead of (3) — a 2x2
//     box around the soul's centre (kaizo Other_15 line 1) — and Other_15's
//     one-shot manager push (timer -= 5 / local_turntimer += 5) is REMOVED
//     (kaizo Other_15; the vanilla lines 11-12 are gone).
//   - In its place, TWO manager-clock bends: per rendered frame while THIS
//     slash holds the strike, `timer--; local_turntimer++` on the manager —
//     a continuous freeze (kaizo Draw_0 37-41, modelled in endStep) — and at
//     the hurt frame a one-shot rewind by the full hurt_delay (kaizo Step_0
//     179-183).
//   - The hit penalty becomes scr_damage_maxhp(1, true, false): full max-HP
//     fraction, DEFEND ignored, CAN fell (kaizo Step_0 188) — routed through
//     the kaizo damage copy (flurry-damage.js).
//
// THE BLUE TELEGRAPH, now applied (kaizo Step_0 56): image_blend charges
// `merge_color(c_black, #86A2FF, clamp01(timer / 20))` instead of vanilla's
// c_red, and snaps to c_white on the cut frame (Step_0 89). It is real
// instance state — the manager's Draw merges its backing bar and both flow
// tiles from it (kaizo boxsplitter Draw_0 45/50-51) — so one assignment
// recolours the whole Flurry telegraph. Zero draws consumed.
//
// VISUAL-ONLY deltas, skipped but noted for the renderer (no RNG in any):
//   - Draw_0 21's `merge_color(c_black, #86A2FF, 0.5)` backing beam is a
//     Draw LOCAL at a fixed 0.5 (not the ramp above), and both this file's
//     telegraph and the manager's hell-surface are drawn by render/canvas.js
//     from a pre-baked dark-red pixel; repainting them is renderer work.
//   - Draw suppression: while any OTHER slash holds a playerstrike, this
//     instance's whole Draw exits — its telegraph vanishes (kaizo Draw_0
//     1-11). The STATE effect of that exit (it also gates the manager freeze)
//     IS modelled in endStep below; only the not-drawing part is left to the
//     renderer.
//   - the playerstrike heart-ghost redraw consumes 2x irandom(2) per rendered
//     frame in the ORIGINAL (vanilla and kaizo alike); the verified sim
//     module already strips splitslash Draw-event RNG (renderer jitter is
//     frame-pure), and this copy keeps that documented deviation.
//
// THE SLASHMARKER, modelled 2026-08-29 — it used to be listed above as a
// visual-only omission. The mod does NOT touch it: kaizo Step_0 7-10 and 58-69
// are byte-identical to v105's 7-10 and 40-51, so it is translated in the
// VANILLA module (sim/attacks/splitslash.js) and the object type and the
// `scr_dark_marker` helper are imported from there rather than copied.
//
//   MEASURED (kaizo_oracle_seq_deep.csv, grouped by kaizo_playing): obj_marker
//   per turn is 10 / 12 / 10 for atk_Splitter1 / 2 / 3, against 8 / 10 / 8
//   splitslashes and the organism's two flames. One marker per slash, logged
//   one frame after it, at the SLASH's own (x, y) — (320, 170) on this family's
//   board — at 2 x 2, carrying the slash's untilted image_angle (0 / 45 / 90 /
//   270 / 315). check-oracle-splitter told the three markers apart by position
//   and reported the slashmarker count as 0 for all three turns.
//
// `scr_dark_marker` consumes NO RNG (obj_marker has no code entries anywhere in
// the dump), so nothing downstream of it in the stream moves.
//
// ORIGINAL BUG preserved: `slice_delay = 5` is assigned in Create and read
// nowhere. The delay that governs the cut is the organism's `split_wait`.

import { spawn, destroy } from '../../sim/entity.js';
import { kaizoScrDamageMaxhp, kaizoSideb } from './flurry-damage.js';
import {
  clamp01, lerp, lengthdirX, lengthdirY, scrEaseOut, sign,
  mergeColor, BLACK, WHITE,
} from '../../sim/gml.js';
// The mod's palette, from the one shared source (kaizo/attacks/kaizo-colors.js)
// — never a private copy.
import { KAIZO_TELEGRAPH_COLOR } from './kaizo-colors.js';
import { scrBulletInit, scrBulletInherit } from '../../sim/bullets/regularbullet.js';
// obj_marker and scr_dark_marker are UNCHANGED by the mod — one shared source,
// never a private copy (the same rule this file already applies to the palette).
import { scrDarkMarker } from '../../sim/attacks/splitslash.js';
import { QUICKSLASH_MASK, collisionRectanglePrecise } from '../../sim/masks.js';
import { splitGrowtangle } from './flurry-split-growtangle.js';
import { gmlChoose, gmlRandom, gmlRandomRange, gmlRandomsign, gmlIrandom } from '../../sim/rng.js';
import { afterimage } from '../../sim/fx.js';
import { cue, cueStop } from '../../sim/audio.js';

function manager(state) {
  return state.entities.find(
    (e) => e.alive && e.type.name === 'obj_roaringknight_boxsplitter_attack',
  );
}

function organism(state) {
  return state.entities.find(
    (e) => e.alive && e.type.name === 'obj_knight_split_growtangle',
  );
}

function box(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
}

/**
 * `obj_growtangle.depth + N` — see the vanilla module's boxDepth(). The box's
 * own depth is in the OBJECT DEFINITION and no grep of the dump can find it
 * (CLAUDE.md, "The OBJECT DEFINITION holds more than the sprite"); 0 keeps the
 * relative order the code states.
 */
function boxDepth(state) {
  const gt = box(state);
  return gt && typeof gt.depth === 'number' ? gt.depth : 0;
}

export const splitslash = {
  name: 'obj_roaringknight_splitslash',

  // BEFORE THE BOX IT RE-FIRES. The slash writes `con`/`timer` onto the
  // EXISTING obj_knight_split_growtangle to start the next cut, so the box
  // must not have taken its own step yet that frame — and it had. The box
  // declares stepOrder -0.5 (before the SOUL, its own measured receipt) and
  // this object declared nothing, i.e. 0, so the box ran first.
  //
  // Both order rules agree that the slash comes first: it is the YOUNGER
  // instance (born mid-turn, the box lives the whole attack) and the step
  // phase walks newest-first, and the object indices happen to say the same
  // (splitslash 650, box 909, obj_heart 1462). -0.6 keeps the box ahead of
  // the soul, so the box's own receipt is untouched.
  //
  // MEASURED on _tok3 f5035, the atk_Splitter2 cut. The soul is parked at
  // 250 by this slash's own freeze, then pushed by
  // `obj_heart.x += (distance - old_distance) * heart_x * 1.25`
  // (obj_knight_split_growtangle Step_0:266-275) and rounded by that
  // object's End Step. The recording lands on 284 and the sim landed on 269,
  // after which BOTH decay identically — a constant 15px offset, so only the
  // push was wrong. Working back: 284 needs old_distance 27.592171142467
  // (27.5922 * 1.25 = 34.49, and round(250 + 34.49) = 284) and the sim held
  // 14.943104233045055 (round(250 + 18.68) = 269). 27.5922 is exactly what
  // the sim's own box held one frame earlier, before it took a con=3 closing
  // step that overwrote it — the step the game had not taken yet, because in
  // the game this slash had already switched the box to con 1, and con 1
  // writes no distance at all.
  stepOrder: -0.6,

  create(e, state) {
    scrBulletInit(e);
    e.active = false;
    e.timer = 0;
    e.image_alpha = 1;
    e.image_speed = 0;
    e.slash = false;
    e.destroyonhit = false;
    e.thickness = 10;
    // Create l.9: `image_blend = c_black`. Unchanged by the mod, but it is
    // the FLOOR of the telegraph ramp below (and the value the manager's
    // hell-surface merges from), so it has to exist before Step 1.
    e.image_blend = BLACK;
    e.xdir = 0;
    e.ydir = 0;
    e.xdraw = 250;
    e.ydraw = 250;
    e.init = false;

    // Draw-only, but it CONSUMES a draw.
    e.flip = state.flipTable ? state.flipTable[state.flipIndex++] : gmlChoose(state.gmlRng, [-1, 1]);

    e.damage = 206;
    e.element = 5;
    e.grazepoints = 10;
    e.vertical = false;
    e.memheartx = 0;
    e.memhearty = 0;
    e.playerstrike = false;
    e.cuty = 1;
    e.xoffset = 0;
    e.yoffset = 0;
    e.angleoffset = 0;
    // Create l.29 `startdepth = depth` (unchanged by the mod): the depth this
    // slash returns to at timer 29. `depth` here is the OBJECT DEFINITION's —
    // 0 for obj_roaringknight_splitslash (kaizo-mod/sprites/objects_kaizo.csv;
    // scr_bullet_init writes no depth) — and the engine gives a fresh
    // instance no depth at all, hence the `?? 0`. Carried for the RENDERER:
    // the kaizo Draw port (kaizo/render/draw/split.js) draws this object at
    // its own depth, and the pending telegraph's `obj_growtangle.depth + 10`
    // below is what puts it UNDER the manager's hell surface. Depth is in no
    // trace column, so this moves nothing the byte gate reads.
    e.startdepth = e.depth ?? 0;
    e.difficulty = 0;
    // Create l.24 `slashmarker = -4` (GML's `noone`); replaced on the first
    // Step. Unchanged by the mod.
    e.slashmarker = null;
    e.slice_delay = 5; // ORIGINAL BUG: never read anywhere
    e.hurt_delay = 15;
    e.diagonal = false;

    e.image_angle = 0;
    e.image_xscale = 1;
    e.image_yscale = 1;
    e.isBullet = true;
  },

  /**
   * obj_roaringknight_splitslash Draw_0:28-37 -- while `playerstrike == 1`
   * the slash redraws the soul with the slice over it, shaken by
   * `irandom(2) - 1` on each axis inside `with (obj_heart)`: FOUR stream
   * draws per frame (two irandom, two u32 each), none without a soul. The
   * renderer reads strikeJitter. `visible` gates the event.
   *
   * ONE `draw` KEY PER TYPE. On 2026-09-02 this literal carried TWO `draw`
   * methods — this stream-draw one and the Animation End arm (Other_7, now
   * `animationEnd` below) — and a JS object literal keeps only the LAST
   * duplicate key, silently (no error in an ES module). MEASURED by the split
   * family's adversarial pass: `splitslash.draw.length === 1` and its body
   * was the Other_7 arm, so Draw_0:32-33's two irandom were never drawn on
   * the stream, `strikeJitter` was never set, and the renderer
   * (kaizo/render/draw/split.js) fell back to its frame-seeded pair. Merged
   * here in the game's order: GameMaker fires Animation End in the built-in
   * update BEFORE the Draw event, so the alpha write runs first, then the
   * Draw's own draws. sim/entity.js runPhase looks up `e.type[phase]`, so a
   * second slot of the same name can never run — a type needs one function
   * per phase, and that function sequences the events that share it.
   */
  draw(e, state) {
    splitslash.animationEnd(e); // Other_7 first — see above
    if (e.visible === false) return;
    if (!(e.playerstrike === 1 || e.playerstrike === true)) return;
    const heart = state.soul;
    if (!heart || heart.alive === false) return;
    const rng = state.gmlRng;
    const xx = rng ? gmlIrandom(rng, 2) - 1 : 0;
    const yy = rng ? gmlIrandom(rng, 2) - 1 : 0;
    e.strikeJitter = { xx, yy };
  },

  step(e, state) {
    e.timer += 1;

    if (!e.init) {
      e.init = true;

      // kaizo Step_0 4-5 (v105 4-5, unchanged): `startdepth = depth; depth =
      // obj_growtangle.depth + 10;` — the telegraph draws ten steps BEHIND
      // the box for its 30 pending frames, and restores itself at timer 29
      // (below). Added 2026-09-01 for the kaizo Draw port; see the note on
      // `startdepth` in create.
      e.startdepth = e.depth ?? 0;
      e.depth = boxDepth(state) + 10;

      // kaizo Step_0 7-10, identical to v105's 7-10 and in the same place:
      // BEFORE the angleoffset draw, and at THE SLASH'S OWN (x, y) — not the
      // organism's. The recording separates a turn's three markers by position
      // (the organism's flames sit at its (x + 2, y - 1) and (x, y + 2)), so a
      // marker placed anywhere else is counted as the wrong object.
      // scr_dark_marker consumes no RNG, so its position here cannot move the
      // stream either way.
      e.slashmarker = scrDarkMarker(state, e.x, e.y, 'spr_rk_quickslash_upper');
      e.slashmarker.depth = boxDepth(state) + 50;
      e.slashmarker.image_speed = 0;
      e.slashmarker.image_alpha = 0;

      const rec = state.slashParams ? state.slashParams[state.slashIndex++] : null;
      // KAIZO (Step_0 11-18): scatter tightened to +-2; on Side-B with the
      // manager at difficulty 3 the vanilla +-12 is restored by a SECOND
      // draw — both draws hit the stream on that path.
      e.angleoffset = rec ? rec.angleoffset : gmlRandomRange(state.gmlRng, -2, 2);
      if (!rec && kaizoSideb(state)) {
        const mgd = manager(state);
        if (mgd && mgd.difficulty === 3) {
          e.angleoffset = gmlRandomRange(state.gmlRng, -12, 12);
        }
      }

      const mg = manager(state);
      const odd = mg ? mg.slash_count % 2 === 1 : false;

      if (e.diagonal) {
        e.direction = odd ? -45 : 45;
        e.vertical = odd;
        e.image_angle = e.direction;
        e.xoffset = rec ? rec.xoffset : gmlRandomRange(state.gmlRng, -2, 2) * 2;
        e.yoffset = rec ? rec.yoffset : gmlRandomRange(state.gmlRng, -2, 2) * 2;
      } else if (e.vertical) {
        e.direction = odd ? -90 : 90;
        e.image_angle = e.direction;
        // KAIZO (Step_0 31): +-4 * 2, halved from vanilla's +-8 * 2.
        e.xoffset = rec ? rec.xoffset : gmlRandomRange(state.gmlRng, -4, 4) * 2;
      } else {
        // Note the asymmetry in the original: the horizontal case sets NO
        // direction and NO image_angle, so both stay 0.
        // KAIZO (Step_0 35): +-4 * 2, halved from vanilla's +-8 * 2.
        e.yoffset = rec ? rec.yoffset : gmlRandomRange(state.gmlRng, -4, 4) * 2;
      }

      // kaizo Step_0 37, the LAST line of the init block: the marker takes the
      // heading the branch above just assigned, ONCE. The `image_angle +=
      // angleoffset` tilt at timer 30 is never propagated, so the marker keeps
      // the untilted heading — which is why the recording's slashmarker rows
      // are exactly 0 / 45 / 90 / 270 / 315 with no scatter on them.
      e.slashmarker.image_angle = e.image_angle;
    }

    // KAIZO (Step_0 39-49): the cross-instance freeze. Once per OTHER
    // splitslash currently holding a playerstrike, cancel this instance's
    // top-of-step timer++ — several strikers walk it backwards. Runs every
    // step, after the init block, exactly where the mod inserts it.
    for (const s of state.entities) {
      if (s.alive && s !== e
        && s.type.name === 'obj_roaringknight_splitslash' && s.playerstrike) {
        e.timer -= 1;
      }
    }

    // KAIZO (Step_0 56): THE TELEGRAPH TURNS BLUE. Vanilla charged
    // `merge_color(c_black, c_red, clamp01(timer / 20))`; the mod charges to
    // #86A2FF over the same 20 frames. This is the mod's signature warning
    // colour and it is instance state, not a draw local: the manager's own
    // Draw reads it back twice per pending slash (kaizo boxsplitter Draw_0
    // 45/50-51 — `merge_color(c_black, image_blend, 0.5)` for the backing bar
    // and `image_blend` for the two flow tiles), so the whole hell-surface
    // telegraph follows from this one assignment. No RNG.
    //
    // (The `image_alpha < 1 && !slash` ramp that precedes it in the GML is
    // dead in both builds — Create pins image_alpha to 1 — so it is not
    // carried, exactly as the sim module left it.)
    if (!e.slash) {
      e.image_blend = mergeColor(BLACK, KAIZO_TELEGRAPH_COLOR, clamp01(e.timer / 20));
    }

    // kaizo Step_0 58-69 (v105 40-51, unchanged): the marker is a PASSIVE COPY
    // of the slash — hidden while the telegraph charges, then locked onto its
    // position, animation frame, tint and alpha for the four frames of the cut.
    // `slashmarker.image_blend = image_blend` is what carries the mod's BLUE
    // telegraph onto it as well, so the one assignment above recolours this too.
    if (!e.slash) {
      e.slashmarker.image_alpha = 0;
    } else {
      e.slashmarker.x = e.x;
      e.slashmarker.y = e.y;
      e.slashmarker.image_index = e.image_index;
      e.slashmarker.image_blend = e.image_blend;
      e.slashmarker.image_alpha = e.image_alpha;
    }

    if (e.timer <= 15) {
      e.thickness = lerp(10, 1, scrEaseOut(e.timer / 15, 4));
    }

    // kaizo Step_0 74-77 (v105 56-59... the numbers moved with the inserted
    // freeze block above; the text is identical): `if (timer == 29) depth =
    // startdepth;` — one step before the cut the slash climbs back to its
    // own depth. EQUALITY, like every other gate in this file: the kaizo
    // timer is non-monotonic under the freeze. Added 2026-09-01 for the
    // kaizo Draw port.
    if (e.timer === 29) {
      e.depth = e.startdepth ?? 0;
    }

    if (e.timer === 30) {
      e.x = e.xstart;
      e.y = e.ystart;
      if (e.image_angle === 90) e.image_yscale *= -1;
      e.image_angle += e.angleoffset;
      e.x += e.xoffset;
      e.y += e.yoffset;
      // Step_0 89: the cut itself is WHITE — the blue is the warning, not the
      // blade. Unchanged by the mod, and the line that ends the ramp above.
      e.image_blend = WHITE;
      e.active = true;
      e.slash = true;

      let splitter = organism(state);
      if (!splitter) {
        const gt = box(state);
        splitter = spawn(state, splitGrowtangle, { x: gt ? gt.x : e.x, y: gt ? gt.y : e.y });
        // The slash's own `damage = 206` reaches the teeth ONLY through here:
        // splitslash -> split_growtangle -> split_bullet, one inherit per hop
        // — though in the kaizo build the organism's init then OVERRIDES the
        // inherited damage with its own table (flurry-split-growtangle.js).
        //
        // ORDER MATTERS: the original inherits FIRST and then overwrites
        // grazepoints, so the 5 wins over the slash's 10.
        scrBulletInherit(e, splitter);
        splitter.grazepoints = 5;
        const mg = manager(state);
        if (mg) {
          mg.splitterRef = splitter;
          splitter.difficulty = mg.difficulty;
        }
      }

      splitter.xoffset = e.xoffset;
      splitter.yoffset = e.yoffset;
      splitter.angle = e.angleoffset;
      splitter.vertical = e.vertical;
      splitter.diagonal = e.diagonal;
      splitter.con = 1;
      splitter.timer = 0;
      // THE BOX'S OWN STEP FOLLOWS THIS WRITE, because this object now sorts
      // ahead of it (stepOrder -0.6 against -0.5; see the note on the type).
      // There used to be a hand-run `splitGrowtangle.step(splitter, state)`
      // here, with a note ending "this is a no-op the day the lane runs the
      // measured order". It was not a no-op: it re-ran a step the box had
      // ALREADY taken that frame, and when the box was mid-close (con 3)
      // rather than idle (con -1) the first of those two steps had already
      // overwritten `distance` — which is the whole of the f5035 fault. The
      // order and the emulation come out together; keeping either alone is
      // wrong in one direction or the other.

      e.sprite_index = 'spr_rk_quickslash';
      e.image_speed = 1;
      e.image_index = 0;
      e.image_yscale *= 2;

      // The debris burst. Cosmetic, but modelled (see sim/fx.js) because it
      // moves on GameMaker's own friction and because the original consumes
      // these draws from the shared stream. Unchanged in the kaizo build.
      let angle = e.image_angle;
      if (e.image_xscale < 0) angle += 180;
      const dirx = lengthdirX(60, angle);
      const diry = lengthdirY(60, angle);
      for (let i = 0; i < 16; i++) {
        const d = spawn(state, afterimage, {
          x: e.xstart + e.xoffset,
          y: e.ystart + e.yoffset,
        });
        d.speed = gmlRandomRange(state.gmlRng, 10, 20);
        d.direction = e.image_angle + ((20 - d.speed) * gmlRandomsign(state.gmlRng)) / 2 + 180;
        d.speed += gmlRandomRange(state.gmlRng, -2, 2);
        if (i % 2 === 0) {
          d.direction -= 180;
          d.speed *= 0.75;
          d.x += dirx;
          d.y += diry;
        } else {
          d.x -= dirx;
          d.y -= diry;
        }
        d.image_angle = d.direction;
        d.sprite_index = 'spr_knight_slash_mark';
        d.image_alpha = 1;
        d.image_xscale = d.speed / 10;
        d.image_yscale = 0.1;
        d.friction = 0.5;
        d.fadeSpeed += gmlRandom(state.gmlRng, 0.02);
      }

      // Flip the knight to the other slash pose — unchanged.
      const mgr = manager(state);
      if (mgr) {
        mgr.image_index = mgr.image_index >= 4 ? 1 : 4;
        mgr.animtimer = 0;
      }

      // snd_stop pair + snd_play_x — unchanged (see the sim module's note on
      // gain vs pitch argument order).
      cueStop(state, 'snd_wideslash_low');
      cueStop(state, 'snd_knight_hurtb');
      cue(state, 'snd_wideslash_low', 0.9 + gmlRandom(state.gmlRng, 4) / 10, 0.8);
    }

    if (e.timer === 34) {
      e.active = false;
    }

    // Animation End. spr_rk_quickslash is 4 frames at image_speed 1, started
    // at timer 30, so it wraps on timer 34.
    if (e.slash && e.timer >= 34 && !e.playerstrike) {
      // CleanUp_0 is one line — `safe_delete(slashmarker)` — and this engine has
      // no CleanUp hook, so it is carried at each site that destroys the slash.
      // Unchanged by the mod.
      if (e.slashmarker) destroy(e.slashmarker);
      destroy(e);
      return;
    }

    if (e.timer === 35 + e.hurt_delay && e.playerstrike) {
      // KAIZO (Step_0 179-183): the one-shot rewind — the manager's pattern
      // clock is pushed back by the FULL hurt_delay and the turn extended by
      // the same, on top of the per-frame freeze in endStep. Vanilla's flat
      // -5/+5 lived in Other_15 and is gone.
      const mgh = manager(state);
      if (mgh) {
        mgh.timer -= e.hurt_delay;
        mgh.local_turntimer += e.hurt_delay;
      }
      e.playerstrike = 0;
      // Hand the soul back its own drawing — see onHit.
      if (state.soul) state.soul.image_alpha = 1;

      // THE DAMAGE. KAIZO (Step_0 186-189):
      //
      //     if (target != 3) scr_damage_maxhp(1, true, false);
      //
      // Vanilla took 66% of max HP, respected DEFEND, and could not fell you.
      // Kaizo takes 100%, IGNORES DEFEND (arg1 true), and CAN kill (arg2
      // false — no clamp; and the kaizo script sends every fell to -999,
      // Kris's mercy removed). The mantle still halves the fraction inside
      // the script. Routed through the kaizo scr_damage_maxhp copy.
      if (e.target !== 3) kaizoScrDamageMaxhp(state, 1, true, false, { target: 0 });

      // `global.inv = global.invc * 30` — unchanged (see the sim module's
      // note; the live gate is invTimer).
      state.invTimer = state.invc * 30;
      // CleanUp_0: `safe_delete(slashmarker)` — see the other destroy site.
      if (e.slashmarker) destroy(e.slashmarker);
      destroy(e);
    }
  },

  /**
   * The contact test: KAIZO `if (active == 1 && scr_precise_hit(2))`
   * (Other_15 line 1) — vanilla passed 3. scr_precise_hit halves the arg, so
   * this is `collision_rectangle(hx - 1, hy - 1, hx + 1, hy + 1, id, true,
   * false)` about the soul's CENTRE (x + 10, y + 10).
   *
   * THE PROBE IS RASTERISED, NOT OVERLAPPED — and that is the whole of the
   * _rev1 f12492 front. `collision_rectangle` does not ask whether two shapes
   * intersect. sim/masks.js:442 `collisionRectanglePrecise` is the runner's
   * own rule, CALIBRATED on two oracle sweeps (15,795 unrotated points, 0
   * mismatches; 14,884 rotated-children points, 12 residual): rint the float
   * intersection bounds half-to-even, walk the integer cells inclusive,
   * sample each cell CENTRE at +0.5 about an rint anchor, floor-inverse into
   * the mask. This site used `scrPreciseHitRotatedRect` instead — a
   * continuous OBB-vs-AABB separating-axis test, which is a DIFFERENT
   * QUESTION — only because a RotatedRect sprite stores no bitmap.
   *
   * IT WAS THE SPOT-CHECK THAT DOCBLOCK ASKED FOR AND NOBODY RAN: "the sweep
   * did not cover rotated targets; a rotated scr_precise_hit target should
   * get its own spot-check" (sim/masks.js:439-441).
   *
   * At _rev1 f12492 the continuous test lets a 0.237 px sliver of the probe's
   * CORNER count as contact. The runner never samples there: the nine cell
   * centres inverse-map to mask rows 25/25/24 — v = -2.4209, -3.4203,
   * -4.4197 against the ink band v in [-2, +4] — a clean 0.4209 px miss. One
   * frame later they map to rows 27/27/26 (v = +1.5767, +0.5773, -0.4221)
   * and the strike lands, which is where the recording puts it.
   *
   * A RotatedRect mask has no bitmap, so it walks QUICKSLASH_MASK — the same
   * bbox as a solid grid, already built at sim/masks.js:1045 for the graze
   * path. NOTHING ELSE MOVED: not the mask, not the origin, not the GML
   * literal (still n = 2 -> +-1), not the read timing. Across 76 cut-pose
   * windows and 26,002 frames of _tok3 and _rev1 this flips exactly ONE
   * active-window verdict, and it is f12492. Both _tok3 strikes survive —
   * f11471 is the tightest keep in either recording at 0.617 px.
   *
   * THE VANILLA SITE (sim/attacks/splitslash.js:474, n = 3) IS UNTOUCHED and
   * deliberately so: sim/ here is a vendored snapshot (law 6). The same
   * argument applies to it, and retiring scrPreciseHitRotatedRect belongs in
   * knight-sim behind its own suites and six vanilla recordings.
   */
  collides(e, heart, state) {
    // A scene that REPLAYS contacts from a recording must suppress the
    // computed one, or it gets both.
    if (state && state.replayContacts) return false;
    if (e.active !== true && e.active !== 1) return false;
    const hx = heart.x + 10;
    const hy = heart.y + 10;
    return collisionRectanglePrecise(hx - 1, hy - 1, hx + 1, hy + 1, e, QUICKSLASH_MASK);
  },

  other15(e, state) {
    this.onHit(e, state);
  },

  /** Other_15's body. */
  onHit(e, state) {
    const heart = state.soul;
    // NO SOUL, NO TARGET — see the sim module.
    if (!heart) return;
    e.playerstrike = 1;
    e.active = 0;
    e.memheartx = heart.x;
    e.memhearty = heart.y;
    // `global.inv = -1` — clears invulnerability so the deferred hurt above
    // is guaranteed to land.
    state.invTimer = -1;

    // THE SOUL IS HIDDEN AND REDRAWN BY THE SLASH — see the sim module.
    heart.image_alpha = 0;

    // WHICH FRAME OF THE SLICE — unchanged.
    const off = heart.y - (e.y - 8);
    e.cuty = Math.round(1 + (14 - 1) * clamp01((off - -16) / 32));

    const splitter = organism(state);
    if (splitter) {
      splitter.split_delay = 5;
      e.hurt_delay = splitter.split_wait;
    }
    // KAIZO (Other_15): vanilla's one-shot manager push
    //
    //     obj_roaringknight_boxsplitter_attack.timer -= 5;
    //     obj_roaringknight_boxsplitter_attack.local_turntimer += 5;
    //
    // is REMOVED here — replaced by the per-frame freeze (endStep) plus the
    // hurt-frame rewind (step).
  },

  /** End Step: the soul drag (vanilla Step_2), then the kaizo Draw-side
   *  manager freeze — Draw runs after every step phase, so the frame's end
   *  slot is where its state mutation lands, the same mapping the manager's
   *  own Draw counters use. */
  endStep(e, state) {
    if (e.playerstrike === 1) {
      const heart = state.soul;
      if (heart.x !== e.memheartx) heart.x = e.memheartx + sign(heart.x - e.memheartx);
      if (heart.y !== e.memhearty) heart.y = e.memhearty + sign(heart.y - e.memhearty);
      e.memheartx = heart.x;
      e.memhearty = heart.y;
    }

    // KAIZO (Draw_0 37-41): while THIS slash holds the strike, every rendered
    // frame freezes the manager — `timer--` cancels its +1 and
    // `local_turntimer++` cancels its -1, so a caught cut pauses the next
    // cut's schedule for the strike's whole length.
    //
    // GATED BY THE DRAW SUPPRESSION (kaizo Draw_0 1-11): `exit` aborts the
    // whole Draw when any OTHER splitslash holds a playerstrike — so if two
    // slashes ever strike at once, BOTH Draws are suppressed and NEITHER
    // applies the freeze. Modelled exactly; at real cadences (>= 31 frames
    // between cuts vs a <= ~10-frame strike window) two simultaneous strikers
    // cannot occur, but the gate is the code's shape.
    if (e.playerstrike === 1) {
      const otherStriking = state.entities.some(
        (s) => s.alive && s !== e
          && s.type.name === 'obj_roaringknight_splitslash' && s.playerstrike,
      );
      if (!otherStriking) {
        const mg = manager(state);
        if (mg) {
          mg.timer -= 1;
          mg.local_turntimer += 1;
        }
      }
    }
  },

  /**
   * THE DRAW SLOT (sim/index.js, "THE DRAW SLOT") — state the mod's Draw
   * READS that this module did not carry, added 2026-09-01 for the kaizo
   * Draw port (kaizo/render/draw/split.js), which renders this object at
   * its own alpha and depth instead of the vanilla tail.
   *
   * Animation End, kaizo Other_7 (byte-identical to v105):
   *
   *     if (slash && visible) {
   *         if (!playerstrike) instance_destroy();
   *         else image_alpha = 0;
   *     }
   *
   * The `instance_destroy()` arm has always been in step above, keyed the
   * way the verified vanilla module keys it — spr_rk_quickslash is 4 frames
   * at image_speed 1 from timer 30, so the animation ends on timer 34. The
   * `else` arm was not: a slash that CAUGHT the soul kept animating
   * spr_rk_quickslash in a loop for the whole strike hold (image_speed stays
   * 1 and the engine wraps the index), where the game hides it at alpha 0
   * after the four frames and shows only the jittered soul copy its Draw
   * paints (Draw_0:28-37). Same gate as the destroy arm, so the two arms of
   * the one event agree on the frame; idempotent, so re-running it every
   * later frame is harmless. `visible` is never false on this object.
   *
   * WHY HERE. GameMaker fires Animation End in the frame's built-in update,
   * after End Step and before Draw — the same slot as the freeze above and
   * the slot the seam reserves for Draw-read state. Not step: step's
   * `slashmarker.image_alpha = image_alpha` copy (Step_0:68) must see the 0
   * one frame later, exactly as the game's Step does.
   *
   * image_alpha is in no trace column (sim/trace.js; kaizo-trace.mjs), so
   * the byte gate does not move; the sim's own contact and damage paths
   * never read it. No RNG.
   *
   * RENAMED 2026-09-02 from `draw` to `animationEnd` and called from the one
   * `draw` slot above (see its comment): as a second `draw` key in this
   * literal it silently REPLACED the stream-draw slot rather than running
   * beside it. `animationEnd` is no engine phase (sim/index.js PHASES), so
   * runPhase never calls it directly; the draw slot does, first.
   */
  animationEnd(e) {
    if (e.slash && e.visible !== false && e.timer >= 34 && (e.playerstrike === 1 || e.playerstrike === true)) {
      e.image_alpha = 0;
    }
  },
};
