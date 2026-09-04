#!/usr/bin/env node
// POSITIVE assertions on the KAIZO knight-stream module's NEW branches
// (kaizo/attacks/knight-stream.js — V-C recreation of EnderCat8's Kaizo
// Roaring Knight; type 103 / ac 107 "xattacks").
//
// Every assertion here is on something the kaizo deltas CHANGE, so the check
// fails if any new branch is deleted:
//   * the 5-pair cascade (20 streamlines/cycle, coincident i=0 pair, spacing
//     dist_diff*i) — vanilla fired 12 at fixed 60/120/180;
//   * the doubled sword spray (6 volleys, 72 swords/cycle, damage 153,
//     friction -0.8 acceleration, destroyonhit false) — vanilla: 3 volleys
//     of 36 diamonds at placeholder damage;
//   * the beam hitbox (armed at 52 from Create's 62, xscale 32 -> 64,
//     angle refreshed from the stale create-time 0) and its 3-frame damage
//     cadence via the global.inv = 2 override — vanilla beams were visuals;
//   * the 2px heart mask being tighter than the fight heart rect, and being
//     the EXTRACTED kaizo/data/masks.js object shared by reference with
//     swordfall.js / underbox.js rather than a third hand-built copy;
//   * the blue re-theme: beams at get_swordcolor() with a
//     merge_color(.., c_black, .5) inner layer (vanilla c_red / c_maroon),
//     spray swords at the c_gray TRIPLE, swordtype read live, zero RNG cost;
//   * the ±145 opening spread and the 170 angle-walk cap (vanilla 70);
//   * the Side-B fan (48/2f, cycle 42) actually differing from normal
//     (54/3f, cycle 45);
//   * the turn-end handshake (clock pinned at 16 while beams live, pose
//     reset + fly-back to the Knight at exactly 12).
//
//     node kaizo/tools/checks/check-knight-stream.mjs        exit 0 / 1

import { createState, stepFrame, spawn } from '../../../sim/index.js';
import { soul } from '../../../sim/soul.js';
import { HEART_RECT, masksOverlap } from '../../../sim/masks.js';
import { GRAY, BLACK, mergeColor } from '../../../sim/gml.js';
import {
  knightStream, bulletKnightStream, streamSword, streamHitbox,
  beamPlaceMeetingHeart, FINALSLASH_MASK, HEART_2PX_MASK,
  knightStreamline, streamDiamond,
} from '../../attacks/knight-stream.js';
import { kaizoMask } from '../../data/masks.js';
import { getSwordcolor } from '../../attacks/kaizo-colors.js';

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const F = Math.fround;

// ---------------------------------------------------------------- harness --

/** Minimal scene: a soul (no box, no knight unless asked) + the controller.
 *  invc 0.4 is the dispatch's own value for ac 107 (Other_23:571). */
function buildScene(seed, { sideb = false, knight = false } = {}) {
  const st = createState({ seed });
  st.invc = 0.4;
  st.kaizo = { sideb };
  st.soul = spawn(st, soul, { x: 310, y: 160 });
  if (knight) spawn(st, { name: 'obj_knight_enemy' }, { x: 500, y: 80 });
  const mg = spawn(st, knightStream, { x: 320, y: 60 });
  return { st, mg };
}

/** Step one frame, returning the entities spawned during it. */
function stepLogged(st, input = {}) {
  const before = st.nextSpawnSeq;
  stepFrame(st, input);
  return st.entities.filter((e) => e.seq >= before);
}

/** Spawn-log rows carry a POSITION SNAPSHOT: bullets move (and the culled
 *  ones freeze where they died), so geometry is asserted on where they were
 *  BORN, which is what the GML spawn expressions define. */
const logRow = (frame, e) => ({ frame, e, name: e.type.name, x: e.x, y: e.y });

const byName = (st, name) => st.entities.filter((e) => e.alive && e.type.name === name);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ============================================================ 1. base run --

