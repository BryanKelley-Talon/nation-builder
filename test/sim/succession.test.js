/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Does a government actually fall? The state machine is unit-tested against numbers; this runs the real engine,
// reads the real year-end snapshots, and asks whether a town governed badly enough turns its government out within
// a number of years a student could plausibly play through.

import { readFileSync } from 'node:fs';

import { advance, leaderById, leadershipRules, startingState } from '../../src/nb/leadership.js';
import { nextUnrest } from '../../src/nb/unrest.js';
import * as Messages from '../../src/messages.ts';
import { build, makeSim, runYears } from './harness.js';

const layer = JSON.parse(readFileSync(new URL('../../content/leadership/us11r.json', import.meta.url)));

// A town that exists before it is governed badly. This matters: a town taxed to the ceiling from its first year
// never grows at all, so it has no people to be angry — the anger has to be about something. It is powered by the
// universalPower knob to keep the test about politics rather than about laying wire (same isolation as the
// hospital tests); the grid itself is covered in universalPower.test.js.
function grownTown(world) {
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


// Play the town, running the same year-end work the session does.
function govern(world, years, { militarismOf = () => 0, state: carried = null } = {}) {
  const rules = leadershipRules(layer);
  let state = carried || startingState(rules, world.sim.getDate().year, () => 0.99);
  const events = [];
  let peakUnrest = 0;
  let lastDominant = null;

  world.sim.addEventListener(Messages.YEAR_ENDED, snapshot => {
    const leader = leaderById(rules, state.leader);
    const reading = nextUnrest({ snapshot, previous: state.unrest, militarism: militarismOf(leader) });
    peakUnrest = Math.max(peakUnrest, reading.value);
    lastDominant = reading.dominant;

    const outcome = advance({ rules, state, year: snapshot.year, unrest: reading.value,
                              dominant: reading.dominant, random: () => 0.99 });
    state = outcome.state;
    if (outcome.event)
      events.push({ year: snapshot.year, event: outcome.event, to: outcome.to.id, dominant: reading.dominant });
  });

  runYears(world.sim, years);
  return { state, events, peakUnrest, lastDominant };
}


describe('a town governed badly', () => {
  it('turns its government out, and does it for a reason the advisor can name', () => {
    const world = makeSim(undefined, { simOptions: { startingYear: 1900, funds: 500000,
                                                     tuning: { universalPower: true } } });
    grownTown(world);
    world.sim.budget.setTax(7);

    // Twelve years to become a town, then a government that taxes to the ceiling and never polices it.
    const grow = govern(world, 12);
    world.sim.budget.setTax(20);
    const { events, peakUnrest, lastDominant } = govern(world, 28, { state: grow.state });
    const overthrow = events.find(event => event.event === 'overthrow');

    expect(peakUnrest, `peak unrest only reached ${peakUnrest}`).toBeGreaterThan(50);
    expect(overthrow, `no overthrow in 40 years; events: ${JSON.stringify(events)}`).toBeTruthy();
    expect(overthrow.year).toBeLessThan(1940);
    // The event carries the pressure that caused it, which is what picks the advisor's ladder.
    expect(['approval', 'crime', 'tax', 'unemployment', 'militarism']).toContain(overthrow.dominant);
    expect(lastDominant).toBeTruthy();
  });

  it('leaves a well-run town alone, changing government only when a term ends', () => {
    const world = makeSim(undefined, { simOptions: { startingYear: 1900, funds: 500000,
                                                     tuning: { universalPower: true } } });
    grownTown(world);
    build(world, 'police', 96, 30);
    build(world, 'police', 96, 50);
    world.sim.budget.setTax(7);

    const { events } = govern(world, 30);
    expect(events.every(event => event.event === 'succession'),
           `a quiet town should not be overthrown; events: ${JSON.stringify(events)}`).toBe(true);
  });
});
