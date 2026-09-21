/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * How heavily the town is policed — the governance dial the buildconcept named as tier-1 and the one mechanic both
 * course desks have already written content for (civil liberties against security).
 *
 * BK's direction, 2026-09-20: "adjust police coverage to loose vs oppresive...civil liberties vs. individual
 * rights." The student sets it during play and can change it; unlike the founding choice, this one is meant to be
 * revisited, because the whole civic question is that the right answer moves.
 *
 * Every stance costs something. A light hand leaves crime to find its own level; a heavy hand buys quiet and
 * spends legitimacy for it. There is no setting that is simply correct, which is the point — and it is what makes
 * Sam's Individual Rights ladder able to fire at all, since it waits for a government that restricts liberties.
 */

export const STANCES = ['light', 'balanced', 'heavy'];
export const DEFAULT_STANCE = 'balanced';

// What each stance bends, in the same direction language leaders and decisions use.
export const STANCE_TUNING = Object.freeze({
  light: { policeEffectiveness: 'lower', crimePressure: 'higher' },
  balanced: {},
  heavy: { policeEffectiveness: 'higher', crimePressure: 'lower' },
});

// A heavy hand is resented, and the resentment is the mechanic: it feeds unrest through its own term, so the town
// can be quiet and angry at the same time — which is exactly the case the ladder is written about.
export const STANCE_PRESSURE = Object.freeze({ light: 0, balanced: 0, heavy: 18 });


export function isStance(value) {
  return STANCES.includes(value);
}


export function stanceTuning(stance) {
  return STANCE_TUNING[isStance(stance) ? stance : DEFAULT_STANCE];
}


export function stancePressure(stance) {
  return STANCE_PRESSURE[isStance(stance) ? stance : DEFAULT_STANCE];
}


// A town policed this heavily is a town whose government is restricting liberties, whoever is in office. This is
// the hook Sam's Individual Rights ladder waits on, and it is why the ladder could not fire before.
export function restrictsLiberties(stance) {
  return stance === 'heavy';
}
