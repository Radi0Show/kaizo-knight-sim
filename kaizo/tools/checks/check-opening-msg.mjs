#!/usr/bin/env node
// KAIZO — THE B-SIDE ENCOUNTER OPENER (ledger G-13).
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE
//   gml_GlobalScript_scr_encountersetup.gml:713-718 (KAIZO dump), case 115:
//
//       global.battlemsg[0] = stringsetloc("* The Roaring Knight appeared.", ...);
//       if (global.flag[456])
//       {
//           global.battlemsg[0] = k_stringsetloc(
//               "* The Roaring Knight appeared^1.&* Something seems wrong.",
//               "＊ 咆哮の騎士が　現れた。^1&＊ 何かがおかしい。");
//       }
//
//   The vanilla v105 copy of case 115 ends at the first assignment — diffed
//   directly, so this is EnderCat8's addition and not chapter-build churn.
//   `global.flag[456]` is the Snowgrave flag, the same one
//   `gml_Object_obj_knight_enemy_Create_0.gml:115` reads into `k_sideb`
//   (kaizo/party/WEIRD-ROUTE.md lists all six sites).
//
// WHY IT MATTERS OUT OF PROPORTION TO ITS SIZE: it is the FIRST THING a
// Weird Route player reads, and until now `kaizo/scenes/kaizo-practice.js`
// assigned the vanilla `OPENING_MSG` unconditionally on every version — the
// string existed in this repo only as prose in a markdown file.
//
//     node kaizo/tools/checks/check-opening-msg.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { OPENING_MSG } from '../../../sim/battlemsg.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import { SIDEB_OPENING_MSG } from '../../scenes/kaizo-practice.js';

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

const IDLE = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

/** The line the box holds on the fight's very first frame. */
function opener(version) {
  const s = createState({ seed: 4242, traceBulletSlots: 4 });
  buildKaizoScene(s, { version });
  stepFrame(s, IDLE);
  return s.battlemsg;
}

section('scr_encountersetup:717 — the string itself');
{
  // Verbatim against the dump, character for character. The two markers are
  // the ones a re-typing loses first: `^1` is the one-beat pause and `&` the
  // line break, and neither is decoration — dropping the `^1` runs the two
  // sentences together at full speed.
  assertEq(SIDEB_OPENING_MSG, '* The Roaring Knight appeared^1.&* Something seems wrong.',
    'the k_stringsetloc English string, verbatim');
  assert(SIDEB_OPENING_MSG.includes('^1'), 'the pause marker survived');
  assert(SIDEB_OPENING_MSG.includes('&'), 'the line break survived');
  assert(SIDEB_OPENING_MSG !== OPENING_MSG, 'and it is not the vanilla line');
  assertEq(OPENING_MSG, '* The Roaring Knight appeared.', 'the vanilla line is unchanged');
}

section('the flag[456] arm, live through the turn loop');
{
  // V-D IS THE WEIRD ROUTE: buildKaizoScene stamps `sideb: version === 'D'`,
  // which is this lane's global.flag[456].
  assertEq(opener('D'), SIDEB_OPENING_MSG, 'V-D (B-Side) opens on "Something seems wrong."');

  // And the arm is an ARM: every other version must be untouched, or the
  // A-Side fight has quietly acquired a B-Side line.
  assertEq(opener('C'), OPENING_MSG, 'V-C (Normal Route recreation) keeps the vanilla opener');
  assertEq(opener('A'), OPENING_MSG, 'V-A (the invented schedule) keeps it too');
}

console.log(`\ncheck-opening-msg: ${count - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
