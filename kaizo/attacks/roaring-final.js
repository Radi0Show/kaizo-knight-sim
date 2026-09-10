// KAIZO obj_knight_roaring2 — ROARING under EnderCat8's Kaizo Roaring Knight
// v2.3.3, including the mod's NEW "Roaring DELTA" finale (choice 104,
// controller type 107, invc 0.5).
//
// *** V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// *** without permission. (kaizo/HANDOFF.md §5 V-C publish gate.)
//
// METHOD: this file is a COPY of the verified sim module
// sim/attacks/roaring.js with ONLY the mod's deltas applied. Every line the
// mod did not touch is byte-identical to the sim module; every divergence
// below carries the kaizo GML file + line it translates. Unchanged helpers,
// bullets and effects are imported from ../../sim/.
//
// PROVENANCE — read line by line for every branch below:
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_knight_roaring2_Create_0.gml   (kaizo 53-73)
//     gml_Object_obj_knight_roaring2_Step_0.gml     (kaizo 1-5, 369-372)
//     gml_Object_obj_knight_roaring2_Other_11.gml   (kaizo 1-957 — NEW)
//     gml_Object_obj_knight_roaring2_Other_10.gml   (diffed: NO mod deltas)
//     gml_Object_obj_knight_roaring2_CleanUp_0.gml  (kaizo 17-20, 38-51)
//     gml_Object_obj_knight_roaring2_Other_22.gml   (NEW — the HP HUD, DRAW)
//     gml_Object_obj_knight_roaring2_Draw_0.gml     (visual only, see below)
//     gml_Object_obj_knight_enemy_Other_12.gml      (the star catch retune —
//                                                    implemented in
//                                                    ./roaring-final-star.js)
//   Delta specs: knight-research/kaizo-mod/deltas/ (same names, .md).
//   Diffed event-by-event against gml_vanilla_v105/.
//
// ── Other_10 IS NOT A MOD DELTA. ─────────────────────────────────────────
// `diff gml_vanilla_v105 gml_kaizo_dump` on obj_knight_roaring2's Other_10
// (the roar's alarm-side twin of the Step) returns THREE hunks and all three
// are `knight_sprite = 4962 -> 4959` / `4320 -> 4318` — v105 -> v091 asset
// INDEX SHIFTS, listed in kaizo-mod/base-artifacts.txt, not mod content. The
// sim module already stores these as sprite NAMES
// (spr_roaringknight_front_flourish / _front_slash), so the shift is
// unrepresentable here and the vanilla translation is already complete and
// correct. Nothing to do; recorded so the next reader does not re-derive it.
// The same three shifts are the only Step_0 hunks besides the two below.
//
// ── DIVERGENCES FROM sim/attacks/roaring.js, exhaustively ────────────────
//  1. create: the mod's Create hunk (kaizo Create_0:53-73) — `roaring_type`
//     (1 when obj_knight_enemy.myattackchoice == 104), `fix_draw`, the
//     finale's `final_con / final_lines / final_xs / hideback / fake_xoff /
//     fake_yoff / final_hit`, the HUD's `hp_surf / hp_alpha / hp_visible /
//     hp_y`, and `with (obj_knight_enemy) scr_screenshatter_clear()` — which
//     runs on EVERY roaring2 create, both modes.
//  2. step: the mod's top-of-event dispatch (kaizo Step_0:1-5) —
//     `if (roaring_type == 1) { event_user(1); exit; }`. In final mode NONE
//     of the vanilla Step runs; Other_11 (roaringFinal below) is the Step.
//  3. step: `with (obj_heart) mask_index = spr_dodgeheart_smaller_2px_mask`
//     as the first statement of the roar burst's `roaring_timer == 9` block
//     (kaizo Step_0:369-372) — the VANILLA roaring turn gets a 2px-smaller
//     soul for the rest of the roar.
//  4. the star module is the kaizo one (./roaring-final-star.js): it carries
//     `spec`, the con-101 burst, and the mod's retuned star catch.
//  5. NEW below the sim module's body: the whole Other_11 finale, its two
//     new marker objects, and the mod's scr_damage_all_maxhp wrapper.
//
// ── VISUAL DELTAS NOT DRAWN (noted per the project law) ──────────────────
// None of these consume RNG, so nothing in the shared stream moves:
//   * Draw_0's whole diff — the roaring_type/B-Side hue walk split, the
//     B-Side 5-colour vortex ramp, `image_blend` on obj_afterimage_grow, and
//     the `fix_draw` final-slash render path (the red-outlined lines + the
//     knight at `2 * final_xs`). The Draw-side BOOKKEEPING those branches
//     advance (hsv / hsv_switch / ball_counter / intensify) IS run, because
//     the renderer reads it and the sim module already owns those fields.
//   * Other_22 in full — the 3-slot party HP HUD (surface, icons, bars,
//     B-Side gloom overlay). Its STATE is kept (`hp_visible` is switched on
//     by the star catch, `hp_y` slides 48 -> 0 here) so a renderer can pick
//     it up unchanged; nothing headless reads it.
//   * every `scr_afterimage_grow()` bloom in Other_11 — EXCEPT the two
//     `random_range(-8, 8)` draws inside the attack_con-2 knight ghost,
//     which ARE consumed (bare draws, no entity), and the three
//     obj_afterimage_screen / obj_knight_circle spawns, which are real sim
//     entities and are made.
//   * the in-rush `obj_particle_generic` streaks — both irandom draws are
//     taken, the particle is not made. Same reading and the same player
//     report the sim module documents at its own streak site.
//   * the `spr_whitepx` full-screen flash at knight_sprite_image 3.5.
//   * every audio call. `sound` is modelled as a plain truthy handle so the
//     GML's `sound != -4` gate is faithful; the beam's track-position rewind
//     and gain ramp are audio-only and skipped.
//
// ── STUBS / DEVIATIONS IN THE FINALE (all labelled at the site) ──────────
//   * `room_goto(PLACE_FAILURE)` on the scripted party wipe — there is no
//     room system here. Translated as `state.kaizo.finalFailure = true` AND
//     a turn release, so the schedule cannot deadlock. See the site.
//   * CleanUp_0 is a `cleanUp(e, state)` on the type (2026-09-08): the engine
//     fires it on every destroy(e, state), the turn sweep included
//     (sim/entity.js). Its `with (obj_growtangle) instance_destroy()` is the
//     one line NOT taken — this engine keeps ONE obj_growtangle for the whole
//     fight (fight.js SURVIVES_TURN; openVCArena re-arms it and bails without
//     one), so the collapse both modes already run stands in. See cleanUp.
//
// ────────────────────────────────────────────────────────────────────────
// The sim module's own header, still true of every copied line:
//
// obj_knight_roaring2 — ROARING (ac 9, dc.type 107), the phase 4 finale.
//
// The controller's whole GAMEPLAY timeline is translated: the intensity ramp,
// the soul pull, the star rings and their spiral, the corral, and the roar.
// Verified against the recording to frame 678 — see docs/STATUS.md.
//
// THREE CLOCKS, in sequence, and each hands over to the next:
//
//   timer          the intro. Nothing here runs until it passes 128.
//   intensity      a RAMP, not a counter: scr_approach(intensity, 4, 0.008).
//                  Drives the ring cadence, the ring shape, and the corral.
//   roaring_timer  only advances once intensity has CLAMPED at exactly 4.
//                  This is the roar, and it inverts the attack.
//
// THE PULL IS THE ATTACK'S REAL MECHANIC, not a visual. Every frame past
// `timer > 128`:
//
//     player_suck = scr_approach(player_suck, 1, 0.1625)   // while ramping
//     player_suck = scr_approach(player_suck, 0, 0.15)     // every frame
//     tempdir = point_direction(heart.x + 10, heart.y + 10, TARGET)
//     obj_heart.x += lengthdir_x(player_suck, tempdir)
//     obj_heart.y += lengthdir_y(player_suck, tempdir)
//
// Both approaches run, in that order. `player_suck` therefore settles at
// **0.85**, not at 1: the up-step saturates at 1 and the down-step
// immediately takes 0.15 off, so the value the rest of the frame sees — and
// the value the recorder writes — is 0.85 forever after. Measured: 0.5 at
// frame 126, 0.6125, 0.85 by 170, and 0.85 held to the end of the recording.
//
// The soul is dragged until `(x + 10, y + 10)` sits on the target, which is
// `(camerax() + fake_x, cameray() + fake_y + 55)` — with fake_x 320 and fake_y
// settling at 88, that is (320, 143). The recording shows the soul parked at
// (310, 133.3), which is exactly that.
//
// `intensity >= 3.7` SILENCES THE RING BLOCK rather than changing it — the
// spawn gate is `starcount_p1 == 1 && intensity < 3.7`, so above 3.7 no branch
// fires at all and the attack simply waits for intensity to reach 4. Reading
// the block expecting a third ring variant there finds nothing; the content is
// in the roar below.
//
// The 282-line Draw event IS ported now (render/draw/roaring.js), along with
// the roaring_timer 275 wind-up. NOT translated: the `do_fake_screen` finale at
// roaring_timer 299, which snapshots the composite into two sprites and flings
// them apart as the screen is cut.

import { spawn, destroy } from '../../sim/entity.js';
import {
  lengthdirX, lengthdirY, pointDirection, pointDistance, scrApproach, gmlEq,
  gmlLte, lerp, sign,
} from '../../sim/gml.js';
import {
  gmlChoose, gmlIrandom, gmlIrandomRange, gmlRandom, gmlRandomRange,
} from '../../sim/rng.js';
import { scrLerpvar } from '../../sim/lerpvar.js';
import { cue, cueSustain, cueTune, cueStop } from '../../sim/audio.js';
// KAIZO: the mod's star (spec, the con-101 burst, the retuned catch) — the
// SAME export symbol as sim/attacks/roaring-star.js, so nothing else changes.
import { roaringStar } from './roaring-final-star.js';
// UNCHANGED by the mod (Draw_0/Other_15 deltas are cosmetic + the shared
// damage retune) — imported straight from the verified sim module.
import { roaringknightSlash } from '../../sim/attacks/roaringknight-slash.js';
import { scrBulletInherit } from '../../sim/bullets/regularbullet.js';
import {
  screenPiece, scrAfterimage, knightCircle, particleGeneric, afterimageScreen,
  afterimageGrow,
} from '../../sim/fx.js';
// ── KAIZO-ONLY imports, all used by the Other_11 finale below ────────────
import { masksOverlap, HEART_MASK } from '../../sim/masks.js';
// G2 (2026-09-08): the finale's `scr_damage_all_maxhp(0.75, 1, 0)` is the
// MOD's script (kaizo gml_GlobalScript_scr_damage_all.gml:30-55) calling the
// MOD's scr_damage_maxhp (gml_GlobalScript_scr_damage_maxhp.gml), which is
// not the vanilla one: `progamer = false` on any hit (5-9), the targeting
// block gated `!i_ex(obj_knight_roaring2)` (60), B-Side `_gloomdmg =
// ceil(tdamage / 4); tdamage = ceil(tdamage * 0.8)` (170-174) and a gloom
// accrual with NO 45 cap (245-261). The faithful copy is kaizo/party/
// damage.js. This used to import the VENDORED VANILLA scrDamageMaxhp from
// sim/damage.js and re-implement the wrapper locally — wrong by every B-Side
// number. Routed, not re-derived.
import { scrDamageAllMaxhp } from '../party/damage.js';
// The party-wipe test and its 1-HP restore are CHARACTER-indexed in the GML
// (`scr_havechar(c) / global.hp[c]`, c = 1..4): read through the roster, never
// through a third partyHp index a two-person party does not have.
import {
  havechar, hpOfChar, setHpOfChar, buildRoster, NORMAL_ROUTE_PARTY,
} from '../party/roster.js';
// The mod's two extracted masks already live in the kaizo tree — reused
// rather than re-derived, so there is ONE geometry for each in kaizo/.
// FINALSLASH_MASK: 10x10, origin (5,5), maskcount 0 -> solid bbox rect.
// HEART_2PX_MASK: the real extracted 20x20 precise heart inset to [4,4]..[15,15].
import { FINALSLASH_MASK, HEART_2PX_MASK } from './knight-stream.js';
import {
  screenshatterCreate, screenshatterClear,
} from './roaring-final-shatter.js';

/**
 * GML COLOUR CONSTANTS AS THE RENDERER TAKES THEM. `c_red` / `c_black` /
 * `c_white` are GameMaker integers (BGR: 255, 0, 16777215); the renderer's
 * generic blit multiplies `image_blend` through render/draw/gm.js `tinted()`,
 * which requires an [r, g, b] ARRAY and throws a TypeError on anything else
 * — deliberately, because an invalid fillStyle is otherwise a silent no-op
 * (gm.js:44-56). The four finale sites below used to carry the constant's
 * NAME as a string ('c_red'), which no sim check can see (image_blend is not
 * a traced column) and which killed the kaizo page's draw loop on the first
 * frame a finale line reached the blit — found by
 * kaizo/tools/checks/check-render-smoke-kaizo.mjs's HP-gated finale run
 * (frame 4225 at seed 12345) the day the seam went in. Same shape as
 * sim/attacks/sword-tunnel-revised.js:168's `[255, 0, 0]`.
 */
const C_RED = [255, 0, 0];
const C_BLACK = [0, 0, 0];
const C_WHITE = [255, 255, 255];

/**
 * The width of `spr_pixel_white_front` — the sheet the in-rush streaks are
 * drawn from, 4x4 with its origin on the right edge. Dividing the streak's
 * `image_xscale` by it turns the dump's 320 from "320 sheets" (1280px, twice
 * the view) into "320 pixels", which is the distance the particle actually
 * covers. See the note at the spawn site: this is a deviation, on a report
 * from play, not a reading.
 */
const STREAK_UNIT = 4;

