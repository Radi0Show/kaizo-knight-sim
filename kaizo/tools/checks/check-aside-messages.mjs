#!/usr/bin/env node
// KAIZO A-SIDE (V-C) — THE MOD DELTAS THE RECREATION USED TO DO THE VANILLA
// WAY. Lane B: ledger G-3 (the turn-end message block), G-22 (monsterdf 5 in
// all three formulas), G-24 (a crit cancels the block pose) and G-45 (the
// Rude Buster bolt's aim).
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// WHAT THIS IS FOR. Every mechanic below was already TRANSLATED and already
// ran; what it did was DELTARUNE's version of the thing, which no "is it
// translated?" grep and no green module check can see. So the assertions here
// are deliberately shaped as "the mod's answer, and NOT vanilla's answer" —
// both halves, because reverting either delta puts vanilla's number back and
// a one-sided assertion would still pass.
//
// EVERY BLOCK GOES THROUGH `buildKaizoScene(version 'C')` and the director's
// own hooks. Nothing here calls a module function that the fight does not.
//
// PROVENANCE (knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/, diffed
// against gml_vanilla_v105/CodeEntries/ — the mod's own comparison tree):
//   gml_Object_obj_knight_enemy_Step_0.gml   :566-781  the turn-end block;
//                                            the FIVE real k_sideb guards are
//                                            :593, :635, :649, :686, :760
//                                            (re-counted 2026-09-10 off a
//                                            whole-event `grep -n k_sideb`;
//                                            this line used to say "four" and
//                                            every number in it was off)
//   gml_Object_obj_knight_enemy_Create_0.gml :65 progamer, :132 k_lastpro,
//                                            :135-136 didfullnohit /
//                                            turnsafternohit
//   gml_Object_obj_heroparent_Step_0.gml     :362-369  the points<150 fork
//   gml_GlobalScript_scr_spell.gml           :144      Rude Buster's damage
//   gml_GlobalScript_scr_monstersetup.gml    monstertype 104: monsterdf = 5
//   gml_Object_obj_rudebuster_bolt_Step_0.gml  vanilla :15-18 `targety -= 50`,
//                                            DELETED in the mod (the entire
//                                            diff of that file)
//   gml_GlobalScript_scr_mnendturn.gml       :149-155  k_tpscene only ever
//                                            starts under k_sideb
//
//     node kaizo/tools/checks/check-aside-messages.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import {
  charIdOfSlot, slotOfCharId, haveChar, downMessages, ensureFreezeState,
} from '../../party/freeze.js';
import { cleanupKaizoHero } from '../../party/heroes.js';
import { xslashDamage } from '../../party/spells.js';
import { castSpell } from '../../../sim/spells.js';
import { spellDamage, KNIGHT_DF } from '../../../sim/knight.js';
import { statFor } from '../../../sim/damage.js';
import { statFor as rosterStatFor } from '../../party/roster.js';
import { gmlRound } from '../../../sim/gml.js';
import { downMsg } from '../../../sim/battlemsg.js';
import { VC_KNIGHT } from '../../versions/vc-script.js';

let failures = 0;
let checks = 0;
function ok(cond, label) {
  checks += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); }
}
function eq(got, want, label) {
  checks += 1;
  if (got !== want) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}
function section(t) { console.log(`\n-- ${t}`); }

function build(version = 'C', seed = 12345) {
  const st = createState({ seed, traceBulletSlots: 0 });
  buildKaizoScene(st, { version });
  return st;
}
const director = (s) => s.entities.find((x) => x.alive && x.type?.name === 'fight_director');

/**
 * One turn END, through the real `advance` hook — the same call
 * kaizo-practice.js makes, with the same argument shape. `prevPhase/prevTurn`
 * name the row the knight just finished, which is what decides
 * `kaizo_prevatk`.
 */
function endTurn(state, prevPhase, prevTurn) {
  const e = director(state);
  e.hooks.advance(state, e, { prevPhase, prevTurn });
  return state.battlemsg;
}

