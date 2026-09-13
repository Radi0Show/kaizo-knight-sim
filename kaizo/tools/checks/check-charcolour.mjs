#!/usr/bin/env node
// NOELLE IS NOT SUSIE — the party HUD's colour, name plate and portrait.
//
//   node kaizo/tools/checks/check-charcolour.mjs
//
// THE REPORT, in the player's words: "noelle should have her correct colors
// and stuff ... it looks like she just has susies right now."
//
// THE CAUSE. `global.hpcolor[]` is CHARACTER-indexed and four long; this
// engine carried it as a THREE-entry SLOT table, twice over (sim/menu.js's
// CHAR_COLOR and render/fightbar.js's CHARCOLOR), plus a third slot-shaped
// copy of the portraits and name plates in PARTY_SPRITES. For the vanilla
// trio `slot` and `charId - 1` are the same number, so nothing ever showed.
// `scr_fixparty` packs a Kris+Noelle party as `global.char = [1, 4, 0]`, so
// Noelle stands in SLOT 1 — Susie's row in every one of those tables.
//
// THE GML, all of it, and every number below is re-derived from these here
// rather than copied out of the module under test:
//
//   gml_Object_obj_battlecontroller_Create_0.gml:244-247
//        hpcolor[0] = c_aqua;  [1] = c_fuchsia;  [2] = c_lime;
//        hpcolor[3] = c_yellow;                  <- NOELLE
//   gml_GlobalScript_scr_charbox.gml:18-37
//        for (c = 0; c < 4; c++) if (havechar[c] == 1) charcolor = hpcolor[c];
//        -- `c` is charId-1: the SLOT arrives separately as charpos[c], and
//        the same loop reads global.hp[c + 1]. THIS is what proves the
//        indexing is by character.
//   gml_Object_obj_attackpress_Create_0.gml:66-68
//        charcolor[0..2] = 16776960 / 16711935 / 65280   <- only THREE, and
//        scr_boltcheck.gml:53 reads charcolor[arg0] with arg0 the SLOT.
//        ORIGINAL BEHAVIOUR: the burst ring on slot 1 is fuchsia for whoever
//        stands there, Noelle included. Not a bug to fix.
//   gml_Object_obj_attackpress_Draw_0.gml:44-99
//        j = global.char[i];  j==1 blue / 2 purple / 3 green / 4 YELLOW;
//        draw_sprite(spr_pressfront, j - 1, ...) and spr_pressspot, j - 1.
//   gml_Object_obj_battlecontroller_Draw_0.gml:1362-1376
//        for (i = 0; i < 3; i++) if (global.char[i] != 0) { ... }
//        draw_text(..., global.charname[global.char[i]])
//        -- the ally picker is GUARDED, not shortened: a two-member party
//        draws two rows, and it names the CHARACTER.
//   gml_GlobalScript_scr_initialize_charnames.gml:8
//        global.charname[4] = "Noelle"
//
// The mod changes NONE of it: `diff gml_vanilla_v105 gml_kaizo_dump` is empty
// for obj_battlecontroller's Create and obj_attackpress's Create, and touches
// scr_charbox only to add the B-Side gloom band.
//
// GAMEMAKER PACKS COLOURS BGR. c_yellow is the constant 65535 = 0x00FFFF,
// which is B=0x00 G=0xFF R=0xFF -> RGB(255, 255, 0). Read as RGB it would be
// cyan — a plausible wrong answer that no eye would flag — so L1 decodes the
// raw constants here and compares, instead of trusting the table's comments.
//
// ── WHAT THIS CHECK IS FOR ────────────────────────────────────────────────
//
// This repo's signature defect is a value computed correctly and written
// where nothing reads it (CLAUDE.md's standing hazard; `hooks.actBusy` is the
// tenth instance). So L6 is a READER GUARD and it is the point of the file:
// it renders the SAME fight twice, once with `state.partyCharIds = [1,4,0]`
// and once with the vanilla [1,2,3], and REQUIRES the painted pixels to
// differ on every surface. Delete any one of the four call sites and the two
// renders collapse into each other and this check goes red — which a check
// that only asserted "HPCOLOR[3] is yellow" never would.
//
// SABOTAGE-TESTED 2026-09-12, both directions, exit codes in the lane report.

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);

