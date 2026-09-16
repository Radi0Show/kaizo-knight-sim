#!/usr/bin/env node
// THE ACT GRID IS THE ACTING CHARACTER'S OWN — and S-ACTION LOST A PAGE.
//
//   node kaizo/tools/checks/check-act-pages-kaizo.mjs
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
//
// THE USER'S CORRECTION, VERBATIM: "S-Action, R-Action and N-Action are all
// things that appear in the game, each with special colors and effects in the
// game, and differently in the mod, look at how to implement them and
// implement them correctly in the sim, both sims."
//
// The ACT grid is built from FIVE PARALLEL CHARACTER-KEYED FIELDS, selected by
// `global.char[global.charturn]` (gml_Object_obj_battlecontroller_Draw_0.gml
// :1058-1095):
//
//     char 1 (Kris)    canact      actcost      actsimul      actname   actdesc
//     char 2 (Susie)   canactsus   actcostsus   actsimulsus   actnamesus …
//     char 3 (Ralsei)  canactral   actcostral   actsimulral   actnameral …
//     char 4 (Noelle)  canactnoe   actcostnoe   actsimulnoe   actnamenoe …
//
// all `[thisenemy][__acti]`. `check-act-tables.mjs` pins the TABLES through
// `listRows`. THIS check pins what the PLAYER IS SHOWN: it paints the grid
// through the real renderer against a stub 2d context, once per slot, and
// reads the labels back out of the glyph blits. A flat per-slot list — the
// shape `sim/spells.js`'s `ACTS` has when no hook is installed, and the shape
// a lane twice mistook for the truth — paints the SAME names for every
// character, and section B is what makes that a failure rather than a
// screenshot nobody took.
//
// ── THE MOD'S ONE ACT-TEXT DELTA, and it is not in scr_monstersetup ────────
//
// `gml_Object_obj_knight_enemy_Step_0.gml:1152-1167` (`_susieact == 1 &&
// actconsus == 1`) is byte-identical to `gml_vanilla_v105`'s :818-826 for its
// first six `msg` writes, and then the trees part:
//
//     v105  scr_anyface_next("none", 0);
//           msgnextloc("* (Susie will not ACT any more.)/%", "..._gml_432_0");
//     mod   global.msg[6] = string_replace_all(global.msg[6], "/", "/%");
//
// `msgset(0, s)` writes `msg[0]` (gml_GlobalScript_msgset.gml);
// `scr_anyface_next` is `global.msgno++` then `scr_susface(msgno, e)`, which
// writes a control-only auto-advance page into `msg[1]`
// (gml_GlobalScript_scr_anyface_next.gml, gml_GlobalScript_scr_susface.gml:3);
// the five `msgnext` calls then fill `msg[2..6]`
// (gml_GlobalScript_msgnext.gml). So `msg[6]` IS the mod's last written page —
// "Then we'll just. Have to do things the hard way." — and the replace
// re-terminates it from `/` to `/%`. THE MOD'S S-ACTION IS THE VANILLA LIST
// MINUS ITS FINAL PAGE, and this repo was shipping the vanilla seven.
//
// ── THE KRIS-LESS FALLBACK, all three companions ───────────────────────────
//
// `gml_GlobalScript_scr_monstersetup.gml:1869-1880` — the mod's own addition,
// absent from `gml_vanilla_v105` — ends the monstertype-104 block with
// `if (!scr_havechar(1))` and replaces slot 0 of Susie's, Ralsei's AND
// Noelle's act list with "HoldBreath". `Step_0:933-946` sets `_susieact`,
// `_ralseiact` and `_noelleact` to 2 under the same gate, and the three arms
// (:1190-1205, :1235-1250, :1276-1291) are one shape over the KNIGHT's single
// shared `holdbreathcount`. `kaizoActsForRoster` has built those names since
// it was written; only Noelle's PAGES were translated, so a Kris-less roster
// showed Susie a row labelled HoldBreath that played S-Action's six-page
// monologue and spent her one performance. Unreachable in both shipping
// routes — `scr_havechar` is party MEMBERSHIP, not survival, and Kris is in
// `global.char` for [1, 2, 3] and [1, 4, 0] alike — and translated because the
// rows exist and the two halves disagreed.
//
// ── SABOTAGE-TESTED, both directions (exit codes in the lane report) ────────
//   * `SACTION_PAGES` given back its seventh page -> A red.
//   * the Susie branch of `kaizoResolveActPages` ignoring `krisAbsent` -> C red.
//   * `kaizoActsForRoster` answering slot 0's table for every slot -> B red.
// exit 0 restored each time.

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);