export const roaring2 = {
  name: 'obj_knight_roaring2',

  create(e, state) {
    // `scr_darksize();` — Create_0 LINE 1, and it is the whole of that
    // script: `inst.image_xscale = 2; inst.image_yscale = 2;`
    // (gml_GlobalScript_scr_darksize.gml). So this instance is scale 2 from
    // the instant it exists, before any Step of its own or anyone else's.
    //
    // MEASURED: the recorded seq's creation row for obj_knight_roaring2 is
    // xscale/yscale 2 on all five locked launches of the 2026-09-09
    // recordings (A and B side), and this module carried the assignment in
    // its STEP instead, so the birth frame read the engine default 1 —
    // check-oracle-roaringdelta's first CREATION VALUES divergence. Nothing
    // in the finale reads the phantom's own scale (it is drawn from
    // fake_x/fake_y), but its `sprite_width` does, and the step re-assert
    // this replaces had no line behind it in either dump: the mod's Step
    // writes image_xscale only inside `with` blocks aimed at the arena and
    // the stars (Step_0:39-63, 163-164 — `other.timer` there is this
    // instance).
    e.image_xscale = 2;
    e.image_yscale = 2;

    // Create: image_speed = 0. The knight's frames are driven by
    // knight_sprite_speed instead, so leaving the default 1 here made the
    // engine walk image_index underneath that as well.
    e.image_speed = 0;
    e.image_index = 0;

    // `y -= 320;` — Create_0:46, vanilla and kaizo alike. The controller
    // (kaizo dbulletcontroller Step_0:2259) births this instance AT THE
    // KNIGHT (`instance_create(creatorid.x, creatorid.y, ...)`) and Create
    // hoists it 320 above him: the recorded row is `470, obj_knight_roaring2,
    // 425, -242.76` from a knight at y 77.24 (seq_roaringdelta). Nothing in
    // the finale reads this position — the phantom is drawn from
    // fake_x/fake_y — but a seq diff does, and Draw_0:17's draw_self() is off
    // screen only because of it. The vendored sim module spawns at
    // (view+320, view+88) and never hoists; this copy takes the launcher's
    // knight position (kaizo-mod-launcher.js case 107) and the hoist.
    e.y -= 320;

    // `obj_knight_enemy.chargeupcon = 2` — the launch hides the white
    // charged knight (instantly, in effect: sim/knight.js has the dead-fade
    // note). The CleanUp below restores him.
    if (state.knight) {
      state.knight.chargeupcon = 2;
      // ...AND ZERO THE TIMER. obj_knight_roaring2's Create is two lines:
      //
      //     obj_knight_enemy.chargeupcon = 2;
      //     obj_knight_enemy.chargeuptimer = 0;
      //
      // Only the first was translated, so the burn-out started with the
      // ~185 left over from the charge-up turn: `chargeuptimer >= 10` was
      // already true, con flipped to 3 on the FIRST frame, and the ten-frame
      // white fade played as a single frame. The draw log caught it as
      // 1 burnout row against the game's 10.
      state.knight.chargeuptimer = 0;
    }

    e.timer = 0;
    e.intensity = 1.5;
    e.attack_timer = 0;
    e.roaring_timer = 0;
    e.player_suck = 0.5;
    // camerawidth() * 0.5, and the intro tween's settled value.
    e.fake_x = 320;
    e.fake_y = 24;
    // `fake_alpha = 0` — THE PHANTOM STARTS INVISIBLE. It was never
    // initialised here, and the renderer's `e.fake_alpha ?? 1` then drew the
    // scanline knight at FULL alpha for the first 80 frames, until the
    // timer-80 lerp reset it to 0 and faded it in again. Reported from play
    // as the knight appearing, then appearing a second time — which is
    // exactly what it was doing.
    e.fake_alpha = 0;
    // `rand_angle = irandom(360)` — IN THE ORIGINAL'S CREATE, so the draw is
    // taken here and not by the caller. It was left at 0 with a note saying
    // the scene would replay it, and only ONE scene ever did: sim/scenes/
    // fight.js. The whole-fight runner builds the PRACTICE scene, which never
    // set it, so every ROARING in a full fight fired its star rings from a
    // base of 0 while the game fired from a random one.
    //
    // Invisible until the camera work pushed verify37's front this far: at
    // f11269 the six ring stars sat on the right circle, 60 degrees apart,
    // uniformly 2 degrees off — the token's roll happened to be 58, and 58
    // minus a whole 60-degree step is what that 2 degrees was.
    //
    // Position in the stream matters as much as the value: irandom is two
    // draws, and taking them at Create is what the runner does.
    e.rand_angle = gmlIrandom(state.gmlRng, 360);
    // ONE U32 DRAW IS MISSING BEFORE THIS ROLL, and it is CONDITIONAL.
    // verify37's front sits on the six-star ring at f11269: the ring is right
    // (radius 590, 60 degrees apart) but rotated, because rand_angle is 220
    // here and 278 in the game. The anchor is correct (n=27, seed 27037) and
    // 278 is exactly what this roll returns after THREE u32 draws off that
    // anchor, where the sim takes two (obj_dbulletcontroller's basedir).
    //
    // Do NOT pad it unconditionally: measured, a single extra draw here moves
    // verify37 to f11726 AND makes the camera match on every one of its
    // 12,007 frames -- and BREAKS verify21j, which is byte-exact today, at
    // f11274. So the third draw happens in token 37's roar and not token
    // 21's. Launch conditions look identical in both (no live bullets, inv
    // -5, full party), so what varies has not been found yet. Attribute it
    // before adding it; this project has been burnt by blind pads twice.
    e.rand_dist = 320;
    e.starcount_p1 = 0;
    e.starcount_p2 = 0;
    e.spinspeed = 1;
    e.star_angle1 = -1;
    e.star_angle2 = -1;
    e.star_angle3 = -1;
    e.ball_speed = 0;
    e.ball_darkness = 0;
    e.ballDarknessDelay = 0;

    // ---- Draw-event state ---------------------------------------------------
    //
    // Every field below is read (and most are advanced) by obj_knight_roaring2's
    // Draw event. They live here rather than in the renderer because the
    // original stores them on the instance and because a renderer that mutated
    // them would not be reproducible headlessly — the same reason the cone's
    // `con` advance is in sim/. See CLAUDE.md, "Draw events run gameplay".
    e.darkness = 0;         // the whole effect fades up from black
    e.star_flicker = 2;     // alternates 0/2 so the grate's scanlines crawl
    e.intensify = 1.5;      // drives the knight's per-scanline wobble
    e.line_timer = -1;      // -1 until the pre-cut marker starts, then counts
    e.r = 128;
    e.g = 128;
    e.b = 128;
    e.bobble_count = 0;
    e.bobble_freq = 1;
    e.bobble_amp = 4;
    e.ball_counter = 0;
    e.hsv = 128;            // cycles 128..288, which is the vortex's hue sweep
    e.hsv_switch = false;
    e.stop = false;
    e.do_fake_screen = false;
    e.jumpimages = false;
    e.jumpUpDelay = -1;
    e.jumpUpFrom = 0;

    // `scr_script_delayed(scr_lerpvar, 20, "darkness", 0, 1, 32)` — Create's
    // last line. The screen does not go black instantly; it takes 32 frames,
    // starting 20 frames in.
    e.darknessDelay = 20;
    // Create lines 28-30. Asset ids in the original; 664 is
    // spr_roaringknight_front, resolved from the sprite metadata dump.
    e.knight_sprite = 'spr_roaringknight_front';
    e.knight_sprite_image = 0;
    e.knight_sprite_speed = 0.5;
    /** ds_list of stars caught at roaring_timer 181, released one per frame. */
    e.bullet_list = [];

    // `obj_heart.boundaryup = 160` — Create, line 45. It reads like a ceiling
    // and is actually a RAISED FLOOR: the soul's own clamp is
    // `view.y + 320 - sprite_height + boundaryup`, so this moves the lower
    // limit from 300 down to 460.
    //
    // It only matters once the ROAR reverses the pull and shoves the soul out
    // of the arena. Without it the clamp catches the soul at y 300 and drags
    // it back a pixel a frame, against a recording that sails straight past —
    // which is exactly how it was found, at frame 536.
    if (state.soul) state.soul.boundaryup = 160;

    // ══ KAIZO Create_0:53-73, appended after vanilla's last line ═════════
    //
    //     roaring_type = 0;
    //     fix_draw = 0;
    //     if (obj_knight_enemy.myattackchoice == 104) { roaring_type = 1; ... }
    //     hp_surf = -4; hp_alpha = 0.5; hp_visible = 0; hp_y = 48;
    //     with (obj_knight_enemy) scr_screenshatter_clear();
    //
    // THE GATE IS THE ATTACK ID, not the difficulty: the mod's selector
    // (obj_knight_enemy Other_23) assigns myattackchoice = 104 for the
    // "Roaring DELTA" row and 9 for its ordinary roaring turns, and BOTH
    // launch controller type 107. A roaring2 that finds anything but 104
    // stays roaring_type 0 and runs the vanilla Step/Other_10 above,
    // untouched.
    // `sound = -4;` — VANILLA Create_0 line 39, which the sim module elided
    // because its audio goes through the cue system and nothing read the
    // handle. The finale DOES read it (`timer > 16 && sound != -4`), so the
    // field is restored here rather than in the vanilla body above, keeping
    // every copied line byte-identical.
    e.sound = -4;
    e.roaring_type = 0;
    e.fix_draw = 0;
    // `obj_knight_enemy.myattackchoice` — sim/scenes/fight.js keeps the
    // selector's choice on the state (state.currentAc), which is what the
    // V-C launcher sets before it spawns the controller.
    if (state.currentAc === 104) {
      e.roaring_type = 1;
      e.final_con = 0;
      e.final_lines = [];
      e.final_xs = 1;
      e.hideback = -4; // GM noone sentinel
      e.fake_xoff = 0;
      e.fake_yoff = 0;
      e.final_hit = 0;
      // NOT in the mod's Create. `final_kill` is written by attack_con 4's
      // attack_timer-2 block and read by attack_con 5, which can only run
      // after it — so GML never sees it unset. Initialised here because a
      // JS read of `undefined` would silently take the wrong branch if the
      // finale is ever entered part-way by a test. Behaviour-neutral.
      e.final_kill = 0;
    }
    e.hp_surf = -4;
    e.hp_alpha = 0.5;
    e.hp_visible = 0;
    e.hp_y = 48;
    // `with (obj_knight_enemy) scr_screenshatter_clear();` — unconditional,
    // both roaring modes. Wipes any glass left over from a previous shatter.
    screenshatterClear(state);
  },

  step(e, state) {
    // ══ KAIZO Step_0:1-5 — the finale dispatch, before anything else ═════
    //
    //     if (roaring_type == 1) { event_user(1); exit; }
    //
    // `exit` is total: no soul clamp, no intensity ramp, no ring cadence,
    // no roar. Other_11 IS the Step in final mode. Draw_0 and this object's
    // beginStep/endStep still run (the sim keeps the Draw's gameplay there).
    if (e.roaring_type === 1) {
      roaringFinal(e, state);
      return;
    }

    e.timer += 1;

    // THE STRETCH IS A PITCH RAMP — see cueSustain/cueTune in sim/audio.js.
    if (e.timer === 132) {
      e.stretchPitch = 0.1;
      cueSustain(state, 'snd_knight_stretch', e.stretchPitch);
    }
    // `audio_sound_pitch(sound, audio_sound_get_pitch(sound) + 0.000535)` — the
    // note bends upward every frame from 132 until the roar. Over the ~240
    // frames to roaring_timer 9 that is 0.1 -> roughly 0.23, slow enough that
    // you feel it building rather than hear it sliding.
    if (e.timer > 132 && e.stretchPitch !== undefined) {
      e.stretchPitch += 0.000535;
      cueTune(state, 'snd_knight_stretch', e.stretchPitch);
    }

    // THE ROAR CORRALS THE SOUL TO THE SCREEN. The Step's very first block,
    // before anything else it does:
    //
    //     with (obj_heart) {
    //         if (x < camerax())                        x = camerax();
    //         if (x > camerax() + camerawidth() - 20)    x = camerax() + camerawidth() - 20;
    //         if (y < cameray())                         y = cameray();
    //         if (y > cameray() + cameraheight())        y = cameray() + cameraheight() - 20;
    //     }
    //
    // This is the attack's arena: the battle box is gone, and the WHOLE
    // SCREEN becomes the floor, with the pull dragging you across it. Without
    // the clamp the soul could be shoved off the edge entirely and sit there
    // for the rest of the roar, which is what it was doing — parked in a
    // corner, out of play, while the attack happened without it.
    //
    // Note the asymmetry, kept: the left and top clamps snap to the edge
    // exactly, the right and bottom to 20 inside it (the sprite's width).
    if (state.soul) {
      const vx = state.view.x;
      const vy = state.view.y;
      if (state.soul.x < vx) state.soul.x = vx;
      if (state.soul.x > vx + 640 - 20) state.soul.x = vx + 640 - 20;
      if (state.soul.y < vy) state.soul.y = vy;
      if (state.soul.y > vy + 480) state.soul.y = vy + 480 - 20;
    }

    // `if (jumpimages) scr_afterimagefast();` — Step line 20, ABOVE everything
    // else. One ghost per frame for the whole leap, which is what makes the
    // jump read as a streak rather than a teleport.
    if (e.jumpimages) {
      const g = scrAfterimage(state, e);
      g.sprite_index = e.sprite_index;
      g.image_index = e.image_index;
      g.fadeSpeed = 0.08; // scr_afterimageFAST — three times the usual 0.04
    }

    // Step lines 25-29, in their original order.
    if (e.line_timer > -1) e.line_timer += 1;
    e.bobble_count += e.bobble_freq;

    if (e.darknessDelay > 0) {
      e.darknessDelay -= 1;
      if (e.darknessDelay === 0) scrLerpvar(state, spawn, e, 'darkness', 0, 1, 32);
    }

    // THE COLOUR. This one line is the whole reason the roar looked black:
    //
    //     if (timer == 118)
    //         scr_script_delayed(scr_lerpvar, 16, "ball_darkness", 0, 1, 32, 1, "out");
    //
    // `ball_darkness` is the ALPHA the Draw composites the vortex at —
    // `draw_surface_part_ext(ball_surface, ..., color, ball_darkness)` — and
    // it starts at 0. Without this it stays 0 for the entire attack, so the
    // tiled `spr_knight_bullet_flow`, the six expanding rings that cut it into
    // a vortex, the per-row sine ripple and the cycling HSV hue were all
    // computed, composited and then multiplied by zero. Every layer was
    // there; none of it reached the screen. Reported twice from play as the
    // roar missing its background colours.
    //
    // It fades in from timer 134 (118 + the 16-frame delay) over 32 frames on
    // ease_out curve 1 — arriving just as the stretch note starts bending.
    // FIFTEEN, NOT SIXTEEN, and the recording is what says so.
    //
    // `scr_script_delayed(scr_lerpvar, 16, ...)` arms an alarm 16 frames out.
    // GameMaker's event order is Alarms BEFORE Step, so the obj_lerpvar that
    // alarm creates gets its own first Step on that SAME frame — its first
    // write lands 16 frames after the cue. This engine freezes the entity list
    // at the start of each phase (sim/entity.js), so a tween spawned here does
    // not step until the next frame; counting 15 puts the first write back on
    // frame 16 where the game has it.
    //
    // Checked against the trace, not reasoned into place: the fade-OUT is cued
    // at frame 411 and `traces/roaring2.csv` has ball_darkness 0.9509323257 at
    // frame 427, which is exactly `1 - sin((1/32) * pi/2)` — one frame of a
    // 32-frame ease_out-curve-1 lerp, sixteen frames after the cue. At 16 the
    // first write fell on 428 and every frame after was one behind.
    const DELAYED_TWEEN = 15;
    if (e.timer === 118) { e.ballDarknessDelay = DELAYED_TWEEN; e.ballDarknessTo = 1; }
    if (e.ballDarknessDelay > 0) {
      e.ballDarknessDelay -= 1;
      if (e.ballDarknessDelay === 0) {
        const to = e.ballDarknessTo ?? 1;
        scrLerpvar(state, spawn, e, 'ball_darkness', 1 - to, to, 32, 1);
      }
    }
    // It fades back OUT the same way at `intensity == 3.66` — see the gmlEq
    // block below, which is where that equality is handled.

    // WHERE THE KNIGHT IS DRAWN. obj_knight_roaring2's own instance sits off
    // screen (the recording has it at y -242 all turn); the knight you see is
    // drawn by its Draw event at `camerax() + fake_x, cameray() + fake_y`.
    // The renderer reads these two fields so the figure appears centre-stage
    // as it does in the game, without moving the instance and breaking the
    // verified geometry that keys off `fake_y`.
    e.renderX = state.view.x + e.fake_x;
    e.renderY = state.view.y + e.fake_y;

    // IT IS `knight_sprite` THAT IS DRAWN, not `sprite_index`. The Draw event
    // builds the figure out of `knight_sprite` / `knight_sprite_image`, one
    // scanline at a time with a per-row sine wobble, and never touches
    // `sprite_index` — which stays on the generic attack pose all turn.
    //
    // Using sprite_index put the ATTACK pose on screen for the whole of
    // Roaring, which is the same pose Flurry and rotating slash wear. The real
    // progression is a different sprite entirely, and it changes four times:
    //
    //   Create              spr_roaringknight_front, advancing at 0.5
    //   intensity == 3.74   spr_roaringknight_front_flourish, held
    //   roaring_timer 15    spr_roaringknight_front_roar, advancing at 0.5
    //   roaring_timer 181   spr_roaringknight_front_flourish, held
    //   roaring_timer 275   spr_roaringknight_front_slash
    //
    // The renderer draws `knight_sprite` at (fake_x, fake_y); the per-scanline
    // wobble is not reproduced (see docs/STATUS.md).
    e.knight_sprite_image += e.knight_sprite_speed;
    // `sprite_index` AND `knight_sprite` ARE TWO DIFFERENT SPRITES, and this
    // used to copy one onto the other every single step.
    //
    //   sprite_index    what `draw_self()` draws — the instance's own sprite
    //   knight_sprite   a NUMERIC id, drawn row by row by the scanline
    //                   `draw_sprite_part_ext` calls
    //
    // The Step assigns them separately and to different values (rt 275 sets
    // `sprite_index = spr_roaringknight_front_slash` and `knight_sprite =
    // 4320` on adjacent lines). Copying knight_sprite over sprite_index broke
    // the attack's LAST beat: at roaring_timer 363 the knight is supposed to
    // rematerialise at his battle spot as `spr_knight_warp`, frames 5 -> 8
    // over 8 frames — and this line overwrote that on the very next frame, so
    // for the twelve frames before the real knight returns he was drawn as
    // the slash pose at an image_index the lerp had walked past the end of
    // the sheet, wrapping to garbage. Reported from play as the knight
    // appearing weirdly a second or two after the screen slash.
    //
    // The renderer already reads `knight_sprite` directly for the scanline
    // rows (drawKnightRows), so nothing needed it copied here.
    // (scr_darksize's scale is set in Create, where the GML has it — see the
    // note there. A per-frame re-assert lived here with no line behind it.)

    // THE KNIGHT HIDES HIMSELF. obj_knight_roaring2 never touches his
    // image_alpha — his own Draw does it, at the end of the con-2 burn-out
    // (`if (chargeuptimer == 10) { chargeupcon = 3; image_alpha = 0; }`).
    // Forcing it to 0 here every frame — the stand-in for a fade this file
    // wrongly believed was dead — overwrote the burn-out on its first frame,
    // so he vanished instantly instead of over ten. He is restored at
    // roaring_timer 375 (below), which IS the CleanUp's job.

    // THE INTRO, which the oracle scene never exercised because it starts at
    // frame 149 with the settled values already seeded. In a real turn these
    // two beats are what put the attack where it belongs, and without them
    // Roaring played 64px too high inside a battle box that never opened.
    if (e.timer === 30) {
      // The arena expands to swallow the screen: 2560 x 1920 against the box's
      // CURRENT scaled size, which at the default xscale 2 works out to 17.07
      // and 12.8 — exactly the values the recording holds for the whole turn.
      const gt = state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
      if (gt) {
        const sw = 75 * gt.image_xscale;
        const sh = 75 * gt.image_yscale;
        scrLerpvar(state, spawn, gt, 'image_xscale', gt.image_xscale, 2560 / sw, 160, 1);
        scrLerpvar(state, spawn, gt, 'image_yscale', gt.image_yscale, 1920 / sh, 160, 1);
      }
    }

    if (e.timer === 80) {
      // The knight rises into position. Everything this attack aims at is
      // `cameray() + fake_y + 55`, so until this runs the pull, the spiral and
      // the star rings all converge on the wrong point.
      e.fake_alpha = 0;
      scrLerpvar(state, spawn, e, 'fake_alpha', 0, 1, 48, 1);
      scrLerpvar(state, spawn, e, 'fake_y', 24, 88, 48, 2);
    }

    if (e.timer <= 128) return;

    e.intensity = scrApproach(e.intensity, 4, 0.008);

    // THE TWO INTENSITY GATES, and they are the reason `gmlEq` exists.
    //
    //     if (intensity == 3.66) { ...ball_darkness 1 -> 0, a white circle... }
    //     if (intensity == 3.74 && knight_sprite == 664) { ...the flourish... }
    //
    // Both test EXACT EQUALITY against a value built by repeated `+= 0.008`
    // from 1.5, and both fire in the real game — GML compares reals with a
    // tolerance, JS `===` does not. This was previously read two different
    // wrong ways (a `>=` rewrite here, a "dead branch" retraction there); see
    // sim/gml.js's gmlEq for the recording that settles it.
    //
    // NOTE the ORDER: 3.66 comes first, and its 16-frame delay means the
    // vortex starts fading out ten frames before he changes pose.
    if (gmlEq(e.intensity, 3.66)) {
      // `scr_script_delayed(scr_lerpvar, 16, "ball_darkness", 1, 0, 32, 1, "out")`
      e.ballDarknessDelay = 15; // see DELAYED_TWEEN above
      e.ballDarknessTo = 0;
      // The white bloom that covers the change: obj_knight_circle at the
      // knight's centre, black and 480 wide, its r/g/b_goal all lerping to
      // 255 over 48 frames while `size_goal` pulls it shut. `visible = false`
      // and `draw_in_box = false` — it is composited by the roar's own Draw
      // (the `with (obj_knight_circle) event_user(1)` pass), not by itself.
      const c = spawn(state, knightCircle, {
        x: state.view.x + e.fake_x,
        y: state.view.y + e.fake_y + 55,
      });
      c.r = 0; c.g = 0; c.b = 0;
      c.r_goal = 255; c.g_goal = 255; c.b_goal = 255;
      c.fade_time = 48;
      c.circle_size = 480;
      c.size_goal = 0;
      c.growth = 10;
      c.draw_in_box = false;
      c.visible = false;
      c.destroyAt = 48;
      scrLerpvar(state, spawn, c, 'r_goal', 0, 255, 48, 0);
      scrLerpvar(state, spawn, c, 'g_goal', 0, 255, 48);
      scrLerpvar(state, spawn, c, 'b_goal', 0, 255, 48, 1);
    }

    // THE SCREEN IS PULLED IN. Every third frame until the intensity is
    // nearly maxed, a copy of the WHOLE SCREEN is taken at a jittered point
    // near the vortex and shrunk toward it:
    //
    //     if ((timer % 3) == 0 && intensity < 3.9)
    //         with (instance_create(camerax() + fake_x + irandom_range(-30, 30),
    //                               cameray() + fake_y + 55 + irandom_range(-30, 30),
    //                               obj_afterimage_screen))
    //         { faderate = 0.1 / other.intensity; draw_end = true;
    //           xrate = -0.01; yrate = -0.01; }
    //
    // NEGATIVE rates, so the copies close INWARD — the screen itself being
    // dragged into the vortex, and the visual half of the `player_suck` that
    // is already dragging the soul there. The roar later uses POSITIVE rates
    // for the opposite reading. Missing entirely; reported as the attack
    // being short of effects.
    //
    // `faderate = 0.1 / intensity` means they last LONGER as it winds up
    // (0.1/1.5 clears 0.5 alpha in 8 frames; 0.1/3.9 takes 20), so the echoes
    // pile deeper the closer he gets to roaring.
    if (e.timer % 3 === 0 && e.intensity < 3.9) {
      // y jitter first: GML evaluates call arguments RIGHT-TO-LEFT (measured on
      // the kaizo swordfall, kaizo/attacks/swordfall.js dropSword). Same draw
      // count, so no trace moves -- only where the echo lands.
      const ay = state.view.y + e.fake_y + 55 + gmlIrandomRange(state.gmlRng, -30, 30);
      const ax = state.view.x + e.fake_x + gmlIrandomRange(state.gmlRng, -30, 30);
      const g = spawn(state, afterimageScreen, { x: ax, y: ay });
      g.faderate = 0.1 / e.intensity;
      g.draw_end = true;
      g.xrate = -0.01;
      g.yrate = -0.01;
    }

    if (gmlEq(e.intensity, 3.74) && e.knight_sprite === 'spr_roaringknight_front') {
      e.knight_sprite = 'spr_roaringknight_front_flourish';
      e.knight_sprite_image = 0;
      e.knight_sprite_speed = 0;
      scrLerpvar(state, spawn, e, 'knight_sprite_image', 0, 4, 16);
      // `scr_script_delayed(scr_lerpvar, 8, "fake_alpha", 1, 0, 32)` — he
      // FADES OUT as he flourishes, which is what leaves the vortex alone on
      // screen for the beat before the roar.
      e.fakeAlphaDelay = 7; // `scr_script_delayed(..., 8, ...)`; see above
    }
    if (e.fakeAlphaDelay > 0) {
      e.fakeAlphaDelay -= 1;
      if (e.fakeAlphaDelay === 0) {
        scrLerpvar(state, spawn, e, 'fake_alpha', 1, 0, 32);
      }
    }

    // THE IN-RUSH STREAKS — `timer >= 136 && intensity < 3.75`, ONE EVERY
    // FRAME (`(timer % 1) == 0` is always true; the modulo is vestigial).
    //
    // STREAK_UNIT IS A DEVIATION, taken on a play report and recorded here
    // rather than buried. `spr_pixel_white_front` is FOUR pixels wide (the
    // extracted manifest; its bbox fills all 4x4), so `image_xscale = 320`
    // multiplies out to a **1280-pixel** bar on a 640-pixel view — measured,
    // not estimated: the longest streak the untouched translation put on
    // screen was 1200px, once a frame for the whole 270-frame wind-up. That
    // is the screen-spanning starburst reported as not being in the real
    // fight.
    //
    // Everything around it checks out. The lerp reads (from, to, time) like
    // every other call in this object; the origin is the sprite's RIGHT edge
    // (ox 4) so the body trails backward from the anchor, away from the
    // vortex; drawSpriteExt scales that offset with the sprite and negates
    // image_angle for GameMaker's winding. The translation is literal and the
    // renderer is right — the product is simply not what the fight looks
    // like, which means something in the reading is wrong in a way no capture
    // this project has can locate.
    //
    // Dividing by the sheet width is the reading under which the number
    // becomes physical: 320 as a LENGTH IN PIXELS is about the 480-560px the
    // particle is born out at and travels in, so the streak spans its own
    // approach instead of twice the screen. The count, the cadence, the
    // 480 + irandom(80) spawn ring, the 8-frame in-rush and the 18-frame life
    // are all untouched.
    // Each starts 480-560px out on a random bearing as a 16x0.5 white pixel
    // aimed at the vortex, then four lerps fire at once:
    //
    //     image_xscale  320 -> 2    over 16    a long streak collapsing
    //     image_yscale    2 -> 0.1  over 16
    //     image_alpha     1 -> 0.5  over 16
    //     x, y  ->  the vortex      over 8, curve 1 "out"
    //
    // so it is stretched to 320 wide on its first frame and then whips into
    // the centre in eight. `timer = 18` is its own kill switch — the position
    // lerp finishes at 8 and it sits for ten more frames shrinking.
    //
    // ── THE IN-RUSH STREAKS ARE NOT DRAWN. ──────────────────────────────
    //
    // Everything below is kept and still RUNS — the two irandom draws matter,
    // because the stream is shared and skipping them would move every later
    // roll — but the particle is no longer created, so nothing reaches the
    // screen.
    //
    // WHY. The dump is unambiguous about what it asks for: a 4x4
    // `spr_pixel_white_front` at `image_xscale` lerping 320 -> 2, angled at
    // the vortex, born 480-560px out. Taken literally that is a 1280px streak
    // — twice the width of the 640px screen — several times a frame. Dividing
    // by the sheet width (the STREAK_UNIT reading above) brings it to ~320px,
    // still half the screen.
    //
    // The player, who has the real fight in front of them, reports there are
    // NO streaks across the screen in this attack at all. That is a direct
    // observation of the thing being translated, and it beats a reading this
    // file already admitted it could not make come out right: "something in
    // the reading is wrong in a way no capture this project has can locate."
    //
    // So they are removed rather than left at a fudged length. The research
    // stays here in full: if a future capture explains the 320, restore the
    // spawn and delete this block. Do NOT "fix" it by scaling the number
    // until it looks acceptable — that was the previous attempt.
    const DRAW_INRUSH_STREAKS = false;
    if (e.timer >= 136 && e.intensity < 3.75) {
      const randangle = gmlIrandom(state.gmlRng, 360);
      const randdistance = 480 + gmlIrandom(state.gmlRng, 80);
      const px = state.view.x + e.fake_x + lengthdirX(randdistance, randangle);
      const py = state.view.y + e.fake_y + 55 + lengthdirY(randdistance, randangle);
      const cx = state.view.x + e.fake_x;
      const cy = state.view.y + e.fake_y + 55;
      if (!DRAW_INRUSH_STREAKS) {
        // The draws above have been taken; the particle is not made.
        void px; void py; void cx; void cy;
      } else {
      const p = spawn(state, particleGeneric, { x: px, y: py });
      p.not_outbound = false;
      p.sprite_index = 'spr_pixel_white_front';
      p.direction = pointDirection(px, py, cx, cy);
      p.image_angle = p.direction;
      p.image_xscale = 16 / STREAK_UNIT;
      p.image_yscale = 0.5;
      p.timer = 18;
      scrLerpvar(state, spawn, p, 'image_xscale', 320 / STREAK_UNIT, 2 / STREAK_UNIT, 16);
      scrLerpvar(state, spawn, p, 'image_yscale', 2, 0.1, 16);
      scrLerpvar(state, spawn, p, 'image_alpha', 1, 0.5, 16);
      scrLerpvar(state, spawn, p, 'x', px, cx, 8, 1);
      scrLerpvar(state, spawn, p, 'y', py, cy, 8, 1);
      }
    }

    if (e.roaring_timer < 1 && e.intensity < 4) {
      e.ball_speed = e.intensity * 3;
      if (e.intensity < 3.75) {
        e.player_suck = scrApproach(e.player_suck, 1, 0.1625);
      }
    }
    // Runs unconditionally, right after the ramp — this pair is what pins
    // player_suck at 0.85 rather than 1.
    e.player_suck = scrApproach(e.player_suck, 0, 0.15);

    const heart = state.soul;
    if (heart) {
      const tx = state.view.x + e.fake_x;
      const ty = state.view.y + e.fake_y + 55;
      // THE DIRECTION READS THE PRE-STEP HEART. The roar is born at launch,
      // AFTER the turn's heart is delivered to the arena, so it is the
      // NEWER instance and the runner's newest-first stepping runs its pull
      // before the heart's own move each frame. verify21j f11271 pins it:
      // the heart starts the frame at (212,129), the held DOWN moves it to
      // 133, and the recording's pull lands 212 + 0.5125*cos(-2.337°) =
      // 212.5120697 with +0.0209 in y — the direction from (222,139), the
      // frame-START position. Reading the live heart gave dir exactly 0.
      // Same compensation family as the heart follower and the bar.
      const hp0 = state.soulPrev ?? heart;
      // CLAMPED, because the Step's very first act is
      //
      //     with (obj_heart) { if (x < camerax()) x = camerax(); ... }
      //
      // and the tempdir read at line 100 sees the heart AFTER it. The sim
      // applied that clamp to the LIVE soul but fed the pull the frame-start
      // snapshot, which never saw it. Identical whenever the camera is
      // steady and the soul is already inside — which is every frame the
      // pull was verified on, f11271 included — and wrong on exactly the
      // frames a SHAKE moves the boundary: at f11726 the camera is at (3, 3),
      // so the game clamps the soul from x 0 to x 3 and aims from there,
      // while the sim aimed from 0. Same asymmetry as the clamp above: left
      // and top snap to the edge, right and bottom to 20 inside.
      const cvx = state.view.x;
      const cvy = state.view.y;
      let hpx = hp0.x;
      let hpy = hp0.y;
      if (hpx < cvx) hpx = cvx;
      if (hpx > cvx + 640 - 20) hpx = cvx + 640 - 20;
      if (hpy < cvy) hpy = cvy;
      if (hpy > cvy + 480) hpy = cvy + 480 - 20;
      const hp = { x: hpx, y: hpy };
      // A --roar replay row's RESOLVED tempdir wins over the recomputation:
      // the runner's atan2 differs from JS's in the last bits, and those
      // bits reach the soul's f32-narrowed position (one ULP at f11288) and
      // from there a homing child's discrete turn decision (f11809). Same
      // concession shape as --grazes: give up the term nobody can model,
      // pin everything around it. Free play recomputes live.
      const roarRow = state.roarReplay?.get(state.frame);
      const tempdir = roarRow?.tempdir ?? pointDirection(hp.x + 10, hp.y + 10, tx, ty);
      heart.x += lengthdirX(e.player_suck, tempdir);
      heart.y += lengthdirY(e.player_suck, tempdir);
      // RE-CLAMP AFTER THE SHOVE, with the HEART'S OWN boundary geometry.
      // In the game the heart's Step runs AFTER this one (the roar is the
      // newer instance), so the frame ENDS on the heart's own clamps: x in
      // [0, view+620], y in [0, view.y + 300 + boundaryup] — with the
      // roar's boundaryup 160 that floor is the screen floor, 460. The
      // sim's heart steps first, so without this the reversed suck parks
      // the end-of-frame soul past the edges: verify21j f11715 reads
      // x 0.000 in the recording and -2.37 here, and f11738-11755 hold
      // y 460.000 against a drifting 462.07 (the corral's own bottom clamp
      // only fires past 480 and never pulls it back).
      //
      // A fresh shake's incoming first offset is peeked, exactly as the
      // heart's own step clamp does (sim/soul.js) — without it this clamp
      // dragged the soul back off the shaken floor mid-frame.
      let shx = 0;
      let shy = 0;
      for (const sh of state.entities) {
        if (sh.alive && sh.type.name === 'obj_shake' && sh.active === 0) {
          shx = sh.shakex;
          shy = sh.shakey;
        }
      }
      if (heart.x >= state.view.x + shx + 640 - 20) heart.x = state.view.x + shx + 640 - 20;
      if (heart.x <= 0) heart.x = 0;
      if (heart.y <= 0) heart.y = 0;
      const hfloor = state.view.y + shy + 320 - 20 + (heart.boundaryup ?? 0);
      if (heart.y >= hfloor) heart.y = hfloor;
    }

    e.attack_timer += 1;

    // THE STAR RINGS.
    //
    // Fire when `attack_timer` reaches 4, then reset it to
    // `floor(-1 + intensity)` — so as intensity ramps from 1.5 toward 4 the
    // gap between rings SHRINKS from 4 frames to 1. That single line is the
    // attack's whole build-up.
    //
    // `starcount_p1` gates which of those beats actually spawns: it counts up
    // and only the FIRST of every three fires a ring, until intensity crosses
    // 2.7 and every beat fires.
    if (e.attack_timer === 4) {
      e.rand_dist = 600;
      e.starcount_p1 += 1;
      // choose(-1, 1) — the value is only used by the untranslated variants,
      // but the draw is taken.
      e.spinspeed = gmlChoose(state.gmlRng, [-1, 1]);

      if (e.starcount_p1 === 1 && e.intensity < 3.7) {
        if (e.intensity >= 2.7) {
          // Two stars, opposite each other.
          e.rand_angle += 9;
          for (const off of [0, 180]) {
            const a = e.rand_angle + off;
            fireRingStar(state, e, a, 16);
          }
        } else {
          // Six stars evenly round the ring.
          e.rand_angle += 32;
          for (let i = 0; i < 6; i++) {
            e.rand_angle += 60;
            fireRingStar(state, e, e.rand_angle, 8 + e.intensity);
          }
        }
      }

      if (e.starcount_p1 === 3 || e.intensity >= 2.7) e.starcount_p1 = 0;

      // THE CORRAL, and it is a difficulty ramp disguised as a clamp. Once
      // intensity passes 3, every star still in flight is yanked back inside
      // 60px of the screen on each axis. The stars are fired from 600px out,
      // so late in the attack they stop having a long approach: they appear
      // near the edge and are on you at once.
      //
      // It also THINS them, which is how it was found. A corralled star is
      // much closer to the knight, so it reaches the 12px destroy radius
      // sooner — the engine carried two stars too many at frame 342 without
      // this, not too few.
      //
      // Only on ring beats: this sits inside the `attack_timer == 4` block,
      // not in the per-frame spiral below.
      if (e.intensity >= 3 && e.intensity < 4) {
        const vx = state.view.x;
        const vy = state.view.y;
        for (const d of state.entities) {
          if (!d.alive || d.type.name !== 'obj_knight_roaring_star') continue;
          if (d.x < vx - 60) d.x = vx - 60;
          if (d.x > vx + 640 + 60) d.x = vx + 640 + 60;
          if (d.y < vy - 60) d.y = vy - 60;
          if (d.y > vy + 480 + 60) d.y = vy + 480 + 60;
        }
      }

      e.attack_timer = Math.floor(-1 + e.intensity);
    }

    // ============ THE ROAR ============
    //
    // `intensity` stops ramping at exactly 4 (scr_approach clamps), and that
    // equality opens the last phase of the attack. `roaring_timer` then drives
    // it, and the FIRST thing it does is turn the attack inside out: the
    // spiral below is gated on `roaring_timer < 1`, so from here the stars stop
    // being drawn in toward the knight and are fired OUT from him instead.
    //
    // `player_suck` flips sign with it. It has been positive all attack,
    // dragging the soul in; the roar sets it to -6 and then pins it at -3, and
    // a negative length through `lengthdir_*` pushes the soul AWAY. The pull
    // and the shove are the same three lines of code with a different sign.
    //
    // Settling at exactly -3 is the same fixed-point trick as the 0.85 above:
    // `scr_approach(player_suck, 0, 0.15)` runs every frame and lifts it, and
    // `min(player_suck, -3)` runs every frame and puts it back.
    if (e.intensity === 4) {
      e.roaring_timer += 1;

      if (e.roaring_timer < 169) {
        if (e.roaring_timer === 9) {
          // ══ KAIZO Step_0:369-372, the FIRST statement of this block ════
          //
          //     with (obj_heart) { mask_index = spr_dodgeheart_smaller_2px_mask; }
          //
          // Inserted ahead of vanilla's `scr_lerpvar("knight_sprite_image",
          // 4, 6, 4)`. The mod shrinks the soul's hurtbox 2px per side for
          // the REST of the roar — nothing in this object restores it, and
          // the next turn's fresh soul is what hands the default mask back.
          // A `with` over zero instances is a no-op, hence the guard.
          if (state.soul) state.soul.mask = HEART_2PX_MASK;

          // THE ROAR ITSELF. Eight stars straight out on the compass points.
          //
          // AND `fake_alpha = 1` — THE KNIGHT COMES BACK. This one line was
          // missing, and it is the whole of the reported bug: at intensity
          // 3.74 he fades out over 32 frames behind the white bloom, and the
          // roar is what snaps him back, in a new pose, on the frame he
          // screams. Without it the fade never reversed and he simply never
          // returned — "the knight disappears halfway through". It is a bare
          // assignment, not a lerp: he is THERE, instantly, at full alpha.
          e.fake_alpha = 1;
          // ...continuing the flourish he faded out on, 4 -> 6 over 4 frames.
          scrLerpvar(state, spawn, e, 'knight_sprite_image', 4, 6, 4);
          e.player_suck = Math.min(e.player_suck, -6);
          e.ball_speed = -32;
          e.ball_darkness = 1;
          scrLerpvar(state, spawn, e, 'bobble_freq', 1, 3, 8);
          cue(state, 'snd_knight_roar', 1);

          // THE WHITE FLASH. A plain obj_knight_circle at the vortex with
          // r/g/b already 255 and no goals set, so it opens on its Create
          // defaults (size_goal 960, growth 40) and blows white across the
          // screen — the counterpart of the BLACK one at intensity 3.66,
          // which starts at 0 and lerps its goals up. `visible = false` and
          // `draw_in_box = false`: composited by the roar, unclipped.
          const flash = spawn(state, knightCircle, {
            x: state.view.x + e.fake_x,
            y: state.view.y + e.fake_y + 55,
          });
          flash.r = 255; flash.g = 255; flash.b = 255;
          flash.draw_in_box = false;
          flash.visible = false;

          // `scr_script_repeat(instance_create, 8, 2, x, y, 46)` — object 46
          // is `obj_afterimage_screen`, resolved off the object list
          // (tools/patches/object_ids.csx), NOT from the dump's
          // `__global_object_depths` table, which is partial and does not
          // list the roar's own objects at all. Reading 46 out of that table
          // gives `obj_interactable`, which is how a numeric asset id turns
          // into a wrong answer that looks sourced.
          //
          // max_time 8 at rate 2 = FOUR copies, two frames apart, on the
          // object's own defaults (xrate/yrate +0.01, faderate 0.00625, and
          // `draw_end` false so each draws itself). Positive rates: the
          // screen blows OUTWARD here, against the inward pull that ran for
          // the whole wind-up.
          e.roarGhosts = { left: 8, rate: 2, next: 0 };

          // ...and the eight stars, straight out on the compass points, at
          // `8.5 + random(2)` EACH — a live roll per star, one u32 per
          // iteration. The fullfight replays no roar table, and the flat
          // 8.5 fallback ran the whole burst slow: verify21j f11591's ring
          // leaves at vx 8.50 while the recording's b0 flies 9.04 (its roll
          // was 0.54) — nine pixels short by the catch, which then landed
          // two frames off. The recorded-table path stays for the scenario
          // suites that predate live RNG.
          const burst = state.roarBurstSpeeds ?? null;
          for (let a = 0; a < 8; a++) {
            const spd = burst
              ? (burst[a] ?? 8.5)
              : 8.5 + gmlRandom(state.gmlRng, 2);
            fireRoarStar(state, e, a * 45, spd, 1.2);
          }
        }
        // The repeat's own clock. obj_script_delayed fires on its rate until
        // `max_time` runs out, so this is four spawns and then nothing.
        if (e.roarGhosts && e.roarGhosts.left > 0) {
          if (e.roarGhosts.next <= 0) {
            spawn(state, afterimageScreen, {
              x: state.view.x + e.fake_x,
              y: state.view.y + e.fake_y + 55,
            });
            e.roarGhosts.next = e.roarGhosts.rate;
          }
          e.roarGhosts.next -= 1;
          e.roarGhosts.left -= 1;
        }

        // AND THE ROAR'S OWN SCREEN ECHOES, every third frame for the whole
        // 169-frame scream — `xrate/yrate 0.015, faderate 0.025`. Faster and
        // shorter-lived than the wind-up's, and OUTWARD. This runs alongside
        // the star fans below; it is not gated on them.
        if (e.roaring_timer % 3 === 0) {
          // y jitter first: GML evaluates call arguments RIGHT-TO-LEFT (measured on
          // the kaizo swordfall, kaizo/attacks/swordfall.js dropSword). Same draw
          // count, so no trace moves -- only where the echo lands.
          const ay = state.view.y + e.fake_y + 55 + gmlIrandomRange(state.gmlRng, -30, 30);
          const ax = state.view.x + e.fake_x + gmlIrandomRange(state.gmlRng, -30, 30);
          const g = spawn(state, afterimageScreen, { x: ax, y: ay });
          g.xrate = 0.015;
          g.yrate = 0.015;
          g.faderate = 0.025;
          g.draw_end = true;
        }

        if (e.roaring_timer === 15) {
          // The roar pose, and the only one that plays rather than holds.
          e.knight_sprite = 'spr_roaringknight_front_roar';
          e.knight_sprite_image = 0;
          e.knight_sprite_speed = 0.5;
        }

        if (e.roaring_timer >= 9) e.player_suck = Math.min(e.player_suck, -3);

        if (e.roaring_timer > 15 && e.roaring_timer % 5 === 0) {
          // One per star of the roar's stream, at half volume.
          cue(state, 'snd_stardrop', 0.5, 0.5);
          // A THREE-STAR FAN every five frames, walking around the circle.
          // The walk and every speed ROLL LIVE: `irandom(10)` (two u32) for
          // the step, then `6.5 + random(2)` / `8.5 + random(2)` /
          // `8.5 + random(2)` in spawn order — same fallback story as the
          // burst above.
          let fan;
          if (state.roarFans) {
            fan = state.roarFans[state.roarFanIndex++] ?? {
              rand: 0, s1: 6.5, s2: 8.5, s3: 8.5,
            };
          } else {
            fan = { rand: gmlIrandom(state.gmlRng, 10) };
          }
          e.rand_angle += 60 + fan.rand;

          // ORIGINAL BUG: the line above this in the source aims star_angle1
          // at the soul with `point_direction(knight, obj_heart)` and the very
          // next statement overwrites it with `rand_angle`. The fan does NOT
          // track the player, however much it looks like it means to.
          e.star_angle1 = e.rand_angle;
          e.star_angle2 = e.rand_angle + 20;
          e.star_angle3 = e.rand_angle - 20;

          fireRoarStar(state, e, e.star_angle1, fan.s1 ?? (6.5 + gmlRandom(state.gmlRng, 2)), 1.6);
          fireRoarStar(state, e, e.star_angle2, fan.s2 ?? (8.5 + gmlRandom(state.gmlRng, 2)), 1.6);
          fireRoarStar(state, e, e.star_angle3, fan.s3 ?? (8.5 + gmlRandom(state.gmlRng, 2)), 1.6);
        }
      }

      if (e.roaring_timer === 181) {
        e.knight_sprite = 'spr_roaringknight_front_flourish';
        e.knight_sprite_speed = 0;
        scrLerpvar(state, spawn, e, 'knight_sprite_image', 5.99, 0, 12);

        // THE CATCH. Every star in flight gets positive friction and is queued.
        // `with` iterates NEWEST FIRST, so the queue is youngest-to-oldest and
        // the release below pops it in that order.
        scrLerpvar(state, spawn, e, 'player_suck', e.player_suck, 0, 24);
        for (const d of starsNewestFirst(state)) {
          d.friction = 0.5;
          e.bullet_list.push(d);
        }
      }

      if (e.roaring_timer === 275) {
        // THE WIND-UP TO THE CUT. He shifts to the slash pose and the pre-cut
        // marker starts drawing itself across the screen (`line_timer`), while
        // r/g/b ramp grey -> red so the marker reddens as it extends. The
        // bobble flattens out over 24 frames.
        //
        // 4320 is spr_roaringknight_front_slash — GameMaker asset ids are the
        // index into the sprite list, and /private/tmp/sprite_meta.json is
        // dumped in that order, so `list(meta)[4320]` resolves them.
        e.sprite_index = 'spr_roaringknight_front_slash';
        e.knight_sprite = 'spr_roaringknight_front_slash';
        scrLerpvar(state, spawn, e, 'knight_sprite_image', 0, 2, 8);
        scrLerpvar(state, spawn, e, 'image_index', 0, 2, 8);
        scrLerpvar(state, spawn, e, 'bobble_amp', 4, 0, 24);
        e.line_timer = 0;
        scrLerpvar(state, spawn, e, 'r', 128, 255, 16);
        scrLerpvar(state, spawn, e, 'g', 128, 0, 16);
        scrLerpvar(state, spawn, e, 'b', 128, 0, 16);
      }

      if (e.roaring_timer === 299) {
        // THE CUT. The knight lands the diagonal and the screen itself is
        // severed; `do_fake_screen` triggers the Draw event's finale, which
        // this endStep carries out below.
        e.x = state.view.x + e.fake_x;
        e.y = state.view.y + e.fake_y + 20;
        const gt299 = state.entities.find(
          (x) => x.alive && x.type.name === 'obj_growtangle',
        );
        if (gt299) {
          gt299.image_xscale = 0;
          gt299.image_yscale = 0;
        }
        scrLerpvar(state, spawn, e, 'knight_sprite_image', 2, 5, 6);
        scrLerpvar(state, spawn, e, 'image_index', 2, 5, 6);
        e.do_fake_screen = true;
        cue(state, 'snd_knight_cut', 1);

        // THE CUT IS A REAL SLASH BULLET, not just the screen effect: the
        // original spawns obj_roaringknight_slash across the screen centre
        // at 117 degrees, xscale 4, width x4, slashdir forced -1, inherits
        // the roar's bullet fields, and lets it live out its ordinary
        // shrink-and-die — the recording's last bullet, parked at
        // (247.36, 97.44) from f11881 while everything else is swept
        // (`event_user(0)` on it is a no-op: the slash has no Other_10 and
        // its parents are codeless). The soul is destroyed by the same
        // frame's finale, so it can never connect.
        const cut = spawn(state, roaringknightSlash, {
          x: state.view.x + 320 - lengthdirX(-160, 117),
          y: state.view.y + 240 - lengthdirY(-160, 117),
        });
        cut.direction = 117;
        cut.image_xscale = 4;
        cut.xscale = 4;
        cut.image_angle = 117;
        cut.width *= 4;
        cut.slashdir = -1;
        scrBulletInherit(e, cut);

        // AND HE LEAPS. The cut is a jump-through: he dips 40px over 16 frames
        // easing out, and then — delayed by exactly those 16 — is thrown 360px
        // UP over 24 more, easing in, straight off the top of the screen.
        //
        // `draw_self()` is above the `if (stop) exit;` in the Draw event, so he
        // keeps drawing after the finale has frozen everything else: the knight
        // arcs up OVER the two halves of the cut screen as they fall apart.
        // That is the shot the attack ends on.
        e.jumpimages = true;
        scrLerpvar(state, spawn, e, 'y', e.y, e.y + 40, 16, 1, 'out');
        e.jumpUpDelay = 16;
        e.jumpUpFrom = e.y + 40;
      }

      if (e.jumpUpDelay > 0) {
        e.jumpUpDelay -= 1;
        if (e.jumpUpDelay === 0) {
          scrLerpvar(state, spawn, e, 'y', e.jumpUpFrom, e.jumpUpFrom - 360, 24, 1, 'in');
        }
      }

      if (e.roaring_timer === 363) {
        // He lands back at the knight's own position and warps in.
        e.jumpimages = false;
        const enemy = state.entities.find(
          (x) => x.alive && x.type.name === 'obj_knight_enemy',
        );
        if (enemy) {
          e.x = enemy.x;
          e.y = enemy.y;
        }
        e.sprite_index = 'spr_knight_warp';
        e.image_index = 5;
        e.image_speed = 0;
        scrLerpvar(state, spawn, e, 'image_index', 5, 8, 8);
      }

      if (e.roaring_timer === 375) {
        // THE END OF THE TURN, and Roaring is the one that decides it. The
        // controller (type 107) starts the turn with `global.turntimer =
        // 999999` precisely so the clock cannot cut the attack short; this is
        // where it hands the turn back. Without it the scheduler ended Roaring
        // on a 240-frame clock, halfway through the spiral, and then started
        // it again.
        const knight = state.entities.find(
          (x) => x.alive && x.type.name === 'obj_knight_enemy',
        );
        if (knight) knight.image_alpha = 1;
        // CleanUp also hands the knight back: `chargeupcon = 0` — he was
        // hidden from ROARING's launch (con 2, see create below).
        if (state.knight) state.knight.chargeupcon = 0;
        // `siner2 = 0` — the THIRD thing the CleanUp does, and the sim was
        // missing it. The bob is frozen for the whole attack (the Draw's
        // `if (!i_ex(obj_knight_roaring2)) siner2++`), so without the reset
        // he resumes from whatever phase the roar happened to freeze him at
        // and the hover reads as drifting from the wrong height. Zeroing it
        // puts him at `ystart + cos(0) * 8` — the top of the bob, the same
        // place the fight starts him.
        if (knight) knight.siner2 = 0;

        // `with (obj_growtangle) { growcon = 3; timer = 0; }` — the arena
        // collapses instead of just vanishing when the turn is swept.
        const gt = state.entities.find(
          (x) => x.alive && x.type.name === 'obj_growtangle',
        );
        if (gt) {
          gt.growcon = 3;
          gt.timer = 0;
        }

        state.turntimer = -1;
      }

      if (e.roaring_timer >= 182 && e.bullet_list.length) {
        // ONE STAR PER FRAME is promoted to con 1, which starts its brake ->
        // gravity-reversal -> six-child burst arc (sim/attacks/roaring-star.js,
        // already verified). That staggered release is what makes the finale
        // read as a wave rather than one detonation.
        const bul = e.bullet_list.shift();
        if (bul && bul.alive) bul.con = 1;
      }
    }

    // THE SPIRAL, and it lives HERE rather than in the bullet.
    // obj_knight_roaring_star has no `con == 0` branch at all — a ring star
    // does nothing of its own until the controller promotes it to con 1. Every
    // frame the controller instead re-aims each star at the knight and then
    // pushes it 90 degrees off that aim. `speed` (accelerating on the negative
    // friction) carries it inward while this tangential term carries it
    // around, and the sum is the spiral. `spinspeed` picks which way it winds.
    //
    // The star's SCALE is re-derived here too, from its distance to the knight
    // at 1/170 per pixel with a floor of 0.2 — which is why the stars shrink
    // as they fall in rather than growing like the Stars attack's do.
    //
    // Order does not matter even though the original is a `with` (newest
    // first): each star reads only its own state and the controller's.
    //
    // DEAD GATE preserved: the original nests `if (roaring_timer < 180)`
    // inside `if (roaring_timer < 1)`, so it can never be false.
    if (e.roaring_timer < 1) {
      const tx = state.view.x + e.fake_x;
      const ty = state.view.y + e.fake_y + 55;
      for (const d of state.entities) {
        if (!d.alive || d.type.name !== 'obj_knight_roaring_star') continue;

        if (e.roaring_timer < 180) {
          const scale = Math.max(0.2, 0.0058823529411764705 * pointDistance(d.x, d.y, tx, ty));
          d.image_xscale = scale;
          d.image_yscale = scale;
          d.direction = pointDirection(d.x, d.y, tx, ty);
          // `speed * 0.625 * (1 / intensity)`, and the shape matters: the
          // original takes the RECIPROCAL first and multiplies. Written as a
          // division instead, one star of the ring landed a single f32 ulp off
          // in y and stayed there.
          const step = d.speed * 0.625 * (1 / e.intensity);
          const swirl = d.direction + 90 * d.spinspeed;
          d.x += lengthdirX(step, swirl);
          d.y += lengthdirY(step, swirl);
        }

        if (pointDistance(d.x, d.y, tx, ty) < 12) destroy(d);
      }
    }
  },

  /**
   * THE DRAW EVENT'S OWN COUNTERS.
   *
   * obj_knight_roaring2's Draw advances four values as a side effect of
   * rendering, and the whole look depends on them:
   *
   *   ball_counter  += ball_speed, wrapped to [0, 1800) — the radius of the six
   *                    concentric rings multiplied over the vortex. `ball_speed`
   *                    is 2 while he charges and flips to -32 at the roar, which
   *                    is what makes the rings slam outward.
   *   hsv           counts 128 -> 288 -> 128, `hsv_switch` flipping at each end.
   *                 That is the vortex's hue sweep, one colour per frame.
   *   star_flicker  alternates 2 -> 0 -> 2, moving the scanline grate a pixel.
   *   intensify     tracks `intensity` until 3.75, then decays to 0 at 0.1 a
   *                 frame. It scales the knight's per-scanline wobble, so the
   *                 figure thrashes hardest right as the roar peaks and settles
   *                 as it ends.
   *
   * endStep is the phase that sits where Draw does. Keeping them here rather
   * than in render/ means a headless run produces the same numbers a browser
   * does — the renderer stays a pure reader.
   */
  /**
   * `star_flicker` is flipped AFTER the grate is drawn with it, so it advances
   * in beginStep — see the note on obj_tracking_sword1's beginStep for why the
   * two Draw-counter phases are not interchangeable.
   */
  beginStep(e) {
    if (!e.stop) e.star_flicker = 2 - e.star_flicker;
  },

  /**
   * KAIZO Draw_0:208 — `knight_sprite_image += knight_sprite_speed;` — in
   * FINAL mode, through the engine's draw slot (sim/index.js, "THE DRAW
   * SLOT": after every End Step, where GameMaker runs Draw).
   *
   * The line sits in the Draw event, below `if (stop) exit;` (18-21), and
   * runs in BOTH roaring modes. The vanilla-mode step above already carries
   * it (the `e.knight_sprite_image += e.knight_sprite_speed` in `step`,
   * verified against the recording), but `step` returns before that line
   * when roaring_type == 1 (Step_0:1-5) and roaringFinal never advanced it —
   * so the finale's roar pose (Other_11:477-478, speed 0.35 on the 2-frame
   * spr_roaringknight_front_roar) sat on frame 0 and the cut's per-beat
   * `knight_sprite_image = 4; knight_sprite_speed = -1` (618-619) never
   * walked 4 -> 3 -> 2. VISUAL ONLY: every gameplay gate on
   * knight_sprite_image in Other_11 (437 `== 0`, 566 `>= 2.5`, 582 `== 3.5`)
   * fires with knight_sprite_speed already 0 and a scr_lerpvar driving the
   * value, so nothing the sim checks moves. No RNG. Read by
   * kaizo/render/draw/roaring.js.
   */
  draw(e) {
    if (e.roaring_type !== 1 || e.stop) return;
    e.knight_sprite_image += e.knight_sprite_speed;
  },

  endStep(e, state) {
    // THE PINNED SOUL'S END-OF-FRAME CLAMP, once more with the FINAL view.
    // The step-phase clamp above ran before obj_shake's own first Step
    // (spawn order puts the shake last), so on a shake's FIRST frame it
    // clamped against the unshaken view; the game's heart steps after the
    // shake's set and its floor rides the offset. End steps run after every
    // step, so the view here is the frame's final one: verify21j
    // f11756-11759 holds the edge-pinned soul at 464/456/463/458 — the
    // shaken floor — where a view-0 clamp froze it at 460.
    if (state.soul && (e.timer ?? 0) > 128) {
      const heart = state.soul;
      // Left and top are ABSOLUTE zero (the heart's own `x + px <= 0`
      // form); right and floor are view-relative. The recording holds
      // x 0.000 through the shake while the floor rides it.
      if (heart.x >= state.view.x + 640 - 20) heart.x = state.view.x + 640 - 20;
      if (heart.x <= 0) heart.x = 0;
      if (heart.y <= 0) heart.y = 0;
      const hfloor = state.view.y + 320 - 20 + (heart.boundaryup ?? 0);
      if (heart.y >= hfloor) heart.y = hfloor;
    }

    // THE FINALE, and it lives at the bottom of the Draw event in the original:
    // the composite is snapshotted into two sprites cut along the -63 degree
    // diagonal, `obj_heart` is DESTROYED, `stop` is set so nothing draws again,
    // and the two halves are handed to markers that slide apart.
    //
    // The renderer takes its snapshot on this same frame — it keys off
    // `do_fake_screen`, not `stop`, precisely so the last composited frame is
    // the one that gets cut up.
    if (e.do_fake_screen && !e.stop) {
      e.stop = true;

      for (const k of state.entities) {
        if (k.alive && k.type.name === 'obj_knight_pointing_starchild') destroy(k);
      }

      // camerawidth() * 0.5 and cameraheight() * 0.5; the two sprites are
      // created with their origins at these points and placed there, so each
      // half starts exactly where it was.
      const left = spawn(state, screenPiece, {
        x: state.view.x + 160,
        y: state.view.y + 240,
      });
      left.piece = 0;
      left.direction = 180;
      left.gravity_direction = 180;
      left.gravityDelay = 12;
      scrLerpvar(state, spawn, left, 'speed', 15, 0.5, 12, 1, 'out');

      const right = spawn(state, screenPiece, {
        x: state.view.x + 480,
        y: state.view.y + 240,
      });
      right.piece = 1;
      right.direction = 0;
      right.gravity_direction = 0;
      right.gravityDelay = 12;
      scrLerpvar(state, spawn, right, 'speed', 14, 0.5, 12, 1, 'out');

      // `with (obj_heart) instance_destroy();` — the soul is cut in half with
      // the screen. The scene puts one back at the top of the next turn; see
      // clearTurn in sim/scenes/fight.js.
      if (state.soul) {
        destroy(state.soul);
        state.soul = null;
      }
    }

    if (e.stop) return;

    // FINAL MODE ADVANCES THESE ELSEWHERE. Draw_0 runs ONCE a frame in the
    // game, and in final mode its bookkeeping (31-39 ball_counter, 132-173
    // the hsv walk with the mod's B-Side split, 209-216 intensify) is
    // finaleDrawBookkeeping, called from roaringFinal — this object's Step
    // in that mode. The vanilla copy below then ran a SECOND time each frame:
    // MEASURED (scratch probe, ac 104 vs ac 9 from one create) hsv walked
    // 128 -> 130 -> 132 -> 134 under the finale against 128 -> 129 -> 130
    // -> 131 under the vanilla roar — the vortex's hue sweep, ring cadence
    // and knight wobble all at double speed. Visual state only, read by the
    // kaizo Draw port; no RNG, no trace column, no check pin.
    if (e.roaring_type === 1) return;

    e.ball_counter += e.ball_speed;
    if (e.ball_counter < 0) e.ball_counter += 1800;
    if (e.ball_counter > 1800) e.ball_counter -= 1800;

    if (!e.hsv_switch) e.hsv += 1;
    else e.hsv -= 1;
    if (e.hsv >= 288) e.hsv_switch = true;
    if (e.hsv <= 128) e.hsv_switch = false;

    if (e.intensity < 3.75) e.intensify = e.intensity;
    else e.intensify = scrApproach(e.intensify, 0, 0.1);
  },

  /**
   * CleanUp_0 (kaizo gml_Object_obj_knight_roaring2_CleanUp_0.gml), BOTH
   * roaring modes. GameMaker runs it on every instance_destroy — for this
   * object that is the turn sweep, `with (obj_bulletparent) instance_destroy()`,
   * after the controller has handed the clock back — and the engine fires
   * `cleanUp(e, state)` on the same route (sim/entity.js destroy(); clearTurn
   * destroys with the state). It was MISSING here (2026-09-08): the finale
   * left the knight at chargeupcon 3 — "the hidden state, held until the
   * roar's CleanUp restores him" (sim/knight.js) — with an unreset bob, and
   * only the ordinary roar's roaring_timer-375 block restored him.
   *
   *     24-29  with (obj_knight_enemy) { image_alpha = 1; siner2 = 0; chargeupcon = 0; }
   *     30-33  snd_stop(snd_knight_stretch / snd_knight_roar / snd_stardrop / snd_knight_cut)
   *     34-37  with (obj_growtangle) instance_destroy();       <- NOT taken, below
   *     38-51  if (roaring_type == 1) destroy every final_lines[i], and hideback
   *
   * `chargeupcon = 0` is what re-opens the mod's fight-end gate
   * (knight_enemy Draw_0:151 `chargeupcon == 0 && ... haveusedroaring ...`),
   * so after atk_RoaringDelta the next landed hit can end the fight; `siner2
   * = 0` puts the bob at its top for the turns AfterFinal resumes. The
   * ordinary roar's inline restore at roaring_timer 375 stays as the vendored
   * module has it; this runs again at the sweep with the same values.
   *
   * DEVIATION (labelled): the growtangle destroy is not taken. This engine
   * keeps one obj_growtangle per fight (fight.js SURVIVES_TURN) and
   * openVCArena re-arms it — with no instance it returns without a board.
   * The collapse both modes already run (attack_con 5's `visible = false;
   * growcon = 3; timer = 0`; roaring_timer 375's growcon 3) is the visible
   * half of the destroy; the next arena open is the create.
   */
  cleanUp(e, state) {
    const knight = state.entities.find(
      (x) => x.alive && x.type.name === 'obj_knight_enemy',
    );
    if (knight) {
      knight.image_alpha = 1;
      knight.siner2 = 0;
    }
    if (state.knight) state.knight.chargeupcon = 0;
    cueStop(state, 'snd_knight_stretch');
    cueStop(state, 'snd_knight_roar');
    cueStop(state, 'snd_stardrop');
    cueStop(state, 'snd_knight_cut');
    roaringFinalCleanUp(state, e);
  },
};

