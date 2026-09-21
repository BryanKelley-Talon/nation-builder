/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Before universal_power_until (1900 by default) a town grows with no plant and no wire: water wheels, wood and
// coal stoves, as era.js puts it. After it, the grid matters exactly as it does in the original game.
//
// This is the loop the whole game stands on, and it was reported broken on 2026-09-20 (the power-lock memo). It was
// not, but it is close enough to the edge of two systems — era rules and the engine's power grid — that it is worth
// holding down with tests rather than trusting it twice.

import { readFileSync } from 'node:fs';

import { eraRules, universalPowerIn } from '../../src/nb/era.js';
import { simOptionsFor, validateScenario } from '../../src/nb/scenario.js';
import { build, makeSim, runYears } from './harness.js';

const fixture = validateScenario(
  JSON.parse(readFileSync(new URL('../../content/scenarios/dev-fixture-us11r.json', import.meta.url))));

// A small mixed town on a road grid. No coal plant, no wire: in 1789 neither exists to build.
function town(world) {
  for (const [tool, x, y] of [['residential', 20, 20], ['residential', 24, 20], ['residential', 28, 20],
                              ['commercial', 20, 24], ['commercial', 24, 24], ['industrial', 28, 24]])
    build(world, tool, x, y);

  // Roads above and below the two zone rows; the lane between them is left clear for wires, which is where a
  // post-1900 town has to run its grid.
  for (let x = 17; x <= 31; x++) {
    build(world, 'road', x, 18);
    build(world, 'road', x, 26);
  }
}


// The grid a town needs once universal power ends: a plant, and wire reaching the zones.
function wireUp(world) {
  build(world, 'coal', 38, 22);
  for (let x = 19; x <= 36; x++)
    build(world, 'wire', x, 22);
}


// The options the game itself builds when a student founds a town in this year.
function foundIn(year) {
  const rules = eraRules(fixture);
  const options = simOptionsFor(fixture, 'locke', { universalPower: universalPowerIn(rules, year) });
  return makeSim(undefined, { simOptions: { ...options, startingYear: year } });
}


describe('a town before the grid (1789)', () => {
  it('counts its zones as powered without a plant', () => {
    const world = foundIn(1789);
    expect(world.sim.tuning.universalPower).toBe(true);
    town(world);
    runYears(world.sim, 2);

    expect(world.map.getTile(20, 20).isPowered()).toBe(true);
    expect(world.sim._census.unpoweredZoneCount).toBe(0);
  });

  it('grows: people move in with no plant anywhere on the map', () => {
    const world = foundIn(1789);
    town(world);
    runYears(world.sim, 6);

    const census = world.sim._census;
    expect(census.coalPowerPop + census.nuclearPowerPop).toBe(0);
    expect(census.resPop).toBeGreaterThan(0);
    expect(world.sim.evaluation.cityPop).toBeGreaterThan(0);
  });
});

describe('a town after the grid arrives (1900)', () => {
  it('needs a plant again, which is the threshold doing its job', () => {
    const world = foundIn(1900);
    expect(world.sim.tuning.universalPower).toBe(false);
    town(world);
    runYears(world.sim, 6);

    expect(world.map.getTile(20, 20).isPowered()).toBe(false);
    expect(world.sim._census.unpoweredZoneCount).toBeGreaterThan(0);
    expect(world.sim._census.resPop).toBe(0);
  });

  it('grows once a plant and wires are built', () => {
    const world = foundIn(1900);
    town(world);
    wireUp(world);

    runYears(world.sim, 6);

    expect(world.map.getTile(20, 20).isPowered()).toBe(true);
    expect(world.sim._census.resPop).toBeGreaterThan(0);
  });
});

describe('the threshold itself', () => {
  it('is the year era.js says, and the scenario can move it', () => {
    const rules = eraRules(fixture);
    expect(universalPowerIn(rules, 1899)).toBe(true);
    expect(universalPowerIn(rules, 1900)).toBe(false);

    const custom = eraRules({ era_rules: { universal_power_until: 1850 } });
    expect(universalPowerIn(custom, 1849)).toBe(true);
    expect(universalPowerIn(custom, 1850)).toBe(false);
  });
});
