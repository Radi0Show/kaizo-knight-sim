// Touch binder — the on-screen d-pad and buttons for phones and tablets.
//
// Produces the same plain input-state object as the keyboard binder, latched
// the same way: a tap between two 30Hz reads still registers for one frame,
// and held contact reads as held. sim/ cannot tell a thumb from a keyboard,
// which is the whole point — nothing below web/ knows touch exists.
//
// POINTER EVENTS, NOT TOUCH EVENTS, and per-pointer bookkeeping throughout:
// dodging needs one thumb on the pad and one on the buttons at the same
// moment, so every handler keys off `pointerId`. `setPointerCapture` keeps a
// drag that wanders off a button from orphaning its release.
//
// THE D-PAD IS EIGHT-WAY with a centre dead zone. Diagonals are not a nicety:
// the soul's axes are set independently (no normalisation — CLAUDE.md,
// "Diagonals normalized? No."), so a pad that cannot express down-left robs
// the player of the fastest movement the game has.
//
// X IS ONE BUTTON WITH TWO JOBS here exactly as on the keyboard: held it is
// the SLOW modifier, tapped it is CANCEL. Same mapping (['focus','cancel']),
// same reason it cannot collide — the menu is closed during the bullet phase.
//
// R HAS TWO JOBS TOO, split by DURATION rather than by phase: a TAP restarts
// the run (`onReset`), a HOLD of HOLD_MS leaves it for the title (`onExit`).
// The keyboard has Escape and a pad has Start for the exit; the overlay has
// only Z, X and R, and a fourth button on a phone's bottom band is a thumb
// in the way of the arena. The cost is that the restart fires on RELEASE
// rather than on touch — a tap has to prove it was not a hold — so an
// on-screen restart is one tap-length later than the key's. The timer is
// PER POINTER like everything else here, and a pointercancel (the browser
// taking the finger for a scroll or a gesture) clears it without firing
// either job: a stray restart is exactly what the hold exists to prevent.

// REBINDABLE SINCE v1.0.52, with one honest limitation. A touch profile
// (input/bindings.js, `DEFAULT_BINDINGS.touch`) assigns actions to SLOTS —
// `pad`, `btnZ`, `btnX`, `btnR` — because that is what a finger can actually
// choose between on an overlay with four targets. Pass `profile` plus `slots`
// and the button wiring below is derived from it; pass `buttons` directly and
// it is used verbatim, which is what web/main.js and the suites do today.
//
// THE PAD'S DIRECTIONS ARE GEOMETRIC, NOT REBINDABLE. Its eight sectors emit
// left/right/up/down by angle; the `pad` code stands for all four at once.
// Any non-direction action a profile puts on `pad` is ignored rather than
// silently half-wired — a slot that reports "confirm" from a sector has no
// sensible meaning, and pretending otherwise is the half-bound state the
// binding model exists to prevent.

import { createInput } from './state.js';
import { ACTIONS, SIM_ACTIONS, DEFAULT_BINDINGS } from './bindings.js';
import { NO_METHOD } from './method.js';

const SIM = new Set(SIM_ACTIONS);
const DIRECTIONS = new Set(['left', 'right', 'up', 'down']);

/**
 * Invert a touch profile into the `buttons` list this binder runs.
 * `slots` maps a slot id to its element; a slot with no element is skipped.
 */
export function buttonsFromProfile(profile, slots = {}) {
  const prof = profile ?? DEFAULT_BINDINGS.touch;
  const out = [];
  for (const [code, el] of Object.entries(slots)) {
    if (code === 'pad' || !el) continue;
    const actions = [];
    for (const a of ACTIONS) {
      if (!(prof[a] ?? []).includes(code)) continue;
      if (DIRECTIONS.has(a)) continue; // see "THE PAD'S DIRECTIONS", above.
      actions.push(a);
    }
    if (actions.length) out.push({ el, actions, code });
  }
  return out;
}

const DEAD_ZONE = 0.28; // fraction of the pad's radius; inside it, no input.
/** How long R is held before the tap becomes an exit. */
const HOLD_MS = 600;

