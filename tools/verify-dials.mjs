#!/usr/bin/env node
// THE TWO PRACTICE BARS — bullet multiplier and bullet cooldown.
//
// No oracle, and there cannot be one: neither dial is in the game. What this
// suite pins is the half that CAN be wrong in a way the player would never
// see until a recorded fight stopped reproducing —
//
//   1. the default path is LITERALLY unchanged (byte-identical traces, and an
//      unarmed state carries no `dials` property at all),
//   2. the bars clamp at both ends and snap to their step grid,
//   3. a NON-default value actually reaches the spawn path — asserted by
//      counting live bullets, because a dial that clamps beautifully and
//      changes nothing is the failure mode a settings suite hides best,
//   4. a replay REFUSES, at the install site rather than by trusting the
//      default,
//   5. and the fight NEVER ANNOUNCES ITSELF — the title page draws the same
//      glyphs with both bars at their extremes as with them at their defaults.
//      Section 4 holds that by recording the draw; see the note there for the
//      banner that used to be, and why it is not coming back.
//
// Every check below is positive: something must have happened, and the number
// that says so is compared, not merely present. `state.counters` is asserted
// too, so "the multiplier ran and produced nothing" is distinguishable from
// "the multiplier never ran" — the trap CLAUDE.md records under "Positive
// execution assertions".

import {
  DIALS, dialSpec, freshDials, clampDial, normaliseDials, stepDial,
  dialFraction, dialsActive, applyDials, cooldownFrames,
  bulletCopies, COPY_SPACING,
} from '../sim/dials.js';
import { markReplay, isReplaying } from '../sim/replay.js';
import { createState, stepFrame, traceHeader, traceRow } from '../sim/index.js';
import { buildSingleAttackScene } from '../sim/scenes/single.js';
import { buildPracticeScene } from '../sim/scenes/practice.js';
import { createTitle, stepTitle, MODES, TITLE_EXTRAS, SETTINGS_PAGES, controlRows } from '../sim/modes.js';

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const NONE = {
  up: false, down: false, left: false, right: false, confirm: false, cancel: false,
};
const IDLE = { ...NONE, focus: false, button3: false };

const ROSTER = [
  { id: 'stars', name: 'Stars', difficulties: [0, 1, 2] },
  { id: 'flurry', name: 'Flurry', difficulties: [0, 1, 3] },
];

/** One EDGE press — the menu is edge-triggered, so it needs a released frame. */
function tap(t, key) {
  const r = stepTitle(t, { ...NONE, [key]: true }, ROSTER);
  stepTitle(t, { ...NONE }, ROSTER);
  return r;
}

// ---------------------------------------------------------------------------
// 1. THE TABLE ITSELF — the ranges and steps, stated here so a silent change
//    to either is a failing suite rather than a different game.
// ---------------------------------------------------------------------------
{
  check(DIALS.length === 2, `expected two dials, got ${DIALS.length}`);
  const m = dialSpec('bulletMult');
  const c = dialSpec('bulletCooldown');
  check(!!m && !!c, 'both dials must exist by id');
  // THE CEILING IS 3 AND THE REASON IS IN sim/dials.js: ROARING already puts
  // hundreds of live bullets through a linear collision sweep every frame, so
  // 3x is the last multiple that still holds 30Hz. If this ever rises, the
  // frame budget is the thing to measure, not this number.
  check(m.min === 1 && m.max === 3 && m.step === 1 && m.def === 1,
    `bullet multiplier range changed: ${JSON.stringify(m)}`);
  // 0 IS THE MOD'S OWN BEHAVIOUR — every frame — which is what makes the
  // nobulletcooldowns toggle the bottom stop of this axis rather than a second
  // mechanism beside it.
  check(c.min === 0 && c.max === 200 && c.step === 25 && c.def === 100,
    `bullet cooldown range changed: ${JSON.stringify(c)}`);
  check(c.format(0) === 'EVERY FRAME',
    `the 0 stop must say what it is, got ${c.format(0)}`);
}

