#!/usr/bin/env node
// KAIZO gate — run with `npm run verify:kaizo`.
//
// DELIBERATELY OUTSIDE tools/: verify-all.mjs registers only tools/verify-*.mjs,
// so this suite can never leak into the main health check, and the main check
// can never depend on kaizo/. Keep it that way (kaizo/HANDOFF.md §2).
//
// What this asserts (K3 level — the schedule is LIVE):
//   1. kaizo/ imports cleanly against the current sim/ API.
//   2. Every KAIZO_TABLE row points at an attack the sim actually has, at a
//      difficulty some suite verifies (the table below is the authority —
//      extend it only together with the suite that pins the new value).
//   3. The kaizo scene steps deterministically: two runs, same seed,
//      byte-identical traces; a different seed differs (non-vacuous).
//   4. FIGHT-ORDER ANALOG (tools/verify-fight-order.mjs's shape): the kaizo
//      table is what ACTUALLY runs — asserted against state.kaizo.launched,
//      the turn loop's launch ledger, not the HUD label. Every phase-1..3
//      turn launches, in order, at the table's difficulty, none hangs, and
//      every turn puts bullets on screen.
//   5. PHASE-4 GATE ANALOG: driving the Knight's HP to 5840 opens phase 4 on
//      the rotating slash, runs Charge-up then ROARING, falls back to phase 3,
//      and never re-enters (haveusedroaring is one-shot).
//   6. COVERAGE ANALOG (verify-damage + verify-contact-coverage's shape):
//      every unique (ac, difficulty) the kaizo table schedules can actually
//      hit a moving soul, and none of its inherit-gated bullets still holds
//      scr_bullet_init's placeholder damage — the `scr_bullet_inherit` trap
//      (CLAUDE.md) is exactly the bug this catches.
//   7. Positive assertions throughout — frames stepped, launches recorded,
//      checks counted (a suite of silent no-ops must not read as green).

import { createState, stepFrame } from '../../sim/index.js';
import { buildKaizoScene, KAIZO_TABLE, KAIZO_VERSIONS, KAIZO_NOTE } from '../scenes/kaizo-fight.js';
import { freshParty, scrDamageCalculation } from '../../sim/damage.js';
import { buildSingleAttackScene, ATTACK_MENU } from '../../sim/scenes/single.js';
import { collidebulletOther15 } from '../../sim/bullets/regularbullet.js';

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

// ── 2: table shape ─────────────────────────────────────────────────────────
// ac -> max difficulty a suite verifies today. -1 is the charge-up beat.
// RAISE A CAP ONLY TOGETHER WITH THE SUITE THAT PINS THE NEW VALUE.
const VERIFIED_MAX_DIFFICULTY = {
  [-1]: 1,
  0: 0, 1: 2, 2: 3, 3: 0, 4: 0, 5: 2, 6: 0, 7: 0,
  9: 0, 10: 0, 13: 4, 14: 0, 15: 0, 20: 0,
};

const rows = Object.values(KAIZO_TABLE).flat();
ok(rows.length > 0, `KAIZO_TABLE has rows (${rows.length})`);
for (const r of rows) {
  const max = VERIFIED_MAX_DIFFICULTY[r.ac];
  ok(max !== undefined, `ac ${r.ac} (${r.name}) is a known attack`);
  if (max !== undefined) {
    ok(r.difficulty <= max,
      `ac ${r.ac} (${r.name}) difficulty ${r.difficulty} <= verified max ${max}`);
  }
}
ok(!!KAIZO_VERSIONS.A && KAIZO_VERSIONS.A.table === KAIZO_TABLE, 'version A registered');
ok(/KAIZO/.test(KAIZO_NOTE) && /NOT the real fight/i.test(KAIZO_NOTE),
  'the player-facing note says KAIZO and disclaims authenticity');

// ── shared driver ──────────────────────────────────────────────────────────
// The scene cannot advance on idle input (the menu is part of the turn), so
// this pulses confirm exactly the way tools/verify-fight-order.mjs does —
// edge-triggered, pressed on alternate calls. Idle input parks the fight at
// the opening dialogue and proves nothing.
const idle = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};
function makeMenuInput() {
  let pulse = false;
  return (state) => {
    if (!state.menu?.open && !state.dialogue?.text && !state.pendingAct) return idle;
    pulse = !pulse;
    return { ...idle, confirm: pulse };
  };
}

// ── 3: determinism ─────────────────────────────────────────────────────────
const FRAMES = 900;
function run(seed) {
  const state = createState({ seed, traceBulletSlots: 8 });
  state.traceWide = true;
  buildKaizoScene(state, { version: 'A' });
  const input = makeMenuInput();
  for (let i = 0; i < FRAMES; i++) stepFrame(state, input(state));
  return state;
}
const a = run(12345);
const b = run(12345);
ok(a.kaizo && a.kaizo.version === 'A', 'scene carries the kaizo marker');
ok(a.kaizo.scheduleActive === true, 'the kaizo schedule is live (K3 landed)');
ok(a.kaizo.launched.length > 0,
  `the ledger recorded launches within ${FRAMES} frames (${a.kaizo.launched.length})`);
ok(a.frame === FRAMES && b.frame === FRAMES, `both runs stepped ${FRAMES} frames`);
const ta = a.trace.join('\n');
const tb = b.trace.join('\n');
ok(ta.length > 0, `trace is non-empty (${a.trace.length} rows)`);
ok(ta === tb, 'two runs, same seed: byte-identical');
const c = run(54321);
ok(c.trace.join('\n') !== ta, 'different seed: different trace (non-vacuous)');

// ── 4: fight-order analog — THE TABLE IS WHAT RUNS ─────────────────────────
// Phases 1..3 flattened; phase 4 is reached by DAMAGE, not by counting turns,
// and gets its own scenario below — same split as verify-fight-order.
const EXPECTED = [
  ...KAIZO_TABLE[1].map((t) => ({ phase: 1, ...t })),
  ...KAIZO_TABLE[2].map((t) => ({ phase: 2, ...t })),
  ...KAIZO_TABLE[3].map((t) => ({ phase: 3, ...t })),
];
const MAX_FRAMES = 30000;
// A hang-catcher, not a length police: the combination chains three whole
// attacks and legitimately runs long. Everything else is far under this.
const TURN_LIMIT = 2600;

