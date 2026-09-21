/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * The year in review: what a student sees when a game year ends. It compares this checkpoint's snapshot (the
 * engine's YEAR_ENDED event) with the last one shown, names what residents complain about most, and gives one line
 * tying a number that moved to a knob the chosen government turns. Every word comes from content/ui/strings.json;
 * this module only decides which words and fills in the numbers.
 *
 * Not every year gets one. A year that ends in a milestone does — the first year anyone lives here, the year the
 * town grows into a class it has never held, the scenario's last year — and otherwise every fifth year, so the
 * panel reads as a checkpoint rather than an interruption. A scenario may set its own pace with
 * review_rules.every_years.
 */

import { Evaluation } from '../evaluation.js';
import { DEFAULT_TUNING } from '../tuning.js';

export const TOP_PROBLEMS = 3;
export const DEFAULT_EVERY_YEARS = 5;

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

// Smallest to largest. A town at the edge of a class flips back and forth year after year, so only reaching a class
// for the first time is a milestone; sliding back is left to the numbers to show.
const CITY_CLASSES = [Evaluation.CC_VILLAGE, Evaluation.CC_TOWN, Evaluation.CC_CITY, Evaluation.CC_CAPITAL,
                      Evaluation.CC_METROPOLIS, Evaluation.CC_MEGALOPOLIS];

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


// How often a scenario stops for a checkpoint when nothing else has happened.
export function everyYears(scenario) {
  const years = scenario && scenario.review_rules && scenario.review_rules.every_years;
  return Number.isInteger(years) && years > 0 ? years : DEFAULT_EVERY_YEARS;
}


export function classRank(cityClass) {
  return CITY_CLASSES.indexOf(cityClass);
}


// Why this year earns a panel, or null for a year that passes without one. previous is the last snapshot shown, not
// last year's: between panels the years go by uninterrupted. highestClass is the largest the town has ever been.
export function reviewReason({ previous, snapshot, scenario, highestClass, government }) {
  if (!snapshot.population)
    return null;

  // A change of government always stops play: it is the one event a student cannot be left to infer.
  if (government)
    return 'government';

  if (!previous || !previous.population)
    return 'first';

  if (snapshot.cityClass && classRank(snapshot.cityClass) > classRank(highestClass))
    return 'class';

  if (snapshot.year >= scenario.end_year && previous.year < scenario.end_year)
    return 'end';

  return snapshot.year % everyYears(scenario) === 0 ? 'checkpoint' : null;
}


// previous: the last snapshot shown (or the checkpoint a resumed city came back with); snapshot: this year's.
// Returns null for a year that hasn't earned a panel.
export function yearReview({ previous, snapshot, scenario, poleId, strings, townName, highestClass, government }) {
  const reason = reviewReason({ previous, snapshot, scenario, highestClass, government });
  if (!reason)
    return null;

  const words = strings.year_review;
  const pole = scenario.governance_poles[poleId] || null;
  const from = previous && previous.year < snapshot.year ? previous.year : null;

  return {
    year: snapshot.year,
    reason,
    milestone: milestone({ reason, snapshot, townName, words }),
    // A change of government: what happened, why, and only then Will's ungraded Identify/Explain prompt.
    government: government || null,
    since: from !== null && snapshot.year - from > 1 ? fill(words.since, { year: from }) : null,
    title: from !== null && snapshot.year - from > 1
      ? fill(words.title_span, { from: from + 1, year: snapshot.year })
      : fill(words.title, { year: snapshot.year }),
    stats: STATS.map(key => ({
      key,
      label: words.stats[key],
      value: snapshot[key],
      change: previous && Number.isFinite(previous[key]) ? snapshot[key] - previous[key] : null,
    })),
    problems: snapshot.problems.slice(0, TOP_PROBLEMS).map(p => words.problems[PROBLEM_KEYS[p]]),
    poleLine: pole ? poleLine({ previous, snapshot, pole, words }) : null,
  };
}


// The thing that stopped play, when it wasn't just the five-year checkpoint coming round.
function milestone({ reason, snapshot, townName, words }) {
  if (reason === 'class' && words.city_classes[snapshot.cityClass])
    return fill(words.milestone_class, { town: townName, cityClass: words.city_classes[snapshot.cityClass] });

  if (reason === 'end')
    return fill(words.milestone_end, { year: snapshot.year });

  return null;
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
  return { trend: trendWord(snapshot.population - previous.population, 0, words), span: span(previous, snapshot, words) };
}


function crimeFill({ previous, snapshot, words }) {
  if (!previous || !Number.isFinite(previous.crimeAverage) || !Number.isFinite(snapshot.crimeAverage))
    return null;
  return {
    trend: trendWord(snapshot.crimeAverage - previous.crimeAverage, CRIME_STEADY, words),
    span: span(previous, snapshot, words),
  };
}


// A panel can cover one year or the whole stretch since the last one, so a trend says which.
function span(previous, snapshot, words) {
  return snapshot.year - previous.year > 1 ? fill(words.span.since, { year: previous.year }) : words.span.year;
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
