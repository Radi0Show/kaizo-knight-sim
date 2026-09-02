#!/usr/bin/env node
// KAIZO V-C/V-D roster — positive assertions on Noelle and the variable-size
// party, against kaizo/party/{roster,noelle,damage,heroes}.js.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// Every block asserts what its feature ADDS, so deleting the feature fails
// loudly rather than passing vacuously:
//   - scr_fixparty's id-order compaction, and that [4,1] is NOT [4,1]
//   - Noelle exists at all, with 120/5/13/1 and DF 1 (not the party's 2)
//   - she stands in SLOT 1's position at SLOT 1's depth — the mod moves
//     nobody (case 115 overwrites scr_encountersetup's short-party re-stack)
//   - her B-Side sprite set, incl. the five _sideb variants and the mod-only
//     spr_noelleb_swooned; her attack sprite IS her spell sprite
//   - targeting on a two-person party: both slots reachable, slot 2 NEVER
//     touched (enforced by a Proxy trap on partyHp, not by inspection),
//     exactly ONE rng draw per hit (choose(1,2) can never fire)
//   - Kris's mercy is GONE: he lands at -999, not -80
//   - mantle absorbs 2 consecutive hits, not vanilla's 3
//   - Noelle x0.5 on scr_damage, x0.75 on scr_damage_maxhp, and NEITHER on a
//     party-wide maxhp hit (the reductions sit inside the aoedamage guard)
//   - partyWiped is true only when BOTH are down
//   - the Kris party-alive multiplier at roster size 2: 2 alive ->
//     ceil(x1.5), 1 alive -> ceil(x2.5) — and that sim/knight.js's krisMult
//     gives 0.5 for the same state, i.e. the copy is load-bearing
//   - Side-B gloom: the min-10 floor, the >120 x0.8 pre-softening, the 45 cap
//     on scr_damage and its ABSENCE on scr_damage_maxhp, the ThornRing
//     immunity, and the preserved slot-vs-charid divergence
//   - N-Action on the menu, and the HoldBreath fallback firing on KRIS's
//     absence (not Susie's — the delta doc's summary is wrong; the GML says
//     `!scr_havechar(1)`)
//   - the hero animator drives Noelle with NOELLE's sprites, freezes into her
//     hurt pose, and leaks the statue exactly as obj_heroparent's CleanUp does
//
//     node kaizo/tools/checks/check-roster.mjs

import { createState } from '../../../sim/state.js';
import { krisMult } from '../../../sim/knight.js';
import { gmlCreate, gmlChoose } from '../../../sim/rng.js';
// THE SEAM under test at the bottom of this file: `sim/damage.js` is the
// VANILLA targeting block and the one place both damage entry points go
// through, so the kaizo translation reaches the fight only if that function
// consults a hook. These three imports are what make "it is wired" an
// assertion rather than a reading.
import {
  knightTarget, scrDamageSingle, scrDamageMaxhp as scrDamageMaxhpSim,
} from '../../../sim/damage.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import {
  WEIRD_ROUTE_PARTY, NORMAL_ROUTE_PARTY, scrFixparty, buildRoster,
  installRoster, rosterSize, slotOf, charIdOf, isUp, havechar, globalChar,
  memberAt, hpOfChar, maxhpOfChar, setFreeze, SLOT_POS, slotDepth,
  CHAR_KRIS, CHAR_NOELLE,
} from '../../party/roster.js';
import {
  NOELLE_STATS, NOELLE_SPRITE_PREFETCH, NOELLE_SIDEB_SPRITES, noelleSprites,
  noelleSwoonSprite, kaizoActsForRoster, NOELLE_GEAR_THORNRING,
  NOELLE_GEAR_SNOWRING, NOELLE_SPELLS, noelleSpellCost, THORN_RING,
} from '../../party/noelle.js';
import {
  scrDamage, scrDamageAll, scrDamageMaxhp, scrDamageAllMaxhp, scrKaizoTarget,
  partyWiped, partyAliveCount, applyKrisPartyMultiplier, vanillaKrisMult,
  scrDamageCalculation, gloomPrecompute, statFor, kaizoKnightTarget } from '../../party/damage.js';
import {
  createKaizoHeroes, stepKaizoHeroes, cleanupKaizoHero, gloomTint,
  HEROFROZEN_NONE, HEROFROZEN_CLEANED,
} from '../../party/heroes.js';

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

function assertDeep(got, want, label) {
  assertEq(JSON.stringify(got), JSON.stringify(want), label);
}

function section(name) {
  console.log(`\n${name}`);
}

/**
 * A fight-shaped state with a Kris + Noelle roster installed.
 *
 * `partyHp` is wrapped in a Proxy that RECORDS every numeric index touched.
 * That is what makes "never indexes a third slot" a real assertion instead of
 * a reading of the source: any `partyHp[2]` anywhere under the damage chain
 * shows up in `state.__touched`.
 */
function weirdRouteState({ seed = 12345, sideb = true, gear = null } = {}) {
  const state = createState({ seed });
  state.gmlRng = gmlCreate(seed);
  installRoster(state, { charIds: WEIRD_ROUTE_PARTY, sideb, gear });
  state.heroes = createKaizoHeroes(state);
  const touched = new Set();
  const raw = state.partyHp;
  state.__touched = touched;
  state.__rawHp = raw;
  state.partyHp = new Proxy(raw, {
    get(t, k) {
      if (typeof k === 'string' && /^\d+$/.test(k)) touched.add(Number(k));
      return t[k];
    },
    set(t, k, v) {
      if (typeof k === 'string' && /^\d+$/.test(k)) touched.add(Number(k));
      t[k] = v;
      return true;
    },
  });
  return state;
}

// ═══════════════════════════════════════════════════════════════════════════
section('scr_fixparty — the compaction, by character id');

assertDeep(scrFixparty([1, 4]), [1, 4, 0], 'Kris + Noelle compacts to [1,4,0]');
assertDeep(scrFixparty([4, 1]), [1, 4, 0],
  '[4,1] is SORTED to [1,4,0] — you cannot ask for Noelle in slot 0');
assertDeep(scrFixparty([1, 2, 3]), [1, 2, 3], 'the vanilla three are unchanged');
assertDeep(scrFixparty([2, 4]), [2, 4, 0], 'a Kris-less party still compacts left');
assertDeep(scrFixparty([4]), [4, 0, 0], 'Noelle alone lands in slot 0');
assertDeep(scrFixparty([1, 1, 4]), [1, 4, 0], 'duplicates collapse (it is a SET)');
assertDeep(scrFixparty([]), [0, 0, 0], 'an empty request stays empty');
assertDeep(WEIRD_ROUTE_PARTY, [1, 4], 'WEIRD_ROUTE_PARTY is Kris + Noelle');
assertDeep(NORMAL_ROUTE_PARTY, [1, 2, 3], 'NORMAL_ROUTE_PARTY is the vanilla three');

