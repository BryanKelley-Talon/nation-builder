/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * The advisor asks; the student answers; the town's numbers move.
 *
 * This is the buildconcept's conflicting-counsel mechanic (skill line DU), the half of the advisor that was
 * deferred out of the first playable slice. BK's direction, 2026-09-20: an advisor card has to be answered before
 * it goes away, and the answer has to drive the metrics — otherwise it is a notification, not a decision.
 *
 * Two rules keep it honest. **Neither option is the right one**: one usually costs money or power, the other
 * usually costs patience, and both are defensible — a card with an obvious answer teaches nothing. And **every
 * effect is bounded**, the same discipline as a leader's bend, so no run of decisions can carry the town's tuning
 * somewhere the founding choice is no longer audible.
 *
 * The decisions themselves ride home in the eight bits the save code has reserved for them since the format was
 * written, most recent first.
 */

import { bendTuning } from './governance.js';

export const DECISION_BITS = 8;

// A decision may move unrest this far, and no further, whatever the content asks for.
export const MAX_UNREST_EFFECT = 20;
export const MAX_TAX_EFFECT = 3;


export function choicesFor(ladder) {
  return (ladder && Array.isArray(ladder.choices)) ? ladder.choices : [];
}


export function findChoice(ladder, id) {
  return choicesFor(ladder).find(choice => choice.id === id) || null;
}


function clamp(value, limit) {
  return Math.max(-limit, Math.min(limit, value));
}


// What a choice does, resolved against what the town can actually afford. A town that cannot pay still gets the
// decision — it simply gets the version of it that costs nothing, which is its own lesson.
export function resolve({ choice, funds = 0, tuning = {}, militarism = 0 }) {
  const effect = (choice && choice.effect) || {};
  const affordable = (choice.cost || 0) <= funds;

  return {
    id: choice.id,
    paid: affordable ? (choice.cost || 0) : 0,
    shortOfFunds: !affordable && (choice.cost || 0) > 0,
    unrest: affordable ? clamp(effect.unrest || 0, MAX_UNREST_EFFECT) : Math.abs(clamp(effect.unrest || 0, MAX_UNREST_EFFECT)) / 2,
    tax: affordable ? clamp(effect.tax || 0, MAX_TAX_EFFECT) : 0,
    militarism: affordable ? Math.max(-1, Math.min(1, militarism + (effect.militarism || 0))) : militarism,
    tuning: affordable ? bendTuning(tuning, effect.tuning || {}) : tuning,
    aftermath: choice.aftermath || '',
  };
}


// The eight reserved bits: one per decision, most recent first, 1 when the student spent something to act.
export function recordDecision(bits, choice) {
  const acted = (choice.cost || 0) > 0 || ((choice.effect || {}).unrest || 0) < 0 ? 1 : 0;
  return ((bits << 1) | acted) & ((1 << DECISION_BITS) - 1);
}


export function decisionsTaken(bits) {
  let count = 0;
  for (let i = 0; i < DECISION_BITS; i++)
    count += (bits >> i) & 1;
  return count;
}