/** `with (obj_knight_roaring_star)` order: newest first. */
function starsNewestFirst(state) {
  return state.entities
    .filter((d) => d.alive && d.type.name === 'obj_knight_roaring_star')
    .sort((a, b) => b.seq - a.seq);
}

/**
 * A roar star: fired FROM the knight outward, the mirror image of a ring star.
 *
 * No negative friction and no `spinspeed` — these fly straight out at constant
 * speed, and the spiral that would have read `spinspeed` is switched off for
 * the rest of the attack. The original does not set it either.
 *
 * They start at `image_xscale = 0.1` and a tween grows them to `finalScale`
 * over 32 frames, which the offscreen cull reads through `sprite_width`.
 */
function fireRoarStar(state, e, direction, speed, finalScale) {
  const d = spawn(state, roaringStar, {
    x: state.view.x + e.fake_x,
    y: state.view.y + e.fake_y + 55,
  });
  d.wall_destroy = false;
  d.bottomfade = false;
  d.destroyonhit = false;
  d.direction = direction;
  d.speed = speed;
  d.image_xscale = 0.1;
  d.image_yscale = 0.1;
  scrLerpvar(state, spawn, d, 'image_xscale', 0.1, finalScale, 32);
  scrLerpvar(state, spawn, d, 'image_yscale', 0.1, finalScale, 32);
  return d;
}

