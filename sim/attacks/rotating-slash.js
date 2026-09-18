// obj_knight_rotating_slash — attack 4, `rotatingslash` (myattackchoice 5).
//
// The first translated attack the fight ACTUALLY USES: the selector picks it
// in every phase, and combinationattack chains it too. Reached from
// obj_dbulletcontroller `type = 104`, which is a thin wrapper that creates
// this object, sets difficulty, and fires event_user(0).
//
// Shape: a rotating aimer that periodically fires a fan of slashes at the
// soul. States advance intro -> aim -> slash -> cooldown -> (aim | slash |
// return), driven entirely by `timer`.
//
//   aim      spin the aim direction, lock onto the soul on frame 1
//   slash    build `slash_number` angles evenly spaced around a circle,
//            offset by random_offset + aim_direction, shuffle them, then fire
//            one obj_roaringknight_slash per frame from the list
//   cooldown step slash_array to the next fan size, then loop
//
// Both things it spawns are already translated and oracle-verified:
// obj_roaringknight_slash (attack 1) and, via quickslash_big, the
// split_growtangle organism (attack 3).
//
// THE SPIRAL FINISHER (difficulty 2 only) is translated. After the six cuts,
// `slashes_done` forks the attack:
//
//   difficulty 2 + turn_type "full"   ->  do_final: aim_type 0 -> 1 -> 2 in one
//                                         frame, and the attack changes shape
//   anything else                     ->  state "return", alarm[3] = 22, done
//
// At aim_type 2 there is NO AIM PHASE any more. Cooldown goes straight back to
// slash, so the knight fires every ~3 frames while `aim_direction` advances by
// an accelerating `speed_gain` (16 -> 24 over eight slashes, then flat) for 28
// slashes, teleporting around the box between shots. He also stops aiming at
// the player: `aim_x/aim_y` are pinned to the box centre once, at the handoff,
// and every one of the 28 slashes spawns there.
//
// Alarm_3 is one line, `instance_destroy()`, 22 frames after the last slash.
//
// NOT translated (cosmetic, and none of it touches frame state): the knight's
// sprite/lerp movement, particle bursts, obj_afterimage debris, sounds, and the
// colour ramps (r/g/b, line_width). obj_knight_circle IS translated now — the
// aim bloom, sim/fx.js + render/draw/knight-circle.js.
//
// SHUFFLE CAVEAT: ds_list_shuffle consumes 16 draws per element but its
// algorithm is unsolved (see CLAUDE.md). This uses our own Fisher-Yates over
// gmlRng — statistically equivalent, NOT bit-identical. The real game
// reshuffles every playthrough, so order is not a fidelity property; the
// oracle diff fixes the order on both sides to pin the mechanics.

import { scrLerpvar } from '../lerpvar.js';
import { spawn, destroy } from '../entity.js';
import { roaringknightSlash } from './roaringknight-slash.js';
import { knightCircle, knightWarp, knightWarpOut } from '../fx.js';
import { cue, cueLoop, cueStop } from '../audio.js';
import { nbcOn } from './nbc.js';
import { scrApproach } from '../gml.js';
import { gmlChoose, gmlIrandom, gmlRandom, gmlRandomRange, gmlU32 } from '../rng.js';
import { scrBulletInherit } from '../bullets/regularbullet.js';
import { chainNext } from './combination.js';

/** Fisher-Yates over the real generator. See SHUFFLE CAVEAT above. */
function shuffleList(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = gmlU32(rng) % (i + 1);
    const t = list[i];
    list[i] = list[j];
    list[j] = t;
  }
  return list;
}

