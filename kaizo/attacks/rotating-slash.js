// KAIZO obj_knight_rotating_slash — V-C recreation of EnderCat8's Kaizo
// Roaring Knight v2.3.3 — do not publish without permission (kaizo/HANDOFF.md
// §5-C publish gate).
//
// PROVENANCE. This file is a COPY of the verified sim module
// sim/attacks/rotating-slash.js with ONLY the mod's deltas applied; every
// line the mod did not change is byte-identical to the sim module, and every
// divergence carries a `KAIZO` comment citing the kaizo GML file+line.
// Ground truth read for every branch:
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_knight_rotating_slash_Create_0.gml   (lines 52-80 new)
//     gml_Object_obj_knight_rotating_slash_Other_10.gml   (lines 23-33 new: d8)
//     gml_Object_obj_knight_rotating_slash_Step_0.gml     (9 hunks, below)
//     gml_Object_obj_knight_rotating_slash_CleanUp_0.gml  (surface + 111 handoff)
//     gml_Object_obj_knight_rotating_slash_Draw_0.gml     (visual only, noted)
//   deltas/: gml_Object_obj_knight_rotating_slash_{Create_0,Step_0,Other_10,
//     Draw_0,CleanUp_0}.md. Alarm_1/Alarm_3 are UNCHANGED by the mod; the
//   Alarm_2 diff is sprite-index renumbering only (367->366 etc — the mod
//   added sprites, shifting ids of the SAME knight sprites; cosmetic).
//
// WHAT DIVERGES FROM THE SIM MODULE (the mod's deltas):
//   Create   delay_swords combo flag (armed when myattackchoice == 16),
//            firstrot/finale_spin pair bookkeeping (+1 choose draw on the
//            solo/first-instance path), me_surface (render-only, skipped).
//   Other_10 NEW difficulty == 8 table: slash_offset 0, array [3,4,4,4,5,5].
//   Step     hunk 1: delay_swords pacing + tracking-swords throttle; the
//                    `difficulty >= 10 || instance_number > 1` fast-lock
//                    (slash_offset 6/7, rotation_goal 0, braking); the
//                    B-Side solo slash_base cap 15.
//            hunk 2: `spin = finale_spin` on the aim_type-2 aim entry.
//            hunk 3: bul_x/bul_y ring-origin capture every aim start.
//            hunk 4: aim marker ramps grey -> BLUE (r/b targets swapped).
//            hunk 5: volley SFX volume 1/instance_number (audio only).
//            hunk 6: slash-mark particles c_red -> c_blue. NOT APPLICABLE
//                    here and it is not an omission: the three
//                    spr_knight_slash_mark bursts (Step_0:342/384/412) are
//                    not translated as ENTITIES at all — only their rolls
//                    are burned, to hold the stream — so there is no
//                    image_blend to recolour. Nothing to tint until the
//                    particles themselves exist.
//            hunk 7: B-Side expanding starchild bullet rings (damage 140)
//                    after each volley, with manager-based suppression.
//            hunk 8: coordinated finale aim — firstrot re-rolls irandom(359),
//                    the second instance copies it ± 45 ± 5 (2 draws).
//            hunk 9: B-Side finale length 28 -> 56 (42 when a sword-vortex
//                    manager is alive).
//   CleanUp  me_surface free (render-only, skipped); the B-Side attack-111
//            turn-end handoff routes through state.kaizo.hooks.vortexendHandoff
//            (the VORTEX work item owns kaizo_vortexend_step) and is LEDGERED
//            in state.kaizo.approx when the hook is absent.
//   Draw     NOT translated here (renderer work later, per the project law):
//            white->blue intro fade (kaizo Draw_0:59), the 640x480 me_surface
//            with 2px position quantization + alternating-scanline grate when
//            two instances are alive (Draw_0:71-97). No RNG in any Draw delta.
//            get_swordcolor() on the B-Side ring bullets IS applied (hunk 7,
//            Step_0:461) — a pure lookup (scr_complete_save_file.gml:269-286)
//            with no RNG to consume, so every ring bullet now carries the
//            mod's blue. The aim marker's r/g/b ramp (hunk 4) was already
//            charging to blue.
//
// NOT registered with the combination registry: the sim module ends with
// `registerComboAttack(2, rotatingSlash)`; calling that here would OVERWRITE
// the sim's segment-2 entry for every consumer (isolation contract §2.1).
// The central V-C launcher swaps the import source instead.
//
// B-Side flag: kaizo_sideb() (kaizo_settings_init.gml:79-89) reads
// obj_knight_enemy.k_sideb — in this sim, state.kaizo?.sideb (set at scene
// build). myattackchoice is state.currentAc (fight.js launchAttack /
// kaizo-mod-launcher.js launchVCAttack both set it).
//
// ── the sim module's own header, retained (all of it still applies) ────────
//
// Shape: a rotating aimer that periodically fires a fan of slashes at the
// soul. States advance intro -> aim -> slash -> cooldown -> (aim | slash |
// return), driven entirely by `timer`. THE SPIRAL FINISHER (difficulty 2
// only): after the six cuts, aim_type 0 -> 1 -> 2 in one frame, no aim phase
// any more, 28 slashes (B-Side: 42/56, hunk 9) at the box centre.
//
// SHUFFLE CAVEAT: ds_list_shuffle consumes 16 draws per element but its
// algorithm is unsolved (see CLAUDE.md). This uses our own Fisher-Yates over
// gmlRng — statistically equivalent, NOT bit-identical.

import { scrLerpvar } from '../../sim/lerpvar.js';
// The mod's palette, from the one shared source (kaizo/attacks/kaizo-colors.js)
// — never a private copy. getSwordcolor returns a STABLE array reference.
import { getSwordcolor } from './kaizo-colors.js';
import { spawn, destroy } from '../../sim/entity.js';
import { roaringknightSlash } from '../../sim/attacks/roaringknight-slash.js';
import { knightCircle, knightWarp, knightWarpOut } from '../../sim/fx.js';
import { cue, cueLoop, cueStop } from '../../sim/audio.js';
import { scrApproach, gmlEq } from '../../sim/gml.js';
import { gmlChoose, gmlIrandom, gmlRandom, gmlRandomRange, gmlU32, gmlShuffle } from '../../sim/rng.js';
import {
  scrBulletInherit, regularbulletCreate, regularbulletStep, collidebulletOther15,
} from '../../sim/bullets/regularbullet.js';
import { chainNext } from '../../sim/attacks/combination.js';
import { STARCHILD_MASK, enginePairHit } from '../../sim/masks.js';

