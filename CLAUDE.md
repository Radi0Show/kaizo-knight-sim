# CLAUDE.md — Kaizo Knight Simulator

## What this repo is

A recreation of EnderCat8's **Kaizo Roaring Knight** mod (v2.3.3) toward
one-to-one fidelity with the real mod, using the knight-sim method: patch the
player's own copy into an oracle recorder, record the fight frame by frame,
diff the sim against the recording as exact text (bullet position, angle and
speed within the micro-tolerances `CELL_TOL` declares). **Private repo. The mod is
not ours; nothing here is published, and the research repo never gets a remote.**

Split out of `knight-sim/kaizo/` on 2026-09-02. The engine under `sim/`,
`render/`, `input/`, `assets/` and `tools/` is a **vendored snapshot** of
knight-sim (`docs/VENDOR.md` says which). `kaizo/` and `web/` are this repo's
own.

## Start here, in this order

1. `kaizo/STRATEGY.md` — the metric, the instruments, the levers in order.
2. The ledger: `~/knight-research/kaizo-mod/ORACLE-GROUND-TRUTH.md` — **read
   its last few sections, not all of it.** Every measured fact with its receipt.
   Append to it; it is the findings record.
3. `kaizo/HANDOFF.md` — history, the isolation contract, the mod briefing.
4. Run the gates (below) before touching anything.

**Do not read the engine docs up front.** `docs/engine/` holds knight-sim's
CLAUDE.md, HANDOFF, ORACLE-RECIPE, VERIFICATION, WINDOWS and BUILD as
reference copies, and `docs/PLAYBOOK.md` is the distilled method. They are
large and vanilla-specific. Open them when a question actually needs them:
the RNG model, the epsilon rules, float32 built-ins, the oracle recipe, the
Windows notes. The laws that apply every day are restated below, short.

## The one number

```
npm run verify:kaizo       # the suite (exit code is the verdict)
npm run regen:kaizo        # the whole-fight sim trace, EVERY replay feed
npm run verify:fullfight   # the byte gate: 21 trace columns exact; bullet slots within
                           # CELL_TOL (kaizo/tools/verify-kaizo-fullfight.mjs)
npm run verify             # the vendored ENGINE's 60 suites -- an integrity check
                           # of the copy under sim/, not this repo's metric
```

The metric is the byte gate's **first divergence frame** against the tracked
recording `_tok3` (`~/knight-research/kaizo-mod/fullfight/`). On 2026-09-03
it stands at **bullets f6631, trace f6631** — both fronts on the same frame,
inside atk_Tunnel2. Everything else is derived.

Two instruments answer questions this number cannot, and both are worth
reaching for before theorising:
- `kaizo/tools/read-draw-layout.mjs` inverts recorded per-frame randoms back
  into stream indices, so the recording reads out the GAME's own draw order and
  per-frame draw counts.
- `kaizo/tools/check-turn-boundaries.mjs` compares every turn boundary in the
  recording, including the ones past the front, which the first-divergence
  metric structurally cannot see.

Judge every npm run by **exit code**, never by grepping output.

## Laws (inherited from knight-sim, still binding)

1. **Read the dump before launching the game.** A grep is seconds; a whole-fight
   recording is minutes (the recorder budgets Frames/30 + 20 s; about five for
   the 9000-frame default). The dumps: `~/knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries`
   and `gml_vanilla_v105/CodeEntries`.
2. **Never pin a value the game sequences itself with** (`mnfight`,
   `turntimer`, `myattackchoice`). Grep for readers first.
3. **Instrument before theorising.** A front falls in minutes when the
   recording gives you a number to match and in hours when you reason from
   the GML. Build the instrument first (STRATEGY §1).
4. **Nothing invented ships unlabelled.** Everything kaizo is labelled KAIZO
   and "NOT the real fight" wherever it surfaces.
5. **A green suite does not mean a change took effect.** Sabotage it.
6. **Never hand-edit the vendored engine.** A fault that belongs to `sim/` is
   fixed in `../knight-sim`, proven against its 60 suites, and re-vendored
   with `npm run vendor:engine`. If a fix must land here first to keep the
   gate moving, port it back the same day and list it under
   `docs/VENDOR.md` "Pending port-backs".
7. **No `data.win`, `game.ios`, GML dumps or oracle builds in this repo**,
   private or not. They live in `~/knight-research` (a junction to
   `D:\ShadowCrystal\knight-research`), which never gets a remote.