// ---------------------------------------------------------------------------
// 2. CLAMPING AND SNAPPING — both ends, past both ends, and off the grid.
// ---------------------------------------------------------------------------
{
  check(clampDial('bulletMult', 99) === 3, 'the multiplier must clamp at 3');
  check(clampDial('bulletMult', -99) === 1, 'the multiplier must clamp at 1');
  check(clampDial('bulletCooldown', 9999) === 200, 'the cooldown must clamp at 200');
  check(clampDial('bulletCooldown', -1) === 0, 'the cooldown must clamp at 0');
  // OFF THE GRID: a hand-edited localStorage value, or one written by a build
  // with a finer step. It must land where the bar can draw it.
  check(clampDial('bulletCooldown', 113) === 125,
    `113 should snap to the 25 grid, got ${clampDial('bulletCooldown', 113)}`);
  // A NON-NUMBER FALLS BACK TO THE DEFAULT, never to NaN: NaN poisons the
  // `=== def` test that decides whether the run is the real fight, and it
  // would decide it WRONG — silently marking a default run as modified.
  check(clampDial('bulletMult', 'two') === 1, 'a non-number must fall back to the default');
  check(clampDial('bulletMult', null) === 1, 'null must fall back to the default');
  const hostile = normaliseDials({ bulletMult: 40, bulletCooldown: 'x', nonsense: 1 });
  check(hostile.bulletMult === 3 && hostile.bulletCooldown === 100,
    `a hostile saved entry must normalise, got ${JSON.stringify(hostile)}`);
  check(!('nonsense' in hostile), 'an unknown key must not survive normalisation');
  check(dialFraction('bulletMult', 1) === 0 && dialFraction('bulletMult', 3) === 1,
    'the bar fill must run 0..1 across the range');
}

// ---------------------------------------------------------------------------
// 3. DRIVING THE BARS THROUGH THE REAL MENU — walk each to both ends.
//
//    Through `stepTitle`, not by poking `title.dials`: the row lookup, the
//    cursor wrap and the left/right dispatch are the parts that break when a
//    row is inserted, and a suite that writes the field directly would pass
//    with the page unreachable.
// ---------------------------------------------------------------------------

/** A title parked on the CONTROLS page. */
function atControls() {
  const t = createTitle();
  const settings = MODES.length + TITLE_EXTRAS.findIndex((x) => x.id === 'settings');
  for (let i = 0; i < settings; i++) tap(t, 'down');
  tap(t, 'confirm');
  const page = SETTINGS_PAGES.findIndex((p) => p.id === 'controls');
  for (let i = 0; i < page; i++) tap(t, 'down');
  tap(t, 'confirm');
  return t;
}

/** Put the settings cursor on the row with this id. */
function toRow(t, id) {
  const rows = controlRows(t);
  const want = rows.findIndex((r) => r.id === id);
  if (want < 0) return false;
  // The cursor starts wherever the page left it; walk down with wrap.
  for (let i = 0; i < rows.length * 2 && t.settings.cursor !== want; i++) tap(t, 'down');
  return t.settings.cursor === want;
}

{
  const t = atControls();
  check(t.settings?.page === 'controls', `CONTROLS did not open, got ${t.settings?.page}`);
  const rows = controlRows(t);
  check(rows.some((r) => r.id === 'bulletMult' && r.slider),
    'the CONTROLS page has no BULLET MULTIPLIER bar');
  check(rows.some((r) => r.id === 'bulletCooldown' && r.slider),
    'the CONTROLS page has no BULLET COOLDOWN bar');
  // THE TWO SWITCH ROWS SURVIVED. Adding rows to a page whose handler used to
  // end in a bare `else` is exactly how a toggle gets silently rebound — the
  // old code toggled holdBreath for every row that was not TOUCH BUTTONS.
  check(rows[0].id === 'touch' && rows[1].id === 'holdbreath',
    'the CONTROLS switches must keep their place above the bars');
}

// ---- walk the MULTIPLIER to both ends -------------------------------------
{
  const t = atControls();
  check(toRow(t, 'bulletMult'), 'could not reach the BULLET MULTIPLIER row');
  check(t.dials.bulletMult === 1, 'the multiplier must start at its default');
  // LEFT AT THE FLOOR IS SILENT. `out.moved` is the menu blip; a bar parked at
  // its end that keeps blipping is the classic stepped-slider bug.
  const atFloor = tap(t, 'left');
  check(t.dials.bulletMult === 1, 'left at the floor must not go below 1');
  check(!atFloor.moved, 'left at the floor must not report a move');
  tap(t, 'right');
  check(t.dials.bulletMult === 2, `right should step to 2, got ${t.dials.bulletMult}`);
  check(t.dirty === true, 'moving a bar must mark the settings dirty to persist');
  tap(t, 'right');
  check(t.dials.bulletMult === 3, `right should step to 3, got ${t.dials.bulletMult}`);
  const atCeil = tap(t, 'right');
  check(t.dials.bulletMult === 3, 'right at the ceiling must not pass 3');
  check(!atCeil.moved, 'right at the ceiling must not report a move');
  // ...and back down to the default, which must restore the REAL FIGHT label.
  tap(t, 'left'); tap(t, 'left');
  check(t.dials.bulletMult === 1, 'left must walk back to the default');
  check(dialsActive(t.dials) === false,
    'walking every bar back to its default must read as the real fight again');
}

