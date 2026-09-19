/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// The engine seams the teaching layer attaches to: start year, funds, tuning, and the year-end event.

import { GameMap } from '../../src/gameMap.js';
import * as Messages from '../../src/messages.ts';
import { DEFAULT_TUNING, makeTuning } from '../../src/tuning.js';
import { makeSim, runTicks, runYears, starterTown } from './harness.js';

describe('start year and funds', () => {
  it('defaults to the engine’s own 1900 and $20,000', () => {
    const { sim } = makeSim();
    expect(sim.getDate().year).toBe(1900);
    expect(sim.budget.totalFunds).toBe(20000);
  });

  it('starts a city in the year and with the funds it is given', () => {
    const { sim } = makeSim(undefined, { simOptions: { startingYear: 1789, funds: 5000 } });
    expect(sim.getDate().year).toBe(1789);
    expect(sim.budget.totalFunds).toBe(5000);

    runYears(sim, 2);
    expect(sim.getDate().year).toBe(1791);
  });

  it('keeps its start year through a save and load', () => {
    const { sim } = makeSim(undefined, { simOptions: { startingYear: 1789 } });
    runYears(sim, 3);
    const saveData = {};
    sim.save(saveData);
    saveData.isSavedGame = true;

    const restored = makeSim(new GameMap(120, 100), { savedGame: saveData });
    expect(restored.sim.getDate().year).toBe(1792);
  });

  it('loads a save from before Nation Builder as a 1900 city', () => {
    const { sim } = makeSim();
    const saveData = {};
    sim.save(saveData);
    delete saveData._startingYear;
    delete saveData.tuning;

    const restored = makeSim(new GameMap(120, 100), { savedGame: saveData });
    expect(restored.sim.getDate().year).toBe(1900);
    expect(restored.sim.tuning).toEqual(DEFAULT_TUNING);
  });
});

describe('year-end event', () => {
  it('reports each year once, after the January evaluation', () => {
    const world = makeSim(undefined, { simOptions: { startingYear: 1789 } });
    starterTown(world);
    const years = [];
    world.sim.addEventListener(Messages.YEAR_ENDED, e => years.push(e));

    runYears(world.sim, 3);
    runTicks(world.sim, 1);

    expect(years.map(y => y.year)).toEqual([1789, 1790, 1791]);
    for (const y of years) {
      expect(Number.isFinite(y.score)).toBe(true);
      expect(Number.isFinite(y.approval)).toBe(true);
      expect(Array.isArray(y.problems)).toBe(true);
    }
  });
});

describe('tuning', () => {
  it('rejects unknown knobs and wrong types', () => {
    expect(() => makeTuning({ taxYeild: 2 })).toThrow(/Unknown/);
    expect(() => makeTuning({ taxYield: '2' })).toThrow(/number/);
    expect(() => makeTuning({ taxYield: NaN })).toThrow(/number/);
  });

  it('survives a save and load', () => {
    const { sim } = makeSim(undefined, { simOptions: { tuning: { taxYield: 1.5, universalPower: true } } });
    const saveData = {};
    sim.save(saveData);

    const restored = makeSim(new GameMap(120, 100), { savedGame: saveData });
    expect(restored.sim.tuning.taxYield).toBe(1.5);
    expect(restored.sim.tuning.universalPower).toBe(true);
  });

  it('scales the taxes collected', () => {
    const census = { policeStationPop: 0, fireStationPop: 0, roadTotal: 0, railTotal: 0, totalPop: 1200, landValueAverage: 120 };
    const plain = makeSim().sim.budget;
    const doubled = makeSim().sim.budget;

    plain.collectTax(0, census, makeTuning());
    doubled.collectTax(0, census, makeTuning({ taxYield: 2 }));

    expect(doubled.taxFund).toBe(plain.taxFund * 2);
  });

  it('grows an unwired town when power is universal', () => {
    const unpowered = makeSim();
    starterTown(unpowered, { power: false });
    runYears(unpowered.sim, 3);

    const preElectric = makeSim(undefined, { simOptions: { tuning: { universalPower: true } } });
    starterTown(preElectric, { power: false });
    runYears(preElectric.sim, 3);

    expect(unpowered.sim._census.resPop).toBe(0);
    expect(preElectric.sim._census.poweredZoneCount).toBeGreaterThan(0);
    expect(preElectric.sim._census.resPop).toBeGreaterThan(0);
  });

  it('makes police less effective when told to', () => {
    function crimeWith(policeEffectiveness) {
      const world = makeSim(undefined, { simOptions: { tuning: { policeEffectiveness } } });
      starterTown(world, { police: true });
      runYears(world.sim, 4);
      return world.sim._census.crimeAverage;
    }

    expect(crimeWith(0)).toBeGreaterThan(crimeWith(1));
  });
});
