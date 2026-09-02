// KAIZO V-C — QUICKSLASH: the mod's controller types 1001 ("quickslash") and
// 97.1 ("quickslash true", the B-Side variant).
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — DO NOT PUBLISH without
// the author's permission (kaizo/HANDOFF.md §5-C publish gate).
//
// PROVENANCE — translated from the kaizo v2.3.3 dump
// (knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/):
//
//   gml_Object_obj_roaringknight_quickslash_attack_Create_0.gml   (controller)
//   gml_Object_obj_roaringknight_quickslash_attack_Step_0.gml
//   gml_Object_obj_roaringknight_quickslash_attack_Other_10.gml   (turn setup)
//   gml_Object_obj_roaringknight_quickslash_attack_Other_11.gml   (pose)
//   gml_Object_obj_roaringknight_quickslash_attack_Other_12.gml   (alias -> 11)
//   gml_Object_obj_roaringknight_quickslash_attack_Other_13.gml   (spawner)
//   gml_Object_obj_roaringknight_quickslash_attack_Alarm_2.gml    (chain — dormant)
//   gml_Object_obj_roaringknight_quickslash_attack_Draw_0.gml     (state-bearing part)
//   gml_Object_obj_roaringknight_quickslash_attack_CleanUp_0.gml
//   gml_Object_obj_roaringknight_quickslash_Create_0.gml          (the slash)
//   gml_Object_obj_roaringknight_quickslash_Step_0.gml
//   gml_Object_obj_roaringknight_quickslash_Draw_0.gml            (yscale-1 note)
//   gml_Object_obj_roaringknight_quickslash_Other_7.gml           (anim end)
//   gml_Object_obj_roaringknight_quickslash_big_Create_0.gml      (the finisher)
//   gml_Object_obj_roaringknight_quickslash_big_Step_0.gml
//   gml_Object_obj_roaringknight_quickslash_big_Step_2.gml / Other_7 / Other_15 / CleanUp_0
//   gml_Object_obj_dbulletcontroller_Step_0.gml                   (types 1001 / 97.1)
//
// Delta specs: knight-research/kaizo-mod/deltas/gml_Object_obj_roaringknight_
// quickslash_* — every kaizo divergence below cites the kaizo file+line.
//
// WHAT THE SIM ALREADY HAD (reused, not re-translated):
//   * obj_knight_split_growtangle — sim/attacks/split-growtangle.js, the
//     oracle-verified box-splitter organism quickslash_big hands the cut to.
//   * the collidebullet damage base — sim/bullets/regularbullet.js
//     (collidebulletOther15 is the slash's contact handler verbatim: the
//     kaizo slash keeps the default Other_15, target 3 -> scr_damage_all).
//   * scr_damage_maxhp — sim/damage.js (routed through for the big's
//     scr_damage_all_maxhp wrapper, implemented here).
//   * scr_lerpvar / afterimages / boxes / knight lookup patterns — copied
//     from the verified splitslash.js / rotating-slash.js / boxsplitter-attack.js.
//
// VISUAL-ONLY DELTAS (skipped as drawing, NOTED for the renderer):
//   * get_swordcolor() tints (telegraph merge_color targets) — the COLOR is
//     computed and stored on image_blend so the renderer can read it; the
//     setting lives at state.kaizo.swordtype (default 0 = pure blue).
//     No RNG is consumed by get_swordcolor. The palette itself is IMPORTED
//     from kaizo-colors.js (this file used to carry a private copy of the
//     get_swordcolor switch; the mod has one palette, so the tree has one).
//   * quickslash Draw_0 renders at yscale 1 while the MASK runs at
//     image_yscale 0.4 (kaizo quickslash_Step_0:38) — the renderer must draw
//     the sprite at yscale 1, NOT e.image_yscale. Collision here uses the
//     squashed scale, which is the mod's hitbox nerf.
//   * the hell_surface additive marker-gradient composite (attack Draw_0:30-48)
//     — pure drawing, skipped; the per-slash xdraw/ydraw/thickness/image_blend
//     fields it reads are all computed and stored.
//   * quickslash_big Draw_0's heart-jitter (irandom(2) twice per frame while
//     playerstrike) — CONSUMED NOW, in the type's draw() (2026-09-02). It
//     used to be stripped, citing the splitslash module, which no longer
//     splitslash module strips its identical block; renderer work later, as a
//     pure function of the sim frame.
//   * obj_roaringknight_quickslash_afterimage — NOTHING in either dump creates
//     it (content grep, both dumps; the kaizo delta only recolors it), so it is
//     not translated.
//
// THE MARKER MASK IS NOW THE REAL ONE (was a ledgered approximation).
// `mask_index = spr_rk_quickslash_marker_gradient` (quickslash Create_0:24,
// big Create_0:19) used to stand in the plain spr_rk_quickslash_marker mask,
// whose bbox is [0,22]..[249,22] — a SINGLE inked row. That is not a cosmetic
// difference: at this attack's image_yscale 0.4 (Step_0:38) a one-row mask is
// a 0.4px band, and CLAUDE.md's contact study measured that an axis-aligned
// mask thinner than one pixel NEVER registers — so every axis-aligned cut was
// unhittable. The extracted gradient sprite (kaizo/data/masks.js, packed by
// kaizo/tools/pack-kaizo-sprites.mjs) is 250x46, Precise, origin (125,23),
// bbox [0,20]..[249,25]: SIX inked rows, 2.4px at yscale 0.4 — over the
// threshold, so those cuts connect exactly as they do in the mod. The ledger
// row is gone with the approximation.
//
// APPROXIMATIONS (ledgered into state.kaizo.approx at the point of use):
//   * Side B's obj_knight_split_growtangle_vertical (the fountain-wall
//     organism) is untranslated; the endtype-1 finisher spawns the verified
//     split organism with vertical = true instead.
//   * the combination-chain handoff (Step_0:60-148 / Alarm_2) is unreachable
//     from types 1001/97.1 (turn_type is always "full") and is left dormant
//     behind a ledger.
//
// SUITE: kaizo/tools/checks/check-quickslash.mjs — 132 positive assertions on
// every branch below (the ramp machine, the 9-cut barrage, the converging aim,
// the RNG budget, the side-teleport, the 40-41 catch, the endtype fork, and the
// turn ending ITSELF on all five reachable paths). Sabotage-tested: removing
// any of those branches makes it exit 1.
//
// MOD-OWN DEAD CODE preserved and labelled (the mod's write-only variables,
// same policy as the repo's ORIGINAL BUG rule):
//   * `chaosangleset` (quickslash Create_0:22) — assigned, read nowhere in the
//     kaizo dump.
//   * `omae_wa_timer` (attack Create_0:41) — initialized 0, INCREMENTED
//     NOWHERE in the kaizo dump, so every `omae_wa_timer < 10` test is true.
//   * `trailthickness` — the vanilla dump's own write-only family
//     (knight-research/notes-write-only-vars.txt), still written by the mod.

import { spawn, destroy } from '../../sim/entity.js';
import {
  scrBulletInit, scrBulletInherit, collidebulletOther15,
} from '../../sim/bullets/regularbullet.js';
// THE SPLIT BOX COMES FROM THE KAIZO MODULE, not the vanilla one. Both
// translate obj_knight_split_growtangle -- the mod has exactly one such
// object -- but only kaizo/attacks/flurry-split-growtangle.js implements its
// Draw event, which draws FOUR irandom_range every frame the halves are
// apart (8 u32) plus a choose on each rebuild frame
// (gml_Object_obj_knight_split_growtangle_Draw_0.gml:10-13 and :63). The
// vanilla module has no draw() at all, so every frame of this finisher left
// the stream 8 u32 short -- the whole-fight audit measured exactly that on
// Multislash 1 (probe recording, oracle f2535: game 21 draws since the
// anchor, sim 13), and the canonical gate's f2591 front is that turn's box
// shake reading the stream from the wrong position.
//
// The vanilla module keeps its own diff and is not touched.
import { splitGrowtangle } from './flurry-split-growtangle.js';
// The combination chain seam. Imported from sim/, NOT from
// kaizo/attacks/combination.js — that module imports this one, so importing it
// back would close a cycle. The sim's chainNext is the indirection that exists
// to avoid exactly that, and its third argument is inert without the hook.
import { chainNext } from '../../sim/attacks/combination.js';
import { scrDamageMaxhp } from '../../sim/damage.js';
import {
  lerp, sign, scrApproach, scrMovetowards, lengthdirX, lengthdirY,
  pointDirection, pointDistance, angleDifference, mergeColor, gmlRound,
  gmlLte, GRAY, WHITE,
} from '../../sim/gml.js';
import { gmlRandom, gmlRandomRange, gmlIrandom } from '../../sim/rng.js';
import { enginePairHit } from '../../sim/masks.js';
import { kaizoMask } from '../data/masks.js';
import { getSwordcolor } from './kaizo-colors.js';
import { scrAfterimage } from '../../sim/fx.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { cue, cueStop } from '../../sim/audio.js';