/**
 * A 2d-context stand-in that records `fillRect` with the `fillStyle` in
 * force, `strokeRect` with the `strokeStyle` (the fight bar's row outline is
 * a stroke, not a fill — see render/fightbar.js's `outlineRect`), and every
 * `drawImage` with the tag its source image carries.
 *
 * The transform is tracked through save/restore/translate/setTransform
 * because drawMenu lays the charbox out under a `setTransform` plus the
 * intro-rise `translate`, and drawSpriteExt translates to the draw position
 * before blitting — so a recorder that ignored it reports every coordinate
 * somewhere else entirely.
 */
function mkRecCtx(rec) {
  const st = { fillStyle: '', strokeStyle: '', tx: 0, ty: 0, stack: [] };
  return new Proxy({}, {
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
      if (p === 'fillStyle') return st.fillStyle;
      if (p === 'strokeStyle') return st.strokeStyle;
      if (VALUE_PROPS.has(p)) return t[p] ?? '';
      if (typeof p !== 'string') return undefined;
      return (...args) => {
        if (p === 'save') st.stack.push([st.tx, st.ty]);
        else if (p === 'restore') { const s = st.stack.pop(); if (s) { [st.tx, st.ty] = s; } }
        else if (p === 'translate') { st.tx += args[0]; st.ty += args[1]; }
        else if (p === 'setTransform') { st.tx = args[4] ?? 0; st.ty = args[5] ?? 0; }
        if (p === 'fillRect') {
          rec.push({
            op: 'fillRect', style: String(st.fillStyle),
            x: args[0] + st.tx, y: args[1] + st.ty, w: args[2], h: args[3],
          });
        } else if (p === 'strokeRect') {
          rec.push({
            op: 'strokeRect', style: String(st.strokeStyle),
            x: args[0] + st.tx, y: args[1] + st.ty, w: args[2], h: args[3],
          });
        } else if (p === 'drawImage') {
          rec.push({
            op: 'drawImage', tag: args[0]?.__tag ?? null,
            x: st.tx, y: st.ty,
          });
        }
        return undefined;
      };
    },
    set(t, p, v) {
      if (p === 'fillStyle') { st.fillStyle = v; return true; }
      if (p === 'strokeStyle') { st.strokeStyle = v; return true; }
      t[p] = v; return true;
    },
  });
}

// An offscreen canvas that carries the tag of whatever was blitted into it,
// so a sprite that goes through `tinted()` is still identifiable. (c_white is
// tinted()'s identity and comes back as the image itself, but the party
// portraits and the plates take `null`, and neither path may be assumed.)
globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    const c = { width: 0, height: 0, style: {} };
    c.getContext = () => new Proxy({}, {
      get(t, p) {
        if (p === 'canvas') return c;
        if (p === 'measureText') return () => ({ width: 10 });
        if (p === 'getImageData' || p === 'createImageData') {
          return (a, b, w, h) => {
            const W = (p === 'createImageData' ? a : w) || 1;
            const H = (p === 'createImageData' ? b : h) || 1;
            return { data: new Uint8ClampedArray(W * H * 4), width: W, height: H };
          };
        }
        if (p === 'createLinearGradient' || p === 'createRadialGradient') {
          return () => ({ addColorStop: noop });
        }
        if (p === 'createPattern') return () => ({});
        if (VALUE_PROPS.has(p)) return t[p] ?? '';
        if (typeof p !== 'string') return undefined;
        return (...args) => {
          if (p === 'drawImage' && args[0]?.__tag) c.__tag = args[0].__tag;
          return undefined;
        };
      },
      set(t, p, v) { t[p] = v; return true; },
    });
    return c;
  },
};
globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;

const { readFileSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const { dirname, join } = await import('node:path');
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const { createState, stepFrame } = await import('../../../sim/index.js');
const { PARTY } = await import('../../../sim/damage.js');
const { createFightBar } = await import('../../../sim/fightbar.js');
const {
  HPCOLOR, CHAR_COLOR, CHARBOX_ART, PARTY_SPRITES,
  charIdForSlot, charColorFor, partyArtFor, partyNameFor, slotOccupied,
} = await import('../../../sim/menu.js');
const { buildKaizoScene } = await import('../../scenes/kaizo-fight.js');
const { createRenderer } = await import('../../../render/canvas.js');
const { KAIZO_DRAW_OVERRIDES } = await import('../../render/index.js');
const { NOELLE_STATS } = await import('../../party/noelle.js');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** `make_color_bgr` inverted: a GameMaker colour constant -> [r, g, b]. */
const fromBGR = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// The four constants, written as GameMaker stores them.
const C_AQUA = 16776960; // 0xFFFF00
const C_FUCHSIA = 16711935; // 0xFF00FF
const C_LIME = 65280; // 0x00FF00
const C_YELLOW = 65535; // 0x00FFFF
const C_PURPLE = 8388736; // 0x800080
const NOELLE_CSS = css(fromBGR(C_YELLOW));
const SUSIE_CSS = css(fromBGR(C_FUCHSIA));

console.log('L1 — the table: four rows, character-indexed, BGR-decoded');
{
  ok(HPCOLOR.length === 4,
    `hpcolor[] has FOUR entries, one per character (got ${HPCOLOR.length})`);
  ok(eq(HPCOLOR[0], fromBGR(C_AQUA)), 'hpcolor[0] = c_aqua  -> RGB(0,255,255)   [Kris]');
  ok(eq(HPCOLOR[1], fromBGR(C_FUCHSIA)), 'hpcolor[1] = c_fuchsia -> RGB(255,0,255) [Susie]');
  ok(eq(HPCOLOR[2], fromBGR(C_LIME)), 'hpcolor[2] = c_lime -> RGB(0,255,0)       [Ralsei]');
  ok(eq(HPCOLOR[3], fromBGR(C_YELLOW)),
    `hpcolor[3] = c_yellow -> RGB(255,255,0) [NOELLE] (got ${JSON.stringify(HPCOLOR[3])})`);
  // The decode is not vacuous: c_yellow read the WRONG way round is cyan, and
  // cyan is already Kris's row — so a reversed decode would silently make
  // Noelle look like Kris instead of like Susie.
  ok(!eq(fromBGR(C_YELLOW), [...fromBGR(C_YELLOW)].reverse()),
    'and c_yellow is ASYMMETRIC under BGR/RGB, so the decode direction is observable');

  // ONE TABLE, NOT TWO. Identity, not deep equality: a second literal that
  // happens to hold the same three rows is exactly the failure this file
  // exists to prevent.
  ok(CHAR_COLOR.length === 3 && CHAR_COLOR.every((c, i) => c === HPCOLOR[i]),
    'CHAR_COLOR is the SAME three row objects as HPCOLOR[0..2], not a copy');
  ok(PARTY_SPRITES.length === 3 && PARTY_SPRITES.every((a, i) => a === CHARBOX_ART[i]),
    'PARTY_SPRITES is the SAME three entries as CHARBOX_ART[0..2], not a copy');
  ok(CHARBOX_ART.length === 4
    && CHARBOX_ART[3].head === 'spr_headnoelle'
    && CHARBOX_ART[3].name === 'spr_bnamenoelle'
    && CHARBOX_ART[3].label === 'NOELLE',
  'CHARBOX_ART[3] is Noelle: spr_headnoelle / spr_bnamenoelle / "NOELLE"');

  // render/fightbar.js must DERIVE its three from the same rows. It does not
  // export them, so this is the honest way to pin it.
  const fb = readFileSync(join(ROOT, 'render', 'fightbar.js'), 'utf8');
  ok(/const CHARCOLOR = HPCOLOR\.slice\(0, 3\);/.test(fb),
    "render/fightbar.js derives CHARCOLOR from HPCOLOR (obj_attackpress's own three)");
  ok(/const ROWCOLOR = \[c_blue, c_purple, c_green, c_yellow\];/.test(fb),
    'ROWCOLOR still has its FOURTH entry, c_yellow, for j == 4');
  ok(/const PRESSBUFFER_ROW = \[1, 2, 3, 2\];/.test(fb),
    'the j == 4 -> pressbuffer[2] ORIGINAL BUG is preserved, not smoothed to [1,2,3,4]');
}

console.log('L2 — INERT: with no override installed, nothing moves');
{
  for (const st of [null, undefined, {}, { partyCharIds: null }]) {
    const label = JSON.stringify(st) ?? String(st);
    ok([0, 1, 2].every((s) => charIdForSlot(st, s) === s + 1),
      `charIdForSlot -> slot + 1 with state ${label}`);
  }
  ok([0, 1, 2].every((s) => charColorFor({}, s) === CHAR_COLOR[s]),
    'charColorFor returns exactly the old CHAR_COLOR rows for slots 0/1/2');
  ok([0, 1, 2].every((s) => partyArtFor({}, s) === PARTY_SPRITES[s]),
    'partyArtFor returns exactly the old PARTY_SPRITES entries');
  ok([0, 1, 2].every((s) => partyNameFor({}, s) === PARTY[s].name),
    "partyNameFor returns sim/damage.js's PARTY names (KRIS / SUSIE / RALSEI)");
  ok([0, 1, 2].every((s) => slotOccupied({}, s) === true),
    'slotOccupied is true for all three slots when no global.char exists');
  // A vanilla-shaped override must ALSO be a no-op, which is what keeps the
  // A-Side byte gate honest once something does start publishing the field.
  const trio = { partyCharIds: [1, 2, 3] };
  ok([0, 1, 2].every((s) => charColorFor(trio, s) === CHAR_COLOR[s]),
    'an explicit [1, 2, 3] is indistinguishable from no override at all');
}

console.log('L3 — the Weird Route roster resolves to Noelle, not Susie');
{
  const wr = { partyCharIds: [1, 4, 0] };
  ok(charIdForSlot(wr, 1) === 4, 'slot 1 of [1, 4, 0] is character 4 (scr_fixparty order)');
  ok(eq(charColorFor(wr, 1), fromBGR(C_YELLOW)),
    'slot 1 draws c_yellow — NOT c_fuchsia, which is what "she just has susies" was');
  ok(!eq(charColorFor(wr, 1), CHAR_COLOR[1]), 'and it is not Susie\'s row any more');
  ok(partyArtFor(wr, 1).head === 'spr_headnoelle'
    && partyArtFor(wr, 1).name === 'spr_bnamenoelle',
  'slot 1 draws spr_headnoelle / spr_bnamenoelle');
  ok(partyNameFor(wr, 1) === 'NOELLE', 'slot 1 is named NOELLE (global.charname[4])');
  ok(slotOccupied(wr, 0) && slotOccupied(wr, 1) && !slotOccupied(wr, 2),
    'slot 2 is EMPTY — `if (global.char[i] != 0)` skips it');
  // The other route the seam can be fed: `global.char` itself, as the roster
  // layer already publishes it. Both must work, or the fix reaches the HUD in
  // a live fight and not in this check (or the reverse, which is worse).
  const viaRoster = { kaizo: { globalChar: [1, 4, 0] } };
  ok(eq(charColorFor(viaRoster, 1), fromBGR(C_YELLOW)),
    'state.kaizo.globalChar feeds the same answer — the roster needs no extra write');
}

// ── the live fight ────────────────────────────────────────────────────────

const fakeImg = (tag) => ({ width: 32, height: 32, __tag: tag });
function spriteStub(name) {
  return {
    frames: [0, 1, 2, 3, 4, 5].map((k) => fakeImg(`${name}#${k}`)),
    meta: { ox: 0, oy: 0, w: 32, h: 32 },
  };
}

async function makeRenderer(rec) {
  const canvas = { width: 640, height: 480, style: {}, getContext: () => mkRecCtx(rec) };
  const renderer = await createRenderer(canvas, { overrides: KAIZO_DRAW_OVERRIDES });
  // EVERY sprite is stubbed, tagged `<name>#<frame>`, so "which frame of
  // spr_pressfront" is recoverable from the recording. The real pack would
  // work too, but its frames are anonymous decoded images.
  renderer.sprites.get = (name) => spriteStub(name);
  return renderer;
}

const idle = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};

