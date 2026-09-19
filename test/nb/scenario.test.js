/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

import { readdirSync, readFileSync } from 'node:fs';
import { GameTools } from '../../src/gameTools.js';
import { Simulation } from '../../src/simulation.js';
import { eraRules, toolLockedUntil, universalPowerIn } from '../../src/nb/era.js';
import { applyStartingPressures, governanceChoices, simOptionsFor, skillLabel, validateScenario }
  from '../../src/nb/scenario.js';
import { buildMap, footprintTouchesWater, MAP_HEIGHT, MAP_WIDTH, parseTerrain } from '../../src/nb/terrain.js';
import { DIRT, RIVER, WOODS_HIGH, WOODS_LOW, WATER_HIGH, WATER_LOW } from '../../src/tileValues.ts';
import { runYears } from '../sim/harness.js';

const SCENARIO_DIR = new URL('../../content/scenarios/', import.meta.url);
const readJson = name => JSON.parse(readFileSync(new URL(name, SCENARIO_DIR), 'utf8'));
const fixture = () => validateScenario(readJson('dev-fixture-us11r.json'));

function terrainOf(fill, paint = () => {}) {
  const rows = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(fill));
  paint(rows);
  return { format: 'rows-v1', legend: { '.': 'land', '~': 'water', T: 'trees' }, rows: rows.map(r => r.join('')) };
}

describe('content/scenarios', () => {
  it('every registered scenario exists and validates', () => {
    const index = readJson('index.json');
    const files = readdirSync(SCENARIO_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');

    expect(files.sort()).toEqual(index.scenarios.map(id => `${id}.json`).sort());
    for (const id of index.scenarios)
      expect(validateScenario(readJson(`${id}.json`)).scenario_id).toBe(id);
  });

  it('every content file carries the content license, never the code license', () => {
    for (const f of readdirSync(SCENARIO_DIR)) {
      const text = readFileSync(new URL(f, SCENARIO_DIR), 'utf8');
      expect(JSON.parse(text).license.name).toBe('CC BY-NC-SA 4.0');
      expect(text).not.toMatch(/GNU|GPL/);
    }
  });

  it('marks the dev fixture as a dev fixture', () => {
    expect(fixture().dev_fixture).toBe(true);
    expect(fixture().title).toMatch(/not real content/i);
  });
});

describe('validateScenario', () => {
  const base = () => readJson('dev-fixture-us11r.json');

  it.each([
    ['a bad slug', s => { s.scenario_id = 'Founding 1789'; }, /slug/],
    ['an unknown course', s => { s.course = 'us12'; }, /course/],
    ['no license', s => { delete s.license; }, /license/],
    ['an end year before the start', s => { s.end_year = 1700; }, /end_year/],
    ['a missing required skill line', s => { delete s.skill_line_map.governance_dial; }, /governance_dial/],
    ['an unknown skill-line mechanic', s => { s.skill_line_map.jousting = 'XX'; }, /jousting/],
    ['a pole with an unknown tuning knob', s => { s.governance_poles.locke.tuning = { taxes: 2 }; }, /taxes/],
    ['an unknown starting pressure', s => { s.starting_pressures = [{ type: 'plague' }]; }, /plague/],
    ['a short terrain row', s => { s.terrain.rows[4] = '...'; }, /row 5/],
  ])('rejects %s', (_, mutate, message) => {
    const s = base();
    mutate(s);
    expect(() => validateScenario(s)).toThrow(message);
  });

  it('reads skill-line labels from the scenario, not from code', () => {
    const s = base();
    s.course = 'global10r';
    s.skill_line_map.governance_dial = 'EI';
    expect(skillLabel(validateScenario(s), 'governance_dial')).toBe('EI');
    expect(skillLabel(fixture(), 'governance_dial')).toBe('CP');
  });

  it('lists reserved poles separately from choosable ones', () => {
    const { available, reserved } = governanceChoices(fixture());
    expect(available.map(p => p.id)).toEqual(['locke', 'rousseau']);
    expect(reserved).toEqual(['hobbes']);
    expect(() => simOptionsFor(fixture(), 'hobbes')).toThrow(/hobbes/);
  });
});

describe('terrain', () => {
  it('names the row and column of a bad symbol', () => {
    const t = terrainOf('.', rows => { rows[9][19] = '?'; });
    expect(() => parseTerrain(t)).toThrow(/row 10, column 20/);
  });

  it('builds land, open water, shoreline and forest', () => {
    const map = buildMap(terrainOf('.', rows => {
      for (let y = 40; y < 60; y++) for (let x = 40; x < 60; x++) rows[y][x] = '~';
      for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) rows[y][x] = 'T';
    }));

    expect(map.getTileValue(5, 5)).toBe(DIRT);
    expect(map.getTileValue(50, 50)).toBe(RIVER);
    const shore = map.getTileValue(40, 50);
    expect(shore).toBeGreaterThanOrEqual(WATER_LOW);
    expect(shore).toBeLessThanOrEqual(WATER_HIGH);
    const tree = map.getTileValue(15, 15);
    expect(tree).toBeGreaterThanOrEqual(WOODS_LOW);
    expect(tree).toBeLessThanOrEqual(WOODS_HIGH);
  });
});

