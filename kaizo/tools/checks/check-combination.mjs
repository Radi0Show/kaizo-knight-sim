#!/usr/bin/env node
// KAIZO V-C combination chain (dc type 105) — positive assertions on every
// branch kaizo/attacks/combination.js adds, against the mod's own GML.
//
// PUBLISH GATE: V-C recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 —
// do not publish without permission (kaizo/HANDOFF.md §5-C).
//
// What this pins. Each block FAILS if its branch is deleted:
//
//   T1  THE TWO ORDERS. Other_23 dispatches type 105 twice with different
//       Knight fields — ac 7 (4,2,3) and ac 106 (1,2,5) — and both side-B
//       arms repeat them. combo_power is 1 in both, so both take the
//       three-segment "short" form.
//   T2  PARAMETERISATION, the whole point: launching with order 106 starts
//       the chain on obj_roaringknight_quickslash_attack carrying next_up 2
//       / next_next_up 5, and with order 7 on obj_knight_swordfall carrying
//       2 / 3. A module constant cannot do that — delete the parameter and
//       both give the same first segment.
//   T3  THE DEAD SHUFFLE. The permutation is discarded and the DRAWS are
//       not: the launch advances the stream by exactly what gmlShuffle over
//       four elements costs, and the segment order is bit-identical across
//       two different seeds.
//   T4  PROMOTION BY SEGMENT, not by next_up — 0 -> "short mid" (and only
//       then does next_up become next_next_up), 1 -> "short end", -1 ->
//       "end", the two-attack form.
//   T5  THE 1-2-5 WALK through the real handoff sites: quickslash Step_0's
//       fork into the rotating slash (timer 4, warp, the outgoing
//       controller frozen at slash_count 999), then rotating Step_0's
//       next_up==5 block into the underbox with init_start 4 / init 8 and
//       the CHAINED "short end" arm (local_turntimer 170, image_index 5) —
//       not underbox.js's "full" arm (340, x += 200).
//   T6  THE 4-2-3 WALK, through the sites the MODULES ACTUALLY CALL:
//       swordfall Alarm_3 into the rotating slash (no warp for id 2), then
//       rotating Alarm_2 into the revised tunnel slasher — which is the KAIZO
//       module, and whose "short end" arm ran.
//
//       WHAT CHANGED 2026-08-29, part two. This walk used to hand segment
//       2 -> 3 through 'rotating_step', the mod's mid-PATTERN early-spawn
//       block. kaizo/attacks/rotating-slash.js carries Alarm_2 only, so the
//       walk under test was not the walk the fight takes — and asserting
//       "short end" against it hid the one place in either dump where the
//       shared promotion does not apply. T6 now walks Alarm_2, and T6b holds
//       the early block on its own terms.
//
//       WHAT CHANGED IN T6, 2026-08-29, and why this is not an assertion
//       edited to fit a change. Until today `KAIZO_COMBO_ATTACKS[3]` pointed
//       at sim/attacks/sword-tunnel-revised.js, and T6 asserted that twice
//       over: `source === 'sim'`, and that kaizoChainNext ledgers the
//       substitution. Both were true statements about a KNOWN DEFECT. The
//       recording says the mod's segment-3 blades fan — 17 distinct
//       directions over 138.61..243.85 on route C, 23 over 137.65..246.03 on
//       route D — where the sim module gives one flat 180, because its blade
//       spawner writes `vspeed` to a plain JS property that nothing reads
//       back. kaizo/attacks/sword-tunnel-revised.js fixes that and carries
//       the mod's ten deltas, so the registry now points there.
//
//       So the OLD assertions were pinning the defect, and the honest
//       replacement is not to delete them but to INVERT them: T6 now requires
//       segment 3 to be the kaizo type BY IDENTITY (the same test T5 already
//       makes of segment 2), and requires the approx ledger to stay EMPTY of
//       any "not translated" row for this chain — the confession has to be
//       gone, not merely unread. A revert of the registry fails both.
//   T6b ROTATING_STEP's ID-3 ARM, the exception. Step_0:120-124 promotes
//       segment 1 to "short mid", not the "short end" every other handoff in
//       both dumps writes, and a trailing block then sets timer -12 and adds
//       12 to local_turntimer. Transcribed and pinned rather than "corrected";
//       the block is byte-identical in vanilla, and the turn still ends
//       because a last segment's Create `next_up = -1` puts it into the
//       tunnel's "final" state, which hands global.turntimer its -1 without
//       CleanUp's help. NOT on the shipped chain — see the module's Alarm_2.
//
//   T7  INDEX ITEM 13's SWORDFALL-d5 HYPOTHESIS, disproved by execution:
//       sub-attack 5 is the underbox, and a chained swordfall inherits
//       damage but NOT difficulty, so it is d0 even from a d5 parent.
//   T8  THE SWITCHES' MISSING CASES are faithful: rotating->2, underbox->5
//       and swordfall->4 create nothing (the GML's `instance_create(x, y,
//       -4)`) and ledger instead of silently chaining.
//   T9  ISOLATION: the sim's shared COMBO_ATTACKS registry still points at
//       sim modules after this one is imported.
//   T10 A DEAD END ENDS THE TURN (turntimer -1) instead of hanging at the
//       controller's 999999.
//   T11 THE SEAM — `state.kaizo.hooks.comboChainNext`, which is what makes
//       any of the above reach a shipped build. Four claims: hookless plus a
//       site name is still the VANILLA chain (a); the hook routes here with
//       the site name intact (b); a call with NO site name — every call
//       inside sim/ — is never redirected, so a half-landed wiring cannot
//       half-convert a vanilla chain (c); and each kaizo segment module
//       really passes its own site, DRIVEN through the real alarm and Step
//       bodies rather than read off a comment (d). Then the whole 4-2-3 walk
//       end to end, by identity, ledgering nothing — against the same walk
//       without the hook, which still falls back to two sim bodies.
//
//     node kaizo/tools/checks/check-combination.mjs      exit 0 / 1

