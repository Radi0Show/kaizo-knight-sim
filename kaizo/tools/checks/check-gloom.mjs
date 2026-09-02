#!/usr/bin/env node
// check-gloom — positive assertions on the KAIZO B-Side GLOOM engine
// (kaizo/party/gloom.js) and the B-Side TP clamp (kaizo/party/tensionbar.js).
//
// V-C/V-D recreation of EnderCat8s Kaizo Roaring Knight — private check, do
// not publish without permission.
//
// Every assertion here is on something the B-Side ADDS. Delete either module
// and this suite cannot run; stub them out to vanilla behaviour and it fails
// on the first scenario: vanilla has no gloom at all, and vanilla TP tops out
// at MAX_TENSION (250), not 125.
//
// The two headline outcomes the work item names are scenarios A and N/P:
//   A — gloom removes HP over time on the slot carrying it, and removes none
//       from a slot without it.
//   N/P — TP saturates at 125 on the B-Side, where sim/tension.js's own
//       MAX_TENSION is 250.

import { createState, spawn, stepFrame } from '../../../sim/index.js';
import { makeInputTable } from '../../../input/state.js';
import { gmlCreate } from '../../../sim/rng.js';
import { MAX_TENSION, scrTensionheal } from '../../../sim/tension.js';

import {
  GLOOM_SCR_DAMAGE_CAP,
  GLOOM_TEXT_THRESHOLD,
  charIdOfSlot,
  ensureGloom,
  gloomDarktime,
  gloomEngine,
  kaizoCharboxGloom,
  kaizoGloomAccrue,
  kaizoGloomBarSegment,
  kaizoGloomClampToHp,
  kaizoGloomSplitDamage,
  kaizoGloomSplitMaxhp,
  kaizoGloomStep,
  kaizoGloomemit,
  kaizoRudeBusterGloomBlend,
  rosterCharIds,
  slotOfCharId,
} from '../../../kaizo/party/gloom.js';

import {
  KAIZO_SIDEB_TP_CAP,
  kaizoCanAfford,
  kaizoEffectiveTpCeiling,
  kaizoTensionClampActive,
  kaizoTensionPercent,
  kaizoTensionbarDraw,
  kaizoTensionbarLayout,
  kaizoTensionbarSprites,
  kaizoTpbar,
  tensionbarDraw,
} from '../../../kaizo/party/tensionbar.js';

const failures = [];
let checks = 0;

function assert(cond, msg) {
  checks += 1;
  if (!cond) failures.push(msg);
}

function eq(got, want, msg) {
  checks += 1;
  if (got !== want) failures.push(`${msg}: got ${got}, want ${want}`);
}

