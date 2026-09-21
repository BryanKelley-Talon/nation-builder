/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * One place where a town's tuning is composed, and one rule about how the layers stack:
 *
 *   the governance pole the student chose at founding  →  the leader currently in office  →  the era
 *
 * **A leader bends the founding choice; it never overrides it** (BK's ruling, 2026-09-20). That is the whole
 * reason this file exists rather than a spread operator at each call site. A pole sets absolute values; a leader
 * carries directions — "higher taxYield", "lower policeEffectiveness" — and a direction moves the pole's number by
 * one bounded step. Whatever the leader, the pole's choice is still legible in the result, which is what "bend"
 * means mechanically. Era rules apply last, because a scenario's own era_rules are the outermost statement about
 * what is possible in a given year.
 *
 * Both content desks made directional claims only ("higher/lower on named knobs") and explicitly declined to set
 * numbers, so the step sizes below are engineering defaults for a first wire-up, not content. A balance pass sets
 * the real ones (scope doc stage 4).
 */

import { DEFAULT_TUNING, makeTuning } from '../tuning.js';

// How far one "higher" or "lower" moves a knob. Multiplicative knobs move by a fraction of their own value;
// the demand offsets are already in valve units, so they move by a flat step.
export const BEND = Object.freeze({
  multiplier: 0.15,        // taxYield, taxGrowthDrag, policeEffectiveness
  demand: 30,              // resDemand, comDemand, indDemand (valve units)
  crimePressure: 15,       // flat, on the engine's own 0-255 crime scale
});

// A bend may never carry a multiplicative knob past these, so a pole's identity survives any run of leaders.
export const BEND_LIMITS = Object.freeze({ min: 0.4, max: 2.0 });

const MULTIPLIER_KNOBS = ['taxYield', 'taxGrowthDrag', 'policeEffectiveness'];
const DEMAND_KNOBS = ['resDemand', 'comDemand', 'indDemand'];

export const DIRECTIONS = Object.freeze(['higher', 'lower']);


function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


// One knob, one direction, one step. Returns the bent value.
export function bendKnob(knob, value, direction) {
  const sign = direction === 'higher' ? 1 : -1;

  if (MULTIPLIER_KNOBS.includes(knob))
    return clamp(Math.round(value * (1 + sign * BEND.multiplier) * 100) / 100, BEND_LIMITS.min, BEND_LIMITS.max);

  if (DEMAND_KNOBS.includes(knob))
    return value + sign * BEND.demand;

  if (knob === 'crimePressure')
    return value + sign * BEND.crimePressure;

  // universalPower and anything else a scenario adds later: a direction cannot express it, so leave it alone.
  return value;
}


// bends: { taxYield: 'higher', policeEffectiveness: 'lower', ... } — the shape both content desks deliver.
export function bendTuning(base, bends = {}) {
  const bent = { ...base };

  for (const [knob, direction] of Object.entries(bends)) {
    if (!(knob in DEFAULT_TUNING) || !DIRECTIONS.includes(direction))
      continue;
    bent[knob] = bendKnob(knob, bent[knob], direction);
  }

  return bent;
}


// The one composition point. pole: absolute values from the scenario's governance pole. leader: directions from
// whoever is in office. era: absolute values the era rules impose (universalPower today), applied last.
export function currentTuning({ pole = {}, leader = {}, era = {} } = {}) {
  const base = makeTuning(pole);
  const bent = bendTuning(base, leader);
  return makeTuning({ ...bent, ...era });
}
