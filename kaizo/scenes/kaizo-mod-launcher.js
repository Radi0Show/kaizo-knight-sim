// KAIZO V-C — the MOD'S dispatch, translated from the decompiled
// `obj_knight_enemy` Other_23 of EnderCat8's "Kaizo Roaring Knight" v2.3.3
// (kaizo_setAttack / kaizo_setAttack_sideb; private research dump at
// knight-research/kaizo-mod/). Structure mirrors sim/scenes/fight.js's
// launchAttack, reorganized by CONTROLLER TYPE because the mod layers
// several controllers per turn.
//
// PUBLISH GATE (kaizo/HANDOFF.md §5-C): this recreates another author's
// work. Local research/playtesting only until EnderCat8's permission.
//
// REUSE-FIRST (the whole point): every controller type routes to the
// VERIFIED sim attack module. Where the mod asks for a difficulty branch the
// module does not implement yet, the launch is APPROXIMATED (clamped to the
// nearest verified difficulty, or substituted) and RECORDED in
// state.kaizo.approx — the ledger verify-kaizo asserts against. Each
// translated delta later removes its ledger rows; the ledger reaching empty
// is the definition of dispatch-complete.
//
// ISOLATION: imports from sim/ one-way. Nothing here edits sim/.

import { spawn } from '../../sim/entity.js';
import { BATTLEBG_MASK } from '../../sim/masks.js';
import { KNIGHT } from '../../sim/actors.js';
import { gmlEq } from '../../sim/gml.js';
// ── TRANSLATED KAIZO MODULES (kaizo/attacks/) ─────────────────────────────
// Each is a COPY of the verified sim module with the mod's deltas applied,
// carrying its own check under kaizo/tools/checks/. The import source is the
// only thing that changes here — every symbol keeps its sim name.
import { boxsplitterAttack } from '../attacks/flurry-boxsplitter-attack.js';
import { launchKaizoStars } from '../attacks/stars-controller.js';
import { spawnRotatingSlash } from '../attacks/rotating-slash.js';
import { swordVortexManager, kaizoVortexendFreeze } from '../attacks/sword-vortex.js';
import { trackingSwordsManager } from '../attacks/tracking-swords.js';
import { knightStream } from '../attacks/knight-stream.js';
import { launchUnderbox } from '../attacks/underbox.js';
import { knightSwordfall } from '../attacks/swordfall.js';
import { launchKnightlines } from '../attacks/knightlines.js';
import { launchSwordTunnel } from '../attacks/sword-tunnel.js';
import { launchSwordTunnelRevised } from '../attacks/sword-tunnel-revised.js';
import { diagonalBulletManager } from '../attacks/diagonal-bullets.js';
import { spawnQuickslash1001, spawnQuickslashTrue } from '../attacks/quickslash.js';
import { roaring2 } from '../attacks/roaring-final.js';
import { launchKaizoSwordslash } from '../attacks/crescent-slash.js';
import {
  launchKaizoCombination, kaizoComboOrderFor, kaizoChainNext,
} from '../attacks/combination.js';
import { gmlCreate, gmlIrandom } from '../../sim/rng.js';
import { scrBulletInherit } from '../../sim/bullets/regularbullet.js';
import { VC_KNIGHT } from '../versions/vc-script.js';

/** `scr_bulletspawner`'s `damage = monsterat * 5` under the mod's AT 52. */
const VC_BASE_DAMAGE = VC_KNIGHT.at * 5; // 260

/** Stars' cone spawn point — measured constant, same as fight.js's. */
const CONE_POS = { x: 425, y: 78.56589 };

/**
 * The difficulties each verified sim module IMPLEMENTS today (from the
 * SINGLE-mode roster + the modules' own branch sets). The mod asks for far
 * more; resolveDifficulty clamps and ledgers until the deltas are
 * translated. Update an entry ONLY together with the translated branch and
 * its suite.
 */
const SUPPORTED = {
  // TRANSLATED (kaizo/attacks/ + a passing check under kaizo/tools/checks/):
  98: [0, 1, 2, 3, 3.1, 3.2, 3.3],                     // stars
  99: [0, 1, 2, 3, 5],                                 // flurry / box splitter
  101: [0],                                            // knightlines / PierceBlades
  103: [0],                                            // knight stream (no difficulty axis)
  104: [0, 1, 2, 8, 10],                               // rotating slash
  106: [0],                                            // underbox (variant is by ac, not difficulty)
  107: [0],                                            // roaring + the ac-104 finale
  108: [0, 1, 5, 10, 11],                              // swordfall
  151: [0, 2, 3, 3.1, 4, 5, 6, 6.1, 7, 7.1, 7.2, 8, 10, 11], // tracking swords
  153: [0, 3, 4, 4.1, 10, 11],                         // sword tunnel
  154: [0, 3, 3.1],                                    // sword vortex
  1001: [0],                                           // quickslash (mod-only type)
  97.1: [0],                                           // quickslash "true" (B-Side)
  102: [0],                                            // sword tunnel revised (no difficulty axis;
                                                       // the object has no difficulty branch and
                                                       // the ac-15 arm asks for 0)
  152: [0],                                            // diagonal bullets (d0 is the only one the
                                                       // mod's type-152 arm dispatches)
  109: [0, 1],                                         // crescent slash (ac 0; d0 -> variant 2,
                                                       // d1 -> variant 3, both in the kaizo module)
  // PENDING TRANSLATION — still the vanilla module. NOTE this row says
  // nothing about the BODY being right: it only stops resolveDifficulty from
  // clamping a difficulty the vanilla module already branches on. The
  // substitution itself is ledgered by VANILLA_BODIES below, unconditionally.
  105: [0],         // combination (fixed 4->2->3 chain)
};

/**
 * CONTROLLER TYPES WHOSE WHOLE BODY IS STILL THE VANILLA SIM MODULE.
 *
 * THE LEDGER USED TO BE BLIND TO EXACTLY THIS, which is the one thing it
 * exists to prevent. `resolveDifficulty` only ever ledgers a CLAMP — "the arm
 * asked for d5 and the module tops out at d3" — and every type below has a
 * SUPPORTED[] entry that covers the difficulty its arms actually ask for. So
 * `res.approx` came back false, `state.kaizo.approx` stayed EMPTY, and a row
 * running an entirely different attack from the mod's reported itself as
 * fully dispatched. verify-kaizo prints this ledger as "rows pending
 * translation"; an empty one was a green light that meant nothing.
 *
 * A row lands here when its BODY is a vanilla import (see the "STILL VANILLA"
 * import block above), regardless of difficulty. Deleting an entry and
 * swapping the launcher's import to a kaizo/attacks/ module are the same
 * edit; the ledger reaching empty stays the definition of dispatch-complete.
 *
 * Each `why` is a MEASURED divergence from the recording where one exists, so
 * the ledger row carries the evidence rather than a suspicion.
 */
