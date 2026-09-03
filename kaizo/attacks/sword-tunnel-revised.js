// KAIZO V-C/V-D — `obj_knight_tunnel_slasher_2_revised` +
// `obj_knight_diamondswordbullet_ext` AS THE MOD SHIPS THEM.
//
// A copy of the verified sim module (sim/attacks/sword-tunnel-revised.js) with
// EnderCat8's "Kaizo Roaring Knight" v2.3.3 deltas applied, exactly the way
// every other module in kaizo/attacks/ bases itself on its sim original. The
// diff that generated it:
//
//   diff knight-research/kaizo-mod/gml_vanilla_v105/CodeEntries/... \
//        knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/...
//        gml_Object_obj_knight_tunnel_slasher_2_revised_{Create_0,Draw_0,Step_0}.gml
//
// PUBLISH GATE (kaizo/HANDOFF.md §5-C): this recreates another author's work.
// Local research/playtesting only until EnderCat8's permission.
//
// ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
//
// The mod reaches this object through `dc.type = 102`, which the schedule
// dispatches from **ac 15** (`atk_Tunnel2`, phase 2, both routes). The launcher
// routed 102 at the VANILLA module, and because SUPPORTED[102] is [0] and the
// ac-15 arm asks for difficulty 0, `resolveDifficulty` reported no
// approximation — so the substitution never reached state.kaizo.approx and was
// invisible to verify-kaizo's ledger. It was not invisible to the recording:
// `kaizo/tools/checks/check-oracle-tunnel.mjs` measured six divergences on
// atk_Tunnel2 and none on atk_Tunnel1.
//
// ── THE MOD'S DELTAS, EACH MARKED `KAIZO` AT ITS SITE ─────────────────────
//
//   Create_0:6      damage 206 -> 190
//   Draw_0:14       the knight afterimage's hspeed 4 -> 3
//   Step_0:81-84    `with (obj_tracking_swords_manager) instance_destroy(...)`
//                   in the `state == "final"` arm — NEW, no vanilla counterpart
//   Step_0:137-138  the hold damps the blades at 0.7, not 0.9
//   Step_0:208-224  the firing period is a variable `_delay` (8 / B-Side 6,
//                   and 7 when the B-Side is running ac 15 — which is THIS
//                   attack, so the B-Side period really is 7)
//   Step_0:271      dorifto 0.15 + random(0.6) -> 0.1 + random(0.5)
//   Step_0:274-286  upper blade: y1 + 10, random(0.2), y4 folds y2 in at 0.4,
//                   and the new `_cap = 38`
//   Step_0:320-332  lower blade: y1 + 20, floor 40, the same y4 fold and cap
//   Step_0:367-372  the decoy period is a variable `_fdelay` (4 / B-Side 3)
//   Step_0:381,385  decoy band random_range(20, 70) -> random_range(30, 50),
//                   decoy damage 206 -> 90
//
//   Alarm_2 is NOT a delta. Its `knight = 367/672/633/1175` become
//   366/669/630/1173 in the mod because the mod ADDS objects and the asset
//   table shifts; they are the same four objects. The sim reaches them through
//   `chainNext`, which is by segment number, so nothing here changes.
//
// ── AND TWO DEFECTS INHERITED FROM THE SIM COPY, FIXED HERE ───────────────
//
// Both would fail a VANILLA oracle too; they are fixed only in this kaizo copy
// because sim/ belongs to the verified vanilla fight and a change there costs a
// whole-fight re-verification. See the comments at `firingGateOpen` and
// `setVspeed` — each names what the recording measured.
//
// ── VERIFICATION ──────────────────────────────────────────────────────────
//
// `node kaizo/tools/checks/check-oracle-tunnel.mjs` holds this against
// EnderCat8's own game on BOTH recorded routes (`_deep`, route C, and
// `_sideb`, route D). What is compared: the blade-wall cadence, the decoy
// count, the `_cap` band, the decoy band, and the tracking-sword count the
// `state == "final"` destroy cuts off. What is NOT: any RNG value, any
// absolute frame, any damage number. The vanilla suites for the same attack
// (`node tools/verify-tunnel-revised.mjs`, `node tools/verify-swordtunnel.mjs`)
// still run against the untouched sim module.

import { spawn, destroy } from '../../sim/entity.js';
import {
  scrApproach, clamp, pointDirection, lengthdirX, lengthdirY, angleDifference, sign,
} from '../../sim/gml.js';
import {
  gmlIrandom, gmlIrandomRange, gmlRandom, gmlRandomRange, gmlChoose,
} from '../../sim/rng.js';
import {
  scrBulletInit, regularbulletCreate, regularbulletStep,
} from '../../sim/bullets/regularbullet.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { scrAfterimage, scrAfterimageGrow } from '../../sim/fx.js';
import { spriteMaskHit, SPRITE_MASKS, HEART_MASK } from '../../sim/masks.js';
import { cue, cueLoop, cueStop } from '../../sim/audio.js';
import { chainNext } from '../../sim/attacks/combination.js';
import { scrDamageSingle, scrDamageAll } from '../../sim/damage.js';

// NOTE — this module deliberately does NOT call `registerComboAttack(3, ...)`,
// the way every other kaizo segment module refuses to (rotating-slash.js,
// swordfall.js, underbox.js each carry the note). `COMBO_ATTACKS` in
// sim/attacks/combination.js is a shared module-level registry, and writing to
// it from a kaizo import would hand the SIM's own SINGLE-mode combination a
// kaizo module — a vanilla behaviour change smuggled in through an import.
// check-combination's T9 asserts the absence by identity.
//
// The kaizo side keeps its own table, `KAIZO_COMBO_ATTACKS` in
// kaizo/attacks/combination.js, and its id 3 currently reads
// `{ type: tunnelSlasher2 (sim), source: 'sim', why: 'no kaizo copy yet' }`.
// That `why` is now stale — see the FOLLOW-UP note at the bottom of this file.
// The edit belongs in that file, not this one.

function boxOf(state) {
  return state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
}
/** scr_get_box, same indices as elsewhere: 0 right, 1 top, 2 left, 3 bottom. */
function getBox(state, which) {
  const gt = boxOf(state);
  if (!gt) return which === 1 ? state.view.y + 95 : state.view.y + 245;
  const hw = (gt.image_xscale ?? 2) * 37.5;
  const hh = (gt.image_yscale ?? 2) * 37.5;
  return [gt.x + hw, gt.y - hh, gt.x - hw, gt.y + hh, gt.x, gt.y][which];
}

/** `mean(a, b)`. */
const mean = (a, b) => (a + b) / 2;

/** `kaizo_sideb()` — the scene stamps the flag as state.kaizo.sideb. */
function kaizoSideb(state) {
  return !!(state.kaizo && state.kaizo.sideb);
}

