/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * How close the town is to changing its own government, and — just as important for both courses' content — which
 * pressure is driving it.
 *
 * Both desks' advisor material is keyed to the dominant term, not to the total: Will's issue-flavoured ladders
 * (Global, Enduring Issues) and Sam's crisis-type ladders (US11R, Civic Principles) both ask "which input is
 * dominant when the threshold fires" and pick their language from that. So this returns the terms, not just a
 * number, and the number itself is never shown to a student (Will's §10 Q3: a visible meter turns a reading skill
 * into a stat to min-max).
 *
 * The formula is the scope document's, smoothed so one bad winter never topples a government. Weights are
 * engineering defaults; a scenario may set its own with unrest_rules.
 */

export const DEFAULT_WEIGHTS = Object.freeze({
  approval: 0.45,        // (100 - approval): a government that has stopped answering
  crime: 0.25,           // crimeAverage, on the engine's 0-255 scale, as a percentage
  tax: 0.15,             // tax above what a town takes quietly
  unemployment: 0.15,    // the engine's own unemployment pressure, 0-255, as a percentage
  militarism: 0.20,      // the one term that is not a metric: the leader's own disposition, while unrest rises
  liberties: 0.30,       // what a heavy hand on the town costs, whoever is in office
  legitimacy: 0.20,      // subtracted: a city score above 500 is legitimacy the leader has earned
});

// The tax rate a town pays without complaint. Above this, each point is pressure.
export const COMFORTABLE_TAX = 7;
export const TAX_PRESSURE_PER_POINT = 6;

// How much of last year's unrest carries into this year's.
export const SMOOTHING = 0.7;

export const MAX_UNREST = 100;


function percentOf255(value) {
  return Math.min(100, Math.max(0, (value / 255) * 100));
}


// snapshot: the engine's year-end event. militarism: the sitting leader's disposition, 0-1, or 0 if none.
// Returns every term's contribution, so the caller can ask which one is doing the work.
export function unrestTerms(snapshot, { militarism = 0, rising = false, libertiesPressure = 0,
                                        weights = DEFAULT_WEIGHTS } = {}) {
  const approvalGap = Math.max(0, 100 - (snapshot.approval ?? 50));
  const crime = percentOf255(snapshot.crimeAverage ?? 0);
  const taxPressure = Math.max(0, (snapshot.taxRate ?? 0) - COMFORTABLE_TAX) * TAX_PRESSURE_PER_POINT;
  const unemployment = percentOf255(snapshot.unemployment ?? 0);

  return {
    approval: weights.approval * approvalGap,
    crime: weights.crime * crime,
    tax: weights.tax * Math.min(100, taxPressure),
    unemployment: weights.unemployment * unemployment,
    // A war-leaning leader is only a pressure while the town is already unsettled: Sam's Checks and Balances
    // ladder is "a war-leaning leader who starts concentrating power under cover of a crisis".
    militarism: rising ? weights.militarism * militarism * 100 : 0,
    liberties: weights.liberties * libertiesPressure,
  };
}


export function dominantTerm(terms) {
  return Object.entries(terms).reduce((best, entry) => (entry[1] > best[1] ? entry : best), ['approval', -Infinity])[0];
}


// The running value. previous is last year's unrest (0 the first time).
export function nextUnrest({ snapshot, previous = 0, militarism = 0, libertiesPressure = 0,
                             weights = DEFAULT_WEIGHTS }) {
  // "Rising" is judged on the raw reading before smoothing, so a leader's disposition starts counting the year
  // the town turns, not a year later.
  const dry = unrestTerms(snapshot, { militarism, rising: false, libertiesPressure, weights });
  const rawWithoutMilitarism = Object.values(dry).reduce((sum, n) => sum + n, 0);
  const legitimacy = weights.legitimacy * Math.max(0, ((snapshot.score ?? 500) - 500) / 5);
  const rising = rawWithoutMilitarism - legitimacy > previous;

  const terms = unrestTerms(snapshot, { militarism, rising, libertiesPressure, weights });
  const raw = Object.values(terms).reduce((sum, n) => sum + n, 0) - legitimacy;
  const value = Math.round(Math.min(MAX_UNREST, Math.max(0, SMOOTHING * previous + (1 - SMOOTHING) * raw)));

  return { value, raw: Math.round(raw), terms, dominant: dominantTerm(terms), rising, legitimacy };
}


// A scenario may set its own weights and thresholds; anything it leaves out keeps the default.
export function unrestWeights(scenario) {
  const given = (scenario && scenario.unrest_rules && scenario.unrest_rules.weights) || {};
  const weights = { ...DEFAULT_WEIGHTS };

  for (const [term, value] of Object.entries(given)) {
    if (term in DEFAULT_WEIGHTS && Number.isFinite(value) && value >= 0)
      weights[term] = value;
  }

  return weights;
}
