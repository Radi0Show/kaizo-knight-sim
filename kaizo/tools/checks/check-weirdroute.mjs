#!/usr/bin/env node
// KAIZO WEIRD ROUTE (B-Side) — the V-D GATE.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission. (kaizo/HANDOFF.md §5-C publish gate.)
//
// WHAT THIS IS. `kaizo/party/WEIRD-ROUTE.md` is the completeness spec for the
// mod's Weird Route; this file is its enforcement. Every assertion below is
// POSITIVE — it names a value the B-Side must produce, so deleting the
// translated delta (or letting version D drift back toward version C) fails
// loudly rather than silently passing.
//
// PROVENANCE — every asserted number was read out of the mod's own decompiled
// GML at knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/ :
//   gml_Object_obj_knight_enemy_Other_24.gml:343-350
//       the `if (k_sideb)` struct swaps — the ONLY five differences between
//       the A-Side and B-Side fight scripts.
//   gml_Object_obj_knight_enemy_Other_23.gml:11-668
//       kaizo_setAttack        (A-Side arenas + dispatch + <100 timer table)
//   gml_Object_obj_knight_enemy_Other_23.gml:670-1321
//       kaizo_setAttack_sideb  (B-Side arenas + dispatch; the leading
//                               scr_turntimer(240); the ac-112 arm)
//   gml_Object_obj_knight_enemy_Other_23.gml:1316-1319
//       `if (global.invc > 0.7) global.invc = 0.7;` — the B-Side mercy cap,
//       applied ONCE at the very end of the dispatch, after every arm.
//   gml_Object_obj_knight_enemy_Create_0.gml:115  `k_sideb = global.flag[456]`
//
// SCOPE NOTE. Sibling agents are translating the Noelle roster, k_freeze and
// the gloom/TP layer right now. This gate deliberately imports NOTHING from
// kaizo/party/ or any not-yet-written module: it asserts only over what is
// wired TODAY (kaizo/scenes/kaizo-fight.js version D, kaizo-vc-hooks.js,
// kaizo-mod-launcher.js, kaizo/versions/vc-script.js) plus the spec document
// this file ships with.
//
//   node kaizo/tools/checks/check-weirdroute.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';

import { createState, stepFrame } from '../../../sim/index.js';
import { destroy } from '../../../sim/entity.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { buildKaizoScene, KAIZO_VERSIONS } from '../../scenes/kaizo-fight.js';
import {
  launchVCAttack, openVCArena, vcTurnLength, vcSelfEnding } from '../../scenes/kaizo-mod-launcher.js';
import { VC_TABLE, VD_TABLE, VC_KNIGHT } from '../../versions/vc-script.js';
import { WEIRD_ROUTE_PARTY } from '../../party/roster.js';
import { kaizoVortexendFreeze } from '../../attacks/sword-vortex.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const KAIZO_ROOT = join(HERE, '..', '..');
const SPEC = join(KAIZO_ROOT, 'party', 'WEIRD-ROUTE.md');
const DUMP = join(homedir(), 'knight-research', 'kaizo-mod', 'gml_kaizo_dump', 'CodeEntries');

let failures = 0;
let checks = 0;

function ok(cond, label) {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.log(`  FAIL ${label}`);
  }
}

function eq(got, want, label) {
  checks += 1;
  if (got !== want) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}

console.log('check-weirdroute: the Kaizo B-Side (Weird Route) gate');

// ══════════════════════════════════════════════════════════════════════════
// 1. THE k_sideb STRUCT SWAPS — VD_TABLE differs from VC_TABLE in EXACTLY
//    the five fields obj_knight_enemy Other_24:343-350 changes, and nowhere
//    else. (Other_24 is one shared struct table; `if (k_sideb)` patches five
//    fields in place, so any sixth difference is a translation error.)
// ══════════════════════════════════════════════════════════════════════════