// ── shared lookups (the splitslash.js / rotating-slash.js patterns) ─────────

function knightOf(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy');
}

function box(state) {
  return state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
}

function attackOf(state) {
  return state.entities.find(
    (e) => e.alive && e.type.name === 'obj_roaringknight_quickslash_attack',
  );
}

/** gt_maxy() / gt_miny() — obj_growtangle.y ± sprite_height/2 (the
 *  GlobalScript helpers, index for index; sprite dims as boxEdges derives
 *  them in rotating-slash.js). */
function gtMaxy(state) {
  const gt = box(state);
  if (!gt) return 0;
  return gt.y + ((gt.spriteHeight ?? 75 * gt.image_yscale) * 0.5);
}
function gtMiny(state) {
  const gt = box(state);
  if (!gt) return 0;
  return gt.y - ((gt.spriteHeight ?? 75 * gt.image_yscale) * 0.5);
}

/** kaizo_sideb() — reads obj_knight_enemy.k_sideb in the mod; the scene
 *  stamps the flag as state.kaizo.sideb (kaizo-fight.js, version D). */
function kaizoSideb(state) {
  return !!(state.kaizo && state.kaizo.sideb);
}

/**
 * `mask_index = spr_rk_quickslash_marker_gradient` — the cut's REAL hitbox
 * (quickslash Create_0:24, quickslash_big Create_0:19), read from the
 * extraction rather than stood in for. 250x46, Precise, origin (125,23),
 * bbox [0,20]..[249,25]: a six-pixel band, not the plain marker's single row.
 * See the header — at image_yscale 0.4 that is the difference between a
 * 2.4px hitbox and a 0.4px one the engine cannot sample.
 *
 * `kaizoMask()` returns THE SAME OBJECT to every importer (ES modules are
 * singletons), so deriving the `px` grid onto it keeps one shared value —
 * the same reason the 2px heart mask is shared across the other three kaizo
 * attack modules. Idempotent; regenerating kaizo/data/masks.js drops the memo.
 */
function maskWithPx(m) {
  if (!m.px) m.px = m.rows.map((r) => Array.from(r, (c) => c === '1'));
  return m;
}
export const QUICKSLASH_MARKER_GRADIENT_MASK = maskWithPx(
  kaizoMask('spr_rk_quickslash_marker_gradient'),
);

/** The approx ledger — the same shape kaizo-mod-launcher.js writes; the
 *  verify gate prints it. Guarded so a bare check-state can run. */
function ledger(state, entry) {
  if (!state.kaizo) state.kaizo = {};
  (state.kaizo.approx ??= []).push(entry);
  // One entry per (type, why) per run — these fire per-launch, not per-frame,
  // so no dedupe machinery is needed; callers only ledger on one-shot paths.
}

/**
 * scr_afterimagefast() — vanilla GlobalScript (the CALL in Other_11 is the
 * kaizo addition, the script itself is v105): a ghost of the caller with
 * fadeSpeed 0.08. scrAfterimage copies the same fields at fadeSpeed 0.04, so
 * copy then retune, exactly one field apart.
 */
function scrAfterimagefast(state, e) {
  const a = scrAfterimage(state, e);
  a.fadeSpeed = 0.08;
  return a;
}

/**
 * scr_orbitaroundpoint(cx, cy, ang) — vanilla GlobalScript, verbatim:
 *   theta  = point_direction(cx, cy, x, y) + ang
 *   radius = point_distance(cx, cy, x, y)
 *   x = cx + lengthdir_x(radius, theta); y = cy + lengthdir_y(radius, theta)
 */
function scrOrbitaroundpoint(s, cx, cy, ang) {
  const theta = pointDirection(cx, cy, s.x, s.y) + ang;
  const radius = pointDistance(cx, cy, s.x, s.y);
  s.x = cx + lengthdirX(radius, theta);
  s.y = cy + lengthdirY(radius, theta);
}

/**
 * scr_damage_all_maxhp(fraction, arg1, arg2) — kaizo
 * gml_GlobalScript_scr_damage_all.gml:30-55, routed through the SIM's
 * scr_damage_maxhp per living member:
 *
 *     if (global.inv < 0) {
 *         with (obj_knight_enemy) aoedamage = true;
 *         for (ti = 0..2) { global.inv = -1; target = ti;
 *             if (alive) scr_damage_maxhp(arg0, arg1, arg2); }
 *         with (obj_knight_enemy) aoedamage = false;
 *         global.inv = global.invc * 30;
 *     }
 *
 * `aoedamage == true` makes scr_damage_maxhp SKIP its whole targeting-and-
 * mantle-halving block (both dumps nest that block under
 * `!i_ex(obj_knight_roaring2)` THEN `aoedamage == false` —
 * scr_damage_maxhp.gml:55-57 vanilla, 60-62 kaizo). The sim's scrDamageMaxhp
 * models the outer gate as `state.roaringActive`, so pinning that flag for
 * the duration of the loop reproduces the aoe path exactly — no redirect, no
 * fraction halving, no RNG draw — without editing sim/ (HANDOFF §2.3:
 * composition, not patching). stepFrame recomputes roaringActive at the top
 * of every frame, so the restore is belt-and-braces.
 *
 * APPROX (open item): the mod's own scr_damage_maxhp rewrite (gloom, Noelle,
 * Kris -999 death, game-over suppression) is a separate delta batch; this
 * routes the VALUE flow (fraction/arg1/arg2 per target) through the verified
 * vanilla-shape sim path.
 */
function scrDamageAllMaxhp(state, fraction, arg1, arg2) {
  if (state.invTimer >= 0) return 0; // if (global.inv < 0)
  const prevRoaring = state.roaringActive;
  state.roaringActive = true; // stands in for aoedamage == true — see above
  let total = 0;
  for (let ti = 0; ti < 3; ti++) {
    state.invTimer = -1; // global.inv = -1, per iteration
    if (state.partyHp[ti] > 0) {
      total += scrDamageMaxhp(state, fraction, arg1, arg2, { target: ti, aoe: true });
    }
  }
  state.roaringActive = prevRoaring;
  state.invTimer = state.invc * 30; // global.inv = global.invc * 30
  return total;
}

/**
 * CleanUp_0 of the controller — runs at every internal instance_destroy():
 *
 *     if (turn_type != "start" && turn_type != "short start"
 *         && turn_type != "short mid" && scr_bulletparent_count() < 2) {
 *         knight.image_alpha = 1;
 *         global.turntimer = -1;
 *     }
 *
 * `scr_bulletparent_count() < 2` counts EXACT obj_bulletparent instances —
 * none ever exist in the knight fight, so the test is ALWAYS TRUE (the same
 * corrected predicate rotating-slash.js and underbox.js document; NOTES.md
 * confirms it for the mod).
 */
function cleanupController(e, state) {
  if (e.turn_type !== 'start' && e.turn_type !== 'short start' && e.turn_type !== 'short mid') {
    const k = knightOf(state);
    if (k) k.image_alpha = 1;
    state.turntimer = -1;
  }
}

// ── obj_roaringknight_quickslash — the slash ────────────────────────────────

