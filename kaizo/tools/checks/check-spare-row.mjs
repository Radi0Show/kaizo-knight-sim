#!/usr/bin/env node
// SPARE — bmenuno 12, the fifth branch of the enemy row.
//
//   node kaizo/tools/checks/check-spare-row.mjs
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
//
// Driven through the real menu, SPARE produces `stages = [row]` on BOTH routes
// — no submenu, no message, no mercy attempt, 0 TP charged, `charaction` left
// at 0 — so this is not a Weird Route bug. The button has never done anything.
//
// THE GAME MAKES IT A TWO-PRESS COMMAND, exactly like FIGHT. The button opens
// `global.bmenuno = 12`, a TARGET STAGE drawn by the very same block as the
// enemy row (`if (global.bmenuno == 1 || == 3 || == 11 || == 12 || == 13)`,
// gml_Object_obj_battlecontroller_Draw_0.gml:673), and that row's own confirm
// is what commits the attempt:
//
//     if (global.bmenuno == 12)
//     {
//         global.faceaction[global.charturn] = 10;
//         global.chartarget[global.charturn] = global.bmenucoord[12][global.charturn];
//         global.charaction[global.charturn] = 2;
//         global.charspecial[global.charturn] = 100;
//         scr_nexthero();
//     }
//     (gml_Object_obj_battlecontroller_Step_0.gml:1421-1428)
//
// **THIS LANE OWNS THE DRAW HALF ONLY.** The stage itself is `sim/menu.js`'s —
// the button-row confirm handler and a `'spare'` arm beside `'enemy'` /
// `'actpick'` / `'spellenemy'` — and that file belongs to another lane. What
// landed here is the branch that paints it: `render/menu.js`'s submenu
// dispatch had four names in the enemy-row arm and the game's test has five.
//
// So the last assertion below is the one that matters for the handover: the
// submenu SPARE's confirm leaves the menu in must be one the renderer can
// draw. It holds today (the confirm opens nothing, and the button row draws)
// and it will still hold when the stage lands as `'spare'` — and it goes RED
// the moment the stage lands under a name the dispatch has never heard of,
// which is exactly how `spellenemy` shipped invisible for five engine
// versions and read from play as a dropped keypress.
//
// ── THE ASSERTIONS (all positive) ──────────────────────────────────────────
//   A. SPARE is really the fourth button, on both routes, and pressing it is
//      driven: what it does today is measured and named.
//   B. `spare` DRAWS: its canvas call sequence equals the enemy row's and is
//      not the unhandled-submenu fallback, with no warning logged.
//   C. every submenu sim/menu.js can set has a draw branch — the sweep that
//      would have caught `spellenemy`, now including `spare`.
//   D. whatever stage the SPARE button opens is drawable. Forward-safe for
//      lane 1.
//
// SABOTAGE-TESTED: exit 1 with `|| menu.submenu === 'spare'` removed from the
// dispatch, exit 0 restored (see the lane report).

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);

const mkCtx = (log = null) => new Proxy({}, {
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
    return (...args) => { if (log) log.push(p); return undefined; };
  },
  set(t, p, v) { t[p] = v; return true; },
});
globalThis.document = {
  createElement: (tag) => (tag === 'canvas'
    ? { width: 0, height: 0, style: {}, getContext: () => mkCtx() }
    : {}),
};
globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;

const { createState, stepFrame } = await import('../../../sim/index.js');
const { buildPracticeScene } = await import('../../../sim/scenes/practice.js');
const { buildKaizoScene } = await import('../../scenes/kaizo-fight.js');
const { drawMenu } = await import('../../../render/menu.js');
const { BUTTONS } = await import('../../../sim/menu.js');
const { loadFont } = await import('../../../render/font.js');

// The lists paint nothing without art or a font, and "nothing" is what the
// fallback arm paints too — so an unstubbed harness would report three real
// branches as missing. One fake sprite entry and one stub font make the
// sequences distinguishable.
{
  const font = loadFont();
  const glyphs = [];
  for (let code = 32; code < 127; code++) glyphs.push({ c: code, x: code, y: 0, w: 20, h: 20, offset: 0, shift: 20 });
  font.meta = { name: 'fnt_stub', glyphs };
  font.glyphs = new Map(glyphs.map((g) => [g.c, g]));
  font.img = { width: 256, height: 256, src: 'stub://font' };
  font.ready = true;
}
const SPRITE_IMG = { width: 32, height: 32, src: 'stub://frame' };
const SPRITES = { get: () => ({ frames: [SPRITE_IMG, SPRITE_IMG], meta: { ox: 16, oy: 16, w: 32, h: 32 } }) };

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

const SPARE_BUTTON = BUTTONS.findIndex((b) => b.name === 'SPARE');

/** Drive the button row onto SPARE and confirm. Nothing is poked into state. */
function pressSpare(kind) {
  const s = build(kind);
  for (let i = 0; i < 8 && !s.menu?.open; i++) stepFrame(s, IDLE);
  if (!s.menu?.open) throw new Error('menu never opened');
  s.tension = 250;
  for (let i = 0; i < SPARE_BUTTON; i++) tap(s, 'right');
  const before = { tension: s.tension, charturn: s.menu.charturn };
  tap(s, 'confirm');
  return {
    s,
    selected: s.menu.selected[before.charturn],
    stage: s.menu.open ? (s.menu.submenu ?? 'row') : 'closed',
    charged: before.tension - s.tension,
    charaction: s.charaction?.[before.charturn] ?? 0,
    advanced: s.menu.charturn !== before.charturn,
  };
}

