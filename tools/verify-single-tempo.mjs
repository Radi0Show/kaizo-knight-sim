#!/usr/bin/env node
// THE SINGLE-ATTACK DRILL'S TEMPO — what was cut, and what was NOT.
//
// Reported from play: the wait between one run of an attack and the next is too
// long. Measured before anything was changed, because "feels long" is not a
// number. One cycle of every entry in ATTACK_MENU, frame by frame:
//
//   launch -> the attack's own turn clock -> drain -> reset -> gap -> launch
//
// There is no menu, no writer, no FIGHT bar and no scene rebuild anywhere in
// that loop — this mode never builds them — so the entire wait was the last two
// terms, and both were measured wrong in the same direction:
//
//   GAP    45 frames flat. 33 of them were a settled placeholder box with no
//          soul and no bullets; the last 12 are the fight's own `rtimer == 12`
//          beat and are load-bearing.
//   DRAIN  up to 90 frames, gated on "are any bullets left". `scr_bullet_init`
//          stamps `isBullet` on SPAWN MANAGERS too, and four of them are
//          maskless controllers parked above the arena that never leave — so
//          ac 11, 13, 14 and 17 sat through the full 90 with an empty screen.
//
// What this suite pins is BOTH directions, because they look alike and only one
// is a bug:
//
//   * the waits that were dead really are gone (cycles are shorter than the
//     recorded before-numbers, by 25 frames at the least and 118 at the most);
//   * the waits that were CONTENT are untouched — the six attacks whose real
//     bullets are still crossing the board at drain frame 88 keep all 90, the
//     turn clock is not shortened for anybody, and the 12-frame board beat and
//     the soul's flight-in still happen in that order before every launch.
//
// An idea that was measured and REJECTED, recorded here so it is not
// re-proposed: "an off-screen bullet cannot be dodged, so it should not hold
// the drain open". Bullets come BACK — 1094 re-entries into the 640x480 view in
// one run of ac 12, 231 in ac 9, 92 in ac 4. Off-screen is not gone.

import { createState, stepFrame } from '../sim/index.js';
import { spawn } from '../sim/entity.js';
import { buildSingleAttackScene, ATTACK_MENU } from '../sim/scenes/single.js';
import { SPRITE_MASKS } from '../sim/masks.js';

const IDLE = { left: false, right: false, up: false, down: false, focus: false };
const failures = [];

/** `rtimer == 12`. The board opens this many frames before the attack lands. */
const RTIMER_BEAT = 12;
/** obj_moveheart's alarm: the soul is created 8 frames after the board opens. */
const SOUL_FLIGHT = 8;

/**
 * MEASURED ON THE UNMODIFIED FILE — the numbers the complaint was about. Every
 * cycle must now come in under its entry here; these are not targets, they are
 * the "before" column.
 */
const BEFORE_CYCLE = {
  stars: 309, tracking11: 425, flurry: 463, tunnel: 425, rotating: 288,
  vortex: 424, tracking14: 433, roaring: 860, stream: 373, swordfall: 279,
  underbox: 444, knightlines: 224, swordslash: 324, tunnel2: 318,
  combination: 273, diagonal: 418, rotating16: 377, tracking17: 373,
};

/**
 * MEASURED AFTER. `turn` and `bulletFrames` are FLOORS — an attack may legally
 * grow (another lane lengthening one is not this suite's business) but may not
 * shrink, because shrinking them is what "cut the content instead of the wait"
 * looks like. `cycle` is a CEILING.
 */
const AFTER = {
  stars: { turn: 239, cycle: 280, bulletFrames: 218 },
  tracking11: { turn: 291, cycle: 307, bulletFrames: 258 },
  flurry: { turn: 329, cycle: 434, bulletFrames: 386 },
  tunnel: { turn: 291, cycle: 307, bulletFrames: 229 },
  rotating: { turn: 243, cycle: 259, bulletFrames: 75 },
  vortex: { turn: 290, cycle: 395, bulletFrames: 374 },
  tracking14: { turn: 299, cycle: 315, bulletFrames: 266 },
  roaring: { turn: 815, cycle: 831, bulletFrames: 603 },
  stream: { turn: 239, cycle: 344, bulletFrames: 292 },
  swordfall: { turn: 234, cycle: 250, bulletFrames: 211 },
  underbox: { turn: 310, cycle: 415, bulletFrames: 354 },
  knightlines: { turn: 90, cycle: 195, bulletFrames: 154 },
  swordslash: { turn: 268, cycle: 295, bulletFrames: 258 },
  tunnel2: { turn: 273, cycle: 289, bulletFrames: 215 },
  combination: { turn: 228, cycle: 244, bulletFrames: 172 },
  diagonal: { turn: 284, cycle: 389, bulletFrames: 372 },
  rotating16: { turn: 243, cycle: 283, bulletFrames: 235 },
  tracking17: { turn: 239, cycle: 255, bulletFrames: 186 },
};

