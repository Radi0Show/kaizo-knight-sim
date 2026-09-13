// THE ENDING CUTSCENE THE MOD REPLACED — ledger G-14 and G-16.
//
// `sim/victory-scene.js` plays the VANILLA knighting, and a won fight on V-C
// played it: the Knight reposition to (2326, 44), the held
// `spr_roaring_knight_kris_knighting`, Kris hidden inside the art, the blade
// lowering, `spr_krisb_defeat`. EnderCat8 deleted every line of that and put a
// third slash there instead. Everything asserted below is read out of
// `gml_Object_obj_ch3_PTB02_Step_0.gml:1009-1177` against the v105 comparison
// tree's `:880-1008`.
//
// THE ATTRIBUTION HERE IS NARROWER THAN THIS COMMENT ONCE CLAIMED. It said
// the retail Chapter 3 dump is byte-identical to the comparison tree for this
// file, "so none of it is official churn read backwards". The premise is true
// and the conclusion does not follow: BOTH of those trees are chapter build
// v0.0.105 (`obj_initializer2_Create_0.gml` reads `global.versionno =
// "v0.0.105"` in each), and the MOD is built on v0.0.091. Two dumps of one
// build agreeing tells you they are one build; it carries no information
// about what Toby changed between 0.0.091 and 0.0.105. Roughly 170 of the
// ledger's 845 audit rows turned out to be exactly that churn running
// backwards, so this is not a hypothetical.
//
// What IS unambiguously EnderCat8's: the `kaizo_`-prefixed additions, the
// `%%` truncations, the 8 -> 12 volume changes and the funchance arm — none
// of which exist in any retail build. What remains UNDECIDABLE without a
// v0.0.091 dump: the two `spr_krisb_defeat` -> `spr_kris_fell` swaps. They
// are translated as the mod has them, which is correct either way; only the
// question of whose change it was is open.
//
// WHAT THIS FILE IS FOR, beyond the numbers: the seam has TWO ends and this
// repo's signature defect is a value written where nothing reads it — with the
// mirror image, a reader facing no writer, being how `hooks.charName` printed
// "Susie" for Noelle for months. So the assertions here are arranged so that
// deleting EITHER end fails them:
//
//   the WRITER   `setVictoryVariant(...)` in `buildKaizoScene`
//                (kaizo/scenes/kaizo-fight.js)
//   the READER   `createVictoryScene()` reading the installed variant
//                (sim/victory-scene.js) — exercised through the page's own
//                zero-argument call, not a re-implementation of it
//   the DRAWER   `render/draw/victory-scene.js` reading `sc.lines`, without
//                which the truncated taunts are computed and shown to nobody
//
// It also compares the SHARED clash block against the second translation of
// it in `kaizo/scenes/kaizo-ending.js` (the B-Side epilogue truncates the same
// `susie_knight_slash` handler at its own `sb_timer 124`). Two copies of one
// measurement with nothing comparing them is how they come to disagree.
//
// Run: node kaizo/tools/checks/check-kaizo-victory.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  createVictoryScene, stepVictoryScene, getVictoryVariant, setVictoryVariant,
  buildVictoryScript, VICTORY_LINES, VICTORY_CLASH, CUT_VOLUME,
} from '../../../sim/victory-scene.js';
import { createState } from '../../../sim/index.js';
import {
  buildKaizoScene, buildKaizoVictoryScript, KAIZO_VICTORY_LINES,
  KAIZO_VICTORY_VARIANT, KAIZO_CUT_VOLUME, KAIZO_KNIGHTING_SLASH_XY,
  kaizoEndingRouteFor,
} from '../../scenes/kaizo-fight.js';
import {
  CAM_X, CLASH_CAM_X, CLASH_SHAKE_TIME, CLASH_SHAKE_STEP, CLASH_SHAKE_FLOOR,
  CLASH_FINISH_TIME, CLASH_JUMP_BACK_TIME, WARP_SETTLE,
} from '../../scenes/kaizo-ending.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };
const eq = (got, want, msg) => ok(
  Object.is(got, want), `${msg} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
);

const IDLE = {
  left: 0, right: 0, up: 0, down: 0, focus: 0, confirm: 0, cancel: 0, button3: 0,
};

/** Build a kaizo fight exactly as the page does, then open its ending exactly
 *  as the page does — `createVictoryScene()`, no arguments. */
function endingFor(version) {
  const st = createState({ seed: 4242 });
  buildKaizoScene(st, { version });
  return { st, sc: createVictoryScene() };
}

/**
 * Run a scene, mashing confirm on a duty cycle (the writer gate is
 * edge-triggered and the scene starts with confirm HELD), recording a sample
 * per frame.
 */
function run(sc, frames, watch) {
  const seen = [];
  const cues = [];
  for (let f = 0; f < frames; f++) {
    const before = cues.length;
    stepVictoryScene(sc, { ...IDLE, confirm: f % 8 < 3 ? 1 : 0 }, cues);
    if (watch) {
      const v = watch(sc, f, cues.slice(before));
      if (v !== undefined) seen.push(v);
    }
    if (sc.done) break;
  }
  return { seen, cues };
}

// ══════════════════════════════════════════════════════════ A. THE SEAM ════
// Both ends, through the production call. If `buildKaizoScene` stops
// installing, or `createVictoryScene` stops reading, this block goes red.
{
  const { sc } = endingFor('C');
  eq(getVictoryVariant()?.name, 'kaizo-v233-aside',
    'A1 buildKaizoScene({version:C}) INSTALLS the mod ending (the WRITER)');
  eq(sc.variant, 'kaizo-v233-aside',
    'A2 createVictoryScene() — the page\'s own zero-argument call — reads it back (the READER)');
  eq(KAIZO_CUT_VOLUME, 12,
    'A3a all ten snd_knight_cut2 go volume 8 -> 12 (G-16) — the LITERAL, so the assertions '
    + 'below cannot be satisfied by the constant and the cue agreeing on a wrong number');
  eq(sc.cutVolume, 12, 'A3b the scene carries it');
  ok(sc.lines === KAIZO_VICTORY_LINES, 'A4 the scene carries the mod\'s dialogue table');
  ok(typeof sc.ops?.knightingSlash === 'function' && typeof sc.ops?.krisFell === 'function',
    'A5 the scene carries the mod\'s two extra ops');
}
{
  // V-A IS NOT THE MOD, and the install is TOTAL: opening the remix after the
  // recreation must put the vanilla knighting back.
  const { sc } = endingFor('A');
  eq(getVictoryVariant(), null, 'A6 a version without `knight` RESTORES vanilla');
  eq(sc.variant, null, 'A7 ...and its scene is the vanilla one');
  eq(sc.cutVolume, CUT_VOLUME, 'A8 ...at vanilla cut volume 8');
  ok(sc.lines === VICTORY_LINES, 'A9 ...with the vanilla dialogue table');
  eq(JSON.stringify(sc.script), JSON.stringify(buildVictoryScript()),
    'A10 ...and the vanilla script, beat for beat');
}
{
  // V-D installs it and forks away from it. Both halves stated, because the
  // pair is the whole claim: armed, and not played.
  const st = createState({ seed: 7 });
  buildKaizoScene(st, { version: 'D' });
  eq(getVictoryVariant()?.name, 'kaizo-v233-aside', 'A11 V-D arms the same A-Side ending');
  eq(kaizoEndingRouteFor(st), 'bside', 'A12 ...and a V-D win forks to the B-Side epilogue instead');
}

// ════════════════════════════════════════════ B. THE SCRIPT'S THREE EDITS ══
{
  const vanilla = buildVictoryScript();
  const kaizo = buildKaizoVictoryScript();
  const opsOf = (s) => s.map(([op]) => op);

  ok(opsOf(vanilla).includes('laughAgain'),
    'B1 the vanilla script HAS the second laugh (else the deletion below proves nothing)');
  ok(!opsOf(kaizo).includes('laughAgain'),
    'B2 FIVE BEATS DELETED: spr_susie_laugh_dw @0.25, loopsfx 169, c_wait(26), loopsfxstop');
  ok(!opsOf(kaizo).includes('knighting'),
    'B3 the vanilla knighting beat is GONE (Step_0:1143-1149 deletes all six of its lines)');
  ok(!opsOf(kaizo).includes('krisDown'),
    'B4 ...and so is the spr_krisb_defeat reveal');
  ok(opsOf(kaizo).includes('knightingSlash'), 'B5 a third slash stands where the knighting was');
  ok(opsOf(kaizo).includes('krisFell'), 'B6 ...and the last reveal is spr_kris_fell');

  // THREE SWOONS, not two. Susie, Ralsei, and now Kris — `swoon_target =
  // kr_actor` (Step_0:1157), the line the vanilla script has no counterpart for.
  const reveals = kaizo.filter(([op]) => op === 'reveal').map(([, who]) => who);
  eq(JSON.stringify(reveals), JSON.stringify(['susie', 'ralsei', 'kris']),
    'B7 three SWOON reveals — the mod cuts Kris down too');
  eq(JSON.stringify(vanilla.filter(([op]) => op === 'reveal').map(([, w]) => w)),
    JSON.stringify(['susie', 'ralsei']), 'B8 vanilla has two');

  // THE SHARED PREFIX IS SHARED, not retyped. Everything up to the deleted
  // laugh must be the vanilla script's own beats, or the derivation has become
  // a second copy that can drift.
  const cut = opsOf(vanilla).indexOf('laughAgain');
  eq(JSON.stringify(kaizo.slice(0, cut)), JSON.stringify(vanilla.slice(0, cut)),
    'B9 the script is DERIVED: every beat before the first edit is vanilla\'s own');

  // ...and it must still be a fresh array each call (the scene mutates
  // nothing, but the engine's contract says so and a shared frozen literal
  // would break a second playthrough).
  ok(buildKaizoVictoryScript() !== kaizo, 'B10 a fresh script array per call');
}

