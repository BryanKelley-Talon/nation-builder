/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * Who governs the town, and how that changes.
 *
 * One architecture serves both courses (BK's ruling, 2026-09-20, as translated in Josh's work order): every
 * playthrough starts with a `founder` and moves to new leadership only through the succession and overthrow
 * triggers below. What differs between courses is the content layer the scenario points at — Global's five
 * archetypes (founder, heir, reformer, strongman, revolutionary council) or US11R's two persistent
 * government-tendency identities that succeed and overthrow each other, wearing era-appropriate words as the
 * clock advances. The engine cannot tell the difference, which is the point of doing it this way.
 *
 * A leader bends the founding choice and never replaces it — see governance.js, where that is mechanical.
 *
 * Nothing here decides what the advisor says: the ladders live in the content layer and are selected by the
 * dominant unrest term (unrest.js), the same hook both desks wrote their material against.
 */

export const DEFAULT_TENURE_YEARS = Object.freeze([18, 34]);
export const DEFAULT_OVERTHROW_AT = 60;   // measured against real runs; see the content layers' note
export const DEFAULT_SUSTAINED_YEARS = 3;

export const EVENT_SUCCESSION = 'succession';
export const EVENT_OVERTHROW = 'overthrow';


// The rules a scenario's leadership block sets, with defaults for anything it leaves out.
export function leadershipRules(layer = {}) {
  const tenure = Array.isArray(layer.tenure_years) && layer.tenure_years.length === 2
    ? layer.tenure_years
    : DEFAULT_TENURE_YEARS;
  const unrest = layer.unrest || {};

  return {
    startsWith: layer.starts_with || 'founder',
    succession: layer.succession === 'none' ? 'none' : 'tenure',
    tenureYears: tenure,
    overthrowAt: Number.isFinite(unrest.overthrow_at) ? unrest.overthrow_at : DEFAULT_OVERTHROW_AT,
    sustainedYears: Number.isInteger(unrest.sustained_years) ? unrest.sustained_years : DEFAULT_SUSTAINED_YEARS,
    leaders: Array.isArray(layer.leaders) ? layer.leaders : [],
  };
}


export function leaderById(rules, id) {
  return rules.leaders.find(leader => leader.id === id) || null;
}


// US11R's archetypes keep one id and change their words as the clock advances: Sam's four era pairs are the same
// two tendencies speaking in the language of their era. A leader with no `by_era` simply reads its own label.
export function leaderVoice(leader, year) {
  if (!leader)
    return { label: '', summary: '' };

  const era = (leader.by_era || []).find(entry => year >= entry.from && (entry.to === undefined || year <= entry.to));
  return {
    label: (era && era.label) || leader.label || '',
    summary: (era && era.summary) || leader.summary || '',
    era: era ? era.id || null : null,
  };
}


// Tenure is rolled per leader, so two playthroughs of the same scenario do not change government in the same year.
export function rollTenure(rules, year, random = Math.random) {
  const [min, max] = rules.tenureYears;
  return year + min + Math.floor(random() * (max - min + 1));
}


// Who takes over. Candidates come from the sitting leader's own pools; the dominant unrest term and the outgoing
// leader's disposition decide between them, which is how Global's strongman-or-council fork works.
export function chooseSuccessor(rules, leader, { event, dominant, random = Math.random }) {
  const pool = (event === EVENT_OVERTHROW ? leader.on_overthrow : leader.succeeds_to) || [];
  const candidates = pool.map(id => leaderById(rules, id)).filter(Boolean);

  if (candidates.length === 0)
    return null;

  if (candidates.length === 1)
    return candidates[0];

  const scored = candidates.map(candidate => {
    const disposition = candidate.disposition || {};
    let score = 0;

    // An overthrow driven by policing or a war-leaning government tends to install the harder answer; one driven
    // by consent or the cost of the bargain tends toward the reforming answer. Both desks wrote their archetypes
    // around this fork (Will's §4 "arises from" column; Sam's Axis A pairs).
    if (event === EVENT_OVERTHROW) {
      if (dominant === 'crime' || dominant === 'militarism')
        score += (disposition.militarism || 0) * 2;
      else
        score += (disposition.reform || 0) * 2;
    } else {
      score += (disposition.reform || 0);
    }

    return { candidate, score };
  });

  const best = Math.max(...scored.map(entry => entry.score));
  const tied = scored.filter(entry => entry.score === best).map(entry => entry.candidate);
  return tied[Math.floor(random() * tied.length)];
}


// The state a save carries.
export function startingState(rules, year, random = Math.random) {
  return {
    leader: rules.startsWith,
    since: year,
    tenureEnds: rules.succession === 'none' ? null : rollTenure(rules, year, random),
    unrest: 0,
    sustained: 0,
    history: [],
  };
}


// One year-end. Returns the state that follows and the event, if any. Overthrow outranks a scheduled succession in
// the same year: a government that falls does not also retire.
export function advance({ rules, state, year, unrest, dominant, random = Math.random }) {
  const leader = leaderById(rules, state.leader);
  const sustained = unrest >= rules.overthrowAt ? state.sustained + 1 : 0;
  const next = { ...state, unrest, sustained };

  if (!leader)
    return { state: next, event: null };

  const overthrown = sustained >= rules.sustainedYears;
  const retired = !overthrown && state.tenureEnds !== null && year >= state.tenureEnds;

  if (!overthrown && !retired)
    return { state: next, event: null };

  const event = overthrown ? EVENT_OVERTHROW : EVENT_SUCCESSION;
  const successor = chooseSuccessor(rules, leader, { event, dominant, random });
  if (!successor)
    return { state: next, event: null };

  return {
    state: {
      ...next,
      leader: successor.id,
      since: year,
      tenureEnds: rules.succession === 'none' ? null : rollTenure(rules, year, random),
      // A new government starts with the town's mood, not with a clean sheet — but the count toward the next
      // overthrow restarts, or a fallen government would take its successor down with it the same year.
      sustained: 0,
      history: [...state.history, { leader: state.leader, from: state.since, to: year, ended: event }],
    },
    event,
    from: leader,
    to: successor,
    dominant,
  };
}


// What a save carries, and what it reads back. An older save with no leadership block starts the scenario's own
// first leader, which is what makes this additive rather than a format change.
export function toSave(state) {
  return state ? { leader: state.leader, since: state.since, tenure_ends: state.tenureEnds,
                   unrest: state.unrest, sustained: state.sustained, history: state.history } : null;
}


export function fromSave(saved, rules, year, random = Math.random) {
  if (!saved || !saved.leader || !leaderById(rules, saved.leader))
    return startingState(rules, year, random);

  return {
    leader: saved.leader,
    since: Number.isFinite(saved.since) ? saved.since : year,
    tenureEnds: saved.tenure_ends === null || Number.isFinite(saved.tenure_ends)
      ? saved.tenure_ends
      : rollTenure(rules, year, random),
    unrest: Number.isFinite(saved.unrest) ? saved.unrest : 0,
    sustained: Number.isInteger(saved.sustained) ? saved.sustained : 0,
    history: Array.isArray(saved.history) ? saved.history : [],
  };
}


// The save code carries the leader as a small integer: the index in the layer's own leaders array, which is
// append-only for exactly this reason (a reorder would rewrite the meaning of codes already on worksheets).
export function leaderIndex(rules, id) {
  const index = rules.leaders.findIndex(leader => leader.id === id);
  return index < 0 ? 0 : index;
}


export function leaderAt(rules, index) {
  const leader = rules.leaders[index];
  return leader ? leader.id : rules.startsWith;
}