/**
 * THE ATTACKS THE MANAGER WAS HOLDING HOSTAGE. Nothing but a maskless
 * `obj_tracking_swords_manager` / `obj_sword_tunnel_manager` is alive through
 * their drain, so the drain must now be over the frame the clock runs out.
 */
const MANAGER_HELD = ['tracking11', 'tunnel', 'tracking14', 'tracking17'];

/**
 * THE ATTACKS WHOSE DRAIN IS CONTENT. Real, masked, collidable bullets are
 * still overlapping the board at drain frame 88 — these must keep ALL 90, or
 * the drill is sweeping bullets the player is mid-dodge of.
 */
const CONTENT_HELD = ['flurry', 'vortex', 'stream', 'underbox', 'knightlines', 'diagonal'];
const FULL_DRAIN = 89;
/** single.js's own DRAIN. The reset is taken on the frame `e.drain` reaches it. */
const DRAIN_CAP = 90;

const dirOf = (st) => st.entities.find((x) => x.type && x.type.name === 'practice_director');
const bullets = (st) =>
  st.entities.filter((x) => x.alive && x.isBullet && x.type.name !== 'obj_heart');
const hasMask = (b) => (b.mask ?? SPRITE_MASKS[b.sprite_index] ?? null) !== null;
/**
 * ARMED WITHOUT A MASK — the half of the drill's test that a mask lookup alone
 * does not give you, and the one that would have been a silent hole.
 *
 * The collision loop's default path is `spriteMaskHit`, which a maskless bullet
 * fails — but a type may OVERRIDE the test, and `obj_roaringknight_splitslash`
 * (ac 2, Flurry) does, with `scr_precise_hit` and an Other_15, while running
 * with no mask resolved. It can hit while it is invisible to every mask lookup.
 * `maskOff` (`mask_index = spr_nomask`) is skipped by the collision loop
 * outright, so it is not armed whatever else it carries.
 */
const armed = (b) => !!b.type.collides && !!b.type.other15 && !b.maskOff;
/** What the drill must wait for: anything visible, or anything that can hit. */
const holdsDrain = (b) => hasMask(b) || armed(b);
const realBullets = (st) => bullets(st).filter(hasMask);

// POSITIVE EXECUTION COUNTERS — a suite of bounds can pass while the mechanism
// it is bounding never ran. These must all end non-zero.
let masklessSeenInDrain = 0;
let masklessWithAMask = 0;
let armedMasklessSeen = 0;
let sweptSomethingLive = 0;
let arenaBeatsChecked = 0;
let soulFlightsChecked = 0;
let runsCompleted = 0;