/** A live V-D fight, stepped past the intro rise, party HP pinned. */
function weirdRoute(frames = 40, seed = 12345) {
  const st = createState({ seed, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: 'D' });
  for (let f = 0; f < frames; f++) {
    stepFrame(st, idle);
    const maxhp = st.partyMaxhp ?? PARTY.map((p) => p.maxhp);
    for (let i = 0; i < maxhp.length; i++) st.partyHp[i] = maxhp[i];
    st.gameOver = false;
  }
  st.frame = 40; // past drawMenu's intro translate
  return st;
}

/**
 * Render one frame of the charbox, the ally picker and the FIGHT bar together
 * with `partyCharIds` forced to `ids`, and hand back the recording.
 */
async function renderWith(ids) {
  const rec = [];
  const renderer = await makeRenderer(rec);
  const st = weirdRoute();
  if (ids) {
    st.partyCharIds = ids;
    // THE EXPLICIT OVERRIDE IS REMOVED FOR THE DIFFERENTIAL, and only for it.
    // `state.partySprites` is what the roster installs and it deliberately
    // WINS over the character table — so leaving it in place would hold the
    // portrait and the plate fixed on Noelle whatever `partyCharIds` said,
    // and the L6 probe below would read "partyArtFor is not consulted" when
    // the truth is that its first branch answered. Dropping it puts the
    // question to the branch this seam owns. The L4 run passes `null` and
    // keeps the override, so the real path is measured there.
    delete st.partySprites;
  }
  st.menu.open = true;
  st.menu.charturn = 1; // Noelle's panel raised: her colour drives the matrix
  st.menu.submenu = 'target';
  st.menu.targetIndex = 1;
  st.fightBar = createFightBar(st.rng, [0, 1], true);
  renderer.draw(st);
  return { rec, st };
}

