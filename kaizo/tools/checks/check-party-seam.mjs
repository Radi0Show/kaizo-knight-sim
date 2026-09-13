#!/usr/bin/env node
// THE PARTY IS N MEMBERS, AND SLOT 1 IS WHOEVER IS STANDING IN IT.
//
//   node kaizo/tools/checks/check-party-seam.mjs
//   node kaizo/tools/checks/check-party-seam.mjs --sabotage   (self-test)
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// ── THE BUG THIS OWNS ─────────────────────────────────────────────────────
//
// `sim/damage.js` carried the party as a THREE-ENTRY, SLOT-INDEXED literal
// and indexed straight into it:
//
//     export const PARTY = [
//       { name: 'KRIS',   maxhp: 160, at: 14, magic: 0,  df: 2, ... },
//       { name: 'SUSIE',  maxhp: 190, at: 18, magic: 2,  df: 2, ... },
//       { name: 'RALSEI', maxhp: 140, at: 12, magic: 11, df: 2, ... },
//     ];
//
// The Weird Route party is TWO members, `[CHAR_KRIS, CHAR_NOELLE]`
// (kaizo/party/roster.js `WEIRD_ROUTE_PARTY`), and Noelle stands in SLOT 1 —
// which is Susie's slot everywhere in that table. So slot 1's name plate read
// SUSIE, the defence walk sized its -3/-2/-1 steps against 190, every heal
// item filled to 190, `scr_damage_maxhp` took a fraction of 190, and
// `scr_party_hpaverage` — a RE-TARGETING gate — averaged over a slot 2 that
// holds nobody. That is the user's report, in three parts, from one cause.
//
// ── THE SECOND, WORSE HALF: A SEAM READ ON SOME PATHS AND NOT OTHERS ──────
//
// `state.partyMaxhp` already existed as an override. It was honoured by
// `scr_party_hpaverage` and IGNORED by `scr_damage_calculation`, by Kris's
// doomtype-4 mercy (`round(-maxhp / 2)` — the -80 that keeps a revive inside
// one heal item's reach), by `scr_damage_maxhp`, by the heal cap in
// `sim/items.js`, by every revive fraction there, by the heal writer's MAX
// graphic in `sim/spells.js` and by the one in `sim/dmgnumbers.js`. A
// half-read seam is worse than no seam: the answer depended on which code
// path asked.
//
// ── THE FIX, AND WHAT THIS CHECK IS FOR ───────────────────────────────────
//
// Four accessors in `sim/damage.js` over ONE optional field, `state.kaizo
// .roster`, which `installRoster` already publishes:
//
//     partyTable(state)  partySize(state)  partyMemberAt(state, slot)
//     partyMaxhp(state, slot)
//
// THIS REPO'S SIGNATURE DEFECT IS A VALUE COMPUTED CORRECTLY AND WRITTEN
// WHERE NOTHING READS IT — it is in CLAUDE.md as a standing hazard and it has
// now landed ten times, twice found by the user playing rather than by any
// check. So §0 below does not assert that the roster is built correctly: it
// asserts that the ENGINE READS IT, by source and by behaviour, in every file
// that was patched. Delete a call site and this check goes red even if the
// roster is still perfect.
//
// ── WHERE NOELLE'S NUMBERS COME FROM ──────────────────────────────────────
//
// THE MOD'S OWN OVERRIDE IS THE AUTHORITY FOR THIS FIGHT, and §1 reads it out
// of the dump rather than trusting the constant:
//
//   knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/
//     gml_GlobalScript_scr_gamestart_chapter_override.gml : 55-59
//         global.maxhp[4] = 120;  global.hp[4] = global.maxhp[4];
//         global.at[4] = 5;  global.mag[4] = 13;  global.df[4] = 1;
//
// The VANILLA Chapter 4+ dump carries a different Noelle —
// knight-research/gml_dump_ch5/CodeEntries/gml_GlobalScript_scr_gamestart.gml
// :166-169 (and again at :199-202, :230-233) gives her 90 / 3 / 11 / 1 — and
// §1 pins that too, so the two can never be confused for one another. 90/3/11
// is what a file transferred under VANILLA carries into the mod
// (noelle.js's transfer note); 120/5/13 is what the mod writes. DF 1 is the
// one both agree on, and the one that is easy to miss: every other character
// carries the base 2.
//
// ── SABOTAGE-TESTED ───────────────────────────────────────────────────────
// `--sabotage` re-runs §0's source guards against a version of each engine
// file with the accessor calls stripped back to the literal, and FAILS if the
// guards do not notice. That is the self-test for the reader-guards
// themselves; the behavioural half was sabotage-tested by hand (see the
// session report) by reverting `partyMaxhp` to `PARTY[target].maxhp` in
// sim/items.js, which reddens §4.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

