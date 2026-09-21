/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Scenario questions: the two banks the desks delivered, the gate a student has to get through, what resolving it
// gives the town, and the beat it arrives on.

import { readFileSync } from 'node:fs';

import { answerChoice, asked, attemptIsReal, consequence, DEFAULT_EVERY_YEARS, DEFAULT_FIRST_AFTER_YEARS, gateReducer,
         isDue, MIN_ATTEMPT_CHARS, nextItem, questionRules, startGate, validateQuestionBank }
  from '../../src/nb/questions.js';
import { bendTuning } from '../../src/nb/governance.js';
import { DEFAULT_TUNING } from '../../src/tuning.js';

const bank = course => validateQuestionBank(JSON.parse(readFileSync(
  new URL(`../../content/questions/${course}.json`, import.meta.url))));
const banks = { us11r: bank('us11r'), global10r: bank('global10r') };
const allItems = Object.values(banks).flatMap(b => b.items);
const choices = allItems.filter(item => item.type === 'choice');
const written = allItems.filter(item => item.type === 'written');

const itemById = id => allItems.find(item => item.id === id);
const wrongOptions = item => item.options.map(o => o.id).filter(id => id !== item.correct);
const run = (item, actions) => actions.reduce((state, action) => gateReducer(item, state, action), startGate(item));

// One known exception to "a hint never says the answer", wired verbatim because BK ruled the item as written. It is
// named here, by id and hint, so a second one cannot slip in quietly. Flagged to Sam in the 2026-09-21 handoff.
const HINT_NAMES_ANSWER = { 'us11r-sq-federalism': [1] };


describe('the question banks', () => {
  it("carries Sam's six and Will's twelve", () => {
    expect(banks.us11r.items).toHaveLength(6);
    expect(banks.global10r.items).toHaveLength(12);
    expect(banks.us11r.items.filter(item => item.type === 'choice')).toHaveLength(4);
    expect(banks.us11r.items.filter(item => item.type === 'written')).toHaveLength(2);
  });

  it('carries the content license, never the code license', () => {
    for (const b of Object.values(banks)) {
      expect(b.license.name).toBe('CC BY-NC-SA 4.0');
      expect(JSON.stringify(b)).not.toMatch(/GNU|GPL/);
    }
  });

  it('marks every exemplar and checklist the build session wrote, so nobody mistakes it for a desk’s', () => {
    for (const item of written) {
      const provenance = `${item._source} ${item._checklist_note || ''}`;
      expect(provenance, item.id).toMatch(/BUILD SESSION 2026-09-21/);
    }
  });

  it('rejects a bank that cannot be played', () => {
    const good = () => JSON.parse(JSON.stringify(banks.us11r));
    const broken = [
      b => { b.items[0].correct = 'z'; },
      b => { b.items[0].hints = []; },
      b => { b.items[3].exemplar = ''; },
      b => { b.items[3].checklist = []; },
      b => { b.items[1].id = b.items[0].id; },
      b => { b.items[0].type = 'essay'; },
    ];
    for (const breakIt of broken) {
      const b = good();
      breakIt(b);
      expect(() => validateQuestionBank(b)).toThrow();
    }
  });
});


