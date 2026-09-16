// THE TWO PRACTICE DIALS — bullet multiplier and bullet cooldown.
//
// A player request, in their own words: "Can you add little bars to turn the
// bullet multiplier and bullet cooldown for the fight?" So they are BARS, in
// the MUSIC / SFX idiom (`sim/modes.js`'s audio page, drawn in
// `render/title.js`), and they live on the CONTROLS page because they are how
// you drive the fight, not how your screen looks.
//
// ── THE ROW IS THE DISCLOSURE, AND NOTHING ELSE ANNOUNCES THEM ─────────────
//
// Neither dial is in the game: no Knight attack scales its spawn count, and no
// attack lets you retime its intervals. An earlier revision therefore painted
// "PRACTICE DIALS ON — NOT THE REAL FIGHT" under the title wordmark, reading
// CLAUDE.md's fourth law ("nothing invented ships unlabelled") as requiring it.
//
// THAT WAS THE WRONG READING AND THE BANNER IS GONE. Law 4 exists so a player
// cannot mistake INVENTED CONTENT — a placeholder bullet, a guessed timing —
// for the real fight. A bar the player moved themselves, on the settings page,
// one screen ago, is not a hidden substitution: the row carries the dial's
// name and its value, and that IS the label law 4 asks for — without a tint,
// which was tried and rejected for the same reason the banner was. Narrating the
// setting back on the way out is a "practice mode is on!" notice, which the
// user has now rejected three times in those words.
//
// So there is no `dialsLabel` here and no reader for one. `dialsActive` stays
// because `applyDials` needs it to decide whether to arm a state at all — it
// is a SIM predicate, not a UI string — and `tools/verify-dials.mjs` section 4
// asserts the title screen's glyphs are identical with the bars moved.
//
// ── OFF IS A LITERAL NO-OP, WHICH IS THE WHOLE DESIGN CONSTRAINT ───────────
//
// The byte gate replays recorded fights bullet-for-bullet, and one extra
// entity draws RNG and shifts the entire stream from that frame on. So the
// default path must execute EXACTLY the code it executed before this file
// existed — not "multiply by 1", not "loop once", the same calls in the same
// order.
//
// Both readers below are written for that and nothing else:
//
//   * `cooldownFrames` returns its ARGUMENT, unmodified and untouched, on the
//     default. No arithmetic, no rounding, no clamp.
//   * the multiplier's reader is `bulletCopies`, and `sim/entity.js`'s hook
//     is guarded so that an unarmed state (`state.dials` absent — which is
//     every verifier, every trace regen and every byte-gate run, because
//     nothing arms it but a scene builder that was handed dials) short-
//     circuits before any of this module is reached.
//
// ── AND THEY CANNOT BE ENGAGED UNDER A REPLAY ──────────────────────────────
//
// `applyDials` refuses when `sim/replay.js` has marked the state (see
// `isReplaying` there). That is a REFUSAL AT THE INSTALL SITE rather than a
// trust in the default: a `?replay=` token names a seed and an input stream
// and promises the same frames back, and a saved multiplier in localStorage
// would silently break that promise for every token the player opens.

import { isReplaying } from './replay.js';

/**
 * THE MULTIPLIER'S CEILING IS 3, AND THAT IS A REASONED BOUND, NOT A GUESS.
 *
 * ROARING and the knightlines already put several hundred live bullets in the
 * box, and every one of them goes through the per-frame mask-overlap test in
 * `sim/collision.js` plus the graze sweep in `sim/tension.js` — both linear in
 * the live count, on a 30Hz budget. 3x of the fight's worst frame is still a
 * frame; 10x of a thousand-bullet attack is ten thousand entities and the tab
 * stops responding. A dial that can hang the page is not a practice aid, so
 * the ceiling is where the box is already unsurvivable and the clock still
 * holds.
 *
 * THE COOLDOWN IS A PERCENTAGE OF THE VANILLA INTERVAL, 0..200 in steps of
 * 25, default 100 — and 0 is the floor for a reason: it means EVERY FRAME,
 * which is precisely what the nobulletcooldowns mod does when it rewrites
 * `(roaring_timer % 5) == 0` to `(roaring_timer % roaring_timer) == 0` (x % x
 * is 0 for every non-zero x, so the guard is always true). That makes the mod
 * toggle the bottom stop of this same axis rather than a second, parallel
 * mechanism — which is the whole reason the range runs to 0 rather than to
 * some small positive percentage.
 *
 * 200 is the top because half-speed is the useful direction for learning a
 * pattern and anything slower stops resembling the attack you are learning.
 */
export const DIALS = [
  {
    id: 'bulletMult',
    name: 'BULLET MULTIPLIER',
    min: 1,
    max: 3,
    step: 1,
    def: 1,
    format: (v) => `${v}x`,
  },
  {
    id: 'bulletCooldown',
    name: 'BULLET COOLDOWN',
    min: 0,
    max: 200,
    step: 25,
    def: 100,
    // 0 is not "0%" — it is the mod's behaviour, and the row says the thing
    // rather than a number the player has to decode.
    format: (v) => (v === 0 ? 'EVERY FRAME' : `${v}%`),
  },
];

/** Dial descriptor by id, or undefined. */
export function dialSpec(id) {
  return DIALS.find((d) => d.id === id);
}

/** A fresh, all-default dial set. */
export function freshDials() {
  const out = {};
  for (const d of DIALS) out[d.id] = d.def;
  return out;
}

