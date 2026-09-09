// KAIZO V-D (B-Side) — `k_freeze`, the freeze-a-party-member mechanic.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE — every branch below is translated from these kaizo dump files
// (D:\ShadowCrystal\knight-research\kaizo-mod\gml_kaizo_dump\CodeEntries\),
// cross-read against gml_vanilla_v105 and the delta notes of the same names:
//
//   gml_Object_obj_knight_enemy_Create_0.gml      k_freeze = [0,0,0,0,0]
//   gml_Object_obj_knight_enemy_Step_0.gml        THE ONLY SETTER (k_sgscene
//                                                 6.1, line 1718); the
//                                                 per-character down messages
//                                                 (lines 590-641); the Susie
//                                                 balloon gates (210, 319);
//                                                 the end-cutscene sweep (1326)
//   gml_Object_obj_heroparent_Create_0.gml        herofrozen = -4
//   gml_Object_obj_heroparent_Draw_0.gml          frozen-statue spawn + the
//                                                 hero's Draw `exit`
//   gml_Object_obj_heroparent_CleanUp_0.gml       k_freeze clear + STATUE LEAK
//   gml_Object_obj_frozennpc_Create_0.gml         statue field defaults
//   gml_Object_obj_frozennpc_Other_10.gml         skipread gate
//   gml_GlobalScript_scr_healall.gml              party heal SKIPS frozen
//   gml_GlobalScript_scr_healallitemspell.gml     …and skips their heal anim
//   gml_GlobalScript_scr_healitemspell.gml        single heal WASTES the action
//   gml_GlobalScript_scr_spell.gml                cases 2 / 6 / 11 gated
//   gml_GlobalScript_scr_spelltext.gml            cases 202 / 231 "no effect"
//   gml_GlobalScript_kaizo_settings_init.gml      kaizo_funchance, kaizo_sideb
//
// WHAT THIS MODULE IS
//
// `k_freeze` is a five-slot array on obj_knight_enemy. `1` means that
// character is FROZEN SOLID: the hero is replaced by an obj_frozennpc statue,
// their Draw stops entirely, spells that would touch them are refused, and
// every heal in the game either skips them or is eaten. Nothing in the whole
// dump un-freezes a member mid-fight. Freezing is a one-way door.
//
// THE INDEXING SPLIT (INDEX.md §"k_gloom slot-vs-charid indexing split")
//
// `k_freeze` is CHARACTER-indexed (1 Kris, 2 Susie, 3 Ralsei, 4 Noelle;
// index 0 is the "no character" hole and is never written). The battle slots
// — chardead/charmove/partyHp — are SLOT-indexed. The shared kaizo interface
// contract puts `state.kaizo.freeze` in SLOT order, so this module keeps the
// slot array as the store and rebuilds the mod's char-indexed view on demand
// (`kFreezeChar` / `kFreezeArray`). Every call site below is labelled with
// which indexing the GML used, because two of them disagree with each other:
//
//   scr_healall / scr_healallitemspell   loop slot i, read k_freeze[char[i]]
//                                        — correct, per-member.
//   scr_spell case 6 (the all-heal)      loop slot i, read k_freeze[_ctar]
//                                        — the CASTER'S TARGET, loop-invariant.
//                                        ORIGINAL BUG, preserved (see below).
//
// For a compacted party (scr_fixparty) slot i holds char[i], so the correct
// sites are identity over the roster. `k_freeze[0]` — the read for an empty
// slot in a two-person Weird Route party — is always 0, which is why the
// two-person party works at all.
//
// RNG BUDGET (draws on state.gmlRng, counted)
//
//   stepSnowgraveFreeze  irandom_range(75, 125)      2 draws, every tick
//                        random(0.2) in the snd_play  1 draw, ONLY when
//                                                     (frame % 2) == 0 and
//                                                     the target is not Noelle
//   downMessages         kaizo_funchance(100)
//                        = irandom_range(1, 100)      2 draws, and only when
//                                                     the Kris-down branch runs
//   frozen-statue spawn  NONE. obj_frozennpc's Create draws no random numbers
//                        (verified against the dump) — the pure-visual spawn
//                        below therefore has no RNG to consume. Skipping the
//                        drawing costs the stream nothing.
//
// VISUALS SKIPPED (recorded, not drawn)
//
//   The statue's sprite/scale/depth/specialcolor are recorded on the statue
//   record so a renderer can draw it, but nothing here draws. The frozen
//   hero's own draw is reported through `heroDrawSuppressed` rather than
//   suppressed by drawing code this module does not own.
//
// OWNERSHIP — this file writes ONLY `state.kaizo.freeze`, its own
// `state.kaizo.frozen*` bookkeeping, `state.partyHp`, and (for the one GML
// line that does it) `state.kaizo.gloom`. The roster and the damage/stat
// tables belong to the party module; heals are applied through an injected
// `healFn` so this module never needs the three-person PARTY table.

import { gmlIrandomRange, gmlRandom } from '../../sim/rng.js';
import { gmlRound } from '../../sim/gml.js';
import { cue } from '../../sim/audio.js';
import { scrDead, scrRevive } from '../../sim/damage.js';
import { applyHeal } from '../../sim/items.js';

/** `k_freeze = [0, 0, 0, 0, 0]` — obj_knight_enemy Create_0:120. */
export const K_FREEZE_LENGTH = 5;

