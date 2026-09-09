#!/usr/bin/env node
// THE KAIZO RENDERER MUST NOT THROW — and the seam must actually be consulted.
//
//   node kaizo/tools/checks/check-render-smoke-kaizo.mjs      (npm run check:render:kaizo)
//
// tools/verify-render-smoke.mjs is the model, and its reason is this file's
// reason: nothing else in either gate draws anything, so a Draw that throws
// on its first frame passes every sim suite and kills the page's
// requestAnimationFrame loop with no error anyone reads. The kaizo page adds
// a second way to get there — KAIZO_DRAW_OVERRIDES (kaizo/render/index.js)
// is handed to render/canvas.js and every entry runs INSTEAD OF the vanilla
// drawer for its object. A port that throws, returns the wrong thing, or is
// never reached at all is invisible to `npm run verify:kaizo`'s sim checks.
//
// So this drives REAL FRAMES of the kaizo scene (buildKaizoScene, the same
// builder web/kaizo.js and kaizo/tools/kaizo-trace.mjs use) through the REAL
// renderer WITH the overrides, against a stub canvas, and:
//
//   1. fails on any throw, naming the version, the frame and the stack;
//   2. counts how many times each override ran (a wrapper around the map —
//      the seam sees the wrapper, the wrapper calls the real function) and
//      PINS the set the fixed-seed runs reach, so an override that silently
//      stops being consulted reads as a failure and not as "0 hits, fine";
//   3. proves the seam is live with sabotage: an override that throws must
//      take the renderer down; a non-function entry must be rejected at
//      construction; a falsy return must still draw the vanilla tail; a true
//      return must suppress it;
//   4. proves the STUBS are the vanilla path: the same fight drawn by a
//      renderer with no overrides and by one with the stub map must issue the
//      same canvas calls, in the same order, on every frame. Method NAMES are
//      compared, not arguments — render-local generators (the splitslash
//      strike jitter in render/draw/swords.js) are free-running by design and
//      would differ between two renderers, and that is not a seam question.
//
// It is a SMOKE TEST: it asserts nothing about what the pixels look like.
//
// The input is the menu-gated confirm pulse every kaizo check uses (a token
// replay would be comparable to a recording, but there is no recording of
// the kaizo page's own draw calls to compare against, and the pulse reaches
// several launches per thousand frames at a fixed seed). The party's HP is
// pinned the way kaizo-trace's `--keep-alive` pins it (roster-aware, HP only,
// nobody stood back up) so a run is decided by the schedule and not by a
// wipe; the V-C finale is reached the way verify-kaizo reaches it, by
// dropping the Knight's HP to the phase-4 gate after six turns.
//
// The sprite map hands back a FAKE entry rather than nothing, exactly as the
// vanilla smoke does, so blit() / tinted() / fogged() and every drawer's
// sprite-dependent branch actually run instead of returning early on a
// missing entry.

const noop = () => {};
const VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'globalAlpha',
  'globalCompositeOperation', 'font', 'lineWidth', 'lineCap', 'lineJoin',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'shadowBlur',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction',
  'filter']);
/**
 * A 2d-context stand-in. `log`, when given, receives the NAME of every method
 * called on it — that is the per-frame call sequence assertion 4 compares.
 * Only the MAIN canvas's context logs; offscreen canvases from
 * document.createElement get a silent one, so a tint-cache hit versus miss
 * (which draws on an offscreen context) cannot make two runs differ.
 */
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
    return (...args) => {
      if (log) log.push(p);
      if (p === 'drawImage' || p === 'fillText') {
        globalThis.__drawCount = (globalThis.__drawCount ?? 0) + 1;
      }
      return undefined;
    };
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

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

// ── the harness ────────────────────────────────────────────────────────────

// A believable sprite entry, so blit() and tinted() actually run.
const fakeImg = { width: 32, height: 32, src: 'stub://frame' };
const fakeEntry = { frames: [fakeImg, fakeImg], meta: { ox: 16, oy: 16, w: 32, h: 32 } };

async function makeRenderer(overrides, log = null) {
  const canvas = { width: 640, height: 480, style: {}, getContext: () => mkCtx(log) };
  const renderer = await createRenderer(canvas, { overrides });
  const realGet = renderer.sprites.get.bind(renderer.sprites);
  renderer.sprites.get = (name) => realGet(name) ?? fakeEntry;
  return renderer;
}

