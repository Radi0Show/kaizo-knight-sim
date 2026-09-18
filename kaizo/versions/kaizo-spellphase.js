// THE MOD'S obj_spellphase — `gml_Object_obj_spellphase_Step_0.gml`, Kaizo
// Roaring Knight v2.3.3, all 95 lines of the Step.
//
// WHY THIS FILE EXISTS. The vendored `sim/spellphase.js` translates V1.03's
// copy of the same event and IS CORRECT AS IT STANDS — read the CORRECTED
// note at its head (2026-09-10, knight-sim v1.0.32) before touching anything
// here. Vanilla's else-branch goes straight to `if (gotitem[char] == 1)` and
// its one skip loop is at the TAIL testing `using[char] == 0`. EnderCat8's
// build adds two things vanilla does not have, and CLAUDE.md law 6 says a mod
// delta never edits the vendored engine — so the mod's event lives here and
// the kaizo director calls this instead. Nothing under `sim/` changes.
//
// THE TWO DELTAS (ledger G-25, `COMPLETE-DIFF-LEDGER.md:187`):
//
//   (a) gml_Object_obj_spellphase_Step_0.gml:21-31 — a skip loop PREPENDED
//       inside the `scr_monsterpop() > 0` branch:
//
//           repeat (2)
//           {
//               if (char < 3)
//               {
//                   if (global.hp[global.char[char]] <= 0)
//                       char += 1;
//               }
//           }
//
//       This is a DIFFERENT TEST from the tail loop's `using[char] == 0`,
//       which is still there at :67-76 and still runs. A slot that queued a
//       spell and was then knocked down has `using[char] == 1`, so the tail
//       loop walks straight past it; this one skips it outright. Vanilla
//       plays the downed member's cast pose and burns a full 90-frame
//       `global.spelldelay` on a caster who cannot cast.
//
//   (b) :31-81 — the whole cast body wrapped in `if (char < 3) { ... }` with
//       `else { global.spelldelay = 1; }`, and `spelltimer = 0; re_castyet =
//       0;` moved OUTSIDE the guard (:82-83) so they run on both arms. The
//       guard is not redundant with the `char >= 3` test above it any more,
//       because (a) can push `char` from 2 to 3 inside the branch. On the
//       else arm the phase spends exactly one more frame (spelldelay 1) and
//       then takes the `char >= 3` exit into scr_attackphase.
//
// WHEN THE DELTAS ARE INERT — and they are inert on both tracked recordings.
// `_tok3` never casts. `_rev1`'s one spell turn (the f8556 menu) runs with
// the recorder's HP pin and `scr_revive` keep-alive, so every
// `global.hp[global.char[char]]` is positive when the phase steps and the
// skip loop never increments; `char` therefore never reaches 3 inside the
// branch and the guard never takes its else arm. That is the point: this
// file must be BYTE-NEUTRAL on the byte gate and only differ when a caster is
// actually down. `kaizo/tools/checks/check-spellphase-kaizo.mjs` asserts both
// halves — the parity (identical to `sim/`'s object, frame for frame, with
// nobody down) and the mod-only behaviour (a downed caster skipped, no pose,
// no 90-frame stall).
//
// TRANSLATION NOTE — WHY THE WHOLE EVENT IS RE-TYPED RATHER THAN WRAPPED.
// `sim/spellphase.js` keeps `enterPose`, `newWriter`, `alarm0` and `fire`
// module-private, so there is no seam to compose against; the alternative was
// an engine seam in the vendored tree for a mod-only branch. This is the same
// "copy, don't patch" fallback `kaizo/scenes/kaizo-practice.js` took for the
// practice director (HANDOFF §6), and the parity assertion in the check is
// what keeps the copy from drifting silently when the engine is re-vendored.

import { heroAct, HERO_SPELL, HERO_ITEM } from '../../sim/heroes.js';
import { castSpell } from '../../sim/spells.js';
import { applyItem } from '../../sim/items.js';
import {
  HERO_SPELLTIMER,
  SPELLDELAY_CHAIN,
  SPELLDELAY_EMPTY,
  SPELLDELAY_DEFAULT,
  spellSpelldelay,
  itemSpelldelay,
  spellText,
  itemText,
  createBattleWriter,
  stepBattleWriter,
  charactionOf,
} from '../../sim/spellphase.js';
import { charIdOf, hpOfChar } from '../party/roster.js';

/**
 * `global.hp[global.char[char]]` — the mod indexes the HP array through the
 * SLOT TABLE, not the slot. An empty slot is `global.char[c] == 0` and
 * `global.hp[0]` is an unset GML array cell reading 0, so a padded slot tests
 * `<= 0` and is skipped; roster.js's `hpOfChar` models that cell explicitly
 * (`state.kaizo.hpPhantom`). Slots outside a short roster therefore behave
 * exactly as the mod's do.
 */
export function spellphaseHp(state, slot) {
  return hpOfChar(state, charIdOf(state, slot));
}

