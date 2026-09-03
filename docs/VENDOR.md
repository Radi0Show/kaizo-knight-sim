# VENDOR.md -- which knight-sim this engine is

Written by kaizo/tools/vendor-engine.mjs. sim/, render/, input/, assets/ and
tools/ are a snapshot of knight-sim; never hand-edit them here (see the
script's header and CLAUDE.md).

- source: D:\ShadowCrystal\knight-sim
- commit: 247b1ba968b8b2a0aaef80127c46defa916a7796
- vendored: 2026-09-02
- the source tree was DIRTY inside the mirrored directories; these uncommitted files were vendored as they stood:
     M render/canvas.js
     M render/menu.js
     M render/title.js
     M sim/actors.js
     M sim/attacks/combination.js
     M sim/attacks/roaring.js
     M sim/attacks/rotating-slash.js
     M sim/attacks/split-growtangle.js
     M sim/attacks/splitslash.js
     M sim/attacks/sword-tunnel-revised.js
     M sim/attacks/swordfall.js
     M sim/attacks/swordslash.js
     M sim/battlebox.js
     M sim/bullets/regularbullet.js
     M sim/damage.js
     M sim/entity.js
     M sim/gml.js
     M sim/index.js
     M sim/masks.js
     M sim/modes.js
     M sim/rng.js
     M sim/scenes/fight.js
     M sim/tension.js
     M tools/diff-trace.mjs
     M tools/run-trace.mjs
     M tools/verify-combination.mjs
     M tools/verify-damage.mjs
     M tools/verify-titlemenu.mjs
    ?? sim/data/object-order.js
    ?? tools/build-web.mjs
    ?? tools/gen-object-order.mjs
    ?? tools/regen-fullfight.mjs
    ?? tools/strip-comments.mjs
    ?? tools/test-strip-comments.mjs
- also dirty in the source tree, OUTSIDE the mirrored directories (not vendored):
     M .claude/launch.json
     M .gitignore
     M package.json
     M web/main.js
     M web/sw.js
     M web/version.js
    ?? docs/BUILD.md
    ?? kaizo/
    ?? package-lock.json
    ?? web/icon-180.png
    ?? web/icon-192.png
    ?? web/icon-512.png
    ?? web/kaizo.html
    ?? web/kaizo.js

## Pending port-backs

The 2026-09-02 kaizo session changed these engine files in knight-sim's working tree
and they are vendored here already; knight-sim has NOT committed them yet (its
vanilla gate was 60/60 with every one of them in):

- sim/attacks/sword-tunnel-revised.js -- decoy y sign `choose(-1, 1)`; volley aims at soulPrev
- sim/masks.js, sim/rng.js, sim/gml.js, sim/entity.js, sim/bullets/regularbullet.js --
  the rotated-contact rule, gmlShuffle 16n, gmlLt, Destroy events (see the ledger)

CANDIDATE (2026-09-02): the Starstorm step order. This repo measured that the
game steps obj_knight_pointing_cone (object index 545) before
obj_dbulletcontroller (1432), flipped its own stepOrder pair, and deleted two
compensations that existed only to cancel the inversion -- the two
"unattributed pads" and the cone-angle look-ahead. Gate bullets f4238 -> f4515,
trace f4252 -> f4828 (ledger: "The Starstorm pads were an inverted step order").

The VANILLA lane has the same shape and the same arithmetic works there
(sim/attacks/stars-controller.js stepOrder -2, sim/attacks/pointing-cone.js -1,
the pads in sim/scenes/fight.js case 1). It is NOT changed here, because that
lane is byte-exact for 12,000+ frames as it stands and this repo must never
hand-edit the vendored engine. Prove it in knight-sim against the full 60, then
re-vendor.

PENDING PORT-BACK (2026-09-02): sim/rng.js `gmlRandomRange` now normalises its
argument order -- `min(lo,hi) + f*|hi-lo|` instead of `lo + f*(hi-lo)`, which
is what GML does and which only differs when a call's arguments invert at
runtime. This is an edit to the VENDORED engine, made here under the CLAUDE.md
law-6 escape hatch ("if a fix must land here first to keep the gate moving,
port it back the same day"). It is proven both ways in this repo: the kaizo
byte gate moved bullets f4515 -> f5051, and the vendored engine's own 60
suites stayed green, its byte-exact vanilla whole-fight diff included (run
`node tools/regen-fullfight.mjs` first -- that suite refuses a trace older
than sim/).

TO PORT: apply the same change to knight-sim/sim/rng.js, run its 60, commit
there, then re-vendor here and delete this entry. The full receipt is in the
ledger, section "random_range normalises its argument order".

PENDING PORT-BACK (2026-09-03): sim/masks.js now dispatches a ROTATED-RECT B to an
oriented-box test instead of walking a synthesised pixel grid.

GameMaker's "Rectangle with Rotation" mask kind stores NO bitmap: the shape IS
the bbox rectangle, rotated about the origin and scaled, and contact against it
is a continuous shape overlap. The mod's sprite table says spr_knight_diamondbullet_m
and spr_knight_diamondswordbullet are exactly that -- `RotatedRect`, `masks = 0`,
empty mask hash -- and the extraction synthesised a one-pixel-tall precise row
from each bbox anyway. Sampling that row leaves sub-pixel holes; the recording's
own blade position fell in one. The two masks now carry `rotRect: true` and
masksOverlap routes them to maskHitsRotatedRect (A's set pixels as 1x1 CELLS
against B's oriented box, via the existing aabbHitsOBB).

This repo already applied the same reading to the fight's OTHER RotatedRect
sprite on the collision_rectangle route (QUICKSLASH_SHAPE ->
scrPreciseHitRotatedRect -> aabbHitsOBB, "an ORIENTED BOX test, not a pixel
test"); the engine-PAIR route had never been given it.

Made here under the CLAUDE.md law-6 escape hatch and proven both ways:
  * kaizo byte gate trace f6731 -> f7924 (bullets f6716, unchanged);
  * the vendored engine's 60 suites green, AND tools/regen-fullfight.mjs
    reproduces the vanilla whole-fight trace BYTE-IDENTICAL -- the branch never
    fires on the vanilla lane, so that lane cannot move, structurally.
  * A CORNER-point containment was tried first and is WRONG: it lost 124
    contacts the shipped model had, nearly all grazes, because the graze mask is
    a large solid rect whose cells straddle the blade without a corner landing
    inside. The rectangle family is a pixel-INTERSECTION model and this has to
    match it.

Port to knight-sim, prove against its 60, re-vendor.

PENDING PORT-BACK (2026-09-03b): sim/index.js runMotion narrows the atan2 result before
converting it to degrees, in the gravity recomposition.

The whole gravity block is single-precision-modelled (PI32, SNAP_EPS, frounds
on every product and sum) and then ended on a fully f64 tail. MEASURED on the
first frame the kaizo blade drift appears -- oracle f6604, a revised-tunnel
blade at speed 1.400272011756897, direction 201.81463623046875, gravity 0.4 at
180, giving hs -1.6999996900558472 and vs 0.5203483700752258:

    recording                       197.0186767578
    f64 atan2, f64 pi (shipped)     197.0186920166   one f32 ulp high
    f64 atan2, PI32 divide          197.0186920166   also wrong
    fround(atan2) then f64 pi       197.0186767578   EXACT

So the narrowing is on the ANGLE, not on the constant -- dividing by a
single-precision pi does not reproduce it and was tried first.

Proven both ways: kaizo byte gate bullets f6716 -> f6757; the engine's 60
suites green AND tools/regen-fullfight.mjs reproduces the vanilla whole-fight
trace BYTE-IDENTICAL, so the vanilla lane cannot move.

STILL OPEN AT THE SAME SITE: the SPEED is one f32 ulp low on that transition
(sqrt gives 1.7778530121, the recording has 1.7778531313) and no arrangement of
sqrt/hypot/f32-sum reproduces it. Holding hs, the vs that would is SIX ulps
away, so it is not the sqrt -- it points upstream at the runner's
single-precision sin/cos, whose results this model rounds from f64 rather than
computing in f32. That is the next measurement, not a guess to make.

Port to knight-sim, prove against its 60, re-vendor.