import { createState } from '../../../sim/index.js';
import { spawn, destroy } from '../../../sim/entity.js';
import { buildSingleAttackScene } from '../../../sim/scenes/single.js';
import { gmlCreate, gmlU32, gmlShuffle } from '../../../sim/rng.js';
import {
  KAIZO_COMBO_ATTACKS, KAIZO_COMBO_ORDERS, KAIZO_COMBO_CREATE_DEFAULTS,
  KAIZO_CHAIN_SITES, kaizoComboOrderFor, kaizoComboSequence, kaizoComboPromote,
  kaizoChainNext, launchKaizoCombination,
} from '../../attacks/combination.js';
// The SIM registry, for the isolation assertion — imported by identity so a
// stray registerComboAttack anywhere in kaizo/ would fail T9 outright.
// `chainNext` comes with it: T11 holds the seam's two directions against each
// other, and the vanilla function is one of them.
import {
  COMBO_ATTACKS as SIM_COMBO_ATTACKS, chainNext,
} from '../../../sim/attacks/combination.js';
import { rotatingSlash as SIM_ROTATING } from '../../../sim/attacks/rotating-slash.js';
import { knightSwordfall as SIM_SWORDFALL } from '../../../sim/attacks/swordfall.js';
import { rotatingSlash as KAIZO_ROTATING } from '../../attacks/rotating-slash.js';
import { knightSwordfall as KAIZO_SWORDFALL } from '../../attacks/swordfall.js';
import { quickslashAttack } from '../../attacks/quickslash.js';
// Both revised tunnel slashers, so T6 can say WHICH one it walked into by
// identity. They share a type.name, which is exactly why a name test is not
// enough.
import { tunnelSlasher2 as SIM_TUNNEL } from '../../../sim/attacks/sword-tunnel-revised.js';
import { tunnelSlasher2 as KAIZO_TUNNEL } from '../../attacks/sword-tunnel-revised.js';

let failures = 0;
let checks = 0;

function assert(cond, label) {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.log(`  FAIL ${label}`);
  }
}

function assertEq(got, want, label) {
  checks += 1;
  if (got !== want) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}

/**
 * A fight-shaped scene (knight, party, board, soul) with the practice
 * director removed so nothing auto-launches — the same shape check-underbox
 * builds, and the same reason.
 */
function scene({ seed = 12345, ac = 106, sideb = false } = {}) {
  const state = createState({ seed });
  buildSingleAttackScene(state, { seed, attack: 'combination', difficulty: 0 });
  const dir = state.entities.find((e) => e.alive && e.type.name === 'practice_director');
  if (dir) destroy(dir);
  state.kaizo = { sideb, approx: [] };
  state.currentAc = ac;
  state.gmlRng = gmlCreate(seed);
  return state;
}

function live(state, name) {
  return state.entities.filter((e) => e.alive && e.type.name === name);
}

// ── T1 — the two orders ────────────────────────────────────────────────────
{
  assertEq(JSON.stringify(KAIZO_COMBO_ORDERS[7]),
    JSON.stringify({ first: 4, second: 2, third: 3, power: 1 }),
    'T1: ac 7 (Frenzy 1) is 4-2-3, Other_23:285-287');
  assertEq(JSON.stringify(KAIZO_COMBO_ORDERS[106]),
    JSON.stringify({ first: 1, second: 2, third: 5, power: 1 }),
    'T1: ac 106 (Frenzy 3) is 1-2-5, Other_23:555-557');
  assertEq(JSON.stringify(KAIZO_COMBO_CREATE_DEFAULTS),
    JSON.stringify({ first: 4, second: 2, third: 3, power: 1 }),
    'T1: the Knight Create defaults are still 4-2-3 / combo_power 1');
  // An unknown ac falls back to the Create defaults — what a dispatch that
  // never wrote the fields would produce.
  assertEq(kaizoComboOrderFor(999).first, 4, 'T1: unknown ac falls back to Create default 4');
  assertEq(kaizoComboSequence(kaizoComboOrderFor(106)).join(' -> '),
    'obj_roaringknight_quickslash_attack -> obj_knight_rotating_slash'
    + ' -> obj_knight_weird_bottom_manager',
    'T1: the 1-2-5 chain names');
  assertEq(kaizoComboSequence(kaizoComboOrderFor(7)).join(' -> '),
    'obj_knight_swordfall -> obj_knight_rotating_slash'
    + ' -> obj_knight_tunnel_slasher_2_revised',
    'T1: the 4-2-3 chain names');
  // The object indices the handoff switches use (kaizo values; vanilla's
  // 367/672/806/1175 are the same objects before the mod's additions).
  assertEq(KAIZO_COMBO_ATTACKS[1].objectIndex, 366, 'T1: 366 = quickslash_attack');
  assertEq(KAIZO_COMBO_ATTACKS[2].objectIndex, 669, 'T1: 669 = rotating_slash');
  assertEq(KAIZO_COMBO_ATTACKS[3].objectIndex, 802, 'T1: 802 = tunnel_slasher_2_revised');
  assertEq(KAIZO_COMBO_ATTACKS[4].objectIndex, 630, 'T1: 630 = swordfall');
  assertEq(KAIZO_COMBO_ATTACKS[5].objectIndex, 1173, 'T1: 1173 = weird_bottom_manager');
}

