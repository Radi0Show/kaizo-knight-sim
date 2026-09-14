#!/usr/bin/env node
// THE CONTROLS PAGE, ON THE KAIZO BUILD — persistence first, then the page.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
//     node kaizo/tools/checks/check-controls-page.mjs
//
// WHY THIS CHECK EXISTS AT ALL, given that the page itself lives in the
// vendored engine and has its own suite over in knight-sim
// (tools/verify-titlemenu.mjs): because THIS repo owns half of the feature.
// `web/kaizo.js` has its OWN settings key — the two pages share an origin in
// production, so `kaizoknight.settings` and `knightsim.settings` are separate
// entries by design — and a setting added to one driver and forgotten in the
// other is a setting that silently vanishes when the player crosses between
// DEVICE_KNIGHT and DEVICE_KAIZO. Nothing in either repo's suites could see
// that: the menu model is shared, and each driver's storage code is DOM-bound
// and untested by construction.
//
// So the first block below does not grep for field names. It EXTRACTS the two
// storage blocks out of `web/kaizo.js` and RUNS them — the real load block
// against a synthetic entry, the real persist literal against a synthetic
// title — so what is asserted is what the shipped driver does with a stored
// object, not what its source happens to mention.
//
// THE SECOND BLOCK is the page itself, driven through the VENDORED engine. It
// is PENDING, loudly, on a snapshot taken before the page existed: this repo
// never hand-edits `sim/`, so the page arrives here with the next
// `npm run vendor:engine` and the block starts enforcing itself on that copy.
// The skip prints the measured reason (the export is absent) rather than
// disappearing, which is the same shape verify-all.mjs uses for the suites
// that need the research repo.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..', '..');

let checks = 0;
let failures = 0;
const assert = (cond, what) => {
  checks += 1;
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failures += 1;
};

// ── the driver's settings entry, executed ────────────────────────────────────
//
// Both blocks are cut out by their own landmarks and compiled with `Function`,
// so a rename or a deletion in `web/kaizo.js` fails HERE rather than going
// unnoticed — an extraction that silently found nothing would be the same
// hazard this check was written to close, so each cut is asserted non-empty
// before it is used.
{
  const src = readFileSync(join(REPO, 'web', 'kaizo.js'), 'utf8');

  const cut = (open, close, label) => {
    const a = src.indexOf(open);
    if (a < 0) return null;
    const b = src.indexOf(close, a + open.length);
    if (b < 0) return null;
    assert(b - a > 200, `${label}: the extracted block is a real block`);
    return src.slice(a + open.length, b);
  };

  const loadSrc = cut('const saved = JSON.parse(', '} catch', 'load');
  const saveSrc = cut('localStorage.setItem(KAIZO_SETTINGS_KEY, JSON.stringify({',
    '}));', 'save');
  assert(loadSrc !== null, 'web/kaizo.js still has the settings LOAD block');
  assert(saveSrc !== null, 'web/kaizo.js still has the settings SAVE literal');

  if (loadSrc !== null && saveSrc !== null) {
    // The load block's first statement is the tail of the `JSON.parse(` call
    // the landmark cut through, so it is re-opened here rather than re-typed.
    const runLoad = new Function('title', 'store', 'KAIZO_SETTINGS_KEY', 'SETTINGS_KEY', `
      let kaizoPracticeSaved = 0;
      const localStorage = store;
      const saved = JSON.parse(${loadSrc}
      return { title, kaizoPracticeSaved };
    `);
    const runSave = new Function('title', 'weirdRoute', 'kaizoPractice',
      `return {${saveSrc}};`);

    const KEY = 'kaizoknight.settings';
    const OTHER = 'knightsim.settings';
    const store = (entry) => ({ getItem: (k) => (k === KEY ? entry : null) });
    const fresh = () => ({
      gear: [], bag: [], volumes: { music: 50, sfx: 50 },
      shake: true, scaling: 'fit', swapZX: false, holdBreath: false, bindings: null,
    });

    // LOAD — the three CONTROLS-page fields come back off the entry.
    {
      const t = fresh();
      runLoad(t, store(JSON.stringify({
        v: 1, swapZX: true, holdBreath: true, bindings: { keyboard: { left: 'KeyA' } },
      })), KEY, OTHER);
      assert(t.swapZX === true, 'the kaizo driver loads the TOUCH BUTTONS swap');
      assert(t.holdBreath === true, 'the kaizo driver loads HOLDBREATH');
      assert(t.bindingsSaved?.keyboard?.left === 'KeyA',
        'the kaizo driver carries the binding blob through, contents untouched');
    }
    // …and an entry written before any of this existed is still the defaults,
    // which is the only thing that keeps an old player's page from changing
    // under them.
    {
      const t = fresh();
      runLoad(t, store(JSON.stringify({ v: 1, shake: false })), KEY, OTHER);
      assert(t.holdBreath === false, 'an entry with no holdBreath field stays OFF');
      assert(t.swapZX === false, '…and no swapZX field stays Z / X');
      assert(t.bindingsSaved === undefined, '…and no bindings field arms nothing');
    }
    // A HOSTILE ENTRY IS DROPPED, not handed on: the input layer is allowed to
    // assume the blob is an object, because this is where that is decided.
    {
      const t = fresh();
      runLoad(t, store(JSON.stringify({ v: 1, holdBreath: 'yes', bindings: 'nope' })),
        KEY, OTHER);
      assert(t.holdBreath === false, 'a non-boolean holdBreath is refused');
      assert(t.bindingsSaved === undefined, 'a non-object bindings blob is refused');
    }

    // SAVE — the same three fields go back out.
    {
      const t = { ...fresh(), swapZX: true, holdBreath: true,
        bindings: { custom: { keyboard: { left: 'KeyA' } } } };
      const entry = runSave(t, false, 0);
      assert(entry.swapZX === true, 'the kaizo driver saves the touch swap');
      assert(entry.holdBreath === true, 'the kaizo driver saves HOLDBREATH');
      assert(entry.bindings?.keyboard?.left === 'KeyA',
        'and saves the input layer\'s own blob, verbatim');
    }
    // A build that never armed bindings writes NO bindings key at all, rather
    // than a null the loader would have to special-case.
    {
      const entry = runSave(fresh(), false, 0);
      assert(entry.holdBreath === false, 'an untouched build saves holdBreath: false');
      assert(!('bindings' in entry) || entry.bindings === undefined,
        'an unarmed build writes no bindings key');
    }

    // ROUND TRIP, the thing the player actually experiences: save, reload,
    // same page.
    {
      const before = { ...fresh(), swapZX: true, holdBreath: true };
      const after = fresh();
      runLoad(after, store(JSON.stringify(runSave(before, false, 0))), KEY, OTHER);
      assert(after.swapZX === true && after.holdBreath === true,
        'a CONTROLS setting survives a save and a reload of the kaizo page');
    }
  }
}