export const quickslash = {
  name: 'obj_roaringknight_quickslash',

  /** Create_0, kaizo lines 1-24 (vanilla 1-20 plus the kaizo tail). */
  create(e, state) {
    scrBulletInit(e);
    e.active = false;
    e.timer = 0;
    e.image_alpha = 0.1;
    e.image_speed = 0;
    e.slash = false;
    e.destroyonhit = false;
    e.thickness = 10;
    e.image_blend = GRAY; // c_gray
    e.trailthickness = 10; // ORIGINAL BUG family: write-only in the whole dump
    e.xdir = 0;
    e.ydir = 0;
    e.xdraw = 250;
    e.ydraw = 250;
    e.init = false;
    e.flip = false;
    e.timer = 0; // assigned twice in the original; kept
    // KAIZO quickslash_Create_0:18 — damage 206 -> 84 (quickslash-specific,
    // not the mod's usual 103 half-tier).
    e.damage = 84;
    e.element = 5;
    // KAIZO quickslash_Create_0:20 — target 3: the default collidebullet
    // Other_15 routes target 3 through scr_damage_all (party-wide hit).
    e.target = 3;
    e.grazepoints = 5;
    // KAIZO quickslash_Create_0:22 — assigned here, read NOWHERE in the kaizo
    // dump (the mod's own write-only variable; preserved, never "fixed").
    e.chaosangleset = false;
    // KAIZO quickslash_Create_0:23 — extra = 1 marks Side B's added vertical
    // slashes; they skip the controller pose callback below.
    e.extra = 0;
    // KAIZO quickslash_Create_0:24 — mask_index = spr_rk_quickslash_marker_gradient,
    // the EXTRACTED six-row band (see the header; was the plain marker's
    // single row, which at yscale 0.4 could not register axis-aligned).
    e.mask = QUICKSLASH_MARKER_GRADIENT_MASK;
    // Definition sprite (not in the GML; visual only): the marker family.
    e.sprite_index = 'spr_rk_quickslash_marker';
    e.isBullet = true;

    void state;
  },

  /** Step_0, kaizo — the re-parameterized telegraph. */
  step(e, state) {
    e.timer += 1;
    if (!e.init) {
      e.image_alpha = 1;
      e.xdir = lengthdirX(250, e.image_angle);
      e.ydir = lengthdirY(250, e.image_angle);
      e.init = true;
      // KAIZO quickslash_Step_0:8-15 — telegraph length is DATA-DRIVEN:
      //     with (obj_roaringknight_quickslash_attack)
      //         other.max_timer = round(slash_delay);
      // round() is GML half-to-even (gmlRound). With the controller's default
      // slash_delay 30 this reproduces vanilla's constants exactly
      // (timerA 6, timerB 10, timerC 20); the barrage's slash_delay 40
      // stretches the whole telegraph proportionally.
      const mg = attackOf(state);
      if (mg) e.max_timer = gmlRound(mg.slash_delay);
      e.timerA = 0.2 * e.max_timer;
      e.timerB = (1 / 3) * e.max_timer;
      e.timerC = e.max_timer - e.timerB;
      e.thickness = 0; // restarts from 0 (kaizo; Create said 10)
    }

    if (!e.slash) {
      if (e.timer <= e.timerA) {
        e.xdraw = e.xdir * (1 - (e.timer / e.timerA));
        e.ydraw = e.ydir * (1 - (e.timer / e.timerA));
        if (e.flip) {
          e.xdraw *= -1;
          e.ydraw *= -1;
        }
      } else {
        // KAIZO quickslash_Step_0:30-33 — new else arm: pin the converge
        // offset to -flip (GML bool->real: 0 unflipped, -1 flipped).
        e.xdraw = 1 * -e.flip;
        e.ydraw = 1 * -e.flip;
      }
      // KAIZO quickslash_Step_0:34 — thickness GROWS 0 -> 1.5 by 0.5/frame
      // (vanilla shrank 3 -> 1 on an ease-out).
      e.thickness = scrApproach(e.thickness, 1.5, 0.5);
      e.trailthickness = e.thickness + 2;
      if (e.timer > e.timerB) {
        // KAIZO quickslash_Step_0:38 — THE HITBOX NERF: image_yscale 0.4,
        // applied every frame from here on and NEVER reset, so the mask stays
        // squashed through the active slash frames while Draw_0 renders at
        // yscale 1 (quickslash_Draw_0.gml:3 — renderer note in the header).
        e.image_yscale = 0.4;
        // KAIZO quickslash_Step_0:39 — c_red -> get_swordcolor() (visual).
        e.image_blend = mergeColor(GRAY, getSwordcolor(state), (e.timer - e.timerB) / e.timerC);
      }
    }

    // `timer == max_timer` — timer integer-incremented, max_timer round()ed
    // integral, so === is exact (fractional slash_delay lands on an integer).
    if (e.timer === e.max_timer) {
      e.image_blend = WHITE;
      e.active = true;
      e.slash = true;
      e.sprite_index = 'spr_rk_quickslash';
      e.image_speed = 1;
      e.image_index = 0;
      cueStop(state, 'snd_wideslash_low');
      cueStop(state, 'snd_knight_hurtb');
      // TWO stream draws, in the original's order — snd_play_x(name, GAIN,
      // PITCH), cue() takes (state, name, pitch, gain).
      cue(state, 'snd_wideslash_low', 0.9 + gmlRandom(state.gmlRng, 4) / 10, 0.8);
      cue(state, 'snd_knight_hurtb', 0.9 + gmlRandom(state.gmlRng, 4) / 10, 0.7);
      // KAIZO quickslash_Step_0:54-63 — only non-extra slashes queue the
      // pose; the window shrank 40 -> 10 and the flip event_user(2) route is
      // gone (Other_12 is an alias of Other_11 now). `omae_wa_timer` is never
      // incremented anywhere in the kaizo dump, so the `< 10` test is always
      // true — preserved verbatim, not folded.
      if (!e.extra) {
        const mg = attackOf(state);
        if (mg && mg.omae_wa_timer < 10) {
          quickslashAttack.other11(mg, state);
        }
      }
    }

    // KAIZO quickslash_Step_0:65-68 — `timer >= max_timer + 2` (vanilla:
    // `timer == 32`). Active hit window: exactly the 2 frames
    // max_timer .. max_timer+1.
    if (e.timer >= e.max_timer + 2) {
      e.active = false;
    }

    // Other_7 (Animation End): `if (slash) instance_destroy();`.
    // spr_rk_quickslash is 4 frames at image_speed 1, started at
    // timer == max_timer, so it wraps 4 frames later — the same timer-anchored
    // translation the verified splitslash.js uses for its own copy (timer 34
    // there = cut frame + 4).
    if (e.slash && e.timer >= e.max_timer + 4) {
      destroy(e);
    }
  },

  /**
   * The engine pair test (obj_heart's collision event) against the explicit
   * mask_index, at the LIVE image scales — image_yscale 0.4 after the
   * telegraph midpoint is the hitbox nerf. Other_15 (the default
   * collidebullet handler below) gates the actual damage on `active`.
   */
  collides(e, heart, state) {
    if (state && state.replayContacts) return false;
    return enginePairHit(heart, e, e.mask);
  },

  // The kaizo slash keeps the DEFAULT Other_15 (no override exists in either
  // dump): target 3 -> scr_damage_all(84), destroyonhit false so the slash
  // plays out its animation after connecting.
  other15: collidebulletOther15,
};

// ── obj_roaringknight_quickslash_big — the finisher ─────────────────────────