const VANILLA_BODIES = {
  // 102, 152 and 109 LEFT THIS TABLE on 2026-08-29, in the same edit that
  // swapped their imports to kaizo/attacks/. Their checks assert the pairing
  // rather than trusting it: check-oracle-tunnel drives vanilla-launch-then-swap
  // against kaizo-launch and requires the spawn ledgers to be row-for-row
  // equal, and check-oracle-tracking asserts
  // `pending.length === (routed.swapped ? 1 : 0)` — so re-adding a row here
  // without reverting the import, or the reverse, turns those checks red.
  // check-oracle-crescent asserts the same pairing at its section 2c
  // (`pending.length === (routed.swapped ? 1 : 0)`), so re-adding 109 here
  // without reverting the import, or the reverse, turns it red.
  // 105 LEFT THIS TABLE on 2026-08-29, and it is the row that emptied the
  // table. Its `why` was that the chain ran vanilla SEGMENTS whatever order
  // it was handed — true right up until sim/attacks/combination.js grew the
  // site-name seam and the four kaizo segment modules started naming their
  // handoff sites. The launcher's case 105 now installs
  // `state.kaizo.hooks.comboChainNext`, so the chain resolves kaizo bodies
  // end to end. check-oracle-weird PROBES that pairing rather than trusting
  // it — probeLeg1() drives this launcher and asserts the routing is live,
  // and its atk_Frenzy1 / atk_Frenzy3 assertions flip on that probe — so
  // reverting the case-105 edit without re-adding a row here, or the
  // reverse, turns it red.
};

/** Controller types that pin global.turntimer = 999999 and end the turn
 *  themselves (their CleanUp/local clock hands it back). */
// 1001 pins (dbulletcontroller Step_0:2264 sets 999999 and the controller
// hands the clock back itself at its final pose). 97.1 deliberately does NOT
// — the GML leaves it on the arm's own scr_turntimer(9999) floor — and the
// distinction is kept rather than lumped together, because "both self-manage
// the clock" is the kind of near-enough that stops being true the moment one
// of them changes.
const PINNERS = new Set([102, 104, 105, 106, 107, 1001]);

function resolveDifficulty(type, d) {
  const sup = SUPPORTED[type];
  if (!sup) return { use: 0, approx: true };
  // gmlEq, not ===: the mod's difficulties are FRACTIONAL (3.1, 6.1, 4.1)
  // and the project's law is that any real-valued GML compare goes through
  // the epsilon (CLAUDE.md, "GML == ON REALS IS NOT ===").
  if (sup.some((s) => gmlEq(s, d))) return { use: d, approx: false };
  // Nearest supported at-or-below floor(d) (the mod's x.1 values are
  // variants of x); floor of the list otherwise.
  const fl = Math.floor(d);
  let best = sup[0];
  for (const s of sup) if (s <= fl && s > best) best = s;
  if (sup.some((s) => gmlEq(s, fl))) best = fl;
  return { use: best, approx: true };
}

function ledger(state, entry) {
  (state.kaizo.approx ??= []).push(entry);
}

/** fight.js's reanchorRng, kaizo copy — same seed arithmetic, one advance
 *  per scr_bulletspawner call. */
/** One scr_bulletspawner call: the reseed, then obj_dbulletcontroller Create's `basedir = irandom(360)` (dead, two draws). */
function reanchorForController(state) {
  reanchorRng(state);
  if (state.gmlRng) gmlIrandom(state.gmlRng, 360);
}

function reanchorRng(state) {
  state.spawnn = state.spawnn ?? 0;
  state.gmlRng = gmlCreate((state.seed + state.spawnn * 1000) >>> 0);
  state.spawnn += 1;
}

function knightPos(state) {
  const knight = state.entities.find((e) => e.alive && e.type.name === 'obj_knight_enemy');
  return {
    knight,
    kx: knight ? knight.x : KNIGHT.x,
    ky: knight ? knight.y : KNIGHT.ystart,
  };
}

/**
 * One `scr_bulletspawner(...)` call: reanchor, the dc's dead
 * `basedir = irandom(360)` (two draws), then the type's own launch — the
 * per-type bodies are fight.js's launchAttack cases reorganized by type.
 *
 * opts: { difficulty, damage, rowId, chainedType }
 */
/**
 * THE CONTROLLER'S INHERITABLE FIELDS — obj_dbulletcontroller as scr_bulletspawner
 * leaves it. Every field is the -1 "leave alone" sentinel except `damage`
 * (what the fight script wrote), `element` (the string "none", which
 * scr_bullet_inherit copies unconditionally) and `target`, which
 * scr_bulletspawner stamps with the knight's `mytarget`: `__dc.target =
 * mytarget`. And `mytarget` is FOUR. scr_randomtarget (Step_0:197, every
 * enemy-talk phase) rolls a slot, marks the party targeted, and its
 * chapter-2+ tail then overwrites `mytarget = 4` (scr_randomtarget:21-35) —
 * "pick at hit time". So every manager a type block hands to
 * scr_bullet_inherit carries target 4, its bullets inherit it, and
 * scr_damage's `target == 4` branch rolls scr_randomtarget_old ON EVERY
 * HIT before scr_kaizo_target (kaizo/party/damage.js scrDamage).
 *
 * MEASURED with the draw probe (kaizo_oracle_drawprobe, 2026-09-01, anchor
 * n=4): a vortex blade's hit drew choose(0,1,2) + hitstat + choose(1,2) +
 * the writer's random(600) — four in-frame, five at f898 where the roll
 * landed on the slot the f885 sword had killed and rolled again — while
 * the falling sword's hit (target 0 from scr_bullet_init; the Step-site
 * swords are plain instance_create, never inherited) drew three. The sim
 * gave no manager a target, so it was one draw short on every
 * inherited-target hit in the fight, from Vortex 1's first blade on.
 */
const KNIGHT_MYTARGET = 4;
function dcInheritable(opts) {
  return {
    damage: opts.damage ?? -1,
    grazepoints: -1,
    timepoints: -1,
    inv: -1,
    target: KNIGHT_MYTARGET,
    grazed: -1,
    grazetimer: -1,
    element: 'none',
  };
}

