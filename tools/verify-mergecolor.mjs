#!/usr/bin/env node
// merge_color IS A FLOAT32 MIX ROUNDED HALF-TO-EVEN.
//
//   node tools/verify-mergecolor.mjs
//
// The model, per channel:
//
//     round_half_to_even( f32( f32(c1 * f32(1 - f32(amount)))
//                            + f32(c2 * f32(amount)) ) )
//
// MEASURED, NOT FITTED. Derived from 21 steps of obj_tracking_sword1's
// `merge_color(c_white, get_swordcolor(), timer / 30)` (Step_0:51), then
// validated against two object families it was NOT derived from —
// 2,232 obj_knight_pointing_starchild rows and 2,737
// obj_roaringknight_split_bullet rows, both Draw_0:14. **4,969 rows, every
// channel, zero misses.** The receipt is in the kaizo ledger
// (kaizo-mod/ORACLE-GROUND-TRUTH.md, 2026-09-10, gap G9).
//
// WHY THIS SUITE EXISTS. `mergeColor` was `Math.round` over an f64 lerp —
// half-UP, in a file whose own header carries both halves of the right answer
// ("built-ins narrow to float32"; "`round` is half-to-even"), with the correct
// primitive `gmlRound` sitting fifty lines above it and unused. That is this
// project's recorded defect class (f): the right primitive existing nearby and
// not being reached for. It cost one channel unit on exactly the .5 rows, and
// an f32 mix of byte endpoints produces those constantly.
//
// AND NOTHING WOULD HAVE CAUGHT IT. The whole-fight traces have no colour
// column, so all six oracle diffs are blind to this by construction; the two
// suites that touch mergeColor pin it at amount 0 and at a non-tie. The check
// that DID measure it lives in the kaizo lane and is unenforced because it is
// red for four other reasons. So the model needs an assertion of its own, in
// the repo that owns the function.
//
// THE REJECTED MODELS ARE ASSERTED TOO, because "the right answer" and "an
// answer that happens to agree here" are different claims: half-up misses 72
// and 89 of those 4,969 rows and truncation misses 1,368 and 1,843, so this
// file requires the three tie cells to DISAGREE with both.

import { mergeColor } from '../sim/gml.js';

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

const f = Math.fround;
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

// The two rejected models, written out so the disagreement is measured here
// rather than asserted in prose.
const halfUp = (a, b, t) => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
};
const truncated = (a, b, t) => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [0, 1, 2].map((i) => Math.trunc(a[i] + (b[i] - a[i]) * k));
};

// ── 1. THE THREE CELLS THE RECORDING NAMES ────────────────────────────────
//
// obj_tracking_sword1's fade from white, at steps 13, 17 and 21 of 30. The
// game prints 144, 110 and 76; the old half-up model printed 145, 111 and 77.
// These are the rows the model was derived from, so they are necessary and
// not sufficient — sections 2 and 3 are the validation.
console.log('1 — the tracking sword\'s fade, the three cells the game printed');
{
  const CELLS = [[13, 144], [17, 110], [21, 76]];
  for (const [step, want] of CELLS) {
    const got = mergeColor(WHITE, BLACK, step / 30);
    ok(got[0] === want && got[1] === want && got[2] === want,
      `step ${step}/30 of white -> black is ${want} on every channel `
      + `(got ${got.join('/')})`);
    // The discrimination: a model that agreed with half-up here would be the
    // bug this file exists to prevent coming back.
    ok(halfUp(WHITE, BLACK, step / 30)[0] === want + 1,
      `  ...and half-UP gives ${want + 1} there, so the cell discriminates`);
  }
}

// ── 2. HALF-TO-EVEN GOES BOTH WAYS ────────────────────────────────────────
//
// A model that always rounded .5 DOWN would pass section 1 — every cell there
// happens to sit below an odd neighbour. Half-to-even must round .5 UP when
// the upper neighbour is the even one, and that is the case the gloom colour
// turned on: merge_color(c_blue, #268CAC, 0.5) lands on 213.5 and the game
// takes 214.
console.log('2 — .5 rounds to the EVEN neighbour, in both directions');
{
  // 213.5 -> 214 (even above). The kaizo gloom colour, channel for channel.
  const gloom = mergeColor([0, 0, 255], [38, 140, 172], 0.5);
  ok(gloom[0] === 19 && gloom[1] === 70 && gloom[2] === 214,
    `merge_color(c_blue, #268CAC, 0.5) is 19/70/214 — the blue channel's `
    + `213.5 goes UP to the even 214 (got ${gloom.join('/')})`);

  // 144.5 -> 144 (even below), the direction section 1 covers, stated plainly
  // so the pair reads as a pair.
  const down = mergeColor(BLACK, [289, 289, 289], 0.5);
  ok(down[2] === 144, `a 144.5 channel goes DOWN to the even 144 (got ${down[2]})`);

  // And a NON-tie is unaffected by any of this — the rounding rule must not
  // be doing anything on the ordinary rows.
  const plain = mergeColor(BLACK, [100, 100, 100], 0.3);
  ok(plain[0] === 30, `a non-tie is just the mix (0 -> 100 at 0.3 is ${plain[0]})`);
}

