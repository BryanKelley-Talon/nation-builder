/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// The two dials a student can move during play: how heavily the town is policed, and what it spends on schools.
// Both are cost-benefit by construction — every setting buys something and costs something else.

import { readFileSync } from 'node:fs';

import { selectLadder } from '../../src/nb/clues.js';
import { currentTuning } from '../../src/nb/governance.js';
import { DEFAULT_STANCE, restrictsLiberties, stancePressure, stanceTuning, STANCES } from '../../src/nb/policing.js';
import { FUNDING, LEVELS, unrestRelief, yearlyCost } from '../../src/nb/schools.js';
import { nextUnrest } from '../../src/nb/unrest.js';

const layers = {
  us11r: JSON.parse(readFileSync(new URL('../../content/leadership/us11r.json', import.meta.url))),
};
const TOWN = { year: 1900, approval: 70, crimeAverage: 90, taxRate: 7, unemployment: 0, score: 500,
               population: 5000 };

describe('the policing dial', () => {
  it('offers three stances and starts in the middle', () => {
    expect(STANCES).toEqual(['light', 'balanced', 'heavy']);
    expect(DEFAULT_STANCE).toBe('balanced');
    expect(stanceTuning('balanced')).toEqual({});
  });

  it('trades crime against resentment, in both directions', () => {
    const heavy = currentTuning({ leader: stanceTuning('heavy') });
    const light = currentTuning({ leader: stanceTuning('light') });

    expect(heavy.policeEffectiveness).toBeGreaterThan(light.policeEffectiveness);
    expect(heavy.crimePressure).toBeLessThan(light.crimePressure);
    // And the heavy hand is the one the town resents.
    expect(stancePressure('heavy')).toBeGreaterThan(stancePressure('light'));
    expect(stancePressure('light')).toBe(0);
  });

  it('shows up in unrest as its own pressure, not as crime', () => {
    const calm = nextUnrest({ snapshot: TOWN, libertiesPressure: stancePressure('balanced') });
    const heavy = nextUnrest({ snapshot: TOWN, libertiesPressure: stancePressure('heavy') });

    expect(heavy.value).toBeGreaterThan(calm.value);
    expect(heavy.terms.liberties).toBeGreaterThan(0);
    expect(calm.terms.liberties).toBe(0);
  });

  it("unlocks Sam's Individual Rights ladder, which could not fire before", () => {
    const layer = layers.us11r;
    const leader = { id: 'x', disposition: { militarism: 0.2 } };

    // A town policed with an even hand: the ladder stays shut, as it has since it was written.
    const open = { ...leader, disposition: { ...leader.disposition, liberties: 'open' } };
    expect(selectLadder({ layer, dominant: 'militarism', leader: open })?.key).not.toBe('individual_rights');

    // A heavy hand is a government restricting liberties, whoever is in office.
    expect(restrictsLiberties('heavy')).toBe(true);
    const restricting = { ...leader, disposition: { ...leader.disposition, liberties: 'restricting' } };
    expect(selectLadder({ layer, dominant: 'militarism', leader: restricting }).key).toBe('individual_rights');
  });
});

describe('the school funding line', () => {
  it('charges per school the town has actually built', () => {
    expect(yearlyCost('full', 0)).toBe(0);
    expect(yearlyCost('full', 3)).toBe(FUNDING.full.cost * 3);
    expect(yearlyCost('none', 5)).toBe(0);
  });

  it('buys a steadier town, and only when it is paid for', () => {
    expect(unrestRelief('full', 3)).toBeGreaterThan(unrestRelief('basic', 3));
    expect(unrestRelief('none', 3)).toBe(0);
    // A town that cannot pay the bill does not get the benefit.
    expect(unrestRelief('full', 3, { paid: false })).toBe(0);
    // Nor does funding schools a town has never built.
    expect(unrestRelief('full', 0)).toBe(0);
  });

  it('is a cost-benefit choice at every setting', () => {
    for (const level of LEVELS) {
      const { cost, relief } = FUNDING[level];
      // Spending nothing relieves nothing; spending more relieves more. No setting is free and good.
      expect(cost === 0 ? relief === 0 : relief > 0, level).toBe(true);
    }
    expect(FUNDING.full.cost).toBeGreaterThan(FUNDING.basic.cost);
    expect(FUNDING.full.relief).toBeGreaterThan(FUNDING.basic.relief);
  });
});