/**
 * The type blocks whose manager goes through `scr_bullet_inherit(<manager>)`
 * in the kaizo obj_dbulletcontroller Step_0 (whole-file grep, 2026-09-01):
 * 97.1, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 151, 152, 153, 154,
 * 1001. Type 98 (Stars) and 109 (the crescent) do NOT — their bullets keep
 * scr_bullet_init's target 0. 100 has no sim case; 1001 and 97.1 inherit
 * inside quickslash.js through its own controller stand-in.
 */
const DC_INHERIT_TYPES = new Set([99, 101, 102, 103, 104, 105, 106, 107, 108, 151, 152, 153, 154]);

function spawnControllerByType(state, type, opts = {}) {
  const mg = spawnControllerByTypeInner(state, type, opts);
  // scr_bullet_inherit sits in the type block right after instance_create —
  // before the block's own field writes in most types, AFTER them in 108
  // (`knight_swordfall.target = 3`, then the inherit: the 3 is dead, the
  // manager carries 4). Here it runs after the case body: the body sets the
  // same damage the inherit would copy and touches no other inherited
  // field, and every manager below spawns its bullets in its own Step,
  // never at create, so nothing has read the target yet.
  if (mg && typeof mg === 'object' && DC_INHERIT_TYPES.has(type)) {
    scrBulletInherit(dcInheritable(opts), mg);
  }
  return mg;
}

function spawnControllerByTypeInner(state, type, opts = {}) {
  const { knight, kx, ky } = knightPos(state);
  const gt = state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
  const gx = gt ? gt.x : state.view.x + 320;

  const res = resolveDifficulty(type, opts.difficulty ?? 0);
  // THE BODY FIRST, then the difficulty. A vanilla substitution is ledgered
  // whether or not the difficulty happened to be "supported" — see
  // VANILLA_BODIES. This row is what makes a green ledger mean something.
  const body = VANILLA_BODIES[type];
  if (body) {
    ledger(state, {
      row: opts.rowId, type, asked: `type ${type} body`,
      used: `vanilla ${body.module}`, why: body.why,
    });
  }
  if (res.approx) {
    ledger(state, {
      row: opts.rowId, type, asked: opts.difficulty ?? 0, used: res.use,
      why: 'difficulty branch not translated yet',
    });
  }
  const difficulty = res.use;

  // scr_bulletspawner's reseed + the controller's basedir draw -- done by the
  // caller when it launches a whole arm (launchVCAttack, `prearmed`), here
  // for a lone spawn.
  if (!opts.prearmed) {
    reanchorForController(state);
    state.kaizo?.hooks?.afterLaunchReseed?.(state); // see launchVCAttack
  }

  if (knight) knight.difficulty = difficulty;

  switch (type) {
    case 98: // Stars — the kaizo module owns the whole launch (fight.js
      // case 1 verbatim: dc-before-cone spawn order, the d0 side choose and
      // the two oracle-fitted pads) with the mod's endtimer rule folded in.
      return launchKaizoStars(state, difficulty);
    case 99: { // Flurry — fight.js case 2
      const mg = spawn(state, boxsplitterAttack, { x: kx, y: ky });
      mg.difficulty = difficulty;
      if (knight) knight.image_alpha = 0;
      return mg;
    }
    case 101: // knightlines — fight.js case 20 (does NOT pin the clock)
      return launchKnightlines(state, kx, ky);
    case 102: // sword tunnel revised — fight.js case 3
      return launchSwordTunnelRevised(state);
    case 103: { // knight stream — fight.js case 4, kaizo module
      // The mod's beam is a REAL bullet and its Step pins damage = 153 every
      // frame, so the dispatch's dc.damage is overwritten by the object
      // itself (the 206-vs-306 question the index flagged is moot at the
      // bullet). No ledger row: the module implements the mod's own flow.
      if (knight) knight.image_alpha = 0;
      return spawn(state, knightStream, { x: kx, y: ky });
    }
    case 104: // rotating slash — fight.js case 5
      // `global.turntimer = 999999` -- kaizo dbulletcontroller Step_0:2188, the
      // type block, on the controller's Step (this frame): a PINNER.
      state.turntimer = 999999;
      return spawnRotatingSlash(state, kx, ky, { difficulty });
    case 105: { // combination — fight.js case 7
      // THE SEAM. Each combination segment hands off through
      // sim/attacks/combination.js's chainNext, which forwards to
      // kaizoChainNext only when this hook is present. Without this line the
      // launcher's own first segment is kaizo and every segment after it is a
      // vanilla body, which is the exact half-landed state the ledger exists
      // to catch.
      state.kaizo = state.kaizo ?? {};
      state.kaizo.hooks = state.kaizo.hooks ?? {};
      // `??=`, NOT `=`. A scene that has already installed a hook keeps it —
      // the same deference the two lines above show an existing state.kaizo.
      // check-oracle-weird wraps kaizoChainNext to RECORD which site each hop
      // asked for, and that receipt is how it proves the seam fired rather
      // than inferring it from the segment types; an unconditional assignment
      // here silently ate the wrapper and the check went red with
      // "sites seen: [none]". Anything installed here still ends up in
      // kaizoChainNext — the wrapper delegates to it — so this defers on the
      // INSTRUMENTATION without conceding the routing.
      state.kaizo.hooks.comboChainNext ??= kaizoChainNext;
      // The ORDER is Other_23's, keyed by attack choice: ac 7 -> 4-2-3,
      // ac 106 -> 1-2-5. launchVCAttack has already set state.currentAc
      // (the ac-106 case relies on the same thing).
      return launchKaizoCombination(state, kaizoComboOrderFor(state.currentAc));
    }
    case 106: { // underbox — fight.js case 6 (pins the clock), kaizo module
      state.turntimer = 999999;
      // dc.damage (87/103) now rides the manager exactly as
      // scr_bullet_inherit puts it there. TERMINAL by the mod's own GML —
      // the fans hardcode 103 and the big shot 206 (kaizo weird_circle
      // Alarm_1), so nothing downstream re-reads it. No ledger row.
      // The VARIANT is selected by state.currentAc (101 / 102 / 102.1),
      // which launchVCAttack has already set.
      return launchUnderbox(state, kx, ky, { dcDamage: opts.damage });
    }
    case 107: // roaring — fight.js case 9
      // `global.turntimer = 999999` -- kaizo dbulletcontroller Step_0:2253: a PINNER.
      state.turntimer = 999999;
      return spawn(state, roaring2, { x: state.view.x + 320, y: state.view.y + 88 });
    case 108: { // swordfall — fight.js case 10, kaizo module
      // `global.turntimer = 600` — an ASSIGNMENT, not the scr_turntimer
      // floor (kaizo dbulletcontroller Step_0:2283; vanilla used 999999).
      // It runs at the controller's create, so it lands before the arm's
      // own later scr_turntimer(270) floor, which then correctly no-ops.
      // 108 stays OUT of PINNERS: 600 is a real running clock the manager
      // does not manage itself.
      state.turntimer = 600;
      const mg = spawn(state, knightSwordfall, { x: kx, y: ky });
      // `knight_swordfall.target = 3` (Step_0:2291) — and then the block's
      // scr_bullet_inherit (Step_0:2293) overwrites it with the controller's
      // 4, so the 3 is dead in the game as well; nothing in swordfall.js
      // reads it (the swords take scr_bullet_init's target 0, never the
      // manager's). Kept for the line-by-line; spawnControllerByType's
      // inherit lands last, exactly as the block orders it.
      mg.target = 3;
      mg.difficulty = difficulty;
      knightSwordfall.init(mg, state);
      if (opts.damage !== undefined) mg.damage = opts.damage;
      return mg;
    }
    case 109: // crescent slash — fight.js case 0, kaizo module
      return launchKaizoSwordslash(state, difficulty);
    case 151: { // tracking swords — fight.js cases 11/14
      const mg = spawn(state, trackingSwordsManager, { x: gx, y: state.view.y });
      mg.variant = difficulty;
      mg.damage = opts.damage ?? VC_BASE_DAMAGE;
      trackingSwordsManager.init(mg, state, opts.chainedType);
      return mg;
    }
    case 152: { // diagonal bullets — fight.js case 12
      const mg = spawn(state, diagonalBulletManager, { x: gx, y: state.view.y });
      mg.damage = opts.damage ?? VC_BASE_DAMAGE;
      return mg;
    }
    case 153: // sword tunnel — kaizo module owns the launch
      // The helper performs the controller's exact order (spawn at
      // growtangle.x / cameray, assign difficulty + damage, then ONE
      // event_user(0)). It must be called once and once only: difficulty
      // 10's `swordy += 50` compounds, so a second init drops the corridor
      // another 50px. It reads state.currentAc, which launchVCAttack has
      // already set, to decide whether to raise the wind-up animation.
      return launchSwordTunnel(state, {
        difficulty,
        damage: opts.damage ?? VC_BASE_DAMAGE,
      });
    case 154: { // sword vortex — fight.js case 15, first half
      const mg = spawn(state, swordVortexManager, { x: gx, y: state.view.y });
      mg.damage = opts.damage ?? VC_BASE_DAMAGE;
      return mg;
    }
    // THE TWO QUICKSLASH TYPES ARE NOT INTERCHANGEABLE, which is why they
    // are separate cases rather than one shared arm:
    //   1001  pins global.turntimer = 999999 and takes NO event_user(0), so
    //         Create's local_turntimer 600 stands and the full ramp plus the
    //         phase-2 barrage run (dbulletcontroller Step_0:2264-2278).
    //   97.1  does not pin, sets endtype 1 under kaizo_sideb(), and DOES
    //         call event_user(0) — whose "full" arm cuts local_turntimer to
    //         230 and flies the knight in, a visibly shorter turn that never
    //         reaches the barrage (Step_0:1963-1985).
    // Both helpers hide the Knight themselves; do not do it again here.
    case 1001:
      return spawnQuickslash1001(state, { damage: opts.damage });

    case 97.1:
      return spawnQuickslashTrue(state, { damage: opts.damage, difficulty });
    default:
      ledger(state, { row: opts.rowId, type, asked: type, used: 'nothing', why: 'unknown type' });
      return null;
  }
}

