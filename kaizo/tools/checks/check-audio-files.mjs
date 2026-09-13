#!/usr/bin/env node
// THE POSITIVE HALF OF THE AUDIO GATE: a cue must resolve to a file that
// really contains audio.
//
// check-audio-cues.mjs asks "is this cue NAMED anywhere that can answer it" —
// it resolves a cue against the manifest's keys, the manifest's filenames and
// the kaizo lane's directory listing. That is a NAME check, and a name check
// cannot see the failure this file exists for:
//
//   a zero-byte snd_icespell.ogg satisfies every filename test in this repo
//   and plays nothing, forever, with no error anywhere.
//
// That is not a hypothetical either. The ten cues closed and held in
// check-audio-cues' KNOWN_ABSENT ledger were found by checking PNG-style —
// bytes, not names — after months of green gates that only ever checked that a
// name existed. render/audio.js fetches the manifest's file when the cue first
// fires and swallows a 404 and a decode failure identically: `missing.add(name)`
// and silence. So the only way to know a sound will be heard is to open the
// file and look at its first four bytes.
//
// WHAT THIS ASSERTS, all positive:
//   1. every entry in assets/audio/index.json points at a file that EXISTS,
//      is NON-EMPTY, and starts with a real audio container signature
//      (OggS / RIFF....WAVE / ISO-BMFF ftyp / ID3 / MPEG sync);
//   2. the nine cues closed on 2026-09-12 are each in the manifest AND each
//      land on such a file — named one by one, so that losing any of them is
//      a failure rather than a silently smaller sweep;
//   3. the sweep actually ran (a count, so an empty manifest cannot pass).
//
//   node kaizo/tools/checks/check-audio-files.mjs

import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const BASE_AUDIO = join(repo, 'assets', 'audio');