// ---- walk the COOLDOWN to both ends ---------------------------------------
{
  const t = atControls();
  check(toRow(t, 'bulletCooldown'), 'could not reach the BULLET COOLDOWN row');
  let guard = 0;
  while (t.dials.bulletCooldown > 0 && guard++ < 50) tap(t, 'left');
  check(t.dials.bulletCooldown === 0, 'left must reach the EVERY FRAME stop');
  check(guard === 4, `100 -> 0 in steps of 25 is four presses, took ${guard}`);
  guard = 0;
  while (t.dials.bulletCooldown < 200 && guard++ < 50) tap(t, 'right');
  check(t.dials.bulletCooldown === 200, 'right must reach 200');
  check(guard === 8, `0 -> 200 in steps of 25 is eight presses, took ${guard}`);
  const over = tap(t, 'right');
  check(t.dials.bulletCooldown === 200, 'right at the ceiling must not pass 200');
  check(!over.moved, 'right at the ceiling must not report a move');
}

// ---- CONFIRM IS NOT A STEP, and the switch rows still toggle ---------------
{
  const t = atControls();
  toRow(t, 'bulletMult');
  tap(t, 'confirm');
  check(t.dials.bulletMult === 1,
    'Z on a bar must not change it — it is how the player leaves the page');
  const t2 = atControls();
  toRow(t2, 'holdbreath');
  tap(t2, 'right');
  check(t2.holdBreath === true, 'the HOLDBREATH switch must still toggle');
  check(t2.dials.bulletMult === 1 && t2.dials.bulletCooldown === 100,
    'toggling a switch must not touch a bar');
  const t3 = atControls();
  toRow(t3, 'touch');
  tap(t3, 'right');
  check(t3.swapZX === true, 'the TOUCH BUTTONS switch must still toggle');
  check(t3.holdBreath === false,
    'TOUCH BUTTONS must not fall through to HOLDBREATH — the bare-else bug');
}

// ---- A REPLAY LOCKS THE ROWS AND REFUSES ----------------------------------
{
  const t = atControls();
  t.replaying = true;
  toRow(t, 'bulletMult');
  const rows = controlRows(t);
  check(rows.find((r) => r.id === 'bulletMult').locked === true,
    'a replay must mark the bars locked so the page can dim them');
  const r = tap(t, 'right');
  check(t.dials.bulletMult === 1, 'a locked bar must not move');
  check(r.error === true, 'a locked bar must sound the refusal, not fail silently');
}

// ---------------------------------------------------------------------------
// 4. `dialsActive` IS A SIM PREDICATE — and the title screen SAYS NOTHING.
//
//    Two halves, and the second is the one that keeps coming back.
//
//    `dialsActive` exists for `applyDials`, which refuses to arm a state whose
//    dials are all at their defaults. That is the whole of its job.
//
//    IT MUST NOT ACQUIRE A SECOND ONE. A revision of this lane painted
//    "PRACTICE DIALS ON — NOT THE REAL FIGHT" under the title wordmark off
//    exactly this predicate, on a reading of CLAUDE.md law 4. The user has
//    rejected self-describing UI copy three times, in those words, and law 4 is
//    about INVENTED CONTENT a player could mistake for the real fight — not
//    about narrating a setting back to the person who just moved the slider.
//    The bar's own row on the CONTROLS page is the disclosure.
//
//    So this asserts the absence POSITIVELY, by drawing: every glyph drawTitle
//    blits on the title page with both bars at their extremes must be the same
//    glyph, in the same place, as with the bars at their defaults. A banner —
//    or a word, or a single character — anywhere on that page fails it.
//
//    SABOTAGE-TESTED BOTH WAYS: restoring the `centred(... 'PRACTICE DIALS ON
//    ...')` call in render/title.js fails this section (16 extra glyphs at
//    y 104); deleting drawTitle's wordmark line instead fails the
//    "actually drew something" guard below rather than passing silently.
// ---------------------------------------------------------------------------
{
  check(dialsActive(freshDials()) === false, 'an all-default set is the real fight');
  check(dialsActive(null) === false, 'no dials at all is the real fight');
  check(dialsActive({ bulletMult: 2, bulletCooldown: 100 }) === true,
    'a raised multiplier must read as active');
  check(dialsActive({ bulletMult: 1, bulletCooldown: 50 }) === true,
    'a retimed cooldown must read as active');
}

