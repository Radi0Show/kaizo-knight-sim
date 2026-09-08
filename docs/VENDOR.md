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

PENDING PORT-BACK (2026-09-03c): sim/tension.js stepGraze processes a REPLAYED pairing
table in the feed's row order, not in entity order.

The awards are not independent: both branches gate on `turntimer - 1 >= 10`
and a BURST deducts a whole timepoint, so a burst paid first can push the
clock under the gate and silence a TRICKLE on the same frame.

MEASURED, _tok3 f7924. Two contacts land with the clock at 11.6 -- a trickle
from starchild 131790 and an entry burst from 131786 -- and the recorder logs
them in that order. Trickle first clears its gate at 10.6 and the burst
follows, for the recording's -1.0333. Burst first leaves the trickle's gate at
9.6 and refuses it, for -1.0, and the clocks never meet again.

ENTITY ORDER DOES NOT EXPRESS IT. Sorting the pass newest-first -- the rule
the COLLISION pass uses, and the obvious guess -- fixes this frame and
collapses the trace gate from f7924 to f2714. The feed is the ordering, so the
feed is what is followed.

SCOPE: the replay path only. Free play has no table and keeps the geometric
test, so nothing a player runs changes -- which is why this carries no version
bump.

Proven both ways: kaizo byte gate trace f7924 -> f8088; the engine's 60 suites
green AND regen-fullfight reproduces the vanilla trace BYTE-IDENTICAL.

Port to knight-sim, prove against its 60, re-vendor.

PENDING PORT-BACK (2026-09-03d): sim/masks.js masksOverlapRectA walks A on its OWN ink
lattice at its raw position, not on the integer world grid.

THE ROUTINE CONTRADICTED ITSELF. Its loop bound was
`Math.min(Math.floor(aRight), ...)` and its A-side sampler two lines later was
`Math.floor(px - (ax - aox))`; those disagree by one column whenever A sits at
a FRACTIONAL position -- the bound stops before a column the sampler would have
accepted. A rect A between cells silently lost its last ink column. Both
sibling routines in the same file already do it the other way
(masksOverlapPrecise walks `ax + cx - aox`, maskHitsRotatedRect walks `ax + i`),
so this is the file agreeing with itself rather than a new rule.

MEASURED, _tok3 f8088 (atk_Splitter3). A tooth at (133.07237, 231.71428),
image_angle 180, against the soul at x 107.74784088134766 -- mid-frame, pushed
by the growtangle and not yet snapped to 108 by its End Step clamp. The
recording takes the hit on f8088; the sim took it one frame LATE at f8089
(oracle f8088 inv 12 / bullets 28, sim f8088 inv -61 / 29 then f8089 inv 12).
Offline on those exact eight numbers: rectA false, precise TRUE.

WHY IT SURVIVED THIS LONG, and why the blast radius is checkable rather than
hopeful: when ax and ay are INTEGERS the new loop enumerates exactly the world
cells the old bound did, so every integer-A case is bit-identical. Every
dataset that calibrated this routine is integer-A -- graze-probe.csv 12,416
rows, growmeet.csv 8,136, toothmeet.csv 4,705, twenty-five thousand rows with
zero exceptions -- so the rule was UNOBSERVABLE until a soul stopped between
cells. toothmeet-cfg row 0 is literally this tooth at angle 180, probed only at
integer soul positions.

THREE ALTERNATIVES TESTED AND REFUTED, recorded so nobody re-tries them:
  * route angle 180 to masksOverlapPrecise -- breaks vanilla 6/6 (verify21j
    f9433, verify37 f4823 are the counter-receipts);
  * route all cardinals to precise -- kaizo breaks EARLIER, at f5112;
  * patch only rectA max bounds -- new kaizo regression at f5190, earlier than
    the bug being fixed.

Proven both ways: kaizo byte gate trace f8088 -> f8489, and the first frame
that changes anywhere in the 13,000-frame run is f8088 itself, changing to the
oracle row. Engine 60 suites green AND regen-fullfight reproduces the vanilla
trace BYTE-IDENTICAL.

Port to knight-sim, prove against its 60, re-vendor.

PENDING PORT-BACK (2026-09-04): sim/tension.js stepGraze HANDS BACK to the
geometric test on any frame the replayed graze table does not cover.

`if (state.grazeReplay)` is a property of the RUN, not of the frame. Once a
table was supplied every later frame took the replay branch, so a frame the
table does not cover found no row, paired nothing, and silently awarded no
graze at all -- neither burst nor trickle. There was no fallback, only silence.

MEASURED, _tok3. kaizo_oracle_grazes_tok3.csv was recorded as _tok4 and its run
hit the wall-clock budget at f10868. Its own PROVENANCE file already describes
the intended behaviour -- "beyond f10800 the graze feed is EMPTY and the sim
falls back to its own graze pass there" -- and that fallback did not exist.

THE INSTRUMENT IS THE POINT, and it is reusable. The recording reports every
graze through the turntimer column even where the feed stops: an ordinary frame
costs exactly 1.0, a TRICKLE an extra 1/30, a BURST an extra whole timepoint.
So the per-frame delta is a readout of the game's own graze events. Scored over
f10869-11094 -- bounded above by the first frame the two sides' geometry stops
agreeing, which is honest because the worst matched-pair bullet drift there is
2.2e-4 px -- the sim awarded ZERO of the recording's 18 events. Not mistuned:
absent. With the fallback it awards all 18, and 3 it should not.

SCOPE. `grazeReplayLast` is set only by a tracer that loads a feed
(kaizo/tools/kaizo-trace.mjs). A loader that does not set it keeps the old
all-frames behaviour, so tools/fullfight-trace.mjs and the vanilla lane are
untouched by construction -- and free play has no table at all, which is why
this carries no version bump: nothing a player runs can reach the branch.

