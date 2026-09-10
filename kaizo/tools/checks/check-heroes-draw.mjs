#!/usr/bin/env node
// THE PARTY IS DRAWN, AND THE MOD'S TWO DRAW DELTAS REACH THE SCREEN.
//
//   node kaizo/tools/checks/check-heroes-draw.mjs
//
// RENDER-CRITIC item 2b. obj_heroparent's Draw_0 is one of the mod's changed
// Draws, and until kaizo/render/draw/party.js there was no consumer for
// either half of the change: kaizo/party/heroes.js computed the B-Side gloom
// tint (`h.blend`) and tracked the frozen statue (`h.herofrozen`,
// `h.frozenHidden`) every frame and the renderer read neither, because the
// heroes were painted by render/canvas.js's GENERIC BLIT — which knows about
// `sprite_index` and nothing else.
//
// So the assertions here are about the three things a reader of the GML can
// check against the screen: WHICH SPRITE, at WHICH POSE AND FRAME, in WHICH
// BLEND — plus the freeze, which is a draw that does not happen and a statue
// that does.
//
// METHOD. The drawer is called DIRECTLY, with a `helpers` bag and a canvas
// context built here, both of which RECORD instead of drawing: every
// `drawImage` is logged with the sprite name it came from, the sub-image, the
// tint or fog colour asked for, the alpha, and the position and scale the
// current transform puts it at. That is a stronger instrument than the render
// smoke (which asserts only that nothing throws) and a narrower one than the
// page (which cannot be asserted about at all from Node). The smoke gate
// separately pins that the REAL renderer reaches this drawer — 65,928 hits at
// its budgets — so "the drawer is right" and "the drawer runs" are both
// covered, in the two places each belongs.
//
// SABOTAGE-TESTED 2026-09-10, both directions (see the report): dropping the
// gloom blend makes the tint assertions fail; dropping the `frozenHidden`
// early exit makes the freeze assertions fail.

// THE TINT AND THE FOG GO THROUGH THE REAL BAKERS. render/draw/gm.js's
// `tinted` / `fogged` build an offscreen canvas and are what drawSpriteExt
// reaches for, so a stub in the helpers bag would not be exercised at all.
// Instead `document.createElement('canvas')` is stubbed to hand back a
// RECORDING canvas: it remembers which sprite was drawn into it, which colour
// was filled over it, and in WHICH ORDER — image-then-fill is a tint
// (multiply), fill-then-image is a fog (silhouette). That distinction is the
// one obj_frozennpc's Draw turns on, so it is worth reading rather than
// assuming. Installed before the first import, because gm.js reads `document`
// at call time and the module graph is loaded lazily below.
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0, __ops: [], __sprite: null, __sub: null, __fill: null };
    const g = {
      imageSmoothingEnabled: false,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      get fillStyle() { return c.__fill; },
      set fillStyle(v) { c.__fill = v; c.__ops.push('fill'); },
      setTransform() {},
      clearRect() {},
      fillRect() {},
      drawImage(img) {
        if (img && img.__sprite !== undefined && img.__sprite !== null) {
          c.__sprite = img.__sprite;
          c.__sub = img.__sub;
        }
        c.__ops.push('drawImage');
      },
    };
    c.getContext = () => g;
    return c;
  },
};

