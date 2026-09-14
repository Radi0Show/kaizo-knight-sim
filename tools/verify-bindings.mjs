#!/usr/bin/env node
// REBINDABLE CONTROLS, three profiles, headless.
//
// There is no oracle for this and there cannot be: nothing in DELTARUNE's GML
// corresponds to a rebind menu. So the truth this suite holds the code to is
// THE BUILD IT REPLACES — the frozen KEYMAP that used to live in
// input/keyboard.js and the hardcoded reads in input/gamepad.js, transcribed
// below as `SHIPPED_*` and asserted against the new profile-driven binders
// event for event. A default profile that does not reproduce them exactly is
// a regression on a live page, and this is the only thing that can say so.
//
// The other half is the model: capture, the escape hatch, conflicts, and the
// persistence shape's behaviour on corrupt input.
//
// POSITIVE ASSERTIONS THROUGHOUT (CLAUDE.md, "Positive execution assertions"):
// counters prove the mechanisms RAN. `method.changes` proves detection
// switched rather than merely agreeing, and the assertion count at the bottom
// proves the suite did not go hollow.

import { readFileSync } from 'node:fs';

const failures = [];
const check = (c, what) => { if (!c) failures.push(what); };
let assertions = 0;
const eq = (a, b, what) => { assertions += 1; check(a === b, `${what} — got ${a}, want ${b}`); };
const same = (a, b, what) => {
  assertions += 1;
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  check(x === y, `${what} — got ${x}, want ${y}`);
};
const on = (r) => Object.keys(r).filter((k) => r[k]).sort();

// ── the stub DOM ───────────────────────────────────────────────────────────
function stubTarget() {
  const l = {};
  return {
    addEventListener(t, f) { (l[t] ??= []).push(f); },
    removeEventListener(t, f) { l[t] = (l[t] ?? []).filter((g) => g !== f); },
    fire(t, ev) { for (const f of [...(l[t] ?? [])]) f({ preventDefault() {}, ...ev }); },
  };
}
function stubEl(rect) {
  const l = {};
  return {
    classList: { add() {}, remove() {} },
    addEventListener(t, f) { (l[t] ??= []).push(f); },
    setPointerCapture() {},
    getBoundingClientRect() { return rect; },
    fire(t, ev) { for (const f of [...(l[t] ?? [])]) f({ type: t, preventDefault() {}, ...ev }); },
  };
}
/** A pad the Gamepad API would hand back. */
function stubPad({ buttons = 16, axes = 4 } = {}) {
  return {
    connected: true,
    buttons: Array.from({ length: buttons }, () => ({ pressed: false })),
    axes: Array.from({ length: axes }, () => 0),
  };
}
let PADS = [];
Object.defineProperty(globalThis, 'navigator', {
  value: { getGamepads: () => PADS },
  configurable: true,
  writable: true,
});

const B = await import('../input/bindings.js');
const { createInputMethod, NO_METHOD } = await import('../input/method.js');
const { bindKeyboard } = await import('../input/keyboard.js');
const { bindGamepad } = await import('../input/gamepad.js');
const { bindTouch, buttonsFromProfile } = await import('../input/touch.js');

