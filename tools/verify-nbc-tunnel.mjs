#!/usr/bin/env node
// THE SWORD TUNNEL UNDER NO BULLET COOLDOWNS — and the measurement that said
// it was going backwards.
//
// ─── THE REPORT ────────────────────────────────────────────────────────────
//
// A per-attack drill (seed 9, 1800 frames, counting distinct bullets spawned)
// produced this table, and it was the one red row in it:
//
//     stars x3.9   tracking11 x10.8   roaring x3.4   flurry x1.3
//     tunnel  OFF: peak 28, 640 spawned
//     tunnel  ON : peak 97, 501 spawned      <- MORE at once, FEWER in total
//
// "Peak up 3.5x and the total DOWN" reads as a teardown that counts spawns,
// and `obj_sword_tunnel_manager` has one — `if (swordcount >= maxswords)
// instance_destroy()`. So the tunnel was the lane with a bug in it.
//
// ─── WHAT THE NUMBERS ACTUALLY WERE ────────────────────────────────────────
//
// The attack does not end early. Measured per RUN of the drill rather than per
// 1800-frame window, across seeds 9/4242/12345 and difficulties 0/3/4:
//
//     difficulty 0   OFF  98 swords, peak 18, spawns from launch+36 to +228
//                    ON  458 swords, peak 70, spawns from launch+1  to +229
//     difficulty 3   OFF 108 swords, peak 23, spawns from launch+36 to +248
//                    ON  498 swords, peak 92, spawns from launch+1  to +249
//
// The spawn window CLOSES ON THE SAME FRAME either way, because it closes on
// `finishtimer == finishtimermax` (230, or 250 at difficulty 3) — a frame
// count the mod does not touch. What the mod moves is the OPENING (`timer`
// starts at `-40 + irandom(10)` and `rate = -999` makes the very first frame
// eligible) and the spacing (every frame instead of every fifth). x4.7 swords
// and x3.9 on screen, with the attack exactly as long as it ever was.
//
// `swordcount` peaks at THREE in every run measured, against `maxswords` 999 —
// it is reset to 0 at every set boundary and cannot climb. The suspected
// teardown is real GML (it is the last statement of the vanilla Step) and it
// is inert by a factor of 333, on and off.
//
// ─── SO WHERE DID x0.8 COME FROM? THE HARNESS. ─────────────────────────────
//
// The drill counted over a FIXED 1800-frame window, and the party was mortal.
// Under NBC the tunnel puts 70 swords on the board and the idle party is wiped
// at frame 218 — inside the first run. `practice_director`'s endStep latches
// `state.gameOver` and returns forever after, so the drill never launches run
// 2. OFF the party survives and the window fits SIX runs.
//
//     OFF  6 runs x ~98 =  576 swords     ON  1 run x 458 = 458 swords
//
// 458 < 576, and the ratio reads x0.8. Every other row in that table was an
// attack whose density the party could survive, which is why only this one
// looked broken — the metric silently changed from "how dense is the attack"
// to "how long does the party last", and the tunnel is dense enough to flip it.
//
// `state.keepAlive` is the engine's own "drive the drill without the party
// mattering" path (sim/index.js refills, revives and clears gameOver every
// frame); tools/verify-single-tempo.mjs and tools/verify-graze.mjs both set it
// for exactly this reason. With it set the same 1800-frame window measures
// 576 -> 2878 swords, x5.0.
//
// This suite pins BOTH halves, because the artefact is the more useful half:
// the per-run density (which is what the player feels) AND the fixed-window
// undercount (so that nobody re-derives x0.8 and goes looking for the bug
// again).
//
// ─── AND THE MOD REALLY DOES ONLY INSERT ONE LINE ──────────────────────────
//
// Every event of every `obj_sword_tunnel*` / `obj_knight_tunnel*` /
// `obj_bullet_knight_tunnelslash*` object was diffed mechanically, vanilla dump
// against mod dump — 27 code entries, no name filter, all events and not just
// Step_0. Three differ:
//
//   obj_knight_tunnel_slasher_2_revised_Alarm_2   asset indices 367/672/633/
//                                                 1175 -> 366/670/631/1174.
//                                                 Renumbering; not gameplay.
//   obj_knight_tunnel_slasher_Step_0              + behavior = "slash";
//                                                 site M6, sim/attacks/knightlines.js
//   obj_sword_tunnel_manager_Step_0               + rate = -999;
//                                                 site M5, this attack
//
// The tracking manager needed a SECOND hunk (its `setdirection` pool 50 ->
// 3000) before its gate change did anything, so the same was looked for here.
// There is no companion hunk. One inserted line is the whole change, and the
// translation carries it in the same place the mod put it: after the finale's
// `con = 1` block, before `if (timer >= rate && con == 0)`.

