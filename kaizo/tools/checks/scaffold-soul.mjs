// THE SCAFFOLD SOUL the drill used to hand every check that built it.
//
// buildSingleAttackScene (sim/scenes/single.js, vendored) NO LONGER SPAWNS
// obj_heart AT BUILD. Since knight-sim v1.0.17 the drill's soul is delivered
// the way the fight delivers it: obj_moveheart leaves Kris on the arena-open
// frame (gap 12 of the 45-frame gap, with openArena) and its alarm creates
// obj_heart eight frames later, at gap 4, when the ring already encloses the
// drop point. The reason is the out-of-bounds report — a soul that existed
// BEFORE the arena opened could be steered to the placeholder box's wall,
// and it was outside the ring when openArena collapsed the box to scale 0;
// reject-on-entry collision never pulls a soul back IN, so it walked out of
// the grow-in and dodged from the free half of the screen ("when the soul
// recenters move to a corner; when the box animation plays you get out of
// bounds" — measured wider than a corner: any held direction did it). Right
// for the drill and the fight, and it took the soul away from every check
// that built the drill as a bare scaffold, "give me a board and a soul": each
// pre-rolls twelve frames at most and then pins `state.soul.x`, twelve frames
// is short of the delivery, and `state.soul` was null where it had been a
// heart (check-oracle-tracking.mjs:392, "Cannot set properties of null").
//
// THE CHECKS SCAFFOLD ONE THEMSELVES. Every one of them destroys the practice
// director on the line after the build and launches its own attack through
// launchVCAttack (or spawns the manager bare), so the drill's delivery — which
// lives in that director's endStep — never runs for them and never will.
// This helper spawns the vanilla obj_heart exactly where the pre-vendor drill
// did: at build, at SOUL_START, with the same call (`spawn(state, soul,
// { ...SOUL_START })`, single.js:278 of the previous vendor). Call it
// IMMEDIATELY AFTER buildSingleAttackScene, not at the pin: spawned there the
// soul's seq (the kaizo lane steps newest-first), its xstart/ystart
// (kaizo/attacks/swordfall.js reads `state.soul.xstart`), its bornFrame and
// the pre-roll's inv decrements are the baseline's, and a check that pins the
// soul afterwards lands it where it always did.
//
// THE MASK IS THE TESTER'S, as before. A bare `spawn(state, soul)` carries no
// `mask`, and sim/collision.js falls back to HEART_MASK — spr_dodgeheartmask,
// the precise heart shape the tester room's soul wears. The FIGHT's soul
// wears HEART_RECT, stamped by obj_moveheart's Alarm_0 handoff, which is why
// check-underbox and check-split-growtangle-vertical stamp HEART_RECT by hand
// straight after the build. The tester's mask is what the baseline that
// passed was measuring against; nothing here changes what a check asserts.
//
// Idempotent on a live heart: a state that already carries one (a check that
// stepped to arena-open and took the moveheart delivery) is left alone.

import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { SOUL_START } from '../../../sim/actors.js';

/**
 * Give a freshly built drill the soul the old scaffold gave it.
 *
 * @param state  a state buildSingleAttackScene has just returned
 * @param x      spawn x; SOUL_START.x (314) unless the check has a reason
 * @param y      spawn y; SOUL_START.y (162) unless the check has a reason
 * @returns      state.soul, alive
 */
export function ensureSoul(state, x = SOUL_START.x, y = SOUL_START.y) {
  if (!state.soul || !state.soul.alive) {
    state.soul = spawn(state, soul, { x, y });
  }
  return state.soul;
}
