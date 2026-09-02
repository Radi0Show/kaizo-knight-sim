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
