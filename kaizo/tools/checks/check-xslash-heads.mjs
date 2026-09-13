#!/usr/bin/env node
// X-SLASH'S PARTNER-HEAD STRIP — the row that explains its own grey.
//
//   node kaizo/tools/checks/check-xslash-heads.mjs
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
//
// REPORTED FROM PLAY: "make all the moves in the kaizo fight work, stuff like
// x slash on kris does not work."
//
// **THE GATE IS NOT THE BUG.** Driven through the real menu (section A below),
// with Noelle standing the ACT grid greys the X-Slash row and refuses the
// confirm: 0 TP charged, no stage opened. That is exactly right —
//
//     // gml_Object_obj_battlecontroller_Step_0.gml:1099-1113, for an
//     // actactor-11 row
//     if (havechar[1] == 1 && global.hp[2] > 0) canpress = 0;   // Susie
//     if (havechar[2] == 1 && global.hp[3] > 0) canpress = 0;   // Ralsei
//     if (havechar[3] == 1 && global.hp[4] > 0) canpress = 0;   // Noelle
//
// — X-Slash is Kris's last-one-standing move and the Weird Route party is
// Kris + Noelle, so it unlocks the moment Noelle goes down and not before.
//
// WHAT WAS MISSING IS THE TELLING. The game does not hand the player a grey
// row and walk away: the ACT block draws the partner's PORTRAIT beside it with
// two crosses through it, grey while they are standing and white once they are
// down (obj_battlecontroller Draw_0:1173-1192 and :1257-1296 — quoted in full
// at `partnerStrip` in render/menu.js). The strip IS the sentence "you cannot
// use this while Noelle is up", and nothing in this renderer drew it: the
// whole of the user's report is a move that looks broken because the one
// surface that explains it was blank.
//
// `kaizo/party/spells.js`'s `xslashGridHeads(state)` already computed the
// strip correctly and had ZERO readers outside its own module — this repo's
// signature defect, at eleven occurrences and counting. render/ may not import
// from kaizo/ (kaizo/HANDOFF.md §2.1), so the renderer cannot call it; it
// derives the same strip from the engine's own party seam
// (`charIdForSlot` / `slotOccupied` / `state.partyHp`) and section C here
// pins the two answers together, so the kaizo-side model finally has a reader
// and cannot drift from what is painted.
//
// ── THE ASSERTIONS (all positive; sabotage at the bottom of this comment) ───
//   A. the GATE, driven: Noelle up -> row not usable, a confirm charges 0 TP
//      and opens no stage; Noelle down + TP -> the same row is usable.
//   B. the STRIP IS PAINTED on the X-Slash row: head at (28, 410), grey; two
//      spr_tenna_x crosses at (44, 421), scale 0.7, at 6 and 4 degrees; the
//      row's label pushed right by charoffset 30.
//   C. what is painted equals `xslashGridHeads(state)` field for field.
//   D. Noelle DOWN: the same head and crosses, now UNTINTED (-1 is white).
//   E. READER GUARD: with the act row's `actor` marker removed through the
//      real seam, the painted sequence must DIFFER. Delete the reader in
//      render/menu.js and this goes red — it is not a "does a consumer exist"
//      grep.
//   F. the A-Side is untouched: V-C and vanilla practice paint no strip and
//      start their ACT labels at x 30.
//   G. the ACT block's own name squeeze — `(206 - charoffset) / max(1, width)`
//      clamped into [0.5, 1] — against the bag's `min(1, 200 / width)`, and
//      the fact that the strip NARROWS it.
//
// SABOTAGE-TESTED both directions (see the lane report): exit 1 with the
// `actRows?.[idx]?.actor === CHARTIME_XSLASH` branch removed, exit 0 restored.

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);

/** Numbers are rounded to 3dp so a radian angle reads the same every run. */
const fmt = (x) => {
  if (x && typeof x === 'object') return x.__tag ?? 'canvas';
  return typeof x === 'number' ? String(Math.round(x * 1000) / 1000) : String(x);
};

/**
 * A 2d-context stand-in. `log` receives `name(arg,arg,…)` for every method
 * call, and the VALUE properties are stored on the proxy's own target so a
 * tint canvas can be identified afterwards by the fillStyle that made it.
 */
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

