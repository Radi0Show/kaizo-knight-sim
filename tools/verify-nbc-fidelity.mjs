#!/usr/bin/env node
// NO BULLET COOLDOWNS — THE SITES THAT WERE TRANSLATED AND THEN NOT REACHED.
//
// `tools/verify-nbc.mjs` proves each mechanism fires when it is CALLED, and
// proves the OFF path is a literal no-op. This suite proves the other half,
// which is the half that was wrong: that the running game reaches them.
//
// Every check here was RED before 2026-09-17, and each one had a suite passing
// over it at the time. The shape of the failure is the same every time —
// a function was written, tested through its own front door, and then either
// called with the toggle stripped out of its arguments, overwritten by a
// constant on the launch path, or hung off a handler belonging to a different
// object. So the rule these sections follow is: DRIVE THE SHIPPED SCENE AND
// READ WHAT THE PLAYER WOULD SEE. Nothing in this file calls a translated
// function directly except where the section says why.
//
// CLAUDE.md, "A green suite does not mean a change took effect": green answers
// "did I break something", not "did my change do anything". Every section here
// is the second question, and every one of them has been SABOTAGE-TESTED by
// reverting the fix it guards and watching it go red.

import { createState, stepFrame } from '../sim/index.js';
import { buildPracticeScene } from '../sim/scenes/practice.js';
import { buildSingleAttackScene } from '../sim/scenes/single.js';
import { pointingStarchild } from '../sim/attacks/pointing-starchild.js';
import { roaring2 } from '../sim/attacks/roaring.js';
import { spawn } from '../sim/entity.js';
import { freshParty } from '../sim/damage.js';
import {
  NBC_BATTLE_MSG, NBC_DOWN_MSG, NBC_CATCH_DAMAGE, NBC_POINTING_DAMAGE,
} from '../sim/attacks/nbc.js';
import { BATTLE_MSG } from '../sim/battlemsg.js';