// ── 1. THE ACTION SET IS THE ONE THE SIM ACTUALLY READS ────────────────────
// Read out of sim/menu.js and sim/replay.js rather than restated here, so an
// action added to the sim and forgotten in the binding model is a FAILURE and
// not a silent gap. This is the spine of the lane: the canonical list comes
// from the code.
{
  const menuSrc = readFileSync(new URL('../sim/menu.js', import.meta.url), 'utf8');
  const raw = menuSrc.match(/const MENU_KEYS = \[([^\]]*)\]/)?.[1] ?? '';
  const menuKeys = [...raw.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]);
  eq(menuKeys.length >= 8, true, 'MENU_KEYS could not be read out of sim/menu.js');
  for (const k of menuKeys) {
    assertions += 1;
    check(B.SIM_ACTIONS.includes(k), `sim/menu.js reads '${k}' but it is not a SIM_ACTION`);
  }
  const replaySrc = readFileSync(new URL('../sim/replay.js', import.meta.url), 'utf8');
  for (const k of B.SIM_ACTIONS) {
    assertions += 1;
    check(new RegExp(`(^|[\\s{])${k}: \\d+`, 'm').test(replaySrc),
      `'${k}' is a SIM_ACTION but sim/replay.js has no replay bit for it`);
  }
  // And nothing the sim never reads is smuggled in as one.
  for (const k of B.SIM_ACTIONS) {
    assertions += 1;
    check(menuKeys.includes(k) || k === 'focus',
      `'${k}' is a SIM_ACTION that nothing in sim/menu.js reads`);
  }
}

// ── 2. KEYBOARD DEFAULTS == THE SHIPPED KEYMAP ─────────────────────────────
// Transcribed from input/keyboard.js as it stood at v1.0.51. This is the
// regression oracle for the whole lane.
const SHIPPED_KEYMAP = {
  ArrowLeft: ['left'], ArrowRight: ['right'], ArrowUp: ['up'], ArrowDown: ['down'],
  KeyA: ['left'], KeyD: ['right'], KeyW: ['up'], KeyS: ['down'],
  KeyX: ['focus', 'cancel'],
  ShiftLeft: ['focus'], ShiftRight: ['focus'],
  KeyZ: ['confirm'], Enter: ['confirm'],
  Escape: ['cancel'],
  KeyC: ['button3'],
};
{
  const target = stubTarget();
  const kb = bindKeyboard(target);
  for (const [code, want] of Object.entries(SHIPPED_KEYMAP)) {
    target.fire('keydown', { code });
    same(on(kb.read()), [...want].sort(), `keyboard default: ${code}`);
    target.fire('keyup', { code });
    same(on(kb.read()), [], `keyboard release: ${code}`);
  }
  // A code that was never bound stays unbound.
  target.fire('keydown', { code: 'KeyQ' });
  same(on(kb.read()), [], 'KeyQ is not bound to anything');

  // A tap between two reads still registers for one frame (the latch that
  // makes 30 Hz sampling survive a fast player).
  target.fire('keydown', { code: 'KeyZ' });
  target.fire('keyup', { code: 'KeyZ' });
  eq(kb.read().confirm, true, 'a tap between reads did not latch');
  eq(kb.read().confirm, false, 'the tap latch did not clear after one read');

  // THE SHAPE THE SIM SEES MUST NOT WIDEN. The byte gate replays recorded
  // fights through this object; a stray field is a silent divergence.
  target.fire('keydown', { code: 'KeyR' });   // reset — a DRIVER action
  target.fire('keydown', { code: 'Escape' }); // cancel + exit
  const shaped = kb.read();
  eq('reset' in shaped, false, 'read() leaked the reset driver action to the sim');
  eq('exit' in shaped, false, 'read() leaked the exit driver action to the sim');
  eq(shaped.cancel, true, 'Escape stopped being cancel');
  same(Object.keys(shaped).sort(), [...B.SIM_ACTIONS].sort().filter((k) => k !== 'button3'),
    'the input object grew or lost a field');
  // ...and the driver DOES see them, on their own channel.
  const edges = kb.driverEdges();
  eq(edges.reset, true, 'KeyR did not raise a reset driver edge');
  eq(edges.exit, true, 'Escape did not raise an exit driver edge');
  eq(kb.driverEdges().reset, false, 'driver edges did not drain');
  kb.dispose();
}

