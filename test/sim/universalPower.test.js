/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Power. By default a town needs plants and wires from its first year, exactly as the original game does (BK's
// ruling, 2026-09-21). A scenario may still ask for a pre-electric stretch with era_rules.universal_power_until,
// and while that is on, every zone counts as powered with no plant on the map.
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


// The options the game itself builds when a student founds a town in this year, under the given era rules.
function foundIn(year, scenario = fixture) {
  const rules = eraRules(scenario);
  const options = simOptionsFor(scenario, 'locke', { universalPower: universalPowerIn(rules, year) });
  return makeSim(undefined, { simOptions: { ...options, startingYear: year } });
}

// A scenario that deliberately asks for a pre-electric stretch.
const preElectric = { ...fixture, era_rules: { universal_power_until: 1900 } };


describe('a scenario that asks for a pre-electric stretch', () => {
  it('counts its zones as powered without a plant', () => {
    const world = foundIn(1789, preElectric);
    expect(world.sim.tuning.universalPower).toBe(true);
    town(world);
    runYears(world.sim, 2);

    expect(world.map.getTile(20, 20).isPowered()).toBe(true);
    expect(world.sim._census.unpoweredZoneCount).toBe(0);
  });

  it('grows: people move in with no plant anywhere on the map', () => {
    const world = foundIn(1789, preElectric);
    town(world);
    runYears(world.sim, 6);

    const census = world.sim._census;
    expect(census.coalPowerPop + census.nuclearPowerPop).toBe(0);
    expect(census.resPop).toBeGreaterThan(0);
    expect(world.sim.evaluation.cityPop).toBeGreaterThan(0);
  });
});

describe('every other town, including the default', () => {
  it('needs a plant from the first year, as the original game does', () => {
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
  it('is off unless a scenario asks for it', () => {
    const rules = eraRules(fixture);
    expect(universalPowerIn(rules, 1789)).toBe(false);
    expect(universalPowerIn(rules, 1899)).toBe(false);
    expect(universalPowerIn(rules, 1900)).toBe(false);
  });

  it('is the year the scenario names, when it names one', () => {
    const custom = eraRules({ era_rules: { universal_power_until: 1850 } });
    expect(universalPowerIn(custom, 1849)).toBe(true);
    expect(universalPowerIn(custom, 1850)).toBe(false);
  });
});
