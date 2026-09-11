// KAIZO KNIGHT — the browser driver for web/kaizo.html.
//
// SEPARATE REPO SINCE 2026-09-02: this is kaizo-knight-sim, and the whole repo is
// kaizo. sim/, render/, input/, assets/ and tools/ are a VENDORED snapshot of
// knight-sim (docs/VENDOR.md says which one) — fix the engine THERE, then
// re-vendor (kaizo/tools/vendor-engine.mjs). The isolation contract below is
// kept as history: it is what made this page separable in the first place.
//
// KAIZO-OWNED: this is the one file under web/ allowed to import from kaizo/
// (kaizo/HANDOFF.md §2 — the ISOLATION CONTRACT bans the EXISTING pages from
// doing so; this page is new, imports one-way, and deleting kaizo/ plus this
// page leaves the main sim untouched. No main-page code path changes for
// kaizo's sake.)
//
// A SIBLING OF knight-sim's web/main.js, KEPT IN STEP WITH IT (2026-09-08,
// against knight-sim 4aa2b63). Everything OUTSIDE THE FIGHT — the title and
// its four modes, the SETTINGS hub (GEAR, ITEMS, GRAPHICS, the sliders,
// SHARE SETUP, CREDITS), settings persistence, share links, the opening
// roar, the game over, the ending scene, the TV-off, the one exit, the
// held-input latch, the watchdog, the app shell — is main.js's code hunk for
// hunk, with main.js's comments, so the two builds feel like one product.
// When main.js moves, diff the two (`diff --strip-trailing-cr`) and port.
// What is kaizo's own here, and ONLY this:
//
//   - the wordmark (KAIZO_WORDMARK, painted in the Knight's own blue);
//   - the scene: buildKaizoScene / KAIZO_VERSIONS / KAIZO_NOTE stand in for
//     the practice + single-attack builders, and SINGLE is refused (below);
//   - the renderer's override seam (KAIZO_DRAW_OVERRIDES), the sprite
//     overlay, and the mod's own song over mus_knight;
//   - the boot breadcrumbs in the console;
//   - the settings key: kaizoknight.settings, seeded once from the real
//     fight's entry (the shared-origin hazard, at SETTINGS_KEY);
//   - `?frames=` booting past the title, and `?nosw` (the foot of the file);
//   - the version series (web/version.js) and the kaizoknight- cache prefix.
//
//   ?seed=N        the RNG seed (R randomizes, exactly like the main page)
//   ?frames=N      deterministic fast-forward before first paint (idle input)
//   ?v=A|C|D       which KAIZO_VERSIONS entry to run
//   ?mode=...      skips the title (main.js's rule; `practice` is refused)
//   ?replay=TOKEN  a replay token (kaizo-trace's feed) watched in the browser
//   ?cfg=TOKEN     a shared setup — gear, bag, mode — validated as main.js does
//   ?nosw          no service worker (developing)

import { createState, stepFrame } from '../sim/index.js';
import { drain } from '../sim/clock.js';
import { buildKaizoScene, KAIZO_NOTE, KAIZO_VERSIONS } from '../kaizo/scenes/kaizo-fight.js';
import { getSwordcolor } from '../kaizo/attacks/kaizo-colors.js';
import { decodeReplay } from '../sim/replay.js';
import { createTitle, stepTitle, MODES, CREDITS, creditLink, armUnused } from '../sim/modes.js';
import {
  loadProceed, saveProceed, weirdRouteTabs, weirdRouteGear,
  gearOverrideFromTabs, padLoadout, PROCEED_VERSION, PROCEED_SHATTER_SPRITE,
} from '../kaizo/ui/proceed.js';
import { encodeConfig, decodeConfig, NONE } from '../sim/share.js';
import { WEAPONS, ARMOR, canEquip } from '../sim/equipment.js';
import { ITEMS } from '../sim/items.js';
import { drawTitle, drawGameOver, stepGameOver, makeGameOver } from '../render/title.js';
import { drawBackground } from '../render/background.js';
import { ATTACK_MENU } from '../sim/scenes/single.js';
import { bindKeyboard } from '../input/keyboard.js';
import { bindTouch } from '../input/touch.js';
import { bindGamepad } from '../input/gamepad.js';
import { createRenderer } from '../render/canvas.js';
import { createIntroScene, stepIntroScene } from '../sim/intro.js';
import { drawIntroScene } from '../render/draw/intro-fx.js';
import { createVictoryScene, stepVictoryScene } from '../sim/victory-scene.js';
import { drawVictoryScene } from '../render/draw/victory-scene.js';
import { createTvTurnoff, stepTvTurnoff } from '../sim/tvturnoff.js';
import { drawTvTurnoff } from '../render/draw/tvturnoff.js';
import { createAudio } from '../render/audio.js';
import { deltaruneMultiplier } from '../render/windowsize.js';
import { drainCues } from '../sim/audio.js';
import { resetTensionBar } from '../render/tensionbar.js';
// THE MOD'S DRAW EVENTS, handed to the renderer through its override seam
// (render/canvas.js, createRenderer's header). Same direction as every other
// import here: this page reaches into kaizo/, render/ never does.
import { KAIZO_DRAW_OVERRIDES } from '../kaizo/render/index.js';
// AND ONE MORE ROW, WHICH IS NOT A CHANGED DRAW BUT A MISSING ONE. The roar
// finale's 31 screen-shatter pieces have been simulated since 2026-09-08 and
// painted by nothing — ledger G-38. `kaizo/ui/shatter-draw.js` is the drawer;
// it is spread here rather than into `KAIZO_DRAW_OVERRIDES` because that map is
// frozen, is the registry of the mod's CHANGED Draw events, and is another
// lane's file. The same `render/shatter.js` paints the UNUSED row's break.
import { KAIZO_SHATTER_OVERRIDE } from '../kaizo/ui/shatter-draw.js';

// The label reaches the console too, for anyone reading a bug report's log.
// The page note; the running version's own note follows once it is known (below).
console.log(KAIZO_NOTE);

const canvas = document.getElementById('game');

// ── THE BOOT HUD ─────────────────────────────────────────────────────────
//
// This page fetches ~1,660 sprite frames before it can draw anything, and
// until it does the canvas is plain black. If ANY of that stalls -- a slow
// server, a throttled background tab, a request that never returns -- the
// page is indistinguishable from a page that crashed: black, silent, no
// error anywhere. That cost a whole session of debugging, so boot now says
// where it is.
// CONSOLE ONLY. This used to paint the stage onto the canvas, which made a
// slow load legible instead of a black screen -- but the page is meant to look
// exactly like the vanilla one, and the vanilla one shows black while it
// loads. The breadcrumbs stay in the log, where they cost a player nothing and
// still say which stage a bug report died at.
function boot(msg) {
  console.log('[kaizo boot] ' + msg);
}
boot('loading sprites…');

const renderer = await createRenderer(canvas, {
  overrides: { ...KAIZO_DRAW_OVERRIDES, ...KAIZO_SHATTER_OVERRIDE },
});
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