function deepEq(got, want, msg) {
  checks += 1;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${msg}: got ${a}, want ${b}`);
}

const KRIS = 1;
const SUSIE = 2;
const RALSEI = 3;
const NOELLE = 4;

const NAMES = { 1: 'KRIS', 2: 'SUSIE', 3: 'RALSEI', 4: 'NOELLE' };
const MAXHP = { 1: 160, 2: 190, 3: 140, 4: 120 };

/**
 * A bare state carrying only what gloom/tensionbar read. Deliberately NOT
 * createState: the engine is meant to run off the shared contract fields
 * alone, and a scenario that needs the whole sim is a worse test of that.
 */
function makeState({ chars = [KRIS, NOELLE], sideb = true, seed = 1, hp = null,
  mnfight = 2, tension = 0, tpscene = 0 } = {}) {
  return {
    partyHp: hp ? [...hp] : chars.map((c) => MAXHP[c]),
    chardead: chars.map(() => 0),
    tension,
    gmlRng: gmlCreate(seed),
    roaringActive: false,
    knight: { practicemode: false },
    kaizo: {
      sideb,
      mnfight,
      tpscene,
      roster: chars.map((c) => ({ charId: c, name: NAMES[c], maxhp: MAXHP[c] })),
    },
  };
}

const rngFingerprint = (r) => `${Array.from(r.state).join(',')}|${r.idx}`;

// ── A: THE HEADLINE — gloom drains the slot that carries it, and only it ──
{
  const s = makeState({ chars: [KRIS, NOELLE] });
  const led = ensureGloom(s);
  led.gloom[0] = 10; // Kris, slot 0
  led.gloom[1] = 0; //  Noelle, slot 1 — clean

  const tickFrames = [];
  for (let f = 1; f <= 100; f++) {
    const before = s.partyHp[0];
    kaizoGloomStep(s);
    if (s.partyHp[0] !== before) tickFrames.push(f);
  }

  // Ten stacks of gloom cost ten HP eventually, but the CURVE is the point:
  // _darktime = ceil(max(18 - gloom/5, 1)) is 16 at ten stacks and lengthens
  // as the meter drains, so the first five ticks land at 16/33/50/67/84 and
  // not on any even cadence.
  deepEq(tickFrames, [16, 33, 50, 67, 84], 'A gloom tick frames (gloom 10)');
  eq(s.partyHp[0], 155, 'A gloomed slot lost exactly 5 HP in 100 frames');
  eq(led.gloom[0], 5, 'A gloom meter drained with the HP');
  eq(s.partyHp[1], MAXHP[NOELLE], 'A clean slot lost NO HP');
  eq(led.gloom[1], 0, 'A clean slot has no gloom');
  eq(ensureGloom(s).timer[1], 0, 'A clean slot never started its timer');

  // The same setup on side A does nothing at all — the whole engine is inside
  // `if (k_sideb)`.
  const sa = makeState({ chars: [KRIS, NOELLE], sideb: false });
  ensureGloom(sa).gloom[0] = 10;
  for (let f = 0; f < 100; f++) kaizoGloomStep(sa);
  eq(sa.partyHp[0], MAXHP[KRIS], 'A side A: gloom engine is inert');
  eq(ensureGloom(sa).gloom[0], 10, 'A side A: meter untouched');
}

// ── B: the tick curve itself ──────────────────────────────────────────────
{
  eq(gloomDarktime(1), 18, 'B darktime at 1 stack');
  eq(gloomDarktime(5), 17, 'B darktime at 5 stacks');
  // 18 - 9/5 = 16.2, and it CEILS to the slower period, not floors.
  eq(gloomDarktime(9), 17, 'B darktime at 9 stacks ceils to 17');
  eq(gloomDarktime(10), 16, 'B darktime at 10 stacks');
  eq(gloomDarktime(20), 14, 'B darktime at 20 stacks');
  eq(gloomDarktime(GLOOM_SCR_DAMAGE_CAP), 9, 'B darktime at the 45 cap');
  eq(gloomDarktime(65), 5, 'B darktime at 65 stacks');
  // max(..., 1) takes over at 85: one HP per FRAME.
  eq(gloomDarktime(85), 1, 'B darktime saturates at 85 stacks');
  eq(gloomDarktime(90), 1, 'B darktime stays 1 past saturation');
  eq(gloomDarktime(500), 1, 'B darktime never goes below 1');
}

// ── C: the bullets gate — emits without drains ───────────────────────────
{
  const s = makeState({ chars: [KRIS, NOELLE], mnfight: 0 });
  ensureGloom(s).gloom[0] = 10;
  let emits = 0;
  for (let f = 0; f < 100; f++) emits += kaizoGloomStep(s).emits;
  // `if (scr_isphase("bullets"))` gates ONLY the two decrements. The timer
  // still resets and the particles still burst — every 16 frames, forever,
  // because the meter never drains to change the period.
  eq(emits, 6, 'C emits still fire outside the bullet phase');
  eq(s.partyHp[0], MAXHP[KRIS], 'C no HP drain outside the bullet phase');
  eq(ensureGloom(s).gloom[0], 10, 'C meter does not drain outside bullets');
}

// ── D: hp < 0 wipes the meter ────────────────────────────────────────────
{
  const s = makeState({ chars: [KRIS, NOELLE] });
  const led = ensureGloom(s);
  led.gloom[0] = 20;
  led.timer[0] = 5;
  s.partyHp[0] = -999;
  kaizoGloomStep(s);
  eq(led.gloom[0], 0, 'D fallen member loses all gloom');
  eq(led.timer[0], 0, 'D fallen member loses its timer');
  eq(s.partyHp[0], -999, 'D the wipe does not touch HP');
}

// ── E: gloom walks a member to 0 and past it, and nothing calls scr_dead ──
{
  const s = makeState({ chars: [KRIS, NOELLE] });
  const led = ensureGloom(s);
  s.partyHp[0] = 1;
  led.gloom[0] = 90; // darktime 1 — every frame

  kaizoGloomStep(s);
  eq(s.partyHp[0], 0, 'E gloom takes the last point of HP');
  eq(led.gloom[0], 89, 'E and one point of itself');
  // `global.hp[i] < 0` is STRICT, so 0 is not the stopping condition.
  kaizoGloomStep(s);
  eq(s.partyHp[0], -1, 'E and keeps going past zero');
  eq(led.gloom[0], 88, 'E meter still draining at -1 HP');
  kaizoGloomStep(s);
  eq(led.gloom[0], 0, 'E the < 0 branch finally wipes it');
  eq(s.partyHp[0], -1, 'E HP left where the drain stopped');
  // ORIGINAL: nothing in Step_2 calls scr_dead. A gloom-drained member sits at
  // negative HP with every down-flag still clear.
  eq(s.chardead[0], 0, 'E gloom never marks the member dead');
}

// ── F: accrual, and the asymmetric 45 cap ────────────────────────────────
{
  // scr_damage caps at 45 ...
  const a = makeState();
  kaizoGloomAccrue(a, 0, 60, { cap45: true });
  eq(ensureGloom(a).gloom[0], GLOOM_SCR_DAMAGE_CAP, 'F scr_damage path caps gloom at 45');

  // ... scr_damage_maxhp does not. This asymmetry is the mod's, and it is what
  // lets a maxhp slash drop a character into the fast half of the tick curve
  // in one hit.
  const b = makeState();
  kaizoGloomAccrue(b, 0, 60, { cap45: false });
  eq(ensureGloom(b).gloom[0], 60, 'F maxhp path has NO 45 cap');
  assert(gloomDarktime(60) < gloomDarktime(GLOOM_SCR_DAMAGE_CAP),
    'F past the cap the meter ticks faster than the cap allows');

  // Both paths clamp to hp - 1 after the add.
  const c = makeState({ hp: [30, 120] });
  kaizoGloomAccrue(c, 0, 100, { cap45: false });
  eq(ensureGloom(c).gloom[0], 29, 'F gloom clamped to hp - 1');

  // `hp > 1`, not `hp > 0` — a member on exactly 1 HP has the meter WIPED.
  const d = makeState({ hp: [1, 120] });
  ensureGloom(d).gloom[0] = 20;
  kaizoGloomAccrue(d, 0, 10, { cap45: true });
  eq(ensureGloom(d).gloom[0], 0, 'F a hit at 1 HP wipes gloom instead of adding');

  // practicemode disables accrual outright.
  const e = makeState();
  e.knight.practicemode = true;
  ensureGloom(e).gloom[0] = 12;
  kaizoGloomAccrue(e, 0, 30, { cap45: true });
  eq(ensureGloom(e).gloom[0], 0, 'F practice mode wipes gloom rather than booking it');

  // Side A books nothing.
  const f = makeState({ sideb: false });
  kaizoGloomAccrue(f, 0, 30, { cap45: true });
  eq(ensureGloom(f).gloom[0] ?? 0, 0, 'F side A books no gloom');

  // SnowGrave's re-clamp line.
  const g = makeState({ hp: [40, 120] });
  ensureGloom(g).gloom[0] = 90;
  eq(kaizoGloomClampToHp(g, 0), 39, 'F SnowGrave re-clamp to hp - 1');
}

// ── G: the two splits, and their different ratios ────────────────────────
{
  const s = makeState();
  // scr_damage: ceil(damage / 6), floored at 10, and the > 120 soften.
  deepEq(kaizoGloomSplitDamage(s, 62), { gloomdmg: 11, damage: 62 },
    'G scr_damage split at 62 (no soften below 121)');
  deepEq(kaizoGloomSplitDamage(s, 30), { gloomdmg: 10, damage: 30 },
    'G scr_damage split floors gloom at 10');
  deepEq(kaizoGloomSplitDamage(s, 153), { gloomdmg: 26, damage: 123 },
    'G scr_damage split at 153: gloom off the RAW value, damage softened');

  // scr_damage_maxhp: a quarter, no floor, unconditional soften.
  deepEq(kaizoGloomSplitMaxhp(s, 160), { gloomdmg: 40, damage: 128 },
    'G maxhp split at a full Kris bar');
  assert(kaizoGloomSplitMaxhp(s, 120).gloomdmg > kaizoGloomSplitDamage(s, 120).gloomdmg,
    'G the maxhp path books more gloom per point than scr_damage');

  const sa = makeState({ sideb: false });
  deepEq(kaizoGloomSplitDamage(sa, 153), { gloomdmg: 0, damage: 153 },
    'G side A: no gloom, no soften');
  deepEq(kaizoGloomSplitMaxhp(sa, 160), { gloomdmg: 0, damage: 160 },
    'G side A: maxhp untouched');
}

// ── H: Noelle's weapon-13 exemption ──────────────────────────────────────
{
  const s = makeState({ chars: [KRIS, NOELLE] });
  s.kaizo.charweapon = [];
  s.kaizo.charweapon[4] = 13; // char-indexed, as the mod holds it
  kaizoGloomAccrue(s, 1, 40, { cap45: true }); // slot 1 IS Noelle
  eq(ensureGloom(s).gloom[1], 0, 'H Noelle with weapon 13 books no gloom');
  kaizoGloomAccrue(s, 0, 40, { cap45: true }); // slot 0 is Kris
  eq(ensureGloom(s).gloom[0], 40, 'H the exemption is Noelle-only');

  const t = makeState({ chars: [KRIS, NOELLE] });
  kaizoGloomAccrue(t, 1, 40, { cap45: true });
  eq(ensureGloom(t).gloom[1], 40, 'H Noelle without weapon 13 books normally');
}

// ── I: kaizo_gloomemit's RNG cost, and the EMIT ORDER ────────────────────
{
  // 12 draws for anyone but Susie; 14 for her, because `if (_ob == 1410)`
  // recomputes _xx and throws the first random_range away.
  const k = makeState({ chars: [KRIS, NOELLE] });
  eq(kaizoGloomemit(k, 0), 12, 'I Kris emit costs 12 draws');
  eq(kaizoGloomemit(k, 1), 12, 'I Noelle emit costs 12 draws');

  const su = makeState({ chars: [KRIS, SUSIE, RALSEI] });
  eq(kaizoGloomemit(su, 1), 14, 'I Susie emit costs 14 draws (the discarded _xx)');
  eq(kaizoGloomemit(su, 2), 12, 'I Ralsei emit costs 12 draws');

  // `if (i_ex(obj_knight_roaring2)) exit;` — free during the finale.
  const r = makeState({ chars: [KRIS, NOELLE] });
  r.roaringActive = true;
  eq(kaizoGloomemit(r, 0), 0, 'I emit spends nothing while Roaring is up');

  // THE COST FOLLOWS THE CHARACTER, NOT THE SLOT. Put Susie in slot 0 and
  // Kris in slot 1: slot 0 must now cost Susie's 14 and slot 1 Kris's 12. A
  // translation that keyed the emit off the slot index would have them the
  // other way round.
  const rev = makeState({ chars: [SUSIE, KRIS], seed: 99 });
  eq(kaizoGloomemit(rev, 0), 14, 'I reversed roster: slot 0 costs Susie\'s 14');
  eq(kaizoGloomemit(rev, 1), 12, 'I reversed roster: slot 1 costs Kris\'s 12');

  // The engine's own pass, both ticking on the same frame.
  const both = makeState({ chars: [SUSIE, KRIS], seed: 99 });
  const ledR = ensureGloom(both);
  ledR.gloom[0] = 90;
  ledR.gloom[1] = 90; // both at darktime 1, so both tick this frame
  const stepped = kaizoGloomStep(both);
  eq(stepped.emits, 2, 'I both members emitted');
  eq(stepped.draws, 26, 'I two emits cost 12 + 14 draws');

  // The mod walks obj_herokris, obj_herosusie, obj_heroralsei, obj_heronoelle
  // in that order — CHARACTER order, not slot order — and kaizoGloomStep
  // preserves it. It is NOT observable here and the check does not pretend
  // otherwise: both orders spend the same 26 draws and WELL512's state after n
  // draws does not depend on who spent them, so the two fingerprints match.
  const charOrder = makeState({ chars: [KRIS, SUSIE], seed: 99 });
  kaizoGloomemit(charOrder, 0); // Kris
  kaizoGloomemit(charOrder, 1); // Susie
  eq(rngFingerprint(both.gmlRng), rngFingerprint(charOrder.gmlRng),
    'I the engine leaves the stream where 12 + 14 draws leave it');
}

// ── J: the charbox call site, and the INDEX.md indexing disagreement ─────
{
  const s = makeState({ chars: [KRIS, NOELLE] });
  const led = ensureGloom(s);
  led.gloom[0] = 7; // Kris, slot 0
  led.gloom[1] = 9; // Noelle, slot 1

  deepEq(rosterCharIds(s), [KRIS, NOELLE], 'J Weird Route roster is Kris + Noelle');
  eq(slotOfCharId(s, NOELLE), 1, 'J Noelle is slot 1');
  eq(charIdOfSlot(s, 1), NOELLE, 'J slot 1 holds char id 4');

  // scr_charbox indexes `k_gloom[c + 1]` with c = havechar index = charId - 1.
  eq(kaizoCharboxGloom(s, KRIS), 7, 'J charbox reads Kris by CHAR ID');
  eq(kaizoCharboxGloom(s, NOELLE), 9, 'J charbox reads Noelle by CHAR ID');
  // If `c + 1` were the slot+1 that deltas/INDEX.md open item 9 claims, char
  // id 2 would land on slot 1 and read Noelle's 9. It reads 0, because Susie
  // is not in the party at all.
  eq(kaizoCharboxGloom(s, SUSIE), 0,
    'J absent Susie reads 0 — not Noelle\'s meter through a slot+1 index');
  eq(kaizoCharboxGloom(s, RALSEI), 0, 'J absent Ralsei reads 0');

  // The HP bar's gloom band, ceil on both ends over a 75px fill.
  const seg = kaizoGloomBarSegment(s, NOELLE, MAXHP[NOELLE]);
  eq(seg.lx, 70, 'J gloom band left edge ceils (111/120 * 75)');
  eq(seg.rx, 75, 'J gloom band right edge is the HP edge');
  eq(kaizoGloomBarSegment(s, SUSIE, MAXHP[SUSIE]), null, 'J no band for an absent member');
  const clean = makeState({ chars: [KRIS, NOELLE] });
  eq(kaizoGloomBarSegment(clean, KRIS, MAXHP[KRIS]), null, 'J no band at zero gloom');
  const sa = makeState({ chars: [KRIS, NOELLE], sideb: false });
  ensureGloom(sa).gloom[0] = 7;
  eq(kaizoGloomBarSegment(sa, KRIS, MAXHP[KRIS]), null, 'J no band on side A');

  eq(GLOOM_TEXT_THRESHOLD, 36, 'J the k_gtext callout threshold');
}

// ── K: the Rude Buster tint, hardcoded to char id 2 ──────────────────────
{
  const withSusie = makeState({ chars: [KRIS, SUSIE, RALSEI] });
  ensureGloom(withSusie).gloom[1] = 30;
  eq(kaizoRudeBusterGloomBlend(withSusie), 0.2, 'K tint tracks Susie\'s meter');
  ensureGloom(withSusie).gloom[1] = 60;
  eq(kaizoRudeBusterGloomBlend(withSusie), 0.3, 'K tint caps at 0.3');

  const weird = makeState({ chars: [KRIS, NOELLE] });
  ensureGloom(weird).gloom[0] = 90;
  ensureGloom(weird).gloom[1] = 90;
  eq(kaizoRudeBusterGloomBlend(weird), 0,
    'K no Susie, no tint — the mod reads k_gloom[2] literally');
}

// ═══════════════════════ TP CLAMP ════════════════════════════════════════

// ── L/M: the gate — side A never clamps, and side B not before the shear ──
{
  eq(MAX_TENSION, 250, 'L the sim\'s vanilla TP ceiling');
  eq(KAIZO_SIDEB_TP_CAP, 125, 'L the B-Side ceiling');
  assert(KAIZO_SIDEB_TP_CAP < MAX_TENSION, 'L the B-Side ceiling is the lower one');

  const a = makeState({ sideb: false, tension: 250, tpscene: -1 });
  const ra = kaizoTensionbarDraw(a);
  eq(a.tension, 250, 'L side A keeps the full 250');
  eq(ra.clamped, false, 'L side A never enters the clamp block');
  eq(ra.draws, 0, 'L side A spends no bleed RNG');

  const pre = makeState({ sideb: true, tension: 250, tpscene: 0 });
  const rp = kaizoTensionbarDraw(pre);
  eq(pre.tension, 250, 'M side B before the shear still holds 250');
  eq(rp.clamped, false, 'M the gate needs k_tpscene >= 10 or == -1');
  eq(kaizoTensionClampActive(pre), false, 'M gate closed at k_tpscene 0');

  for (const sc of [10, 11, 11.1, 11.2, 12, -1]) {
    const s = makeState({ sideb: true, tension: 250, tpscene: sc });
    assert(kaizoTensionClampActive(s), `M gate open at k_tpscene ${sc}`);
  }
  for (const sc of [0, 1, 1.1, 2, 3, 4, 4.1, 5]) {
    const s = makeState({ sideb: true, tension: 250, tpscene: sc });
    assert(!kaizoTensionClampActive(s), `M gate shut at k_tpscene ${sc}`);
  }
}

// ── N: THE HEADLINE — TP is cut to 125, and the bleed's RNG is spent ─────
{
  const s = makeState({ sideb: true, tension: 250, tpscene: -1 });
  const bar = kaizoTpbar(s);
  bar.apparent = 250;
  bar.current = 250;

  const r = kaizoTensionbarDraw(s);
  eq(s.tension, 125, 'N the shear cuts banked TP to 125');
  eq(bar.apparent, 125, 'N and clamps the fast trailing value');
  eq(bar.current, 125, 'N and the slow one');
  // The bleed loop walks 125.1 upward by 7.5 (tension >= 200) to 192.6 — ten
  // steps, three markers each, three random_range per marker.
  eq(r.particles, 51, 'N 17 TP steps x 3 columns of bleed markers');
  eq(r.draws, 153, 'N nine RNG draws per bleed step, all spent');

  // Once clamped, the next frame emits nothing: the loop only runs above 125.
  const r2 = kaizoTensionbarDraw(s);
  eq(r2.particles, 0, 'N no bleed once TP sits at the cap');
  eq(r2.draws, 0, 'N and no RNG spent');
  eq(s.tension, 125, 'N TP stays at the cap');
}

// ── O: the _sep branch at 200 changes the draw count ─────────────────────
{
  const lo = makeState({ sideb: true, tension: 199, tpscene: -1 });
  const rl = kaizoTensionbarDraw(lo);
  eq(rl.draws, 171, 'O below 200 the bleed steps by 4 — 19 steps');

  const hi = makeState({ sideb: true, tension: 200, tpscene: -1 });
  const rh = kaizoTensionbarDraw(hi);
  eq(rh.draws, 90, 'O at 200 it steps by 7.5 — 10 steps');
  assert(rh.draws < rl.draws, 'O more TP but FEWER draws: the _sep branch is real');

  const mid = makeState({ sideb: true, tension: 150, tpscene: -1 });
  eq(kaizoTensionbarDraw(mid).draws, 63, 'O 150 TP is seven bleed steps');

  const at = makeState({ sideb: true, tension: 125, tpscene: -1 });
  eq(kaizoTensionbarDraw(at).draws, 0, 'O exactly 125 bleeds nothing (loop starts at 125.1)');
}

// ── P: SATURATION — TP cannot be banked past 125 ─────────────────────────
{
  const b = makeState({ sideb: true, tension: 0, tpscene: -1 });
  const a = makeState({ sideb: false, tension: 0, tpscene: -1 });
  const seen = [];
  for (let f = 0; f < 20; f++) {
    scrTensionheal(b, 50); // grazing, in bulk
    scrTensionheal(a, 50);
    kaizoTensionbarDraw(b);
    kaizoTensionbarDraw(a);
    seen.push(b.tension);
  }
  eq(Math.max(...seen), 125, 'P B-Side TP never settles above 125');
  eq(b.tension, 125, 'P B-Side saturates at 125');
  eq(a.tension, MAX_TENSION, 'P side A saturates at the vanilla 250');
  assert(a.tension > b.tension, 'P the clamp is what separates them');

  // The consequence that makes it a mechanic and not a paint job: a spell
  // priced above 125 is castable on side A and permanently is not on B.
  assert(kaizoCanAfford(a, 150), 'P a 150 TP spell is affordable on side A');
  assert(!kaizoCanAfford(b, 150), 'P the same spell is unaffordable on the B-Side');
  eq(kaizoEffectiveTpCeiling(b), 125, 'P B-Side ceiling reported as 125');
  eq(kaizoEffectiveTpCeiling(a), MAX_TENSION, 'P side A ceiling reported as 250');

  // global.maxtension is STILL 250, so the sheared bar tops out at 50% and
  // MAX can never light again.
  eq(kaizoTensionPercent(b), 50, 'P a full B-Side bar reads 50%');
  eq(kaizoTpbar(b).maxed, 0, 'P MAX is unreachable once the bar is sheared');
  eq(kaizoTensionPercent(a), 100, 'P a full side-A bar reads 100%');
  eq(kaizoTpbar(a).maxed, 1, 'P and lights MAX');
}

// ── Q: the end-cutscene early exit skips the clamp entirely ──────────────
{
  const s = makeState({ sideb: true, tension: 250, tpscene: -1 });
  s.kaizo.endCutsceneVersion = 1;
  const r = kaizoTensionbarDraw(s);
  eq(s.tension, 250, 'Q the Draw exits before the clamp during the finale');
  eq(r.clamped, false, 'Q no clamp reported');
  eq(r.draws, 0, 'Q no bleed RNG spent');
}

// ── R: the visual reporting, gated the same way ──────────────────────────
{
  const pre = makeState({ sideb: true, tpscene: 0 });
  const post = makeState({ sideb: true, tpscene: -1 });
  eq(kaizoTensionbarSprites(pre).bar, 'spr_tensionbar', 'R vanilla bar before the shear');
  eq(kaizoTensionbarSprites(post).bar, 'spr_tensionbar_sliced', 'R MOD-ADDED bar after it');
  eq(kaizoTensionbarSprites(post).tplogo, false, 'R the TP logo is suppressed');
  eq(kaizoTensionbarLayout(post).yoff, 32, 'R the % readout drops 32px');
  eq(kaizoTensionbarLayout(pre).yoff, 0, 'R and does not before');
}

// ── S: both engines inside a real sim frame, via their entity wrappers ───
{
  const state = createState({ seed: 5 });
  state.partyHp = [160, 190, 140];
  state.kaizo = {
    sideb: true,
    mnfight: 2,
    tpscene: -1,
    roster: [KRIS, SUSIE, RALSEI].map((c) => ({ charId: c, name: NAMES[c], maxhp: MAXHP[c] })),
  };
  state.tension = 250;
  ensureGloom(state).gloom[0] = 20; // Kris only

  // Spawn the bar FIRST so it is the older instance: the sim runs endStep
  // newest-first, which puts the gloom engine ahead of the bar's Draw — the
  // game's order, where the Draw follows every End Step.
  spawn(state, tensionbarDraw, { x: 0, y: 0 });
  spawn(state, gloomEngine, { x: 0, y: 0 });

  const inputAt = makeInputTable([{ from: 0 }]);
  for (let f = 0; f < 30; f++) stepFrame(state, inputAt(f));

  // darktime at 20 stacks is 14, so two ticks land inside 30 frames.
  eq(state.partyHp[0], 158, 'S the gloom engine ran from the sim\'s end step');
  eq(ensureGloom(state).gloom[0], 18, 'S and drained the meter with it');
  eq(state.partyHp[1], 190, 'S Susie, ungloomed, is untouched');
  eq(state.partyHp[2], 140, 'S Ralsei too');
  eq(state.tension, 125, 'S the bar clamped TP inside the same frame loop');
  eq(kaizoTpbar(state).maxed, 0, 'S and MAX stayed dark');
}

// ── report ───────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`check-gloom: ${failures.length} FAILURE(S) of ${checks} checks`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`check-gloom: ${checks} checks passed`);
process.exit(0);