{
  // ---- the draw harness, lifted from tools/verify-titlemenu.mjs -----------
  //
  // Same stub shape and the same reason: `drawTitle` returns on its second
  // line when `loadFont()` is not ready, so without a resolving font this
  // whole section would compare two empty recordings and pass on nothing.
  // The `drew > 0` guard below is what makes that failure loud.
  const META = {
    name: 'fnt_mainbig',
    glyphs: Array.from({ length: 95 }, (_, i) => ({
      c: 32 + i, x: i * 16, y: 0, w: 12, h: 24, shift: 14, offset: 0,
    })),
  };
  globalThis.fetch = async () => ({ json: async () => META });
  globalThis.Image = class {
    constructor() { this.width = 1520; this.height = 24; }
    set src(v) { this._src = v; queueMicrotask(() => this.onload && this.onload()); }
    get src() { return this._src; }
  };

  const blits = [];
  let recording = false;
  const mkCtx = (owner) => new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return owner;
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') {
        return () => ({ addColorStop: () => {} });
      }
      if (p === 'fillRect') return () => { owner.fill = t.fillStyle; };
      if (p === 'drawImage') {
        return (img, ...a) => {
          // drawText's 9-argument form: dx/dy are arguments 5 and 6. The FILL
          // is recorded too, so recolouring the wordmark counts as a change.
          if (owner.main && recording) {
            blits.push(`${img?.fill ?? null}@${a[4]},${a[5]}`);
          }
        };
      }
      if (typeof p === 'string') return t[p] !== undefined ? t[p] : () => undefined;
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
  globalThis.document = {
    createElement: (tag) => {
      if (tag !== 'canvas') return {};
      const c = { width: 0, height: 0, style: {}, fill: null };
      c.getContext = () => mkCtx(c);
      return c;
    },
  };

  const { drawTitle } = await import('../render/title.js');
  const { loadFont } = await import('../render/font.js');
  loadFont();
  loadFont('../assets/fonts', 'fnt_main');
  const main = { width: 640, height: 480, style: {}, main: true };
  const ctx = mkCtx(main);
  const sprites = { get: () => null };

  /** Every glyph one drawTitle paints, in pen order. */
  const glyphsFor = (t) => {
    recording = true;
    blits.length = 0;
    drawTitle(ctx, t, sprites, ROSTER);
    recording = false;
    return blits.slice();
  };

  const plain = createTitle();
  // The font loads asynchronously; the first draw only starts it.
  drawTitle(ctx, plain, sprites, ROSTER);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  const quiet = glyphsFor(plain);
  check(quiet.length > 0,
    'the title page drew NOTHING — the font never resolved, so every '
    + 'comparison in this section would be vacuous');

  // BOTH BARS AT THEIR EXTREMES, which is the loudest a run can be.
  const loud = createTitle();
  loud.dials = { bulletMult: 3, bulletCooldown: 0 };
  check(dialsActive(loud.dials) === true, 'the loud title must really be off-default');
  const noisy = glyphsFor(loud);

  check(noisy.length === quiet.length,
    `the title page drew ${noisy.length} glyphs with the bars moved against `
    + `${quiet.length} at their defaults — something announces itself`);
  let firstExtra = -1;
  for (let i = 0; i < Math.max(noisy.length, quiet.length); i++) {
    if (noisy[i] !== quiet[i]) { firstExtra = i; break; }
  }
  check(firstExtra === -1,
    `the title page changed at glyph ${firstExtra} when the bars moved: `
    + `${quiet[firstExtra]} -> ${noisy[firstExtra]} — no banner, no label, `
    + 'nothing that announces itself');

  // AND THE SAME FOR A REPLAY-LOCKED TITLE, which is the other state that
  // tempts a status line onto the screen.
  const locked = createTitle();
  locked.replaying = true;
  const lockedGlyphs = glyphsFor(locked);
  check(lockedGlyphs.join('|') === quiet.join('|'),
    'a replay-driven title must not announce itself on the title page either');
}