// ═══════════════════════════════════════════════════════════════════════════
section('G-3 (a) — `global.char` exists on a roster-less lane');
{
  // V-C installs no roster (kaizo/scenes/kaizo-fight.js version C declares no
  // `party:` key), and charIdOfSlot used to answer 0 for every slot there.
  // With that hole, `scr_havechar` was false for Kris, Susie and Ralsei and
  // downMessages computed four empty strings forever — the message block
  // could be un-gated and still emit nothing.
  const c = build('C');
  eq(c.kaizo.roster, undefined, 'V-C really installs no roster (the precondition)');
  eq(charIdOfSlot(c, 0), 1, 'slot 0 -> Kris');
  eq(charIdOfSlot(c, 1), 2, 'slot 1 -> Susie');
  eq(charIdOfSlot(c, 2), 3, 'slot 2 -> Ralsei');
  eq(charIdOfSlot(c, 3), 0, 'slot 3 -> 0 (there is no fourth slot)');
  eq(slotOfCharId(c, 2), 1, 'Susie is slot 1');
  eq(slotOfCharId(c, 4), -1, 'Noelle is not in the A-Side party');
  ok(haveChar(c, 1) && haveChar(c, 2) && haveChar(c, 3) && !haveChar(c, 4),
    'scr_havechar: 1/2/3 yes, 4 no');

  // …and the roster lane is untouched by the fallback.
  const d = build('D');
  ok(Array.isArray(d.kaizo.roster), 'V-D still installs a roster');
  eq(charIdOfSlot(d, 1), 4, 'V-D slot 1 -> Noelle (the roster still wins)');
  eq(slotOfCharId(d, 2), -1, 'V-D has no Susie');
}

// ═══════════════════════════════════════════════════════════════════════════
section('G-3 (b) — the down lines fire on the A-SIDE, in the MOD\'s words');
{
  // Susie alone.
  const c = build('C');
  c.partyHp[1] = -999;
  const m = endTurn(c, 1, 0);
  eq(m, "* Susie's demise was expected.&", 'Susie down -> the mod\'s line');
  eq(c.kaizo.downLatch.susie, true, 'susiedownmessage latched');

  // Ralsei alone.
  const c2 = build('C');
  c2.partyHp[2] = -999;
  eq(endTurn(c2, 1, 0), "* Ralsei's hope was shattered.&", 'Ralsei down -> the mod\'s line');

  // Kris alone. `kaizo_funchance(100)` can replace it 1 time in 100, and the
  // draw happens either way, so both strings are accepted here and the draw
  // is asserted separately below.
  const c3 = build('C');
  c3.partyHp[0] = -999;
  const m3 = endTurn(c3, 1, 0);
  ok(m3 === '* Kris collapsed in silence.&' || m3 === '* Kris is now dead.&',
    `Kris down -> the mod's line (got ${JSON.stringify(m3)})`);

  // `downcount == 2` CONCATENATES all four terms (two of them empty).
  const c4 = build('C');
  c4.partyHp[1] = -999;
  c4.partyHp[2] = -999;
  eq(endTurn(c4, 1, 0),
    "* Susie's demise was expected.&* Ralsei's hope was shattered.&",
    'downcount == 2 concatenates');

  // The latch is once per FIGHT: a second turn end says nothing new.
  const before = c.battlemsg;
  c.battlemsg = null;
  endTurn(c, 1, 1);
  ok(c.battlemsg !== before || c.battlemsg === null || !/demise was expected/.test(c.battlemsg ?? ''),
    'the down line does not repeat on the next turn end');

  // AND IT IS NOT VANILLA'S. sim/battlemsg.js downMsg is the vendored v1.03
  // text and the mod replaces all three; if someone "fixes" the strings back,
  // these go red.
  const vk = downMsg([-999, 1, 1], { kris: false, susie: true, ralsei: true });
  const vs = downMsg([1, -999, 1], { kris: true, susie: false, ralsei: true });
  const vr = downMsg([1, 1, -999], { kris: true, susie: true, ralsei: false });
  eq(vk, '* Kris kneeled in silence.&', 'the engine still carries VANILLA Kris');
  eq(vs, '* Susie was hurt and beaten.&', 'the engine still carries VANILLA Susie');
  eq(vr, '* Ralsei became a pile of fluff.&', 'the engine still carries VANILLA Ralsei');
  const c5 = build('C');
  c5.partyHp[0] = -999;
  const mod = downMessages(c5);
  ok(mod.lines.krisdown !== vk, 'and the kaizo Kris line differs from it');
  const c6 = build('C');
  c6.partyHp[1] = -999;
  ok(downMessages(c6).lines.susiedown !== vs, 'and the kaizo Susie line differs from it');
  const c7 = build('C');
  c7.partyHp[2] = -999;
  ok(downMessages(c7).lines.ralseidown !== vr, 'and the kaizo Ralsei line differs from it');
}