// ── T2 — parameterisation ──────────────────────────────────────────────────
{
  const a = scene({ ac: 106 });
  const knightA = a.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy');
  const first106 = launchKaizoCombination(a, kaizoComboOrderFor(106));
  assert(!!first106, 'T2: ac 106 launches a first segment');
  assertEq(first106.type.name, 'obj_roaringknight_quickslash_attack',
    'T2: ac 106 segment 1 is the QUICKSLASH, not the vanilla swordfall');
  assertEq(first106.turn_type, 'short start', 'T2: combo_power 1 => "short start"');
  assertEq(first106.turn_segment, 0, 'T2: combo_power 1 => turn_segment 0');
  assertEq(first106.next_up, 2, 'T2: next_up = second_attack');
  assertEq(first106.next_next_up, 5, 'T2: next_next_up = third_attack');
  assertEq(a.turntimer, 999999, 'T2: type 105 pins the clock at 999999');
  assertEq(knightA ? knightA.image_alpha : null, 0, 'T2: the Knight is hidden by the controller');
  assertEq(a.kaizoComboSegments, 1, 'T2: one segment launched');
  assertEq(JSON.stringify(a.kaizoComboOrder), '[1,2,5]', 'T2: the order is recorded on state');
  // The quickslash's own Other_10 "short start" arm ran (spawn_speed 12,
  // local_turntimer 160) — proof that event_user(0) reached the module.
  assertEq(first106.local_turntimer, 160, 'T2: quickslash "short start" arm ran (160)');
  assertEq(first106.spawn_speed, 12, 'T2: quickslash "short start" spawn_speed 12');

  const b = scene({ ac: 7 });
  const first7 = launchKaizoCombination(b, kaizoComboOrderFor(7));
  assertEq(first7.type.name, 'obj_knight_swordfall', 'T2: ac 7 segment 1 is the swordfall');
  assertEq(first7.next_up, 2, 'T2: ac 7 next_up 2');
  assertEq(first7.next_next_up, 3, 'T2: ac 7 next_next_up 3');
  // swordfall's own Other_10 "short start" arm: local_turntimer 70,
  // countdowner 10, turn_time 40.
  assertEq(first7.local_turntimer, 70, 'T2: swordfall "short start" arm ran (70)');
  assertEq(first7.countdowner, 10, 'T2: swordfall "short start" countdowner 10');

  // THE DISCRIMINATOR: the two launches differ only in the order argument,
  // and they produce different first segments.
  assert(first106.type.name !== first7.type.name,
    'T2: the two dispatched orders must not collapse to one chain');
}

// ── T3 — the dead shuffle ──────────────────────────────────────────────────
{
  // What gmlShuffle over four elements costs on the shared helper: the
  // measured 16 u32 per element (CLAUDE.md) and nothing after it.
  const probe = gmlCreate(4242);
  let cost = 0;
  {
    const a = gmlCreate(4242);
    const b = gmlCreate(4242);
    gmlShuffle(a, [2, 3, 4, 5]);
    while (b.i !== a.i || b.state.some((v, k) => v !== a.state[k])) {
      gmlU32(b);
      cost += 1;
      if (cost > 4096) break;
    }
  }
  // the cost is the MEASURED TOTAL, 16 u32 per element and nothing after it
  // (traces/shuffle-probe.csv: 64 for n=4, 96 for n=6, 208 for n=13, constant
  // across seeds, against a zero-draw control). This used to assert 64 + 3,
  // pinning the extra draws gmlShuffle took for its OWN permutation -- harmless
  // while every caller replayed a pinned order, and wrong the moment the kaizo
  // lane shuffled live: two rotating-slash managers shuffling a two-element list
  // on one frame cost 33 each against the game's 32 (probe recording, oracle
  // f2620). Removing the extra draws moved the kaizo whole-fight byte gate
  // f2632 -> f3709, which is the receipt that 16n is the whole cost.
  assertEq(cost, 4 * 16,
    'T3: the discarded shuffle costs 16 u32/element and nothing after it');
  gmlU32(probe); // keep the probe used, so a dead local cannot hide a typo

  // The launch advances the stream by exactly that, and by nothing else:
  // obj_knight_combinations rolls nothing of its own.
  const s = scene({ ac: 106, seed: 777 });
  const mirror = gmlCreate(777);
  launchKaizoCombination(s, kaizoComboOrderFor(106));
  let advanced = 0;
  while (mirror.i !== s.gmlRng.i || mirror.state.some((v, k) => v !== s.gmlRng.state[k])) {
    gmlU32(mirror);
    advanced += 1;
    if (advanced > 4096) break;
  }
  assertEq(advanced, 4 * 16,
    'T3: launchKaizoCombination consumes the shuffle and nothing more');

  // …and the ORDER does not depend on the stream at all.
  const s1 = scene({ ac: 106, seed: 1 });
  const s2 = scene({ ac: 106, seed: 99999 });
  const f1 = launchKaizoCombination(s1, kaizoComboOrderFor(106));
  const f2 = launchKaizoCombination(s2, kaizoComboOrderFor(106));
  assert(f1.type.name === f2.type.name && f1.next_up === f2.next_up
    && f1.next_next_up === f2.next_next_up,
    'T3: two different seeds give the identical segment order');
}

// ── T4 — promotion by segment ──────────────────────────────────────────────
{
  const mk = (seg, nextNext) => ({
    turn_segment: seg, next_next_up: nextNext, anchor_x: 11, anchor_y: 22,
  });
  const n0 = kaizoComboPromote(mk(0, 5), { next_up: 2 });
  assertEq(n0.turn_type, 'short mid', 'T4: segment 0 promotes its successor to "short mid"');
  assertEq(n0.turn_segment, 1, 'T4: …and to turn_segment 1');
  assertEq(n0.next_up, 5, 'T4: …and hands it next_next_up (5), not its own next_up');
  assertEq(n0.anchor_x, 11, 'T4: the anchor is copied');

  const n1 = kaizoComboPromote(mk(1, 5), { next_up: 5 });
  assertEq(n1.turn_type, 'short end', 'T4: segment 1 promotes to "short end"');
  assertEq(n1.turn_segment, 2, 'T4: …and to turn_segment 2');
  assertEq(n1.next_up, 5, 'T4: …and does NOT rewrite next_up');

  // turn_segment -1 is "this attack does not know it is in a combination" —
  // the two-attack form, which composition 1 never produces.
  // turn_segment -1 on the successor is its own Create default — promote
  // must leave it there, which is what makes the two-attack form two.
  const nm = kaizoComboPromote(mk(-1, 5), { next_up: 2, turn_segment: -1 });
  assertEq(nm.turn_type, 'end', 'T4: an unaware segment hands on "end"');
  assertEq(nm.turn_segment, -1, 'T4: …and leaves turn_segment alone');
  assertEq(nm.next_up, 2, 'T4: …and does not rewrite next_up either');
}