// ---------------------------------------------------------------------------
// 5. THE COOLDOWN READ — and the default is LITERAL IDENTITY.
// ---------------------------------------------------------------------------
{
  const bare = { };
  // Not "returns an equal number" — returns the SAME value, having done no
  // arithmetic. This is the shape lane 1's spawn-interval sites will call.
  check(cooldownFrames(bare, 5) === 5, 'an unarmed state must hand the interval back');
  check(cooldownFrames(bare, 40) === 40, 'an unarmed state must hand the interval back');
  const armed = { dials: { bulletMult: 1, bulletCooldown: 100 } };
  check(cooldownFrames(armed, 5) === 5, 'a default cooldown must hand the interval back');
  const fast = { dials: { bulletMult: 1, bulletCooldown: 50 } };
  check(cooldownFrames(fast, 40) === 20, `50% of 40 is 20, got ${cooldownFrames(fast, 40)}`);
  check(cooldownFrames(fast, 5) === 3, `50% of 5 rounds to 3, got ${cooldownFrames(fast, 5)}`);
  const slow = { dials: { bulletMult: 1, bulletCooldown: 200 } };
  check(cooldownFrames(slow, 40) === 80, '200% of 40 is 80');
  const every = { dials: { bulletMult: 1, bulletCooldown: 0 } };
  check(cooldownFrames(every, 40) === 1, 'the 0 stop is EVERY FRAME, i.e. an interval of 1');
  // THE FLOOR IS 1, NEVER 0. An interval of 0 is not "faster" — `timer % 0` is
  // NaN and `timer >= 0` is always true, so a 0 would mean two different
  // things at two different sites. This is the guard that keeps the dial from
  // ever producing one.
  const tiny = { dials: { bulletMult: 1, bulletCooldown: 25 } };
  check(cooldownFrames(tiny, 1) === 1, 'the interval must never fall below 1');
  check(cooldownFrames(tiny, 2) === 1, 'the interval must never fall below 1');
}

// ---------------------------------------------------------------------------
// 6. INSTALLING ON A STATE — including the two refusals.
// ---------------------------------------------------------------------------
{
  const s = createState({ seed: 1 });
  check(applyDials(s, freshDials()) === false,
    'an all-default set must REFUSE to arm — that is what keeps the builds identical');
  check(s.dials === null, 'a refused install must leave no dials behind');
  check(bulletCopies(s) === 1, 'an unarmed state spawns one bullet per bullet');

  const s2 = createState({ seed: 1 });
  check(applyDials(s2, { bulletMult: 2, bulletCooldown: 100 }) === true,
    'a non-default set must arm');
  check(s2.dials.bulletMult === 2, 'the armed value must be the one asked for');
  check(bulletCopies(s2) === 2, 'the spawn path must read the armed multiplier');

  // THE REPLAY REFUSAL, at the install site.
  const s3 = createState({ seed: 1 });
  markReplay(s3);
  check(isReplaying(s3) === true, 'markReplay must mark');
  check(applyDials(s3, { bulletMult: 3, bulletCooldown: 0 }) === false,
    'a replay must refuse the dials');
  check(s3.dials === null, 'a refused replay install must leave no dials behind');
  check(bulletCopies(s3) === 1, 'a replay must spawn the recorded number of bullets');
}

// ---------------------------------------------------------------------------
// 7. THE DEFAULT PATH IS BYTE-IDENTICAL — the hard gate, run as a diff.
//
//    Two whole scenes, one built the way every suite in this repo builds it
//    and one built through the new `dials` argument at its default, traced row
//    for row. Exact string equality, the project's own comparison.
// ---------------------------------------------------------------------------
function traceOf(build, frames) {
  const st = createState({ seed: 4242, traceBulletSlots: 4 });
  build(st);
  const rows = [];
  for (let i = 0; i < frames; i++) {
    stepFrame(st, IDLE);
    rows.push(traceRow(st));
  }
  return { rows, state: st };
}

