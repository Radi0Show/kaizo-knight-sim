#!/usr/bin/env node
// THE UNUSED OPTION IS THE DOOR TO THE WEIRD ROUTE — end to end.
//
//   node kaizo/tools/checks/check-proceed-route.mjs
//
// ── WHAT THIS PROVES, AND WHY EACH HALF NEEDS PROVING ─────────────────────
//
// The feature spans three files that cannot see each other: the engine seam
// COUNTS presses (sim/modes.js) and DRAWS the result (render/title.js) and
// knows nothing about kaizo; kaizo/ui/proceed.js knows what the door opens
// onto; web/kaizo.js is the only thing that touches both. Each half can be
// perfectly correct on its own while the feature does nothing — which is this
// repo's signature defect, a value computed correctly and written where
// NOTHING READS IT, now at six occurrences. So every assertion here is about
// something ARRIVING somewhere, not about a field holding a value.
//
//   1. The row is INERT until armed, and the default page never arms it.
//   2. Armed, it REDDENS over twenty presses, SHATTERS on the last one, and
//      hands `out.proceed` out through `stepTitle` when the last fragment is
//      gone — the whitelist that has swallowed an intent before.
//   3. The destination exists and is the Weird Route: two members, Kris and
//      Noelle, Susie and Ralsei gone, `sideb` true.
//   4. THE EQUIP SCREEN'S CHOICES REACH THE FIGHT. `title.gear` -> the
//      character-indexed override -> `installRoster` -> `gearOfChar`. Without
//      this wire the menu is a decoration, and a decoration is exactly what a
//      green suite cannot tell from a feature.
//   5. The persistence round trip, including a hostile entry.
//   6. THE DRIVER ACTUALLY CALLS ALL OF IT. web/kaizo.js cannot be imported
//      headlessly (it builds a renderer against the DOM on its first lines),
//      so the wire is asserted against its SOURCE. A source assertion is weak
//      evidence for behaviour and strong evidence for absence: it cannot say
//      the call works, but it does say the call is still there, which is the
//      failure mode that has actually happened here.
//   7. A share link from the Weird Route carries no loadout.
//   8. THE SHATTER SHEET IS REAL, and the drawer that paints it paints the
//      ROAR FINALE's pieces too — ledger G-38, which is severity 4 precisely
//      because a drawer nothing calls and a mechanism nothing draws are the
//      same defect from two directions.
//
// ── PROVENANCE ────────────────────────────────────────────────────────────
//
// PROCEED is EnderCat8's word, from the mod's B-Side game-over screen
// (`gml_Object_DEVICE_FAILURE_Step_0.gml:384-385`, both slots
// "PROCEED#(PROCEED)"; `:430-437`, neither answer leaves). The break's shape
// is DELTARUNE chapter 4's own prophecy shatter
// (`gml_Object_obj_intro_ch4_Step_0.gml:164-196`) and its red and its glass are
// the mod's screen shatter (`gml_GlobalScript_scr_lerpvar.gml:28-100`). The
// press count and the reddening ramp are this project's. kaizo/ui/proceed.js's
// header is the full ledger.
//
// SABOTAGE-TESTED, both exit codes in the lane report.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createState } from '../../../sim/index.js';
import {
  createTitle, stepTitle, SETTINGS_PAGES, TITLE_EXTRAS, MODES,
  armUnused, unusedRowStyle, UNUSED_PRESSES, UNUSED_SHATTER, UNUSED_RED,
  partyTabs,
} from '../../../sim/modes.js';
import { mergeColor } from '../../../sim/gml.js';
import { buildKaizoScene, KAIZO_VERSIONS } from '../../scenes/kaizo-fight.js';
import {
  loadProceed, saveProceed, weirdRouteTabs, weirdRouteGear,
  gearOverrideFromTabs, padLoadout, PROCEED_KEY, PROCEED_VERSION,
  PROCEED_SHATTER_SPRITE,
} from '../../ui/proceed.js';
import { gearOfChar, charIdOf, CHAR_KRIS, CHAR_NOELLE, CHAR_NONE } from '../../party/roster.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

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

const NONE_IN = {
  up: false, down: false, left: false, right: false, confirm: false, cancel: false,
};
/** One EDGE press — the menu is edge-triggered, so it needs a released frame. */
function tap(t, key) {
  const r = stepTitle(t, { ...NONE_IN, [key]: true }, []);
  stepTitle(t, { ...NONE_IN }, []);
  return r;
}
/** ONE frame with nothing held. `tap` is two frames, so it cannot step an
 *  animation a frame at a time. */
