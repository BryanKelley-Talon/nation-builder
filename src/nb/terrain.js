/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * Scenario terrain → GameMap. Authors describe terrain as land, water and trees; this module picks the engine's
 * shoreline and forest-edge tiles so the map looks and behaves like a generated one.
 *
 * Format "rows-v1": a legend of single characters and one string per map row.
 *   { "format": "rows-v1", "legend": { ".": "land", "~": "water", "T": "trees" }, "rows": ["..~~", ...] }
 * The map is 120 × 100 tiles (the engine's fixed size), so there are 100 rows of 120 characters.
 */

import { GameMap } from '../gameMap.js';
import { MapGenerator, smoothRiver, smoothTrees } from '../mapGenerator.js';
import { BLBNBIT } from '../tileFlags.ts';
import { DIRT, REDGE, RIVER, WATER_HIGH, WATER_LOW, WOODS } from '../tileValues.ts';

export const MAP_WIDTH = 120;
export const MAP_HEIGHT = 100;

const KINDS = ['land', 'water', 'trees'];


// Parse and check a terrain description. Returns a grid of kinds, grid[y][x]. Throws with a message an author can act
// on (row and column are 1-based, as in a text editor).
export function parseTerrain(terrain) {
  if (!terrain || terrain.format !== 'rows-v1')
    throw new Error(`Unsupported terrain format: ${terrain && terrain.format}`);

  const legend = terrain.legend || {};
  for (const [symbol, kind] of Object.entries(legend)) {
    if (symbol.length !== 1)
      throw new Error(`Terrain legend keys must be single characters, got "${symbol}"`);
    if (!KINDS.includes(kind))
      throw new Error(`Terrain legend "${symbol}" maps to unknown kind "${kind}" (expected ${KINDS.join(', ')})`);
  }

  const rows = terrain.rows;
  if (!Array.isArray(rows) || rows.length !== MAP_HEIGHT)
    throw new Error(`Terrain needs ${MAP_HEIGHT} rows, got ${Array.isArray(rows) ? rows.length : 'none'}`);

  return rows.map((row, y) => {
    if (typeof row !== 'string' || row.length !== MAP_WIDTH)
      throw new Error(`Terrain row ${y + 1} needs ${MAP_WIDTH} characters, got ${typeof row === 'string' ? row.length : typeof row}`);

    return Array.from(row, (symbol, x) => {
      const kind = legend[symbol];
      if (kind === undefined)
        throw new Error(`Terrain row ${y + 1}, column ${x + 1}: "${symbol}" is not in the legend`);
      return kind;
    });
  });
}


export function buildMap(terrain) {
  if (terrain && terrain.format === 'generated-v1')
    return MapGenerator(MAP_WIDTH, MAP_HEIGHT);

  const grid = parseTerrain(terrain);
  const map = new GameMap(MAP_WIDTH, MAP_HEIGHT);
  const isWater = (x, y) => x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT || grid[y][x] === 'water';

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const kind = grid[y][x];

      if (kind === 'water') {
        // Open water is RIVER; water touching land becomes a shoreline tile, chosen by smoothRiver below.
        const open = isWater(x - 1, y) && isWater(x + 1, y) && isWater(x, y - 1) && isWater(x, y + 1);
        map.setTile(x, y, open ? RIVER : REDGE, 0);
      } else if (kind === 'trees') {
        map.setTile(x, y, WOODS, BLBNBIT);
      } else {
        map.setTile(x, y, DIRT, 0);
      }
    }
  }

  smoothRiver(map);
  smoothTrees(map);
  smoothTrees(map);

  return map;
}


// Building tools anchor one tile up and left of the clicked tile (BuildingTool.buildBuilding).
export function footprintTouchesWater(map, left, top, size) {
  for (let y = top; y < top + size; y++) {
    for (let x = left; x < left + size; x++) {
      if (!map.testBounds(x, y))
        continue;
      const value = map.getTileValue(x, y);
      if (value >= WATER_LOW && value <= WATER_HIGH)
        return true;
    }
  }
  return false;
}
