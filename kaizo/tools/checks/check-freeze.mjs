#!/usr/bin/env node
// KAIZO V-D (B-Side) k_freeze — positive assertions on every branch
// kaizo/party/freeze.js translates, against the kaizo dump.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE of the expectations asserted here:
//   gml_Object_obj_knight_enemy_Step_0.gml   k_sgscene 6.1 (the only setter),
//                                            down messages 590-641,
//                                            balloon gates 210/319, sweep 1326
//   gml_Object_obj_heroparent_Draw_0.gml     statue spawn + hero Draw exit
//   gml_Object_obj_heroparent_CleanUp_0.gml  clear + the STATUE LEAK
//   gml_GlobalScript_scr_healall.gml         party heal skips frozen
//   gml_GlobalScript_scr_healallitemspell    …and skips their anim
//   gml_GlobalScript_scr_healitemspell       single heal WASTES the action
//   gml_GlobalScript_scr_spell.gml           cases 2 / 6 / 11
//   gml_GlobalScript_scr_spelltext.gml       cases 202 / 231
//
// Every block asserts what the mechanic CHANGES, so deleting freeze.js — or
// any single branch inside it — fails loudly. In particular:
//   - a frozen slot REFUSES a spell (and still flags k_didspell)
//   - a party heal SKIPS it while healing everyone else
//   - a single-target heal on it is CONSUMED with no effect (revives too)
//   - the freeze SURVIVES every heal and clears only at CleanUp / the sweep
//   - the statue LEAKS at CleanUp (ORIGINAL BUG) and blocks re-spawn forever
//   - Noelle can NEVER be frozen by Snowgrave (the min(hp-1) clamp)
//   - scr_spell case 6's loop-invariant _ctar read (ORIGINAL BUG) diverges
//     from scr_healall's correct per-member read on the same party
//
//     node kaizo/tools/checks/check-freeze.mjs

import { gmlCreate } from '../../../sim/rng.js';
import { scrRevive } from '../../../sim/damage.js';
import {
  ensureFreezeState, isFrozen, freezeSlot, freezeChar, thawSlot,
  charIdOfSlot, slotOfCharId, haveChar, kFreezeChar, kFreezeArray,
  stepSnowgraveFreeze, SG_FREEZE_DAMAGE,
  stepFrozenDraw, heroDrawSuppressed, statueForSlot, heroCleanUp, clearAllFreeze,
  statueIsReadable, HEROFROZEN_NONE, HEROFROZEN_CLEANED, K_FREEZE_LENGTH,
  scrHealall, scrHealallitemspell, scrHealitemspell,
  scrSpellFreezeGate, spellTextFrozenSuffix, FREEZE_GATED_SPELLS,
  FROZEN_SPELLDELAY, FROZEN_NO_EFFECT_SUFFIX,
  downMessages, kaizoFunchance,
  balloonTurnAdvances, balloonSuppressed,
} from '../../party/freeze.js';

let failures = 0;
let checks = 0;

function assert(cond, label) {
  checks += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); }
}
function assertEq(got, want, label) {
  checks += 1;
  if (got !== want) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}
function assertJson(got, want, label) {
  assertEq(JSON.stringify(got), JSON.stringify(want), label);
}

// ── the contract's roster ──────────────────────────────────────────────────
// Weird Route party = [Kris, Noelle]. Noelle's chapter-3 stats are the mod's
// scr_gamestart_chapter_override: maxhp 120, at 5, mag 13, df 1.
const KRIS = {
  charId: 1, name: 'KRIS', maxhp: 160, at: 14, magic: 0, df: 2,
  pos: { x: 126, y: 104 }, depth: -104,
  sprites: {
    idle: 'spr_krisb_idle', attack: 'spr_krisb_attack',
    hurt: 'spr_krisb_hurt', swoon: 'spr_krisb_defeat',
    frozen: 'spr_krisb_frozen',
  },
};
const NOELLE = {
  charId: 4, name: 'NOELLE', maxhp: 120, at: 5, magic: 13, df: 1,
  pos: { x: 80, y: 142 }, depth: -142,
  sprites: {
    idle: 'spr_noelleb_idle_sideb', attack: 'spr_noelleb_spell',
    hurt: 'spr_noelleb_hurt_sideb', swoon: 'spr_noelleb_defeat',
  },
};
const SUSIE = {
  charId: 2, name: 'SUSIE', maxhp: 190, at: 18, magic: 2, df: 2,
  pos: { x: 80, y: 142 }, depth: -142,
  sprites: {
    idle: 'spr_susieb_idle', attack: 'spr_susieb_attack',
    hurt: 'spr_susieb_hurt', swoon: 'spr_susieb_defeat',
  },
};

