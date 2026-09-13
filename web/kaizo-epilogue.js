// THE B-SIDE EPILOGUE, AS A DRIVER-SIDE SCENE — ledger G-15.
//
// `kaizo/scenes/kaizo-ending.js` has translated `obj_ch3_PTB02`'s con-50.2
// epilogue since 2026-09-11 and **nothing on the page ran it**: `web/kaizo.js`
// called `sim/victory-scene.js` unconditionally, so a Weird Route win played
// the A-Side knighting. This module is the seam that closes that — the repo's
// signature defect (a value computed correctly and written where nothing reads
// it) at module scale.
//
// WHY IT IS ITS OWN FILE, and not four lines inside web/kaizo.js: web/kaizo.js
// cannot be imported outside a browser (it touches `window`, `document` and
// the service worker on load), so anything living in it is unreachable by a
// check and can only ever be grepped. Everything here is DOM-free, which means
// `kaizo/tools/checks/check-ending-driver.mjs` runs the real production
// factory and steps the real production loop rather than a re-implementation
// of them. The same reason `web/kaizo-gameover.js` is its own file.
//
// ─────────────────────────────────────────────────────────────────────────
// WHAT THIS DOES NOT DO, stated plainly because the difference matters:
//
// The epilogue now RUNS and SEQUENCES on the page — its `sb_con` ladder walks
// 0 -> 1 -> 2 -> 3 -> 4 -> 99, its stalls stall, its alarms fire on the right
// frames, and its SOUND CUES REACH THE PAGE (`cue`/`cueLoop` into the sim's
// own queue, drained below). **It does not LOOK right, and will not until two
// other things land.** Nothing paints it:
//
//   * the `spr_fx_hitback` clash pairs, the whiteall overlays, the
//     afterimages, the shake and the depth juggling are recorded on
//     `state.kaizo.ending.marks` / `.lerps` and READ BY NOBODY — there is no
//     `render/` drawer for any of them (and render/ may not learn about
//     kaizo/, so the drawer would belong under kaizo/render/);
//   * the ouchie / SWOON writers and the `spr_ralsei_swoon` easter egg are
//     recorded the same way and drawn by nothing;
//   * **`board_ocean` IS NOT PACKED** — the loop the whole scene parks on at
//     sb_con 99 has no file and no manifest entry in this repo, so that cue is
//     a silent no-op. `wind_highplace.ogg` IS in the base pack and does play.
//     Stripping `.ogg` (below) was necessary but not sufficient: it made the
//     wind audible and left the music silent, which is exactly the shape of
//     bug that reads as fixed.
//
// The 36 sprites the epilogue names were in neither pack when this module was
// written; they are ALL packed now, so that gap closed and what remains is the
// missing drawer, not missing art.
//
// So what a player sees today is the room, the receding white, and the wind
// over it. That is a deliberate half, not an oversight, and
// it is better than the previous whole — which was the WRONG cutscene played
// with full confidence.
//
// ONE MORE DEVIATION, on purpose: **the real con 50.2 never gives the room
// back.** `endingTerminal(st).terminal` going true is the mod parking at
// `sb_con 99` forever. A practice tool cannot park the player there with no
// way out, so the driver treats terminal as the end of the scene and hands the
// page its TV-off, exactly as the A-Side knighting's end does. The sim half
// still reports the truth — `resumedAtCon` stays null on this route, which is
// the fact the whole lane is about — and this file is where the tool's answer
// to it is made, so a check can hold it.

import { createState, stepFrame } from '../sim/index.js';
import { spawn } from '../sim/entity.js';
import { gmlCreate } from '../sim/rng.js';
import { drainCues } from '../sim/audio.js';
import {
  ensureEnding, ptb02Con8, ptb02Alarm0, enterEnding, kaizoEndingDriver,
  endingTerminal, endingReport,
  FLAG_KNIGHT_OUTCOME, FLAG_KNIGHT_VIOLENCED,
} from '../kaizo/scenes/kaizo-ending.js';

/**
 * A cue name the audio manifest can find.
 *
 * The epilogue's music cue is `cueLoop(state, 'board_ocean.ogg', ...)` and the
 * wind's is `'wind_highplace.ogg'` — the GML's own `snd_init("x.ogg")` strings,
 * which is the right thing for the sim to carry (a cue name is traceable back
 * to the line that plays it). `render/audio.js` keys its manifest on CUE NAME
 * and resolves the extension itself, — so an unstripped name resolves to
 * nothing and the cue plays in silence, invisibly. Stripped here, at the
 * driver, rather than in the sim, because the sim's names are the dump's and
 * must stay that way.
 *
 * THE STRIP IS NOT ENOUGH FOR THE MUSIC. `wind_highplace` resolves — it is in
 * assets/audio/. `board_ocean` DOES NOT EXIST in this repo: not in
 * assets/audio/index.json, and not in the kaizo overlay, which carries exactly
 * one file. So the epilogue's defining loop is a silent no-op whatever name
 * reaches the manifest, and calling this scene's audio "wired" would be false.
 */
