#!/usr/bin/env node
// THE ACT GRID'S PRICE TAG — the "% TP" readout the ACT list never drew.
//
//   node kaizo/tools/checks/check-actgrid-tpcost.mjs
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
//
// `render/menu.js` drew the cost readout under exactly one condition:
//
//     if (menu.submenu === 'magic' && sel && SPELLS[sel.id]) { ... }
//
// so the ACT grid — which is the SAME 2x6 list, drawn by the same function —
// showed no price at all. On the Weird Route that hides the only costed act in
// the fight: X-Slash is 62.5 of a 250 bar, and a player standing at 40 TP was
// shown a grey row with nothing beside it to say what it wanted. The move
// reads as broken; it is unpaid for.
//
// THE GAME'S OWN CONDITION, and it is not the spell list's:
//
//     // obj_battlecontroller Draw_0:1329-1334, inside the bmenuno-9 block
//     if (global.tensionselect > 0)
//     {
//         thiscost = round((acttpcost[actcoord] / global.maxtension) * 100);
//         draw_set_color(c_orange);
//         draw_text(xx + 500, yy + 440, string(thiscost) + "% TP");
//     }
//
//     // Step_0:1097, re-run on every step of this stage
//     global.tensionselect = acttpcost[global.bmenucoord[9][global.charturn]];
//
// Three things differ from the spell readout twenty lines above it in the same
// file, and all three are asserted here rather than eyeballed:
//   * the test is `> 0` on the SELECTED row's cost — vanilla's acts are free,
//     so a widened `submenu === 'actgrid'` would print "0% TP" under every
//     vanilla ACT description;
//   * `round`, where the spell list (Draw_0:912) uses `floor` — and GML's
//     round is HALF TO EVEN (sim/gml.js gmlRound);
//   * the literal x 500, where the spell list uses `spell_offset`
//     (`langopt(500, 496)`, 496 outside Japanese).
//
// ── THE ASSERTIONS (all positive) ──────────────────────────────────────────
//   A. driven to the X-Slash row: "25% TP" is painted at (500, 440), orange.
//   B. a FREE row (Check) paints no readout — the `> 0` test is live.
//   C. `round`, and half-to-even: costs pushed through the REAL actList seam
//      distinguish it from `floor` and from JS's Math.round.
//   D. the MAGIC readout is still at 496 with its own `floor` and its own
//      unconditional draw — AND the second half of the same defect: it asked
//      `SPELLS[sel.id]`, the hardcoded vanilla table, so the Weird Route's own
//      spell ids (SleepMist 8, IceShock 9) printed no price at all while the
//      two vanilla ids beside them printed theirs. It asks `spellInfo` now —
//      the seam it already took `spellCost` through.
//   E. V-C and vanilla paint no readout at all (their acts are free).
//   F. READER GUARD: take `cost` off the rows through the seam and the
//      readout must vanish.
//
// SABOTAGE-TESTED: exit 1 with the `isAct && (sel?.cost ?? 0) > 0` block
// removed, exit 0 restored (see the lane report).

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

/** A tint canvas that reports the colour that made it — see check-xslash-heads. */
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
const { buildPracticeScene } = await import('../../../sim/scenes/practice.js');
const { buildKaizoScene } = await import('../../scenes/kaizo-fight.js');
const { drawMenu } = await import('../../../render/menu.js');
const { loadFont } = await import('../../../render/font.js');
const { listRows } = await import('../../../sim/menu.js');
const { MAX_TENSION } = await import('../../../sim/tension.js');
const { spellCost, spellInfo } = await import('../../../sim/spells.js');
const { gmlRound } = await import('../../../sim/gml.js');
const { XSLASH_ACT_INDEX } = await import('../../party/spells.js');

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
const section = (t) => console.log(`\n== ${t}`);

const IDLE = {
  left: false, right: false, up: false, down: false, confirm: false, cancel: false,
  focus: false, button3: false,
};

// The stub font: the glyph's SOURCE x is its character code, so the call log
// reads back as text. See check-xslash-heads.mjs for the whole argument.
{
  const font = loadFont();
  const glyphs = [];
  for (let code = 32; code < 127; code++) glyphs.push({ c: code, x: code, y: 0, w: 20, h: 20, offset: 0, shift: 20 });
  font.meta = { name: 'fnt_stub', glyphs };
  font.glyphs = new Map(glyphs.map((g) => [g.c, g]));
  font.img = { width: 256, height: 256, src: 'stub://font', __tag: 'FONTPAGE' };
  font.ready = true;
}

const SPRITE_IMG = { width: 32, height: 32, src: 'stub://frame', __tag: 'IMG' };
const SPRITE_ENTRY = { frames: [SPRITE_IMG, SPRITE_IMG], meta: { ox: 16, oy: 16, w: 32, h: 32 } };
const SPRITES = { get: () => SPRITE_ENTRY };

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
/** The cost readout's own row: y 440, the only thing drawn there. */
const costRun = (log) => textRuns(log).find((r) => r.y === 440);

