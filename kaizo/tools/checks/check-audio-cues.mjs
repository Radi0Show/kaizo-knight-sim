#!/usr/bin/env node
// EVERY AUDIO CUE THE SHIPPED CODE CAN REACH MUST RESOLVE TO A REAL FILE —
// by the same argument that made check-sprites.mjs necessary, and with the
// same failure mode.
//
// render/audio.js resolves a cue name against ONE map: `assets/audio/index.json`,
// merged with whatever `overrides` the page passes in (the kaizo build ships
// its own music that way, from kaizo/assets/audio/). A name in neither is
// added to a `missing` Set and dropped — NO throw, NO console error, nothing
// on screen. The attack still plays. It is simply silent, forever, and no
// other check in this repo can see it.
//
// THIS IS NOT HYPOTHETICAL. `board_ocean` — the loop the B-Side epilogue parks
// on at sb_con 99, the last thing that happens in the whole Weird Route — has
// no file and no manifest entry anywhere in this repo. Three separate checks
// (check-ending-driver, check-sideb-ending, check-ending-draw) assert that the
// cue is EMITTED, all three are green, and the epilogue ends in silence. That
// is the exact shape of the sprite failures this repo has been burned by
// twice: the translation is faithful and there is nothing to play.
//
// So the gate is the same shape as check-sprites': scan every shipped .js with
// comments stripped, match all three quote styles, and resolve the result
// against what is really on disk.
//
//   node kaizo/tools/checks/check-audio-cues.mjs

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const BASE_AUDIO = join(repo, 'assets', 'audio');
const KAIZO_AUDIO = join(repo, 'kaizo', 'assets', 'audio');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

// ── what actually resolves ────────────────────────────────────────────────
const indexPath = join(BASE_AUDIO, 'index.json');
ok(existsSync(indexPath), 'assets/audio/index.json exists (render/audio.js resolves every cue through it)');
if (!existsSync(indexPath)) process.exit(1);
const index = JSON.parse(readFileSync(indexPath, 'utf8'));

// A cue can also be served by an OVERRIDE pointing into the kaizo lane's own
// audio directory (web/kaizo-prefight.js builds exactly that for the mod's
// songs), so those files resolve too — by FILENAME, which is how the override
// names them.
const kaizoFiles = existsSync(KAIZO_AUDIO)
  ? readdirSync(KAIZO_AUDIO).filter((f) => /\.(ogg|m4a|wav|mp3)$/.test(f)) : [];
const stem = (f) => f.replace(/\.(ogg|m4a|wav|mp3)$/, '');
// BY KEY **AND** BY FILENAME. The GML passes filenames where the page passes
// cue names, and the two are not the same string: `mus_knight` is the cue,
// `knight.ogg` is the file, and kaizo/scenes/kaizo-prefight.js quotes the
// filename because that is what `kaizo_set_music` returns. Resolving only on
// keys reported `knight` as a missing sound while it was playing.
const resolvable = new Set([
  ...Object.keys(index),
  ...Object.values(index).map(stem),
  ...kaizoFiles.map(stem),
]);
console.log(`  --  ${Object.keys(index).length} cues in assets/audio/index.json, `
  + `${kaizoFiles.length} file(s) in kaizo/assets/audio/ (${kaizoFiles.join(', ') || 'none'})`);

// ── every index entry's file is really on disk ────────────────────────────
// Presence in the manifest is what render/audio.js trusts; it fetches the file
// only when the cue fires, and a 404 there is swallowed the same way a missing
// entry is. So the manifest has to be checked against the directory, not
// believed.
{
  const absent = Object.entries(index).filter(([, f]) => !existsSync(join(BASE_AUDIO, f)));
  ok(absent.length === 0,
    `every index.json entry has its file on disk (${Object.keys(index).length} checked)`
    + `${absent.length ? ` — MISSING: ${absent.map(([k, f]) => `${k} -> ${f}`).join(', ')}` : ''}`);

  const claimed = new Set(Object.values(index));
  const orphans = readdirSync(BASE_AUDIO)
    .filter((f) => /\.(ogg|m4a|wav|mp3)$/.test(f) && !claimed.has(f));
  console.log(`  --  ${orphans.length} audio file(s) on disk that no cue names`
    + `${orphans.length ? `: ${orphans.join(', ')}` : ''}`);
}

// ── the scan ──────────────────────────────────────────────────────────────
const SRC_ROOTS = ['kaizo', 'web', 'sim', 'render', 'input'];