// ── 3. GAMEPAD DEFAULTS == THE SHIPPED READS ───────────────────────────────
{
  const pad = stubPad();
  PADS = [pad];
  const gp = bindGamepad();
  const clear = () => { for (const b of pad.buttons) b.pressed = false; pad.axes.fill(0); };
  const SHIPPED_PAD = {
    12: ['up'], 13: ['down'], 14: ['left'], 15: ['right'],
    0: ['confirm'], 1: ['cancel', 'focus'],
    2: ['button3'], 3: ['button3'], 4: ['focus'], 5: ['focus'],
  };
  for (const [i, want] of Object.entries(SHIPPED_PAD)) {
    clear();
    pad.buttons[Number(i)].pressed = true;
    same(on(gp.read()), [...want].sort(), `gamepad default: b${i}`);
  }
  // Buttons the build never bound stay unbound.
  clear();
  pad.buttons[6].pressed = true;
  same(on(gp.read()), [], 'b6 is bound to something');
  // Axes, both directions, and the 0.5 deadzone.
  const axis = (i, v) => { clear(); pad.axes[i] = v; return gp.read(); };
  eq(axis(0, -1).left, true, 'axis 0 negative is not left');
  eq(axis(0, 1).right, true, 'axis 0 positive is not right');
  eq(axis(1, -1).up, true, 'axis 1 negative is not up');
  eq(axis(1, 1).down, true, 'axis 1 positive is not down');
  same(on(axis(0, 0.4)), [], 'stick drift inside the deadzone produced input');
  // Driver edges: select resets, start exits, each once per press.
  clear(); pad.buttons[8].pressed = true;
  eq(gp.driverEdges().reset, true, 'select did not raise reset');
  eq(gp.driverEdges().reset, false, 'a HELD select raised reset twice');
  clear(); pad.buttons[9].pressed = true;
  eq(gp.driverEdges().exit, true, 'start did not raise exit');
  // A driver button never reaches the sim's object either.
  same(on(gp.read()), [], 'start leaked into the sim input');
  clear();
  PADS = [];
  same(on(gp.read()), [], 'no pad still produced input');
}

