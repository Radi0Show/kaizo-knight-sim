// THE SHIPPED BUILD SPEAKS AS THE GAME, NOT AS ITS AUTHORS.
//
// WHY THIS FILE EXISTS. A note reading
//
//     KAIZO — pre-fight mode select (stand-in widget; not the real menu)
//
// sat in `web/kaizo.html` in front of every player who opened the mode select,
// and version strings like `KAIZO: ORACLE B-SIDE (Weirder Route — Kris &
// Noelle, WIP)` went to the console on boot. None of that is the game. It is
// the project talking to itself in the project's own vocabulary — "oracle",
// "ledgered", "approx", "WIP", "stand-in" — in the one place where the
// audience is someone playing a fight.
//
// THE DISTINCTION THIS CHECK ENFORCES, and it is the whole point:
//
//   COMMENTS ARE NOT SCANNED. This tree is ~45% comments on purpose — the GML
//   citations, the `ORIGINAL BUG:` markers and the "tried and reverted" notes
//   are the most valuable thing in it, both repos' CLAUDE.md require them, and
//   the vendor step strips every one of them from the copy that ships
//   (thedevice/tools/strip-tree.mjs). A citation that says "no oracle for this
//   branch" is doing its job and must never be deleted to please a linter.
//
//   STRING LITERALS ARE SCANNED, because a string survives the strip and a
//   curious player finds it in DevTools or View Source. So does HTML text.
//
// So the scanner below tokenises rather than greps: it walks each file's
// characters, tracks comment/string/regex state, and only ever tests what came
// out of a quote (or out of an HTML text node). A word banned here in a string
// is welcome two lines up in a comment.
//
// NOT WIRED into verify-kaizo.mjs's WIRED set, so the gate reports it without
// enforcing it. Wiring it is a one-line change in that file, which belongs to
// another lane.

import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, extname, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) { failures += 1; console.log(`  FAIL ${msg}`); } else { console.log(`  ok   ${msg}`); }
};

// ── WHAT SHIPS ─────────────────────────────────────────────────────────────
//
// The vendor script copies `web sim render input assets kaizo` and then
// deletes `kaizo/tools`. `sim/`, `render/`, `input/` and `assets/` are the
// VENDORED ENGINE — knight-sim's, not this repo's to police — so this scans
// the two trees this repo owns and actually ships.
const ROOTS = ['web', 'kaizo'];
const SKIP_DIRS = new Set(['tools', 'assets', 'node_modules', '.git', 'oracle', 'docs']);
const EXTS = new Set(['.js', '.mjs', '.html', '.htm']);

function walk(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(p, out);
    } else if (EXTS.has(extname(name).toLowerCase())) {
      out.push(p);
    }
  }
  return out;
}

// ── THE TOKENISER ──────────────────────────────────────────────────────────
//
// Returns every string literal in a JS source with its line number, and
// nothing else. Line comments, block comments and regex literals are consumed
// and discarded; a quote inside any of them is not a string.
//
// The regex/divide ambiguity is settled the way every hand-written JS scanner
// settles it: a `/` is a regex only when the previous significant character
// cannot end an expression. Getting that wrong costs at worst a missed or an
// extra literal in a file with no banned word in it either way — this is a
// voice check, not a parser, and it never rewrites anything.
function jsStrings(src) {
  const out = [];
  let line = 1;
  let prev = '';                 // last significant (non-space) code character
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') { line += 1; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      line += 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (c === '/' && prev && !/[\w)\]'"`]/.test(prev)) {
      // A regex literal. Character classes may hold an unescaped `/`.
      i += 1;
      let cls = false;
      while (i < src.length && src[i] !== '\n') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') cls = true;
        else if (src[i] === ']') cls = false;
        else if (src[i] === '/' && !cls) break;
        i += 1;
      }
      prev = '/';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      const startLine = line;
      let text = '';
      i += 1;
      while (i < src.length) {
        const d = src[i];
        if (d === '\\') { text += src[i + 1] ?? ''; i += 2; continue; }
        if (d === quote) break;
        if (d === '\n') { if (quote !== '`') break; line += 1; }
        // `${...}` in a template is code, not text: skip it wholesale rather
        // than treat an expression's own strings as this literal's content.
        if (quote === '`' && d === '$' && src[i + 1] === '{') {
          let depth = 1; i += 2;
          while (i < src.length && depth > 0) {
            if (src[i] === '{') depth += 1;
            else if (src[i] === '}') depth -= 1;
            else if (src[i] === '\n') line += 1;
            i += 1;
          }
          continue;
        }
        text += d;
        i += 1;
      }
      out.push({ line: startLine, text });
      prev = quote;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
  }
  return out;
}

/** HTML TEXT NODES and attribute values a reader sees — comments dropped. */
function htmlText(src) {
  const out = [];
  let line = 1;
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i);
      const chunk = src.slice(i, end < 0 ? src.length : end);
      line += (chunk.match(/\n/g) ?? []).length;
      i = end < 0 ? src.length : end + 3;
      continue;
    }
    if (src[i] === '<') {
      // A tag. `content=`/`title=`/`alt=` attribute values ARE reader-visible
      // (a manifest description, an OG card, a tooltip), so they are kept.
      const end = src.indexOf('>', i);
      const tag = src.slice(i, end < 0 ? src.length : end + 1);
      for (const m of tag.matchAll(/\b(content|title|alt|aria-label|placeholder)\s*=\s*"([^"]*)"/g)) {
        if (m[1] !== 'placeholder') out.push({ line, text: m[2] });
      }
      line += (tag.match(/\n/g) ?? []).length;
      i = end < 0 ? src.length : end + 1;
      // <style> and <script> bodies are not prose. Skip them whole.
      const name = /^<\s*(style|script)\b/i.exec(tag)?.[1];
      if (name) {
        const close = src.toLowerCase().indexOf(`</${name}`, i);
        const body = src.slice(i, close < 0 ? src.length : close);
        line += (body.match(/\n/g) ?? []).length;
        i = close < 0 ? src.length : close;
      }
      continue;
    }
    const next = src.indexOf('<', i);
    const text = src.slice(i, next < 0 ? src.length : next);
    if (text.trim()) out.push({ line, text: text.trim() });
    line += (text.match(/\n/g) ?? []).length;
    i = next < 0 ? src.length : next;
  }
  return out;
}

