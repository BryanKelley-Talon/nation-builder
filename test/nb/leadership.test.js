/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Leadership succession: the tuning composition point, the unrest metric and its dominant term, the trigger state
// machine, and the content layers both curriculum desks delivered.

import { readFileSync } from 'node:fs';

import { bendKnob, BEND_LIMITS, currentTuning } from '../../src/nb/governance.js';
import { changeOfGovernment, nextClue, selectLadder } from '../../src/nb/clues.js';
import { advance, chooseSuccessor, EVENT_OVERTHROW, EVENT_SUCCESSION, fromSave, leaderById, leadershipRules,
         leaderVoice, rollTenure, startingState, toSave } from '../../src/nb/leadership.js';
import { DEFAULT_TUNING } from '../../src/tuning.js';
import { dominantTerm, nextUnrest, unrestTerms } from '../../src/nb/unrest.js';

const layers = {
  us11r: JSON.parse(readFileSync(new URL('../../content/leadership/us11r.json', import.meta.url))),
  global10r: JSON.parse(readFileSync(new URL('../../content/leadership/global10r.json', import.meta.url))),
};
const strings = JSON.parse(readFileSync(new URL('../../content/ui/strings.json', import.meta.url)));

const CALM = { year: 1800, approval: 90, crimeAverage: 5, taxRate: 7, unemployment: 0, score: 600, population: 2000 };
const MISERABLE = { year: 1800, approval: 10, crimeAverage: 200, taxRate: 19, unemployment: 200, score: 200,
                    population: 2000 };

// A predictable "random" so tenure rolls and tied candidates are the same every run.
const fixed = value => () => value;


describe('tuning composition: a leader bends, never overrides', () => {
  it('keeps the pole audible under the leader', () => {
    const pole = { taxYield: 0.8 };
    const bent = currentTuning({ pole, leader: { taxYield: 'higher' } });

    expect(bent.taxYield).toBeGreaterThan(0.8);
    // Still nearer the pole's own choice than a pole that chose the opposite.
    expect(bent.taxYield).toBeLessThan(currentTuning({ pole: { taxYield: 1.2 } }).taxYield);
  });

  it('cannot run away, however many leaders bend the same way', () => {
    let value = DEFAULT_TUNING.taxYield;
    for (let i = 0; i < 40; i++)
      value = bendKnob('taxYield', value, 'higher');

    expect(value).toBeLessThanOrEqual(BEND_LIMITS.max);
    expect(bendKnob('taxYield', DEFAULT_TUNING.taxYield, 'lower')).toBeGreaterThanOrEqual(BEND_LIMITS.min);
  });

  it('lets the era have the last word on what is possible', () => {
    const composed = currentTuning({ pole: { taxYield: 1.2 }, leader: { taxYield: 'lower' },
                                     era: { universalPower: true } });
    expect(composed.universalPower).toBe(true);
  });

  it('ignores a direction for a knob no direction can express', () => {
    expect(currentTuning({ leader: { universalPower: 'higher' } }).universalPower).toBe(false);
  });
});


describe('unrest, and which pressure is driving it', () => {
  it('is low in a calm town and high in a miserable one', () => {
    expect(nextUnrest({ snapshot: CALM }).value).toBeLessThan(20);
    expect(nextUnrest({ snapshot: MISERABLE }).raw).toBeGreaterThan(70);
  });

  it('names the dominant term, which is what both desks key their ladders to', () => {
    const crime = { ...CALM, approval: 70, crimeAverage: 240 };
    expect(nextUnrest({ snapshot: crime }).dominant).toBe('crime');

    const tax = { ...CALM, approval: 95, crimeAverage: 0, taxRate: 20 };
    expect(nextUnrest({ snapshot: tax }).dominant).toBe('tax');

    const jobs = { ...CALM, approval: 95, crimeAverage: 0, unemployment: 250 };
    expect(nextUnrest({ snapshot: jobs }).dominant).toBe('unemployment');

    expect(nextUnrest({ snapshot: { ...CALM, approval: 20 } }).dominant).toBe('approval');
  });

  it('counts a war-leaning leader only while the town is already turning', () => {
    const quiet = unrestTerms(CALM, { militarism: 1, rising: false });
    expect(quiet.militarism).toBe(0);

    const turning = unrestTerms(MISERABLE, { militarism: 1, rising: true });
    expect(turning.militarism).toBeGreaterThan(0);
    expect(dominantTerm(turning)).toBeTruthy();
  });

  it('smooths, so one bad winter does not topple a government', () => {
    const spike = nextUnrest({ snapshot: MISERABLE, previous: 0 });
    expect(spike.value).toBeLessThan(spike.raw);
  });

  it('gives credit for a town that is doing well', () => {
    const withScore = nextUnrest({ snapshot: { ...CALM, score: 900 } });
    const without = nextUnrest({ snapshot: { ...CALM, score: 500 } });
    expect(withScore.value).toBeLessThanOrEqual(without.value);
  });
});