/**
 * HOW THE 640x480 FRAME MEETS THE WINDOW — a GRAPHICS setting, because the
 * two answers are genuinely different and neither is right for everyone.
 *
 *   FULL   fill the window, letterboxed on the short axis. The default, and
 *          what fullscreen should look like.
 *   SMALL  the size DELTARUNE ITSELF would open at on this display, leaving
 *          black around the edges. Not "the biggest whole multiple that
 *          fits" -- that was the old behaviour and it is a different, larger
 *          number on most screens. See deltaruneMultiplier() below.
 *
 * The trade is unavoidable. `image-rendering: pixelated` at a fractional
 * factor gives some source columns n device pixels and their neighbours n + 1,
 * so a one-pixel font stem is fat on one letter and thin on the next — the
 * "weird" menu text. SMALL is the only mode that cannot do that; FULL is the
 * only one that fills the screen. Measuring in DEVICE pixels is what makes
 * SMALL exact: a 2x display turns 640 CSS px into 1280 real ones, and only the
 * real count has to divide evenly.
 *
 * FULL used to be the only behaviour, then SMALL was, and each was reported as
 * a regression by the other's standard. Now it is a switch.
 */
let scalingMode = 'fit';

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const availW = window.innerWidth * dpr;
  const availH = window.innerHeight * dpr;
  const fit = Math.min(availW / renderer.VIEW_W, availH / renderer.VIEW_H);
  let scale = fit;
  if (scalingMode === 'pixel' && fit >= 1) {
    // The game's own answer, then clamped to what the BROWSER WINDOW can
    // actually show. A real window can be the full display; a canvas cannot,
    // because the browser's own chrome is in the way -- so without this the
    // arena would hang off the bottom on a maximised window. The clamp is a
    // deviation the browser forces, and it only ever reduces.
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
// A window dragged between displays changes devicePixelRatio without ever
// firing `resize`; this is the documented way to hear about that.
if (window.matchMedia) {
  const watchDpr = () => {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', () => { fitCanvas(); watchDpr(); }, { once: true });
  };
  watchDpr();
}
// THE MOD'S OWN SONG. Kaizo Roaring Knight ships `kaizoknight.ogg` beside the
// mod ("custom song (optional)/"), and it is what plays over this fight, so the
// recreation plays it rather than the vanilla knight theme.
//
// It lives under kaizo/assets/, which is PUBLISH-GATED in full by that
// directory's own .gitignore -- it is EnderCat8's work, and kaizo/HANDOFF.md
// §5-C is explicit that republishing another author's work needs their
// permission. So the file is used locally and committed nowhere, exactly like
// the sprite overlay. A clone without it falls back to the vanilla theme on its
// own: an override whose file 404s leaves the cue in `missing` and the loader
// carries on.
const audio = createAudio({
  overrides: {
    mus_knight: new URL('../kaizo/assets/audio/kaizoknight.ogg', import.meta.url).href,
  },
});
const keyboard = bindKeyboard(window);
const gamepad = bindGamepad();
// THE TOUCH OVERLAY — a d-pad and Z/X/R, shown only where the primary
// pointer is coarse (the CSS media query owns visibility; binding it
// everywhere costs nothing on a desktop). X carries the keyboard's
// two-jobs mapping: held is the slow modifier, tapped is cancel. R has two
// jobs too, split by duration: a TAP is the key's reset(), a HOLD (~0.6 s)
// is Escape's exitRun() — the overlay has no room for a fourth button
// (input/touch.js has the timing).
// A link the touch handler already opened, so the loop's own open (from the
// same latched confirm, one frame later) can be swallowed instead of opening
// the page twice.
let syncOpenedLink = null;
const touch = bindTouch({
  pad: document.getElementById('dpad'),
  buttons: [
    { el: document.getElementById('btnZ'), actions: ['confirm'] },
    { el: document.getElementById('btnX'), actions: ['focus', 'cancel'] },
    { el: document.getElementById('btnR'), actions: ['reset'] },
  ],
  onReset: () => reset(),
  onExit: () => exitRun(),
  // LINKS MUST OPEN INSIDE THE GESTURE. The credits page's confirm returns an
  // href that the frame loop passes to window.open — fine for a keyboard,
  // where the keydown's user-activation is still fresh when the 30Hz step
  // runs, but iOS Safari refuses a popup whose open() is not in the gesture
  // handler's own call stack. So when a TAP lands on Z while the credits page
  // has a linked row under the cursor, the open happens here, synchronously;
  // the loop's duplicate is swallowed via syncOpenedLink. Every other state
  // ignores the hook and the tap flows through the ordinary latch.
  onAction: (a) => {
    if (a !== 'confirm' || title.mode !== null) return;
    const s = title.settings;
    if (!s || s.page !== 'credits') return;
    const href = creditLink(CREDITS[s.cursor] ?? {});
    if (!href) return;
    window.open(href, '_blank', 'noopener,noreferrer');
    syncOpenedLink = href;
  },
});
// One reader, three sources: the sim sees the OR of keyboard, controller and
// touch, so all work at once and none can mask another.
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

const params = new URLSearchParams(location.search);

// THE SCENE. main.js chooses here between the full fight and one attack on
// repeat (`?mode=practice&attack=<id>&difficulty=<n>`); this page has exactly
// one scene, the kaizo fight, and `?v=` picks which KAIZO_VERSIONS entry
// builds it (registry in kaizo-fight.js; unknown -> C):
//   C = the Kaizo Roaring Knight v2.3.3 recreation — THE DEFAULT since
//   2026-09-08 (it used to be A, the invented remix over vanilla attacks,
//   which is why "most attacks that should appear don't appear at all");
//   D = its B-Side (the Weird Route, Kris & Noelle); A = the old remix.
// `?mode=` still skips the title the way main.js's does (below); `practice`
// is refused, for the reason the title loop gives at SINGLE.
//
// ── AND THE UNUSED ROW CAN NOW CHOOSE IT ──────────────────────────────────
//
// `?v=D` used to be the ONLY way onto the Weird Route: a URL parameter, which
// is a developer's door. The settings hub's UNUSED row is the player's —
// press it until it breaks and it becomes PROCEED, and taking that switches
// this whole build to V-D, the menus with it. kaizo/ui/proceed.js carries the
// provenance (what is EnderCat8's and what is ours) and owns the persistence;
// sim/modes.js counts the presses and knows nothing about any of this.
//
// `let`, not `const`: `enterWeirdRoute()` below moves it at runtime, which is
// what "the whole build switches" means. An EXPLICIT `?v=` still wins, so a
// link to `?v=C` shows the A-Side even to a player who has proceeded — a
// deliberate escape hatch for bug reports, and the only one: the row itself
// is one-way.
const explicitVersion = params.get('v');
let versionId = KAIZO_VERSIONS[(explicitVersion ?? 'C').toUpperCase()]
  ? (explicitVersion ?? 'C').toUpperCase()
  : 'C';

// THE EQUIP SCREEN'S ROSTER travels with the version. `title.party` null is
// the vanilla three (sim/modes.js `partyTabs`); on the Weird Route it is Kris
// and Noelle, and Susie and Ralsei are simply not there — which is
// `scr_fixparty([1, 4]) == [1, 4, 0]` and not a decision made here.
let weirdRoute = false;
function enterWeirdRoute() {
  weirdRoute = true;
  versionId = PROCEED_VERSION;
  title.party = weirdRouteTabs();
  title.gear = savedProceed.gear ?? weirdRouteGear();
}

function build(st) {
  // THE GEAR OVERRIDE IS THE WIRE FROM THE MENU TO THE FIGHT. Without it the
  // equip page edits `title.gear` and `installRoster` goes on handing out its
  // own defaults — the menu would look like it worked and change nothing.
  // CHARACTER-indexed, because that is what `gearOfChar` reads.
  buildKaizoScene(st, {
    version: versionId,
    gear: weirdRoute ? gearOverrideFromTabs(title.party, title.gear) : undefined,
  });
}

/** The loadout `sim/damage.js`'s vanilla-shaped consumers walk, always three
 *  long — see padLoadout's note on why a two-entry array throws. */
function loadoutGear() {
  return weirdRoute
    ? padLoadout(title.gear)
    : title.gear.map((g) => ({ weapon: g.weapon, armor: [...g.armor] }));
}

// ?replay=<token> REPLAYS A RUN in the browser, input and all.
//
// `?frames=N` fast-forwards with NO input, which lands on a different state
// than the tester saw the moment they touched a key. A token carries the
// input stream, so this is the only way to put human eyes on the exact frame
// a report is about — and the renderer is the half the token cannot check by
// itself. kaizo/tools/kaizo-trace.mjs runs the same token headlessly.
const replayToken = params.get('replay');
let replay = null;
if (replayToken) {
  try {
    replay = decodeReplay(replayToken);
    if (replay.meta.mode === 'practice') {
      // A SINGLE-attack run: this page has no kaizo attack table to run it
      // against (see the title loop), so it is refused rather than misrun.
      console.error('bad replay token: a SINGLE-attack run; this page has no kaizo attack table');
      replay = null;
    }
  } catch (err) {
    console.error(`bad replay token: ${err.message}`);
  }
}

// ---- THE TITLE SCREEN AND THE FOUR MODES --------------------------------
//
// `title.mode` is null while the menu is up. A URL that names a mode skips it
// entirely.
//
// THE WORDMARK IS THE ONE DIFFERENCE from the vanilla title, and KAIZO is
// painted in the Knight's own blue: `getSwordcolor()` is the mod's single
// source for that colour (kaizo/attacks/kaizo-colors.js -- swordtype 0, pure
// blue, the `default` arm the mod ships), so if the swordtype setting ever
// moves, the wordmark moves with it instead of holding a hardcoded hex that
// quietly drifts.
boot('building the title…');
const title = createTitle();

// SETTINGS PERSISTENCE — the loadout and the volumes survive reloads.
//
// TWO KEYS, ONE WRITTEN. knight-sim and this build sit on the SAME ORIGIN in
// production, so they share localStorage, and a second page writing
// `knightsim.settings` would silently rewrite the real fight's volume, gear
// and bag (web/index.html's comment names that hazard as the reason the root
// redirects rather than standing in a copy of the title page). So this page
// writes its OWN key. The main page's entry is still read, but only to SEED
// this one the first time, so anyone who had already built a loadout on the
// real fight arrives here with it instead of at the defaults. After that the
// two are independent, which is what the shared origin requires.
const SETTINGS_KEY = 'knightsim.settings';        // the real fight's; read-only here
const KAIZO_SETTINGS_KEY = 'kaizoknight.settings'; // this page's; the only one written
try {
  // This page's own entry wins; the real fight's is the one-time seed.
  const saved = JSON.parse(
    localStorage.getItem(KAIZO_SETTINGS_KEY) ?? localStorage.getItem(SETTINGS_KEY) ?? 'null',
  );
  if (saved?.gear?.length === 3) {
    title.gear = saved.gear.map((g) => ({ weapon: g.weapon | 0, armor: (g.armor ?? []).map((a) => a | 0) }));
  }
  if (Array.isArray(saved?.bag)) {
    // Length-checked and id-checked on the way in: a stale entry from before
    // an item was renumbered must not put an unknown id in a slot, and the
    // page has no way to show one.
    const bag = saved.bag.map((v) => v | 0).slice(0, 12);
    while (bag.length < 12) bag.push(0);
    title.bag = bag;
  }
  // A SAVED VOLUME ONLY WINS IF IT WAS A CHOICE.
  //
  // `persistSettings()` runs once at load, so every entry written before the
  // default dropped to 50 holds `100` whether or not anyone touched a slider
  // — the old default, saved automatically. Honouring those would have meant
  // the new default reached nobody who had ever opened the page. `v` marks
  // entries written since, and only those carry their volumes forward;
  // everything else in a pre-`v` entry (gear, bag, shake, scaling) is still
  // read, because those only ever change by hand.
  if (saved?.volumes && (saved.v | 0) >= 1) {
    title.volumes.music = Math.max(0, Math.min(100, saved.volumes.music | 0));
    title.volumes.sfx = Math.max(0, Math.min(100, saved.volumes.sfx | 0));
  }
  if (typeof saved?.shake === 'boolean') title.shake = saved.shake;
  if (saved?.scaling === 'fit' || saved?.scaling === 'pixel') title.scaling = saved.scaling;
  // TOUCH BUTTONS (the Z/X swap). A missing field is simply false — no `v`
  // bump needed, nothing older can have set it.
  if (typeof saved?.swapZX === 'boolean') title.swapZX = saved.swapZX;
} catch { /* a corrupt entry falls back to the defaults */ }

// ── ARM THE UNUSED ROW, AND RESUME THE ROUTE IF IT WAS ALREADY TAKEN ──────
//
// `armUnused` is the opt-in: without this call `title.unused` stays null and
// the row is the dim, refusing, reserved one the vanilla build has — which is
// exactly what knight-sim's own driver leaves it as. Its own storage key, not
// the settings entry (kaizo/ui/proceed.js says why).
//
// A TAKEN ROUTE COMES BACK TAKEN, and a half-pressed one comes back
// half-pressed. The point of persisting is that the player is not doing the
// same twenty presses every load, and that the fight they chose is the fight
// the page opens on.
//
// THE SHEET IS HANDED OVER HERE, and this is the only place in the program
// where the two halves meet: `sim/` counts and `render/` paints, and neither
// may know the name of a sprite that only this build ships (the vanilla asset
// pack has no shatter sheet at all). `PROCEED_SHATTER_SPRITE` is
// EnderCat8's `spr_roaringknight_finalshatter` — see kaizo/ui/proceed.js.
const savedProceed = loadProceed();
armUnused(title, { ...savedProceed, sprite: PROCEED_SHATTER_SPRITE });
if (title.unused.taken && !explicitVersion) enterWeirdRoute();

// The log names the running version, so a bug report's console is
// self-identifying (the page banner that used to carry it is gone). AFTER the
// arming, or it would name the version the page was about to leave.
boot(`version ${versionId} — ${KAIZO_VERSIONS[versionId].name}`);
if (KAIZO_VERSIONS[versionId].note) console.log(KAIZO_VERSIONS[versionId].note);

// ?cfg=<token> — A SHARED SETUP, and it WINS over the saved settings.
//
// Following someone's link is an explicit act: it should show you their fight,
// not yours with their name on it. That is why this is applied after the load
// above. It does NOT touch volume, shake or scaling — those are how a person
// sits in front of a screen, and a link that silently reset them would be a
// bad trade for a share button. See sim/share.js.
//
// Everything in the token is validated against the real tables before it is
// used: `canEquip` is the game's own char-flag rule, so a link cannot put
// Susie's axe on Ralsei any more than the equip menu can, and an unknown item
// id becomes an empty slot rather than reaching a renderer that cannot draw it.
const sharedCfg = decodeConfig(params.get('cfg'), {
  weaponOk: (id, c) => id === 0 || (!!WEAPONS[id] && canEquip('weapon', id, c)),
  armorOk: (id, c) => id === 0 || (!!ARMOR[id] && canEquip('armor', id, c)),
  itemOk: (id) => !!ITEMS[id],
  modeCount: MODES.length,
  attackCount: ATTACK_MENU.length,
});
if (sharedCfg) {
  // A SHARED LOADOUT IS A THREE-PERSON LOADOUT, always: encodeConfig writes
  // three slots and decodeConfig refuses anything with a gap ("all nine or
  // none", sim/share.js). On the Weird Route there are TWO tabs, so applying
  // one would put Susie's build on Noelle and leave Ralsei's in an array
  // position no tab addresses — the sharer's setup wearing the wrong
  // character's name, which is the exact thing the decoder's all-or-nothing
  // rule exists to prevent. Refused here for the same reason, one level up.
  if (sharedCfg.gear && !weirdRoute) title.gear = sharedCfg.gear;
  if (sharedCfg.bag) title.bag = sharedCfg.bag;
  // The roster picker's cursor, kept so the link round-trips through SHARE
  // SETUP unchanged. SINGLE is refused on this page (the title loop), so
  // neither index ever launches anything here.
  if (sharedCfg.attack !== null) title.attackIndex = sharedCfg.attack;
  if (sharedCfg.difficulty !== null) {
    const entry = ATTACK_MENU[title.attackIndex];
    // The token carries the INDEX the picker shows, and a link from an older
    // roster can point past the end of a shorter list.
    const di = Math.min(sharedCfg.difficulty, entry.difficulties.length - 1);
    title.difficultyIndex = Math.max(0, di);
  }
  // A pinned MODE skips the title, the same way `?mode=` does — the sharer
  // chose the fight, so the link opens it rather than a menu. A pinned SINGLE
  // opens on the title instead, for the reason above.
  if (sharedCfg.mode !== null && MODES[sharedCfg.mode].id !== 'single') {
    title.mode = MODES[sharedCfg.mode].id;
  }
}

let state = createState({
  seed: replay ? replay.meta.seed : Number(params.get('seed') ?? 12345),
  traceBulletSlots: 0,
  // THE SAVED BAG APPLIES HERE TOO. A `?mode=` deep link never reaches
  // `startRun` — it runs on THIS state — so with the title built after it,
  // a link ran the default loadout however the ITEMS page was set. The title
  // and its persistence load moved above this for that reason; they depend on
  // nothing here, while this depends on them.
  bag: title.bag,
});
state.spriteFrames = renderer.spriteFrames;
state.spriteRate = renderer.spriteRate;
// ...AND SO DOES THE SAVED GEAR, for the same reason the bag does: a deep link
// (`?frames=`, `?mode=`, `?replay=`, a pinned `?cfg=`) runs on this state and
// never passes through reset(), which is where every later run copies it.
// knight-sim's driver still runs those links on the default loadout — the one
// deliberate line here that main.js lacks, and a candidate port-back.
state.loadout.gear = loadoutGear();
build(state);

// ?frames=N fast-forwards the sim before the first paint. Deterministic —
// same code path as the headless verifier — so any moment in the fight can be
// reproduced and inspected without waiting for it in real time.
const skip = Number(params.get('frames') ?? (replay ? replay.frames : 0));
if (skip > 0) {
  const idle = keys.read();
  // A replay feeds its recorded input; everything else fast-forwards idle.
  for (let i = 0; i < skip; i++) {
    stepFrame(state, replay ? replay.inputAt(i) : idle);
  }
}

let acc = 0;
let last = performance.now();

/**
 * A BUTTON HELD ACROSS A TRANSITION MUST NOT ACT ON THE OTHER SIDE.
 *
 * Confirming a mode on the title screen used to fire Kris's FIGHT the instant
 * the fight opened, unless you let go of Z faster than a human reliably can.
 * The battle menu IS edge-triggered — but its `menu.held` map starts empty, so
 * the first frame of a still-held key reads as a fresh 0->1 edge. Same for the
 * game over's two options, and for R restarting into a run.
 *
 * The original has this problem too and solves it exactly here: obj_heart's
 * Create latches `disableslow` when the focus button is ALREADY down, so
 * holding focus through the transition into a fight does not slow the opening
 * frames. This is that latch, generalised to every button — the transition
 * happens at a moment the player did not choose, so nothing they were already
 * holding should count as an intent aimed at what comes next.
 *
 * The mask clears per key on release, so holding Z through the transition and
 * keeping it down does not lock FIGHT out — it just requires a new press.
 */
let inputMask = {};
function gatedKeys() {
  const raw = keys.read();
  const out = { ...raw };
  for (const k of Object.keys(inputMask)) {
    if (!raw[k]) delete inputMask[k];      // released: the key is live again
    else out[k] = false;                   // still down from before: not a press
  }
  return out;
}
/** Latch everything currently down; called at every scene change. */
function maskHeldInput() {
  inputMask = {};
  const raw = keys.read();
  for (const k of Object.keys(raw)) if (raw[k]) inputMask[k] = true;
}

function reset() {
  // Sustained cues do not belong to the sim state — rotating slash's aim loop
  // would keep whining over a fresh fight.
  audio.stopAll();
  // Whatever is down right now belongs to the thing that just ended.
  maskHeldInput();
  // The bar's two trailing values are renderer-local, so a fresh fight has to
  // clear them or the new run starts with the old one's TP draining away.
  resetTensionBar();
  // The vista's animation accumulator survives a reset — an R-restart is a
  // fresh battle in the SAME room, not a re-run of the story intro.
  const vistaFs = state?.vistaFsBase ?? 0;
  state = createState({
    seed: (Math.floor(performance.now()) % 100000) + 1,
    traceBulletSlots: 0,
    // THE BAG COMES FROM SETTINGS TOO, the same way the gear does. It has to
    // be passed to createState rather than assigned after, because the battle
    // menu snapshots `state.inventory` into its per-character tempitem lists
    // as soon as the scene is built.
    bag: title.bag,
  });
  // THE DIRECTOR READS THIS (kaizo-practice.js, kaizo-vc-hooks.js: ENDLESS
  // must not reach the ending). It has to land on the NEW state — this page
  // used to set it on the old one just before createState replaced it, so
  // ENDLESS never actually looped here.
  state.runMode = runMode;
  state.vistaFsBase = vistaFs;
  // THE LOADOUT COMES FROM SETTINGS. The title's equip menu edits title.gear;
  // every fresh fight is built with a copy of it (sim/damage.js gearOf).
  state.loadout.gear = loadoutGear();
  // …and so does the shake switch. A fresh state starts with flag 12 clear, so
  // without this an R-restart silently turned the camera shake back on.
  state.flag12 = title.shake ? 0 : 1;
  state.spriteFrames = renderer.spriteFrames;
  state.spriteRate = renderer.spriteRate;
  build(state);
  acc = 0;
}

/**
 * LEAVE THE RUN FOR THE TITLE — the inverse of startRun(), and the ONE path
 * back. There was none: the only writes of `title.mode = null` were the two
 * end-of-fight branches (a won run's TV-off and the game over's GO FORWARD),
 * and ENDLESS and HITLESS restart on death while SINGLE cannot die at all,
 * so three of the four modes had no way out short of reloading the page —
 * three separate reports. Escape, a pad's Start and a HELD touch R all land
 * here, and those two branches call it too, so there is exactly one exit
 * and it cannot drift.
 *
 * reset() does not clear the driver-side sequences (it is a restart; they
 * belong to the run being left), so they are nulled here first. Its
 * audio.stopAll() then kills mus_knight / the drone / the wind, and its
 * maskHeldInput() eats the exit press — the still-held Escape/Start is
 * masked until released, so the title cannot read it as a cancel and back
 * out of a page. A no-op on the title, so a second press there is nothing.
 * `hitlessDeaths` is left alone on purpose: nothing resets it today either.
 */
function exitRun() {
  if (title.mode === null) return;
  over = null;
  introSeq = null;
  cutsceneSeq = null;
  tvOff = null;
  title.mode = null;
  title.pickingAttack = false;
  title.pickingDifficulty = false;
  reset();
}

// R RESTARTS AND ESCAPE EXITS — the only keys the page binds beyond movement.
//
// The debug affordances that used to live here — P pause, Q music, B copy a
// replay token, E deal 1000 to the Knight — are gone, along with the `?hud=1`
// readout, the `?pause=1` freeze and the window.__sim / __intro / __cutscene
// inspection handles. They were for building the thing, not for playing it,
// and a practice tool should not offer the player a key that skips the fight.
//
// `!e.repeat`, and it is not optional: the DOM re-fires keydown for as long
// as a key is held (~30/s after the OS delay) and reset() is unconditional —
// a full rebuild with a fresh seed on every call. A 2 s hold of R delivered
// 47 keydowns and 47 restarts, the run starting over every ~33 ms until
// release; reported from play as R "retrying again and again". The binder in
// input/keyboard.js was never the problem (its Set latch gives ONE press edge
// for the same train) — this raw listener was. Measured, repro-C4: 47 -> 1.
//
// REGISTRATION ORDER IS LOAD-BEARING. bindKeyboard(window) at the top of the
// file registered its keydown FIRST, so on an Escape it has already latched
// `cancel` by the time this runs; exitRun -> reset -> maskHeldInput() then
// drains that latch and masks the held key, and the title sees nothing.
// Registered the other way round the title would see a 3-frame cancel and
// back out of whatever page it was on (repro-C4-review). Keep this below it.
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyR') reset();
  if (e.code === 'Escape') exitRun();
});

