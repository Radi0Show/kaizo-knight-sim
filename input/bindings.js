// THE BINDING MODEL — one profile per input method, every action rebindable.
//
// REQUESTED FEATURE, not a translation. Nothing in DELTARUNE's GML corresponds
// to this file; it is the data model behind the Controls settings page the user
// asked for ("add way to edit control setting for every control input, where it
// detects your input method, keyboard, controller, mobile, and allows you to
// edit your controling setting specifically"). Per CLAUDE.md law 4 the label
// lives HERE, in a comment the vendor step strips, and never in on-screen copy.
//
// ── WHAT AN ACTION IS ─────────────────────────────────────────────────────
//
// The canonical list is read off the code, not invented. `sim/` is handed one
// plain object per frame (input/state.js `createInput`), and the fields it
// actually reads are:
//
//     left right up down focus confirm cancel          createInput's own keys
//     button3                                          sim/menu.js MENU_KEYS,
//                                                      sim/replay.js bit 128,
//                                                      sim/spellphase.js automash
//
// plus two that are NOT sim input and never reach `createInput` — the DRIVER
// keys, today hardcoded in web/main.js (KeyR / Escape) and in the gamepad
// binder's `driverEdges` (select / start):
//
//     reset exit
//
// `reset`/`exit` are rebindable here and reported through `driverEdges()`, but
// they are filtered out of `read()`: the object the sim sees must keep exactly
// the shape `createInput` produces, because the byte gate replays recorded
// fights through that same object and a stray field is a silent divergence
// waiting to happen.
//
// ── WHY CODES MAP MANY-TO-MANY ────────────────────────────────────────────
//
// One code may drive several actions and one action may have several codes.
// That is not a permissive choice, it is the CURRENT BEHAVIOUR: KeyX is
// `['focus','cancel']` (input/keyboard.js's "X IS ONE BUTTON WITH TWO JOBS")
// and gamepad button 1 is the same pair. A model that forced one action per
// code could not express the defaults, so "conflict" here means "worth
// warning about", never "refused" — see `conflictsFor`.
//
// ── THE ESCAPE HATCH ──────────────────────────────────────────────────────
//
// A rebind UI that lets you bind away every way out of a menu is a soft-lock
// on a live page. `RESERVED` is the guard: on the keyboard, Escape is always
// cancel and always exit, it cannot be captured for another action, and
// `normalizeProfile` puts it back if a stored entry dropped it. Everything
// else is fair game. `REQUIRED_ACTIONS` is the second guard: confirm and
// cancel may not end up empty on ANY profile — an empty one is restored to
// that action's defaults rather than saved as a stranded device.

/** Bump when the stored shape changes meaning. An entry at any other version
 *  is ignored wholesale — see `loadBindings`. */
export const BINDINGS_VERSION = 1;

/** Fields that reach `sim/` through `createInput`. Order is cosmetic. */
export const SIM_ACTIONS = Object.freeze([
  'left', 'right', 'up', 'down', 'focus', 'confirm', 'cancel', 'button3',
]);

/** Driver-only actions: the page acts on them, the sim never sees them. */
export const DRIVER_ACTIONS = Object.freeze(['reset', 'exit']);

export const ACTIONS = Object.freeze([...SIM_ACTIONS, ...DRIVER_ACTIONS]);

/** Actions that may never be left unbound. See "THE ESCAPE HATCH". */
export const REQUIRED_ACTIONS = Object.freeze(['confirm', 'cancel']);

export const METHODS = Object.freeze(['keyboard', 'gamepad', 'touch']);

/** Per-action ceiling on stored codes, and per-code length ceiling. Hostile or
 *  corrupt entries are trimmed rather than trusted (sim/share.js's discipline
 *  for the same reason: a stored string is attacker-controlled input). */
export const MAX_CODES_PER_ACTION = 6;
const MAX_CODE_LENGTH = 24;

