#!/usr/bin/env node
// THE SPELL'S ENEMY ROW — the confirm COUNT end to end, and the fact that
// something actually draws the stage the third confirm sits in.
//
//   node kaizo/tools/checks/check-spellenemy-row.mjs
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
//
// REPORTED FROM PLAY (2026-09-10): "Susie has to press Enter an extra time
// when selecting Rude Buster." Measured rather than reasoned about, and the
// count turned out to be RIGHT on every version — vanilla practice, V-C and
// V-D all take exactly three confirms, which is what the game takes:
//
//   gml_Object_obj_battlecontroller_Step_0.gml
//     :288-…    bmenuno 0, the button row — MAGIC opens bmenuno 2
//     :632-651  bmenuno 2, the MAGIC grid — `scr_spellinfo(...)` then
//                 spelltarget 0 -> scr_spellconsumeb()   (cast now)
//                 spelltarget 1 -> global.bmenuno = 8    (the ally picker)
//                 spelltarget 2 -> global.bmenuno = 3    (the ENEMY row)
//     :1160-1215 bmenuno 3's own confirm — this is where the TP is charged
//   gml_GlobalScript_scr_spellinfo.gml :55  Rude Buster IS spelltarget 2
//
// So the third press is the enemy row's, and it is not optional. What was
// wrong was that NOTHING DREW IT. `render/menu.js`'s submenu dispatch is an
// if/else-if chain over the sim's submenu names, and `spellenemy` — added to
// sim/menu.js by engine v1.0.24 — matched no arm, so it fell through to the
// final else and drew the battle message. The button row is hidden the moment
// `menu.submenu` is truthy, so choosing Rude Buster took the MAGIC grid away
// and put nothing in its place. An accepted press that changes nothing on
// screen reads as a dropped one.
//
// The game has no such gap: one test covers five bmenunos —
//
//     if (global.bmenuno == 1 || global.bmenuno == 3 || global.bmenuno == 11
//         || global.bmenuno == 12 || global.bmenuno == 13)
//     (gml_Object_obj_battlecontroller_Draw_0.gml:673)
//
// — heart, name, HP bar. 3 is the spell's row and it draws exactly like 1.
//
// ── WHY A CHECK AND NOT A COMMENT ──────────────────────────────────────────
//
// render/menu.js already carried a `console.error` for an unhandled submenu,
// written when ACT's two stages were renamed. It could not catch this,
// because nothing under render/ is exercised by either gate: the warning went
// to a browser console nobody had open for five engine versions. So this
// asserts the dispatch from the OUTSIDE — real renderer, stub canvas, canvas
// call sequences compared — and it asserts it for EVERY submenu sim/menu.js
// can set, so the next stage that gets added cannot repeat the mistake.
//
// THE ENGINE FIX lives in knight-sim, branch `kaizo-menu2-seams`, commit
// 141341d (v1.0.35); render/menu.js here is a labelled stand-in carrying it
// until the next `npm run vendor:engine`. See that file's banner.
//
// ── THE ASSERTIONS (all positive; sabotage below) ───────────────────────────
//   A. the confirm COUNT, driven through the real menu on all three builds:
//      vanilla practice, V-C and V-D each take exactly 3 confirms from the
//      button row to the TP being charged, at every press cadence a human can
//      produce, and the SUB-STATE PATH is named at each step.
//   B. Rude Buster's row through the seam is the dump's: cost 125,
//      spelltarget 2 — on vanilla AND on V-C (which installs no hooks), so a
//      kaizo table cannot silently refuse the confirm.
//   C. the renderer draws `spellenemy` as the enemy row: its canvas call
//      sequence equals `enemy`'s and differs from the unhandled fallback's.
//   D. NO submenu sim/menu.js can set falls into the fallback arm.

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);

/** A 2d-context stand-in; `log` receives the NAME of every method called. */
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
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    const c = { width: 0, height: 0, style: {} };
    c.getContext = () => mkCtx();
    return c;
  },
};
globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;

const { createState, stepFrame } = await import('../../../sim/index.js');
const { buildPracticeScene } = await import('../../../sim/scenes/practice.js');
const { buildKaizoScene } = await import('../../scenes/kaizo-fight.js');
const simSpells = await import('../../../sim/spells.js');
const { drawMenu } = await import('../../../render/menu.js');
const { createRenderer } = await import('../../../render/canvas.js');

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

/**
 * ONE PRESS AT A HUMAN CADENCE: a frame with the key down, a frame with it up,
 * then `gap` idle frames. `gap` is swept because `onebuffer` is a real
 * lockout — the four GRID confirms set it to 2, two frames (engine v1.0.26) —
 * and a press INSIDE that window is genuinely refused by the game too. The
 * count this check pins is the one a player produces, not a mash.
 */