console.log('L4 — the charbox and the FIGHT bar, painted (real renderer)');
const live = await renderWith(null); // the roster's own global.char decides
{
  const { rec, st } = live;
  ok(st.kaizo?.globalChar?.[1] === 4,
    'the V-D scene really did install [1, 4, 0] (the run is not vacuous)');

  // THE PANEL. scr_charbox's coloured border is a fillRect PANEL_W wide at
  // the slot's chunk; a two-member party sits at 108 / 322 (charboxChunks).
  const noelleBorder = rec.filter((r) => r.op === 'fillRect'
    && Math.abs(r.x - 322) < 1e-9 && r.style === NOELLE_CSS);
  ok(noelleBorder.length >= 1,
    `Noelle's charbox panel border is ${NOELLE_CSS} (c_yellow), ${noelleBorder.length} fill(s)`);
  const susieAnywhere = rec.filter((r) => r.op === 'fillRect' && r.style === SUSIE_CSS);
  ok(susieAnywhere.length === 0,
    `and c_fuchsia is painted NOWHERE on this screen (${susieAnywhere.length} fills)`);

  // THE PORTRAIT AND THE PLATE.
  const tags = new Set(rec.filter((r) => r.op === 'drawImage').map((r) => r.tag));
  ok(tags.has('spr_headnoelle#0'), 'spr_headnoelle is drawn');
  ok(tags.has('spr_bnamenoelle#0'), 'spr_bnamenoelle is drawn');
  ok(!tags.has('spr_headsusie#0') && !tags.has('spr_bnamesusie#0'),
    'and Susie\'s head and name plate are drawn nowhere');

  // THE FIGHT BAR ROW. `outlineRect` strokes twice per row at ROW_PITCH * i.
  const rowStroke = rec.filter((r) => r.op === 'strokeRect' && r.style === NOELLE_CSS);
  ok(rowStroke.length === 2,
    `Noelle's bar row is outlined twice in c_yellow (found ${rowStroke.length})`);
  const purple = rec.filter((r) => r.op === 'strokeRect' && r.style === css(fromBGR(C_PURPLE)));
  ok(purple.length === 0,
    `no row is outlined in c_purple — that was the "susies" row (${purple.length})`);
  // The plate and the target line take FRAME j - 1 = 3.
  ok(tags.has('spr_pressfront#3') && tags.has('spr_pressspot#3'),
    'spr_pressfront and spr_pressspot draw FRAME 3 (j - 1 for character 4)');
  ok(!tags.has('spr_pressfront#1') && !tags.has('spr_pressspot#1'),
    'and never frame 1, which is Susie\'s plate');

  // TWO PANELS, NOT THREE WITH AN EMPTY ONE. scr_charbox walks `chartotal`
  // panels; render/menu.js takes the count off `state.partySprites.length`,
  // and installRoster's `partyChunks` centres two at 108 / 322 instead of
  // left-packing them at 0 / 213. The panel's coloured border is the only
  // 212-wide fillRect on the screen, so counting those counts panels.
  const panels = rec.filter((r) => r.op === 'fillRect' && r.w === 212);
  ok(panels.length === 2,
    `the charbox draws TWO panels, centred (found ${panels.length})`);
  ok(panels.every((p) => p.x === 108 || p.x === 322),
    'and at the two-member chunks 108 / 322, not 0 / 213 / 426');
  // The five party-size-3 loops in sim/menu.js (endTurnItems x2, the slide
  // sweep, and openMenu's charaction / tempitem resets) are INERT for a short
  // party rather than wrong, and this is the receipt rather than a reading:
  // the empty slot never raises, so `slide` takes its else branch and leaves
  // mmy[2] at 0, and nothing draws panel 2 at all. `skipFallen` cannot land
  // there either — kaizo-fight.js pads the spare slot with chardead = 1.
  ok((st.menu.mmy?.[2] ?? 0) === 0,
    'the slide over the EMPTY slot leaves mmy[2] at 0 — no stale panel state');
  ok(st.menu.charturn !== 2, 'and the command phase never selects slot 2');

  // THE ALLY PICKER. Its trough is a 101x16 c_maroon fillRect per drawn row.
  const troughs = rec.filter((r) => r.op === 'fillRect'
    && r.style === '#800000' && r.w === 101 && r.h === 16);
  ok(troughs.length === 2,
    `the picker draws TWO rows, not three with an empty one (found ${troughs.length})`);
  // ...and the fraction it divides by is HER max HP, not Susie's 190.
  ok(st.partyMaxhp?.[1] === NOELLE_STATS.maxhp && NOELLE_STATS.maxhp === 120,
    `the picker's divisor for slot 1 is Noelle's own maxhp 120 (got ${st.partyMaxhp?.[1]})`);
  ok(st.partyMaxhp?.[1] !== PARTY[1].maxhp,
    `and not Susie's ${PARTY[1].maxhp}`);
}