/** `herofrozen = -4` — obj_heroparent Create_0, "no statue yet". */
export const HEROFROZEN_NONE = -4;

/**
 * `herofrozen = -99` — obj_heroparent CleanUp_0 writes this BEFORE the
 * destroy, which is the whole bug. See `heroCleanUp`.
 */
export const HEROFROZEN_CLEANED = -99;

/** `_frdmg = irandom_range(75, 125)` — the Snowgrave freeze tick's damage. */
export const SG_FREEZE_DAMAGE = { lo: 75, hi: 125 };

/**
 * The spell ids whose `scr_spell` case carries its own `k_freeze` gate.
 * Everything else that heals reaches the mechanic through
 * `scrHealitemspell` / `scrHealallitemspell` instead.
 */
export const FREEZE_GATED_SPELLS = new Set([2, 6, 11]);

/**
 * `scr_spelltext` cases 202 (REVIVEMINT) and 231 (REVIVEBRIGHT) append this
 * when the target is frozen — the only place the game TELLS you the item was
 * wasted. Every other frozen heal is silent.
 */
export const FROZEN_NO_EFFECT_SUFFIX = '^1 &* It had no effect...!/%';
export const SPELLTEXT_NO_EFFECT_SPELLS = new Set([202, 231]);

/** `global.spelldelay = 15` — what a frozen-out heal costs instead. */
export const FROZEN_SPELLDELAY = 15;

// ───────────────────────────────────────────────────────────────────────────
// State
// ───────────────────────────────────────────────────────────────────────────

/**
 * Make sure the contract's arrays exist and are the roster's length.
 *
 * `state.kaizo.freeze` is SLOT-indexed booleans (the shared interface
 * contract). The mod's own store is the char-indexed `k_freeze[0..4]`;
 * `kFreezeArray` rebuilds that view whenever a call site needs it.
 */
export function ensureFreezeState(state) {
  const k = (state.kaizo ??= {});
  const n = k.roster?.length ?? state.partyHp?.length ?? 3;
  if (!Array.isArray(k.freeze) || k.freeze.length !== n) {
    const prev = Array.isArray(k.freeze) ? k.freeze : [];
    k.freeze = Array.from({ length: n }, (_, i) => !!prev[i]);
  }
  // `herofrozen` is per-HERO-INSTANCE, not per character — it lives on the
  // hero, so it is slot-indexed here and initialised to the -4 sentinel.
  if (!Array.isArray(k.herofrozen) || k.herofrozen.length !== n) {
    k.herofrozen = Array.from({ length: n }, () => HEROFROZEN_NONE);
  }
  k.frozenStatues ??= [];
  k.frozenStatueSeq ??= 0;
  return k;
}

// ───────────────────────────────────────────────────────────────────────────
// Indexing — the slot/charId bridge
// ───────────────────────────────────────────────────────────────────────────

/** `global.char[slot]`. 0 for an empty slot, exactly as scr_fixparty leaves it. */
export function charIdOfSlot(state, slot) {
  const r = state.kaizo?.roster;
  if (!r || slot < 0 || slot >= r.length) return 0;
  return r[slot].charId ?? 0;
}

/** The inverse. -1 when that character is not in the party. */
export function slotOfCharId(state, charId) {
  const r = state.kaizo?.roster ?? [];
  for (let i = 0; i < r.length; i++) if (r[i].charId === charId) return i;
  return -1;
}

/** `scr_havechar(charId)`. */
export function haveChar(state, charId) {
  return slotOfCharId(state, charId) >= 0;
}

/**
 * The mod's read: `obj_knight_enemy.k_freeze[charId]`.
 *
 * charId 0 (the empty-slot hole) is never written by anything, so it reads 0
 * — that is what lets `scr_healall`'s slot loop run past the tail of a
 * two-person party without a false skip.
 *
 * charId -1 happens in `scr_spell` when `star >= 3` (an enemy target): the
 * GML would read k_freeze[-1] and error. The delta note records that star < 3
 * on every reachable path; we return 0 rather than throw, and label it.
 */
export function kFreezeChar(state, charId) {
  if (charId === 0 || charId === -1 || charId == null) return 0;
  const slot = slotOfCharId(state, charId);
  if (slot < 0) return 0;
  return state.kaizo?.freeze?.[slot] ? 1 : 0;
}