// ── 4. TOUCH DEFAULTS == THE SHIPPED OVERLAY WIRING ────────────────────────
{
  const els = {
    btnZ: stubEl({ left: 300, top: 300, width: 64, height: 64 }),
    btnX: stubEl({ left: 220, top: 300, width: 64, height: 64 }),
    btnR: stubEl({ left: 300, top: 0, width: 44, height: 44 }),
  };
  const wiring = buttonsFromProfile(B.DEFAULT_BINDINGS.touch, els);
  const byCode = Object.fromEntries(wiring.map((w) => [w.code, w.actions.sort()]));
  same(byCode.btnZ, ['confirm'], 'touch default: btnZ');
  same(byCode.btnX, ['cancel', 'focus'], 'touch default: btnX');
  same(byCode.btnR, ['exit', 'reset'], 'touch default: btnR');

  // And behaviourally: a TAP on R restarts, a HOLD leaves. The profile adds
  // `exit` to the slot web/main.js wires as ['reset'] alone; touch.js splits
  // the two by DURATION, so both wirings behave identically.
  const pad = stubEl({ left: 0, top: 0, width: 148, height: 148 });
  let resets = 0;
  let exits = 0;
  const t = bindTouch({
    pad,
    slots: { ...els },
    profile: B.DEFAULT_BINDINGS.touch,
    onReset: () => { resets += 1; },
    onExit: () => { exits += 1; },
    holdMs: 20,
  });
  els.btnZ.fire('pointerdown', { pointerId: 1, clientX: 332, clientY: 332 });
  eq(t.read().confirm, true, 'a profile-wired Z tap did not latch confirm');
  els.btnZ.fire('pointerup', { pointerId: 1 });
  t.read();
  els.btnX.fire('pointerdown', { pointerId: 2, clientX: 252, clientY: 332 });
  const x = t.read();
  eq(x.focus === true && x.cancel === true, true, 'a profile-wired X press is not focus+cancel');
  els.btnX.fire('pointerup', { pointerId: 2 });
  t.read();
  els.btnR.fire('pointerdown', { pointerId: 3 });
  els.btnR.fire('pointerup', { pointerId: 3 });
  eq(resets, 1, 'a tap on R did not restart');
  eq(exits, 0, 'a tap on R also exited');
  // The pad's directions are geometric and survive the profile.
  pad.fire('pointerdown', { pointerId: 4, clientX: 140, clientY: 74 });
  eq(t.read().right, true, 'the d-pad stopped producing directions under a profile');
  pad.fire('pointerup', { pointerId: 4 });
  // And a driver action can never widen the sim's object.
  const shaped = t.read();
  eq('reset' in shaped, false, 'touch read() leaked reset to the sim');
  eq('exit' in shaped, false, 'touch read() leaked exit to the sim');

  els.btnR.fire('pointerdown', { pointerId: 5 });
  await new Promise((r) => { setTimeout(r, 60); });
  eq(exits, 1, 'a HOLD on R did not leave the run');
  eq(resets, 1, 'the hold also restarted');

  // setProfile rewires live, without tearing the listeners down. X drops the
  // slow modifier and keeps cancel — `focus` is not a REQUIRED action, so it
  // may be left deliberately unbound; `confirm` could not be emptied this way
  // and that guard is asserted in section 7.
  const swapped = B.unbindCode('touch', B.defaultProfile('touch'), 'focus', 'btnX').profile;
  same(swapped.focus, [], 'the touch focus slot could not be unbound');
  t.setProfile(swapped);
  els.btnX.fire('pointerdown', { pointerId: 6, clientX: 252, clientY: 332 });
  const r6 = t.read();
  eq(r6.cancel, true, 'a rewired touch slot lost the action it kept');
  eq(r6.focus, false, 'the rewired slot kept the action that was unbound');
  els.btnX.fire('pointerup', { pointerId: 6 });

  // A LEGACY-WIRED binder (the `buttons` API, no slot ids — what web/main.js
  // and tools/verify-touch.mjs pass) survives setProfile untouched. Clearing
  // those would silently unwire the shipped overlay.
  const lz = stubEl({ left: 0, top: 0, width: 64, height: 64 });
  const lt = bindTouch({ buttons: [{ el: lz, actions: ['confirm'] }] });
  lt.setProfile(B.defaultProfile('touch'));
  lz.fire('pointerdown', { pointerId: 7 });
  eq(lt.read().confirm, true, 'setProfile unwired a legacy-bound button');
  lz.fire('pointerup', { pointerId: 7 });
}

// ── 5. DETECTION — LAST USED WINS, AND IT IS OBSERVABLE ────────────────────
{
  let t = 0;
  const seen = [];
  const method = createInputMethod({ now: () => (t += 10), onChange: (m, p) => seen.push(`${p}->${m}`) });
  eq(method.active, 'keyboard', 'cold default is not keyboard');
  eq(method.changes, 0, 'a fresh detector claims changes');

  const target = stubTarget();
  const kb = bindKeyboard(target, { method });
  const padEl = stubEl({ left: 0, top: 0, width: 148, height: 148 });
  const tc = bindTouch({ pad: padEl, buttons: [], method });
  const pad = stubPad();
  PADS = [pad];
  const gp = bindGamepad({ method });

  padEl.fire('pointerdown', { pointerId: 1, clientX: 140, clientY: 74 });
  eq(method.active, 'touch', 'a touch did not switch the method');
  pad.buttons[0].pressed = true;
  gp.read();
  eq(method.active, 'gamepad', 'a pad button did not switch the method');
  target.fire('keydown', { code: 'KeyZ' });
  eq(method.active, 'keyboard', 'a keypress did not switch the method');
  // POSITIVE: detection RAN, three times, in that order.
  eq(method.changes, 3, 'detection did not run three times');
  same(seen, ['keyboard->touch', 'touch->gamepad', 'gamepad->keyboard'], 'the change log');
  eq(method.hasUsed('gamepad'), true, 'the pad was used and hasUsed says no');
  eq(method.hasUsed('touch'), true, 'the overlay was used and hasUsed says no');
  eq(method.snapshot().active, 'keyboard', 'the snapshot disagrees with the live value');
  // A HELD pad does not steal it back: the switch is on edges a person made,
  // and a leaned-on stick would otherwise pin the method forever.
  const before = method.changes;
  gp.read();
  gp.read();
  eq(method.changes, before, 'a still-held pad button re-stole the method');
  // NON-DESTRUCTIVE by construction: the detector holds no bindings at all.
  eq('bindings' in method, false, 'the detector holds bindings');
  kb.dispose();
  tc.read();
  PADS = [];
}

