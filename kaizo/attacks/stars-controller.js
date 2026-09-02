// KAIZO obj_dbulletcontroller, type 98 — the STARS spawner (ac 1) as the mod
// rebuilds it.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission (kaizo/HANDOFF.md §5-C publish gate).
//
// PROVENANCE: copied from the VERIFIED sim/attacks/stars-controller.js and
// changed ONLY where the mod's GML diverges from vanilla v105. Ground truth:
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_Object_obj_dbulletcontroller_Step_0.gml (type 98: lines 1986-2103)
//   delta spec: knight-research/kaizo-mod/deltas/
//     gml_Object_obj_dbulletcontroller_Step_0.md (MOD hunk 2)
//
// DIVERGENCES from the sim module (each cited at its site):
//   * init: `starid = 0` (l.1996); turn bonus `+= 60` -> `+= 90` and gated
//     `difficulty >= 2 && difficulty != 3.2 && difficulty != 3.3`
//     (l.1997-2001); endtimer bonus stays +90 net (the launch helper below
//     carries it, as fight.js case 1 does for the sim).
//   * `delay = 0; subdelay = 0` (l.2003-2004) translated explicitly: the sim
//     models the controller's starchild-stagger chain as state.childDelay /
//     state.childSubdelay and relied on fresh state + the --shards replay;
//     kaizo runs many Stars turns with no replay, so the fresh controller's
//     reset is load-bearing.
//   * spawn cadence: first star at `btimer >= 33`, not 45 (l.2019).
//   * the starexp exploding-star schedule (l.2025-2055) stamped as
//     `d.starry` (l.2059) — deterministic from starid, NO RNG drawn.
//   * `if (difficulty == 3.3) btimer = -1` after the reset (l.2098-2101).
//   * `e.ctype = 98` — the mod's dbulletcontroller carries a `type` mode tag
//     that obj_knight_pointing_starchild's kaizo Step gates on; `type` is an
//     ENGINE field in this engine, so it is renamed (the swordslash 'variant'
//     rule).
// Fractional difficulties (3.1/3.2/3.3) are compared with gmlEq, never ===.
//
// COLOUR — audited: the type-98 branch (l.1986-2103) contains no image_blend,
// no merge_color and no get_swordcolor; the spawner stamps geometry, speed,
// starid and `starry`, and nothing chromatic. The mod's blue for this attack
// lives on the objects it creates — the STAR's charge/stay ramps
// (stars-pointing-star.js) and the SHARD's coltimer scheme
// (stars-pointing-starchild.js) — plus the cone's doubled flow layers, which
// are draw-call multiplicity and stay renderer work (stars-pointing-cone.js).
//
// Everything below not marked KAIZO is byte-identical to the sim module.
// ---------------------------------------------------------------------------
// (sim header, still true:)
// The controller derives each star from a pair of values that evolve per star:
//
//   size    += 0.5 + sin(made) * 0.5,  then % 1
//   special += 0.5 + (0.5 + sin(random(1)) * 0.3),  then % 1, then -= 0.5
//   direction = 180 + special * cone.angle
//   speed     = lerp(10, 5, size)
//
// `sin(random(1))` makes the launches unreproducible without the real stream,
// so the ORACLE SCENE replays them from the recording. In the playable build
// there is nothing to replay against, so it rolls them off gmlRng — which is
// the honest behaviour: the real game rerolls every playthrough too.
//
// ORIGINAL BUG, preserved (kaizo keeps it verbatim, l.2095): the controller
// sets `d.grow_Speed` (capital S) while obj_knight_pointing_star reads
// `growspeed`. Different variables, so the intended per-star growth variation
// never happens and every star grows at the same 0.02.

import { spawn } from '../../sim/entity.js';
import { cue } from '../../sim/audio.js';
import { scrMovetowards, scrEaseOut, lerp, gmlEq } from '../../sim/gml.js';
import { gmlRandomRange, gmlChoose, gmlRandom } from '../../sim/rng.js';
import { pointingStar } from './stars-pointing-star.js';
import { pointingCone } from './stars-pointing-cone.js';
import { heartFollower } from '../../sim/attacks/pointing-starchild.js';

