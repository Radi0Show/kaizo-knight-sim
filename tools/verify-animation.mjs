#!/usr/bin/env node
// THE PARTY'S AND THE KNIGHT'S ANIMATION — obj_heroparent's Step and
// obj_knight_enemy's hurt reaction.
//
// No oracle. What this pins is the handful of rules that are invisible when
// wrong — the party still draws, the Knight still stands there, and the fight
// looks almost right.
//
//   * `faceaction` does nothing until hero state 0 READS it, so choosing an
//     action is a POSE held through everyone else's turn, not an animation.
//   * Everything advances at 0.5 a frame. The battle is 30fps and the party
//     animates at 15.
//   * `image_index` must WRAP at the sprite's frame count — `siner / 5` grows
//     without bound and GameMaker's own wrap is what loops the idle.
//   * The Knight's strobe needs `stronghurtanim`, which needs damage >= 100.

import { createState, stepFrame } from '../sim/index.js';
import { buildPracticeScene } from '../sim/scenes/practice.js';
import { freshParty } from '../sim/damage.js';

const NONE = { left: false, right: false, up: false, down: false, focus: false };
import {
  createHeroes, stepHeroes, heroAct, HERO_SPRITES,
  FACE_IDLE, FACE_ATTACK, FACE_SPELL, FACE_ITEM, FACE_DEFEND, FACE_ACT,
  HERO_ACT, HERO_ITEM, HERO_SPELL,
} from '../sim/heroes.js';
import { createKnight, damageKnight, stepKnightAnim } from '../sim/knight.js';
import { createMenu, openMenu, stepMenu, BUTTONS } from '../sim/menu.js';
import { FACE_SPARE } from '../sim/heroes.js';

const failures = [];

function st() {
  const s = createState({ seed: 1 });
  s.heroes = createHeroes();
  s.partyHp = [160, 190, 140];
  return s;
}

// ── faceaction picks the standing pose ───────────────────────────────────
const poses = [
  [FACE_IDLE, 'idle'], [FACE_ATTACK, 'attackready'], [FACE_SPELL, 'spellready'],
  [FACE_ITEM, 'itemready'], [FACE_DEFEND, 'defend'], [FACE_ACT, 'actready'],
];
for (const [face, key] of poses) {
  const s = st();
  s.heroes[1].faceaction = face;
  stepHeroes(s);
  const want = HERO_SPRITES[1][key];
  if (s.heroes[1].sprite !== want) {
    failures.push(`faceaction ${face}: got ${s.heroes[1].sprite}, expected ${want}`);
  }
}

// KRIS HAS NO SPELLS — his spellready/spell ARE his ACT sprites, matching
// `global.spell[1][0] = 7` being named "ACT".
if (HERO_SPRITES[0].spellready !== HERO_SPRITES[0].actready) {
  failures.push("Kris's spellready is not his actready");
}
if (HERO_SPRITES[0].spell !== HERO_SPRITES[0].act) {
  failures.push("Kris's spell sprite is not his act sprite");
}

// THE POSE IS HELD. It must survive dozens of frames — it is what the
// character looks like for the whole rest of the turn.
{
  const s = st();
  s.heroes[0].faceaction = FACE_ATTACK;
  for (let i = 0; i < 90; i++) stepHeroes(s);
  if (s.heroes[0].sprite !== HERO_SPRITES[0].attackready) {
    failures.push('the attack pose did not hold for 90 frames');
  }
}

// ── the idle bob is siner / 5, and it must not run off the sprite ────────
{
  const s = st();
  for (let i = 0; i < 400; i++) stepHeroes(s);
  const h = s.heroes[0];
  if (h.sprite !== HERO_SPRITES[0].idle) failures.push('the idle did not stay idle');
  // `index` itself is unbounded — GameMaker wraps `image_index` on assignment,
  // and sim/actors.js does that with the sprite's frame count. What matters
  // here is that it is still ADVANCING at a fifth of a frame.
  if (Math.abs(h.index - 400 / 5) > 0.5) {
    failures.push(`idle index is ${h.index} after 400 frames, expected ~80`);
  }
}

