// KAIZO V-C — the version hooks that make the kaizo turn loop run
// EnderCat8's mod: the nextAttack chain with its AfterFinal resume-replay,
// the 60% HP gate with the DYNAMIC phase-4 entry, the mod's DR ramp, the
// AT 52 / DF 5 stat block, and the post-ROARING kaizo_block guard.
//
// Semantics transcribed from the mod's obj_knight_enemy Step_0 (see
// knight-research/kaizo-mod/NOTES.md). PUBLISH GATE applies (HANDOFF §5-C).

import { gmlRound } from '../../sim/gml.js';
import { statFor, PARTY_POS } from '../../sim/damage.js';
import { castRudeBuster } from '../../sim/rudebuster.js';
import { krisMult } from '../../sim/knight.js';
import {
  launchVCAttack, openVCArena, vcTurnLength, vcMoveheartDest,
} from './kaizo-mod-launcher.js';
import {
  kaizoKnightActor, kaizoBlockStepTail, applyKaizoIdleRecolor,
} from '../actors/kaizo-knight-actor.js';
import { isUp as rosterIsUp, rosterSize, statFor as rosterStatFor } from '../party/roster.js';
import { applyKrisPartyMultiplier } from '../party/damage.js';
import { downMessages } from '../party/freeze.js';
import { armHpscene } from '../party/scenes.js';
import { kaizoGloomStep, kaizoGloomMessages } from '../party/gloom.js';
import { createKaizoHeroes, stepKaizoHeroes } from '../party/heroes.js';
import { VC_KNIGHT, VC_GATE_FRACTION, VC_LOOP, VC_PHASE4_DEFAULT } from '../versions/vc-script.js';

/** The guard drops at 40%: `kaizo_block = 0` in the post-ROARING message
 *  block ("The enemy's guard has dropped."). Until then EVERY non-crit hit
 *  is blocked to ceil(damage / 5) — obj_heroparent Step 361-393: the block
 *  is CRIT-GATED (`points < 150`), so only a frame-perfect 150 lands whole. */
const GUARD_DROP = 0.4;

// ── THE A-SIDE SPELL SEAM — ledger G-22 and G-45, both on one turn ──────────
//
// V-C installs no roster, so `installKaizoMenu` (kaizo/party/spells.js) never
// runs and the Normal Route reaches the VENDORED `castSpell`. Two mod deltas
// live in that one case and both were still doing DELTARUNE's thing.
//
// G-22 — `scr_monstersetup` monstertype 104 sets `global.monsterdf[myself] =
// 5` (vanilla 0). `scr_spell.gml:144` is
//
//     damage = ceil((battlemag[arg1] * 5) + (battleat[arg1] * 11)
//                   - (global.monsterdf[star] * 3));
//     damage = ceil(damage * (obj_knight_enemy.damagereduction + 0.65));
//
// and `sim/knight.js` spellDamage subtracts `KNIGHT_DF * 3` with KNIGHT_DF 0
// — 15 points of overstated party damage before the multiplier. The FIGHT bar
// already honours 5 through `fightDamage` below (VC_KNIGHT.df); this is the
// second of the three formulas the ledger lists, and X-Slash (the third) is
// kaizo/party/spells.js xslashDamage.
//
// G-45 — `obj_rudebuster_bolt`'s Step. The whole diff of that file against
// vanilla v105 is a DELETION:
//
//     -        if (i_ex(obj_knight_enemy))
//     -        {
//     -            targety -= 50;
//     -        }
//
// so the bolt flies at the registered `global.monstery` and detonates 50px
// lower on the Knight's sprite. `sim/spells.js:62-65` folds the vanilla
// offset into `KNIGHT_AIM = { dx: 60, dy: 90 - 50 }` and says so in its own
// comment. Repo rule 6 forbids editing `sim/` for kaizo's sake, so the mod's
// aim is `dy: 90` here and the engine keeps vanilla's.
//
// The rest of the case is the engine's, verbatim — the same live-instance
// read (`global.monsterx/monstery` track the instance, and this Knight bobs),
// the same fallback origin, the same `castRudeBuster` call and return string.
// NEITHER DELTA CAN MOVE THE BYTE GATE: `monsterhp` is pinned by the recorder
// and mirrored by `--pin-monsterhp`, and the bolt is not `isBullet`, so it
// never enters the 32-slot sheet. Measured: _tok3 stayed byte-exact and
// _rev1's front did not move (frame 12492 / bullets 12499) with this live.
const VC_RUDEBUSTER_AIM = { dx: 60, dy: 90 };
/** `sim/spells.js`'s KNIGHT_POS, duplicated for the same reason it is there. */
const VC_KNIGHT_POS = { x: 425, y: 78 };

/**
 * The mod's `scr_spell` case 4, as a `state.kaizo.hooks.castSpell` case.
 * `undefined` for every other id hands it straight back to the engine.
 */