// ═══════════════════════════════════════════════════════════════════════════
section('Noelle — stats, position, depth');

const roster = buildRoster(WEIRD_ROUTE_PARTY, { sideb: true });
assertEq(roster.length, 2, 'the Weird Route roster is TWO members long');
assertEq(roster[0].charId, CHAR_KRIS, 'slot 0 is Kris');
assertEq(roster[1].charId, CHAR_NOELLE, 'slot 1 is Noelle');

const noelle = roster[1];
assertEq(noelle.name, 'NOELLE', 'name');
assertEq(noelle.maxhp, 120, 'maxhp 120 (chapter_override line 55)');
assertEq(noelle.at, 5, 'at 5 (line 57)');
assertEq(noelle.magic, 13, 'mag 13 (line 58)');
assertEq(noelle.df, 1, 'df 1 (line 59) — NOT the base 2 the other three carry');
assertEq(roster[0].df, 2, '...and Kris still has 2, so the 1 is really hers');
assertDeep(NOELLE_STATS, { maxhp: 120, at: 5, magic: 13, df: 1 }, 'the stat block');

// THE MOD MOVES NOBODY: scr_encountersetup's short-party re-stack (heromakey
// 100/180) is overwritten by case 115's fixed three points.
assertDeep(noelle.pos, { ...SLOT_POS[1] }, 'Noelle stands at SLOT 1 (80,142)');
assertDeep(roster[0].pos, { ...SLOT_POS[0] }, 'Kris stands at SLOT 0 (126,104)');
assertEq(noelle.pos.y, 142, 'and NOT at the short-party y of 180');
assertEq(roster[0].pos.y, 104, 'and Kris NOT at the short-party y of 100');
assertEq(noelle.depth, 180, 'depth 180 = 200 - 1*20 — the SLOT, not the character');
assertEq(roster[0].depth, 200, 'Kris depth 200');
assertEq(slotDepth(2), 160, 'slotDepth follows 200 - i*20');
assertEq(noelle.body.myheight, 86, 'myheight 86');
assertEq(noelle.body.mywidth, 52, 'mywidth 52');

// ═══════════════════════════════════════════════════════════════════════════
section('Noelle — the sprite set, and the _sideb branch the mod turns on');

const base = noelleSprites(false);
const sb = noelleSprites(true);

assertEq(base.idle, 'spr_noelleb_idle', 'base idle');
assertEq(sb.idle, 'spr_noelleb_idle_sideb', 'B-Side idle');
assertEq(base.attack, 'spr_noelleb_attack', 'base attack');
assertEq(sb.attack, 'spr_noelleb_spell',
  'B-SIDE: her attack sprite IS her spell sprite — Snowgrave Noelle does not swing');
assertEq(sb.attackready, 'spr_noelleb_spellready',
  'B-Side attackready is spellready (the mod\'s one edit inside the branch)');
assertEq(base.attackframes, 4, 'base attackframes 4');
assertEq(sb.attackframes, 6, 'B-Side attackframes 6');
assertEq(base.defendframes, 0, 'base defendframes 0 — hers, and it is real');
assertEq(sb.defendframes, 5, 'B-Side defendframes 5');
assertEq(base.hurt, 'spr_noelleb_hurt', 'base hurt');
assertEq(sb.hurt, 'spr_noelleb_hurt_sideb', 'B-Side hurt');
assertEq(sb.defend, 'spr_noelleb_defend_sideb', 'B-Side defend');
assertEq(sb.victory, 'spr_noelleb_pray', 'B-Side victory is the prayer');
assertEq(sb.victoryframes, 10, 'B-Side victoryframes 10');
assertEq(base.spellframes, 6, 'spellframes 6');
assertEq(base.itemframes, 9, 'itemframes 9');
assertEq(base.actframes, 7, 'actframes 7');
assertEq(base.actreturnframes, 10, 'actreturnframes 10');
assertEq(base.act, 'spr_noelleb_act', 'act sprite');
assertEq(base.spell, 'spr_noelleb_spell', 'spell sprite');

assertEq(noelleSwoonSprite(true), 'spr_noelleb_swooned',
  'B-Side swoon is the MOD-ONLY spr_noelleb_swooned');
assertEq(noelleSwoonSprite(false), 'spr_noelleb_defeat', 'off the B-Side she keeps defeat');
assertEq(noelle.sprites.swoon, 'spr_noelleb_swooned', 'the roster entry carries it');
assertEq(noelle.sprites.frozen, 'spr_noelleb_hurt_sideb',
  'her freeze statue is her HURT pose — only Kris is special-cased');
assertEq(roster[0].sprites.frozen, 'spr_krisb_frozen', 'Kris freezes as spr_krisb_frozen');
assertEq(roster[0].sprites.swoon, 'spr_kris_fell', 'Kris falls as spr_kris_fell');

assertEq(NOELLE_SIDEB_SPRITES.length, 5, 'FIVE _sideb variants are prefetched');
for (const s of NOELLE_SIDEB_SPRITES) {
  assert(NOELLE_SPRITE_PREFETCH.includes(s), `prefetch list contains ${s}`);
  assert(s.endsWith('_sideb'), `${s} really carries the _sideb suffix`);
}
assert(NOELLE_SPRITE_PREFETCH.includes('spr_noelleb_swooned'),
  'the prefetch list includes the mod-only spr_noelleb_swooned');
assertEq(NOELLE_SPRITE_PREFETCH.length, 23, 'the prefetch list is 23 sprites long');

// ═══════════════════════════════════════════════════════════════════════════
section('Noelle — gear, spells, and the ThornRing');

assertEq(NOELLE_GEAR_THORNRING.weapon, THORN_RING, 'the Weird Route weapon is 13');
assertEq(NOELLE_GEAR_SNOWRING.weapon, 12, 'the SnowRing build is 12');
assertDeep(NOELLE_GEAR_THORNRING.armor, [14, 22], 'armour 14 + 22 from scr_gamestart');
assertDeep(NOELLE_SPELLS, [2, 8, 9], 'spell list 2/8/9 — SnowGrave is NOT granted here');
assertEq(noelleSpellCost(9, THORN_RING), 20, 'IceShock 40 -> 20 with the ThornRing');
assertEq(noelleSpellCost(9, 12), 40, '...and stays 40 with the SnowRing');
assertEq(noelleSpellCost(10, THORN_RING, 100), 100, 'SnowGrave maxtension*2 halved');