function pressToCast(kind, gap) {
  const s = build(kind);
  for (let i = 0; i < 6 && !(s.menu && s.menu.open); i += 1) stepFrame(s, IDLE);
  if (!s.menu?.open) return { error: 'menu never opened' };
  // A full bar: the MAGIC confirm only proceeds `if (spellcost <= tension)`
  // (Step_0:634), and a refusal there looks exactly like a dropped input.
  s.tension = 250;
  const tap = (key) => {
    stepFrame(s, { ...IDLE, [key]: true });
    stepFrame(s, IDLE);
    for (let i = 0; i < gap; i += 1) stepFrame(s, IDLE);
  };
  // Kris first — FIGHT opens the enemy row, confirming it hands the turn on.
  let guard = 0;
  while (s.menu.open && s.menu.charturn === 0 && guard < 12) { guard += 1; tap('confirm'); }
  if (!s.menu.open) return { error: 'menu closed during slot 0' };
  tap('right');              // the button row's second slot: MAGIC
  const before = s.tension;
  const path = [];
  for (let n = 1; n <= 12; n += 1) {
    tap('confirm');
    path.push(s.menu.open ? (s.menu.submenu ?? 'row') : 'closed');
    if (s.tension !== before) return { confirms: n, path, charged: before - s.tension };
    if (!s.menu.open) return { confirms: n, path, charged: 0, error: 'closed, nothing charged' };
  }
  return { error: 'never charged in 12 confirms', path };
}

// ── A. THE CONFIRM COUNT, END TO END, ON ALL THREE BUILDS ──────────────────
section('A — the confirm count (the count IS the assertion)');
// V-D's slot 1 is NOELLE, so her first MAGIC row is Heal Prayer (spelltarget 1,
// the ALLY picker) — a different third stage, the same three presses.
const EXPECT = {
  vanilla: { confirms: 3, path: ['magic', 'spellenemy', 'row'], charged: 125 },
  C: { confirms: 3, path: ['magic', 'spellenemy', 'row'], charged: 125 },
  D: { confirms: 3, path: ['magic', 'target', 'closed'], charged: 80 },
};
for (const kind of ['vanilla', 'C', 'D']) {
  const want = EXPECT[kind];
  for (const gap of [1, 2, 3, 4, 6, 8, 12]) {
    const r = pressToCast(kind, gap);
    ok(!r.error, `${kind} gap=${gap}: reached the cast (${r.error ?? 'ok'})`);
    eq(r.confirms, want.confirms, `${kind} gap=${gap}: confirms to cast`);
    eq((r.path ?? []).join('>'), want.path.join('>'), `${kind} gap=${gap}: sub-state path`);
    eq(r.charged, want.charged, `${kind} gap=${gap}: TP charged`);
  }
}
// ...and the count is NOT vacuous: pressed with no gap at all, the engine's
// own two-frame grid lockout (onebuffer = 2) really does eat a press, so a
// harness that mashed would measure 4 and this check would be measuring the
// lockout instead of the menu.
{
  const r = pressToCast('C', 0);
  eq(r.confirms, 4, 'V-C at gap=0: the onebuffer lockout costs one press (the sweep above is not vacuous)');
}

// ── B. RUDE BUSTER THROUGH THE SEAM ────────────────────────────────────────
section('B — scr_spellinfo:55 — Rude Buster is spelltarget 2, cost 125');
for (const kind of ['vanilla', 'C']) {
  const s = build(kind);
  stepFrame(s, IDLE);
  const info = simSpells.spellInfo(s, 4);
  eq(info?.name, 'Rude Buster', `${kind}: spell id 4 is Rude Buster`);
  eq(info?.target, 2, `${kind}: spelltarget 2 — the enemy row, not an instant cast`);
  eq(simSpells.spellCost(s, 1, 4), 125, `${kind}: cost 125 through the seam`);
  eq(JSON.stringify(simSpells.spellListFor(s, 1)), '[4,11]', `${kind}: slot 1 lists Rude Buster / UltraHeal`);
}
{
  // V-C must install NO menu hooks — the A-Side keeps the vanilla slot tables,
  // so no kaizo row can quietly change the cost or the target.
  const c = build('C');
  stepFrame(c, IDLE);
  const h = c.kaizo?.hooks ?? {};
  ok(!h.spellInfo && !h.spellList && !h.spellCost,
    'V-C installs none of the character-table hooks (the kaizo seam cannot refuse the confirm)');
}