A frame INSIDE coverage that genuinely had no grazes still pairs nothing. The
two cases are not the same and the frame number is what separates them.

Proven both ways: kaizo byte gate trace f10889 -> f10897; the engine's 60
suites green AND regen-fullfight reproduces the vanilla trace BYTE-IDENTICAL.

Port to knight-sim, prove against its 60, re-vendor.

PENDING PORT-BACK (2026-09-07): render/title.js draws the wordmark from
SEGMENTS so a lane can colour part of it.

`drawTitle` took no options and drew one hardcoded white line:

    centred(ctx, font, 'BLACK KNIFE SIMULATOR', 60, c_white, 1.6);

It now takes an `opts` bag whose `title` is an array of [text, rgb] segments,
laid end to end from one measured centre by a new `centredSegments()` helper --
measured as a whole, because one `centred()` call per segment centres each
independently and stacks them.

THE DEFAULT IS THE OLD LINE EXACTLY: `opts.title ?? [['BLACK KNIFE SIMULATOR',
c_white]]`, so knight-sim, which passes no opts, is unchanged to the pixel.

WHY: the kaizo build's title screen paints KAIZO in the Knight's own blue
(kaizo/attacks/kaizo-colors.js getSwordcolor -- swordtype 0, pure blue) and the
rest white. The alternative was a hardcoded hex in a vendored file, or a second
copy of title.js in kaizo/, and both are worse than one parameter.

Proven: vanilla regen-fullfight reproduces every trace BYTE-IDENTICAL, the
engine's 60 suites are green, the kaizo suites are green, and the kaizo byte
gate still reads trace OK / bullets f6757.

Port to knight-sim, prove against its 60, re-vendor.

PENDING PORT-BACK (2026-09-07b): render/audio.js createAudio takes CUE OVERRIDES.

`createAudio()` took no arguments and resolved every cue against the vanilla
audio folder. It now takes `{ overrides }`, a cue -> file map applied right
after the manifest loads (so `preloadAll` decodes the replacement instead of
the file it replaces -- decoding both would cost a player a download of a song
that never plays), and the fetch tells an absolute URL from a bare manifest
filename so a lane can ship audio from its own directory.

Omit the option and nothing changes: knight-sim calls `createAudio()` and gets
exactly what it got before.

WHY: Kaizo Roaring Knight ships its own `kaizoknight.ogg`, and that is the song
that plays over the fight, so the recreation plays it instead of the vanilla
knight theme. The file lives under kaizo/assets/, publish-gated in full by that
directory's own .gitignore -- it is EnderCat8's work and kaizo/HANDOFF.md §5-C
requires their permission to republish -- so it is used locally and committed
nowhere, exactly like the sprite overlay. A clone without it falls back to the
vanilla theme on its own, because an override whose file 404s just leaves the
cue in `missing`.

Port to knight-sim, prove against its 60, re-vendor.

PENDING PORT-BACK (2026-09-07c): tools/devserver.py uses daemon threads and
stops logging a traceback for every abandoned request.

MEASURED, and the numbers are the point:

    long-running devserver.py    2015 ms per 800-byte PNG
    freshly started, same code     17 ms
    plain python -m http.server    19 ms

~106x, on identical code. A page here pulls ~1,660 sprite frames per load and a
browser abandons many of them on every navigation; each abandoned one raises
ConnectionAbortedError out of copyfile, unwinding a thread that
ThreadingHTTPServer (daemon_threads defaults to False) keeps a handle on. After
a few hours of reloads the process had accumulated thousands and crawled.

It read as "the game takes forever to load", and with the canvas still black it
read as the page failing to boot at all -- which is what it was mistaken for.
The assets are not the problem: the vanilla sprites are 0.9 MB across 1,205
files, averaging 800 bytes, so per-request cost is the entire story. At 17 ms
over six sockets the whole set is ~5 s.

daemon_threads = True lets a finished connection go, and a handle_error that
swallows ConnectionAborted/Reset/BrokenPipe stops the log being thousands of
tracebacks with the real 404s buried in them.

Port to knight-sim, prove against its 60, re-vendor.

PENDING PORT-BACK (2026-09-07d): render/audio.js STREAMS music instead of
decoding it.

`fire()` decoded every cue to an AudioBuffer. That is right for effects -- a few
KB each, they overlap, they need sample-accurate starts -- and wrong for a song:
decodeAudioData expands a track to raw 32-bit PCM and holds all of it, and the
decode is a visible stall on the frame the track is cued.

`fireStream()` now handles any `mus_` cue with an <audio> element routed through
createMediaElementSource, so it stays inside the same gain graph and the music
slider, the MASTER ceiling and stopLoop all keep working untouched. It returns
an object presenting the three surfaces the rest of the module uses on a
BufferSource -- stop(), playbackRate.value, addEventListener -- so play(),
startLoop() and stopLoop() cannot tell the difference. Returning null falls back
to the decode path, which is what happens if a browser refuses
createMediaElementSource.

MEASURED on the 4.4 MB kaizo song, with a harness that counts Audio
constructions (note: `new Audio()` is DETACHED, so querying the document for
<audio> finds nothing even when this works -- that cost one wrong reading):

    cue returned in                     0.4 ms   (was a full decode)
    Audio elements constructed          1, loop=true, readyState 4
    buffered ahead                      98.2 s
    mus_knight in decoded buffers       no, after 5 s

Also: `resume` now retries any paused stream, because an <audio> element is
refused before a user gesture exactly as the context is, and unlike the context
nothing else was retrying it.

Port to knight-sim, prove against its 60, re-vendor.