// ═══════════════════════════════════════════════════════════════════════════
section('installRoster — every slot array follows the roster, not the number 3');

const st = weirdRouteState();
assertEq(rosterSize(st), 2, 'rosterSize is 2');
assertDeep(globalChar(st), [1, 4, 0], 'global.char is [1,4,0]');
assertEq(st.__rawHp.length, 2, 'partyHp has TWO entries');
assertDeep([...st.__rawHp], [160, 120], 'and they are Kris 160 / Noelle 120');
for (const key of ['charaction', 'chardead', 'charmove', 'charcantarget', 'charspecial']) {
  assertEq(st[key].length, 2, `${key} is roster-length`);
}
assertEq(st.kaizo.freeze.length, 2, 'kaizo.freeze is SLOT-indexed, length 2');
assertEq(st.kaizo.gloom.length, 2, 'kaizo.gloom is SLOT-indexed, length 2');
assertEq(st.kaizo.gloomByChar.length, 5,
  'gloomByChar mirrors the mod\'s own [0,0,0,0,0] CHARACTER-indexed array');
assertEq(st.kaizo.freezeByChar.length, 5, 'freezeByChar likewise');
assertEq(st.kaizo.sideb, true, 'sideb is stamped');

assertEq(slotOf(st, CHAR_NOELLE), 1, 'slotOf(Noelle) is 1');
assertEq(slotOf(st, CHAR_KRIS), 0, 'slotOf(Kris) is 0');
assertEq(slotOf(st, 2), -1, 'slotOf(Susie) is -1 — she is not here');
assertEq(charIdOf(st, 1), CHAR_NOELLE, 'charIdOf(1) is Noelle');
assertEq(charIdOf(st, 2), 0, 'charIdOf(2) is 0 — the empty slot');
assertEq(havechar(st, 1), 1, 'scr_havechar(1) — Kris IS here');
assertEq(havechar(st, 4), 1, 'scr_havechar(4) — Noelle IS here');
assertEq(havechar(st, 2), 0, 'scr_havechar(2) — Susie is not');
assertEq(isUp(st, 0), true, 'Kris is up');
assertEq(isUp(st, 1), true, 'Noelle is up');
assertEq(isUp(st, 2), false, 'slot 2 is never "up" — there is nobody there');
assertEq(hpOfChar(st, CHAR_NOELLE), 120, 'hp[4] reads through the slot');
assertEq(maxhpOfChar(st, CHAR_NOELLE), 120, 'maxhp[4]');
assertEq(maxhpOfChar(st, 0), 0, 'maxhp[0] is 0, as scr_gamestart sets it');
assertEq(memberAt(st, 2), null, 'there is no member at slot 2');

// ═══════════════════════════════════════════════════════════════════════════
section('scr_damage_calculation — the two indexings meet');

// Noelle: base df 1 + ThornRing 0 + SilverWatch 2 + RoyalPin 3 = 6 steps,
// against maxhp 120 (thresholds 24 and 15). 100 -> six -3 steps -> 82.
assertEq(statFor(st, 1).df, 6, 'Noelle battledf = 1 + 0 + 2 + 3');
assertEq(scrDamageCalculation(st, 100, 1), 82, 'the defence walk uses HER maxhp');
assertEq(scrDamageCalculation(st, 1, 1), 1, 'the inner max(_tdamage, 1) floor holds');

// ═══════════════════════════════════════════════════════════════════════════
section('scr_kaizo_target — two slots, one draw, never a third');

{
  // No mantle anywhere, so every hit takes the weighted-random branch.
  const s = weirdRouteState({
    seed: 777,
    gear: { 1: { weapon: 23, armor: [27] }, 4: { ...NOELLE_GEAR_THORNRING } },
  });
  const hits = { 0: 0, 1: 0, other: 0 };
  let drawsBefore = s.gmlRng.draws ?? 0;
  const perHit = [];
  for (let i = 0; i < 400; i++) {
    const t = scrKaizoTarget(s, 0);
    if (t === 0 || t === 1) hits[t] += 1;
    else hits.other += 1;
    const now = s.gmlRng.draws ?? 0;
    perHit.push(now - drawsBefore);
    drawsBefore = now;
  }
  assertEq(hits.other, 0, 'every roll lands on slot 0 or slot 1 — never slot 2');
  assert(hits[0] > 0, 'Kris is reachable (his vanilla mercy is gone)');
  assert(hits[1] > 0, 'Noelle is reachable');
  assert(perHit.every((d) => d === 1),
    'exactly ONE rng draw per hit — choose(1,2) can never fire with an empty slot 2');
  // With Noelle at full HP, _sus clamps to 1.0 and _krisrange = 2 - 1 = 1, so
  // Kris takes the roll whenever random_range(0,2) <= 1: half the hits.
  const krisShare = hits[0] / 400;
  assert(krisShare > 0.35 && krisShare < 0.65,
    `Kris takes about half the hits at full party HP (got ${krisShare.toFixed(3)})`);
}

{
  // ...and as Noelle weakens, Kris's share GROWS. That is the inversion of
  // the vanilla rule, and it is the whole point of the rewrite.
  const s = weirdRouteState({
    seed: 4242,
    gear: { 1: { weapon: 23, armor: [27] }, 4: { ...NOELLE_GEAR_THORNRING } },
  });
  s.__rawHp[1] = 10; // Noelle at 10/120 -> _sus clamps to the 0.45 floor
  let kris = 0;
  for (let i = 0; i < 400; i++) if (scrKaizoTarget(s, 0) === 0) kris += 1;
  const share = kris / 400;
  assert(share > 0.65,
    `a weakened Noelle pushes Kris's share past 65% (got ${share.toFixed(3)})`);
}

{
  // A DOWNED Kris forces every hit onto the companion: _krisrange = -1.
  const s = weirdRouteState({ seed: 99 });
  s.__rawHp[0] = -999;
  let allNoelle = true;
  for (let i = 0; i < 50; i++) if (scrKaizoTarget(s, 0) !== 1) allNoelle = false;
  assert(allNoelle, 'a downed Kris forces every hit onto Noelle (_krisrange = -1)');
}

// ═══════════════════════════════════════════════════════════════════════════
section('the ShadowMantle absorbs TWO consecutive hits, not vanilla\'s three');