{
  const st = createState({ seed: 12345, traceBulletSlots: 0 });
  buildKaizoScene(st, { version: 'A' });
  const input = makeMenuInput();

  let last = null;
  let turnStart = 0;
  let bulletsThisTurn = 0;
  let peakBullets = 0;
  const turnFailures = [];
  const arenas = new Set();
  const labels = [];

  for (let f = 0; f < MAX_FRAMES && st.kaizo.launched.length <= EXPECTED.length; f++) {
    stepFrame(st, input(st));
    // Kept alive on purpose: this is a turn-ORDER question, not a survival
    // one — the kaizo schedule wipes an idle party even faster than the
    // real one does. verify-damage's analog below is where damage matters.
    st.partyHp = freshParty();
    st.gameOver = false;

    const live = st.entities.filter(
      (e) => e.alive && e.isBullet && e.type.name !== 'obj_heart',
    ).length;
    if (live > peakBullets) peakBullets = live;
    if (live > bulletsThisTurn) bulletsThisTurn = live;

    const gt = st.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
    if (gt) arenas.add(`${gt.x},${gt.y},${gt.image_xscale},${gt.image_yscale}`);

    if (st.phase !== last) {
      if (last !== null) {
        const took = f - turnStart;
        if (took > TURN_LIMIT) {
          turnFailures.push(`turn "${last}" took ${took} frames (limit ${TURN_LIMIT})`);
        }
        // The charge-up (ac -1) deliberately puts NOTHING on screen — no
        // arena, no bullets — and never appears in phases 1..3 anyway.
        if (bulletsThisTurn === 0 && !/Charge-up/.test(last)) {
          turnFailures.push(`turn "${last}" put NOTHING on screen`);
        }
      }
      labels.push(st.phase);
      last = st.phase;
      turnStart = f;
      bulletsThisTurn = 0;
    }
  }

  const led = st.kaizo.launched;
  ok(led.length >= EXPECTED.length,
    `all ${EXPECTED.length} phase-1..3 turns launched within ${MAX_FRAMES} frames `
    + `(${led.length} launches)`);
  let orderOk = led.length >= EXPECTED.length;
  for (let i = 0; i < Math.min(led.length, EXPECTED.length); i++) {
    const want = EXPECTED[i];
    const got = led[i];
    if (got.phase !== want.phase || got.ac !== want.ac
      || got.difficulty !== want.difficulty) {
      orderOk = false;
      ok(false, `launch ${i + 1}: expected phase ${want.phase} ac ${want.ac} `
        + `d${want.difficulty} (${want.name}), got phase ${got.phase} `
        + `ac ${got.ac} d${got.difficulty} (${got.name})`);
      break;
    }
  }
  ok(orderOk, 'the launch ledger matches KAIZO_TABLE row for row — '
    + 'the kaizo table is what actually runs');
  ok(labels.every((l) => l.startsWith('KAIZO')),
    'every turn label carries the KAIZO prefix (nothing invented ships unlabelled)');
  for (const f of turnFailures) ok(false, f);
  if (!turnFailures.length) {
    ok(true, `no turn hung (limit ${TURN_LIMIT}) and every turn put bullets on screen`);
  }
  // Kaizo moves the arena MORE than the real fight (Swordslash's slot, the
  // stream's 3.5x, the tunnel's 3x, knightlines' slide, Stars' drag...).
  ok(arenas.size >= 4 && peakBullets >= 20,
    `execution: ${arenas.size} distinct arena setups, peak ${peakBullets} bullets alive`);
}

// ── 5: phase-4 gate analog — reached by DAMAGE ─────────────────────────────
{
  const g = createState({ seed: 12345, traceBulletSlots: 0 });
  buildKaizoScene(g, { version: 'A' });
  const input = makeMenuInput();
  const seen = [];
  let prev = null;
  let gated = false;

  for (let f = 0; f < MAX_FRAMES && seen.length < 24; f++) {
    stepFrame(g, input(g));
    g.partyHp = freshParty();
    g.gameOver = false;
    // Held one point above the threshold until the fight is under way, so the
    // test measures the gate and not the starting HP. The gate trips at the
    // end of ANY turn once HP <= 5840.
    if (!gated && seen.length >= 6) {
      g.knight.hp = 5840;
      gated = true;
    } else if (!gated) {
      g.knight.hp = 5841;
    }
    if (g.phase !== prev) {
      seen.push(g.phase);
      prev = g.phase;
    }
  }

  const idx4 = seen.findIndex((t) => t.includes('phase 4'));
  ok(idx4 >= 0, 'phase 4 opened after HP hit 5840');
  if (idx4 >= 0) {
    // The gate trips long before phase 3's last turn, so rotatingslash3used
    // is false and phase 4 must open on its FIRST row (phase4Entry(false)).
    ok(seen[idx4].endsWith(KAIZO_TABLE[4][0].name),
      `phase 4 opened on "${seen[idx4]}" (wanted row 1, ${KAIZO_TABLE[4][0].name})`);
    ok(!!seen[idx4 + 1] && seen[idx4 + 1].endsWith(KAIZO_TABLE[4][1].name),
      `phase 4 turn 2 was "${seen[idx4 + 1]}" (wanted ${KAIZO_TABLE[4][1].name})`);
    ok(!!seen[idx4 + 2] && seen[idx4 + 2].endsWith(KAIZO_TABLE[4][2].name),
      `phase 4 turn 3 was "${seen[idx4 + 2]}" (wanted ${KAIZO_TABLE[4][2].name})`);
    ok(!!seen[idx4 + 3] && seen[idx4 + 3].includes('phase 3'),
      `after ROARING the fight fell back to phase 3 (got "${seen[idx4 + 3]}")`);
    ok(!seen.slice(idx4 + 3).some((t) => t.includes('phase 4')),
      'the gate is one-shot: no second phase 4 despite HP staying under 5840');
  }
}

// ── 6: coverage analog — every kaizo (ac, difficulty) hits and hurts ───────
// verify-contact-coverage's circling soul + verify-damage's placeholder scan,
// run per unique kaizo pair through the single-attack scene (same launch path
// the fight uses — launchAttack by ac).
const PLACEHOLDER = 10;
// Legitimate placeholder carriers, with the dump citation — copied from
// tools/verify-damage.mjs. The x-attack's diamonds REALLY do 10: nothing in
// the chain (type 103 inherits from a damage=-1 sentinel; scr_fire_bullet is
// called without the inherit arg) ever assigns them a damage value. Kaizo
// v-A ships real-game content only, so it keeps the real number.
const EXPECTED_PLACEHOLDER = new Set(['obj_bullet_stream_diamond']);

function circling(f) {
  const i = { ...idle };
  const leg = Math.floor(f / 20) % 4;
  if (leg === 0) i.right = true;
  else if (leg === 1) i.down = true;
  else if (leg === 2) i.left = true;
  else i.up = true;
  return i;
}