export const starsController = {
  name: 'obj_dbulletcontroller',
  // See pointingCone's stepOrder note. The controller precedes the cone,
  // which precedes the heart: [-2, -1, 0].
  stepOrder: -2,

  create(e, state) {
    e.btimer = 0;
    e.made = 0;
    e.endtimer = 120;
    e.init = 2;
    e.size = 0;
    e.special = 0;
    // KAIZO l.1996: `starid = 0;` — counts spawned stars; the starexp
    // schedule below is a pure function of it.
    e.starid = 0;
    // KAIZO: the mod's controller `type` mode tag (obj_knight_pointing_
    // starchild's kaizo Step gates its stagger chain on `type == 98`).
    // `type` is engine-owned here — renamed ctype, per the project law.
    e.ctype = 98;
    // KAIZO l.2003-2004: `delay = 0; subdelay = 0;` — the fresh controller's
    // stagger-chain reset, modelled on state (see sim/attacks/
    // pointing-starchild.js chainChildDelay). The sim module leaves these to
    // fresh-state defaults + the --shards replay; kaizo has no replay and
    // multiple Stars turns per fight, so the per-turn reset must be explicit.
    state.childDelay = 0;
    state.childSubdelay = 0;

    // obj_heart_follower — the soft-following ghost the homing starchildren
    // aim at (they lead the soul rather than tracking it exactly). The type-98
    // controller creates it, which is here.
    //
    // It was missing outside the oracle scene, which spawned one by hand. In a
    // real turn the difficulty-2 shards therefore had nothing to home toward
    // and flew in straight lines — the "homing stars just move horizontally"
    // report. Nothing in the verifier could catch it: the scene supplied the
    // follower itself, so the suite never exercised the controller's job.
    if (state.soul && !state.entities.some((x) => x.alive && x.type.name === 'obj_heart_follower')) {
      spawn(state, heartFollower, { x: state.soul.x, y: state.soul.y });
    }
  },

  step(e, state) {
    // The init-block's `global.turntimer += 30` (and the difficulty bonus)
    // is paid on the LAUNCH FRAME, which for this engine means `create` —
    // and the paragraph that used to stand here said the opposite, so the
    // reason for the change is written out rather than swapped silently.
    //
    // The mod's dc lands its init block in its own Step, one frame after the
    // DISPATCH — which is the launch frame, not the frame after the launch
    // (kaizo-mod-launcher.js vcTurnLength says the same thing about the
    // PINNERS: 'the controller's Step, one frame after the dispatch', and
    // 'the managers pin at their creation -- the launch frame'). This engine
    // creates the controller ON the launch frame and its step phase has
    // already walked past it, so a payment in `step` lands one frame late.
    // The old note was measured before the dispatch/launch split existed.
    //
    // MEASURED on _tok3's atk_Starstorm2. The dispatch frame is oracle f4056
    // and both sides read turntimer 239 there. The recording then reads 358
    // on f4057 (239 - 1 + 30 + 90) while the sim read 238 and only reached
    // 357 on f4058, one frame behind for the rest of the turn. The tracer's
    // own watch confirms the shape: the controller is born on sim f4184
    // (= oracle f4057) with the flag unset and pays on f4185.
    //
    // The flag stays, and the step keeps checking it, so that a controller
    // reached by any other route still pays exactly once.
    if (!e.turntimerPaid) {
      e.turntimerPaid = true;
      state.turntimer += 30;
      // KAIZO l.1997-2001: vanilla `if (difficulty >= 2) global.turntimer
      // += 60` becomes `+= 90`, and difficulties 3.2 / 3.3 are EXCLUDED
      // from the bonus entirely:
      //     if (difficulty >= 2 && difficulty != 3.2 && difficulty != 3.3)
      //         { global.turntimer += 90; endtimer += 90; }
      // (endtimer's +90 is carried by launchKaizoStars, the way fight.js
      // case 1 carries the sim's.) Fractional compares via gmlEq.
      const d = e.difficulty ?? 0;
      if (d >= 2 && !gmlEq(d, 3.2) && !gmlEq(d, 3.3)) state.turntimer += 90;
    }
    if (e.init >= 3) return;

    e.btimer += 1;

    // POST-DECREMENT READ. The dc's stop check sees the clock as of this
    // frame's END: verify21j turn 11 (Stars d2, endtimer 210) spawns its
    // last star at f4239 and stays silent at f4243, where the pre-decrement
    // value is 211.9 (> 211, would spawn) and the post 210.9 (stops). The
    // cone's own release check stays on the pre-decrement read the earlier
    // turns pinned — the two objects genuinely read the clock at different
    // effective moments, and each check carries the receipt that set it.
    if (state.turntimer - 1 <= e.endtimer + 1) {
      e.init = 3;
      return;
    }

    // KAIZO l.2019: `(made != 0 && btimer >= 4) || btimer >= 33` — the first
    // star arrives 12 frames sooner than vanilla's 45.
    if ((e.made !== 0 && e.btimer >= 4) || e.btimer >= 33) {
      const cone = state.entities.find(
        (x) => x.alive && x.type.name === 'obj_knight_pointing_cone',
      );
      if (!cone) return;

      // THE ANGLE THE CONE WILL HAVE THIS FRAME, not the one it has. Two
      // exact measurements pin an ordering the per-instance model cannot
      // produce: the first star's special is us[39] of the anchored stream
      // TO THE LAST DIGIT only if dir used angle 56.25 — the value the cone
      // reaches during the SAME frame — while size sits at us[38], which
      // requires the controller's rolls to precede the cone's two drag
      // draws. So the game's dc reads a current-frame angle while drawing
      // first. Reproduced by advancing a COPY of the cone's own
      // deterministic ramp (movetowards 0.025, ease_out 6) — no state is
      // touched, no draws consumed; the cone still runs its real update
      // afterwards. Marked as an ordering reconciliation: the underlying
      // event scheduling is not fully understood, the two measurements are.
      let coneAngle = cone.angle;
      if ((cone.angle ?? 0) < (cone.target_angle ?? 60) && (cone.con ?? 0) >= 2) {
        const nextLerp = scrMovetowards(cone.angle_lerp ?? 0, 1, 0.025);
        coneAngle = lerp(0, cone.target_angle ?? 60, scrEaseOut(nextLerp, 6));
      }

      // DIFFICULTY 2 RE-ROLLS THE BURST AXIS PER STAR, before the star is
      // created (the choose sits directly above `scr_childbullet` in the
      // spawn branch):
      //
      //     if (difficulty == 2) side = choose(0, 66, -66);
      //
      // so each star's two shard headings tilt to vertical or ±66 degrees.
      // This was promised by a launchAttack comment and NEVER IMPLEMENTED:
      // `e.side ?? 1` left every difficulty-2 burst on the one axis 90+1,
      // which flattened the whole pattern — reported from play as "the
      // hardest Stars is off, most of the move is wrong".
      if ((e.difficulty ?? 0) === 2 && state.gmlRng) {
        e.side = gmlChoose(state.gmlRng, [0, 66, -66]);
      }

      // KAIZO l.2025-2055: the exploding-star schedule. Deterministic from
      // starid and the B-Side flag — NO RNG drawn, so the vanilla draw order
      // around it is untouched (delta spec, translation notes). starid is
      // 1-based for the first star (incremented before the tests).
      //
      //   sideb, d 3.1     -> odd starids explode (1 of every 2)
      //   sideb, otherwise -> 3 of every 4 (starid % 4 != 0)
      //   d 3.1            -> 1 of every 2
      //   default          -> 2 of every 3 (starid % 3 != 0)
      //   d 1 or 3.3       -> EVERY star explodes (unconditional override)
      //
      // A star with starexp 0 is never recalled by the cone: it gets
      // `stay = 1` instead and lingers (see stars-pointing-cone.js).
      e.starid += 1;
      let starexp = 0;
      const kaizoSideb = !!(state.kaizo && state.kaizo.sideb);
      const kd = e.difficulty ?? 0;
      if (kaizoSideb) {
        if (gmlEq(kd, 3.1)) {
          if (e.starid % 2 >= 1) starexp = 1;
        } else if (e.starid % 4 >= 1) starexp = 1;
      } else if (gmlEq(kd, 3.1)) {
        if (e.starid % 2 >= 1) starexp = 1;
      } else if (e.starid % 3 >= 1) starexp = 1;
      if (kd === 1 || gmlEq(kd, 3.3)) starexp = 1;

      // THE STAR IS CREATED BEFORE THE ROLLS. `d = scr_childbullet(...)` runs
      // first — and the star's Create draws its `dir = choose(-1, 1)` — THEN
      // the controller rolls size/special. Rolling first put the sim's size
      // one stream position early (us[37] instead of us[38]), which two
      // recordings measured as speed 7.2553 vs the oracle's 6.8077.
      const d = spawn(state, pointingStar, { x: cone.x + 22, y: cone.y + 56 });
      d.difficulty = e.difficulty ?? 0;
      d.side = e.side ?? 1;
      // KAIZO l.2059: `d.starry = starexp;`
      d.starry = starexp;

      // EVERY STAR DROPS WITH A SOUND, and Stars was silent without it:
      //
      //     starsound = snd_play_pitch(snd_stardrop, 0.5);
      //     snd_volume(starsound, 0.5, 0);
      //
      // Pitched down half and at half volume, once per spawn — roughly every
      // four frames while the cone is open, so it is the attack's whole
      // texture as the fan fills up. Reported from play as "stars is missing
      // some sounds"; an audit of every snd_play in the live knight objects
      // against the sim's cues (the same sweep that found the tunnel sword's
      // jump and the charge-up's powerup) is what confirmed which.
      cue(state, 'snd_stardrop', 0.5, 0.5);

      let direction;
      let speed;
      const replay = state.starVariant ? state.starVariant.launches : null;
      if (replay) {
        const rec = replay[e.made];
        if (!rec) { d.alive = false; return; }
        direction = rec.direction;
        speed = rec.speed;
      } else if (e.made === 0) {
        // THE FIRST STAR ROLLS, the rest INCREMENT:
        //
        //     if (made == 0) { size = random_range(0.5, 1);
        //                      special = random_range(-0.5, 0.5); }
        //     else { ...the += formulas... }
        //
        // This branch was MISSING: every star took the else-arm, and with
        // size starting at 0 the first star's size was (0 + 0.5 + sin(0)/2)
        // % 1 = exactly 0.5 — speed exactly 7.5, which is what finally gave
        // it away: two independent recordings measured the sim at 7.5000
        // while the oracle rolled 6.8077 = lerp(10, 5, us[38]) of the
        // anchored stream, to the last digit.
        e.size = gmlRandomRange(state.gmlRng, 0.5, 1);
        e.special = gmlRandomRange(state.gmlRng, -0.5, 0.5);
        direction = 180 + e.special * coneAngle;
        speed = lerp(10, 5, e.size);
      } else {
        e.size = (e.size + (0.5 + Math.sin(e.made) * 0.5)) % 1;
        const _u = gmlRandom(state.gmlRng, 1);
        if (globalThis.process?.env?.KNIGHT_STAR_DEBUG) {
          console.error(`[chain] made=${e.made} specialPrev=${e.special} u=${_u} sin=${Math.sin(_u)}`);
        }
        e.special =
          ((e.special + (0.5 + (0.5 + Math.sin(_u) * 0.3))) % 1) - 0.5;
        direction = 180 + e.special * coneAngle;
        speed = lerp(10, 5, e.size);
      }

      // `if (size <= 0.1)` — the fast-star aim clamp. A star this small is
      // near max speed, and if its heading lies within 20 degrees of the
      // soul it is pushed OUT to exactly 20 degrees off, then looped back
      // into the cone's arc. Deterministic — no draws — but absent it a
      // sub-0.1 roll fires a near-guaranteed hit the real game never fires.
      if (!replay && e.size <= 0.1 && state.soul) {
        const hx = state.soul.x + 10 - (cone.x + 22);
        const hy = state.soul.y + 10 - (cone.y + 56);
        const heartdir = ((Math.atan2(-hy, hx) * 180) / Math.PI + 360) % 360;
        let diffd = ((heartdir - direction) % 360 + 540) % 360 - 180;
        if (Math.abs(diffd) < 20) {
          direction = direction < heartdir
            ? heartdir - 20 + diffd
            : heartdir + 20 + diffd;
          const lo = 180 - cone.angle;
          const hi = 180 + cone.angle;
          const span = hi - lo;
          if (span > 0) {
            while (direction < lo) direction += span;
            while (direction > hi) direction -= span;
          }
        }
      }

      d.direction = direction;
      d.speed = speed;
      if (globalThis.process?.env?.KNIGHT_STAR_DEBUG) {
        console.error(`[star] f=${globalThis.__simFrame} made=${e.made} size=${e.size}`
          + ` special=${e.special} coneAngle=${coneAngle} dir=${direction} spd=${speed}`);
      }

      e.made += 1;
      e.btimer = 0;
      // KAIZO l.2098-2101: `if (difficulty == 3.3) btimer = -1;` — one extra
      // frame before the next spawn (every 5 frames instead of every 4).
      if (gmlEq(e.difficulty ?? 0, 3.3)) e.btimer = -1;
    }
  },
};

