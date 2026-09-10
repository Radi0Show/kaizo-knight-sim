// THE KAIZO KNIGHT — the mod's recolour and its rainbow afterimage trail.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C).
//
// Provenance:
//   gml_Object_obj_knight_enemy_Create_0.gml:38   rgbafterimages = 1
//   gml_Object_obj_knight_enemy_Draw_0.gml:30-91  the afterimage block, with
//                                                 the 7-colour cycle appended
//   gml_Object_obj_knight_enemy_Step_0.gml:694+   idlesprite =
//                                                 spr_roaringknight_idle2
//   gml_Object_obj_knight_enemy_Draw_0.gml:1-4    the bob gate's second clause
//                                                 (`|| turntimer < 5`), draw slot
//   gml_Object_obj_knight_enemy_Draw_0.gml:35     the ghost wears `idlesprite`
//
// COMPOSED, NOT COPIED. sim/actors.js's knightActor is ~500 lines of
// oracle-verified behaviour (the Swordslash soul clamp, the charge-up
// burn-out, the hurt strobe, the bob) and the mod changes none of it. What
// the mod adds is: the ghost the base code has just spawned gets a colour,
// and on the B-Side his idle sprite can swap. Wrapping expresses exactly that
// delta — a copy would duplicate 500 lines to change five, and would silently
// stop tracking any later sim/ fix.
//
// The mod's Draw sets `afterimage.image_blend` INSIDE the same block that
// creates the ghost, so tinting the just-created ghost immediately after the
// base step is the same ordering, not an approximation.

import { knightActor } from '../../sim/actors.js';
import { spawn } from '../../sim/entity.js';
import { afterimage } from '../../sim/fx.js';
import { nextAfterimageColor } from '../attacks/kaizo-colors.js';

/**
 * The mod's Create sets `rgbafterimages = 1` unconditionally, so the rainbow
 * is not a reward or a setting — it is simply what this Knight looks like.
 */