// THE TINT IS THE ASSERTION, so the tint canvases have to be legible. Every
// `tinted()` / `tintedPage()` call builds one of these and paints the colour
// into it as a fillStyle; the tag reports that colour, so a grey head and a
// white head are two different strings in the log instead of both being
// "canvas".
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
const { actsFor } = await import('../../../sim/spells.js');
const { listRows } = await import('../../../sim/menu.js');
const { scrDead } = await import('../../party/damage.js');
const { xslashGridHeads, XSLASH_ACT_INDEX, C_GRAY } = await import('../../party/spells.js');

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

// ── THE FONT ───────────────────────────────────────────────────────────────
// `loadFont` fetches, which node has nothing to answer with, so every
// `drawText` is a no-op here and the label x — half of what this check is
// about — would be invisible. Fill the module's own cache entry instead: one
// uniform 20x20 glyph, shift 20, so `textWidth` is 20 * length and the pen
// starts exactly where the renderer put it.
{
  const font = loadFont();
  const glyphs = [];
  // THE SOURCE X IS THE CHARACTER CODE. drawText blits `(g.x, g.y, g.w, g.h)`
  // out of the page, so stamping the code there makes every glyph draw carry
  // the character it drew — the log can be read back as TEXT, and an
  // assertion can name the string instead of counting blits.
  for (let code = 32; code < 127; code++) glyphs.push({ c: code, x: code, y: 0, w: 20, h: 20, offset: 0, shift: 20 });
  font.meta = { name: 'fnt_stub', glyphs };
  font.glyphs = new Map(glyphs.map((g) => [g.c, g]));
  font.img = { width: 256, height: 256, src: 'stub://font', __tag: 'FONTPAGE' };
  font.ready = true;
}

const SPRITE_IMG = { width: 32, height: 32, src: 'stub://frame', __tag: 'IMG' };
const SPRITE_ENTRY = { frames: [SPRITE_IMG, SPRITE_IMG], meta: { ox: 16, oy: 16, w: 32, h: 32 } };
/** Every sprite resolves, including `spr_tenna_x` — see `missing` below. */
const allSprites = (missing = []) => ({
  get: (name) => (missing.includes(name) ? null : SPRITE_ENTRY),
});

function build(kind) {
  const s = createState({ seed: 12345, traceBulletSlots: 8 });
  if (kind === 'vanilla') buildPracticeScene(s, { seed: 12345 });
  else buildKaizoScene(s, { version: kind });
  return s;
}

/** One press at a human cadence — the grid's `onebuffer` is a real lockout. */
function tap(s, key) {
  stepFrame(s, { ...IDLE, [key]: true });
  stepFrame(s, IDLE);
  for (let i = 0; i < 4; i++) stepFrame(s, IDLE);
}

/**
 * DRIVE THE REAL MENU to Kris's ACT grid with `row` highlighted. Nothing is
 * poked into `menu`: RIGHT lands on the ACT button, the first confirm opens
 * the act's ENEMY PICKER (bmenuno 11) and the second the 2x6 grid (bmenuno 9),
 * which is the two-stage path sim/menu.js models.
 */
function toActGrid(kind, row = XSLASH_ACT_INDEX) {
  const s = build(kind);
  for (let i = 0; i < 8 && !s.menu?.open; i++) stepFrame(s, IDLE);
  if (!s.menu?.open) throw new Error('menu never opened');
  tap(s, 'right');
  tap(s, 'confirm');
  tap(s, 'confirm');
  // The grid is 2 wide: DOWN moves two, RIGHT moves one.
  for (let i = 0; i < 6 && s.menu.gridIndex !== row; i++) {
    if (row - s.menu.gridIndex >= 2) tap(s, 'down');
    else tap(s, 'right');
  }
  s.frame = 200; // past the 11-frame intro rise, so no translate is in play
  return s;
}

/** Paint one frame of the charbox band and hand back the call log. */
function paint(s, missing = []) {
  const log = [];
  drawMenu(mkCtx(log), s, allSprites(missing));
  return log;
}

/**
 * The sprite draws, as `{ x, y, xs, angle, tag }`. drawSpriteExt emits
 * translate / [rotate] / scale / drawImage in that order and nothing else
 * does, so the quadruple is unambiguous.
 */