/** Push the settings at the things that consume them. No storage. */
function applySettings() {
  audio.setVolumes(title.volumes.music / 100, title.volumes.sfx / 100);
  // `global.flag[12]` in the sim's terms: SET means "do not move the view".
  state.flag12 = title.shake ? 0 : 1;
  if (scalingMode !== title.scaling) {
    scalingMode = title.scaling;
    fitCanvas();
  }
  // TOUCH BUTTONS: the Z/X swap is a CSS class on the overlay (web/kaizo.html
  // `#touch.swap`), so the binder's actions and the sim's input are identical
  // either way — only where the two buttons sit changes. Runs at load too
  // (applySettings is called below), so a saved swap is in place before the
  // first tap.
  document.getElementById('touch')?.classList.toggle('swap', title.swapZX);
}

/** Save to THIS PAGE'S key only -- see the note above SETTINGS_KEY. */
function persistSettings() {
  try {
    localStorage.setItem(KAIZO_SETTINGS_KEY, JSON.stringify({
      v: 1, // see the load above: pre-`v` entries hold the old 100 default
      // THE WEIRD ROUTE'S LOADOUT DOES NOT GO IN HERE, and the A-Side's must
      // not be destroyed by it. `title.gear` is TWO entries on that route, and
      // the loader above only accepts a saved loadout at `length === 3` — so
      // writing it would drop the player's three-person build on the way out
      // and then refuse to read the two-person one back in. Omitting the key
      // leaves the A-Side entry exactly as it was; the Weird Route's build
      // rides in the proceed entry instead (kaizo/ui/proceed.js).
      ...(weirdRoute ? {} : { gear: title.gear }),
      bag: title.bag,
      volumes: title.volumes,
      shake: title.shake,
      scaling: title.scaling,
      swapZX: title.swapZX,
    }));
  } catch { /* private mode etc. — the session still works, unsaved */ }
  // The row's own state, and on the Weird Route its loadout with it. Cheap,
  // and it means a press cannot be lost to a reload that happened to come
  // between two of them.
  saveProceed(title.unused, weirdRoute ? title.gear : (savedProceed.gear ?? null));
  applySettings();
}

