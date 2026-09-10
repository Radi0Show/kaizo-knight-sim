// KAIZO KNIGHT — scene scaffold. NOT WIRED INTO THE PLAYER-FACING PAGE.
//
// This module is the seam between the verified sim and the Kaizo project.
// The isolation contract (kaizo/HANDOFF.md §2) in one line: kaizo/ IMPORTS
// from sim/, and nothing under sim/, render/, web/ or tools/ imports from
// kaizo/. The 60-suite health check must stay green with this directory
// deleted — that is the definition of "separated enough".
//
// Everything here is a DELIBERATE DEVIATION from the real fight and ships
// labelled KAIZO wherever a player could see it (CLAUDE.md: nothing invented
// ships unlabelled). The attack MODULES this schedule points at are the
// verified ones; the SCHEDULE ITSELF is invented.

import { buildKaizoTurnLoop } from './kaizo-practice.js';
import { vcHooks } from './kaizo-vc-hooks.js';
import { kaizoVortexendFreeze } from '../attacks/sword-vortex.js';
import { installRoster, WEIRD_ROUTE_PARTY } from '../party/roster.js';
import { scrKaizoTarget, kaizoKnightTarget, kaizoDamageHooks } from '../party/damage.js';
import { kaizoAdvanceBalloon } from '../party/freeze.js';
import { createKaizoHeroes } from '../party/heroes.js';
import { installKaizoMenu } from '../party/spells.js';
import { VC_TABLE, VD_TABLE, VC_KNIGHT } from '../versions/vc-script.js';

export const KAIZO_NOTE =
  'KAIZO KNIGHT — a recreation of EnderCat8\'s "Kaizo Roaring Knight" mod '
  + '(v2.3.3): its schedule, attacks and party, diffed frame by frame against '
  + 'recordings of the mod. Not the real fight, not our design; every '
  + 'approximation is ledgered.';

/**
 * DRAFT schedule, version A ("KAIZO: AUTHENTIC") — see HANDOFF.md §5.
 *
 * Design rule for v-A: every row uses ONLY content that exists in the real
 * game's code — the highest difficulty variant of each live attack that a
 * suite already verifies, plus the seven translated UNUSED attacks (ac 0, 3,
 * 4, 6, 7, 10, 20 — unreachable in the vanilla selector, no oracle possible,
 * suites are positive-assertion only). The remix is the ORDER and DENSITY,
 * not the content.
 *
 * LIVE since K3: buildKaizoScene() runs this table through the kaizo turn
 * loop (kaizo-practice.js). Difficulty values here are the max each suite
 * verifies today — raise one only after adding the suite that pins it;
 * verify-kaizo enforces the cap.
 */
export const KAIZO_TABLE = {
  1: [
    { ac: 1, difficulty: 2, name: 'Stars', kaizo: 'max verified difficulty (homing starchildren)' },
    { ac: 10, difficulty: 0, name: 'Swordfall', kaizo: 'UNUSED content, no oracle' },
    { ac: 2, difficulty: 3, name: 'Flurry', kaizo: 'phase-3 variant moved up' },
    { ac: 13, difficulty: 4, name: 'Sword Tunnel', kaizo: 'max verified difficulty' },
    { ac: 5, difficulty: 2, name: 'Rotating Slash', kaizo: 'max verified difficulty' },
  ],
  2: [
    { ac: 0, difficulty: 0, name: 'Swordslash', kaizo: 'UNUSED content, no oracle' },
    { ac: 15, difficulty: 0, name: 'Sword Vortex' },
    { ac: 4, difficulty: 0, name: 'Knight Stream', kaizo: 'UNUSED content, no oracle' },
    { ac: 3, difficulty: 0, name: 'Sword Tunnel (revised)', kaizo: 'UNUSED content, no oracle' },
    { ac: 5, difficulty: 2, name: 'Rotating Slash' },
  ],
  3: [
    { ac: 6, difficulty: 0, name: 'Underbox', kaizo: 'UNUSED content, no oracle' },
    { ac: 20, difficulty: 0, name: 'Knightlines', kaizo: 'UNUSED content, no oracle' },
    { ac: 14, difficulty: 0, name: 'Tracking Swords' },
    { ac: 7, difficulty: 0, name: 'Combination', kaizo: 'UNUSED chain: swordfall -> rotating -> tunnel-revised' },
    { ac: 5, difficulty: 2, name: 'Rotating Slash' },
  ],
  4: [
    { ac: 5, difficulty: 2, name: 'Rotating Slash' },
    { ac: -1, difficulty: 1, name: 'Charge-up' },
    { ac: 9, difficulty: 0, name: 'ROARING' },
  ],
};