/**
 * One star of a ring: created out on a circle of `rand_dist` around the
 * knight and aimed straight at him, with NEGATIVE friction so it accelerates
 * inward the whole way.
 */
function fireRingStar(state, e, angle, speed) {
  const cx = state.view.x + e.fake_x;
  const cy = state.view.y + e.fake_y;
  const d = spawn(state, roaringStar, {
    x: cx + lengthdirX(e.rand_dist, angle),
    y: cy + lengthdirY(e.rand_dist, angle),
  });
  d.wall_destroy = false;
  d.destroyonhit = false;
  d.bottomfade = false;
  // REQUIRED, not decoration: `spinspeed` exists nowhere in
  // obj_knight_roaring_star's own code — not its Create, not its Step. The
  // spawner is the only thing that ever sets it and the controller's spiral is
  // the only thing that reads it. Leaving it out made `90 * spinspeed` NaN and
  // poisoned x/y on every ring star.
  d.spinspeed = 1;
  // The original also sets `visible = false` here. NOT mirrored: the stars are
  // drawn manually by the controller's Draw (event_user on each one), so in the
  // game invisibility costs nothing, while a renderer that draws by sprite
  // would simply lose them.
  d.image_index = 0;
  d.image_speed = 0;
  d.image_xscale = 2;
  d.image_yscale = 2;
  d.direction = pointDirection(d.x, d.y, cx, cy + 55);
  d.speed = speed;
  d.friction = -0.1;
  return d;
}