export const rotatingSlash = {
  name: 'obj_knight_rotating_slash',

  create(e, state) {
    // scr_bullet_init()
    e.grazed = 0;
    e.grazetimer = 0;
    e.destroyonhit = 1;
    e.target = 0;
    e.inv = 60;
    e.damage = 10;
    e.element = 0;
    e.grazepoints = 1;
    e.timepoints = 1;
    e.active = 1;
    e.updateimageangle = 0;

    // Create line 3. Without it the engine's default image_speed of 1 walks
    // (and wraps) this object's frames every step — the same loop that made
    // the Stars cone flick through its point animation.
    e.image_speed = 0;
    // MEASURED from traces/rotating_d2.csv — the object's default sprite is in
    // its GameMaker definition, not the GML, so the recording is the only
    // place it is written down. THIS object is the visible knight during the
    // attack, which is why it looked like there was no animation at all: it
    // had no sprite to draw.
    e.sprite_index = 'spr_roaringknight_attack_ol';
    e.image_index = 0;
    // Scale 2, measured — the knight is drawn at 2x everywhere. Left at
    // GameMaker's default 1 this drew a half-size knight beside the real one.
    e.image_xscale = 2;
    e.image_yscale = 2;

    e.difficulty = 2;
    e.slash_number = 1;
    e.rotation = 16;
    e.rotation_base = 16;
    // Marker colour, ramped grey -> red through each aim (Draw reads r/g/b).
    e.r = 0;
    e.g = 0;
    e.b = 0;
    e.line_width = 4;
    e.line2 = -1;
    e.line3 = -1;
    e.rotation_change = 1;
    e.rotation_goal = 2;
    e.timer = 0;
    e.state = 'intro';
    e.turn_type = 'full';
    e.local_turntimer = 0;
    e.aim_direction = 0;
    e.spin = state.spinSequence
      ? state.spinSequence[state.spinIndex++]
      : gmlChoose(state.gmlRng, [-1, 1]);
    e.random_offset = gmlIrandom(state.gmlRng, 360);
    e.slash_array = [1, 2, 2, 3, 3, 4];
    e.slash_counter = 0;
    e.final_counter = 0;
    e.slash_base = 18;
    e.slash_offset = 6;
    e.speed_gain = 16;
    e.cooldown_time = 6;
    e.slash_timer = 8;
    e.aim_type = 0;
    e.anchor_x = e.x;
    e.anchor_y = e.y;
    // The pending `scr_script_delayed(scr_lerpvar, 8, ...)` of the non-spiral
    // return, declared here with every other field so a reader of create()
    // sees the whole instance. Null until that branch arms it.
    e.returnLerp = null;
    e.aim_x = e.x;
    e.aim_y = e.y;
    e.slash_list = [];
    e.movebox_x = 40;
    e.movebox_y = 60;
    e.do_final = true;
    e.turn_limit_4 = 270;
    e.slashes_done = false;
    e.done = false;
  },

  /** Other_10 — event_user(0), fired by the controller right after create. */
  init(e) {
    if (e.difficulty === 1) {
      e.slash_offset = 6;
      e.slash_number = 3;
      e.slash_array = [2, 3, 4, 4, 4, 4];
    }
    if (e.difficulty === 2) {
      e.slash_offset = 0;
      e.slash_number = 3;
      e.slash_array = [3, 4, 4, 4, 4, 4];
    }
    // THE COMBINATION'S ARMS. Other_10's turn_type block, verbatim — each
    // form is just a shorter clock and a head start on `timer`, which is what
    // lets three attacks share one turn without any of them being cut off
    // mid-pattern.
    if (e.turn_type === 'full') e.local_turntimer = 400;
    if (e.turn_type === 'start') e.local_turntimer = 320;
    if (e.turn_type === 'end') {
      e.local_turntimer = 300;
      e.timer = 15;
    }
    if (e.turn_type === 'short start') {
      e.local_turntimer = 270;
      e.timer = 12;
      e.turn_limit_4 = 250;
    }
    if (e.turn_type === 'short mid') {
      e.local_turntimer = 260;
      e.timer = 15;
      e.turn_limit_4 = 250;
    }
    if (e.turn_type === 'short end') {
      e.local_turntimer = 260;
      e.timer = 15;
    }
  },

  alarm: {
    /** Alarm_3: `instance_destroy()` — which fires the CleanUp below. */
    3(e, state) {
      // CleanUp: the turn-CLOSING instance hands the clock its -1 —
      //
      //     if (turn_type != "start" && turn_type != "short start"
      //         && turn_type != "short mid" && scr_bulletparent_count() < 2) {
      //         with (obj_knight_enemy) image_alpha = 1;
      //         global.turntimer = -1;
      //     }
      //
      // The controller runs this whole turn at turntimer 999999, so WITHOUT
      // this line the turn cannot end at all: the strict clock rule (sweep at
      // turntimer <= 0, no manager-death shortcut) hung the fight-order suite
      // on turn 5 forever. The chained "start"/"short" instances from the
      // combination attack leave the clock alone — their successor closes it.
      const closing =
        e.turn_type !== 'start' &&
        e.turn_type !== 'short start' &&
        e.turn_type !== 'short mid';
      // `scr_bulletparent_count() < 2` — CORRECTED 2026-08-28. The script
      // counts instances whose object_index is EXACTLY obj_bulletparent
      // (`with (obj_bulletparent) if (object_index == obj_bulletparent)`),
      // and in the knight fight nothing ever creates a bare obj_bulletparent
      // (the only creators in the whole dump are a Tasque Manager attack and
      // overworld rain) — so the test is ALWAYS TRUE here, exactly as
      // underbox.js already documents for its own copy of the same line.
      // This used to be translated as "alive bullet entities < 2", which is
      // a DIFFERENT predicate: equivalent in every vanilla scenario (nothing
      // else is alive when a rotating-slash turn ends), but it deadlocked
      // the turn the moment a schedule layered the rotating slash over a
      // long-lived sibling (the kaizo lane's rotating+vortex pairing — the
      // vortex's six orbiting swords held the count at 6 and the clock at
      // 999999 forever). Vanilla-neutral by the full trace diff.
      if (closing) {
        const knight = state.entities.find(
          (x) => x.alive && x.type.name === 'obj_knight_enemy',
        );
        if (knight) knight.image_alpha = 1;
        state.turntimer = -1;
      }
      destroy(e);
    },

    /**
     * Alarm_2 — THE HANDOFF, and it is a SEPARATE alarm from the destroy
     * above. The object ends one of two ways: alarm 3 (its own end, which
     * closes the turn) or alarm 2 (hand the turn to the next segment). Only
     * the combination arms this one.
     */
    2(e, state) {
      chainNext(state, e);
      // `instance_destroy();` is the last line of Alarm_2 — the segment that
      // hands on does not linger. Without it the outgoing rotating slash was
      // still on screen while the next segment played.
      destroy(e);
    },
  },

  /**
   * THE CONTROLLER'S OWN STEP, AND IT IS AN END STEP FOR A MEASURED REASON.
   *
   * NO BULLET COOLDOWNS: THIRTY OF THESE, NOT ONE.
   *
   *     obj_dbulletcontroller_Step_0.gml, the `type == 104` arm
   *     -   if (made == false)
   *     +   if (instance_number(obj_knight_rotating_slash) < 30)
   *
   * The controller's gate stops being “once ever” and becomes “while there
   * are fewer than thirty alive”, so it keeps creating managers every frame
   * until the arena holds thirty of them.
   *
   * WHY IT LIVES ON A MANAGER. This sim has no obj_dbulletcontroller entity
   * for type 104 — sim/scenes/fight.js calls spawnRotatingSlash once,
   * directly — so there is no controller Step for the gate to sit in. The
   * FIRST manager carries the controller's job instead: it is the one the
   * dispatch created, it is marked at creation, and it alone tops the
   * population up. Putting this in every instance would have each new manager
   * spawn more, which is not a faster attack but an exponential one.
   *
   * WHY IT IS THE END STEP AND NOT THE STEP. GameMaker runs a Step event by
   * visiting instances grouped by OBJECT INDEX, and the three objects in this
   * frame are ordered
   *
   *     obj_knight_rotating_slash   669
   *     obj_battlecontroller       1393
   *     obj_dbulletcontroller      1432
   *
   * so every manager steps, THEN the battle controller decrements the clock
   * and sweeps the turn if it has run out, and only THEN does the controller
   * top the population up. This engine's equivalents of the middle one are
   * `turnClock` (stepOrder -100) and the director, and both do their work in
   * the END STEP phase — so an end-step top-up at the default order lands in
   * exactly the controller's slot, after every manager's Step and after the
   * sweep. It used to run at the TOP of the lead manager's Step, which put
   * each extra's `spin` and `random_offset` draws ahead of twenty-nine
   * managers' own teleport draws instead of behind them.
   *
   * It also means a swept turn does not top up: `runPhase` skips entities the
   * director has already killed, which is what the game gets from the dc
   * being an obj_bulletparent the sweep destroys.
   *
   * ROTATING SLASH CLOSES EVERY PHASE, which is why this being missed was
   * worth finding: it measured EXACTLY x1.00 on every metric at every
   * difficulty while the toggle was on, and it is the attack a player sees
   * more than any other.
   */
  endStep(e, state) {
    if (e.nbcController && nbcOn(state)) {
      let live = 0;
      for (const o of state.entities) {
        if (o.alive && o.type === rotatingSlash) live += 1;
      }
      if (live < 30) {
        // AT THE KNIGHT, NOT AT THIS MANAGER. The GML line is
        //
        //     instance_create(creatorid.x, creatorid.y,
        //                     obj_knight_rotating_slash)
        //
        // and `creatorid` is obj_knight_enemy — scr_bulletspawner.gml:5 sets
        // `__dc.creatorid = id;` and the only assigners of type 104 are the
        // knight's own Step. The body of the arm is byte-identical in both
        // dumps; the mod changed only the gate above it, so all thirty are
        // born AT HIS POST and fan out from there.
        //
        // This used to read `{ x: e.x, y: e.y }` — the LEAD manager, which
        // lerps all over the arena (an aim hop per cycle, and a teleport
        // every ~3 frames through the difficulty-2 spiral), so it is the
        // knight's position on the very first ramp frame and nowhere near it
        // afterwards. Measured on a difficulty-2 drill: 60 of 60 extras born
        // at least 11.27px off, worst 85.57px. The picture is the difference
        // between thirty knights peeling off the one knight and thirty
        // budding off a wandering clone.
        const src = state.entities.find(
          (x) => x.alive && x.type.name === 'obj_knight_enemy',
        ) ?? e;
        const extra = spawn(state, rotatingSlash, { x: src.x, y: src.y });
        extra.difficulty = e.difficulty;
        rotatingSlash.init(extra);
      }
    }

  },

  step(e, state) {
    // `obj_knight_enemy.siner2 = 0;` — THE FIRST LINE OF THIS STEP, and it
    // runs every frame the slash is alive. It PINS THE KNIGHT'S BOB: the
    // Draw ticks siner2 to 1 immediately afterwards, so his y sits at a
    // constant `ystart + cos(1/8) * 8` = 85.9375839233 for the whole attack
    // instead of swinging. Five windows of 241-348 frames a fight, and the
    // sim bobbed through all of them — up to 15.9 pixels off, and invisible
    // to every traced column because the knight's y is not among the 176.
    // obj_knight_tunnel_slasher_2_revised and obj_knight_swordfall open with
    // the same line.
    //
    // `anchor_x = obj_knight_enemy.x; anchor_y = obj_knight_enemy.y;` are the
    // Step's NEXT TWO LINES, and they are a per-frame RE-DERIVATION, not a
    // one-off. create() seeds the pair from the spawn point (the dump's own
    // `anchor_x = x` at Create:35-36) and this overwrites it every frame
    // thereafter, so the return glide below always aims at wherever the
    // knight is STANDING NOW rather than wherever this instance was born.
    // The sim only had the create-time seed, which is the same value in
    // vanilla — one manager, born at the knight — and a different one for
    // every NBC top-up that was born somewhere else.
    {
      const kx = state.entities.find(
        (x) => x.alive && x.type.name === 'obj_knight_enemy',
      );
      if (kx) {
        kx.siner2 = 0;
        e.anchor_x = kx.x;
        e.anchor_y = kx.y;
      }
    }
    tickReturnLerp(state, e);
    // The decrement is ABOVE the `done` guard deliberately. There is no `done`
    // in the original — the object keeps running its Step, doing nothing,
    // until Alarm_3 destroys it, and `local_turntimer` keeps counting down the
    // whole time. Guarding it too left the value one high from the frame the
    // finale ended, which the recording catches at frame 342.
    e.local_turntimer -= 1;
    if (globalThis.process?.env?.KNIGHT_RS_DEBUG) {
      const f = globalThis.__simFrame;
      const [a, b] = globalThis.process.env.KNIGHT_RS_DEBUG.split('-').map(Number);
      if (f >= a && f <= (b ?? a) && (e.state !== e._lastLoggedState || e.local_turntimer === 199)) {
        console.error(`[rs] f=${f} state=${e.state} timer=${e.timer} ltt=${e.local_turntimer}`
          + ` sc=${e.slash_counter} done=${e.slashes_done} a3=${e.alarm[3]}`);
        e._lastLoggedState = e.state;
      }
    }
    if (e.done) return;

    // `if (image_index >= 5 && aim_type != 2) { image_index = 5; image_speed = 0; }`
    if (e.image_index >= 5 && e.aim_type !== 2) {
      e.image_index = 5;
      e.image_speed = 0;
    }

    if (e.state === 'intro') {
      e.timer += 1;
      if (e.timer > 16) {
        e.state = 'aim';
        e.timer = 0;
      }
    }

    if (e.state === 'aim') {
      e.timer += 1;
      if (e.timer === 1) {
        // `snd_stop` then `snd_loop` — the aim's rising whine, restarted at the
        // top of every cycle so it cannot stack.
        cueStop(state, 'snd_knight_rotatingslash_line');
        cueLoop(state, 'snd_knight_rotatingslash_line');
        e.rotation = e.rotation_base;
        // THE TELEGRAPH RESETS TO GREY at the top of every aim, then charges
        // toward RED — see the else arm below. The markers are drawn as a
        // gradient in this colour with a BLACK marker over it, so what the
        // player reads is a black slash line that reddens as the cut nears.
        e.r = 128;
        e.g = 128;
        e.b = 128;
        e.spin = state.spinSequence
      ? state.spinSequence[state.spinIndex++]
      : gmlChoose(state.gmlRng, [-1, 1]);
        e.movebox_x += 20 + gmlIrandom(state.gmlRng, 40);
        e.movebox_y += 30 + gmlIrandom(state.gmlRng, 60);
        if (e.movebox_x > 80) e.movebox_x -= 80;
        if (e.movebox_y > 120) e.movebox_y -= 120;

        // THE POSE, hand-stepped rather than free-running. He resets to frame
        // 1 as the aim begins; the spiral swaps to a different sprite instead.
        if (e.aim_type !== 2) {
          e.image_index = 1;
        } else {
          e.sprite_index = 'spr_roaringknight_flurry_prepare';
          e.image_index = 0;
        }

        // AND HE MOVES. Two lines of the original that were never translated:
        //
        //     scr_lerpvar("x", x, (scr_get_box(0) - 20) + movebox_x,
        //                 (slash_base + slash_offset) - 8, 1, "out");
        //     scr_lerpvar("y", y, (scr_get_box(1) - 20) + movebox_y,
        //                 (slash_base + slash_offset) - 8, 1, "out");
        //
        // The `movebox` walk above was translated and then had nothing to
        // drive, so the Knight stood on his anchor for the whole attack at
        // difficulties 0 and 1, and at difficulty 2 the ONLY thing that ever
        // moved him was the finale's spiral block (which does have these
        // lines). That is what the report is: with nothing else moving, the
        // finale's single descent reads as the Knight dipping for no reason,
        // rather than as the last of a dozen repositions.
        //
        // The two edges are the box's RIGHT and TOP — scr_get_box's indices
        // are not in the order the names suggest, see boxEdges — so he circles
        // the arena's top-right corner, `movebox_x` over [0, 80] and
        // `movebox_y` over [0, 120]. At the default box that is x 375..455,
        // y 75..195: he really does swing down past the arena's top edge, and
        // the sim was reaching less of that range, not more.
        //
        // NOT AN RNG CONCERN: scr_lerpvar draws nothing, so the stream and
        // every anchored diff are unaffected. verify-rotating compares state,
        // timers, aim and slash counts — never x/y — which is exactly why an
        // oracle-verified attack could be missing its whole walk.
        {
          const b = boxEdges(state);
          const dur = e.slash_base + e.slash_offset - 8;
          scrLerpvar(state, spawn, e, 'x', e.x, b[0] - 20 + e.movebox_x, dur, 1);
          scrLerpvar(state, spawn, e, 'y', e.y, b[1] - 20 + e.movebox_y, dur, 1);
        }
      }

      // Halfway through the aim he advances one frame, and on the last frame
      // of it `image_speed` becomes 0.5 so the wind-up plays itself out. The
      // clamp below stops it at 5 — this is the whole animation, and none of
      // it comes from image_speed being left at its default.
      if (e.timer === Math.floor((e.slash_base + e.slash_offset) * 0.5) && e.aim_type !== 2) {
        e.image_index += 1;
      }
      if (e.timer === e.slash_base + e.slash_offset && e.aim_type !== 2) {
        e.image_speed = 0.5;
      }

      // Order matters: the aim spins BEFORE the frame-1 lock-on below, and
      // rotation eases toward its goal every frame of the state.
      e.aim_direction += e.rotation * e.spin;
      e.rotation = scrApproach(e.rotation, e.rotation_goal, e.rotation_change);

      if (e.timer === 1 && e.aim_type === 0) {
        const heart = state.soul;
        // NO SOUL, NO TARGET. obj_heart exists only during the bullet phase — the
        // Knight delivers it per turn via scr_moveheart and it is gone by the
        // party's menu — so a bullet that outlives its turn by a frame has
        // nothing to aim at. Skipping the frame leaves it where it was until the
        // turn sweep takes it; inventing a position would make it lunge at a soul
        // that is not there.
        if (!heart) return;
        // PRE-STEP soul position (state.soulPrev): the rotating slash is
        // created mid-turn, newer than the soul, so the runner steps it
        // first — its aim reads the soul before this frame's movement.
        // verify21j's first slash lands 4px (one soul-step) from the live
        // read. Same compensation as the tunnel's swept probe.
        const hp = state.soulPrev ?? heart;
        e.aim_x = hp.x + 10;
        e.aim_y = hp.y + 10;
      }

      // `if (timer == 1) instance_create(aim_x, aim_y, obj_knight_circle)` —
      // the bloom that marks where the fan is about to come from. Outside the
      // `aim_type == 0` guard above: it fires on every aim, including the
      // spiral's, where aim_x/aim_y are the box centre rather than the soul.
      if (e.timer === 1) {
        spawn(state, knightCircle, { x: e.aim_x, y: e.aim_y });
      } else {
        // The ELSE of the `timer == 1` fork: every other frame of the aim ramps
        // the marker colour toward pure red at 64/7 a frame, so it arrives in
        // about 15 — roughly the length of the aim.
        e.r = scrApproach(e.r, 255, 9.142857142857142);
        e.g = scrApproach(e.g, 0, 9.142857142857142);
        e.b = scrApproach(e.b, 0, 9.142857142857142);
      }

      if (e.timer === e.slash_base + 6 + e.slash_offset) {
        e.state = 'slash';
        e.timer = 0;
      }
    }

    if (e.state === 'slash') {
      e.timer += 1;
      if (e.timer === 1) {
        e.slash_list = [];
        for (let a = 0; a < e.slash_number; a++) {
          e.slash_list.push(
            (360 / (e.slash_number * 2)) * a + e.random_offset + e.aim_direction,
          );
        }
        // The volley: one cut and one burst, on the frame the fan is built.
        cue(state, 'snd_knight_cut');
        cue(state, 'snd_explosion_firework');
        if (state.fixedSlashOrder === true && state.angleLists) {
          // Replay the oracle's shuffled order (see SHUFFLE CAVEAT) — but
          // the real ds_list_shuffle still RAN in the game and burned its
          // measured 16 u32 draws per element. Skipping the burn left every
          // roll after the fan (the slash's own box jitter included) 16n
          // positions early — verify21j's first jitter pair read +2/-2
          // where the recording has +1/0.
          if (state.gmlRng) {
            for (let i = 0; i < e.slash_list.length * 16; i++) gmlU32(state.gmlRng);
          }
          const rec = state.angleLists[state.angleIndex++];
          if (rec) e.slash_list = [...rec];
        } else {
          shuffleList(e.slash_list, state.gmlRng);
        }
      }

      if (e.timer - 1 < e.slash_list.length) {
        const s = spawn(state, roaringknightSlash, { x: e.aim_x, y: e.aim_y });
        s.direction = e.slash_list[e.timer - 1];
        s.image_xscale = 2;
        s.xscale = 2;
        s.image_angle = s.direction;
        // NOT mirroring the original's `visible = false`. The slash is drawn
        // by its own Draw event in the game, so hiding the instance costs
        // nothing there; here it meant rotating slash had a hitbox and no
        // sprite. Same call made for the roaring stars.
        s.width = s.width * 2;
        s.aoe = true;
        // `scr_bullet_inherit(slashid)` — THE LINE THAT PRICES THE ENTRY GRAZE.
        //
        // obj_roaringknight_slash's Create asks for `grazepoints = 50`, and
        // this call overwrites it with the ROTATING SLASH's own value, which
        // its Create leaves at `scr_bullet_init`'s 1. (The controller cannot
        // interfere: obj_dbulletcontroller's Create sets `grazepoints = -1`,
        // the sentinel scr_bullet_inherit treats as "leave alone".)
        //
        // THE 50 IS NOT DEAD — the slash's own End Step (Step_2) re-asserts
        // it every frame. What the inherit changes is the ONE frame that
        // matters most, because of the event order:
        //
        //     Step       the slash is created, inherit -> grazepoints 1
        //     Collision  obj_grazebox pays the ENTRY bonus, at 1
        //     End Step   Step_2 restores 50, and the trickle runs at 50/30
        //
        // A slash spawns on top of the soul, so its graze almost always
        // BEGINS on the spawn frame — and that entry award is the dominant
        // term. Skipping the inherit priced it at 50 instead of 1: measured
        // at 2267 TP over a 900-frame turn against 100-235 for every other
        // attack, the 250-point bar filled nine times over. With the inherit
        // it is 344, which sits where the fan of slashes should. Reported
        // from play as the rotating slash giving too much TP.
        //
        // (The one creator that legitimately keeps 50 from the first frame is
        // obj_knight_tunnel_slasher, which never inherits — dc type 101,
        // myattackchoice 20 "knightlines", which the selector cannot reach.)
        scrBulletInherit(e, s);

        // THE SLASH-MARK DEBRIS — the original's per-slash spawn visuals
        // (spr_knight_slash_mark generic particles), untranslated as visuals
        // but their rolls are half the stream: markscalex `5 + random(3)`,
        // markscaley `2 + random(1)`, then TWO `repeat (4 + irandom(3))`
        // debris bursts — forward and +180 — each iteration drawing
        // `12 + irandom(8)` (faade), `-20 + random(60)` (diist),
        // `6 + random(4)` (speed) and `random_range(-10, 10)` (angle).
        // 6 + 5*(k1+k2) draws per slash, k in [4,7] — the 46..76-draw block
        // that sat between the fan and the box jitter in verify21j (the
        // game's first jitter pair landed at stream position ~96 vs the
        // sim's 30; k1+k2 = 12 closes it exactly). The particles themselves
        // never roll again (obj_particle_generic has no random anywhere),
        // so the whole burn is confined to the spawn frame.
        if (state.gmlRng) {
          gmlRandom(state.gmlRng, 3);
          gmlRandom(state.gmlRng, 1);
          for (let burst = 0; burst < 2; burst++) {
            const reps = 4 + gmlIrandom(state.gmlRng, 3);
            for (let i = 0; i < reps; i++) {
              gmlIrandom(state.gmlRng, 8);
              gmlRandom(state.gmlRng, 60);
              gmlRandom(state.gmlRng, 4);
              gmlRandomRange(state.gmlRng, -10, 10);
            }
          }
        }
      }

      if (e.timer === e.slash_timer) {
        e.state = 'cooldown';
        e.timer = 0;
      }
    }

    if (e.state === 'cooldown') {
      e.timer += 1;
      if (e.timer === e.cooldown_time || e.local_turntimer < 200) {
        e.slash_counter += 1;
        if (e.slash_counter < e.slash_array.length) {
          e.slash_number = e.slash_array[e.slash_counter];
          // The aim phase SHORTENS each cycle: slash_offset collapses to 0 in
          // one step and slash_base creeps toward 15. Aim exits at
          // slash_base + 6 + slash_offset, so cycle 1 lasts 30 frames
          // (18+6+6) and cycle 2 only 23 (17+6+0). Missing these two lines is
          // why the second cycle diverged.
          e.slash_offset = scrApproach(e.slash_offset, 0, 6);
          e.slash_base = scrApproach(e.slash_base, 15, 1);
        }

        if (e.local_turntimer < 200 && !e.slashes_done) {
          e.slashes_done = true;
          e.local_turntimer = 99999;
        }

        // ONCE THE SIX CUTS ARE DONE the attack forks, and only one arm of the
        // fork is the spiral. Everything except a difficulty-2 "full" turn
        // simply winds down here — that `return` is what the suite used to
        // diverge on at frame 282, when this branch was missing and every
        // difficulty fell through into another aim cycle.
        if (e.slashes_done) {
          if (e.difficulty === 2 && e.turn_type === 'full') {
            if (e.do_final) {
              // He vanishes and reappears for the finisher.
              cue(state, 'snd_knight_puff');
              cue(state, 'snd_knight_teleport', 0.5);
              // The handoff into the spiral. Everything gets faster: the aim
              // is 24 frames instead of easing toward 15, cooldown drops to 2,
              // and the knight stops aiming at the soul — `aim_x/aim_y` are
              // pinned to the box centre and stay there for the rest of the
              // attack.
              e.rotation_base = 18;
              e.rotation_change = 0.5;
              e.line_width = 4;
              e.slash_number = 1;
              e.slash_base = 24;
              e.cooldown_time = 2;
              e.slash_timer = 2;
              e.aim_type = scrApproach(e.aim_type, 2, 1);
              e.do_final = false;
              const b = boxEdges(state);
              e.aim_x = (b[2] + b[0]) / 2;
              e.aim_y = (b[1] + b[3]) / 2;
            }
          } else if (e.turn_type === 'start' || e.turn_type === 'short start'
            || e.turn_type === 'short mid') {
            // A CHAINED SEGMENT DOES NOT RETURN — it warps out and arms the
            // HANDOFF alarm instead, four frames later. `exit` in the original,
            // so none of the return block below runs.
            //
            // ARMED ONCE. The branch is re-entered every frame while the state
            // holds, and re-arming an alarm each frame means it never counts
            // down to fire at all — or, once it does, fires repeatedly. Both
            // showed up: the handoff spawned TWO third segments five frames
            // apart. The original's own control flow only reaches this once;
            // the flag is how that is expressed here.
            if (!e.handoffArmed) {
              e.handoffArmed = true;
              const w = spawn(state, knightWarp, { x: e.x, y: e.y });
              w.master = e;
              knightWarpOut(state, w);
              e.alarm[2] = 4;
            }
            return;
          } else {
            e.state = 'return';
            e.timer = 0;
            e.done = true;
            // The non-spiral twin of the glide below (`final_counter === 28`),
            // and the only difference is that both legs are DELAYED:
            //
            //     scr_script_delayed(scr_lerpvar, 8, "x", x, anchor_x,
            //                        12, 1, "out");
            //     scr_script_delayed(scr_lerpvar, 8, "y", y, anchor_y,
            //                        12, 1, "out");
            //
            // `x` and `anchor_x` are read NOW, eight frames before the tween
            // that uses them exists, so he holds where he stopped and then
            // slides. No `with (obj_lerpvar)` cancel on this arm — the
            // original does not have one, and the aim hop it would cancel has
            // long since finished.
            delayedReturnLerp(e, e.x, e.anchor_x, e.y, e.anchor_y);
            e.alarm[3] = 22;
            return;
          }
        }

        if (e.aim_type < 2) {
          e.state = 'aim';
          e.timer = 0;
          // 0 -> 1 -> 2 IN ONE FRAME. do_final above bumps aim_type to 1, and
          // this immediately bumps it again, so the recording never shows a 1:
          // frame 227 reads 0 and frame 228 reads 2, in state "aim".
          if (e.aim_type === 1) {
            e.line2 = 0;
            e.alarm[1] = 4;
            e.aim_type = scrApproach(e.aim_type, 2, 1);
          }
          return;
        }

        // THE SPIRAL. No aim phase at all any more — cooldown goes straight
        // back to slash, so the knight fires every ~3 frames while
        // `aim_direction` advances by an accelerating `speed_gain` each time.
        // 16 -> 24 over eight slashes, then flat, for 28 slashes total.
        e.state = 'slash';
        e.timer = 0;
        e.aim_direction += e.speed_gain * e.spin;
        e.speed_gain = scrApproach(e.speed_gain, 24, 1);
        e.final_counter += 1;
        if (e.final_counter === 28) {
          e.state = 'return';
          e.done = true;
          // HE GLIDES BACK TO HIS POST — the three lines this branch was
          // missing, and the reason the silhouette used to blink out from
          // wherever the last teleport had dropped it:
          //
          //     with (obj_lerpvar) { if (target == other.id)
          //                              instance_destroy(); }
          //     scr_lerpvar("x", x, anchor_x, 12, 1, "out");
          //     scr_lerpvar("y", y, anchor_y, 12, 1, "out");
          //
          // The CANCEL comes first and is not optional: the spiral arms a
          // fresh pair of teleport tweens every ~3 frames (see the else arm
          // below), so one is almost always mid-flight here and two live
          // tweens writing the same `x` would fight over it — last writer per
          // frame wins, and which one that is depends on spawn order.
          //
          // `anchor_x/anchor_y` are the knight's CURRENT position, re-derived
          // at the top of this Step. Measured on the frame before Alarm_3
          // fires with the toggle off: difficulty 0 ended 43.94px from the
          // knight, difficulty 1 30.73px, difficulty 2 89.50px. Vanilla-path,
          // so it was wrong before the mod existed — but under the toggle it
          // is thirty knights blinking out of the arena at once instead of
          // thirty sliding home.
          cancelLerps(state, e);
          scrLerpvar(state, spawn, e, 'x', e.x, e.anchor_x, 12, 1);
          scrLerpvar(state, spawn, e, 'y', e.y, e.anchor_y, 12, 1);
          // Alarm_3 is one line, `instance_destroy()`. 22 frames after the
          // 28th slash the attack object goes away — measured at frame 363 in
          // the difficulty-2 recording, where the instance simply stops
          // appearing. 12 of those 22 are the glide above.
          e.alarm[3] = 22;
        } else {
          // He teleports around the box between shots. The two irandom draws
          // are replayed by the scene; the wrap and the lerp targets are not.
          const rec = state.finalMoveTable ? state.finalMoveTable[state.finalMoveIndex++] : null;
          e.movebox_x += rec ? rec.mx : 20 + gmlIrandom(state.gmlRng, 40);
          e.movebox_y += rec ? rec.my : 30 + gmlIrandom(state.gmlRng, 60);
          e.sprite_index = 'spr_roaringknight_flurry';
          e.image_speed = 1;
          if (e.movebox_x > 80) e.movebox_x -= 80;
          if (e.movebox_y > 120) e.movebox_y -= 120;
          const b = boxEdges(state);
          const dur = e.slash_base + e.slash_offset - 8;
          scrLerpvar(state, spawn, e, 'x', e.x, b[0] - 20 + e.movebox_x, dur, 1);
          scrLerpvar(state, spawn, e, 'y', e.y, b[1] - 20 + e.movebox_y, dur, 1);
        }
      }
    }
  },
};