{
  const { st, mg } = buildScene(7);

  // One frame: the init block and the per-frame damage pin (kaizo Step_0:3-15).
  stepLogged(st);
  check(mg.damage === 153, `controller damage pinned 153 (got ${mg.damage})`);
  check(mg.dist_diff === 54 && mg.time_diff === 3 && mg.slash_amt === 5,
    `init block 54/3/5 (got ${mg.dist_diff}/${mg.time_diff}/${mg.slash_amt})`);
  check(mg.fulltimer === 1 && mg.timer === 1, 'fulltimer/timer tick together at first');

  // The ±145 opening spread stays inside [-55, 235] on this seed.
  check(mg.slash_angle >= -55 && mg.slash_angle <= 235,
    `slash_angle ${mg.slash_angle} within the ±145 envelope`);

  // Walk to the first slash (controller timer 20).
  const spawnLog = []; // { frame, e, name, x, y } — x/y snapshotted at spawn
  let frame = 1;
  const logStep = () => {
    for (const e of stepLogged(st)) spawnLog.push(logRow(frame + 1, e));
    frame += 1;
  };
  while (mg.timer < 20) logStep();
  const F1 = frame; // frame index at which the controller's timer hit 20

  const beams = byName(st, 'obj_bullet_knight_stream');
  check(beams.length === 2, `two beams at timer 20 (got ${beams.length})`);
  const hitboxes = byName(st, 'obj_bullet_stream_hitbox');
  check(hitboxes.length === 2, `each beam spawned a hitbox (got ${hitboxes.length})`);
  for (const hb of hitboxes) {
    check(hb.damage === 62, `hitbox create damage 62 (got ${hb.damage})`);
    check(hb.image_xscale === 32 && hb.image_yscale === 0,
      `hitbox create scale 32 x 0 (got ${hb.image_xscale} x ${hb.image_yscale})`);
    check(hb.image_angle === 0,
      'hitbox create angle is the STALE 0 (spawner sets direction after create)');
    check(hb.destroyonhit === false && hb.wall_destroy === false && hb.timepoints === 0,
      'hitbox contract: no destroy-on-hit, wall-proof, timepoints 0');
    check(hb.active === false, 'hitbox active latch is false');
  }
  // The pose puppeteering at the slash (kaizo Step_0:22-30).
  check(mg.image_index === 3, `pose snapped to slash frame 3 (got ${mg.image_index})`);
  check(mg.imgtarget === 5 || mg.imgtarget === 1, `imgtarget armed (got ${mg.imgtarget})`);

  // ------------------------------------------------- cascade + spray + tick
  const hpSum = () => st.partyHp.reduce((a, b) => a + b, 0);
  const ticks = []; // { frame, invAfter }
  let prevHp = hpSum();
  const armedBeam = () => byName(st, 'obj_bullet_knight_stream')[0];

  // Pin the soul's CENTRE onto the first hitbox so the beam tick geometry is
  // guaranteed (the bar is centred there) — the check plays battlecontroller
  // and stands where it hurts.
  while (frame < F1 + 44) {
    const hb = byName(st, 'obj_bullet_stream_hitbox')[0];
    if (hb) { st.soul.x = hb.x - 10; st.soul.y = hb.y - 10; }
    logStep();
    const now = hpSum();
    if (now < prevHp) ticks.push({ frame, invAfter: st.invTimer });
    prevHp = now;
  }

  // CASCADE (kaizo Step_0:49-67): 5 pairs per beam at timers 22/25/28/31/34,
  // 20 streamlines total (vanilla: 12 at 23/26/29).
  const lines = spawnLog.filter((s) => s.name === 'obj_knight_streamline');
  check(lines.length === 20,
    `5-pair cascade spawned 20 streamlines in cycle 1 (got ${lines.length})`);
  const lineFrames = [...new Set(lines.map((s) => s.frame))].sort((a, b) => a - b);
  const wantFrames = [F1 + 2, F1 + 5, F1 + 8, F1 + 11, F1 + 14];
  check(JSON.stringify(lineFrames) === JSON.stringify(wantFrames),
    `cascade frames ${lineFrames} == timer 22+3i (${wantFrames})`);
  // i = 0 fires BOTH lines at offset 0 — coincident streamlines ON the
  // beams' shared spawn point (both beams sit at the same cross centre).
  const zeroPairs = lines.filter((s) => s.frame === F1 + 2);
  check(zeroPairs.length === 4, `i=0 double: 4 lines on the first cascade frame`);
  check(zeroPairs.every((s) => s.x === beams[0].x && s.y === beams[0].y),
    `i=0 pairs COINCIDENT with the cross centre (${beams[0].x}, ${beams[0].y})`);
  // i = 1 pair sits dist_diff = 54 from the centre (vanilla started at 60).
  const p54 = lines.filter((s) => s.frame === F1 + 5)
    .map((s) => dist(s, beams[0]));
  check(p54.length === 4 && p54.every((d) => Math.abs(d - 54) < 0.01),
    `i=1 streamlines at 54px (got ${p54.map((d) => d.toFixed(2))})`);

  // SPRAY (kaizo Step_0:69-104): volleys at beam timer 16/20/24/28/32/36 ->
  // frames F1+16..F1+36 step 4; 12 swords each, 72 per cycle (vanilla 36).
  const swords = spawnLog.filter((s) => s.name === 'obj_bullet_stream_sword');
  check(swords.length === 72, `doubled spray: 72 swords in cycle 1 (got ${swords.length})`);
  const volleyFrames = [...new Set(swords.map((s) => s.frame))].sort((a, b) => a - b);
  const wantVolleys = [16, 20, 24, 28, 32, 36].map((t) => F1 + t);
  check(JSON.stringify(volleyFrames) === JSON.stringify(wantVolleys),
    `volleys every 4th beam-frame ${volleyFrames} == ${wantVolleys}`);
  // dist_diff spacing along the perpendicular: consecutive same-side swords
  // spawn 54 apart (vanilla fixed 60). Spawn snapshots — the live ones move.
  const v0 = swords.filter((s) => s.frame === volleyFrames[0]);
  const gaps = [dist(v0[0], v0[1]), dist(v0[1], v0[2]), dist(v0[3], v0[4])];
  check(gaps.every((g) => Math.abs(g - 54) < 0.01),
    `sword spacing 54 from dist_diff (got ${gaps.map((g) => g.toFixed(2))})`);
  // Stats: 153 / graze 1 / time 0 / no destroy / friction -0.8 / sword sprite.
  for (const { e } of swords.slice(0, 12)) {
    check(e.damage === 153, `sword damage 153 (got ${e.damage})`);
    check(e.grazepoints === 1 && e.timepoints === 0, 'sword graze 1 / time 0');
    check(e.destroyonhit === false, 'sword destroyonhit false');
    check(e.friction === F(-0.8), `sword friction f32(-0.8) (got ${e.friction})`);
    check(e.sprite_index === 'spr_roaringknight_sword_ol', 'sword sprite swordol');
  }
  // friction -0.8 ACCELERATES: any sword alive 2+ motion frames runs > 15.
  const flying = byName(st, 'obj_bullet_stream_sword');
  check(flying.length > 0 && flying.some((e) => e.speed > 15.5),
    `negative friction accelerates the swords past 15 (max ${Math.max(0, ...flying.map((e) => e.speed)).toFixed(2)})`);

  // BEAM HITBOX armed (kaizo bullet Step_0:26-44): 52 over 62, xscale 64,
  // angle refreshed to the beam's real direction (not the stale 0).
  const hb = byName(st, 'obj_bullet_stream_hitbox')[0];
  const beam = armedBeam();
  check(hb.damage === 52, `armed hitbox damage 52 (got ${hb.damage})`);
  check(hb.image_xscale === 64, `armed hitbox xscale 64 (got ${hb.image_xscale})`);
  check(hb.image_yscale > 0 && hb.image_yscale <= F(2.3) + 1e-6,
    `armed hitbox yscale = min(width,23)/10 in (0, 2.3] (got ${hb.image_yscale})`);
  check(hb.image_angle === beam.direction && beam.direction !== 0,
    `armed hitbox angle tracks beam direction ${beam.direction} (got ${hb.image_angle})`);

  // THE 3-FRAME TICK (kaizo bullet Step_0:45-61): damage lands, then
  // global.inv = 2 — read after the soul's same-frame decrement as 1. The
  // vanilla path would leave invc*30 = 12 and a 13-frame gap.
  check(ticks.length >= 3, `beam ticked >= 3 times in cycle 1 (got ${ticks.length})`);
  const gaps3 = ticks.slice(1).map((t, i) => t.frame - ticks[i].frame);
  check(gaps3.every((g) => g === 3),
    `inv-2 override: consecutive ticks 3 frames apart (got ${gaps3})`);
  check(ticks.every((t) => t.invAfter === 1),
    `invTimer reads 2 - 1 = 1 at end of each tick frame (got ${ticks.map((t) => t.invAfter)})`);

  // Cycle restart (kaizo Step_0:68-76): timer 45 -> second beam pair 45
  // frames after the first, and the beams die at their timer 50 first.
  while (frame < F1 + 44) logStep();
  check(byName(st, 'obj_bullet_knight_stream').length === 2, 'first pair still alive at 44');
  while (frame < F1 + 45) logStep();
  const secondPair = spawnLog.filter((s) => s.name === 'obj_bullet_knight_stream' && s.frame > F1);
  check(secondPair.length === 2 && secondPair.every((s) => s.frame === F1 + 45),
    `normal cycle: second beam pair exactly 45 frames after the first`);
}