/**
 * DEFAULTS ARE TODAY'S BEHAVIOUR, TRANSCRIBED.
 *
 * Every entry below is read off the binder it replaces — input/keyboard.js's
 * KEYMAP, input/gamepad.js's read()/driverEdges(), and web/main.js's touch
 * overlay wiring — so a fresh profile reproduces the build exactly as it
 * shipped. `tools/verify-bindings.mjs` asserts that equivalence directly
 * rather than trusting this comment.
 */
export const DEFAULT_BINDINGS = Object.freeze({
  // KeyboardEvent.code strings.
  keyboard: Object.freeze({
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    // button 2 — held is the slow modifier. Shift is a convenience alias for
    // the modifier only, deliberately NOT a cancel (input/keyboard.js).
    focus: ['KeyX', 'ShiftLeft', 'ShiftRight'],
    // button 1.
    confirm: ['KeyZ', 'Enter'],
    // button 2 again, read as an edge in menus. Escape is RESERVED here.
    cancel: ['KeyX', 'Escape'],
    // button 3 — `global.flag[13] == 1`'s third attack-bar character.
    button3: ['KeyC'],
    reset: ['KeyR'],
    exit: ['Escape'],
  }),
  // `b<N>` = button N pressed. `a<N>+` / `a<N>-` = axis N past the deadzone in
  // the positive / negative direction. Standard layout
  // (https://w3c.github.io/gamepad/#remapping).
  gamepad: Object.freeze({
    left: ['b14', 'a0-'],
    right: ['b15', 'a0+'],
    up: ['b12', 'a1-'],
    down: ['b13', 'a1+'],
    focus: ['b1', 'b4', 'b5'],
    confirm: ['b0'],
    cancel: ['b1'],
    button3: ['b2', 'b3'],
    reset: ['b8'],
    exit: ['b9'],
  }),
  // Slot ids on the on-screen overlay (web/index.html). The pad is the only
  // source of direction, and `btnR` carries reset and exit both — they are
  // split by DURATION in input/touch.js (tap restarts, ~0.6 s hold leaves),
  // not by slot, because a fourth button on a phone's bottom band is a thumb
  // in the way of the arena.
  //
  // `button3` has no slot today and is stored as a deliberate empty: it is not
  // a REQUIRED action, so it stays empty until someone assigns it one.
  touch: Object.freeze({
    left: ['pad'],
    right: ['pad'],
    up: ['pad'],
    down: ['pad'],
    focus: ['btnX'],
    confirm: ['btnZ'],
    cancel: ['btnX'],
    button3: [],
    reset: ['btnR'],
    exit: ['btnR'],
  }),
});

/** The overlay's slots, and the whole code vocabulary of the touch profile. */
export const TOUCH_SLOTS = Object.freeze(['pad', 'btnZ', 'btnX', 'btnR']);

/**
 * WHAT EACH TOUCH SLOT CAN ACTUALLY PRODUCE, which is not the same question as
 * whether a code is well-formed.
 *
 * `pad` is a direction source and nothing else — input/touch.js reads a vector
 * out of it and never an edge — while the three buttons produce edges and never
 * a direction. So `confirm: ['pad']` is a PERFECTLY VALID CODE that can never
 * fire, and a profile carrying it passes every syntax check while leaving the
 * player on a phone unable to confirm anything.
 *
 * That is the shape of the soft-lock REQUIRED_ACTIONS exists to prevent, and
 * counting codes does not catch it: the array is length 1, it is simply length
 * 1 of something inert. The guard below counts codes that can PRODUCE the
 * action instead.
 */
export const TOUCH_SLOT_KIND = Object.freeze({
  pad: 'direction', btnZ: 'button', btnX: 'button', btnR: 'button',
});

/** The four actions a direction source can serve. */
const DIRECTION_ACTIONS = Object.freeze(['left', 'right', 'up', 'down']);