{
  const FRAMES = 420;
  const plain = traceOf((st) => buildSingleAttackScene(st, {
    seed: 4242, attack: 'stars', difficulty: 0,
  }), FRAMES);
  const withDefaults = traceOf((st) => buildSingleAttackScene(st, {
    seed: 4242, attack: 'stars', difficulty: 0, dials: freshDials(),
  }), FRAMES);
  let firstDiff = -1;
  for (let i = 0; i < FRAMES; i++) {
    if (plain.rows[i] !== withDefaults.rows[i]) { firstDiff = i; break; }
  }
  check(firstDiff === -1,
    `the default dials changed the fight at frame ${firstDiff}\n`
    + `  plain: ${plain.rows[firstDiff]}\n  dials: ${withDefaults.rows[firstDiff]}`);
  check(plain.state.dials == null && withDefaults.state.dials == null,
    'neither default build may leave dials armed');
  // POSITIVE EXECUTION: the scene really ran an attack, so the diff above is
  // not two identical empty traces agreeing about nothing.
  check(plain.state.counters.motionSteps > 100,
    `the baseline scene barely moved (${plain.state.counters.motionSteps} motion steps) `
    + '— the byte-identity check would be vacuous');
  // The fight scene too: it is the one the byte gate replays.
  const f1 = traceOf((st) => buildPracticeScene(st, { seed: 4242 }), 200);
  const f2 = traceOf((st) => buildPracticeScene(st, { seed: 4242, dials: freshDials() }), 200);
  let fd = -1;
  for (let i = 0; i < 200; i++) if (f1.rows[i] !== f2.rows[i]) { fd = i; break; }
  check(fd === -1, `the default dials changed the FIGHT scene at frame ${fd}`);
}

// ---------------------------------------------------------------------------
// 8. A NON-DEFAULT MULTIPLIER REACHES THE SPAWN PATH — counted, not assumed.
//
//    This is the check the whole lane exists for. A dial that clamps, draws a
//    pretty bar, persists correctly and changes nothing is indistinguishable
//    from a working one everywhere except here.
// ---------------------------------------------------------------------------
function bulletsOver(dials, frames = 420) {
  const st = createState({ seed: 4242 });
  buildSingleAttackScene(st, {
    seed: 4242, attack: 'stars', difficulty: 0, dials,
  });
  let peak = 0;
  let clones = 0;
  for (let i = 0; i < frames; i++) {
    stepFrame(st, IDLE);
    const live = st.entities.filter((e) => e.alive && e.isBullet);
    if (live.length > peak) peak = live.length;
    clones = st.entities.filter((e) => e.alive && e.dialCopy).length || clones;
  }
  return { peak, clones, state: st };
}

{
  const one = bulletsOver(null);
  const two = bulletsOver({ bulletMult: 2, bulletCooldown: 100 });
  const three = bulletsOver({ bulletMult: 3, bulletCooldown: 100 });

  check(one.peak > 0, 'the baseline attack must actually put bullets on screen');
  check(one.clones === 0, 'the default must produce no copies at all');
  check(two.peak > one.peak,
    `2x must put more bullets on screen than 1x (${two.peak} vs ${one.peak})`);
  check(three.peak > two.peak,
    `3x must put more bullets on screen than 2x (${three.peak} vs ${two.peak})`);
  check(two.clones > 0, 'a 2x run must have produced copies');
  // AND THE COPIES ARE NOT ON TOP OF THE ORIGINALS. A duplicate at the same
  // x/y with the same heading is invisible and would satisfy every count above
  // while changing nothing the player can see or dodge.
  const st = two.state;
  const copies = st.entities.filter((e) => e.alive && e.dialCopy);
  const anyOffset = copies.some((c) => st.entities.some(
    (o) => o.alive && o.isBullet && !o.dialCopy && o.type === c.type
      && (o.x !== c.x || o.y !== c.y),
  ));
  check(copies.length === 0 || anyOffset,
    'the copies sit exactly on their originals — the multiplier is invisible');
  // AND THE MULTIPLIER DOES NOT COMPOUND. A bullet whose Create spawns more
  // bullets would otherwise give mult^depth; the reentrancy stop in
  // sim/entity.js is what holds the peak near the ratio.
  check(three.peak < one.peak * 3 + 60,
    `3x compounded: ${three.peak} live against a 1x peak of ${one.peak}`);
}

// ---------------------------------------------------------------------------
// 9. THE COPY SPACING IS A REAL NUMBER, not an accidental zero.
// ---------------------------------------------------------------------------
check(COPY_SPACING > 0, 'the copy spacing must be non-zero or the copies overlap');

// ---------------------------------------------------------------------------
if (failures.length) {
  console.log(`FAIL — ${failures.length} check(s)`);
  for (const f of failures) console.log(`  * ${f}`);
  process.exit(1);
}
console.log('OK — the practice bars clamp, stay silent, reach the spawn path, and default to nothing');
