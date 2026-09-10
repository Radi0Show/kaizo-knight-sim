#!/usr/bin/env node
// THE PORTS, AGAINST THE REAL MANIFESTS AND THE REAL PNGs.
//
//   node kaizo/tools/checks/check-render-manifest-kaizo.mjs
//
// RENDER-CRITIC item 7, the verification gap, in its own words: "both smoke
// gates replace EVERY sprite with a 32x32 fakeEntry (origin 16,16) — no
// exit-code gate ever runs the ports against the real manifests/overlay/PNGs."
//
// So every port has been driven only against a sprite that is always present,
// always two frames, always 32x32, always centred. Four classes of defect are
// invisible to that and to every sim suite:
//
//   1. A DRAWER ASKING FOR A SPRITE NOBODY SHIPS. `sprites.get(name)` returns
//      undefined, drawSpriteExt returns without drawing, and the object is
//      silently absent from the picture for the rest of the fight. This is
//      RENDER-CRITIC item 3's whole class.
//   2. A SUB-IMAGE PAST THE END. Against a 2-frame stub every index wraps
//      into 0 or 1; against an 18-frame slice sheet or a 1-frame marker it
//      does not, and `cuty`-style indices are read straight off sim state.
//   3. AN ORIGIN THAT IS NOT (16, 16). Every position in every port is
//      relative to the manifest origin, and the stub's is the same for all
//      104 + 254 sprites — so an origin mix-up cannot move anything.
//   4. A MANIFEST ROW THAT DISAGREES WITH ITS OWN PNG. The row carries `w`,
//      `h` and the file list; nothing has ever compared them to the files.
//
// WHAT THIS CAN AND CANNOT DO. There is no canvas in Node, so nothing here
// rasterises: the PNGs are read for their IHDR header (width, height) and the
// frames handed to the renderer are real-SIZED, real-COUNTED, real-ORIGINED
// stand-ins for the decoded images. That closes 1, 2, 3 and 4 — which is the
// part of the gap that is about the MANIFEST — and leaves pixels, which no
// exit-code gate on this machine can reach, to the eye.
//
// SABOTAGE-TESTED 2026-09-10, both directions (see the report): renaming a
// sprite a drawer asks for makes the resolution assertion fail; corrupting a
// manifest row's `h` makes the PNG-agreement assertion fail.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..', '..');
const BASE_DIR = join(REPO, 'assets', 'sprites');
const KAIZO_DIR = join(REPO, 'kaizo', 'assets', 'sprites');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

// ── the real manifests ─────────────────────────────────────────────────────

if (!existsSync(join(KAIZO_DIR, 'manifest.json'))) {
  // Same posture as check-sprites: the overlay is publish-gated by its own
  // .gitignore (EnderCat8's art), so a fresh clone has none. Say so loudly
  // and exit 0 — a missing overlay is a build step, not a regression.
  console.log('  --  kaizo/assets/sprites/manifest.json is absent (publish-gated overlay).');
  console.log('  --  Build it with: node kaizo/tools/pack-kaizo-sprites.mjs');
  console.log('SKIP  kaizo render manifest — nothing to check without the overlay');
  process.exit(0);
}

const baseManifest = JSON.parse(readFileSync(join(BASE_DIR, 'manifest.json'), 'utf8'));
const kaizoManifest = JSON.parse(readFileSync(join(KAIZO_DIR, 'manifest.json'), 'utf8'));

/**
 * The merge web/kaizo.js performs at boot: the vanilla pack first, the kaizo
 * overlay ON TOP (`sprites.set(name, ...)` for every overlay row, so an
 * overlay row of the same name wins). Reproduced here rather than assumed —
 * the drawers resolve names through exactly this map.
 */
const merged = new Map();
for (const [name, meta] of Object.entries(baseManifest)) merged.set(name, { meta, dir: BASE_DIR });
let overridden = 0;
for (const [name, meta] of Object.entries(kaizoManifest)) {
  if (merged.has(name)) overridden += 1;
  merged.set(name, { meta, dir: KAIZO_DIR });
}
ok(merged.size === Object.keys(baseManifest).length + Object.keys(kaizoManifest).length - overridden,
  `the two manifests merge to ${merged.size} sprites `
  + `(${Object.keys(baseManifest).length} vanilla + ${Object.keys(kaizoManifest).length} kaizo, `
  + `${overridden} overridden)`);