describe('a choice question is a real mastery gate', () => {
  it('stays shut on a wrong answer, and a wrong answer brings the next hint', () => {
    for (const item of choices) {
      const [wrong] = wrongOptions(item);
      const state = run(item, [{ type: 'choose', optionId: wrong }]);
      expect(state.resolved, item.id).toBe(false);
      expect(state.hintsShown, item.id).toBe(1);
      expect(state.tried, item.id).toEqual([wrong]);
    }
  });

  it('climbs one hint per wrong answer and stops at the last, never past it', () => {
    for (const item of choices) {
      let hints = 0;
      for (let i = 0; i < 10; i++)
        hints = answerChoice(item, '__wrong__', hints).hintsShown;
      expect(hints, item.id).toBe(item.hints.length);
    }
  });

  it('does not charge twice for the same wrong answer', () => {
    const item = itemById('us11r-sq-due-process');
    const state = run(item, [{ type: 'choose', optionId: 'a' }, { type: 'choose', optionId: 'a' }]);
    expect(state.hintsShown).toBe(1);
  });

  it('opens on the right answer, and only on the right answer', () => {
    for (const item of choices) {
      const afterEveryWrong = run(item, wrongOptions(item).map(optionId => ({ type: 'choose', optionId })));
      expect(afterEveryWrong.resolved, item.id).toBe(false);

      const right = gateReducer(item, afterEveryWrong, { type: 'choose', optionId: item.correct });
      expect(right.resolved, item.id).toBe(true);
    }
  });

  it('has no way past it but the answer: hint, finish and reveal do nothing', () => {
    for (const item of choices) {
      const state = run(item, [{ type: 'hint' }, { type: 'finish' }, { type: 'reveal' }]);
      expect(state.resolved, item.id).toBe(false);
      expect(state.hintsShown, item.id).toBe(0);
    }
  });

  it('never has a hint say the answer', () => {
    for (const item of choices) {
      const answer = item.options.find(option => option.id === item.correct).label.toLowerCase();
      item.hints.forEach((hint, i) => {
        if ((HINT_NAMES_ANSWER[item.id] || []).includes(i))
          return;
        expect(hint.toLowerCase().includes(answer), `${item.id} hint ${i + 1}: ${hint}`).toBe(false);
      });
    }
  });

  it('keeps the known exception to that rule to the one item BK ruled as written', () => {
    const item = itemById('us11r-sq-federalism');
    expect(item.hints[1]).toMatch(/Federalism/);
    expect(item._hint_names_answer).toBeTruthy();
  });

  it("offers Will's named-term items with the other terms from his own set, and invents none", () => {
    const terms = new Set(banks.global10r.items.map(item => item._term).filter(Boolean));
    for (const item of banks.global10r.items.filter(i => i.type === 'choice')) {
      for (const option of item.options)
        expect(terms.has(option.label), `${item.id}: ${option.label}`).toBe(true);
      expect(item.options.find(o => o.id === item.correct).label).toBe(item._resolution);
    }
  });
});


describe('a written question is a sequence, not a proof', () => {
  const item = written[0];
  const attempt = 'For years the town had been taxed hard and the watch was thin.';

  it('keeps the model locked until a real attempt is written', () => {
    expect(run(item, [{ type: 'reveal' }]).revealed).toBe(false);
    expect(run(item, [{ type: 'write', text: 'idk' }, { type: 'reveal' }]).revealed).toBe(false);
    expect(run(item, [{ type: 'write', text: ' '.repeat(40) }, { type: 'reveal' }]).revealed).toBe(false);
    expect(run(item, [{ type: 'write', text: attempt }, { type: 'reveal' }]).revealed).toBe(true);
    expect(attemptIsReal('x'.repeat(MIN_ATTEMPT_CHARS))).toBe(true);
  });

  it('does not open before the model has been read', () => {
    const state = run(item, [{ type: 'finish' }, { type: 'check', index: 0 }, { type: 'write', text: attempt },
                             { type: 'finish' }]);
    expect(state.resolved).toBe(false);
    expect(state.checked.every(on => !on)).toBe(true);
  });

  it('freezes the attempt once the model is on screen', () => {
    const state = run(item, [{ type: 'write', text: attempt }, { type: 'reveal' },
                             { type: 'write', text: 'copied from the model' }]);
    expect(state.attempt).toBe(attempt);
  });

  it('opens once the checklist is done, whatever the student ticked', () => {
    for (const each of written) {
      const nothingTicked = run(each, [{ type: 'write', text: attempt }, { type: 'reveal' }, { type: 'finish' }]);
      expect(nothingTicked.resolved, each.id).toBe(true);

      const allTicked = run(each, [{ type: 'write', text: attempt }, { type: 'reveal' },
                                   ...each.checklist.map((_, index) => ({ type: 'check', index })),
                                   { type: 'finish' }]);
      expect(allTicked.checked.every(Boolean), each.id).toBe(true);
      expect(allTicked.resolved, each.id).toBe(true);
    }
  });

  it('lets a student ask for hints, one at a time, up to the last', () => {
    const state = run(item, Array.from({ length: 6 }, () => ({ type: 'hint' })));
    expect(state.hintsShown).toBe(item.hints.length);
  });

  it('is done once resolved: nothing changes it afterwards', () => {
    const done = run(item, [{ type: 'write', text: attempt }, { type: 'reveal' }, { type: 'finish' }]);
    expect(gateReducer(item, done, { type: 'check', index: 0 })).toBe(done);
    expect(gateReducer(item, done, { type: 'hint' })).toBe(done);
  });
});