// ── the dispatch arms, transcribed from Other_23 (arg0 == 1) ───────────────
// Op forms: {spawn:{type, d?, damage?, chainedType?}} | {invc: v} |
//           {turntimer: v} | {pre:{first,second,third}} | {chargeup: true} |
//           {swordfallTurnTime: v}   <- TRANSCRIBED BUT INERT, see the handler
// Order within an arm is the GML's order (invc assignments interleave).

function normalArm(row, vars) {
  const ac = row.ac;
  const phase = row.phase;
  const d = row.difficulty;
  switch (ac) {
    case 0: return [{ spawn: { type: 109, d } }, { invc: 1 },
      { spawn: { type: 151, d: 6, damage: 153 } }, { invc: 1 }];
    case 1:
      if (phase === 1 && !vars.firststarsused) {
        vars.firststarsused = true;
        return [{ spawn: { type: 98, d: 1 } }, { invc: 1 }];
      }
      if (phase === 2) return [{ spawn: { type: 98, d: 3 } }, { invc: 1 }];
      if (phase === 3) return [{ spawn: { type: 98, d: 3.1 } }, { invc: 1 }];
      return [];
    case 2:
      if (phase === 1) {
        return [{ spawn: { type: 108, d: 0 } }, { invc: 0.4 },
          { spawn: { type: 154, d: 3, damage: 120 } }];
      }
      return [{ spawn: { type: 99, d: 2 } }, { invc: 0.4 }];
    case 3: return [{ spawn: { type: 106, damage: 87 } }, { invc: 0.4 }];
    case 4: return [{ spawn: { type: 106, damage: 103 } }, { invc: 1 },
      { spawn: { type: 108, d, damage: 103 } }, { invc: 1 }];
    case 5: return [{ spawn: { type: 104, d } }, { invc: 1 },
      { spawn: { type: 104, d } }, { invc: 1 }];
    case 6: return [{ spawn: { type: 101, damage: 103 } }, { invc: 1 }];
    case 7: return [{ pre: { first: 4, second: 2, third: 3 } },
      { spawn: { type: 105 } }, { invc: 0.4 }];
    case 9: return [{ spawn: { type: 107 } }, { invc: 1 }];
    case 10: return [{ spawn: { type: 108, d } }, { invc: 0.4 },
      { spawn: { type: 104, d: 0 } }, { invc: 1 },
      { spawn: { type: 104, d: 0 } }, { invc: 1 }];
    case 11: return [{ spawn: { type: 151, d: 0, damage: 206 } }, { invc: 0.4 }];
    case 12: return [{ spawn: { type: 152, d } }, { invc: 1 },
      { spawn: { type: 151, d: 7, damage: 135, chainedType: 152 } }, { invc: 0.4 }];
    case 13:
      if (phase === 1) {
        return [{ spawn: { type: 153, d: 4, damage: 62 } }, { invc: 0.14 },
          { spawn: { type: 151, d: 4, damage: 206, chainedType: 153 } }, { invc: 0.4 }];
      }
      if (phase === 2) {
        return [{ spawn: { type: 104, d: 1 } },
          { spawn: { type: 154, d: 3, damage: 206 } }];
      }
      return [{ spawn: { type: 104, d: 0 } }, { spawn: { type: 104, d: 0 } },
        { spawn: { type: 151, d: 0, damage: 206, chainedType: 104 } }, { invc: 0.4 }];
    case 14: return [{ spawn: { type: 151, d: 10, damage: 100 } }, { invc: 0.8 },
      { spawn: { type: 151, d: 10, damage: 100 } }, { invc: 0.8 }];
    case 15.1: return [{ spawn: { type: 153, d: 4.1, damage: 62 } }, { invc: 0.14 },
      { spawn: { type: 153, d: 11, damage: 62 } }, { invc: 0.14 }, { turntimer: 450 }];
    case 15: return [{ spawn: { type: 102 } }, { invc: 0.4 },
      { spawn: { type: 151, d: 7, damage: 135, chainedType: 102 } }, { invc: 0.4 }];
    case 16: return [{ spawn: { type: 104, d: 0 } },
      { spawn: { type: 151, d: 0, damage: 206, chainedType: 104 } }, { invc: 0.4 },
      { spawn: { type: 151, d: 0, damage: 206, chainedType: 104 } }, { invc: 0.4 }];
    case 17: return [{ spawn: { type: 151, d: 3, damage: 206 } }, { invc: 0.4 }];
    case -1: return [{ chargeup: true }];
    case 20: return [{ spawn: { type: 98, d: 3.3 } }, { invc: 1 },
      { spawn: { type: 154, d: 3.1, damage: 120 } }];
    case 101: return [{ spawn: { type: 106, damage: 103 } }, { invc: 1 },
      { spawn: { type: 153, d: 10, damage: 62 } }, { turntimer: 240 }];
    case 102: return [{ spawn: { type: 106, damage: 103 } },
      { spawn: { type: 108, d: 10, damage: 103 } }, { invc: 0.66 },
      { turntimer: 270 }, { swordfallTurnTime: 40 }];
    case 103: return [{ spawn: { type: 108, d: 11 } }, { invc: 0.4 },
      { spawn: { type: 104, d: 10 } }, { invc: 1 },
      { spawn: { type: 104, d: 10 } }, { invc: 1 }, { turntimer: 240 }];
    case 104: return [{ spawn: { type: 107 } }, { invc: 0.5 }];
    case 105: return [{ spawn: { type: 1001, damage: 80 } }, { invc: 0.4 }, { turntimer: 9999 }];
    case 105.1: return [{ spawn: { type: 97.1, damage: 80 } }, { invc: 0.4 }, { turntimer: 9999 }];
    case 106: return [{ pre: { first: 1, second: 2, third: 5 } },
      { spawn: { type: 105, damage: 80 } }, { invc: 0.4 }, { turntimer: 480 }];
    case 107: return [{ spawn: { type: 103, damage: 206 } }, { invc: 0.4 }, { turntimer: 240 }];
    case 108: return [{ spawn: { type: 99, d: 5 } }, { invc: 0.4 }, { turntimer: 530 }];
    case 109: return [{ spawn: { type: 99, d: 3 } }, { invc: 0.4 }, { turntimer: 350 }];
    case 110: return [{ spawn: { type: 101, damage: 103 } }, { invc: 0.4 }];
    case 111: return [{ spawn: { type: 154, d: 3, damage: 120 } },
      { spawn: { type: 104, d: 8, chainedType: 154 } }];
    default: return [];
  }
}