console.log('L5 — the A-Side is untouched: three rows, the vanilla three colours');
{
  const rec = [];
  const renderer = await makeRenderer(rec);
  const st = createState({ seed: 7, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: 'C' });
  for (let f = 0; f < 40; f++) { stepFrame(st, idle); st.gameOver = false; }
  st.frame = 40;
  st.menu.open = true;
  st.menu.charturn = 1;
  st.menu.submenu = 'target';
  st.fightBar = createFightBar(st.rng, [0, 1, 2], true);
  renderer.draw(st);
  const troughs = rec.filter((r) => r.op === 'fillRect'
    && r.style === '#800000' && r.w === 101 && r.h === 16);
  ok(troughs.length === 3, `V-C still draws THREE picker rows (found ${troughs.length})`);
  const tags = new Set(rec.filter((r) => r.op === 'drawImage').map((r) => r.tag));
  ok(tags.has('spr_headsusie#0') && tags.has('spr_bnamesusie#0'),
    'V-C still draws Susie\'s head and name plate in slot 1');
  ok(!tags.has('spr_headnoelle#0'), 'and Noelle appears nowhere on the A-Side');
  const purple = rec.filter((r) => r.op === 'strokeRect'
    && r.style === css(fromBGR(C_PURPLE)));
  ok(purple.length === 2, `V-C's slot-1 bar row is still c_purple (${purple.length} strokes)`);
}