// ================================================= 2. angle-walk cap (170) --

{
  const { st, mg } = buildScene(11);
  stepFrame(st, {});
  while (mg.timer !== 44) stepFrame(st, {});
  mg.slash_angle = 100;
  stepFrame(st, {}); // timer -> 45: restart branch
  check(mg.timer === 0, 'restart reset the cycle timer');
  // 100 + 25 + irandom(25) = 125..150, all <= 170: KAIZO does NOT wrap.
  // Vanilla's 70-cap would have subtracted 40 (85..110 — disjoint).
  check(mg.slash_angle >= 125 && mg.slash_angle <= 150,
    `wrap threshold is 170, not 70: walked 100 -> ${mg.slash_angle} without the -40`);
}

// ============================================== 3. the ±145 opening spread --

{
  // Across seeds the opening angle must leave vanilla's [45, 135] envelope
  // (±45) while staying inside kaizo's [-55, 235]. One draw per create.
  let outside = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const st = createState({ seed });
    st.kaizo = { sideb: false };
    st.soul = spawn(st, soul, { x: 310, y: 160 });
    const mg = spawn(st, knightStream, { x: 320, y: 60 });
    check(mg.slash_angle >= -55 && mg.slash_angle <= 235,
      `seed ${seed}: slash_angle ${mg.slash_angle} inside [-55, 235]`);
    if (mg.slash_angle < 45 || mg.slash_angle > 135) outside += 1;
  }
  check(outside > 0,
    'the ±145 spread produces openings vanilla (±45) cannot (none seen in 24 seeds)');
}