import { readFileSync } from 'node:fs';
import { createState, stepFrame } from '../sim/index.js';
import { buildSingleAttackScene } from '../sim/scenes/single.js';
import { NBC_SWORD_TUNNEL_RATE } from '../sim/attacks/nbc.js';

let failed = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}${extra ? `  (${extra})` : ''}`);
  if (!c) failed += 1;
};
const eq = (got, want, m) =>
  ok(Object.is(got, want), m, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const IDLE = {
  up: false, down: false, left: false, right: false,
  confirm: false, cancel: false, focus: false, menu: false,
};

const SWORD = 'obj_sword_tunnel_sword';
const MANAGER = 'obj_sword_tunnel_manager';

const dirOf = (st) => st.entities.find((x) => x.type && x.type.name === 'practice_director');
const swordsIn = (st) => st.entities.filter((x) => x.alive && x.type.name === SWORD);

/**
 * ONE RUN of the drill, with the party held up so the measurement is about the
 * attack and not about how long three idle people survive it.
 *
 * `nbc === undefined` NEVER SETS THE FLAG AT ALL — that is the baseline the
 * OFF path has to match exactly, not merely resemble. Same rule verify-nbc
 * uses: an OFF branch that computes the same answer down a different path
 * would still shift the shared RNG stream.
 */
function oneRun(seed, difficulty, nbc) {
  const st = createState({ seed, traceBulletSlots: 0 });
  st.keepAlive = true;
  if (nbc !== undefined) st.noBulletCooldown = nbc;
  buildSingleAttackScene(st, { seed, attack: 'tunnel', difficulty });
  const d = dirOf(st);

  let launch = -1;
  let first = -1;
  let last = -1;
  let spawned = 0;
  let peak = 0;
  let maxSwordcount = 0;
  let maxswords = null;
  let rateSeen = null;
  const fingerprint = [];
  const seen = new Set();

  for (let f = 0; f < 1200; f++) {
    stepFrame(st, IDLE);
    if (launch < 0 && d.started) launch = f;

    const mgr = st.entities.find((x) => x.alive && x.type.name === MANAGER);
    if (mgr) {
      if (mgr.swordcount > maxSwordcount) maxSwordcount = mgr.swordcount;
      maxswords = mgr.maxswords;
      rateSeen = mgr.rate;
    }

    const live = swordsIn(st);
    if (live.length > peak) peak = live.length;
    for (const s of live) {
      if (seen.has(s)) continue;
      seen.add(s);
      spawned += 1;
      if (first < 0) first = f;
      last = f;
      // FRAME AND PLACE, full precision. A no-op that spawns the same COUNT
      // of swords a pixel to the left is still a broken no-op.
      fingerprint.push(`${f - launch}:${s.x}:${s.y}:${s.image_angle}`);
    }
    if (launch >= 0 && f > launch && !d.started) break;
  }

  return {
    launch,
    open: first - launch,
    close: last - launch,
    spawned,
    peak,
    maxSwordcount,
    maxswords,
    rateSeen,
    fingerprint: fingerprint.join('|'),
  };
}

/** The whole fixed window, with the party MORTAL — the harness that misread. */
function fixedWindow(seed, difficulty, nbc, frames = 1800) {
  const st = createState({ seed, traceBulletSlots: 0 });
  // DELIBERATELY NO keepAlive. This reproduces the artefact.
  if (nbc !== undefined) st.noBulletCooldown = nbc;
  buildSingleAttackScene(st, { seed, attack: 'tunnel', difficulty });
  const d = dirOf(st);

  let runs = 0;
  let prev = false;
  let spawned = 0;
  let gameOverAt = -1;
  const seen = new Set();

  for (let f = 0; f < frames; f++) {
    stepFrame(st, IDLE);
    if (gameOverAt < 0 && st.gameOver) gameOverAt = f;
    if (!prev && d.started) runs += 1;
    for (const s of swordsIn(st)) if (!seen.has(s)) { seen.add(s); spawned += 1; }
    prev = d.started;
  }
  return { runs, spawned, gameOverAt };
}

// ---------------------------------------------------------------------------
console.log('\nverify-nbc-tunnel — the sword tunnel under NO BULLET COOLDOWNS\n');

// --- 1. THE CONSTANT, AND THE SITE ----------------------------------------
console.log('the site');
eq(NBC_SWORD_TUNNEL_RATE, -999, 'the mod inserts `rate = -999`');

const src = readFileSync(new URL('../sim/attacks/sword-tunnel.js', import.meta.url), 'utf8');
const callSites = src.match(/nbcOn\(/g) ?? [];
eq(callSites.length, 1,
  'sword-tunnel.js has exactly ONE nbc call site — the mod inserts one line');
ok(/if \(nbcOn\(state\)\) e\.rate = NBC_SWORD_TUNNEL_RATE;/.test(src),
  'and it is the assignment the mod wrote, not a widened comparison');
// PLACEMENT, because `rate` is read by two gates below it and the second one
// resets `timer`. The GML puts the insert after the finale block and before
// the spawn gate; anywhere else is a different mod.
const iFinale = src.indexOf('if (e.finishtimer === e.finishtimermax)');
const iSite = src.indexOf('if (nbcOn(state)) e.rate = NBC_SWORD_TUNNEL_RATE;');
const iGate = src.indexOf('if (e.timer >= e.rate && e.con === 0)');
ok(iFinale > 0 && iSite > iFinale && iGate > iSite,
  'the insert sits between the finale check and the spawn gate, as in the dump');
// The teardown the investigation suspected is REAL GML and must stay.
ok(/if \(e\.swordcount >= e\.maxswords\) destroy\(e\);/.test(src),
  'the `swordcount >= maxswords` teardown is still there — it is the dump’s '
  + 'own last statement, not ours to remove');

// --- 2. OFF IS A LITERAL NO-OP --------------------------------------------
console.log('\nOFF is the path that was there before');
for (const seed of [9, 4242, 12345]) {
  for (const difficulty of [0, 3, 4]) {
    const off = oneRun(seed, difficulty, false);
    const unset = oneRun(seed, difficulty, undefined);
    ok(off.fingerprint === unset.fingerprint && off.fingerprint.length > 0,
      `seed ${seed} difficulty ${difficulty}: every sword spawns on the same frame `
      + 'at the same place with the flag off as with the flag never set',
      `${off.spawned} swords`);
    eq(off.rateSeen, difficulty === 0 || difficulty === 3 || difficulty === 4 ? 4 : 6,
      `seed ${seed} difficulty ${difficulty}: rate is untouched with the flag off`);
  }
}

// --- 3. ON IS DENSER, AND NOT SHORTER -------------------------------------
console.log('\nON — denser, and exactly as long');
let ranDensity = 0;
for (const seed of [9, 4242, 12345]) {
  for (const difficulty of [0, 3, 4]) {
    const off = oneRun(seed, difficulty, false);
    const on = oneRun(seed, difficulty, true);
    const tag = `seed ${seed} difficulty ${difficulty}`;
    ranDensity += 1;

    // THE CLAIM THE REPORT DENIED. The window closes on `finishtimer ==
    // finishtimermax`, a frame count, so it must close within a frame of OFF.
    ok(Math.abs(on.close - off.close) <= 2,
      `${tag}: the spawn window closes on the same frame`,
      `off +${off.close}, on +${on.close}`);
    ok(on.open < off.open,
      `${tag}: and it OPENS earlier — timer starts negative and -999 clears it`,
      `off +${off.open}, on +${on.open}`);

    // DENSITY. Floors, not equalities: a later lane may legitimately make the
    // mod denser still, but it may never make it thinner.
    ok(on.spawned >= off.spawned * 4,
      `${tag}: at least 4x the swords in a run`,
      `${off.spawned} -> ${on.spawned} (x${(on.spawned / off.spawned).toFixed(2)})`);
    ok(on.peak >= off.peak * 3.5,
      `${tag}: at least 3.5x on screen at once`,
      `${off.peak} -> ${on.peak} (x${(on.peak / off.peak).toFixed(2)})`);

    // THE SUSPECT, EXONERATED WITH A NUMBER. `swordcount` is zeroed at every
    // set boundary; it cannot approach 999 on any path, on or off.
    eq(off.maxswords, 999, `${tag}: maxswords is 999 with the flag off`);
    eq(on.maxswords, 999, `${tag}: maxswords is 999 with the flag on`);
    ok(off.maxSwordcount < 10 && on.maxSwordcount < 10,
      `${tag}: swordcount never climbs — the teardown cannot fire`,
      `off peak ${off.maxSwordcount}, on peak ${on.maxSwordcount}`);
  }
}
ok(ranDensity === 9, 'nine seed/difficulty cells were measured', `${ranDensity}`);

