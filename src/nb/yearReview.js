/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * The year in review: what a student sees when a game year ends. It compares the year's snapshot (the engine's
 * YEAR_ENDED event) with the one before, names what residents complain about most, and gives one line tying a
 * number that moved to a knob the chosen government turns. Every word comes from content/ui/strings.json; this
 * module only decides which words and fills in the numbers.
 */

import { Evaluation } from '../evaluation.js';
import { DEFAULT_TUNING } from '../tuning.js';
import { skillLabel } from './scenario.js';

export const TOP_PROBLEMS = 3;

const PROBLEM_KEYS = {
  [Evaluation.CRIME]: 'crime',
  [Evaluation.POLLUTION]: 'pollution',
  [Evaluation.HOUSING]: 'housing',
  [Evaluation.TAXES]: 'taxes',
  [Evaluation.TRAFFIC]: 'traffic',
  [Evaluation.UNEMPLOYMENT]: 'unemployment',
  [Evaluation.FIRE]: 'fire',
};

const STATS = ['population', 'score', 'approval', 'funds'];

// Crime averages wobble by a point or two from year to year; smaller moves than this read as "held steady".
const CRIME_STEADY = 3;

// The knobs a government turns, each with the stat a student can watch move and the complaints it speaks to. Order
// is the order candidates rotate in when this year's complaints don't point at one.
const KNOB_LINES = {
  taxYield: { problems: [Evaluation.TAXES], fill: taxFill },
  taxGrowthDrag: { problems: [Evaluation.TAXES, Evaluation.HOUSING, Evaluation.UNEMPLOYMENT], fill: populationFill },
  resDemand: { problems: [Evaluation.HOUSING], fill: populationFill },
  comDemand: { problems: [Evaluation.UNEMPLOYMENT], fill: populationFill },
  indDemand: { problems: [Evaluation.UNEMPLOYMENT], fill: populationFill },
  policeEffectiveness: { problems: [Evaluation.CRIME], fill: crimeFill },
  crimePressure: { problems: [Evaluation.CRIME], fill: crimeFill },
};


// previous: the last checkpoint (a snapshot, or the live numbers before the first one); snapshot: this year's.
// Returns null for a year nobody lived through: there is nothing to review yet.
export function yearReview({ previous, snapshot, scenario, poleId, strings }) {
  if (!snapshot.population)
    return null;

  const words = strings.year_review;
  const pole = scenario.governance_poles[poleId] || null;

  return {
    year: snapshot.year,
    title: fill(words.title, { year: snapshot.year }),
    stats: STATS.map(key => ({
      key,
      label: words.stats[key],
      value: snapshot[key],
      change: previous && Number.isFinite(previous[key]) ? snapshot[key] - previous[key] : null,
    })),
    problems: snapshot.problems.slice(0, TOP_PROBLEMS).map(p => words.problems[PROBLEM_KEYS[p]]),
    poleLine: pole ? poleLine({ previous, snapshot, pole, words }) : null,
    skillLabel: skillLabel(scenario, 'governance_dial'),
  };
}


// One line about the government: the knob behind this year's top complaint if the pole turns one, otherwise the
// pole's knobs in turn, a different one each year.
function poleLine({ previous, snapshot, pole, words }) {
  const tuning = pole.tuning || {};
  const candidates = Object.keys(KNOB_LINES)
    .filter(knob => knob in tuning && tuning[knob] !== DEFAULT_TUNING[knob])
    .map(knob => {
      const values = KNOB_LINES[knob].fill({ previous, snapshot, tuning, knob, words });
      const template = words.pole_lines[`${knob}_${tuning[knob] > DEFAULT_TUNING[knob] ? 'up' : 'down'}`];
      return values && template ? { knob, text: fill(template, { pole: pole.label, ...values }) } : null;
    })
    .filter(Boolean);

  if (candidates.length === 0)
    return null;

  const top = snapshot.problems[0];
  const pointed = candidates.find(c => KNOB_LINES[c.knob].problems.includes(top));
  return (pointed || candidates[snapshot.year % candidates.length]).text;
}


function taxFill({ snapshot, tuning }) {
  if (!(snapshot.taxesCollected > 0))
    return null;
  return {
    collected: money(snapshot.taxesCollected),
    standard: money(Math.round(snapshot.taxesCollected / tuning.taxYield)),
  };
}


function populationFill({ previous, snapshot, words }) {
  if (!previous || !Number.isFinite(previous.population))
    return null;
  return { trend: trendWord(snapshot.population - previous.population, 0, words) };
}


function crimeFill({ previous, snapshot, words }) {
  if (!previous || !Number.isFinite(previous.crimeAverage) || !Number.isFinite(snapshot.crimeAverage))
    return null;
  return { trend: trendWord(snapshot.crimeAverage - previous.crimeAverage, CRIME_STEADY, words) };
}


function trendWord(change, steady, words) {
  if (Math.abs(change) <= steady)
    return words.trend.steady;
  return change > 0 ? words.trend.up : words.trend.down;
}


function money(n) {
  return '$' + n.toLocaleString('en-US');
}


// "{name}" placeholders; an unknown name is left as written so a typo in the strings file shows up on screen.
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (whole, name) => (name in values ? String(values[name]) : whole));
}
