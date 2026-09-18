#!/usr/bin/env node
// SINGLE HOLDBREATH — the switch, and the soul it is supposed to speed up.
//
// WHY THIS SUITE EXISTS. Two suites already touch HoldBreath and neither one
// connects the switch to the fight:
//
//   verify-spells  calls `holdBreath()` and `soulSpeed()` DIRECTLY, on a bare
//                  state. It proves the counter clamps and that 5 and 6 come
//                  out of the right branches. It never builds a scene.
//   verify-dials   drives the CONTROLS page and asserts the row toggles
//                  `title.holdBreath`. It never builds a scene either.
//
// So the middle link — `buildSingleAttackScene` arms `holdbreathcount`, the
// drill keeps it armed across its own per-run soul re-delivery, and obj_heart
// walks a pixel further every frame because of it — had no check at all, in
// any attack. That is exactly CLAUDE.md's "a green suite does not mean a
// change took effect": both halves were green and the thing between them was
// unasserted.
//
// It was written after a report from play that the switch "isn't working on
// the flurry (box splitter) single attack mode". IT DOES NOT REPRODUCE — every
// assertion below passes on the shipped code, Flurry included, at all three of
// its difficulties and inside the split as well as outside it. What the suite
// buys is that the next such report can be answered with a number instead of a
// reading, and that the two AUTHENTIC asymmetries in section 5 — which are
// what the buff actually feels like under the slow key — can never be
// "corrected" into a divergence.
//
// EVERYTHING IS DRIVEN THROUGH THE SHIPPED SCENE BUILDER, never by calling
// soulSpeed() or by writing a speed onto the soul. A test that pokes the field
// it is checking proves the field exists, not that the switch reaches it.

import { createState, stepFrame, traceHeader, traceRow } from '../sim/index.js';
import { buildSingleAttackScene, ATTACK_MENU } from '../sim/scenes/single.js';
import { soulSpeed } from '../sim/spells.js';

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const IDLE = {
  left: 0, right: 0, up: 0, down: 0, focus: 0, confirm: 0, cancel: 0,
};

/**
 * A drill, built the way web/main.js builds one.
 *
 * `keepAlive` because an UNATTENDED party is wiped within one run of most of
 * these attacks, and the drill director's first line is `if (state.gameOver)
 * return` — which freezes the turn clock and stops the drill repeating. A
 * headless run that must outlive a wipe sets this exact flag (sim/index.js
 * refills, revives and clears gameOver every frame); tools/verify-graze.mjs
 * does the same thing for the same reason. Without it the measurement below
 * silently becomes "the first three hundred frames", which is enough to pass
 * and not enough to mean anything.
 */
function drill(attack, difficulty, holdBreath, seed = 4242) {
  const s = createState({ seed });
  s.keepAlive = true;
  buildSingleAttackScene(s, { seed, attack, difficulty, holdBreath });
  return s;
}

/** Hold one direction for 10 frames, the other for 10, forever. Neither long
 *  enough to park on a wall, which would report the clamp's step rather than
 *  the soul's. */
function wave(f, axis) {
  const fwd = (f % 20) < 10;
  const inp = { ...IDLE };
  if (axis === 'x') { inp.right = fwd ? 1 : 0; inp.left = fwd ? 0 : 1; }
  else { inp.down = fwd ? 1 : 0; inp.up = fwd ? 0 : 1; }
  return inp;
}

/** The most common non-zero per-frame displacement — the soul's walk. */
function walkStep(state, axis, frames) {
  const seen = new Map();
  let prev = null;
  for (let f = 0; f < frames; f++) {
    stepFrame(state, wave(f, axis));
    if (!state.soul) { prev = null; continue; }
    const v = axis === 'x' ? state.soul.x : state.soul.y;
    if (prev !== null) {
      const d = Math.abs(v - prev);
      if (d > 0) seen.set(d, (seen.get(d) ?? 0) + 1);
    }
    prev = v;
  }
  const top = [...seen.entries()].sort((a, b) => b[1] - a[1])[0];
  return { step: top ? top[0] : null, samples: top ? top[1] : 0 };
}

