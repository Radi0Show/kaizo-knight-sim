// Gamepad binder — the second DOM-aware file in input/.
//
// The Gamepad API is POLL-ONLY: there are no button events, so unlike the
// keyboard binder there is nothing to latch — read() samples the live pads
// once per simulated frame and produces the same plain input object. A tap
// shorter than one 30Hz frame can vanish; controllers do not produce
// sub-33ms taps in practice, so no event shim is carried for it.
//
// REBINDABLE SINCE v1.0.52. The mapping below is no longer hardcoded here; it
// is `DEFAULT_BINDINGS.gamepad` in input/bindings.js and this file runs
// whatever profile it is handed. Defaults reproduce DELTARUNE's own
// controller defaults on the standard layout
// (https://w3c.github.io/gamepad/#remapping), exactly as before:
//
//   d-pad 12-15 / left stick     move
//   button 0 (A / cross)         CONFIRM             (keyboard Z)
//   button 1 (B / circle)        CANCEL + SLOW       (keyboard X — one
//                                button, two jobs; see input/keyboard.js)
//   buttons 2/3 (X/Y, square/triangle)  button 3     (keyboard C)
//   shoulders 4/5                SLOW only           (the Shift alias)
//   button 9 (start)             exit   — a DRIVER key, not sim input: leaves
//                                the run for the title (keyboard Escape)
//   button 8 (select/back)       reset  — likewise (keyboard R)
//
// THE CODE VOCABULARY: `bN` is button N pressed; `aN+` / `aN-` is axis N past
// the deadzone in the positive / negative direction. That is the whole
// alphabet a gamepad profile may contain (input/bindings.js validates it).
//
// The stick threshold is 0.5: menus and dodging both want a digital read,
// and a low threshold turns stick drift into a cursor that walks by itself.
// It is also why the rebind capture cannot be fooled by drift — a capture
// only accepts a code that was INACTIVE when the capture armed and active
// afterwards, so a leaning stick or a held button binds nothing.

import { createInput } from './state.js';
import {
  DEFAULT_BINDINGS, SIM_ACTIONS, DRIVER_ACTIONS, bindingIndex,
} from './bindings.js';
import { NO_METHOD } from './method.js';

const DEADZONE = 0.5;
const SIM = new Set(SIM_ACTIONS);

function livePads() {
  const list = (typeof navigator !== 'undefined' && navigator.getGamepads)
    ? navigator.getGamepads()
    : [];
  const out = [];
  for (const p of list) if (p && p.connected) out.push(p);
  return out;
}

/** Is `code` active on this pad right now? The whole vocabulary, one place. */
function codeActive(pad, code) {
  if (code.charCodeAt(0) === 98 /* b */) {
    return !!pad.buttons?.[Number(code.slice(1))]?.pressed;
  }
  const dir = code[code.length - 1];
  const v = pad.axes?.[Number(code.slice(1, -1))] ?? 0;
  return dir === '+' ? v > DEADZONE : v < -DEADZONE;
}

/** Every code a pad can currently produce. Capture scans this, nothing else
 *  does — read() walks the profile's codes, which is far shorter. */
function activeCodes(pad) {
  const out = [];
  const nb = pad.buttons?.length ?? 0;
  for (let i = 0; i < nb && i < 32; i++) if (pad.buttons[i]?.pressed) out.push(`b${i}`);
  const na = pad.axes?.length ?? 0;
  for (let i = 0; i < na && i < 16; i++) {
    const v = pad.axes[i] ?? 0;
    if (v > DEADZONE) out.push(`a${i}+`);
    else if (v < -DEADZONE) out.push(`a${i}-`);
  }
  return out;
}

/**
 * @param {object} [opts]
 * @param {object} [opts.profile] a gamepad profile from input/bindings.js.
 * @param {object} [opts.method] an input-method detector (input/method.js).
 */