/** Version registry — the shape multiple Kaizo variants hang off (HANDOFF §5). */
export const KAIZO_VERSIONS = {
  // V-A — the ORIGINAL invented remix (vanilla attacks on an invented
  // schedule). It was the page's default until 2026-09-08, which is why
  // "most attacks that should appear don't appear at all": the mod's own
  // attacks live in V-C. Kept reachable at ?v=A; not the default, not the
  // recreation, and its note says so.
  A: {
    name: 'KAIZO: AUTHENTIC (the invented remix — NOT the mod)',
    table: KAIZO_TABLE,
    invented: 'schedule only',
    note: 'KAIZO: AUTHENTIC — the original invented remix: vanilla attacks on an '
      + 'invented schedule. Not the mod; the recreation is ?v=C.',
  },
  // B: { name: 'KAIZO: B-SIDE', ... }   — invented/revamped content, later.
  //
  // V-C — the ORACLE lane (HANDOFF §5-C): a recreation of EnderCat8's
  // "Kaizo Roaring Knight" v2.3.3, schedule and dispatch transcribed from
  // the mod's own decompiled attack table (kaizo/versions/vc-script.js,
  // generated from private research). PUBLISH-GATED: never commit/push
  // these without the author's permission — see the generated file's
  // header. Attacks at not-yet-translated difficulty branches run
  // APPROXIMATED and ledgered in state.kaizo.approx.
  C: {
    name: 'KAIZO ROARING KNIGHT v2.3.3 — the recreation (the page\'s default)',
    table: VC_TABLE,
    hooks: () => vcHooks({ sideb: false }),
    knight: VC_KNIGHT,
    invented: 'nothing — recreation of EnderCat8\'s mod (approx ledgered)',
  },
  // V-D — the WEIRD ROUTE (the mod's B-Side). Two differences from V-C that
  // are not the schedule: the party is KRIS + NOELLE, and every attack takes
  // its k_sideb branch. The mod does not toggle this — `k_sideb` reads
  // global.flag[456], the game's own Snowgrave save flag, so on a Weird
  // Route file the Kaizo fight simply IS this (kaizo/party/WEIRD-ROUTE.md).
  D: {
    name: 'KAIZO: ORACLE B-SIDE (Weirder Route — Kris & Noelle, WIP)',
    table: VD_TABLE,
    party: WEIRD_ROUTE_PARTY,
    hooks: (roster) => vcHooks({ sideb: true, roster }),
    knight: VC_KNIGHT,
    invented: 'nothing — recreation of EnderCat8\'s mod (approx ledgered)',
  },
};

/**
 * Build the Kaizo scene: the full verified turn loop (kaizo-practice.js — a
 * kaizo-owned copy of the practice machinery, table-parametrized) running the
 * chosen version's schedule. K3 (HANDOFF.md §7) landed: the schedule is live.
 *
 * `state.kaizo.launched` is the launch ledger — every attack the director
 * actually launches is appended, and verify-kaizo's fight-order analog
 * asserts the ledger equals the table. The HUD label alone proves selection;
 * the ledger proves launch.
 */
