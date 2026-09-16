// NO BULLET COOLDOWNS — a translation of SOMEONE ELSE'S MOD.
//
// ─── WHOSE WORK THIS IS ────────────────────────────────────────────────────
//
// `No Bullet Cooldowns` for DELTARUNE Chapter 3 is **tronic560's**, released
// on GameBanana as `nobulletcooldownsCh3_v1.5.0.xdelta`:
//
//     gamebanana.com/mods/587241
//
// Nothing in this file is an idea of ours. Every number below was read out of
// a decompile of that mod's own patched `data.win` — the xdelta applied to a
// Chapter 3 `data.win` whose sha256 matched the checksum the mod ships, then
// dumped with UndertaleModCli and diffed against a dump of the SAME unpatched
// file. Each site carries the GML object, the line number and both sides of
// the change, so a reader can check any one of them against the mod rather
// than against us. The same rule `kaizo/ui/credits.js` follows for EnderCat8:
// a build that recreates someone's work says so where the work lives.
//
// THE MOD'S CHANGELOG DISAGREES WITH THE MOD, and the code wins. `NBC Nerfs
// and Changes v1.5.0.txt` says "Increased damage of Knight's Box Splitter
// attack from 206 to 242". That IS in the code — `obj_roaringknight_splitslash`
// Create line 18, `damage = 206` -> `242`, the site D6 below. What the prose
// leaves out is that FIVE SEPARATE `dc.damage = 206` sites in
// `obj_knight_enemy`'s Step become **103**, halved, and those are the tracking
// swords and the sword vortex, not the box splitter. Both are real; they are
// different attacks; the changelog names one and the dump carries both.
//
// FIVE, NOT SIX: the vanilla Step holds SIX `dc.damage = 206` lines — 465, 491,
// 500, 505, 518 and 527 — and the mod edits every one except **518**, which is
// ac 16's tracking swords. Counted off the dump rather than off the diff, and
// the exemption is carried at site D1 in sim/attacks/tracking-swords.js.
//
// ─── WHAT THE MOD ACTUALLY DOES ────────────────────────────────────────────
//
// It slashes SPAWN-INTERVAL TIMERS. The purest example is the roar's fan:
//
//     obj_knight_roaring2_Step_0.gml:417
//     -   if (roaring_timer > 15 && (roaring_timer % 5) == 0)
//     +   if (roaring_timer > 15 && (roaring_timer % roaring_timer) == 0)
//
// `x % x` is 0 for every non-zero x, so the guard is ALWAYS TRUE and a fan
// that fired every fifth frame now fires every frame. That is the mod's whole
// thesis, applied attack by attack, and it is why the nerfs travel with it:
// at this density the vanilla damage numbers are unsurvivable.
//
// ─── THE SWITCH, AND WHY `OFF` IS WRITTEN THE WAY IT IS ────────────────────
//
// `state.noBulletCooldown` is false on every state `createState` builds, and
// the drivers set it from the CONTROLS row before the scene is built. EVERY
// call site below is written so that the OFF branch is the EXPRESSION THAT
// WAS THERE BEFORE, character for character — never `interval * 1` and never
// a reordered condition.
//
// That is not fastidiousness. The kaizo byte gate replays recorded fights
// bullet for bullet, and every bullet this fight spawns draws from the shared
// `gmlRng` stream. One extra spawn, or one RNG draw taken in a different
// order, shifts the whole stream and every later bullet lands somewhere else.
// A knob whose OFF path merely *computes the same answer* is not good enough;
// it has to BE the same path. `tools/verify-nbc.mjs` asserts that both ways.
//
// ─── THE SITE TABLE ────────────────────────────────────────────────────────
//
// MECHANIC — the spawn-timer changes, the mod's actual subject:
//
//   M1  obj_knight_roaring2_Step_0.gml:417   roar fan: `% 5` -> `% roaring_timer`
//       sim/attacks/roaring.js               (every 5th frame -> every frame)
//   M2  obj_knight_roaring2_Step_0.gml:174   ring gate: drop `starcount_p1 == 1`
//       sim/attacks/roaring.js               (1 beat in 3 -> every beat)
//   M3  obj_knight_roaring_star_Step_0.gml:35 `timer >= 40` -> `timer >= 2`
//       sim/attacks/roaring-star.js          (the star's burst, 40f -> 2f)
//   M4  obj_roaringknight_boxsplitter_attack_Step_0.gml:62
//       sim/attacks/boxsplitter-attack.js    `timer >= spawn_speed` -> `>= 33`
//   M5  obj_sword_tunnel_manager_Step_0.gml:18 (INSERTED) `rate = -999;`
//       sim/attacks/sword-tunnel.js          (a sword pair every frame)
//   M6  obj_knight_tunnel_slasher_Step_0.gml:26 (INSERTED) `behavior = "slash";`
//       sim/attacks/knightlines.js           (the 16-frame wind-up is skipped)
//   M7  obj_tracking_swords_manager_Step_0.gml:6  the spawn gate gains `|| true`
//       sim/attacks/tracking-swords.js       (a sword EVERY frame, on ac 11,
//                                             14, 15, 16 and 17 — the largest
//                                             single change the mod makes here)
//
// DAMAGE — the nerfs and buffs that travel with the density:
//
//   D1  obj_knight_enemy_Step_0.gml:465/491/505/527  `dc.damage = 206` -> 103
//       sim/attacks/tracking-swords.js       (tracking swords, ac 11/14/15/17)
//   D2  obj_knight_enemy_Step_0.gml:500      `dc.damage = 206` -> 103
//       sim/attacks/sword-vortex.js          (the sword vortex, ac 15)
//   D3  obj_knight_pointing_star_Other_15.gml:2       `damage = 75` -> 100
//       sim/attacks/pointing-star.js
//   D4  obj_knight_pointing_starchild_Other_15.gml:37 `damage = 75` -> 100
//       sim/attacks/pointing-starchild.js
//   D5  obj_roaringknight_slash_Other_15.gml:4        `damage = 75` -> 69
//       sim/attacks/roaringknight-slash.js   (the AOE branch only; the
//                                             single-target 206 is untouched)
//   D6  obj_roaringknight_splitslash_Create_0.gml:18  `damage = 206` -> 242
//       sim/attacks/splitslash.js            (the changelog's "box splitter")
//   D7  obj_knight_enemy_Other_12.gml:8               `damage = 40` -> 15
//       sim/knight.js                        (the ROARING catch, all three)
//
// VISUAL — the mod's own art direction:
//
//   V1  obj_growtangle_Create_0.gml:8   the arena's tint
//       sim/battlebox.js                `merge_color(c_green, c_lime, 0.5)`
//                                       -> `make_color_hsv(0, 255, 255)`
//
// TEXT — cosmetic, and all of it in this file:
//
//   T1  obj_knight_enemy_Step_0.gml:36 and :590   "Knight" -> "Roaring Knight",
//       and -> "Roaring Fraud" below `global.monsterhp[myself] < 5840`
//   T2  obj_knight_enemy_Step_0.gml:603-661       the fifteen battle messages
//   T3  obj_knight_enemy_Step_0.gml:684           the progamer line
//   T4  obj_knight_enemy_Step_0.gml:712/719/726   the three knockdown lines,
//       one of which gains a `balloonturn >= 6` variant
//
// ─── THE SITE THAT IS *NOT* HERE, AND WHY ──────────────────────────────────
//
//   obj_dbulletcontroller_Step_0.gml:2128, the `dc.type == 104` arm:
//
//       -   if (made == false)
//       +   if (instance_number(obj_knight_rotating_slash) < 30)
//
//   The rotating-slash turn spawns ONE manager in vanilla; under the mod the
//   controller keeps spawning them every frame until THIRTY are alive. This
//   sim has no `obj_dbulletcontroller`: `sim/scenes/fight.js` calls
//   `spawnRotatingSlash` once, directly, so the change has nowhere to live in
//   this lane's files. It is a real mechanic and it is unimplemented.
//
//   `obj_tracking_swords_manager_Create_0.gml:10` (`for (i = 0; i < 50)` ->
//   `3000`) only pre-fills the `setdirection` array further; see
//   sim/attacks/tracking-swords.js for what that is worth here.
//
// ─── THE SITE THAT IS DEAD IN THE REAL GAME TOO ────────────────────────────
//
//   `obj_knight_slasher_Step_0.gml:29` — the mod INSERTS one line immediately
//   above `if (state == "slash")`:
//
//       +   state = "slash";
//
//   Read on its own this is M6's trick again: the object's "move" arm reaches
//   `state = "move"` at :109, and the insert forces it back on the next Step,
//   so the slasher would never reposition and would slash without pause.
//
//   IT NEVER RUNS, IN THE MOD OR IN THE GAME. `obj_knight_slasher` has exactly
//   one creator in the whole dump — `obj_dbulletcontroller_Step_0.gml:2073`,
//   inside the `if (type == 100)` arm — and **nothing anywhere assigns
//   `type = 100`**. Checked mechanically over all 7,603 vanilla code entries:
//   `dc.type` is written for 0, 101..108 and the rest, never 100.
//   `obj_knight_enemy`'s Step, the only thing that picks an attack, gets no
//   further than `dc.type = 101` (:538). So the arm is unreachable, the object
//   never exists, and the inserted line cannot fire.
//
//   It is therefore NOT modelled here and there is nothing to model it into:
//   no `myattackchoice` reaches it, so it has no place in `ATTACK_MENU`
//   either. Distinct from `obj_knight_tunnel_slasher` (M6), which IS modelled
//   in sim/attacks/knightlines.js — the two names differ by one word and the
//   change is the same shape, which is exactly why this note is explicit.
//
// ─── MOD-BUILD DRIFT, WHICH IS NOT A CHANGE TO COPY ────────────────────────
//
//   `obj_knight_split_growtangle` comes back from the patched dump SHORTER
//   than vanilla — 283 lines against 301 — and what it is missing is vanilla
//   FEATURES, not cooldowns:
//
//     * Step:26 the whole `if (diagonal) { ...45/135/225 marker angles... }`
//       arm is gone, and the `else if (vertical)` / `else` arms lose the
//       `+ xoffset` / `+ yoffset` terms they carry here.
//     * the `effect` Draw's `draw_surface_part_ext(surf, _sx, ...)` becomes
//       `(surf, 0, ...)`.
//     * Step:91 `_splitter = 182;` becomes `_splitter = 910;` in the `else`
//       arm that reuses the live growtangle.
//
//   The Create still declares `diagonal`, `xoffset` and `yoffset` in BOTH
//   dumps, so the mod's copy of this object sets fields its own Step no longer
//   reads. That is the signature of an older build of one object being carried
//   into the patch, not of an edit anyone made on purpose — and translating it
//   would mean DELETING the diagonal splitter this sim already models. Left
//   alone, on the rule that the mod's subject is spawn timing.
//
//   RE-EXAMINED, BECAUSE A DELETED BLOCK IS EASY TO WAVE THROUGH AS A NO-OP.
//   Two findings, and they point opposite ways from "cooldown mod":
//
//     * THE EFFECT DRAW IS A BUG, NOT A CHANGE. The one edit there is
//       `draw_surface_part_ext(surf, _sx, 0, 640 - _sx, ...)` becoming
//       `(surf, 0, 0, 640 - _sx, ...)` — the SOURCE x of the right half's
//       blit. Vanilla reads the surface from `_sx` across; the patched copy
//       reads from 0, so the right half of the split would be painted with
//       the LEFT half's pixels. No one mods that in; it is the pre-fix state
//       of a rendering bug a later game build corrected.
//     * WHAT LOSING THE `if (diagonal)` ARM WOULD DO, MEASURED rather than
//       assumed: with the arm gone a diagonal split falls through to the
//       vertical/horizontal arms, so `marker[0]`/`marker[1]` — the two
//       `obj_marker`s carrying `spr_rk_split_flame_big`, the burning cut
//       faces — are placed off the diagonal and turned 45 degrees away from
//       it. Over four seeds x flag on/off, 1,495 diagonal-split frames, that
//       is EVERY such frame moved, by up to 53.45px and 45 degrees; dropping
//       `+ xoffset`/`+ yoffset` moves them a further 15.76px max over 5,101
//       offset frames. It is visual ONLY: `splitFlameMarker` has no mask, no
//       Step and no collision, and the soul push, the teeth and the split
//       bullets all read the organism's own x/y/distance, never the markers.
//       So translating it would misplace the flames on the hardest
//       difficulty's signature cut and add no bullet — the worst trade
//       available.
//
//   `_splitter = 182;` -> `910;` IS AN OBJECT INDEX, checked this time rather
//   than argued from occurrence counts (the earlier count-conservation
//   argument is withdrawn: an index that appears UNRESOLVED in exactly one
//   place moves in exactly one place, so a single moved site proves nothing).
//   The proof is two vanilla anchors that this repo already measured, in
//   `sim/data/object-order.js`'s own provenance note:
//
//     * vanilla `obj_knight_enemy` = **345**, and the vanilla dump prints
//       `knight = 345;` inside `if (i_ex(obj_knight_enemy))` in BOTH
//       `obj_roaringknight_boxsplitter_attack_Create_0.gml:35` and
//       `obj_roaringknight_quickslash_attack_Create_0.gml:35`. The patched
//       dump prints `344`. Same object, two builds, two indices.
//     * vanilla `obj_knight_split_growtangle` = **182** — which is the value
//       in front of us. And the site is unambiguous: the `if` arm above it
//       does `_splitter = instance_create(..., obj_knight_split_growtangle)`,
//       the `else` arm assigns 182, and the next line dereferences
//       `_splitter.xoffset`. The source read `_splitter =
//       obj_knight_split_growtangle;` and the decompiler printed the index.
//
//   So this is the decompiler showing the same object's index under two
//   different object tables, and the size of the delta is not evidence of
//   anything: object-order.js measured that **1,550 of 1,731** entries differ
//   between vanilla's table and a rebuilt mod's. Indices are reshuffled
//   wholesale, not shifted — a +728 move is ordinary there. The "-1..-5
//   renumbering band" that kept this hunk in the brief is the CODE-entry
//   index space (five entries removed: `obj_ch3_couch_video`'s Other_5 and
//   four `room_board_dungeon_2_*` creation codes); OBJECT indices are a
//   different space with no such band. NOT IMPLEMENTED, and implementing it
//   would mean writing a number with no meaning in this sim into a file.
//
//   Every other bare number in the diff (`367/366`, `806/803`, `633/631`,
//   `548/546`, `1175/1174`, `672/670`, `345/344`, `793/790`, `1186/1185`, and
//   the sprite ids `4402/4401`, `4962/4961`, `4320/4319`) is the same thing.