/** Fisher-Yates over the real generator. See SHUFFLE CAVEAT above. */
/**
 * Reorder one fan from the recorded queue (state.slashOrder), consuming the
 * entries it matches. A miss leaves the fan exactly as the burn left it and
 * counts itself, so a feed that stops covering the fight is visible in the
 * tracer's summary rather than silently doing nothing.
 */
function replaySlashOrder(state, list) {
  const q = state.slashOrder;
  if (!q || !q.entries || q.at >= q.entries.length) return;
  const norm = (v) => ((v % 360) + 360) % 360;
  const taken = [];
  const used = new Array(list.length).fill(false);
  // SKIP PAST ENTRIES THAT ARE NOT OURS, do not stop at them. Two managers'
  // volleys interleave in the log, and a fan whose first log entry belongs to
  // the other manager would otherwise match nothing at all. The window is
  // bounded so a fan can never reach forward into a later volley for an angle
  // that merely coincides.
  const WINDOW = 32;
  let scan = q.at;
  const limit = Math.min(q.entries.length, q.at + WINDOW);
  while (scan < limit && taken.length < list.length) {
    const want = norm(q.entries[scan].angle);
    const idx = list.findIndex((v, i) => !used[i] && Math.abs(norm(v) - want) < 0.01);
    if (idx < 0) { scan += 1; continue; }   // the other manager's fan
    used[idx] = true;
    taken.push(list[idx]);
    q.entries.splice(scan, 1);   // consumed; the rest keep their order
  }
  if (taken.length === list.length) {
    for (let i = 0; i < list.length; i++) list[i] = taken[i];
    q.hits = (q.hits ?? 0) + 1;
  } else {
    q.misses = (q.misses ?? 0) + 1;
  }
}

function shuffleList(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = gmlU32(rng) % (i + 1);
    const t = list[i];
    list[i] = list[j];
    list[j] = t;
  }
  return list;
}

/** `kaizo_sideb()` — kaizo_settings_init.gml:79-89. */
function kaizoSideb(state) {
  return state.kaizo?.sideb === true;
}

/** `instance_number(obj_knight_rotating_slash)` — alive instances, by name,
 *  self included (spawn() pushes the entity before create runs, matching
 *  GameMaker's "the instance exists during its own Create"). */
function instanceNumberRotating(state) {
  let n = 0;
  for (const k of state.entities) {
    if (k.alive && k.type.name === 'obj_knight_rotating_slash') n += 1;
  }
  return n;
}

/** `i_ex(obj_<name>)` over the entity list. */
function instanceExists(state, name) {
  return state.entities.some((k) => k.alive && k.type.name === name);
}

// ── the mod's scr_var_delay / scr_script_repeat runners ────────────────────
//
// obj_script_delayed, translated for the two forms the ring bullets use.
// `scr_delay_var("active", 0, 25)` = scr_script_delayed(scr_var, 25, ...) —
// an instance whose alarm[0] fires 25 frames later and writes the variable
// (gml_GlobalScript_scr_var_delay.gml + obj_script_delayed Alarm_0/Other_10).
// `scr_script_repeat(fn, 35, 1)` = obj_script_delayed with constant = 1,
// whose Step runs the script in the target's context once per `rate` frames
// until totaltimer reaches max_time (obj_script_delayed Step_0). Alarms are
// alarms here (HANDOFF §8): the delayed write rides e.alarm[0], never a
// counter.

export const kaizoDelayedVar = {
  name: 'obj_script_delayed',

  create(e) {
    e.varname = '';
    e.value = 0;
    e.target = -1;
    // The engine default image_speed 1 is harmless (no sprite), matching
    // obj_lerpvar's own translation.
  },

  alarm: {
    /** Alarm_0: event_user(0) then instance_destroy. Other_10 guards
     *  i_ex(target); the destroy is unconditional. */
    0(e) {
      if (e.target && e.target !== -1 && e.target.alive) {
        e.target[e.varname] = e.value;
      }
      destroy(e);
    },
  },
};

export const kaizoScriptRepeat = {
  name: 'obj_script_delayed',

  create(e) {
    // obj_script_delayed Create_0, the fields the constant==1 path reads.
    e.script = null;
    e.target = -1;
    e.rate = 1;
    e.max_time = 0;
    e.timer = 999; // Create_0: `timer = 999` — fires on the very first Step.
    e.totaltimer = 0;
  },

  step(e, state) {
    // obj_script_delayed Step_0, constant == 1 arm, verbatim (max_time is
    // never -1 for the ring bullets, so that branch is not translated).
    e.timer += 1;
    if (e.timer >= e.rate) {
      if (e.target && e.target !== -1 && e.target.alive && e.totaltimer < e.max_time) {
        e.script(e.target, state);
        e.timer = 0;
      } else {
        destroy(e);
      }
    }
    e.totaltimer += 1;
  },
};

function scrDelayVar(state, target, varname, value, delay) {
  const r = spawn(state, kaizoDelayedVar, { x: 0, y: 0 });
  r.target = target;
  r.varname = varname;
  r.value = value;
  r.alarm[0] = delay;
  return r;
}

function scrScriptRepeat(state, target, script, maxTime, rate) {
  const r = spawn(state, kaizoScriptRepeat, { x: 0, y: 0 });
  r.target = target;
  r.script = script;
  r.max_time = maxTime;
  r.rate = rate;
  return r;
}

/**
 * `kaizo_slashbullet_step()` — kaizo_settings_init.gml:127-135:
 *
 *     with (scr_afterimagefast()) {
 *         direction = other.direction + choose(-90, 90);
 *         speed = random_range(-0.5, 0.5);
 *         fadeSpeed = 0.15;
 *     }
 *
 * The afterimage is VISUAL (scr_afterimagefast has no RNG of its own) and is
 * skipped — but its two draws are the ring's per-frame stream burn and MUST
 * be consumed: choose then random_range, in that order, once per bullet per
 * frame for the repeat's 35 executions.
 */
