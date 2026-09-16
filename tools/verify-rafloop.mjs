#!/usr/bin/env node
// THE ANIMATION-FRAME LOOP AND ITS WATCHDOG — the tab-switch lag suite.
//
//   node tools/verify-rafloop.mjs
//
// The bug this exists to keep out, measured on v1.0.51 in a real browser with
// a virtual monitor standing in for the compositor (the numbers are frame()
// entries per second, and the chain count is how many rAF(frame) requests are
// outstanding at once):
//
//   before a tab switch      60.1 frame()/s    1 chain
//   after one switch        490.5 frame()/s    8 chains
//   after two               886.8 frame()/s   15 chains
//   after three            1314.7 frame()/s   28 chains
//
// The watchdog was NOT stuck — its 33ms fallback armed for 272/280/524ms and
// disarmed itself correctly every time. The damage was that it had called
// frame() 7, 7 and 13 times while armed, and every exit path of frame() ended
// in a bare `requestAnimationFrame(frame)`. Each of those calls therefore
// forked a new, permanent rAF chain: chains = 1 + every fallback-driven call
// ever made. Nothing retires them, so the page draws 8x, 15x, 28x per paint
// until a reload — "if I have it open and switch tabs it lags super bad until
// you refresh the page".
//
// WHAT THIS SUITE DOES. It does not read the driver's source and match
// patterns for the fix; it EXTRACTS the shipped loop/watchdog region out of
// web/main.js and RUNS it, against a virtual clock, a virtual monitor and a
// virtual tab that behave the way a browser does:
//
//   - a hidden tab gets ZERO animation frames, and its timers are throttled
//     to at most one call per second
//   - a timer that came due while the tab was away runs BEFORE rendering
//     resumes (this ordering is what armed the fallback on every measured
//     switch, and is therefore the ordering the suite uses)
//   - rAF requests are cancellable, and an uncancelled one stays outstanding
//
// Then it asserts BEHAVIOUR, in both directions — because "the loop never
// forks" and "the loop never runs" look identical to a test that only counts
// chains. Every scenario below carries a POSITIVE assertion that frame() ran.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// ── WHICH DRIVER, and why this is not just `web/main.js` ───────────────────
//
// This suite is VENDORED. kaizo-knight-sim mirrors tools/ wholesale, and that
// repo's page driver is `web/kaizo.js`, not `web/main.js` — so a hardcoded
// path did not fail an assertion there, it threw ENOENT and took the whole
// suite down. A suite that cannot run is not a suite that passes.
//
// Both names are tried and the one that exists is read. If NEITHER exists the
// suite fails loudly rather than skipping: a driverless repo means the vendor
// step is broken, which is exactly what this is here to notice.
function findDriver(root) {
  for (const name of ['main.js', 'kaizo.js']) {
    const p = join(root, 'web', name);
    if (existsSync(p)) return { path: p, name: `web/${name}` };
  }
  console.log(`  FAIL  no page driver found — tried web/main.js and web/kaizo.js under ${root}`);
  process.exit(1);
  return null;
}
const DRIVER_FILE = findDriver(join(here, '..'));
const DRIVER = DRIVER_FILE.path;
const src = readFileSync(DRIVER, 'utf8');