// ══════════════════════════════════════════════════════════════════════════
//  KAIZO — obj_knight_roaring2 Other_11 (event_user(1)):
//  THE ROARING DELTA FINALE
//
//  957 lines of NEW mod content, translated below in the GML's own order.
//  Nothing here has a vanilla counterpart, so every block cites
//  gml_Object_obj_knight_roaring2_Other_11.gml by line number.
//
//  FOUR PHASES, `final_con`, each handing over to the next:
//
//    0  120 frames of set-up. player_suck pinned to 0, global.invc dropped
//       to 0.8, and the battle box inflated to the WHOLE SCREEN (2560x1920
//       at the 2x draw scale) over 160 frames. The arena stops existing as
//       a boundary; the screen corral at the top of this event replaces it.
//    1  THE SPIRAL. Rings of 7 stars (8 on B-Side) fired from 640px out and
//       walked inward by `attack_grav` every frame, while `attack_spd`
//       spins them and `player_suck` drags the soul into the middle. Two
//       sub-phases (`attack_con` 0 then 1) ramp cadence, spin and inward
//       speed; a lerped `attack_con` 1.5 -> 2 -> 2.5 -> 3 runs the flourish
//       and the roar that ends it.
//    2  THE CURTAINS. Every star is destroyed and the pull REVERSES
//       (`player_suck = 18`, `obj_heart.y -= player_suck`): the soul is
//       shoved to the top of the screen while volleys of 10 stars rise from
//       below the camera in alternating 24px-offset rows.
//    3  THE CUT. The knight slashes, 30 red slash lines are stamped over
//       the screen at random positions and angles, they flash white, and on
//       ONE frame every line tests against the soul —
//       `scr_damage_all_maxhp(0.75, 1, 0)`, 75% of MAX HP to the whole
//       party, once. Then the screen shatters and the turn ends.
//
//  THE TURN ENDS HERE, exactly as the vanilla roar's does: the controller
//  is launched with `global.turntimer = 999999` (type 107 is a PINNER in
//  the V-C launcher) so nothing can cut it short, and attack_con 6 hands
//  the clock back with `global.turntimer = -1` and destroys obj_heart.
// ══════════════════════════════════════════════════════════════════════════

/** `kaizo_sideb()` as the 0/1 the GML does arithmetic with (`9 - sideb`). */
function sideb(state) {
  return state.kaizo?.sideb ? 1 : 0;
}

/**
 * `obj_growtangle`'s sprite is spr_battlebg_0, 75x75 (sim/masks.js). GML's
 * `sprite_width` is the SCALED width, so `2560 / sprite_width` at the
 * fight's image_xscale 2 asks for 2560/150 = 17.07 — a 1280px-wide box,
 * which at scr_darksize's 2x is exactly the 2560px screen. The formula is
 * self-referential in the original and is transcribed as written.
 */
const GROWTANGLE_SPRITE = 75;

/**
 * `scr_marker(_lx, _ly, spr_roaringknight_finalslash_mask)` — one of the 30
 * final slash lines (Other_11:627). A bare sprite carrier: no motion, no
 * bullet contract, no Other_15. The ONLY gameplay it has is the one
 * `place_meeting` the controller runs against it on a single frame, so it
 * carries a mask and nothing else.
 *
 * POSITION IS SCREEN SPACE. `scr_marker(_lx, _ly, ...)` is handed
 * `irandom(639)` / `irandom(419)` — raw view coordinates — and the hit test
 * is `place_meeting(x + camerax(), y + cameray(), obj_heart)`, which adds
 * the camera back. Both are transcribed literally: `x`/`y` stay in [0,639]
 * x [0,419] and the test offsets by the view.
 */
