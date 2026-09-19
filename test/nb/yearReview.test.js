/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

import { readFileSync } from 'node:fs';

import { Evaluation } from '../../src/evaluation.js';
import * as Messages from '../../src/messages.ts';
import { validateScenario } from '../../src/nb/scenario.js';
import { fill, yearReview } from '../../src/nb/yearReview.js';
import { DEFAULT_TUNING } from '../../src/tuning.js';
import { makeSim, runTicks, runYears, starterTown } from '../sim/harness.js';

const strings = JSON.parse(readFileSync(new URL('../../content/ui/strings.json', import.meta.url)));
const fixture = validateScenario(
  JSON.parse(readFileSync(new URL('../../content/scenarios/dev-fixture-us11r.json', import.meta.url))));

// A scenario whose one pole turns exactly the knobs given.
function scenarioWith(tuning) {
  return { ...fixture, governance_poles: { hobbes: null, locke: { label: 'Pole L', summary: '', content_ref: 'x', tuning } } };
}

const PREVIOUS = { year: 1800, population: 400, score: 500, approval: 50, funds: 9000, crimeAverage: 40 };
const SNAPSHOT = { year: 1801, population: 520, score: 540, approval: 47, funds: 9800, problems: [Evaluation.CRIME,
                   Evaluation.TAXES, Evaluation.TRAFFIC, Evaluation.FIRE], taxesCollected: 1200, crimeAverage: 60 };

function review(tuning, overrides = {}) {
  return yearReview({ previous: PREVIOUS, snapshot: { ...SNAPSHOT, ...overrides }, scenario: scenarioWith(tuning),
                      poleId: 'locke', strings });
}

describe('year in review', () => {
  it('shows each headline stat with its change since the last checkpoint', () => {
    const r = review({});
    expect(r.title).toBe('1801 in review');
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

  it('says nothing about the government when it turns no knobs', () => {
    expect(review({}).poleLine).toBeNull();
  });

  it('ties the top complaint to the knob behind it', () => {
    const line = review({ taxYield: 0.8, policeEffectiveness: 0.8 }).poleLine;
    expect(line).toBe('Under Pole L, each police station stops less crime than in a standard town. Crime rose this year.');
  });

  it('shows what a standard town would have collected in taxes', () => {
    const line = review({ taxYield: 0.8 }, { problems: [Evaluation.TAXES] }).poleLine;
    expect(line).toContain('$1,200 this year');
    expect(line).toContain('about $1,500');
  });

  it('rotates through the government’s knobs when complaints don’t point at one', () => {
    const tuning = { taxYield: 1.2, resDemand: 40, indDemand: -40 };
    const lines = [1801, 1802, 1803].map(year => review(tuning, { year, problems: [Evaluation.TRAFFIC] }).poleLine);
    expect(new Set(lines).size).toBe(3);
    expect(lines.some(l => l.includes('fewer people want to build factories'))).toBe(true);
  });

  it('calls a small wobble in crime steady', () => {
    expect(review({ crimePressure: 10 }, { crimeAverage: 42 }).poleLine).toContain('Crime held steady');
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

  it('leaves an unknown placeholder visible rather than blank', () => {
    expect(fill('{year} and {typo}', { year: 1801 })).toBe('1801 and {typo}');
  });
});

describe('year in review from a running town', () => {
  it('reviews the engine’s own year-end snapshots', () => {
    const world = makeSim(undefined, { simOptions: { startingYear: 1789, tuning: { taxYield: 0.8 } } });
    starterTown(world);
    const snapshots = [];
    world.sim.addEventListener(Messages.YEAR_ENDED, s => snapshots.push(s));
    runYears(world.sim, 4);
    runTicks(world.sim, 1);

    const [previous, snapshot] = snapshots.slice(-2);
    expect(snapshot.population).toBeGreaterThan(0);
    expect(snapshot.taxesCollected).toBeGreaterThan(0);

    const r = yearReview({ previous, snapshot, scenario: scenarioWith({ taxYield: 0.8 }), poleId: 'locke', strings });
    expect(r.stats.find(s => s.key === 'population').change).toBe(snapshot.population - previous.population);
    expect(r.poleLine).toMatch(/collects less tax/);
  });
});