export const quickslashBig = {
  name: 'obj_roaringknight_quickslash_big',

  /**
   * Draw_0:5-11 — the heart jitter, and it is STREAM WORK, not decoration:
   *
   *     if (playerstrike == 1) { with (obj_heart) {
   *         var _xx = irandom(2) - 1; var _yy = irandom(2) - 1; ... } }
   *
   * Two irandom = FOUR u32 every frame the strike is up. The module used to
   * strip them, citing the splitslash module as precedent -- but that module
   * stopped stripping its identical block (flurry-splitslash.js draw()), so
   * the citation had gone stale and this was the last unconsumed Draw in the
   * ac-5 chain. The values ride on the entity for the renderer, exactly as
   * the splitslash's do.
   *
   * `with (obj_heart)` visits every heart instance; the fight has one.
   */
  draw(e, state) {
    if (!(e.playerstrike === 1 || e.playerstrike === true)) return;
    const heart = state.soul;
    if (!heart || heart.alive === false) return;
    const rng = state.gmlRng;
    const xx = rng ? gmlIrandom(rng, 2) - 1 : 0;
    const yy = rng ? gmlIrandom(rng, 2) - 1 : 0;
    e.strikeJitter = { xx, yy };
  },

  /**
   * Create_0 — `event_inherited()` then overrides. The parent is
   * obj_roaringknight_quickslash (inferred from behaviour, not metadata: the
   * Step's `image_alpha += 0.05` fade-in only makes sense from the parent's
   * 0.1, and the kaizo Step dropping vanilla's `target != 3` damage guard
   * matches the parent's new `target = 3`).
   */
  create(e, state) {
    quickslash.create(e, state); // event_inherited()
    e.element = 5;
    e.image_index = 1;
    e.thickness = 1;
    e.trailthickness = 1;
    e.destroyonhit = 0;
    e.playerstrike = 0;
    e.memheartx = 0;
    e.memhearty = 0;
    e.xdraw = 0;
    e.ydraw = 0;
    e.cuty = 8;
    e.grazepoints = 5;
    // KAIZO big_Create_0:14-18 — endtype propagates FROM the controller
    // (set to 1 by dc type 97.1 under kaizo_sideb()); it selects the vertical
    // splitter + the +20-frame delayed strike below, and the longer
    // global.turntimer in the controller's Other_11.
    e.endtype = 0;
    const mg = attackOf(state);
    if (mg) e.endtype = mg.endtype;
    // KAIZO big_Create_0:19 — mask_index = spr_rk_quickslash_marker_gradient
    // (vanilla relied on the default sprite mask). The same extracted band as
    // the slash; the finisher doubles image_yscale at the cut, so its bar is
    // thicker still.
    e.mask = QUICKSLASH_MARKER_GRADIENT_MASK;
    // Vanilla tail, kept verbatim: kaizo never sets verticalcut = true (the
    // Side-B vertical finish rides endtype instead), so this is dormant.
    if (mg && mg.verticalcut === true) {
      const gt = box(state);
      if (gt) e.x = gt.xstart;
    }
  },

  /** Step_0, kaizo. */
  step(e, state) {
    e.timer += 1;
    if (e.image_alpha < 1 && !e.slash) {
      e.image_alpha += 0.05;
    }
    if (!e.slash && e.timer > 20) {
      // KAIZO big_Step_0:8 — c_red -> get_swordcolor() (visual).
      e.image_blend = mergeColor(WHITE, getSwordcolor(state), (e.timer - 20) / 19);
    }
    if (!e.slash) {
      // The marker's crawl: -20/step with a +66 wrap. `image_angle == 90`
      // never happens in the kaizo chain (nothing rotates the big), but the
      // branch is the original's and stays.
      if (e.image_angle === 90) {
        e.y -= 20;
        if (e.y < e.ystart - 66) {
          e.y += 66;
        }
        e.x = e.xstart;
      } else {
        e.x -= 20;
        if (e.x < e.xstart - 66) {
          e.x += 66;
        }
      }
    }
    if (e.timer === 38) {
      const mg = attackOf(state);
      if (mg) mg.final_slash_anim = true;
    }
    if (e.timer === 40) {
      e.x = e.xstart;
      e.image_blend = WHITE;
      e.active = true;
      e.slash = true;
      // KAIZO big_Step_0:43-54 — splitter choice by endtype, and
      // `_splitter.target = 0` is NEW in both branches (the organism's
      // damage is forced onto slot 0's redirect path instead of the
      // inherited target 3).
      if (e.endtype === 0) {
        const gt = box(state);
        const sp = spawn(state, splitGrowtangle, { x: gt ? gt.x : e.x, y: gt ? gt.y : e.y });
        scrBulletInherit(e, sp);
        sp.target = 0;
        armKaizoSplitter(sp);
      } else {
        // KAIZO big_Step_0:49-54 — Side B splits the box VERTICALLY via
        // obj_knight_split_growtangle_vertical (the fountain-wall organism).
        // APPROX: that object is untranslated; the verified split organism
        // runs its vertical cut instead. Ledgered.
        ledger(state, {
          type: 97.1,
          asked: 'obj_knight_split_growtangle_vertical (Side B vertical finish)',
          used: 'obj_knight_split_growtangle with vertical = true',
          why: 'vertical fountain-wall organism not translated yet',
        });
        const gt = box(state);
        const sp = spawn(state, splitGrowtangle, { x: gt ? gt.x : e.x, y: gt ? gt.y : e.y });
        scrBulletInherit(e, sp);
        sp.target = 0;
        sp.vertical = true;
        armKaizoSplitter(sp);
      }
      e.sprite_index = 'spr_rk_quickslash';
      e.image_speed = 1;
      e.image_index = 0;
      e.image_yscale *= 2;
      cueStop(state, 'snd_wideslash_low');
      cueStop(state, 'snd_knight_hurtb');
      // ONE stream draw (vanilla big plays only the wideslash here).
      cue(state, 'snd_wideslash_low', 0.9 + gmlRandom(state.gmlRng, 4) / 10, 0.8);
      // KAIZO big_Step_0:48-53 — un-hide the knight (nodraw was set by the
      // barrage end / chain) before striking the final pose. Vanilla had only
      // the event_user(1).
      const mg = attackOf(state);
      if (mg) {
        mg.nodraw = false;
        quickslashAttack.other11(mg, state);
      }
    }

    // KAIZO big_Step_0:68-72 — the Side-B strike delay.
    let _delay = 0;
    if (e.endtype === 1) {
      _delay = 20;
    }
    // KAIZO big_Step_0:73-76 — active window is 2 frames (40-41); vanilla's
    // `timer == 34` check was a no-op that left it active from 40 on.
    // ORDER preserved: this block sits BEFORE the strike below, as in the GML
    // (both fire on timer 42 when endtype == 0).
    if (e.timer === 42) {
      e.active = false;
    }
    // KAIZO big_Step_0:77-96 — strike retimed to 42 (+20 Side B; vanilla 60),
    // the caught heart is thrown 75px off the cut line over a 6-frame lerp,
    // and the damage is scr_damage_all_maxhp(0.5, true, false) — half of max
    // HP to the WHOLE party (vanilla: single-target scr_damage_maxhp(1.25)
    // behind a `target != 3` guard, both gone).
    if (e.timer === 42 + _delay && e.playerstrike === 1) {
      e.playerstrike = 0;
      const heart = state.soul;
      if (heart) heart.image_alpha = 1;
      let _targetY = e.y;
      if (heart && heart.y > e.y) {
        _targetY += 75;
      } else {
        _targetY -= 75;
      }
      if (heart) {
        // scr_lerpvar("y", y, _targetY, 6) on obj_heart — the tween instance
        // fights the soul's own movement for 6 frames, exactly as the
        // original's lerp controller does.
        scrLerpvar(state, spawn, heart, 'y', heart.y, _targetY, 6);
      }
      scrDamageAllMaxhp(state, 0.5, true, false);
      // CleanUp_0: obj_heart.image_alpha = 1 (already restored above).
      destroy(e);
      return;
    }
    // Vanilla tail: pin x while rotated — dormant here (image_angle never 90).
    if (e.image_angle === 90) {
      const gt = box(state);
      if (gt) e.x = gt.xstart;
    }

    // Other_7 (Animation End): `if (slash && visible) { if (!playerstrike)
    // instance_destroy(); else image_alpha = 0; }` — fires from the 4-frame
    // spr_rk_quickslash wrap, first at timer 44 (cut at 40), same
    // timer-anchored model as the slash above. CleanUp_0 restores the heart's
    // alpha on the destroy path.
    if (e.slash && e.timer >= 44) {
      if (!e.playerstrike) {
        if (state.soul) state.soul.image_alpha = 1; // CleanUp_0
        destroy(e);
      } else {
        e.image_alpha = 0;
      }
    }
  },

  collides(e, heart, state) {
    if (state && state.replayContacts) return false;
    return enginePairHit(heart, e, e.mask);
  },

  /** Other_15 — the catch (unchanged from vanilla; damage resolves later in
   *  Step, `42 + delay`). */
  other15(e, state) {
    if (!(e.active === 1 || e.active === true)) return;
    const heart = state.soul;
    if (!heart) return;
    e.playerstrike = 1;
    e.active = 0;
    e.memheartx = heart.x;
    e.memhearty = heart.y;
    // The soul is hidden and redrawn by the big's Draw (with the heartslice
    // overlay — renderer note in the header).
    heart.image_alpha = 0;
    // `global.inv = -1` — clears invulnerability so the deferred strike is
    // guaranteed to land.
    state.invTimer = -1;
    // remap_clamped(-16, 16, 1, 14, obj_heart.y - (y - 8)) — which slice
    // frame, by where the cut crossed the soul (same formula splitslash.js
    // carries).
    const off = heart.y - (e.y - 8);
    const t = Math.min(1, Math.max(0, (off - -16) / 32));
    e.cuty = Math.round(1 + (14 - 1) * t);
  },

  /** Step_2 (End Step) — while the soul is held, drag it back toward where it
   *  was caught, one pixel per axis per frame (identical to splitslash's). */
  endStep(e, state) {
    if (e.playerstrike === 1) {
      const heart = state.soul;
      if (!heart) return;
      if (heart.x !== e.memheartx) heart.x = e.memheartx + sign(heart.x - e.memheartx);
      if (heart.y !== e.memhearty) heart.y = e.memhearty + sign(heart.y - e.memhearty);
      e.memheartx = heart.x;
      e.memhearty = heart.y;
    }
  },
};

/**
 * The kaizo split organism SELF-ARMS: kaizo split_growtangle_Step_0:29-32
 * adds `if (con == 0) con = 1;` at the top of its Step (the vanilla base
 * organism only ever cuts when a splitslash writes con = 1 — which is why the
 * vanilla quickslash_big chain, debug-only content, never actually split).
 * Its kaizo init block also pins `damage = 206` unconditionally (Step_0:14 in
 * the kaizo file; the sideb/difficulty 155/135 overrides only bite at
 * difficulties 2/5, which this chain never sets — difficulty stays 0).
 *
 * The full kaizo organism (difficulty-5 fan, the sideb damage tiers, the
 * lerpvar fade) belongs to the Flurry work item; these two lines are the
 * minimum that makes the finisher's cut FIRE and carry the mod's damage, and
 * they are idempotent under that item's future module.
 */
