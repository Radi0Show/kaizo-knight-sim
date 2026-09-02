# THE WEIRD ROUTE (B-Side) — completeness spec

**V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish without permission.**
(kaizo/HANDOFF.md §5-C publish gate. Everything below describes another
author's creative work, read out of a private research dump. It stays local.)

Written as the completeness critic's inventory for the V-D lane: *everything*
the B-Side changes relative to the A-Side, what is translated, what three
sibling agents are building right now, and what is still missing — ranked.

**Every claim below cites a file and line in the mod's own decompiled GML**,
`knight-research/kaizo-mod/gml_kaizo_dump/CodeEntries/` (v2.3.3). Line numbers
are that dump's. Where the vanilla side matters it is
`knight-research/kaizo-mod/gml_vanilla_v105/CodeEntries/`.

The enforcement half of this document is
`kaizo/tools/checks/check-weirdroute.mjs` — every number in §3, §4 and §5 that
can be observed from the wired code is pinned there by a positive assertion.

---

## 0. The four answers, up front

| question | answer | source |
|---|---|---|
| **How do you enter it?** | You don't toggle it. `k_sideb = global.flag[456]` — the game's own Chapter 3 Weird-Route/Snowgrave save flag. Load a Weird Route file and the Knight fight *is* the B-Side. | `gml_Object_obj_knight_enemy_Create_0.gml:115` |
| **What is the party?** | Whatever the settings sign was set to, canonicalised by `scr_fixparty`. The Weird Route roster is **Kris (charId 1) + Noelle (charId 4)** → `global.char = [1, 4, 0]`, two battle slots. | `gml_Object_obj_npc_sign_Draw_0.gml:87-156`, `gml_GlobalScript_kaizo_settings_init.gml:327-379` |
| **What changes in the schedule?** | Exactly five struct fields. Three change the fight: RisingAbyss `ac 3 → 101`, Swords1 `ac 17 → 112`, Quickslash `ac 105 → 105.1`. Two swap telegraph text. | `gml_Object_obj_knight_enemy_Other_24.gml:343-350` |
| **What does the invc 0.7 cap do?** | `if (global.invc > 0.7) global.invc = 0.7;` at the bottom of the whole B-Side dispatch. Every turn that granted a full second of mercy after a hit now grants 0.7 s — **30 % fewer i-frames on 14 of the 27 chain turns**. | `gml_Object_obj_knight_enemy_Other_23.gml:1316-1319` |

---

## 1. ENTERING the Weird Route

### 1.1 The flag is the game's, not the mod's

`k_sideb = global.flag[456]` (`gml_Object_obj_knight_enemy_Create_0.gml:115`).
A whole-dump grep finds **no writer** for flag 456 in either the kaizo dump or
`gml_vanilla_v105` — the only other readers are vanilla's own
(`gml_Object_obj_ch3_closet_Create_0.gml:5`,
`gml_Object_obj_tenna_enemy_Step_0.gml:650`). It is set outside Chapter 3 and
arrives in the save. **So the B-Side has no in-mod switch: it is what the
Kaizo fight becomes on a Weird Route file.** The mod reads it in five places:

| site | what it gates |
|---|---|
| `gml_Object_obj_knight_enemy_Create_0.gml:115` | `k_sideb`, and through it `kaizo_sideb()` for every attack object |
| `gml_Object_obj_heroparent_Create_0.gml:201` | `_sideb` → Noelle's B-Side sprite set (vanilla hardcodes `_sideb = 0`) |
| `gml_GlobalScript_kaizo_settings_init.gml:49` | the alternate battle track (`kaizoknight_alt.ogg`) |
| `gml_GlobalScript_scr_encountersetup.gml:715-718` | the encounter message becomes "* The Roaring Knight appeared^1.&* Something seems wrong." |
| `gml_Object_DEVICE_FAILURE_Create_0.gml:21` | `gaster_sideb` → the alternate Gaster game-over script |
| `gml_Object_obj_ch3_PTB02_Step_0.gml:616-619` | victory routing: `con 49 → 49.1`, the B-Side epilogue |

`kaizo_sideb()` (`gml_GlobalScript_kaizo_settings_init.gml:79-89`) is the
accessor every attack object uses: *"does an `obj_knight_enemy` exist and is
its `k_sideb` set"*. In the sim that is `state.kaizo.sideb`, stamped at scene
build (`kaizo/scenes/kaizo-fight.js`, `sideb: version === 'D'`).

**Do not confuse it with `scr_sideb_get_phase()`**
(`gml_GlobalScript_scr_sideb_get_phase.gml`, byte-identical to vanilla): that
is the game's own Weird-Route *progress* counter off flags 915/916 and has
nothing to do with `k_sideb`. The mod only uses it for Berdly's ACT names
(`gml_GlobalScript_scr_monstersetup.gml:1222`) and Noelle's battle-intro
sprite (`gml_Object_obj_encounterbasic_Create_0.gml:39-43`).

### 1.2 The settings sign — practice, and the custom party

`gml_Object_obj_npc_sign_Draw_0.gml`, `extflag == "kaizo settings"`. Four top
choices (`con 0.6`, lines 13-59):

| choice | effect |
|---|---|
| 0 | toggles `global.kaizo_practice` and saves `dr.ini` (l.18-19) |
| 1 | opens the **party picker** (l.31-41) |
| 2 | cancel (l.42-46) |
| 3 | white flash, `global.knight_battle_losses = 2`, `global.tempflag[90] = 4`, `room_restart()` — a shortcut straight into the fight (l.47-76) |

The picker: *"(How many party members?)"* offers `1 / 3 / 2` in that on-screen
order, mapped through `var _pl = [0, 2, 1]; partyleft = _pl[global.choice]`
(l.89-90). Then *"(Select who you want.)"* — Kris / Susie / Ralsei / **Noelle**
(l.100-103) — fills `partychar[partyleft]` and decrements (l.124-125), so the
player picks in **reverse slot order**. That quirk is then erased:
`global.char = [partychar[0..2]]; scr_fixparty(0);` (l.152-155).

**`scr_fixparty` is the roster's normal form**
(`gml_GlobalScript_kaizo_settings_init.gml:327-379`): it scans the three slots
for the presence of each of Kris/Susie/Ralsei/Noelle, blanks `global.char`,
and re-emits the present ones in **canonical id order 1 < 2 < 3 < 4**, packed
from slot 0 with no holes. Consequences the sim must honour:

* a Kris+Noelle party is **always** `[1, 4, 0]` — Kris slot 0, Noelle slot 1;
* duplicates collapse (picking Noelle twice yields a one-person party);
* the sign's reverse fill is invisible in the result.

`scr_fixparty(0)` skips `scr_reset_caterpillars` (the overworld followers);
the sign passes 0 because it is mid-cutscene.

### 1.3 The mode select, and the party round-trip

`gml_Object_obj_ch3_PTB02_Step_0.gml:439-500`. At `con 3.2` the pre-fight
menu offers **Practice / No Hit / Standard / Return**, writing
`global.knight_mode` (l.444, 495, 500). `obj_knight_enemy`'s Create turns that
into `practicemode` (mode 0) or `nohitmode` (mode 1, which also tops up
`global.hp[1..4]`) — `gml_Object_obj_knight_enemy_Create_0.gml:95-108`.
"Return" restores `rem_char` and restarts the room (l.474-483).

The custom party makes a round trip through the cutscene, and this is why the
Weird Route roster survives it:

1. `con 2` (and PTB02's Create, l.176-183) snapshots `rem_char = global.char`
   and, if it is not `[1,2,3]`, sets `char_change = 1`, calls
   `scr_refreshchar()` and forces the caterpillars to Kris/Susie/Ralsei — the
   *overworld* scene is always the canonical trio;
2. `con 4`, right before `scr_battle(115, 1, ...)`, puts it back:
   `if (char_change) { event_user(7); global.char[0..2] = rem_char[0..2]; }`
   (l.556-566). **The fight runs with the custom party.**
3. `con 8`, after the fight, forces `global.char = [1,2,3]` again (l.607-611).

Practice mode is separate from all of this: `practicemode` suppresses the
B-Side scenes (`gml_GlobalScript_scr_mnendturn.gml:150`), the gloom accrual
(`gml_GlobalScript_scr_damage.gml:247`) and the Knight's taunt lines
(`gml_Object_obj_knight_enemy_Step_0.gml:1258`, `:686`).

---

## 2. THE PARTY

### 2.1 Noelle

Chapter-3 stats, `gml_GlobalScript_scr_gamestart_chapter_override.gml:55-59`:

```
global.maxhp[4] = 120;   global.hp[4] = 120;
global.at[4]    = 5;     global.mag[4] = 13;    global.df[4] = 1;
```

She is the frailest member by max HP and the strongest caster. Two rules
compensate, both knight-fight-only:

* **incoming damage is halved** — `if (global.char[target] == 4) tdamage =
  round(tdamage * 0.5);` (`gml_GlobalScript_scr_damage.gml:157-160`, inside the
  `i_ex(obj_knight_enemy) && truedamage == 0` block, after the Shadow Mantle's
  ×0.33);
* **her weapon 13 makes her gloom-immune** — `if (chartarget == 4 &&
  global.charweapon[4] == 13) _gloomdmg = 0;`
  (`gml_GlobalScript_scr_damage.gml:249-252`).

Sprites (`gml_Object_obj_heroparent_Create_0.gml:190-214`): the base set is
`spr_noelleb_*`; when `_sideb` the mod swaps in
`spr_noelleb_idle_sideb / _hurt_sideb / _defend_sideb`, makes her attack pose
the *spell* pose (`attackreadysprite = spr_noelleb_spellready`,
`attacksprite = spr_noelleb_spell`, `attackframes = 6`) and her victory pose
`spr_noelleb_pray` (10 frames). **Vanilla v105 hardcodes `_sideb = 0` at the
same line**, so this whole set is real game art the retail fight can never
show. Prefetched at `gml_Object_obj_ch3_PTB02_Other_17.gml:18-22`.

ACT menu, `gml_GlobalScript_scr_monstersetup.gml:1843-1881` (monstertype 104):
Noelle gets `canactnoe[0] = 1`, name **"N-Action"** (l.1867-1869). And — the
solo-party rule — `if (!scr_havechar(1))` (no Kris) every partner's ACT
becomes **"HoldBreath"** (l.1870-1881), because HoldBreath is Kris's ACT slot
and someone must be able to open the Knight's guard.

Noelle's N-Action text has a B-Side variant:
`gml_Object_obj_knight_enemy_Step_0.gml:1258-1272` — on the A-Side she *"tries
to talk to the Knight"* and a chill takes her voice; on the B-Side, and on
every repeat, *"Noelle couldn't bring herself to say anything."*

### 2.2 What a two-person party changes by itself

* **Kris's FIGHT multiplier is permanently raised.**
  `gml_Object_obj_heroparent_Step_0.gml:377-388` counts
  `_partyalive = Σ scr_havechar(i) * (global.hp[i] > 0)` over char ids 1..4 and
  applies `≤1 → ceil(×2.5)`, `==2 → ceil(×1.5)`. A two-person party can never
  reach 3 alive, so **Kris/Noelle means ×1.5 while Noelle stands and ×2.5 the
  moment she falls** — the vanilla swoon halving is gone entirely.
* **The `scr_mnendturn` revive-heal is off in this fight** for everyone:
  `if (global.chapter == 3 && i_ex(obj_knight_enemy)) { }` — an empty branch
  where every other battle heals a downed member for `ceil(maxhp/8)`
  (`gml_GlobalScript_scr_mnendturn.gml:66-88`).
* **A fallen member goes to −999, not −maxhp/2**, with `doomtype 12`
  (`gml_GlobalScript_scr_damage.gml:224-232`) — Kris's 1-HP mercy is removed.

### 2.3 The indexing split — reproduce it, do not fix it

`global.hp[] / maxhp[] / at[] / k_gloom[] / k_freeze[]` are **character-indexed
(1..4)**. `charmove/chardead/charinstance` and the battle slots are
**slot-indexed (0..2)**. The mod is not consistent about which it feeds to the
gloom array, and the divergence only bites when Noelle is in the party:

| site | index used | correct for `[1,4,0]`? |
|---|---|---|
| `gml_Object_obj_knight_enemy_Step_2.gml:16-45` (the DoT engine) | `i = 1..4`, char id | yes |
| `gml_GlobalScript_scr_damage.gml:254-263` | `chartarget = global.char[target]`, char id | yes |
| `gml_GlobalScript_scr_damage_maxhp.gml:254-259` | char id | yes |
| `gml_Object_obj_battlecontroller_Draw_0.gml:1390-1392` | `global.char[i]`, char id | yes |
| `gml_Object_obj_heroparent_Draw_0.gml:42` | `global.char[myself]`, char id | yes |
| **`gml_GlobalScript_scr_charbox.gml:740, 759, 763`** | **`c + 1`, i.e. slot+1** | **NO** |

With `global.char = [1, 4, 0]`, `scr_charbox` draws slot 1's (Noelle's) gloom
band from `k_gloom[2]` — **Susie's** meter, which nothing in a Kris/Noelle
party ever writes. So Noelle's HP-bar gloom overlay reads permanently empty
while the DoT is really running. **ORIGINAL BUG. Translate it at the call
site, label it, and do not correct it.** (`obj_battlecontroller`'s own gloom
band, l.1390, is correct — the two HUDs disagree with each other in the real
mod.)

`k_freeze` has the same shape but no divergence: every reader uses a char id
(`gml_Object_obj_heroparent_Draw_0.gml:18`, `_CleanUp_0.gml:1-5`,
`gml_GlobalScript_scr_spell.gml:47/189/281` via `_ctar = global.char[star]`,
`gml_GlobalScript_scr_healall.gml:8`, `_healallitemspell.gml:10`,
`_healitemspell.gml:6`, `gml_GlobalScript_scr_spelltext.gml:110/289`).

---

## 3. THE SCHEDULE — the `k_sideb` struct swaps

`gml_Object_obj_knight_enemy_Other_24.gml` builds one 28-struct attack graph
and then patches it in place:

```gml
if (k_sideb)                                              // l.343
{
    atk_RisingAbyssB.attackChoice = 101;                  // l.345
    atk_Swords1.attackChoice      = 112;                  // l.346
    atk_KnightGlow.attackMsg      = "* The air grows cold.";   // l.347
    atk_RoaringDelta.attackMsg    = "* ...";                   // l.348
    atk_Quickslash.attackChoice   = 105.1;                // l.349
}
```

**Five fields. That is the entire difference between the two fight scripts** —
the chain, the phases, the difficulties, the 60 % gate, the `kaizo_phase4`
pointer and the `AfterFinal → kaizo_resumeAT` replay are all shared. In the
sim that is `VC_TABLE` vs `VD_TABLE` (`kaizo/versions/vc-script.js`), and
check-weirdroute asserts the two tables differ in exactly these five fields
and nowhere else.

What the three fight-changing swaps do:

| node | A-Side | B-Side | effect |
|---|---|---|---|
| `atk_RisingAbyssB` (phase 1, turn 6) | ac 3 → underbox dmg 87, invc 0.4 (`Other_23:268`) | ac 101 → underbox dmg **103** + **sword tunnel d10** (one-sided shrinking gap), invc 1→0.7, clock 240 (`Other_23:423-424`) | a single-manager orb turn becomes a two-attack layered turn |
| `atk_Swords1` (phase 1, turn 9) | ac 17 → tracking swords **d3**, dmg 206, invc 0.4, clock 240 (`Other_23:303`) | ac 112 → tracking swords **d11** (frostveil: rate 13, maxswords 9999, graze TP 1), dmg 206, invc 0.4, clock **460** (`Other_23:1306-1315`) | a 240-frame volley becomes a 460-frame endless snowfield |
| `atk_Quickslash` (phase 2, turn 2 — **and the loop target**) | ac 105 → controller **1001**, endtype 0 (`Other_23:316`) | ac 105.1 → controller **97.1**, endtype **1** (`Other_23:1096`… `dbulletcontroller` `_quickslasher.endtype = 1` under `kaizo_sideb()`, `gml_Object_obj_dbulletcontroller_Step_0.gml:1974-1977`) | the big slash ends in the **vertical splitter** instead of despawning. Phase 3's last node chains back here (`Other_24:266`), so this is the most-played turn in the fight |

The two controllers also differ in how they hold the clock, and the launcher
keeps the distinction rather than lumping them together: **1001 pins**
`global.turntimer = 999999` and hands it back itself, while **97.1 does not** —
it runs on the arm's own `scr_turntimer(9999)` floor and its `event_user(0)`
"full" arm cuts `local_turntimer` to 230, a visibly shorter turn that never
reaches the phase-2 barrage.

Also on the B-Side, but not in the struct table: because ac 3 and ac 17 are
never selected, their `kaizo_setAttack_sideb` arms (`Other_23:374-379` and
`:419`) are **dead in the D table** even though they exist and differ from the
A-Side. Ignore them unless practice mode is modelled — the practice picker
still lists `atk_RisingAbyssB`/`atk_Swords1` by *id* (`Other_24:358, 361`),
so in practice the swapped choice is what runs.

---

## 4. THE DISPATCH — `kaizo_setAttack_sideb`

`gml_Object_obj_knight_enemy_Other_23.gml:670-1321`, selected at
`gml_Object_obj_knight_enemy_Step_0.gml:486-511` (`arg0 == 0` opens the arena,
`arg0 == 1` launches). It is a full copy of `kaizo_setAttack` with three
classes of change.

### 4.1 Arena geometry

Positions are identical on both sides (`Other_23:678-696` vs `:13-37`): ac 0
at `(300−152, 170)`, ac 11 at `(320, 190)`, ac 13 phase≠2 at `(300, 190)`,
everything else `(320, 170)`. **Seven scale/offset entries differ:**

| ac | A-Side | B-Side | line (A / B) |
|---|---|---|---|
| 0 Crescent Slash | `maxxscale 0.8`, keep+megakeep | `maxxscale 0.6`, keep+megakeep | 40 / 699 |
| 1 Starstorm | `2.25 × 1.75` | `2.25 × 1.5` | 46-47 / 705-706 |
| 12 Diamond Storm | `2.5 × (default 2)` | `2.5 × 1.4` | 66 / 725-726 |
| 14 Swords 3 | `1.75 × 1.75` | `1.5 × 1.5` | 77-78 / 737-738 |
| 17 Swords 1 | `1 × 1` | `0.8 × 0.8` | 86-87 / 746-747 |
| 101 Rising Abyss | `3 × 1.5`, `y -= 64` | `3 × 1.5`, `y -= 56`, **+ keep + megakeep** | 96-99 / 756-761 |
| 112 Swords 1-B | *(no entry — default 2 × 2)* | `2.5 × 2.5` | — / 792-793 |

Everything else — ac 4, 10, 11, 13, 15, 20, 102, 103, 107, 110, 111 — is
identical, as is the `obj_moveheart` destination table (`:796-829` vs
`:129-162`: ac 13 phase≠2 and ac 15 to `(gt.x−40, gt.y−8)`, ac 101 to
`(gt.x−10, gt.y+20)`).

Read as difficulty: **five of the seven make the box smaller**, and the sixth
(ac 101) both raises the floor 8 px and marks the board `keep`/`megakeep` so
it persists across the turn boundary. The two `xstart`/`ystart` rebases onto
the Knight's own `x`/`y` (ac 101 and ac 110, `:99` and `:784`) are unqualified
`x`/`y` inside the Knight's event — transcribed faithfully in
`openVCArena`.

### 4.2 Turn clocks

The A-Side ends with a trailing `if (myattackchoice < 100)` `scr_turntimer`
table (`Other_23:612-666`). **The B-Side deletes it and opens instead with an
unconditional `scr_turntimer(240)`** (`Other_23:833`), then sets per-arm
floors. `scr_turntimer` only ever *raises*
(`gml_GlobalScript_scr_turntimer.gml:3`), so the practical differences are:

| ac | A-Side clock | B-Side clock |
|---|---|---|
| 110 PierceBlades | **none at all** (the `<100` table does not cover ≥100 and the arm sets nothing) | 240 (the leading floor) |
| 11 | 292 | 300 |
| 13 phase 1 | 450 | 470 |
| 0 Crescent Slash | 300 | 300 (`:846`) |
| 112 | — | 460 (`:1314`) |

> **RETRACTION — `deltas/INDEX.md` §2 and open question 8 are wrong.** They
> claim the A-Side's `<100` tail stomps ac 15.1's 450 down to 240 while the
> B-Side keeps 450, and label it a preserved bug. It cannot happen:
> `scr_turntimer` is a floor (`gml_GlobalScript_scr_turntimer.gml:3`), so the
> tail's `scr_turntimer(240)` is a no-op against the arm's own
> `scr_turntimer(450)` (`Other_23:417` A / `:1110` B). **Both sides get 450.**
> There is no 15.1 side difference and nothing to preserve. Pinned by
> check-weirdroute so it cannot be "fixed" back into a divergence. (Moot in
> practice anyway: `atk_Tunnel2theSecond` sits in Other_24's
> *"Unused/Old Attacks"* block, `Other_24:330-338`, and nothing points at it.)

### 4.3 Per-arm dispatch differences

Beyond the swapped nodes, the B-Side arms that the D table actually reaches
differ only in `scr_turntimer` values and one difficulty: **ac 0 Crescent
Slash chains tracking swords at `difficulty 6.1` instead of `6`**
(`Other_23:843` vs `:176`), and **ac 13 phase 2 uses rotating slash
`difficulty 2` instead of `1`** (`Other_23:403` vs `:289`). Both are already
implemented in the kaizo modules (§6-A).

---

## 5. THE invc 0.7 CAP — what it does to the feel

```gml
if (global.invc > 0.7)      // Other_23:1316-1319
{
    global.invc = 0.7;
}
```

One test, at the very bottom of `kaizo_setAttack_sideb`'s `arg0 == 1` block,
*after* every arm has assigned. `global.invc` is the multiplier on the soul's
post-hit invulnerability: `state.invTimer = state.invc * 30`
(`sim/damage.js:474/498/615`, `sim/knight.js:499`), i.e. **seconds of mercy**.

Measured across the whole 27-row chain (check-weirdroute §4c):

| | values `global.invc` takes | max |
|---|---|---|
| A-Side (V-C) | 0.4, 0.66, **0.8**, **1** | 1 |
| B-Side (V-D) | 0.4, 0.66, **0.7** | 0.7 |

So the cap bites on every turn that asked for 1 — Starstorm (all four),
Crescent Slash, Multislash 1/2/3, Rising Abyss, Frenzy 2's underbox half,
Swords 2, XAttacks — and on Swords 3's 0.8. Roughly **half the fight loses
30 % of its mercy window**: 30 frames becomes 21, and 24 becomes 21. Turns
that were already tight (0.4 = 12 frames on the splitter/tunnel/tracking
family; 0.14 = 4 frames on the sword tunnel) are **untouched**, which is the
interesting part: the cap does not make the hardest turns harder, it removes
the *recovery* turns. On the A-Side a Starstorm hit buys a full second to
re-centre; on the B-Side it buys 0.7 s, and Starstorm is the phase opener
every lap.

Note also that a B-Side hit is *smaller* but *lingers*: `scr_damage`'s side-B
preamble cuts any bullet over 120 by 20 % (`if (damage > 120) damage =
ceil(damage * 0.8)`, `gml_GlobalScript_scr_damage.gml:12-16`) and converts
`ceil(damage / 6)` (minimum 10) into GLOOM instead
(`gml_GlobalScript_scr_damage.gml:5-11`). Less mercy, softer hits, a bleed
that keeps ticking. **That trade is the B-Side's whole design.**

---

## 6. THE INVENTORY

### 6.A ALREADY TRANSLATED

`kaizo/attacks/` — kaizo-owned copies of the verified sim modules with the
mod's deltas applied. Each carries its own check under `kaizo/tools/checks/`.
The **k_sideb branches each one already implements**, read from the module
headers and their `sideb()` sites:

| module | wired into the launcher? | B-Side branches it implements | mod source |
|---|---|---|---|
| `stars-controller.js` | yes | the starry (exploding-star) schedule: B-Side d3.1 explodes odd `starid`, otherwise 3 of every 4 | `gml_Object_obj_dbulletcontroller_Step_0.gml:2027-2040` |
| `stars-pointing-star.js` | yes | the `!kaizo_sideb()` gate on the d3.1 blast table; B-Side ignores `split_blast` parity in the beam draw | `gml_Object_obj_knight_pointing_star_Step_0.gml:26`, `_Draw_0.gml:46` |
| `stars-pointing-starchild.js` | yes | the fade gate `difficulty <= 2 \|\| (difficulty == 3.3 && !kaizo_sideb())` — B-Side 3.3 children never fade | `gml_Object_obj_knight_pointing_starchild_Draw_0.gml:39` |
| `stars-pointing-cone.js` | yes | (no B-Side branch; the `stay = 1` lingering-star rework is side-agnostic) | `gml_Object_obj_knight_pointing_cone_Step_0.gml` |
| `tracking-swords.js` | yes | variant 4's B-Side **endless chain** (multiswordframes 12 / max 99); telegraph fade 19 vs 20; variants 3.1, 6.1 and **11** (the ac-112 frostveil) | `gml_Object_obj_tracking_swords_manager_Other_10.gml:65-69`, `gml_Object_obj_tracking_sword1_Step_0.gml:42` |
| `rotating-slash.js` | yes | `var _adj = kaizo_sideb() * 1` combo pacing; the B-Side post-volley bullet rings; the 42/56-slash finale; the ac-111 `kaizo_vortexend_step` handoff at CleanUp | `gml_Object_obj_knight_rotating_slash_Step_0.gml`, `_CleanUp_0.gml:16-43` |
| `sword-vortex.js` | yes | `movespeed = 120 − (k_sideb * 20)` on ac 111; `kaizoVortexendFreeze` (the frozen-blade turn end) | `gml_Object_obj_sword_vortex_manager_Create_0.gml:165` |
| `flurry-*` (5 files) | yes | d3's B-Side `spawn_speed 37` (vs 39); splitslash's B-Side d3 wide-scatter roll restored as an extra draw; growtangle's B-Side tooth speeds | `gml_Object_obj_roaringknight_boxsplitter_attack_Step_0.gml:22`, `gml_Object_obj_roaringknight_splitslash_Step_0.gml:12`, `gml_Object_obj_knight_split_growtangle_Step_0.gml:15, 183` |
| `knight-stream.js` | yes | the cascade `54px/3f → 48px/2f` and cycle `45f → 42f` (`40 − sideb*3`, `45 − sideb*3`) | `gml_Object_obj_knight_stream_Step_0.gml`, `gml_Object_obj_bullet_knight_stream_Step_0.gml` |
| `underbox.js` | yes | cadence `29 → 27` under `kaizo_sideb()` | `gml_Object_obj_knight_weird_bottom_manager_Create_0.gml:39` |
| `swordfall.js` | yes | `_swinc = 0.08` and `countdown = 12 − kaizo_sideb()*3`; d10/d11 | `gml_Object_obj_knight_swordfall_Step_0.gml:77-80, 176` |
| `knightlines.js` | yes | the ac-110 carousel's `1 + kaizo_sideb()` terms | `gml_Object_obj_knight_tunnel_slasher_Other_21.gml` |
| `sword-tunnel.js` | yes | d4 gap `40 → 30` on the B-Side; the new d4.1 / d10 / d11 tiers (d10 is the ac-101 half) | `gml_Object_obj_sword_tunnel_manager_Other_10.gml:48` |
| `quickslash.js` | yes | `endtype = 1` (ac 105.1), `spawn_speed 12.4` + fractional accumulator, the extra vertical in the spawner, and 97.1's non-pinning clock | `gml_Object_obj_dbulletcontroller_Step_0.gml:1974-1977`, `gml_Object_obj_roaringknight_quickslash_attack_Create_0.gml`, `_Other_13.gml` |
| `roaring-final.js` (+ `-star`, `-shatter`) | yes | 12 sideb sites: `staramt 8` vs 7, the ×0.55 spiral ramps, `attack_max == (9 − kaizo_sideb())`, the B-Side curtain timings | `gml_Object_obj_knight_roaring2_Other_11.gml`, `_Other_22.gml`, `_Draw_0.gml` |

**Still the VANILLA sim module**, so their B-Side retunes are *not* in V-D even
though the D chain launches all three every lap — see §6.C item 3:
`sim/attacks/sword-tunnel-revised.js` (type 102, ac 15 Tunnel 2),
`sim/attacks/diagonal-bullets.js` (type 152, ac 12 Diamond Storm),
`sim/attacks/swordslash.js` (type 109, ac 0 Crescent Slash),
`sim/attacks/combination.js` (type 105, ac 106 Frenzy 3).

Schedule/dispatch, already wired and asserted:
`kaizo/versions/vc-script.js` (`VD_TABLE` = the five k_sideb swaps),
`kaizo/scenes/kaizo-mod-launcher.js` (`sidebArm`, `arenaGeom(row, true)`,
`vcTurnLength(row, {sideb:true})`, the 0.7 cap at `launchVCAttack`'s tail),
`kaizo/scenes/kaizo-vc-hooks.js` (`vcHooks({ sideb: true })`),
`kaizo/scenes/kaizo-fight.js` (`KAIZO_VERSIONS.D`, `state.kaizo.sideb`).

### 6.B BEING BUILT NOW

Three sibling agents, against the shared `state.kaizo` interface. **This
document does not import their files and the gate does not assert on them**;
this section is the spec they are being measured against. As of writing they
have landed as `kaizo/party/roster.js`, `noelle.js`, `heroes.js`, `damage.js`,
`freeze.js`, `gloom.js` and `tensionbar.js`, with `check-freeze` and
`check-gloom` under `kaizo/tools/checks/` — reported by `verify-kaizo` but not
yet in its `WIRED` set. **Reconcile this section against those files before
treating it as current**; it is written from the GML, not from them, so where
the two disagree the GML citations here are the ones to re-read.

**B-1 — the roster / Noelle.** `state.kaizo.roster` (length 2 for the Weird
Route, `[Kris, Noelle]`, `charId` 1 and 4), `state.partyHp` slot-indexed and
never assumed length 3. Must carry: Noelle's 120/5/13/1
(`gml_GlobalScript_scr_gamestart_chapter_override.gml:55-59`), her ×0.5
incoming (`gml_GlobalScript_scr_damage.gml:157-160`), the `spr_noelleb_*_sideb`
sprite set (`gml_Object_obj_heroparent_Create_0.gml:201-214`), the
`scr_fixparty` canonical order
(`gml_GlobalScript_kaizo_settings_init.gml:327-379`), and the two-slot Kris
multiplier ×1.5/×2.5 (`gml_Object_obj_heroparent_Step_0.gml:377-388`). The sim
sites that hardcode three members and therefore need kaizo copies: `PARTY` and
`PARTY_POS` in `sim/damage.js`, the `PARTY` sprite/position table in
`sim/actors.js`, `sim/heroes.js`, `sim/menu.js`.

**B-2 — `k_freeze`.** `state.kaizo.freeze[]`, slot-indexed per the interface
contract; the **mod's own array is char-indexed** (`k_freeze = [0,0,0,0,0]`,
`gml_Object_obj_knight_enemy_Create_0.gml:120`), so the translation must map
at the boundary and say so. Set in exactly one place —
`gml_Object_obj_knight_enemy_Step_0.gml:1718`, inside the SnowGrave scene,
when the target's HP reaches 0. Cleared at `:1326` (`endcon == 1 && endtimer >
45`) and in `gml_Object_obj_heroparent_CleanUp_0.gml:1-5`. Effects: the party
member is replaced by an `obj_frozennpc` statue spawned **from the Draw event**
(`gml_Object_obj_heroparent_Draw_0.gml:15-40` — a Draw-event side effect that
must live on the sim frame, not the paint); heals and spells targeting them are
skipped and the action is *wasted*
(`gml_GlobalScript_scr_healall.gml:8`, `_healallitemspell.gml:10`,
`_healitemspell.gml:6`, `gml_GlobalScript_scr_spell.gml:47/189/281`,
`gml_GlobalScript_scr_spelltext.gml:110/289`); the down-message changes per
character (`gml_Object_obj_knight_enemy_Step_0.gml:597, 613, 624`).
> **ORIGINAL BUG to preserve:** `gml_Object_obj_heroparent_CleanUp_0.gml:6-10`
> sets `herofrozen = -99` **before** `instance_destroy(herofrozen, false)`, so
> the statue is never destroyed — it leaks. Keep it; label it.

**B-3 — GLOOM + TP.** `state.kaizo.gloom[]`. The DoT engine is
`gml_Object_obj_knight_enemy_Step_2.gml:15-45`, char-indexed `i = 1..4`: while
`k_gloom[i] > 0`, a counter `k_glt[i]` ticks and at `ceil(max(18 −
k_gloom[i]/5, 1))` frames it emits and, **only during the bullet phase**,
decrements both `k_gloom[i]` and `global.hp[i]` by 1. So gloom drains faster
the deeper it is (18 frames/HP at 1 gloom, 1 frame/HP at ≥85) and pauses
outside bullets. `global.hp[i] < 0` clears it. Accrual:
`gml_GlobalScript_scr_damage.gml:5-11` (`ceil(damage/6)`, floor 10) and
`:245-264` — clamped to `hp − 1` (**gloom can never kill**) and capped at 45;
`gml_GlobalScript_scr_damage_maxhp.gml:245-259` accrues the same way **with no
45 cap** (asymmetric — preserve). Zeroed when `hp <= 1` or in practice mode.
Plus the `scr_charbox` slot+1 divergence in §2.3.
The **TP clamp is scene-gated, not a blanket rule**:
`gml_Object_obj_tensionbar_Draw_0.gml:36` runs the kaizo bar (sprites
4992/4991, no "TP" text, bleed particles) and the `clamp(…, 0, 125)` at l.91-93
only when `k_tpscene >= 10 || k_tpscene == -1`. `k_tpscene` starts at 1 in
`gml_GlobalScript_scr_mnendturn.gml:152-159` — end of the turn after
`atk_Frenzy1` (phase 1's last node), if `!haveusedroaring` — and the Knight
physically **cuts the bar in half** at `gml_Object_obj_knight_enemy_Step_0.gml:1981-2006`
(`spr_tensionbar_sliced_top` flung off with gravity). Before that scene, max
TP is the vanilla 250.

### 6.C NOT YET BUILT — ranked

Ranked by how much of the *played* B-Side fight each unblocks. **All 27 chain
rows dispatch today** — the V-D approx ledger is down to three rows (items 1-2)
plus the four vanilla-module turns in item 3. Items 4-6 are the layer the fight
is *about*; 7-10 are context around the fight.

*Ledger, measured on a full V-D chain walk (seed 12345):*

```
type 97.1  spr_rk_quickslash_marker_gradient mask geometry
             -> spr_rk_quickslash_marker mask (250x46, full)
type 97.1  obj_knight_split_growtangle_vertical (Side B vertical finish)
             -> obj_knight_split_growtangle with vertical = true
type 105   combination 1-2-5 -> vanilla 4-2-3 chain          (atk_Frenzy3)
```

1. **`obj_knight_split_growtangle_vertical` — the ac-105.1 vertical finish.**
   The only approximation that is *B-Side-specific*: the endtype-1 quickslash
   ends in a dedicated vertical splitter object, currently stood in for by the
   horizontal `obj_knight_split_growtangle` with a `vertical` flag. It also
   swaps `obj_heart.mask_index` to the 2 px mask
   (`gml_Object_obj_knight_split_growtangle_vertical_Step_0.gml`) — and the
   restore site is still an open question (`deltas/INDEX.md` open question 11).
   Phase 3's last node chains back to Quickslash (`Other_24:266`), so this is
   the highest-frequency turn in the fight; it is the largest remaining V-D
   gap. **Item 1 by a distance.**
2. **The quickslash gradient marker mask** (asset geometry, shared with V-C)
   and **the combination's 1-2-5 segment order** for `atk_Frenzy3`
   (`Other_23:318` / `:434` — both sides ask for sub-attacks 1, 2, 5; the
   module runs the vanilla 4-2-3 chain; `deltas/INDEX.md` open question 4).
3. **The four turns still running a VANILLA sim module**, each with a B-Side
   retune that is therefore missing from V-D:
   * ac 12 Diamond Storm → type 152. B-Side **alternates the spawn side on odd
     rows** and adds a ±6 px zigzag
     (`gml_Object_obj_diagonal_bullet_manager_Step_0.gml:10-13, 21-25`), on top
     of the shared dmg-103/lifetime-180 retune.
   * ac 15 Tunnel 2 → type 102. B-Side cadence 8→6 and the 38 px clearance
     clamp (`gml_Object_obj_knight_tunnel_slasher_2_revised_Step_0.gml:209, 368`).
   * ac 0 Crescent Slash → type 109. Crescent dmg 206→153 and the wind-down
     snap-fire (side-agnostic), but the turn's *other* half — tracking swords
     at **d6.1** instead of d6 (`Other_23:843`) — is already covered.
   * ac 106 Frenzy 3 → type 105 (item 2).
4. **The GLOOM engine + the damage pipeline** (B-3 above). Until this lands,
   V-D is the A-Side fight with a smaller box and less mercy — the trade in §5
   is not being played.
5. **`k_freeze` and the frozen statue** (B-2). Only reachable through the
   SnowGrave scene, so it depends on item 6.
6. **The B-Side scenes — the missing third of the fight.** All three hijack a
   whole turn via `special_con = 1; global.myfight = 99; global.mnfight = 99;
   global.charturn = -1`:
   * **`k_tpscene`** — `gml_GlobalScript_scr_mnendturn.gml:152-159` +
     `gml_Object_obj_knight_enemy_Step_0.gml:1930-2049`. The Knight slices the
     TP bar; from then on TP caps at 125.
   * **`k_sgscene`** — armed by the *player* casting SnowGrave
     (`gml_Object_obj_knight_enemy_Step_0.gml:1543-1545`, `k_sgscene = 1` when
     `obj_spell_snowgrave` exists), then a 9-state cutscene at `:1547-1790`.
     The spell itself is **neutered**: its damage block is wrapped in
     `if (!i_ex(obj_knight_enemy))` (`gml_Object_obj_spell_snowgrave_Draw_0.gml:165`),
     so SnowGrave does nothing to the Knight — instead the mod commandeers the
     snowflakes (a new `con` state machine in
     `gml_Object_obj_spell_snowgrave_snowflake_Create_0.gml:6-11`,
     `_Step_0.gml`, `_Draw_0.gml`) and turns them on the party. Target picked
     by `scr_picktarget_weighted(5, 4, 3, 1)` (`:1562`); damage
     `irandom_range(75, 125)` per tick; **Noelle is exempt** — for her the tick
     is `round(_frdmg / 16)` and clamped to `hp − 1`, so she can never be
     frozen (`:1699-1723`). This is the only writer of `k_freeze`.
   * **`k_nhscene`** — `gml_GlobalScript_scr_mnendturn.gml:160-167`, fires at
     `progamer && turnsafternohit == 7`; body at
     `gml_Object_obj_knight_enemy_Step_0.gml:1408-1541`. A no-hit-run reward
     scene, with the Knight's `\ck` taunt register.
7. **The B-Side ACT and dialogue layer.** `X-Slash` is a **B-Side-only ACT**
   added at `gml_Object_obj_knight_enemy_Step_0.gml:42-55` (actor 11, cost
   62.5, "Physical damage"). The B-Side also suppresses the Susie balloon
   exchange entirely (`balloonturn = -1`, `:206`), swaps Susie's sprites to the
   serious/unhappy set (`:65-72`), rewrites CHECK
   (`gml_Object_obj_knight_enemy_Other_23.gml:4-9` — *"Kris tried to analyze
   the enemy, but they froze."*), changes Kris's and Noelle's down-messages
   (`:593-596`, `:635-640`), and adds the Knight's no-hit taunts at `:686-699`
   and `:760-770`.
8. **The remaining small B-Side retunes**, none of which any wired module
   covers yet: diagonal bullets alternate sides and zigzag
   (`gml_Object_obj_diagonal_bullet_manager_Step_0.gml:10-13, 21-25`); the
   lightorb becomes `type = 1` (`gml_Object_obj_knight_lightorb_Create_0.gml:11`)
   and `obj_knight_bullethell2` gains B-Side-only reach
   (`gml_Object_obj_knight_bullethell2_Step_0.gml`); the diamond-sword dash
   windup is faster (`gml_Object_obj_knight_diamondswordbullet_ext_Other_10.gml:36`);
   the revised tunnel's cadence 8→6 and 38 px clamp
   (`gml_Object_obj_knight_tunnel_slasher_2_revised_Step_0.gml:209, 368`).
9. **The endings.** Victory routes through
   `gml_Object_obj_ch3_PTB02_Step_0.gml:607-619`: the Knight's death sets
   `global.flag[50] = 0; global.flag[51] = 1`
   (`gml_Object_obj_knight_enemy_Step_0.gml:1325-1333`), `Other_13` recomputes
   `global.flag[50] = 1` from it (`gml_Object_obj_knight_enemy_Other_13.gml:76-79`),
   and PTB02 reads `defeated = global.flag[50] == 1` → `con = 49`, **then
   `if (con == 49 && global.flag[456]) con = 49.1`** (l.616-619). `Alarm_0` is
   a bare `con++` (`gml_Object_obj_ch3_PTB02_Alarm_0.gml`), so 49.1 → 50.1 →
   50.2 and the B-Side epilogue runs at l.1181-1775 (~595 lines, `sb_con`
   0→1→2→3→4→99).
10. **The Gaster game over.** `gaster_sideb = global.flag[456]`
    (`gml_Object_DEVICE_FAILURE_Create_0.gml:21`) rewrites six message beats
    (`gml_Object_DEVICE_FAILURE_Step_0.gml:275, 324, 334, 344, 380, 430`) and,
    at `knight_mode_con == 50`, replaces `GO BACK / GO FORWARD` with
    **`PROCEED#(PROCEED)` on both sides** (l.384-385) — the Weird Route's
    refusal to offer a way out. Choosing either routes to `knight_mode_con =
    53` instead of 55 (l.430-437).

Out of scope for the sim as it stands (recorded so nobody re-derives them):
the alternate battle track (`kaizoknight_alt.ogg`, "NUZLOCKE" —
`gml_GlobalScript_kaizo_settings_init.gml:45-77`), the encounter intro string
(`gml_GlobalScript_scr_encountersetup.gml:715-718`), and Noelle's battle-intro
sprite off `scr_sideb_get_phase()`
(`gml_Object_obj_encounterbasic_Create_0.gml:39-43`).

---

## 7. What the gate pins

`kaizo/tools/checks/check-weirdroute.mjs` — 108 positive assertions over what
is wired today. It imports nothing from `kaizo/party/` and nothing from the
in-flight roster/freeze/gloom modules, so it can be run at any point in the
build without a dependency on work that is still landing:

1. `VD_TABLE` differs from `VC_TABLE` in **exactly** the five `Other_24:343-350`
   fields — the "and nothing else" half is what catches drift.
2. Version D builds, stamps `state.kaizo.sideb === true` (C stamps `false`),
   steps 900 frames deterministically, and re-runs byte-identically; a
   different seed differs.
3. The V-D launch ledger walks the B-Side chain row for row, and **actually
   launches** ac 101 / 112 / 105.1 while never launching 3 / 17 / 105 — with
   the A-Side run asserted to be the exact mirror, so the swap cannot pass
   vacuously.
4. The 0.7 cap: ac 5 / 1 / 101 ask 1 and land on 0.7, ac 14 asks 0.8 and lands
   on 0.7, while ac 102 (0.66), 104 (0.5) and 112 (0.4) pass through untouched
   — *and* over the whole chain the B-Side never exceeds 0.7 while the A-Side
   reaches 1.
5. All seven B-Side arena entries, both sides pinned, plus a drift check that
   the other twelve are identical.
6. The turn clocks, including the ac-110 `0 → 240` consequence of the leading
   `scr_turntimer(240)`, and the §4.2 retraction.
7. This document: it exists, carries the publish gate, credits EnderCat8, has
   its three inventory sections, and **every `gml_*.gml` it cites is a real
   file in the dump** (skipped cleanly when the private research repo is
   absent).