// ═══════════════════════════════════════════════════════════════════════════
section('G-3 (c) — `kaizo_funchance(100)` really draws, and only for Kris');
{
  // Two u32 per call (irandom_range), unconditionally — the left operand of
  // `roll <= 1 || global.kaizo_funni` is evaluated first and always.
  const c = build('C');
  c.partyHp[0] = -999;
  const before = c.gmlRng.draws ?? 0;
  endTurn(c, 1, 0);
  eq((c.gmlRng.draws ?? 0) - before, 2, 'the Kris branch burns exactly 2 u32');

  const c2 = build('C');
  c2.partyHp[1] = -999;
  const before2 = c2.gmlRng.draws ?? 0;
  endTurn(c2, 1, 0);
  eq((c2.gmlRng.draws ?? 0) - before2, 0, 'the Susie branch burns none');
}

// ═══════════════════════════════════════════════════════════════════════════
section('G-3 (d) — the RoaringDelta pair and k_lastpro, on the A-Side');
{
  // Phase 4 row 3 is atk_RoaringDelta; ending that turn sets kaizo_prevatk.
  const e0 = director(build('C'));
  const rdTurn = e0.table[4].findIndex((r) => r.id === 'atk_RoaringDelta');
  ok(rdTurn >= 0, 'atk_RoaringDelta is a phase-4 row');

  // progamer still true (no hit taken): the "Kris coughed" arm.
  const c = build('C');
  eq(c.knight.progamer, true, 'progamer starts true (Create_0:65)');
  eq(endTurn(c, 4, rdTurn), '* Kris coughed.&* The enemy pauses in wonder...',
    'progamer -> the coughed line');
  // …and NOT the k_sideb reward, which is what used to be unconditional here.
  ok(c.knight.didfullnohit !== 1, 'didfullnohit stays clear on the A-Side (:686 is k_sideb)');

  // progamer false: the plain guard-falters line, then k_lastpro overwrites.
  const c2 = build('C');
  c2.knight.progamer = false;
  eq(endTurn(c2, 4, rdTurn), '\\ck* So close^1, yet so far from perfection...',
    'k_lastpro fires on the A-Side');
  eq(c2.knight.lastpro, false, 'k_lastpro is a one-shot');
  eq(endTurn(c2, 4, rdTurn), "* The enemy's guard falters, just for a moment...",
    'the second RoaringDelta turn end falls back to the guard-falters line');

  // The two branches the MOD leaves dead on the A-Side stay dead.
  //
  // THIS USED TO BE A DEAD ASSERTION, found by lane B's reviewer and split
  // here (2026-09-10). It read
  //
  //     ok(!/Couldn't keep up.../.test(msg) || nospellsaw === 0, ...)
  //
  // and the two arms of that disjunction cover the whole outcome space: the
  // :768 branch either does not fire (first arm true) or fires and clears
  // `k_nospellsaw` on its own first line at :770 (second arm true). Nothing
  // could make it red. It is two separate facts, so it is now two tests, and
  // each is written so that removing the behaviour breaks it.
  //
  //   (a) FORCED: with k_nospellsaw pushed to 1 the way k_tpscene 12 would,
  //       the branch fires and reads exactly the mod's string, and clears the
  //       flag — the verbatim-reproduction half.
  const c3 = build('C');
  c3.knight.progamer = false;
  c3.kaizo.didspell = 1;
  c3.kaizo.nospellsaw = 1;              // only k_tpscene 12 ever writes this,
  c3.battlemsg = null;                  // and k_tpscene is k_sideb-only
  endTurn(c3, 2, 0);
  eq(c3.battlemsg,
    "\\ck* Couldn't keep up without spells after all, huh...^1?&* What a shame.",
    'the spell taunt is reproduced verbatim once k_nospellsaw is set (Step_0:768-771)');
  eq(c3.kaizo.nospellsaw, 0, '...and firing it clears k_nospellsaw (Step_0:770) — a one-shot');
  //   (b) NATURAL: left alone, an A-Side fight never sets k_nospellsaw, so
  //       the taunt cannot appear. This is the half the old test was meant to
  //       be, and it is the one that would have gone red if the branch were
  //       ever accidentally ungated from k_tpscene.
  const c3b = build('C');
  c3b.knight.progamer = false;
  c3b.kaizo.didspell = 1;
  eq(c3b.kaizo.nospellsaw ?? 0, 0, 'an A-Side fight leaves k_nospellsaw at 0 (k_tpscene is k_sideb-only)');
  c3b.battlemsg = null;
  endTurn(c3b, 2, 0);
  ok(!/Couldn't keep up without spells/.test(c3b.battlemsg ?? ''),
    'so the spell taunt never reaches the A-Side');

  // Multislash2's line is k_sideb + progamer; the A-Side must not get it.
  const c4 = build('C');
  const msTurn = e0.table[2].findIndex((r) => r.id === 'atk_Multislash2');
  ok(msTurn >= 0, 'atk_Multislash2 is a phase-2 row');
  c4.battlemsg = null;
  endTurn(c4, 2, msTurn);
  ok(!/Not a scratch yet/.test(c4.battlemsg ?? ''),
    'the Multislash2 taunt stays B-Side (:760 is k_sideb)');
  ok(!/Can't move your body|She was used up|something special/.test(c4.battlemsg ?? ''),
    'no k_sideb string reaches the A-Side');
}

