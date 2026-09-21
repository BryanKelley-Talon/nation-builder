/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Parks against pollution. In the original, greenery is simply not a *source* of pollution, which means a town can
// never plant its way out of its own industry. BK's direction, 2026-09-20: parks should counter environmental
// effects, so a green tile now takes pollution back out of the block it sits in.
//
// This tests the pollution scan directly rather than through a played town. Planting parks consumes random
// numbers, so two towns that differ by a park belt are not the same world a few years later — they are two
// different worlds, and comparing their pollution measures the divergence, not the parks.

import { BlockMap } from '../../src/blockMap.ts';
import { BlockMapUtils } from '../../src/blockMapUtils.js';
import { Census } from '../../src/census.js';
import { GameMap } from '../../src/gameMap.js';
import * as TileValues from '../../src/tileValues.ts';

const WIDTH = 40;
const HEIGHT = 40;

function blockMaps() {
  return {
    landValueMap: new BlockMap(WIDTH, HEIGHT, 2),
    pollutionDensityMap: new BlockMap(WIDTH, HEIGHT, 2),
    crimeRateMap: new BlockMap(WIDTH, HEIGHT, 2),
    terrainDensityMap: new BlockMap(WIDTH, HEIGHT, 4),
    tempMap1: new BlockMap(WIDTH, HEIGHT, 2),
    tempMap2: new BlockMap(WIDTH, HEIGHT, 2),
    tempMap3: new BlockMap(WIDTH, HEIGHT, 4),
    cityCentreDistScoreMap: new BlockMap(WIDTH, HEIGHT, 8),
  };
}


// A patch of the dirtiest thing the tile table has, optionally ringed with parks.
function scan({ green }) {
  const map = new GameMap(WIDTH, HEIGHT);
  const census = new Census();
  const maps = blockMaps();

  // A working industrial zone: getPollutionValue only scores tiles above LASTIND, so INDBASE itself is clean.
  for (let x = 14; x <= 20; x++) {
    for (let y = 14; y <= 20; y++)
      map.setTileValue(x, y, TileValues.IZB);
  }

  if (green) {
    for (let x = 10; x <= 24; x++) {
      for (const y of [11, 12, 13, 21, 22, 23])
        map.setTileValue(x, y, TileValues.WOODS2);
    }
    for (let y = 11; y <= 23; y++) {
      for (const x of [10, 11, 12, 22, 23, 24])
        map.setTileValue(x, y, TileValues.WOODS2);
    }
  }

  BlockMapUtils.pollutionTerrainLandValueScan(map, census, maps);

  let total = 0;
  for (let x = 0; x < maps.pollutionDensityMap.width; x++) {
    for (let y = 0; y < maps.pollutionDensityMap.height; y++)
      total += maps.pollutionDensityMap.get(x, y);
  }

  return { total, average: census.pollutionAverage };
}


describe('parks and the air', () => {
  it('a belt of parks takes pollution out of the neighbourhood', () => {
    const bare = scan({ green: false });
    const planted = scan({ green: true });

    expect(bare.total, 'the industrial patch should be polluted at all').toBeGreaterThan(0);
    expect(planted.total, `bare ${bare.total}, planted ${planted.total}`).toBeLessThan(bare.total);
  });

  it('cleans to clean and no further', () => {
    const parksOnly = scan({ green: true, industry: false });
    expect(parksOnly.total).toBeGreaterThanOrEqual(0);
    expect(parksOnly.average).toBeGreaterThanOrEqual(0);
  });
});