let failed = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}${extra ? `  (${extra})` : ''}`);
  if (!c) failed += 1;
};
const eq = (got, want, m) =>
  ok(Object.is(got, want), m, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = (t) => console.log(`\n${t}`);

const IDLE = {
  left: false, right: false, up: false, down: false,
  confirm: false, cancel: false, focus: false, button3: false,
};
// The party never acts on idle input — the menu is edge-triggered and a halted
// balloon waits on a real press. Pulsing is what verify-fight-order does and it
// is the only way a headless run reaches turn 2.
let pulse = false;
const menuInput = () => { pulse = !pulse; return { ...IDLE, confirm: pulse }; };

/** A fight scene with the toggle in a known state. */
function fight(nbc, seed = 12345) {
  const s = createState({ seed });
  s.noBulletCooldown = nbc;
  buildPracticeScene(s, { seed });
  return s;
}

/** A single-attack drill with the toggle in a known state. */
function drill(nbc, attack, difficulty = 0, seed = 4242) {
  const s = createState({ seed });
  s.noBulletCooldown = nbc;
  buildSingleAttackScene(s, { seed, attack, difficulty });
  return s;
}

// ── A. THE BATTLE MESSAGE OVERLAY REACHES THE FIGHT ───────────────────────
//
// T2/T3/T4. `battleMsgFor` gates all eighteen rewritten strings on `opts.nbc`,
// and sim/scenes/practice.js is its ONLY caller in the running sim. Its opts
// literal did not carry the key, so `opts.nbc` was undefined on every real
// frame and every one of the mod's lines was unreachable outside this repo's
// own verifiers. The strings were typed in, asserted green, and never drawn.
section('A — the mod’s turn messages actually appear');
{
  // PARTY HP IS PINNED, for the reason CLAUDE.md gives for every whole-fight
  // recording carrying `--keep-alive`: an unattended headless party is down
  // inside two turns, a knockdown line REPLACES the flavour line, and the run
  // then reports two distinct messages in twelve thousand frames. Pinning is
  // what lets this reach the turns where the mod's rewrites live. The
  // knockdown lines get their own section below, where being down is the
  // point.
  const collect = (nbc) => {
    const s = fight(nbc);
    const seen = new Set();
    for (let f = 0; f < 12000 && seen.size < 8; f++) {
      if (s.partyHp) { s.partyHp[0] = 190; s.partyHp[1] = 190; s.partyHp[2] = 190; }
      stepFrame(s, menuInput());
      if (s.battlemsg) seen.add(s.battlemsg);
    }
    return seen;
  };
  const on = collect(true);
  const off = collect(false);

  // Phase 1 turn 1 is the cleanest discriminator: the mod rewrites it and the
  // two strings differ by one word, so a partial wiring cannot fake it.
  const modded = NBC_BATTLE_MSG[1][1];
  const vanilla = BATTLE_MSG[1][1];
  ok(modded !== vanilla, 'the two phase-1-turn-1 lines really are different',
    `${JSON.stringify(vanilla)} vs ${JSON.stringify(modded)}`);
  ok(on.has(modded), 'toggle ON shows the mod’s line', JSON.stringify(modded));
  ok(!on.has(vanilla), 'toggle ON does NOT show the vanilla line');
  ok(off.has(vanilla), 'toggle OFF still shows the vanilla line');
  ok(!off.has(modded), 'toggle OFF does NOT show the mod’s line');
}

// ── B. SUSIE'S LATE KNOCKDOWN LINE ────────────────────────────────────────
//
// The mod inserts `if (balloonturn >= 6) susiedown = "* Susie realised she
// should've kept quiet.&"` — its only two-form knockdown message, and the
// payoff for having let the Knight/Susie exchange run six beats. `nbcDownMsg`
// reads `(balloonturn ?? 0) >= 6`, and the call site passed no `balloonturn`,
// so the fallback answered 0 forever. A SECOND, INDEPENDENT break: arming
// `nbc` alone leaves this line just as dead, which is why it gets its own
// section rather than riding on A.
section('B — the balloonturn variant of Susie’s knockdown');
{
  const run = (balloonturn) => {
    const s = fight(true, 7);
    let out = null;
    for (let f = 0; f < 12000 && !out; f++) {
      // ONLY SUSIE GOES DOWN. `downMsg` concatenates when more than one falls
      // on the same beat, so an unattended party produces the pair
      // "* Susie's will was shattered.&* Ralsei became a pile of dust.&" and
      // an equality test on her line alone fails for the wrong reason. Kris
      // and Ralsei are held up, she is held down, and the beat count is set
      // live — all three are ordinary state the scene already maintains.
      if (s.partyHp) { s.partyHp[0] = 190; s.partyHp[1] = 0; s.partyHp[2] = 190; }
      if (s.dialogue) s.dialogue.balloonturn = balloonturn;
      stepFrame(s, menuInput());
      if (s.battlemsg === NBC_DOWN_MSG.susie
        || s.battlemsg === NBC_DOWN_MSG.susieLate) out = s.battlemsg;
    }
    return out;
  };
  ok(NBC_DOWN_MSG.susie !== NBC_DOWN_MSG.susieLate, 'the two forms differ');
  eq(run(0), NBC_DOWN_MSG.susie, 'balloonturn 0 gives the early line');
  eq(run(6), NBC_DOWN_MSG.susieLate, 'balloonturn 6 gives the late line');
}