/**
 * Clamp AND snap to the dial's step grid.
 *
 * Both halves matter: a saved entry from a future build with a finer step, or
 * a hand-edited localStorage value, must land on a value the bar can actually
 * draw and the stepper can actually walk off. A non-number falls back to the
 * default rather than to NaN, which would poison every comparison downstream
 * into false — including the `=== d.def` that decides whether the run is the
 * real fight.
 */
export function clampDial(id, v) {
  const d = dialSpec(id);
  if (!d) return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return d.def;
  const snapped = d.min + Math.round((n - d.min) / d.step) * d.step;
  return Math.max(d.min, Math.min(d.max, snapped));
}

/** Every value clamped and snapped; unknown keys dropped. */
export function normaliseDials(dials) {
  const out = freshDials();
  if (dials && typeof dials === 'object') {
    for (const d of DIALS) {
      if (d.id in dials) out[d.id] = clampDial(d.id, dials[d.id]);
    }
  }
  return out;
}

/**
 * Walk one dial by `dir` (-1 / +1) steps. Returns true if the value MOVED —
 * the caller's cue to mark the settings dirty and sound the menu blip, and
 * the reason a bar parked at its end is silent rather than blipping forever.
 */
export function stepDial(dials, id, dir) {
  const d = dialSpec(id);
  if (!d) return false;
  const before = clampDial(id, dials[id]);
  const after = clampDial(id, before + dir * d.step);
  dials[id] = after;
  return after !== before;
}

/** 0..1, for the bar's fill. */
export function dialFraction(id, v) {
  const d = dialSpec(id);
  if (!d) return 0;
  return (clampDial(id, v) - d.min) / (d.max - d.min);
}

/**
 * True when ANY dial is off its default.
 *
 * THIS IS A SIM PREDICATE, NOT A UI STRING, and it has exactly one consumer:
 * `applyDials` below, which refuses to arm a state whose dials are all at
 * their defaults. Nothing draws off it. See this file's header for why the
 * title-screen banner that used to is gone and must not return.
 */
export function dialsActive(dials) {
  if (!dials) return false;
  for (const d of DIALS) {
    if (clampDial(d.id, dials[d.id]) !== d.def) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// INSTALLING THEM ON A STATE

/**
 * Arm a state with a dial set. THE ONLY WAY `state.dials` is ever populated.
 *
 * Returns true if the dials were armed, false if the call was refused or the
 * set was all-default. BOTH refusals leave `state.dials` as `null`, which is
 * the value every reader below treats as "this module does not exist" — so a
 * refused install is not merely equivalent to the default path, it IS the
 * default path.
 *
 *   * A REPLAY refuses. `sim/replay.js` marks the state (`markReplay`) and a
 *     token's promise is the same frames back; a dial saved in localStorage
 *     three days ago must not rewrite someone's bug report.
 *   * AN ALL-DEFAULT SET refuses too, and that is not an optimisation. It is
 *     what keeps the armed and unarmed builds byte-identical: a state carrying
 *     `{ bulletMult: 1, bulletCooldown: 100 }` would still make
 *     `sim/entity.js`'s guard read a property per spawn, and — more to the
 *     point — would leave the sim one refactor away from a reader that treats
 *     "armed" as "active".
 */
export function applyDials(state, dials) {
  state.dials = null;
  if (!state || isReplaying(state)) return false;
  const norm = normaliseDials(dials);
  if (!dialsActive(norm)) return false;
  state.dials = norm;
  return true;
}

// ---------------------------------------------------------------------------
// THE READERS

/**
 * THE COOLDOWN DIAL'S READ — the one lane 1's mod work calls at each
 * spawn-interval site.
 *
 * `frames` is the vanilla interval exactly as the dump has it, and on the
 * default this function HANDS IT BACK UNTOUCHED: same value, same type, no
 * arithmetic performed on it at all. That is the literal-no-op requirement
 * written as code rather than promised in a comment.
 *
 * The floor is 1: an interval of 0 is not "faster", it is a guard that either
 * never fires or fires unconditionally depending on which comparison the site
 * uses, and the mod's own "every frame" behaviour is the 0-stop of the dial,
 * handled explicitly above it.
 */
export function cooldownFrames(state, frames) {
  const d = state && state.dials;
  if (!d || d.bulletCooldown === 100) return frames;
  if (d.bulletCooldown === 0) return 1;
  return Math.max(1, Math.round((frames * d.bulletCooldown) / 100));
}

/**
 * How many instances one spawned bullet should become. 1 on every state this
 * module has not armed, which is every headless run in the repo.
 */
export function bulletCopies(state) {
  const d = state && state.dials;
  if (!d) return 1;
  return clampDial('bulletMult', d.bulletMult);
}

/**
 * HOW FAR APART THE COPIES SIT, and why they are offset at all.
 *
 * A perfect duplicate — same x, same y, same heading, same speed — is
 * invisible: it tracks its original forever and the player sees one bullet
 * that hurts the same as one bullet. The copies therefore TRAIL the original
 * along its own heading, one spacing per copy, which is the same picture as
 * the attack having fired a few frames earlier as well. It is a deterministic
 * offset computed from the bullet's own `direction` — no RNG draw of its own,
 * so the only stream effect of the dial is the copies' own Create events.
 *
 * 14px because the regular bullet's mask is about that across (sim/masks.js),
 * so consecutive copies read as a tighter stream rather than as one fatter
 * bullet.
 */
export const COPY_SPACING = 14;
