// THE VERSION, appended to the KAIZO banner on the page (web/kaizo.js).
//
// BUMP THE PATCH NUMBER ON EVERY CHANGE THAT SHIPS — a fix, a feature, a
// tweak; if a player could notice it, it gets a number. Same discipline as
// knight-sim's (its CLAUDE.md, "Versioning"), and the same reason: a bug
// report can say which build it came from.
//
// WHEN YOU BUMP THIS, BUMP `CACHE` IN web/sw.js TO MATCH. The service worker
// cannot import modules, so the two are linked by convention: the cache name
// is what makes an installed PWA fetch the new build instead of serving the
// old one forever.
//
// This repo's line starts at 0.1.0 (2026-09-02, the split from knight-sim, whose
// web line was at 1.0.13). The two numbers are unrelated on purpose.
export const VERSION = '0.1.12';