function vcCastSpell(state, slot, spellId) {
  if (spellId !== 4) return undefined;
  const st = statFor(state, slot);
  // G-22: `- (global.monsterdf[star] * 3)`, and monsterdf[0] is 5.
  const base = Math.ceil(st.magic * 5 + st.at * 11 - VC_KNIGHT.df * 3);
  const dr = state.knight?.damagereduction ?? 0;
  const damage = Math.max(0, Math.ceil(base * (dr + 0.65)));
  const kn = state.entities.find((en) => en.alive && en.type?.name === 'obj_knight_enemy');
  const kx = (kn?.x ?? VC_KNIGHT_POS.x) + VC_RUDEBUSTER_AIM.dx;
  // G-45: no `targety -= 50`.
  const ky = (kn?.y ?? VC_KNIGHT_POS.y) + VC_RUDEBUSTER_AIM.dy;
  castRudeBuster(state, PARTY_POS[slot].x, PARTY_POS[slot].y, damage, kx, ky);
  return 'Rude Buster!';
}

/**
 * Install it. `??=` so that a version which brought its own menu layer
 * (V-D's installKaizoMenu, which runs at scene build) keeps it, and so that a
 * check's recording wrapper wins — the same reason kaizo-fight.js gives for
 * `knightTarget`.
 */
function installVCSpellSeam(state) {
  if (!state.kaizo) return;
  state.kaizo.hooks ??= {};
  state.kaizo.hooks.castSpell ??= vcCastSpell;
}

/**
 * Kris's CHECK, the mod's version — obj_knight_enemy Other_23:1-9 defines
 * the three strings (with the B-Side overrides), Step_0:950-964 plays them:
 *
 *     checkcount++;
 *     if (checkcount == 1) { msgset(0, kaizo_check1A); msgnext(kaizo_check1B); }
 *     else                   msgset(0, kaizo_check2);
 *
 * Two pages the first time, ONE on every repeat — where vanilla's second
 * ACT is a different pair ("Kris points into the distance", sim/dialogue.js
 * ACT_PAGES.point). The `/` and `/%` writer halts are page boundaries here,
 * as they are in ACT_PAGES. Both routes are carried; only the B-Side pair is
 * wired (kaizo-vc-hooks actPages), because the A-Side pair would change the
 * V-C writer lifecycle the _tok3 gate is pinned to and wants its own run.
 */
export const KAIZO_CHECK_PAGES = {
  A: {
    first: ['* Kris analyzed the enemy!', "* But the numbers didn't seem feasible..."],
    again: ["* Kris couldn't bear to check again."],
  },
  B: {
    first: ['* Kris tried to analyze the enemy, but they froze.', '* You brought this upon yourself.'],
    again: ['* Your actions were used up.'],
  },
};