function idle(t) { return stepTitle(t, { ...NONE_IN }, []); }
/** Run the whole break out, from a row that has just been pressed for the
 *  twentieth time, and return the frame count. */
function runShatter(t, cap = 400) {
  let frames = 0;
  while (t.unused.shatter && frames < cap) { idle(t); frames += 1; }
  return frames;
}
/** A title parked on the settings hub with the cursor on UNUSED. */
function atUnusedRow() {
  const t = createTitle();
  const row = MODES.length + TITLE_EXTRAS.findIndex((x) => x.id === 'settings');
  for (let i = 0; i < row; i++) tap(t, 'down');
  tap(t, 'confirm');
  const page = SETTINGS_PAGES.findIndex((p) => p.id === 'unused');
  for (let i = 0; i < page; i++) tap(t, 'down');
  return t;
}

// ── 1. THE DEFAULT PAGE IS UNCHANGED ──────────────────────────────────────
section('a page that never arms the row sees the row it always saw');
{
  const t = atUnusedRow();
  const r = tap(t, 'confirm');
  assertEq(r.error, true, 'unarmed: confirming UNUSED still sounds the error');
  assertEq(r.proceed, false, 'unarmed: no proceed intent leaves stepTitle');
  assertEq(r.press, 0, 'unarmed: no press is counted');
  assertEq(r.shatter, false, 'unarmed: nothing shatters');
  assertEq(t.unused, null, 'unarmed: pressing it creates no state');
  assertEq(unusedRowStyle(t).name, 'UNUSED', 'unarmed: the row still reads UNUSED');
  assertEq(unusedRowStyle(t).dim, true, '...and is still dimmed');
  assertEq(unusedRowStyle(t).heat, 0, '...at zero heat, which IS the old grey');
  assertEq(createTitle().party, null, 'and the equip page still shows the vanilla three');
  assertEq(partyTabs(createTitle()).length, 3, '...three tabs');
}

// ── 2. THE PRESS SEQUENCE, THROUGH stepTitle ──────────────────────────────
section('armed: reddens, shatters, then PROCEEDs — and the intent gets OUT');
{
  const t = atUnusedRow();
  armUnused(t, { sprite: PROCEED_SHATTER_SPRITE });
  let last = -1;
  for (let i = 1; i < UNUSED_PRESSES; i++) {
    const r = tap(t, 'confirm');
    assertEq(r.press, i, `press ${i} reports its own count through stepTitle`);
    assertEq(r.proceed, false, `press ${i} is not the door`);
    assertEq(r.shatter, false, `press ${i} does not break it`);
    const heat = unusedRowStyle(t).heat;
    assert(heat > last, `press ${i} is strictly redder than the one before it`);
    last = heat;
  }
  assertEq(unusedRowStyle(t).name, 'UNUSED', 'nineteen presses and it is still UNUSED');

  // THE BREAK. Read on the PRESS frame — `tap`'s release frame is already the
  // animation's first frame.
  const r20 = stepTitle(t, { ...NONE_IN, confirm: true }, []);
  assertEq(r20.press, UNUSED_PRESSES, 'the twentieth press reports twenty');
  assertEq(r20.shatter, true, '...and breaks the row');
  assertEq(r20.selected, true, '...as a SELECTION, the one press the row accepts');
  assertEq(r20.proceed, false, '...but the break is not the door yet');
  assertEq(t.unused.shatter.frags.length, UNUSED_SHATTER.fragments,
    'one fragment per sub-image of spr_roaringknight_finalshatter');
  assert(t.unused.shatter.frags.every((f) => f.dx === 0 && f.dy === 0),
    'and every one is born AT THE SPOT THE ROW WAS AT — the ch4 shape');

  // The hold, then the flight, then the door.
  //
  // `shatter` IS COUNTED ACROSS THE WHOLE RUN, because the driver plays a
  // sound on it: reported once per frame of the fall it would play the break
  // seventy-odd times, which is what happened the first time the status and
  // the cue shared a field.
  let shatterFrames = r20.shatter ? 1 : 0;
  let proceededOn = -1;
  let frames = 0;
  while (t.unused.shatter && frames < 400) {
    frames += 1;
    const rr = idle(t);
    if (rr.shatter) shatterFrames += 1;
    if (rr.proceed) proceededOn = frames;
    if (frames < UNUSED_SHATTER.delay) {
      assert(t.unused.shatter?.frags.every((f) => f.dx === 0 && f.dy === 0),
        `hold frame ${frames}: the picture is still intact`);
    }
  }
  assertEq(shatterFrames, 1,
    'out.shatter is raised on EXACTLY ONE frame across the whole break — it is '
    + 'the sound cue, and the driver plays snd_glassbreak on it');
  assert(proceededOn > 0, `proceed reaches the DRIVER when the glass is gone (frame ${proceededOn})`);
  assert(proceededOn <= UNUSED_SHATTER.doom,
    `...inside scr_doom's ${UNUSED_SHATTER.doom} frames, so the title cannot hang`);
  assertEq(t.unused.taken, true, '...and the state says it was taken');
  assertEq(t.settings, null, '...and the SETTINGS SCREEN IS CLOSED — back to the title');
  assertEq(unusedRowStyle(t).name, 'PROCEED', 'the row now reads the mod\'s own word');
  assertEq(unusedRowStyle(t).sub, null, 'a settings row carries no bracketed echo');
  // ONE WAY, ONE SIGNAL.
  let again = 0;
  for (let i = 0; i < 30; i++) if (idle(t).proceed) again += 1;
  assertEq(again, 0, 'proceed fires on exactly one frame, never again');
  assertEq(t.unused.taken, true, 'nothing un-takes it');
}