/**
 * THE RECORDING'S OWN LOADOUT — MEASURED, not chosen.
 *
 * `sim/damage.js`'s DEFAULT_GEAR is the VANILLA whole-fight build, where it is
 * verified byte-exact. It was inherited into the kaizo lane without ever being
 * measured, and it is WRONG for this save — the same class of unmeasured
 * inheritance as `global.flag[10]` (text automash).
 *
 * Read straight out of the mod by the recorder's party receipt
 * (`kaizo_oracle_party<TAG>.txt`, added to oracle_kaizo_fight.csx for exactly
 * this question):
 *
 *     slot,char,maxhp,hp,battledf,battleat,armor1,armor2,weapon
 *     0,1,160,160,5,18,1,10,16      Kris    MechaSaber  + AmberCard + GlowWrist
 *     1,2,190,190,5,22,1,10,17      Susie   AutoAxe     + AmberCard + GlowWrist
 *     2,3,140,140,5,15,1,10,18      Ralsei  FiberScarf  + AmberCard + GlowWrist
 *
 * Every derived number reconciles against the sim's own tables, which is what
 * makes this a measurement rather than a guess: battledf 5 = base 2 + AmberCard
 * 1 + GlowWrist 2 for all three, and battleat 18/22/15 = base at 14/18/12 plus
 * weapon at 4/4/3.
 *
 * **THERE IS NO SHADOWMANTLE.** The default build puts armour 23 on Kris; this
 * save has none, and that changes two mechanisms at once — `scr_kaizo_target`'s
 * `_mantlechar` is permanently −1 so the weighted branch always runs, and
 * nobody gets the mantle's x0.33.
 *
 * WHY IT DECIDES THE ROSTER. This recorder re-pins HP every frame, so a
 * character dies only if ONE frame's damage reaches maxhp, and the knight's
 * biggest bullet is 206 against `206 - 3*battledf`:
 *
 *     df 5 -> 191.   Susie  190 DIES (by 1).  Ralsei 140 DIES.  Kris 160 would
 *                    die too, but with HP pinned full `_krisrange` is 0 and
 *                    scr_kaizo_target essentially never picks him.
 *     df 7 -> 185.   Susie LIVES, and the sim fielded her all fight.
 *
 * That is the whole roster divergence: the recording fields Kris alone from
 * turn 3 (its bars carry one bolt) and the sim fielded two or three.
 */
export const KAIZO_TOK3_GEAR = [
  { weapon: 16, armor: [1, 10] },
  { weapon: 17, armor: [1, 10] },
  { weapon: 18, armor: [1, 10] },
];

