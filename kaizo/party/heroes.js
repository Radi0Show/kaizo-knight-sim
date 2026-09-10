// KAIZO V-C/V-D — obj_heroparent for a roster that can be two people long,
// one of whom the simulator has never drawn before.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE (kaizo dump):
//   gml_Object_obj_heroparent_Create_0.gml   169-215 Noelle's block and the
//                                            `_sideb` gate the mod turns on;
//                                            222 `herofrozen = -4`
//   gml_Object_obj_heroparent_Step_0.gml     the state machine (unchanged by
//                                            the mod except the Kris defeat
//                                            sprite; the mod's other Step
//                                            hunks are the ATTACK economy and
//                                            live in kaizo/party/damage.js)
//   gml_Object_obj_heroparent_Draw_0.gml     12-46 freeze statue + gloom tint
//   gml_Object_obj_heroparent_CleanUp_0.gml  the k_freeze clear and the
//                                            statue leak
//   gml_GlobalScript_kaizo_settings_init.gml kaizo_gloomcolor()
//   deltas/gml_Object_obj_heroparent_{Create,Draw,Step,CleanUp}_0.md
//
// ── WHY THIS IS A COPY AND NOT A RE-EXPORT ────────────────────────────────
// The work item asked for a re-export "if and only if" a copy is unnecessary.
// It is necessary, for four independent reasons, any one of which would be
// enough:
//
//   1. `createHeroes()` is `[0, 1, 2].map(...)` — three hero records, always.
//   2. `stepHeroes()` is `for (let c = 0; c < 3; c++)` and reads
//      `HERO_SPRITES[c]`, i.e. it uses the SLOT as a CHARACTER index. That is
//      exactly true for Kris/Susie/Ralsei and exactly wrong for Kris/Noelle:
//      it would animate Noelle with Susie's sprite set.
//   3. `HERO_SPRITES` has no Noelle entry at all, and the one place her data
//      appears in sim/ is a comment explaining that her frame counts were
//      once copied onto Ralsei by mistake.
//   4. The mod adds two states sim/heroes.js has no concept of — the frozen
//      statue (which makes the hero's whole draw exit) and the B-Side gloom
//      tint.
//
// `stepHero`'s state machine itself is unchanged by the mod, so it is copied
// verbatim from sim/heroes.js rather than reinvented; the only edits are the
// two new gates and the spec lookup. sim/heroes.js is untouched.

import { mergeColor } from '../../sim/gml.js';
import {
  FACE_IDLE, FACE_ATTACK, FACE_SPELL, FACE_ITEM, FACE_DEFEND, FACE_ACT,
  FACE_DEFEAT, HERO_IDLE, HERO_ATTACK, HERO_SPELL, HERO_ITEM, HERO_ACT,
  HERO_VICTORY,
} from '../../sim/heroes.js';
import { rosterSize, memberAt, isFrozen, charIdOf } from './roster.js';

export {
  FACE_IDLE, FACE_ATTACK, FACE_SPELL, FACE_ITEM, FACE_DEFEND, FACE_ACT,
  FACE_DEFEAT, HERO_IDLE, HERO_ATTACK, HERO_SPELL, HERO_ITEM, HERO_ACT,
  HERO_VICTORY,
};

/** `herofrozen = -4` — obj_heroparent's Create. "No statue yet." */
export const HEROFROZEN_NONE = -4;
/** `herofrozen = -99` — what CleanUp writes BEFORE destroying. See below. */
export const HEROFROZEN_CLEANED = -99;

/**
 * One hero record per OCCUPIED SLOT — not three.
 *
 * `herofrozen` joins the vanilla fields because the mod's Create appends it
 * unconditionally for every hero, B-Side or not.
 */