// ── THE BANNED VOICE ───────────────────────────────────────────────────────
//
// Two families, and the second is the one that keeps coming back.
const BANNED = [
  // 1. LLM fingerprints. None of these has ever been legitimate content here.
  [/\bclaude\b/i, 'names the assistant'],
  [/\banthropic\b/i, 'names the vendor'],
  [/co-authored-by/i, 'a commit trailer this repo forbids'],
  [/generated with/i, 'a generation banner'],
  [/\bas an AI\b/i, 'assistant voice'],
  // DIALOGUE-EXEMPT (see DIALOGUE below): a character may say "I've".
  [/\b(let me|I've|I'll|I'm happy to|feel free to)\b/i, 'chat voice', 'dialogue-ok'],

  // 2. The project's private vocabulary, shipped. Each of these is a word the
  //    work uses about itself: none of it means anything to a player, and
  //    several of them read as an apology for the build.
  [/\bstand-?in\b/i, 'calls a thing a stand-in'],
  [/\bplaceholder\b/i, 'calls a thing a placeholder'],
  [/\bscaffold/i, 'calls a thing scaffolding'],
  [/\bWIP\b/, 'a work-in-progress marker'],
  [/\bTODO\b|\bFIXME\b|\bXXX\b/, 'a work marker'],
  [/\boracle\b/i, 'the recording instrument, not a thing in the fight'],
  [/\bledger(ed|s)?\b/i, 'the approximation ledger'],
  [/\bapprox\b/i, 'the approximation ledger'],
  [/\bnot the real (menu|widget|thing)\b/i, 'apologises for its own pixels'],
  [/\bunverified\b|\buntranslated\b/i, 'a verification status'],
];

// TWO EXEMPTIONS, both content rather than voice.
//
// 1. "UNUSED" is not on the banned list at all: `sim/modes.js` ships it as a
//    player-facing label for the seven attacks the vanilla selector can never
//    reach, so it is this product's own word, not an apology.
//
// 2. GAME DIALOGUE IS EXEMPT FROM THE CHAT-VOICE RULE, and it has to be:
//    Susie really does say "Yeah, I've got nothing" (kaizo/party/scenes.js,
//    the mod's own mercy line), and a rule that cannot tell her from an
//    assistant would either redden on the script or be switched off. Dialogue
//    identifies itself by the writer's control codes — a leading `* `, `^n`
//    pauses, `&` line breaks, `\M`/`\E` commands, the `/%` terminator — which
//    no prose written ABOUT the build ever carries.
//    The exemption is PER RULE, not per string: a line of dialogue still may
//    not call itself a stand-in. Only the rules tagged 'dialogue-ok' stand
//    down for it.
const DIALOGUE = /(^\s*\*\s)|\^\d|\/%|\\[MECRF]/;

const files = ROOTS.flatMap((r) => walk(join(repo, r)));
ok(files.length > 20, `scanned the shipped trees (${files.length} files under ${ROOTS.join(', ')})`);

const hits = [];
let literals = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const ext = extname(file).toLowerCase();
  const items = ext === '.html' || ext === '.htm' ? htmlText(src) : jsStrings(src);
  literals += items.length;
  for (const { line, text } of items) {
    if (!text || !/[A-Za-z]/.test(text)) continue;
    const isDialogue = DIALOGUE.test(text);
    for (const [re, why, tag] of BANNED) {
      if (isDialogue && tag === 'dialogue-ok') continue;
      if (re.test(text)) {
        hits.push(`${relative(repo, file).split(sep).join('/')}:${line} — ${why}: ${JSON.stringify(text.slice(0, 120))}`);
        break;
      }
    }
  }
}

ok(literals > 500, `and read their strings, not their comments (${literals} literals/text nodes)`);
for (const h of hits) console.log(`       ${h}`);
ok(hits.length === 0, `no shipped string speaks in the project's own voice (${hits.length} found)`);

// POSITIVE CONTROL — the meta-trap CLAUDE.md warns about: a scanner that
// matches nothing passes for the wrong reason. These two prove the tokeniser
// reads strings and skips comments, so a green line above means "clean", not
// "looked at nothing".
{
  const probe = jsStrings([
    '// a comment saying oracle and WIP, which is allowed',
    '/* a block one, ledgered too */',
    "const a = 'a stand-in widget';",
    'const b = /oracle/.test(x) ? 1 : 2;',
    'const c = `plain ${oracle} text`;',
  ].join('\n'));
  const texts = probe.map((p) => p.text);
  ok(texts.includes('a stand-in widget'), 'the tokeniser finds a banned string literal');
  ok(!texts.some((t) => /comment|block one/.test(t)), '...and does not read comments as strings');
  ok(!texts.some((t) => t === 'oracle'), '...and does not read a regex literal as a string');
  ok(texts.includes('plain  text'), '...and reads a template\'s text without its expressions');
}

console.log(failures === 0
  ? 'check-shipped-voice: OK'
  : `check-shipped-voice: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