export function buildKaizoScene(state, { version = 'A' } = {}) {
  const v = KAIZO_VERSIONS[version];
  // The ledgers must exist before the turn loop's first launch. Launches only
  // happen inside stepFrame, after build returns — but setting the marker
  // first keeps the ordering obvious rather than merely true.
  // The recreation lanes play the RECORDING's save, not the vanilla build.
  // Set before anything can read gear, and only when the caller has not already
  // supplied a loadout of its own.
  // SCOPED TO THE THREE-PERSON A-SIDE ONLY. `v.party` marks a version that
  // brings its OWN roster — V-D is the Weird Route (Kris + Noelle, global.char
  // = [1, 4, 0]) and `installRoster` supplies its gear from kaizo/party/. The
  // receipt above was read off an A-SIDE recording, so applying it there put a
  // three-person build on a two-person party and took check-weirdroute red on
  // all four B-Side launch assertions.
  // ONLY THE RECREATION LANES. `v.knight` marks the versions that recreate
  // the recording (V-C, and V-D which then supplies its own roster via
  // `v.party`). V-A is the playable AUTHENTIC mode with an invented schedule;
  // it keeps the vanilla build so an oracle measurement does not change the
  // feel of the mode people actually play. Scoping on `!v.party` alone
  // silently re-geared V-A too.
  if (v.knight && !v.party && !state.loadout?.gear) {
    state.loadout = { ...(state.loadout ?? {}), gear: KAIZO_TOK3_GEAR };
  }
  // TEXT AUTO-ADVANCE (global.flag[10]) IS OFF IN THE RECORDING'S SAVE — the
  // same class of save-dependent input as the gear above, inferred from the
  // enemy-talk frame budget (nine holds of 10-74 frames, each ended by a
  // button3 press; automash-on collapsed them to 7-14). The vanilla reference
  // save has it ON and sim/scenes/practice.js keeps that default; the
  // recreation lanes set it explicitly here, and the practice loop reads it
  // with vanilla's own `!== false` semantics.
  // THE AUTO-ADVANCE IS ON IN THE REFERENCE SAVE, and this lane used to force
  // it off. MEASURED (the recorder's writer sidecar, _writer recording,
  // balloonturn 6): automash_timer toggles on the token's b3 frames and
  // prevent_mash_buffer reads 2 there, which only happens under
  // global.flag[10] == 1. With it off the sim closed every balloon on the
  // first confirm after the halt and ran each talk phase two frames short.
  if (v.knight && state.textAutoMash === undefined) state.textAutoMash = true;

  // THE KNIGHT NEVER STROBES FROM A PARTY HIT IN THIS MOD.
  //
  // scr_damage_enemy's one interesting line is the strobe arm, and EnderCat8
  // moved its literal:
  //
  //     v105    if (chapter == 3 && i_ex(obj_knight_enemy) && arg1 >= 100)
  //     kaizo   if (chapter == 3 && i_ex(obj_knight_enemy) && arg1 >= 10000)
  //
  // (the ONLY line that differs between the two copies of the script). No
  // party hit in this fight comes near 10000 — X-Slash, the biggest, is
  // ceil(ceil(((52 * 160) / 20) - df * 3) * 1.05) * 2, under 900 — so
  // `stronghurtanim` is only ever set by the ENDING (sim/knight.js
  // startEndCutscene, Draw_0:143-148), which is the one place the mod still
  // wants the flicker.
  //
  // It gates two things, both of them the Knight's reaction animation: the
  // strobe branch (kaizo/render/draw/tracking.js — under the mod both arms
  // draw idlesprite anyway, so this only decides the ENDING's %3 flicker)
  // and the delayed thud one frame in, `hurttimer == 29 && stronghurtanim`,
  // which the sim was playing on every heavy swing.
  //
  // Both versions: the script is shared, and V-C is the mod too.
  if (v.knight) state.stronghurtDamage = 10000;

  state.kaizo = {
    version,
    // Per version: the remix says it is the remix; the recreations carry
    // the page's note.
    note: v.note ?? KAIZO_NOTE,
    table: v.table,
    scheduleActive: true,
    launched: [],
    approx: [],
    // `kaizo_block = 1` in the mod knight's Create — every non-crit party
    // hit is blocked to ceil(/5) until the 40% guard drop. Meaningless for
    // versions without the mod hooks.
    vars: v.knight ? { kaizo_block: true } : {},
    // The B-Side flag kaizo modules read as state.kaizo.sideb.
    sideb: version === 'D',
    // CROSS-MODULE SEAMS. The mod couples two attacks that live in separate
    // translated modules: the B-Side's ac-111 rotating slash ends its turn
    // by FREEZING the sword vortex's blades into bullets
    // (obj_knight_rotating_slash CleanUp_0:16-43 -> kaizo_vortexend_step).
    // The rotating module calls this hook; without it, it falls back to the
    // vanilla `turntimer = -1` and ledgers the deviation.
    hooks: v.knight ? { vortexendHandoff: kaizoVortexendFreeze } : {},
  };
  // THE ROSTER IS INSTALLED BEFORE THE SCENE IS BUILT. installRoster rewrites
  // state.partyHp, the char arrays and the B-Side freeze/gloom mirrors to the
  // roster's LENGTH, and the turn loop spawns one party actor per member — so
  // doing it afterwards would build a three-person scene and then contradict
  // it. It also re-stamps state.kaizo, hence the marker being merged back in
  // rather than assigned before.
  let roster = null;
  if (v.party) {
    const marker = state.kaizo;
    installRoster(state, { charIds: v.party, sideb: version === 'D' });
    roster = state.kaizo.roster;
    state.kaizo = { ...marker, ...state.kaizo };
    // LANE W2 (menu / spells / ACTs / X-Slash): fill the engine's
    // character-table seam (sim/spells.js) from the roster and spawn the
    // spell controller. Roster-gated by construction -- this block is
    // `if (v.party)`. kaizo/party/spells.js has the provenance.
    installKaizoMenu(state);

    // THE GAME KEEPS THREE SLOTS AND LEAVES THE SPARE EMPTY.
    //
    // `global.char` is a THREE-entry array however many characters are in the
    // party — the Weird Route's is `[1, 4, 0]`, Kris, Noelle, nobody — and the
    // absent slot is simply never targetable. installRoster sizes its arrays
    // to the roster (2), which is right for anything reading the roster, and
    // wrong for the many vanilla-shaped consumers that walk slots 0..2:
    // sim/damage.js's isUp reads `!chardead[slot]`, so an ABSENT slot came
    // back `!undefined` = standing, took targeting rolls, and had damage
    // written to it — `partyHp` grew a third entry mid-fight.
    //
    // Padding to three with the spare marked dead and untargetable is not a
    // workaround for that; it is what the original data looks like. Every
    // vanilla-shaped consumer then does the right thing with no change, which
    // is the whole reason the mod could add Noelle without rewriting them.
    // THE HUD READS THESE. render/menu.js's charbox row defaults to the
    // vanilla trio's portraits, name plates and max HP; without these it
    // drew Noelle's 120 HP under SUSIE's face and name. They are plain
    // state fields precisely so render/ can honour a different party
    // without importing anything from kaizo/.
    // scr_charbox draws `spr_head<name>` and `spr_bname<name>` per character
    // id, not per slot — which is exactly the distinction that put Noelle's
    // HP under Susie's portrait. Keyed by charId so the panel follows the
    // character wherever scr_fixparty packs them.
    const CHARBOX_ART = {
      1: { head: 'spr_headkris', name: 'spr_bnamekris' },
      2: { head: 'spr_headsusie', name: 'spr_bnamesusie' },
      3: { head: 'spr_headralsei', name: 'spr_bnameralsei' },
      4: { head: 'spr_headnoelle', name: 'spr_bnamenoelle' },
    };
    state.partySprites = roster.map((m) => CHARBOX_ART[m.charId] ?? CHARBOX_ART[1]);
    state.partyMaxhp = roster.map((m) => m.maxhp);

    for (let slot = roster.length; slot < 3; slot++) {
      state.partyHp[slot] = 0;
      state.chardead[slot] = 1;
      state.charcantarget[slot] = 0;
      state.charmove[slot] = 0;
      state.charaction[slot] = 0;
      state.charspecial[slot] = 0;
    }
    // `createState()` built three heroes before any scene existed
    // (sim/state.js). A two-person party needs its own, or obj_heroparent
    // steps a member who is not in the fight.
    state.heroes = createKaizoHeroes(state);

    // ── THE PARTY LAYER GOES LIVE HERE, and only here ─────────────────────
    //
    // sim/damage.js's four entry points (scrDamage, scrDamageSingle,
    // scrDamageAll, scrDamageMaxhp) each defer whole to a hook of the same
    // name on `state.kaizo.hooks`, and sim/dialogue.js's advanceBalloon to
    // `hooks.advanceBalloon`. Installing them is what puts kaizo/party/
    // damage.js on the path every bullet actually travels
    // (sim/bullets/regularbullet.js:145-147, the slashes, the splitslash,
    // knight-stream.js:418, knightlines.js:951, the two local
    // scr_damage_all_maxhp loops, roaring-final-star.js's direct scrDamage):
    // Noelle's x0.5 (scr_damage.gml:157-160), the B-Side gloom precompute and
    // accrual (:5-17, :245-265), the -999 fell for everyone (:225-231),
    // scr_kaizo_target through global.char, scr_damage_maxhp's own ratios —
    // and takes the Susie exchange off the B-Side (Step_0:206-211).
    //
    // ROSTER-GATED BY CONSTRUCTION: this block only runs for a version that
    // brings its own party. V-C keeps the engine's scr_damage under the
    // knightTarget hook below, which is what the _tok3 byte gate is pinned
    // to; the mod's A-Side deltas that ride in the same script (the -999
    // fell for Kris, the deleted Flurry softening) are therefore NOT live on
    // V-C from here — they need the roster layer, and under the gate's HP
    // pin they are invisible either way. `??=` for the reason the
    // knightTarget install records: a check's recording wrapper must win.
    state.kaizo.hooks ??= {};
    const dmgHooks = kaizoDamageHooks();
    for (const name of Object.keys(dmgHooks)) state.kaizo.hooks[name] ??= dmgHooks[name];
    state.kaizo.hooks.advanceBalloon ??= kaizoAdvanceBalloon;
  }

  // ── TARGETING. The mod DELETES vanilla's block; sim/damage.js keeps it ───
  //
  // `gml_GlobalScript_scr_damage.gml:88-91` (kaizo) is one call to
  // `scr_kaizo_target()` where v105 has ~75 inline lines — verified by
  // diffing kaizo-mod/gml_vanilla_v105 against kaizo-mod/gml_kaizo_dump, the
  // matching-version pair, so this is a kaizo delta and not a build
  // difference. `scr_damage_maxhp.gml:59-165` carries the SAME body inlined,
  // and `sim/damage.js`'s `knightTarget` is the one place both of the sim's
  // entry points (`scrDamageSingle`, `scrDamageMaxhp`) go through — so one
  // hook covers both, and every live bullet with it
  // (`sim/bullets/regularbullet.js:122`).
  //
  // `??=`, NOT `=`, for the reason the combination seam records at
  // kaizo/scenes/kaizo-mod-launcher.js:262: a check that installs a RECORDING
  // WRAPPER to prove the seam fired gets silently eaten by an unconditional
  // assignment, and the check then goes red reporting that nothing happened.
  // Anything installed ahead of this still resolves to scr_kaizo_target if it
  // delegates, so deferring here concedes the instrumentation and not the
  // routing.
  //
  // Gated on `v.knight` — the mod-recreation marker, the same gate the
  // vortexend seam above uses. V-A is an INVENTED schedule over vanilla
  // attack bodies and keeps vanilla targeting.
  //
  // WHAT THE WEARER SCAN READS, and it is currently right by absence rather
  // than by statement. `scr_kaizo_target` looks for armour 23 through
  // `gearOfChar` (kaizo/party/roster.js), which on a version with no roster
  // installed — V-C — reports every character unequipped, so `_mantlechar`
  // stays -1 and every hit takes the `random_range(0, 2)` branch. That
  // MATCHES the recording: `obj_initializer2` Create:102 calls
  // `scr_gamestart()` unconditionally at boot, the recorder loads no save (it
  // counts 120 boot frames and then `room_goto(room_bullettest_new)` —
  // tools/patches/oracle_kaizo_fight.csx), and scr_gamestart's chapter-3
  // block equips `chararmor1[1..3] = 1, chararmor2[1..3] = 10`. NO ARMOUR 23
  // IS IN THE RECORDED FIGHT. `sim/damage.js`'s DEFAULT_GEAR puts 23 on Kris
  // and the kaizo trace harness sets no `state.noMantle`, so give V-C a
  // roster built from DEFAULT_GEAR and the mantle branch switches on and the
  // draw count changes under you. check-roster asserts the absence directly.
  state.kaizo.hooks ??= {};
  // scr_damage's pre-targeting rules ride in front of scr_kaizo_target on the
  // hook path (kaizo/party/damage.js kaizoKnightTarget): the `target == 4`
  // roll every controller-inherited bullet makes on every hit.
  // The runner steps NEWEST INSTANCE FIRST (sim/entity.js phaseList has the
  // receipts, the kaizo one being _tok3 f1212: a newer slash writes the cut
  // box's con/timer and the older box steps in the same frame). NOT SWITCHED
  // ON HERE: `state.stepNewestFirst = true` moved the byte gate from f1215
  // back to f449 and reddened check-oracle-crescent -- this lane carries its
  // own oldest-first fits, and each one has to be found and undone with the
  // GML in hand before the flag can go on. Until then the one measured
  // handoff is emulated at its site (flurry-splitslash.js).
  if (v.knight) state.kaizo.hooks.knightTarget ??= kaizoKnightTarget;

  buildKaizoTurnLoop(state, {
    seed: state.seed,
    table: v.table,
    hooks: v.hooks ? v.hooks(roster) : {},
  });
  // The mod's stat block (scr_monstersetup): HP 10000. The knight entity was
  // just created by the build with the vanilla 7300.
  if (v.knight && state.knight) state.knight.hp = v.knight.maxhp;
  return state;
}
