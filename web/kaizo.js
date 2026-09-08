// KAIZO KNIGHT — the browser driver for web/kaizo.html.
//
// SEPARATE REPO SINCE 2026-09-02: this is kaizo-knight-sim, and the whole repo is
// kaizo. sim/, render/, input/, assets/ and tools/ are a VENDORED snapshot of
// knight-sim (docs/VENDOR.md says which one) — fix the engine THERE, then
// re-vendor (kaizo/tools/vendor-engine.mjs). The isolation contract below is
// kept as history: it is what made this page separable in the first place.
//
// KAIZO-OWNED: this is
// the one file under web/ allowed to import from kaizo/ (kaizo/HANDOFF.md §2
// — the ISOLATION CONTRACT bans the EXISTING pages from doing so; this page
// is new, imports one-way, and deleting kaizo/ plus this page leaves the main
// sim untouched. No main-page code path changes for kaizo's sake.)
//
// A trimmed sibling of web/main.js: same 30Hz drain loop, same input latch
// across transitions, same watchdog — none of the title-screen/mode machinery.
// The page IS the mode: it boots straight into the kaizo fight.
//
//   ?seed=N     the RNG seed (R randomizes, exactly like the main page)
//   ?frames=N   deterministic fast-forward before first paint (idle input)
//   ?v=A        which KAIZO_VERSIONS entry to run (only A exists today)
//   ?cfg=TOKEN  the MAIN page's share token, reused READ-ONLY for gear+bag —
//               sim/share.js is not touched, so verify-share's round-trip is
//               untouched too. Its mode/attack fields are ignored here: the
//               kaizo schedule is not the shared setup's to choose.
//
// The settings entry (knightsim.settings) is READ, never written: the kaizo
// page borrows your loadout, volumes, shake and scaling, and has no settings
// UI of its own to corrupt them with.

import { createState, stepFrame } from '../sim/index.js';
import { drain } from '../sim/clock.js';
import { buildKaizoScene, KAIZO_NOTE, KAIZO_VERSIONS } from '../kaizo/scenes/kaizo-fight.js';
import { getSwordcolor } from '../kaizo/attacks/kaizo-colors.js';
import { decodeConfig } from '../sim/share.js';
import { WEAPONS, ARMOR, canEquip } from '../sim/equipment.js';
import { ITEMS } from '../sim/items.js';
import { MODES, createTitle, stepTitle } from '../sim/modes.js';
import { drawTitle, drawGameOver, stepGameOver, makeGameOver } from '../render/title.js';
import { drawBackground } from '../render/background.js';
import { ATTACK_MENU } from '../sim/scenes/single.js';
import { createTvTurnoff, stepTvTurnoff } from '../sim/tvturnoff.js';
import { drawTvTurnoff } from '../render/draw/tvturnoff.js';
import { bindKeyboard } from '../input/keyboard.js';
import { bindTouch } from '../input/touch.js';
import { bindGamepad } from '../input/gamepad.js';
import { createRenderer } from '../render/canvas.js';
import { createAudio } from '../render/audio.js';
import { deltaruneMultiplier } from '../render/windowsize.js';
import { drainCues } from '../sim/audio.js';
import { resetTensionBar } from '../render/tensionbar.js';
// THE MOD'S DRAW EVENTS, handed to the renderer through its override seam
// (render/canvas.js, createRenderer's header). Same direction as every other
// import here: this page reaches into kaizo/, render/ never does.
import { KAIZO_DRAW_OVERRIDES } from '../kaizo/render/index.js';
import { VERSION } from './version.js';

// The label reaches the console too, for anyone reading a bug report's log.
console.log(KAIZO_NOTE);

const canvas = document.getElementById('game');

