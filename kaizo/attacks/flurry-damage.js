// KAIZO scr_damage_maxhp — the mod's rewritten percent-of-maxhp damage entry
// point, and the kaizo_sideb() read the whole flurry family shares.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight — do not publish without
// permission.
//
// Provenance: kaizo-mod/gml_kaizo_dump/CodeEntries/
//   gml_GlobalScript_scr_damage_maxhp.gml   (the function itself)
//   gml_GlobalScript_kaizo_settings_init.gml lines 79-89 (kaizo_sideb)
// Baseline copied from sim/damage.js scrDamageMaxhp (the VERIFIED vanilla
// translation); only the mod's deltas diverge, each cited at its site.
//
// What diverges from the sim's scrDamageMaxhp:
//   1. progamer cleared on ANY maxhp hit (kaizo 5-9).
//   2. The targeting block is REPLACED: the vanilla Kris-redirect +
//      two-of-three mantle counter becomes the mod's inline scr_kaizo_target
//      copy — mantle wearer absorbs while damagecounter < 2, then an
//      HP-weighted random_range(0,2) roll against `2 - susHp% - ralHp%`
//      (kaizo 64-148). Mantle still halves the FRACTION, per-target with a
//      clean conjunction (kaizo 149-160, the vanilla precedence bug is gone
//      from this script).
//   3. Side-B carves 20% of the hit into gloom BEFORE defend (kaizo 169-174)
//      and accrues it, capped at hp-1, with no 45 cap (kaizo 245-261).
//   4. Kris's 1-HP mercy is REMOVED: in the knight fight everyone who falls
//      goes to -999 with doomtype 12 and scr_dead (kaizo 225-231).
//
// NOT modelled, faithful to the sim's scope (see open[] in the task return):
//   - `global.char[target] == 4` Noelle x0.75 and her weapon-13 gloom
//     exemption — the sim's party is fixed Kris/Susie/Ralsei.
//   - practicemode HP pinning (kaizo 183-189 / 296-302) — the sim has no
//     practicemode; scenes use keepAlive.
//   - the target==3 AoE loop and scr_randomtarget_old retarget-if-dead —
//     absent from the sim baseline too; Flurry always calls single-target.
//   - gameover suppression during the knight fight (kaizo 315-318) — the sim
//     never calls scr_gameover from this path; the kaizo scene's own wipe
//     handling is the analog.
//
// RNG (kaizo targeting, per non-AoE non-Roaring hit): 1x random_range(0, 2),
// plus 1x choose(1, 2) only when the roll lands off Kris with both others up.
// The mantle-absorb path draws NOTHING. This differs from vanilla's draw
// pattern by design — it is the mod's stream.

import { gmlChoose, gmlRandomRange } from '../../sim/rng.js';
import {
  PARTY, PARTY_POS, gearOf, scrDead, ACTION_DEFEND,
} from '../../sim/damage.js';
import { heroHurt } from '../../sim/heroes.js';
import { spawnDmgNumber, TYPE_PARTY, TYPE_SWOON } from '../../sim/dmgnumbers.js';
import { scrShakescreen } from '../../sim/shake.js';

/**
 * `kaizo_sideb()` — true iff obj_knight_enemy exists and its `k_sideb` is set
 * (kaizo_settings_init.gml 79-89). The scene build stamps the flag on
 * `state.kaizo.sideb`.
 */
export function kaizoSideb(state) {
  return !!(state.kaizo && state.kaizo.sideb);
}

/**
 * `scr_damage_maxhp(arg0 = 1, arg1 = false, arg2 = false)` — KAIZO version.
 *
 * arg0 = fraction of the target's max HP, arg1 = ignore DEFEND, arg2 =
 * cannot-fell clamp. Flurry's kaizo slash calls (1, true, false): full max-HP
 * damage, defend does nothing, and it CAN kill — the exact inversion of
 * vanilla's (0.66, false, true).
 */