// ============================================================= 4. Side B --

{
  const { st, mg } = buildScene(7, { sideb: true });
  stepFrame(st, {});
  check(mg.dist_diff === 48 && mg.time_diff === 2,
    `Side B init 48/2 (got ${mg.dist_diff}/${mg.time_diff})`);

  const spawnLog = [];
  let frame = 1;
  const logStep = () => {
    for (const e of stepLogged(st)) spawnLog.push(logRow(frame + 1, e));
    frame += 1;
  };
  while (mg.timer < 20) logStep();
  const F1 = frame;
  const beams = byName(st, 'obj_bullet_knight_stream');
  check(beams.length === 2, 'Side B: two beams');
  while (frame < F1 + 42) logStep();

  // Cascade at timer 22 + 2i -> frames F1+2/4/6/8/10, offsets 48*i.
  const lines = spawnLog.filter((s) => s.name === 'obj_knight_streamline');
  check(lines.length === 20, `Side B cascade still 5 pairs (got ${lines.length})`);
  const lineFrames = [...new Set(lines.map((s) => s.frame))].sort((a, b) => a - b);
  const wantFrames = [F1 + 2, F1 + 4, F1 + 6, F1 + 8, F1 + 10];
  check(JSON.stringify(lineFrames) === JSON.stringify(wantFrames),
    `Side B cascade every 2 frames ${lineFrames} == ${wantFrames}`);
  const p48 = lines.filter((s) => s.frame === F1 + 4)
    .map((s) => Math.min(...beams.map((b) => dist(s.e, b))));
  check(p48.length === 4 && p48.every((d) => Math.abs(d - 48) < 0.01),
    `Side B spacing 48 (got ${p48.map((d) => d.toFixed(2))})`);

  // Spray window < 37 keeps the SAME volley set (16..36 — kept verbatim per
  // the delta), and sword spacing follows dist_diff 48.
  const swords = spawnLog.filter((s) => s.name === 'obj_bullet_stream_sword');
  check(swords.length === 72, `Side B spray still 72 (window 37 passes 36) (got ${swords.length})`);
  const v0 = swords.filter((s) => s.frame === F1 + 16).map((s) => s.e);
  check(v0.length === 12 && Math.abs(dist(v0[0], v0[1]) - 48) < 0.01,
    'Side B sword spacing 48 from dist_diff');

  // Cycle 42: the second pair lands exactly 42 after the first (normal: 45).
  const secondPair = spawnLog.filter(
    (s) => s.name === 'obj_bullet_knight_stream' && s.frame > F1,
  );
  check(secondPair.length === 2 && secondPair.every((s) => s.frame === F1 + 42),
    `Side B cycle 42 (second pair at +${secondPair.map((s) => s.frame - F1)})`);
}