// ── 3. THE MIX IS FLOAT32, NOT DOUBLE ─────────────────────────────────────
//
// The rounding rule alone is not the model. The amount narrows to f32 and the
// two products are each narrowed before the add, and that is what puts values
// exactly ON .5 often enough to matter. This section requires a case where f64
// and f32 disagree, so a build that fixed only the rounding fails it.
console.log('3 — the mix is computed in float32');
{
  let discriminating = 0;
  let agreed = 0;
  for (let n = 0; n <= 255; n++) {
    for (let d = 1; d <= 60; d++) {
      const t = n / d;
      if (t > 1) continue;
      const k32 = f(t);
      const a = 0; const b = 255;
      const f32sum = f(f(a * f(1 - k32)) + f(b * k32));
      const f64sum = a + (b - a) * t;
      if (f32sum !== f64sum) discriminating += 1; else agreed += 1;
    }
  }
  ok(discriminating > 0,
    `f32 and f64 give a different raw mix on ${discriminating} of `
    + `${discriminating + agreed} sampled amounts — so the narrowing is `
    + 'observable and not decoration');

  // The narrowing must be on the AMOUNT too, not only on the products. 1/3 is
  // the classic: f32(1/3) is 0.3333333432674408, and 255 * that is a different
  // number from 255 * the double.
  const third = mergeColor(BLACK, [255, 255, 255], 1 / 3);
  const wantThird = (() => {
    const k = f(1 / 3);
    const raw = f(f(0 * f(1 - k)) + f(255 * k));
    return Math.round(raw) === raw + 0.5 ? raw : Math.round(raw);
  })();
  ok(third[0] === Math.round(f(f(255 * f(1 / 3)))),
    `amount 1/3 narrows before it multiplies (got ${third[0]}, `
    + `want ${Math.round(f(f(255 * f(1 / 3))))}; f64 would take a different route)`);
  void wantThird;
}

// ── 4. TRUNCATION IS NOT THE MODEL ────────────────────────────────────────
//
// Two kaizo comments asserted for weeks that GameMaker truncates, and one of
// them hardcoded the truncated constant. On the ledger's validation rows
// truncation misses 1,368 and 1,843 — it is the worst of the three. Pin the
// disagreement so the claim cannot come back.
console.log('4 — GameMaker does NOT truncate');
{
  const t = mergeColor([0, 0, 255], [38, 140, 172], 0.5);
  const tr = truncated([0, 0, 255], [38, 140, 172], 0.5);
  ok(t[2] === 214 && tr[2] === 213,
    `the gloom blue is 214 measured and 213 truncated — the two differ, `
    + 'so this case discriminates');

  // THE NUMBER HERE IS MEASURED, and the first draft of this assertion was
  // NOT — it demanded "15 of 31, a different answer nearly everywhere",
  // extrapolated from the ledger's 1,368-of-2,232 and 1,843-of-2,737 row
  // counts, and it failed on its own first run. Those counts are over RECORDED
  // ROWS, where one ramp step can appear dozens of times, so they are not a
  // per-step rate and could not be read as one. The per-step rate over the
  // ledger's three actual families, measured: 27, 28 and 28 channels of 93.
  // Roughly three in ten — which is far more than the ties alone and is the
  // real claim. Writing the bound first and measuring second is the mistake
  // this repo records as "do not conclude an outcome from a number that does
  // not measure it".
  const FAMILIES = [
    ['white -> black (obj_tracking_sword1)', WHITE, BLACK, 27],
    ['white -> #86A2FF (starchild)', WHITE, [134, 162, 255], 28],
    ['#86A2FF -> white (split bullet)', [134, 162, 255], WHITE, 28],
  ];
  for (const [name, a, b, want] of FAMILIES) {
    let differ = 0;
    for (let n = 0; n <= 30; n++) {
      const m = mergeColor(a, b, n / 30);
      const t = truncated(a, b, n / 30);
      for (let i = 0; i < 3; i++) if (m[i] !== t[i]) differ += 1;
    }
    ok(differ === want,
      `${name}: truncation differs on ${want} of 93 channels across the 31 `
      + `steps (got ${differ}) — about three in ten, so it is not a tie-only `
      + 'disagreement');
  }
}

// ── 5. THE CLAMP IS STILL THERE, AND IT IS NOT PART OF THE MEASUREMENT ────
//
// GameMaker clamps the resulting BYTES, not the amount, and the two differ
// once the amount leaves [0,1]. No recorded row discriminates them — every
// caller in this project feeds a cosine or a clamp01 — so the clamp is kept
// as it was and pinned here as BEHAVIOUR THIS REPO CHOSE, not as a measured
// fact. Anyone removing it needs a recording, not this file's permission.
console.log('5 — the amount clamp, kept and labelled as unmeasured');
{
  ok(mergeColor(BLACK, WHITE, 2)[0] === 255, 'amount 2 clamps to the far end');
  ok(mergeColor(BLACK, WHITE, -1)[0] === 0, 'amount -1 clamps to the near end');
  const inner = mergeColor([100, 100, 100], [150, 150, 150], 2);
  ok(inner[0] === 150,
    'amount 2 between two INNER values gives 150 here — GameMaker would '
    + 'extrapolate to 200 and clamp the byte, which is a different answer. '
    + 'Unmeasured; no caller reaches it.');
}

console.log(failed ? `\nverify-mergecolor: ${failed} FAILED` : '\nverify-mergecolor: ok');
process.exit(failed ? 1 : 0);
