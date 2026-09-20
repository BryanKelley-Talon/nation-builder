/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

import { readFileSync } from 'node:fs';

import { Evaluation } from '../../src/evaluation.js';
import * as Messages from '../../src/messages.ts';
import { validateScenario } from '../../src/nb/scenario.js';
import { classRank, everyYears, fill, reviewReason, yearReview } from '../../src/nb/yearReview.js';
import { DEFAULT_TUNING } from '../../src/tuning.js';
import { makeSim, runTicks, runYears, starterTown } from '../sim/harness.js';

const strings = JSON.parse(readFileSync(new URL('../../content/ui/strings.json', import.meta.url)));
const fixture = validateScenario(
  JSON.parse(readFileSync(new URL('../../content/scenarios/dev-fixture-us11r.json', import.meta.url))));

// A scenario whose one pole turns exactly the knobs given.
function scenarioWith(tuning) {
  return { ...fixture, governance_poles: { hobbes: null, locke: { label: 'Pole L', summary: '', content_ref: 'x', tuning } } };
}

const PREVIOUS = { year: 1800, population: 400, score: 500, approval: 50, funds: 9000, crimeAverage: 40,
                   cityClass: 'VILLAGE' };
const SNAPSHOT = { year: 1805, population: 520, score: 540, approval: 47, funds: 9800, problems: [Evaluation.CRIME,
                   Evaluation.TAXES, Evaluation.TRAFFIC, Evaluation.FIRE], taxesCollected: 1200, crimeAverage: 60,
                   cityClass: 'VILLAGE' };

function review(tuning, overrides = {}) {
  return yearReview({ previous: PREVIOUS, snapshot: { ...SNAPSHOT, ...overrides }, scenario: scenarioWith(tuning),
                      poleId: 'locke', strings, highestClass: 'VILLAGE' });
}

describe('year in review', () => {
  it('shows each headline stat with its change since the last checkpoint', () => {
    const r = review({});
    expect(r.title).toBe('1801–1805 in review');
    expect(r.since).toBe('Change since 1800');
    expect(r.stats.map(s => [s.key, s.value, s.change])).toEqual([
      ['population', 520, 120], ['score', 540, 40], ['approval', 47, -3], ['funds', 9800, 800]]);
  });

  it('leaves changes out when there is nothing to compare with', () => {
    const r = yearReview({ previous: null, snapshot: SNAPSHOT, scenario: fixture, poleId: 'locke', strings });
    expect(r.stats.every(s => s.change === null)).toBe(true);
  });

  it('names the top three complaints in the students’ words', () => {
    expect(review({}).problems).toEqual(['Crime', 'Taxes', 'Traffic']);
  });

  it('is skipped for a year nobody lived through', () => {
    expect(review({}, { population: 0, problems: [] })).toBeNull();
  });

  it('names the year alone when only one has passed', () => {
    const r = yearReview({ previous: { ...PREVIOUS, year: 1804 }, snapshot: SNAPSHOT, scenario: fixture,
                           poleId: 'locke', strings });
    expect(r.title).toBe('1805 in review');
    expect(r.since).toBeNull();
  });

  it('says nothing about the government when it turns no knobs', () => {
    expect(review({}).poleLine).toBeNull();
  });

  it('ties the top complaint to the knob behind it', () => {
    const line = review({ taxYield: 0.8, policeEffectiveness: 0.8 }).poleLine;
    expect(line).toBe('Under Pole L, each police station stops less crime than in a standard town. Crime rose since 1800.');
  });

  it('shows what a standard town would have collected in taxes', () => {
    const line = review({ taxYield: 0.8 }, { problems: [Evaluation.TAXES] }).poleLine;
    expect(line).toContain('$1,200 this year');
    expect(line).toContain('about $1,500');
  });

  it('rotates through the government’s knobs when complaints don’t point at one', () => {
    const tuning = { taxYield: 1.2, resDemand: 40, indDemand: -40 };
    const lines = [1805, 1810, 1815].map(year => review(tuning, { year, problems: [Evaluation.TRAFFIC] }).poleLine);
    expect(new Set(lines).size).toBe(3);
    expect(lines.some(l => l.includes('fewer people want to build factories'))).toBe(true);
  });

  it('calls a small wobble in crime steady', () => {
    expect(review({ crimePressure: 10 }, { crimeAverage: 42 }).poleLine).toContain('Crime held steady since 1800.');
  });

  it('skips a line it has no numbers for', () => {
    expect(review({ taxYield: 1.2 }, { taxesCollected: 0 }).poleLine).toBeNull();
  });

  it('works for both dev-fixture poles', () => {
    for (const poleId of ['locke', 'rousseau'])
      expect(yearReview({ previous: PREVIOUS, snapshot: SNAPSHOT, scenario: fixture, poleId, strings }).poleLine)
        .toMatch(/^Under DEV Pole/);
  });
});