// ═══════════════════════════════════════ C. THE TRUNCATED LINES, AND `%` ═══
{
  eq(KAIZO_VICTORY_LINES[4].text, '* Not so tough NOW, are y',
    'C1 Susie\'s taunt is cut mid-word (Step_0:1026)');
  eq(KAIZO_VICTORY_LINES[6].text, '* H.. how cou',
    'C2 Ralsei\'s grief line is cut mid-word (Step_0:1070)');
  eq(KAIZO_VICTORY_LINES.length, VICTORY_LINES.length,
    'C3 same indices as the engine table — the renderer\'s face-frame map is keyed by index');
  for (const i of [0, 1, 2, 3, 5]) {
    eq(KAIZO_VICTORY_LINES[i].text, VICTORY_LINES[i].text, `C4.${i} line ${i} is untouched`);
    ok(!KAIZO_VICTORY_LINES[i].noWait, `C5.${i} ...and still waits for a press`);
  }
  eq(KAIZO_VICTORY_LINES[4].speaker, 'susie', 'C6 speaker preserved (the \\EY face code is unchanged)');
  eq(KAIZO_VICTORY_LINES[6].speaker, 'ralsei', 'C7 speaker preserved');
}
{
  // THE MECHANISM, not just the text. `%%` ends the message the frame the
  // writer finishes it; vanilla's `/%` waits for a press. Drive both scenes to
  // the taunt, then STOP PRESSING: the mod's line clears itself and vanilla's
  // does not. Positive AND negative, because only the pair says it is the `%`
  // doing the work rather than the scene running on regardless.
  const reachLine4 = (sc) => {
    for (let f = 0; f < 4000; f++) {
      if (sc.dialogue?.line === 4) return true;
      stepVictoryScene(sc, { ...IDLE, confirm: f % 8 < 3 ? 1 : 0 }, []);
    }
    return false;
  };
  const clearsWithoutAPress = (sc) => {
    for (let f = 0; f < 400; f++) {
      stepVictoryScene(sc, { ...IDLE }, []);
      if (sc.dialogue === null) return true;
    }
    return false;
  };

  const { sc: kaizoSc } = endingFor('C');
  ok(reachLine4(kaizoSc), 'C8 the mod scene reaches Susie\'s taunt');
  ok(clearsWithoutAPress(kaizoSc),
    'C9 ...and it ENDS ITSELF — a bare `%`, so the slash lands mid-word with no beat');

  const { sc: vanillaSc } = endingFor('A');
  ok(reachLine4(vanillaSc), 'C10 the vanilla scene reaches the same line');
  ok(!clearsWithoutAPress(vanillaSc),
    'C11 ...and it WAITS — vanilla\'s `/%` gates on a press, so C9 is the `%` and not the clock');
}