describe('terrain-driven placement', () => {
  const world = () => {
    const map = buildMap(terrainOf('.', rows => {
      for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 60; x < MAP_WIDTH; x++) rows[y][x] = '~';
      for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) rows[y][x] = 'T';
    }));
    const sim = new Simulation(map, 0, Simulation.SPEED_FAST, null, { funds: 10000 });
    return { map, sim, tools: GameTools(map) };
  };

  it('refuses a zone on water', () => {
    const { sim, tools } = world();
    tools.residential.doTool(80, 50, sim.blockMaps);
    expect(tools.residential.modifyIfEnoughFunding(sim.budget)).toBe(false);
    expect(sim.budget.totalFunds).toBe(10000);
  });

  it('spots water anywhere under a building’s footprint', () => {
    const { map } = world();
    expect(footprintTouchesWater(map, 56, 50, 3)).toBe(false);
    expect(footprintTouchesWater(map, 58, 50, 3)).toBe(true);
    expect(footprintTouchesWater(map, 118, 98, 6)).toBe(true);
  });

  it('charges extra to clear forest before zoning', () => {
    const { sim, tools } = world();
    tools.residential.doTool(15, 15, sim.blockMaps);
    tools.residential.modifyIfEnoughFunding(sim.budget);
    const forestCost = 10000 - sim.budget.totalFunds;

    const other = world();
    other.tools.residential.doTool(40, 40, other.sim.blockMaps);
    other.tools.residential.modifyIfEnoughFunding(other.sim.budget);
    const openCost = 10000 - other.sim.budget.totalFunds;

    expect(forestCost).toBeGreaterThan(openCost);
  });
});

describe('era rules', () => {
  it('gates tools by year, with scenario overrides', () => {
    const rules = eraRules(fixture());
    expect(toolLockedUntil(rules, 'nuclear', 1789)).toBe(1957);
    expect(toolLockedUntil(rules, 'nuclear', 1957)).toBeNull();
    expect(toolLockedUntil(rules, 'residential', 1789)).toBeNull();

    const custom = eraRules({ era_rules: { tool_available_from: { nuclear: 1800 }, universal_power_until: 1850 } });
    expect(toolLockedUntil(custom, 'nuclear', 1801)).toBeNull();
    expect(universalPowerIn(custom, 1849)).toBe(true);
    expect(universalPowerIn(custom, 1850)).toBe(false);
  });
});

describe('a dev-fixture city', () => {
  it('starts in 1789 under the chosen pole and runs', () => {
    const scenario = fixture();
    const rules = eraRules(scenario);
    const map = buildMap(scenario.terrain);
    const options = simOptionsFor(scenario, 'rousseau', { universalPower: universalPowerIn(rules, scenario.start_year) });
    const sim = new Simulation(map, 0, Simulation.SPEED_FAST, null, options);
    applyStartingPressures(scenario, sim);

    expect(sim.getDate().year).toBe(1789);
    expect(sim.budget.totalFunds).toBe(10000);
    expect(sim.tuning.taxYield).toBe(1.2);
    expect(sim.tuning.universalPower).toBe(true);

    runYears(sim, 2);
    expect(sim.getDate().year).toBe(1791);
  });
});