// ── 6. CAPTURE, AND THE ESCAPE HATCH ───────────────────────────────────────
{
  const target = stubTarget();
  const kb = bindKeyboard(target);
  let captured = 'UNSET';
  kb.captureNext((code) => { captured = code; });
  eq(kb.capturing(), true, 'capture did not arm');
  target.fire('keydown', { code: 'KeyJ' });
  eq(captured, 'KeyJ', 'capture did not report the key');
  eq(kb.capturing(), false, 'capture did not disarm after reporting');
  // SWALLOWED: the captured key must not also press the row behind the prompt.
  same(on(kb.read()), [], 'the captured key also reached the sim');

  // THE SOFT-LOCK GUARD. Escape aborts a capture; it can never be rebound.
  captured = 'UNSET';
  kb.captureNext((code) => { captured = code; });
  target.fire('keydown', { code: 'Escape' });
  eq(captured, null, 'Escape was captured as a bindable code');
  eq(B.isReserved('keyboard', 'Escape'), true, 'Escape is not reserved');
  const r = B.bindCode('keyboard', B.defaultProfile('keyboard'), 'confirm', 'Escape');
  eq(r.changed, false, 'Escape could be bound to confirm');
  eq(r.reason, 'reserved', 'binding Escape gave the wrong reason');
  // Cancelling reports null and disarms.
  captured = 'UNSET';
  const cancel = kb.captureNext((code) => { captured = code; });
  cancel();
  eq(captured, null, 'cancelling a capture did not report null');
  eq(kb.capturing(), false, 'cancel left the capture armed');
  // Arming twice aborts the first rather than leaving two live.
  let first = 'UNSET';
  let second = 'UNSET';
  kb.captureNext((c) => { first = c; });
  kb.captureNext((c) => { second = c; });
  target.fire('keydown', { code: 'KeyK' });
  eq(first, null, 're-arming did not abort the first capture');
  eq(second, 'KeyK', 're-arming did not install the second capture');
  kb.dispose();

  // Gamepad capture: a button already held when the capture armed binds
  // nothing; the next fresh press does.
  const pad = stubPad();
  PADS = [pad];
  const gp = bindGamepad();
  pad.buttons[7].pressed = true;
  let gcap = 'UNSET';
  gp.captureNext((code) => { gcap = code; });
  gp.read();
  eq(gcap, 'UNSET', 'a button held at arm time was captured');
  pad.buttons[11].pressed = true;
  gp.read();
  eq(gcap, 'b11', 'a fresh pad press was not captured');
  // An axis captures with its direction.
  let acap = 'UNSET';
  pad.buttons[7].pressed = false;
  pad.buttons[11].pressed = false;
  gp.captureNext((code) => { acap = code; });
  pad.axes[2] = -0.9;
  gp.read();
  eq(acap, 'a2-', 'a stick push was not captured with its direction');
  PADS = [];

  // Touch capture reports the SLOT, which is what a touch profile binds.
  const bz = stubEl({ left: 0, top: 0, width: 64, height: 64 });
  const tp = stubEl({ left: 0, top: 200, width: 148, height: 148 });
  const tt = bindTouch({ pad: tp, slots: { btnZ: bz }, profile: B.DEFAULT_BINDINGS.touch });
  let tcap = 'UNSET';
  tt.captureNext((code) => { tcap = code; });
  bz.fire('pointerdown', { pointerId: 9 });
  eq(tcap, 'btnZ', 'a touch capture did not report its slot');
  same(on(tt.read()), [], 'the captured tap also reached the sim');
}