// ═══════════════════════════════════════════════ D. THE THIRD SLASH ITSELF ══
{
  const { sc } = endingFor('C');
  const A = sc.actors;
  const k = sc.knight;
  let krisHidden = false;
  let knightRepositioned = false;
  let krisbDefeat = false;
  let slashAtKnighting = false;
  let krisFellWhileBlack = false;

  const { cues } = run(sc, 6000, (s) => {
    if (!s.actors.kris.visible) krisHidden = true;
    if (s.knight.x === 2326 || s.knight.y === 44) knightRepositioned = true;
    if (s.actors.kris.sprite === 'spr_krisb_defeat') krisbDefeat = true;
    if (s.slash.visible
      && s.slash.x === KAIZO_KNIGHTING_SLASH_XY[0]
      && s.slash.y === KAIZO_KNIGHTING_SLASH_XY[1]) {
      slashAtKnighting = true;
      if (s.actors.kris.sprite === 'spr_kris_fell' && s.white.visible && s.white.black) {
        krisFellWhileBlack = true;
      }
    }
    return undefined;
  });

  ok(sc.done, 'D1 the mod ending runs to its end');
  ok(slashAtKnighting,
    `D2 a white_slash marker at (${KAIZO_KNIGHTING_SLASH_XY.join(', ')}) — the third cut (Step_0:1146-1148)`);
  ok(krisFellWhileBlack,
    'D3 ...and Kris is spr_kris_fell behind the black whiteall on that frame (Step_0:1150-1151)');
  ok(!knightRepositioned,
    'D4 the Knight is NEVER moved to (2326, 44) — all six knighting lines are deleted, so the '
    + 'knighting sprite is assigned to an instance that is still off-frame from Susie\'s cut');
  ok(!krisHidden,
    'D5 Kris is NEVER hidden — `c_sel(kr); c_visible(0)` is deleted (he does not kneel in the art)');
  ok(!krisbDefeat,
    'D6 spr_krisb_defeat never appears — the knighted pose belongs to a knighting that never happens');
  eq(A.kris.sprite, 'spr_kris_fell', 'D7 the last reveal is spr_kris_fell (Step_0:1168)');
  eq(k.x, 2655, 'D8 ...and the Knight returns to 2655 with his sword, as vanilla does');
  eq(k.sprite, 'spr_roaringknight_idle_overworld_sword', 'D9 ...in the sword idle');

  // FIFTEEN CUTS AT TWELVE. Susie 5 + Ralsei 5 (G-16 raises both sets from 8)
  // + the new five (G-14). Vanilla plays ten, at eight.
  const cuts = cues.filter((c) => c.name === 'snd_knight_cut2');
  eq(cuts.length, 15, 'D10 fifteen snd_knight_cut2 — the mod adds a third set of five');
  ok(cuts.every((c) => c.gain === 12),
    'D11 ...every one of them at volume 12 (G-16: all ten go 8 -> 12)');
  eq(JSON.stringify(cuts.slice(0, 5).map((c) => c.pitch)),
    JSON.stringify([0.06, 0.1, 0.12, 0.18, 0.24]),
    'D12 ...on the script\'s own five pitches');

  // THREE SWOON WRITERS ON SCREEN, one per fallen party member.
  eq(sc.swoons.length, 3, 'D13 three SWOON writers — Susie, Ralsei, Kris');
}
{
  // The vanilla scene, for contrast — the same run, the numbers it should
  // still produce. If the seam ever leaked into vanilla this is what catches it.
  const { sc } = endingFor('A');
  let staged = false;
  let hidden = false;
  const { cues } = run(sc, 6000, (s) => {
    if (s.knight.x === 2326 && s.knight.y === 44) staged = true;
    if (!s.actors.kris.visible) hidden = true;
    return undefined;
  });
  const cuts = cues.filter((c) => c.name === 'snd_knight_cut2');
  eq(cuts.length, 10, 'D14 vanilla plays TEN cuts');
  ok(cuts.every((c) => c.gain === CUT_VOLUME), 'D15 ...at volume 8');
  eq(sc.swoons.length, 2, 'D16 ...and two SWOONs');
  eq(sc.actors.kris.sprite, 'spr_krisb_defeat', 'D17 ...ending on the knighted pose');
  ok(staged,
    'D18 ...with the Knight STAGED at (2326, 44) for the knighting — the six lines the mod deletes '
    + '(he resumes hovering at the end, so this is a during-the-run observation, not a final state)');
  ok(hidden, 'D19 ...and Kris hidden inside the art while it plays');
}