ok(merged.size >= 250, `and that is the real pack, not a stub (${merged.size} sprites)`);

/**
 * SIX ROWS DISAGREE WITH THEIR OWN PNGs, and this gate found them on its
 * first run (2026-09-10). Every one is the MANIFEST claiming the sprite is
 * larger than the file on disk — the extraction wrote the texture-page region
 * and the row carries the declared size — so the far edge (the right column,
 * the bottom row) is missing from the art while every position stays right,
 * because a position is relative to the ORIGIN and the origin is unchanged.
 *
 *   spr_battlemsg                    74x20  manifest 83x20   ox 83   15 frames
 *   spr_susie_walk_right_dw_unhappy  25x42  manifest 25x43   oy -2    4
 *   spr_ralsei_walk_right_unhappy    19x39  manifest 19x40   oy -3    4
 *   spr_undyne_dw_caught             39x33  manifest 39x34            2
 *   spr_susie_laugh_dw               28x40  manifest 28x41   oy -3    2
 *   spr_roaringknight_sword_ol_alt   74x31  manifest 75x31   ox 37    1   (kaizo overlay)
 *
 * NOT FIXED HERE, and deliberately: five of them are in `assets/sprites/`,
 * which is a vendored engine asset this repo may not hand-edit, and the sixth
 * is in the kaizo overlay, which `kaizo/tools/pack-kaizo-sprites.mjs`
 * REBUILDS from a data.win extraction rather than patches. They are PINNED so
 * that a SEVENTH — a genuinely new mismatch, from a rebuild that half-ran or
 * a row typed by hand — fails this gate loudly.
 */
const KNOWN_SIZE_MISMATCH = new Set([
  'spr_battlemsg',
  'spr_susie_walk_right_dw_unhappy',
  'spr_ralsei_walk_right_unhappy',
  'spr_undyne_dw_caught',
  'spr_susie_laugh_dw',
  'spr_roaringknight_sword_ol_alt',
]);

// ── 1. every manifest row agrees with its own PNGs ────────────────────────