/**
 * `with (obj_lerpvar) { if (target == other.id) instance_destroy(); }` —
 * kill every tween still pointed at this instance.
 *
 * The original iterates the live obj_lerpvar instances and destroys the ones
 * whose `target` is the caller; `sim/lerpvar.js` holds the target as the
 * entity itself, so the test is an identity check rather than an id compare.
 */
function cancelLerps(state, e) {
  for (const t of state.entities) {
    if (t.alive && t.type.name === 'obj_lerpvar' && t.target === e) destroy(t);
  }
}

/**
 * `scr_script_delayed(scr_lerpvar, 8, ...)` for the non-spiral return, both
 * axes at once — the pair is always armed and cancelled together.
 *
 * **THE STORED DELAY IS 7, NOT 8, AND THAT IS THE DOCUMENTED n-1.**
 * `scr_script_delayed` arms an alarm n frames out; GameMaker runs alarms
 * BEFORE Step, so the obj_lerpvar that alarm creates gets its own first Step
 * on that same frame and its first write lands n frames after the call. Here
 * the countdown is ticked from the manager's own Step and this engine freezes
 * the entity list at the start of each phase, so a tween spawned during a
 * Step does not move until the frame after. Storing 8 would land the first
 * write on n+1. CLAUDE.md records the same correction for the roar's
 * ball_darkness fade, where 16 ran a frame behind the recording all the way.
 */