function mkState({ roster = [KRIS, NOELLE], hp = null, seed = 1, sideb = true, gloom = true } = {}) {
  const n = roster.length;
  const st = {
    frame: 0,
    seed,
    gmlRng: gmlCreate(seed),
    audioCues: [],
    partyHp: hp ? hp.slice() : roster.map((r) => r.maxhp),
    chardead: Array.from({ length: n }, () => 0),
    charmove: Array.from({ length: n }, () => 1),
    charcantarget: Array.from({ length: n }, () => 1),
    charaction: Array.from({ length: n }, () => 0),
    charspecial: Array.from({ length: n }, () => 0),
    kaizo: { sideb, roster, funni: false },
  };
  if (gloom) st.kaizo.gloom = Array.from({ length: n }, () => 0);
  ensureFreezeState(st);
  return st;
}

// A roster-aware scr_heal for the heal assertions — the party module owns the
// real one, so the check injects its own rather than borrowing the sim's
// three-person maxhp table (Noelle's 120 is not in it).
function rosterHeal(state, slot, amount) {
  const maxhp = state.kaizo.roster[slot].maxhp;
  const before = state.partyHp[slot];
  const belowZero = before <= 0;
  if (state.partyHp[slot] <= maxhp) {
    state.partyHp[slot] += amount;
    if (state.partyHp[slot] > maxhp) state.partyHp[slot] = maxhp;
  }
  if (belowZero && state.partyHp[slot] >= 0) {
    const floor6 = Math.ceil(maxhp / 6);
    if (state.partyHp[slot] < floor6) state.partyHp[slot] = floor6;
    scrRevive(state, slot);
  }
  return state.partyHp[slot] - before;
}

const draws = (s) => s.gmlRng.draws ?? 0;