// ═════════════════════════════════════ E. THE TWO COPIES OF THE CLASH ══════
// `susie_knight_slash` (Step_0:1222-1406) is translated in sim/victory-scene.js
// for the A-Side ending and again in kaizo/scenes/kaizo-ending.js for the
// B-Side epilogue, which truncates the same handler at `sb_timer 124`. Nothing
// compared them until now.
{
  const pairs = [
    ['camX', VICTORY_CLASH.camX, CAM_X, 'the resting camera'],
    ['clashCamX', VICTORY_CLASH.clashCamX, CLASH_CAM_X, 'the pan out to the charge'],
    ['shakeTime', VICTORY_CLASH.shakeTime, CLASH_SHAKE_TIME, 'the first grinding-hit interval'],
    ['shakeStep', VICTORY_CLASH.shakeStep, CLASH_SHAKE_STEP, 'how much it shrinks per hit'],
    ['shakeFloor', VICTORY_CLASH.shakeFloor, CLASH_SHAKE_FLOOR, 'where the grinding stops'],
    ['finishTime', VICTORY_CLASH.finishTime, CLASH_FINISH_TIME, 'the parry'],
    ['jumpBackTime', VICTORY_CLASH.jumpBackTime, CLASH_JUMP_BACK_TIME, 'the leap back / the shard'],
    ['warpSettle', VICTORY_CLASH.warpSettle, WARP_SETTLE, 'the warp settling into state 3'],
  ];
  for (const [name, engine, epilogue, what] of pairs) {
    eq(engine, epilogue,
      `E.${name} the two translations of ${what} must agree (sim/victory-scene.js vs kaizo-ending.js)`);
  }
  // The values themselves, so "they agree" cannot be satisfied by both being
  // wrong in the same way.
  eq(VICTORY_CLASH.finishTime, 300, 'E1 the parry is at 300');
  eq(VICTORY_CLASH.jumpBackTime, 320, 'E2 the leap back is at 320');
  eq(VICTORY_CLASH.shakeTime, 80, 'E3 the grinding starts at 80');
  eq(VICTORY_CLASH.warpSettle, 95, 'E4 the warp settles at 95');
}