describe('resolving a question moves the town', () => {
  it('gives a small unrest relief and one bounded bend', () => {
    for (const b of Object.values(banks)) {
      const effect = consequence(b, { hintsUsed: 0 });
      expect(effect.unrest).toBeLessThan(0);
      expect(effect.unrest).toBeGreaterThanOrEqual(-10);
      expect(Object.keys(effect.tuning)).toHaveLength(1);

      const bent = bendTuning(DEFAULT_TUNING, effect.tuning);
      expect(bent.taxGrowthDrag).toBeLessThan(DEFAULT_TUNING.taxGrowthDrag);
    }
  });

  it('costs the town something for every hint, floored at nothing', () => {
    const b = banks.us11r;
    const relief = hints => -consequence(b, { hintsUsed: hints }).unrest;
    expect(relief(0)).toBeGreaterThan(relief(1));
    expect(relief(1)).toBeGreaterThan(relief(2));
    expect(relief(3)).toBe(0);
    expect(relief(9)).toBe(0);
  });
});


describe('questions arrive on a beat, not out of a crisis', () => {
  const rules = questionRules({});

  it('defaults to every five years, first at year three', () => {
    expect(rules).toEqual({ everyYears: DEFAULT_EVERY_YEARS, firstAfterYears: DEFAULT_FIRST_AFTER_YEARS });
    expect(DEFAULT_EVERY_YEARS).toBe(5);
    expect(DEFAULT_FIRST_AFTER_YEARS).toBe(3);
  });

  it('lets a scenario set its own beat', () => {
    expect(questionRules({ question_rules: { every_years: 3, first_after_years: 1 } }))
      .toEqual({ everyYears: 3, firstAfterYears: 1 });
    expect(questionRules({ question_rules: { every_years: 0 } }).everyYears).toBe(DEFAULT_EVERY_YEARS);
  });

  it('never lands on the same year-end as the year in review, which stops play every fifth year', () => {
    // Walk forty years of a 1789 town and a 1900 town the way the session does.
    for (const startYear of [1789, 1900]) {
      let state = {};
      const askedIn = [];
      for (let year = startYear; year < startYear + 40; year++) {
        const reviewYear = year % 5 === 0;
        if (!reviewYear && isDue({ rules, state, year, startYear })) {
          state = asked(state, nextItem(banks.us11r, state).index, year);
          askedIn.push(year);
        }
      }
      expect(askedIn[0], `${startYear}`).toBe(startYear + 3);
      expect(askedIn.length, `${startYear}`).toBeGreaterThanOrEqual(7);
      for (let i = 1; i < askedIn.length; i++)
        expect(askedIn[i] - askedIn[i - 1], `${startYear}: ${askedIn}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('works through the bank in order and starts again when it runs out', () => {
    let state = {};
    const ids = [];
    for (let i = 0; i < 8; i++) {
      const next = nextItem(banks.us11r, state);
      ids.push(next.item.id);
      state = asked(state, next.index, 1800 + i * 5);
    }
    expect(ids.slice(0, 6)).toEqual(banks.us11r.items.map(item => item.id));
    expect(ids.slice(6)).toEqual(banks.us11r.items.slice(0, 2).map(item => item.id));
  });
});