// --- 4. THE ARTEFACT, PINNED ----------------------------------------------
//
// If this section ever goes green by the numbers agreeing, the drill has been
// made immortal and the trap is gone; that is a change worth noticing, not a
// silent pass. So it asserts the artefact EXISTS.
console.log('\nthe harness artefact — a mortal party undercounts the dense attack');
const mortalOff = fixedWindow(9, 0, false);
const mortalOn = fixedWindow(9, 0, true);
ok(mortalOff.gameOverAt < 0,
  'OFF the idle party survives the whole 1800-frame window',
  `gameOver at ${mortalOff.gameOverAt}`);
ok(mortalOn.gameOverAt > 0 && mortalOn.gameOverAt < 400,
  'ON it is wiped inside the FIRST run',
  `gameOver at frame ${mortalOn.gameOverAt}`);
ok(mortalOn.runs < mortalOff.runs,
  'so the drill launches fewer runs under the mod, not more',
  `off ${mortalOff.runs} runs, on ${mortalOn.runs}`);
ok(mortalOn.spawned < mortalOff.spawned,
  'and a FIXED-WINDOW spawn total therefore reads LOWER — this is the x0.8, '
  + 'and it is a fact about the party, not about the attack',
  `off ${mortalOff.spawned}, on ${mortalOn.spawned}`);

