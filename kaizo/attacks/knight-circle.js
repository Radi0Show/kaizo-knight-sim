// KAIZO V-C — obj_knight_circle AS THE MOD SHIPS IT: the aim bloom is NAVY.
//
// V-C recreation of EnderCat8's Kaizo Roaring Knight v2.3.3 — do not publish
// without permission (kaizo/HANDOFF.md §5-C publish gate).
//
// PROVENANCE (knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/, diffed
// against gml_vanilla_v105/CodeEntries/ on 2026-09-08):
//   gml_Object_obj_knight_circle_Create_0.gml:2-4   r = 0; g = 0; b = 128;
//                                                    (vanilla r = 128, b = 0)
//   gml_Object_obj_knight_circle_Step_0.gml:9-10    g = scr_approach(g, g_goal, 255 / fade_time);
//                                                    r = scr_approach(r, r_goal, 255 / fade_time);
//                                                    (vanilla fades g and b)
//   gml_Object_obj_knight_circle_Draw_0.gml         byte-identical to vanilla:
//       color_2 = make_color_rgb(r, g, b), draw_circle_color(.., color_1 = 0,
//       color_2, false) under bm_add — render/draw/knight-circle.js reads
//       r, g, b off the instance, so the vanilla drawer paints this one right.
//
// COPY BASIS: sim/fx.js knightCircle (the VERIFIED type). Every line not
// carrying a KAIZO comment is that type's, including the preserved original
// bug in the second destroy test. Same name — the seq/trace logs, the oracle
// checks (check-oracle-multislash, -vortex, -weird count obj_knight_circle
// by name) and the renderer's DRAW_EVENTS key all see `obj_knight_circle`.
//
// WHAT THE SWAP CHANGES ON SCREEN: every aim of Multislash 1/2/3 (ac 5,
// 105.1, 111) blooms navy (0, 0, 128) at the rim instead of maroon
// (128, 0, 0). In the mod the fade line runs on `r`, which is already 0,
// so the rim STAYS navy for the whole 10-frame alpha life; in the sim's
// vanilla copy the fade ran on `b` and the rim went from maroon to black.
//
// WHAT IT CANNOT CHANGE: zero RNG (neither event draws), not a bullet (no
// isBullet, no mask — the byte gate's bullets sheet never lists it), and the
// same 10-frame life on the same alpha countdown, so no trace column and no
// slot can move. The finale's circles are a DIFFERENT SPAWN SITE
// (kaizo/attacks/roaring-final.js sets r, g, b explicitly on the vanilla
// type) and belong to that module; only the rotating slash's bare
// `instance_create(aim_x, aim_y, obj_knight_circle)` (kaizo
// obj_knight_rotating_slash Step_0:278) takes this type.

import { destroy } from '../../sim/entity.js';
import { scrApproach } from '../../sim/gml.js';

/**
 * obj_knight_circle, kaizo build — the expanding ring at an aim point.
 *
 * A gradient disc, black at the centre and `rgb(r, g, b)` at the rim, drawn
 * ADDITIVELY. Lives 10 frames (`image_alpha -= 0.1`) while `circle_size`
 * runs toward 960 at 40 a frame.
 *
 * ORIGINAL BUG preserved (vanilla AND kaizo Step_0:12): the second destroy
 * test is `if (r == 0 && b == 0 && b == 0)` — `b` twice, `g` never. In the
 * mod r IS 0 from Create, but b sits at 128 and nothing moves it, so the
 * test still cannot fire and the alpha countdown ends the effect, exactly
 * as in vanilla (where r = 128 kept it shut). Translated rather than
 * omitted so the receipt is in the code.
 */
export const kaizoKnightCircle = {
  name: 'obj_knight_circle',

  create(e) {
    e.circle_size = 0;
    // KAIZO Create_0:2-4 — navy, not maroon. `?? ` keeps a caller's explicit
    // fields the way the sim type does (the finale overrides all three).
    e.r = e.r ?? 0;
    e.g = e.g ?? 0;
    e.b = e.b ?? 128;
    e.r_goal = 0;
    e.g_goal = 0;
    e.b_goal = 0;
    e.fade_time = 28;
    e.size_goal = 960;
    e.growth = 40;
    e.color_1 = 0;
    e.draw_in_box = e.draw_in_box ?? true;
    e.image_alpha = 1;
    e.depth = -60;
  },

  step(e, state) {
    // `if (!i_ex(obj_knight_roaring_fx)) image_alpha -= 0.1` — the roar's own
    // effect object holds the circle open; nothing else does.
    const held = state.entities.some(
      (x) => x.alive && x.type.name === 'obj_knight_roaring_fx',
    );
    if (!held) e.image_alpha -= 0.1;
    if (e.image_alpha < 0) {
      destroy(e);
      return;
    }
    // KAIZO Step_0:9-10 — g then r (vanilla: g then b). 255 / 28 a frame,
    // a no-op on the fields the Create leaves at 0.
    e.g = scrApproach(e.g, e.g_goal, 255 / e.fade_time);
    e.r = scrApproach(e.r, e.r_goal, 255 / e.fade_time);
    e.circle_size = scrApproach(e.circle_size, e.size_goal, e.growth);
    // Step_0:12-15 — the `b` twice, `g` never test, verbatim. Unreachable
    // with b = 128 (see the type's doc comment).
    if (e.r === 0 && e.b === 0 && e.b === 0) destroy(e);
  },
};
