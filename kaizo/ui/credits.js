// THE KAIZO BUILD'S CREDITS.
//
// This build recreates someone else's work. The vanilla list in `sim/modes.js`
// credits the people who made the Roaring Knight simulator; it does not credit
// the person who made the mod this page is a recreation OF, and it should not
// — the vanilla page is not a recreation of anything of EnderCat8's, so a row
// naming them there would be wrong in the other direction.
//
// So the list is per-build. `sim/modes.js` exports `titleCredits(title)`,
// which returns `title.credits` when a build has installed one and the vanilla
// `CREDITS` otherwise. Every read goes through it — the draw in
// `render/title.js` AND the cursor arithmetic in `stepSettings`, because a
// longer list with a wrap computed off the old length leaves the bottom row
// unreachable.
//
// `link` is the DISPLAY string with no scheme, matching the vanilla rows:
// `creditLink` adds the `https://`, and a scheme printed on screen is noise.

import { CREDITS } from '../../sim/modes.js';

/**
 * EnderCat8's row, and the release this build was recreated from.
 *
 * v2.3.3 is the version every citation in this repo is against — the schedule,
 * the attack table, the B-Side branches — so the link goes to the mod's own
 * page rather than to a profile.
 */
export const ENDERCAT_ROW = {
  role: 'Creator of the original mod',
  who: 'ENDERCAT',
  link: 'gamebanana.com/mods/662826',
};

/**
 * The vanilla rows with EnderCat8's inserted after WandeR's.
 *
 * BUILT FROM `CREDITS` RATHER THAN RETYPED. The three vanilla rows are not
 * copied here: if the developer's link changes, or the SUPPORT row moves, this
 * list follows without anyone remembering it exists. Only the new row and its
 * position are stated.
 *
 * SUPPORT STAYS LAST. It is the one row that is not a person — a single word
 * rather than a role-and-name pair, drawn differently by `render/title.js` —
 * and it reads as the end of the list, so the new row goes above it.
 */
export const KAIZO_CREDITS = (() => {
  const rows = [...CREDITS];
  const wander = rows.findIndex((r) => r.who === 'WandeR');
  // Not found means the vanilla list was reshaped upstream. Appending before
  // any trailing SUPPORT row is the conservative answer: the row still ships,
  // in roughly the right place, rather than vanishing quietly.
  const at = wander >= 0
    ? wander + 1
    : Math.max(0, rows.findIndex((r) => !r.who) + 1 || rows.length);
  rows.splice(at, 0, ENDERCAT_ROW);
  return rows;
})();
