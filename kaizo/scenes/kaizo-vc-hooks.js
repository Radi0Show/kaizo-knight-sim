// KAIZO V-C — the version hooks that make the kaizo turn loop run
// EnderCat8's mod: the nextAttack chain with its AfterFinal resume-replay,
// the 60% HP gate with the DYNAMIC phase-4 entry, the mod's DR ramp, the
// AT 52 / DF 5 stat block, and the post-ROARING kaizo_block guard.
//
// Semantics transcribed from the mod's obj_knight_enemy Step_0 (see
// knight-research/kaizo-mod/NOTES.md). PUBLISH GATE applies (HANDOFF §5-C).

import { gmlRound } from '../../sim/gml.js';
import { statFor } from '../../sim/damage.js';
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
import { kaizoGloomStep, kaizoGloomMessages } from '../party/gloom.js';
import { createKaizoHeroes, stepKaizoHeroes } from '../party/heroes.js';
import { VC_KNIGHT, VC_GATE_FRACTION, VC_LOOP, VC_PHASE4_DEFAULT } from '../versions/vc-script.js';

/** The guard drops at 40%: `kaizo_block = 0` in the post-ROARING message
 *  block ("The enemy's guard has dropped."). Until then EVERY non-crit hit
 *  is blocked to ceil(damage / 5) — obj_heroparent Step 361-393: the block
 *  is CRIT-GATED (`points < 150`), so only a frame-perfect 150 lands whole. */
const GUARD_DROP = 0.4;

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
 * THE B-SIDE TURN-END MESSAGES — obj_knight_enemy Step_0:566-781, the block
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
 * ONLY ON THE B-SIDE. The block's A-Side lines (the "guard falters" pair,
 * :681-685) are the mod's too, but V-C's message path is what the _tok3
 * gate was fitted around, so they wait for their own run; here they are
 * reproduced because the B-Side branch nests inside them and the non-
 * progamer B-Side turn gets the A-Side line.
 *
 * THE RECOLOUR LANDS ON THE INSTANCE. `idlesprite` is an obj_knight_enemy
 * instance variable and the reader is kaizoIdlesprite, which looks at the
 * entity; these four sites used to write `kn.idlesprite` on the knight
 * RECORD, a different object, so the reward was computed correctly four
 * times over and shown never. applyKaizoIdleRecolor takes the state and
 * finds the instance, which is the only object the GML could mean.
 */
function sidebTurnEndMessages(state, { prevatk, phase, phase4turn }) {
  const kn = state.knight;
  const k = state.kaizo;
  if (!kn || !k?.sideb) return;
  const practicemode = !!k.practicemode;
  kn.didfullnohit ??= false;      // Create_0:135
  kn.turnsafternohit ??= 0;       // Create_0:136
  kn.lastpro ??= true;            // Create_0:132  k_lastpro = true
  let msg = null;

  // :580 — the finale's first three turn ends carry no down/gloom lines.
  if (!(phase === 4 && phase4turn < 3)) {
    const d = downMessages(state);
    if (d.battlemsg !== null) msg = d.battlemsg;
    if (d.downcount === 0) {
      const g = kaizoGloomMessages(state);
      if (g !== null) msg = g;
    }
  }

  if (prevatk === 'atk_RoaringDelta' && !practicemode) {
    msg = "* The enemy's guard falters, just for a moment...";
    if (kn.progamer === true) {
      msg = '* Kris coughed.&* The enemy pauses in wonder...';
      // k_sideb — always true in here.
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

  if (prevatk === 'atk_Multislash2' && !practicemode) {
    if (kn.progamer === true) msg = '\\ck* Not a scratch yet, hm...^1?&* Impressive.';
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
      // IT IS THE OTHER HALF OF THE NO-HIT RECOLOUR. sidebTurnEndMessages
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
      // THE B-SIDE TAIL of the same turn end (Step_0:566-781): the down and
      // GLOOM lines, the no-hit taunts, the Multislash2 line, the spell
      // taunt, k_lastpro — after the telegraph, last write wins. See
      // sidebTurnEndMessages. `kaizo_prevatk` on a gate turn is the row the
      // gate SKIPPED: the launch block pre-advances `kaizo_attack` to the
      // finished row's nextAttack (:528-529) and the gate then copies THAT
      // into prevatk (:574) — the natural next, linear in the table with
      // phase 3's tail looping to VC_LOOP, independent of the sim's own
      // resume bookkeeping. `phase4turn` is 0 on the gate turn and row + 1
      // inside the finale (Other_10 increments it at selection).
      if (sideb) {
        let naturalNext;
        if (!lastInPhase) naturalNext = t[prevPhase][prevTurn + 1];
        else if (prevPhase === 3) naturalNext = t[VC_LOOP.phase][VC_LOOP.turn];
        else naturalNext = t[prevPhase + 1]?.[0];
        const prevatk = gateTripped ? (naturalNext?.id ?? prevRowId) : prevRowId;
        const knightPhaseNow = gateTripped ? 4 : prevPhase;
        const phase4turn = gateTripped ? 0 : (prevPhase === 4 ? prevTurn + 1 : 0);
        sidebTurnEndMessages(state, { prevatk, phase: knightPhaseNow, phase4turn });
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
