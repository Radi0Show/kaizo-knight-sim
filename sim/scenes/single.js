// PRACTICE MODE — one attack, on repeat, at a difficulty you pick.
//
// The fight scene walks the selector's table; this runs a single entry from it
// forever, which is what practising a pattern actually needs. It reuses
// `launchAttack` and `clearTurn` from fight.js rather than re-deriving the
// per-attack setup, so an arena position or turn length fixed in one place is
// fixed for both.
//
// The menu is built from ATTACK_MENU below rather than from FIGHT_TABLE,
// because the table lists each attack once per turn it appears in and a
// practice list wants each attack once, with its real difficulties offered as
// options.

import { spawn, destroy } from '../entity.js';
import { applyDials } from '../dials.js';
import { battlebox, settleBox } from '../battlebox.js';
import { gmlCreate } from '../rng.js';
import { knightActor, partyActor, PARTY, KNIGHT, BOX } from '../actors.js';
import { launchAttack, openArena, clearTurn, deliverHeart, FIGHT_TABLE } from './fight.js';
import { createMenu } from '../menu.js';
import { freshParty, scrRevive, partyWiped } from '../damage.js';
import { cueLoop } from '../audio.js';
import { COMBO_ATTACKS } from '../attacks/combination.js';
import { SPRITE_MASKS } from '../masks.js';

/** The objects a combination turn can hand itself to. */
const COMBO_SEGMENT_NAMES = new Set(Object.values(COMBO_ATTACKS).map((a) => a.name));

/**
 * Every attack the fight can select, with the difficulties it actually appears
 * at — plus the DEBUG CONTENT at the bottom: attacks the selector can never
 * choose (`nextTurn`'s fall-through analysis), reachable in the real game only
 * through `if (scr_debug() && overrideAttack > 0)`. They are launched with the
 * dispatch table's exact parameters and labelled UNUSED where the player sees
 * them, per the project rule.
 *
 * The difficulties are the selector's raw values; the UI shows them 1-based
 * (see difficultyBlurb) so the player picks "DIFFICULTY 1/2/3", not 0/3/4.
 *
 * Rotating Slash previously offered a difficulty 3 here — no selector row and
 * no branch in obj_knight_rotating_slash's Other_10 uses one (it branches on
 * 1 and 2 only), so it was invented content and is gone.
 */
export const ATTACK_MENU = [
  { id: 'stars', ac: 1, name: 'Stars', difficulties: [0, 1, 2], where: 'phase 1/2/3 opener' },
  { id: 'tracking11', ac: 11, name: 'Tracking Swords', difficulties: [0], where: 'phase 1 turn 2' },
  { id: 'flurry', ac: 2, name: 'Flurry (box splitter)', difficulties: [0, 1, 3], where: 'phase 1/2/3' },
  { id: 'tunnel', ac: 13, name: 'Sword Tunnel', difficulties: [0, 3, 4], where: 'phase 1/2/3' },
  { id: 'rotating', ac: 5, name: 'Rotating Slash', difficulties: [0, 1, 2], where: 'closes every phase' },
  { id: 'vortex', ac: 15, name: 'Sword Vortex + Tracking', difficulties: [0], where: 'phase 2 turn 4' },
  { id: 'tracking14', ac: 14, name: 'Tracking Swords (late)', difficulties: [0], where: 'phase 3 turn 3' },
  { id: 'roaring', ac: 9, name: 'ROARING', difficulties: [0], where: 'phase 4 finale' },
  { id: 'stream', ac: 4, name: 'X Attacks (stream)', difficulties: [0], where: 'UNUSED', unused: true },
  { id: 'swordfall', ac: 10, name: 'Swords Falling', difficulties: [0, 1], where: 'UNUSED', unused: true },
  { id: 'underbox', ac: 6, name: 'Orbs Under the Box', difficulties: [0], where: 'UNUSED', unused: true },
  { id: 'knightlines', ac: 20, name: 'Knightlines (spears)', difficulties: [0], where: 'UNUSED', unused: true },
  { id: 'swordslash', ac: 0, name: 'Swordslash (crescents)', difficulties: [0, 1], where: 'UNUSED', unused: true },
  // The last unused attack, and the only roster entry that is PARTIAL: the
  // combination chains three attacks and its third is obj_knight_tunnel_
  // slasher_2_revised, ac 3's own untranslated attack. Labelled where the
  // player sees it, per the project rule.
  { id: 'tunnel2', ac: 3, name: 'Sword Tunnel (revised)', difficulties: [0], where: 'UNUSED', unused: true },
  { id: 'combination', ac: 7, name: 'Combination', difficulties: [0], where: 'UNUSED', unused: true },
  { id: 'diagonal', ac: 12, name: 'Diagonal Bullets', difficulties: [0], where: 'UNUSED', unused: true },
  { id: 'rotating16', ac: 16, name: 'Rotating + Tracking', difficulties: [0], where: 'UNUSED', unused: true },
  { id: 'tracking17', ac: 17, name: 'Tracking Swords (multi)', difficulties: [0], where: 'UNUSED', unused: true },
];