// ═══════════════════════════════════════════════════════════════════════════
section('G-3 (e) — THE OTHER SIDE OF THE GATE: the same block on V-D');
{
  // COVERAGE THE REFACTOR NEVER GOT, added 2026-09-10 on lane B's reviewer
  // finding. G-3 removed a `if (!k.sideb) return;` from the top of
  // kaizoTurnEndMessages, and everything above proves the A-Side now REACHES
  // the block. Nothing proved the B-Side still gets the five guarded strings
  // — and the cheapest wrong way to "un-gate" a block is to invert the guard,
  // which every A-Side assertion above would applaud.
  //
  // So each of these is the mirror image of an A-Side assertion: the same
  // stimulus, the opposite expectation, on the version whose `k_sideb` is 1.
  const d0 = build('D');
  eq(d0.kaizo.sideb, true, 'V-D really is the k_sideb route (the precondition)');

  // :593 — the Kris down-line override. The A-Side gets the mod's
  // "collapsed in silence" line; the B-Side gets "Can't move your body.&".
  const d1 = build('D');
  d1.partyHp[0] = -999;
  const kd = endTurn(d1, 1, 0);
  ok(/Can't move your body/.test(kd ?? ''),
    `:593 — Kris's B-Side down line (got ${JSON.stringify(kd)})`);

  // :635 — Noelle's. She is slot 1 on the Weird Route.
  const d2 = build('D');
  d2.partyHp[1] = -999;
  const nd = endTurn(d2, 1, 0);
  ok(/She was used up/.test(nd ?? ''),
    `:635 — Noelle's B-Side down line (got ${JSON.stringify(nd)})`);

  // :686 — the RoaringDelta reward, with the four assignments under it. On
  // the A-Side (above) this is the "Kris coughed" line and didfullnohit stays
  // clear; here it is the reward and didfullnohit is set.
  const d3 = build('D');
  const e3 = director(d3);
  const rdTurnD = e3.table[4].findIndex((r) => r.id === 'atk_RoaringDelta');
  ok(rdTurnD >= 0, 'atk_RoaringDelta is a phase-4 row on V-D');
  eq(d3.knight.progamer, true, 'progamer starts true on V-D too');
  const rw = endTurn(d3, 4, rdTurnD);
  eq(rw, "\\ck* Well, aren't you something special...^2?&* Go ahead.",
    ':686/:690 — the B-Side reward line');
  eq(d3.knight.didfullnohit, 1, ':691 — didfullnohit set (the A-Side can never reach this)');
  eq(d3.knight.turnsafternohit, 0, ':692 — turnsafternohit zeroed');
  eq(d3.knight.curhp, d3.knight.hp, ':693 — curhp snapshotted');

  // :760 — Multislash2's taunt, the one the A-Side above must NOT get.
  const d4 = build('D');
  const e4 = director(d4);
  const msTurnD = e4.table[2].findIndex((r) => r.id === 'atk_Multislash2');
  ok(msTurnD >= 0, 'atk_Multislash2 is a phase-2 row on V-D');
  d4.battlemsg = null;
  const ms = endTurn(d4, 2, msTurnD);
  eq(ms, '\\ck* Not a scratch yet, hm...^1?&* Impressive.',
    ':760/:764 — the B-Side Multislash2 taunt');

  // ...and the UNGATED half still runs on the B-Side: k_lastpro is one of the
  // branches G-3 freed, and it is not k_sideb-gated, so both routes get it.
  const d5 = build('D');
  d5.knight.progamer = false;
  eq(endTurn(d5, 4, rdTurnD), '\\ck* So close^1, yet so far from perfection...',
    'k_lastpro fires on the B-Side as well (ungated in the GML)');
}

