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

// The leadership layers are player-facing too: leader labels, summaries, every advisor ladder line, the debrief.
const leadershipLayers = readdirSync(new URL('leadership/', CONTENT))
  .filter(name => name.endsWith('.json'))
  .map(name => [name, JSON.parse(readFileSync(new URL(`leadership/${name}`, CONTENT)))]);

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

  it('keeps them out of every leadership layer a student can hear', () => {
    for (const [name, layer] of leadershipLayers) {
      const texts = [
        ...layer.leaders.flatMap(leader => [leader.label, leader.summary,
          ...(leader.by_era || []).flatMap(era => [era.label, era.summary])]),
        ...layer.ladders.flatMap(ladder => ladder.tiers),
        layer.debrief.prompt,
      ].filter(Boolean);

      expect(texts.length, name).toBeGreaterThan(10);
      for (const text of texts) {
        expect(SKILL_CODE.test(text), `${name}: ${text}`).toBe(false);
        expect(DESK_WORDS.test(text), `${name}: ${text}`).toBe(false);
      }
    }
  });

  it('keeps them out of every scenario question a student can see', () => {
    // Everything a question puts on screen: prompt, options, hints, the model answer and the checklist. The desks'
    // own labels for an item (the skill it practises, the umbrella it sits under) live under "_" keys and stay there.
    const banks = readdirSync(new URL('questions/', CONTENT))
      .filter(name => name.endsWith('.json'))
      .map(name => [name, JSON.parse(readFileSync(new URL(`questions/${name}`, CONTENT)))]);
    expect(banks.map(([name]) => name).sort()).toEqual(['global10r.json', 'us11r.json']);

    for (const [name, bank] of banks) {
      const texts = playerFacingStrings(bank.items).filter(([path]) => !/\.(id|type|correct)$/.test(path));
      expect(texts.length, name).toBeGreaterThan(40);
      for (const [path, text] of texts) {
        expect(SKILL_CODE.test(text), `${name}:${path}: ${text}`).toBe(false);
        expect(DESK_WORDS.test(text), `${name}:${path}: ${text}`).toBe(false);
        expect(text, `${name}:${path}`).not.toMatch(/\b(six moves|enduring issue|umbrella issue list|skill line)\b/i);
      }
    }
  });

  it('never hands the student the vocabulary word the ladder is pointing at', () => {
    // Both desks wrote to this rule: the advisor gets near the tip and stops. Naming the Enduring Issue or the
    // Civic Principle out loud would be doing the student's own work for them.
    const NAMES = /enduring issue|civic principle|rule of law|due process|consent of the governed|checks and balances|popular sovereignty|limited government|human rights|nationalism|scarcity|social contract/i;

    for (const [name, layer] of leadershipLayers) {
      for (const ladder of layer.ladders) {
        for (const line of ladder.tiers)
          expect(NAMES.test(line), `${name}:${ladder.key}: ${line}`).toBe(false);
      }
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