function delayedReturnLerp(e, fromX, toX, fromY, toY) {
  e.returnLerp = { delay: 7, fromX, toX, fromY, toY };
}

/** Runs the pending return glide; called at the top of the manager's Step. */
function tickReturnLerp(state, e) {
  const r = e.returnLerp;
  if (!r) return;
  r.delay -= 1;
  if (r.delay > 0) return;
  e.returnLerp = null;
  scrLerpvar(state, spawn, e, 'x', r.fromX, r.toX, 12, 1);
  scrLerpvar(state, spawn, e, 'y', r.fromY, r.toY, 12, 1);
}

/**
 * `scr_get_box`, index for index — and the indices are NOT in the order the
 * names suggest: **0 is the RIGHT edge and 2 is the LEFT**, because the
 * original computes 0 as `x + sprite_width * 0.5`. 1 is top, 3 is bottom.
 *
 * Kept in the source's own numbering rather than renamed to left/right, so a
 * call site can be read straight against the GML without re-deriving it.
 * `sprite_width` is the sprite's width times image_xscale, as everywhere else.
 */
function boxEdges(state) {
  const gt = state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
  if (!gt) return [0, 0, 0, 0];
  const hw = (gt.spriteWidth ?? 75 * gt.image_xscale) * 0.5;
  const hh = (gt.spriteHeight ?? 75 * gt.image_yscale) * 0.5;
  return [gt.x + hw, gt.y - hh, gt.x - hw, gt.y + hh];
}

/** obj_dbulletcontroller `type = 104`. */
export function spawnRotatingSlash(state, x, y, { difficulty = 0 } = {}) {
  // obj_dbulletcontroller type 104 does `with (creatorid) image_alpha = 0`
  // before creating this — THIS object becomes the visible knight, exactly as
  // Flurry's manager does. Without it the real knight stands there idling
  // while a second one performs the attack. The recording has his alpha at 0
  // from frame 13 to frame 363, which is this object's whole lifetime.
  const knight = state.entities.find(
    (k) => k.alive && k.type.name === 'obj_knight_enemy',
  );
  if (knight) knight.image_alpha = 0;

  const e = spawn(state, rotatingSlash, { x, y });
  e.difficulty = difficulty;
  // THE ONE THE DISPATCH MADE is the controller — see the step. Only it
  // tops the population up under NO BULLET COOLDOWNS, and the flag is set
  // unconditionally so the OFF path writes the same property either way.
  e.nbcController = true;
  rotatingSlash.init(e);
  return e;
}

// Combination segment 2.
import { registerComboAttack } from './combination.js';
registerComboAttack(2, rotatingSlash);