{
  // Kris wears armour 23 by default (DEFAULT_GEAR[0]).
  const s = weirdRouteState({ seed: 31337 });
  assert((s.kaizo.roster[0].gear.armor ?? []).includes(23), 'Kris starts mantled');
  s.knight.damagecounter = 0;
  const t1 = scrKaizoTarget(s, 1);
  const c1 = s.knight.damagecounter;
  const t2 = scrKaizoTarget(s, 1);
  const c2 = s.knight.damagecounter;
  const drawsBefore = s.gmlRng.draws ?? 0;
  const t3 = scrKaizoTarget(s, 1);
  const drawsAfter = s.gmlRng.draws ?? 0;
  assertEq(t1, 0, 'hit 1 is pulled onto the wearer');
  assertEq(c1, 1, 'damagecounter 1');
  assertEq(t2, 0, 'hit 2 is pulled onto the wearer');
  assertEq(c2, 2, 'damagecounter 2');
  assert(drawsAfter - drawsBefore >= 1,
    'hit 3 ROLLS — `damagecounter >= 2` disabled the redirect (vanilla ran to < 3)');
  assert(t3 === 0 || t3 === 1, 'and the roll still stays inside the roster');
  // The redirect itself costs no RNG at all.
  const s2 = weirdRouteState({ seed: 5 });
  const before = s2.gmlRng.draws ?? 0;
  scrKaizoTarget(s2, 1);
  assertEq((s2.gmlRng.draws ?? 0) - before, 0, 'a mantle redirect draws NOTHING');
}

{
  // `aoedamage == true` short-circuits the whole function: no roll, no counter.
  const s = weirdRouteState({ seed: 6 });
  s.knight.aoedamage = true;
  const before = s.gmlRng.draws ?? 0;
  assertEq(scrKaizoTarget(s, 1), 1, 'AoE keeps the caller\'s target');
  assertEq((s.gmlRng.draws ?? 0) - before, 0, 'AoE draws NOTHING');
  assertEq(s.knight.damagecounter, 0, 'AoE does not move the mantle counter');
}

// ═══════════════════════════════════════════════════════════════════════════
section('scr_damage — Noelle x0.5, Kris\'s mercy removed, slot 2 untouched');

{
  const s = weirdRouteState({ seed: 2024 });
  // aoe:true pins the target so the arithmetic is the thing under test.
  const dealt = scrDamage(s, 100, 1, { aoe: true });
  // 100 -> defence walk (6 steps, -3 each) = 82 -> Noelle round(82*0.5) = 41.
  assertEq(dealt, 41, 'Noelle takes round(82 * 0.5) = 41 from a 100 hit');
  assertEq(s.__rawHp[1], 79, 'her HP goes 120 -> 79');
}

{
  const s = weirdRouteState({ seed: 2024 });
  // Kris unmantled, so only the defence walk applies and there is no halving.
  s.kaizo.gear = { 1: { weapon: 23, armor: [27] } };
  const dealt = scrDamage(s, 100, 0, { aoe: true });
  const krisDf = statFor(s, 0).df;
  let expect = 100;
  for (let i = 0; i < krisDf; i++) expect -= expect > 32 ? 3 : (expect > 20 ? 2 : 1);
  assertEq(dealt, expect, 'Kris is NOT halved — the x0.5 is Noelle\'s alone');
  assert(dealt > 41, 'and he takes strictly more than she does from the same hit');
}

{
  // KRIS'S MERCY IS GONE. Vanilla: round(-160 / 2) = -80, healable.
  const s = weirdRouteState({ seed: 11 });
  s.__rawHp[0] = 5;
  scrDamage(s, 400, 0, { aoe: true });
  assertEq(s.__rawHp[0], -999, 'Kris falls to -999, not vanilla\'s -80');
  assertEq(s.chardead[0], 1, 'scr_dead ran');
  assert(s.__rawHp[0] !== -80, 'the vanilla DOWN value never appears');
}

{
  // THE PROXY TRAP: run a long AoE + single-target mix and prove nothing ever
  // reaches for a third slot.
  const s = weirdRouteState({ seed: 8080 });
  for (let i = 0; i < 60; i++) {
    s.invTimer = -1;
    scrDamageAll(s, 4);
    s.invTimer = -1;
    scrDamage(s, 6, 0, {});
    if (s.__rawHp[0] < 0 && s.__rawHp[1] < 0) {
      s.__rawHp[0] = 160;
      s.__rawHp[1] = 120;
      s.chardead[0] = 0;
      s.chardead[1] = 0;
    }
  }
  assert(!s.__touched.has(2),
    'partyHp[2] is NEVER read or written across 60 AoE + 60 single hits');
  assert(s.__touched.has(0) && s.__touched.has(1),
    '...while both real slots are exercised (so the trap is not vacuous)');
}

{
  // scr_damage_all's `global.char[ti] != 0` guard: exactly two members hit.
  const s = weirdRouteState({ seed: 606 });
  s.invTimer = -1;
  const before = [...s.__rawHp];
  scrDamageAll(s, 30);
  assert(s.__rawHp[0] < before[0], 'Kris took the AoE');
  assert(s.__rawHp[1] < before[1], 'Noelle took the AoE');
  assertEq(s.kaizo.hpPhantom, 0, 'and the phantom slot-2 cell was never touched');
}

// ═══════════════════════════════════════════════════════════════════════════
section('scr_damage_maxhp — x0.75, and NOT on a party-wide hit');

{
  // Down Noelle and every roll must land on Kris (the companion branch has
  // nobody left to overwrite him with), so the arithmetic is deterministic.
  // Kris is mantled by default: arg0 0.66 -> 0.33, ceil(160 * 0.33) = 53.
  const s = weirdRouteState({ seed: 300, sideb: false });
  s.__rawHp[1] = -999;
  s.invTimer = -1;
  const dealt = scrDamageMaxhp(s, 0.66, true, false, { target: 0 });
  assertEq(dealt, 53, 'the mantle halves the FRACTION, not the result: ceil(160 * 0.33)');
  assertEq(s.__rawHp[0], 160 - 53, 'and Kris\'s HP moves by exactly that');
}

{
  // The reductions sit INSIDE the aoedamage guard, so an AoE maxhp hit gives
  // Noelle the FULL fraction: ceil(120 * 0.5) = 60, no x0.75, no mantle.
  const s = weirdRouteState({ seed: 301, sideb: false });
  s.invTimer = -1;
  scrDamageAllMaxhp(s, 0.5, true, false);
  assertEq(s.__rawHp[1], 120 - 60,
    'Noelle takes the FULL 50% of max HP on an AoE — her x0.75 is inside the guard');
}

