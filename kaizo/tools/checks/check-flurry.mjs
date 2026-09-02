#!/usr/bin/env node
// check-flurry — positive assertions on the KAIZO flurry / box splitter
// family (kaizo/attacks/flurry-*.js): the d3/d5 init branches, the d5
// two-wave organism, the splitslash retune layer (scatter, cross-instance
// freeze, hurt_delay clock rewind), and the kaizo scr_damage_maxhp routing.
//
// Every assertion here is on something a kaizo BRANCH changes — a vanilla
// copy of the sim modules fails this suite (spawn_speed 40 vs 39, scatter
// +-12 vs +-2, friction -0.2 vs -0.3, damage 206 vs 155, defend honoured vs
// ignored, hp clamped at 1 vs felled to -999, +-5 one-shot vs full-freeze).
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — private check, do not
// publish without permission.

import { createState, stepFrame, spawn } from '../../../sim/index.js';
import { makeInputTable } from '../../../input/state.js';
import { soul } from '../../../sim/soul.js';
import { battlebox, settleBox } from '../../../sim/battlebox.js';
import { gmlCreate, gmlRandom } from '../../../sim/rng.js';
import { QUICKSLASH_SHAPE, scrPreciseHitRotatedRect } from '../../../sim/masks.js';

import { boxsplitterAttack } from '../../../kaizo/attacks/flurry-boxsplitter-attack.js';
import { splitslash } from '../../../kaizo/attacks/flurry-splitslash.js';
import { kaizoScrDamageMaxhp } from '../../../kaizo/attacks/flurry-damage.js';

const failures = [];
let checks = 0;

function assert(cond, msg) {
  checks += 1;
  if (!cond) failures.push(msg);
}

const inputAt = makeInputTable([{ from: 0 }]);

function makeScene({ seed = 1, difficulty, sideb = false, replayContacts = false, hp0 } = {}) {
  const state = createState({ seed, traceBulletSlots: 0 });
  state.view = { x: 0, y: 0 };
  state.turntimer = 400;
  state.kaizo = { sideb };
  state.gmlRng = gmlCreate(seed);
  if (replayContacts) state.replayContacts = true;
  if (hp0 !== undefined) state.partyHp[0] = hp0;
  settleBox(spawn(state, battlebox, { x: 320, y: 170 }));
  state.soul = spawn(state, soul, { x: 310, y: 160 });
  const mg = spawn(state, boxsplitterAttack, { x: 425, y: 77.56658 });
  mg.difficulty = difficulty;
  return { state, mg };
}

const byName = (state, name) => state.entities.filter((e) => e.alive && e.type.name === name);
const one = (state, name) => state.entities.find((e) => e.alive && e.type.name === name);

// ── A: difficulty 3 — the new init branch (39, Side-B 37), flat cadence ────
function scenarioA(sideb) {
  const label = `d3${sideb ? ' sideB' : ''}`;
  const { state, mg } = makeScene({ seed: 7, difficulty: 3, sideb, replayContacts: true });
  const want = sideb ? 37 : 39;

  const fireFrames = [];
  let prevCount = 0;
  const slashInits = new Map(); // seq -> params
  let conParkSeen = false;
  let splitWaitAtInit = -1;

  for (let f = 0; f < 300; f++) {
    stepFrame(state, inputAt(f));
    if (f === 0) {
      assert(mg.spawn_speed === want,
        `${label}: spawn_speed after init = ${mg.spawn_speed}, want ${want} (kaizo Step_0 17-27)`);
    }
    if (mg.alive && mg.slash_count > prevCount) {
      fireFrames.push(f);
      prevCount = mg.slash_count;
    }
    for (const s of byName(state, 'obj_roaringknight_splitslash')) {
      if (s.init && !slashInits.has(s.seq)) {
        slashInits.set(s.seq, {
          angleoffset: s.angleoffset, xoffset: s.xoffset, yoffset: s.yoffset,
          vertical: s.vertical, diagonal: s.diagonal,
        });
      }
    }
    const org = one(state, 'obj_knight_split_growtangle');
    if (org && org.init && splitWaitAtInit === -1) splitWaitAtInit = org.split_wait;
    if (org && org.con === -1) conParkSeen = true;
  }

  const gaps = fireFrames.slice(1).map((f, i) => f - fireFrames[i]);
  assert(gaps.length >= 4, `${label}: only ${gaps.length} cadence gaps observed`);
  const okGaps = [want, want + 4]; // diagonal follow-up resets timer to -4
  assert(gaps.every((g) => okGaps.includes(g)),
    `${label}: cadence gaps ${gaps} not all in {${okGaps}} — d3 flat cadence broken`);
  assert(gaps.includes(want), `${label}: no plain ${want}-frame gap seen`);

  const angles = [...slashInits.values()].map((p) => Math.abs(p.angleoffset));
  if (sideb) {
    // KAIZO splitslash Step_0 12-18: the wide +-12 roll is restored on
    // Side-B + manager d3 via a SECOND draw.
    assert(angles.some((a) => a > 2),
      `${label}: no |angleoffset| > 2 across ${angles.length} slashes — the Side-B d3 wide-scatter draw is missing`);
  } else {
    assert(angles.length >= 4 && angles.every((a) => a <= 2),
      `${label}: angleoffsets ${angles} exceed +-2 — kaizo tightened scatter missing`);
  }
  // kaizo growtangle: trailing split_wait = 5 at init, and con parks at -1.
  assert(splitWaitAtInit === 5,
    `${label}: organism split_wait at init = ${splitWaitAtInit}, want 5 (kaizo growtangle Step_0 26)`);
  assert(conParkSeen, `${label}: organism never parked at con -1 (kaizo growtangle Step_0 311)`);
}