// FOLLOWING A LINK MUST NOT OVERWRITE YOUR OWN SETUP.
//
// This used to be an unconditional `persistSettings()`, which writes
// `title.gear` and `title.bag` — and the shared config has already replaced
// both by this point. So opening someone's "beat my settings" link silently
// destroyed the loadout the visitor had built, permanently, before they had
// pressed anything. Caught by loading a link with a distinctive local bag set
// and watching the saved entry become the sharer's.
//
// A link now APPLIES without saving. Changing something afterwards still
// persists, which is right: adopting a setup you were shown is a deliberate
// act, arriving at it is not.
if (sharedCfg) applySettings(); else persistSettings();
// A DEEP LINK SKIPS THE TITLE. main.js maps `?mode=practice` to SINGLE and
// anything else to NORMAL; SINGLE is refused on this page (the title loop), so
// that one opens on the menu. A replay token is a fight and skips it too.
const deepMode = params.get('mode');
if (replay || (deepMode && deepMode !== 'practice')) title.mode = 'normal';
// `?frames=N` is a deterministic fast-forward for debugging and it has no
// business sitting behind a menu, so that one boots straight in, exactly as
// the whole page used to.
if (skip > 0) title.mode = 'normal';

/**
 * The current setup as a URL. Gear, bag, mode, attack and difficulty — the
 * things that make a run hard — and nothing about how the player's screen or
 * speakers are set.
 *
 * The MODE is only pinned once one has been chosen. Sharing from the settings
 * hub, before you have picked, produces a link that carries the loadout and
 * opens on the title, which is the honest thing: you configured a party, not
 * a fight.
 */