// ── 2b. THE RAMP AND THE GLASS ARE THE SAME RED ───────────────────────────
//
// The user asked for the target colour to come from the shatter's own
// expression so the two agree BY CONSTRUCTION. That is only true if nobody
// later types a second constant, which is exactly what an assertion is for.
section('the ramp\'s target IS merge_color(c_white, c_red, 0.6)');
{
  // `scr_lerpvar.gml:57-67` — the mod's final-hit shatter blend, front face.
  const fromTheMod = mergeColor([255, 255, 255], [255, 0, 0], 0.6);
  assertEq(UNUSED_RED.join(), fromTheMod.join(),
    'UNUSED_RED is the mod\'s own expression, evaluated (255,102,102)');
  const t = atUnusedRow();
  armUnused(t, { sprite: PROCEED_SHATTER_SPRITE });
  assertEq(unusedRowStyle(t).red.join(), fromTheMod.join(),
    '...and it is what the renderer is handed, so the ramp cannot drift from the glass');
  // AND THE RAMP REALLY REACHES IT. render/title.js mixes DIM -> red by heat.
  const DIM = [128, 128, 138];
  assertEq(mergeColor(DIM, UNUSED_RED, 0).join(), DIM.join(),
    'heat 0 is exactly the old dim grey — the unarmed row is unmoved');
  assertEq(mergeColor(DIM, UNUSED_RED, 1).join(), UNUSED_RED.join(),
    'heat 1 is exactly the shatter\'s red');
}

// ── 3. THE DESTINATION IS THE WEIRD ROUTE ─────────────────────────────────
section('PROCEED_VERSION is the B-Side, and the tabs are its party');
{
  assertEq(PROCEED_VERSION, 'D', 'the door opens on KAIZO_VERSIONS.D');
  assert(!!KAIZO_VERSIONS[PROCEED_VERSION], '...which exists in the registry');
  const tabs = weirdRouteTabs();
  assertEq(tabs.length, 2, 'two members');
  assertEq(tabs.map((x) => x.name).join(), 'KRIS,NOELLE', 'Kris and Noelle');
  assertEq(tabs.map((x) => x.char).join(), '0,3',
    'tab 1 is CHAR FLAG 3 (Noelle) and not 1 (Susie) — the whole reason the '
    + 'equip page had to separate position from flag');
  assertEq(tabs[1].base.magic, 13, 'the preview reads Noelle\'s magic 13');
  assertEq(tabs[1].base.maxhp, 120, '...and her 120 HP');
  assertEq(tabs[1].head, 'spr_headnoelle', '...and her own portrait');
  assert(!tabs.some((x) => x.name === 'SUSIE' || x.name === 'RALSEI'),
    'and the characters who are not on this route are GONE');

  const st = createState({ seed: 99, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: PROCEED_VERSION });
  assertEq(st.kaizo.sideb, true, 'the built scene is the B-Side');
  assertEq(st.kaizo.roster.map((m) => m.charId).join(), '1,4', '...with the same two members');
  assertEq(charIdOf(st, 2), CHAR_NONE, '...and slot 2 is nobody');
}