// ── hspeed / vspeed ARE COMPONENTS, NOT FIELDS ────────────────────────────
//
// GameMaker stores `speed` and `direction`; `hspeed` and `vspeed` are DERIVED
// VIEWS of them. sim/entity.js says so in as many words (they are the two
// motion built-ins deliberately absent from F32_BUILTINS, "because they are
// derived from speed/direction rather than stored independently"), and
// sim/index.js's runMotion re-derives them from speed/direction on every frame
// of a `builtinMotion` entity.
//
// So a GML `vspeed = X` is a write to ONE COMPONENT: hspeed stays where it
// was, and speed/direction are recomposed around the new vertical component.
// `hspeed *= 0.7` is the same move in reverse — read the derived component,
// scale it, write it back.
//
// ORIGINAL SIM BUG, FIXED HERE (sim/attacks/sword-tunnel-revised.js:234):
// `b.vspeed = opts.drift` lands on a plain JS property that NOTHING ever
// reads — the write-only-variable shape CLAUDE.md catalogues in the original
// GML, here in our own translation. MEASURED: the recording shows 64 distinct
// headings across atk_Tunnel2's 72 blades (real vspeed -0.374..0.582, decoy
// -0.700..1.684) against the sim's ONE heading, a flat 180. `vspeed = dorifto`
// is what makes the whole wall sag and rise as it comes; a dead-flat wall is a
// different attack to dodge. The same dead write is at :386-387 in the final
// hold (`b.hspeed *= 0.9`), where it reads `undefined` and stores NaN.
//
// The decomposition goes through `lengthdir_x/y`, which is the runner's own
// model (cardinal snap + single-precision pi, sim/gml.js) — the same one
// runMotion uses, so a blade fired at direction 180 decomposes to exactly
// -speed and 0 rather than to -speed and -1.6e-6.
function hspeedOf(e) { return lengthdirX(e.speed, e.direction); }
function vspeedOf(e) { return lengthdirY(e.speed, e.direction); }
function setComponents(e, hs, vs) {
  // GML holds `direction` when the speed goes to zero; atan2(0, 0) would
  // silently rewrite it to 0 and point a stopped blade east.
  if (hs === 0 && vs === 0) { e.speed = 0; return; }
  e.speed = Math.sqrt(hs * hs + vs * vs);
  let dir = (Math.atan2(-vs, hs) * 180) / Math.PI;
  if (dir < 0) dir += 360;
  e.direction = dir;
}
/** GML `vspeed = v`. */
function setVspeed(e, v) { setComponents(e, hspeedOf(e), v); }
/** GML `hspeed *= k`. */
function scaleHspeed(e, k) { setComponents(e, hspeedOf(e) * k, vspeedOf(e)); }
/** GML `vspeed *= k`. */
function scaleVspeed(e, k) { setComponents(e, hspeedOf(e), vspeedOf(e) * k); }

/**
 * THESE TWO BLADES DO NOT COLLIDE AS PIXELS. THEY ARE ROTATED RECTANGLES.
 *
 * The mod's sprite table says so outright
 * (knight-research/kaizo-mod/sprites/sprites_kaizo.csv, the collision-kind
 * column):
 *
 *     spr_knight_diamondbullet_m       66x32  bbox [4,15,61,15]  RotatedRect  masks=0
 *     spr_knight_diamondswordbullet    33x32  bbox [4,15,28,15]  RotatedRect  masks=0
 *     spr_knight_diamondbullet_l       99x32  bbox [5,14,93,16]  Precise      masks=3
 *
 * `masks=0` and an empty mask hash: there is NO PIXEL DATA for the first two in
 * the game files at all. The extraction that built sim/data/masks.json
 * synthesised a PRECISE mask from the bbox instead, which for a bbox one pixel
 * tall is a single row of ink — 58 solid pixels in a 66x32 sheet for the _m,
 * one row at y = 15.
 *
 * AND A ONE-ROW PRECISE MASK HAS SUB-PIXEL HOLES. masksOverlap walks A's set
 * pixels and inverse-samples B; with only one solid row an inverse sample can
 * fall between it and nothing else catches it. Sweeping the blade's x in 0.25
 * steps against the soul at (311, 222), blade y 204.08, the hits run
 *
 *     310.5, 310.75, 311, [311.25 and 311.5 MISS], 311.75, 312, [312.25 MISSES], ...
 *
 * — about three of every four quarter-steps — and the recording's own blade
 * position, 311.5, falls in a hole. A RECTANGLE test is continuous and has
 * none. That is the whole bug: not the collision model, which is calibrated
 * ten ways over 704 combinations and stays exactly as it is for every precise
 * mask, but the KIND of the two masks it is being handed.
 *
 * MEASURED AGAINST THE RECORDING, not fitted to the frame that found it. Every
 * blade-vs-soul pair the engine judged in the whole run up to the gate front
 * was dumped and scored: 3 frames where the recording takes a hit and a model
 * MUST fire, and 129 where the soul is vulnerable and no hit lands, so a model
 * must NOT. Results:
 *
 *     precise (today)                   misses f6658            invents 0
 *     symmetric A-vs-B and B-vs-A       misses f6658            invents 0
 *     the bbox filled as a rectangle    misses f6658            invents 0
 *     the FULL sprite as a rectangle    misses nothing          INVENTS 6
 *     ROTATED RECT for these two        misses nothing          invents 0
 *
 * The bbox-filled row fails for the reason that makes the diagnosis certain:
 * filling a bbox that is itself one pixel tall changes nothing. The full-sprite
 * rectangle is what a careless "make it a rect" would do and it invents six
 * hits the recording does not have. Only the mod's own declared geometry fits.
 *
 * (A 1px dilation of the precise mask also fits, and is rejected: dilation is
 * not a thing GameMaker does. It fits because it is an approximation of the
 * rectangle, which is.)
 *
 * WHY THIS LIVES HERE AND NOT IN sim/masks.js. The engine invites exactly this:
 * "A type may override the test (rotated-rect probes, swept lines, the
 * splitslash's scr_precise_hit)" (sim/index.js, the collision dispatch). The
 * sprite kind is not in the engine's mask table, sim/ is vendored and not
 * hand-edited here, and only these two sprites in the whole fight are affected
 * — so the override belongs on the type that owns them. If the kind ever
 * reaches the extraction, this collapses into the engine and should.
 *
 * CONVENTIONS COPIED FROM masksOverlapPrecise so only the containment differs:
 * A's pixel CORNERS as the sample points, the same screen-space rotation
 * (u,v) -> (u cos + v sin, -u sin + v cos) with the same cardinal-exact trig,
 * and the same position rule — RAW for a rotated B, ROUNDED for an unrotated
 * one (its verify21j f9093 receipt).
 */
/** sim/masks.js's `collisionTrig`, COPIED because it is private there and
 *  sim/ is vendored and never hand-edited from this repo. Cardinal angles are
 *  exact rather than trig-approximate, which is what keeps a 90-degree blade
 *  from being decided by an epsilon — its own f9433 receipt. If this ever
 *  becomes an export, delete this and import it. */
