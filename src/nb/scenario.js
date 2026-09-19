/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * The scenario contract (buildconcept v1 §2). Mechanics take a scenario as data, so adding one is authoring work,
 * not a code change. Scenario files live under content/ and carry the content license, not this one.
 *
 * Every mechanic reads its skill-line label from skill_line_map through skillLabel(); nothing downstream hardcodes
 * TH/DU/HC/CP/EI/EX. That keeps the US11R/Global10R vocabulary split a data question.
 */

import { makeTuning } from '../tuning.js';
import { parseTerrain } from './terrain.js';

export const COURSES = ['us11r', 'global10r'];

// Mechanics that must have a label before the first playable slice can run. The rest are optional until built.
export const REQUIRED_SKILL_LINES = ['zone_placement', 'terrain_placement', 'governance_dial'];
export const KNOWN_SKILL_LINES = ['zone_placement', 'advisor_conflict', 'terrain_placement', 'governance_dial',
                                  'roads_rail', 'then_vs_now'];

export const DEFAULT_END_YEAR = 2026;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;


function fail(scenarioId, message) {
  throw new Error(`Scenario ${scenarioId || '(no id)'}: ${message}`);
}


// Check a parsed scenario file and return it with defaults filled in. Throws on the first problem found.
export function validateScenario(raw) {
  if (!raw || typeof raw !== 'object')
    throw new Error('Scenario must be a JSON object');

  const id = raw.scenario_id;
  if (typeof id !== 'string' || !SLUG.test(id))
    fail(id, 'scenario_id must be a lowercase slug, e.g. "founding-1789"');

  if (!COURSES.includes(raw.course))
    fail(id, `course must be one of ${COURSES.join(', ')}`);

  if (typeof raw.title !== 'string' || raw.title.trim() === '')
    fail(id, 'title is required');

  if (!raw.license || typeof raw.license.name !== 'string')
    fail(id, 'license {name, url, sellable} is required: content carries its own license, separate from the code');

  if (!Number.isInteger(raw.start_year))
    fail(id, 'start_year must be a whole year');

  const endYear = raw.end_year === undefined ? DEFAULT_END_YEAR : raw.end_year;
  if (!Number.isInteger(endYear) || endYear <= raw.start_year)
    fail(id, 'end_year must be a whole year after start_year');

  try {
    parseTerrain(raw.terrain);
  } catch (e) {
    fail(id, e.message);
  }

  const map = raw.skill_line_map || {};
  for (const mechanic of REQUIRED_SKILL_LINES) {
    if (typeof map[mechanic] !== 'string' || map[mechanic] === '')
      fail(id, `skill_line_map.${mechanic} is required`);
  }
  for (const mechanic of Object.keys(map)) {
    if (!KNOWN_SKILL_LINES.includes(mechanic))
      fail(id, `skill_line_map.${mechanic} is not a known mechanic`);
  }

  const poles = raw.governance_poles || {};
  const poleIds = Object.keys(poles);
  if (poleIds.length === 0)
    fail(id, 'governance_poles needs at least one pole');
  for (const poleId of poleIds) {
    const pole = poles[poleId];
    // A null pole is a reserved slot (e.g. Hobbes before its content lands): shown as not yet available.
    if (pole === null)
      continue;
    if (typeof pole.label !== 'string' || pole.label === '')
      fail(id, `governance_poles.${poleId}.label is required`);
    try {
      makeTuning(pole.tuning || {});
    } catch (e) {
      fail(id, `governance_poles.${poleId}.tuning: ${e.message}`);
    }
  }

  const pressures = raw.starting_pressures || [];
  if (!Array.isArray(pressures))
    fail(id, 'starting_pressures must be a list');
  for (const p of pressures) {
    if (!STARTING_PRESSURES[p && p.type])
      fail(id, `starting_pressures: unknown type "${p && p.type}" (known: ${Object.keys(STARTING_PRESSURES).join(', ')})`);
  }

  return {
    ...raw,
    end_year: endYear,
    starting_funds: raw.starting_funds === undefined ? 20000 : raw.starting_funds,
    starting_pressures: pressures,
    advisors: raw.advisors || [],
    injustice_consequence_set: raw.injustice_consequence_set || null,
    dev_fixture: raw.dev_fixture === true,
  };
}


export function skillLabel(scenario, mechanic) {
  const label = scenario.skill_line_map[mechanic];
  if (label === undefined)
    throw new Error(`Scenario ${scenario.scenario_id} has no skill line for ${mechanic}`);
  return label;
}


// Poles a student can choose now, in file order. Reserved (null) slots are listed separately so the UI can show
// them as coming, not hide them.
export function governanceChoices(scenario) {
  const available = [];
  const reserved = [];
  for (const [id, pole] of Object.entries(scenario.governance_poles)) {
    if (pole === null)
      reserved.push(id);
    else
      available.push({ id, ...pole });
  }
  return { available, reserved };
}


// Starting pressures are applied once, to a brand-new city, after construction.
const STARTING_PRESSURES = {
  // { type: "tax_rate", value: 0-20 }
  tax_rate: (sim, p) => sim.budget.setTax(p.value),
  // { type: "funds_delta", value: dollars } — added to (or taken from) the starting funds
  funds_delta: (sim, p) => sim.budget.spend(-p.value),
};


export function applyStartingPressures(scenario, sim) {
  for (const p of scenario.starting_pressures)
    STARTING_PRESSURES[p.type](sim, p);
}


// The Simulation options for a new city in this scenario under the chosen governance pole.
export function simOptionsFor(scenario, poleId, eraTuning = {}) {
  const pole = scenario.governance_poles[poleId];
  if (!pole)
    throw new Error(`Scenario ${scenario.scenario_id} has no available governance pole "${poleId}"`);

  return {
    startingYear: scenario.start_year,
    funds: scenario.starting_funds,
    tuning: { ...(pole.tuning || {}), ...eraTuning },
  };
}