8. **Commits carry no Co-Authored-By trailer.** Commit only on the user's word.
9. **Player-visible changes bump `web/version.js` and `CACHE` in `web/sw.js`
   in the same commit.** The cache prefix is `kaizoknight-`; knight-sim's is
   `blackknife-`. Each worker deletes only its own prefix. Keep it that way.

## Measured facts you will need (details in docs/engine/KNIGHT-SIM-CLAUDE.md)

Each line says whether it is the GAME's behaviour or THIS ENGINE's; the two
differ in places on purpose, and the compensations only make sense if you
know which is which.

- **GML RNG:** WELL512; `random`/`random_range`/`choose` = 1 u32,
  `irandom`/`irandom_range` = 2, `randomsign` = 2, `ds_list_shuffle` = exactly
  16 u32 per element. `choose` picks `values[u32 % argc]` (parity only for a
  two-element list) — a reversed list draws the same u32 and gives the wrong
  answer, invisibly to any count audit.
- **Harness, not GML:** the ORACLE PATCH (`oracle_kaizo_fight.csx`) prepends
  `random_set_seed(seed + spawnn*1000)` to `scr_bulletspawner` on every call,
  and the sim mirrors it (`reanchorRng` in `sim/scenes/fight.js` and
  `kaizo/scenes/kaizo-mod-launcher.js`). The real mod's stream is continuous;
  report results as "mechanics one-to-one, RNG re-anchored per launch".
- **GML evaluation:** call arguments evaluate right-to-left; `==` and `<` on
  reals are epsilon-tolerant (`gmlEq`, `gmlLt`); `round` is half-to-even;
  built-ins narrow to float32.
- **GML event order:** alarms run before Steps. The runner's STEP phase walks
  newest-first; its ALARM phase walks by OBJECT INDEX
  (`sim/data/object-order.js`) — and object index was measured to decide the
  heart's last frame (battlecontroller 1393 before heart 1462).
- **This engine's order:** the step phase walks OLDEST-first here
  (`state.stepNewestFirst` is off — switching it on moved the gate from f1215
  back to f449, STRATEGY §5) with hand-fitted `stepOrder` keys; only the alarm
  phase applies object index. Every "pre-step" compensation exists because of
  that gap: `state.soulPrev` is the soul's frame-start position, read at the
  sites the recording proved (the tunnel volley, the rotating slash aim, the
  older tunnel's probe) — apply it per site, with a receipt, never blanket.
- **Creation frame:** a Draw event runs on the instance's creation frame; in
  this engine an entity spawned during the step phase (or later in the frame)
  first steps the NEXT frame, while one spawned in beginStep or an alarm steps
  this frame. A counter incremented in a Draw is therefore one frame ahead of
  one incremented in a step — the tunnel's `siner` was exactly that.

## Machine facts

- `~/knight-research` is a junction to `D:\ShadowCrystal\knight-research`. Every
  tool finds the oracle through `os.homedir()`; breaking it breaks every gate.
- The recorder: `knight-research/kaizo-mod/tools/run-kaizo-oracle.ps1` (run
  with `powershell -NoProfile -ExecutionPolicy Bypass`). Its patch is
  `tools/patches/oracle_kaizo_fight.csx`. UTMT CLI runs solo, with `< NUL`.
- Sim traces land in `%TEMP%/kaizo-fullfight/` (`KAIZO_SIM_OUT` overrides).
- `core.autocrlf` is true system-wide; this clone sets it false locally, and
  `.gitattributes` pins `* text=auto eol=lf`, which wins for text files either way.
- **A fresh clone has no `kaizo/assets/sprites/`** — that overlay is publish-gated
  by its own `.gitignore` (EnderCat8's art). Regenerate it with
  `node kaizo/tools/pack-kaizo-sprites.mjs` before the gates; `verify:kaizo`'s
  check-sprites hard-exits without it.
- Dev server: `npm run serve` on **8178** (knight-sim uses 8177 — a different
  origin, so the two never share a cache or a settings key locally).
- One repo = one session (`D:\ShadowCrystal\WORKSPACES.md`). Open sessions
  here, not at the umbrella.

## Working method (the short form)

Measure, don't reason. Every change is validated by the full chain — the
kaizo suite, `regen:kaizo`, the byte gate, and the vendored engine's suites —
and reverted with a receipt at the site when a gate moves backwards. Bank
every landed fact in the ledger with its measurement. Scratch scripts live in
the session scratchpad, never in the repo.
