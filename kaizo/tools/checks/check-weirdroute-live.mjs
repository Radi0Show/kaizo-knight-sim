#!/usr/bin/env node
// KAIZO WEIRD ROUTE (B-Side) — THE PARTY LAYER ON THE LIVE PATH.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// WHAT THIS IS. check-roster, check-gloom and check-freeze prove the MODULES
// under kaizo/party/ by calling them. Until 2026-09-08 nothing in the fight
// called them: the turn loop reached sim/damage.js, sim/dialogue.js and
// render/menu.js's hardcoded three-member tables, so a V-D run took vanilla
// damage, played Susie's balloon exchange over Noelle and drew the two
// panels at the three-member x's. This check builds V-D THROUGH
// buildKaizoScene, steps it THROUGH the real turn loop, and asserts on what
// the engine's own entry points now do — V-C is the control in every block,
// so a seam that quietly stopped being consulted reads as a failure here and
// not as a green module check.
//
// PROVENANCE (knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/):
//   gml_GlobalScript_scr_damage.gml:5-17, 157-160, 225-231, 245-265
//   gml_GlobalScript_scr_gamestart.gml:177-179 (Kris's chapter-3 gear)
//   gml_Object_obj_knight_enemy_Step_0.gml:206-211 (balloonturn = -1),
//                                        :566-781 (the turn-end messages),
//                                        :950-964 (CHECK)
//   gml_Object_obj_knight_enemy_Other_23.gml:1-9 (the CHECK strings)
//   gml_Object_obj_knight_enemy_Step_2.gml:15-43 (the GLOOM engine)
//   gml_GlobalScript_scr_charbox.gml:24-47 (xchunk 108 / 322)
//   gml_Object_obj_attackpress_Create_0.gml:150-163 (charbolt / bolttotal)
//
//     node kaizo/tools/checks/check-weirdroute-live.mjs

import { createState, stepFrame } from '../../../sim/index.js';
import { scrDamageSingle } from '../../../sim/damage.js';
import { buildKaizoScene } from '../../scenes/kaizo-fight.js';
import { sceneHijacksTurn } from '../../party/scenes.js';
import { kaizoIdlesprite } from '../../actors/kaizo-knight-actor.js';
import { damageKnight } from '../../../sim/knight.js';
import { KAIZO_CHECK_PAGES } from '../../scenes/kaizo-vc-hooks.js';
import {
  kaizoDamageHooks, scrDamageSingle as kaizoScrDamageSingle, scrRevive,
} from '../../party/damage.js';
import { PARTY as SIM_PARTY } from '../../../sim/damage.js';
import { gearOfChar, statFor, CHAR_KRIS, CHAR_NOELLE } from '../../party/roster.js';
import { kaizoAdvanceBalloon } from '../../party/freeze.js';
import { GLOOM_TEXT, gloomDarktime } from '../../party/gloom.js';

