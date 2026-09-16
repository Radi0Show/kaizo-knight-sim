// obj_rudebuster_bolt. THE CAST ITSELF IS NOT DRAWN HERE.
//
// obj_rudebuster_anim takes `obj_herosusie.depth` and hides her for its 28
// frames — it stands in for her at her own layer, it is not an effect over
// the party. This file used to draw it, from a pass that runs after the
// entity loop and the charbox row, under a header that said in as many words
// that it belonged at her depth. It read exactly as what it was: the cast
// jumping in front of Ralsei. It is sim/actors.js's partyActor now, which
// swaps her sprite in place; that header has the report and the reasoning.
//
// The bolt leaves a trail of `scr_afterimage` copies, one per frame, each
// shrinking on the Y axis (`image_yscale -= 0.1`) — so the streak tapers
// behind it rather than fading uniformly. On impact eight bursts fly out on
// 45-degree diagonals and decay at two different rates, 0.75 for the first
// four and 0.8 for the second, which is what stops the explosion looking
// like a single ring.

import { drawSpriteExt, c_white } from './draw/gm.js';

export function drawRudeBuster(ctx, state, sprites) {
  const r = state.rude;
  if (!r) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const b = r.bolt;
  const beam = sprites.get('spr_rudebuster_beam');
  if (!b || !beam?.frames.length) {
    ctx.restore();
    return;
  }

  // The trail goes under the bolt.
  for (const a of b.trail) {
    if (a.alpha <= 0 || a.scale <= 0) continue;
    // `image_index = 4` — the afterimages are all one frame of the sheet, not
    // the animating one.
    drawSpriteExt(ctx, beam, Math.min(4, beam.frames.length - 1),
      a.x, a.y, 2, a.scale, a.angle, c_white, Math.max(0, a.alpha));
  }

  if (b.explode === 0) {
    drawSpriteExt(ctx, beam, Math.floor(b.t) % beam.frames.length,
      b.x, b.y, 2, 2, b.direction, c_white, b.alpha);
  } else {
    for (const s of b.bursts ?? []) {
      if (s.scale <= 0.05) continue;
      // X ONLY. The Step decays the bursts with
      //
      //     with (burst[i]) { speed *= 0.75; image_xscale *= 0.8; }
      //
      // and never touches image_yscale, which stays at the 2 they inherit
      // from the bolt. Since each burst is rotated to its own 45 + i*90, the
      // shrinking axis is the beam's LENGTH: they retract as streaks at full
      // thickness. Scaling both axes (what this used to do) shrank them into
      // uniform blobs and lost the shape of the explosion.
      drawSpriteExt(ctx, beam, Math.min(4, beam.frames.length - 1),
        s.x, s.y, s.scale * 2, 2, s.angle, c_white, 1);
    }
  }
  ctx.restore();
}