for (const m of ATTACK_MENU) {
  const want = AFTER[m.id];
  if (!want) { failures.push(`${m.id} has no recorded tempo row`); continue; }

  const st = createState({ seed: 12345, traceBulletSlots: 0 });
  // The drill can die, and an idle soul in a 3-run window does. keepAlive is
  // the engine's own "drive the drill without the party mattering" path, the
  // same one verify-graze uses; nothing here reads HP.
  st.keepAlive = true;
  buildSingleAttackScene(st, { seed: 12345, attack: m.id, difficulty: m.difficulties[0] });
  const d = dirOf(st);
  if (!d) { failures.push(`${m.id}: no practice_director in the built scene`); continue; }

  let prevStarted = false;
  let launch1 = -1;
  let launch2 = -1;
  let timeUp = -1;
  let reset = -1;
  let arenaOpen = -1;
  let soulBorn = -1;
  let bulletFrames = 0;
  let emptyDrainFrames = 0;

  for (let f = 0; f < 4000; f++) {
    stepFrame(st, IDLE);

    // The board's own handshake: `gt.arenaOpened` is stamped by the director
    // the frame openArena runs, which is the `rtimer == 12` beat.
    if (arenaOpen < 0) {
      const gt = st.entities.find(
        (x) => x.alive && x.type.name === 'obj_growtangle' && x.arenaOpened === m.ac,
      );
      if (gt) arenaOpen = f;
    }
    if (soulBorn < 0 && st.soul && st.soul.alive) soulBorn = f;

    if (!prevStarted && d.started) {
      if (launch1 < 0) launch1 = f;
      else { launch2 = f; break; }
    }

    if (launch1 >= 0 && launch2 < 0) {
      const real = realBullets(st);
      if (real.length > 0) bulletFrames += 1;
      // THE MECHANISM THAT CLOSES THE HOLE MUST ACTUALLY RUN. If no maskless
      // bullet is ever armed anywhere in a run, the `|| armed(b)` half of the
      // drill's test is dead code and the sweep assertion below proves only the
      // easy case. Counted over the whole run, not just the drain: Flurry's
      // splitslash is armed-and-maskless while the attack is playing, which is
      // exactly the window in which sweeping it would be wrong.
      for (const b of bullets(st)) if (!hasMask(b) && armed(b)) armedMasklessSeen += 1;
      // `e.drain` is NOT cleared at the reset — it is zeroed on the next
      // launch — so this window has to be closed by `started` as well, or the
      // 16 frames of gap after the reset are counted as drain.
      if (d.started && d.drain > 0) {
        if (timeUp < 0) timeUp = f;
        const skipped = bullets(st).filter((b) => !holdsDrain(b));
        if (skipped.length) {
          masklessSeenInDrain += 1;
          // The claim is that these cannot hit and cannot be seen. If one ever
          // resolves a mask on the frame it was skipped, the rule is wrong.
          for (const b of skipped) if (hasMask(b)) masklessWithAMask += 1;
        }
        if (real.length === 0) emptyDrainFrames += 1;
      }
      if (prevStarted && !d.started && reset < 0) {
        reset = f;
        // NOTHING LIVE WAS SWEPT. A run ends either because the full drain
        // elapsed (bullets got their time and the sweep is the fight's own) or
        // because nothing was left worth waiting for. This asserts the second
        // branch directly: on the frame a run was taken down EARLY, no bullet
        // on the board was visible or able to hit.
        if (d.drain < DRAIN_CAP) {
          const live = bullets(st).filter(holdsDrain);
          if (live.length) {
            sweptSomethingLive += 1;
            failures.push(`${m.id}: reset at drain ${d.drain} with ${live.length} live `
              + `bullet(s): `
              + live.map((b) => `${b.type.name}[mask=${hasMask(b)} armed=${armed(b)}]`).join(', '));
          }
        }
        // A DRAIN OF ZERO IS INVISIBLE FROM OUTSIDE. `e.drain` is bumped and the
        // reset taken in the same endStep, so by the time this loop reads the
        // director `started` is already false and the drain frame was never
        // sampled. The clock ran out on the frame the run ended: that is a
        // drain of 0, not a missing measurement.
        if (timeUp < 0) timeUp = f;
      }
    }
    prevStarted = d.started;
  }

  if (launch1 < 0 || launch2 < 0 || timeUp < 0 || reset < 0) {
    failures.push(`${m.id}: the drill did not complete two runs `
      + `(launch1=${launch1} launch2=${launch2} timeUp=${timeUp} reset=${reset})`);
    continue;
  }
  runsCompleted += 1;

  const turn = timeUp - launch1;
  const drain = reset - timeUp;
  const cycle = launch2 - launch1;

  // --- THE CUT HAPPENED ------------------------------------------------
  if (cycle >= BEFORE_CYCLE[m.id] - 25) {
    failures.push(`${m.id}: cycle is ${cycle} frames against ${BEFORE_CYCLE[m.id]} before — `
      + 'at least 25 frames of dead gap should be gone');
  }
  if (cycle > want.cycle) {
    failures.push(`${m.id}: cycle ${cycle} is longer than the recorded ${want.cycle}`);
  }
  if (launch1 > 20) {
    failures.push(`${m.id}: the first attack does not land until frame ${launch1}; `
      + 'the drill should open almost immediately');
  }

  // --- AND IT CUT THE WAIT, NOT THE CONTENT ----------------------------
  if (turn < want.turn) {
    failures.push(`${m.id}: the turn clock ran only ${turn} frames against ${want.turn} — `
      + 'the attack itself has been shortened, which is the thing not to do');
  }
  if (bulletFrames < Math.floor(want.bulletFrames * 0.9)) {
    failures.push(`${m.id}: only ${bulletFrames} frames of the run had a live bullet `
      + `against ${want.bulletFrames} recorded — bullets are being swept early`);
  }
  // --- THE BOARD BEAT AND THE SOUL'S FLIGHT ARE UNTOUCHED ---------------
  if (arenaOpen < 0) {
    failures.push(`${m.id}: the arena never opened — GAP has been cut below RTIMER_SPAWN, `
      + 'so the board beat is skipped entirely');
  } else {
    arenaBeatsChecked += 1;
    if (launch1 - arenaOpen !== RTIMER_BEAT) {
      failures.push(`${m.id}: the board opened ${launch1 - arenaOpen} frames before the attack, `
        + `not ${RTIMER_BEAT} — the rtimer beat of the real fight is load-bearing`);
    }
  }
  if (soulBorn < 0) {
    failures.push(`${m.id}: no soul was ever delivered`);
  } else {
    soulFlightsChecked += 1;
    if (arenaOpen >= 0 && soulBorn - arenaOpen !== SOUL_FLIGHT) {
      failures.push(`${m.id}: the soul arrived ${soulBorn - arenaOpen} frames after the board `
        + `opened, not ${SOUL_FLIGHT} — obj_moveheart's alarm has moved`);
    }
    if (soulBorn >= launch1) {
      failures.push(`${m.id}: the soul arrived at frame ${soulBorn}, on or after the attack `
        + `at ${launch1} — the drill would start with nothing to dodge with`);
    }
  }

  // --- THE DRAIN, BOTH WAYS --------------------------------------------
  if (MANAGER_HELD.includes(m.id)) {
    if (drain !== 0) {
      failures.push(`${m.id}: the drain still ran ${drain} frames — nothing but a maskless `
        + 'spawn manager is alive there, so it should end on the clock');
    }
  }
  if (CONTENT_HELD.includes(m.id)) {
    if (drain !== FULL_DRAIN) {
      failures.push(`${m.id}: the drain ran ${drain} frames instead of the full ${FULL_DRAIN} — `
        + 'this attack has real bullets on the board to the last frame of it');
    }
    if (emptyDrainFrames > 0) {
      failures.push(`${m.id}: ${emptyDrainFrames} frames of its drain had NO live bullet — `
        + 'it no longer belongs in CONTENT_HELD; re-measure before relaxing this');
    }
  }
}