{
  // ...whereas the single-target path with the roll suppressed does apply it.
  const s = weirdRouteState({ seed: 302, sideb: false });
  s.knight.aoedamage = false;
  s.roaringActive = false;
  s.invTimer = -1;
  // Force the target by downing Kris so the roll can only land on Noelle.
  s.__rawHp[0] = -999;
  scrDamageMaxhp(s, 0.5, true, false, { target: 1 });
  assertEq(s.__rawHp[1], 120 - Math.ceil(120 * 0.5 * 0.75),
    'single-target maxhp DOES give her x0.75 (ceil(120*0.375) = 45)');
}

// ═══════════════════════════════════════════════════════════════════════════
section('partyWiped — true only when BOTH are down');

{
  const s = weirdRouteState({ seed: 1 });
  assertEq(partyWiped(s), false, 'both up -> not wiped');
  s.__rawHp[0] = -999;
  assertEq(partyWiped(s), false, 'Kris down, Noelle up -> NOT wiped');
  s.__rawHp[0] = 160;
  s.__rawHp[1] = -999;
  assertEq(partyWiped(s), false, 'Noelle down, Kris up -> NOT wiped');
  s.__rawHp[0] = -999;
  assertEq(partyWiped(s), true, 'BOTH down -> wiped');
  assert(!s.__touched.has(2),
    'and it decided all four cases without ever reading a third slot');
}

{
  // The same predicate must still be right for three.
  const s3 = createState({ seed: 2 });
  installRoster(s3, { charIds: NORMAL_ROUTE_PARTY, sideb: false });
  assertEq(partyWiped(s3), false, 'three-person party, all up');
  s3.partyHp[0] = -999;
  s3.partyHp[1] = -999;
  assertEq(partyWiped(s3), false, 'two of three down -> not wiped');
  s3.partyHp[2] = -999;
  assertEq(partyWiped(s3), true, 'all three down -> wiped');
}

// ═══════════════════════════════════════════════════════════════════════════
section('the Kris party-alive multiplier at roster size 2');
// obj_heroparent Step, MOD hunk 3. This is a genuine behavioural difference
// from the three-person fight and the thing a vacuous check would miss.

{
  const s = weirdRouteState({ seed: 4 });
  assertEq(partyAliveCount(s), 2, 'Kris + Noelle both alive = 2');
  assertEq(applyKrisPartyMultiplier(100, s), 150, '2 alive -> ceil(100 * 1.5) = 150');
  assertEq(applyKrisPartyMultiplier(7, s), 11, '...and it CEILS: ceil(7 * 1.5) = 11');
  assertEq(applyKrisPartyMultiplier(1, s), 2, 'ceil(1 * 1.5) = 2');

  // THE COPY IS LOAD-BEARING: sim/knight.js's krisMult, given this exact
  // state, reads partyHp[2] (undefined) and concludes the party is intact —
  // returning the VANILLA 0.5 halving. 0.5 against 1.5 is a threefold error
  // on every Kris swing of the Weird Route.
  assertEq(krisMult(s, 0), 0.5,
    'sim/knight.js krisMult returns the vanilla 0.5 here (why the copy exists)');
  assert(applyKrisPartyMultiplier(100, s) !== Math.round(100 * krisMult(s, 0)),
    'kaizo 150 vs sim 50 — the two genuinely disagree at roster size 2');
  assertEq(vanillaKrisMult(s), 1,
    'the vanilla rule re-expressed on this roster says x1 — a different wrong answer');
  assert(vanillaKrisMult(s) !== 1.5,
    'neither vanilla reading can produce the kaizo x1.5');

  s.__rawHp[1] = -999;
  assertEq(partyAliveCount(s), 1, 'Noelle down -> 1 alive');
  assertEq(applyKrisPartyMultiplier(100, s), 250, '1 alive -> ceil(100 * 2.5) = 250');
  assertEq(applyKrisPartyMultiplier(7, s), 18, 'ceil(7 * 2.5) = 18');

  s.__rawHp[0] = -999;
  assertEq(partyAliveCount(s), 0, 'both down -> 0 alive');
  assertEq(applyKrisPartyMultiplier(100, s), 250, '0 alive takes the <= 1 branch too');

  // `> 0`, not vanilla's `< 0`: exactly 0 HP counts as DEAD here.
  s.__rawHp[0] = 0;
  s.__rawHp[1] = 0;
  assertEq(partyAliveCount(s), 0, 'HP exactly 0 counts as dead (the mod uses > 0)');
}

{
  // Three alive gets NO multiplier at all — and vanilla HALVED it there, so
  // the kaizo full-party Kris hits twice as hard as the vanilla one.
  const s3 = createState({ seed: 5 });
  installRoster(s3, { charIds: NORMAL_ROUTE_PARTY, sideb: false });
  assertEq(partyAliveCount(s3), 3, 'the vanilla three are all alive');
  assertEq(applyKrisPartyMultiplier(100, s3), 100, '3 alive -> unchanged (no x0.5)');
  assertEq(krisMult(s3, 0), 0.5, '...where vanilla halves it');
  s3.partyHp[1] = -999;
  assertEq(partyAliveCount(s3), 2, 'lose Susie -> 2 alive');
  assertEq(applyKrisPartyMultiplier(100, s3), 150, 'and the three-person party reaches x1.5');
}

// ═══════════════════════════════════════════════════════════════════════════
section('Side-B GLOOM');

assertDeep(gloomPrecompute(60), { gloomdmg: 10, damage: 60 },
  'ceil(60/6) = 10, and 60 is not softened');
assertDeep(gloomPrecompute(12), { gloomdmg: 10, damage: 12 },
  'the min-10 floor lifts ceil(12/6) = 2 to 10');
assertDeep(gloomPrecompute(200), { gloomdmg: 34, damage: 160 },
  'over 120: gloom from the PRE-softened 200 (34), damage becomes ceil(160)');
assertDeep(gloomPrecompute(121), { gloomdmg: 21, damage: 97 },
  'the softening threshold is strictly > 120');
assertDeep(gloomPrecompute(120), { gloomdmg: 20, damage: 120 },
  '...so 120 exactly is NOT softened');