// ── 4. THE EQUIP SCREEN'S CHOICES REACH THE FIGHT ─────────────────────────
//
// The one that matters. A chosen weapon has to come out of `gearOfChar` on
// the built state, or the menu edits an array nothing reads.
section('title.gear -> the override -> installRoster -> gearOfChar');
{
  const tabs = weirdRouteTabs();
  const def = weirdRouteGear();
  assertEq(def.length, 2, 'the opening loadout has one entry per tab');
  assertEq(def[1].weapon, 13, 'Noelle opens on the ThornRing — the mod\'s B-Side default');

  // CONTROL: with no override, the roster's own defaults are what the fight
  // sees. Without this the assertion below could pass by coincidence.
  const control = createState({ seed: 99, traceBulletSlots: 0 });
  buildKaizoScene(control, { version: PROCEED_VERSION });
  assertEq(gearOfChar(control, CHAR_NOELLE).weapon, 13,
    'CONTROL: no override, Noelle carries the roster default');

  // Now change it in the MENU's own array and drive it through.
  const edited = def.map((g) => ({ weapon: g.weapon, armor: [...g.armor] }));
  edited[1].weapon = 12;        // SnowRing — the other Noelle-only weapon
  edited[1].armor = [15, 24];   // TensionBow + LodeStone
  edited[0].weapon = 23;        // Saber10 on Kris
  const override = gearOverrideFromTabs(tabs, edited);
  assertEq(Object.keys(override).sort().join(), '1,4',
    'the override is CHARACTER-indexed (1 Kris, 4 Noelle), not tab-indexed');

  const st = createState({ seed: 99, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: PROCEED_VERSION, gear: override });
  assertEq(gearOfChar(st, CHAR_NOELLE).weapon, 12,
    'THE MENU REACHES THE FIGHT: Noelle carries what the equip page put on her');
  assertEq(gearOfChar(st, CHAR_NOELLE).armor.join(), '15,24', '...both armour slots too');
  assertEq(gearOfChar(st, CHAR_KRIS).weapon, 23, '...and Kris carries his');
  assert(gearOfChar(st, CHAR_NOELLE).weapon !== gearOfChar(control, CHAR_NOELLE).weapon,
    '...and it is a REAL change against the control, not the default twice');

  // The vanilla-shaped loadout stays three long, or the first consumer that
  // walks slots 0..2 reads `undefined.weapon` and throws.
  const pad = padLoadout(edited);
  assertEq(pad.length, 3, 'state.loadout.gear is padded back to three');
  assertEq(pad[2].weapon, 0, '...with the spare unequipped, as an absent character is');
  assertEq(pad[0].weapon, 23, '...and the real entries carried through');

  // AND THE A-SIDE IS UNTOUCHED. A `gear` argument on a version with no
  // roster must not quietly re-gear the byte-gated lane.
  const a = createState({ seed: 99, traceBulletSlots: 0 });
  buildKaizoScene(a, { version: 'C', gear: override });
  assertEq(a.kaizo.gear, undefined,
    'V-C has no roster, so the override is ignored rather than half-applied');
  assertEq(a.partyHp.join(','), '160,190,140', '...and the A-Side party is the A-Side party');
}

// ── 5. PERSISTENCE ────────────────────────────────────────────────────────
section('the ramp survives a reload, and a hostile entry cannot take the route');
{
  // A tiny in-memory localStorage. The real one is the browser's; the module
  // takes the store as a parameter precisely so this can run headless.
  const mem = new Map();
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };
  const t = atUnusedRow();
  armUnused(t, { ...loadProceed(store), sprite: PROCEED_SHATTER_SPRITE });
  assertEq(unusedRowStyle(t).heat, 0, 'nothing saved: a fresh, cold row');
  for (let i = 0; i < 7; i++) tap(t, 'confirm');
  saveProceed(t.unused, null, store);
  assert(mem.has(PROCEED_KEY), 'the presses were written to the proceed key');
  assert(!mem.has('kaizoknight.settings'), '...and NOT into the settings entry');

  const t2 = atUnusedRow();
  armUnused(t2, { ...loadProceed(store), sprite: PROCEED_SHATTER_SPRITE });
  assertEq(t2.unused.presses, 7, 'a reload resumes at the press it left on');
  assertEq(unusedRowStyle(t2).heat, 7 / UNUSED_PRESSES, '...at the same heat');

  // Take it, with a loadout, and read both back.
  for (let i = 7; i < UNUSED_PRESSES - 1; i++) tap(t2, 'confirm');
  stepTitle(t2, { ...NONE_IN, confirm: true }, []);
  assert(t2.unused.shatter !== null, 'the twentieth press on the reloaded row breaks it');
  runShatter(t2);
  assertEq(t2.unused.taken, true, 'taken on the reloaded row');
  const g = weirdRouteGear();
  g[1].weapon = 12;
  saveProceed(t2.unused, g, store);
  const back = loadProceed(store);
  assertEq(back.taken, true, 'the route comes back taken');
  assertEq(back.gear?.[1]?.weapon, 12, '...and the Weird Route loadout with it');

  // Hostile / corrupt entries.
  mem.set(PROCEED_KEY, '{ not json');
  assertEq(JSON.stringify(loadProceed(store)), '{}', 'a corrupt entry reads as nothing');
  mem.set(PROCEED_KEY, JSON.stringify({ presses: 9999, taken: false, gear: [1, 2, 3, 4] }));
  const hostile = loadProceed(store);
  assertEq(hostile.gear, undefined, 'a wrong-length saved loadout is refused');
  const t3 = atUnusedRow();
  armUnused(t3, { ...hostile, sprite: PROCEED_SHATTER_SPRITE });
  assertEq(t3.unused.presses, UNUSED_PRESSES, 'an absurd press count is clamped');
  assertEq(t3.unused.taken, false, '...and clamping it does not TAKE the route');
  assertEq(unusedRowStyle(t3).name, 'UNUSED', '...the row is still UNUSED, not PROCEED');
  assertEq(t3.unused.shatter, null, '...and no saved value can arm a live shatter');
  // IT STILL TAKES ONE MORE PRESS. This is the assertion that a corrupt entry
  // cannot walk a player onto the Weird Route without them doing anything.
  const rFull = stepTitle(t3, { ...NONE_IN, confirm: true }, []);
  assertEq(rFull.shatter, true, 'a clamped-full row breaks on its next press');
  assertEq(rFull.proceed, false, '...and even that press is not the door');
  // A throwing store (private mode) must not take the page down.
  const angry = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assertEq(JSON.stringify(loadProceed(angry)), '{}', 'a storage that throws reads as nothing');
  saveProceed(t3.unused, null, angry);
  assert(true, '...and writing to it does not throw');
}