export function kaizoSlashbulletStep(target, state) {
  if (state.gmlRng) {
    gmlChoose(state.gmlRng, [-90, 90]);
    gmlRandomRange(state.gmlRng, -0.5, 0.5);
  }
}

/**
 * The B-Side ring bullet — a plain `obj_regularbullet` exactly as the mod
 * creates it (kaizo Step_0:470-491). Sprite spr_knight_starchild.
 *
 * MASK APPROXIMATION, flagged: spr_knight_starchild's collision mask is not
 * extracted (the sprite is vanilla-unused; only this kaizo hunk references
 * it). STARCHILD_MASK (spr_knight_starchild_parts, 33x32) stands in until
 * the real mask is pulled — see open[] in the work item's return.
 */
export const kaizoSlashRingBullet = {
  name: 'obj_regularbullet',

  create(e, state) {
    regularbulletCreate(e, state); // obj_regularbullet Create, the real base
  },

  step: regularbulletStep,

  collides(e, heart) {
    if (e.active !== 1 && e.active !== true) return false;
    return enginePairHit(heart, e, STARCHILD_MASK);
  },

  other15: collidebulletOther15,
};

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
    // Marker colour, ramped grey -> BLUE through each aim (Draw reads r/g/b;
    // the kaizo retarget is in the step's ramp, hunk 4).
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
    e.aim_x = e.x;
    e.aim_y = e.y;
    e.slash_list = [];
    e.movebox_x = 40;
    e.movebox_y = 60;
    e.do_final = true;
    e.turn_limit_4 = 270;
    e.slashes_done = false;
    e.done = false;

    // KAIZO Create_0:52-80 — the dual-knight / combo bookkeeping the mod
    // appends after the vanilla `debug = false` line.
    e.delay_swords = false; // Create_0:52
    // Create_0:53 `me_surface = -4` — the Draw grate surface handle.
    // Render-only (freed in CleanUp_0:6-9), skipped; see the header.
    //
    // NOT in the GML Create: bul_x/bul_y are first written at the first aim
    // (Step_0:276-277). Initialized to the aim_x/aim_y spawn default so a
    // soul-less frame cannot poison the ring with NaN — GML would have
    // crashed on the obj_heart read instead of reaching the ring at all.
    e.bul_x = e.x;
    e.bul_y = e.y;
    {
      // Create_0:54-61 `with (obj_knight_enemy) if (myattackchoice == 16)` —
      // the rotating-slash + tracking-swords combo turn arms the throttle.
      // myattackchoice is state.currentAc in this sim; the with-block is a
      // no-op when no knight instance exists, exactly as GML's `with`.
      const knight = state.entities.find(
        (k) => k.alive && k.type.name === 'obj_knight_enemy',
      );
      if (knight && gmlEq(state.currentAc ?? -999, 16)) {
        e.delay_swords = true;
        e.delay_wait = 0;
      }

      // Create_0:62-80 — pair bookkeeping. The FIRST living instance rolls
      // the pair-shared finale spin (ONE extra choose draw, after the
      // vanilla spin/random_offset draws above); a later instance copies it
      // from whichever sibling carries firstrot (the variable_instance_exists
      // guard excludes self, whose firstrot is not defined yet).
      if (instanceNumberRotating(state) > 1) {
        for (const other of state.entities) {
          if (!other.alive || other.type.name !== 'obj_knight_rotating_slash') continue;
          if (other === e) continue; // self: firstrot not yet defined
          if (other.firstrot !== undefined && other.firstrot) {
            e.finale_spin = other.finale_spin;
          }
        }
        e.firstrot = 0;
      } else {
        e.firstrot = 1;
        e.finale_spin = gmlChoose(state.gmlRng, [-1, 1]); // Create_0:79
      }
    }
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
    // KAIZO Other_10:23-33 — the NEW difficulty 8 table: no aim padding and
    // the only slash_array anywhere that reaches FIVE simultaneous slashes
    // (vanilla max is 4). Difficulty >= 10 has NO row here — a d10 instance
    // keeps the Create defaults [1,2,2,3,3,4] and gets its behavior from the
    // Step's fast-lock branch instead.
    if (e.difficulty === 8) {
      e.slash_offset = 0;
      e.slash_number = 3;
      e.slash_array = [3, 4, 4, 4, 5, 5];
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

  /**
   * obj_knight_rotating_slash's CLEANUP EVENT, on the TYPE where it belongs.
   *
   * IT USED TO BE INLINED IN ALARM_3, and that is a real bug rather than a
   * style point: Alarm_3 is not the only route to this controller's death.
   * obj_battlecontroller's turn-end sweep destroys every obj_bulletparent, and
   * GameMaker runs CleanUp on THAT destroy just the same -- so a turn this
   * controller does not close itself would silently skip the whole event. The
   * identical mistake in underbox.js's manager was worth a frame of the gate
   * on ac 102 (trace f6492 -> f6631), and this is the same shape.
   *
   * The engine invokes type.cleanUp from destroy(e, state); a bare destroy(e)
   * does NOT fire it, so both alarms below pass the state.
   *
   * The GML, kaizo CleanUp_0 (surface frees at :6-9 are render-only and
   * skipped, as the header records; ds_list_destroy is a no-op here):
   *
   *     if (turn_type != "start" && turn_type != "short start"
   *         && turn_type != "short mid" && scr_bulletparent_count() < 2) { ... }
   */
  cleanUp(e, state) {
    // The turn-CLOSING instance hands the clock its -1. The controller runs
    // this whole turn at turntimer 999999, so WITHOUT this line the turn
    // cannot end at all: the strict clock rule (sweep at turntimer <= 0, no
    // manager-death shortcut) hung the fight-order suite on turn 5 forever.
    // The chained "start"/"short" instances from the combination attack leave
    // the clock alone -- their successor closes it.
    const closing =
      e.turn_type !== 'start' &&
      e.turn_type !== 'short start' &&
      e.turn_type !== 'short mid';
    // `scr_bulletparent_count() < 2` — CORRECTED 2026-08-28 (kept in this
    // copy). The script counts instances whose object_index is EXACTLY
    // obj_bulletparent, and in the knight fight nothing ever creates a bare
    // obj_bulletparent — so the test is ALWAYS TRUE here, exactly as
    // underbox.js documents for its own copy of the same line. The old
    // "alive bullets < 2" translation deadlocked the kaizo rotating+vortex
    // pairing (the vortex's six swords held the count at 6 forever).
    if (!closing) return;
    const knight = state.entities.find(
      (x) => x.alive && x.type.name === 'obj_knight_enemy',
    );
    if (knight) knight.image_alpha = 1;
    // KAIZO CleanUp_0:16-46 — on the B-Side's attack 111 (sword vortex +
    // rotating slash) the closing instance does NOT end the turn: every live
    // obj_sword_vortex is cloned into a frozen obj_regularbullet running
    // kaizo_vortexend_step (which ends the turn itself at its timer 60), the
    // originals are disabled, and global.turntimer is pinned to 999.
    // kaizo_vortexend_step and the clone protocol belong to the VORTEX work
    // item; this seam routes through its hook. When the hook is absent the sim
    // falls back to the vanilla -1 AND ledgers the approximation.
    if (kaizoSideb(state) && gmlEq(state.currentAc ?? -999, 111)) {
      const handoff = state.kaizo?.hooks?.vortexendHandoff;
      if (handoff) {
        // The hook owns: cloning obj_sword_vortex -> obj_regularbullet
        // (sprite/angle/direction/scales/blend/damage copied, speed NOT,
        // destroyonhit 0, wall_destroy 0, scr_script_repeat(
        // kaizo_vortexend_step, 999, 1)), disabling the originals, and
        // `global.turntimer = 999` (CleanUp_0:18-43).
        handoff(state, e);
        return;
      }
      if (state.kaizo) {
        (state.kaizo.approx ??= []).push({
          type: 104, asked: 'sideb ac-111 kaizo_vortexend_step handoff',
          used: 'vanilla turn end (-1)',
          why: 'vortexendHandoff hook not provided (VORTEX item)',
        });
      }
    }
    state.turntimer = -1;
  },

  alarm: {
    /** Alarm_3: `instance_destroy()`, and nothing else — the CleanUp above
     *  is what the destroy fires. */
    3(e, state) {
      // CleanUp_0:6-9 frees me_surface — render-only, skipped (header).
      destroy(e, state);
    },

    /**
     * Alarm_2 — THE HANDOFF, and it is a SEPARATE alarm from the destroy
     * above. The object ends one of two ways: alarm 3 (its own end, which
     * closes the turn) or alarm 2 (hand the turn to the next segment). Only
     * the combination arms this one. (The mod's Alarm_2 diff is sprite-index
     * renumbering only — no behavioral delta.)
     *
     * THE SITE NAME IS THE OPT-IN. `chainNext`'s third argument routes to
     * `state.kaizo.hooks.comboChainNext` when a scene has set one, so the
     * successor comes out of KAIZO_COMBO_ATTACKS rather than the sim's shared
     * registry — which only sim/ modules ever write (kaizo/HANDOFF.md §2.1),
     * and which is why every segment after the first ran a vanilla body no
     * matter what the kaizo table said. With no hook the argument is ignored
     * and this is the vanilla handoff, unchanged. 'rotating_alarm2'
     * transcribes THIS event: cases 1/3/4/5 and NO case 2, no warp, and the
     * quickslash's `timer = spawn_speed` seed.
     *
     * THIS IS THE SITE BOTH DISPATCHED CHAINS USE for their third segment.
     * The mod ALSO has four early-spawn blocks in Step_0:64-196 that hand on
     * mid-pattern (next_up 1 at local_turntimer < 240, 3 at < 220, 4 and 5 at
     * < turn_limit_4), so in the real fight the successor OVERLAPS the
     * outgoing slash by tens of frames; this module does not carry them and
     * the successor starts at the alarm instead. Recorded rather than silent:
     * check-oracle-weird prints the consequence (atk_Frenzy1's segment-3
     * bullets, mod 28 against sim 20) and NOTEs the overlap on both routes.
     * Transcribing them is a timing change with nothing in the recording to
     * pin it frame-wise, so it is the next rung and not this one.
     */
    2(e, state) {
      chainNext(state, e, 'rotating_alarm2');
      // `instance_destroy();` is the last line of Alarm_2 — the segment that
      // hands on does not linger. Without it the outgoing rotating slash was
      // still on screen while the next segment played.
      // WITH THE STATE, so the CleanUp fires here too: the mod's
      // instance_destroy runs it from every route, and the event's own
      // turn_type guard is what decides that a chained segment ("start" /
      // "short start" / "short mid") leaves the clock alone. Passing the guard
      // rather than the call site is the whole point of putting it on the type.
      destroy(e, state);
    },

    /**
     * Alarm_1 — kaizo Alarm_1:1 (byte-identical to vanilla): `line3 = 0;`.
     * Armed at 4 by the aim_type 1 -> 2 hop below (Step_0:591, `alarm[1] =
     * 4`, four frames after `line2 = 0`), it lights the SECOND pair of rails
     * of the aim telegraph — the counter obj_knight_rotating_slash Draw_0:38-51
     * reads. Was missing: the alarm was armed with no handler, so line3 sat at
     * -1 and the line3 rails never drew. Draw-side state only; nothing in
     * Step reads line3 back, no RNG.
     */
    1(e) {
      e.line3 = 0;
    },
  },

  step(e, state) {

    // `obj_knight_enemy.siner2 = 0;` — THE FIRST LINE OF THIS STEP, and it
    // runs every frame the slash is alive. It PINS THE KNIGHT'S BOB (see the
    // sim module for the full derivation).
    {
      const kx = state.entities.find(
        (x) => x.alive && x.type.name === 'obj_knight_enemy',
      );
      if (kx) kx.siner2 = 0;
    }
    // The decrement is ABOVE the `done` guard deliberately. There is no `done`
    // in the original — the object keeps running its Step, doing nothing,
    // until Alarm_3 destroys it, and `local_turntimer` keeps counting down the
    // whole time.
    e.local_turntimer -= 1;

    // KAIZO Step_0:5-63 — hunk 1, inserted right after `local_turntimer--`
    // and therefore ABOVE the sim's `done` guard: the GML runs this every
    // frame of the instance's life, 'return' state included.
    if (e.delay_swords) {
      // Step_0:7 `var _adj = kaizo_sideb() * 1;`
      const _adj = kaizoSideb(state) ? 1 : 0;
      e.slash_base = 16 - _adj;
      e.slash_offset = 0;
      e.cooldown_time = 12 - _adj;
      // Step_0:11-17 `with (obj_tracking_sword1)` — retune EVERY live
      // tracking sword's fade clock (fields live on the sim's
      // obj_tracking_sword1 translation under the same names).
      for (const s of state.entities) {
        if (s.alive && s.type.name === 'obj_tracking_sword1') {
          s.fadetohalftime = 5;
          s.waittime = 5;
          s.fadetofulltime = 15 - _adj;
          s.flashtime = 4;
        }
      }
      if (e.delay_wait > 0) {
        e.delay_wait -= 1;
      }
      if (e.delay_wait <= 0) {
        if (e.state === 'aim' && e.timer === 5 - _adj) {
          // Step_0:24-27 — the ONE window per aim in which the manager is
          // released: swords launch only here, then wait 15 - sideb frames.
          e.delay_wait = 15 - _adj;
        } else {
          // Step_0:30-33 — hold the tracking-swords manager two ticks from
          // firing.
          for (const m of state.entities) {
            if (m.alive && m.type.name === 'obj_tracking_swords_manager') {
              m.timer = m.rate - 2;
            }
          }
        }
      }
    }
    // KAIZO Step_0:37-63 — the dual-instance / difficulty >= 10 fast-lock:
    // until the cuts are done, the aim gets padding back (6, 7 on the
    // B-Side), the aim line's drift target drops to ZERO and its easing
    // brakes (rotation_change collapses to rotation/8 below 2) — the line
    // slows to a standstill instead of vanilla's perpetual goal-2 drift.
    if (e.difficulty >= 10 || instanceNumberRotating(state) > 1) {
      if (!e.slashes_done) {
        e.slash_offset = 6;
        if (kaizoSideb(state)) {
          e.slash_offset = 7;
        }
        e.rotation_goal = 0;
        if (e.rotation > 2) {
          e.rotation_change = 1;
        } else {
          e.rotation_change = e.rotation / 8;
        }
      }
    } else if (kaizoSideb(state) && !e.delay_swords) {
      // Step_0:57-63 — B-Side solo: cap the aim length (vanilla base 18).
      if (e.slash_base > 15) {
        e.slash_base = 15;
      }
    }

    if (globalThis.process?.env?.KNIGHT_RS_DEBUG) {
      const f = globalThis.__simFrame;
      const [a, b] = globalThis.process.env.KNIGHT_RS_DEBUG.split('-').map(Number);
      if (f >= a && f <= (b ?? a) && (e.state !== e._lastLoggedState || e.local_turntimer === 199)) {
        console.error(`[rs] f=${f} state=${e.state} timer=${e.timer} ltt=${e.local_turntimer}`
          + ` sc=${e.slash_counter} done=${e.slashes_done} a3=${e.alarm[3]}`);
        e._lastLoggedState = e.state;
      }
    }
    // ── THE FOUR EARLY-SPAWN BLOCKS — Step_0:64-196 ───────────────────────
    //
    // The mod hands the NEXT segment on MID-PATTERN, not at Alarm_2, so the
    // successor overlaps the outgoing slash by tens of frames. Verified in the
    // dump at lines 64 / 98 / 137 / 170:
    //
    //     if (local_turntimer < 240          && next_up == 1) { ... next_up = -999; }
    //     if (local_turntimer < 220          && next_up == 3) { ... next_up = -999; }
    //     if (local_turntimer < turn_limit_4 && next_up == 4) { ... next_up = -999; }
    //     if (local_turntimer < turn_limit_4 && next_up == 5) { ... next_up = -999; }
    //
    // WHY THIS SITS ABOVE THE `done` GUARD: the GML runs these every frame of
    // the instance's life, the "return" state included — same reason
    // `local_turntimer -= 1` does.
    //
    // WHAT IT COST WHILE MISSING, measured on _tok3's atk_Frenzy3 (ac 106):
    // the mod births obj_knight_weird_bottom_manager at rs+11 (the id-5 block,
    // "short mid" gives local_turntimer 260 against turn_limit_4 250, so it
    // fires on the 11th Step); the sim waited for Alarm_2 and birthed it at
    // rs+82 — **71 frames late**. Worse, arriving that way it kept the
    // manager's own Other_10 "short end" `init_start = 2; init = 1`, which the
    // Step_0 block overwrites to 4/8 AFTER event_user(0), so the sim also
    // fired a spurious second volley two frames after the first. 71 late
    // birth − 9 shorter arming = the 62-frame bullet-phase gap exactly.
    //
    // Consecutive top-level ifs FALL THROUGH in GML, and that is safe here
    // only because each block clears `next_up` — CLAUDE.md's "consecutive
    // top-level ifs fall through" applies, and one id can never take two arms.
    // `kaizoChainNext` clears it too; the assignment is kept because the GML
    // makes it unconditionally, including on the ids the switch has no case
    // for.
    if (e.local_turntimer < 240 && e.next_up === 1) {
      chainNext(state, e, 'rotating_step');
      e.next_up = -999;
    }
    if (e.local_turntimer < 220 && e.next_up === 3) {
      chainNext(state, e, 'rotating_step');
      e.next_up = -999;
    }
    if (e.local_turntimer < e.turn_limit_4 && e.next_up === 4) {
      chainNext(state, e, 'rotating_step');
      e.next_up = -999;
    }
    if (e.local_turntimer < e.turn_limit_4 && e.next_up === 5) {
      chainNext(state, e, 'rotating_step');
      e.next_up = -999;
    }

    // Kaizo Step_0:207-216 (vanilla :148-156, byte-identical) — the rail
    // counters of the aim telegraph, read by Draw_0:24-51 and by nothing else:
    //
    //     if (line2 > -1) { line2++; line2 %= 8; }
    //     if (line3 > -1) { line3++; line3 %= 8; }
    //
    // Sits here, after the next_up blocks and ABOVE the sim's `done` guard,
    // because the GML runs it every frame of the instance's life (the
    // afterimage block at :198-206 between them is visual-only and not
    // carried). Once `line2 = 0` (Step_0:590) / Alarm_1's `line3 = 0` arm a
    // counter it cycles 1..7,0 for the rest of the instance — it never returns
    // to -1 — and the Draw shows a rail pair only while the value is nonzero
    // (GML truthiness on `if (line2)`). The increment runs BEFORE the
    // `line2 = 0` write further down this Step, so the frame that arms it
    // draws no rail and the next frame draws line 1 — the game's order. Was
    // missing from both this module and sim/attacks/rotating-slash.js (the
    // vanilla module is outside this change), so the rails never lit. No RNG;
    // no Step logic reads either counter.
    if (e.line2 > -1) {
      e.line2 += 1;
      e.line2 %= 8;
    }
    if (e.line3 > -1) {
      e.line3 += 1;
      e.line3 %= 8;
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
        // toward BLUE (kaizo hunk 4 below) — the sim's original charged RED.
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
          // KAIZO Step_0:262 — hunk 2: both instances adopt the pair-shared
          // finale spin rolled in Create, so a double-knight finale whirls in
          // lockstep. Note the vanilla `spin = choose(-1, 1)` above still ran
          // (and burned its draw) before this overwrite — exactly as the GML.
          e.spin = e.finale_spin;
        }

        // The knight's aim walk — scr_lerpvar onto the box's top-right
        // corner, movebox_x over [0, 80] and movebox_y over [0, 120]. See
        // the sim module for the full derivation; NOT an RNG concern.
        {
          const b = boxEdges(state);
          const dur = e.slash_base + e.slash_offset - 8;
          scrLerpvar(state, spawn, e, 'x', e.x, b[0] - 20 + e.movebox_x, dur, 1);
          scrLerpvar(state, spawn, e, 'y', e.y, b[1] - 20 + e.movebox_y, dur, 1);
        }
      }

      // Halfway through the aim he advances one frame, and on the last frame
      // of it `image_speed` becomes 0.5 so the wind-up plays itself out.
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
        // NO SOUL, NO TARGET — see the sim module. Skipping the frame leaves
        // it where it was until the turn sweep takes it.
        if (!heart) return;
        // PRE-STEP soul position (state.soulPrev): the rotating slash is
        // created mid-turn, newer than the soul, so the runner steps it
        // first — its aim reads the soul before this frame's movement.
        const hp = state.soulPrev ?? heart;
        e.aim_x = hp.x + 10;
        e.aim_y = hp.y + 10;
      }

      // `if (timer == 1) instance_create(aim_x, aim_y, obj_knight_circle)` —
      // the bloom that marks where the fan is about to come from.
      if (e.timer === 1) {
        // KAIZO Step_0:276-277 — hunk 3: the ring origin, captured EVERY aim
        // start regardless of aim_type (the aim_x block above only runs at
        // aim_type 0). Same pre-step soul read as the aim lock-on; with no
        // soul the GML would have crashed on obj_heart, so the stale value
        // simply persists here.
        {
          const hp2 = state.soulPrev ?? state.soul;
          if (hp2) {
            e.bul_x = hp2.x + 10;
            e.bul_y = hp2.y + 10;
          }
        }
        spawn(state, knightCircle, { x: e.aim_x, y: e.aim_y });
      } else {
        // KAIZO Step_0:282-284 — hunk 4: the marker ramps toward pure BLUE
        // (vanilla: r->255, b->0). The g line and the 64/7 constant are
        // unchanged; only the r/b targets swap.
        e.r = scrApproach(e.r, 0, 9.142857142857142);
        e.g = scrApproach(e.g, 0, 9.142857142857142);
        e.b = scrApproach(e.b, 255, 9.142857142857142);
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
        // KAIZO Step_0:320-322 — hunk 5: `var _vol = 1 / instance_number(...)`
        // halves each knight's cut when two are slashing at once. Audio only;
        // no draw is taken.
        {
          const _vol = 1 / instanceNumberRotating(state);
          cue(state, 'snd_knight_cut', 1, _vol);
          cue(state, 'snd_explosion_firework', 1, _vol);
        }
        if (state.fixedSlashOrder === true && state.angleLists) {
          // Replay the oracle's shuffled order (see SHUFFLE CAVEAT) — but
          // the real ds_list_shuffle still RAN in the game and burned its
          // measured 16 u32 draws per element.
          if (state.gmlRng) {
            for (let i = 0; i < e.slash_list.length * 16; i++) gmlU32(state.gmlRng);
          }
          const rec = state.angleLists[state.angleIndex++];
          if (rec) e.slash_list = [...rec];
        } else {
          // THE LIVE PATH BURNS THE SAME 16 u32 PER ELEMENT. The branch above
          // (a pinned order) already burns them; this one used a bare
          // Fisher-Yates over the real stream, which costs n - 1 draws --
          // and ZERO for the difficulty-0 opening volley, where the list
          // holds one angle. ds_list_shuffle's 16-per-element cost is
          // measured, not assumed (CLAUDE.md "ds_list_shuffle -- measured,
          // not solved": 64 draws for n=4, 96 for n=6, 208 for n=13,
          // constant across seeds), and sim/rng.js gmlShuffle is that model.
          // The kaizo whole-fight replay runs THIS path, so every volley of
          // every rotating-slash turn left the stream 16n - (n - 1) draws
          // short -- 16 on the first volley of each of the fight's two
          // managers.
          //
          // The vanilla module keeps its own shuffleList deliberately (see
          // the note on gmlShuffle): its diff pins the order on both sides,
          // so moving its stream position would chase a number that diff
          // does not depend on. This lane's diff DOES depend on it.
          gmlShuffle(state.gmlRng, e.slash_list);
          // ...AND THE RECORDING GETS THE LAST WORD ON THE ORDER.
          // ds_list_shuffle's permutation is unsolved (its COST is measured;
          // CLAUDE.md "measured, not solved"), and the real game re-rolls it
          // every playthrough, so the order is not a fidelity property -- but
          // the whole-fight bullets sheet compares the angle of every slash,
          // so a diff needs the recording's order on both sides. The vanilla
          // lane has replayed its own since its first whole-fight diff
          // (tools/fullfight-trace.mjs --shuffle); this is that, fed from the
          // kaizo recorder's seq log (kaizo/tools/derive-shuffle.mjs).
          //
          // MATCHED BY VALUE, NOT BY POSITION: two rotating-slash managers
          // are alive at once in ac 5 and their volleys interleave frame by
          // frame, so each call takes the queue entries that belong to ITS
          // fan and leaves the rest. Compared modulo 360, because the sim's
          // list carries raw sums (base + 90 can exceed a turn) while the
          // recorder logs image_angle as the runner stores it.
          replaySlashOrder(state, e.slash_list);
        }
      }

      if (e.timer - 1 < e.slash_list.length) {
        const s = spawn(state, roaringknightSlash, { x: e.aim_x, y: e.aim_y });
        s.direction = e.slash_list[e.timer - 1];
        s.image_xscale = 2;
        s.xscale = 2;
        s.image_angle = s.direction;
        // NOT mirroring the original's `visible = false` — see the sim module.
        // NOW MIRRORED (kaizo Step_0:332 `visible = false;`, byte-identical to
        // vanilla). The sim module's reason for keeping the cut visible was
        // that the vanilla renderer had no picture of it otherwise — "a hitbox
        // and no sprite". On the kaizo page it now has the game's own picture:
        // obj_knight_rotating_slash's ported Draw_0:53-68 draws every live
        // slash's wedge inside its box-clipped surface (kaizo/render/draw/
        // quickslash.js), which in the game is the ONLY picture of a
        // rotating-slash cut, because `visible = false` keeps
        // obj_roaringknight_slash's own Draw_0 (the full-screen blue wedge at
        // image_alpha * 2) from ever running for these instances. Leaving them
        // visible drew that second wedge over the whole arena — a picture the
        // mod never shows. `visible` is Draw-side only: nothing in sim/ or
        // kaizo/ reads it for collision, graze or damage (grep'd), the trace
        // has no such column, and GML `with` still visits invisible instances
        // — the ported Draw iterates state.entities directly, so the clipped
        // wedge is unaffected. Draw-time state, on the attack module by the
        // renderer contract (kaizo/render/index.js header).
        s.visible = false;
        s.width = s.width * 2;
        s.aoe = true;
        // `scr_bullet_inherit(slashid)` — THE LINE THAT PRICES THE ENTRY
        // GRAZE. See the sim module for the full 344-vs-2267 TP derivation.
        scrBulletInherit(e, s);

        // THE SLASH-MARK DEBRIS — the original's per-slash spawn visuals,
        // untranslated as visuals but their rolls are half the stream (see
        // the sim module for the 46..76-draw derivation).
        // KAIZO Step_0:342/384/412 — hunk 6: the spr_knight_slash_mark
        // particles are c_blue instead of c_red. Visual only, the burn
        // below is byte-identical to the sim's.
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

      // KAIZO Step_0:429-496 — hunk 7: on the frame the volley's LAST slash
      // lands, and ONLY on the B-Side from the firstrot instance, a ring of
      // starchild bullets blooms from where the heart was at aim start
      // (bul_x/bul_y). 4 base, 6 when slash_number > 2, 8 when > 4 — the d8
      // table's 5-slash volleys are the only path to the 8-ring. Suppressed
      // entirely when a sword-vortex manager, the underbox manager, or (in
      // phase 2) a tracking-swords manager is alive, or once the finale has
      // collapsed cooldown_time to 2. Alternate volleys are offset half a
      // step (rotind parity). NO draws in this hunk — the ring itself is
      // deterministic; the per-frame burn is kaizo_slashbullet_step's.
      if (e.timer === e.slash_list.length) {
        const _bx = e.bul_x;
        const _by = e.bul_y;
        if (kaizoSideb(state) && e.firstrot) {
          if (e.rotind === undefined) e.rotind = 0; // variable_instance_exists
          if (e.cooldown_time > 2) {
            let _amt = 4;
            const _spd = 10;
            if (e.slash_number > 2) _amt = 6;
            if (e.slash_number > 4) _amt = 8;
            if (instanceExists(state, 'obj_sword_vortex_manager')) _amt = -1;
            if (instanceExists(state, 'obj_knight_weird_bottom_manager')) _amt = -1;
            // `obj_knight_enemy.phase == 2` — the fight phase, tracked as
            // state.knightPhase by both turn loops (practice.js: "state.
            // knightPhase tracks its value"); state.knight.phase is the
            // fallback for scenes that never ran a director.
            if (instanceExists(state, 'obj_tracking_swords_manager')
              && (state.knightPhase ?? state.knight?.phase) === 2) _amt = -1;
            // GML `for (i = 0; ...)` writes the INSTANCE variable i (no
            // `var`) — nothing anywhere reads it back, so a local stands in.
            for (let i = 0; i < _amt; i++) {
              let _rot = (i / _amt) * 360;
              if (e.rotind % 2 === 1) {
                _rot += (0.5 / _amt) * 360;
              }
              const b = spawn(state, kaizoSlashRingBullet, { x: _bx, y: _by });
              // MOD WRITE-ONLY: `flag = "exp"` has no reader anywhere in the
              // kaizo dump — kept for parity, same family as the sim's
              // ORIGINAL BUG write-only vars.
              b.flag = 'exp';
              b.target = 0;
              b.damage = 140;
              // KAIZO Step_0:461 — `image_blend = get_swordcolor()`. The ring
              // is BLUE. A pure palette lookup (scr_complete_save_file.gml:
              // 269-286) that draws NO RNG, and the STABLE reference from
              // kaizo-colors.js so a later `== get_swordcolor()` gate holds.
              b.image_blend = getSwordcolor(state);
              b.sprite_index = 'spr_knight_starchild';
              b.direction = _rot;
              b.image_angle = b.direction;
              b.image_xscale = 0;
              b.image_yscale = 0;
              b.speed = 0;
              b.active = 1;
              b.image_alpha = 1;
              // The four tweens, in the GML's order. NOTE the -1 pointa on
              // `speed` is a REAL start value, not a read-current sentinel —
              // obj_lerpvar's Step only defers on a STRING pointa — so the
              // ring's first written speed is lerp(-1, 10, 1/12) ~ -0.083
              // (one frame of drift backward) before the ramp to 10. The
              // delta spec's "sentinel" note is wrong; the GML is the
              // territory.
              scrLerpvar(state, spawn, b, 'image_xscale', 0, 0.9, 12);
              scrLerpvar(state, spawn, b, 'image_yscale', 0, 0.45, 12);
              scrLerpvar(state, spawn, b, 'speed', -1, _spd, 12);
              scrLerpvar(state, spawn, b, 'image_alpha', 3.5, 0, 35);
              scrDelayVar(state, b, 'active', 0, 25);
              b.destroyonhit = 0;
              scrScriptRepeat(state, b, kaizoSlashbulletStep, 35, 1);
            }
            e.rotind += 1;
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
          // The aim phase SHORTENS each cycle — see the sim module.
          e.slash_offset = scrApproach(e.slash_offset, 0, 6);
          e.slash_base = scrApproach(e.slash_base, 15, 1);
        }

        if (e.local_turntimer < 200 && !e.slashes_done) {
          e.slashes_done = true;
          e.local_turntimer = 99999;
        }

        // ONCE THE SIX CUTS ARE DONE the attack forks, and only one arm of the
        // fork is the spiral (difficulty 2 "full" turns only — a d8/d10 kaizo
        // instance winds down here exactly like vanilla d0/d1).
        if (e.slashes_done) {
          if (e.difficulty === 2 && e.turn_type === 'full') {
            if (e.do_final) {
              // KAIZO Step_0:526-539 — hunk 8, the FIRST thing inside
              // do_final: the firstrot instance re-rolls a fully random
              // finale aim (irandom(359), 2 draws); a second instance copies
              // the firstrot sibling's CURRENT aim ± 45 ± up to 5
              // (choose + random_range, 2 draws, left-to-right).
              if (e.firstrot) {
                e.aim_direction = gmlIrandom(state.gmlRng, 359);
              } else {
                for (const other of state.entities) {
                  if (!other.alive || other.type.name !== 'obj_knight_rotating_slash') continue;
                  if (other.firstrot !== undefined && other.firstrot) {
                    e.aim_direction = other.aim_direction
                      + gmlChoose(state.gmlRng, [-45, 45])
                      + gmlRandomRange(state.gmlRng, -5, 5);
                  }
                }
              }
              // He vanishes and reappears for the finisher.
              cue(state, 'snd_knight_puff');
              cue(state, 'snd_knight_teleport', 0.5);
              // The handoff into the spiral — see the sim module.
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
            // HANDOFF alarm instead, four frames later. ARMED ONCE — see the
            // sim module for why the flag exists.
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
            e.alarm[3] = 22;
            return;
          }
        }

        if (e.aim_type < 2) {
          e.state = 'aim';
          e.timer = 0;
          // 0 -> 1 -> 2 IN ONE FRAME — see the sim module.
          if (e.aim_type === 1) {
            e.line2 = 0;
            e.alarm[1] = 4;
            e.aim_type = scrApproach(e.aim_type, 2, 1);
          }
          return;
        }

        // THE SPIRAL. No aim phase at all any more — cooldown goes straight
        // back to slash, `aim_direction` advancing by an accelerating
        // `speed_gain` each time.
        e.state = 'slash';
        e.timer = 0;
        e.aim_direction += e.speed_gain * e.spin;
        e.speed_gain = scrApproach(e.speed_gain, 24, 1);
        e.final_counter += 1;
        // KAIZO Step_0:603-615 — hunk 9: the B-Side finale runs 56 slashes
        // (42 when a sword-vortex manager is also on screen); vanilla 28.
        let _endslashamt = 28;
        if (kaizoSideb(state)) {
          if (instanceExists(state, 'obj_sword_vortex_manager')) {
            _endslashamt = 42;
          } else {
            _endslashamt = 56;
          }
        }
        if (e.final_counter === _endslashamt) {
          e.state = 'return';
          e.done = true;
          // Alarm_3 is one line, `instance_destroy()` — 22 frames after the
          // last slash.
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
 * `scr_get_box`, index for index — **0 is the RIGHT edge and 2 is the LEFT**
 * (the original computes 0 as `x + sprite_width * 0.5`). 1 is top, 3 bottom.
 */
function boxEdges(state) {
  const gt = state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
  if (!gt) return [0, 0, 0, 0];
  const hw = (gt.spriteWidth ?? 75 * gt.image_xscale) * 0.5;
  const hh = (gt.spriteHeight ?? 75 * gt.image_yscale) * 0.5;
  return [gt.x + hw, gt.y - hh, gt.x - hw, gt.y + hh];
}

/** obj_dbulletcontroller `type = 104` — same shape as the sim's spawner; the
 *  mod's paired turns simply call this twice (two controllers). */
export function spawnRotatingSlash(state, x, y, { difficulty = 0 } = {}) {
  // obj_dbulletcontroller type 104 does `with (creatorid) image_alpha = 0`
  // before creating this — THIS object becomes the visible knight.
  const knight = state.entities.find(
    (k) => k.alive && k.type.name === 'obj_knight_enemy',
  );
  if (knight) knight.image_alpha = 0;

  const e = spawn(state, rotatingSlash, { x, y });
  e.difficulty = difficulty;
  rotatingSlash.init(e);
  return e;
}

// NO registerComboAttack call here — deliberately. See the header: the sim
// module registers itself as combination segment 2, and re-registering the
// kaizo variant would hijack the shared registry for the verified sim.