{
  const s = weirdRouteState({ seed: 900, sideb: true });
  scrDamage(s, 60, 0, { aoe: true });
  assertEq(s.kaizo.gloom[0], 10, 'Kris banks 10 gloom from a 60 hit');
  assertEq(s.kaizo.gloomByChar[1], 10, 'and the CHARACTER mirror agrees (index 1)');
  // Keep him topped up so the `min(hp - 1)` clamp is not what stops the
  // meter — the 45 cap has to be the thing doing the work.
  for (let i = 0; i < 12; i++) {
    s.__rawHp[0] = 160;
    s.invTimer = -1;
    scrDamage(s, 60, 0, { aoe: true });
  }
  assertEq(s.kaizo.gloom[0], 45, 'scr_damage caps gloom at 45');
  assertEq(s.kaizo.gloomByChar[1], 45, 'the char mirror caps with it');
  // ...and the hp - 1 clamp is real too, and TIGHTER when HP is low.
  s.__rawHp[0] = 20;
  s.invTimer = -1;
  scrDamage(s, 60, 0, { aoe: true });
  assert(s.kaizo.gloom[0] <= s.__rawHp[0] - 1,
    'gloom is clamped to hp - 1 whenever that bites first');
}

{
  // THE THORNRING MAKES HER IMMUNE — and the Weird Route loadout IS the
  // ThornRing, so on the B-Side gloom accrues on Kris alone.
  const s = weirdRouteState({ seed: 901, sideb: true });
  scrDamage(s, 60, 1, { aoe: true });
  assertEq(s.kaizo.gloom[1], 0, 'ThornRing Noelle banks NO gloom');
  const s2 = weirdRouteState({
    seed: 902, sideb: true, gear: { 4: { ...NOELLE_GEAR_SNOWRING } },
  });
  scrDamage(s2, 60, 1, { aoe: true });
  assert(s2.kaizo.gloom[1] > 0, '...but a SnowRing Noelle does');
  // THE PRESERVED DIVERGENCE (deltas/INDEX.md item 9): the damage scripts
  // write k_gloom at the CHAR id (4), while scr_charbox reads it at slot+1
  // (2, Susie's cell). The two disagree the moment Noelle joins.
  assertEq(s2.kaizo.gloomByChar[4], s2.kaizo.gloom[1],
    'the char mirror carries Noelle\'s gloom at index 4');
  assertEq(s2.kaizo.gloomByChar[2], 0,
    'and index slot+1 = 2 is EMPTY — the scr_charbox divergence, preserved');
}

{
  // scr_damage_maxhp has NO 45 cap — only min(hp - 1). Asymmetric, faithful.
  const s = weirdRouteState({ seed: 903, sideb: true, gear: { 4: { ...NOELLE_GEAR_SNOWRING } } });
  s.__rawHp[0] = -999; // downed Kris -> _krisrange = -1, every roll hits Noelle
  for (let i = 0; i < 8; i++) {
    s.__rawHp[1] = 120;
    s.invTimer = -1;
    scrDamageMaxhp(s, 0.5, true, true, { target: 1 });
  }
  assert(s.kaizo.gloom[1] > 45,
    `the fraction path pushes gloom past 45 — no cap on that script (got ${s.kaizo.gloom[1]})`);
}

// ═══════════════════════════════════════════════════════════════════════════
section('the act menu — N-Action, and the KRIS-absent fallback');

{
  const a = kaizoActsForRoster([1, 4, 0]);
  assertEq(a.length, 2, 'two slots, two act lists');
  assertEq(a[0][0].name, 'Check', 'Kris keeps Check');
  assertEq(a[0][1].name, 'HoldBreath', '...and HoldBreath');
  assertEq(a[1][0].name, 'N-Action', 'Noelle gets N-Action — the mod\'s addition');
  assertEq(a[1].length, 1, 'and only that one');
}
{
  const a = kaizoActsForRoster([1, 2, 3]);
  assertEq(a[1][0].name, 'S-Action', 'Susie keeps S-Action while Kris is here');
  assertEq(a[2][0].name, 'R-Action', 'Ralsei keeps R-Action');
}
{
  // `if (!scr_havechar(1))` — KRIS absent, not Susie. All three companion
  // slot-0 acts become HoldBreath.
  const a = kaizoActsForRoster([2, 3, 4]);
  assertEq(a[0][0].name, 'HoldBreath', 'Kris gone: Susie\'s act becomes HoldBreath');
  assertEq(a[1][0].name, 'HoldBreath', '...and Ralsei\'s');
  assertEq(a[2][0].name, 'HoldBreath', '...and Noelle\'s');
}
{
  // SUSIE absent with Kris present must NOT trigger it — this is the exact
  // assertion the delta doc's wording would have failed.
  const a = kaizoActsForRoster([1, 3, 4]);
  assertEq(a[2][0].name, 'N-Action',
    'Susie absent but Kris present: N-Action survives (the gate is havechar(1))');
  const b = kaizoActsForRoster([1, 4, 0]);
  assertEq(b[1][0].name, 'N-Action', 'and the Weird Route roster keeps it');
}

// ═══════════════════════════════════════════════════════════════════════════
section('the hero animator — Noelle\'s own sprites, freeze, and the statue leak');

{
  const s = weirdRouteState({ seed: 70 });
  assertEq(s.heroes.length, 2, 'two hero records, not three');
  stepKaizoHeroes(s);
  assertEq(s.heroes[0].sprite, 'spr_krisb_idle', 'Kris idles as Kris');
  assertEq(s.heroes[1].sprite, 'spr_noelleb_idle_sideb',
    'slot 1 idles as B-SIDE NOELLE — the whole point of the copy');
  assert(s.heroes[1].sprite !== 'spr_susieb_idle',
    '...and emphatically NOT as Susie, which slot-indexed HERO_SPRITES would give');
  assertEq(s.heroes[1].herofrozen, HEROFROZEN_NONE, 'herofrozen starts at -4');
  assertDeep(s.heroes[1].blend, [255, 255, 255], 'no gloom yet -> white');

  // Downed heroes hold the defeat pose, and hers is the mod-only swoon.
  s.__rawHp[1] = -999;
  stepKaizoHeroes(s);
  assertEq(s.heroes[1].sprite, 'spr_noelleb_swooned', 'downed Noelle draws spr_noelleb_swooned');
  s.__rawHp[0] = -999;
  stepKaizoHeroes(s);
  assertEq(s.heroes[0].sprite, 'spr_kris_fell', 'downed Kris draws spr_kris_fell');
}