export function createKaizoHeroes(state) {
  const n = rosterSize(state);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      state: HERO_IDLE,
      faceaction: FACE_IDLE,
      siner: 0,
      attacktimer: 0,
      acttimer: 0,
      defendtimer: 0,
      hurttimer: 0,
      hurt: 0,
      index: 0,
      sprite: null,
      // MOD: the statue handle. -4 means "spawn one on the first frozen
      // frame"; anything else means one already exists.
      herofrozen: HEROFROZEN_NONE,
      // MOD (B-Side): `image_blend`, which the mod's Draw no longer resets to
      // c_white unconditionally.
      blend: [255, 255, 255],
      // MOD: whether this hero's Draw exited early this frame.
      frozenHidden: false,
    });
  }
  return out;
}

/**
 * One frame for one character — sim/heroes.js's `stepHero`, copied verbatim.
 * The mod does not touch this machine; the hunks its Step delta lists are the
 * player-attack damage economy (kaizo/party/damage.js) and the Kris defeat
 * sprite (handled by the roster's spec, not here).
 *
 * `down` is `global.hp[global.char[myself]] > 0` inverted — the HP SIGN, not
 * `chardead`. Two different gates on purpose; sim/heroes.js has the note.
 */
function stepHero(h, spec, down) {
  if (down) {
    h.sprite = spec.defeat;
    h.index = 0;
    return;
  }

  if (h.hurt > 0) {
    h.hurt -= 1;
    h.sprite = spec.hurt;
    h.index = 0;
    return;
  }

  if (h.state === HERO_IDLE) {
    h.acttimer = 0;
    let sprite = spec.idle;
    if (h.faceaction === FACE_ATTACK) sprite = spec.attackready;
    if (h.faceaction === FACE_ITEM) sprite = spec.itemready;
    if (h.faceaction === FACE_SPELL) sprite = spec.spellready;
    if (h.faceaction === FACE_ACT) sprite = spec.actready;
    if (h.faceaction === FACE_DEFEAT) sprite = spec.defeat;

    if (h.faceaction === FACE_DEFEND) {
      // DEFEND animates while standing; every other ready pose is a still
      // frame over the idle bob. NOELLE'S BASE `defendframes` IS 0, so off
      // the B-Side her guard holds frame 0 and never moves — the `_sideb`
      // branch raises it to 5. Her zero is real; it is the one sim/heroes.js
      // records having been mis-copied onto Ralsei once.
      sprite = spec.defend;
      h.index = h.defendtimer;
      if (h.defendtimer < spec.defendframes) h.defendtimer += 0.5;
    } else {
      h.defendtimer = 0;
      h.index = h.siner / 5;
    }
    h.sprite = sprite;
    h.siner += 1;
    return;
  }

  const run = (frames, sprite) => {
    h.index = Math.min(h.attacktimer, frames);
    h.sprite = sprite;
    h.attacktimer += 0.5;
  };

  if (h.state === HERO_ATTACK) {
    h.siner += 1;
    run(spec.attackframes, spec.attack);
    if (h.attacktimer > spec.attackframes + 5) {
      h.state = HERO_IDLE;
      h.attacktimer = 0;
      h.faceaction = FACE_IDLE;
    }
    return;
  }
  if (h.state === HERO_SPELL) {
    run(spec.spellframes, spec.spell);
    if (spec.spellframes !== 0 && h.attacktimer > spec.spellframes + 8) {
      h.state = HERO_IDLE;
      h.attacktimer = 0;
      h.faceaction = FACE_IDLE;
    }
    return;
  }
  if (h.state === HERO_ITEM) {
    run(spec.itemframes, spec.item);
    if (h.attacktimer > spec.itemframes + 8) {
      h.state = HERO_IDLE;
      h.attacktimer = 0;
      h.faceaction = FACE_IDLE;
    }
    return;
  }
  if (h.state === HERO_ACT) {
    if (h.acttimer < spec.actframes) h.acttimer += 0.5;
    else h.acttimer += 0.5;
    h.sprite = spec.act;
    h.index = Math.min(h.acttimer, spec.actframes);
    if (h.acttimer >= spec.actreturnframes) {
      h.acttimer = 0;
      h.state = HERO_IDLE;
      h.faceaction = FACE_IDLE;
    }
    return;
  }
  if (h.state === HERO_VICTORY) {
    h.sprite = spec.victory;
    h.index = h.attacktimer;
    h.attacktimer += 0.5;
    return;
  }

  h.sprite = spec.idle;
}