// ── THE BOOT HUD ─────────────────────────────────────────────────────────
//
// This page fetches ~1,660 sprite frames before it can draw anything, and
// until it does the canvas is plain black. If ANY of that stalls -- a slow
// server, a throttled background tab, a request that never returns -- the
// page is indistinguishable from a page that crashed: black, silent, no
// error anywhere. That cost a whole session of debugging, so boot now says
// where it is, on the canvas, in plain 2D text that needs no sprite font.
const bootCtx = canvas.getContext('2d');
function boot(msg) {
  try {
    console.log('[kaizo boot] ' + msg);
    bootCtx.setTransform(1, 0, 0, 1, 0, 0);
    bootCtx.fillStyle = '#000';
    bootCtx.fillRect(0, 0, canvas.width, canvas.height);
    bootCtx.fillStyle = '#8ab';
    bootCtx.font = '16px ui-monospace, monospace';
    bootCtx.fillText('KAIZO KNIGHT — ' + msg, 24, 40);
  } catch { /* a canvas we cannot touch is not worth failing boot over */ }
}
boot('loading sprites…');

const renderer = await createRenderer(canvas, { overrides: KAIZO_DRAW_OVERRIDES });
const ctx = renderer.ctx;

/**
 * THE KAIZO SPRITE OVERLAY, merged on top of the vanilla pack.
 *
 * The main pack is the vanilla fight's art and the main page is verified
 * against it, so kaizo does not touch it (kaizo/HANDOFF.md §2). The kaizo
 * lane needs sprites the vanilla fight never references — some vanilla ones
 * the pack filtered out, plus EnderCat8's own new art — and those live in
 * kaizo/assets/sprites/, built by kaizo/tools/pack-kaizo-sprites.mjs.
 *
 * Merged INTO the renderer's existing Map rather than passed to
 * createRenderer, because render/ is main-page code that must not learn
 * about kaizo/. Generic blitting reads the Map per draw, so entries added
 * after construction are picked up; the renderer's construction-time caches
 * are all for specific vanilla sprites and are unaffected.
 *
 * A missing overlay is not fatal: every entity without a sprite falls back
 * to drawing its own collision mask, which is the shape it collides with.
 * Better a labelled white outline than a page that will not start.
 */