function shareUrl() {
  const modeIndex = title.mode ? MODES.findIndex((m) => m.id === title.mode) : NONE;
  const cfg = encodeConfig({
    mode: modeIndex < 0 ? NONE : modeIndex,
    attack: title.attackIndex,
    difficulty: title.difficultyIndex,
    gear: title.gear,
    bag: title.bag,
  });
  const url = new URL(location.href);
  // A share link is the setup and nothing else — `?frames=`, `?seed=` and a
  // `?replay=` token are all debugging state from whatever the sharer happened
  // to have open, and carrying them would hand someone a fast-forwarded or
  // pre-played run instead of a fight.
  url.search = '';
  url.searchParams.set('cfg', cfg);
  return url.toString();
}

/**
 * Copy it. `navigator.clipboard` needs a secure context and a user gesture —
 * a keypress is one — and is missing on plain http, so the textarea fallback
 * is not optional politeness: the dev server runs on http://localhost and
 * would have no working share button without it.
 */
function shareSetup() {
  const url = shareUrl();
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* nothing else to try */ }
    ta.remove();
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).catch(fallback);
  } else {
    fallback();
  }
}

const KAIZO_WORDMARK = () => [
  ['KAIZO', getSwordcolor(state)],
  [' KNIGHT SIMULATOR', [255, 255, 255]],
];