/**
 * Can `code` on `method` actually deliver `action`?
 *
 * Keyboard and gamepad: any well-formed code can carry any action — a key is a
 * key. Touch is the one method whose codes are typed, because its "keys" are
 * regions of an overlay with fixed jobs.
 */
export function canProduce(method, code, action) {
  if (!isValidCode(method, code)) return false;
  if (method !== 'touch') return true;
  const kind = TOUCH_SLOT_KIND[code];
  return DIRECTION_ACTIONS.includes(action) ? kind === 'direction' : kind === 'button';
}

/**
 * Codes that cannot be rebound away, per method, with the actions they are
 * pinned to. Keyboard Escape only: it is the one input that is guaranteed to
 * exist on every keyboard and the one the page uses to get out of anything.
 */
export const RESERVED = Object.freeze({
  keyboard: Object.freeze({ Escape: Object.freeze(['cancel', 'exit']) }),
  gamepad: Object.freeze({}),
  touch: Object.freeze({}),
});

/** True when `code` is pinned on `method` — a capture must refuse it. */
export function isReserved(method, code) {
  return Object.prototype.hasOwnProperty.call(RESERVED[method] ?? {}, code);
}

const KEYBOARD_CODE = /^[A-Za-z][A-Za-z0-9]{0,23}$/;
const GAMEPAD_CODE = /^(b(?:[0-9]|[12][0-9]|3[01])|a(?:[0-9]|1[0-5])[+-])$/;

/** Is `code` well-formed for `method`? Syntax only — an unplugged pad's
 *  button 30 is well-formed and simply never fires. */
export function isValidCode(method, code) {
  if (typeof code !== 'string' || code.length === 0 || code.length > MAX_CODE_LENGTH) return false;
  if (method === 'keyboard') return KEYBOARD_CODE.test(code);
  if (method === 'gamepad') return GAMEPAD_CODE.test(code);
  if (method === 'touch') return TOUCH_SLOTS.includes(code);
  return false;
}

/** A fresh, mutable copy of one method's defaults. */
export function defaultProfile(method) {
  const src = DEFAULT_BINDINGS[method];
  if (!src) throw new Error(`unknown input method: ${method}`);
  const out = {};
  for (const a of ACTIONS) out[a] = [...(src[a] ?? [])];
  return out;
}

/** A fresh, mutable copy of all three. */
export function defaultBindings() {
  const out = {};
  for (const m of METHODS) out[m] = defaultProfile(m);
  return out;
}

/**
 * Sanitize one stored profile.
 *
 * The house pattern is kaizo/ui/proceed.js's `loadProceed`: read defensively,
 * coerce, and prefer a coherent default over a half-formed object. The rules,
 * each chosen so a corrupt entry cannot produce a profile that LOOKS bound and
 * is not:
 *
 *   * not a plain object          -> the whole profile is defaults
 *   * an action key is absent     -> that action gets its defaults
 *   * an action is not an array   -> that action gets its defaults
 *   * codes are filtered to valid syntax, deduped, capped
 *   * filtering emptied a NON-empty list -> that action gets its defaults
 *     (a garbled list is damage, not a decision)
 *   * `[]` exactly                -> honoured as deliberately unbound...
 *   * ...unless the action is REQUIRED, which is restored to defaults
 *   * RESERVED codes are re-added wherever they were dropped
 *   * unknown keys are dropped
 *
 * @returns {{ bindings: object, repaired: boolean }} `repaired` is true when
 *   anything above fired — the caller may re-persist to retire the bad entry.
 */