export function epilogueCueName(name) {
  return typeof name === 'string' && name.endsWith('.ogg') ? name.slice(0, -4) : name;
}

/**
 * Stand the epilogue up from a WON fight state.
 *
 * IT GETS ITS OWN SIM STATE, and that is the faithful shape, not a shortcut:
 * the mod's head is
 *
 *     if (con == 50.1 && !i_ex(obj_battlecontroller)) { con = 50.2; ... }
 *
 * (Step_0:1186) — the epilogue only starts once the battle controller is GONE.
 * A fresh state is a room with no fight in it. It also means the page can stop
 * stepping the fight at the white fade exactly as it always has, so no
 * finished-fight frame is stepped 600 times into untested territory.
 *
 * WHAT CROSSES THE SEAM, and nothing else:
 *   - `k_sideb` (`state.kaizo.sideb`), the route;
 *   - `global.kaizo_funni`, which `kaizo_funchance` reads;
 *   - `global.flag[50]` / `[51]`, the battle teardown's own writes. THE FIGHT
 *     ALREADY PRODUCED THESE: `kaizo/scenes/kaizo-practice.js` calls
 *     `endingWatchEndcon` the frame `endcon` becomes 2, and until this file
 *     existed nothing read what it wrote. The fork reads flag[50] here.
 *   - the live `gmlRng`, so the epilogue's `kaizo_funchance` rolls continue
 *     the fight's stream rather than restarting it (the real mod's stream is
 *     continuous; `createState` seeds `gmlRng` with 0 regardless of `seed`,
 *     which would make every run's Ralsei fakeout identical).
 *
 * Returns the scene object the page holds. `route` is `ptb02Con8`'s own
 * answer, so a caller that reached here on the wrong route can see that it
 * did: only `'bside'` gets an epilogue.
 */
export function createKaizoEpilogue(fightState) {
  const seed = Number.isInteger(fightState?.seed) ? fightState.seed : 1;
  const st = createState({ seed, traceBulletSlots: 0 });
  st.gmlRng = fightState?.gmlRng ?? gmlCreate(seed);
  st.kaizo = {
    sideb: !!fightState?.kaizo?.sideb,
    funni: !!fightState?.kaizo?.funni,
  };
  ensureEnding(st);
  const won = fightState?.kaizo?.flag ?? {};
  st.kaizo.flag[FLAG_KNIGHT_OUTCOME] = won[FLAG_KNIGHT_OUTCOME] ?? 0;
  st.kaizo.flag[FLAG_KNIGHT_VIOLENCED] = won[FLAG_KNIGHT_VIOLENCED] ?? 0;

  const fork = ptb02Con8(st);            // con 8 -> 49 | 49.1 | 9
  ptb02Alarm0(st);                       // Alarm_0 is `con++`, the whole file
  const head = enterEnding(st);          // 50.1 -> 50.2, or 50 -> 10
  // The machine itself, as an entity, so the engine's own step phase drives it
  // after the actors it reads (kaizo-ending.js, kaizoEndingDriver's note).
  spawn(st, kaizoEndingDriver, {});
  return { st, con: fork.con, route: fork.route, head, t: 0, done: false };
}

/**
 * One 30Hz frame of it. Returns the cues to play, manifest-named.
 *
 * `done` is `endingTerminal().terminal` — `sb_con 99` at `sb_timer 555`
 * (Step_0:1758). See the header for why the tool ends there and the mod does
 * not.
 */
export function stepKaizoEpilogue(ep, input) {
  if (!ep || ep.done) return [];
  ep.t += 1;
  stepFrame(ep.st, input);
  if (endingTerminal(ep.st).terminal) ep.done = true;
  return drainCues(ep.st).map((c) => ({ ...c, name: epilogueCueName(c.name) }));
}

/** Everything a console breadcrumb or a check wants, in one read. */
export function kaizoEpilogueReport(ep) {
  return { t: ep.t, done: ep.done, route: ep.route, head: ep.head, ...endingReport(ep.st) };
}