export const finalSlashLine = {
  name: 'kaizo_roaring_finalslash_line',

  create(e) {
    e.image_speed = 0;
    e.image_index = 0;
    e.image_xscale = 1;
    e.image_yscale = 1;
    e.image_angle = 0;
    e.flag = '';
    e.sprite_index = 'spr_roaringknight_finalslash_mask';
    // `mask_index = spr_roaringknight_finalslash_mask` — Other_11:632, the
    // line after the create. Same sprite, restated by the original.
    e.mask = FINALSLASH_MASK;
    e.image_blend = C_RED; // `image_blend = c_red` — see the constants' note
  },
};

/**
 * `hideback = scr_marker(camerax(), cameray(), spr_pxwhite)` — Other_11:140,
 * a 640x480 black cover blended over the board. Presentation only, but it is
 * an INSTANCE the finale keeps a handle to (`i_ex(hideback)`, `with
 * (hideback)`, and the CleanUp destroy), so it exists here as a real entity.
 */
export const hidebackCover = {
  name: 'kaizo_roaring_hideback',

  create(e) {
    e.image_speed = 0;
    e.image_index = 0;
    e.image_alpha = 1;
    e.image_xscale = 640;
    e.image_yscale = 480;
    e.image_blend = C_BLACK; // `image_blend = c_black` — see the constants' note
    e.sprite_index = 'spr_pxwhite';
  },
};

/**
 * `scr_damage_all_maxhp(arg0, arg1, arg2)` — kaizo
 * gml_GlobalScript_scr_damage_all.gml:30-55 — is kaizo/party/damage.js's
 * scrDamageAllMaxhp, imported above (G2, 2026-09-08):
 *
 *     if (global.inv < 0) {
 *         with (obj_knight_enemy) aoedamage = true;
 *         for (ti = 0..2) { global.inv = -1; target = ti;
 *             if (hp[char[ti]] > 0 && char[ti] != 0) scr_damage_maxhp(...); }
 *         with (obj_knight_enemy) aoedamage = false;
 *         global.inv = global.invc * 30;
 *     }
 *
 * What the wrapper that used to live here got wrong, for the record: it took
 * the VENDORED VANILLA scr_damage_maxhp (sim/damage.js), which has no
 * `progamer = false` (kaizo scr_damage_maxhp.gml:5-9), no B-Side
 * `tdamage = ceil(tdamage * 0.8)` and no `ceil(tdamage / 4)` gloom (170-174,
 * 245-261). The aoedamage bracket is inside the party module, and it is what
 * makes the fraction reductions — the mantle halving AND Noelle's x0.75, both
 * inside `aoedamage == false` AND `!i_ex(obj_knight_roaring2)`
 * (scr_damage_maxhp.gml:60-61, 161-164) — skip for every member of this hit.
 * Two gates, and the finale fails both: Noelle takes the full fraction here.
 *
 * NOTE the `target = 3` the caller sets first (Other_11:781): it is not a
 * target selection at all. The script opens `_temptarget = target` and closes
 * `target = _temptarget`, and the caller is the LINE MARKER, which has no
 * `target` variable — so the assignment exists only to define one before the
 * save/restore reads it. Modelled by simply not needing it.
 *
 * THE ROSTER SHIM, labelled. `global.maxhp[chartarget]` is read by the party
 * module off `state.kaizo.roster` (kaizo/party/roster.js maxhpOfChar, 0 with
 * none — GML's unset cell), and kaizo-fight.js installs a roster only for a
 * version that declares a party: V-D does, V-C DOES NOT. Routed bare, the
 * V-C finale would deal ceil(0 * 0.75) = 0 to everyone (measured 2026-09-08
 * by check-roaring-final §11 the moment the import moved). So when no roster
 * is installed, the Normal Route three — `global.char = [1, 2, 3]`, which is
 * what the party module already assumes for slots and HP without one — are
 * stood up on state.kaizo.roster for the length of the call and taken down
 * again. buildRoster is pure (member records only; partyHp, the char arrays
 * and the gloom mirrors are untouched), so nothing else in the scene sees a
 * roster appear mid-fight. Composition, not a party edit (HANDOFF §2.3); it
 * retires the day V-C installs its own roster.
 */
function finaleDamageAllMaxhp(state, fraction, ignoreDefend, cannotFell) {
  const k = (state.kaizo ??= {});
  const hadRoster = !!k.roster;
  if (!hadRoster) k.roster = buildRoster(NORMAL_ROUTE_PARTY, { sideb: !!k.sideb });
  try {
    return scrDamageAllMaxhp(state, fraction, ignoreDefend, cannotFell);
  } finally {
    if (!hadRoster) delete k.roster;
  }
}

/**
 * One `scr_fire_bullet(..., obj_knight_roaring_star, 0, 0,
 * spr_knight_bullet_star)` plus the `with (_bullet)` block that follows it.
 * scr_fire_bullet itself is direction/speed/sprite and nothing else (arg7
 * defaults false, so NO scr_bullet_inherit), so the whole spawn is here.
 *
 * `visible = false` is NOT mirrored, for the reason the sim module's
 * fireRingStar already documents: the original draws these by hand from the
 * controller's Draw, so invisibility is free there and would simply lose them
 * in a renderer that draws by sprite.
 */
function fireFinaleStar(state, e, sx, sy, opts) {
  const d = spawn(state, roaringStar, { x: sx, y: sy });
  d.startype = opts.startype;
  d.outbound = false;
  d.spec = 1;
  d.wall_destroy = false;
  d.destroyonhit = false;
  d.bottomfade = false;
  d.spinspeed = 0;
  d.image_index = 0;
  d.image_speed = 0;
  d.image_xscale = opts.scale;
  d.image_yscale = opts.scale;
  d.speed = 0;
  d.direction = opts.direction;
  if (opts.distance !== undefined) d.distance = opts.distance;
  d.rotspeed = e.attack_spd * e.attack_spdir;
  return d;
}

/** `with (obj_knight_roaring_star)` — GML iterates newest first. */
function finaleStars(state) {
  return state.entities
    .filter((d) => d.alive && d.type.name === 'obj_knight_roaring_star')
    .sort((a, b) => b.seq - a.seq);
}

/**
 * obj_knight_roaring2's Other_11, top to bottom.
 *
 * `roaring_type == 1` routes the ENTIRE Step here, so this function IS the
 * finale's Step event: every clock it advances, every branch it takes and
 * every RNG draw it consumes is Step-side.
 */