// ── B: difficulty 5 — the invisible-knight vertical-only long turn ─────────
function scenarioB() {
  const label = 'd5';
  const { state, mg } = makeScene({ seed: 3, difficulty: 5, replayContacts: true });

  const fireFrames = [];
  let prevCount = 0;
  let firstTeethFrame = -1;
  let teethSample = null;
  let orgSample = null;
  let maxDistance = 0;
  let laterFriction = null;
  const verticals = [];

  for (let f = 0; f < 700; f++) {
    stepFrame(state, inputAt(f));
    if (f === 0) {
      assert(mg.spawn_speed === 53, `${label}: spawn_speed = ${mg.spawn_speed}, want 53`);
      assert(mg.local_turntimer === 422, `${label}: local_turntimer = ${mg.local_turntimer}, want 422`);
      assert(state.turntimer === 999, `${label}: global turntimer = ${state.turntimer}, want parked 999`);
      assert(mg.slash_count === 1,
        `${label}: first slash not fired on the first step (timer = 52 init missing)`);
    }
    if (f === 25) {
      assert(mg.image_alpha === 0,
        `${label}: image_alpha = ${mg.image_alpha} at f25 — the 20-frame fade-out lerpvar is missing`);
    }
    if (mg.alive && mg.slash_count > prevCount) {
      fireFrames.push(f);
      prevCount = mg.slash_count;
    }
    for (const s of byName(state, 'obj_roaringknight_splitslash')) {
      if (s.init && !verticals.some((v) => v.seq === s.seq)) {
        verticals.push({ seq: s.seq, vertical: s.vertical, angle: s.image_angle });
      }
    }
    const org = one(state, 'obj_knight_split_growtangle');
    if (org && org.init && !orgSample) {
      orgSample = {
        max_distance: org.max_distance, split_hold: org.split_hold,
        bullet_count: org.bullet_count, damage: org.damage,
      };
    }
    if (org) maxDistance = Math.max(maxDistance, org.distance);
    const teeth = byName(state, 'obj_roaringknight_split_bullet');
    if (firstTeethFrame === -1 && teeth.length > 0) {
      firstTeethFrame = f;
      teethSample = teeth.map((b) => ({
        top_speed: b.top_speed, friction: b.friction, depth: b.depth,
        y: b.y, damage: b.damage, speed: b.speed,
      }));
    }
    if (firstTeethFrame !== -1 && f === firstTeethFrame + 20 && laterFriction === null) {
      const alive = byName(state, 'obj_roaringknight_split_bullet');
      if (alive.length) laterFriction = alive.map((b) => b.friction);
    }
  }

  // Cadence: flat 53 (replayed contacts — no strikes to bend it).
  const gaps = fireFrames.slice(1).map((f, i) => f - fireFrames[i]);
  assert(gaps.length >= 3 && gaps.every((g) => g === 53),
    `${label}: cadence gaps ${gaps}, want all 53`);

  // Vertical-only: the per-fire roll is overridden to 1 on every cut.
  assert(verticals.length >= 4 && verticals.every((v) => v.vertical === 1),
    `${label}: not every slash vertical (${verticals.map((v) => v.vertical)}) — kaizo Step_0 96-99 missing`);
  // direction is wrap-normalised on store, so -90 reads back 270.
  assert(verticals.every((v) => Math.abs(v.angle - 90) <= 4 || Math.abs(v.angle - 270) <= 4),
    `${label}: slash image_angles ${verticals.map((v) => v.angle)} not near 90/270`);

  // The d5 organism rows.
  assert(orgSample && orgSample.max_distance === 172,
    `${label}: organism max_distance = ${orgSample?.max_distance}, want 172`);
  assert(orgSample && orgSample.split_hold === 50,
    `${label}: organism split_hold = ${orgSample?.split_hold}, want 50`);
  assert(orgSample && orgSample.bullet_count === 14,
    `${label}: organism bullet_count = ${orgSample?.bullet_count}, want 14`);
  assert(orgSample && orgSample.damage === 135,
    `${label}: organism damage = ${orgSample?.damage}, want 135 (non-Side-B d5 table)`);
  assert(maxDistance > 150,
    `${label}: max split distance ${maxDistance}, want > 150 (vanilla max_distance is 70)`);

  // The two-wave spawn: 28 teeth, ladder speeds, no jitter, lerpvar friction.
  assert(teethSample && teethSample.length === 28,
    `${label}: ${teethSample?.length} teeth on the spawn frame, want 28 (two waves of 14)`);
  if (teethSample) {
    const rungs = [10, 7.5, 5, 2.5];
    assert(teethSample.every((b) => rungs.includes(b.top_speed)),
      `${label}: teeth top_speeds ${[...new Set(teethSample.map((b) => b.top_speed))]} not the exact 10/7.5/5/2.5 ladder (no jitter draw at d5)`);
    assert(new Set(teethSample.map((b) => b.top_speed)).size >= 3,
      `${label}: fewer than 3 distinct speed rungs`);
    assert(teethSample.every((b) => b.friction === 0),
      `${label}: teeth friction at spawn ${[...new Set(teethSample.map((b) => b.friction))]}, want 0 (lerpvar drives it; one-wave kaizo is -0.3/-0.15, vanilla -0.2/-0.05)`);
    assert(teethSample.every((b) => b.depth === -1),
      `${label}: teeth depth ${[...new Set(teethSample.map((b) => b.depth))]}, want organism depth - 1`);
    assert(teethSample.every((b) => b.damage === 135),
      `${label}: teeth damage ${[...new Set(teethSample.map((b) => b.damage))]}, want inherited 135`);
    // The Y ladder: 28 teeth over exactly 7 rungs, 4 per rung.
    const groups = new Map();
    for (const b of teethSample) {
      const k = b.y.toFixed(3);
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    assert(groups.size === 7 && [...groups.values()].every((n) => n === 4),
      `${label}: teeth Y ladder is ${groups.size} rungs x ${[...groups.values()]}, want 7 x 4 (gt_miny()+15 ladder)`);
  }
  assert(laterFriction !== null && laterFriction.every((fr) => fr < -0.05),
    `${label}: teeth friction 20 frames on = ${laterFriction}, want lerping toward -0.36`);

  // TEARDOWN ENDS THE TURN — and this assertion used to say the opposite.
  //
  // It read `state.turntimer > 500` under the comment "the faded knight dies
  // WITHOUT zeroing the parked clock". That is a true description of the STEP
  // (kaizo Step_0 75-83 gates its `turntimer = 0` on `image_alpha >= 1`) and a
  // false description of the OBJECT, because it ignores the CleanUp event:
  //
  //     gml_Object_obj_roaringknight_boxsplitter_attack_CleanUp_0.gml:5-9
  //     if (turn_type != "start" && ... && scr_bulletparent_count() < 2)
  //     { knight.image_alpha = 1; global.turntimer = -1; }
  //
  // byte-identical in `gml_vanilla_v105` and `gml_kaizo_dump`, and
  // `instance_destroy()` fires CleanUp — so the clock is slammed negative
  // whatever the alpha gate did. The check PINNED THE GAP: a faithful
  // boxsplitter failed it.
  //
  // THE RECORDING SETTLES IT. In `_tok3`, `atk_Splitter3`'s clock reads
  // 516.13 at f8488, 515.13 at f8489, and **-2.0 at f8490** — a 517-frame drop
  // in one frame, which is the CleanUp's -1 plus the battle controller's own
  // decrement. It does not stay above 500 for even one frame.
  //
  // Cost of the omission: `atk_Splitter3` ran 1092 frames against the mod's
  // 556 (+536) — the largest divergence in the fight at the time — because the
  // sim armed 998 and let it drain all 999.
  //
  // `<= 0` rather than an exact value: the Step's own `turntimer = 0` path and
  // the CleanUp's `-1` can both run on the teardown frame, and whether the
  // controller has decremented yet depends on phase order. The claim under test
  // is that the turn ENDS, which is what the recording shows and what the old
  // assertion denied.
  assert(!mg.alive, `${label}: manager still alive at f700`);
  assert(state.turntimer <= 0,
    `${label}: turntimer = ${state.turntimer} after teardown — the CleanUp event`
    + ' (boxsplitter_attack CleanUp_0:5-9) must slam the clock negative; the'
    + ' recording drops 515.13 -> -2 in one frame at f8490');
}

// ── C: difficulty 2 — the retune layer at a base difficulty ────────────────
function scenarioC(sideb) {
  const label = `d2${sideb ? ' sideB' : ''}`;
  const { state, mg } = makeScene({ seed: 11, difficulty: 2, sideb, replayContacts: true });

  const slashInits = new Map();
  let orgSample = null;
  let teethSample = null;
  let firstTeethFrame = -1;
  let fadeSeen = false;
  let coltimerSeen = 0;

  for (let f = 0; f < 340; f++) {
    stepFrame(state, inputAt(f));
    if (f === 0) {
      assert(mg.spawn_speed === 31, `${label}: spawn_speed = ${mg.spawn_speed}, want 31 (vanilla row kept)`);
    }
    for (const s of byName(state, 'obj_roaringknight_splitslash')) {
      if (s.init && !slashInits.has(s.seq)) {
        slashInits.set(s.seq, {
          angleoffset: s.angleoffset, xoffset: s.xoffset, yoffset: s.yoffset, vertical: s.vertical,
        });
      }
    }
    const org = one(state, 'obj_knight_split_growtangle');
    if (org && org.init && !orgSample) {
      orgSample = { split_wait: org.split_wait, split_hold: org.split_hold, damage: org.damage };
    }
    const teeth = byName(state, 'obj_roaringknight_split_bullet');
    if (firstTeethFrame === -1 && teeth.length > 0) {
      firstTeethFrame = f;
      teethSample = teeth.map((b) => ({
        top_speed: b.top_speed, friction: b.friction, damage: b.damage, speed: b.speed,
      }));
    }
    for (const b of teeth) {
      coltimerSeen = Math.max(coltimerSeen, b.coltimer ?? 0);
      // KAIZO growtangle Step_0 54: disabled teeth fade via lerpvar.
      if (b.active === false && b.image_alpha > 0 && b.image_alpha < 1) fadeSeen = true;
    }
  }

  const params = [...slashInits.values()];
  assert(params.length >= 6, `${label}: only ${params.length} slashes initialised`);
  assert(params.every((p) => Math.abs(p.angleoffset) <= 2),
    `${label}: angleoffsets ${params.map((p) => p.angleoffset)} exceed +-2`);
  assert(params.some((p) => Math.abs(p.angleoffset) > 0.1),
    `${label}: every angleoffset ~0 — the draw is not happening`);
  const verts = params.filter((p) => p.vertical === 1 || p.vertical === true);
  const horzs = params.filter((p) => !(p.vertical === 1 || p.vertical === true));
  assert(verts.length > 0 && horzs.length > 0, `${label}: no axis mix in ${params.length} cuts`);
  assert(verts.every((p) => Math.abs(p.xoffset) <= 8),
    `${label}: vertical xoffsets ${verts.map((p) => p.xoffset)} exceed +-8 (kaizo halves the +-8*2 to +-4*2)`);
  assert(horzs.every((p) => Math.abs(p.yoffset) <= 8),
    `${label}: horizontal yoffsets ${horzs.map((p) => p.yoffset)} exceed +-8`);

  assert(orgSample && orgSample.split_wait === 5,
    `${label}: organism split_wait = ${orgSample?.split_wait}, want 5 (kaizo overrides vanilla d2's 4)`);
  assert(orgSample && orgSample.split_hold === 26,
    `${label}: organism split_hold = ${orgSample?.split_hold}, want vanilla 26 kept`);
  const wantDamage = sideb ? 206 : 155;
  assert(orgSample && orgSample.damage === wantDamage,
    `${label}: organism damage = ${orgSample?.damage}, want ${wantDamage}`);

  assert(teethSample && teethSample.length === 13, `${label}: ${teethSample?.length} teeth, want 13`);
  if (teethSample) {
    // friction is an f32 built-in, so -0.3 reads back Math.fround(-0.3).
    assert(teethSample.every((b) => b.friction === Math.fround(-0.3) || b.friction === Math.fround(-0.15)),
      `${label}: teeth frictions ${[...new Set(teethSample.map((b) => b.friction))]}, want -0.3/-0.15 (vanilla -0.2/-0.05)`);
    const fastTop = sideb ? 5 : 5;
    const slowTop = sideb ? 3.35 : 2.85;
    assert(teethSample.every((b) =>
      (Math.abs(b.top_speed - fastTop) <= 0.12 + 1e-9) || (Math.abs(b.top_speed - slowTop) <= 0.12 + 1e-9)),
      `${label}: teeth top_speeds ${teethSample.map((b) => b.top_speed)} not ${fastTop}/${slowTop} +-0.12`);
    assert(teethSample.every((b) => b.damage === wantDamage),
      `${label}: teeth damage ${[...new Set(teethSample.map((b) => b.damage))]}, want ${wantDamage}`);
    if (sideb) {
      assert(teethSample.every((b) => b.speed > 0),
        `${label}: Side-B teeth stationary on spawn frame — the speed 0.5 head start is missing`);
    } else {
      assert(teethSample.every((b) => b.speed === 0),
        `${label}: non-Side-B teeth moving on spawn frame (${teethSample.map((b) => b.speed)})`);
    }
  }
  assert(coltimerSeen >= 2, `${label}: split_bullet coltimer never advanced (kaizo Step_0 12)`);
  assert(fadeSeen, `${label}: no disabled tooth ever mid-fade — the image_alpha lerpvar on close is missing`);
}

// ── E: the catch — freeze, rewind, and the (1, true, false) damage ─────────
function catchScenario({ label, sideb = false, defend = false, hp0, expectHp0, expectGloom0, seed = 5 }) {
  const { state, mg } = makeScene({ seed, difficulty: 2, sideb, hp0 });
  state.damageEnabled = false; // silence the teeth; the maxhp path has no such gate
  if (defend) state.charaction[0] = 10;

  let catchFrame = -1;
  let hurtFrame = -1;
  let hd = -1;
  const mgTimerEnd = [];
  const mgLocalEnd = [];
  let strikerSeq = -1;

  for (let f = 0; f < 400 && hurtFrame === -1; f++) {
    stepFrame(state, inputAt(f));
    mgTimerEnd[f] = mg.timer;
    mgLocalEnd[f] = mg.local_turntimer;
    const striker = byName(state, 'obj_roaringknight_splitslash').find((s) => s.playerstrike === 1);
    if (catchFrame === -1 && striker) {
      catchFrame = f;
      strikerSeq = striker.seq;
      hd = striker.hurt_delay;
    }
    if (catchFrame !== -1 && hurtFrame === -1
      && !state.entities.some((s) => s.alive && s.seq === strikerSeq)) {
      hurtFrame = f;
    }
  }

  assert(catchFrame !== -1, `${label}: no catch happened within 400 frames (seed ${seed})`);
  assert(hurtFrame !== -1, `${label}: the strike never resolved`);
  if (catchFrame === -1 || hurtFrame === -1) return;

  assert(hd >= 3 && hd <= 5, `${label}: hurt_delay ${hd} outside the split_wait range`);

  // The per-frame freeze (kaizo Draw_0 37-41): the manager's clock holds
  // still for the strike's whole length. Vanilla's one-shot -5 would show a
  // step here instead.
  for (let f = catchFrame + 1; f < hurtFrame; f++) {
    assert(mgTimerEnd[f] === mgTimerEnd[catchFrame],
      `${label}: mg.timer moved during the strike (f${f}: ${mgTimerEnd[f]} vs ${mgTimerEnd[catchFrame]}) — freeze missing`);
    assert(mgLocalEnd[f] === mgLocalEnd[catchFrame],
      `${label}: mg.local_turntimer moved during the strike (f${f})`);
  }
  // The hurt-frame one-shot rewind (kaizo Step_0 179-183): -hurt_delay on
  // the pattern clock, +hurt_delay on the turn, net of the manager's own
  // +1/-1 that frame.
  assert(mgTimerEnd[hurtFrame] === mgTimerEnd[catchFrame] + 1 - hd,
    `${label}: mg.timer after hurt = ${mgTimerEnd[hurtFrame]}, want ${mgTimerEnd[catchFrame] + 1 - hd} (catch-end ${mgTimerEnd[catchFrame]} + 1 - hurt_delay ${hd})`);
  assert(mgLocalEnd[hurtFrame] === mgLocalEnd[catchFrame] - 1 + hd,
    `${label}: mg.local_turntimer after hurt = ${mgLocalEnd[hurtFrame]}, want ${mgLocalEnd[catchFrame] - 1 + hd}`);

  // The damage: scr_damage_maxhp(1, true, false) through the kaizo copy —
  // mantle absorb pulls it onto Kris (wearer, damagecounter 0 -> 1) and the
  // mantle halves the fraction: ceil(160 * 0.5) = 80.
  assert(state.partyHp[0] === expectHp0,
    `${label}: partyHp[0] = ${state.partyHp[0]}, want ${expectHp0}`);
  if (expectGloom0 !== undefined) {
    assert((state.kaizo.gloom?.[0] ?? -1) === expectGloom0,
      `${label}: gloom[0] = ${state.kaizo.gloom?.[0]}, want ${expectGloom0} (Side-B ceil(t/4) carve)`);
  }
  if (hp0 !== undefined && expectHp0 === -999) {
    assert(state.chardead?.[0] === 1,
      `${label}: chardead[0] = ${state.chardead?.[0]}, want 1 (kaizo removes the mercy: scr_dead runs)`);
  }
  assert(state.partyHp[1] === 190 && state.partyHp[2] === 140,
    `${label}: Susie/Ralsei HP moved (${state.partyHp[1]}/${state.partyHp[2]}) — absorb targeting broken`);
  assert(state.knight.damagecounter === 1,
    `${label}: damagecounter = ${state.knight.damagecounter}, want 1 (kaizo absorb path)`);
}

// ── G: scr_precise_hit tightened 3 -> 2 ────────────────────────────────────
function scenarioG() {
  const bar = { x: 320, y: 170, image_xscale: 1, image_yscale: 2, image_angle: 1.5 };
  let found = null;
  for (let dy = -30; dy <= 30 && !found; dy += 0.25) {
    const heart = { x: 320 - 10, y: 170 - 10 + dy };
    const hit3 = scrPreciseHitRotatedRect(heart, bar, QUICKSLASH_SHAPE, 3);
    const hit2 = scrPreciseHitRotatedRect(heart, bar, QUICKSLASH_SHAPE, 2);
    if (hit3 && !hit2) found = { heart, dy };
  }
  assert(found !== null,
    'precise-hit: no soul position discriminates size 3 from size 2 — sweep broken');
  if (found) {
    // The kaizo collides() must MISS at the discriminating point (it passes
    // 2); the vanilla module (passing 3) hits there.
    const e = { ...bar, active: 1 };
    assert(splitslash.collides(e, found.heart, {}) === false,
      `precise-hit: kaizo collides() still hits at the 3-only boundary point (dy ${found.dy}) — the 2px window is missing`);
    // Sanity: it still connects dead-centre.
    assert(splitslash.collides(e, { x: 310, y: 160 }, {}) === true,
      'precise-hit: kaizo collides() misses a dead-centre soul');
  }
}

// ── H: the kaizo targeting — weighted roll + absorb counter ────────────────
function scenarioH() {
  // Weighted path: counter >= 2 disables the wearer, the HP-weighted roll
  // lands on Susie/Ralsei at full HP (krisrange 0) and RESETS the counter.
  {
    const state = createState({ seed: 21, traceBulletSlots: 0 });
    state.kaizo = { sideb: false };
    state.gmlRng = gmlCreate(21);
    state.invTimer = -1;
    state.knight.damagecounter = 5;
    const dealt = kaizoScrDamageMaxhp(state, 0.5, false, false, { target: 0 });
    const hitSusie = state.partyHp[1] === 190 - 95;
    const hitRalsei = state.partyHp[2] === 140 - 70;
    assert(hitSusie !== hitRalsei,
      `targeting: weighted roll hit neither Susie nor Ralsei cleanly (hp ${state.partyHp}, dealt ${dealt}) — vanilla mantle logic would pull onto Kris`);
    assert(state.partyHp[0] === 160, `targeting: Kris took the weighted hit (hp[0] ${state.partyHp[0]})`);
    assert(state.knight.damagecounter === 0,
      `targeting: damagecounter = ${state.knight.damagecounter}, want reset to 0 off-wearer`);
    assert(state.knight.progamer === false,
      'targeting: progamer not cleared by a maxhp hit (kaizo hunk 1)');
  }
  // Absorb path: counter < 2 pulls onto the wearer, halves the fraction, and
  // consumes NO RNG (twin-state draw comparison).
  {
    const state = createState({ seed: 22, traceBulletSlots: 0 });
    state.kaizo = { sideb: false };
    state.gmlRng = gmlCreate(22);
    state.invTimer = -1;
    state.knight.damagecounter = 0;
    kaizoScrDamageMaxhp(state, 0.5, false, false, { target: 0 });
    assert(state.partyHp[0] === 160 - 40,
      `targeting: absorb dealt ${160 - state.partyHp[0]}, want 40 (ceil(160 * 0.5 / 2)) on the wearer`);
    assert(state.knight.damagecounter === 1,
      `targeting: absorb damagecounter = ${state.knight.damagecounter}, want 1`);
    // The TARGETING drew nothing; the only stream consumer in the whole call
    // was the dmg writer's own random(600) throw roll (sim/dmgnumbers.js,
    // faithful vanilla). A twin that reproduces exactly that one draw must
    // now be in lockstep.
    const twin = gmlCreate(22);
    gmlRandom(twin, 600);
    assert(gmlRandom(state.gmlRng, 1) === gmlRandom(twin, 1),
      'targeting: the absorb path consumed targeting RNG — it must draw nothing beyond the writer roll');
  }
  // Side-B carve order: gloom from the raw value, THEN x0.8, THEN defend —
  // and defend is honoured when arg1 is false.
  {
    const state = createState({ seed: 23, traceBulletSlots: 0 });
    state.kaizo = { sideb: true };
    state.gmlRng = gmlCreate(23);
    state.invTimer = -1;
    state.knight.damagecounter = 0;
    state.charaction[0] = 10; // DEFEND
    kaizoScrDamageMaxhp(state, 0.5, false, false, { target: 0 });
    // t = ceil(160*0.25) = 40; gloom = ceil(40/4) = 10; t = ceil(40*0.8) = 32;
    // defend (arg1 false): t = ceil(32/1.5) = 22.
    assert(state.partyHp[0] === 160 - 22,
      `sideB order: dealt ${160 - state.partyHp[0]}, want 22 (gloom carve before defend)`);
    assert(state.kaizo.gloom?.[0] === 10,
      `sideB order: gloom[0] = ${state.kaizo.gloom?.[0]}, want 10 (ceil of the UN-softened value / 4)`);
  }
}

// ── I: THE BLUE RE-THEME ───────────────────────────────────────────────────
//
// Two kaizo colour deltas live in this family, both on instance state and
// both consuming ZERO draws:
//   * splitslash Step_0 56 — the telegraph charges merge_color(c_black,
//     #86A2FF, clamp01(timer / 20)) where vanilla charged to c_red, then
//     snaps to c_white on the cut frame (Step_0 89).
//   * split_bullet Draw_0 6-23 (NEW) — every tooth is BORN blue and cools to
//     white, from get_swordcolor() over 40 frames under a quickslash and
//     from #86A2FF over 30 otherwise, latched by `fade_over`.
// Each assertion fails if its line is deleted; none passes vacuously.
function scenarioI() {
  const eqRgb = (a, b) => Array.isArray(a) && Array.isArray(b)
    && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

  // --- the splitslash telegraph ---
  {
    const { state } = makeScene({ seed: 11, difficulty: 2, replayContacts: true });
    const seen = new Map(); // seq -> [{timer, blend, slash}]
    let bornBlack = null;
    for (let f = 0; f < 120; f++) {
      stepFrame(state, inputAt(f));
      for (const s of byName(state, 'obj_roaringknight_splitslash')) {
        if (!seen.has(s.seq)) seen.set(s.seq, []);
        seen.get(s.seq).push({ timer: s.timer, blend: s.image_blend, slash: s.slash });
        if (bornBlack === null) bornBlack = s.image_blend;
      }
    }
    const runs = [...seen.values()].filter((r) => r.length > 32);
    assert(runs.length > 0, 'blue: no splitslash lived long enough to watch its telegraph');
    if (runs.length) {
      const r = runs[0];
      const at1 = r.find((x) => x.timer === 1);
      const at10 = r.find((x) => x.timer === 10);
      const at20 = r.find((x) => x.timer === 20);
      const at30 = r.find((x) => x.timer === 30);
      assert(at1 && eqRgb(at1.blend, [7, 8, 13]),
        `blue: splitslash timer 1 blend ${JSON.stringify(at1 && at1.blend)}, want merge(c_black, #86A2FF, 1/20)`);
      assert(at10 && eqRgb(at10.blend, [67, 81, 128]),
        `blue: splitslash timer 10 blend ${JSON.stringify(at10 && at10.blend)}, want the halfway blue`);
      assert(at20 && eqRgb(at20.blend, [134, 162, 255]),
        `blue: splitslash timer 20 blend ${JSON.stringify(at20 && at20.blend)}, want #86A2FF`);
      assert(at30 && eqRgb(at30.blend, [255, 255, 255]),
        `blue: splitslash timer 30 blend ${JSON.stringify(at30 && at30.blend)}, want c_white on the cut`);
      // The whole ramp is blue-dominant. Vanilla's merge to c_red is
      // red-dominant on every one of the same frames, so this single test
      // separates the two builds outright.
      const pre = r.filter((x) => !x.slash && x.timer > 0 && x.timer <= 20);
      assert(pre.length >= 15 && pre.every((x) => x.blend[2] >= x.blend[0]),
        'blue: the splitslash telegraph is blue-dominant across the whole ramp (vanilla ramps to c_red)');
    }
  }

  // --- the teeth ---
  {
    const { state } = makeScene({ seed: 12, difficulty: 2, replayContacts: true });
    const teeth = new Map();
    for (let f = 0; f < 200; f++) {
      stepFrame(state, inputAt(f));
      for (const t of byName(state, 'obj_roaringknight_split_bullet')) {
        if (!teeth.has(t.seq)) teeth.set(t.seq, []);
        const rec = teeth.get(t.seq);
        if (rec.length < 60) rec.push({ col: t.coltimer, blend: t.image_blend, over: t.fade_over });
      }
    }
    const runs = [...teeth.values()].filter((r) => r.length > 35);
    assert(runs.length > 0, 'blue: no tooth lived long enough to watch its fade');
    if (runs.length) {
      const r = runs[0];
      // A tooth's FIRST observed frame is its spawn frame: the entity list is
      // frozen per phase, so the Draw slot paints it but its own Step has not
      // run yet — coltimer is still Create's 0 and the blend is the ramp's
      // exact starting colour.
      assert(r[0].col === 0, `blue: a newborn tooth has coltimer 0 (got ${r[0].col})`);
      assert(eqRgb(r[0].blend, [134, 162, 255]),
        `blue: a newborn tooth is exactly #86A2FF (got ${JSON.stringify(r[0].blend)})`);
      const at1 = r.find((x) => x.col === 1);
      assert(at1 && eqRgb(at1.blend, [138, 165, 255]),
        `blue: and starts cooling on its first step (got ${JSON.stringify(at1 && at1.blend)})`);
      const mid = r.find((x) => x.col === 15);
      assert(mid && eqRgb(mid.blend, [195, 209, 255]),
        `blue: the tooth is half-cooled at coltimer 15 (got ${JSON.stringify(mid && mid.blend)})`);
      const done = r.find((x) => x.col >= 30);
      assert(done && eqRgb(done.blend, [255, 255, 255]) && done.over === true,
        'blue: the tooth reaches c_white at coltimer 30 and latches fade_over');
      assert(r.every((x) => x.blend[2] >= x.blend[0]),
        'blue: a tooth is never red-dominant at any point in the fade');
    }
  }

  // --- the quickslash arm: a different blue AND a slower rate ---
  {
    const { state } = makeScene({ seed: 12, difficulty: 2, replayContacts: true });
    // Stand in for obj_roaringknight_quickslash_attack — the branch tests
    // instance existence only (kaizo split_bullet Draw_0 8).
    spawn(state, { name: 'obj_roaringknight_quickslash_attack' }, { x: 0, y: 0 });
    const teeth = new Map();
    for (let f = 0; f < 200; f++) {
      stepFrame(state, inputAt(f));
      for (const t of byName(state, 'obj_roaringknight_split_bullet')) {
        if (!teeth.has(t.seq)) teeth.set(t.seq, []);
        const rec = teeth.get(t.seq);
        if (rec.length < 60) rec.push({ col: t.coltimer, blend: t.image_blend });
      }
    }
    const r = [...teeth.values()].filter((x) => x.length > 35)[0];
    assert(r, 'blue: no tooth observed on the quickslash arm');
    if (r) {
      // get_swordcolor() is PURE blue — a visibly different blue from
      // #86A2FF — and the ramp out of it is 40 frames, not 30.
      assert(eqRgb(r[0].blend, [0, 0, 255]),
        `blue: under a quickslash a tooth starts from get_swordcolor() (got ${JSON.stringify(r[0].blend)})`);
      const q1 = r.find((x) => x.col === 1);
      assert(q1 && eqRgb(q1.blend, [6, 6, 255]),
        `blue: cooling on the 40-frame rate, not the 30 (got ${JSON.stringify(q1 && q1.blend)})`);
      const at30 = r.find((x) => x.col === 30);
      assert(at30 && !eqRgb(at30.blend, [255, 255, 255]),
        'blue: and takes 40 frames, not 30 — still short of white at coltimer 30');
    }
  }
}

// ── run ────────────────────────────────────────────────────────────────────
scenarioA(false);
scenarioA(true);
scenarioB();
scenarioC(false);
scenarioC(true);
catchScenario({ label: 'catch d2', expectHp0: 160 - 80 });
catchScenario({ label: 'catch d2 DEFEND ignored', defend: true, expectHp0: 160 - 80 });
catchScenario({ label: 'catch d2 fell', hp0: 70, expectHp0: -999 });
catchScenario({ label: 'catch d2 sideB gloom', sideb: true, expectHp0: 160 - 64, expectGloom0: 20 });
scenarioG();
scenarioH();
scenarioI();

if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log(`\n${failures.length} of ${checks} assertions failed`);
  process.exit(1);
}
console.log(`PASS  check-flurry — ${checks} positive assertions on the kaizo branches`);
