// `state.permanentFell` — the seam that removes Kris's fell mercy.
//
// WHAT IT IS FOR. Vanilla's scr_damage forks on the target: slot 0 lands on
// `round(-maxhp / 2)` with doomtype 4, everyone else on -999 with doomtype 12.
// -80 is inside one heal item's reach, so Kris can be brought back; -999
// cannot be. The kaizo mod DELETED that arm from BOTH damage scripts
// (scr_damage.gml:224-232, scr_damage_maxhp.gml:225-231) with no side gate on
// the deletion, so in the mod a fall is permanent for everyone.
//
// The field is plain and optional, so vanilla never sets it and every
// assertion below has an OFF half — otherwise "the flag did nothing" and "the
// flag is correct" look identical (CLAUDE.md: a green suite does not mean a
// change took effect).
import { createState } from '../sim/state.js';
import { scrDamageSingle, scrDamageMaxhp, PARTY } from '../sim/damage.js';
import { TYPE_DEAD, TYPE_SWOON } from '../sim/dmgnumbers.js';

const failures = [];
const eq = (got, want, what) => {
  if (got !== want) failures.push(`${what}: got ${got}, want ${want}`);
};

const build = (permanentFell) => {
  const st = createState({ seed: 7 });
  st.partyHp = PARTY.map((p) => p.maxhp);
  st.invTimer = -1;
  st.knight = { ...(st.knight ?? {}), aoedamage: true, damagereduction: 1 };
  if (permanentFell) st.permanentFell = true;
  return st;
};

// A hit far past anyone's HP, aimed at a fixed slot. The two entry points do
// not take the same arguments -- scrDamageSingle takes a flat number,
// scrDamageMaxhp a FRACTION of max HP plus ignoreDefend/cannotFell -- and
// `aoe: true` is what makes the targeting return the slot asked for instead of
// rolling for one. `cannotFell` must stay FALSE here: that is Flurry's clamp
// to hp - 1, and with it on nothing is ever felled and the whole suite is
// vacuous.
const ENTRIES = [
  ['scrDamageSingle', (st, slot) => scrDamageSingle(st, 9999, slot, { aoe: true })],
  ['scrDamageMaxhp', (st, slot) => scrDamageMaxhp(st, 9, false, false, { aoe: true, target: slot })],
];
const fell = (st, slot, entry) => {
  st.invTimer = -1;
  const before = st.dmg?.list.length ?? 0;
  entry(st, slot);
  const n = (st.dmg?.list ?? [])[before];
  return { hp: st.partyHp[slot], type: n?.type };
};

for (const [label, entry] of ENTRIES) {
  // OFF — vanilla. Kris gets the mercy, the others do not.
  const off = build(false);
  const offKris = fell(off, 0, entry);
  eq(offKris.hp, Math.round(-PARTY[0].maxhp / 2), `${label} OFF: Kris lands on round(-maxhp / 2)`);
  eq(offKris.type, TYPE_DEAD, `${label} OFF: Kris's number is the DOWN graphic`);
  const offSusie = fell(build(false), 1, entry);
  eq(offSusie.hp, -999, `${label} OFF: Susie still lands on -999`);
  eq(offSusie.type, TYPE_SWOON, `${label} OFF: Susie's number is the SWOON graphic`);

  // ON — the mod. The fork is gone; slot 0 is treated like everyone else.
  const onKris = fell(build(true), 0, entry);
  eq(onKris.hp, -999, `${label} ON: Kris lands on -999 — the mercy is gone`);
  eq(onKris.type, TYPE_SWOON, `${label} ON: Kris's number is the SWOON graphic`);
  const onSusie = fell(build(true), 1, entry);
  eq(onSusie.hp, -999, `${label} ON: Susie is unchanged`);
  eq(onSusie.type, TYPE_SWOON, `${label} ON: Susie's graphic is unchanged`);

  // The switch must move something. If OFF and ON agree on slot 0 the flag is
  // inert and every assertion above is passing on the default.
  if (offKris.hp === onKris.hp) {
    failures.push(`${label}: OFF and ON left Kris at the same HP (${onKris.hp}) — the flag did nothing`);
  }
}

// And it must not reach anything else: a hit that does NOT fell is identical
// on both sides.
{
  const off = build(false);
  const on = build(true);
  off.invTimer = -1; on.invTimer = -1;
  const a = scrDamageSingle(off, 30, 0, { aoe: true });
  const b = scrDamageSingle(on, 30, 0, { aoe: true });
  eq(a, b, 'a survivable hit deals the same damage either way');
  eq(off.partyHp[0], on.partyHp[0], 'a survivable hit leaves the same HP either way');
}

if (failures.length) {
  for (const f of failures) console.error(`  FAIL ${f}`);
  console.error(`verify-permanentfell: ${failures.length} assertion(s) failing`);
  process.exit(1);
}
console.log('verify-permanentfell: the fell fork, both entry points, both directions');
