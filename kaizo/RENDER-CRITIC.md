# The render critic list

Copied verbatim on 2026-09-02 out of the render workflow's scratch output
(`tasks/wrh5kbqu7.output`, `result.critic`), which STRATEGY §4 used to point
at and which lives in a session directory that does not survive. The gate
numbers quoted inside are as of that run (2026-09-02, early).

---

GATES (exit codes, run from D:/ShadowCrystal/knight-sim): node tools/verify-render-smoke.mjs = 0; node kaizo/tools/checks/check-render-smoke-kaizo.mjs = 0 (23/24 reached, 21 pinned); npm run verify = 0 (60/60); npm run verify:kaizo = 1 — TypeError sim/equipment.js:202 statsOf (PARTY[slot] undefined) <- sim/damage.js:125 statFor <- scrDamageSingle <- kaizo/attacks/crescent-slash.js:233 other15 <- sim/index.js:351 runCollisions (the 00:37 newest-first edit from another session); sim/kaizo-party targeting, not a render defect, but it leaves every byte-gate consequence below UNVERIFIED.

STILL NOT ONE-TO-ONE, ranked:

1. Byte-gate change made by the split REVIEW and not re-verified: kaizo/attacks/flurry-splitslash.js:207 draw(e,state) now consumes obj_roaringknight_splitslash Draw_0:32-33's two irandom(2) (4 u32/striking frame) — previously dead (duplicate `draw` key). verify:kaizo is the gate for it and is red for the unrelated reason above. User decision: keep (game-exact stream) or strip.

2. Kaizo Draw deltas OUTSIDE the 24-object seam (depth-sorted entities only) — never ported, still vanilla:
   a. obj_tensionbar Draw_0:33-94 — B-Side sliced TP bar (spr_tensionbar_sliced/_cutout, TP logo off, +32 readout yoff, orange spr_roaringknight_finalslash_mask shard markers, clamp to 125). kaizo/party/tensionbar.js:172-185 exports kaizoTensionbarSprites/kaizoTensionbarLayout; render/tensionbar.js never reads them (only kaizo/party/scenes.js:1649 consumes clampActive). Sprites are in the overlay. Visible on every B-Side run.
   b. obj_heroparent Draw_0:10-46,66 — B-Side gloom tint on the heroes (merge_color(c_white, gloomcolor, min(k_gloom/150,0.3))) and the frozen statue (obj_frozennpc / spr_krisb_frozen). Party sprites are drawn NOWHERE in render/ or web/ (zero spr_krisb/susieb/noelleb/ralseib refs) on either page — scope hole; state carried by kaizo/party/heroes.js:231 gloomTint and freeze.js:453-468.
   c. obj_battlecontroller Draw_0:1169-1296 (chartime==11 head icons + spr_tenna_x crosses; sim has no chartime), obj_darkcontroller Draw_0 (config "Kaizo Color" row), obj_writer Draw_0:567-572 (`k` text command: c_gray + shake + no sound; render/dialogue.js parses no colour commands; no `\k` in any dump GML — mod strings live outside the dump, unverified), obj_attackpress Draw_0:149-188 (kaizo_autocrit, logic only), obj_time Draw_64:21-48 (nohitmode restart + knight GUI Draw_64 when invisible; practice lane). Menu/practice deltas; fight-path reach unverified.

3. Sprites still in neither manifest (override paints nothing, silently): spr_icespell_snowflake (every SnowGrave flake: draw_self + side copies + gathered doubles) and bg_snowfall (both snow sheets) — only the white->blue wash renders (kaizo/render/draw/snowgrave.js). spr_custom_box is a runtime sprite_create_from_surface (obj_growtangle Step_0:19-23), not an asset: stream.js:467 sprites.get('spr_custom_box') -> undefined -> drawSpriteExt returns, so a GROWING custom arena draws nothing in the PierceBlades shake redraw. Out-of-seam: spr_tenna_x, spr_frozennpc. RESOLVED SINCE THE PORTS: spr_headnoelle, spr_roaringknight_finalslash_mask, spr_knight_bullet_flow_alt, spr_roaringknight_idle2, spr_roaringknight_sword_ol_alt, spr_attack_shard are in kaizo/assets/sprites/manifest.json (104 sprites) and roaring.js/pointing.js/stream.js resolve via helpers.sprites at draw time — roaring.js:126/:378 comments now stale.