export function normalizeProfile(method, raw) {
  if (!METHODS.includes(method)) throw new Error(`unknown input method: ${method}`);
  const def = defaultProfile(method);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { bindings: def, repaired: raw !== undefined && raw !== null };
  }
  let repaired = false;
  const out = {};
  for (const action of ACTIONS) {
    const stored = raw[action];
    if (stored === undefined || !Array.isArray(stored)) {
      out[action] = [...def[action]];
      if (stored !== undefined) repaired = true;
      continue;
    }
    const seen = new Set();
    const codes = [];
    for (const code of stored) {
      if (!isValidCode(method, code) || seen.has(code)) { repaired = true; continue; }
      if (codes.length >= MAX_CODES_PER_ACTION) { repaired = true; continue; }
      seen.add(code);
      codes.push(code);
    }
    if (codes.length === 0 && stored.length > 0) {
      // Everything in it was junk. That is corruption, not an unbinding.
      out[action] = [...def[action]];
      repaired = true;
      continue;
    }
    out[action] = codes;
  }
  // Unknown keys are simply not copied, but say so, so a caller can rewrite.
  for (const key of Object.keys(raw)) if (!ACTIONS.includes(key)) repaired = true;

  // RESERVED: put the escape hatch back wherever it went.
  for (const [code, actions] of Object.entries(RESERVED[method] ?? {})) {
    for (const action of actions) {
      if (!out[action].includes(code)) {
        out[action] = [code, ...out[action]].slice(0, MAX_CODES_PER_ACTION);
        repaired = true;
      }
    }
  }
  // REQUIRED: no profile may strand the player on this device.
  //
  // COUNTS PRODUCIBLE CODES, NOT CODES. `out[action].length === 0` was the
  // first version and it let the exact soft-lock through that this guard is
  // for: a touch profile with `confirm: ['pad']` is length 1, well-formed, and
  // completely inert, because the pad emits directions and never an edge. A
  // player reaching that state on a phone cannot confirm, cannot cancel, and
  // cannot open the menu that would let them fix it.
  for (const action of REQUIRED_ACTIONS) {
    if (!out[action].some((code) => canProduce(method, code, action))) {
      out[action] = [...def[action]];
      repaired = true;
    }
  }
  return { bindings: out, repaired };
}

/**
 * Read the whole stored blob (already JSON-parsed) into three usable profiles.
 *
 * VERSION IS ALL-OR-NOTHING. An entry written by a build that numbered the
 * shape differently is ignored wholesale rather than merged: the actions a
 * future version adds would be missing from it, and a profile that is right
 * about nine actions and silently wrong about the tenth is exactly the
 * half-bound state this model exists to prevent. Forward-compatible in the
 * only direction that matters — an OLDER build reading a NEWER entry falls
 * back to defaults and keeps working.
 */
export function loadBindings(raw) {
  const fresh = { ...defaultBindings(), repaired: false };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fresh;
  if ((raw.v | 0) !== BINDINGS_VERSION) {
    return { ...defaultBindings(), repaired: raw.v !== undefined };
  }
  const out = { repaired: false };
  for (const m of METHODS) {
    const { bindings, repaired } = normalizeProfile(m, raw[m]);
    out[m] = bindings;
    if (repaired) out.repaired = true;
  }
  return out;
}

/** The blob to persist. Callers put it inside their own settings entry — this
 *  module owns the SHAPE, the two settings keys (web/main.js, web/kaizo.js)
 *  own the storage. */
export function serializeBindings(bindings) {
  const out = { v: BINDINGS_VERSION };
  for (const m of METHODS) {
    const prof = {};
    for (const a of ACTIONS) prof[a] = [...(bindings?.[m]?.[a] ?? DEFAULT_BINDINGS[m][a])];
    out[m] = prof;
  }
  return out;
}

/**
 * Invert a profile into the lookup the binders actually run: code -> actions.
 *
 * Built once per rebind, not per event — the keyboard binder's keydown does a
 * single Map lookup, exactly as the old frozen KEYMAP object did.
 */
export function bindingIndex(profile) {
  const index = new Map();
  for (const action of ACTIONS) {
    for (const code of profile?.[action] ?? []) {
      const list = index.get(code);
      if (list) { if (!list.includes(action)) list.push(action); } else index.set(code, [action]);
    }
  }
  return index;
}