/**
 * `gml_Object_obj_spellphase_Step_0.gml:21-31` on its own, so the check can
 * exercise the loop without driving a whole phase. Mutates nothing; returns
 * the value `char` holds after the two guarded iterations.
 *
 * The `repeat (2)` is NOT "skip while down": each iteration re-tests
 * `char < 3` and re-reads HP at the NEW index, and the loop body has no
 * early exit, so from `char == 0` with slot 0 standing the loop reads slot 0
 * twice and returns 0. Two downed slots in a row are the only way to advance
 * twice.
 */
export function skipDownedCasters(state, char) {
  let c = char;
  for (let r = 0; r < 2; r++) {
    if (c < 3) {
      if (spellphaseHp(state, c) <= 0) c += 1;
    }
  }
  return c;
}

// ── The private halves of sim/spellphase.js, re-typed ───────────────────────
// Verbatim from the vendored module (sim/spellphase.js:413-489); the mod
// changes none of them. Their comments live there.

function enterPose(state, c, heroState, chainEntry, act) {
  const h = state.heroes?.[c];
  const attacktimer = h?.attacktimer ?? 0;
  act(state, c, heroState);
  if (h) {
    if (chainEntry) h.attacktimer = attacktimer;
    h.itemed = true;
    h.spelltimer = HERO_SPELLTIMER - 1;
    h.attacktimer += 0.5;
  }
}

function newWriter(state, sp, c) {
  const a = charactionOf(state, c);
  const pages = a === 4
    ? itemText(state, c, state.pendingItem[c].id)
    : spellText(state, c, state.pendingSpell[c].id);
  sp.writer = createBattleWriter(pages);
  state.battlemsg = pages[0];
}

/** Alarm_0 — unchanged by the mod (its dump copy is byte-identical). */
function alarm0(state, sp, opts) {
  for (let xyz = 0; xyz < 3; xyz++) {
    sp.using[xyz] = 0;
    sp.gotspell[xyz] = 0;
    sp.gotitem[xyz] = 0;
    const a = charactionOf(state, xyz);
    if (a === 2 || a === 4) {
      sp.spelltotal += 1;
      sp.using[xyz] = 1;
      if (a === 2) sp.gotspell[xyz] = 1;
      else sp.gotitem[xyz] = 1;
      if (sp.castyet === 0) {
        enterPose(state, xyz, a === 2 ? HERO_SPELL : HERO_ITEM, false, opts.heroAct);
        sp.castIn[xyz] = HERO_SPELLTIMER;
        sp.castyet = 1;
        sp.char = xyz + 1;
        newWriter(state, sp, xyz);
      }
    }
  }
  sp.active = 1;
  sp.alarmFrame = state.frame;
  state.spelldelay = SPELLDELAY_CHAIN;
}

function fire(state, sp, c, opts) {
  sp.castFrames[c] = state.frame;
  const p = state.pendingSpell?.[c];
  const it = state.pendingItem?.[c];
  if (p) {
    state.spelldelay = SPELLDELAY_DEFAULT;
    const kdBefore = state.kaizo?.spelldelay;
    opts.castSpell(state, c, p.id, p.target);
    // `scr_spell` sets `global.spelldelay` itself on the cases that have one
    // — case 10 writes 140 at scr_spell.gml:271 — and the kaizo cast hook
    // puts that write on `state.kaizo.spelldelay`. Reading it back here is
    // the same single-cell rule the step applies, taken at the one moment
    // the step cannot see: the cast happens INSIDE this call, after the
    // step's own mirror has already run for the frame.
    const kdAfter = state.kaizo?.spelldelay;
    if (typeof kdAfter === 'number' && kdAfter > 0 && kdAfter !== kdBefore) {
      state.spelldelay = kdAfter;
      sp.kaizoSpelldelayMirror = kdAfter;
    } else if (state.spelldelay === SPELLDELAY_DEFAULT) {
      state.spelldelay = spellSpelldelay(p.id);
    }
  } else if (it) {
    state.spelldelay = SPELLDELAY_DEFAULT;
    opts.applyItem(state, it.id, it.target);
    state.spelldelay = itemSpelldelay(it.id);
  }
}

/**
 * One frame of the MOD's obj_spellphase. Signature, return value and `opts`
 * are the vendored `stepSpellphase`'s, so the director swaps one for the
 * other and nothing else changes: returns true on the frame the object
 * destroys itself, which is the frame `scr_attackphase` creates the bar.
 *
 * `sp` is a record from the engine's own `createSpellphase` — the mod does
 * not change the Create event either, so there is no kaizo constructor.
 *
 * `sp.kaizoSkipped` is the ledger this file writes and the check reads: the
 * slots (a) walked past, in the order it walked them. Nothing in the fight
 * consumes it; it exists so a green suite can prove the branch RAN.
 */
