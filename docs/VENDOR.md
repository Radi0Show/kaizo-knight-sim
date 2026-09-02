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