import { createState } from '../../../sim/index.js';
import {
  PARTY, DEFAULT_GEAR,
  partyTable, partySize, partyMemberAt, partyMaxhp,
  gearOf, statFor, freshParty,
  scrDamageCalculation, scrDamage, scrDamageAll, scrDamageMaxhp, knightTarget,
} from '../../../sim/damage.js';
import { statsOf } from '../../../sim/equipment.js';
import { applyHeal, reviveAmount } from '../../../sim/items.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import { installRoster, gearOfSlot, WEIRD_ROUTE_PARTY, NORMAL_ROUTE_PARTY } from '../../party/roster.js';
import { NOELLE_STATS, NOELLE_CHAR_ID, THORN_RING } from '../../party/noelle.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const KAIZO_DUMP = join(homedir(), 'knight-research', 'kaizo-mod', 'gml_kaizo_dump', 'CodeEntries');
const CH5_DUMP = join(homedir(), 'knight-research', 'gml_dump_ch5', 'CodeEntries');

const SABOTAGE = process.argv.includes('--sabotage');

let failures = 0;
let count = 0;
function assert(cond, label) {
  count += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); } else console.log(`  ok   ${label}`);
}
function assertEq(got, want, label) {
  assert(got === want, `${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}
function section(t) { console.log(`\n== ${t}`); }

/** A built scene, through the real builder and nothing else. */
function build(version) {
  return buildKaizoScene(createState({ seed: 4242, traceBulletSlots: 0 }), { version });
}
/** A bare state with a roster installed and NO kaizo hooks — sim/'s own path. */
function bare(charIds = WEIRD_ROUTE_PARTY, sideb = true) {
  const st = createState({ seed: 99, traceBulletSlots: 0 });
  installRoster(st, { charIds, sideb });
  // installRoster stamps state.kaizo; the fight's hooks are NOT installed, so
  // everything below exercises sim/damage.js itself rather than kaizo's copy.
  delete st.kaizo.hooks;
  st.partyMaxhp = st.kaizo.roster.map((m) => m.maxhp);
  st.invTimer = -1;
  st.knight = st.knight ?? { damagecounter: 0, aoedamage: false, progamer: true };
  return st;
}

// ══ 0. THE READERS EXIST ══════════════════════════════════════════════════
//
// The source half. A behavioural assertion alone cannot tell "the engine
// reads the roster" from "the engine happens to agree with the roster"; these
// name the call sites, so removing one is visible even when the numbers
// coincide.
const ENGINE_FILES = {
  'sim/damage.js': ['partyTable(', 'partySize(', 'partyMemberAt(', 'partyMaxhp('],
  'sim/items.js': ['partyMaxhp(', 'partySize('],
  'sim/spells.js': ['partyMaxhp('],
  'sim/dmgnumbers.js': ['partyMaxhp('],
};

function sourceGuards(read) {
  section('THE ENGINE READS THE SEAM — every patched file, by source');
  for (const [rel, needles] of Object.entries(ENGINE_FILES)) {
    const src = read(rel);
    for (const n of needles) {
      // The import line mentions the name too, so a call site is a mention
      // that is NOT on an `import` line and NOT in a comment.
      const calls = src.split('\n').filter((l) => {
        const t = l.trim();
        if (t.startsWith('import') || t.startsWith('*') || t.startsWith('//')) return false;
        return l.includes(n);
      });
      assert(calls.length > 0, `${rel} calls ${n}`);
    }
  }
  // And the seam itself has a reader: partyTable must consult state.kaizo.roster.
  const dmg = read('sim/damage.js');
  assert(/partyTable\s*\([\s\S]{0,400}?state\?\.kaizo\?\.roster/.test(dmg),
    'sim/damage.js partyTable() reads state.kaizo.roster — the field installRoster writes');
  // The literal reads that made this a half-read seam must not come back.
  for (const rel of Object.keys(ENGINE_FILES)) {
    const src = read(rel);
    const bad = src.split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => {
        const t = l.trim();
        if (t.startsWith('*') || t.startsWith('//')) return false;
        return /PARTY(_STATS)?\s*\[[^\]]+\]\s*\??\.maxhp/.test(l);
      });
    assertEq(bad.length, 0,
      `${rel} has NO literal PARTY[...].maxhp read left${bad.length ? ` (line ${bad[0][0]})` : ''}`);
  }
}

sourceGuards((rel) => readFileSync(join(REPO, rel), 'utf8'));

if (SABOTAGE) {
  // Strip every accessor call back to the literal and confirm §0 notices.
  section('--sabotage: the reader-guards can actually fail');
  const before = failures;
  const strip = (rel) => readFileSync(join(REPO, rel), 'utf8')
    .replace(/partyMaxhp\(state, ([^)]+)\)/g, 'PARTY[$1].maxhp')
    .replace(/partyMaxhp\(/g, 'NOPE_maxhp(')
    .replace(/partySize\(/g, 'NOPE_size(')
    .replace(/partyMemberAt\(/g, 'NOPE_at(')
    .replace(/state\?\.kaizo\?\.roster/g, 'undefined');
  const saved = { failures, count };
  failures = 0; count = 0;
  sourceGuards(strip);
  const caught = failures;
  failures = saved.failures; count = saved.count;
  assert(caught > 0, `stripping the call sites reddens the guards (${caught} assertion(s) fired)`);
  assert(failures === before, 'and the real run was unaffected by the self-test');
}

// ══ 1. NOELLE'S NUMBERS, AGAINST THE DUMPS ════════════════════════════════
section('Noelle 120 / 5 / 13 / 1 — read out of the mod\'s own override');
{
  const f = join(KAIZO_DUMP, 'gml_GlobalScript_scr_gamestart_chapter_override.gml');
  if (!existsSync(f)) {
    console.log('  SKIP  the kaizo dump is not on this machine');
  } else {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    // :55-59 in the dump's own numbering (1-based).
    const want = [
      [55, 'global.maxhp[4] = 120;'],
      [56, 'global.hp[4] = global.maxhp[4];'],
      [57, 'global.at[4] = 5;'],
      [58, 'global.mag[4] = 13;'],
      [59, 'global.df[4] = 1;'],
    ];
    for (const [n, text] of want) {
      assertEq((lines[n - 1] ?? '').trim(), text,
        `scr_gamestart_chapter_override.gml:${n}`);
    }
  }
  assertEq(NOELLE_STATS.maxhp, 120, 'NOELLE_STATS.maxhp matches the override');
  assertEq(NOELLE_STATS.at, 5, 'NOELLE_STATS.at matches the override');
  assertEq(NOELLE_STATS.magic, 13, 'NOELLE_STATS.magic matches the override');
  assertEq(NOELLE_STATS.df, 1, 'NOELLE_STATS.df matches the override — every other member carries 2');
  assertEq(NOELLE_CHAR_ID, 4, 'and she is character 4');
}

section('...and the VANILLA Chapter 4+ Noelle is a DIFFERENT character — 90 / 3 / 11 / 1');
{
  const f = join(CH5_DUMP, 'gml_GlobalScript_scr_gamestart.gml');
  if (!existsSync(f)) {
    console.log('  SKIP  the Chapter 4+ dump is not on this machine');
  } else {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    for (const [n, text] of [
      [166, 'global.maxhp[4] = 90;'],
      [167, 'global.at[4] = 3;'],
      [168, 'global.mag[4] = 11;'],
      [169, 'global.df[4] = 1;'],
    ]) {
      assertEq((lines[n - 1] ?? '').trim(), text, `gml_dump_ch5 scr_gamestart.gml:${n}`);
    }
    assert(NOELLE_STATS.maxhp !== 90,
      'THE MOD OVERRIDES IT — 120, not the vanilla 90, is what this fight is played with');
  }
}

// ══ 2. THE A-SIDE IS UNTOUCHED ════════════════════════════════════════════
//
// The non-negotiable half. With no roster installed the accessors must answer
// exactly what the literal always answered — that is what the byte gate
// checks, and this says the same thing in assertions.
section('NO ROSTER: the engine answers KRIS / SUSIE / RALSEI, 160 / 190 / 140');
{
  const st = createState({ seed: 1, traceBulletSlots: 0 });
  assert(partyTable(st) === PARTY, 'partyTable() IS the literal, not a copy of it');
  assertEq(partySize(st), 3, 'partySize() is 3');
  assertEq(partyTable(st).map((p) => p.name).join(','), 'KRIS,SUSIE,RALSEI', 'the three names');
  assertEq([0, 1, 2].map((s) => partyMaxhp(st, s)).join(','), '160,190,140', 'the three maxes');
  assertEq(partyMemberAt(st, 1).name, 'SUSIE', 'slot 1 is SUSIE when nobody says otherwise');
  assert(gearOf(st) === DEFAULT_GEAR, 'gearOf() still falls through to DEFAULT_GEAR');
  assertEq(freshParty().join(','), '160,190,140', 'freshParty() with no argument is the literal');
  assertEq(statFor(st, 1).at, statsOf(PARTY[1], DEFAULT_GEAR[1]).at,
    'statFor() still sums the literal through DEFAULT_GEAR, unchanged');
  assertEq(statFor(st, 1).df, statsOf(PARTY[1], DEFAULT_GEAR[1]).df, '...df too');
  // Kris's doomtype-4 mercy is derived, not hardcoded, and must not move.
  assertEq(Math.round(-partyMaxhp(st, 0) / 2), -80,
    'Kris\'s fell HP is -80 — inside one heal item\'s reach, so a revive stays reachable');
}

section('V-A and V-C are three-member fights and stay on the literal\'s numbers');
{
  for (const v of ['A', 'C']) {
    const st = build(v);
    assertEq(partySize(st), 3, `V-${v} partySize is 3`);
    assertEq(partyTable(st).map((p) => p.name).join(','), 'KRIS,SUSIE,RALSEI', `V-${v} names`);
    assertEq([0, 1, 2].map((s) => partyMaxhp(st, s)).join(','), '160,190,140', `V-${v} maxes`);
    assertEq(Math.round(-partyMaxhp(st, 0) / 2), -80, `V-${v} Kris's fell HP is still -80`);
  }
}