/** Other_24:343-350, verbatim. id -> { field: [A value, B value] }. */
const K_SIDEB_SWAPS = {
  atk_RisingAbyssB: { ac: [3, 101] },      // .attackChoice = 101   (l.345)
  atk_Swords1: { ac: [17, 112] },          // .attackChoice = 112   (l.346)
  atk_KnightGlow: {                        // .attackMsg            (l.347)
    msg: ['* Your mind grows hazy.', '* The air grows cold.'],
  },
  atk_RoaringDelta: {                      // .attackMsg            (l.348)
    msg: ['* The Knight\'s form becomes blinding. A strange energy fills the area...', '* ...'],
  },
  atk_Quickslash: { ac: [105, 105.1] },    // .attackChoice = 105.1 (l.349)
};

{
  const cRows = Object.values(VC_TABLE).flat();
  const dRows = Object.values(VD_TABLE).flat();
  eq(dRows.length, cRows.length, 'V-D has the same row count as V-C (one struct table, patched in place)');

  // Rows are positionally identical (same chain, same order).
  const cIds = cRows.map((r) => r.id).join('|');
  const dIds = dRows.map((r) => r.id).join('|');
  eq(dIds, cIds, 'V-D walks the same node ids in the same order as V-C');

  // Collect every field that actually differs.
  const observed = {};
  for (let i = 0; i < cRows.length; i++) {
    const a = cRows[i];
    const b = dRows[i];
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const av = JSON.stringify(a[key]);
      const bv = JSON.stringify(b[key]);
      if (av === bv) continue;
      (observed[a.id] ??= {})[key] = [a[key], b[key]];
    }
  }

  // Every expected swap is present, with the right before/after values.
  for (const [id, fields] of Object.entries(K_SIDEB_SWAPS)) {
    for (const [field, [want0, want1]] of Object.entries(fields)) {
      const got = observed[id]?.[field];
      ok(!!got, `k_sideb swaps ${id}.${field} (Other_24 sets it)`);
      if (got) {
        eq(got[0], want0, `${id}.${field} A-Side value`);
        eq(got[1], want1, `${id}.${field} B-Side value`);
      }
    }
  }
  // ... and NOTHING ELSE differs. This is the half that catches drift.
  const extras = [];
  for (const [id, fields] of Object.entries(observed)) {
    for (const field of Object.keys(fields)) {
      if (!K_SIDEB_SWAPS[id]?.[field]) extras.push(`${id}.${field}`);
    }
  }
  eq(extras.join(', '), '', 'V-D differs from V-C ONLY in the five k_sideb fields');

  // The three that change the FIGHT (the message pair is telegraph text).
  const dP1 = VD_TABLE[1];
  const dP2 = VD_TABLE[2];
  eq(dP1.find((r) => r.id === 'atk_RisingAbyssB').ac, 101,
    'B-Side Rising Abyss dispatches ac 101 (underbox 103 + sword-tunnel d10)');
  eq(dP1.find((r) => r.id === 'atk_Swords1').ac, 112,
    'B-Side Swords 1 dispatches ac 112 (tracking swords d11 — the frostveil)');
  eq(dP2.find((r) => r.id === 'atk_Quickslash').ac, 105.1,
    'B-Side Quickslash dispatches ac 105.1 (controller type 97.1, endtype 1)');
}

// ══════════════════════════════════════════════════════════════════════════
// 2. VERSION D BUILDS, STAMPS THE FLAG, AND STEPS DETERMINISTICALLY.
// ══════════════════════════════════════════════════════════════════════════

const idle = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};
function makeMenuInput() {
  let pulse = false;
  return (state) => {
    if (!state.menu?.open && !state.dialogue?.text && !state.pendingAct) return idle;
    pulse = !pulse;
    return { ...idle, confirm: pulse };
  };
}