export const kaizoKnightActor = {
  ...knightActor,

  create(e, state) {
    knightActor.create?.(e, state);
    // `rgbafterimages = 1` (Create:38) and the counter it drives. Named as
    // the GML names them so the two read against each other.
    e.rgbafterimages = 1;
    e.afterimagecon = 0;
  },

  step(e, state) {
    // Remember which ghosts already existed, so the one (if any) that the
    // base step creates this frame can be told apart from the trail still
    // fading from earlier frames.
    const before = new Set();
    for (const x of state.entities) {
      if (x.alive && x.type?.name === 'obj_afterimage') before.add(x);
    }

    knightActor.step?.(e, state);

    // THE GHOST WEARS `idlesprite`, NOT THE LITERAL. Draw_0:35 (the idle
    // branch) is the mod's one-word change to the spawn block —
    //
    //     afterimage.sprite_index = idlesprite;      // vanilla: spr_roaringknight_idle
    //
    // — and Draw_0:44 (the hurt branch's idle frame) already read
    // `idlesprite` in both versions. sim/actors.js hands every idle-frame
    // ghost the literal name (its own comment quotes the vanilla line), so a
    // ghost spawned while `idlesprite` is the block pose (Step_0:127) or the
    // B-Side recolour (Step_0:694) would wear the wrong sprite. Resolved
    // here, on the ghost the base step just made, through the same reader
    // the kaizo Draw port uses (kaizoIdlesprite, below); the ball-frame
    // ghost (Draw_0:48-49) is not an idle frame and is left alone. Ghost
    // sprites are untraced, so the byte gate does not move.
    for (const x of state.entities) {
      if (!x.alive || x.type?.name !== 'obj_afterimage' || before.has(x)) continue;
      if (x.sprite_index === 'spr_roaringknight_idle') {
        // STEP-PHASE READ (`atStep`): the GML spawns this ghost in the Draw,
        // after the Step has processed `blockanim`; this runs in the step
        // phase, before the scene's endStep does (kaizo-practice.js
        // stepKnightAnim). See kaizoIdlesprite for the two views.
        x.sprite_index = kaizoIdlesprite(e, state.knight, { atStep: true });
      }
    }

    // ── THE STATE-10 TRAIL, WHICH IS THE MOD'S ALONE ─────────────────────
    //
    // Draw_0:93-141, and vanilla's Draw has no `state == 10` block at all --
    // vanilla's knight is only ever state 0 or 3 (two writes in the whole
    // dump, both `state = 3`), so this is a branch EnderCat8 added for the
    // three B-Side cutscenes:
    //
    //     if (state == 10) {
    //         aetimer++;
    //         if ((aetimer % 4) == 0) {
    //             afterimage = instance_create_depth(x, y, depth + 1, obj_afterimage);
    //             afterimage.sprite_index = sprite_index;
    //             afterimage.image_index  = image_index;
    //             afterimage.image_alpha  = 0.6;
    //             afterimage.fadeSpeed    = 0.02;
    //             afterimage.hspeed       = 2;
    //             afterimage.image_speed  = 0;
    //             afterimage.image_xscale = image_xscale;
    //             afterimage.image_yscale = image_yscale;
    //             if (rgbafterimages == 1) { ...the seven-colour cycle... }
    //         }
    //         draw_self();
    //     }
    //
    // Three things separate it from the idle trail sim/actors.js carries:
    // the ghost wears `sprite_index` and `image_index` -- the POSE, so the
    // knight's leap and his swing smear rather than leaving idle copies of a
    // knight who is not there; it carries his scales; and it has NO
    // `image_alpha != 0 && chargeupcon == 0` guard, so it runs whatever else
    // is happening. It shares `aetimer` with the idle trail, which the base
    // step leaves alone outside state 0/3 -- so the cadence carries across
    // the boundary in both directions, exactly as the GML's one counter does.
    //
    // Spawned here, between the idle-ghost rewrite above and the rainbow tint
    // below, because the mod's own cycle is inside this same block: the loop
    // that follows finds it and gives it the next colour, which is the
    // ordering the GML has.
    if ((state.knight?.animState ?? 0) === 10 && e.visible !== false) {
      e.aetimer += 1;
      if ((e.aetimer % 4) === 0) {
        const a = spawn(state, afterimage, { x: e.x, y: e.y });
        a.sprite_index = e.sprite_index;
        a.image_index = e.image_index;
        a.image_alpha = 0.6;
        a.fadeSpeed = 0.02;
        a.hspeed = 2;
        a.image_speed = 0;
        a.image_xscale = e.image_xscale;
        a.image_yscale = e.image_yscale;
        a.depth = e.depth + 1;
      }
    }

    if (!e.rgbafterimages) return;
    for (const x of state.entities) {
      if (!x.alive || x.type?.name !== 'obj_afterimage' || before.has(x)) continue;
      // `afterimagecon += 1` then a ladder of `if (afterimagecon == n)`,
      // wrapping to 0 on the seventh — kept in nextAfterimageColor so the
      // wrap cannot drift from the cycle it indexes.
      const { con, color } = nextAfterimageColor(e.afterimagecon ?? 0);
      e.afterimagecon = con;
      x.image_blend = color;
    }
  },

  /**
   * obj_knight_enemy Draw_0:1-4 — THE MOD'S BOB GATE, in the engine's draw
   * slot (sim/index.js "THE DRAW SLOT") because it is Draw-time state:
   *
   *     if (!i_ex(obj_knight_roaring2) || (i_ex(obj_knight_roaring2) && global.turntimer < 5))
   *         siner2++;
   *
   * Vanilla is the first clause alone, and sim/actors.js knightActor.draw
   * carries exactly that (its comment: the bob FREEZES during ROARING). The
   * second clause is EnderCat8's: while the roar holds the clock under 5 the
   * count runs again. Where that happens (MEASURED in the translation, not
   * on the recording — there is no draw log of the mod): the kaizo roar's
   * glass-fall finale pins `global.turntimer = 4` on every frame of its
   * attack_con 6 (kaizo/attacks/roaring-final.js, "THE TURN ENDS HERE") after
   * handing the Knight back visible and idle, so under the mod he sways at
   * the top of the bob while the pieces fall; under the vanilla gate he hangs
   * still. Its ordinary hand-back at roaring_timer 375 leaves -1 on the clock
   * and zeroes siner2 in the same frame (roaring-final.js, the CleanUp), so
   * any frame the roar outlives that hand-back ticks from 0 exactly as the
   * game's would.
   *
   * COMPOSED like the step above: the vanilla draw runs first (its tick, its
   * y), then the mod's extra tick, then the y write again — GML does
   * `siner2++` and THEN `y = ystart + cos(siner2 / 8) * 8` (Draw_0:28), so the
   * end state is the same either way. The y write repeats the Draw's own
   * gates, in its order: an invisible instance has no Draw at all, the
   * sword-tunnel `exit` (Draw_0:5-8) and the con-2 `exit` (Draw_0:9-21) sit
   * above the bob, and the bob itself is `state == 0 || state == 3`
   * (Draw_0:22-28). Byte gate: siner2 is untraced and the roar's own
   * one-shot re-pin of it (roaring2 Step_0:556-560, roaring_timer 363) is the
   * roaring family's to carry — nothing here fires while the launcher's
   * 999999 is on the clock.
   */
  draw(e, state) {
    knightActor.draw?.(e, state);
    const kb = state.knight;
    const roaring = state.entities.some(
      (x) => x.alive && x.type.name === 'obj_knight_roaring2',
    );
    if (e.visible === false || !roaring) return;
    // `global.turntimer < 5` — a clock that is not a number is not under 5.
    if (!(typeof state.turntimer === 'number' && state.turntimer < 5)) return;
    e.siner2 += 1;
    const drawRuns = kb
      && kb.chargeupcon !== 2
      && !state.entities.some(
        (x) => x.alive && x.type.name === 'obj_knight_swordtunnelanim',
      );
    if (drawRuns && (kb.animState === 0 || kb.animState === 3)) {
      e.y = e.ystart + Math.cos(e.siner2 / 8) * 8;
    }
  },
};