let over = null;          // the Game Over sequence, once the party is down
// THE WIN. The game hands the white fade to obj_ch3_PTB02's story cutscene
// (Susie against the Knight, Undyne, the bird) — overworld actors this build
// does not ship. The seam is cut at the fade: the tool holds the white, then
// shows its own card. Tool UI, styled like the title, labelled as the point
// where the story continues — not a recreation of it.
// THE CELEBRATION CARD IS GONE. It was tool-authored text ("THE KNIGHT LET
// DOWN ITS GUARD", a timer, a hits count) over a white fade — invented
// content in a project whose first rule is that nothing invented ships. A
// won run now ends the way Chapter 3 ends a scene: the TV switches off and
// the title screen comes back, so the state it used is gone with it.
// obj_tvturnoff_manager — the CRT power-off that closes a won run.
let tvOff = null;
// THE STORY SCENE between the white and the card — Susie against the Knight,
// Undyne, the bird. sim/victory-scene.js has the sourcing; it runs driver-
// side like the intro. Z advances dialogue; X skips the whole scene.
let cutsceneSeq = null;

/**
 * The card itself: white field easing back to black, the game's own closing
 * beat named for what it is, and the run's numbers — a practice tool's
 * scoreboard, in the fight's font.
 */
let hitlessDeaths = 0;

// THE OPENING ROAR — obj_knight_roaring_fx, run OUT HERE like the title
// screen, never inside the sim. The real one plays in the overworld before
// scr_battle exists, and keeping it driver-side means replay tokens, the
// whole-fight diff and every suite are byte-identical with or without it.
// The fight is already built and sits at frame 0 underneath; recording
// starts when the fight's own loop does.
let introSeq = null;

function startRun() {
  runMode = title.mode;
  // Entering from the title gets the roar; ENDLESS skips it (a treadmill).
  // R-reset never replays it.
  if (runMode === 'normal' || runMode === 'hitless') {
    introSeq = createIntroScene();
    // The title's confirm is still DOWN on the intro's first frames — an
    // ordinary ~100ms press spans four 30Hz steps — and the skip check would
    // read it as a fresh press (the held-across-a-transition rule).
    maskHeldInput();
  }
  // The director reads this: ENDLESS must not reach the ending.
  state.runMode = runMode;
  reset();
}

let runMode = title.mode ?? 'normal';