export function bindTouch({
  pad, buttons = null, slots = null, profile = null,
  onReset, onExit, onAction, holdMs = HOLD_MS, method = NO_METHOD,
} = {}) {
  // `buttons` wins when both are given: an explicit list is a caller that
  // knows exactly what it wants, and the shipped page still passes one.
  const wiring = buttons ?? (slots || profile ? buttonsFromProfile(profile, { ...slots, pad: null }) : []);
  const held = new Set();
  /** `{ onCode }` while a rebind capture is armed; null otherwise. */
  let capture = null;
  const pressedSinceRead = new Set();
  /** pointerId -> Set of actions that pointer is holding. */
  const byPointer = new Map();
  /** pointerId -> the armed hold timer on a reset button. */
  const holdTimers = new Map();

  const press = (id, actions) => {
    let mine = byPointer.get(id);
    if (!mine) byPointer.set(id, (mine = new Set()));
    for (const a of actions) {
      if (!mine.has(a)) {
        mine.add(a);
        pressedSinceRead.add(a);
      }
      held.add(a);
    }
  };
  const release = (id, keep = null) => {
    const mine = byPointer.get(id);
    if (!mine) return;
    for (const a of mine) {
      if (keep && keep.has(a)) continue;
      mine.delete(a);
      // Another pointer may still hold the same action.
      let stillHeld = false;
      for (const [, set] of byPointer) if (set.has(a)) stillHeld = true;
      if (!stillHeld) held.delete(a);
    }
    if (!keep) byPointer.delete(id);
  };

  // ---- the d-pad ----------------------------------------------------------
  const padDirs = (ev) => {
    const r = pad.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    const radius = Math.min(r.width, r.height) / 2;
    if (Math.hypot(dx, dy) < radius * DEAD_ZONE) return [];
    // Eight 45-degree sectors; each cardinal owns 45 degrees and shares 45
    // with each neighbouring diagonal. SCREEN Y POINTS DOWN, so positive
    // angles are the DOWN half: 0 right, +90 down, -90 up, both ends of the
    // range (sector -4 and +4) are left.
    const a = Math.atan2(dy, dx);
    const sector = Math.round(a / (Math.PI / 4)); // -4..4
    return [
      ['left'], ['left', 'up'], ['up'], ['up', 'right'],
      ['right'], ['right', 'down'], ['down'], ['down', 'left'],
      ['left'],
    ][sector + 4];
  };
  const onPadMove = (ev) => {
    ev.preventDefault();
    const dirs = new Set(padDirs(ev));
    release(ev.pointerId, dirs);
    press(ev.pointerId, dirs);
  };
  // setPointerCapture THROWS (InvalidPointerId) when the pointer is already
  // gone — a finger lifted in the same tick, or a synthetic event. The
  // capture is a nicety (it keeps a drag that wanders off the element from
  // orphaning its release); losing it must never cost the press itself.
  const grab = (el, id) => { try { el.setPointerCapture(id); } catch { /* gone */ } };
  const onPadDown = (ev) => {
    method.note('touch');
    if (capture) { ev.preventDefault(); const cb = capture; capture = null; cb.onCode('pad'); return; }
    grab(pad, ev.pointerId);
    onPadMove(ev);
  };
  const onPadUp = (ev) => {
    ev.preventDefault();
    release(ev.pointerId);
  };
  if (pad) {
    pad.addEventListener('pointerdown', onPadDown);
    pad.addEventListener('pointermove', onPadMove);
    pad.addEventListener('pointerup', onPadUp);
    pad.addEventListener('pointercancel', onPadUp);
  }

  // ---- the buttons --------------------------------------------------------
  // MUTABLE ENTRIES so `setProfile` can rewire without tearing down the
  // listeners (and without orphaning a pointer that is mid-press). Each
  // handler reads `entry.actions` at event time, never a closed-over copy.
  const entries = wiring.filter((b) => b.el).map((b) => ({ el: b.el, actions: [...b.actions], code: b.code ?? null }));
  for (const entry of entries) {
    const { el, code } = entry;
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      method.note('touch');
      // CAPTURE COMES FIRST and swallows the tap, exactly as on the keyboard:
      // assigning a slot must not also press the row behind the prompt.
      if (capture) { const cb = capture; capture = null; cb.onCode(code); return; }
      grab(el, ev.pointerId);
      el.classList.add('down');
      const actions = entry.actions;
      if (actions.includes('reset')) {
        // Arm the hold. The timer fires the EXIT and forgets the pointer, so
        // the release that follows finds nothing and restarts nothing; a
        // release BEFORE it fires is the tap, and that is the restart. It
        // used to call onReset() right here, synchronously — see the header
        // for why that moved to the release.
        const id = ev.pointerId;
        const timer = setTimeout(() => {
          holdTimers.delete(id);
          onExit?.();
        }, holdMs);
        holdTimers.set(id, timer);
        return;
      }
      press(ev.pointerId, actions);
      // SYNCHRONOUS, inside the gesture's own call stack, and that is the
      // whole point. Anything that needs the browser's user-activation —
      // window.open above all; iOS Safari refuses a popup whose open() call
      // is not in the handler stack, however fresh the tap — cannot wait for
      // the 30Hz loop to read the latch. The driver decides what (if
      // anything) the action means right now; the sim still sees the same
      // latched input next frame.
      for (const a of actions) onAction?.(a);
    });
    const up = (ev) => {
      ev.preventDefault();
      el.classList.remove('down');
      release(ev.pointerId);
      // The R button: a still-armed timer means the hold never fired. Only a
      // real release (pointerup) counts as the tap; a pointercancel just
      // disarms.
      const timer = holdTimers.get(ev.pointerId);
      if (timer !== undefined) {
        clearTimeout(timer);
        holdTimers.delete(ev.pointerId);
        if (ev.type === 'pointerup') onReset?.();
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  return {
    /**
     * Snapshot for one simulated frame. Clears the tap latch.
     *
     * DRIVER ACTIONS ARE FILTERED OUT here as on the keyboard: the object the
     * sim is handed must keep exactly the shape input/state.js produces. In
     * practice `reset`/`exit` never reach the latch anyway (the R button
     * returns before press(), splitting the two by duration), but a profile
     * that puts one on another slot must not be able to widen the object.
     */
    read() {
      const over = {};
      for (const a of held) if (SIM.has(a)) over[a] = true;
      for (const a of pressedSinceRead) if (SIM.has(a)) over[a] = true;
      pressedSinceRead.clear();
      return createInput(over);
    },

    /**
     * Rewire the slots from a new touch profile. Held state is dropped: a
     * finger down on a button that just changed meaning is ambiguous, and a
     * stuck action is worse than a missed one.
     *
     * AN ENTRY WITH NO SLOT ID IS LEFT ALONE. The legacy `buttons` API carries
     * no `code`, so a profile has nothing to say about it; clearing those
     * would silently unwire the shipped page's overlay the first time anyone
     * called this on it.
     */
    setProfile(next) {
      const withCode = entries.filter((e) => e.code !== null);
      const wanted = buttonsFromProfile(next, Object.fromEntries(withCode.map((e) => [e.code, e.el])));
      const byCode = new Map(wanted.map((w) => [w.code, w.actions]));
      for (const e of withCode) e.actions = byCode.get(e.code) ?? [];
      held.clear();
      pressedSinceRead.clear();
      byPointer.clear();
    },

    /**
     * REBIND CAPTURE. Reports the SLOT the next touch lands on — `pad`,
     * `btnZ`, `btnX`, `btnR` — because a slot is what a touch profile binds.
     * The tap is swallowed. Reports `null` when cancelled.
     */
    captureNext(onCode) {
      if (capture) capture.onCode(null);
      capture = { onCode };
      const mine = capture;
      return () => { if (capture === mine) { capture = null; mine.onCode(null); } };
    },

    capturing() { return capture !== null; },

    /** The slots this binder actually has elements for. */
    slots() { return entries.map((e) => e.code).filter((c) => c !== null); },
  };
}