describe('when a year earns a panel', () => {
  const reason = (snapshot, previous = PREVIOUS, scenario = fixture, highestClass = 'VILLAGE') =>
    reviewReason({ previous, snapshot: { ...SNAPSHOT, ...snapshot }, scenario, highestClass });

  it('passes over an ordinary year', () => {
    expect(reason({ year: 1806 })).toBeNull();
    expect(reason({ year: 1809 })).toBeNull();
  });

  it('stops every fifth year', () => {
    expect(reason({ year: 1805 })).toBe('checkpoint');
    expect(reason({ year: 1810 })).toBe('checkpoint');
  });

  it('stops the first year anyone lives here, whatever year that is', () => {
    expect(reason({ year: 1792 }, null)).toBe('first');
    expect(reason({ year: 1792 }, { ...PREVIOUS, population: 0 })).toBe('first');
  });

  it('stops the year the town changes class', () => {
    expect(reason({ year: 1806, cityClass: 'TOWN' })).toBe('class');
  });

  it('stops once when the scenario reaches its last year', () => {
    expect(reason({ year: 2026 }, { ...PREVIOUS, year: 2025 })).toBe('end');
    expect(reason({ year: 2027 }, { ...PREVIOUS, year: 2026 })).toBeNull();
  });

  it('lets a scenario set its own pace', () => {
    const decade = { ...fixture, review_rules: { every_years: 10 } };
    expect(everyYears(decade)).toBe(10);
    expect(reason({ year: 1805 }, PREVIOUS, decade)).toBeNull();
    expect(reason({ year: 1810 }, PREVIOUS, decade)).toBe('checkpoint');
  });

  it('stops for a class the town has never held, not for one it slides back into', () => {
    expect(reason({ year: 1806, cityClass: 'CITY' }, PREVIOUS, fixture, 'TOWN')).toBe('class');
    expect(reason({ year: 1806, cityClass: 'TOWN' }, PREVIOUS, fixture, 'CITY')).toBeNull();
    expect(reason({ year: 1806, cityClass: 'CITY' }, PREVIOUS, fixture, 'CITY')).toBeNull();
  });

  it('falls back to five years when a scenario says nothing sensible', () => {
    expect(everyYears(fixture)).toBe(5);
    expect(everyYears({ review_rules: { every_years: 0 } })).toBe(5);
    expect(everyYears({ review_rules: { every_years: 2.5 } })).toBe(5);
  });

  it('names the milestone that stopped play', () => {
    const scenario = scenarioWith({});
    const classChange = yearReview({ previous: PREVIOUS, snapshot: { ...SNAPSHOT, year: 1806, cityClass: 'TOWN' },
                                     scenario, poleId: 'locke', strings, townName: 'Testville',
                                     highestClass: 'VILLAGE' });
    expect(classChange.milestone).toBe('Testville is now a town.');

    const plain = yearReview({ previous: PREVIOUS, snapshot: SNAPSHOT, scenario, poleId: 'locke', strings,
                               townName: 'Testville', highestClass: 'VILLAGE' });
    expect(plain.milestone).toBeNull();
  });
});