// ══ 3. THE WEIRD ROUTE: SLOT 1 IS NOELLE ══════════════════════════════════
section('V-D: two members, and slot 1 answers NOELLE');
{
  const st = build('D');
  assertEq(partySize(st), 2, 'partySize is 2 — the party is N members');
  assertEq(partyMemberAt(st, 1).name, 'NOELLE', 'slot 1 NAME');
  assert(partyMemberAt(st, 1).name !== 'SUSIE', '...and it is NOT Susie — the user\'s report');
  assertEq(partyMaxhp(st, 1), 120, 'slot 1 MAX HP');
  assert(partyMaxhp(st, 1) !== PARTY[1].maxhp, '...and 120 is not Susie\'s 190, so the seam is observable');
  assertEq(partyMemberAt(st, 1).at, 5, 'slot 1 AT');
  assertEq(partyMemberAt(st, 1).magic, 13, 'slot 1 MAGIC');
  assertEq(partyMemberAt(st, 1).df, 1, 'slot 1 DF — 1, not the base 2 everyone else carries');
  assertEq(partyMaxhp(st, 0), 160, 'and Kris is still Kris');
  // The pad. buildKaizoScene keeps three slots with the spare dead; nothing
  // may answer for it with Ralsei's numbers.
  assertEq(partyMaxhp(st, 2), 0, 'the PAD has no max HP — not Ralsei\'s 140');
  assertEq(partyMemberAt(st, 2).name, '', '...and no name');
  assert(partyMaxhp(st, 2) !== PARTY[2].maxhp, '...and 0 is not 140, so the pad leak is observable');
  assert(statFor(st, 1).magic > PARTY[1].magic,
    'statFor(slot 1) is built on Noelle\'s 13 magic, not Susie\'s 2');
}