{
  ok(!!KAIZO_VERSIONS.D, 'version D is registered');
  // THIS USED TO ASSERT THE LABEL SAID "B-SIDE" AND "WIP" — it pinned the
  // scaffolding vocabulary in place, so removing that vocabulary from the
  // shipped strings turned the check red even though nothing about the route
  // had changed. A display string is a weak invariant anyway. What actually
  // distinguishes D is its PARTY and its sideb branch, so assert those.
  ok(!/WIP|ORACLE/i.test(KAIZO_VERSIONS.D.name),
    `version D's name carries no build-status jargon ("${KAIZO_VERSIONS.D?.name}")`);
  eq(KAIZO_VERSIONS.D.party, WEIRD_ROUTE_PARTY,
    'version D is the two-member Weird Route party, and that is what names it');
  eq(KAIZO_VERSIONS.D.table, VD_TABLE, 'version D runs VD_TABLE');

  const runD = (seed) => {
    const st = createState({ seed, traceBulletSlots: 8 });
    st.traceWide = true;
    buildKaizoScene(st, { version: 'D' });
    const inp = makeMenuInput();
    for (let i = 0; i < 900; i++) stepFrame(st, inp(st));
    return st;
  };
  const d1 = runD(12345);
  const d2 = runD(12345);
  const d3 = runD(54321);

  eq(d1.frame, 900, 'version D stepped 900 frames');
  ok(d1.trace.length > 0, `version D produced a trace (${d1.trace.length} rows)`);
  ok(d1.kaizo.launched.length > 0,
    `version D launched inside 900 frames (${d1.kaizo.launched.length})`);
  eq(d1.trace.join('\n'), d2.trace.join('\n'), 'version D: same seed, byte-identical');
  ok(d1.trace.join('\n') !== d3.trace.join('\n'),
    'version D: different seed, different trace (non-vacuous)');

  // The flag the whole B-Side reads. kaizo-fight.js stamps it; every kaizo
  // attack module's `sideb()` helper returns state.kaizo.sideb.
  eq(d1.kaizo.sideb, true, 'version D stamps state.kaizo.sideb = true (k_sideb = global.flag[456])');
  const c1 = createState({ seed: 12345, traceBulletSlots: 0 });
  buildKaizoScene(c1, { version: 'C' });
  eq(c1.kaizo.sideb, false, 'version C stamps state.kaizo.sideb = false (the A-Side control)');

  // The mod's stat block reaches both versions (scr_monstersetup 104:
  // 10000 / 52 / 5 — the B-Side does NOT retune it).
  eq(d1.knight.hp > 0 && VC_KNIGHT.maxhp, 10000, 'B-Side Knight keeps the mod\'s 10000 HP');
  eq(VC_KNIGHT.at, 52, 'B-Side Knight keeps AT 52');
  eq(VC_KNIGHT.df, 5, 'B-Side Knight keeps DF 5');

  // The cross-module seam the B-Side ac-111 turn needs (rotating slash's
  // CleanUp freezes the vortex blades — kaizo_vortexend_step).
  eq(d1.kaizo.hooks?.vortexendHandoff, kaizoVortexendFreeze,
    'version D wires the ac-111 vortex-end handoff');
}

// ══════════════════════════════════════════════════════════════════════════
// 3. THE B-SIDE CHAIN ACTUALLY RUNS — the launch ledger walks VD_TABLE row
//    for row, including the three swapped nodes (101 / 112 / 105.1).
// ══════════════════════════════════════════════════════════════════════════

/** Run a whole 27-row chain and report the ledger + per-row invc peaks. */
function walkChain(version) {
  const st = createState({ seed: 12345, traceBulletSlots: 0 });
  buildKaizoScene(st, { version });
  const inp = makeMenuInput();
  const CHAIN = 27;
  const invcPeak = new Map();      // ledger index -> max invc seen while it ran
  const invcSeen = new Set();      // every invc value observed AFTER launch 1
  for (let f = 0; f < 45000 && st.kaizo.launched.length <= CHAIN; f++) {
    stepFrame(st, inp(st));
    // Keep the party up and the run alive; this gate is about dispatch, not
    // survival (same device verify-kaizo's chain walk uses).
    st.partyHp = st.partyHp.map(() => 100);
    st.gameOver = false;
    const n = st.kaizo.launched.length;
    if (n > 0 && typeof st.invc === 'number') {
      invcSeen.add(st.invc);
      const k = n - 1;
      const cur = invcPeak.get(k);
      if (cur === undefined || st.invc > cur) invcPeak.set(k, st.invc);
    }
  }
  return { st, invcPeak, invcSeen };
}

const D_WALK = walkChain('D');
const C_WALK = walkChain('C');