function roaringFinal(e, state) {
  // ── 1-11: the HP HUD slides up from 48 to 0 once the catch reveals it.
  // `hp_visible` is switched on by the mod's star catch (obj_knight_enemy
  // Other_12, implemented in ./roaring-final-star.js). The HUD itself is
  // Other_22 and is DRAW — not translated, state kept.
  if (e.hp_visible) {
    if (e.hp_y > 0.5) e.hp_y = lerp(e.hp_y, 0, 0.5);
    else e.hp_y = 0;
  }

  // ── 12-31: `with (obj_heart)` — the 2px mask, then the SCREEN CORRAL.
  //
  // The mask is re-stamped EVERY frame of the finale (unlike the vanilla
  // roar, which stamps it once at roaring_timer 9), so nothing can hand the
  // soul its full hurtbox back while this runs.
  //
  // The corral is the vanilla roar's clamp with ITS ASYMMETRY FIXED: vanilla
  // tests `y > cameray() + cameraheight()` and then assigns
  // `cameray() + cameraheight() - 20`, so the soul could sit up to 20px past
  // the bottom. The mod tests and assigns the same value. Left/top unchanged.
  const heart = state.soul;
  const cvx = state.view.x;
  const cvy = state.view.y;
  if (heart) {
    heart.mask = HEART_2PX_MASK;
    if (heart.x < cvx) heart.x = cvx;
    if (heart.x > cvx + 640 - 20) heart.x = cvx + 640 - 20;
    if (heart.y < cvy) heart.y = cvy;
    if (heart.y > cvy + 480 - 20) heart.y = cvy + 480 - 20;
  }

  // ── 32-33: the phantom knight's live position, read by everything below.
  const knightX = cvx + e.fake_x + e.fake_xoff;
  const knightY = cvy + e.fake_y + 55 + e.fake_yoff;

  // ── 34-43: the leap streak, then the clocks.
  if (e.jumpimages) {
    const g = scrAfterimage(state, e);
    g.sprite_index = e.sprite_index;
    g.image_index = e.image_index;
    g.fadeSpeed = 0.08; // scr_afterimageFAST
  }
  e.timer += 1;
  if (e.line_timer > -1) e.line_timer += 1;
  e.bobble_count += e.bobble_freq;

  if (e.final_con === 0) {
    // ══ 44-77 — SET-UP ════════════════════════════════════════════════════
    // The pull is held at 0 for the whole intro: `player_suck = 0` runs
    // BEFORE the timer tests, so nothing can drag the soul yet.
    e.player_suck = 0;

    if (e.timer === 30) {
      // `global.invc = 0.8` — the finale's own mercy window, replacing the
      // 0.5 the launcher armed the turn with. Every hit from here (the star
      // catch AND the slash lines) grants 24 frames, not 15.
      state.invc = 0.8;
      // THE ARENA IS INFLATED TO THE SCREEN over 160 frames. After this the
      // box is not a boundary any more — the screen corral above is.
      for (const gt of state.entities) {
        if (!gt.alive || gt.type.name !== 'obj_growtangle') continue;
        scrLerpvar(state, spawn, gt, 'image_xscale', gt.image_xscale,
          2560 / (GROWTANGLE_SPRITE * gt.image_xscale), 160, 1, 'out');
        scrLerpvar(state, spawn, gt, 'image_yscale', gt.image_yscale,
          1920 / (GROWTANGLE_SPRITE * gt.image_yscale), 160, 1, 'out');
      }
    }

    if (e.timer === 80) {
      // The scanline phantom fades in and drops from y 24 to 88 — the same
      // two tweens the vanilla intro runs, on the finale's own clock.
      scrLerpvar(state, spawn, e, 'fake_alpha', 0, 1, 48, 1, 'out');
      scrLerpvar(state, spawn, e, 'fake_y', 24, 88, 48, 2, 'out');
    }

    if (e.timer >= 120) {
      e.final_con = 1;
      // `timer = -1` — so the NEXT frame's `timer++` lands on 0 and the
      // `timer == 0` / `timer == 16` beats below fire exactly once.
      e.timer = -1;
      e.attack_timer = 0;
      e.attack_max = 10;
      e.attack_dir = 0;
      e.attack_grav = 8;
      e.attack_spd = 0.5;
      e.attack_spdir = 1;
      e.attack_con = 0;
      e.attack_ind = 0;
      e.attack_sep = 15;
      e.attack_arr = [];
      e.attack_mult = 1;
    }
  } else if (e.final_con === 1) {
    // ══ 78-384 — THE SPIRAL ═══════════════════════════════════════════════
    if (e.timer > 16 && e.attack_con < 2) {
      e.intensity = scrApproach(e.intensity, 3.5, 0.015);
      e.ball_speed = e.intensity * 3;
      // A SLOWER, STRONGER PULL THAN THE VANILLA ROAR'S. Vanilla ramps
      // player_suck at 0.1625 and then takes 0.15 back every frame, pinning
      // it at 0.85; the finale ramps at 0.0125 with NO down-step, so it
      // climbs uninterrupted to a hard 1 and stays there.
      e.player_suck = scrApproach(e.player_suck, 1, 0.0125);

      if ((e.timer % 3) === 0) {
        // scr_afterimage_grow() bloom, four tweens and a delayed pair.
        // VISUAL, no RNG — skipped (see the header). It reads
        // knight_sprite/knight_sprite_image and writes nothing back.
      }

      // THE IN-RUSH STREAK. Two irandom draws (2 u32 each) are taken every
      // frame; the obj_particle_generic is NOT made, exactly as the sim
      // module's own streak site does and for the same two reasons: the
      // literal reading gives a streak wider than the screen, and the player
      // reports there are no such streaks in the real attack. The draws
      // matter — the stream is shared and skipping them would move every
      // later roll in the turn.
      const randangle = gmlIrandom(state.gmlRng, 360);
      const randmult = 0.1 + (e.intensity / 10);
      const randdistance = (320 + gmlIrandom(state.gmlRng, 80)) * randmult;
      void randangle; void randmult; void randdistance;
    }

    if (e.timer === 0) {
      // `scr_script_delayed(scr_lerpvar, 16, "ball_darkness", 0, 1, 32, 1,
      // "out")`. COUNT n-1: GameMaker runs alarms before Step, so the
      // obj_lerpvar the alarm creates gets its first Step on that same
      // frame and its first write lands 16 frames after the call. This
      // engine freezes the entity list per phase, so the tween is armed one
      // frame earlier — CLAUDE.md, "A delayed tween lands one frame earlier
      // than it looks".
      e.finalBallDarknessDelay = 15;
    }
    if (e.finalBallDarknessDelay > 0) {
      e.finalBallDarknessDelay -= 1;
      if (e.finalBallDarknessDelay === 0) {
        scrLerpvar(state, spawn, e, 'ball_darkness', 0, 1, 32, 1, 'out');
      }
    }

    if (e.timer === 16) {
      // The black cover goes up, and the beam loop starts at pitch 0.08.
      e.hideback = spawn(state, hidebackCover, { x: cvx, y: cvy });
      e.sound = 'snd_knight_beam';
      e.beamPitch = 0.08;
      cueSustain(state, 'snd_knight_beam', 0.08);
    }

    if (e.timer > 16 && e.sound !== -4 && e.attack_con < 2) {
      // audio_sound_pitch(+0.0002/frame) plus a track-position rewind that
      // loops the beam's first quarter second. AUDIO ONLY: the pitch is
      // carried so the cue system can bend the note; the rewind has no sim
      // observable and is skipped.
      e.beamPitch += 0.0002;
      cueTune(state, 'snd_knight_beam', e.beamPitch);
    }

    const diststart = 640;

    if (gmlEq(e.attack_con, 0)) {
      // ── 157-218: RINGS, ramping in. ──────────────────────────────────
      if (e.timer > 16) {
        e.attack_timer += 1;
        // The cadence is DERIVED FROM INTENSITY, not accumulated: at 1.5 a
        // ring every 9.5 frames, at 3.5 every 3.5.
        e.attack_max = 14 - (e.intensity * 3);
        e.attack_grav = scrApproach(e.attack_grav, 12.5, 0.02);
        e.attack_spd = scrApproach(e.attack_spd, 1.5, 0.015);
      }
      const staramt = sideb(state) ? 8 : 7;
      const stardist = 360 / staramt;
      if (e.attack_timer >= e.attack_max) {
        e.attack_ind += 1;
        // The reset OVERSHOOTS: it subtracts the cadence AND a second term
        // that shrinks with intensity, so attack_timer goes negative and the
        // real gap between rings is much longer than attack_max early on and
        // converges on it late.
        e.attack_timer -= (e.attack_max + (7 - (e.intensity / 2.75)));
        e.attack_spdir = -e.attack_spdir;
        e.attack_dir += (stardist / 3);
        e.attack_dir %= 360;
        for (let i = 0; i < staramt; i++) {
          const rot = (360 / staramt) * i;
          const bulang = rot + e.attack_dir;
          fireFinaleStar(
            state, e,
            knightX + lengthdirX(diststart, bulang),
            knightY + lengthdirY(diststart, bulang),
            { startype: 1, scale: 2, direction: bulang, distance: diststart },
          );
        }
      }
      // `attack_grav >= 12.5` THROUGH GML'S EPSILON, and the recording is
      // unambiguous about why. attack_grav climbs by scr_approach(..., 12.5,
      // 0.02) from 8, and scr_approach only CLAMPS to the target when the step
      // overshoots, so the sum carries its f64 error the whole way: step 225
      // lands on 12.499999999999904 and step 226 on exactly 12.5. The game
      // fires on step 225 — the roar probe of both 2026-09-09 locks has
      // attack_con 0 -> 1 on the frame attack_grav first prints 12.5000000000
      // (A-Side f831 = C+362 and f2181, B-Side the same offset) — because the
      // runner compares reals with an epsilon and 12.4999999999999 IS >= 12.5
      // to it. An exact JS `>=` waits for the clamp, i.e. ONE FRAME LATER,
      // which is exactly where this module fired (C+363) and what made the
      // whole rest of the finale a frame late: the ring at C+387, the
      // 75%-max-HP catch at C+470, the slash lines at C+1018. attack_timer
      // itself was exact throughout, which is what pointed here rather than
      // at a clock.
      //
      // `gmlLte(threshold, value)` IS the epsilon-tolerant `>=`, the spelling
      // knightlines.js:864 and quickslash.js:1293 already use, and sim/gml.js
      // carries the measurement that the runner applies the same epsilon to
      // ordering comparisons as to `==`.
      //
      // `attack_timer <= 0` is left exact on purpose: its values near the gate
      // are -0.12 and coarser, nowhere near GML_EPSILON of the threshold.
      if ((e.attack_ind % 3) === 0 && gmlLte(12.5, e.attack_grav) && e.attack_timer <= 0) {
        // attack_grav needs 225 frames to climb 8 -> 12.5, so this gate sets
        // the length of the spiral's first half.
        e.attack_mult = 1;
        e.attack_spdir = 1.5;
        e.attack_spd = 1.5;
        e.attack_con = 1;
        e.attack_max = 10;
        scrLerpvar(state, spawn, e, 'fake_y', e.fake_y, e.fake_y + 72, 80, 2, 'out');
        e.knight_sprite = 'spr_roaringknight_front_flourish'; // 4959 (v091)
        e.knight_sprite_image = 0;
        e.knight_sprite_speed = 0;
        scrLerpvar(state, spawn, e, 'knight_sprite_image', 0, 4, 30);
      }
    } else if (gmlEq(e.attack_con, 1)) {
      // ── 219-284: RINGS, closing in. ──────────────────────────────────
      if (e.timer > 16) {
        let maxinc = 0.125;
        let spdinc = 0.0061;
        let gravinc = 0.021;
        if (sideb(state)) {
          // B-SIDE IS SLOWER TO ARRIVE, NOT EASIER: every ramp runs at 55%,
          // so the phase lasts nearly twice as long at the same end state.
          maxinc *= 0.55;
          spdinc *= 0.55;
          gravinc *= 0.55;
        }
        e.attack_timer += 1;
        e.attack_max = scrApproach(e.attack_max, 3, maxinc);
        e.attack_grav = scrApproach(e.attack_grav, 18, gravinc);
        e.attack_spd = scrApproach(e.attack_spd, 3, spdinc);
        e.attack_spdir = scrApproach(e.attack_spdir, 3, spdinc);
      }
      const staramt = sideb(state) ? 8 : 7;
      const stardist = 360 / staramt;
      void stardist; // `_stardist` is computed and unused in this arm
      if (e.attack_timer >= e.attack_max) {
        e.attack_ind += 1;
        // No overshoot term here — the rings land on the cadence exactly.
        e.attack_timer -= e.attack_max;
        e.attack_dir += ((e.attack_spdir / 1.25) * e.attack_mult);
        e.attack_dir %= 360;
        for (let i = 0; i < staramt; i++) {
          const rot = (360 / staramt) * i;
          const bulang = rot + e.attack_dir;
          fireFinaleStar(
            state, e,
            knightX + lengthdirX(diststart, bulang),
            knightY + lengthdirY(diststart, bulang),
            { startype: 1, scale: 2, direction: bulang, distance: diststart },
          );
        }
      }
      if (e.attack_grav >= 18) {
        // attack_con becomes a LERPED REAL from here: 1.5 -> 2 over 16, then
        // 2.1 -> 2.5 over 20, then 2.51 -> 3 over 8. Every test against it
        // below is a gmlEq for exactly that reason.
        e.attack_con = 1.5;
        scrLerpvar(state, spawn, e, 'attack_con', 1.5, 2, 16);
        scrLerpvar(state, spawn, e, 'intensity', e.intensity, 4, 10);
        scrLerpvar(state, spawn, e, 'ball_darkness', e.ball_darkness, 0.5, 15);
        // audio_sound_gain(sound, 0, 900) — a 900ms fade. Audio only.
      }
    } else if (e.attack_con < 2) {
      // ── 285-293: the beam's pitch runs away while attack_con lerps to 2.
      e.beamPitch = (e.beamPitch ?? 0.08) + 0.02;
      cueTune(state, 'snd_knight_beam', e.beamPitch);
    } else if (gmlEq(e.attack_con, 2)) {
      // ── 294-355: the flourish. Pull released, darkness released, three
      // grow-ghosts. All three ghosts are VISUAL and consume no RNG.
      scrLerpvar(state, spawn, e, 'player_suck', e.player_suck, 0, 20);
      scrLerpvar(state, spawn, e, 'ball_darkness', e.ball_darkness, 0, 4);
      e.attack_con = 2.1;
      scrLerpvar(state, spawn, e, 'attack_con', 2.1, 2.5, 20);
      cue(state, 'snd_great_shine', 0.8, 0.7);
      cue(state, 'snd_great_shine', 1.2, 0.85);
    } else if (gmlEq(e.attack_con, 2.5)) {
      // ── 356-361: he drops another 240px as the roar winds up.
      e.attack_con = 2.51;
      scrLerpvar(state, spawn, e, 'fake_y', e.fake_y, e.fake_y + 240, 25, 2, 'out');
      scrLerpvar(state, spawn, e, 'attack_con', 2.51, 3, 8);
    } else if (gmlEq(e.attack_con, 3)) {
      // ── 362-377: THE ROAR, and the phase turns inside out.
      cueStop(state, 'snd_knight_beam');
      e.sound = -4;
      cue(state, 'snd_knight_roar', 0.9, 0.5);
      cue(state, 'snd_knight_roar', 0.75, 0.5);
      cue(state, 'snd_knight_roar', 0.5, 0.5);
      e.final_con = 2;
      e.attack_con = 0;
      // player_suck 18, POSITIVE, and final_con 2 applies it as
      // `obj_heart.y -= player_suck` — 18px of upward shove a frame.
      e.player_suck = 18;
      // `timer = 1000` — final_con 2 reads `tm = timer - 1000`, so the
      // finale's second half gets its own clock starting at 1.
      e.timer = 1000;
      scrLerpvar(state, spawn, e, 'knight_sprite_image', 4, 6, 3);
      for (const d of finaleStars(state)) destroy(d);
    }

    // ── 378-383: THE PULL. Gated on `final_con == 1` as well as the heart,
    // because attack_con 3 above sets final_con = 2 in this same frame and
    // the shove must not also run.
    if (heart && e.final_con === 1) {
      // THE DIRECTION READS THE PRE-STEP HEART, clamped by this event's own
      // corral — the same compensation the sim module's vanilla pull uses,
      // and for the same reason: the runner steps the roar before the
      // heart's own move, while this engine moves the soul in its own phase
      // first. See sim/attacks/roaring.js at `hp0`.
      const hp0 = state.soulPrev ?? heart;
      let hpx = hp0.x;
      let hpy = hp0.y;
      if (hpx < cvx) hpx = cvx;
      if (hpx > cvx + 640 - 20) hpx = cvx + 640 - 20;
      if (hpy < cvy) hpy = cvy;
      if (hpy > cvy + 480 - 20) hpy = cvy + 480 - 20;
      const tempdir = pointDirection(hpx + 10, hpy + 10, knightX, knightY);
      heart.x += lengthdirX(e.player_suck, tempdir);
      heart.y += lengthdirY(e.player_suck, tempdir);
    }
  } else if (e.final_con === 2) {
    // ══ 385-534 — THE CURTAINS ════════════════════════════════════════════
    const spdmult = Math.min(e.attack_grav / 17, 1);
    const tm = e.timer - 1000;

    if (tm === 1) {
      e.ball_speed = -32;
      e.ball_darkness = 1;
      scrLerpvar(state, spawn, e, 'bobble_freq', 1, 3, 8);
      const c = spawn(state, knightCircle, { x: knightX, y: knightY });
      c.r = 255;
      c.g = 255;
      c.b = 255;
      c.draw_in_box = false;
      e.attack_spd = 4.5;
      e.attack_dir = 64;
      e.attack_spdir = 1;
      if (!sideb(state)) {
        e.attack_timer = 11;
        e.attack_max = 11;
        e.attack_grav = 17;
        // attack_max 11 -> 9 over 220 IS THE PHASE CLOCK: reaching exactly 9
        // is what opens the hand-over below, so this tween's length is how
        // long the curtains last.
        scrLerpvar(state, spawn, e, 'attack_max', 11, 9, 220);
        scrLerpvar(state, spawn, e, 'attack_grav', 17, 18.2, 209);
      } else {
        e.attack_timer = 10;
        e.attack_max = 10;
        // ORIGINAL BUG (harmless, preserved): the B-Side arm does NOT set
        // `attack_grav = 17` the way the normal arm does, so attack_grav
        // keeps whatever the spiral left it at (~18) until the tween below
        // writes over it on the next frame.
        scrLerpvar(state, spawn, e, 'attack_max', 10, 8, 220);
        scrLerpvar(state, spawn, e, 'attack_grav', 17, 18.2, 209);
      }
    } else if (tm >= 4) {
      // `attack_max == (9 - kaizo_sideb())` — a LERPED REAL against an
      // integer, so gmlEq. It can only be true once the 220-frame tween has
      // finished, and it stays true afterwards because the tween destroys
      // itself and nothing else writes attack_max until the hand-over.
      if (gmlEq(e.attack_max, 9 - sideb(state))) {
        if (e.knight_sprite === 'spr_roaringknight_front_roar') { // 219
          e.knight_sprite = 'spr_roaringknight_front_flourish'; // 4959 (v091)
          e.knight_sprite_image = 6;
          e.knight_sprite_speed = 0;
          // 35 frames of pose, and reaching image 0 is the trigger below.
          scrLerpvar(state, spawn, e, 'knight_sprite_image', 6, 0, 35);
          scrLerpvar(state, spawn, e, 'ball_speed', e.ball_speed, e.ball_speed / 16, 70);
          scrLerpvar(state, spawn, e, 'bobble_freq', 3, 1, 60);
          scrLerpvar(state, spawn, e, 'attack_grav', e.attack_grav, 0, 70);
          scrLerpvar(state, spawn, e, 'player_suck', e.player_suck, 0, 70);
          scrLerpvar(state, spawn, e, 'intensity', e.intensity, 0, 30);
        }
        if (gmlEq(e.knight_sprite_image, 0)) {
          e.fix_draw = 1; // switches Draw_0 to the final-slash render path
          e.sprite_index = 'spr_roaringknight_front_slash';
          e.final_con = 3;
          e.knight_sprite = 'spr_roaringknight_front_slash'; // 4318 (v091)
          e.attack_max = 8;
          scrLerpvar(state, spawn, e, 'fake_y', e.fake_y, 170, 40, 2, 'out');
          scrLerpvar(state, spawn, e, 'knight_sprite_image', 0, 2.5, 41);
        }
      } else {
        // Until the curtains are done the upward shove ramps to 2.5 — the
        // soul is pinned near the top of the screen while they rise past it.
        e.player_suck = scrApproach(e.player_suck, 2.5, 1);
      }

      e.attack_timer += spdmult;

      if (tm === 4) {
        for (const rates of [[0.03, 0.02], [0.06, 0.04], [0.09, 0.08]]) {
          const g = spawn(state, afterimageScreen, { x: knightX, y: knightY });
          g.xrate = rates[0];
          g.yrate = rates[0];
          g.faderate = rates[1];
          g.draw_end = true;
        }
        e.knight_sprite = 'spr_roaringknight_front_roar'; // 219
        e.knight_sprite_image = 0;
        e.knight_sprite_speed = 0.35;
      }

      if (e.attack_timer >= e.attack_max) {
        cue(state, 'snd_stardrop', 0.5, 0.5);
        const starscale = 1.18;
        const asep = 124;
        const asepB = asep * 2;
        let leftB = -asepB;
        let rightB = 640 + asepB;
        // `attack_ind++` is DEAD — `attack_ind = sign(attack_spdir)` three
        // lines later overwrites it. Transcribed anyway.
        e.attack_ind += 1;
        e.attack_timer -= e.attack_max;
        e.attack_dir += (asep / 4);
        e.attack_dir %= asep;
        e.attack_ind = sign(e.attack_spdir);
        if (e.attack_spdir === -1) {
          // The volley walks right-to-left on alternate beats.
          const stuff = [leftB, rightB];
          leftB = stuff[1];
          rightB = stuff[0];
        }
        let i = leftB;
        // `while (_i != _rightB)` with `_i = scr_approach(_i, _rightB, 124)`:
        // the span is 1136, which is NOT a whole number of 124-steps, so the
        // last approach CLAMPS onto _rightB and ends the loop. Ten stars.
        while (i !== rightB) {
          const xx = cvx + i + (e.attack_dir * e.attack_spdir);
          // Spawned 80px BELOW the camera, in two rows 24px apart —
          // attack_ind flips every star, so the curtain is a zig-zag.
          const yy = cvy + 480 + 80 + (24 * e.attack_ind);
          e.attack_ind = -e.attack_ind;
          fireFinaleStar(state, e, xx, yy, {
            startype: 2, scale: starscale, direction: 0,
          });
          i = scrApproach(i, rightB, asep);
        }
        e.attack_spdir = -e.attack_spdir;
      }
    }

    // ── 530-533: THE SHOVE. Straight up, every frame, no direction maths.
    if (heart) heart.y -= e.player_suck;
  } else if (e.final_con === 3) {
    finalCut(e, state, heart, cvx, cvy);
  }

  finaleStarDrive(e, state, knightX, knightY);
  finaleGhostPin(e, state, cvx, cvy);
  finaleDrawBookkeeping(e, state);
}

/**
 * `final_con == 3` — Other_11:535-878, THE CUT. Split out only so
 * roaringFinal stays readable; the GML has it inline as the last arm of the
 * final_con chain, and it runs in exactly that slot.
 */