// ── THE ONE THING THIS SEAM DELIBERATELY DOES NOT CARRY ───────────────────
//
// EQUIPMENT. The roster carries gear and kaizo/party/roster.js's own
// `gearOfSlot`/`statFor` answer from it; `sim/damage.js`'s `gearOf` does NOT,
// and that split is measured, not forgotten. Wiring it in was written and
// backed out: the roster's measured loadout (scr_gamestart's chapter-3 block)
// has no ShadowMantle on Kris where DEFAULT_GEAR does, so switching this path
// to the roster takes the x0.33 brunt off the one member who can only DOWN
// and the Weird Route party falls at the fourth row of its own 27-row chain
// (check-weirdroute, measured: 4 launched instead of 27).
//
// These assertions PIN THE SPLIT so it cannot be closed by accident in either
// direction. Closing it deliberately means re-running check-weirdroute and
// settling roster.js's GAMESTART_CH3_GEAR question first.
section('the STAT BASE is roster-driven; the GEAR is knowingly not (yet)');
{
  const st = build('D');
  assertEq(gearOfSlot(st, 1).weapon, THORN_RING,
    'the ROSTER says slot 1 carries the ThornRing (13) — kaizo/party/roster.js');
  assert(gearOf(st) === DEFAULT_GEAR || gearOf(st) === st.loadout?.gear,
    'sim/damage.js gearOf() still answers DEFAULT_GEAR / the loadout, NOT the roster');
  assert(gearOf(st)[1].weapon !== THORN_RING,
    '...so the two disagree, ON PURPOSE — see the note at gearOf() and in this file');
}