// The menu-gated pulse (kaizo/tools/verify-kaizo.mjs makeMenuInput): confirm
// alternates ONLY while something waits on it, because button1_p is
// edge-triggered and a held confirm is one press forever.
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

// Roster-aware HP pin — kaizo-trace.mjs makeKeepAlive in 'pin' mode. V-D's
// party is two slots plus one deliberately dead; `partyMaxhp` is what the
// roster installed, and the vanilla trio is the fallback for V-A.
function pinParty(state) {
  const maxhp = state.partyMaxhp ?? PARTY.map((p) => p.maxhp);
  for (let i = 0; i < maxhp.length; i++) state.partyHp[i] = maxhp[i];
  state.gameOver = false;
}

/**
 * Drive one fight: draw, step, pin, repeat. Returns what happened rather than
 * asserting, so the callers can phrase their own positive checks.
 *
 * `hpGate` drops the Knight's HP to the phase-4 gate once six turns have
 * passed (verify-kaizo's V-C scenario), and the run stops `tailFrames` after
 * the first ROARING turn appears — enough to draw the roar's surfaces, the
 * cover and the screen cut, which nothing shorter reaches.
 */
function drive({
  version, frames, seed = 12345, renderer, hpGate = null, tailFrames = 0,
  onFrame = null, setup = null,
}) {
  const st = createState({ seed, traceBulletSlots: 0 });
  st.spriteFrames = renderer.spriteFrames;
  st.spriteRate = renderer.spriteRate;
  buildKaizoScene(st, { version });
  if (setup) setup(st);
  const input = makeMenuInput();
  const phases = [];
  let prev = null;
  let gated = false;
  let roaringAt = -1;
  let f = 0;
  let threw = null;
  try {
    for (; f < frames; f++) {
      if (onFrame) onFrame(st, f);
      renderer.draw(st);
      stepFrame(st, input(st));
      pinParty(st);
      if (st.phase !== prev) {
        phases.push(st.phase);
        prev = st.phase;
      }
      if (hpGate !== null) {
        if (!gated && phases.length >= 6) {
          st.knight.hp = hpGate;
          gated = true;
        } else if (!gated) {
          st.knight.hp = hpGate + 1;
        }
        if (roaringAt < 0 && /Roaring/i.test(st.phase ?? '')) roaringAt = f;
        if (roaringAt >= 0 && f - roaringAt >= tailFrames) { f += 1; break; }
      }
    }
  } catch (err) {
    threw = err;
  }
  return {
    frames: f, threw, phases, roaringAt,
    launches: st.kaizo?.launched?.length ?? 0,
  };
}

// ── 1 + 2: the overrides, counted, through every version ───────────────────
// The seam receives WRAPPERS so each real override's hits can be counted.
// Own properties are copied across (Object.assign) so a port's
// `ownsHellSurface` flag survives the wrapping — the seam reads it off the
// function it was given.
const hits = Object.fromEntries(KAIZO_DRAW_OBJECTS.map((n) => [n, 0]));
const counted = {};
for (const name of KAIZO_DRAW_OBJECTS) {
  const real = KAIZO_DRAW_OVERRIDES[name];
  counted[name] = Object.assign(
    (ctx, e, state, helpers) => { hits[name] += 1; return real(ctx, e, state, helpers); },
    real,
  );
}
// 24 changed Draws plus ONE fill: obj_knight_diamondswordbullet_ext's Draw is
// vanilla-identical but the engine has no drawer for it at all, so the
// kaizo registry carries it (kaizo/render/index.js, 2026-09-08).
ok(KAIZO_DRAW_OBJECTS.length === 25,
  `the registry names the mod's 24 changed Draw objects + the blade fill (${KAIZO_DRAW_OBJECTS.length})`);
ok(KAIZO_DRAW_OBJECTS.every((n) => typeof KAIZO_DRAW_OVERRIDES[n] === 'function'),
  'every registry entry is a function');

const kaizoRenderer = await makeRenderer(counted);
ok(typeof kaizoRenderer.draw === 'function', 'createRenderer accepted the override map');