/**
 * THE ONE READER. `state.noBulletCooldown` is a plain boolean the driver sets
 * before the scene is built; anything that never sets it is vanilla, and a
 * state object from an older build (no such field) reads `undefined` and is
 * vanilla too.
 *
 * `=== true` rather than a truthiness test on purpose: the flag arrives from
 * `localStorage` through `JSON.parse` in both drivers, and a persisted `"on"`
 * string turning the mod on for someone who never asked is exactly the kind
 * of accident the drivers' `typeof === 'boolean'` guards exist to prevent.
 */
export function nbcOn(state) {
  return state?.noBulletCooldown === true;
}

// ─── D-SITE CONSTANTS ──────────────────────────────────────────────────────
//
// Named rather than inlined so `tools/verify-nbc.mjs` asserts the same numbers
// the attacks read, and so a reader can grep one name and find both.

/** D1 — `dc.damage = 206` -> 103 on the tracking-swords dispatches. */
export const NBC_TRACKING_DAMAGE = 103;
/** D2 — `dc.damage = 206` -> 103 on the ac-15 sword vortex. */
export const NBC_VORTEX_DAMAGE = 103;
/** D3/D4 — the pointing star and its children, `75` -> 100. */
export const NBC_POINTING_DAMAGE = 100;
/** D5 — the roaring-knight slash's AOE branch, `75` -> 69. */
export const NBC_SLASH_AOE_DAMAGE = 69;
/** D6 — the split slash, `206` -> 242. The changelog's one honest number. */
export const NBC_SPLITSLASH_DAMAGE = 242;
/** D7 — the ROARING catch, `damage = 40` -> 15, per member. */
export const NBC_CATCH_DAMAGE = 15;