// ── everything advances at HALF a frame ──────────────────────────────────
{
  const s = st();
  heroAct(s, 1, HERO_ITEM);
  stepHeroes(s);
  stepHeroes(s);
  if (Math.abs(s.heroes[1].attacktimer - 1) > 1e-9) {
    failures.push(`two frames of ITEM advanced ${s.heroes[1].attacktimer}, expected 1 (0.5 each)`);
  }
  if (s.heroes[1].sprite !== HERO_SPRITES[1].item) failures.push('ITEM drew the wrong sprite');
}

// ACT has TWO clamps: the pose stops at actframes, the state runs on to
// actreturnframes. Ending at actframes skips the hold at the top of the swing.
{
  const s = st();
  heroAct(s, 0, HERO_ACT);
  const spec = HERO_SPRITES[0];
  let poseCapped = false;
  for (let i = 0; i < 40; i++) {
    stepHeroes(s);
    if (s.heroes[0].state === HERO_ACT && s.heroes[0].index > spec.actframes + 1e-9) {
      failures.push('the ACT pose ran past actframes');
      break;
    }
    if (s.heroes[0].acttimer >= spec.actframes) poseCapped = true;
    if (s.heroes[0].state !== HERO_ACT) break;
  }
  if (!poseCapped) failures.push('the ACT never reached its pose clamp');
  if (s.heroes[0].state === HERO_ACT) failures.push('the ACT never returned to idle');
  if (s.heroes[0].faceaction !== FACE_IDLE) failures.push('the ACT left a stale pose');
}

// A timed animation must END and drop back to idle, or the character is stuck
// — and it ends on the SIXTEENTH step, for every character. obj_heroparent's
// state-2/state-4 blocks arm `spelltimer = 16` on entry and the top-level
// countdown (Step:444-461, outside the hp wrapper) sets `state = 0;
// attacktimer = 0` when it reaches 0, with the entry frame's own decrement
// counting. Ralsei (itemframes 6, spellframes 10) is the one whose frame
// counts differ most from Susie's, so both are checked: the exit does not
// depend on the frame count. Used to accept any return within 200 steps,
// which let the invented `frames + 8` exit (27-37 steps) pass.
for (const [hs, label] of [[HERO_ITEM, 'ITEM'], [HERO_SPELL, 'SPELL']]) {
  for (const c of [1, 2]) {
    const s = st();
    heroAct(s, c, hs);
    for (let i = 0; i < 15; i++) stepHeroes(s);
    if (s.heroes[c].state !== hs) failures.push(`${label} on ${c} left the pose before step 16`);
    stepHeroes(s);
    if (s.heroes[c].state !== 0) failures.push(`${label} on ${c} did not return to idle at exactly step 16`);
    if (s.heroes[c].attacktimer !== 0) failures.push(`${label} on ${c} returned with attacktimer ${s.heroes[c].attacktimer}`);
    if (s.heroes[c].faceaction !== FACE_IDLE) failures.push(`${label} on ${c} left a stale ready-pose`);
  }
}

// A DOWNED character runs none of the machine — `if (global.hp[...] > 0)`
// wraps the whole Step — and holds the defeat pose.
{
  const s = st();
  s.partyHp[2] = -999;
  s.heroes[2].faceaction = FACE_ATTACK;
  stepHeroes(s);
  if (s.heroes[2].sprite !== HERO_SPRITES[2].defeat) {
    failures.push(`a downed character drew ${s.heroes[2].sprite}, expected the defeat pose`);
  }
}