export function kaizoScrDamageMaxhp(state, fraction, ignoreDefend = false, cannotFell = false, opts = {}) {
  if (state.invTimer >= 0) return 0;

  // KAIZO (scr_damage_maxhp 5-9): any maxhp hit clears the knight's no-hit
  // run flag. Vanilla only cleared it in scr_damage.
  if (state.knight) state.knight.progamer = false;

  const hp = state.partyHp;
  let target = opts.target ?? 0;

  // The targeting gate is vanilla-shaped (`global.chapter == 3 &&
  // i_ex(obj_knight_enemy) && !i_ex(obj_knight_roaring2)` and
  // `aoedamage == false`) but the block inside it is the mod's
  // (kaizo 60-165, an inline copy of scr_kaizo_target).
  if (!state.roaringActive && !opts.aoe) {
    const gear = gearOf(state);
    const armorHas23 = (i) => (gear[i]?.armor ?? []).includes(23);

    // KAIZO (72-93): wearer detection now requires the wearer ALIVE, and the
    // LAST living wearer wins the scan.
    let mantlechar = -1;
    for (let i = 0; i < 3; i++) {
      if (armorHas23(i) && hp[i] > 0) mantlechar = i;
    }
    const mc = mantlechar;
    const k = state.knight;
    // KAIZO (94-97): the wearer only absorbs while damagecounter < 2 — two
    // hits, not vanilla's two-of-three cycle.
    if ((k?.damagecounter ?? 0) >= 2) mantlechar = -1;

    if (mantlechar === -1) {
      // KAIZO (98-143): the HP-weighted roll.
      const sus = Math.max(hp[1] / PARTY[1].maxhp, 0.45);
      const ral = Math.max(hp[2] / PARTY[2].maxhp, 0.45);
      // `if (global.char[1] == 0) _sus = 0;` (kaizo 102-109) — an EMPTY party
      // slot. The sim's party is always Kris/Susie/Ralsei; cannot fire.
      let krisrange = 2 - sus - ral;
      const hitstat = state.gmlRng ? gmlRandomRange(state.gmlRng, 0, 2) : 1;
      if (hp[0] < 0) krisrange = -1;
      if (hitstat > krisrange) {
        // Kaizo's chain: `if (_hp0 > 0) target = 0;` FIRST (not else), so a
        // party with both others down still lands on Kris here.
        if (hp[0] > 0) target = 0;
        if (hp[1] > 0 && hp[2] > 0) {
          target = state.gmlRng ? gmlChoose(state.gmlRng, [1, 2]) : 1;
        } else if (hp[1] > 0) {
          target = 1;
        } else if (hp[2] > 0) {
          target = 2;
        }
      } else {
        target = 0;
      }
      // KAIZO (139-142): rolling off the wearer resets the absorb counter.
      if (target !== mc && k) k.damagecounter = 0;
    } else {
      // KAIZO (144-148): the absorb path — counter up, wearer takes it.
      if (k) k.damagecounter = (k.damagecounter ?? 0) + 1;
      target = mantlechar;
    }

    // KAIZO (149-160): the mantle halves the FRACTION — per-target, and the
    // conjunction is clean in this script (`target == i && (slot1 || slot2)`),
    // unlike scr_damage's reset chain.
    if (armorHas23(target)) fraction /= 2;
    // KAIZO (161-164): `if (global.char[target] == 4) arg0 *= 0.75` — Noelle
    // resistance. Never in this party; not modelled.
  }

  const maxhp = PARTY[target].maxhp;
  let t = Math.ceil(maxhp * fraction);
  // KAIZO (170-174): Side-B carves gloom from the UN-softened value, then
  // softens the hit to 80% — BEFORE the defend reduction.
  let gloomdmg = 0;
  if (kaizoSideb(state)) {
    gloomdmg = Math.ceil(t / 4);
    t = Math.ceil(t * 0.8);
  }
  if (state.charaction?.[target] === ACTION_DEFEND && !ignoreDefend) {
    t = Math.ceil(t / 1.5);
  }
  if (cannotFell) {
    // `clamp(tdamage, 1, hp - 1)` — unchanged vanilla; see sim/damage.js for
    // why the operand order (high bound wins at 1 HP -> MISS) is the mechanic.
    t = Math.min(Math.max(t, 1), hp[target] - 1);
  }
  // `if (!instance_exists(obj_shake)) instance_create(0, 0, obj_shake);` —
  // same slot as the sim's verified copy (kaizo 190-193, unchanged).
  if (!state.entities?.some((sh) => sh.alive && sh.type?.name === 'obj_shake')) {
    scrShakescreen(state);
  }

  // NO EARLY RETURN AT ZERO — the original carries on (hurt, writer, inv).
  if (t < 0) t = 0;

  hp[target] -= t;
  if (hp[target] <= 0) {
    // KAIZO (225-231): the Kris 1-HP mercy is REMOVED. In the knight fight
    // EVERYONE who falls to a maxhp hit goes to -999 with doomtype 12:
    //
    //     doomtype = 12;
    //     hpdiff = round(global.hp[chartarget] + 999);
    //     global.hp[chartarget] = -999;
    //     scr_dead(target);
    //
    // Vanilla parked Kris at 1 HP (spr_kris_fallen_dark) and only swooned the
    // others; kaizo slashes kill Kris like anyone else.
    hp[target] = -999;
    scrDead(state, target);
  }
  heroHurt(state, target);
  // doomtype 12 for every fell (kaizo 227) — the SWOON graphic, Kris included.
  spawnDmgNumber(state, PARTY_POS[target].x, PARTY_POS[target].y, t,
    hp[target] > 0 ? TYPE_PARTY : TYPE_SWOON, 2);

  // KAIZO (245-261): Side-B gloom accrual — after the hit lands, before inv.
  // No 45 cap here (scr_damage has one; this script caps only at hp-1 —
  // preserve the asymmetry). k_gloom is character-indexed in GML; the sim
  // ledger is SLOT-indexed on state.kaizo.gloom (flagged in open[] — no
  // gloom-HP machinery exists in the sim yet, this is the value ledger only).
  if (kaizoSideb(state) && state.kaizo) {
    const gloom = (state.kaizo.gloom ??= [0, 0, 0]);
    if (hp[target] > 1) {
      // `if (chartarget == 4 && global.charweapon[4] == 13) _gloomdmg = 0;` —
      // Noelle again; not modelled.
      const minhp = hp[target] - 1;
      gloom[target] += gloomdmg;
      gloom[target] = Math.min(gloom[target], minhp);
    } else {
      gloom[target] = 0;
    }
  }

  state.invTimer = state.invc * 30;
  return t;
}