// ── T5 — the 1-2-5 walk ────────────────────────────────────────────────────
{
  const s = scene({ ac: 106 });
  const seg1 = launchKaizoCombination(s, kaizoComboOrderFor(106));
  const warpsBefore = live(s, 'obj_knight_warp').length;

  // quickslash Step_0:60-148's own writes on the OUTGOING controller.
  KAIZO_CHAIN_SITES.quickslash_step.self(seg1, seg1.next_up);
  assertEq(seg1.done, true, 'T5: the quickslash marks itself done');
  assertEq(seg1.local_turntimer, 99999, 'T5: …freezes its clock');
  assertEq(seg1.slash_count, 999, 'T5: …slash_count 999 for a rotating-slash successor');
  assertEq(seg1.nodraw, true, 'T5: …and goes nodraw');
  assertEq(seg1.auto, false, 'T5: …and stops driving itself');

  const seg2 = kaizoChainNext(s, seg1, 'quickslash_step');
  assert(!!seg2, 'T5: the quickslash hands on');
  assertEq(seg2.type.name, 'obj_knight_rotating_slash', 'T5: segment 2 is the rotating slash');
  assert(seg2.type === KAIZO_ROTATING, 'T5: …the KAIZO module, not the sim one');
  assertEq(seg2.turn_type, 'short mid', 'T5: segment 2 is "short mid"');
  assertEq(seg2.turn_segment, 1, 'T5: segment 2 turn_segment 1');
  assertEq(seg2.next_up, 5, 'T5: segment 2 carries next_up 5 (the underbox)');
  assertEq(seg2.timer, 4, 'T5: `knight_stream.timer = 4` for the 669 successor');
  assertEq(seg2.local_turntimer, 260, 'T5: rotating "short mid" arm ran (260)');
  assertEq(seg2.turn_limit_4, 250, 'T5: …and its turn_limit_4 dropped to 250');
  assertEq(seg1.next_up, -999, 'T5: the handoff is one-shot (next_up -> -999)');
  assert(live(s, 'obj_knight_warp').length > warpsBefore,
    'T5: a warp arrives with the rotating slash (the 1173 case is the exception)');

  const seg3 = kaizoChainNext(s, seg2, 'rotating_step');
  assert(!!seg3, 'T5: the rotating slash hands on');
  assertEq(seg3.type.name, 'obj_knight_weird_bottom_manager', 'T5: segment 3 is the underbox');
  assertEq(seg3.turn_type, 'short end', 'T5: segment 3 is "short end"');
  assertEq(seg3.turn_segment, 2, 'T5: segment 3 turn_segment 2');
  // Other_10's chained arm — NOT underbox.js's "full" arm.
  assertEq(seg3.local_turntimer, 170, 'T5: the "short end" arm ran (170, not the full 340)');
  assertEq(seg3.image_alpha, 0, 'T5: …image_alpha 0');
  assertEq(seg3.image_index, 5, 'T5: …image_index 5');
  // The full arm would have shoved it 200px right; the chained arm does not.
  const knight = s.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy');
  assertEq(seg3.x, knight.x, 'T5: the chained arm does NOT apply the full arm\'s x += 200');
  // …and then rotating Step_0's own next_up==5 post-writes overrode the
  // arm's init_start 2 / init 1. Order matters: post runs after event_user(0).
  assertEq(seg3.init_start, 4, 'T5: rotating\'s next_up==5 block sets init_start 4');
  assertEq(seg3.init, 8, 'T5: …and init 8');
  assertEq(s.kaizoComboSegments, 3, 'T5: three segments in the chain');
  assert(s.turntimer === 999999, 'T5: the clock is still pinned — no dead end fired');
  assert(!s.kaizo.approx.some((r) => /not translated|no module/.test(r.why ?? '')),
    'T5: the 1-2-5 chain ledgers no missing module');
}