{
  const led = D_WALK.st.kaizo.launched;
  const chain = [...VD_TABLE[1], ...VD_TABLE[2], ...VD_TABLE[3]];
  ok(led.length >= chain.length,
    `version D launched all ${chain.length} chain rows (${led.length})`);
  let bad = null;
  for (let i = 0; i < Math.min(led.length, chain.length); i++) {
    if (led[i].ac !== chain[i].ac || led[i].difficulty !== chain[i].difficulty) {
      bad = `${i + 1}: expected ${chain[i].id} ac ${chain[i].ac} d${chain[i].difficulty}, `
        + `got ac ${led[i].ac} d${led[i].difficulty}`;
      break;
    }
  }
  eq(bad, null, 'the V-D launch ledger walks the B-Side chain row for row');

  // The three swapped nodes reached the LAUNCHER, not just the table.
  const acs = led.slice(0, chain.length).map((r) => r.ac);
  ok(acs.includes(101), 'the B-Side actually launched ac 101 (Rising Abyss B)');
  ok(acs.includes(112), 'the B-Side actually launched ac 112 (Swords 1 B / frostveil)');
  ok(acs.includes(105.1), 'the B-Side actually launched ac 105.1 (Quickslash B)');
  // ... and the A-Side variants they replaced are GONE from the B-Side run.
  ok(!acs.includes(3), 'ac 3 (A-Side Rising Abyss) never runs on the B-Side');
  ok(!acs.includes(17), 'ac 17 (A-Side Swords 1) never runs on the B-Side');
  ok(!acs.includes(105), 'ac 105 (A-Side Quickslash) never runs on the B-Side');
  // Control: the A-Side run has exactly the opposite membership.
  const cAcs = C_WALK.st.kaizo.launched.slice(0, chain.length).map((r) => r.ac);
  ok(cAcs.includes(3) && cAcs.includes(17) && cAcs.includes(105),
    'the A-Side run does launch 3 / 17 / 105 (the swap is real, not vacuous)');
  ok(!cAcs.includes(101) && !cAcs.includes(112) && !cAcs.includes(105.1),
    'the A-Side run never launches 101 / 112 / 105.1');

  ok(D_WALK.st.kaizo.approx.every((a) => a.why !== 'unknown type'),
    'no B-Side launch hit an unknown controller type');
}

// ══════════════════════════════════════════════════════════════════════════
// 4. THE invc 0.7 CAP — Other_23:1316-1319.
//
//    `if (global.invc > 0.7) global.invc = 0.7;` runs ONCE, at the bottom of
//    kaizo_setAttack_sideb, after every arm has assigned. So an arm that asks
//    for 1 lands on 0.7 (30% less i-frames after every hit) while an arm
//    already under the cap is untouched. Both halves are asserted: a cap that
//    also pinned the low values would pass the first half alone.
// ══════════════════════════════════════════════════════════════════════════

/** A fight-shaped state with no director, ready for a direct launcher call. */
function bench(sideb) {
  const st = createState({ seed: 4242, traceBulletSlots: 0 });
  buildSingleAttackScene(st, { seed: 4242, attack: 'rotating-slash', difficulty: 0 });
  const dir = st.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  st.kaizo = {
    version: sideb ? 'D' : 'C', sideb, approx: [], launched: [], vars: {}, hooks: {},
  };
  return st;
}

/** global.invc after one dispatch of `row` on the named side. */
function invcAfter(row, sideb) {
  const st = bench(sideb);
  st.invc = -999; // poison: a branch that never assigns is visible, not "1"
  launchVCAttack(st, row, { sideb });
  return st.invc;
}