const keptOff = fixedWindow(9, 0, false);
const liveOff = (() => {
  // The same window WITH keepAlive, which is what the number should have been.
  const st = createState({ seed: 9, traceBulletSlots: 0 });
  st.keepAlive = true;
  buildSingleAttackScene(st, { seed: 9, attack: 'tunnel', difficulty: 0 });
  let n = 0; const seen = new Set();
  for (let f = 0; f < 1800; f++) {
    stepFrame(st, IDLE);
    for (const s of swordsIn(st)) if (!seen.has(s)) { seen.add(s); n += 1; }
  }
  return n;
})();
const liveOn = (() => {
  const st = createState({ seed: 9, traceBulletSlots: 0 });
  st.keepAlive = true;
  st.noBulletCooldown = true;
  buildSingleAttackScene(st, { seed: 9, attack: 'tunnel', difficulty: 0 });
  let n = 0; const seen = new Set();
  for (let f = 0; f < 1800; f++) {
    stepFrame(st, IDLE);
    for (const s of swordsIn(st)) if (!seen.has(s)) { seen.add(s); n += 1; }
  }
  return n;
})();
ok(liveOn >= liveOff * 4,
  'with keepAlive the same window measures at least 4x, the right answer',
  `${liveOff} -> ${liveOn} (x${(liveOn / liveOff).toFixed(2)})`);
ok(keptOff.spawned <= liveOff,
  'and the OFF column is the same either way — only the dense side is undercounted',
  `mortal ${keptOff.spawned}, kept ${liveOff}`);

console.log(failed
  ? `\nverify-nbc-tunnel: ${failed} FAILURES\n`
  : '\nverify-nbc-tunnel: all checks passed\n');
process.exit(failed ? 1 : 0);