// ── T6 — the 4-2-3 walk ────────────────────────────────────────────────────
//
// THROUGH THE SITES THE MODULES ACTUALLY CALL, changed 2026-08-29. This used
// to hand segment 2 -> 3 through 'rotating_step', the mod's mid-pattern
// early-spawn block. kaizo/attacks/rotating-slash.js does not carry that block
// — it has Alarm_2 only — so the walk under test was not the walk the fight
// takes, and it hid the one place the shared promotion does not apply (T6b).
// The shipped chain is swordfall Alarm_3 -> rotating Alarm_2.
{
  const s = scene({ ac: 7 });
  const seg1 = launchKaizoCombination(s, kaizoComboOrderFor(7));
  const warpsBefore = live(s, 'obj_knight_warp').length;
  const seg2 = kaizoChainNext(s, seg1, 'swordfall_alarm3');
  assertEq(seg2.type.name, 'obj_knight_rotating_slash', 'T6: swordfall hands on the rotating slash');
  assert(seg2.type === KAIZO_ROTATING, 'T6: …the KAIZO module, not the sim one');
  assertEq(seg2.turn_type, 'short mid', 'T6: segment 2 is "short mid"');
  assertEq(seg2.next_up, 3, 'T6: segment 2 carries next_up 3');
  assertEq(live(s, 'obj_knight_warp').length, warpsBefore,
    'T6: swordfall Alarm_3 warps only for the 1173 case, not for 669');
  assert(seg2.timer !== 4, 'T6: the timer-4 seed is quickslash Step_0\'s, not Alarm_3\'s');

  const seg3 = kaizoChainNext(s, seg2, 'rotating_alarm2');
  assertEq(seg3.type.name, 'obj_knight_tunnel_slasher_2_revised',
    'T6: segment 3 is the revised tunnel slasher');
  assertEq(seg3.turn_type, 'short end',
    'T6: segment 3 is "short end" — Alarm_2 uses the SHARED promotion');
  assertEq(seg3.turn_segment, 2, 'T6: segment 3 turn_segment 2');
  // The tunnel's own Other_10 "short end" arm ran: local_turntimer 90, and
  // the `point()` writes con 1 / timer 7 / fake_timer 7.
  assertEq(seg3.local_turntimer, 90, 'T6: tunnel "short end" arm ran (90)');
  assertEq(seg3.con, 1, 'T6: …and pointed (con 1)');
  // `if (other.turn_segment == 0) timer = -8;` is rotating_step's, not
  // Alarm_2's — this successor comes from Alarm_2 AND from segment 1, so
  // neither reason lets it fire.
  assert(seg3.timer !== -8, 'T6: the timer -8 seed is rotating_step\'s, segment-0 only');
  assertEq(live(s, 'obj_knight_warp').length, warpsBefore,
    'T6: rotating Alarm_2 creates no warp for its successor');

  // THE INVERTED PAIR — see the header note. These two used to assert
  // `source === 'sim'` and that kaizoChainNext ledgered the substitution.
  assertEq(KAIZO_COMBO_ATTACKS[3].source, 'kaizo',
    'T6: the registry says segment 3 is the KAIZO revised tunnel slasher');
  assert(seg3.type === KAIZO_TUNNEL,
    'T6: …and the walked segment IS that module by identity, not merely a'
    + ' matching type.name — the sim copy answers to the same name');
  assert(seg3.type !== SIM_TUNNEL,
    'T6: …and is NOT sim/attacks/sword-tunnel-revised.js, whose blade spawner'
    + ' writes vspeed to a property nothing reads and so fires every blade at a'
    + ' flat 180 against the recording\'s 17-direction fan (route C)');
  // THE CONFESSION MUST BE GONE, not merely unread: kaizoChainNext writes an
  // approx row for any `source !== 'kaizo'` segment, so a revert of the
  // registry re-arms it and this fails.
  assert(!s.kaizo.approx.some((r) => String(r.asked).includes('obj_knight_tunnel_slasher_2_revised')
      || String(r.used).includes('sim module')),
    'T6: the 4-2-3 walk ledgers NO vanilla substitution any more'
    + ` (${JSON.stringify(s.kaizo.approx)})`);
  // …and the ledger-writing branch is still LIVE rather than deleted, proved
  // on a scratch registry row whose source is not 'kaizo'. Without this, "no
  // row was written" and "nothing can write a row" read identically — the
  // failure mode CLAUDE.md's "Positive execution assertions" section names.
  {
    const s2 = scene({ ac: 7 });
    const saved = KAIZO_COMBO_ATTACKS[3];
    KAIZO_COMBO_ATTACKS[3] = { ...saved, source: 'sim', why: 'probe' };
    try {
      const a = launchKaizoCombination(s2, kaizoComboOrderFor(7));
      const b = kaizoChainNext(s2, a, 'swordfall_alarm3');
      kaizoChainNext(s2, b, 'rotating_alarm2');
    } finally {
      KAIZO_COMBO_ATTACKS[3] = saved;
    }
    assert(s2.kaizo.approx.some((r) => String(r.used).includes('sim module')),
      'T6: …and the branch that writes it still exists — a probe row with'
      + ' source "sim" ledgers, so the assertion above is not vacuous');
  }
}

// ── T6b — rotating_step's id-3 arm, the ONE site that departs from the ─────
//         shared promotion. NOT on the shipped chain (the module carries
//         Alarm_2 only), transcribed and pinned so a future pass that DOES
//         wire the mid-pattern overlap starts from the mod's own text.
//
// gml_Object_obj_knight_rotating_slash_Step_0.gml:97-137, and vanilla's copy
// of the same block diffs clean, so this is not a kaizo delta:
//
//     if (other.turn_segment == 0) { turn_type = "short mid";
//                                    turn_segment = 1;
//                                    next_up = other.next_next_up;
//                                    timer = -8; }
//     if (other.turn_segment == 1) { turn_type = "short mid";     // <-- not
//                                    turn_segment = 2; }          //     "end"
//     ...
//     event_user(0);
//     if (turn_type == "short mid" || turn_type == "short end")
//     { timer = -12; local_turntimer += 12; }
//
// Every other handoff in both dumps promotes segment 1 to "short end". This
// one says "short mid", which the tunnel's CleanUp reads as non-closing —
// and the turn still ends, because a last segment keeps its Create
// `next_up = -1` and Step_0:66's "final" state hands global.turntimer its -1
// at timer 92, CleanUp uninvolved. Asserted here rather than "corrected".
{
  const s = scene({ ac: 7 });
  const seg1 = launchKaizoCombination(s, kaizoComboOrderFor(7));
  const seg2 = kaizoChainNext(s, seg1, 'swordfall_alarm3');
  const warpsBefore = live(s, 'obj_knight_warp').length;
  const seg3 = kaizoChainNext(s, seg2, 'rotating_step');
  assertEq(seg3.type.name, 'obj_knight_tunnel_slasher_2_revised',
    'T6b: rotating_step id 3 creates the revised tunnel slasher');
  assertEq(seg3.turn_type, 'short mid',
    'T6b: …promoted to "short mid", NOT the "short end" every other site gives'
    + ' — Step_0:120-124, and vanilla says the same');
  assertEq(seg3.turn_segment, 2, 'T6b: …still turn_segment 2');
  assertEq(seg3.timer, -12,
    'T6b: …and the post-event_user block overrides the arm\'s timer 7 with -12');
  assertEq(seg3.local_turntimer, 112,
    'T6b: …and adds 12 to the "short mid" arm\'s 100');
  assert(live(s, 'obj_knight_warp').length > warpsBefore,
    'T6b: the id-3 block warps its successor in at (+25, -44)');
  // THE DISCRIMINATOR against the shared promotion: run the same successor id
  // through the site that does NOT override, and the two must differ. Without
  // this the assertions above would pass on a promote table that silently fell
  // back to kaizoComboPromote for everything.
  {
    const s2 = scene({ ac: 7 });
    const a = launchKaizoCombination(s2, kaizoComboOrderFor(7));
    const b = kaizoChainNext(s2, a, 'swordfall_alarm3');
    const c = kaizoChainNext(s2, b, 'rotating_alarm2');
    assert(c.turn_type !== seg3.turn_type,
      `T6b: the two sites really do promote differently (alarm2 "${c.turn_type}"`
      + ` vs step "${seg3.turn_type}")`);
    assert(c.local_turntimer !== seg3.local_turntimer,
      `T6b: …and the +12 is only the step site's (alarm2 ${c.local_turntimer},`
      + ` step ${seg3.local_turntimer})`);
  }
  // The segment-0 arm's `timer = -8` is written and then overwritten by the
  // -12 in the same block, because "short mid" satisfies the trailing test.
  // Preserved as an ORIGINAL dead write; pinned so a cleanup cannot "simplify"
  // it into a behaviour change.
  {
    const s3 = scene({ ac: 7 });
    const self = {
      x: 300, y: 100, turn_segment: 0, next_up: 3, next_next_up: 5,
      anchor_x: 300, anchor_y: 100,
    };
    const n = kaizoChainNext(s3, self, 'rotating_step');
    assertEq(n.turn_type, 'short mid', 'T6b: segment 0 -> "short mid" too');
    assertEq(n.next_up, 5, 'T6b: …and segment 0 hands on next_next_up');
    assertEq(n.timer, -12,
      'T6b: …and the -8 written inside the promotion is overwritten by the -12');
  }
}