/**
 * `idlesprite` AS THE MOD'S DRAW READS IT THIS FRAME — the one reader for the
 * ghost spawn above and for the kaizo Draw port (kaizo/render/draw/
 * tracking.js), so the two cannot disagree about what the Knight looks like.
 *
 * Where the GML writes it (both versions unless noted):
 *   Create_0:5        idlesprite = spr_roaringknight_idle
 *   Step_0:127 / 119  spr_roaringknight_block_ol while `blockanim` runs, back
 *                     to the idle on the Step after it clears — the sim
 *                     carries that swap as `e.sprite_index` off
 *                     state.knight.blockanim (sim/actors.js knightActor.step),
 *                     so both spellings are read here;
 *   Step_0:694/714/727/740 (kaizo only) spr_roaringknight_idle2, the B-Side
 *                     no-hit reward — applyKaizoIdleRecolor below writes
 *                     `e.idlesprite`, called from kaizo-vc-hooks.js's
 *                     sidebTurnEndMessages at the GML's four sites.
 * NOT the hurt strobe's ball frame: that is `spr_roaringknight_ball_transition`
 * written straight at its draw sites, never into idlesprite.
 *
 * THE BLOCK POSE IS `blockanim == 2`, NOT "blockanim is set" (verifier fix).
 * Kaizo Step_0:123-131 writes `idlesprite = spr_roaringknight_block_ol` in
 * the SAME `if (blockanim == 1)` that flips blockanim to 2, and Step_0:184-190
 * (`blocktimer == 15`) writes it back to the idle in the same block that
 * zeroes blockanim — so at Draw time the pose is on exactly while blockanim
 * reads 2. The frame ordering that makes the old reading wrong at both
 * edges, MEASURED in the sim's phase order (kaizo-practice.js endStep:
 * stepKnightAnim, then the version hooks that arm `blockanim = 1` in
 * fightDamage): the arm lands at frame N AFTER stepKnightAnim, so the
 * renderer reads blockanim 1 that frame while the game's Draw N still shows
 * the idle (obj_heroparent, index 1409, steps after obj_knight_enemy, 346 —
 * the Knight processes the arm at Step N+1); and sim/actors.js:414 writes
 * `e.sprite_index = block_ol` in the STEP phase of the frame whose endStep
 * zeroes blockanim, so `e.sprite_index` reads the pose one frame past the
 * game's reset. Reading `blockanim === 2` alone is right at both edges
 * (Draws N+1..N+14 under the sim's blocktimer, which knight.js resets at
 * 15, the GML's `blocktimer == 15`).
 *
 * `atStep`: the ghost rewrite above runs in the step phase, one phase before
 * the endStep that processes the arm — there "blockanim == 1 now" means "2 at
 * this frame's Draw" and "2 with blocktimer 14" means "0 at this frame's
 * Draw", so the step-phase view predicts the endStep's flip. The Draw port
 * (kaizo/render/draw/tracking.js) reads after the endStep and passes nothing.
 */