/**
 * THE RUNS. Frame budgets are what a fixed seed needs to put each family on
 * screen at least once (measured, see EXPECTED_REACHED); they are not turn
 * counts. V-C is the v2.3.3 recreation this seam exists for, V-D its B-Side
 * (the only lane with SnowGrave), V-A the invented schedule the page defaults
 * to; the gated V-C run is the only way to reach ROARING.
 *
 * MEASURED at seed 12345 with the pulse feed (a scratch probe over 16,000
 * frames, no renderer): V-C's first visible obj_knight_tunnel_slasher is
 * frame 6461 (Piercing Blades, ac 110, the 15th launch) and its first visible
 * obj_knight_stream is frame 9391 (Sword Storm, ac 107, the 22nd) — hence
 * 10,000 frames for V-C. V-D reaches the same two at 6617 and 9563; 6000
 * frames of it covers everything V-C's run does not add.
 */
// THE SNOWGRAVE PAIR IS NOT REACHED, and the run is kept so the day it is
// reachable this file says so. The spell is Noelle's menu choice on the
// B-Side, which the pulse feed never casts, so one V-D run casts it on frame
// 0 the way check-scenes.mjs does and pins Kris as the target. MEASURED
// (same probe): both obj_spell_snowgrave and up to 90 live snowflakes exist,
// and every one of them keeps the `visible = false` its Create assigns
// (kaizo/party/scenes.js snowgraveSpell / snowgraveSnowflake) for its whole
// life; the spell dies on its 120-frame destroy timer before any turn end
// could arm k_sgscene. An invisible instance never reaches the seam — the
// loop's filter is GameMaker's rule — so the snowgrave family's port starts
// with the question of where those objects' visuals are meant to come from.
//
// obj_tracking_sword_slash_extra_graze is never reached BY CONSTRUCTION: its
// Create sets `visible = false` (kaizo/attacks/tracking-swords.js:133 — a
// 900x7 graze bar), and an invisible instance has no Draw in GameMaker or
// here. It stays in the registry because the mod's dump carries a Draw_0 for
// it; the port decides whether that Draw can ever run.
const { castSnowgrave, ensureScenes } = await import('../../party/scenes.js');
const RUNS = [
  { version: 'C', frames: 10000 },
  { version: 'D', frames: 6000 },
  { version: 'A', frames: 2000 },
  { version: 'C', frames: 40000, hpGate: true, tailFrames: 1200, label: 'C, HP-gated finale' },
  {
    version: 'D', frames: 1200, label: 'D, SnowGrave cast on frame 0',
    setup: (st) => { castSnowgrave(st, { caster: 1, magic: 13 }); },
    onFrame: (st) => { ensureScenes(st).sg.target = 0; },
  },
];
const t0 = Date.now();
for (const run of RUNS) {
  if (!KAIZO_VERSIONS[run.version]) {
    ok(false, `version ${run.version} is not registered`);
    continue;
  }
  resetTensionBar();
  const label = run.label ?? `${run.version}`;
  let hpGate = null;
  if (run.hpGate) {
    const { VC_KNIGHT, VC_GATE_FRACTION } = await import('../../versions/vc-script.js');
    hpGate = VC_KNIGHT.maxhp * VC_GATE_FRACTION;
  }
  const r = drive({ ...run, renderer: kaizoRenderer, hpGate });
  if (r.threw) {
    ok(false, `[${label}] the renderer threw on frame ${r.frames}: ${r.threw.message}`);
    console.log(String(r.threw.stack).split('\n').slice(0, 6).map((l) => `        ${l}`).join('\n'));
    continue;
  }
  ok(r.frames > 0 && r.launches >= 2,
    `[${label}] ${r.frames} frames drawn, no throw; ${r.launches} launches, `
    + `${r.phases.length} turn labels`);
  if (run.hpGate) {
    ok(r.roaringAt >= 0, `[${label}] reached ROARING (frame ${r.roaringAt})`);
  }
}
console.log(`  --  ${((Date.now() - t0) / 1000).toFixed(1)}s of drawing`);

ok((globalThis.__drawCount ?? 0) > 0, `the stub canvas received draws (${globalThis.__drawCount})`);