export function menuEntry(id) {
  return ATTACK_MENU.find((a) => a.id === id) ?? ATTACK_MENU[0];
}

/**
 * Where an (ac, difficulty) pair actually appears, read off the selector's
 * own table — so the difficulty picker can say "phase 2" without a second
 * hand-maintained list going stale.
 */
export function difficultyBlurb(ac, diff) {
  const phases = [];
  for (const p of [1, 2, 3, 4]) {
    for (const row of FIGHT_TABLE[p]) {
      if (row.ac === ac && row.difficulty === diff && !phases.includes(p)) phases.push(p);
    }
  }
  if (!phases.length) return 'UNUSED';
  return `phase ${phases.join(' & ')}`;
}

/**
 * THE WAIT BETWEEN RUNS, AND WHERE IT WENT. Measured before it was touched,
 * because "feels long" is not a number.
 *
 * A drill run is `launch -> the attack's own turn clock -> drain -> reset ->
 * gap -> launch`. There is NO menu, NO writer, NO FIGHT bar and NO scene
 * rebuild in this loop — those belong to the fight director (practice.js) and
 * this mode never builds them, so none of the wait was ever there. The whole
 * wait is the last two terms, and one cycle of every attack in ATTACK_MENU was
 * timed frame by frame:
 *
 *   gap    45 frames, every attack, every run, flat — all 18 of them.
 *   drain  the FULL 90 for ELEVEN attacks; 0 for five; and two in between
 *          (Stars 25, Swordslash 11), which are the only two where the number
 *          was ever the bullets' doing.
 *
 * `GAP` WAS 45 AND 33 OF THOSE FRAMES WERE NOTHING AT ALL. The board is torn
 * down at the reset and rebuilt on the next frame as a settled placeholder; the
 * arena does not open until `gap == RTIMER_SPAWN`, and the soul is not
 * delivered until eight frames after that. So frames 45 down to 13 are a still
 * box, no soul, no bullets, nothing to read and nothing to do — 1.1 seconds of
 * it, forty times over in a drill session.
 *
 * The last 12 are NOT dead: they are the fight's own `rtimer == 12` beat, and
 * they are load-bearing twice over (Swordslash reads `box.sprite_height` once
 * at con 0, and the soul flies in at gap 4 through a ring that has to enclose
 * the drop point). They stay exactly as they were. 16 keeps them, plus three
 * frames for the placeholder box the next frame's `step` spawns to exist
 * before `openArena` looks for it.
 *
 * THE WHOLE-FIGHT PATH IS UNTOUCHED BY THIS. `practice.js` has its own
 * director with its own constants; this file is reached only by
 * `buildSingleAttackScene`, which is the single-attack mode and nothing else.
 */
const GAP = 16;
const DRAIN = 90;
/** `rtimer == 12` — the beat between the board opening and the attack. */
const RTIMER_SPAWN = 12;