4. Depth/order defects (the sim's obj_growtangle carries NO depth; game runtime depth is 5 via __global_object_depths[186]=5, obj_heart [188]=1):
   a. obj_roaringknight_boxsplitter_attack hell surface: kaizo/render/draw/split.js draws it inline at the manager's depth (ownsHellSurface=true at :524, no helpers.defer) with kaizo/attacks/flurry-boxsplitter-attack.js:147 e.depth = 1 (CSV obj_heart 0; runtime is 1 -> game depth 2). canvas.js:911 sorts higher depth first, so the depth-0 box paints AFTER it and its opaque spr_battlebg_0 interior covers the 142x142 telegraph — the same defect the quickslash review measured and fixed for quickslash only (quickslash.js:481 helpers.defer). Fix: defer in split.js, or box depth 5 in sim/battlebox.js (off limits).
   b. obj_roaringknight_quickslash_big: Draw byte-identical to vanilla (`if (slash) draw_self()`), NOT in the registry, no DRAW_EVENTS entry -> generic blit paints its spr_rk_quickslash_marker stand-in (kaizo/attacks/quickslash.js:324) every pending frame where the game shows only the hell-surface gradient. Needs an entry in kaizo/render/index.js.
   c. obj_knight_roaring2: HP HUD composited into the deferred cover sits UNDER the soul (GML above); canvas.js.
   d. obj_roaringknight_splitslash strike: steady soul still drawn under the jittered copy (canvas.js soul pass ignores obj_heart.image_alpha=0); obj_knight_split_growtangle_effect snapshot never holds the soul.
   e. obj_knight_tunnel_slasher (status PARTIAL): Draw_0:64-86 shaken copies of obj_heart / obj_grazebox / obj_dmgwriter not drawn (late passes ignore `visible`); custom arena painted spr_battlebg_0 not spr_battlebg_stretch_hitbox (4px vs 2px border, measured; sim/battlebox.js keeps only the mask swap).

5. Sim-side gaps the renderer reads through (kaizo/attacks, reported not taken):
   a. quickslash_big's cut spawns the VANILLA organism/teeth (kaizo/attacks/quickslash.js:104 imports sim/attacks/split-growtangle.js): mechanics/lifetime/RNG are vanilla's; split.js derives the tint statelessly only. Byte-gate decision.
   b. obj_knight_rotating_slash Step_0:298 scr_var_delayed("sprite_index", 3329, 4) and :618 scr_var("sprite_index", 2128) untranslated -> me_surface pose draws stale spr_roaringknight_flurry (ids resolvable now: knight-research/kaizo-mod/sprites/sprites_kaizo.csv, index N = row N+2).
   c. obj_knight_roaring2 Draw_0:114-122 starchild image_alpha/active/destroy writes not modelled; obj_knight_pointing_starchild's own Draw suppressed during ROARING (pointing.js:812 roaringOwnsIt) where the game draws shard AND roar copy.
   d. snowflake con-3 obj_afterimage trail (Step_0:79-82) not spawned (seq shift); snd_snowgrave cue absent; obj_lerpvar same-frame first step unmeasured (tweens possibly 1 frame late).
   e. spr_roaringknight_idle2 B-Side no-hit reward (Step_0:694-740 applyKaizoIdleRecolor) has no consumer in kaizo/ — never drawn.
   f. Knight block cue snd_metal_hit vs sim snd_bell (audio); obj_knight_swordfall Alarm_4 siner2 handoff lands on the battle record (both trees).
   g. obj_knight_swordtunnelanim vertical arm and obj_tracking_sword_slash_extra_graze (visible=false by Create, game and sim) unexercised — harmless.

6. Sub-pixel / unknowable, left as documented: sin(global.time*0.1) phase (swordfall, rotating-slash me_surface), merge_color 127.5 rounding, canvas AA on wedge/rect/clip edges, GM surface alpha^2, Gouraud beam far edge, draw_sprite_general negative-extent assumption (split effect halves), one-frame skews (tunnel_slasher_2_revised siner; spawn-frame Draws).

7. Verification gaps: both smoke gates replace EVERY sprite with a 32x32 fakeEntry (origin 16,16; tools/verify-render-smoke.mjs:71-73, check-render-smoke-kaizo.mjs:119-125) — no exit-code gate ever runs the eight ports against the real manifests/overlay/PNGs; EXPECTED_REACHED (check-render-smoke-kaizo.mjs:312-322) still omits obj_spell_snowgrave / _snowflake although the run reaches them (120 / 5040 hits) and its :305-311 comment is stale; kaizo/render/index.js header still says "EVERY ENTRY IS A STUB TODAY".

8. Delegation audit (kaizo/render/draw/*.js): no override delegates to a vanilla drawer for a changed object. Only helpers.drawVanilla call: stream.js:640 on obj_tracking_sword1 (Draw byte-identical, cmp). Reused vanilla code is all for identical events: render/draw/pointing-star.js drawStarUserEvent0 (Other_10 identical, cmp), render/draw/roaring.js screenCut (state holder), gm.js primitives, helpers.drawSelf = generic blit for draw_self. obj_tracking_swords_manager, obj_growtangle, obj_knight_roaring_star Other_10 Draws identical (cmp); Other_11 differs by 4 lines and is ported in roaring.js. Full dump diff: 70 Draw files differ; every one that the sim instantiates as an entity type is in the registry; the rest are item 2 (HUD/menu/party) or non-fight objects.

9. sim/ status (item 4): NOT clean — git status shows 16 modified files + untracked sim/data/object-order.js, all from other sessions (agents' claims hold: every simStateAdded path cited lives in kaizo/attacks, kaizo/actors, kaizo/party and is present — verified rotating-slash.js:890, flurry-splitslash.js:207, kaizo-knight-actor.js:265, scenes.js:1515, knight-stream.js:485-486, knightlines.js:592, sword-tunnel-revised.js:356, swordfall.js:1006-1009, stars-pointing-star.js:216, roaring-final.js:187-189). Changed INSIDE the workflow window: sim/index.js 00:37 (runCollisions newest-first + runPhase(state,'draw') at :465 — the slot every added draw(e) relies on), sim/entity.js 01:05 (f32 narrow-then-wrap direction + stepNewestFirst), sim/rng.js 21:35 (stack slice 2..9, cosmetic).

10. rngInDraw — byte-gate decisions for the user:
   - obj_roaringknight_splitslash Draw_0:32-33 irandom(2)-1 x2 per striking frame: NOW CONSUMED on the stream (item 1), unverified.
   - obj_roaringknight_split_bullet Draw_0:25 random_range(-0.1,0.1) x2/tooth/frame: stripped, frame-seeded in canvas.js drawEntity (vanilla-identical deviation, ~2 draws/tooth/frame); vanilla-typed teeth from quickslash_big likewise.
   - obj_knight_tunnel_slasher Draw_0:6-7 random_range(+-at_gshake) x2/frame: consumed in kaizo/attacks/knightlines.js endStep (endStep position, not the Draw slot).
   - obj_knight_tunnel_slasher_2_revised Draw_0:15 random_range every 4th siner frame: consumed in sword-tunnel-revised.js STEP (moving it to the draw slot reorders the frame's consumers).
   - obj_tensionbar Draw_0:53-54,57 random_range shard markers (B-Side): consumed by kaizo/party/tensionbar.js:226-256 (counts draws) but nothing renders them (item 2a).
   - obj_spell_snowgrave Draw_0:82-87 (altpath 1) and :179/:185 (no knight): unreachable, not modelled.
   - obj_knight_enemy charge-up ghosts (Step RNG, not Draw): vanilla frame-seeded stand-in kept verbatim.