// ── the page itself, on whatever engine snapshot is vendored here ───────────
{
  const modes = await import('../../../sim/modes.js');
  if (typeof modes.controlRows !== 'function') {
    console.log('  --  PENDING: the vendored sim/modes.js has no `controlRows` export,'
      + ' so this engine snapshot predates the CONTROLS page.'
      + ' Re-vendor (npm run vendor:engine) to enforce the block below.');
  } else {
    const { createTitle, stepTitle, SETTINGS_PAGES, controlRows, MODES, TITLE_EXTRAS } = modes;
    const NONE = {
      up: false, down: false, left: false, right: false, confirm: false, cancel: false,
    };
    const tap = (t, key) => {
      stepTitle(t, { ...NONE, [key]: true }, []);
      stepTitle(t, { ...NONE }, []);
    };

    const pages = SETTINGS_PAGES.map((p) => p.id);
    assert(pages.includes('controls'), 'the vendored engine has a CONTROLS page');
    assert(pages.indexOf('controls') < pages.indexOf('share'),
      'CONTROLS sits above the two odd rows');

    const t = createTitle();
    assert(t.holdBreath === false, 'HOLDBREATH ships OFF on this build too');
    const rows = controlRows(t);
    assert(rows[0]?.id === 'touch',
      'TOUCH BUTTONS is the first CONTROLS row (it moved off GRAPHICS)');
    assert(rows.some((r) => r.id === 'holdbreath'), 'and the HOLDBREATH row is there');

    // DRIVEN, NOT INSPECTED: walk the title to SETTINGS the way a player does,
    // open CONTROLS, and move the two flags. The row index is resolved through
    // the lists rather than typed, so a new title row shifts nothing here.
    const settingsRow = MODES.length + TITLE_EXTRAS.findIndex((x) => x.id === 'settings');
    const page = SETTINGS_PAGES.findIndex((p) => p.id === 'controls');
    for (let n = 0; n < settingsRow; n++) tap(t, 'down');
    tap(t, 'confirm');
    assert(t.settings !== null, 'SETTINGS opens on the kaizo build');
    if (t.settings) {
      for (let n = 0; n < page; n++) tap(t, 'down');
      tap(t, 'confirm');
      assert(t.settings.page === 'controls', 'and CONTROLS opens from the hub');
      tap(t, 'right');
      assert(t.swapZX === true, 'the first row swaps the touch buttons here too');
      tap(t, 'down');
      tap(t, 'right');
      assert(t.holdBreath === true, 'and the second row switches HOLDBREATH on');
    }
  }
}

console.log(
  failures === 0
    ? `\nOK — ${checks} assertions, all green`
    : `\n${failures} of ${checks} assertions FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