/** The normal fn's trailing `if (myattackchoice < 100)` scr_turntimer table.
 *  NOTE it covers ac -1 too: the kaizo charge-up turn gets the 240 floor. */
function normalTurntimerFloor(row) {
  const ac = row.ac;
  const d = row.difficulty;
  if (ac >= 100) return 0;
  if (ac === 7) return 270;
  if (ac === 2) return 350;
  if (ac === 0 && d === 0) return 300;
  if (ac === 0 && d === 1) return 300;
  if (ac === 11 && d === 0) return 292;
  if (ac === 11) return 300;
  if (ac === 12) return 340;
  if (ac === 13 && d === 3) return 360;
  if (ac === 13 && row.phase === 1) return 450;
  if (ac === 13) return 330;
  if (ac === 14) return 420;
  if (ac === 15) return 360;
  return 240;
}

function sidebArm(row, vars) {
  const ac = row.ac;
  const phase = row.phase;
  const d = row.difficulty;
  // The sideb fn opens with scr_turntimer(240) before dispatching.
  const lead = [{ turntimer: 240 }];
  switch (ac) {
    case 0: return [...lead, { spawn: { type: 109, d } },
      { spawn: { type: 151, d: 6.1, damage: 153 } }, { invc: 1 }, { turntimer: 300 }];
    case 1:
      if (phase === 1 && !vars.firststarsused) {
        vars.firststarsused = true;
        return [...lead, { spawn: { type: 98, d: 1 } }, { invc: 1 }];
      }
      if (phase === 2) return [...lead, { spawn: { type: 98, d: 3 } }, { invc: 1 }];
      if (phase === 3) return [...lead, { spawn: { type: 98, d: 3.1 } }, { invc: 1 }];
      return lead;
    case 2:
      if (phase === 1) {
        return [...lead, { turntimer: 350 }, { spawn: { type: 108, d: 1 } }, { invc: 0.4 },
          { spawn: { type: 154, d: 3, damage: 120 } }];
      }
      return [...lead, { turntimer: 350 }, { spawn: { type: 99, d: 2 } }, { invc: 0.4 }];
    case 3:
      if (phase === 1) {
        return [...lead, { spawn: { type: 106, damage: 103 } }, { invc: 1 },
          { spawn: { type: 153, d: 10, damage: 62 } }, { turntimer: 240 }];
      }
      return [...lead, { spawn: { type: 106, damage: 87 } }, { invc: 0.4 }];
    case 4: return [...lead, { spawn: { type: 106, damage: 103 } }, { invc: 1 },
      { spawn: { type: 108, d, damage: 103 } }, { invc: 1 }];
    case 5: return [...lead, { spawn: { type: 104, d } }, { invc: 1 },
      { spawn: { type: 104, d } }, { invc: 1 }];
    case 6: return [...lead, { spawn: { type: 101, damage: 103 } }, { invc: 1 }];
    case 7: return [...lead, { pre: { first: 4, second: 2, third: 3 } },
      { spawn: { type: 105 } }, { invc: 0.4 }, { turntimer: 270 }];
    case 9: return [...lead, { spawn: { type: 107 } }, { invc: 1 }];
    case 10: return [...lead, { spawn: { type: 108, d } }, { invc: 0.4 },
      { spawn: { type: 104, d: 0 } }, { invc: 1 },
      { spawn: { type: 104, d: 0 } }, { invc: 1 }];
    case 11: return [...lead, { spawn: { type: 151, d: 0, damage: 206 } }, { invc: 0.4 },
      { turntimer: 300 }];
    case 12: return [...lead, { spawn: { type: 152, d } }, { invc: 1 },
      { spawn: { type: 151, d: 7, damage: 135, chainedType: 152 } }, { invc: 0.4 },
      { turntimer: 340 }];
    case 13:
      if (phase === 1) {
        return [...lead, { spawn: { type: 153, d: 4, damage: 62 } }, { invc: 0.14 },
          { spawn: { type: 151, d: 4, damage: 206, chainedType: 153 } }, { invc: 0.4 },
          { turntimer: 470 }];
      }
      if (phase === 2) {
        return [...lead, { spawn: { type: 104, d: 2 } },
          { spawn: { type: 154, d: 3, damage: 206 } }, { turntimer: 360 }];
      }
      return [...lead, { spawn: { type: 104, d: 0 } }, { spawn: { type: 104, d: 0 } },
        { spawn: { type: 151, d: 0, damage: 206, chainedType: 104 } }, { invc: 0.4 },
        { turntimer: 330 }];
    case 14: return [...lead, { spawn: { type: 151, d: 10, damage: 100 } }, { invc: 0.8 },
      { spawn: { type: 151, d: 10, damage: 100 } }, { invc: 0.8 }, { turntimer: 420 }];
    case 15.1: return [...lead, { spawn: { type: 153, d: 4.1, damage: 62 } }, { invc: 0.14 },
      { spawn: { type: 153, d: 11, damage: 62 } }, { invc: 0.14 }, { turntimer: 450 }];
    case 15: return [...lead, { spawn: { type: 102 } }, { invc: 0.4 },
      { spawn: { type: 151, d: 7, damage: 135, chainedType: 102 } }, { invc: 0.4 },
      { turntimer: 360 }];
    case 16: return [...lead, { spawn: { type: 104, d: 1 } },
      { spawn: { type: 151, d: 0, damage: 206, chainedType: 104 } }, { invc: 0.4 },
      { spawn: { type: 151, d: 0, damage: 206, chainedType: 104 } }, { invc: 0.4 }];
    case 17: return [...lead, { spawn: { type: 151, d: 3.1, damage: 206 } }, { invc: 0.4 }];
    case -1: return [...lead, { chargeup: true }];
    case 20: return [...lead, { spawn: { type: 98, d: 3.3 } }, { invc: 1 },
      { spawn: { type: 154, d: 3.1, damage: 120 } }];
    case 101: return [...lead, { spawn: { type: 106, damage: 103 } }, { invc: 1 },
      { spawn: { type: 153, d: 10, damage: 62 } }, { turntimer: 240 }];
    case 102: return [...lead, { spawn: { type: 106, damage: 103 } },
      { spawn: { type: 108, d: 10, damage: 103 } }, { invc: 0.66 },
      { turntimer: 270 }, { swordfallTurnTime: 40 }];
    case 103: return [...lead, { spawn: { type: 108, d: 11 } }, { invc: 0.4 },
      { spawn: { type: 104, d: 10 } }, { invc: 1 },
      { spawn: { type: 104, d: 10 } }, { invc: 1 }, { turntimer: 240 }];
    case 104: return [...lead, { spawn: { type: 107 } }, { invc: 0.5 }];
    case 105: return [...lead, { spawn: { type: 1001, damage: 80 } }, { invc: 0.4 }, { turntimer: 9999 }];
    case 105.1: return [...lead, { spawn: { type: 97.1, damage: 80 } }, { invc: 0.4 }, { turntimer: 9999 }];
    case 106: return [...lead, { pre: { first: 1, second: 2, third: 5 } },
      { spawn: { type: 105, damage: 80 } }, { invc: 0.4 }, { turntimer: 480 }];
    case 107: return [...lead, { spawn: { type: 103, damage: 206 } }, { invc: 0.4 }, { turntimer: 240 }];
    case 108: return [...lead, { spawn: { type: 99, d: 5 } }, { invc: 0.4 }, { turntimer: 530 }];
    case 109: return [...lead, { spawn: { type: 99, d: 3 } }, { invc: 0.4 }, { turntimer: 350 }];
    case 110: return [...lead, { spawn: { type: 101, damage: 103 } }, { invc: 0.4 }];
    case 111: return [...lead, { spawn: { type: 154, d: 3, damage: 120 } },
      { spawn: { type: 104, d: 8, chainedType: 154 } }];
    case 112: return [...lead, { spawn: { type: 151, d: 11, damage: 206 } }, { invc: 0.4 },
      { turntimer: 460 }];
    default: return lead;
  }
}