console.log('L6 — THE READER GUARD: delete a call site and this goes red');
{
  // (a) the differential. Same fight, same frame, only `partyCharIds` differs
  //     — so any surface that stops CONSULTING it stops differing, and the
  //     assertion below names which one.
  const noelle = await renderWith([1, 4, 0]);
  const trio = await renderWith([1, 2, 3]);
  const key = (r) => (r.op === 'drawImage'
    ? `img|${r.tag}` : `${r.op}|${r.style}|${r.x}|${r.y}|${r.w}|${r.h}`);
  const setOf = (rec, pred) => new Set(rec.filter(pred).map(key));
  const differs = (pred, what) => {
    const a = setOf(noelle.rec, pred);
    const b = setOf(trio.rec, pred);
    const same = a.size === b.size && [...a].every((k) => b.has(k));
    ok(!same, what);
  };
  differs((r) => r.op === 'fillRect' && Math.abs(r.x - 322) < 1e-9,
    'render/menu.js:charColorFor IS READ — the charbox panel repaints');
  differs((r) => r.op === 'drawImage' && /spr_(head|bname)/.test(r.tag ?? ''),
    'render/menu.js:partyArtFor IS READ — the portrait and plate change');
  differs((r) => r.op === 'strokeRect',
    'render/fightbar.js:charIdForSlot IS READ — the bar row outline changes colour');
  differs((r) => r.op === 'drawImage' && /spr_press/.test(r.tag ?? ''),
    'render/fightbar.js frame j - 1 IS READ — the plate frame changes');
  // The picker's row COUNT is what proves slotOccupied is consulted: [1,4,0]
  // has an empty slot 2 and [1,2,3] does not.
  const rows = (rec) => rec.filter((r) => r.op === 'fillRect'
    && r.style === '#800000' && r.w === 101 && r.h === 16).length;
  ok(rows(noelle.rec) === 2 && rows(trio.rec) === 3,
    `render/menu.js:slotOccupied IS READ — ${rows(noelle.rec)} rows vs ${rows(trio.rec)}`);

  // (b) the text scan, which names the site a reviewer has to restore. The
  //     differential above cannot say WHERE; this can, and it also catches a
  //     rename that leaves the behaviour intact today and rots tomorrow.
  const sites = [
    ['render/menu.js', /const color = charColorFor\(state, c\);/, 'the charbox panel colour'],
    ['render/menu.js', /const stats = partyArtFor\(state, c\);/, 'the portrait / name plate'],
    ['render/menu.js', /partyNameFor\(state, i\)/, "the ally picker's row label"],
    ['render/menu.js', /if \(!slotOccupied\(state, i\)\) continue;/, "the picker's empty-slot guard"],
    ['render/fightbar.js', /const j = charIdForSlot\(state, i\);/, "the bar row's character id"],
  ];
  for (const [file, re, what] of sites) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    ok(re.test(src), `${file} still reads the seam for ${what}`);
  }
}

console.log(failed === 0 ? '\ncheck-charcolour: PASS' : `\ncheck-charcolour: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
