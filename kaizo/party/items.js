// KAIZO — THE ITEM TABLE THE MOD ACTUALLY SHIPS, AND THE HEAL SCRIPTS IT
// ACTUALLY CALLS.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 — PRIVATE
// RESEARCH, do not publish without the author's permission (HANDOFF.md §5-C).
//
// Two jobs, and they are here together because they are the same seam:
//
//   1. `KAIZO_ITEMS` — the ids whose `scr_itemuse` / `scr_iteminfo` cases the
//      mod REWROTE, published onto the engine's `state.kaizo.items` override
//      (sim/items.js `itemInfo`). The vanilla table is untouched.
//   2. `installKaizoHeals` — the engine's two heal funnels (`scrHealitem`,
//      `scrHealitemAll`) deferred WHOLE to kaizo/party/freeze.js's
//      translations of `scr_healitemspell` / `scr_healallitemspell`, through
//      `state.kaizo.hooks`. Those three translations were complete, correct
//      and roster-guarded for four days with ZERO readers anywhere in the
//      repo — the repo's signature defect, wearing its usual disguise of
//      "the code is written, so the behaviour must be there". It was not: the
//      engine called its own `scrHealitem` and nothing ever reached them, so
//      a heal on a k_freeze'd member healed them.
//
// ── WHY THE BATTLE PATH IS scr_spell, NOT scr_itemuse ─────────────────────
//
// `scr_itemconsumeb` (gml_GlobalScript_scr_itemconsumeb.gml:5) sets
// `global.charspecial[charturn] = tempitem[...] + 200`, and the resolve phase
// runs `scr_spell(charspecial)`. So EVERY battle item is `scr_spell` case
// `id + 200`, and those cases call `scr_healitemspell` / `scr_healallitemspell`
// — the freeze-gated pair — never the overworld `scr_healitem`
// (`gml_GlobalScript_scr_spell.gml:355-574`). `scr_itemuse`'s switch is where
// the AMOUNTS live and where the mod's edits are; the SCRIPTS the battle calls
// are the spell pair. Both halves are wired below.
//
// ── WHAT IS DELIBERATELY NOT WIRED ────────────────────────────────────────
//
// `scr_heal_amount_modify_by_equipment` — the BlueRibbon Heal+ that the spell
// pair applies and the overworld `scr_healitem` does not. The engine's
// `scrHealitem(state, target, amount)` carries no CASTER, so the wearer cannot
// be resolved at this seam at all, and sim/items.js's header states the
// vanilla position ("items heal their printed amount, ribbons or not"). Left
// at 0 ribbons, unchanged in both directions, and recorded as an open question
// rather than guessed at.

import { applyHeal, ITEMS } from '../../sim/items.js';
import { spawnHealWriter } from '../../sim/dmgnumbers.js';
import { scrHealallitemspell, scrHealitemspell, charIdOfSlot } from './freeze.js';

// ───────────────────────────────────────────────────────────────────────────
// 1. THE TABLE — what EnderCat8 changed, and what he did not
// ───────────────────────────────────────────────────────────────────────────

/**
 * ── THE AUDIT, AND THE ONE ROW IT REJECTS ────────────────────────────────
 *
 * `diff gml_vanilla_v105 gml_kaizo_dump` gives THREE hunks in `scr_itemuse`
 * (cases 7, 14, 23) and TWO in `scr_iteminfo` (case 14's name, case 23's
 * description). The mod is built on chapter build **v0.0.091**, so a hunk can
 * be EnderCat8's edit or it can be an official change of Toby's running
 * backwards — the comparison tree is newer than the mod's base. Each was
 * checked against both retail dumps before porting:
 *
 * | case | v0.0.105 | Chapter 3 retail | Chapter 4+ retail | mod  | verdict |
 * |---|---|---|---|---|---|
 * | 14 Favwich   | 500 "Favwich" | 500 "Favwich" | 500 "Favwich" | **5000 "FavSandwich"** | EnderCat8 — PORTED |
 * | 23 LightCandy| 120 "Heals#120HP" | 120 | 120 | **200 "Heals#200HP"** | EnderCat8 — PORTED |
 * | 7 Spincake   | 80/140/150/160 | 150 @ ch3 | 140 @ ch3 | 80/140/140 | **CHURN — REJECTED** |
 *
 * **REJECTED, case 7 (Spincake), and this is the row worth reading twice.**
 * The mod's case 7 is not an edited number, it is an OLDER SHAPE OF THE
 * SCRIPT — three bare `if (global.chapter == N) scr_healitem_all(K);`
 * statements (`gml_GlobalScript_scr_itemuse.gml:119-131`), where both retail
 * builds use a `healamount` local assigned by a chain of tests and passed to
 * one call. An author changing a number edits the number; he does not
 * restructure the branch into an idiom two versions old. And the Chapter 4+
 * build confirms the churn directly: its case 7 reads
 * `var healamount = (global.chapter == 1) ? 80 : 140;` with a chapter-5
 * override — so **140 at chapter 3 is Toby's own current value**, and the 150
 * in the v0.0.105 comparison tree is the transient. The mod inherited 140
 * from v0.0.091 without touching it.
 *
 * The sim keeps 150, which is what the Chapter 3 build this engine is a
 * recreation of (v1.03 post-nerf) does. Porting 140 would have changed the
 * VANILLA tool's Spincake to match a number the mod never chose.
 *
 * Sources, all three read for every row:
 *   mod            ~/knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries
 *   comparison     ~/knight-research/kaizo-mod/gml_vanilla_v105/CodeEntries
 *   Chapter 3      ~/knight-research/gml_dump/CodeEntries
 *   Chapter 4+     ~/knight-research/gml_dump_ch5/CodeEntries
 */