/** M4 — `if (timer >= spawn_speed)` becomes `if (timer >= 33)`, flat. */
export const NBC_BOXSPLITTER_SPAWN = 33;
/** M3 — `if (timer >= 40 && !split)` becomes `if (timer >= 2 && !split)`. */
export const NBC_ROARING_STAR_BURST = 2;
/**
 * M5 — the inserted `rate = -999;` at the top of the sword-tunnel manager's
 * Step. It is not "a faster rate": `timer >= rate` is then true on the frame
 * the manager is created and on every frame after, because `timer` starts at
 * a NEGATIVE value and -999 is under all of them.
 */
export const NBC_SWORD_TUNNEL_RATE = -999;

// ─── T1 — THE ENEMY'S NAME ─────────────────────────────────────────────────

/**
 * `obj_knight_enemy_Step_0.gml:36` and the identical block at `:590`:
 *
 *     global.monstername[myself] = stringsetloc("Roaring Knight", ...);
 *     if (global.monsterhp[myself] < 5840)
 *     {
 *         global.monstername[myself] = stringsetloc("Roaring Fraud", ...);
 *     }
 *
 * **5840 IS FROM THE CODE, NOT THE CHANGELOG** — the changelog gives no
 * threshold at all. It is also not a new number to this repo: 5840 is 80% of
 * the Knight's 7300 and is already the phase-4 gate and the end-cutscene gate
 * (`sim/knight.js`). The mod renames him at the same health the fight starts
 * treating him as beatable, which is the joke.
 *
 * Vanilla is the bare string "Knight", which is what `render/menu.js` drew as
 * a literal before this existed.
 */
