# Kaizo Knight Simulator

**Private.** A frame-accurate browser recreation of EnderCat8's *Kaizo Roaring
Knight* mod (v2.3.3) for DELTARUNE Chapter 3, built on the
[knight-sim](https://github.com/Radi0Show/knight-sim) engine and proven the
same way: the player's own copy of the mod is patched into an "oracle", the
fight is recorded frame by frame, and the sim is diffed against the recording
as exact text (bullet position, angle and speed within the micro-tolerances
`CELL_TOL` declares).

**NOT the real fight**, and not ours to publish: the mod is EnderCat8's work
and this repo stays private. The game is by Toby Fox and the Deltarune Team.

- `CLAUDE.md` -- how to work here (read first)
- `kaizo/STRATEGY.md` -- the metric and the instruments, in leverage order
- `kaizo/HANDOFF.md` -- the history and the isolation contract that made the split possible
- `docs/PLAYBOOK.md` -- the method and trap catalog inherited from knight-sim
- `docs/VENDOR.md` -- which knight-sim the engine under `sim/` is

```
npm run verify:kaizo      # the suite
npm run regen:kaizo       # regenerate the whole-fight sim trace, all feeds
npm run verify:fullfight  # the byte gate against the tracked recording
npm run serve             # http://localhost:8178/web/
```