const director = {
  name: 'practice_director',

  create(e, state) {
    e.started = false;
    e.gap = GAP;
    e.drain = 0;
    e.elapsed = 0;
    e.owner = null;
    e.runs = 0;
    e.musicStarted = false;
    // THE SELECTOR PICKS THE ATTACK AT THE TOP OF THE TURN, so anything gated
    // on `myattackchoice` is live from then — not from the board opening and
    // certainly not from the attack object spawning. Swordslash's soul clamp
    // is the one that notices: set any later and there is a frame where the
    // choice is current and the clamp has not run, because the Knight's End
    // Step comes before the director's.
    state.currentAc = state.practiceEntry.ac;
  },

  step(e, state) {
    // THE REBUILD RUNS IN STEP, NOT ENDSTEP — historically for the soul's
    // sake (a soul spawned in this director's endStep went unclamped by the
    // knight's ac-0 wall clamp, which runs in HIS endStep, before ours, for
    // one frame; verify-swordslash held the line). ONLY THE BOARD is rebuilt
    // here now: the soul is delivered by obj_moveheart at arena-open (below),
    // and an alarm-created instance steps on its birth frame with the
    // knight's endStep still ahead of it (sim/entity.js, runPhase's note),
    // so the clamp ordering holds without anything being spawned here.
    //
    // The board is a placeholder: openArena needs a live obj_growtangle to
    // place and grow, and this is where the fight's growtangle would be
    // sitting hidden between turns.
    if (e.rebuild) {
      e.rebuild = false;
      settleBox(spawn(state, battlebox, { x: BOX.x, y: BOX.y }));
    }
  },
  endStep(e, state) {
    // THE DRILL CAN DIE. Same gate as the fight director's (practice.js):
    // `partyWiped` latches gameOver and everything below stops, so a wipe is
    // never undone by the between-run refill further down. Reported from
    // play: "you cannot die in single attack". The driver takes it from
    // here (the Knight's own game over, then GO BACK rebuilds the drill).
    //
    // NOTE the early return also freezes the turn clock, so a headless drill
    // that must outlive a wipe sets `state.keepAlive` (sim/index.js refills,
    // revives and clears gameOver every frame on that path) — as
    // tools/verify-graze.mjs does; its scripted dodge wipes a full-HP party
    // mid-run on several attacks.
    if (!state.gameOver && partyWiped(state)) state.gameOver = true;
    if (state.gameOver) return;
    // obj_battlecontroller's Create loops `global.batmusic` for every
    // battle; the drill is one too. Cued on the first STEPPED frame, not at
    // build, exactly as the fight director does it — a state built under
    // the title screen is never stepped, so it never sounds, and the
    // driver's reset() stops the loop before rebuilding. Reported from play:
    // "no music in single attack".
    if (!e.musicStarted) {
      e.musicStarted = true;
      cueLoop(state, 'mus_knight');
    }
    if (e.started && state.turntimer > 0) state.turntimer -= 1;

    const entry = state.practiceEntry;
    state.phase = `${entry.name} · difficulty ${entry.difficulty} · run ${e.runs}`;

    if (e.started) {
      e.elapsed += 1;
      // THE COMBINATION HANDS THE TURN ON, so "the owner died" is not "the
      // turn is over" for ac 7. Each segment destroys itself as it creates the
      // next, and the drill's owner is only the FIRST — without this the turn
      // was declared finished the moment swordfall handed off to the rotating
      // slash, and the second segment was swept a few frames later.
      //
      // Adopting the live successor is the same shape the real turn has: the
      // clock stays pinned at 999999 until the LAST segment's CleanUp sets it
      // to -1, so the chain, not the first object, is what owns the turn.
      if (e.owner && !e.owner.alive) {
        const next = state.entities.find(
          (x) => x.alive && COMBO_SEGMENT_NAMES.has(x.type.name),
        );
        if (next) e.owner = next;
      }
      const ownerAlive = e.owner && e.owner.alive;
      // A SPAWN MANAGER IS NOT A BULLET, AND IT WAS HOLDING THE DRAIN OPEN
      // FOR THE FULL 90 FRAMES.
      //
      // `scr_bullet_init` stamps `isBullet` on everything it touches, managers
      // included, so this test used to count them — and they never leave,
      // because they were never going anywhere. Measured across one cycle of
      // every entry in ATTACK_MENU: for ac 11, 13, 14 and 17 the ONLY thing
      // alive through the ENTIRE drain is one parked
      // `obj_tracking_swords_manager` / `obj_sword_tunnel_manager` sitting at
      // y 0, above the arena, with no bullet on screen anywhere; their drains
      // now end on the clock. ac 16 is the partial case — 24 frames of real
      // bullets, then 65 of manager alone — and it keeps exactly the 24.
      //
      // The bullet count does not rise again in those windows either, so
      // nothing is still being spawned; tools/verify-single-tempo.mjs proves
      // that separately by pinning the drain open to its old full length and
      // watching for a bullet that never comes. The drill sat there for three
      // seconds after every run of two of the five attacks the real fight
      // actually uses (ac 11 and 13).
      //
      // THE TEST IS PER-FRAME AND EXACT, NOT A NAME LIST, and it asks the two
      // questions the player actually cares about: can I see it, and can it
      // hit me. A thing that fails both is not something anyone is waiting to
      // clear.
      //
      // CAN I SEE IT — a bullet with neither its own `mask` nor a sprite in
      // SPRITE_MASKS resolves to null in `grazes` (sim/index.js:316 does this
      // exact lookup and bails), in `spriteMaskHit`, and in the renderer's
      // mask fallback, so it draws no shape and cannot graze.
      //
      // CAN IT HIT ME — and this half is NOT implied by the first, which is
      // the trap. The collision phase's default path is `spriteMaskHit`, which
      // a maskless bullet fails; but a type may OVERRIDE the test, and one in
      // this fight does while maskless. `obj_roaringknight_splitslash` (ac 2,
      // Flurry) carries `scr_precise_hit` and an Other_15 and runs for 480
      // frames of a two-run cycle with no mask resolved — measured, not
      // reasoned. Dropping it on the mask test alone would have let the drill
      // sweep a bullet that was still live and still damaging. Flurry happens
      // to keep its full drain today because its teeth are masked, so this
      // would have been an invisible hole with a green suite over it.
      //
      // So the exclusion requires BOTH: no mask AND no custom collision path.
      // `maskOff` is `mask_index = spr_nomask`, which the collision loop skips
      // outright, so it cannot hit either way.
      //
      // Live, not fixed per object: splitslash later acquires
      // `spr_rk_quickslash`, and either half being true holds the drain open
      // for exactly as long as it is real.
      //
      // What this deliberately does NOT do is shorten the drain for the attacks
      // whose bullets ARE still in the arena. ac 15, 12, 4 and 20 have real
      // bullets overlapping the board at drain frame 88; they keep all 90.
      const bulletsLeft = state.entities.some(
        (x) => x.alive && x.isBullet && x.type.name !== 'obj_heart'
          && (
            (x.mask ?? SPRITE_MASKS[x.sprite_index] ?? null) !== null
            || (!!x.type.collides && !!x.type.other15 && !x.maskOff)
          ),
      );
      // Same rule as the fight: the clock decides, with a short drain so
      // bullets can leave on their own before the sweep.
      const timeUp = state.turntimer <= 0 || !ownerAlive;
      if (timeUp) e.drain += 1;
      if (!(timeUp && (!bulletsLeft || e.drain >= DRAIN))) return;

      e.started = false;
      e.gap = GAP;
      e.runs += 1;
      // A DRILL REFILLS. Practice mode repeats one attack forever, so the
      // party is restored between runs — otherwise the third or fourth
      // repetition is unplayable for reasons that have nothing to do with the
      // pattern being practised. The full fight does NOT do this.
      state.partyHp = freshParty();
      // AND STAND THEM BACK UP. Refilling HP does not undo scr_dead -- being
      // down is `chardead`, and the pose reads the HP sign while the MENU
      // reads chardead, so a bare refill left anyone who had fallen during
      // the previous run standing at full health and unable to act: no menu,
      // no FIGHT bolt, not targetable. Reported from play as "Kris sometimes
      // cannot act, and he is not drawn correctly".
      //
      // This is CLAUDE.md's "Restoring HP does not stand anyone up" landing
      // for the second time -- the whole-fight keep-alive path in
      // sim/index.js already pairs its refill with scr_revive, and this drill
      // was the copy that did not.
      for (let i = 0; i < 3; i++) scrRevive(state, i);
      state.invTimer = -1;
      clearTurn(state);
      // AND GIVE THE HEART BACK. The real fight spawns obj_heart per TURN —
      // obj_battlecontroller's Alarm 11 destroys the soul and the board
      // together at the end of each one, and the next turn makes new ones.
      // This drill built its soul ONCE, at scene setup, so any attack that
      // destroys it left every later run with no heart at all.
      //
      // ROARING is exactly that attack: it pulls the soul into the vortex and
      // destroys it partway through, which is why the drill for it went
      // heartless after the first pass while every other attack looked fine.
      //
      // AND THE BOARD GOES WITH IT — Alarm 11 is `with (obj_heart)
      // instance_destroy(); with (obj_growtangle) instance_destroy();`, both
      // together, every turn. The drill used to keep ONE board and ONE soul
      // for its whole life, and Stars is where that showed: the cone drags
      // the board ~90px left during a run, the reused board never goes back
      // (launchAttack's placement is gated on `arenaOpened !== ac`, which a
      // reused board always fails), and a soul left where the previous run
      // ended can sit OUTSIDE the next run's grow-in — the wall sweeps out
      // through it, reject-on-entry keeps it out, and the player dodges from
      // the free half of the screen. Reported from play: "you can glitch
      // outside the box and dodge way easier".
      //
      // Destroying and respawning BOTH each run is the fight's own turn
      // cycle, not a patch.
      // Torn down THIS frame; the board is rebuilt on the NEXT (step, above)
      // and the soul NOT UNTIL ARENA-OPEN, by obj_moveheart, as the Knight
      // delivers it. The drill used to respawn the soul with the board, 33
      // frames early, inside a settled placeholder box — and a soul steered
      // to that box's wall was outside the ring when openArena collapsed it
      // to scale 0 at the attack's own arena. Reject-on-entry collision never
      // pulls a soul back IN, so it walked out of the growing box and dodged
      // from the free half of the screen. Reported by email: "when the soul
      // recenters move to a corner; when the box animation plays you get out
      // of bounds" — and measured wider than a corner: any held direction
      // did it, single-axis included.
      if (state.soul?.alive) destroy(state.soul);
      state.soul = null;
      const oldGt = state.entities.find(
        (x) => x.alive && x.type.name === 'obj_growtangle',
      );
      if (oldGt) destroy(oldGt);
      e.rebuild = true;
      // …and the drill's next turn has already chosen it, being the same one.
      state.currentAc = state.practiceEntry.ac;
      return;
    }

    e.gap -= 1;
    // THE BOARD OPENS BEFORE THE ATTACK, by the same 12 frames the fight uses.
    //
    // `obj_knight_enemy` creates the growtangle in his `mnfight == 1.5` block
    // and spawns the attack 12 frames later on `rtimer == 12` — so the arena
    // is already most of the way through its 15-frame grow-in when the bullets
    // start. This drill used to do both on one frame, which is fine for an
    // attack that only reads the box's POSITION and wrong for one that reads
    // its SIZE: Swordslash computes its six lanes from `box.sprite_height`
    // once, at con 0, and with the board still at 40% scale they came out 22
    // pixels apart instead of 150.
    //
    // The fight scene has always done it in this order (see openArena's note);
    // this makes the drill agree with it.
    if (e.gap === RTIMER_SPAWN) {
      openArena(state, state.practiceEntry);
      // launchAttack re-opens the arena unless it is told this one is already
      // open — the same handshake practice.js uses. Without it the grow-in
      // restarts on the launch frame and the twelve frames are given back.
      const gt = state.entities.find((x) => x.alive && x.type.name === 'obj_growtangle');
      if (gt) gt.arenaOpened = state.practiceEntry.ac;
      // THE SOUL FLIES IN; IT DOES NOT APPEAR — the fight's own delivery,
      // from the same arena-open block the Knight uses (`scr_moveheart` in
      // obj_baseenemy's mnfight-1.5 setup): obj_moveheart leaves Kris now
      // and its alarm creates obj_heart at (gt.x - 10, gt.y - 10) eight
      // frames later, at grow timer 8, when the ring already encloses the
      // drop point — four frames before the attack launches. There is no
      // soul before this, so there is nothing to steer outside the box.
      // Guard is the Knight's `!i_ex(obj_heart)` (ac is never -1 here).
      // Measured headlessly (soul centre past the ring's outer edge while
      // the box is solid): 0 escape frames across 12 attacks x 8 held
      // directions x 2 runs, against 30-410 per cell before.
      if (!state.soul) deliverHeart(state, gt, state.practiceEntry.ac);
    }
    if (e.gap > 0) return;
    e.owner = launchAttack(state, state.practiceEntry);
    e.started = true;
    e.elapsed = 0;
    e.drain = 0;
  },
};