export function stepKaizoSpellphase(state, sp, e, opts = {}) {
  const o = {
    castSpell: opts.castSpell
      ?? ((st, c, id, target) => castSpell(st, c, id, target, { alreadyPaid: true })),
    applyItem: opts.applyItem ?? applyItem,
    heroAct: opts.heroAct ?? heroAct,
  };
  sp.kaizoSkipped ??= [];

  // ALARM PHASE — `alarm[0] = 5` counts from the frame after Create.
  if (sp.alarm > 0) {
    sp.alarm -= 1;
    if (sp.alarm === 0) alarm0(state, sp, o);
  }

  // ── THE TWO SPELLDELAY CELLS ARE ONE CELL IN THE GAME ────────────────────
  //
  // `global.spelldelay` is a single global, and obj_spellphase's Step is the
  // only thing that reads it. In this repo it became TWO: `state.spelldelay`,
  // which this file writes and the gate below reads, and
  // `state.kaizo.spelldelay`, which kaizo/party/scenes.js writes — 140 on a
  // successful case-10 cast (scr_spell.gml:271), 999999 at k_sgscene == 1
  // (obj_knight_enemy Step_0:1561), back to 1 at state 8 (:1761).
  //
  // THAT 999999 IS THE WHOLE OF THE SNOWGRAVE SCENE'S HIJACK. Unlike
  // k_tpscene and k_nhscene, k_sgscene never writes `special_con` — it stalls
  // the spell phase and nothing else, so the battle keeps drawing while the
  // cutscene plays. With the cells split, the scene's stall was invisible
  // here: the phase would release the turn after the table's default while a
  // scene that runs for hundreds of frames was still on screen.
  //
  // MIRRORED ON CHANGE, NOT EVERY FRAME. One cell means LAST WRITE WINS, and
  // both sides write: the scene at its three points, this file at the chain
  // and the default. Copying the kaizo cell unconditionally each step would
  // make the scene's last value permanent and clobber every later chain write
  // — including for spells that have nothing to do with SnowGrave, since
  // `state.kaizo.spelldelay` persists after the scene releases it. Adopting
  // it only on the frame it MOVES reproduces the single cell exactly, and the
  // phase's own writes stand in between.
  //
  // When the kaizo seam is absent the field is undefined, `mirrored` stays
  // undefined and nothing below changes — which is what keeps the A-Side byte
  // gates still.
  const kd = state.kaizo?.spelldelay;
  if (typeof kd === 'number' && kd !== sp.kaizoSpelldelayMirror) {
    sp.kaizoSpelldelayMirror = kd;
    if (kd > 0) state.spelldelay = kd;
  }

  // STEP — the mod's, :5-94.
  let done = false;
  if (sp.active === 1) {
    sp.spelltimer += 1;
    if (sp.spelltimer >= state.spelldelay && !sp.writer) {
      if (sp.char >= 3 || sp.spelltotal === 1) {
        done = true;
      } else {
        // `scr_monsterpop() > 0` — the Knight is the fight; he is never gone
        // while a turn is resolving. (Same reading as the engine's.)

        // (a) :21-31 — THE DOWNED-CASTER SKIP, the mod's addition.
        const before = sp.char;
        sp.char = skipDownedCasters(state, sp.char);
        for (let s = before; s < sp.char; s++) sp.kaizoSkipped.push(s);

        // (b) :31 — the cast body, now guarded.
        if (sp.char < 3) {
          const c = sp.char;
          if (sp.gotitem[c] === 1) {
            sp.re_castyet = 1;
            enterPose(state, c, HERO_ITEM, true, o.heroAct);
            sp.castIn[c] = HERO_SPELLTIMER;
            sp.writer = null;
            newWriter(state, sp, c);
          }
          if (sp.gotspell[c] === 1) {
            sp.re_castyet = 1;
            enterPose(state, c, HERO_SPELL, true, o.heroAct);
            sp.castIn[c] = HERO_SPELLTIMER;
            sp.writer = null;
            newWriter(state, sp, c);
          }
          state.spelldelay = SPELLDELAY_CHAIN;
          if (sp.re_castyet === 0) state.spelldelay = SPELLDELAY_EMPTY;
          sp.char += 1;
          // :67-76 — the VANILLA tail loop, kept: it tests `using`, not HP,
          // and both loops are live in the mod.
          for (let r = 0; r < 2; r++) {
            if (sp.char < 3 && sp.using[sp.char] === 0) sp.char += 1;
          }
        } else {
          // :78-81 — every remaining caster is down. One more frame, then the
          // `char >= 3` exit above.
          state.spelldelay = SPELLDELAY_EMPTY;
        }
        // :82-83 — OUTSIDE the guard in the mod, so both arms reset.
        sp.spelltimer = 0;
        sp.re_castyet = 0;
      }
    }
  }
  if (done) {
    sp.doneFrame = state.frame;
    sp.writer = null;
    return true;
  }

  if (sp.writer && stepBattleWriter(state, sp.writer, e)) sp.writer = null;

  for (let c = 0; c < 3; c++) {
    if (sp.castIn[c] > 0) {
      sp.castIn[c] -= 1;
      if (sp.castIn[c] === 0) fire(state, sp, c, o);
    }
  }
  return false;
}