// COVERAGE — which overrides the fixed-seed runs actually reached. Pinned:
// MEASURED on this machine with the budgets above; every name below was hit
// at least once, and a name dropping out of the set means either a sim change
// moved the schedule (re-measure, re-pin) or the seam stopped consulting that
// object (the failure this exists to catch). Names NOT in the set are
// reported, never enforced — see the note after the assertion. The three
// absent from the pin are the two SnowGrave objects and the extra-graze bar,
// for the reasons given above RUNS.
const EXPECTED_REACHED = [
  'obj_fallingsword', 'obj_knight_swordfall', 'obj_sword_tunnel_sword',
  'obj_knight_swordtunnelanim',
  'obj_knight_pointing_cone', 'obj_knight_pointing_star', 'obj_knight_pointing_starchild',
  'obj_knight_roaring2', 'obj_roaringknight_slash',
  'obj_roaringknight_quickslash', 'obj_roaringknight_quickslash_attack',
  'obj_knight_rotating_slash',
  'obj_roaringknight_boxsplitter_attack', 'obj_roaringknight_splitslash',
  'obj_roaringknight_split_bullet', 'obj_knight_split_growtangle_effect',
  'obj_knight_stream', 'obj_knight_tunnel_slasher', 'obj_knight_tunnel_slasher_2_revised',
  // MEASURED 2026-09-08 at the same seed and budgets: 5,999 hits (Tunnel 2
  // and the combination's tunnel segment both field these blades).
  'obj_knight_diamondswordbullet_ext',
  'obj_tracking_sword_slash', 'obj_knight_enemy',
];
{
  const reached = KAIZO_DRAW_OBJECTS.filter((n) => hits[n] > 0);
  const missed = KAIZO_DRAW_OBJECTS.filter((n) => hits[n] === 0);
  console.log('  --  override hits:');
  for (const n of KAIZO_DRAW_OBJECTS) console.log(`        ${n.padEnd(40)} ${hits[n]}`);
  ok(reached.length > 0, `overrides were consulted (${reached.length}/${KAIZO_DRAW_OBJECTS.length} reached)`);
  const lost = EXPECTED_REACHED.filter((n) => hits[n] === 0);
  ok(lost.length === 0,
    `every pinned override was reached${lost.length ? ` — LOST: ${lost.join(', ')}` : ` (${EXPECTED_REACHED.length} pinned)`}`);
  if (missed.length) {
    console.log(`  --  not reached in these budgets (reported, not enforced): ${missed.join(', ')}`);
  }
}

// ── 3: the seam is live — sabotage ─────────────────────────────────────────
{
  // A non-function entry is rejected at construction, not drawn as nothing.
  let rejected = false;
  try {
    await makeRenderer({ obj_growtangle: 42 });
  } catch (err) {
    rejected = err instanceof TypeError;
  }
  ok(rejected, 'a non-function override is rejected by createRenderer (TypeError)');

  // A throwing override takes the renderer down — the smoke CAN fail.
  const bomb = await makeRenderer({ obj_growtangle: () => { throw new Error('seam-sabotage'); } });
  resetTensionBar();
  const r = drive({ version: 'C', frames: 600, renderer: bomb });
  ok(r.threw && /seam-sabotage/.test(r.threw.message),
    `a throwing override propagates out of renderer.draw (frame ${r.frames})`);

  // The override is consulted on EXACTLY the frames its object is drawable:
  // alive, not the soul, `visible !== false` — the loop's own filter.
  let seen = 0;
  let drawable = 0;
  const spy = await makeRenderer({ obj_growtangle: () => { seen += 1; return false; } });
  resetTensionBar();
  const r2 = drive({
    version: 'C', frames: 600, renderer: spy,
    onFrame: (st) => {
      drawable += st.entities.filter(
        (e) => e.alive && e !== st.soul && e.visible !== false && e.type.name === 'obj_growtangle',
      ).length;
    },
  });
  ok(!r2.threw && seen > 0 && seen === drawable,
    `the override ran once per drawable obj_growtangle frame (${seen} = ${drawable})`);

  // FALSY keeps the tail (draw_self), TRUE suppresses it: with the box's
  // vanilla handler displaced, `() => false` still blits the border every
  // frame the box exists and `() => true` never does, so the second run
  // issues strictly fewer draws over the same 600 frames.
  const count = async (fn) => {
    const rr = await makeRenderer({ obj_growtangle: fn });
    resetTensionBar();
    const before = globalThis.__drawCount ?? 0;
    const res = drive({ version: 'C', frames: 600, renderer: rr });
    return { draws: (globalThis.__drawCount ?? 0) - before, threw: res.threw };
  };
  const falsy = await count(() => false);
  const truthy = await count(() => true);
  ok(!falsy.threw && !truthy.threw && falsy.draws > truthy.draws,
    `falsy return draws the vanilla tail, true suppresses it (${falsy.draws} > ${truthy.draws} draws)`);
}