// --- ENDING THE DRAIN EARLY CUTS NOTHING -------------------------------
//
// THE ONE WAY THIS CHANGE COULD STILL BE WRONG. The four attacks above now
// reset the frame their clock runs out, on the strength of "only a maskless
// manager is alive". A manager is a SPAWNER — if one of them were still due to
// put a sword on the board, the drill would be sweeping an attack mid-flight
// and the shorter cycle would be a cut, not a saving.
//
// So this holds the drain open to its old full length and watches. The holder
// is a masked, collidable bullet parked 9000px off the board: `bulletsLeft`
// sees it, the drain runs all 90 frames exactly as it used to, and nothing
// else in the scene can reach it. Any real bullet that appears in that window
// is one the early reset would have thrown away.
const holder = {
  name: 'tempo_probe_holder',
  create(e) {
    e.isBullet = true;
    e.sprite_index = 'spr_smallbullet';
  },
};
let probesRun = 0;
for (const id of MANAGER_HELD) {
  const m = ATTACK_MENU.find((a) => a.id === id);
  const st = createState({ seed: 12345, traceBulletSlots: 0 });
  st.keepAlive = true;
  buildSingleAttackScene(st, { seed: 12345, attack: id, difficulty: m.difficulties[0] });
  const d = dirOf(st);
  const pin = spawn(st, holder, { x: -9000, y: -9000 });
  if ((pin.mask ?? SPRITE_MASKS[pin.sprite_index] ?? null) === null) {
    failures.push('the drain probe holder has no mask, so it cannot hold the drain open');
    break;
  }

  const before = new Set();
  let drainFrames = 0;
  let appeared = 0;
  let sawDrain = false;
  for (let f = 0; f < 4000; f++) {
    stepFrame(st, IDLE);
    if (!d.started) { if (sawDrain) break; continue; }
    if (d.drain > 0) {
      sawDrain = true;
      drainFrames += 1;
      for (const b of realBullets(st)) if (b !== pin && !before.has(b)) appeared += 1;
    }
    for (const b of realBullets(st)) before.add(b);
  }
  probesRun += 1;
  if (drainFrames < 89) {
    failures.push(`${id}: the drain probe only held the drain for ${drainFrames} frames — `
      + 'it did not reproduce the old full-length drain, so it proves nothing');
  }
  if (appeared !== 0) {
    failures.push(`${id}: ${appeared} real bullets appeared during a full-length drain — `
      + 'the manager is still spawning, so ending the drain on the clock cuts content');
  }
}
if (probesRun !== MANAGER_HELD.length) {
  failures.push(`the full-length drain probe ran on ${probesRun} of ${MANAGER_HELD.length} attacks`);
}