// ── 7. CONFLICTS, AND WHY THEY ARE REPORTED AND NOT REFUSED ────────────────
{
  const p = B.defaultProfile('keyboard');
  // The SHIPPED default is itself a conflict: KeyX is focus AND cancel. A
  // model that refused conflicts could not express the build it replaces, so
  // `conflictsFor` reports and `bindCode` allows.
  same(B.conflictsFor(p, 'KeyX', 'cancel'), ['focus'], 'the KeyX conflict was not reported');
  same(B.conflictsFor(p, 'KeyJ', 'cancel'), [], 'an unused code reported a conflict');
  const added = B.bindCode('keyboard', p, 'up', 'KeyZ');
  eq(added.changed, true, 'a conflicting bind was refused');
  eq(added.profile.confirm.includes('KeyZ'), true, 'a plain bind stole the code');
  eq(added.profile.up.includes('KeyZ'), true, 'a plain bind did not add the code');
  // Exclusive is opt-in and DOES steal it.
  const ex = B.bindCode('keyboard', p, 'up', 'KeyZ', { exclusive: true });
  eq(ex.profile.confirm.includes('KeyZ'), false, 'exclusive did not clear the other action');
  eq(ex.profile.confirm.length > 0, true, 'exclusive stranded confirm with no key');
  // Never mutates: the source profile is untouched by either.
  same(p.confirm, ['KeyZ', 'Enter'], 'bindCode mutated the profile it was given');
  // Unbinding the last key of a REQUIRED action restores its defaults rather
  // than leaving the device unable to answer a menu.
  const stripped = B.unbindCode('keyboard', p, 'cancel', 'KeyX').profile;
  eq(B.unbindCode('keyboard', stripped, 'cancel', 'Escape').reason, 'reserved',
    'Escape was unbindable from cancel');
  const noConfirm = B.unbindCode('keyboard',
    B.unbindCode('keyboard', p, 'confirm', 'KeyZ').profile, 'confirm', 'Enter');
  eq(noConfirm.reason, 'restored-required', 'emptying confirm was not caught');
  same(noConfirm.profile.confirm, ['KeyZ', 'Enter'], 'confirm was not restored to defaults');
  // A non-required action MAY be emptied deliberately.
  same(B.unbindCode('keyboard', p, 'button3', 'KeyC').profile.button3, [],
    'an optional action could not be unbound');
  // Per-action and whole-profile reset.
  same(B.resetBindings('keyboard', added.profile, 'up').up, ['ArrowUp', 'KeyW'],
    'per-action reset did not restore defaults');
  eq(B.sameBindings(B.resetBindings('keyboard', added.profile), B.defaultProfile('keyboard')), true,
    'whole-profile reset did not restore defaults');
  eq(B.sameBindings(added.profile, B.defaultProfile('keyboard')), false,
    'sameBindings cannot tell a modified profile from the defaults');
  // The cap is enforced on the way in as well as on load.
  let full = B.defaultProfile('keyboard');
  for (const c of ['KeyM', 'KeyN', 'KeyO', 'KeyP', 'KeyT', 'KeyU', 'KeyV']) {
    full = B.bindCode('keyboard', full, 'up', c).profile;
  }
  eq(full.up.length, B.MAX_CODES_PER_ACTION, 'bindCode blew past the per-action cap');
}