function armFor(row, vars, sideb) {
  return sideb ? sidebArm(row, vars) : normalArm(row, vars);
}

/**
 * The armed turn clock for a row — the driver's turnLength hook. A row whose
 * arm contains a PINNER type is self-ending (999999); otherwise the max of
 * its scr_turntimer floors (plus the normal fn's <100 table / sideb's 240).
 */
/**
 * Does this row's arm end its own turn? True when the arm spawns a PINNER type
 * (its controller pins global.turntimer = 999999 on its own Step and the attack
 * object hands the clock back itself). This is the property the old
 * `vcTurnLength === 999999` stood in for; the armed value is the arm's floor now.
 */
export function vcSelfEnding(row, { sideb = false } = {}) {
  if (row.ac === -1) return false;
  const vars = { firststarsused: true };
  return armFor(row, vars, sideb).some((op) => op.spawn && PINNERS.has(op.spawn.type));
}

export function vcTurnLength(row, { sideb = false } = {}) {
  if (row.ac === -1) {
    // Even the charge-up takes a floor under the mod (normal: the <100
    // table's else arm; sideb: the leading 240). tickChargeup's timer-60
    // stomp still ends it early.
    return 240;
  }
  const vars = { firststarsused: true }; // dry-run: don't mutate real state
  const ops = armFor(row, vars, sideb);
  // THE PIN IS NOT THE ARM. A PINNER type writes `global.turntimer = 999999` in
  // its dbulletcontroller type block -- the controller's Step, one frame after
  // the dispatch -- and the dispatch frame carries only the arm's own floor (or
  // the 240 default). MEASURED: _tok3 Rising Abyss (ac 3, type 106) reads 239 on
  // the dispatch frame f2068 and 999999 from f2069; check-oracle-quickslash read
  // 9998 then 999999 for type 1001 the same way. Returning 999999 here armed the
  // pin a frame early (999998 at f2068). The managers pin at their creation --
  // the launch frame -- in spawnControllerByTypeInner (every PINNERS case).
  let floor = sideb ? 240 : normalTurntimerFloor(row);
  for (const op of ops) {
    if (op.turntimer) floor = Math.max(floor, op.turntimer);
  }
  return floor;
}