let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '  ok ' : 'FAIL '} ${what}`);
  if (!cond) failed += 1;
};

/**
 * The nine cues that were silent until 2026-09-12, each with where its bytes
 * came from. Listed explicitly rather than derived: this check exists because
 * these nine were played and heard as nothing, and a derived list would stop
 * covering one the moment somebody dropped its manifest line.
 */
const CLOSED = {
  snd_icespell: 'loose .ogg beside the oracle build (obj_icespell Draw_0)',
  snd_ghostappear: 'loose .ogg beside the oracle build (obj_bullet_blocker collision)',
  snd_great_shine: 'loose .ogg beside the oracle build (obj_darkfountain_event Create)',
  snd_spell_pacify: 'loose .ogg beside the oracle build (obj_round_evaluation Draw_0)',
  snd_knight_laser: 'UTMT, audiogroup 0 id 202 (obj_bullet_knight_stream Step_0)',
  snd_knight_beam: 'UTMT, audiogroup 0 id 191 (obj_knight_enemy Step_0)',
  snd_rocket_bc: 'UTMT, audiogroup 0 id 286 (obj_knight_enemy Step_0)',
  snd_leaf_dodge: 'UTMT, audiogroup 0 id 217 (obj_ch3_PTB02 Step_0)',
  snd_sussurprise: 'UTMT, audiogroup 1 id 68 (obj_ch3_PTB02 Step_0, the B-Side epilogue)',
};

/**
 * Container signature, read off the bytes rather than the extension.
 *
 * The extension is the thing a broken file still gets right — a truncated or
 * empty `.ogg` is still called `.ogg` — so the extension is checked only for
 * AGREEMENT with what the bytes say, never trusted on its own.
 *
 * @param {Buffer} b first bytes of the file
 * @returns {string|null} container name, or null if nothing recognisable
 */
function container(b) {
  if (b.length < 12) return null;
  const a = b.toString('latin1', 0, 4);
  if (a === 'OggS') return 'ogg';
  if (a === 'RIFF' && b.toString('latin1', 8, 12) === 'WAVE') return 'wav';
  if (b.toString('latin1', 4, 8) === 'ftyp') return 'm4a';
  if (a.startsWith('ID3')) return 'mp3';
  // A bare MPEG audio frame: 11 sync bits.
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'mp3';
  return null;
}

const EXT_OK = {
  ogg: ['ogg'],
  wav: ['wav'],
  // GameMaker's AAC comes out in an ISO-BMFF container; the pack names those
  // .m4a, and an .mp4 would be the same bytes.
  m4a: ['m4a', 'mp4'],
  mp3: ['mp3'],
};

const indexPath = join(BASE_AUDIO, 'index.json');
ok(existsSync(indexPath), 'assets/audio/index.json exists (the map render/audio.js resolves through)');
if (!existsSync(indexPath)) {
  console.log('');
  console.log('check-audio-files: 1 FAILING');
  process.exit(1);
}
const index = JSON.parse(readFileSync(indexPath, 'utf8'));

// ── 1. every manifest entry is a real, non-empty, recognisable audio file ──
{
  const bad = [];
  let checked = 0;
  let bytes = 0;
  for (const [cue, file] of Object.entries(index)) {
    const p = join(BASE_AUDIO, file);
    if (!existsSync(p)) { bad.push(`${cue} -> ${file}: NO FILE`); continue; }
    const size = statSync(p).size;
    if (size === 0) { bad.push(`${cue} -> ${file}: ZERO BYTES`); continue; }
    const head = readFileSync(p).subarray(0, 16);
    const kind = container(head);
    if (!kind) {
      bad.push(`${cue} -> ${file}: no audio container signature `
        + `(first bytes ${head.subarray(0, 4).toString('hex')})`);
      continue;
    }
    const ext = file.replace(/^.*\./, '').toLowerCase();
    if (!(EXT_OK[kind] ?? []).includes(ext)) {
      bad.push(`${cue} -> ${file}: bytes say ${kind}, name says .${ext}`);
      continue;
    }
    checked += 1;
    bytes += size;
  }
  ok(bad.length === 0,
    `every index.json entry is a non-empty file with a real audio header `
    + `(${Object.keys(index).length} entries)`
    + `${bad.length ? ` — BROKEN: ${bad.join('; ')}` : ''}`);
  // The positive assertion. A sweep that checked nothing passes the test
  // above trivially; this is what makes "green" mean "it looked at files".
  ok(checked >= 90,
    `the sweep really opened files — ${checked} playable, ${(bytes / 1024).toFixed(0)} KB total `
    + '(>= 90 expected; the pack has never been smaller)');
}

// ── 2. the nine closed cues, one assertion each ────────────────────────────
console.log('');
console.log('  --  the nine cues that were silent until 2026-09-12:');
for (const [cue, provenance] of Object.entries(CLOSED)) {
  const file = index[cue];
  if (!file) { ok(false, `${cue}: NOT IN index.json — ${provenance}`); continue; }
  const p = join(BASE_AUDIO, file);
  if (!existsSync(p)) { ok(false, `${cue} -> ${file}: NO FILE — ${provenance}`); continue; }
  const size = statSync(p).size;
  const kind = container(readFileSync(p).subarray(0, 16));
  ok(size > 0 && kind !== null,
    `${cue} -> ${file}: ${kind ?? 'UNRECOGNISED'}, ${size} bytes — ${provenance}`);
}

// ── 2b. the five extracted WAVs really contain SOUND ───────────────────────
// One rung further down the same ladder. A valid RIFF header with an all-zero
// data chunk is a well-formed file that decodes cleanly and plays nothing —
// and "plays nothing" is the entire bug class this gate exists for, so a
// header check alone would be the same mistake in a new shape. These five came
// out of an audio group by id; if an id were wrong the likeliest wrong answer
// is an empty or near-empty blob, which this is the only assertion that sees.
//
// PCM only, and 16-bit PCM at that, which is what GameMaker stored: decoding
// Vorbis to check the four .ogg the same way would mean shipping a decoder,
// and those four were copied whole from the game's own folder rather than
// reassembled from ids, so they carry a different (much smaller) risk.
console.log('');
for (const cue of ['snd_knight_beam', 'snd_knight_laser', 'snd_leaf_dodge',
  'snd_rocket_bc', 'snd_sussurprise']) {
  const file = index[cue];
  const p = file ? join(BASE_AUDIO, file) : null;
  if (!p || !existsSync(p)) { ok(false, `${cue}: no file to measure`); continue; }
  const b = readFileSync(p);
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('latin1', off, off + 4);
    const sz = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') data = { off: off + 8, sz: Math.min(sz, b.length - off - 8) };
    off += 8 + sz + (sz & 1);
  }
  if (!fmt || !data || fmt.bits !== 16) {
    ok(false, `${cue} -> ${file}: not 16-bit PCM (fmt ${JSON.stringify(fmt)})`);
    continue;
  }
  let peak = 0;
  for (let i = data.off; i + 1 < data.off + data.sz; i += 2) {
    const v = Math.abs(b.readInt16LE(i)) / 32768;
    if (v > peak) peak = v;
  }
  const secs = data.sz / (fmt.rate * fmt.ch * (fmt.bits / 8));
  ok(peak > 0.01 && secs > 0.05,
    `${cue} -> ${file}: ${fmt.rate} Hz ${fmt.ch}ch, ${secs.toFixed(2)}s, `
    + `peak ${peak.toFixed(3)} — real sound, not digital silence`);
}

// ── 3. and the one that is still silent, stated rather than assumed ────────
console.log('');
ok(!('board_ocean' in index),
  'board_ocean is still absent from index.json — if this FAILS the hole is '
  + 'closed: drop its KNOWN_ABSENT entry in check-audio-cues.mjs and delete '
  + 'this assertion');
console.log('  !!  board_ocean (the B-Side epilogue loop at sb_con 99) is NOT a sound');
console.log('      asset — snd_init streams it from DELTARUNE\'s mus/ folder, which is');
console.log('      not in knight-research. One file copy, and it needs the user.');

console.log('');
if (failed) {
  console.log(`check-audio-files: ${failed} FAILING`);
  process.exit(1);
}
console.log('check-audio-files: green.');
