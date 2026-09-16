# KAIZO KNIGHT — the one-to-one strategy

**For the session taking this over.** Written 2026-09-02 at the user's request
("think about your strategy, make it the highest leverage you can, put that
into writing for a future session"). Read this, then `HANDOFF.md`, then the
ledger `~/knight-research/kaizo-mod/ORACLE-GROUND-TRUTH.md` (private repo),
then run the gates. The ledger holds every measured fact with its receipt; this
file holds how to get the next ones cheaply.

## 0. The metric, and the only thing that counts as done

`npm run regen:kaizo` then `npm run verify:fullfight` — the whole-fight byte gate against `_tok3` (the
tracked recording under `knight-research/kaizo-mod/fullfight/`). Its **first
divergence frame** is the project's one number. (Since the 2026-09-02 split
`verify:kaizo` is the suite; it runs this gate but does not fail on the frame.)
Aggregate drift is
meaningless past that frame (the input table is the recording's, so a slipped
turn boundary feeds the sim the wrong masks from there on). One-to-one means:
first divergence = end of recording, and every column exact, with the four
micro-tolerances the vanilla gate documents.

Rendering one-to-one is a second gate that does not exist yet (§4). Until it
does, the render work is verified by call-for-call review against the GML
plus the two smokes (`tools/verify-render-smoke.mjs`,
`kaizo/tools/checks/check-render-smoke-kaizo.mjs`).

History of the number this session: f884 → f914 → f1142 → f1215 → f1472 →
f2057 → f2068 → f2153 → f2343. Every jump came from a recording-derived
number, never from reading code alone.

## 1. The lesson that ranks everything else

**A front falls in minutes when the recording gives you a number to match,
and in hours when you reason from the GML.** Concretely, the tools that
produced the jumps:

| tool | what it answers | where |
|---|---|---|
| draw probe (`KAIZO_ORACLE_DRAWPROBE=a-b`, recorder) | how many u32 the game drew each frame, decoded on the anchor stream | `oracle_kaizo_fight.csx`; decoder scratch `pT-decode-drawprobe.mjs` (copy into `kaizo/tools/` — see §2) |
| trap logger (`KAIZO_TRAP=a-b`, tracer) | which sim site drew each u32 (needs a `__trap` logger in `sim/rng.js`; removed at close — re-add as an env-gated block, never un-gated) | `kaizo/tools/kaizo-trace.mjs` |
| `KAIZO_WATCH=obj_x KAIZO_WATCH_FIELDS=a,b,c` | a sim entity's fields per frame (post-step = trace row f) | tracer |
| `KNIGHT_TALK_DEBUG=1` | the dialogue writer per frame | director |
| graze feed / seq log / bullets sheet | which bullet touched what, when, and every birth | `fullfight/` |
| watched recordings (`_balloon`, `_probe`) | writer/blcon births; alarms and scales per frame | save dir |

So: **build the instrument before chasing the front.** The rest of this file
is the instruments, in leverage order.

## 2. Lever one — the whole-fight RNG audit (do this first)

Most remaining fronts will be RNG-count faults (a Draw-event `random` the sim
does not consume, a `choose` on a path the sim skips, a `with` loop that draws
per instance). Each costs a chase when found through the gate. **One
recording finds all of them:**

1. Record the whole fight with the draw probe on EVERY frame
   (`KAIZO_ORACLE_DRAWPROBE=0-13000`, tag `_probeall`, `-Frames 13000`,
   `-TimeoutSeconds 900`). The probe consumes 4 u32 per frame, so this fight
   is NOT the canonical one — its attacks land elsewhere — but the sim can
   follow it if it consumes the same 4 per frame.