/**
 * @param opts.attack      an id from ATTACK_MENU
 * @param opts.difficulty  one of that entry's difficulties
 * @param opts.holdBreath  arm Kris's HoldBreath before the drill starts
 * @param opts.dials       the two practice bars (sim/dials.js), or null
 */
export function buildSingleAttackScene(
  state,
  {
    seed = 12345, attack = 'stars', difficulty = 0, holdBreath = false,
    dials = null,
  } = {},
) {
  // THE DIALS ARM FIRST, before a single spawn — same rule as the fight scene
  // (see buildPracticeScene's note). `if (dials)` so that the omitted case is
  // a truthiness test and nothing more: this drill is what verify-titlemenu
  // and half a dozen other suites build, and none of them may change shape.
  if (dials) applyDials(state, dials);
  const m = menuEntry(attack);
  // The practice scene skips the menu (it drills ONE attack on repeat), but
  // the renderer always draws the charboxes, so the state has to exist.
  state.menu = createMenu();
  state.hp = 0;
  state.invTimer = -1;
  state.view = { x: 0, y: 0 };
  state.flag22 = 0;
  state.gmlRng = gmlCreate(seed);
  state.turntimer = 0;
  state.invc = 1;
  state.practiceEntry = {
    ac: m.ac,
    name: m.name,
    difficulty: m.difficulties.includes(difficulty) ? difficulty : m.difficulties[0],
  };
  // HOLDBREATH, WHICH THIS MODE CANNOT OTHERWISE REACH.
  //
  // The drill has no menu, so it has no ACT, so `holdbreathcount` is 0 for
  // every run and the soul walks at 4 — while the fight the drill is practice
  // FOR is very often being played at 5, because HoldBreath is free, permanent
  // and the first thing Kris's ACT list offers. Practising a pattern at the
  // wrong speed is practising a different pattern.
  //
  // ARMED THE WAY THE ACT ARMS IT, not by writing a speed: `holdbreathcount`
  // is exactly what `scr` sets (spells.js `holdBreath`, the dump's
  // `holdbreathcount++` then clamp to 1), and `soulSpeed` reads it for the 5
  // and, while ROARING is on screen, the 6. No number is invented here and the
  // ROARING bump comes along for free.
  //
  // FALSE LEAVES THE COUNT AT createKnight()'s OWN 0 — not merely equivalent
  // to today, IDENTICAL to it, which is what the recorded-fight byte gates
  // require of a default.
  if (holdBreath) state.knight.holdbreathcount = 1;
  state.phase = m.name;

  spawn(state, knightActor, { x: KNIGHT.x, y: KNIGHT.ystart });
  for (const p of PARTY) {
    spawn(state, partyActor, { x: p.x, y: p.y, sprite_index: p.sprite, depth: p.depth });
  }

  settleBox(spawn(state, battlebox, { x: BOX.x, y: BOX.y }));
  // NO SOUL AT BUILD — same as the fight scene. Run 1's arena-open delivers
  // it via obj_moveheart (director.endStep); building one here gave run 1
  // the same 33-frame steer-out-of-the-box window every later run had.
  state.soul = null;
  spawn(state, director);
  return state;
}
