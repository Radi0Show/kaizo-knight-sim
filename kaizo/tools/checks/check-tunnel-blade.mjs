#!/usr/bin/env node
// PUBLISH GATE: V-C recreation of EnderCat8's Kaizo Roaring Knight — do not
// publish without permission (kaizo/HANDOFF.md §5-C).
//
// THE REVISED TUNNEL'S BLADE, ON CONTACT — and this file exists because of a
// bug that lived 6,631 frames inside a green suite.
//
// obj_knight_diamondswordbullet_ext's Other_15 is a TOTAL OVERRIDE: 23 lines,
// no event_inherited(), no instance_destroy. GameMaker child events REPLACE
// the parent's unless the inherit is explicit, so what it drops is the
// parent's kill —
//
//     if (destroyonhit == 1) { instance_destroy(); }
//         -- gml_Object_obj_collidebullet_Other_15.gml:11-14
//
// — and the blade goes THROUGH you. The sim ended its override with a call to
// the parent handler, an event_inherited() the GML does not have, and the
// blade died on contact instead.
//
// WHY NOTHING CAUGHT IT, which is the reason this file is separate from
// check-oracle-tunnel rather than a section inside it. That check is
// recording-driven and sets `st.damageEnabled = false` for oracle parity
// (check-oracle-tunnel.mjs:426) — and the parent handler returns on that flag
// ABOVE the destroy, so the faulty branch was structurally unreachable there.
// The suite was not weak; it had switched off the system the bug lived in.
// This check therefore runs with damage ON, which is the whole point of it.
//
// It is also placed so it CANNOT be fooled by the sub-pixel question that is
// still open at the f6658 front: the blade is parked squarely on the soul,
// not at the edge of its mask, so a hit here does not depend on the
// rasterisation rule.

import { createState, stepFrame } from '../../../sim/index.js';
import { spawn } from '../../../sim/entity.js';
import { soul } from '../../../sim/soul.js';
import { battlebox } from '../../../sim/battlebox.js';
import { HEART_RECT } from '../../../sim/masks.js';
import { diamondSwordBullet } from '../../attacks/sword-tunnel-revised.js';

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass += 1; console.log(`  ok   ${msg}`); } else { fail += 1; console.log(`  FAIL ${msg}`); }
}

/**
 * A soul, a box, and ONE blade sitting on top of it.
 *
 * The blade is given the state the mod's own spawner leaves it in for a live
 * white wall: active, g == 255 (the colour gate in Other_15), not shakeme, and
 * angle 90 with the long axis vertical — the same configuration the recording
 * shows at the frames this models.
 */
function scene({ inv = -30, g = 255, shakeme = false, active = 1 } = {}) {
  const state = createState({ seed: 12345 });
  state.damageEnabled = true;             // THE POINT OF THIS FILE
  state.invTimer = inv;
  spawn(state, battlebox, { x: 320, y: 220 });
  // Soul origin is the sprite's top-left; its 20x20 mask spans +0..+19.
  state.soul = spawn(state, soul, { x: 311, y: 222 });
  // THE FIGHT'S SOUL WEARS HEART_RECT, not the heart-shaped default. The
  // moveheart handoff hands the new heart obj_moveheart's own 20x20
  // AxisAlignedRect mask (kaizo/scenes/kaizo-practice.js, `state.soul.mask =
  // HEART_RECT`), and a bare spawn here would collide as the smaller
  // heart-shaped spr_dodgeheartmask instead -- a scene that is not the fight.
  state.soul.mask = HEART_RECT;
  const b = spawn(state, diamondSwordBullet, { x: 320, y: 231 }); // dead centre
  b.sprite_index = 'spr_knight_diamondbullet_m';
  b.image_xscale = 0.927;
  b.image_yscale = 1;
  b.image_angle = 90;
  b.direction = 180;
  b.speed = 12;
  b.active = active;
  b.g = g;
  b.shakeme = shakeme;
  b.damage = 103;
  return { state, b };
}

/** Run the collision the way the engine does, through the type's own hooks. */
function contact(state, b) {
  const hit = b.type.collides(b, state.soul);
  if (hit) b.type.other15(b, state);
  return hit;
}

console.log('A. the blade SURVIVES hitting you (Other_15 is a total override)');
{
  const { state, b } = scene();
  const hpBefore = state.partyHp ? [...state.partyHp] : null;
  const hit = contact(state, b);
  assert(hit, 'the blade parked on the soul registers contact at all');
  assert(b.alive,
    'and it is STILL ALIVE — the override drops obj_collidebullet\'s'
    + ' `if (destroyonhit == 1) instance_destroy()`');
  assert(b.destroyonhit === 1 || b.destroyonhit === true,
    'destroyonhit is still 1 — the mod never clears it, the branch is just'
    + ' unreachable for this object');
  if (hpBefore) {
    const dropped = hpBefore.reduce((a, v) => a + v, 0)
      - state.partyHp.reduce((a, v) => a + v, 0);
    assert(dropped > 0, `and it DEALT the damage (party lost ${dropped})`);
  }
}

console.log('B. the flinch — Other_15:3-14, gated on !shakeme && g == 255 && inv < 0');
{
  const { state, b } = scene();
  const speedBefore = b.speed;
  contact(state, b);
  assert(Math.abs(b.speed - speedBefore / 2) < 1e-9,
    `speed HALVES on the flinch (${speedBefore} -> ${b.speed})`);
  // The 10-degree tilt is a scr_lerpvar, so it is a tween rather than an
  // instant write: the blade still reads 90 on the collision frame and moves
  // on the next one. That one-frame lag is the recording's own shape.
  assert(b.image_angle === 90,
    'image_angle is UNCHANGED on the contact frame — the tilt is a lerp, and'
    + ' the recording shows it first move a frame later');
  stepFrame(state, {});
  assert(b.image_angle < 90,
    `and it has started to tilt by the next frame (${b.image_angle.toFixed(4)})`);
}

console.log('C. the flinch\'s three gates each actually gate');
{
  for (const [label, opts] of [
    ['shakeme', { shakeme: true }],
    ['g != 255', { g: 34 }],
    ['inv >= 0 (i-frames)', { inv: 5 }],
  ]) {
    const { state, b } = scene(opts);
    const speedBefore = b.speed;
    contact(state, b);
    assert(b.speed === speedBefore, `${label}: NO flinch, speed untouched`);
    assert(b.alive, `${label}: and the blade still survives`);
  }
}

console.log('D. a fake is harmless — active = 0 is the only difference');
{
  const { state, b } = scene({ active: 0 });
  const hit = b.type.collides(b, state.soul);
  assert(!hit, 'an inactive blade does not register contact at all');
  assert(b.alive, 'and it survives, like every other blade');
}

console.log(`\ncheck-tunnel-blade: ${pass}/${pass + fail} assertions passed`);
process.exit(fail ? 1 : 0);