export function kaizoIdlesprite(e, k, { atStep = false } = {}) {
  const b = k?.blockanim ?? 0;
  const blockPose = atStep
    ? (b === 1 || (b === 2 && (k?.blocktimer ?? 0) < 14))
    : b === 2;
  if (blockPose) return 'spr_roaringknight_block_ol';
  return e?.idlesprite ?? 'spr_roaringknight_idle';
}

/**
 * THE KAIZO BLOCK'S STEP WRITES THE SIM DOES NOT CARRY — Draw-read state
 * (verifier fix; every value below is read by obj_knight_enemy's Draw_0).
 *
 * sim/knight.js stepKnightAnim translates the block as the bell, `blockanim
 * = 2`, `blocktimer = 0` and the 15-frame clock (its comment records that the
 * vanilla sim never arms it). The mod arms it on EVERY non-crit FIGHT hit
 * (kaizo-vc-hooks.js fightDamage, `kaizo_block`), and its Step_0:123-148 is
 *
 *     if (blockanim == 1) {
 *         snd_stop(snd_metal_hit); snd_play(snd_metal_hit);     (audio — sim plays snd_bell, see below)
 *         idlesprite = spr_roaringknight_block_ol;              (kaizoIdlesprite above)
 *         whiteflash = 2;                                       (:128 — the Draw's :217-233 white copy)
 *         blockanim = 2; blocktimer = 0;                        (sim/knight.js:428-432)
 *         shakex = 5;                                           (:131 — the strobe's x offset)
 *         state = 3; hurttimer = 30;                            (:132-133 — the strobe re-armed)
 *         with (scr_afterimage()) { sprite_index = spr_roaringknight_block_ol;
 *             depth = other.depth + 1; vspeed = 3;  friction = 0.15; }   (:134-140)
 *         with (scr_afterimage()) { sprite_index = spr_roaringknight_block_ol;
 *             depth = other.depth + 1; vspeed = -3; friction = 0.15; }   (:141-147)
 *     }
 *
 * ORIGINAL BUG — THE BLOCK SPARKS ARE UNREACHABLE IN THE MOD, and this is
 * the reason there is no obj_block_vfx anywhere in this repo. Vanilla
 * v105 Step_0:62-91 spawns them straight out of the clock:
 *
 *     if (blockanim == 2) {
 *         blocktimer++;
 *         if (blocktimer == 1)                  { two obj_block_vfx, vspeed -8 / 8 }
 *         if (blocktimer == 3 || blocktimer == 6) { one more, vspeed choose(-8, 8) }
 *
 * The kaizo dump wraps both spawns in a test that cannot pass —
 * Step_0:149-184 is `if (blockanim == 2) { blocktimer++;
 * if (blockanim == 1) { ...the spawns... } }` — so EnderCat8's Knight blocks
 * with the pose, the bell, the whiteflash and the two block_ol ghosts, and
 * without a single spark. Same family as `destroy_on_hit` and `splitbox`,
 * and marked here rather than left to inference for two reasons: a later
 * pass "restoring" the sparks would be a divergence, and `choose(-8, 8)` is
 * an RNG DRAW — three of them per block — so restoring them would also
 * desync the stream and move the byte gate.
 *
 * and Step_0:184-190, when the clock runs out:
 *
 *     if (blocktimer == 15) { hurttimer = 0; blocktimer = 0; blockanim = 0;
 *                             idlesprite = spr_roaringknight_idle; }
 *
 * (`hurttimer = 0` is kaizo-only — vanilla v105 Step_0:93-98 has the other
 * three.) Later in the same Step, :1306-1310 `if (state == 3) scr_enemy_hurt()`
 * ticks hurttimer and walks shakex on the values the block just wrote.
 *
 * ORDER, AND WHY THIS RUNS FROM postAnim: stepKnightAnim runs the hurt tick
 * (knight.js:337-366, the translation of scr_enemy_hurt) BEFORE its blockanim
 * block, on the pre-block values; the GML ticks AFTER the block. This tail
 * runs right after stepKnightAnim (kaizo-vc-hooks.js postAnim, same frame)
 * and writes what the GML Step leaves for the Draw:
 *   * the flip frame (blockanim 2 with blocktimer 1 — knight.js increments
 *     the clock in the same call that zeroes it, as Step_0:149-151 does):
 *     whiteflash 2 (the sim's decrement at knight.js:319 already ran this
 *     frame, so the renderer sees 2 then 1 — the game's two drawn frames),
 *     hurttimer 30 - 1, state 3, shakex 5 then the walk iff scr_enemy_hurt's
 *     half-rate gate fires this Step. The gate reads the hurtshake the sim's
 *     own tick read (the block does not touch hurtshake): the sim's tick
 *     fired iff it left hurtshake at 0 (else-branch, state still 3), or
 *     would fire iff hurtshake >= 1 when the sim's tick took the `< 0`
 *     branch (a re-arm on the frame hurttimer expired — GML re-arms to 30
 *     first and takes the else-branch).
 *   * the block's last frame (blockanim just zeroed): hurttimer 0, then the
 *     tick to -1 and state 0 — no shake walk on that branch, so the walk
 *     the sim's tick already took this frame is undone and hurtshake
 *     restored. If the Knight was not in state 3 the tick is skipped and
 *     hurttimer stays 0, as Step_0:1306 gates it.
 * The two block_ol ghosts are obj_afterimage instances (sim/fx.js
 * afterimage — fadeSpeed 0.04 from its Create, builtinMotion): scr_afterimage
 * copies sprite/index/blend/scale/angle off the Knight and `depth = depth`,
 * the `with` then overrides sprite, depth + 1 and gives them `vspeed = ±3`
 * (speed 3, direction 270 / 90 in GameMaker's y-down frame) with friction
 * 0.15 — spawned here in the endStep, so their first own Step is a frame
 * later than the game's (the same one-phase skew sim/actors.js's every-4th-
 * frame ghost carries). They are untraced and not bullets: the byte gate
 * does not move. NOT carried: the sound (kaizo snd_metal_hit where knight.js
 * cues snd_bell — audio, sim-owned) and the every-frame `hurtshake` value
 * beyond what the Draw can see.
 */