function armKaizoSplitter(sp) {
  sp.con = 1;
  sp.timer = 0;
  sp.damage = 206; // kaizo split_growtangle_Step_0:14 (difficulty-0 path)
}

// ── obj_roaringknight_quickslash_attack — the controller ────────────────────

export const quickslashAttack = {
  /**
   * CleanUp_0 AS A TYPE HOOK, so it runs on every path that destroys this
   * controller — not just the two the Step takes itself.
   *
   * It used to be three hand-placed calls to cleanupController(), and the
   * path that actually ends most turns is not one of them: the turn sweep
   * (`with (obj_bulletparent) instance_destroy()`, obj_battlecontroller
   * Step_0:1477-1481, reached here through clearTurn) killed this object
   * with its CleanUp unrun. GameMaker runs CleanUp on EVERY
   * instance_destroy, and sim/entity.js already models that — clearTurn's
   * own note names the boxsplitter's identical `global.turntimer = -1` as
   * the precedent. This type simply never declared the hook.
   *
   * MEASURED on _tok3 f4828, the end of the atk_Quickslash turn. Both sides
   * read turntimer 0.9666666667 on f4827; the recording then reads exactly
   * -1 while the sim read -0.0333333333, and the gap stayed at exactly the
   * fractional part (0.9666666667) for every frame after, both sides
   * plateauing together on f4843. The sweep destroyed the controller on the
   * right frame — the tracer's watch shows it gone from sim f4955 — it just
   * never ran the CleanUp that assigns the -1.
   */
  cleanUp: cleanupController,

  name: 'obj_roaringknight_quickslash_attack',

  /** Create_0, kaizo lines 1-77 — vanilla base (1-42, knight index 344) plus
   *  the appended kaizo config block (43-77). Duplicate assignments kept in
   *  the original's order; do not fold. */
  create(e, state) {
    scrBulletInit(e);
    e.hell_surface = -4; // the additive marker surface — renderer-only
    e.spawn_speed = 20;
    e.spawn_range = 4;
    e.min_angle = 145;
    e.max_angle = 215;
    e.timer = 99;
    e.slash_count = 0;
    e.image_alpha = 1;
    e.image_xscale = 2;
    e.image_yscale = 2;
    // `depth = obj_heart.depth + 1` — guarded: an unassigned base would make
    // NaN (HANDOFF §8's depth trap). Draw-order only.
    // The base IS knowable, and it is NOT the object definition's depth.
    // DELTARUNE's `instance_create` is a GML compat script
    // (gml_GlobalScript_instance_create.gml: `instance_create_depth(x, y,
    // object_get_depth(obj), obj)`) and `object_get_depth` is ANOTHER GML
    // script (gml_GlobalScript_object_get_depth.gml) that returns
    // `global.__objectID2Depth[obj]`, the legacy table
    // gml_GlobalScript___global_object_depths.gml builds by NAME — or 0 for
    // any object the table does not name. `__objectNames[188] = "obj_heart"`
    // / `__objectDepths[188] = 1`, so every `instance_create(..., obj_heart)`
    // (the only way the heart is made) lands at depth 1, and this line is 2.
    // The tables are byte-identical in the kaizo dump and gml_vanilla_v105.
    // MEASURED the other half: knight-research/tools/patches/object_depth.csx
    // on kaizo-mod/oracle/data-kaizo-pristine.win reads the object-DEFINITION
    // depth as 0 for obj_heart, obj_growtangle and every quickslash/rotating
    // object — the definition field is dead under the compat script; only
    // the table matters (obj_growtangle: index 186, depth 5). The sim's soul
    // (sim/soul.js) assigns no depth, so the fallback used to be 0 and this
    // controller drew at depth 1; the fallback is now the table's 1, and the
    // soul's own field still wins if a scene ever sets it.
    e.depth = (typeof state.soul?.depth === 'number' ? state.soul.depth : 1) + 1;
    e.image_speed = 0;
    e.image_index = 1;
    e.animtimer = 5;
    e.count = 3;
    e.aetimer = 0;
    e.recoil = 0;
    e.final_slash_anim = false;
    e.slash_anim_count = 0;
    e.flip = false;
    // KAIZO Other_11 reads this one-shot pre-flip sentinel (vanilla Create
    // already had it; the kaizo Other_11 is what consumes it).
    e.flipped = -1;
    e.forward = 0;
    e.auto = false;
    e.flip_mode = true;
    e.turn_segment = -1;
    e.local_turntimer = 260;
    e.next_up = -1;
    e.next_next_up = -1;
    e.auto = true; // assigned false then true, verbatim
    // `knight = -4; if (i_ex(obj_knight_enemy)) knight = 344;` — an OBJECT
    // INDEX in the original, deref'd as knight.y. Held as the entity ref here
    // (-4 sentinel when absent), re-resolved in Step exactly where the GML
    // re-checks it.
    e.knight = knightOf(state) ?? -4;
    e.anchor_x = e.x;
    e.anchor_y = e.y;
    e.done = false;
    e.omae_wa_con = 0;
    // Initialized 0 and INCREMENTED NOWHERE in the kaizo dump — the pose
    // window test `omae_wa_timer < 10` is always true. Mod-own dead state,
    // preserved.
    e.omae_wa_timer = 0;
    e.verticalcut = false;

    // ── the kaizo config block, Create_0:43-77 ──────────────────────────────
    e.turn_type = 'full';
    e.slash_delay = 30;
    e.spawn_min = 5;
    e.spawn_yrange = -1; // sentinel; lazy-init in Other_13 (44, or 24 Side B)
    e.spawn_range = 32; // overrides the vanilla 4 above
    e.spawn_phase = 1;
    e.spawn_speed = 10; // overrides the vanilla 20 above
    e.spawn_rem = 0.25;
    e.spawn_delay = 15;
    e.timer = e.spawn_speed - 5; // 5 — the first slash comes quickly, not at once
    e.nodraw = false;
    e.local_turntimer = 600; // overrides the vanilla 260 above
    if (kaizoSideb(state)) {
      // Create_0:55-62 — FRACTIONAL cadence; all plain f64 variables, no f32.
      e.spawn_speed = 12.4;
      e.spawn_rem = 0.4;
      e.timer = e.spawn_speed - 3; // 9.4
      e.spawn_min = 6;
      e.spawn_range = 14;
    }
    // Create_0:63-76 — `with (obj_knight_enemy) if (phase == 3)` — the
    // phase-3 retune (runs AFTER the Side-B block, so it overrides it).
    // obj_knight_enemy.phase's sim analog: the knight entity's own `phase`
    // when a scene stamps it, else the kaizo loop's state.knightPhase mirror.
    {
      const knight = knightOf(state);
      const kphase = knight
        ? (knight.phase !== undefined ? knight.phase : state.knightPhase)
        : undefined;
      if (knight && kphase === 3) {
        e.timer = 20;
        e.spawn_yrange = 0;
        e.spawn_range = 12;
        e.spawn_phase = 0; // neither ramp phase fires; the 999/1000 endgame runs
        e.spawn_speed = 45;
        e.spawn_min = 4;
        e.spawn_rem = 1;
        e.spawn_delay = 5;
      }
    }
    e.endtype = 0;

    // THIS OBJECT IS THE VISIBLE KNIGHT for the whole attack (the dc hides
    // obj_knight_enemy). Definition sprite is not in the GML; the flurry
    // manager's measured spr_roaringknight_attack_ol is the family's pose
    // sheet (boxsplitter-attack.js precedent). Visual only.
    e.sprite_index = 'spr_roaringknight_attack_ol';
  },

  /** Other_10 — event_user(0), the turn setup. Called by dc type 97.1
   *  (turn_type "full") and by the chain machinery. KAIZO delta: the three
   *  chained turn types' fly-in lerps shortened 20 -> 10 frames. */
  init(e, state) {
    if (e.turn_type === 'full') {
      e.local_turntimer = 230; // NOTE: overrides Create's 600 — order is live
      scrLerpvar(state, spawn, e, 'x', e.x, state.view.x + 415, 20, 2, 'out');
      scrLerpvar(state, spawn, e, 'y', e.y, state.view.y + 87, 20, 2, 'out');
    }
    if (e.turn_type === 'start') {
      e.local_turntimer = 172;
      e.spawn_speed = 16;
      scrLerpvar(state, spawn, e, 'x', e.x, state.view.x + 415, 10, 2, 'out'); // KAIZO: 20 -> 10
      scrLerpvar(state, spawn, e, 'y', e.y, state.view.y + 87, 10, 2, 'out');
    }
    if (e.turn_type === 'end') {
      e.local_turntimer = 160;
      e.spawn_speed = 12;
      scrLerpvar(state, spawn, e, 'x', e.x, state.view.x + 417, 20, 2, 'out');
      scrLerpvar(state, spawn, e, 'y', e.y, state.view.y + 87, 20, 2, 'out');
    }
    if (e.turn_type === 'short start') {
      e.local_turntimer = 160;
      e.spawn_speed = 12;
      scrLerpvar(state, spawn, e, 'x', e.x, state.view.x + 415, 10, 2, 'out'); // KAIZO: 20 -> 10
      scrLerpvar(state, spawn, e, 'y', e.y, state.view.y + 87, 10, 2, 'out');
    }
    if (e.turn_type === 'short mid') {
      e.local_turntimer = 160;
      e.spawn_speed = 12;
      scrLerpvar(state, spawn, e, 'x', e.x, state.view.x + 415, 10, 2, 'out'); // KAIZO: 20 -> 10
      scrLerpvar(state, spawn, e, 'y', e.y, state.view.y + 87, 10, 2, 'out');
    }
    if (e.turn_type === 'short end') {
      e.local_turntimer = 160;
      e.spawn_speed = 10;
    }
  },

  /**
   * Other_11 — event_user(1), the knight's slash pose. KAIZO: rebuilt into an
   * ALTERNATING side swap anchored on the heart's START x (vanilla snapped to
   * the box's right side), plus the final-slash global.turntimer write and an
   * afterimage per pose.
   */
  other11(e, state) {
    // Other_11:1-14 — the one-shot pre-flip means the FIRST call double-flips
    // (net no-op, image_xscale stays +2) and lands on the LEFT column; calls
    // alternate sides from there. image_xscale's sign is the single source of
    // side truth.
    if (e.flipped === -1) {
      e.image_xscale = -e.image_xscale;
      e.flipped = 1;
    }
    e.image_xscale = -e.image_xscale;
    const heart = state.soul;
    if (e.image_xscale < 0) {
      if (heart) e.x = heart.xstart + 10 + 340; // right column, facing left
    } else {
      if (heart) e.x = (heart.xstart + 10) - 300; // left column (asymmetric — deliberate)
    }
    // Other_11:15-19 — vanilla middle, kept verbatim.
    if (e.image_alpha === 0) {
      const k = knightOf(state);
      if (k) k.image_alpha = 0;
      e.image_alpha = 1;
    }
    if (e.image_index >= 4) {
      e.image_index = 1;
    } else {
      e.image_index = 4;
    }
    e.animtimer = 0;
    if (e.slash_anim_count > 0) {
      e.aetimer = -1;
    }
    e.slash_anim_count += 1;
    if (e.final_slash_anim) {
      e.recoil = 6;
    } else {
      e.x -= 2;
    }
    // Other_11:42-53 — NEW final-slash override: pose frame 3 (Draw walks it
    // 3 -> 4), the knight snaps right of the heart's start facing LEFT, and
    // THE TURN CLOCK IS WRITTEN: 80 frames, 240 under endtype 1 (Side B's
    // delayed strike + vertical splitter need the room).
    if (e.final_slash_anim) {
      e.animtimer = 3;
      state.turntimer = 80;
      if (e.endtype === 1) {
        state.turntimer = 240;
      }
      e.image_index = 3;
      if (heart) e.x = heart.xstart + 10 + 280;
      e.image_xscale = -Math.abs(e.image_xscale);
    }
    // Other_11:54-57 — NEW: a fast afterimage on every pose, streaking
    // opposite the facing direction. hspeed on obj_afterimage -> the
    // speed/direction pair (the boxsplitter endStep's own conversion).
    const fade = scrAfterimagefast(state, e);
    const hs = -3 * e.image_xscale;
    fade.speed = Math.abs(hs);
    fade.direction = hs < 0 ? 180 : 0;
  },

  /** Other_12 — KAIZO: `event_user(1); exit;` — a pure alias of Other_11.
   *  The vanilla left-side pose body below those two lines is DEAD and is
   *  deliberately not translated. */
  other12(e, state) {
    quickslashAttack.other11(e, state);
  },

  /**
   * Other_13 — event_user(3), the slash spawner. KAIZO: full retarget —
   * slashes spawn at a randomized HEIGHT and aim EXACTLY at the heart center
   * (vanilla jittered the angle with a pingpong clamp and a dead-accurate
   * every-6th); plus the phase-2 "wall from the left" barrage, the Side-B
   * extra vertical slash, and per-spawn evolution of the spread knobs.
   *
   * RNG PER SPAWN (kaizo; counted, order preserved): main slash 2 draws
   * normally, +3 in phase 2 (snd pitch, box y, angle); Side-B extra slash +4
   * (x jitter, x jitter 2, snd pitch, angle). A decayed spawn_yrange of 0
   * STILL consumes its draw.
   */
  other13(e, state) {
    const gt = box(state);
    const heart = state.soul;
    // NO SOUL, NO TARGET (the splitslash.js convention): the GML reads
    // obj_heart directly and only runs during the bullet phase.
    if (!gt || !heart) return;
    // PRE-STEP soul position, the verified rotating-slash compensation: the
    // controller is created mid-turn, newer than the soul, and its aim reads
    // the soul before this frame's movement.
    const hp = state.soulPrev ?? heart;
    const knight = knightOf(state);
    const kx = knight ? knight.x : e.x;

    let _slash = spawn(state, quickslash, {
      x: gt.x + (e.flip ? 20 : -20),
      y: gt.y,
    });
    let _xx = kx + 100;
    let _minAngle = e.min_angle;
    let _maxAngle = e.max_angle;
    if (e.flip) {
      _minAngle -= 180;
      _maxAngle -= 180;
      _xx = gt.x - Math.abs(_xx - gt.x);
    }
    {
      const s = _slash;
      // Other_13:13 — spawn height jitter, then aim EXACTLY at the heart
      // center (+10,+10 — the kaizo-wide true 20px-heart center; vanilla +8).
      s.y = hp.y + 10 + gmlRandomRange(state.gmlRng, -e.spawn_range, e.spawn_range);
      let _targetdir = pointDirection(_xx, s.y, hp.x + 10, hp.y + 10);
      e.count += 1; // still incremented, now consumed by nothing (kaizo)
      s.flip = e.flip;
      if (s.flip) {
        _targetdir = angleDifference(_targetdir, 0);
      }
      if (s.flip) {
        s.image_xscale *= -1;
        scrOrbitaroundpoint(s, _xx, gt.y, _targetdir);
      } else {
        _targetdir -= 180;
        scrOrbitaroundpoint(s, _xx, gt.y, _targetdir);
      }
      // Other_13:31-33 — post-orbit y jitter (spawn_yrange; -1 sentinel on
      // the very first spawn — random_range(1, -1), verbatim), then the
      // 2px-inside-the-box clamp. ORDER: set y -> point_direction -> orbit
      // (overwrites x,y) -> y += jitter -> clamp -> angles.
      s.y += gmlRandomRange(state.gmlRng, -e.spawn_yrange, e.spawn_yrange);
      s.y = Math.min(s.y, gtMaxy(state) - 2);
      s.y = Math.max(s.y, gtMiny(state) + 2);
      s.image_angle = _targetdir;
      s.direction = _targetdir;
      // Other_13:36-44 — the phase-2 barrage override: box-center x, random
      // y across the whole box (5px margin), fired leftward at 180 ± 36.
      if (Math.floor(e.spawn_phase) === 2) {
        s.x = gt.x;
        cue(state, 'snd_noise', 0.4 + gmlRandomRange(state.gmlRng, -0.05, 0.05), 0.75);
        s.y = gmlRandomRange(state.gmlRng, gtMiny(state) + 5, gtMaxy(state) - 5);
        _targetdir = 180 - gmlRandomRange(state.gmlRng, -36, 36);
        s.image_angle = _targetdir;
        s.direction = _targetdir;
      }
    }

    // Other_13:46-70 — NEW: the Side-B extra VERTICAL slash per spawn
    // (suppressed during the phase-2 barrage). `extra = 1` skips the pose
    // callback in the slash's own Step.
    if (kaizoSideb(state) && Math.floor(e.spawn_phase) !== 2) {
      _slash = spawn(state, quickslash, { x: gt.x, y: gt.y });
      _slash.extra = 1;
      _xx = kx + 100;
      _minAngle = e.min_angle;
      _maxAngle = e.max_angle;
      if (e.flip) {
        _minAngle -= 180;
        _maxAngle -= 180;
        _xx = gt.x - Math.abs(_xx - gt.x);
      }
      {
        const s = _slash;
        s.x = hp.x + 10 + gmlRandomRange(state.gmlRng, -e.spawn_range, e.spawn_range);
        // Dead value (overwritten below), computed for order fidelity — it
        // draws nothing and has no side effects.
        let _targetdir = pointDirection(_xx, s.y, hp.x + 10, hp.y + 10);
        s.x += gmlRandomRange(state.gmlRng, -e.spawn_yrange, e.spawn_yrange);
        cue(state, 'snd_noise', 0.4 + gmlRandomRange(state.gmlRng, -0.05, 0.05), 0.75);
        s.y = gt.y;
        _targetdir = 90 + gmlRandomRange(state.gmlRng, -e.spawn_range, e.spawn_range);
        s.image_angle = _targetdir;
        s.direction = _targetdir;
      }
    }

    // Other_13:71-89 — per-spawn evolution (vanilla had only the flip toggle;
    // the spawn_range walk REPLACES vanilla Step's growth to 60 — kaizo
    // slashes get MORE accurate over time, not less).
    if (e.flip_mode) {
      e.flip = !e.flip;
    }
    e.min_angle = scrApproach(e.min_angle, 172, 2); // vestigial (pingpong gone), kept
    e.max_angle = scrApproach(e.max_angle, 188, 2);
    if (e.spawn_range > 8) {
      e.spawn_range = scrApproach(e.spawn_range, 8, 1);
    }
    if (e.spawn_yrange === -1) {
      e.spawn_yrange = 44;
      if (kaizoSideb(state)) {
        e.spawn_yrange = 24;
      }
    }
    e.spawn_yrange = scrApproach(e.spawn_yrange, 0, 4);
  },

  alarm: {
    /**
     * Alarm_2 — the combination-chain handoff (spawns the next attack's
     * controller by object index and destroys this one). UNREACHABLE from
     * types 1001/97.1: nothing arms alarm[2] on a "full" turn — only the
     * chain machinery (the kaizo combination, ac 106, a separate work item)
     * does. Ledgered rather than half-translated, so a future wiring is loud.
     */
    2(e, state) {
      ledger(state, {
        type: 1001,
        asked: `quickslash Alarm_2 chain handoff (next_up ${e.next_up})`,
        used: 'destroy without handoff',
        why: 'combination-chain segments are the ac-106 work item',
      });
      destroy(e, state); // CleanUp runs on the GML destroy too
    },
  },

  /** Step_0, kaizo. */
  step(e, state) {
    e.local_turntimer -= 1;
    if (!e.auto) {
      return;
    }
    // `if (knight == -4) knight = 344;` — re-resolve the knight ref. The
    // `|| !alive` half is an ADDITION, not the GML: the original stores an
    // OBJECT INDEX, which stays valid forever, while this holds an entity
    // reference that a destroy would leave dangling. It cannot change
    // behaviour in the fight (the knight outlives every turn) and it keeps a
    // stale ref from reaching the `lerp(y, knight.y, ...)` below.
    if (e.knight === -4 || !e.knight || !e.knight.alive) {
      e.knight = knightOf(state) ?? -4;
    }
    if (e.local_turntimer <= 50) {
      // The wind-down: idle pose, drift toward the knight, then the
      // endtype-gated despawn window.
      if (e.local_turntimer <= 10 && e.sprite_index !== 'spr_roaringknight_idle') {
        if (e.image_xscale < 0) {
          e.x -= 220;
        }
        e.image_xscale = Math.abs(e.image_xscale);
        e.sprite_index = 'spr_roaringknight_idle';
        e.image_index = 0;
      } else if (e.local_turntimer < 42 && e.image_xscale < 0) {
        e.image_index = 4;
      }
      const knight = knightOf(state);
      if (knight && e.x < knight.x) {
        e.x += 1;
      }
      let _local_turntimer = e.local_turntimer;
      if (_local_turntimer < 0) {
        _local_turntimer = 0;
      }
      if (e.knight !== -4 && e.knight) {
        e.y = lerp(e.y, e.knight.y, (50 - _local_turntimer) / 50);
      }
      // KAIZO Step_0:36-50 — the endtype gate around the despawn window:
      // endtype 1 (Side B's vertical finish) keeps the controller ~100
      // frames longer (-160 vs -60/-110).
      if (e.endtype === 0) {
        if ((e.local_turntimer < -60 && e.turn_type !== 'short end')
          || (e.local_turntimer < -110 && e.turn_type === 'short end')) {
          state.turntimer = 0;
          destroy(e, state); // CleanUp_0 fires on the destroy -> turntimer -1
          return;
        }
      } else if (e.local_turntimer < -160) {
        state.turntimer = 0;
        destroy(e, state); // CleanUp_0 fires on the destroy -> turntimer -1
        return;
      }
    } else if (e.recoil !== 0) {
      // The final pose's recoil drift. scr_movetowards toward 0.25*sign
      // PARKS at 0.25, so the knight drifts +0.25/frame until the wind-down —
      // the original's own arithmetic, preserved (both dumps).
      e.x += e.recoil;
      e.recoil = scrMovetowards(e.recoil, 0.25 * sign(e.recoil), 0.5);
    }

    // The turn-end trigger (Step_0:57-151). For turn_type "full" this arms
    // the endgame: slash_count 999, then the next spawn tick fires the BIG.
    if ((e.local_turntimer < 120 || (e.local_turntimer < 150 && e.next_up === 4))
      && e.slash_count < 999 && (e.slash_count % 2) === 0 && !e.done) {
      e.slash_count = 999;
      if (e.turn_type === 'start' || e.turn_type === 'short start' || e.turn_type === 'short mid') {
        // Step_0:60-148 — the chain handoff into the NEXT attack controller
        // (raw object indices 1173/630/802/669, nodraw/auto freeze, warp).
        // UNREACHABLE from 1001/97.1 (turn_type "full"/"end" only), so a
        // STANDALONE quickslash never reaches this line; it is ac 106's
        // segment 1 that does, where the launcher has set the hook.
        //
        // THE SITE NAME IS THE OPT-IN, exactly as in the four sibling
        // modules (swordfall Alarm_3, rotating slash Alarm_2, revised tunnel
        // Alarm_2 and its mid-Step block). `chainNext`'s third argument
        // routes to `state.kaizo.hooks.comboChainNext` when a scene has set
        // one, which is what makes the SUCCESSOR a kaizo module instead of
        // the sim copy that registered itself in the shared registry
        // (kaizo/HANDOFF.md §2.1 forbids the kaizo modules from writing that
        // registry). With no hook the argument is ignored and this is the
        // vanilla handoff. 'quickslash_step' is the site in KAIZO_CHAIN_SITES
        // that transcribes THIS event: the successor-keyed x offsets
        // (630 -> -50, 802 -> +25, else +50), the warp that the underbox
        // (1173) alone does not get, and its alarm[0]/init_start/init seed.
        //
        // THIS REPLACED A LEDGER ROW that read "controller frozen, no
        // follow-up spawned". That stand-in froze the segment at
        // local_turntimer 99999 under a clock the launcher pins at 999999, so
        // nothing handed the turn back and ac 106 was an UNFINISHABLE TURN
        // the moment the launcher routed case 105. It is a hang, not a
        // cosmetic gap; see the combination header's "WHAT LEG 1 WILL AND
        // WILL NOT CLOSE".
        e.done = true;
        e.local_turntimer = 99999;
        e.slash_count = 1000;
        if (e.next_up > 0) {
          e.nodraw = true; // KAIZO Step_0:85-89
          e.auto = false;
        }
        chainNext(state, e, 'quickslash_step');
        // GML clears next_up BEFORE the instance_create; the handoff above
        // reads it to pick the successor, so the clear follows it here. The
        // hook sets it too, and -999 twice is -999.
        e.next_up = -999;
        return;
      }
      e.slash_anim_count = 999;
      e.timer = -2;
    }
    if (e.slash_count > 999) {
      return;
    }
    if (e.slash_count === 999 && e.done) {
      return;
    }
    e.timer += 1;
    if (e.timer >= e.spawn_speed) {
      // KAIZO Step_0:161-195 — THE MULTI-PHASE SPAWN-RATE MACHINE (replaces
      // vanilla's flat `spawn_speed -= 2` ramp).
      if (e.spawn_speed <= e.spawn_min) {
        // `spawn_phase == 1` — literal-assigned integer, exact.
        if (e.spawn_phase === 1) {
          e.slash_count = 980;
          e.spawn_phase = 2;
          e.spawn_speed = 2;
          e.spawn_min = 2;
          // timer = -7: the `if (timer >= 0) timer = 0` reset below preserves
          // negatives, so this buys a breather before the barrage's first cut.
          e.timer = -7;
          return;
        }
        if (Math.floor(e.spawn_phase) === 2) {
          e.slash_count = 980; // pinned even — the 999/1000 endgame can't fire
          e.spawn_phase += 0.03;
          e.spawn_speed = 2;
          e.slash_delay = 40; // barrage telegraphs stretch to 40 frames
          // GML `if (spawn_phase >= 2.27)` — and this MUST go through gmlLte.
          //
          // `spawn_phase` is ACCUMULATED: 2 walked up by nine `+= 0.03`. In f64
          // that lands on 2.2699999999999982414, which is 1.776e-15 BELOW the
          // literal — so a bit-exact JS `>=` misses on the ninth increment and
          // runs a NINTH barrage cut. GameMaker compares reals through
          // math_set_epsilon (CLAUDE.md, "GML == ON REALS IS NOT ==="), so the
          // mod exits on that increment and the barrage is EIGHT cuts.
          //
          // MEASURED, not reasoned. `_deep` logs atk_Quickslash twice, 6,546
          // frames apart, and both passes show the same 28 obj_roaringknight_
          // quickslash: 20 ramp cuts, then eight 2-frame-spaced barrage cuts
          // (f4983..f4997 and f11529..f11543). `_schedule` independently
          // agrees at 28. A ninth cut would make 29 on every pass.
          //
          // The epsilon interval CLAUDE.md bounds from the roaring fade
          // (> 1.9e-15) already covers this 1.776e-15 gap, so the two
          // independent measurements agree rather than merely coexist.
          //
          // ORIGINAL-INTENT NOTE: the author plainly meant nine steps of 0.03
          // to reach 2.27. Decimal says nine; f64 + epsilon says the ninth
          // step IS the exit. Do NOT "clean this up" back to a bare `>=`.
          if (gmlLte(2.27, e.spawn_phase)) {
            e.nodraw = true;
            e.timer = 0;
            e.spawn_phase = 0;
            e.spawn_speed = 15;
            e.slash_count = 999;
            return;
          }
        }
      } else {
        e.spawn_speed = scrApproach(e.spawn_speed, e.spawn_min, e.spawn_rem);
        e.slash_delay = e.spawn_speed + e.spawn_delay;
      }
      e.slash_count += 1;
      if (e.timer >= 0) {
        e.timer = 0;
      }
      if (e.slash_count === 1000) {
        // KAIZO Step_0:201-208 — the big-slash trigger now clamps
        // local_turntimer (vanilla lacked the clamp; needed because kaizo's
        // Create starts the clock at 600).
        const gt = box(state);
        if (gt) {
          spawn(state, quickslashBig, { x: gt.x + 33, y: gt.y });
        }
        if (e.local_turntimer > 135) {
          e.local_turntimer = 135;
        }
      } else {
        // event_user(3). Named reference, not `this` — runPhase invokes step
        // as a bare function, so `this` is undefined here (ES strict).
        quickslashAttack.other13(e, state);
        if (e.slash_count === 999) {
          e.spawn_speed = 10;
        }
      }
    }
  },

  /**
   * Draw_0's state-bearing block (animtimer walk, pose-frame advance, the
   * afterimage trail), modelled in endStep — Draw runs after every Step in
   * GML, and endStep is the sim's last phase, so a pose reset from a slash's
   * Step this frame lands before the walk exactly as it does in the game.
   * KAIZO delta: the whole block gates on `!nodraw` (chain handoff and the
   * post-barrage stretch freeze the counters), and pose frame 3 advances
   * (image_index == 3 -> 4, the final-slash pose).
   */
  endStep(e, state) {
    if (!(e.image_alpha === 1 && !e.nodraw)) return;
    if (e.animtimer < 4) {
      e.animtimer += 1;
    } else if (e.image_index === 1 || e.image_index === 4 || e.image_index === 3) {
      e.image_index += 1;
    }
    e.aetimer += 1;
    if ((e.aetimer % 4) === 0 && e.image_alpha !== 0) {
      const gt = box(state);
      const fade = scrAfterimage(state, e);
      fade.image_alpha = 0.6;
      fade.fadeSpeed = 0.02;
      // hspeed = 2 * sign(x - obj_growtangle.x) — built-in motion pair.
      const d = sign(e.x - (gt ? gt.x : e.x));
      fade.speed = Math.abs(2 * d);
      fade.direction = d < 0 ? 180 : 0;
      fade.depth = e.depth + (gt && e.x < gt.x ? 50 : 100);
    }
    // The hell_surface marker-gradient composite below this block in Draw_0
    // is pure rendering (reads each slash's xdraw/ydraw/thickness/blend, all
    // computed above) — renderer work later.
  },
};