async function loadKaizoOverlay(sprites) {
  const base = new URL('../kaizo/assets/sprites/', import.meta.url).href;
  let manifest;
  try {
    const res = await fetch(`${base}manifest.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifest = await res.json();
  } catch (err) {
    console.warn(`kaizo sprite overlay not loaded (${err.message}) — `
      + 'kaizo-only sprites will draw from their collision masks. '
      + 'Build it with: node kaizo/tools/pack-kaizo-sprites.mjs');
    return 0;
  }
  const loadImage = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  let added = 0;
  await Promise.all(Object.entries(manifest).map(async ([name, meta]) => {
    const frames = (await Promise.all(meta.files.map((f) => loadImage(base + f)))).filter(Boolean);
    if (!frames.length) return;
    sprites.set(name, { meta, frames });
    // THE SIM ANIMATES OFF THESE, not off the Map (sim/index.js reads
    // state.spriteFrames / state.spriteRate to advance image_index). A
    // sprite present in the Map but absent here draws its first frame
    // forever — the shatter's 31 frames would be a still image.
    //
    // The rate rule is COPIED FROM render/canvas.js, not reinvented: a
    // FramesPerSecond sprite converts against the 30Hz clock, everything
    // else takes `playback` as the per-frame multiplier. Writing a
    // plausible-looking variant here would animate every overlay sprite at
    // a subtly different speed from every packed one.
    renderer.spriteFrames[name] = frames.length;
    renderer.spriteRate[name] = meta.playbacktype === 'FramesPerSecond'
      ? (meta.playback ?? 30) / 30
      : (meta.playback ?? 1);
    added += 1;
  }));
  return added;
}
boot('merging the kaizo overlay…');
const overlayCount = await loadKaizoOverlay(renderer.sprites);
console.log(`kaizo sprite overlay: ${overlayCount} sprites merged`);

// ---- scaling (main.js's fitCanvas, verbatim behaviour) --------------------
let scalingMode = 'fit';
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const availW = window.innerWidth * dpr;
  const availH = window.innerHeight * dpr;
  const fit = Math.min(availW / renderer.VIEW_W, availH / renderer.VIEW_H);
  let scale = fit;
  if (scalingMode === 'pixel' && fit >= 1) {
    const m = deltaruneMultiplier(
      window.screen?.width ?? window.innerWidth,
      window.screen?.height ?? window.innerHeight,
      renderer.VIEW_W,
      renderer.VIEW_H,
    );
    scale = Math.min(m * dpr, Math.floor(fit));
  }
  canvas.style.width = `${(renderer.VIEW_W * scale) / dpr}px`;
  canvas.style.height = `${(renderer.VIEW_H * scale) / dpr}px`;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);
if (window.matchMedia) {
  const watchDpr = () => {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', () => { fitCanvas(); watchDpr(); }, { once: true });
  };
  watchDpr();
}

// ---- input (three sources OR'd, same as main.js) --------------------------
const audio = createAudio();
const keyboard = bindKeyboard(window);
const gamepad = bindGamepad();
const touch = bindTouch({
  pad: document.getElementById('dpad'),
  buttons: [
    { el: document.getElementById('btnZ'), actions: ['confirm'] },
    { el: document.getElementById('btnX'), actions: ['focus', 'cancel'] },
    { el: document.getElementById('btnR'), actions: ['reset'] },
  ],
  onReset: () => reset(),
});
const keys = {
  read() {
    const k = keyboard.read();
    const g = gamepad.read();
    const t = touch.read();
    for (const a of Object.keys(g)) if (g[a]) k[a] = true;
    for (const a of Object.keys(t)) if (t[a]) k[a] = true;
    return k;
  },
};

// A button held across a transition must not act on the other side — the
// same latch main.js documents at length.
let inputMask = {};
function gatedKeys() {
  const raw = keys.read();
  const out = { ...raw };
  for (const k of Object.keys(inputMask)) {
    if (!raw[k]) delete inputMask[k];
    else out[k] = false;
  }
  return out;
}
function maskHeldInput() {
  inputMask = {};
  const raw = keys.read();
  for (const k of Object.keys(raw)) if (raw[k]) inputMask[k] = true;
}

// ---- settings -------------------------------------------------------------
//
// THIS PAGE USED TO READ THE MAIN PAGE'S ENTRY AND WRITE NOTHING, which was
// right while it had no menu: knight-sim and this build sit on the SAME ORIGIN
// in production, so they share localStorage, and a second page writing
// `knightsim.settings` would silently rewrite the real fight's volume, gear and
// bag. web/index.html's comment names that hazard as the reason the root
// redirects rather than standing in a copy of the title page.
//
// The title screen landed here, so the page now writes -- and it writes to its
// OWN key. The main page's entry is still read, but only to SEED this one the
// first time, so anyone who had already built a loadout on the real fight
// arrives here with it instead of at the defaults. After that the two are
// independent, which is what the shared origin requires.
const SETTINGS_KEY = 'knightsim.settings';        // the real fight's; read-only here
const KAIZO_SETTINGS_KEY = 'kaizoknight.settings'; // this page's; the only one written
const settings = {
  gear: null,
  bag: null,
  volumes: { music: 50, sfx: 50 },
  shake: true,
  scaling: 'fit',
};
try {
  // This page's own entry wins; the real fight's is the one-time seed.
  const saved = JSON.parse(
    localStorage.getItem(KAIZO_SETTINGS_KEY) ?? localStorage.getItem(SETTINGS_KEY) ?? 'null',
  );
  if (saved?.gear?.length === 3) {
    settings.gear = saved.gear.map((g) => ({ weapon: g.weapon | 0, armor: (g.armor ?? []).map((a) => a | 0) }));
  }
  if (Array.isArray(saved?.bag)) {
    const bag = saved.bag.map((v) => v | 0).slice(0, 12);
    while (bag.length < 12) bag.push(0);
    settings.bag = bag;
  }
  // Pre-`v` entries hold the old auto-saved 100 default — same rule as main.js.
  if (saved?.volumes && (saved.v | 0) >= 1) {
    settings.volumes.music = Math.max(0, Math.min(100, saved.volumes.music | 0));
    settings.volumes.sfx = Math.max(0, Math.min(100, saved.volumes.sfx | 0));
  }
  if (typeof saved?.shake === 'boolean') settings.shake = saved.shake;
  if (saved?.scaling === 'fit' || saved?.scaling === 'pixel') settings.scaling = saved.scaling;
} catch { /* defaults */ }
scalingMode = settings.scaling;
fitCanvas();
audio.setVolumes(settings.volumes.music / 100, settings.volumes.sfx / 100);

// ---- params ---------------------------------------------------------------
const params = new URLSearchParams(location.search);

// ?v= picks the kaizo VERSION (registry in kaizo-fight.js). Unknown -> A.
//   A = the invented remix; C = the Kaizo Roaring Knight v2.3.3 recreation
//   (WIP, approximations ledgered); D = its B-Side (Weirder Route).
const versionId = KAIZO_VERSIONS[(params.get('v') ?? 'A').toUpperCase()]
  ? (params.get('v') ?? 'A').toUpperCase()
  : 'A';
{
  // The banner names the running version so a playtest screenshot is
  // self-identifying.
  const big = document.querySelector('#kaizo-banner .big');
  if (big && versionId !== 'A') {
    big.textContent = versionId === 'D' ? 'KAIZO KNIGHT — ORACLE B-SIDE' : 'KAIZO KNIGHT — ORACLE';
  }
  const sub = document.querySelector('#kaizo-banner .sub');
  if (sub && versionId !== 'A') {
    sub.insertAdjacentText('afterbegin',
      `${KAIZO_VERSIONS[versionId].name} · `);
  }
}

// ?cfg= — the MAIN page's token, gear+bag only. Validated by the same rules;
// its mode/attack/difficulty fields are deliberately ignored (see header).
const sharedCfg = decodeConfig(params.get('cfg'), {
  weaponOk: (id, c) => id === 0 || (!!WEAPONS[id] && canEquip('weapon', id, c)),
  armorOk: (id, c) => id === 0 || (!!ARMOR[id] && canEquip('armor', id, c)),
  itemOk: (id) => !!ITEMS[id],
  modeCount: MODES.length,
  attackCount: ATTACK_MENU.length,
});
if (sharedCfg?.gear) settings.gear = sharedCfg.gear;
if (sharedCfg?.bag) settings.bag = sharedCfg.bag;

// ---- state ----------------------------------------------------------------
function applyLoadout(st) {
  if (settings.gear) {
    st.loadout.gear = settings.gear.map((g) => ({ weapon: g.weapon, armor: [...g.armor] }));
  }
  st.flag12 = settings.shake ? 0 : 1;
}

let state = createState({
  seed: Number(params.get('seed') ?? 12345),
  traceBulletSlots: 0,
  bag: settings.bag ?? undefined,
});
state.spriteFrames = renderer.spriteFrames;
state.spriteRate = renderer.spriteRate;
applyLoadout(state);
buildKaizoScene(state, { version: versionId });

// ?frames=N — deterministic fast-forward, the same debugging affordance the
// main page has, through the same code path as verify-kaizo.
const skip = Number(params.get('frames') ?? 0);
if (skip > 0) {
  const idle = keys.read();
  for (let i = 0; i < skip; i++) stepFrame(state, idle);
}

let acc = 0;
let last = performance.now();
// ── THE TITLE SCREEN ─────────────────────────────────────────────────────
//
// The page used to boot straight into the fight. It now opens on the same
// menu the vanilla title has -- same modes, same settings pages, same credits,
// drawn by the same render/title.js -- because the two builds should not feel
// like two different products.
//
// THE WORDMARK IS THE ONE DIFFERENCE, and KAIZO is painted in the Knight's own
// blue: `getSwordcolor()` is the mod's single source for that colour
// (kaizo/attacks/kaizo-colors.js -- swordtype 0, pure blue, the `default` arm
// the mod ships), so if the swordtype setting ever moves, the wordmark moves
// with it instead of holding a hardcoded hex that quietly drifts.
boot('building the title…');
const title = createTitle();
// THE MENU EDITS `title`, so it starts from whatever was loaded above --
// otherwise opening SETTINGS would show defaults and saving would wipe a
// loadout the player had already built.
if (settings.gear) title.gear = settings.gear;
if (settings.bag) title.bag = settings.bag;
title.volumes.music = settings.volumes.music;
title.volumes.sfx = settings.volumes.sfx;
title.shake = settings.shake;
title.scaling = settings.scaling;

/** Volume, screen shake and canvas scaling, applied live from the menu. */
function applySettings() {
  audio.setVolumes(title.volumes.music / 100, title.volumes.sfx / 100);
  // `global.flag[12]`: SET means "do not move the view".
  state.flag12 = title.shake ? 0 : 1;
  if (scalingMode !== title.scaling) {
    scalingMode = title.scaling;
    fitCanvas();
  }
  // The run reads these on its next reset().
  settings.gear = title.gear;
  settings.bag = title.bag;
}

/** Save to THIS PAGE'S key only -- see the note above SETTINGS_KEY. */
function persistSettings() {
  try {
    localStorage.setItem(KAIZO_SETTINGS_KEY, JSON.stringify({
      v: 1,
      gear: title.gear, bag: title.bag, volumes: title.volumes,
      shake: title.shake, scaling: title.scaling,
    }));
  } catch { /* private mode etc. — the session still works, unsaved */ }
  applySettings();
}
const KAIZO_WORDMARK = () => [
  ['KAIZO', getSwordcolor(state)],
  [' KNIGHT SIMULATOR', [255, 255, 255]],
];

// `?frames=N` is a deterministic fast-forward for debugging and it has no
// business sitting behind a menu, so that one boots straight in, exactly as
// the whole page used to.
if (skip > 0) title.mode = 'normal';

let over = null;   // the Knight's own Game Over (see render/title.js)
let tvOff = null;  // the CRT power-off that closes a won run

function reset() {
  audio.stopAll();
  maskHeldInput();
  resetTensionBar();
  state = createState({
    seed: (Math.floor(performance.now()) % 100000) + 1,
    traceBulletSlots: 0,
    bag: settings.bag ?? undefined,
  });
  state.spriteFrames = renderer.spriteFrames;
  state.spriteRate = renderer.spriteRate;
  applyLoadout(state);
  buildKaizoScene(state, { version: versionId });
  acc = 0;
}

/**
 * Leave the title for the fight. `state.runMode` is what the director reads
 * (ENDLESS must not reach the ending), and it has to be set BEFORE reset()
 * builds the scene.
 */
function startRun() {
  state.runMode = title.mode;
  maskHeldInput();
  reset();
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') reset();
});

function frame(now) {
  lastFrameRun = now;
  const elapsed = now - last;
  last = now;

  {
    const pe = gamepad.driverEdges();
    if (pe.reset) reset();
  }

  // THE MENU, while no mode is chosen. The fight does not step behind it.
  if (!title.mode) {
    const { steps: ms } = drain(acc, elapsed);
    acc = 0;
    for (let i = 0; i < Math.max(1, ms); i++) {
      const r = stepTitle(title, gatedKeys(), ATTACK_MENU);
      if (r.moved) audio.play([{ name: 'snd_menumove', pitch: 1, gain: 1 }]);
      if (r.selected) audio.play([{ name: 'snd_select', pitch: 1, gain: 1 }]);
      if (r.error) audio.play([{ name: 'snd_error', pitch: 1, gain: 1 }]);
      if (title.dirty) {
        title.dirty = false;
        persistSettings();
        applySettings();
      }
      if (r.chosen) {
        // SINGLE ATTACK IS REFUSED HERE, and deliberately. Its picker is
        // ATTACK_MENU -- the VANILLA roster (sim/scenes/single.js) -- so
        // choosing it would run vanilla attacks under a page banner that says
        // KAIZO, which is exactly what this repo's fourth law forbids
        // ("nothing invented ships unlabelled", and its converse: nothing
        // labelled kaizo may quietly be the real fight). It needs a kaizo
        // attack table of its own before it can be honest; until then the
        // menu row is visible but refuses, rather than lying.
        if (title.mode === 'single') {
          title.mode = null;
          audio.play([{ name: 'snd_error', pitch: 1, gain: 1 }]);
        } else {
          startRun();
        }
        break;
      }
    }
    if (title.mode) {
      requestAnimationFrame(frame);
      return;
    }
    // THE FOUNTAIN ONLY, exactly as the vanilla title does it (web/main.js):
    // reset the transform the fight's renderer leaves behind, clear, draw the
    // background, then the menu. Calling renderer.draw(state) here instead --
    // which is what this first did -- draws the whole FIGHT under the menu, and
    // render/title.js's own header says why that is wrong: the party, the HP
    // bars, the TP meter and a stray soul stay legible through the text and it
    // reads as a pause screen. It also leaves the renderer's transform in place
    // for everything drawn afterwards.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, renderer.VIEW_W, renderer.VIEW_H);
    drawBackground(ctx, state, renderer.sprites);
    drawTitle(ctx, title, renderer.sprites, ATTACK_MENU, { title: KAIZO_WORDMARK() });
    requestAnimationFrame(frame);
    return;
  }

  // THE TV TURNS OFF after a won run, then the fight restarts fresh — the
  // kaizo page returns to its title screen.
  if (tvOff) {
    const { steps: ts, accumulator: ta } = drain(acc, elapsed);
    acc = ta;
    for (let i = 0; i < ts; i++) {
      const cues = [];
      stepTvTurnoff(tvOff, cues);
      for (const c of cues) {
        if (c.stop) audio.stopLoop(c.name);
        else audio.play([c]);
      }
      if (tvOff.done) break;
    }
    drawTvTurnoff(ctx, tvOff, renderer.sprites);
    if (tvOff.done) {
      tvOff = null;
      maskHeldInput();
      reset();
    }
    requestAnimationFrame(frame);
    return;
  }

  // GAME OVER — the Knight's own. GO BACK refights; GO FORWARD leaves kaizo
  // for the real fight's page, which is this page's version of "move on".
  if (over) {
    const { steps: gs, accumulator: ga } = drain(acc, elapsed);
    acc = ga;
    for (let i = 0; i < gs; i++) {
      const r = stepGameOver(over, gatedKeys());
      if (r.moved) audio.play([{ name: 'snd_menumove', pitch: 1, gain: 1 }]);
      if (r.chosen !== undefined) {
        audio.play([{ name: 'snd_select', pitch: 1, gain: 1 }]);
        audio.stopLoop('audio_drone');
        over = null;
        if (r.chosen === 0) reset();
        // The real fight's page, by URL: this repo's index.html is a redirect
        // back to THIS page, so a relative hop would refight, not move on.
        else location.href = 'https://radi0show.github.io/knight-sim/web/';
        break;
      }
    }
    renderer.draw(state);
    if (over) drawGameOver(ctx, over, renderer.sprites);
    requestAnimationFrame(frame);
    return;
  }

  {
    const { steps, accumulator } = drain(acc, elapsed);
    acc = accumulator;
    for (let i = 0; i < steps; i++) {
      stepFrame(state, gatedKeys());
      audio.play(drainCues(state));

      // The win: the ending's white fade has filled. No story cutscene here —
      // that is the REAL fight's ending, and this is not the real fight; the
      // TV just switches off, the way Chapter 3 closes a scene.
      if (!tvOff && (state.endFade ?? 0) >= 1) {
        maskHeldInput();
        tvOff = createTvTurnoff();
        break;
      }

      if (state.gameOver) {
        audio.stopAll();
        audio.play([{ name: 'snd_hurt1', pitch: 1, gain: 1 }]);
        renderer.draw(state);
        const shot = document.createElement('canvas');
        shot.width = renderer.VIEW_W;
        shot.height = renderer.VIEW_H;
        shot.getContext('2d').drawImage(canvas, 0, 0);
        maskHeldInput();
        audio.stopLoop('mus_knight');
        audio.play([{ name: 'audio_drone', pitch: 1, gain: 1, loop: true }]);
        over = makeGameOver(
          shot,
          (state.soul?.x ?? renderer.VIEW_W / 2) + 2 - (state.view?.x ?? 0),
          (state.soul?.y ?? 170) + 2 - (state.view?.y ?? 0),
        );
        break;
      }
    }
  }

  renderer.draw(state);
boot('starting…');
  requestAnimationFrame(frame);
}

// The loop + the rAF watchdog, exactly as main.js documents them.
let lastFrameRun = performance.now();
requestAnimationFrame(frame);
let rafTick = performance.now();
const rafProbe = () => { rafTick = performance.now(); requestAnimationFrame(rafProbe); };
requestAnimationFrame(rafProbe);
let fallback = null;
setInterval(() => {
  const stale = performance.now() - rafTick > 500;
  const visible = document.visibilityState === 'visible';
  if (stale && visible && !fallback) {
    fallback = setInterval(() => frame(performance.now()), 33);
  } else if (!stale && fallback) {
    clearInterval(fallback);
    fallback = null;
  }
}, 250);

// THE SERVICE WORKER — this game's own. Module-relative like knight-sim's
// registration (web/main.js), and for the same reason: a hub that hosts this
// driver from a page one level up would resolve a document-relative
// './sw.js' somewhere that does not exist. The worker's cache prefix is
// kaizoknight-, and it only ever deletes its own prefix (see web/sw.js), so
// it cannot evict the real fight's cache on a shared origin, nor be evicted.
//
// NOT ON LOCALHOST, and this cost a whole debugging session. web/sw.js is
// CACHE-FIRST (`caches.match(...).then((hit) => hit ?? fetch(...))`) and it
// precaches './kaizo.js', with skipWaiting() + clients.claim() so it takes
// over the very load that registers it. In development that means the browser
// serves the PREVIOUS kaizo.js forever: you edit the file, the dev server
// (tools/devserver.py, no-store, module URLs versioned per load) serves the
// new one correctly, curl shows the new one -- and the page keeps running the
// old one, with no error anywhere. It reads exactly like the page failing to
// boot.
//
// So the worker is a production-only affordance now, and a local load also
// TEARS DOWN whatever a previous visit installed, because unregistering only
// on the next load would leave the first one still stale.
const swLocal = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
if ('serviceWorker' in navigator && !swLocal) {
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch(() => {});
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((rs) => Promise.all(rs.map((r) => r.unregister())))
    .then(() => caches.keys())
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('kaizoknight-')).map((k) => caches.delete(k))))
    .catch(() => {});
}

// THE BUILD NUMBER, on the banner the page already carries, so a bug report
// can name its build (web/version.js). knight-sim draws VERSION on its title
// screen; this page never shows that screen, so the banner is where it goes.
{
  const sub = document.querySelector('#kaizo-banner .sub');
  if (sub) sub.append(` \u00b7 v${VERSION}`);
}
