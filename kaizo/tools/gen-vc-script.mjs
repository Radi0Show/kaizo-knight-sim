#!/usr/bin/env node
// Generate kaizo/versions/vc-script.js from the PRIVATE research extraction
// (knight-research/kaizo-mod/fight-script.json — itself derived from the
// mod's decompiled Other_24 by extract-fight-script.mjs). DEV-TIME ONLY:
// this script needs the private repo present; the generated module is
// standalone and carries the publish gate in its header.
//
//   node kaizo/tools/gen-vc-script.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RESEARCH = join(homedir(), 'knight-research', 'kaizo-mod', 'fight-script.json');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'versions', 'vc-script.js');

const fs = JSON.parse(readFileSync(RESEARCH, 'utf8'));

/** One driver row from a struct node. */
function row(node) {
  return {
    id: node.id,
    ac: node.ac,
    difficulty: node.difficulty ?? 0,
    // The struct's attackPhase — the DISPATCH branches on it (Stars, Flurry,
    // Tunnel arms differ per phase), so it rides every row.
    phase: node.phase,
    name: node.name ?? node.id.replace(/^atk_/, ''),
    msg: node.msg ?? null,
    setVars: node.setVars?.length ? node.setVars : undefined,
  };
}

/** Group the main chain by phase, preserving chain order. */
function buildTable(structs, chain, phase4Entry) {
  const table = { 1: [], 2: [], 3: [], 4: [] };
  for (const id of chain) {
    const n = structs[id];
    if (n.phase >= 1 && n.phase <= 3) table[n.phase].push(row(n));
  }
  // Phase 4 is its own chain, walked from the DEFAULT entry node until the
  // AfterFinal sentinel. The live entry INDEX is dynamic (kaizo_phase4 is
  // reassigned by setVars as the fight progresses) — the driver hook looks
  // the current value up in this list by id.
  for (let id = phase4Entry; id && structs[id]; id = structs[id].next) {
    table[4].push(row(structs[id]));
    if (structs[id].next === 'AfterFinal') break;
  }
  return table;
}

const table = buildTable(fs.structs, fs.mainChain, fs.phase4Entry);

// The B-Side: same structs with the mod's k_sideb field swaps applied.
const sidebStructs = JSON.parse(JSON.stringify(fs.structs));
for (const adj of fs.sidebAdjustments) {
  const n = sidebStructs[adj.struct];
  if (!n) continue;
  if (adj.field === 'attackChoice') n.ac = adj.value;
  else if (adj.field === 'attackMsg') n.msg = adj.value;
  else if (adj.field === 'attackdiff') n.difficulty = adj.value;
}
const sidebTable = buildTable(sidebStructs, fs.mainChain, fs.phase4Entry);

const loopIndex = table[2].findIndex((r) => r.id === fs.chainLoopsBackTo);

const banner = `// GENERATED — do not edit. kaizo/tools/gen-vc-script.mjs, from the private
// research extraction of EnderCat8's "Kaizo Roaring Knight" v2.3.3
// (knight-research/kaizo-mod/fight-script.json <- the mod's own
// obj_knight_enemy Other_24 attack-struct table).
//
// PUBLISH GATE (kaizo/HANDOFF.md §5-C): this file describes ANOTHER
// AUTHOR'S creative work. It exists in the working tree for local research
// and playtesting. It must NOT be committed/pushed/published without
// EnderCat8's permission. Ask the user before any commit that includes it.
//
// Semantics recovered from the mod's obj_knight_enemy Step_0:
//   * turn end: current = current.nextAttack; "AfterFinal" -> the node the
//     phase-4 interrupt suspended (kaizo_resumeAT) REPLAYS.
//   * the HP gate fires at the end of ANY turn once hp <= maxhp * 0.6 and
//     jumps to the node named by the LIVE kaizo_phase4 variable (reassigned
//     mid-fight by setVars), one-shot via haveusedroaring.
//   * VC_LOOP: phase 3's last node chains back into PHASE 2's Quickslash —
//     the endless loop cycles phase 2 + 3 material.
`;

const body = `${banner}
export const VC_TABLE = ${JSON.stringify(table, null, 2)};

export const VD_TABLE = ${JSON.stringify(sidebTable, null, 2)};

/** Phase 3's last row hands to phase 2 at this row index (the mod's chain). */
export const VC_LOOP = { phase: 2, turn: ${loopIndex} };

/** The default phase-4 entry node id (kaizo_phase4's initial value). */
export const VC_PHASE4_DEFAULT = ${JSON.stringify(fs.phase4Entry)};

/** Knight stats under the mod (scr_monstersetup): hp/at/df. */
export const VC_KNIGHT = { maxhp: 10000, at: 52, df: 5 };

/** The HP gate fraction (Step_0: hp <= maxhp * 0.6 opens phase 4). */
export const VC_GATE_FRACTION = 0.6;
`;

writeFileSync(OUT, body);
console.log(`VC_TABLE phases: ${table[1].length}/${table[2].length}/${table[3].length}/${table[4].length}, `
  + `loop -> phase 2 row ${loopIndex}; wrote ${OUT}`);