// ── C. THE STARS WINDOW ───────────────────────────────────────────────────
//
// M9. `endtimer = 120 -> 150`, and the mod leaves the `if (difficulty >= 2)
// { endtimer += 30; global.turntimer += 60; endtimer += 60; }` block below it
// alone, so the pair is 150/240 modded against 120/210 vanilla.
// stars-controller.js carried the base correctly and sim/scenes/fight.js
// overwrote BOTH the controller's and the cone's with a hardcoded vanilla
// constant on the launch frame — so the only toggle-aware endtimer in the repo
// never survived a launch. A HIGHER endtimer stops the spawner EARLIER: the
// mod's Stars turn is denser AND shorter, and the sim ran it dense and long.
section('C — the Stars endtimer survives the launch');
{
  const measure = (nbc, difficulty) => {
    const s = drill(nbc, 'stars', difficulty);
    for (let f = 0; f < 120; f++) {
      stepFrame(s, IDLE);
      const dc = s.entities.find(
        (e) => e.alive && e.type.name === 'obj_dbulletcontroller',
      );
      const cone = s.entities.find(
        (e) => e.alive && e.type.name === 'obj_knight_pointing_cone',
      );
      if (dc && cone) return { dc: dc.endtimer, cone: cone.endtimer };
    }
    return { dc: null, cone: null };
  };
  const off0 = measure(false, 0);
  const off2 = measure(false, 2);
  const on0 = measure(true, 0);
  const on2 = measure(true, 2);
  eq(off0.dc, 120, 'OFF difficulty 0 — the dump’s 120');
  eq(off2.dc, 210, 'OFF difficulty 2 — 120 + 30 + 60');
  eq(on0.dc, 150, 'ON difficulty 0 — the mod’s 150');
  eq(on2.dc, 240, 'ON difficulty 2 — 150 + 30 + 60');
  // `bulletmaker.endtimer = endtimer` is the next line of the same block, so
  // the cone gets the modded number too. It was clobbered by the same
  // constant, which held the fan open past its release.
  eq(on0.cone, 150, 'the CONE is handed the modded number as well');
  eq(off0.cone, 120, 'and the vanilla one with the toggle off');
}

// ── D. THE STARCHILD'S TWO EVENTS ─────────────────────────────────────────
//
// D4 and D7. obj_knight_pointing_starchild's Other_15 branches at the top on
// `i_ex(obj_knight_roaring2)`: the roaring arm fires the Knight's CATCH
// (`with (obj_knight_enemy) event_user(2)`), the else arm is the parent's
// party-wide hit. The sim reused the PARENT's handler, which has no such
// branch — so during the roar, where obj_knight_roaring_star bursts every
// released star into six of these, each shard ran the AOE arm.
//
// THIS SECTION CALLS THE HANDLER DIRECTLY, deliberately: steering a soul into
// a specific shard during the roar is not reproducible enough to assert HP
// numbers on, and the claim under test is WHICH ARM RUNS, not whether a hit
// registers. The `collides` side is covered by verify-contact-coverage.
section('D — a shard hit during ROARING is the catch, not the AOE');
{
  const hit = (nbc, roaring) => {
    const s = drill(nbc, 'stars', 0);
    for (let f = 0; f < 30; f++) stepFrame(s, IDLE);
    s.partyHp = freshParty();
    s.invTimer = -1;
    s.invc = 1;
    if (roaring) spawn(s, roaring2, { x: 320, y: 120 });
    const e = spawn(s, pointingStarchild, { x: 0, y: 0 });
    e.active = 1;
    e.destroyonhit = 0;
    const before = [...s.partyHp];
    pointingStarchild.other15(e, s);
    return before.map((h, i) => h - s.partyHp[i]);
  };

  const roarOn = hit(true, true);
  // The catch is `damage = 15` per member with truedamage, so all three take
  // the same number and it is the mod's, not the AOE's.
  ok(roarOn.every((d) => d === NBC_CATCH_DAMAGE),
    'ON + roaring: every member takes exactly the catch’s 15',
    `got ${JSON.stringify(roarOn)}`);

  const roarOff = hit(false, true);
  ok(roarOff.every((d) => d === 40),
    'OFF + roaring: the vanilla catch’s 40', `got ${JSON.stringify(roarOff)}`);

  // Outside the roar the else arm is the parent's event and D4's buff applies
  // — through the defence walk, so the three numbers differ from each other
  // and every one of them is larger than the catch.
  const plain = hit(true, false);
  ok(plain.every((d) => d > NBC_CATCH_DAMAGE),
    'ON, no roaring: the AOE arm still runs and hits harder',
    `got ${JSON.stringify(plain)}`);
  eq(NBC_POINTING_DAMAGE, 100, 'and it is D4’s 100 that feeds it');
}