export function kaizoBlockStepTail(state) {
  const k = state.knight;
  if (!k) return;
  const kz = (state.kaizo ??= {});
  const prev = kz.blockanimPrev ?? 0;
  const b = k.blockanim ?? 0;

  if (b === 2 && k.blocktimer === 1) {
    // Step_0:128, :131-133 — then scr_enemy_hurt() at :1309 on those values.
    const fired = k.animState === 3
      ? k.hurtshake === 0
      : (k.hurtshake ?? 0) >= 1;
    k.whiteflash = 2;
    k.animState = 3;
    k.hurttimer = 30 - 1;
    k.shakex = 5;
    if (fired) {
      // `if (shakex > 0) shakex -= 1; ... shakex = -shakex; hurtshake = 0;`
      k.shakex = -(5 - 1);
      k.hurtshake = 0;
    } else {
      k.hurtshake = 1;
    }
    // Step_0:134-147 — the two block_ol ghosts, at the Knight's Step-time
    // position (his y is last frame's Draw bob, which is what `x, y` read).
    const e = state.entities.find((x) => x.alive && x.type?.name === 'obj_knight_enemy');
    if (e) {
      for (const vspeed of [3, -3]) {
        const g = spawn(state, afterimage, { x: e.x, y: e.y });
        g.sprite_index = 'spr_roaringknight_block_ol';
        g.image_index = e.image_index ?? 0;
        g.image_blend = e.image_blend;
        g.image_speed = 0;
        g.image_xscale = e.image_xscale ?? 1;
        g.image_yscale = e.image_yscale ?? 1;
        g.image_angle = e.image_angle ?? 0;
        g.depth = (e.depth ?? 0) + 1;
        g.speed = 3;
        g.direction = vspeed > 0 ? 270 : 90;
        g.friction = 0.15;
      }
    }
  }

  if (prev === 2 && b === 0) {
    // Step_0:186 `hurttimer = 0`, then :1306-1310's tick if state == 3.
    if (k.animState === 3) {
      // Undo the walk the sim's tick took this frame (GML takes the `< 0`
      // branch here and does not walk): it fired iff hurtshake is 0 now.
      if (k.hurtshake === 0) {
        let s = -(k.shakex ?? 0);
        if (s > 0) s += 1;
        if (s < 0) s -= 1;
        k.shakex = s;
        k.hurtshake = 1;
      } else if ((k.hurtshake ?? 0) > 0) {
        k.hurtshake -= 1;
      }
      k.hurttimer = -1;
      k.animState = 0;
    } else {
      k.hurttimer = 0;
    }
  }

  kz.blockanimPrev = b;
}

