#!/usr/bin/env node
// NO BULLET COOLDOWNS — tronic560's mod, and the switch that carries it.
//
// The mod is gamebanana.com/mods/587241; sim/attacks/nbc.js holds the site
// table, the GML line numbers and the credit. This suite proves two separate
// things about the translation, and the FIRST is the one that matters most:
//
// ── 1. OFF IS A LITERAL NO-OP ──────────────────────────────────────────────
//
// Not "off produces the same numbers" — off runs the same code. Every site the
// mod touches is a bullet spawn or a spawn timer, every bullet draws from the
// shared `gmlRng` stream, and the kaizo byte gate replays recorded fights
// bullet for bullet. One extra spawn, or one draw taken in a different order,
// moves every later bullet in the run.
//
// So the no-op half runs each affected attack THREE ways — flag never set,
// flag explicitly false, flag true — and fingerprints every frame: live
// entity count, the summed positions, the RNG's stream position, party HP.
// Never-set and explicitly-false must be BYTE-IDENTICAL strings. True must
// differ. The second half of that is what stops the whole suite passing
// vacuously if the flag were wired to nothing at all.
//
// ── 2. EACH MECHANISM ACTUALLY FIRES ───────────────────────────────────────
//
// One positive assertion per site, against the mod's own number. One of them
// is deliberately an assertion that something gets WEAKER, because the mod is
// not uniformly a buff and a suite that only checked for "more bullets" would
// pass on a translation that got it backwards:
//
//   * ac 16's tracking swords keep 206 while ac 11/14/17 halve to 103, because
//     the mod edits four of the five dispatch lines and skips line 518 (D1)
//
// M4 USED TO BE A SECOND ONE AND THE CLAIM WAS FALSE — see that block.

import { readFileSync } from 'node:fs';
import { createState, stepFrame } from '../sim/index.js';
import { buildSingleAttackScene } from '../sim/scenes/single.js';
import { trackingSwordsManager } from '../sim/attacks/tracking-swords.js';
import { roaringStar } from '../sim/attacks/roaring-star.js';
import { splitslash } from '../sim/attacks/splitslash.js';
import { roaringknightSlash } from '../sim/attacks/roaringknight-slash.js';
import { starOther15 } from '../sim/attacks/pointing-star.js';
import { knightCatch } from '../sim/knight.js';
import { BATTLE_MSG, battleMsgFor } from '../sim/battlemsg.js';
import {
  nbcOn, knightName, NBC_BATTLE_MSG, NBC_PROGAMER_MSG, NBC_DOWN_MSG,
  NBC_NAME, NBC_NAME_LOW, VANILLA_NAME, NBC_NAME_THRESHOLD,
  NBC_TRACKING_DAMAGE, NBC_VORTEX_DAMAGE, NBC_POINTING_DAMAGE,
  NBC_SLASH_AOE_DAMAGE, NBC_SPLITSLASH_DAMAGE, NBC_CATCH_DAMAGE,
  NBC_BOXSPLITTER_SPAWN, NBC_ROARING_STAR_BURST, NBC_SWORD_TUNNEL_RATE,
} from '../sim/attacks/nbc.js';
import { createTitle, controlRows, stepTitle, CREDITS } from '../sim/modes.js';

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