// ── 6. THE DRIVER STILL CALLS ALL OF IT ───────────────────────────────────
//
// web/kaizo.js builds a renderer against the DOM on its first lines, so it
// cannot be imported here. The source is read instead. This cannot prove the
// calls work; it proves they have not been deleted or renamed out from under
// the mechanism, which is the failure this repo keeps having.
section('web/kaizo.js is wired to all of it');
{
  const src = readFileSync(join(REPO, 'web', 'kaizo.js'), 'utf8');
  const wires = [
    ['armUnused(title, { ...savedProceed, sprite: PROCEED_SHATTER_SPRITE })',
      'the row is ARMED, WITH the shatter sheet — without this every test above '
      + 'is about a page that does not exist, and without the sheet the break '
      + 'draws nothing'],
    ['if (title.unused.taken && !explicitVersion) enterWeirdRoute()', 'a taken route resumes on load'],
    ['if (r.proceed && !weirdRoute)', 'out.proceed is acted on'],
    ['if (r.press) saveProceed', 'every press is persisted'],
    ['if (r.shatter) {', 'the break makes a sound'],
    ['...KAIZO_DRAW_OVERRIDES, ...KAIZO_SHATTER_OVERRIDE',
      'the roar finale\'s shatter pieces are given a drawer (ledger G-38)'],
    ['gear: weirdRoute ? gearOverrideFromTabs(title.party, title.gear) : undefined', 'the equip page reaches the fight'],
    ['title.party = weirdRouteTabs()', 'the menus switch with the build'],
    ['versionId = PROCEED_VERSION', 'and the version does'],
    ['reset()', 'the fight is rebuilt on the spot'],
    ['if (sharedCfg.gear && !weirdRoute)', 'a shared three-person loadout is refused on a two-person route'],
  ];
  for (const [needle, why] of wires) {
    assert(src.includes(needle), `driver: ${why}  [${needle}]`);
  }
  // The A-Side default must not have moved.
  assert(src.includes("(explicitVersion ?? 'C').toUpperCase()"),
    'driver: a page with nothing saved still defaults to V-C, the A-Side');
  assert(src.includes('...(weirdRoute ? {} : { gear: title.gear }),'),
    'driver: persistSettings withholds a two-entry loadout from the settings key, '
    + 'so a Weird Route session cannot destroy the A-Side build on its way out');
}

