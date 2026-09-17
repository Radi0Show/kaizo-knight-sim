#!/usr/bin/env node
// THE ITEM POSE, AND WHO IS ENTITLED TO IT.
//
// `faceaction` is what a character is ABOUT to do, and it does nothing until
// state 0 reads it (CLAUDE.md, "the party animate off obj_heroparent"). So
// choosing ITEM is a POSE held through everyone else's turn — and the ONE
// line that ends it is heroes.js:199, `if (spec.spellframes > 0) h.faceaction
// = FACE_IDLE`, which runs only on the way OUT of state 2/4. A character who
// never enters state 4 never leaves the pose.
//
// obj_battlecontroller's Step splits items in two, and the pose belongs to
// exactly one half:
//
//     if (_tensionhealed) { ...healanim, snd_cardrive...
//                           scr_itemshift_temp(...); scr_nexthero(); }
//     if (!_tensionhealed) { scr_itemconsumeb(); }
//
//     scr_itemconsumeb:  global.faceaction[global.charturn] = 3;
//                        global.charaction[global.charturn] = 4;
//
// Neither write appears anywhere in the TP branch. The sim used to make both
// of them before the branch, so a TP item posed a character it then queued
// nothing for — `charactionOf` reads the QUEUES, so obj_spellphase's alarm0
// never counted them, `spelltimer` was never armed, and the clearing line
// never ran. The character stood in `itemready` for the rest of the turn.
//
// Reported from play: "when using the TensionMax [they] will keep having the
// Sprite 1 or getting ready to take out an item. this works for any
// non-healing/TP-increasing item for anyone in the party."
//
// BOTH DIRECTIONS ARE ASSERTED, because they look alike and only one is a
// bug: a TP item must NOT pose, and every other item MUST — deleting the pose
// outright would fix the report and break the animation the report is about.

import { createState } from '../sim/index.js';
import { stepMenu, openMenu, createMenu } from '../sim/menu.js';
import { ITEMS, freshInventory } from '../sim/items.js';
import {
  charactionOf, needsSpellphase, createSpellphase, stepSpellphase,
} from '../sim/spellphase.js';
import { FACE_IDLE, FACE_ITEM, stepHeroes } from '../sim/heroes.js';

const failures = [];
const NONE = { left: false, right: false, up: false, down: false, confirm: false, cancel: false };

/** One EDGE press, then enough released frames to drain `menu.onebuffer`. */
function confirm(st) {
  stepMenu(st, NONE);
  stepMenu(st, { ...NONE, confirm: true });
  for (let i = 0; i < 4; i++) stepMenu(st, NONE);
}

/** A menu standing on its own, with `id` under the acting character's cursor. */
function use(st, c, id) {
  st.menu.charturn = c;
  st.menu.tempitem[c][0] = id;
  st.menu.submenu = 'item';
  st.menu.gridIndex = 0;
  confirm(st);
}

function fresh() {
  const st = createState({ seed: 1 });
  st.menu = createMenu();
  st.inventory = freshInventory();
  openMenu(st);
  return st;
}

// ── 1. the three TP items pose nobody, and the rest do ──────────────────────
//
// 27/28/29 are the whole of `kind: 'tension'`; the other two are the two
// shapes that reach recordItem without the ally picker (`target` 'all').
const CASES = [
  [29, true], [28, true], [27, true],     // TensionMax / Gem / Bit
  [7, false], [30, false],                // Spincake, ReviveDust
];

for (const [id, isTension] of CASES) {
  const st = fresh();
  use(st, 0, id);
  const name = ITEMS[id].name;
  const face = st.heroes[0].faceaction;

  if (isTension) {
    if (face !== FACE_IDLE) {
      failures.push(`${name} left faceaction ${face}, expected FACE_IDLE ${FACE_IDLE} — the TP branch makes neither pose write`);
    }
    if (charactionOf(st, 0) !== 0) {
      failures.push(`${name} queued an action; the TP branch calls scr_nexthero, not scr_itemconsumeb`);
    }
  } else {
    // THE POSITIVE HALF. Without this, deleting setFace passes the suite.
    if (face !== FACE_ITEM) {
      failures.push(`${name} left faceaction ${face}, expected FACE_ITEM ${FACE_ITEM} — scr_itemconsumeb:3 poses every deferred item`);
    }
    if (charactionOf(st, 0) !== 4) {
      failures.push(`${name} did not queue — scr_itemconsumeb sets charaction 4`);
    }
  }
}

// ── 2. nobody is stranded in the pose over a whole resolve phase ────────────
//
// Kris takes TensionMax and Susie takes Spincake, so the spellphase genuinely
// runs: the bug survived a running spellphase, because alarm0 counts
// `charactionOf`, which a TP item leaves at 0.
{
  const st = fresh();
  use(st, 0, 29);
  use(st, 1, 7);

  if (!needsSpellphase(st)) failures.push('the mixed turn produced no spellphase — the scenario cannot see the bug');

  const sp = createSpellphase(st);
  const e = { alarm: [] };
  let krisPosedFrames = 0;
  let susiePosed = false;
  for (let f = 0; f < 200; f++) {
    stepSpellphase(st, sp, e);
    stepHeroes(st);
    if (st.heroes[0].faceaction === FACE_ITEM) krisPosedFrames++;
    if (st.heroes[1].faceaction === FACE_ITEM) susiePosed = true;
  }

  if (krisPosedFrames > 0) {
    failures.push(`the TP user held itemready for ${krisPosedFrames} of 200 frames — nothing ever clears it, because alarm0 never counted them`);
  }
  if (!susiePosed && st.heroes[1].faceaction !== FACE_IDLE) {
    failures.push('the deferred item neither posed nor returned to idle — the resolve path is broken, not just the TP one');
  }
  if (st.heroes[1].faceaction !== FACE_IDLE) {
    failures.push(`the deferred item's user ended on faceaction ${st.heroes[1].faceaction}, expected FACE_IDLE — heroes.js:199 must run on the way out of state 4`);
  }
}

console.log('checked: ' + CASES.map(([i]) => ITEMS[i].name).join(', '));

if (failures.length) {
  console.log('');
  for (const f of failures) console.log(`→ FAILURE  ${f}`);
  process.exit(1);
}
console.log('\nPASS  the item pose (no oracle — read from obj_battlecontroller Step_0)');
