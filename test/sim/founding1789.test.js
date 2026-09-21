/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// founding-1789, Will's Global 10R scenario, played through the real engine the way a session founds it: his
// terrain, his governance pole's tuning, the scenario's own starting pressure, the Global leadership layer and the
// Global question bank, with the same year-end work the session does. The page itself is checked by hand in a
// browser (see the 2026-09-21 handoff); this is the part a test can hold still.

import { readFileSync } from 'node:fs';

import * as Messages from '../../src/messages.ts';
import { nextClue } from '../../src/nb/clues.js';
import { advance, leaderById, leadershipRules, startingState } from '../../src/nb/leadership.js';
import { asked, isDue, nextItem, questionRules, validateQuestionBank } from '../../src/nb/questions.js';
import { applyStartingPressures, governanceChoices, simOptionsFor, validateScenario } from '../../src/nb/scenario.js';
import { buildMap, footprintTouchesWater } from '../../src/nb/terrain.js';
import { nextUnrest, unrestWeights } from '../../src/nb/unrest.js';
import { build, makeSim, runYears } from './harness.js';

const read = path => JSON.parse(readFileSync(new URL(`../../content/${path}`, import.meta.url)));
const scenario = validateScenario(read('scenarios/founding-1789.json'));
const layer = read('leadership/global10r.json');
const bank = validateQuestionBank(read('questions/global10r.json'));

// A working town on dry land in the scenario's own map: the harness's starter town, moved into the clear ground
// north-east of the river. Every footprint is checked against the water first, so the test fails loudly rather than
// building nothing if the terrain ever changes under it.
function foundTown(world) {
  const at = (x, y) => [x + 23, y - 17];
  const zones = [
    ['residential', 20, 20], ['residential', 24, 20], ['residential', 28, 20],
    ['residential', 20, 24], ['residential', 24, 24], ['residential', 28, 24],
    ['commercial', 20, 28], ['commercial', 24, 28],
    ['industrial', 28, 28], ['industrial', 32, 28],
  ];

  for (const [tool, x, y] of zones) {
    const [tx, ty] = at(x, y);
    expect(footprintTouchesWater(world.map, tx - 1, ty - 1, 3), `${tool} at ${tx},${ty}`).toBe(false);
    build(world, tool, tx, ty);
  }

  for (let x = 17; x <= 35; x++) {
    build(world, 'road', ...at(x, 18));
    build(world, 'road', ...at(x, 30));
  }
  for (let y = 18; y <= 30; y++) {
    build(world, 'road', ...at(18, y));
    build(world, 'road', ...at(34, y));
  }

  // The grid is required from year one (BK, 2026-09-21: the original game's rules), so the town builds its own.
  build(world, 'coal', ...at(37, 22));
  for (let x = 19; x <= 36; x++)
    build(world, 'wire', ...at(x, 22));
  for (let y = 23; y <= 26; y++)
    build(world, 'wire', ...at(22, y));
  for (let x = 19; x <= 33; x++)
    build(world, 'wire', ...at(x, 26));
}


describe('founding-1789', () => {
  it('is a Global town with all three founding choices open', () => {
    expect(scenario.course).toBe('global10r');
    expect(scenario.start_year).toBe(1789);
    expect(governanceChoices(scenario).available.map(pole => pole.id)).toEqual(['hobbes', 'locke', 'rousseau']);
    expect(governanceChoices(scenario).reserved).toEqual([]);
  });

  it.each(['hobbes', 'locke', 'rousseau'])('founds, grows and is governed under %s', { timeout: 60000 }, poleId => {
    const world = makeSim(buildMap(scenario.terrain), { simOptions: simOptionsFor(scenario, poleId) });
    applyStartingPressures(scenario, world.sim);
    expect(world.sim.budget.cityTax).toBe(12);
    expect(world.sim.getDate().year).toBe(1789);

    foundTown(world);

    const rules = leadershipRules(layer);
    const beat = questionRules(scenario);
    let leadership = startingState(rules, 1789, () => 0.5);
    let clueState = {};
    let questionState = {};
    const questions = [];
    const clues = [];
    let peakPopulation = 0;
    let listening = true;

    // The session's year-end, less the screens: unrest, the government, the advisor's clue, the scheduled question.
    const onYearEnded = snapshot => {
      if (!listening)
        return;
      peakPopulation = Math.max(peakPopulation, snapshot.population);

      const leader = leaderById(rules, leadership.leader);
      const reading = nextUnrest({ snapshot, previous: leadership.unrest, weights: unrestWeights(scenario),
                                   militarism: (leader.disposition || {}).militarism || 0 });
      const outcome = advance({ rules, state: leadership, year: snapshot.year, unrest: reading.value,
                                dominant: reading.dominant, random: () => 0.5 });
      leadership = outcome.state;

      if (!outcome.event) {
        const clue = nextClue({ layer, dominant: reading.dominant, leader, unrestValue: reading.value,
                                year: snapshot.year, state: clueState });
        if (clue) {
          clueState = clue.state;
          clues.push(clue.key);
        }
      }

      const reviewYear = snapshot.year % 5 === 0;
      if (!reviewYear && !outcome.event && isDue({ rules: beat, state: questionState, year: snapshot.year,
                                                    startYear: scenario.start_year })) {
        const next = nextItem(bank, questionState);
        questionState = asked(questionState, next.index, snapshot.year);
        questions.push({ year: snapshot.year, id: next.item.id });
      }
    };

    world.sim.addEventListener(Messages.YEAR_ENDED, onYearEnded);
    try {
      runYears(world.sim, 12);
    } finally {
      listening = false;
      world.sim.removeEventListener(Messages.YEAR_ENDED, onYearEnded);
    }

    expect(peakPopulation, 'the town never grew').toBeGreaterThan(0);
    // The first scheduled question arrives in the town's third year and is Will's first item.
    expect(questions[0]).toEqual({ year: 1792, id: 'sq-natural-rights' });
    expect(questions.length).toBeGreaterThanOrEqual(2);
    // And the Global layer is alive under it: whichever pressure leads, its advisor ladder can speak.
    expect(layer.ladders.map(ladder => ladder.key)).toEqual(expect.arrayContaining(clues));
  });
});