// ── T7 — the swordfall-d5 hypothesis, disproved ────────────────────────────
{
  assertEq(KAIZO_COMBO_ATTACKS[5].name, 'obj_knight_weird_bottom_manager',
    'T7: sub-attack 5 is the UNDERBOX (INDEX item 13 guessed swordfall)');
  assertEq(KAIZO_COMBO_ATTACKS[4].name, 'obj_knight_swordfall',
    'T7: swordfall is sub-attack 4');
  assert(!(KAIZO_COMBO_ORDERS[7].first === 4 && KAIZO_COMBO_ORDERS[7].third === 5)
    && !Object.values(KAIZO_COMBO_ORDERS).some(
      (o) => [o.first, o.second, o.third].includes(4)
        && [o.first, o.second, o.third].includes(5)),
    'T7: no dispatched order contains 4 and 5 together');

  // scr_bullet_inherit copies damage and NOT difficulty — so a chained
  // swordfall is d0 even from a d5 parent, and the combination cannot be
  // the home of swordfall d5.
  const s = scene({ ac: 106 });
  const src = spawn(s, KAIZO_COMBO_ATTACKS[5].type, { x: 300, y: 100 });
  src.turn_segment = 0;
  src.next_next_up = 3;
  src.next_up = 4;
  src.difficulty = 5;
  src.damage = 80;
  src.target = 0;
  src.anchor_x = 300;
  src.anchor_y = 100;
  const fall = kaizoChainNext(s, src, 'underbox_alarm2');
  assertEq(fall.type.name, 'obj_knight_swordfall', 'T7: the underbox can chain a swordfall');
  assertEq(fall.damage, 80, 'T7: scr_bullet_inherit DOES carry damage');
  assertEq(fall.difficulty, 0, 'T7: …and does NOT carry difficulty — the chained fall is d0');
  // Alarm_2's own seed for the 630 case.
  assertEq(fall.countdowner, 10, 'T7: underbox Alarm_2 sets countdowner 10 for swordfall');
}

// ── T8 — the switches' missing cases ───────────────────────────────────────
{
  const cases = [
    ['rotating_alarm2', 2, 'a rotating slash cannot chain into another one'],
    ['underbox_alarm2', 5, 'the underbox has no case 5'],
    ['swordfall_alarm3', 4, 'swordfall Alarm_3 has no case 4'],
  ];
  for (const [site, id, why] of cases) {
    const s = scene({ ac: 106 });
    const before = s.entities.filter((e) => e.alive).length;
    const self = { x: 300, y: 100, turn_segment: 0, next_up: id, next_next_up: 3 };
    const out = kaizoChainNext(s, self, site);
    assertEq(out, null, `T8: ${site} -> ${id} creates nothing (${why})`);
    assertEq(s.entities.filter((e) => e.alive).length, before,
      `T8: ${site} -> ${id} spawns no entity`);
    assert(s.kaizo.approx.some((r) => String(r.asked).includes(`${site} -> segment ${id}`)),
      `T8: ${site} -> ${id} is ledgered`);
    assertEq(self.next_up, -999, `T8: ${site} -> ${id} still clears next_up`);
  }
  // …and the guard above them: next_up -999 / -1 does nothing at all.
  const s = scene({ ac: 106 });
  assertEq(kaizoChainNext(s, { next_up: -999 }, 'rotating_alarm2'), null,
    'T8: next_up -999 is the outer `if` and creates nothing');
  assertEq(kaizoChainNext(s, { next_up: -1 }, 'rotating_alarm2'), null,
    'T8: next_up -1 (the standalone Create default) likewise');
  assertEq(s.kaizo.approx.length, 0, 'T8: …and neither ledgers');
}

// ── T9 — isolation ─────────────────────────────────────────────────────────
{
  assert(SIM_COMBO_ATTACKS[2].type === SIM_ROTATING,
    'T9: the SIM registry still holds the SIM rotating slash');
  assert(SIM_COMBO_ATTACKS[2].type !== KAIZO_ROTATING,
    'T9: …and NOT the kaizo one — nothing here called registerComboAttack');
  assert(KAIZO_COMBO_ATTACKS[1].type === quickslashAttack,
    'T9: the kaizo registry holds the kaizo quickslash');
  assert(SIM_COMBO_ATTACKS[1].type === null,
    'T9: the sim registry has no segment 1 at all (nothing registered it)');
}