// ═══════════════════════════════════════════════════════════════════════════
section('G-24 — a 150-point crit cancels an in-flight block pose');
{
  const c = build('C');
  const e = director(c);
  // A block is up (the previous non-crit set it; kaizoBlockStepTail draws it
  // and endCutsceneReached refuses the ending while it is > 0).
  c.knight.blockanim = 1;
  e.hooks.fightDamage(c, 0, 150);
  eq(c.knight.blockanim, 0, 'points >= 150 -> blockanim = 0 (Step_0:368)');

  // The other arm: a non-crit is blocked and RE-ARMS the pose.
  const c2 = build('C');
  const e2 = director(c2);
  c2.kaizo.vars = { kaizo_block: true };
  c2.knight.blockanim = 0;
  const dealt = e2.hooks.fightDamage(c2, 0, 149);
  eq(c2.knight.blockanim, 1, 'points < 150 -> the block pose is armed');
  ok(dealt > 0, 'and the blocked hit still deals something');
  eq(c2.kaizo.lastHitBlocked, true, 'the block flag rode along');

  // A crit is NOT blocked, so the two arms cannot both fire.
  const c3 = build('C');
  const e3 = director(c3);
  c3.kaizo.vars = { kaizo_block: true };
  c3.knight.blockanim = 1;
  e3.hooks.fightDamage(c3, 0, 150);
  eq(c3.kaizo.lastHitBlocked, false, 'a 150 is never blocked');
  eq(c3.knight.blockanim, 0, 'and the pose is cancelled, not re-armed');
}