// ============================================ 5. the 2px heart mask bites --

{
  // A beam-shaped hitbox whose bar ends at y 111.5; a heart at y 110. The
  // fight heart RECT ([0..19]) overlaps rows 110-111; the 2px mask's ink
  // starts at heart.y + 4 = 114 — the kaizo beam misses where a vanilla
  // engine pairing would connect. Both sides of the discrimination are
  // asserted so deleting the mask swap fails loudly.
  const hb = { x: 100, y: 100, image_xscale: 64, image_yscale: 2.3, image_angle: 0 };
  const heart = { x: 90, y: 110 };
  check(beamPlaceMeetingHeart(hb, heart) === false,
    '2px mask: beam edge at 111.5 misses ink starting at 114');
  check(masksOverlap(HEART_RECT, heart.x, heart.y,
    FINALSLASH_MASK, hb.x, hb.y, hb.image_xscale, hb.image_yscale, hb.image_angle) === true,
    'the fight heart rect WOULD touch the same beam (the swap is load-bearing)');
  // And dead centre the 2px mask does connect.
  check(beamPlaceMeetingHeart(hb, { x: 90, y: 90 }) === true,
    '2px mask: a centred soul is hit');
  // The EXACT boundary: bar rows 88..111, ink starts heart.y + 4 — so 107
  // hits and 108 misses. Both sides asserted: ANY vertical shift of the
  // effective hurtbox flips one of these (this is what caught a sabotaged
  // +4px offset that every wider-margin fixture survived).
  check(beamPlaceMeetingHeart(hb, { x: 90, y: 107 }) === true,
    '2px boundary: heart.y 107 (ink row 111 = bar last row) HITS');
  check(beamPlaceMeetingHeart(hb, { x: 90, y: 108 }) === false,
    '2px boundary: heart.y 108 (ink row 112, past the bar) MISSES');
  check(HEART_2PX_MASK.bbox.join() === '4,4,15,15', '2px mask bbox is the inset heart');
  // ...and it is the EXTRACTED object, shared with swordfall.js and
  // underbox.js by reference, not a third hand-built look-alike.
  check(HEART_2PX_MASK === kaizoMask('spr_dodgeheart_smaller_2px_mask'),
    '2px mask IS kaizo/data/masks.js\'s extracted object (one shared definition)');
  check(!HEART_2PX_MASK.axisRect,
    'the extracted sprite is Precise — no axisRect, so it takes the precise sampler');
  {
    let solid = 0;
    for (const row of HEART_2PX_MASK.px) for (const p of row) if (p) solid += 1;
    check(solid === 100, `2px mask has the extraction's 100 inked pixels, got ${solid}`);
  }
}