/**
 * THE TURN-END MESSAGES — obj_knight_enemy Step_0:566-781, the block
 * under `mnfight == 2 && turntimer <= 1 && setdownmessage == false`, AFTER
 * the row advance has written the new row's telegraph (:523-552, which the
 * `advance` hook below models). In the mod's order:
 *
 *   :580  if (phase == 4 && phase4turn < 3) {} else {
 *   :585    the per-character down lines, latched once per fight
 *           (kaizo/party/freeze.js downMessages: Kris "* Can't move your
 *           body.&" on the B-Side, Noelle "* She was used up.&");
 *   :647    if (downcount == 0 && k_sideb) the >= 36 GLOOM call-outs
 *           (kaizo/party/gloom.js kaizoGloomMessages);
 *         }
 *   :679  if (kaizo_prevatk == "atk_RoaringDelta" && !practicemode) {
 *           "* The enemy's guard falters, just for a moment..."
 *           progamer: "* Kris coughed.&* The enemy pauses in wonder..."
 *           k_sideb && progamer: "\ck* Well, aren't you something special...?
 *           Go ahead." + didfullnohit = 1, turnsafternohit = 0,
 *           curhp = monsterhp, idlesprite = spr_roaringknight_idle2
 *         } else if (didfullnohit) { the turnsafternohit 1..4 taunts, each
 *           branching on whether monsterhp fell since curhp; a hit taken
 *           (!progamer) ends the run with one of two lines }
 *   :758  prevatk == "atk_Multislash2" && k_sideb && progamer: "\ck* Not a
 *         scratch yet, hm...?&* Impressive."
 *   :768  phase > 1 && k_didspell && k_nospellsaw: the spell taunt, once
 *   :773  !progamer && k_lastpro: k_lastpro = 0; after RoaringDelta "\ck* So
 *         close, yet so far from perfection..."
 *
 * Every write is `global.battlemsg[0] = ...`, last one wins — so the order
 * above IS the precedence. The variables live where the mod keeps them:
 * `progamer`, `didfullnohit`, `turnsafternohit`, `curhp`, `lastpro` on the
 * knight record (Create_0:65, :132-136), `didspell` / `nospellsaw` on
 * state.kaizo where kaizo/party/scenes.js already puts k_didspell /
 * k_nospellsaw. `kaizo_prevatk` is the row the knight just finished — or,
 * on the turn the 60% gate trips, the row it skipped (:528 then :574 both
 * assign it). `phase` is the knight's own, which the gate has already moved
 * to 4 (:571) by the time :768 reads it.
 *
 * BOTH ROUTES — B-1 / ledger G-3, corrected 2026-09-10. This used to return
 * at the top unless `k.sideb`, which silenced the whole block on the A-Side.
 * THE GML HAS NO `k_sideb` ON THE BLOCK. Read the dump and the guard appears
 * in exactly FIVE places, all of them INSIDE — re-counted 2026-09-10 off
 * `grep -n k_sideb` over the whole Step_0, which is also where these line
 * numbers now come from; the list used to say "four" while naming five, and
 * every number in it was off (four by one, the reward's by seven):
 *
 *   :593         the Kris down-line override ("* Can't move your body.&")
 *   :635         the Noelle down-line ("* She was used up.&")
 *                — both inside downMessages
 *   :649         the `downcount == 0` GLOOM call-outs
 *   :686         the "\ck* Well, aren't you something special..." reward
 *                (the string at :690, and with it didfullnohit /
 *                turnsafternohit / curhp / idlesprite — Step_0:691-694)
 *   :760         the Multislash2 "Not a scratch yet" line (string at :764)
 *
 * Everything else — the four down lines with their k_freeze variants and the
 * 1-in-100 `kaizo_funchance(100)` joke, the `downcount == 2` four-term
 * concat, the RoaringDelta "guard falters" pair, the whole `didfullnohit`
 * taunt ladder, the spell taunt and `k_lastpro` — runs on the Normal Route
 * too, and the recreation used to fall through to the vendored VANILLA text
 * (sim/battlemsg.js) or, under a custom `advance` hook, to no line at all.
 *
 * TWO OF THOSE BRANCHES ARE STILL DEAD ON THE A-SIDE, and it is the mod that
 * kills them, not this function — so they are kept ungated exactly as the GML
 * writes them and left unreachable:
 *   * `didfullnohit` is assigned in FOUR places (Step_0:691, :750, :755,
 *     :1479) and only ONE of them makes it truthy — :691, inside the :686
 *     `k_sideb`; the other three are `= false`. So `else if (didfullnohit)`
 *     at :698 and the turnsafternohit ladder under it cannot fire on the
 *     A-Side. (The count read "ONE place (Step_0:696)" until 2026-09-10 —
 *     wrong line and wrong count, right conclusion. What matters is the
 *     truthy assignment, so say which one it is rather than how many exist.)
 *   * `k_nospellsaw` is assigned in THREE places — Create_0:131 `= 0`,
 *     Step_0:770 `= 0`, Step_0:2036 `= 1` — and again only :2036 is truthy.
 *     That line is k_tpscene 12, and k_tpscene only ever leaves 0 under
 *     `k_sideb && !practicemode` (scr_mnendturn.gml:149-155), so the spell
 *     taunt at :768 cannot fire on the A-Side either.
 *
 * WHAT IS LIVE ON THE A-SIDE, therefore: the four down lines (mod text —
 * "collapsed in silence", "demise was expected", "hope was shattered",
 * "* Noelle's breath goes cold.&"), the funchance draw, the two-term concat,
 * the "guard falters" / "Kris coughed" pair after RoaringDelta, and
 * `k_lastpro`'s one-shot "So close, yet so far from perfection...".
 *
 * THE RECOLOUR LANDS ON THE INSTANCE. `idlesprite` is an obj_knight_enemy
 * instance variable and the reader is kaizoIdlesprite, which looks at the
 * entity; these four sites used to write `kn.idlesprite` on the knight
 * RECORD, a different object, so the reward was computed correctly four
 * times over and shown never. applyKaizoIdleRecolor takes the state and
 * finds the instance, which is the only object the GML could mean.
 */
