/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * Scenario questions: learning that arrives on a schedule, not only out of a crisis.
 *
 * BK's ruling, 2026-09-21: the advisor's clue ladders and decision cards are emergent — a student hears them only
 * when the town gets into trouble — so some of the teaching has to be scheduled. This is the first scheduled piece.
 * It is separate from the advisor system on purpose: it does not read unrest to decide when to speak, it stops play
 * until it is resolved, and it resolves in one of two ways.
 *
 *   choice   — a real mastery gate. A wrong answer brings the next hint, the hints climb toward the answer without
 *              saying it, and the gate lifts only on the right answer. There is no way past it but through it.
 *   written  — no answer a machine could check, so the gate is a sequence rather than a proof: write an attempt (the
 *              model stays locked until you do, the Arena's rule), read the model, then tick which parts of a strong
 *              answer your own attempt had. The ticks are the practice, not a score; the gate lifts whatever they say.
 *
 * Help is never free (the 2026-09-18 consolidated memo's costed hints): every hint a student uses takes something off
 * what resolving the question gives the town. There is no equilibrium score in this build for a hint to be charged
 * against, so the cost is in the fiction instead, which the memo allows — and the memo is explicit that hints used
 * are a felt cost, not a tracked metric, so the count is never saved and never reaches the save code.
 *
 * Nothing a student writes is kept anywhere: attempt text lives in the dialog's own state and goes when it closes.
 */

// Every five game years, first at year three: at medium speed a game year is roughly 40-60 seconds, so this is one
// question every four or five minutes of play and six to eight in a class period, offset from the year-in-review
// panel's own five-year beat so the two never stop the same year-end. A working default, not a ruling (see the
// 2026-09-21 build handoff); a scenario overrides either number with question_rules.
export const DEFAULT_EVERY_YEARS = 5;
export const DEFAULT_FIRST_AFTER_YEARS = 3;

// An attempt has to be a real swing before the model unlocks. The Arena asks for 40 characters against a 3-5 sentence
// rep; every written item here asks for one sentence.
export const MIN_ATTEMPT_CHARS = 20;

// What resolving a question gives the town, before hints, and what each hint takes back. Engineering defaults for a
// first pass, not a balance pass: small on purpose, so a scheduled question nudges the town and never steers it.
export const RELIEF_UNREST = 6;
export const HINT_COST_UNREST = 2;

export const TYPES = ['choice', 'written'];


function fail(where, message) {
  throw new Error(`Question bank ${where}: ${message}`);
}


// Check a course's question bank and return it. Throws on the first problem found.
export function validateQuestionBank(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items))
    throw new Error('Question bank must be a JSON object with an items list');

  const where = raw.course || '(no course)';
  const seen = new Set();

  for (const item of raw.items) {
    const at = `${where}:${item && item.id}`;
    if (!item || typeof item.id !== 'string' || item.id === '')
      fail(where, 'every item needs an id');
    if (seen.has(item.id))
      fail(where, `duplicate id "${item.id}"`);
    seen.add(item.id);

    if (!TYPES.includes(item.type))
      fail(at, `type must be one of ${TYPES.join(', ')}`);
    if (typeof item.prompt !== 'string' || item.prompt.trim() === '')
      fail(at, 'prompt is required');
    if (!Array.isArray(item.hints) || item.hints.length === 0 || item.hints.some(h => typeof h !== 'string' || !h))
      fail(at, 'hints must be a list of lines');

    if (item.type === 'choice') {
      const ids = (item.options || []).map(option => option && option.id);
      if (ids.length < 2 || ids.some(id => typeof id !== 'string'))
        fail(at, 'a choice item needs at least two options, each with an id');
      if (!ids.includes(item.correct))
        fail(at, `correct "${item.correct}" is not one of its options`);
    }

    if (item.type === 'written') {
      if (typeof item.exemplar !== 'string' || item.exemplar.trim() === '')
        fail(at, 'a written item needs an exemplar');
      if (!Array.isArray(item.checklist) || item.checklist.length === 0)
        fail(at, 'a written item needs a checklist');
    }
  }

  return raw;
}