function spriteDraws(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const t = /^translate\((-?[\d.]+),(-?[\d.]+)\)$/.exec(log[i]);
    if (!t) continue;
    let j = i + 1;
    let angle = 0;
    const r = /^rotate\((-?[\d.]+)\)$/.exec(log[j] ?? '');
    if (r) { angle = Number(r[1]); j += 1; }
    const sc = /^scale\((-?[\d.]+),(-?[\d.]+)\)$/.exec(log[j] ?? '');
    if (!sc) continue;
    const d = /^drawImage\((IMG|canvas|FONTPAGE|TINT\[[^\]]*\]),/.exec(log[j + 1] ?? '');
    if (!d) continue;
    out.push({ x: Number(t[1]), y: Number(t[2]), xs: Number(sc[1]), angle, tag: d[1] });
  }
  return out;
}

/**
 * Every string the frame painted, as `{ x, y, page, text }` — read back out of
 * the glyph blits (see the font stub above). A run breaks on a new y, a new
 * colour page, or an x that jumps backwards or by more than a glyph.
 */
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
/** The grid's own two label columns — the description (496) is not a row. */
const gridLabels = (log) => textRuns(log).filter((r) => r.x < 400);

// ── A. THE GATE, DRIVEN ────────────────────────────────────────────────────
section('A — the gate is CORRECT and we did not touch it (Step_0:1099-1113)');
{
  const s = toActGrid('D');
  eq(s.menu.submenu, 'actgrid', 'two confirms reach the ACT grid (picker, then grid)');
  eq(s.menu.gridIndex, XSLASH_ACT_INDEX, 'the X-Slash row is highlighted');
  const rows = listRows(s);
  eq(rows[XSLASH_ACT_INDEX]?.label, 'X-Slash', 'row 2 of Kris\'s Weird Route ACT list is X-Slash');
  eq(rows[XSLASH_ACT_INDEX]?.cost, 62.5, 'it costs 62.5 TP (25% of 250)');
  eq(actsFor(s, 0)[XSLASH_ACT_INDEX]?.actor, 11, 'and carries actactor 11 through the seam');

  s.tension = 250;
  eq(listRows(s)[XSLASH_ACT_INDEX]?.usable, false,
    'with Noelle STANDING and a full bar the row is still not usable (canpress)');
  const before = s.tension;
  tap(s, 'confirm');
  eq(s.tension, before, 'the confirm charges NOTHING');
  eq(s.menu.submenu, 'actgrid', '...and opens no stage: the grid is still up');

  scrDead(s, 1); // the fight's own pair: HP to the floor, then the five globals
  s.partyHp[1] = -80;
  eq(listRows(s)[XSLASH_ACT_INDEX]?.usable, true,
    'once Noelle is DOWN the same row is usable — the gate is a gate, not a break');
}

// ── B. THE STRIP IS PAINTED ────────────────────────────────────────────────
section('B — the partner strip is drawn beside the X-Slash row (Draw_0:1257-1296)');
const upDraws = (() => {
  const s = toActGrid('D');
  return { s, draws: spriteDraws(paint(s)), log: paint(s) };
})();
{
  const { draws } = upDraws;
  // Row 2 -> i = 1, col = 0, so yoffset 30 and xoffset 0: head (28, 380 + 30).
  const head = draws.filter((d) => d.x === 28 && d.y === 410 && d.xs === 1);
  eq(head.length, 1, 'ONE partner head at (28, 410) — the Weird Route has one partner');
  eq(head[0]?.tag, 'TINT[rgb(128,128,128)]',
    'it is drawn c_gray (8421504) while Noelle is standing');
  const crosses = draws.filter((d) => d.x === 44 && d.y === 421 && d.xs === 0.7);
  eq(crosses.length, 2, 'TWO spr_tenna_x crosses over it at (44, 421), scale 0.7');
  // GameMaker's image_angle is counter-clockwise degrees; drawSpriteExt
  // rotates by -angle * pi / 180.
  eq(crosses.map((c) => c.angle).join(','), '-0.105,-0.07',
    'at 6 and 4 degrees (radians -0.105 / -0.070), in that order');
  eq(crosses.every((c) => c.tag === 'TINT[rgb(128,128,128)]'), true,
    '...and take the SAME blend as the head');

  const labels = gridLabels(upDraws.log);
  const xslashLabel = labels.find((g) => g.y === 405);
  eq(xslashLabel?.text, 'X-Slash', 'the X-Slash label is painted on its own row (y 375 + 30)');
  eq(xslashLabel?.x, 60,
    'and starts at x 60 — `30 + charoffset` with charoffset 30, so the name clears the head');
  eq(xslashLabel?.page, 'TINT[rgb(128,128,128)]', 'the row itself is greyed (cant == 1)');
  const checkLabel = labels.find((g) => g.y === 375);
  eq(checkLabel?.text, 'Check', 'the rows with no marker still paint their own name');
  eq(checkLabel?.x, 30, '...and are NOT shifted: Check still starts at x 30');
  eq(checkLabel?.page, 'TINT[#ffffff]', '...and is white');
}
{
  // THE CROSS IS NOT IN ANY PACK THIS RENDERER CAN REACH YET (spr_tenna_x is a
  // vanilla sprite the kaizo overlay does not carry). A missing sprite must
  // cost the crosses and nothing else — the greyed head is the load-bearing
  // half and has to survive.
  const s = toActGrid('D');
  const draws = spriteDraws(paint(s, ['spr_tenna_x']));
  eq(draws.filter((d) => d.x === 28 && d.y === 410).length, 1,
    'with spr_tenna_x absent the head still draws');
  eq(draws.filter((d) => d.x === 44 && d.y === 421).length, 0,
    '...and the crosses are skipped rather than throwing');
}