{
  // (a) arms that ask for MORE than the cap.
  //     ac 5   Multislash    global.invc = 1  twice   (Other_23:271-272 / 382-383)
  //     ac 1   Starstorm     global.invc = 1          (Other_23 case 1)
  //     ac 101 Rising Abyss  global.invc = 1          (Other_23:423 sideb arm)
  //     ac 14  Swords 3      global.invc = 0.8 twice  (Other_23:394-401 / 409-410)
  for (const [ac, phase, asked] of [[5, 1, 1], [1, 1, 1], [101, 1, 1], [14, 3, 0.8]]) {
    const row = { id: `probe_${ac}`, ac, phase, difficulty: 0 };
    eq(invcAfter(row, false), asked,
      `A-Side ac ${ac} sets global.invc = ${asked} (uncapped)`);
    eq(invcAfter(row, true), 0.7,
      `B-Side ac ${ac} asks ${asked} and the 0.7 cap CLAMPS it`);
  }

  // (b) arms already at or under the cap PASS THROUGH untouched — the cap is
  //     a ceiling, not a pin. (ac 102 Frenzy 2 = 0.66; ac 104 Roaring DELTA =
  //     0.5; ac 112 Swords 1 B = 0.4.)
  for (const [ac, phase, want] of [[102, 2, 0.66], [104, 4, 0.5], [112, 1, 0.4]]) {
    const row = { id: `probe_${ac}`, ac, phase, difficulty: 0 };
    eq(invcAfter(row, true), want,
      `B-Side ac ${ac} keeps global.invc = ${want} (already under the cap)`);
  }

  // (c) whole-run: across the entire 27-row B-Side chain, no launched turn
  //     ever ran above 0.7 — and 0.7 IS observed, so the cap fired.
  const dVals = [...D_WALK.invcSeen].sort((x, y) => x - y);
  const cVals = [...C_WALK.invcSeen].sort((x, y) => x - y);
  eq(Math.max(...dVals), 0.7,
    `over the whole B-Side chain global.invc never exceeds 0.7 (saw ${JSON.stringify(dVals)})`);
  ok(dVals.includes(0.7),
    'the B-Side chain actually reaches the cap (it is not merely all-low)');
  eq(Math.max(...cVals), 1,
    `the A-Side chain reaches 1 for the same rows (saw ${JSON.stringify(cVals)})`);
  ok(cVals.includes(0.8) && !dVals.includes(0.8),
    'A-Side 0.8 (Swords 3) does not survive onto the B-Side');
}

// ══════════════════════════════════════════════════════════════════════════
// 5. B-SIDE ARENA GEOMETRY — kaizo_setAttack_sideb's arg0 == 0 block
//    (Other_23:672-829) against kaizo_setAttack's (Other_23:13-162).
//    Seven attack choices get a different board; everything else is shared.
// ══════════════════════════════════════════════════════════════════════════

/** Open the arena for (ac, phase) on one side and read the growtangle back. */
function arena(ac, phase, sideb) {
  const st = bench(sideb);
  openVCArena(st, { id: `probe_${ac}`, ac, phase, difficulty: 0 }, { sideb });
  const gt = st.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
  return {
    xs: gt.maxxscale,
    ys: gt.maxyscale,
    dx: gt.x - st.view.x,
    dy: gt.y - st.view.y,
    keep: gt.keep,
    megakeep: gt.megakeep,
  };
}