/**
 * Which OTHER actions already answer to `code` on this profile.
 *
 * The UI's conflict warning. Binding X to `cancel` while it is also `focus` is
 * the shipped default, so this reports rather than refuses; a caller that
 * wants exclusivity calls `unbindCode` first.
 */
export function conflictsFor(profile, code, action) {
  const out = [];
  for (const a of ACTIONS) {
    if (a === action) continue;
    if ((profile?.[a] ?? []).includes(code)) out.push(a);
  }
  return out;
}

/**
 * Add `code` to `action`, returning a NEW profile. Never mutates: a Controls
 * page that previews a change and then backs out must not have damaged the
 * live bindings on the way.
 *
 * Refuses a reserved code on another action (that is the soft-lock guard), a
 * malformed code, and a code already there. `exclusive` clears the code off
 * every other action first.
 */
export function bindCode(method, profile, action, code, { exclusive = false } = {}) {
  if (!ACTIONS.includes(action)) return { profile, changed: false, reason: 'unknown-action' };
  if (!isValidCode(method, code)) return { profile, changed: false, reason: 'invalid-code' };
  const pinned = RESERVED[method]?.[code];
  if (pinned && !pinned.includes(action)) {
    return { profile, changed: false, reason: 'reserved' };
  }
  const next = {};
  for (const a of ACTIONS) next[a] = [...(profile?.[a] ?? [])];
  if (exclusive) {
    for (const a of ACTIONS) {
      if (a === action) continue;
      // A reserved code keeps its pinned actions even here.
      if (pinned?.includes(a)) continue;
      next[a] = next[a].filter((c) => c !== code);
    }
    for (const a of REQUIRED_ACTIONS) {
      if (next[a].length === 0) next[a] = [...defaultProfile(method)[a]];
    }
  }
  if (next[action].includes(code)) return { profile: next, changed: exclusive, reason: 'already-bound' };
  if (next[action].length >= MAX_CODES_PER_ACTION) {
    return { profile, changed: false, reason: 'full' };
  }
  next[action] = [...next[action], code];
  return { profile: next, changed: true, reason: 'ok' };
}

/** Drop `code` from `action`, returning a NEW profile. A reserved code stays,
 *  and a REQUIRED action emptied by the removal is restored to its defaults. */
export function unbindCode(method, profile, action, code) {
  if (!ACTIONS.includes(action)) return { profile, changed: false, reason: 'unknown-action' };
  if (RESERVED[method]?.[code]?.includes(action)) {
    return { profile, changed: false, reason: 'reserved' };
  }
  const next = {};
  for (const a of ACTIONS) next[a] = [...(profile?.[a] ?? [])];
  if (!next[action].includes(code)) return { profile, changed: false, reason: 'not-bound' };
  next[action] = next[action].filter((c) => c !== code);
  let reason = 'ok';
  if (next[action].length === 0 && REQUIRED_ACTIONS.includes(action)) {
    next[action] = [...defaultProfile(method)[action]];
    reason = 'restored-required';
  }
  return { profile: next, changed: true, reason };
}

/** Reset one action (or the whole profile, with `action` omitted). */
export function resetBindings(method, profile, action = null) {
  const def = defaultProfile(method);
  if (action === null) return def;
  if (!ACTIONS.includes(action)) return profile;
  const next = {};
  for (const a of ACTIONS) next[a] = [...(profile?.[a] ?? [])];
  next[action] = [...def[action]];
  return next;
}

/** True when the two profiles bind the same codes to the same actions. The
 *  suite's equivalence test, and a cheap "is this still stock?" for the UI. */
export function sameBindings(a, b) {
  for (const action of ACTIONS) {
    const x = a?.[action] ?? [];
    const y = b?.[action] ?? [];
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  }
  return true;
}