// ── E. THE KNIGHTLINES SLASH IS AXIS-ALIGNED ──────────────────────────────
//
// obj_knight_tunnel_slasher's spawn block sets `image_angle` on the BULLET
// only, inside the inner `with (scr_fire_bullet(...))`. The slash itself never
// gets one and keeps GML's default 0. The sim added `slash.image_angle =
// slash.direction`, and CLAUDE.md's contact study is explicit that an
// axis-aligned mask at image_yscale 0.1 cannot connect while a rotated one
// connects at any diagonal — so the extra line turned a wedge that deals no
// contact damage into a live party-wide hitbox. Unconditional, so it was wrong
// on both toggle paths.
section('E — knightlines’ slashes carry no image_angle');
{
  for (const nbc of [false, true]) {
    const s = drill(nbc, 'knightlines', 0, 7);
    const seenSet = new WeakSet();
    let seen = 0;
    let rotated = 0;
    for (let f = 0; f < 400; f++) {
      stepFrame(s, IDLE);
      for (const e of s.entities) {
        if (!e.alive || e.type.name !== 'obj_roaringknight_slash') continue;
        if (seenSet.has(e)) continue;
        seenSet.add(e);
        seen += 1;
        if (e.image_angle !== 0) rotated += 1;
      }
    }
    ok(seen > 0, `toggle ${nbc ? 'ON ' : 'OFF'}: the drill spawns slashes at all`, `${seen}`);
    eq(rotated, 0, `toggle ${nbc ? 'ON ' : 'OFF'}: none of them is rotated`);
  }
}

// ── F. ac 15 CARRIES ITS DAMAGE OVERRIDE ──────────────────────────────────
//
// The vanilla dump's ac-15 branch is TWO scr_bulletspawner calls and both end
// `dc.damage = 206`. The sim left both on the controller's inherited
// `monsterat * 5` = 200, alone among the five tracking dispatches. The mod's
// own path overwrites to 103 on both lanes, so only the VANILLA branch had
// drifted — 6 HP a sword, on a turn that lands dozens. verify-nbc.mjs could
// not see it because it hardcoded 206 as "what fight.js assigns, at every one
// of the five sites", which this site made false.
section('F — ac 15’s two spawners both carry 206 with the toggle off');
{
  const s = drill(false, 'vortex', 0);
  const found = { vortex: null, tracking: null };
  for (let f = 0; f < 200 && (found.vortex === null || found.tracking === null); f++) {
    stepFrame(s, IDLE);
    for (const e of s.entities) {
      if (!e.alive) continue;
      if (e.type.name === 'obj_sword_vortex_manager' && found.vortex === null) {
        found.vortex = e.damage;
      }
      if (e.type.name === 'obj_tracking_swords_manager' && found.tracking === null) {
        found.tracking = e.damage;
      }
    }
  }
  eq(found.vortex, 206, 'the sword vortex manager (dump line 500)');
  eq(found.tracking, 206, 'the chained tracking manager (dump line 505)');
}