let failed = 0;
function ok(cond, what, detail = '') {
  if (cond) {
    console.log(`  ok    ${what}${detail ? `  (${detail})` : ''}`);
  } else {
    failed++;
    console.log(`  FAIL  ${what}${detail ? `  (${detail})` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// 1. THE CONTRACT INSIDE frame(): one scheduler, no bare requests.
//
// This is the half that cannot be exercised by running the region alone, so it
// is read from the source — but it is read as a whole function body, not as a
// pattern anywhere in the file, and it asserts a COUNT, so deleting five of the
// six call sites fails it.
// ---------------------------------------------------------------------------
console.log('frame() reschedules through exactly one place');
{
  // LINE ENDINGS ARE NOT PART OF THE CLAIM. This scan looked for a LF-only
  // terminator while the working tree is CRLF (core.autocrlf checks it out
  // that way), so indexOf returned -1 and slice(start, -1) handed the
  // matcher almost the WHOLE FILE. It then matched the two comments above
  // the watchdog that DESCRIBE the bare call, plus the one legitimate
  // `rafId = requestAnimationFrame(frame)` inside scheduleFrame, and
  // reported three offences in code that had none.
  //
  // A check that cannot tell LF from CRLF fails on the wrong machine rather
  // than on the wrong change. Normalised once, here.
  const flat = src.split(String.fromCharCode(13) + String.fromCharCode(10)).join(String.fromCharCode(10));
  const start = flat.indexOf('\nfunction frame(now) {');
  ok(start >= 0, `frame(now) found in ${DRIVER_FILE.name}`);
  const end = flat.indexOf('\n}\n', start);
  ok(end > start, 'frame() body delimited');
  const body = flat.slice(start, end);
  const bare = body.match(/requestAnimationFrame\(frame\)/g) || [];
  const routed = body.match(/scheduleFrame\(\)/g) || [];
  ok(bare.length === 0, 'no bare requestAnimationFrame(frame) inside frame()', `${bare.length} found`);
  ok(routed.length >= 6, 'every exit path reschedules through scheduleFrame()', `${routed.length} call sites`);
}

// ---------------------------------------------------------------------------
// 2. THE REGION ITSELF, RUN.
// ---------------------------------------------------------------------------

/** Slice the shipped loop/watchdog region out of the driver. */
function extractRegion(text, file) {
  const a = text.indexOf('let lastFrameRun = performance.now();');
  const b = text.indexOf('// THE APP SHELL.');
  if (a < 0 || b <= a) {
    throw new Error(`${file}: could not find the loop/watchdog region (markers moved?)`);
  }
  return text.slice(a, b);
}

/**
 * A virtual browser: a clock that only moves when told, a 60Hz monitor that
 * stops dead while the tab is hidden, and setInterval with the hidden-tab
 * throttle. Intervals fire before the monitor within a tick, which is the
 * overdue-timer-before-first-paint ordering the real bug needed.
 */
function makeBrowser() {
  const env = {
    now: 0,
    visible: true,
    renderPaused: false,
    frameCalls: 0,
    rafQueue: [],
    rafLive: new Set(),
    nextRaf: 1,
    intervals: [],
    nextInt: 1,
    listeners: [],
    vsyncAcc: 0,
  };

  const performanceStub = { now: () => env.now };

  const documentStub = {
    get visibilityState() { return env.visible ? 'visible' : 'hidden'; },
    addEventListener(type, fn) { if (type === 'visibilitychange') env.listeners.push(fn); },
  };

  function requestAnimationFrame(cb) {
    const id = env.nextRaf++;
    env.rafLive.add(id);
    env.rafQueue.push({ id, cb });
    return id;
  }
  function cancelAnimationFrame(id) { env.rafLive.delete(id); }

  function setInterval_(fn, ms) {
    const rec = { id: env.nextInt++, fn, ms, next: env.now + ms, last: -Infinity, armed: true, calls: 0 };
    env.intervals.push(rec);
    return rec.id;
  }
  function clearInterval_(id) {
    const rec = env.intervals.find((x) => x.id === id);
    if (rec) rec.armed = false;
  }

  /** One animation frame: deliver the whole queue as it stands. */
  function vsync() {
    if (!env.visible || env.renderPaused) return;
    const batch = env.rafQueue;
    env.rafQueue = [];
    for (const e of batch) {
      if (!env.rafLive.has(e.id)) continue;
      env.rafLive.delete(e.id);
      e.cb(env.now);
    }
  }

  env.advance = (ms) => {
    for (let i = 0; i < ms; i++) {
      env.now++;
      for (const rec of env.intervals) {
        if (!rec.armed || env.now < rec.next) continue;
        rec.next = env.now + rec.ms;
        // Chrome's hidden-tab floor: at most one call a second.
        if (!env.visible && env.now - rec.last < 1000) continue;
        rec.last = env.now;
        rec.calls++;
        rec.fn();
      }
      env.vsyncAcc++;
      if (env.vsyncAcc >= 16) { env.vsyncAcc = 0; vsync(); }
    }
  };

  env.setVisible = (v) => {
    if (env.visible === v) return;
    env.visible = v;
    for (const fn of env.listeners) fn();
  };

  /** rAF(frame) requests still outstanding — the thing that forked. The
   *  liveness probe rides the same queue and is counted separately. */
  env.chains = () => env.rafQueue.filter((e) => env.rafLive.has(e.id) && e.cb.name !== 'rafProbe').length;
  env.probeChains = () => env.rafQueue.filter((e) => env.rafLive.has(e.id) && e.cb.name === 'rafProbe').length;
  /** 33ms watchdog fallbacks currently armed. */
  env.fallbacksArmed = () => env.intervals.filter((x) => x.armed && x.ms === 33).length;
  env.fallbacksEver = () => env.intervals.filter((x) => x.ms === 33).length;

  env.boot = () => {};
  env.performance = performanceStub;
  env.document = documentStub;
  env.requestAnimationFrame = requestAnimationFrame;
  env.cancelAnimationFrame = cancelAnimationFrame;
  env.setInterval = setInterval_;
  env.clearInterval = clearInterval_;
  return env;
}

/** Load the region into a virtual browser, with a frame() that only counts. */
function load(region, env) {
  let api = null;
  const frame = () => {
    env.frameCalls++;
    api.scheduleFrame();          // exactly what the real frame() does on exit
  };
  const factory = new Function(
    'frame', 'performance', 'document', 'requestAnimationFrame', 'cancelAnimationFrame',
    'setInterval', 'clearInterval', 'boot',
    `${region}\n;return { scheduleFrame, get fallback() { return fallback; }, get rafTick() { return rafTick; } };`,
  );
  api = factory(
    frame, env.performance, env.document, env.requestAnimationFrame, env.cancelAnimationFrame,
    env.setInterval, env.clearInterval, env.boot,
  );
  return api;
}

const region = extractRegion(src, DRIVER_FILE.name);

// --- steady state ----------------------------------------------------------
console.log('\na visible tab, left alone');
{
  const env = makeBrowser();
  load(region, env);
  env.advance(2000);
  ok(env.frameCalls > 100, 'frame() runs', `${env.frameCalls} calls in 2s`);
  ok(env.chains() === 1 && env.probeChains() === 1, 'exactly one rAF(frame) chain and one probe', `frame ${env.chains()}, probe ${env.probeChains()}`);
  ok(env.fallbacksEver() === 0, 'the watchdog never armed', `${env.fallbacksEver()}`);
}

// --- hidden ----------------------------------------------------------------
console.log('\na hidden tab');
{
  const env = makeBrowser();
  load(region, env);
  env.advance(1000);
  const before = env.frameCalls;
  env.setVisible(false);
  env.advance(20000);
  ok(env.frameCalls === before, 'nothing drives frame() for a tab nobody is looking at',
    `${env.frameCalls - before} calls in 20s hidden`);
  ok(env.fallbacksArmed() === 0, 'no fallback armed while hidden');
}

// --- THE BUG: come back, with the overdue timer ahead of the first paint ----
console.log('\nthree tab switches, timer-before-paint on every return');
{
  const env = makeBrowser();
  load(region, env);
  env.advance(1000);
  for (let i = 0; i < 3; i++) {
    env.setVisible(false);
    env.advance(8000);
    env.renderPaused = true;        // visible again, compositor not awake yet
    env.setVisible(true);
    env.advance(300);               // the poller gets its look in here
    env.renderPaused = false;
    env.advance(1500);
  }
  const t0 = env.frameCalls;
  env.advance(2000);
  const rate = (env.frameCalls - t0) / 2;
  ok(env.chains() === 1, 'still exactly one rAF(frame) chain after three switches', `${env.chains()}`);
  ok(rate > 40 && rate < 90, 'frame() runs at one paint each, not a multiple of it',
    `${rate.toFixed(1)}/s`);
  ok(env.fallbacksArmed() === 0, 'no fallback left armed', `${env.fallbacksArmed()}`);
  // THIS ONE IS THE visibilitychange HANDLER'S. The single-handle scheduler
  // above makes an armed fallback harmless; the handler is what stops it
  // arming at all, by saying outright that a tab coming back was never
  // starved. Delete the handler and the poller wins the race on every return,
  // and this count goes to 3.
  ok(env.fallbacksEver() === 0, 'the watchdog never mistook a tab switch for a starved browser',
    `${env.fallbacksEver()} armings across 3 switches`);
}

// --- the handler's other half ----------------------------------------------
console.log('\ngoing away while the watchdog is driving');
{
  const env = makeBrowser();
  load(region, env);
  env.advance(500);
  env.renderPaused = true;          // visible, rAF dead: the fallback arms
  env.advance(2000);
  ok(env.fallbacksArmed() === 1, 'the fallback is armed to begin with');
  const driven = env.frameCalls;
  env.setVisible(false);            // now the tab goes away
  ok(env.fallbacksArmed() === 0, 'it is cleared on the way out');
  env.advance(5000);
  ok(env.frameCalls === driven, 'and nothing draws for a tab nobody is looking at',
    `${env.frameCalls - driven} calls in 5s hidden`);
}

// --- THE WATCHDOG STILL HAS ITS JOB ----------------------------------------
// Opera GX starves rAF on a page that is plainly visible, and shipped a black
// screen. A fix that quiets the watchdog trades a rare browser's total failure
// for a common browser's slowdown, so this is the assertion that must not be
// traded away.
console.log('\na VISIBLE page whose rAF is dead (Opera GX)');
{
  const env = makeBrowser();
  load(region, env);
  env.advance(500);
  const before = env.frameCalls;
  env.renderPaused = true;          // rAF never fires again, page stays visible
  env.advance(4000);
  const driven = env.frameCalls - before;
  ok(driven > 60, 'the watchdog drives frame() itself', `${driven} calls in 4s`);
  ok(env.fallbacksArmed() === 1, 'exactly one fallback armed', `${env.fallbacksArmed()}`);
  ok(env.fallbacksEver() === 1, 'and it was armed only once', `${env.fallbacksEver()}`);

  env.renderPaused = false;         // rAF revives
  env.advance(1500);
  ok(env.fallbacksArmed() === 0, 'the fallback disarms when rAF returns');
  ok(env.chains() === 1, 'and the revival leaves ONE chain, not one per fallback call',
    `${env.chains()}`);
  const t0 = env.frameCalls;
  env.advance(2000);
  const rate = (env.frameCalls - t0) / 2;
  ok(rate > 40 && rate < 90, 'back to one frame() per paint', `${rate.toFixed(1)}/s`);
}

console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