{
  const s = weirdRouteState({ seed: 71 });
  setFreeze(s, 1, true);
  assertEq(s.kaizo.freeze[1], true, 'the slot array says frozen');
  assertEq(s.kaizo.freezeByChar[4], 1, 'and the CHARACTER mirror says index 4');
  stepKaizoHeroes(s);
  assertEq(s.heroes[1].frozenHidden, true, 'her Draw exits — the hero is hidden');
  assert(s.heroes[1].herofrozen !== HEROFROZEN_NONE, 'a statue was spawned');
  assertEq(s.heroes[1].herofrozen.sprite, 'spr_noelleb_hurt_sideb',
    'the statue wears her HURT sprite (only Kris is special-cased)');
  assertEq(s.heroes[1].herofrozen.depth, 180, 'and inherits her depth');
  const first = s.heroes[1].herofrozen;
  stepKaizoHeroes(s);
  assertEq(s.heroes[1].herofrozen, first, 'it spawns ONCE — `if (herofrozen == -4)`');

  // ORIGINAL BUG, PRESERVED: CleanUp writes -99 BEFORE instance_destroy, so
  // the destroy misses and the statue outlives its hero.
  cleanupKaizoHero(s, 1);
  assertEq(s.kaizo.freezeByChar[4], 0, 'CleanUp DOES clear k_freeze');
  assertEq(s.heroes[1].herofrozen, HEROFROZEN_CLEANED, 'the handle becomes -99');
  assertEq(s.kaizo.leakedStatues.length, 1,
    'and the statue LEAKS — the destroy targeted -99 (ORIGINAL BUG, kept)');
}

{
  const s = weirdRouteState({ seed: 72, sideb: true, gear: { 4: { ...NOELLE_GEAR_SNOWRING } } });
  s.kaizo.gloomByChar[4] = 45;
  stepKaizoHeroes(s);
  const tint = s.heroes[1].blend;
  assert(tint[0] < 255 && tint[2] > tint[0], 'gloom tints her toward the blue gloom colour');
  assertDeep(gloomTint(0), [255, 255, 255], 'gloom 0 is white');
  assertDeep(gloomTint(45), gloomTint(1000), 'the tint saturates at min(g/150, 0.3)');
  assert(JSON.stringify(gloomTint(45)) !== JSON.stringify(gloomTint(0)),
    '...and 45 is visibly different from 0');

  // Off the B-Side there is no tint at all.
  const sa = weirdRouteState({ seed: 73, sideb: false });
  sa.kaizo.gloomByChar[4] = 45;
  stepKaizoHeroes(sa);
  assertDeep(sa.heroes[1].blend, [255, 255, 255], 'no gloom tint off the B-Side');
}

// ═══════════════════════════════════════════════════════════════════════════
section('THE SEAM — scr_kaizo_target reaching sim/damage.js');

// The module above was verified in isolation for a long time and REACHED
// NOTHING: the fight ran vanilla targeting because `sim/damage.js` cannot
// import `kaizo/` (the isolation contract) and nothing handed the translation
// across. That is the `state.pinnedShuffle` failure class CLAUDE.md records —
// a thing invented in one place and never read by another, passing its own
// suite the whole time. These blocks assert the WIRING, not the translation,
// and they are the half a unit test of scrKaizoTarget structurally cannot see.
//
// THE MEASURABLE DIFFERENCE IS THE DRAW COUNT, and there are three distinct
// signatures. All three are asserted below so that swapping any one of them
// in for another fails loudly:
//
//   vanilla (v105 scr_damage.gml:78-152, Kris in the ShadowMantle)   1 1 2
//   kaizo,  no armour 23 anywhere (kaizo_settings_init.gml:450-478)  2 2 2
//   kaizo,  Kris in the ShadowMantle (the :479-483 absorb branch)    0 0 2
//
// After the first hit of a turn those put every downstream RNG-derived value
// at a different stream position, which is why targeting shows up in the
// whole-fight diff as bullet POSITIONS and POPULATIONS and never as HP (the
// recorder pins party HP; see verify-kaizo-fullfight's own footer).

/** A fight-shaped state with NO kaizo scene — what `sim/` alone builds. */
function vanillaTargetState(seed) {
  const s = createState({ seed });
  s.gmlRng = gmlCreate(seed);
  // knightTarget writes `damagecounter` on the knight; a scene supplies one.
  s.knight = { damagecounter: 0 };
  return s;
}

/**
 * n hits through `knightTarget`, with the SAME `choose` the live caller
 * passes (sim/damage.js scrDamageSingle), returning the targets and the rng
 * draws each hit cost.
 */
function targetRun(s, n, opts = {}) {
  const targets = [];
  const perHit = [];
  let prev = s.gmlRng.draws ?? 0;
  for (let i = 0; i < n; i++) {
    targets.push(knightTarget(s, 0, {
      ac: 5, ...opts, choose: (...xs) => gmlChoose(s.gmlRng, xs),
    }));
    const now = s.gmlRng.draws ?? 0;
    perHit.push(now - prev);
    prev = now;
  }
  return { targets, perHit };
}

{
  // ── HOOKLESS IS BYTE-IDENTICAL ──────────────────────────────────────────
  // `sim/damage.js` is VANILLA and the six vanilla whole-fight diffs cover
  // it. If the seam is not inert when absent, those break — and this suite
  // cannot run them, so it asserts the property directly instead.
  const bare = vanillaTargetState(1001);
  const empty = vanillaTargetState(1001);
  empty.kaizo = { hooks: {} };            // a kaizo scene with no targeting hook
  const a = targetRun(bare, 30);
  const b = targetRun(empty, 30);
  assertDeep(b.targets, a.targets, 'a hookless state.kaizo changes no target');
  assertDeep(b.perHit, a.perHit, '...and costs not one extra rng draw');

  // ...and the vanilla answer is the documented two-of-three brunt: Kris in
  // the mantle takes hits 1 and 2 for ONE draw each (the Kris redirect), and
  // hit 3 releases through `choose(0,1,2)` for a second.
  assertDeep(a.perHit.slice(0, 6), [1, 1, 2, 1, 1, 2],
    'vanilla spends 1 1 2 draws per hit (v105 scr_damage.gml:78-152)');
  assertEq(a.targets[0], 0, 'and hits 1 and 2 land on the mantle wearer');
  assertEq(a.targets[1], 0, '...both of them');
}

