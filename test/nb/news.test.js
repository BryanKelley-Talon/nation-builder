/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

import { readFileSync } from 'node:fs';

import * as Messages from '../../src/messages.ts';
import { eraRules } from '../../src/nb/era.js';
import { makeNewsroom, storyFor, vignette } from '../../src/nb/news.js';
import { skillLabel, validateScenario } from '../../src/nb/scenario.js';

const strings = JSON.parse(readFileSync(new URL('../../content/ui/strings.json', import.meta.url)));
const fixture = validateScenario(
  JSON.parse(readFileSync(new URL('../../content/scenarios/dev-fixture-us11r.json', import.meta.url))));
const rules = eraRules(fixture);

function print(subject, year, options = {}) {
  const story = storyFor(subject);
  return vignette({ story, strings, scenario: fixture, rules, townName: 'Testville', year, skillLabel, ...options });
}

describe('the newsroom', () => {
  it('prints at most one story a year, however often the engine repeats itself', () => {
    const newsroom = makeNewsroom();
    expect(newsroom.consider(Messages.NEED_MORE_RESIDENTIAL, 1800)).not.toBeNull();
    expect(newsroom.consider(Messages.NEED_MORE_COMMERCIAL, 1800)).toBeNull();
    expect(newsroom.consider(Messages.NEED_MORE_RESIDENTIAL, 1800)).toBeNull();
    expect(newsroom.consider(Messages.NEED_MORE_COMMERCIAL, 1801)).not.toBeNull();
  });

  it('does not run the same story twice within five years', () => {
    const newsroom = makeNewsroom();
    expect(newsroom.consider(Messages.HIGH_CRIME, 1800).key).toBe('high_crime');
    expect(newsroom.consider(Messages.HIGH_CRIME, 1803)).toBeNull();
    expect(newsroom.consider(Messages.HIGH_CRIME, 1805).key).toBe('high_crime');
  });

  it('lets a scenario set its own pace', () => {
    const newsroom = makeNewsroom({ everyYears: 3, repeatYears: 20 });
    expect(newsroom.consider(Messages.NEED_MORE_ROADS, 1800)).not.toBeNull();
    expect(newsroom.consider(Messages.NEED_MORE_RESIDENTIAL, 1802)).toBeNull();
    expect(newsroom.consider(Messages.NEED_MORE_RESIDENTIAL, 1803)).not.toBeNull();
    expect(newsroom.consider(Messages.NEED_MORE_ROADS, 1810)).toBeNull();
  });

  it("leaves the engine's own chatter alone", () => {
    const newsroom = makeNewsroom();
    expect(storyFor(Messages.FUNDS_CHANGED)).toBeNull();
    expect(newsroom.consider(Messages.FUNDS_CHANGED, 1800)).toBeNull();
    expect(newsroom.consider(Messages.MONSTER_SIGHTED, 1800)).toBeNull();
  });
});

describe('a vignette', () => {
  it("is a masthead, a headline and the advisor's counsel", () => {
    const story = print(Messages.NEED_MORE_RESIDENTIAL, 1801);
    expect(story.masthead).toBe('The Testville Gazette');
    expect(story.dateline).toBe('1801');
    expect(story.headline).toBeTruthy();
    expect(story.counsel).toBeTruthy();
    expect(story.byline).toBe('Your advisor');
  });

  it('carries the skill line of the mechanic it teaches, and nothing where there is none', () => {
    expect(print(Messages.NEED_MORE_RESIDENTIAL, 1801).skillLabel).toBe('TH');
    expect(print(Messages.NEED_MORE_ROADS, 1801).skillLabel).toBe('DU');
    expect(print(Messages.HIGH_CRIME, 1801).skillLabel).toBe('CP');
    expect(print(Messages.NEED_FIRE_STATION, 1801).skillLabel).toBeNull();
  });

  it('says so when the citizens ask for something their year does not have', () => {
    const early = print(Messages.NEED_POLICE_STATION, 1800);
    expect(early.counsel).toContain('1838');

    const later = print(Messages.NEED_POLICE_STATION, 1900);
    expect(later.counsel).not.toContain('1838');
    expect(later.counsel).not.toBe(early.counsel);
  });

  it('asks for electricity only once electricity exists', () => {
    expect(print(Messages.NEED_ELECTRICITY, 1820).counsel).toContain('1882');
    expect(print(Messages.NEED_ELECTRICITY, 1890).counsel).not.toContain('1882');
  });

  it('has words for every story the newsroom can pick', () => {
    const subjects = Object.values(Messages).filter(subject => storyFor(subject));
    expect(subjects.length).toBeGreaterThan(10);
    for (const subject of subjects) {
      const story = print(subject, 1900);
      expect(story, subject).not.toBeNull();
      expect(story.headline, subject).toBeTruthy();
      expect(story.counsel, subject).toBeTruthy();
      expect(story.counsel, subject).not.toContain('{');
    }
  });
});
