#!/usr/bin/env node
// KAIZO — WHO THE BATTLE TEXT SAYS IS CASTING (`global.charname[...]`).
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// THE REPORT, DRIVEN. On the Weird Route every spell and item line named the
// wrong member: Noelle's Heal Prayer printed "* Susie cast HEAL PRAYER!" and
// her SleepMist "* Susie cast SLEEPMIST!". Read verbatim out of
// `state.battlemsg` — the string the box draws — not inferred.
//
// PROVENANCE
//   gml_GlobalScript_scr_initialize_charnames.gml :5-8
//       global.charname[1..4] = "Kris" / "Susie" / "Ralsei" / "Noelle"
//       (byte-identical in gml_vanilla_v105)
//   gml_GlobalScript_scr_spelltext.gml            :14-68
//       every line is stringsetsubloc(..., global.charname[global.char[caster]])
//       — the SLOT is bridged to a CHARACTER ID before the name is read.
//       The mod's cases 1/2/3/4/5/6/8/9/10/11 are the vanilla strings; its
//       only additions are the Knight's spare line and the k_freeze
//       "* It had no effect...!" suffix (:108-114, :287-293).
//   sim/spellphase.js :242-251  charName — the READER of the hook
//   sim/spellphase.js :279-287  spellText / :289-292 itemText — the two
//       callers that put the name into `state.battlemsg`
//
// WHAT EACH BLOCK PROVES
//   1. the table matches scr_initialize_charnames, and the hook answers
//      `global.charname[global.char[slot]]` for a Kris + Noelle roster
//   2. THE READER IS WIRED — charName(state, 1) comes back "Noelle" through
//      the ENGINE'S accessor, and the same call on a V-C state (no roster,
//      no hooks) still answers "Susie". Deleting the hook read in
//      sim/spellphase.js fails this, not merely a wrong string.
//   3. THE LIVE PATH — a V-D turn driven through the real menu to the real
//      obj_spellphase, asserting `state.battlemsg` itself for Heal Prayer,
//      SleepMist and an item.
//   4. INSTALL COVERAGE — installKaizoMenu really writes hooks.charName, and
//      a state built by buildKaizoScene('D') carries it. hooks.spellText is
//      deliberately NOT installed: with charName answering, the engine's own
//      SPELL_TEXT produces this roster's lines verbatim, and that is
//      asserted here rather than assumed.
//
//     node kaizo/tools/checks/check-castername-kaizo.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { charName, spellText, itemText, SPELL_TEXT } from '../../../sim/spellphase.js';
import { PARTY } from '../../../sim/damage.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import { CHARNAME_BY_CHAR, kaizoCharName, installKaizoMenu } from '../../party/spells.js';
import { installRoster, WEIRD_ROUTE_PARTY } from '../../party/roster.js';

