/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * What the advisor says while pressure builds, and what the game says when the government actually changes.
 *
 * The ladders are the two desks' own content (content/leadership/*.json), selected by the dominant unrest term —
 * the hook both of them wrote against. The shape is theirs too: subtle first, escalate only if the player lets it
 * keep climbing, near the tip at the third rung and never naming the Enduring Issue or Civic Principle out loud.
 * Supplying the word is the student's job; an advisor who names it has done their homework for them.
 *
 * The change-of-government copy is different in kind, and marked as such in the strings file: BK's ruling that an
 * event a student would not understand cold must be explained in plain language means the panel says what happened
 * and why, in the advisor's register, before it asks Will's Identify/Explain question.
 */

import { fill } from './yearReview.js';

export const TIERS = 3;

// A ladder climbs only while the same pressure keeps leading, and only so often.
export const DEFAULT_CLUE_GAP_YEARS = 2;


export function laddersFor(layer) {
  return (layer && Array.isArray(layer.ladders)) ? layer.ladders : [];
}


// Which ladder speaks for this year's pressure. A ladder may name more than one term, and may carry a `when`
// clause that has to hold as well — that is how Global's Nationalism ladder waits for a revolutionary candidate
// pool, and how US11R's Due Process ladder waits for the leader's own conduct to be the cause.
export function selectLadder({ layer, dominant, leader, unrestValue = 0 }) {
  const candidates = laddersFor(layer).filter(ladder => (ladder.for || []).includes(dominant));
  const disposition = (leader && leader.disposition) || {};

  const matches = candidates.filter(ladder => {
    const when = ladder.when;
    if (!when)
      return true;

    if (when.overthrow_candidate)
      return ((leader && leader.on_overthrow) || []).includes(when.overthrow_candidate);

    // Crime the leader's own conduct causes, rather than crime they failed to control.
    if (when.leader_conduct)
      return (disposition.militarism || 0) >= 0.5;

    if (when.disposition && when.disposition.liberties)
      return disposition.liberties === when.disposition.liberties;

    return false;
  });

  // A ladder with a `when` clause is the more specific reading of the same pressure, so it wins when it holds.
  // One with no lines yet (a distinction named but not written) falls back to its plainer sibling.
  const specific = matches.filter(ladder => ladder.when && (ladder.tiers || []).length > 0);
  const plain = matches.filter(ladder => !ladder.when && (ladder.tiers || []).length > 0);
  return specific[0] || plain[0] || null;
}


// The advisor's line for this year, or null for a quiet year. State is carried by the caller and saved with the
// town, so a ladder does not restart every time a student reopens their city.
export function nextClue({ layer, dominant, leader, unrestValue, year, state = {}, gapYears = DEFAULT_CLUE_GAP_YEARS }) {
  const ladder = selectLadder({ layer, dominant, leader, unrestValue });
  if (!ladder)
    return null;

  const sameLadder = state.key === ladder.key;
  const rung = sameLadder ? Math.min(state.rung || 0, TIERS - 1) : 0;
  const spokenAt = state.year;

  if (spokenAt !== undefined && year - spokenAt < gapYears)
    return null;

  // The ladder only climbs if the player let the same pressure keep leading; a new pressure starts at the bottom.
  const nextRung = sameLadder ? Math.min(rung + 1, TIERS - 1) : 0;
  const line = (ladder.tiers || [])[nextRung];
  if (!line)
    return null;

  return {
    key: ladder.key,
    rung: nextRung,
    line,
    dominant,
    // The advisor asks; the card cannot leave the screen until one of these is chosen.
    choices: (ladder.choices || []).map(choice => ({ id: choice.id, label: choice.label, cost: choice.cost || 0 })),
    state: { key: ladder.key, rung: nextRung, year },
  };
}


// The quieter of the two events: a vignette in the town's paper.
export function successionVignette({ strings, townName, year, event, outgoing, incoming }) {
  const words = strings.leadership;
  const news = strings.news;

  return {
    key: `leadership:${event}`,
    masthead: fill(news.masthead, { town: townName }),
    dateline: String(year),
    headline: fill(event === 'overthrow' ? words.overthrow_headline : words.succession_headline, { town: townName }),
    counsel: fill(words.took_office, { label: incoming.label }) + ' ' + incoming.summary,
    byline: news.byline,
    mechanic: 'governance_dial',
  };
}


// The weightier one: the year-in-review panel stops play, says plainly what happened and why, and only then asks
// the student to name it themselves.
function years(count) {
  const n = Math.max(1, Math.round(count));
  return `${n} year${n === 1 ? '' : 's'}`;
}


export function changeOfGovernment({ strings, event, outgoing, incoming, year, since, sustainedYears, dominant, layer }) {
  const words = strings.leadership;
  const driver = words.drivers[dominant] || words.drivers.approval;

  const explain = event === 'overthrow'
    ? fill(words.explain.overthrow, { incoming: incoming.label, outgoing: outgoing.label,
                                      years: years(sustainedYears), driver })
    : fill(words.explain.succession, { incoming: incoming.label, outgoing: outgoing.label,
                                       years: years(year - since) });

  return {
    event,
    title: words.panel_title,
    headline: fill(event === 'overthrow' ? words.overthrow_headline : words.succession_headline, { town: '' }).trim(),
    explain,
    took_office: fill(words.took_office, { label: incoming.label }),
    summary: incoming.summary,
    debriefHeading: words.debrief_heading,
    // Will's ungraded self-check, unchanged and unscored — asked after the explanation, never instead of it.
    prompt: (layer && layer.debrief && layer.debrief.prompt) || '',
    dismiss: words.dismiss,
  };
}