describe('the trigger state machine', () => {
  const rules = leadershipRules(layers.global10r);

  it('starts every playthrough with the founder', () => {
    const state = startingState(rules, 1900, fixed(0.5));
    expect(state.leader).toBe('founder');
    expect(state.tenureEnds).toBeGreaterThan(1900);
  });

  it("rolls a tenure inside the scenario's range", () => {
    for (const roll of [0, 0.5, 0.999]) {
      const ends = rollTenure(rules, 1900, fixed(roll));
      expect(ends).toBeGreaterThanOrEqual(1900 + rules.tenureYears[0]);
      expect(ends).toBeLessThanOrEqual(1900 + rules.tenureYears[1]);
    }
  });

  it('does nothing in a quiet year inside a tenure', () => {
    const state = { ...startingState(rules, 1900, fixed(0.5)), tenureEnds: 1930 };
    const outcome = advance({ rules, state, year: 1910, unrest: 10, dominant: 'approval', random: fixed(0.5) });
    expect(outcome.event).toBeNull();
    expect(outcome.state.leader).toBe('founder');
  });

  it('counts sustained years before an overthrow, and resets when the town settles', () => {
    let state = { ...startingState(rules, 1900, fixed(0.5)), tenureEnds: 2000 };
    let outcome = advance({ rules, state, year: 1901, unrest: 80, dominant: 'crime', random: fixed(0.5) });
    expect(outcome.event).toBeNull();
    expect(outcome.state.sustained).toBe(1);

    outcome = advance({ rules, state: outcome.state, year: 1902, unrest: 20, dominant: 'crime', random: fixed(0.5) });
    expect(outcome.state.sustained).toBe(0);
  });

  it('overthrows a government the town stays angry at', () => {
    let state = { ...startingState(rules, 1900, fixed(0.5)), tenureEnds: 2000 };
    let event = null;

    for (let year = 1901; year <= 1903; year++) {
      const outcome = advance({ rules, state, year, unrest: 85, dominant: 'crime', random: fixed(0.5) });
      state = outcome.state;
      event = outcome.event || event;
    }

    expect(event).toBe(EVENT_OVERTHROW);
    expect(state.leader).not.toBe('founder');
    expect(state.history[0]).toMatchObject({ leader: 'founder', ended: EVENT_OVERTHROW });
  });

  it('retires a government whose term simply ended', () => {
    const state = { ...startingState(rules, 1900, fixed(0.5)), tenureEnds: 1925 };
    const outcome = advance({ rules, state, year: 1925, unrest: 5, dominant: 'approval', random: fixed(0.5) });

    expect(outcome.event).toBe(EVENT_SUCCESSION);
    expect(['heir', 'reformer']).toContain(outcome.state.leader);
  });

  it('lets an overthrow outrank a succession falling in the same year', () => {
    let state = { ...startingState(rules, 1900, fixed(0.5)), tenureEnds: 1903, sustained: 2 };
    const outcome = advance({ rules, state, year: 1903, unrest: 90, dominant: 'crime', random: fixed(0.5) });

    expect(outcome.event).toBe(EVENT_OVERTHROW);
  });

  it('picks the harder successor for a crime-driven overthrow and the reforming one otherwise', () => {
    const founder = leaderById(rules, 'founder');
    expect(chooseSuccessor(rules, founder, { event: EVENT_OVERTHROW, dominant: 'crime', random: fixed(0) }).id)
      .toBe('strongman');
    expect(chooseSuccessor(rules, founder, { event: EVENT_OVERTHROW, dominant: 'approval', random: fixed(0) }).id)
      .toBe('revolutionary_council');
  });
});