// ---------------------------------------------------------------------------
// 1. THE SWITCH REACHES THE SOUL, IN EVERY ATTACK THE DRILL OFFERS.
//
// Every entry in ATTACK_MENU, every difficulty that entry lists, both axes.
// OFF must walk 4 — `global.sp`, obj_heart's Create — and ON must walk 5,
// which is obj_knight_enemy's Step:
//
//     if (holdbreathcount > 0 && i_ex(obj_heart)) obj_heart.wspeed = 5;
//
// ROARING is the one exception and it is not a failure: its own bullet phase
// keeps obj_knight_roaring2 on screen, which is the second line of that same
// block and takes the soul to 6. Section 2 pins that gate rather than letting
// this one paper over it.
// ---------------------------------------------------------------------------
{
  let combinations = 0;
  for (const entry of ATTACK_MENU) {
    for (const difficulty of entry.difficulties) {
      for (const axis of ['x', 'y']) {
        combinations += 1;
        const off = walkStep(drill(entry.id, difficulty, false), axis, 1500);
        const on = walkStep(drill(entry.id, difficulty, true), axis, 1500);
        const want = entry.id === 'roaring' ? 6 : 5;
        const where = `${entry.id} d${difficulty} ${axis}`;
        check(off.samples > 200,
          `${where}: only ${off.samples} moving frames with the switch OFF — the measurement is empty, not passing`);
        check(off.step === 4, `${where}: the switch OFF walks ${off.step}, expected 4`);
        check(on.step === want, `${where}: the switch ON walks ${on.step}, expected ${want}`);
      }
    }
  }
  check(combinations >= 40,
    `only ${combinations} attack/difficulty/axis combinations were measured`);
}

// ---------------------------------------------------------------------------
// 2. THE 6 IS GATED ON obj_knight_roaring2, NOT ON THE ATTACK.
//
// The driven half is what matters: inside the ROARING drill the soul must
// actually be seen at BOTH speeds — 6 while the roar is on screen, 5 while it
// is not. A 6 everywhere would mean the gate had been dropped, and section 1
// would still be green.
// ---------------------------------------------------------------------------
{
  const s = drill('roaring', 0, true);
  const withRoar = new Set();
  const without = new Set();
  let prev = null;
  for (let f = 0; f < 1500; f++) {
    stepFrame(s, wave(f, 'x'));
    if (!s.soul) { prev = null; continue; }
    if (prev !== null) {
      const d = Math.abs(s.soul.x - prev);
      const roaring = s.entities.some((x) => x.alive && x.type.name === 'obj_knight_roaring2');
      if (d > 0) (roaring ? withRoar : without).add(d);
    }
    prev = s.soul.x;
  }
  check(withRoar.has(6),
    `ROARING on screen never walked 6 (saw ${[...withRoar].join(',') || 'nothing'})`);
  check(without.has(5),
    `ROARING off screen never walked 5 (saw ${[...without].join(',') || 'nothing'})`);
  check(!without.has(6),
    'the soul walked 6 with no obj_knight_roaring2 alive — the gate is gone');

  // And the pure function agrees, all three ways round.
  const bare = createState({ seed: 1 });
  bare.knight.holdbreathcount = 0;
  check(soulSpeed(bare) === 4, 'soulSpeed with no HoldBreath is not 4');
  bare.knight.holdbreathcount = 1;
  check(soulSpeed(bare) === 5, 'soulSpeed with HoldBreath is not 5');
  bare.roaringActive = true;
  check(soulSpeed(bare) === 6, 'soulSpeed during ROARING is not 6');
}