export const NBC_NAME_THRESHOLD = 5840;
export const NBC_NAME = 'Roaring Knight';
export const NBC_NAME_LOW = 'Roaring Fraud';
export const VANILLA_NAME = 'Knight';

/**
 * The enemy-row name for a given state — the whole of T1 in one call.
 *
 * @param {object} state  the sim state; `state.knight.hp` is the threshold's
 *                        input, `global.monsterhp[myself]`.
 * @returns {string}
 */
export function knightName(state) {
  if (!nbcOn(state)) return VANILLA_NAME;
  const hp = state?.knight?.hp;
  return typeof hp === 'number' && hp < NBC_NAME_THRESHOLD ? NBC_NAME_LOW : NBC_NAME;
}

// ─── T2/T3/T4 — THE WRITING ────────────────────────────────────────────────
//
// Every string below is the MOD's, character for character, `&` line breaks
// and leading `* ` included — the same rule `sim/battlemsg.js` states for the
// vanilla table it mirrors. The keys are that table's: `phase -> phaseturn`,
// read as "the message shown on ARRIVING at this phase/turn".
//
// Only the lines the mod actually rewrites appear here. A phase/turn the mod
// left alone is ABSENT, and the lookup falls through to the vanilla table —
// which is why this is an overlay and not a second copy of the fight's script.
// The mod rewrote fourteen of the fifteen; `phase 1 turn 0` ("silver stars")
// it left alone, and that gap is the mod's, not an omission here.

