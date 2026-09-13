#!/usr/bin/env node
// THE KAIZO BUILD CREDITS ENDERCAT8, AND THE VANILLA BUILD DOES NOT.
//
// This build is a recreation of EnderCat8's "Kaizo Roaring Knight". The
// vanilla Roaring Knight simulator is a recreation of nothing of theirs, so a
// row naming them there would be wrong in the other direction — which is why
// the list is a per-build field (`title.credits`, read back through
// `titleCredits`) rather than a row added to the shared constant.
//
// WHAT THIS GUARDS, and why each one is here rather than assumed:
//
//   A  the row exists, says who they are, and points at the mod.
//   B  it sits directly under WandeR's row, above SUPPORT.
//   C  the VANILLA list is untouched — asserted by IDENTITY, not by length,
//      because a copy that happens to be equal today is the thing that drifts.
//   D  THE CURSOR REACHES IT. `stepSettings` used to wrap on `CREDITS.length`
//      while the draw walked the installed list; a longer list would then have
//      left its last row unreachable. That defect looks like nothing and is
//      only ever found by someone pressing down twice, so it gets a driven
//      assertion rather than a comment.
//   E  the page actually installs the list — a reader with no writer is how
//      `hooks.charName` printed "Susie" for Noelle for months.

import { createTitle, stepTitle, titleCredits, creditLink, CREDITS } from '../../../sim/modes.js';
import { KAIZO_CREDITS, ENDERCAT_ROW } from '../../ui/credits.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let failed = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!cond) failed += 1;
};
const eq = (got, want, msg) => ok(Object.is(got, want), `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const NONE = { up: false, down: false, left: false, right: false, confirm: false, cancel: false };
const tap = (t, key) => { const r = stepTitle(t, { ...NONE, [key]: true }, []); stepTitle(t, { ...NONE }, []); return r; };

console.log('\nA — ENDERCAT8 is credited, and the link is the mod');
{
  const row = KAIZO_CREDITS.find((r) => r.who === 'ENDERCAT');
  ok(!!row, 'the kaizo list has an ENDERCAT row');
  eq(row?.role, 'Creator of the original mod', 'A ...described as the original mod\'s creator');
  eq(creditLink(row ?? {}), 'https://gamebanana.com/mods/662826', 'A ...linking to the mod page');
  eq(ENDERCAT_ROW.link.startsWith('http'), false,
    'A the stored link carries NO scheme — creditLink adds it, and a scheme on screen is noise');
}

console.log('\nB — it sits under WandeR, above SUPPORT');
{
  const iW = KAIZO_CREDITS.findIndex((r) => r.who === 'WandeR');
  const iE = KAIZO_CREDITS.findIndex((r) => r.who === 'ENDERCAT');
  ok(iW >= 0 && iE === iW + 1, `B directly under WandeR (WandeR ${iW}, ENDERCAT ${iE})`);
  ok(!KAIZO_CREDITS[KAIZO_CREDITS.length - 1].who,
    'B ...and SUPPORT is still the last row (the one that is not a person)');
}

console.log('\nC — the vanilla list is untouched, by identity');
{
  ok(titleCredits(undefined) === CREDITS, 'C no title installed -> the vanilla constant ITSELF');
  ok(titleCredits({}) === CREDITS, 'C ...and a title that installed nothing gets it too');
  eq(CREDITS.length, 3, 'C the vanilla list is still three rows');
  ok(!CREDITS.some((r) => r.who === 'ENDERCAT'),
    'C ...and does not name ENDERCAT — the vanilla page recreates nothing of theirs');
  ok(KAIZO_CREDITS !== CREDITS, 'C the kaizo list is a separate array, not a mutation of it');
}

console.log('\nD — the cursor reaches every row it draws');
{
  const t = createTitle();
  t.credits = KAIZO_CREDITS;
  t.settings = { page: 'credits', cursor: 0 };
  const seen = [t.settings.cursor];
  for (let i = 0; i < KAIZO_CREDITS.length; i++) { tap(t, 'down'); seen.push(t.settings.cursor); }
  const reached = new Set(seen);
  for (let i = 0; i < KAIZO_CREDITS.length; i++) {
    ok(reached.has(i), `D row ${i} (${KAIZO_CREDITS[i].who || KAIZO_CREDITS[i].role}) is reachable`);
  }
  eq(seen[seen.length - 1], 0, 'D ...and DOWN off the end wraps to the top, not past it');

  // The control: the vanilla title still wraps on THREE, so the accessor is
  // reading the installed list rather than a constant that happens to be long.
  const v = createTitle();
  v.settings = { page: 'credits', cursor: 0 };
  const seenV = [v.settings.cursor];
  for (let i = 0; i < 3; i++) { tap(v, 'down'); seenV.push(v.settings.cursor); }
  eq(seenV[seenV.length - 1], 0, 'D vanilla still wraps at three');
  ok(!seenV.includes(3), 'D ...and never reaches a fourth row it does not have');
}

console.log('\nE — the page installs it (the writer, not just the reader)');
{
  const src = readFileSync(join(repo, 'web', 'kaizo.js'), 'utf8');
  // LIVE LINES ONLY. The first version of this block tested the raw source,
  // and commenting the assignment out left it GREEN — the regex matched the
  // comment. A source scan that cannot tell code from a note about code is
  // the same defect this whole check exists to catch, so the comments go
  // first and the assertions run on what actually executes.
  const live = src
    .split(String.fromCharCode(10))
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join(String.fromCharCode(10));
  ok(/^\s*title\.credits\s*=\s*KAIZO_CREDITS\s*;/m.test(live),
    'E web/kaizo.js assigns title.credits (in live code, not in a comment)');
  ok(/import \{ KAIZO_CREDITS \} from '\.\.\/kaizo\/ui\/credits\.js'/.test(live),
    'E ...from kaizo/ui/credits.js');
  ok(/creditLink\(titleCredits\(title\)\[s\.cursor\]/.test(live),
    'E ...and the link the driver opens comes from the SAME list the draw uses');
  ok(!/creditLink\(CREDITS\[/.test(live),
    'E ...with no read of the bare constant left behind');
}

console.log(`\ncheck-credits: ${failed === 0 ? 'all assertions passed' : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