function jsUnder(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n === 'tools' || n === 'node_modules') continue;
      jsUnder(p, out);
    } else if (n.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Strip // and block comments without touching string literals. */
function stripComments(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { out += c + (src[i + 1] ?? ''); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i += 1; continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2; continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    out += c; i += 1;
  }
  return out;
}

// TWO SHAPES, because the code writes cues both ways: a bare cue name
// (`snd_*` / `mus_*`, what render/audio.js keys on) and a FILENAME with an
// extension (`board_ocean.ogg`, `kaizoknight.ogg` — the mod's own GML passes
// filenames, and the epilogue strips the extension on the way in).
const CUE_RE = /['"`]((?:snd|mus)_[a-z0-9_]+)['"`]|['"`]([A-Za-z0-9_]+\.(?:ogg|m4a|wav|mp3))['"`]/g;

/**
 * `snd_*` names that are render/audio.js's own GML-shaped API, not cues.
 *
 * The mod's GML calls `snd_play(x)`, `snd_loop(x)`, `snd_stop(x)`,
 * `snd_free(x)`, `snd_init(file)` and `snd_volume(...)`; the translations quote
 * those calls, and a cue scanner that cannot tell a verb from a noun reports
 * every one of them as a missing sound. Listed rather than pattern-matched so
 * that a real cue which happens to start with one of these words cannot be
 * swallowed by a prefix rule.
 */
const GML_AUDIO_VERBS = new Set([
  'snd_play', 'snd_loop', 'snd_stop', 'snd_free', 'snd_init', 'snd_volume',
  'snd_pitch', 'snd_pause', 'snd_resume', 'snd_play_x', 'snd_play_pitch',
  'snd_nosound', 'snd_exists',
]);

const cued = new Map(); // cue name -> Set(file)
const srcFiles = SRC_ROOTS.flatMap((r) => jsUnder(join(repo, r)));
for (const p of srcFiles) {
  const rel = relative(repo, p).replace(/\\/g, '/');
  for (const m of stripComments(readFileSync(p, 'utf8')).matchAll(CUE_RE)) {
    const name = m[1] ?? stem(m[2]);
    if (GML_AUDIO_VERBS.has(name)) continue;
    if (!cued.has(name)) cued.set(name, new Set());
    cued.get(name).add(rel);
  }
}
console.log(`  --  scanned ${srcFiles.length} shipped .js files; ${cued.size} distinct cue name(s) named in code`);
ok(cued.size > 0, 'found audio cues to check');

/**
 * Cues that are NAMED by shipped code and deliberately absent, each with the
 * receipt. Same contract as check-sprites' KNOWN_ABSENT: an entry that starts
 * resolving, or stops being named, fails — so no excuse can go stale.
 *
 * THE THREE PROBES are not gaps at all. `kaizo_set_music` is the mod's
 * file-existence ROUTER: the GML asks `file_exists(dir + "<name>.ogg")` and
 * branches on the answer, and the page reproduces that with a HEAD request.
 * A miss is the ANSWER, not a failure — these three are expected to 404 on
 * every install that did not take the mod's optional song downloads, and the
 * router's behaviour on the miss is what check-prefight-music.mjs pins.
 */
const KNOWN_ABSENT = {
  kaizoknight_alt: 'kaizo_set_music HEAD probe — the miss is the answer (check-prefight-music.mjs)',
  ender_theirtheme: 'kaizo_set_music HEAD probe — optional mod song, absent by design',
  ender_theirappearance: 'kaizo_set_music HEAD probe — optional mod song, absent by design',
  // ── NINE OF THE TEN CLOSED, 2026-09-12 ─────────────────────────────────
  // The ten cues this check found on its first run were ten real sounds with
  // no file. Nine of them now have one, in knight-sim's assets/audio/ and in
  // this repo's vendored mirror of it, each the game's own bytes and none of
  // them synthesised:
  //   * four were loose .ogg beside the oracle build's executable
  //     (snd_icespell, snd_ghostappear, snd_great_shine, snd_spell_pacify) —
  //     copied, unmodified, from knight-research/kaizo-mod/oracle/chapter3_windows/;
  //   * five were EMBEDDED and came out of the mod's own data file with UTMT
  //     (snd_knight_laser 202, snd_knight_beam 191, snd_rocket_bc 286,
  //     snd_leaf_dodge 217 — all audiogroup 0 — and snd_sussurprise, group 1
  //     audioid 68). They are RIFF/WAVE, shipped as .wav exactly as extracted;
  //     the pack already mixes .ogg, .m4a and .wav and render/audio.js reads
  //     the container off index.json rather than guessing.
  // Their entries are gone from this list rather than annotated, which is the
  // point of the staleness guard below: a closed hole must stop being listed,
  // or the list stops meaning anything. check-audio-files.mjs is the positive
  // half — it asserts each of the nine resolves to a non-empty file with a
  // real audio header, which a filename check cannot see.
  //
  // THE ONE THAT IS STILL SILENT, and it is the one that matters most. The
  // B-Side epilogue's terminal loop at sb_con 99.
  //
  // IT IS NOT A SOUND ASSET AT ALL, which is why no extraction can reach it:
  // a UTMT pass over the mod's pristine data.win for all ten names reported
  // `board_ocean (NO SUCH SOUND)` while writing the other five, and the GML
  // says the same thing — `snd_init` (gml_GlobalScript_snd_init.gml) builds
  // `"mus/" + arg0` and calls `audio_create_stream` on it, so
  // `snd_init("board_ocean.ogg")` is a STREAM READ OFF DISK from DELTARUNE's
  // `mus/` folder, one directory above chapter3_windows. That folder was
  // never copied into knight-research: the oracle build carries the 26 loose
  // sound effects and no music at all.
  //
  // So the fix is one file copy, and the only copies of it on this machine are
  // inside the Steam install and inside the standalone kaizo-game build, both
  // of which this lane is forbidden to touch. It needs the user, or a mus/
  // copy staged into knight-research. It must NOT be substituted with another
  // track: a wrong song under the Weird Route's last scene is worse than the
  // silence, which is the whole reason this entry stays here instead of being
  // quietly satisfied.
  // Where it goes when it lands: assets/audio/board_ocean.ogg in knight-sim,
  // plus the `"board_ocean": "board_ocean.ogg"` line in assets/audio/index.json.
  board_ocean: 'MISSING FOR REAL — B-Side epilogue terminal loop. NOT a sound '
    + 'asset (UTMT: "NO SUCH SOUND"); snd_init streams it from DELTARUNE\'s mus/ '
    + 'folder, which is not in knight-research. Needs a copy of mus/board_ocean.ogg '
    + '-> knight-sim assets/audio/ + index.json',
};

const unresolved = [...cued.keys()].filter((c) => !resolvable.has(c) && !(c in KNOWN_ABSENT));
ok(unresolved.length === 0,
  `every audio cue named in shipped code resolves to a real file `
  + `(${cued.size} checked, ${Object.keys(KNOWN_ABSENT).length} known-absent)`
  + `${unresolved.length
    ? ` — MISSING: ${unresolved.map((c) => `${c} (${[...cued.get(c)].join(', ')})`).join('; ')}`
    : ''}`);

{
  const stale = Object.keys(KNOWN_ABSENT).filter((c) => resolvable.has(c));
  ok(stale.length === 0,
    `no KNOWN_ABSENT cue has quietly started resolving${stale.length
      ? ` — REMOVE (and celebrate): ${stale.join(', ')}` : ''}`);
  const dead = Object.keys(KNOWN_ABSENT).filter((c) => !cued.has(c));
  ok(dead.length === 0,
    `every KNOWN_ABSENT cue is still named by real code${dead.length
      ? ` — DEAD EXCUSE: ${dead.join(', ')}` : ''}`);
}

// THE SILENT LIST, PRINTED EVERY RUN. A known-absent entry is an admission,
// not an excuse, and an admission that only lives in a source comment is one
// nobody reads. Everything here is a cue the player triggers and does not hear.
{
  const probes = ['kaizoknight_alt', 'ender_theirtheme', 'ender_theirappearance'];
  const silent = Object.keys(KNOWN_ABSENT).filter((c) => !probes.includes(c)).sort();
  console.log('');
  console.log(`  !!  ${silent.length} cue(s) fire and play NOTHING. Not a translation fault — `
    + 'the sound has no file:');
  for (const c of silent) console.log(`      ${c}: ${KNOWN_ABSENT[c]}`);
  console.log('      DO NOT SYNTHESISE ANY OF THEM. Extract or copy the real asset.');
}

console.log('');
if (failed) {
  console.log(`check-audio-cues: ${failed} FAILING`);
  process.exit(1);
}
console.log('check-audio-cues: green.');