// ── launch helpers — the dc's own type branches ─────────────────────────────

/**
 * obj_dbulletcontroller Create_0's inheritable fields: every one is the -1
 * "leave alone" sentinel except what the fight script wrote (damage), and
 * element is the string "none", which scr_bullet_inherit copies
 * unconditionally.
 */
function dcLike(damage) {
  return {
    damage: damage ?? -1,
    grazepoints: -1,
    timepoints: -1,
    inv: -1,
    // `__dc.target = mytarget` (scr_bulletspawner) — FOUR in chapter 3
    // (scr_randomtarget:35); see kaizo-mod-launcher.js dcInheritable.
    target: 4,
    grazed: -1,
    grazetimer: -1,
    element: 'none',
  };
}

/**
 * dc type == 1001 — gml_Object_obj_dbulletcontroller_Step_0.gml:2264-2278:
 *
 *     global.turntimer = 999999;
 *     with (creatorid) image_alpha = 0;
 *     var knight_quickslash = instance_create(creatorid.x, creatorid.y,
 *                                             obj_roaringknight_quickslash_attack);
 *     knight_quickslash.target = 3;
 *     scr_bullet_inherit(knight_quickslash);
 *
 * NO event_user(0): Create's turn_type "full" / local_turntimer 600 stay
 * live, and there is no fly-in. The dispatch arm (ac 105) also floors the
 * clock at 9999 — a no-op under the 999999 pin; the launcher owns that op.
 */