// ── A. WHAT SPARE DOES TODAY ───────────────────────────────────────────────
section('A — SPARE, driven on both routes');
eq(SPARE_BUTTON, 3, 'SPARE is the fourth button (scr_charbox\'s x 120 slot)');
for (const kind of ['C', 'D', 'vanilla']) {
  const r = pressSpare(kind);
  eq(r.selected, SPARE_BUTTON, `${kind}: three RIGHTs land on SPARE`);
  // MEASURED, not asserted-as-correct: the stage the game opens is bmenuno 12
  // and sim/menu.js has no such stage yet, so the confirm passes the turn on.
  // When lane 1 lands it this becomes 'spare' and section D still holds.
  console.log(`       ${kind}: confirm -> stage=${r.stage} charged=${r.charged}`
    + ` charaction=${r.charaction} advanced=${r.advanced}`);
  eq(r.charged, 0, `${kind}: SPARE charges no TP (Step_0:1421-1428 charges none either)`);
}

// ── B. THE DRAW BRANCH ─────────────────────────────────────────────────────
section('B — `spare` draws the enemy row (Draw_0:673 lists bmenuno 12)');

/** One painted frame with the menu forced into `submenu`. */
function drawWith(submenu, kind = 'D') {
  const s = build(kind);
  for (let i = 0; i < 8 && !s.menu?.open; i++) stepFrame(s, IDLE);
  s.tension = 250;
  s.menu.open = true;
  s.menu.charturn = 0;
  s.menu.submenu = submenu;
  s.menu.gridIndex = 0;
  s.menu.targetIndex = 0;
  s.frame = 200;
  const log = [];
  const warned = [];
  const realErr = console.error;
  console.error = (...a) => { warned.push(a.join(' ')); };
  try {
    drawMenu(mkCtx(log), s, SPRITES);
  } finally {
    console.error = realErr;
  }
  return { calls: log.join(','), warned };
}

const enemyRow = drawWith('enemy');
const spareRow = drawWith('spare');
const fallback = drawWith('__no_such_submenu__');
ok(enemyRow.calls.length > 0, 'the enemy row issues canvas calls at all');
ok(spareRow.calls === enemyRow.calls,
  'spare draws the SAME call sequence as the enemy row'
  + ` — ${spareRow.calls.split(',').length} vs ${enemyRow.calls.split(',').length} calls`);
ok(spareRow.calls !== fallback.calls,
  'spare does NOT fall through to the unhandled-submenu arm');
eq(spareRow.warned.length, 0, 'no "no branch draws submenu" warning for spare');
ok(fallback.warned.some((w) => /no branch draws submenu/.test(w)),
  '...and the warning still fires for a name the dispatch really does not know');

// ── C. EVERY SUBMENU THE SIM CAN SET ───────────────────────────────────────
section('C — no submenu sim/menu.js names falls into the fallback');
const SUBMENUS = ['enemy', 'magic', 'item', 'actgrid', 'target', 'spellenemy', 'actpick'];
for (const name of SUBMENUS) {
  const r = drawWith(name);
  ok(r.calls !== fallback.calls && r.warned.length === 0, `submenu '${name}' has a draw branch`);
}
{
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const src = readFileSync(fileURLToPath(new URL('../../../sim/menu.js', import.meta.url)), 'utf8');
  const found = new Set();
  for (const m of src.matchAll(/submenu === '([a-z]+)'/g)) found.add(m[1]);
  for (const m of src.matchAll(/submenu = '([a-z]+)'/g)) found.add(m[1]);
  for (const m of src.matchAll(/\? '([a-z]+)' : '([a-z]+)'/g)) { found.add(m[1]); found.add(m[2]); }
  const extra = [...found].filter((n) => !SUBMENUS.includes(n) && n !== 'spare');
  eq(extra.join(','), '', 'sim/menu.js names no submenu this check has not covered');
}

// ── D. THE HANDOVER GUARD ──────────────────────────────────────────────────
section('D — whatever stage SPARE opens must be drawable (forward-safe)');
for (const kind of ['C', 'D', 'vanilla']) {
  const r = pressSpare(kind);
  if (r.stage === 'row' || r.stage === 'closed') {
    // No stage yet: the band paints the button row / battle message, which is
    // a branch, not the fallback. Assert THAT rather than nothing.
    const painted = drawWith(null, kind === 'vanilla' ? 'vanilla' : kind);
    ok(painted.warned.length === 0 && painted.calls.length > 0,
      `${kind}: SPARE opens no stage yet (${r.stage}) and the band still paints`);
  } else {
    const painted = drawWith(r.stage, kind === 'vanilla' ? 'vanilla' : kind);
    ok(painted.calls !== fallback.calls && painted.warned.length === 0,
      `${kind}: SPARE's stage '${r.stage}' has a draw branch`);
  }
}

console.log(`\ncheck-spare-row: ${count - failed}/${count} assertions passed`);
process.exit(failed ? 1 : 0);
