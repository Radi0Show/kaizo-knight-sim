#!/usr/bin/env node
// KAIZO — `kaizo_set_music`, THE FILE-EXISTENCE MUSIC ROUTER (ledger G-50).
//
//   node kaizo/tools/checks/check-prefight-music.mjs
//
// V-C/V-D recreation of EnderCat8's Kaizo Roaring Knight — do not publish
// without permission.
//
// PROVENANCE. `gml_GlobalScript_kaizo_settings_init.gml:27-77`, five branches
// over two arguments, called from exactly two places —
// `gml_Object_obj_ch3_PTB02_Step_0.gml:199` (the arrival cue) and `:560` (the
// battle track). Neither retail dump has the function at all
// (`knight-research/gml_dump/CodeEntries`, `gml_dump_ch5/CodeEntries`), so it
// is EnderCat8's and not chapter-build churn.
//
// WHAT THIS FILE IS FOR. Before it, `web/kaizo.js` declared ONE of the five
// branches as a literal override and the other four did not exist. The router
// now runs for real, and the two things worth proving are:
//
//   (1) every branch answers what the GML says it answers, INCLUDING the
//       three original bugs, which are asserted as bugs and not repaired; and
//   (2) THE PAGE ACTUALLY READS IT. The repo's signature defect is a value
//       computed correctly and written where nothing reads it, and a router
//       with no consumer is exactly that shape. §D drives
//       `resolveKaizoMusic` — the function web/kaizo.js calls — and §E
//       asserts the call site in web/kaizo.js by reading the file, so
//       deleting the READER fails this check rather than leaving it green.
//
// AND THE FILE-EXISTENCE TESTS ARE REAL. §C builds `file_exists` from an
// actual listing of this repo's two audio folders, so the answers it asserts
// are the answers this install gives.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  kaizoSetMusic, kaizoMusicPlayable, musFileExists,
  MUS_KNIGHT, MUS_KNIGHT_APPEARS,
  MUS_KAIZOKNIGHT, MUS_KAIZOKNIGHT_ALT,
  MUS_ENDER_THEIRTHEME, MUS_ENDER_APPEARANCE,
  KAIZO_MUS_ALT_STEM,
} from '../../scenes/kaizo-prefight.js';
import { resolveKaizoMusic, CUE_FIGHT, CUE_ARRIVAL } from '../../../web/kaizo-prefight.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

