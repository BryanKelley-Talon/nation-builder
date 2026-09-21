/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// A standing rule, from BK on 2026-09-20: no internal shorthand ever reaches a player-facing screen. The skill-line
// codes (TH, DU, HC, CP, EX, EI) are how the desks talk to each other about mechanics; they live in a scenario's
// skill_line_map and go no further. Desk vocabulary — DEV POLE, placeholder, fixture — does not reach a player
// either. This test reads what the game can actually say and puts those rules in writing.

import { readdirSync, readFileSync } from 'node:fs';

import { validateScenario } from '../../src/nb/scenario.js';

const CONTENT = new URL('../../content/', import.meta.url);
const SRC = new URL('../../src/nb/', import.meta.url);

const SKILL_CODE = /\b(TH|DU|HC|CP|EX|EI)\b/;
const DESK_WORDS = /\b(dev pole|dev fixture|placeholder|not real content|lorem)\b/i;

const strings = JSON.parse(readFileSync(new URL('ui/strings.json', CONTENT)));

// Everything under a key beginning with "_" is a note to the desks, not player-facing text.
function playerFacingStrings(value, path = []) {
  if (typeof value === 'string')
    return [[path.join('.'), value]];
  if (value === null || typeof value !== 'object')
    return [];
  return Object.entries(value)
    .filter(([key]) => !key.startsWith('_') && key !== 'license')
    .flatMap(([key, child]) => playerFacingStrings(child, [...path, key]));
}

function scenarios() {
  return readdirSync(new URL('scenarios/', CONTENT))
    .filter(name => name.endsWith('.json') && name !== 'index.json')
    .map(name => validateScenario(JSON.parse(readFileSync(new URL(`scenarios/${name}`, CONTENT)))));
}

describe('no internal shorthand reaches a player', () => {
  it('keeps skill-line codes out of the words the game says', () => {
    for (const [path, text] of playerFacingStrings(strings)) {
      expect(SKILL_CODE.test(text), `${path}: ${text}`).toBe(false);
      expect(DESK_WORDS.test(text), `${path}: ${text}`).toBe(false);
    }
  });

  it("keeps them out of every scenario's player-facing text", () => {
    for (const scenario of scenarios()) {
      const texts = [scenario.title, ...Object.values(scenario.governance_poles)
        .filter(Boolean)
        .flatMap(pole => [pole.label, pole.summary])];

      for (const text of texts) {
        expect(SKILL_CODE.test(text), text).toBe(false);
        expect(DESK_WORDS.test(text), text).toBe(false);
      }
    }
  });

  it('still keeps the skill lines in the data, where the desks need them', () => {
    for (const scenario of scenarios()) {
      expect(scenario.skill_line_map.governance_dial).toMatch(SKILL_CODE);
      expect(scenario.skill_line_map.zone_placement).toMatch(SKILL_CODE);
    }
  });

  it('renders no skill chip anywhere in the screens', () => {
    for (const name of readdirSync(SRC).filter(file => file.endsWith('.jsx'))) {
      const source = readFileSync(new URL(name, SRC), 'utf8');
      expect(source, name).not.toMatch(/SkillChip/);
      expect(source, name).not.toMatch(/skillLabel/);
    }
  });
});
