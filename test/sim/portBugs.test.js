/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Regression tests for the micropolisJS port bugs fixed in Nation Builder (spike report section 3).

import { BaseTool } from '../../src/baseTool.js';
import { BlockMapUtils } from '../../src/blockMapUtils.js';
import { Census } from '../../src/census.js';
import * as Messages from '../../src/messages.ts';
import { makeSim, runYears, starterTown } from './harness.js';

describe('crime scan', () => {
  it('scores crime on developed land', () => {
    const { sim } = makeSim();
    const census = new Census();
    sim.blockMaps.landValueMap.worldSet(40, 40, 50);
    sim.blockMaps.populationDensityMap.worldSet(40, 40, 100);

    BlockMapUtils.crimeScan(census, sim.blockMaps);

    // 128 - 50 + 100, no police nearby
    expect(sim.blockMaps.crimeRateMap.worldGet(40, 40)).toBe(178);
    expect(census.crimeAverage).toBe(178);
  });

  it('is damped by police coverage', () => {
    const { sim } = makeSim();
    const census = new Census();
    sim.blockMaps.landValueMap.worldSet(40, 40, 50);
    sim.blockMaps.populationDensityMap.worldSet(40, 40, 100);
    sim.blockMaps.policeStationMap.worldSet(40, 40, 1000);

    BlockMapUtils.crimeScan(census, sim.blockMaps);

    expect(census.crimeAverage).toBeLessThan(178);
  });

  it('responds to a police station in a running town', () => {
    const unpoliced = makeSim();
    starterTown(unpoliced);
    runYears(unpoliced.sim, 5);

    const policed = makeSim();
    starterTown(policed, { police: true });
    runYears(policed.sim, 5);

    expect(unpoliced.sim._census.crimeAverage).toBeGreaterThan(0);
    expect(policed.sim._census.crimeAverage).toBeLessThan(unpoliced.sim._census.crimeAverage);
  });
});

describe('police and fire funding', () => {
  function scoreWith(policeEffect) {
    const { sim } = makeSim();
    const census = sim._census;
    census.totalPop = 100;
    census.poweredZoneCount = 1;
    sim.budget.policeEffect = policeEffect;
    sim.evaluation.doProblems(census, sim.budget, sim.blockMaps);
    sim.evaluation.getScore(sim._constructSimData());
    return sim.evaluation.cityScore;
  }

  it('lowers the score when police are underfunded', () => {
    expect(scoreWith(0)).toBeLessThan(scoreWith(1000));
  });

  it('warns the mayor when police are underfunded', () => {
    const { sim } = makeSim();
    const subjects = [];
    sim.addEventListener(Messages.FRONT_END_MESSAGE, m => subjects.push(m.subject));
    sim._census.totalPop = 100;
    sim.budget.policeEffect = 0;
    sim._cityTime = 60;

    sim._sendMessages();

    expect(subjects).toContain(Messages.POLICE_NEEDS_FUNDING);
  });
});

describe('census', () => {
  it('records a finite money history when run headless', () => {
    const world = makeSim();
    starterTown(world);
    runYears(world.sim, 2);

    const history = world.sim._census.moneyHist10;
    expect(history.every(Number.isFinite)).toBe(true);
  });

  it('asks for a hospital once there are enough residents', () => {
    const census = new Census();
    census.resPop = 1024;
    census.hospitalPop = 0;

    census.take10Census({ cashFlow: 0 });

    expect(census.needHospital).toBe(1);
  });
});

describe('evaluation', () => {
  it('does not collapse the score of a shrinking city', () => {
    const { sim } = makeSim();
    const census = sim._census;
    census.totalPop = 100;
    census.poweredZoneCount = 1;
    sim.evaluation.doProblems(census, sim.budget, sim.blockMaps);
    sim.evaluation.cityPop = 1000;
    sim.evaluation.cityPopDelta = -100;

    sim.evaluation.getScore(sim._constructSimData());

    // Upstream's scale was -0.05 here, which clamped the new score to 0 and halved the old one to 250.
    expect(sim.evaluation.cityScore).toBeGreaterThan(500);
  });
});

describe('tool settings', () => {
  it('restores auto-bulldoze from a save', () => {
    BaseTool.setAutoBulldoze(false);
    const saveData = {};
    BaseTool.save(saveData);
    BaseTool.setAutoBulldoze(true);

    BaseTool.load(saveData);

    expect(BaseTool.getAutoBulldoze()).toBe(false);
    BaseTool.setAutoBulldoze(true);
  });
});