/**
 * What the SELECTED spell row must print, computed from the seam rather than
 * from the renderer: the cost that will actually be charged, or — when that is
 * not a finite number, which is how sim/spells.js REFUSES an act row — the
 * row's own `battlespellcost`. Independent of how drawItemList words it, and
 * it survives another lane re-pricing a spell.
 */
function expectedSpellPct(s) {
  const id = listRows(s)[s.menu.gridIndex]?.id;
  const charged = spellCost(s, s.menu.charturn, id);
  const price = Number.isFinite(charged) ? charged : (spellInfo(s, id)?.cost ?? 0);
  return `${Math.floor((price / MAX_TENSION) * 100)}% TP`;
}

function build(kind) {
  const s = createState({ seed: 12345, traceBulletSlots: 8 });
  if (kind === 'vanilla') buildPracticeScene(s, { seed: 12345 });
  else buildKaizoScene(s, { version: kind });
  return s;
}
function tap(s, key) {
  stepFrame(s, { ...IDLE, [key]: true });
  stepFrame(s, IDLE);
  for (let i = 0; i < 4; i++) stepFrame(s, IDLE);
}
function openMenu(kind) {
  const s = build(kind);
  for (let i = 0; i < 8 && !s.menu?.open; i++) stepFrame(s, IDLE);
  if (!s.menu?.open) throw new Error('menu never opened');
  return s;
}
/** Kris's ACT grid, driven: RIGHT to the ACT button, picker, grid, then rows. */
function toActGrid(kind, row = XSLASH_ACT_INDEX) {
  const s = openMenu(kind);
  tap(s, 'right');
  tap(s, 'confirm');
  tap(s, 'confirm');
  for (let i = 0; i < 6 && s.menu.gridIndex !== row; i++) {
    if (row - s.menu.gridIndex >= 2) tap(s, 'down');
    else tap(s, 'right');
  }
  s.frame = 200;
  return s;
}
const paint = (s) => { const log = []; drawMenu(mkCtx(log), s, SPRITES); return log; };

// ── A. THE READOUT ─────────────────────────────────────────────────────────
section('A — X-Slash\'s price is painted (Draw_0:1329-1334)');
{
  const s = toActGrid('D');
  eq(s.menu.submenu, 'actgrid', 'driven to the ACT grid');
  eq(listRows(s)[XSLASH_ACT_INDEX]?.cost, 62.5, 'the selected row costs 62.5');
  const run = costRun(paint(s));
  eq(run?.text, '25% TP', 'the readout says 25% TP — 62.5 of a 250 bar');
  eq(run?.x, 500, 'at x 500 (the ACT block\'s literal, NOT the spell list\'s 496)');
  eq(run?.y, 440, 'at y 440');
  eq(run?.page, 'TINT[rgb(255,160,64)]', 'in c_orange');
  eq(gmlRound((62.5 / MAX_TENSION) * 100), 25, '...which is the dump\'s own arithmetic');
}

// ── B. A FREE ROW PAINTS NOTHING ───────────────────────────────────────────
section('B — `if (global.tensionselect > 0)` is live: a free act has no price');
for (const row of [0, 1]) {
  const s = toActGrid('D', row);
  eq(s.menu.gridIndex, row, `row ${row} is highlighted`);
  eq(listRows(s)[row]?.cost, 0, `row ${row} (${listRows(s)[row]?.label}) is free`);
  eq(costRun(paint(s)), undefined, `row ${row} paints no "% TP" readout`);
}
{
  // ...and the description above it still draws, so "nothing at y 440" is not
  // "nothing drawn at all".
  const s = toActGrid('D', 0);
  const desc = textRuns(paint(s)).find((r) => r.x === 496 && r.y === 375);
  eq(desc?.text, 'Useless', 'the row\'s description is still painted at (496, 375)');
}

// ── C. round, HALF TO EVEN ─────────────────────────────────────────────────
section('C — `round`, not the spell list\'s `floor`, and GML\'s round at that');
/** Re-price the X-Slash row through the REAL seam sim/spells.js reads. */
function priced(cost) {
  const s = toActGrid('D');
  const inner = s.kaizo.hooks.actList;
  s.kaizo.hooks.actList = (st, slot) => inner(st, slot)
    .map((a, i) => (i === XSLASH_ACT_INDEX ? { ...a, cost } : a));
  return costRun(paint(s))?.text;
}
{
  // 64 / 250 * 100 = 25.6 — floor says 25, round says 26.
  eq(priced(64), '26% TP', 'cost 64 reads 26% TP (floor would have said 25)');
  // 61.25 / 250 * 100 = 24.5 exactly — GML's round goes to the EVEN 24,
  // JS's Math.round goes up to 25.
  eq(priced(61.25), '24% TP', 'cost 61.25 reads 24% TP (a .5 tie goes to even, not up)');
  eq(priced(63.75), '26% TP', '...and 63.75 reads 26% TP (25.5, tie to the even 26)');
  eq(priced(2.5), '1% TP', 'a cheap act still prints: 2.5 reads 1% TP');
}

