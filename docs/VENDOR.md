# VENDOR.md -- which knight-sim this engine is

Written by kaizo/tools/vendor-engine.mjs. sim/, render/, input/, assets/ and
tools/ are a snapshot of knight-sim; never hand-edit them here (see the
script's header and CLAUDE.md).

- source: D:\ShadowCrystal\knight-sim
- commit: 5ceff7fc589f2fe9d23d9221d91044900f45e504
- vendored: 2026-09-10
- the mirrored directories were clean in the source tree

## Pending port-backs

(none — everything listed here through 2026-09-04 was ported to knight-sim on
2026-09-08 and is in the vendored snapshot above: gmlRandomRange argument
order (v1.0.20), the RotatedRect oriented-box test and masksOverlapRectA on
A's own lattice (v1.0.20), fround(atan2) in the gravity recomposition
(v1.0.20), stepGraze feed order + hand-back (v1.0.20), render/audio.js
streaming music + `createAudio({ overrides })` (v1.0.20), render/title.js
`drawTitle(..., { title })` (v1.0.19), and the Starstorm candidate —
[cone -2, dc -1], no pads, no look-ahead — proven byte-exact against the
vanilla whole-fight recordings and landed as v1.0.21. The engine also
carries knight-sim's 2026-09-08 bug round (single.js gate/music/deliverHeart,
fight.js deliverHeart, the ending gate, stars childDelay reset, hero
spelltimer, snd_hurt1/snd_laz_c cues, render nine-slice + split-box tint at
build time); kaizo/ scenes that duplicate any of that are this repo's own
to reconcile.)