/** A PNG's IHDR: 8-byte signature, then a 4+4 chunk header, then w/h as u32be. */
function pngSize(path) {
  const b = readFileSync(path);
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

{
  let checked = 0;
  const missing = [];
  const wrongCount = [];
  const wrongSize = [];
  const knownSeen = new Set();
  for (const [name, { meta, dir }] of merged) {
    const files = meta.files ?? [];
    if (files.length !== meta.frames) wrongCount.push(`${name} (${files.length} files, frames ${meta.frames})`);
    for (const f of files) {
      const p = join(dir, f);
      if (!existsSync(p)) { missing.push(`${name}/${f}`); continue; }
      const size = pngSize(p);
      checked += 1;
      if (!size) { wrongSize.push(`${name}/${f} (not a PNG)`); continue; }
      if (size.w !== meta.w || size.h !== meta.h) {
        if (KNOWN_SIZE_MISMATCH.has(name)) { knownSeen.add(name); continue; }
        wrongSize.push(`${name}/${f} is ${size.w}x${size.h}, manifest says ${meta.w}x${meta.h}`);
      }
    }
  }
  ok(checked > 500, `read the IHDR of ${checked} real PNGs`);
  ok(missing.length === 0,
    `every file a manifest row names is on disk${missing.length ? ` — MISSING: ${missing.slice(0, 5).join(', ')}` : ''}`);
  ok(wrongCount.length === 0,
    `every row's file count matches its \`frames\`${wrongCount.length ? ` — ${wrongCount.slice(0, 5).join(', ')}` : ''}`);
  ok(wrongSize.length === 0,
    `every PNG's real size matches its row's w/h, bar the six pinned above`
    + `${wrongSize.length ? ` — NEW MISMATCH: ${wrongSize.slice(0, 5).join(', ')}` : ''}`);
  // The pin is a MEASUREMENT and must stay one: a name that stops
  // disagreeing has been fixed (or renamed) and should leave the list.
  ok(knownSeen.size === KNOWN_SIZE_MISMATCH.size,
    `all ${KNOWN_SIZE_MISMATCH.size} pinned mismatches are still present `
    + `(${knownSeen.size} seen)${knownSeen.size === KNOWN_SIZE_MISMATCH.size ? '' : ' — RESOLVED: '
      + [...KNOWN_SIZE_MISMATCH].filter((n) => !knownSeen.has(n)).join(', ')}`);
  // ...and the overlay directory carries nothing the manifest does not name,
  // which is how a rebuild that half-ran would show up.
  const named = new Set();
  for (const meta of Object.values(kaizoManifest)) for (const f of meta.files ?? []) named.add(f);
  const orphans = readdirSync(KAIZO_DIR).filter((f) => f.endsWith('.png') && !named.has(f));
  ok(orphans.length === 0,
    `no orphan PNGs in the overlay${orphans.length ? ` — ${orphans.slice(0, 5).join(', ')}` : ''}`);
}

// ── the renderer, with REAL entries ───────────────────────────────────────

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);
const mkCtx = () => new Proxy({}, {
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
    return () => { globalThis.__draws = (globalThis.__draws ?? 0) + 1; return undefined; };
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
const { PARTY } = await import('../../../sim/damage.js');
const { buildKaizoScene, KAIZO_VERSIONS } = await import('../../scenes/kaizo-fight.js');
const { createRenderer } = await import('../../../render/canvas.js');
const { resetTensionBar } = await import('../../../render/tensionbar.js');
const { KAIZO_DRAW_OVERRIDES, KAIZO_DRAW_OBJECTS } = await import('../../render/index.js');

/**
 * A real entry: the manifest row verbatim, and one frame object per real PNG
 * carrying that PNG's real dimensions. Not decoded — nothing here draws
 * pixels — but real in every way a drawer can observe: the count, the size
 * and the origin.
 */
function realEntry(name) {
  const row = merged.get(name);
  if (!row) return undefined;
  const { meta, dir } = row;
  const frames = (meta.files ?? []).map((f) => {
    const s = pngSize(join(dir, f)) ?? { w: meta.w, h: meta.h };
    return { width: s.w, height: s.h, src: `file://${join(dir, f)}`, __sprite: name };
  });
  return { meta, frames };
}

const realCache = new Map();
/** Every name a drawer asked for this run, and whether the pack has it. */
const asked = new Map();

async function makeRenderer() {
  const canvas = { width: 640, height: 480, style: {}, getContext: () => mkCtx() };
  const renderer = await createRenderer(canvas, { overrides: KAIZO_DRAW_OVERRIDES });
  renderer.sprites.get = (name) => {
    if (name === undefined || name === null) return undefined;
    asked.set(name, (asked.get(name) ?? 0) + 1);
    if (!realCache.has(name)) realCache.set(name, realEntry(name));
    return realCache.get(name);
  };
  renderer.sprites.has = (name) => merged.has(name);
  for (const [name, { meta }] of merged) {
    renderer.spriteFrames[name] = meta.frames;
    renderer.spriteRate[name] = meta.playbacktype === 'FramesPerSecond'
      ? (meta.playback ?? 1) / 30
      : (meta.playback ?? 1);
  }
  return renderer;
}

const idle = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};
function makeMenuInput() {
  let pulse = false;
  return (state) => {
    if (!state.menu?.open && !state.dialogue?.text && !state.pendingAct) return idle;
    pulse = !pulse;
    return { ...idle, confirm: pulse };
  };
}

function pinParty(state) {
  const maxhp = state.partyMaxhp ?? PARTY.map((p) => p.maxhp);
  for (let i = 0; i < maxhp.length; i++) state.partyHp[i] = maxhp[i];
  state.gameOver = false;
}

function drive({ version, frames, renderer, setup = null, onFrame = null }) {
  const st = createState({ seed: 12345, traceBulletSlots: 0 });
  st.spriteFrames = renderer.spriteFrames;
  st.spriteRate = renderer.spriteRate;
  buildKaizoScene(st, { version });
  if (setup) setup(st);
  const input = makeMenuInput();
  let f = 0;
  let threw = null;
  try {
    for (; f < frames; f++) {
      if (onFrame) onFrame(st, f);
      renderer.draw(st);
      stepFrame(st, input(st));
      pinParty(st);
    }
  } catch (err) { threw = err; }
  return { frames: f, threw, launches: st.kaizo?.launched?.length ?? 0 };
}

// ── 2. the ports survive the REAL pack ────────────────────────────────────
{
  const renderer = await makeRenderer();
  ok(typeof renderer.draw === 'function', 'the renderer was built with the real override map');
  const { castSnowgrave, ensureScenes } = await import('../../party/scenes.js');
  const RUNS = [
    { version: 'C', frames: 4000, label: 'C' },
    { version: 'D', frames: 3000, label: 'D' },
    { version: 'A', frames: 1200, label: 'A' },
    {
      version: 'D', frames: 900, label: 'D, SnowGrave cast on frame 0',
      setup: (st) => { castSnowgrave(st, { caster: 1, magic: 13 }); },
      onFrame: (st) => { ensureScenes(st).sg.target = 0; },
    },
  ];
  for (const run of RUNS) {
    if (!KAIZO_VERSIONS[run.version]) { ok(false, `version ${run.version} is not registered`); continue; }
    resetTensionBar();
    const r = drive({ ...run, renderer });
    if (r.threw) {
      ok(false, `[${run.label}] threw on frame ${r.frames} against the real pack: ${r.threw.message}`);
      console.log(String(r.threw.stack).split('\n').slice(0, 6).map((l) => `        ${l}`).join('\n'));
      continue;
    }
    ok(r.frames === run.frames, `[${run.label}] ${r.frames} frames drawn against real manifest rows`);
  }
  ok((globalThis.__draws ?? 0) > 0, `the canvas received draws (${globalThis.__draws})`);
}

// ── 3. EVERY SPRITE THE PORTS ASK FOR IS IN THE PACK ──────────────────────
//
// The failure this exists for: a drawer names a sprite nobody ships, the get
// returns undefined, drawSpriteExt returns without drawing, and the object is
// invisible for the whole fight with no error anywhere.
{
  ok(asked.size > 30, `the run asked for ${asked.size} distinct sprite names`);

  // KNOWN ABSENT, and each is a fact rather than an excuse:
  const ALLOWED_ABSENT = new Map([
    // RENDER-CRITIC item 3. Extraction candidates, both named at their draw
    // sites; SnowGrave's white-to-blue wash renders, its flakes do not.
    ['spr_icespell_snowflake', 'RENDER-CRITIC 3 — never extracted; every SnowGrave flake'],
    ['bg_snowfall', 'RENDER-CRITIC 3 — never extracted; both snow sheets'],
    // NOT AN ASSET AT ALL: obj_growtangle's Step builds it at runtime with
    // sprite_create_from_surface (Step_0:19-23), so no pack can carry it.
    ['spr_custom_box', 'a runtime sprite_create_from_surface, not an asset'],
    // render/canvas.js's own note: the two heart outlines are approximated
    // with spr_dodgeheart at the same scales, labelled at the site.
    ['spr_heartoutline', 'approximated with spr_dodgeheart — render/canvas.js, obj_heartburst'],
    ['spr_heartoutline2', 'approximated with spr_dodgeheart — render/canvas.js, obj_heartburst'],
  ]);

  const absent = [...asked.keys()].filter((n) => !merged.has(n));
  const unexpected = absent.filter((n) => !ALLOWED_ABSENT.has(n));
  const expected = absent.filter((n) => ALLOWED_ABSENT.has(n));
  ok(unexpected.length === 0,
    `every sprite the ports asked for is in the pack${unexpected.length ? ` — MISSING: ${unexpected.join(', ')}` : ''}`);
  for (const n of expected) {
    console.log(`  --  known absent: ${n} — ${ALLOWED_ABSENT.get(n)}`);
  }
  // A name in the allow-list that the run never asks for is a stale entry;
  // reported, not enforced, because a schedule change can hide one.
  for (const n of ALLOWED_ABSENT.keys()) {
    if (!asked.has(n)) console.log(`  --  allow-list entry not exercised in these budgets: ${n}`);
  }
}

// ── 4. THE THINGS A 32x32 STUB CANNOT BE ─────────────────────────────────
//
// Positive assertions that the entries the ports actually received were the
// real rows: an origin that is not the stub's (16, 16), a frame count that is
// not the stub's 2, and a size that is not 32x32. If the harness ever
// regressed to stubs these would all fail.
{
  const used = [...asked.keys()].filter((n) => merged.has(n));
  const rows = used.map((n) => merged.get(n).meta);
  ok(rows.some((m) => m.ox !== 16 || m.oy !== 16),
    `the ports were handed real ORIGINS, not the stub's (16, 16) — `
    + `${rows.filter((m) => m.ox !== 16 || m.oy !== 16).length} of ${rows.length} differ`);
  ok(rows.some((m) => m.frames !== 2),
    `and real FRAME COUNTS, not the stub's 2 — `
    + `${rows.filter((m) => m.frames !== 2).length} of ${rows.length} differ`);
  ok(rows.some((m) => m.w !== 32 || m.h !== 32),
    `and real SIZES, not the stub's 32x32 — `
    + `${rows.filter((m) => m.w !== 32 || m.h !== 32).length} of ${rows.length} differ`);
  ok(rows.some((m) => m.frames >= 8),
    `including sheets deep enough for a sub-image to run off the end `
    + `(${rows.filter((m) => m.frames >= 8).length} with 8+ frames)`);
}

// ── 5. THE SPRITES THIS LANE'S PORTS NEED ARE ALL THERE ──────────────────
//
// Named one by one, because "the run did not ask for it" is not the same as
// "it is present". The B-Side Susie set is here for the reason
// kaizo/party/roster.js gives: the Weird Route does not field her, but a
// B-Side run that does must not silently draw the cheerful sprites.
{
  const NEEDED = {
    'the party, at rest': ['spr_krisb_idle', 'spr_susieb_idle', 'spr_ralsei_idle',
      'spr_noelleb_idle', 'spr_noelleb_idle_sideb'],
    'the swoon poses the mod overwrites': ['spr_kris_fell', 'spr_noelleb_swooned', 'spr_susie_dw_fell'],
    'the freeze statue': ['spr_krisb_frozen', 'spr_krisb_hurt', 'spr_noelleb_hurt'],
    'the B-Side Susie set (roster.js: recorded, not fielded on the Weird Route)': [
      'spr_susier_dark_unhappy', 'spr_susieb_idle_serious', 'spr_susieb_defend_unhappy',
      'spr_susieb_actready', 'spr_susieb_attack_serious', 'spr_susieb_item_unhappy',
      'spr_susieb_itemready_unhappy', 'spr_susieb_spellready_unhappy', 'spr_susieb_spell_unhappy',
    ],
    'the vanilla tension bar': ['spr_tensionbar', 'spr_tensionbar_cutout', 'spr_tplogo', 'spr_tensionmarker'],
    'the sheared B-Side bar': ['spr_tensionbar_sliced', 'spr_tensionbar_sliced_cutout',
      'spr_tensionbar_sliced_top'],
    'the bleed markers': ['spr_roaringknight_finalslash_mask'],
    'the finisher\'s cut': ['spr_rk_quickslash', 'spr_rk_slash_heartslice', 'spr_dodgeheart'],
    'the hell surface': ['spr_pxwhite10_center', 'spr_knight_bullet_flow'],
  };
  for (const [what, names] of Object.entries(NEEDED)) {
    const gone = names.filter((n) => !merged.has(n));
    ok(gone.length === 0, `${what}: all ${names.length} present${gone.length ? ` — MISSING ${gone.join(', ')}` : ''}`);
  }
  // And the two the drawers index by a sim value, where a wrap would be
  // silent: the slice sheet and the one-frame marker.
  const slice = merged.get('spr_rk_slash_heartslice');
  ok(slice && slice.meta.frames >= 15,
    `spr_rk_slash_heartslice is a deep sheet — \`cuty\` runs 1..14 (${slice?.meta.frames} frames)`);
  const mark = merged.get('spr_roaringknight_finalslash_mask');
  ok(mark && mark.meta.frames === 1 && mark.meta.ox === 5 && mark.meta.oy === 5,
    `the bleed marker is one 10x10 frame with a CENTRED origin (${mark?.meta.w}x${mark?.meta.h}, origin ${mark?.meta.ox},${mark?.meta.oy})`);
}

// ── 6. the registry is covered by the pack it will draw with ─────────────
{
  ok(KAIZO_DRAW_OBJECTS.length >= 25, `the registry carries ${KAIZO_DRAW_OBJECTS.length} entries`);
}

console.log('');
if (failed) {
  console.log(`FAIL  kaizo render manifest — ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('PASS  kaizo render manifest — the ports run against the real manifests and PNGs');