// ── 4: the stubs ARE the vanilla path ──────────────────────────────────────
// Same seed, same input, same frame count, two fresh states: one drawn with
// no overrides, one with the stub map. Sequential (not interleaved) so the
// render-side module state that eases per draw call — the tension bar, reset
// here between runs — sees one fight each. Compared frame by frame.
{
  const FRAMES = 1500;
  const record = async (overrides) => {
    const log = [];
    const perFrame = [];
    const rr = await makeRenderer(overrides, log);
    resetTensionBar();
    const res = drive({
      version: 'C', frames: FRAMES, renderer: rr,
      onFrame: () => { if (log.length) perFrame.push(log.splice(0).join(',')); },
    });
    if (log.length) perFrame.push(log.splice(0).join(','));
    return { perFrame, threw: res.threw, launches: res.launches };
  };
  // PORTS LAND IN THE REGISTRY. Once a family is translated its entry is no
  // longer a pass-through — the Stars port, for one, draws the charge beam
  // with the timer the game's Draw READ (one slice behind the post-Draw
  // field the vanilla drawer uses), so the real map diverges from the
  // vanilla sequence on the cone's first frames by design. The comparison
  // map is therefore built here as PURE STUBS over the registry's names,
  // `helpers.drawVanilla` for every object — which is what this assertion
  // has always been about: the SEAM's pass-through is the vanilla path,
  // whatever the real map has become. The real map is still what runs
  // 1 + 2 above, where every port is driven through the fight.
  const PASS_THROUGH = Object.fromEntries(
    KAIZO_DRAW_OBJECTS.map((n) => [n, (ctx, e, state, helpers) => helpers.drawVanilla(e, state)]),
  );
  const vanilla = await record(null);
  const stubbed = await record(PASS_THROUGH);
  ok(!vanilla.threw && !stubbed.threw, 'both the vanilla and the stubbed renderer survived the comparison run');
  ok(vanilla.perFrame.length === FRAMES && stubbed.perFrame.length === FRAMES,
    `both runs logged ${FRAMES} frames (${vanilla.perFrame.length} / ${stubbed.perFrame.length})`);
  let firstDiff = -1;
  for (let i = 0; i < Math.min(vanilla.perFrame.length, stubbed.perFrame.length); i++) {
    if (vanilla.perFrame[i] !== stubbed.perFrame[i]) { firstDiff = i; break; }
  }
  const calls = vanilla.perFrame.reduce((n, s) => n + s.split(',').length, 0);
  ok(firstDiff < 0 && vanilla.launches >= 2,
    `the stub map issues the vanilla call sequence on every frame `
    + `(${calls} calls over ${FRAMES} frames, ${vanilla.launches} launches)`
    + (firstDiff >= 0 ? ` — FIRST DIFFERENCE at frame ${firstDiff}` : ''));
  if (firstDiff >= 0) {
    const a = vanilla.perFrame[firstDiff].split(',');
    const b = stubbed.perFrame[firstDiff].split(',');
    let k = 0;
    while (k < a.length && k < b.length && a[k] === b[k]) k++;
    console.log(`        at call ${k}: vanilla ${a.slice(k, k + 6).join(',') || '(end)'}`
      + ` | stubbed ${b.slice(k, k + 6).join(',') || '(end)'}`);
  }
}

if (failed) {
  console.log(`\nFAIL  kaizo render smoke — ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nPASS  kaizo render smoke — the renderer survives the kaizo fight with the override map (stub canvas)');