// ── 7. A SHARE LINK FROM THE WEIRD ROUTE CARRIES NO LOADOUT ───────────────
//
// `encodeConfig` always writes THREE gear slots and fills an absent one with
// NONE; `decodeConfig` refuses a loadout that has any NONE in it — "all nine
// or none", because a half-applied build reads as the sharer's setup while
// being someone else's stats. So a two-person loadout round-trips to `null`
// and the receiver keeps their own, which is the right answer and is
// PRE-EXISTING behaviour, not something added here. Asserted so a later change
// to either side cannot quietly start handing A-Side players a two-entry gear
// array.
section('sharing from the Weird Route does not hand anyone a two-entry loadout');
{
  const { encodeConfig, decodeConfig, NONE: SHARE_NONE } = await import('../../../sim/share.js');
  const wr = weirdRouteGear();
  const token = encodeConfig({
    mode: SHARE_NONE, attack: SHARE_NONE, difficulty: SHARE_NONE,
    gear: wr, bag: null,
  });
  const back = decodeConfig(token, {});
  assert(back !== null, 'the token is still a valid token');
  assertEq(back.gear, null,
    'a two-person loadout decodes to NO loadout — the receiver keeps their own three');

  // CONTROL: a three-person one still travels, or the assertion above would
  // be satisfied by share links being broken outright.
  const three = [
    { weapon: 16, armor: [1, 10] },
    { weapon: 17, armor: [1, 10] },
    { weapon: 18, armor: [1, 10] },
  ];
  const t3 = decodeConfig(encodeConfig({
    mode: SHARE_NONE, attack: SHARE_NONE, difficulty: SHARE_NONE, gear: three, bag: null,
  }), {});
  assertEq(t3.gear?.length, 3, 'CONTROL: a three-person loadout still shares');
  assertEq(t3.gear?.[2]?.weapon, 18, '...intact');
}