/**
 * `idlesprite = spr_roaringknight_idle2` — the B-Side recolour, and it is
 * EARNED rather than default: the mod's Step swaps it only inside its
 * `k_sideb` no-hit branch (Step_0:687-695, guarded by `progamer == true`),
 * i.e. the Knight changes appearance once you are provably running a
 * flawless Weird Route.
 *
 * Exported as a function rather than applied in the step above because the
 * condition belongs to the no-hit tracking the scene owns, not to the actor:
 * wiring it here would put the reward on screen for every B-Side run. It is
 * called from kaizo/scenes/kaizo-vc-hooks.js sidebTurnEndMessages, at each of
 * the four sites the GML writes it.
 *
 * IT TAKES THE STATE AND FINDS THE INSTANCE. `idlesprite` is an
 * obj_knight_enemy instance variable, so the entity is where the reader looks
 * (kaizoIdlesprite above, and through it the ghost rewrite and the Draw
 * port). The message block wrote it on state.knight — the fight-logic record,
 * which is a different object — so all four writes landed somewhere nothing
 * reads and the reward never appeared. Resolved by giving the writer no
 * choice about which object it means.
 */
export function applyKaizoIdleRecolor(state) {
  const e = state?.type ? state : state?.entities?.find(
    (x) => x.alive && x.type?.name === 'obj_knight_enemy',
  );
  if (e) e.idlesprite = 'spr_roaringknight_idle2';
  return e ?? null;
}
