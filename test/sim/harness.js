/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Headless simulation harness: runs the engine in Node with no DOM, no canvas and no wall-clock throttle.

import { GameMap } from '../../src/gameMap.js';
import { GameTools } from '../../src/gameTools.js';
import { Simulation } from '../../src/simulation.js';

export const PHASES_PER_TICK = 16;
export const TICKS_PER_YEAR = 48;

export function flatMap() {
  return new GameMap(120, 100);
}

export function makeSim(map = flatMap(), options = {}) {
  const sim = new Simulation(map, options.level ?? Simulation.LEVEL_EASY, Simulation.SPEED_FAST, options.savedGame,
                           options.simOptions);
  return { map, sim, tools: GameTools(map) };
}

// Apply a tool at a tile, charging the city's budget. Returns the tool result code.
export function build(world, toolName, x, y) {
  const tool = world.tools[toolName];
  tool.doTool(x, y, world.sim.blockMaps);
  tool.modifyIfEnoughFunding(world.sim.budget);
  return tool.result;
}

export function runPhases(sim, phases) {
  for (let i = 0; i < phases; i++)
    sim._simulate(sim._constructSimData());
  sim._updateTime();
}

export function runTicks(sim, ticks) {
  runPhases(sim, ticks * PHASES_PER_TICK);
}

export function runYears(sim, years) {
  runTicks(sim, years * TICKS_PER_YEAR);
}

// A small working town: a block of residential, commercial and industrial zones on a road grid, powered by a coal
// plant. Enough to grow population, land value and crime within a few simulated years.
export function starterTown(world, { police = false, power = true } = {}) {
  const zones = [
    ['residential', 20, 20], ['residential', 24, 20], ['residential', 28, 20],
    ['residential', 20, 24], ['residential', 24, 24], ['residential', 28, 24],
    ['commercial', 20, 28], ['commercial', 24, 28],
    ['industrial', 28, 28], ['industrial', 32, 28],
  ];
  for (const [tool, x, y] of zones)
    build(world, tool, x, y);

  // Roads around and between the zones.
  for (let x = 17; x <= 35; x++) {
    build(world, 'road', x, 18);
    build(world, 'road', x, 30);
  }
  for (let y = 18; y <= 30; y++) {
    build(world, 'road', 18, y);
    build(world, 'road', 34, y);
  }

  if (police)
    build(world, 'police', 32, 20);

  if (!power)
    return;

  // Power lines run in the gaps between zone rows, so every zone touches one.
  build(world, 'coal', 40, 22);
  for (let x = 19; x <= 38; x++)
    build(world, 'wire', x, 22);
  for (let y = 23; y <= 26; y++)
    build(world, 'wire', 22, y);
  for (let x = 19; x <= 33; x++)
    build(world, 'wire', x, 26);

}