// ── the Knight's hurt reaction ───────────────────────────────────────────
// `stronghurtanim` NEEDS DAMAGE >= 100. Below that there is no strobe at all,
// because the Draw's test reads `|| stronghurtanim == false` and takes the
// plain-idle branch whenever it is unset.
{
  const s = st();
  s.knight = createKnight();
  damageKnight(s, 99);
  if (s.knight.stronghurtanim) failures.push('99 damage set stronghurtanim');
  if (s.knight.hurttimer !== 30) failures.push(`hurttimer is ${s.knight.hurttimer}, expected 30`);
  if (s.knight.shakex !== 9) failures.push(`shakex is ${s.knight.shakex}, expected 9`);
}
{
  const s = st();
  s.knight = createKnight();
  damageKnight(s, 100);
  if (!s.knight.stronghurtanim) failures.push('100 damage did not set stronghurtanim');
  // It clears at hurttimer 15 — halfway through the 30-frame reaction.
  for (let i = 0; i < 15; i++) stepKnightAnim(s);
  if (s.knight.stronghurtanim) failures.push('stronghurtanim did not clear at hurttimer 15');
  // IT RESTS AT -1, NOT 0, and the difference is measured rather than
  // reasoned. scr_enemy_hurt is
  //
  //     hurttimer -= 1;
  //     if (hurttimer < 0) state = 0;
  //
  // called from `if (state == 3)`, so the counter passes THROUGH zero and the
  // hurt ends on the frame it goes negative -- one frame later than a model
  // that stops at 0. This used to expect 0, which is what a floored
  // `if (hurttimer > 0)` produces; the extended ending recording rules that
  // out directly, because the ending pins state to 3 and oracle_end.csv shows
  // hurttimer running on down to -1, -2, -3 ... which a floor cannot reach.
  for (let i = 0; i < 20; i++) stepKnightAnim(s);
  if (s.knight.hurttimer !== -1) {
    failures.push(`hurttimer rests at ${s.knight.hurttimer}, expected -1`);
  }
  if (s.knight.animState !== 0) failures.push('the Knight stayed in the hurt state');
  if (s.knight.shakex !== 0) failures.push(`shake settled at ${s.knight.shakex}, expected 0`);
}
// THE COUNTER MUST NOT FLOOR. Pin the exact frame the hurt ends: 30 steps
// leave it at 0 and STILL hurt, the 31st takes it to -1 and ends it. A floored
// decrement passes the resting-value check above by accident, so this is the
// assertion that actually discriminates the two models.
{
  const s = st();
  s.knight = createKnight();
  damageKnight(s, 100);
  for (let i = 0; i < 30; i++) stepKnightAnim(s);
  if (s.knight.hurttimer !== 0) failures.push(`after 30 steps hurttimer is ${s.knight.hurttimer}, expected 0`);
  if (s.knight.animState !== 3) failures.push('the hurt ended at 0 — it must run until the counter goes NEGATIVE');
  stepKnightAnim(s);
  if (s.knight.hurttimer !== -1) failures.push(`the 31st step gave ${s.knight.hurttimer}, expected -1`);
  if (s.knight.animState !== 0) failures.push('the hurt did not end when the counter went negative');
}
// AND WHILE THE ENDING HOLDS state == 3, IT KEEPS FALLING. This is the shape
// oracle_end.csv actually recorded: the ending forces the hurt state every
// frame, so the counter runs far negative and the strobe's `hurttimer % 3`
// keeps cycling instead of sticking on the idle frame.
{
  const s = st();
  s.knight = createKnight();
  damageKnight(s, 100);
  for (let i = 0; i < 40; i++) { s.knight.animState = 3; stepKnightAnim(s); }
  if (s.knight.hurttimer !== -10) {
    failures.push(`held in state 3, hurttimer reached ${s.knight.hurttimer}, expected -10`);
  }
}
// The shake must ALTERNATE SIGN as it decays — that is what makes it a shake
// and not a slide. A monotonic decay looks like the Knight drifting.
{
  const s = st();
  s.knight = createKnight();
  damageKnight(s, 200);
  const xs = [];
  for (let i = 0; i < 5; i++) { stepKnightAnim(s); xs.push(s.knight.shakex); }
  const signs = xs.filter((v) => v !== 0).map((v) => Math.sign(v));
  if (new Set(signs).size < 2) failures.push(`the shake never changed sign: ${xs.join(',')}`);
}

console.log('poses: ' + poses.map(([f, k]) => `${f}->${k}`).join(' '));
console.log('all hero animation advances 0.5/frame; ACT clamps pose at actframes, state at actreturnframes');
console.log('knight: hurttimer 30, shakex 9, strobe only at damage >= 100, stronghurtanim clears at 15');