export function bindGamepad({ profile = null, method = NO_METHOD } = {}) {
  let index = bindingIndex(profile ?? DEFAULT_BINDINGS.gamepad);
  // Edge state for the driver buttons (start/select toggle things; a held
  // button must fire once, exactly like the keydown handlers they mirror).
  const driverWas = {};
  for (const a of DRIVER_ACTIONS) driverWas[a] = false;
  /** `{ onCode, baseline: Set }` while a rebind capture is armed. */
  let capture = null;
  // DETECTION IS ON EDGES, NOT ON HELD STATE (input/method.js, "EDGES ONLY").
  // A poll-only device has no events to ride, so the rising edge is
  // reconstructed here: the method switches when a bound code goes from
  // inactive to active, never while one is merely still down. Without this a
  // leaned-on stick would pin the method to `gamepad` forever and the player
  // could not reach for the keyboard without first letting go of the pad.
  let wasActive = new Set();

  /** Poll the capture. Called from read() so an armed capture resolves on the
   *  driver's own cadence, and exposed for a UI that is not running a loop. */
  function pollCapture() {
    if (!capture) return false;
    for (const p of livePads()) {
      for (const code of activeCodes(p)) {
        if (capture.baseline.has(code)) continue;
        const cb = capture.onCode;
        capture = null;
        method.note('gamepad');
        cb(code);
        return true;
      }
    }
    return false;
  }

  return {
    /** Snapshot for one simulated frame — same shape as the keyboard's. */
    read() {
      // A capture swallows the frame: the button being bound must not also
      // press the row behind the prompt.
      if (capture) { pollCapture(); return createInput(); }
      const over = {};
      const nowActive = new Set();
      for (const p of livePads()) {
        for (const [code, actions] of index) {
          if (!codeActive(p, code)) continue;
          nowActive.add(code);
          for (const a of actions) if (SIM.has(a)) over[a] = true;
        }
      }
      for (const code of nowActive) {
        if (!wasActive.has(code)) { method.note('gamepad'); break; }
      }
      wasActive = nowActive;
      return createInput(over);
    },

    /**
     * Rising edges for the driver actions (start -> exit, select -> reset by
     * default).
     *
     * `exit` was `pause` — computed every frame and read by nothing since the
     * debug pause went. Start now does what Escape does: leave the run.
     * Edge-gated, so a held Start exits once, exactly like the `!e.repeat`
     * guard on the keyboard handler it mirrors.
     */
    driverEdges() {
      const now = {};
      for (const a of DRIVER_ACTIONS) now[a] = false;
      if (!capture) {
        for (const p of livePads()) {
          for (const [code, actions] of index) {
            if (!codeActive(p, code)) continue;
            for (const a of actions) if (!SIM.has(a)) now[a] = true;
          }
        }
      }
      const edges = {};
      for (const a of DRIVER_ACTIONS) {
        edges[a] = now[a] && !driverWas[a];
        driverWas[a] = now[a];
      }
      return edges;
    },

    /** Swap the live profile. */
    setProfile(next) {
      index = bindingIndex(next ?? DEFAULT_BINDINGS.gamepad);
      for (const a of DRIVER_ACTIONS) driverWas[a] = false;
      wasActive = new Set();
    },

    /**
     * REBIND CAPTURE. Baselines everything already held, then reports the
     * first code that goes from inactive to active. `cancel()` aborts with
     * `null`; there is no reserved code on a pad, so the abort is the UI's
     * own back button (which a pad reaches through the keyboard's Escape or
     * the on-screen one).
     */
    captureNext(onCode) {
      if (capture) capture.onCode(null);
      const baseline = new Set();
      for (const p of livePads()) for (const c of activeCodes(p)) baseline.add(c);
      capture = { onCode, baseline };
      const mine = capture;
      return () => { if (capture === mine) { capture = null; mine.onCode(null); } };
    },

    pollCapture,
    capturing() { return capture !== null; },

    connected() {
      return livePads().length > 0;
    },

    dispose() {},
  };
}