const byAc = new Map(ATTACK_MENU.map((m) => [m.ac, m]));
const pairs = [...new Map(
  rows.filter((r) => r.ac !== -1)
    .map((r) => [`${r.ac}/${r.difficulty}`, r]),
).values()];

const COVER_FRAMES = 700;
for (const pair of pairs) {
  const menu = byAc.get(pair.ac);
  ok(!!menu, `ac ${pair.ac} (${pair.name}) exists in SINGLE's attack menu`);
  if (!menu) continue;
  ok(menu.difficulties.includes(pair.difficulty),
    `${menu.id} offers difficulty ${pair.difficulty} `
    + '(buildSingleAttackScene would silently clamp anything else)');

  const st = createState({ seed: 909, traceBulletSlots: 0 });
  st.damageEnabled = false; // the recorder pattern — count contact, keep the party up
  buildSingleAttackScene(st, { seed: 909, attack: menu.id, difficulty: pair.difficulty });

  const seenDmg = new Map();
  for (let f = 0; f < COVER_FRAMES; f++) {
    stepFrame(st, circling(f));
    for (const e of st.entities) {
      if (!e.alive || e.type?.other15 !== collidebulletOther15) continue;
      if (!seenDmg.has(e.type.name)) seenDmg.set(e.type.name, e.damage);
    }
  }
  const cnt = st.counters;
  ok((cnt.unmaskedBullets ?? 0) === 0,
    `${menu.id} d${pair.difficulty}: no bullet-frames without a mask`);
  ok(cnt.collisionChecks > 0 && cnt.collisionHits > 0,
    `${menu.id} d${pair.difficulty}: connects against a circling soul `
    + `(${cnt.collisionChecks} checks, ${cnt.collisionHits} hits)`);
  for (const [name, dmg] of seenDmg) {
    const bad = dmg === undefined
      || (dmg === PLACEHOLDER && !EXPECTED_PLACEHOLDER.has(name));
    const lands = dmg === undefined
      ? 'NaN'
      : Math.max(1, scrDamageCalculation(dmg, 0, true, st));
    ok(!bad, `${menu.id} d${pair.difficulty} / ${name}: damage=${dmg} -> lands ${lands}`
      + (bad ? ' — PLACEHOLDER, missing scr_bullet_inherit' : ''));
  }
}

// ═══ V-C: the mod recreation (KAIZO: ORACLE) ═══════════════════════════════
// Publish-gated content (HANDOFF §5-C) — these checks run locally only and
// skip cleanly when the generated script is absent.

const { KAIZO_VERSIONS: KV } = await import('../scenes/kaizo-fight.js');
if (KV.C) {
  const { VC_TABLE, VC_KNIGHT, VC_GATE_FRACTION, VC_PHASE4_DEFAULT } = await import('../versions/vc-script.js');

  // ── shape: every row is complete ─────────────────────────────────────────
  const vcRows = Object.values(VC_TABLE).flat();
  ok(vcRows.length === 31,
    `V-C table carries the mod's 27 chain rows + 4 phase-4 rows (${vcRows.length})`);
  ok(vcRows.every((r) => r.id && r.ac !== null && r.phase >= 1 && r.name),
    'every V-C row has id/ac/phase/name');

  // ── chain integrity vs the research extraction (local machines only) ─────
  {
    const { existsSync, readFileSync } = await import('node:fs');
    const { homedir } = await import('node:os');
    const { join } = await import('node:path');
    const src = join(homedir(), 'knight-research', 'kaizo-mod', 'fight-script.json');
    if (existsSync(src)) {
      const fsj = JSON.parse(readFileSync(src, 'utf8'));
      const chainRows = [...VC_TABLE[1], ...VC_TABLE[2], ...VC_TABLE[3]].map((r) => r.id);
      ok(chainRows.join('|') === fsj.mainChain.join('|'),
        'V-C phases 1-3 equal the mod\'s nextAttack chain, in order');
      const p4 = VC_TABLE[4].map((r) => r.id).join('|');
      ok(p4 === 'atk_Starstorm4Final|atk_Multislash3Final|atk_KnightGlow|atk_RoaringDelta',
        `V-C phase 4 is the mod's finale chain (${p4})`);
      const drift = vcRows.filter((r) => {
        const s = fsj.structs[r.id];
        return s && (s.ac !== r.ac || (s.difficulty ?? 0) !== r.difficulty);
      });
      ok(drift.length === 0,
        `no V-C row drifted from the dump's structs (${drift.length} drifted)`);
    } else {
      console.log('  --  research extraction absent; chain-integrity checks skipped');
    }
  }

  // ── fight-order analog: the chain actually runs, every turn armed ────────
  {
    const st = createState({ seed: 12345, traceBulletSlots: 0 });
    buildKaizoScene(st, { version: 'C' });
    const input = makeMenuInput();
    const CHAIN = 27;
    let last = null;
    let curPeak = 0;
    const emptyTurns = [];
    for (let f = 0; f < 45000 && st.kaizo.launched.length <= CHAIN; f++) {
      stepFrame(st, input(st));
      st.partyHp = freshParty();
      st.gameOver = false;
      const live = st.entities.filter(
        (e) => e.alive && e.isBullet && e.type.name !== 'obj_heart',
      ).length;
      if (live > curPeak) curPeak = live;
      if (st.phase !== last) {
        if (last !== null && curPeak === 0) emptyTurns.push(last);
        last = st.phase;
        curPeak = 0;
      }
    }
    const led = st.kaizo.launched;
    ok(led.length >= CHAIN, `all ${CHAIN} chain rows launched (${led.length})`);
    const chainIds = [...VC_TABLE[1], ...VC_TABLE[2], ...VC_TABLE[3]];
    let orderOk = led.length >= CHAIN;
    for (let i = 0; i < Math.min(led.length, CHAIN); i++) {
      if (led[i].ac !== chainIds[i].ac || led[i].difficulty !== chainIds[i].difficulty) {
        orderOk = false;
        ok(false, `V-C launch ${i + 1}: expected ${chainIds[i].id} `
          + `(ac ${chainIds[i].ac} d${chainIds[i].difficulty}), got ac ${led[i].ac} d${led[i].difficulty}`);
        break;
      }
    }
    ok(orderOk, 'the V-C launch ledger walks the mod\'s chain row for row');
    ok(emptyTurns.length === 0,
      `every V-C turn put bullets on screen${emptyTurns.length ? ` (EMPTY: ${emptyTurns.join(', ')})` : ''}`);
    // The approx ledger: structural sanity + the honest report.
    ok(st.kaizo.approx.every((a) => a.why !== 'unknown type'),
      'no V-C launch hit an unknown controller type');
    console.log(`  --  V-C approx ledger (${st.kaizo.approx.length} rows pending translation):`);
    const seenApprox = new Set();
    for (const a of st.kaizo.approx) {
      const key = `${a.row} type ${a.type}: ${a.asked} -> ${a.used}`;
      if (seenApprox.has(key)) continue;
      seenApprox.add(key);
      console.log(`        ${key}`);
    }
  }

  // ── the 60% gate: dynamic entry, finale chain, resume-REPLAY ─────────────
  {
    const g = createState({ seed: 12345, traceBulletSlots: 0 });
    buildKaizoScene(g, { version: 'C' });
    const input = makeMenuInput();
    const gateAt = VC_KNIGHT.maxhp * VC_GATE_FRACTION;
    const seen = [];
    let prev = null;
    let gated = false;
    let interruptedTurn = null;
    for (let f = 0; f < 45000 && seen.length < 16; f++) {
      stepFrame(g, input(g));
      g.partyHp = freshParty();
      g.gameOver = false;
      if (!gated && seen.length >= 6) {
        g.knight.hp = gateAt;
        gated = true;
        interruptedTurn = g.phase;
      } else if (!gated) {
        g.knight.hp = gateAt + 1;
      }
      if (g.phase !== prev) {
        seen.push(g.phase);
        prev = g.phase;
      }
    }
    const idx4 = seen.findIndex((t) => t.includes('phase 4'));
    ok(idx4 >= 0, `V-C phase 4 opened once HP hit ${gateAt} (60% of ${VC_KNIGHT.maxhp})`);
    if (idx4 >= 0) {
      // kaizo_phase4 has not been reassigned this early, so the entry is the
      // default node.
      ok(seen[idx4].includes('Starstorm 4'),
        `the gate entered at the default kaizo_phase4 node (${VC_PHASE4_DEFAULT}): "${seen[idx4]}"`);
      ok(!!seen[idx4 + 1] && seen[idx4 + 1].includes('Multislash 3'),
        `finale turn 2: "${seen[idx4 + 1]}"`);
      ok(!!seen[idx4 + 2] && seen[idx4 + 2].includes('Suspense'),
        `finale turn 3 (KnightGlow charge-up): "${seen[idx4 + 2]}"`);
      ok(!!seen[idx4 + 3] && seen[idx4 + 3].includes('Roaring DELTA'),
        `finale turn 4: "${seen[idx4 + 3]}"`);
      // AfterFinal -> kaizo_resumeAT: the INTERRUPTED row replays.
      const resumed = seen[idx4 + 4];
      const interruptedName = (interruptedTurn ?? '').split('·').pop()?.trim();
      ok(!!resumed && !!interruptedName && resumed.includes(interruptedName),
        `after the finale the interrupted row REPLAYS ("${resumed}" vs interrupted "${interruptedTurn}")`);
      ok(!seen.slice(idx4 + 4).some((t) => t.includes('phase 4')),
        'the V-C gate is one-shot (haveusedroaring)');
    }
  }

  // ── determinism, both mod versions ───────────────────────────────────────
  for (const ver of ['C', 'D']) {
    const runV = (seed) => {
      const s2 = createState({ seed, traceBulletSlots: 8 });
      s2.traceWide = true;
      buildKaizoScene(s2, { version: ver });
      const inp = makeMenuInput();
      for (let i = 0; i < 900; i++) stepFrame(s2, inp(s2));
      return s2.trace.join('\n');
    };
    const va = runV(12345);
    ok(va.length > 0 && va === runV(12345), `V-${ver}: same seed, byte-identical`);
    ok(runV(54321) !== va, `V-${ver}: different seed, different trace`);
  }
}