function cardinalTrig(bangle) {
  const a = ((bangle % 360) + 360) % 360;
  if (a % 90 === 0) return [[1, 0], [0, 1], [-1, 0], [0, -1]][a / 90];
  const r = (bangle * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
}

const ROTRECT_SPRITES = new Set([
  'spr_knight_diamondbullet_m',
  'spr_knight_diamondswordbullet',
]);

function rotatedRectHitsHeart(e, heart) {
  const B = SPRITE_MASKS[e.sprite_index];
  if (!B) return null;
  const bsx = e.image_xscale ?? 1;
  const bsy = e.image_yscale ?? 1;
  // A ZERO SCALE HAS NO AREA, and the inverse divides by it — the same guard
  // masksOverlap opens with, and for the same reason: these blades lerp their
  // xscale up from 0 and spend their first frames here.
  if (!bsx || !bsy) return false;
  const A = heart.mask ?? HEART_MASK;
  const angle = e.image_angle ?? 0;
  const rotated = ((angle % 360) + 360) % 360 !== 0;
  const bx = rotated ? e.x : Math.round(e.x);
  const by = rotated ? e.y : Math.round(e.y);
  const [cos, sin] = cardinalTrig(angle);
  const [bl, bt, br, bb] = B.bbox;
  const [al, at, ar, ab] = A.bbox;
  for (let j = at; j <= ab; j++) {
    for (let i = al; i <= ar; i++) {
      if (!A.px[j][i]) continue;
      const wx = (heart.x + i) - bx;
      const wy = (heart.y + j) - by;
      // The inverse of (u,v) -> (u cos + v sin, -u sin + v cos).
      const u = wx * cos - wy * sin;
      const v = wx * sin + wy * cos;
      const lu = u / bsx + B.originX;
      const lv = v / bsy + B.originY;
      if (lu >= bl && lu < br + 1 && lv >= bt && lv < bb + 1) return true;
    }
  }
  return false;
}

export const diamondSwordBullet = {
  name: 'obj_knight_diamondswordbullet_ext',

  /**
   * Draw_0, the whole event:
   *
   *     draw_sprite_ext(sprite_index, image_index,
   *         x + irandom_range(-shakeme, shakeme),
   *         y + irandom_range(-shakeme, shakeme), ...);
   *
   * TWO irandom_range = FOUR u32 EVERY FRAME, for every live bullet, and
   * `shakeme` false does not spare them: irandom_range(-0, 0) still draws.
   * The sim consumed none of it, so a tunnel segment ran the stream four u32
   * per bullet per frame behind the game. MEASURED on the probe recording,
   * the combination's tunnel segment: the game draws 4 a frame with one
   * blade alive and 8 with two (oracle f3793-f3800) where the sim draws 0,
   * and the canonical bullets sheet parted at _tok3 f3805 on a fake blade
   * spawned at y 205.20 against the recording's 130.96 -- the same
   * random_range and choose, read four positions late.
   *
   * The jitter rides on the entity for the renderer, as the split family's
   * does. `shakeme` is a boolean here and the GML negates it: -true is -1.
   */
  draw(e, state) {
    const rng = state.gmlRng;
    if (!rng) return;
    const sh = e.shakeme === true ? 1 : (e.shakeme || 0);
    e.extJitter = {
      x: gmlIrandomRange(rng, -sh, sh),
      y: gmlIrandomRange(rng, -sh, sh),
    };
  },

  create(e, state) {
    regularbulletCreate(e, state); // event_inherited()
    e.sprite_index = 'spr_knight_diamondswordbullet'; // object definition
    e.element = 5;
    e.con = 0;
    e.timer = 0;
    e.topindex = gmlIrandom(state.gmlRng, 12);
    e.botindex = gmlIrandom(state.gmlRng, 12);
    e.shakeme = false;
    e.play_passing_sfx = true;
    e.image_speed = 0;
    e.fake = false;
    e.do_afterimage = false;
    e.r = 255;
    e.g = 255;
    e.b = 255;
  },

  /** Other_10 — THE VOLLEY, fired on every live blade at once. */
  init(e, state) {
    e.shakeme = false;
    e.play_passing_sfx = false;
    // THE SOUL'S PRE-STEP POSITION (state.soulPrev). The volley is fired from
    // the tunnel's own Step, and the runner steps NEWEST-FIRST: the slasher
    // and its blades are minutes younger than obj_heart, so every one of them
    // aims at the soul as it stood BEFORE it moved this frame. This engine
    // steps oldest-first, so the heart has already moved by the time the
    // volley runs, and `scr_at_player()` came out one frame ahead.
    //
    // MEASURED on _tok3 f3866, the frame all eight blades begin their turn.
    // Their f3865 poses are identical on both sides, so the only free term is
    // the aim: solving each blade's first lerp step for the easing fraction
    // gives ONE constant (0.159722, spread 3e-6 across the eight) when the
    // game is aimed at the f3864 soul and the sim at the f3865 soul, and a
    // spread three orders of magnitude worse under any other pairing. Same
    // compensation as the older tunnel's swept probe (sim/attacks/
    // sword-tunnel.js) and the rotating slash's aim.
    const heart = state.soulPrev ?? state.soul;
    const atPlayer = heart
      ? pointDirection(e.x, e.y, heart.x + 10, heart.y + 10)
      : 180;
    const aim = atPlayer + 180;
    e.speed = 0;
    // BACK OFF FIRST, away from the soul, then turn and come in.
    const nx = e.x + lengthdirX(40, aim);
    const ny = e.y + lengthdirY(40, aim);
    scrLerpvar(state, spawn, e, 'x', e.x, nx, 12);
    scrLerpvar(state, spawn, e, 'y', e.y, ny, 12);

    // THE LONG WAY ROUND. The turn is written so the blade sweeps through the
    // far side rather than taking the short arc: the target angle is pushed a
    // full turn past the aim, with the +-360 chosen by which side of 180 the
    // current angle is on. A plain lerp to `scr_at_player()` would snap it
    // round the short way and lose the wind-up entirely.
    const angleDiff = angleDifference(e.image_angle, atPlayer);
    const s = sign(angleDiff);
    let thing = e.image_angle;
    if (s === 1) {
      thing = e.image_angle > 180
        ? e.image_angle - angleDiff + 360
        : e.image_angle - angleDiff - 360;
    } else if (s === -1) {
      thing = e.image_angle > 180
        ? e.image_angle - angleDiff - 360
        : e.image_angle - angleDiff + 360;
    }
    scrLerpvar(state, spawn, e, 'image_angle', e.image_angle, thing, 12, 2);
    scrLerpvar(state, spawn, e, 'direction', e.direction, thing, 12, 2);
    // `scr_script_delayed(scr_lerpvar, 13, "speed", -4, 0, 8, 2, "out")` then
    // `..., 21, "speed", 0, 24, 12` — it rocks BACKWARDS first, stops, and
    // then drives in at 24.
    e.pending = [
      { at: 13, run: (st) => scrLerpvar(st, spawn, e, 'speed', -4, 0, 8, 2) },
      { at: 21, run: (st) => scrLerpvar(st, spawn, e, 'speed', 0, 24, 12) },
      { at: 21, run: () => { e.do_afterimage = 1; } },
    ];
    e.pendingT = 0;
  },

  step(e, state) {
    regularbulletStep(e, state); // event_inherited()

    if (e.pending) {
      e.pendingT += 1;
      for (const p of e.pending) {
        if (p.at === e.pendingT) p.run(state);
      }
    }

    // THE COLOUR IS THE TELL. A blade marked `shakeme` bleeds green and blue
    // out at 21.25 a frame — 255 to 0 in twelve — so the wall turns red just
    // before it fires. `fake` blades never do; they are born dark and stay.
    if (e.shakeme && !e.fake) {
      e.g = scrApproach(e.g, 0, 21.25);
      e.b = scrApproach(e.b, 0, 21.25);
    }

    if (e.do_afterimage === 1) {
      e.do_afterimage = 2;
      const a = scrAfterimageGrow(state, e);
      a.image_blend = [255, 0, 0];
    }
    if (e.do_afterimage === 2) {
      const a = scrAfterimage(state, e);
      a.fadeSpeed = 0.33; // scr_afterimageFAST
      a.image_blend = [255, 0, 0];
    }

    if (e.play_passing_sfx && state.soul
      && e.x < state.soul.x + 30 && e.y > state.soul.y) {
      e.play_passing_sfx = false;
      cue(state, 'snd_object_passing', 1, 1);
    }
  },

  collides(e, heart) {
    // `active = false` is what makes a fake harmless, and it is the ONLY
    // difference — a fake has the same mask, the same size and the same
    // motion. Reading the flag here rather than skipping the spawn is what
    // keeps them on screen to lie to you.
    if (e.active !== 1 && e.active !== true) return false;
    // The mod gives these two sprites NO pixel data and a RotatedRect kind —
    // see rotatedRectHitsHeart. _l is Precise and takes the ordinary path.
    if (ROTRECT_SPRITES.has(e.sprite_index)) return rotatedRectHitsHeart(e, heart);
    return spriteMaskHit(e, heart);
  },

  other15(e, state) {
    if (e.active !== 1 && e.active !== true) return;
    // A GRAZE-LIKE FLINCH. On contact a white (g == 255) unshaken blade that
    // catches you outside i-frames tilts 10 degrees away and HALVES its speed
    // — the wall reacts to hitting you.
    if (!e.shakeme && e.g === 255 && state.invTimer < 0) {
      if (e.image_angle === 90) {
        scrLerpvar(state, spawn, e, 'image_angle', e.image_angle, e.image_angle - 10, 6, 1);
      } else if (e.image_angle === 270) {
        scrLerpvar(state, spawn, e, 'image_angle', e.image_angle, e.image_angle + 10, 6, 1);
      }
      e.speed *= 0.5;
    }
    // NO event_inherited(). THE BLADE SURVIVES HITTING YOU.
    //
    // obj_knight_diamondswordbullet_ext's Other_15 is a TOTAL OVERRIDE -- all
    // 23 lines of it are quoted by this block and the one above, and it calls
    // no event_inherited() and no instance_destroy anywhere. GameMaker child
    // events REPLACE the parent's unless the inherit is explicit, so what the
    // override drops is the parent's kill:
    //
    //     if (destroyonhit == 1) { instance_destroy(); }
    //         -- gml_Object_obj_collidebullet_Other_15.gml:11-14
    //
    // scr_bullet_init leaves destroyonhit = 1 and nothing on this path clears
    // it; the mod does not need to, because the branch that reads it is
    // unreachable for this object. This line used to be
    // `collidebulletOther15(e, state)`, which is an event_inherited() the GML
    // does not have -- it ran that branch and killed the blade on contact. It
    // was also the only statement in this module carrying no GML citation, and
    // the comment three lines above it ("the wall reacts to hitting you")
    // describes exactly the behaviour it cancelled.
    //
    // MEASURED, _tok3 f6630 -> f6631: inv -45 -> +12, a real hit landing, with
    // the recording's live count holding at 18 -- the mod hit the player and
    // KEPT the blade. The sim dropped 18 -> 17. Byte gate, bullet sheet, f6631.
    //
    // WHY IT SURVIVED THIS LONG. The flinch and the damage both need contact,
    // and this module also runs inside atk_Frenzy1's third combination segment
    // (22 blades) with ZERO hits in that window: f6631 is the first frame in
    // the whole fight where a live white blade of this object touches the soul
    // outside i-frames. The module's own suite cannot see it either --
    // check-oracle-tunnel.mjs runs with damageEnabled false, and the parent
    // returns on that flag ABOVE the destroy, so the bug is structurally
    // unreachable there. A whole-fight gate is what found it.
    //
    // The tail below is Other_15:15-22, transcribed, in the shape the parent
    // gives it (the damageEnabled and invTimer gates are the sim's model of
    // scr_damage's own internals and are kept verbatim) -- minus the destroy:
    //
    //     if (target != 3) { scr_damage(); }
    //     if (target == 3) { scr_damage_all(); }
    if (!state.damageEnabled) return;
    if (state.invTimer < 0) {
      const opts = { flurrySoftened: state.flurrySoftened === true };
      if (e.target === 3) scrDamageAll(state, e.damage ?? 1, opts);
      else scrDamageSingle(state, e.damage ?? 1, e.target ?? 0, opts);
    }
  },
};

/** One blade of a pair. `opts.angle` picks which edge it grows from. */
function fireBlade(state, e, opts) {
  const b = spawn(state, diamondSwordBullet, { x: opts.x, y: opts.y });
  b.direction = 180;
  b.speed = opts.speed;
  // KAIZO Step_0:286 / :332 (real) and :385 (decoy) — the mod's blades are
  // 190 and its decoys 90, against vanilla's flat 206 for both. Never
  // compared against the recording (the recorder pins HP), read from the GML.
  b.damage = opts.damage;
  b.grazepoints = 4;
  b.element = 5;
  b.image_angle = opts.angle;
  b.image_yscale = 1;
  b.image_alpha = 0;
  b.image_index = 1;
  // THE SPRITE IS PICKED BY LENGTH, and `sprite_width` below is read AFTER the
  // swap — so the scale that gets lerped to is relative to whichever sheet was
  // chosen, not to the default one.
  let width = 33;
  if (opts.len > 48) { b.sprite_index = 'spr_knight_diamondbullet_m'; width = 66; }
  if (opts.len > 80) { b.sprite_index = 'spr_knight_diamondbullet_l'; width = 99; }
  const endscale = opts.len / width;
  b.image_xscale = opts.startScale;
  // CURVE -1 IS ease_out_back — the blade OVERSHOOTS its length and settles.
  scrLerpvar(state, spawn, b, 'image_xscale', 0, endscale, 14, -1);
  scrLerpvar(state, spawn, b, 'image_alpha', 0, 1, 10, 2);
  if (opts.fake) {
    b.active = false;
    b.fake = true;
    b.r = 34; b.g = 34; b.b = 34;
  }
  b.gravity_direction = 180;
  b.gravity = 0.4;
  // `vspeed = dorifto` — a COMPONENT write, see setVspeed's note. The sim copy
  // stores this on a property nothing reads and the whole wall travels dead
  // horizontal.
  setVspeed(b, opts.drift);
  return b;
}

export const tunnelSlasher2 = {
  /**
   * CleanUp_0 AS A TYPE HOOK. It was a hand-placed call on the one destroy
   * path this object takes itself, which leaves every OTHER path running
   * without it — and the path that ends most turns is the sweep,
   * `with (obj_bulletparent) instance_destroy()` (obj_battlecontroller
   * Step_0:1477-1481, reached here through clearTurn). GameMaker runs CleanUp
   * on every instance_destroy and sim/entity.js models that, so the hook is
   * the faithful place for it.
   *
   * Found by sweeping every translated type against its GML CleanUp_0 after
   * the identical fault in obj_roaringknight_quickslash_attack cost the gate
   * 200 frames (ledger, "A CleanUp that only runs on one destroy path").
   * This object writes the same `global.turntimer = -1` from the same guard.
   */
  cleanUp,

  name: 'obj_knight_tunnel_slasher_2_revised',

  create(e, state) {
    e.vertical_pos = 0;
    e.old_pos = 0;
    e.hole_size = 60;
    scrBulletInit(e);
    e.image_xscale = 2; // scr_darksize
    e.image_yscale = 2;
    e.sprite_index = 'spr_roaringknight_attack_ol'; // object definition
    // DEPTH, from the same object definition (knight-research/kaizo-mod/
    // sprites/objects_kaizo.csv:804, depth column 0; no Create/Step line of
    // the mod's or vanilla's assigns one — CLAUDE.md, "The OBJECT DEFINITION
    // holds more than the sprite"). The renderer's depth sort already read
    // an unassigned depth as 0 (`?? 0`), so this changes no draw order; it
    // makes the base a NUMBER so any future `depth +- N` off this instance
    // (the way obj_knight_tunnel_slasher's carousel does `other.depth - 1`)
    // cannot go NaN, and it is where kaizo/render/draw/stream.js's
    // drawObjKnightTunnelSlasher2Revised paints (the finale blade's
    // `depth = obj_growtangle.depth - 1`, Step_0:407, is the blade's own).
    // Added by the stream-family Draw verification pass; not traced by any
    // byte gate (depth is no CSV column).
    e.depth = 0;
    e.damage = 190; // KAIZO Create_0:6 — vanilla 206
    e.knightafterimagerange = 1;
    e.image_speed = 0;
    e.timer = 0;
    e.introtimer = 0;
    e.fake_timer = 0;
    e.siner = 0;
    e.con = 0;
    e.fakefire = 0;
    e.first_strike = 1; // `true`, and then stepped down by 0.25
    e.anchor_x = e.x;
    e.anchor_y = e.y;
    e.state = 'nothin much tbh';
    e.turn_type = 'full';
    e.turn_segment = -1;
    e.next_up = -1;
    e.next_next_up = -1;
    e.local_turntimer = 280;
    e.armpoint = 0;
    e.armpoint_index = 0;
    e.turntimer_limit = 90;
    e.pending = [];
  },

  /** Other_10 — the turn_type arms, including the combination's. Byte-identical
   *  between the two dumps; carried over unchanged. */
  init(e, state) {
    const point = () => {
      e.sprite_index = 'spr_roaringknight_point_ol';
      e.image_index = 0;
      e.image_speed = 0;
      scrLerpvar(state, spawn, e, 'image_index', 0, 4, 15, 2);
      scrLerpvar(state, spawn, e, 'x', e.x, e.x + 40, 15, 2);
      scrLerpvar(state, spawn, e, 'y', e.y, getBox(state, 5) - 100, 15, 2);
      scrLerpvar(state, spawn, e, 'knightafterimagerange', e.knightafterimagerange, 4, 30);
      e.con = 1;
      e.timer = 7;
      e.fake_timer = 7;
    };
    if (e.turn_type === 'full') e.local_turntimer = 240;
    if (e.turn_type === 'start') e.local_turntimer = 140;
    if (e.turn_type === 'end') { e.local_turntimer = 140; point(); }
    if (e.turn_type === 'short start') {
      e.local_turntimer = 120;
      if (e.next_up === 4) e.turntimer_limit = 60;
    }
    if (e.turn_type === 'short mid') {
      e.local_turntimer = 100;
      point();
      if (e.next_up === 4) e.turntimer_limit = 70;
    }
    if (e.turn_type === 'short end') { e.local_turntimer = 90; point(); }
  },

  alarm: {
    /** The handoff, identical to every other segment's. (The mod's own
     *  `knight = 366/669/630/1173` are the shifted asset ids of vanilla's
     *  367/672/633/1175 — the same four objects; chainNext goes by segment
     *  number, so there is nothing to change.)
     *
     *  THE SITE NAME IS THE OPT-IN — `chainNext`'s third argument routes to
     *  `state.kaizo.hooks.comboChainNext` when a scene has set one, so the
     *  successor is a kaizo module rather than whatever registered itself in
     *  the sim's shared registry. Ignored when no hook is present.
     *  'tunnel_alarm2' transcribes THIS event (Alarm_2, cases 1/2/4/5 and NO
     *  case 3 — the revised tunnel cannot chain into another one).
     *
     *  NEITHER DISPATCHED ORDER REACHES IT. The tunnel is segment 3 of ac 7
     *  and nothing at all in ac 106, and a third segment carries its Create
     *  default `next_up = -1`, so the guard at the top of chainNext returns
     *  before the site is consulted. Named anyway, because the alternative is
     *  a call that silently defaults to another object's handoff block if the
     *  chain ever grows a fourth segment. */
    2(e, state) {
      chainNext(state, e, 'tunnel_alarm2');
      destroy(e);
    },
  },

  step(e, state) {
    const knight = state.entities.find(
      (k) => k.alive && k.type.name === 'obj_knight_enemy',
    );
    if (knight) {
      knight.siner2 = 0;
      e.anchor_x = knight.x;
      e.anchor_y = knight.y;
    }
    e.local_turntimer -= 1;

    for (const p of e.pending) p.delay -= 1;
    const due = e.pending.filter((p) => p.delay <= 0);
    e.pending = e.pending.filter((p) => p.delay > 0);
    for (const p of due) p.run(state);

    // The mid-turn handoffs to swordfall (4) and the underbox (5) live in this
    // Step rather than in an alarm, so the next segment starts while this
    // one's blades are still in the air.
    //
    // 'tunnel_step' is the site that transcribes THESE TWO BLOCKS
    // (Step_0:5-36 and :38-64) — they are not the alarm's: the swordfall arm
    // shifts its successor by (-20, -66) and warps it IN, the underbox arm
    // does neither and seeds `init_start = 3; init = 6;` afterwards. Passing
    // the name is what lets the kaizo hook pick the right block; with no hook
    // the argument is ignored and this is the vanilla handoff.
    //
    // UNREACHED BY EITHER DISPATCHED ORDER, same as the alarm above: the
    // tunnel is only ever the LAST segment (ac 7's third), so `next_up` is
    // still its Create default here.
    if (e.local_turntimer < e.turntimer_limit && (e.next_up === 4 || e.next_up === 5)) {
      chainNext(state, e, 'tunnel_step');
      e.next_up = -999;
    }

    // THE FINALE, for a turn that ends here rather than handing on.
    if (e.local_turntimer < 60 && (e.turn_type === 'full' || e.next_up === -1)
      && e.state !== 'final') {
      e.timer = 0;
      e.fake_timer = -99999;
      e.local_turntimer = 99999;
      e.state = 'final';
      return;
    }

    if (e.state === 'final') {
      e.timer += 1;
      const blades = () => state.entities.filter(
        (x) => x.alive && x.type.name === 'obj_knight_diamondswordbullet_ext',
      );
      if (e.timer === 1) {
        e.sprite_index = 'spr_roaringknight_noarm';
        scrLerpvar(state, spawn, e, 'armpoint', 0, -75, 12, 2);

        // ══ KAIZO Step_0:81-84 — THE WALL KILLS THE TRACKING CHAIN ══════
        //
        //     with (obj_tracking_swords_manager)
        //         { instance_destroy(obj_tracking_swords_manager); }
        //
        // Vanilla has no such line, and this is the biggest single gameplay
        // divergence in the mod sweep. ac 15 launches type 102 AND a chained
        // type-151 tracking-swords manager; when the blade wall reaches its
        // finale it deletes that manager, so the tracking swords simply stop.
        //
        // MEASURED, both routes: atk_Tunnel2 records EIGHT tracking swords at
        // manager-steps 5, 35, 63, 89, 113, 135, 155, 173 — gaps
        // [30 28 26 24 22 20 18], which is variant 7's rate 32 / ratedecay 2
        // walking down — and then nothing, while the turn runs on to +390.
        // The ninth would have landed at +189; `state == "final"` starts at
        // step 181 and this line fires at step 182, seven frames ahead of it.
        // The vanilla copy kept the manager alive and produced FOURTEEN, its
        // cadence flattening out at 16, 16, 16 — over half of that attack's
        // pressure is content the mod deliberately cuts.
        //
        // `instance_destroy(obj)` with an OBJECT INDEX destroys every instance
        // of it, so the enclosing `with` adds nothing except making the
        // statement a no-op when none exist — which it already is. Both
        // readings give the same result; iterating a snapshot and destroying
        // each reproduces either.
        for (const m of [...state.entities]) {
          if (m.alive && m.type.name === 'obj_tracking_swords_manager') destroy(m);
        }

        // ANYTHING PAST THE LEFT WALL IS DISARMED — a blade that has already
        // crossed the arena cannot come back and kill you in the volley.
        for (const b of blades()) {
          if (b.x < getBox(state, 2)) b.active = false;
        }
        for (const b of blades()) {
          if (!b.active) {
            scrLerpvar(state, spawn, b, 'image_alpha', b.image_alpha, 0, 8);
            e.pending.push({ delay: 8, run: () => destroy(b) });
          } else {
            b.shakeme = true;
          }
        }
      }
      if (e.timer === 12) {
        if (blades().length) cue(state, 'snd_jump', 1, 1);
        cueStop(state, 'snd_shinka_ambience');
        for (const b of blades()) diamondSwordBullet.init(b, state);
      }
      if (e.timer === 33) {
        if (blades().length) cue(state, 'snd_knight_cut', 1, 1);
        e.armpoint_index = 1;
      }
      if (e.timer < 12) {
        // They are HELD while he points: gravity off and the drift damped
        // away, so the wall hangs there.
        for (const b of blades()) {
          if (!b.active) continue;
          b.gravity = 0;
          // KAIZO Step_0:137-138 — 0.7, not vanilla's 0.9: the mod bleeds the
          // hold off faster. Component writes, see setVspeed's note; the sim
          // copy's `b.hspeed *= 0.9` reads `undefined` and stores NaN.
          scaleHspeed(b, 0.7);
          scaleVspeed(b, 0.7);
        }
      }
      if (e.timer === 52) {
        scrLerpvar(state, spawn, e, 'image_index', e.image_index, 0, 8);
        e.pending.push({
          delay: 16,
          run: (st) => {
            scrLerpvar(st, spawn, e, 'x', e.x, e.anchor_x, 24, 2);
            scrLerpvar(st, spawn, e, 'y', e.y, e.anchor_y, 24, 2);
          },
        });
      }
      if (e.timer === 92) {
        if (knight) knight.image_alpha = 1;
        state.turntimer = -1;
        destroy(e);
      }
      return;
    }

    if (e.local_turntimer < 40) {
      e.timer = -99999;
      e.fake_timer = -99999;
      e.local_turntimer = 99999;
      if (e.turn_type === 'end' || e.turn_type === 'short end') {
        scrLerpvar(state, spawn, e, 'image_index', e.image_index, 0, 8);
        e.pending.push({
          delay: 16,
          run: (st) => {
            scrLerpvar(st, spawn, e, 'x', e.x, e.anchor_x, 24, 2);
            scrLerpvar(st, spawn, e, 'y', e.y, e.anchor_y, 24, 2);
          },
        });
        // destroy() carries the state so the type's cleanUp hook fires.
        e.pending.push({ delay: 40, run: (st) => destroy(e, st) });
      } else {
        e.alarm[2] = 1;
      }
      return;
    }

    // `if (con == 0) { con = -1; con = 0.1; }` — the `-1` is overwritten on
    // the next line and read by nothing. Carried as the single assignment the
    // sim copy already reduced it to.
    if (e.con === 0) e.con = 0.1;

    if (e.con === 0.1 || e.con === 0.2) {
      e.introtimer += 1;
      if (e.introtimer === 5) {
        e.con = 0.2;
        e.sprite_index = 'spr_roaringknight_point_ol';
        e.image_index = 0;
        e.image_speed = 0;
        scrLerpvar(state, spawn, e, 'image_index', 0, 4, 15, 2);
        scrLerpvar(state, spawn, e, 'x', e.x, e.x + 40, 15, 2);
        scrLerpvar(state, spawn, e, 'y', e.y, getBox(state, 5) - 100, 15, 2);
        // `if (obj_knight_enemy.myattackchoice == 3) snd_loop(...)` — read
        // LITERALLY. The mod reaches this object from ac 15, not ac 3, so the
        // drone never starts in the mod's own turn. Left as the GML has it
        // rather than "corrected" to the launching ac.
        if (state.currentAc === 3) cueLoop(state, 'snd_shinka_ambience', 1, 1);
      }
      if (e.introtimer === 20) {
        scrLerpvar(state, spawn, e, 'knightafterimagerange', e.knightafterimagerange, 4, 30);
      }
      if (e.introtimer === 25) {
        e.con = 1;
        e.introtimer = 0;
      }
    }

    // ══ KAIZO Step_0:208-219 — THE FIRING PERIOD IS A VARIABLE ═══════════
    //
    //     var _delay = 8;
    //     if (kaizo_sideb()) { _delay = 6;
    //         with (obj_knight_enemy) if (myattackchoice == 15) _delay = 7; }
    //
    // Vanilla has a bare `if (timer >= 8)`. The `myattackchoice == 15` arm is
    // not a corner case here: 15 is the ONLY ac that reaches this object in
    // the mod, so on the B-Side the period really is 7 and the 6 is
    // unreachable from the schedule. MEASURED — route C fires real volleys at
    // manager-steps 12, 20, 28 ... 180 (period 8) and route D at 11, 18, 25
    // ... 179 (period 7).
    let delay = 8;
    if (kaizoSideb(state)) {
      delay = 6;
      if (state.currentAc === 15) delay = 7;
    }

    if (firingGateOpen(e)) {
      e.timer += 1;
      e.fake_timer += 1;
      if (e.timer >= delay) {
        let newpos = e.old_pos + 15 + gmlIrandom(state.gmlRng, 90);
        if (newpos > 60) newpos -= 120;
        e.old_pos = e.vertical_pos;
        e.vertical_pos = clamp(newpos, e.old_pos - 50, e.old_pos + 50);
        // THE HOLE IS SIZED BY THE JUMP — a bigger move is a wider gap.
        const holeDiff = Math.abs(e.old_pos - e.vertical_pos);
        e.hole_size = holeDiff < 20 ? 36 : holeDiff < 30 ? 44 : holeDiff < 40 ? 52 : 60;

        if (e.first_strike > 0) {
          e.vertical_pos = gmlIrandomRange(state.gmlRng, -15, 15);
          e.old_pos = e.vertical_pos;
          e.hole_size = 100;
          if (e.first_strike === 0.75) e.hole_size = 90;
          if (e.first_strike === 0.5) e.hole_size = 75;
          if (e.first_strike === 0.25) e.hole_size = 60;
          e.first_strike = scrApproach(e.first_strike, 0, 0.25);
        }

        const mbox = mean(getBox(state, 1), getBox(state, 3));
        // KAIZO Step_0:271 — 0.1 + random(0.5), vanilla 0.15 + random(0.6).
        // Same two draws, a narrower and slightly lower band: dorifto lands in
        // [-0.4, 0.6] where vanilla's was [-0.45, 0.75].
        const dorifto = 0.1 + gmlRandom(state.gmlRng, 0.5) * gmlChoose(state.gmlRng, [1, -1]);
        const decoy = e.first_strike >= 0.75
          && (e.turn_type === 'end' || e.turn_type === 'mid' || e.turn_type === 'short end');

        // The UPPER blade, grown down toward the hole — skipped entirely when
        // the hole has drifted to the very top.
        if (e.vertical_pos > -20) {
          // KAIZO Step_0:274-277 — `+ 10` on y1, `random(0.2)` where vanilla
          // draws `random(0.5)`, and a y4 that folds the far edge y2 in at
          // 0.4 instead of being the plain `y1 - y3`.
          const y1 = ((mbox + e.vertical_pos) - (e.hole_size * 0.5)) + 10;
          const y2 = getBox(state, 1) - 40;
          const y3 = Math.max((y1 - y2) * (0.5 + gmlRandom(state.gmlRng, 0.2)), 50);
          const y4 = (y1 - y3 - y2) * 0.4;
          fireBlade(state, e, {
            x: getBox(state, 0) + 40, y: capToMouth(mean(y1, y4), mbox), speed: 0.5,
            angle: 270, len: y3, startScale: 15, drift: dorifto,
            fake: decoy, damage: 190,
          });
        }
        // And the LOWER one.
        if (e.vertical_pos < 20) {
          // KAIZO Step_0:320-323 — `+ 20` on y1, the `max` floor drops from 60
          // to 40, and the same y4 fold.
          const y1 = mbox + e.vertical_pos + (e.hole_size * 0.5) + 20;
          const y2 = getBox(state, 3) + 40;
          const y3 = Math.max((y2 - y1) * (0.5 + gmlRandom(state.gmlRng, 0.5)), 40);
          const y4 = (y1 + y3 + y2) * 0.4;
          fireBlade(state, e, {
            x: getBox(state, 0) + 40, y: capToMouth(mean(y1, y4), mbox), speed: 0.5,
            angle: 90, len: y3, startScale: 15, drift: dorifto,
            fake: decoy, damage: 190,
          });
        }
        e.timer = 0;
      }
    }

    // ══ KAIZO Step_0:367-372 — THE DECOY PERIOD IS A VARIABLE TOO ════════
    //
    //     var _fdelay = 4;  if (kaizo_sideb()) _fdelay = 3;
    //     if (fake_timer > (_fdelay * 2) && ((fake_timer + (_fdelay * 2)) % _fdelay) == 0)
    //
    // On route C that reduces to vanilla's `fake_timer > 8 && (fake_timer + 8)
    // % 4 == 0` exactly, so the delta only shows on the B-Side — where it does
    // show, hard: 56 decoys at manager-steps 13, 16, 19 ... 178 against route
    // C's 42 at 16, 20, 24 ... 180. Both counts are RNG-FREE and the check
    // asserts them.
    const fdelay = kaizoSideb(state) ? 3 : 4;
    if (e.fake_timer > (fdelay * 2) && (e.fake_timer + (fdelay * 2)) % fdelay === 0) {
      const vertical_pos2 = gmlIrandomRange(state.gmlRng, -70, 70);
      const mbox = mean(getBox(state, 1), getBox(state, 3));
      const dorifto = 0.25 + gmlRandom(state.gmlRng, 0.6) * gmlChoose(state.gmlRng, [1, -1]);
      const y1 = (mbox + vertical_pos2) - (e.hole_size * 0.5);
      const y2 = gmlChoose(state.gmlRng, [getBox(state, 1) - 40, getBox(state, 3) + 40]);
      const y3 = Math.max((y1 - y2) * (0.5 + gmlRandom(state.gmlRng, 0.5)), 50);
      const gt = boxOf(state);
      const b = fireBlade(state, e, {
        x: getBox(state, 0) + 40,
        // KAIZO Step_0:381 — `random_range(30, 50)`, vanilla
        // `random_range(20, 70)`. One draw either way; a tighter, closer band.
        // MEASURED: the decoys sit 30.74..51.27 from the board centre on route
        // C and 29.94..50.32 on route D (the spread past 30..50 is one step of
        // `vspeed = dorifto * 2`), against vanilla's 20.08..69.67.
        // THE SIGN LIST IS `choose(-1, 1)`, NOT `choose(1, -1)` -- Step_0:381
        // reads `obj_growtangle.y + (random_range(30, 50) * choose(-1, 1))`, and
        // gmlChoose indexes by PARITY (`values[u32 % len]`), so a reversed list
        // does not cancel out: it mirrors every decoy through the board's centre
        // line while drawing the same two u32. No count audit can see it.
        //
        // MEASURED on _tok3's atk_Frenzy1, anchor n=14, against the recording's
        // first three decoys (oracle f3805, f3809, f3813). Each one's birth y and
        // its constant vspeed (= dorifto * 2) pin both draws exactly: the game's
        // random(0.6) lands at stream index 381/410/455 and its random_range at
        // 385/414/459, six digits each. With `choose(-1, 1)` at random_range + 1
        // the three signs come out -1, -1, +1 -- the recording's. `choose(1, -1)`
        // at the same index gives +1, +1, -1, the exact inverse, on all three.
        y: (gt ? gt.y : mbox)
          + gmlRandomRange(state.gmlRng, 30, 50) * gmlChoose(state.gmlRng, [-1, 1]),
        speed: 0.35, angle: 90, len: y3 * 0.75, startScale: 0,
        drift: dorifto * 2, fake: true, damage: 90,
      });
      if (gt) b.depth = (gt.depth ?? 0) - 1;
    }

  },

  /**
   * Draw_0 — `siner++` AND THE AFTERIMAGE, and the event they live in is the
   * whole point, not a filing detail.
   *
   *     siner++;
   *     ...
   *     if ((siner % 4) == 0 && image_alpha != 0) { fade = scr_afterimage(); ... }
   *
   * These ran at the end of `step` here, and that is THREE FRAMES EARLY,
   * because a Draw event runs on the instance's CREATION frame while this
   * engine's step phase does not (a new entity is newest, and the oldest-first
   * walk is already past it). So the game reaches siner 4 on birth + 3 and
   * this reached it on birth + 4 -- and the two land on opposite sides of the
   * warp's alarm, which is what makes it a stream fault rather than a cosmetic
   * one. obj_knight_warp's Other_10 sets `master.image_alpha = 0` and arms
   * `alarm[0] = 4`; the alarm sets it back to 1. So the game's siner-4 pass
   * falls INSIDE the blackout and draws nothing, and its first afterimage is
   * siner 8; this module's fell one frame later, after the alarm had restored
   * the alpha, and fired.
   *
   * MEASURED on _tok3's atk_Frenzy1. The tunnel is born at oracle f3800 and
   * the recording's seq log puts its afterimages -- the speed-3 ones, moving
   * with the object -- at f3807, f3811, f3815, f3819. This fired at f3804.
   * One draw, and it lands BEFORE the first decoy at f3805 instead of after:
   * the game enters that decoy block at stream index 379 and the sim entered
   * at 380, which is the whole of the canonical bullets front there.
   */
  draw(e, state) {
    const knight = state.entities.find(
      (k) => k.alive && k.type.name === 'obj_knight_enemy',
    );
    e.siner += 1;
    // it consumes a `random_range` every fourth frame.
    if (e.siner % 4 === 0 && e.image_alpha !== 0) {
      const fade = scrAfterimage(state, e);
      fade.image_alpha = 0.6;
      fade.depth = (knight?.depth ?? 0) + 1;
      fade.fadeSpeed = 0.04;
      fade.speed = 3; // KAIZO Draw_0:14 — vanilla `fade.hspeed = 4`
      fade.direction = 0;
      fade.vspeed = gmlRandomRange(
        state.gmlRng, -e.knightafterimagerange, e.knightafterimagerange,
      );
    }
  },
};

/**
 * `_cap = 38` — KAIZO Step_0:279-283 and :325-329, applied to BOTH _yy
 * computations. Absent from vanilla entirely.
 *
 *     var _cap = 38;
 *     if (abs(_yy - mbox) < _cap) _yy = mbox + (_cap * sign(_yy - mbox));
 *
 * A blade that would have landed inside 38px of the board's centre line is
 * pushed back out to exactly 38 — the mod refusing to close the corridor's own
 * mouth. It is EXERCISED, not vacuous: the closest real blade in the route-C
 * recording sits 38.0643 from the centre and route D's at 37.6887 (38 with one
 * step of `vspeed = dorifto` on it), and both are the LOWER blade, whose
 * uncapped `_yy` runs 4..18px from the centre for a low hole. The sim's
 * uncapped copy put blades 4.61px out — inside the gap the attack is asking
 * you to fly through.
 *
 * `sign(0)` is 0 in GML, so an exactly-centred `_yy` is left exactly centred.
 * Preserved rather than "fixed" to a side.
 */
function capToMouth(yy, mbox) {
  const cap = 38;
  if (Math.abs(yy - mbox) < cap) return mbox + (cap * sign(yy - mbox));
  return yy;
}

/**
 * The firing gate, Step_0:220:
 *
 *     if ((con >= 0.2 && (turn_type == "full" || turn_type == "start"
 *                        || turn_type == "short start")) || con)
 *
 * ORIGINAL SIM BUG, FIXED HERE. sim/attacks/sword-tunnel-revised.js:456 writes
 * `if (e.con)` and comments above it that "the second arm makes the whole test
 * true for any non-zero con, so the turn_type list on the first is inert.
 * ORIGINAL BUG, preserved." That comment is wrong, and the recording is what
 * disproves it: GameMaker reads a real as TRUE only when it is ABOVE 0.5 — the
 * same rule CLAUDE.md records for `!alarm[0]` on an idle -1, and the rule this
 * codebase already applies at sim/attacks/swordfall.js:125,
 * sim/attacks/knightlines.js:164 and sim/attacks/roaringknight-slash.js:156.
 * So `|| con` is FALSE at con 0.1 and 0.2, and the FIRST arm is what opens the
 * gate: on the step `introtimer` reaches 5 and con becomes 0.2.
 *
 * MEASURED: the first volley lands at manager-step 12 on route C — introtimer
 * 5, then the eight-frame `timer >= _delay` wait — and at 11 on route D, where
 * the wait is 7. JS truthiness at con 0.1 opens the gate on step 1 instead and
 * starts the wall FOUR frames early: 44 volleys against 43, first at step 8.
 * The last volley already landed on the same step on both sides, so this moves
 * the START without disturbing the end.
 */
function firingGateOpen(e) {
  return (e.con >= 0.2 && (e.turn_type === 'full' || e.turn_type === 'start'
    || e.turn_type === 'short start')) || e.con > 0.5;
}

/** CleanUp — the closing segment gives the Knight and the clock back. */
function cleanUp(e, state) {
  cueStop(state, 'snd_shinka_ambience');
  if (e.turn_type === 'start' || e.turn_type === 'short start'
    || e.turn_type === 'short mid') return;
  const knight = state.entities.find(
    (k) => k.alive && k.type.name === 'obj_knight_enemy',
  );
  if (knight) knight.image_alpha = 1;
  state.turntimer = -1;
}

/** The `type = 102` branch: hide the Knight, pin the clock, hand over.
 *  Identical to the sim copy's — the controller block is not one of the mod's
 *  deltas; only the object it creates is. */
export function launchSwordTunnelRevised(state) {
  const knight = state.entities.find(
    (k) => k.alive && k.type.name === 'obj_knight_enemy',
  );
  state.turntimer = 999999;
  const e = spawn(state, tunnelSlasher2, {
    x: knight?.x ?? state.view.x + 425,
    y: knight?.y ?? state.view.y + 78,
  });
  tunnelSlasher2.init(e, state);
  if (knight) knight.image_alpha = 0;
  return e;
}

// ── FOLLOW-UP: TWO FILES THIS ONE DOES NOT OWN ────────────────────────────
//
// 1. kaizo/scenes/kaizo-mod-launcher.js — case 102 still imports
//    `launchSwordTunnelRevised` from sim/attacks/sword-tunnel-revised.js.
//    Change the import source to '../attacks/sword-tunnel-revised.js' and move
//    the `102: [0]` line of SUPPORTED out of the "PENDING TRANSLATION" block
//    into the TRANSLATED one. The symbol name is unchanged, so nothing else in
//    that file moves. Until then check-oracle-tunnel performs the swap itself
//    and proves it equivalent; after it, the swap is a no-op.
//
// 2. kaizo/attacks/combination.js — `KAIZO_COMBO_ATTACKS[3]` should become
//    `{ ..., type: tunnelSlasher2 (from HERE), source: 'kaizo' }` with the
//    `why: 'no kaizo copy yet ...'` line dropped, and its
//    `import { tunnelSlasher2 } from '../../sim/attacks/sword-tunnel-revised.js'`
//    repointed at './sword-tunnel-revised.js'. That makes the mod's 4-2-3
//    chain run the mod's own third segment. NOT done from here: that file is
//    another cluster's, and the segment reached through the chain arrives with
//    turn_type "short end" rather than "full", which is a path no recording
//    covers yet — see check-oracle-tunnel's "WHAT IS NOT CLAIMED".