let failures = 0;
let count = 0;
function assert(cond, label) {
  count += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); } else console.log(`  ok   ${label}`);
}
function assertEq(got, want, label) {
  assert(got === want, `${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}
const section = (t) => console.log(`\n== ${t}`);

const IDLE = {
  left: false, right: false, up: false, down: false, confirm: false, cancel: false,
  focus: false, button3: false,
};

function vd(seed = 4242) {
  const s = createState({ seed, traceBulletSlots: 8 });
  buildKaizoScene(s, { version: 'D' });
  return s;
}
function vc(seed = 5) {
  const s = createState({ seed, traceBulletSlots: 8 });
  buildKaizoScene(s, { version: 'C' });
  return s;
}
/** One edge press, then out of the two-frame grid lockout. */
function press(s, key) {
  stepFrame(s, { ...IDLE, [key]: true });
  stepFrame(s, IDLE);
  for (let g = 0; g < 4 && (s.menu?.onebuffer ?? -1) >= 0; g++) stepFrame(s, IDLE);
}

// ── 1. the table, and the hook's own answer ────────────────────────────────
section('scr_initialize_charnames:5-8 — the CHARACTER-indexed name table');
assertEq(CHARNAME_BY_CHAR[1], 'Kris', 'charname[1]');
assertEq(CHARNAME_BY_CHAR[2], 'Susie', 'charname[2]');
assertEq(CHARNAME_BY_CHAR[3], 'Ralsei', 'charname[3]');
assertEq(CHARNAME_BY_CHAR[4], 'Noelle', 'charname[4]');
{
  const s = vd();
  stepFrame(s, IDLE);
  assertEq(kaizoCharName(s, 0), 'Kris', 'slot 0 of [1, 4, 0] is Kris');
  assertEq(kaizoCharName(s, 1), 'Noelle', 'slot 1 of [1, 4, 0] is NOELLE, not Susie');
  assertEq(kaizoCharName(s, 2), undefined,
    'the empty pad slot answers undefined, so the engine `??` falls back');
}

// ── 2. THE READER — sim/spellphase.js's charName consults the hook ─────────
section('sim/spellphase.js:242-251 — the reader that had no writer');
{
  const s = vd();
  stepFrame(s, IDLE);
  // THE POINT OF THIS BLOCK: the value is asked for through the ENGINE, so
  // deleting the `state.kaizo.hooks.charName` lookup in sim/spellphase.js
  // drops it straight back to PARTY[1].name and this goes red. A test that
  // only called kaizoCharName would stay green with the seam severed.
  assertEq(PARTY[1].name, 'SUSIE',
    'the engine fallback for slot 1 really is Susie — the defect had somewhere to come from');
  assertEq(charName(s, 1), 'Noelle', 'charName(state, 1) on V-D — through the hook');
  assertEq(charName(s, 0), 'Kris', 'charName(state, 0) on V-D');
  // The A-Side control: no roster, no hooks, the vanilla answer stands.
  const c = vc();
  stepFrame(c, IDLE);
  assert(!c.kaizo?.hooks?.charName, 'V-C installs no charName hook (the A-Side keeps the slot table)');
  assertEq(charName(c, 1), 'Susie', 'V-C slot 1 is still Susie — the fix is not a blanket rename');
}

// ── 3. the strings themselves ──────────────────────────────────────────────
section('scr_spelltext — the line the box draws');
{
  const s = vd();
  stepFrame(s, IDLE);
  assertEq(spellText(s, 1, 2)[0], '* Noelle cast HEAL PRAYER!', 'Heal Prayer (scr_spelltext case 2)');
  assertEq(spellText(s, 1, 8)[0], '* Noelle cast SLEEPMIST!', 'SleepMist (case 8)');
  assertEq(spellText(s, 1, 9)[0], '* Noelle cast ICESHOCK!', 'IceShock (case 9)');
  assertEq(spellText(s, 1, 10)[0], '* Noelle cast SNOWGRAVE!', 'SnowGrave (case 10)');
  assertEq(itemText(s, 1, 1)[0], '* Noelle used the DARK CANDY!', 'an ITEM names her too (case 201)');
  // hooks.spellText is the other half of the seam and stays uninstalled: the
  // engine's own table already carries the mod's strings, so a hook would be
  // a second copy to keep in step. Pinned so that stops being an assumption.
  assert(!s.kaizo.hooks.spellText, 'hooks.spellText is NOT installed (SPELL_TEXT already matches the mod)');
  assertEq(SPELL_TEXT[8], '* ~1 cast SLEEPMIST!', 'SPELL_TEXT[8] is the mod\'s own string, ~1 unresolved');
}

// ── 4. THE LIVE PATH — state.battlemsg through the real menu and phase ─────
section('LIVE — a V-D turn driven to obj_spellphase, reading state.battlemsg');
{
  const s = vd(4242);
  s.tension = 250;
  stepFrame(s, IDLE);
  assert(s.menu.open && s.menu.charturn === 0, 'menu open on Kris');
  press(s, 'left');                   // DEFEND
  press(s, 'confirm');
  assertEq(s.menu.charturn, 1, "Noelle's turn");
  press(s, 'right');                  // MAGIC
  press(s, 'confirm');
  assertEq(s.menu.submenu, 'magic', 'the MAGIC grid is open');
  // `global.spell[4] = [2, 8, 9]` — Heal Prayer is row 0, no move needed.
  press(s, 'confirm');                // Heal Prayer is spelltarget 1 -> the ally picker
  assertEq(s.menu.submenu, 'target', 'Heal Prayer opens the ALLY picker');
  press(s, 'confirm');                // heal Noelle herself
  assertEq(s.pendingSpell?.[1]?.id, 2, 'Heal Prayer queued on slot 1');

  let msg = null;
  for (let f = 0; f < 240 && !msg; f++) {
    stepFrame(s, IDLE);
    if (typeof s.battlemsg === 'string' && s.battlemsg.includes('HEAL PRAYER')) msg = s.battlemsg;
  }
  assertEq(msg, '* Noelle cast HEAL PRAYER!',
    'THE BOX SAYS NOELLE — driven out of state.battlemsg, where it said Susie');
}
{
  // The second reported line, on its own turn: SleepMist (spelltarget 0, so
  // it resolves straight off the grid with no picker).
  const s = vd(777);
  s.tension = 250;
  stepFrame(s, IDLE);
  press(s, 'left');
  press(s, 'confirm');
  press(s, 'right');                  // MAGIC
  press(s, 'confirm');
  press(s, 'right');                  // row 0, column 1: SleepMist
  press(s, 'confirm');
  assertEq(s.pendingSpell?.[1]?.id, 8, 'SleepMist queued on slot 1');
  let msg = null;
  for (let f = 0; f < 240 && !msg; f++) {
    stepFrame(s, IDLE);
    if (typeof s.battlemsg === 'string' && s.battlemsg.includes('SLEEPMIST')) msg = s.battlemsg;
  }
  assertEq(msg, '* Noelle cast SLEEPMIST!', 'THE BOX SAYS NOELLE for SleepMist too');
}

// ── 5. the install ─────────────────────────────────────────────────────────
section('installKaizoMenu writes the hook, and the live scene carries it');
{
  const s = createState({ seed: 9, traceBulletSlots: 8 });
  installRoster(s, { charIds: WEIRD_ROUTE_PARTY, sideb: true });
  const hooks = installKaizoMenu(s);
  assertEq(typeof hooks.charName, 'function', 'installKaizoMenu installs hooks.charName');
  assertEq(hooks.charName(s, 1), 'Noelle', '...and it answers for Noelle');
  // `??=`, so a check that wrapped the hook to prove it fired is not replaced.
  const sentinel = () => 'SENTINEL';
  s.kaizo.hooks.charName = sentinel;
  installKaizoMenu(s);
  assert(s.kaizo.hooks.charName === sentinel, 'a second install does not overwrite an existing hook');

  const live = vd(31337);
  stepFrame(live, IDLE);
  assertEq(typeof live.kaizo?.hooks?.charName, 'function',
    'buildKaizoScene(version D) reaches the install — the hook is live content');
}

console.log(`\ncheck-castername-kaizo: ${count - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
