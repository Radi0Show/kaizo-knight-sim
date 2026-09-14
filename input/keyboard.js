// Browser key binder. The only DOM-aware file outside render/.
//
// Produces the same plain input-state object the headless runner feeds the
// sim, so sim/ cannot tell the difference between a keyboard and a table.
//
// Sampling: keys are latched on keydown and cleared on keyup, and the driver
// reads a SNAPSHOT once per simulated frame. A key pressed and released
// between two frames still registers for one frame — without the latch, fast
// taps would vanish at 30 Hz.
//
// REBINDABLE SINCE v1.0.52. The frozen KEYMAP that used to live here is now
// `DEFAULT_BINDINGS.keyboard` in input/bindings.js, and this file runs
// whatever profile it is handed — defaulting to that same table, so a build
// with no stored settings behaves exactly as it always did. The mapping the
// defaults reproduce, unchanged:
//
// X IS ONE BUTTON WITH TWO JOBS, and that is the game's design, not a clash:
//
//     obj_heart's Step      `if (button2_h() ...)`   the SLOW modifier
//     obj_battlecontroller  `if (button2_p() ...)`   CANCEL
//
// Same physical key — button 2 — read HELD while dodging and as an EDGE in the
// menu. They never collide because the menu is closed during the bullet phase
// and the soul is frozen while it is open.
//
// Shift is not a DELTARUNE binding; it is a convenience alias for the slow
// modifier only, so it cannot cancel a menu by accident. Escape is not a
// DELTARUNE binding either, kept because a keyboard without X is a real thing
// and being unable to back out of a menu is worse than an extra key.
//
// INSIDE A RUN THE DRIVER TAKES ESCAPE FIRST. web/main.js binds a raw
// keydown for Escape that EXITS the run to the title (there was no way to
// leave ENDLESS, HITLESS or SINGLE short of reloading the page). This
// binder still latches `cancel` on that same keydown — it registers before
// the driver's listener — but the exit's reset() calls maskHeldInput(),
// which drains the latch and masks the still-held key, so the title never
// sees the press as a cancel. On the title itself the exit is a no-op and
// Escape backs out of settings pages exactly as before. Measured: with the
// binder registered first the title sees cancel on 0 of the following
// frames; with the order flipped it would see 3 (repro-C4-review).
//
// THE DRIVER ACTIONS (`reset`, `exit`) ARE BOUND HERE BUT NOT LATCHED. They
// never reach `createInput` — the object the sim is handed must keep exactly
// the shape input/state.js produces, because the byte gate replays recorded
// fights through that object and a stray field is a silent divergence. They
// surface through `driverEdges()` instead, for a driver that wants them
// rebindable; web/main.js still owns its own hardcoded KeyR/Escape handlers,
// so nothing double-fires until that file opts in.
//
// One visible consequence of binding them at all: a keydown whose code
// appears anywhere in the profile is preventDefault()ed, which now includes
// KeyR. preventDefault does not stop propagation, so the driver's own KeyR
// listener still runs.

import { createInput } from './state.js';
import {
  DEFAULT_BINDINGS, SIM_ACTIONS, DRIVER_ACTIONS, bindingIndex, isReserved,
} from './bindings.js';
import { NO_METHOD } from './method.js';

const SIM = new Set(SIM_ACTIONS);

/**
 * @param {EventTarget} [target] where to listen (window in the page, a stub
 *   in the suites).
 * @param {object} [opts]
 * @param {object} [opts.profile] a keyboard profile from input/bindings.js.
 *   Omitted, the shipped defaults are used.
 * @param {object} [opts.method] an input-method detector (input/method.js).
 */
export function bindKeyboard(target = window, { profile = null, method = NO_METHOD } = {}) {
  let index = bindingIndex(profile ?? DEFAULT_BINDINGS.keyboard);
  const held = new Set();
  const pressedSinceRead = new Set();
  /** Driver edges accumulated since the last `driverEdges()` drain. */
  const driverPressed = new Set();
  /** `{ onCode }` while a rebind capture is armed; null otherwise. */
  let capture = null;

  const onDown = (ev) => {
    // CAPTURE COMES FIRST and swallows the key. Binding Z must not also
    // confirm the menu row underneath the capture prompt.
    if (capture) {
      ev.preventDefault();
      if (ev.repeat) return;
      method.note('keyboard');
      const cb = capture;
      capture = null;
      // THE ESCAPE HATCH. A reserved code aborts the capture instead of
      // being bound to something else — Escape is the one input guaranteed
      // to exist and the one the page uses to get out of anything, so a UI
      // that let you bind it away could strand a player on a live page.
      cb.onCode(isReserved('keyboard', ev.code) ? null : ev.code);
      return;
    }
    const actions = index.get(ev.code);
    if (!actions) return;
    ev.preventDefault();
    method.note('keyboard');
    for (const a of actions) {
      if (SIM.has(a)) {
        held.add(a);
        pressedSinceRead.add(a);
      } else if (!ev.repeat) {
        driverPressed.add(a);
      }
    }
  };
  const onUp = (ev) => {
    const actions = index.get(ev.code);
    if (!actions) return;
    ev.preventDefault();
    for (const a of actions) if (SIM.has(a)) held.delete(a);
  };
  const onBlur = () => {
    held.clear();
  };

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);

  return {
    /** Snapshot for one simulated frame. Clears the tap latch. */
    read() {
      const over = {};
      for (const a of held) over[a] = true;
      for (const a of pressedSinceRead) over[a] = true;
      pressedSinceRead.clear();
      return createInput(over);
    },

    /**
     * Rising edges for the driver keys, drained on read. Mirrors the gamepad
     * binder's method of the same name so a driver can treat the two alike.
     */
    driverEdges() {
      const edges = {};
      for (const a of DRIVER_ACTIONS) edges[a] = driverPressed.has(a);
      driverPressed.clear();
      return edges;
    },

    /** Swap the live profile. Cheap: one index rebuild, no listener churn. */
    setProfile(next) {
      index = bindingIndex(next ?? DEFAULT_BINDINGS.keyboard);
      held.clear();
      pressedSinceRead.clear();
      driverPressed.clear();
    },

    /**
     * REBIND CAPTURE. `onCode` is called once with the next key's code — or
     * with `null` when the player pressed a reserved key, which aborts.
     * Returns a canceller; arming twice cancels the first.
     */
    captureNext(onCode) {
      if (capture) capture.onCode(null);
      capture = { onCode };
      const mine = capture;
      return () => { if (capture === mine) { capture = null; mine.onCode(null); } };
    },

    /** Is a capture armed? The UI's "press any key" state, observable. */
    capturing() { return capture !== null; },

    dispose() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