// --- AN ARMED BULLET HOLDS THE DRAIN EVEN WITH NO MASK -----------------
//
// THE HOLE THIS CLOSES, and it is not hypothetical. The drill's exclusion began
// life as a mask lookup alone — "no mask, so it cannot be seen and cannot be
// hit". The second half does not follow. The collision loop's DEFAULT test is
// `spriteMaskHit`, which a maskless bullet fails, but a type may OVERRIDE it,
// and `obj_roaringknight_splitslash` (ac 2, Flurry) carries `scr_precise_hit`
// and an Other_15 while running with no mask resolved — measured at 480 frames
// of a two-run cycle. A mask-only test would drop it from `bulletsLeft` and let
// the drill sweep a bullet that was still live and still damaging.
//
// It never showed in the numbers, because Flurry's teeth ARE masked and keep
// its drain full regardless — so the wrong test and the right one produce
// identical tempo on every attack in the roster today. That is precisely the
// shape of bug this project's CLAUDE.md warns about: green suites over a change
// that did nothing, or over a rule that is wrong in a case nothing reaches yet.
//
// So it is put in reach deliberately. A maskless, ARMED bullet is parked into
// each of the four attacks whose drain now ends on the clock. If the drill's
// test is right, that bullet holds the drain for its full length. If the test
// is a mask lookup, the run is swept at drain 0 with it still alive.
const armedNoMask = {
  name: 'tempo_probe_armed',
  create(e) {
    e.isBullet = true;
    // No sprite_index and no mask: every mask lookup in the engine resolves
    // null for this, exactly like the spawn managers.
    e.damage = 1;
  },
  // ...but it can hit, the way splitslash can: its own collision test.
  collides: () => false,
  other15: () => {},
};
let armedProbesRun = 0;
for (const id of MANAGER_HELD) {
  const m = ATTACK_MENU.find((a) => a.id === id);
  const st = createState({ seed: 12345, traceBulletSlots: 0 });
  st.keepAlive = true;
  buildSingleAttackScene(st, { seed: 12345, attack: id, difficulty: m.difficulties[0] });
  const d = dirOf(st);
  const pin = spawn(st, armedNoMask, { x: -9000, y: -9000 });
  if (hasMask(pin)) {
    failures.push('the armed probe resolved a mask, so it tests the wrong thing');
    break;
  }
  if (!armed(pin)) {
    failures.push('the armed probe is not armed, so it cannot hold the drain');
    break;
  }

  let drainFrames = 0;
  let sawDrain = false;
  for (let f = 0; f < 4000; f++) {
    stepFrame(st, IDLE);
    if (!d.started) { if (sawDrain) break; continue; }
    if (d.drain > 0) { sawDrain = true; drainFrames += 1; }
  }
  armedProbesRun += 1;
  if (drainFrames < FULL_DRAIN) {
    failures.push(`${id}: a maskless but ARMED bullet held the drain only ${drainFrames} `
      + `frames of ${FULL_DRAIN} — the drill is testing for a mask instead of for whether `
      + 'the thing can still hit, so a live splitslash would be swept mid-attack');
  }
}
if (armedProbesRun !== MANAGER_HELD.length) {
  failures.push(`the armed-bullet probe ran on ${armedProbesRun} of ${MANAGER_HELD.length}`);
}

