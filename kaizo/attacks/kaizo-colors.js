// THE KAIZO PALETTE — `get_swordcolor()` and the Knight's rainbow trail.
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission (kaizo/HANDOFF.md §5-C).
//
// Provenance:
//   gml_GlobalScript_scr_complete_save_file.gml  — function get_swordcolor()
//   gml_Object_obj_knight_enemy_Create_0.gml:38  — rgbafterimages = 1
//   gml_Object_obj_knight_enemy_Draw_0.gml:58-91 — the 7-colour cycle
//
// WHY THIS FILE EXISTS. The mod's most visible change is that the Knight and
// everything he throws stop being white/red and turn BLUE. Three translated
// modules had each grown their own private copy of the colour table and six
// more only noted the tint in a header — so the palette was simultaneously
// duplicated and missing. One source, imported by all of them.
//
// GAMEMAKER COLOURS ARE BGR, NOT RGB. `make_colour_rgb(r, g, b)` packs to
// `r + g*256 + b*65536`, so the dump's decimal constants read blue-first:
//
//     16711680 = 0x00FF0000 -> B 255, G 0,   R 0     pure blue   (default)
//     16732740               -> B 255, G 82,  R 68    #4452FF
//     16743013               -> B 255, G 122, R 101   #657AFF
//     16749461               -> B 255, G 147, R 149   #9593FF
//
// Read as RGB those would be reds — which is exactly the mistake that makes a
// recolour land inverted, and the reason the decimal originals are kept in
// the comments above each entry.
//
// `global.kaizo_swordtype` is a PLAYER SETTING (the mod's settings sign),
// default 0 -> the `default` arm. It rides state.kaizo.swordtype.

/**
 * STABLE ARRAY REFERENCES, deliberately. Several of the mod's Draw gates are
 * `if (image_blend == get_swordcolor())` — an exact equality against the very
 * value Step assigned the same frame. Returning a fresh array per call would
 * make that test always false; returning these singletons preserves it as
 * reference equality, which is the idiom sim/attacks/sword-tunnel.js already
 * uses for its RED constant.
 */
export const SWORDCOLORS = {
  1: [68, 82, 255],    // 16732740
  2: [101, 122, 255],  // 16743013
  3: [149, 147, 255],  // 16749461
  default: [0, 0, 255], // 16711680 — pure blue
};

/** `get_swordcolor(global.kaizo_swordtype)`. */
export function getSwordcolor(state) {
  return SWORDCOLORS[state?.kaizo?.swordtype] ?? SWORDCOLORS.default;
}

/**
 * The splitslash/tunnel telegraph blue, #86A2FF — a DIFFERENT constant from
 * the sword colours above (it is written literally at its draw sites rather
 * than read from get_swordcolor), so it does not follow the swordtype
 * setting.
 */
export const KAIZO_TELEGRAPH_COLOR = [134, 162, 255];

/**
 * The Knight's afterimage cycle, in the dump's order. `afterimagecon`
 * increments per ghost and wraps at 7 — so the trail behind him is a moving
 * rainbow rather than a colour.
 *
 * GameMaker's own constants, as RGB triples:
 *   c_red, c_orange, c_yellow, c_lime, c_aqua, c_blue, c_purple
 *
 * c_orange is GameMaker's (255,160,64), not web orange, and c_purple is
 * (128,0,128) — taking the CSS values instead would shift two of the seven.
 */
export const RGB_AFTERIMAGE_CYCLE = [
  [255, 0, 0],     // c_red
  [255, 160, 64],  // c_orange
  [255, 255, 0],   // c_yellow
  [0, 255, 0],     // c_lime
  [0, 255, 255],   // c_aqua
  [0, 0, 255],     // c_blue
  [128, 0, 128],   // c_purple
];

/**
 * One step of the cycle. `con` is the mod's `afterimagecon`, 1-based and
 * wrapping to 0 after the 7th — returns the new counter alongside the colour
 * so the caller keeps the original's exact wrap behaviour.
 */
export function nextAfterimageColor(con) {
  const next = con + 1;
  return { con: next >= 7 ? 0 : next, color: RGB_AFTERIMAGE_CYCLE[next - 1] };
}