// ═══════════════════════════════════════════════════════════════════════════
console.log('indexing — k_freeze is CHAR-indexed, the contract array is SLOT-indexed');
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = mkState();
  assertEq(s.kaizo.freeze.length, 2, 'freeze array is roster-length (2, not 3)');
  assert(s.kaizo.freeze.every((f) => f === false), 'freeze starts all false');
  assertEq(charIdOfSlot(s, 0), 1, 'slot 0 -> Kris (charId 1)');
  assertEq(charIdOfSlot(s, 1), 4, 'slot 1 -> Noelle (charId 4)');
  assertEq(charIdOfSlot(s, 2), 0, 'slot 2 of a two-person party -> global.char = 0');
  assertEq(slotOfCharId(s, 4), 1, 'Noelle is in slot 1');
  assertEq(slotOfCharId(s, 2), -1, 'Susie is not in the Weird Route party');
  assert(haveChar(s, 1) && haveChar(s, 4) && !haveChar(s, 2) && !haveChar(s, 3),
    'scr_havechar over the Weird Route roster');

  // THE SPLIT: slot 1 is Noelle, so freezing SLOT 1 must light CHAR index 4.
  freezeSlot(s, 1);
  assertJson(kFreezeArray(s), [0, 0, 0, 0, 1], 'freeze slot 1 -> k_freeze[4] (char-indexed view)');
  assertEq(kFreezeChar(s, 4), 1, 'kFreezeChar(4) reads Noelle');
  assertEq(kFreezeChar(s, 1), 0, 'Kris (char 1) is untouched by freezing slot 1');
  assertEq(kFreezeArray(s).length, K_FREEZE_LENGTH, 'the mod stores five slots');
  // the empty-slot hole and the scr_spell OOB read
  assertEq(kFreezeChar(s, 0), 0, 'k_freeze[0] (empty-slot hole) always reads 0');
  assertEq(kFreezeChar(s, -1), 0, 'k_freeze[-1] (star >= 3) reads 0, not a throw');

  thawSlot(s, 1);
  assert(!isFrozen(s, 1), 'thawSlot clears');
  freezeChar(s, 1);
  assert(isFrozen(s, 0), 'freezeChar(1) freezes Kris by slot');
  assertJson(kFreezeArray(s), [0, 1, 0, 0, 0], 'freezeChar(1) -> k_freeze[1]');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('scr_spell — a frozen slot REFUSES the spell (cases 2 / 11), k_didspell survives');
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = mkState();
  const before = scrSpellFreezeGate(s, 2, 0, 0);
  assert(!before.blocked, 'Heal Prayer on an unfrozen Kris: not blocked');

  freezeSlot(s, 0);
  const after = scrSpellFreezeGate(s, 2, 0, 0);
  assert(after.blocked, 'Heal Prayer on a FROZEN Kris: BLOCKED');
  assertEq(after.spelldelay, FROZEN_SPELLDELAY, 'blocked spell still costs spelldelay 15');
  assert(after.kDidspell, 'k_didspell is set BEFORE the gate — the refusal is not a cancel');

  const ultra = scrSpellFreezeGate(s, 11, 0, 0);
  assert(ultra.blocked && ultra.kDidspell, 'case 11 (stacking heal) blocked the same way');

  // Not every spell is gated: Rude Buster (4) is untouched by freeze.
  const rude = scrSpellFreezeGate(s, 4, 1, 0);
  assert(!rude.blocked, 'Rude Buster is NOT freeze-gated');
  assert(rude.kDidspell, 'Rude Buster still flags k_didspell (1 < id <= 100)');
  // …and item ids (>100) never flag it
  assertEq(scrSpellFreezeGate(s, 202, 0, 0).kDidspell, false, 'item ids do not flag k_didspell');
  assertJson([...FREEZE_GATED_SPELLS].sort((a, b) => a - b), [2, 6, 11],
    'exactly three scr_spell cases carry their own gate');

  // Casting at the OTHER member is unaffected — the gate reads the target.
  assert(!scrSpellFreezeGate(s, 2, 0, 1).blocked, 'Heal Prayer at unfrozen Noelle: allowed');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('scr_spell case 6 — ORIGINAL BUG: the loop-invariant _ctar read');
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = mkState();
  assertJson(scrSpellFreezeGate(s, 6, 0, 0).targets, [0, 1], 'nobody frozen: all-heal hits both');

  freezeSlot(s, 1);                                  // Noelle frozen
  // Target the FROZEN member -> the loop-invariant read skips EVERYONE,
  // including the perfectly healthy Kris. That is the bug.
  assertJson(scrSpellFreezeGate(s, 6, 0, 1).targets, [],
    'ORIGINAL BUG: all-heal aimed at the frozen member heals NOBODY');
  assert(scrSpellFreezeGate(s, 6, 0, 1).blocked, '…and reports itself blocked');
  // Target the UNFROZEN member -> nobody is skipped, so the FROZEN member is
  // healed anyway. The other half of the same bug.
  assertJson(scrSpellFreezeGate(s, 6, 0, 0).targets, [0, 1],
    'ORIGINAL BUG: all-heal aimed elsewhere heals the frozen member too');

  // The contrast that proves it is a bug and not the rule: scr_healall, the
  // correctly-indexed site, on the exact same party state.
  const s2 = mkState();
  freezeSlot(s2, 1);
  assertJson(scrHealall(s2, 10, rosterHeal), { healed: [0], skipped: [1] },
    'scr_healall (correct per-member read) skips ONLY the frozen member');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('scr_healall / scr_healallitemspell — the party heal SKIPS a frozen member');