// ── 8. PERSISTENCE: VERSIONED, AND CORRUPTION FALLS BACK ───────────────────
{
  const round = B.loadBindings(B.serializeBindings(B.defaultBindings()));
  for (const m of B.METHODS) {
    eq(B.sameBindings(round[m], B.defaultProfile(m)), true, `round trip lost the ${m} profile`);
  }
  eq(round.repaired, false, 'a clean round trip reported a repair');

  // A half-written entry: one good action, one garbled, one missing.
  const partial = B.serializeBindings(B.defaultBindings());
  partial.keyboard.up = ['KeyI'];
  partial.keyboard.down = [' bad', 42, { x: 1 }];
  delete partial.keyboard.left;
  const loaded = B.loadBindings(partial);
  same(loaded.keyboard.up, ['KeyI'], 'a valid stored binding was discarded');
  same(loaded.keyboard.down, ['ArrowDown', 'KeyS'], 'a garbled list did not fall back to defaults');
  same(loaded.keyboard.left, ['ArrowLeft', 'KeyA'], 'a missing action did not fall back to defaults');
  eq(loaded.repaired, true, 'the repair went unreported');
  // The OTHER profiles in the same blob are untouched by one bad one.
  eq(B.sameBindings(loaded.gamepad, B.defaultProfile('gamepad')), true,
    'a corrupt keyboard profile damaged the pad profile');

  // A wrong version is ignored WHOLESALE — a profile right about nine actions
  // and silently wrong about the tenth is the half-bound state to avoid.
  const future = B.serializeBindings(B.defaultBindings());
  future.v = B.BINDINGS_VERSION + 1;
  future.keyboard.confirm = ['KeyM'];
  same(B.loadBindings(future).keyboard.confirm, ['KeyZ', 'Enter'],
    'a future version was partially trusted');

  // Hostile input never throws and never yields a half-bound profile.
  for (const junk of [null, undefined, 0, 'x', [], { v: 1, keyboard: 'no' }, { v: 1, keyboard: [] },
    { v: 1, keyboard: { confirm: [] } }]) {
    const out = B.loadBindings(junk);
    assertions += 1;
    check(B.METHODS.every((m) => out[m] && B.REQUIRED_ACTIONS.every((a) => out[m][a].length > 0)),
      `junk entry ${JSON.stringify(junk)} produced a profile with an unbound required action`);
  }
  // The reserved code is put back if a stored entry dropped it.
  const noEsc = B.serializeBindings(B.defaultBindings());
  noEsc.keyboard.cancel = ['KeyX'];
  noEsc.keyboard.exit = [];
  const fixed = B.loadBindings(noEsc);
  eq(fixed.keyboard.cancel.includes('Escape'), true, 'the escape hatch was not restored to cancel');
  eq(fixed.keyboard.exit.includes('Escape'), true, 'the escape hatch was not restored to exit');
  eq(fixed.repaired, true, 'restoring the escape hatch went unreported');
  // Caps and dedupe on load.
  const many = B.serializeBindings(B.defaultBindings());
  many.keyboard.up = ['KeyA', 'KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyH'];
  const capped = B.loadBindings(many).keyboard.up;
  eq(capped.length, B.MAX_CODES_PER_ACTION, 'the per-action cap did not hold on load');
  eq(new Set(capped).size, capped.length, 'a duplicate survived the load');
  // Code syntax, per method.
  eq(B.isValidCode('gamepad', 'b3'), true, 'b3 rejected');
  eq(B.isValidCode('gamepad', 'a1-'), true, 'a1- rejected');
  eq(B.isValidCode('gamepad', 'KeyZ'), false, 'a key code accepted as a pad code');
  eq(B.isValidCode('gamepad', 'b99'), false, 'a nonexistent pad button accepted');
  eq(B.isValidCode('touch', 'btnZ'), true, 'btnZ rejected');
  eq(B.isValidCode('touch', 'btnQ'), false, 'an unknown slot accepted');
  eq(B.isValidCode('keyboard', 'Key;'), false, 'a malformed key code accepted');
  eq(B.isValidCode('keyboard', 'A'.repeat(64)), false, 'an overlong code accepted');
}