// ── D. THE SPELL READOUT IS UNTOUCHED ──────────────────────────────────────
section('D — MAGIC still prints its own cost, at 496, and now on EVERY row');
{
  // Noelle is slot 1 on the Weird Route. Kris's FIGHT takes two confirms (the
  // button, then the enemy row); then RIGHT lands on her MAGIC button.
  const s = openMenu('D');
  for (let i = 0; i < 8 && s.menu.charturn === 0; i++) tap(s, 'confirm');
  eq(s.menu.charturn, 1, 'the turn reached slot 1 (Noelle)');
  s.tension = 250;
  tap(s, 'right');
  tap(s, 'confirm');
  eq(s.menu.submenu, 'magic', 'her MAGIC grid is open');
  s.frame = 200;
  // THE PARTNER ACT ROW IS IN THIS LIST NOW. This block used to assert the
  // opposite, and said so at length: a lane had built the fix, measured it
  // against the whole-fight recording, watched the recording move, and backed
  // it out. What changed is not the GML reading but WHERE THE SEAM SITS.
  // `state.spellmenuActs` is set only for a side-B version
  // (kaizo/scenes/kaizo-fight.js, behind `kaizoSidebFor(version)`), and BOTH
  // tracked recordings are Normal Route — CLAUDE.md, 'The one number':
  // "`fullfight/` is Normal Route on both pairs". So the act row cannot reach
  // the byte gate at all, and V-C's grid is byte-for-byte what it was.
  //
  // Noelle's grid is therefore [N-Action, Heal Prayer, SleepMist, IceShock,
  // SnowGrave] (scr_spellmenu_setup: the caster's ACT rows, marker -1, then
  // the spells), two columns wide — down is +2, right is +1.
  eq(listRows(s)[0]?.label, 'N-Action', 'her first MAGIC row is the ACT row');
  eq(costRun(paint(s)), undefined, 'the ACT row is free, so it prints no price at all');
  tap(s, 'right');
  s.frame = 200;
  eq(listRows(s)[s.menu.gridIndex]?.label, 'Heal Prayer', 'RIGHT lands on the first spell');
  const first = costRun(paint(s));
  eq(first?.x, 496, 'the SPELL readout is still at 496 (spell_offset, not the ACT 500)');
  eq(first?.text, expectedSpellPct(s), '...and it prints its own floor()-ed cost');
  // THE ROWS THE VANILLA TABLE DOES NOT HAVE. `SPELLS[sel.id]` gated this
  // readout, so the Weird Route's own ids (SleepMist 8, IceShock 9) printed
  // NOTHING while the vanilla id beside them printed its price.
  // DOWN steps two along the 2-wide grid (1 -> 3).
  tap(s, 'down');
  s.frame = 200;
  eq(listRows(s)[s.menu.gridIndex]?.label, 'IceShock', 'DOWN lands on IceShock (id 9)');
  eq(costRun(paint(s))?.text, '8% TP',
    'IceShock prints a price now — and it is the CHARGED cost (spellCost 20), not its table 40');
  eq(costRun(paint(s))?.text, expectedSpellPct(s), '...which is what the seam says it will charge');
  tap(s, 'left');
  s.frame = 200;
  eq(listRows(s)[s.menu.gridIndex]?.label, 'SleepMist', 'LEFT lands on SleepMist (id 8)');
  eq(costRun(paint(s))?.text, expectedSpellPct(s),
    'SleepMist prints a price too — neither id is in the vanilla SPELLS table this used to consult');
}

// ── E. THE A-SIDE PAINTS NO PRICE ──────────────────────────────────────────
section('E — V-C and vanilla: every act is free, so no readout appears');
for (const kind of ['C', 'vanilla']) {
  const rows = [0, 1, 2];
  for (const row of rows) {
    const s = toActGrid(kind, row);
    const list = listRows(s);
    if (!list[row]) continue;
    eq(list[row]?.cost ?? 0, 0, `${kind} row ${row} (${list[row]?.label}) is free`);
    eq(costRun(paint(s)), undefined, `${kind} row ${row}: nothing painted at y 440`);
  }
}

// ── F. THE READER GUARD ────────────────────────────────────────────────────
section('F — reader guard: no `cost` on the row, no readout');
{
  const withCost = paint(toActGrid('D')).join('|');
  const s = toActGrid('D');
  const inner = s.kaizo.hooks.actList;
  s.kaizo.hooks.actList = (st, slot) => inner(st, slot).map(({ cost, ...rest }) => rest);
  const without = paint(s).join('|');
  ok(withCost !== without, 'the painted sequence CHANGES when the row stops carrying a cost');
  eq(costRun(paint(s)), undefined, '...and the readout is gone');
  eq(listRows(s)[XSLASH_ACT_INDEX]?.cost, 0, '(listRows defaults the missing cost to 0)');
}

console.log(`\ncheck-actgrid-tpcost: ${count - failed}/${count} assertions passed`);
process.exit(failed ? 1 : 0);