/**
 * `kaizo_gloomcolor()` — `merge_color(c_blue, #268CAC, 0.5)`, a constant.
 *
 * `c_blue` is RGB(0, 0, 255); GML's `#RRGGBB` literal is RGB, so #268CAC is
 * (38, 140, 172). Half way is (19, 70, 213.5).
 *
 * THE HALF-PIXEL IS AMBIGUOUS AND PURELY VISUAL: GameMaker's merge_colour
 * truncates its channels while sim/gml.js's `mergeColor` rounds, so the blue
 * channel is 213 in the engine and 214 here. Recorded rather than special-
 * cased — the sim's helper is the one 60 suites are pinned to, and one unit
 * of blue in a tint capped at 30% opacity changes nothing that is measured.
 */
export const GLOOM_COLOR = mergeColor([0, 0, 255], [38, 140, 172], 0.5);

/**
 * The B-Side tint. obj_heroparent's Draw:
 *
 *     var _gamt = min(obj_knight_enemy.k_gloom[global.char[myself]] / 150, 0.3);
 *     _blend = merge_color(c_white, kaizo_gloomcolor(), _gamt);
 *
 * NOTE THE INDEX: `k_gloom[global.char[myself]]` — CHARACTER-indexed, so the
 * gloom the hero is tinted by is looked up by WHO THEY ARE. scr_charbox reads
 * the same array at `slot + 1` instead (deltas/INDEX.md item 9), and the two
 * disagree the moment Noelle joins. This is the Draw, so this is the char id.
 *
 * The ramp saturates at gloom 45 — which is precisely scr_damage's cap, so on
 * that path the tint reaches its ceiling exactly when the meter does.
 * scr_damage_maxhp has no such cap and can push past it; the `min` holds.
 */
export function gloomTint(gloom) {
  const gamt = Math.min(gloom / 150, 0.3);
  return mergeColor([255, 255, 255], GLOOM_COLOR, gamt);
}

/**
 * One frame of every hero. Roster-length, character-correct, plus the mod's
 * two new gates.
 *
 * THE FREEZE IS A DRAW-EVENT EFFECT, and the Draw's `exit` skips the hurt and
 * defend flash code below it — "a hero frozen mid-hurt-flash stops flashing
 * instantly" (the Draw delta's own note). The STATE MACHINE keeps running, as
 * in the original: nothing in the Step is gated on k_freeze. So a hero
 * unfrozen mid-animation resumes where the animation actually got to, not
 * where it was when they froze. Modelled by stepping normally and setting
 * `frozenHidden`.
 *
 * THE STATUE SPAWNS ONCE — `if (herofrozen == -4)` — using the hero's own
 * `hurtsprite`, except Kris, who gets the mod's `spr_krisb_frozen`. Both come
 * out of the roster entry's `sprites.frozen`, which is where that branch was
 * resolved.
 */