// ── 9. A REBOUND PROFILE ACTUALLY TAKES EFFECT ─────────────────────────────
// "A green suite does not mean a change took effect" (CLAUDE.md). Drive the
// binder with a modified profile and watch the behaviour move.
{
  const target = stubTarget();
  const custom = B.bindCode('keyboard', B.defaultProfile('keyboard'), 'confirm', 'KeyJ').profile;
  const kb = bindKeyboard(target, { profile: custom });
  target.fire('keydown', { code: 'KeyJ' });
  eq(kb.read().confirm, true, 'a rebound key did not confirm');
  target.fire('keyup', { code: 'KeyJ' });
  kb.read();
  // ...and swapping back at runtime unbinds it again, with no listener churn.
  kb.setProfile(B.defaultProfile('keyboard'));
  target.fire('keydown', { code: 'KeyJ' });
  same(on(kb.read()), [], 'setProfile did not drop the old binding');
  target.fire('keydown', { code: 'KeyZ' });
  eq(kb.read().confirm, true, 'setProfile lost the default bindings');
  kb.dispose();

  // Same on the pad, where a rebind must move the ACTION and not the button.
  const pad = stubPad();
  PADS = [pad];
  const pProf = B.bindCode('gamepad',
    B.bindCode('gamepad', B.defaultProfile('gamepad'), 'confirm', 'b3',
      { exclusive: true }).profile, 'button3', 'b0', { exclusive: true }).profile;
  const gp = bindGamepad({ profile: pProf });
  pad.buttons[3].pressed = true;
  eq(gp.read().confirm, true, 'a rebound pad button did not confirm');
  pad.buttons[3].pressed = false;
  pad.buttons[0].pressed = true;
  const swapped = gp.read();
  eq(swapped.button3, true, 'the swapped pad button did not take its new action');
  eq(swapped.confirm, false, 'the swapped pad button kept its old action');
  PADS = [];

  // Switching METHOD leaves the other profiles untouched (non-destructive).
  const all = B.defaultBindings();
  all.keyboard = B.bindCode('keyboard', all.keyboard, 'up', 'KeyI').profile;
  const method = createInputMethod();
  method.note('gamepad');
  method.note('touch');
  method.note('keyboard');
  eq(all.keyboard.up.includes('KeyI'), true, 'switching method disturbed the edited profile');
  eq(B.sameBindings(all.gamepad, B.defaultProfile('gamepad')), true, 'the pad profile drifted');
  eq(B.sameBindings(all.touch, B.defaultProfile('touch')), true, 'the touch profile drifted');
}

// ── 10. THE INERT DETECTOR IS SAFE TO PASS ANYWHERE ────────────────────────
{
  eq(NO_METHOD.note('gamepad'), false, 'NO_METHOD claimed a change');
  eq(NO_METHOD.active, 'keyboard', 'NO_METHOD has no active method');
  const target = stubTarget();
  const kb = bindKeyboard(target, { method: NO_METHOD });
  target.fire('keydown', { code: 'KeyZ' });
  eq(kb.read().confirm, true, 'a binder with the inert detector stopped working');
  kb.dispose();
}

// POSITIVE EXECUTION ASSERTION: the suite itself must have done work. A
// refactor that turned every helper into a no-op would otherwise read green.
assertions += 1;
check(assertions >= 120, `only ${assertions} assertions ran — the suite went hollow`);

console.log('action set · keyboard defaults · pad defaults · touch slots · '
  + 'detection · capture + escape hatch · conflicts · persistence · live rebind');
console.log('');
if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log(`\n${failures.length} FAILING (${assertions} assertions ran)`);
  process.exit(1);
}
console.log(`PASS  rebindable controls, three profiles (${assertions} assertions; no oracle — `
  + 'the v1.0.51 build is the regression truth)');