function kaizoTurnEndMessages(state, { prevatk, phase, phase4turn }) {
  const kn = state.knight;
  const k = state.kaizo;
  if (!kn || !k) return;
  // `k_sideb` — the four sub-branches that really carry it (see the header).
  const sideb = !!k.sideb;
  const practicemode = !!k.practicemode;
  kn.didfullnohit ??= false;      // Create_0:135
  kn.turnsafternohit ??= 0;       // Create_0:136
  kn.lastpro ??= true;            // Create_0:132  k_lastpro = true
  let msg = null;

  // :580 — the finale's first three turn ends carry no down/gloom lines.
  if (!(phase === 4 && phase4turn < 3)) {
    const d = downMessages(state);
    if (d.battlemsg !== null) msg = d.battlemsg;
    // :648 — `if (downcount == 0) { if (k_sideb) { ...GLOOM... } }`. The
    // GLOOM meter itself is B-Side-only (the emitters run under k_sideb in
    // Step_2), so the guard is the mod's belt and braces; kept explicit.
    if (d.downcount === 0 && sideb) {
      const g = kaizoGloomMessages(state);
      if (g !== null) msg = g;
    }
  }

  if (prevatk === 'atk_RoaringDelta' && !practicemode) {
    msg = "* The enemy's guard falters, just for a moment...";
    if (kn.progamer === true) {
      msg = '* Kris coughed.&* The enemy pauses in wonder...';
    }
    // :686 — `if (k_sideb) { if (progamer == true) { ... } }`; the assignment
    // is :691, the ONE place in the dump that ever sets didfullnohit TRUTHY
    // (the other three, :750/:755/:1479, all clear it).
    if (sideb && kn.progamer === true) {
      msg = "\\ck* Well, aren't you something special...^2?&* Go ahead.";
      kn.didfullnohit = 1;
      kn.turnsafternohit = 0;
      kn.curhp = kn.hp;
      applyKaizoIdleRecolor(state);
    }
  } else if (kn.didfullnohit) {
    if (kn.progamer === true) {
      kn.turnsafternohit += 1;
      const t = kn.turnsafternohit;
      const fell = kn.curhp > kn.hp;
      if (t === 1) {
        if (fell) { msg = "\\ck* Come on now...&* That surely isn't your best hit."; kn.curhp = kn.hp; }
        else msg = '\\ck* Now what are you waiting for?';
        applyKaizoIdleRecolor(state);
      }
      if (t === 2) {
        if (fell) { msg = "\\ck* After all that, you're not putting your all into it...?"; kn.curhp = kn.hp; }
        else msg = '\\ck* The guts to play with such a feat^1.&* Intriguing...';
        applyKaizoIdleRecolor(state);
      }
      if (t === 3) {
        if (fell) { msg = '\\ck* Strange..^1.&* Very strange...'; kn.curhp = kn.hp; }
        else msg = '\\ck* If you insist on wasting your chance, so be it, I suppose.';
        applyKaizoIdleRecolor(state);
      }
      if (t >= 4) msg = '\\ck* ...';
    } else if (kn.curhp > kn.hp) {
      msg = '\\ck* And with a little mistake^1, the perfection falls...';
      kn.didfullnohit = false;
    } else {
      msg = '\\ck* A pity such a prime moment to strike was put to waste.';
      kn.didfullnohit = false;
    }
  }

  // :758-767 — `if (prevatk == "atk_Multislash2" && !practicemode) { if
  // (k_sideb) { if (progamer == true) { ... } } }`. The k_sideb was dropped
  // while this function could only run on the B-Side; it is load-bearing now.
  if (prevatk === 'atk_Multislash2' && !practicemode) {
    if (sideb && kn.progamer === true) msg = '\\ck* Not a scratch yet, hm...^1?&* Impressive.';
  }
  if (phase > 1 && k.didspell && k.nospellsaw) {
    k.nospellsaw = 0;
    msg = "\\ck* Couldn't keep up without spells after all, huh...^1?&* What a shame.";
  }
  if (!kn.progamer && kn.lastpro && !practicemode) {
    kn.lastpro = false;
    if (prevatk === 'atk_RoaringDelta') msg = '\\ck* So close^1, yet so far from perfection...';
  }

  if (msg !== null) state.battlemsg = msg;
}