const fmt = (x) => {
  if (x && typeof x === 'object') return x.__tag ?? 'canvas';
  return typeof x === 'number' ? String(Math.round(x * 1000) / 1000) : String(x);
};

/** A 2d-context stand-in that records every method call as `name(a,b,…)`. */
const mkCtx = (log = null, store = {}) => new Proxy(store, {
  get(t, p) {
    if (p === 'canvas') return { width: 640, height: 480 };
    if (p === 'measureText') return () => ({ width: 10 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient') {
      return () => ({ addColorStop: noop });
    }
    if (p === 'createPattern') return () => ({});
    if (p === 'getImageData' || p === 'createImageData') {
      return (a, b, w, h) => {
        const W = (p === 'createImageData' ? a : w) || 1;
        const H = (p === 'createImageData' ? b : h) || 1;
        return { data: new Uint8ClampedArray(W * H * 4), width: W, height: H };
      };
    }
    if (VALUE_PROPS.has(p)) return t[p] ?? '';
    if (typeof p !== 'string') return undefined;
    return (...args) => { if (log) log.push(`${p}(${args.map(fmt).join(',')})`); return undefined; };
  },
  set(t, p, v) { t[p] = v; return true; },
});

function mkCanvas() {
  const store = {};
  const ctx = mkCtx(null, store);
  const c = { width: 0, height: 0, style: {}, getContext: () => ctx };
  Object.defineProperty(c, '__tag', { get: () => `TINT[${store.fillStyle ?? ''}]` });
  return c;
}
globalThis.document = { createElement: (tag) => (tag === 'canvas' ? mkCanvas() : {}) };
globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;

const { createState, stepFrame } = await import('../../../sim/index.js');
const { buildKaizoScene } = await import('../../scenes/kaizo-fight.js');
const { drawMenu } = await import('../../../render/menu.js');
const { loadFont } = await import('../../../render/font.js');
const { ACT_PAGES } = await import('../../../sim/dialogue.js');
const { listRows } = await import('../../../sim/menu.js');
const { resolveActPages } = await import('../../../sim/spells.js');
const {
  SACTION_PAGES, SUSIE_HOLDBREATH_PAGES, RALSEI_HOLDBREATH_PAGES,
  NOELLE_HOLDBREATH_PAGES, kaizoResolveActPages,
} = await import('../../party/spells.js');
const { kaizoActsForRoster, KAIZO_ACTS_BY_CHAR } = await import('../../party/noelle.js');
const { installRoster } = await import('../../party/roster.js');

let failed = 0;
let count = 0;
function ok(cond, what) {
  count += 1;
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
}
function eq(got, want, what) {
  ok(got === want, `${what} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}
const deep = (got, want, what) => eq(JSON.stringify(got), JSON.stringify(want), what);
const section = (t) => console.log(`\n== ${t}`);

const IDLE = {
  left: false, right: false, up: false, down: false, confirm: false, cancel: false,
  focus: false, button3: false,
};

// THE FONT. `loadFont` fetches and node has nothing to answer with, so the
// module's cache entry is filled by hand: one uniform 20x20 glyph per code,
// with the CHARACTER CODE stamped as the source x, so every glyph blit carries
// the character it drew and the log can be read back as text.
{
  const font = loadFont();
  const glyphs = [];
  for (let code = 32; code < 127; code++) {
    glyphs.push({ c: code, x: code, y: 0, w: 20, h: 20, offset: 0, shift: 20 });
  }
  font.meta = { name: 'fnt_stub', glyphs };
  font.glyphs = new Map(glyphs.map((g) => [g.c, g]));
  font.img = { width: 256, height: 256, src: 'stub://font', __tag: 'FONTPAGE' };
  font.ready = true;
}

const SPRITE_IMG = { width: 32, height: 32, src: 'stub://frame', __tag: 'IMG' };
const SPRITE_ENTRY = { frames: [SPRITE_IMG, SPRITE_IMG], meta: { ox: 16, oy: 16, w: 32, h: 32 } };
const allSprites = () => ({ get: () => SPRITE_ENTRY });

function build(version) {
  const s = createState({ seed: 12345, traceBulletSlots: 8 });
  buildKaizoScene(s, { version });
  for (let i = 0; i < 8 && !s.menu?.open; i++) stepFrame(s, IDLE);
  if (!s.menu?.open) throw new Error(`${version}: menu never opened`);
  s.frame = 200; // past the 11-frame intro rise, so no translate is in play
  return s;
}

/**
 * A KRIS-LESS PARTY — the only way into `scr_monstersetup:1869-1880`. Built on
 * V-D because that is the version that installs the seam's hooks; the roster
 * is then re-installed with `[2, 3, 4]`, which is the one writer of
 * `globalChar`, `acts` and `havechar` at once. The knight's shared
 * `holdbreathcount` starts at 0, as its Create leaves it.
 */
function krisless() {
  const s = build('D');
  installRoster(s, { charIds: [2, 3, 4], sideb: false });
  s.knight.holdbreathcount = 0;
  s.actCounts = {};
  return s;
}

/** Every string the frame painted, read back out of the glyph blits. */
function textRuns(log) {
  const runs = [];
  let cur = null;
  for (const line of log) {
    const m = /^drawImage\((FONTPAGE|TINT\[[^\]]*\]),(\d+),0,20,20,(-?[\d.]+),(-?[\d.]+),/.exec(line);
    if (!m) { cur = null; continue; }
    const page = m[1];
    const ch = String.fromCharCode(Number(m[2]));
    const x = Number(m[3]);
    const y = Number(m[4]);
    if (cur && cur.y === y && cur.page === page && x > cur.lastX && x - cur.lastX <= 25) {
      cur.text += ch;
      cur.lastX = x;
    } else {
      cur = { x, y, page, text: ch, lastX: x };
      runs.push(cur);
    }
  }
  return runs;
}

/**
 * Paint ONE slot's ACT grid and hand back the label column, in draw order.
 * `menu.charturn` is the selector the GML uses (`global.charturn`), and the
 * renderer reads it off the state it is handed — so a clone with a different
 * charturn paints that character's grid, exactly as the game does when the
 * command phase walks to them.
 */
function gridLabelsFor(state, slot) {
  const s = { ...state, menu: { ...state.menu, charturn: slot, submenu: 'actgrid', gridIndex: 0 } };
  const log = [];
  drawMenu(mkCtx(log), s, allSprites());
  // The description column starts at 496; the two label columns are at 30 and
  // 260 plus `charoffset`, all well under 400.
  return textRuns(log).filter((r) => r.x < 400).map((r) => r.text);
}

// ── A. S-ACTION IS SIX PAGES — the mod cut the seventh ─────────────────────
section('A — Step_0:1152-1167: the mod re-terminates msg[6] instead of adding a page');
{
  eq(SACTION_PAGES.length, 6, 'S-Action is six pages');
  eq(SACTION_PAGES[0], '* Susie talked to the Knight!', 'page 0 is msg[0]');
  eq(SACTION_PAGES[5], '* Then we\'ll just. Have to do things the hard way.',
    'the LAST page is msg[6], the one the mod re-terminates with /%');
  ok(!SACTION_PAGES.some((p) => /will not ACT any more/.test(p)),
    'the vanilla seventh page "* (Susie will not ACT any more.)" is GONE');
  // The sourced relationship, asserted in both directions so a correction to
  // the vanilla text cannot silently desync this table from it.
  deep(SACTION_PAGES, ACT_PAGES.susie.slice(0, -1),
    'S-Action is exactly ACT_PAGES.susie minus its final page');
  ok(/will not ACT any more/.test(ACT_PAGES.susie[ACT_PAGES.susie.length - 1]),
    'and the page it is minus IS the vanilla "will not ACT any more" line');
}
{
  // DRIVEN THROUGH THE DIRECTOR'S OWN ENTRY POINT, not the kaizo function.
  // This block used to call `kaizoResolveActPages` directly while claiming to
  // drive the seam. It was green while the shipping V-C path printed the
  // VANILLA pages, because `installKaizoMenu` — the only thing that installs
  // `hooks.resolveActPages` — sits behind `if (v.party)` in kaizo-fight.js,
  // and `party` is defined on version D alone. A check that calls the
  // implementation cannot see that nothing calls the implementation.
  const s = build('C');
  const pages = resolveActPages(s, 1, 0);
  deep(pages, SACTION_PAGES, 'the seam answers Susie\'s ACT with the mod\'s six pages');
  eq(s.actCounts.susieUsed, true, '...and spends her one performance (Step_0:1167)');
}

// ── B. THE GRID PAINTS THE ACTING CHARACTER'S OWN TABLE ────────────────────
section('B — Draw_0:1058-1095, painted: each slot shows its OWN character\'s acts');
{
  const c = build('C');
  deep(gridLabelsFor(c, 0), ['Check', 'HoldBreath'],
    'V-C slot 0 (Kris) paints canact[104][0..1]');
  deep(gridLabelsFor(c, 1), ['S-Action'], 'V-C slot 1 (Susie) paints canactsus[104][0]');
  deep(gridLabelsFor(c, 2), ['R-Action'], 'V-C slot 2 (Ralsei) paints canactral[104][0]');

  const d = build('D');
  deep(gridLabelsFor(d, 0), ['Check', 'HoldBreath', 'X-Slash'],
    'V-D slot 0 (Kris) paints the B-Side third row too (Step_0:44-49)');
  deep(gridLabelsFor(d, 1), ['N-Action'], 'V-D slot 1 (Noelle) paints canactnoe[104][0]');
  deep(gridLabelsFor(d, 2), [], 'V-D slot 2 is the EMPTY pad and paints nothing');

  // THE FLAT-LIST GUARD. A per-slot table that ignores the character paints
  // one of these sets three times; these three are pairwise different, and
  // Noelle's differs from Susie's at the same SLOT INDEX across the two
  // versions — which is the whole of the user's correction, as a pixel.
  const sets = [gridLabelsFor(c, 0), gridLabelsFor(c, 1), gridLabelsFor(c, 2)]
    .map((a) => a.join('|'));
  eq(new Set(sets).size, 3, 'V-C\'s three slots paint three DIFFERENT label sets');
  ok(gridLabelsFor(c, 1).join('|') !== gridLabelsFor(d, 1).join('|'),
    'slot 1 paints S-Action on the Normal Route and N-Action on the Weird Route');
}
{
  // The DESCRIPTION column is character-keyed too: `actdesc[actcoord]`, and
  // "Useless#analysis" is the 104 block's only non-empty one
  // (scr_monstersetup.gml:1857). `#` is GameMaker's line break.
  const c = build('C');
  const s = { ...c, menu: { ...c.menu, charturn: 0, submenu: 'actgrid', gridIndex: 0 } };
  const log = [];
  drawMenu(mkCtx(log), s, allSprites());
  const desc = textRuns(log).filter((r) => r.x >= 400).map((r) => r.text);
  ok(desc.includes('Useless') && desc.includes('analysis'),
    `Check's actdesc is painted, broken at its '#' (got ${JSON.stringify(desc)})`);
}

// ── C. THE KRIS-LESS FALLBACK ──────────────────────────────────────────────
section('C — scr_monstersetup:1869-1880 + Step_0:933-946: no Kris, three HoldBreaths');
{
  deep(kaizoActsForRoster([2, 3, 4]),
    // descb is a SPACE — scr_monster_actreset.gml:8 writes " " and the 104
    // block never overwrites actdesc[1]. See check-act-tables section D.
    [[{ name: 'HoldBreath', descb: ' ', simul: 0 }],
      [{ name: 'HoldBreath', descb: ' ', simul: 0 }],
      [{ name: 'HoldBreath', descb: ' ', simul: 0 }]],
    'a Kris-less roster replaces slot 0 for ALL THREE companions');
  deep(kaizoActsForRoster([1, 4, 0]), [KAIZO_ACTS_BY_CHAR[1], KAIZO_ACTS_BY_CHAR[4]],
    'the Weird Route has Kris, so it keeps N-Action (the gate is membership)');
}
{
  // One knight, three companions, in turn — the counter is the KNIGHT's and is
  // shared, so only the FIRST performance of the fight gets the buff line.
  //
  // The roster is re-installed on a V-D state because V-D is the build that
  // installs the seam's hooks at all; `installRoster` is the one writer of
  // `globalChar` / `acts` / `havechar`, and poking those three by hand leaves
  // `charIdOf` answering off the old roster.
  const s = krisless();

  deep(kaizoResolveActPages(s, 0, 0), SUSIE_HOLDBREATH_PAGES.first,
    'Susie takes the fallback (Step_0:1192-1196), not S-Action');
  eq(s.knight.holdbreathcount, 1, '...and the knight\'s shared counter moves to 1');
  eq(s.actCounts.susieUsed, undefined,
    '...and her row is NOT spent: `canactsus[0] = 0` is in the _susieact == 1 arm only');
  deep(kaizoResolveActPages(s, 0, 0), SUSIE_HOLDBREATH_PAGES.again,
    'so she can take it again, and the second time is the "nothing seemed to happen" line');

  deep(kaizoResolveActPages(s, 1, 0), RALSEI_HOLDBREATH_PAGES.again,
    'Ralsei shares the SAME counter (Step_0:1237), so he never sees the buff line');
  deep(kaizoResolveActPages(s, 2, 0), NOELLE_HOLDBREATH_PAGES.again,
    'and so does Noelle (Step_0:1278)');
}
{
  // Ralsei first this time: the buff line follows the counter, not the character.
  const s = krisless();
  deep(kaizoResolveActPages(s, 1, 0), RALSEI_HOLDBREATH_PAGES.first,
    'whoever goes first gets `holdbreathcount == 0`');
  deep(kaizoResolveActPages(s, 0, 0), SUSIE_HOLDBREATH_PAGES.again,
    'and Susie, second, does not');
}
{
  // And the grid really shows HoldBreath there — the label and the pages agree,
  // which is the half that was broken: `kaizoActsForRoster` has written these
  // names since it was created, and the seam played S-Action underneath them.
  const s = krisless();
  const label = (slot) =>
    listRows({ ...s, menu: { ...s.menu, charturn: slot, submenu: 'actgrid' } })
      .map((r) => r.label);
  deep(label(0), ['HoldBreath'], 'Susie is OFFERED HoldBreath, which is what she now plays');
  deep(label(1), ['HoldBreath'], '...Ralsei likewise');
  deep(label(2), ['HoldBreath'], '...and Noelle');
  deep(gridLabelsFor(s, 0), ['HoldBreath'], 'and that is what the renderer paints');
}

console.log(`\n${count - failed}/${count} passed`);
process.exit(failed ? 1 : 0);