describe('the two content layers', () => {
  it('runs on one architecture: both start with a founder and move only through the triggers', () => {
    for (const [course, layer] of Object.entries(layers)) {
      const rules = leadershipRules(layer);
      expect(rules.startsWith, course).toBe('founder');
      expect(leaderById(rules, 'founder'), course).toBeTruthy();

      for (const leader of rules.leaders) {
        for (const id of [...(leader.succeeds_to || []), ...(leader.on_overthrow || [])])
          expect(leaderById(rules, id), `${course}: ${leader.id} -> ${id}`).toBeTruthy();
      }
    }
  });

  it('gives US11R two tendencies that succeed and overthrow each other', () => {
    const rules = leadershipRules(layers.us11r);
    const limited = leaderById(rules, 'limited_gov_leader');
    const activist = leaderById(rules, 'activist_gov_leader');

    expect(limited.succeeds_to).toEqual(['activist_gov_leader']);
    expect(activist.on_overthrow).toEqual(['limited_gov_leader']);
  });

  it("changes US11R's words as the clock advances, keeping one identity", () => {
    const rules = leadershipRules(layers.us11r);
    const limited = leaderById(rules, 'limited_gov_leader');

    expect(leaderVoice(limited, 1800).summary).toMatch(/only what it says/);
    expect(leaderVoice(limited, 1900).summary).toMatch(/market corrects itself/);
    expect(leaderVoice(limited, 1940).summary).toMatch(/neighbor's job/);
    expect(leaderVoice(limited, 1980).summary).toMatch(/bigger government isn't the same/);
    expect(leaderVoice(limited, 1980).label).toBeTruthy();
  });

  it("carries each desk's tuning claims as directions, and invents none", () => {
    const rules = leadershipRules(layers.us11r);
    expect(leaderById(rules, 'limited_gov_leader').tuning).toEqual({ taxYield: 'lower' });
    expect(leaderById(rules, 'activist_gov_leader').tuning).toEqual({ taxYield: 'higher' });

    // Will made no per-archetype tuning claim, so Global's leaders bend nothing yet.
    for (const leader of leadershipRules(layers.global10r).leaders)
      expect(Object.keys(leader.tuning || {}), leader.id).toHaveLength(0);
  });
});


describe('the advisor ladders', () => {
  it("selects by the dominant term, in each course's own vocabulary", () => {
    const us = layers.us11r;
    const leader = leaderById(leadershipRules(us), 'limited_gov_leader');

    expect(selectLadder({ layer: us, dominant: 'approval', leader }).key).toBe('consent_of_the_governed');
    expect(selectLadder({ layer: us, dominant: 'crime', leader }).key).toBe('rule_of_law');
    expect(selectLadder({ layer: us, dominant: 'tax', leader }).key).toBe('limited_government');
    expect(selectLadder({ layer: us, dominant: 'unemployment', leader }).key).toBe('limited_government_depression');

    const global = layers.global10r;
    const founder = leaderById(leadershipRules(global), 'founder');
    expect(selectLadder({ layer: global, dominant: 'crime', leader: founder }).key).toBe('human_rights');
    expect(selectLadder({ layer: global, dominant: 'tax', leader: founder }).key).toBe('scarcity');
  });

  it('climbs only while the same pressure keeps leading', () => {
    const layer = layers.us11r;
    const leader = leaderById(leadershipRules(layer), 'limited_gov_leader');

    const first = nextClue({ layer, dominant: 'tax', leader, unrestValue: 40, year: 1900, state: {} });
    expect(first.rung).toBe(0);

    const second = nextClue({ layer, dominant: 'tax', leader, unrestValue: 50, year: 1902, state: first.state });
    expect(second.rung).toBe(1);

    const third = nextClue({ layer, dominant: 'tax', leader, unrestValue: 60, year: 1904, state: second.state });
    expect(third.rung).toBe(2);

    // Never past the tip, and a different pressure starts at the bottom again.
    const fourth = nextClue({ layer, dominant: 'tax', leader, unrestValue: 70, year: 1906, state: third.state });
    expect(fourth.rung).toBe(2);
    expect(nextClue({ layer, dominant: 'crime', leader, unrestValue: 70, year: 1908, state: third.state }).rung).toBe(0);
  });

  it('stays quiet between clues', () => {
    const layer = layers.us11r;
    const leader = leaderById(leadershipRules(layer), 'limited_gov_leader');
    const first = nextClue({ layer, dominant: 'tax', leader, unrestValue: 40, year: 1900, state: {} });

    expect(nextClue({ layer, dominant: 'tax', leader, unrestValue: 45, year: 1901, state: first.state })).toBeNull();
  });

  it('reads crime the leader causes as Due Process, and falls back while that ladder has no lines', () => {
    const layer = layers.us11r;
    const lawful = { id: 'x', disposition: { militarism: 0.1 } };
    const lawless = { id: 'y', disposition: { militarism: 0.9 } };

    // The distinction BK ruled on is built: the selector can tell the two apart.
    const dueProcess = layer.ladders.find(l => l.key === 'due_process');
    expect(dueProcess.when.leader_conduct).toBe(true);
    expect(dueProcess.tiers).toHaveLength(0);

    // Until Sam writes its lines, both readings speak Rule of Law rather than saying nothing.
    expect(selectLadder({ layer, dominant: 'crime', leader: lawful }).key).toBe('rule_of_law');
    expect(selectLadder({ layer, dominant: 'crime', leader: lawless }).key).toBe('rule_of_law');
  });

  it('never names the issue or the principle out loud', () => {
    const banned = /enduring issue|civic principle|rule of law|due process|consent of the governed|checks and balances|popular sovereignty|limited government|human rights|nationalism|scarcity/i;

    for (const [course, layer] of Object.entries(layers)) {
      for (const ladder of layer.ladders) {
        for (const line of ladder.tiers)
          expect(line, `${course}:${ladder.key}`).not.toMatch(banned);
      }
    }
  });
});


describe('a save carries the government home', () => {
  const rules = leadershipRules(layers.us11r);

  it('round-trips the leader, the mood and the history', () => {
    const state = { leader: 'activist_gov_leader', since: 1912, tenureEnds: 1934, unrest: 41, sustained: 1,
                    history: [{ leader: 'founder', from: 1900, to: 1912, ended: 'succession' }] };
    const back = fromSave(toSave(state), rules, 1912);

    expect(back).toEqual(state);
  });

  it("starts a save that predates leadership with the scenario's own first leader", () => {
    expect(fromSave(undefined, rules, 1900, fixed(0.5)).leader).toBe('founder');
    expect(fromSave({ leader: 'a_leader_from_another_scenario' }, rules, 1900, fixed(0.5)).leader).toBe('founder');
  });
});


describe('the change-of-government copy', () => {
  it('explains what happened before it asks the student to name it', () => {
    const layer = layers.global10r;
    const rules = leadershipRules(layer);
    const outgoing = { id: 'founder', ...leaderVoice(leaderById(rules, 'founder'), 1930) };
    const incoming = { id: 'strongman', ...leaderVoice(leaderById(rules, 'strongman'), 1930) };

    const change = changeOfGovernmentFor({ event: EVENT_OVERTHROW, outgoing, incoming, layer });

    expect(change.explain).toMatch(/not a term ending/i);
    expect(change.explain).toMatch(/crime the town did not believe/);
    expect(change.explain).toMatch(/founding choice still stands/i);
    expect(change.prompt).toBe(layer.debrief.prompt);
    expect(change.took_office).toContain(incoming.label);
  });

  it('says something different when a term simply ended', () => {
    const layer = layers.us11r;
    const rules = leadershipRules(layer);
    const outgoing = { id: 'founder', ...leaderVoice(leaderById(rules, 'founder'), 1820) };
    const incoming = { id: 'limited_gov_leader', ...leaderVoice(leaderById(rules, 'limited_gov_leader'), 1820) };

    const change = changeOfGovernmentFor({ event: EVENT_SUCCESSION, outgoing, incoming, layer, year: 1820,
                                           since: 1800 });
    expect(change.explain).toMatch(/that term has ended/i);
    expect(change.explain).toMatch(/Nothing you built changes hands/i);
  });
});


// Small helper so the two tests above read as the panel does.
function changeOfGovernmentFor({ event, outgoing, incoming, layer, year = 1930, since = 1900 }) {
  return changeOfGovernment({ strings, event, outgoing, incoming, year, since, sustainedYears: 3,
                              dominant: 'crime', layer });
}