// ═══════════════════════════════════════════════════════════════════════════
{
  // control: nothing frozen, both heal. Without this the skip below could be
  // a general no-op rather than the mechanic.
  const ctl = mkState({ hp: [100, 60] });
  scrHealall(ctl, 50, rosterHeal);
  assertJson(ctl.partyHp, [150, 110], 'control: unfrozen party heals both slots');

  const s = mkState({ hp: [100, 60] });
  freezeSlot(s, 1);
  const r = scrHealall(s, 50, rosterHeal);
  assertJson(r.healed, [0], 'healed: Kris only');
  assertJson(r.skipped, [1], 'skipped: the frozen Noelle');
  assertJson(s.partyHp, [150, 60], 'the frozen member gained ZERO HP while Kris healed');

  // heal-all ITEM: same skip, and the green number is skipped with it.
  const s3 = mkState({ hp: [100, 60] });
  freezeSlot(s3, 1);
  const a = scrHealallitemspell(s3, 40, rosterHeal);
  assertJson(a.healed, [0], 'heal-all item heals Kris only');
  assertJson(a.anims, [0], 'the frozen member gets no obj_healanim either');
  assertEq(a.spelldelay, 20, 'scr_healallitemspell sets spelldelay 20');
  assertJson(s3.partyHp, [140, 60], 'frozen member untouched by the heal-all item');

  // the two-person party runs the dump's `for (i = 0; i < 3)` loop past its
  // own tail — slot 2 reads k_freeze[0] and is dropped by char != 0.
  const s4 = mkState({ hp: [100, 60] });
  const r4 = scrHealall(s4, 5, rosterHeal);
  assert(!r4.healed.includes(2) && !r4.skipped.includes(2),
    'the empty third slot is neither healed nor "skipped by freeze"');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('scr_healitemspell — a single-target heal on a frozen member is CONSUMED');
// ═══════════════════════════════════════════════════════════════════════════
{
  const ok = mkState({ hp: [100, 60] });
  const good = scrHealitemspell(ok, 0, 40, rosterHeal);
  assert(good !== false && good.healed === 40, 'control: unfrozen heal lands 40');
  assertEq(ok.partyHp[0], 140, 'control: HP moved');

  const s = mkState({ hp: [100, 60] });
  freezeSlot(s, 0);
  const res = scrHealitemspell(s, 0, 40, rosterHeal);
  assertEq(res, false, 'frozen single-target heal returns false');
  assertEq(s.partyHp[0], 100, 'no HP was restored');
  assertEq(s.kaizo.spelldelay, FROZEN_SPELLDELAY, 'the action was still paid for (spelldelay 15, on state.kaizo where the scene driver reads it)');
  assert(isFrozen(s, 0), 'and the member is STILL frozen afterwards');

  // A REVIVE is eaten too — the most expensive way to learn the rule.
  const rev = mkState({ hp: [-50, 60] });
  rev.chardead[0] = 1;
  freezeSlot(rev, 0);
  const reviveAmt = KRIS.maxhp + Math.abs(rev.partyHp[0]);   // scr_spell case 202
  assertEq(scrHealitemspell(rev, 0, reviveAmt, rosterHeal), false, 'ReviveMint on a frozen Kris: eaten');
  assertEq(rev.partyHp[0], -50, 'still at -50');
  assertEq(rev.chardead[0], 1, 'still down');
  assert(isFrozen(rev, 0), 'still frozen');

  // …and the same revive on an unfrozen Kris DOES work, so the refusal is the
  // freeze and not the negative HP.
  const rev2 = mkState({ hp: [-50, 60] });
  rev2.chardead[0] = 1;
  assert(scrHealitemspell(rev2, 0, reviveAmt, rosterHeal) !== false, 'unfrozen revive succeeds');
  assertEq(rev2.chardead[0], 0, 'unfrozen Kris stands back up');

  // The default healFn (no injection) exists and works on a slot whose maxhp
  // matches the verified sim's table.
  const def = mkState({ hp: [100, 60] });
  const d = scrHealitemspell(def, 0, 30);
  assert(d !== false && def.partyHp[0] === 130, 'default healFn path heals through sim scr_heal');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('the freeze SURVIVES everything a turn can throw at it');
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = mkState({ hp: [1, 60] });
  freezeSlot(s, 0);
  scrHealall(s, 9999, rosterHeal);
  scrHealallitemspell(s, 9999, rosterHeal);
  scrHealitemspell(s, 0, 9999, rosterHeal);
  scrSpellFreezeGate(s, 2, 1, 0);
  scrSpellFreezeGate(s, 11, 1, 0);
  assert(isFrozen(s, 0), 'no heal, item or spell thaws a frozen member');
  assertEq(s.partyHp[0], 1, 'and none of them restored a single HP');
  assertJson(kFreezeArray(s), [0, 1, 0, 0, 0], 'k_freeze[1] still set');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('obj_heroparent Draw_0 — the frozen-statue spawn (VISUAL: recorded, not drawn)');
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = mkState();
  assertJson(stepFrozenDraw(s), [], 'nobody frozen: no hero draw suppressed');
  assertEq(s.kaizo.frozenStatues.length, 0, 'and no statue');
  assertEq(s.kaizo.herofrozen[0], HEROFROZEN_NONE, 'herofrozen starts at the -4 sentinel');

  freezeSlot(s, 0);
  const d0 = draws(s);
  assertJson(stepFrozenDraw(s), [0], 'frozen hero: Draw exits, slot reported suppressed');
  assertEq(draws(s), d0, 'the statue spawn consumes ZERO RNG draws (obj_frozennpc Create has none)');
  assert(heroDrawSuppressed(s, 0), 'heroDrawSuppressed agrees');
  assert(!heroDrawSuppressed(s, 1), '…and only for the frozen slot');

  const st = statueForSlot(s, 0);
  assert(st !== null, 'a statue exists for the frozen slot');
  assertEq(st.sprite, 'spr_krisb_frozen', 'Kris (char 1) gets the mod\'s own spr_krisb_frozen');
  assertEq(st.inbattle, 1, 'inbattle = 1');
  assertEq(st.imageIndex, 0, 'image_index = 0');
  assertEq(st.depth, KRIS.depth, 'statue inherits the hero depth');
  assertEq(st.x, KRIS.pos.x, 'spawned at the hero x');
  assertEq(st.y, KRIS.pos.y, 'spawned at the hero y');
  assertEq(st.imageXscale, 2, 'image_xscale inherited (2)');
  assert(statueIsReadable(st), 'skipread = 0 — the mod\'s new field, never written to 1');
  assertEq(s.kaizo.herofrozen[0], st.id, 'herofrozen now holds the statue id');

  // The spawn gate is `herofrozen == -4` — exactly one statue, ever.
  stepFrozenDraw(s); stepFrozenDraw(s); stepFrozenDraw(s);
  assertEq(s.kaizo.frozenStatues.length, 1, 'later frames do NOT spawn a second statue');

  // Non-Kris members use their own hurtsprite.
  const s2 = mkState();
  freezeSlot(s2, 1);
  stepFrozenDraw(s2);
  assertEq(statueForSlot(s2, 1).sprite, NOELLE.sprites.hurt, 'Noelle\'s statue uses her hurtsprite');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('obj_heroparent CleanUp_0 — ORIGINAL BUG: the frozen-statue leak');
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = mkState();
  freezeSlot(s, 0);
  stepFrozenDraw(s);
  const statue = statueForSlot(s, 0);
  assert(statue.alive, 'statue is alive before CleanUp');

  const out = heroCleanUp(s, 0);
  assert(out.thawed, 'CleanUp clears k_freeze for that character');
  assert(!isFrozen(s, 0), 'the member is no longer frozen');
  assertEq(s.kaizo.herofrozen[0], HEROFROZEN_CLEANED, 'herofrozen stamped -99');
  // THE BUG: herofrozen is overwritten to -99 BEFORE instance_destroy reads
  // it, so the destroy targets id -99 and the statue is never taken.
  assert(statue.alive, 'ORIGINAL BUG: the statue SURVIVES CleanUp (destroy aimed at id -99)');
  assertEq(out.leaked, statue, 'the leaked statue is reported');
  assertEq(s.kaizo.frozenStatues.filter((x) => x.alive).length, 1, 'one leaked statue still standing');

  // Consequence of the same bug: the -4 gate can never be true again, so this
  // hero can never get a second statue no matter how often they re-freeze.
  freezeSlot(s, 0);
  stepFrozenDraw(s);
  assertEq(s.kaizo.frozenStatues.length, 1, 'ORIGINAL BUG consequence: re-freeze spawns no new statue');
  assertEq(statueForSlot(s, 0), null, 'and the hero has no statue handle any more');

  // A second CleanUp does nothing: -99 > -4 is false.
  const out2 = heroCleanUp(s, 0);
  assertEq(out2.leaked, null, 'a second CleanUp finds no handle to leak');

  // The sweep is the only thing that ever kills the statues.
  const destroyed = clearAllFreeze(s);
  assertEq(destroyed, 1, 'the end-cutscene sweep destroys the leaked statue');
  assert(s.kaizo.freeze.every((f) => f === false), 'and resets k_freeze = [0,0,0,0,0]');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('k_sgscene 6.1 — the ONLY setter, and the Noelle clamp');
// ═══════════════════════════════════════════════════════════════════════════
{
  // Kris takes the full 75..125 per tick and freezes when he crosses zero.
  const s = mkState({ hp: [200, 120], seed: 7 });
  s.frame = 1;                                  // odd -> no snd_play draw
  const d0 = draws(s);
  const t1 = stepSnowgraveFreeze(s, { target: 0 });
  assertEq(draws(s) - d0, 2, 'odd frame: irandom_range only, 2 draws');
  assertEq(t1.draws, 2, 'reported draw count agrees');
  assert(t1.damage >= SG_FREEZE_DAMAGE.lo && t1.damage <= SG_FREEZE_DAMAGE.hi,
    'damage is irandom_range(75, 125)');
  assertEq(s.partyHp[0], 200 - t1.damage, 'HP fell by exactly that');
  assert(!t1.frozen, 'one tick off 200 HP does not freeze');
  assertEq(s.chardead[0], 0, 'the non-killing tick scr_dead\'d then scr_revive\'d him');
  assert(t1.revived, 'and reports the revive');

  s.frame = 2;                                  // even -> the snd_play draw fires
  const d1 = draws(s);
  const t2 = stepSnowgraveFreeze(s, { target: 0 });
  assertEq(draws(s) - d1, 3, 'even frame + non-Noelle target: 3 draws (the snd pitch random(0.2))');
  assert(s.audioCues.some((c) => c.name === 'snd_damage'), 'snd_damage cued on the even frame');

  // Drive him under.
  let killed = null;
  for (let i = 0; i < 8 && !killed; i++) {
    s.frame += 1;
    const t = stepSnowgraveFreeze(s, { target: 0 });
    if (t.frozen) killed = t;
  }
  assert(killed !== null, 'Kris eventually crosses zero');
  assert(isFrozen(s, 0), 'crossing zero sets k_freeze');
  assertJson(kFreezeArray(s), [0, 1, 0, 0, 0], 'k_freeze[1] — char-indexed, as the mod stores it');
  assertEq(s.chardead[0], 1, 'the second scr_dead leaves him down');
  assert(s.partyHp[0] <= 0, 'and at or below zero HP');

  // THE B-SIDE CLAMP: Noelle takes round(dmg / 16) capped at hp - 1, so she
  // can never reach zero and therefore can NEVER be frozen by Snowgrave.
  const n = mkState({ hp: [160, 120], seed: 3 });
  let noelleFroze = false;
  let minHp = 120;
  for (let i = 0; i < 400; i++) {
    n.frame = i;
    const t = stepSnowgraveFreeze(n, { target: 1 });
    if (t.frozen) noelleFroze = true;
    minHp = Math.min(minHp, n.partyHp[1]);
    assert(t.damage <= 8, `Noelle tick ${i}: damage is round(75..125 / 16) <= 8`);
  }
  assert(!noelleFroze, 'Noelle is NEVER frozen by Snowgrave (the min(hp - 1) clamp)');
  assertEq(n.partyHp[1], 1, 'the clamp parks her at exactly 1 HP');
  assert(!isFrozen(n, 1), 'k_freeze[4] stays 0 — which is why she has no frozen down-message');
  assertEq(kFreezeArray(n)[4], 0, 'k_freeze[4] never set');

  // Noelle never draws the snd pitch, on either parity (`_char != 4`).
  const np = mkState({ hp: [160, 120], seed: 5 });
  np.frame = 0;
  const dn = draws(np);
  const tn = stepSnowgraveFreeze(np, { target: 1 });
  assertEq(draws(np) - dn, 2, 'even frame, Noelle target: still only 2 draws');
  assertEq(tn.draws, 2, 'reported');

  // gloom: `k_gloom[_char] = min(global.hp[_char] - 1, k_gloom[_char])`
  const g = mkState({ hp: [200, 120], seed: 11 });
  g.kaizo.gloom[0] = 500;
  g.frame = 1;
  stepSnowgraveFreeze(g, { target: 0 });
  assertEq(g.kaizo.gloom[0], g.partyHp[0] - 1, 'the tick clamps gloom to hp - 1');

  // determinism: the same seed replays the same damage stream.
  const runOnce = (seed) => {
    const q = mkState({ hp: [900, 120], seed });
    const out = [];
    for (let i = 0; i < 5; i++) { q.frame = i; out.push(stepSnowgraveFreeze(q, { target: 0 }).damage); }
    return out;
  };
  assertJson(runOnce(42), runOnce(42), 'same seed -> identical damage sequence');
  assert(JSON.stringify(runOnce(42)) !== JSON.stringify(runOnce(43)), 'different seed -> different sequence');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('down messages — the freeze line, the sideb line, and the funchance roll');
// ═══════════════════════════════════════════════════════════════════════════
{
  // Force the 1/100 funchance OFF by seeding past it: assert on the roll we
  // actually get, then take the branch we need with the funni override.
  const nofunni = (seed) => {
    const probe = mkState({ seed });
    return !kaizoFunchance(probe, 100);
  };
  let seed = 1;
  while (!nofunni(seed) && seed < 500) seed += 1;
  assert(seed < 500, 'found a seed whose kaizo_funchance(100) roll is > 1');

  // sideb + FROZEN Kris -> the freeze line WINS over the sideb line.
  const s = mkState({ hp: [0, 120], seed });
  freezeSlot(s, 0);
  const d0 = draws(s);
  const m = downMessages(s);
  assertEq(m.battlemsg, '* Kris was frozen solid.&', 'frozen Kris: the freeze line beats the sideb line');
  assertEq(m.downcount, 1, 'one member down');
  assertEq(draws(s) - d0, 2, 'kaizo_funchance(100) drew twice');
  assertEq(m.draws, 2, 'reported');
  assertEq(downMessages(s).downcount, 0, 'latched — the line prints once per fight');

  // sideb, NOT frozen -> the sideb line.
  const b = mkState({ hp: [0, 120], seed });
  assertEq(downMessages(b).battlemsg, "* Can't move your body.&", 'sideb, unfrozen: the B-Side line');

  // no sideb, not frozen -> vanilla.
  const v = mkState({ hp: [0, 120], seed, sideb: false });
  assertEq(downMessages(v).battlemsg, '* Kris collapsed in silence.&', 'no sideb, unfrozen: the vanilla line');

  // the funni override wins over all three, and still draws twice.
  const f = mkState({ hp: [0, 120], seed });
  f.kaizo.funni = true;
  freezeSlot(f, 0);
  const df = draws(f);
  assertEq(downMessages(f).battlemsg, '* Kris is now dead.&', 'kaizo_funchance overwrites even the freeze line');
  assertEq(draws(f) - df, 2, 'and the roll is still made (|| does not skip the left operand)');

  // NOELLE HAS NO FREEZE LINE. Force the (unreachable) state and prove it.
  const nl = mkState({ hp: [160, 0], seed });
  freezeSlot(nl, 1);
  assertEq(downMessages(nl).battlemsg, '* She was used up.&',
    'a frozen Noelle STILL prints the sideb line — the mod wrote no k_freeze[4] branch');
  const nl2 = mkState({ hp: [160, 0], seed, sideb: false });
  assertEq(downMessages(nl2).battlemsg, "* Noelle's breath goes cold.&", 'Noelle without sideb');

  // downcount == 2 concatenates ALL FOUR strings.
  const both = mkState({ hp: [0, 0], seed });
  freezeSlot(both, 0);
  const bm = downMessages(both);
  assertEq(bm.downcount, 2, 'two down');
  assertEq(bm.battlemsg, '* Kris was frozen solid.&* She was used up.&', 'downcount == 2 concatenates');

  // Susie / Ralsei freeze lines, on a roster that has them.
  const three = mkState({ roster: [KRIS, SUSIE, NOELLE], hp: [160, 0, 120], seed, sideb: false });
  freezeSlot(three, 1);
  assertEq(downMessages(three).battlemsg, '* Susie succumbed to the cold.&', 'frozen Susie line');
  const three2 = mkState({ roster: [KRIS, SUSIE, NOELLE], hp: [160, 0, 120], seed, sideb: false });
  assertEq(downMessages(three2).battlemsg, "* Susie's demise was expected.&", 'unfrozen Susie line');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('scr_spelltext 202 / 231 — the only on-screen "it had no effect"');
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = mkState();
  const base = '* KRIS used the REVIVEMINT!/%';
  assertEq(spellTextFrozenSuffix(s, 202, 0, base), base, 'unfrozen target: message unchanged');
  freezeSlot(s, 0);
  assertEq(spellTextFrozenSuffix(s, 202, 0, base),
    '* KRIS used the REVIVEMINT!' + FROZEN_NO_EFFECT_SUFFIX,
    'frozen target: /% stripped and the no-effect line appended');
  const bright = '* KRIS used the REVIVEBRIGHT!/%';
  assertEq(spellTextFrozenSuffix(s, 231, 0, bright),
    '* KRIS used the REVIVEBRIGHT!' + FROZEN_NO_EFFECT_SUFFIX,
    'case 231 gets the same suffix');
  assertEq(spellTextFrozenSuffix(s, 231, 1, bright), bright,
    'case 231 aimed at the UNFROZEN member is unchanged');
  // Every OTHER heal item stays silent about it — that asymmetry is the mod's.
  assertEq(spellTextFrozenSuffix(s, 201, 0, '* KRIS used the DARK CANDY!/%'),
    '* KRIS used the DARK CANDY!/%', 'case 201 says nothing about the wasted heal');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('the Susie balloon gates read k_freeze too');
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = mkState({ roster: [KRIS, SUSIE, NOELLE], hp: [160, 0, 120] });
  assert(!balloonTurnAdvances(s), 'Susie at 0 HP and unfrozen: the taunt schedule stalls');
  freezeSlot(s, 1);
  assert(balloonTurnAdvances(s), 'a FROZEN Susie counts as present — balloonturn keeps advancing');
  assert(balloonSuppressed(s), '…but the balloon itself is swallowed (her statue shakes instead)');

  const w = mkState();                       // Weird Route: no Susie at all
  assert(!balloonTurnAdvances(w), 'no Susie in the party: no balloon');
  assert(!balloonSuppressed(w), 'and nothing to suppress');
}

console.log(
  failures === 0
    ? `\nOK — ${checks} assertions, all green`
    : `\n${failures} of ${checks} assertions FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