let failures = 0;
let checks = 0;
function ok(cond, label) {
  checks += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); }
}
function eq(got, want, label) {
  checks += 1;
  if (got !== want) {
    failures += 1;
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}
function deepEq(got, want, label) { eq(JSON.stringify(got), JSON.stringify(want), label); }
function section(name) { console.log(`\n── ${name}`); }

const idle = {
  left: false, right: false, up: false, down: false, focus: false,
  confirm: false, cancel: false, button3: false,
};
/** check-weirdroute's driver: FIGHT for everyone, confirm pulsed. */
function fightInput() {
  let pulse = false;
  return (state) => {
    if (!state.menu?.open && !state.dialogue?.text && !state.pendingAct) return idle;
    pulse = !pulse;
    return { ...idle, confirm: pulse };
  };
}
/** Kris takes ACT -> the first row (CHECK); everyone else FIGHTs. */
function checkInput() {
  let pulse = false;
  return (state) => {
    const m = state.menu;
    if (!m?.open && !state.dialogue?.text && !state.pendingAct) return idle;
    pulse = !pulse;
    if (m?.open && m.submenu === null && m.charturn === 0 && m.selected[0] !== 1) {
      return { ...idle, right: pulse };
    }
    return { ...idle, confirm: pulse };
  };
}
function build(version, seed = 12345) {
  const st = createState({ seed, traceBulletSlots: 0 });
  buildKaizoScene(st, { version });
  return st;
}
function director(state) {
  return state.entities.find((x) => x.alive && x.type?.name === 'fight_director');
}
/**
 * KEEP-ALIVE, the harness's — kaizo-trace.mjs makeKeepAlive's two modes. A
 * still soul eats every bullet, and with the damage layer live the party now
 * actually dies inside turn 1 (which is the layer working). The long blocks
 * below pin HP after each frame; `revive` also stands the dead back up
 * (three of the five globals, like scr_revive), `only` restricts the pin to
 * the slots a scenario needs alive so a deliberate down stays down.
 */
function keepAlive(state, { revive = false, only = null } = {}) {
  const roster = state.kaizo?.roster;
  const n = roster ? roster.length : 3;
  for (let i = 0; i < n; i++) {
    if (only && !only.includes(i)) continue;
    state.partyHp[i] = roster ? roster[i].maxhp : SIM_PARTY[i].maxhp;
    if (revive) scrRevive(state, i);
  }
  state.gameOver = false;
}
/** One pinned hit through the ENGINE's entry point: aoedamage keeps the slot. */
function pinnedHit(state, damage, slot) {
  state.invTimer = -1;
  const prev = state.knight.aoedamage;
  state.knight.aoedamage = true;
  const dealt = scrDamageSingle(state, damage, slot, {});
  state.knight.aoedamage = prev;
  return dealt;
}

// ═══════════════════════════════════════════════════════════════════════════
section('the seams are installed on V-D and absent on V-C');
{
  const d = build('D');
  const c = build('C');
  const hooks = kaizoDamageHooks();
  for (const name of ['scrDamage', 'scrDamageSingle', 'scrDamageAll', 'scrDamageMaxhp']) {
    eq(d.kaizo.hooks[name], hooks[name], `V-D installs hooks.${name} (kaizo/party/damage.js)`);
    eq(c.kaizo.hooks[name], undefined, `V-C leaves hooks.${name} unset (the engine's scr_damage, gate-pinned)`);
  }
  eq(d.kaizo.hooks.advanceBalloon, kaizoAdvanceBalloon, 'V-D installs hooks.advanceBalloon');
  eq(c.kaizo.hooks.advanceBalloon, undefined, 'V-C keeps the engine balloon');
  ok(typeof d.kaizo.hooks.knightTarget === 'function', 'V-D still carries knightTarget (unused under the damage hooks, harmless)');
}

// ═══════════════════════════════════════════════════════════════════════════
section('gap 6 — scr_charbox xchunk 108 / 322 for two members');
{
  const d = build('D');
  const c = build('C');
  deepEq(d.partyChunks, [108, 322], 'V-D: state.partyChunks = [108, 322] (scr_charbox:37-43)');
  eq(c.partyChunks, undefined, 'V-C: no partyChunks — render/menu.js falls back to [0, 213, 426]');
  eq(d.partySprites?.length, 2, 'V-D draws two panels');
}

// ═══════════════════════════════════════════════════════════════════════════
section('gap 11 — Kris on V-D wears scr_gamestart\'s chapter-3 build, no mantle');
{
  const d = build('D');
  deepEq(gearOfChar(d, CHAR_KRIS), { weapon: 16, armor: [1, 10] },
    'Kris: MechaSaber + AmberCard + GlowWrist (scr_gamestart.gml:177-179)');
  eq(statFor(d, 0).df, 5, 'battledf[0] = 2 + 1 + 2 = 5, the A-Side receipt\'s number');
  eq(statFor(d, 0).at, 18, 'battleat[0] = 14 + 4 = 18');
  ok(!(gearOfChar(d, CHAR_KRIS).armor ?? []).includes(23), 'no ShadowMantle: scr_kaizo_target\'s _mantlechar stays -1');
  eq(gearOfChar(d, CHAR_NOELLE).weapon, 13, 'Noelle keeps the ThornRing (noelle.js — save-dependent, unchanged here)');
}

// ═══════════════════════════════════════════════════════════════════════════
section('gap 1 — the damage layer, through sim/damage.js\'s own entry point');
{
  // Noelle x0.5: scr_damage.gml:157-160. Her DF is 1 + SilverWatch 2 +
  // RoyalPin 3 = 6; 100 walks six -3 steps (all > 120/5) to 82; round(41).
  const d = build('D');
  const dealtN = pinnedHit(d, 100, 1);
  eq(dealtN, 41, 'V-D: a 100 hit on slot 1 (Noelle) lands 41 = round(82 * 0.5)');
  eq(d.partyHp[1], 120 - 41, 'and her HP is 79');
  // Kris, same hit: DF 5 -> 85, no halving.
  const dealtK = pinnedHit(d, 100, 0);
  eq(dealtK, 85, 'V-D: the same hit on Kris lands 85 (DF 5, no x0.5)');
  eq(d.partyHp[0], 160 - 85, 'Kris at 75');
  // V-C control: slot 1 is Susie under the A-Side receipt (DF 5), engine path.
  const c = build('C');
  c.invTimer = -1;
  c.knight.aoedamage = true;
  const dealtC = scrDamageSingle(c, 100, 1, { aoe: true });
  eq(dealtC, 85, 'V-C control: slot 1 takes 85 through the engine (no halving)');

  // Gloom accrual rides the same hit (scr_damage.gml:5-17, :245-265):
  // ceil(100 / 6) = 17 on Kris; Noelle books 0 with the ThornRing (:249).
  eq(d.kaizo.gloom[0], 17, 'Kris banks 17 gloom from the 100 hit');
  eq(d.kaizo.gloomByChar[1], 17, '...mirrored at k_gloom[1]');
  eq(d.kaizo.gloom[1], 0, 'Noelle banks 0 (charweapon[4] == 13)');
  eq(c.kaizo.gloom?.[0] ?? 0, 0, 'V-C control: no gloom at all');

  // -999 for everyone (scr_damage.gml:225-231): Kris's mercy is gone.
  const d2 = build('D');
  pinnedHit(d2, 1000, 0);
  eq(d2.partyHp[0], -999, 'V-D: a lethal hit puts Kris at -999, not -80');
  eq(d2.chardead[0], 1, '...and scr_dead ran');
  pinnedHit(d2, 1000, 1);
  eq(d2.partyHp[1], -999, 'Noelle at -999');
  const c2 = build('C');
  c2.invTimer = -1;
  c2.knight.aoedamage = true;
  scrDamageSingle(c2, 1000, 0, { aoe: true });
  eq(c2.partyHp[0], -80, 'V-C control: the engine still gives Kris round(-160 / 2)');

  // The kaizo single entry is what the engine called: same function, same
  // result on a fresh state.
  const d3 = build('D');
  d3.invTimer = -1;
  d3.knight.aoedamage = true;
  eq(kaizoScrDamageSingle(d3, 100, 1, {}), 41, 'the hook IS kaizo/party/damage.js scrDamageSingle');
}

// ═══════════════════════════════════════════════════════════════════════════
section('gap 8 — the GLOOM engine ticks from the turn loop (Step_2:15-43)');
{
  const d = build('D');
  const inp = fightInput();
  const e = director(d);
  ok(!!e, 'the fight director exists');
  // Step until the first bullet phase (clockOn = mnfight 2).
  let f = 0;
  while (!e.clockOn && f < 3000) { stepFrame(d, inp(d)); f += 1; }
  ok(e.clockOn, `reached the bullet phase (frame ${d.frame})`);
  // Land one pinned hit on Kris now: 17 gloom, inv 30 frames — no second
  // hit can arrive inside the first tick.
  const before = pinnedHit(d, 100, 0);
  ok(before > 0, 'the hit landed');
  const hp0 = d.partyHp[0];
  const g0 = d.kaizo.gloom[0];
  eq(g0, 17, 'gloom 17 on Kris');
  const dark = gloomDarktime(g0);
  eq(dark, 15, '_darktime = ceil(max(18 - 17/5, 1)) = 15');
  for (let i = 0; i < dark; i++) stepFrame(d, idle);
  ok(e.clockOn, 'still in the bullet phase');
  eq(d.kaizo.gloom[0], g0 - 1, `after ${dark} frames the meter ticked once (Step_2:37)`);
  eq(d.partyHp[0], hp0 - 1, '...and took one HP with it (Step_2:38)');
  eq(d.kaizo.gloomByChar[1], g0 - 1, 'the k_gloom[1] mirror followed');
  eq(d.kaizo.gloomTimer[0], 0, 'k_glt reset on the tick');
  // Control: the same engine on V-C does nothing (k_sideb off).
  const c = build('C');
  const ec = director(c);
  const inpC = fightInput();
  let fc = 0;
  while (!ec.clockOn && fc < 3000) { stepFrame(c, inpC(c)); fc += 1; }
  c.kaizo.gloom = [17, 0, 0];
  const hpc = c.partyHp[0];
  for (let i = 0; i < 40; i++) stepFrame(c, idle);
  eq(c.kaizo.gloom[0], 17, 'V-C control: a planted meter never moves');
  ok(c.partyHp[0] <= hpc, 'V-C control HP only moves by bullets');
}

// ═══════════════════════════════════════════════════════════════════════════
section('gap 5 — no Susie balloon on V-D (Step_0:206-211)');
{
  const d = build('D');
  const inp = fightInput();
  let knightLines = 0;
  let maxTurn = -Infinity;
  for (let i = 0; i < 6000; i++) {
    stepFrame(d, inp(d));
    keepAlive(d, { revive: true });
    if (d.dialogue?.speaker === 'knight' || d.dialogue?.text) knightLines += 1;
    maxTurn = Math.max(maxTurn, d.dialogue?.balloonturn ?? 0);
  }
  eq(knightLines, 0, 'V-D: no balloon text in 6000 frames');
  ok(maxTurn <= 0, `balloonturn never climbs past 0 (max ${maxTurn})`);
  ok(d.kaizo.launched.length >= 8, `the fight ran (${d.kaizo.launched.length} launches)`);
  // Control: the engine's exchange still fires on V-C in the same span.
  const c = build('C');
  const inpC = fightInput();
  let cLines = 0;
  for (let i = 0; i < 6000; i++) {
    stepFrame(c, inpC(c));
    keepAlive(c, { revive: true });
    if (c.dialogue?.speaker === 'knight') cLines += 1;
  }
  ok(cLines > 0, `V-C control: the knight speaks (${cLines} frames of balloon)`);
}

// ═══════════════════════════════════════════════════════════════════════════
section('gap 15 — two bolts on the attack bar (obj_attackpress Create_0:150-163)');
{
  const grab = (version) => {
    const st = build(version);
    const inp = fightInput();
    for (let i = 0; i < 1500 && !st.fightBar; i++) stepFrame(st, inp(st));
    return st.fightBar;
  };
  const bd = grab('D');
  ok(!!bd, 'V-D: a FIGHT bar appeared');
  deepEq(bd?.havechar, [1, 1, 0], 'V-D: charbolt = havechar = [1, 1, 0]');
  eq(bd?.bolts?.length, 2, 'V-D: bolttotal 2');
  const bc = grab('C');
  deepEq(bc?.havechar, [1, 1, 1], 'V-C control: [1, 1, 1]');
  eq(bc?.bolts?.length, 3, 'V-C control: bolttotal 3');
}

// ═══════════════════════════════════════════════════════════════════════════
section('gap 12 — the B-Side CHECK text (Other_23:4-9, Step_0:950-964)');
{
  const d = build('D');
  const e = director(d);
  ok(typeof e.hooks.actPages === 'function', 'V-D carries the actPages hook');
  const c = build('C');
  eq(director(c).hooks.actPages, undefined, 'V-C does not (vanilla CHECK text, gate-pinned)');

  // The live path: Kris picks ACT -> CHECK on turns 1 and 2.
  const inp = checkInput();
  const seen = [];
  for (let i = 0; i < 2400; i++) {
    stepFrame(d, inp(d));
    keepAlive(d, { revive: true });
    if (d.battlemsg && seen[seen.length - 1] !== d.battlemsg) seen.push(d.battlemsg);
  }
  const first = KAIZO_CHECK_PAGES.B.first;
  const again = KAIZO_CHECK_PAGES.B.again;
  ok(seen.includes(first[0]), `page 1A reached the chatbox: "${first[0]}"`);
  ok(seen.includes(first[1]), `page 1B followed: "${first[1]}"`);
  ok(seen.includes(again[0]), `the repeat is one page: "${again[0]}"`);
  ok(!seen.some((s) => /couldn't learn anything|points into the distance/.test(s)),
    'and vanilla\'s CHECK / POINT pages never appear');
  eq(d.actCounts?.check >= 2, true, 'checkcount advanced through the engine\'s own counter');
}

// ═══════════════════════════════════════════════════════════════════════════
section('gap 13 — the knight\'s B-Side turn-end messages (Step_0:566-781)');
{
  // Noelle down -> "* She was used up.&" at the next turn end (:632-641).
  const d = build('D');
  const inp = fightInput();
  const e = director(d);
  while (d.kaizo.launched.length < 1 && d.frame < 3000) stepFrame(d, inp(d));
  pinnedHit(d, 1000, 1);
  eq(d.partyHp[1], -999, 'Noelle is down');
  const seen = [];
  while (d.kaizo.launched.length < 3 && d.frame < 6000) {
    stepFrame(d, inp(d));
    keepAlive(d, { only: [0] });   // Kris must reach the turn end; Noelle stays down
    if (d.battlemsg && seen[seen.length - 1] !== d.battlemsg) seen.push(d.battlemsg);
  }
  ok(seen.includes('* She was used up.&'), 'V-D: "* She was used up.&" (the k_sideb noelledown)');
  ok(!seen.includes("* Noelle's breath goes cold.&"), 'not the A-Side line');
  eq(d.kaizo.downLatch?.noelle, true, 'noelledownmessage latched');

  // Kris down: "* Can't move your body.&" unless kaizo_funchance(100) hits.
  const d2 = build('D');
  const inp2 = fightInput();
  while (d2.kaizo.launched.length < 1 && d2.frame < 3000) stepFrame(d2, inp2(d2));
  pinnedHit(d2, 1000, 0);
  const seen2 = [];
  while (d2.kaizo.launched.length < 3 && d2.frame < 6000) {
    stepFrame(d2, inp2(d2));
    keepAlive(d2, { only: [1] });   // Noelle carries the turn; Kris stays down
    if (d2.battlemsg && seen2[seen2.length - 1] !== d2.battlemsg) seen2.push(d2.battlemsg);
  }
  ok(seen2.includes("* Can't move your body.&") || seen2.includes('* Kris is now dead.&'),
    'V-D: the k_sideb krisdown line (or its 1/100 funchance variant)');

  // GLOOM >= 36 with nobody down (:647-676): plant the meter on the last
  // frames of a bullet phase so the drain cannot take it under 36 first.
  const d3 = build('D');
  const inp3 = fightInput();
  const e3 = director(d3);
  let planted = false;
  const seen3 = [];
  while (d3.kaizo.launched.length < 2 && d3.frame < 4000) {
    stepFrame(d3, inp3(d3));
    keepAlive(d3, { revive: true });
    if (!planted && e3.clockOn && d3.turntimer <= 3 && d3.turntimer > 0) {
      d3.kaizo.gloom[0] = 45;
      d3.kaizo.gloomByChar[1] = 45;
      planted = true;
    }
    if (d3.battlemsg && seen3[seen3.length - 1] !== d3.battlemsg) seen3.push(d3.battlemsg);
  }
  ok(planted, 'the meter was planted before a turn end');
  ok(seen3.includes(GLOOM_TEXT[1]), `"${GLOOM_TEXT[1].trim()}" fired at the turn end`);
  eq(d3.kaizo.gtext?.[1], 1, 'k_gtext[1] latched — once per fight');

  // V-C control: none of the B-Side lines exist on the A-Side path.
  const c = build('C');
  const inpC = fightInput();
  while (c.kaizo.launched.length < 1 && c.frame < 3000) stepFrame(c, inpC(c));
  c.invTimer = -1;
  c.knight.aoedamage = true;
  scrDamageSingle(c, 1000, 1, { aoe: true });
  const seenC = [];
  while (c.kaizo.launched.length < 3 && c.frame < 6000) {
    stepFrame(c, inpC(c));
    keepAlive(c, { only: [0, 2] });
    if (c.battlemsg && seenC[seenC.length - 1] !== c.battlemsg) seenC.push(c.battlemsg);
  }
  ok(c.kaizo.launched.length >= 3, 'V-C control reached its turn ends');
  ok(!seenC.some((s) => /used up|Can't move your body|GLOOM/.test(s)),
    'V-C control: no B-Side message on the A-Side turn end');
}

// ═══════════════════════════════════════════════════════════════════════════
section('the knight NEVER strobes from a party hit (scr_damage_enemy, 10000)');
{
  // The mod's only change to scr_damage_enemy is the strobe arm's literal:
  // v105 `arg1 >= 100`, kaizo `arg1 >= 10000`. Nothing the party can throw
  // reaches 10000 — X-Slash, the biggest hit in the fight, is under 900 — so
  // `stronghurtanim` belongs to the ENDING alone. It gates the ending's %3
  // flicker and the delayed thud at `hurttimer == 29`, which the sim was
  // playing on every heavy swing.
  for (const version of ['C', 'D']) {
    const st = build(version);
    eq(st.stronghurtDamage, 10000,
      `V-${version} carries the mod's threshold, not the vanilla 100`);
    st.knight.stronghurtanim = false;
    damageKnight(st, 900);            // bigger than X-Slash, the fight's largest
    eq(st.knight.stronghurtanim, false,
      `V-${version}: a 900 hit does NOT strobe him`);
    damageKnight(st, 10000);
    eq(st.knight.stronghurtanim, true,
      `V-${version}: and the literal itself still does, so the gate is the number`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('the NO-HIT RECOLOUR reaches the sprite the Draw reads (Step_0:694)');
{
  // The mod's Knight CHANGES APPEARANCE once you are provably running a
  // flawless Weird Route: `idlesprite = spr_roaringknight_idle2` at the four
  // turn ends of the no-hit branch (Step_0:694, 714, 727, 740). It is an
  // obj_knight_enemy instance variable, and kaizoIdlesprite — the one reader,
  // feeding both the ghost trail and the Draw port — looks at the entity.
  const st = build('D');
  const inp = fightInput();
  const knightOf = (s2) => s2.entities.find(
    (x) => x.alive && x.type?.name === 'obj_knight_enemy',
  );
  const kn = knightOf(st);
  ok(!!kn, 'V-D has a live knight');
  eq(kaizoIdlesprite(kn, st.knight), 'spr_roaringknight_idle',
    'he opens on the ordinary idle (Create_0:5)');

  // The branch needs the RoaringDelta row just finished and `progamer` still
  // true — no hit landed. It is reached the way the fight reaches it: the
  // knight held under VC_GATE_FRACTION so phase 4 opens and the finale's row
  // becomes the one `kaizo_prevatk` names (kaizo-vc-hooks.js's gateTripped
  // branch, which is where the mod's :528/:574 pair lands). A still soul in
  // this harness eats bullets, so `progamer` is held rather than earned:
  // the section tests the WIRING of the reward, not the earning of it.
  let recoloured = false;
  for (let f = 0; f < 8000 && !recoloured; f++) {
    st.knight.hp = Math.min(st.knight.hp, 5000);
    st.knight.progamer = true;
    stepFrame(st, inp(st));
    keepAlive(st, { revive: true });
    const k = knightOf(st);
    if (k && k.idlesprite === 'spr_roaringknight_idle2') recoloured = true;
  }
  ok(recoloured, 'a B-Side no-hit turn end put idle2 on the INSTANCE');
  const after = knightOf(st);
  eq(kaizoIdlesprite(after, st.knight), 'spr_roaringknight_idle2',
    'and the reader the Draw port uses now returns it');
  eq(st.knight.didfullnohit, 1, 'didfullnohit latched (Step_0:692)');

  // AND IT COMES OFF AT THE NEXT TURN'S START — Step_0:494, in the mod's
  // mnfight-1.5 block, outside the k_sideb branch. He wears the recolour for
  // the length of the taunt, which is what makes it a remark rather than a
  // costume change.
  let reset = false;
  for (let f = 0; f < 3000 && !reset; f++) {
    st.knight.hp = Math.min(st.knight.hp, 5000);
    st.knight.progamer = true;
    stepFrame(st, inp(st));
    keepAlive(st, { revive: true });
    if (knightOf(st)?.idlesprite === 'spr_roaringknight_idle') reset = true;
  }
  ok(reset, 'and the next turn start put the ordinary idle back (Step_0:494)');

  // V-C control: the whole block is inside `if (k_sideb)`.
  const c = build('C');
  const inpC = fightInput();
  for (let f = 0; f < 4000; f++) {
    c.knight.hp = Math.min(c.knight.hp, 5000);
    c.knight.progamer = true;
    stepFrame(c, inpC(c));
    keepAlive(c, { revive: true });
  }
  const cKn = knightOf(c);
  eq(cKn?.idlesprite ?? 'spr_roaringknight_idle', 'spr_roaringknight_idle',
    'V-C never recolours — the branch is inside if (k_sideb)');
}

// ═══════════════════════════════════════════════════════════════════════════
section('determinism — V-D with the party layer live');
{
  const run = (seed) => {
    const st = createState({ seed, traceBulletSlots: 8 });
    st.traceWide = true;
    buildKaizoScene(st, { version: 'D' });
    const inp = fightInput();
    for (let i = 0; i < 1500; i++) stepFrame(st, inp(st));
    return `${st.trace.join('\n')}|${st.partyHp.join(',')}|${st.kaizo.gloom.join(',')}`;
  };
  const a = run(777);
  eq(a, run(777), 'same seed, byte-identical incl. HP and gloom');
  ok(a !== run(778), 'different seed, different run');
}

// ═══════════════════════════════════════════════════════════════════════════
section('the DIRECTOR arms and runs the scenes (the wiring, not the module)');
{
  // check-scenes.mjs drives kaizo/party/scenes.js by hand and proves every
  // branch of it. What it cannot prove is that anything in a real fight ever
  // CALLS that module — and until 2026-09-10 nothing did: the scenes were
  // translated, checked, and unreachable. This section holds the wiring
  // itself, which is the difference between "the machine works" and "the
  // machine runs".
  //
  // The arm is scr_mnendturn's, inside `with (obj_knight_enemy) if (k_sideb
  // && !practicemode)`:  k_tpscene == 0 && kaizo_prevatk == "atk_Frenzy1"
  // && !haveusedroaring.  The director calls it from fireTurnEndAlarm, which
  // IS scr_mnendturn's site (Alarm_2).
  const st = build('D');
  const e = director(st);
  ok(!!e, 'V-D built a director');
  eq(st.kaizo.sideb, true, 'and it is the B-Side, which is what gates the scenes');

  // Run to the first turn end with the arm's precondition in place. The
  // recorded fight reaches atk_Frenzy1 on its own; here the label is set
  // directly so the section tests the WIRING rather than the schedule.
  const inp = fightInput();
  const knightOf = (st2) => st2.entities.find(
    (x) => x.alive && x.type?.name === 'obj_knight_enemy',
  );
  const kn0 = knightOf(st);
  ok(!!kn0, 'the fight has a live obj_knight_enemy to pose');
  const homeX = kn0?.xstart;
  let armed = false;
  let hijackedFrames = 0;
  let sawState10 = false;
  let sawTpSprite = false;
  let travel = 0;
  let swingIndex = 0;
  let poseGhosts = 0;
  let sawShake = false;
  const ghostsSeen = new Set();
  // KEEP THE PARTY UP, as every other live section does: a still soul eats
  // every bullet and a wiped party never reaches a turn END, which is the
  // one moment the arm can fire.
  for (let f = 0; f < 6000 && !armed; f++) {
    st.kaizo.prevatk = 'atk_Frenzy1';
    stepFrame(st, inp(st));
    keepAlive(st, { revive: true });
    if ((st.kaizo.tpscene ?? 0) > 0) armed = true;
  }
  ok(armed, 'the director armed k_tpscene at a turn end (scr_mnendturn:152-158)');
  if (armed) {
    const ladder = [];
    for (let f = 0; f < 600; f++) {
      const before = st.kaizo.tpscene;
      stepFrame(st, inp(st));
      keepAlive(st, { revive: true });
      if (st.kaizo.tpscene !== before) ladder.push(st.kaizo.tpscene);
      if (sceneHijacksTurn(st)) hijackedFrames += 1;
      if (st.knight?.animState === 10) sawState10 = true;
      // THE POSE IS ON THE REAL INSTANCE, which is the whole point of the
      // bind: every one of these reads obj_knight_enemy, not the module's
      // own bookkeeping.
      const kn = knightOf(st);
      if (kn) {
        travel = Math.max(travel, Math.abs(kn.x - homeX));
        if (kn.sprite_index === 'spr_roaringknight_attack_ol') {
          sawTpSprite = true;
          swingIndex = Math.max(swingIndex, kn.image_index);
        }
      }
      // The state-10 trail (Draw_0:93-141). fadeSpeed 0.02 is its signature;
      // the idle trail's is 0.04.
      for (const g of st.entities) {
        if (g.alive && g.type?.name === 'obj_afterimage'
            && g.fadeSpeed === 0.02 && !ghostsSeen.has(g)) {
          ghostsSeen.add(g);
          if (g.sprite_index === 'spr_roaringknight_attack_ol') poseGhosts += 1;
        }
      }
      if (st.entities.some((x) => x.alive && x.type?.name === 'obj_shake')) {
        sawShake = true;
      }
      if ((st.kaizo.tpscene ?? 0) === 0) break;
    }
    ok(ladder.length > 1, `and it ADVANCED through its state ladder (${ladder.slice(0, 6).join(' -> ')})`);
    ok(hijackedFrames > 0, 'the turn was HIJACKED while it ran (myfight/mnfight 99, charturn -1)');
    ok(sawState10, 'the knight went to state 10 (Step_0:1938)');
    ok(sawTpSprite,
      'and wore spr_roaringknight_attack_ol (Step_0:1941) on the INSTANCE');
    // He leaps to camerax() + 320, then camerax() + 48, then 64 further left:
    // from a home of 425 that is most of the screen. Under a hundred pixels
    // would mean the tweens are being recorded and not run.
    ok(travel > 300,
      `and CROSSED THE SCREEN to cut the bar (${Math.round(travel)}px from xstart)`);
    // scr_lerpvar("image_index", 3, 5, 3) — the swing itself (Step_0:1978).
    ok(swingIndex >= 5,
      `the SWING played, image_index reaching ${swingIndex} of 5 (Step_0:1978)`);
    // Draw_0:93-141, the state-10 trail: the ghosts wear his POSE, which is
    // what makes the leap smear rather than leaving idle copies behind.
    ok(poseGhosts > 0,
      `and left ${poseGhosts} pose afterimages behind him (Draw_0:96-104)`);
    ok(sawShake, 'the cut shook the screen (obj_shake, Step_0:1999-2004)');
    // scr_lerpvar("x", x, xstart, 25, _l, "inout") — Step_0:2020.
    const back = knightOf(st);
    ok(back && Math.abs(back.x - homeX) < 1,
      'and he came home to xstart when it ended (Step_0:2020)');
    eq(st.knight.animState, 0, 'with his state handed back to 0 (Step_0:2046)');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('the A-SIDE never reaches the scene driver');
{
  // The whole wiring is gated `if (state.kaizo?.sideb)`, and the A-Side byte
  // gate is what that gate protects: V-C must not so much as initialise the
  // scene state.
  const st = build('C');
  const inp = fightInput();
  for (let i = 0; i < 1200; i++) stepFrame(st, inp(st));
  eq(st.kaizo.sideb, false, 'V-C is the A-Side');
  ok(!(st.kaizo.tpscene > 0) && !(st.kaizo.nhscene > 0) && !(st.kaizo.sgscene > 0),
    'no scene armed on V-C after 1,200 frames');
  ok(!sceneHijacksTurn(st), 'and nothing hijacked its turn');
}

console.log(`\ncheck-weirdroute-live: ${checks - failures}/${checks} assertions passed`);
process.exit(failures === 0 ? 0 : 1);