// ── C. THE PAINT AGREES WITH kaizo/party/spells.js ─────────────────────────
section('C — what is painted equals xslashGridHeads(state), field for field');
{
  const { s, draws } = upDraws;
  const model = xslashGridHeads(s);
  eq(model.heads.length, 1, 'the kaizo model has one head');
  eq(model.charoffset, 30, 'charoffset 30');
  eq(model.cant, true, 'cant');
  const yoffset = 30; // the X-Slash row is the second row of the grid
  const head = draws.find((d) => d.xs === 1 && d.y === model.heads[0].y + yoffset && d.x === model.heads[0].x);
  ok(!!head, `a head is painted exactly at the model's (${model.heads[0].x}, ${model.heads[0].y} + ${yoffset})`);
  eq(head?.tag, model.heads[0].blend === C_GRAY ? 'TINT[rgb(128,128,128)]' : 'IMG',
    'with the blend the model says (c_gray while she stands)');
  const cross = draws.filter((d) => d.xs === model.heads[0].crosses[0].scale);
  eq(cross.length, model.heads[0].crosses.length, 'as many crosses as the model lists');
  eq(cross.map((c) => Math.round((-c.angle * 180) / Math.PI)).join(','),
    model.heads[0].crosses.map((c) => c.angle).join(','),
    '...at the model\'s angles, converted back to degrees');
  // The strip's sprite: the model names spr_headnoelle, and the renderer
  // resolves the same name through the engine's own party art table.
  eq(model.heads[0].sprite, 'spr_headnoelle', 'the model names Noelle\'s portrait');
}

// ── D. NOELLE DOWN ─────────────────────────────────────────────────────────
section('D — once Noelle is down the strip turns WHITE (-1) and the row unlocks');
{
  const s = toActGrid('D');
  s.tension = 250;
  s.partyHp[1] = -80;
  scrDead(s, 1);
  const log = paint(s);
  const draws = spriteDraws(log);
  const head = draws.filter((d) => d.x === 28 && d.y === 410 && d.xs === 1);
  eq(head.length, 1, 'the head is still drawn — a fallen partner keeps their place in the strip');
  eq(head[0]?.tag, 'IMG', 'UNTINTED: `-1` is white, and a multiply by white is the identity');
  const crosses = draws.filter((d) => d.x === 44 && d.y === 421 && d.xs === 0.7);
  eq(crosses.length, 2, 'the crosses stay');
  eq(crosses.every((c) => c.tag === 'IMG'), true, '...and turn white too');
  const label = gridLabels(log).find((g) => g.y === 405);
  eq(label?.text, 'X-Slash', 'the row is still X-Slash');
  eq(label?.x, 60, 'charoffset is still 30 — it counts the PARTY, not the standing');
  eq(label?.page, 'TINT[#ffffff]', 'and the row is white now: cant is clear');
  eq(xslashGridHeads(s).cant, false, '...which is what the kaizo model says too');
}