function finalCut(e, state, heart, cvx, cvy) {
  const spdmult = Math.min(e.attack_grav / 17, 1);
  void spdmult; // `_spdmult` is computed and never used in this arm

  if (gmlEq(e.attack_con, 0)) {
    // ── 538-575: the wind-up. The per-star red afterimage swarm is visual
    // (and there are no stars left by now — attack_con 3 of the spiral
    // destroyed them all); `global.time % 4` gates it, no RNG either way.
    if (e.knight_sprite === 'spr_roaringknight_front_slash') { // 4318
      if (e.knight_sprite_image >= 2.5) {
        cue(state, 'snd_knight_cut', 1, 0.8);
        cue(state, 'snd_knight_cut', 0.6, 0.6);
        e.attack_con = 1;
        e.knight_sprite_image = 2.5;
        e.attack_timer = 0;
      }
    }
  } else if (gmlEq(e.attack_con, 1)) {
    // ── 576-608: the swing. knight_sprite_image walks 2.5 -> 5 at 1/frame.
    e.attack_timer += 1;
    e.knight_sprite_image = scrApproach(e.knight_sprite_image, 5, 1);
    e.sprite_index = e.knight_sprite;
    e.image_index = e.knight_sprite_image;
    if (gmlEq(e.knight_sprite_image, 3.5)) {
      // THE CUT FRAME. A white flash (visual), three firework hits, and
      // every surviving star is handed the mod's NEW con-101 burst: spec
      // off so the offscreen cull re-arms, outbound true so it is armed
      // immediately, con 101 so it fires a fixed six-way starchild fan
      // three frames later. See ./roaring-final-star.js.
      cue(state, 'snd_explosion_firework', 1, 0.8);
      cue(state, 'snd_explosion_firework', 0.6, 0.6);
      cue(state, 'snd_explosion_firework', 0.8, 0.6);
      for (const d of finaleStars(state)) {
        d.spec = 0;
        d.outbound = true;
        d.con = 101;
      }
    }
    if (e.attack_timer === 45) {
      e.attack_con = 2;
      e.attack_timer = 0;
      e.attack_ind = 0;
    }
  } else if (gmlEq(e.attack_con, 2)) {
    // ── 609-688: THE 30 SLASH LINES. Every second frame, fifteen beats,
    // two lines a beat. This is the finale's whole hitbox.
    e.attack_timer += 1;
    if ((e.attack_timer % 2) === 0) {
      // RNG ORDER, per beat: irandom_range x2 (the knight's jitter), then
      // per line irandom(639), irandom(419), irandom(360), then the thrown
      // ghost's random_range x2. Every draw is taken in this order.
      const jx = gmlIrandomRange(state.gmlRng, -48, 48);
      const jy = gmlIrandomRange(state.gmlRng, -36, 36);
      scrLerpvar(state, spawn, e, 'fake_xoff', e.fake_xoff, jx, 2);
      scrLerpvar(state, spawn, e, 'fake_yoff', e.fake_yoff, jy, 2);
      e.attack_ind += 1;
      e.final_xs = -e.final_xs; // he flips left/right on every beat
      e.knight_sprite_image = 4;
      e.knight_sprite_speed = -1;
      cueStop(state, 'snd_knight_cut2');
      cue(state, 'snd_knight_cut2');
      for (let r = 0; r < 2; r++) {
        const lx = gmlIrandom(state.gmlRng, 639);
        const ly = gmlIrandom(state.gmlRng, 419);
        const lr = gmlIrandom(state.gmlRng, 360);
        const line = spawn(state, finalSlashLine, { x: lx, y: ly });
        line.flag = 'finalslash';
        line.mask = FINALSLASH_MASK;
        // 0.2 x 800 on a 10x10 CENTRED mask: a 2px-wide, 8000px-long bar
        // through (lx, ly) at `lr` degrees. attack_con 4 widens it to 0.4
        // one frame before the single hit test.
        line.image_xscale = 0.2;
        line.image_yscale = 800;
        line.image_angle = lr;
        line.image_blend = C_RED; // `image_blend = c_red` — see the constants' note
        // `visible = false` — Other_11:631. THE LINES NEVER DRAW THEMSELVES:
        // an invisible instance has no Draw event, and they reach the screen
        // only through obj_knight_roaring2's Draw_0:223-257 `with
        // (final_lines[_i]) draw_self()` (a direct call, which ignores
        // `visible`) — ported in kaizo/render/draw/roaring.js. Without this
        // the renderer's generic blit would draw a second copy at the
        // line's own depth the day its sprite lands in the manifest. Draw
        // state only; the hit test (attack_con 4) never reads it.
        line.visible = false;
        // the line's own trailing ghost: visual, no RNG. Skipped.
        e.final_lines.push(line);
        // The knight ghost thrown off with each line — VISUAL, but its
        // hspeed/vspeed are TWO random_range draws on the shared stream.
        // The draws are taken; the ghost is not made.
        gmlRandomRange(state.gmlRng, -8, 8);
        gmlRandomRange(state.gmlRng, -8, 8);
      }
    }
    if (e.attack_ind >= 15) {
      // 15 beats x 2 = THIRTY LINES, and they all stay on screen.
      cue(state, 'snd_knight_jump', 0.6, 0.9);
      cue(state, 'snd_knight_jump', 0.85, 0.9);
      e.attack_con = 3;
      e.attack_timer = 0;
      e.knight_sprite_speed = 0;
      e.knight_sprite_image = 1;
      scrLerpvar(state, spawn, e, 'fake_xoff', e.fake_xoff, 0, 28, 2, 'out');
      // He rises to a FIXED screen height: fake_y is 170 by now, so the
      // offset tween targets 100 - 170 and `_finalY` lands on exactly 100,
      // which is the attack_con 3 exit test.
      scrLerpvar(state, spawn, e, 'fake_yoff', e.fake_yoff, 100 - e.fake_y, 28, 2, 'out');
      scrLerpvar(state, spawn, e, 'knight_sprite_image', 1, 2.4, 28);
    }
  } else if (gmlEq(e.attack_con, 3)) {
    // ── 689-725: the rise. attack_max shrinks as he closes on y 100, so the
    // ghost trail thickens the nearer he gets. The ghost is visual.
    const finalY = e.fake_y + e.fake_yoff;
    e.attack_max = (4 + Math.abs(finalY - 100)) / 4;
    e.attack_timer += 1;
    if (e.attack_timer >= e.attack_max) {
      e.attack_timer = 0;
    }
    if (finalY <= 100) {
      e.attack_timer = 0;
      e.attack_con = 4;
      scrLerpvar(state, spawn, e, 'knight_sprite_image', 2, 5, 3);
    }
  } else if (gmlEq(e.attack_con, 4)) {
    // ── 726-804: THE HIT, on exactly one frame.
    e.attack_timer += 1;

    if (e.attack_timer === 1) {
      // The lines go WHITE and double in width — the tell, one frame before
      // the test.
      cueStop(state, 'snd_knight_jump');
      cue(state, 'snd_knight_cut', 0.8, 0.8);
      cue(state, 'snd_knight_cut2', 0.6, 0.8);
      for (let i = 0; i < e.final_lines.length; i++) {
        const line = e.final_lines[i];
        if (!line || !line.alive) continue;
        line.image_blend = C_WHITE; // `image_blend = c_white` — see the constants' note
        line.image_xscale = 0.4;
        // the per-line white ghost: visual, no RNG. Skipped.
      }
    }

    if (e.attack_timer === 2) {
      e.final_hit = 0;
      e.final_kill = 0;
      for (let i = 0; i < e.final_lines.length; i++) {
        const hitbox = e.final_lines[i];
        // `var _hx = obj_heart.x + 10; var _hy = obj_heart.y + 10;` —
        // computed and NEVER USED. Dropped.
        //
        // ORIGINAL BUG, preserved: `image_xscale = 0.3;` here and
        // `image_xscale = 0.2;` at the bottom of the loop sit OUTSIDE the
        // `with (_hitbox)`, so they write obj_knight_roaring2's OWN
        // image_xscale, not the line's. The evident intent was to widen the
        // hitbox for the test and narrow it again after; what actually
        // happens is that the CONTROLLER's scale is set to 0.3 and then 0.2
        // once per line, and every line tests at the 0.4 the attack_timer-1
        // block gave it. Do NOT "fix" this — the 0.4 bar is the real hitbox.
        e.image_xscale = 0.3;
        if (hitbox && hitbox.alive) {
          // `place_meeting(x + camerax(), y + cameray(), obj_heart)` — the
          // line's stored position is SCREEN space; the camera is added back
          // for the test. Precise soul mask vs the rotated, scaled bar, run
          // through the calibrated engine overlap model.
          const hit = !!heart && masksOverlap(
            heart.mask ?? HEART_MASK, heart.x, heart.y,
            FINALSLASH_MASK, hitbox.x + cvx, hitbox.y + cvy,
            hitbox.image_xscale, hitbox.image_yscale, hitbox.image_angle,
          );
          if (hit) {
            if (state.invTimer < 0) {
              e.final_hit = 1;
              // `target = 3` — see scrDamageAllMaxhp's note: it exists only
              // so the script's save/restore has something to read.
              //
              // 75% OF MAX HP TO EVERY LIVING MEMBER, ignoring DEFEND
              // (arg1 = 1) and ABLE TO FELL (arg2 = 0). One line landing is
              // the whole finale's damage; the invulnerability the call
              // grants closes the door on the other 29.
              finaleDamageAllMaxhp(state, 0.75, 1, 0);
              state.invTimer = state.invc * 30;
            }
          }
        }
        // THE PARTY-WIPE TEST IS INSIDE THE LOOP, so it is re-evaluated
        // after every line (Other_11:786-794):
        //
        //     if ((!scr_havechar(1) || global.hp[1] < 0) && ... && (!scr_havechar(4) || global.hp[4] < 0)) {
        //         final_kill = 1; global.hp[1] = 1; ... global.hp[4] = 1;
        //         mus_volume(global.batmusic[1], 0, 0); }
        //
        // CHARACTER-indexed, ids 1..4, and an ABSENT member passes its clause
        // — so it is read through the roster (2026-09-08): a two-person Weird
        // Route party (Kris + Noelle, no id 2/3) is wiped by its two fells.
        // The `partyHp[0] < 0 && [1] < 0 && [2] < 0` form this replaced could
        // never fire there: its third index is undefined, and `undefined < 0`
        // is false. The comparison is `< 0`, STRICTLY: a member sitting on
        // exactly 0 does not count, which is the difference between the mod's
        // scripted failure and a normal wipe.
        let wiped = true;
        for (let c = 1; c <= 4; c++) {
          if (havechar(state, c) && !(hpOfChar(state, c) < 0)) wiped = false;
        }
        if (wiped) {
          e.final_kill = 1;
          // Everyone is restored to 1 HP: the mod does not want an ordinary
          // Game Over here, it wants the scripted failure below. `global.hp[c]
          // = 1` for all four ids; an absent id's write lands nowhere, as the
          // mod's does in a cell this fight never reads.
          for (let c = 1; c <= 4; c++) setHpOfChar(state, c, 1);
          // mus_volume(global.batmusic[1], 0, 0) — audio.
        }
        e.image_xscale = 0.2; // ORIGINAL BUG, see above
      }
    }

    if (e.attack_timer === 3) {
      e.attack_con = 5;
      e.attack_timer = 0;
    }
  } else if (gmlEq(e.attack_con, 5)) {
    // ── 805-845: the board is torn down and the screen shatters.
    e.attack_con = 6;
    // A LANDED HIT BUYS SIX MORE FRAMES of falling glass before the turn
    // ends: attack_con 6 then counts from -6 instead of 0.
    if (e.final_hit) e.attack_timer = -6;
    if (e.hideback && e.hideback !== -4 && e.hideback.alive) {
      // `with (obj_battlecontroller) other.depth = depth - 999` — the cover
      // jumps in front of everything. Depth only.
      e.hideback.depth = -999;
      if (e.final_kill === 0) {
        scrLerpvar(state, spawn, e.hideback, 'image_alpha', 1, 0, 45);
      }
    }
    // `with (obj_knight_enemy) { scr_screenshatter_create(); image_alpha =
    // 1; state = 0; }` — the glass is cut from the live screen and thrown;
    // the knight is handed back visible and idle.
    screenshatterCreate(state, { finalHit: !!e.final_hit });
    if (state.knight) {
      state.knight.image_alpha = 1;
      state.knight.state = 0;
    }
    cue(state, 'snd_impact', 1, 0.6);
    e.stop = true;
    for (const gt of state.entities) {
      if (!gt.alive || gt.type.name !== 'obj_growtangle') continue;
      gt.visible = false;
      gt.growcon = 3;
      gt.timer = 0;
    }
    for (const k of state.entities) {
      if (k.alive && k.type.name === 'obj_knight_pointing_starchild') destroy(k);
    }
    if (heart) heart.visible = false;
  } else if (gmlEq(e.attack_con, 6)) {
    // ── 846-875: THE TURN ENDS HERE.
    e.attack_timer += 1;
    if (e.attack_timer === 1) {
      cue(state, 'snd_glassbreak', 0.75, 0.8);
      cue(state, 'snd_glassbreak', 0.5, 0.75);
      cue(state, 'snd_glassbreak', 0.4, 0.7);
    }
    // `global.turntimer = 4` EVERY FRAME — the clock is held just above zero
    // so nothing else can end the turn while the glass falls.
    state.turntimer = 4;

    if (e.final_kill && e.attack_timer > 1) {
      // THE SCRIPTED FAILURE. The mod pins its own clock and waits for the
      // last glass piece to fall off the bottom of the screen, then leaves
      // the fight entirely:
      //
      //     audio_stop_all(); snd_free_all();
      //     global.tempflag[75] = 1; room_goto(PLACE_FAILURE);
      //
      // DEVIATION (there is no room system here): the flag is raised on the
      // state for the scene owner to read, and the turn is ALSO released.
      // Without the release a kaizo schedule would deadlock on a turn that
      // can never end, which is strictly worse than a labelled stand-in.
      // Nothing in kaizo/ reads `finalFailure` yet — see the work item's
      // open list.
      e.attack_timer = 2;
      const remaining = state.knight?.shatter_sprs?.length ?? 0;
      if (remaining === 0) {
        (state.kaizo ??= {}).finalFailure = true;
        state.turntimer = -1;
        if (heart) {
          destroy(heart);
          state.soul = null;
        }
      }
    }

    if (e.attack_timer >= 60) {
      // THE HAND-BACK, and the reason this finale cannot hang the schedule:
      // the launcher pins global.turntimer to 999999 for type 107 so the
      // clock cannot cut the attack short, and this is where the attack
      // gives it back. Same contract as the vanilla roar's roaring_timer 375
      // in the sim module above.
      state.turntimer = -1;
      if (heart) {
        destroy(heart);
        state.soul = null;
      }
    }
  }

  // ── 876-877: the pose is stamped onto the sprite every frame of the cut.
  e.sprite_index = e.knight_sprite;
  e.image_index = e.knight_sprite_image;
}

/**
 * Other_11:879-949 — THE STARS, driven ENTIRELY by the controller, on every
 * frame of every phase.
 *
 * obj_knight_roaring_star has no motion of its own here (speed 0), exactly
 * as in the vanilla roar's spiral: the controller re-derives each star's
 * position from its own `attack_*` fields. Two families:
 *
 *   startype 1  polar around the knight. `direction` advances by the star's
 *               own rotspeed, `distance` shrinks by attack_grav, and the
 *               scale is read back off the remaining distance — so they GROW
 *               as they close, the opposite of the vanilla ring stars.
 *   startype 2  the curtain. Straight up at attack_grav, drifting sideways
 *               at rotspeed, culled at a RAW y of -120.
 *
 * Order does not matter (each star reads only itself and the controller),
 * but the `with`'s newest-first order is kept.
 */
function finaleStarDrive(e, state, knightX, knightY) {
  for (const d of finaleStars(state)) {
    if (d.startype === 1) {
      let maxscale = 2.4;
      let addscale = 0.2;
      if (gmlEq(e.attack_con, 0)) {
        // The GML's arm here is EMPTY — the defaults above stand.
      } else if (gmlEq(e.attack_con, 1)) {
        maxscale = 2.5;
        addscale = 0.3;
        if (e.attack_grav > 13) addscale += ((e.attack_grav - 13) * 0.007);
        if (sideb(state)) {
          // B-SIDE STARS STAY SMALLER. Same positions, less ink — the whole
          // B-Side retune of this phase is "slower ramps, thinner bullets".
          maxscale = 2.4;
          addscale = 0.2;
          if (e.attack_grav > 13) addscale += ((e.attack_grav - 13) * 0.005);
        }
      } else if (e.attack_con < 3) {
        maxscale = 2.5;
        addscale = 0.342;
        if (sideb(state)) {
          maxscale = 2.4;
          addscale = 0.2;
          if (e.attack_grav > 13) addscale += ((e.attack_grav - 13) * 0.005);
        }
      }
      const diststart = 640;
      const scalefac = diststart / maxscale;
      d.direction += (d.rotspeed * e.attack_mult);
      d.distance -= e.attack_grav;
      d.image_xscale = Math.max(d.distance / scalefac, 0.1) + addscale;
      d.image_yscale = Math.max(d.distance / scalefac, 0.1) + addscale;
      d.x = knightX + lengthdirX(d.distance, d.direction);
      d.y = knightY + lengthdirY(d.distance, d.direction);
      if (d.distance <= 0) {
        d.x = knightX;
        d.y = knightY;
        // A one-frame hold ON the knight before it goes: distance has to
        // pass -0.25 and attack_grav is 12-18, so this is always the very
        // next frame, at full scale, sitting on top of him.
        if (d.distance <= -0.25) destroy(d);
      }
    } else if (d.startype === 2) {
      const sm = Math.min(e.attack_grav / 17, 1);
      d.x += (d.rotspeed * sm);
      d.y -= e.attack_grav;
      // RAW y, not camera-relative — transcribed as written. With the view
      // at 0 (every scene this sim builds) that is 120px above the screen.
      if (d.y <= -120) destroy(d);
    }
  }
}

/**
 * Other_11:950-957 — the untargeted grow-ghosts ride the phantom knight.
 *
 * `if (target < -1)` is TRUE FOR THE DEFAULT: obj_afterimage_grow's Create
 * sets `target = -4`, and every ghost the finale makes without an explicit
 * target keeps it. So the whole untargeted swarm is re-pinned to the knight
 * (bobble included) every frame instead of being left behind. The ghosts are
 * visual; the pin is transcribed because it is the controller's own code and
 * costs nothing.
 */
function finaleGhostPin(e, state, cvx, cvy) {
  for (const g of state.entities) {
    if (!g.alive || g.type !== afterimageGrow) continue;
    if (typeof g.target === 'number' && g.target < -1) {
      g.x = cvx + e.fake_x + e.fake_xoff;
      g.y = ((cvy + e.fake_y + (Math.sin(e.bobble_count * 0.1) * e.bobble_amp)) - 10)
        + 55 + e.fake_yoff;
    }
  }
}

/**
 * Draw_0 BOOKKEEPING. The GML's Step `exit`s in final mode, but Draw_0 still
 * runs and still advances these; the sim module keeps them in its own step
 * tail for the same reason (a headless run must produce the browser's
 * numbers). No RNG, no gameplay — the renderer reads them.
 */
function finaleDrawBookkeeping(e, state) {
  if (e.stop) return;
  e.ball_counter += e.ball_speed;
  if (e.ball_counter < 0) e.ball_counter += 1800;
  if (e.ball_counter > 1800) e.ball_counter -= 1800;
  // KAIZO Draw_0: the hue walk is split three ways. roaring_type 0, and
  // roaring_type 1 with B-Side off, keep the vanilla 128..288 bounce;
  // B-SIDE RAMPS `hsv` FOREVER, because its colour comes from a 5-entry
  // table indexed by `hsv % 300` instead of from make_color_hsv.
  if (sideb(state)) {
    e.hsv += 1;
  } else {
    if (!e.hsv_switch) e.hsv += 1;
    else e.hsv -= 1;
    if (e.hsv >= 288) e.hsv_switch = true;
    if (e.hsv <= 128) e.hsv_switch = false;
  }
  if (e.intensity < 3.75) e.intensify = e.intensity;
  else e.intensify = scrApproach(e.intensify, 0, 0.1);
}

/**
 * CleanUp_0's kaizo hunks (kaizo 17-20 and 38-51): free `hp_surf`, then in
 * final mode destroy every surviving `final_lines[]` marker and `hideback`.
 *
 * Called from the type's `cleanUp` (above), which the engine fires on every
 * destroy(e, state) — the turn sweep included. (This header used to claim the
 * engine had no CleanUp hook; sim/entity.js has had one since the boxsplitter
 * needed it, and the finale simply never declared one.) `hp_surf` is a GPU
 * surface with no sim analogue.
 *
 * Exported so a launcher that tears the controller down explicitly can run
 * the mod's own teardown instead of relying on the sweep.
 */
export function roaringFinalCleanUp(state, e) {
  if (!e || e.roaring_type !== 1) return;
  for (let i = 0; i < (e.final_lines ?? []).length; i++) {
    const line = e.final_lines[i];
    if (line && line !== -4 && line.alive) destroy(line);
  }
  e.final_lines = [];
  if (e.hideback && e.hideback !== -4 && e.hideback.alive) destroy(e.hideback);
  e.hideback = -4;
  void state;
}