export const KAIZO_ITEMS = {
  // scr_itemuse:261  `scr_healitem(global.charselect, 5000);`   (v105: 500)
  // scr_iteminfo:116 itemnameb "FavSandwich"                    (v105: "Favwich")
  // scr_iteminfo:117 itemdescb "Heals#ALL HP"                   — UNCHANGED
  // The description was already "Heals#ALL HP" and now it is nearly true:
  // 5000 clears every max HP in the game, Kris's 160 included.
  14: {
    name: 'FavSandwich', desc: 'Heals#ALL HP', target: 'one', kind: 'heal', amount: 5000,
  },
  // scr_itemuse:408  `scr_healitem(global.charselect, 200);`    (v105: 120)
  // scr_iteminfo:180 itemnameb "LightCandy"                     — UNCHANGED
  // scr_iteminfo:181 itemdescb "Heals#200HP"                    (v105: "Heals#120HP")
  // The one row where the mod moved the code AND the description together,
  // which is on its own good evidence it is an intentional edit.
  23: {
    name: 'LightCandy', desc: 'Heals#200HP', target: 'one', kind: 'heal', amount: 200,
  },
};

/**
 * The ids the mod leaves alone — asserted, so a future "tidy-up" that folds
 * a churn hunk in here fails a check instead of shipping.
 */
export const KAIZO_ITEMS_REJECTED = Object.freeze({
  // Spincake. The mod's build says 140 at chapter 3 because v0.0.091 did;
  // the sim's 150 is the Chapter 3 retail value this engine recreates.
  7: { reason: 'official churn reversed — the mod inherited v0.0.091 and never touched it' },
});

/**
 * ── THE PER-CHARACTER HEALS, AND WHY NOELLE WAS DRINKING SUSIE'S ─────────
 *
 * `sim/items.js`'s `perChar` arrays are SLOT-INDEXED — `[Kris, Susie, Ralsei]`
 * — because that is how this engine's party arrays work. The game asks a
 * different question:
 *
 *     case 212:   // HeartsDonut
 *         if (global.char[star] == 1) scr_healitemspell(20);
 *         if (global.char[star] == 2) scr_healitemspell(80);
 *         if (global.char[star] == 3) scr_healitemspell(50);
 *         if (global.char[star] == 4) scr_healitemspell(30);
 *
 * (`gml_GlobalScript_scr_spell.gml:411-430`, and case 213 ChocDiamond at
 * :432-451, case 226 JavaCookie at :495-499.) CHARACTER id, not slot — and
 * **every one of them has a Noelle branch**, which the slot table has no room
 * for at all. With `global.char = [1, 4, 0]` Noelle sits in slot 1, so a
 * HeartsDonut on the Weird Route healed her SUSIE'S 80 instead of her own 30.
 *
 * NOT A MOD CHANGE, and the diff says so: `scr_spell`'s three per-character
 * cases are byte-identical between `gml_vanilla_v105` and the kaizo dump. It
 * is the same family as the Noelle stats report — a vanilla-shaped table with
 * no fourth row — and it is fixed the same way, by resolving the slot's
 * character first.
 *
 * Published through the item seam rather than by changing `healAmountFor`,
 * because the seam already exists and the roster is what answers the
 * question: `perCharFor` below rebuilds each array in SLOT order from
 * `global.char`, so a `[1, 2, 3]` party reproduces the engine's own literal
 * exactly and a `[1, 4, 0]` party gets Kris's and Noelle's numbers.
 */
export const PERCHAR_BY_CHARID = Object.freeze({
  // id: { charId: amount }  — scr_spell cases 212, 213, 226.
  12: { 1: 20, 2: 80, 3: 50, 4: 30 },    // HeartsDonut
  13: { 1: 80, 2: 20, 3: 50, 4: 70 },    // ChocDiamond
  // `var healamount = (global.char[star] == 1) ? 100 : 90;` — one test, so
  // Susie, Ralsei AND Noelle all take the 90.
  26: { 1: 100, 2: 90, 3: 90, 4: 90 },   // JavaCookie
});

/**
 * The slot-indexed `perChar` array for one id, given the party's `global.char`.
 * An empty slot reads 0, which `itemEffect` already refuses ("a zero-amount
 * heal still has to be REFUSED rather than played").
 */