// ======================================= 5b. the blue tint on the beams ----
//
// kaizo knight_stream Draw_0:26/35/41 recolors the beams' outer two layers
// (vanilla v105 Draw_0:25/31 drew them c_red and c_maroon) and the spray
// swords carry c_gray (bullet Step_0:85/99). Colour only — the same scene at
// the same seed must burn the same RNG.
{
  const { st, mg } = buildScene(3);
  const drawsBefore = () => st.gmlRng.draws ?? 0;
  let beams = [];
  let swords = [];
  let d0 = 0;
  for (let f = 0; f < 40; f++) {
    if (f === 0) d0 = drawsBefore();
    stepFrame(st, {});
    const b = st.entities.filter((e) => e.alive && e.type.name === 'obj_bullet_knight_stream');
    if (b.length) beams = b;
    const s = st.entities.filter((e) => e.alive && e.type.name === 'obj_bullet_stream_sword');
    if (s.length) swords = s;
  }
  const BLUE = getSwordcolor(st);
  const DS = mergeColor(BLUE, BLACK, 0.5);
  check(BLUE[0] === 0 && BLUE[1] === 0 && BLUE[2] === 255,
    `the default swordcolor is PURE BLUE (GML colours are BGR), got ${BLUE}`);
  check(beams.length === 2, `tint check found the cross's two beams (got ${beams.length})`);
  check(beams.length > 0 && beams.every((b) => b.image_blend === BLUE),
    'each beam line carries get_swordcolor() (kaizo Draw_0:35; vanilla c_red)');
  check(beams.length > 0 && beams.every((b) => String(b.blend2) === String(DS)),
    `the inner layer is merge_color(get_swordcolor(), c_black, 0.5) = ${DS} `
    + `(kaizo Draw_0:26/41; vanilla c_maroon), got ${beams[0] && beams[0].blend2}`);
  check(swords.length > 0 && swords.every((s) => s.image_blend === GRAY),
    'the spray swords carry the c_gray TRIPLE, not the string \'c_gray\' '
    + '(kaizo bullet Step_0:85/99 — a string is not a colour any renderer can tint with)');
  check(mg.alive && drawsBefore() > d0, 'the tint scene really ran (RNG advanced)');

  // The tint reads the live setting; swordtype 2 is #657AFF.
  const alt = buildScene(3);
  alt.st.kaizo.swordtype = 2;
  let altBeam = null;
  for (let f = 0; f < 40; f++) { // SAME frame count as the run above — the
    stepFrame(alt.st, {});        // draw-budget comparison below depends on it
    altBeam = alt.st.entities.find((e) => e.alive
      && e.type.name === 'obj_bullet_knight_stream' && e.image_blend) ?? altBeam;
  }
  check(altBeam && String(altBeam.image_blend) === '101,122,255',
    `swordtype 2 must tint 101,122,255 (16743013 read BGR), got ${altBeam && String(altBeam.image_blend)}`);
  // ...and the whole colour path costs NOTHING in the stream.
  check((alt.st.gmlRng.draws ?? 0) > 0 && (alt.st.gmlRng.draws ?? 0) === (st.gmlRng.draws ?? 0),
    `get_swordcolor consumes no RNG — both swordtypes burn the same (non-zero) draws, `
    + `got ${alt.st.gmlRng.draws} vs ${st.gmlRng.draws}`);
}

// ================================================= 6. turn-end handshake --