// ── T10 — a dead end ends the turn ─────────────────────────────────────────
{
  const s = scene({ ac: 106 });
  const knight = s.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy');
  s.turntimer = 999999;
  knight.image_alpha = 0;
  const self = {
    x: 300, y: 100, turn_segment: 0, next_up: 42, next_next_up: 3,
    anchor_x: 300, anchor_y: 100,
  };
  const out = kaizoChainNext(s, self, 'rotating_alarm2');
  assertEq(out, null, 'T10: an unregistered segment id creates nothing');
  assertEq(s.turntimer, -1, 'T10: …and hands the clock back so the turn cannot hang');
  assertEq(knight.image_alpha, 1, 'T10: …and un-hides the Knight');
  assert(s.kaizo.approx.some((r) => r.used === 'turn ended early'),
    'T10: …and ledgers the stand-in');

  // A launch whose FIRST segment has no module ledgers rather than throwing.
  const s2 = scene({ ac: 106 });
  const none = launchKaizoCombination(s2, { first: 42, second: 2, third: 5, power: 1 });
  assertEq(none, null, 'T10: an unregistered first segment launches nothing');
  assert(s2.kaizo.approx.some((r) => r.used === 'nothing launched'),
    'T10: …and is ledgered');
}

// ── T11 — THE SEAM: state.kaizo.hooks.comboChainNext ───────────────────────
//
// This is what closes the defect the whole file was written around and could
// not reach: `KAIZO_COMBO_ATTACKS` was five-for-five kaizo modules and NOTHING
// READ IT, because every kaizo segment module ended its handoff with the SIM's
// `chainNext`, which resolves successors from the SIM's registry — and only
// sim/ modules ever write that (kaizo/HANDOFF.md §2.1, asserted by T9). So
// segment 1 came from this table and every segment after it came from the
// sim's, whatever this table said.
//
// The seam is the one the vortex handoff already uses:
// `sim/attacks/combination.js`'s chainNext takes an optional SITE NAME, and
// when one is given AND state.kaizo.hooks.comboChainNext is set it forwards
// the entire handoff to kaizoChainNext. Four claims, each of which fails on
// its own if the wiring is reverted or over-applied:
//
//   a) hookless + a site name  -> still the VANILLA chain. This is the
//      byte-identical guarantee sim/'s whole-fight diff depends on.
//   b) hook + a site name      -> kaizoChainNext, with the name intact.
//   c) hook + NO site name     -> still vanilla. Every call inside sim/ passes
//      two arguments, so a sim segment on a kaizo state cannot be half
//      converted, and the launcher's ledger row stays true while leg 1 is
//      unlanded.
//   d) the modules really pass those names — driven, not read.
{
  // (a) HOOKLESS. A kaizo site name on a state with no hook resolves the SIM
  //     registry, exactly as it did before the parameter existed.
  const s = scene({ ac: 7 });
  const self = {
    x: 300, y: 100, turn_segment: 0, next_up: 2, next_next_up: 3,
    anchor_x: 300, anchor_y: 100,
  };
  const vanilla = chainNext(s, self, 'swordfall_alarm3');
  assert(!!vanilla, 'T11a: hookless, a named site still hands on');
  assert(vanilla.type === SIM_ROTATING,
    'T11a: …through the SIM registry — the site name alone changes nothing');
  assert(vanilla.type !== KAIZO_ROTATING,
    'T11a: …and emphatically NOT the kaizo module, which nothing registered');
  assertEq(s.kaizo.approx.length, 0, 'T11a: …and ledgers nothing');

  // (b) WITH THE HOOK. Same call, same state shape, one field set.
  const s2 = scene({ ac: 7 });
  const seen = [];
  s2.kaizo.hooks = {
    comboChainNext(state, who, siteName) {
      seen.push(siteName);
      return kaizoChainNext(state, who, siteName);
    },
  };
  const self2 = {
    x: 300, y: 100, turn_segment: 0, next_up: 2, next_next_up: 3,
    anchor_x: 300, anchor_y: 100,
  };
  const routed = chainNext(s2, self2, 'swordfall_alarm3');
  assert(!!routed, 'T11b: with the hook, the handoff still produces a segment');
  assert(routed.type === KAIZO_ROTATING,
    'T11b: …and it is the KAIZO module by identity, out of KAIZO_COMBO_ATTACKS');
  assert(routed.type !== SIM_ROTATING, 'T11b: …not the sim copy of the same name');
  assertEq(seen.join(','), 'swordfall_alarm3',
    'T11b: …and the SITE NAME survives the hop — the sites are not interchangeable');

  // (c) THE GUARD. Same hooked state, a two-argument call: sim/ is never
  //     redirected. Delete the `siteName !== undefined` test in
  //     sim/attacks/combination.js and this goes red.
  const s3 = scene({ ac: 7 });
  let hookCalls = 0;
  s3.kaizo.hooks = { comboChainNext() { hookCalls += 1; return null; } };
  const self3 = {
    x: 300, y: 100, turn_segment: 0, next_up: 2, next_next_up: 3,
    anchor_x: 300, anchor_y: 100,
  };
  const unnamed = chainNext(s3, self3);
  assertEq(hookCalls, 0, 'T11c: a call with no site name never reaches the hook');
  assert(unnamed && unnamed.type === SIM_ROTATING,
    'T11c: …and gets the vanilla successor even on a hooked state');

  // (d) POSITIVE EXECUTION — the modules' own handoff events, driven. A site
  //     name asserted from a comment is not evidence; this fires the real
  //     alarm bodies and records what each one asked for. A module that
  //     dropped the argument, or named a site that does not exist, fails here.
  const drive = (type, alarmNo, extra = {}) => {
    const st = scene({ ac: 7 });
    const asked = [];
    st.kaizo.hooks = {
      comboChainNext(state, who, siteName) { asked.push(siteName); return null; },
    };
    const e = spawn(st, type, { x: 320, y: 120 });
    Object.assign(e, {
      next_up: 2, next_next_up: 3, turn_segment: 0, anchor_x: 320, anchor_y: 120,
    }, extra);
    type.alarm[alarmNo](e, st);
    return asked;
  };
  assertEq(drive(KAIZO_SWORDFALL, 3).join(','), 'swordfall_alarm3',
    'T11d: kaizo swordfall Alarm_3 names swordfall_alarm3');
  assertEq(drive(KAIZO_ROTATING, 2).join(','), 'rotating_alarm2',
    'T11d: kaizo rotating slash Alarm_2 names rotating_alarm2');
  assertEq(drive(KAIZO_TUNNEL, 2).join(','), 'tunnel_alarm2',
    'T11d: kaizo revised tunnel Alarm_2 names tunnel_alarm2');
  // tunnel_alarm2's id-1 arm, the one site whose `pre` writes onto the
  // SUCCESSOR through an object index. Both halves pinned, because they land
  // differently: `local_turntimer -= spawn_speed - timer` computes 595 off the
  // quickslash's Create (600, 10, 5) and is then thrown away by the "short mid"
  // arm's 160, while `timer = spawn_speed` survives it carrying the CREATE
  // spawn_speed 10 rather than the arm's 12. An ORIGINAL half-dead write; a
  // cleanup that "fixed" either half would move the successor's first slash.
  {
    const st = scene({ ac: 7 });
    const self = {
      x: 300, y: 100, turn_segment: 0, next_up: 1, next_next_up: 5,
      anchor_x: 300, anchor_y: 100,
    };
    const n = kaizoChainNext(st, self, 'tunnel_alarm2');
    assertEq(n.type.name, 'obj_roaringknight_quickslash_attack',
      'T11d: tunnel Alarm_2 case 1 creates the quickslash');
    assertEq(n.local_turntimer, 160,
      'T11d: …its -= arithmetic is overwritten by the "short mid" arm (160)');
    assertEq(n.spawn_speed, 12, 'T11d: …the arm sets spawn_speed 12');
    assertEq(n.timer, 10,
      'T11d: …but timer keeps the CREATE spawn_speed 10, which the arm never'
      + ' touches — the surviving half of the original write');
  }
  // …and every name they can pass is a real site. `kaizoChainNext` throws on
  // an unknown one, so a typo would be loud — but only on the frame the chain
  // reached it, which in the fight is minutes in.
  for (const name of ['quickslash_step', 'rotating_step', 'rotating_alarm2',
    'underbox_alarm2', 'swordfall_alarm3', 'tunnel_step', 'tunnel_alarm2']) {
    assert(!!KAIZO_CHAIN_SITES[name], `T11d: ${name} is a transcribed handoff site`);
  }
  // The tunnel's MID-STEP handoff (Step_0:5-64) is the one site reached from a
  // Step rather than an alarm, so it is driven through the Step itself.
  {
    const st = scene({ ac: 7 });
    const asked = [];
    st.kaizo.hooks = {
      comboChainNext(state, who, siteName) { asked.push(siteName); return null; },
    };
    const e = spawn(st, KAIZO_TUNNEL, { x: 320, y: 120 });
    e.turn_type = 'short start';
    if (KAIZO_TUNNEL.init) KAIZO_TUNNEL.init(e, st);
    e.next_up = 4;
    e.turntimer_limit = 99999; // force `local_turntimer < turntimer_limit`
    e.turn_segment = 0;
    e.next_next_up = 3;
    KAIZO_TUNNEL.step(e, st);
    assertEq(asked.join(','), 'tunnel_step',
      'T11d: the revised tunnel\'s mid-Step handoff names tunnel_step');
    assertEq(e.next_up, -999, 'T11d: …and is one-shot');
  }

  // THE WHOLE 4-2-3 CHAIN THROUGH THE SEAM, end to end, by identity. This is
  // the claim the ledger rows are about: with the hook set, every segment the
  // combination walks is a kaizo module.
  const s4 = scene({ ac: 7 });
  s4.kaizo.hooks = { comboChainNext: kaizoChainNext };
  const c1 = launchKaizoCombination(s4, kaizoComboOrderFor(7));
  const c2 = chainNext(s4, c1, 'swordfall_alarm3');
  const c3 = chainNext(s4, c2, 'rotating_alarm2');
  assert(c1.type === KAIZO_SWORDFALL, 'T11: segment 1 is the kaizo swordfall');
  assert(c2.type === KAIZO_ROTATING, 'T11: segment 2 is the kaizo rotating slash');
  assert(c3.type === KAIZO_TUNNEL, 'T11: segment 3 is the kaizo revised tunnel');
  assertEq(s4.kaizo.approx.length, 0,
    `T11: and the whole walk ledgers NOTHING (${JSON.stringify(s4.kaizo.approx)})`);
  // The same walk WITHOUT the hook is the state of the world before this
  // change: three sim bodies. Kept as the discriminator, because "the chain is
  // kaizo" and "the chain was always kaizo" would otherwise read alike.
  const s5 = scene({ ac: 7 });
  const v1 = launchKaizoCombination(s5, kaizoComboOrderFor(7));
  const v2 = chainNext(s5, v1, 'swordfall_alarm3');
  const v3 = chainNext(s5, v2, 'rotating_alarm2');
  assert(v1.type === KAIZO_SWORDFALL,
    'T11: hookless, segment 1 is still kaizo — launchKaizoCombination owns it');
  assert(v2.type === SIM_ROTATING && v3.type === SIM_TUNNEL,
    'T11: …and segments 2 and 3 fall back to the SIM modules, which is exactly'
    + ' the defect the hook exists to close');
}

// ── report ─────────────────────────────────────────────────────────────────
if (failures) {
  console.log(`check-combination: ${failures} FAILURE(S) of ${checks} checks`);
  process.exit(1);
}
console.log(`check-combination: all ${checks} checks passed`);
console.log('  T1 both dispatched orders / T2 parameterised launch / T3 dead shuffle');
console.log('  T4 promotion by segment / T5 the 1-2-5 walk / T6 the 4-2-3 walk');
console.log('  T7 swordfall-d5 disproved / T8 missing switch cases / T9 isolation');
console.log('  T10 dead ends end the turn / T11 the comboChainNext seam');
process.exit(0);