/**
 * Launch one V-C row — the driver's launch hook. Runs the arm's ops in the
 * GML's order. Returns the first spawned controller (the turn's owner).
 */
export function launchVCAttack(state, row, { sideb = false } = {}) {
  state.currentAc = row.ac;
  // The driver's clock-arming handshake — vanilla launchAttack clears it at
  // the end of its own floor block; the V-C floors run through the arm's
  // turntimer ops plus the driver's turnLength hook.
  // Did the driver arm this turn's clock on the dispatch frame? The director
  // floors `tl - 1` one frame before this launch (kaizo-practice.js, the
  // spawnDelay === 1 block), and vcTurnLength derives that tl from these
  // same arm ops -- so an op's floor re-applied HERE, after this frame's
  // decrement, lands a frame late and two units high. MEASURED, _tok3
  // Splitter 1 (ac 109, `scr_turntimer(350)` in Other_23 at the dispatch):
  // f1141 reads 349 on both sides; f1142 the recording 348, the sim 350 and
  // one turntimer point apart from there. The GML floors ONCE, at dispatch.
  const armedByDriver = state.turntimerArmed === true;
  state.turntimerArmed = false;
  const vars = (state.kaizo.vars ??= {});

  if (row.ac === -1) {
    state.knight.chargeupcon = 1;
    return null;
  }

  const ops = armFor(row, vars, sideb);
  let owner = null;
  // TWO PHASES, AS THE GAME ORDERS IT. Every scr_bulletspawner call in the arm
  // runs in the knight's ONE Step: reseed, obj_dbulletcontroller created, its
  // Create's basedir irandom(360) drawn -- for each controller in turn. The
  // controllers themselves step NEXT frame, and only then does each type
  // block create its manager -- so a manager's Create-time draws come off the
  // stream as the LAST controller's reseed left it. MEASURED, _tok3 Tunnel 1
  // (153 then 151): obj_sword_tunnel_manager's `timer = -40 + irandom(10)`
  // gave the recording a first pair at f1610 (40 frames) and the sim, which
  // created the manager right after ITS OWN reseed, one at f1613. The
  // managers are created in op order: same-frame creations step oldest-first
  // in this lane, which is the game's newest-first order reversed -- the
  // tunnel manager must step before the tracking one either way.
  for (const op of ops) {
    if (op.spawn) reanchorForController(state);
  }
  // THE DISPATCH FRAME ENDS ON THE FRESH ANCHOR. The knight dispatches on the
  // frame before this launch (the director launches one frame after the
  // flip), so whatever the game draws between the last reseed and the next
  // frame's controller Steps -- the recorder's end-of-frame draw probe, when
  // one is armed -- sits on the LAST controller's stream, ahead of every
  // manager Create. A harness hook, keyed to the recorder (kaizo-trace.mjs
  // --drawprobe), consumes them here; play installs nothing.
  state.kaizo?.hooks?.afterLaunchReseed?.(state);
  for (const op of ops) {
    if (op.spawn) {
      const mg = spawnControllerByType(state, op.spawn.type, {
        difficulty: op.spawn.d ?? 0,
        damage: op.spawn.damage,
        chainedType: op.spawn.chainedType,
        rowId: row.id,
        prearmed: true,
      });
      owner = owner ?? mg;
    } else if (op.invc !== undefined) {
      state.invc = op.invc;
    } else if (op.turntimer !== undefined) {
      // scr_turntimer is a FLOOR -- applied here only when no driver armed
      // the turn (the check scripts launch standalone); see armedByDriver.
      if (!armedByDriver && state.turntimer < op.turntimer) state.turntimer = op.turntimer;
    } else if (op.pre) {
      // The combination's segment order, set on the knight before the
      // spawner call — Other_23's `with (obj_knight_enemy) { first_attack =
      // ...; second_attack = ...; third_attack = ...; }`. A DOCUMENTED
      // NO-OP: the order is no longer approximated, and case 105 reads it
      // from kaizoComboOrderFor(state.currentAc), which is the same table
      // keyed by the same attack choice. The op stays in the arm tables
      // above because the LINES EXIST in the mod and a transcription that
      // dropped them would read as an omission — the same reason
      // `swordfallTurnTime` below is kept and inert.
      //
      // This used to ledger "segment order not parameterized yet" for any
      // order that was not 4-2-3, which is how atk_Frenzy3's 1-2-5 chain got
      // its row. launchKaizoCombination takes the order as an argument now.
    } else if (op.swordfallTurnTime !== undefined) {
      // ORIGINAL BUG — PRESERVED AND LABELLED. Deliberately INERT; the op stays
      // in the ac-102 arm tables above because the LINE EXISTS in the mod and a
      // transcription that dropped it would read as an omission.
      //
      // Other_23's ac-102 arm ends:
      //
      //     scr_turntimer(270);
      //     with (obj_knight_swordfall) { turn_time = 40; }
      //
      // and that `with` iterates an EMPTY SET. obj_knight_swordfall does not
      // exist yet on the launch frame: the arm only creates an
      // obj_dbulletcontroller (`dc.type = 108`), and the swordfall is made by
      // THAT controller's own Step, one frame later. Measured, not reasoned —
      // kaizo_oracle_seq_deep.csv, atk_Frenzy2B: the turn's first row is f6559
      // and obj_knight_swordfall's first row is f6560. No swordfall survives
      // the previous turn either (atk_PierceBlades creates none), so there is
      // nothing anywhere for the `with` to find. turn_time keeps its Create
      // value of 160.
      //
      // Applying it synchronously here LANDED it, and the recording shows the
      // consequence as a full inversion. At 160 the rain finishes early
      // (`local_turntimer < turn_time - ex`) and sets local_turntimer = 99999,
      // which switches OFF the swordfall Step's `< 120` freeze that pins every
      // obj_knight_weird_circle's alarms at 999 — so the orb ring outlives its
      // sword rain. At 40 the rain is still running when the freeze bites and
      // the ring dies first:
      //
      //     mod  last volley +237, last falling sword +182   (23 swords)
      //     sim  last volley +178, last falling sword +300   (43 swords)  <- 40
      //
      // The 40 IS reachable — obj_knight_swordfall's own Other_10 assigns it on
      // the "short start"/"short mid" arms, which is the COMBINATION's chaining
      // path (kaizo/attacks/swordfall.js). Only this dispatch-time `with` is
      // dead. Do not "fix" this by applying it one frame late: the mod does not
      // apply it at all.
    } else if (op.chargeup) {
      state.knight.chargeupcon = 1;
    }
  }

  // The B-Side's global mercy cap: `if (global.invc > 0.7) global.invc = 0.7`.
  if (sideb && state.invc > 0.7) state.invc = 0.7;

  return owner;
}