// --- ...AND `mask_index = spr_nomask` STILL DOES NOT ------------------
//
// THE OTHER DIRECTION, so the rule above cannot be over-corrected into "any
// bullet with an Other_15 holds the drain forever". `maskOff` is GameMaker's
// `mask_index = spr_nomask`, and sim/index.js's collision loop `continue`s on
// it before it ever consults `collides` — so such a bullet cannot hit no matter
// what it carries, and must NOT hold the drill open. Without this, the four
// attacks above would silently go back to their full 90-frame drain the moment
// any parked manager happened to own an Other_15.
const disarmedNoMask = {
  name: 'tempo_probe_disarmed',
  create(e) {
    e.isBullet = true;
    e.maskOff = true; // spr_nomask — the collision loop skips it outright
    e.damage = 1;
  },
  collides: () => false,
  other15: () => {},
};
let disarmedProbesRun = 0;
for (const id of MANAGER_HELD) {
  const m = ATTACK_MENU.find((a) => a.id === id);
  const st = createState({ seed: 12345, traceBulletSlots: 0 });
  st.keepAlive = true;
  buildSingleAttackScene(st, { seed: 12345, attack: id, difficulty: m.difficulties[0] });
  const d = dirOf(st);
  const pin = spawn(st, disarmedNoMask, { x: -9000, y: -9000 });
  if (hasMask(pin) || armed(pin)) {
    failures.push('the disarmed probe is not disarmed, so it tests nothing');
    break;
  }

  let drainFrames = 0;
  let sawRun = false;
  for (let f = 0; f < 4000; f++) {
    stepFrame(st, IDLE);
    if (d.started) { sawRun = true; if (d.drain > 0) drainFrames += 1; }
    else if (sawRun) break;
  }
  disarmedProbesRun += 1;
  if (drainFrames !== 0) {
    failures.push(`${id}: a spr_nomask bullet held the drain ${drainFrames} frames — `
      + 'it cannot hit anything, so it must not keep the drill waiting');
  }
}
if (disarmedProbesRun !== MANAGER_HELD.length) {
  failures.push(`the spr_nomask probe ran on ${disarmedProbesRun} of ${MANAGER_HELD.length}`);
}

// --- THE MECHANISMS ACTUALLY RAN ---------------------------------------
if (runsCompleted !== ATTACK_MENU.length) {
  failures.push(`only ${runsCompleted} of ${ATTACK_MENU.length} attacks completed two runs`);
}
if (masklessSeenInDrain === 0) {
  failures.push('no maskless bullet was ever skipped during a drain — the exclusion that '
    + 'shortens ac 11/13/14/17 never ran, so every bound above passed vacuously');
}
if (armedMasklessSeen === 0) {
  failures.push('no maskless-but-armed bullet was ever seen — obj_roaringknight_splitslash '
    + 'should provide one during Flurry. The `armed` half of the drain test is not being '
    + 'exercised, so "nothing live was swept" is proved only for the easy case');
}
if (sweptSomethingLive !== 0) {
  failures.push(`${sweptSomethingLive} runs were reset early with a live bullet on the board`);
}
if (masklessWithAMask !== 0) {
  failures.push(`${masklessWithAMask} entities were skipped as maskless and had a mask — `
    + 'the test is not the one the collision phase uses');
}
if (arenaBeatsChecked !== ATTACK_MENU.length || soulFlightsChecked !== ATTACK_MENU.length) {
  failures.push(`board beat checked on ${arenaBeatsChecked} attacks and the soul flight on `
    + `${soulFlightsChecked}, of ${ATTACK_MENU.length}`);
}

if (failures.length) {
  console.log('');
  for (const f of failures) console.log(`→ FAILURE  ${f}`);
  process.exit(1);
}
console.log(`PASS  single-attack tempo — ${ATTACK_MENU.length} attacks, every cycle shorter, `
  + `the turn clock, the ${RTIMER_BEAT}-frame board beat, the soul's flight and `
  + `${CONTENT_HELD.length} full drains all intact`);