{
  const { st, mg } = buildScene(7, { knight: true });
  const knight = st.entities.find((e) => e.type.name === 'obj_knight_enemy');
  stepFrame(st, {});
  while (mg.timer < 25) stepFrame(st, {}); // beams alive (their timer 5)
  check(byName(st, 'obj_bullet_knight_stream').length === 2, 'handshake: beams up');

  // The turn runs down: the check plays battlecontroller (decrement 1/frame
  // BEFORE the step, the clock the controller then reads and pins).
  st.turntimer = 10;
  let pinnedFrames = 0;
  while (byName(st, 'obj_bullet_knight_stream').length > 0) {
    st.turntimer -= 1;
    stepFrame(st, {});
    // THE FRAME THE LAST BEAM DIES IS NOT A PINNED FRAME, and asserting that
    // is stronger than the blanket `=== 16` this used to carry.
    // obj_bullet_knight_stream is object index 140 and obj_knight_stream is
    // 1688, so the beams run their Step -- and destroy themselves in it --
    // BEFORE the manager's `if (i_ex(obj_bullet_knight_stream))` handshake
    // ever looks. On the release frame the manager therefore sees NONE and
    // leaves the clock alone. The old assertion only passed because the sim
    // stepped the manager first (creation order, manager older), which is the
    // fault the whole-fight gate caught at f8776: with the manager early its
    // `slash_angle += 25 + irandom(25)` also drew AHEAD of the beams'
    // scr_damage, and the next volley came out at 10/170 where the recording
    // has 20/160.
    const beamsAfter = byName(st, 'obj_bullet_knight_stream').length;
    if (beamsAfter > 0) {
      check(st.turntimer === 16, `clock pinned at 16 while beams live (got ${st.turntimer})`);
    } else {
      check(st.turntimer === 15, `clock released on the frame the last beam dies (got ${st.turntimer})`);
    }
    pinnedFrames += 1;
    if (pinnedFrames > 60) break;
  }
  check(pinnedFrames >= 5 && pinnedFrames <= 60, `pin held ${pinnedFrames} frames, then released`);

  // No NEW beams once the clock is at 16: the restart gate needs > 16.
  const beamsSoFar = st.entities.filter((e) => e.type.name === 'obj_bullet_knight_stream').length;

  // Clock decrements freely now; at exactly 12 the pose resets and the body
  // flies home over 11 frames (ease-out, power 2 — lands EXACTLY on the
  // knight, lerp t = 11/11).
  let recallFrame = -1;
  for (let i = 0; i < 30 && recallFrame < 0; i++) {
    st.turntimer -= 1;
    stepFrame(st, {});
    if (mg.imgtarget === -1 && mg.image_index === 0) recallFrame = i;
  }
  check(recallFrame >= 0, 'recall fired at turntimer == 12 (pose 0, imgtarget -1)');
  for (let i = 0; i < 12; i++) { st.turntimer -= 1; stepFrame(st, {}); }
  check(mg.x === F(500) && mg.y === F(80),
    `fly-back landed on the knight (got ${mg.x}, ${mg.y})`);
  check(byName(st, 'obj_bullet_knight_stream').length === 0
    && st.entities.filter((e) => e.type.name === 'obj_bullet_knight_stream').length === beamsSoFar,
    'no new beam pair while the clock sat at/below 16');
  // The beams' death also swept their hitboxes (the new CleanUp).
  check(byName(st, 'obj_bullet_stream_hitbox').length === 0,
    'CleanUp destroyed the hitboxes with their beams');
}

// ------------------------------------------------------------------ report

// Import parity: the launcher swaps only the import source.
check(typeof knightStreamline === 'object' && typeof streamDiamond === 'object'
  && typeof bulletKnightStream === 'object' && typeof knightStream === 'object'
  && typeof streamSword === 'object' && typeof streamHitbox === 'object',
  'module exports the sim symbol set plus the kaizo types');

if (fails.length) {
  console.log(`check-knight-stream: ${fails.length} FAILURE(S)\n`);
  for (const f of fails) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('check-knight-stream: all positive assertions on the kaizo branches pass');
process.exit(0);