if (failures.length) {
  console.log('');
  for (const f of failures) console.log(`→ FAILURE  ${f}`);
  process.exit(1);
}
console.log('\nPASS  party and knight animation (no oracle — see header)');

// ── THE BAR ENDS THE ATTACK POSE ─────────────────────────────────────────
//
// Two symptoms, one cause, both reported from watching the game:
// "Susie's animation stops on one sprite for a bit" and "the attack bar stays
// and looks weird after you attack".
//
// obj_attackpress reaches through and resets everyone at the moment its fade
// STARTS, not when it ends:
//
//     if (posttimer > timermax) {
//         fade = 1;
//         with (obj_heroparent) {
//             if (state == 1) state = 0;
//             attacked = 0;
//             itemed = 0;
//         }
//     }
//     if (fade == 1) {
//         fadeamt += 0.08;
//         draw_rectangle(x - 1, y, x + 640, y + 300);   // black, alpha fadeamt
//         if (fadeamt > 1) instance_destroy();
//     }
//
// So the attacker holds their swing for the whole `timermax` window and is
// cut back to idle when the black fade begins — the bar is what ends the
// pose, and nothing else does. `state == 1` is tested specifically, so a
// character mid-ITEM or mid-SPELL is untouched.
{
  const s = createState({ seed: 4, traceBulletSlots: 0 });
  buildPracticeScene(s, { seed: 4 });

  let confirmPulse = false;
  const drive = () => {
    if (!s.menu?.open) return NONE;
    confirmPulse = !confirmPulse;
    return { ...NONE, confirm: confirmPulse };
  };

  let sawAttackPose = false;
  let poseEndedWithFade = false;
  let sawFade = false;

  for (let f = 0; f < 900; f++) {
    stepFrame(s, drive());
    s.partyHp = freshParty();
    s.gameOver = false;

    const attacking = (s.heroes ?? []).some((h) => h.state === 1);
    if (attacking) sawAttackPose = true;

    if (s.fightBar?.fade) {
      sawFade = true;
      // On any frame the fade is running, nobody may still be mid-swing.
      if (!attacking) poseEndedWithFade = true;
      else poseEndedWithFade = false;
    }
  }

  if (!sawAttackPose) failures.push('no character ever entered the attack pose');
  if (!sawFade) failures.push('the bar never started its black fade');
  if (sawFade && !poseEndedWithFade) {
    failures.push('a character was still in the attack pose while the bar faded '
      + '— the bar is what ends it');
  }
}