export function stepKaizoHeroes(state) {
  if (!state.heroes) return;
  const n = rosterSize(state);
  const sideb = !!state.kaizo?.sideb;
  for (let c = 0; c < n; c++) {
    const h = state.heroes[c];
    const m = memberAt(state, c);
    if (!h || !m) continue;

    // MOD (Draw hunk 1): the freeze statue, spawned on the first frozen frame.
    const frozen = isFrozen(state, c);
    if (frozen) {
      if (h.herofrozen === HEROFROZEN_NONE) {
        h.herofrozen = {
          sprite: m.sprites.frozen,
          x: m.pos.x,
          y: m.pos.y,
          depth: m.depth,
          image_index: 0,
          inbattle: 1,
          // `herofrozen.image_xscale = image_xscale` (Draw_0:41-42) — the
          // HERO's scales, and obj_heroparent's Create sets both to 2
          // (Create_0:14-15). obj_frozennpc's own Create defaults to 2 as
          // well, so the copy is a no-op in this fight; carried anyway,
          // because the statue's Draw multiplies its source rect by them and
          // a reader should not have to go and find out which 2 it is.
          image_xscale: 2,
          image_yscale: 2,
          // `image_alpha = 1` — the statue's Draw assigns it on its own first
          // frame (`fresh == 0`); its Create's 0 is never seen, because that
          // Draw runs on the creation frame.
          image_alpha: 1,
          // `timer`, the ice clock: `if (timer < 1) timer += 0.05` in the
          // statue's Draw, so it is FRAMES-ALIVE and nothing else. Held as an
          // age here — a renderer may not write sim state, and the drawer
          // derives `timer = min(1, age * 0.05)` from it.
          age: 0,
        };
      }
      h.frozenHidden = true;
    } else {
      h.frozenHidden = false;
    }
    // The statue's clock runs whether or not its hero is still frozen: the
    // instance outlives the freeze (cleanupKaizoHero, the CleanUp's missed
    // destroy), so nothing stops it. It saturates at 20.
    if (h.herofrozen && typeof h.herofrozen === 'object' && h.herofrozen.age < 20) {
      h.herofrozen.age += 1;
    }

    // MOD (Draw hunk 2): `image_blend = _blend` instead of two redundant
    // `image_blend = c_white` lines. `_blend` defaults to white, so a
    // non-B-Side draw is unchanged.
    if (sideb && state.knight) {
      // CHARACTER-indexed, per the Draw. `gloomByChar` is roster.js's mirror
      // of `obj_knight_enemy.k_gloom`.
      const g = state.kaizo?.gloomByChar?.[charIdOf(state, c)] ?? 0;
      h.blend = gloomTint(g);
    } else {
      h.blend = [255, 255, 255];
    }

    stepHero(h, m.spec, (state.partyHp?.[c] ?? 1) <= 0);
  }
}

/**
 * `obj_heroparent`'s CleanUp — and the leak, which is FAITHFUL:
 *
 *     var _mychar = global.char[myself];
 *     with (obj_knight_enemy) { k_freeze[_mychar] = 0; }
 *     if (herofrozen > -4) {
 *         herofrozen = -99;
 *         instance_destroy(herofrozen, false);
 *     }
 *
 * ORIGINAL BUG (deltas/INDEX.md item 16, and the one the work item names):
 * the handle is overwritten with -99 BEFORE it is passed to
 * `instance_destroy`, so the call targets instance id -99 — a no-op — and the
 * real obj_frozennpc is never destroyed here. The statue outlives its hero and
 * only goes away with the battle-end sweep (`scr_kaizo_killobjs`). Preserved:
 * the handle is cleared to HEROFROZEN_CLEANED and the statue record is
 * deliberately NOT removed, so anything that sweeps entities can still find
 * it. Do not "fix" this.
 *
 * `k_freeze[_mychar] = 0` IS unconditional and does work — the character is
 * unfrozen even though their statue survives.
 */
export function cleanupKaizoHero(state, slot) {
  const h = state.heroes?.[slot];
  if (!h) return;
  const charId = charIdOf(state, slot);
  if (state.kaizo?.freezeByChar) state.kaizo.freezeByChar[charId] = 0;
  if (state.kaizo?.freeze) state.kaizo.freeze[slot] = false;
  if (h.herofrozen !== HEROFROZEN_NONE) {
    // ORIGINAL BUG: assignment first, destroy second — the destroy misses.
    const leaked = h.herofrozen;
    h.herofrozen = HEROFROZEN_CLEANED;
    if (state.kaizo) {
      state.kaizo.leakedStatues = state.kaizo.leakedStatues ?? [];
      if (leaked && typeof leaked === 'object') state.kaizo.leakedStatues.push(leaked);
    }
  }
}

/** Put a character into a timed animation. Resets the timer, as the Step does. */
export function heroAct(state, c, heroState) {
  const h = state.heroes?.[c];
  if (!h) return;
  h.state = heroState;
  h.attacktimer = 0;
  h.acttimer = 0;
}

/** `hurt` — the flinch, which overrides everything for its duration. */
export function heroHurt(state, c, frames = 12) {
  const h = state.heroes?.[c];
  if (h) h.hurt = frames;
}