// The fight's own dispatch table, read as TEXT. M4 asserts something about
// which difficulties exist, and a source read is the only way to assert that
// a difficulty is ABSENT — running the scene can only show what is present.
const FIGHT_SRC = readFileSync(new URL('../sim/scenes/fight.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// The fingerprint. Deliberately coarse per line and long overall: it is meant
// to catch ANY divergence, not to describe one.
// ---------------------------------------------------------------------------

/**
 * @param attack     an ATTACK_MENU id
 * @param frames     how long to run
 * @param nbc        undefined = never set the flag at all; otherwise the value
 * @param keepAlive  drive the drill with the party immortal
 *
 * WHY keepAlive EXISTS ON A SPAWN COUNT. A fixed frame window does not measure
 * the same thing on both sides once the party can die. sim/scenes/single.js
 * relaunches the attack when a run ends, but its director latches on
 * `state.gameOver` and returns forever after — so the side that KILLS FASTER
 * gets FEWER runs inside the window, and a per-window total reads backwards
 * from the per-run density the player actually feels.
 *
 * Measured here, at 600 frames on the sword tunnel: OFF survives and fits two
 * runs (managers at f15 and f326), ON kills the party at f215 and fits one.
 * 194 against 458 looks like 2.4x; per run it is 97 against 458.
 *
 * `state.keepAlive` is the engine's own path for this (sim/index.js refills
 * and clears gameOver every frame). The no-op fingerprint half below does NOT
 * use it — that half is comparing OFF against OFF and wants the plain run.
 */
function run(attack, frames, nbc, difficulty = 0, seed = 4242, keepAlive = false) {
  const st = createState({ seed, traceBulletSlots: 0 });
  if (nbc !== undefined) st.noBulletCooldown = nbc;
  if (keepAlive) st.keepAlive = true;
  buildSingleAttackScene(st, { seed, attack, difficulty });
  const rows = [];
  const spawned = Object.create(null);
  const seen = new Set();
  for (let f = 0; f < frames; f++) {
    stepFrame(st, IDLE);
    let live = 0;
    let sx = 0;
    let sy = 0;
    for (const e of st.entities) {
      if (!e.alive) continue;
      live += 1;
      sx += e.x ?? 0;
      sy += e.y ?? 0;
      if (!seen.has(e)) {
        seen.add(e);
        spawned[e.type.name] = (spawned[e.type.name] ?? 0) + 1;
      }
    }
    // `gmlRng.n` is the stream POSITION — the single most sensitive value in
    // the sim, and the one the byte gate is really about.
    rows.push([
      f, live, sx.toFixed(6), sy.toFixed(6),
      st.gmlRng?.n ?? -1, st.partyHp.join('/'), st.knight?.hp ?? -1,
    ].join(','));
  }
  return { print: rows.join('\n'), spawned, st };
}

const ATTACKS = [
  ['roaring', 900, 0],
  ['flurry', 600, 0],
  ['flurry', 600, 3],
  ['tunnel', 600, 0],
  ['stars', 600, 0],
  ['tracking11', 600, 0],
  ['vortex', 600, 0],
  ['knightlines', 400, 0],
  ['rotating', 600, 0],
];

console.log('\n-- OFF IS A LITERAL NO-OP, and ON is not ------------------------');
for (const [attack, frames, diff] of ATTACKS) {
  const untouched = run(attack, frames, undefined, diff);
  const explicit = run(attack, frames, false, diff);
  const on = run(attack, frames, true, diff);
  ok(untouched.print === explicit.print,
    `${attack} d${diff}: flag absent and flag=false are byte-identical`);
  ok(untouched.print !== on.print,
    `${attack} d${diff}: flag=true actually changes the run`);
}

// A SECOND NO-OP CHECK WITH A DIFFERENT SEED, because a fingerprint that
// matched only at seed 4242 would be a coincidence worth knowing about.
{
  const a = run('roaring', 500, undefined, 0, 99991);
  const b = run('roaring', 500, false, 0, 99991);
  ok(a.print === b.print, 'roaring at a second seed: OFF is still byte-identical');
}

console.log('\n-- nbcOn reads only a real boolean true -------------------------');
eq(nbcOn(undefined), false, 'nbcOn(undefined)');
eq(nbcOn({}), false, 'nbcOn on a state with no field');
eq(nbcOn({ noBulletCooldown: false }), false, 'nbcOn(false)');
eq(nbcOn({ noBulletCooldown: 'on' }), false, 'a persisted STRING does not arm the mod');
eq(nbcOn({ noBulletCooldown: 1 }), false, 'a persisted 1 does not arm the mod');
eq(nbcOn({ noBulletCooldown: true }), true, 'nbcOn(true)');

console.log('\n-- M1/M2  ROARING: the fan every frame, the rings every beat ----');
{
  const off = run('roaring', 900, false);
  const on = run('roaring', 900, true);
  const a = off.spawned['obj_knight_roaring_star'] ?? 0;
  const b = on.spawned['obj_knight_roaring_star'] ?? 0;
  ok(a > 0, 'the vanilla roar fires stars at all', `${a}`);
  // The fan alone goes from one beat in five to every beat; with M2's rings on
  // top, anything under a 2.5x increase means one of the two did not land.
  // MEASURED, then asserted under it: 298 -> 843 at seed 4242, a 2.83x jump.
  // The bound is 2.5x rather than the measurement itself because the count is
  // a whole-attack total and the finale's despawn timing moves it a little;
  // dropping either site takes it well under 2x, which is what this is for.
  ok(b >= a * 2.5, 'M1+M2: the mod fires at least 2.5x the roaring stars', `off ${a}, on ${b}`);
}

console.log('\n-- M3  a roaring star bursts at timer 2, not 40 -----------------');
{
  eq(NBC_ROARING_STAR_BURST, 2, 'the mod’s threshold is 2');
  // Driven directly: the con-2 arm is the whole of the change, and a scene
  // would only prove it through a spawn count that M1 already moves.
  const mk = (nbc) => {
    const st = createState({ seed: 1, traceBulletSlots: 0 });
    st.noBulletCooldown = nbc;
    const e = {
      type: roaringStar, alive: true, x: 320, y: 200, con: 2, timer: 0,
      speed: 0, gravity: 0, friction: 0, direction: 0, split: 0, outbound: true,
      image_xscale: 1, image_yscale: 1, playSound: false, growstart: 0,
      gravity_direction: 0,
    };
    // Frame 1 arms gravity (speed and gravity both 0); from then on `timer`
    // climbs and the burst is the only thing being measured.
    const burstAt = [];
    for (let f = 1; f <= 45; f++) {
      roaringStar.step(e, st);
      if (e.con > 2) { burstAt.push(f); break; }
    }
    return burstAt[0] ?? -1;
  };
  eq(mk(false), 40, 'OFF: con leaves 2 on the step timer reaches 40');
  eq(mk(true), 2, 'ON: con leaves 2 on the step timer reaches 2');
}

console.log('\n-- M4  the box splitter cadence: a flat 33 at every live difficulty --');
{
  // THIS BLOCK USED TO ASSERT THE OPPOSITE AND PASS. It claimed "difficulty 3
  // (spawn_speed 31) gets FEWER slashes at 33", counting splitslashes over a
  // fixed 600-frame window. Both halves of that were wrong:
  //
  //   * 31 IS DIFFICULTY 2, not 3 — see boxsplitter-attack.js's init block.
  //     Difficulty 3 matches no branch there, so it keeps the 40 the Create
  //     set, and the diagonal re-arm's `timer = -4` makes every other gap 44.
  //     A flat 33 is FASTER than 40, so the mod speeds difficulty 3 up too.
  //
  //   * the count only fell because the party DIED sooner under the mod and
  //     the drill stopped relaunching (see run()'s keepAlive note). Held
  //     immortal, the same window measures 12 slashes OFF against 14 ON.
  //
  // So the fix is to stop counting and measure the CADENCE, which is the thing
  // the mod actually edits. A gap is immune to how many runs fit in a window.
  eq(NBC_BOXSPLITTER_SPAWN, 33, 'the mod\u2019s flat spawn interval is 33');

  /** The frame gaps between consecutive splitslashes, one attack run's worth. */
  const gaps = (d, nbc) => {
    const at = [];
    const st = createState({ seed: 4242, traceBulletSlots: 0 });
    st.noBulletCooldown = nbc;
    st.keepAlive = true;
    buildSingleAttackScene(st, { seed: 4242, attack: 'flurry', difficulty: d });
    const seen = new Set();
    for (let f = 0; f < 420; f++) {
      stepFrame(st, IDLE);
      // PARKED OUT OF THE BOX, and this is not cosmetic. A cut that catches
      // the soul runs splitslash.js's playerstrike path, which does
      // `mg.timer -= 5` — getting hit DELAYS the next cut. An idle party
      // stands still and gets caught, so a drill that left the soul in place
      // measured a stray 38 among the 33s at difficulty 1, and would measure a
      // different stray on a different seed. The gap under test is the SPAWN
      // interval; the hit setback is a separate vanilla mechanic riding on it.
      if (st.soul) st.soul.y = -5000;
      for (const e of st.entities) {
        if (!e.alive || seen.has(e)) continue;
        seen.add(e);
        if (e.type === splitslash) at.push(f);
      }
    }
    const g = [];
    for (let i = 1; i < at.length; i++) g.push(at[i] - at[i - 1]);
    // Drop the first two: the Create sets `timer = 200` so slash 1 is
    // immediate, and at difficulty 0/1 spawn_speed is still walking down to 40.
    return g.slice(2);
  };

  // THE THREE DIFFICULTIES THE FIGHT ACTUALLY DISPATCHES. sim/scenes/fight.js
  // lists ac 2 at difficulty 0, 1 and 3 and nowhere else.
  for (const d of [0, 1, 3]) {
    const off = gaps(d, false);
    const on = gaps(d, true);
    ok(off.length >= 4 && on.length >= 4, `d${d}: both sides slash enough to time`,
      `off ${off.length}, on ${on.length}`);
    const slowest = Math.max(...on);
    const fastest = Math.min(...off);
    ok(fastest >= 40,
      `d${d}: vanilla never cuts faster than every 40 frames`,
      `off min ${fastest}, [${off.join(',')}]`);
    ok(slowest <= fastest,
      `d${d}: the mod's SLOWEST gap is no wider than vanilla's FASTEST`,
      `on max ${slowest}, off min ${fastest}`);
    // The flat 33 itself, and the 37 the difficulty-3 diagonal re-arm makes
    // of it (`timer = -4` costs four frames before the next cut).
    ok(on.every((g) => g === 33 || g === 37),
      `d${d}: every modded gap is the flat 33 (37 after a diagonal)`,
      `[${on.join(',')}]`);
  }

  // THE HONEST VERSION OF "NOT UNIFORMLY A BUFF". A flat 33 WOULD be slower
  // than difficulty 2's spawn_speed of 31 — the mod really does contain that
  // regression. It just never runs: nothing dispatches the box splitter at
  // difficulty 2. Asserted so that a future dispatch change trips this.
  const d2 = FIGHT_SRC.match(/\{ ac: 2, difficulty: (\d)/g) ?? [];
  ok(d2.length > 0, 'the fight dispatches ac 2 at all', `${d2.length} entries`);
  ok(!d2.some((m) => m.endsWith('2')),
    'difficulty 2 — the one branch where 33 would be a NERF — is never dispatched',
    d2.join(' | '));
}

console.log('\n-- M5  the sword tunnel drops a pair every frame ----------------');
{
  eq(NBC_SWORD_TUNNEL_RATE, -999, 'the mod assigns rate = -999');
  // KEEPALIVE, and it is the whole difference between 2.4x and 4.8x here.
  // Mortal, this drill fits two runs OFF (managers at f15 and f326) and one ON
  // (the party dies at f215 and the director latches), so the window compares
  // two runs against one. See run()'s note; tools/verify-nbc-tunnel.mjs is the
  // suite that first caught this and it holds the long-form write-up.
  const off = run('tunnel', 600, false, 0, 4242, true);
  const on = run('tunnel', 600, true, 0, 4242, true);
  const a = off.spawned['obj_sword_tunnel_sword'] ?? 0;
  const b = on.spawned['obj_sword_tunnel_sword'] ?? 0;
  ok(a > 0, 'the vanilla corridor spawns swords', `${a}`);
  // Vanilla `rate` is 4, so every-frame spawning is about a 4x increase.
  ok(b >= a * 3, 'M5: at rate -999 the corridor spawns at least 3x the swords',
    `off ${a}, on ${b}`);
  const mgr = on.st.entities.find((e) => e.type.name === 'obj_sword_tunnel_manager');
  if (mgr) eq(mgr.rate, -999, 'the live manager is holding the mod’s rate');
  const mgrOff = off.st.entities.find((e) => e.type.name === 'obj_sword_tunnel_manager');
  if (mgrOff) ok(mgrOff.rate !== -999, 'OFF: the manager keeps its own rate', `${mgrOff.rate}`);
}

console.log('\n-- M6  the tunnel slasher skips its 16-frame wind-up ------------');
{
  const first = (nbc) => {
    const st = createState({ seed: 7, traceBulletSlots: 0 });
    st.noBulletCooldown = nbc;
    buildSingleAttackScene(st, { seed: 7, attack: 'knightlines', difficulty: 0 });
    const find = () => st.entities.find(
      (e) => e.alive && e.type.name === 'obj_knight_tunnel_slasher',
    );
    for (let f = 0; f < 400; f++) {
      stepFrame(st, IDLE);
      // THE FRAME IT APPEARS ON IS NOT THE FRAME IT STEPS ON. sim/entity.js
      // freezes the entity list at the start of each phase, so a slasher
      // spawned mid-frame does not run its own Step until the next one —
      // reading `behavior` here would find the Create value on both sides and
      // the test would pass for the wrong reason. One more frame, then read.
      if (find()) {
        stepFrame(st, IDLE);
        return find()?.behavior ?? 'destroyed';
      }
    }
    return 'never spawned';
  };
  eq(first(false), 'prepare', 'OFF: the slasher is still winding up on its first live frame');
  eq(first(true), 'slash', 'ON: the slasher is already slashing on its first live frame');
}

console.log('\n-- M7  the tracking manager fires every frame -------------------');
{
  // obj_tracking_swords_manager_Step_0.gml:6 — the spawn gate gains `|| true`.
  // The mod's biggest change to this fight, and the one the knight-only diff
  // missed: the file is not named for the knight, so a `*knight*` filter over
  // the dump does not list it.
  // KEEPALIVE for the same reason as M5, though here the bias ran the other
  // way: OFF was the side that died and relaunched, inflating the vanilla
  // count from 26 to 35 and UNDERSTATING the mod.
  const off = run('tracking11', 600, false, 0, 4242, true);
  const on = run('tracking11', 600, true, 0, 4242, true);
  const a = off.spawned['obj_tracking_sword1'] ?? 0;
  const b = on.spawned['obj_tracking_sword1'] ?? 0;
  ok(a > 0, 'the vanilla manager spawns tracking swords at all', `${a}`);
  // Vanilla `rate` is 32 for variant 0, so an every-frame gate is a very large
  // multiple. 5x is far below that and still impossible to reach by accident.
  ok(b >= a * 5, 'M7: with the gate dead the manager spawns at least 5x the swords',
    `off ${a}, on ${b}`);
  // AND THE VORTEX TURN RUNS THE SAME MANAGER — ac 15 chains it behind the
  // vortex, so the site has to fire there too or the translation is half done.
  const vOff = run('vortex', 600, false, 0, 4242, true).spawned['obj_tracking_sword1'] ?? 0;
  const vOn = run('vortex', 600, true, 0, 4242, true).spawned['obj_tracking_sword1'] ?? 0;
  ok(vOn > vOff, 'M7 reaches the ac-15 chained manager too', `off ${vOff}, on ${vOn}`);
}

console.log('\n-- D1  tracking swords 206 -> 103, EXCEPT ac 16 -----------------');
{
  eq(NBC_TRACKING_DAMAGE, 103, 'the mod halves the four edited dispatches to 103');
  const init = (nbc, chained) => {
    const st = createState({ seed: 3, traceBulletSlots: 0 });
    st.noBulletCooldown = nbc;
    const e = { type: trackingSwordsManager, alive: true, x: 0, y: 0 };
    trackingSwordsManager.create(e, st);
    e.variant = 0;
    e.damage = 206; // what fight.js assigns, at every one of the five sites
    trackingSwordsManager.init(e, st, chained);
    return e.damage;
  };
  eq(init(false, null), 206, 'OFF ac 11/14/17: untouched');
  eq(init(false, 104), 206, 'OFF ac 16: untouched');
  eq(init(false, 154), 206, 'OFF ac 15: untouched');
  eq(init(true, null), 103, 'ON ac 11/14/17 (dump lines 465/491/527): halved');
  eq(init(true, 154), 103, 'ON ac 15 (dump line 505): halved');
  eq(init(true, 104), 206, 'ON ac 16 (dump line 518): NOT edited by the mod');
}

console.log('\n-- D2  the sword vortex’s swords take 103 ---------------------');
{
  eq(NBC_VORTEX_DAMAGE, 103, 'the mod halves dump line 500 to 103');
  const dmg = (nbc) => {
    const r = run('vortex', 400, nbc);
    const s = r.st.entities.find((e) => e.alive && e.type.name === 'obj_sword_vortex');
    return s ? s.damage : null;
  };
  const off = dmg(false);
  ok(off !== null && off !== 103, 'OFF: the vortex swords are not on the mod’s number', `${off}`);
  eq(dmg(true), 103, 'ON: the vortex swords take the mod’s 103');
}

console.log('\n-- D3/D4  the pointing star and its children, 75 -> 100 ---------');
{
  eq(NBC_POINTING_DAMAGE, 100, 'the mod raises the star to 100');
  const hit = (nbc) => {
    const st = createState({ seed: 5, traceBulletSlots: 0 });
    st.noBulletCooldown = nbc;
    const e = { type: { name: 'probe' }, alive: true, active: 1, destroyonhit: 0, damage: 0 };
    starOther15(e, st);
    return e.damage;
  };
  eq(hit(false), 75, 'OFF: 75, party-wide');
  eq(hit(true), 100, 'ON: 100, party-wide');
}

console.log('\n-- D5  the slash’s AOE branch 75 -> 69, single-target untouched -');
{
  eq(NBC_SLASH_AOE_DAMAGE, 69, 'the mod lowers the AOE branch to 69');
  const hit = (nbc, aoe) => {
    const st = createState({ seed: 5, traceBulletSlots: 0 });
    st.noBulletCooldown = nbc;
    const e = {
      type: roaringknightSlash, alive: true, active: 0, aoe, damage: 0,
      target: 0, destroyonhit: 0,
    };
    // `active` 0 means nothing is dealt; the assignment above the gate is what
    // this asserts, which is exactly where the mod's edit is.
    roaringknightSlash.other15(e, st);
    return e.damage;
  };
  eq(hit(false, true), 75, 'OFF, AOE: 75');
  eq(hit(true, true), 69, 'ON, AOE: 69');
  eq(hit(false, false), 206, 'OFF, single target: 206');
  eq(hit(true, false), 206, 'ON, single target: STILL 206 — the mod did not touch it');
}

console.log('\n-- D6  the split slash 206 -> 242, the changelog’s one true line -');
{
  eq(NBC_SPLITSLASH_DAMAGE, 242, 'the mod raises the split slash to 242');
  const mk = (nbc) => {
    const st = createState({ seed: 5, traceBulletSlots: 0 });
    st.noBulletCooldown = nbc;
    const e = { type: splitslash, alive: true, x: 0, y: 0, depth: 0 };
    splitslash.create(e, st);
    return e.damage;
  };
  eq(mk(false), 206, 'OFF: 206');
  eq(mk(true), 242, 'ON: 242');
}

console.log('\n-- D7  the ROARING catch, 40 -> 15 a member ---------------------');
{
  eq(NBC_CATCH_DAMAGE, 15, 'the mod lowers the catch to 15');
  const caught = (nbc) => {
    const st = createState({ seed: 5, traceBulletSlots: 0 });
    st.noBulletCooldown = nbc;
    st.invTimer = -1;
    st.partyHp = [190, 180, 170]; // all well clear of the `< 41` clamp
    const before = st.partyHp.slice();
    knightCatch(st);
    return before.map((h, i) => h - st.partyHp[i]);
  };
  const off = caught(false);
  const on = caught(true);
  ok(off.every((d) => d > 0), 'OFF: all three take the catch', off.join('/'));
  ok(on.every((d) => d > 0), 'ON: all three still take the catch', on.join('/'));
  ok(on.every((d, i) => d < off[i]), 'ON: every member takes LESS than vanilla',
    `off ${off.join('/')}, on ${on.join('/')}`);
  // The clamp is untouched, so a member inside 2..40 is rewritten to hp-1 on
  // BOTH sides — which for most of that band is more than 15.
  const clamped = (nbc) => {
    const st = createState({ seed: 5, traceBulletSlots: 0 });
    st.noBulletCooldown = nbc;
    st.invTimer = -1;
    st.partyHp = [30, 30, 30];
    knightCatch(st);
    return st.partyHp.slice();
  };
  ok(JSON.stringify(clamped(false)) === JSON.stringify(clamped(true)),
    'the `hp > 1 && hp < 41` clamp is UNCHANGED by the mod',
    `${clamped(false).join('/')} vs ${clamped(true).join('/')}`);
}

console.log('\n-- T1  the enemy’s name, and the 5840 threshold ----------------');
{
  eq(NBC_NAME_THRESHOLD, 5840, 'the threshold is the code’s 5840, not the changelog’s silence');
  eq(knightName({ knight: { hp: 7300 } }), VANILLA_NAME, 'OFF at full HP: Knight');
  eq(knightName({ knight: { hp: 10 } }), VANILLA_NAME, 'OFF at low HP: still Knight');
  eq(knightName({ noBulletCooldown: true, knight: { hp: 7300 } }), NBC_NAME, 'ON at full HP');
  eq(knightName({ noBulletCooldown: true, knight: { hp: 5840 } }), NBC_NAME,
    'ON exactly AT 5840: still Roaring Knight — the test is `<`, not `<=`');
  eq(knightName({ noBulletCooldown: true, knight: { hp: 5839 } }), NBC_NAME_LOW,
    'ON one point under: Roaring Fraud');
  eq(knightName({ noBulletCooldown: true }), NBC_NAME, 'ON with no knight: the plain name');
}

console.log('\n-- T2/T3/T4  the writing ---------------------------------------');
{
  // The mod rewrote fourteen of the fifteen flavour lines. The fifteenth being
  // ABSENT is the mod's own gap and is asserted as such, because an overlay
  // that quietly filled it in would be inventing a line.
  let overlaid = 0;
  for (const phase of [1, 2, 3]) {
    for (const turn of [0, 1, 2, 3, 4]) {
      const m = NBC_BATTLE_MSG[phase]?.[turn];
      if (m === undefined) continue;
      overlaid += 1;
      ok(m !== BATTLE_MSG[phase][turn],
        `phase ${phase} turn ${turn}: the overlay is not a copy of the vanilla line`);
    }
  }
  eq(overlaid, 14, 'fourteen lines are overlaid');
  eq(NBC_BATTLE_MSG[1][0], undefined,
    'phase 1 turn 0 (the silver stars) is NOT overlaid — the mod left it alone');

  const both = (phase, turn) => [
    battleMsgFor(phase, turn, {}),
    battleMsgFor(phase, turn, { nbc: true }),
  ];
  eq(both(1, 1)[0], BATTLE_MSG[1][1], 'OFF resolves the vanilla line');
  eq(both(1, 1)[1], NBC_BATTLE_MSG[1][1], 'ON resolves the mod’s line');
  eq(both(1, 0)[1], BATTLE_MSG[1][0],
    'ON falls through to vanilla where the mod changed nothing');

  // T3 — the progamer line, and only that one, in phase 4.
  const p4 = (nbc, progamer) =>
    battleMsgFor(3, 0, { phase4turn: 3, partyHp: [190, 190, 190], haveusedroaring: true, progamer, nbc });
  eq(p4(false, true), '* Kris coughed.&* The enemy slowly tilted its head...', 'OFF progamer');
  eq(p4(true, true), NBC_PROGAMER_MSG, 'ON progamer');
  eq(p4(true, false), p4(false, false), 'ON without progamer: phase 4 is otherwise untouched');

  // T4 — the three knockdown lines, and Susie's balloonturn variant.
  const down = (nbc, balloonturn) => battleMsgFor(1, 1, {
    partyHp: [0, 190, 190],
    downSeen: { kris: false, susie: false, ralsei: false },
    nbc,
    balloonturn,
  });
  eq(down(false), '* Kris kneeled in silence.&', 'OFF: Kris’s vanilla knockdown line');
  eq(down(true), NBC_DOWN_MSG.kris, 'ON: Kris’s mod line');
  const susie = (balloonturn) => battleMsgFor(1, 1, {
    partyHp: [190, 0, 190],
    downSeen: { kris: false, susie: false, ralsei: false },
    nbc: true,
    balloonturn,
  });
  eq(susie(0), NBC_DOWN_MSG.susie, 'ON, balloonturn 0: Susie’s early line');
  eq(susie(undefined), NBC_DOWN_MSG.susie,
    'ON, balloonturn UNKNOWN: the early line, never a guess at the late one');
  eq(susie(5), NBC_DOWN_MSG.susie, 'ON, balloonturn 5: still early — the test is `>= 6`');
  eq(susie(6), NBC_DOWN_MSG.susieLate, 'ON, balloonturn 6: the late line');
}

console.log('\n-- THE CONTROLS ROW, and the credit ----------------------------');
{
  const title = createTitle();
  eq(title.noBulletCooldown, false, 'the setting defaults OFF');
  const rows = controlRows(title);
  const row = rows.find((r) => r.id === 'nbc');
  ok(!!row, 'the CONTROLS page has a NO BULLET COOLDOWNS row');
  eq(row?.value, 'OFF', 'and it reads OFF');
  title.noBulletCooldown = true;
  eq(controlRows(title).find((r) => r.id === 'nbc').value, 'ON', 'and ON once set');

  // Toggling the row must not toggle its NEIGHBOUR — the failure mode a
  // catch-all `else` in the handler produces, which looks live and is wrong.
  const t = createTitle();
  t.settings = {
    page: 'controls', cursor: rows.findIndex((r) => r.id === 'nbc'), shared: 0,
    equip: { stage: 'char', char: 0, row: 0, pocket: 0 },
    items: { stage: 'slots', slot: 0, pick: 0 },
    controls: { stage: 'rows', bind: 0 },
  };
  const press = (a) => {
    const held = { ...IDLE, [a]: true };
    stepTitle(t, held, { ...IDLE });
  };
  press('confirm');
  eq(t.noBulletCooldown, true, 'confirm on the row turns the mod on');
  eq(t.holdBreath, false, 'and leaves SINGLE HOLDBREATH alone');
  eq(t.swapZX, false, 'and leaves TOUCH BUTTONS alone');
  press('left');
  eq(t.noBulletCooldown, false, 'left turns it back off');

  // THE CREDIT IS IN THE MODULE HEADER, NOT ON THE CREDITS PAGE, and the
  // assertion follows the decision rather than the other way round: a row on
  // that page makes the vanilla list four long, and kaizo-knight-sim's
  // check-credits asserts three. `sim/modes.js` carries the row text and the
  // two-file change that would restore it.
  //
  // ASSERTED ON THE FILE'S BYTES, because this is the one claim in the suite
  // that is about attribution rather than behaviour — there is no export to
  // read, and a credit that only lives in a comment is exactly the thing that
  // rots silently when the file is refactored.
  const header = readFileSync(new URL('../sim/attacks/nbc.js', import.meta.url), 'utf8');
  ok(/tronic560/i.test(header),
    'sim/attacks/nbc.js names tronic560 as the mod’s author');
  ok(header.includes('gamebanana.com/mods/587241'),
    'and links to the mod page it was translated from');
  ok(!CREDITS.some((c) => /tronic560/i.test(c.who ?? '')),
    'and the CREDITS page is NOT carrying a fourth row — see sim/modes.js');
  eq(CREDITS.length, 3, 'the vanilla credits list is still three rows');
}

console.log(failed ? `\nverify-nbc: ${failed} FAILURES\n` : '\nverify-nbc: all checks passed\n');
process.exit(failed ? 1 : 0);
