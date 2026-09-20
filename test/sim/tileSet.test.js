/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// The tile atlas: where each tile sits in the sheet the game draws from.

import { ACCEPTABLE_DIMENSION, TILE_SIZE, TILES_PER_ROW, tileSource } from '../../src/tileSet.js';
import { TILE_COUNT } from '../../src/tileValues.ts';

describe('tile atlas', () => {
  it('is the square sheet the engine ships', () => {
    expect(TILES_PER_ROW).toBe(Math.sqrt(TILE_COUNT));
    expect(ACCEPTABLE_DIMENSION).toBe(TILES_PER_ROW * TILE_SIZE);
  });

  it('reads tiles left to right, top to bottom', () => {
    expect(tileSource(0)).toEqual({ x: 0, y: 0 });
    expect(tileSource(1)).toEqual({ x: TILE_SIZE, y: 0 });
    expect(tileSource(TILES_PER_ROW)).toEqual({ x: 0, y: TILE_SIZE });
    expect(tileSource(TILES_PER_ROW + 3)).toEqual({ x: 3 * TILE_SIZE, y: TILE_SIZE });
  });

  it('keeps every tile inside the sheet', () => {
    for (let i = 0; i < TILE_COUNT; i++) {
      const { x, y } = tileSource(i);
      expect(x + TILE_SIZE).toBeLessThanOrEqual(ACCEPTABLE_DIMENSION);
      expect(y + TILE_SIZE).toBeLessThanOrEqual(ACCEPTABLE_DIMENSION);
    }
    const last = tileSource(TILE_COUNT - 1);
    expect(last).toEqual({ x: ACCEPTABLE_DIMENSION - TILE_SIZE, y: ACCEPTABLE_DIMENSION - TILE_SIZE });
  });
});
