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
import { kaizoKnightActor, kaizoBlockStepTail } from '../actors/kaizo-knight-actor.js';
import { isUp as rosterIsUp, rosterSize } from '../party/roster.js';
import { createKaizoHeroes, stepKaizoHeroes } from '../party/heroes.js';
import { VC_KNIGHT, VC_GATE_FRACTION, VC_LOOP, VC_PHASE4_DEFAULT } from '../versions/vc-script.js';

/** The guard drops at 40%: `kaizo_block = 0` in the post-ROARING message
 *  block ("The enemy's guard has dropped."). Until then EVERY non-crit hit
 *  is blocked to ceil(damage / 5) — obj_heroparent Step 361-393: the block
 *  is CRIT-GATED (`points < 150`), so only a frame-perfect 150 lands whole. */
const GUARD_DROP = 0.4;

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
    openArena: (state, row) => openVCArena(state, row, { sideb }),
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
      if ((k.chargeupcon ?? 0) === 1) return false;
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
      const at = statFor(state, slot).at;
      let damage = gmlRound((at * accuracy) / 20 - VC_KNIGHT.df * 3);
      damage = Math.ceil(damage * k.damagereduction);
      if (slot === 0) {
        const alive = state.partyHp.filter((h) => h > 0).length;
        if (alive <= 1) damage = Math.ceil(damage * 2.5);
        else if (alive === 2) damage = Math.ceil(damage * 1.5);
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
