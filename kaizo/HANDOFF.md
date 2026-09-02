# KAIZO KNIGHT — transfer document

**For the session taking this over.** Written 2026-08-28 by the migration
session, at the user's request: *"start working on a KAIZO KNIGHT mode … a
different session will take over after you set everything up … keep it
separated enough from the knight sim infrastructure so nothing can go wrong
in the main sim, this is what the UNUSED thing will lead to."*

**2026-09-02, second session:** lever one is built and validated (STRATEGY §2a); the rotated-contact rule, gmlLt and the Destroy-event hook landed; the canonical gate: trace f2591 (ARENA/SOUL: the Multislash box shake), bullets f2672 (the slash fan's heading -- the unsolved ds_list_shuffle permutation) (tolerances on); probe fight trace f2043 (TURN/CLOCK: Tunnel 1's end; was f921 at the session's start), bullets f2100 (LIVE). Fronts: the Multislash box shake (stream position), the remaining delayed-tween sites, the Starstorm/Crescent draw-count tails (rendering RNG). Read the ledger section "The whole-fight RNG audit lands" for the receipts.

**Where 2026-09-02 ended:** canonical trace f2591, bullets f2672; probe fight trace f2043, bullets f2100; suite green. Three leads in the ledger's last addendum: the probe fight's two-frame talk gap (record it with the writer watch), Multislash 1's opening 8 u32 (the f2591 shake), the Tunnel draw burst (rendering RNG).

**2026-09-02, end of the long session:** canonical trace f3819 (ARENA gt_y) / bullets f3805; probe fight f2229; vanilla 60/60; kaizo suite green. Landed today, each measured: the writer sidecar and the
dialogue model (halt one frame later, auto-advance ON with its mash buffer,
balloons unskippable, the knight's own arm kills later balloons); the rotated
precise-mask contact rule (raw position, corner sampling, ceil-1 inverse, ten
receipts); gmlLt (GML `<` is epsilon-tolerant); destroy() runs Destroy events;
four RNG-count faults (live ds_list_shuffle burn, gmlShuffle's own extra draws,
the ac-5 finisher spawning the vanilla split box, the extended blade's Draw);
the slash ORDER replayed from the recording (kaizo/tools/derive-shuffle.mjs);
the kaizo phase read off the row instead of counted. The Draw-event RNG class
is CLOSED for the A-Side fight (ledger "The Draw-event RNG sweep").

Open fronts, in order: the canonical bullets sheet at f3805 (a fake tunnel
blade spawning at y 205.20 against 130.96 -- the stream position in THAT
fight, which has no draw probe, so the next step is a probe recording of the
canonical input feed); the canonical trace at f3819 (arena gt_y); the probe
fight at f2229, where the sim keeps an off-screen bullet one frame longer
than the game (identical cull thresholds, so the suspect is the view offset
under obj_shake -- the recorder does not watch it).

**2026-09-02, at the split into its own repo (kaizo-knight-sim):** canonical
trace f4252 / bullets f4238 -- the f3805 decoy and f3819 fronts above are
closed (ledger sections "Two faults at the tunnel's decoy", "Three more
intra-frame ORDER faults", "The Starstorm launch pads"). Everything below
that says knight-sim, "uncommitted", or "nothing wired into a page" is the
2026-08-28 state, kept as history; `CLAUDE.md` is current.

**Start with `kaizo/STRATEGY.md`** (2026-09-02): the metric, the instruments,
and the levers in order. Then this file.

Read `CLAUDE.md` first (its start-here order), then this file; the engine's
own handoff is `docs/engine/KNIGHT-SIM-HANDOFF.md`, on demand. Run the gates
(CLAUDE.md, "The one number") before touching anything.

---

## 1. State at handoff

- *(2026-08-28 state. Since 2026-09-02 the repo is `D:\ShadowCrystal\kaizo-knight-sim`,
  private, with knight-sim vendored under `sim/` -- see `docs/VENDOR.md`.)*
- Repo: `D:\ShadowCrystal\knight-sim`, `main` @ `247b1ba` ("Windows
  portability"), remote `github.com/Radi0Show/knight-sim` (public, in sync,
  Pages live at radi0show.github.io/knight-sim/web/).
- **All 60 main suites green on this machine** (`npm run verify`, judged by
  exit code — never by grepping output). The six whole-fight sim traces live
  in `D:\tmp\knight-fullfight\`; if they go stale, regenerate per the
  ShadowCrystal restore-state memory (four replay feeds only — `--shuffle
  --bolts --grazes --shards --keep-alive --slots 32`; **never `--slashes`**,
  it shifts the RNG stream; token via the `--token-file` shim, argv is too
  small on Windows).
- The Kaizo scaffold (§6) exists **uncommitted** in the working tree. Nothing
  is wired into any player-facing page. Commit when the user says to.
  *(Stale since 2026-08-29: the kaizo page landed under K8 -- `web/kaizo.html`
  + `web/kaizo.js`. After the 2026-09-02 split it is this repo's root page:
  `web/index.html` redirects to it and the manifest starts there.)*
- `~/knight-research` is a junction to `D:\ShadowCrystal\knight-research` —
  PRIVATE, never gets a remote, never published. All oracle material lives
  there.

## 2. THE ISOLATION CONTRACT (the user's one hard requirement)

Kaizo must not be able to break the verified sim. Concretely:

1. **Dependency direction is one-way.** `kaizo/` imports from `sim/`;
   nothing under `sim/`, `render/`, `input/`, `tools/` or the existing
   `web/` pages may import from `kaizo/`. The main health check must stay
   green with `kaizo/` deleted.
2. **`npm run verify` never sees kaizo.** `tools/verify-all.mjs` registers
   only `tools/verify-*.mjs`; kaizo suites live in `kaizo/tools/` and run via
   `npm run verify:kaizo`. Do not move them. Do not add kaizo rows to
   `SUITES`.
3. **No edits to `sim/` for kaizo's sake.** The standing repo rule is
   stronger than any convenience: *no change to `sim/` lands without a
   passing trace diff*. If kaizo needs a hook that `sim/` doesn't expose,
   prefer composition in `kaizo/` (wrap, don't patch). If a genuinely shared
   hook is unavoidable, it ships as its own change, oracle-verified, with
   the full 60 green — and only then does kaizo use it.
4. **Run `npm run verify` after every kaizo work block anyway.** Not because
   it should be able to break — because "should" is not a suite.
5. **Everything Kaizo is labelled.** The repo's law is *nothing invented
   ships unlabelled*. Kaizo is invented by definition; the player must see
   `KAIZO` and "NOT the real fight" wherever it surfaces (the scaffold's
   `KAIZO_NOTE` exists for this). The UNUSED attacks keep their UNUSED
   labels inside kaizo too.
6. When kaizo becomes player-visible: **bump the patch number in
   `web/version.js` AND the `CACHE` name in `web/sw.js`, same commit** — and
   commits carry **no Co-Authored-By trailer**, ever.

## 3. Why kaizo, and why the UNUSED attacks are the seed

knight-sim is a frame-accurate reimplementation of the vanilla Roaring
Knight fight (DELTARUNE ch. 3, v1.03 post-nerf), proven against recordings
of an instrumented copy of the real game. During that work, **seven attacks
were found in the game's code that the fight can never reach** — the
selector never assigns them. All seven are already translated, suite-covered
and offered in SINGLE mode labelled UNUSED:

| ac | name | module |
|---:|------|--------|
| 0 | Swordslash crescents | `sim/attacks/swordslash.js` |
| 3 | Sword tunnel (revised) | `sim/attacks/sword-tunnel-revised.js` |
| 4 | Knight stream (xattacks) | `sim/attacks/knight-stream.js` |
| 6 | Underbox orbs | `sim/attacks/underbox.js` |
| 7 | Combination (chains 10→5→3) | `sim/attacks/combination.js` |
| 10 | Swordfall | `sim/attacks/swordfall.js` |
| 20 | Knightlines spears | `sim/attacks/knightlines.js` |

None of these can ever have an oracle (the real fight cannot run them
outside debug), so their suites are positive-assertion only. **They are cut
content with nowhere to go in the authentic sim — kaizo is where they go.**
That is what the user means by "this is what the UNUSED thing will lead to."

The second ingredient: **higher difficulty variants of the live attacks are
real game content** the vanilla schedule underuses. Verified today: Stars
d2 (homing starchildren), Flurry/splitter d3, Sword Tunnel d3–d4, Rotating
Slash d1–d2. The vanilla fight only reaches most of those in phase 3.

## 4. The real-world "Kaizo Roaring Knight" mods — research briefing

*(Compiled from the user's web research notes, 2026-08-28. External facts —
version numbers and dates especially — should be re-verified against
GameBanana before being repeated anywhere public. The vanilla-fight numbers
in this section defer to OUR dump where they conflict with wiki lore.)*

**Culture.** The Knight is ch. 3's final boss. In vanilla you don't kill it:
the phase-4 gate opens at HP ≤ 80% of 7300 (the fight's one real number,
5840), ROARING plays, and the fight ends on the next landed hit. Mercy is
crossed out; the Shadow Mantle is near-mandatory. Because the Knight only
"wins" in cutscenes and the real fight becomes consistent once learned, the
fandom nicknamed it the **"Roaring Fraud"** — and the Kaizo mod's tagline is
a direct answer: *"For all the people who called them 'Roaring Fraud'."*

**The main mod: Kaizo Roaring Knight**, by **EnderCat8** (a.k.a. cosmocat8),
on GameBanana (Difficulty Changes category):

- A heavily buffed rebuild of the fight using **unused, original, and
  revamped attacks** — the same "unused" pool our sim has already
  translated — plus a Knight recolor.
- **Two distinct fight variants**: a Normal Route version and a Weird Route
  (Snowgrave) version, which players call the **"B-Side."**
- Phased structure with a distinct long final attack (players describe a
  long final spiral); the box-splitter attacks are randomized and widely
  hated.
- **Version history** (approximate): pre-release builds circulating
  Dec 2025; 2.0 (spring 2026) was the big new-attacks update; then 2.2,
  2.3, 2.3.1, 2.3.2 through mid-2026 — roughly ten updates, and it got
  **harder** with each patch, not easier. A no-hit run of 2.3.2 reportedly
  took 8 days / 700+ attempts. Any video of "the Kaizo Knight" may not match
  the current download.

**Spin-offs / rivals** (separate uploads, different authors):

- *Kaizo Roaring Knight Nerfed* — Nexus Mods #49; same fight, lower damage;
  credits EnderCat8.
- *Kaizo Knight with FireShock* — moonwirer, GameBanana 697132; adds a
  mechanic.
- *Violet Roaring Knight* — GameBanana 700909; harder + violet recolor.
- *Roaring Knight: Berserk* — CCGaming, GameBanana 657995; unrelated
  challenge mod (flagged for sensitive content on GB).
- *Easier Roaring Knight Patch* — RaTT107, GameBanana 599232; the opposite
  direction.

**How the real mods install** (relevant to §5-C): DELTARUNE is GameMaker, so
mods ship as **xdelta patches against a specific version's `data.win`**
(ch. 3's lives at `steamapps/common/DELTARUNE/chapter3_windows/data.win` —
on this machine, under `D:\SteamLibrary`). Patches are version-locked; a
game update breaks them. Deltamod is the community loader. On Mac the data
file is `game.ios` and patching is a translation-layer affair — irrelevant
now that we're on Windows, where everything is native.

## 5. OUR Kaizo — design space (multiple versions, like the mods)

Three lanes, in order of fidelity honesty. The version registry in
`kaizo/scenes/kaizo-fight.js` (`KAIZO_VERSIONS`) is where variants hang.

**V-A — "KAIZO: AUTHENTIC"** *(scaffolded, build this first)*
Only content that exists in the real game's code: the seven UNUSED attacks
plus max-difficulty variants of the live ones, in an invented, denser
schedule. The fidelity claim stays clean: *verified/authentic attack
engines, invented schedule* — the label already in `KAIZO_NOTE`. Difficulty
knobs that are still real-game content: attack `difficulty` values, per-turn
`invc` (invulnerability multiplier), `damagereduction` ramp, turn density,
phase-4 entry timing. The draft `KAIZO_TABLE` in the scaffold is a starting
proposal, not a decision — its one hard rule is enforced by the smoke gate:
**no row may exceed the difficulty a suite verifies** (raise the cap only
together with the suite that pins the new value).

**V-B — "KAIZO: B-SIDE"** *(later, with the user)*
Invented and revamped content in the spirit of the mods' B-Side: layered
simultaneous attacks, modified bullet parameters, new patterns composed from
verified pieces. Everything here is deviation by design — bigger labels,
its own suites, and user sign-off on the design before build.

**V-C — "KAIZO: ORACLE"** *(optional future — recreating EnderCat8's mod 1:1)*
The full methodology transfers: obtain the mod's xdelta, patch a copy of the
Windows `data.win`, dump the patched file with UndertaleModTool (native
Windows build; the CLI stdin trap still applies — solo runs, `< NUL` when
redirecting), diff the GML dump against vanilla to isolate the mod's
changes, and oracle-record it with the patch templates in
`knight-research/tools/patches/`. Two hard gates before anyone starts:
1. **The mod's data.win, dumps, and traces go in `knight-research` ONLY**
   (private, no remote) — the public-repo asset policy forbids data.win/GML
   dumps/oracle builds in public repos, and that applies doubly to someone
   else's mod.
2. **Shipping a recreation of EnderCat8's fight publicly needs their
   permission and credit.** Mechanics aren't copyrightable, but a 1:1
   recreation of a named mod is their creative work. Ask the user; the user
   asks the author. Until then V-C material stays private research.

## 6. What exists today, and the two gates

**2026-09-02 (split):** the gates are now `verify:kaizo` (the suite),
`regen:kaizo` + `verify:fullfight` (the byte gate) and the vendored engine's
`verify` -- see CLAUDE.md "The one number". The paragraphs below are the
2026-08-28 state.

**Updated 2026-08-28 (K3 session): the schedule is LIVE.**

```
kaizo/
  HANDOFF.md                 this file
  scenes/kaizo-fight.js      KAIZO_NOTE, KAIZO_TABLE (v-A, running), KAIZO_VERSIONS,
                             buildKaizoScene() — builds the kaizo turn loop on
                             the version's table, stamps state.kaizo
                             (scheduleActive: true, launched: [] — the ledger)
  scenes/kaizo-practice.js   THE KAIZO TURN LOOP — a kaizo-owned copy of
                             sim/scenes/practice.js, table-parametrized
                             (generated by a transform script; its header
                             lists every difference exhaustively). Copied, not
                             composed: the practice director reads the fight
                             table lexically and is module-private, so
                             composition could not inject a schedule — §2's
                             sanctioned fallback. Keeps entity names
                             fight_director/turn_clock (clearTurn's keep-list
                             sweeps anything else).
  tools/verify-kaizo.mjs     the kaizo gate — `npm run verify:kaizo`
```

Plus one line in `package.json` (`verify:kaizo`). **Both gates verified green
after K3, in this order:** `npm run verify:kaizo` (exit 0) and then the full
`npm run verify` (60/60, exit 0) — the main sim undisturbed, `git status`
showing nothing outside `kaizo/` touched. All of it is uncommitted.

The gate now asserts (~130 assertions): table shape (every row a known attack
at a suite-verified difficulty cap); determinism (same seed byte-identical,
different seed different, pulsed-confirm input); the **fight-order analog** —
`state.kaizo.launched`, the turn loop's launch ledger, matches KAIZO_TABLE
row for row across phases 1–3, no turn hangs, every turn puts bullets on
screen, every label carries the KAIZO prefix; the **phase-4 gate analog** —
HP driven to 5840 opens phase 4 on the rotating slash, runs Charge-up then
ROARING, falls back into phase 3 at the frozen-phaseturn resume position, and
never re-enters; and the **coverage analog** — every unique (ac, difficulty)
the table schedules connects against a circling soul (contact-coverage
pattern) and carries real damage (verify-damage pattern; the stream diamonds'
placeholder 10 is the dump's own number and is exempted with citation).

## 7. Task list (in order)

- **K1 — Orient. DONE 2026-08-28.** Both gates were green before and after.
- **K2 — Study the schedule machinery. DONE — question answered:**
  `launchAttack` in `sim/scenes/fight.js` dispatches ALL seven UNUSED acs
  directly (cases 0/3/4/6/7/10/20 sit in its switch alongside the live
  ones — SINGLE mode uses the same path). So kaizo needs no low-level
  launcher of its own; it imports `launchAttack`/`openArena`/`clearTurn`/
  `turnLength`/`phase4Entry` (one-way, legal) and owns only the schedule
  WALKER. What could not be reused: the practice director itself (private,
  reads the fight table lexically) — hence the K3 copy.
- **K3 — Make `buildKaizoScene` consume `KAIZO_TABLE`. DONE 2026-08-28.**
  `kaizo/scenes/kaizo-practice.js` is the kaizo copy of the practice turn
  loop (per-table director; generalized nextTurn; phase-length literals read
  the table; KAIZO-prefixed labels; launch ledger). `scheduleActive: true`.
  `verify-kaizo.mjs` grew the fight-order, phase-4-gate and damage/contact
  coverage analogs — see §6. Known design note carried into K4: ac 20
  (Knightlines) keeps the dump's 90-frame clock, so its in-fight turn ends
  before the spear volley fully lands (exactly what the real fight would
  do); whether kaizo WANTS a longer knightlines turn is a K4 taste
  question, and lengthening it would be an invented number — label it if
  taken.
- **K4 — Difficulty pass on v-A with the user playing.** Turn density,
  invc, damagereduction ramp, phase pacing. Kaizo tuning is taste — get the
  user's.
- **K5 — Web wiring, as a separate page. DONE 2026-08-29** (`web/kaizo.html`
  + `web/kaizo.js`; since the 2026-09-02 split the page is this repo's root and
  registers its own service worker). The spec as written: `web/kaizo.html` + a kaizo
  driver importing `kaizo/scenes/`, big KAIZO labelling, seed + `?cfg=`
  support namespaced so `verify-share`'s round-trip is untouched. The main
  page gets at most a labelled link. This is the zero-regression wiring:
  the existing page's code paths don't change.
- **K6 — Ship gate.** When it goes live: version bump in `web/version.js` +
  `CACHE` in `web/sw.js` (add the new page to the precache list), same
  commit; no trailer; both verifies green; commit/push only on the user's
  word.
- **K7 — (later, user-driven) V-B design doc**, then build.
- **K8 — V-C oracle recreation: IN PROGRESS (user-directed, 2026-08-28).**
  The user obtained Kaizo Roaring Knight v2.3.3; it is patched, dumped and
  diffed in `knight-research/kaizo-mod/` (NOTES.md there is the ledger).
  DONE so far:
  - `kaizo/versions/vc-script.js` (GENERATED, publish-gated — see its
    header): the mod's 28-struct fight script, extracted from its own
    decompiled Other_24. `kaizo/tools/gen-vc-script.mjs` regenerates it.
  - `kaizo/scenes/kaizo-mod-launcher.js`: the mod's dispatch (Other_23),
    both Normal and B-Side, reorganized by controller type over the
    VERIFIED sim modules. Unimplemented difficulty branches are CLAMPED and
    recorded in `state.kaizo.approx` — the ledger IS the work queue, and
    verify-kaizo prints it. `kaizo/scenes/kaizo-vc-hooks.js`: the mod's
    schedule semantics (nextAttack chain, 60% gate with dynamic phase-4
    entry via the live `kaizo_phase4` var, AfterFinal resume-REPLAY, DR
    ramp 0.18 + 0.004/turn then +0.05 in the final stretch, DF 5,
    post-ROARING kaizo_block until 40%).
  - The turn loop grew VERSION HOOKS (kaizo-practice.js) — hookless builds
    are byte-identical, V-A untouched.
  - Versions C (Normal) and D (B-Side) registered; `web/kaizo.html?v=C`.
  - ONE sim/ fix fell out, oracle-verified per §2.3: rotating-slash's
    CleanUp translated `scr_bulletparent_count() < 2` as "alive bullets
    < 2" — the real script counts EXACT obj_bulletparent instances (none
    exist in the knight fight, so the test is always true; underbox.js
    already documented this). All 60 suites + six byte-exact whole-fight
    diffs green after (traces regenerated — the staleness guard fired as
    designed).
  - A standalone playable copy of the REAL mod: `D:\ShadowCrystal\
    kaizo-game\PLAY-KAIZO.bat` (Steam install untouched; saves backed up
    to knight-research/save-backup-20260828-kaizo).
  **ATTACK TRANSLATIONS — 7 WIRED, checks enforced by the gate.**
  `kaizo/attacks/` holds kaizo-owned copies of the verified sim modules with
  the mod's deltas applied; each ships `kaizo/tools/checks/check-<name>.mjs`
  (positive assertions on the branches it adds), and `verify-kaizo` runs all
  of them — a module in its WIRED set MUST pass, an unwired one is reported
  as work-in-progress and not enforced. Wired today:

  | module | controller type | difficulties now exact |
  |---|---|---|
  | tracking-swords | 151 | 0,2,3,3.1,4,5,6,6.1,7,7.1,7.2,8,10,11 |
  | stars (4 files) | 98 | 0,1,2,3,3.1,3.2,3.3 |
  | rotating-slash | 104 | 0,1,2,8,10 |
  | flurry (5 files) | 99 | 0,1,2,3,5 |
  | knight-stream | 103 | (no difficulty axis) |
  | sword-vortex | 154 | 0,3,3.1 |
  | underbox | 106 | 0 (variant is by ac: 101/102/102.1) |

  That took the approx ledger from **25 rows to 6** over the full 27-turn
  chain. The ledger IS the work queue and the gate prints it.
  Cross-module seam wired: the B-Side ac-111 rotating slash ends its turn by
  freezing the vortex's blades (`kaizoVortexendFreeze`, passed as
  `state.kaizo.hooks.vortexendHandoff` in buildKaizoScene).

  **UPDATE — ALL 12 ATTACK MODULES ARE NOW WIRED**, each with a passing
  check the gate enforces: the seven above plus swordfall (108 @
  0,1,5,10,11), knightlines/PierceBlades (101), sword-tunnel (153 @
  0,3,4,4.1,10,11), quickslash (the mod-only types 1001 and 97.1 — the
  chain loops back to it every lap) and roaring-final (107, the ac-104
  finale). The approx ledger is down to **3 rows**: the ac-106 combination
  chain (1-2-5 vs the vanilla 4-2-3) and a Side-B vertical splitter.

  **SPRITES.** `kaizo/assets/sprites/` is a 43-sprite OVERLAY built by
  `kaizo/tools/pack-kaizo-sprites.mjs` and merged into `renderer.sprites`
  by web/kaizo.js (render/ is main-page code and must not learn about
  kaizo/). 32 entries are vanilla-sourced, 11 are EnderCat8's own art and
  are PUBLISH-GATED by `kaizo/assets/.gitignore`; `check-sprites.mjs`
  proves the gate by asking git itself, and proves every sprite named
  anywhere in kaizo/ resolves — a missing one is otherwise invisible,
  because the renderer silently falls back to drawing collision masks.
  The same tool emits `kaizo/data/masks.js`, importable real masks, which
  settled two live hitbox bugs: the soul's shrunken mask is a PRECISE
  heart (bbox [4,4,15,15]) and swordfall had been using a different
  sprite's axis-aligned rect; and the quickslash marker is a SIX-pixel
  band, not the 1px row that stood in — at the mod's yscale 0.4 that is
  the difference between connecting and never registering.

  **THE KNIGHT IS BLUE.** `kaizo/attacks/kaizo-colors.js` is the one
  palette (GameMaker colours are BGR — the dump's 16711680 is pure blue,
  and reading it as RGB inverts the whole re-theme), and
  `kaizo/actors/kaizo-knight-actor.js` wraps the verified actor to add the
  mod's always-on 7-colour rainbow afterimage trail.

  **THE WEIRD ROUTE (V-D) IS KRIS + NOELLE.** `kaizo/party/` holds the
  roster, Noelle (120hp/5at/13mag/1df, charId 4, her `_sideb` sprite set),
  a roster-driven damage copy, heroes, the k_freeze mechanic, the GLOOM
  DoT, the B-Side TP clamp, and `WEIRD-ROUTE.md` — a sourced inventory of
  everything the B-Side changes. Entry is not a toggle: `k_sideb` reads
  global.flag[456], the game's own Snowgrave flag.

  **THE PARTY-SIZE TRAP, worth reading before touching any of it:** the
  game keeps THREE slots and leaves the spare EMPTY (`global.char =
  [1, 4, 0]`). Size the slot arrays to the roster instead and every
  vanilla-shaped consumer breaks quietly — sim/damage.js's `isUp` reads
  `!chardead[slot]`, so an absent slot returns `!undefined` = STANDING,
  takes targeting rolls, and receives damage. buildKaizoScene pads slot 2
  as dead + untargetable, which is what the original data looks like.

  **THE UNUSED BUTTON OPENS KAIZO (2026-08-29).** The title screen's
  SETTINGS hub had a reserved row called UNUSED that played the error sound
  and did nothing — and the name was never decoration, since the seven
  attacks the real selector can never reach are labelled UNUSED wherever the
  player meets them. Confirming it now opens the Kaizo page.

  It is a NAVIGATION, not an import, which is what keeps §2 intact: `sim/`
  returns an intent (`out.kaizo`, exactly as SHARE returns `out.share`) and
  the driver does `window.location.href = new URL('./kaizo.html',
  import.meta.url)`. The main page still imports nothing from kaizo/ and
  still builds with kaizo/ deleted — the link simply has nowhere to go.
  `render/title.js` also stops drawing the row DIM, since grey is the menu
  convention for "this does nothing" and it now does something.

  THE TRAP THAT COST A DEBUG CYCLE, pinned by a new sabotage-tested
  assertion in `tools/verify-titlemenu.mjs`: `stepTitle` rebuilds the
  settings result from a WHITELIST of fields, so `out.kaizo` was set
  correctly inside `stepSettings` and silently dropped on the way out. The
  row reported `selected`, the driver saw nothing to act on, and the button
  looked dead while every test of `stepSettings` itself would have passed.
  A new intent must be added to that whitelist as well as to the handler.

  **THE KNIGHT IS BLUE BECAUSE THE MOD REPLACED THE ART (2026-08-29).**
  The single most important thing learned about this mod's look: its visual
  identity is REPLACED SPRITES, not code. It overwrites **57 sprites in
  place** — the Knight's whole set (idle, hurt, front, fly, block, attack,
  roar, sword, arm), his bullets (crescents, diamonds, teeth, stars, the
  flow sheets) and the tension bar — keeping every NAME identical. His idle
  averages RGB (93,93,93) in vanilla and **(211,221,255)** in the mod.

  NO CODE DIFF CAN SEE THIS. Both dumps assign the same sprite name, the GML
  is byte-identical at the assignment, and every check that reads code stays
  green. It was found by extracting the same 254 names from BOTH data files
  and byte-comparing the PNGs — which `kaizo/tools/pack-kaizo-sprites.mjs`
  now does on every run, so the set derives itself and cannot go stale as the
  mod updates. `check-sprites.mjs` asserts both halves: that the packer
  CLASSIFIED them as replacements, and that the bytes really differ from the
  main pack (comparing EVERY frame — one sprite is repainted only on a later
  frame, and a frame-0 comparison reported it as a false positive).

  Related, and also worth keeping: one vanilla sprite
  (`spr_dodgeheart_smallmask`) is ABSENT from the mod's build — the mod is
  built on v0.091 and that sprite arrived later. "No kaizo frames" therefore
  means base-version gap, not replacement, and the packer says so.

  **A SERVICE-WORKER BUG THAT MADE THE KAIZO PAGE LOOK BROKEN.** `web/sw.js`
  answered EVERY failed navigation with `./index.html`. That is the right
  reflex for a single-page app and wrong the moment the site has two pages:
  a request for kaizo.html that failed — flaky connection, slow dev server,
  offline — silently rendered the VANILLA title screen with the URL still
  saying kaizo. It presented as the tab flipping between the two pages and
  as "spurious navigation", and it wasted a debugging pass chasing a phantom
  keypress. The shell may now only stand in for the root/index; any other
  uncached page gets an honest 503. `CACHE` and `web/version.js` bumped to
  1.0.3 in lockstep, per the repo's versioning rule.

  **THE TWO FILES OUTSIDE kaizo/.** §2.1 says kaizo may not edit sim/,
  render/, input/, tools/ or the existing web/ pages. Two exceptions exist
  and both are recorded rather than quiet:
    * `sim/attacks/rotating-slash.js` — the scr_bulletparent_count
      correction, oracle-verified (60 suites + six byte-exact whole-fight
      diffs) and vanilla-neutral. §2.3's escape hatch, used as written.
    * `render/menu.js` — the charbox row hardcoded three panels and the
      vanilla name/HP tables, so the Weird Route drew Noelle's HP under
      Susie's portrait. It now reads OPTIONAL `state.partySprites` /
      `state.partyMaxhp`, defaulting to the old tables. render/ still
      imports nothing from kaizo/ — a plain state field is not a
      dependency — and the main page was re-checked in the browser and is
      unchanged.

  PREVIOUSLY IN FLIGHT: swordfall (check failing on 3 assertions), knightlines
  (fractional `irandom_range` bounds — the mod really does call it with
  reals; needs a documented kaizo-local model, draw count must stay 2),
  sword-tunnel / quickslash / roaring-final (modules written, unverified,
  no checks yet). Quickslash is the priority — the mod's chain LOOPS back
  to it every lap, so it is the most-played attack in the fight.
  THEN: oracle-record the real mod (the kaizo-game copy is the
  instrumentation target) and diff frame-exact.
  PUBLISH GATE unchanged: nothing V-C ships publicly without EnderCat8's
  permission.

## 8. Traps that will bite kaizo specifically

All documented in `CLAUDE.md` — these are the ones kaizo work is most likely
to re-trigger: alarms are not step counters (one-frame cost); anything
random in a Draw must be a pure function of the sim frame (the 30Hz vs
monitor-Hz "more intense in the sim" bug); `e.depth + N` with an unassigned
base is NaN and silently scrambles draw order; a bullet that never
`scr_bullet_inherit`s doesn't look broken, it looks weak (damage 10→1); GML
`==` on accumulated reals needs `gmlEq()`; engine-owned fields (`type`,
`alarm`, `depth`, …) collide with GML instance variables — rename on
translation. And the meta-trap: **a green suite means "nothing broke", not
"my change did something"** — verify kaizo behaviour by running it and
reading state, then pin it with a positive assertion.

## 9. Pointers

- Workspace model: `D:\ShadowCrystal\WORKSPACES.md` (one repo = one
  session; kaizo work happens in sessions opened at
  `D:\ShadowCrystal\kaizo-knight-sim` since the 2026-09-02 split; the vendored
  engine's home is `..\knight-sim`).
- Assistant memory (auto-loaded per project): the ShadowCrystal restore
  state, the fullfight-regeneration pitfall, the private-repo and asset
  rules, versioning and trailer rules, UTMT stdin trap.
- The user's standing rules, verbatim priority: research repos never get
  remotes/pushes; no data.win/GML dumps/oracle builds in public repos
  (extracted audio+sprites are cleared); verify by exit code; no
  Co-Authored-By; version.js+sw.js lockstep.