/**
 * KAIZO endtimer rule — the type-98 init's net endtimer, lifted to the launch
 * site exactly as fight.js case 1 lifts the sim's (`difficulty >= 2 ? 210 :
 * 120`). Kaizo l.1995-2001: base 120, +90 when
 * `difficulty >= 2 && difficulty != 3.2 && difficulty != 3.3`.
 */
export function kaizoStarsEndtimer(difficulty) {
  const d = difficulty ?? 0;
  return d >= 2 && !gmlEq(d, 3.2) && !gmlEq(d, 3.3) ? 210 : 120;
}

/** Stars' cone spawn point — fight.js's measured constant, unchanged. */
export const CONE_POS = { x: 425, y: 78.56589 };

/**
 * NEW LAUNCH HELPER — fight.js `launchAttack` case 1, verbatim, with the two
 * kaizo differences: the endtimer rule above, and the kaizo module pair. The
 * central launcher (kaizo-mod-launcher.js case 98) should call this instead
 * of its inline copy. Spawn order is stream order: the CONTROLLER first (its
 * type-98 init then creates the cone), so dc.seq < cone.seq and the dc steps
 * first — that decides who touches the RNG stream first on the frame the
 * first star spawns.
 *
 * The `difficulty == 0` side choose and the two unattributed pad draws are
 * fight.js's, kept identical (the pads are oracle-fitted against the VANILLA
 * recording; whether the mod's stream needs them is a V-C oracle question —
 * flagged in the task return's open list).
 */