let failures = 0;
let count = 0;
function assert(cond, label) {
  count += 1;
  if (!cond) { failures += 1; console.log(`  FAIL ${label}`); } else console.log(`  ok   ${label}`);
}
function assertEq(got, want, label) {
  assert(Object.is(got, want), `${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}
function section(t) { console.log(`\n== ${t}`); }

// ═══ A: THE FIVE BRANCHES, over a synthetic directory ══════════════════════
//
// Synthetic on purpose: the whole point of the router is the combinations an
// install can be in, and this machine is only ever in one of them. §C then
// asserts the one it IS in.
const dir = (...names) => musFileExists(names);

section('A — the arrival cue, kaizo_set_music("knight_appears.ogg")');
{
  assertEq(kaizoSetMusic(MUS_KNIGHT_APPEARS, { fileExists: dir(MUS_ENDER_APPEARANCE) }),
    MUS_ENDER_APPEARANCE, ':36-39 — ender_theirappearance.ogg present, it wins');
  assertEq(kaizoSetMusic(MUS_KNIGHT_APPEARS, { fileExists: dir() }),
    MUS_KNIGHT_APPEARS, ':42 — absent, the argument comes back unchanged');
  // The flag has no say on this argument: the GML's `knight_appears` arm
  // never reads `global.flag[456]`.
  assertEq(kaizoSetMusic(MUS_KNIGHT_APPEARS, { fileExists: dir(), flag456: true }),
    MUS_KNIGHT_APPEARS, '...and flag[456] does not reach this arm');
}

section('B — the battle track, kaizo_set_music("knight.ogg")');
{
  assertEq(kaizoSetMusic(MUS_KNIGHT, { fileExists: dir(MUS_KAIZOKNIGHT) }),
    MUS_KAIZOKNIGHT, ':68 — A-Side with kaizoknight.ogg present');
  assertEq(kaizoSetMusic(MUS_KNIGHT, {
    fileExists: dir(MUS_KAIZOKNIGHT, MUS_KAIZOKNIGHT_ALT), flag456: true,
  }), MUS_KAIZOKNIGHT_ALT, ':53-54 — B-Side with the alt present');
  assertEq(kaizoSetMusic(MUS_KNIGHT, { fileExists: dir(MUS_ENDER_THEIRTHEME) }),
    MUS_ENDER_THEIRTHEME, ':72 — no kaizoknight.ogg, ender_theirtheme.ogg is the fallback');
  assertEq(kaizoSetMusic(MUS_KNIGHT, { fileExists: dir() }),
    MUS_KNIGHT, ':76 — neither, and the vanilla name comes back');
  // THE ORDER OF THE TWO FALLBACKS IS LOAD-BEARING: `kaizoknight.ogg` is
  // tested FIRST and, if present, `ender_theirtheme.ogg` is never reached —
  // even on the B-Side, where the alt is missing and the stem is returned.
  assertEq(kaizoSetMusic(MUS_KNIGHT, {
    fileExists: dir(MUS_KAIZOKNIGHT, MUS_ENDER_THEIRTHEME), flag456: true,
  }), KAIZO_MUS_ALT_STEM, '...and kaizoknight.ogg shadows ender_theirtheme.ogg entirely');
}

section('B2 — THE THREE ORIGINAL BUGS, asserted as bugs (CLAUDE.md law 4)');
{
  // BUG 1 — the missing suffix. Every other branch returns a filename.
  const tempflag = {};
  const stem = kaizoSetMusic(MUS_KNIGHT, {
    fileExists: dir(MUS_KAIZOKNIGHT), flag456: true, tempflag,
  });
  assertEq(stem, KAIZO_MUS_ALT_STEM, ':61 — the B-Side miss returns a STEM, not a file');
  assert(!stem.endsWith('.ogg'), '...and it really has no .ogg (do not "fix" this)');
  assertEq(stem + '.ogg', MUS_KAIZOKNIGHT_ALT, '...it is the alt track\'s name, minus the suffix');

  // BUG 2 — the dead write's value is backwards-shaped: 0 on the miss.
  assertEq(tempflag[76], 0, ':60 — global.tempflag[76] = 0 on the miss branch');
  const hit = {};
  kaizoSetMusic(MUS_KNIGHT, {
    fileExists: dir(MUS_KAIZOKNIGHT, MUS_KAIZOKNIGHT_ALT), flag456: true, tempflag: hit,
  });
  assertEq(hit[76], 1, ':53 — and 1 on the hit branch');

  // ...and NEITHER write reaches anything. The A-Side never touches it.
  const aside = {};
  kaizoSetMusic(MUS_KNIGHT, { fileExists: dir(MUS_KAIZOKNIGHT), tempflag: aside });
  assertEq(aside[76], undefined, '...and the A-Side does not write it at all');

  // The GML's own no-final-return.
  assertEq(kaizoSetMusic('something_else.ogg', { fileExists: dir() }), undefined,
    'an unknown argument falls off the end of the function — undefined, not arg0');
  assertEq(kaizoSetMusic('', { fileExists: dir() }), '', ':30-33 — the empty string short-circuits');
}

section('B3 — global.tempflag[76] IS READ NOWHERE (bug 3), proved by grep');
{
  // The claim in the module header is a NEGATIVE one, and a negative claim
  // that nothing checks rots the first time someone invents a consumer. This
  // is the check: if a reader of index 76 ever appears in kaizo/ or web/,
  // this fails and whoever added it has to say why.
  const files = [];
  const walk = (rel) => {
    const abs = join(REPO, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      if (e.isDirectory()) walk(join(rel, e.name));
      // THIS FILE IS ABOUT tempflag[76] and mentions it in prose and in its
      // own matcher; counting itself would make the assertion unfalsifiable.
      else if (e.name === 'check-prefight-music.mjs') continue;
      else if (e.name.endsWith('.js') || e.name.endsWith('.mjs')) files.push(join(rel, e.name));
    }
  };
  walk('kaizo');
  walk('web');
  // A READ looks like `tempflag[76]` or `tempflag76` on the right of
  // something; a WRITE is an assignment. Both are counted, then the writes
  // are subtracted, because the two writes are the mod's own and must stay.
  let reads = 0;
  const readers = [];
  for (const f of files) {
    for (const line of readFileSync(join(REPO, f), 'utf8').split('\n')) {
      // Comments are prose about this very bug; only code counts.
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      if (!/tempflag\s*\[\s*76\s*\]|tempflag76/.test(code)) continue;
      if (/tempflag\s*\[\s*76\s*\]\s*=(?!=)/.test(code)) continue; // the two writes
      if (/tempflag76:/.test(code)) continue;                      // the record field
      reads += 1;
      readers.push(`${f}: ${line.trim()}`);
    }
  }
  assert(reads === 0,
    `nothing in kaizo/ or web/ READS global.tempflag[76]${reads ? `\n       ${readers.join('\n       ')}` : ''}`);
  assert(files.length > 100, `...and the walk actually looked at the tree (${files.length} files)`);
}

// ═══ C: THE REAL DIRECTORIES ═══════════════════════════════════════════════
section('C — the real ../mus/, read off this install');
const realMus = new Set();
{
  // `assets/audio/` — the vanilla pack, listed by its own manifest (the same
  // file render/audio.js reads), falling back to the directory itself.
  const idx = join(REPO, 'assets', 'audio', 'index.json');
  if (existsSync(idx)) {
    const list = JSON.parse(readFileSync(idx, 'utf8'));
    if (Array.isArray(list)) for (const n of list) realMus.add(`${n}.ogg`);
    else for (const v of Object.values(list)) realMus.add(v);
  }
  // `kaizo/assets/audio/` — the mod's optional songs. No manifest; the
  // directory IS the manifest, and it may not exist in a fresh clone.
  const kdir = join(REPO, 'kaizo', 'assets', 'audio');
  if (existsSync(kdir)) for (const n of readdirSync(kdir)) realMus.add(n);

  const fileExists = musFileExists(realMus);
  assert(realMus.size > 0, `the listing is not empty (${realMus.size} files)`);

  // WHAT THIS INSTALL ACTUALLY ANSWERS. These are stated as conditionals on
  // the listing rather than as fixed expectations, because the whole point of
  // the router is that a player's folder decides — and a check that demanded
  // one particular folder would be asserting the machine, not the mod.
  const hasKaizo = fileExists(MUS_KAIZOKNIGHT);
  const hasAlt = fileExists(MUS_KAIZOKNIGHT_ALT);
  const hasTheir = fileExists(MUS_ENDER_THEIRTHEME);
  const hasAppear = fileExists(MUS_ENDER_APPEARANCE);
  console.log(`  (kaizoknight.ogg ${hasKaizo}, kaizoknight_alt.ogg ${hasAlt},`
    + ` ender_theirtheme.ogg ${hasTheir}, ender_theirappearance.ogg ${hasAppear})`);

  const aside = kaizoSetMusic(MUS_KNIGHT, { fileExists, flag456: false });
  const bside = kaizoSetMusic(MUS_KNIGHT, { fileExists, flag456: true });
  const arrive = kaizoSetMusic(MUS_KNIGHT_APPEARS, { fileExists });

  const wantAside = hasKaizo ? MUS_KAIZOKNIGHT : (hasTheir ? MUS_ENDER_THEIRTHEME : MUS_KNIGHT);
  const wantBside = hasKaizo
    ? (hasAlt ? MUS_KAIZOKNIGHT_ALT : KAIZO_MUS_ALT_STEM)
    : (hasTheir ? MUS_ENDER_THEIRTHEME : MUS_KNIGHT);
  const wantArrive = hasAppear ? MUS_ENDER_APPEARANCE : MUS_KNIGHT_APPEARS;

  assertEq(aside, wantAside, 'the A-Side battle track on THIS install');
  assertEq(bside, wantBside, 'the B-Side battle track on THIS install');
  assertEq(arrive, wantArrive, 'the arrival cue on THIS install');

  // AND THE ONE THAT MATTERS FOR THE DELIVERABLE. The mod's release zip ships
  // only `kaizoknight.ogg`, which is what this repo has — so the B-Side hits
  // bug 1 and its answer names no file. That is the mod's behaviour, and
  // `kaizoMusicPlayable` is how the page finds out before it tries to play it.
  if (hasKaizo && !hasAlt) {
    assertEq(bside, KAIZO_MUS_ALT_STEM, 'kaizoknight.ogg without the alt: the B-Side gets the stem');
    assertEq(kaizoMusicPlayable(bside, fileExists), false, '...and it names no file that exists');
    assertEq(kaizoMusicPlayable(aside, fileExists), true, '...while the A-Side names one that does');
  }
  assertEq(kaizoMusicPlayable(arrive, fileExists), true, 'the arrival track is always a real file here');
}

// ═══ D: THE CONSUMER, DRIVEN ═══════════════════════════════════════════════
section('D — resolveKaizoMusic, the function web/kaizo.js calls');
{
  const baseManifest = { [CUE_FIGHT]: MUS_KNIGHT, [CUE_ARRIVAL]: MUS_KNIGHT_APPEARS };
  const kaizoDirUrl = 'https://example.invalid/kaizo/assets/audio/';

  // The shipped install: kaizoknight.ogg and the vanilla pack.
  const shipped = new Set([MUS_KNIGHT, MUS_KNIGHT_APPEARS, MUS_KAIZOKNIGHT]);
  const a = resolveKaizoMusic({ musFiles: shipped, baseManifest, flag456: false, kaizoDirUrl });
  assertEq(a.fight.verdict, MUS_KAIZOKNIGHT, 'A-Side: the router said kaizoknight.ogg');
  assertEq(a.fight.playable, true, '...it is playable');
  assertEq(a.overrides[CUE_FIGHT], `${kaizoDirUrl}${MUS_KAIZOKNIGHT}`,
    '...and mus_knight is overridden to the mod folder (this is the old literal, now derived)');
  assertEq(a.overrides[CUE_ARRIVAL], undefined,
    'the arrival needs NO override — the base pack already serves knight_appears');
  assertEq(a.arrival.playable, true, '...and it is playable, so the page will cue it');

  const b = resolveKaizoMusic({ musFiles: shipped, baseManifest, flag456: true, kaizoDirUrl });
  assertEq(b.fight.verdict, KAIZO_MUS_ALT_STEM, 'B-Side: the router still returns the stem');
  assertEq(b.fight.playable, false, '...marked unplayable, faithfully');
  assert(typeof b.fight.deviation === 'string' && b.fight.deviation.length > 40,
    '...and the page records WHY it is about to deviate');
  assertEq(b.fight.file, MUS_KAIZOKNIGHT,
    '...playing kaizoknight.ogg rather than nothing — the one stated deviation');
  assertEq(b.overrides[CUE_FIGHT], `${kaizoDirUrl}${MUS_KAIZOKNIGHT}`, '...through the same override');

  // A full folder: every optional file present.
  const full = new Set([...shipped, MUS_KAIZOKNIGHT_ALT, MUS_ENDER_APPEARANCE, MUS_ENDER_THEIRTHEME]);
  const f = resolveKaizoMusic({ musFiles: full, baseManifest, flag456: true, kaizoDirUrl });
  assertEq(f.fight.verdict, MUS_KAIZOKNIGHT_ALT, 'full folder, B-Side: the alt track');
  assertEq(f.fight.deviation, null, '...no deviation needed');
  assertEq(f.overrides[CUE_ARRIVAL], `${kaizoDirUrl}${MUS_ENDER_APPEARANCE}`,
    '...and the arrival cue is finally overridden too');

  // An empty folder: nothing but the vanilla names, and no override at all.
  const bare = resolveKaizoMusic({
    musFiles: new Set([MUS_KNIGHT, MUS_KNIGHT_APPEARS]), baseManifest, flag456: false, kaizoDirUrl,
  });
  assertEq(bare.fight.verdict, MUS_KNIGHT, 'bare pack: the vanilla knight theme');
  assertEq(Object.keys(bare.overrides).length, 0, '...and nothing is overridden');

  // THE DEAD WRITE HAPPENS IN THE CONSUMER TOO — it is the mod's, and the
  // consumer passes a `tempflag` bag so it does, exactly as the game does.
  assertEq(b.fight.tempflag76, 0, 'the consumer performed the mod\'s dead write (miss: 0)');
  assertEq(f.fight.tempflag76, 1, '...and on the hit branch (1)');
}

// ═══ E: THE READER EXISTS ══════════════════════════════════════════════════
section('E — web/kaizo.js really reads it (the signature defect, head-on)');
{
  const page = readFileSync(join(REPO, 'web', 'kaizo.js'), 'utf8');
  assert(/from '\.\/kaizo-prefight\.js'/.test(page), 'web/kaizo.js imports web/kaizo-prefight.js');
  assert(/resolveKaizoMusic\(/.test(page), '...and CALLS resolveKaizoMusic');
  assert(/createAudio\(\s*\{\s*overrides:\s*kaizoMusic\.overrides\s*\}\s*\)/.test(page),
    '...and hands its overrides to createAudio — the wire that makes it audible');
  assert(/audio\.play\(\[\{\s*name:\s*CUE_ARRIVAL/.test(page),
    '...and CUES THE ARRIVAL TRACK over the opening roar (PTB02:199)');
  assert(/audio\.stopLoop\(CUE_ARRIVAL\)/.test(page),
    '...and stops it when the intro ends — snd_free_all() at PTB02:550');
  assert(/kaizoMusic\.arrival\.playable/.test(page),
    '...gated on playable, so an install without the file cues silence rather than a miss');
  // AND THE LITERAL IS GONE. If someone re-adds a hardcoded override the
  // router stops deciding anything and this check is the only thing that
  // would notice.
  // COMMENTS STRIPPED FIRST: the note at the call site QUOTES the literal it
  // replaced, which is exactly the string being forbidden.
  const pageCode = page.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert(!/overrides:\s*\{\s*mus_knight:/.test(pageCode),
    'the old hardcoded mus_knight override is gone (the router decides now)');
}

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${count - failures}/${count} assertions`);
process.exit(failures ? 1 : 0);