{
  // ── the seven that DIFFER, each with both sides pinned ──────────────────
  // ac 0  CrescentSlash : maxxscale 0.8 -> 0.6              (l.40  / l.699)
  eq(arena(0, 1, false).xs, 0.8, 'A-Side ac 0 arena xscale 0.8');
  eq(arena(0, 1, true).xs, 0.6, 'B-Side ac 0 arena xscale 0.6 (a QUARTER narrower box)');
  // ac 1  Starstorm     : maxyscale 1.75 -> 1.5             (l.47  / l.706)
  eq(arena(1, 1, false).ys, 1.75, 'A-Side ac 1 arena yscale 1.75');
  eq(arena(1, 1, true).ys, 1.5, 'B-Side ac 1 arena yscale 1.5 (shorter Starstorm box)');
  // ac 12 DiamondStorm  : maxyscale unset (2) -> 1.4         (l.64  / l.723)
  eq(arena(12, 1, false).ys, 2, 'A-Side ac 12 arena keeps the default yscale 2');
  eq(arena(12, 1, true).ys, 1.4, 'B-Side ac 12 arena yscale 1.4 (letterboxed diamond storm)');
  // ac 14 Swords3       : 1.75/1.75 -> 1.5/1.5              (l.75  / l.735)
  eq(`${arena(14, 3, false).xs}x${arena(14, 3, false).ys}`, '1.75x1.75', 'A-Side ac 14 arena 1.75x1.75');
  eq(`${arena(14, 3, true).xs}x${arena(14, 3, true).ys}`, '1.5x1.5', 'B-Side ac 14 arena 1.5x1.5');
  // ac 17 Swords1       : 1/1 -> 0.8/0.8                     (l.84  / l.744)
  //   (A-Side only in practice — the B-Side swaps Swords1 to ac 112 — but the
  //    geometry table still carries it, so it is asserted as written.)
  eq(`${arena(17, 1, false).xs}x${arena(17, 1, false).ys}`, '1x1', 'A-Side ac 17 arena 1x1');
  eq(`${arena(17, 1, true).xs}x${arena(17, 1, true).ys}`, '0.8x0.8', 'B-Side ac 17 arena 0.8x0.8');
  // ac 101 RisingAbyssB : y -= 64 -> y -= 56, PLUS keep/megakeep (l.94 / l.754)
  eq(arena(101, 1, false).dy, 170 - 64, 'A-Side ac 101 arena sits 64px high');
  eq(arena(101, 1, true).dy, 170 - 56, 'B-Side ac 101 arena sits 56px high (8px lower)');
  eq(arena(101, 1, false).keep, 0, 'A-Side ac 101 board does not persist');
  eq(arena(101, 1, true).keep, 1, 'B-Side ac 101 board sets keep');
  eq(arena(101, 1, true).megakeep, 1, 'B-Side ac 101 board sets megakeep');
  // ac 112 Swords1-B    : B-SIDE ONLY, 2.5/2.5               (l.790)
  eq(`${arena(112, 1, true).xs}x${arena(112, 1, true).ys}`, '2.5x2.5',
    'B-Side ac 112 arena 2.5x2.5 (exists only in kaizo_setAttack_sideb)');
  eq(`${arena(112, 1, false).xs}x${arena(112, 1, false).ys}`, '2x2',
    'ac 112 has no A-Side entry, so it falls to the default 2x2 board');

  // ── everything ELSE is byte-identical between the two tables ────────────
  const SHARED = [[4, 1], [10, 1], [11, 1], [13, 1], [13, 2], [15, 2], [20, 3],
    [102, 2], [103, 3], [107, 3], [110, 2], [111, 3]];
  const drifted = [];
  for (const [ac, phase] of SHARED) {
    const a = JSON.stringify(arena(ac, phase, false));
    const b = JSON.stringify(arena(ac, phase, true));
    if (a !== b) drifted.push(`ac ${ac} p${phase}: A ${a} vs B ${b}`);
  }
  eq(drifted.join(' | '), '', 'every other arena is shared between the two dispatch tables');

  // The position rules are shared too (ac 0 offset, ac 11/13 y=190).
  eq(arena(0, 1, true).dx, 300 - 152, 'B-Side ac 0 board still opens at (300-152, 170)');
  eq(arena(11, 1, true).dy, 190, 'B-Side ac 11 board still opens at y 190');
  eq(arena(13, 1, true).dx, 300, 'B-Side ac 13 (phase != 2) board still opens at x 300');
}

// ══════════════════════════════════════════════════════════════════════════
// 6. B-SIDE TURN CLOCKS. kaizo_setAttack_sideb opens with an unconditional
//    scr_turntimer(240) (Other_23:833) and REPLACES the A-Side's trailing
//    `if (myattackchoice < 100)` table (Other_23:612-666) with per-arm calls.
//    Two visible consequences, both asserted:
//      * ac >= 100 arms get a 240 floor on the B-Side and NONE on the A-Side.
//      * three arms carry a different explicit floor.
// ══════════════════════════════════════════════════════════════════════════