// ---------------------------------------------------------------------------
// 3. FLURRY, INSIDE THE SPLIT — the attack the report named.
//
// obj_knight_split_growtangle's End Step is why this needs its own section. It
// CLAMPS the soul into the widened box and then ROUNDS it, every frame of the
// attack, at every `con` — and it is the only thing in this attack that writes
// the soul's position after the soul has already moved itself. A clamp that
// quantised to the vanilla 4, or a round that ate the odd pixel, would leave
// section 1 green (con 0 is most of the attack) and take the buff away exactly
// while the box is being cut, which is the half of Flurry anyone is
// practising.
//
// Bucketed per `con`, and read as the MODAL non-zero displacement rather than
// a mean. Cons 1-3 SHOVE the soul as well as let it walk, and the arena is
// small enough that the soul spends real time parked against the clamp — a
// mean mixes the walk with the shove and with those zeroes and lands on
// nothing in particular. The mode is the walk itself, which is the only thing
// HoldBreath is entitled to change.
// ---------------------------------------------------------------------------
for (const difficulty of ATTACK_MENU.find((a) => a.id === 'flurry').difficulties) {
  const stepsFor = (holdBreath) => {
    const s = drill('flurry', difficulty, holdBreath);
    const byCon = new Map();
    let prev = null;
    for (let f = 0; f < 1800; f++) {
      stepFrame(s, wave(f, 'x'));
      const gt = s.entities.find((x) => x.alive && x.type.name === 'obj_knight_split_growtangle');
      if (!s.soul) { prev = null; continue; }
      if (prev !== null && gt) {
        const d = Math.abs(s.soul.x - prev);
        if (d > 0) {
          const k = String(gt.con);
          const m = byCon.get(k) ?? new Map();
          m.set(d, (m.get(d) ?? 0) + 1);
          byCon.set(k, m);
        }
      }
      prev = s.soul.x;
    }
    return byCon;
  };
  const modal = (m) => (m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null);
  const off = stepsFor(false);
  const on = stepsFor(true);
  check(['0', '1', '2', '3'].every((c) => off.has(c)),
    `flurry d${difficulty}: the split never reached all four cons — saw ${[...off.keys()].join(',')}`);
  // con 0 is the open arena: the soul walks and nothing shoves it, so the step
  // is exact.
  check(modal(off.get('0')) === 4,
    `flurry d${difficulty} con 0 walks ${modal(off.get('0'))} with the switch OFF, expected 4`);
  check(modal(on.get('0')) === 5,
    `flurry d${difficulty} con 0 walks ${modal(on.get('0'))} with the switch ON, expected 5`);
  // Cons 1-3 are the cut, and they SHOVE as well as let the soul walk — a
  // shoved frame can land on any displacement, 5 included, so "a 5 appeared"
  // is not evidence of anything. What is evidence is the shape of the
  // distribution: pool the three cut cons and count the frames that stepped
  // exactly 4 against the frames that stepped exactly 5. With the switch ON
  // the walk is 5 and the 5s must dominate; with it OFF the walk is 4 and the
  // 4s must. A split that quantised the soul back to the vanilla step would
  // leave both columns looking like the OFF run.
  {
    const pooled = (m) => {
      const out = new Map();
      for (const con of ['1', '2', '3']) {
        for (const [d, n] of m.get(con) ?? new Map()) out.set(d, (out.get(d) ?? 0) + n);
      }
      return out;
    };
    const a = pooled(off);
    const b = pooled(on);
    const total = (m) => [...m.values()].reduce((x, y) => x + y, 0);
    if (total(a) >= 40 && total(b) >= 40) {
      const a4 = a.get(4) ?? 0;
      const a5 = a.get(5) ?? 0;
      const b4 = b.get(4) ?? 0;
      const b5 = b.get(5) ?? 0;
      check(a4 > a5 * 2,
        `flurry d${difficulty} inside the cut, switch OFF: ${a4} frames stepped 4 against ${a5} that stepped 5 — the vanilla walk is not dominant`);
      check(b5 > b4 * 2,
        `flurry d${difficulty} inside the cut, switch ON: ${b5} frames stepped 5 against ${b4} that stepped 4 — the split is eating the buff`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. THE DRILL KEEPS IT ARMED ACROSS ITS OWN RUNS.
//
// The drill re-delivers obj_heart every run (single.js: "AND GIVE THE HEART
// BACK"), so the buff has to survive a soul that did not exist when the switch
// was read. `holdbreathcount` lives on `state.knight`, which the per-run reset
// does not touch — asserted rather than assumed, because a reset that rebuilt
// the knight would present as "the switch stops working after the first
// repetition", which is very close to what the report described.
// ---------------------------------------------------------------------------
{
  const s = drill('stars', 0, true);
  const souls = new Set();
  const speeds = new Set();
  let fell = -1;
  for (let f = 0; f < 3000; f++) {
    stepFrame(s, wave(f, 'x'));
    if (s.soul) {
      souls.add(s.soul);
      speeds.add(s.soul.wspeed);
      if (fell < 0 && s.knight.holdbreathcount !== 1) fell = f;
    }
  }
  check(fell < 0, `holdbreathcount left 1 at frame ${fell}`);
  check(souls.size >= 3,
    `only ${souls.size} soul(s) were delivered — the drill did not repeat, so nothing was proved about repeats`);
  check(speeds.size === 1 && speeds.has(5),
    `across ${souls.size} runs the soul's wspeed was ${[...speeds].join(',')}, expected only 5`);
}

// ---------------------------------------------------------------------------
// 5. UNDER THE SLOW KEY THE BUFF IS ASYMMETRIC, AND THAT IS THE GAME.
//
//     px = ceil(px * 0.5)        gml_Object_obj_heart_Step_0.gml:50
//
// ceil on a SIGNED value, which CLAUDE.md already flags as "ceil, not floor,
// not a bare multiply". At wspeed 5 that is ceil(2.5) = 3 going right or down
// and ceil(-2.5) = -2 going left or up — so with the slow key held, HoldBreath
// buys a pixel in two directions and NOTHING in the other two. At wspeed 4 it
// is 2 in all four.
//
// This is the closest thing in the code to the report this suite was written
// for: a player holding the slow key through a cramped arena is getting no
// buff half the time, correctly. It is pinned here so that a later "fix" of
// the asymmetry has to argue with the dump first.
//
// `disableslow` latches at obj_heart's Create when the key is ALREADY down, so
// the key is pressed only after the soul exists — otherwise this measures the
// latch and not the modifier.
// ---------------------------------------------------------------------------
{
  const focused = (holdBreath, dir) => {
    const s = drill('flurry', 0, holdBreath);
    const seen = new Map();
    let prev = null;
    let soulFrames = 0;
    for (let f = 0; f < 400; f++) {
      const inp = { ...IDLE };
      if (s.soul) soulFrames += 1;
      if (soulFrames > 2) {
        inp.focus = 1;
        inp[dir] = 1;
      }
      stepFrame(s, inp);
      if (!s.soul) { prev = null; continue; }
      const v = (dir === 'left' || dir === 'right') ? s.soul.x : s.soul.y;
      if (prev !== null && soulFrames > 4) {
        const d = Math.abs(v - prev);
        if (d > 0) seen.set(d, (seen.get(d) ?? 0) + 1);
      }
      prev = v;
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const cases = [
    [false, 'right', 2], [false, 'left', 2], [false, 'down', 2], [false, 'up', 2],
    [true, 'right', 3], [true, 'down', 3],
    [true, 'left', 2], [true, 'up', 2],
  ];
  for (const [hb, dir, want] of cases) {
    const got = focused(hb, dir);
    check(got === want,
      `slow key + switch ${hb ? 'ON' : 'OFF'}, ${dir}: ${got}, expected ${want}`);
  }
}

// ---------------------------------------------------------------------------
// 6. THE SWITCH'S ENTIRE BUILD-TIME FOOTPRINT IS ONE FIELD ON THE KNIGHT.
//
// Half the suites in this repo build a drill without mentioning `holdBreath`
// at all. What makes that safe is not that OFF and "omitted" agree — they
// CANNOT disagree, because `holdBreath = false` is the destructuring default,
// so inside the function the two calls are the same value. An earlier draft of
// this section compared them anyway and asserted three things that were true
// by construction; a check that cannot fail is worse than no check, so they
// are gone. (Proof they could not fail: sabotages that gave the explicit-false
// path its own `state.gmlRng = gmlCreate(seed + 1)` and its own
// `state.knight.progamer = true` both left this section green.)
//
// What IS falsifiable, and is what those suites actually depend on:
//
//   - omitting the option leaves the count at 0, so the default is OFF;
//   - turning it ON changes exactly one scalar in the built scene,
//     `knight.holdbreathcount`, and nothing else on the knight or on state;
//   - arming it consumes no RNG, so a drill with the switch on starts from the
//     same stream position as one without — otherwise every bullet in the run
//     would move, and the fault would read as "the split is wrong" rather than
//     "the switch is wrong";
//   - and ON does not trace identically to OFF, so the switch is not inert.
//
// THE TRACE ALONE WOULD NOT BE ENOUGH for the footprint claim, and that is
// measured rather than assumed: a sabotage that wrote `state.invc = 0.5` left
// all 401 rows identical, because the 21 traced columns do not carry `invc`.
// That is the same hole CLAUDE.md records for party HP under `--keep-alive`.
// Hence the scalar sweep of `state` and `state.knight` at build time, before
// a single frame has run, where a stray write is still isolated.
// ---------------------------------------------------------------------------
{
  const scalars = (o) => {
    const out = {};
    for (const k of Object.keys(o ?? {}).sort()) {
      const v = o[k];
      const t = typeof v;
      if (t === 'number' || t === 'boolean' || t === 'string') out[k] = v;
    }
    return out;
  };
  const diffOf = (a, b) => {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return keys.filter((k) => a[k] !== b[k]).map((k) => `${k}(${a[k]}->${b[k]})`);
  };
  const built = (opts) => {
    const s = createState({ seed: 777 });
    s.keepAlive = true;
    buildSingleAttackScene(s, { seed: 777, attack: 'flurry', difficulty: 0, ...opts });
    return s;
  };

  const off = built({});
  const on = built({ holdBreath: true });

  check(!off.knight.holdbreathcount,
    `omitting holdBreath left holdbreathcount at ${off.knight.holdbreathcount} — the default is not OFF`);

  const topDiff = diffOf(scalars(off), scalars(on));
  check(topDiff.length === 0,
    `the switch wrote ${topDiff.length} scalar(s) on state itself: ${topDiff.join(', ')} — arming HoldBreath must touch the knight and nothing else`);

  const knightDiff = diffOf(scalars(off.knight), scalars(on.knight));
  check(knightDiff.join(', ') === 'holdbreathcount(0->1)',
    `the switch's footprint on the knight is [${knightDiff.join(', ')}], expected exactly holdbreathcount(0->1)`);

  // NOT `rngSnapshot`. That is mulberry32's snapshot — it returns `r.s`, which
  // a gmlRng does not have, so it reads 0 for EVERY gmlRng and comparing two
  // of them compares 0 against 0. Two sabotages walked through this check
  // while it was written that way. A gmlRng's position is its 16 words, its
  // index, the seed it was built from and the draw counter, so all four are
  // compared and none of them is a constant.
  const gmlSnap = (r) => `${[...r.state].join(',')}|${r.idx}|${r.seed}|${r.draws ?? 0}`;
  check(gmlSnap(off.gmlRng) === gmlSnap(on.gmlRng),
    `arming HoldBreath moved the RNG stream (${gmlSnap(off.gmlRng).slice(0, 40)}... vs ${gmlSnap(on.gmlRng).slice(0, 40)}...) — every bullet in the run would differ, and the fault would read as the attack being wrong`);

  const traceOf = (s) => {
    const rows = [traceHeader(s)];
    for (let f = 0; f < 400; f++) {
      stepFrame(s, wave(f, 'x'));
      rows.push(traceRow(s));
    }
    return rows.join('\n');
  };
  check(traceOf(built({ holdBreath: true })) !== traceOf(built({})),
    'holdBreath: true produced the same trace as OFF — the switch did nothing at all');
}

// ---------------------------------------------------------------------------
if (failures.length) {
  console.log(`FAIL — ${failures.length} check(s)`);
  for (const f of failures) console.log(`  * ${f}`);
  process.exit(1);
}
console.log('OK — SINGLE HOLDBREATH reaches the soul in every drill, survives the split and the repeats, and OFF is the untouched path');