// ── 8. THE GLASS IS REAL, AND IT PAINTS THE ROAR'S FINALE TOO (G-38) ──────
//
// The ledger's G-38 is severity 4 — "the screen shatter is simulated and
// invisible". `kaizo/attacks/roaring-final-shatter.js` has translated all 31
// pieces since 2026-09-08 and nothing has ever drawn one, so the fight's own
// ending paints empty air. The drawer the settings row needed is the drawer
// that closes it, and this section is the proof that it is not a drawer only
// the menu can call — which would be the SEVENTH instance of this repo's
// signature defect rather than a fix for the sixth.
section('the shatter sheet exists, and the roar finale\'s pieces are painted');
{
  const manifest = JSON.parse(
    readFileSync(join(REPO, 'kaizo', 'assets', 'sprites', 'manifest.json'), 'utf8'),
  );
  const sheet = (manifest.sprites ?? manifest)[PROCEED_SHATTER_SPRITE];
  assert(!!sheet, `${PROCEED_SHATTER_SPRITE} is in the kaizo sprite overlay`);
  assertEq(sheet.frames, UNUSED_SHATTER.fragments,
    'and it has 31 sub-images — sprite_get_number, and the shatter\'s default count');
  assertEq(`${sheet.w}x${sheet.h}`, '640x480', '...one screen each');

  // A HEADLESS CANVAS. sliceShatter cuts with composite operations, so it needs
  // `document.createElement('canvas')`; the drawer needs a context to draw on.
  // Both are counted rather than rendered — the assertion is that the calls
  // HAPPEN, which is the whole of G-38.
  const draws = [];
  const mkCtx = (log) => new Proxy({}, {
    get(_t, p) {
      if (p === 'canvas') return { width: 640, height: 480 };
      if (p === 'drawImage') return (img, ...rest) => { if (log) log.push({ img, rest }); };
      if (p === 'getImageData' || p === 'createImageData') {
        return (a, b, w, h) => ({ data: new Uint8ClampedArray(4 * (w ?? 1) * (h ?? 1)) });
      }
      if (p === 'measureText') return () => ({ width: 10 });
      if (typeof p === 'string') return () => {};
      return undefined;
    },
    set() { return true; },
  });
  const prevDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag) => {
      if (tag !== 'canvas') return {};
      const c = { width: 0, height: 0, style: {} };
      c.getContext = () => mkCtx(null);
      return c;
    },
  };

  const { screenshatterCreate, screenshatterStep } = await import('../../attacks/roaring-final-shatter.js');
  const { drawKaizoShatterPiece, KAIZO_SHATTER_OVERRIDE, SHATTER_SHEET } =
    await import('../../ui/shatter-draw.js');
  assertEq(SHATTER_SHEET, PROCEED_SHATTER_SPRITE,
    'the drawer and the menu name the SAME sheet — one sprite, one place');
  assertEq(Object.keys(KAIZO_SHATTER_OVERRIDE).join(), 'kaizo_shatterpiece',
    'the override is keyed by the piece\'s object name, which is what '
    + 'render/canvas.js\'s seam looks up');

  const st = createState({ seed: 7, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: 'C' });
  st.knight = st.knight ?? {};
  // FINAL HIT: the branch whose blend is the red this whole feature is built
  // on (`scr_lerpvar.gml:57-67`).
  screenshatterCreate(st, { finalHit: true });
  const pieces = st.knight.shatter_insts.filter((p) => p && p !== -4);
  assertEq(pieces.length, 31, 'the sim really made 31 pieces');
  assert(pieces.every((p) => !p.sprite_index),
    'and not one of them carries a sprite — which is WHY nothing drew them');

  const sprites = new Map([[SHATTER_SHEET, {
    frames: Array.from({ length: 31 }, (_, i) => ({ width: 640, height: 480, _i: i })),
    meta: { w: 640, h: 480, ox: 320, oy: 240 },
  }]]);
  const ctxLog = mkCtx(draws);

  // THE HOLD PAINTS NOTHING, AND THAT IS THE FIX RATHER THAN THE BUG.
  //
  // `scr_screenshatter_step` assigns `image_blend` only in the branch past the
  // delay (`scr_lerpvar.gml:166-173`), so on the final-hit path — delay 6 —
  // the field does not exist for the first frames. In the GML that is
  // harmless: every piece's texture is a live capture of the screen
  // (`sprite_create_from_surface`), so an untinted piece IS the unbroken
  // screen. Against a stencil sheet 'untinted' would mean a white rectangle,
  // and 31 of them tile the whole 640x480 view — the ending opened on a white
  // flash. The drawer now paints nothing until the piece has a blend, and the
  // live frame underneath shows through, which is what the hold is FOR.
  //
  // This section used to draw on the creation frame and assert 31 images, so
  // it asserted the defect as correct. It now asserts both halves.
  for (const p of pieces) {
    assert(drawKaizoShatterPiece(ctxLog, p, st, { sprites }) === true,
      'the drawer owns the piece entirely during the hold too (no vanilla tail)');
  }
  assertEq(draws.length, 0,
    'THE HOLD PAINTS NOTHING — the screen is meant to look unbroken');

  // Past the delay, every piece has its blend and every piece paints.
  for (let i = 0; i < 12; i++) screenshatterStep(st);
  const live = st.knight.shatter_insts.filter((q) => q && q !== -4);
  assert(live.length > 0, 'the pieces survived the hold');
  assert(live.every((q) => q.image_blend !== undefined),
    '...and every one of them now carries a blend');
  draws.length = 0;
  let drawn = 0;
  for (const p of live) {
    const done = drawKaizoShatterPiece(ctxLog, p, st, { sprites });
    assert(done === true, 'the drawer owns the piece entirely (no vanilla tail)');
    drawn += 1;
  }
  assertEq(drawn, live.length, 'every piece went through the drawer');
  assertEq(draws.length, live.length,
    'AND EVERY PIECE PUT AN IMAGE ON THE CANVAS ONCE THE GLASS MOVES — G-38 closed');

  // THE PIECES ARE DIFFERENT SHARDS, not the same one 31 times. A drawer that
  // painted fragment 0 for everybody would satisfy the count above and still be
  // wrong, so the sub-image assignment is asserted directly.
  assertEq(new Set(draws.map((d) => d.img)).size, draws.length,
    '...and a DIFFERENT sub-image per piece, not fragment 0 thirty-one times');

  // NO SHEET, NO THROW. A clone whose sprite overlay has not been packed must
  // lose the glass, not the page.
  const bare = drawKaizoShatterPiece(ctxLog, pieces[0], st, { sprites: new Map() });
  assertEq(bare, true, 'a missing sheet draws nothing and still skips the tail');
  assertEq(draws.length, 31, '...and really drew nothing');

  // ── 9. AND THE SAME DRAWER CUTS THE MENU'S PICTURE ─────────────────────
  //
  // The roar's path above takes the FLAT-BLEND branch (no screenshot to cut).
  // The settings row takes the other one: it hands `sliceShatter` a `paint`
  // that draws the word, and gets the word back in 31 pieces. Both branches
  // are exercised here, because the one the menu uses cannot be reached
  // through a headless `drawTitle` — `loadFont` never becomes ready without a
  // browser, and every `drawText` then returns before it draws anything.
  section('the shared drawer cuts a PICTURE too — the settings row\'s branch');
  {
    const { sliceShatter, drawShatterFragment } = await import('../../../render/shatter.js');
    const entry = sprites.get(SHATTER_SHEET);
    // A CANVAS THAT REMEMBERS WHAT WAS DRAWN INTO IT. The assertion below
    // cannot be made any other way: the failure it catches leaves the slice
    // COUNT, SIZE and POSITION all correct and only the pixels wrong, and there
    // are no pixels in a headless run.
    const madeCanvas = globalThis.document.createElement;
    const made = [];
    globalThis.document.createElement = (tag) => {
      if (tag !== 'canvas') return {};
      const c = { width: 0, height: 0, style: {}, id: made.length, into: [] };
      c.getContext = () => new Proxy({}, {
        get(_t, p) {
          if (p === 'canvas') return c;
          if (p === 'drawImage') return (img) => c.into.push(img?.id ?? 'sheet');
          if (typeof p === 'string') return () => {};
          return undefined;
        },
        set() { return true; },
      });
      made.push(c);
      return c;
    };
    let painted = 0;
    const slices = sliceShatter(entry, {
      width: 140,
      height: 32,
      blend: UNUSED_RED,
      paint: () => { painted += 1; },
    });
    const paintedCanvases = made.length;
    assertEq(painted, 1,
      'the picture is painted ONCE and cut 31 times — not repainted per fragment');
    // THE TWO-CANVAS TINT. `multiply` IGNORES THE DESTINATION'S ALPHA, so the
    // blend floods the whole box and the picture's own shape has to be restored
    // by a `destination-in` pass over an UNTOUCHED COPY of it. Run that pass
    // against the canvas being drawn INTO and it keeps everything: the row
    // shattered into a solid slab of red with the word gone, while the slice
    // count, size and positions were all still right and every other assertion
    // here still passed. Seen on screen, never by a suite — so it is pinned by
    // WHAT THE COMPOSITE WAS HANDED, which is the only thing that distinguishes
    // the two.
    assertEq(paintedCanvases, 2 + 31,
      'a painted cut mints an untouched copy alongside the one it composites into');
    assertEq(made[0].into.join(), '1,1',
      'and BOTH passes over it are handed that COPY (canvas 1), never itself');
    assert(!made[0].into.includes(0),
      '...the self-draw that flattened the word into a slab cannot happen');
    made.length = 0;
    sliceShatter(entry, { width: 140, height: 32, blend: UNUSED_RED });
    globalThis.document.createElement = madeCanvas;
    assertEq(made.length, 1 + 31,
      '...and the flat-blend path, having no picture to preserve, mints no copy');
    assertEq(slices.length, 31, 'one slice per sub-image');
    assert(slices.every((c) => c.width === 140 && c.height === 32),
      'every slice is the row\'s own box, so they reassemble where the row was');
    const log2 = [];
    const ctx2 = mkCtx(log2);
    for (const s of slices) drawShatterFragment(ctx2, s, 190, 290);
    assertEq(log2.length, 31, 'and all 31 reach the canvas');
    // A zero-size box, or a sheet that is not there, must give nothing rather
    // than throw — the row still has to take the route.
    assertEq(sliceShatter(entry, { width: 0, height: 0, blend: UNUSED_RED }).length, 0,
      'a zero-size box cuts nothing');
    assertEq(sliceShatter(null, { width: 140, height: 32, blend: UNUSED_RED }).length, 0,
      'a missing sheet cuts nothing');
  }

  globalThis.document = prevDocument;
}