export function launchKaizoStars(state, difficulty, pos = CONE_POS) {
  const endtimer = kaizoStarsEndtimer(difficulty);
  const dc = spawn(state, starsController, { ...pos });
  dc.difficulty = difficulty;
  dc.endtimer = endtimer;
  // THE INIT BLOCK'S CLOCK IS PAID ON THE LAUNCH FRAME — see the long note
  // over the controller's `step`. It cannot go in `create`: `difficulty`
  // is written onto the entity on the two lines above, so a create-time
  // read sees undefined and the +90 never lands.
  dc.turntimerPaid = true;
  state.turntimer += 30;
  if (difficulty >= 2 && !gmlEq(difficulty, 3.2) && !gmlEq(difficulty, 3.3)) {
    state.turntimer += 90;
  }
  const cone = spawn(state, pointingCone, { ...pos });
  cone.difficulty = difficulty;
  cone.con = 1;
  cone.endtimer = endtimer;
  // `if (difficulty == 0) side = choose(-1, 1);` — the last line of the
  // type-98 init, a REAL draw on the stream (see fight.js case 1's note).
  if (difficulty === 0 && state.gmlRng) {
    dc.side = gmlChoose(state.gmlRng, [-1, 1]);
  }
  // THE TWO PAD DRAWS STAY, and the audit's complaint about them is recorded
  // here rather than acted on. fight.js case 1 calls them "two unattributed
  // pads"; the whole-fight draw audit says this lane opens BOTH Starstorm
  // turns exactly +2 because of them (probe turn 1 anchor n=0 f12 and turn 11
  // anchor n=15 f4045, game 8 against sim 10 on the launch frame).
  //
  // REMOVING THEM IS WORSE, measured 2026-09-02: the probe fight stops
  // launching after turn 2 (the drawlog's spawnn goes 1 -> 3 and then never
  // moves, against 50 launches with them in). So they are not merely two
  // spare draws -- something downstream of this stream position gates the
  // turn loop, and the two draws are holding a DIFFERENT fault in place.
  // Whatever the right answer is, it is not deleting these two lines.
  if (state.gmlRng) {
    for (let pad = 0; pad < 2; pad++) gmlRandom(state.gmlRng, 1);
  }
  return dc;
}