// ══ 4. THE HALF-READ SEAM IS CLOSED ═══════════════════════════════════════
//
// One accessor, so every path gives the same answer. Each assertion below is
// a path that used to disagree with the others.
section('scr_damage_calculation scales against the TARGET\'s max HP');
{
  const st = bare();
  // The walk is `> maxhp/5 -> -3`, `> maxhp/8 -> -2`, else -1, ONE STEP PER
  // POINT OF DEFENCE. 30 damage sits in a different band for 120 than for 190:
  //   120: 30 > 24   -> -3     190: 30 < 38 and > 23.75 -> -2
  const got = scrDamageCalculation(30, 1, false, st);
  const asSusie = (() => {
    const s2 = bare(NORMAL_ROUTE_PARTY, false);
    return scrDamageCalculation(30, 1, false, s2);
  })();
  assert(got !== asSusie,
    `the band is Noelle's, not Susie's (Noelle ${got} vs Susie ${asSusie})`);
  assertEq(30 > 120 / 5, true, 'CONTROL: 30 is above Noelle\'s maxhp/5 ...');
  assertEq(30 > 190 / 5, false, '... and below Susie\'s');
}

section('scr_damage_maxhp takes a fraction of the TARGET\'s max HP');
{
  const st = bare();
  st.roaringActive = true;             // no redirect, so the target is the one asked for
  st.invTimer = -1;
  const t = scrDamageMaxhp(st, 0.5, true, false, { target: 1 });
  assertEq(t, Math.ceil(120 * 0.5), 'half of Noelle\'s 120 is 60');
  assert(t !== Math.ceil(190 * 0.5), '...and not half of Susie\'s 190');
}