function frame(now) {
  lastFrameRun = now;
  const elapsed = now - last;
  last = now;

  // Select resets, mirroring R; Start EXITS to the title, mirroring Escape.
  // (Start was a `pause` edge the binder computed and nothing read, since
  // the pause went with the rest of the debug keys.) Polled here because the
  // Gamepad API has no events; edge-gated in the binder, so a held Start
  // exits once.
  {
    const pe = gamepad.driverEdges();
    if (pe.reset) reset();
    if (pe.exit) exitRun();
  }


  // THE TITLE SCREEN runs on the same clock as everything else, so its cursor
  // bobs at 30Hz like the battle menu's rather than at the monitor's rate.
  if (!title.mode) {
    const { steps: ts, accumulator: ta } = drain(acc, elapsed);
    acc = ta;
    for (let i = 0; i < ts; i++) {
      const r = stepTitle(title, gatedKeys(), ATTACK_MENU);
      if (r.moved) audio.play([{ name: 'snd_menumove', pitch: 1, gain: 1 }]);
      if (r.selected) audio.play([{ name: 'snd_select', pitch: 1, gain: 1 }]);
      // The equip menu's refusal, and UNUSED's whole personality.
      if (r.error) audio.play([{ name: 'snd_error', pitch: 1, gain: 1 }]);
      // A CREDITS row with a link. `sim/` returns the href and the DRIVER
      // opens it — the architecture rule is that sim/ has no DOM, and a
      // `window.open` inside it would also break every headless verifier.
      // `noopener` because the tool has no reason to hand a third-party page
      // a handle back to this one.
      if (r.link) {
        // Swallow the copy the touch handler already opened in-gesture.
        if (r.link === syncOpenedLink) syncOpenedLink = null;
        else window.open(r.link, '_blank', 'noopener,noreferrer');
      }
      // SHARE SETUP — build the link and put it on the clipboard.
      if (r.share) shareSetup();
      // THE UNUSED ROW HEATING UP. `r.press` is the count the press reached,
      // 1..UNUSED_PRESSES. The refusal sound has already played above for every
      // press but the last (the row is still refusing — it is going redder
      // WHILE it refuses), and the last one played `snd_select` instead, which
      // is the one press the row accepts. Persisted every time, so a reload
      // never costs a press.
      if (r.press) saveProceed(title.unused, weirdRoute ? title.gear : (savedProceed.gear ?? null));
      // THE BREAK. `r.shatter` is the frame the glass is created on, and it is
      // the frame the sound plays.
      //
      // CHAPTER 4 PLAYS ITS BREAK TWICE, at two pitches:
      //     snd_play_delay(break_noise, _delay_sound_time, 0.5, 0.5);
      //     snd_play_delay(break_noise, _delay_sound_time, 0.5, 0.44);
      // `gml_Object_obj_intro_ch4_Step_0.gml:177-178`. The DOUBLING and the two
      // PITCHES are transcribed. Two things are not, and both are stated rather
      // than quietly dropped:
      //   * `break_noise` is `snd_init("ch4_first_intro_breaking.ogg")`
      //     (`_Create_0.gml:50`) — a chapter 4 stream this pack does not have
      //     and has no licence to add. `snd_glassbreak` stands in; it is the
      //     sound sim/victory-scene.js already uses for breaking glass, at the
      //     same doubled-and-detuned shape.
      //   * The `_delay_sound_time` of 20 is not modelled — it exists so the
      //     sound lands ON the break, twenty frames after the call, and this
      //     driver's audio has no delay channel. Fired here, it lands with the
      //     PRESS instead of with the flight. A break that makes no sound at
      //     all would be worse.
      if (r.shatter) {
        audio.play([
          { name: 'snd_glassbreak', pitch: 0.5, gain: 1 },
          { name: 'snd_glassbreak', pitch: 0.44, gain: 1 },
        ]);
      }
      // ...AND THEN PROCEED. The point of no return: the build switches to the
      // Weird Route, menus included, and the fight in front of the player is
      // rebuilt on the spot rather than after a reload.
      //
      // ONE-WAY. `title.unused.taken` is written by sim/modes.js and never
      // cleared, and `enterWeirdRoute` is idempotent, so a second press is a
      // no-op rather than a toggle — which is the mod's own shape: on the
      // B-Side game over BOTH answers are PROCEED and neither leaves
      // (DEVICE_FAILURE_Step_0:384-385, :430-437).
      if (r.proceed && !weirdRoute) {
        enterWeirdRoute();
        saveProceed(title.unused, title.gear);
        console.log(`[kaizo] PROCEED — version ${versionId}: `
          + `${KAIZO_VERSIONS[versionId].name}`);
        // The fight under the menu is the OLD version until this runs; reset()
        // rebuilds it through `build()`, which now reads the new versionId and
        // hands the Weird Route its gear override.
        reset();
      }
      if (title.dirty) {
        title.dirty = false;
        persistSettings();
      }
      if (r.chosen) {
        // SINGLE ATTACK IS REFUSED HERE, and deliberately. Its picker is
        // ATTACK_MENU -- the VANILLA roster (sim/scenes/single.js) -- so
        // choosing it would run vanilla attacks under a wordmark that says
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
    // The fountain only. Drawing the fight under the menu made the party, the
    // HP bars and a stray soul legible through it.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, renderer.VIEW_W, renderer.VIEW_H);
    drawBackground(ctx, state, renderer.sprites);
    drawTitle(ctx, title, renderer.sprites, ATTACK_MENU, { title: KAIZO_WORDMARK() });
    requestAnimationFrame(frame);
    return;
  }

  // THE OPENING ROAR, between the title and the fight — the fx runs on the
  // same 30Hz clock as everything else and draws over the dark background,
  // which is what the encounter's own room looks like at that moment.
  // Confirm or cancel skips it; the fight underneath has not stepped once.
  if (introSeq && !introSeq.done) {
    const { steps: is, accumulator: ia } = drain(acc, elapsed);
    acc = ia;
    for (let i = 0; i < is; i++) {
      const input = gatedKeys();
      if (input.confirm || input.cancel) {
        introSeq.done = true;
        // The skip press must not fire FIGHT on the other side (the same
        // held-across-a-transition rule the title uses).
        maskHeldInput();
        break;
      }
      const cues = [];
      stepIntroScene(introSeq, cues);
      if (cues.length) audio.play(cues);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, renderer.VIEW_W, renderer.VIEW_H);
    // The fight's own backdrop underneath — the split slides the snow scene
    // off the edges and this is what it reveals.
    drawBackground(ctx, state, renderer.sprites);
    drawIntroScene(ctx, introSeq, renderer.sprites);
    if (introSeq.done) {
      // The room persists across the seam: hand the vista's animation
      // accumulator to the fight renderer so the backdrop's 120-frame
      // fade-in happens over an unbroken scene (render/canvas.js).
      state.vistaFsBase = introSeq.bg.fountain_speed;
      introSeq = null;
      maskHeldInput();
    }
    requestAnimationFrame(frame);
    return;
  }

  // THE STORY SCENE. White recedes over its first 20 frames, then the
  // knight glides in. When it finishes (or X skips it), the card.
  if (cutsceneSeq) {
    const { steps: cs, accumulator: ca } = drain(acc, elapsed);
    acc = ca;
    for (let i = 0; i < cs; i++) {
      const input = gatedKeys();
      if (input.cancel) {
        cutsceneSeq.done = true;
      }
      const cues = [];
      stepVictoryScene(cutsceneSeq, input, cues);
      // THE WIND. The ending's ambience is a real track and it is now in the
      // pack: obj_ch3_PTB02 does
      //
      //     c_mus2("initloop", "wind_highplace.ogg", 0);
      //     c_mus2("pitch", 0.5, 0);
      //     c_mus2("volume", 0, 0); c_mus2("volume", 1, 60);
      //
      // a LOOP at HALF PITCH under the whole cutscene. It used to be a
      // labelled no-op because the file was thought unextracted; it is a
      // loose .ogg in Resources/mus, like knight.ogg and AUDIO_DRONE, so it
      // needed no extraction pass at all. The 60-frame volume ramp is not
      // reproduced — the driver has no fade — so it comes in at full gain;
      // that is the one approximation here and it is deliberate.
      for (const c of cues) {
        if (!c.music) continue;
        if (c.music === 'wind') {
          audio.play([{ name: 'wind_highplace', pitch: 0.5, gain: 1, loop: true }]);
        } else if (c.music === 'stop') {
          audio.stopLoop('wind_highplace');
        }
      }
      const sound = cues.filter((c) => !c.music);
      if (sound.length) audio.play(sound);
      if (cutsceneSeq.done) break;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, renderer.VIEW_W, renderer.VIEW_H);
    drawBackground(ctx, state, renderer.sprites);
    if (!cutsceneSeq.done) {
      drawVictoryScene(ctx, cutsceneSeq, renderer.sprites);
      // The white receding out of the battle's ending fade.
      const white = Math.max(0, 1 - cutsceneSeq.t / 20);
      if (white > 0) {
        ctx.globalAlpha = white;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, renderer.VIEW_W, renderer.VIEW_H);
        ctx.globalAlpha = 1;
      }
    } else {
      // After the knighting: the TV SWITCHES OFF and the title comes back.
      // Both exits go the same way now — the celebration card is gone (it
      // was tool-authored text over a white fade, and the game has its own
      // way of ending a scene).
      cutsceneSeq = null;
      maskHeldInput();
      tvOff = createTvTurnoff();
    }
    requestAnimationFrame(frame);
    return;
  }

  // THE TV TURNS OFF. obj_tvturnoff_manager, then straight back to the menu
  // — no card, no prompt. Unskippable: it is 43 frames end to end, shorter
  // than the press that would skip it.
  if (tvOff) {
    const { steps: ts2, accumulator: ta2 } = drain(acc, elapsed);
    acc = ta2;
    for (let i = 0; i < ts2; i++) {
      const cues = [];
      stepTvTurnoff(tvOff, cues);
      for (const c of cues) {
        if (c.stop) audio.stopLoop(c.name);
        else audio.play([c]);
      }
      if (tvOff.done) break;
    }
    drawTvTurnoff(ctx, tvOff, renderer.sprites);
    // Back to the menu by the same door Escape uses — exitRun() nulls tvOff
    // and masks whatever is held (it used to do all of that inline here).
    if (tvOff.done) exitRun();
    requestAnimationFrame(frame);
    return;
  }

  // GAME OVER. The Knight's own — the soul does not break, it glides away and
  // he talks to you. See render/title.js for why this is not the game over
  // everybody knows: `global.tempflag[93]`, set by his encounter room.
  if (over) {
    const { steps: gs, accumulator: ga } = drain(acc, elapsed);
    acc = ga;
    for (let i = 0; i < gs; i++) {
      const r = stepGameOver(over, gatedKeys());
      if (r.moved) audio.play([{ name: 'snd_menumove', pitch: 1, gain: 1 }]);
      // NO CUE ON ADVANCE. The lines advance themselves now, on the writer's
      // own clock, and typer 667's sound is `snd_nosound` — this screen is
      // the drone and nothing else until you answer.
      if (r.chosen !== undefined) {
        audio.play([{ name: 'snd_select', pitch: 1, gain: 1 }]);
        audio.stopLoop('audio_drone');
        over = null;
        if (r.chosen === 0) {
          // GO BACK (FIGHT AGAIN) — the same fight, from the top.
          reset();
        } else {
          // GO FORWARD (MOVE ON) — in the original this leaves the fight
          // behind for the rest of the chapter. Here there is nothing past
          // the fight, so it goes back to the mode menu, which is the same
          // gesture: stop fighting this thing. The same exitRun() Escape
          // uses; `over` is already null so it has only the title to clear.
          exitRun();
        }
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
      const input = gatedKeys();
      // RECORD EVERY FRAME. `sim/` is deterministic, so seed + input stream
      // reproduces this exact run on any machine — which turns a playtester's
      // bug report from a description into something you can run. See
      // sim/replay.js. One byte a frame, run-length encoded; the cost of
      // recording unconditionally is nothing next to the cost of asking a
      // tester to reproduce something they already saw.
      const hpBefore = state.partyHp[0] + state.partyHp[1] + state.partyHp[2];
      const caughtBefore = state.soul?.alive && state.soul.image_alpha === 0;
      stepFrame(state, input);
      audio.play(drainCues(state));

      // The win: the ending's white fade has filled (stepEndCutscene drives
      // it to 1 over 30 frames from endtimer 32). The story scene plays
      // first; the card follows it.
      if (!tvOff && !cutsceneSeq && (state.endFade ?? 0) >= 1) {
        maskHeldInput();
        cutsceneSeq = createVictoryScene();
      }

      // HITLESS: one hit and it starts over. The restart is instant because
      // the sim is a pure function of (seed, input) — there is nothing to
      // tear down, which is the whole reason this mode is cheap to offer.
      //
      // A HIT IS DAMAGE, NOT A place_meeting POSITIVE. This used to watch
      // `counters.collisionHits`, which counts every registered overlap —
      // including a class that deals nothing: a tooth's ACTIVE gate lives
      // inside its contact handler, so a just-spawned, unarmed tooth
      // overlapping the soul on the cut line increments the counter and does
      // no damage at all. Measured on a wandering Flurry run: 86 of 188
      // counted collisions were consequence-free. Reported from play as
      // grazing the red slashes restarting the fight, and as "restarting at
      // random during the box split" — teeth spawn exactly where the cut is.
      //
      // The game's own judgement of a no-hit run is damage taken, so the
      // trigger is the party's HP dropping — plus the splitslash CATCH
      // (image_alpha 0, the cut carrying the soul), which is a hit whose
      // damage lands ~35 frames later and must restart NOW, not after the
      // animation.
      const hpNow = state.partyHp[0] + state.partyHp[1] + state.partyHp[2];
      const caughtNow = state.soul?.alive && state.soul.image_alpha === 0;
      if (runMode === 'hitless' && (hpNow < hpBefore || (caughtNow && !caughtBefore))) {
        hitlessDeaths += 1;
        reset();
        break;
      }

      // The party is down. In NORMAL that ends the run; in ENDLESS and
      // HITLESS it simply restarts, because stopping is the one thing those
      // two modes exist to avoid.
      if (state.gameOver) {
        if (runMode === 'endless' || runMode === 'hitless') {
          reset();
        } else {
          // `scr_gameover`: audio_stop_all, snd_hurt1, and a SCREENSHOT of
          // the application surface — the death is frozen on screen for 30
          // frames before anything else happens.
          audio.stopAll();
          audio.play([{ name: 'snd_hurt1', pitch: 1, gain: 1 }]);
          renderer.draw(state);
          const shot = document.createElement('canvas');
          shot.width = renderer.VIEW_W;
          shot.height = renderer.VIEW_H;
          shot.getContext('2d').drawImage(canvas, 0, 0);
          // `global.heartx = (x + 2) - viewX` (obj_heart's Step) — the soul
          // appears where it died, in SCREEN space, and the +2 is what
          // centres the 16px spr_heart inside the 20px spr_dodgeheart you
          // were dodging with. Dropping either term puts it two pixels off,
          // or anywhere at all once the arena has scrolled.
          // The key that was down when you died is not an answer to the
          // Knight's question.
          maskHeldInput();
          // THE DRONE. DEVICE_FAILURE's Create, on the knight_mode branch:
          //
          //     snd_free_all();
          //     global.currentsong[0] = snd_init("AUDIO_DRONE.ogg");
          //     global.currentsong[1] = mus_loop(global.currentsong[0]);
          //
          // `snd_free_all()` first — every other sound in the game is released,
          // so the screen is a single sustained tone and nothing else. It is a
          // LOOSE file in Resources/mus, like the fight's own knight.ogg, so it
          // needed no extraction pass. The typer over it is `snd_nosound`: the
          // Knight's words arrive in silence on top of the drone.
          audio.stopLoop('mus_knight');
          audio.play([{ name: 'audio_drone', pitch: 1, gain: 1, loop: true }]);
          over = makeGameOver(
            shot,
            (state.soul?.x ?? renderer.VIEW_W / 2) + 2 - (state.view?.x ?? 0),
            (state.soul?.y ?? 170) + 2 - (state.view?.y ?? 0),
          );
        }
        break;
      }
    }
  }

  renderer.draw(state);

  // THE KAIZO BANNER IS GONE, and the fourth law is still satisfied: the
  // wordmark on the title says KAIZO, the version sits bottom-left of it
  // (render/title.js draws web/version.js), and KAIZO_NOTE reaches the
  // console. Nothing of ours is drawn over the 640x480 frame — it is the
  // game's own art.
  requestAnimationFrame(frame);
}

// THE LOOP, plus a WATCHDOG for browsers that starve requestAnimationFrame.
// Opera GX shipped exactly that: a black screen where each keypress painted
// one frame — rAF never fired, and the only draws were the event-path ones
// (Bad Time Simulator reportedly has the same failure there). If the page is
// VISIBLE and no frame has run for 500ms, the watchdog drives frame() itself
// with a wall-clock timestamp. drain() meters sim steps by elapsed real time,
// so if rAF later revives and the two overlap briefly, the sim does not
// double-step — the accumulator absorbs it.
let lastFrameRun = performance.now();
boot('starting…');
requestAnimationFrame(frame);
// A probe rAF, separate from the game loop, is the liveness signal; the
// fallback is a 33ms interval driving frame() at full rate. It ARMS when the
// probe has been silent half a second with the page visible, and DISARMS the
// moment real rAF ticks return, so a browser that merely throttled catches
// back up without ever running both for long.
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

// THE APP SHELL. The service worker is what turns add-to-home-screen into a
// standalone app (and keeps the fight loadable offline). Registration failing
// — file://, an old browser, private mode — costs nothing: the page is fully
// functional without it.
//
// THIS GAME'S OWN WORKER. Its cache prefix is kaizoknight-, and it only ever
// deletes its own prefix (see web/sw.js), so it cannot evict the real fight's
// cache on a shared origin, nor be evicted by it.
//
// `?nosw` TURNS IT OFF, and it has to, because the worker is CACHE-FIRST and
// precaches './kaizo.js': edit the file, and the browser keeps running the
// previous one with no error anywhere, which reads exactly like the page
// failing to boot. That cost a long session. The flag is the escape hatch --
// and it does not merely skip registration, it TEARS DOWN whatever a previous
// load installed, because skipping alone would leave the stale worker still
// serving this very page.
//
// It is opt-out rather than off-by-default on localhost so that ordinary local
// play keeps the cache: the page fetches ~1,660 sprite frames, and without the
// worker every reload pays for all of them again.
//
//     http://localhost:8178/web/kaizo.html?nosw     <- developing
//     http://localhost:8178/web/kaizo.html          <- playing
const swOff = params.has('nosw');
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !swOff) {
  // Module-relative, not document-relative — the same rule as the asset
  // loaders (4911a09): the hub hosts this driver from a page one level up,
  // where './sw.js' resolves to a URL that does not exist. The worker's
  // scope stays web/ either way; that is where the installable app lives.
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch(() => {});
} else if ('serviceWorker' in navigator && swOff) {
  navigator.serviceWorker.getRegistrations()
    .then((rs) => Promise.all(rs.map((r) => r.unregister())))
    .then(() => caches.keys())
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('kaizoknight-')).map((k) => caches.delete(k))))
    .then(() => console.log('[kaizo] ?nosw — service worker unregistered and its caches dropped'))
    .catch(() => {});
}
