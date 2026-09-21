/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Hospitals are not built by the student: a residential zone that is empty, powered, road-served and in a town whose
// people need one turns itself into a hospital (residential.js, makeHospital). It is the same family of risk as the
// tile-atlas and skin work — anything that broke zone growth or its rendering would show up here first.

import * as TileValues from '../../src/tileValues.ts';
import { build, makeSim, runYears } from './harness.js';

// Hospitals need residents, and residents need somewhere to work: a residential-only town never grows at all, so
// the town below is mixed and road-served. It is powered by the universalPower knob rather than by a plant and a
// hand-laid grid, to keep this test about hospitals; whether the grid itself works is test/sim/universalPower.js.
function mixedTown(world) {
  const rows = [['residential', 20], ['residential', 24], ['residential', 28], ['commercial', 32],
                ['residential', 36], ['residential', 40], ['industrial', 44], ['residential', 48],
                ['residential', 52], ['commercial', 56], ['residential', 60], ['industrial', 64]];

  for (const [tool, y] of rows) {
    for (let x = 20; x <= 92; x += 4)
      build(world, tool, x, y);
    for (let x = 17; x <= 95; x++)
      build(world, 'road', x, y + 2);
  }

  for (let y = 17; y <= 66; y++)
    build(world, 'road', 18, y);

}


function hospitalTiles(map) {
  let found = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.getTileValue(x, y) === TileValues.HOSPITAL)
        found += 1;
    }
  }
  return found;
}


function grownTown(years) {
  const world = makeSim(undefined, { simOptions: { startingYear: 1900, funds: 500000,
                                                   tuning: { universalPower: true } } });
  mixedTown(world);
  runYears(world.sim, years);
  return world;
}


describe('hospitals', () => {
  it('appear on their own once a town has residents who need one', { timeout: 30000 }, () => {
    const world = grownTown(12);
    const census = world.sim._census;

    expect(census.resPop).toBeGreaterThan(255);
    expect(hospitalTiles(world.map)).toBeGreaterThan(0);
    expect(census.hospitalPop).toBeGreaterThan(0);
  });

  it('keep pace with the population, one per 256 residents', { timeout: 30000 }, () => {
    const world = grownTown(50);
    const census = world.sim._census;

    // A town that never grew would satisfy the ratio trivially at zero, so say out loud that it grew.
    expect(census.resPop).toBeGreaterThan(255);
    expect(census.hospitalPop).toBeGreaterThan(0);
    expect(census.hospitalPop).toBe(hospitalTiles(world.map));
    expect(census.hospitalPop).toBe(census.resPop >> 8);
    // Satisfied: the town stops asking for another until its population passes the next step.
    expect(census.needHospital).toBe(0);
  });

  it('asks for the first one only once there are enough residents to need it', () => {
    const world = grownTown(2);
    const census = world.sim._census;

    // Below 256 residents the engine neither wants nor builds a hospital.
    if (census.resPop < 256) {
      expect(census.needHospital).toBe(0);
      expect(hospitalTiles(world.map)).toBe(0);
    }
  });
});