/** T2 — `global.battlemsg[0]`, by phase and phaseturn. */
export const NBC_BATTLE_MSG = {
  1: {
    // 0 — "* You felt lightheaded.&* You saw silver stars..." is UNCHANGED.
    1: '* You felt countless lethal objects hovering close behind your head...',
    2: '* Suddenly, the north wind roared fiercely.',
    3: '* Your vision narrows to a point.',
    4: '* Your soul feels constricted.',
  },
  2: {
    0: '* You felt lightheaded.&* You saw a storm of golden stars...',
    1: '* Suddenly, the north and east winds roared fiercely.',
    2: "* Your vision narrows.&* ... Your head can't stop spinning.",
    3: '* You feel surrounded by the imminent threat.',
    4: '* You felt your soul twisting.',
  },
  3: {
    0: '* You felt faint.&* For a moment, you thought you saw starry skies...',
    1: '* The upheaval almost sweeps you off your feet.',
    2: '* Your peripheral fades.&* ... The world revolves around you.',
    3: "* You can't find an escape.",
    4: '* You felt something pulling on your soul...',
  },
};

/**
 * T3 — the progamer line, `obj_knight_enemy_Step_0.gml:684`. The phase-4
 * table's other four entries the mod leaves alone, so this is the only one.
 *
 *     -  "* Kris coughed.&* The enemy slowly tilted its head..."
 *     +  "* Kris gave the enemy a knowing gaze.&* The enemy seems flabbergasted."
 */
export const NBC_PROGAMER_MSG =
  '* Kris gave the enemy a knowing gaze.&* The enemy seems flabbergasted.';

/**
 * T4 — the three knockdown lines, `:712`, `:719` and `:726`.
 *
 * Susie's gains a SECOND form the vanilla does not have:
 *
 *     susiedown = stringsetloc("* Susie's will was shattered.&", ...);
 *     if (balloonturn >= 6)
 *     {
 *         susiedown = stringsetloc("* Susie realised she should've kept quiet.&", ...);
 *     }
 *
 * `balloonturn` counts the Knight/Susie exchange's beats, so the second line
 * is what she gets once she has done enough talking to have earned it. It is
 * carried here as `susieLate` and is deliberately NOT collapsed into the
 * first: a caller with no `balloonturn` to hand must get the early line, not
 * a guess.
 */
export const NBC_DOWN_MSG = {
  kris: '* Kris accepts their situation.&',
  susie: "* Susie's will was shattered.&",
  susieLate: "* Susie realised she should've kept quiet.&",
  ralsei: '* Ralsei became a pile of dust.&',
};

/** The `balloonturn` at which Susie's knockdown line changes. */
export const NBC_SUSIE_LATE_TURN = 6;