// ── G. THE ROTATING SLASH'S THIRTY ARE BORN AT THE KNIGHT ─────────────────
//
// M10. `instance_create(creatorid.x, creatorid.y, obj_knight_rotating_slash)`,
// where `creatorid` is obj_knight_enemy — the body of the arm is byte-
// identical in both dumps and only the gate above it changed, so every top-up
// is born at his post. The sim spawned each extra at the LEAD MANAGER's
// current position, which lerps across the arena all turn.
section('G — every NBC rotating-slash top-up is born at obj_knight_enemy');
{
  const s = drill(true, 'rotating', 2);
  const seen = new WeakSet();
  let extras = 0;
  let offPost = 0;
  let worst = 0;
  let pop = 0;
  // THE REFERENCE IS THE PREVIOUS FRAME'S KNIGHT, AND THAT IS NOT A FUDGE.
  // The top-up runs in the END STEP — the controller's slot, after every
  // manager's Step (see rotating-slash.js) — and the knight's bob settles in
  // the DRAW phase that follows it, because the manager's Step pins
  // `siner2 = 0` and his Draw ticks it back to 1. So the y the spawn reads is
  // the one still standing from the frame before, and a post-frame snapshot
  // taken here holds the post-Draw value. Comparing against this frame's
  // snapshot makes the very first extra look 12.15px out while every other
  // one matches, which is the measurement being off by a phase and not the
  // spawn being off by a pixel. Against the previous frame it is 0.0000 for
  // all twenty-nine.
  let prevKnight = null;
  for (let f = 0; f < 200; f++) {
    stepFrame(s, IDLE);
    const knight = s.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy');
    let live = 0;
    for (const e of s.entities) {
      if (!e.alive || e.type.name !== 'obj_knight_rotating_slash') continue;
      live += 1;
      if (seen.has(e)) continue;
      seen.add(e);
      if (e.nbcController) continue;     // the dispatch's own, placed by fight.js
      extras += 1;
      const ref = prevKnight ?? knight;
      const d = Math.hypot(e.x - ref.x, e.y - ref.y);
      if (d > 0) { offPost += 1; worst = Math.max(worst, d); }
    }
    pop = Math.max(pop, live);
    prevKnight = { x: knight.x, y: knight.y };
  }
  ok(extras >= 25, 'the toggle really does top the population up', `${extras} extras`);
  eq(pop, 30, 'and it stops at thirty, which is the gate’s number');
  eq(offPost, 0, 'none of them is born away from the knight');
  if (offPost) console.log(`        worst offset: ${worst.toFixed(2)}px`);

  // The OFF path must still make exactly one, through the same code.
  const v = drill(false, 'rotating', 2);
  let vmax = 0;
  for (let f = 0; f < 200; f++) {
    stepFrame(v, IDLE);
    vmax = Math.max(vmax, v.entities.filter(
      (e) => e.alive && e.type.name === 'obj_knight_rotating_slash',
    ).length);
  }
  eq(vmax, 1, 'toggle OFF still spawns exactly one manager');
}

// ── H. THE ROTATING SLASH GLIDES HOME ─────────────────────────
//
// Both of obj_knight_rotating_slash's return branches end with
//
//     scr_lerpvar("x", x, anchor_x, 12, 1, "out");
//     scr_lerpvar("y", y, anchor_y, 12, 1, "out");
//
// (immediately on the `final_counter == 28` spiral, behind
// `scr_script_delayed(..., 8, ...)` on the other), and the spiral's is preceded
// by `with (obj_lerpvar) { if (target == other.id) instance_destroy(); }` —
// without which the teleport tween still in flight fights the return over the
// same `x`. The sim translated only `state = "return"` and `alarm[3] = 22`, so
// the manager coasted on whatever teleport was running and was destroyed where
// it stopped: measured 43.94px / 30.73px / 89.50px from the knight at
// difficulty 0 / 1 / 2. Under the toggle that is thirty silhouettes blinking
// out mid-arena at once.
//
// VANILLA-PATH, so this runs with the toggle OFF — and it is invisible to
// every trace in the repo, because the whole-fight columns and
// traces/t7-rotating.csv both carry the attack's STATE and not the instance's
// position. That is exactly why it gets an assertion here.
section('H — the rotating slash ends at the knight’s post, not where it stopped');
{
  for (const difficulty of [0, 1, 2]) {
    const s = drill(false, 'rotating', difficulty);
    let last = null;
    let post = null;
    for (let f = 0; f < 900; f++) {
      stepFrame(s, IDLE);
      const m = s.entities.find(
        (e) => e.alive && e.type.name === 'obj_knight_rotating_slash',
      );
      const k = s.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy');
      if (m && m.state === 'return') { last = { x: m.x, y: m.y }; post = { x: k.x, y: k.y }; }
      else if (!m && last) break;
    }
    ok(last !== null, `difficulty ${difficulty}: the attack reaches its return state`);
    if (!last) continue;
    const d = Math.hypot(last.x - post.x, last.y - post.y);
    ok(d < 0.001, `difficulty ${difficulty}: it ends on the knight`,
      `${d.toFixed(2)}px away`);
  }
}

console.log(failed
  ? `\nFAIL  ${failed} check(s) failed`
  : '\nPASS  eight NBC sites, driven through the shipped scenes');
process.exit(failed ? 1 : 0);