// ── arenas (arg0 == 0), normal + sideb geometry tables ─────────────────────

export function arenaGeom(row, sideb) {
  const ac = row.ac;
  const phase = row.phase;
  // Position first (same in both fns).
  let x = 320;
  let y = 170;
  if (ac === 0) { x = 300 - 152; y = 170; }
  else if (ac === 11) { x = 320; y = 190; }
  else if (ac === 13 && phase !== 2) { x = 300; y = 190; }
  const g = { x, y, xscale: 2, yscale: 2, keep: false, megakeep: false, dx: 0, dy: 0 };
  const set = (xs, ys) => { if (xs !== null) g.xscale = xs; if (ys !== null) g.yscale = ys; };
  if (!sideb) {
    if (ac === 0) { set(0.8, null); g.keep = true; g.megakeep = true; }
    if (ac === 1) set(2.25, 1.75);
    if (ac === 4) set(3.5, 3.5);
    if (ac === 10) set(3.5, 1.75);
    if (ac === 11) set(1.5, 1.5);
    if (ac === 12) set(2.5, null);
    if (ac === 13 && phase !== 2) set(3, null);
    if (ac === 14) set(1.75, 1.75);
    if (ac === 15) set(2.5, null);
    if (ac === 17) set(1, 1);
    if (ac === 20) set(2.25, 1.75);
    if (ac === 101) { set(3, 1.5); g.dy = -64; g.ystartKnight = true; }
    if (ac === 102) { set(3.25, 3); g.dy = 32; }
    if (ac === 103) set(3.5, 1.75);
    if (ac === 107) set(3.5, 3.5);
    if (ac === 110) { set(1.5, 2.5); g.dx = -110; g.xstartKnight = true; }
    if (ac === 111) set(3, null);
  } else {
    if (ac === 0) { set(0.6, null); g.keep = true; g.megakeep = true; }
    if (ac === 1) set(2.25, 1.5);
    if (ac === 4) set(3.5, 3.5);
    if (ac === 10) set(3.5, 1.75);
    if (ac === 11) set(1.5, 1.5);
    if (ac === 12) set(2.5, 1.4);
    if (ac === 13 && phase !== 2) set(3, null);
    if (ac === 14) set(1.5, 1.5);
    if (ac === 15) set(2.5, null);
    if (ac === 17) set(0.8, 0.8);
    if (ac === 20) set(2.25, 1.75);
    if (ac === 101) { set(3, 1.5); g.dy = -56; g.ystartKnight = true; g.keep = true; g.megakeep = true; }
    if (ac === 102) { set(3.25, 3); g.dy = 32; }
    if (ac === 103) set(3.5, 1.75);
    if (ac === 107) set(3.5, 3.5);
    if (ac === 110) { set(1.5, 2.5); g.dx = -110; g.xstartKnight = true; }
    if (ac === 111) set(3, null);
    if (ac === 112) set(2.5, 2.5);
  }
  return g;
}

/**
 * Place the arena for a V-C turn — the driver's openArena hook. Mirrors
 * fight.js's openArena re-arm (the growtangle persists in the sim, so its
 * per-turn `!init` must be re-armed) with the MOD's geometry.
 */
export function openVCArena(state, row, { sideb = false } = {}) {
  state.currentAc = row.ac;
  if (row.ac === -1) return; // the charge-up raises no board
  const g = arenaGeom(row, sideb);
  const gt = state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
  if (!gt) return;
  const { knight } = knightPos(state);
  gt.x = state.view.x + g.x + g.dx;
  gt.y = state.view.y + g.y + g.dy;
  gt.xstart = gt.x;
  gt.ystart = gt.y;
  // Other_23 rebases xstart/ystart to the KNIGHT'S OWN x/y for ac 101/110
  // (an unqualified `x` inside the knight's event) — transcribed faithfully.
  if (g.xstartKnight && knight) gt.xstart = knight.x;
  if (g.ystartKnight && knight) gt.ystart = knight.y;
  gt.maxxscale = g.xscale;
  gt.maxyscale = g.yscale;
  // keep/megakeep: obj_growtangle persistence flags the mod sets for the
  // slot arenas. The sim's battlebox does not read them yet (delta pending);
  // carried so the translation lands in one place.
  gt.keep = g.keep ? 1 : 0;
  gt.megakeep = g.megakeep ? 1 : 0;
  gt.init = false;
  // A FRESH INSTANCE EVERY TURN: the game creates its obj_growtangle anew each
  // arena open, with customBox false from Create; this lane keeps one and
  // re-arms it, and `customBox` stayed true from the last custom arena
  // (Starstorm's 2.25 x 1.75) through every 2 x 2 turn after it. MEASURED: the
  // Flurry split's Other_11 (`if (obj_growtangle.customBox) exit;`) restores
  // the arena at the turn's end in the recording (_tok3 f1472, x 320) and
  // bailed out here on the stale flag. The `!init` block below re-derives it.
  gt.customBox = false;
  gt.customBoxFromSplit = false;
  gt.mask = BATTLEBG_MASK;
  gt.growcon = 1;
  gt.timer = 0;
  gt.image_xscale = 0;
  gt.image_yscale = 0;
  gt.image_angle = 180;
  gt.visible = true;
}

/**
 * The soul's delivery destination — the driver's moveheartDest hook.
 * Other_23's three overrides; default is the vanilla (gt - 10, gt - 10).
 */
export function vcMoveheartDest(row, gt, view) {
  const gx = gt ? gt.x : view.x + 320;
  const gy = gt ? gt.y : view.y + 170;
  if (row.ac === 13 && row.phase !== 2) return { x: gx - 40, y: gy - 8 };
  if (row.ac === 15) return { x: gx - 40, y: gy - 8 };
  if (row.ac === 101) return { x: gx - 10, y: gy + 20 };
  return { x: gx - 10, y: gy - 10 };
}