export function vcHooks({ sideb = false, roster = null } = {}) {
  return {
    // The mod's Knight: the verified actor plus its rainbow trail.
    knightActor: kaizoKnightActor,

    // ── THE PARTY ────────────────────────────────────────────────────────
    // Supplied only when a version fields a non-vanilla roster (the Weird
    // Route's Kris + Noelle). Everything here is undefined otherwise, and
    // the turn loop falls back to the verified three-person path.
    ...(roster ? {
      party: {
        // The actor table the scene spawns from, adapted out of the roster's
        // richer member records.
        members: roster.map((m) => ({
          x: m.pos.x, y: m.pos.y, sprite: m.sprites.idle, depth: m.depth,
        })),
      },
      // Range-guarded: sim/damage.js's isUp reads `!chardead[slot]`, and on a
      // two-slot roster the absent third reads as STANDING. That phantom
      // would take targeting rolls and sit in the FIGHT order.
      isUp: rosterIsUp,
      // `partyHp.every(h => h <= 0)` is already roster-length-correct, but
      // routing it through the same module keeps one definition of "who is
      // in this fight" rather than two that can drift.
      partyWiped: (state) => {
        const n = rosterSize(state);
        for (let i = 0; i < n; i++) if (rosterIsUp(state, i)) return false;
        return true;
      },
      createHeroes: createKaizoHeroes,
      // AND THE STEPPER, which is the half that actually crashes without it:
      // sim/heroes.js's stepHeroes walks three fixed slots and dereferences
      // `state.heroes[2].hurt` on a two-person party. Creating the right
      // heroes while still stepping them the vanilla way is not half-wired,
      // it is broken — so these two always travel together.
      stepHeroes: stepKaizoHeroes,
    } : {}),
    // ── THE B-SIDE, per frame and per ACT ────────────────────────────────
    ...(sideb ? {
      // obj_knight_enemy's End Step (Step_2:15-79): the GLOOM engine — the
      // per-character tick timers, the emitters' RNG, and the HP/gloom
      // drain that runs only under `scr_isphase("bullets")`. The turn loop
      // calls this after the knight's reaction timers and hands over its
      // own `mnfight == 2` (kaizo-practice.js).
      knightEndStep: (state, { clockOn = false } = {}) => {
        kaizoGloomStep(state, { bullets: clockOn });
      },
      // Kris's CHECK reads the B-Side strings (KAIZO_CHECK_PAGES.B). The
      // engine's resolveActPages has already advanced `checkcount`
      // (state.actCounts.check) by the time this runs. ONLY CHECK (actId 0)
      // takes the B-Side text: HoldBreath keeps its engine pages and X-Slash
      // (actId 11, lane W2) keeps its own — the test used to be `=== 1`,
      // which handed X-Slash the CHECK strings. Slot 0 only — the mod's
      // Step_0:950 branch is `acting == 1`, the Kris ACT list.
      actPages: (state, c, actId, pages) => {
        if (c !== 0 || actId !== 0) return pages;
        const n = state.actCounts?.check ?? 1;
        return n === 1 ? KAIZO_CHECK_PAGES.B.first : KAIZO_CHECK_PAGES.B.again;
      },
    } : {}),
    openArena: (state, row) => {
      // Step_0:494 — `idlesprite = spr_roaringknight_idle;`, inside the
      // mod's `if (global.mnfight == 1.5 && end_cutscene_version == 0)` block
      // and OUTSIDE its k_sideb branch, so it runs on both versions and on
      // every turn including the charge-up (which opens no board — hence the
      // reset sits here, above openVCArena's own ac -1 return).
      //
      // IT IS THE OTHER HALF OF THE NO-HIT RECOLOUR. kaizoTurnEndMessages
      // puts spr_roaringknight_idle2 on him at a turn END; this puts the
      // ordinary idle back at the next turn's START. So the reward is worn
      // for the length of the taunt and no longer, which is what makes it
      // read as a remark rather than a costume change.
      const kn = state.entities.find(
        (x) => x.alive && x.type?.name === 'obj_knight_enemy',
      );
      if (kn) kn.idlesprite = 'spr_roaringknight_idle';
      openVCArena(state, row, { sideb });
    },
    launch: (state, row) => launchVCAttack(state, row, { sideb }),
    turnLength: (row) => vcTurnLength(row, { sideb }),
    moveheartDest: (row, gt, view) => vcMoveheartDest(row, gt, view),

    // The gate fraction: `hp <= maxhp * 0.6`, tested at the end of ANY turn.
    phase4Reached: (state) => state.knight.hp <= VC_KNIGHT.maxhp * VC_GATE_FRACTION,

    // The ending — the kaizo Draw's trigger (knight_enemy Draw_0 line 151):
    //   chargeupcon == 0 && !dont_fucking_kill_the_knight (a mod guard, sic)
    //   && haveusedroaring && ecv == 0 && hp <= maxhp * 0.6 && endcon != 1
    //   && blockanim <= 0
    // Threshold 0.6 (not vanilla's 0.8), and a BLOCKED hit cannot end it.
    endCutsceneReached: (state) => {
      const k = state.knight;
      if (k.animState !== 3 || !(k.hurttimer >= 0)) return false;
      // `chargeupcon == 0` — THE MOD'S TEST, verbatim (Draw_0:151). This was
      // `=== 1`, which also let con 2/3 (the roar's launch and hidden states)
      // through; it only held because nothing can land a hit while they do.
      // The finale's CleanUp (roaring-final.js cleanUp, 2026-09-08) now
      // returns him to 0 the way the mod does, so the gate can be the mod's.
      if ((k.chargeupcon ?? 0) !== 0) return false;
      // `!dont_fucking_kill_the_knight` — X-Slash raises it for the length of
      // its act so its two hits cannot end the fight mid-animation
      // (kaizo/party/spells.js, actcon 22 clears it).
      if (state.kaizo?.xslash?.dontKill) return false;
      if ((k.blockanim ?? 0) > 0) return false;
      return !!k.haveusedroaring && k.endCutscene === 0 && k.endcon !== 1
        && k.hp <= VC_KNIGHT.maxhp * 0.6;
    },

    // The mod's per-turn DR ramp (Step_0, the mnfight-1.5 block):
    //     if (kaizo_finalstretch && dr < 0.72) dr += 0.05;
    //     else if (dr >= 0.1 && dr < 0.3)      dr += 0.004;
    advanceTurn: (state) => {
      const k = state.knight;
      if (state.kaizo.vars?.kaizo_finalstretch && k.damagereduction < 0.72) {
        k.damagereduction += 0.05;
      } else if (k.damagereduction >= 0.1 && k.damagereduction < 0.3) {
        k.damagereduction += 0.004;
      }
    },

    // THE KNIGHT'S FIRST STEP — obj_knight_enemy Step_0:54-63, the second half
    // of the `if (damagereductiontimer == 1)` block whose first half `postAnim`
    // below carries. It arms k_hpscene, the max-HP shear, off `global.maxhp` /
    // `global.hp` against 200 / 230 / 180 / 180.
    //
    // NOT `sideb`-GATED, and that is the point of the whole scene: the two
    // `if`s sit at :54, outside the `if (k_sideb)` block that closes at :53, so
    // the Normal Route recreation (V-C) arms it too. On the default chapter-3
    // party (160 / 190 / 140) neither test can pass, which is why the A-Side
    // byte-gate recordings never see this branch — kaizo/party/scenes.js's
    // armHpscene does not even stand up the scene state unless it fires.
    //
    // It gets its OWN hook rather than riding postAnim because the director
    // runs postAnim AFTER the scene block, and the GML runs this arm (:56)
    // before the scene's own state 1 (:1777) in the same Step.
    // The `damagereductiontimer == 1` guard is HERE, not inside armHpscene,
    // because it is the enclosing block's and not the arm's: `== 1` is an
    // EQUALITY (stepKnightAnim's own note says so), so it holds for exactly
    // one frame of the fight. Without it the arm re-fires every Step and
    // stamps `k_hpscene = 1` back over whatever state the scene had reached —
    // the scene would replay its first frame forever.
    knightFirstStep: (state) => {
      // PRACTICE MODE: THE KNIGHT CANNOT BE KILLED. Step_0:5-8, the very top
      // of his Step, every frame:
      //
      //     if (practicemode) global.monsterhp[myself] = global.monstermaxhp[myself];
      //
      // Modelled here because this hook is the one that runs FIRST, and the
      // order is the mechanic: the pin sits above the 60% tempflag test at
      // :9-12, so a practice run can never trip the phase-4 gate. Without it
      // the party's damage accumulated normally, phase 4 opened, ROARING
      // played and practice could reach the ending — while in the mod the
      // loop simply never ends, which is what a practice mode is for. The
      // party half of practicemode (the HP doubling and restore) was already
      // modelled in kaizo/party/damage.js; this is the Knight's half.
      if (state.knight?.practicemode) {
        state.knight.hp = state.knightMaxhp ?? VC_KNIGHT.maxhp;
      }
      // …AND, riding the only per-frame hook this file owns that runs from
      // frame 0, the A-Side spell seam (B-3 / ledger G-22 + G-45). It is
      // idempotent (`??=`) and has to be installed before the FIRST menu,
      // which rules out `openArena` — the party phase precedes the board.
      // buildKaizoScene is the natural home for it and belongs to another
      // lane; hoisting it there is a pure move, nothing here depends on the
      // site. See vcCastSpell.
      installVCSpellSeam(state);
      if (state.knight?.damagereductiontimer !== 1) return;
      armHpscene(state);
    },

    // `damagereductiontimer == 1` sets 0.18 under the mod (vanilla 0.2 —
    // stepKnightAnim just wrote it; this runs immediately after, same frame,
    // before any damage resolves).
    postAnim: (state) => {
      const k = state.knight;
      if (k.damagereductiontimer === 1) k.damagereduction = 0.18;
      // The block's Step writes the Draw reads (whiteflash, shakex, the
      // re-armed hurttimer, the two block_ol ghosts, the clock-out) —
      // kaizo Step_0:123-148 / :184-190, ordered after stepKnightAnim the
      // way the GML orders them after scr_enemy_hurt's caller. See
      // kaizoBlockStepTail.
      kaizoBlockStepTail(state);
    },

    // FIGHT damage — obj_heroparent Step 361-393 under the mod:
    //   knightblock = points < 150 && kaizo_block && ecv == 0   (CRIT-GATED)
    //   damage = round(at*points/20 - df*3); ceil(*dr);
    //   Kris: party-alive count <= 1 -> ceil(*2.5); == 2 -> ceil(*1.5)
    //     (REPLACES the vanilla swoon halving/doubling entirely)
    //   blocked -> ceil(damage / 5), blockanim = 1 ("should've crit bro")
    //   TP: blocked round(points/50) vs round(points/10) — see fightTp.
    fightDamage: (state, slot, accuracy) => {
      if (accuracy <= 0) return 0;
      const k = state.knight;
      const vars = (state.kaizo.vars ??= {});
      const blocked = accuracy < 150 && (vars.kaizo_block ?? true) && !k.endCutscene;
      // THE ELSE ARM, which was untranslated — B-3 / ledger G-24. The GML is
      // a FORK, not a single assignment (obj_heroparent Step_0:362-369):
      //
      //     if (points < 150)
      //         knightblock = obj_knight_enemy.kaizo_block
      //                       && obj_knight_enemy.end_cutscene_version == 0;
      //     else
      //         obj_knight_enemy.blockanim = 0;
      //
      // so a 150-point CRIT does not merely skip the block — it CANCELS a
      // block pose already in flight. `blockanim` is a real reader here: it
      // drives the two block_ol ghosts in kaizoBlockStepTail and gates
      // `endCutsceneReached` (`blockanim > 0` refuses the ending), which is
      // the mod's own Draw_0:151 test. Without this the Knight stayed posed a
      // frame or two past the crit that broke through.
      //
      // It sits ABOVE the `cancelattack == 0` body in the GML, so it fires
      // whether or not the hit is cancelled; the `accuracy <= 0` return above
      // is still correct, because `points <= 0` takes the `points < 150` arm.
      if (accuracy >= 150) k.blockanim = 0;
      // `global.battleat[myself]` — SLOT-indexed, summed from the character
      // in that slot. sim/damage.js's statFor is the vanilla trio by slot,
      // so on a roster it would hand Noelle (slot 1) Susie's AT 18 and Kris
      // the vanilla loadout; the roster's statFor (kaizo/party/roster.js)
      // reads `global.char[slot]`'s own base and gear. Roster-gated so V-C
      // keeps the exact read the _tok3 gate is pinned to.
      const hasRoster = !!state.kaizo?.roster;
      const at = (hasRoster ? rosterStatFor(state, slot) : statFor(state, slot)).at;
      let damage = gmlRound((at * accuracy) / 20 - VC_KNIGHT.df * 3);
      damage = Math.ceil(damage * k.damagereduction);
      if (slot === 0) {
        if (hasRoster) {
          // `_partyalive` over CHARACTER ids 1..4, gated by scr_havechar —
          // obj_heroparent Step_0:379-387, kaizo/party/damage.js
          // applyKrisPartyMultiplier (Kris + a living Noelle is 2 alive:
          // ceil(x1.5) from the opening turn).
          damage = applyKrisPartyMultiplier(damage, state);
        } else {
          const alive = state.partyHp.filter((h) => h > 0).length;
          if (alive <= 1) damage = Math.ceil(damage * 2.5);
          else if (alive === 2) damage = Math.ceil(damage * 1.5);
        }
      }
      if (blocked) damage = Math.ceil(damage / 5);
      state.kaizo.lastHitBlocked = blocked;
      if (blocked && damage > 0) k.blockanim = 1;
      return Math.max(0, damage);
    },

    // TP from a landed swing: round(points / 50) when the hit was blocked,
    // round(points / 10) otherwise (vanilla's own scale differs — the hook
    // replaces it wholesale for V-C).
    fightTp: (points, state) =>
      Math.round(points / (state.kaizo.lastHitBlocked ? 50 : 10)),

    // attackSetVar, applied at SELECTION exactly where Other_10 applies it.
    onSelect: (state, row) => {
      const vars = (state.kaizo.vars ??= {});
      for (const [key, value] of row.setVars ?? []) {
        vars[key] = value;
        if (key === 'haveusedroaring') state.knight.haveusedroaring = !!value;
      }
    },

    // THE SCHEDULE STEP — the mod's Step_0 turn-end block:
    //   * natural: current = current.nextAttack (linear in our tables;
    //     phase 3's last row chains to VC_LOOP — phase 2's Quickslash)
    //   * "AfterFinal" (past phase 4's last row) -> kaizo_resumeAT: the row
    //     the gate interrupted REPLAYS
    //   * the gate: end of ANY turn, hp <= 60%, one-shot via haveusedroaring,
    //     jumping to the node named by the LIVE kaizo_phase4 variable
    //   * the turn-end message is the NEWLY selected row's telegraph, with
    //     the post-ROARING guard lines overriding it
    advance: (state, e, { prevPhase, prevTurn }) => {
      const t = e.table;
      const vars = (state.kaizo.vars ??= {});
      const prevRowId = t[prevPhase]?.[prevTurn]?.id;

      let phase = prevPhase;
      let turn = prevTurn;
      const lastInPhase = prevTurn === t[prevPhase].length - 1;
      if (prevPhase === 4 && lastInPhase) {
        const r = vars.resume ?? { phase: 3, turn: 0 };
        phase = r.phase;
        turn = r.turn;
      } else if (!lastInPhase) {
        turn = prevTurn + 1;
      } else if (prevPhase === 3) {
        phase = VC_LOOP.phase;
        turn = VC_LOOP.turn;
      } else {
        phase = prevPhase + 1;
        turn = 0;
      }

      if (state.runMode !== 'endless' && prevPhase !== 4
        && state.knight.hp <= VC_KNIGHT.maxhp * VC_GATE_FRACTION
        && !state.knight.haveusedroaring) {
        // kaizo_resumeAT — the interrupted row, which replays after the
        // finale (the mod's resumeAT is the last non-phase-4 node SELECTED,
        // i.e. the one whose turn the gate just ended).
        vars.resume = { phase: prevPhase, turn: prevTurn };
        phase = 4;
        const entryId = vars.kaizo_phase4 ?? VC_PHASE4_DEFAULT;
        const idx = t[4].findIndex((r) => r.id === entryId);
        turn = idx >= 0 ? idx : 0;
      } else if (phase !== 4) {
        vars.resume = { phase, turn };
      }

      const gateTripped = phase === 4 && prevPhase !== 4;
      const row = t[phase][turn];
      if (row?.msg) state.battlemsg = row.msg;
      if (state.knight.haveusedroaring && prevRowId !== 'atk_RoaringDelta') {
        if (state.knight.hp <= VC_KNIGHT.maxhp * GUARD_DROP) {
          // `kaizo_block = 0` — the guard actually drops here (Step_0 548).
          vars.kaizo_block = false;
          state.battlemsg = "* The enemy's guard has dropped. Make your move!";
        } else {
          state.battlemsg = '* A powerful hit should be enough! Make your move!';
        }
      }
      // THE TAIL of the same turn end (Step_0:566-781): the down and
      // GLOOM lines, the no-hit taunts, the Multislash2 line, the spell
      // taunt, k_lastpro — after the telegraph, last write wins. B-1 /
      // ledger G-3: this ran `if (sideb)` and the GML has no such guard on
      // the block, so the Normal Route got vanilla text (or, under this
      // hook, none). See kaizoTurnEndMessages, which now carries the four
      // real k_sideb guards internally.
      // `kaizo_prevatk` on a gate turn is the row the
      // gate SKIPPED: the launch block pre-advances `kaizo_attack` to the
      // finished row's nextAttack (:528-529) and the gate then copies THAT
      // into prevatk (:574) — the natural next, linear in the table with
      // phase 3's tail looping to VC_LOOP, independent of the sim's own
      // resume bookkeeping. `phase4turn` is 0 on the gate turn and row + 1
      // inside the finale (Other_10 increments it at selection).
      {
        let naturalNext;
        if (!lastInPhase) naturalNext = t[prevPhase][prevTurn + 1];
        else if (prevPhase === 3) naturalNext = t[VC_LOOP.phase][VC_LOOP.turn];
        else naturalNext = t[prevPhase + 1]?.[0];
        const prevatk = gateTripped ? (naturalNext?.id ?? prevRowId) : prevRowId;
        const knightPhaseNow = gateTripped ? 4 : prevPhase;
        const phase4turn = gateTripped ? 0 : (prevPhase === 4 ? prevTurn + 1 : 0);
        kaizoTurnEndMessages(state, { prevatk, phase: knightPhaseNow, phase4turn });
        // `kaizo_prevatk` — PUBLISHED, not just used for the message.
        //
        // scr_mnendturn:152 arms the TP-cut scene on
        // `kaizo_prevatk == "atk_Frenzy1"`, comparing the STRUCT ID, and
        // nothing anywhere wrote `state.kaizo.prevatk` — so armTpscene fell
        // through to its display-name fallback and read the row that
        // LAUNCHED. That is right on an ordinary turn and wrong both ways on
        // a phase-4 gate turn, because the launch block pre-advances
        // `kaizo_attack` to the finished row's nextAttack (Step_0:528-529)
        // and the gate copies THAT into prevatk (:574) — which is exactly the
        // `gateTripped` arm computed one line above.
        //
        // Ordering is already right: the `advance` hook parks the row on the
        // sweep frame and `fireTurnEndAlarm` calls scrMnendturnScenes fifteen
        // frames later (kaizo-practice.js). The ids in vc-script.js are
        // already `atk_Frenzy1` and friends, so scenes.js's string branch
        // takes over from the fallback with no other change.
        state.kaizo.prevatk = prevatk;
      }
      // THE KNIGHT REPORTS THE ROW HE IS LEAVING, not the one he is taking.
      // The mod's selector sets `phase = kaizo_AT.attackPhase`
      // (obj_knight_enemy Other_10:6) and the recording shows that value one
      // row behind the attack label: _tok3's label turns to atk_Starstorm2 on
      // f3720 -- table row 10, attackPhase 2 -- with phase still 1, and phase
      // reaches 2 only on f4045, as Quickslash (row 11) is selected. Returning
      // the NEW row's phase moved every boundary a whole turn early and broke
      // the whole-fight gate's TURN group at f3709.
      //
      // `phase` (the pointer) still advances normally; only the knight's
      // reported value lags, which is what the trace column compares.
      return { phase, turn, knightPhase: prevPhase };
    },
  };
}
