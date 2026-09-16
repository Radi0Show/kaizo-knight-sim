# VENDOR.md -- which knight-sim this engine is

Written by kaizo/tools/vendor-engine.mjs. sim/, render/, input/, assets/ and
tools/ are a snapshot of knight-sim; never hand-edit them here (see the
script's header and CLAUDE.md).

- source: D:\ShadowCrystal\knight-sim
- commit: d16db14502e3aca28af840a01728ed9dcdfc7cf4
- vendored: 2026-09-16
- the mirrored directories were clean in the source tree

## Pending port-backs

**2026-09-12 — EIGHT OF THESE ARE NO LONGER PENDING. THEY LANDED.** The
snapshot above is knight-sim `32d7a30` (v1.0.49), which is `origin/main`, and
it CARRIES every stand-in described below: `kaizo-gloom-seams` (2137c01),
`kaizo-colour-seams` (08ea0db), `kaizo-menu3-seams` (7f9d1c3),
`kaizo-lane3-seams` (1973836), `kaizo-party-seams` (4d4571b),
`kaizo-items-seams` (118f0e3), `kaizo-lane2-seams` (5a8d355) and
`kaizo-gameover-seams` (74c87b1), merged in dependency order with knight-sim's
63 suites green after each. The eight branches each carried their own bump —
three separate v1.0.43 and two v1.0.47 — so the merges took either side on
`web/version.js` and `web/sw.js` and one final commit set v1.0.49 with `CACHE`
in lockstep. Every stand-in file this repo held was byte-identical to the
merged result before the re-vendor, so the mirror changed no engine byte the
gate can see, and the gate says so: `_tok3` trace AND bullets byte-exact
(12637 / 13001 frames), `_rev1` still first diverging at trace f12492 /
bullets f12499. The entries below are kept as the record of WHY each seam
exists; they are history now, not a to-do list.

**`kaizo-lane4-seams` (2f3e932) IS NOT IN THAT RELEASE, and this repo's
`sim/spells.js` is deliberately WITHOUT it.** It was merged, vendored and
judged on the gate, and it regressed `_rev1` from trace f12492 to **f8729**
(bullets f12499 to f8743) — 3,763 frames lost. The first group is TURN,
column `mnfight`: at f8729 the oracle leaves the menu and the sim does not,
so the turn never launches and the recorded input feed is playing into a menu
with a different shape. That is the same measurement its author took before
reverting it the first time, and it is the same verdict: a recording of the
real game outranks a GML reading. `_tok3` is unaffected (byte-exact either
way) because it is a ONE-CHARACTER fight and never opens a partner's ACT row.
The branch is intact in knight-sim and unmerged; re-landing it needs the
recording re-read, not a re-merge.

**`sim/damage.js`, `sim/items.js`, `sim/spells.js` and `sim/dmgnumbers.js` are
AHEAD of the snapshot above — labelled stand-ins.** 2026-09-12, lane A (the
party is N members). The four files here are verbatim copies of

    knight-sim  branch `kaizo-party-seams`  commit 0e23bbf  ("v1.0.46: the
    party is N members, and max HP has ONE reader")

committed in knight-sim but **not yet merged to its main**, so
`npm run vendor:engine` would roll them back until it is.

What they add is FOUR accessors exported from `sim/damage.js`, over ONE
optional state field that this repo already publishes:

    state.kaizo.roster       [{ name, maxhp, at, magic, df, gear? }], one
                             entry per OCCUPIED slot, in slot order —
                             written by `installRoster` (kaizo/party/roster.js)

    partyTable(state)        the table in force: the roster, else the
                             hardcoded PARTY literal
    partySize(state)         partyTable(state).length — never assume 3
    partyMemberAt(state, s)  slot -> stat record
    partyMaxhp(state, s)     THE one max-HP read: state.partyMaxhp first
                             (the live, mutable mirror the HP-cut scene
                             moves), then the record

A neutral `state.partyStats` in front of the roster was written first and
thrown away: nothing anywhere writes it, and a read facing no writer is this
repo's signature defect wearing the other hat. One field, one writer.

**EQUIPMENT IS NOT PART OF THE SEAM, deliberately.** `gearOf` answering from
the roster was written, measured and backed out: the roster's measured loadout
(`GAMESTART_CH3_GEAR`) has no ShadowMantle on Kris where `DEFAULT_GEAR` does,
so the Weird Route party then falls at row 4 of its own 27-row chain
(check-weirdroute, measured). The stat BASE is roster-driven; the gear is a
separate sourced question that `roster.js`'s `GAMESTART_CH3_GEAR` note frames
and that this seam does not settle. `check-party-seam.mjs` pins the split in
both directions so it cannot be closed by accident.

`PARTY`, the three-entry KRIS/SUSIE/RALSEI 160/190/140 literal, is unchanged
and is still the answer when no roster is installed. **Nothing in `sim/` ever
writes the seam**, which is what keeps the vanilla fight and the A-Side byte
gate bit-identical.

WHY IT WAS WORTH AN ENGINE CHANGE: `state.partyMaxhp` already existed and was
read in some places and not others — honoured by `scr_party_hpaverage`,
ignored by `scr_damage_calculation`, by Kris's doomtype-4 mercy
(`round(-maxhp / 2)`, the -80 that makes a revive reachable), by
`scr_damage_maxhp`, by the heal cap in `sim/items.js` and by every revive
fraction there. A seam read on some paths and not others makes the answer
depend on which path asked. Every max-HP read in those four files now goes
through `partyMaxhp`. The three party-size-3 loops in `sim/damage.js` are
roster-bounded as well: `scr_party_hpaverage` (a RE-TARGETING gate that draws
RNG, so a stale slot 2 is a wrong number of `choose` calls and not merely a
wrong target), the mantle-wearer scan and `scr_damage_all`'s sweep.

The publisher on this side is `installRoster` (`kaizo/party/roster.js`), which
`buildKaizoScene` already calls for every version with a `party`;
`kaizo/tools/checks/check-party-seam.mjs` fails if EITHER half goes away — the
roster ceasing to publish a stat, or `sim/damage.js` ceasing to read it.

Proof the seam is inert, run in the worktree before the commit: `npm run
verify` exit 0, all 63 suites, and a full `tools/regen-fullfight.mjs`
byte-identical to a clean-file run across all 24 files of 6 tokens.

**`render/title.js` is AHEAD of the snapshot above — a labelled stand-in.**
2026-09-12, lane 2 (the B-Side game over). The file here is a verbatim copy of

    knight-sim  branch `kaizo-gameover-seams`  commit 74c87b1  ("v1.0.44: the
    game over screen takes a script")

committed in knight-sim but **not yet merged to its main**, so
`npm run vendor:engine` would roll it back until it is. What it adds is four
optional arguments to `makeGameOver(shot, x, y, opts)` — `script` (which
messages, where their `^6` pauses fall, and which options, defaulting to the
module's own `KNIGHT_GAMEOVER_SCRIPT`), `marker` (`heart_marker.visible`),
`glide` (the soul's 150 frames before PLACE_FAILURE; false for a caller that
arrived by a `room_goto` rather than through `scr_gameover`), and
`entry` (`GAMEOVER_ENTRY.ALWAYS`, the default and this tool's rule, against
`.GUARDED`, the shipping game's `if (previous_times_attempted > 0)`, under
which `makeGameOver` returns **null** on attempt zero) — plus `con` on the
value `stepGameOver` returns, ALONGSIDE `chosen` and never instead of it.
Omit every argument and the screen is the one it has always been; knight-sim's
own `web/main.js` passes none and reads `chosen`.

The consumer is `web/kaizo.js` — the B-Side script (EnderCat8's four replaced
lines and the two PROCEED options that both come back to the fight) lives in
`web/kaizo-gameover.js` on THIS side of the line, because it is the mod's text
and the vanilla engine must not carry it.

Proof the seam is inert, run in the worktree before the commit: `npm run
verify` exit 0, all 63 suites, and a full `tools/regen-fullfight.mjs`
byte-identical to a clean-file run across all 24 files.

**`render/menu.js` is AHEAD of the snapshot above — a labelled stand-in.**
2026-09-12, lane 3 (the Weird Route's HUD). The file here is a verbatim copy of

    knight-sim  branch `kaizo-gloom-seams`  commit 2137c01  ("v1.0.43: the
    party's HP bars can carry a second meter")

which is committed in knight-sim but **not yet merged to its main**, so
`npm run vendor:engine` would roll it back until it is. What it adds is one
optional state field, `state.partyStatusBar` = `{ color, values }` (values
slot-indexed like `state.partyHp`): a second coloured band over the party HP
fill on both surfaces `drawMenu` owns, plus a recolour of the current HP
number, and the target picker taking `state.partyMaxhp` like the charbox row
already did. Absent field, unchanged pixels — which is how the A-Side keeps
its byte gate.

The publisher is `publishGloomHud` in `kaizo/party/gloom.js`; it is what puts
GLOOM on a HUD at all (ledger G-34). Proof the seam is inert, run in the
worktree before the commit: `npm run verify` exit 0, all 63 suites, and a full
`tools/regen-fullfight.mjs` byte-identical to a clean-file run across all 24
files.

**`sim/menu.js`, `render/menu.js` and `render/fightbar.js` are AHEAD of the
snapshot above — labelled stand-ins.** 2026-09-12, lane B (Noelle's colour,
name plate and portrait). All three are verbatim copies of

    knight-sim  branch `kaizo-colour-seams`  commit 08ea0db  ("v1.0.45: the
    party HUD takes the character, not the slot")

which is committed in knight-sim but **not yet merged to its main**, so
`npm run vendor:engine` would roll it back until it is. **It is branched off
`kaizo-gloom-seams` (2137c01), not off main**, so this `render/menu.js`
CONTAINS lane 3's `state.partyStatusBar` band — the entry above is superseded
by this one for that file, and merging the two branches in either order gives
the same result.

THE FAULT. `global.hpcolor[]` is CHARACTER-indexed and four entries long
(`hpcolor[3] = c_yellow` is Noelle, gml_Object_obj_battlecontroller_Create_0
.gml:244-247) and `scr_charbox` reads it as `hpcolor[c]` with `c = charId - 1`
(scr_charbox.gml:18-37 — the SLOT arrives separately, as `charpos[c]`). This
engine carried it as a THREE-entry SLOT table in two places at once,
`sim/menu.js`'s `CHAR_COLOR` and `render/fightbar.js`'s `CHARCOLOR`, plus a
third slot-shaped copy of the portraits and plates. For [1, 2, 3] the two
indexings are the same number; for the Weird Route's `[1, 4, 0]` slot 1 read
SUSIE, which is the player's "it looks like she just has susies".

WHAT IT ADDS: `HPCOLOR` (four rows, BGR-decoded, the one colour table — 
`CHAR_COLOR` is now literally its first three) and `CHARBOX_ART` (four
portrait/plate/label rows, `PARTY_SPRITES` its first three), plus four
resolvers over one optional state field, `state.partyCharIds` — `global.char`,
the same shape as `partySprites` / `partyChunks` / `partyMaxhp` /
`partyStatusBar`. `charIdForSlot` falls back to `slot + 1`, so with nothing
installed every one of them returns exactly what the old tables did.
`render/fightbar.js` stops writing `j = i + 1` and derives obj_attackpress's
own three-long SLOT-keyed `charcolor`/`boltcolor` from the same rows; the
ally picker takes `scr_charbox`'s real guard, `if (global.char[i] != 0)`,
so a short party draws fewer rows rather than one empty one.

THE PUBLISHER ON THIS SIDE is already there and needed no edit:
`installRoster` (`kaizo/party/roster.js`) writes `state.kaizo.globalChar`, and
the resolvers read `state.partyCharIds ?? state.kaizo?.globalChar` — a plain
state read, not an import, so the one-way dependency in kaizo/HANDOFF.md §2
holds. **`state.partyCharIds` itself has no writer yet**; adding
`state.partyCharIds = globalCharArr` next to the `state.partyChunks` line in
`installRoster` is the tidy-up, and nothing depends on it happening.

`kaizo/tools/checks/check-charcolour.mjs` is the guard, and its L6 is a READER
guard rather than a value assertion: it renders the same fight twice with only
`partyCharIds` different and REQUIRES the painted pixels to differ on every
surface, so deleting any call site turns it red. Sabotage-tested both
directions (exit 1 with `charColorFor({}, c)` and with `j = i + 1`; exit 0
restored).

Proof the seam is inert, run in the worktree before the commit: `npm run
verify` exit 0, all 63 suites, and a full `tools/regen-fullfight.mjs`
byte-identical to a clean-file run across all 24 files.

---

**`sim/menu.js` is AHEAD of the lane-B stand-in above — a labelled stand-in of
its own.** 2026-09-12, lane C (the ally picker and the turn loop). It is a
verbatim copy of

    knight-sim  branch `kaizo-menu3-seams`  commit 7f9d1c3
                ("v1.0.47: the ally picker walks the party, not a modulo")

**branched off `kaizo-colour-seams` (08ea0db), not off main**, so this file
CONTAINS lane B's whole `HPCOLOR` / `CHARBOX_ART` / `charIdForSlot` /
`slotOccupied` seam — the entry above is superseded by this one FOR THIS FILE
only, and `render/menu.js` / `render/fightbar.js` still come from lane B.
Merging the two branches in either order gives the same result.

SIX DEFECTS, all measured through the real menu, all the same shape: a
vanilla-shaped consumer meeting the empty third slot a two-member roster
leaves behind.

  a. **The ally picker walked `(targetIndex ± 1) % 3`** with no occupancy test
     on the walk OR on the confirm, so the cursor reached the pad and the
     confirm took it: 80 TP charged, the turn spent on nobody. It now builds
     the game's own presence table — `for (i = 0; i < 3; i++) { ht[i] = 0; if
     (global.char[i] > 0) ht[i] = 1; }` — runs the four clamps that normalise
     the cursor onto an occupied row EVERY frame before the input is read
     (which is why the original's confirm needs no test of its own), and walks
     that table in the original's two-step down/up searches.
     `ht` reads lane B's `slotOccupied`.
  b. **The picker opened on the caster**, under a comment claiming "as the
     original does". It does not: neither site that sets `bmenuno` to 7 or 8
     (Step_0:656 / 802 / 1001) touches `bmenucoord`, and
     `scr_battlecursor_memory_reset` zeroes all of it before every command
     phase (scr_mnendturn:35). `openMenu` now performs that reset for
     `targetIndex` too, and the clamps put the cursor on the first occupied
     row — Kris.
  c. **LEFT and RIGHT moved the ally cursor.** There is no `left_p` or
     `right_p` anywhere in the bmenuno 7/8 block; the aliasing was invented.
  d. **`state.charaction[c] = 0` sat three lines after the record.** A
     TARGETED item or spell therefore left the slot reading 0 while an
     untargeted one left 4 — and `scr_itemconsumeb` / `scr_spellconsumeb` set
     4 / 2 and nothing unsets them.
  e. **An item was refunded when the user was the last standing member.**
     `nextHero` advanced one slot and carried the bag there; `skipFallen` then
     walked charturn over the downed slots WITHOUT carrying it, and
     `endTurnItems` committed `tempitem[min(charturn, 2)]` — a snapshot nobody
     had touched. `scr_nexthero` does the SEARCH and the CARRY in one script
     and never advances past the last character who can act, so nextHero now
     picks the slot with `scr_charcan` and only then copies; the slot whose bag
     commits is recorded as `menu.acted` and `endTurnItems` is its reader.
  f. **A phantom third party member got a menu panel.** The command phase was
     gated on `isUp`, which reads `chardead` — and an empty slot has no
     `chardead` entry, so `!undefined` reported it STANDING. `scr_charcan` is
     translated and is the gate now (`sim/menu.js` exports it); its FIRST test
     is `global.char[arg0] == 0`, so it holds whether or not anything has stood
     the pad back up.

WHAT IT ADDS TO THE ENGINE'S SURFACE: `scrCharcan(state, slot)` exported, and
one new menu field, `menu.acted`. Nothing in `sim/` writes `partyCharIds` or
`kaizo.globalChar`, so with no roster installed `slotOccupied` answers
`slot < 3`, `scrCharcan` degenerates to the old `isUp` plus an HP test that
`isUp` already implies, and the picker's presence table is `[1, 1, 1]` — which
is the modulo it replaced.

`kaizo/tools/checks/check-ally-picker.mjs` is the guard: 69 assertions, every
one of them driven by pressing keys into `stepFrame` and reading the state
that came back. Sabotage-tested in eight directions, exit 1 each and exit 0
restored: skipFallen back on `isUp`; `ht` no longer reading `slotOccupied`;
the four clamps removed; `menu.targetIndex = c` restored; left/right
re-aliased; the `charaction` wipe restored; `endTurnItems` back on
`Math.min(charturn, 2)` (the READER guard for `menu.acted`); and `nextHero`
back on a bare `+= 1`.

`tools/verify-itemmenu.mjs` moved with it, because it ENCODED two of the
defects: it pressed RIGHT to walk the ally picker and called slot 0 "the
acting character". It now presses DOWN, asserts positively that LEFT and RIGHT
move nothing, and says slot 0.

Proof the change is inert for vanilla, run in the worktree before the commit:
`npm run verify` exit 0, all 63 suites, and a full `tools/regen-fullfight.mjs`
byte-identical to a clean-file run across all 24 files of the six tokens.
On the kaizo side the byte gate is unmoved: `_tok3` trace AND bullets
byte-exact, `_rev1` still first-diverging at trace f12492 / bullets f12499.
The ally picker is never opened by either recording (measured with a counter
inside `stepMenu`: zero entries to the `target` submenu across both feeds), so
a, b and c are structurally unobservable to the gate and are pinned only by
the driven check.

---

**`render/menu.js` is AHEAD of the lane-B stand-in above — a labelled stand-in
of its own.** 2026-09-12, lane 3 (what the player is actually SHOWN). It is a
verbatim copy of

    knight-sim  branch `kaizo-lane3-seams`  commit 1973836  ("v1.0.48: the
    ACT grid says why, and what it costs")

branched off `kaizo-colour-seams` (08ea0db), so it CONTAINS lane 3's gloom band
and lane B's character-keyed HUD; merging the branches in either order gives
the same file. Committed in knight-sim, not merged to its main, so
`npm run vendor:engine` would roll it back until it is.

WHAT IT ADDS — three draws the ACT grid was missing, all out of
`obj_battlecontroller`'s own bmenuno-9 block, and no new state field:

  * **the partner-head strip** (`partnerStrip`, Draw_0:1173-1192 and
    :1257-1296). An ACT row whose `actactor` is 11 — the seam already carries
    it as `actor` on the row `actsFor(state, slot)` returns — draws every
    PARTNER's portrait to its left with two `spr_tenna_x` crosses over it,
    c_gray while they stand and white (-1) once they are down, and pushes the
    row's own name right by `charoffset = 30 * partners`. That strip is the
    whole of the game's answer to "why is X-Slash grey"; without it the move
    reads as broken, which is what the player reported. `render/` may not
    import from `kaizo/`, so the strip is derived from the engine's own party
    seam (`charIdForSlot` / `slotOccupied` / `state.partyHp` /
    `partyArtFor`) rather than from `kaizo/party/spells.js`'s
    `xslashGridHeads`; `check-xslash-heads.mjs` asserts the two agree field
    for field, which is the first reader that function has ever had.
  * **the ACT grid's `% TP` readout** (Draw_0:1329-1334). `if
    (global.tensionselect > 0)` — the SELECTED row's cost — `round` and not
    the spell list's `floor`, at the literal x 500 and not `spell_offset`.
    X-Slash's 62.5 now reads "25% TP" where the grid used to show a grey row
    with no price.
  * **the ACT block's own name squeeze** (Draw_0:1314-1325):
    `(206 - charoffset) / max(1, width)` clamped into [0.5, 1], against the
    bag's `min(1, 200 / width)`. The two agree for every vanilla ACT name, and
    they have to differ here or the name sits under the portraits.

Plus two one-line corrections in the same function: the enemy-row dispatch
takes `'spare'` — **bmenuno 12 is SPARE's target stage** and the fifth branch
of the Draw_0:673 test the arm already served four of — and the MAGIC readout
asks `spellInfo(state, id)` instead of the hardcoded `SPELLS` table, so a
character-keyed list that ADDS ids (the Weird Route's SleepMist 8 and IceShock
9) stops printing a price for two of its four rows and nothing for the other
two. Vanilla installs no hook, so both are inert there.

`spr_tenna_x` IS NOT IN ANY PACK THIS RENDERER CAN REACH. It is a vanilla
sprite (32x32, 2 frames, byte-identical in both data files —
sprites_kaizo.csv:3910) that `kaizo/tools/pack-kaizo-sprites.mjs` does not
extract, so the crosses are asked for and skipped; the greyed heads, which are
the load-bearing half, draw either way, and `check-xslash-heads.mjs` asserts
both cases. Adding the name to that packer's WANT list is the tidy-up.

Proof the change is inert for vanilla, run in the worktree before the commit:
`npm run verify` exit 0, all 63 suites, and a full `tools/regen-fullfight.mjs`
byte-identical to a clean-file run across all 24 files of the six tokens.
On the kaizo side the byte gate is unmoved: `_tok3` trace AND bullets
byte-exact, `_rev1` still first-diverging at trace f12492 / bullets f12499 —
structurally so, since the gate compares no drawn pixel.

**`sim/items.js` is AHEAD of the lane-A stand-in above — a labelled stand-in
of a labelled stand-in.** 2026-09-12, lane 2 (the phantom party member and the
item table). The file here is a verbatim copy of

    knight-sim  branch `kaizo-items-seams`  commit 118f0e3  ("v1.0.47: an
    empty battle slot is not a character a heal can reach")

which is **branched off `kaizo-party-seams` (4d4571b), not off main**, so this
file carries lane A's four max-HP accessors as well as everything below.
Neither branch is merged to knight-sim's main; `npm run vendor:engine` would
roll both back until they are.

WHAT IT ADDS, in three pieces:

1. THREE OCCUPANCY GUARDS, all of them the mod's own. `scr_healall` tests
   `global.char[i] != 0` (`gml_GlobalScript_scr_healall.gml:12`); scr_spell's
   revive-all cases 230/231 test `global.char[__j] > 0`
   (`gml_GlobalScript_scr_spell.gml:511, 532`); and `scr_healitem_all`'s
   writer loop runs `i < chartotal`, not `i < 3`
   (`gml_GlobalScript_scr_healitem_all.gml:4`). Three bare `i < 3` loops here
   had none of them, so a Spincake on the Weird Route healed the padded spare,
   crossed it through zero and let `scr_heal`'s tail REVIVE it: measured
   through the real menu, `chardead` `[0,0,1]` -> `[0,0,0]` with
   `charcantarget` and `charmove` to match. `applyHeal` refuses an absent slot
   outright as well, so the single-target path is closed independently of
   whether the ally picker offers slot 2.

2. TWO HOOK NAMES on the existing `state.kaizo.hooks` seam —
   `scrHealitem` and `scrHealitemAll`, deferring WHOLE exactly as
   `sim/damage.js`'s four damage entry points do. The mod's battle heals are
   `scr_healitemspell` / `scr_healallitemspell` (every battle item is
   `scr_spell` case `id + 200`, `scr_itemconsumeb.gml:5`), and those carry a
   `k_freeze` gate that WASTES the action and writes `global.spelldelay`;
   none of that is expressible as an override of a line. The kaizo side is
   `kaizo/party/items.js`, installed by `installRoster`.

3. `itemInfo` / `itemTable` over an OPTIONAL `state.kaizo.items`, so a mod
   that rewrote `scr_itemuse` / `scr_iteminfo` gets its numbers without the
   vanilla table moving. Every `ITEMS[id]` read inside the file goes through
   it; readers OUTSIDE the file (`sim/menu.js`'s rows and `recordItem`,
   `sim/modes.js`, `render/title.js`, `web/kaizo.js`) still index `ITEMS`
   directly and are the wiring that is left.

Nothing in `sim/` writes `state.kaizo.items` or either hook, and with no
roster installed every slot is occupied, so all of it is inert for vanilla.
Proof, run in the worktree before the commit: `npm run verify` exit 0, all 63
suites, and a full `tools/regen-fullfight.mjs` byte-identical to a clean-file
run across all 24 files of the six tokens. On the kaizo side the byte gate is
unmoved: `_tok3` trace AND bullets byte-exact, `_rev1` still first-diverging
at trace f12492 / bullets f12499 — and structurally so, since only V-D
installs a roster and the gate replays V-C.

**`sim/victory-scene.js` and `render/draw/victory-scene.js` are AHEAD of the
snapshot above — labelled stand-ins.** 2026-09-12, the ENDING-CUTSCENE lane
(the A-Side knighting the mod replaced, ledger G-14 + G-16). Both files here are verbatim copies of

    knight-sim  branch `kaizo-lane2-seams`  commit 5a8d355  ("v1.0.43: the
    victory scene can be replaced, not forked")

committed in knight-sim but **not yet merged to its main**, so
`npm run vendor:engine` would roll them back until it is.

WHY IT HAD TO BE AN ENGINE CHANGE. `sim/victory-scene.js` plays con 50 — the
A-Side knighting — and EnderCat8 deleted the whole knighting and put a third
slash there. The vanilla build must keep playing the vanilla beat exactly as it
does, so this could not be an edit to the script; and it could not be an
argument either, because the page's only call is `createVictoryScene()` with
no arguments and `sim/` may not import `kaizo/`. So the variant is INSTALLED:

    setVictoryVariant(variant | null)      sim/victory-scene.js, module state
    getVictoryVariant()                    what is installed, for a check

    variant = { name, lines, script, ops, cutVolume }
      lines      replaces VICTORY_LINES, same indices (the drawer's per-line
                 face-frame table is keyed by index)
      script     replaces buildScript()'s op list
      ops        extra op handlers, reached through the switch's new `default`
                 arm — an unknown op was already a silent no-op there
      cutVolume  the gain the five-cut slash stack plays at

    buildVictoryScript()                   exported so a variant DERIVES its
                                           script instead of restating it

Two mechanics came with it, both the game's and both vanilla-neutral:
`line.noWait` in the dialogue gate (a bare `%` ends a message the frame the
writer reaches it; vanilla's `/%` waits for a press, and every vanilla line is
`/%`), and `CUT_VOLUME` — `c_snd_play_x`'s arg1 is a gain, the ending's cuts
are played at 8, and it had been hardcoded to 1. `render/audio.js` already
clamps at `Math.min(1, base)`, so nothing got louder. `VICTORY_CLASH` names the
clash block's measured numbers (300 / 320 / 80-10-30 / 95) so the second
translation of the same GML in `kaizo/scenes/kaizo-ending.js` can be compared
against them rather than drift from them.

The `render/draw/victory-scene.js` half is ONE line: the dialogue draw reads
`sc.lines ?? VICTORY_LINES`. Without it the mod's truncated taunts are computed
and drawn by nobody.

The publisher on this side is `buildKaizoScene` (`kaizo/scenes/kaizo-fight.js`),
which installs `KAIZO_VICTORY_VARIANT` for the recreation lanes and installs
`null` — restoring vanilla — for every other version.
`kaizo/tools/checks/check-kaizo-victory.mjs` fails if EITHER half goes away, and
if the drawer stops reading `sc.lines`.

Nothing in `sim/` ever installs a variant, so vanilla is unchanged. Proof, run
in the worktree before the commit: `npm run verify` exit 0, all 63 suites, and
a full `tools/regen-fullfight.mjs` byte-identical to a clean-file run across all
24 files of the six tokens. On the kaizo side the byte gate is unmoved: `_tok3`
trace AND bullets byte-exact (12637 / 13001 frames), `_rev1` still first
diverging at trace f12492 / bullets f12499 — structurally so, since the ending
scene has zero sim contact and never runs inside a traced fight.

(Everything below was already ported — everything listed here through 2026-09-04 was ported to knight-sim on
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

## Pending port-backs — NINE AUDIO FILES (2026-09-12, lane 3)

`assets/audio/` here carries **nine sound files and nine `index.json` lines
that the vendored snapshot above does not**: `snd_icespell.ogg`,
`snd_ghostappear.ogg`, `snd_great_shine.ogg`, `snd_spell_pacify.ogg` (copied
unmodified from the oracle build's loose audio) and `snd_knight_laser.wav`,
`snd_knight_beam.wav`, `snd_rocket_bc.wav`, `snd_leaf_dodge.wav`,
`snd_sussurprise.wav` (extracted from the mod's own pristine data file with
UTMT — audiogroup 0 ids 202/191/286/217 and audiogroup 1 id 68). Every one of
them is a cue the shipped code already fires and that had no file at all;
`check-audio-cues.mjs` held all nine in its KNOWN_ABSENT ledger until today.

**They are NOT hand-edits standing in for an engine fix that has not been
made — the engine change exists.** It is knight-sim branch
`kaizo-audio-seams` (worktree `D:\ShadowCrystal\knight-sim-wt-audio`, off
`main` @ bfe087f), uncommitted, carrying exactly these nine files, exactly
these nine `index.json` lines, and the v1.0.50 -> **v1.0.51** bump in
`web/version.js` + `CACHE` in `web/sw.js`. The files here are byte-identical
to the ones there (`cmp` on all ten, index.json included).

A full `npm run vendor:engine` was deliberately NOT run: the mirrored
directories in this repo are dirty with several other lanes' stand-ins right
now, and the mirror deletes before it copies. Re-vendor from knight-sim once
`kaizo-audio-seams` is merged and this section goes away.

Gates after the mirror: `_tok3` trace AND bullets byte-exact (12637 / 13001
frames), `_rev1` unmoved at trace f12492 / bullets f12499. knight-sim's own
suites in the worktree: 62 of 63, the identical pass/fail set the same
worktree produces with these changes stashed (the one red is
`verify-fullfight`'s trace-staleness guard, which is red on the clean `main`
checkout at the same commit too).