export function perCharFor(id, globalChar) {
  const byChar = PERCHAR_BY_CHARID[id];
  if (!byChar) return null;
  const out = [];
  for (let slot = 0; slot < 3; slot++) out.push(byChar[globalChar?.[slot]] ?? 0);
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// 2. THE HOOKS — the seam that makes freeze.js's heal scripts reachable
// ───────────────────────────────────────────────────────────────────────────

/**
 * `scr_healallitemspell(arg0)` as the engine's `scrHealitemAll` hook.
 *
 * The GML runs `scr_healall` — slot loop, per-slot `k_freeze` skip, then the
 * `global.char[i] != 0` occupancy test — and then a SECOND loop that spawns
 * one `obj_healanim` + dmgwriter per character, with the same freeze skip. So
 * a frozen member gets neither HP nor a green number, and everybody else is
 * healed normally; the whole party is not denied because one member is ice.
 *
 * `freeze.js` returns `anims`, the slots that earned a number; the writers are
 * spawned here because `spawnHealWriter` is engine surface that freeze.js
 * deliberately does not reach for.
 */
function kaizoHealAll(state, amount) {
  let total = 0;
  const healFn = (st, slot, amt) => {
    const did = applyHeal(st, slot, amt, 0);
    total += did;
    return did;
  };
  const res = scrHealallitemspell(state, amount, healFn, 0);
  // `healtext.healamt = arg1` — the REQUESTED amount, exactly as the engine's
  // own writer loop does it.
  for (const slot of res.anims) spawnHealWriter(state, slot, amount);
  return total;
}

/**
 * `scr_healitemspell(arg0)` as the engine's `scrHealitem` hook.
 *
 *     if (i_ex(obj_knight_enemy)) {
 *         var _ch = global.char[star];
 *         if (obj_knight_enemy.k_freeze[_ch]) { global.spelldelay = 15; return false; }
 *     }
 *
 * THE ACTION IS WASTED, NOT REFUSED — the item left `tempitem` at selection
 * and the resolve phase is where this runs, so returning 0 here is "the
 * player spent a DeluxeDinner on a frozen Kris and got nothing", which is
 * what the mod does. It is not "the menu should have greyed it out".
 */
function kaizoHealOne(state, target, amount) {
  let did = 0;
  const healFn = (st, slot, amt) => {
    const d = applyHeal(st, slot, amt, 0);
    did += d;
    return d;
  };
  const res = scrHealitemspell(state, target, amount, healFn, 0);
  if (res === false) return 0;          // frozen: the wasted action
  // `with (global.charinstance[star]) { ...obj_healanim, the dmgwriter... }`
  // — AN EMPTY SLOT HAS NO INSTANCE, so the whole block is skipped and no
  // green number appears. The heal itself already refused the slot
  // (`applyHeal`); this is the other half of the same line.
  if (charIdOfSlot(state, target) !== 0) spawnHealWriter(state, target, amount);
  return did;
}

/**
 * The override map for THIS party: the mod's two edited ids, plus a
 * slot-rebased `perChar` for every id whose GML case asks for a character id.
 *
 * A `[1, 2, 3]` party rebuilds the engine's own arrays value for value, so a
 * three-person kaizo route sees no change at all — which is the assertion
 * `check-items-kaizo.mjs` makes before it asserts Noelle's.
 */
function buildItemOverrides(state) {
  const out = { ...KAIZO_ITEMS };
  const globalChar = state?.kaizo?.globalChar;
  if (!globalChar) return out;
  for (const id of Object.keys(PERCHAR_BY_CHARID).map(Number)) {
    const perChar = perCharFor(id, globalChar);
    if (!perChar) continue;
    out[id] = { ...(out[id] ?? ITEMS[id]), perChar };
  }
  return out;
}

/**
 * INSTALL. Publishes the table override and the two hooks onto `state.kaizo`.
 *
 * `??=` throughout, matching `buildKaizoScene`'s own hook installation: a
 * version that already named a hook keeps it, and calling this twice is a
 * no-op rather than a double-wrap.
 *
 * THE READER IS `sim/items.js`. `itemInfo` answers from `state.kaizo.items`
 * and `scrHealitem` / `scrHealitemAll` consult `state.kaizo.hooks` — delete
 * either read and `kaizo/tools/checks/check-items-kaizo.mjs` goes red, which
 * is the only thing that keeps this file from becoming instance twelve of the
 * defect it exists to close.
 */
export function installKaizoHeals(state) {
  state.kaizo = state.kaizo ?? {};
  state.kaizo.items = state.kaizo.items ?? buildItemOverrides(state);
  state.kaizo.hooks = state.kaizo.hooks ?? {};
  state.kaizo.hooks.scrHealitemAll = state.kaizo.hooks.scrHealitemAll ?? kaizoHealAll;
  state.kaizo.hooks.scrHealitem = state.kaizo.hooks.scrHealitem ?? kaizoHealOne;
  return state;
}