// ═══ PER-MODULE CHECKS (kaizo/tools/checks/check-*.mjs) ════════════════════
// Each translated attack module ships a check of POSITIVE assertions on the
// branches it added. Running them here makes them part of the gate rather
// than something an author ran once.
//
// WIRED is the set the V-C launcher actually imports. A wired module's check
// MUST pass — it is live content. An unwired module is work in progress:
// its check is reported, not enforced, because nothing depends on it yet.
// Moving a name into WIRED and swapping the launcher's import are the same
// commit, by construction.
{
  const { readdirSync, existsSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');

  const WIRED = new Set([
    'check-flurry', 'check-knight-stream', 'check-rotating-slash',
    'check-stars', 'check-sword-vortex', 'check-tracking-swords',
    'check-underbox', 'check-swordfall', 'check-knightlines',
    'check-sword-tunnel', 'check-quickslash', 'check-roaring-final',
    // WIRED 2026-09-03, the day the bug it guards was found. The REVISED
    // tunnel had no module-level check at all -- only check-oracle-tunnel,
    // which is recording-driven and sets damageEnabled = false for oracle
    // parity. obj_collidebullet's Other_15 returns on that flag ABOVE its
    // `if (destroyonhit) instance_destroy()`, so a blade wrongly dying on
    // contact was STRUCTURALLY INVISIBLE to it, and stayed invisible for
    // 6,631 frames of the byte gate. check-tunnel-blade runs the same
    // collision with damage ON. Deterministic, no recording, milliseconds.
    'check-tunnel-blade',
    // WIRED 2026-08-29, in the commit that routed dc.type 105. Before it the
    // launcher's case 105 called sim/attacks/combination.js and this check
    // covered a module nothing on the shipped path reached; now case 105
    // calls launchKaizoCombination and installs the comboChainNext hook, so
    // every assertion here is about code the launcher runs. Deterministic,
    // needs no recording, well under a second.
    //
    // It is NOT an oracle check (no recording), so it belongs here and not in
    // sabotage-oracle-checks.mjs's families — that harness scans this Set for
    // /check-oracle-[a-z0-9-]+/ only, so this name is invisible to it by
    // construction and it will not start demanding a sabotage case.
    'check-combination',
    // Not an attack: the sprite overlay and its publish gate. Enforced
    // because a missing sprite is INVISIBLE to every other check here — the
    // renderer silently falls back to drawing collision masks, so the art
    // being wrong looks exactly like the art being fine.
    'check-sprites',
    // WIRED 2026-09-08. The three attack colours no recording can settle
    // (the recorder logs no draw field, the byte gate has no r/g/b, sprite or
    // depth column): Tunnel 2's blades fade to BLUE (diamondswordbullet_ext
    // Step_0:4-5, ghosts c_blue), Starstorm 4's vortex swords wear
    // spr_roaringknight_sword_ol_alt at cone.depth - 1 on a sha1-identical
    // mask (sword_vortex Step_0:3-5), and every rotating-slash aim bloom is
    // navy (knight_circle Create_0:2-4). Each ramp is pinned numerically to
    // the GML constant with a vanilla control, and the swapped sword's
    // contact test is proved equal to the engine's on a 6,027-cell grid.
    // Deterministic, no recording, well under a second; sabotage-tested
    // (each delta flipped back to vanilla reddens it).
    'check-colours',
    // THE WEIRD ROUTE (V-D). The roster is wired into KAIZO_VERSIONS.D, so
    // its checks are live content, not work in progress: check-roster covers
    // Noelle and the two-slot party, check-weirdroute the B-Side schedule
    // and the invc 0.7 cap. check-freeze and check-gloom are enforced too —
    // their mechanics are not yet driven per-frame by the scene, but the
    // modules ARE imported by the wired party layer, so a regression in them
    // is a regression in something shipped.
    'check-roster', 'check-weirdroute', 'check-freeze', 'check-gloom',
    // WIRED 2026-09-08 with the party layer's arrival on the live path: the
    // damage / balloon / charbox / turn-end seams are consulted by a V-D
    // scene built through buildKaizoScene and stepped through the real turn
    // loop, so every assertion here is about the fight a player gets at
    // ?v=D, not about a module called by hand. V-C is the control in each
    // block. Deterministic, no recording, seconds.
    'check-weirdroute-live',
    // WIRED 2026-09-08 (lane W2): Noelle's menu, spells, ACTs and X-Slash on
    // V-D, through the engine's CHARACTER-TABLE seam (sim/spells.js
    // spellInfo / spellListFor / actsFor, `state.kaizo.hooks.*`) that
    // kaizo/party/spells.js fills from the roster. check-noelle-menu drives
    // sim/menu.js's stepMenu with inputs and asserts the rows, costs and
    // acting pages against the GML constants; check-spells-kaizo casts
    // IceShock through the live V-D loop (menu -> attackpress delay -> the
    // seam -> obj_icespell -> the Knight's HP) and pins Heal Prayer x5,
    // SleepMist, SnowGrave's hand-off to scenes.js, the ThornRing tick and
    // the X-Slash two-hit alarm chain. Both refuse to pass with the seam
    // removed (the vendored sim/menu.js imports it), and both went red under
    // a constant sabotage (alarm 14 -> 13, divisor 9.5 -> 9, the X-Slash
    // row dropped). Deterministic, no recording, seconds.
    'check-noelle-menu', 'check-spells-kaizo',
    // WIRED 2026-09-10, the round that landed them. Eight checks were written,
    // passed, and left unenforced — which in this launcher means they RUN and
    // are REPORTED and `npm run verify:kaizo` exits 0 with any of them red.
    // That is the same shape as the four idlesprite writes and the vertical
    // splitter: work that exists and guards nothing. Two reviewers and the
    // round's critic all raised it independently, so it is closed here rather
    // than carried again.
    //
    // What each one stands over, and why it is safe to enforce (all are
    // deterministic, need no recording, and run in seconds):
    //   check-heroes-draw          the party is DRAWN at all — obj_heroparent's
    //                              Draw deltas, the gloom tint and the frozen
    //                              statue, against a stub canvas.
    //   check-tensionbar-draw      the B-Side sliced bar, its +32 readout drop
    //                              and the shard bleed, asserted against the
    //                              renderer's own fill expression rather than a
    //                              typed constant (that equality is what caught
    //                              the 40px frame error this round).
    //   check-render-depth-kaizo   the two measured depth defects: the
    //                              boxsplitter's hell surface deferred, and
    //                              quickslash_big's registry entry.
    //   check-render-manifest-kaizo the ports run against the REAL manifest and
    //                              PNGs — every other render gate stubs every
    //                              sprite to a 32x32 placeholder.
    //   check-quickslash-draw      the finisher's Draw: the soul's sub-image
    //                              and the Create's own cuty.
    //   check-scenes               the four scene state machines by hand,
    //                              including k_nhscene's down-latch fix, which
    //                              had no enforced guard at all.
    //   check-split-growtangle-vertical  the B-Side vertical tear.
    //   check-hpscene              the max-HP shear (see its own note above).
    'check-heroes-draw', 'check-tensionbar-draw', 'check-render-depth-kaizo',
    'check-render-manifest-kaizo', 'check-quickslash-draw', 'check-scenes',
    'check-split-growtangle-vertical',
    // WIRED 2026-09-10 with k_hpscene, the MAX-HP SHEAR — the fourth
    // turn-hijacking scene (obj_knight_enemy Step_0:54-63 arms it,
    // :1771-1929 plays it) and THE ONLY ONE THAT IS NOT B-SIDE GATED. Its
    // arm rides V-C's `knightFirstStep` hook, so it is wired on the page's
    // default version rather than behind the B-Side flag: a party carrying
    // more than 200 / 230 / 180 / 180 gets its max HP cut on the fight's
    // opening frames, on BOTH routes.
    //
    // NO PLAYER CAN REACH IT TODAY, and that is worth saying plainly rather
    // than leaving the reader to infer it. The shipped app has no save import
    // and no path that builds an over-ceiling party — every roster it can make
    // comes from scr_gamestart's 160 / 190 / 140, which is under every
    // ceiling. The scene is translated against the day one exists, and the
    // check below is the only thing standing over it until then.
    //
    // It is enforced although the byte gate cannot see it, and that is the
    // point of wiring it: the arm needs `global.maxhp` or `global.hp` ABOVE
    // 200 / 230 / 180 / 180 and both recordings run scr_gamestart's default
    // 160 / 190 / 140, so nothing in fullfight/ can ever exercise this branch.
    // The check is the only gate on it. It drives real fights through
    // buildKaizoScene and the real director (156+ assertions, no recording,
    // seconds), asserts the cut lands on the frame state 6 runs and not
    // before, asserts the opening menu is HELD for the whole scene against a
    // control that opens it on frame 1, and pins the mod's own
    // `hp_scene = 5.1` typo (Step_0:1849) by its consequence: states 5
    // through 8 each run exactly twice.
    'check-hpscene',
    // THE ONLY CHECK HERE THAT IS NOT POSITIVE-ONLY. Everything above asserts
    // that our own modules do what we believe; this one holds the generated
    // V-C schedule against a RECORDING OF ENDERCAT8'S MOD
    // (knight-research/kaizo-mod/traces/). It is the kaizo end of the method
    // the vanilla fight earned all its claims with.
    //
    // It is WIRED despite depending on a file outside this repo because it
    // SKIPs loudly rather than failing when the recording is absent — and the
    // loud skip is the point. A reader who sees a green kaizo gate with no
    // oracle line in it should understand that nothing has been held against
    // the real mod on that machine.
    'check-oracle-schedule',
    // THE PER-ATTACK ORACLE CHECKS THAT ARE GREEN. Same contract as
    // check-oracle-schedule above — each SKIPs loudly at exit 0 when the
    // recording is absent, predates the `kaizo_playing` column, or holds no
    // complete turn of its family, so wiring them cannot redden a machine
    // with no oracle on it. Verified by running each against an empty
    // KAIZO_ORACLE_TRACES directory.
    //
    // Each is also sabotage-tested against a CORRUPTED COPY of the recording
    // (never the original): a one-frame shift of a star spawn makes
    // check-oracle-stars fail, dropping a third of atk_Multislash3's slashes
    // makes check-oracle-multislash fail, and dropping streamline rows makes
    // check-oracle-stream fail. They are not passing because nothing looked.
    //
    // EVERY check-oracle-* IS NOW WIRED. -weird was the last one out, and it
    // went green on 2026-08-29 when its blocker was fixed: the alarm phase now
    // visits instances in OBJECT INDEX order (sim/entity.js `alarmList`,
    // sim/data/object-order.js) rather than creation order, which is what
    // GameMaker does. obj_knight_weird_circle is index 373 and
    // obj_knight_weird_bottom_manager is 1173, so the game reaches the orb
    // first and a fuse the manager writes during its own alarm survives the
    // frame — the single frame all four "orbs -> first volley" failures were
    // missing. 180 assertions, exit 0.
    //
    // That change is global to the alarm phase, so it was landed behind a full
    // regeneration and `npm run verify`: 60 suites green, six whole-fight
    // diffs still byte-exact. A two-pass runAlarms was tried FIRST and reverted
    // — it overshoots — and the measurement is recorded at the site.
    //
    // The combination segment-3 half of -weird's old blocker is also fixed
    // (KAIZO_COMBO_ATTACKS[3] names the kaizo module); the check carries a
    // process-local routing stand-in and PRINTS a receipt saying the shipped
    // launcher path still runs vanilla segments, which remains open.
    // check-oracle-multislash WAS RED and is now GREEN (exit 0). Its former 2
    // failures of 284 were the same assertion
    // (check-oracle-multislash.mjs:735, `sWorst <= oWorst`). It went red when
    // sim/entity.js's angle normaliser was corrected to narrow-then-wrap, and
    // the correction is right — the recording carries 30 rows with
    // image_angle 360 beside direction 0 and NOT ONE row with direction 360,
    // and 24 of the mod's own 152 Multislash slash angles sit on f32 grids of
    // 2^-11/2^-12, which a value already inside [0,360) cannot reach by
    // narrowing. The assertion is the defect: the within-fan spread is pure
    // f32 quantisation at the member's RAW PRE-WRAP magnitude, aim_direction
    // accumulates all turn, and the RNG is re-anchored per launch — so the
    // oracle's worst sample is not a bound on the sim's. It needs a bound
    // derived from the model and applied to BOTH sides, not a wider literal;
    // do not "fix" it by raising the number until it passes.
    // IT RETURNED TO GREEN on 2026-08-29 WITHOUT THAT WORK BEING DONE, via a
    // further sim/entity.js change, and the assertion above is therefore still
    // the defect it is described as — it is passing, not fixed. What rules out
    // "someone widened it until it passed": check-oracle-multislash.mjs was
    // NOT edited in that round (mtime 11:59 predates every change in it,
    // 12:05-12:40), so the code got righter and the check stood still. Treat a
    // future failure here as the bound problem above, not as a regression.
    'check-oracle-stars', 'check-oracle-multislash', 'check-oracle-stream',
    // WIRED 2026-08-29, in the same commit as the launcher routing each one
    // needed. Every one meets the two conditions above, verified in this pass
    // rather than taken on report: a loud SKIP at exit 0 against an empty
    // KAIZO_ORACLE_TRACES, and exit 1 against a CORRUPTED COPY of
    // kaizo_oracle_seq_deep.csv (one row in four dropped for the moving
    // gameplay objects; the originals were read, never written).
    //   -tunnel      dc.type 102 now imports kaizo/attacks/sword-tunnel-revised.js
    //                and VANILLA_BODIES[102] is gone. 227 assertions, both routes.
    //   -tracking    dc.type 152 now imports kaizo/attacks/diagonal-bullets.js
    //                and VANILLA_BODIES[152] is gone; the check asserts those two
    //                halves landed TOGETHER. 206 assertions, both routes.
    //   -vortex      no launcher change was needed — the defect was inside
    //                obj_knight_swordfall's Alarm_0. 148 assertions.
    //   -quickslash  no launcher change was needed — the defect was inside the
    //                barrage's exit test. 98 assertions, route C; route D is a
    //                loud skip (ac 105.1 is a different attack).
    //   -crescent    dc.type 109 now imports kaizo/attacks/crescent-slash.js
    //                and VANILLA_BODIES[109] is gone; the check asserts those
    //                two halves landed TOGETHER (section 2c). 112 assertions,
    //                route C. A route-D recording is reported, not asserted —
    //                the B-Side's ac-0 arm is a different turn — and section 7
    //                stays route-independent because it is sourced from the GML.
    //   -splitter    no launcher change was needed — the defect was the
    //                slashmarker (`scr_dark_marker` at the slash's own x/y)
    //                being unmodelled in splitslash.js / flurry-splitslash.js.
    //                The GML for it is BYTE-IDENTICAL in the vanilla and kaizo
    //                dumps, so it was a VANILLA defect the kaizo check happened
    //                to measure, and the fix landed in sim/. 430 assertions.
    'check-oracle-tunnel', 'check-oracle-tracking', 'check-oracle-vortex',
    'check-oracle-quickslash', 'check-oracle-crescent', 'check-oracle-splitter',
    // The last one in: its blocker was the alarm-ordering model, fixed above.
    'check-oracle-weird',
  ]);

  const here = dirname(fileURLToPath(import.meta.url));
  const checkDir = join(here, 'checks');
  if (existsSync(checkDir)) {
    const checks = readdirSync(checkDir).filter((f) => /^check-.*\.mjs$/.test(f)).sort();
    console.log('');
    // REPORTED BY THEIR OWN BLOCK FURTHER DOWN, so this loop must not run
    // them as well: each replays thousands of frames against a recording,
    // and the generic line below ("not wired into the launcher yet") is the
    // wrong reason for them anyway — they are unenforced because they are
    // RED against the mod, which is a different and louder fact.
    const REPORTED_BELOW = new Set(['check-oracle-roaringdelta', 'check-colours-sheet']);

    for (const file of checks) {
      const name = file.replace(/\.mjs$/, '');
      if (REPORTED_BELOW.has(name)) continue;
      let passed = true;
      try {
        execFileSync(process.execPath, [join(checkDir, file)], { stdio: 'pipe' });
      } catch {
        passed = false;
      }
      if (WIRED.has(name)) {
        ok(passed, `${name} (WIRED into the V-C launcher)`);
      } else {
        console.log(`  ${passed ? '--  ' : 'WIP '} ${name}: ${passed ? 'passing' : 'FAILING'}`
          + ' — not wired into the launcher yet, not enforced');
      }
    }
    for (const w of WIRED) {
      if (!checks.includes(`${w}.mjs`)) ok(false, `${w}.mjs is WIRED but its check file is missing`);
    }

    // THE ORACLE CHECK'S OWN SABOTAGE TEST, run as part of the gate rather
    // than as something an author ran once.
    //
    // check-oracle-schedule reads its truth from a FILE, which makes it the
    // one check here that can go green for reasons unrelated to being right: a
    // mistyped column name, a comparison of two undefineds, a loop that never
    // enters. All three produce a clean pass against a real recording.
    // sabotage-oracle-schedule corrupts the recording in four known ways and
    // requires a specific failure for each, so "84 assertions green" stays a
    // claim about the mod instead of a claim about the parser.
    const sabotage = join(checkDir, 'sabotage-oracle-schedule.mjs');
    if (existsSync(sabotage)) {
      let passed = true;
      try {
        execFileSync(process.execPath, [sabotage], { stdio: 'pipe' });
      } catch {
        passed = false;
      }
      ok(passed, 'sabotage-oracle-schedule (the oracle check can actually fail)');
    } else {
      ok(false, 'sabotage-oracle-schedule.mjs is missing — check-oracle-schedule is unguarded');
    }

    // ── check-oracle-roaringdelta — REPORTED, NOT ENFORCED, and RED ─────────
    //
    // The roar's finale held frame-for-frame against MODE 1 attack-lock
    // recordings (kaizo-mod/locks/). It is NOT in WIRED because it FAILS
    // today and the failure is the point: it is the first thing that has ever
    // held atk_RoaringDelta's finale against the mod past its sixth volley,
    // and it found a real fault on all five locked launches of the
    // 2026-09-09 recordings. Wiring it into the enforced set would redden the
    // gate for a defect the gate cannot fix; hiding it would lose the only
    // measurement of the roar there is. So it prints, loudly, like the
    // whole-fight gate above.
    //
    // ITS SABOTAGE IS REPORTED TOO, AND THAT IS NOT A DODGE — it is what the
    // harness can mean today. `--sabotage` injects eleven corruptions per
    // recording and demands the finding land ON THE CORRUPTED CELL, and this
    // check reports only the FIRST divergence per group, so a REAL divergence
    // earlier in the same group masks the injected one. Measured 2026-09-09:
    // 7 of 11 caught cell-exact; the four misses are each the real fault
    // reported instead (roar timer @f470 masked by chargeuptimer @f469,
    // slash-lines l0_x @f1487 masked by `lines` at the same frame, B-Side
    // clock @f454 masked by @f453), plus the dropped-star case, whose index
    // expectation is too precise: every star shares an object name, so a
    // deleted row only shows up where a DIFFERENT object next appears (#8,
    // not #2). So the differ demonstrably fails when the data changes; the
    // cell-exact contract is what has to wait.
    //
    // Flip BOTH to ok(...) in the same commit that makes the check byte-exact.
    const roarCheck = join(checkDir, 'check-oracle-roaringdelta.mjs');
    if (existsSync(roarCheck)) {
      let rdPassed = true;
      try {
        execFileSync(process.execPath, [roarCheck, '--quiet'], { stdio: 'pipe' });
      } catch {
        rdPassed = false;
      }
      console.log(`  ${rdPassed ? '--  ' : 'WIP '} check-oracle-roaringdelta: `
        + `${rdPassed ? 'skipping or passing' : 'FAILING'} (not enforced — the `
        + "three named cells remain: the C+214 clock write, chargeuptimer's missing same-frame tick, one star x at 6e-5; see the ledger)");

      let rdSab = true;
      try {
        execFileSync(process.execPath, [roarCheck, '--sabotage'], { stdio: 'pipe' });
      } catch {
        rdSab = false;
      }
      console.log(`  ${rdSab ? '--  ' : 'WIP '} check-oracle-roaringdelta --sabotage: `
        + `${rdSab ? 'every case caught at its cell' : 'FAILING'} (not enforced — `
        + 'the real divergences mask the injected ones; see the note above)');
    } else {
      ok(false, 'check-oracle-roaringdelta.mjs is missing — the roar is held against nothing');
    }

    // ── check-colours-sheet — REPORTED, NOT ENFORCED, and RED ──────────────
    //
    // The four MODE 1 colour LOCK recordings of 2026-09-09 (kaizo-mod/locks/
    // cs_tunnel2-raw, cs_starstorm4-raw, cs_multislash1-raw, cs_splitter1-raw)
    // carry a per-frame DRAW-FIELD sheet, and this check is the first thing
    // that reads them: it replays each locked attack through the launcher and
    // diffs sprite_index, image_blend, visible and the mod's own r/g/b/outline/
    // coltimer, object by object.
    //
    // It is NOT in WIRED because it FAILS, and the failure is the whole point.
    // What it settles is in the ledger's 2026-09-10 section; what it still
    // finds is real and unfixed — obj_particle_generic (3,774 recorded rows,
    // the slash-mark debris, colour gap G6) and obj_fake_gt are MISSING
    // entirely, four objects leave sprite_index unset, and
    // every merge_color ramp on the sheet parts from the sim on exactly the
    // rows whose exact value is a .5 (colour gap G9: the game narrows the
    // amount to float32 and ROUNDS HALF TO EVEN; sim/gml.js:407-413 rounds
    // half UP). Wiring it would redden the gate for defects the gate cannot
    // fix; hiding it would lose the only measurement of the mod's paint there
    // is. So it prints, like the two gates above.
    //
    // ITS SABOTAGE IS ENFORCED, and that is the difference from the roar's:
    // the four corruptions land in their OWN GROUP (an object's blend, its
    // sprite name, one r cell, one `visible`) rather than at a named cell, so
    // a real divergence elsewhere cannot mask them.
    //
    // RETRACTED 2026-09-10, and left here rather than deleted because the
    // claim was banked as a measured fact and acting on it would have DELETED
    // A CORRECT TINT. This block used to read "obj_knight_pointing_star is
    // tinted where the mod paints it c_white on all 1,637 rows" and called it
    // the largest colour divergence on any sheet. It is an INSTRUMENT
    // ARTEFACT: that object never writes `image_blend` at all, so the sheet's
    // column reads c_white for a star the mod really does tint — it passes the
    // colour as draw_sprite_ext's own blend argument. The sim is right. A
    // column an object never writes is now set aside explicitly in the check
    // (NEVER_WRITTEN), the way check-oracle-roaringdelta sets aside its
    // cosmetic columns, so this class of claim cannot be made again.
    //
    // Flip the first line to ok(...) in the same commit that makes the check
    // green against the mod.
    const colourSheet = join(checkDir, 'check-colours-sheet.mjs');
    if (existsSync(colourSheet)) {
      let csPassed = true;
      try {
        execFileSync(process.execPath, [colourSheet, '--quiet'], { stdio: 'pipe' });
      } catch {
        csPassed = false;
      }
      console.log(`  ${csPassed ? '--  ' : 'WIP '} check-colours-sheet: `
        + `${csPassed ? 'skipping or passing' : 'FAILING'} (not enforced — obj_particle_generic`
        + ' and obj_fake_gt unmodelled, four objects with sprite_index unset, and merge_color'
        + " rounds half-UP where the game rounds half-to-EVEN; see the ledger's 2026-09-10 section)");

      let csSab = true;
      try {
        execFileSync(process.execPath, [colourSheet, '--sabotage'], { stdio: 'pipe' });
      } catch {
        csSab = false;
      }
      ok(csSab, 'check-colours-sheet --sabotage (the draw-sheet differ can actually fail)');
    } else {
      ok(false, 'check-colours-sheet.mjs is missing — nothing the mod PAINTS is held against it');
    }

    // THE OTHER TEN. sabotage-oracle-schedule guards one of the wired oracle
    // checks; this guards the rest, 12 cases over 11 checks. It also asserts
    // the property that makes wiring them safe at all: each SKIPs loudly at
    // exit 0 against an empty KAIZO_ORACLE_TRACES.
    //
    // The coverage statement is NOT restated here. It used to be, it went
    // stale the day -crescent and -splitter were wired, and it read exactly
    // like an accurate note while it was wrong. sabotage-oracle-checks.mjs
    // now text-scans the WIRED set below at runtime and PRINTS the diff
    // against its own case families on every run — either "every one of
    // verify-kaizo.mjs's 11 WIRED oracle checks has a case here" or a NOT
    // COVERED HERE line naming the gaps. Read its output, not a comment.
    //
    // IMPORTANT: that scan matches /const\s+WIRED\s*=\s*new\s+Set\(\[...\]\);/
    // and then /'(check-oracle-[a-z0-9-]+)'/ inside it. Editing the label
    // strings is safe; RESTRUCTURING the WIRED Set literal is not — if the
    // scan stops matching, the harness says COVERAGE UNKNOWN rather than
    // claiming coverage it cannot prove.
    const sabotageAll = join(checkDir, 'sabotage-oracle-checks.mjs');
    if (existsSync(sabotageAll)) {
      let passed = true;
      try {
        execFileSync(process.execPath, [sabotageAll], { stdio: 'pipe' });
      } catch {
        passed = false;
      }
      ok(passed, 'sabotage-oracle-checks (all eleven wired oracle checks can actually fail)');
    } else {
      ok(false, 'sabotage-oracle-checks.mjs is missing — all eleven wired oracle checks are unguarded');
    }

    // ── THE WHOLE-FIGHT GATE ────────────────────────────────────────────
    // NOT under checks/, so the `check-*.mjs` globber above does not pick it
    // up and this wiring has to be explicit. That is deliberate: checks/ means
    // "per-module positive check", and this is a whole-fight differ.
    //
    // TWO ENTRIES, DIFFERENT STATUS ON PURPOSE.
    const fullfight = join(here, 'verify-kaizo-fullfight.mjs');
    if (existsSync(fullfight)) {
      // (1) ENFORCED. Hermetic: builds its own synthetic pairs in a
      // per-process scratch dir, needs no game, no recording and no private
      // data, and cleans up in a `finally`. It is the thing that makes the
      // gate's green mean anything, so it belongs beside the two sabotage
      // harnesses above for exactly their reason.
      let sabPassed = true;
      try {
        execFileSync(process.execPath, [fullfight, '--sabotage'], { stdio: 'pipe' });
      } catch {
        sabPassed = false;
      }
      ok(sabPassed, 'sabotage-kaizo-fullfight (the whole-fight gate can actually fail)');

      // (2) WIP — REPORTED, NOT ENFORCED. It is safe to enforce today (with no
      // recording it SKIPs loudly at exit 0), but enforcing it would assert
      // NOTHING while reading as coverage: on a machine with no token-driven
      // recording beside its input feed, the skip is its only possible
      // outcome. Flip this to ok(...) in the SAME commit that lands a
      // recording this repo can actually diff against — the same discipline
      // the WIRED set documents for moving a check out of WIP.
      //
      // MEASURED 2026-08-29 against the first real token-driven pair (_tok1,
      // seed 20260810, 13000 frames): it FAILS, and correctly — the recorder
      // starts the fight already in the bullet phase while the sim opens with
      // the party menu, so the two sides consume the SAME input feed at
      // different indices from frame 0. That is a recorder epoch defect, not
      // a differ defect. See the gate's header and kaizo/HANDOFF.md.
      let ffPassed = true;
      try {
        execFileSync(process.execPath, [fullfight], { stdio: 'pipe' });
      } catch {
        ffPassed = false;
      }
      console.log(`  ${ffPassed ? '--  ' : 'WIP '} verify-kaizo-fullfight: `
        + `${ffPassed ? 'skipping or passing' : 'FAILING'} (not enforced — `
        + 'needs a whole-fight recording whose epoch matches the sim)');
    } else {
      ok(false, 'verify-kaizo-fullfight.mjs is missing — the whole-fight diff is unguarded');
    }
  }
}

console.log('');
if (failed) {
  console.log(`verify-kaizo: ${failed} assertion(s) FAILING`);
  process.exit(1);
}
console.log('verify-kaizo: green — V-A runs; V-C walks the mod\'s chain (approx rows ledgered).');