section('the heal cap and the revive fractions are the TARGET\'s — report 2');
{
  const st = bare();
  st.partyHp = [160, 1, 0];
  applyHeal(st, 1, 999);
  assertEq(st.partyHp[1], 120, 'a big heal on Noelle stops at 120');
  assert(st.partyHp[1] !== 190, '...not at Susie\'s 190 — the bar cannot overfill');

  const st2 = bare();
  st2.partyHp = [160, -999, 0];
  assertEq(reviveAmount(st2, 1, 'mint'), 120 - -999, 'Rouxls Mint on Noelle restores to HER max');
  const st3 = bare();
  st3.partyHp = [160, -999, 0];
  assertEq(reviveAmount(st3, 1, 'other'), Math.floor(120 * 0.25) - -999,
    'the quarter-revive is a quarter of 120');
  assert(Math.floor(120 * 0.25) !== Math.floor(190 * 0.25),
    '...and a quarter of 120 is not a quarter of 190, so it is observable');
}

section('Kris\'s doomtype-4 mercy survives the change — BOTH routes');
{
  for (const [label, ids] of [['Weird Route', WEIRD_ROUTE_PARTY], ['Normal Route', NORMAL_ROUTE_PARTY]]) {
    const st = bare(ids, ids === WEIRD_ROUTE_PARTY);
    assertEq(Math.round(-partyMaxhp(st, 0) / 2), -80, `${label}: round(-maxhp[Kris] / 2) is -80`);
  }
}

// ══ 5. THE LOOPS ARE ROSTER-BOUNDED ═══════════════════════════════════════
section('scr_damage_all sweeps the ROSTER, not three slots');
{
  const st = bare();
  // Give the PAD hit points it should never have. If the sweep is still
  // hardcoded to three it will damage a slot nobody is standing in.
  st.partyHp = [160, 120, 55];
  st.invTimer = -1;
  st.invc = 0;
  scrDamageAll(st, 10);
  assertEq(st.partyHp[2], 55, 'the pad took NO damage — the sweep stopped at the roster');
  assert(st.partyHp[0] < 160 && st.partyHp[1] < 120, '...and both real members did take some');
}

section('scr_party_hpaverage cannot see the pad — it is a RE-TARGETING gate');
{
  // The average feeds two `ratio < hpaverage / 2` re-rolls in knightTarget,
  // and each re-roll is a `choose` — an RNG DRAW. A stale slot 2 is therefore
  // a wrong NUMBER OF DRAWS, not merely a wrong target.
  const run = (padHp) => {
    const st = bare();
    st.partyHp = [40, 30, padHp];
    st.charcantarget = [1, 1, 0];
    let draws = 0;
    const choose = () => { draws += 1; return 1; };
    const t = knightTarget(st, 4, { choose, ac: 0 });
    return `${t}/${draws}`;
  };
  assertEq(run(0), run(9999),
    'the pad\'s HP changes neither the target nor the number of choose() draws');
  assertEq(run(0), run(-999), '...and neither does a -999 in it');
}

section('a THREE-member roster still walks all three');
{
  const st = bare(NORMAL_ROUTE_PARTY, false);
  assertEq(partySize(st), 3, 'the Normal Route roster is 3 — the bound is the roster, not "2"');
  st.partyHp = [160, 190, 140];
  st.invTimer = -1;
  st.invc = 0;
  scrDamageAll(st, 10);
  assert(st.partyHp[2] < 140, 'slot 2 IS damaged when a character is standing in it');
}

// ══ 6. THE SEAM IS INERT WITHOUT A ROSTER ═════════════════════════════════
section('nothing in sim/ writes the seam — the A-Side default cannot drift');
{
  const src = readFileSync(join(REPO, 'sim', 'damage.js'), 'utf8');
  for (const rel of ['sim/damage.js', 'sim/items.js', 'sim/spells.js', 'sim/dmgnumbers.js', 'sim/state.js']) {
    const s = readFileSync(join(REPO, rel), 'utf8');
    const writes = s.split('\n').filter((l) => /\.kaizo\s*(\?\.)?\.?roster\s*=/.test(l)
      || /state\.kaizo\.roster\s*=/.test(l));
    assertEq(writes.length, 0, `${rel} never WRITES state.kaizo.roster`);
  }
  assert(src.includes('export const PARTY = ['), 'the literal is still exported for every other consumer');
}

console.log(`\ncheck-party-seam: ${count - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