// ── THE POSE IS SET AT THE COMMIT, NEVER AT THE MENU STAGE ────────────────
//
// Reported from play: "using rude buster but then cancelling makes the sprite
// of susie preparing still show". This build wrote `faceaction` when a BUTTON
// opened its submenu — FIGHT, MAGIC, ACT, SPARE and ITEM alike — so pressing X
// out of the spell grid left Susie standing in her cast pose with no spell
// queued behind it, for the rest of the turn.
//
// The dump never does that. Every non-zero faceaction assignment in the game
// sits beside the `charaction` it belongs to, in the code that ENDS the
// selection: Step_0:1322 (attack), scr_spellconsumeb:4, scr_itemconsumeb:3,
// Step_0:507 (defend), scr_actselect:49/59, Step_0:1397 (spare). DEFEND is the
// only one written by a button, because for DEFEND the button IS the commit.
//
// BOTH HALVES ARE ASSERTED. The negative one alone passes on an engine that
// has simply deleted every setFace call.
{
  const NOBTN = { up: false, down: false, left: false, right: false, confirm: false, cancel: false };
  const tap = (s, key) => {
    stepMenu(s, { ...NOBTN, [key]: true });
    for (let i = 0; i < 6; i += 1) {
      if (s.menu.onebuffer < 0 && s.menu.twobuffer < 0) break;
      stepMenu(s, { ...NOBTN });
    }
    stepMenu(s, { ...NOBTN });
  };
  const btnName = (s, c) => {
    const n = BUTTONS[s.menu.selected[c]].name;
    return typeof n === 'function' ? n(c) : n;
  };
  const open = (c) => {
    const s = st();
    s.menu = createMenu();
    s.charaction = [0, 0, 0];
    s.charspecial = [0, 0, 0];
    openMenu(s);
    // Enough TP that no spell is greyed out — an unaffordable row refuses the
    // confirm, and the walk would then be measuring the refusal, not the commit.
    s.tension = 500;
    if (s.temptension) s.temptension = s.temptension.map(() => 500);
    s.menu.charturn = c;
    return s;
  };
  const goto = (s, c, label) => {
    for (let i = 0; i <= BUTTONS.length; i += 1) {
      if (btnName(s, c) === label) return true;
      tap(s, 'right');
    }
    return false;
  };
  const face = (s, c) => s.heroes[c].faceaction;

  // Susie is slot 1 and Rude Buster is hers — the exact report.
  for (const [label, c, confirms, pose] of [
    ['FIGHT', 0, 2, FACE_ATTACK],   // button -> enemy row -> commit
    ['MAGIC', 1, 3, FACE_SPELL],    // button -> grid -> target -> commit
    ['ITEM',  0, 2, FACE_ITEM],     // button -> bag -> commit
    ['ACT',   0, 3, FACE_ACT],      // Kris's slot-1 button IS act; button -> picker -> grid -> commit
  ]) {
    // every stage BEFORE the last confirm must leave the pose alone...
    for (let stage = 1; stage < confirms; stage += 1) {
      const s = open(c);
      if (!goto(s, c, label)) { failures.push(`${label} is not on the button row`); break; }
      for (let i = 0; i < stage; i += 1) tap(s, 'confirm');
      if (face(s, c) !== FACE_IDLE) {
        failures.push(`${label}: the pose was set after ${stage} confirm(s), before the `
          + `commit — faceaction ${face(s, c)} with the menu still in `
          + `'${s.menu.submenu}'. That is the stuck-pose bug.`);
      }
      // ...and backing out of it must leave nothing behind
      for (let i = 0; i < stage; i += 1) tap(s, 'cancel');
      if (face(s, c) !== FACE_IDLE) {
        failures.push(`${label}: cancelling out of stage ${stage} left faceaction `
          + `${face(s, c)} standing`);
      }
    }

    // ...and the commit must actually set it
    const s = open(c);
    if (!goto(s, c, label)) continue;
    for (let i = 0; i < confirms; i += 1) tap(s, 'confirm');
    if (face(s, c) !== pose) {
      failures.push(`${label}: the commit did not set the pose — faceaction `
        + `${face(s, c)}, expected ${pose}`);
    }
  }

  // SPARE commits on the second press like FIGHT, and its pose is the only one
  // above 6 (Step_0:1397, beside `charspecial = 100`).
  {
    const s = open(0);
    if (goto(s, 0, 'SPARE')) {
      tap(s, 'confirm');
      if (face(s, 0) !== FACE_IDLE) {
        failures.push(`SPARE: the pose was set when the button opened the target row `
          + `— faceaction ${face(s, 0)}`);
      }
      tap(s, 'confirm');
      if (face(s, 0) !== FACE_SPARE) {
        failures.push(`SPARE: the confirm did not set the pose — faceaction ${face(s, 0)}`);
      }
    } else {
      failures.push('SPARE is not on the button row');
    }
  }

  // DEFEND is the exception and must stay one: its button has no submenu, so
  // the press that chooses it is the press that ends the selection.
  {
    const s = open(0);
    if (goto(s, 0, 'DEFEND')) {
      tap(s, 'confirm');
      if (face(s, 0) !== FACE_DEFEND) {
        failures.push(`DEFEND: one press is the whole command and it must set the pose `
          + `— faceaction ${face(s, 0)}`);
      }
    } else {
      failures.push('DEFEND is not on the button row');
    }
  }
}

if (failures.length) {
  for (const f of failures) console.log(`→ FAILURE  ${f}`);
  process.exit(1);
}
console.log('the attack bar ends the attack pose and fades to black before it goes');