// ═══════════════════════════════════════════════ F. THE PRODUCTION WIRING ══
// Source assertions, because the two files below cannot be imported here:
// `web/kaizo.js` touches `window` on load, and the drawer is a canvas module.
// Each of these is a READER that, if it went away, would leave this lane's
// work computed and shown to nobody.
{
  // COMMENTS ARE STRIPPED FIRST. Every one of these files documents the thing
  // being asserted, so a bare grep keeps passing over a deleted reader while
  // its explanation stands — measured: sabotaging the drawer's `sc.lines` read
  // left this block green until the stripper went in.
  const code = (...rel) => readFileSync(join(ROOT, ...rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

  const page = code('web', 'kaizo.js');
  ok(/createVictoryScene\(\)/.test(page),
    'F1 the page still opens the A-Side ending with the zero-argument call the seam is built around');
  ok(/from '\.\.\/kaizo\/scenes\/kaizo-fight\.js'/.test(page)
    || /kaizo-fight\.js'/.test(page),
    'F2 ...and the same page builds the fight through kaizo-fight.js, so the install precedes the read');

  const drawer = code('render', 'draw', 'victory-scene.js');
  ok(/sc\.lines/.test(drawer),
    'F3 the drawer reads `sc.lines` — without it the truncated taunts are drawn by nobody, '
    + 'which is this repo\'s signature defect wearing the renderer\'s hat');

  const engine = code('sim', 'victory-scene.js');
  ok(/line\.noWait/.test(engine),
    'F4 the engine\'s dialogue gate reads `noWait` — the whole point of the `%` truncation');
  ok(/sc\.ops\?\.\[op\]/.test(engine),
    'F5 the engine dispatches a variant\'s own ops');

  const scene = code('kaizo', 'scenes', 'kaizo-fight.js');
  ok(/setVictoryVariant\(/.test(scene),
    'F6 the build INSTALLS the variant — the writer half of the seam');
}

// ═══════════════════════════════════════════════════════════════════════════
// Leave the module-level install as we found it: this file is run inside
// verify-kaizo alongside other checks, and a stray variant would follow them.
setVictoryVariant(null);

if (fail.length) {
  console.log(`FAIL check-kaizo-victory (${fail.length}):`);
  for (const f of fail) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('check-kaizo-victory: the mod\'s ending cutscene — G-14 + G-16, both ends of the seam');