/** The mod's array as the mod stores it: char-indexed, length 5. */
export function kFreezeArray(state) {
  const out = new Array(K_FREEZE_LENGTH).fill(0);
  const r = state.kaizo?.roster ?? [];
  for (let i = 0; i < r.length; i++) {
    const c = r[i].charId ?? 0;
    if (c > 0 && c < K_FREEZE_LENGTH) out[c] = state.kaizo?.freeze?.[i] ? 1 : 0;
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Core API
// ───────────────────────────────────────────────────────────────────────────

/** SLOT-indexed, per the shared contract. */
export function isFrozen(state, slot) {
  return !!state.kaizo?.freeze?.[slot];
}

/**
 * `k_freeze[char] = 1`.
 *
 * Nothing else in the dump does this — the only caller is the Snowgrave
 * scene's 6.1 tick. Exposed so a scene can drive the mechanic directly (a
 * practice/debug path), which is what the work item asks for.
 */
export function freezeSlot(state, slot) {
  const k = ensureFreezeState(state);
  if (slot < 0 || slot >= k.freeze.length) return false;
  k.freeze[slot] = true;
  return true;
}

/** Same, addressed the way the GML addresses it. */
export function freezeChar(state, charId) {
  const slot = slotOfCharId(state, charId);
  return slot < 0 ? false : freezeSlot(state, slot);
}

/**
 * `k_freeze[char] = 0`.
 *
 * IN THE MOD THIS HAPPENS IN EXACTLY TWO PLACES and neither is reachable
 * during a live turn: obj_heroparent's CleanUp (hero teardown / room end) and
 * the end-cutscene sweep. A frozen member is frozen for the rest of the
 * fight; no heal, no revive and no HP restore thaws them. `thawSlot` is the
 * primitive those two sites use — the scene should call `heroCleanUp` or
 * `clearAllFreeze` rather than this, so the statue semantics come with it.
 */
export function thawSlot(state, slot) {
  const k = ensureFreezeState(state);
  if (slot < 0 || slot >= k.freeze.length) return false;
  k.freeze[slot] = false;
  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// THE SETTER — obj_knight_enemy Step_0, k_sgscene == 6.1
// ───────────────────────────────────────────────────────────────────────────

/**
 * One tick of the Snowgrave freeze scene — the mod's ONLY writer of
 * `k_freeze = 1` (Step_0:1699-1725). The scene runs this every frame between
 * k_sgscene 6 and the delayed hand-off to 7 (25 frames).
 *
 *     var _frdmg = irandom_range(75, 125);
 *     var _char  = global.char[k_sgtarget];
 *     if ((global.time % 2) == 0 && _char != 4)
 *         snd_play(snd_damage, 0.75, 0.85 + random(0.2));
 *     scr_dead(k_sgtarget);
 *     if (_char == 4) {
 *         _frdmg = round(_frdmg / 16);
 *         _frdmg = min(global.hp[4] - 1, _frdmg);
 *     }
 *     global.hp[_char] -= _frdmg;
 *     k_sgdmg += _frdmg;
 *     k_gloom[_char] = min(global.hp[_char] - 1, k_gloom[_char]);
 *     if (global.hp[_char] <= 0) { k_freeze[_char] = 1; scr_dead(k_sgtarget); }
 *     else if (global.chardead[k_sgtarget] == 1) scr_revive(k_sgtarget);
 *
 * THE NOELLE CLAMP IS THE WHOLE B-SIDE. `min(hp[4] - 1, _frdmg)` caps the
 * damage at one point short of killing her, so Noelle's HP can never reach 0
 * on this path and **Noelle can never be frozen by Snowgrave**. That is why
 * the down-message block has a `k_freeze` line for Kris, Susie and Ralsei and
 * none for her: the state is unreachable. On the Weird Route party
 * [Kris, Noelle], Kris is the only member Snowgrave can freeze.
 *
 * FAITHFUL QUIRK: at hp[4] <= 0 the clamp goes negative and the subtraction
 * HEALS her. Unreachable given the clamp itself, kept because it is the
 * expression the mod wrote.
 *
 * ORDER MATTERS: `scr_dead` runs BEFORE the damage — every tick, whether or
 * not it kills — and runs a SECOND time inside the freeze branch. The
 * `else if` revive is what stands the target back up on ticks that did not
 * finish them.
 *
 * @param {object} state
 * @param {{target:number}} opts  target = k_sgtarget, a battle SLOT.
 * @returns {{damage:number, frozen:boolean, revived:boolean, draws:number}}
 */
export function stepSnowgraveFreeze(state, { target } = {}) {
  const k = ensureFreezeState(state);
  const rng = state.gmlRng;
  let draws = 0;

  // irandom_range = two gmlU32 draws (sim/rng.js).
  let frdmg = gmlIrandomRange(rng, SG_FREEZE_DAMAGE.lo, SG_FREEZE_DAMAGE.hi);
  draws += 2;

  const char = charIdOfSlot(state, target);

  // `global.time` is the engine's frame counter; the sim's is state.frame.
  if ((state.frame % 2) === 0 && char !== 4) {
    // snd_play(snd_damage, 0.75, 0.85 + random(0.2)) — ONE draw, and it is
    // inside the branch, so the stream depends on the parity of the frame.
    const pitch = 0.85 + gmlRandom(rng, 0.2);
    draws += 1;
    cue(state, 'snd_damage', pitch, 0.75);
  }

  scrDead(state, target);

  if (char === 4) {
    frdmg = gmlRound(frdmg / 16);
    frdmg = Math.min(state.partyHp[target] - 1, frdmg);
  }

  state.partyHp[target] -= frdmg;
  k.sgdmg = (k.sgdmg ?? 0) + frdmg;

  // `k_gloom[_char] = min(global.hp[_char] - 1, k_gloom[_char])` — the one
  // line of this block that touches the GLOOM meter. Written through the
  // shared contract array (SLOT-indexed there, char-indexed in the GML) only
  // when the gloom engine has stood it up; the gloom module owns the meter.
  if (Array.isArray(k.gloom)) {
    k.gloom[target] = Math.min(state.partyHp[target] - 1, k.gloom[target] ?? 0);
  }

  let frozen = false;
  let revived = false;
  if (state.partyHp[target] <= 0) {
    freezeSlot(state, target);
    scrDead(state, target);        // the second scr_dead — faithful, redundant
    frozen = true;
  } else if (state.chardead?.[target] === 1) {
    scrRevive(state, target);
    revived = true;
  }
  return { damage: frdmg, frozen, revived, draws };
}

// ───────────────────────────────────────────────────────────────────────────
// The statue — obj_heroparent Draw_0 / CleanUp_0, obj_frozennpc Create_0
// ───────────────────────────────────────────────────────────────────────────

/**
 * `merge_color(c_navy, c_white, 0.8)` — obj_frozennpc's `specialcolor`.
 * BGR channel lerp, truncated, the way GameMaker's merge_color composes.
 * PURE VISUAL: recorded on the statue record, never drawn here.
 */
function mergeColor(c1, c2, amt) {
  const ch = (c, i) => (c >> (i * 8)) & 255;
  let out = 0;
  for (let i = 0; i < 3; i++) {
    const v = Math.trunc(ch(c1, i) + (ch(c2, i) - ch(c1, i)) * amt);
    out |= (v & 255) << (i * 8);
  }
  return out >>> 0;
}
const C_NAVY = 8388608;
const C_WHITE = 16777215;
export const FROZENNPC_SPECIALCOLOR = mergeColor(C_NAVY, C_WHITE, 0.8);

/**
 * obj_frozennpc's Create_0 defaults, plus the kaizo addition.
 *
 * `skipread = 0` is the mod's one new field (Other_10 wraps the
 * "(It's frozen solid...)" dialogue in `if (skipread == 0)`). NOTHING in the
 * dump ever sets it to 1, so it is a latent switch — recorded for fidelity,
 * and `statueIsReadable` is the read Other_10 performs.
 */
function newFrozenNpc(id) {
  return {
    id,
    sprite: null,
    imageAlpha: 0,
    imageSpeed: 0,
    imageIndex: 0,
    imageXscale: 2,
    imageYscale: 2,
    timer: 0,
    con: 0,
    mysolid: 0,
    init: 0,
    h: 0,
    w: 0,
    returntoxy: 0,
    movetimer: 0,
    kiratimer: 0,
    skipsound: 0,
    skipsolid: 0,
    skipread: 0,            // kaizo addition (Create_0), never written to 1
    depth: 0,
    specialinit: 0,
    specialcolor: FROZENNPC_SPECIALCOLOR,
    fresh: 0,
    inbattle: 0,
    x: 0,
    y: 0,
    alive: true,
  };
}

/** obj_frozennpc Other_10's gate: the statue only speaks when skipread == 0. */
export function statueIsReadable(statue) {
  return statue?.skipread === 0;
}

/**
 * `obj_heroparent`'s Draw_0, the freeze half — run once per frame per hero.
 *
 *     if (obj_knight_enemy.k_freeze[_mychar] == 1) {
 *         if (herofrozen == -4) { herofrozen = instance_create(x, y, obj_frozennpc); ... }
 *         exit;
 *     }
 *
 * TWO THINGS HAPPEN HERE, both of which a naive port loses:
 *
 * 1. **The spawn is a Draw-event side effect.** The statue is born during the
 *    draw phase of the FIRST frozen frame. Frame-exactness of the swap is
 *    "the first frame with k_freeze set shows the statue, not the hero".
 * 2. **`exit` skips the hero's whole draw**, hurt flash and defend pose
 *    included — a hero frozen mid-hurt-flash stops flashing that instant.
 *
 * The statue takes the hero's `hurtsprite`, except Kris (charId 1) who gets
 * the mod's own `spr_krisb_frozen`. It inherits depth and both scales, sits
 * at `image_index = 0`, and is flagged `inbattle = 1`. It is never moved
 * again — frozen heroes do not move.
 *
 * VISUAL, SKIPPED: nothing is drawn. The statue record carries everything a
 * renderer needs. obj_frozennpc's Create draws no random numbers, so there is
 * no RNG to consume for the skipped drawing.
 *
 * @returns {number[]} the slots whose hero draw was suppressed this frame.
 */
export function stepFrozenDraw(state) {
  const k = ensureFreezeState(state);
  const roster = k.roster ?? [];
  const suppressed = [];
  for (let slot = 0; slot < k.freeze.length; slot++) {
    if (!k.freeze[slot]) continue;
    suppressed.push(slot);
    // The spawn gate is `herofrozen == -4` and nothing else. After a CleanUp
    // has stamped -99 the hero can NEVER spawn a second statue — a direct
    // consequence of the leak below, and preserved with it.
    if (k.herofrozen[slot] !== HEROFROZEN_NONE) continue;

    const hero = roster[slot] ?? {};
    const st = newFrozenNpc(++k.frozenStatueSeq);
    st.x = hero.pos?.x ?? 0;
    st.y = hero.pos?.y ?? 0;
    st.sprite = hero.sprites?.hurt ?? null;
    if ((hero.charId ?? 0) === 1) st.sprite = 'spr_krisb_frozen';
    st.depth = hero.depth ?? 0;
    st.inbattle = 1;
    st.imageIndex = 0;
    // The hero's scales, not obj_frozennpc's own — heroparent overwrites both
    // right after the create. Heroes run at image_xscale/yscale 2 anyway.
    st.imageXscale = hero.scale ?? 2;
    st.imageYscale = hero.scale ?? 2;
    st.slot = slot;
    st.charId = hero.charId ?? 0;
    k.frozenStatues.push(st);
    k.herofrozen[slot] = st.id;
  }
  return suppressed;
}

/** Did this hero's Draw `exit` this frame? (i.e. is the statue standing in?) */
export function heroDrawSuppressed(state, slot) {
  return isFrozen(state, slot);
}

/** The live statue for a slot, or null. */
export function statueForSlot(state, slot) {
  const id = state.kaizo?.herofrozen?.[slot];
  if (id === undefined || id === HEROFROZEN_NONE || id === HEROFROZEN_CLEANED) return null;
  return state.kaizo.frozenStatues.find((s) => s.id === id && s.alive) ?? null;
}

/**
 * `obj_heroparent`'s CleanUp_0 — hero teardown, and room end in GMS2.
 *
 *     var _mychar = global.char[myself];
 *     with (obj_knight_enemy) { k_freeze[_mychar] = 0; }
 *     if (herofrozen > -4) {
 *         herofrozen = -99;
 *         instance_destroy(herofrozen, false);
 *     }
 *
 * ORIGINAL BUG — THE FROZEN-STATUE LEAK (deltas/INDEX.md finding 16, and the
 * obj_heroparent_CleanUp_0 delta): the handle is overwritten to -99 BEFORE
 * `instance_destroy` reads it, so the destroy is aimed at instance id -99 —
 * a no-op — and the real obj_frozennpc is never destroyed. The statue
 * outlives the hero and only ever dies in the end-cutscene sweep
 * (`clearAllFreeze`) or a room change.
 *
 * NOT CORRECTED. The translation law is that original bugs are preserved and
 * labelled; the leak is observable (a hero swapped out mid-fight leaves their
 * statue standing) and it also disables statue re-spawn for that hero forever,
 * because Draw's `herofrozen == -4` gate can no longer be true.
 *
 * @returns {{thawed:boolean, leaked:object|null}} `leaked` is the statue the
 *          destroy failed to take, so a caller can assert the bug is present.
 */
export function heroCleanUp(state, slot) {
  const k = ensureFreezeState(state);
  // `with (obj_knight_enemy) k_freeze[_mychar] = 0` — unconditional, and it
  // runs before the herofrozen block.
  const thawed = k.freeze[slot] === true;
  thawSlot(state, slot);

  let leaked = null;
  if (k.herofrozen[slot] > HEROFROZEN_NONE) {
    const doomed = statueForSlot(state, slot);
    k.herofrozen[slot] = HEROFROZEN_CLEANED;
    // instance_destroy(herofrozen, false) — herofrozen is ALREADY -99 here.
    // ORIGINAL BUG: the statue survives. We destroy id -99, which is nothing.
    destroyStatueById(state, HEROFROZEN_CLEANED);
    leaked = doomed;
  }
  return { thawed, leaked };
}

function destroyStatueById(state, id) {
  const list = state.kaizo?.frozenStatues ?? [];
  const st = list.find((s) => s.id === id && s.alive);
  if (!st) return false;      // id -99 lands here, every time
  st.alive = false;
  return true;
}

/**
 * The end-cutscene sweep — obj_knight_enemy Step_0:1326, inside
 * `end_cutscene_version == 1 && endcon == 1 && endtimer > 45`:
 *
 *     k_freeze = [0, 0, 0, 0, 0];
 *     with (obj_frozennpc) instance_destroy();
 *
 * The ONLY place the leaked statues actually die, and the only place the
 * whole freeze array is cleared at once.
 */
export function clearAllFreeze(state) {
  const k = ensureFreezeState(state);
  for (let i = 0; i < k.freeze.length; i++) k.freeze[i] = false;
  let destroyed = 0;
  for (const st of k.frozenStatues) if (st.alive) { st.alive = false; destroyed += 1; }
  return destroyed;
}

// ───────────────────────────────────────────────────────────────────────────
// What a frozen member cannot do — the heal scripts
// ───────────────────────────────────────────────────────────────────────────

/**
 * Default heal application. The kaizo party module owns the roster-aware
 * `scr_heal`; this module must not depend on it (or on sim/damage.js's
 * three-person PARTY table) to do its job, so the heal is injectable and the
 * default is the verified sim's. Pass the kaizo heal in when a member's maxhp
 * differs from the sim's slot table — Noelle's does.
 */
const defaultHealFn = (state, slot, amount) => applyHeal(state, slot, amount, 0);

/**
 * `scr_healall(amount)` — the party-wide heal, with the mod's skip.
 *
 *     for (i = 0; i < 3; i += 1) {
 *         if (i_ex(obj_knight_enemy)) {
 *             var _ch = global.char[i];
 *             if (obj_knight_enemy.k_freeze[_ch]) continue;
 *         }
 *         if (global.char[i] != 0) scr_heal(i, arg0);
 *     }
 *
 * CORRECT INDEXING SITE: slot loop, per-member char read. A frozen member is
 * skipped and everyone else still heals — this is the site the buggy
 * `scr_spell` case 6 below should have copied and did not.
 *
 * The loop runs to 3 regardless of party size; for a two-person party slot 2
 * reads `k_freeze[0]` (always 0, no skip) and is then dropped by the
 * `global.char[i] != 0` test.
 *
 * @returns {{healed:number[], skipped:number[]}} both SLOT-indexed.
 */
export function scrHealall(state, amount, healFn = defaultHealFn) {
  ensureFreezeState(state);
  const healed = [];
  const skipped = [];
  for (let i = 0; i < 3; i++) {
    const ch = charIdOfSlot(state, i);
    if (kFreezeChar(state, ch)) { skipped.push(i); continue; }
    if (ch !== 0) { healFn(state, i, amount); healed.push(i); }
  }
  return { healed, skipped };
}

/**
 * `scr_healallitemspell(amount)` — heal-all items (Spincake, TensionMax's
 * cousins, 206/207/211/225/238).
 *
 * scr_healall runs first (so the skip above already applied), and then a
 * SECOND loop spawns one obj_healanim + dmgwriter per member — with the same
 * freeze skip, so a frozen member gets neither the HP nor the green number.
 * The two loops are kept separate here because they are separate in the dump.
 *
 * @returns {{healed:number[], skipped:number[], anims:number[], spelldelay:number}}
 */
export function scrHealallitemspell(state, amount, healFn = defaultHealFn, healRibbons = 0) {
  const healAmount = amount + Math.ceil(amount / 8) * healRibbons;
  const { healed, skipped } = scrHealall(state, healAmount, healFn);
  const anims = [];
  for (let i = 0; i < 3; i++) {
    const ch = charIdOfSlot(state, i);
    if (kFreezeChar(state, ch)) continue;
    // `with (global.charinstance[i])` — an absent slot has no instance, so
    // the body never runs. Same outcome as scr_healall's char != 0 test.
    if (ch !== 0) anims.push(i);
  }
  return { healed, skipped, anims, spelldelay: 20 };
}

/**
 * `scr_healitemspell(amount)` — EVERY single-target heal item and the heal
 * half of the spell path.
 *
 *     if (i_ex(obj_knight_enemy)) {
 *         var _ch = global.char[star];
 *         if (obj_knight_enemy.k_freeze[_ch]) {
 *             global.spelldelay = 15;
 *             return false;
 *         }
 *     }
 *
 * THE ACTION IS WASTED, NOT REFUSED. The caller has already spent the item
 * and the TP; the function returns before healing, before the animation and
 * before the number, and still sets a recovery delay. A ReviveMint on a
 * frozen Kris is gone and he is still frozen — which, with `thawSlot`
 * unreachable during a turn, is permanent.
 *
 * @returns {false | {healed:number, target:number, spelldelay:number}}
 */
export function scrHealitemspell(state, target, amount, healFn = defaultHealFn, healRibbons = 0) {
  ensureFreezeState(state);
  const ch = charIdOfSlot(state, target);
  // `global.spelldelay` lives on state.kaizo.spelldelay here — the one name
  // the scene driver reads (kaizo/party/scenes.js) and the spell module
  // documents; this used to write state.spelldelay, which nothing read.
  if (kFreezeChar(state, ch)) {
    if (state.kaizo) state.kaizo.spelldelay = FROZEN_SPELLDELAY;
    return false;                          // the wasted action
  }
  const healAmount = amount + Math.ceil(amount / 8) * healRibbons;
  const healed = healFn(state, target, healAmount);
  if (state.kaizo) state.kaizo.spelldelay = FROZEN_SPELLDELAY;    // vanilla also lands on 15 here
  return { healed, target, spelldelay: FROZEN_SPELLDELAY };
}

// ───────────────────────────────────────────────────────────────────────────
// What a frozen member cannot do — scr_spell
// ───────────────────────────────────────────────────────────────────────────

/**
 * `scr_spell`'s freeze gates, as a decision this module can answer without
 * owning the spell effects.
 *
 * The preamble the gates sit under:
 *
 *     star  = global.chartarget[caster];
 *     _ctar = (star < 3) ? global.char[star] : -1;
 *     if (arg0 > 1 && arg0 <= 100) with (obj_knight_enemy) k_didspell = 1;
 *
 * `k_didspell` IS SET BEFORE THE GATE. A spell frozen out still counts as
 * "the party cast something this turn" for the knight's own bookkeeping —
 * the refusal is not a cancel.
 *
 * Cases 2 (Heal Prayer) and 11 (the stacking heal — UltraHeal in this sim's
 * spell table) break out with `global.spelldelay = 15` and no effect.
 *
 * CASE 6 (the all-heal) IS THE BUG — verbatim:
 *
 *     for (i = 0; i < 3; i += 1) {
 *         if (i_ex(obj_knight_enemy)) {
 *             if (obj_knight_enemy.k_freeze[_ctar]) continue;
 *         }
 *         scr_heal(i, healnum); ...
 *     }
 *
 * ORIGINAL BUG: the read is `k_freeze[_ctar]`, the caster's chosen TARGET,
 * and it is loop-invariant — so the all-heal skips EVERY member when the
 * target happens to be frozen and NONE when they are not. Frozen bystanders
 * are healed; the whole party is denied because of one member. NOT
 * CORRECTED; `scr_healall` two functions up is the same idea written
 * correctly, and the pair is the clearest statement of the indexing split
 * INDEX.md records.
 *
 * @returns {{kDidspell:boolean, blocked:boolean, spelldelay:number|null,
 *            targets:number[]|null}}
 *          `targets` is the SLOT list case 6 would heal (null for the
 *          single-target cases, whose target is `targetSlot`).
 */
export function scrSpellFreezeGate(state, spellId, casterSlot, targetSlot) {
  ensureFreezeState(state);
  const star = targetSlot;
  const ctar = star < 3 ? charIdOfSlot(state, star) : -1;
  const kDidspell = spellId > 1 && spellId <= 100;
  const frozenTarget = !!kFreezeChar(state, ctar);

  if (spellId === 2 || spellId === 11) {
    return frozenTarget
      ? { kDidspell, blocked: true, spelldelay: FROZEN_SPELLDELAY, targets: null }
      : { kDidspell, blocked: false, spelldelay: FROZEN_SPELLDELAY, targets: null };
  }
  if (spellId === 6) {
    const targets = [];
    for (let i = 0; i < 3; i++) {
      if (frozenTarget) continue;            // ORIGINAL BUG: loop-invariant
      if (charIdOfSlot(state, i) !== 0) targets.push(i);
    }
    return { kDidspell, blocked: targets.length === 0, spelldelay: 15, targets };
  }
  return { kDidspell, blocked: false, spelldelay: null, targets: null };
}

/**
 * `scr_spelltext` cases 202 / 231 — the only on-screen admission that a
 * frozen heal did nothing. The base line is kept and `/%` is stripped before
 * the suffix is appended, exactly as `string_replace_all` does it.
 */
export function spellTextFrozenSuffix(state, spellId, targetSlot, baseMsg) {
  if (!SPELLTEXT_NO_EFFECT_SPELLS.has(spellId)) return baseMsg;
  const ctar = targetSlot < 3 ? charIdOfSlot(state, targetSlot) : -1;
  if (kFreezeChar(state, ctar) !== 1) return baseMsg;
  return baseMsg.split('/%').join('') + FROZEN_NO_EFFECT_SUFFIX;
}

// ───────────────────────────────────────────────────────────────────────────
// The down messages — obj_knight_enemy Step_0:566-641
// ───────────────────────────────────────────────────────────────────────────

/** `kaizo_funchance(n)` — `irandom_range(1, n) <= 1 || global.kaizo_funni`. */
export function kaizoFunchance(state, n = 1) {
  // The left operand is evaluated first and unconditionally: TWO draws every
  // call, `kaizo_funni` or not.
  const roll = gmlIrandomRange(state.gmlRng, 1, n);
  return roll <= 1 || !!state.kaizo?.funni;
}

const DOWN_LATCH_KEYS = { 1: 'kris', 2: 'susie', 3: 'ralsei', 4: 'noelle' };

/**
 * The per-character "someone went down" lines, which is where `k_freeze`
 * becomes visible text. Run once per turn, gated in the GML by
 * `global.mnfight == 2 && global.turntimer <= 1 && setdownmessage == false`
 * and latched per character so each line prints once per fight.
 *
 * KRIS'S LINE IS FOUR-DEEP, and every layer overwrites the last:
 *
 *     base   "* Kris collapsed in silence.&"      (vanilla)
 *     sideb  "* Can't move your body.&"           (k_sideb)
 *     freeze "* Kris was frozen solid.&"          (k_freeze[1]) — wins over sideb
 *     funni  "* Kris is now dead.&"               (kaizo_funchance(100), 1/100)
 *
 * Susie and Ralsei get a freeze line each ("succumbed to the cold" / "encased
 * in ice") and no sideb line. NOELLE HAS NO FREEZE LINE — she has a sideb one
 * ("* She was used up.&") and that is all, because the Snowgrave clamp above
 * makes `k_freeze[4]` unreachable.
 *
 * `downcount == 2` concatenates ALL FOUR strings (two of which are empty).
 * Three simultaneous deaths do NOT concatenate — the test is `== 2`, not
 * `>= 2`. Faithful; that is the branch the mod wrote.
 *
 * The Kris branch also assigns a dead local, `var ohshit = "* Ralsei got the
 * ThornRing."`, which nothing reads and which is not emitted here.
 *
 * RNG: `kaizo_funchance` draws twice, and only when the Kris branch runs.
 *
 * @returns {{battlemsg:string, downcount:number, lines:object, draws:number}}
 */
export function downMessages(state) {
  const k = ensureFreezeState(state);
  const latch = (k.downLatch ??= { kris: false, susie: false, ralsei: false, noelle: false });
  const sideb = !!k.sideb;
  let draws = 0;

  const hpOfChar = (charId) => {
    const slot = slotOfCharId(state, charId);
    return slot < 0 ? null : state.partyHp[slot];
  };
  const down = (charId) => haveChar(state, charId)
    && !latch[DOWN_LATCH_KEYS[charId]]
    && hpOfChar(charId) < 1;

  let krisdown = '';
  let susiedown = '';
  let ralseidown = '';
  let noelledown = '';
  let downcount = 0;
  let battlemsg = null;

  if (down(1)) {
    krisdown = '* Kris collapsed in silence.&';
    if (sideb) krisdown = "* Can't move your body.&";
    if (kFreezeChar(state, 1)) krisdown = '* Kris was frozen solid.&';
    if (kaizoFunchance(state, 100)) krisdown = '* Kris is now dead.&';
    draws += 2;
    downcount += 1;
    latch.kris = true;
    battlemsg = krisdown;
  }
  if (down(2)) {
    susiedown = "* Susie's demise was expected.&";
    if (kFreezeChar(state, 2)) susiedown = '* Susie succumbed to the cold.&';
    downcount += 1;
    latch.susie = true;
    battlemsg = susiedown;
  }
  if (down(3)) {
    ralseidown = "* Ralsei's hope was shattered.&";
    if (kFreezeChar(state, 3)) ralseidown = '* Ralsei was encased in ice.&';
    downcount += 1;
    latch.ralsei = true;
    battlemsg = ralseidown;
  }
  if (down(4)) {
    noelledown = "* Noelle's breath goes cold.&";
    if (sideb) noelledown = '* She was used up.&';
    // NO k_freeze BRANCH — faithful. See the Snowgrave clamp.
    downcount += 1;
    latch.noelle = true;
    battlemsg = noelledown;
  }
  if (downcount === 2) {
    battlemsg = krisdown + susiedown + ralseidown + noelledown;
  }
  return {
    battlemsg,
    downcount,
    lines: { krisdown, susiedown, ralseidown, noelledown },
    draws,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// The Susie balloon gates — obj_knight_enemy Step_0:210 and :319
// ───────────────────────────────────────────────────────────────────────────

/**
 * The enemy-talk balloon counts a FROZEN Susie as present:
 * `if (global.hp[2] > 0 || k_freeze[2]) balloonturn++`. A Susie frozen at 0 HP
 * keeps the taunt schedule advancing that a merely-dead Susie would stall.
 */
export function balloonTurnAdvances(state) {
  const slot = slotOfCharId(state, 2);
  const hp = slot < 0 ? 0 : state.partyHp[slot];
  return hp > 0 || !!kFreezeChar(state, 2);
}

/**
 * …and then refuses to draw it:
 * `if (k_freeze[2]) { with (obj_herosusie) with (herofrozen) scr_minishakeobj(); createballoon = false; }`
 * The balloon is swallowed and her STATUE shakes instead. Purely visual
 * (skipped), but it changes whether a balloon exists at all, so it is
 * reported rather than dropped.
 */
export function balloonSuppressed(state) {
  return !!kFreezeChar(state, 2);
}

/**
 * `global.hp[2]` for a Susie who is NOT in the party. The mod reads her
 * CHARACTER cell whoever holds slot 1, and on a Kris + Noelle file that cell
 * still carries whatever the save (or a fresh boot) gave her — scr_gamestart's
 * chapter-3 block, `global.maxhp[2] = 190; global.hp[2] = global.maxhp[2];`
 * (gml_GlobalScript_scr_gamestart.gml:181-182), which is what the recorder
 * boots with. Save-dependent in principle; the boot value is the one the
 * dump states. It only decides whether `balloonturn` climbs from -1 to 0,
 * and no line exists at either.
 */
export const SUSIE_GAMESTART_HP = 190;

/**
 * THE ENEMY-TALK BALLOON ADVANCE, the mod's version — the hook sim/dialogue.js
 * advanceBalloon consults (`state.kaizo.hooks.advanceBalloon`). obj_knight_enemy
 * Step_0:206-211, inside the `enemytalk && talked == 0` branch:
 *
 *     if (practicemode || k_sideb || !i_ex(obj_herosusie)) balloonturn = -1;
 *     if (global.hp[2] > 0 || k_freeze[2]) {
 *         balloonturn++;
 *         if (balloonturn == 6) { msgsetloc(0, "Heheh.../%", ...); ... }
 *         ...
 *     }
 *
 * On the B-Side the counter is knocked back to -1 EVERY enemy-talk before the
 * increment, so it reads 0 at most and no `balloonturn == N` line can ever
 * match: **no Susie exchange on the B-Side, ever** — and `createballoon`
 * stays false, which sends the knight straight to `global.mnfight = 1.5`
 * (:340-343). The same reset covers practice mode and a roster without Susie,
 * so a hypothetical A-Side Kris + Noelle party is silent too.
 *
 * The lines themselves (balloonturn 6..) are the vanilla exchange the engine
 * owns; this hook is installed ONLY where the reset fires (the V-D roster
 * block), so when the reset does not apply it defers to the engine's own
 * advance rather than re-typing the taunts here. Returns the knight's line
 * or null, like the function it replaces.
 */
export function kaizoAdvanceBalloon(dlg, state, engineAdvance = null) {
  const k = state.kaizo ?? {};
  const practicemode = !!k.practicemode;
  const sideb = !!k.sideb;
  const susiePresent = !!haveChar(state, 2);
  if (!(practicemode || sideb || !susiePresent)) {
    // The reset does not fire: the vanilla path, unchanged.
    return engineAdvance ? engineAdvance(dlg, state) : null;
  }
  dlg.balloonturn = -1;
  const slot = slotOfCharId(state, 2);
  const hp2 = slot < 0 ? SUSIE_GAMESTART_HP : state.partyHp[slot];
  if (hp2 > 0 || kFreezeChar(state, 2)) {
    dlg.balloonturn += 1;
    // balloonturn is 0 here and every line is keyed 6 or higher (Step_0:213
    // onward): nothing matches, nothing is created.
  }
  dlg.ballooncon = 0;
  dlg.text = null;
  dlg.speaker = null;
  return null;
}