2. Run the tracer with the emulation on (`--drawprobe 0-13000`: two
   `gmlIrandom(360)` after each frame's row) and its per-frame draw log
   (`--drawlog path`: `sim frame, oracle frame, r.draws, spawnn` each frame).
3. Decode the probe: per frame, the anchor is `seed + n*1000` where `n` is the
   spawner count before that frame (from the sim's launch log: each launch's
   `spawnn`); the pair search restarts from position 0 on each launch frame
   and is monotonic within a turn. Compare CUMULATIVE draws since the anchor
   (game vs sim, both minus the probe's own) — cumulative, not per-frame,
   because `obj_time` draws at depth 0 and any Draw-event RNG of a deeper
   object lands after the probe within the frame.
4. The first cumulative mismatch in each TURN is a genuine fault (each turn
   re-anchors, inputs and bolts are replayed). Report `(turn, oracle frame,
   game cumulative, sim cumulative, sim sites at that frame)`.

That table replaces dozens of gate chases. Expected findings, from the GML
audit already done: `obj_knight_diamondswordbullet_ext` Draw (two
`irandom_range` per bullet per frame), `obj_knight_lightorb` sparks,
`obj_splitslash` Draw when `playerstrike`, `obj_marker_jitter`,
`snd_play_x` pitches with `random(...)`, and every `scr_randomtarget_old`
site (target 4 bullets — see the ledger).

Rules for consuming Draw-event RNG: in the type's `draw(e, state)` (the
engine's draw slot after End Step, depth-descending), gated as the GML gates it
(`visible`, the exact `if`), in the GML's argument order (**right-to-left**
inside one call), and the values stored on the entity for the renderer.

## 2a. Lever one — DONE (2026-09-02). What it is now, and what it found

Tools added since (all in `kaizo/tools/`): `derive-shuffle.mjs` (the slash ORDER
from a recording's seq log, fed with `kaizo-trace --shuffle`, wired into
`regen:kaizo`; the tracer reports fans reordered / unmatched so a stale feed
cannot pass silently), and the recorder's WRITER SIDECAR
(`KAIZO_ORACLE_WRITERLOG=1` -> `kaizo_oracle_writer<TAG>.csv`: pos, length,
halt, prevent_mash_buffer, automash_timer and the knight's talk fields, one row
per frame a writer lives). The sidecar is a pure observer -- its recording's
trace is byte-identical to one taken without it, which is the receipt.

Tools (all in `kaizo/tools/`): `probe-diff.mjs` (decoder + per-turn differ:
first mismatch, whether it RECOVERS or PERSISTS, the turn's ending offset),
`diff-kaizo-pair.mjs` (the gate's grouped first-cause comparison on ANY
trace/bullets pair), the tracer's `--drawprobe a-b --drawlog path`, and the
recorder's `KAIZO_ORACLE_DRAWPROBE=0-13000` (whole fight). Recording: scratch
`probeall/` this session; re-record with `run-kaizo-oracle.ps1 -Tag _probeall
-Frames 13000 -Grazes 1 -TimeoutSeconds 1500` and the env var, then
`decode-bolts`, the tracer with `--grazes --drawprobe 0-13000 --drawlog`, and
both differs.

**The rule that made it work:** the game reseeds on the DISPATCH frame and its
end-of-frame probe draws four u32 on the fresh anchor before any manager Create;
the sim launches a frame later. The launcher's `afterLaunchReseed` hook (installed
by the tracer under `--drawprobe`) draws them; without it every roll of a turn
reads four positions early with identical counts (ledger, "The whole-fight RNG
audit lands"). Validated: the Splitter 1 probe fight is byte-exact for its whole
length, trace and bullets.

**THE TAILS ARE THE MESSAGE WRITER, NOT THE ATTACK.** Every turn ends far
behind because obj_writer redraws its whole message every frame at 2 or 4
u32 a character, in the menu phase, after everything the turn does and
before the next launch reseeds (ledger, "The audit's per-turn tails").
Read the FIRST MISMATCH and whether it RECOVERS; the tail is noise.

**Read the two differs TOGETHER.** `diff-kaizo-pair` gives the first STATE
divergence; `probe-diff` lines before that frame are genuine count faults (state-
invisible: Draw-event and sound RNG -- the rendering debt); lines after it are
downstream noise (a one-frame clock slip shifts every later launch and breaks the
anchoring). Fix the state front, re-run both, repeat.

Whole-fight probe fight, first pass: state front f921 (a rotated precise-mask
contact one frame early -- the SAME rule as the canonical f2343, opposite
direction; §6 below, now landed). Count faults before it: Starstorm 1 ends 1,649
u32 behind the game, Crescent 1 ends 1,132 behind (from f667). Those two are the
next audit targets once the state fronts move.

## 3. Lever two — the state-sheet differ

The bullets sheet compares seven fields per slot. Everything else a front
turns on (`alarm[]`, `timer`, `con`, `active`, `grazed`, `image_index`,
`image_alpha`, `depth`, `visible`, `image_blend`) is invisible until someone
watches it by hand. Generalise the swordfall probe: a recorder mode that logs,
per frame, every alive instance of a watch list with those fields, and a
tracer dump of the same for the sim's types, keyed `(frame, gmlName,
creation-order slot)`. A differ reports the first `(frame, object, field)`.
This is also the seed of the render gate (§4): `image_index`, `image_alpha`,
`image_blend`, `depth`, `visible` and the scales ARE the draw call.

## 4. Lever three — the render gate

Rendering one-to-one has no oracle today. The closest cheap one: the state
sheet above plus a recorder log of each watched object's draw-relevant fields
at its Draw event; the sim renderer's per-entity draw arguments (sprite,
subimage, origin, position, scales, angle, blend, alpha) compared against it.
Until then: work the render workflow's critic list (`kaizo/RENDER-CRITIC.md`,
copied out of that workflow's scratch output at the 2026-09-02 split) and the 33 open review findings
across the eight family files in `kaizo/render/draw/`.

**THE "KNOWN HOLES" LIST THAT USED TO SIT HERE IS CLOSED — re-checked
2026-09-16.** It named six, and each now has an ENFORCED check standing over
it, wired into `verify:kaizo`:

| hole | closed by |
|---|---|
| the B-Side tension bar | `check-tensionbar-draw` (the sliced bar, its +32 readout drop, the shard bleed) |
| hero sprites never drawn | `check-heroes-draw` (obj_heroparent's Draw deltas, the gloom tint, the frozen statue) |
| boxsplitter hell surface depth vs the box | `check-render-depth-kaizo` |
| `obj_roaringknight_quickslash_big` missing from the registry | `check-render-depth-kaizo` |
| the snow sheets | `check-snowflake-art` (spr_icespell_snowflake, bg_snowfall — VANILLA art no pack carried) |
| `spr_custom_box` as a runtime surface sprite | drawn at `kaizo/render/draw/stream.js:471`; the GML makes it with `sprite_create_from_surface` and that origin is documented at :432-455 |

**THIS DOC AND `RENDER-CRITIC.md` WERE BOTH FROZEN AT THE 2026-09-02 SPLIT
COMMIT (013cf7e) while the code shipped to v0.1.23+.** Read every gate number
and every "open" in either of them as a 2026-09-02 reading, not a current one —
`verify:kaizo` is the only current answer, and RENDER-CRITIC.md's own header
says the same about its numbers. What is still genuinely open on rendering is
in the audit's own list: `obj_fake_gt`'s arena shake computes offsets for RNG
parity that no renderer reads, four objects never receive their
object-definition `sprite_index`, and `check-colours-sheet` is red on all five
launches because of those two plus half-up `merge_color`.

## 5. Lever four — the step-order migration (structural)

The runner steps NEWEST INSTANCE FIRST (four receipts; ledger). This lane
steps oldest-first with per-site emulations (the slash→box handoff in
`flurry-splitslash.js` is one). `state.stepNewestFirst` exists in
`sim/entity.js`; switching it on for the kaizo scene regresses the gate to
f449 — every one of those regressions is an oldest-first fit to find and
remove with the GML in hand, and the emulations retire. Do it when the
matched prefix is still short (it only grows), and do it as its own pass with
the gate as the guide: flip, fix the first divergence, repeat.

## 6. Lever five — the collision-event model at rotated slivers (RULE FOUND 2026-09-02)

The f2343 front: a fan (`spr_diamondbullet_form`, angle 152.5) at the soul's
edge hits in the game a frame before `masksOverlap` says so. **FOUND (final, ten receipts): precise-A
x ROTATED precise-B keeps B's RAW position, samples A's pixel CORNERS, and
inverse-maps with ceil(v) - 1 (an exact cell boundary belongs to the lower
cell); unrotated keeps round + corner + floor. Floor, raw+floor and
round+centre were each tried and each moved a gate backwards on a later
receipt; the 704-combination search over ten exact-pose receipts leaves this
one family (sim/masks.js masksOverlapPrecise, ledger "Closing state"). Method worth keeping: collect every marginal
contact from BOTH fights as (soul, pose, mask, hit/miss) and score candidate
rules offline before touching the engine -- scratch pFit-rotated.mjs is the
template. Validation numbers in HANDOFF.md.** Masks are
identical; the fan is active. The vanilla contact study fitted axis-aligned
and 30/45/60/135 cases; this is a rotated 13×5 sliver. Method: reproduce
offline with `enginePairHit` on the exact inputs (ledger, "closing state"),
then an oracle sweep like `t4-contact-hits` at this angle family. One
measurement, every attack benefits.

## 7. Working rules that cost hours when broken

- `node --check` every patched file; never chain a patch and a regen with
  `&&` (a failed patch silently skips the regen and the old gate reads as
  the new one). Print every exit code.
- Bash's working directory drifts (a `cd` into the dump persists); anchor
  EVERY command with `cd /d/ShadowCrystal/kaizo-knight-sim &&` (since the
  2026-09-02 split; knight-sim is the engine's home, not this work's).
- The Bash heredoc layer strips one level of backslashes: write JS patches
  without backslash escapes -- `String.fromCharCode(10)` for newlines and
  `new RegExp('...')` for patterns -- or write the script with the Write tool.
- `tools/diff-trace.mjs` and `run-trace.mjs` were no-ops on Windows until
  2026-09-02 (string-built `file://` entry guard). Any tool whose main() is
  guarded that way runs nothing here and exits 0. Grep for the pattern before
  trusting a green.
- The tracer runs TWO passes (sync/bolts, then the trace). Any per-frame
  instrumentation prints both; tag by pass, or read phantoms.
- `WATCH f=N` is the state after `stepFrame(N)` = trace row N; oracle row =
  N − 127 for `_tok3`. The recorder's seq row is end-of-frame AFTER motion
  (a bullet born with speed has moved once).
- A regen after any `sim/` edit (`tools/regen-fullfight.mjs`) or the vanilla
  gate reads stale.
- Every scr_* claim gets a whole-dump grep; filenames lie; `Other_N` numbers
  are per-object; `with()` and the step phase are newest-first.
- Harness emulations (`state.recorderTalkSkip`, `--keep-alive`, the
  guard-case flip) are keyed to the recorder, never to play.
- `scr_bulletparent_count()` counts BARE `obj_bulletparent` instances; the
  knight's attacks create none.
- "Self-ending" is `vcSelfEnding(row)` (an arm with a PINNER type); the
  armed clock is the arm's floor; the pin lands on the launch frame from the
  manager.
- A tracer replay with a SMALLER `--frames` than the recording is NOT
  aligned with the full run (its launches landed 40-90 frames later, twice
  read as evidence on 2026-09-02). Every KAIZO_TRAP / KNIGHT_PAIR_DEBUG /
  KAIZO_WATCH replay uses the regen's exact arguments or the full count.
- Do not patch `sim/` while a validation chain is running: its later steps
  import the tree when they start, and a mid-chain edit makes the chain's
  numbers describe two different code sets.
- `diff-kaizo-pair.mjs` on `%TEMP%/kaizo-fullfight/kaizo_oracle_*` compares
  the sim with ITSELF (those are the tracer's outputs under the oracle's
  naming); the tracked recording lives in `knight-research/kaizo-mod/
  fullfight/`.
- Commit only on the user's word; never publish EnderCat8's work.