export function spawnQuickslash1001(state, opts = {}) {
  state.turntimer = 999999;
  const knight = knightOf(state);
  if (knight) knight.image_alpha = 0;
  const e = spawn(state, quickslashAttack, {
    x: knight ? knight.x : 425,
    y: knight ? knight.y : 78,
  });
  e.target = 3; // BEFORE the inherit -- which overwrites it with the dc's 4 (mytarget); the 3 is dead, as in the game
  scrBulletInherit(dcLike(opts.damage), e);
  return e;
}

/**
 * dc type == 97.1 — gml_Object_obj_dbulletcontroller_Step_0.gml:1963-1985:
 *
 *     with (creatorid) image_alpha = 0;
 *     var _quickslasher = instance_create(creatorid.x, creatorid.y,
 *                                         obj_roaringknight_quickslash_attack);
 *     scr_bullet_inherit(_quickslasher);
 *     _quickslasher.difficulty = difficulty;
 *     if (kaizo_sideb()) _quickslasher.endtype = 1;
 *     with (_quickslasher) { turn_type = "full"; event_user(0); }
 *
 * No turntimer pin here — the dispatch arm's scr_turntimer(9999) floor arms
 * the clock (launcher's op). event_user(0)'s "full" branch OVERRIDES Create's
 * local_turntimer 600 down to 230 and flies the knight in — the ordering the
 * Other_10 delta spec calls out as live.
 */
export function spawnQuickslashTrue(state, opts = {}) {
  const knight = knightOf(state);
  if (knight) knight.image_alpha = 0;
  const e = spawn(state, quickslashAttack, {
    x: knight ? knight.x : 425,
    y: knight ? knight.y : 78,
  });
  scrBulletInherit(dcLike(opts.damage), e);
  // Stored and read by nothing in the object (no difficulty branches exist
  // in any quickslash event) — kept faithfully.
  e.difficulty = opts.difficulty ?? 0;
  if (kaizoSideb(state)) {
    e.endtype = 1;
  }
  e.turn_type = 'full';
  quickslashAttack.init(e, state); // event_user(0)
  return e;
}

// NOTE: the marker-gradient mask stand-in used to ledger one approx row per
// launch here. The sprite is extracted now
// (QUICKSLASH_MARKER_GRADIENT_MASK), so there is nothing to approximate and
// the row is gone — check-quickslash asserts its ABSENCE, so a regression
// that reintroduced a stand-in would have to reintroduce the row too.