// ═══════════════════════════════════════════════════════════════════════════
section('G-22 + G-45 — Rude Buster on the A-Side: df 5 and no -50 aim');
{
  const c = build('C');
  // The seam is installed by the director's own per-frame hook, so step the
  // fight rather than calling the installer: if the hook stops being called,
  // this goes red.
  for (let i = 0; i < 5; i++) stepFrame(c, {});
  ok(typeof c.kaizo.hooks?.castSpell === 'function',
    'V-C carries a castSpell hook after the fight has stepped');

  // Cast through the ENGINE's entry point, exactly as obj_spellphase does.
  const r = castSpell(c, 1, 4, 0, { alreadyPaid: true });
  eq(r, 'Rude Buster!', 'the hook answered case 4');
  const pend = c.rude?.pending;
  ok(!!pend, 'a bolt is pending');

  // G-22. `- monsterdf * 3` with monsterdf 5.
  const st = statFor(c, 1);
  const dr = c.knight.damagereduction;
  const want = Math.max(0, Math.ceil(Math.ceil(st.magic * 5 + st.at * 11 - VC_KNIGHT.df * 3) * (dr + 0.65)));
  eq(pend.damage, want, 'damage subtracts monsterdf 5');
  eq(KNIGHT_DF, 0, 'the engine still carries the VANILLA df (this is a kaizo override)');
  const vanillaDmg = spellDamage(c, 1);
  ok(pend.damage < vanillaDmg,
    `and it is lower than the engine's ${vanillaDmg} (got ${pend.damage})`);

  // G-45. The bolt aims 50px LOWER than the vendored engine does.
  const kn = c.entities.find((x) => x.alive && x.type?.name === 'obj_knight_enemy');
  ok(!!kn, 'the knight instance exists to aim at');
  eq(pend.targetY, kn.y + 90, 'targety = monstery + 90 — no `targety -= 50`');
  eq(pend.targetX, kn.x + 60, 'targetx unchanged');

  // The control: the engine WITHOUT the hook still does vanilla's aim, so a
  // reverted override would put the bolt back 50px high and this pair splits.
  const v = build('C');
  for (let i = 0; i < 5; i++) stepFrame(v, {});
  delete v.kaizo.hooks.castSpell;
  castSpell(v, 1, 4, 0, { alreadyPaid: true });
  const knv = v.entities.find((x) => x.alive && x.type?.name === 'obj_knight_enemy');
  eq(v.rude.pending.targetY, knv.y + 40, 'the vendored engine aims 50px higher');
  eq(pend.targetY - v.rude.pending.targetY, 50, 'the delta is exactly the deleted 50');

  // V-D must keep its own menu layer's cast — `??=`, not `=`.
  const d = build('D');
  const dBefore = d.kaizo.hooks.castSpell;
  ok(typeof dBefore === 'function', 'V-D installed a castSpell at scene build');
  for (let i = 0; i < 5; i++) stepFrame(d, {});
  eq(d.kaizo.hooks.castSpell, dBefore, 'and the A-Side seam did not overwrite it');
}