{
  const len = (ac, phase, sideb) => vcTurnLength({ id: 'probe', ac, phase, difficulty: 0 }, { sideb });

  // The leading 240 reaches an arm the A-Side's <100 table cannot cover.
  eq(len(110, 2, false), 0, 'A-Side ac 110 (PierceBlades) gets NO scr_turntimer floor');
  eq(len(110, 2, true), 240, 'B-Side ac 110 inherits the leading scr_turntimer(240)');

  // Explicit per-arm floors that differ.
  eq(len(11, 1, false), 292, 'A-Side ac 11 clock 292');
  eq(len(11, 1, true), 300, 'B-Side ac 11 clock 300');
  eq(len(13, 1, false), 450, 'A-Side ac 13 phase 1 clock 450');
  eq(len(13, 1, true), 470, 'B-Side ac 13 phase 1 clock 470 (20 frames longer)');
  eq(len(112, 1, true), 460, 'B-Side ac 112 clock 460 (Other_23:1314)');

  // THE "15.1 TIMER BUG" IS NOT A BUG — RETRACTED, and pinned here so it
  // cannot be re-introduced as a "fix". deltas/INDEX.md §2 and open question
  // 8 claim the A-Side's trailing `<100` table stomps ac 15.1's 450 down to
  // 240 while the B-Side keeps 450. It cannot: scr_turntimer only ever
  // RAISES (gml_GlobalScript_scr_turntimer.gml:3 — `if (global.turntimer <
  // arg0) global.turntimer = arg0;`), so the tail's 240 is a no-op against
  // the arm's own 450 (Other_23:417 A-Side / :1110 B-Side). Both sides: 450.
  eq(len(15.1, 2, false), 450, 'A-Side ac 15.1 clock 450 (the <100 tail cannot lower it)');
  eq(len(15.1, 2, true), 450, 'B-Side ac 15.1 clock 450 — identical, NOT a side difference');

  // Self-ending (PINNER) arms are identical on both sides — the controllers
  // release their own clock, so neither table's floor matters.
  // vcTurnLength answers the arm's floor now (the pin is the attack object's,
  // a frame later), and the two tables' floors may differ for a self-ending
  // arm without either mattering; the self-ending PROPERTY is what is
  // identical on both sides.
  const sel = (ac, phase, sideb) => vcSelfEnding({ id: 'probe', ac, phase, difficulty: 0 }, { sideb });
  for (const [ac, phase] of [[5, 1], [102, 2], [104, 4], [106, 3], [111, 3], [15, 2]]) {
    ok(sel(ac, phase, true) && sel(ac, phase, false),
      `ac ${ac} is self-ending on both sides (clock pinned by the attack object)`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 7. THE SPEC DOCUMENT. kaizo/party/WEIRD-ROUTE.md is half of this work item;
//    the gate fails if it is deleted, unlabelled, or cites GML that is not in
//    the dump. (The dump lives in the private research repo — when it is
//    absent the citation half skips cleanly, exactly like verify-kaizo's
//    chain-integrity block.)
// ══════════════════════════════════════════════════════════════════════════

{
  ok(existsSync(SPEC), 'kaizo/party/WEIRD-ROUTE.md exists');
  if (existsSync(SPEC)) {
    const md = readFileSync(SPEC, 'utf8');
    ok(/do not publish\s*\n?\/*\s*without permission/i.test(md.replace(/\s+/g, ' '))
      || /do not publish without permission/i.test(md.replace(/\s+/g, ' ')),
    'the spec carries the V-C/V-D publish gate');
    ok(/EnderCat8/.test(md), 'the spec credits EnderCat8');
    for (const heading of ['ALREADY TRANSLATED', 'BEING BUILT NOW', 'NOT YET BUILT']) {
      ok(md.includes(heading), `the spec has its "${heading}" inventory section`);
    }
    ok(/flag\[456\]/.test(md), 'the spec answers how a player ENTERS the Weird Route (flag[456])');
    ok(/0\.7/.test(md) && /invc/.test(md), 'the spec covers the invc 0.7 cap');
    ok(/105\.1/.test(md) && /112/.test(md) && /101/.test(md),
      'the spec names the three k_sideb attack swaps');

    // Every `gml_*.gml` the spec cites must be a real file in the dump.
    const cited = [...new Set(md.match(/gml_[A-Za-z0-9_.]+\.gml/g) ?? [])];
    ok(cited.length >= 20, `the spec cites GML files (${cited.length} distinct)`);
    if (existsSync(DUMP)) {
      const missing = cited.filter((f) => !existsSync(join(DUMP, f)));
      eq(missing.join(', '), '', 'every GML file the spec cites exists in the kaizo dump');
    } else {
      console.log('  --  kaizo dump absent (private research repo); citation check skipped');
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════

console.log(`check-weirdroute: ${checks - failures}/${checks} assertions passed`);
if (failures > 0) {
  console.log(`check-weirdroute: FAILED (${failures})`);
  process.exit(1);
}
console.log('check-weirdroute: green');
process.exit(0);