// ── C + D. THE RENDERER DRAWS THE STAGE ────────────────────────────────────
section('C/D — render/menu.js draws every submenu the sim can set');

const canvas = { width: 640, height: 480, style: {}, getContext: () => mkCtx() };
const renderer = await createRenderer(canvas, {});
const fakeImg = { width: 32, height: 32, src: 'stub://frame' };
const fakeEntry = { frames: [fakeImg, fakeImg], meta: { ox: 16, oy: 16, w: 32, h: 32 } };
const realGet = renderer.sprites.get.bind(renderer.sprites);
renderer.sprites.get = (name) => realGet(name) ?? fakeEntry;

/** Draw one frame of the charbox row with the menu forced into `submenu`. */
function drawWith(submenu) {
  const s = build('C');
  stepFrame(s, IDLE);
  s.tension = 250;
  s.menu.open = true;
  s.menu.charturn = 1;
  s.menu.submenu = submenu;
  s.menu.gridIndex = 0;
  s.menu.pending = submenu === 'spellenemy' ? { kind: 'spell', id: 4, from: 'magic' } : null;
  // Past the 11-frame intro rise, so the panel translate cannot differ.
  s.frame = 200;
  const log = [];
  drawWith.warned = [];
  const realErr = console.error;
  console.error = (...a) => { drawWith.warned.push(a.join(' ')); };
  try {
    drawMenu(mkCtx(log), s, renderer.sprites);
  } finally {
    console.error = realErr;
  }
  return { calls: log.join(','), warned: drawWith.warned.slice() };
}

const enemyRow = drawWith('enemy');
const spellRow = drawWith('spellenemy');
// The fallback arm, reached only by a name the dispatch does not know. This is
// the SHAPE the bug produced, and it must not be what `spellenemy` produces.
const fallback = drawWith('__no_such_submenu__');

ok(enemyRow.calls.length > 0, 'the enemy row issues canvas calls at all');
// The sequences are hundreds of calls long; print the LENGTHS, not the text.
ok(spellRow.calls === enemyRow.calls,
  'spellenemy draws the SAME call sequence as the enemy row (bmenuno 3 == bmenuno 1, Draw_0:673)'
  + ` — ${spellRow.calls.split(',').length} vs ${enemyRow.calls.split(',').length} calls`);
ok(spellRow.calls !== fallback.calls,
  'spellenemy does NOT draw the unhandled-submenu fallback (the battle message over an empty band)');
eq(spellRow.warned.length, 0, 'no "no branch draws submenu" warning for spellenemy');
ok(fallback.warned.some((w) => /no branch draws submenu/.test(w)),
  '...and the warning still fires for a name the dispatch really does not know (the probe is live)');

// EVERY submenu sim/menu.js can assign. Hardcoding this list is the point:
// it is the thing a new stage must be added to, and the assertion below is
// what makes forgetting loud.
// `spare` JOINED THE LIST when sim/menu.js grew SPARE's target stage — the
// coverage guard below caught the new name the same session it appeared,
// which is what it is for. render/menu.js had drawn that row all along
// (its arm keys on the same five bmenunos the game tests together); what
// was missing was the sim stage, so this now asserts BOTH halves exist.
const SUBMENUS = ['enemy', 'magic', 'item', 'actgrid', 'target', 'spellenemy', 'actpick', 'spare'];
for (const name of SUBMENUS) {
  const r = drawWith(name);
  ok(r.calls !== fallback.calls && r.warned.length === 0,
    `submenu '${name}' has a draw branch`);
}
// The list is the sim's, not a guess: every name here must actually appear in
// sim/menu.js, and every quoted assignment there must be in this list.
{
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const src = readFileSync(fileURLToPath(new URL('../../../sim/menu.js', import.meta.url)), 'utf8');
  const found = new Set();
  for (const m of src.matchAll(/submenu === '([a-z]+)'/g)) found.add(m[1]);
  for (const m of src.matchAll(/submenu = '([a-z]+)'/g)) found.add(m[1]);
  for (const m of src.matchAll(/\? '([a-z]+)' : '([a-z]+)'/g)) { found.add(m[1]); found.add(m[2]); }
  const extra = [...found].filter((n) => !SUBMENUS.includes(n));
  eq(extra.join(','), '', 'sim/menu.js names no submenu this check has not covered');
  const missing = SUBMENUS.filter((n) => !found.has(n));
  eq(missing.join(','), '', 'every submenu this check covers is really one sim/menu.js uses');
}

console.log(`\ncheck-spellenemy-row: ${count - failed}/${count} assertions passed`);
process.exit(failed ? 1 : 0);
