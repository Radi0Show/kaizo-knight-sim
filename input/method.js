// WHICH DEVICE IS THE PLAYER ACTUALLY USING — last-used wins.
//
// REQUESTED FEATURE (see input/bindings.js's header for the labelling rule).
// The Controls page needs to know which of the three profiles to show, and the
// honest answer is not a capability sniff: a laptop with a touchscreen and a
// pad plugged in HAS all three, and `navigator.maxTouchPoints > 0` is true on
// a desktop that has never been touched. So detection is behavioural — the
// last device that produced an input owns the page — and the three binders
// report into this one object.
//
// EDGES ONLY, never held state. A held stick or a leaned-on key would
// otherwise pin the method forever and make switching impossible: you could
// not reach for the keyboard without first letting go of the pad. The keyboard
// reports on keydown, touch on pointerdown, and the gamepad binder on a button
// or axis CROSSING into pressed — each of which is a fresh act by a person.
//
// Switching is non-destructive by construction: this object holds no bindings
// at all, only a name. Changing method shows a different profile; it never
// writes to one.

import { METHODS } from './bindings.js';

/**
 * @param {object} [opts]
 * @param {'keyboard'|'gamepad'|'touch'} [opts.initial] what to report before
 *   anything has been pressed. Keyboard is the right cold default even on a
 *   phone: the touch overlay's first tap re-points it within one frame, and a
 *   desktop that never touches anything stays correct forever.
 * @param {(m: string, prev: string) => void} [opts.onChange] fired only on a
 *   real change, so a caller can persist or repaint without polling.
 * @param {() => number} [opts.now] injectable clock (the suite drives it).
 */
export function createInputMethod({ initial = 'keyboard', onChange = null, now = null } = {}) {
  const clock = now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  let active = METHODS.includes(initial) ? initial : 'keyboard';
  let since = clock();
  let changes = 0;
  /** Per-method "has this device ever produced input", for a UI that wants to
   *  grey out a profile nothing has ever used. Observation, not capability. */
  const seen = { keyboard: false, gamepad: false, touch: false };

  return {
    /** The live answer. A plain getter so a renderer can read it every frame. */
    get active() { return active; },
    /** Clock value of the last change — lets the UI flash the switch. */
    get since() { return since; },
    /** How many times the method has changed this session (positive
     *  assertion: a suite can prove detection RAN, not just that it agreed). */
    get changes() { return changes; },
    /** Has this device produced input at least once? */
    hasUsed(method) { return !!seen[method]; },

    /**
     * Report an input edge from `method`. Returns true when the active method
     * actually changed. Cheap enough to call from every keydown.
     */
    note(method) {
      if (!METHODS.includes(method)) return false;
      seen[method] = true;
      if (method === active) return false;
      const prev = active;
      active = method;
      since = clock();
      changes += 1;
      onChange?.(active, prev);
      return true;
    },

    /** A snapshot for rendering or for a trace column. */
    snapshot() {
      return { active, since, changes, seen: { ...seen } };
    },
  };
}

/**
 * The inert one. Handed to a binder that has no detector (the headless
 * suites, and any caller that predates this file) so every `note()` call site
 * can be unconditional.
 */
export const NO_METHOD = Object.freeze({
  active: 'keyboard',
  since: 0,
  changes: 0,
  hasUsed: () => false,
  note: () => false,
  snapshot: () => ({ active: 'keyboard', since: 0, changes: 0, seen: {} }),
});