{
  // ── THE HOOK IS CONSULTED, AND IT SITS BEHIND BOTH GATES ────────────────
  const s = vanillaTargetState(2002);
  const seen = [];
  s.kaizo = { hooks: { knightTarget: (st, t, o) => { seen.push([t, o.ac]); return 2; } } };
  assertEq(knightTarget(s, 0, { ac: 5 }), 2, 'knightTarget forwards to the hook');
  assertEq(seen.length, 1, '...exactly once');
  assertDeep(seen[0], [0, 5], '...with the caller\'s target and attack choice');

  // `truedamage == 0` is OUTSIDE the mod's call (scr_damage.gml:89) and
  // `aoedamage == false` wraps the script's whole body, so a hook placed
  // behind both gates inherits them rather than restating them.
  assertEq(knightTarget(s, 0, { aoe: true }), 0, 'aoedamage returns target untouched');
  assertEq(knightTarget(s, 1, { truedamage: true }), 1, 'truedamage bypasses targeting');
  assertEq(seen.length, 1, '...and neither reached the hook');

  // THE LIVE PATH, which is the whole point: every bullet that hits goes
  // sim/bullets/regularbullet.js:122 -> scrDamageSingle -> knightTarget.
  s.invTimer = -1;
  scrDamageSingle(s, 10, 0, {});
  assertEq(seen.length, 2, 'scrDamageSingle routes through the seam');
  // scr_damage_maxhp carries the same block inlined in the mod
  // (scr_damage_maxhp.gml:59-165), and the sim reaches it from the same
  // function — so one hook covers Flurry's fraction hit too.
  s.invTimer = -1;
  scrDamageMaxhpSim(s, 0.1, false, true, {});
  assertEq(seen.length, 3, 'scrDamageMaxhp routes through the same seam');
}

{
  // ── buildKaizoScene INSTALLS IT, AND DEFERS TO AN EXISTING ONE ──────────
  const s = createState({ seed: 4242 });
  s.gmlRng = gmlCreate(4242);
  buildKaizoScene(s, { version: 'C' });
  // The hook is kaizoKnightTarget: scr_damage's pre-targeting rules (the
  // dead-slot re-roll and the `target == 4` scr_randomtarget_old roll) in
  // front of scr_kaizo_target -- kaizo/party/damage.js, 2026-09-02.
  assertEq(s.kaizo.hooks.knightTarget, kaizoKnightTarget,
    'V-C installs kaizoKnightTarget (scr_damage pre-target rules + scr_kaizo_target) as the targeting hook');

  // A-lane is an INVENTED schedule over vanilla attack bodies; it keeps
  // vanilla targeting, so `v.knight` is the right gate and not "any kaizo".
  const va = createState({ seed: 4242 });
  va.gmlRng = gmlCreate(4242);
  buildKaizoScene(va, { version: 'A' });
  assertEq(va.kaizo.hooks.knightTarget, undefined,
    'V-A does NOT take kaizo targeting (invented schedule, vanilla bodies)');

  // `??=`, not `=` — kaizo-mod-launcher.js:262 records what an unconditional
  // assignment costs: it eats the RECORDING WRAPPER a check installs to prove
  // the seam fired, and the check then reports "sites seen: [none]". Proven
  // here the way check-oracle-weird proves the combination seam: wrap, drive
  // a real hit, read the receipt.
  const fired = [];
  const inner = s.kaizo.hooks.knightTarget;
  s.kaizo.hooks.knightTarget = (st, t, o) => { fired.push(t); return inner(st, t, o); };
  s.invTimer = -1;
  scrDamageSingle(s, 100, 0, {});
  assertEq(fired.length, 1, 'a wrapper installed after the build survives and fires');
}

{
  // ── THE DRAW COUNT, which is what the whole-fight diff actually sees ────
  const s = createState({ seed: 4242 });
  s.gmlRng = gmlCreate(4242);
  buildKaizoScene(s, { version: 'C' });
  const r = targetRun(s, 12);
  assert(r.perHit.every((d) => d === 2),
    'V-C spends exactly TWO draws per hit: random_range(0,2) then choose(1,2)');
  assert(r.targets.every((t) => t === 1 || t === 2),
    'at full party HP _krisrange is 0, so every roll lands on a companion');
  assertEq(s.knight.damagecounter, 0,
    'with no wearer _mc is -1, so `if (target != _mc)` resets the counter every hit');

  // NOT VACUOUS: the same scene with a wearer takes the absorb branch, which
  // draws NOTHING and forces the wearer — 0 0 2, distinguishable from both
  // the 2 2 2 above and vanilla's 1 1 2.
  const m = createState({ seed: 4242 });
  m.gmlRng = gmlCreate(4242);
  buildKaizoScene(m, { version: 'C' });
  m.kaizo.gear = { 1: { weapon: 16, armor: [23, 10] } };   // Kris in the mantle
  const rm = targetRun(m, 6);
  assertDeep(rm.perHit, [0, 0, 2, 0, 0, 2],
    'a wearer switches the pattern to 0 0 2 (absorb twice, then release)');
  assertDeep(rm.targets.slice(0, 2), [0, 0],
    '...and the first two hits go to the wearer with no roll at all');
}

{
  // ── THE ALARM: THE RECORDED FIGHT HAS NO ShadowMantle ───────────────────
  //
  // `obj_initializer2` Create:102 calls `scr_gamestart()` unconditionally at
  // boot, and the oracle recorder never loads a save — it counts 120 boot
  // frames and then `room_goto(room_bullettest_new)`
  // (kaizo-mod/tools/patches/oracle_kaizo_fight.csx). So the recorded party is
  // scr_gamestart's chapter-3 block: `chararmor1[1..3] = 1`,
  // `chararmor2[1..3] = 10`. ARMOUR 23 IS NOT IN THAT FIGHT.
  //
  // V-C currently matches that BY ABSENCE — it installs no roster, so
  // `gearOfChar` reports everyone unequipped — while `sim/damage.js`'s
  // DEFAULT_GEAR puts 23 on Kris and `kaizo/attacks/flurry-damage.js` reads
  // exactly that DEFAULT_GEAR. Give V-C a roster (roster.js builds gear from
  // DEFAULT_GEAR) and the draw count silently becomes 0 0 2 against a
  // recording that is 2 2 2. This block is the alarm for that day.
  const s = createState({ seed: 777 });
  s.gmlRng = gmlCreate(777);
  buildKaizoScene(s, { version: 'C' });
  const r = targetRun(s, 40);
  assertEq(r.targets.filter((t) => t === 0).length, 0,
    'no hit lands on Kris — nobody in the V-C party wears armour 23');
  assert(r.perHit.every((d) => d === 2),
    '...and no hit is free, which is what the absorb branch would look like');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${checks - failures}/${checks} assertions passed`);
if (checks < 120) {
  console.log(`  FAIL suite ran only ${checks} assertions — a silent no-op would read green`);
  failures += 1;
}
if (failures > 0) {
  console.log(`FAILED: ${failures}`);
  process.exit(1);
}
console.log('check-roster: OK');
process.exit(0);