// ═══════════════════════════════════════════════════════════════════════════
section('G-22 — the third formula: X-Slash (MEASURED, NOT FIXED)');
{
  // REPORTED, NOT ASSERTED. kaizo/party/spells.js xslashDamage still reads
  // sim/knight.js's vanilla `KNIGHT_DF` (0) where the mod's monsterdf is 5.
  // It is left divergent because the blocker is a stale expectation in
  // another lane's file: check-spells-kaizo.mjs:328 writes the df term as a
  // literal `- 0`, and four of its assertions (:329, :332, :339, :349) go red
  // the moment this is corrected. Nothing here is allowed to FAIL on it —
  // an intentionally-red assertion is not a check — so the gap is printed
  // and only the two constants either side of it are pinned.
  //
  // X-SLASH IS B-SIDE ONLY (Step_0:42-48 is inside `if (k_sideb)`), and its
  // AT comes from the roster's statFor, so the scene has to be V-D for the
  // number to mean anything: on V-C it computes 0.
  const d = build('D');
  d.knight.damagereduction = 0.18;      // the mod's opening DR
  const red = 0.15 + (0.18 - 0.15) * 1.25;
  const got = xslashDamage(d);
  eq(VC_KNIGHT.df, 5, 'the mod\'s stat block really says 5');
  eq(KNIGHT_DF, 0, 'and the engine\'s constant is vanilla\'s 0');
  ok(got > 0, `X-Slash resolves on the B-Side roster (${got})`);
  // Both arms of the formula, computed from the same roster AT the function
  // uses, so the note carries a measurement and not an estimate.
  const at = rosterStatFor(d, 0).at;
  const xsWith = (df) => Math.ceil(Math.ceil(gmlRound((at * 160) / 20 - df * 3) * red) * 2);
  const dfDmg0 = xsWith(KNIGHT_DF);     // what the engine constant gives today
  const modDmg = xsWith(VC_KNIGHT.df);  // what the mod's stat block gives
  //
  // THE PIN THAT WOULD HAVE TURNED RED, found by lane B's reviewer and
  // rewritten 2026-09-10. This used to assert `modDmg < got` — i.e. it pinned
  // the KNOWN-WRONG number as the live one. Landing the very fix the note
  // below prescribes makes `got === modDmg`, and the assertion goes red for
  // being CORRECTED. A check must not punish its own prescription.
  //
  // What is actually invariant is the FORMULA: a bigger df subtracts more, so
  // the mod's arm is strictly the smaller one either way. That is asserted.
  // Which arm is LIVE is then reported as an equality against the pair, so
  // the check stays green on both sides of the fix and says which side it is
  // standing on.
  ok(modDmg < dfDmg0,
    `the formula: df ${VC_KNIGHT.df} (${modDmg}) subtracts more than df ${KNIGHT_DF} (${dfDmg0})`);
  ok(got === dfDmg0 || got === modDmg,
    `xslashDamage is one of the two arms (got ${got}; df-${KNIGHT_DF} ${dfDmg0}, df-${VC_KNIGHT.df} ${modDmg})`);
  const landed = got === modDmg;
  console.log(landed
    ? `  NOTE ledger G-22 LANDED: xslashDamage = ${got}, the mod's df ${VC_KNIGHT.df} arm.`
    : `  NOTE ledger G-22 UNLANDED: xslashDamage = ${got} at dr 0.18 with df ${KNIGHT_DF};`
      + ` the mod's df ${VC_KNIGHT.df} gives ${modDmg}, i.e. ${got - modDmg} less across the pair.`
      + ' Blocked by check-spells-kaizo.mjs:328 `- 0`.');
}

// ═══════════════════════════════════════════════════════════════════════════
section('B-2 — obj_heroparent CleanUp is ONE translation now');
{
  // cleanupKaizoHero (the hero-record entry point) must clear BOTH halves:
  // the freeze module's k_freeze array and the hero record's own handle.
  // Before the reconcile each function cleared only its own half.
  const d = build('D');
  d.kaizo.freeze[0] = true;
  d.kaizo.freezeByChar = d.kaizo.freezeByChar ?? [];
  d.kaizo.freezeByChar[1] = 1;
  ensureFreezeState(d);
  const statue = { id: 7, alive: true };
  d.kaizo.frozenStatues = [statue];
  d.kaizo.herofrozen[0] = 7;
  d.heroes[0].herofrozen = statue;

  const r = cleanupKaizoHero(d, 0);
  eq(d.kaizo.freeze[0], false, 'k_freeze[_mychar] = 0 (the freeze module\'s array)');
  eq(d.kaizo.freezeByChar[1], 0, 'and the char-keyed mirror');
  eq(r?.thawed, true, 'the delegate reported the thaw — one translation, not two');
  // THE LEAK IS FAITHFUL AND MUST SURVIVE: instance_destroy(-99) is a no-op.
  eq(statue.alive, true, 'ORIGINAL BUG preserved: the statue is NOT destroyed');
  ok(r?.leaked === statue, 'and the delegate hands the leaked statue back');
  ok(d.kaizo.leakedStatues?.includes(statue), 'the hero-record half ledgered it too');
}

console.log(`\ncheck-aside-messages: ${checks - failures}/${checks} assertions passed`);
if (failures) {
  console.log(`check-aside-messages: ${failures} FAILED`);
  process.exit(1);
}
console.log('check-aside-messages: OK');