/** `rgb([r,g,b])` back into the array, so an assertion can name the colour. */
function unrgb(s) {
  const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(String(s ?? ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const { drawActorParty } = await import('../../render/draw/party.js');
const { tinted, fogged } = await import('../../../render/draw/gm.js');
const { gloomTint, GLOOM_COLOR, createKaizoHeroes, stepKaizoHeroes } = await import('../../party/heroes.js');
const { installRoster, setGloom, setFreeze, WEIRD_ROUTE_PARTY, SLOT_POS, slotDepth } = await import('../../party/roster.js');
const { mergeColor } = await import('../../../sim/gml.js');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

// ── the recording instrument ───────────────────────────────────────────────

/**
 * A 2d context that keeps GameMaker's part of the transform — translate,
 * scale and the save/restore stack — and logs every drawImage with the
 * position and scale in effect. Rotation is tracked as a flag only: nothing
 * in obj_heroparent's Draw or obj_frozennpc's rotates, so a non-zero angle
 * anywhere is itself a failure and is reported as one.
 */
function recorder() {
  const draws = [];
  let m = { x: 0, y: 0, sx: 1, sy: 1, alpha: 1, rotated: false, op: 'source-over' };
  const stack = [];
  const ctx = {
    draws,
    get globalAlpha() { return m.alpha; },
    set globalAlpha(v) { m.alpha = v; },
    get globalCompositeOperation() { return m.op; },
    set globalCompositeOperation(v) { m.op = v; },
    imageSmoothingEnabled: false,
    save() { stack.push({ ...m }); },
    restore() { if (stack.length) m = stack.pop(); },
    translate(x, y) { m.x += x * m.sx; m.y += y * m.sy; },
    scale(x, y) { m.sx *= x; m.sy *= y; },
    rotate(a) { if (a) m.rotated = true; },
    setTransform() { m = { x: 0, y: 0, sx: 1, sy: 1, alpha: m.alpha, rotated: false, op: m.op }; },
    drawImage(img, ...rest) {
      // drawSpriteExt: drawImage(src, -ox, -oy). drawSpritePartExt:
      // drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh).
      const part = rest.length >= 8;
      const ox = part ? 0 : rest[0];
      const oy = part ? 0 : rest[1];
      // A raw frame carries its own name; a BAKED canvas carries the name of
      // the frame that went into it plus the fill and the op order.
      const baked = Array.isArray(img.__ops);
      const fill = baked ? unrgb(img.__fill) : null;
      draws.push({
        sprite: img.__sprite,
        sub: img.__sub,
        tint: baked && img.__ops[0] === 'drawImage' ? fill : null,
        fog: baked && img.__ops[0] === 'fill' ? fill : null,
        x: m.x + ox * m.sx,
        y: m.y + oy * m.sy,
        sx: m.sx,
        sy: m.sy,
        alpha: m.alpha,
        rotated: m.rotated,
        op: m.op,
        src: part ? { sx: rest[0], sy: rest[1], sw: rest[2], sh: rest[3] } : null,
      });
    },
  };
  return ctx;
}

/** A sprite entry whose frames carry their own identity, so a draw names itself. */
function entryFor(name, { w = 48, h = 44, ox = 3, oy = 5, frames = 4 } = {}) {
  const fs = [];
  for (let i = 0; i < frames; i++) fs.push({ width: w, height: h, __sprite: name, __sub: i });
  return { meta: { w, h, ox, oy, frames }, frames: fs };
}

/** The `helpers` bag render/canvas.js freezes, cut to what this drawer touches. */
function helpersFor(ctx, known) {
  const sprites = new Map();
  for (const [name, opts] of Object.entries(known)) sprites.set(name, entryFor(name, opts));
  return {
    sprites,
    // The REAL bakers — the recording canvas above is what makes them
    // readable, and using the real ones means the check exercises the same
    // code path the page does.
    tinted,
    fogged,
    // `draw_self()` — the generic blit. Recorded as a draw of the entity's own
    // sprite so the check can tell it apart from a drawSpriteExt.
    drawSelf: (e) => {
      const entry = sprites.get(e.sprite_index);
      if (entry) ctx.drawImage(entry.frames[0], -entry.meta.ox, -entry.meta.oy);
    },
  };
}

/** A state with the Weird Route roster installed and its heroes stepped once. */
function weirdState({ gloom = null, freeze = null, sideb = true } = {}) {
  const state = {
    heroes: null,
    knight: { hp: 7300 },
    partyHp: null,
    spriteFrames: { spr_krisb_idle: 4, spr_noelleb_idle_sideb: 4 },
  };
  installRoster(state, { charIds: WEIRD_ROUTE_PARTY, sideb });
  state.heroes = createKaizoHeroes(state);
  if (gloom) for (const [slot, v] of Object.entries(gloom)) setGloom(state, Number(slot), v);
  if (freeze) for (const [slot, v] of Object.entries(freeze)) setFreeze(state, Number(slot), v);
  stepKaizoHeroes(state);
  return state;
}

/** The actor render/canvas.js hands the seam, as sim/actors.js's Step leaves it. */
function actorFor(state, slot) {
  const h = state.heroes[slot];
  return {
    type: { name: 'actor_party' },
    slot,
    x: SLOT_POS[slot].x,
    y: SLOT_POS[slot].y,
    depth: slotDepth(slot),
    sprite_index: h.sprite,
    image_index: 0,
    image_alpha: 1,
    visible: true,
    alive: true,
  };
}

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── 1. the ordinary draw: which sprite, which pose, which scale ────────────
{
  const state = weirdState();
  const ctx = recorder();
  const helpers = helpersFor(ctx, {
    spr_krisb_idle: {}, spr_noelleb_idle_sideb: {},
  });
  const claimed = [0, 1].map((s) => drawActorParty(ctx, actorFor(state, s), state, helpers));

  ok(claimed.every((c) => c === true),
    'the drawer CLAIMS the draw (returns true) so the vanilla tail cannot blit a second, untinted copy');
  ok(ctx.draws.length === 2, `two heroes on the Weird Route, two draws (${ctx.draws.length})`);

  const kris = ctx.draws[0];
  const noelle = ctx.draws[1];
  ok(kris.sprite === 'spr_krisb_idle' && noelle.sprite === 'spr_noelleb_idle_sideb',
    `each slot draws ITS OWN character's sprite (${kris.sprite} / ${noelle.sprite})`);
  // `scale = 2` — obj_heroparent Draw_0:1, a draw-time literal.
  ok(kris.sx === 2 && kris.sy === 2 && noelle.sx === 2 && noelle.sy === 2,
    'both are drawn at scale 2 — Draw_0:1 `var scale = 2`');
  // The origin is applied by drawSpriteExt: the drawn top-left is
  // (x - ox*scale, y - oy*scale) for a 48x44 sprite with origin (3,5).
  ok(near(kris.x, 126 - 3 * 2) && near(kris.y, 104 - 5 * 2),
    `Kris lands at slot 0's heromake point through the manifest origin (${kris.x}, ${kris.y})`);
  ok(near(noelle.x, 80 - 3 * 2) && near(noelle.y, 142 - 5 * 2),
    `Noelle stands where SUSIE stands — slot 1, not "the second character's own spot" (${noelle.x}, ${noelle.y})`);
  ok(!kris.rotated && !noelle.rotated, 'neither is rotated — the Draw passes angle 0');
  ok(kris.tint === null && noelle.tint === null,
    'gloom 0 draws UNTINTED — c_white multiplies to a no-op and the bake is skipped');
  ok(kris.alpha === 1 && noelle.alpha === 1, 'image_alpha 1');
}

// ── 2. the pose follows the hero state machine ─────────────────────────────
{
  const state = weirdState();
  const ctx = recorder();
  const helpers = helpersFor(ctx, { spr_krisb_idle: {}, spr_noelleb_idle_sideb: {} });
  const a = actorFor(state, 0);
  // `image_index = index` — the actor's Step wraps `siner / 5` at the frame
  // count; the drawer must pass THAT through, not frame 0.
  a.image_index = 3;
  drawActorParty(ctx, a, state, helpers);
  ok(ctx.draws[0].sub === 3,
    `the sub-image drawn is the actor's image_index, not a fixed frame (${ctx.draws[0].sub})`);
}

// ── 3. THE GLOOM TINT — the B-Side half of the delta ───────────────────────
//
//     var _gamt = min(obj_knight_enemy.k_gloom[global.char[myself]] / 150, 0.3);
//     _blend = merge_color(c_white, kaizo_gloomcolor(), _gamt);
//
// FIVE POINTS, and the shape of the ramp is the point. `_gamt` is
// `min(gloom / 150, 0.3)`, so it CEILINGS AT GLOOM 45 — which is exactly
// scr_damage's own gloom cap, so on that path the tint arrives at its darkest
// precisely when the meter arrives at its maximum. scr_damage_maxhp has no
// such cap and can push the meter past 45; the `min` is what holds the
// picture still when it does.
{
  const cases = [
    [15, 'a tenth of the way — gloom 15 is _gamt 0.1, well under the ceiling'],
    [30, 'a fifth — gloom 30 is _gamt 0.2, still climbing'],
    [45, 'THE CEILING: gloom 45 is _gamt 0.3, and 45 is scr_damage\'s own cap'],
    [150, 'gloom 150 would be _gamt 1.0 and the `min` cuts it to 0.3'],
    [600, 'past anything scr_damage can write: scr_damage_maxhp has no cap, the `min` holds'],
  ];
  for (const [g, what] of cases) {
    const state = weirdState({ gloom: { 0: g } });
    const ctx = recorder();
    const helpers = helpersFor(ctx, { spr_krisb_idle: {}, spr_noelleb_idle_sideb: {} });
    drawActorParty(ctx, actorFor(state, 0), state, helpers);
    const d = ctx.draws[0];
    const want = gloomTint(g);
    ok(d.tint !== null
      && d.tint[0] === want[0] && d.tint[1] === want[1] && d.tint[2] === want[2],
      `${what} — merge_color(c_white, gloomcolor, min(${g}/150, 0.3)) = `
      + `(${want.join(', ')}); drew (${d.tint ? d.tint.join(', ') : 'no tint'})`);
  }
  // The ramp CLIMBS below the ceiling and STOPS at it. Both halves matter:
  // without the first, a bug that pinned the tint would pass; without the
  // second, a missing `min` would.
  ok(gloomTint(0)[0] > gloomTint(15)[0] && gloomTint(15)[0] > gloomTint(30)[0]
    && gloomTint(30)[0] > gloomTint(45)[0],
    'the tint DARKENS with gloom below the ceiling '
    + `(red channel ${gloomTint(0)[0]} > ${gloomTint(15)[0]} > ${gloomTint(30)[0]} > ${gloomTint(45)[0]})`);
  ok(gloomTint(45).join() === gloomTint(150).join()
    && gloomTint(150).join() === gloomTint(600).join(),
    'and SATURATES at gloom 45 — `min(k_gloom / 150, 0.3)`, so 45, 150 and 600 are one colour');
  ok(gloomTint(0).join() === '255,255,255',
    'gloom 0 is exactly c_white — a hero with no gloom is a vanilla hero');
  // And the colour itself: merge_color(c_blue, #268CAC, 0.5).
  ok(GLOOM_COLOR.join() === mergeColor([0, 0, 255], [38, 140, 172], 0.5).join(),
    `kaizo_gloomcolor() is merge_color(c_blue, #268CAC, 0.5) = (${GLOOM_COLOR.join(', ')})`);
}

// ── 4. THE GLOOM IS INDEXED BY CHARACTER, not by slot ─────────────────────
//
// The Draw reads `k_gloom[global.char[myself]]`. With the Weird Route roster
// (`global.char = [1, 4, 0]`) slot 1 is character 4, so gloom written for
// slot 1 must reach Noelle and NOT the character-2 cell scr_charbox reads.
{
  const state = weirdState({ gloom: { 1: 120 } });
  const ctx = recorder();
  const helpers = helpersFor(ctx, { spr_krisb_idle: {}, spr_noelleb_idle_sideb: {} });
  drawActorParty(ctx, actorFor(state, 0), state, helpers);
  drawActorParty(ctx, actorFor(state, 1), state, helpers);
  ok(ctx.draws[0].tint === null, 'gloom on slot 1 leaves KRIS untinted');
  const want = gloomTint(120);
  ok(ctx.draws[1].tint && ctx.draws[1].tint.join() === want.join(),
    `gloom on slot 1 tints NOELLE — k_gloom[4], the char id, not k_gloom[2] (${want.join(', ')})`);
  ok(state.kaizo.gloomByChar[4] === 120 && state.kaizo.gloomByChar[2] === 0,
    'and the mirror it read is the CHARACTER-indexed one (gloomByChar[4] = 120, [2] = 0)');
}

// ── 5. OFF THE B-SIDE THERE IS NO TINT AT ALL ─────────────────────────────
// `if (kaizo_sideb())` guards the whole blend block; a Normal Route run with
// gloom on the array must still draw white.
{
  const state = weirdState({ gloom: { 0: 150 }, sideb: false });
  const ctx = recorder();
  const helpers = helpersFor(ctx, { spr_krisb_idle: {}, spr_noelleb_idle_sideb: {} });
  drawActorParty(ctx, actorFor(state, 0), state, helpers);
  ok(ctx.draws[0].tint === null,
    'Normal Route: gloom 150 on the array and the hero still draws white — the `kaizo_sideb()` gate');
}

// ── 6. THE FREEZE: the hero is not drawn, and a statue is ─────────────────
{
  const state = weirdState({ freeze: { 0: true } });
  const ctx = recorder();
  const helpers = helpersFor(ctx, {
    spr_krisb_idle: {}, spr_noelleb_idle_sideb: {}, spr_krisb_frozen: { frames: 1 },
  });
  drawActorParty(ctx, actorFor(state, 0), state, helpers);

  const hero = ctx.draws.filter((d) => d.sprite === 'spr_krisb_idle');
  const statue = ctx.draws.filter((d) => d.sprite === 'spr_krisb_frozen');
  ok(hero.length === 0,
    'a frozen hero is NOT DRAWN — the Draw `exit`s before the pose (Draw_0:36)');
  ok(statue.length > 0,
    `the statue is drawn in his place (${statue.length} obj_frozennpc draws)`);
  // KRIS IS THE ONE SPECIAL CASE: `if (_mychar == 1) sprite_index =
  // spr_krisb_frozen`, everyone else takes their own hurtsprite.
  ok(state.heroes[0].herofrozen.sprite === 'spr_krisb_frozen',
    'and it wears spr_krisb_frozen — the `_mychar == 1` branch, Draw_0:22-25');
  // draw_self, then four fogged copies, then the additive core: six draws.
  ok(statue.length === 6,
    `obj_frozennpc's Draw is six blits — draw_self, four offset copies, one additive (${statue.length})`);
  const fogged = statue.filter((d) => d.fog !== null);
  ok(fogged.length === 4,
    `four of them are under `.concat('`d3d_set_fog(true, specialcolor, 0, 0)` — flat silhouettes, ')
      + `not the c_blue they name (${fogged.length})`);
  ok(fogged.every((d) => d.fog.join() === mergeColor([0, 0, 128], [255, 255, 255], 0.8).join()),
    'and the fog colour is merge_color(c_navy, c_white, 0.8), obj_frozennpc Create_0');
  const alphas = fogged.map((d) => Number(d.alpha.toFixed(3))).join(',');
  ok(alphas === '0.8,0.4,0.4,0.8',
    `their alphas are the GML's 0.8 / 0.4 / 0.4 / 0.8, in its order (${alphas})`);
  const additive = statue.filter((d) => d.op === 'lighter');
  ok(additive.length === 1 && Number(additive[0].alpha.toFixed(3)) === 0.4,
    'the last is bm_add at 0.4, fog OFF — the glow, and the only one that is really tinted');
  ok(statue.every((d) => d.sx === 2 && d.sy === 2),
    'the statue draws at scale 2 — the hero\'s image_xscale, which Create_0:14-15 sets');
}

// ── 7. THE ICE CREEPS. `t` opens the source window over 20 frames. ────────
{
  const state = weirdState({ freeze: { 0: true } });
  const helpers0 = helpersFor(recorder(), {});
  const seen = [];
  for (let f = 0; f < 24; f++) {
    const ctx = recorder();
    const helpers = helpersFor(ctx, {
      spr_krisb_idle: {}, spr_noelleb_idle_sideb: {}, spr_krisb_frozen: { frames: 1 },
    });
    drawActorParty(ctx, actorFor(state, 0), state, helpers);
    const part = ctx.draws.find((d) => d.src);
    seen.push(part ? part.src.sh : -1);
    stepKaizoHeroes(state);
  }
  void helpers0;
  ok(seen[0] === -1 || seen[0] >= 0, 'the ice band was measured on every frame');
  // `timer` walks 0.05 a frame, `t = (sprite_height/2) - timer*(sprite_height/2)`,
  // and the source rect is (0, t) .. (w, sprite_height - t). At scale 2 on a
  // 44px sprite, sprite_height is 88 and t starts at 41.8 — above the
  // sprite's own 44 rows, so the clamped window opens from nothing.
  ok(seen[0] < seen[10] && seen[10] < seen[23],
    `the ice band GROWS frame over frame (${seen[0]} -> ${seen[10]} -> ${seen[23]})`);
  ok(seen[23] === 44,
    `and reaches the whole sprite once timer saturates at 1 (${seen[23]} of 44 rows)`);
  ok(state.heroes[0].herofrozen.age === 20,
    `the clock saturates at 20 frames and stops (age ${state.heroes[0].herofrozen.age})`);
}

// ── 8. THE STATUE OUTLIVES THE FREEZE — the preserved CleanUp bug ─────────
{
  const state = weirdState({ freeze: { 0: true } });
  stepKaizoHeroes(state);
  setFreeze(state, 0, false);
  stepKaizoHeroes(state);
  const ctx = recorder();
  const helpers = helpersFor(ctx, {
    spr_krisb_idle: {}, spr_noelleb_idle_sideb: {}, spr_krisb_frozen: { frames: 1 },
  });
  drawActorParty(ctx, actorFor(state, 0), state, helpers);
  const hero = ctx.draws.filter((d) => d.sprite === 'spr_krisb_idle');
  const statue = ctx.draws.filter((d) => d.sprite === 'spr_krisb_frozen');
  ok(hero.length === 1 && statue.length === 6,
    `thawed: the hero is back AND the statue is still there (${hero.length} hero, ${statue.length} statue draws)`);
  ok(ctx.draws.indexOf(hero[0]) < ctx.draws.indexOf(statue[0]),
    'and the statue draws AFTER him — same depth, later instance, later in the sorted pass');
}

// ── 9. A HERO WITH NO KAIZO RECORD IS THE VANILLA PICTURE ────────────────
// V-A and V-C install no roster hook, so `state.heroes` holds sim/heroes.js's
// plain records: no `blend`, no `herofrozen`. The drawer must paint them.
{
  const state = {
    heroes: [{ sprite: 'spr_krisb_idle', index: 0 }],
    spriteFrames: { spr_krisb_idle: 4 },
  };
  const ctx = recorder();
  const helpers = helpersFor(ctx, { spr_krisb_idle: {} });
  const e = {
    type: { name: 'actor_party' }, slot: 0, x: 126, y: 104, depth: 200,
    sprite_index: 'spr_krisb_idle', image_index: 1, image_alpha: 1, visible: true, alive: true,
  };
  const claimed = drawActorParty(ctx, e, state, helpers);
  ok(claimed === true && ctx.draws.length === 1 && ctx.draws[0].tint === null
    && ctx.draws[0].sx === 2 && ctx.draws[0].sub === 1,
    'a hookless hero (no blend, no herofrozen) draws exactly once, untinted, at scale 2');
}

console.log('');
if (failed) {
  console.log(`FAIL  kaizo party draw — ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('PASS  kaizo party draw — obj_heroparent Draw_0: pose, gloom tint, freeze statue');