// ── E. THE READER GUARD ────────────────────────────────────────────────────
section('E — reader guard: no `actor` marker, no strip (delete the reader and this reddens)');
{
  const withMarker = (() => { const s = toActGrid('D'); return paint(s).join('|'); })();
  const without = (() => {
    const s = toActGrid('D');
    // Through the REAL seam — sim/spells.js's `actsFor` hook, the same one
    // kaizo/party/spells.js installs — with the one field this lane reads
    // taken off every row.
    const inner = s.kaizo.hooks.actList;
    s.kaizo.hooks.actList = (st, slot) => inner(st, slot).map(({ actor, ...rest }) => rest);
    return paint(s).join('|');
  })();
  ok(withMarker !== without,
    'the painted sequence CHANGES when the row stops carrying actactor 11'
    + ` (${withMarker.split('|').length} vs ${without.split('|').length} calls)`);
  ok(withMarker.includes('translate(28,410)'), '...with the marker there is a head at (28, 410)');
  ok(!without.includes('translate(28,410)'), '...and without it there is none');
}

// ── F. THE A-SIDE IS UNTOUCHED ─────────────────────────────────────────────
section('F — V-C and vanilla paint no strip (no row there carries a marker)');
for (const kind of ['C', 'vanilla']) {
  const s = toActGrid(kind, 0);
  const log = paint(s);
  eq(s.menu.submenu, 'actgrid', `${kind}: the ACT grid opens`);
  const marked = (actsFor(s, 0) ?? []).filter((a) => a?.actor != null);
  eq(marked.length, 0, `${kind}: no ACT row carries an actactor marker`);
  const strip = spriteDraws(log).filter((d) => d.x === 28 || d.x === 44);
  eq(strip.length, 0, `${kind}: nothing is painted in the strip's columns`);
  const labels = gridLabels(log);
  ok(labels.length > 0, `${kind}: the grid paints labels at all (${labels.map((l) => l.text).join(' / ')})`);
  eq(labels.every((g) => g.x === 30 || g.x === 260), true,
    `${kind}: every label starts at the unshifted 30 / 260`);
}

// ── G. THE ACT BLOCK'S OWN SQUEEZE ─────────────────────────────────────────
section('G — the ACT grid squeezes on its own terms (Draw_0:1314-1325)');
{
  // The bag's rule is `min(1, 200 / width)` with no floor; the ACT block's is
  // `(206 - charoffset) / max(1, width)` clamped into [0.5, 1]. The two differ
  // for any name wider than the column, and the ACT one NARROWS by every
  // portrait drawn beside it — which is the whole reason charoffset exists.
  // The stub font advances 20 per character, so the pen step IS 20 * xscale.
  const named = (name, row = 0) => {
    const s = toActGrid('D', row);
    const inner = s.kaizo.hooks.actList;
    s.kaizo.hooks.actList = (st, slot) => inner(st, slot)
      .map((a, i) => (i === row ? { ...a, name } : a));
    const run = gridLabels(paint(s)).find((r) => r.text.startsWith(name[0]));
    return run ? Math.round(((run.lastX - run.x) / (run.text.length - 1)) * 1000) / 1000 : null;
  };
  // 20 characters -> width 400. ACT: 206/400 = 0.515 -> step 10.3.
  //                             bag: 200/400 = 0.5   -> step 10.
  eq(named('A'.repeat(20)), 10.3, "a 20-char ACT name steps 10.3 (206 / 400), not the bag's 10");
  // 40 characters -> width 800. ACT: 206/800 = 0.2575, CLAMPED to 0.5 -> 10.
  //                             bag: 200/800 = 0.25 -> 5.
  eq(named('B'.repeat(40)), 10, "a 40-char name hits the ACT block's 0.5 floor, which the bag has not");
  // ...AND THE STRIP NARROWS IT: 12 chars -> width 240, and on the X-Slash row
  // the column is 206 - 30. 176/240 = 0.7333 against 206/240 = 0.8583.
  eq(named('Z'.repeat(12), XSLASH_ACT_INDEX), 14.667,
    'on the X-Slash row the column is 206 - charoffset = 176 wide');
  eq(named('Z'.repeat(12), 0), 17.167, '...and 206 wide on a row with no strip');
}

console.log(`\ncheck-xslash-heads: ${count - failed}/${count} assertions passed`);
process.exit(failed ? 1 : 0);