// ── 10. THE RENDERER IS STILL WIRED TO ALL OF IT ──────────────────────────
//
// Same reasoning as section 6, one file over: render/title.js cannot be driven
// headlessly to the point where it draws text, so its wiring is asserted
// against its source. Weak evidence for behaviour, strong evidence for absence.
section('render/title.js draws the ramp and the glass');
{
  const src = readFileSync(join(REPO, 'render', 'title.js'), 'utf8');
  const wires = [
    ["import { sliceShatter, drawShatterFragment } from './shatter.js';",
      'the SHARED drawer is the one the row uses — not a second copy'],
    ['mergeColor(DIM, style.red, style.heat)',
      'the ramp walks from the old DIM to the shatter\'s own red by heat'],
    ['drawUnusedShatter(ctx, font, sprites, unusedStyle, title.unused?.shatter,',
      'the fragments are drawn'],
    ['centred(ctx, font, \'Z  open      X  back\', 448, DIM, 0.75);\r\n    // LAST, OVER EVERYTHING',
      'and they are drawn LAST, so nothing on the page cuts through the glass'],
    ['if (style.shattering) return;',
      'the intact row is NOT drawn under its own fragments'],
    ['`${style.presses} / ${style.total}`',
      'the count is on screen, which is how the player knows it is doing something'],
  ];
  for (const [needle, why] of wires) {
    assert(src.includes(needle), `renderer: ${why}`);
  }
}

console.log(`\ncheck-proceed-route: ${count - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