describe('year in review wording', () => {
  it('has a line for every knob a government can turn, in both directions', () => {
    const knobs = Object.keys(DEFAULT_TUNING).filter(k => k !== 'universalPower');
    for (const knob of knobs)
      for (const way of ['up', 'down'])
        expect(strings.year_review.pole_lines[`${knob}_${way}`], `${knob}_${way}`).toBeTruthy();
  });

  it('names every problem the engine reports', () => {
    for (let p = 0; p < 7; p++) {
      const snapshot = { ...SNAPSHOT, problems: [p] };
      const r = yearReview({ previous: PREVIOUS, snapshot, scenario: fixture, poleId: 'locke', strings });
      expect(r.problems[0], `problem ${p}`).toBeTruthy();
    }
  });

  it('says "this year" only when the panel covers one year', () => {
    const oneYear = yearReview({ previous: { ...PREVIOUS, year: 1804 }, snapshot: SNAPSHOT,
                                 scenario: scenarioWith({ policeEffectiveness: 0.8 }), poleId: 'locke', strings });
    expect(oneYear.poleLine).toContain('Crime rose this year.');
  });

  it('leaves an unknown placeholder visible rather than blank', () => {
    expect(fill('{year} and {typo}', { year: 1801 })).toBe('1801 and {typo}');
  });
});

describe('year in review from a running town', () => {
  // The rule the session follows: each panel compares against the last one shown, not against last year.
  function panels(world, years, scenario) {
    const snapshots = [];
    world.sim.addEventListener(Messages.YEAR_ENDED, s => snapshots.push(s));
    runYears(world.sim, years);
    runTicks(world.sim, 1);

    const shown = [];
    let previous = null;
    let highestClass = null;
    for (const snapshot of snapshots) {
      const r = yearReview({ previous, snapshot, scenario, poleId: 'locke', strings, townName: 'Testville',
                             highestClass });
      if (classRank(snapshot.cityClass) > classRank(highestClass))
        highestClass = snapshot.cityClass;
      if (r) {
        shown.push({ ...r, snapshot });
        previous = snapshot;
      }
    }
    return { shown, snapshots };
  }

  it('stops at milestones and five-year marks, not every year', () => {
    const scenario = scenarioWith({ taxYield: 0.8 });
    const world = makeSim(undefined, { simOptions: { startingYear: 1789, tuning: { taxYield: 0.8 } } });
    starterTown(world);
    const { shown, snapshots } = panels(world, 12, scenario);

    expect(snapshots.length).toBe(12);
    expect(shown.length).toBeGreaterThan(1);
    expect(shown.length).toBeLessThan(snapshots.length);

    for (const panel of shown) {
      const { reason, snapshot } = panel;
      if (reason === 'checkpoint')
        expect(snapshot.year % 5, `${snapshot.year} is not a five-year mark`).toBe(0);
      else
        expect(['first', 'class', 'end']).toContain(reason);
    }

    // The first panel is the first year anyone lives there, and every panel carries real numbers.
    expect(shown[0].reason).toBe('first');
    expect(shown[0].snapshot.population).toBeGreaterThan(0);
    expect(shown.every(p => p.stats.every(s => Number.isFinite(s.value)))).toBe(true);
    expect(shown.some(p => /collects less tax/.test(p.poleLine))).toBe(true);
  });

  it('measures each panel against the one before it, not against last year', () => {
    const scenario = scenarioWith({});
    const world = makeSim(undefined, { simOptions: { startingYear: 1789 } });
    starterTown(world);
    const { shown } = panels(world, 12, scenario);

    for (let i = 1; i < shown.length; i++) {
      const population = shown[i].stats.find(s => s.key === 'population');
      expect(population.change).toBe(shown[i].snapshot.population - shown[i - 1].snapshot.population);
    }
  });
});