// The beat, from a scenario's own question_rules or the defaults.
export function questionRules(scenario) {
  const rules = (scenario && scenario.question_rules) || {};
  const positive = n => Number.isInteger(n) && n > 0;
  return {
    everyYears: positive(rules.every_years) ? rules.every_years : DEFAULT_EVERY_YEARS,
    firstAfterYears: Number.isInteger(rules.first_after_years) && rules.first_after_years >= 0
      ? rules.first_after_years : DEFAULT_FIRST_AFTER_YEARS,
  };
}


// Is a question due at this year-end? Independent of unrest by design: the schedule is the point. `state.lastYear`
// is the year the last question was asked; a question that had to wait (see session.js) simply asks a year late, and
// the beat runs from there.
export function isDue({ rules, state = {}, year, startYear }) {
  if (Number.isInteger(state.lastYear))
    return year - state.lastYear >= rules.everyYears;
  return year - startYear >= rules.firstAfterYears;
}


// The next item, in bank order, cycling once the bank runs out. The bank is append-only for the same reason the
// scenario index is: a saved town remembers its place by position.
export function nextItem(bank, state = {}) {
  const items = (bank && bank.items) || [];
  if (items.length === 0)
    return null;
  const index = Number.isInteger(state.next) && state.next >= 0 ? state.next % items.length : 0;
  return { item: items[index], index };
}


// The state after asking the item at `index` in `year`.
export function asked(state = {}, index, year) {
  return { ...state, next: index + 1, lastYear: year };
}


// A choice: right or wrong, and — when wrong — which hint the student sees now. Hints climb one per wrong answer and
// stop at the last one; they never state the answer, which is the content desks' rule and a test's.
export function answerChoice(item, optionId, hintsShown = 0) {
  if (optionId === item.correct)
    return { correct: true, hintsShown };
  return { correct: false, hintsShown: Math.min(hintsShown + 1, item.hints.length) };
}


export function attemptIsReal(text) {
  return typeof text === 'string' && text.trim().length >= MIN_ATTEMPT_CHARS;
}


// What resolving gives the town. The bank names the consequence (on_resolve); hints take relief back, floored at none.
// The tuning bend is kept whatever the hints: the student did resolve it, and a bend is one bounded step.
export function consequence(bank, { hintsUsed = 0 } = {}) {
  const onResolve = (bank && bank.on_resolve) || {};
  const relief = Number.isFinite(onResolve.unrest_relief) ? onResolve.unrest_relief : RELIEF_UNREST;
  const perHint = Number.isFinite(onResolve.hint_cost) ? onResolve.hint_cost : HINT_COST_UNREST;
  return {
    unrest: -Math.max(0, relief - perHint * hintsUsed),
    tuning: onResolve.tuning || {},
  };
}


// The gate itself, as a reducer, so the rules above are the same in the dialog and in the tests.
//
//   choose(optionId)  choice only: right resolves; wrong rules that option out and brings the next hint.
//   hint()            written only: the student asks. It costs the same as a hint a wrong answer brings.
//   write(text)       written only, until the model is revealed; after that the attempt is read-only.
//   reveal()          written only: needs a real attempt first.
//   check(index)      written only, after reveal: tick or untick one part of the checklist.
//   finish()          written only, after reveal: lifts the gate whatever is ticked.
export function startGate(item) {
  return { itemId: item.id, type: item.type, hintsShown: 0, tried: [], attempt: '', revealed: false,
           checked: item.type === 'written' ? item.checklist.map(() => false) : [], resolved: false };
}


export function gateReducer(item, state, action) {
  if (state.resolved)
    return state;

  if (item.type === 'choice') {
    if (action.type !== 'choose' || state.tried.includes(action.optionId))
      return state;
    const result = answerChoice(item, action.optionId, state.hintsShown);
    return result.correct
      ? { ...state, resolved: true }
      : { ...state, hintsShown: result.hintsShown, tried: [...state.tried, action.optionId] };
  }

  switch (action.type) {
    case 'hint':
      return { ...state, hintsShown: Math.min(state.hintsShown + 1, item.hints.length) };
    case 'write':
      return state.revealed ? state : { ...state, attempt: String(action.text || '') };
    case 'reveal':
      return attemptIsReal(state.attempt) ? { ...state, revealed: true } : state;
    case 'check':
      return state.revealed
        ? { ...state, checked: state.checked.map((on, i) => i === action.index ? !on : on) }
        : state;
    case 'finish':
      return state.revealed ? { ...state, resolved: true } : state;
    default:
      return state;
  }
}
